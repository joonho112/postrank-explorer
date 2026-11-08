// Four views of the search: exact family counts, binary relations, an inspected DP trace, and a lazy browser solve.
//
// Review 044 repair (G4-F1 substantial redesign; X-01, X-09, X-18; G4-F3, G4-F4): one widget, four views, each in the
// shared result-first frame (base.js layout "result-first"), top to bottom:
//   controls  the view chips; the preset row; then the view's own controls (Family sizes: units and the cap; Dynamic
//             program: the cap and τ; Binary encoding: the pattern and the violation switch; Joint solver: units, τ,
//             time limit, the solve button and a status chip that names the settings being solved). They follow the
//             preset row (base.js afterPresets), so a preset that changes the view never moves the preset buttons.
//   read-out  directly under the controls (the dynamic program's sentence is the review's replacement copy, built from
//             the engine's DP and enumeration results)
//   scope     the method-scope line, in every view: what the view's answer is guaranteed to be (labels.js labels; for
//             the solver, the sentence that a status or a zero gap is no exact arithmetic certificate)
//   picture   the view's picture first (ctx.primaryGraphic): the family sizes on a log axis; the 3 × 3 matrix with the
//             thirteen patterns as chips (G4-F3); the grade strip, the savings table (h column sticky, X-09) with its
//             replay buttons and the current cell's candidate cuts as bars; the risk axis (fixed-order candidate, L–U
//             bracket, gap), the result table and the family-bound example as two bars (G4-F4)
//   details   closed disclosures whose summary line names their content: Exact counts; How the recursion works;
//             Frozen league inputs; Solver accounting
// Content is moved, never deleted: every sentence, table row, hook and number of the earlier layout is in the DOM, the
// exhaustive ones inside the boxes. The solve button is the persistent native action (A-CLR-002); HiGHS loads only when
// it is pressed.
import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, plot } from "../shared/chart.js";
import { blocksText, dataNum, formatCount, formatExpectedCount, formatGrades, formatRisk, formatSci, formatSetting } from "../shared/format.js";
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

// Figure geometry (px unless noted). The label width estimate (charPx per character at the 12 px figure font) only
// chooses a label's side and row; the labels themselves are SVG text.
const FIG = Object.freeze({
  // the family-size plot (as before) and its labels at the chosen unit count (placeCountLabels): `dx` px beside the
  // dashed rule, raised or lowered by `lift` px; digits and separators of the 12 px bold label font are about
  // digitPx and sepPx wide
  count: Object.freeze({ height: 310, marginTop: 24, marginBottom: 45, marginLeft: 72, marginRight: 24, decades: 11, dx: 8, lift: 10, far: 19, labelH: 15, digitPx: 7.4, sepPx: 3.8, clear: 3, lineClear: 2 }),
  strip: Object.freeze({ height: 70, marginLeft: 52, marginRight: 8, marginTop: 2, marginBottom: 20, gap: .45, cell: .9 }),
  bars: Object.freeze({ row: 28, marginTop: 8, marginBottom: 10, marginLeft: 46, marginRight: 124, valueDx: 8 }),
  axis: Object.freeze({ rowPx: 18, marginLeft: 18, marginRight: 22, marginTop: 6, marginBottom: 34, rows: 3, charPx: 6.8, pad: 6 }),
  book: Object.freeze({ height: 84, marginLeft: 120, marginRight: 52, marginTop: 6, marginBottom: 6 }),
});

const CSS = `.prx-cg .prx-cg-count-key{width:2.3rem;height:1rem;flex:none}.prx-cg .prx-cg-count-legend{margin:.4rem 0}.prx-cg .prx-cg-count-legend .prx-key{color:var(--prx-plot-fg)}.prx-cg .prx-cg-count-legend .prx-cg-count-muted{color:var(--prx-plot-muted)}
.prx-cg .prx-scroll-region{overflow-x:auto;max-width:100%;min-width:0}.prx-cg .prx-cg-body{min-width:0}.prx-cg .prx-cg-view{min-width:0}
.prx-cg .prx-cg-note{font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0 .7rem}
.prx-cg .prx-cg-controls{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:end;flex:1 1 100%;min-width:0}.prx-cg .prx-cg-controls>*{flex:1 1 10rem}.prx-cg .prx-cg-controls>.prx-cg-solve{flex:0 1 auto}
.prx-cg .prx-cg-controls[hidden],.prx-cg [hidden]{display:none!important}
.prx-cg .prx-cg-solve{display:flex;flex-wrap:wrap;gap:.35rem .6rem;align-items:center}
.prx-cg .prx-cg-chip{display:inline-flex;align-items:center;min-height:1.9rem;padding:.1rem .7rem;border:1px solid var(--prx-border-strong);border-radius:999px;background:var(--prx-bg-raised);color:var(--prx-fg);font-variant-numeric:tabular-nums;line-height:1.3}
.prx-cg .prx-cg-chip[data-state="running"]{border-style:dashed;border-color:var(--prx-accent)}.prx-cg .prx-cg-chip[data-state="optimal"]{border-color:var(--prx-accent);font-weight:600}.prx-cg .prx-cg-chip[data-state="error"]{border-color:var(--prx-err-text)}
.prx-cg .prx-cg-solve [aria-disabled=true],.prx-cg .prx-cg-replay [aria-disabled=true]{opacity:.55;cursor:default}
.prx-cg .prx-cg-scope{margin:0 0 .7rem;padding:0 0 0 .75rem;font-size:.9em;color:var(--prx-fg-muted)}.prx-cg .prx-cg-scope p,.prx-cg .prx-cg-scope .prx-cg-note{margin:.1rem 0;font-size:1em}
.prx-cg .prx-cg-table{border-collapse:collapse;width:100%;font-size:.85em;font-variant-numeric:tabular-nums;margin:.5rem 0}.prx-cg .prx-cg-table th,.prx-cg .prx-cg-table td{border:1px solid var(--prx-border);padding:.45rem .45rem;text-align:right;white-space:nowrap}.prx-cg .prx-cg-table.prx-sticky-first{border-collapse:separate;border-spacing:0}.prx-cg .prx-cg-table.prx-sticky-first th,.prx-cg .prx-cg-table.prx-sticky-first td{border-width:0 1px 1px 0}.prx-cg .prx-cg-table.prx-sticky-first tr>:first-child{border-left-width:1px}.prx-cg .prx-cg-table.prx-sticky-first thead tr>*{border-top-width:1px}.prx-cg .prx-cg-table caption{text-align:left;font-weight:600;margin:.3rem 0}.prx-cg .prx-cg-table th{color:var(--prx-fg-heading);font-weight:600}
.prx-cg .prx-cg-table .prx-cg-current{outline:3px solid var(--prx-accent);outline-offset:-3px;font-weight:700}.prx-cg .prx-cg-table .prx-cg-path{background:var(--prx-bg-raised);box-shadow:inset 0 -3px var(--prx-border-strong)}.prx-cg .prx-cg-table .prx-cg-blank{color:var(--prx-fg-muted);font-size:.85em}
.prx-cg .prx-cg-table .prx-cg-violation{outline:3px solid var(--prx-err-text);outline-offset:-3px;font-weight:700}
.prx-cg .prx-cg-small{max-width:27rem}.prx-cg .prx-cg-summary{border-left:3px solid var(--prx-accent);padding:.25rem .75rem;margin:.6rem 0}.prx-cg .prx-cg-summary p{margin:.25rem 0}.prx-cg .prx-cg-details{margin-top:.7rem}.prx-cg .prx-cg-formula{overflow-x:auto;padding:.25rem 0}
.prx-cg .prx-cg-status{table-layout:fixed;max-width:36rem}.prx-cg .prx-cg-status th{text-align:left;white-space:normal;overflow-wrap:normal;width:42%}.prx-cg .prx-cg-status td .prx-num{white-space:normal;overflow-wrap:anywhere}.prx-cg .prx-cg-status td{white-space:normal;overflow-wrap:anywhere}
.prx-cg .prx-cg-answer{margin:0 0 .45rem}.prx-cg .prx-cg-answer-line{margin:0 0 .15rem}.prx-cg .prx-cg-strip{max-width:30rem}
.prx-cg .prx-cg-replay{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin:.3rem 0 0}.prx-cg .prx-cg-replay-label{font-weight:600;color:var(--prx-fg-muted);margin-right:.15rem}
.prx-cg .prx-cg-dp-split>.prx-split-side{flex:1 1 14rem}.prx-cg .prx-cg-step{margin:.3rem 0 .15rem}.prx-cg .prx-cg-cell-line{margin:0 0 .5rem;font-weight:600}.prx-cg .prx-cg-panel{min-width:0}
.prx-cg .prx-cg-patterns{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,10.5rem),1fr));gap:.3rem;list-style:none;padding:0;margin:.2rem 0 .5rem;font-size:.85em}.prx-cg .prx-cg-patterns li{margin:0;padding:0;min-width:0}
.prx-cg .prx-cg-pattern{width:100%;text-align:left;font-variant-numeric:tabular-nums}.prx-cg .prx-cg-broken .prx-cg-pattern{border-style:dashed}
.prx-cg .prx-cg-sum{font-weight:400;color:var(--prx-fg-muted)}
.prx-cg .prx-cg-axis-key{margin:.15rem 0 .6rem}.prx-cg .prx-cg-book{max-width:44rem}.prx-cg .prx-cg-book-chart{max-width:32rem}
@media (max-width:30em){.prx-cg .prx-cg-controls>*{flex-basis:100%}.prx-cg .prx-cg-controls>.prx-cg-solve{flex-basis:100%}.prx-cg .prx-cg-replay-label{flex-basis:100%}.prx-cg .prx-cg-table th,.prx-cg .prx-cg-table td{padding:.4rem}}`;

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

