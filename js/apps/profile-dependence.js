// Author: JoonHo Lee (jlee296@ua.edu).
// A supplied finite joint law, evaluated exactly over its complete nine-card product bank.
import {createWidget} from '../shared/base.js';
import {formatCount} from '../shared/format.js';
import {mdomainExample,mdomainInput,mdomainFamily,mdomainSolve,mdomainEvaluate} from '../pr-core.js';
import {exactNum,gradeTable,pairTable,candidateTable,optimizerSummaryNode,resultScopeNode} from '../shared/mdomain/index.js';
import {VISUAL_CSS,createVisualFrame,scene,svgNode,svgText,svgExact,setSliderFace,reportButton} from '../shared/mdomain/visual.js';

const ACTIONS=[{code:'W',name:'Withhold',g:'1,1'},{code:'+',name:'A ahead',g:'1,2'},{code:'−',name:'B ahead',g:'2,1'}];
const CARDS=ACTIONS.flatMap(s=>ACTIONS.map(c=>({id:`p:${s.g}|${c.g}`,s,c})));
export const PROFILE_DEPENDENCE_KEYS={
 couplingIndex:{type:'integer',min:0,max:10,step:1,value:10},
 candidate:{type:'choice',values:CARDS.map(x=>x.id),value:'p:1,2|1,2'}
};
const cache=new Map();
/** Candidate focus changes inspection only; it never changes the feasible-family search. */
export function solveProfileDependence(state){
 const index=state.couplingIndex;
 let result=cache.get(index);
 if(!result){
  const request=mdomainExample('dependence',{couplingIndex:index});
  const input=mdomainInput(request.input),family=mdomainFamily(input,request.family);
  const fit=mdomainSolve(input,family,request.decision);
  const evaluations=new Map(fit.candidateTable.map(row=>[row.candidateId,mdomainEvaluate(input,row.grades,request.decision)]));
  result={request,input,fit,evaluations};cache.set(index,result);
 }
 return {...result,focus:result.evaluations.get(state.candidate)};
}
const CSS=`${VISUAL_CSS}
.mdp{min-width:0}.mdp .mdp-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr));gap:1rem;min-width:0}
.mdp .mdp-section{min-width:0;margin:.8rem 0}.mdp .mdp-note{font-size:.88rem;line-height:1.45}.mdp .mdp-scroll{overflow-x:auto;max-width:100%;min-width:0}
.mdp .mdp-table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;font-size:.88rem}.mdp .mdp-table th,.mdp .mdp-table td{padding:.4rem;text-align:left;white-space:nowrap;border-bottom:1px solid var(--prx-border)}
.mdp .mdp-grid{table-layout:fixed;min-width:22rem}.mdp .mdp-grid th:first-child{width:6rem}.mdp .mdp-card{display:block;width:100%;padding:.45rem;border:1px solid var(--prx-border-strong);border-radius:.25rem;background:var(--prx-bg);color:var(--prx-fg);text-align:left}
.mdp .mdp-card[aria-pressed=true]{outline:3px solid var(--prx-accent);outline-offset:1px}.mdp .mdp-card.mdp-optimal{border:3px double var(--prx-fg)}.mdp .mdp-card:focus-visible{outline:3px solid var(--prx-focus)}
.mdp .mdp-card span{white-space:nowrap}.mdp .mdp-union{font-weight:700}.mdp .mdp-state-table{min-width:27rem}.mdp .mdp-selected{font-weight:600}
.mdp .mdp-story-event{cursor:pointer;outline:none}.mdp .mdp-story-event:focus .mdp-story-hit{stroke:var(--prx-plot-focus);stroke-width:3}
.mdp .mdp-outcome-label{margin:0;text-align:center;font-size:max(14px,.85rem);font-weight:600;color:var(--prx-plot-fg)}
.mdp .mdp-story-inspector{padding:.05rem .85rem .4rem;min-height:1.7rem;font-size:max(14px,.85rem);line-height:1.4;color:var(--prx-plot-fg)}
`;
function number(ctx,value,hook){const node=ctx.num(value,formatCount(value));if(hook)node.dataset.prxReadout=hook;return node;}
function exact(ctx,value,hook){const node=exactNum(ctx,value);if(hook)node.dataset.prxReadout=hook;return node;}
function name(ctx,value){return ctx.h('span',{'data-prx-name':''},value);}
function table(ctx,headers,rows,caption){return ctx.h('table',{class:'mdp-table'},ctx.h('caption',{},caption),ctx.h('thead',{},ctx.h('tr',{},headers.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},rows.map(r=>ctx.h('tr',{},r.map((v,i)=>ctx.h(i===0?'th':'td',i===0?{scope:'row'}:{},v))))));}
function section(ctx,title){const e=ctx.h('section',{class:'mdp-section'},ctx.panelTitle(title));return e;}
function actionName(grades,k){const a=grades.values[0][k],b=grades.values[1][k];return a===b?'withhold':a<b?'A ahead':'B ahead';}

