// Conditional-law sensitivity and repeated observations at a fixed league truth are separate experiments.
import { createWidget } from '../shared/base.js';
import { plot, numText } from '../shared/chart.js';
import { formatCount, formatDecimal, formatExpectedCount, formatProb, formatSci, formatSetting, formatShare } from '../shared/format.js';
import { captionNode, tagNode } from '../shared/labels.js';
import { LEAGUE_SEED, drawLeague, errorArray, evaluateReport, fixedOrderDP, gaussianDraws, league30, leagueGradingReplays, maxCoefficientError, normalPosterior, realizedWrong, runningMean, weightedRadius } from '../pr-core.js';
import { CONFIG as SHRINKAGE_CONFIG } from './shrinkage.js';
import { CONFIG as DRAW_CONFIG, createDrawControls, drawHistogram, drawRunningAverage } from './disclosed-errors.js';

export const CONFIG=Object.freeze({name:'reported-and-realized',className:'prx-rr',priorSd:SHRINKAGE_CONFIG.priorSd,referenceSd:.15,replays:{min:3,max:100,step:1,value:20},replay:{min:1,max:100,step:1,value:1},tau:{min:.01,max:.5,step:.01,value:.2},cap:{min:1,max:5,step:1,value:3},draws:{min:0,max:2000,step:1,value:100},seed:{min:0,max:999999,step:1,value:1}});
const L=league30(),THETA=L.theta.map(v=>[v]),cache=new Map(),drawCache=new Map();
const share=v=>formatShare(v),prob=v=>formatProb(v,{digits:4});
/** The report is selected anew per observation replay, then held fixed when the law changes. */
export function replayComparison({priorSd=.15,tau=.2,cap=3,replays=20}={}){
 const key=JSON.stringify([priorSd,tau,cap,replays]);if(cache.has(key))return cache.get(key);
 const simulation=leagueGradingReplays(LEAGUE_SEED,{priorSd,tau,cap,replays});
 const rows=simulation.draws.map(d=>{
  const estimate=drawLeague(d.seed).estimate;
  const assumed=normalPosterior(estimate,L.se,{priorSd});
  const reference=normalPosterior(estimate,L.se,{priorSd:CONFIG.referenceSd});
  const claimedErrors=errorArray(assumed.mean,assumed.sd,{ids:L.ids,criteria:['league value']});
  const referenceErrors=errorArray(reference.mean,reference.sd,{ids:L.ids,criteria:['league value']});
  const evaluation=evaluateReport(d.grade,referenceErrors,{tau});
  const coefficient=maxCoefficientError(claimedErrors,referenceErrors);
  const delta=weightedRadius(coefficient.epsilon,[1]);
  return {...d,estimate,assumed,reference,claimedErrors,referenceErrors,evaluation,coefficient,delta,referenceShare:evaluation.EoverN[0],shareGap:d.N?Math.abs(d.EoverN-evaluation.EoverN[0]):null};
 });
 const out={simulation,rows};cache.set(key,out);if(cache.size>20)cache.delete(cache.keys().next().value);return out;
}
/** Posterior draws change latent values; unlike the observation replays they do not hold theta fixed. */
export function conditionalDraws(row,{drawLaw='reference',seed=1,draws=100}={}){
 const key=JSON.stringify([row.seed,row.assumed.mean,Array.from(row.grade),drawLaw,seed,draws]);
 if(drawCache.has(key))return drawCache.get(key);
 const law=drawLaw==='reference'?row.reference:row.assumed;
 const counts=draws?gaussianDraws(law.mean,law.sd,draws,seed).map(theta=>realizedWrong(row.grade,theta).D[0]):[];
 const out={counts,mean:draws?runningMean(counts).at(-1):null,E:drawLaw==='reference'?row.evaluation.E[0]:row.E};
 drawCache.set(key,out);if(drawCache.size>12)drawCache.delete(drawCache.keys().next().value);return out;
}
const CSS=`
.prx-rr .prx-rr-note {font-size:.89em;color:var(--prx-fg-muted);margin:.35rem 0}
.prx-rr .prx-rr-section {margin-top:1.25rem;padding-top:.8rem;border-top:1px solid var(--prx-border)}
.prx-rr .prx-rr-legend {display:flex;flex-wrap:wrap;gap:.4rem 1rem;padding:.5rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);font-size:.85em}
.prx-rr .prx-rr-legend span {display:inline-flex;align-items:center;gap:.35rem}
.prx-rr .prx-rr-solid {width:1.3rem;border-top:2px solid var(--prx-plot-fg)}
.prx-rr .prx-rr-dash {width:1.3rem;border-top:2px dashed var(--prx-plot-muted)}
.prx-rr .prx-rr-dot {width:.65rem;height:.65rem;border-radius:50%;border:2px solid var(--prx-plot-fg);background:var(--prx-plot-bg)}
.prx-rr .prx-rr-bound {padding:.65rem;border-left:3px solid var(--prx-accent);margin:.6rem 0;background:var(--prx-bg)}
.prx-rr .prx-rr-controls,.prx-rr .prx-de-draw-row {display:flex;flex-wrap:wrap;align-items:end;gap:.6rem 1rem;margin:.6rem 0}
.prx-rr .prx-rr-controls>* {flex:1 1 12rem;min-width:0}
.prx-rr .prx-de-draw-buttons {display:flex;flex-wrap:wrap;gap:.4rem}
.prx-rr .prx-rr-grade {margin:.35rem 0;padding:.4rem .6rem;border:1px solid var(--prx-border);border-radius:4px;overflow-wrap:anywhere}
.prx-rr .prx-rr-scroll {max-width:100%;overflow-x:auto;margin:.6rem 0}
.prx-rr table {width:100%;min-width:35rem;border-collapse:collapse;font-size:.85em;font-variant-numeric:tabular-nums}
.prx-rr th,.prx-rr td {padding:.35rem .5rem;text-align:left;border-bottom:1px solid var(--prx-border)}
.prx-rr caption {text-align:left;padding:.35rem 0;color:var(--prx-fg-muted)}
.prx-rr tr[aria-current=true] {background:var(--prx-bg-sunken)}
.prx-rr details {margin:.6rem 0}
.prx-rr summary {cursor:pointer}
`;
export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:CONFIG.name,className:CONFIG.className,label:'Reported and realized error: a report under two declared conditional laws, observation replays at fixed truth, and separate posterior draws.',css:CSS,
 keys:{priorSd:{type:'number',...CONFIG.priorSd},tau:{type:'number',...CONFIG.tau},cap:{type:'integer',...CONFIG.cap},replays:{type:'integer',...CONFIG.replays},replay:{type:'integer',...CONFIG.replay},drawLaw:{type:'choice',values:['reference','assumed'],value:'reference'},draws:{type:'integer',...CONFIG.draws},seed:{type:'integer',...CONFIG.seed}},
 build(ctx){
  const {h}=ctx,ro=(name,v,f=formatCount)=>{const n=ctx.num(v,f(v));n.dataset.prxReadout=name;return n;};
  const prior=ctx.slider({label:'Assumed prior SD',...ctx.key('priorSd'),format:formatSetting,hint:'Changing prior SD, cost or grade cap selects a new report. The two law expectations then evaluate that same newly selected report.',onInput:v=>ctx.set({priorSd:v})});
  ctx.controls.append(prior.root);
  const comparison=h('div'),scope=h('p',{class:'prx-rr-note'},'The reference is a declared normal law using the same observations and a prior SD of ',ctx.num(CONFIG.referenceSd,formatSetting(CONFIG.referenceSd)),'. It is a comparison model, not an established true conditional law.'),bound=h('div',{class:'prx-rr-bound'}),report=h('div'),reportTag=h('p',{class:'prx-rr-note'}),unitDetails=h('details',{},h('summary',{},'Inspect the selected report and both laws'));
  const unitTable=ctx.scrollRegion(h('div',{class:'prx-rr-scroll'}),'Selected report, fixed truth, estimates and both conditional laws');unitDetails.append(unitTable);
  const replayTitle=ctx.panelTitle('Repeat observations; keep the true league fixed');
  const replayControls=h('div',{class:'prx-rr-controls','data-prx-part':'controls'});
  const selected=ctx.slider({label:'Inspect replay',...ctx.key('replay'),onInput:v=>ctx.set({replay:v})});
  const total=ctx.numberInput({label:'Observation replays',...ctx.key('replays'),onInput:v=>{if(Number.isFinite(v))ctx.set({replays:Math.round(v)});}});
  const tau=ctx.slider({label:'Withholding cost τ',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})});
  const cap=ctx.slider({label:'Maximum grades',...ctx.key('cap'),onInput:v=>ctx.set({cap:v})});
  replayControls.append(selected.root,total.root,tau.root,cap.root);
  const replayPlot=h('div'),replayCaption=h('p',{class:'prx-rr-note'}),replayLegend=h('div',{class:'prx-rr-legend','data-prx-part':'legend'},h('span',{},h('i',{class:'prx-rr-solid'}),'claim E/N'),h('span',{},h('i',{class:'prx-rr-dash'}),'reference expectation'),h('span',{},h('i',{class:'prx-rr-dot'}),'realized D/N at fixed truth'));
  const replayDetails=h('details',{},h('summary',{},'Read every replay’s numbers'));
  const replayTable=ctx.scrollRegion(h('div',{class:'prx-rr-scroll'}),'Error shares of the observation replays');replayDetails.append(replayTable);
  const drawLaw=ctx.segmented({label:'Law supplying posterior draws',options:[{value:'reference',label:'Reference law'},{value:'assumed',label:'Assumed law'}],value:ctx.state.drawLaw,onChange:v=>ctx.set({drawLaw:v})});
  const drawControls=createDrawControls(ctx),drawSettings=h('div',{'data-prx-part':'controls'},drawLaw.root,drawControls.row),drawSummary=h('p'),drawCaption=h('p',{class:'prx-rr-note'}),hist=h('div'),run=h('div');
  const histRegion=ctx.scrollRegion(h('div',{class:'prx-rr-scroll'},hist),'Posterior-draw histogram, scroll horizontally to inspect every wrong count');
  ctx.charts.append(ctx.panelTitle('One selected report, two law expectations, one realization'),comparison,bound,scope,reportTag,report,unitDetails,
   h('section',{class:'prx-rr-section'},replayTitle,h('p',{class:'prx-rr-note'},'Each replay generates new noisy estimates of the same fixed true values, then chooses a new report. Select a replay to compare its own fixed report above. These are observation replays, not posterior draws.'),replayControls,replayLegend,replayPlot,replayCaption,replayDetails),
   h('section',{class:'prx-rr-section'},ctx.panelTitle('A different experiment: draw true values from a declared law'),h('p',{class:'prx-rr-note'},'Freeze the selected replay’s report and observations. Here the true values vary under the selected conditional law. The running average targets that law’s expected wrong count; it does not validate the law against the fixed league truth.'),drawSettings,drawSummary,h('p',{class:'prx-rr-note'},'The histogram scrolls horizontally when its count labels need more room.'),histRegion,run,drawCaption));
  ctx.charts.before(ctx.readout.node);
  return {render(state){
   if(state.replay>state.replays){ctx.set({replay:state.replays});return;}
   prior.set(state.priorSd);total.set(state.replays);tau.set(state.tau);cap.set(state.cap);selected.input.max=state.replays;selected.set(state.replay);drawLaw.set(state.drawLaw);drawControls.seed.set(state.seed);
   drawControls.one.setDisabled(state.draws>=CONFIG.draws.max);drawControls.many.setDisabled(state.draws+100>CONFIG.draws.max);drawControls.clear.setDisabled(state.draws===0);
   const c=replayComparison(state),r=c.rows[state.replay-1],N=r.N;
   ctx.readout.set(['Replay ',ro('selected-replay',r.r),': the report claims an expected wrong share of ',ro('claimed-share',r.EoverN,share),'; the reference-law expectation for this same report is ',ro('reference-share',r.referenceShare,share),'. At the fixed league truth, ',ro('realized-count',r.D),' of ',ro('stated-count',N),' stated directions are wrong (share ',ro('realized-share',r.DoverN,share),').']);
   const shares=[{label:'Claim E/N',value:r.EoverN,kind:'claim'},{label:'Reference E/N',value:r.referenceShare,kind:'reference'},{label:'Fixed-truth D/N',value:r.DoverN,kind:'realized'}];
   plot(comparison,{height:180,marginLeft:118,marginRight:52,marginTop:16,marginBottom:42,x:{domain:[0,Math.max(.2,...shares.map(d=>d.value??0))*1.15],label:'Wrong share (stated pairs)',ticks:4,labelAnchor:'center',labelArrow:'none'},y:{domain:shares.map(d=>d.label),label:null,tickSize:0},
    alt:N?'The same selected report’s expected wrong share under the assumed and reference conditional laws, beside its realized wrong share at the fixed true league values. The realized share is not another conditional expectation.':'This report states no pair directions, so all three shares read NA: no disclosure.',
    table:{caption:'One fixed report, two conditional-law expectations and a fixed-truth realization',columns:[{label:'Quantity',value:'label',num:false},{label:'Wrong share',value:'value',format:v=>share(v)}],rows:shares},
    marks:(p,P)=>[P.ruleX([0],{stroke:p.plotAxis}),P.barX(shares.filter(d=>d.kind==='claim'&&d.value!==null),{y:'label',x:'value',fill:p.plotFg,insetTop:7,insetBottom:7}),P.barX(shares.filter(d=>d.kind==='reference'&&d.value!==null),{y:'label',x:'value',fill:p.plotGrid,stroke:p.plotMuted,insetTop:7,insetBottom:7}),P.dot(shares.filter(d=>d.kind==='realized'&&d.value!==null),{y:'label',x:'value',fill:p.plotBg,stroke:p.plotFg,r:5,strokeWidth:2}),numText(shares.filter(d=>d.value!==null),{x:'value',y:'label',value:'value',format:v=>share(v),dx:8,textAnchor:'start',fill:p.plotFg})],
    keyboard:{data:shares.filter(d=>d.value!==null),x:'value',y:'label',sort:false,title:d=>`${d.label}: ${share(d.value)} wrong share for this fixed report.`},
   });
   bound.replaceChildren(h('strong',{},'A bound on disagreement between expectations'),h('p',{},N?['Absolute share gap ',ro('share-gap',r.shareGap,prob),' ≤ largest pair-error gap δ = ',ro('delta',r.delta,prob),'.']:['No share gap exists when nothing is stated. The largest pair-error gap is ',ro('delta',r.delta,prob),'.']),h('p',{class:'prx-rr-note'},'δ is the largest absolute difference between the two laws’ wrong-direction probabilities over all ordered pairs, including directions this report withholds. It compares probabilities, not wrong-direction counts.'),h('p',{class:'prx-rr-note'},'For a report with N > ',ctx.num(0,'0'),', averaging its stated-pair error probabilities gives |claimed E/N − reference E/N| ≤ δ. This does not bound the error of a single realization or prove calibration.'));
   const opt=fixedOrderDP(r.claimedErrors,{scores:r.assumed.mean,direction:'descending',tau:state.tau,G:state.cap});
   reportTag.replaceChildren(tagNode(ctx,opt),' in descending assumed-posterior-mean order, at most ',ctx.num(state.cap,formatCount(state.cap)),' grades. ',captionNode(ctx,'fixed-report'),'. ',captionNode(ctx,'teaching-posterior'),'.');
   if(opt.tieCount>1)reportTag.append(' ',ctx.num(opt.tieCount,formatCount(opt.tieCount)),' reports share the smallest risk; the readouts show the package choice. Equal-risk tolerance ',ctx.num(opt.tieTol,formatSci(opt.tieTol)),'.');
   report.replaceChildren(h('p',{class:'prx-rr-note'},'Grade ',ctx.num(1,'1'),' = stated highest on the league value, as the assumed posterior judges it. A shared grade means not compared.'));
   for(let g=1;g<=Math.max(...r.grade);g++)report.append(h('div',{class:'prx-rr-grade'},'Grade ',ctx.num(g,formatCount(g)),': ',h('span',{'data-prx-name':''},L.ids.filter((id,i)=>r.grade[i]===g).join(', '))));
   const makeTable=(headers,rows,caption)=>h('table',{},h('caption',{},caption),h('thead',{},h('tr',{},...headers.map(t=>h('th',{scope:'col'},t)))),h('tbody',{},...rows));
   unitTable.replaceChildren(makeTable(['Unit','Grade','Fixed truth','Estimate','Assumed mean (SD)','Reference mean (SD)'],L.ids.map((id,i)=>h('tr',{},h('th',{scope:'row','data-prx-name':''},id),h('td',{},ctx.num(r.grade[i],formatCount(r.grade[i]))),...[L.theta[i],r.estimate[i]].map(v=>h('td',{},ctx.num(v,formatDecimal(v,{digits:3})))),...[r.assumed,r.reference].map(law=>h('td',{},ctx.num(law.mean[i],formatDecimal(law.mean[i],{digits:3})),' (',ctx.num(law.sd[i],formatDecimal(law.sd[i],{digits:3})),')')))),`Selected observation replay: report and normal conditional laws`));
   const points=c.rows.flatMap(d=>[{r:d.r,value:d.EoverN,kind:'claim'},{r:d.r,value:d.referenceShare,kind:'reference'},{r:d.r,value:d.DoverN,kind:'realized'}]).filter(d=>d.value!==null);
   plot(replayPlot,{height:265,marginLeft:48,marginRight:18,marginTop:18,marginBottom:42,x:{domain:[1,state.replays],label:'Observation replay (new report each time)',ticks:Math.min(6,state.replays),labelAnchor:'center',labelArrow:'none'},y:{domain:[0,Math.max(.2,...points.map(d=>d.value))*1.1],label:'Wrong share',ticks:4,grid:true},alt:'Observation replays hold the true league values fixed. Each replay reselects a report; its claimed and reference-law expected wrong shares are lines, and its realized wrong share is an open circle. The highlighted vertical rule is the selected replay.',
    table:{caption:'Wrong shares by observation replay, with new estimates and a new report each time',columns:[{label:'Replay',value:'r',format:v=>formatCount(v)},{label:'Quantity',value:'kind',num:false},{label:'Wrong share',value:'value',format:v=>share(v)}],rows:points},
    marks:(p,P)=>[P.ruleX([state.replay],{stroke:p.plotGrid,strokeWidth:5}),P.line(points.filter(d=>d.kind==='claim'),{x:'r',y:'value',stroke:p.plotFg,strokeWidth:2}),P.line(points.filter(d=>d.kind==='reference'),{x:'r',y:'value',stroke:p.plotMuted,strokeDasharray:'5,3',strokeWidth:2}),P.dot(points.filter(d=>d.kind==='realized'),{x:'r',y:'value',fill:p.plotBg,stroke:p.plotFg,r:4,strokeWidth:1.5})],
    keyboard:{data:points,x:'r',y:'value',sort:false,key:d=>`${d.r}-${d.kind}`,title:d=>`Observation replay ${formatCount(d.r)}, ${d.kind}: wrong share ${share(d.value)}.`},
   });
   replayCaption.replaceChildren('Monte Carlo, ',ro('replay-count',state.replays),' observation replays, base seed ',ctx.num(LEAGUE_SEED,formatSetting(LEAGUE_SEED)),'. Replay r uses seed base + r; selected seed ',ro('observation-seed',r.seed,formatSetting),'. The ',ctx.num(L.ids.length,formatCount(L.ids.length)),' true values are a deterministic construction; their design scale ',ctx.num(.15,formatSetting(.15)),' does not establish either conditional law as correct.');
   replayTable.replaceChildren(makeTable(['Replay','Stated N','Claim E/N','Reference E/N','Realized D/N','Pair-gap δ'],c.rows.map(d=>h('tr',{'aria-current':d.r===state.replay?'true':null},h('th',{scope:'row'},ctx.num(d.r,formatCount(d.r))),h('td',{},ctx.num(d.N,formatCount(d.N))),...[d.EoverN,d.referenceShare,d.DoverN].map(v=>h('td',{},ctx.num(v,share(v)))),h('td',{},ctx.num(d.delta,prob(d.delta))))),'Each row uses its own selected report; expectations hold that row’s report fixed'));
   if(state.priorSd===CONFIG.referenceSd)replayCaption.append(' The claim and reference lines coincide because their conditional laws are identical.');
   const draws=conditionalDraws(r,state);
   drawSummary.replaceChildren('Fixed report, ',ro('posterior-draws',state.draws),' posterior draws under the ',state.drawLaw==='reference'?'reference':'assumed',' law. Expected wrong count ',ro('draw-expected',draws.E,formatExpectedCount),'; simulated average ',ro('draw-average',draws.mean,formatExpectedCount),'.');
   const top=N<DRAW_CONFIG.hist.minBins?N:Math.max(DRAW_CONFIG.hist.minBins-1,Math.min(N,Math.max(0,...draws.counts)));
   hist.style.minWidth=`${Math.max(histRegion.clientWidth||ctx.width(),(top+1)*18+DRAW_CONFIG.hist.marginLeft+DRAW_CONFIG.hist.marginRight)}px`;
   drawHistogram(ctx,hist,draws.counts,N);run.hidden=state.draws===0;if(state.draws>0)drawRunningAverage(ctx,run,draws.counts,draws.E);
   drawCaption.replaceChildren(captionNode(ctx,'monte-carlo',{S:state.draws,seed:state.seed}),'. These are draws of latent values with the selected observations and report fixed. The dashed line is this draw law’s expectation, not the replay experiment’s average.');
  }};
 }});
}
