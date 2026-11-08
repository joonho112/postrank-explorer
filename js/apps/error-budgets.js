// Ordinary budget parsing is separate from the reusable signed feasibility view.
import {createWidget} from '../shared/base.js';
import {gradeColors,hiddenTable,labelOn,numText,palette,plot} from '../shared/chart.js';
import {blocksText,formatCount,formatExpectedCount,formatGrades,formatRisk,formatSetting,formatShare,formatSci} from '../shared/format.js';
import {familyNameNode,tagNode} from '../shared/labels.js';
import {budgetCheck,budgetFamily,enumerateReports,evaluateReport,exactOptimum,largestStatedError} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';

export const CONFIG=Object.freeze({name:'error-budgets',pageSize:12,cloud:{height:310,domain:[0,1],ticks:[0,.02,.1,.25,.5,1]}});
/** Ordinary q only. Preserve raw boundaries; signed derived thresholds bypass this parser. */
export function parseBudgetQ(value){
 if(value===null||typeof value==='string'&&['none','off','no',''].includes(value.trim().toLowerCase()))return null;
 const q=typeof value==='number'?value:typeof value==='string'?Number(value):NaN;
 return Number.isFinite(q)&&q>=0&&q<=1?q:undefined;
}
export function budgetFamilyFor(state){return state.cap==='exact3'?{kind:'exactly',G:3}:state.cap==='all'?{kind:'all'}:{kind:'atMost',G:Number(state.cap)};}
const gradeKey=g=>Array.from(g).join('/'),profilesCache=new WeakMap(),freeCache=new WeakMap();
function baseProfiles(data,family){
 let cache=profilesCache.get(data.E);if(!cache){cache=new Map();profilesCache.set(data.E,cache);}
 const key=JSON.stringify(family);
 if(!cache.has(key))cache.set(key,Array.from(enumerateReports(data.n,family),grade=>{
  const ev=evaluateReport(grade,data.E,{tau:.2,w:[.5,.5]});
  return {key:gradeKey(grade),grade:Array.from(grade),N:ev.N,ea:ev.EoverN[0],eb:ev.EoverN[1]};
 }));return cache.get(key);
}
/** Exact family model. All scientific values and row statuses come from public engine calls. */
export function budgetModel(state,{data=criteriaData('six')}={}){
 const family=budgetFamilyFor(state),w=[state.w,1-state.w],q=[state.qa,state.qb];
 let cache=freeCache.get(data.E);if(!cache){cache=new Map();freeCache.set(data.E,cache);}
 const key=JSON.stringify([family,state.tau,w]);
 if(!cache.has(key)){if(cache.size>32)cache.clear();cache.set(key,exactOptimum(data.E,{tau:state.tau,w,family}));}
 const free=cache.get(key),result=budgetFamily(data.E,{tau:state.tau,w,family,q});
 const members=new Set((result.members??[]).map(gradeKey));
 const rows=baseProfiles(data,family).map(row=>({...row,meets:members.has(row.key)})),failures=[[],[]];
 for(const row of rows){if(row.meets)continue;for(const check of budgetCheck(row.grade,data.E,q).rows)if(!check.meets)failures[check.k].push({...row,...check});}
 const profiles=result.empty?[]:result.optimum.grades.map(grade=>({grade,evaluation:evaluateReport(grade,data.E,{tau:state.tau,w}),check:budgetCheck(grade,data.E,q),largest:data.criteria.map((_,k)=>largestStatedError(grade,data.E,{w:data.criteria.map((__,j)=>+(k===j))}))}));
 return {state,data,family,w,q,result,free,rows,failures,profiles,bestRow:result.empty?null:rows.find(row=>row.key===gradeKey(result.optimum.grade)),freeRow:free.empty?null:rows.find(row=>row.key===gradeKey(free.grade))};
}