// Display coordinates only. The supplied evaluation determines masses, feasibility and optima.
const coordinate=raw=>{const[n,d='1']=raw.split('/');return Number(n)/Number(d);};
let graphicSequence=0;
function drawOverlapStory(ctx,visual,result,{hatchId,onInspect,inspectionKey,onReport}){
 const dual=result.evaluations.get('p:1,2|1,2'),states=dual.states;
 const onlyS=states.findIndex(row=>row.exceedances[0]&&!row.exceedances[1]);
 const both=states.findIndex(row=>row.exceedances[0]&&row.exceedances[1]);
 const offset=result.input.masses[onlyS],overlap=result.input.masses[both];
 const values={S:dual.domains[0].eventProbabilityExact,C:dual.domains[1].eventProbabilityExact,overlap,union:dual.jointProbabilityExact};
 const {svg,figure,width,colors}=scene(ctx,visual.stage,{height:270,label:'If both directions are reported: fixed marginal error probabilities, their overlap, and the union against the joint cap.'});
 figure.insertBefore(ctx.h('figcaption',{'data-mdp-story-caption':''},'If both directions are reported · S composition · C community'),svg);
 // Interactive event marks need their own accessible descendants rather than one atomic image.
 svg.setAttribute('role','group');svg.setAttribute('data-mdp-story-candidate','p:1,2|1,2');
 const left=22,span=width-44,scale=coordinate('1/5'),x=raw=>left+coordinate(raw)/scale*span,w=raw=>coordinate(raw)/scale*span;
 svg.setAttribute('data-mdp-scale-max','1/5');svg.setAttribute('data-mdp-scale-left',String(left));svg.setAttribute('data-mdp-scale-width',String(span));
 const pattern=svgNode(ctx,'pattern',{id:hatchId,width:7,height:7,patternUnits:'userSpaceOnUse'},svgNode(ctx,'path',{d:'M-2 2 L2 -2 M0 7 L7 0 M5 9 L9 5',stroke:colors.hatch,'stroke-width':2}));
 svg.append(svgNode(ctx,'defs',{},pattern));
 // The interval arrangement is made from the actual S-only and both-error state masses.
 svg.append(svgNode(ctx,'rect',{x:x(offset),y:27,width:w(overlap),height:73,fill:`url(#${hatchId})`,opacity:.18}));
 const inspector=ctx.h('div',{class:'mdp-story-inspector','data-mdp-inspector':'','aria-label':'Inspected error event'});
 const descriptions={S:['S error: ',values.S],C:['C error: ',values.C],overlap:['Both errors: ',overlap],union:['Either error, counted once: ',values.union]};
 function inspect(key){onInspect(key);const[label,raw]=descriptions[key];inspector.replaceChildren(label,exactNum(ctx,raw,{style:'percent',digits:0}),'.');}
 function bar(mark,key,label,raw,start,y,height,fill,options={}){
  const group=svgNode(ctx,'g',{class:'mdp-story-event',role:'button',tabindex:0,'aria-label':`${label}; exact probability ${raw}.`,'data-prx-focus-key':`overlap-story:${key}`});
  const hitWidth=Math.max(44,w(raw)),hitX=Math.max(left,Math.min(start,width-left-hitWidth));
  group.append(svgNode(ctx,'rect',{class:'mdp-story-hit','data-prx-focus-ring':'',x:hitX,y:y-10,width:hitWidth,height:44,rx:4,fill:'transparent',stroke:'transparent'}));
  group.append(svgNode(ctx,'rect',{x:start,y,width:w(raw),height,rx:3,fill,stroke:colors.plotFg,'stroke-width':1.4,'data-mdp-mark':mark,'data-exact':raw,'data-mdv-role':mark,'data-mdv-exact':raw}));
  if(options.hatch)group.append(svgNode(ctx,'rect',{x:start,y,width:w(raw),height,rx:3,fill:`url(#${hatchId})`,'pointer-events':'none'}));
  if(raw==='0')group.append(svgNode(ctx,'line',{x1:start,x2:start,y1:y,y2:y+height,stroke:colors.plotFg,'stroke-width':2}));
  group.append(svgNode(ctx,'title',{},`${label}: ${raw}`));
  group.addEventListener('click',()=>inspect(key));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(key);}});
  svg.append(group,svgText(ctx,left,y-8,label,{'font-size':15,'font-weight':600}),svgExact(ctx,width-left,y-8,raw,{style:'percent',digits:0},{'font-size':16,'text-anchor':'end','font-weight':600}));
 }
 bar('marginal-S','S','S error',values.S,left,32,20,colors.crit[0]);
 bar('marginal-C','C','C error',values.C,x(offset),76,20,colors.crit[1]);
 // Repeat the shared piece on both fixed-length marginal strips, using hatch as well as color.
 for(const y of [32,76])svg.append(svgNode(ctx,'rect',{x:x(offset),y,width:w(overlap),height:20,fill:`url(#${hatchId})`,'pointer-events':'none'}));
 bar('overlap','overlap','Both errors',overlap,x(offset),120,14,colors.plotBg,{hatch:true});
 bar('union','union','Either error',values.union,left,164,24,dual.feasible?colors.accent:colors.err);
 const capX=x(result.request.decision.alpha);
 svg.append(svgNode(ctx,'line',{x1:capX,x2:capX,y1:157,y2:197,stroke:colors.plotFg,'stroke-width':3,'stroke-dasharray':'4 3','data-mdp-mark':'cap','data-exact':result.request.decision.alpha,'data-mdv-role':'cap','data-mdv-exact':result.request.decision.alpha}),svgText(ctx,capX,208,'Joint error cap',{'font-size':15,'text-anchor':'middle'}));
 svg.append(svgNode(ctx,'line',{x1:left,x2:width-left,y1:220,y2:220,stroke:colors.plotAxis,'stroke-width':1.5}));
 for(const raw of ['0','1/20','1/10','3/20','1/5'])svg.append(svgNode(ctx,'line',{x1:x(raw),x2:x(raw),y1:220,y2:225,stroke:colors.plotAxis}),svgExact(ctx,x(raw),243,raw,{style:'percent',digits:0},{'font-size':15,'text-anchor':'middle'}));
 svg.append(svgText(ctx,width/2,265,'Probability mass (zoomed)',{'font-size':15,'text-anchor':'middle'}));
 const heading=ctx.h('p',{class:'mdp-outcome-label'},'Optimal reports · equal grades withhold a direction'),optima=ctx.h('div',{class:'mdv-optima'});
 for(const id of result.fit.optimizerIds){const grades=result.evaluations.get(id).grades,button=reportButton(ctx,grades,{id,label:id===result.fit.selectedId?'Canonical optimum':'Also optimal',selected:ctx.state.candidate===id,onSelect:()=>onReport(id)});button.dataset.mdpOptimizer=id;optima.append(button);}
 const card=result.focus;
 figure.append(ctx.h('p',{class:'mdp-outcome-label'},dual.feasible?'Either-error mass is at or below the cap.':'Either-error mass exceeds the cap.'),inspector,heading,optima,
  ctx.h('p',{class:'mdp-story-inspector','data-mdp-card-inspector':''},'Inspecting S ',name(ctx,actionName(card.grades,0)),' · C ',name(ctx,actionName(card.grades,1)),' · joint error ',exactNum(ctx,card.jointProbabilityExact,{style:'percent',digits:0}),'.'));
 inspect(inspectionKey);
}

