// Each rerun chooses and scores its own report on the same posterior draws.
// Exact-law evaluation keeps that report fixed. No independent evaluation sample is substituted.
// Layout (review 044 repair, X-01, X-16 with G4-F9, X-12 with G4-F8): base.js's result-first frame, so the read-out
// sits directly under the controls and the preset row, in the review's replacement copy, which states the range of
// the "look worse" count over every way of breaking the runs' tied selections (all tied draw-based optima, from the
// engine, staged with the reruns). The 100-run cloud follows (ctx.primaryGraphic), drawn with what it means at the
// zero line, a dashed line at the mean signed gap with its value, and hollow markers for tied selections; directly
// under it the run slider with a one-line summary of the followed run, so its gap is next to the cloud a reader
// clicks (on a phone as well); then the seed, Next seeds and the bounds toggle, the notes, the two cards, the
// convergence panel and the package fold view, unchanged.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatDecimal, formatGrades, formatRisk, formatSci, formatSetting, formatSigned } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { drawErrors, errorArray, evaluateReport, exactOptimum, gaussianDraws, pairCount, regretBound, selectionOnDraws, summaryStats } from "../pr-core.js";
import { CONFIG as MC, envelopeFor } from "./mc-error.js";
import SIX from "../../data/released/six-sites.json" with {type:"json"};
import TOY from "../../data/released/cache-toy.json" with {type:"json"};

export const CONFIG=Object.freeze({runs:100,levels:Object.freeze([100,400,1000,4000]),sliceMs:18});
const U=SIX.tables.units,IDS=U.id,M=pairCount(IDS.length),CF=TOY.analyses.toy_crossfit;
const LAW=Object.fromEntries(MC.criteria.values.map(c=>{
 const cols=MC.criteriaOf[c].map(k=>k==="score_A"?["mean_A","sd_A"]:["mean_B","sd_B"]);
 const means=IDS.map((_,i)=>cols.map(([m])=>U[m][i])),sds=IDS.map((_,i)=>cols.map(([,s])=>U[s][i]));
 return[c,{means,sds,w:MC.weights[c],criteria:MC.criteriaOf[c],E:errorArray(means,sds,{ids:IDS,criteria:MC.criteriaOf[c]})}];
}));
const family=cap=>cap==="none"?{kind:"all"}:{kind:"atMost",G:3};
const cache=new Map(),bestCache=new Map(),detailCache=new Map(),tieCache=new Map();
const keyOf=s=>JSON.stringify([s.criteria,s.S,s.seed,s.tau,s.cap]);
const put=(map,key,value,max)=>{map.set(key,value);if(map.size>max)map.delete(map.keys().next().value);return value;};
const seedAt=(seed,run)=>1+(seed-1+run-1)%4294967295;
function bestFor(s){const key=JSON.stringify([s.criteria,s.tau,s.cap]);if(!bestCache.has(key))put(bestCache,key,exactOptimum(LAW[s.criteria].E,{tau:s.tau,w:LAW[s.criteria].w,family:family(s.cap)}),100);return bestCache.get(key);}
/** A compact, memoized engine result. Draws are regenerated only for the followed run's tie details. */
export function selectionRun(s){
 const key=keyOf(s);if(cache.has(key))return cache.get(key);
 const L=LAW[s.criteria],r=selectionOnDraws(gaussianDraws(L.means,L.sds,s.S,s.seed),L.E,{tau:s.tau,w:L.w,family:family(s.cap)});
 const best=bestFor(s),eta=best.tieTol;
 const b=regretBound({N:r.N,Nstar:best.N,M,deltaW:r.deltaW,eta});
 return put(cache,key,{...r,uniformBound:b.uniform,sharpBound:b.regret,eta},3000);
}
function detailFor(s){
 const key=keyOf(s);if(detailCache.has(key))return detailCache.get(key);
 const L=LAW[s.criteria],E=drawErrors(gaussianDraws(L.means,L.sds,s.S,s.seed),{ids:IDS,criteria:L.criteria});
 const opt=exactOptimum(E,{tau:s.tau,w:L.w,family:family(s.cap)});
 const alternatives=(opt.grades??[opt.grade]).map(g=>{
  const est=evaluateReport(g,E,{tau:s.tau,w:L.w}),exact=evaluateReport(g,L.E,{tau:s.tau,w:L.w});
  return{grade:Array.from(g),N:exact.N,inSample:est.risk,exact:exact.risk,gap:est.risk-exact.risk};
 });
 return put(detailCache,key,{opt,alternatives},20);
}
/** review 044 repair (X-12): every tied draw-based optimum of one run (maxTies Infinity: all of them, in the engine's
 * lexicographic order, so the first is the run's own report) with its signed gap; gaps is null for an untied run. */
