// Author: JoonHo Lee (jlee296@ua.edu).
// Separate choices concern the actual feasible product, not a posterior-independence assumption.
import {createWidget} from '../shared/base.js';
import {formatCount,formatGrades} from '../shared/format.js';
import {mdomainExample,mdomainInput,mdomainFamily,mdomainSolve,mdomainEvaluate} from '../pr-core.js';
import {exactNum,candidateIdNode,gradeTable,pairTable,candidateTable,optimizerSummaryNode,resultScopeNode} from '../shared/mdomain/index.js';
import {exactCompare,exactDifference} from '../shared/mdomain/compare.js';
import {VISUAL_CSS,createVisualFrame,scene,svgNode,svgText,svgExact} from '../shared/mdomain/visual.js';

const ACTIONS=[{name:'Withhold',key:'1,1'},{name:'A ahead',key:'1,2'},{name:'B ahead',key:'2,1'}];
const CARDS=ACTIONS.flatMap(s=>ACTIONS.map(c=>({id:`p:${s.key}|${c.key}`,s,c})));
export const PROFILE_SEPARABILITY_KEYS={
 couplingIndex:{type:'choice',values:[0,1,10],value:1},
 zeroWeight:{type:'boolean',value:false},
 protected:{type:'boolean',value:true},
 candidate:{type:'choice',values:CARDS.map(c=>c.id),value:'p:1,2|1,2'}
};
const cache=new Map();
const columnKey=(grades,d)=>grades.values.map(row=>row[d]).join(',');
const productIds=columns=>columns[0].flatMap(s=>columns[1].map(c=>`p:${s.replace(/^g:/,'')}|${c.replace(/^g:/,'')}`));
const sameIds=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);

/** Every setting is one supplied law and policy; inspection changes no scientific result. */
export function solveProfileSeparability(state={}){
 const settings={couplingIndex:state.couplingIndex===undefined?10:state.couplingIndex,zeroWeight:state.zeroWeight===undefined?false:state.zeroWeight,protected:state.protected===undefined?false:state.protected};
 const key=JSON.stringify(settings);let result=cache.get(key);
 if(!result){
  const request=mdomainExample('separable',settings),input=mdomainInput(request.input),family=mdomainFamily(input,request.family);
  const fit=mdomainSolve(input,family,request.decision),evaluations=new Map(fit.candidateTable.map(row=>[row.candidateId,mdomainEvaluate(input,row.grades,request.decision)]));
  const feasibleRows=fit.candidateTable.filter(row=>row.feasible),feasibleIds=feasibleRows.map(row=>row.candidateId),feasibleSet=new Set(feasibleIds);
  const columns=family.banks.map((bank,d)=>{
   const projection=new Set(feasibleRows.map(row=>columnKey(row.grades,d)));
   const rows=bank.columns.map(col=>{
    const key=col.grades.join(','),singleton=`p:${d===0?key:'1,1'}|${d===1?key:'1,1'}`,domain=evaluations.get(singleton).domains[d];
    return {columnId:col.columnId,grades:[...col.grades],inProjection:projection.has(key),lossExact:domain.lossExact,weightedLossExact:domain.weightedLossExact,weightExact:request.decision.weights[d],isWeightedMinimum:false};
   });
   const projected=rows.filter(row=>row.inProjection);let minimum=projected[0].weightedLossExact;
   for(const row of projected)if(exactCompare(row.weightedLossExact,minimum)<0)minimum=row.weightedLossExact;
   for(const row of rows)row.isWeightedMinimum=row.inProjection&&exactCompare(row.weightedLossExact,minimum)===0;
   return rows;
  });
  const projectionIds=columns.map(rows=>rows.filter(row=>row.inProjection).map(row=>row.columnId));
  const projectionProductIds=productIds(projectionIds),missingIds=projectionProductIds.filter(id=>!feasibleSet.has(id));
  const argminColumnIds=columns.map(rows=>rows.filter(row=>row.isWeightedMinimum).map(row=>row.columnId));
  const preferredIds=productIds(argminColumnIds),preferredFeasibleIds=preferredIds.filter(id=>feasibleSet.has(id)),missingPreferredIds=preferredIds.filter(id=>!feasibleSet.has(id));
  // Additivity makes each preferred combination's complete engine risk the sum
  // of the separate weighted minima, even when that combination is infeasible.
  const lowerBoundExact=evaluations.get(preferredIds[0]).riskExact;
  const summary={feasibleCount:feasibleIds.length,projectionCounts:projectionIds.map(x=>x.length),projectionProductCount:projectionProductIds.length,missingCount:missingIds.length,isProduct:missingIds.length===0&&feasibleIds.length===projectionProductIds.length,marginalMinCounts:argminColumnIds.map(x=>x.length),preferredProductCount:preferredIds.length,preferredFeasibleCount:preferredFeasibleIds.length,preferredMissingCount:missingPreferredIds.length,lowerBoundExact,riskExact:fit.riskExact,riskGapExact:exactDifference(fit.riskExact,lowerBoundExact),lowerBoundAttained:preferredFeasibleIds.length>0,argminProductEqualsOptimizers:sameIds(preferredIds,fit.optimizerIds),optimizerCount:fit.optimizerIds.length};
  result={request,input,family,fit,evaluations,columns,feasibleIds,projectionIds,projectionProductIds,missingIds,argminColumnIds,preferredIds,preferredFeasibleIds,missingPreferredIds,summary};cache.set(key,result);
 }
 const focus=result.evaluations.get(state.candidate===undefined?'p:1,2|1,2':state.candidate);
 if(!focus)throw new RangeError('Unknown inspected profile card.');
 return {...result,focus};
}