export const BUDGET_CSS=`
.ebu .ebu-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:1rem;align-items:start}
.ebu .ebu-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.25rem 1rem;width:100%}
.ebu .ebu-budget-controls{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:.7rem;min-width:0}
.ebu .ebu-budget-controls .prx-control{margin:0;min-width:0}
.ebu .ebu-chips{background:var(--prx-plot-bg);padding:.25rem;border-radius:4px;display:flex;flex-wrap:wrap;align-items:center;gap:.3rem;margin:.25rem 0}
.ebu .ebu-chip{display:inline-block;padding:.2rem .5rem;border-radius:5px;font-weight:700}
.ebu .ebu-facts,.ebu .ebu-note,.ebu .ebu-ties{font-size:.88rem;margin:.4rem 0}
.ebu .ebu-facts{color:var(--prx-fg-muted)}
.ebu .ebu-table-wrap{overflow-x:auto;max-width:100%;min-width:0;margin:.5rem 0}
.ebu .ebu-table-wrap table{min-width:30rem;width:100%;border-collapse:collapse;font-size:.82rem}
.ebu .ebu-table-wrap th,.ebu .ebu-table-wrap td{padding:.35rem .45rem;text-align:left;border-bottom:1px solid var(--prx-border);white-space:nowrap}
.ebu .ebu-failures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.ebu .ebu-pager{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.ebu .ebu-swipe{margin:.8rem 0 .25rem;font-size:.8rem;color:var(--prx-fg-muted)}
.ebu .ebu-legend{background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.35rem}
.ebu .ebu-sw-in{background:var(--prx-plot-focus);border-radius:50%}
.ebu .ebu-sw-out{background:transparent;border:1px solid var(--prx-plot-muted);border-radius:50%}
.ebu .ebu-exact-budgets{display:flex;flex-wrap:wrap;gap:.5rem 1rem}
.ebu .ebu-exact-budgets input{max-width:6rem}
.ebu .ebu-sw-best{background:transparent;border:2.5px solid var(--prx-plot-fg);border-radius:50%}
.ebu .ebu-sw-free{background:transparent;border:0;position:relative}
.ebu .ebu-sw-free::before,.ebu .ebu-sw-free::after{content:'';position:absolute;left:45%;top:-10%;width:2.5px;height:120%;background:var(--prx-plot-fg);transform:rotate(45deg)}
.ebu .ebu-sw-free::after{transform:rotate(-45deg)}
.ebu .ebu-empty{font-weight:600;padding:.7rem;border-left:3px solid var(--prx-plot-muted)}
@media(max-width:42em){.ebu .ebu-grid,.ebu .ebu-controls,.ebu .ebu-failures{grid-template-columns:minmax(0,1fr)}}
`;
function num(ctx,value,format,key){const n=ctx.num(value,format(value));if(key)n.setAttribute('data-prx-readout',key);return n;}
function formatted(columns){return columns.map(c=>({...c,...(c.format?{format:value=>c.format(value)}:{})}));}
function table(ctx,caption,columns,rows){const n=hiddenTable(ctx.doc,{caption,columns:formatted(columns),rows,visible:true});n.classList.add('ebu-table-wrap');ctx.scrollRegion(n,caption);return n;}

