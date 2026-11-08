// Four nonexclusive diagnostics. Every optimum and risk account is a public engine result.
import {createWidget} from '../shared/base.js';
import {plot,palette} from '../shared/chart.js';
import {formatCount,formatDecimal,formatExpectedCount,formatGrades,formatProb,formatRisk,formatSci,formatSetting,formatShare,formatSigned} from '../shared/format.js';
import {familySizeNode,tagNode} from '../shared/labels.js';
import {compareReports,evaluateReport,expectedRank,pairCertainty,pairConstrainedOptimum,pairCount,relations,scoreOrder} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {CHAPTER19,ORDER_THREE,uncertainDirectionLaw,finiteCriteria} from '../shared/criteria-laws.js';
import {PAIR_COST_CSS,criterionPairCosts,createPairCostView} from './conflict-pairs.js';
import {CRITERIA_PROFILE_CSS,criterionProfileModel,createCriterionPairView} from './several-criteria.js';
import {REPORT_CARD_CSS,cardRows,drawReportCard,gaussianCard} from './report-card.js';
import CDE from '../../data/released/case-cde.json' with {type:'json'};
import KRW from '../../data/released/case-krw.json' with {type:'json'};

const TITLES={six:'Six sites · two scores',ch19:'Four-unit law · certain criterion opposition',uncertain:'Two units · uncertain agreeing criteria',order:'Three units · declared order',cde:'CDE teaching subset · twelve schools',krw:'KRW · all firms, fixed expected-rank order'};
const DEFAULTS={six:{tau:.2,cap:'all'},ch19:{tau:.2,cap:'all'},uncertain:{tau:.2,cap:'all'},order:{tau:.25,cap:'all'},cde:{tau:.25,cap:'3'},krw:{tau:.25,cap:'4'}};
const CAPS={six:['all','1','2','3','4','exact1'],ch19:['all','1','2','3','4','exact1'],uncertain:['all','1','2','exact1'],order:['all','1','2','3','exact1'],cde:['1','2','3'],krw:['all','1','2','3','4']};
const capWords=v=>v==='all'?'No grade cap':v==='exact1'?'Exactly one grade':`At most ${v} grades`;
export const WHY_WITHHELD_KEYS={data:{type:'choice',values:Object.keys(TITLES),value:'six'},tau:{type:'number',min:.01,max:.5,step:.01,value:.2},cap:{type:'choice',values:['all','1','2','3','4','exact1'],value:'all'},restriction:{type:'choice',values:['source','blocked'],value:'source'},pair:{type:'string',value:'auto'},report:{type:'integer',min:0,max:100,value:0},forward:{type:'integer',min:0,max:100,value:0},reverse:{type:'integer',min:0,max:100,value:0}};
export const WHY_WITHHELD_CSS=`
.why .why-controls{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr);align-items:end;gap:.55rem .8rem;width:100%;min-width:0}
.why .why-controls select{width:100%}
.why .why-settings{display:flex;flex-wrap:wrap;gap:.55rem .8rem;align-items:end;min-width:0}
.why .why-settings .prx-control,.why .why-settings select{max-width:100%;min-width:0}
.why .why-overview{display:grid;grid-template-columns:minmax(18rem,2fr) minmax(0,3fr);align-items:start;gap:.65rem 1rem}
.why .why-overview > section{margin:0;min-width:0}
.why .why-overview .why-legend{font-size:.8em;gap:.15rem .5rem;margin:.35rem 0 0}
.why .why-matrix-large{max-height:19rem;overflow:auto;overscroll-behavior:contain}
.why .why-tests h4{margin:0 0 .25rem}
.why .why-test{padding:.24rem 0;border-top:1px solid var(--prx-plot-grid);font-size:.9em;line-height:1.36}
.why .why-test p{margin:.12rem 0}
.why .why-test-items{display:flex;flex-wrap:wrap;gap:.15rem .65rem}
.why .why-cost{display:grid;gap:.07rem;min-width:5rem}
.why .why-mini{height:4px;width:100%;background:linear-gradient(to right,var(--prx-plot-fg) var(--why-cost),var(--prx-plot-grid) var(--why-cost));border-radius:3px}
.why .why-test-caveat{margin:.3rem 0 0;font-size:.85em;color:var(--prx-plot-muted)}
.why .why-account-overview{margin:.75rem 0 0}
.why .prx-disclosure[data-prx-disclosure="tests"] > .prx-disclosure-body{margin-inline:-.8rem}
@media(max-width:46rem){
 .why .why-overview{grid-template-columns:minmax(0,1fr);gap:.4rem}
 .why .why-controls{grid-template-columns:repeat(2,minmax(0,1fr))}
 .why .why-controls > :first-child{grid-column:1/-1}
}
.why .why-controls .prx-select,.why .why-controls select{max-width:100%;min-width:0}.why .why-group{display:contents}.why .why-group[hidden]{display:none}
.why .why-section{margin:1rem 0;min-width:0}.why .why-paper{padding:.7rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border-radius:.4rem;min-width:0}.why .why-paper .prx-panel-title,.why .why-paper .prx-result-tag,.why .why-paper label{color:var(--prx-plot-fg)}
.why .why-scroll{overflow-x:auto;max-width:100%;min-width:0}.why .why-table{border-collapse:collapse;font-size:.84rem;min-width:42rem;width:100%}.why .why-table th,.why .why-table td{padding:.4rem .55rem;text-align:right;white-space:nowrap;border-bottom:1px solid var(--prx-plot-grid)}.why .why-table th:first-child,.why .why-table td:first-child{text-align:left}
.why .why-grade{overflow-wrap:anywhere;white-space:normal;display:inline-block;max-width:35rem}.why .why-note{font-size:.88rem;line-height:1.45}.why .why-paper .why-note,.why .why-paper .sev-hint{color:var(--prx-plot-muted)}.why .why-status{font-weight:600}.why .why-legend{display:flex;flex-wrap:wrap;gap:.8rem}.why .why-key{display:inline-block;width:.8rem;height:.8rem;margin-right:.3rem;border:1px solid var(--prx-plot-grid)}
.why .why-section select{max-width:100%}.why .why-order{overflow-wrap:anywhere}.why .prx-readout{background:var(--prx-plot-bg);color:var(--prx-plot-fg)}.why .why-card{min-width:0}.why .why-card svg{max-width:100%}
`;
const inputs=new Map(),solves=new Map();
const errors=a=>({ids:a.ids.slice(),criteria:a.criteria.slice(),e:a.e.map(m=>m.map(row=>row.map(v=>v===null?NaN:v)))});
/** Released inputs and declared tiny laws, with the order computed once and never refitted to a counterfactual. */
export function whyWithheldInput(key='six'){
 if(inputs.has(key))return inputs.get(key);
 let data,E,law,cards=[],order=null,w;
 if(key==='six'){
  data=criteriaData('six');E=data.E;w=[.5,.5];const rank=expectedRank(E,{w});cards=data.criteria.map((criterion,k)=>gaussianCard({ids:E.ids,names:data.labels,mean:data.means.map(r=>r[k]),sd:data.sds.map(r=>r[k]),level:.9,expectedRank:rank,storedOrder:'expected_rank',axis:data.criterionLabels[k],title:`Baseline report · ${data.criterionLabels[k]}`,grade1:'Grade one states higher oriented scores; same grade withholds.',unit:'site',units:'sites',digits:3}));
 }else if(['ch19','uncertain','order'].includes(key)){
  law=key==='ch19'?CHAPTER19:key==='order'?ORDER_THREE:uncertainDirectionLaw(.6);
  E=finiteCriteria(law);w=key==='ch19'?[.6,.4]:[.5,.5];data={key,ids:law.ids,labels:law.ids,criteria:law.criteria,criterionLabels:['first criterion','second criterion'],n:E.ids.length,K:E.criteria.length,M:pairCount(E.ids.length)};if(key==='order')order=[0,1,2];
 }else{
  const source=key==='cde'?CDE:KRW,u=source.tables.units;E=errors(source.arrays.error);w=key==='cde'?[1]:[.5,.5];const rank=expectedRank(E,{w});if(key==='krw')order=scoreOrder(rank,{direction:'ascending',ids:E.ids}).order;
  data={key,ids:key==='cde'?u.label:E.ids,labels:key==='cde'?u.label:u.firm_name,criteria:E.criteria,criterionLabels:key==='cde'?['negative chronic-absence probability']:['white-name contact advantage','male-name contact advantage'],n:E.ids.length,K:E.criteria.length,M:pairCount(E.ids.length),source};
  cards=E.criteria.map((criterion,k)=>{const stem=key==='cde'?'':k===0?'_race':'_gender';return {ids:E.ids,names:data.ids,fullNames:data.labels,mean:u['mean'+stem],lower:u['lower'+stem],upper:u['upper'+stem],expectedRank:rank,storedOrder:'expected_rank',level:source.facts.interval_level,intervalSource:'supplied central',axis:data.criterionLabels[k],title:`Baseline report · ${data.criterionLabels[k]}`,grade1:key==='cde'?'Grade one states lower chronic absence, as the posterior judges it.':'Grade one states larger oriented contact advantage, as the posterior judges it.',unit:key==='cde'?'school':'firm',units:key==='cde'?'schools':'firms',digits:3};});
 }
 const result={key,data,E,law,cards,order,w};inputs.set(key,result);return result;
}
export function whyWithheldFamily(input,state){
 const {key,order}=input,cap=CAPS[key].includes(state.cap)?state.cap:DEFAULTS[key].cap;
 if(order)return {kind:'order',order,...(cap==='exact1'?{exact:1}:cap!=='all'?{G:Number(cap)}:{}),...(key==='order'&&state.restriction==='blocked'?{blocks:[1,2]}:{})};
 return cap==='all'?{kind:'all'}:cap==='exact1'?{kind:'exactly',G:1}:{kind:'atMost',G:Number(cap)};
}
function pairIndices(input,key){const d=input.data,parts=String(key).split(','),i=d.ids.indexOf(parts[0]),j=d.ids.indexOf(parts[1]);return i>=0&&j>=0&&i!==j?[i,j]:input.key==='ch19'?[1,2]:input.key==='cde'?[5,8]:input.key==='krw'?[55,35]:input.key==='order'?[1,2]:[0,1];}
function relaxation(input,family){
 if(family.kind==='all'||(input.key==='krw'&&family.G===undefined))return null;
 if(input.key==='cde')return family.G<3?{family:{kind:'atMost',G:3},words:'Expand the cap to three, within the same teaching subset'}:null;
 if(input.key==='krw')return {family:{kind:'order',order:input.order},words:'Remove the cap and keep exactly the same expected-rank order'};
 if(input.key==='order')return family.blocks?{family:{...family,blocks:undefined},words:'Remove the indivisible block and retain the declared A, B, C order'}:{family:{kind:'all'},words:'Remove the order restriction; search every coherent report'};
 return {family:{kind:'all'},words:'Remove the grade-count restriction; search every coherent report'};
}
const retainedGrades=r=>{if(r.empty)return [];const grades=r.grades??[r.grade],key=r.grade.join(',');return [r.grade,...grades.filter(g=>g.join(',')!==key)];};
/** Staged public composition. A caller can abandon obsolete work between complete engine calls. */
export async function solveWhyWithheld(state,{stage=async()=>{},isCurrent=()=>true}={}){
 const input=whyWithheldInput(state.data),family=whyWithheldFamily(input,state),[i,j]=pairIndices(input,state.pair),{E,w}=input,tau=state.tau;
 async function solve(f,stating,title){const key=JSON.stringify([input.key,tau,f,stating]);if(!solves.has(key)){await stage(title);if(!isCurrent())return null;const result=pairConstrainedOptimum(E,{tau,w,family:f,stating,maxTies:100});solves.set(key,result);if(solves.size>160)solves.delete(solves.keys().next().value);}return solves.get(key);}
 const baseline=await solve(family,[],'Finding the baseline report');if(!baseline||!isCurrent())return null;
 const reports=retainedGrades(baseline),selected=Math.min(state.report,reports.length-1),grade=reports[selected],forward=await solve(family,[[i,j]],'Finding the cheapest forward report');if(!forward||!isCurrent())return null;
 const reverse=await solve(family,[[j,i]],'Finding the cheapest reverse report');if(!reverse||!isCurrent())return null;
 const relaxed=relaxation(input,family);let relaxedBaseline=null,relaxedForward=null,relaxedReverse=null;
 if(relaxed){relaxedBaseline=await solve(relaxed.family,[],'Checking the relaxed baseline');if(!relaxedBaseline||!isCurrent())return null;relaxedForward=await solve(relaxed.family,[[i,j]],'Checking the relaxed forward direction');if(!relaxedForward||!isCurrent())return null;relaxedReverse=await solve(relaxed.family,[[j,i]],'Checking the relaxed reverse direction');if(!relaxedReverse||!isCurrent())return null;}
 const profile=r=>retainedGrades(r).map(g=>({grade:g,evaluation:evaluateReport(g,E,{tau,w}),comparison:compareReports(grade,g,E,{tau,w})}));
 let criterionPair;
 if(input.key==='six')criterionPair=criterionProfileModel({data:'six',pair:`${E.ids[i]},${E.ids[j]}`}).pair.criteria;
 else criterionPair=E.criteria.map((criterion,k)=>({criterion,eIJ:E.e[k][i][j],eJI:E.e[k][j][i],piIJ:E.pi?.[k][i][j]??null,piJI:E.pi?.[k][j][i]??null,equality:E.t?.[k][i][j]??null}));
 const cost=criterionPairCosts(E,[i,j],{tau,w,...(input.law?{states:input.law.states,probs:input.law.probs}:{})});
 return {...input,...cost,input,state,family,tau,w,pair:{i,j,criteria:criterionPair},kind:'posterior',baseline,grade,selected,baselineProfiles:profile(baseline),forward,reverse,forwardProfiles:profile(forward),reverseProfiles:profile(reverse),relaxed,relaxedBaseline,relaxedForward,relaxedReverse,relaxedBaselineProfiles:relaxed?profile(relaxedBaseline):[],relaxedForwardProfiles:relaxed?profile(relaxedForward):[],relaxedReverseProfiles:relaxed?profile(relaxedReverse):[]};
}
const nm=(ctx,s)=>ctx.h('span',{'data-prx-name':'',text:s});
function sourceProse(ctx,text){const out=[];let last=0;for(const m of text.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)){out.push(text.slice(last,m.index),ctx.num(Number(m[0].replaceAll(',','')),m[0]));last=m.index+m[0].length;}out.push(text.slice(last));return out;}
function n(ctx,x,kind='risk',hook){const f=kind==='count'?formatCount:kind==='expected'?formatExpectedCount:kind==='share'?formatShare:kind==='prob'?formatProb:kind==='grade'?formatGrades:kind==='sci'?formatSci:kind==='setting'?formatSetting:kind==='value'?v=>formatDecimal(v,{digits:3}):kind==='signed'?v=>formatSigned(v,{digits:6}):formatRisk;const node=ctx.num(x,f(x));if(hook)node.dataset.prxReadout=hook;return node;}
const gradeNode=(ctx,g,hook)=>{const node=n(ctx,g,'grade',hook);node.classList.add('why-grade');return node;};
function table(ctx,headers,rows){return ctx.h('table',{class:'why-table'},ctx.h('thead',{},ctx.h('tr',{},...headers.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(v=>ctx.h('td',{},v))))));}
function wide(ctx,parent,title,node){const wrap=ctx.h('div',{class:'why-scroll'},node);ctx.scrollRegion(wrap,title);parent.append(wrap);return wrap;}
const hint=(ctx)=>ctx.h('p',{class:'why-note'},'Wide tables and matrices scroll inside their panel. Focus the region and use the arrow keys.');
function tieLine(ctx,r,hook){if(r.empty)return ctx.h('p',{class:'why-status'},'No admissible report states this direction. Candidate count ',n(ctx,r.family.size,'count',`${hook}-family`),'. This is infeasible in the declared family, rather than a feasible report with a high cost.');return ctx.h('p',{},tagNode(ctx,r,{key:hook,orderWords:ctx.state.data==='krw'?'the fixed weighted expected-rank order':'the declared A, B, C order'}),'. ',n(ctx,r.tieCount,'count',`${hook}-ties`),r.tieCount===1?' report has the smallest risk; ':' reports share the smallest risk; ',n(ctx,retainedGrades(r).length,'count'),' retained below. Equal-risk tolerance ',n(ctx,r.tieTol,'sci'),'. ',r.tieCount>retainedGrades(r).length?'The retained list is truncated; the total count includes the omitted reports.':'The retained list is complete.');}
function profilesTable(ctx,model,profiles,prefix){const {data:d}=model;return table(ctx,['Report (source unit order)','Risk','N: stated pairs','Extra risk vs selected baseline',...d.criterionLabels.flatMap(k=>[`${k}: E`,`${k}: E/N`,`${k}: E/M`,`${k}: criterion risk`])],profiles.map((r,index)=>[gradeNode(ctx,r.grade,`${prefix}-grade-${index}`),n(ctx,r.evaluation.risk,'risk',`${prefix}-risk-${index}`),n(ctx,r.evaluation.N,'count',`${prefix}-N-${index}`),n(ctx,r.comparison.deltaRisk,'signed',`${prefix}-delta-${index}`),...d.criterionLabels.flatMap((_,k)=>[n(ctx,r.evaluation.E[k],'expected',`${prefix}-E-${index}-${k}`),n(ctx,r.evaluation.EoverN[k],'share',`${prefix}-share-${index}-${k}`),n(ctx,r.evaluation.EoverM[k],'share',`${prefix}-perpair-${index}-${k}`),n(ctx,r.evaluation.Rk[k],'risk',`${prefix}-Rk-${index}-${k}`)])]));}
function relationWords(model,r,i,j){return r===0?'Withheld':r===1?`${model.data.ids[i]} above ${model.data.ids[j]}`:`${model.data.ids[j]} above ${model.data.ids[i]}`;}
function accounting(ctx,slot,model,profile,prefix,{rows=true}={}){const c=profile.comparison;slot.append(ctx.h('p',{},'Signed risk change ',n(ctx,c.deltaRisk,'signed',`${prefix}-delta`),' = error-term change ',n(ctx,c.errorTermDelta,'signed',`${prefix}-error`),' + withholding-term change ',n(ctx,c.withholdingTermDelta,'signed',`${prefix}-withhold`),'. All ',n(ctx,c.pairs.length,'count',`${prefix}-changed`),' changed unordered pairs appear below. The normalized signed differences sum to the risk change; negative entries offset positive entries.'));
 if(!rows)return;
 wide(ctx,slot,'Complete signed changed-pair account',table(ctx,['Pair','Baseline relation','Counterfactual relation','Before cost','After cost','Signed cost change','Signed risk change (cost / M)'],c.pairs.map((r,index)=>[nm(ctx,`${model.data.ids[r.i]} / ${model.data.ids[r.j]}`),nm(ctx,relationWords(model,r.beforeRelation,r.i,r.j)),nm(ctx,relationWords(model,r.afterRelation,r.i,r.j)),n(ctx,r.beforeCost,'risk',`${prefix}-before-${index}`),n(ctx,r.afterCost,'risk',`${prefix}-after-${index}`),n(ctx,r.costDifference,'signed',`${prefix}-cost-${index}`),n(ctx,r.normalizedDifference,'signed',`${prefix}-normalized-${index}`)])));
}
export function createWhyWithheldSlots(ctx,parent=ctx.charts){const result={};for(const key of ['matrix','baseline','cost','criterion','coherent','family','cards','source']){result[key]=ctx.h('section',{class:'why-section why-paper prx-light-panel'});parent.append(result[key]);}return result;}
function criterionChecks(model) {
 const {E,pair,data}=model;
 const thresholds=[.9,.99];
 return model.criteria.map((row,k)=>{
  const e=[[NaN,E.e[k][pair.i][pair.j]],[E.e[k][pair.j][pair.i],NaN]];
  const check=pairCertainty({ids:[E.ids[pair.i],E.ids[pair.j]],criteria:[E.criteria[k]],e:[e]},{thresholds});
  return {...row,label:data.criterionLabels[k],direction:row.eIJ<row.eJI?1:row.eJI<row.eIJ?-1:0,counts:check.counts};
 });
}