/**
 * A Plot text mark whose number carries data-num (and, with `hook`, data-prx-readout): `prefix` and `suffix` are
 * words in their own <tspan>s, so a label such as "L .1650" or "−.01162 ◀ chosen" keeps one anchor while its number
 * reads back as its raw value (the read-out check). value(d) is the raw number, format a format.js formatter.
 */
function numLabel(P, rows, { value, format, prefix = () => "", suffix = () => "", hook, ...options }) {
  const raws = rows.map((d, i) => value(d, i));
  return P.text(rows, {
    ...options,
    text: (d, i) => `${prefix(d, i)}${format(raws[i])}${suffix(d, i)}`,
    render(index, scales, values, dims, context, next) {
      const g = next(index, scales, values, dims, context);
      const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
      Array.from(index).forEach((i, j) => {
        const t = nodes[j];
        if (!t) return;
        const parts = [prefix(rows[i], i), format(raws[i]), suffix(rows[i], i)];
        t.textContent = "";
        parts.forEach((s, k) => {
          if (!s) return;
          const span = t.ownerDocument.createElementNS(t.namespaceURI, "tspan");
          span.textContent = s;
          if (k === 1) {
            span.setAttribute("data-num", dataNum(raws[i]));
            const name = hook?.(rows[i], i);
            if (name) span.setAttribute("data-prx-readout", name);
          }
          t.append(span);
        });
      });
      return g;
    },
  });
}

