// A complete retained state moves as a unit. Numerical counts and shares are drawErrors output.
import {createWidget} from '../shared/base.js';
import {hiddenTable,plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatShare} from '../shared/format.js';
import {drawErrors,scoreOrder} from '../pr-core.js';
import {toyInput,toyJointDraws} from '../shared/criteria-data.js';

export const CONFIG=Object.freeze({name:'draws-to-errors',pairs:[[0,1],[0,2],[1,2]],symbols:['circle','square','triangle']});
const cache=new Map();
function prefixModels(input){return input.draws.map((_,s)=>{const E=drawErrors(input.draws.slice(0,s+1),{ids:input.ids,criteria:input.criteria});return {prefix:E.S,E,counts:E.counts};});}
/** Approved input reindexing followed only by public count/order calls; no regenerated source draws. */
export function toyDrawModel(state){
 const source=toyJointDraws(),unit=source.ids.indexOf(state.unit),allUnits=state.mode==='all',shift=state.mode==='original'?0:state.shift,key=JSON.stringify([unit,allUnits,shift]);
 if(!cache.has(key)){if(cache.size>40)cache.clear();const input=toyInput({prefix:source.S,shift,unit,allUnits});cache.set(key,{input,prefixes:prefixModels(input)});}
 const current=cache.get(key),originalKey=JSON.stringify([unit,false,0]);
 if(!cache.has(originalKey)){const input=toyInput({prefix:source.S,shift:0,unit});cache.set(originalKey,{input,prefixes:prefixModels(input)});}
 const original=cache.get(originalKey),draw=state.draw-1,selectedState=current.input.draws[draw],E=drawErrors([selectedState],{ids:source.ids,criteria:source.criteria}),pair=CONFIG.pairs[Number(state.pair)],direction=state.reverse?[pair[1],pair[0]]:pair;
 const orders=source.criteria.map((_,k)=>scoreOrder(selectedState.map(row=>row[k]),{ids:source.ids}));
 return {source,input:current.input,prefixes:current.prefixes,original:original.prefixes,retained:current.prefixes[state.prefix-1],baseline:original.prefixes[state.prefix-1],selected:{draw,state:selectedState,orders,E,counts:E.counts},direction,criterion:source.criteria.indexOf(state.criterion),unit,allUnits,state};
}
export const DRAWS_CSS=`
.dte .dte-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35rem 1rem;width:100%}
.dte .dte-controls select{max-width:100%;width:100%}
.dte .dte-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;align-items:start}
.dte .dte-orders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.dte .dte-current{border-left:3px solid var(--prx-plot-fg);padding-left:.6rem}
.dte .dte-note,.dte .dte-order{font-size:.88rem;margin:.4rem 0}
.dte .dte-table{max-width:100%;min-width:0;overflow-x:auto;margin:.6rem 0}
.dte .dte-table table{border-collapse:collapse;font-size:.82rem;width:100%;min-width:30rem}
.dte .dte-table th,.dte .dte-table td{padding:.3rem .45rem;white-space:nowrap;text-align:left;border-bottom:1px solid var(--prx-border)}
.dte .dte-source table{min-width:52rem}
.dte .dte-source tbody tr[data-selected]{outline:2px solid var(--prx-focus);outline-offset:-2px}
.dte .dte-legend{background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.35rem}
.dte .dte-line{width:1.5rem;border-top:2px solid var(--prx-plot-fg);display:inline-block;vertical-align:middle}
.dte .dte-dash{border-top-style:dashed;border-color:var(--prx-plot-muted)}
.dte .dte-step{font-weight:700}
@media(max-width:43em){.dte .dte-controls,.dte .dte-grid,.dte .dte-orders{grid-template-columns:minmax(0,1fr)}}
`;
const decimal=value=>formatDecimal(value,{digits:4});
function n(ctx,value,format,key){const node=ctx.num(value,format(value));if(key)node.setAttribute('data-prx-readout',key);return node;}
function name(ctx,value){return ctx.h('span',{'data-prx-name':''},value);}
function columns(cols){return cols.map(c=>({...c,...(c.format?{format:v=>c.format(v)}:{})}));}
function table(ctx,caption,cols,rows){const t=hiddenTable(ctx.doc,{caption,columns:columns(cols),rows,visible:true});t.classList.add('dte-table');ctx.scrollRegion(t,caption);rows.forEach((row,i)=>cols.forEach((c,j)=>{const cell=t.querySelectorAll('tbody tr')[i].cells[j];if(c.name)cell.setAttribute('data-prx-name','');if(c.hook)cell.setAttribute('data-prx-readout',c.hook(row));}));return t;}
function directionNodes(ctx,ids,[i,j]){return [name(ctx,ids[i]),' above ',name(ctx,ids[j])];}
function curveRows(model){const [i,j]=model.direction,k=model.criterion;return model.prefixes.map((r,s)=>({prefix:r.prefix,count:r.counts[k][i][j],share:r.E.e[k][i][j],baseline:model.original[s].E.e[k][i][j],originalCount:model.original[s].counts[k][i][j]}));}

