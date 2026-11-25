// Each rerun chooses and scores its own report on the same posterior draws.
// Exact-law evaluation keeps that report fixed. No independent evaluation sample is substituted.
import { createWidget } from "../shared/base.js";
import { numText, placeDirectLabels, plot } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatDecimal,
  formatDistinguishing,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatSigned,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  drawErrors,
  errorArray,
  evaluateReport,
  exactOptimum,
  familySize,
  gaussianDraws,
  pairCount,
  regretBound,
  selectionOnDraws,
  summaryStats,
} from "../pr-core.js";
import { CONFIG as MC, envelopeFor } from "../shared/domain/mc-error.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import TOY from "../../data/released/cache-toy.json" with { type: "json" };

export const CONFIG = Object.freeze({
  runs: 100,
  levels: Object.freeze([100, 400, 1000, 4000]),
  sliceMs: 18,
});

const STAGE_DRAW_BUDGET = 25000;
const U = SIX.tables.units;
const IDS = U.id;
const M = pairCount(IDS.length);
const CF = TOY.analyses.toy_crossfit;
const ALL_FAMILY_SIZE = familySize(IDS.length, { kind: "all" });
const CAP3_FAMILY_SIZE = familySize(IDS.length, { kind: "atMost", G: 3 });

const LAW = Object.fromEntries(
  MC.criteria.values.map((c) => {
    const cols = MC.criteriaOf[c].map((k) => (k === "score_A" ? ["mean_A", "sd_A"] : ["mean_B", "sd_B"]));
    const means = IDS.map((_, i) => cols.map(([m]) => U[m][i]));
    const sds = IDS.map((_, i) => cols.map(([, s]) => U[s][i]));
    return [c, { means, sds, w: MC.weights[c], criteria: MC.criteriaOf[c], E: errorArray(means, sds, { ids: IDS, criteria: MC.criteriaOf[c] }) }];
  }),
);

const family = (cap) => (cap === "none" ? { kind: "all" } : { kind: "atMost", G: 3 });
const cache = new Map();
const bestCache = new Map();
const detailCache = new Map();
const tieCache = new Map();
const keyOf = (s) => JSON.stringify([s.criteria, s.S, s.seed, s.tau, s.cap]);
const put = (map, key, value, max) => {
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value);
  return value;
};
const seedAt = (seed, run) => 1 + ((seed - 1 + run - 1) % 4294967295);

function bestFor(s) {
  const key = JSON.stringify([s.criteria, s.tau, s.cap]);
  if (!bestCache.has(key)) {
    put(bestCache, key, exactOptimum(LAW[s.criteria].E, { tau: s.tau, w: LAW[s.criteria].w, family: family(s.cap) }), 100);
  }
  return bestCache.get(key);
}

/** A compact, memoized engine result. Draws are regenerated only for the followed run's tie details. */
export function selectionRun(s) {
  const key = keyOf(s);
  if (cache.has(key)) return cache.get(key);
  const L = LAW[s.criteria];
  const r = selectionOnDraws(gaussianDraws(L.means, L.sds, s.S, s.seed), L.E, { tau: s.tau, w: L.w, family: family(s.cap) });
  const best = bestFor(s);
  const eta = best.tieTol;
  const b = regretBound({ N: r.N, Nstar: best.N, M, deltaW: r.deltaW, eta });
  return put(cache, key, { ...r, uniformBound: b.uniform, sharpBound: b.regret, eta }, 3000);
}

function detailFor(s) {
  const key = keyOf(s);
  if (detailCache.has(key)) return detailCache.get(key);
  const L = LAW[s.criteria];
  const E = drawErrors(gaussianDraws(L.means, L.sds, s.S, s.seed), { ids: IDS, criteria: L.criteria });
  const opt = exactOptimum(E, { tau: s.tau, w: L.w, family: family(s.cap) });
  const alternatives = (opt.grades ?? [opt.grade]).map((g) => {
    const est = evaluateReport(g, E, { tau: s.tau, w: L.w });
    const exact = evaluateReport(g, L.E, { tau: s.tau, w: L.w });
    return { grade: Array.from(g), N: exact.N, inSample: est.risk, exact: exact.risk, gap: est.risk - exact.risk };
  });
  return put(detailCache, key, { opt, alternatives }, 20);
}

/** Every tied draw-based optimum of one run (maxTies Infinity: all of them, in the engine's
 *  lexicographic order, so the first is the run's own report) with its signed gap; gaps is null for an untied run. */
export function tieRun(s) {
  const key = keyOf(s);
  if (tieCache.has(key)) return tieCache.get(key);
  const L = LAW[s.criteria];
  const E = drawErrors(gaussianDraws(L.means, L.sds, s.S, s.seed), { ids: IDS, criteria: L.criteria });
  const opt = exactOptimum(E, { tau: s.tau, w: L.w, family: family(s.cap), maxTies: Infinity });
  const gaps = opt.tieCount > 1
    ? opt.grades.map((g) => evaluateReport(g, E, { tau: s.tau, w: L.w }).risk - evaluateReport(g, L.E, { tau: s.tau, w: L.w }).risk)
    : null;
  return put(tieCache, key, { tieCount: opt.tieCount, gaps }, 3000);
}

/** The "look worse" count over every way of breaking the tied selections: the runs that look worse whichever tied
 *  report is taken (min) and those that can (max), with the number of tied runs. */