function largestAdded(profile) {
 return profile.comparison.pairs.reduce((best,row)=>row.costDifference>(best?.costDifference??0)?row:best,null);
}

function selectedPairSummary(ctx, model) {
 const {data,grade,pair,forwardProfiles,baselineProfiles}=model;
 const r=relations(grade)[pair.i][pair.j],a=data.ids[pair.i],b=data.ids[pair.j];
 const baseline=baselineProfiles[model.selected].evaluation;
 const summary=[nm(ctx,a),' / ',nm(ctx,b),r===0?' is withheld. ':' is stated as ',...(r===0?[]:[nm(ctx,relationWords(model,r,pair.i,pair.j)),'. ']),
  'Baseline risk ',n(ctx,baseline.risk,'risk','selected-risk'),'. '];
 if(r!==0){
  summary.push(baseline.N<data.M?'Select a gray cell for a withheld comparison.':'This report states every pair.');
  return summary;
 }
 const forward=model.weighted.decision.costs.iAboveJ;
 summary.push('On its own ',nm(ctx,`${a} above ${b}`),' costs ',n(ctx,forward),forward<model.tau?' below ':forward>model.tau?' above ':' at ','τ ',n(ctx,model.tau,'setting'),'. ');
 const preferred=model.criteria.map(c=>c.eIJ<c.eJI?1:c.eJI<c.eIJ?-1:0);
 if(preferred.every(sign=>sign===1)||preferred.every(sign=>sign===-1)){
  summary.push(preferred.length===1?'The supplied criterion favors ':'The criteria agree on ',nm(ctx,preferred[0]===1?`${a} above ${b}`:`${b} above ${a}`),'. ');
 } else if(preferred.includes(1)&&preferred.includes(-1))summary.push('The criteria favor opposing directions. ');
 if(!forwardProfiles.length)summary.push('The declared family has no report stating that direction. ');
 else {
  const p=forwardProfiles[0],largest=largestAdded(p);
  summary.push('Requiring it changes risk by ',n(ctx,p.comparison.deltaRisk,'signed'),'. ');
  if(largest)summary.push('Largest added pair cost is ',nm(ctx,`${data.ids[largest.i]} / ${data.ids[largest.j]}`),' ',n(ctx,largest.costDifference,'signed'),'. ');
 }
 summary.push('The tests can overlap.');
 return summary;
}