const CSS=`${VISUAL_CSS}
.mds{min-width:0}.mds .mds-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr));gap:1rem;min-width:0}.mds .mds-section{min-width:0;margin:.9rem 0}.mds .mds-note{font-size:.88rem;line-height:1.45}.mds .mds-scroll{overflow-x:auto;max-width:100%;min-width:0}
.mds .mds-table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;font-size:.88rem}.mds .mds-table th,.mds .mds-table td{padding:.4rem;text-align:left;white-space:nowrap;border-bottom:1px solid var(--prx-border)}.mds .mds-grid{table-layout:fixed;min-width:23rem}.mds .mds-grid th:first-child{width:6rem}
.mds .mds-card{display:block;width:100%;padding:.45rem;border:1px solid var(--prx-border-strong);border-radius:.25rem;background:var(--prx-bg);color:var(--prx-fg);text-align:left}.mds .mds-card[aria-pressed=true]{outline:3px solid var(--prx-accent);outline-offset:1px}.mds .mds-card.mds-optimal{border:3px double var(--prx-fg)}.mds .mds-card.mds-canonical{box-shadow:inset 0 0 0 2px var(--prx-fg)}.mds .mds-card:focus-visible{outline:3px solid var(--prx-focus)}.mds .mds-card span{white-space:nowrap}.mds .mds-list{margin:.4rem 0}.mds .mds-conclusion{font-weight:600}
.mds .mds-visual-node{cursor:pointer;outline:none}.mds .mds-visual-node:focus .mds-focus-hit{stroke:var(--prx-plot-focus);stroke-width:3}.mds .mds-visual-legend{display:flex;flex-wrap:wrap;gap:.2rem .9rem;padding:.1rem .8rem .35rem;font-size:.88rem;line-height:1.5;color:var(--prx-plot-fg)}.mds .mds-visual-inspector{padding:.35rem .8rem .7rem;font-size:.9rem;line-height:1.5;color:var(--prx-plot-fg)}
.mds .mds-guard-example{display:block;margin-top:.25rem;color:var(--prx-plot-fg)}
.mds .mds-worked-state{display:block;min-height:44px;margin-top:.35rem;font-size:max(14px,.85rem)}
.mds [data-prx-part=controls] .prx-toggle>label{display:flex;align-items:center;min-height:44px;min-width:100px;cursor:pointer}
`;
function number(ctx,value,hook){const n=ctx.num(value,formatCount(value));if(hook)n.dataset.prxReadout=hook;return n;}
function exact(ctx,value,hook){const n=exactNum(ctx,value);if(hook)n.dataset.prxReadout=hook;return n;}
function named(ctx,value){return ctx.h('span',{'data-prx-name':''},value);}
function section(ctx,title){return ctx.h('section',{class:'mds-section'},ctx.panelTitle(title));}
function table(ctx,heads,rows,caption){return ctx.h('table',{class:'mds-table'},ctx.h('caption',{},caption),ctx.h('thead',{},ctx.h('tr',{},heads.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},rows.map(row=>ctx.h('tr',{},row.map((value,i)=>ctx.h(i?'td':'th',i?{}:{scope:'row'},value))))));}
function region(ctx,node,label){const el=ctx.scrollRegion(ctx.h('div',{class:'mds-scroll'},node),label);el.classList.add('mds-scroll');return el;}
function idList(ctx,ids,label){return ctx.h('div',{},ctx.h('p',{},label),ids.length?ctx.h('ul',{class:'mds-list'},ids.map(id=>ctx.h('li',{},candidateIdNode(ctx,id)))):ctx.h('p',{},'None.'));}
function actionName(grades,d){return ACTIONS.find(a=>a.key===columnKey(grades,d)).name;}