export function tieRange(rows, ties) {
  let tied = 0;
  let worseMin = 0;
  let worseMax = 0;
  rows.forEach((r, i) => {
    const t = ties[i];
    const gaps = t.gaps ?? [r.gap];
    if (t.tieCount > 1) tied++;
    if (gaps.every((g) => g > 0)) worseMin++;
    if (gaps.some((g) => g > 0)) worseMax++;
  });
  return { tied, worseMin, worseMax };
}

export function summarizeRuns(rows) {
  return {
    n: rows.length,
    better: rows.filter((r) => r.gap < 0).length,
    worse: rows.filter((r) => r.gap > 0).length,
    same: rows.filter((r) => r.gap === 0).length,
    gap: summaryStats(rows.map((r) => r.gap)).mean,
    absolute: summaryStats(rows.map((r) => Math.abs(r.gap))).mean,
    bound: summaryStats(rows.map((r) => r.bound)).mean,
    regret: summaryStats(rows.map((r) => r.regret)).mean,
  };
}

const gap3 = (x) => formatReadoutRisk(x, { signed: true });
const risk3 = (x) => formatReadoutRisk(x);
const gapFormat = (x) => (x !== 0 && Math.abs(x) < 5e-6 ? formatReadoutRisk(x, { signed: true }) : formatSigned(x, { digits: 5 }));
const dec = (x) => (x !== 0 && Math.abs(x) < 5e-6 ? formatReadoutRisk(x) : formatDecimal(x, { digits: 5 }));
const riskTable = (x) => (x !== 0 && Math.abs(x) < 5e-5 ? formatReadoutRisk(x) : formatRisk(x));

const CSS = `
.prx-widget.cj[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 auto;
  align-items: flex-end;
}
@media (max-width: 40em) {
  .prx-widget.cj[data-prx-frame="v2"] {
    padding: 0.5rem 0.55rem;
  }
  .prx-widget.cj[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.5rem;
    margin-bottom: 0.35rem;
  }
  .prx-widget.cj[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.45rem;
    padding: 0.3rem 0.55rem;
  }
  .cj .prx-stage {
    padding: 0.5rem 0.55rem;
  }
}
.cj .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.cj .cj-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: flex-end;
  width: 100%;
}
.cj .cj-seed-line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 0.65rem;
}
.cj .cj-seed-line input[type="number"] {
  width: 7.5rem;
}
.cj .prx-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
.cj .prx-toggle input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  flex: none;
}
.cj .prx-toggle > label {
  display: inline-flex;
  align-items: center;
  min-height: inherit;
  margin: 0;
  cursor: pointer;
}
.cj .cj-cloud {
  min-width: 0;
  max-width: 100%;
}
.cj .cj-cloud svg {
  cursor: pointer;
}
.cj .cj-busy {
  opacity: 0.45;
}
.cj .prx-stage .cj-tiekey {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.95rem;
  margin: 0.35rem 0 0;
  padding: 0.2rem 0;
  font-size: 0.84375rem;
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.cj .prx-stage .cj-tiekey span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.cj .cj-dot-sw {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-sizing: border-box;
  flex: none;
}
.cj .cj-dot-better {
  background: var(--prx-post);
}
.cj .cj-dot-worse {
  background: var(--prx-err);
}
.cj .cj-hollow {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.8px solid var(--prx-plot-muted);
  background: var(--prx-plot-bg);
  box-sizing: border-box;
  flex: none;
}
.cj .cj-ring-sw {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.8px solid var(--prx-plot-fg);
  background: transparent;
  box-sizing: border-box;
  flex: none;
}
.cj .prx-stage .cj-follow {
  margin: 0.3rem 0 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.875rem;
  line-height: 1.38;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-left: 3px solid var(--prx-plot-axis);
  border-radius: 3px;
}
.cj .cj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  gap: 0.9rem;
}
.cj .cj-panel {
  min-width: 0;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  padding: 0.65rem 0.75rem;
}
.cj .cj-panel p {
  margin: 0.35rem 0;
}
.cj .cj-note {
  font-size: 0.88em;
  color: var(--prx-fg-muted);
  margin: 0.4rem 0;
}
.cj .cj-data-stack,
.cj .cj-method-stack {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}
.cj .cj-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1rem;
  padding: 0.3rem 0.5rem;
  margin: 0.3rem 0;
  font-size: 0.85em;
  border-radius: 4px;
}
.cj .cj-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.cj .cj-key {
  display: inline-block;
  width: 1.6rem;
  border-top: 2px solid var(--prx-plot-fg);
}
.cj .cj-key-bound {
  border-color: var(--prx-plot-muted);
  border-top-style: dotted;
}
.cj .cj-key-radius {
  border-color: var(--prx-plot-fg);
  border-top-style: dashed;
}
.cj .cj-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88em;
  font-variant-numeric: tabular-nums;
}
.cj .cj-table th,
.cj .cj-table td {
  padding: 0.35rem 0.45rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: left;
}
.cj .cj-wide {
  min-width: 34rem;
}
.cj .cj-scroll {
  max-width: 100%;
  overflow-x: auto;
}
`;