function drawTestStrip(ctx, slot, model, checks) {
 const {h}=ctx,{data,grade,pair,weighted}=model;
 const a=data.ids[pair.i],b=data.ids[pair.j],r=relations(grade)[pair.i][pair.j];
 const forward=`${a} above ${b}`,reverse=`${b} above ${a}`;
 const baseline=model.baselineProfiles[model.selected].evaluation;
 const direction=sign=>sign===1?forward:sign===-1?reverse:'Equal directional errors';
 const action=key=>key==='iAboveJ'?forward:key==='jAboveI'?reverse:'Withhold';
 const facts=(title,...children)=>h('div',{class:'why-test'},h('strong',{},title),...children);
 const header=r===0?[nm(ctx,a),' / ',nm(ctx,b),' share grade ',n(ctx,grade[pair.i],'count'),'. Their comparison is withheld.']
  :[nm(ctx,a),' / ',nm(ctx,b),' is stated as ',nm(ctx,direction(r)),'.'];
 const mini=h('div',{class:'why-test-items'},...Object.entries(weighted.decision.costs).map(([key,value])=>
  h('span',{class:'why-cost'},h('span',{},nm(ctx,action(key)),' ',n(ctx,value)),h('span',{class:'why-mini','aria-hidden':'true',style:{'--why-cost':`${value*100}%`}}))));
 const signs=new Set(checks.map(c=>c.direction).filter(Boolean));
 const agree=checks.length===1?'One criterion':signs.size>1?'Criteria favor opposing directions':checks.every(c=>c.direction!==0)?'Criteria agree':'Some criterion errors are equal';
 const criterionLine=h('div',{class:'why-test-items'},...checks.map(c=>h('span',{},c.label,' · ',nm(ctx,direction(c.direction)),' ',n(ctx,Math.min(c.eIJ,c.eJI),'prob'))));
 const thresholdCounts=checks.reduce(([a,b],c)=>[a+c.counts[0],b+c.counts[1]],[0,0]);
 const riskLine=(title,profiles)=>{
  const p=profiles[0];
  if(!p)return h('p',{},nm(ctx,title),'. No admissible report (',n(ctx,0,'count'),' candidates).');
  const largest=largestAdded(p);
  return h('p',{},nm(ctx,title),' ',n(ctx,p.comparison.deltaRisk,'signed'),' · risk ',n(ctx,p.evaluation.risk),' · N ',n(ctx,p.evaluation.N,'count'),
   ' · ',n(ctx,p.comparison.pairs.length,'count'),' pairs change',
   ...(largest?[' · largest added ',nm(ctx,`${data.ids[largest.i]} / ${data.ids[largest.j]}`),' ',n(ctx,largest.costDifference,'signed')]:[]));
 };
 const familySize=familySizeNode(ctx,{family:model.baseline.baseFamily});
 const family=model.relaxed?[h('p',{},model.relaxed.words,'. Baseline risk ',n(ctx,model.relaxedBaselineProfiles[0].evaluation.risk),'.'),
  ...[[forward,model.relaxedForwardProfiles],[reverse,model.relaxedReverseProfiles]].map(([title,profiles])=>h('p',{},nm(ctx,title),' · ',profiles.length?['risk ',n(ctx,profiles[0].evaluation.risk)]:['no admissible report (',n(ctx,0,'count'),' candidates)']))]:
  [h('p',{},model.key==='cde'?'Largest supplied family':model.key==='krw'?'No cap to remove within this order':'Nothing to relax',' · ',familySize,' candidates.')];
 if(model.relaxed)family.push(h('p',{},'Original family ',familySize,' candidates.'));
 slot.replaceChildren(ctx.panelTitle(header),
  ...(r!==0?[h('p',{class:'why-test-caveat'},baseline.N<data.M?'Select a gray cell for a withheld comparison.':'This report states every pair.')]:[]),
  facts('Isolated pair',mini,h('p',{},'Cheapest alone · ',...weighted.decision.best.flatMap((key,i)=>[i?' · ':'',nm(ctx,action(key))]))),
  facts('Criteria',criterionLine,h('p',{},agree,' · ',n(ctx,thresholdCounts[0],'count'),' below ',n(ctx,.10,'setting'),' · ',n(ctx,thresholdCounts[1],'count'),' below ',n(ctx,.01,'setting'))),
  facts('Coherent report',riskLine(forward,model.forwardProfiles),riskLine(reverse,model.reverseProfiles)),
  facts('Family',...family),
  h('p',{class:'why-test-caveat'},'The tests can overlap.'),
 );
}

