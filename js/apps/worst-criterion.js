// Expected-criterion minimax, using the actual predecessor's risk-line model and view.
import {createWidget} from '../shared/base.js';
import {formatCount,formatExpectedCount,formatGrades,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {tagNode} from '../shared/labels.js';
import {compareReports,evaluateReport,minimaxChoice} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {ROBUST_PAIR,CERTAIN_OPPOSITION,finiteCriteria} from '../shared/criteria-laws.js';
import {TWO_SCORES_CSS,drawTwoScoreReport,twoScoreFamily} from './two-scores.js';
import {WEIGHT_PATH_CSS,weightedRiskModel,createWeightedRiskView,weightText} from './weight-path.js';
export const GUARDED_CRITERION_CSS=`
.wcr .wcr-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:.8rem 1.2rem;min-width:0}
.wcr .wcr-grid>section{min-width:0}.wcr .wcr-wide{grid-column:1/-1;min-width:0}
.wcr .wcr-scroll{overflow-x:auto;max-width:100%;min-width:0}.wcr .wcr-table{width:100%;min-width:48rem;border-collapse:collapse;font-size:.86rem}
.wcr .wcr-table th,.wcr .wcr-table td{padding:.35rem .5rem;border-bottom:1px solid var(--prx-border-strong);text-align:left;white-space:nowrap}
.wcr .wcr-card{padding:.4rem .5rem;margin:.3rem 0}.wcr .wcr-note{font-size:.88rem;margin:.35rem 0 .6rem}.wcr .wcr-card p{margin:.3rem 0}
@media(max-width:40em){.wcr .wcr-grid{grid-template-columns:minmax(0,1fr)}}`;
const bookE=finiteCriteria(ROBUST_PAIR),oppositionE=finiteCriteria(CERTAIN_OPPOSITION),cache=new Map();
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function n(ctx,value,format=formatCount,hook){const node=ctx.num(value,format(value));if(hook)node.dataset.prxReadout=hook;return node}
/** Public-engine guarded/weighted comparison, also consumed by the settings app. */
export function solveGuardedCriteria(state={}){
 const s={data:'six',w:.9,tau:.2,cap:'3',objective:'weighted',...state},key=JSON.stringify(s);if(cache.has(key))return cache.get(key);
 const data=s.data==='six'?criteriaData('six'):s.data==='book'?ROBUST_PAIR:CERTAIN_OPPOSITION,E=s.data==='six'?data.E:s.data==='book'?bookE:oppositionE;
 const family=s.cap==='exact2'?{kind:'exactly',G:2}:twoScoreFamily(s.cap),riskModel=weightedRiskModel(E,{tau:s.tau,family}),choice=minimaxChoice(E,{tau:s.tau,w:[s.w,1-s.w],family});
 const profile=grade=>({grade,evaluation:evaluateReport(grade,E,{tau:s.tau,w:[s.w,1-s.w]}),line:riskModel.lines.find(r=>same(r.grade,grade))});
 const weightedProfiles=choice.weighted.grades.map(profile),guardedProfiles=choice.minimax.grades.map(profile),comparisons=guardedProfiles.map(p=>compareReports(choice.weighted.grade,p.grade,E,{tau:s.tau,w:[s.w,1-s.w]}));
 const model={data,E,state:s,family,riskModel,choice,weightedProfiles,guardedProfiles,comparisons,peak:riskModel.envelopeMaximum};cache.set(key,model);if(cache.size>100)cache.delete(cache.keys().next().value);return model;
}
export function createGuardedComparisonSlots(ctx,parent=ctx.charts){const slots={};for(const[key,title]of[['reports','Two ways to choose'],['summary','The envelope peak and the price of guarding'],['profiles','Every retained optimum: criterion profiles']]){slots[key]=ctx.h('div');parent.append(ctx.h('section',{class:'prx-panel wcr-wide','aria-label':title},ctx.panelTitle(title),slots[key]))}return slots}
/** Actual report/profile/price renderer, shared with 4.10. */
export function createGuardedComparisonView(ctx,slots,{resultFirst=false}={}){const h=ctx.h;return {render(model,state=model.state){
 const {choice,weightedProfiles,guardedProfiles,peak}=model,ids=model.E.ids,labels=state.data==='six'?['score A','score B']:['criterion one','criterion two'];
 const ruleResult=kind=>({...choice,...choice[kind]});
 const cards=[h('p',{class:'wcr-note'},'Grade one is highest target priority. A shared grade withholds comparisons.')];for(const[kind,title,profiles]of[['weighted','Weighted best at this weight',weightedProfiles],['minimax','Guarding both criteria',guardedProfiles]]){
  cards.push(h('p',{},title,' · ',tagNode(ctx,ruleResult(kind)),state.objective===kind?' · selected objective':''));
  const result=choice[kind];cards.push(h('p',{class:'wcr-note'},n(ctx,result.tieCount,formatCount,`${kind}-tie-count`),' report',result.tieCount===1?' has':'s share',' the smallest objective value',result.tieCount>1?', tied with another report':'','; equal-risk tolerance ',n(ctx,choice.tieTol,formatSci),'. Retained ',n(ctx,profiles.length),' report',profiles.length===1?'':'s','.'));
  profiles.forEach((p,i)=>{const chips=h('div',{class:'tws-chips'});drawTwoScoreReport(ctx,chips,p.grade,ids);cards.push(h('div',{class:'wcr-card prx-light-panel'},chips,h('p',{},'Grade vector ',n(ctx,p.grade,formatGrades,`${kind}-grade-${i}`),'; ',n(ctx,p.evaluation.N,formatCount,`${kind}-N-${i}`),' of ',n(ctx,p.evaluation.M),' pairs stated.'),h('p',{},'Weighted risk ',n(ctx,p.evaluation.risk,formatRisk,`${kind}-risk-${i}`),'; largest expected criterion risk ',n(ctx,p.line.max,formatRisk,`${kind}-max-${i}`),'.')))});
 }
 slots.reports.replaceChildren(...cards,...(resultFirst?[]:[ctx.readout.node]));
 const first=weightedProfiles[0],guarded=guardedProfiles[0],agree=same(first.grade,guarded.grade),worstName=first.line.R1>=first.line.R2?labels[0]:labels[1],alts=weightedProfiles.slice(1);
 const resultWords=agree?['At w ',n(ctx,state.w,formatSetting),' the weighted best is the guarded report: it averages ',n(ctx,first.evaluation.risk,formatRisk),' and never exceeds ',n(ctx,guarded.line.max,formatRisk),'.']:['At w ',n(ctx,state.w,formatSetting),' the weighted best averages ',n(ctx,first.evaluation.risk,formatRisk),' but costs ',n(ctx,first.line.max,formatRisk),...alts.flatMap(p=>[' (',n(ctx,p.line.max,formatRisk),' for the tied report)']),` if only ${worstName} counts; the guarded report never exceeds `,n(ctx,choice.minimax.value,formatRisk),'.'];
 ctx.readout.set(resultFirst?[h('p',{style:{display:'inline',margin:0}},resultWords),' Selected: ',state.objective==='weighted'?'weighted expected risk.':'guard both criteria.']:resultWords);
 slots.summary.replaceChildren(h('p',{},'Largest lower-envelope risk: ',n(ctx,peak.risk,formatRisk,'peak-risk'),'. Maximizing weight',peak.intervals.length===1?'':'s',': ',...peak.intervals.flatMap((r,i)=>[i?'; ':'',n(ctx,r.from,weightText,`peak-from-${i}`),r.from===r.to?'':[' to ',n(ctx,r.to,weightText,`peak-to-${i}`)]]),'.'),h('p',{},'Deterministic minimax value: ',n(ctx,choice.minimax.value,formatRisk,'minimax-value'),'. The envelope peak is a lower bound; it can be strictly smaller.'),...model.comparisons.map((comparison,i)=>h('p',{},'Guarded report ',n(ctx,guardedProfiles[i].grade,formatGrades),' costs ',n(ctx,comparison.deltaRisk,formatRisk,`price-${i}`),' more weighted risk at this weight than the weighted best.')),h('p',{class:'wcr-note'},'The guarded set is both criteria, even when one has zero error weight. A fixed report has its worst weight at an endpoint; this differs from the maximizing weight of the lower envelope. Minimax is a maximum of expected criterion risks, not an expected maximum of realized losses. Risks at different weights use different losses.'));
 const rows=[...weightedProfiles.map((p,i)=>({...p,kind:'weighted',i})),...guardedProfiles.map((p,i)=>({...p,kind:'minimax',i}))];
 const table=h('table',{class:'wcr-table'},h('caption',{},'E: expected wrong directions; N: stated pairs; M: all unordered pairs'),h('thead',{},h('tr',{},...['Rule','Report','Criterion','E','E/N','E/M','Expected criterion risk','Worst endpoint'].map(text=>h('th',{scope:'col',text})))),h('tbody',{},...rows.flatMap(p=>[0,1].map(k=>h('tr',{},h('td',{text:p.kind}),h('td',{},n(ctx,p.grade,formatGrades)),h('th',{scope:'row',text:labels[k]}),h('td',{},n(ctx,p.evaluation.E[k],formatExpectedCount,`${p.kind}-E-${p.i}-${k}`)),h('td',{},n(ctx,p.evaluation.EoverN[k],formatShare,`${p.kind}-share-${p.i}-${k}`)),h('td',{},n(ctx,p.evaluation.EoverM[k],formatShare,`${p.kind}-perpair-${p.i}-${k}`)),h('td',{},n(ctx,p.evaluation.Rk[k],formatRisk,`${p.kind}-Rk-${p.i}-${k}`)),h('td',{},n(ctx,p.line.max,formatRisk)))))));
 slots.profiles.replaceChildren(h('p',{class:'wcr-note'},'Swipe or use the keyboard to scroll the tables.'),ctx.scrollRegion(h('div',{class:'wcr-scroll'},table),'Every retained weighted and guarded profile'));
 if(state.data!=='six'){
  const law=h('table',{class:'wcr-table'},h('caption',{},'Every eligible report in the restated two-unit law'),h('thead',{},h('tr',{},...['Report','Criterion one risk','Criterion two risk','Maximum','Weighted risk at current w'].map(text=>h('th',{scope:'col',text})))),h('tbody',{},...model.riskModel.lines.map((line,i)=>h('tr',{},h('td',{},n(ctx,line.grade,formatGrades,`law-grade-${i}`)),h('td',{},n(ctx,line.R1,formatRisk,`law-R1-${i}`)),h('td',{},n(ctx,line.R2,formatRisk,`law-R2-${i}`)),h('td',{},n(ctx,line.max,formatRisk,`law-max-${i}`)),h('td',{},n(ctx,evaluateReport(line.grade,model.E,{tau:state.tau,w:[state.w,1-state.w]}).risk,formatRisk,`law-risk-${i}`))))));
  slots.profiles.append(ctx.scrollRegion(h('div',{class:'wcr-scroll'},law),'All two-unit report risk endpoints'));
  slots.summary.append(h('p',{class:'wcr-note'},state.data==='book'?'Criterion one certainly favors A above B; criterion two is an even chance.':'The criteria certainly favor opposite directions. Requiring exactly two grades excludes withholding; the lower-envelope peak can lie strictly below the deterministic minimax value.'));
 }
 if(state.data==='book')slots.summary.append(h('p',{class:'wcr-note'},'Weighted risks: A above B, (',n(ctx,1),' − w) / ',n(ctx,2),'; B above A, (',n(ctx,1),' + w) / ',n(ctx,2),'; withholding, τ.'));
 ctx.caption.replaceChildren(state.data==='six'?'Six fictional sites; independent Normal posteriors set by hand for teaching; postrank does not fit them. ':model.data.source+'. ','τ = ',n(ctx,state.tau,formatSetting),'; ',tagNode(ctx,choice),'. Guarding both expected criterion risks.');
 }};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'worst-criterion',className:'wcr wpath tws',layout:'result-first',css:TWO_SCORES_CSS+WEIGHT_PATH_CSS+GUARDED_CRITERION_CSS,keys:{data:{type:'choice',values:['six','book','opposition'],value:'six'},w:{type:'number',min:0,max:1,step:.01,value:.9},tau:{type:'number',min:.001,max:.5,step:.001,value:.2},cap:{type:'choice',values:['1','2','3','all','exact2'],value:'3'},objective:{type:'choice',values:['weighted','minimax'],value:'weighted'}},build(ctx){const h=ctx.h;
 const data=ctx.select({label:'Illustrative law',options:[{value:'six',label:'Six sites, two scores'},{value:'book',label:'Two units: one certain, one uncertain criterion'},{value:'opposition',label:'Two units: certain opposition'}],value:'six',onChange:data=>ctx.set({data,tau:data==='six'?.2:.25,cap:data==='opposition'?'exact2':data==='six'?'3':'all'})});
 const w=ctx.slider({label:'Weight w on the first criterion (the second gets the remaining weight)',...ctx.key('w'),onInput:w=>ctx.set({w})}),tau=ctx.slider({label:'Cost τ per withheld pair',...ctx.key('tau'),onInput:tau=>ctx.set({tau})});
 const cap=ctx.select({label:'Allowed grades',options:[{value:'1',label:'At most one'},{value:'2',label:'At most two'},{value:'3',label:'At most three'},{value:'all',label:'No cap'},{value:'exact2',label:'Exactly two'}],value:'3',onChange:cap=>ctx.set({cap})});
 const objective=ctx.segmented({label:'Selected objective',options:[{value:'weighted',label:'Weighted expected risk'},{value:'minimax',label:'Guard both criteria'}],value:'weighted',onChange:objective=>ctx.set({objective})});
 ctx.controls.append(w.root,objective.root);ctx.primaryControl(w.root);
 const settings=ctx.disclosure({name:'settings',title:'Settings',placement:'none'});
 settings.body.append(data.root,tau.root,cap.root);
 const riskSlot=h('div'),reportSlot=h('div'),summary=h('div'),profiles=h('div');ctx.charts.append(h('div',{class:'wcr-grid'},h('section',{class:'prx-panel'},ctx.panelTitle('Each report’s risk as the weight moves'),riskSlot,settings.root),h('section',{class:'prx-panel'},ctx.panelTitle('Two ways to choose'),reportSlot),h('section',{class:'prx-panel wcr-wide'},ctx.panelTitle('The envelope peak and the price of guarding'),summary),h('section',{class:'prx-panel wcr-wide'},ctx.panelTitle('Every retained optimum: criterion profiles'),profiles)));
 ctx.primaryGraphic(riskSlot);
 const riskViews=['six','book','opposition'].map(key=>{const slot=h('div');riskSlot.append(slot);return {key,slot,view:createWeightedRiskView(ctx,slot,{currentLabel:true,...(key==='six'?{}:{yMax:1})})}}),view=createGuardedComparisonView(ctx,{reports:reportSlot,summary,profiles},{resultFirst:true});
 const progress=h('p',{class:'wpath-status','aria-hidden':'true'});ctx.controls.append(progress);
 let generation=0,cancelNext=null,dead=false,readyModel=null,readyLarge=false;
 const stop=()=>{generation++;cancelNext?.();cancelNext=null};ctx.onCleanup(()=>{dead=true;stop();progress.textContent=''});
 const finish=model=>{readyModel=model.riskModel;readyLarge=model.riskModel.lines.length>603;progress.textContent='';ctx.root.setAttribute('aria-busy','false')};
 return {render(state){
  stop();const epoch=generation;w.set(state.w);tau.set(state.tau);cap.set(state.cap);data.set(state.data);objective.set(state.objective);
  const model=solveGuardedCriteria(state),highlights=[...model.weightedProfiles.map((p,i)=>({grade:p.grade,label:i?'Another weighted best':'Weighted best at current weight',active:!i&&state.objective==='weighted',stroke:c=>state.objective==='weighted'?c.plotFg:c.plotMuted,dash:i?'5,3':undefined})),...model.guardedProfiles.map((p,i)=>({grade:p.grade,label:i?'Another guarded best':'Guarding both criteria',active:!i&&state.objective==='minimax',stroke:c=>state.objective==='minimax'?c.plotFg:c.plotMuted,dash:'9,3'}))];
  for(const risk of riskViews)risk.slot.hidden=risk.key!==state.data;const risk=riskViews.find(r=>r.key===state.data).view;
  if(model.riskModel===readyModel||(!readyLarge&&model.riskModel.lines.length<=603)){risk.render(model.riskModel,state,highlights);view.render(model,state);finish(model);return;}
  ctx.root.setAttribute('aria-busy','true');progress.textContent='Updating reports…';ctx.readout.set(['Updating the complete weighted and guarded report views…']);
  const stages=[()=>risk.prepare(model.riskModel),...risk.attachmentStages(model.riskModel),()=>risk.render(model.riskModel,state,highlights),()=>view.render(model,state)];let stage=0;
  const next=()=>{if(dead||epoch!==generation)return;ctx.keepFocus(()=>stages[stage++]());if(dead||epoch!==generation)return;if(stage<stages.length)cancelNext=ctx.timeout(next,20);else{cancelNext=null;finish(model)}};
  cancelNext=ctx.timeout(next,20);
 }};
}})}
