// Four views of the search: exact family counts, binary relations, an inspected DP trace, and a lazy browser solve.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatExpectedCount, formatGrades, formatRisk, formatSci, formatSetting } from "../shared/format.js";
import { exposeResult, familyNameNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { loadSolver } from "../shared/solver-loader.js";
import { drawLeague, enumerateReports, errorArray, exactOptimum, familySize, finiteLawPairwise, fixedOrderDP, league30, normalPosterior, pairCount, weakRelation } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

const IDS = SIX.arrays.one.ids;
const E = { ids: IDS, criteria: SIX.arrays.one.criteria, e: SIX.arrays.one.e.map(m => m.map(r => r.map(v => v === null ? NaN : v))) };
const SCORES = SIX.tables.units.mean_A;
const PATTERNS = Array.from(enumerateReports(3, { kind: "all" }));
const COUNT_FAMILIES = [
  { kind: "All reports", ink: "plotFg", dash: null, symbol: "circle" },
  { kind: "Capped reports", ink: "plotMuted", dash: "8 3", symbol: "square" },
  { kind: "Cuts of one order", ink: "plotFg", dash: "2 3", symbol: "diamond" },
];
const SEED = 20261030;
const LEAGUE = league30();
const DRAW = drawLeague(SEED);
const POSTERIOR = normalPosterior(DRAW.estimate, LEAGUE.se, { priorMean: 0, priorSd: .15 });
// The finite law in ch. 14: the families in the bound counterexample are deliberately different.
const BOOK = finiteLawPairwise([[[4,4],[3,2],[2,3],[1,1]], [[3,1],[4,2],[2,3],[1,4]]], [.75,.25], { ids: ["A","B","C","D"], criteria: ["first","second"] });
const BOOK_EXACT = fixedOrderDP(BOOK, { order:[0,1,2,3], G:4, exact:4, tau:.25, w:[.6,.4] });
const BOOK_CAP = fixedOrderDP(BOOK, { order:[0,1,2,3], G:4, tau:.25, w:[.6,.4] });

const CSS = `.prx-cg .prx-cg-count-key{width:2.3rem;height:1rem;flex:none}.prx-cg .prx-cg-count-legend{margin:.4rem 0}.prx-cg .prx-cg-count-legend .prx-key{color:var(--prx-plot-fg)}.prx-cg .prx-cg-count-legend .prx-cg-count-muted{color:var(--prx-plot-muted)}.prx-cg .prx-scroll-region{overflow-x:auto;max-width:100%;min-width:0}.prx-cg .prx-cg-body{min-width:0}.prx-cg .prx-cg-note{font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0 .7rem}.prx-cg .prx-cg-controls{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:end}.prx-cg .prx-cg-controls>*{flex:1 1 12rem}.prx-cg .prx-cg-controls[hidden],.prx-cg [hidden]{display:none!important}.prx-cg .prx-cg-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.prx-cg .prx-cg-actions [aria-disabled=true]{opacity:.55;cursor:default}.prx-cg .prx-cg-table{border-collapse:collapse;width:100%;font-size:.85em;font-variant-numeric:tabular-nums;margin:.5rem 0}.prx-cg .prx-cg-table th,.prx-cg .prx-cg-table td{border:1px solid var(--prx-border);padding:.45rem .5rem;text-align:right;white-space:nowrap}.prx-cg .prx-cg-table caption{text-align:left;font-weight:600;margin:.3rem 0}.prx-cg .prx-cg-table th{color:var(--prx-fg-heading);font-weight:600}.prx-cg .prx-cg-table .prx-cg-current{outline:3px solid var(--prx-accent);outline-offset:-3px;font-weight:700}.prx-cg .prx-cg-table .prx-cg-path{background:var(--prx-bg-raised);box-shadow:inset 0 -3px var(--prx-border-strong)}.prx-cg .prx-cg-table .prx-cg-blank{color:var(--prx-fg-muted);font-size:.85em}.prx-cg .prx-cg-small{max-width:27rem}.prx-cg .prx-cg-summary{border-left:3px solid var(--prx-accent);padding:.25rem .75rem;margin:.6rem 0}.prx-cg .prx-cg-summary p{margin:.25rem 0}.prx-cg .prx-cg-details{margin-top:.7rem}.prx-cg .prx-cg-formula{overflow-x:auto;padding:.25rem 0}.prx-cg .prx-cg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1rem}.prx-cg .prx-cg-status{table-layout:fixed}.prx-cg .prx-cg-status th{text-align:left;white-space:normal;overflow-wrap:normal;width:42%}.prx-cg .prx-cg-status td .prx-num{white-space:normal;overflow-wrap:anywhere}.prx-cg .prx-cg-status td{white-space:normal;overflow-wrap:anywhere}.prx-cg .prx-cg-patterns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:.25rem;list-style:none;padding:0;font-size:.85em}.prx-cg .prx-cg-patterns li{break-inside:avoid;padding:.2rem}.prx-cg .prx-cg-patterns .active{font-weight:700;outline:1px solid var(--prx-border-strong)}@container(max-width:30rem){.prx-cg .prx-cg-patterns{columns:2}.prx-cg .prx-cg-table th,.prx-cg .prx-cg-table td{padding:.4rem}.prx-cg .prx-cg-controls>*{flex-basis:100%}}`;

/** The actual click-only browser workflow, shared with the local-input tool.
 * getProblem returns {E, options, key}; the opaque key belongs to the caller's input/settings snapshot.
 * invalidate suppresses an obsolete result while the outstanding worker finishes; it does not start another solve.
 */
export function createBrowserSolveController(ctx, { getProblem, onResult = () => {}, onError = () => {}, onBusy = () => {}, label = "Load HiGHS and solve", key = "solver:solve" } = {}) {
  if (typeof getProblem !== "function") throw new TypeError("getProblem must supply a solver problem");
  let running = false, closed = false, epoch = 0, available = true, hasResult = false;
  const button = ctx.button({ label, primary: true, key, onClick: run });
  button.root.setAttribute("data-prx-solve", "");
  function refresh(next = {}) {
    if ("available" in next) available = Boolean(next.available);
    if ("hasResult" in next) hasResult = Boolean(next.hasResult);
    button.root.setAttribute("aria-disabled", String(!available || running));
    button.root.textContent = running ? "Solving in the worker…" : hasResult ? "Solve again" : label;
  }
  async function run() {
    if (closed || running || !available) return;
    const problem = getProblem();
    if (!problem) return;
    const ticket = ++epoch;
    running = true; refresh(); onError(null); onBusy(true);
    try {
      const solver = await loadSolver({ win: ctx.win });
      const ready = await solver.ready;
      const result = await solver.mipSolve(problem.E, problem.options);
      if (!closed && ticket === epoch) onResult({ ...result, highs: ready.highs }, problem.key);
    } catch (error) {
      if (!closed && ticket === epoch) onError(String(error?.message ?? error));
    } finally {
      running = false;
      if (!closed) { refresh(); onBusy(false); }
    }
  }
  ctx.onCleanup(() => { closed = true; epoch++; });
  return { root: button.root, run, refresh, invalidate() { epoch++; }, get running() { return running; } };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name:"computing-grades", className:"prx-cg", css:CSS, title:"What does each search cover?",
    keys:{
      view:{type:"choice",values:["count","encoding","dp","solver"],value:"dp"},
      n:{type:"integer",min:2,max:12,step:1,value:6},
      cap:{type:"integer",min:1,max:6,step:1,value:3},
      tau:{type:"number",min:.02,max:.5,step:.01,value:.2},
      pattern:{type:"integer",min:0,max:12,step:1,value:0},
      invalid:{type:"boolean",value:false},
      step:{type:"integer",min:0,max:21,step:1,value:15},
      solverN:{type:"integer",min:3,max:20,step:1,value:20},
      timeLimit:{type:"number",min:.1,max:3,step:.1,value:2},
    },
    build(ctx) {
      const {h} = ctx;
      let current, lastError=null;
      const exactCache=new Map(), dpCache=new Map(), results=new Map();
      const ro=(key,v,f=formatCount)=>{const x=ctx.num(v,f(v)); x.setAttribute("data-prx-readout",key);return x;};
      const p=(...parts)=>h("p",{class:"prx-cg-note"},...parts);
      const formula=(tex)=>{const x=h("div",{class:"prx-cg-formula"}), f=formulaNums();const source=tex.replace(/\d+/g,v=>f.num(Number(v),formatCount(Number(v))));renderTex(x,source,{display:true,nums:f.raws});ctx.scrollRegion(x,"Mathematical expression");return x;};
      const table=(caption,heads,rows,attrs={})=>h("table",{class:"prx-cg-table",...attrs},h("caption",{},caption),h("thead",{},h("tr",{},...heads.map(x=>h("th",{scope:"col"},x)))),h("tbody",{},...rows.map(r=>h("tr",{},...r.map((x,i)=>h(i?"td":"th",i?{}:{scope:"row"},x))))));
      const scroll=(node,label)=>{const x=h("div",{},node);ctx.scrollRegion(x,label);return x;};
      const detail=(title,...nodes)=>h("section",{class:"prx-cg-details"},ctx.panelTitle(title),...nodes);
      const getDP=s=>{const k=`${s.cap}/${s.tau}`;if(!dpCache.has(k))dpCache.set(k,fixedOrderDP(E,{scores:SCORES,G:s.cap,tau:s.tau,trace:true}));return dpCache.get(k);};
      const getExact=s=>{const k=`${s.cap}/${s.tau}`;if(!exactCache.has(k))exactCache.set(k,exactOptimum(E,{family:{kind:"atMost",G:s.cap},tau:s.tau}));return exactCache.get(k);};
      const solverKey=s=>`${s.solverN}/${s.tau}/${s.timeLimit}`;
      const solverModel=s=>{
        const ids=LEAGUE.ids.slice(0,s.solverN), mean=POSTERIOR.mean.slice(0,s.solverN), sd=POSTERIOR.sd.slice(0,s.solverN);
        return {ids,mean,sd,E:errorArray(mean,sd,{ids,criteria:["score"]})};
      };
      const view=ctx.segmented({label:"Search view",name:"view",value:ctx.state.view,options:[{value:"count",label:"Family sizes"},{value:"encoding",label:"Binary encoding"},{value:"dp",label:"Dynamic program"},{value:"solver",label:"Joint solver"}],onChange:v=>ctx.set({view:v})});
      const n=ctx.slider({label:"Units in the count",name:"n",...ctx.key("n"),onInput:v=>ctx.set({n:v})});
      const cap=ctx.slider({label:"At most this many grades",name:"cap",...ctx.key("cap"),onInput:v=>ctx.set({cap:v})});
      const tau=ctx.slider({label:"Withholding cost τ",name:"tau",...ctx.key("tau"),onInput:v=>ctx.set({tau:v})});
      const pat=ctx.slider({label:"Valid report pattern (zero-based index)",name:"pattern",...ctx.key("pattern"),onInput:v=>ctx.set({pattern:v,invalid:false})});
      const invalid=ctx.toggle({label:"Show a transitivity violation",name:"invalid",checked:false,onChange:v=>ctx.set({invalid:v})});
      const sn=ctx.slider({label:"First units of the frozen league",name:"solverN",...ctx.key("solverN"),onInput:v=>ctx.set({solverN:v})});
      const limit=ctx.slider({label:"Solver time limit (seconds)",name:"timeLimit",...ctx.key("timeLimit"),onInput:v=>ctx.set({timeLimit:v})});
      const common=h("div",{class:"prx-cg-controls"},cap.root,tau.root);
      const countControls=h("div",{class:"prx-cg-controls"},n.root);
      const binaryControls=h("div",{class:"prx-cg-controls"},pat.root,invalid.root);
      const solverControls=h("div",{class:"prx-cg-controls"},sn.root,limit.root);
      ctx.controls.append(view.root,countControls,common,binaryControls,solverControls);
      const body=h("div",{class:"prx-cg-body"});
      const solver = createBrowserSolveController(ctx, {
        getProblem() { if (!current) return null; const state = { ...current }; return { E: solverModel(state).E, options: { tau: state.tau, timeLimit: state.timeLimit }, key: solverKey(state) }; },
        onResult(result, key) { results.set(key, result); },
        onError(error) { lastError = error; },
        onBusy(busy) { if (busy) ctx.root.setAttribute("aria-busy", "true"); else ctx.root.removeAttribute("aria-busy"); ctx.requestRender(busy ? "solver-start" : "solver-result"); },
      });
      const solverIntro=p();
      const solverAction=h("div",{},solverIntro,h("div",{class:"prx-cg-actions"},solver.root));
      ctx.charts.append(solverAction,body);

      function counts(s){
        const rows=Array.from({length:11},(_,i)=>{const n=i+2;return {n,all:familySize(n,{kind:"all"}),capped:familySize(n,{kind:"atMost",G:Math.min(s.cap,n)}),ordered:familySize(n,{kind:"order",order:Array.from({length:n},(_,j)=>j),G:Math.min(s.cap,n)})};});
        const selected=rows[s.n-2];
        const points=rows.flatMap(r=>[{n:r.n,size:Number(r.all),kind:"All reports"},{n:r.n,size:Number(r.capped),kind:"Capped reports"},{n:r.n,size:Number(r.ordered),kind:"Cuts of one order"}]);
        const slot=h("div"),legend=h("div",{class:"prx-legend prx-cg-count-legend","data-prx-part":"legend"});
        for(const f of COUNT_FAMILIES){
          const svg=ctx.doc.createElementNS("http://www.w3.org/2000/svg","svg");
          svg.setAttribute("viewBox","0 0 37 16");svg.setAttribute("class","prx-cg-count-key");svg.setAttribute("aria-hidden","true");
          const mark=(tag,attrs)=>{const node=ctx.doc.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.append(node);};
          mark("line",{x1:0,y1:8,x2:37,y2:8,stroke:"currentColor","stroke-width":2,...(f.dash?{"stroke-dasharray":f.dash}:{})});
          const shape=f.symbol==="circle"?["circle",{cx:18.5,cy:8,r:3}]:f.symbol==="square"?["rect",{x:15.5,y:5,width:6,height:6}]:["path",{d:"M18.5 3.5 23 8 18.5 12.5 14 8Z"}];
          mark(shape[0],{...shape[1],fill:"var(--prx-plot-bg)",stroke:"currentColor","stroke-width":1.5});
          legend.append(h("span",{class:`prx-key${f.ink==="plotMuted"?" prx-cg-count-muted":""}`},svg,f.kind));
        }
        body.append(slot,legend);
        plot(slot,{height:310,marginLeft:72,marginBottom:45,x:{label:"Units",ticks:6,domain:[2,12]},y:{label:"Reports (log scale)",type:"log",domain:[1,1e11],ticks:[1,1e2,1e4,1e6,1e8,1e10],grid:true},marks:(c,P)=>[P.ruleX([s.n],{stroke:c.plotMuted,strokeDasharray:"3 3"}),...COUNT_FAMILIES.flatMap(f=>{const data=points.filter(r=>r.kind===f.kind);return[P.line(data,{x:"n",y:"size",stroke:c[f.ink],strokeWidth:2,strokeDasharray:f.dash}),P.dot(data,{x:"n",y:"size",symbol:f.symbol,fill:c.plotBg,stroke:c[f.ink],strokeWidth:1.5,r:3})];})],table:{caption:"Exact numbers of reports by units and family",columns:[{label:"Units",value:"n",format:formatCount},{label:"All",value:"all",format:formatCount},{label:"At most the selected grade cap",value:"capped",format:formatCount},{label:"Contiguous cuts",value:"ordered",format:formatCount}],rows},keyboard:{data:points,x:"n",y:"size",title:r=>`${formatCount(r.n)} units, ${r.kind}: ${formatCount(r.size)} reports.`}});
        const t=table("Exact counts (the cap cannot exceed the number of units)",["Units","All reports","Capped","One order"],rows.map(r=>[ctx.num(r.n,formatCount),ctx.num(r.all,formatCount),ctx.num(r.capped,formatCount),ctx.num(r.ordered,formatCount)]));
        body.append(p("The vertical axis is logarithmic: equal vertical steps multiply the number of reports. Capped counts allow at most ",ctx.num(s.cap,formatCount)," grades; cuts keep a declared strict order."),detail("Inspect the exact counts",scroll(t,"Family count table")));
        ctx.readout.set(["With ",ro("count-n",s.n)," units: ",ro("count-all",selected.all)," unrestricted reports; ",ro("count-capped",selected.capped)," with at most ",ctx.num(s.cap,formatCount)," grades; ",ro("count-order",selected.ordered)," cuts of one order."]);
      }

      function encoding(s){
        const g=PATTERNS[s.pattern], relation=weakRelation(g);
        const z=s.invalid?[[NaN,1,1],[1,NaN,1],[0,1,NaN]]:relation.z;
        const grid=table("Row unit in the same grade as, or higher than, column unit",["zᵢⱼ","A","B","C"],["A","B","C"].map((id,i)=>[id,...z[i].map((v,j)=>i===j?"—":ro(`z-${i}-${j}`,v))]),{"data-prx-binary":""});
        grid.classList.add("prx-cg-small");body.append(grid);
        body.append(p("A directed bit zᵢⱼ is ",ctx.num(1,formatCount)," when i is in the same grade as j or higher, and ",ctx.num(0,formatCount)," otherwise. A shared grade sets both directions to ",ctx.num(1,formatCount),"; it makes no equality claim about the true values."));
        body.append(formula("z_{ij}+z_{ji}\\geq 1,\\qquad z_{ij}+z_{jk}-z_{ik}\\leq 1"));
        if(s.invalid){
          body.append(h("div",{class:"prx-cg-summary"},p("Completeness holds for every pair. Transitivity fails: C is no lower than B and B no lower than A, yet C is below A."),p("For (i, j, k) = (C, B, A): ",ctx.num(z[2][1],formatCount)," + ",ctx.num(z[1][0],formatCount)," − ",ctx.num(z[2][0],formatCount)," = ",ro("violation",z[2][1]+z[1][0]-z[2][0])," > ",ctx.num(1,formatCount),". No grade vector has this pattern.")));
          ctx.readout.set(["This complete pattern is not transitive. It is not a report."]);
        }else{
          body.append(p("Grade vector in A, B, C order: ",ro("binary-grade",g,formatGrades),"; ",h("strong",{},blocksText(g,["A","B","C"])),". Completeness and transitivity both hold."));
          ctx.readout.set([ro("pattern-count",PATTERNS.length)," valid binary patterns are the ",ctx.num(familySize(3,{kind:"all"}),formatCount)," reports on three units. Both directions set to one mean a shared grade."]);
        }
        const list=h("ul",{class:"prx-cg-patterns"},...PATTERNS.map((g,i)=>h("li",{class:!s.invalid&&i===s.pattern?"active":""},ctx.num(i,formatCount),": ",ctx.num(g,formatGrades)," · ",blocksText(g,["A","B","C"]))));
        body.append(detail("All valid patterns",list));
      }

      function dp(s,previousScrollLeft=0){
        const d=getDP(s), x=getExact(s), t=d.trace;
        const cells=[];for(let h=1;h<t.V.length;h++)for(let c=1;c<t.V[h].length;c++)if(t.V[h][c]!==null)cells.push({h,c});
        const step=Math.min(s.step,cells.length);if(s.step!==step)ctx.set({step});
        const seen=new Set(cells.slice(0,step).map(v=>`${v.h}/${v.c}`)), here=cells[step-1];
        const path=new Set(t.path.map(v=>`${v.h}/${v.c}`));
        body.append(h("div",{class:"prx-cg-summary", "data-prx-dp-answer":""},h("p",{},h("strong",{},"Current answer: "),blocksText(d.grade,IDS),"; risk ",ro("dp-answer-risk",d.risk,formatRisk),"."),h("p",{},"Posterior-mean order: ",ro("dp-answer-order-size",d.family.size)," contiguous reports. Full capped family: ",ro("dp-answer-capped-size",x.family.size)," reports, risk ",ro("dp-answer-capped-risk",x.risk,formatRisk),".")));
        const reset=ctx.button({label:"Start table",key:"dp-start",onClick:()=>ctx.set({step:0})});
        const next=ctx.button({label:"Next cell",key:"dp-next",onClick:()=>ctx.set({step:Math.min(step+1,cells.length)})});next.root.setAttribute("aria-disabled",String(step>=cells.length));
        const all=ctx.button({label:"Fill table",key:"dp-fill",onClick:()=>ctx.set({step:cells.length})});
        body.append(h("div",{class:"prx-cg-actions"},reset.root,next.root,all.root),p("Filled ",ro("dp-step",step)," of ",ro("dp-cells",cells.length)," feasible cells. Rows fix the number of grades h; columns take the first c sites in posterior-mean order A, B, C, D, E, F."));
        if(here)body.append(p("Current cell h = ",ctx.num(here.h,formatCount),", c = ",ctx.num(here.c,formatCount),"; last cut b = ",ro("dp-last-cut",t.pred[here.h][here.c]),"."));
        body.append(p("For the sites in a cell, saving is the expected cost of stating their fixed-order pair directions minus the cost after withholding within grades. A negative saving means withholding costs more. These are total cost differences; divide by the full pair count M to express a full-report risk difference."));
        const tab=table("Vₕ(c): greatest saving from h consecutive grades",["h \\ c",...t.V[0].map((_,c)=>ctx.num(c,formatCount))],t.V.map((row,h)=>[ctx.num(h,formatCount),...row.map((v,c)=>{
          const key=`${h}/${c}`, filled=h===0&&c===0||seen.has(key);
          const node=h===0&&c===0?ro("dp-origin",v,formatExpectedCount):v===null?hNode("unreachable"):filled?ro(`dp-${h}-${c}`,v,formatExpectedCount):hNode("·");
          return ctx.h("span",{class:`${step===cells.length&&path.has(key)?"prx-cg-path ":""}${here?.h===h&&here?.c===c?"prx-cg-current":""}`},node);
        })]));
        // Style the table cell, not only its text, so the trace remains legible on a narrow display.
        for(const span of tab.querySelectorAll(".prx-cg-current,.prx-cg-path")){span.parentElement.className=span.className;span.className="";}
        tab.caption.classList.add("prx-sr-only");
        const tableScroll=scroll(tab,"Dynamic programming savings table");tableScroll.setAttribute("data-prx-dp-scroll","");tableScroll.setAttribute("data-prx-focus-key","dp-table");body.append(ctx.panelTitle("Vₕ(c): greatest saving from h consecutive grades"),tableScroll);
        // Move only the table horizontally; scrolling an element into view would also move the page.
        tableScroll.scrollLeft=previousScrollLeft;
        const activeCell=tab.querySelector(".prx-cg-current");
        if(activeCell&&tableScroll.clientWidth>0){
          const box=tableScroll.getBoundingClientRect(),cell=activeCell.getBoundingClientRect(),pad=4;
          if(cell.right>box.right-pad)tableScroll.scrollLeft+=cell.right-box.right+pad;
          else if(cell.left<box.left+pad)tableScroll.scrollLeft+=cell.left-box.left-pad;
        }
        body.append(formula("W(b,c)=\\sum_{b<s<t\\le c}(\\bar e_{\\rho_s\\rho_t}-\\tau),\\qquad V_h(c)=\\max_{h-1\\le b<c}\\{V_{h-1}(b)+W(b,c)\\}"));
        body.append(p("W(b,c) totals the saving inside the next grade. An unreachable cell has no feasible partition; the empty starting state has saving ",ctx.num(0,formatCount),". Outlined: the current cell. Underlined when complete: the chosen backtrack."));
        if(here){
          const candidates=[];for(let b=here.h-1;b<here.c;b++)if(t.V[here.h-1][b]!==null)candidates.push({b,previous:t.V[here.h-1][b],block:t.W[b][here.c],total:t.V[here.h-1][b]+t.W[b][here.c]});
          body.append(detail("Inspect the current cell's alternatives",p("Current h = ",ctx.num(here.h,formatCount),", c = ",ctx.num(here.c,formatCount),". The engine chooses b = ",ro("dp-predecessor",t.pred[here.h][here.c]),"."),scroll(table("Every possible last cut b",["b","Previous saving","New block saving","Total"],candidates.map(v=>[ctx.num(v.b,formatCount),ctx.num(v.previous,formatExpectedCount),ctx.num(v.block,formatExpectedCount),ctx.num(v.total,formatExpectedCount)])),"Current cell alternatives")));
        }
        const result=h("div",{class:"prx-cg-summary"},h("p",{},tagNode(ctx,d,{orderWords:"posterior-mean order"}),"; risk ",ro("dp-risk",d.risk,formatRisk),"; ",ro("dp-grades",d.grade,formatGrades)," · ",blocksText(d.grade,IDS)),h("p",{},labelNode(ctx,d,{key:"dp"})," in ",familyNameNode(ctx,d)," (",familySizeNode(ctx,d)," contiguous reports)."),h("p",{},labelNode(ctx,x,{key:"enumerated"})," (",familySizeNode(ctx,x)," reports); risk ",ro("exact-risk",x.risk,formatRisk),"; ",ro("exact-grades",x.grade,formatGrades),"."));
        if(d.tieCount>1)result.append(p(ctx.num(d.tieCount,formatCount)," reports share the smallest risk within this order; read-outs show the first. Equal-risk tolerance ",ctx.num(d.tieTol,formatSci),"."));
        if(x.tieCount>1)result.append(p(ctx.num(x.tieCount,formatCount)," reports share the smallest risk in the capped family; read-outs show the first. Equal-risk tolerance ",ctx.num(x.tieTol,formatSci),"."));
        body.append(result,p("The answer is shown throughout; the step buttons inspect the calculation. Here enumeration agrees with the fixed-order answer. That agreement does not hold for every posterior."));
        const strip=h("div");body.append(strip);
        const points=IDS.map((id,i)=>({id,position:i+1,grade:d.grade[i]}));
        plot(strip,{height:120,marginLeft:40,marginBottom:35,x:{domain:IDS,label:"Posterior-mean order"},y:{domain:[.5,Math.max(...d.grade)+.5],reverse:true,ticks:Math.max(...d.grade),label:"Grade"},marks:(_,P)=>[P.line(points,{x:"id",y:"grade",stroke:"var(--prx-post)"}),P.dot(points,{x:"id",y:"grade",fill:"var(--prx-post)",r:5}),numText(points,{x:"id",y:"grade",dy:-12,value:"grade",format:formatCount})],alt:"Best contiguous grades for the six sites, in the posterior-mean order.",keyboard:{data:points,x:"id",y:"grade",title:r=>`${r.id}: grade ${formatCount(r.grade)}.`}});
        body.append(detail("Risk from the final savings and grade count",formula("R=\\tau+(T-V)/M,\\qquad T=W(0,n)"),p("T = ",ro("dp-T",t.T,formatExpectedCount),", selected V = ",ro("dp-V",t.V[t.chosenG][IDS.length],formatExpectedCount),", M = ",ctx.num(t.M,formatCount),". Among exactly h-grade solutions, the lowest risk uses ",ctx.num(t.chosenG,formatCount)," grades."),table("Best risk for each exact grade count",["h","Risk"],t.riskByG.slice(1).map((r,i)=>[ctx.num(i+1,formatCount),ctx.num(r,formatRisk)])),p("Equal-risk tolerance ",ctx.num(1e-12,formatSci),"; the engine favors fewer grades, then earlier cuts. Exactly equal scores stay in the same grade.")));
        ctx.readout.set(["Posterior-mean cuts: ",ctx.num(d.family.size,formatCount)," reports, risk ",ctx.num(d.risk,formatRisk),". Full capped family: ",ctx.num(x.family.size,formatCount)," reports, risk ",ctx.num(x.risk,formatRisk),"."]);
        function hNode(text){return ctx.h("span",{class:"prx-cg-blank"},text);}
      }

      function solverView(s){
        const m=solverModel(s), d=fixedOrderDP(m.E,{scores:m.mean,tau:s.tau});
        const r=results.get(solverKey(s));
        solver.refresh({ hasResult: Boolean(r) });
        solverIntro.replaceChildren("A joint search over every report on the first ",ctx.num(s.solverN,formatCount)," league units, without a grade cap. Frozen draw seed ",ctx.num(SEED,formatCount),"; normal prior mean ",ctx.num(0,formatSetting),", SD ",ctx.num(.15,formatSetting),". The browser loads HiGHS only when you press the button.");
        const fallback=h("div",{class:"prx-cg-summary"},h("p",{},"Before the joint search: ",labelNode(ctx,d,{key:"league-dp"})," in ",familyNameNode(ctx,d),"; risk ",ro("solver-dp-risk",d.risk,formatRisk)," (",familySizeNode(ctx,d)," contiguous reports)."),p("This feasible report supplies an upper limit on the unrestricted optimum. Its fixed-order optimum supplies no lower limit for that larger family."));
        body.append(fallback);
        if(r){
          exposeResult(ctx,r,"solver");
          const heads=table("Joint solver result",["Quantity","Value"],[
            ["Status",h("span",{"data-prx-solver-status":""},r.status)],
            ["Incumbent risk Uᴿ",ro("solver-upper",r.upper,formatRisk)],
            ["Lower bound Lᴿ",ro("solver-lower",r.lower,formatRisk)],
            ["Absolute risk gap Uᴿ − Lᴿ",ro("solver-gap",r.gap,formatRisk)],
            ["Elapsed seconds",ro("solver-seconds",r.seconds,formatExpectedCount)],
            ["Incumbent grade vector",r.grade===null?ro("solver-grades",null,formatRisk):ro("solver-grades",r.grade,formatGrades)],
          ],{class:"prx-cg-table prx-cg-status"});
          body.append(heads);
          const lab=labelNode(ctx,r,{key:"solver"});
          if(lab)body.append(h("p",{"data-prx-solver-label":""},lab," in ",familyNameNode(ctx,r),"; ",familySizeNode(ctx,r)," reports."));
          else body.append(p("The run has not established optimality within solver tolerances. An incumbent, if present, is only a feasible report; read the lower bound and gap."));
          body.append(formula("U_R=\\tau+U_Z/M,\\quad L_R=\\tau+L_Z/M,\\quad U_R-L_R=(U_Z-L_Z)/M"),p("Solver's total Uᶻ = ",ro("solver-objective",r.objective===null?null:r.offset+r.objective,formatExpectedCount),"; objective lower bound Lᶻ = ",ro("solver-bound",r.bound===null?null:r.offset+r.bound,formatExpectedCount),"; M = ",ro("solver-M",pairCount(s.solverN)),". These totals add the constant offset ",ro("solver-offset",r.offset,formatExpectedCount)," to the raw incumbent objective ",ro("solver-raw-objective",r.objective,formatExpectedCount)," and raw lower bound ",ro("solver-raw-bound",r.bound,formatExpectedCount),", respectively. A relative objective gap is not a risk gap."));
          ctx.readout.set(["Joint search status: ",r.status,". Incumbent risk ",ctx.num(r.upper,formatRisk),"; lower bound ",ctx.num(r.lower,formatRisk),"; absolute risk gap ",ctx.num(r.gap,formatRisk),"."]);
        }else{
          body.append(p(lastError?"The solver could not finish. Check that the local solver bundle is available, then press the button to retry.":solver.running?"The worker is running. You can keep using the other views.":"No joint solve at these settings yet. Changing τ, unit count or time limit requires another button press."));
          ctx.readout.set(["Fixed-order candidate risk ",ctx.num(d.risk,formatRisk),". Joint solver ",solver.running?"running.":"not run at these settings."]);
        }
        body.append(p("The absolute and relative MIP stopping-gap settings are both ",ctx.num(0,formatCount),". HiGHS still uses its internal floating-point feasibility and objective tolerances. The time limit can stop the search with an incumbent and an open gap."),p("A solver status or a zero gap is not an exact arithmetic certificate; it concerns optimization of the supplied probabilities only. It does not establish that the posterior model is correct."));
        const sourceRows=m.ids.map((id,i)=>[id,ctx.num(DRAW.estimate[i],formatExpectedCount),ctx.num(LEAGUE.se[i],formatExpectedCount),ctx.num(m.mean[i],formatExpectedCount),ctx.num(m.sd[i],formatExpectedCount)]);
        body.append(detail("Frozen league inputs",scroll(table("The supplied independent normal posteriors",["Unit","Estimate","SE","Posterior mean","Posterior SD"],sourceRows),"League input table")),h("section",{class:"prx-cg-summary"},h("h4",{},"Why a bound needs its family"),p("The book's four-unit, two-criterion example fixes order A, B, C, D, weights ",ctx.num(.6,formatSetting)," and ",ctx.num(.4,formatSetting)," and τ = ",ctx.num(.25,formatSetting),". With exactly ",ctx.num(4,formatCount)," grades, its optimum is ",ro("book-exact",BOOK_EXACT.risk,formatRisk)," (seven fortieths). With at most ",ctx.num(4,formatCount)," grades, the same order permits risk ",ro("book-cap",BOOK_CAP.risk,formatRisk)," (three twentieths)."),p("The exact-grade family's lower bound exceeds a feasible risk in the larger capped family. It cannot be reused as that family's lower bound. In the same way, a fixed-order lower bound cannot certify an unrestricted solve.")));
      }
      return {render(s){
        const viewport={x:ctx.win.scrollX,y:ctx.win.scrollY};
        current=s;view.set(s.view);n.set(s.n);cap.set(s.cap);tau.set(s.tau);pat.set(s.pattern);invalid.set(s.invalid);sn.set(s.solverN);limit.set(s.timeLimit);
        countControls.hidden=s.view!=="count";binaryControls.hidden=s.view!=="encoding";solverControls.hidden=s.view!=="solver";common.hidden=s.view==="encoding";
        solverAction.hidden=s.view!=="solver";
        cap.root.hidden=s.view==="solver";tau.root.hidden=s.view==="count";
        const previousDPScroll=body.querySelector("[data-prx-dp-scroll]")?.scrollLeft??0;
        body.replaceChildren();
        if(s.view==="count")counts(s);else if(s.view==="encoding")encoding(s);else if(s.view==="solver")solverView(s);else dp(s,previousDPScroll);
        // Replacing trace rows can trigger scroll anchoring; keep the reader at the same page position.
        if(s.view==="dp"&&ctx.win.scrollY!==viewport.y)ctx.win.scrollTo({left:viewport.x,top:viewport.y,behavior:"instant"});
      }};
    }
  });
}