function drawKrwAccountSummary(ctx, slot, model) {
 const {h}=ctx;
 slot.hidden=model.key!=='krw';
 if(slot.hidden){slot.replaceChildren();return;}
 const rows=[];
 for(const key of ['forward','reverse']){
  const profiles=model[`${key}Profiles`];
  if(!profiles.length)continue;
  const profile=profiles[Math.min(model.state[key],profiles.length-1)],c=profile.comparison;
  const transitions={stated:0,withheld:0,reversed:0};
  for(const row of c.pairs){
   if(row.beforeRelation===0)transitions.stated++;
   else if(row.afterRelation===0)transitions.withheld++;
   else transitions.reversed++;
  }
  const {i,j}=model.pair;
  const direction=key==='forward'?[i,j]:[j,i];
  const contributors=c.pairs.slice().sort((a,b)=>Math.abs(b.costDifference)-Math.abs(a.costDifference)).slice(0,2);
  rows.push(h('p',{},nm(ctx,`${model.data.ids[direction[0]]} above ${model.data.ids[direction[1]]}`),' · ',
   n(ctx,c.pairs.length,'count'),' changes (',n(ctx,transitions.stated,'count'),' newly stated, ',n(ctx,transitions.withheld,'count'),' newly withheld, ',n(ctx,transitions.reversed,'count'),' reversed). Error term ',
   n(ctx,c.errorTermDelta,'signed'),' · withholding term ',n(ctx,c.withholdingTermDelta,'signed'),
   ...(contributors.length?['. Largest signed contributions ',...contributors.flatMap((r,i)=>[i?' · ':'',nm(ctx,`${model.data.ids[r.i]} / ${model.data.ids[r.j]}`),' ',n(ctx,r.costDifference,'signed')])]:[]),'.'));
 }
 slot.replaceChildren(ctx.panelTitle('Changed-pair account overview'),...rows);
}