export function mountWidget(el,spec={}){return createWidget(el,spec,{name:CONFIG.name,className:'dte',css:DRAWS_CSS,
 keys:{prefix:{type:'integer',min:1,max:32,value:32},draw:{type:'integer',min:1,max:32,value:1},mode:{type:'choice',values:['original','unit','all'],value:'original'},unit:{type:'choice',values:['001','site-B','site C'],value:'site-B'},shift:{type:'integer',min:0,max:32,value:0},pair:{type:'choice',values:['0','1','2'],value:'0'},reverse:{type:'boolean',value:false},criterion:{type:'choice',values:['need_A','need_B'],value:'need_A'}},
 build(ctx){const {h}=ctx,source=toyJointDraws(),control=h('div',{class:'dte-controls'});
  const prefix=ctx.slider({label:'Retained states for estimates',...ctx.key('prefix'),format:formatCount,onInput:prefix=>ctx.set({prefix})}),draw=ctx.slider({label:'Whole state to inspect',...ctx.key('draw'),format:formatCount,onInput:draw=>ctx.set({draw})}),shift=ctx.slider({label:'Cyclic shift of the full input',...ctx.key('shift'),format:formatCount,onInput:shift=>ctx.set({shift})});
  const mode=ctx.select({label:'Pairing of state rows',name:'mode',options:[{value:'original',label:'Original whole states'},{value:'unit',label:'One unit’s whole vector'},{value:'all',label:'All unit vectors together'}],onChange:mode=>ctx.set({mode})}),unit=ctx.select({label:'Unit to shift',name:'unit',options:source.ids.map(id=>({value:id,label:id})),onChange:unit=>ctx.set({unit})}),pair=ctx.select({label:'Pair to count',name:'pair',options:CONFIG.pairs.map(([i,j],p)=>({value:String(p),label:`${source.ids[i]} / ${source.ids[j]}`})),onChange:pair=>ctx.set({pair})}),criterion=ctx.select({label:'Criterion in the running-share chart',name:'criterion',options:source.criteria.map(c=>({value:c,label:c})),onChange:criterion=>ctx.set({criterion})}),reverse=ctx.toggle({label:'Reverse the direction being counted',name:'reverse',onChange:reverse=>ctx.set({reverse})});
  for(const option of [...unit.input.options,...pair.input.options])option.setAttribute('data-prx-name','');
  control.append(prefix.root,draw.root,mode.root,unit.root,shift.root,pair.root,criterion.root,reverse.root);ctx.controls.append(control,ctx.readout.node);
  const wholeTitle=h('div'),orderSlots=[h('div'),h('div')],stateTable=h('div'),curveSlot=h('div'),curveNote=h('p',{class:'dte-note'}),curveTable=h('div'),pairTable=h('div'),sourceTable=h('div'),pairSummary=h('p',{class:'dte-note'}),stateNote=h('p',{class:'dte-note'});
  ctx.charts.append(h('section',{class:'prx-panel'},ctx.panelTitle('One whole state, every unit and both criteria'),wholeTitle,stateNote,h('p',{class:'dte-note dte-legend'},'Filled marks: current input. Hollow marks: original row. Lines connect the two values.'),h('div',{class:'dte-orders'},...orderSlots),h('p',{class:'dte-note'},'Tables scroll horizontally. Focus a table and use the arrow keys, or swipe.'),stateTable),
   h('div',{class:'dte-grid'},h('section',{class:'prx-panel'},ctx.panelTitle('Count wrong directions through the retained states'),curveSlot,h('div',{class:'prx-legend dte-legend'},h('span',{},h('span',{class:'dte-line'}),' current pairing'),h('span',{},h('span',{class:'dte-line dte-dash'}),' original pairing')),curveNote),h('section',{class:'prx-panel'},ctx.panelTitle('Both criteria, both directions'),pairSummary,pairTable)),
   h('p',{class:'dte-note'},'Tables scroll horizontally. Focus a table and use the arrow keys, or swipe.'),
   h('section',{class:'prx-panel'},ctx.panelTitle('Every prefix of the current input'),curveTable),
   h('section',{class:'prx-panel'},ctx.panelTitle('The complete original source sample'),h('p',{class:'dte-note'},'Each row is one original joint state. The selected original row is outlined. Values are shown on their own criterion scales; larger means higher priority on both criteria.'),sourceTable),
   h('p',{class:'dte-note'},'A shift moves a unit’s entire two-criterion vector before any prefix is selected. Across the full sample, every unit keeps exactly the same vectors and marginal values. Shifting one unit changes its pairing with the others; shifting all units together only reorders the complete states. A shorter prefix can change under either shift.'),
   h('p',{class:'dte-note'},'These are empirical error estimates from a fixed IID sample, not an enumerated finite posterior law. An empirical zero or one records what occurred in the retained draws; it does not prove an exact posterior probability or convergence. Equality counts as wrong when stating a unit above another.'));
  let rawTable;
  function drawOriginal(model){
   if(!rawTable){const rows=source.draws.map((state,s)=>({s:s+1,...Object.fromEntries(state.flatMap((row,i)=>row.map((v,k)=>[`v${i}${k}`,v])))}));
    const cols=[{label:'Original state',value:'s',format:formatCount,hook:r=>`raw-draw-${r.s-1}`},...source.ids.flatMap((id,i)=>source.criteria.map((c,k)=>({label:`${id} · ${c}`,value:`v${i}${k}`,format:decimal,hook:r=>`raw-source-${r.s-1}-${i}-${k}`})))];
    rawTable=table(ctx,'All original unit-by-criterion values, kept together in each source state',cols,rows);rawTable.classList.add('dte-source');for(const th of rawTable.querySelectorAll('thead th'))if(th.textContent.includes('001'))th.setAttribute('data-prx-name','');sourceTable.append(rawTable);
   }
   [...rawTable.querySelectorAll('tbody tr')].forEach((tr,s)=>tr.toggleAttribute('data-selected',s===model.selected.draw));
  }
  return {render(state){
   prefix.set(state.prefix);draw.set(state.draw);shift.set(state.shift);shift.setDisabled(state.mode==='original');mode.set(state.mode);unit.set(state.unit);unit.setDisabled(state.mode!=='unit');pair.set(state.pair);criterion.set(state.criterion);reverse.set(state.reverse);
   const model=toyDrawModel(state),{direction,retained,baseline,selected}=model,[i,j]=direction,rows=curveRows(model);
   wholeTitle.replaceChildren(h('p',{class:'dte-note'},'Input state ',n(ctx,state.draw,formatCount,'draw'),' of ',n(ctx,source.S,formatCount),'; retained prefix ',n(ctx,retained.E.S,formatCount,'prefix'),'.'));
   stateNote.replaceChildren(state.draw<=state.prefix?'This state is included in the retained prefix. ':'This state is outside the retained prefix. ',state.mode==='original'?'Original pairing. ':state.mode==='all'?'All units move together. ':'Only the selected unit moves. ');
   orderSlots.forEach((slot,k)=>{
    const order=selected.orders[k].order,data=order.map(u=>({id:source.ids[u],unit:u,value:selected.state[u][k],original:source.draws[selected.draw][u][k]}));
    slot.replaceChildren(ctx.panelTitle(source.criteria[k]),h('p',{class:'dte-order'},'Higher first: ',...order.flatMap((u,p)=>[...(p?[' > ']:[]),name(ctx,source.ids[u])])));
    const fig=h('div');slot.append(fig);plot(fig,{height:160,marginLeft:57,marginRight:15,marginBottom:35,alt:`The complete selected state on ${source.criteria[k]}, with units ordered by their target values; filled marks show the current pairing and hollow marks the original row.`,x:{label:'target value →',grid:true,inset:12},y:{domain:order.map(u=>source.ids[u]),label:null},
     marks:(c,P)=>[P.link(data,{x1:'original',x2:'value',y1:'id',y2:'id',stroke:c.plotMuted}),P.dot(data,{x:'original',y:'id',r:6,stroke:c.plotMuted,fill:'none'}),P.dot(data,{x:'value',y:'id',r:4.5,fill:c.plotFg,symbol:d=>CONFIG.symbols[d.unit]}),P.tip(data,P.pointer({x:'value',y:'id',title:d=>`${d.id}, ${source.criteria[k]}: ${decimal(d.value)}; original row ${decimal(d.original)}.`,maxRadius:20}))],keyboard:{data,x:'value',y:'id',title:d=>`${d.id}, ${source.criteria[k]}: current ${decimal(d.value)}, original row ${decimal(d.original)}.`},table:{caption:'Values and order of the complete selected state',columns:columns([{label:'Unit',value:'id'},{label:'Current value',value:'value',format:decimal},{label:'Original-row value',value:'original',format:decimal}]),rows:data}});
    for(const label of fig.querySelectorAll('text,th'))if(label.textContent==='001')label.setAttribute('data-prx-name','');
   });
   const stateRows=source.ids.map((id,u)=>{const sourceIndex=state.mode!=='original'&&(state.mode==='all'||u===model.unit)?(selected.draw+model.input.shift)%source.S:selected.draw;return {id,u,sourceDraw:source.drawIndex.draw[sourceIndex],a:selected.state[u][0],b:selected.state[u][1]};});
   stateTable.replaceChildren(table(ctx,'Current whole-state coordinates and the original source row of each unit',[{label:'Unit',value:'id',name:true},{label:'Source row',value:'sourceDraw',format:formatCount,hook:r=>`input-source-${r.u}`},{label:'need_A',value:'a',format:decimal,hook:r=>`input-state-${r.u}-0`},{label:'need_B',value:'b',format:decimal,hook:r=>`input-state-${r.u}-1`}],stateRows));
   const curveTitle=d=>`${formatCount(d.prefix)} states: ${formatCount(d.count)} weak errors, empirical share ${formatShare(d.share)}; original ${formatCount(d.originalCount)} errors, share ${formatShare(d.baseline)}.`;
   plot(curveSlot,{height:260,marginTop:30,marginBottom:40,marginLeft:43,marginRight:15,alt:'Running empirical wrong-direction share for the selected pair and criterion, comparing current and original state pairing. The vertical line is the retained prefix.',x:{domain:[1,source.S],ticks:[1,8,16,24,32],label:'retained states →',grid:true},y:{domain:[0,1],ticks:[0,.25,.5,.75,1],label:'empirical wrong share',grid:true},marks:(c,P)=>[P.line(rows,{x:'prefix',y:'baseline',stroke:c.plotMuted,strokeDasharray:'5 3',strokeWidth:2}),P.line(rows,{x:'prefix',y:'share',stroke:c.plotFg,strokeWidth:2}),P.ruleX([state.prefix],{stroke:c.plotMuted,strokeDasharray:'2 3'}),P.dot([rows[state.prefix-1]],{x:'prefix',y:'share',r:5,fill:c.plotFg}),P.tip(rows,P.pointerX({x:'prefix',y:'share',title:curveTitle,maxRadius:20}))],keyboard:{data:rows,x:'prefix',y:'share',title:curveTitle},table:{caption:'Running error counts and empirical shares',columns:columns([{label:'Prefix',value:'prefix',format:formatCount},{label:'Current count',value:'count',format:formatCount},{label:'Current share',value:'share',format:formatShare},{label:'Original count',value:'originalCount',format:formatCount},{label:'Original share',value:'baseline',format:formatShare}]),rows}});
   curveNote.replaceChildren('Counting ',...directionNodes(ctx,source.ids,direction),' on ',name(ctx,state.criterion),'. Equality is included in the weak-error event.');
   pairSummary.replaceChildren('Current state’s wrong-direction indicators for ',...directionNodes(ctx,source.ids,direction),': ',...source.criteria.flatMap((c,k)=>[...(k?['; ']:[]),name(ctx,c),' = ',n(ctx,selected.counts[k][i][j],formatCount,`selected-error-${k}`)]),'.');
   const allPairs=source.criteria.flatMap((c,k)=>CONFIG.pairs.flatMap(([a,b])=>[[a,b],[b,a]].map(([u,v])=>({criterion:c,k,i:u,j:v,direction:`${source.ids[u]} above ${source.ids[v]}`,count:retained.counts[k][u][v],share:retained.E.e[k][u][v],original:baseline.counts[k][u][v],originalShare:baseline.E.e[k][u][v]}))));
   pairTable.replaceChildren(table(ctx,'Both oriented directions for every pair, at the retained prefix',[{label:'Criterion',value:'criterion'},{label:'Direction',value:'direction',name:true},{label:'Wrong count',value:'count',format:formatCount,hook:r=>`pair-${r.k}-${r.i}-${r.j}-count`},{label:'Empirical share',value:'share',format:formatShare,hook:r=>`pair-${r.k}-${r.i}-${r.j}-share`},{label:'Original count',value:'original',format:formatCount},{label:'Original share',value:'originalShare',format:formatShare}],allPairs));
   const allPrefixes=model.prefixes.flatMap(p=>source.criteria.flatMap((c,k)=>CONFIG.pairs.flatMap(([a,b])=>[[a,b],[b,a]].map(([u,v])=>({prefix:p.prefix,criterion:c,k,i:u,j:v,direction:`${source.ids[u]} above ${source.ids[v]}`,count:p.counts[k][u][v],share:p.E.e[k][u][v]})))));
   // A compact visible trace for the selected direction; complete numeric prefix rows stay in the chart table.
   curveTable.replaceChildren(table(ctx,'All retained-prefix counts for the selected pair and criterion',[{label:'States S',value:'prefix',format:formatCount},{label:'Current wrong count',value:'count',format:formatCount},{label:'Current share',value:'share',format:formatShare},{label:'Original wrong count',value:'originalCount',format:formatCount},{label:'Original share',value:'baseline',format:formatShare}],rows));
   // Every criterion/direction trace is retained as an accessible numeric table, independent of the picture choice.
   const complete=hiddenTable(ctx.doc,{caption:'All prefix, criterion and oriented-pair counts',columns:columns([{label:'States',value:'prefix',format:formatCount},{label:'Criterion',value:'criterion'},{label:'Direction',value:'direction'},{label:'Wrong count',value:'count',format:formatCount},{label:'Empirical share',value:'share',format:formatShare}]),rows:allPrefixes});
   complete.querySelectorAll('tbody tr').forEach((tr,r)=>{const d=allPrefixes[r];tr.cells[2].setAttribute('data-prx-name','');tr.cells[3].setAttribute('data-prx-readout',`prefix-${d.prefix}-${d.k}-${d.i}-${d.j}-count`);tr.cells[4].setAttribute('data-prx-readout',`prefix-${d.prefix}-${d.k}-${d.i}-${d.j}-share`);});curveTable.append(complete);
   drawOriginal(model);
   ctx.readout.set(['Among ',n(ctx,retained.E.S,formatCount),' retained states, ',...directionNodes(ctx,source.ids,direction),' is wrong ',n(ctx,retained.counts[0][i][j],formatCount,'count-0'),' times on need_A and ',n(ctx,retained.counts[1][i][j],formatCount,'count-1'),' times on need_B: empirical shares ',n(ctx,retained.E.e[0][i][j],formatShare,'share-0'),' and ',n(ctx,retained.E.e[1][i][j],formatShare,'share-1'),'.']);
   ctx.caption.replaceChildren('The package toy’s actual ',n(ctx,source.S,formatCount),' complete IID states; original source values and row labels retained. ',...source.notice.split(/(\d+(?:\.\d+)?)/).map(token=>/^\d/.test(token)?n(ctx,Number(token),v=>formatDecimal(v,{digits:token.includes('.')?token.split('.')[1].length:0})):token),' ',state.mode==='original'?'Original pairing.':'Cyclic re-pairing is a dependence illustration, not a new posterior simulation.');
  }};
 }});}
