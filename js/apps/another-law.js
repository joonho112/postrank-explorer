// One declared report family, two normal laws, and a frozen selected report evaluated under both.
// Layout (review 044 repair, X-01 with G4-F7 and G4-F6): base.js's result-first frame, so the read-out sits directly
// under the controls and the preset row, in the review's replacement copy: the same report's risk under both laws,
// the evaluation law's own best, the regret, and whether the bounds say anything (both bounds of 1 or more say
// nothing about a risk difference, since risks lie in [0, 1]). Then the law plot with its key, then the regret bars
// directly under it (ctx.primaryGraphic), labeled on the marks: each row named in the margin, each risk written at
// its bar's end, an arrow for the same report under the other law with its change, and a bracket for the regret
// between the two evaluation-law risks. The full report cards, exact risks and bound derivation sit in native
// disclosures. Every number comes from compareLaws (engine calls).
import { createWidget } from '../shared/base.js';
import { numText, plot } from '../shared/chart.js';
import { blocksText, formatCount, formatDecimal, formatExpectedCount, formatGrades, formatProb, formatRisk, formatSetting, formatShare, formatSigned, formatSci } from '../shared/format.js';
import { tagNode } from '../shared/labels.js';
import { errorArray, evaluateReport, exactOptimum, maxCoefficientError, normalInterval, pairCount, regretBound, relationChange, weightedRadius } from '../pr-core.js';
import SIX from '../../data/released/six-sites.json' with {type:'json'};