/** Actual linked diagnostic view, used here; no implicit mount or hidden state. */
export function createWhyWithheldView(ctx,slots,{onPair=()=>{}}={}){
 const costView=createPairCostView(ctx,slots.cost,{title:'Test one · the isolated pair',descriptionPosition:'after'}),pairView=createCriterionPairView(ctx,slots.criterion),matrixFigure=ctx.h('div');let focusedPair=null;
 const conditioning=slots.tests?ctx.h('p',{class:'prx-caption',hidden:true}):null;
 if(conditioning)ctx.caption.after(conditioning);
 ctx.listen(slots.matrix,'keydown',e=>{if(!e.target.closest('.prx-kbd-point'))return;if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key))ctx.timeout(()=>e.target.isConnected&&e.target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}),0);if((e.key==='Enter'||e.key===' ')&&focusedPair){e.preventDefault();onPair(focusedPair);}});
 function direction(slot,model,result,profiles,prefix,key,title){const titleNode=ctx.panelTitle(title);titleNode.setAttribute('data-prx-name','');slot.append(titleNode,tieLine(ctx,result,prefix));if(result.empty)return;wide(ctx,slot,title,profilesTable(ctx,model,profiles,prefix));const chosen=Math.min(model.state[key],profiles.length-1),control=ctx.select({label:'Report for the complete changed-pair account',name:`account-${key}`,options:profiles.map((p,i)=>({value:i,label:`Retained report ${i+1}`})),onChange:v=>ctx.set({[key]:v})});control.set(chosen);for(const [i,o]of [...control.root.querySelectorAll('option')].entries()){o.replaceChildren(n(ctx,i+1,'count'));}slot.append(control.root);if(!slots.accounts)accounting(ctx,slot,model,profiles[chosen],`${prefix}-account`);}
 function renderAccounts(model) {
  if(!slots.accounts)return;
  const {h}=ctx,{data,pair}=model;
  const sections=['forward','reverse'].flatMap(key=>{
   const profiles=model[`${key}Profiles`];
   if(!profiles.length)return [];
   const chosen=Math.min(model.state[key],profiles.length-1);
   const orientation=key==='forward'?[pair.i,pair.j]:[pair.j,pair.i];
   const slot=h('section',{class:'why-section why-paper prx-light-panel'},ctx.panelTitle(nm(ctx,`${data.ids[orientation[0]]} above ${data.ids[orientation[1]]}`)));
   accounting(ctx,slot,model,profiles[chosen],`${key}-account`,{rows:model.key!=='krw'||slots.accounts.open});
   return [slot];
  });
  slots.accounts.root.hidden=!sections.length;
  slots.accounts.body.replaceChildren(...sections);
 }
 return {renderAccounts,render(model){const {data:d,baseline,grade,pair,forward,reverse,law}=model;
  const checks=criterionChecks(model);
  slots.baseline.replaceChildren(ctx.panelTitle('Selected baseline report'),ctx.h('p',{},'Grade one states higher oriented priority. A shared grade means “not compared”, not equality. ',nm(ctx,d.ids[pair.i]),' / ',nm(ctx,d.ids[pair.j]),': ',nm(ctx,relationWords(model,relations(grade)[pair.i][pair.j],pair.i,pair.j)),'.'),tieLine(ctx,baseline,'baseline'),ctx.h('p',{},'M = ',n(ctx,d.M,'count','M'),' unordered pairs; N counts pairs in different grades. E is the expected wrong-direction count for one criterion; E/N is its expected wrong share among statements. Risk charges withholding once at τ = ',n(ctx,model.tau,'setting','tau'),'.'),ctx.h('p',{},'Fixed error weights: ',...model.w.flatMap((v,k)=>[k?'; ':'',d.criterionLabels[k],' ',n(ctx,v,'setting',`weight-${k}`)])),hint(ctx));
  wide(ctx,slots.baseline,'Every retained baseline optimum',profilesTable(ctx,model,model.baselineProfiles,'baseline'));
  const matrixInstructions=ctx.h('p',{class:'why-note'},'Rows and columns follow the selected baseline’s grade order. Click a cell, or focus the matrix, use arrow keys, then Enter or Space to select its pair. The native pair control also includes every direction.');
  slots.matrix.replaceChildren(ctx.panelTitle('Choose a pair in the baseline relation matrix'));
  if(!slots.tests)slots.matrix.append(matrixInstructions,hint(ctx));
  const order=cardRows(model.cards[0]??{ids:model.E.ids,storedOrder:'input'},grade,'grade'),ids=order.map(i=>d.ids[i]),rel=relations(grade),cells=order.flatMap(i=>order.map(j=>({i,j,row:d.ids[i],column:d.ids[j],relation:rel[i][j]}))),fig=matrixFigure,cellSize=slots.tests?24:18,matrixWidth=Math.max(Math.round(slots.matrix.clientWidth||320)-24,d.n*cellSize+95);fig.style.width=`${matrixWidth}px`;fig.style.minWidth=`${matrixWidth}px`;const matrixRegion=wide(ctx,slots.matrix,'Complete unit relation matrix',fig);
  if(slots.tests){
   ctx.primaryGraphic(matrixRegion);
   matrixRegion.classList.toggle('why-matrix-large',d.n>12);
  }
  const compactMatrix=Boolean(slots.tests)&&d.n<=8;
  const matrixHeight=compactMatrix?Math.max(225,d.n*cellSize+55):Math.max(250,d.n*cellSize+95),marginBottom=compactMatrix?45:65;
  let chart;
  chart=plot(fig,{width:matrixWidth,height:matrixHeight,marginLeft:50,marginBottom,marginTop:10,marginRight:10,x:{domain:ids,label:'Column unit',tickRotate:d.n>8?-60:0},y:{domain:ids,label:'Row unit'},color:{type:'identity'},alt:'Every ordered unit pair is colored by the selected baseline report: row above column, row below column, or withheld. The outlined cell is the selected pair. A same-grade off-diagonal cell withholds; it does not assert equality.',table:cells.map(r=>({row:r.row,column:r.column,relation:relationWords(model,r.relation,r.i,r.j)})),keyboard:{data:cells,x:'column',y:'row',columns:d.n,sort:false,virtual:true,key:r=>`${r.i}:${r.j}`,title:r=>r.i===r.j?`${r.row}: diagonal`:`${r.row} / ${r.column}: ${relationWords(model,r.relation,r.i,r.j)}. Press Enter to inspect.`,onFocus:r=>{focusedPair=r.i===r.j?null:`${r.row},${r.column}`;}},marks:(c,P)=>[P.cell(cells,{x:'column',y:'row',fill:r=>r.i===r.j?c.plotBg:r.relation===1?c.relAbove:r.relation===-1?c.relBelow:c.relWithheld,inset:.5,stroke:r=>r.i===pair.i&&r.j===pair.j?c.plotFocus:c.plotBg,strokeWidth:2}),P.tip(cells,P.pointer({x:'column',y:'row',title:r=>`${r.row} / ${r.column}: ${relationWords(model,r.relation,r.i,r.j)}`}))]});
  for(const t of fig.querySelectorAll('svg text'))if(ids.includes(t.textContent))t.setAttribute('data-prx-name','');
  const pal=palette(ctx.root);
  const legend=(above,below)=>ctx.h('p',{class:'why-legend'},...[[pal.relAbove,above],[pal.relBelow,below],[pal.relWithheld,'Withheld']].map(([color,text])=>
   ctx.h('span',{},ctx.h('i',{class:'why-key',style:{background:color},'aria-hidden':'true'}),text)));
  slots.matrix.append(slots.tests?legend('Row above','Row below'):legend('Row stated above column','Row stated below column'));
  chart.svg.onclick=e=>{const box=chart.svg.getBoundingClientRect(),x=(e.clientX-box.left)*Number(chart.svg.getAttribute('width'))/box.width,y=(e.clientY-box.top)*Number(chart.svg.getAttribute('height'))/box.height,sx=chart.scale('x'),sy=chart.scale('y');if(x<50||x>matrixWidth-10||y<10||y>matrixHeight-marginBottom)return;const nearest=(domain,s,p)=>domain.reduce((a,v)=>Math.abs(s.apply(v)-p)<Math.abs(s.apply(a)-p)?v:a,domain[0]);const col=nearest(ids,sx,x),row=nearest(ids,sy,y);if(row!==col)onPair(`${row},${col}`);};
  costView.render(model);
  pairView.render(model);slots.criterion.prepend(ctx.panelTitle('Test two · directions and certainty by criterion'));
  const thresholds=[.9,.99];
  wide(ctx,slots.criterion,'Preferred directions and supplied-error certainty thresholds',table(ctx,['Criterion','Preferred strict direction','Forward cost','Reverse cost',...thresholds.map(t=>ctx.h('span',{},'Smaller directional error below one minus ',n(ctx,t,'prob')))],checks.map(r=>[r.label,nm(ctx,r.direction===1?`${d.ids[pair.i]} above ${d.ids[pair.j]}`:r.direction===-1?`${d.ids[pair.j]} above ${d.ids[pair.i]}`:'Neither: equal directional errors'),n(ctx,r.eIJ,'prob'),n(ctx,r.eJI,'prob'),...r.counts.map(v=>v?'Yes':'No')])));slots.criterion.append(ctx.h('p',{class:'why-note'},'The threshold columns check the supplied weak-error coefficients, with a strict inequality. They do not establish calibration outside the supplied law; an empirical or rounded zero alone is not proof of certainty.'));
  if(!law&&model.key!=='six')slots.criterion.append(ctx.h('p',{class:'why-note'},'The release supplies both directional errors. Strict-direction and equality probabilities are not separately supplied here, so those columns read NA. Compare each error with its reverse to read a preferred direction.'));
  if(law){slots.criterion.append(ctx.panelTitle('The complete stipulated states'),ctx.h('p',{class:'why-note'},'Each row contains every unit and criterion. Criteria may agree within every state while the direction remains uncertain across states. Statewise γ is the smaller directional cost at that known state, excluding withholding.'));wide(ctx,slots.criterion,'Every finite state and its directional costs',table(ctx,['State probability','All oriented unit values','Forward cost at state','Reverse cost at state','Statewise γ'],law.states.map((state,s)=>[n(ctx,law.probs[s],'prob',`state-${s}-prob`),ctx.h('span',{},...state.flatMap((row,i)=>[i?'; ':'',nm(ctx,d.ids[i]),': ',...row.flatMap((v,k)=>[k?', ':'',n(ctx,v,'value')])])),n(ctx,model.states[s].decision.costs.iAboveJ,'risk',`state-${s}-forward`),n(ctx,model.states[s].decision.costs.jAboveI,'risk',`state-${s}-reverse`),n(ctx,model.states[s].decision.directionalMinimum,'risk',`state-${s}-gamma`)])));}
  slots.coherent.replaceChildren(ctx.panelTitle('Test three · require a coherent report to state the pair'),ctx.h('p',{},'Each search keeps the baseline’s supplied law, weights, τ and base family. Requiring a direction may change other pair statements. Every retained optimum is shown with its own evaluation and signed risk change against the selected baseline.'),hint(ctx));
  direction(slots.coherent,model,forward,model.forwardProfiles,'forward','forward',`${d.ids[pair.i]} above ${d.ids[pair.j]}`);direction(slots.coherent,model,reverse,model.reverseProfiles,'reverse','reverse',`${d.ids[pair.j]} above ${d.ids[pair.i]}`);
  slots.family.replaceChildren(ctx.panelTitle('Test four · change a declared family restriction'),ctx.h('p',{class:'why-note'},'This test changes the feasible reports while holding the loss and supplied law fixed. It is a separate comparison, and can overlap with the preceding tests. A positive same-family extra risk means feasible but costly; an empty constrained family means the direction cannot be printed there.'),hint(ctx));
  if(model.family.kind==='order')slots.family.append(ctx.h('p',{class:'why-order'},'Declared fixed order: ',nm(ctx,model.family.order.map(i=>d.ids[i]).join(' → ')),'. ',model.family.blocks?'The final two units are an indivisible block.':'No indivisible multi-unit block.')); 
  if(model.relaxed){slots.family.append(ctx.h('p',{},model.relaxed.words,'.'),tieLine(ctx,model.relaxedBaseline,'relaxed-baseline'));wide(ctx,slots.family,'Relaxed baseline optima',profilesTable(ctx,model,model.relaxedBaselineProfiles,'relaxed-baseline'));for(const [title,result,profiles,prefix]of[[`${d.ids[pair.i]} above ${d.ids[pair.j]}`,model.relaxedForward,model.relaxedForwardProfiles,'relaxed-forward'],[`${d.ids[pair.j]} above ${d.ids[pair.i]}`,model.relaxedReverse,model.relaxedReverseProfiles,'relaxed-reverse']]){const titleNode=ctx.panelTitle(title);titleNode.setAttribute('data-prx-name','');slots.family.append(titleNode,tieLine(ctx,result,prefix));if(!result.empty)wide(ctx,slots.family,title,profilesTable(ctx,model,profiles,prefix));}}
  else if(model.key==='cde')slots.family.append(ctx.h('p',{},'The largest family searched here is the released teaching subset with at most three grades. Its full candidate count is ',n(ctx,baseline.baseFamily.size,'count'),'. An unrestricted twelve-unit search is not supplied; this view cannot show what removing that cap would do. Choose a smaller cap to compare it with this declared family.'));
  else {
   slots.family.append(ctx.h('p',{},model.key==='krw'?'The baseline already has no cap within the fixed expected-rank order.':'The baseline already searches all coherent reports. There is no family restriction to relax.'));
   const metadata=ctx.h('div',{hidden:true,'aria-hidden':'true','data-prx-relaxed-aliases':''});
   for(const panel of [slots.baseline,slots.coherent])for(const original of panel.querySelectorAll('[data-prx-readout]')){
    const key=original.dataset.prxReadout;
    if(!/^(baseline|forward|reverse)-(ties$|family$|grade-|risk-|N-|delta-|E-|share-|perpair-|Rk-)/.test(key))continue;
    const alias=original.cloneNode(true);
    alias.dataset.prxReadout=`relaxed-${key}`;
    metadata.append(alias);
   }
   slots.family.append(metadata);
  }
  if(model.key==='krw')slots.family.append(ctx.h('p',{class:'why-note'},'Both baseline and pair-stating counterfactual are newly produced postrank contiguous cuts of this fixed expected-rank order. Removing the cap keeps that exact order. These are distinct from KRW’s archived cards; no unrestricted all-firm optimum or coherence certificate is implied. Expected rank is average posterior position with the highest priority first, averaged over criteria using the fixed error weights.'));
  slots.cards.replaceChildren();if(model.cards.length){slots.cards.append(ctx.panelTitle('The selected baseline on the supplied marginal scales'),ctx.h('p',{class:'why-note'},'Dots are posterior means and lines are marginal intervals. Intervals do not choose the grades and are not intervals for grade membership. Each criterion keeps its own scale.'));if(model.E.criteria.length>1)slots.cards.append(ctx.h('p',{class:'why-note'},'Average of criterion ranks is the average of each criterion’s own expected position, with highest priority first, using weights ',...model.w.flatMap((v,k)=>[k?', ':'',n(ctx,v,'setting')]),'. The same weights are used here for a common ordering within grades. Both marginal cards share that ordering; this is not an expected rank of a composite target.'));else slots.cards.append(ctx.h('p',{class:'why-note'},'Expected rank is this criterion’s average posterior position, with highest priority first; it orders rows within each grade.'));for(const card of model.cards){const fig=ctx.h('div',{class:'why-card'});slots.cards.append(fig);drawReportCard(fig,card,{grade,order:'grade',selected:pair.i,...(model.E.criteria.length>1?{rankLabel:'Average of criterion ranks'}:{})});for(const t of fig.querySelectorAll('svg text,table tbody th'))if(card.names.includes(t.textContent))t.setAttribute('data-prx-name','');}}
  renderAccounts(model);
  if(slots.tests){
   drawTestStrip(ctx,slots.tests,model,checks);
   drawKrwAccountSummary(ctx,slots.accountOverview,model);
  }
  slots.source.replaceChildren(...(slots.tests?[matrixInstructions,hint(ctx),legend('Row stated above column','Row stated below column')]:[]),ctx.panelTitle('What these tests establish'),ctx.h('p',{},'These are nonexclusive comparisons under a supplied law. They do not identify a unique cause of a shared grade. The matrix describes the selected baseline; other equal-risk optima can withhold different pairs.'),ctx.h('p',{},'Report vectors follow source unit order: ',nm(ctx,d.ids.join(', ')),'.'));
  if(conditioning){
   conditioning.hidden=model.key!=='cde'&&model.key!=='krw';
   conditioning.replaceChildren(...sourceProse(ctx,model.key==='krw'?KRW.facts.conditioning:model.key==='cde'?'Teaching subset with a fixed statewide prior.':''));
  }
  if(model.key==='cde'){slots.source.append(ctx.h('p',{},'A deliberately spread teaching subset, not a representative statewide sample. School binomial posteriors condition on a fixed statewide prior, which is not refitted here; its estimation uncertainty is not propagated. The target is negative chronic-absence probability. This is not a school-quality, causal, eligibility or Dashboard-color judgment.'));slots.source.append(ctx.h('p',{},'Related pair view: ',ctx.h('a',{href:ctx.doc.location.pathname.includes('/embed/')?'../pages/cases/cde-pair.html':'../cases/cde-pair.html'},'A sure pair left unsaid (',n(ctx,5,'count'),'.',n(ctx,10,'count'),')'),'.'));ctx.caption.replaceChildren(...sourceProse(ctx,CDE.attribution+' '+CDE.change_notice+' '+CDE.notice));}
  else if(model.key==='krw'){slots.source.append(ctx.h('p',{},KRW.facts.conditioning));ctx.caption.replaceChildren(...sourceProse(ctx,KRW.attribution+' '+KRW.change_notice+' '+KRW.notice+' Provided as is, without warranty.')); }
  else {slots.source.append(ctx.h('p',{},law?'Restated finite law after the postrank theory book; every stipulated state appears above.':'Six fictional sites from the postrank tutorial; independent Normal sites and criteria.'));ctx.caption.replaceChildren(...sourceProse(ctx,law?law.source:'Synthetic data: CC BY 4.0. Independent Normal sites and criteria.'));}
 }};
}
function controls(ctx){const root=ctx.h('div',{class:'why-controls'}),data=ctx.select({label:'Supplied law',name:'data',options:Object.entries(TITLES).map(([value,label])=>({value,label})),onChange:value=>ctx.set({data:value,...DEFAULTS[value],pair:'auto',restriction:'source',report:0,forward:0,reverse:0})}),tau=ctx.slider({label:'Cost of withholding, τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})}),restriction=ctx.select({label:'Declared order blocks',name:'restriction',options:[{value:'source',label:'Separate units may be cut'},{value:'blocked',label:'B and C must stay in one grade'}],onChange:v=>ctx.set({restriction:v})}),first=ctx.select({label:'Baseline optimum to inspect',name:'report',options:Array.from({length:101},(_,i)=>({value:i,label:`Retained report ${i+1}`})),onChange:v=>ctx.set({report:v})});tau.input.step='any';
 const caps=ctx.h('div');
 root.append(data.root,ctx.primaryControl(tau.root),caps);
 const settings=ctx.disclosure({name:'settings',title:'Pair and report settings',placement:'none'});
 const secondary=ctx.h('div',{class:'why-settings'},restriction.root,first.root);
 settings.body.append(secondary);
 ctx.afterPresets(settings.root);
 const groups={};let reportOptionsKey=null;
 for(const key of Object.keys(TITLES)){
  const input=whyWithheldInput(key),d=input.data,cap=ctx.select({label:'Grade-count family',name:`cap-${key}`,options:CAPS[key].map(value=>({value,label:capWords(value)})),onChange:v=>ctx.set({cap:v,report:0,forward:0,reverse:0})});
  let pair,firstUnit,secondUnit;
  if(key==='krw'){
   const choose=(side,v)=>{const old=pairIndices(input,ctx.state.pair),next=old.slice(),selected=d.ids.indexOf(v);next[side]=selected;if(next[0]===next[1])next[1-side]=old[side];ctx.set({pair:`${d.ids[next[0]]},${d.ids[next[1]]}`,forward:0,reverse:0});};
   const options=d.ids.map((value,i)=>({value,label:`${value} · ${d.labels[i]}`}));
   firstUnit=ctx.select({label:'First firm of the proposed direction',name:'pair-krw-first',options,onChange:v=>choose(0,v)});secondUnit=ctx.select({label:'Second firm of the proposed direction',name:'pair-krw-second',options,onChange:v=>choose(1,v)});
   for(const input of [firstUnit.input,secondUnit.input])for(const option of input.options)option.dataset.prxName='';
  }else pair=ctx.select({label:'Proposed pair direction',name:`pair-${key}`,options:[{value:'auto',label:'Source example pair'},...d.ids.flatMap((id,i)=>d.ids.flatMap((other,j)=>i===j?[]:[{value:`${id},${other}`,label:`${id} above ${other}`}]))],onChange:v=>ctx.set({pair:v,forward:0,reverse:0})});
  const group=ctx.h('div',{class:'why-group'},...(pair?[pair.root]:[firstUnit.root,secondUnit.root]));groups[key]={group,pair,firstUnit,secondUnit,cap,input};secondary.append(group);caps.append(cap.root);
 }
 ctx.controls.append(root);return {render(state,model){data.set(state.data);tau.set(state.tau);restriction.set(state.restriction);restriction.root.hidden=state.data!=='order';first.root.hidden=!model||model.baseline.tieCount<=1;if(model){const grades=retainedGrades(model.baseline),key=grades.map(g=>g.join('/')).join('|');if(key!==reportOptionsKey){first.input.replaceChildren(...grades.map((g,i)=>ctx.h('option',{value:String(i)},`Retained report ${i+1}: ${formatGrades(g)}`)));reportOptionsKey=key;}first.set(Math.min(state.report,grades.length-1));}for(const [key,c]of Object.entries(groups)){c.group.hidden=key!==state.data;c.cap.root.hidden=key!==state.data;if(c.pair)c.pair.set(state.pair);else {const [i,j]=pairIndices(c.input,state.pair);c.firstUnit.set(c.input.data.ids[i]);c.secondUnit.set(c.input.data.ids[j]);}c.cap.set(state.cap);}}};}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'why-withheld',className:'why',css:WHY_WITHHELD_CSS+PAIR_COST_CSS+CRITERIA_PROFILE_CSS+REPORT_CARD_CSS,keys:WHY_WITHHELD_KEYS,layout:'result-first',build(ctx){
 const {h}=ctx;
 ctx.root.classList.add('cp','sev','prx-rc');
 const control=controls(ctx),slots=createWhyWithheldSlots(ctx,h('div'));
 slots.tests=h('section',{class:'why-tests why-paper prx-light-panel'});
 slots.accountOverview=h('section',{class:'why-account-overview'});
 ctx.charts.append(h('div',{class:'why-overview'},slots.matrix,slots.tests),slots.accountOverview);
 const baseline=ctx.disclosure({name:'baseline',title:'Baseline optima and definitions'});
 baseline.body.append(slots.baseline);
 const tests=ctx.disclosure({name:'tests',title:'Exact results for all four tests'});
 tests.body.append(slots.cost,slots.criterion,slots.coherent,slots.family);
 slots.accounts=ctx.disclosure({name:'accounts',title:'Complete changed-pair accounts'});
 const marginal=ctx.disclosure({name:'marginals',title:'Marginal report cards'});
 marginal.body.append(slots.cards);
 const method=ctx.disclosure({name:'method',title:'Method and source'});
 method.body.append(slots.source);
 let matrixAnchor=null;
 const view=createWhyWithheldView(ctx,slots,{onPair:pair=>{
  if(pair!==ctx.state.pair)matrixAnchor={pair,top:slots.matrix.getBoundingClientRect().top,scrollY:ctx.win.scrollY};
  ctx.set({pair,forward:0,reverse:0});
 }});
 let generation=0,dead=false,last=null;
 ctx.onCleanup(()=>{dead=true;generation++;});
 return {render(state,info={}){
 if(info.reason==='disclosure'&&info.disclosure==='accounts'&&last&&ctx.root.getAttribute('aria-busy')==='false'){
  view.renderAccounts(last);
  return;
 }
 const current=++generation;control.render(state,last?.key===state.data?last:null);const cap=CAPS[state.data].includes(state.cap)?state.cap:DEFAULTS[state.data].cap;if(cap!==state.cap){ctx.set({cap});return;}const input=whyWithheldInput(state.data),valid=state.pair==='auto'||(()=>{const p=state.pair.split(',');return p.length===2&&p[0]!==p[1]&&p.every(v=>input.data.ids.includes(v));})();if(!valid){ctx.set({pair:'auto'});return;}ctx.root.setAttribute('aria-busy','true');ctx.readout.set(['Checking the baseline and both pair directions…']);const isCurrent=()=>!dead&&current===generation;
 solveWhyWithheld(state,{isCurrent,stage:title=>new Promise(resolve=>{if(isCurrent())ctx.readout.set([title,'…']);ctx.timeout(resolve,0);})}).then(model=>{if(!model||!isCurrent())return;const correction={};if(state.report!==model.selected)correction.report=model.selected;for(const key of ['forward','reverse']){const length=retainedGrades(model[key]).length,selected=length?Math.min(state[key],length-1):0;if(state[key]!==selected)correction[key]=selected;}if(Object.keys(correction).length){ctx.set(correction);return;}last=model;ctx.keepFocus(()=>{control.render(state,model);marginal.root.hidden=!model.cards.length;view.render(model);ctx.readout.set(selectedPairSummary(ctx,model));});
 const anchor=matrixAnchor;
 matrixAnchor=null;
 if(anchor?.pair===state.pair&&Math.abs(ctx.win.scrollY-anchor.scrollY)<12){
  const delta=slots.matrix.getBoundingClientRect().top-anchor.top;
  if(Math.abs(delta)>1)ctx.win.scrollBy({top:delta,behavior:'instant'});
 }
 ctx.root.setAttribute('aria-busy','false');}).catch(error=>{if(!isCurrent())return;ctx.root.setAttribute('aria-busy','false');ctx.readout.set(['This setting could not be evaluated: ',error.message]);throw error;});},destroy(){dead=true;generation++;}};
}});}