export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:'profile-dependence',className:'mdp',css:CSS,keys:PROFILE_DEPENDENCE_KEYS,
 build(ctx){
  const coupling=ctx.slider({label:'Error overlap',...ctx.key('couplingIndex'),onInput:v=>ctx.set({couplingIndex:v})});
  const focus=ctx.select({label:'Inspect a candidate (S; C)',options:CARDS.map(x=>({value:x.id,label:`${x.s.name}; ${x.c.name}`})),value:ctx.state.candidate,onChange:v=>ctx.set({candidate:v})});
  ctx.controls.append(coupling.root,focus.root);
  ctx.charts.before(ctx.readout.node);
  const policy=ctx.h('p',{class:'mdp-note'});ctx.charts.append(policy);
  const top=ctx.h('div',{class:'mdp-layout'}),law=section(ctx,'A complete joint law'),grid=section(ctx,'All cards in the stated product bank');top.append(law,grid);ctx.charts.append(top);
  const detail=section(ctx,'The inspected card'),selected=section(ctx,'All minimum-risk cards');ctx.charts.append(detail,selected);
  const visual=createVisualFrame(ctx,{mainControl:coupling.root});
  // Candidate inspection is a separate exact-data task, not another story control.
  visual.dataBody.insertBefore(ctx.h('div',{class:'prx-controls'},focus.root),policy);
  const hatchId=`mdp-overlap-${++graphicSequence}`;let inspectionKey='union';
  let gridButtons=[];
  function focusGrid(id){gridButtons.find(b=>b.dataset.card===id)?.focus();}
  return {render(state){
   coupling.set(state.couplingIndex);focus.set(state.candidate);visual.sync();
   const r=solveProfileDependence(state),{input,request,fit}=r,inspection=r.focus;
   const dual=r.evaluations.get('p:1,2|1,2');
   const nFeasible=fit.candidateTable.filter(c=>c.feasible).length;
   policy.replaceChildren('Policy: domain weights ',exact(ctx,request.decision.weights[0],'weight-0'),' and ',exact(ctx,request.decision.weights[1],'weight-1'),'; withholding costs ',exact(ctx,request.decision.tau[0],'tau-0'),' and ',exact(ctx,request.decision.tau[1],'tau-1'),'; exceedance thresholds ',exact(ctx,request.decision.t[0],'threshold-0'),' and ',exact(ctx,request.decision.t[1],'threshold-1'),'. Expected-error guards are disabled. Both scopes include all original pairs.');
   visual.auditReadout.set(['Failure overlap c = ',exact(ctx,input.masses.at(-1),'coupling'),'. Both forward-direction marginal errors are ',exact(ctx,dual.domains[0].expectedFalseCountExact,'marginal-S'),' and ',exact(ctx,dual.domains[1].expectedFalseCountExact,'marginal-C'),'. The double-positive card has joint failure probability ',exact(ctx,dual.jointProbabilityExact,'dual-J'),', against cap ',exact(ctx,request.decision.alpha,'alpha'),'. Minimum risk is ',exact(ctx,fit.riskExact,'minimum-risk'),' across ',number(ctx,fit.optimizerIds.length,'optimizer-count'),(fit.optimizerIds.length===1?' optimal card; ':' optimal cards; '),number(ctx,nFeasible,'feasible-count'),' of ',number(ctx,fit.searchScope.candidateCount,'candidate-count'),' cards are feasible.']);
   law.replaceChildren(ctx.panelTitle('A complete joint law'),ctx.h('p',{class:'mdp-note'},'B has target zero in both domains. Each row gives A’s two targets and the probability of that state. For the selected card, a state counts once if the error share exceeds its threshold in either domain.'));
   const rows=input.states.map((s,i)=>[name(ctx,input.stateIds[i]),number(ctx,s[0][0]),number(ctx,s[0][1]),exact(ctx,input.masses[i],`mass-${i}`),number(ctx,inspection.states[i].falseCounts[0],`false-${i}-S`),number(ctx,inspection.states[i].falseCounts[1],`false-${i}-C`),ctx.h('span',{class:inspection.states[i].unionExceeded?'mdp-union':'', 'data-prx-readout':`union-${i}`},inspection.states[i].unionExceeded?'In union':'Outside union')]);
   const lawTable=table(ctx,['State','S target','C target','Mass','S false','C false','Joint event'],rows,'Complete law and inspected-card events');lawTable.classList.add('mdp-state-table');const lawRegion=ctx.scrollRegion(ctx.h('div',{class:'mdp-scroll'},lawTable),'Complete finite law and union-event table');lawRegion.classList.add('mdp-scroll');law.append(lawRegion);
   law.append(ctx.h('p',{class:'mdp-note'},'The full marginal law is unchanged: A is above B with probability ',exact(ctx,r.evaluations.get('p:2,1|2,1').domains[0].expectedFalseCountExact),' and below B with probability ',exact(ctx,dual.domains[0].expectedFalseCountExact),', in each domain. A state with errors in both domains counts once in the joint probability.'));
   grid.replaceChildren(ctx.panelTitle('All cards in the stated product bank'),ctx.h('p',{class:'mdp-note'},'The columns give S grades, and the rows give C grades. Double borders mark the lowest-risk feasible cards. The outline follows the selected card. Use the arrow keys to move between cards.'));
   gridButtons=[];
   const body=ACTIONS.map((c,rowIndex)=>ctx.h('tr',{},ctx.h('th',{scope:'row'},c.name),ACTIONS.map((s,colIndex)=>{
    const id=`p:${s.g}|${c.g}`,row=fit.candidateTable.find(x=>x.candidateId===id),button=ctx.h('button',{type:'button',class:`mdp-card${row.optimal?' mdp-optimal':''}`,'aria-pressed':state.candidate===id?'true':'false','aria-label':`S: ${s.name}; C: ${c.name}. ${row.feasible?'Feasible':'Infeasible'}. Risk ${row.riskExact}; joint probability ${row.jointProbabilityExact}.${row.optimal?' Exact optimum.':''}`,'data-card':id,'data-prx-focus-key':`candidate:${id}`,tabindex:state.candidate===id?0:-1,onclick:()=>ctx.set({candidate:id}),onkeydown:event=>{
     const shifts={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]};const shift=shifts[event.key];if(!shift)return;event.preventDefault();
     const rr=(rowIndex+shift[0]+ACTIONS.length)%ACTIONS.length,cc=(colIndex+shift[1]+ACTIONS.length)%ACTIONS.length,next=`p:${ACTIONS[cc].g}|${ACTIONS[rr].g}`;ctx.set({candidate:next});focusGrid(next);
    }},row.feasible?'Feasible':'Infeasible',ctx.h('br'), 'Risk ',exact(ctx,row.riskExact,`card-${colIndex}-${rowIndex}-risk`),ctx.h('br'),'J ',exact(ctx,row.jointProbabilityExact,`card-${colIndex}-${rowIndex}-J`),row.optimal?ctx.h('strong',{},' · Optimal'):null);
    gridButtons.push(button);return ctx.h('td',{},button);
   })));
   const cardGrid=ctx.h('table',{class:'mdp-table mdp-grid'},ctx.h('caption',{},'Candidate risk, direct union probability and feasibility'),ctx.h('thead',{},ctx.h('tr',{},ctx.h('th',{scope:'col'},'C / S'),ACTIONS.map(s=>ctx.h('th',{scope:'col'},s.name)))),ctx.h('tbody',{},body));const gridRegion=ctx.scrollRegion(ctx.h('div',{class:'mdp-scroll'},cardGrid),'Nine-card candidate grid');gridRegion.classList.add('mdp-scroll');grid.append(gridRegion);
   detail.replaceChildren(ctx.panelTitle('The inspected card'),ctx.h('p',{},'S: ',name(ctx,actionName(inspection.grades,0)),'; C: ',name(ctx,actionName(inspection.grades,1)),'. Risk ',exact(ctx,inspection.riskExact,'focused-risk'),'; direct joint probability ',exact(ctx,inspection.jointProbabilityExact,'focused-J'),'. ',ctx.h('strong',{'data-prx-readout':'focused-status'},inspection.feasible?'Feasible':'Infeasible'),'. Joint event status: ',ctx.h('span',{'data-prx-readout':'focused-joint-status'},inspection.jointStatus==='analytic_zero'?'Analytic zero (no active event)':inspection.jointStatus==='disabled'?'Disabled':'Evaluated directly'),'.'),gradeTable(ctx,inspection.grades),pairTable(ctx,inspection.grades));
   const domainRows=inspection.domains.map((d,k)=>[name(ctx,d.domainId),number(ctx,inspection.originalPairs,`M-${k}`),number(ctx,d.disclosedPairs,`N-${k}`),exact(ctx,d.expectedFalseProportionExact,`ratio-${k}`),number(ctx,d.firstExceedanceCount,`cutoff-${k}`),exact(ctx,d.eventProbabilityExact,`event-${k}`)]);
   const domainTable=table(ctx,['Domain','Original pairs','Disclosed pairs','Expected false / disclosed','First exceeded count','Event probability'],domainRows,'Inspected-card denominators and strict exceedance');detail.append(ctx.scrollRegion(ctx.h('div',{class:'mdp-scroll'},domainTable),'Inspected-card protection details'),ctx.h('p',{class:'mdp-note'},'A domain with no stated comparisons has no error share and cannot exceed its threshold. A stated direction is wrong if the targets are equal. The event counts only shares above the threshold, and the cap allows joint probabilities up to and including its value.'));
   selected.replaceChildren(ctx.panelTitle('All minimum-risk cards'),optimizerSummaryNode(ctx,fit),gradeTable(ctx,fit.selectedGrades,{caption:"Grades of the canonical representative",part:"canonical-grades"}),resultScopeNode(ctx,fit),candidateTable(ctx,fit));
   selected.append(ctx.h('p',{class:'mdp-note'},'The app lists all the feasible cards tied at the lowest risk and displays one first. These results apply to the fictional distribution in the table.'));
   setSliderFace(ctx,coupling,input.masses.at(-1));
   drawOverlapStory(ctx,visual,r,{hatchId,inspectionKey,onInspect:key=>{inspectionKey=key;},onReport:id=>ctx.set({candidate:id})});
   ctx.readout.set([dual.feasible?'Both directions admitted. ':'Best reports keep one direction. ',number(ctx,fit.optimizerIds.length),fit.optimizerIds.length===1?' optimal report.':' optimal reports.']);
   const massNodes=[];
   for(const [key,label,sError,cError] of [['neither','Neither',false,false],['S-only','S only',true,false],['C-only','C only',false,true],['both','Both',true,true]]){
    const i=dual.states.findIndex(row=>row.exceedances[0]===sError&&row.exceedances[1]===cError);
    const n=exactNum(ctx,input.masses[i],{style:'percent',digits:0});n.dataset.mdpStateMass=key;
    massNodes.push(label+' ',n,' · ');
   }
   massNodes.pop();
   visual.setScope(['Fixed domain laws · supplied finite joint law. State masses: ',...massNodes,'. ',number(ctx,fit.searchScope.candidateCount),' candidate profiles.']);
  }};
 }});
}
