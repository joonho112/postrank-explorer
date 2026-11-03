// Preferred directions, isolated-pair costs and statewise conflict are separate quantities.
import {createWidget} from '../shared/base.js';
import {plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatProb,formatRisk,formatSci,formatSetting} from '../shared/format.js';
import {conflictPairs,estimandCosts,finiteLawPairwise,pairCount,pairDecision,weightedError} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {CHAPTER19,CERTAIN_OPPOSITION,UNCERTAIN_AGREEMENT,finiteCriteria} from '../shared/criteria-laws.js';
import {CRITERIA_PROFILE_CSS,criterionProfileModel,createCriterionPairView,createCriterionConflictView,resolveCriterionPair,isCriterionPairKey} from './several-criteria.js';

const TIES={ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,-1],[0,0]],[[-1,1],[0,0]],[[0,0],[0,0]]],probs:[.4,.1,.5]};
const LAWS={ch19:CHAPTER19,opposition:CERTAIN_OPPOSITION,uncertain:UNCERTAIN_AGREEMENT,ties:TIES};
const TITLES={six:'Six sites · two scores',thirty:'Thirty sites · three criteria',ch19:'Four-unit law: B–C conflict',opposition:'Two certain opposing criteria',uncertain:'Uncertain, criteria agree',ties:'Latent equality'};
const name=(ctx,id)=>ctx.h('span',{'data-prx-name':'',text:id});
const number=(ctx,x,kind='cost',hook)=>{const display=kind==='count'?formatCount(x):kind==='prob'?formatProb(x):kind==='setting'?formatSetting(x):kind==='sci'?formatSci(x):kind==='value'?formatDecimal(x,{digits:3}):formatRisk(x),n=ctx.num(x,display);if(hook)n.dataset.prxReadout=hook;return n;};
export const PAIR_COST_CSS=`
.cp .cp-section{min-width:0;margin:.8rem 0}.cp .cp-controls{display:flex;flex-wrap:wrap;gap:.6rem;min-width:0;max-width:100%;width:100%}.cp .cp-controls .prx-select,.cp .cp-controls select{max-width:100%;min-width:0}
.cp .cp-source-group[hidden]{display:none}.cp .cp-source-group{display:contents}.cp .cp-cost-table{min-width:23rem}.cp .cp-state-table{min-width:36rem}
.cp .cp-best{font-weight:600}.cp .cp-weights{display:flex;flex-wrap:wrap;gap:.6rem}.cp .cp-note{font-size:.88rem;line-height:1.45}
`;
export const CONFLICT_PAIR_KEYS={data:{type:'choice',values:Object.keys(TITLES),value:'six'},pair:{type:'string',value:'auto'},w:{type:'number',min:0,max:1,step:.01,value:.5},tau:{type:'number',min:.01,max:.5,step:.01,value:.2}};
const finiteCache=new Map();
export function criterionPairCosts(E,pair,{w,tau,states,probs}={}){
 const [i,j]=pair,m=weightedError(E,w),criteria=E.e.map((matrix,k)=>({k,eIJ:matrix[i][j],eJI:matrix[j][i],decision:pairDecision(matrix[i][j],matrix[j][i],tau)}));
 return {E,criteria,weighted:{eIJ:m[i][j],eJI:m[j][i],decision:pairDecision(m[i][j],m[j][i],tau)},conflicts:conflictPairs(E),states:states?states.map((state,s)=>({prob:probs[s],decision:estimandCosts(state,{w,tau,a:state[0].map(()=>1/state[0].length),pair}).criterionLoss})):null};
}
function finiteInput(key){
 if(finiteCache.has(key))return finiteCache.get(key);
 const law=LAWS[key],E=finiteCriteria(law),data={key,ids:law.ids,criteria:law.criteria,criterionLabels:['first criterion','second criterion'],n:law.ids.length,K:law.criteria.length,M:pairCount(law.ids.length)},result={law,E,data};finiteCache.set(key,result);return result;
}
export function conflictPairModel(state={}){
 const key=state.data??'six',tau=state.tau??.2;
 let profile,law,data,E;
 if(key==='six'||key==='thirty'){profile=criterionProfileModel({data:key,pair:state.pair,level:90,orientB:'higher'});({data,E}=profile);}
 else ({law,data,E}=finiteInput(key));
 const [i,j]=state.pair==='auto'||!state.pair?key==='ch19'?[1,2]:key==='six'?[1,2]:[0,1]:resolveCriterionPair(data,state.pair),w=key==='thirty'?data.criteria.map(()=>1/data.K):[state.w??.5,1-(state.w??.5)];
 const cost=criterionPairCosts(E,[i,j],{w,tau,...(law?{states:law.states,probs:law.probs}:{})}),pair={i,j,criteria:profile?.pair.criteria??data.criteria.map((criterion,k)=>({criterion,eIJ:E.e[k][i][j],eJI:E.e[k][j][i],piIJ:E.pi[k][i][j],piJI:E.pi[k][j][i],equality:E.t[k][i][j]}))};
 return {...cost,data,pair,w,tau,law,kind:law?.states.length===1?'known state':'posterior',profile};
}
const words=(ids,pair,action)=>action==='withhold'?'Withhold':action==='iAboveJ'?`${ids[pair.i]} above ${ids[pair.j]}`:`${ids[pair.j]} above ${ids[pair.i]}`;
function visibleTable(ctx,headers,rows,cls){return ctx.h('table',{class:cls},ctx.h('thead',{},ctx.h('tr',{},...headers.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(v=>ctx.h('td',{},v))))));}
function scroll(ctx,parent,label,node){const root=ctx.h('div',{class:'sev-scroll'},node);ctx.scrollRegion(root,label);parent.append(root);}
/** A reusable isolated-pair view. It accepts any supplied-law cost model; no mount or global state. */
export function createPairCostView(ctx,slot,{title='Three actions for this pair on its own',descriptionPosition='before',description='A wrong strict direction costs its weighted criterion error. Withholding costs τ once. These are isolated-pair actions; a common grade report must also make every other pair coherent.'}={}){return {render(model){
 const {data,pair}=model,decision=model.decision??model.weighted.decision,kind=model.kind??'posterior',actions=['iAboveJ','jAboveI','withhold'],rows=actions.map(action=>({action,label:words(data.ids,pair,action),cost:decision.costs[action],best:decision.best.includes(action)}));
 const descriptionNode=ctx.h('p',{class:'cp-note'},description);slot.replaceChildren(ctx.panelTitle(title));if(descriptionPosition!=='after')slot.append(descriptionNode);
 const fig=ctx.h('div');slot.append(fig);
 plot(fig,{height:220,marginLeft:data.ids.some(id=>id.length>2)?150:110,marginRight:25,marginBottom:40,x:{domain:[0,1],label:kind==='known state'?'Cost at the known state':'Expected cost under the supplied law',grid:true},y:{domain:rows.map(r=>r.label),label:null},alt:'Three horizontal bars compare the forward direction, reverse direction and withholding cost. An outline marks every action sharing the smallest cost.',table:rows,keyboard:{data:rows,x:'cost',y:'label',title:r=>`${r.label}: ${formatRisk(r.cost)}${r.best?'; among the smallest costs':''}.`},marks:(c,P)=>[P.barX(rows,{x:'cost',y:'label',fill:r=>r.action==='withhold'?c.wh:c.err,stroke:r=>r.best?c.plotFocus:c.plotBg,strokeWidth:r=>r.best?2:0}),P.tip(rows,P.pointer({x:'cost',y:'label',title:r=>`${r.label}: ${formatRisk(r.cost)}`}))]});
 if(descriptionPosition==='after')slot.append(descriptionNode);
 for(const t of fig.querySelectorAll('svg text'))if(data.ids.some(id=>t.textContent.includes(id)))t.setAttribute('data-prx-name','');
 slot.append(ctx.h('p',{class:'cp-best'},number(ctx,decision.best.length,'count','best-count'),' smallest-cost action',decision.best.length===1?': ':'s: ',...decision.best.flatMap((action,i)=>[i?'; ':'',name(ctx,words(data.ids,pair,action))]),'. Equal-cost tolerance ',number(ctx,1e-12,'sci'),'.'));
 slot.append(ctx.h('p',{class:'sev-hint'},'Wide tables scroll within this panel; focus the table region and use the arrow keys.'));
 scroll(ctx,slot,'Three isolated-pair costs',visibleTable(ctx,['Action','Cost','Shares the smallest cost'],rows.map(r=>[name(ctx,r.label),number(ctx,r.cost,'cost',`cost-${r.action}`),r.best?'Yes':'No']),'cp-cost-table'));
 slot.append(ctx.h('p',{},kind==='known state'?'Statewise γ: the smaller directional cost is ':'Smaller expected directional cost: ',number(ctx,decision.directionalMinimum,'cost','directional-min'),'. Withholding is excluded from this minimum.'));
}};}
function stateView(ctx,slot,model){
 slot.replaceChildren();if(!model.law){slot.append(ctx.h('p',{class:'cp-note'},'The Gaussian marginal releases supply pair errors, but no finite table of known states. A posterior’s smaller directional cost mixes uncertainty and criterion conflict. It is not a statewise conflict floor.'));return;}
 slot.append(ctx.panelTitle('Known states and their directional costs'),ctx.h('p',{class:'cp-note'},'Every row is one complete state of the stipulated law. Statewise γ is the smaller weighted directional cost at that state. Its value can differ from the smaller expected cost above; uncertainty and conflict do not have a unique additive split.'),ctx.h('p',{class:'sev-hint'},'Wide tables scroll within this panel; focus the table region and use the arrow keys.'));
 const rows=model.law.states.map((state,s)=>[number(ctx,s+1,'count'),number(ctx,model.states[s].prob,'prob',`state-${s}-prob`),ctx.h('span',{},...state.flatMap((values,i)=>[i?'; ':'',name(ctx,model.data.ids[i]),': ',...values.flatMap((v,k)=>[k?', ':'',number(ctx,v,'value')])])),number(ctx,model.states[s].decision.costs.iAboveJ,'cost',`state-${s}-forward`),number(ctx,model.states[s].decision.costs.jAboveI,'cost',`state-${s}-reverse`),number(ctx,model.states[s].decision.directionalMinimum,'cost',`state-${s}-gamma`)]);
 scroll(ctx,slot,'Complete finite states and statewise directional minima',visibleTable(ctx,['State','Probability','All unit criterion values','First above second cost','Second above first cost','Statewise γ'],rows,'cp-state-table'));
}
function controls(ctx){
 const root=ctx.h('div',{class:'cp-controls'}),data=ctx.select({label:'Supplied law',name:'data',options:Object.entries(TITLES).map(([value,label])=>({value,label})),onChange:v=>ctx.set({data:v,pair:'auto'})}),w=ctx.slider({label:'Error weight on the first criterion',...ctx.key('w'),onInput:v=>ctx.set({w:v})}),tau=ctx.slider({label:'Cost of withholding this pair, τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})});root.append(data.root,w.root,tau.root);const pairs={};
 for(const key of Object.keys(TITLES)){const d=key==='six'||key==='thirty'?criteriaData(key):finiteInput(key).data,options=d.ids.flatMap((id,i)=>d.ids.flatMap((other,j)=>i===j?[]:[{value:`${id},${other}`,label:`${id} above ${other}`}])) ,pair=ctx.select({label:'Proposed pair direction',name:`pair-${key}`,options:[{value:'auto',label:'Source example pair'},...options],onChange:v=>ctx.set({pair:v})}),group=ctx.h('div',{class:'cp-source-group'},pair.root);root.append(group);pairs[key]={pair,group};}
 ctx.controls.append(root);return {render(state){data.set(state.data);w.set(state.w);tau.set(state.tau);w.root.hidden=state.data==='thirty';for(const key of Object.keys(TITLES)){pairs[key].group.hidden=key!==state.data;pairs[key].pair.set(state.pair);}}};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'conflict-pairs',className:'cp',css:PAIR_COST_CSS+CRITERIA_PROFILE_CSS,keys:CONFLICT_PAIR_KEYS,build(ctx){
 ctx.root.classList.add('sev');const control=controls(ctx),weights=ctx.h('div',{class:'cp-weights cp-section'}),costSlot=ctx.h('div',{class:'cp-section sev-paper'}),pairSlot=ctx.h('div',{class:'cp-section sev-paper'}),conflictSlot=ctx.h('div',{class:'cp-section sev-paper'}),stateSlot=ctx.h('div',{class:'cp-section sev-paper'}),scope=ctx.h('p',{class:'cp-note'});
 ctx.charts.append(weights,costSlot,pairSlot,conflictSlot,stateSlot,scope);ctx.charts.prepend(ctx.readout.node);const costView=createPairCostView(ctx,costSlot),pairView=createCriterionPairView(ctx,pairSlot),conflictView=createCriterionConflictView(ctx,conflictSlot);
 return {render(state){const model=conflictPairModel(state);if(!isCriterionPairKey(model.data,state.pair))ctx.set({pair:'auto'});control.render(state);costView.render(model);pairView.render(model);pairSlot.append(ctx.panelTitle('Each criterion on its own'));scroll(ctx,pairSlot,'Criterion-specific isolated decisions',visibleTable(ctx,['Criterion','Forward cost','Reverse cost','Withhold cost','Smaller directional cost','Smallest-cost actions'],model.criteria.map(r=>[model.data.criterionLabels[r.k],number(ctx,r.eIJ,'cost',`criterion-${r.k}-forward`),number(ctx,r.eJI,'cost',`criterion-${r.k}-reverse`),number(ctx,r.decision.costs.withhold,'cost',`criterion-${r.k}-withhold`),number(ctx,r.decision.directionalMinimum,'cost',`criterion-${r.k}-min`),name(ctx,r.decision.best.map(action=>words(model.data.ids,model.pair,action)).join('; '))]),'cp-state-table'));conflictView.render(model);stateView(ctx,stateSlot,model);weights.replaceChildren(...model.w.flatMap((v,k)=>[ctx.h('span',{},model.data.criterionLabels[k],': weight ',number(ctx,v,'setting',`weight-${k}`))]));scope.textContent='The opposing-pair map compares every criterion, including a criterion with zero error weight. A positive cost from certain opposition requires positive weight on both strict sides. An isolated pair choice does not identify a full report’s grade.';ctx.readout.set([name(ctx,model.data.ids[model.pair.i]),' above ',name(ctx,model.data.ids[model.pair.j]),': costs ',number(ctx,model.weighted.eIJ,'cost','readout-forward'),', ',number(ctx,model.weighted.eJI,'cost','readout-reverse'),', and ',number(ctx,model.tau,'cost','readout-withhold'),' for forward, reverse, and withholding. ',number(ctx,model.conflicts.count,'count','readout-conflicts'),model.conflicts.count===1?' pair has opposing preferred directions.':' pairs have opposing preferred directions.']);ctx.caption.replaceChildren('Supplied synthetic laws and restated teaching examples after the postrank theory book. Strict statements count equality as wrong; a shared grade withholds a comparison. Synthetic data license CC BY ',ctx.num(4,formatDecimal(4,{digits:1})),'.');}};
}});}