export const CONFIG=Object.freeze({name:'another-law',className:'prx-al',tau:{min:.01,max:.5,step:.01,value:.2},shift:{min:-1,max:1,step:.01,value:0},scale:{min:.5,max:2,step:.05,value:1}});
const IDS=SIX.tables.units.id,MEAN=SIX.tables.units.mean_A,SD=SIX.tables.units.sd_A,M=pairCount(IDS.length);
const selectionLaw=errorArray(MEAN,SD,{ids:IDS,criteria:['reading']});
const family=cap=>cap==='none'?{kind:'all'}:{kind:'atMost',G:3};
const cache=new Map();
export function compareLaws({tau=.2,shift=0,scale=1,unit='C',cap=3}={}){
 const key=JSON.stringify([tau,shift,scale,unit,cap]);if(cache.has(key))return cache.get(key);
 const means=MEAN.map((v,i)=>v+(IDS[i]===unit?shift:0)),sds=SD.map(v=>v*scale);
 const evaluationLaw=errorArray(means,sds,{ids:IDS,criteria:['reading']});
 // Zero tolerance makes eta=0 for the minimum over the supplied floating-point risks.
 const selected=exactOptimum(selectionLaw,{tau,family:family(cap),tieTol:0});
 const evaluationBest=exactOptimum(evaluationLaw,{tau,family:family(cap),tieTol:0});
 const chosenSelection=evaluateReport(selected.grade,selectionLaw,{tau});
 const chosenEvaluation=evaluateReport(selected.grade,evaluationLaw,{tau});
 const bestSelection=evaluateReport(evaluationBest.grade,selectionLaw,{tau});
 const bestEvaluation=evaluateReport(evaluationBest.grade,evaluationLaw,{tau});
 const coefficient=maxCoefficientError(selectionLaw,evaluationLaw),radius=weightedRadius(coefficient.epsilon,[1]);
 const bound=regretBound({N:selected.N,Nstar:evaluationBest.N,M,deltaW:radius,eta:0});
 const changes=relationChange(selected.grade,evaluationBest.grade,evaluationLaw);
 const r={means,sds,selectionLaw,evaluationLaw,selected,evaluationBest,chosenSelection,chosenEvaluation,bestSelection,bestEvaluation,coefficient,radius,bound,changes,regret:Math.max(0,chosenEvaluation.risk-bestEvaluation.risk),riskDifference:Math.abs(chosenEvaluation.risk-chosenSelection.risk)};
 cache.set(key,r);if(cache.size>40)cache.delete(cache.keys().next().value);return r;
}
const CSS=`
@media (min-width: 64rem) {
  .prx-al > .prx-controls { row-gap: 0.35rem; }
}
.prx-al .prx-al-note {font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0}
.prx-al .prx-al-legend {display:flex;flex-wrap:wrap;gap:.35rem 1rem;padding:.4rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);font-size:.85em}
.prx-al .prx-al-legend span {display:inline-flex;align-items:center;gap:.3rem}
.prx-al .prx-al-key {width:1.6rem;border-top:2px solid var(--prx-plot-fg)}
.prx-al .prx-al-key-eval {border-top:2px dashed var(--prx-plot-muted)}
.prx-al .prx-al-scroll {max-width:100%;overflow-x:auto;margin:.7rem 0}
.prx-al .prx-al-table {width:100%;min-width:40rem;border-collapse:collapse;font-size:.9em;font-variant-numeric:tabular-nums}
.prx-al .prx-al-table th,.prx-al .prx-al-table td {text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--prx-border)}
.prx-al .prx-al-table th:first-child {min-width:9rem;white-space:nowrap}
.prx-al .prx-al-table caption {text-align:left;color:var(--prx-fg-muted);padding:.3rem 0}
.prx-al .prx-al-cards {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:.7rem;margin:.7rem 0}
.prx-al .prx-al-card {padding:.65rem;border:1px solid var(--prx-border);border-radius:6px;background:var(--prx-bg)}
.prx-al .prx-al-card p {margin:.25rem 0}
.prx-al .prx-al-bound-row {padding:.45rem 0;border-top:1px solid var(--prx-border)}
.prx-al .prx-al-bound-row p {margin:.25rem 0}
.prx-al .prx-al-bound {margin:.75rem 0;padding:.65rem;border-left:3px solid var(--prx-accent);background:var(--prx-bg)}
.prx-al .prx-al-rowname {display:inline-block;margin:0 0 .15rem;font-size:.82em;font-weight:600;color:var(--prx-fg-muted)}
.prx-al .prx-al-cards {margin:.5rem 0 .7rem}
`;
export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:CONFIG.name,className:CONFIG.className,label:'Judging a report under another law: the same report under selection and evaluation laws, regret within one family, and discrepancy bounds.',css:CSS,
 // review 044 repair (X-01): the read-out directly under the controls and the preset row
 layout:'result-first',
 keys:{tau:{type:'number',...CONFIG.tau},shift:{type:'number',...CONFIG.shift},scale:{type:'number',...CONFIG.scale},unit:{type:'choice',values:IDS,value:'C'},cap:{type:'choice',values:[3,'none'],value:3}},
 build(ctx){
  const {h}=ctx,ro=(name,value,format=formatCount)=>{const e=ctx.num(value,format(value));e.dataset.prxReadout=name;return e;};
  const tau=ctx.slider({label:'Withholding cost τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})});
  const shift=ctx.slider({label:'Selected unit’s evaluation mean shift',...ctx.key('shift'),format:v=>formatSigned(v,{digits:2}),onInput:v=>ctx.set({shift:v})});
  const scale=ctx.slider({label:'Multiplier for every evaluation SD',...ctx.key('scale'),onInput:v=>ctx.set({scale:v})});
  const unit=ctx.select({label:'Unit whose evaluation mean changes',options:IDS.map(id=>({value:id,label:`Site ${id}`})),value:ctx.state.unit,onChange:v=>ctx.set({unit:v})});
  const cap=ctx.segmented({label:'Same family for both laws',options:[{value:3,label:'At most three grades'},{value:'none',label:'All reports'}],value:ctx.state.cap,onChange:v=>ctx.set({cap:v})});
  ctx.controls.append(shift.root,scale.root,unit.root,tau.root,cap.root);
  // the shift slider moves the law plot and the regret bars (base.js primaryControl)
  ctx.primaryControl(shift.root);
  const laws=h('div'),legend=h('div',{class:'prx-al-legend','data-prx-part':'legend'},h('span',{},h('i',{class:'prx-al-key'}),'selection law: filled mean, solid interval'),h('span',{},h('i',{class:'prx-al-key prx-al-key-eval'}),'evaluation law: open mean, dashed interval'));
  const lawNote=h('p',{class:'prx-al-note'});
  const cards=h('div',{class:'prx-al-cards'}),risks=h('div');
  const tableSlot=ctx.scrollRegion(h('div',{class:'prx-al-scroll'}),'Both reports evaluated under both laws');
  const boundBox=h('section',{class:'prx-al-bound'}),gapPair=h('p',{class:'prx-al-note'}),relations=h('p',{class:'prx-al-note'});
  const reportDetails=ctx.disclosure({name:'reports',title:'Reports and exact risks'});
  const boundDetails=ctx.disclosure({name:'bounds',title:'How the bounds are calculated'});
  reportDetails.body.append(cards,h('p',{class:'prx-al-note'},'Read across a row to change only the law. Compare the evaluation-risk column to find regret.'),tableSlot);
  boundDetails.body.append(boundBox,gapPair);
  ctx.primaryGraphic(risks);
  ctx.charts.append(laws,legend,lawNote,ctx.panelTitle('Hold the report fixed when changing the law'),risks,relations);
  return {render(state){
   tau.set(state.tau);shift.set(state.shift);scale.set(state.scale);unit.set(state.unit);cap.set(state.cap);
   const r=compareLaws(state),rows=IDS.flatMap((id,i)=>[
    {id,law:'selection',mean:MEAN[i],...normalInterval(MEAN[i],SD[i],.95)},
    {id,law:'evaluation',mean:r.means[i],...normalInterval(r.means[i],r.sds[i],.95)},
   ]);
   const width=Math.max(250,ctx.width());
   plot(laws,{width,height:240,marginLeft:30,marginRight:24,marginTop:16,marginBottom:42,
    x:{label:'Reading target (higher = higher priority)'},y:{domain:IDS,label:null,tickSize:0},
    alt:'The selection and evaluation normal laws for each site, with their means and marginal 95 percent intervals. Only the chosen site mean shifts; the evaluation standard deviation multiplier applies to every site.',
    table:{caption:'Normal means and marginal intervals under the two declared laws',columns:[{label:'Site',value:'id',num:false},{label:'Law',value:'law',num:false},{label:'Mean',value:'mean',format:v=>formatDecimal(v,{digits:2})},{label:'Lower',value:'lower',format:v=>formatDecimal(v,{digits:3})},{label:'Upper',value:'upper',format:v=>formatDecimal(v,{digits:3})}],rows},
    marks:(c,P)=>[P.ruleY(rows.filter(d=>d.law==='selection'),{y:'id',x1:'lower',x2:'upper',stroke:c.plotFg,dy:-4,strokeWidth:2}),P.ruleY(rows.filter(d=>d.law==='evaluation'),{y:'id',x1:'lower',x2:'upper',stroke:c.plotMuted,dy:4,strokeDasharray:'5,3',strokeWidth:2}),P.dot(rows.filter(d=>d.law==='selection'),{x:'mean',y:'id',dy:-4,fill:c.plotFg,r:3.5}),P.dot(rows.filter(d=>d.law==='evaluation'),{x:'mean',y:'id',dy:4,fill:c.plotBg,stroke:c.plotMuted,strokeWidth:1.5,r:3.5})],
    keyboard:{data:rows,x:'mean',y:'id',key:d=>`${d.law}-${d.id}`,sort:false,title:d=>`${d.id}, ${d.law} law: mean ${formatDecimal(d.mean,{digits:2})}, 95 percent interval ${formatDecimal(d.lower,{digits:3})} to ${formatDecimal(d.upper,{digits:3})}.`},
   });
   lawNote.replaceChildren('Both are independent normal laws declared for these fictional sites, with ',ctx.num(.95,'95%'),' marginal intervals. The evaluation mean of ',h('span',{'data-prx-name':''},state.unit),' shifts by ',ro('shift',state.shift,v=>formatSigned(v,{digits:2})),', and every evaluation SD is multiplied by ',ro('scale',state.scale,formatSetting),'. Neither law is identified as an empirically verified truth.');
   // review 044 repair (G4-F6 and the review's replacement copy): the same report under the other law, the evaluation
   // law's own best and the regret; then whether the bounds can inform: risks lie in [0, 1], so a bound of 1 or more
   // says nothing about a risk difference. All existing read-out hooks are kept.
   const sharp=r.bound.regret,uniform=r.bound.uniform;
   const bounds=r.radius===0?['The two laws give the same pair errors (δ = ',ro('ro-delta',r.radius,v=>formatProb(v,{digits:4})),'), so both bounds are ',ro('uniform-bound',uniform,formatRisk),'.']
    :sharp>=1?['Here δ = ',ro('ro-delta',r.radius,v=>formatProb(v,{digits:4})),', so both bounds (',ro('ro-sharp-bound',sharp,formatRisk),' and ',ro('uniform-bound',uniform,formatRisk),') are at least ',ctx.num(1,formatCount(1)),' and give no tighter limit.']
    :uniform>=1?['Regret ',ctx.num(r.regret,formatRisk(r.regret)),' is at most the sharper bound ',ro('ro-sharp-bound',sharp,formatRisk),'; the uniform bound ',ro('uniform-bound',uniform,formatRisk),' is at least ',ctx.num(1,formatCount(1)),' and gives no tighter limit.']
    :['Regret ',ctx.num(r.regret,formatRisk(r.regret)),' is at most the sharper bound ',ro('ro-sharp-bound',sharp,formatRisk),' and the uniform bound ',ctx.num(2,formatCount(2)),'δ + η = ',ro('uniform-bound',uniform,formatRisk),'.'];
   ctx.readout.set(['Same report, other law: risk ',ro('selection-risk',r.chosenSelection.risk,formatRisk),' → ',ro('evaluation-risk',r.chosenEvaluation.risk,formatRisk),'. The evaluation law’s own best report has ',ro('ro-best-evaluation',r.bestEvaluation.risk,formatRisk),', so regret within the same family is ',ro('regret',r.regret,formatRisk),'. ',...bounds]);
   // the cards follow the bars as their row details; each names the bar row it describes
   const card=(row,title,opt,grade,key)=>h('section',{class:'prx-al-card'},h('span',{class:'prx-al-rowname'},row),ctx.panelTitle(title),h('p',{'data-prx-readout':key},blocksText(grade,IDS)),tagNode(ctx,opt),h('p',{class:'prx-al-note'},ro(`${key}-N`,opt.N),' of ',ctx.num(M,formatCount(M)),' pair directions stated.'));
   cards.replaceChildren(card('Selected report','Chosen under the selection law',r.selected,r.selected.grade,'selection-report'),card('Evaluation best','Best under the evaluation law',r.evaluationBest,r.evaluationBest.grade,'evaluation-report'));
   // review 044 repair (G4-F7): the bars labeled on the marks. One band per line: each report's name with its unit
   // blocks, its two bars (selection law above, evaluation law below) with the risk at each bar's end, the same
   // report's change under the other law (arrow) and the regret between the two evaluation-law risks (bracket)
   const riskRows=[{report:'Selected report',law:'selection',risk:r.chosenSelection.risk,row:'sel:selection'},{report:'Selected report',law:'evaluation',risk:r.chosenEvaluation.risk,row:'sel:evaluation'},{report:'Evaluation best',law:'selection',risk:r.bestSelection.risk,row:'best:selection'},{report:'Evaluation best',law:'evaluation',risk:r.bestEvaluation.risk,row:'best:evaluation'}];
   // drawn at the box's own width; below 560 px the long margin label takes two lines and the bands grow to fit it
   const barsWidth=Math.max(250,Math.round(risks.clientWidth||0)||width),narrow=barsWidth<560;
   const LINES=[['sel:title',''],['sel:selection','selection law'],['sel:change',narrow?'same report,\nother law':'same report, other law'],['sel:evaluation','evaluation law'],['best:title',''],['best:selection','selection law'],['best:evaluation','evaluation law'],['best:regret','regret']];
   const lineLabel=Object.fromEntries(LINES),titles=[{row:'sel:title',name:'Selected report',grade:r.selected.grade},{row:'best:title',name:'Evaluation best',grade:r.evaluationBest.grade}].map(d=>({...d,blocks:blocksText(d.grade,IDS)}));
   const change={row:'sel:change',from:r.chosenSelection.risk,to:r.chosenEvaluation.risk,delta:r.chosenEvaluation.risk-r.chosenSelection.risk};
   const gap={row:'best:regret',lo:Math.min(r.bestEvaluation.risk,r.chosenEvaluation.risk),hi:Math.max(r.bestEvaluation.risk,r.chosenEvaluation.risk),regret:r.regret};
   const signed=v=>Math.abs(v)>=5e-5?formatSigned(v,{digits:4}):formatSigned(v,{sig:2});
   const marginLeft=Math.round(Math.max(...[...LINES.map(([,t])=>t),...titles.map(d=>d.name)].flatMap(t=>t.split('\n')).map(t=>t.length))*6.6)+14;
   plot(risks,{width:barsWidth,height:LINES.length*(narrow?27:19)+46,marginLeft,marginRight:58,marginTop:8,marginBottom:38,x:{domain:[0,Math.max(...riskRows.map(d=>d.risk)) *1.08],label:'Risk (same cost and family)',ticks:4},y:{domain:LINES.map(([k])=>k),label:null,tickSize:0,tickFormat:k=>lineLabel[k]},
    alt:'Each report is evaluated under both laws. Evaluation regret is the difference between the selected report’s evaluation risk and the evaluation-law minimum.',
    table:{caption:'Risk of each report under each law',columns:[{label:'Report',value:'report',num:false},{label:'Law',value:'law',num:false},{label:'Risk',value:'risk',format:v=>formatRisk(v)}],rows:riskRows},
    marks:(c,P)=>[
     P.barX(riskRows.filter(d=>d.law==='selection'),{x:'risk',y:'row',fill:c.plotFg,insetTop:2,insetBottom:2}),
     P.barX(riskRows.filter(d=>d.law==='evaluation'),{x:'risk',y:'row',fill:c.plotMuted,insetTop:2,insetBottom:2}),
     numText(riskRows,{x:'risk',y:'row',value:'risk',format:v=>formatRisk(v),dx:5,textAnchor:'start',fill:c.plotFg}),
     P.text(titles,{x:0,y:'row',text:'name',textAnchor:'end',dx:-3,fill:c.plotFg,fontWeight:600}),
     P.text(titles,{x:0,y:'row',text:'blocks',textAnchor:'start',fill:c.plotFg,fontWeight:600}),
     P.arrow([change],{x1:'from',x2:'to',y1:'row',y2:'row',stroke:c.plotFg,strokeWidth:1.5,headLength:7}),
     numText([change],{x:d=>Math.max(d.from,d.to),y:'row',value:'delta',format:signed,dx:6,textAnchor:'start',fill:c.plotFg}),
     P.ruleY([gap],{y:'row',x1:'lo',x2:'hi',stroke:c.plotFg,strokeWidth:1.5}),
     P.tickX([gap.lo,gap.hi],{x:d=>d,y:()=>gap.row,stroke:c.plotFg,strokeWidth:1.5,insetTop:4,insetBottom:4}),
     numText([gap],{x:'hi',y:'row',value:'regret',format:v=>formatRisk(v),dx:6,textAnchor:'start',fill:c.plotFg}),
    ],
    keyboard:{data:riskRows,x:'risk',y:'row',key:d=>`${d.report}-${d.law}`,sort:false,title:d=>`${d.report}, ${d.law} law: risk ${formatRisk(d.risk)}.`},
   });
   const table=h('table',{class:'prx-al-table'},h('caption',{},'Evaluation of each fixed report; the law changes across columns'),h('thead',{},h('tr',{},...['Fixed report','Selection-law risk','Evaluation-law risk','Expected wrong share among stated pairs (evaluation law)'].map(t=>h('th',{scope:'col'},t)))),h('tbody',{},
    h('tr',{},h('th',{scope:'row'},'Selected report'),h('td',{},ro('table-selected-selection',r.chosenSelection.risk,formatRisk)),h('td',{},ro('table-selected-evaluation',r.chosenEvaluation.risk,formatRisk)),h('td',{},ro('selected-share',r.chosenEvaluation.EoverN[0],formatShare))),
    h('tr',{},h('th',{scope:'row'},'Evaluation best'),h('td',{},ro('table-best-selection',r.bestSelection.risk,formatRisk)),h('td',{},ro('table-best-evaluation',r.bestEvaluation.risk,formatRisk)),h('td',{},ro('best-share',r.bestEvaluation.EoverN[0],formatShare)))));
   tableSlot.replaceChildren(table);
   const boundRow=(title,formula,observed,upper)=>h('div',{class:'prx-al-bound-row'},h('strong',{},title),h('p',{class:'prx-al-note'},...formula),h('p',{},'Observed ',observed,' ≤ upper bound ',upper,'.'));
   boundBox.replaceChildren(ctx.panelTitle('What each bound compares'),
    h('p',{},'Largest pair-error gap δ = ',ro('delta',r.radius,v=>formatProb(v,{digits:4})),'.'),
    h('p',{class:'prx-al-note'},'The optimization gap η measures how far the selected report is above the selection-law minimum in this family. Exact enumeration gives η = ',ro('eta',0),'. Evaluation regret instead compares that report with the evaluation-law minimum; it can be positive when η is zero.'),
    boundRow('Absolute risk change of the fixed selected report',['Same report, different laws: bound (N/M)δ.'],ro('risk-difference',r.riskDifference,formatRisk),ro('evaluation-bound',r.bound.evaluation,formatRisk)),
    boundRow('Evaluation regret using disclosure counts',['Both reports judged under the evaluation law: bound ((N + N*)/M)δ + η.'],ro('regret-copy',r.regret,formatRisk),ro('sharp-bound',r.bound.regret,formatRisk)),
    boundRow('Uniform evaluation-regret comparison',['Bound ',ctx.num(2,formatCount(2)),'δ + η; it does not need either disclosure count.'],ro('uniform-observed',r.regret,formatRisk),ro('uniform-copy',r.bound.uniform,formatRisk)),
    h('p',{class:'prx-al-note'},'Here N = ',ctx.num(r.selected.N,formatCount(r.selected.N)),' is the selected report’s stated-pair count; N* = ',ctx.num(r.evaluationBest.N,formatCount(r.evaluationBest.N)),' belongs to the evaluation-best report; M = ',ctx.num(M,formatCount(M)),' counts all pairs.'),
    h('p',{class:'prx-al-note'},'The general comparison is regret ≤ ',ctx.num(2,formatCount(2)),'d + η, where d bounds risk disagreement over the entire common family. Pair errors give d ≤ δ here. These bounds concern risk, not agreement of grade vectors.'),
    h('p',{class:'prx-al-note'},'Both laws use the same targets, withholding cost and family. These bounds can be loose. More posterior draws alone do not establish agreement between the laws.'));
   const pair=r.coefficient.at[0];
   gapPair.replaceChildren('One pair attaining the radius: ',h('span',{'data-prx-name':''},`${IDS[pair.i]} above ${IDS[pair.j]}`),', with error ',ro('pair-selection-error',selectionLaw.e[0][pair.i][pair.j],formatProb),' under selection and ',ro('pair-evaluation-error',r.evaluationLaw.e[0][pair.i][pair.j],formatProb),' under evaluation.');
   relations.replaceChildren('Comparing the two chosen reports changes ',ro('changed-pairs',M-r.changes.nSame),' of ',ctx.num(M,formatCount(M)),' pair decisions (newly stated, newly withheld, or reversed).');
   for(const [name,opt]of [['selection',r.selected],['evaluation',r.evaluationBest]])if(opt.tieCount>1)relations.append(' Under the ',name,' law, ',ctx.num(opt.tieCount,formatCount(opt.tieCount)),' reports share exactly equal computed risk; the first is shown. Equal-risk tolerance ',ctx.num(opt.tieTol,formatSci(opt.tieTol)),'.');
  }};
 }});
}
