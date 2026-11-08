// Fixed within-criterion laws; editable cross-criterion coupling. Scientific outputs are public core calls.
import {createWidget} from '../shared/base.js';
import {labelOn,numText,plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatExpectedCount,formatGrades,formatProb,formatRisk,formatSetting,formatShare} from '../shared/format.js';
import {evaluateReport,realizedWrong,weightedError,wrongCountDistribution} from '../pr-core.js';
import {CHAPTER19,couplingLaw} from '../shared/criteria-laws.js';
import {ESTIMAND_CSS,estimandComparison,createEstimandCostView,createEstimandLawView,createEstimandReportView} from './composite-or-criterion.js';
import {PAIR_COST_CSS} from './conflict-pairs.js';
import {CRITERIA_PROFILE_CSS} from './several-criteria.js';

export const OPEN_PAIRS_KEYS={
 law:{type:'choice',values:['coupling','ch19'],value:'coupling'},
 lambda:{type:'number',min:0,max:1,step:.01,value:1},
 w:{type:'number',min:0,max:1,step:.01,value:.5},
 tau:{type:'number',min:.01,max:.5,step:.01,value:.2},
 report:{type:'string',value:'1/2'}
};
export const OPEN_PAIRS_CSS=`
.jnt .jnt-controls{display:flex;flex-wrap:wrap;gap:.65rem;min-width:0}.jnt .jnt-controls .prx-control{max-width:100%;min-width:0}.jnt .jnt-controls select{max-width:100%;min-width:0}
.jnt .jnt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr));gap:.85rem;min-width:0}.jnt .jnt-section{min-width:0;margin:.9rem 0}.jnt .jnt-paper{padding:.7rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border-radius:.35rem;min-width:0}
.jnt .jnt-paper .prx-panel-title,.jnt .jnt-paper .prx-result-tag{color:var(--prx-plot-fg)}.jnt .jnt-note{font-size:.88rem;line-height:1.45}.jnt .jnt-paper .jnt-note{color:var(--prx-plot-muted)}
.jnt.prx-widget .jnt-paper table,.jnt.prx-widget .jnt-paper th,.jnt.prx-widget .jnt-paper td{background:var(--prx-plot-bg);color:var(--prx-plot-fg)}
.jnt .jnt-scroll{overflow-x:auto;max-width:100%;min-width:0}.jnt .jnt-table{min-width:39rem;width:100%;border-collapse:collapse;font-size:.84rem}.jnt .jnt-table th,.jnt .jnt-table td{padding:.4rem .5rem;text-align:right;white-space:nowrap;border-bottom:1px solid var(--prx-plot-grid)}.jnt .jnt-table th:first-child,.jnt .jnt-table td:first-child{text-align:left}.jnt .jnt-table.jnt-compact{min-width:18rem}.jnt .jnt-table.jnt-pairs{min-width:25rem}
.jnt .jnt-report-select select{background:var(--prx-bg);color:var(--prx-fg);padding:.35rem;border:1px solid var(--prx-border-strong);border-radius:.25rem}.jnt .jnt-report-select label{display:block;font-weight:600}
.jnt .jnt-selected{font-weight:600}.jnt .jnt-context{margin-top:1.2rem}.jnt .prx-readout{background:var(--prx-plot-bg);color:var(--prx-plot-fg)}
`;
const JOINT_OVERVIEW_CSS=`
.jnt .jnt-primary-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem .7rem;width:100%}
.jnt .jnt-primary-controls select{width:100%}
.jnt .jnt-primary-controls .prx-control{min-width:0}
.jnt .jnt-overview{margin:0}
.jnt .jnt-overview p{margin:.3rem 0}
@media(max-width:650px){
 .jnt .jnt-primary-controls{grid-template-columns:repeat(2,minmax(0,1fr))}
 .jnt .jnt-primary-controls [data-prx-primary-control]{grid-column:1/-1}
}
`;
const keyOf=g=>Array.from(g).join('/');
const cached=new Map();
/** Only approved display arithmetic: complement the engine's weighted wrong fraction for a fixed report. */
function fixedAccuracy(grade,E,w,tau){
 const weighted={ids:E.ids,criteria:['weighted'],e:[weightedError(E,w)]};
 const evaluation=evaluateReport(grade,weighted,{tau,w:[1]});
 return {weightedEvaluation:evaluation,meanCorrectFraction:evaluation.N>0?1-evaluation.EoverN[0]:null};
}
/** Complete fixed-report diagnostics, independent of which objective happens to choose that report. */
export function solveOpenPairs(state){
 const cacheKey=JSON.stringify([state.law,state.law==='coupling'?state.lambda:null,state.w,state.tau]);
 let base=cached.get(cacheKey);
 if(!base){
  const law=state.law==='coupling'?couplingLaw(state.lambda):CHAPTER19,w=[state.w,1-state.w],a=state.law==='coupling'?[.5,.5]:[.75,.25];
  const comparison=estimandComparison(law,{w,a,tau:state.tau,multiplier:[1,1],family:{kind:'all'},pair:state.law==='coupling'?[0,1]:[1,2]});
  const reports=comparison.allReports.map(report=>({...report,
   wrong:wrongCountDistribution(report.grade,law.states,law.probs,{w}),
   states:law.states.map((values,s)=>({s,prob:law.probs[s],...realizedWrong(report.grade,values,{w})})),
   ...fixedAccuracy(report.grade,comparison.criterionE,w,state.tau)
  }));
  base={law,w,a,tau:state.tau,comparison,reports};cached.set(cacheKey,base);
  if(cached.size>40)cached.delete(cached.keys().next().value);
 }
 const fallback=state.law==='coupling'?'1/2':'1/2/2/3',selected=base.reports.find(r=>keyOf(r.grade)===state.report)??base.reports.find(r=>keyOf(r.grade)===fallback);
 return {...base,state,selected};
}
const name=(ctx,s)=>ctx.h('span',{'data-prx-name':'',text:s});
function n(ctx,x,kind='risk',hook){
 const format=kind==='prob'?formatProb:kind==='count'?formatCount:kind==='expected'?formatExpectedCount:kind==='share'?formatShare:kind==='grade'?formatGrades:kind==='setting'?formatSetting:kind==='value'?v=>formatDecimal(v,{digits:3}):formatRisk;
 const node=ctx.num(x,format(x));if(hook)node.dataset.prxReadout=hook;return node;
}
function table(ctx,headers,rows,cls=''){return ctx.h('table',{class:`jnt-table ${cls}`},ctx.h('thead',{},ctx.h('tr',{},...headers.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(v=>ctx.h('td',{},v))))));}
function hint(ctx){return ctx.h('p',{class:'jnt-note'},'Wide tables scroll inside this panel. Focus the region and use the arrow keys.');}
function wide(ctx,parent,label,node){const region=ctx.h('div',{class:'jnt-scroll'},node);ctx.scrollRegion(region,label);parent.append(region);return region;}
function reportWords(grade,ids){return grade[0]===grade[1]?'Withhold':grade[0]<grade[1]?`${ids[0]} above ${ids[1]}`:`${ids[1]} above ${ids[0]}`;}
export function createOpenPairsSlots(ctx,parent=ctx.charts,{data,optimization}={}){
 const grid=ctx.h('div',{class:'jnt-grid jnt-section'}),fixed=ctx.h('section',{class:'jnt-paper'}),moving=ctx.h('section',{class:'jnt-paper'});grid.append(...(data?[moving,fixed]:[fixed,moving]));
 const states=ctx.h('section',{class:'jnt-paper jnt-section'}),all=ctx.h('section',{class:'jnt-paper jnt-section'}),context=ctx.h('p',{class:'jnt-note jnt-context'}),costs=ctx.h('div',{class:'estim-grid jnt-section'}),costSlots={criterion:ctx.h('section',{class:'estim-cost sev-paper'}),composite:ctx.h('section',{class:'estim-cost sev-paper'})};costs.append(costSlots.criterion,costSlots.composite);
 const law=ctx.h('section',{class:'sev-paper jnt-section'}),reports=ctx.h('section',{class:'sev-paper jnt-section'}),scope=ctx.h('section',{class:'jnt-paper jnt-section'});
 if(!data){parent.append(grid,states,all,context,costs,law,reports,scope);return {fixed,moving,states,all,context,costSlots,law,reports,scope};}
 grid.classList.add('jnt-overview');
 const fixedData=ctx.h('section',{class:'jnt-paper jnt-section'}),movingData=ctx.h('section',{class:'jnt-paper jnt-section'});
 parent.append(grid,states,scope);
 data.append(fixedData,movingData,all);
 optimization.append(context,costs,law,reports);
 return {fixed,moving,fixedData,movingData,states,all,context,costSlots,law,reports,scope};
}
/** Actual diagnostic renderer; the parent invokes it alongside the actual predecessor cost/law/report views. */
export function createOpenJointView(ctx,slots){return {render(model){
 const {comparison:c,selected:r,law,state}=model,coupling=state.law==='coupling',ids=law.ids;
 const fixedData=slots.fixedData??slots.fixed,movingData=slots.movingData??slots.moving;
 slots.fixed.replaceChildren(ctx.panelTitle(coupling?'Fixed when only the coupling changes':'Additive facts from the pair probabilities'),ctx.h('p',{class:'jnt-note'},coupling?'The editor changes complete-state masses while preserving both entire within-criterion two-unit laws. Hold the error weights and τ fixed: every report’s additive risk stays fixed.':'This finite law supplies the within-criterion pair errors. Those arrays determine the additive risk of every complete report, but do not record the full joint distribution.'),ctx.h('p',{},'Error weights: ',n(ctx,model.w[0],'setting','weight-0'),', ',n(ctx,model.w[1],'setting','weight-1'),'. Composite coefficients are separately fixed at ',n(ctx,model.a[0],'setting','coefficient-0'),', ',n(ctx,model.a[1],'setting','coefficient-1'),'.'));
 const fixedFigure=ctx.h('div');slots.fixed.append(fixedFigure);slots.fixed.insertBefore(fixedFigure,slots.fixed.children[1]);
 const fixedRows=coupling?model.reports.map(x=>({label:reportWords(x.grade,ids),risk:x.criterion.risk,grade:x.grade})):[...r.criterion.Rk.map((risk,k)=>({label:k===0?'First criterion risk':'Second criterion risk',risk})),{label:'Weighted criterion risk',risk:r.criterion.risk}];
 plot(fixedFigure,{height:215,marginLeft:155,marginRight:16,marginBottom:40,x:{domain:[0,1],label:'Expected loss per unordered pair (risk)',grid:true,ticks:3},y:{domain:fixedRows.map(x=>x.label),label:null},alt:coupling?'All three fixed two-unit reports retain their additive risk while only the cross-criterion coupling changes. This is a fixed-report comparison, not just the currently optimal action.':'The selected fixed report’s criterion-specific and weighted risks, derived from the within-criterion pair errors.',table:fixedRows,keyboard:{data:fixedRows,x:'risk',y:'label',title:x=>`${x.label}: risk ${formatRisk(x.risk)}.`},marks:(p,P)=>[P.barX(fixedRows,{x:'risk',y:'label',fill:p.plotFg}),P.tip(fixedRows,P.pointer({x:'risk',y:'label',title:x=>`${x.label}: ${formatRisk(x.risk)}`}))]});
 slots.fixed.append(ctx.h('p',{class:'jnt-note'},'Report vectors follow ',name(ctx,ids.join(', ')),' in that order. Grade one states higher oriented priority; a shared grade withholds.'));
 if(slots.fixedData)fixedData.replaceChildren(ctx.panelTitle('Fixed report and criterion probabilities'),hint(ctx));
 else slots.fixed.append(hint(ctx));
 const pairs=c.criterionE.e.flatMap((matrix,k)=>ids.flatMap((first,i)=>ids.flatMap((second,j)=>i===j?[]:[{k,first,second,i,j,error:matrix[i][j]}])));
 wide(ctx,fixedData,'Every within-criterion directional error',table(ctx,['Criterion','Proposed direction','Error probability'],pairs.map(x=>[x.k===0?'First criterion':'Second criterion',name(ctx,`${x.first} above ${x.second}`),n(ctx,x.error,'prob',`criterion-${x.k}-${x.i}-${x.j}`)]),'jnt-pairs'));
 if(coupling)wide(ctx,fixedData,'Every fixed two-unit additive risk',table(ctx,['Fixed report','N: stated pairs','Weighted expected wrong count','Weighted wrong share among stated pairs','Additive risk'],model.reports.map((x,i)=>[n(ctx,x.grade,'grade',`fixed-${i}-grade`),n(ctx,x.criterion.N,'count',`fixed-${i}-N`),n(ctx,x.criterion.Ew,'expected',`fixed-${i}-Ew`),n(ctx,x.weightedEvaluation.EoverN[0],'share',`fixed-${i}-share`),n(ctx,x.criterion.risk,'risk',`fixed-${i}-risk`)])));
 slots.moving.replaceChildren(ctx.panelTitle('What the joint law adds'),ctx.h('p',{class:'jnt-selected'},'Selected fixed report ',n(ctx,r.grade,'grade','selected-grade'),'; N = ',n(ctx,r.criterion.N,'count','selected-N'),r.criterion.N===1?' stated pair; M = ':' stated pairs; M = ',n(ctx,r.criterion.M,'count','selected-M'),r.criterion.M===1?' possible pair. ':' possible pairs. ','This choice need not minimize either loss.'),ctx.h('p',{},'Mean weighted fraction correct: ',n(ctx,r.meanCorrectFraction,'share','mean-correct'),'. Probability all stated directions are right on every criterion: ',n(ctx,r.wrong.pAllCriteriaRight,'prob','all-right'),'.'));
 const distribution=ctx.h('div');
 if(slots.movingData){slots.moving.insertBefore(distribution,slots.moving.children[1]);ctx.primaryGraphic(distribution);}
 else slots.moving.append(distribution);
 const dist=r.wrong.values.map((value,i)=>({value,prob:r.wrong.probs[i]}));
 plot(distribution,{height:slots.movingData?190:235,marginLeft:45,marginRight:20,marginBottom:48,x:{domain:[0,Math.max(1,r.criterion.N)],label:'Weighted wrong count in a complete state',ticks:3},y:{domain:[0,1],label:'State probability',grid:true,ticks:3},alt:'The full engine distribution of the weighted wrong count for the separately selected fixed report. Every returned value is retained, including a value with zero probability.',table:dist,keyboard:{data:dist,x:'value',y:'prob',title:x=>`Weighted wrong count ${formatExpectedCount(x.value)} has probability ${formatProb(x.prob)}.`},marks:(p,P)=>[P.ruleX(dist,{x:'value',y1:0,y2:'prob',stroke:p.plotFg,strokeWidth:12}),P.dot(dist,{x:'value',y:'prob',fill:p.plotFg,r:4}),...(slots.movingData?[
  numText(dist.filter(x=>x.prob<=.88),{x:'value',y:'prob',value:'prob',format:formatProb,dy:-8,fill:p.plotFg,stroke:p.plotBg,strokeWidth:4,paintOrder:'stroke',fontWeight:700}),
  numText(dist.filter(x=>x.prob>.88),{x:'value',y:'prob',value:'prob',format:formatProb,dy:14,fill:p.plotFg,stroke:p.plotBg,strokeWidth:4,paintOrder:'stroke',fontWeight:700}),
 ]:[]),P.tip(dist,P.pointer({x:'value',y:'prob',title:x=>`${formatExpectedCount(x.value)} wrong, probability ${formatProb(x.prob)}`}))]});
 if(slots.movingData)movingData.replaceChildren(ctx.panelTitle('Joint distribution and composite errors'),hint(ctx));
 else slots.moving.append(hint(ctx));
 wide(ctx,movingData,'Complete wrong-count distribution',table(ctx,['Weighted wrong count','Probability'],dist.map((x,i)=>[n(ctx,x.value,'expected',`distribution-value-${i}`),n(ctx,x.prob,'prob',`distribution-prob-${i}`)]),'jnt-compact'));
 slots.moving.append(ctx.h('p',{},'Probability of zero weighted wrong count: ',n(ctx,r.wrong.pNone,'prob','none'),'. All criteria right: ',n(ctx,r.wrong.pAllCriteriaRight,'prob'),'. The first event ignores wrong directions on a zero-weight criterion; the second includes every criterion.'),ctx.h('p',{},'Expected weighted wrong count: ',n(ctx,r.wrong.expected,'expected','joint-expected'),'. Unweighted union-bound lower bound on the all-criteria event: ',n(ctx,r.wrong.unionBound,'prob','union-bound'),'. This lower bound need not be close to the actual probability.'));
 if(slots.movingData){
  const {i,j}=c.pair;
  const bars=[[i,j],[j,i]].map(([first,second])=>({first,second,value:c.compositeE.e[0][first][second]}));
  const panel=ctx.h('div',{class:'estim-comparison jnt-composite-bars'},ctx.h('section',{},ctx.panelTitle('Wrong direction on the composite'),
   ...bars.map(({first,second,value})=>ctx.h('div',{class:'estim-cost-row'},
    name(ctx,`${ids[first]} above ${ids[second]}`),ctx.h('span',{class:'estim-cost-track','aria-hidden':'true'},
      ctx.h('span',{class:'estim-cost-fill',style:`width:${100*value}%`})),
    n(ctx,value,'prob',`overview-composite-error-${first}-${second}`)))));
  panel.style.display='block';
  distribution.after(panel);
 }
 const compositeRows=ids.flatMap((first,i)=>ids.flatMap((second,j)=>i===j?[]:[[name(ctx,`${first} above ${second}`),n(ctx,c.compositeE.e[0][i][j],'prob',`pair-composite-${i}-${j}`)]]));
 wide(ctx,movingData,'Composite directional error probabilities',table(ctx,['Constructed composite direction','Error probability'],compositeRows,'jnt-pairs'));
 if(r.criterion.N===0)slots.moving.append(ctx.h('p',{class:'jnt-note'},'No directions are stated, so a correct or wrong fraction is not defined. Both joint no-error events hold vacuously with probability one; silence supplies no accuracy claim.'));
 slots.states.replaceChildren(ctx.panelTitle('The selected fixed report, state by state'),ctx.h('p',{},'Each cell counts wrong stated directions on one criterion in one complete state. A strict statement is wrong when the oriented row value is less than or equal to the other’s. State probabilities refer to the entire array, not separately sampled unit rows or criteria.'));
 const cells=r.states.flatMap(x=>x.D.map((D,k)=>({state:x.s+1,criterion:k===0?'First criterion':'Second criterion',D}))),grid=ctx.h('div');slots.states.append(grid);
 plot(grid,{height:Math.max(220,r.states.length*44+70),marginLeft:55,marginRight:20,marginBottom:40,x:{domain:['First criterion','Second criterion'],label:null},y:{domain:r.states.map(x=>x.s+1),label:'Complete state',tickFormat:v=>formatCount(v)},alt:'State by criterion grid of the number of wrong stated directions for the selected fixed report. The full finite-state table below includes each whole-state mass and weighted count.',table:cells,keyboard:{data:cells,x:'criterion',y:'state',columns:2,sort:false,title:x=>`State ${x.state}, ${x.criterion}: ${x.D} wrong stated directions.`},marks:(p,P)=>[P.cell(cells,{x:'criterion',y:'state',fill:x=>p.purples[x.D],inset:2}),numText(cells,{x:'criterion',y:'state',value:'D',format:v=>formatCount(v),fill:x=>labelOn(p.purples[x.D],p),fontWeight:700}),P.tip(cells,P.pointer({x:'criterion',y:'state',title:x=>`State ${x.state}: ${x.D} wrong on ${x.criterion}`}))]});
 slots.states.append(hint(ctx));wide(ctx,slots.states,'Every complete-state realized wrong count',table(ctx,['State','Probability','N','First criterion D','Second criterion D','Weighted wrong count','Weighted wrong fraction'],r.states.map(x=>[n(ctx,x.s+1,'count'),n(ctx,x.prob,'prob',`state-${x.s}-prob`),n(ctx,x.N,'count',`state-${x.s}-N`),n(ctx,x.D[0],'count',`state-${x.s}-D-0`),n(ctx,x.D[1],'count',`state-${x.s}-D-1`),n(ctx,x.A,'expected',`state-${x.s}-A`),n(ctx,x.AoverN,'share',`state-${x.s}-fraction`)])));
 slots.all.replaceChildren(ctx.panelTitle('Every fixed report, not only an optimum'),ctx.h('p',{},'E is the expected wrong count, N counts stated pairs, and M counts all unordered pairs. An expected wrong share E/N describes an average over statements. It is not the probability that every statement is right. Changing the selected report leaves the full supplied law and both objective definitions in place.'),ctx.h('p',{class:'jnt-note'},'A report with no statements has no defined correct fraction. Its joint no-error events hold vacuously with probability one, which supplies no accuracy claim.'),hint(ctx));
 const rows=model.reports;
 wide(ctx,slots.all,'Fixed-report additive, composite and joint diagnostics',table(ctx,['Fixed report','N','Additive risk','Composite risk','Mean weighted fraction correct','Pr(zero weighted wrong count)','Pr(all criteria right)','Expected weighted wrong count','Unweighted union lower bound'],rows.map(x=>{const i=model.reports.indexOf(x);return [n(ctx,x.grade,'grade',`joint-${i}-grade`),n(ctx,x.criterion.N,'count',`joint-${i}-N`),n(ctx,x.criterion.risk,'risk',`joint-${i}-criterion-risk`),n(ctx,x.composite.risk,'risk',`joint-${i}-composite-risk`),n(ctx,x.meanCorrectFraction,'share',`joint-${i}-mean-correct`),n(ctx,x.wrong.pNone,'prob',`joint-${i}-none`),n(ctx,x.wrong.pAllCriteriaRight,'prob',`joint-${i}-all-right`),n(ctx,x.wrong.expected,'expected',`joint-${i}-expected`),n(ctx,x.wrong.unionBound,'prob',`joint-${i}-union`)];})));
 slots.context.textContent='Below, we compare the costs for an isolated pair and find the best complete reports under each loss. Those searches use the same law and report family. The joint probabilities above refer to the fixed report you selected.';
 slots.scope.replaceChildren(ctx.panelTitle('What is and is not locked'),ctx.h('p',{},coupling?'Only the coupling slider changes dependence here. The displayed within-criterion laws, pair errors and every fixed report’s additive risk are unchanged when weights and τ stay fixed. Composite error and joint events require the whole state law. The state masses are linked by construction; they are not independent marginal edits.':'This view uses the complete stipulated chapter-law states. The selected report’s mean weighted accuracy and joint all-criteria correctness answer different questions, even when both summarize the same statements.'),ctx.h('p',{},'Pair probabilities determine the additive expected loss. To calculate the composite posterior, the distribution of the number of errors, or the chance of getting every direction right, we also need to know how the criteria vary together. The examples specify that joint distribution directly.'));
 }};}