function buildTaskBatches(items, budget = STAGE_DRAW_BUDGET) {
  const batches = [];
  let current = [];
  let cost = 0;
  for (const item of items) {
    if (current.length > 0 && cost + item.cost > budget) {
      const fns = current;
      batches.push(() => {
        for (const fn of fns) fn();
      });
      current = [];
      cost = 0;
    }
    current.push(item.fn);
    cost += item.cost;
  }
  if (current.length > 0) {
    const fns = current;
    batches.push(() => {
      for (const fn of fns) fn();
    });
  }
  return batches;
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "chosen-and-judged",
    frame: "v2",
    className: "cj",
    css: CSS,
    label: "Scored on the draws that chose it: rerun-specific selection, exact-law risk, signed gaps and regret bounds.",
    keys: {
      S: { type: "integer", min: 5, max: 4000, step: 5, value: 100 },
      seed: { type: "integer", min: 1, max: 4294967295, value: 1 },
      criteria: { type: "choice", values: ["A", "B", "AB"], value: "A" },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      cap: { type: "choice", values: [3, "none"], value: "none" },
      run: { type: "integer", min: 1, max: CONFIG.runs, value: 1 },
      bounds: { type: "boolean", value: false },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, v, f = formatCount) => {
        const n = ctx.num(v, f(v));
        n.dataset.prxReadout = name;
        return n;
      };

      // Primary controls in toolbar
      const S = ctx.slider({
        label: "Draws S",
        ...ctx.key("S"),
        format: formatCount,
        onInput: (v) => ctx.set({ S: v }),
      });
      const run = ctx.slider({
        label: "Follow run",
        ...ctx.key("run"),
        format: formatCount,
        onInput: (v) => ctx.set({ run: v }),
      });
      ctx.controls.append(ctx.primaryControl(S.root), run.root);

      // Secondary controls in Settings disclosure
      const score = ctx.segmented({
        label: "Score",
        name: "criteria",
        options: [
          { value: "A", label: "Score A" },
          { value: "B", label: "Score B" },
          { value: "AB", label: "Both, equal weights" },
        ],
        value: ctx.state.criteria,
        onChange: (criteria) => ctx.set({ criteria }),
      });
      const cap = ctx.segmented({
        label: "Family searched",
        name: "cap",
        options: [
          { value: "none", label: "All reports" },
          { value: 3, label: "At most three grades" },
        ],
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      const seed = ctx.numberInput({
        label: "First seed",
        ...ctx.key("seed"),
        onInput: (v) => ctx.set({ seed: v }),
      });
      const redraw = ctx.button({
        label: "Next seeds",
        title: "Repeat with the next first seed",
        onClick: () => ctx.set({ seed: seedAt(ctx.state.seed, 2) }),
      });
      const showBounds = ctx.toggle({
        label: "Show gap bounds",
        name: "bounds",
        checked: ctx.state.bounds,
        onChange: (bounds) => ctx.set({ bounds }),
      });
      ctx.onPrimary(() => ctx.set({ seed: seedAt(ctx.state.seed, 2) }));

      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(
        h(
          "div",
          { class: "cj-settings-grid" },
          score.root,
          cap.root,
          tau.root,
          h("div", { class: "cj-seed-line" }, seed.root, redraw.root),
          showBounds.root,
        ),
      );

      // Primary stage: 100-run signed-gap cloud + compact key + 1-line followed run summary
      const main = h("div", { class: "cj-cloud" });
      const tieKey = h(
        "p",
        { class: "cj-tiekey", "data-prx-part": "legend" },
        h("span", {}, h("i", { class: "cj-dot-sw cj-dot-better", "aria-hidden": "true" }), "better on own draws"),
        h("span", {}, h("i", { class: "cj-dot-sw cj-dot-worse", "aria-hidden": "true" }), "worse on own draws"),
        h("span", {}, h("i", { class: "cj-hollow", "aria-hidden": "true" }), "tied selection (first shown)"),
        h("span", {}, h("i", { class: "cj-ring-sw", "aria-hidden": "true" }), "followed run"),
      );
      const follow = h("p", { class: "cj-follow" });
      ctx.stage.append(main, tieKey, follow);

      // Data disclosure: followed run's report card, tied alternatives, and convergence across S
      const dataBox = ctx.dataBox("Data, followed run and convergence");
      const detail = h("div");
      const convergenceSection = h("section", { class: "cj-panel" });
      const convergence = h("div", { class: "cj-cloud" });
      const convergenceLegend = h("div", { class: "cj-legend", "data-prx-part": "legend" });
      const convergenceNote = h("p", { class: "cj-note" });
      const convergenceTable = ctx.scrollRegion(h("div", { class: "cj-scroll" }), "Rerun summaries by draw count");
      convergenceSection.append(
        ctx.panelTitle("As the draw count grows"),
        convergence,
        convergenceLegend,
        convergenceNote,
      );
      ctx.stage.append(convergenceSection);
      dataBox.body.append(h("div", { class: "cj-data-stack" }, detail, convergenceTable));

      // Method disclosure: bounds derivation, IID sampling note, and package cross-fitting folds
      const methodBox = ctx.methodBox("Method, bounds and cross-fitting");
      const boundsHolder = h("div");
      const fold = h("section", { class: "cj-panel" });
      const methodNotes = h("p", { class: "cj-note" });
      methodBox.body.append(h("div", { class: "cj-method-stack" }, boundsHolder, fold, methodNotes));

      const seedFor = (s, i) => seedAt(s.seed, i + 1);
      let activeJobKey = null;
      let hasRendered = false;
      let figure = null;
      let lastState = null;
      let lastLevels = null;
      let lastCurve = null;

      ctx.onCleanup(() => {
        activeJobKey = null;
      });

      function rowsFor(s) {
        return Array.from({ length: CONFIG.runs }, (_, i) => ({
          run: i + 1,
          seed: seedFor(s, i),
          ...selectionRun({ ...s, seed: seedFor(s, i) }),
        }));
      }

      function ensure(s, levels) {
        const items = [];
        const mult = LAW[s.criteria].w.length;
        for (let i = 0; i < CONFIG.runs; i++) {
          const st = { ...s, seed: seedFor(s, i) };
          if (!cache.has(keyOf(st))) items.push({ cost: Math.max(120, s.S * mult), fn: () => selectionRun(st) });
        }
        for (let i = 0; i < CONFIG.runs; i++) {
          const st = { ...s, seed: seedFor(s, i) };
          if (!tieCache.has(keyOf(st))) items.push({ cost: Math.max(150, s.S * mult), fn: () => tieRun(st) });
        }
        for (const n of levels) {
          if (n === s.S) continue;
          for (let i = 0; i < CONFIG.runs; i++) {
            const st = { ...s, S: n, seed: seedFor(s, i) };
            if (!cache.has(keyOf(st))) items.push({ cost: Math.max(120, n * mult), fn: () => selectionRun(st) });
          }
        }
        if (!items.length) {
          if (activeJobKey) {
            activeJobKey = null;
            ctx.scheduleStages([]);
          }
          return true;
        }
        const key = JSON.stringify([s.criteria, s.tau, s.cap, s.seed, s.S, levels]);
        if (activeJobKey === key) return false;
        activeJobKey = key;
        if (!hasRendered) {
          ctx.readout.set("Computing reruns for the current settings…");
        }
        main.classList.add("cj-busy");
        const stages = buildTaskBatches(items, STAGE_DRAW_BUDGET);
        stages.push(() => {
          if (activeJobKey !== key) return;
          activeJobKey = null;
          ctx.requestRender("runs-ready");
        });
        ctx.scheduleStages(stages, { yieldMs: 0 });
        return false;
      }

      ctx.listen(main, "click", (e) => {
        if (!figure || e.detail === 0) return;
        const b = figure.svg.getBoundingClientRect();
        const x = figure.scale("x");
        const nativeWidth = Number(figure.svg.getAttribute("width")) || b.width;
        const value = x.invert?.(((e.clientX - b.left) * nativeWidth) / (b.width || 1));
        if (Number.isFinite(value)) {
          ctx.set({ run: Math.max(1, Math.min(CONFIG.runs, Math.round(value))) });
        }
      });

      function drawConvergence(s, levels, curve) {
        const convWidth = Math.max(240, Math.round(convergence.clientWidth || ctx.width() - 36));
        const yMax = Math.max(...curve.map((d) => Math.max(d.radius, d.bound, d.absolute))) * 1.08 || 0.05;
        plot(convergence, {
          width: convWidth,
          height: 225,
          marginLeft: 58,
          marginRight: 20,
          marginTop: 16,
          marginBottom: 42,
          x: {
            type: "log",
            domain: [Math.min(...levels), 4000],
            ticks: levels,
            label: "Draws in each run S",
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: {
            label: "Risk discrepancy",
            ticks: 4,
            domain: [0, yMax],
          },
          alt: "As the draw count increases, compare the mean absolute signed gap, mean deterministic gap bound, and the simultaneous coefficient radius. The same seed sequence is used at each size; rerun sets across sizes overlap and are not independent replications.",
          table: {
            caption: "Mean absolute gaps and discrepancy bounds by draw count",
            columns: [
              { label: "Draws", value: "S", format: (v) => formatCount(v) },
              { label: "Mean absolute gap", value: "absolute", format: dec },
              { label: "Mean deterministic bound", value: "bound", format: dec },
              { label: "Simultaneous radius", value: "radius", format: dec },
            ],
            rows: curve,
          },
          marks: (c, P) => [
            P.lineY(curve, { x: "S", y: "absolute", stroke: c.plotFg, strokeWidth: 2 }),
            P.dot(curve, { x: "S", y: "absolute", fill: c.plotFg }),
            P.lineY(curve, { x: "S", y: "bound", stroke: c.plotMuted, strokeDasharray: "2,3", strokeWidth: 2 }),
            P.lineY(curve, { x: "S", y: "radius", stroke: c.plotFg, strokeDasharray: "5,3", strokeWidth: 2 }),
            P.ruleX([s.S], { stroke: c.plotFg, strokeDasharray: "2,3", strokeOpacity: 0.5 }),
          ],
          keyboard: {
            data: curve,
            x: "S",
            y: "absolute",
            sort: false,
            title: (d) => `${d.S} draws: mean absolute gap ${dec(d.absolute)}, mean deterministic bound ${dec(d.bound)}, simultaneous radius ${dec(d.radius)}.`,
          },
        });
      }

      function render(s, info = {}) {
        if (info?.reason === "disclosure") {
          if (info.disclosure === "data" && lastState && lastLevels && lastCurve) {
            drawConvergence(lastState, lastLevels, lastCurve);
          }
          return;
        }

        S.set(s.S);
        score.set(s.criteria);
        tau.set(s.tau);
        cap.set(s.cap);
        run.set(s.run);
        seed.set(s.seed);
        showBounds.set(s.bounds);

        const levels = [...new Set([...CONFIG.levels, s.S])].sort((a, b) => a - b);
        if (!ensure(s, levels)) return;

        hasRendered = true;
        main.classList.remove("cj-busy");

        const rows = rowsFor(s);
        const sum = summarizeRuns(rows);
        const r = rows[s.run - 1];
        const followed = { ...s, seed: r.seed };
        const d = detailFor(followed);
        const best = bestFor(s);
        const ties = rows.map((x) => tieRun({ ...s, seed: x.seed }));
        const tr = tieRange(rows, ties);
        const data = rows.map((x, i) => ({
          ...x,
          lower: -x.bound,
          upper: x.bound,
          tied: ties[i].tieCount > 1,
        }));

        // Concise 1-sentence 3-sig-fig readout (<= 35 words)
        const tiedWords = [" tied selection", tr.tied === 1 ? " is" : "s are", " broken)"];
        const tieRangeWords = tr.tied === 0
          ? []
          : tr.worseMin === tr.worseMax
            ? [" (the same however the ", ro("tied-runs", tr.tied), ...tiedWords]
            : [" (", ro("worse-min", tr.worseMin), "–", ro("worse-max", tr.worseMax), " depending on how the ", ro("tied-runs", tr.tied), ...tiedWords];

        ctx.readout.set([
          "Across ",
          ro("runs", sum.n),
          " runs of ",
          ro("draws", s.S),
          " draws, ",
          ro("better", sum.better),
          " look better on their own draws and ",
          ro("worse", sum.worse),
          " look worse",
          ...tieRangeWords,
          ...(sum.same ? ["; ", ctx.num(sum.same, formatCount(sum.same)), " have no gap"] : []),
          "; mean signed gap ",
          ro("mean-gap", sum.gap, gap3),
          ".",
        ]);

        // Primary 13px signed-gap scatter/cloud with collision-free direct labels (WA-02, WA-13)
        const width = Math.max(250, Math.round(main.clientWidth || ctx.width() - 28));
        const narrow = width < 520;
        const height = narrow ? 225 : 285;
        const mean = sum.gap;
        const meanStr = gap3(mean);
        const maxRightChars = Math.max(meanStr.length, "zero gap".length, "mean".length);
        const marginLeft = 60;
        const marginRight = Math.max(76, Math.ceil(maxRightChars * 8.1) + 14);
        const marginTop = 16;
        const marginBottom = 42;
        const insetTop = 24;
        const insetBottom = 24;

        const yVals = s.bounds
          ? [0, mean, ...data.flatMap((x) => [x.gap, x.lower, x.upper])]
          : [0, mean, ...data.map((x) => x.gap)];
        let rawLo = Math.min(...yVals);
        let rawHi = Math.max(...yVals);
        if (rawHi - rawLo < 1e-6) {
          rawLo -= 0.002;
          rawHi += 0.002;
        }
        const span = rawHi - rawLo;
        const yLo = rawLo - span * 0.06;
        const yHi = rawHi + span * 0.06;
        const plotTop = marginTop + insetTop;
        const plotBottom = height - marginBottom - insetBottom;
        const plotH = Math.max(1, plotBottom - plotTop);
        const yPxOf = (v) => plotTop + ((yHi - v) / (yHi - yLo)) * plotH;
        const valOfYPx = (py) => yHi - ((py - plotTop) / plotH) * (yHi - yLo);

        const zeroTarget = yPxOf(0);
        const meanTarget = yPxOf(mean);
        const placed = placeDirectLabels(
          [
            { id: "zero", y: zeroTarget + (mean > 0 ? 0.05 : -0.05), height: 16 },
            { id: "mean", y: meanTarget, height: 30 },
          ],
          {
            minGapPx: 24,
            bounds: [
              narrow ? plotTop + 4 : marginTop + 14,
              narrow ? plotBottom - 4 : height - marginBottom - 16,
            ],
          },
        );
        const labelById = new Map(placed.map((p) => [p.id, p]));
        const zeroLabelVal = valOfYPx(labelById.get("zero").y);
        const meanCenterPx = labelById.get("mean").y;
        const meanTitleVal = valOfYPx(meanCenterPx - 7.5);
        const meanNumVal = valOfYPx(meanCenterPx + 8);

        figure = plot(main, {
          width,
          height,
          marginLeft,
          marginRight,
          marginTop,
          marginBottom,
          x: {
            label: narrow ? "Run (own report chosen)" : "Run (its report is chosen anew)",
            labelAnchor: "center",
            labelArrow: "none",
            domain: [1, CONFIG.runs],
            ticks: 5,
          },
          y: {
            label: "Own-draw risk − exact-law risk",
            domain: [yLo, yHi],
            ticks: 5,
            insetTop,
            insetBottom,
          },
          alt:
            "Signed risk gaps over reruns. Each report is selected on that run’s draws and scored on those same draws and the exact law. Negative gaps look better on the selection draws." +
            (s.bounds
              ? " Gray vertical intervals give each run’s deterministic discrepancy bound around zero."
              : " The discrepancy intervals are hidden to show the signed gaps in more detail."),
          table: {
            caption: "Each run’s selected report, its two risks and discrepancy bound",
            columns: [
              { label: "Run", value: "run", format: (v) => formatCount(v) },
              { label: "Seed", value: "seed", format: (v) => formatCount(v) },
              { label: "Own-draw risk", value: "inSample", format: riskTable },
              { label: "Exact-law risk", value: "exact", format: riskTable },
              { label: "Signed gap", value: "gap", format: gapFormat },
              { label: "Absolute-gap bound", value: "bound", format: dec },
            ],
            rows: data,
          },
          marks: (c, P) => {
            const halo = { stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" };
            const plain = data.filter((x) => !x.tied);
            return [
              ...(s.bounds ? [P.ruleX(data, { x: "run", y1: "lower", y2: "upper", stroke: c.wh, strokeOpacity: 0.75, strokeWidth: 1.4 })] : []),
              P.ruleY([0], { stroke: c.plotAxis, strokeWidth: 1.3 }),
              P.ruleY([mean], { stroke: c.plotFg, strokeDasharray: "5,4", strokeOpacity: 0.9, strokeWidth: 1.5 }),
              P.dot(plain.filter((x) => x.gap <= 0), { x: "run", y: "gap", fill: c.post, r: 3.2 }),
              P.dot(plain.filter((x) => x.gap > 0), { x: "run", y: "gap", fill: c.err, r: 3.2 }),
              P.dot(data.filter((x) => x.tied), {
                x: "run",
                y: "gap",
                r: 3.5,
                fill: c.plotBg,
                stroke: (x) => (x.gap > 0 ? c.err : c.post),
                strokeWidth: 1.7,
              }),
              P.dot(data.filter((x) => x.run === s.run), { x: "run", y: "gap", r: 6.4, fill: "none", stroke: c.plotFg, strokeWidth: 1.9 }),
              P.text([narrow ? "↑ worse on own draws" : "↑ above zero: looks worse on its own draws"], {
                frameAnchor: "top-left",
                lineAnchor: "top",
                dx: 4,
                dy: 2,
                text: (t) => t,
                fill: c.plotFg,
                ...halo,
              }),
              P.text([narrow ? "↓ better on own draws" : "↓ below zero: looks better on its own draws"], {
                frameAnchor: "bottom-left",
                lineAnchor: "bottom",
                dx: 4,
                dy: -2,
                text: (t) => t,
                fill: c.plotFg,
                ...halo,
              }),
              P.text(["zero gap"], {
                x: () => CONFIG.runs,
                y: () => zeroLabelVal,
                text: (t) => t,
                textAnchor: "start",
                dx: 6,
                fill: c.plotMuted,
              }),
              P.text(["mean"], {
                x: () => CONFIG.runs,
                y: () => meanTitleVal,
                text: (t) => t,
                textAnchor: "start",
                dx: 6,
                fontWeight: 600,
                fill: c.plotFg,
              }),
              numText([mean], {
                x: () => CONFIG.runs,
                y: () => meanNumVal,
                value: (v) => v,
                format: gap3,
                textAnchor: "start",
                dx: 6,
                fontWeight: 600,
                fill: c.plotFg,
              }),
            ];
          },
          keyboard: {
            data,
            x: "run",
            y: "gap",
            sort: false,
            key: (x) => String(x.run),
            title: (x) =>
              `Run ${x.run}, seed ${x.seed}: own-draw risk ${formatRisk(x.inSample)}, exact-law risk ${formatRisk(x.exact)}, signed gap ${gapFormat(x.gap)}, absolute-gap bound ${dec(x.bound)}.`,
          },
        });

        // 1-line summary of the followed run directly under the cloud (3 sig figs)
        const rf3 =
          r.inSample !== r.exact && risk3(r.inSample) === risk3(r.exact)
            ? (v) => formatDistinguishing(v, v === r.inSample ? r.exact : r.inSample, { minSig: 3 })
            : risk3;
        const rfExact =
          formatRisk(r.inSample) === formatRisk(r.exact) && r.inSample !== r.exact
            ? (v) => formatRisk(v, { digits: 5 })
            : formatRisk;

        const t = ties[s.run - 1];
        const lo = t.gaps ? Math.min(...t.gaps) : 0;
        const hi = t.gaps ? Math.max(...t.gaps) : 0;
        const tieBits = t.tieCount > 1
          ? [
              " · ",
              ctx.num(t.tieCount, formatCount(t.tieCount)),
              " tied reports (gaps ",
              ...(t.gaps.length <= 4
                ? t.gaps.flatMap((g, i) => [i ? ", " : "", ctx.num(g, gap3(g))])
                : ["from ", ctx.num(lo, gap3(lo)), " to ", ctx.num(hi, gap3(hi))]),
              ")",
            ]
          : [];
        follow.replaceChildren(
          "Run ",
          ro("follow-run", s.run),
          " (seed ",
          ro("follow-seed", r.seed),
          "): own-draw risk ",
          ro("follow-in-sample", r.inSample, rf3),
          " against exact ",
          ro("follow-exact", r.exact, rf3),
          ", so gap ",
          ro("follow-gap", r.gap, gap3),
          "; |gap| ≤ ",
          ro("follow-bound", r.bound, risk3),
          ...tieBits,
        );

        // Concise 1-line scope note
        ctx.setScope(
          s.cap === "none"
            ? ["All ", ctx.num(ALL_FAMILY_SIZE, formatCount(ALL_FAMILY_SIZE)), " reports · click any dot to follow that run."]
            : [
                "At most ",
                ctx.num(3, formatCount(3)),
                " grades (",
                ctx.num(CAP3_FAMILY_SIZE, formatCount(CAP3_FAMILY_SIZE)),
                " reports) · click any dot to follow that run.",
              ],
        );

        // Data disclosure: followed run card + tied alternatives + convergence over S
        const card = h(
          "section",
          { class: "cj-panel" },
          ctx.panelTitle("This run’s chosen report"),
          h("p", {}, "Run ", ro("run", s.run), ", seed ", ro("run-seed", r.seed), "; input order ", IDS.join(", "), ": ", ro("grade", r.grade, formatGrades), "."),
          h("p", {}, blocksText(r.grade, IDS)),
          tagNode(ctx, d.opt),
          h("p", { class: "cj-note" }, "For the estimated probabilities from this run. States ", ro("N", r.N), " of ", ctx.num(M, formatCount(M)), " pair directions."),
          h("p", {}, "Own-draw risk ", ro("in-sample", r.inSample, rfExact), "; exact-law risk of this same report ", ro("exact", r.exact, rfExact), "."),
          h("p", {}, "Signed gap ", ro("gap", r.gap, gapFormat), "; absolute gap ≤ ", ro("bound", r.bound, dec), "."),
          captionNode(ctx, "fixed-report"),
        );

        detail.replaceChildren(card);
        if (d.opt.tieCount > 1) {
          const tie = h(
            "p",
            { class: "cj-note" },
            ctx.num(d.opt.tieCount, formatCount(d.opt.tieCount)),
            " reports share the smallest draw-based risk within equal-risk tolerance ",
            ctx.num(d.opt.tieTol, formatSci(d.opt.tieTol)),
            "; the first is followed. Exact-law risks can differ between them.",
          );
          detail.append(tie);
          const table = ctx.scrollRegion(h("div", { class: "cj-scroll" }), "Tied draw-based optima evaluated under the exact law");
          table.append(
            h(
              "table",
              { class: "cj-table cj-wide prx-sticky-first" },
              h(
                "thead",
                {},
                h("tr", {}, ...["Report in input order", "Stated pairs", "Own-draw risk", "Exact-law risk", "Signed gap"].map((th) => h("th", { scope: "col" }, th))),
              ),
              h(
                "tbody",
                {},
                ...d.alternatives.map((a) =>
                  h(
                    "tr",
                    {},
                    h("td", {}, ctx.num(a.grade, formatGrades(a.grade))),
                    h("td", {}, ctx.num(a.N, formatCount(a.N))),
                    h("td", {}, ctx.num(a.inSample, rfExact(a.inSample))),
                    h("td", {}, ctx.num(a.exact, rfExact(a.exact))),
                    h("td", {}, ctx.num(a.gap, gapFormat(a.gap))),
                  ),
                ),
              ),
            ),
          );
          detail.append(table);
          if (d.opt.tieCount > d.alternatives.length) {
            detail.append(
              h(
                "p",
                { class: "cj-note" },
                "First ",
                ctx.num(d.alternatives.length, formatCount(d.alternatives.length)),
                " representatives listed; ",
                ctx.num(d.opt.tieCount - d.alternatives.length, formatCount(d.opt.tieCount - d.alternatives.length)),
                " more share the minimum.",
              ),
            );
          }
        }
        if (best.tieCount > 1) {
          detail.append(
            h(
              "p",
              { class: "cj-note" },
              ctx.num(best.tieCount, formatCount(best.tieCount)),
              " reports share the exact-law minimum within equal-risk tolerance ",
              ctx.num(best.tieTol, formatSci(best.tieTol)),
              "; its first representative is shown.",
            ),
          );
        }

        const curve = levels.map((n) => ({
          S: n,
          ...summarizeRuns(rowsFor({ ...s, S: n })),
          radius: envelopeFor(s.criteria, n).deltaW,
        }));
        lastState = s;
        lastLevels = levels;
        lastCurve = curve;
        drawConvergence(s, levels, curve);

        convergenceLegend.replaceChildren(
          h("span", {}, h("i", { class: "cj-key", "aria-hidden": "true" }), "mean absolute gap"),
          h("span", {}, h("i", { class: "cj-key cj-key-bound", "aria-hidden": "true" }), "mean (N/M)δ"),
          h("span", {}, h("i", { class: "cj-key cj-key-radius", "aria-hidden": "true" }), "simultaneous coefficient radius"),
        );
        convergenceNote.replaceChildren(
          "Each size repeats selection using the same seed sequence. Means and realized δ need not decrease at every step. The dashed radius shrinks with S; at each predeclared size it covers all pair errors with chance at least ",
          ctx.num(1 - MC.alpha, "95%"),
          " for independent draws. It also covers a report chosen on those draws; it is not a pointwise MCSE.",
        );
        convergenceTable.replaceChildren(
          h(
            "table",
            { class: "cj-table cj-wide prx-sticky-first" },
            h("thead", {}, h("tr", {}, ...["Draws S", "Mean signed gap", "Mean absolute gap", "Mean gap bound", "Mean exact regret"].map((th) => h("th", { scope: "col" }, th)))),
            h(
              "tbody",
              {},
              ...curve.map((v) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row" }, ctx.num(v.S, formatCount(v.S))),
                  h("td", {}, ctx.num(v.gap, gapFormat(v.gap))),
                  h("td", {}, ctx.num(v.absolute, dec(v.absolute))),
                  h("td", {}, ctx.num(v.bound, dec(v.bound))),
                  h("td", {}, ctx.num(v.regret, dec(v.regret))),
                ),
              ),
            ),
          ),
        );

        // Method disclosure: bounds card, cross-fit fold view, and sampling notes
        const boundsCard = h(
          "section",
          { class: "cj-panel" },
          ctx.panelTitle("What the bounds compare"),
          h(
            "p",
            {},
            s.criteria === "AB"
              ? "For each score, take the maximum absolute difference between a draw-estimated wrong-direction probability and its exact-law value over all ordered distinct pairs. δ = "
              : "δ = ",
            ro("delta", r.deltaW, dec),
            s.criteria === "AB"
              ? " is the equally weighted average of those per-score maxima."
              : " is the maximum absolute difference between a draw-estimated wrong-direction probability and its exact-law value over all ordered distinct pairs.",
          ),
          h("p", { class: "cj-note" }, "This observed discrepancy uses the known exact law. The dashed convergence curve instead shows a predeclared simultaneous coefficient radius. N counts stated pairs; M counts all pairs."),
          h("p", {}, "Same report, two probability arrays: |own-draw risk − exact-law risk| ≤ (N/M)δ."),
          h(
            "p",
            {},
            "Exact-law minimum in this family ",
            ro("best", r.best, formatRisk),
            ". Selected report’s exact regret ",
            ro("regret", r.regret, formatRisk),
            " ≤ ",
            ro("uniform", r.uniformBound, dec),
            " (",
            ctx.num(2, formatCount(2)),
            "δ + η).",
          ),
          h(
            "p",
            { class: "cj-note" },
            "The sharper bound using both disclosure counts is ",
            ro("sharp", r.sharpBound, dec),
            ". η is an absolute optimization allowance for the draw-based problem; enumeration uses equal-risk tolerance ",
            ro("eta", r.eta, formatSci),
            ". It bounds numerical risk error, not posterior spread.",
          ),
          h("p", {}, "Exact-law reference: ", ro("best-grade", Array.from(best.grade), formatGrades), " in input order ", IDS.join(", "), "."),
          tagNode(ctx, best),
        );
        boundsHolder.replaceChildren(boundsCard);

        const F = CF.tables.folds;
        const FG = CF.tables.fold_grades;
        fold.replaceChildren(
          ctx.panelTitle("The package’s separate fold-report view"),
          h("p", { class: "cj-note" }, "A fixed cached toy example, separate from the six-site reruns above. Each fold chooses a report, then that same fold report is evaluated on the other half."),
          h(
            "p",
            { class: "cj-note" },
            "Fixed package settings: τ ",
            ctx.num(CF.facts.tau, formatSetting(CF.facts.tau)),
            ", at most ",
            ctx.num(CF.facts.G_max, formatCount(CF.facts.G_max)),
            " grades; criterion weights ",
            ctx.num(CF.facts.weights.need_A, formatSetting(CF.facts.weights.need_A)),
            " and ",
            ctx.num(CF.facts.weights.need_B, formatSetting(CF.facts.weights.need_B)),
            " for need A and need B. ",
            captionNode(ctx, "package-quantity"),
          ),
        );
        const foldTable = ctx.scrollRegion(h("div", { class: "cj-scroll" }), "Package cross-fitting: training-fold reports and their two evaluations");
        const foldRows = F.fold.map((f, i) =>
          h(
            "tr",
            {},
            h("th", { scope: "row" }, f),
            h("td", {}, ctx.num(F.draws[i], formatCount(F.draws[i]))),
            h("td", {}, ctx.num(FG[f], formatGrades(FG[f]))),
            h("td", {}, ctx.num(F.in_fold_risk[i], formatRisk(F.in_fold_risk[i]))),
            h("td", {}, ctx.num(F.out_of_fold_risk[i], formatRisk(F.out_of_fold_risk[i]))),
            h("td", {}, ctx.num(F.optimism[i], gapFormat(F.optimism[i]))),
          ),
        );
        foldTable.append(
          h(
            "table",
            { class: "cj-table cj-wide prx-sticky-first" },
            h(
              "thead",
              {},
              h("tr", {}, ...["Training fold", "Draws", "Report", "In-fold risk", "Other-fold risk", "Other-fold risk − in-fold risk (package optimism)"].map((th) => h("th", { scope: "col" }, th))),
            ),
            h("tbody", {}, ...foldRows),
          ),
        );
        fold.append(
          foldTable,
          h(
            "p",
            { class: "cj-note" },
            "Report input order: ",
            ...FG.id.flatMap((id, i) => [i ? ", " : "", h("span", { "data-prx-name": "" }, id)]),
            ". Package optimism subtracts in-fold risk from other-fold risk, opposite to the main own-draw risk minus exact-law risk gap. Mean package optimism ",
            ro("fold-mean", CF.facts.mean_optimism, formatRisk),
            "; mean absolute optimism ",
            ro("fold-absolute", CF.facts.mean_abs_optimism, formatRisk),
            ". These evaluate the fold reports, not the full-draw report. Neither summary corrects full-data risk or tests external calibration.",
          ),
        );

        methodNotes.replaceChildren(
          "In repeated IID sampling the expected signed gap of an empirical risk minimizer is ≤ ",
          ctx.num(0, formatCount(0)),
          "; a finite set of ",
          ctx.num(sum.n, formatCount(sum.n)),
          " reruns can have either sign. Independent whole-state draws; all settings and the family are held fixed within a rerun set. MCMC effective sample sizes cannot replace the draw count in this envelope.",
        );

        ctx.caption.replaceChildren(
          captionNode(ctx, "teaching-posterior"),
          ". Monte Carlo: ",
          ctx.num(s.S, formatCount(s.S)),
          " draws per run, first seed ",
          ctx.num(s.seed, formatCount(s.seed)),
          " (",
          ctx.num(CONFIG.runs, formatCount(CONFIG.runs)),
          " consecutive seeds).",
        );
      }

      return { render };
    },
  });
}
