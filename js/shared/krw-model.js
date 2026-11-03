// Full v1 S-02 data/model and heat-map geometry, extracted for Part3 angles and Part5 ports.
// Original: postrank-explorer-v1/js/widgets/case-krw-race.js readGrid/readModel/keyOrder/blockOrder/drawHeat.
// V3 changes: released JSON imports; both signed targets; engine sorting/counts; all-state caches; keyboard cells.
import KRW from '../../data/released/case-krw.json' with {type:'json'};
import GRID from '../../data/released/krw-lambda-grid.json' with {type:'json'};
import {canonicalGrade,confidentPairs,disclosure,evaluateReport,lambdaToTau,pairCount,reportInformation,scoreOrder,statedAbove,thresholdViolations} from '../pr-core.js';
import {canvasLayer,numText,plot} from './chart.js';
import {formatCount,formatDecimal,formatProb,formatSetting} from './format.js';

export const KRW_NOTICE = 'Data: Kline, Rose and Walters (2024), A Discrimination Report Card, American Economic Review, doi:10.1257/aer.20230700; deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; provided as is, without warranty; no endorsement is implied. As adapted in postrank 1.1.0 (pr_case_krw): continuous midpoint-cell comparison probabilities and matching central 90% marginal intervals replace KRW’s posterior grids. Grid cards were computed with KRW’s code under archived probabilities; evaluations here use the released pair probabilities.';
export const KRW_CONDUCT = 'The data describe KRW’s correspondence experiment, not any firm’s current conduct.';
export const BLUE_CUTS = Object.freeze([.05,.2,.4,.6,.8,.95]);
const models = new Map();
const heatLayers = new WeakMap();
export function readKrwModel(criterion='race') {
  if (!['race','gender'].includes(criterion)) throw new RangeError('KRW target must be race or gender');
  if (models.has(criterion)) return models.get(criterion);
  const u = KRW.tables.units, ids = KRW.arrays.error.ids, target = `${criterion}_signed`;
  const k = KRW.arrays.error.criteria.indexOf(target), grades = GRID.arrays[criterion].grade;
  if (k < 0 || grades.length !== GRID.facts.lambda.length || grades.some(g=>g.length!==ids.length)) throw new Error('KRW grid and pair probabilities do not align');
  // Source assets join by position; reject a changed position/measurement rather than quietly relabeling firms.
  const gu=GRID.tables.firms;
  for(let i=0;i<ids.length;i++) {
    if(u.id[i]!==ids[i] || (gu.id && gu.id[i]!==u.id[i]))throw new Error('KRW firm ID order differs across released assets');
    for(const field of ['race_estimate','race_se','gender_estimate','gender_se'])if(gu[field] && gu[field][i]!==u[field][i])throw new Error(`KRW ${field} join differs`);
  }
  const model={criterion,target,n:ids.length,M:pairCount(ids.length),ids:ids.slice(),names:u.firm_name.slice(),
    estimate:u[`${criterion}_estimate`].slice(),se:u[`${criterion}_se`].slice(),mean:u[`mean_${criterion}`].slice(),lower:u[`lower_${criterion}`].slice(),upper:u[`upper_${criterion}`].slice(),
    E:{ids:ids.slice(),criteria:[target],e:[KRW.arrays.error.e[k]]},e:KRW.arrays.error.e[k],
    grid:{lambda:GRID.facts.lambda.slice(),grade:grades.map(canonicalGrade),count:grades.length},cards:new Map(),diagnostics:new Map()};
  models.set(criterion,model);return model;
}
export function gridIndex(lambda) {return Math.max(0,Math.min(100,Math.round(100*lambda)));}
export function cardAt(model,lambda) {
  const index=gridIndex(lambda);
  if(!model.cards.has(index)) {
    const l=model.grid.lambda[index],tau=l===0?0:lambdaToTau(l),grade=model.grid.grade[index],d=disclosure(grade);
    // λ0 remains a valid axes point. Its τ0 is outside evaluateReport's risk domain; .5 supplies only τ-invariant fields.
    const ev=evaluateReport(grade,model.E,{tau:tau===0?.5:tau});
    model.cards.set(index,{index,lambda:l,tau,grade,d,ev:tau===0?{...ev,risk:null}:ev,DR:ev.EoverM[0],information:reportInformation(grade,model.E)});
  }
  return model.cards.get(index);
}
export function gridRows(model) {return model.grid.lambda.map(lambda=>cardAt(model,lambda));}
export function keyOrder(model,sort='mean') {
  if(sort==='krw')return scoreOrder(model.grid.grade.at(-1),{direction:'ascending'}).order;
  return scoreOrder(sort==='estimate'?model.estimate:model.mean,{direction:'descending'}).order;
}
export function blockOrder(model,grade,sort='mean') {
  const rank=new Array(model.n);keyOrder(model,sort).forEach((i,k)=>{rank[i]=k;});
  return Array.from({length:model.n},(_,i)=>i).sort((a,b)=>grade[a]-grade[b]||rank[a]-rank[b]);
}
export function heatCounts(model,grade,tau) {
  const conf=confidentPairs(grade,model.E,{tau});
  return {P:conf.count,W:conf.withheld,S:statedAbove(grade,model.E,{tau}).count};
}
export function thresholdAt(model,lambda,{details=false}={}) {
  const k=gridIndex(lambda),key=`${k}:${details}`;
  if(details)for(const old of model.diagnostics.keys())if(old.endsWith(":true")&&old!==key)model.diagnostics.delete(old);
  if(!model.diagnostics.has(key))model.diagnostics.set(key,thresholdViolations(model.E,{tau:k===0?0:lambdaToTau(model.grid.lambda[k]),details}));
  return model.diagnostics.get(key);
}
export function appendKrwNotice(ctx) {
  if(!ctx.doc.querySelector('meta[name="quarto:offset"]'))ctx.root.append(ctx.h('p',{class:'prx-hint'},KRW_NOTICE,' ',ctx.h('strong',{text:KRW_CONDUCT})));
}

