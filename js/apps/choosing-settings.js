// Settings change the loss or the feasible family. All results use public engine calls or fixed archives.
import {createWidget} from '../shared/base.js';
import {plot,numText} from '../shared/chart.js';
import {formatCount,formatDecimal,formatExpectedCount,formatGrades,formatRisk,formatSci,formatSetting,formatShare} from '../shared/format.js';
import {tagNode,labelNode} from '../shared/labels.js';
import {compareReports,evaluateReport,exactOptimum,tauPath} from '../pr-core.js';
import {criteriaData} from '../shared/criteria-data.js';
import {archivedThirtyPath,tutorialSensitivityArchive} from '../shared/criteria-archive.js';
import {twoScoreFamily,TWO_SCORES_CSS} from './two-scores.js';
import {WEIGHT_PATH_CSS} from './weight-path.js';
import {GUARDED_CRITERION_CSS,solveGuardedCriteria,createGuardedComparisonSlots,createGuardedComparisonView} from './worst-criterion.js';
import {CRITERIA_PROFILE_CSS,criterionProfileModel,createCriterionProfileSlots,createCriterionProfileView} from './several-criteria.js';

export const SETTINGS_GRID=Object.freeze({taus:[.2,.35],caps:[1,2,3,6],weights:[[.5,.5],[0,1],[1,0]],referenceId:'tau1-cap3-w1'});
const data=criteriaData('six'),E=data.E,pathCache=new Map();let gridCache=null;
/** Actual Cartesian product, each fixed reference evaluated under that row's own loss. */
export function settingsGridModel(){
 if(gridCache)return gridCache;
 const rows=[];
 SETTINGS_GRID.taus.forEach((tau,ti)=>SETTINGS_GRID.caps.forEach((cap,ci)=>SETTINGS_GRID.weights.forEach((w,wi)=>{
  const result=exactOptimum(E,{tau,w,family:{kind:'atMost',G:cap}});
  rows.push({id:`tau${ti+1}-cap${ci+1}-w${wi+1}`,tau,cap,w,grade:result.grade,grades:result.grades,tieCount:result.tieCount,evaluation:result.evaluation,result});
 })));
 const r=rows.find(row=>row.id===SETTINGS_GRID.referenceId),reference={id:r.id,grade:r.grade,tau:r.tau,cap:r.cap,w:r.w};
 gridCache={reference,rows:rows.map(row=>({...row,comparison:compareReports(reference.grade,row.grade,E,{tau:row.tau,w:row.w})}))};return gridCache;
}
export function settingsPathModel(state){
 const family=twoScoreFamily(state.cap),w=[state.w,1-state.w],key=JSON.stringify([family,w]);
 if(!pathCache.has(key)){
  const path=tauPath(E,{family,w}),boundaries=[...new Set(path.intervals.flatMap(iv=>[iv.tauFrom,iv.tauTo]))].filter(t=>t>0);
  pathCache.set(key,{path,boundaries:boundaries.map(tau=>({tau,result:exactOptimum(E,{family,w,tau})}))});
  if(pathCache.size>40)pathCache.delete(pathCache.keys().next().value);
 }
 const cached=pathCache.get(key),result=exactOptimum(E,{family,w,tau:state.tau});
 return {...cached,data,E,family,w,result,profiles:result.grades.map(grade=>({grade,evaluation:evaluateReport(grade,E,{tau:state.tau,w})})),caps:SETTINGS_GRID.caps.map(cap=>({cap,result:exactOptimum(E,{family:{kind:'atMost',G:cap},w,tau:state.tau})}))};
}
const CSS=`
.setg .setg-controls{display:flex;flex-wrap:wrap;gap:.6rem}.setg .setg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;min-width:0}
.setg .setg-wide{grid-column:1/-1;min-width:0}.setg section{min-width:0;margin:.7rem 0}.setg .setg-scroll{overflow-x:auto;max-width:100%;min-width:0}
.setg .setg-table{border-collapse:collapse;width:100%;font-size:.84rem}.setg .setg-table th,.setg .setg-table td{white-space:nowrap;padding:.4rem .55rem;border-bottom:1px solid var(--prx-border);text-align:left}
.setg .setg-note{font-size:.88rem;color:var(--prx-fg-muted);margin:.4rem 0}.setg .setg-paper{background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.5rem}
.setg .setg-paper .setg-note{color:var(--prx-plot-muted)}.setg .setg-source{overflow-wrap:anywhere}.setg .setg-table button{font-size:.8rem}
.setg .setg-table caption{white-space:normal;text-align:left}.setg [hidden]{display:none!important}
.setg .setg-main{align-items:start}
.setg .setg-main section{margin:0}
.setg .setg-live-controls{width:100%;align-items:start}
.setg .setg-cap-table th,.setg .setg-cap-table td{padding:.3rem .38rem;white-space:normal;overflow-wrap:normal}
.setg .setg-cap-table tr[aria-current=true]>*{background:var(--prx-bg-sunken);font-weight:700}
.setg .setg-cap-table tr[aria-current=true]>th{border-inline-start:3px solid var(--prx-accent)}
.setg .setg-cap-table td:nth-child(-n+3){white-space:nowrap}
.setg [data-prx-disclosure]{margin-top:.55rem}
@media(max-width:40em){.setg .setg-grid{grid-template-columns:minmax(0,1fr)}}`;
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'choosing-settings',className:'setg sev tws wcr wpath',css:CSS+TWO_SCORES_CSS+WEIGHT_PATH_CSS+GUARDED_CRITERION_CSS+CRITERIA_PROFILE_CSS,layout:'result-first',
 keys:{source:{type:'choice',values:['live','archive30','tutorial'],value:'live'},tau:{type:'number',min:.000001,max:.5,step:.001,value:.2},w:{type:'number',min:0,max:1,step:.01,value:.5},cap:{type:'choice',values:['1','2','3','all'],value:'3'},pair:{type:'choice',values:data.ids.flatMap(a=>data.ids.filter(b=>b!==a).map(b=>`${a},${b}`)),value:'B,C'},unit:{type:'choice',values:data.ids,value:'B'}},
 build(ctx){
  const h=ctx.h,n=(key,value,fn=formatCount)=>{const node=ctx.num(value,fn(value));node.dataset.prxReadout=key;return node;};
  const source=ctx.select({label:'Analysis route',options:[{value:'live',label:'Six sites: live settings and full grid'},{value:'archive30',label:'Thirty sites: sparse archived path'},{value:'tutorial',label:'Tutorial: archived one-at-a-time settings'}],value:'live',onChange:source=>ctx.set({source})});
  const tau=ctx.slider({label:'Withholding cost τ',...ctx.key('tau'),stepOrigin:0,name:'tau',onInput:tau=>ctx.set({tau})});
  const w=ctx.slider({label:'Error weight on score A (score B gets the remaining weight)',...ctx.key('w'),name:'w',onInput:w=>ctx.set({w})});
  const cap=ctx.segmented({label:'Maximum grades',name:'cap',options:[
   ...['One','Two','Three'].map((title,i)=>({value:String(i+1),title,label:ctx.num(i+1,formatCount(i+1))})),{value:'all',label:'No cap'}],value:'3',onChange:cap=>ctx.set({cap})});
  const pair=ctx.select({label:'Pair in the linked profiles',options:data.ids.flatMap(a=>data.ids.filter(b=>b!==a).map(b=>({value:`${a},${b}`,label:`${a} above ${b}`}))),value:'B,C',onChange:pair=>ctx.set({pair})});
  const unit=ctx.select({label:'Follow a unit',options:data.ids.map(value=>({value,label:value})),value:'B',onChange:unit=>ctx.set({unit})});
  tau.input.step='any';w.input.step='any';
  const liveControls=h('div',{class:'setg-controls setg-live-controls'},tau.root,w.root,cap.root);
  ctx.disclosure({name:'settings',title:'Settings',placement:'controls'}).body.append(source.root);
  ctx.afterPresets(liveControls);ctx.primaryControl(tau.root);
  const live=h('div'),archive=h('div'),status=h('p',{class:'setg-note',role:'status'});status.hidden=true;ctx.charts.append(status,live,archive);
  const panel=(parent,title)=>{const slot=h('div');parent.append(h('section',{},ctx.panelTitle(title),slot));return slot;};
  const box=(name,title)=>{const d=ctx.disclosure({name,title,placement:'none'});live.append(d.root);return d.body;};
  const figures=h('div',{class:'setg-grid setg-main'}),counts=h('div',{tabindex:'-1','aria-label':'Exact best-report disclosure along τ'}),shares=h('div');
  live.append(figures);ctx.primaryGraphic(counts);
  figures.append(h('section',{},ctx.panelTitle('Exact best-report disclosure along τ'),counts));
  const capTable=panel(figures,'Changing only the cap');
  const shareDetails=box('shares','Criterion error shares');
  shareDetails.append(h('section',{},ctx.panelTitle('Each criterion’s wrong share along the same path'),shares));
  const pathBody=box('path','Every exact τ interval and boundary tie'),pathTable=panel(pathBody,'Reports on every exact interval and boundary');
  const grid=panel(box('grid','All declared settings'),'Every combination of the declared settings');
  const guardedSlots=createGuardedComparisonSlots(ctx,box('guarded','Guarded comparison at these settings (full view)')),guardedView=createGuardedComparisonView(ctx,guardedSlots);
  const profiles=panel(box('profiles','Criterion profiles (full view)'),'The same supplied criterion profiles');
  profiles.append(h('div',{class:'setg-controls'},pair.root,unit.root),h('p',{class:'setg-note'},'These controls follow units and proposed directions in the supplied profiles; they keep the reporting loss and chosen reports fixed.'));
  const profileSlots=createCriterionProfileSlots(ctx,profiles),profileView=createCriterionProfileView(ctx,profileSlots,{crossingHeadroom:true});
  const method=box('method','Method and scope');
  const settingsNote=panel(method,'Explaining the settings'),tieNote=h('p',{class:'setg-note'});
  pathBody.prepend(tieNote);let focusPathAfterApply=false;
  const hint=()=>h('p',{class:'setg-note',text:'Swipe wide tables horizontally, or Tab into their region and use the arrow keys.'});
  const table=(title,headers,rows,{sticky=false,selected=-1,className=''}={})=>ctx.scrollRegion(h('div',{class:'setg-scroll'},h('table',{class:`setg-table ${sticky?'prx-sticky-first':''} ${className}`},h('caption',{text:title}),h('thead',{},h('tr',{},...headers.map(text=>h('th',{scope:'col',text})))),h('tbody',{},...rows.map((row,j)=>h('tr',{'aria-current':j===selected?'true':null},...row.map((v,i)=>h(i===0?'th':'td',i===0?{scope:'row'}:{},v))))))),title);
  const name=text=>h('span',{'data-prx-name':'',text});
  function drawPath(s,m){
   const rows=m.path.intervals.map((iv,i)=>({...iv,i,from:iv.tauFrom,to:iv.tauTo})),points=rows.flatMap(r=>[{...r,tau:r.from},{...r,tau:r.to}]);
   const currentCounts=[...new Set(m.profiles.map(r=>r.evaluation.N))];
   const left=s.tau>.30;
   plot(counts,{height:310,marginLeft:42,marginRight:20,marginBottom:42,marginTop:20,x:{domain:[0,.5],label:'Withholding cost τ',grid:true},y:{domain:[0,data.M],label:'Stated pairs N',grid:true},alt:'Exact best-report disclosure for fixed law, weights and family. Horizontal segments retain every returned interval, including zero-length endpoint reports. Grade vectors label the segments; full boundary alternatives follow in the table.',table:rows,keyboard:{data:rows,x:r=>(r.from+r.to)/2,y:'N',title:r=>`${formatGrades(r.grade)}: ${formatCount(r.N)} stated pairs for τ ${formatDecimal(r.from,{digits:8})} to ${formatDecimal(r.to,{digits:8})}.`},marks:(c,P)=>[P.line(points,{x:'tau',y:'N',stroke:c.plotFg}),P.ruleX([s.tau],{stroke:c.plotMuted,strokeDasharray:'5 3'}),numText(rows.filter(r=>r.from>0),{x:r=>(r.from+r.to)/2,y:'N',value:'grade',format:v=>formatGrades(v),textAnchor:'middle',dy:-12,fontSize:11,fill:c.plotFg}),numText(rows.filter(r=>r.from===0),{x:'from',y:'N',value:'grade',format:v=>formatGrades(v),textAnchor:'start',dx:4,dy:-12,fontSize:11,fill:c.plotFg}),P.dot(m.profiles,{x:()=>s.tau,y:r=>r.evaluation.N,fill:c.plotFg,r:4}),
   numText(currentCounts,{x:()=>s.tau,y:v=>v,value:v=>v,format:formatCount,dx:left?-8:8,dy:13,textAnchor:left?'end':'start',fontWeight:700,fill:c.plotFg,stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke'})]});
   const per=rows.flatMap(r=>[0,1].map(k=>({...r,k,share:r.EoverN[k]}))).filter(r=>r.share!==null);
   plot(shares,{height:310,marginLeft:48,marginRight:20,marginBottom:42,marginTop:20,x:{domain:[0,.5],label:'Withholding cost τ',grid:true},y:{domain:[0,1],label:'Expected wrong share Eₖ/N',grid:true},alt:'Criterion-specific expected wrong shares on each exact best-report interval. Solid lines are score A, dashed score B. Missing shares at all-withheld reports have no denominator. Shares need not increase with the price.',table:per,keyboard:{data:per,x:r=>(r.from+r.to)/2,y:'share',title:r=>`${r.k===0?'Score A':'Score B'}, report ${formatGrades(r.grade)}, τ ${formatDecimal(r.from,{digits:8})} to ${formatDecimal(r.to,{digits:8})}: wrong share ${formatShare(r.share)}.`},marks:(c,P)=>[...per.map(r=>P.link([r],{x1:'from',x2:'to',y1:'share',y2:'share',stroke:c.crit[r.k],strokeWidth:3,strokeDasharray:r.k?'6 3':undefined})),P.ruleX([s.tau],{stroke:c.plotMuted,strokeDasharray:'5 3'})]});
   if(!shares.nextElementSibling?.classList.contains('setg-legend'))shares.after(h('p',{class:'setg-note setg-paper setg-legend'},'Solid: score A. Dashed: score B. E counts expected wrong stated directions; N counts stated pairs; M counts all pairs. Eₖ/N has no denominator at N = ',ctx.num(0,'0'),'.'));
   pathTable.replaceChildren(h('p',{class:'setg-note'},tagNode(ctx,m.path),'. The law, weights and family stay fixed along this path. N cannot fall as τ rises; a criterion’s wrong share can fall. Risks at different τ measure different losses.'),hint(),table('Every exact τ interval',['From τ','To τ','Grade vector','N','Weighted E','Weighted E/N','Score A E/N','Score B E/N'],rows.map(r=>[n(`path-${r.i}-from`,r.from,v=>formatDecimal(v,{digits:8})),n(`path-${r.i}-to`,r.to,v=>formatDecimal(v,{digits:8})),n(`path-${r.i}-grade`,r.grade,formatGrades),n(`path-${r.i}-N`,r.N),n(`path-${r.i}-Ew`,r.Ew,formatExpectedCount),n(`path-${r.i}-weightedShare`,r.EwOverN,formatShare),...r.EoverN.map((v,k)=>n(`path-${r.i}-share-${k}`,v,formatShare))])),
    table('At every boundary, solve for all returned equal-risk reports',['τ','Report','N','Risk','Score A E/N','Score B E/N','Tie count','Tolerance'],m.boundaries.flatMap((b,i)=>b.result.grades.map((g,j)=>{const ev=evaluateReport(g,E,{tau:b.tau,w:m.w});return [n(`boundary-${i}-${j}-tau`,b.tau,v=>formatDecimal(v,{digits:8})),n(`boundary-${i}-${j}-grade`,g,formatGrades),n(`boundary-${i}-${j}-N`,ev.N),n(`boundary-${i}-${j}-risk`,ev.risk,formatRisk),...ev.EoverN.map((v,k)=>n(`boundary-${i}-${j}-share-${k}`,v,formatShare)),n(`boundary-${i}-${j}-ties`,b.result.tieCount),n(`boundary-${i}-${j}-tol`,b.result.tieTol,formatSci)];}))));
  }
  function drawGrid(s,m){
   capTable.replaceChildren(table('Only the cap changes',['Cap','Risk at current loss','N','First report','Family size','Tied best reports'],m.caps.map((r,i)=>[r.cap===data.ids.length?'No cap':n(`cap-${i}`,r.cap),n(`cap-${i}-risk`,r.result.risk,formatRisk),n(`cap-${i}-N`,r.result.N),n(`cap-${i}-grade`,r.result.grade,formatGrades),n(`cap-${i}-size`,r.result.family.size),n(`cap-${i}-ties`,r.result.tieCount)]),{sticky:true,selected:m.caps.findIndex(r=>r.cap===(s.cap==='all'?data.ids.length:Number(s.cap))),className:'setg-cap-table'}),
    h('p',{class:'setg-note'},'Here the law, τ and weights stay fixed. Expanding these nested families cannot raise the smallest full reporting risk. It need not increase disclosure.'),hint());
   if(grid.childNodes.length)return;
   const model=settingsGridModel(),ref=model.reference;
   grid.replaceChildren(h('p',{},'Full Cartesian product: ',ctx.num(SETTINGS_GRID.taus.length,formatCount(SETTINGS_GRID.taus.length)),' prices × ',ctx.num(SETTINGS_GRID.caps.length,formatCount(SETTINGS_GRID.caps.length)),' caps × ',ctx.num(SETTINGS_GRID.weights.length,formatCount(SETTINGS_GRID.weights.length)),' weights. Fixed reference ',name(ref.id),': ',n('grid-reference',ref.grade,formatGrades),'.'),h('p',{class:'setg-note'},'Each change compares two fixed grade vectors under that row’s law, price and weights. The reference may be outside that row’s capped family. Risk differences across rows do not select a best price or weight. Select a row to apply its settings.'),hint(),
    table('Every declared setting and its relation changes against the named reference',['Setting','Apply','τ','Cap','Weight A','Best report','Tie count','Risk','N','New stated','New withheld','Reversed','Risk change from fixed reference'],model.rows.map((r,i)=>{const btn=h('button',{type:'button',class:'prx-btn',text:'Use settings'});ctx.listen(btn,'click',()=>{const next={source:'live',tau:r.tau,cap:r.cap===data.ids.length?'all':String(r.cap),w:r.w[0]};if(Object.entries(next).every(([key,value])=>ctx.state[key]===value)){counts.focus();return;}focusPathAfterApply=true;ctx.set(next);});return [name(r.id),btn,n(`grid-${i}-tau`,r.tau,formatSetting),r.cap===6?'No cap':n(`grid-${i}-cap`,r.cap),n(`grid-${i}-weight`,r.w[0],formatSetting),n(`grid-${i}-grade`,r.grade,formatGrades),n(`grid-${i}-ties`,r.tieCount),n(`grid-${i}-risk`,r.evaluation.risk,formatRisk),n(`grid-${i}-N`,r.evaluation.N),n(`grid-${i}-new`,r.comparison.change.nNewDisclosed),n(`grid-${i}-withheld`,r.comparison.change.nNewWithheld),n(`grid-${i}-reversed`,r.comparison.change.nReversed),n(`grid-${i}-delta`,r.comparison.deltaRisk,formatRisk)];}),{sticky:true}),
    table('All retained tied grid optima, with each report’s own denominator',['Setting','Report','N','Risk','Score A E/N','Score B E/N'],model.rows.flatMap((r,i)=>r.grades.map((g,j)=>{const ev=evaluateReport(g,E,{tau:r.tau,w:r.w});return [name(r.id),n(`grid-tie-${i}-${j}-grade`,g,formatGrades),n(`grid-tie-${i}-${j}-N`,ev.N),n(`grid-tie-${i}-${j}-risk`,ev.risk,formatRisk),...ev.EoverN.map((v,k)=>n(`grid-tie-${i}-${j}-share-${k}`,v,formatShare))];}))));
  }
  function drawArchive(s){
   archive.replaceChildren();
   if(s.source==='archive30'){
    const m=archivedThirtyPath(),fig=h('div');archive.append(ctx.panelTitle('Recorded prices, not exact breakpoints'),fig,h('p',{class:'setg-note'},'Sparse archived pr_example_draws analyses, with fixed weights and cap. Dots are recorded solves; there is no interpolation or claim about transition locations. Risks at different prices measure different losses.'),hint());
    plot(fig,{height:300,marginLeft:50,marginBottom:40,x:{label:'Recorded withholding cost τ',grid:true},y:{label:'Stated pairs N',grid:true},alt:'Eight recorded draw-based thirty-site analyses. Dots show disclosure at those prices only, not an exact step path.',table:m.rows,keyboard:{data:m.rows,x:'tau',y:'N',title:r=>`τ ${formatSetting(r.tau)}: ${formatCount(r.N)} pairs, status ${r.status}, absolute gap ${formatSci(r.risk_absolute_gap)}.`},marks:(c,P)=>[P.dot(m.rows,{x:'tau',y:'N',fill:c.plotFg,r:5})]});
    archive.append(table('Every recorded thirty-site solve',['τ','Status','Grades','N','Weighted risk','Absolute gap','Poverty E/N','FRL E/N','SNAP E/N'],m.rows.map((r,i)=>[n(`archive-${i}-tau`,r.tau,formatSetting),h('span',{},labelNode(ctx,{status:r.status},{key:`path-${i}`}),'; ',r.status),n(`archive-${i}-G`,r.G),n(`archive-${i}-N`,r.N),n(`archive-${i}-risk`,r.weighted_risk,formatRisk),n(`archive-${i}-gap`,r.risk_absolute_gap,formatSci),...['poverty','frl','snap'].map(k=>n(`archive-${i}-share-${k}`,r['E_over_N_'+k],formatShare))])),h('p',{class:'setg-note'},'Fixed cap ',n('archive-cap',m.facts.G_max),'; weights ',...Object.entries(m.facts.weights).flatMap(([k,v],i)=>[i?', ':'',k,' ',ctx.num(v,formatSetting(v))]),'. Source ',name(m.source.object),'. These draw-based archives differ from the Gaussian marginal profile release. No unavailable lower bound or own report is reconstructed. A zero gap is not a numerical certificate.'));
    ctx.readout.set(['Recorded disclosures: ',...m.rows.flatMap((r,i)=>[i?', ':'',ctx.num(r.N,formatCount(r.N))]),'. Each dot is one archived price, not a transition estimate.']);
   }else{
    const m=tutorialSensitivityArchive().source,t=m.tables,ids=t.grid.setting_id;
    archive.append(ctx.panelTitle('Seven archived one-at-a-time settings'),h('p',{class:'setg-note'},'The package’s prepared tutorial changes one setting at a time against its reference. It is a different grid from the full Cartesian product in the live view.'),hint(),table('Archived tutorial sensitivity with recorded bounds and statuses',['Setting','Label','τ','Cap','Weight A','Grade vector','N','Risk','Status','Lower bound','Upper bound','Absolute gap','New stated','New withheld','Reversed'],ids.map((id,i)=>[name(id),h('span',{},...t.grid.label[i].split(/(\d+(?:\.\d+)?)/).filter(Boolean).map(t=>/^\d/.test(t)?ctx.num(Number(t),t):t)),n(`tutorial-${i}-tau`,t.grid.tau[i],formatSetting),n(`tutorial-${i}-cap`,t.grid.G_max[i]),n(`tutorial-${i}-weight`,t.grid.w_score_A[i],formatSetting),n(`tutorial-${i}-grade`,t.grades[id],formatGrades),n(`tutorial-${i}-N`,t.results.N[i]),n(`tutorial-${i}-risk`,t.results.risk[i],formatRisk),t.results.status[i],n(`tutorial-${i}-lower`,t.results.risk_lower_bound[i],formatRisk),n(`tutorial-${i}-upper`,t.results.risk_upper_bound[i],formatRisk),n(`tutorial-${i}-gap`,t.results.risk_absolute_gap[i],formatSci),n(`tutorial-${i}-new`,t.changes.n_new_disclosed[i]),n(`tutorial-${i}-withheld`,t.changes.n_new_withheld[i]),n(`tutorial-${i}-reversed`,t.changes.n_reversed[i])])),h('p',{class:'setg-note'},'The archived reference is ',name(m.facts.reference_id),'. All reported numbers, grades, statuses and bounds are fixed archive fields. Risk values at changed weights or prices measure different losses. A zero gap is not a numerical certificate.'));
    ctx.readout.set(['Archived one-at-a-time analysis: ',ctx.num(ids.length,formatCount(ids.length)),' recorded settings; reference ',name(m.facts.reference_id),'.']);
   }
   ctx.caption.replaceChildren('Synthetic public postrank tutorial/archive inputs. Fixed recorded settings; no new archive solve.');
  }
  let cancel=null,epoch=0,profileKey='';ctx.onCleanup(()=>{epoch++;cancel?.();});
  return {render(s,info={}){source.set(s.source);tau.set(s.tau);w.set(s.w);cap.set(s.cap);pair.set(s.pair);unit.set(s.unit);liveControls.hidden=s.source!=='live';live.hidden=s.source!=='live';archive.hidden=s.source==='live';cancel?.();epoch++;const token=epoch;
   if(s.source!=='live'){ctx.root.removeAttribute('aria-busy');status.hidden=true;drawArchive(s);return;}
   ctx.root.setAttribute('aria-busy','true');status.hidden=false;status.textContent='Computing the exact path and comparisons for these settings…';ctx.readout.set(['Updating exact settings…']);
   cancel=ctx.timeout(()=>{if(token!==epoch)return;const m=settingsPathModel(s);drawPath(s,m);drawGrid(s,m);
    guardedView.render(solveGuardedCriteria({data:'six',tau:s.tau,w:s.w,cap:s.cap,objective:'weighted'}));
    // The embedded renderer follows its standalone readout placement. Put our live result back in the frame.
    ctx.controls.after(ctx.readout.node);
    const pk=JSON.stringify([s.pair,s.unit,Math.floor(ctx.width())]);if(pk!==profileKey||info.reason==='disclosure'){profileView.render(criterionProfileModel({data:'six',level:90,order:'criterion',orientB:'higher',pair:s.pair,unit:s.unit}));profileKey=pk;}
    const p=m.profiles[0],uncapped=m.caps.at(-1).result;
    const alsoUncapped=uncapped.grades.some(g=>g.every((v,i)=>v===p.grade[i]));
    ctx.readout.set(['At τ ',n('active-tau',s.tau,formatSetting),', weights ',ctx.num(m.w[0],formatSetting(m.w[0])),'/',ctx.num(m.w[1],formatSetting(m.w[1])),s.cap==='all'?' and no grade cap':[' and at most ',ctx.num(Number(s.cap),formatCount(Number(s.cap))),' grades'],', ',m.result.tieCount>1?'one best report ':'the best report ',n('active-grade',p.grade,formatGrades),' states ',n('current-N',p.evaluation.N),' of ',n('current-M',p.evaluation.M),' pairs (risk ',n('active-risk',p.evaluation.risk,formatRisk),'; expected wrong shares ',...p.evaluation.EoverN.flatMap((v,k)=>[k?' and ':'',n(`current-share-${k}`,v,formatShare)]),').',...s.cap==='all'?[]:alsoUncapped?[' This report is also optimal without the cap.']:[' Without the cap, the minimum risk is ',n('uncapped-risk',uncapped.risk,formatRisk),'.']]);
    tieNote.replaceChildren(n('current-ties',m.result.tieCount),m.result.tieCount===1?' report reaches the smallest risk within tolerance ':' reports share the smallest risk within tolerance ',n('current-tol',m.result.tieTol,formatSci),'; all retained alternatives appear below.');
    settingsNote.replaceChildren(h('p',{},'Withholding costs ',n('settings-tau',s.tau,formatSetting),' of a wrong direction per pair. The cap permits ',s.cap==='all'?'all grade counts':['at most ',ctx.num(Number(s.cap),formatCount(Number(s.cap))),' grades'],'. Error weights are ',ctx.num(m.w,formatSetting(m.w)),'. These are explicit reporting choices for the intended audience, not confidence levels estimated from the data.'),h('p',{class:'setg-note'},'Choose the substantive target, the relative cost of silence, the acceptable grade complexity and the relative importance of criterion errors before interpreting the selected report. The isolated-pair probability rule does not independently decide a coherent full report.'));
    ctx.caption.replaceChildren('Six fictional sites; independent Normal posteriors supplied by the tutorial. ',tagNode(ctx,m.result),'. Changing the cap changes the family; changing τ or error weights changes the loss.');
    ctx.root.removeAttribute('aria-busy');status.hidden=true;cancel=null;
    if(focusPathAfterApply){focusPathAfterApply=false;counts.focus();}
   },0);
  }};
 }});}
