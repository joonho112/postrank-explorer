// Exact weight intervals and reusable weighted-risk lines. No transition grid or interval filter.
import {createWidget} from '../shared/base.js';
import {plot,palette,numText,hiddenTable,labelOn} from '../shared/chart.js';
import {formatCount,formatDecimal,formatGrades,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {evaluateReport,exactOptimum,minimaxChoice,weightBreakpoints} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {TWO_SCORES_KEYS,TWO_SCORES_CSS,createTwoScoreControls,createTwoScoresSlots,createTwoScoresView,reportWords,shareText,solveTwoScores,twoScoreFamily} from './two-scores.js';
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
const OVERVIEW_CSS=`
.wpath-first .wpath-interval-key{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:.15rem .55rem;padding:.35rem .5rem;margin:0;font-size:.85rem;list-style:none}
.wpath-first .wpath-interval-key [aria-current]{font-weight:700}
.wpath-first .wpath-overview figure{margin:0}
.wpath-first .wpath-overview .wpath-legend{margin:0}
`;
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
// Each trajectory is a straight segment between the same two x positions.
function reportTrajectories(P,model,color,direct){
 const style={z:null,stroke:color,strokeWidth:1.1,strokeOpacity:.9,clip:true};
 if(!direct)return P.line(model.segments,{...style,x:d=>d[0],y:d=>d[1]});
 return P.line([0,1],{...style,x:w=>w,y:()=>0,render(index,scales,values,dimensions,context,next){
  // Keep Plot's styled, clipped group and its pixel transform. The linear
  // scales already define all endpoints; no per-report Plot channels are needed.
  const group=next(index,scales,values,dimensions,context);
  const rounded=value=>Math.round(value*1000)/1000;
  const x0=rounded(scales.x(0)),x1=rounded(scales.x(1));
  group.querySelector('path').setAttribute('d',model.lines.map(({R1,R2})=>
   `M${x0},${rounded(scales.y(R2))}L${x1},${rounded(scales.y(R1))}`).join(''));
  return group;
 }});
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
  const active=options.currentLabel?featured.find(d=>d.active):null;
  const showCurrent=active&&active.current.risk<=yMax&&!worstLabels.some(d=>d.x===state.w&&Math.abs(d.max-active.current.risk)<=model.path.tieTol);
  plot(chartSlot,{alt:'Every eligible report is a line from its criterion two risk at weight zero to its criterion one risk at weight one. The thick band is the exact lower envelope.',height:300,marginTop:24,marginBottom:38,marginLeft:47,marginRight:52,x:{domain:[0,1],ticks:[0,.25,.5,.75,1],label:'weight on the first criterion →'},y:{domain:[0,yMax],grid:true,label:'↑ expected risk'},
   table:{caption:'Highlighted report-risk endpoints',rows:featured,columns:[{label:'Grade vector',value:'grade',format:v=>formatGrades(v)},{label:'Criterion one risk',value:'R1',format:v=>formatRisk(v)},{label:'Criterion two risk',value:'R2',format:v=>formatRisk(v)},{label:'Worst endpoint risk',value:'max',format:v=>formatRisk(v)}]},
   marks:(c,P)=>[reportTrajectories(P,model,c.plotGrid,options.directLinePaths),P.line(model.envelope,{x:'w',y:'risk',stroke:c.plotMuted,strokeWidth:7,strokeOpacity:.75,clip:true}),...featured.map(d=>P.line([{x:0,y:d.R2},{x:1,y:d.R1}],{x:'x',y:'y',stroke:d.stroke(c),strokeWidth:d.dash?2:3,strokeDasharray:d.dash??null,clip:true})),P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'2,2'}),P.dot(featured,{x:()=>state.w,y:d=>d.current.risk,fill:d=>d.stroke(c),stroke:c.plotBg,r:5.5,clip:true}),P.dot(worst,{x:'x',y:'y',fill:d=>d.dash?c.plotBg:d.stroke(c),stroke:d=>d.stroke(c),strokeWidth:2,r:5,clip:true}),...worstLabels.map(d=>numText([d],{x:'x',y:'y',value:'max',format:v=>formatRisk(v),dx:d.x?9:d.y>=yMax?-8:8,dy:d.y>=yMax?16:d.index%2?12:-12,textAnchor:d.x===0&&d.y>=yMax?'end':'start',fontSize:12,fill:c.plotFg})),
    ...(showCurrent?[numText([active],{x:()=>state.w,y:d=>d.current.risk,value:d=>d.current.risk,format:formatRisk,dx:state.w>.7?-8:8,dy:active.current.risk>yMax*.87?12:-10,textAnchor:state.w>.7?'end':'start',fill:c.plotFg,stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke',fontWeight:700})]:[])],
   keyboard:{data:model.lines,virtual:true,x:()=>.5,y:d=>d.evaluation.risk,title:d=>`Report ${formatGrades(d.grade)}: criterion one risk ${formatRisk(d.R1)}, criterion two risk ${formatRisk(d.R2)}, worst endpoint ${formatRisk(d.max)}${d.R1>yMax&&d.R2>yMax?'; trajectory wholly above the displayed risk range':d.max>yMax?'; trajectory partly clipped at the displayed risk maximum':''}`}});
  const legend=h('div',{class:'wpath-legend prx-light-panel'});[[pal.plotGrid,'Other reports'],[pal.plotMuted,'Exact lowest risk at each weight'],...featured.map(d=>[d.stroke(pal),d.label,d.dash])].forEach(([color,label,dash])=>legend.append(h('span',{},h('i',{class:'wpath-keyline',style:{'border-color':color,'border-top-style':dash?'dashed':'solid'}}),label)));
  notesSlot.replaceChildren(h('div',{class:'wpath-endlabels prx-light-panel'},h('span',{},'← criterion two risk'),h('span',{},'criterion one risk →')),legend,h('p',{class:'wpath-note'},'Every gray report trajectory is drawn, clipped to risks from ',num(ctx,0,formatSetting),' to ',num(ctx,yMax,formatSetting),'. The hidden table and keyboard retain all endpoints. Highlighted trajectories and the exact envelope use the same clipping.'));
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

// Treat the machine-scale sliver at the left endpoint as an endpoint tie only
// when the optimizer actually returns both adjacent reports there.
function displayPath(model){
 const {intervals,endpointTies,path}=model,[first,second]=intervals;
 const atZero=new Set(endpointTies[0].profiles.map(p=>keyOf(p.grade)));
 const snap=first.wFrom===0&&first.wTo>0&&first.wTo<=path.tieTol&&second?.wFrom===first.wTo&&atZero.has(keyOf(first.grade))&&atZero.has(keyOf(second.grade));
 if(!snap)return {intervals,breakpoints:path.breakpoints};
 return {intervals:[{...first,wTo:0},{...second,wFrom:0},...intervals.slice(2)],
  breakpoints:path.breakpoints.filter(w=>w!==first.wTo),rawIntervals:intervals};
}

function createWeightOverview(ctx,slot){
 const {h}=ctx,summary=h('p',{class:'wpath-note'}),strip=h('div'),shares=h('div'),key=h('ul',{class:'wpath-interval-key'}),legend=h('p',{class:'wpath-legend prx-light-panel'});
 slot.append(summary,strip,shares,legend,key);
 const x={domain:[0,1]},margins={marginLeft:54,marginRight:18};
 const compactWeight=w=>formatDecimal(w,{digits:5});
 return (model,state)=>{
  const shown=displayPath(model),regular=shown.intervals.filter(r=>r.wTo>r.wFrom),M=model.data.M;
  const active=regular.find(r=>keyOf(r.grade)===keyOf(model.base.result.grade)&&r.wFrom-model.path.tieTol<=state.w&&state.w<=r.wTo+model.path.tieTol);
  const labelRows=regular.map((r,i)=>({...r,code:i+1,mid:(r.wFrom+r.wTo)/2,report:reportWords(r.grade,model.data.ids)}));
  const innerWidth=(strip.clientWidth||ctx.width())-margins.marginLeft-margins.marginRight;
  const visibleCodes=labelRows.filter(r=>(r.wTo-r.wFrom)*innerWidth>=(r.code<10?10:14));
  const ends=model.endpointTies.filter(r=>(r.w===0||r.w===1)&&r.result.tieCount>1);
  summary.replaceChildren(num(ctx,shown.breakpoints.length),' interior boundaries',
   ...ends.flatMap(r=>[' · At w = ',num(ctx,r.w,formatSetting),', ',num(ctx,r.result.tieCount),' reports tie.']));
  plot(strip,{...margins,height:78,marginTop:4,marginBottom:3,x:{...x,axis:null},y:{domain:[0,1],axis:null},
   alt:'The selected weight crosses adjacent intervals of constant best report. Endpoint dots mark ties.',
   keyboard:{data:labelRows,x:'mid',y:()=>.48,sort:false,title:r=>`${r.report}; ${formatCount(r.N)} stated pairs; from ${compactWeight(r.wFrom)} to ${compactWeight(r.wTo)}.`},
   table:{caption:'Displayed weight intervals of positive width',rows:labelRows,columns:[{label:'Report',value:'report'},{label:'Pairs stated',value:'N',format:formatCount},{label:'From weight',value:'wFrom',format:compactWeight},{label:'To weight',value:'wTo',format:compactWeight}]},
   marks:(c,P)=>[P.rect(labelRows,{x1:'wFrom',x2:'wTo',y1:.24,y2:.67,insetLeft:.6,insetRight:.6,fill:r=>r.index===active?.index?c.post:c.plotGrid}),
    P.ruleX([state.w],{stroke:c.est,strokeWidth:2}),
    numText(visibleCodes,{x:'mid',y:()=>.45,value:'code',format:formatCount,fill:r=>r.index===active?.index?labelOn(c.post,c):c.plotFg,fontWeight:700}),
    P.dot(ends,{x:'w',y:()=>.73,r:4,fill:c.plotFg})]});
  const points=shown.intervals.flatMap(r=>[0,1].flatMap(k=>[r.wFrom,r.wTo].map(w=>({w,k,share:r.EoverN[k],report:keyOf(r.grade)}))));
  const yTop=Math.max(.25,...points.map(p=>p.share??0));
  const focus=model.base.profiles[0].evaluation.EoverN.flatMap((share,k)=>share===null?[]:[{w:state.w,k,share}]);
  const center=state.w>.18&&state.w<.82;
  plot(shares,{...margins,height:184,marginTop:26,marginBottom:36,x:{...x,label:'Weight on score A',labelAnchor:'center',labelArrow:'none'},y:{domain:[0,yTop],grid:true,label:'Expected wrong share',labelArrow:'none'},
   alt:'The expected wrong share for each score changes when the best report changes. The line marks the selected weight.',
   keyboard:{data:points.filter(p=>p.share!==null),x:'w',y:'share',title:p=>`Score ${p.k?'B':'A'}: ${shareText(p.share)}, report ${p.report}, at weight ${compactWeight(p.w)}.`},
   marks:(c,P)=>[P.line(points,{x:'w',y:'share',z:'k',stroke:p=>c.crit[p.k],strokeWidth:2}),P.ruleX([state.w],{stroke:c.est,strokeWidth:2}),
    P.dot(focus,{x:'w',y:'share',fill:p=>c.crit[p.k],stroke:c.plotBg,r:3.5}),
    ...focus.map(p=>{
     const left=center?p.k===0:state.w>.5;
     return numText([p],{x:'w',y:'share',value:'share',format:shareText,dx:left?-7:7,dy:center||p.k===0?-9:-23,
      textAnchor:left?'end':'start',fill:c.critInk[p.k],stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke',fontWeight:600});
    })]});
  const pal=palette(ctx.root);
  legend.replaceChildren(...['Score A','Score B'].map((name,k)=>h('span',{},h('i',{class:'wpath-keyline',style:{'border-color':pal.crit[k]}}),name)));
  key.replaceChildren(...labelRows.map(r=>h('li',{'aria-current':r.index===active?.index?'true':null},num(ctx,r.code),'. ',r.report,' · ',num(ctx,r.N),' pairs')));
  const profile=model.base.profiles[0],ties=model.base.result.tieCount;
  const profileShares=(p)=>[num(ctx,p.evaluation.EoverN[0],shareText),' on score A and ',num(ctx,p.evaluation.EoverN[1],shareText),' on score B'];
  ctx.readout.set(['At w ',num(ctx,state.w,formatSetting),', ',...(ties>1?[num(ctx,ties),' reports tie. ']:[]),
   reportWords(profile.grade,model.data.ids),': ',num(ctx,profile.evaluation.N),' of ',num(ctx,M),' pairs',
   ...(active&&ties===1?[', optimal from ',num(ctx,active.wFrom,compactWeight),' to ',num(ctx,active.wTo,compactWeight)]:[]),
   '; expected wrong share ',...profileShares(profile),'; weighted risk ',num(ctx,profile.evaluation.risk,formatRisk),'.',
   ...model.base.profiles.slice(1).flatMap(p=>[' ',reportWords(p.grade,model.data.ids),': ',...profileShares(p),'.']),
   ...(state.cap==='all'?[' All ',num(ctx,model.base.result.family.sizeExact), ' reports searched.']:[])]);
 };
}
export function createWeightStepView(ctx,slots,{normalize=false}={}){
 const h=ctx.h,shareChart=h('div'),shareLegend=h('div');slots.shares.append(shareChart,shareLegend);let previousPath,previousLayout,shareHandle,countHandle;
 const moveWeight=(chart,w)=>{const line=chart.svg.querySelector('g[aria-label="rule"] line'),x=chart.scale('x').apply(w);if(line){line.setAttribute('x1',String(x));line.setAttribute('x2',String(x))}};
 return {render(model,state=model.state){
  const layout=[normalize?ctx.width():0,shareChart.clientWidth,slots.counts.clientWidth,ctx.doc.documentElement.getAttribute('data-theme'),ctx.root.getAttribute('data-prx-font-scale')].join('|');
  if(model.path!==previousPath||layout!==previousLayout){
  const {intervals,endpointTies}=model,shown=normalize?displayPath(model):model,steps=intervals.flatMap(r=>[{...r,w:r.wFrom},{...r,w:r.wTo}]),shares=steps.flatMap(r=>[{...r,k:0,share:r.EoverN[0]},{...r,k:1,share:r.EoverN[1]}]);
  const x={domain:[0,1],label:'weight on score A →',...(normalize&&ctx.width()<640?{ticks:[0,.2,.4,.6,.8,1]}:{})};
  shareHandle=plot(shareChart,{alt:'Each criterion expected wrong share is constant inside an exact weight interval; boundary dots retain intervals of zero or tiny width.',height:255,marginLeft:48,marginBottom:35,x,y:{domain:[0,1],label:'↑ expected wrong share among stated pairs'},
   table:{caption:'Exact weight intervals and expected wrong shares',rows:intervals,columns:[{label:'From weight',value:'wFrom',format:v=>weightText(v)},{label:'To weight',value:'wTo',format:v=>weightText(v)},{label:'Grade vector',value:'grade',format:v=>formatGrades(v)},{label:'Score A share',value:d=>d.EoverN[0],format:v=>formatShare(v)},{label:'Score B share',value:d=>d.EoverN[1],format:v=>formatShare(v)}]},
   marks:(c,P)=>[P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'3,3'}),...intervals.flatMap(r=>[0,1].map(k=>P.line([{w:r.wFrom,share:r.EoverN[k]},{w:r.wTo,share:r.EoverN[k]}],{x:'w',y:'share',stroke:c.crit[k],strokeWidth:2.5}))),P.dot(shares.filter(d=>d.share!==null),{x:'w',y:'share',fill:d=>c.crit[d.k],r:2.5})],
   keyboard:{data:shares.filter(d=>d.share!==null),x:'w',y:'share',title:d=>`Score ${d.k?'B':'A'}, weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: expected wrong share ${formatShare(d.share)}, report ${formatGrades(d.grade)}`}});
  const pal=palette(ctx.root);shareLegend.replaceChildren(h('p',{class:'wpath-legend prx-light-panel'},...['score A','score B'].map((label,k)=>h('span',{},h('i',{class:'wpath-keyline',style:{'border-color':pal.crit[k]}}),label))));
  countHandle=plot(slots.counts,{alt:'The number of stated pairs and grades changes only at exact weight boundaries.',height:255,marginLeft:43,marginBottom:35,x,y:{domain:[0,model.data.M],label:'↑ pairs stated'},
   table:{caption:'Exact weight intervals and disclosure counts',rows:intervals,columns:[{label:'From weight',value:'wFrom',format:v=>weightText(v)},{label:'To weight',value:'wTo',format:v=>weightText(v)},{label:'Pairs stated',value:'N',format:v=>formatCount(v)},{label:'Grades used',value:'G',format:v=>formatCount(v)}]},marks:(c,P)=>[P.ruleX([state.w],{stroke:c.plotFg,strokeDasharray:'3,3'}),...intervals.map(r=>P.line([{w:r.wFrom,N:r.N},{w:r.wTo,N:r.N}],{x:'w',y:'N',stroke:c.plotFg,strokeWidth:2.5})),P.dot(steps,{x:'w',y:'N',fill:c.plotFg,r:3})],keyboard:{data:steps,x:'w',y:'N',title:d=>`Weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: ${formatCount(d.N)} pairs stated, ${formatCount(d.G)} grades; report ${formatGrades(d.grade)}`}});
  const header=['From w','To w','Report','N','Grades','A: E/N','B: E/N','Risk at left','Risk at right'];
  const rawCaption='Every exact interval, including tiny and zero-length endpoint entries';
  const intervalTable=(rows,caption,tagged)=>h('table',{class:'wpath-table'},h('caption',{},caption),h('thead',{},h('tr',{},...header.map(text=>h('th',{scope:'col',text})))),
   h('tbody',{},...rows.map(r=>h('tr',{},...[[r.wFrom,weightText,`from-${r.index}`],[r.wTo,weightText,`to-${r.index}`],
    [r.grade,formatGrades,`path-grade-${r.index}`],[r.N,formatCount,`path-N-${r.index}`],[r.G,formatCount,`path-G-${r.index}`],
    ...r.EoverN.map((v,k)=>[v,formatShare,`path-share-${r.index}-${k}`]),[r.riskFrom,formatRisk,`path-riskFrom-${r.index}`],[r.riskTo,formatRisk,`path-riskTo-${r.index}`]]
    .map(([v,f,hook])=>h('td',{},num(ctx,v,f,tagged?hook:undefined)))))));
  const rawNote=h('p',{class:'wpath-note'},'Swipe or use the keyboard to scroll the interval and boundary tables. Tiny positive weights use scientific notation; every interval is retained. At a boundary, adjacent reports can both minimize risk.');
  const intervalRegion=table=>ctx.scrollRegion(h('div',{class:'wpath-scroll'},table),'All exact weight intervals');
  const rawOpen=slots.table.querySelector('details')?.open??false;
  slots.table.replaceChildren(...(shown.rawIntervals?[h('p',{class:'wpath-note'},'The first row records a tie at weight zero.'),
   intervalRegion(intervalTable(shown.intervals,'Displayed intervals with the endpoint tie at zero width',true))]:[rawNote,intervalRegion(intervalTable(intervals,rawCaption,true))]));
  const tieRows=endpointTies.flatMap((row,boundary)=>row.profiles.map((p,index)=>({boundary,index,w:row.w,tieCount:row.result.tieCount,tieTol:row.result.tieTol,...p})));
  const tieTable=h('table',{class:'wpath-table'},h('caption',{},'Exact optimization at every boundary: all retained tied reports'),h('thead',{},h('tr',{},...['Boundary w','Number best','Report','N','A: E/N','B: E/N','Weighted risk'].map(text=>h('th',{scope:'col',text})))),h('tbody',{},...tieRows.map(r=>h('tr',{},h('td',{},num(ctx,r.w,weightText)),h('td',{},num(ctx,r.tieCount)),h('td',{},num(ctx,r.grade,formatGrades,`boundary-grade-${r.boundary}-${r.index}`)),h('td',{},num(ctx,r.evaluation.N,formatCount,`boundary-N-${r.boundary}-${r.index}`)),h('td',{},num(ctx,r.evaluation.EoverN[0],formatShare,`boundary-share-${r.boundary}-${r.index}-0`)),h('td',{},num(ctx,r.evaluation.EoverN[1],formatShare,`boundary-share-${r.boundary}-${r.index}-1`)),h('td',{},num(ctx,r.evaluation.risk,formatRisk,`boundary-risk-${r.boundary}-${r.index}`))))));
  const ties=[ctx.scrollRegion(h('div',{class:'wpath-scroll'},tieTable),'All exact boundary reports'),h('p',{class:'wpath-note'},'Boundary optima use equal-risk tolerance ',num(ctx,model.path.tieTol,formatSci),'. Full tie counts are shown alongside every retained report.')];
  if(shown.rawIntervals){
   const raw=h('details',{},h('summary',{},'Raw engine intervals and boundary solves'),rawNote,intervalRegion(intervalTable(intervals,rawCaption,false)),...ties);
   raw.open=rawOpen;slots.table.append(raw);
  }else slots.table.append(...ties);
  previousPath=model.path;previousLayout=layout;
  }else{moveWeight(shareHandle,state.w);moveWeight(countHandle,state.w)}
  const peak=model.path.envelopeMaximum,shown=normalize?displayPath(model):model.path,zero=model.endpointTies[0];
  slots.summary.replaceChildren(h('p',{},'Current weight on score A: ',num(ctx,state.w,weightText,'current-weight'),'. Exact report changes at ',num(ctx,shown.breakpoints.length),' interior boundaries.',
   ...(normalize&&zero.result.tieCount>1?[' At w = ',num(ctx,zero.w,formatSetting),', ',num(ctx,zero.result.tieCount),' reports tie.']:[])),
   h('p',{},'The lower envelope reaches its largest risk ',num(ctx,peak.risk,formatRisk,'envelope-peak-risk'),' at weight ',...peak.intervals.flatMap((r,i)=>[i?'; ':'',num(ctx,r.from,weightText,`peak-from-${i}`),r.from===r.to?'':[' to ',num(ctx,r.to,weightText)]]),'.'),h('p',{class:'wpath-note'},'Risks at different weights use different losses. This envelope peak is not the worst risk of a fixed report and need not equal the deterministic minimax risk.'));
 }};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'weight-path',className:'wpath tws wpath-first',layout:'result-first',css:TWO_SCORES_CSS+WEIGHT_PATH_CSS+OVERVIEW_CSS,keys:TWO_SCORES_KEYS,build(ctx){
 const h=ctx.h,controls=createTwoScoreControls(ctx,{primary:true}),slots={};const panel=(key,title,wide=false)=>{slots[key]=h('div');return h('section',{class:`prx-panel ${wide?'wpath-wide':''}`,'aria-label':title},ctx.panelTitle(title),slots[key])};
 const overview=ctx.primaryGraphic(h('section',{class:'wpath-overview','aria-label':'Exact report intervals and expected wrong shares'}));
 ctx.charts.append(ctx.panelTitle('Best report across weights'),overview);
 const riskBox=ctx.disclosure({name:'risk',title:'Risk lines and the lower envelope'});
 riskBox.body.append(panel('risk','Every report’s risk line and the exact lower envelope',true),panel('summary','The exact path',true));
 const data=ctx.disclosure({name:'data',title:'Exact interval and boundary tables'});
 data.body.append(h('div',{class:'wpath-grid'},panel('shares','Error shares on each criterion'),panel('counts','How many pairs the report states'),panel('table','Reports on the exact intervals and boundaries',true)));
 const report=ctx.disclosure({name:'report',title:'This report in detail'});
 const drawOverview=createWeightOverview(ctx,overview),steps=createWeightStepView(ctx,slots,{normalize:true}),risk=createWeightedRiskView(ctx,slots.risk,{directLinePaths:true}),linked=createTwoScoresView(ctx,createTwoScoresSlots(ctx,report.body),{readout:'detail'});
 const progress=h('p',{class:'wpath-status','aria-hidden':'true'});ctx.controls.append(progress);
 let generation=0,cancelNext=null,dead=false,readyPath=null,readyCap=null;
 const finish=(model,state)=>{readyPath=model.path;readyCap=state.cap;progress.textContent='';ctx.root.setAttribute('aria-busy','false')};
 const stop=()=>{generation++;cancelNext?.();cancelNext=null};ctx.onCleanup(()=>{dead=true;stop();progress.textContent=''});
 return {render(state){
  stop();const epoch=generation;controls.render(state);const model=solveWeightPath(state),highlights=model.base.profiles.map((p,i)=>({grade:p.grade,label:i?'Another weighted best':'Weighted best at current weight',dash:i?'5,3':undefined}));
  if(model.path===readyPath||(state.cap!=='all'&&readyCap!=='all')){drawOverview(model,state);steps.render(model,state);risk.render(model.riskModel,state,highlights);linked.render(model.base,state);finish(model,state);return;}
  ctx.root.setAttribute('aria-busy','true');progress.textContent='Updating reports…';ctx.readout.set(['Updating the complete linked report views…']);
  const stages=[()=>drawOverview(model,state),()=>risk.prepare(model.riskModel),...risk.attachmentStages(model.riskModel),()=>steps.render(model,state),()=>risk.render(model.riskModel,state,highlights),()=>linked.render(model.base,state)];let stage=0;
  const next=()=>{if(dead||epoch!==generation)return;ctx.keepFocus(()=>stages[stage++]());if(dead||epoch!==generation)return;if(stage<stages.length)cancelNext=ctx.timeout(next,20);else{cancelNext=null;finish(model,state)}};
  cancelNext=ctx.timeout(next,20);
 }};
}})}