/** Actual S-02 heat map, all97×97 cells. New angles pass highlighted unit indices; Part5 retains all three stages. */
export function drawKrwHeat(ctx,slot,legend,model,{grade,tau,sort='mean',stage=2,highlight=[]}) {
  const h=ctx.h,n=model.n,order=stage===3?blockOrder(model,grade,sort):keyOrder(model,sort),width=Math.min(560,Math.max(1,Math.round(slot.clientWidth||ctx.width())));
  const H={marginSide:2,marginTop:20,marginBottom:2,outline:2,halo:4,labelPx:14,labelDy:-5},inner=Math.max(1,width-2*H.marginSide),blocks=[];
  if(stage===3)order.forEach((i,p)=>{const g=grade[i],b=blocks[g-1]??(blocks[g-1]={grade:g,first:p,last:p});b.last=p;});
  const labeled=[];let lastRight=-Infinity;
  for(const b of blocks){const mid=((b.first+b.last+1)/2)*inner/n;if(mid-H.labelPx/2>=lastRight){labeled.push({...b,mid:(b.first+b.last+1)/2});lastRight=mid+H.labelPx/2;}}
  const cells=order.flatMap((i,r)=>order.map((j,q)=>({i,j,r:r+.5,q:q+.5,pi:i===j?null:1-model.e[i][j]})));
  const title=d=>d.i===d.j?`${model.names[d.i]}: diagonal`:`${model.names[d.i]} truly higher than ${model.names[d.j]}: ${formatProb(d.pi)}; naive rule ${model.e[d.i][d.j]<tau?'states row above column':model.e[d.j][d.i]<tau?'states column above row':'withholds this pair'}; card ${grade[d.i]===grade[d.j]?'withholds this pair':grade[d.i]<grade[d.j]?'states row above column':'states column above row'}; grades ${grade[d.i]} and ${grade[d.j]}.`;
  const diagnostic=stage>=2?thresholdViolations(model.E,{tau}):null;
  const tableRows=order.map(i=>({i,firm:model.names[i],grade:grade[i],above:diagnostic?.aboveCounts[i]}));
  let layer=heatLayers.get(slot);
  if(!layer){layer={canvas:null,paint:null};heatLayers.set(slot,layer);}
  layer.paint={model,order,tau,stage};
  const fig=plot(slot,{width,height:Math.round(inner+H.marginTop+H.marginBottom),aspect:false,marginTop:H.marginTop,marginBottom:H.marginBottom,marginLeft:H.marginSide,marginRight:H.marginSide,
    alt:'Every row–column firm pair: probability the row true value is higher. Thresholded cells retain blue; grade blocks and selected units are outlined when requested.',
    table:{caption:stage===1?'Every firm on the complete pair map':'Every firm: number of other firms it is stated above by the isolated strict threshold',columns:[{label:'Firm',value:'firm'},...(stage===3?[{label:'Card grade',value:'grade',format:formatCount}]:[]),...(stage>=2?[{label:'Naive stated above',value:'above',format:formatCount}]:[])],rows:tableRows},
    x:{domain:[0,n],axis:null},y:{domain:[0,n],axis:null,reverse:true},
    keyboard:{data:cells,x:'q',y:'r',sort:false,columns:n,virtual:true,label:'Read the complete firm-pair probability matrix with arrow keys',title},
    marks:(c,P)=>[P.frame({stroke:c.plotMuted}),P.rect(blocks.filter(Boolean),{x1:'first',x2:b=>b.last+1,y1:'first',y2:b=>b.last+1,fill:'none',stroke:c.plotBg,strokeWidth:H.halo}),P.rect(blocks.filter(Boolean),{x1:'first',x2:b=>b.last+1,y1:'first',y2:b=>b.last+1,fill:'none',stroke:c.plotFg,strokeWidth:H.outline}),numText(labeled,{x:'mid',y:()=>0,value:'grade',format:formatCount,dy:H.labelDy,lineAnchor:'bottom',textAnchor:'middle',fill:c.plotFg,fontWeight:'bold'}),P.rect(cells.filter(d=>d.i!==d.j&&highlight.includes(d.i)&&highlight.includes(d.j)),{x1:d=>d.q-.5,x2:d=>d.q+.5,y1:d=>d.r-.5,y2:d=>d.r+.5,fill:'none',stroke:c.plotFg,strokeWidth:1.8})]});
  if(stage>=2)slot.querySelectorAll('[data-prx-part="table"] tbody tr').forEach((row,p)=>{row.lastElementChild.dataset.prxUnitcount=String(order[p]);});
  if(!layer.canvas||!slot.contains(layer.canvas)){
    const current=layer;
    const added=canvasLayer(fig,(g,{x,y,palette:c})=>{const{model:m,order:ord,tau:t,stage:st}=current.paint,count=ord.length,cw=(x(count)-x(0))/count,ch=(y(count)-y(0))/count;
      for(let r=0;r<count;r++)for(let q=0;q<count;q++){const i=ord[r],j=ord[q],pi=1-m.e[i][j];g.fillStyle=i===j?c.plotGrid:st>=2&&!(m.e[i][j]<t)?c.neutral[0]:c.blues[BLUE_CUTS.filter(v=>pi>=v).length];g.fillRect(x(0)+q*cw,y(0)+r*ch,Math.ceil(cw),Math.ceil(ch));}});
    layer.canvas=added.canvas;
  }
  if(legend){const first=stage>=2?BLUE_CUTS.filter(v=>v<=1-tau).length:0;const ranges=[];
   for(let k=first;k<=BLUE_CUTS.length;k++){const low=Math.max(stage>=2?1-tau:0,k===0?0:BLUE_CUTS[k-1]),high=k===BLUE_CUTS.length?1:BLUE_CUTS[k];ranges.push(h('span',{class:'krw-map-key'},h('span',{class:'krw-map-swatch',style:{background:`var(--prx-blues-${k+1})`}}),...(stage>=2&&k===first?['>']:[]),ctx.num(low,formatDecimal(low,{digits:3})),'–',ctx.num(high,formatSetting(high))));}
   legend.replaceChildren(h('span',{},'Pr(row truly higher than column)'),...ranges,...(stage>=2?[h('span',{},'Faded: does not pass the strict threshold; diagonal: gray.')]:[]));}
  return fig;
}

