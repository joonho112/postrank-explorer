// Two targets under one supplied law, withholding price and report family.
import {createWidget} from '../shared/base.js';
import {palette,plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatEoverN,formatExpectedCount,formatGrades,formatProb,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {tagNode} from '../shared/labels.js';
import {enumerateReports,evaluateReport,exactOptimum,normalComposite,pairDecision,weightedError} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {CHAPTER19,KNOWN_COMPOSITE,finiteComposite,finiteCriteria} from '../shared/criteria-laws.js';
import {PAIR_COST_CSS,createPairCostView} from './conflict-pairs.js';
import {CRITERIA_PROFILE_CSS,isCriterionPairKey,resolveCriterionPair} from './several-criteria.js';

const COMPOSITE_TIE={...KNOWN_COMPOSITE,key:'tie',states:[[[1,-1],[0,0]]]};
const LAWS={known:KNOWN_COMPOSITE,tie:COMPOSITE_TIE,ch19:CHAPTER19};
const TITLES={known:'Known two-unit state',tie:'Known state, composite equality',ch19:'Four-unit two-state law',six:'Six independent Normal sites'};
const name=(ctx,s)=>ctx.h('span',{'data-prx-name':'',text:s});
const n=(ctx,x,kind='risk',hook)=>{
 const f={risk:formatRisk,count:formatCount,share:formatShare,fraction:formatEoverN,expected:formatExpectedCount,grades:formatGrades,prob:formatProb,setting:formatSetting,sci:formatSci,value:v=>formatDecimal(v,{digits:3})}[kind];
 const node=ctx.num(x,f(x));if(hook)node.dataset.prxReadout=hook;return node;
};
const gradeKey=g=>Array.from(g).join('-');
const gradeCompare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
export const ESTIMAND_CSS=`
.estim .sev-paper .prx-result-tag,.estim .sev-paper [data-prx-label]{color:var(--prx-plot-fg)}
.estim .estim-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:.8rem;min-width:0}
.estim .estim-controls{display:flex;flex-wrap:wrap;gap:.6rem;min-width:0;max-width:100%;width:100%}
.estim .estim-controls>.prx-control{min-width:0;max-width:100%}.estim select{max-width:100%;min-width:0}
.estim .estim-advanced{margin:1rem 0}.estim .estim-advanced-group{display:contents}.estim .estim-advanced-group[hidden]{display:none}
.estim .estim-section{margin:.85rem 0;min-width:0}.estim .estim-cost{min-width:0}.estim .estim-cost>.prx-panel-title{margin:.25rem 0 .6rem}
.estim .estim-chip-list{display:flex;flex-wrap:wrap;gap:.35rem;margin:.4rem 0}.estim .estim-chip{padding:.2rem .35rem;border:1px solid var(--prx-plot-grid);border-bottom-width:3px;border-radius:.2rem;white-space:nowrap}
.estim .estim-report{padding:.65rem;margin:.5rem 0;border:1px solid var(--prx-plot-grid);border-radius:.3rem}
.estim .estim-table{min-width:43rem}.estim .estim-profile-table{min-width:40rem}.estim .estim-law-table{min-width:32rem}
.estim .estim-caption{font-size:.87rem;line-height:1.45}.estim .estim-tag{margin:.25rem 0}.estim .estim-weights p{margin:.4rem 0}
`;
export const ESTIMAND_KEYS={
 data:{type:'choice',values:Object.keys(TITLES),value:'known'},
 w:{type:'number',min:0,max:1,step:.01,value:.75},
 a:{type:'number',min:0,max:1,step:.01,value:.5},
 tau:{type:'number',min:.01,max:.5,step:.01,value:.3},
 multiplier:{type:'number',min:.1,max:4,step:.05,value:1},
 cap:{type:'choice',values:['all','2','3'],value:'all'},
 transform:{type:'choice',values:['identity','exp'],value:'identity'},
 pair:{type:'string',value:'auto'},
};
export function estimandFamily(cap='all',units=2){return cap==='all'?{kind:'all'}:{kind:'atMost',G:Math.min(Number(cap),units)};}
function compareInputs(criterionE,compositeE,{w,tau,family,pair},allFinite){
 const criterionOptimum=exactOptimum(criterionE,{w,tau,family}),compositeOptimum=exactOptimum(compositeE,{w:[1],tau,family});
 const evaluate=grade=>({grade:Array.from(grade),criterion:evaluateReport(grade,criterionE,{w,tau}),composite:evaluateReport(grade,compositeE,{w:[1],tau})});
 const unique=new Map();for(const grade of [...criterionOptimum.grades,...compositeOptimum.grades])unique.set(gradeKey(grade),Array.from(grade));
 const reports=[...unique.values()].sort(gradeCompare).map(evaluate),[i,j]=pair,m=weightedError(criterionE,w);
 return {criterionE,compositeE,criterionOptimum,compositeOptimum,reports,
  allReports:allFinite?Array.from(enumerateReports(criterionE.ids.length,family),g=>Array.from(g)).sort(gradeCompare).map(evaluate):null,
  pairCosts:{criterion:pairDecision(m[i][j],m[j][i],tau),composite:pairDecision(compositeE.e[0][i][j],compositeE.e[0][j][i],tau)}};
}
/** Finite whole-law composition used by this app and the fixed-margin coupling editor. */
export function estimandComparison(law,{w=law.w,a=law.a,tau=law.tau,multiplier=[1,1],family={kind:'all'},pair=[0,1]}={}){
 const {criterionE,compositeE,compositeStates}=finiteComposite(law,{w,a,tau,multiplier});
 return {...compareInputs(criterionE,compositeE,{w,tau,family,pair},true),law,ids:law.ids,criteria:law.criteria,compositeStates,w,a,tau,multiplier,family,pair:{i:pair[0],j:pair[1]},kind:law.states.length===1?'known state':'posterior',route:'finite'};
}
/** Analytic route requires the six-site fixture's explicit unit AND criterion independence. */
export function normalEstimandComparison(data,{w=[.5,.5],a=[.5,.5],tau=.2,multiplier=[1,1],family={kind:'atMost',G:3},pair=[1,2]}={}){
 if(!data.independentCriteria)throw new Error('The analytic composite requires explicitly independent Normal criteria');
 const composite=normalComposite(data.means,data.sds,{a,multiplier,ids:data.ids});
 return {...compareInputs(data.E,composite.E,{w,tau,family,pair},false),data,ids:data.ids,criteria:data.criteria,composite,w,a,tau,multiplier,family,pair:{i:pair[0],j:pair[1]},kind:'posterior',route:'normal'};
}
const models=new Map();
export function solveEstimands(state){
 const key=JSON.stringify(state);if(models.has(key))return models.get(key);
 const dataKey=state.data??'known',base=dataKey==='six'?criteriaData('six'):LAWS[dataKey],d=dataKey==='six'?base:{key:dataKey,ids:base.ids},pair=state.pair==='auto'||!state.pair?dataKey==='ch19'?[1,2]:dataKey==='six'?[1,2]:[0,1]:resolveCriterionPair(d,state.pair),family=estimandFamily(state.cap,base.ids.length),w=[state.w,1-state.w],a=[state.a,1-state.a],multiplier=[1,state.multiplier],options={w,a,tau:state.tau,multiplier,family,pair};
 let model;
 if(dataKey==='six')model=normalEstimandComparison(base,options);
 else{
  // Declared pushforward of ALL finite input coordinates, before any probability or risk is calculated.
  const law=state.transform==='exp'?{...base,states:base.states.map(s=>s.map(row=>row.map(v=>Math.exp(v))))}:base;
  model=estimandComparison(law,options);
 }
 const baselineE=dataKey==='six'?base.E:finiteCriteria(base);
 model={...model,baselineCriterionOptimum:exactOptimum(baselineE,{w,tau:state.tau,family}),dataKey,transform:dataKey==='six'?'identity':state.transform};
 if(models.size>20)models.delete(models.keys().next().value);models.set(key,model);return model;
}
function table(ctx,headers,rows,cls='estim-table'){
 return ctx.h('table',{class:cls},ctx.h('thead',{},ctx.h('tr',{},...headers.map(text=>ctx.h('th',{scope:'col'},text)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(value=>ctx.h('td',{},value))))));
}
function scroll(ctx,parent,label,content){const region=ctx.h('div',{class:'sev-scroll'},content);ctx.scrollRegion(region,label);parent.append(region);}
const hint=ctx=>ctx.h('p',{class:'sev-hint'},'Wide tables scroll within this panel; focus the table region and use the arrow keys.');
export function drawEstimandReport(ctx,grade,ids){
 const colors=palette(ctx.root),root=ctx.h('div',{class:'estim-chip-list'});
 grade.forEach((g,i)=>root.append(ctx.h('span',{class:'estim-chip',style:`border-bottom-color:${colors.grades[g-1]}`},name(ctx,ids[i]),' · grade ',n(ctx,g,'count'))));return root;
}
function tieWords(ctx,result,prefix){
 return ctx.h('p',{class:'estim-caption'},n(ctx,result.tieCount,'count',`${prefix}-tie-count`),result.tieCount===1?' report has':' reports have',' the smallest risk within equal-risk tolerance ',n(ctx,result.tieTol,'sci',`${prefix}-tie-tol`),'. ',result.tieCount>result.grades.length?ctx.h('span',{},'The list retains ',n(ctx,result.grades.length,'count'),' of them.'):null);
}
function optimumBlock(ctx,result,model,title,prefix){
 const root=ctx.h('div',{class:'estim-report','data-objective':prefix},ctx.panelTitle(title),ctx.h('p',{class:'estim-tag'},tagNode(ctx,result)),tieWords(ctx,result,prefix));
 for(const grade of result.grades){
  const e=prefix==='criterion'?evaluateReport(grade,model.criterionE,{w:model.w,tau:model.tau}):evaluateReport(grade,model.compositeE,{w:[1],tau:model.tau});
  root.append(ctx.h('p',{},'Report ',n(ctx,grade,'grades',`${prefix}-grade-${gradeKey(grade)}`),': N ',n(ctx,e.N,'count',`${prefix}-N-${gradeKey(grade)}`),', risk ',n(ctx,e.risk,'risk',`${prefix}-risk-${gradeKey(grade)}`),'.'),drawEstimandReport(ctx,grade,model.ids));
 }
 return root;
}
export function createEstimandCostView(ctx,slots){
 const views={};for(const key of ['criterion','composite']){const inner=ctx.h('div',{'data-estimand-cost':key});slots[key].append(inner);views[key]=createPairCostView(ctx,inner,{title:key==='criterion'?'Three actions: criterion directions':'Three actions: composite direction',descriptionPosition:'after',...(key==='composite'?{description:'A strict composite direction is wrong when its constructed value is less than or equal to the other’s. These are composite-direction errors; withholding costs τ once. The three costs concern this pair on its own, before coherence across the full report.'}:{})});}
 return {render(model){for(const key of ['criterion','composite'])views[key].render({data:{ids:model.ids},pair:model.pair,decision:model.pairCosts[key],kind:model.kind});}};
}
export function createEstimandLawView(ctx,slot){return {render(model){
 slot.replaceChildren(ctx.panelTitle('The complete supplied law'),hint(ctx));
 if(model.route==='normal'){
  slot.append(ctx.h('p',{class:'estim-caption'},'Independent Normal units and independent criteria within every unit. The browser computes the composite mean, SD and pair errors analytically under this stated joint law. No whole-state draws or thirty-site composites are inferred.'));
  scroll(ctx,slot,'All six independent Normal marginals and composite summaries',table(ctx,['Unit','First mean','First SD','Second mean','Second SD','Composite mean','Composite SD'],model.ids.map((id,i)=>[name(ctx,id),n(ctx,model.data.means[i][0],'value'),n(ctx,model.data.sds[i][0],'value'),n(ctx,model.data.means[i][1],'value'),n(ctx,model.data.sds[i][1],'value'),n(ctx,model.composite.mean[i],'value',`normal-mean-${i}`),n(ctx,model.composite.sd[i],'value',`normal-sd-${i}`)]),'estim-law-table'));return;
 }
 slot.append(ctx.h('p',{class:'estim-caption'},'Each probability belongs to the entire state. The current finite transform applies to every input coordinate; the positive second-criterion multiplier then enters every unit’s composite. Neither operation changes a criterion’s strict directions.'));
 const rows=model.law.states.flatMap((state,s)=>state.map((values,i)=>[n(ctx,s+1,'count'),n(ctx,model.law.probs[s],'prob'),name(ctx,model.ids[i]),n(ctx,values[0],'value',`law-${s}-${i}-0`),n(ctx,values[1],'value',`law-${s}-${i}-1`),n(ctx,model.compositeStates[s][i][0],'value',`composite-${s}-${i}`)]));
 scroll(ctx,slot,'Every state, probability, unit and composite',table(ctx,['State','State probability','Unit','First criterion','Second criterion','Composite value'],rows,'estim-law-table'));
}};}
function invarianceView(ctx,slot,model){
 slot.replaceChildren(ctx.panelTitle('Preserve criterion directions, hold the decision fixed'),ctx.h('p',{class:'estim-caption'},'The entire criterion best-report set is listed before and after the displayed positive transformations. The supplied law is pushed forward without refitting, and error weights, τ and family stay fixed. Composite reports can change because their target uses magnitudes.'));
 for(const [key,result,title] of [['before',model.baselineCriterionOptimum,'Before the transform'],['after',model.criterionOptimum,'After the transform']]){
  slot.append(ctx.panelTitle(title),ctx.h('p',{},tagNode(ctx,result)),tieWords(ctx,result,`invariance-${key}`));
  result.grades.forEach((grade,i)=>slot.append(ctx.h('p',{},'Report ',n(ctx,grade,'grades',`invariance-${key}-${i}`),', minimum criterion risk ',n(ctx,result.risk,'risk',`invariance-risk-${key}-${i}`),'.')));
 }
}
export function createEstimandReportView(ctx,slot){return {render(model){
 slot.replaceChildren(ctx.panelTitle('Each selected report judged under both targets'),ctx.h('p',{class:'estim-caption'},'Grade ',n(ctx,1,'count'),' is stated highest on the declared target; a shared grade means not compared. N counts stated pairs and M counts all unordered pairs. E is the expected wrong count for the target in that column. Risk divides the expected wrong count plus τ times the withheld count by M.'),ctx.h('p',{class:'estim-caption'},'Both objectives use this same law, τ and report family. Compare reports within a risk column. The sizes of the two minima do not determine which target is substantively appropriate.'));
 const optima=ctx.h('div',{class:'estim-grid'});optima.append(optimumBlock(ctx,model.criterionOptimum,model,'Best for criterion directions','criterion'),optimumBlock(ctx,model.compositeOptimum,model,'Best for the composite direction','composite'));slot.append(optima,hint(ctx));
 const rows=model.reports.map(r=>[n(ctx,r.grade,'grades'),n(ctx,r.criterion.N,'count',`cross-${gradeKey(r.grade)}-N`),n(ctx,r.criterion.Ew,'expected',`cross-${gradeKey(r.grade)}-criterion-E`),n(ctx,r.criterion.risk,'risk',`cross-${gradeKey(r.grade)}-criterion-risk`),n(ctx,r.composite.Ew,'expected',`cross-${gradeKey(r.grade)}-composite-E`),n(ctx,r.composite.risk,'risk',`cross-${gradeKey(r.grade)}-composite-risk`)]);
 scroll(ctx,slot,'Both risks of every retained best report',table(ctx,['Report','N','Criterion weighted E','Criterion risk','Composite E','Composite risk'],rows));
 const profileRows=model.reports.flatMap(r=>[...model.criteria.map((criterion,k)=>[n(ctx,r.grade,'grades'),k===0?'First criterion':'Second criterion',n(ctx,r.criterion.E[k],'expected',`profile-${gradeKey(r.grade)}-${k}-E`),n(ctx,r.criterion.EoverN[k],'fraction',`profile-${gradeKey(r.grade)}-${k}-fraction`),n(ctx,r.criterion.EoverM[k],'share',`profile-${gradeKey(r.grade)}-${k}-per-pair`),n(ctx,r.criterion.Rk[k],'risk',`profile-${gradeKey(r.grade)}-${k}-risk`)]),[n(ctx,r.grade,'grades'),'Composite target',n(ctx,r.composite.E[0],'expected',`profile-${gradeKey(r.grade)}-composite-E`),n(ctx,r.composite.EoverN[0],'fraction',`profile-${gradeKey(r.grade)}-composite-fraction`),n(ctx,r.composite.EoverM[0],'share',`profile-${gradeKey(r.grade)}-composite-per-pair`),n(ctx,r.composite.Rk[0],'risk',`profile-${gradeKey(r.grade)}-composite-risk`)]]);
 scroll(ctx,slot,'Criterion and composite profiles of the same reports',table(ctx,['Report','Error target','Expected wrong count E','E/N: among stated','E/M: per pair','Risk with silence'],profileRows,'estim-profile-table'));
 const terms=model.reports.flatMap(r=>['criterion','composite'].map(target=>[n(ctx,r.grade,'grades'),target==='criterion'?'Criterion-direction loss':'Composite-direction loss',n(ctx,r[target].M,'count'),n(ctx,r[target].G,'count'),n(ctx,r[target].s,'share'),n(ctx,r[target].errorTerm,'risk',`terms-${gradeKey(r.grade)}-${target}-error`),n(ctx,r[target].withholdingTerm,'risk',`terms-${gradeKey(r.grade)}-${target}-silence`)]));
 scroll(ctx,slot,'Risk terms under both target definitions',table(ctx,['Report','Loss','M','Grades','N/M','Error term E/M','Silence term'],terms));
 if(!model.allReports){slot.append(ctx.h('p',{class:'estim-caption'},'The Normal example evaluates the complete family to find its optima; the tables show every retained optimum under both losses. It does not display a cloud of every report.'));return;}
 slot.append(ctx.panelTitle('Every report in the finite family'),ctx.h('p',{},n(ctx,model.allReports.length,'count','all-report-count'),' complete reports, each evaluated under both targets. Circle outlines mark criterion optima; square outlines mark composite optima.'));
 const fig=ctx.h('div');slot.append(fig);const rowsAll=model.allReports.map(r=>({...r,x:r.criterion.risk,y:r.composite.risk,key:gradeKey(r.grade)})),criterionKeys=new Set(model.criterionOptimum.grades.map(gradeKey)),compositeKeys=new Set(model.compositeOptimum.grades.map(gradeKey));
 plot(fig,{height:300,marginLeft:55,marginRight:15,marginBottom:45,x:{label:'Criterion-direction risk',grid:true},y:{label:'Composite-direction risk',grid:true},alt:'Every complete report has one point at its criterion risk and composite risk. Circle and square outlines mark the full retained sets of optima under the respective objectives.',table:rowsAll.map(r=>({report:formatGrades(r.grade),N:r.criterion.N,criterionRisk:r.x,compositeRisk:r.y})),keyboard:{data:rowsAll,x:'x',y:'y',title:r=>`Report ${formatGrades(r.grade)}, N ${r.criterion.N}, criterion risk ${formatRisk(r.x)}, composite risk ${formatRisk(r.y)}.`},marks:(c,P)=>[P.dot(rowsAll,{x:'x',y:'y',fill:c.plotMuted,r:3}),P.dot(rowsAll.filter(r=>criterionKeys.has(r.key)),{x:'x',y:'y',stroke:c.plotFocus,fill:'none',r:7,strokeWidth:2}),P.dot(rowsAll.filter(r=>compositeKeys.has(r.key)),{x:'x',y:'y',stroke:c.plotFg,fill:'none',symbol:'square',r:7,strokeWidth:2}),P.tip(rowsAll,P.pointer({x:'x',y:'y',title:r=>`Report ${formatGrades(r.grade)}: ${formatRisk(r.x)} / ${formatRisk(r.y)}`}))]});
 scroll(ctx,slot,'All finite-family report risks',table(ctx,['Report','N','Criterion weighted E','Criterion risk','Composite E','Composite risk'],model.allReports.map(r=>[n(ctx,r.grade,'grades',`all-${gradeKey(r.grade)}-grade`),n(ctx,r.criterion.N,'count',`all-${gradeKey(r.grade)}-N`),n(ctx,r.criterion.Ew,'expected',`all-${gradeKey(r.grade)}-criterion-E`),n(ctx,r.criterion.risk,'risk',`all-${gradeKey(r.grade)}-criterion-risk`),n(ctx,r.composite.Ew,'expected',`all-${gradeKey(r.grade)}-composite-E`),n(ctx,r.composite.risk,'risk',`all-${gradeKey(r.grade)}-composite-risk`)])));
}};}
function createControls(ctx){
 const main=ctx.h('div',{class:'estim-controls'}),data=ctx.select({label:'Supplied law',name:'data',options:Object.entries(TITLES).map(([value,label])=>({value,label})),onChange:v=>ctx.set({data:v,pair:'auto',...(v==='six'?{transform:'identity'}:{})})}),w=ctx.slider({label:'Error weight on the first criterion, w',...ctx.key('w'),onInput:v=>ctx.set({w:v})}),a=ctx.slider({label:'Composite coefficient on the first criterion, a',...ctx.key('a'),onInput:v=>ctx.set({a:v})}),tau=ctx.slider({label:'Withholding cost τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})}),multiplier=ctx.slider({label:'Positive multiplier for the second criterion',...ctx.key('multiplier'),onInput:v=>ctx.set({multiplier:v})}),cap=ctx.select({label:'Same report family for both losses',name:'cap',options:[{value:'all',label:'All grade reports'},{value:'2',label:'At most two grades'},{value:'3',label:'At most three grades'}],onChange:v=>ctx.set({cap:v})});
 main.append(data.root,w.root,a.root,tau.root,multiplier.root,cap.root);ctx.controls.append(main);
 const advanced=ctx.h('div',{class:'estim-controls estim-advanced'}),transform=ctx.select({label:'Whole finite-law transformation',name:'transform',options:[{value:'identity',label:'Original values'},{value:'exp',label:'Exponentiate every finite input value'}],onChange:v=>ctx.set({transform:v})}),pairs={};advanced.append(transform.root);
 for(const key of Object.keys(TITLES)){const ids=key==='six'?criteriaData('six').ids:LAWS[key].ids,pair=ctx.select({label:'Inspect this isolated pair',name:`pair-${key}`,options:[{value:'auto',label:'Source example pair'},...ids.flatMap((id,i)=>ids.flatMap((other,j)=>i===j?[]:[{value:`${id},${other}`,label:`${id} above ${other}`}]))],onChange:v=>ctx.set({pair:v})}),group=ctx.h('div',{class:'estim-advanced-group'},pair.root);advanced.append(group);pairs[key]={pair,group};}
 return {advanced,render(state){data.set(state.data);w.set(state.w);a.set(state.a);tau.set(state.tau);multiplier.set(state.multiplier);cap.set(state.cap);transform.set(state.transform);transform.root.hidden=state.data==='six';for(const key of Object.keys(TITLES)){pairs[key].group.hidden=key!==state.data;pairs[key].pair.set(state.pair);}}};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'composite-or-criterion',className:'estim',css:ESTIMAND_CSS+PAIR_COST_CSS+CRITERIA_PROFILE_CSS,keys:ESTIMAND_KEYS,build(ctx){
 ctx.root.classList.add('cp','sev');const control=createControls(ctx),costRoot=ctx.h('div',{class:'estim-grid estim-section'}),costSlots={criterion:ctx.h('div',{class:'estim-cost sev-paper'}),composite:ctx.h('div',{class:'estim-cost sev-paper'})};costRoot.append(costSlots.criterion,costSlots.composite);
 const pairSummary=ctx.h('p',{class:'estim-caption'}),weights=ctx.h('div',{class:'estim-weights sev-paper estim-section'}),invariance=ctx.h('div',{class:'sev-paper estim-section'}),law=ctx.h('div',{class:'sev-paper estim-section'}),reports=ctx.h('div',{class:'sev-paper estim-section'});
 ctx.charts.append(ctx.readout.node,costRoot,control.advanced,pairSummary,weights,invariance,law,reports);
 const costView=createEstimandCostView(ctx,costSlots),lawView=createEstimandLawView(ctx,law),reportView=createEstimandReportView(ctx,reports);
 return {render(state){
  const model=solveEstimands(state),correction={};if(model.ids.length===2&&state.cap==='3')correction.cap='2';if(state.data==='six'&&state.transform!=='identity')correction.transform='identity';if(!isCriterionPairKey({ids:model.ids},state.pair))correction.pair='auto';if(Object.keys(correction).length)ctx.set(correction);
  control.render(state);costView.render(model);pairSummary.replaceChildren('For ',name(ctx,model.ids[model.pair.i]),' above ',name(ctx,model.ids[model.pair.j]),': criterion cost ',n(ctx,model.pairCosts.criterion.costs.iAboveJ,'risk'),', composite cost ',n(ctx,model.pairCosts.composite.costs.iAboveJ,'risk'),'. Current reports: ',n(ctx,model.criterionOptimum.grade,'grades'),' for criterion directions; ',n(ctx,model.compositeOptimum.grade,'grades'),' for the composite.');lawView.render(model);reportView.render(model);invarianceView(ctx,invariance,model);
  weights.replaceChildren(ctx.panelTitle('Three roles for weights'),ctx.h('p',{},'Error weights w = ',n(ctx,model.w[0],'setting','w-first'),', ',n(ctx,model.w[1],'setting','w-second'),' price criterion-specific wrong directions. Composite coefficients a = ',n(ctx,model.a[0],'setting','a-first'),', ',n(ctx,model.a[1],'setting','a-second'),' build a new target from magnitudes.'),ctx.h('p',{},'The second criterion is multiplied by ',n(ctx,model.multiplier[1],'setting','multiplier'),' for every unit in every finite state, or in the declared independent Normal composite. Both a and w stay nonnegative and sum to ',n(ctx,1,'setting'),'.'),ctx.h('p',{},'Expected-rank averaging weights have a third role: they average criterion-specific positions. They do not turn the weighted criterion loss into a composite target. The composite objective here has one constructed target with error weight ',n(ctx,1,'setting'),'.'),ctx.h('p',{},'Even numerically equal w and a need not give the same loss or the same report.'));
  ctx.readout.set(['Criterion directions choose ',n(ctx,model.criterionOptimum.grade,'grades','criterion-grade'), ' with risk ',n(ctx,model.criterionOptimum.risk,'risk','criterion-risk'),'; the composite chooses ',n(ctx,model.compositeOptimum.grade,'grades','composite-grade'),' with risk ',n(ctx,model.compositeOptimum.risk,'risk','composite-risk'),'. These minima concern different targets; each full report is judged under both below.']);
  ctx.caption.replaceChildren('Synthetic supplied laws after the postrank theory book and vignette m2. Grade ',n(ctx,1,'count'),' is stated highest on the declared target. A shared grade withholds; strict directions count equality as wrong. Synthetic data license CC BY ',ctx.num(4,formatDecimal(4,{digits:1})),'.');
 }};
}});}
