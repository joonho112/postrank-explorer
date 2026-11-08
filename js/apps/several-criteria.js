// Marginal profiles and criterion orders. All summaries are public engine results.
import {createWidget} from '../shared/base.js';
import {plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatPercent,formatProb} from '../shared/format.js';
import {conflictPairs,expectedRank,normalInterval,pairDirection,scoreOrder} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';

export const CRITERIA_PROFILE_CSS=`
.sev .sev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:.8rem;min-width:0}
.sev .sev-section{min-width:0;margin:.9rem 0}.sev .sev-summary{font-weight:600;margin:.5rem 0}
.sev .sev-scroll{overflow-x:auto;max-width:100%;min-width:0}.sev table{border-collapse:collapse;font-size:.84rem;width:100%}
.sev th,.sev td{padding:.36rem .5rem;text-align:right;white-space:nowrap;border-bottom:1px solid var(--prx-plot-grid)}
.sev th:first-child,.sev td:first-child{text-align:left}.sev .sev-wide{min-width:40rem}.sev .sev-names{min-width:24rem}
.sev .sev-selected{outline:2px solid var(--prx-plot-focus);outline-offset:-2px}.sev .sev-hint{font-size:.84rem;color:var(--prx-fg-muted)}
.sev .sev-paper{background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.7rem;border-radius:.4rem;min-width:0}
.sev.prx-widget .sev-paper table{background:var(--prx-plot-bg);color:var(--prx-plot-fg)}
.sev .sev-paper .prx-panel-title{color:var(--prx-plot-fg)}.sev .sev-paper .sev-hint{color:var(--prx-plot-muted)}
.sev .sev-pair td,.sev .sev-pair th{white-space:normal;min-width:6rem}.sev .sev-pair{min-width:39rem}
.sev .sev-control-group{display:contents}.sev .sev-control-group[hidden]{display:none}.sev .sev-controls{display:flex;flex-wrap:wrap;gap:.6rem}
.sev .sev-controls .prx-select{max-width:100%}.sev .sev-controls select{max-width:100%}
.sev .sev-legend{display:flex;gap:.9rem;flex-wrap:wrap;font-size:.84rem}.sev .sev-legend i{display:inline-block;width:.9rem;height:.2rem;vertical-align:middle;margin-right:.3rem}
`;
const PROFILE_OVERVIEW_CSS=`
.sev .sev-overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}
.sev .sev-overview .sev-section{margin:0}
.sev.prx-widget details[data-prx-disclosure=intervals]{padding-inline:0}
.sev details[data-prx-disclosure=intervals] > summary{padding-inline:.8rem}
.sev details[data-prx-disclosure=intervals] .sev-grid{margin-inline:-1px}
.sev .sev-overview .sev-hint,.sev .sev-strip .sev-hint{margin:.25rem 0}
.sev .sev-strip{padding:.55rem .65rem}
.sev .sev-strip-row{display:grid;grid-template-columns:minmax(4.8rem,.55fr) minmax(2rem,1fr) minmax(3.5rem,.4fr) minmax(6rem,.8fr);gap:.45rem;align-items:center;font-size:.85rem;margin:.28rem 0}
.sev .sev-strip-axis{font-size:.78rem;color:var(--prx-plot-muted)}
.sev .sev-strip-scale{display:flex;justify-content:space-between}
.sev .sev-strip-track{position:relative;min-height:.52rem;background:var(--prx-plot-grid);border-radius:.1rem}
.sev .sev-strip-track::after{position:absolute;content:"";left:50%;top:-.17rem;bottom:-.17rem;border-left:1px dashed var(--prx-plot-fg)}
.sev .sev-strip-fill{display:block;height:.52rem;background:var(--prx-plot-fg);border-radius:.1rem}
.sev .sev-strip-error{font-weight:700;font-variant-numeric:tabular-nums}
.sev .sev-overview-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.45fr);gap:.5rem}
.sev .sev-overview-controls select{max-width:100%;width:100%}
@media(max-width:480px){.sev .sev-overview-controls{grid-template-columns:minmax(0,1fr)}}
.sev .sev-map-note{font-size:.84rem;margin:.25rem 0;color:var(--prx-fg-muted)}
.sev .sev-paper .sev-map-note{color:var(--prx-plot-muted)}
@media(max-width:650px){
 .sev .sev-overview{grid-template-columns:minmax(0,1fr)}
 .sev .sev-strip-row{grid-template-columns:3.35rem minmax(1.5rem,1fr) 4.65rem 4rem;gap:.26rem;font-size:.78rem}
 .sev .sev-strip-row > :last-child{overflow-wrap:normal}
}
`;
export const CRITERIA_PROFILE_KEYS={
 data:{type:'choice',values:['thirty','six'],value:'thirty'},
 level:{type:'choice',values:[90,95],value:90},
 order:{type:'choice',values:['criterion','aligned'],value:'criterion'},
 orientB:{type:'choice',values:['higher','lower'],value:'higher'},
 pair:{type:'string',value:'auto'},unit:{type:'string',value:'auto'},
};
const cache=new Map();
const asName=(ctx,value)=>ctx.h('span',{'data-prx-name':'',text:value});
const num=(ctx,value,kind='decimal',hook)=>{const fmt=kind==='prob'?formatProb(value):kind==='count'?formatCount(value):kind==='percent'?formatPercent(value):formatDecimal(value,{digits:3}),n=ctx.num(value,fmt);if(hook)n.dataset.prxReadout=hook;return n;};
const pairKey=(d,i,j)=>`${d.ids[i]},${d.ids[j]}`;
export function preferredCriterionDirection({eIJ,eJI}){
 const gap=eIJ-eJI,tolerance=1e-12; // The default in the engine's opposing-pair calculation.
 return gap < -tolerance?'forward':gap > tolerance?'reverse':null;
}
export function isCriterionPairKey(d,key){const parts=String(key).split(',');return key==='auto'||parts.length===2&&parts[0]!==parts[1]&&parts.every(id=>d.ids.includes(id));}
export function resolveCriterionPair(d,key='auto'){
 const parts=String(key).split(','),i=d.ids.indexOf(parts[0]),j=d.ids.indexOf(parts[1]);
 return i>=0&&j>=0&&i!==j?[i,j]:d.key==='six'?[1,2]:[0,1];
}
export function criterionProfileModel(state={}){
 const key=state.data??'thirty',level=state.level??90,orientB=state.orientB??'higher',id=`${key}|${level}|${orientB}`;
 let base=cache.get(id);
 if(!base){
  const data=criteriaData(key),orient=data.criteria.map((_,k)=>key==='six'&&k===1&&orientB==='lower'?-1:1),means=data.means.map(row=>row.map((v,k)=>orient[k]*v)),sds=data.sds;
  const E={ids:data.ids,criteria:data.criteria,e:data.E.e.map((m,k)=>m.map((row,i)=>row.map((v,j)=>orient[k]===1?v:m[j][i])))};
  const profiles=data.criteria.map((criterion,k)=>{const mean=means.map(r=>r[k]),sd=sds.map(r=>r[k]);return {criterion,mean,sd,intervals:mean.map((m,i)=>normalInterval(m,sd[i],level/100)),scoreOrder:scoreOrder(mean,{direction:'descending',ids:data.ids}),expectedRank:expectedRank({ids:data.ids,criteria:[criterion],e:[E.e[k]]})};});
  base={data,E,means,sds,orient,profiles,conflicts:conflictPairs(E),expectedRank:expectedRank(E)};cache.set(id,base);
 }
 const {data,profiles,E,means,sds}=base,[i,j]=resolveCriterionPair(data,state.pair),unit=data.ids.indexOf(state.unit),chosen=unit<0?i:unit;
 const pair={i,j,criteria:data.criteria.map((criterion,k)=>({criterion,iMean:means[i][k],iSd:sds[i][k],jMean:means[j][k],jSd:sds[j][k],iInterval:profiles[k].intervals[i],jInterval:profiles[k].intervals[j],eIJ:E.e[k][i][j],eJI:E.e[k][j][i],piIJ:pairDirection(means[i][k],sds[i][k],means[j][k],sds[j][k]),piJI:pairDirection(means[j][k],sds[j][k],means[i][k],sds[i][k]),equality:0}))};
 return {...base,pair,unit:chosen,order:state.order??'criterion',level};
}
function table(ctx,headers,rows,className=''){
 return ctx.h('table',{class:className},ctx.h('thead',{},ctx.h('tr',{},...headers.map(s=>ctx.h('th',{scope:'col'},s)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(v=>ctx.h('td',{},v))))));
}
function region(ctx,parent,label){const root=ctx.h('div',{class:'sev-scroll'});ctx.scrollRegion(root,label);parent.append(root);return root;}
function names(svg){for(const t of svg.querySelectorAll('text'))if(/^(site\d+|[A-F])$/.test(t.textContent))t.setAttribute('data-prx-name','');}
export function createCriterionProfileSlots(ctx,parent=ctx.charts){
 const summary=ctx.h('div',{class:'sev-summary'}),profiles=ctx.h('div',{class:'sev-grid sev-section'}),crossings=ctx.h('div',{class:'sev-section'}),pair=ctx.h('div',{class:'sev-section sev-paper'}),unit=ctx.h('div',{class:'sev-section sev-paper'}),conflicts=ctx.h('div',{class:'sev-section sev-paper'});
 parent.append(summary,profiles,crossings,pair,unit,conflicts);return {summary,profiles,crossings,pair,unit,conflicts};
}
export function createCriterionPairView(ctx,slot){return {render(model){const {data:d,pair}=model;
  slot.replaceChildren(ctx.panelTitle('One proposed direction, every criterion'),ctx.h('p',{},'Stating ',asName(ctx,d.ids[pair.i]),' above ',asName(ctx,d.ids[pair.j]),' is wrong when its true oriented value is less than or equal to the other’s. A strict statement also counts as wrong at latent equality.'),ctx.h('p',{class:'sev-hint'},'Wide tables scroll within this panel; focus the table region and use the arrow keys.'));
  region(ctx,slot,'Selected-pair probabilities').append(table(ctx,['Criterion','Error: first above second','Error: second above first','Pr(first truly higher)','Pr(second truly higher)','Pr(equality)'],pair.criteria.map((r,k)=>[d.criterionLabels[k],num(ctx,r.eIJ,'prob',`pair-${k}-eij`),num(ctx,r.eJI,'prob',`pair-${k}-eji`),num(ctx,r.piIJ,'prob',`pair-${k}-piij`),num(ctx,r.piJI,'prob',`pair-${k}-piji`),num(ctx,r.equality,'prob',`pair-${k}-equal`)]),'sev-pair'));
}};}
function plotSelection(ctx,figure,onSelect,onFocus){
 if(!onSelect)return onFocus?{onFocus}:{};
 let focused;
 ctx.listen(figure,'keydown',event=>{
  if(!event.target.closest?.('.prx-kbd-point')||!['Enter',' '].includes(event.key)||!focused)return;
  event.preventDefault();
  onSelect(focused);
 });
 return {pointer:true,onSelect,onFocus(row){focused=row;onFocus?.(row);}};
}
export function createCriterionConflictView(ctx,slot,{onPair,onSelectPair,listSlot=slot}={}){
 const {h}=ctx;
 const header=h('div'),map=h('div',{class:'sev-conflict-map'}),mapRegion=h('div',{class:'sev-scroll'},map),listRoot=h('div');
 if(onSelectPair)ctx.listen(listRoot,'click',event=>{
  const selected=event.target.closest('[data-sev-conflict-pair]');
  if(selected)onSelectPair(selected.dataset.sevConflictPair);
 });
 if(listSlot===slot)slot.append(header,mapRegion,listRoot);
 else {slot.append(header,mapRegion);listSlot.append(listRoot);}
 ctx.scrollRegion(mapRegion,'Complete opposing-pair map; scroll horizontally to read all unit labels');
 let choosePair,keepInView;
 const selection=plotSelection(ctx,map,onSelectPair?row=>choosePair(row):null,row=>keepInView(row));
 return {render(model){const {data:d,pair,conflicts}=model;
  const wide=d.n>6,mapWidth=wide?d.n*30+130:undefined;
  const mapHint=listSlot===slot?
   (wide?'All unit labels are retained. The map scrolls horizontally; focus its region and use the arrow keys. The complete list follows.':'The complete list follows the map. Choose any pair in the control above to inspect its probabilities.'):
   (wide?'All unit labels are retained. The map scrolls horizontally; focus its region and use the arrow keys. Find the complete list in Data and exact values.':'Choose any pair in the control above to inspect its probabilities. Find the complete list in Data and exact values.');
  header.replaceChildren(ctx.panelTitle('Every pair with opposing preferred directions'),ctx.h('p',{},'A criterion prefers the direction with smaller error than its reverse. A pair appears here when some criteria prefer each side. This compares the two errors, not an error with a fixed cutoff.'),ctx.h('p',{class:'sev-hint'},mapHint));
  if(onSelectPair)header.append(h('p',{class:'sev-map-note'},'Select a dot to inspect its pair. Use the arrow keys to browse, then Enter to select.'));
  map.style.width=map.style.minWidth=wide?`${mapWidth}px`:'';
  if(listSlot!==slot)listRoot.replaceChildren(ctx.panelTitle('Complete opposing-pair list'));
  else listRoot.replaceChildren();
  choosePair=r=>onSelectPair(pairKey(d,r.i,r.j));
  keepInView=r=>{const active=ctx.doc.activeElement;if(wide&&map.contains(active)){const point=active.getBoundingClientRect(),box=mapRegion.getBoundingClientRect();mapRegion.scrollLeft+=(point.left+point.right-box.left-box.right)/2;const tip=map.querySelector('.prx-kbd-tip');if(tip){tip.style.maxWidth=`${Math.max(1,mapRegion.clientWidth-32)}px`;tip.style.left=`${mapRegion.scrollLeft+8}px`;tip.style.transform=tip.style.transform.replace(/^translate\([^,]+,/, 'translate(0,');}}onPair?.(pairKey(d,r.i,r.j));};
  const dots=conflicts.pairs.map(r=>({...r,first:d.ids[r.i],second:d.ids[r.j]}));
  plot(map,{...(wide?{width:mapWidth}:{}),height:Math.max(230,d.n*14+85),marginLeft:d.n<=6?35:70,marginBottom:d.n<=6?35:85,marginTop:12,x:{domain:d.ids,label:'Second unit',tickRotate:d.n<=6?0:-60},y:{domain:d.ids,label:'First unit'},alt:'A dot marks every unordered pair whose criteria prefer opposite directions. Larger outlined dots mark the selected pair.',table:dots.map(r=>({first:r.first,second:r.second,firstPreferredOn:r.iAbove.map(k=>d.criterionLabels[k]).join(', '),secondPreferredOn:r.jAbove.map(k=>d.criterionLabels[k]).join(', ')})),keyboard:{data:dots,x:'second',y:'first',title:r=>`${r.first} versus ${r.second}: first preferred on ${r.iAbove.map(k=>d.criterionLabels[k]).join(', ')}; second preferred on ${r.jAbove.map(k=>d.criterionLabels[k]).join(', ')}.`,...selection},marks:(c,P)=>[P.dot(dots,{x:'second',y:'first',fill:c.plotFg,r:r=>((r.i===pair.i&&r.j===pair.j)||(r.i===pair.j&&r.j===pair.i))?6:3,stroke:r=>((r.i===pair.i&&r.j===pair.j)||(r.i===pair.j&&r.j===pair.i))?c.plotFocus:c.plotBg,strokeWidth:2}),P.tip(dots,P.pointer({x:'second',y:'first',title:r=>`${r.first} / ${r.second}`}))]});names(map);
  const list=table(ctx,['Pair','First preferred on','Second preferred on'],dots.map(r=>{
   const label=[asName(ctx,r.first),' / ',asName(ctx,r.second)],key=pairKey(d,r.i,r.j);
   const active=r.i===pair.i&&r.j===pair.j||r.j===pair.i&&r.i===pair.j;
   const cell=onSelectPair?h('button',{type:'button',class:'prx-btn','data-sev-conflict-pair':key,
    'data-prx-focus-key':`conflict-list:${key}`,'aria-current':active?'true':undefined},...label):h('span',{},...label);
   return [cell,r.iAbove.map(k=>d.criterionLabels[k]).join(', '),r.jAbove.map(k=>d.criterionLabels[k]).join(', ')];
  }),'sev-names');region(ctx,listRoot,'Complete opposing-pair list').append(list);
}};}
export function createCriterionProfileView(ctx,slots,{onPair,onUnit,onSelectPair,onSelectUnit,crossingHeadroom=false}={}){
 const pairView=createCriterionPairView(ctx,slots.pair),conflictView=createCriterionConflictView(ctx,slots.conflicts,{onPair,onSelectPair,listSlot:slots.conflictList});
 const crossingHeading=ctx.panelTitle('The same units, each criterion’s own order');
 const crossingGuide=ctx.h('p',{class:'sev-hint'},'Connecting lines follow unit identities across posterior-mean orders. Crossings concern order, not a shared score scale or an optimized grade.');
 const selectGuide=onSelectUnit?ctx.h('p',{class:'sev-map-note','data-sev-crossing-guide':''},'Select two unit dots in the order you want to compare them.'):null;
 const crossing=ctx.h('div');
 const selection=plotSelection(ctx,crossing,onSelectUnit?row=>onSelectUnit(row.id):null);
 slots.crossings.append(crossingHeading,crossingGuide,...(selectGuide?[selectGuide]:[]),crossing);
 return {render(model,state={}){
  const {data:d,profiles,pair,unit,conflicts}=model,selected=new Set([unit,pair.i,pair.j]);
  slots.summary.replaceChildren(num(ctx,d.n,'count','units'),' units · ',num(ctx,d.K,'count','criteria'),' criteria · ',num(ctx,conflicts.count,'count','conflicts'),' of ',num(ctx,d.M,'count','pairs'),' pairs prefer opposite directions.');
  slots.profiles.replaceChildren();
  const profilePanels=profiles.map(()=>{const panel=ctx.h('div'),fig=ctx.h('div');slots.profiles.append(panel);return {panel,fig};});
  profiles.forEach((p,k)=>{
   const {panel,fig}=profilePanels[k],rows=d.ids.map((id,i)=>({id,i,mean:p.mean[i],sd:p.sd[i],...p.intervals[i],expectedRank:p.expectedRank[i]})),order=model.order==='aligned'?d.ids:p.scoreOrder.order.map(i=>d.ids[i]);
   panel.append(ctx.panelTitle(d.criterionLabels[k]),ctx.h('p',{class:'sev-hint'},num(ctx,model.level/100,'percent'),' marginal posterior intervals; dots are means. Higher oriented value means higher priority.'),fig);
   plot(fig,{height:Math.max(220,d.n*19+65),marginLeft:d.key==='six'?35:72,marginRight:20,marginBottom:42,x:{label:d.key==='six'&&k===1&&model.orient[k]<0?'Negative score B (reversed target)':d.criterionLabels[k],grid:true},y:{domain:order,label:null},alt:`Marginal ${d.criterionLabels[k]} posterior intervals, ordered ${model.order==='aligned'?'by the common unit labels':'by this criterion’s posterior mean'}. Every criterion uses its own score scale.`,table:rows,keyboard:{data:rows,x:'mean',y:'id',title:r=>`${r.id}: mean ${formatDecimal(r.mean,{digits:3})}, SD ${formatDecimal(r.sd,{digits:3})}, interval ${formatDecimal(r.lower,{digits:3})} to ${formatDecimal(r.upper,{digits:3})}, expected rank ${formatDecimal(r.expectedRank,{digits:3})}.`,...(onUnit?{onFocus:r=>onUnit(r.id)}:{})},marks:(c,P)=>[P.ruleY(rows,{y:'id',x1:'lower',x2:'upper',stroke:c.crit[k],strokeWidth:2}),P.dot(rows,{x:'mean',y:'id',fill:c.crit[k],r:r=>selected.has(r.i)?5:3,stroke:r=>r.i===unit?c.plotFocus:c.plotBg,strokeWidth:2}),P.tip(rows,P.pointer({x:'mean',y:'id',title:r=>`${r.id}: mean ${formatDecimal(r.mean,{digits:3})}, SD ${formatDecimal(r.sd,{digits:3})}`}))]});names(fig);
  });
  const rows=profiles.flatMap((p,k)=>p.scoreOrder.order.map((i,position)=>({id:d.ids[i],i,k,criterion:d.criterionLabels[k],position:position+1,mean:p.mean[i]})));
  plot(crossing,{height:Math.max(240,d.n*13+60),...(onSelectUnit||crossingHeadroom?{marginTop:39}:{}),marginLeft:35,marginRight:35,marginBottom:35,x:{domain:d.criterionLabels,label:null},y:{reverse:true,label:'Position in posterior-mean order',ticks:d.key==='six'?d.n:6,tickFormat:v=>formatCount(v)},alt:'Lines connect each unit across criterion-specific posterior-mean orders. A highlighted line follows the selected unit; the selected pair has larger points.',table:rows,keyboard:{data:rows,x:'criterion',y:'position',title:r=>`${r.id} on ${r.criterion}: position ${r.position}; posterior mean ${formatDecimal(r.mean,{digits:3})}.`,...selection},marks:(c,P)=>[P.line(rows,{x:'criterion',y:'position',z:'id',stroke:r=>r.i===unit?c.plotFocus:c.plotMuted,strokeWidth:r=>r.i===unit?3:1,strokeOpacity:r=>r.i===unit?1:.55}),P.dot(rows,{x:'criterion',y:'position',fill:r=>c.crit[r.k],r:r=>selected.has(r.i)?5:2.5}),P.text(rows.filter(r=>selected.has(r.i)),{x:'criterion',y:'position',text:'id',dy:-9,fill:c.plotFg,fontWeight:700})]});names(crossing);
  pairView.render(model);
  slots.unit.replaceChildren(ctx.panelTitle('The supplied marginal distributions'),ctx.h('p',{},'Selected unit: ',asName(ctx,d.ids[unit]),'. Each row is one Normal marginal, not a sampled joint state. The columns keep their own units.'),ctx.h('p',{class:'sev-hint'},'Scroll this table horizontally for interval ends and expected ranks. Expected rank is the unit’s average position under that criterion’s posterior, with the highest priority first.'));
  const unitRows=profiles.flatMap((p,k)=>d.ids.map((id,i)=>[asName(ctx,id),d.criterionLabels[k],num(ctx,p.mean[i],'decimal',`mean-${k}-${i}`),num(ctx,p.sd[i],'decimal',`sd-${k}-${i}`),num(ctx,p.intervals[i].lower,'decimal',`lower-${k}-${i}`),num(ctx,p.intervals[i].upper,'decimal',`upper-${k}-${i}`),num(ctx,p.expectedRank[i],'decimal',`rank-${k}-${i}`)]));
  const full=table(ctx,['Unit','Criterion','Mean','SD','Interval lower','Interval upper','Expected rank'],unitRows,'sev-wide');[...full.tBodies[0].rows].forEach((tr,i)=>{if(i%d.n===unit)tr.classList.add('sev-selected');});region(ctx,slots.unit,'All marginal distributions').append(full);
  conflictView.render(model);
 }};
}
export function createCriterionProfileControls(ctx,{settings}={}){
 const main=ctx.h('div',{class:settings?'sev-overview-controls':'sev-controls'}),data=ctx.select({label:'Supplied data',name:'data',options:[{value:'thirty',label:'Thirty sites · three criteria'},{value:'six',label:'Six sites · two scores'}],onChange:v=>ctx.set({data:v,pair:'auto',unit:'auto'})}),level=ctx.segmented({label:'Marginal interval level',name:'level',options:[90,95].map(v=>({value:v,label:[num(ctx,v/100,'percent')]})),onChange:v=>ctx.set({level:v})}),order=ctx.select({label:'Align rows',name:'order',options:[{value:'criterion',label:'Each criterion’s mean order'},{value:'aligned',label:'Common unit labels'}],onChange:v=>ctx.set({order:v})}),orientation=ctx.select({label:'Score B priority',name:'orientB',options:[{value:'higher',label:'Higher score B → higher priority'},{value:'lower',label:'Lower score B → higher priority'}],onChange:v=>ctx.set({orientB:v})});
 main.append(data.root);
 (settings??main).append(level.root,order.root,orientation.root);
 const controls={};
 for(const key of ['six','thirty']){const d=criteriaData(key),pairs=d.ids.flatMap((id,i)=>d.ids.flatMap((id2,j)=>i===j?[]:[{value:pairKey(d,i,j),label:`${id} above ${id2}`}])),pair=ctx.select({label:'Proposed pair direction',name:`pair-${key}`,options:[{value:'auto',label:'Source example pair'},...pairs],onChange:v=>ctx.set({pair:v})}),unit=ctx.select({label:'Follow one unit',name:`unit-${key}`,options:[{value:'auto',label:'First unit of the pair'},...d.ids.map(id=>({value:id,label:id}))],onChange:v=>ctx.set({unit:v})}),root=ctx.h('div',{class:'sev-control-group'},pair.root,settings?null:unit.root);main.append(root);if(settings)settings.append(unit.root);controls[key]={root,pair,unit};}
 ctx.controls.append(main);return {render(state){data.set(state.data);level.set(state.level);order.set(state.order);orientation.set(state.orientB);orientation.root.hidden=state.data!=='six';for(const key of ['six','thirty']){controls[key].root.hidden=key!==state.data;if(settings)controls[key].unit.root.hidden=key!==state.data;controls[key].pair.set(state.pair);controls[key].unit.set(state.unit);}}};
}
function criterionPairStrip(ctx,slot,model){
 const {h}=ctx,{data,pair}=model;
 const preferred=r=>{const direction=preferredCriterionDirection(r);return direction?data.ids[direction==='forward'?pair.i:pair.j]:null;};
 slot.replaceChildren(ctx.panelTitle('Chance the stated direction is wrong'),
  h('div',{class:'sev-strip-row sev-strip-axis'},h('span',{},'Criterion'),
    h('span',{class:'sev-strip-scale'},...([0,.5,1].map(v=>num(ctx,v,'prob')))),h('span',{},'Error'),h('span',{},'Favors')),
  ...pair.criteria.map((r,k)=>h('div',{class:'sev-strip-row'},h('strong',{},data.criterionLabels[k]),
    h('span',{class:'sev-strip-track','aria-hidden':'true'},h('span',{class:'sev-strip-fill',style:`width:${100*r.eIJ}%`})),
    h('span',{class:'sev-strip-error'},num(ctx,r.eIJ,'prob')),preferred(r)?asName(ctx,preferred(r)):h('span',{},'Neither'))));
 if(model.level===95)slot.append(h('p',{class:'sev-hint'},'Marginal intervals: ',num(ctx,model.level/100,'percent'),'.'));
}

export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:'several-criteria',className:'sev',css:CRITERIA_PROFILE_CSS+PROFILE_OVERVIEW_CSS,layout:'result-first',keys:CRITERIA_PROFILE_KEYS,build(ctx){
  const {h}=ctx;
  const settings=ctx.disclosure({name:'settings',title:'Settings',placement:'controls'});
  const controls=createCriterionProfileControls(ctx,{settings:settings.body});
  const intervals=ctx.disclosure({name:'intervals',title:'Intervals by criterion'});
  const data=ctx.disclosure({name:'data',title:'Data and exact values'});
  const slots=createCriterionProfileSlots(ctx);
  const strip=h('section',{class:'sev-paper sev-strip'});
  const overview=h('div',{class:'sev-overview'},slots.crossings,slots.conflicts);
  const levelNote=h('p',{class:'sev-hint'});
  ctx.charts.append(strip,overview,levelNote);
  ctx.primaryGraphic(strip);
  const main=ctx.controls.querySelector('.sev-overview-controls');
  ctx.controls.prepend(main);
  ctx.primaryControl(main);
  intervals.body.append(slots.profiles);
  slots.conflictList=h('div',{class:'sev-paper'});
  data.body.append(slots.summary,slots.pair,slots.unit,slots.conflictList);
  let firstUnit=null;
  const resetCrossing=()=>{firstUnit=null;const guide=slots.crossings.querySelector('[data-sev-crossing-guide]');guide.textContent='Select two unit dots in the order you want to compare them.';};
  const selectPair=pair=>{resetCrossing();ctx.set({pair});};
  const view=createCriterionProfileView(ctx,slots,{onSelectPair:selectPair,onSelectUnit(id){
   if(firstUnit&&firstUnit!==id){selectPair(`${firstUnit},${id}`);return;}
   firstUnit=id;
   slots.crossings.querySelector('[data-sev-crossing-guide]').replaceChildren('First unit: ',asName(ctx,id),'. Select a different unit to complete the pair.');
  }});
  return {render(state,info={}){
   const model=criterionProfileModel(state),correction={};
   if(!isCriterionPairKey(model.data,state.pair))correction.pair='auto';
   if(state.unit!=='auto'&&!model.data.ids.includes(state.unit))correction.unit='auto';
   if(Object.keys(correction).length)ctx.set(correction);
   if(info.changed?.some(key=>key==='data'||key==='pair')||info.reason==='preset')resetCrossing();
   controls.render(state);view.render(model,state);criterionPairStrip(ctx,strip,model);
   levelNote.textContent=model.data.key==='thirty'
    ?'Illustrative names: poverty, free or reduced-price lunch (frl), and food assistance (snap). The synthetic snap criterion is designed to run against the other two.'
    :'These fictional scores illustrate how criterion directions can differ.';
   const {data,pair,conflicts}=model;
   const opposing=conflicts.pairs.some(r=>(r.i===pair.i&&r.j===pair.j)||(r.i===pair.j&&r.j===pair.i));
   ctx.readout.set([asName(ctx,data.ids[pair.i]),' above ',asName(ctx,data.ids[pair.j]),': wrong with probability ',
    ...pair.criteria.flatMap((r,k)=>[k?', ':'',num(ctx,r.eIJ,'prob',`readout-e-${k}`),' on ',data.criterionLabels[k]]),'. ',
    opposing?'This is one of ':'Across the data, ',num(ctx,conflicts.count,'count','readout-conflicts'),' of ',num(ctx,data.M,'count'),' pairs ',
    opposing?'with opposing preferred directions.':'have opposing preferred directions.']);
   ctx.caption.replaceChildren('Synthetic: no real units, observations or fitted models. Data license CC BY ',ctx.num(4,formatDecimal(4,{digits:1})),'. Marginal profiles; larger oriented values mean higher priority. Mean orders are not optimized grade reports.');
  }};
 }});
}