export function tieRun(s){
 const key=keyOf(s);if(tieCache.has(key))return tieCache.get(key);
 const L=LAW[s.criteria],E=drawErrors(gaussianDraws(L.means,L.sds,s.S,s.seed),{ids:IDS,criteria:L.criteria});
 const opt=exactOptimum(E,{tau:s.tau,w:L.w,family:family(s.cap),maxTies:Infinity});
 const gaps=opt.tieCount>1?opt.grades.map(g=>evaluateReport(g,E,{tau:s.tau,w:L.w}).risk-evaluateReport(g,L.E,{tau:s.tau,w:L.w}).risk):null;
 return put(tieCache,key,{tieCount:opt.tieCount,gaps},3000);
}
/** The "look worse" count over every way of breaking the tied selections: the runs that look worse whichever tied
 * report is taken (min) and those that can (max), with the number of tied runs. */
export function tieRange(rows,ties){
 let tied=0,worseMin=0,worseMax=0;
 rows.forEach((r,i)=>{const t=ties[i],gaps=t.gaps??[r.gap];if(t.tieCount>1)tied++;if(gaps.every(g=>g>0))worseMin++;if(gaps.some(g=>g>0))worseMax++;});
 return{tied,worseMin,worseMax};
}
export function summarizeRuns(rows){return{n:rows.length,better:rows.filter(r=>r.gap<0).length,worse:rows.filter(r=>r.gap>0).length,same:rows.filter(r=>r.gap===0).length,gap:summaryStats(rows.map(r=>r.gap)).mean,absolute:summaryStats(rows.map(r=>Math.abs(r.gap))).mean,bound:summaryStats(rows.map(r=>r.bound)).mean,regret:summaryStats(rows.map(r=>r.regret)).mean};}
const gapFormat=x=>formatSigned(x,{digits:5}),dec=x=>formatDecimal(x,{digits:5});
const CSS=`
@media (min-width: 64rem) {
  .cj > .prx-controls { row-gap: 0.35rem; }
}
.cj .cj-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr));gap:1rem;}
.cj .cj-panel {min-width:0;border:1px solid var(--prx-border);border-radius:var(--prx-radius);padding:.65rem;}
.cj .cj-panel p {margin:.35rem 0;}
.cj .cj-note {font-size:.88em;color:var(--prx-fg-muted);margin:.4rem 0;}
.cj .cj-line {display:flex;align-items:flex-end;flex-wrap:wrap;gap:.5rem 1.25rem;margin:.7rem 0;}
.cj .cj-line .prx-slider {flex:1 1 16rem;max-width:28rem;}
.cj .cj-line input[type=number] {width:8rem;}
.cj .prx-toggle {display:grid;grid-template-columns:auto 1fr;gap:.2rem .4rem;}
.cj .prx-toggle .prx-hint {grid-column:1/-1;margin:.1rem 0 .35rem;}
.cj .cj-legend {display:flex;flex-wrap:wrap;gap:.3rem 1rem;font-size:.85em;}
.cj .cj-legend span {display:inline-flex;align-items:center;gap:.3rem;}
.cj .cj-key {display:inline-block;width:1.6rem;border-top:2px solid var(--prx-plot-fg);}
.cj .cj-key-bound {border-color:var(--prx-plot-muted);border-top-style:dotted;}
.cj .cj-key-radius {border-color:var(--prx-plot-fg);border-top-style:dashed;}
.cj .cj-table {width:100%;border-collapse:collapse;font-size:.88em;font-variant-numeric:tabular-nums;}
.cj .cj-table th,.cj .cj-table td {padding:.35rem .45rem;border-bottom:1px solid var(--prx-border);text-align:left;}
.cj .cj-wide {min-width:34rem;}
.cj .cj-scroll {max-width:100%;overflow-x:auto;}
.cj .cj-bound {border-left:3px solid var(--prx-accent);padding-left:.7rem;margin:.8rem 0;}
.cj .cj-busy {opacity:.45;}
/* review 044 repair (X-16, G4-F9): the run slider with the followed run's line directly under the cloud */
.cj .cj-run {display:flex;align-items:flex-end;flex-wrap:wrap;gap:.35rem 1.25rem;margin:.5rem 0 .3rem;}
.cj .cj-run .prx-slider {flex:1 1 14rem;max-width:22rem;}
.cj .cj-follow {flex:2 1 18rem;margin:0 0 .4rem;font-variant-numeric:tabular-nums;}
.cj .cj-tiekey {display:flex;flex-wrap:wrap;gap:.25rem 1rem;margin:.3rem 0 0;font-size:.85em;color:var(--prx-fg-muted);}
.cj .cj-tiekey span {display:inline-flex;align-items:center;gap:.35rem;}
.cj .cj-hollow {display:inline-block;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--prx-fg-muted);box-sizing:border-box;}
`;
export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:"chosen-and-judged",className:"cj",css:CSS,label:"Scored on the draws that chose it: rerun-specific selection, exact-law risk, signed gaps and regret bounds.",
 // review 044 repair (X-01): the read-out directly under the controls and the preset row
 layout:"result-first",
 keys:{S:{type:"integer",min:5,max:4000,step:5,value:100},seed:{type:"integer",min:1,max:4294967295,value:1},criteria:{type:"choice",values:["A","B","AB"],value:"A"},tau:{type:"number",min:.02,max:.5,step:.01,value:.2},cap:{type:"choice",values:[3,"none"],value:"none"},run:{type:"integer",min:1,max:CONFIG.runs,value:1},bounds:{type:"boolean",value:false}},
 build(ctx){
  const {h}=ctx,ro=(name,v,f=formatCount)=>{const n=ctx.num(v,f(v));n.dataset.prxReadout=name;return n;};
  const S=ctx.slider({label:"Draws in each run S",...ctx.key("S"),format:formatCount,onInput:S=>ctx.set({S})});
  const score=ctx.segmented({label:"Score",options:[{value:"A",label:"Score A"},{value:"B",label:"Score B"},{value:"AB",label:"Both, equal weights"}],value:ctx.state.criteria,onChange:criteria=>ctx.set({criteria})});
  const tau=ctx.slider({label:"Withholding cost τ",...ctx.key("tau"),onInput:tau=>ctx.set({tau})});
  const cap=ctx.segmented({label:"Family searched in every run",options:[{value:"none",label:"All reports"},{value:3,label:"At most three grades"}],value:ctx.state.cap,onChange:cap=>ctx.set({cap})});
  ctx.controls.append(S.root,score.root,tau.root,cap.root);
  // the draw count is the control that reshapes the cloud (base.js primaryControl)
  ctx.primaryControl(S.root);
  const status=h("p",{class:"cj-note",role:"status"}),main=h("div"),mainNote=h("p",{class:"cj-note"});
  const showBounds=ctx.toggle({label:"Show each run’s gap bound",checked:ctx.state.bounds,onChange:bounds=>ctx.set({bounds}),hint:"Expands the scale to include the gray intervals. The followed run’s bound is always shown below."});
  const run=ctx.slider({label:"Run followed",...ctx.key("run"),format:formatCount,onInput:run=>ctx.set({run})});
  const seed=ctx.numberInput({label:"First seed",...ctx.key("seed"),onInput:seed=>ctx.set({seed})});
  const redraw=ctx.button({label:"Next seeds",title:"Repeat with the next first seed",onClick:()=>ctx.set({seed:seedAt(ctx.state.seed,2)})});
  const detail=h("div"),convergence=h("div"),convergenceNote=h("p",{class:"cj-note"});
  const convergenceTable=ctx.scrollRegion(h("div",{class:"cj-scroll"}),"Rerun summaries by draw count");
  const fold=h("section",{class:"cj-panel"});
  // review 044 repair (X-01, X-16): the cloud (base.js primaryGraphic) directly under the title, then its key for tied
  // selections, the run slider with the followed run's line, then the secondary settings (bounds, seed, Next seeds)
  const follow=h("p",{class:"cj-follow"});
  const tieKey=h("p",{class:"cj-tiekey","data-prx-part":"legend"},h("span",{},h("i",{class:"cj-hollow","aria-hidden":"true"}),"tied selection (first shown)"));
  ctx.primaryGraphic(main);
  ctx.charts.append(status,ctx.panelTitle("Each dot is that run’s own selected report"),main,tieKey,h("div",{class:"cj-run"},run.root,follow),showBounds.root,h("div",{class:"cj-line"},seed.root,redraw.root),mainNote,detail,ctx.panelTitle("As the draw count grows"),convergence,convergenceNote,convergenceTable,fold);
  const seedFor=(s,i)=>seedAt(s.seed,i+1);
  let job=null,figure=null;
  const cancel=()=>{job?.cancel?.();job=null;ctx.root.removeAttribute("aria-busy");};ctx.onCleanup(cancel);
  function rowsFor(s){return Array.from({length:CONFIG.runs},(_,i)=>({run:i+1,seed:seedFor(s,i),...selectionRun({...s,seed:seedFor(s,i)})}));}
  function ensure(s,levels){
   const tasks=[];for(const n of levels)for(let i=0;i<CONFIG.runs;i++){const st={...s,S:n,seed:seedFor(s,i)};if(!cache.has(keyOf(st)))tasks.push(()=>selectionRun(st));}
   // review 044 repair (X-12): every run's tied selections at the current draw count, staged with the reruns
   for(let i=0;i<CONFIG.runs;i++){const st={...s,seed:seedFor(s,i)};if(!tieCache.has(keyOf(st)))tasks.push(()=>tieRun(st));}
   const key=JSON.stringify([s.criteria,s.tau,s.cap,s.seed,s.S,levels]);
   if(!tasks.length){cancel();return true;}if(job?.key===key)return false;cancel();
   const j={key,tasks,cancel:null};job=j;ctx.root.setAttribute("aria-busy","true");status.textContent="Repeating selection and exact-law evaluation for these settings…";ctx.readout.set("Computing the reruns for the current settings. Figures below retain the last completed settings until the calculation finishes.");main.classList.add("cj-busy");
   const step=()=>{if(job!==j)return;const t=ctx.win.performance.now();while(j.tasks.length&&ctx.win.performance.now()-t<CONFIG.sliceMs)j.tasks.shift()();if(j.tasks.length)j.cancel=ctx.timeout(step,0);else{job=null;ctx.root.removeAttribute("aria-busy");ctx.requestRender("runs-ready");}};j.cancel=ctx.timeout(step,0);return false;
  }
  ctx.listen(main,"click",e=>{if(!figure||e.detail===0)return;const b=figure.svg.getBoundingClientRect(),x=figure.scale("x");const nativeWidth=Number(figure.svg.getAttribute("width"))||b.width;const value=x.invert?.((e.clientX-b.left)*nativeWidth/b.width);if(Number.isFinite(value))ctx.set({run:Math.max(1,Math.min(CONFIG.runs,Math.round(value)))});});
  function render(s){
   S.set(s.S);score.set(s.criteria);tau.set(s.tau);cap.set(s.cap);run.set(s.run);seed.set(s.seed);showBounds.set(s.bounds);
   const levels=[...new Set([...CONFIG.levels,s.S])].sort((a,b)=>a-b);if(!ensure(s,levels))return;
   status.textContent="";main.classList.remove("cj-busy");
   const rows=rowsFor(s),sum=summarizeRuns(rows),r=rows[s.run-1],followed={...s,seed:r.seed},d=detailFor(followed),best=bestFor(s);
   // review 044 repair (X-12): each run's tied selections (all of them) and the range of the "look worse" count
   const ties=rows.map(x=>tieRun({...s,seed:x.seed})),tr=tieRange(rows,ties);
   const width=Math.max(250,ctx.width()),data=rows.map((x,i)=>({...x,lower:-x.bound,upper:x.bound,tied:ties[i].tieCount>1}));
   // the review's replacement copy (G4-F8, X-12): the count's range over tie-breaking, the number of tied runs
   const tiedWords=[" tied selection",tr.tied===1?" is":"s are"," broken)"];
   const tieRangeWords=tr.tied===0?[]:tr.worseMin===tr.worseMax?[" (the same however the ",ro("tied-runs",tr.tied),...tiedWords]
    :[" (",ro("worse-min",tr.worseMin),"–",ro("worse-max",tr.worseMax)," depending on how the ",ro("tied-runs",tr.tied),...tiedWords];
   ctx.readout.set(["Across ",ro("runs",sum.n)," runs of ",ro("draws",s.S)," draws, ",ro("better",sum.better)," look better on their own draws and ",ro("worse",sum.worse)," look worse",...tieRangeWords,...(sum.same?["; ",ctx.num(sum.same,formatCount(sum.same))," have no gap"]:[]),"; mean signed gap ",ro("mean-gap",sum.gap,gapFormat),". A finite set of ",ctx.num(sum.n,formatCount(sum.n))," reruns can have either sign; the expectation is ≤ ",ctx.num(0,formatCount(0))," under repeated IID sampling."]);
   // in the cloud (review 044 repair, X-01 and G4-F9): what the two sides of zero mean, the mean signed gap as a dashed
   // line with its value, hollow markers for tied selections. The two side labels sit in the frame's top and bottom
   // insets and the mean's label in the right margin at the end of its line ("mean" above, the value below), so no
   // label can cover a dot, the followed run's ring or a line
   const mean=sum.gap,narrow=width<560;
   const textWidth=t=>[...t].reduce((a,ch)=>a+(/[0-9]/.test(ch)?6.8:/[.,]/.test(ch)?3.4:7.2),0);
   const marginRight=Math.round(Math.max(textWidth(gapFormat(mean)),textWidth("mean"))+14);
   figure=plot(main,{width,height:265,marginLeft:63,marginRight,marginTop:16,marginBottom:40,x:{label:"Run (its report is chosen anew)",domain:[1,CONFIG.runs],ticks:5},y:{label:"Own-draw risk − exact-law risk",ticks:5,insetTop:16,insetBottom:18},
    alt:"Signed risk gaps over reruns. Each report is selected on that run’s draws and scored on those same draws and the exact law. Negative gaps look better on the selection draws."+(s.bounds?" Gray vertical intervals give each run’s deterministic discrepancy bound around zero.":" The discrepancy intervals are hidden to show the signed gaps in more detail."),
    table:{caption:"Each run’s selected report, its two risks and discrepancy bound",columns:[{label:"Run",value:"run",format:v=>formatCount(v)},{label:"Seed",value:"seed",format:v=>formatCount(v)},{label:"Own-draw risk",value:"inSample",format:v=>formatRisk(v)},{label:"Exact-law risk",value:"exact",format:v=>formatRisk(v)},{label:"Signed gap",value:"gap",format:gapFormat},{label:"Absolute-gap bound",value:"bound",format:dec}],rows:data},
    marks:(c,P)=>{
     const halo={stroke:c.plotBg,strokeWidth:3,paintOrder:"stroke"},plain=data.filter(x=>!x.tied);
     return [...(s.bounds?[P.ruleX(data,{x:"run",y1:"lower",y2:"upper",stroke:c.wh,strokeOpacity:1,strokeWidth:1.5})]:[]),P.ruleY([0],{stroke:c.plotFg}),
      P.ruleY([mean],{stroke:c.plotFg,strokeDasharray:"5,4",strokeOpacity:.85}),
      P.dot(plain.filter(x=>x.gap<=0),{x:"run",y:"gap",fill:c.post,r:3}),P.dot(plain.filter(x=>x.gap>0),{x:"run",y:"gap",fill:c.err,r:3}),
      P.dot(data.filter(x=>x.tied),{x:"run",y:"gap",r:3.2,fill:c.plotBg,stroke:x=>x.gap>0?c.err:c.post,strokeWidth:1.6}),
      P.dot(data.filter(x=>x.run===s.run),{x:"run",y:"gap",r:6,fill:"none",stroke:c.plotFg,strokeWidth:1.8}),
      P.text([narrow?"↑ above zero: looks worse":"↑ above zero: looks worse on its own draws"],{frameAnchor:"top-left",lineAnchor:"top",dx:4,dy:2,text:t=>t,fill:c.plotFg,...halo}),
      P.text([narrow?"↓ below zero: looks better":"↓ below zero: looks better on its own draws"],{frameAnchor:"bottom-left",lineAnchor:"bottom",dx:4,dy:-2,text:t=>t,fill:c.plotFg,...halo}),
      P.text(["mean"],{x:()=>CONFIG.runs,y:()=>mean,text:t=>t,textAnchor:"start",dx:6,dy:-7,fill:c.plotFg}),
      numText([mean],{x:()=>CONFIG.runs,y:v=>v,value:v=>v,format:gapFormat,textAnchor:"start",dx:6,dy:7,fill:c.plotFg})];
    },
    keyboard:{data,x:"run",y:"gap",sort:false,key:x=>String(x.run),title:x=>`Run ${x.run}, seed ${x.seed}: own-draw risk ${formatRisk(x.inSample)}, exact-law risk ${formatRisk(x.exact)}, signed gap ${gapFormat(x.gap)}, absolute-gap bound ${dec(x.bound)}.`},
   });
   mainNote.replaceChildren("Blue points have lower risk on their own draws than under the exact law. Orange points have higher risk. ",s.bounds?"Gray intervals: ±(N/M)δ for each run. ":"Show the bounds to compare each gap with its discrepancy interval. ","The ring marks the selected run. Click a point or use Run followed to select it, or use the arrow keys to read the points. Different runs can select different reports.");
   const rf=formatRisk(r.inSample)===formatRisk(r.exact)&&r.inSample!==r.exact?v=>formatRisk(v,{digits:5}):formatRisk;
   // the followed run in one line, next to the run slider under the cloud (review 044 repair, X-16 and G4-F9)
   const t=ties[s.run-1],lo=t.gaps?Math.min(...t.gaps):0,hi=t.gaps?Math.max(...t.gaps):0;
   const tieBits=t.tieCount>1?[" · ",ctx.num(t.tieCount,formatCount(t.tieCount))," tied reports (gaps ",...(t.gaps.length<=4?t.gaps.flatMap((g,i)=>[i?", ":"",ctx.num(g,gapFormat(g))]):["from ",ctx.num(lo,gapFormat(lo))," to ",ctx.num(hi,gapFormat(hi))]),")"]:[];
   follow.replaceChildren("Run ",ro("follow-run",s.run)," (seed ",ro("follow-seed",r.seed),"): own-draw risk ",ro("follow-in-sample",r.inSample,rf)," against exact ",ro("follow-exact",r.exact,rf),", so gap ",ro("follow-gap",r.gap,gapFormat),"; |gap| ≤ ",ro("follow-bound",r.bound,dec),...tieBits);
   const card=h("section",{class:"cj-panel"},ctx.panelTitle("This run’s chosen report"),h("p",{},"Run ",ro("run",s.run),", seed ",ro("run-seed",r.seed),"; input order ",IDS.join(", "),": ",ro("grade",r.grade,formatGrades),"."),h("p",{},blocksText(r.grade,IDS)),tagNode(ctx,d.opt),h("p",{class:"cj-note"},"For the estimated probabilities from this run. States ",ro("N",r.N)," of ",ctx.num(M,formatCount(M))," pair directions."),h("p",{},"Own-draw risk ",ro("in-sample",r.inSample,rf),"; exact-law risk of this same report ",ro("exact",r.exact,rf),"."),h("p",{},"Signed gap ",ro("gap",r.gap,gapFormat),"; absolute gap ≤ ",ro("bound",r.bound,dec),"."),captionNode(ctx,"fixed-report"));
   const bounds=h("section",{class:"cj-panel"},ctx.panelTitle("What the bounds compare"),h("p",{},s.criteria==="AB"?"For each score, take the maximum absolute difference between a draw-estimated wrong-direction probability and its exact-law value over all ordered distinct pairs. δ = ":"δ = ",ro("delta",r.deltaW,dec),s.criteria==="AB"?" is the equally weighted average of those per-score maxima.":" is the maximum absolute difference between a draw-estimated wrong-direction probability and its exact-law value over all ordered distinct pairs."),h("p",{class:"cj-note"},"This observed discrepancy uses the known exact law. The dashed convergence curve instead shows a predeclared simultaneous coefficient radius. N counts stated pairs; M counts all pairs."),h("p",{},"Same report, two probability arrays: |own-draw risk − exact-law risk| ≤ (N/M)δ."),h("p",{},"Exact-law minimum in this family ",ro("best",r.best,formatRisk),". Selected report’s exact regret ",ro("regret",r.regret,formatRisk)," ≤ ",ro("uniform",r.uniformBound,dec)," (",ctx.num(2,formatCount(2)),"δ + η)."),h("p",{class:"cj-note"},"The sharper bound using both disclosure counts is ",ro("sharp",r.sharpBound,dec),". η is an absolute optimization allowance for the draw-based problem; enumeration uses equal-risk tolerance ",ro("eta",r.eta,formatSci),". It bounds numerical risk error, not posterior spread."),h("p",{},"Exact-law reference: ",ro("best-grade",Array.from(best.grade),formatGrades)," in input order ",IDS.join(", "),"."),tagNode(ctx,best));
   detail.replaceChildren(h("div",{class:"cj-grid"},card,bounds));
   if(d.opt.tieCount>1){
    const tie=h("p",{class:"cj-note"},ctx.num(d.opt.tieCount,formatCount(d.opt.tieCount))," reports share the smallest draw-based risk within equal-risk tolerance ",ctx.num(d.opt.tieTol,formatSci(d.opt.tieTol)),"; the first is followed. Exact-law risks can differ between them.");detail.append(tie);
    const table=ctx.scrollRegion(h("div",{class:"cj-scroll"}),"Tied draw-based optima evaluated under the exact law");
    table.append(h("table",{class:"cj-table cj-wide"},h("thead",{},h("tr",{},...["Report in input order","Stated pairs","Own-draw risk","Exact-law risk","Signed gap"].map(t=>h("th",{scope:"col"},t)))),h("tbody",{},...d.alternatives.map(a=>h("tr",{},h("td",{},ctx.num(a.grade,formatGrades(a.grade))),h("td",{},ctx.num(a.N,formatCount(a.N))),h("td",{},ctx.num(a.inSample,rf(a.inSample))),h("td",{},ctx.num(a.exact,rf(a.exact))),h("td",{},ctx.num(a.gap,gapFormat(a.gap))))))));detail.append(table);
    if(d.opt.tieCount>d.alternatives.length)detail.append(h("p",{class:"cj-note"},"First ",ctx.num(d.alternatives.length,formatCount(d.alternatives.length))," representatives listed; ",ctx.num(d.opt.tieCount-d.alternatives.length,formatCount(d.opt.tieCount-d.alternatives.length))," more share the minimum."));
   }
   if(best.tieCount>1)detail.append(h("p",{class:"cj-note"},ctx.num(best.tieCount,formatCount(best.tieCount))," reports share the exact-law minimum within equal-risk tolerance ",ctx.num(best.tieTol,formatSci(best.tieTol)),"; its first representative is shown."));
   const curve=levels.map(n=>({S:n,...summarizeRuns(rowsFor({...s,S:n})),radius:envelopeFor(s.criteria,n).deltaW}));
   plot(convergence,{width,height:220,marginLeft:55,marginRight:20,marginTop:15,marginBottom:40,x:{type:"log",domain:[Math.min(...levels),4000],ticks:levels,label:"Draws in each run S"},y:{label:"Risk discrepancy",ticks:4,domain:[0,Math.max(...curve.map(d=>Math.max(d.radius,d.bound,d.absolute)))*1.06]},
    alt:"As the draw count increases, compare the mean absolute signed gap, mean deterministic gap bound, and the simultaneous coefficient radius. The same seed sequence is used at each size; rerun sets across sizes overlap and are not independent replications.",
    table:{caption:"Mean absolute gaps and discrepancy bounds by draw count",columns:[{label:"Draws",value:"S",format:v=>formatCount(v)},{label:"Mean absolute gap",value:"absolute",format:dec},{label:"Mean deterministic bound",value:"bound",format:dec},{label:"Simultaneous radius",value:"radius",format:dec}],rows:curve},
    marks:(c,P)=>[P.lineY(curve,{x:"S",y:"absolute",stroke:c.plotFg,strokeWidth:2}),P.dot(curve,{x:"S",y:"absolute",fill:c.plotFg}),P.lineY(curve,{x:"S",y:"bound",stroke:c.plotMuted,strokeDasharray:"2,3",strokeWidth:2}),P.lineY(curve,{x:"S",y:"radius",stroke:c.plotFg,strokeDasharray:"5,3",strokeWidth:2}),P.ruleX([s.S],{stroke:c.plotFg,strokeDasharray:"2,3",strokeOpacity:.5})],
    keyboard:{data:curve,x:"S",y:"absolute",sort:false,title:d=>`${d.S} draws: mean absolute gap ${dec(d.absolute)}, mean deterministic bound ${dec(d.bound)}, simultaneous radius ${dec(d.radius)}.`},
   });
   convergenceNote.replaceChildren(h("span",{class:"cj-legend","data-prx-part":"legend"},h("span",{},h("i",{class:"cj-key"}),"mean absolute gap"),h("span",{},h("i",{class:"cj-key cj-key-bound"}),"mean (N/M)δ"),h("span",{},h("i",{class:"cj-key cj-key-radius"}),"simultaneous coefficient radius")),"Each size repeats selection using the same seed sequence. Means and realized δ need not decrease at every step. The dashed radius shrinks with S; at each predeclared size it covers all pair errors with chance at least ",ctx.num(1-MC.alpha,"95%")," for independent draws. It also covers a report chosen on those draws; it is not a pointwise MCSE.");
   convergenceTable.replaceChildren(h("table",{class:"cj-table cj-wide"},h("thead",{},h("tr",{},...["Draws S","Mean signed gap","Mean absolute gap","Mean gap bound","Mean exact regret"].map(t=>h("th",{scope:"col"},t)))),h("tbody",{},...curve.map(v=>h("tr",{},h("th",{scope:"row"},ctx.num(v.S,formatCount(v.S))),h("td",{},ctx.num(v.gap,gapFormat(v.gap))),h("td",{},ctx.num(v.absolute,dec(v.absolute))),h("td",{},ctx.num(v.bound,dec(v.bound))),h("td",{},ctx.num(v.regret,dec(v.regret))))))));
   const F=CF.tables.folds,FG=CF.tables.fold_grades;
   fold.replaceChildren(ctx.panelTitle("The package’s separate fold-report view"),h("p",{class:"cj-note"},"A fixed cached toy example, separate from the six-site reruns above. Each fold chooses a report, then that same fold report is evaluated on the other half."),h("p",{class:"cj-note"},"Fixed package settings: τ ",ctx.num(CF.facts.tau,formatSetting(CF.facts.tau)),", at most ",ctx.num(CF.facts.G_max,formatCount(CF.facts.G_max))," grades; criterion weights ",ctx.num(CF.facts.weights.need_A,formatSetting(CF.facts.weights.need_A))," and ",ctx.num(CF.facts.weights.need_B,formatSetting(CF.facts.weights.need_B))," for need A and need B. ",captionNode(ctx,"package-quantity")));
   const foldTable=ctx.scrollRegion(h("div",{class:"cj-scroll"}),"Package cross-fitting: training-fold reports and their two evaluations");
   const foldRows=F.fold.map((f,i)=>h("tr",{},h("th",{scope:"row"},f),
    h("td",{},ctx.num(F.draws[i],formatCount(F.draws[i]))),h("td",{},ctx.num(FG[f],formatGrades(FG[f]))),
    h("td",{},ctx.num(F.in_fold_risk[i],formatRisk(F.in_fold_risk[i]))),
    h("td",{},ctx.num(F.out_of_fold_risk[i],formatRisk(F.out_of_fold_risk[i]))),
    h("td",{},ctx.num(F.optimism[i],gapFormat(F.optimism[i])))));
   foldTable.append(h("table",{class:"cj-table cj-wide"},
    h("thead",{},h("tr",{},...["Training fold","Draws","Report","In-fold risk","Other-fold risk","Other-fold risk − in-fold risk (package optimism)"].map(t=>h("th",{scope:"col"},t)))),
    h("tbody",{},...foldRows)));
   fold.append(foldTable,h("p",{class:"cj-note"},"Report input order: ",...FG.id.flatMap((id,i)=>[i?", ":"",h("span",{"data-prx-name":""},id)]),". Package optimism subtracts in-fold risk from other-fold risk, opposite to the main own-draw risk minus exact-law risk gap. Mean package optimism ",ro("fold-mean",CF.facts.mean_optimism,formatRisk),"; mean absolute optimism ",ro("fold-absolute",CF.facts.mean_abs_optimism,formatRisk),". These evaluate the fold reports, not the full-draw report. Neither summary corrects full-data risk or tests external calibration."));
   ctx.caption.replaceChildren(captionNode(ctx,"teaching-posterior")," Monte Carlo, ",ctx.num(s.S,formatCount(s.S))," draws per run, first seed ",ctx.num(s.seed,formatCount(s.seed)),"; ",ctx.num(CONFIG.runs,formatCount(CONFIG.runs))," consecutive seeds. Independent whole-state draws; all settings and the family are held fixed within a rerun set. Exact refers to the declared normal law. In repeated IID sampling the expected signed gap of an empirical risk minimizer is nonpositive; a finite set of runs can have either sign. MCMC effective sample sizes cannot replace the draw count in this envelope.");
  }
  return{render};
 }});
}
