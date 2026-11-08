// X-01 local-input tool: pasted records and matrices never enter widget state, URLs or the iframe bridge.
import {yourDataR} from '../shared/your-data-r-export.js';
export {yourDataR} from '../shared/your-data-r-export.js';
import {createWidget} from '../shared/base.js';
import {blocksText,formatCount,formatDecimal,formatExpectedCount,formatGrades,formatPercent,formatProb,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {exposeResult,labelNode,tagNode,tieNode} from '../shared/labels.js';
import {MATRIX_SOURCE_KINDS,YOUR_DATA_PRESETS,csvText,inputCsv,parseUserInput,publicYourDataInput,publicYourDataProvenance} from '../shared/your-data-input.js';
import {drawReportCard,cardRows,REPORT_CARD_CSS} from './report-card.js';
import {drawRelationMatrix,REPORT_BUILDER_CSS} from './report-builder.js';
import {matrixView,cssFor} from './pairwise-matrix.js';
import {createBrowserSolveController} from './computing-grades.js';
import {ENUMERATION_BUDGET,errorArray,evaluateReport,exactOptimum,expectedRank,familySize,fixedOrderDP,normalInterval,normalPosterior,relations,scoreOrder} from '../pr-core.js';

const vector=(value)=>{const values=Array.isArray(value)?value:typeof value==='string'?value.split(',').map(x=>Number(x.trim())):null;return values?.length>=1&&values.length<=3&&values.every(Number.isFinite)?values.slice():undefined;};
const finite=value=>{if(typeof value==='string'&&value.trim()==='')return undefined;const n=Number(value);return Number.isFinite(n)?n:undefined;};
const reportChoices=opt=>[opt.grade,...opt.grades.filter(g=>!same(g,opt.grade))];
const transpose=m=>m.map((_,i)=>m.map(row=>row[i]));
const rowMatrix=columns=>columns[0].map((_,i)=>columns.map(column=>column[i]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const YOUR_DATA_KEYS={
 example:{type:'choice',values:[...YOUR_DATA_PRESETS.map(p=>p.id),'local'],value:'league8-posterior'},
 format:{type:'choice',values:['posterior','estimates','probabilities'],value:'posterior'},
 prior:{type:'choice',values:['normal','flat'],value:'normal'},priorMean:{type:'custom',value:0,parse:finite},priorSd:{type:'custom',value:.15,parse:finite},
 tau:{type:'custom',value:.2,parse:finite},cap:{type:'choice',values:['all',...Array.from({length:30},(_,i)=>String(i+1))],value:'3'},
 weights:{type:'custom',value:[1],parse:vector},orient:{type:'custom',value:[1],parse:v=>{const a=vector(v);return a?.every(x=>x===1||x===-1)?a:undefined;}},
 matrixEvent:{type:'choice',values:['directional_error','higher_priority'],value:'directional_error'},zeroTies:{type:'boolean',value:true},
 criterion:{type:'integer',min:0,max:2,value:0},reportIndex:{type:'integer',min:0,max:100,value:0},producer:{type:'choice',values:['automatic','solver'],value:'automatic'},timeLimit:{type:'number',min:.1,max:3,step:.1,value:1},
};
export function analyzeYourData(input,state){
 const n=input.ids.length,K=input.criteria.length,w=state.weights,orient=state.orient;
 if(!w||w.length!==K||w.some(x=>!Number.isFinite(x)||x<0)||Math.abs(w.reduce((a,b)=>a+b,0)-1)>1e-12)throw new Error('Give one nonnegative weight per criterion; the weights must sum to one.');
 if(!orient||orient.length!==K||orient.some(x=>x!==1&&x!==-1))throw new Error('Declare a direction for every criterion.');
 if(!(state.tau>0&&state.tau<=.5))throw new Error('Withholding cost τ must be above zero and at most one half.');
 let E,posterior=null;
 if(input.format==='probabilities'){
  const raw=input.probabilities.map(m=>m.map(row=>row.map(p=>input.event==='higher_priority'?1-p:p)));
  E={ids:input.ids.slice(),criteria:input.criteria.slice(),e:raw.map((m,k)=>orient[k]<0?transpose(m):m)};
 }else{
  let mean,sd;
  if(input.format==='estimates'){
   if(state.prior==='normal'&&!(state.priorSd>0))throw new Error('The Normal prior SD must be above zero.');
   const columns=input.criteria.map((_,k)=>normalPosterior(input.estimate.map(row=>row[k]),input.se.map(row=>row[k]),{priorMean:state.priorMean,priorSd:state.prior==='flat'?Infinity:state.priorSd}));
   mean=rowMatrix(columns.map(p=>p.mean));sd=rowMatrix(columns.map(p=>p.sd));
  }else{mean=input.mean.map(row=>row.slice());sd=input.sd.map(row=>row.slice());}
  const intervals=input.criteria.map((_,k)=>normalInterval(mean.map(row=>row[k]),sd.map(row=>row[k]),.9));
  posterior={mean,sd,lower:rowMatrix(intervals.map(x=>x.lower)),upper:rowMatrix(intervals.map(x=>x.upper))};
  E=errorArray(mean,sd,{ids:input.ids,criteria:input.criteria,orient});
 }
 const family=state.cap==='all'?{kind:'all'}:{kind:'atMost',G:Number(state.cap)},size=familySize(n,family);
 const preflight={nAllowed:n<=ENUMERATION_BUDGET.maxUnits,countAllowed:size<=ENUMERATION_BUDGET.maxReports,familySize:size};
 const rank=expectedRank(E,{w}),order=scoreOrder(rank,{direction:'ascending',ids:E.ids}),method=preflight.nAllowed&&preflight.countAllowed?'enumeration':'weighted-expected-rank-order';
 const options={tau:state.tau,w,maxTies:100,tieTol:1e-12};
 const optimum=method==='enumeration'?exactOptimum(E,{...options,family}):fixedOrderDP(E,{...options,order:order.order,blocks:order.blocks,G:state.cap==='all'?n:Number(state.cap)});
 return {E,posterior,preflight,method,expectedRank:rank,order:method==='enumeration'?null:order.order,blocks:method==='enumeration'?null:order.blocks,optimum,input,settings:{...state,weights:w.slice(),orient:orient.slice()}};
}
const CSS=`${REPORT_CARD_CSS}\n${REPORT_BUILDER_CSS}\n${cssFor('prx-yd')}
.prx-yd .yd-primary{display:grid;grid-template-columns:minmax(16rem,1fr) minmax(0,1.7fr);gap:1rem;align-items:start}
.prx-yd .yd-output{grid-column:2;grid-row:1}.prx-yd .yd-settings{grid-column:1;grid-row:1;min-width:0}
.prx-yd .yd-controls{display:flex;flex-wrap:wrap;align-items:end;gap:.5rem .75rem;min-width:0}
.prx-yd .yd-tau{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.15rem .35rem}
.prx-yd .yd-tau-title{grid-column:1/-1;font-weight:600}
.prx-yd .yd-tau input[type=number]{width:4rem}
.prx-yd .yd-tau .prx-control label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.prx-yd .yd-tau .prx-slider{grid-template-columns:1fr}
.prx-yd .yd-tau input[type=range]{width:clamp(4.75rem,15vw,10rem);min-height:1.55rem}
.prx-yd .yd-result-copy p{margin:.3rem 0}.prx-yd .yd-tabs{margin-top:1rem}
.prx-yd .yd-tab-list{display:flex;flex-wrap:wrap;gap:.3rem;border-bottom:1px solid var(--prx-border);padding-bottom:.3rem}
.prx-yd .yd-tab-list [aria-selected=true]{font-weight:bold;border-color:var(--prx-fg);text-decoration:underline;text-underline-offset:.2em}
.prx-yd .yd-pair-panels{display:grid;grid-template-columns:minmax(0,1fr);gap:.65rem 1rem}
.prx-yd .yd-tab-panel{min-width:0}
@media(min-width:49rem){.prx-yd .yd-pair-panels{grid-template-columns:repeat(2,minmax(0,1fr))}}
.prx-yd .yd-editor,.prx-yd .yd-output,.prx-yd .yd-section{min-width:0}
.prx-yd .yd-section{margin-top:1rem}.prx-yd .yd-note{font-size:.9em;color:var(--prx-fg-muted);margin:.35rem 0}
.prx-yd .yd-status{min-height:1.5em;margin:.35rem 0}.prx-yd .yd-error{color:var(--prx-err-text);border-left:3px solid var(--prx-err);padding:.35rem .6rem}
.prx-yd textarea{display:block;width:100%;min-width:0;max-width:100%;font: .8rem/1.4 monospace;resize:vertical;border:1px solid var(--prx-border);border-radius:var(--prx-radius);background:var(--prx-bg-raised);color:var(--prx-fg);padding:.4rem}
.prx-yd .yd-fields{display:flex;flex-wrap:wrap;gap:.4rem}.prx-yd .yd-fields>*{flex:1 1 8rem;min-width:0}
.prx-yd .yd-criterion{padding:.4rem 0;border-bottom:1px solid var(--prx-border)}
.prx-yd .yd-table{border-collapse:collapse;max-width:100%;font-size:.9em}.prx-yd .yd-table th,.prx-yd .yd-table td{padding:.3rem .45rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--prx-border);white-space:nowrap}
.prx-yd .yd-table caption{caption-side:top;white-space:normal;text-align:left}.prx-yd .yd-scroll{max-width:100%;overflow:auto;max-height:32rem}
.prx-yd .yd-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.prx-yd .yd-solver [aria-disabled=true]{opacity:.6}
.prx-yd .yd-source input,.prx-yd .yd-source select{max-width:100%;width:100%}.prx-yd .yd-matrix-shell{max-height:38rem;overflow:auto;max-width:100%}
.prx-yd [data-prx-readout="grade"],.prx-yd [data-prx-readout="readout-grade"]{white-space:normal;overflow-wrap:anywhere}
.prx-yd .yd-output .prx-result-tag{margin:.3rem 0}.prx-yd [hidden]{display:none!important}
@media(max-width:48rem){
 .prx-yd .yd-primary{grid-template-columns:minmax(0,1fr);gap:.65rem}
 .prx-yd .yd-controls{gap:.5rem}.prx-yd .yd-controls select{max-width:9rem}
 .prx-yd .yd-output,.prx-yd .yd-settings{grid-area:auto}
}`;
const name=(ctx,text)=>ctx.h('span',{'data-prx-name':text,text});
const num=(ctx,value,format,hook)=>{const span=ctx.num(value,format(value));if(hook)span.dataset.prxReadout=hook;return span;};
const table=(ctx,caption,headers,rows)=>ctx.h('table',{class:'yd-table'},ctx.h('caption',{text:caption}),ctx.h('thead',{},ctx.h('tr',{},...headers.map(text=>ctx.h('th',{scope:'col'},text)))),ctx.h('tbody',{},...rows.map(row=>ctx.h('tr',{},...row.map((cell,i)=>ctx.h(i?'td':'th',i?{}:{scope:'row'},cell))))));
const setOptions=(ctx,control,options,entries)=>{options.splice(0,options.length,...entries);control.input.replaceChildren(...options.map((o,i)=>ctx.h('option',{value:String(i),'data-prx-name':o.label,text:o.label})));};

export function mountWidget(el,spec={}){
 let resetPublic=()=>{},finishPublicReset=()=>{};
 const handle=createWidget(el,spec,{name:'your-data',className:'prx-yd prx-rc prx-rb',layout:'result-first',presetLabel:'Start from a public example',css:CSS,keys:YOUR_DATA_KEYS,build(ctx){
  const h=ctx.h,doc=ctx.doc;let applied=null,revision=0,closed=false,model=null,lastGood=null,forcePublic=false,loadedExample=null,loadedEvent=null,invalidDraft=false,solverRecord=null,appliedIsLocal=false,exportSnapshot=null;
  const memo=new Map(),numberValues=new WeakMap();
  let generation=0,cancelNext=null,painting=false,activeSolverKey=null;
  let focusAfterApply=null,publicProvenance=null,lastPublicPreset='league8-posterior';
  const stopPaint=()=>{generation++;cancelNext?.();cancelNext=null;painting=false;};
  const busy=()=>{if(painting||solver.running)ctx.root.setAttribute('aria-busy','true');else ctx.root.removeAttribute('aria-busy');};
  function syncNumber(control,value,force=false){const editing=doc.activeElement===control.input,previous=numberValues.get(control),text=control.input.value.trim(),matches=text!==''&&Number(text)===value;if(force||!editing||previous!==value&&!matches)control.set(value);numberValues.set(control,value);}
  const tau=ctx.numberInput({label:'Withholding cost τ',name:'tau',step:.01,value:ctx.state.tau,onInput:v=>ctx.set({tau:v})});
  // Native arrows use the common range. Typed values retain the exact existing analysis domain.
  tau.input.min='.01';tau.input.max='.50';
  const tauSlider=ctx.slider({label:'Adjust τ',name:'tau-slider',min:.01,max:.5,step:.01,value:ctx.state.tau,onInput:v=>ctx.set({tau:v})});
  tauSlider.output.hidden=true;
  const tauControl=ctx.primaryControl(h('div',{class:'yd-tau'},h('span',{class:'yd-tau-title',text:'Withholding cost τ'}),tauSlider.root,tau.root));
  tau.input.setAttribute('aria-description','Enter a withholding cost above zero and at most one half.');
  const capOptions=[{value:'all',label:'No grade cap'},...Array.from({length:30},(_,i)=>({value:String(i+1),label:`At most ${i+1} grades`}))];
  const cap=ctx.select({label:'Report family',name:'cap',options:capOptions,value:ctx.state.cap,onChange:v=>ctx.set({cap:v,producer:'automatic',reportIndex:0})});
  const format=ctx.select({label:'CSV input format',name:'format',options:[{value:'posterior',label:'Posterior means and SDs'},{value:'estimates',label:'Estimates and SEs'},{value:'probabilities',label:'Supplied probability matrices'}],value:ctx.state.format,onChange:v=>{invalidDraft=true;focusAfterApply=null;ctx.set({format:v})}});
  ctx.afterPresets(h('div',{class:'yd-controls'},tauControl,cap.root));
  const text=h('textarea',{rows:7,spellcheck:false,'aria-label':'CSV or TSV input; one row per unit, or one square matrix per criterion','data-prx-input':''});
  const prior=ctx.select({label:'Prior for the estimates',name:'prior',options:[{value:'normal',label:'Stated Normal prior'},{value:'flat',label:'Flat prior; no shrinkage'}],value:ctx.state.prior,onChange:v=>ctx.set({prior:v})});
  const priorMean=ctx.numberInput({label:'Prior mean',name:'priorMean',step:'any',value:0,onInput:v=>ctx.set({priorMean:v})}),priorSd=ctx.numberInput({label:'Prior SD',name:'priorSd',step:'any',value:.15,onInput:v=>ctx.set({priorSd:v})});
  const priorFields=h('div',{},prior.root,h('div',{class:'yd-fields'},priorMean.root,priorSd.root));
  const event=ctx.select({label:'Each supplied cell means',name:'matrixEvent',options:[{value:'directional_error',label:'Chance the row-above-column direction is wrong'},{value:'higher_priority',label:'Chance the row has higher priority than the column'}],value:ctx.state.matrixEvent,onChange:v=>{invalidDraft=true;focusAfterApply=null;ctx.set({matrixEvent:v})}});
  const zero=ctx.toggle({label:'I declare zero probability of latent equality and a zero comparison margin.',name:'zeroTies',checked:true,onChange:v=>{invalidDraft=true;focusAfterApply=null;ctx.set({zeroTies:v})}});
  const sourceKind=h('select',{'aria-label':'Probability source kind'},...MATRIX_SOURCE_KINDS.map(k=>h('option',{value:k,text:k.replaceAll('_',' ')}))),sourceDescription=h('input',{type:'text','aria-label':'Probability source description'}),sourceCondition=h('input',{type:'text','aria-label':'Conditioning statement for supplied probabilities'});
  const matrixFields=h('div',{class:'yd-source'},event.root,zero.root,h('label',{},'Source kind',sourceKind),h('label',{},'Source description',sourceDescription),h('label',{},'Conditioning statement',sourceCondition));
  const editorStatus=h('p',{id:`${tau.input.id}-csv-status`,class:'yd-status',role:'status','aria-live':'polite','aria-atomic':'true','data-prx-input-status':''}),apply=ctx.button({label:'Apply this input',key:'input:apply',primary:true,onClick:applyInput}),restore=ctx.button({label:'Restore the selected public example',key:'input:restore',onClick:()=>ctx.set({preset:ctx.state.example==='local'?lastPublicPreset:ctx.state.example})});
  text.setAttribute('aria-describedby',editorStatus.id);apply.root.setAttribute('aria-describedby',editorStatus.id);
  const editor=ctx.disclosure({name:'input',title:'Your data (CSV or TSV)',placement:'none',className:'yd-editor',open:ctx.width()>768});
  editor.body.append(format.root,h('p',{class:'yd-note'},'Use ',name(ctx,'id'),'; then one ',name(ctx,'<criterion>_mean'),' / ',name(ctx,'<criterion>_sd'),' pair per criterion. Estimates use ',name(ctx,'_estimate'),' / ',name(ctx,'_se'),'. Square matrices start with ',name(ctx,'criterion,<name>'),', then matching row and column IDs; leave the diagonal empty.'),text,priorFields,matrixFields,h('div',{class:'yd-actions'},apply.root,restore.root),editorStatus);
  const heading=ctx.panelTitle('Applied report');
  heading.tabIndex=-1;heading.dataset.prxFocusKey='result:applied';
  const card=h('div'),posteriorDetails=h('details'),cardNote=h('p',{class:'yd-note'}),result=h('div',{class:'yd-result-copy','data-prx-result':''});
  const lastValid=h('p',{class:'yd-note','data-prx-last-valid':'',hidden:true});
  function showLastValid(m,show){
   lastValid.hidden=!m||!show;
   if(lastValid.hidden)return;
   const s=m.settings;
   lastValid.replaceChildren('Last valid analysis · τ ',num(ctx,s.tau,formatSetting),
    ' · ',s.cap==='all'||s.cap===null||!Number.isFinite(Number(s.cap))?'no grade cap':h('span',{},'cap ',num(ctx,Number(s.cap),formatCount)),
    ' · error weights ',...s.weights.flatMap((w,k)=>[k?' / ':'',num(ctx,w,formatSetting)]),'.');
  }
  const exact=ctx.disclosure({name:'applied-grade',title:'Grade vector and exact result',placement:'none'});
  const output=ctx.primaryGraphic(h('section',{class:'yd-output'},heading,result,lastValid,card,cardNote,exact.root,posteriorDetails));
  const settings=h('div',{class:'yd-settings'},editor.root);
  const primary=h('div',{class:'yd-primary'},output,settings);ctx.charts.append(primary);
  const stacked=ctx.win.matchMedia?.('(max-width:48rem)');
  const orderSections=()=>{
   const first=stacked?.matches?output:settings;
   if(primary.firstElementChild!==first)ctx.keepFocus(()=>primary.prepend(first));
  };
  if(stacked){ctx.listen(stacked,'change',orderSections);orderSections();}
  // Capture runs before the shared point tooltip is placed; retain the full long card and native focus.
  ctx.listen(card,'focus',event=>{if(event.target.matches?.('.prx-kbd-point'))event.target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});},true);
  const targetRows=[],weights=[] ,directions=[];
  for(let k=0;k<3;k++){
   const weight=ctx.numberInput({label:'Error weight',name:`weight${k+1}`,step:.01,value:k?0:1,onInput:v=>{const a=(ctx.state.weights??[]).slice();a[k]=v;ctx.set({weights:a,producer:'automatic',reportIndex:0})}});
   const direction=ctx.select({label:'Priority direction',name:`orient${k+1}`,options:[{value:1,label:'Larger is higher priority'},{value:-1,label:'Smaller is higher priority'}],value:1,onChange:v=>{const a=ctx.state.orient.slice();a[k]=v;ctx.set({orient:a,producer:'automatic',reportIndex:0})}});
   const title=h('strong'),error=h('p',{id:`${weight.input.id}-error`,class:'yd-note',hidden:true});
   const row=h('div',{class:'yd-criterion'},title,h('div',{class:'yd-fields'},weight.root,direction.root),error);
   targetRows.push({root:row,title,error});weights.push(weight);directions.push(direction);
  }
  const tauError=h('p',{id:`${tau.input.id}-error`,class:'yd-note',hidden:true});
  const priorError=h('p',{id:`${priorSd.input.id}-error`,class:'yd-note',hidden:true});
  tau.root.append(tauError);priorFields.append(priorError);
  for(const control of [tau,priorMean,priorSd,...weights])control.input.setAttribute('aria-describedby',editorStatus.id);
  tau.input.setAttribute('aria-errormessage',tauError.id);
  priorSd.input.setAttribute('aria-errormessage',priorError.id);
  weights.forEach((weight,k)=>weight.input.setAttribute('aria-errormessage',targetRows[k].error.id));
  function fieldError(control,message,text){
   control.input.setAttribute('aria-invalid',String(Boolean(text)));
   message.textContent=text;message.hidden=!text;
  }
  const balance=ctx.slider({label:'Weight on the first of two criteria',name:'weight-balance',min:0,max:1,step:.01,value:.5,onInput:first=>ctx.set({weights:[first,1-first],producer:'automatic',reportIndex:0})});
  balance.input.setAttribute('aria-describedby',editorStatus.id);
  const criterionOptions=[],criterion=ctx.select({label:'Criterion shown in the card and probability matrix',name:'criterion',options:criterionOptions,onChange:v=>ctx.set({criterion:v})});
  const tieOptions=[],tie=ctx.select({label:'Displayed best report',name:'reportIndex',options:tieOptions,onChange:v=>ctx.set({reportIndex:v,producer:'automatic'})});
  const targets=ctx.disclosure({name:'targets',title:'Targets and error weights',placement:'none'});
  const policy=targets.root;settings.append(policy);
  targets.body.append(h('p',{class:'yd-note'},'Weights must be nonnegative and sum to ',ctx.num(1,formatCount(1)),'. A weight of ',ctx.num(0,formatCount(0)),' removes that criterion from the additive loss. For a supplied matrix, the smaller-is-higher choice reverses the declared priority direction.'),balance.root,...targetRows.map(r=>r.root),criterion.root);
  output.insertBefore(tie.root,card);
  const profile=h('section',{class:'yd-section'});
  const probability=matrixView(ctx,{label:'Every supplied or computed direction probability',generic:{alt:'Every ordered-pair probability that the row has higher priority than the column, under the declared input. No joint law or marginal distribution is inferred from a supplied probability matrix.',orderNote:'Rows and columns follow the weighted expected-rank order of the applied input.',tableCaption:'Every applied direction probability: row has higher priority than column; diagonal unused.',probabilityOpen:d=>d.normal}});
  const errorDetails=h('details');
  const probabilitySection=h('section',{class:'yd-section'},ctx.panelTitle('Direction probabilities'),probability.root);
  const relationSlot=h('div'),relationLegend=h('div'),relationBox=ctx.scrollRegion(h('div',{class:'yd-matrix-shell'},relationSlot),'Every pair stated or withheld by the applied report');
  const relationSection=h('section',{class:'yd-section'},ctx.panelTitle('What this report states'),relationBox,relationLegend);
  const allReports=h('section',{class:'yd-section'}),preflight=h('section',{class:'yd-section'});
  const solverStatus=h('div'),limit=ctx.numberInput({label:'Solver time limit (seconds)',name:'timeLimit',min:.1,max:3,step:.1,value:1,onInput:v=>ctx.set({timeLimit:v})});
  const solver=createBrowserSolveController(ctx,{getProblem(){if(painting||!model||ctx.state.cap!=='all'||analysisKey(ctx.state)!==analysisKey(model.settings))return null;return {E:model.E,options:{tau:ctx.state.tau,w:ctx.state.weights,timeLimit:ctx.state.timeLimit},key:solverKey(ctx.state)}},onResult(r,key){if(key===solverKey(ctx.state)){solverRecord={key,result:r};ctx.set({producer:'solver',reportIndex:0})}},onError(error){if(error)solverStatus.replaceChildren(h('p',{class:'yd-error',text:`The solver could not finish: ${error}. You can retry the same input.`}))},onBusy(){busy();ctx.requestRender('solver-progress')}});
  const useAutomatic=ctx.button({label:'Show the automatic report',onClick:()=>ctx.set({producer:'automatic'})});
  const solveSection=h('section',{class:'yd-section yd-solver'},ctx.panelTitle('Optional unrestricted joint search'),h('p',{class:'yd-note'},'With no grade cap, you can run a joint search in the browser. The solver reports its best grade report, a lower bound on risk, and the gap between them. The gap describes the search for the probabilities you supplied.'),limit.root,h('div',{class:'yd-actions'},solver.root,useAutomatic.root),solverStatus);
  const rCode=h('textarea',{rows:12,readOnly:true,'aria-label':'R code for exactly the applied input and report family'}),exportStatus=h('p',{class:'yd-note'});
  const exportButtons=[];
  const exportButton=(label,file,type,content)=>{const button=ctx.button({label,onClick:()=>{if(painting||!exportSnapshot)return;const url=ctx.win.URL.createObjectURL(new Blob([content()],{type})),a=h('a',{href:url,download:file});a.click();ctx.timeout(()=>ctx.win.URL.revokeObjectURL(url),0)}}).root;exportButtons.push(button);return button;};
  const exportsReady=ready=>{for(const button of exportButtons)button.disabled=!ready;};
  const exportSection=h('section',{class:'yd-section'},ctx.panelTitle('Reproduce this analysis'),h('div',{class:'yd-actions'},exportButton('Download grades CSV','postrank-grades.csv','text/csv;charset=utf-8',()=>gradesCsv(exportSnapshot,exportSnapshot.grade)),exportButton('Download error probabilities CSV','postrank-errors.csv','text/csv;charset=utf-8',()=>errorCsv(exportSnapshot)),exportButton('Download complete analysis JSON','postrank-analysis.json','application/json',()=>JSON.stringify({...exportSnapshot.provenance,input:exportSnapshot.input,settings:exportSnapshot.settings,method:exportSnapshot.method,grade:exportSnapshot.grade,evaluation:exportSnapshot.evaluation,solver:exportSnapshot.solver??null},(_,v)=>typeof v==='bigint'?String(v):v,2)),exportButton('Download R code','postrank-analysis.R','text/plain;charset=utf-8',()=>rCode.value)),exportStatus,rCode,h('p',{class:'yd-note'},'The URL saves the settings. To repeat an analysis with your own data after reloading, paste the records again.'));
  const tabList=h('div',{class:'yd-tab-list',role:'tablist','aria-label':'Inspect the applied report'});
  const inspection=h('section',{class:'yd-tabs'},ctx.panelTitle('Inspect'),tabList);
  const tabs=[
   {label:'Pairs',body:h('div',{},h('div',{class:'yd-pair-panels'},probabilitySection,relationSection),errorDetails)},
   {label:'By criterion',body:profile},
   {label:'Search scope & ties',body:h('div',{},preflight,allReports,solveSection)},
   {label:'Reproduce in R',body:exportSection},
  ];
  let activeTab=0;
  tabs.forEach((tab,i)=>{
   const id=`${tau.input.id}-inspect-${i}`;
   tab.button=h('button',{id:`${id}-tab`,type:'button',class:'prx-btn',role:'tab','aria-controls':id,text:tab.label});
   tab.panel=h('div',{id,class:'yd-tab-panel',role:'tabpanel','aria-labelledby':tab.button.id,tabindex:0},tab.body);
   tabList.append(tab.button);inspection.append(tab.panel);
   ctx.listen(tab.button,'click',()=>selectTab(i));
   ctx.listen(tab.button,'keydown',event=>{
    const next={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
    if(!Number.isInteger(next))return;
    event.preventDefault();selectTab(next);tabs[next].button.focus();
   });
  });
  function selectTab(index){
   activeTab=index;
   tabs.forEach((tab,i)=>{
    const selected=i===activeTab;tab.button.tabIndex=selected?0:-1;
    tab.button.setAttribute('aria-selected',String(selected));tab.panel.hidden=!selected;
   });
  }
  selectTab(0);ctx.charts.append(inspection);
  ctx.caption.replaceChildren('Learning use: the browser evaluates the input as declared. An analysis for external reporting runs in R with the same input, settings and family.');
  ctx.listen(text,'input',()=>{invalidDraft=true;focusAfterApply=null;editorStatus.className='yd-status';editorStatus.textContent='Draft changed. Apply it to replace the report; the current report still uses the last applied input.';showLastValid(model,true);});
  for(const field of[sourceKind,sourceDescription,sourceCondition])ctx.listen(field,'input',()=>{invalidDraft=true;focusAfterApply=null;editorStatus.textContent='Source declaration changed; apply it with the input.';showLastValid(model,true);});
  ctx.listen(probability.slot,'pointermove',ev=>probability.overlays(null,probability.cellAt(ev)));ctx.listen(probability.slot,'pointerleave',()=>probability.overlays(null,null));
  ctx.onPrimary(applyInput);
  ctx.listen(text,'keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();applyInput()}});
  resetPublic=()=>{forcePublic=true};finishPublicReset=()=>{if(forcePublic)ctx.requestRender('public-preset-reset')};
  ctx.onCleanup(()=>{closed=true;stopPaint();memo.clear();exportSnapshot=null;ctx.root.removeAttribute('aria-busy')});
  const analysisKey=s=>JSON.stringify([revision,s.tau,s.cap,s.weights,s.orient,s.prior,s.priorMean,s.priorSd]);
  const solverKey=s=>`${analysisKey(s)}|${s.timeLimit}`;
  function loadPublic(state){
   const preset=YOUR_DATA_PRESETS.find(p=>p.id===state.example);if(!preset)return;
   lastPublicPreset=preset.id;
   let candidate=publicYourDataInput(preset.example,preset.format);
   if(candidate.format==='probabilities'&&state.matrixEvent==='higher_priority'){candidate.probabilities=candidate.probabilities.map(m=>m.map(row=>row.map(p=>1-p)));candidate.event='higher_priority'}
   text.value=inputCsv(candidate);sourceKind.value=candidate.source?.kind??'analytic_reference';sourceDescription.value=candidate.source?.description??'Analytic comparisons from declared independent Normal posterior summaries.';sourceCondition.value=candidate.source?.conditioning??'The entered model and conditioning information are fixed.';
   const parsed=parseUserInput(text.value,{format:state.format,matrixEvent:state.matrixEvent,zeroTies:state.zeroTies,margin:0,source:{kind:sourceKind.value,description:sourceDescription.value,conditioning:sourceCondition.value}});
   applied=parsed.data;appliedIsLocal=false;lastGood=null;model=null;
   publicProvenance=publicYourDataProvenance(preset.example);focusAfterApply=null;
   selectTab(preset.id==='equal5'?2:0);targets.open=(applied?.criteria.length??0)>1;
   loadedExample=state.example;loadedEvent=state.matrixEvent;revision++;memo.clear();solverRecord=null;solverStatus.replaceChildren();solver.invalidate();invalidDraft=false;forcePublic=false;editorStatus.className='yd-status';editorStatus.textContent=parsed.ok?'Public example loaded. Editing the CSV stays local until you apply it.':parsed.messages.join(' ');if(!parsed.ok){editorStatus.className='yd-status yd-error';text.setAttribute('aria-invalid','true');}else text.removeAttribute('aria-invalid');
  }
  function applyInput(){
   const state=ctx.state,parsed=parseUserInput(text.value,{format:state.format,matrixEvent:state.matrixEvent,zeroTies:state.zeroTies,margin:0,source:{kind:sourceKind.value,description:sourceDescription.value,conditioning:sourceCondition.value}});
   const reject=messages=>{invalidDraft=true;focusAfterApply=null;editorStatus.className='yd-status yd-error';editorStatus.replaceChildren(...messages.flatMap((message,i)=>i?[h('br'),message]:[message]));text.setAttribute('aria-invalid','true');showLastValid(model,true);};
   if(!parsed.ok){reject(parsed.messages);return;}
   const K=parsed.data.criteria.length,next={...state,example:'local',producer:'automatic',reportIndex:0,criterion:0,tau:tau.get()};
   if(!Number.isFinite(next.tau)){reject(['Withholding cost τ is missing or is not a finite number.']);return;}
   if(state.format==='estimates'&&state.prior==='normal'){
    next.priorMean=priorMean.get();next.priorSd=priorSd.get();if(!Number.isFinite(next.priorMean)||!Number.isFinite(next.priorSd)){reject(['The Normal prior needs a finite mean and a positive finite SD.']);return;}
   }
   next.weights=state.weights.length===K?weights.slice(0,K).map(control=>control.get()):Array.from({length:K},()=>1/K);
   next.orient=state.orient.length===K?directions.slice(0,K).map(control=>control.get()):Array.from({length:K},()=>1);
   let candidate;try{candidate=analyzeYourData(parsed.data,next);}catch(error){reject([String(error.message??error)]);return;}
   applied=parsed.data;appliedIsLocal=true;publicProvenance=null;revision++;focusAfterApply=revision;targets.open=K>1;memo.clear();memo.set(analysisKey(next),candidate);solverRecord=null;solverStatus.replaceChildren();solver.invalidate();invalidDraft=false;text.removeAttribute('aria-invalid');editorStatus.className='yd-status';editorStatus.textContent='Applied locally. The input is not saved in the URL or browser storage.';
   ctx.set(next);ctx.requestRender('apply-local-input');
  }
  function displayedGrade(s){if(s.producer==='solver'&&solverRecord?.key===solverKey(s)&&solverRecord.result.grade)return solverRecord.result.grade;const choices=model?reportChoices(model.optimum):[];return choices[Math.min(s.reportIndex,choices.length-1)]??model?.optimum.grade;}
  function render(state,info={}){
   if(closed)return;
   stopPaint();exportsReady(false);
   if(state.example==='local'&&!appliedIsLocal&&info.changed?.includes('example')){applied=null;model=null;lastGood=null;exportSnapshot=null;publicProvenance=null;focusAfterApply=null}
   const publicReset=state.example!=='local'&&(forcePublic||appliedIsLocal||loadedExample!==state.example||loadedEvent!==state.matrixEvent);if(publicReset)loadPublic(state);
   format.set(state.format);prior.set(state.prior);syncNumber(priorMean,state.priorMean,publicReset);syncNumber(priorSd,state.priorSd,publicReset);event.set(state.matrixEvent);zero.set(state.zeroTies);syncNumber(tau,state.tau,publicReset);tauSlider.set(state.tau);cap.set(state.cap);syncNumber(limit,state.timeLimit,publicReset);
   fieldError(tau,tauError,state.tau>0&&state.tau<=.5?'':'Enter a cost above zero and at most one half.');
   fieldError(priorSd,priorError,state.format==='estimates'&&state.prior==='normal'&&!(state.priorSd>0)?'Enter a positive prior SD.':'');
   priorFields.hidden=state.format!=='estimates';priorMean.root.hidden=priorSd.root.hidden=state.prior==='flat';matrixFields.hidden=state.format!=='probabilities';
   const scientificSections=[policy,inspection,tie.root];
   scientificSections.forEach(node=>{node.hidden=!applied});
   if(!applied){model=null;showLastValid(null,false);exact.root.hidden=true;const message=state.example==='local'?'Pasted input was not stored. Paste it again, then apply it; this link contains settings only.':'This draft does not pass the declared input checks. Correct it, then apply it.';result.replaceChildren(h('p',{class:'yd-note',text:message}));card.replaceChildren();cardNote.replaceChildren();ctx.readout.set([message]);solver.refresh({available:false});busy();return;}
   const K=applied.criteria.length;
   exact.root.hidden=false;balance.root.hidden=K!==2;
   if(K===2)balance.set(state.weights[0]);
   const validWeights=state.weights.length===K&&state.weights.every(w=>w>=0)&&Math.abs(state.weights.reduce((sum,w)=>sum+w,0)-1)<=1e-12;
   targetRows.forEach((row,k)=>{
    row.root.hidden=k>=K;
    if(k<K){
     row.title.replaceChildren(name(ctx,applied.criteria[k]));
     weights[k].input.setAttribute('aria-label',`Error weight for ${applied.criteria[k]}`);
     directions[k].input.setAttribute('aria-label',`Priority direction for ${applied.criteria[k]}`);
     syncNumber(weights[k],state.weights[k],publicReset);directions[k].set(state.orient[k]);
     fieldError(weights[k],row.error,validWeights?'':'Use nonnegative weights that sum to one.');
    }
   });
   let validCurrent=true,k,g,ev,opt,usingSolver,order;
   const stages=[()=>{
   try{
    const key=analysisKey(state);if(!memo.has(key)){if(memo.size>=4)memo.delete(memo.keys().next().value);memo.set(key,analyzeYourData(applied,state))}model=memo.get(key);lastGood=model;if(!invalidDraft&&editorStatus.classList.contains('yd-error')){editorStatus.className='yd-status';editorStatus.textContent='Current settings applied to the last valid input.';}
   }catch(error){validCurrent=false;model=lastGood;editorStatus.className='yd-status yd-error';editorStatus.textContent=String(error.message??error)+' The current report retains the last valid analysis.';if(!model){stopPaint();busy();return;}}
   k=Math.min(state.criterion,K-1);g=displayedGrade(state);ev=evaluateReport(g,model.E,{tau:model.settings.tau,w:model.settings.weights});opt=model.optimum;usingSolver=state.producer==='solver'&&solverRecord?.key===solverKey(state)&&solverRecord.result.grade;
   },()=>{
   const tag=usingSolver?labelNode(ctx,solverRecord.result):tagNode(ctx,opt,{orderWords:'weighted expected-rank order'});
   if(!usingSolver&&opt.tieCount>1)tag.append(tieNode(ctx,opt,{showing:''}));
   result.replaceChildren(tag);
   showLastValid(model,invalidDraft||!validCurrent);
   const exactGrade=num(ctx,g,formatGrades,'readout-grade');exactGrade.hidden=true;
   exact.body.replaceChildren(h('p',{},'Grade vector: ',num(ctx,g,formatGrades,'grade'),'. ',name(ctx,blocksText(g,model.E.ids))),
    h('p',{},'Stated pairs ',num(ctx,ev.N,formatCount,'N'),' of ',num(ctx,ev.M,formatCount,'M'),'; weighted risk ',num(ctx,ev.risk,formatRisk,'risk'),'.'),exactGrade);
   },()=>{
   card.replaceChildren();posteriorDetails.replaceChildren();posteriorDetails.hidden=!model.posterior;
   if(model.posterior){
    const p=model.posterior,cardData={ids:model.E.ids,names:model.E.ids,mean:p.mean.map(row=>row[k]),sd:p.sd.map(row=>row[k]),lower:p.lower.map(row=>row[k]),upper:p.upper.map(row=>row[k]),level:.9,expectedRank:model.expectedRank,storedOrder:'input',axis:`${model.E.criteria[k]} (posterior)`,grade1:'Grade 1 is highest in the common report under the declared directions and error weights.',title:'Applied posterior and grade report',digits:3};
    cardRows(cardData,g,'grade');drawReportCard(card,cardData,{grade:g,order:'grade',reveal:0,rankLabel:K>1?'Average of criterion ranks':'Expected rank',keyboardLabel:'Every applied unit and its posterior interval'});
    for(const label of card.querySelectorAll('svg text:not([data-num])'))if(model.E.ids.includes(label.textContent)||label.textContent===cardData.axis)label.setAttribute('data-prx-name','');
    for(const row of card.querySelectorAll('table tbody tr'))row.cells[0]?.setAttribute('data-prx-name','');
    posteriorDetails.append(h('summary',{text:'Inspect the posterior summaries used'}),ctx.scrollRegion(h('div',{class:'yd-scroll'},table(ctx,'Applied marginal summaries before target orientation',['Unit','Mean','SD','Lower','Upper','Weighted expected rank'],model.E.ids.map((id,i)=>[name(ctx,id),...['mean','sd','lower','upper'].map(field=>num(ctx,p[field][i][k],v=>formatDecimal(v,{digits:3}),`posterior-${field}-${i}`)),num(ctx,model.expectedRank[i],v=>formatDecimal(v,{digits:3}),`rank-${i}`)]))),'Every applied marginal summary'));
    cardNote.replaceChildren(name(ctx,model.E.criteria[k]),': units are treated as independent given the declared Normal model; correlated units need joint draws or a joint law in R. Dots are means and lines are central ',ctx.num(.9,formatPercent(.9)),' intervals. ',K>1?'The rank column averages each criterion’s own expected rank using the displayed error weights; it is a common ordering, not a composite-score rank.':'Expected rank uses this criterion.');
   }else{cardNote.textContent='Supplied probabilities do not provide marginal means or intervals. This roster shows grades without inventing a posterior card. Range, diagonal and reverse-sum validation is not a check of joint-law realizability, model calibration or numerical accuracy; no sampling MCSE is inferred.';card.append(ctx.scrollRegion(h('div',{class:'yd-scroll'},table(ctx,'Applied grade roster',['Unit','Grade'],model.E.ids.map((id,i)=>[name(ctx,id),num(ctx,g[i],formatCount,`unit-grade-${i}`)]))),'Every supplied unit and its grade'));}
   },()=>{
   if(criterionOptions.length!==K||criterionOptions.some((o,i)=>o.label!==model.E.criteria[i]))setOptions(ctx,criterion,criterionOptions,model.E.criteria.map((label,i)=>({value:i,label})));criterion.set(k);
   const choices=reportChoices(opt);if(state.reportIndex>=choices.length)ctx.set({reportIndex:choices.length-1});if(state.criterion!==k)ctx.set({criterion:k});if(tieOptions.length!==choices.length)setOptions(ctx,tie,tieOptions,choices.map((_,i)=>({value:i,label:i===0?'Representative best report':`Best report ${i+1}`})));tie.set(Math.min(state.reportIndex,choices.length-1));tie.root.hidden=usingSolver||choices.length<=1;
   profile.replaceChildren(ctx.panelTitle('Risk and wrong-direction shares by criterion'),ctx.scrollRegion(h('div',{class:'yd-scroll'},table(ctx,'The same displayed report, evaluated on every criterion',['Criterion','Weight','Expected wrong directions','Wrong among stated E/N','Wrong among all E/M','Risk at τ'],model.E.criteria.map((c,i)=>[name(ctx,c),num(ctx,model.settings.weights[i],formatSetting,`weight-${i}`),num(ctx,ev.E[i],formatExpectedCount,`E-${i}`),num(ctx,ev.EoverN[i],formatShare,`EoverN-${i}`),num(ctx,ev.EoverM[i],formatShare,`EoverM-${i}`),num(ctx,ev.Rk[i],formatRisk,`Rk-${i}`)]))),'Complete criterion risk profile'),h('p',{class:'yd-note'},'E/N is NA when no pair is stated. A shared grade withholds a direction; it does not assert equality. Units not assessed belong outside the input, rather than in a bottom grade.'));
   },()=>{
   order=scoreOrder(model.expectedRank,{direction:'ascending',ids:model.E.ids}).order;
   const d={data:'applied input',n:model.E.ids.length,ids:model.E.ids,pi:model.E.e[k].map(row=>row.map(p=>1-p)),normal:model.posterior!==null};const avail=probabilitySection.clientWidth||(ctx.win.innerWidth>=784?Math.floor((ctx.width()-32)/2):ctx.width());
   probability.draw({sort:'input'},d,order,{avail,inPlace:true});probability.note({},d);
   },()=>{
   errorDetails.replaceChildren(h('summary',{text:'Inspect the applied directional errors'}),ctx.scrollRegion(h('div',{class:'yd-scroll'},table(ctx,'Applied directional errors: chance that stating the row above the column is wrong',['Row unit',...model.E.ids.map(id=>name(ctx,id))],model.E.ids.map((id,i)=>[name(ctx,id),...model.E.ids.map((_,j)=>i===j?'—':num(ctx,model.E.e[k][i][j],p=>formatProb(p,{open:Boolean(model.posterior)}),`e-${i}-${j}`))]))),'Every applied directional error'));
   },()=>{
   const ids=order.map(i=>model.E.ids[i]),orderedGrade=order.map(i=>g[i]);
   drawRelationMatrix(ctx,relationSlot,relationLegend,{n:ids.length,ids,g:orderedGrade,unit:'unit',units:'units'},{rel:relations(orderedGrade),large:ids.length>12});
   // Match both plotted axes while preserving the exact original unordered-pair labels in the reader's table.
   const rows=relationSlot.querySelectorAll('table tbody tr');
   let at=0;
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const firstCell=rows[at++].cells[0];
    if(order[i]>order[j])firstCell.textContent=`${ids[j]} and ${ids[i]}`;
   }
   },()=>{
   allReports.replaceChildren(ctx.panelTitle('Retained best reports'),h('p',{},num(ctx,opt.tieCount,formatCount,'tie-count'),opt.tieCount===1?' report attains the minimum within tolerance ':' reports share the minimum within tolerance ',num(ctx,opt.tieTol,formatSci,'tie-tol'),'. Returned ',num(ctx,opt.grades.length,formatCount,'retained-count'),' reports; ',opt.tieCount>opt.grades.length?'the list is truncated, while the total count remains complete.':'the complete minimizing set is listed.'),ctx.scrollRegion(h('div',{class:'yd-scroll'},table(ctx,'Every returned tied report',['Retained report','Grade vector'],opt.grades.map((grade,i)=>[num(ctx,i+1,formatCount),num(ctx,grade,formatGrades,`tie-${i}`)]))),'Every retained minimizing report'));
   },()=>{
   preflight.dataset.prxMethod=model.method;
   preflight.replaceChildren(ctx.panelTitle('What was searched'),h('p',{},model.preflight.nAllowed?'Unit-count limit is met. ':'Unit-count limit is exceeded. ',model.preflight.countAllowed?'Report-count limit is met.':'Report-count limit is exceeded.'),h('p',{},'Requested family: ',num(ctx,model.preflight.familySize,formatCount,'requested-family-size'),' reports. Enumeration requires at most ',ctx.num(ENUMERATION_BUDGET.maxUnits,formatCount),' units and ',ctx.num(ENUMERATION_BUDGET.maxReports,formatCount),' reports; both limits are checked.'),h('p',{},model.method==='enumeration'?'This family was enumerated completely.':'The requested family exceeds an enumeration limit. Dynamic programming instead searches cuts of the weighted expected-rank order; the order is recomputed when the weights change. ',model.method==='enumeration'?null:h('span',{},'Its family has ',num(ctx,opt.family.size,formatCount,'order-family-size'),' reports; this is not a global optimum over the requested family.')));
   solver.refresh({available:validCurrent&&state.cap==='all'&&!invalidDraft,hasResult:Boolean(solverRecord)});
   if(solverRecord?.key===solverKey(state)){const r=solverRecord.result;solverStatus.replaceChildren(h('p',{},'Status: ',h('span',{'data-prx-solver-status':'',text:r.status}),'; upper risk ',num(ctx,r.upper,formatRisk,'solver-upper'),'; lower risk ',num(ctx,r.lower,formatRisk,'solver-lower'),'; absolute gap ',num(ctx,r.gap,formatRisk,'solver-gap'),'.'));exposeResult(ctx,r,'solver')}
   const snapshot={...model,provenance:publicProvenance,method:usingSolver?'unrestricted-solver':model.method,settings:{...model.settings,timeLimit:state.timeLimit,criterion:k,reportIndex:Math.min(state.reportIndex,reportChoices(opt).length-1),producer:usingSolver?'solver':'automatic'},grade:g,evaluation:ev,solver:usingSolver?solverRecord.result:null};
   if(solverRecord&&solverRecord.key!==solverKey(state))solverStatus.replaceChildren(h('p',{class:'yd-note',text:'These solve settings changed. Press the button to run the unrestricted solver again.'}));
   const code=yourDataR(snapshot,g);exportSnapshot=snapshot;rCode.value=code;exportStatus.textContent='The files contain the inputs and settings you applied. Your browser creates them on this device.';
   ctx.readout.set([state.example==='local'?'Applied browser-local input: ':'Public example: ',num(ctx,model.E.ids.length,formatCount,'units'),' units, ',num(ctx,model.E.criteria.length,formatCount,'criteria'),K===1?' criterion. ':' criteria. ',usingSolver?'Solver incumbent. ':'',num(ctx,ev.N,formatCount),' of ',num(ctx,ev.M,formatCount),' pairs stated; weighted risk ',num(ctx,ev.risk,formatRisk),'.',...(!usingSolver&&opt.tieCount>1?[' ',num(ctx,opt.tieCount,formatCount),' equal-risk best reports; ',num(ctx,opt.grades.length,formatCount),' retained.']:[]),...(ev.N===0?[' E/N is NA.']:[]),...(solver.running?[' The unrestricted solver is still running; the displayed report remains the current feasible report.']:[])]);
   }];
   // A new render cancels every remaining turn before it can publish obsolete results or exports.
   const key=solverKey(state);if(activeSolverKey!==key){activeSolverKey=key;solver.invalidate();}
   painting=true;busy();solver.refresh({available:false});
   ctx.readout.set(['Updating the complete applied analysis…']);
   exportStatus.textContent='Updating the applied analysis; downloads will be ready when every view is complete.';
   const epoch=generation;let stage=0;
   const next=()=>{
    if(closed||epoch!==generation)return;
    ctx.keepFocus(()=>stages[stage++]());
    if(closed||epoch!==generation)return;
    if(stage<stages.length)cancelNext=ctx.timeout(next,20);
    else{
     cancelNext=null;painting=false;exportsReady(Boolean(exportSnapshot));busy();
     if(focusAfterApply===revision&&!invalidDraft&&validCurrent){focusAfterApply=null;heading.focus();}
    }
   };
   cancelNext=ctx.timeout(next,20);
  }
  return {render};
 }});
 const update=handle.update.bind(handle),preset=handle.applyPreset.bind(handle);
 handle.applyPreset=p=>{if(typeof p==='string'&&!YOUR_DATA_PRESETS.some(x=>x.id===p))return handle;resetPublic();preset(p);finishPublicReset();return handle};
 handle.update=partial=>{if(partial&&Object.prototype.hasOwnProperty.call(partial,'preset')&&YOUR_DATA_PRESETS.some(x=>x.id===partial.preset))resetPublic();update(partial);finishPublicReset();return handle};
 return handle;
}

const publicCsv=model=>model.provenance?[['# source',model.provenance.source],['# license',model.provenance.licence]]:[];
export function errorCsv(model){return csvText([...publicCsv(model),['# event','Cells are Pr(row unit <= column unit) on the oriented criterion.']])+model.E.criteria.map((c,k)=>csvText([['criterion',c],['id',...model.E.ids],...model.E.ids.map((id,i)=>[id,...model.E.e[k][i]])])).join('\r\n');}
export function gradesCsv(model,g){return csvText([...publicCsv(model),['id','grade','tau','weights','requested_cap','method'],...model.E.ids.map((id,i)=>[id,g[i],model.settings.tau,model.settings.weights.join(';'),model.settings.cap,model.method])]);}