// The rectangle and shaded bands are derived from actual projections and weighted minima.
// They do not assume posterior independence or decide feasibility from plot coordinates.
function drawFeasibleLattice(ctx,visual,result,state){
 const {fit,summary:s}=result;
 const {svg,figure,width,colors}=scene(ctx,visual.stage,{height:364,label:'Feasible profile actions, their projection product and separate weighted minima.'});
 svg.setAttribute('role','group');
 const dual='p:1,2|1,2';
 const excluded=result.missingPreferredIds.includes(dual)?result.evaluations.get(dual):null;
 const worked=ctx.h('button',{type:'button',class:'prx-btn mds-worked-state','data-prx-focus-key':'separate-worked-bound',
  'aria-pressed':String(state.couplingIndex===1&&state.zeroWeight&&state.protected),onclick:()=>ctx.set({couplingIndex:1,zeroWeight:true,protected:true,candidate:dual})},'Zero S weight under the guard');
 figure.insertBefore(ctx.h('figcaption',{},'S composition · C community. A → B puts A first. Shared grades withhold.',
  ...(excluded?[ctx.h('strong',{class:'mds-guard-example','data-mds-guard-example':''},'A above B in both gives ',exactNum(ctx,excluded.jointProbabilityExact),' joint error, above the ',exactNum(ctx,result.request.decision.alpha),' cap. ',
   s.lowerBoundAttained?['Other preferred cards attain ',exactNum(ctx,s.lowerBoundExact),'.']:['Best feasible loss ',exactNum(ctx,s.riskExact),' vs separate bound ',exactNum(ctx,s.lowerBoundExact),'.'])]:[]),worked),svg);
 const left=65,right=15,top=80,cellW=(width-left-right)/3,cellH=64;
 const x=i=>left+cellW*(i+.5),y=i=>top+cellH*(i+.5);
 svg.setAttribute('data-mds-grid-left',String(left));svg.setAttribute('data-mds-grid-top',String(top));svg.setAttribute('data-mds-cell-width',String(cellW));svg.setAttribute('data-mds-cell-height',String(cellH));
 const projected=result.columns.map(rows=>ACTIONS.map(a=>rows.find(r=>r.grades.join(',')===a.key)?.inProjection??false));
 const minima=result.columns.map(rows=>ACTIONS.map(a=>rows.find(r=>r.grades.join(',')===a.key)?.isWeightedMinimum??false));
 const indices=projected.map(flags=>flags.flatMap((flag,i)=>flag?[i]:[]));
 const projection=svgNode(ctx,'rect',{x:x(Math.min(...indices[0]))-cellW/2+3,y:y(Math.min(...indices[1]))-cellH/2+3,width:(Math.max(...indices[0])-Math.min(...indices[0])+1)*cellW-6,height:(Math.max(...indices[1])-Math.min(...indices[1])+1)*cellH-6,rx:5,fill:colors.plotBg,stroke:colors.plotFg,'stroke-width':1.5,'stroke-dasharray':'5 4','data-mdv-role':'projection-product','data-mds-projection-S':result.projectionIds[0].join('|'),'data-mds-projection-C':result.projectionIds[1].join('|')});
 svg.append(projection);
 for(let d=0;d<2;d++)for(let i=0;i<3;i++)if(minima[d][i])svg.append(svgNode(ctx,'rect',{x:d===0?left+i*cellW+5:left+5,y:d===0?top+5:top+i*cellH+5,width:d===0?cellW-10:3*cellW-10,height:d===0?3*cellH-10:cellH-10,fill:colors.crit[d],opacity:.16,'data-mdv-role':'weighted-minimum-band','data-mdv-domain':['S','C'][d],'data-mdv-column':ACTIONS[i].key}));
 svg.append(svgText(ctx,(left+width-right)/2,22,'S actions →',{'font-size':16,'text-anchor':'middle','font-weight':600}),svgText(ctx,5,69,'C ↓',{'font-size':16,'font-weight':600}));
 for(let i=0;i<3;i++){
  const short=['Withhold','A → B','B → A'][i];
  svg.append(svgText(ctx,x(i),54,short,{'font-size':15,'text-anchor':'middle','text-decoration':minima[0][i]?'underline':undefined,'font-weight':minima[0][i]?600:400}),svgText(ctx,4,y(i)+5,short,{'font-size':15,'text-decoration':minima[1][i]?'underline':undefined,'font-weight':minima[1][i]?600:400}));
 }
 const inspector=ctx.h('div',{class:'mds-visual-inspector','data-mds-visual-inspector':'','role':'group','aria-label':'Inspected profile'});
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const id=`p:${ACTIONS[col].key}|${ACTIONS[row].key}`,card=fit.candidateTable.find(c=>c.candidateId===id),inside=projected[0][col]&&projected[1][row],missing=inside&&!card.feasible,canonical=id===fit.selectedId,inspected=id===state.candidate;
  const node=svgNode(ctx,'g',{class:'mds-visual-node',role:'button',tabindex:inspected?0:-1,'aria-label':`S ${ACTIONS[col].name}; C ${ACTIONS[row].name}. ${card.feasible?'Feasible':'Excluded'}.${card.optimal?' Exact optimum.':''}${canonical?' Canonical representative.':''}`,'aria-pressed':String(inspected),'data-mdv-role':'candidate','data-mdv-candidate':id,'data-mdv-feasible':String(card.feasible),'data-mdv-optimal':String(card.optimal),'data-mdv-canonical':String(canonical),'data-mdv-inspected':String(inspected),'data-mdv-projected':String(inside),'data-mdv-missing':String(missing),'data-prx-focus-key':`feasible-lattice:${id}`});
  if(inspected)node.append(svgNode(ctx,'rect',{x:x(col)-25,y:y(row)-25,width:50,height:50,rx:6,fill:'none',stroke:colors.accent,'stroke-width':2,'stroke-dasharray':'2 3','pointer-events':'none'}));
  node.append(svgNode(ctx,'rect',{class:'mds-focus-hit','data-prx-focus-ring':'',x:x(col)-22,y:y(row)-22,width:44,height:44,rx:5,fill:'transparent',stroke:'transparent'}));
  node.append(svgNode(ctx,'circle',{cx:x(col),cy:y(row),r:11,fill:card.feasible?colors.accent:colors.plotBg,stroke:colors.plotFg,'stroke-width':1.5,opacity:inside?1:.4}));
  if(!card.feasible)node.append(svgNode(ctx,'path',{d:`M${x(col)-7},${y(row)-7}L${x(col)+7},${y(row)+7}M${x(col)+7},${y(row)-7}L${x(col)-7},${y(row)+7}`,stroke:colors.plotFg,'stroke-width':missing?3:1.5,opacity:inside?1:.4}));
  if(card.optimal)for(const r of[17,20])node.append(svgNode(ctx,'circle',{cx:x(col),cy:y(row),r,fill:'none',stroke:colors.plotFg,'stroke-width':1.5,'data-mds-optimum':r===20?id:undefined}));
  if(canonical)node.append(svgNode(ctx,'path',{d:`M${x(col)},${y(row)-5}l5,5l-5,5l-5,-5Z`,fill:colors.plotBg,stroke:colors.plotFg,'stroke-width':1,'data-mds-canonical':id}));
  const inspect=()=>ctx.set({candidate:id});node.addEventListener('click',inspect);
  node.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect();return;}
   const shift={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[event.key];if(!shift)return;event.preventDefault();
   const rr=(row+shift[0]+3)%3,cc=(col+shift[1]+3)%3,next=`p:${ACTIONS[cc].key}|${ACTIONS[rr].key}`;ctx.set({candidate:next});visual.stage.querySelector(`[data-mdv-candidate="${next}"]`)?.focus?.();
  });
  svg.append(node);
 }
 svg.append(svgText(ctx,18,309,'Separate bound',{'font-size':15}),svgExact(ctx,18,338,s.lowerBoundExact,{}, {'font-size':20,'font-weight':600,'data-mdv-role':'separate-bound'}),svgText(ctx,width/2+8,309,'Minimum loss',{'font-size':15}),svgExact(ctx,width/2+8,338,s.riskExact,{}, {'font-size':20,'font-weight':600,'data-mdv-role':'feasible-minimum'}));
 const legend=ctx.h('div',{class:'mds-visual-legend'},ctx.h('span',{},'● Feasible · × Excluded'),ctx.h('span',{},'Double ring: optimal · ◆ Canonical'),ctx.h('span',{},'Dashed box: projection product'),ctx.h('span',{},'Minima: shaded + underlined'),ctx.h('span',{},'Dotted box: inspected'));
 const card=result.focus;inspector.replaceChildren('S: ',named(ctx,actionName(card.grades,0)),' · C: ',named(ctx,actionName(card.grades,1)),' · ',card.feasible?'Feasible':'Excluded',' · loss ',exactNum(ctx,card.riskExact),
  ...(state.protected?[' · joint error ',exactNum(ctx,card.jointProbabilityExact),card.feasible?' at or below cap ':' above cap ',exactNum(ctx,result.request.decision.alpha)]:[]),'.');
 figure.append(legend,inspector);
}