function controls(ctx){
 const root=ctx.h('div',{class:'jnt-primary-controls'}),law=ctx.select({label:'Supplied whole-state law',name:'law',options:[{value:'coupling',label:'Two units · agreeing or opposing states'},{value:'ch19',label:'Chapter law · four units'}],onChange:v=>ctx.set({law:v,report:v==='coupling'?'1/2':'1/2/2/3',w:v==='coupling'?.5:.6})}),lambda=ctx.slider({label:'Chance the criteria point the same way, λ',...ctx.key('lambda'),onInput:v=>ctx.set({lambda:v})}),w=ctx.slider({label:'Error weight on the first criterion',...ctx.key('w'),onInput:v=>ctx.set({w:v})}),tau=ctx.slider({label:'Cost of withholding a pair, τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})});
 const select=ctx.h('select',{id:'jnt-fixed-report',name:'report','data-prx-focus-key':'select:report'}),reportRoot=ctx.h('div',{class:'prx-control jnt-report-select'},ctx.h('label',{for:'jnt-fixed-report'},'Fixed report for the joint diagnostics'),select);ctx.listen(select,'change',()=>ctx.set({report:select.value}));root.append(law.root,reportRoot,lambda.root);
 ctx.controls.append(root);
 ctx.primaryControl(lambda.root);
 const settings=ctx.disclosure({name:'settings',title:'Settings',placement:'controls'});
 settings.body.append(ctx.h('div',{class:'jnt-controls'},w.root,tau.root));
 let optionLaw=null;
 return {render(state,model){law.set(state.law);lambda.set(state.lambda);lambda.setDisabled(state.law!=='coupling');lambda.root.style.visibility=state.law!=='coupling'?'hidden':'';w.set(state.w);tau.set(state.tau);if(optionLaw!==state.law){select.replaceChildren(...model.reports.map(r=>ctx.h('option',{value:keyOf(r.grade)},formatGrades(r.grade))));optionLaw=state.law;}select.value=keyOf(model.selected.grade);}};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'pairs-leave-open',className:'jnt',css:OPEN_PAIRS_CSS+ESTIMAND_CSS+PAIR_COST_CSS+CRITERIA_PROFILE_CSS+JOINT_OVERVIEW_CSS,layout:'result-first',keys:OPEN_PAIRS_KEYS,build(ctx){
 ctx.root.classList.add('estim','cp','sev');
 const control=controls(ctx),data=ctx.disclosure({name:'data',title:'Data and exact values'}),
  optimization=ctx.disclosure({name:'optimization',title:'Optimization context'});
 const slots=createOpenPairsSlots(ctx,ctx.charts,{data:data.body,optimization:optimization.body});
 const view=createOpenJointView(ctx,slots),costView=createEstimandCostView(ctx,slots.costSlots),lawView=createEstimandLawView(ctx,slots.law),reportView=createEstimandReportView(ctx,slots.reports);
 const scopeHint=ctx.h('p',{class:'jnt-note'},'Moves probability between agreeing and opposing whole states while each criterion’s two-unit law stays fixed. This changes dependence, not error weights.');
 slots.scope.before(scopeHint);
 return {render(state){const model=solveOpenPairs(state);if(state.report!==keyOf(model.selected.grade))ctx.set({report:keyOf(model.selected.grade)});control.render(state,model);scopeHint.hidden=state.law!=='coupling';view.render(model);costView.render(model.comparison);lawView.render(model.comparison);reportView.render(model.comparison);ctx.readout.set(['Fixed report ',n(ctx,model.selected.grade,'grade'),...(model.selected.criterion.N===0?[
  ' states no pair. Additive risk ',n(ctx,model.selected.criterion.risk),'; the all-correct probability ',n(ctx,model.selected.wrong.pAllCriteriaRight,'prob'),' holds vacuously and supplies no accuracy claim.',
 ]:[
  ': additive risk ',n(ctx,model.selected.criterion.risk),' and probability all stated directions are right on every criterion ',n(ctx,model.selected.wrong.pAllCriteriaRight,'prob'),'.',
 ]),' The optimizer context below may choose another report.']);ctx.caption.replaceChildren('Restated synthetic whole-state laws after the postrank theory book, chapters ',n(ctx,11,'count'),' and ',n(ctx,19,'count'),', and vignettes m2/m3. Grade one states higher oriented target values; shared grades withhold, and strict statements count latent equality as wrong.');}};
}});}
