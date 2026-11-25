// App entry point for 2.16 computing-grades (frame: "v2" redesign); shared domain exports preserved (S1-02).
export * from "../shared/domain/computing-grades.js";

import { mobileControls } from "../shared/mobile-controls.js";
import { createBrowserSolveController, placeCountLabels } from "../shared/domain/computing-grades.js";
import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, palette, plot } from "../shared/chart.js";
import {
  blocksText,
  dataNum,
  formatCount,
  formatExpectedCount,
  formatGrades,
  formatReadoutExpected,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  tickLabel,
} from "../shared/format.js";
import { exposeResult, familyNameNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  drawLeague,
  enumerateReports,
  errorArray,
  exactOptimum,
  familySize,
  finiteLawPairwise,
  fixedOrderDP,
  league30,
  normalPosterior,
  pairCount,
  weakRelation,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

const SVGNS = "http://www.w3.org/2000/svg";
const IDS = SIX.arrays.one.ids;
const E = {
  ids: IDS,
  criteria: SIX.arrays.one.criteria,
  e: SIX.arrays.one.e.map((m) => m.map((r) => r.map((v) => (v === null ? NaN : v)))),
};
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
const POSTERIOR = normalPosterior(DRAW.estimate, LEAGUE.se, { priorMean: 0, priorSd: 0.15 });
const BOOK = finiteLawPairwise(
  [
    [[4, 4], [3, 2], [2, 3], [1, 1]],
    [[3, 1], [4, 2], [2, 3], [1, 4]],
  ],
  [0.75, 0.25],
  { ids: ["A", "B", "C", "D"], criteria: ["first", "second"] },
);
const BOOK_EXACT = fixedOrderDP(BOOK, { order: [0, 1, 2, 3], G: 4, exact: 4, tau: 0.25, w: [0.6, 0.4] });
const BOOK_CAP = fixedOrderDP(BOOK, { order: [0, 1, 2, 3], G: 4, tau: 0.25, w: [0.6, 0.4] });

// Must match domain/computing-grades.js placeCountLabels geometry for view=count.
const COUNT_FIG = Object.freeze({
  height: 310,
  marginTop: 24,
  marginBottom: 45,
  marginLeft: 72,
  marginRight: 24,
  dx: 8,
});

const V2_CSS = `
.prx-cg.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 100%;
}
.prx-cg.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets {
  flex: 1 1 100%;
}
.prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: flex-end;
  flex: 1 1 100%;
  min-width: 0;
}
.prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-controls > * {
  flex: 1 1 11rem;
}
.prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-controls > .prx-cg-solve {
  flex: 0 1 auto;
}
.prx-cg .prx-cg-controls[hidden],
.prx-cg [hidden] {
  display: none !important;
}
.prx-cg .prx-cg-solve {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
  align-items: center;
}
.prx-cg .prx-cg-chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--prx-control-height, 2.25rem);
  padding: 0.15rem 0.7rem;
  border: 1px solid var(--prx-border-strong);
  border-radius: 999px;
  background: var(--prx-bg);
  color: var(--prx-fg);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.prx-cg .prx-cg-chip[data-state="running"] {
  border-style: dashed;
  border-color: var(--prx-accent);
}
.prx-cg .prx-cg-chip[data-state="optimal"] {
  border-color: var(--prx-accent);
  font-weight: 600;
}
.prx-cg .prx-cg-chip[data-state="error"] {
  border-color: var(--prx-err-text);
}
.prx-cg .prx-cg-solve [aria-disabled="true"],
.prx-cg .prx-cg-replay [aria-disabled="true"] {
  opacity: 0.55;
  cursor: default;
}
.prx-cg .prx-cg-body,
.prx-cg .prx-cg-view,
.prx-cg .prx-cg-panel {
  min-width: 0;
}
.prx-cg .prx-cg-svg {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.prx-cg .prx-stage .prx-cg-count-key {
  width: 2.3rem;
  height: 1rem;
  flex: none;
}
.prx-cg .prx-stage .prx-cg-count-legend {
  margin: 0.35rem 0 0;
}
.prx-cg .prx-stage .prx-cg-count-legend .prx-key {
  color: var(--prx-plot-fg);
}
.prx-cg .prx-stage .prx-cg-count-legend .prx-cg-count-muted {
  color: var(--prx-plot-muted);
}
.prx-cg .prx-cg-dp-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.9rem;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--prx-border);
  font-size: 0.875rem;
}
.prx-cg .prx-cg-dp-status {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.prx-cg .prx-cg-replay {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.prx-cg .prx-cg-encoding-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 0.75rem 1rem;
  align-items: start;
}
.prx-cg .prx-cg-encoding-line,
.prx-cg .prx-cg-solver-head,
.prx-cg .prx-cg-solver-note {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
}
.prx-cg .prx-cg-solver-head {
  margin: 0 0 0.35rem;
  font-weight: 600;
}
.prx-cg .prx-cg-solver-note[data-error="true"] {
  color: var(--prx-err-text);
  font-weight: 600;
}
.prx-cg .prx-cg-patterns {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.75rem), 1fr));
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0;
  font-size: 0.84375rem;
}
.prx-cg .prx-cg-patterns li {
  margin: 0;
  padding: 0;
  min-width: 0;
}
.prx-cg .prx-cg-pattern {
  width: 100%;
  text-align: left;
  font-variant-numeric: tabular-nums;
}
.prx-cg .prx-cg-broken {
  grid-column: 1 / -1;
}
.prx-cg .prx-cg-broken .prx-cg-pattern {
  border-style: dashed;
}
.prx-cg .prx-cg-scope {
  margin: 0.45rem 0 0;
  font-size: var(--prx-text-sm, 0.84375rem);
  color: var(--prx-fg-muted);
}
.prx-cg .prx-cg-scope p {
  margin: 0.15rem 0;
}
.prx-cg .prx-cg-note {
  font-size: 0.9em;
  color: var(--prx-fg-muted);
  margin: 0.35rem 0 0.55rem;
}
.prx-cg .prx-cg-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
  margin: 0.45rem 0;
}
.prx-cg .prx-cg-table th,
.prx-cg .prx-cg-table td {
  border: 1px solid var(--prx-border);
  padding: 0.4rem 0.45rem;
  text-align: right;
  white-space: nowrap;
}
.prx-cg .prx-cg-table.prx-sticky-first {
  border-collapse: separate;
  border-spacing: 0;
}
.prx-cg .prx-cg-table.prx-sticky-first th,
.prx-cg .prx-cg-table.prx-sticky-first td {
  border-width: 0 1px 1px 0;
}
.prx-cg .prx-cg-table.prx-sticky-first tr > :first-child {
  border-left-width: 1px;
}
.prx-cg .prx-cg-table.prx-sticky-first thead tr > * {
  border-top-width: 1px;
}
.prx-cg .prx-cg-table caption {
  text-align: left;
  font-weight: 600;
  margin: 0.25rem 0;
}
.prx-cg .prx-cg-table th {
  color: var(--prx-fg-heading);
  font-weight: 600;
}
.prx-cg .prx-cg-table .prx-cg-current {
  outline: 3px solid var(--prx-accent);
  outline-offset: -3px;
  font-weight: 700;
}
.prx-cg .prx-cg-table .prx-cg-path {
  background: var(--prx-bg-raised);
  box-shadow: inset 0 -3px var(--prx-border-strong);
}
.prx-cg .prx-cg-table .prx-cg-blank {
  color: var(--prx-fg-muted);
  font-size: 0.85em;
}
.prx-cg .prx-cg-table .prx-cg-violation {
  outline: 3px solid var(--prx-err-text);
  outline-offset: -3px;
  font-weight: 700;
}
.prx-cg .prx-cg-small {
  max-width: 27rem;
}
.prx-cg .prx-cg-status {
  table-layout: fixed;
  max-width: 36rem;
  margin-top: 0.5rem;
}
.prx-cg .prx-cg-status th {
  text-align: left;
  white-space: normal;
  overflow-wrap: normal;
  width: 44%;
}
.prx-cg .prx-cg-status td,
.prx-cg .prx-cg-status td .prx-num {
  white-space: normal;
  overflow-wrap: anywhere;
}
.prx-cg .prx-cg-summary {
  border-left: 3px solid var(--prx-accent);
  padding: 0.25rem 0.75rem;
  margin: 0.55rem 0;
}
.prx-cg .prx-cg-summary p {
  margin: 0.25rem 0;
}
.prx-cg .prx-cg-details {
  margin-top: 0.65rem;
}
.prx-cg .prx-cg-formula {
  overflow-x: auto;
  padding: 0.25rem 0;
}
.prx-cg .prx-cg-sum {
  font-weight: 400;
  color: var(--prx-fg-muted);
}
@media (max-width: 50em) {
  .prx-cg .prx-cg-encoding-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (pointer: coarse), (max-width: 48em) {
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-toggle label {
    display: inline-flex;
    align-items: center;
    min-height: var(--prx-touch-target, 2.75rem);
  }
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-pattern,
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-replay .prx-btn,
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-solve .prx-btn {
    min-height: var(--prx-touch-target, 2.75rem);
    min-width: var(--prx-touch-target, 2.75rem);
  }
}
@media (max-width: 34em) {
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-title {
    margin-bottom: 0.25rem;
    font-size: 0.98rem;
  }
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.35rem 0.5rem;
    margin-bottom: 0.35rem;
  }
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-toolbar .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-toolbar .prx-seg {
    padding: 0.15rem 0.48rem;
  }
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-controls > *,
  .prx-cg.prx-widget[data-prx-frame="v2"] .prx-cg-controls > .prx-cg-solve {
    flex-basis: 100%;
  }
  .prx-cg .prx-cg-dp-bar {
    gap: 0.3rem 0.5rem;
    margin-top: 0.3rem;
    padding-top: 0.3rem;
  }
  .prx-cg .prx-cg-scope {
    margin-top: 0.3rem;
    line-height: 1.32;
  }
  .prx-cg .prx-cg-patterns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;

function svgEl(doc, tag, attrs = {}, ...children) {
  const node = doc.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    node.append(typeof c === "object" ? c : String(c));
  }
  return node;
}

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

function slotWidth(slot, ctx) {
  const w = Math.round(slot.clientWidth || (ctx.width() ? ctx.width() - 32 : 640));
  return Math.max(240, w);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "computing-grades",
    frame: "v2",
    className: "prx-cg",
    css: V2_CSS,
    title: "What does each search cover?",
    keys: {
      view: { type: "choice", values: ["count", "encoding", "dp", "solver"], value: "dp" },
      n: { type: "integer", min: 2, max: 12, step: 1, value: 6 },
      cap: { type: "integer", min: 1, max: 6, step: 1, value: 3 },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      pattern: { type: "integer", min: 0, max: 12, step: 1, value: 0 },
      invalid: { type: "boolean", value: false },
      step: { type: "integer", min: 0, max: 21, step: 1, value: 15 },
      solverN: { type: "integer", min: 3, max: 20, step: 1, value: 20 },
      timeLimit: { type: "number", min: 0.1, max: 3, step: 0.1, value: 2 },
    },
    build(ctx) {
      const { doc, h } = ctx;
      let current = null;
      let lastError = null;
      let running = null;
      let dpCellCount = 0;
      const exactCache = new Map();
      const dpCache = new Map();
      const results = new Map();

      const roSpan = (key, v, f = formatCount) => {
        const x = ctx.num(v, f(v));
        x.setAttribute("data-prx-readout", key);
        return x;
      };
      const p = (...parts) => h("p", { class: "prx-cg-note" }, ...parts);
      const sum = (...parts) => h("span", { class: "prx-cg-sum" }, ...parts);
      const detail = (title, ...nodes) => h("section", { class: "prx-cg-details" }, ctx.panelTitle(title), ...nodes);
      const scroll = (node, label) => {
        const x = h("div", {}, node);
        ctx.scrollRegion(x, label);
        return x;
      };
      const formula = (tex) => {
        const x = h("div", { class: "prx-cg-formula" });
        const f = formulaNums();
        const source = tex.replace(/\d+/g, (v) => f.num(Number(v), formatCount(Number(v))));
        renderTex(x, source, { display: true, nums: f.raws });
        ctx.scrollRegion(x, "Mathematical expression");
        return x;
      };
      const table = (caption, heads, rows, attrs = {}) =>
        h(
          "table",
          { class: "prx-cg-table", ...attrs },
          h("caption", {}, caption),
          h("thead", {}, h("tr", {}, ...heads.map((x) => h("th", { scope: "col" }, x)))),
          h(
            "tbody",
            {},
            ...rows.map((r) => h("tr", {}, ...r.map((x, i) => h(i ? "td" : "th", i ? {} : { scope: "row" }, x)))),
          ),
        );

      const getDP = (s) => {
        const k = `${s.cap}/${s.tau}`;
        if (!dpCache.has(k)) dpCache.set(k, fixedOrderDP(E, { scores: SCORES, G: s.cap, tau: s.tau, trace: true }));
        return dpCache.get(k);
      };
      const getExact = (s) => {
        const k = `${s.cap}/${s.tau}`;
        if (!exactCache.has(k)) exactCache.set(k, exactOptimum(E, { family: { kind: "atMost", G: s.cap }, tau: s.tau }));
        return exactCache.get(k);
      };
      const solverKey = (s) => `${s.solverN}/${s.tau}/${s.timeLimit}`;
      const solverModel = (s) => {
        const ids = LEAGUE.ids.slice(0, s.solverN);
        const mean = POSTERIOR.mean.slice(0, s.solverN);
        const sd = POSTERIOR.sd.slice(0, s.solverN);
        return { ids, mean, sd, E: errorArray(mean, sd, { ids, criteria: ["score"] }) };
      };

      // --- Toolbar: view chips -> presets -> view-scoped controls (X-18: preset row stays fixed)
      const view = ctx.segmented({
        label: "Search view",
        name: "view",
        value: ctx.state.view,
        options: [
          { value: "count", label: "Family sizes" },
          { value: "encoding", label: "Binary encoding" },
          { value: "dp", label: "Dynamic program" },
          { value: "solver", label: "Joint solver" },
        ],
        onChange: (v) => ctx.set({ view: v }),
      });
      const n = ctx.slider({ label: "Units in the count", name: "n", ...ctx.key("n"), onInput: (v) => ctx.set({ n: v }) });
      const cap = ctx.slider({ label: "At most this many grades", name: "cap", ...ctx.key("cap"), onInput: (v) => ctx.set({ cap: v }) });
      const sn = ctx.slider({ label: "First units of the frozen league", name: "solverN", ...ctx.key("solverN"), onInput: (v) => ctx.set({ solverN: v }) });
      const tau = ctx.slider({ label: "Withholding cost τ", name: "tau", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      const limit = ctx.slider({ label: "Solver time limit (seconds)", name: "timeLimit", ...ctx.key("timeLimit"), onInput: (v) => ctx.set({ timeLimit: v }) });
      const pat = ctx.slider({ label: "Valid report pattern (zero-based index)", name: "pattern", ...ctx.key("pattern"), onInput: (v) => ctx.set({ pattern: v, invalid: false }) });
      const invalid = ctx.toggle({ label: "Show a transitivity violation", name: "invalid", checked: false, onChange: (v) => ctx.set({ invalid: v }) });

      const solver = createBrowserSolveController(ctx, {
        getProblem() {
          if (!current) return null;
          const state = { ...current };
          running = { key: solverKey(state), solverN: state.solverN, tau: state.tau };
          return { E: solverModel(state).E, options: { tau: state.tau, timeLimit: state.timeLimit }, key: solverKey(state) };
        },
        onResult(result, key) {
          results.set(key, result);
        },
        onError(error) {
          lastError = error;
        },
        onBusy(busy) {
          if (!busy) running = null;
          if (busy) ctx.root.setAttribute("aria-busy", "true");
          else ctx.root.removeAttribute("aria-busy");
          ctx.requestRender(busy ? "solver-start" : "solver-result");
        },
      });
      const chip = h("span", { class: "prx-cg-chip", "data-prx-solver-chip": "" });
      const solveBox = h("div", { class: "prx-cg-solve" }, solver.root, chip);

      const viewControls = h("div", { class: "prx-cg-controls" }, n.root, cap.root, sn.root, tau.root, limit.root, pat.root, invalid.root, solveBox);
      ctx.controls.append(view.root, viewControls);

      const primaryByView = { count: n.root, encoding: pat.root, dp: cap.root, solver: solveBox };
      const syncPrimaryControl = (v) => {
        for (const [k, node] of Object.entries(primaryByView)) {
          if (k === v) node.setAttribute("data-prx-primary-control", "");
          else node.removeAttribute("data-prx-primary-control");
        }
      };

      // --- Stage: 4 view panels inside .prx-cg-body; scope line directly below stage
      const sections = Object.fromEntries(
        ["count", "encoding", "dp", "solver"].map((k) => [
          k,
          h("div", { class: `prx-cg-view prx-cg-view-${k}`, "data-prx-view": k }),
        ]),
      );
      const body = h("div", { class: "prx-cg-body" }, sections.count, sections.encoding, sections.dp, sections.solver);
      ctx.stage.append(body);

      const scopeBox = h("div", { class: "prx-scope prx-cg-scope", "data-prx-part": "scope notes", "data-prx-scope": "" });
      ctx.stage.after(scopeBox);

      // --- Disclosures: Data and Method (view-scoped inner wrappers keep DOM clean and audit hooks preserved)
      const dataBox = ctx.dataBox("Data and exact values");
      const methodBox = ctx.methodBox("Method and search details");
      const dataViews = Object.fromEntries(["count", "encoding", "dp", "solver"].map((k) => [k, h("div", {})]));
      const methodViews = Object.fromEntries(["count", "encoding", "dp", "solver"].map((k) => [k, h("div", {})]));
      dataBox.body.append(dataViews.count, dataViews.encoding, dataViews.dp, dataViews.solver);
      methodBox.body.append(methodViews.count, methodViews.encoding, methodViews.dp, methodViews.solver);

      // View 1 (count): log-scale family-size figure + compact legend
      const countPlot = h("div", { class: "prx-cg-count-chart" });
      const countLegend = h("div", { class: "prx-legend prx-cg-count-legend", "data-prx-part": "legend" });
      for (const f of COUNT_FAMILIES) {
        const svg = svgEl(doc, "svg", { viewBox: "0 0 37 16", class: "prx-cg-count-key", "aria-hidden": "true" });
        svg.append(
          svgEl(doc, "line", {
            x1: 0,
            y1: 8,
            x2: 37,
            y2: 8,
            stroke: "currentColor",
            "stroke-width": 2,
            ...(f.dash ? { "stroke-dasharray": f.dash } : {}),
          }),
        );
        const shape =
          f.symbol === "circle"
            ? svgEl(doc, "circle", { cx: 18.5, cy: 8, r: 3, fill: "var(--prx-plot-bg)", stroke: "currentColor", "stroke-width": 1.5 })
            : f.symbol === "square"
              ? svgEl(doc, "rect", { x: 15.5, y: 5, width: 6, height: 6, fill: "var(--prx-plot-bg)", stroke: "currentColor", "stroke-width": 1.5 })
              : svgEl(doc, "path", { d: "M18.5 3.5 23 8 18.5 12.5 14 8Z", fill: "var(--prx-plot-bg)", stroke: "currentColor", "stroke-width": 1.5 });
        svg.append(shape);
        countLegend.append(h("span", { class: `prx-key${f.ink === "plotMuted" ? " prx-cg-count-muted" : ""}` }, svg, f.kind));
      }
      sections.count.append(countPlot, countLegend);

      // View 2 (encoding): 3-unit directed-graph + binary matrix SVG alongside 14 pattern chips
      const encodingSvgSlot = h("div", { class: "prx-cg-encoding-svg" });
      const encodingLine = h("p", { class: "prx-cg-encoding-line" });
      const chipButtons = PATTERNS.map((g, i) => {
        const b = h(
          "button",
          {
            type: "button",
            class: "prx-seg prx-cg-pattern",
            "aria-pressed": "false",
            "data-prx-focus-key": `pattern-chip:${i}`,
          },
          ctx.num(i, formatCount),
          ": ",
          ctx.num(g, formatGrades),
          " · ",
          blocksText(g, ["A", "B", "C"]),
        );
        ctx.listen(b, "click", () => ctx.set({ pattern: i, invalid: false }));
        return b;
      });
      const brokenButton = h(
        "button",
        {
          type: "button",
          class: "prx-seg prx-cg-pattern",
          "aria-pressed": "false",
          "data-prx-focus-key": "pattern-chip:broken",
        },
        "Show a broken pattern",
      );
      ctx.listen(brokenButton, "click", () => ctx.set({ invalid: true }));
      const chipList = h(
        "ul",
        { class: "prx-cg-patterns", "aria-label": "Report patterns on three units" },
        ...chipButtons.map((b) => h("li", {}, b)),
        h("li", { class: "prx-cg-broken" }, brokenButton),
      );
      sections.encoding.append(
        h(
          "div",
          { class: "prx-cg-encoding-grid" },
          h("div", { class: "prx-cg-panel" }, encodingSvgSlot, encodingLine),
          h("div", { class: "prx-cg-panel" }, ctx.panelTitle("All valid patterns"), chipList),
        ),
      );

      // View 3 (dp): primary cut/partition + risk/saving bars SVG + compact stepper bar
      const dpSvgSlot = h("div", { class: "prx-cg-dp-svg" });
      const dpStatus = h("p", { class: "prx-cg-dp-status" });
      const startButton = ctx.button({ label: "Start table", key: "dp-start", onClick: () => ctx.set({ step: 0 }) });
      const nextButton = ctx.button({
        label: "Next cell",
        key: "dp-next",
        onClick: () => {
          const step = Math.min(ctx.state.step, dpCellCount);
          ctx.set({ step: Math.min(step + 1, dpCellCount) });
        },
      });
      const fillButton = ctx.button({ label: "Fill table", key: "dp-fill", onClick: () => ctx.set({ step: dpCellCount }) });
      const replay = h(
        "div",
        { class: "prx-cg-replay", role: "group", "aria-label": "Replay the table" },
        startButton.root,
        nextButton.root,
        fillButton.root,
      );
      const dpBar = h("div", { class: "prx-cg-dp-bar" }, dpStatus, replay);
      sections.dp.append(dpSvgSlot, dpBar);

      // View 4 (solver): bound/risk comparison SVG + lazy status note + solver result table
      const solverHead = h("p", { class: "prx-cg-solver-head" });
      const solverNote = h("p", { class: "prx-cg-solver-note" });
      const solverSvgSlot = h("div", { class: "prx-cg-solver-svg" });
      const resultSlot = h("div", { class: "prx-cg-result" });
      sections.solver.append(solverHead, solverNote, solverSvgSlot, resultSlot);

      // Persistent book counterexample explanation inside methodViews.solver (keeps book-exact & book-cap in DOM across states)
      const solverMethodDynamic = h("div", {});
      const bookProse = h(
        "section",
        { class: "prx-cg-summary prx-cg-details" },
        ctx.panelTitle("Why a bound needs its family"),
        p(
          "The four-unit, two-criterion example fixes order A, B, C, D, weights ",
          ctx.num(0.6, formatSetting),
          " and ",
          ctx.num(0.4, formatSetting),
          ", and τ = ",
          ctx.num(0.25, formatSetting),
          ". With exactly ",
          ctx.num(4, formatCount),
          " grades, its optimum is ",
          roSpan("book-exact", BOOK_EXACT.risk, formatReadoutRisk),
          "; with at most ",
          ctx.num(4, formatCount),
          " grades, the same order reaches risk ",
          roSpan("book-cap", BOOK_CAP.risk, formatReadoutRisk),
          ".",
        ),
        p(
          "Because the exact-grade family's lower bound exceeds a feasible risk in the larger capped family, it cannot serve as that larger family's lower bound. Likewise, a fixed-order lower bound never bounds an unrestricted search.",
        ),
      );
      methodViews.solver.append(solverMethodDynamic, bookProse);

      const dynamic = {
        count: [countPlot, dataViews.count, methodViews.count],
        encoding: [encodingSvgSlot, encodingLine, dataViews.encoding, methodViews.encoding],
        dp: [dpSvgSlot, dpStatus, dataViews.dp, methodViews.dp],
        solver: [solverHead, solverNote, solverSvgSlot, resultSlot, dataViews.solver, solverMethodDynamic],
      };

      function drawCounts(s) {
        const rows = Array.from({ length: 11 }, (_, i) => {
          const unitCount = i + 2;
          return {
            n: unitCount,
            all: familySize(unitCount, { kind: "all" }),
            capped: familySize(unitCount, { kind: "atMost", G: Math.min(s.cap, unitCount) }),
            ordered: familySize(unitCount, { kind: "order", order: Array.from({ length: unitCount }, (_, j) => j), G: Math.min(s.cap, unitCount) }),
          };
        });
        const selected = rows[s.n - 2];
        const points = rows.flatMap((r) => [
          { n: r.n, size: Number(r.all), kind: "All reports" },
          { n: r.n, size: Number(r.capped), kind: "Capped reports" },
          { n: r.n, size: Number(r.ordered), kind: "Cuts of one order" },
        ]);
        scopeBox.replaceChildren(
          h(
            "p",
            {},
            "Exact counts. A search answers only within the family it covers: all reports, at most ",
            ctx.num(s.cap, formatCount),
            s.cap === 1 ? " grade, or the cuts of one order." : " grades, or the cuts of one order.",
          ),
        );
        const C = COUNT_FIG;
        const width = Math.max(240, countPlot.clientWidth || slotWidth(ctx.stage, ctx));
        const labels = placeCountLabels(width, rows, selected, s.n);
        const countLabels = (P, c, anchor) =>
          numLabel(P, labels.filter((l) => l.shown && l.anchor === anchor), {
            x: () => s.n,
            y: "y",
            value: (l) => l.v,
            format: formatCount,
            hook: (l) => `count-label-${l.key}`,
            textAnchor: anchor,
            dx: anchor === "end" ? -C.dx : C.dx,
            fill: c.plotFg,
            stroke: c.plotBg,
            strokeWidth: 4,
            paintOrder: "stroke",
            fontWeight: 700,
          });
        plot(countPlot, {
          width,
          height: C.height,
          marginTop: C.marginTop,
          marginLeft: C.marginLeft,
          marginRight: C.marginRight,
          marginBottom: C.marginBottom,
          x: { label: "Units", ticks: 6, domain: [2, 12] },
          y: { label: "Reports (log scale)", type: "log", domain: [1, 1e11], ticks: [1, 1e2, 1e4, 1e6, 1e8, 1e10], grid: true },
          marks: (c, P) => [
            P.ruleX([s.n], { stroke: c.plotMuted, strokeDasharray: "3 3" }),
            ...COUNT_FAMILIES.flatMap((f) => {
              const data = points.filter((r) => r.kind === f.kind);
              return [
                P.line(data, { x: "n", y: "size", stroke: c[f.ink], strokeWidth: 2, strokeDasharray: f.dash }),
                P.dot(data, { x: "n", y: "size", symbol: f.symbol, fill: c.plotBg, stroke: c[f.ink], strokeWidth: 1.5, r: 3.5 }),
              ];
            }),
            countLabels(P, c, "end"),
            countLabels(P, c, "start"),
          ],
          table: {
            caption: "Exact numbers of reports by units and family",
            columns: [
              { label: "Units", value: "n", format: formatCount },
              { label: "All", value: "all", format: formatCount },
              { label: "At most the selected grade cap", value: "capped", format: formatCount },
              { label: "Contiguous cuts", value: "ordered", format: formatCount },
            ],
            rows,
          },
          keyboard: {
            data: points,
            x: "n",
            y: "size",
            title: (r) => `${formatCount(r.n)} units, ${r.kind}: ${formatCount(r.size)} ${Number(r.size) === 1 ? "report" : "reports"}.`,
          },
        });

        const t = table(
          "Exact counts (the cap cannot exceed the number of units)",
          ["Units", "All reports", "Capped", "One order"],
          rows.map((r) => [ctx.num(r.n, formatCount), ctx.num(r.all, formatCount), ctx.num(r.capped, formatCount), ctx.num(r.ordered, formatCount)]),
          { class: "prx-cg-table prx-sticky-first" },
        );
        dataBox.summary.replaceChildren(
          "Data and exact counts",
          sum(" · ", ctx.num(rows.length, formatCount), " rows, ", ctx.num(rows[0].n, formatCount), " to ", ctx.num(rows[rows.length - 1].n, formatCount), " units"),
        );
        dataViews.count.replaceChildren(scroll(t, "Family count table"));
        methodBox.summary.replaceChildren("Method and log-scale notes");
        methodViews.count.replaceChildren(
          p(
            "The vertical axis is logarithmic: equal vertical steps multiply the number of reports. Capped counts allow at most ",
            ctx.num(s.cap, formatCount),
            s.cap === 1 ? " grade; cuts keep a declared strict order." : " grades; cuts keep a declared strict order.",
          ),
        );
        ctx.readout.set([
          "With ",
          roSpan("count-n", s.n),
          " units: ",
          roSpan("count-all", selected.all),
          " unrestricted reports; ",
          roSpan("count-capped", selected.capped),
          " with at most ",
          ctx.num(s.cap, formatCount),
          s.cap === 1 ? " grade; " : " grades; ",
          roSpan("count-order", selected.ordered),
          Number(selected.ordered) === 1 ? " cut of one order." : " cuts of one order.",
        ]);
      }

      function drawEncodingSvg(slot, s, g, z) {
        const W = slotWidth(slot, ctx);
        const pal = palette(slot);
        const compact = W < 360;
        const H = 204;
        const svg = svgEl(doc, "svg", {
          viewBox: `0 0 ${W} ${H}`,
          width: W,
          height: H,
          class: "prx-cg-svg",
          role: "img",
          "aria-label": s.invalid
            ? "Directed relation graph and 3 by 3 binary matrix showing a non-transitive cycle on A, B and C."
            : `Directed relation graph and 3 by 3 binary matrix for grade vector ${formatGrades(g)}.`,
        });

        const grp = svgEl(doc, "g", { "aria-hidden": "true", "font-family": pal.fontSans });
        const titleNode = s.invalid
          ? svgEl(
              doc,
              "text",
              { x: 8, y: 18, "font-size": 13, "font-weight": 700, fill: pal.errText },
              compact ? "Cycle: C ≥ B ≥ A, yet A > C" : "Transitivity fails: C ≥ B ≥ A, yet A > C",
            )
          : svgEl(
              doc,
              "text",
              { x: 8, y: 18, "font-size": 13, "font-weight": 700, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, "Pattern "),
              svgEl(doc, "tspan", { "data-num": dataNum(s.pattern) }, formatCount(s.pattern)),
              svgEl(doc, "tspan", {}, `: ${blocksText(g, ["A", "B", "C"])}`),
            );
        grp.append(titleNode);

        // Left half: 3-unit directed graph (A top, B bottom-left, C bottom-right)
        const leftW = Math.floor(W * 0.48);
        const cx = Math.max(58, Math.floor(leftW * 0.5));
        const dx = Math.min(54, Math.max(36, Math.floor(leftW * 0.34)));
        const pts = [
          { id: "A", x: cx, y: 58 },
          { id: "B", x: cx - dx, y: 154 },
          { id: "C", x: cx + dx, y: 154 },
        ];
        const G = Math.max(...g);
        const fills = gradeColors(G, pal);
        const nodeR = 17;

        const drawArrow = (p1, p2, bidir, errEdge) => {
          const vx = p2.x - p1.x;
          const vy = p2.y - p1.y;
          const len = Math.hypot(vx, vy) || 1;
          const ux = vx / len;
          const uy = vy / len;
          const padStart = bidir ? nodeR + 7 : nodeR + 3;
          const padEnd = nodeR + 7;
          const x1 = p1.x + ux * padStart;
          const y1 = p1.y + uy * padStart;
          const x2 = p2.x - ux * padEnd;
          const y2 = p2.y - uy * padEnd;
          const stroke = errEdge ? pal.err : bidir ? pal.plotMuted : pal.relAbove;
          grp.append(svgEl(doc, "line", { x1, y1, x2, y2, stroke, "stroke-width": bidir ? 2.6 : 2.3 }));
          const head = (tipX, tipY, dirX, dirY) => {
            const bx = tipX - dirX * 7;
            const by = tipY - dirY * 7;
            const px = -dirY * 4;
            const py = dirX * 4;
            return svgEl(doc, "polygon", {
              points: `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}`,
              fill: stroke,
            });
          };
          grp.append(head(p2.x - ux * (nodeR + 2), p2.y - uy * (nodeR + 2), ux, uy));
          if (bidir) grp.append(head(p1.x + ux * (nodeR + 2), p1.y + uy * (nodeR + 2), -ux, -uy));
        };

        const pairs = [
          [0, 1],
          [1, 2],
          [0, 2],
        ];
        for (const [i, j] of pairs) {
          const zij = z[i][j] === 1;
          const zji = z[j][i] === 1;
          const errEdge = s.invalid && ((i === 1 && j === 2) || (i === 0 && j === 1) || (i === 0 && j === 2));
          if (zij && zji) drawArrow(pts[i], pts[j], true, errEdge);
          else if (zij) drawArrow(pts[i], pts[j], false, errEdge);
          else if (zji) drawArrow(pts[j], pts[i], false, errEdge);
        }

        pts.forEach((pt, i) => {
          const fill = s.invalid ? pal.plotBg : fills[g[i] - 1];
          const textFill = s.invalid ? pal.plotFg : labelOn(fill, pal);
          grp.append(
            svgEl(doc, "circle", {
              cx: pt.x,
              cy: pt.y,
              r: nodeR,
              fill,
              stroke: s.invalid ? pal.err : pal.cellBorder,
              "stroke-width": s.invalid ? 2.4 : 1.6,
            }),
            svgEl(
              doc,
              "text",
              {
                x: pt.x,
                y: pt.y,
                "text-anchor": "middle",
                "dominant-baseline": "central",
                "font-size": 14,
                "font-weight": 700,
                fill: textFill,
              },
              pt.id,
            ),
          );
        });
        grp.append(
          svgEl(
            doc,
            "text",
            { x: cx, y: 190, "text-anchor": "middle", "font-size": 13, fill: pal.plotMuted },
            s.invalid ? "Non-transitive cycle" : "Arrow: higher or tied",
          ),
        );

        // Right half: visual 3x3 binary z_ij matrix
        const rightX0 = Math.floor(W * 0.54);
        const availW = W - rightX0 - 10;
        const cell = Math.min(42, Math.max(32, Math.floor((availW - 26) / 3)));
        const mx0 = rightX0 + 24;
        const my0 = 52;
        const violSet = new Set(["2-1", "1-0", "2-0"]);

        grp.append(svgEl(doc, "text", { x: mx0 - 8, y: my0 - 10, "text-anchor": "end", "font-size": 13, "font-weight": 700, fill: pal.plotMuted }, "z"));
        ["A", "B", "C"].forEach((id, k) => {
          grp.append(
            svgEl(doc, "text", { x: mx0 + k * cell + cell / 2, y: my0 - 10, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: pal.plotFg }, id),
            svgEl(
              doc,
              "text",
              { x: mx0 - 8, y: my0 + k * cell + cell / 2, "text-anchor": "end", "dominant-baseline": "central", "font-size": 13, "font-weight": 700, fill: pal.plotFg },
              id,
            ),
          );
        });

        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) {
            const diag = i === j;
            const v = z[i][j];
            const bad = s.invalid && violSet.has(`${i}-${j}`);
            const cellFill = diag ? pal.neutral[0] : v === 1 ? pal.blues[1] : pal.plotBg;
            grp.append(
              svgEl(doc, "rect", {
                x: mx0 + j * cell,
                y: my0 + i * cell,
                width: cell,
                height: cell,
                fill: cellFill,
                stroke: pal.cellBorder,
                "stroke-width": 1,
              }),
            );
            if (bad) {
              grp.append(
                svgEl(doc, "rect", {
                  x: mx0 + j * cell + 2,
                  y: my0 + i * cell + 2,
                  width: cell - 4,
                  height: cell - 4,
                  fill: "none",
                  stroke: pal.err,
                  "stroke-width": 2.5,
                }),
              );
            }
            const label = diag ? "—" : formatCount(v);
            const txtAttrs = {
              x: mx0 + j * cell + cell / 2,
              y: my0 + i * cell + cell / 2,
              "text-anchor": "middle",
              "dominant-baseline": "central",
              "font-size": 13.5,
              "font-weight": diag ? 400 : 700,
              fill: diag ? pal.plotMuted : bad ? pal.errText : pal.plotFg,
              ...(diag ? {} : { "data-num": dataNum(v) }),
            };
            grp.append(svgEl(doc, "text", txtAttrs, label));
          }
        }

        svg.append(grp);
        slot.replaceChildren(svg);
      }

      function drawEncoding(s) {
        const g = PATTERNS[s.pattern];
        const relation = weakRelation(g);
        const z = s.invalid
          ? [
              [NaN, 1, 1],
              [1, NaN, 1],
              [0, 1, NaN],
            ]
          : relation.z;

        drawEncodingSvg(encodingSvgSlot, s, g, z);
        scopeBox.replaceChildren(h("p", {}, "The joint solver restricts its search to complete, transitive patterns."));

        if (s.invalid) {
          const vSum = z[2][1] + z[1][0] - z[2][0];
          encodingLine.replaceChildren(
            "For (C, B, A): ",
            ctx.num(z[2][1], formatCount),
            " + ",
            ctx.num(z[1][0], formatCount),
            " − ",
            ctx.num(z[2][0], formatCount),
            " = ",
            roSpan("violation", vSum, formatCount),
            " > ",
            ctx.num(1, formatCount),
            " (not transitive; no grade vector fits).",
          );
          ctx.readout.set(["This complete pattern is not transitive. It is not a report."]);
        } else {
          encodingLine.replaceChildren(
            "Grade vector in A, B, C order: ",
            roSpan("binary-grade", g, formatGrades),
            " · ",
            h("strong", {}, blocksText(g, ["A", "B", "C"])),
            " (complete and transitive).",
          );
          ctx.readout.set([
            roSpan("pattern-count", PATTERNS.length),
            " valid binary patterns are the ",
            ctx.num(familySize(3, { kind: "all" }), formatCount),
            " reports on three units; selected pattern ",
            ctx.num(s.pattern, formatCount),
            " is ",
            blocksText(g, ["A", "B", "C"]),
            ".",
          ]);
        }

        chipButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(!s.invalid && i === s.pattern)));
        brokenButton.setAttribute("aria-pressed", String(s.invalid));

        const grid = table(
          "Row unit in the same grade as, or higher than, column unit",
          ["zᵢⱼ", "A", "B", "C"],
          ["A", "B", "C"].map((id, i) => [id, ...z[i].map((v, j) => (i === j ? "—" : roSpan(`z-${i}-${j}`, v)))]),
          { "data-prx-binary": "" },
        );
        grid.classList.add("prx-cg-small");
        if (s.invalid) {
          for (const [i, j] of [
            [2, 1],
            [1, 0],
            [2, 0],
          ]) {
            grid.tBodies[0].rows[i].cells[j + 1].classList.add("prx-cg-violation");
          }
        }
        dataBox.summary.replaceChildren("Data and binary relation table");
        dataViews.encoding.replaceChildren(grid);

        methodBox.summary.replaceChildren("Method and coherence inequalities");
        methodViews.encoding.replaceChildren(
          p(
            "A directed bit zᵢⱼ is ",
            ctx.num(1, formatCount),
            " when i is in the same grade as j or higher, and ",
            ctx.num(0, formatCount),
            " otherwise. A shared grade sets both directions to ",
            ctx.num(1, formatCount),
            "; it makes no equality claim about the true values.",
          ),
          formula("z_{ij}+z_{ji}\\geq 1,\\qquad z_{ij}+z_{jk}-z_{ik}\\leq 1"),
        );
      }

      function drawDpStage(slot, s, d, x, candidates, here, chosen, step, totalCells) {
        const W = slotWidth(slot, ctx);
        const pal = palette(slot);
        const wide = W >= 560;
        const G = Math.max(...d.grade);
        const fills = gradeColors(G, pal);

        const rowPitch = wide ? 27 : 22;
        const candRows = here ? candidates.length : 1;
        const z2aY = wide ? 106 : 88;
        const z2bY = wide ? 106 : z2aY + 28 + 3 * rowPitch + 6;
        const H = z2bY + 28 + candRows * rowPitch + 8;

        const svg = svgEl(doc, "svg", {
          viewBox: `0 0 ${W} ${H}`,
          width: W,
          height: H,
          class: "prx-cg-svg",
          role: "img",
          "aria-label": `Optimal contiguous partition ${blocksText(d.grade, IDS)} on posterior-mean order A through F, search-family risk comparison, and candidate last-cut savings.`,
        });
        const grp = svgEl(doc, "g", { "aria-hidden": "true", "font-family": pal.fontSans });

        // Zone 1: Ordered sites A..F partitioned into contiguous grades
        grp.append(
          svgEl(
            doc,
            "text",
            { x: 8, y: 17, "font-size": 13, "font-weight": 700, fill: pal.plotFg },
            wide ? "Posterior-mean order A–F and optimal contiguous grade cuts" : "Ordered sites A–F & grade cuts",
          ),
        );

        const sx0 = 52;
        const sx1 = W - 10;
        const cutGap = wide ? 16 : 9;
        const sameGap = wide ? 5 : 3;
        const totalGap = (G - 1) * cutGap + (IDS.length - G) * sameGap;
        const cellW = Math.max(24, (sx1 - sx0 - totalGap) / IDS.length);
        const boxH = wide ? 36 : 28;
        const boxMidY = 25 + boxH / 2;
        const gradeRowY = 25 + boxH + 16;

        let cursorX = sx0;
        const siteBoxes = IDS.map((id, i) => {
          if (i > 0) {
            const isCut = d.grade[i] !== d.grade[i - 1];
            if (isCut) {
              const lineX = cursorX + cutGap / 2;
              grp.append(
                svgEl(doc, "line", {
                  x1: lineX.toFixed(1),
                  y1: 23,
                  x2: lineX.toFixed(1),
                  y2: gradeRowY + 4,
                  stroke: pal.accent,
                  "stroke-width": 2,
                  "stroke-dasharray": "4 3",
                }),
              );
              cursorX += cutGap;
            } else {
              cursorX += sameGap;
            }
          }
          const box = { id, i, grade: d.grade[i], x0: cursorX, x1: cursorX + cellW, cx: cursorX + cellW / 2 };
          cursorX += cellW;
          return box;
        });

        for (const b of siteBoxes) {
          const fill = fills[b.grade - 1];
          const inPrefix = !here || step >= totalCells || b.i < here.c;
          grp.append(
            svgEl(doc, "rect", {
              x: b.x0.toFixed(1),
              y: 26,
              width: cellW.toFixed(1),
              height: boxH,
              rx: 5,
              fill,
              "fill-opacity": inPrefix ? 1 : 0.72,
              stroke: here && step < totalCells && b.i < here.c ? pal.plotFocus : pal.cellBorder,
              "stroke-width": here && step < totalCells && b.i < here.c ? 2 : 1,
            }),
            svgEl(
              doc,
              "text",
              {
                x: b.cx.toFixed(1),
                y: boxMidY,
                "text-anchor": "middle",
                "dominant-baseline": "central",
                "font-size": 14,
                "font-weight": 700,
                fill: labelOn(fill, pal),
              },
              b.id,
            ),
          );
        }

        grp.append(svgEl(doc, "text", { x: 44, y: gradeRowY, "text-anchor": "end", "font-size": 13, fill: pal.plotMuted }, "Grade"));
        for (const b of siteBoxes) {
          grp.append(
            svgEl(
              doc,
              "text",
              {
                x: b.cx.toFixed(1),
                y: gradeRowY,
                "text-anchor": "middle",
                "font-size": 13,
                "font-weight": 700,
                fill: pal.plotFg,
                "data-num": dataNum(b.grade),
                "data-prx-readout": `strip-grade-${b.id}`,
              },
              formatCount(b.grade),
            ),
          );
        }

        // Zone 2a: Risk comparison across search scopes
        const zx0 = 8;
        const zx1 = wide ? Math.floor(W * 0.47) : W - 8;
        grp.append(svgEl(doc, "text", { x: zx0, y: z2aY + 12, "font-size": 13, "font-weight": 700, fill: pal.plotFg }, "Risk by search scope"));

        const rRows = [
          { label: wide ? "Fixed-order DP" : "Order DP", val: d.risk, fmt: formatReadoutRisk(d.risk), fill: pal.post },
          { label: "Capped exact", val: x.risk, fmt: formatReadoutRisk(x.risk), fill: pal.accent },
          { label: "Withhold all", val: s.tau, fmt: formatSetting(s.tau), fill: pal.relWithheld },
        ];
        const rMax = Math.max(s.tau, d.risk, x.risk, 1e-6);
        const rLabelX = zx0 + (wide ? 104 : 92);
        const rBarX0 = rLabelX + 8;
        const rBarSpan = Math.max(48, zx1 - rBarX0 - 50);

        rRows.forEach((row, idx) => {
          const cy = z2aY + 31 + idx * rowPitch;
          const bw = Math.max(2, (row.val / rMax) * rBarSpan);
          grp.append(
            svgEl(doc, "text", { x: rLabelX, y: cy, "text-anchor": "end", "dominant-baseline": "central", "font-size": 13, fill: pal.plotFg }, row.label),
            svgEl(doc, "rect", {
              x: rBarX0,
              y: cy - 7,
              width: bw.toFixed(1),
              height: 14,
              rx: 3,
              fill: row.fill,
              stroke: pal.cellBorder,
              "stroke-width": 0.8,
            }),
            svgEl(
              doc,
              "text",
              {
                x: (rBarX0 + bw + 6).toFixed(1),
                y: cy,
                "text-anchor": "start",
                "dominant-baseline": "central",
                "font-size": 13,
                "font-weight": idx < 2 ? 700 : 400,
                fill: pal.plotFg,
                "data-num": dataNum(row.val),
              },
              row.fmt,
            ),
          );
        });

        // Zone 2b: Candidate last cuts b for current cell (h, c)
        const bx0 = wide ? Math.floor(W * 0.52) : 8;
        const bx1 = W - 8;
        const bHeaderNode = here
          ? svgEl(
              doc,
              "text",
              { x: bx0, y: z2bY + 12, "font-size": 13, "font-weight": 700, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, "Cut savings (h = "),
              svgEl(doc, "tspan", { "data-num": dataNum(here.h) }, formatCount(here.h)),
              svgEl(doc, "tspan", {}, ", c = "),
              svgEl(doc, "tspan", { "data-num": dataNum(here.c) }, formatCount(here.c)),
              svgEl(doc, "tspan", {}, ")"),
            )
          : svgEl(
              doc,
              "text",
              { x: bx0, y: z2bY + 12, "font-size": 13, "font-weight": 700, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, "Step "),
              svgEl(doc, "tspan", { "data-num": "0" }, "0"),
              svgEl(doc, "tspan", {}, ": press Next cell"),
            );
        grp.append(bHeaderNode);

        if (here && candidates.length) {
          const totals = candidates.map((v) => v.total);
          let lo = Math.min(0, ...totals);
          let hi = Math.max(0, ...totals);
          if (!(hi - lo > 1e-12)) {
            lo -= 0.01;
            hi += 0.01;
          }
          const bLabelX = bx0 + 44;
          const bPlotX0 = bLabelX + 8;
          const bPlotX1 = bx1 - (wide ? 82 : 72);
          const bSpan = Math.max(44, bPlotX1 - bPlotX0);
          const xAt = (v) => bPlotX0 + ((v - lo) / (hi - lo)) * bSpan;
          const xZero = xAt(0);

          grp.append(
            svgEl(doc, "line", {
              x1: xZero.toFixed(1),
              y1: z2bY + 20,
              x2: xZero.toFixed(1),
              y2: z2bY + 20 + candidates.length * rowPitch,
              stroke: pal.plotAxis,
              "stroke-width": 1.2,
            }),
          );

          candidates.forEach((v, idx) => {
            const cy = z2bY + 31 + idx * rowPitch;
            const isBest = v.b === chosen;
            const xv = xAt(v.total);
            const rx0 = Math.min(xZero, xv);
            const rw = Math.max(2, Math.abs(xv - xZero));

            const bLbl = svgEl(
              doc,
              "text",
              { x: bLabelX, y: cy, "text-anchor": "end", "dominant-baseline": "central", "font-size": 13, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, "b = "),
              svgEl(doc, "tspan", { "data-num": dataNum(v.b) }, formatCount(v.b)),
            );
            const valLbl = svgEl(
              doc,
              "text",
              {
                x: (bPlotX1 + 8).toFixed(1),
                y: cy,
                "text-anchor": "start",
                "dominant-baseline": "central",
                "font-size": 13,
                "font-weight": isBest ? 700 : 400,
                fill: pal.plotFg,
              },
              svgEl(doc, "tspan", { "data-num": dataNum(v.total), "data-prx-readout": `dp-bar-${v.b}` }, formatReadoutExpected(v.total)),
              isBest ? svgEl(doc, "tspan", {}, " ◀") : null,
            );
            grp.append(
              bLbl,
              svgEl(doc, "rect", {
                x: rx0.toFixed(1),
                y: cy - 6.5,
                width: rw.toFixed(1),
                height: 13,
                rx: 2.5,
                fill: isBest ? pal.accent : pal.neutral[3],
              }),
              valLbl,
            );
          });
        } else {
          grp.append(
            svgEl(doc, "text", { x: bx0, y: z2bY + 38, "font-size": 13, fill: pal.plotMuted }, "No recursion cell filled yet."),
          );
        }

        svg.append(grp);
        slot.replaceChildren(svg);
      }

      function drawDp(s) {
        const d = getDP(s);
        const x = getExact(s);
        const t = d.trace;
        const cells = [];
        for (let hIdx = 1; hIdx < t.V.length; hIdx += 1) {
          for (let cIdx = 1; cIdx < t.V[hIdx].length; cIdx += 1) {
            if (t.V[hIdx][cIdx] !== null) cells.push({ h: hIdx, c: cIdx });
          }
        }
        dpCellCount = cells.length;
        const step = Math.min(s.step, cells.length);
        if (s.step !== step) ctx.set({ step });
        const seen = new Set(cells.slice(0, step).map((v) => `${v.h}/${v.c}`));
        const here = cells[step - 1];
        const path = new Set(t.path.map((v) => `${v.h}/${v.c}`));
        const chosenCut = here ? t.pred[here.h][here.c] : null;

        const candidates = [];
        if (here) {
          for (let b = here.h - 1; b < here.c; b += 1) {
            if (t.V[here.h - 1][b] !== null) {
              candidates.push({ b, previous: t.V[here.h - 1][b], block: t.W[b][here.c], total: t.V[here.h - 1][b] + t.W[b][here.c] });
            }
          }
        }

        drawDpStage(dpSvgSlot, s, d, x, candidates, here, chosenCut, step, cells.length);

        nextButton.root.setAttribute("aria-disabled", String(step >= cells.length));
        dpStatus.replaceChildren(
          h("strong", {}, blocksText(d.grade, IDS)),
          " · risk ",
          roSpan("dp-answer-risk", d.risk, formatReadoutRisk),
          " · ",
          roSpan("dp-step", step),
          " of ",
          roSpan("dp-cells", cells.length),
          " cells",
          ...(here ? [" (h = ", ctx.num(here.h, formatCount), ", c = ", ctx.num(here.c, formatCount), ", b = ", roSpan("dp-last-cut", chosenCut), ")"] : []),
        );

        scopeBox.replaceChildren(
          h(
            "p",
            {},
            "Scope: ",
            labelNode(ctx, d, { key: "dp" }),
            " in ",
            familyNameNode(ctx, d),
            " (",
            familySizeNode(ctx, d),
            Number(d.family.size) === 1 ? " contiguous report) vs. " : " contiguous reports) vs. ",
            labelNode(ctx, x, { key: "enumerated" }),
            " (",
            familySizeNode(ctx, x),
            Number(x.family.size) === 1 ? " report)." : " reports).",
          ),
        );

        // Data disclosure: full V_h(c) recursion table, current cell candidates, and risk by exact grade count
        const blankNode = (txt) => h("span", { class: "prx-cg-blank" }, txt);
        const tab = table(
          "Vₕ(c): greatest saving from h consecutive grades",
          ["h \\ c", ...t.V[0].map((_, c) => ctx.num(c, formatCount))],
          t.V.map((row, hIdx) => [
            ctx.num(hIdx, formatCount),
            ...row.map((v, cIdx) => {
              const key = `${hIdx}/${cIdx}`;
              const filled = (hIdx === 0 && cIdx === 0) || seen.has(key);
              const node =
                hIdx === 0 && cIdx === 0
                  ? roSpan("dp-origin", v, formatExpectedCount)
                  : v === null
                    ? blankNode("unreachable")
                    : filled
                      ? roSpan(`dp-${hIdx}-${cIdx}`, v, formatExpectedCount)
                      : blankNode("·");
              return h(
                "span",
                { class: `${step === cells.length && path.has(key) ? "prx-cg-path " : ""}${here?.h === hIdx && here?.c === cIdx ? "prx-cg-current" : ""}` },
                node,
              );
            }),
          ]),
          { class: "prx-cg-table prx-sticky-first" },
        );
        for (const span of tab.querySelectorAll(".prx-cg-current,.prx-cg-path")) {
          span.parentElement.className = span.className;
          span.className = "";
        }
        const riskByGTable = table(
          "Best risk for each exact grade count",
          ["h", "Risk"],
          t.riskByG.slice(1).map((r, i) => [ctx.num(i + 1, formatCount), ctx.num(r, formatRisk)]),
        );

        dataBox.summary.replaceChildren(
          "Data and DP recursion table",
          sum(" · Vₕ(c) savings (", ctx.num(step, formatCount), "/", ctx.num(cells.length, formatCount), " cells) and risk by grade count"),
        );
        dataViews.dp.replaceChildren(
          scroll(tab, "Dynamic programming savings table"),
          ...(here
            ? [
                detail(
                  "Inspect the current cell's alternatives",
                  p(
                    "Current h = ",
                    ctx.num(here.h, formatCount),
                    ", c = ",
                    ctx.num(here.c, formatCount),
                    ". The engine chooses b = ",
                    roSpan("dp-predecessor", chosenCut),
                    ".",
                  ),
                  scroll(
                    table(
                      "Every possible last cut b",
                      ["b", "Previous saving", "New block saving", "Total"],
                      candidates.map((v) => [
                        ctx.num(v.b, formatCount),
                        ctx.num(v.previous, formatExpectedCount),
                        ctx.num(v.block, formatExpectedCount),
                        ctx.num(v.total, formatExpectedCount),
                      ]),
                    ),
                    "Current cell alternatives",
                  ),
                ),
              ]
            : []),
          riskByGTable,
        );

        methodBox.summary.replaceChildren("Method and search details", sum(" · W(b,c), Vₕ(c), R = τ + (T − V)/M"));
        methodViews.dp.replaceChildren(
          p(
            "For sites in a contiguous block, saving is the expected cost of stating their fixed-order pair directions minus withholding cost within the grade; divide by pair count M for risk differences.",
          ),
          formula("W(b,c)=\\sum_{b<s<t\\le c}(\\bar e_{\\rho_s\\rho_t}-\\tau),\\qquad V_h(c)=\\max_{h-1\\le b<c}\\{V_{h-1}(b)+W(b,c)\\}"),
          formula("R=\\tau+(T-V)/M,\\qquad T=W(0,n)"),
          p(
            "T = ",
            roSpan("dp-T", t.T, formatExpectedCount),
            ", selected V = ",
            roSpan("dp-V", t.V[t.chosenG][IDS.length], formatExpectedCount),
            ", M = ",
            ctx.num(t.M, formatCount),
            ", using ",
            ctx.num(t.chosenG, formatCount),
            t.chosenG === 1 ? " grade. Equal-risk tolerance " : " grades. Equal-risk tolerance ",
            ctx.num(1e-12, formatSci),
            ".",
          ),
          ...(d.tieCount > 1
            ? [p(ctx.num(d.tieCount, formatCount), " reports tie within this order (tolerance ", ctx.num(d.tieTol, formatSci), "); showing the first.")]
            : []),
          ...(x.tieCount > 1
            ? [p(ctx.num(x.tieCount, formatCount), " reports tie in the capped family (tolerance ", ctx.num(x.tieTol, formatSci), "); showing the first.")]
            : []),
          h(
            "div",
            { class: "prx-cg-summary" },
            h("p", {}, tagNode(ctx, d, { orderWords: "posterior-mean order" }), "; risk ", roSpan("dp-risk", d.risk, formatReadoutRisk), "; ", roSpan("dp-grades", d.grade, formatGrades), " · ", blocksText(d.grade, IDS)),
            h(
              "p",
              {},
              "Posterior-mean order: ",
              roSpan("dp-answer-order-size", d.family.size),
              Number(d.family.size) === 1 ? " contiguous report. Full capped family: " : " contiguous reports. Full capped family: ",
              roSpan("dp-answer-capped-size", x.family.size),
              Number(x.family.size) === 1 ? " report, risk " : " reports, risk ",
              roSpan("dp-answer-capped-risk", x.risk, formatReadoutRisk),
              " (exact optimum risk ",
              roSpan("exact-risk", x.risk, formatReadoutRisk),
              "; grades ",
              roSpan("exact-grades", x.grade, formatGrades),
              ").",
            ),
          ),
        );

        // Readout: preserves exact contract of computing-grades-frame.test.mjs:77-96 while distinguishing DP step presets cleanly
        const capped = Math.min(s.cap, IDS.length);
        const one = Number(x.family.size) === 1;
        const family = one
          ? ["the ", familySizeNode(ctx, x), " report with at most ", ctx.num(capped, formatCount), " grade"]
          : ["all ", familySizeNode(ctx, x), " reports with at most ", ctx.num(capped, formatCount), capped === 1 ? " grade" : " grades"];
        const sameReport = d.grade.join() === x.grade.join();
        const sameRisk = Math.abs(d.risk - x.risk) <= x.tieTol;
        const finding = sameReport
          ? [" finds the same report (risk ", roSpan("dp-readout-capped-risk", x.risk, formatReadoutRisk), ")."]
          : sameRisk
            ? [" finds another equal-risk report (risk ", roSpan("dp-readout-capped-risk", x.risk, formatReadoutRisk), ")."]
            : [" finds lower risk ", roSpan("dp-readout-capped-risk", x.risk, formatReadoutRisk), "."];
        const stepSuffix =
          step < cells.length
            ? here
              ? [" Step ", ctx.num(step, formatCount), " of ", ctx.num(cells.length, formatCount), " (b = ", ctx.num(chosenCut, formatCount), ")."]
              : [" Step ", ctx.num(0, formatCount), " of ", ctx.num(cells.length, formatCount), "."]
            : [];

        ctx.readout.set([
          "Fixed-order DP: ",
          labelNode(ctx, d, { key: "dp" }),
          " (",
          familySizeNode(ctx, d),
          Number(d.family.size) === 1 ? " report" : " reports",
          "), risk ",
          roSpan("dp-readout-risk", d.risk, formatReadoutRisk),
          "; enumeration of ",
          ...family,
          ...finding,
          ...stepSuffix,
        ]);
      }

      function drawSolverSvg(slot, s, d, r) {
        const W = slotWidth(slot, ctx);
        const pal = palette(slot);
        const U = r?.upper ?? null;
        const L = r?.lower ?? null;
        const closed = r !== undefined && r !== null && r.gap === 0;
        const hi = Math.max(s.tau, d.risk, U ?? 0, L ?? 0, 0.05) * 1.08;

        const H = 244;
        const svg = svgEl(doc, "svg", {
          viewBox: `0 0 ${W} ${H}`,
          width: W,
          height: H,
          class: "prx-cg-svg",
          role: "img",
          "aria-label": "Risk axis comparing the fixed-order DP upper bound with joint solver bounds, paired with the four-unit family-bound example.",
        });
        const grp = svgEl(doc, "g", { "aria-hidden": "true", "font-family": pal.fontSans });

        // Top zone: Risk axis [0, hi]
        const ax0 = 22;
        const ax1 = W - 26;
        const axSpan = Math.max(120, ax1 - ax0);
        const px = (v) => ax0 + (v / hi) * axSpan;
        const axisY = 100;

        const items = [];
        const addItem = (key, value, prefix, anchor, at) => {
          const fmt = formatReadoutRisk(value);
          items.push({ key, value, prefix, fmt, anchor, at: at ?? value, text: `${prefix}${fmt}` });
        };
        if (closed && U !== null) {
          addItem("axis-bracket", U, "L = U ", "middle");
        } else {
          if (L !== null) addItem("axis-lower", L, "L ", "end");
          if (U !== null) addItem("axis-upper", U, "U ", "start");
          if (L !== null && U !== null) addItem("axis-gap", r.gap, "gap ", "middle", (L + U) / 2);
        }
        addItem("axis-candidate", d.risk, "◆ DP ", "middle");

        const rowYs = [74, 50, 26];
        const occupied = [[], [], []];
        for (const it of items) {
          const w = it.text.length * 7.8 + 8;
          const cx = px(it.at);
          let x0 = it.anchor === "end" ? cx - 6 - w : it.anchor === "start" ? cx + 6 : cx - w / 2;
          x0 = Math.max(8, Math.min(W - 8 - w, x0));
          it.x0 = x0;
          let rowIdx = occupied.findIndex((list) => list.every(([a, b]) => x0 + w + 8 < a || x0 - 8 > b));
          if (rowIdx < 0) rowIdx = occupied.length - 1;
          occupied[rowIdx].push([x0, x0 + w]);
          it.y = rowYs[rowIdx];
        }

        // Axis line & ticks
        grp.append(svgEl(doc, "line", { x1: ax0, y1: axisY, x2: ax1, y2: axisY, stroke: pal.plotAxis, "stroke-width": 1.5 }));
        const tickStep = hi <= 0.16 ? 0.05 : hi <= 0.35 ? 0.1 : 0.15;
        const ticks = [];
        for (let tv = 0; tv <= hi + 1e-9; tv = Number((tv + tickStep).toFixed(4))) ticks.push(tv);
        ticks.forEach((tv, i) => {
          const tx = px(tv);
          grp.append(
            svgEl(doc, "line", { x1: tx.toFixed(1), y1: axisY, x2: tx.toFixed(1), y2: axisY + 5, stroke: pal.plotAxis }),
            svgEl(
              doc,
              "text",
              {
                x: tx.toFixed(1),
                y: axisY + 19,
                "text-anchor": i === 0 ? "start" : tx > W - 26 ? "end" : "middle",
                "font-size": 13,
                fill: pal.plotMuted,
                "data-num": dataNum(tv),
              },
              tickLabel(tv, i, ticks),
            ),
          );
        });
        grp.append(svgEl(doc, "text", { x: ax1, y: axisY - 8, "text-anchor": "end", "font-size": 13, fill: pal.plotMuted }, "Risk"));

        if (L !== null && U !== null) {
          grp.append(
            svgEl(doc, "line", {
              x1: px(L).toFixed(1),
              y1: axisY,
              x2: px(U).toFixed(1),
              y2: axisY,
              stroke: pal.post,
              "stroke-width": 8,
              "stroke-opacity": 0.45,
            }),
            svgEl(doc, "line", { x1: px(L).toFixed(1), y1: axisY - 10, x2: px(L).toFixed(1), y2: axisY + 6, stroke: pal.post, "stroke-width": 2.2 }),
            svgEl(doc, "line", { x1: px(U).toFixed(1), y1: axisY - 10, x2: px(U).toFixed(1), y2: axisY + 6, stroke: pal.post, "stroke-width": 2.2 }),
          );
        } else {
          grp.append(
            svgEl(doc, "line", {
              x1: ax0,
              y1: axisY,
              x2: px(d.risk).toFixed(1),
              y2: axisY,
              stroke: pal.plotMuted,
              "stroke-width": 3,
              "stroke-dasharray": "4 3",
            }),
          );
        }

        // Diamond at DP candidate
        const dx = px(d.risk);
        grp.append(
          svgEl(doc, "path", {
            d: `M${dx.toFixed(1)} ${axisY - 7} L${(dx + 7).toFixed(1)} ${axisY} L${dx.toFixed(1)} ${axisY + 7} L${(dx - 7).toFixed(1)} ${axisY} Z`,
            fill: pal.plotBg,
            stroke: pal.plotFg,
            "stroke-width": 2.2,
          }),
        );

        for (const it of items) {
          grp.append(
            svgEl(
              doc,
              "text",
              { x: it.x0.toFixed(1), y: it.y, "text-anchor": "start", "font-size": 13, "font-weight": 700, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, it.prefix),
              svgEl(doc, "tspan", { "data-num": dataNum(it.value), "data-prx-readout": it.key }, it.fmt),
            ),
          );
        }

        // Divider + Bottom zone: four-unit family-bound counterexample bars
        const solverCompact = W < 430;
        grp.append(
          svgEl(doc, "line", { x1: 8, y1: 138, x2: W - 8, y2: 138, stroke: pal.plotGrid, "stroke-width": 1 }),
          svgEl(
            doc,
            "text",
            { x: 8, y: 158, "font-size": 13, "font-weight": 700, fill: pal.plotFg },
            solverCompact ? "Family bounds (four-unit example)" : "Why bounds require one family (four-unit example)",
          ),
        );

        const bookRows = [
          { key: "exact", prefix: "Exactly ", grades: 4, risk: BOOK_EXACT.risk, fill: pal.plotFg },
          { key: "cap", prefix: "At most ", grades: 4, risk: BOOK_CAP.risk, fill: pal.accent },
        ];
        const bLabelX = 132;
        const bBarX0 = 140;
        const bBarSpan = Math.max(60, W - bBarX0 - 54);
        const bMax = Math.max(BOOK_EXACT.risk, BOOK_CAP.risk);

        bookRows.forEach((row, idx) => {
          const cy = 186 + idx * 30;
          const bw = (row.risk / bMax) * bBarSpan;
          grp.append(
            svgEl(
              doc,
              "text",
              { x: bLabelX, y: cy, "text-anchor": "end", "dominant-baseline": "central", "font-size": 13, fill: pal.plotFg },
              svgEl(doc, "tspan", {}, row.prefix),
              svgEl(doc, "tspan", { "data-num": dataNum(row.grades) }, formatCount(row.grades)),
              svgEl(doc, "tspan", {}, " grades"),
            ),
            svgEl(doc, "rect", { x: bBarX0, y: cy - 8, width: bw.toFixed(1), height: 16, rx: 3, fill: row.fill }),
            svgEl(
              doc,
              "text",
              {
                x: (bBarX0 + bw + 6).toFixed(1),
                y: cy,
                "text-anchor": "start",
                "dominant-baseline": "central",
                "font-size": 13,
                "font-weight": 700,
                fill: pal.plotFg,
                "data-num": dataNum(row.risk),
                "data-prx-readout": `book-bar-${row.key}`,
              },
              formatReadoutRisk(row.risk),
            ),
          );
        });

        svg.append(grp);
        slot.replaceChildren(svg);
      }

      function drawSolver(s) {
        const m = solverModel(s);
        const d = fixedOrderDP(m.E, { scores: m.mean, tau: s.tau });
        const key = solverKey(s);
        const r = results.get(key);
        const mine = running !== null && running.key === key;

        solver.refresh({ hasResult: Boolean(r) });
        chip.setAttribute("data-state", running ? "running" : r ? (r.status === "optimal" ? "optimal" : "done") : lastError ? "error" : "idle");
        chip.replaceChildren(
          ...(running
            ? ["Solving ", ctx.num(running.solverN, formatCount), " units at τ ", ctx.num(running.tau, formatSetting), "…"]
            : r
              ? [`Status: ${r.status}`]
              : lastError
                ? ["Not finished"]
                : ["Not run at these settings"]),
        );

        solverHead.replaceChildren(
          "Joint search on ",
          ctx.num(s.solverN, formatCount),
          " league units at τ = ",
          ctx.num(s.tau, formatSetting),
          " (HiGHS loads on demand).",
        );

        if (lastError && !r) {
          solverNote.hidden = false;
          solverNote.setAttribute("data-error", "true");
          solverNote.replaceChildren("The solver could not finish. Check that the local solver bundle is available, then press the button to retry.");
        } else if (mine && !r) {
          solverNote.hidden = false;
          solverNote.removeAttribute("data-error");
          solverNote.replaceChildren("The worker is running. You can keep using the other views.");
        } else {
          solverNote.hidden = true;
          solverNote.removeAttribute("data-error");
          solverNote.replaceChildren();
        }

        const scopeNodes = [
          h(
            "p",
            {},
            "Before the joint search: ",
            labelNode(ctx, d, { key: "league-dp" }),
            " in ",
            familyNameNode(ctx, d),
            "; risk ",
            roSpan("solver-dp-risk", d.risk, formatReadoutRisk),
            " (",
            familySizeNode(ctx, d),
            Number(d.family.size) === 1 ? " contiguous report)." : " contiguous reports).",
          ),
        ];
        if (r) {
          exposeResult(ctx, r, "solver");
          const lab = labelNode(ctx, r, { key: "solver" });
          scopeNodes.push(
            lab
              ? h("p", { "data-prx-solver-label": "" }, lab, " in ", familyNameNode(ctx, r), "; ", familySizeNode(ctx, r), " reports.")
              : h("p", {}, "The run has not established optimality within solver tolerances; read the lower bound and gap."),
          );
        }
        scopeNodes.push(
          h(
            "p",
            {},
            "A solver status or a zero gap is not an exact arithmetic certificate; it concerns optimization of the supplied probabilities only.",
          ),
        );
        scopeBox.replaceChildren(...scopeNodes);

        drawSolverSvg(solverSvgSlot, s, d, r);

        if (r) {
          resultSlot.replaceChildren(
            table(
              "Joint solver result",
              ["Quantity", "Value"],
              [
                ["Status", h("span", { "data-prx-solver-status": "" }, r.status)],
                ["Incumbent risk Uᴿ", roSpan("solver-upper", r.upper, formatReadoutRisk)],
                ["Lower bound Lᴿ", roSpan("solver-lower", r.lower, formatReadoutRisk)],
                ["Absolute risk gap Uᴿ − Lᴿ", roSpan("solver-gap", r.gap, formatReadoutRisk)],
                ["Elapsed seconds", roSpan("solver-seconds", r.seconds, formatReadoutExpected)],
                ["Incumbent grade vector", r.grade === null ? roSpan("solver-grades", null, formatReadoutRisk) : roSpan("solver-grades", r.grade, formatGrades)],
              ],
              { class: "prx-cg-table prx-cg-status" },
            ),
          );
          ctx.readout.set([
            "Joint search status: ",
            r.status,
            ". Incumbent risk ",
            ctx.num(r.upper, formatReadoutRisk),
            "; lower bound ",
            ctx.num(r.lower, formatReadoutRisk),
            "; absolute risk gap ",
            ctx.num(r.gap, formatReadoutRisk),
            ".",
          ]);
        } else {
          resultSlot.replaceChildren();
          ctx.readout.set([
            "Fixed-order candidate risk ",
            ctx.num(d.risk, formatReadoutRisk),
            ". Joint solver ",
            mine ? "running." : "not run at these settings.",
          ]);
        }

        const sourceRows = m.ids.map((id, i) => [
          id,
          ctx.num(DRAW.estimate[i], formatExpectedCount),
          ctx.num(LEAGUE.se[i], formatExpectedCount),
          ctx.num(m.mean[i], formatExpectedCount),
          ctx.num(m.sd[i], formatExpectedCount),
        ]);
        dataBox.summary.replaceChildren("Data and frozen league inputs", sum(" · first ", ctx.num(s.solverN, formatCount), " units: estimate, SE and posterior"));
        dataViews.solver.replaceChildren(
          scroll(
            table("The supplied independent normal posteriors", ["Unit", "Estimate", "SE", "Posterior mean", "Posterior SD"], sourceRows, {
              class: "prx-cg-table prx-sticky-first",
            }),
            "League input table",
          ),
        );

        methodBox.summary.replaceChildren("Method, solver accounting and family bounds");
        solverMethodDynamic.replaceChildren(
          p(
            "Frozen draw seed ",
            ctx.num(SEED, formatSetting),
            "; normal prior mean ",
            ctx.num(0, formatSetting),
            ", SD ",
            ctx.num(0.15, formatSetting),
            ". Changing τ, unit count or time limit requires another button press.",
          ),
          ...(r
            ? [
                formula("U_R=\\tau+U_Z/M,\\quad L_R=\\tau+L_Z/M,\\quad U_R-L_R=(U_Z-L_Z)/M"),
                p(
                  "Solver total Uᶻ = ",
                  roSpan("solver-objective", r.objective === null ? null : r.offset + r.objective, formatExpectedCount),
                  "; objective lower bound Lᶻ = ",
                  roSpan("solver-bound", r.bound === null ? null : r.offset + r.bound, formatExpectedCount),
                  "; M = ",
                  roSpan("solver-M", pairCount(s.solverN)),
                  ". Offset ",
                  roSpan("solver-offset", r.offset, formatExpectedCount),
                  " added to raw incumbent ",
                  roSpan("solver-raw-objective", r.objective, formatExpectedCount),
                  " and raw bound ",
                  roSpan("solver-raw-bound", r.bound, formatExpectedCount),
                  ".",
                ),
              ]
            : []),
          p(
            "Absolute and relative MIP stopping-gap settings are both ",
            ctx.num(0, formatCount),
            "; HiGHS uses internal floating-point feasibility and objective tolerances.",
          ),
        );
      }

      mobileControls(ctx, { primary: [viewControls], secondaryInputs: [tau.root, limit.root, invalid.root, sn.root] });
      return {
        render(s, info) {
          if (info?.reason === "disclosure") return;
          const viewport = { x: ctx.win.scrollX, y: ctx.win.scrollY };
          current = s;
          view.set(s.view);
          n.set(s.n);
          cap.set(s.cap);
          sn.set(s.solverN);
          tau.set(s.tau);
          limit.set(s.timeLimit);
          pat.set(s.pattern);
          invalid.set(s.invalid);

          const v = s.view;
          syncPrimaryControl(v);
          n.root.hidden = v !== "count";
          cap.root.hidden = v !== "count" && v !== "dp";
          sn.root.hidden = v !== "solver";
          tau.root.hidden = v !== "dp" && v !== "solver";
          limit.root.hidden = v !== "solver";
          pat.root.hidden = v !== "encoding";
          invalid.root.hidden = v !== "encoding";
          solveBox.hidden = v !== "solver";

          for (const [k, node] of Object.entries(sections)) {
            node.hidden = k !== v;
            dataViews[k].hidden = k !== v;
            methodViews[k].hidden = k !== v;
            if (k !== v) {
              for (const slot of dynamic[k]) slot.replaceChildren();
            }
          }

          if (v === "count") drawCounts(s);
          else if (v === "encoding") drawEncoding(s);
          else if (v === "solver") drawSolver(s);
          else drawDp(s);

          if (v === "dp" && ctx.win.scrollY !== viewport.y) {
            ctx.win.scrollTo({ left: viewport.x, top: viewport.y, behavior: "instant" });
          }
        },
      };
    },
  });
}