/** Actual cloud renderer used by the parent; explicit model, no implicit solve or mount. */
export function createBudgetCloudView(ctx,slot,{annotateRisk=false}={}){
 const {h}=ctx,figure=h('div'),note=h('p',{class:'ebu-note'}),key=(cls,text)=>h('span',{class:'prx-key'},h('span',{class:`prx-swatch ${cls}`,'aria-hidden':'true'}),text);
 slot.append(figure,h('div',{class:'prx-legend ebu-legend','data-prx-part':'legend'},key('ebu-sw-in','meets every budget'),key('ebu-sw-out','fails a budget'),key('ebu-sw-best','best of those'),key('ebu-sw-free','best with no budget')),note);
 return {render(model){
  const {rows,q,data,freeRow,bestRow}=model,dots=rows.filter(row=>row.N>0),C=CONFIG.cloud;
  const title=row=>`${blocksText(row.grade,data.ids)}: ${formatCount(row.N)} pairs stated; wrong share ${formatShare(row.ea)} on score A and ${formatShare(row.eb)} on score B; ${row.meets?'meets every budget':'fails a budget'}; risk ${formatRisk(evaluateReport(row.grade,data.E,{tau:model.state.tau,w:model.w}).risk)}.`;
  plot(figure,{height:C.height,marginTop:30,marginBottom:48,marginLeft:49,marginRight:18,
   alt:'Every report with stated pairs, at its expected wrong share on each score. Both axes use square-root scales. Dot size is the number of stated pairs; the budget region, best-member ring and free-best cross follow the controls.',
   x:{type:'sqrt',domain:C.domain,ticks:C.ticks,label:'wrong on score A, square-root scale →',labelOffset:35,grid:true},
   y:{type:'sqrt',domain:C.domain,ticks:C.ticks,label:'↑ wrong on score B, square-root scale',grid:true},r:{domain:[0,data.M],range:[1.5,5]},
   marks:(c,P)=>[P.rect([{x1:0,y1:0,x2:q[0]??1,y2:q[1]??1}],{x1:'x1',y1:'y1',x2:'x2',y2:'y2',fill:c.plotMuted,fillOpacity:.09}),
    q[0]===null?null:P.ruleX([q[0]],{stroke:c.crit[0],strokeDasharray:'5 3'}),q[1]===null?null:P.ruleY([q[1]],{stroke:c.crit[1],strokeDasharray:'5 3'}),
    P.dot(dots.filter(row=>!row.meets),{x:'ea',y:'eb',r:'N',fill:'none',stroke:c.plotMuted,strokeOpacity:.52,strokeWidth:.75,title}),
    P.dot(dots.filter(row=>row.meets),{x:'ea',y:'eb',r:'N',fill:c.plotFocus,stroke:c.plotBg,strokeWidth:.65,title}),
    freeRow?.N>0?P.dot([freeRow],{x:'ea',y:'eb',r:8,symbol:'times',stroke:c.plotFg,strokeWidth:2.4}):null,
    bestRow?.N>0?P.dot([bestRow],{x:'ea',y:'eb',r:10,fill:'none',stroke:c.plotFg,strokeWidth:2.5}):null,
    annotateRisk&&bestRow?.N>0?numText([bestRow],{x:'ea',y:'eb',value:()=>model.result.optimum.risk,format:formatRisk,dx:bestRow.ea>.45?-10:10,dy:-10,textAnchor:bestRow.ea>.45?'end':'start',fontWeight:700,fill:c.plotFg,stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke'}):null,
    P.tip(dots,P.pointer({x:'ea',y:'eb',title,maxRadius:20}))].filter(Boolean),
   keyboard:{data:dots,x:'ea',y:'eb',title},
   table:{caption:'All reports with stated pairs',columns:formatted([{label:'Grade vector',value:'grade',format:formatGrades},{label:'Stated pairs N',value:'N',format:formatCount},{label:'E/N on score A',value:'ea',num:true,format:formatShare},{label:'E/N on score B',value:'eb',num:true,format:formatShare},{label:'Budget status',value:row=>row.meets?'meets every budget':'fails a budget'}]),rows:dots}});
  note.replaceChildren('Larger dots state more pairs. Reports with N = ',num(ctx,0,formatCount),' are omitted from this fraction cloud; their E/N reads NA: no disclosure.');
 }};
}
/** Pure signed-safe feasibility view. Explicit engine rows {criterion,q,E,N,EoverN,slack,meets}; optional qN column.
 * No ordinary-q parsing, clipping, scientific arithmetic or membership inference happens here. */
export function createBudgetFeasibilityView(ctx,slot){return {render({rows=[],caption='Count-form feasibility: expected wrong count E ≤ qN',hookPrefix='budget'}={}){
 if(!rows.length){slot.replaceChildren(ctx.h('p',{class:'ebu-note'},'No active budget on this report.'));return;}
 const columns=[...(rows.some(row=>row.report)?[{label:'Report',value:'report',num:true,format:formatGrades}]:[]),{label:'Criterion',value:'criterion'},{label:'Expected wrong E',value:'E',format:formatExpectedCount},{label:'Stated N',value:'N',format:formatCount},{label:'Expected share E/N',value:'EoverN',num:true,format:formatShare},{label:'Threshold q',value:'q',format:formatSetting},...(rows.some(row=>row.qN!==undefined)?[{label:'qN',value:'qN',format:formatExpectedCount}]:[]),{label:'Slack qN − E',value:'slack',format:formatExpectedCount},{label:'Status',value:row=>row.meets?'meets':'fails'}];
 const t=table(ctx,caption,columns,rows);
 rows.forEach((row,i)=>{const tr=t.querySelectorAll('tbody tr')[i];tr.setAttribute('data-budget-meets',String(row.meets));columns.forEach((c,j)=>{if(typeof c.value==='string'&&c.value!=='criterion')tr.cells[j].setAttribute('data-prx-readout',`${hookPrefix}-${row.reportIndex?`${row.reportIndex}-`:""}${row.k??i}-${c.value}`);});});slot.replaceChildren(t);
}};}
/** Every retained tied optimum has a full profile and criterion-specific maximum single error. */
export function createBudgetProfileView(ctx,slot){return {render(model){
 slot.replaceChildren();for(const [index,p]of model.profiles.entries()){
  const ev=p.evaluation,heading=ctx.h('p',{class:'ebu-facts'},'Report ',num(ctx,p.grade,formatGrades,index===0?'grades':`grades-${index}`),' · risk ',num(ctx,ev.risk,formatRisk,index===0?'risk':`risk-${index}`));
  const rows=model.data.criteria.map((_,k)=>({criterion:model.data.criterionLabels[k],weight:model.w[k],E:ev.E[k],share:ev.EoverN[k],all:ev.EoverM[k],risk:ev.Rk[k],largest:p.largest[k]?.e??null,pair:p.largest[k]?`${model.data.ids[p.largest[k].i]} above ${model.data.ids[p.largest[k].j]}`:'no stated direction'}));
  const t=table(ctx,'Criterion profile of the displayed report',[{label:'Criterion',value:'criterion'},{label:'Weight',value:'weight',format:formatSetting},{label:'Expected wrong E',value:'E',format:formatExpectedCount},{label:'E/N',value:'share',num:true,format:formatShare},{label:'E/M',value:'all',format:formatShare},{label:'Criterion risk',value:'risk',format:formatRisk},{label:'Largest single error',value:'largest',num:true,format:formatShare},{label:'Direction',value:'pair'}],rows);
  rows.forEach((_,k)=>{const cells=t.querySelectorAll('tbody tr')[k].cells;['criterion','weight','E','share','EoverM','Rk','largest'].forEach((key,j)=>{if(j)cells[j].setAttribute('data-prx-readout',`${key}-${index}-${k}`);});});slot.append(heading,t);
 }
}};}
function chips(ctx,grade,ids){const pal=palette(ctx.root),colors=gradeColors(Math.max(...grade),pal),nodes=[];colors.forEach((color,k)=>{if(k)nodes.push(ctx.h('span',{'aria-hidden':'true'},'>'));nodes.push(ctx.h('span',{class:'ebu-chip',style:{background:color,color:labelOn(color,pal)}},ids.filter((_,i)=>grade[i]===k+1).join(' ')));});return ctx.h('div',{class:'ebu-chips prx-light-panel',role:'img','aria-label':`Best report: ${blocksText(grade,ids)}; grade one is highest priority`},...nodes);}

export function mountWidget(el,spec={}){return createWidget(el,spec,{name:CONFIG.name,className:'ebu',css:BUDGET_CSS,layout:'result-first',
 keys:{qa:{type:'custom',value:null,parse:parseBudgetQ},qb:{type:'custom',value:.03,parse:parseBudgetQ},w:{type:'number',min:0,max:1,step:.01,value:.5},tau:{type:'number',min:.01,max:.5,step:.01,value:.2},cap:{type:'choice',values:['2','3','all','exact3'],value:'3'},fa:{type:'integer',min:0,max:400,value:0},fb:{type:'integer',min:0,max:400,value:0}},
 build(ctx){
  const {h}=ctx,controls=h('div',{class:'ebu-controls'});
  const budgets=['qa','qb'].map((name,k)=>{
   const enabled=ctx.toggle({label:`Budget on score ${k?'B':'A'}`,name:`${name}-enabled`,onChange:yes=>ctx.set({[name]:yes ? .1 : null,fa:0,fb:0})});
   const slider=ctx.slider({label:`Maximum expected wrong share on score ${k?'B':'A'}`,name,min:0,max:1,step:.001,value:.03,format:formatSetting,onInput:value=>ctx.set({[name]:value,fa:0,fb:0})});
   slider.input.step='any';
   const exact=ctx.numberInput({label:`Exact budget for score ${k?'B':'A'}`,name:`${name}-exact`,min:0,max:1,step:'any',
    onInput:value=>ctx.set({[name]:value,fa:0,fb:0})});
   controls.append(h('div',{class:'ebu-budget-controls'},enabled.root,slider.root));return {enabled,slider,exact};
  });
  const weight=ctx.slider({label:'Error weight on score A (score B gets the remainder)',...ctx.key('w'),onInput:w=>ctx.set({w})}),tau=ctx.slider({label:'Cost τ per withheld pair',...ctx.key('tau'),onInput:tau=>ctx.set({tau})}),cap=ctx.select({label:'Allowed grade reports',name:'cap',options:[{value:'2',label:'At most two grades'},{value:'3',label:'At most three grades'},{value:'all',label:'Any number of grades'},{value:'exact3',label:'Exactly three grades'}],onChange:cap=>ctx.set({cap,fa:0,fb:0})});
  weight.input.step='any';tau.input.step='any';
  ctx.controls.append(controls);
  ctx.disclosure({name:'settings',title:'Settings',placement:'controls'}).body.append(weight.root,tau.root,cap.root,
   h('div',{class:'ebu-exact-budgets'},...budgets.map(b=>b.exact.root)));
  ctx.primaryControl(budgets[1].slider.root);
  const cloudSlot=h('div'),reportSlot=h('div'),slackSlot=h('div'),profileSlot=h('div'),familySlot=h('p',{class:'ebu-facts'}),withheldSlot=h('p',{class:'ebu-note'}),failSlots=[h('div'),h('div')];
  ctx.charts.append(h('div',{class:'ebu-grid'},h('section',{class:'prx-panel'},ctx.panelTitle('Every report: expected wrong shares'),cloudSlot),h('section',{class:'prx-panel'},ctx.panelTitle('Best report that meets the budgets'),familySlot,reportSlot,withheldSlot)),
   h('p',{class:'ebu-swipe'},'Tables scroll horizontally. Focus a table and use the arrow keys, or swipe.'),
   h('section',{class:'prx-panel'},ctx.panelTitle('Budget checks and criterion profiles'),h('p',{class:'ebu-note'},'E is the expected number of wrong stated directions on a criterion; N is the number stated; M is the number of all pairs. Grade one has highest priority on both scores; a shared grade leaves a pair unreported.'),slackSlot,profileSlot),
   h('section',{class:'prx-panel'},ctx.panelTitle('Reports failing each budget'),h('p',{class:'ebu-note'},'A report can fail both budgets. Each list is in grade-vector order.'),h('div',{class:'ebu-failures'},...failSlots)),
   h('p',{class:'ebu-note'},'A budget limits the posterior expected average over stated pairs, not each pair or the realized share. It only removes reports, so the minimum risk at the same weights, τ and base family stays the same or rises. A criterion with zero error weight can still carry a budget.'),
   h('p',{class:'ebu-note'},'Another rule, minimax, chooses the report with the smallest largest expected criterion risk. It can keep withholding where a weighted rule discloses. That is a maximum of expectations, not an expected maximum.'));
  ctx.primaryGraphic(cloudSlot);
  const cloud=createBudgetCloudView(ctx,cloudSlot,{annotateRisk:true}),feasibility=createBudgetFeasibilityView(ctx,slackSlot),profiles=createBudgetProfileView(ctx,profileSlot);
  const pagers=failSlots.map((slot,k)=>{const content=h('div'),label=h('span'),previous=ctx.button({label:'Previous reports',onClick:()=>ctx.set({[k?'fb':'fa']:Math.max(0,ctx.state[k?'fb':'fa']-1)})}),next=ctx.button({label:'Next reports',onClick:()=>ctx.set({[k?'fb':'fa']:ctx.state[k?'fb':'fa']+1})});slot.append(ctx.panelTitle(`Fails score ${k?'B':'A'}'s budget`),content,h('div',{class:'ebu-pager'},previous.root,label,next.root));return {content,label,previous,next};});
  let currentKey,model;
  return {render(state){
   budgets.forEach(({enabled,slider,exact},k)=>{const value=state[k?'qb':'qa'];enabled.set(value!==null);slider.set(value??0);slider.setDisabled(value===null);
    if(ctx.doc.activeElement!==exact.input||Number(exact.input.value)!==value)exact.set(value);exact.setDisabled(value===null);});weight.set(state.w);tau.set(state.tau);cap.set(state.cap);
   const key=JSON.stringify([state.qa,state.qb,state.w,state.tau,state.cap]);if(key!==currentKey){model=budgetModel(state);currentKey=key;cloud.render(model);}
   const {result,free,data}=model;
   familySlot.replaceChildren(num(ctx,result.size,formatCount,'size'),result.size===1?' report meets every budget, within ':' reports meet every budget, within ',num(ctx,result.baseSize,formatCount,'baseSize'),' allowed reports · ',familyNameNode(ctx,result));
   if(result.empty){reportSlot.replaceChildren(h('p',{class:'ebu-empty','data-prx-readout':'empty'},state.cap==='exact3'?'No report meets these budgets with exactly three grades.':'No report meets these budgets.'));ctx.readout.set(['The budget family is empty. There is no best feasible report.']);slackSlot.replaceChildren();profiles.render(model);}
   else{
    const opt=result.optimum;reportSlot.replaceChildren(chips(ctx,opt.grade,data.ids),h('p',{class:'ebu-facts'},num(ctx,opt.N,formatCount,'N'),' of ',num(ctx,data.M,formatCount),' pairs stated · ',tagNode(ctx,model.q.every(q=>q===null)?free:opt)));
    if(opt.tieCount>1)reportSlot.append(h('p',{class:'ebu-ties'},num(ctx,opt.tieCount,formatCount),' reports share the smallest risk; all retained profiles are shown. Equal-risk tolerance ',num(ctx,opt.tieTol,v=>formatSci(v,{trim:true})),'. Retained reports: ',num(ctx,opt.grades.length,formatCount),opt.tieCount>opt.grades.length?'. The retained list is truncated.':'.'));
    feasibility.render({rows:model.profiles.flatMap((profile,reportIndex)=>profile.check.rows.map(row=>({...row,criterion:data.criterionLabels[row.k],...(model.profiles.length>1?{report:profile.grade,reportIndex}: {})})))});profiles.render(model);
    ctx.readout.set(model.q.every(q=>q===null)?['No budget: the best report has risk ',num(ctx,free.risk,formatRisk),', but an expected ',num(ctx,free.EoverN[1],formatShare),' of its stated directions are wrong on score B.']:['The best report that meets the budgets has risk ',num(ctx,opt.risk,formatRisk),', against ',num(ctx,free.risk,formatRisk,'freeRisk'),' without a budget at these settings.']);
   }
   withheldSlot.replaceChildren(result.containsAllWithheld?'All-withheld belongs to this family and meets every count-form budget: ':'The exact grade count excludes all-withheld. Its count-form budget check would be ',num(ctx,0,formatCount),' ≤ ',num(ctx,0,formatCount),'; its expected wrong share is ',num(ctx,null,formatShare),'.');
   pagers.forEach((pager,k)=>{const failed=model.failures[k],page=state[k?'fb':'fa'],begin=page*CONFIG.pageSize;if(begin>=failed.length&&page>0)ctx.set({[k?'fb':'fa']:0});pager.content.replaceChildren(state[k?'qb':'qa']===null?h('p',{class:'ebu-note'},'No budget on this score.'):failed.length?table(ctx,`Reports failing score ${k?'B':'A'}'s budget`,[{label:'Grade vector',value:'grade',format:formatGrades},{label:'N',value:'N',format:formatCount},{label:'E/N',value:'EoverN',num:true,format:formatShare},{label:'Slack qN − E',value:'slack',format:formatExpectedCount}],failed.slice(begin,begin+CONFIG.pageSize)):h('p',{class:'ebu-note'},'Every allowed report meets this budget.'));pager.label.replaceChildren(...(failed.length?['List page ',num(ctx,page+1,formatCount)]:[]));pager.previous.setDisabled(page===0);pager.next.setDisabled(begin+CONFIG.pageSize>=failed.length);});
   ctx.caption.replaceChildren('Six fictional sites with independent normal posteriors for scores A and B. τ = ',num(ctx,state.tau,formatSetting),'; error weights ',num(ctx,model.w,v=>v.map(x=>formatSetting(x)).join(', ')),'.');
  }};
 }});}