/** G-09 two-axis plot frame extended by the archived S-02 grid and quantile overlays. No interpolation certificate. */
export function drawKrwAxes(ctx,slot,rows,{selected,overlays=[]}) {
  const data=rows.map(r=>({x:r.DR,y:r.information,label:`KRW grid λ${formatSetting(r.lambda)}`,lambda:r.lambda}));
  const tier=overlays.map(r=>({x:r.DR,y:r.information,label:r.label})),cur=selected?{x:selected.DR,y:selected.information}:null;
  const maxX=Math.max(.25,...data.map(d=>d.x),...tier.map(d=>d.x))*1.06,maxY=Math.max(.5,...data.map(d=>d.y),...tier.map(d=>d.y))*1.06;
  const table=[...data,...tier],title=d=>`${d.label}: DR ${formatDecimal(d.x,{digits:4})}, I ${formatDecimal(d.y,{digits:4})}`;
  return plot(slot,{width:Math.max(1,Math.round(slot.clientWidth||ctx.width())),height:330,marginTop:20,marginBottom:48,marginLeft:56,marginRight:22,
    alt:'Archived KRW grid reports on two axes: expected wrong directions per pair horizontally and posterior informativeness vertically; fixed posterior-mean tiers are overlaid.',
    table:{caption:'The same released law evaluates every plotted report',columns:[{label:'Report',value:'label'},{label:'DR=E/M',value:'x',format:v=>formatDecimal(v,{digits:4})},{label:'I(g,θ)',value:'y',format:v=>formatDecimal(v,{digits:4})}],rows:table},
    x:{domain:[0,maxX],label:'DR = E/M (smaller is better)',labelAnchor:'center',labelArrow:'none'},y:{domain:[Math.min(0,...data.map(d=>d.y)),maxY],label:'I(g, θ) (larger is better)',labelArrow:'none',grid:true},
    keyboard:{data:table,x:'x',y:'y',sort:false,label:'Read KRW grid and fixed-tier points',title},
    marks:(c,P)=>[P.ruleY([0],{stroke:c.plotAxis}),P.ruleX([0],{stroke:c.plotAxis}),P.line(data,{x:'x',y:'y',stroke:c.plotFg,strokeWidth:1.5}),P.dot(data,{x:'x',y:'y',r:2,fill:c.plotFg}),P.dot(tier,{x:'x',y:'y',symbol:'diamond',r:6,fill:c.est,stroke:c.plotBg}),...tier.map(d=>P.text([d],{x:'x',y:'y',text:'label',dy:d.label==='Quartiles'?16:-14,fill:c.estText,stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke'})),P.dot(cur?[cur]:[],{x:'x',y:'y',r:8,fill:'none',stroke:c.plotFg,strokeWidth:2})]});
}