/** True when the segment p–q passes through the box [x0, y0, x1, y1] (Liang–Barsky clipping). */
function segmentHitsBox([px, py], [qx, qy], [x0, y0, x1, y1]) {
  let t0 = 0, t1 = 1;
  const dx = qx - px, dy = qy - py;
  for (const [p, q] of [[-dx, px - x0], [dx, x1 - px], [-dy, py - y0], [dy, y1 - py]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

/**
 * Where the family-size plot writes its counts at the chosen unit count n. Each label (equal counts share one) takes
 * the first of ten places beside its point (left and up, left, right and down, right, left and down, right and up,
 * then the same farther up or down) whose box touches no line of the plot, no label already placed, the dashed rule
 * at n and no plot edge, and whose middle is nearer its own point than any other point on the rule. A label with no
 * such place is not drawn (its number is in the read-out right above the plot): `shown` is false. Returns
 * [{ key, v, shown, anchor, y }], y in data units.
 */
export function placeCountLabels(width, rows, selected, n) {
  const C = FIG.count, iw = width - C.marginLeft - C.marginRight, ih = C.height - C.marginTop - C.marginBottom;
  const X = (v) => C.marginLeft + iw * (v - 2) / 10;
  const Y = (v) => C.marginTop + ih * (1 - Math.log10(Math.max(1, Number(v))) / C.decades);
  const lines = ["all", "capped", "ordered"].map((k) => rows.map((r) => [X(r.n), Y(r[k])]));
  const widthOf = (s) => [...s].reduce((w, ch) => w + (/\d/.test(ch) ? C.digitPx : C.sepPx), 2);
  const labels = [];
  for (const [key, v] of [["all", selected.all], ["capped", selected.capped], ["order", selected.ordered]]) if (!labels.some((l) => Number(l.v) === Number(v))) labels.push({ key, v });
  const px = X(n), placed = [], points = labels.map((l) => Y(l.v));
  const meets = (a, b) => !(a[2] + C.clear < b[0] || b[2] + C.clear < a[0] || a[3] + C.clear < b[1] || b[3] + C.clear < a[1]);
  for (const l of labels) {
    const w = widthOf(formatCount(l.v)), py = Y(l.v);
    l.shown = false;
    for (const [anchor, dy] of [["end", -C.lift], ["end", 0], ["start", C.lift], ["start", 0], ["end", C.lift], ["start", -C.lift],
      ["end", -C.far], ["start", C.far], ["end", C.far], ["start", -C.far]]) {
      const x0 = anchor === "end" ? px - C.dx - w : px + C.dx, y0 = py + dy - C.labelH / 2, box = [x0, y0, x0 + w, y0 + C.labelH];
      if (box[0] < C.marginLeft || box[2] > width || box[1] < C.marginTop - C.labelH / 2 || box[3] > C.marginTop + ih) continue;
      if (placed.some((b) => meets(box, b))) continue;
      if (points.some((q) => q !== py && Math.abs(py + dy - q) <= Math.abs(dy))) continue;
      const near = [box[0] - C.lineClear, box[1] - C.lineClear, box[2] + C.lineClear, box[3] + C.lineClear];
      if (lines.some((line) => line.some((pt, i) => i > 0 && segmentHitsBox(line[i - 1], pt, near)))) continue;
      placed.push(box);
      Object.assign(l, { shown: true, anchor, y: 10 ** (C.decades * (1 - (py + dy - C.marginTop) / ih)) });
      break;
    }
  }
  return labels;
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name:"computing-grades", className:"prx-cg", css:CSS, title:"What does each search cover?",
    // review 044 repair (X-01): the read-out directly under the controls, then the view's picture
    layout:"result-first",
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
      // running: the settings of the outstanding solve (its key, units and τ), for the status chip
      let current, lastError=null, running=null, dpCellCount=0;
      const exactCache=new Map(), dpCache=new Map(), results=new Map();
      const ro=(key,v,f=formatCount)=>{const x=ctx.num(v,f(v)); x.setAttribute("data-prx-readout",key);return x;};
      const p=(...parts)=>h("p",{class:"prx-cg-note"},...parts);
      const formula=(tex)=>{const x=h("div",{class:"prx-cg-formula"}), f=formulaNums();const source=tex.replace(/\d+/g,v=>f.num(Number(v),formatCount(Number(v))));renderTex(x,source,{display:true,nums:f.raws});ctx.scrollRegion(x,"Mathematical expression");return x;};
      const table=(caption,heads,rows,attrs={})=>h("table",{class:"prx-cg-table",...attrs},h("caption",{},caption),h("thead",{},h("tr",{},...heads.map(x=>h("th",{scope:"col"},x)))),h("tbody",{},...rows.map(r=>h("tr",{},...r.map((x,i)=>h(i?"td":"th",i?{}:{scope:"row"},x))))));
      const scroll=(node,label)=>{const x=h("div",{},node);ctx.scrollRegion(x,label);return x;};
      const detail=(title,...nodes)=>h("section",{class:"prx-cg-details"},ctx.panelTitle(title),...nodes);
      const sum=(...parts)=>h("span",{class:"prx-cg-sum"},...parts);
      const getDP=s=>{const k=`${s.cap}/${s.tau}`;if(!dpCache.has(k))dpCache.set(k,fixedOrderDP(E,{scores:SCORES,G:s.cap,tau:s.tau,trace:true}));return dpCache.get(k);};
      const getExact=s=>{const k=`${s.cap}/${s.tau}`;if(!exactCache.has(k))exactCache.set(k,exactOptimum(E,{family:{kind:"atMost",G:s.cap},tau:s.tau}));return exactCache.get(k);};
      const solverKey=s=>`${s.solverN}/${s.tau}/${s.timeLimit}`;
      const solverModel=s=>{
        const ids=LEAGUE.ids.slice(0,s.solverN), mean=POSTERIOR.mean.slice(0,s.solverN), sd=POSTERIOR.sd.slice(0,s.solverN);
        return {ids,mean,sd,E:errorArray(mean,sd,{ids,criteria:["score"]})};
      };

      // --- controls: the view chips, (base.js: the preset row), then the view's own controls
      const view=ctx.segmented({label:"Search view",name:"view",value:ctx.state.view,options:[{value:"count",label:"Family sizes"},{value:"encoding",label:"Binary encoding"},{value:"dp",label:"Dynamic program"},{value:"solver",label:"Joint solver"}],onChange:v=>ctx.set({view:v})});
      const n=ctx.slider({label:"Units in the count",name:"n",...ctx.key("n"),onInput:v=>ctx.set({n:v})});
      const cap=ctx.slider({label:"At most this many grades",name:"cap",...ctx.key("cap"),onInput:v=>ctx.set({cap:v})});
      const tau=ctx.slider({label:"Withholding cost τ",name:"tau",...ctx.key("tau"),onInput:v=>ctx.set({tau:v})});
      const pat=ctx.slider({label:"Valid report pattern (zero-based index)",name:"pattern",...ctx.key("pattern"),onInput:v=>ctx.set({pattern:v,invalid:false})});
      const invalid=ctx.toggle({label:"Show a transitivity violation",name:"invalid",checked:false,onChange:v=>ctx.set({invalid:v})});
      const sn=ctx.slider({label:"First units of the frozen league",name:"solverN",...ctx.key("solverN"),onInput:v=>ctx.set({solverN:v})});
      const limit=ctx.slider({label:"Solver time limit (seconds)",name:"timeLimit",...ctx.key("timeLimit"),onInput:v=>ctx.set({timeLimit:v})});
      const solver = createBrowserSolveController(ctx, {
        getProblem() { if (!current) return null; const state = { ...current }; running = { key: solverKey(state), solverN: state.solverN, tau: state.tau }; return { E: solverModel(state).E, options: { tau: state.tau, timeLimit: state.timeLimit }, key: solverKey(state) }; },
        onResult(result, key) { results.set(key, result); },
        onError(error) { lastError = error; },
        onBusy(busy) { if (!busy) running = null; if (busy) ctx.root.setAttribute("aria-busy", "true"); else ctx.root.removeAttribute("aria-busy"); ctx.requestRender(busy ? "solver-start" : "solver-result"); },
      });
      // the status chip names what the solver is doing (not run, solving 20 units at τ .25, the result's status)
      const chip=h("span",{class:"prx-cg-chip","data-prx-solver-chip":""});
      const solveBox=h("div",{class:"prx-cg-solve"},solver.root,chip);
      ctx.controls.append(view.root);
      // one row in DOM order units, cap, solver units, τ, time limit, pattern, violation, solve: each view shows its own
      // (review 044, X-18: after the preset row, so the preset buttons stay put when a preset changes the view)
      const viewControls=h("div",{class:"prx-cg-controls"},n.root,cap.root,sn.root,tau.root,limit.root,pat.root,invalid.root,solveBox);
      ctx.afterPresets(viewControls);
      // the control a reader changes first in each view (the first one shown counts)
      for(const node of [n.root,cap.root,pat.root,solveBox])ctx.primaryControl(node);

      // --- charts: the method-scope line (every view), then the four views; only the chosen one is shown
      const scopeLine=ctx.part("notes",h("div",{class:"prx-cg-scope","data-prx-scope":""}));
      const sections=Object.fromEntries(["count","encoding","dp","solver"].map(k=>[k,h("div",{class:`prx-cg-view prx-cg-view-${k}`,"data-prx-view":k})]));
      const body=h("div",{class:"prx-cg-body"},sections.count,sections.encoding,sections.dp,sections.solver);
      ctx.charts.append(scopeLine,body);

      // Family sizes: the log plot, its key and axis note, the exact table in a closed box
      const countPlot=ctx.primaryGraphic(h("div",{class:"prx-cg-count-chart"}));
      const countLegend=h("div",{class:"prx-legend prx-cg-count-legend","data-prx-part":"legend"});
      for(const f of COUNT_FAMILIES){
        const svg=ctx.doc.createElementNS("http://www.w3.org/2000/svg","svg");
        svg.setAttribute("viewBox","0 0 37 16");svg.setAttribute("class","prx-cg-count-key");svg.setAttribute("aria-hidden","true");
        const mark=(tag,attrs)=>{const node=ctx.doc.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.append(node);};
        mark("line",{x1:0,y1:8,x2:37,y2:8,stroke:"currentColor","stroke-width":2,...(f.dash?{"stroke-dasharray":f.dash}:{})});
        const shape=f.symbol==="circle"?["circle",{cx:18.5,cy:8,r:3}]:f.symbol==="square"?["rect",{x:15.5,y:5,width:6,height:6}]:["path",{d:"M18.5 3.5 23 8 18.5 12.5 14 8Z"}];
        mark(shape[0],{...shape[1],fill:"var(--prx-plot-bg)",stroke:"currentColor","stroke-width":1.5});
        countLegend.append(h("span",{class:`prx-key${f.ink==="plotMuted"?" prx-cg-count-muted":""}`},svg,f.kind));
      }
      const countNote=p();
      const countsBox=ctx.disclosure({name:"counts",title:"Exact counts",placement:"none"});
      sections.count.append(countPlot,countLegend,countNote,countsBox.root);

      // Binary encoding: the matrix and its answer, beside it the thirteen patterns as chips (G4-F3); the bit note and
      // the two inequalities under the matrix
      const matrixSlot=ctx.primaryGraphic(h("div",{class:"prx-cg-matrix"}));
      const encodingAnswer=h("div",{class:"prx-cg-encoding-answer"});
      const chipButtons=PATTERNS.map((g,i)=>{const b=h("button",{type:"button",class:"prx-seg prx-cg-pattern","aria-pressed":"false","data-prx-focus-key":`pattern-chip:${i}`},ctx.num(i,formatCount),": ",ctx.num(g,formatGrades)," · ",blocksText(g,["A","B","C"]));ctx.listen(b,"click",()=>ctx.set({pattern:i,invalid:false}));return b;});
      const brokenButton=h("button",{type:"button",class:"prx-seg prx-cg-pattern","aria-pressed":"false","data-prx-focus-key":"pattern-chip:broken"},"Show a broken pattern");
      ctx.listen(brokenButton,"click",()=>ctx.set({invalid:true}));
      const chipList=h("ul",{class:"prx-cg-patterns","aria-label":"Report patterns on three units"},...chipButtons.map(b=>h("li",{},b)),h("li",{class:"prx-cg-broken"},brokenButton));
      sections.encoding.append(h("div",{class:"prx-split"},
        h("div",{class:"prx-split-main prx-cg-panel"},matrixSlot,encodingAnswer,
          p("A directed bit zᵢⱼ is ",ctx.num(1,formatCount)," when i is in the same grade as j or higher, and ",ctx.num(0,formatCount)," otherwise. A shared grade sets both directions to ",ctx.num(1,formatCount),"; it makes no equality claim about the true values."),
          formula("z_{ij}+z_{ji}\\geq 1,\\qquad z_{ij}+z_{jk}-z_{ik}\\leq 1")),
        h("div",{class:"prx-split-side prx-cg-panel"},ctx.panelTitle("All valid patterns"),chipList)));

      // Dynamic program: the answer with its grade strip, then the savings table (replay buttons attached) beside the
      // current cell's candidate cuts; formulas, alternatives, the risk-by-grade-count table and ties in a closed box
      const dpAnswerLine=h("p",{class:"prx-cg-answer-line"});
      const stripSlot=h("div",{class:"prx-cg-strip"});
      const dpAnswer=h("div",{class:"prx-cg-answer","data-prx-dp-answer":""},dpAnswerLine,stripSlot);
      const tableScroll=ctx.scrollRegion(h("div",{"data-prx-dp-scroll":"","data-prx-focus-key":"dp-table"}),"Dynamic programming savings table");
      const startButton=ctx.button({label:"Start table",key:"dp-start",onClick:()=>ctx.set({step:0})});
      const nextButton=ctx.button({label:"Next cell",key:"dp-next",onClick:()=>{const step=Math.min(ctx.state.step,dpCellCount);ctx.set({step:Math.min(step+1,dpCellCount)});}});
      const fillButton=ctx.button({label:"Fill table",key:"dp-fill",onClick:()=>ctx.set({step:dpCellCount})});
      const replay=h("div",{class:"prx-cg-replay",role:"group","aria-label":"Replay the table"},h("span",{class:"prx-cg-replay-label","aria-hidden":"true"},"Replay the table:"),startButton.root,nextButton.root,fillButton.root);
      const stepLine=h("p",{class:"prx-cg-note prx-cg-step"});
      const cellLine=h("p",{class:"prx-cg-cell-line"});
      // the replay buttons, the count of filled cells and the current cell sit right above the table and the bars
      // they move (the review's phone order: buttons, table, the cell's candidates)
      const tablePanel=h("section",{class:"prx-split-main prx-cg-panel"},ctx.panelTitle("Vₕ(c): greatest saving from h consecutive grades"),tableScroll,
        h("p",{class:"prx-cg-note"},"Outlined: the current cell. Underlined when complete: the chosen backtrack."));
      const barsSlot=h("div",{class:"prx-cg-bars"});
      const barsPanel=h("section",{class:"prx-split-side prx-cg-panel"},ctx.panelTitle("Every possible last cut b"),barsSlot);
      const dpPicture=ctx.primaryGraphic(h("div",{class:"prx-cg-dp-picture"},dpAnswer,replay,stepLine,cellLine,h("div",{class:"prx-split prx-cg-dp-split"},tablePanel,barsPanel)));
      const recursion=ctx.disclosure({name:"recursion",title:["How the recursion works",sum(" · W(b,c), Vₕ(c), R = τ + (T − V)/M, risk by grade count, ties")],placement:"none"});
      sections.dp.append(dpPicture,recursion.root);

      // Joint solver: the problem, its status, the risk axis and its key, the result table, the family-bound example,
      // then the inputs and the accounting in closed boxes
      const solverIntro=p(), solverNote=p();
      const axisSlot=ctx.primaryGraphic(h("div",{class:"prx-cg-axis"}));
      const axisKey=h("p",{class:"prx-cg-note prx-cg-axis-key"},"◆ fixed-order candidate, an upper limit · L and U: the solver's lower bound and incumbent, U − L the gap.");
      const resultSlot=h("div",{class:"prx-cg-result"});
      const bookSlot=h("div",{class:"prx-cg-book-chart"});
      const book=h("section",{class:"prx-cg-summary prx-cg-book"},h("h4",{},"Why a bound needs its family"),bookSlot,
        p("The book's four-unit, two-criterion example fixes order A, B, C, D, weights ",ctx.num(.6,formatSetting)," and ",ctx.num(.4,formatSetting)," and τ = ",ctx.num(.25,formatSetting),". With exactly ",ctx.num(4,formatCount)," grades, its optimum is ",ro("book-exact",BOOK_EXACT.risk,formatRisk)," (seven fortieths). With at most ",ctx.num(4,formatCount)," grades, the same order permits risk ",ro("book-cap",BOOK_CAP.risk,formatRisk)," (three twentieths)."),
        p("The exact-grade family's lower bound exceeds a feasible risk in the larger capped family. It cannot be reused as that family's lower bound. In the same way, a fixed-order lower bound cannot certify an unrestricted solve."));
      const inputsBox=ctx.disclosure({name:"inputs",title:"Frozen league inputs",placement:"none"});
      const accountingBox=ctx.disclosure({name:"accounting",title:["Solver accounting",sum(" · risk = τ + objective/M, the constant offset, stopping gaps")],placement:"none"});
      sections.solver.append(solverIntro,solverNote,axisSlot,h("p",{class:"prx-cg-note"},"This feasible report supplies an upper limit on the unrestricted optimum. Its fixed-order optimum supplies no lower limit for that larger family."),axisKey,resultSlot,book,inputsBox.root,accountingBox.root);

      // what a view writes on each render; the views that are not shown are emptied
      const dynamic={
        count:[countPlot,countNote,countsBox.body],
        encoding:[matrixSlot,encodingAnswer],
        dp:[dpAnswerLine,stripSlot,tableScroll,stepLine,cellLine,barsSlot,recursion.body],
        solver:[solverIntro,solverNote,axisSlot,resultSlot,bookSlot,inputsBox.body,accountingBox.body],
      };

      function counts(s){
        const rows=Array.from({length:11},(_,i)=>{const n=i+2;return {n,all:familySize(n,{kind:"all"}),capped:familySize(n,{kind:"atMost",G:Math.min(s.cap,n)}),ordered:familySize(n,{kind:"order",order:Array.from({length:n},(_,j)=>j),G:Math.min(s.cap,n)})};});
        const selected=rows[s.n-2];
        const points=rows.flatMap(r=>[{n:r.n,size:Number(r.all),kind:"All reports"},{n:r.n,size:Number(r.capped),kind:"Capped reports"},{n:r.n,size:Number(r.ordered),kind:"Cuts of one order"}]);
        scopeLine.replaceChildren(h("p",{},"Exact counts. A search answers only within the family it covers: all reports, the reports with at most ",ctx.num(s.cap,formatCount),s.cap===1?" grade, or the cuts of one order.":" grades, or the cuts of one order."));
        // the three counts written beside their points at the chosen unit count (equal counts share one label),
        // each only where it touches no line, label, rule or edge and reads as its own point's (placeCountLabels)
        const C=FIG.count, width=Math.max(200,countPlot.clientWidth||640);
        const labels=placeCountLabels(width,rows,selected,s.n);
        const countLabels=(P,c,anchor)=>numLabel(P,labels.filter(l=>l.shown&&l.anchor===anchor),{x:()=>s.n,y:"y",value:l=>l.v,format:formatCount,hook:l=>`count-label-${l.key}`,textAnchor:anchor,dx:anchor==="end"?-C.dx:C.dx,fill:c.plotFg,stroke:c.plotBg,strokeWidth:4,paintOrder:"stroke",fontWeight:700});
        plot(countPlot,{width,height:C.height,marginTop:C.marginTop,marginLeft:C.marginLeft,marginRight:C.marginRight,marginBottom:C.marginBottom,x:{label:"Units",ticks:6,domain:[2,12]},y:{label:"Reports (log scale)",type:"log",domain:[1,1e11],ticks:[1,1e2,1e4,1e6,1e8,1e10],grid:true},marks:(c,P)=>[P.ruleX([s.n],{stroke:c.plotMuted,strokeDasharray:"3 3"}),...COUNT_FAMILIES.flatMap(f=>{const data=points.filter(r=>r.kind===f.kind);return[P.line(data,{x:"n",y:"size",stroke:c[f.ink],strokeWidth:2,strokeDasharray:f.dash}),P.dot(data,{x:"n",y:"size",symbol:f.symbol,fill:c.plotBg,stroke:c[f.ink],strokeWidth:1.5,r:3})];}),
          countLabels(P,c,"end"),countLabels(P,c,"start")],table:{caption:"Exact numbers of reports by units and family",columns:[{label:"Units",value:"n",format:formatCount},{label:"All",value:"all",format:formatCount},{label:"At most the selected grade cap",value:"capped",format:formatCount},{label:"Contiguous cuts",value:"ordered",format:formatCount}],rows},keyboard:{data:points,x:"n",y:"size",title:r=>`${formatCount(r.n)} units, ${r.kind}: ${formatCount(r.size)} ${Number(r.size)===1?"report":"reports"}.`}});
        const t=table("Exact counts (the cap cannot exceed the number of units)",["Units","All reports","Capped","One order"],rows.map(r=>[ctx.num(r.n,formatCount),ctx.num(r.all,formatCount),ctx.num(r.capped,formatCount),ctx.num(r.ordered,formatCount)]),{class:"prx-cg-table prx-sticky-first"});
        countNote.replaceChildren("The vertical axis is logarithmic: equal vertical steps multiply the number of reports. Capped counts allow at most ",ctx.num(s.cap,formatCount),s.cap===1?" grade; cuts keep a declared strict order.":" grades; cuts keep a declared strict order.");
        countsBox.summary.replaceChildren("Exact counts",sum(" · ",ctx.num(rows.length,formatCount)," rows, ",ctx.num(rows[0].n,formatCount)," to ",ctx.num(rows[rows.length-1].n,formatCount)," units"));
        countsBox.body.replaceChildren(scroll(t,"Family count table"));
        ctx.readout.set(["With ",ro("count-n",s.n)," units: ",ro("count-all",selected.all)," unrestricted reports; ",ro("count-capped",selected.capped)," with at most ",ctx.num(s.cap,formatCount),s.cap===1?" grade; ":" grades; ",ro("count-order",selected.ordered),Number(selected.ordered)===1?" cut of one order.":" cuts of one order."]);
      }

      function encoding(s){
        const g=PATTERNS[s.pattern], relation=weakRelation(g);
        const z=s.invalid?[[NaN,1,1],[1,NaN,1],[0,1,NaN]]:relation.z;
        const grid=table("Row unit in the same grade as, or higher than, column unit",["zᵢⱼ","A","B","C"],["A","B","C"].map((id,i)=>[id,...z[i].map((v,j)=>i===j?"—":ro(`z-${i}-${j}`,v))]),{"data-prx-binary":""});
        grid.classList.add("prx-cg-small");
        // the broken pattern: outline the three bits of the failing inequality for (C, B, A)
        if(s.invalid)for(const [i,j] of [[2,1],[1,0],[2,0]])grid.tBodies[0].rows[i].cells[j+1].classList.add("prx-cg-violation");
        matrixSlot.replaceChildren(grid);
        scopeLine.replaceChildren(h("p",{},"The joint solver restricts its search to complete, transitive patterns."));
        if(s.invalid){
          encodingAnswer.replaceChildren(h("div",{class:"prx-cg-summary"},p("Completeness holds for every pair. Transitivity fails: C is no lower than B and B no lower than A, yet C is below A."),p("For (i, j, k) = (C, B, A): ",ctx.num(z[2][1],formatCount)," + ",ctx.num(z[1][0],formatCount)," − ",ctx.num(z[2][0],formatCount)," = ",ro("violation",z[2][1]+z[1][0]-z[2][0])," > ",ctx.num(1,formatCount),". No grade vector has this pattern.")));
          ctx.readout.set(["This complete pattern is not transitive. It is not a report."]);
        }else{
          encodingAnswer.replaceChildren(p("Grade vector in A, B, C order: ",ro("binary-grade",g,formatGrades),"; ",h("strong",{},blocksText(g,["A","B","C"])),". Completeness and transitivity both hold."));
          ctx.readout.set([ro("pattern-count",PATTERNS.length)," valid binary patterns are the ",ctx.num(familySize(3,{kind:"all"}),formatCount)," reports on three units. Both directions set to one mean a shared grade."]);
        }
        chipButtons.forEach((b,i)=>b.setAttribute("aria-pressed",String(!s.invalid&&i===s.pattern)));
        brokenButton.setAttribute("aria-pressed",String(s.invalid));
      }

      // the grade strip: the six sites in posterior-mean order, a gap between grades, each site's grade under it
      function drawStrip(d){
        const G=Math.max(...d.grade), S=FIG.strip;
        const rows=IDS.map((id,i)=>{const x1=i+(d.grade[i]-1)*S.gap;return {id,i,grade:d.grade[i],x1,x2:x1+S.cell,x:x1+S.cell/2,y:1.5};});
        plot(stripSlot,{height:S.height,marginLeft:S.marginLeft,marginRight:S.marginRight,marginTop:S.marginTop,marginBottom:S.marginBottom,
          x:{domain:[0,IDS.length+(G-1)*S.gap],ticks:[],label:"Posterior-mean order",labelArrow:"none",labelAnchor:"left"},y:{domain:[0,2],axis:null},
          marks:(c,P)=>{const fills=gradeColors(G,c);return[
            P.rect(rows,{x1:"x1",x2:"x2",y1:1.05,y2:1.95,fill:r=>fills[r.grade-1],stroke:c.cellBorder}),
            P.text(rows,{x:"x",y:"y",text:"id",fill:r=>labelOn(fills[r.grade-1],c),fontWeight:700}),
            P.text([{x:0,y:.5}],{x:"x",y:"y",text:()=>"Grade",textAnchor:"end",dx:-8,fill:c.plotMuted}),
            numLabel(P,rows,{x:"x",y:()=>.5,value:r=>r.grade,format:formatCount,hook:r=>`strip-grade-${r.id}`,fill:c.plotFg}),
          ];},
          alt:"Best contiguous grades for the six sites, in the posterior-mean order.",keyboard:{data:rows,x:"x",y:"y",title:r=>`${r.id}: grade ${formatCount(r.grade)}.`}});
      }

      // the current cell's candidate cuts: one bar per last cut b (its total saving), the chosen b marked
      function drawBars(here,candidates,chosen){
        const B=FIG.bars, totals=candidates.map(v=>v.total);
        let lo=Math.min(0,...totals), hi=Math.max(0,...totals);
        if(!(hi-lo>1e-12)){lo-=.01;hi+=.01;}
        const rows=candidates.map(v=>({...v,chosen:v.b===chosen}));
        plot(barsSlot,{height:B.marginTop+B.marginBottom+B.row*rows.length,marginLeft:B.marginLeft,marginRight:B.marginRight,marginTop:B.marginTop,marginBottom:B.marginBottom,
          x:{domain:[lo,hi],axis:null},y:{domain:rows.map(v=>v.b),axis:null},
          marks:(c,P)=>[
            P.barX(rows,{x1:0,x2:"total",y:"b",fill:v=>v.chosen?c.accent:c.plotMuted,insetTop:5,insetBottom:5}),
            P.ruleX([0],{stroke:c.plotAxis}),
            numLabel(P,rows,{x:()=>lo,y:"b",value:v=>v.b,format:formatCount,prefix:()=>"b = ",textAnchor:"end",dx:-6,fill:c.plotFg}),
            numLabel(P,rows,{x:()=>hi,y:"b",value:v=>v.total,format:formatExpectedCount,suffix:v=>v.chosen?" ◀ chosen":"",hook:v=>`dp-bar-${v.b}`,textAnchor:"start",dx:B.valueDx,fill:c.plotFg}),
          ],
          alt:`Total saving of each possible last cut b for the cell h = ${formatCount(here.h)}, c = ${formatCount(here.c)}; the engine chooses the largest total, b = ${formatCount(chosen)}.`,
          keyboard:{data:rows,x:"total",y:"b",title:v=>`b = ${formatCount(v.b)}: previous saving ${formatExpectedCount(v.previous)} + new block ${formatExpectedCount(v.block)} = ${formatExpectedCount(v.total)}${v.chosen?" (chosen)":""}.`}});
      }

      function dp(s){
        const d=getDP(s), x=getExact(s), t=d.trace;
        const cells=[];for(let h=1;h<t.V.length;h++)for(let c=1;c<t.V[h].length;c++)if(t.V[h][c]!==null)cells.push({h,c});
        dpCellCount=cells.length;
        const step=Math.min(s.step,cells.length);if(s.step!==step)ctx.set({step});
        const seen=new Set(cells.slice(0,step).map(v=>`${v.h}/${v.c}`)), here=cells[step-1];
        const path=new Set(t.path.map(v=>`${v.h}/${v.c}`));
        // scope: the guarantee of each answer, with its family (and ties, if any)
        scopeLine.replaceChildren(
          h("p",{},labelNode(ctx,d,{key:"dp"})," in ",familyNameNode(ctx,d)," (",familySizeNode(ctx,d),Number(d.family.size)===1?" contiguous report).":" contiguous reports)."),
          h("p",{},labelNode(ctx,x,{key:"enumerated"})," (",familySizeNode(ctx,x),Number(x.family.size)===1?" report); risk ":" reports); risk ",ro("exact-risk",x.risk,formatRisk),"; ",ro("exact-grades",x.grade,formatGrades),"."));
        if(d.tieCount>1)scopeLine.append(p(ctx.num(d.tieCount,formatCount)," reports share the smallest risk within this order; read-outs show the first. Equal-risk tolerance ",ctx.num(d.tieTol,formatSci),"."));
        if(x.tieCount>1)scopeLine.append(p(ctx.num(x.tieCount,formatCount)," reports share the smallest risk in the capped family; read-outs show the first. Equal-risk tolerance ",ctx.num(x.tieTol,formatSci),"."));
        dpAnswerLine.replaceChildren(h("strong",{},"Current answer: "),blocksText(d.grade,IDS),"; risk ",ro("dp-answer-risk",d.risk,formatRisk),".");
        drawStrip(d);
        // the savings table: rows h, columns c, the h column sticky while the box scrolls (X-09)
        const tab=table("Vₕ(c): greatest saving from h consecutive grades",["h \\ c",...t.V[0].map((_,c)=>ctx.num(c,formatCount))],t.V.map((row,h)=>[ctx.num(h,formatCount),...row.map((v,c)=>{
          const key=`${h}/${c}`, filled=h===0&&c===0||seen.has(key);
          const node=h===0&&c===0?ro("dp-origin",v,formatExpectedCount):v===null?hNode("unreachable"):filled?ro(`dp-${h}-${c}`,v,formatExpectedCount):hNode("·");
          return ctx.h("span",{class:`${step===cells.length&&path.has(key)?"prx-cg-path ":""}${here?.h===h&&here?.c===c?"prx-cg-current":""}`},node);
        })]),{class:"prx-cg-table prx-sticky-first"});
        // Style the table cell, not only its text, so the trace remains legible on a narrow display.
        for(const span of tab.querySelectorAll(".prx-cg-current,.prx-cg-path")){span.parentElement.className=span.className;span.className="";}
        tab.caption.classList.add("prx-sr-only");
        // Move only the table horizontally; scrolling an element into view would also move the page.
        const previousScrollLeft=tableScroll.scrollLeft;
        tableScroll.replaceChildren(tab);
        tableScroll.scrollLeft=previousScrollLeft;
        const activeCell=tab.querySelector(".prx-cg-current");
        if(activeCell&&tableScroll.clientWidth>0){
          // the sticky h column covers the left edge of the box while it scrolls
          const box=tableScroll.getBoundingClientRect(),cell=activeCell.getBoundingClientRect(),pad=4;
          const sticky=tab.tHead?.rows[0]?.cells[0]?.getBoundingClientRect().width??0;
          if(cell.right>box.right-pad)tableScroll.scrollLeft+=cell.right-box.right+pad;
          else if(cell.left<box.left+sticky+pad)tableScroll.scrollLeft-=box.left+sticky+pad-cell.left;
        }
        nextButton.root.setAttribute("aria-disabled",String(step>=cells.length));
        stepLine.replaceChildren("Filled ",ro("dp-step",step)," of ",ro("dp-cells",cells.length)," feasible cells. Rows fix the number of grades h; columns take the first c sites in posterior-mean order A, B, C, D, E, F.");
        // the current cell and its candidate cuts as bars
        const candidates=[];
        if(here)for(let b=here.h-1;b<here.c;b++)if(t.V[here.h-1][b]!==null)candidates.push({b,previous:t.V[here.h-1][b],block:t.W[b][here.c],total:t.V[here.h-1][b]+t.W[b][here.c]});
        if(here){
          cellLine.replaceChildren("Current cell h = ",ctx.num(here.h,formatCount),", c = ",ctx.num(here.c,formatCount),"; last cut b = ",ro("dp-last-cut",t.pred[here.h][here.c]),".");
          drawBars(here,candidates,t.pred[here.h][here.c]);
        }else{
          cellLine.replaceChildren("No cell is filled yet; Next cell fills the first one.");
          barsSlot.replaceChildren();
        }
        // How the recursion works: the saving, the recursion, the current cell's alternatives, the risk from the final
        // savings, the full result labels and the tie rules
        recursion.body.replaceChildren(
          p("For the sites in a cell, saving is the expected cost of stating their fixed-order pair directions minus the cost after withholding within grades. A negative saving means withholding costs more. These are total cost differences; divide by the full pair count M to express a full-report risk difference."),
          formula("W(b,c)=\\sum_{b<s<t\\le c}(\\bar e_{\\rho_s\\rho_t}-\\tau),\\qquad V_h(c)=\\max_{h-1\\le b<c}\\{V_{h-1}(b)+W(b,c)\\}"),
          p("W(b,c) totals the saving inside the next grade. An unreachable cell has no feasible partition; the empty starting state has saving ",ctx.num(0,formatCount),". Outlined: the current cell. Underlined when complete: the chosen backtrack."),
          ...(here?[detail("Inspect the current cell's alternatives",p("Current h = ",ctx.num(here.h,formatCount),", c = ",ctx.num(here.c,formatCount),". The engine chooses b = ",ro("dp-predecessor",t.pred[here.h][here.c]),"."),scroll(table("Every possible last cut b",["b","Previous saving","New block saving","Total"],candidates.map(v=>[ctx.num(v.b,formatCount),ctx.num(v.previous,formatExpectedCount),ctx.num(v.block,formatExpectedCount),ctx.num(v.total,formatExpectedCount)])),"Current cell alternatives"))]:[]),
          detail("Risk from the final savings and grade count",formula("R=\\tau+(T-V)/M,\\qquad T=W(0,n)"),p("T = ",ro("dp-T",t.T,formatExpectedCount),", selected V = ",ro("dp-V",t.V[t.chosenG][IDS.length],formatExpectedCount),", M = ",ctx.num(t.M,formatCount),". Among exactly h-grade solutions, the lowest risk uses ",ctx.num(t.chosenG,formatCount),t.chosenG===1?" grade.":" grades."),table("Best risk for each exact grade count",["h","Risk"],t.riskByG.slice(1).map((r,i)=>[ctx.num(i+1,formatCount),ctx.num(r,formatRisk)])),p("Equal-risk tolerance ",ctx.num(1e-12,formatSci),"; the engine favors fewer grades, then earlier cuts. Exactly equal scores stay in the same grade.")),
          h("div",{class:"prx-cg-summary"},
            h("p",{},tagNode(ctx,d,{orderWords:"posterior-mean order"}),"; risk ",ro("dp-risk",d.risk,formatRisk),"; ",ro("dp-grades",d.grade,formatGrades)," · ",blocksText(d.grade,IDS)),
            h("p",{},"Posterior-mean order: ",ro("dp-answer-order-size",d.family.size),Number(d.family.size)===1?" contiguous report. Full capped family: ":" contiguous reports. Full capped family: ",ro("dp-answer-capped-size",x.family.size),Number(x.family.size)===1?" report, risk ":" reports, risk ",ro("dp-answer-capped-risk",x.risk,formatRisk),".")),
          p("The answer is shown throughout; the step buttons inspect the calculation. Here enumeration agrees with the fixed-order answer. That agreement does not hold for every posterior."));
        // the read-out (review 044 replacement copy): the order's guarantee and family, its risk, and what exact
        // enumeration of the capped family finds, from the two engine results (both risks stay in the sentence, as in
        // the earlier read-out)
        const capped=Math.min(s.cap,IDS.length), one=Number(x.family.size)===1;
        const family=one?["the ",familySizeNode(ctx,x)," report with at most ",ctx.num(capped,formatCount)," grade"]:["all ",familySizeNode(ctx,x)," reports with at most ",ctx.num(capped,formatCount),capped===1?" grade":" grades"];
        const sameReport=d.grade.join()===x.grade.join(), sameRisk=Math.abs(d.risk-x.risk)<=x.tieTol;
        const finding=sameReport?[" finds the same report (risk ",ro("dp-readout-capped-risk",x.risk,formatRisk),"). The agreement is specific to these inputs."]
          :sameRisk?[" finds another of the equal-risk best reports (risk ",ro("dp-readout-capped-risk",x.risk,formatRisk),"). The agreement is specific to these inputs."]
          :[" finds a lower risk, ",ro("dp-readout-capped-risk",x.risk,formatRisk),", with another report."];
        ctx.readout.set(["Fixed-order DP: ",labelNode(ctx,d,{key:"dp"})," (",familySizeNode(ctx,d),Number(d.family.size)===1?" report":" reports","), risk ",ro("dp-readout-risk",d.risk,formatRisk),"; exact enumeration of ",...family,...finding]);
        function hNode(text){return ctx.h("span",{class:"prx-cg-blank"},text);}
      }

      // the risk axis from 0: the fixed-order candidate (an upper limit) and, after a solve, the bound L, the incumbent
      // U and the gap U − L; each label in the lowest of three rows above the axis where it does not touch another
      function drawAxis(s,d,r){
        const A=FIG.axis, U=r?.upper??null, L=r?.lower??null, closed=r!==undefined&&r!==null&&r.gap===0;
        const hi=Math.max(s.tau,d.risk,U??0,L??0);
        const width=Math.max(200,axisSlot.clientWidth||640), inner=width-A.marginLeft-A.marginRight;
        const px=v=>A.marginLeft+inner*v/hi;
        const items=[];
        const add=(key,value,prefix,anchor)=>items.push({key,value,prefix,anchor,text:`${prefix}${formatRisk(value)}`});
        if(closed&&U!==null)add("axis-bracket",U,"L = U ","middle");
        else{if(L!==null)add("axis-lower",L,"L ","end");if(U!==null)add("axis-upper",U,"U ","start");if(L!==null&&U!==null)items.push({key:"axis-gap",value:r.gap,prefix:"gap ",anchor:"middle",at:(L+U)/2,text:`gap ${formatRisk(r.gap)}`});}
        add("axis-candidate",d.risk,"◆ ","middle");
        const rows=Array.from({length:A.rows},()=>[]);
        for(const it of items){
          const at=it.at??it.value, w=it.text.length*A.charPx;
          let x0=it.anchor==="end"?px(at)-A.pad-w:it.anchor==="start"?px(at)+A.pad:px(at)-w/2;
          if(x0<0){x0=0;}if(x0+w>width){x0=width-w;}
          it.x0=x0;it.anchor0="start";
          const row=rows.findIndex(list=>list.every(([a,b])=>x0+w+A.pad<a||x0-A.pad>b));
          const k=row<0?A.rows-1:row;rows[k].push([x0,x0+w]);it.row=k+1;
        }
        const points=[{key:"candidate",x:d.risk,y:0,title:`Fixed-order candidate: risk ${formatRisk(d.risk)}, an upper limit on the unrestricted optimum.`}];
        if(L!==null)points.push({key:"lower",x:L,y:0,title:`Solver lower bound L: ${formatRisk(L)}.`});
        if(U!==null)points.push({key:"upper",x:U,y:0,title:`Solver incumbent U: risk ${formatRisk(U)}.`});
        // only the label rows in use take height (one row before a solve)
        const used=Math.max(...items.map(it=>it.row));
        plot(axisSlot,{height:A.marginTop+A.marginBottom+A.rowPx*(used+.6),marginLeft:A.marginLeft,marginRight:A.marginRight,marginTop:A.marginTop,marginBottom:A.marginBottom,
          x:{domain:[0,hi],label:"Risk",ticks:5},y:{domain:[0,used+.6],axis:null},
          marks:(c,P)=>[
            P.ruleY([0],{stroke:c.plotAxis}),
            ...(L!==null&&U!==null?[P.ruleY([0],{x1:L,x2:U,stroke:c.post,strokeWidth:8,strokeOpacity:.45}),P.ruleX([L,U],{y1:0,y2:.55,stroke:c.post,strokeWidth:2})]:U!==null?[P.ruleX([U],{y1:0,y2:.55,stroke:c.post,strokeWidth:2})]:L!==null?[P.ruleX([L],{y1:0,y2:.55,stroke:c.post,strokeWidth:2})]:[]),
            P.dot([{x:d.risk}],{x:"x",y:0,symbol:"diamond",r:6,fill:c.plotBg,stroke:c.plotFg,strokeWidth:2}),
            numLabel(P,items,{x:it=>(it.x0-A.marginLeft)/inner*hi,y:"row",value:it=>it.value,format:formatRisk,prefix:it=>it.prefix,hook:it=>it.key,textAnchor:"start",fill:c.plotFg}),
          ],
          alt:"Risk axis from 0: the fixed-order candidate is an upper limit on the unrestricted optimum; after a solve, the solver's lower bound L and incumbent U bracket that optimum, and U − L is the gap.",
          keyboard:{data:points,x:"x",y:"y",title:v=>v.title}});
      }

      // the family-bound example as two bars: exactly four grades, at most four grades
      function drawBook(){
        const K=FIG.book, rows=[{key:"exact",grades:4,risk:BOOK_EXACT.risk,words:"exactly "},{key:"cap",grades:4,risk:BOOK_CAP.risk,words:"at most "}];
        const hi=Math.max(...rows.map(v=>v.risk));
        plot(bookSlot,{height:K.height,marginLeft:K.marginLeft,marginRight:K.marginRight,marginTop:K.marginTop,marginBottom:K.marginBottom,
          x:{domain:[0,hi],axis:null},y:{domain:rows.map(v=>v.key),axis:null},
          marks:(c,P)=>[
            P.barX(rows,{x1:0,x2:"risk",y:"key",fill:v=>v.key==="exact"?c.plotFg:c.plotMuted,insetTop:7,insetBottom:7}),
            numLabel(P,rows,{x:0,y:"key",value:v=>v.grades,format:formatCount,prefix:v=>v.words,suffix:()=>" grades",textAnchor:"end",dx:-8,fill:c.plotFg}),
            numLabel(P,rows,{x:"risk",y:"key",value:v=>v.risk,format:formatRisk,hook:v=>`book-bar-${v.key}`,textAnchor:"start",dx:6,fill:c.plotFg,fontWeight:700}),
          ],
          alt:`Along the order A, B, C, D the best report with exactly ${formatCount(4)} grades has risk ${formatRisk(BOOK_EXACT.risk)}; with at most ${formatCount(4)} grades the risk is ${formatRisk(BOOK_CAP.risk)}.`,
          keyboard:{data:rows,x:"risk",y:"key",title:v=>`${v.words}${formatCount(v.grades)} grades: risk ${formatRisk(v.risk)}.`}});
      }

      function solverView(s){
        const m=solverModel(s), d=fixedOrderDP(m.E,{scores:m.mean,tau:s.tau});
        const key=solverKey(s), r=results.get(key), mine=running!==null&&running.key===key;
        solver.refresh({ hasResult: Boolean(r) });
        chip.setAttribute("data-state",running?"running":r?(r.status==="optimal"?"optimal":"done"):lastError?"error":"idle");
        chip.replaceChildren(...(running?["Solving ",ctx.num(running.solverN,formatCount)," units at τ ",ctx.num(running.tau,formatSetting),"…"]:r?[`Status: ${r.status}`]:lastError?["Not finished"]:["Not run at these settings"]));
        solverIntro.replaceChildren("A joint search over every report on the first ",ctx.num(s.solverN,formatCount)," league units, without a grade cap. Frozen draw seed ",ctx.num(SEED,formatSetting),"; normal prior mean ",ctx.num(0,formatSetting),", SD ",ctx.num(.15,formatSetting),". The browser loads HiGHS only when you press the button.");
        // scope: the candidate's guarantee, the solver's label (only at status optimal), and the certificate sentence
        const scope=[h("p",{},"Before the joint search: ",labelNode(ctx,d,{key:"league-dp"})," in ",familyNameNode(ctx,d),"; risk ",ro("solver-dp-risk",d.risk,formatRisk)," (",familySizeNode(ctx,d),Number(d.family.size)===1?" contiguous report).":" contiguous reports).")];
        if(r){
          exposeResult(ctx,r,"solver");
          const lab=labelNode(ctx,r,{key:"solver"});
          scope.push(lab?h("p",{"data-prx-solver-label":""},lab," in ",familyNameNode(ctx,r),"; ",familySizeNode(ctx,r)," reports."):p("The run has not established optimality within solver tolerances. An incumbent, if present, is only a feasible report; read the lower bound and gap."));
        }
        scope.push(p("A solver status or a zero gap is not an exact arithmetic certificate; it concerns optimization of the supplied probabilities only. It does not establish that the posterior model is correct."));
        scopeLine.replaceChildren(...scope);
        if(r)solverNote.replaceChildren();
        else solverNote.replaceChildren(lastError?"The solver could not finish. Check that the local solver bundle is available, then press the button to retry.":mine?"The worker is running. You can keep using the other views.":"No joint solve at these settings yet. Changing τ, unit count or time limit requires another button press.");
        solverNote.hidden=Boolean(r);
        drawAxis(s,d,r);
        if(r){
          resultSlot.replaceChildren(table("Joint solver result",["Quantity","Value"],[
            ["Status",h("span",{"data-prx-solver-status":""},r.status)],
            ["Incumbent risk Uᴿ",ro("solver-upper",r.upper,formatRisk)],
            ["Lower bound Lᴿ",ro("solver-lower",r.lower,formatRisk)],
            ["Absolute risk gap Uᴿ − Lᴿ",ro("solver-gap",r.gap,formatRisk)],
            ["Elapsed seconds",ro("solver-seconds",r.seconds,formatExpectedCount)],
            ["Incumbent grade vector",r.grade===null?ro("solver-grades",null,formatRisk):ro("solver-grades",r.grade,formatGrades)],
          ],{class:"prx-cg-table prx-cg-status"}));
          ctx.readout.set(["Joint search status: ",r.status,". Incumbent risk ",ctx.num(r.upper,formatRisk),"; lower bound ",ctx.num(r.lower,formatRisk),"; absolute risk gap ",ctx.num(r.gap,formatRisk),"."]);
        }else{
          resultSlot.replaceChildren();
          ctx.readout.set(["Fixed-order candidate risk ",ctx.num(d.risk,formatRisk),". Joint solver ",mine?"running.":"not run at these settings."]);
        }
        drawBook();
        const sourceRows=m.ids.map((id,i)=>[id,ctx.num(DRAW.estimate[i],formatExpectedCount),ctx.num(LEAGUE.se[i],formatExpectedCount),ctx.num(m.mean[i],formatExpectedCount),ctx.num(m.sd[i],formatExpectedCount)]);
        inputsBox.summary.replaceChildren("Frozen league inputs",sum(" · the first ",ctx.num(s.solverN,formatCount)," units: estimate, SE and normal posterior"));
        inputsBox.body.replaceChildren(scroll(table("The supplied independent normal posteriors",["Unit","Estimate","SE","Posterior mean","Posterior SD"],sourceRows,{class:"prx-cg-table prx-sticky-first"}),"League input table"));
        accountingBox.body.replaceChildren(
          ...(r?[formula("U_R=\\tau+U_Z/M,\\quad L_R=\\tau+L_Z/M,\\quad U_R-L_R=(U_Z-L_Z)/M"),p("Solver's total Uᶻ = ",ro("solver-objective",r.objective===null?null:r.offset+r.objective,formatExpectedCount),"; objective lower bound Lᶻ = ",ro("solver-bound",r.bound===null?null:r.offset+r.bound,formatExpectedCount),"; M = ",ro("solver-M",pairCount(s.solverN)),". These totals add the constant offset ",ro("solver-offset",r.offset,formatExpectedCount)," to the raw incumbent objective ",ro("solver-raw-objective",r.objective,formatExpectedCount)," and raw lower bound ",ro("solver-raw-bound",r.bound,formatExpectedCount),", respectively. A relative objective gap is not a risk gap.")]:[]),
          p("The absolute and relative MIP stopping-gap settings are both ",ctx.num(0,formatCount),". HiGHS still uses its internal floating-point feasibility and objective tolerances. The time limit can stop the search with an incumbent and an open gap."));
      }
      return {render(s){
        const viewport={x:ctx.win.scrollX,y:ctx.win.scrollY};
        current=s;view.set(s.view);n.set(s.n);cap.set(s.cap);tau.set(s.tau);pat.set(s.pattern);invalid.set(s.invalid);sn.set(s.solverN);limit.set(s.timeLimit);
        const v=s.view;
        n.root.hidden=v!=="count";cap.root.hidden=v!=="count"&&v!=="dp";sn.root.hidden=v!=="solver";tau.root.hidden=v!=="dp"&&v!=="solver";limit.root.hidden=v!=="solver";
        pat.root.hidden=v!=="encoding";invalid.root.hidden=v!=="encoding";solveBox.hidden=v!=="solver";
        for(const [k,node] of Object.entries(sections)){node.hidden=k!==v;if(k!==v)for(const slot of dynamic[k])slot.replaceChildren();}
        if(v==="count")counts(s);else if(v==="encoding")encoding(s);else if(v==="solver")solverView(s);else dp(s);
        // Replacing trace rows can trigger scroll anchoring; keep the reader at the same page position.
        if(v==="dp"&&ctx.win.scrollY!==viewport.y)ctx.win.scrollTo({left:viewport.x,top:viewport.y,behavior:"instant"});
      }};
    }
  });
}
