// The criterion selector chooses one whole vector after one fixed report has been selected.
import {createWidget} from '../shared/base.js';
import {numText,plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatEoverN,formatExpectedCount,formatGrades,formatProb,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {tagNode} from '../shared/labels.js';
import {criterionMixtureRisk,evaluateReport,exactOptimum,pairCount,relations,weightedError} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {CERTAIN_OPPOSITION,CRITERION_MAJORITY,finiteCriteria} from '../shared/criteria-laws.js';
import {PAIR_COST_CSS,createPairCostView,criterionPairCosts} from './conflict-pairs.js';
import {CRITERIA_PROFILE_CSS,isCriterionPairKey,resolveCriterionPair} from './several-criteria.js';
import {TWO_SCORES_CSS,createTwoScoresSlots,createTwoScoresView,drawTwoScoreReport,solveTwoScores,twoScoreFamily} from './two-scores.js';

const TITLES={six:'Six sites · two scores',opposition:'Two certain opposing criteria',majority:'Three criteria · two against one'};
const label=(d,k)=>d.criterionLabels?.[k]??['First criterion','Second criterion','Third criterion'][k];
const name=(ctx,value)=>ctx.h('span',{'data-prx-name':'',text:value});
const n=(ctx,value,kind='risk',hook)=>{const f={risk:formatRisk,count:formatCount,grades:formatGrades,prob:formatProb,setting:formatSetting,expected:formatExpectedCount,share:formatShare,fraction:formatEoverN,sci:formatSci,value:v=>formatDecimal(v,{digits:3})}[kind],node=ctx.num(value,f(value));if(hook)node.dataset.prxReadout=hook;return node;};
const gradeKey=g=>Array.from(g).join('-');
export const MIXTURE_CSS=`
.mix .sev-paper .prx-result-tag,.mix .sev-paper [data-prx-label]{color:var(--prx-plot-fg)}
.mix .mix-controls{display:flex;flex-wrap:wrap;gap:.6rem;max-width:100%;min-width:0;width:100%}
.mix .mix-controls .prx-control,.mix .mix-controls select{max-width:100%;min-width:0}.mix .mix-section{margin:.85rem 0;min-width:0}
.mix .mix-hidden[hidden]{display:none}.mix .mix-details{padding:.75rem;border-radius:.4rem;min-width:0}
.mix .mix-identities{display:flex;flex-wrap:wrap;gap:.5rem 2rem;font-weight:600}.mix .mix-identities p{margin:.3rem 0}
.mix .mix-table{min-width:39rem}.mix .mix-vector{min-width:27rem}.mix .mix-vector th,.mix .mix-vector td{text-align:left;white-space:nowrap}
.mix .mix-vector th:first-child,.mix .mix-vector td:first-child{position:sticky;left:0;min-width:3.5rem;width:3.5rem;background:var(--prx-plot-bg);z-index:1}
.mix .mix-picked{outline:2px solid var(--prx-plot-focus);outline-offset:-2px;font-weight:600}
.mix .mix-short{font-size:.88rem;line-height:1.45}.mix .mix-grades{margin:.5rem 0}.mix .mix-coherence-table{min-width:31rem}
.mix .mix-source-caption{font-size:.8rem;margin:.4rem 0}.mix .mix-source-readout{font-size:.9rem}
.mix .mix-tau-exact{display:contents}.mix .mix-tau-exact input{width:10.5rem;max-width:100%;font:inherit;min-width:0}
.mix .mix-tau-hint{grid-column:1/-1;max-width:100%}
`;
export const MIXTURE_KEYS={
 data:{type:'choice',values:Object.keys(TITLES),value:'six'},
 w:{type:'number',min:0,max:1,step:.01,value:.5},
 tau:{type:'number',min:.01,max:.5,step:.01,value:.2},
 cap:{type:'choice',values:['2','3','all'],value:'3'},
 criterion:{type:'choice',values:[0,1,2],value:0},
 report:{type:'integer',min:1,max:100,step:1,value:1},
 pair:{type:'string',value:'auto'},
};
const finiteCache=new Map(),models=new Map();
function finiteInput(key){
 if(finiteCache.has(key))return finiteCache.get(key);
 const law=key==='majority'?CRITERION_MAJORITY:CERTAIN_OPPOSITION,E=finiteCriteria(law),d={key,ids:law.ids,criteria:law.criteria,criterionLabels:law.criteria.map((_,k)=>['First criterion','Second criterion','Third criterion'][k]),n:law.ids.length,K:law.criteria.length,M:pairCount(law.ids.length),law,E};
 finiteCache.set(key,d);return d;
}
export function solveCriterionMixture(state){
 const key=JSON.stringify([state.data,state.w,state.tau,state.cap]);let base=models.get(key);
 if(!base){
  const data=state.data==='six'?criteriaData('six'):finiteInput(state.data),w=state.data==='majority'?CRITERION_MAJORITY.w:[state.w,1-state.w],family=state.data==='six'?twoScoreFamily(state.cap):{kind:'all'},source=state.data==='six'?solveTwoScores({w:state.w,tau:state.tau,cap:state.cap}):null,optimum=source?.result??exactOptimum(data.E,{w,tau:state.tau,family});
  const profiles=optimum.grades.map(grade=>{const evaluation=evaluateReport(grade,data.E,{w,tau:state.tau}),mixture=criterionMixtureRisk(grade,data.E,{w,tau:state.tau});
   // Explicit Phase7 public composition: scalar w_k R_k only. The sum is engine mixture.risk.
   const contributions=mixture.w.map((weight,k)=>weight*mixture.Rk[k]);return {grade,evaluation,mixture,contributions};});
  base={data,w,family,source,optimum,profiles};models.set(key,base);if(models.size>100)models.delete(models.keys().next().value);
 }
 const chosen=Math.max(0,Math.min(state.report-1,base.profiles.length-1)),selected=base.profiles[chosen],criterion=Math.min(state.criterion,base.data.K-1),pair=state.pair==='auto'?(state.data==='six'?[0,2]:[0,1]):resolveCriterionPair(base.data,state.pair),costs=criterionPairCosts(base.data.E,pair,{w:base.w,tau:state.tau}),relation=relations(selected.grade),weighted=weightedError(base.data.E,base.w);
 return {...base,selected,chosen,criterion,pair:{i:pair[0],j:pair[1]},costs,relation,weighted,tau:state.tau,coherence:state.data==='six'?[[0,2],[1,3]].map(([i,j])=>({i,j,error:weighted[i][j],relation:relation[i][j],decision:criterionPairCosts(base.data.E,[i,j],{w:base.w,tau:state.tau}).weighted.decision})):[]};
}
function table(ctx,headers,rows,cls='mix-table'){return ctx.h('table',{class:cls},ctx.h('thead',{},ctx.h('tr',{},...headers.map(text=>ctx.h('th',{scope:'col'},text)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map(value=>ctx.h('td',{},value))))));}
function scroll(ctx,parent,label,content){const region=ctx.h('div',{class:'sev-scroll'},content);ctx.scrollRegion(region,label);parent.append(region);return region;}
const hint=ctx=>ctx.h('p',{class:'sev-hint'},'Wide tables scroll within this panel; focus the table region and use the arrow keys.');
export function createMixtureRiskView(ctx,slot){return {render(model){
 const {data,selected,optimum}=model,rows=data.criteria.map((_,k)=>({k,criterion:label(data,k),w:selected.mixture.w[k],risk:selected.mixture.Rk[k],contribution:selected.contributions[k]}));
 const explanation=ctx.h('p',{class:'mix-short'},'Select the report before the auxiliary criterion. Keep every stated and withheld comparison fixed while averaging the criterion-specific risks.'),identities=ctx.h('div',{class:'mix-identities'},ctx.h('p',{},'Average of criterion risks: ',n(ctx,selected.mixture.risk,'risk','mixture-risk')),ctx.h('p',{},'Direct weighted reporting risk: ',n(ctx,selected.mixture.weightedRisk,'risk','weighted-risk')));
 const chips=ctx.h('div',{class:'tws-chips mix-grades'});drawTwoScoreReport(ctx,chips,selected.grade,data.ids);const reportLine=ctx.h('p',{},'Report ',n(ctx,selected.grade,'grades','selected-grade'),'; N ',n(ctx,selected.evaluation.N,'count','selected-N'),' of M ',n(ctx,selected.evaluation.M,'count','selected-M'),' pairs stated. Grade ',n(ctx,1,'count'),' is stated highest priority. A shared grade means not compared, not equal.');slot.replaceChildren(ctx.panelTitle('One fixed report, two risk calculations'));
 const fig=ctx.h('div');slot.append(fig);
 plot(fig,{height:210,marginLeft:100,marginRight:55,marginBottom:40,x:{domain:[0,.5],label:'Contribution to risk',grid:true},y:{domain:rows.map(r=>r.criterion),label:null},alt:'Each bar is one criterion’s selection weight times the risk of the same complete report on that criterion. Their engine-computed sum equals the direct weighted risk.',table:rows,keyboard:{data:rows,x:'contribution',y:'criterion',title:r=>`${r.criterion}: weight ${formatProb(r.w)}, report risk ${formatRisk(r.risk)}, contribution ${formatRisk(r.contribution)}.`},marks:(c,P)=>[P.barX(rows,{x:'contribution',y:'criterion',fill:r=>c.crit[r.k]}),numText(rows,{x:'contribution',y:'criterion',value:'contribution',format:formatRisk,dx:5,textAnchor:'start',fill:c.plotFg,fontSize:11}),P.tip(rows,P.pointer({x:'contribution',y:'criterion',title:r=>`${r.criterion}: ${formatProb(r.w)} × ${formatRisk(r.risk)} = ${formatRisk(r.contribution)}`}))]});
 slot.append(explanation,identities,reportLine,chips,hint(ctx));scroll(ctx,slot,'All criterion weights, risks and contributions',table(ctx,['Criterion','Selection chance w','Risk of this report','w × criterion risk'],rows.map(r=>[r.criterion,n(ctx,r.w,'prob',`weight-${r.k}`),n(ctx,r.risk,'risk',`criterion-risk-${r.k}`),n(ctx,r.contribution,'risk',`contribution-${r.k}`)])));
 slot.append(ctx.h('p',{},tagNode(ctx,optimum)),ctx.h('p',{class:'mix-short'},n(ctx,optimum.tieCount,'count','tie-count'),optimum.tieCount===1?' report has':' reports have',' the smallest risk; equal-risk tolerance ',n(ctx,optimum.tieTol,'sci'),'. ',optimum.tieCount>model.profiles.length?ctx.h('span',{},n(ctx,model.profiles.length,'count'),' reports are retained.'):null));
 const all=model.profiles.flatMap(p=>data.criteria.map((_,k)=>[n(ctx,p.grade,'grades'),label(data,k),n(ctx,p.evaluation.N,'count'),n(ctx,p.evaluation.E[k],'expected',`profile-${gradeKey(p.grade)}-${k}-E`),n(ctx,p.evaluation.EoverN[k],'fraction',`profile-${gradeKey(p.grade)}-${k}-fraction`),n(ctx,p.mixture.Rk[k],'risk',`profile-${gradeKey(p.grade)}-${k}-risk`),n(ctx,p.contributions[k],'risk',`profile-${gradeKey(p.grade)}-${k}-contribution`),n(ctx,p.mixture.risk,'risk',`profile-${gradeKey(p.grade)}-${k}-sum`)]));
 scroll(ctx,slot,'Every retained best report and criterion contribution',table(ctx,['Report','Criterion','N','Expected wrong count E','E/N among stated','Criterion risk','Contribution','Mixture sum'],all));
}};}
export function createCriterionBranchView(ctx,slot){return {render(model){
 const {data,criterion:k,selected}=model;
 slot.replaceChildren(ctx.panelTitle('One criterion selects one whole unit vector'),ctx.h('p',{},'Inspecting ',name(ctx,label(data,k)),': selection chance ',n(ctx,model.w[k],'prob','branch-chance'),'; risk of the already chosen report on this criterion ',n(ctx,selected.mixture.Rk[k],'risk','branch-risk'),'.'),ctx.h('p',{class:'mix-short'},'The outlined column includes every unit. Choosing a different branch does not select a different report. This is an auxiliary loss interpretation, not a sample of stakeholder preferences or a composite of target values.'),ctx.h('p',{class:'mix-short'},model.w[k]===0?'This branch has zero selection chance at these weights. Its criterion-specific risk can be inspected, but this mixture never selects it.':'The selected index would be used for the entire report, independently of the target law conditional on the supplied information.'));
 slot.append(ctx.h('p',{class:'mix-short'},data.key==='six'?'The six-site vector law has independent Normal units. The table shows its marginal mean and SD on each criterion; it is not a realized draw. Other vector laws may retain unit dependence.':'These stipulated true values form one complete known state. The same selected criterion applies to both units, not separately to each row or pair.'),hint(ctx));
 const rows=data.ids.map((id,i)=>[name(ctx,id),...data.criteria.map((_,j)=>data.key==='six'?ctx.h('span',{},'Normal(',n(ctx,data.means[i][j],'value'),', SD ',n(ctx,data.sds[i][j],'value'),')'):n(ctx,data.law.states[0][i][j],'value'))]);
 const t=table(ctx,['Unit',...data.criteria.map((_,j)=>label(data,j))],rows,'mix-vector');for(const row of t.rows)row.cells[k+1]?.classList.add('mix-picked');const vectorRegion=scroll(ctx,slot,'Whole selected criterion vector across every unit',t),header=t.rows[0]?.cells[k+1];if(header)vectorRegion.scrollLeft=Math.max(0,header.offsetLeft+header.offsetWidth-vectorRegion.clientWidth+8);
}};}
function coherenceView(ctx,slot,model){
 slot.replaceChildren();slot.hidden=model.data.key!=='six';if(slot.hidden)return;
 slot.append(ctx.panelTitle('An isolated-pair choice can disagree with the coherent report'),ctx.h('p',{class:'mix-short'},'The table compares the same selected report with each pair’s own three-action choice. The no-cap preset isolates coherence from a grade cap; a cap is a different restriction.'),hint(ctx));
 scroll(ctx,slot,'Coherent report and isolated comparisons',table(ctx,['Direction','Weighted error','Withholding cost τ','In the full report','Cheapest isolated actions'],model.coherence.map(r=>[name(ctx,`${model.data.ids[r.i]} above ${model.data.ids[r.j]}`),n(ctx,r.error,'risk',`coherence-${r.i}-${r.j}-error`),n(ctx,model.tau,'setting'),r.relation===1?'Stated above':r.relation===-1?'Reverse direction stated':'Withheld',r.decision.best.map(a=>a==='withhold'?'Withhold':a==='iAboveJ'?'Forward':'Reverse').join('; ')]),'mix-coherence-table'));
}
// Keep a typed decimal as a draft. A redraw must never replace an active editing buffer or move its caret.
function createTauDraft(ctx,range){
 const {min,max,value}=ctx.key('tau'),id=`${range.input.id}-exact`,hintId=`${id}-hint`;
 let applied=value,dirty=false;
 const input=ctx.h('input',{id,type:'text',inputmode:'decimal',name:'tau',role:'spinbutton','aria-valuemin':min,'aria-valuemax':max,'aria-valuenow':value,'aria-invalid':'false','aria-describedby':hintId,'data-prx-focus-key':'number:tau',value:String(value)});
 const root=ctx.h('div',{class:'mix-tau-exact'},ctx.h('label',{for:id,class:'prx-sr-only'},'Exact cost of withholding a pair, τ'),input);
 const hint=ctx.h('p',{id:hintId,class:'prx-hint mix-tau-hint',role:'status','aria-live':'polite'});
 const instruction=()=>hint.replaceChildren('Enter or leave this field to apply; Esc cancels.');
 const reset=v=>{applied=v;dirty=false;input.value=String(v);input.setAttribute('aria-valuenow',String(v));input.setAttribute('aria-valuetext',`Applied cost ${v}.`);input.setAttribute('aria-invalid','false');instruction();};
 const read=()=>{const raw=input.value.trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))return undefined;const parsed=Number(raw);return Number.isFinite(parsed)&&parsed>=min&&parsed<=max?parsed:undefined;};
 const invalid=()=>{input.setAttribute('aria-invalid','true');input.setAttribute('aria-valuetext',`Invalid draft; applied cost ${applied}.`);hint.replaceChildren('Enter a value from ',n(ctx,min,'setting'),' to ',n(ctx,max,'setting'),'. The applied cost is unchanged; Esc restores it.');};
 const commit=()=>{if(!dirty)return;const parsed=read();if(parsed===undefined){invalid();return;}reset(parsed);ctx.set({tau:parsed});};
 ctx.listen(input,'input',()=>{dirty=true;input.setAttribute('aria-invalid','false');input.setAttribute('aria-valuetext',`Draft not applied; applied cost ${applied}.`);hint.replaceChildren('Not applied. Enter or leave this field to apply; Esc cancels.');});
 ctx.listen(input,'change',commit);ctx.listen(input,'blur',commit);
 ctx.listen(input,'keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();reset(applied);return;}
  if(e.key==='Enter'){e.preventDefault();commit();return;}
  if(!['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const base=read()??applied,direction=e.key==='ArrowUp'?1:-1,next=Math.min(max,Math.max(min,Number((base+direction*.01).toPrecision(15))));reset(next);ctx.set({tau:next});
 });
 range.output.hidden=true;range.root.append(root,hint);reset(value);
 return {reset,sync(v){if(!Object.is(v,applied))reset(v);}};
}
function createControls(ctx){
 const root=ctx.h('div',{class:'mix-controls'}),data=ctx.select({label:'Supplied law',name:'data',options:Object.entries(TITLES).map(([value,label])=>({value,label})),onChange:v=>ctx.set({data:v,criterion:0,report:1,pair:'auto'})}),w=ctx.slider({label:'Error weight on the first criterion',...ctx.key('w'),onInput:v=>ctx.set({w:v})}),tau=ctx.slider({label:'Cost of withholding a pair, τ',...ctx.key('tau'),name:'tau-slider',onInput:v=>ctx.set({tau:v===Number((1/3).toPrecision(15))?1/3:v})}),cap=ctx.select({label:'Allowed six-site reports',name:'cap',options:[{value:'2',label:'At most two grades'},{value:'3',label:'At most three grades'},{value:'all',label:'No grade cap'}],onChange:v=>ctx.set({cap:v})}),report=ctx.slider({label:'Inspect retained best report',...ctx.key('report'),format:formatCount,onInput:v=>ctx.set({report:v})});
 // Chrome range values serialize to 15 digits. The native number field preserves the exact boundary;
 // the range is a synchronized pointer control and maps its representation of one third back to that value.
 w.input.step='any';tau.input.step='any';
 const tauEditor=createTauDraft(ctx,tau);
 const branches={};for(const K of [2,3])branches[K]=ctx.segmented({label:'Auxiliary criterion for the whole vector',name:`criterion-${K}`,options:Array.from({length:K},(_,k)=>({value:k,label:['First criterion','Second criterion','Third criterion'][k]})),onChange:v=>ctx.set({criterion:v})});
 const six=criteriaData('six'),pair=ctx.select({label:'Inspect this isolated six-site pair',name:'pair',options:[{value:'auto',label:'A above C'},...six.ids.flatMap((id,i)=>six.ids.flatMap((other,j)=>i===j?[]:[{value:`${id},${other}`,label:`${id} above ${other}`}]))],onChange:v=>ctx.set({pair:v})});
 root.append(data.root,w.root,tau.root,cap.root,branches[2].root,branches[3].root,report.root,pair.root);ctx.controls.append(root);
 return {tauEditor,render(state,model){data.set(state.data);w.set(state.w);tau.set(state.tau);tauEditor.sync(state.tau);cap.set(state.cap);w.root.hidden=state.data==='majority';cap.root.hidden=state.data!=='six';pair.root.hidden=state.data!=='six';pair.set(state.pair);for(const K of [2,3]){branches[K].root.hidden=model.data.K!==K;branches[K].set(model.criterion);}report.input.max=String(model.profiles.length);report.set(model.chosen+1);report.root.hidden=model.profiles.length===1;}};
}
export function mountWidget(el,spec={}){let tauEditor;const handle=createWidget(el,spec,{name:'criterion-mixture',className:'mix',css:MIXTURE_CSS+PAIR_COST_CSS+CRITERIA_PROFILE_CSS+TWO_SCORES_CSS,keys:MIXTURE_KEYS,build(ctx){
 ctx.root.classList.add('cp','sev','tws');const control=createControls(ctx),risk=ctx.h('div',{class:'sev-paper mix-section'}),branch=ctx.h('div',{class:'sev-paper mix-section'}),pair=ctx.h('div',{class:'sev-paper mix-section'}),coherence=ctx.h('div',{class:'sev-paper mix-section'}),source=ctx.h('div',{class:'mix-source mix-details mix-section prx-light-panel'}),conditions=ctx.h('div',{class:'sev-paper mix-section'});
 tauEditor=control.tauEditor;
 ctx.charts.append(ctx.readout.node,risk,branch,pair,coherence,source,conditions);
 const riskView=createMixtureRiskView(ctx,risk),branchView=createCriterionBranchView(ctx,branch),pairView=createPairCostView(ctx,pair),sourceReadout=ctx.h('p',{class:'mix-source-readout'}),sourceCaption=ctx.h('p',{class:'mix-source-caption'}),sourceCtx=Object.create(ctx);
 sourceCtx.readout={node:sourceReadout,set:parts=>sourceReadout.replaceChildren(...[parts].flat(Infinity))};sourceCtx.caption=sourceCaption;
 source.append(ctx.panelTitle('The full linked six-site report'),ctx.h('p',{class:'mix-short'},'These linked views use the first retained best report for the matrices and slope chart, and list every retained optimum and its differing profiles. The mixture branch above uses the selected retained report.'));
 const sourceView=createTwoScoresView(sourceCtx,createTwoScoresSlots(sourceCtx,source));source.append(sourceCaption);
 let lastSource,lastSourceViewKey,lastSelected,lastPairKey,lastViewKey;
 return {render(state){
  const model=solveCriterionMixture(state),correction={};if(state.report!==model.chosen+1)correction.report=model.chosen+1;if(state.criterion!==model.criterion)correction.criterion=model.criterion;if(!isCriterionPairKey(model.data,state.pair))correction.pair='auto';if(Object.keys(correction).length)ctx.set(correction);
  control.render(state,model);const viewKey=`${ctx.width()}|${ctx.root.dataset.theme}|${ctx.doc.documentElement.dataset.theme}`,newView=viewKey!==lastViewKey,pairKey=JSON.stringify([state.data,state.w,state.tau,model.pair]);if(newView||lastSelected!==model.selected)riskView.render(model);branchView.render(model);if(newView||lastPairKey!==pairKey)pairView.render({data:model.data,pair:model.pair,weighted:model.costs.weighted,kind:state.data==='six'?'posterior':'known state'});coherenceView(ctx,coherence,model);source.hidden=state.data!=='six';if(!source.hidden&&(viewKey!==lastSourceViewKey||lastSource!==model.source)){sourceView.render(model.source,{w:state.w,tau:state.tau,cap:state.cap});lastSource=model.source;lastSourceViewKey=viewKey;}lastSelected=model.selected;lastPairKey=pairKey;lastViewKey=viewKey;
  conditions.replaceChildren(ctx.panelTitle('What the mixture means, and when KRW corresponds'),ctx.h('p',{class:'mix-short'},'The mixture identity uses postrank’s weak-error loss: a strict direction is wrong at equality. It holds with latent equalities and arbitrary dependence. It averages losses of one fixed report, not target magnitudes.'),ctx.h('p',{class:'mix-short'},'The correspondence to KRW’s strict-count objective additionally needs the same law, targets, orientation, labeled units, pair normalization and nonempty family. The usual affine formula assumes zero latent equality probability on positive-weight criteria; otherwise an explicit equality correction is required.'),ctx.h('p',{class:'mix-short'},'For an isolated known conflict, positive cost from strict opposition needs positive weight on both sides. The smaller directional cost excludes withholding. Posterior directional minima can also reflect uncertainty. A full coherent report need not print every isolated action choice.'));
  ctx.readout.set(['For report ',n(ctx,model.selected.grade,'grades','readout-grade'),', the criterion mixture risk is ',n(ctx,model.selected.mixture.risk,'risk','readout-mixture'),' and the direct weighted risk is ',n(ctx,model.selected.mixture.weightedRisk,'risk','readout-weighted'),'. Changing the auxiliary criterion keeps this report fixed.']);
  ctx.caption.replaceChildren('Supplied synthetic laws after the postrank theory book. One criterion selects one whole unit vector; weights are a loss interpretation, not measured stakeholder preferences. Strict directions count equality as wrong. Synthetic data license CC BY ',ctx.num(4,formatDecimal(4,{digits:1})),'.');
 }};
}});
 // A same-value API/preset/range command is still authoritative over an uncommitted draft.
 const update=handle.update;handle.update=partial=>{const result=update(partial);if(partial&&typeof partial==='object'&&(Object.hasOwn(partial,'tau')||Object.hasOwn(partial,'preset')))tauEditor.reset(handle.state.tau);return result;};
 return handle;}