export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:'profile-separability',className:'mds',css:CSS,keys:PROFILE_SEPARABILITY_KEYS,
 build(ctx){
  const law=ctx.select({label:'Joint law',options:[{value:10,label:'Coincident reversals (dependent)'},{value:0,label:'Disjoint reversals (dependent)'},{value:1,label:'Independent reversals'}],value:ctx.state.couplingIndex,onChange:v=>ctx.set({couplingIndex:v})});
  const zero=ctx.toggle({label:'Zero loss weight in S',checked:ctx.state.zeroWeight,onChange:v=>ctx.set({zeroWeight:v})});
  const guard=ctx.toggle({label:'Joint guard',checked:ctx.state.protected,onChange:v=>ctx.set({protected:v})});
  const focus=ctx.select({label:'Inspect a candidate (S; C)',options:CARDS.map(c=>({value:c.id,label:`${c.s.name}; ${c.c.name}`})),value:ctx.state.candidate,onChange:v=>ctx.set({candidate:v})});
  ctx.controls.append(law.root,zero.root,guard.root,focus.root);ctx.charts.before(ctx.readout.node);
  const policy=ctx.h('p',{class:'mds-note'});ctx.charts.append(policy);
  const marginal=section(ctx,'Separate weighted choices'),factor=section(ctx,'The actual feasible family'),grid=section(ctx,'Every card in the stated product bank'),detail=section(ctx,'The inspected card'),optima=section(ctx,'All minimum-risk feasible cards');
  const top=ctx.h('div',{class:'mds-layout'},marginal,factor);ctx.charts.append(top,grid,detail,optima);
  const visual=createVisualFrame(ctx,{mainControl:guard.root});
  visual.dataBody.insertBefore(ctx.h('div',{class:'prx-controls'},focus.root),policy);let gridButtons=[];
  function focusGrid(id){gridButtons.find(b=>b.dataset.card===id)?.focus();}
  return {render(state){
   law.set(state.couplingIndex);zero.set(state.zeroWeight);guard.set(state.protected);focus.set(state.candidate);visual.sync();
   const r=solveProfileSeparability(state),{request,input,fit,summary:s}=r,inspection=r.focus;
   policy.replaceChildren('Joint reversal mass c = ',exact(ctx,input.masses.at(-1),'coupling'),'. Domain weights: S ',exact(ctx,request.decision.weights[0],'weight-0'),'; C ',exact(ctx,request.decision.weights[1],'weight-1'),'. Each withholding cost is ',exact(ctx,request.decision.tau[0],'tau'),'. Expected-error guards are disabled. ',state.protected?ctx.h('span',{},'The joint guard uses strict event thresholds ',exact(ctx,request.decision.t[0],'threshold'),', with inclusive cap ',exact(ctx,request.decision.alpha,'alpha'),'.'):ctx.h('span',{},'The joint guard is disabled. No joint-protection certificate is being asserted.'));
   const conclusion=s.isProduct?'The feasible family is a product. Every combination of weighted domain minima is a full optimum.':s.lowerBoundAttained?s.preferredMissingCount>0?'The feasible family is not a product. The separate lower bound is attained, but some preferred combinations are infeasible.':'The feasible family is not a product, although every preferred combination is feasible and the separate lower bound is attained.':'The feasible family is not a product. The separate lower bound is unattainable under the joint guard.';
   visual.auditReadout.set([ctx.h('span',{class:'mds-conclusion','data-prx-readout':'factorisation-status'},conclusion),' Separate projected minima sum to ',exact(ctx,s.lowerBoundExact,'lower-bound'),'; the feasible minimum is ',exact(ctx,s.riskExact,'minimum-risk'),', a gap of ',exact(ctx,s.riskGapExact,'risk-gap'),(s.preferredProductCount===1?'. There is ':'. There are '),number(ctx,s.preferredProductCount,'preferred-count'),(s.preferredProductCount===1?' preferred combination, ':' preferred combinations, '),number(ctx,s.preferredFeasibleCount,'preferred-feasible-count'),' feasible and ',number(ctx,s.preferredMissingCount,'preferred-missing-count'),' infeasible; the full optimizer set contains ',number(ctx,s.optimizerCount,'optimizer-count'),(s.optimizerCount===1?' card.':' cards.')]);
   marginal.replaceChildren(ctx.panelTitle('Separate weighted choices'),ctx.h('p',{class:'mds-note'},'A column belongs to the projection if at least one feasible card uses it. The separate calculation finds the lowest weighted loss among those columns. A zero loss weight leaves any error limits in force.'));
   r.columns.forEach((rows,d)=>{
    const title=ctx.h('p',{},named(ctx,input.domainIds[d]),': ',number(ctx,s.projectionCounts[d],`projection-${d}-count`),(s.projectionCounts[d]===1?' projection column, ':' projection columns, '),number(ctx,s.marginalMinCounts[d],`marginal-${d}-count`),(s.marginalMinCounts[d]===1?' weighted minimum.':' weighted minima.'));
    const body=rows.map((row,k)=>[named(ctx,ACTIONS.find(a=>a.key===row.grades.join(',')).name),ctx.num(row.grades,formatGrades(row.grades)),exact(ctx,row.lossExact,`domain-${d}-column-${k}-loss`),exact(ctx,row.weightExact,`domain-${d}-column-${k}-weight`),exact(ctx,row.weightedLossExact,`domain-${d}-column-${k}-weighted`),ctx.h('span',{'data-prx-projection':row.inProjection?'true':'false'},row.inProjection?'Occurs in a feasible card':'Excluded from projection'),ctx.h('span',{'data-prx-weighted-minimum':row.isWeightedMinimum?'true':'false'},row.isWeightedMinimum?'Weighted minimum':'')]);
    marginal.append(title,region(ctx,table(ctx,['Column','Grades','Unweighted loss','Weight','Weighted term','Feasible projection','Minimum'],body,`${input.domainIds[d]} marginal loss table`),`${input.domainIds[d]} marginal loss table`));
   });
   marginal.append(ctx.h('p',{class:'mds-note'},'The complete marginal law is the same in every coupling: A is ahead of B with probability ',exact(ctx,r.evaluations.get('p:2,1|2,1').domains[0].expectedFalseCountExact,'marginal-ahead'),', and behind with probability ',exact(ctx,r.evaluations.get('p:1,2|1,2').domains[0].expectedFalseCountExact,'marginal-behind'),', in each domain.'),idList(ctx,r.preferredIds,'Complete product of weighted domain minima:'));
   factor.replaceChildren(ctx.panelTitle('The actual feasible family'),ctx.h('p',{},'The feasible family has ',number(ctx,s.feasibleCount,'feasible-count'),(s.feasibleCount===1?' card. Its projection product has ':' cards. Its projection product has '),number(ctx,s.projectionProductCount,'projection-product-count'),(s.projectionProductCount===1?' card, with ':' cards, with '),number(ctx,s.missingCount,'missing-count'),(s.missingCount===1?' combination absent from the feasible family.':' combinations absent from the feasible family.')),ctx.h('p',{'data-prx-readout':'product-status'},s.isProduct?'Exact set equality holds.':'Exact set equality fails.'),idList(ctx,r.missingIds,'Projection combinations excluded by the complete-card constraints:'),ctx.h('p',{'data-prx-readout':'argmin-status'},s.argminProductEqualsOptimizers?'The preferred product equals the complete full optimizer set.':'The preferred product differs from the complete full optimizer set.'),idList(ctx,r.missingPreferredIds,'Preferred combinations that fail the complete-card constraints:'));
   grid.replaceChildren(ctx.panelTitle('Every card in the stated product bank'),ctx.h('p',{class:'mds-note'},'The columns give S grades, and the rows give C grades. Double borders mark all the lowest-risk feasible cards. An inset border marks the one shown first, and the outline follows the card you select. Use the arrow keys to move between cards.'));gridButtons=[];
   const body=ACTIONS.map((c,rowIndex)=>ctx.h('tr',{},ctx.h('th',{scope:'row'},c.name),ACTIONS.map((a,colIndex)=>{
    const id=`p:${a.key}|${c.key}`,row=fit.candidateTable.find(card=>card.candidateId===id);
    const button=ctx.h('button',{type:'button',class:`mds-card${row.optimal?' mds-optimal':''}${row.selected?' mds-canonical':''}`,'aria-label':`S ${a.name}; C ${c.name}. ${row.feasible?'Feasible':'Infeasible'}. Expected loss ${row.riskExact}.${row.optimal?' Exact optimum.':''}${row.selected?' Canonical representative.':''}`,'aria-pressed':state.candidate===id?'true':'false','data-card':id,'data-prx-focus-key':`candidate:${id}`,tabindex:state.candidate===id?0:-1,onclick:()=>ctx.set({candidate:id}),onkeydown:event=>{
     const shift={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[event.key];if(!shift)return;event.preventDefault();const rr=(rowIndex+shift[0]+ACTIONS.length)%ACTIONS.length,cc=(colIndex+shift[1]+ACTIONS.length)%ACTIONS.length,next=`p:${ACTIONS[cc].key}|${ACTIONS[rr].key}`;ctx.set({candidate:next});focusGrid(next);
    }},row.feasible?'Feasible':'Infeasible',ctx.h('br'),'Loss ',exact(ctx,row.riskExact,`card-${colIndex}-${rowIndex}-risk`),state.protected?ctx.h('span',{},ctx.h('br'),'J ',exact(ctx,row.jointProbabilityExact,`card-${colIndex}-${rowIndex}-J`)):ctx.h('span',{},ctx.h('br'),'Guard disabled'),row.optimal?ctx.h('strong',{},' · Optimal'):null,row.selected?ctx.h('span',{},' · Canonical'):null);
    gridButtons.push(button);return ctx.h('td',{},button);
   })));
   const cardGrid=table(ctx,['C / S',...ACTIONS.map(a=>a.name)],[], 'Complete candidate grid');cardGrid.classList.add('mds-grid');cardGrid.tBodies[0].replaceChildren(...body);grid.append(region(ctx,cardGrid,'All candidate cards'));
   detail.replaceChildren(ctx.panelTitle('The inspected card'),ctx.h('p',{},'S: ',named(ctx,actionName(inspection.grades,0)),'; C: ',named(ctx,actionName(inspection.grades,1)),'. Expected loss ',exact(ctx,inspection.riskExact,'focused-risk'),'. ',ctx.h('strong',{'data-prx-readout':'focused-status'},inspection.feasible?'Feasible':'Infeasible'),'. ',state.protected?ctx.h('span',{},'Direct joint-event probability ',exact(ctx,inspection.jointProbabilityExact,'focused-J'),'.'):ctx.h('span',{},'Joint guard disabled.')),gradeTable(ctx,inspection.grades),pairTable(ctx,inspection.grades));
   optima.replaceChildren(ctx.panelTitle('All minimum-risk feasible cards'),optimizerSummaryNode(ctx,fit),gradeTable(ctx,fit.selectedGrades,{caption:'Grades of the canonical representative'}),resultScopeNode(ctx,fit),candidateTable(ctx,fit,{jointEnabled:state.protected,onSelectCandidate:id=>ctx.set({candidate:id}),focusedId:state.candidate}));
   optima.append(ctx.h('p',{class:'mds-note'},'The feasible cards form a product only if every allowed column in one domain can be paired with every allowed column in the other. That can happen with dependent outcomes, and a joint cap can prevent it even with independent outcomes. The calculation uses the fictional distribution specified here.'));
   ctx.readout.set([s.isProduct?'Separate choices recover every optimum.':s.lowerBoundAttained?'A missing combination; the separate bound is attained.':'Joint protection changes the optimum.',' ',number(ctx,s.optimizerCount),s.optimizerCount===1?' exact optimum.':' exact optima.']);
   visual.setScope(['Supplied finite law · ',number(ctx,fit.searchScope.candidateCount),' candidate profiles. ',...(state.zeroWeight?['S loss weight ',exactNum(ctx,request.decision.weights[0]),state.protected?' · joint guard still covers S.':' · joint guard off.']:[state.protected?'Equal loss weights · joint guard on.':'Equal loss weights · joint guard off.'])]);
   drawFeasibleLattice(ctx,visual,r,state);
  }};
 }});
}
