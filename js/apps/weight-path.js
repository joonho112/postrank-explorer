// Exact weight intervals and reusable weighted-risk lines. No transition grid or interval filter.
import {createWidget} from '../shared/base.js';
import {plot,palette,numText,hiddenTable} from '../shared/chart.js';
import {formatCount,formatDecimal,formatGrades,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {evaluateReport,exactOptimum,minimaxChoice,weightBreakpoints} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {TWO_SCORES_KEYS,TWO_SCORES_CSS,createTwoScoreControls,createTwoScoresSlots,createTwoScoresView,solveTwoScores,twoScoreFamily} from './two-scores.js';
export const WEIGHT_PATH_CSS=`
.wpath .wpath-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.8rem 1.2rem;min-width:0}
.wpath .wpath-grid>section{min-width:0}
.wpath .wpath-wide{grid-column:1/-1;min-width:0}
.wpath .wpath-scroll{overflow-x:auto;max-width:100%;min-width:0}
.wpath .wpath-table{border-collapse:collapse;width:100%;min-width:53rem;font-size:.85rem}
.wpath .wpath-table th,.wpath .wpath-table td{padding:.35rem .5rem;border-bottom:1px solid var(--prx-border-strong);text-align:left;white-space:nowrap}
.wpath .wpath-table caption{text-align:left;font-weight:600;padding:.3rem 0}
.wpath .wpath-status{flex-basis:100%;min-height:1.5em;line-height:1.5;margin:0;font-size:.88rem}
.wpath .wpath-note{font-size:.88rem;margin:.3rem 0 .65rem}
.wpath .wpath-legend{display:flex;flex-wrap:wrap;gap:.6rem 1rem;font-size:.86rem;padding:.3rem}
.wpath .wpath-all-endpoints table{table-layout:fixed;width:100%}
.wpath .wpath-endlabels{display:flex;justify-content:space-between;flex-wrap:wrap;gap:.2rem .8rem;font-size:.75rem;padding:.15rem .3rem}
.wpath .wpath-keyline{display:inline-block;width:1.3rem;border-top:3px solid;margin-right:.3rem;vertical-align:middle}
@media(max-width:40em){.wpath .wpath-grid{grid-template-columns:minmax(0,1fr)}}`;
const caches=new WeakMap();const keyOf=g=>Array.from(g).join('/');
export const weightText=w=>w!==0&&Math.abs(w)<1e-6?formatSci(w):formatDecimal(w,{digits:8});
function num(ctx,value,fmt=formatCount,hook){const n=ctx.num(value,fmt(value));if(hook)n.dataset.prxReadout=hook;return n}
/** Generic actual line/envelope model consumed by 4.4 and 4.9. Two criteria only. */
export function weightedRiskModel(E,{tau=.2,family={kind:'all'}}={}){
 let cache=caches.get(E);if(!cache){cache=new Map();caches.set(E,cache)}const key=JSON.stringify([tau,family]);if(cache.has(key))return cache.get(key);
 const path=weightBreakpoints(E,{tau,family}),choice=minimaxChoice(E,{tau,w:[.5,.5],family});
 if(path.empty||choice.empty||!choice.reports)throw new RangeError('Risk-line views require a nonempty two-criterion family with at most five thousand reports');
 const lines=choice.reports.map(report=>({key:keyOf(report.grade),grade:report.grade,R1:report.Rk[0],R2:report.Rk[1],max:report.max,N:report.N,evaluation:evaluateReport(report.grade,E,{tau,w:[.5,.5]})}));
 const envelope=path.intervals.flatMap((r,segment)=>[{segment,w:r.wFrom,risk:r.riskFrom,grade:r.grade},{segment,w:r.wTo,risk:r.riskTo,grade:r.grade}]);
 // Layout records retain every endpoint; missing coordinates separate the SVG subpaths.
 const segments=lines.flatMap(line=>[[0,line.R2],[1,line.R1],[NaN,NaN]]);
 const model={E,tau,family,path,lines,segments,envelope,envelopeMaximum:path.envelopeMaximum,choice};cache.set(key,model);if(cache.size>12)cache.delete(cache.keys().next().value);return model;
}
/** Explicit renderer; highlights are {grade,label,stroke?:(palette)=>color,dash?}. */
export function createWeightedRiskView(ctx,slot,options={}){
 const h=ctx.h,chartSlot=h('div'),notesSlot=h('div'),allTableSlot=h('div',{class:'wpath-all-endpoints'});slot.append(chartSlot,notesSlot,allTableSlot);const endpointTables=new WeakMap();let attachedModel;
 const prepare=model=>{let entry=endpointTables.get(model);if(!entry){const node=hiddenTable(ctx.doc,{caption:'All report-risk endpoints, including reports leaving the displayed risk range',rows:model.lines,columns:[{label:'Grade vector',value:'grade',format:v=>formatGrades(v)},{label:'Criterion one risk',value:'R1',format:v=>formatRisk(v)},{label:'Criterion two risk',value:'R2',format:v=>formatRisk(v)},{label:'Worst endpoint risk',value:'max',format:v=>formatRisk(v)}]}),body=node.querySelector('tbody');entry={node,body,rows:Array.from(body.children)};endpointTables.set(model,entry)}return entry};
 const attach=model=>{if(attachedModel!==model){const entry=prepare(model);entry.body.replaceChildren(...entry.rows);allTableSlot.replaceChildren(entry.node);attachedModel=model}};
 // Small DOM batches bound the full table's style/layout work, not its scientific scope.
 const attachmentStages=model=>attachedModel===model?[]:[()=>{const entry=prepare(model);attachedModel=null;entry.body.replaceChildren();allTableSlot.replaceChildren(entry.node)},...Array.from({length:Math.ceil(model.lines.length/256)},(_,i)=>()=>{const entry=prepare(model),end=(i+1)*256;entry.body.append(...entry.rows.slice(i*256,end));if(end>=entry.rows.length)attachedModel=model})];
 return {prepare,attach,attachmentStages,render(model,state={w:.5},highlights=[]){
  attach(model);
  const yMax=options.yMax??Math.max(.25,model.tau),pal=palette(ctx.root);
  const featured=highlights.map((highlight,i)=>{const line=model.lines.find(d=>d.key===keyOf(highlight.grade));if(!line)throw new Error('Highlighted report is not in the line model family');return {...line,...highlight,index:i,current:evaluateReport(highlight.grade,model.E,{tau:model.tau,w:[state.w,1-state.w]}),stroke:highlight.stroke??(c=>c.plotFg)}});
  const worst=featured.map(d=>({...d,x:d.R1>=d.R2?1:0,y:d.max}));
  // Coalesce only coincident value labels; every highlighted report and endpoint dot remains.
  const labelledEndpoints=new Set(),worstLabels=worst.filter(d=>{const key=`${d.x}:${d.max}`;if(labelledEndpoints.has(key))return false;labelledEndpoints.add(key);return true});
  plot(chartSlot,{alt:'Every eligible report is a line from its criterion two risk at weight zero to its criterion one risk at weight one. The thick band is the exact lower envelope.',height:300,marginTop:24,marginBottom:38,marginLeft:47,marginRight:52,x:{domain:[0,1],ticks:[0,.25,.5,.75,1],label:'weight on the first criterion →'},y:{domain:[0,yMax],grid:true,label:'↑ expected risk'},
   table:{caption:'Highlighted report-risk endpoints',rows:featured,columns:[{label:'Grade vector',value:'grade',format:v=>formatGrades(v)},{label:'Criterion one risk',value:'R1',format:v=>formatRisk(v)},{label:'Criterion two risk',value:'R2',format:v=>formatRisk(v)},{label:'Worst endpoint risk',value:'max',format:v=>formatRisk(v)}]},
   marks:(c,P)=>[P.line(model.segments,{x:d=>d[0],y:d=>d[1],z:null,stroke:c.plotGrid,strokeWidth:1.1,strokeOpacity:.9,clip:true}),P.line(model.envelope,{x:'w',y:'risk',stroke:c.plotMuted,strokeWidth:7,strokeOpacity:.75,clip:true}),...featured.map(d=>P.line([{x:0,y:d.R2},{x:1,y:d.R1}],{x:'x',y:'y',stroke:d.stroke(c),strokeWidth:d.dash?2:3,strokeDasharray:d.dash??null,clip:true})),P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'2,2'}),P.dot(featured,{x:()=>state.w,y:d=>d.current.risk,fill:d=>d.stroke(c),stroke:c.plotBg,r:5.5,clip:true}),P.dot(worst,{x:'x',y:'y',fill:d=>d.dash?c.plotBg:d.stroke(c),stroke:d=>d.stroke(c),strokeWidth:2,r:5,clip:true}),...worstLabels.map(d=>numText([d],{x:'x',y:'y',value:'max',format:v=>formatRisk(v),dx:d.x?9:d.y>=yMax?-8:8,dy:d.y>=yMax?16:d.index%2?12:-12,textAnchor:d.x===0&&d.y>=yMax?'end':'start',fontSize:12,fill:c.plotFg}))],
   keyboard:{data:model.lines,virtual:true,x:()=>.5,y:d=>d.evaluation.risk,title:d=>`Report ${formatGrades(d.grade)}: criterion one risk ${formatRisk(d.R1)}, criterion two risk ${formatRisk(d.R2)}, worst endpoint ${formatRisk(d.max)}${d.R1>yMax&&d.R2>yMax?'; trajectory wholly above the displayed risk range':d.max>yMax?'; trajectory partly clipped at the displayed risk maximum':''}`}});
  const legend=h('div',{class:'wpath-legend prx-light-panel'});[[pal.plotGrid,'Other reports'],[pal.plotMuted,'Exact lowest risk at each weight'],...featured.map(d=>[d.stroke(pal),d.label,d.dash])].forEach(([color,label,dash])=>legend.append(h('span',{},h('i',{class:'wpath-keyline',style:{'border-color':color,'border-top-style':dash?'dashed':'solid'}}),label)));
  notesSlot.replaceChildren(h('div',{class:'wpath-endlabels prx-light-panel'},h('span',{},'← criterion two risk'),h('span',{},'criterion one risk →')),legend,h('p',{class:'wpath-note'},'Every grey report trajectory is drawn, clipped to risks from ',num(ctx,0,formatSetting),' to ',num(ctx,yMax,formatSetting),'. The hidden table and keyboard retain all endpoints. Highlighted trajectories and the exact envelope use the same clipping.'));
 }};
}
const pathCache=new Map();
/** Exact intervals, all boundary ties, and their complete report evaluations. */
export function solveWeightPath(state={}){
 const s={w:.5,tau:.2,cap:'3',...state},data=criteriaData('six'),key=JSON.stringify([s.tau,s.cap]);let fixed=pathCache.get(key);
 if(!fixed){const riskModel=weightedRiskModel(data.E,{tau:s.tau,family:twoScoreFamily(s.cap)}),path=riskModel.path;
  const intervals=path.intervals.map((row,index)=>({...row,index,evaluation:evaluateReport(row.grade,data.E,{tau:s.tau,w:[.5,.5]})}));
  const boundaryWeights=Array.from(new Set([0,...path.intervals.flatMap(r=>[r.wFrom,r.wTo]),1])).sort((a,b)=>a-b);
  const endpointTies=boundaryWeights.map(w=>{const result=exactOptimum(data.E,{tau:s.tau,w:[w,1-w],family:twoScoreFamily(s.cap)});return {w,result,profiles:result.grades.map(grade=>({grade,evaluation:evaluateReport(grade,data.E,{tau:s.tau,w:[w,1-w]})}))}});
  fixed={data,path,intervals,endpointTies,riskModel};pathCache.set(key,fixed);if(pathCache.size>12)pathCache.delete(pathCache.keys().next().value)}
 return {...fixed,state:s,base:solveTwoScores(s)};
}
export function createWeightStepView(ctx,slots){
 const h=ctx.h,shareChart=h('div'),shareLegend=h('div');slots.shares.append(shareChart,shareLegend);let previousPath,previousLayout,shareHandle,countHandle;
 const moveWeight=(chart,w)=>{const line=chart.svg.querySelector('g[aria-label="rule"] line'),x=chart.scale('x').apply(w);if(line){line.setAttribute('x1',String(x));line.setAttribute('x2',String(x))}};
 return {render(model,state=model.state){
  const layout=[shareChart.clientWidth,slots.counts.clientWidth,ctx.doc.documentElement.getAttribute('data-theme'),ctx.root.getAttribute('data-prx-font-scale')].join('|');
  if(model.path!==previousPath||layout!==previousLayout){
  const {intervals,endpointTies}=model,steps=intervals.flatMap(r=>[{...r,w:r.wFrom},{...r,w:r.wTo}]),shares=steps.flatMap(r=>[{...r,k:0,share:r.EoverN[0]},{...r,k:1,share:r.EoverN[1]}]);
  shareHandle=plot(shareChart,{alt:'Each criterion expected wrong share is constant inside an exact weight interval; boundary dots retain intervals of zero or tiny width.',height:255,marginLeft:48,marginBottom:35,x:{domain:[0,1],label:'weight on score A →'},y:{domain:[0,1],label:'↑ expected wrong share among stated pairs'},
   table:{caption:'Exact weight intervals and expected wrong shares',rows:intervals,columns:[{label:'From weight',value:'wFrom',format:v=>weightText(v)},{label:'To weight',value:'wTo',format:v=>weightText(v)},{label:'Grade vector',value:'grade',format:v=>formatGrades(v)},{label:'Score A share',value:d=>d.EoverN[0],format:v=>formatShare(v)},{label:'Score B share',value:d=>d.EoverN[1],format:v=>formatShare(v)}]},
   marks:(c,P)=>[P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'3,3'}),...intervals.flatMap(r=>[0,1].map(k=>P.line([{w:r.wFrom,share:r.EoverN[k]},{w:r.wTo,share:r.EoverN[k]}],{x:'w',y:'share',stroke:c.crit[k],strokeWidth:2.5}))),P.dot(shares.filter(d=>d.share!==null),{x:'w',y:'share',fill:d=>c.crit[d.k],r:2.5})],
   keyboard:{data:shares.filter(d=>d.share!==null),x:'w',y:'share',title:d=>`Score ${d.k?'B':'A'}, weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: expected wrong share ${formatShare(d.share)}, report ${formatGrades(d.grade)}`}});
  const pal=palette(ctx.root);shareLegend.replaceChildren(h('p',{class:'wpath-legend prx-light-panel'},...['score A','score B'].map((label,k)=>h('span',{},h('i',{class:'wpath-keyline',style:{'border-color':pal.crit[k]}}),label))));
  countHandle=plot(slots.counts,{alt:'The number of stated pairs and grades changes only at exact weight boundaries.',height:255,marginLeft:43,marginBottom:35,x:{domain:[0,1],label:'weight on score A →'},y:{domain:[0,model.data.M],label:'↑ pairs stated'},
   table:{caption:'Exact weight intervals and disclosure counts',rows:intervals,columns:[{label:'From weight',value:'wFrom',format:v=>weightText(v)},{label:'To weight',value:'wTo',format:v=>weightText(v)},{label:'Pairs stated',value:'N',format:v=>formatCount(v)},{label:'Grades used',value:'G',format:v=>formatCount(v)}]},marks:(c,P)=>[P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'3,3'}),...intervals.map(r=>P.line([{w:r.wFrom,N:r.N},{w:r.wTo,N:r.N}],{x:'w',y:'N',stroke:c.plotFg,strokeWidth:2.5})),P.dot(steps,{x:'w',y:'N',fill:c.plotFg,r:3})],keyboard:{data:steps,x:'w',y:'N',title:d=>`Weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: ${formatCount(d.N)} pairs stated, ${formatCount(d.G)} grades; report ${formatGrades(d.grade)}`}});
  const header=['From w','To w','Report','N','Grades','A: E/N','B: E/N','Risk at left','Risk at right'];
  const table=h('table',{class:'wpath-table'},h('caption',{},'Every exact interval, including tiny and zero-length endpoint entries'),h('thead',{},h('tr',{},...header.map(text=>h('th',{scope:'col',text})))),h('tbody',{},...intervals.map(r=>h('tr',{},h('td',{},num(ctx,r.wFrom,weightText,`from-${r.index}`)),h('td',{},num(ctx,r.wTo,weightText,`to-${r.index}`)),h('td',{},num(ctx,r.grade,formatGrades,`path-grade-${r.index}`)),h('td',{},num(ctx,r.N,formatCount,`path-N-${r.index}`)),h('td',{},num(ctx,r.G,formatCount,`path-G-${r.index}`)),h('td',{},num(ctx,r.EoverN[0],formatShare,`path-share-${r.index}-0`)),h('td',{},num(ctx,r.EoverN[1],formatShare,`path-share-${r.index}-1`)),h('td',{},num(ctx,r.riskFrom,formatRisk,`path-riskFrom-${r.index}`)),h('td',{},num(ctx,r.riskTo,formatRisk,`path-riskTo-${r.index}`))))));
  slots.table.replaceChildren(h('p',{class:'wpath-note'},'Swipe or use the keyboard to scroll the interval and boundary tables. Tiny positive weights use scientific notation; every interval is retained. At a boundary, adjacent reports can both minimize risk.'),ctx.scrollRegion(h('div',{class:'wpath-scroll'},table),'All exact weight intervals'));
  const tieRows=endpointTies.flatMap((row,boundary)=>row.profiles.map((p,index)=>({boundary,index,w:row.w,tieCount:row.result.tieCount,tieTol:row.result.tieTol,...p})));
  const tieTable=h('table',{class:'wpath-table'},h('caption',{},'Exact optimization at every boundary: all retained tied reports'),h('thead',{},h('tr',{},...['Boundary w','Number best','Report','N','A: E/N','B: E/N','Weighted risk'].map(text=>h('th',{scope:'col',text})))),h('tbody',{},...tieRows.map(r=>h('tr',{},h('td',{},num(ctx,r.w,weightText)),h('td',{},num(ctx,r.tieCount)),h('td',{},num(ctx,r.grade,formatGrades,`boundary-grade-${r.boundary}-${r.index}`)),h('td',{},num(ctx,r.evaluation.N,formatCount,`boundary-N-${r.boundary}-${r.index}`)),h('td',{},num(ctx,r.evaluation.EoverN[0],formatShare,`boundary-share-${r.boundary}-${r.index}-0`)),h('td',{},num(ctx,r.evaluation.EoverN[1],formatShare,`boundary-share-${r.boundary}-${r.index}-1`)),h('td',{},num(ctx,r.evaluation.risk,formatRisk,`boundary-risk-${r.boundary}-${r.index}`))))));
  slots.table.append(ctx.scrollRegion(h('div',{class:'wpath-scroll'},tieTable),'All exact boundary reports'),h('p',{class:'wpath-note'},'Boundary optima use equal-risk tolerance ',num(ctx,model.path.tieTol,formatSci),'. Full tie counts are shown alongside every retained report.'));
  previousPath=model.path;previousLayout=layout;
  }else{moveWeight(shareHandle,state.w);moveWeight(countHandle,state.w)}
  const peak=model.path.envelopeMaximum;slots.summary.replaceChildren(h('p',{},'Current weight on score A: ',num(ctx,state.w,weightText,'current-weight'),'. Exact report changes at ',num(ctx,model.path.breakpoints.length),' interior boundaries.'),h('p',{},'The lower envelope reaches its largest risk ',num(ctx,peak.risk,formatRisk,'envelope-peak-risk'),' at weight ',...peak.intervals.flatMap((r,i)=>[i?'; ':'',num(ctx,r.from,weightText,`peak-from-${i}`),r.from===r.to?'':[' to ',num(ctx,r.to,weightText)]]),'.'),h('p',{class:'wpath-note'},'Risks at different weights use different losses. This envelope peak is not the worst risk of a fixed report and need not equal the deterministic minimax risk.'));
 }};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'weight-path',className:'wpath tws',css:TWO_SCORES_CSS+WEIGHT_PATH_CSS,keys:TWO_SCORES_KEYS,build(ctx){
 const h=ctx.h,controls=createTwoScoreControls(ctx),slots={};const panel=(key,title,wide=false)=>{slots[key]=h('div');return h('section',{class:`prx-panel ${wide?'wpath-wide':''}`,'aria-label':title},ctx.panelTitle(title),slots[key])};
 ctx.charts.append(h('div',{class:'wpath-grid'},panel('summary','The exact path',true),panel('shares','Error shares on each criterion'),panel('counts','How many pairs the report states'),panel('risk','Every report’s risk line and the exact lower envelope',true),panel('table','Reports on the exact intervals and boundaries',true)));
 const steps=createWeightStepView(ctx,slots),risk=createWeightedRiskView(ctx,slots.risk),linked=createTwoScoresView(ctx,createTwoScoresSlots(ctx));
 const progress=h('p',{class:'wpath-status','aria-hidden':'true'});ctx.controls.append(progress);
 let generation=0,cancelNext=null,dead=false,readyPath=null,readyCap=null;
 const finish=(model,state)=>{readyPath=model.path;readyCap=state.cap;progress.textContent='';ctx.root.setAttribute('aria-busy','false')};
 const stop=()=>{generation++;cancelNext?.();cancelNext=null};ctx.onCleanup(()=>{dead=true;stop();progress.textContent=''});
 return {render(state){
  stop();const epoch=generation;controls.render(state);const model=solveWeightPath(state),highlights=model.base.profiles.map((p,i)=>({grade:p.grade,label:i?'Another weighted best':'Weighted best at current weight',dash:i?'5,3':undefined}));
  if(model.path===readyPath||(state.cap!=='all'&&readyCap!=='all')){steps.render(model,state);risk.render(model.riskModel,state,highlights);linked.render(model.base,state);finish(model,state);return;}
  ctx.root.setAttribute('aria-busy','true');progress.textContent='Updating reports…';ctx.readout.set(['Updating the complete linked report views…']);
  const stages=[()=>risk.prepare(model.riskModel),...risk.attachmentStages(model.riskModel),()=>steps.render(model,state),()=>risk.render(model.riskModel,state,highlights),()=>linked.render(model.base,state)];let stage=0;
  const next=()=>{if(dead||epoch!==generation)return;ctx.keepFocus(()=>stages[stage++]());if(dead||epoch!==generation)return;if(stage<stages.length)cancelNext=ctx.timeout(next,20);else{cancelNext=null;finish(model,state)}};
  cancelNext=ctx.timeout(next,20);
 }};
}})}
