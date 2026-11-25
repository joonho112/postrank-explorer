import { mobileControls } from "../shared/mobile-controls.js";
import { appLink, createWidget } from "../shared/base.js";
import { gradeColors, labelOn, placeDirectLabels, svgScene } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatGrades,
  formatPercent,
  formatReadoutEst,
  formatRisk,
  formatSci,
  formatSetting,
  formatSizes,
  tickLabel,
} from "../shared/format.js";
import { captionNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import {
  canonicalGrade,
  disclosure,
  drawLeague,
  errorArray,
  exactOptimum,
  expectedRank,
  fixedOrderDP,
  league30,
  LEAGUE_SEED,
  maxCoefficientError,
  normalInterval,
  normalPosterior,
  relationChange,
} from "../pr-core.js";
import { cardRows, drawReportCard, gaussianCard, gradeLegend, REPORT_CARD_CSS } from "../shared/domain/report-card.js";
import { drawRelationMatrix, REPORT_BUILDER_CSS } from "../shared/domain/report-builder.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

const U = SIX.tables.units;
const IDS = U.id;
const L = league30();
const LEAGUE_POSTERIOR = normalPosterior(drawLeague(LEAGUE_SEED).estimate, L.se, { priorMean: 0, priorSd: 0.15 });
const ALL_IDS = [...IDS, ...L.ids];
const criterionName = (k) => (k === "score_A" ? "Score A" : k === "score_B" ? "Score B" : "League value");
const baseMemo = new Map();
const subset = (E, indices) => ({
  ids: indices.map((i) => E.ids[i]),
  criteria: E.criteria,
  e: E.e.map((ek) => indices.map((i) => indices.map((j) => ek[i][j]))),
});

export function correctionModel({ data = "six", score = "A" } = {}) {
  if (data === "league") {
    return {
      ids: L.ids,
      mean: LEAGUE_POSTERIOR.mean.map((v) => [v]),
      sd: LEAGUE_POSTERIOR.sd.map((v) => [v]),
      criteria: ["league value"],
      weights: [1],
      unit: "unit",
      units: "units",
      league: true,
    };
  }
  const scores = score === "AB" ? ["A", "B"] : [score];
  return {
    ids: IDS,
    mean: IDS.map((_, i) => scores.map((k) => U[`mean_${k}`][i])),
    sd: IDS.map((_, i) => scores.map((k) => U[`sd_${k}`][i])),
    criteria: scores.map((k) => `score_${k}`),
    weights: scores.map(() => 1 / scores.length),
    unit: "site",
    units: "sites",
    league: false,
  };
}

const optimize = (E, model, state) =>
  model.league
    ? fixedOrderDP(E, { scores: expectedRank(E, { w: model.weights }), direction: "ascending", tau: state.tau, w: model.weights })
    : exactOptimum(E, { tau: state.tau, w: model.weights, family: state.cap === "all" ? { kind: "all" } : { kind: "atMost", G: state.cap } });

const parseCap = (v) =>
  String(v).toLowerCase() === "all"
    ? "all"
    : Number.isFinite(Number(v))
      ? Math.min(6, Math.max(2, Math.round(Number(v))))
      : undefined;

/** Each population keeps its marginals. The league recomputes expected ranks and cuts that new order. */
export function correctionResult(state) {
  const model = correctionModel(state);
  const key = JSON.stringify([state.data ?? "six", state.score ?? "A", state.tau, state.cap]);
  let before = baseMemo.get(key);
  if (!before) {
    const E = errorArray(model.mean, model.sd, { ids: model.ids, criteria: model.criteria });
    before = { E, result: optimize(E, model, state) };
    if (baseMemo.size >= 128) baseMemo.delete(baseMemo.keys().next().value);
    baseMemo.set(key, before);
  }
  const selected = model.ids.indexOf(state.unit);
  const indices = model.ids.map((_, i) => i).filter((i) => state.mode !== "drop" || i !== selected);
  const mean = model.mean.map((row, i) => row.map((v) => (state.mode === "mean" && i === selected ? state.mean : v)));
  const sd = model.sd.map((row, i) => row.map((v) => (state.mode === "sd" && i === selected ? state.sd : v)));
  const ids = indices.map((i) => model.ids[i]);
  const E = errorArray(indices.map((i) => mean[i]), indices.map((i) => sd[i]), { ids, criteria: model.criteria });
  const after = optimize(E, model, state);
  const originalCommon = Array.from(canonicalGrade(indices.map((i) => before.result.grade[i])));
  const delta = relationChange(originalCommon, Array.from(after.grade), E, { w: model.weights });
  const untouched = indices.filter((i) => i !== selected);
  const afterPositions = untouched.map((i) => indices.indexOf(i));
  const untouchedE0 = subset(before.E, untouched);
  const untouchedE1 = subset(E, afterPositions);
  const other = relationChange(
    untouched.map((i) => before.result.grade[i]),
    afterPositions.map((i) => after.grade[i]),
    untouchedE1,
    { w: model.weights },
  );
  const coefficientGaps = maxCoefficientError(untouchedE0, untouchedE1).epsilon;
  return {
    model,
    before,
    after,
    E,
    ids,
    indices,
    mean: indices.map((i) => mean[i]),
    sd: indices.map((i) => sd[i]),
    originalCommon,
    delta,
    other,
    coefficientGaps,
    coefficientGap: Math.max(...coefficientGaps),
  };
}

function pickSpacedBands(bands, yPxOf, minGapPx = 18) {
  if (bands.length <= 1) return bands.slice();
  const out = [bands[0]];
  for (let i = 1; i < bands.length; i += 1) {
    if (yPxOf(bands[i].mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) out.push(bands[i]);
  }
  const last = bands[bands.length - 1];
  if (out[out.length - 1] !== last) {
    if (out.length > 1 && yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) < minGapPx) out[out.length - 1] = last;
    else if (yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) out.push(last);
  }
  return out;
}

function niceLinearTicks(lo, hi, innerW = 240) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const pxOf = (v) => ((v - lo) / span) * innerW;
  if (innerW >= 140) {
    const maxTicks = Math.max(2, Math.min(5, Math.floor(innerW / 62)));
    const rawStep = span / Math.max(1.6, maxTicks - 0.5);
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const norm = rawStep / mag;
    const step = (norm <= 1.4 ? 1 : norm <= 3.2 ? 2 : norm <= 7.2 ? 5 : 10) * mag;
    const first = Math.ceil((lo + span * 0.04) / step) * step;
    const last = Math.floor((hi - span * 0.04) / step) * step;
    let out = [];
    for (let v = first; v <= last + step * 1e-6; v += step) {
      out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(10)));
    }
    while (out.length > 2) {
      let minGap = Infinity;
      for (let i = 1; i < out.length; i += 1) minGap = Math.min(minGap, pxOf(out[i]) - pxOf(out[i - 1]));
      if (minGap >= 48) break;
      out = out.filter((_, i) => i % 2 === 0);
    }
    if (out.length >= 2) return out;
  }
  const exp0 = Math.floor(Math.log10(span)) - 1;
  const steps = [];
  for (let e = exp0; e <= exp0 + 2; e += 1) {
    const m = 10 ** e;
    for (const b of [1, 2, 2.5, 5]) steps.push(Number((b * m).toPrecision(10)));
  }
  steps.sort((a, b) => a - b);
  const buildForStep = (step, edgeFrac = 0.02) => {
    const first = Math.ceil((lo + span * edgeFrac) / step) * step;
    const last = Math.floor((hi - span * edgeFrac) / step) * step;
    const arr = [];
    for (let v = first; v <= last + step * 1e-6; v += step) {
      arr.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(10)));
    }
    return arr;
  };
  const okGap = (arr) => {
    if (arr.length < 2) return false;
    for (let i = 1; i < arr.length; i += 1) {
      const gap = pxOf(arr[i]) - pxOf(arr[i - 1]);
      const wPrev = tickLabel(arr[i - 1], i - 1, arr).length * 7.2;
      const wCurr = tickLabel(arr[i], i, arr).length * 7.2;
      if (gap < 21 || gap < (wPrev + wCurr) / 2 + 5) return false;
    }
    return true;
  };
  for (const step of steps) {
    const arr = buildForStep(step, 0.02);
    if (arr.length >= 2 && arr.length <= 3 && okGap(arr)) return arr;
  }
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (lo + span * 0.02 <= -step && hi - span * 0.02 >= step && okGap([-step, step])) {
      return [-step, step];
    }
    const arr = buildForStep(step, 0.02);
    if (arr.length >= 2) {
      const pair = [arr[0], arr[arr.length - 1]];
      if (okGap(pair)) return pair;
    }
  }
  return [0];
}

const CSS = `${REPORT_CARD_CSS}\n${REPORT_BUILDER_CSS}
/* PR-01: reset inherited prx-rc / prx-rb layout overrides inside frame v2 */
.prx-widget.oc[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 100%;
  align-items: flex-end;
}
@media (min-width: 52em) {
  .prx-widget.oc[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.28rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.18rem 0.48rem;
    font-size: 0.8rem;
  }
}
@media (max-width: 40em) {
  .prx-widget.oc[data-prx-frame="v2"] {
    padding: 0.45rem 0.5rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] .prx-title {
    margin: 0 0 0.3rem;
    font-size: 1rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.25rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.15rem 0.45rem;
    font-size: 0.8rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] > .prx-readout,
  .prx-widget.oc[data-prx-frame="v2"] .prx-readout {
    margin: 0 0 0.35rem;
    padding: 0.28rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.32;
  }
  .oc .prx-stage {
    padding: 0.45rem 0.5rem;
  }
  .oc .prx-stage .oc-change-row {
    margin-top: 0.3rem;
    padding: 0.25rem 0.45rem;
  }
  .oc .prx-stage .oc-stage-meta {
    margin-top: 0.2rem;
    font-size: 0.8rem;
  }
  .prx-widget.oc[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.45rem;
    gap: 0.35rem;
  }
}
.oc .prx-stage {
  container-type: inline-size;
}
.oc .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.oc .oc-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: flex-end;
  width: 100%;
}
.oc .oc-stage-chart {
  min-width: 0;
  max-width: 100%;
}
.oc .prx-stage .oc-change-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  margin: 0.45rem 0 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.875rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-left: 3px solid var(--prx-plot-axis);
  border-radius: 3px;
}
.oc .prx-stage .oc-change-label {
  font-weight: 600;
}
.oc .oc-change-chips {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
  margin: 0;
}
.oc .prx-stage .oc-change-chip {
  display: inline-block;
  border: 1px solid var(--prx-cell-border);
  border-radius: 0.25rem;
  padding: 0.08rem 0.42rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.oc .prx-stage .oc-change-more,
.oc .prx-stage .oc-change-none {
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.oc .prx-stage .oc-stage-meta {
  margin: 0.3rem 0 0;
  font-size: 0.84375rem;
  line-height: 1.38;
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.oc .oc-data-stack,
.oc .oc-method-stack {
  display: grid;
  gap: 0.95rem;
  min-width: 0;
}
.oc .oc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: 1rem;
}
.oc .oc-panel {
  min-width: 0;
  padding: 0.75rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.oc .oc-panel.prx-light-panel .prx-panel-title,
.oc .oc-panel.prx-light-panel .prx-result-tag {
  color: var(--prx-plot-fg);
}
.oc .oc-panel p {
  margin: 0.4rem 0;
}
.oc .oc-matrix-area {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
}
.oc .oc-table {
  border-collapse: collapse;
  width: 100%;
}
.oc .oc-table th,
.oc .oc-table td {
  padding: 0.35rem;
  text-align: left;
  border-bottom: 1px solid var(--prx-cell-border);
}
.oc .oc-legend {
  font-size: 0.88em;
}
.oc .oc-note {
  font-size: 0.9em;
}
.oc .oc-scroll {
  max-width: 100%;
  overflow-x: auto;
  min-width: 0;
}
.oc .oc-ties-table {
  min-width: 30rem;
  table-layout: fixed;
}
.oc .oc-matrix-inner.oc-league {
  width: max-content;
}
.oc .oc-scroll.oc-league-scroll {
  max-height: 23rem;
  overflow: auto;
  overscroll-behavior: contain;
}
.oc .oc-pin {
  position: sticky;
  left: 0;
  z-index: 2;
  height: 0;
}
.oc .oc-colpin {
  position: sticky;
  top: 0;
  z-index: 3;
  height: 0;
}
.oc .oc-corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4;
  height: 0;
}
.oc .oc-pin > svg,
.oc .oc-colpin > svg {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  max-width: none;
  pointer-events: none;
  background: var(--prx-plot-bg);
}
.oc .oc-corner > span {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  background: var(--prx-plot-bg);
}
.oc .oc-scroll[data-prx-overflow="start"] .oc-pin > svg,
.oc .oc-scroll[data-prx-overflow="both"] .oc-pin > svg {
  box-shadow: 6px 0 6px -5px color-mix(in srgb, var(--prx-plot-fg) 40%, transparent);
}
.oc .oc-scroll.oc-scrolled-y .oc-colpin > svg {
  box-shadow: 0 6px 6px -5px color-mix(in srgb, var(--prx-plot-fg) 40%, transparent);
}
.oc .oc-matrix-inner .prx-kbd-tip {
  z-index: 5;
}
.oc .oc-list {
  max-height: 20rem;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  min-width: 0;
}
.oc .oc-list thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--prx-plot-bg);
}
.oc .oc-list:focus-visible {
  outline: var(--prx-focus-width, 2px) solid var(--prx-focus, #17645E);
  outline-offset: 2px;
}
.oc .oc-ties-table th {
  overflow-wrap: normal;
  word-break: normal;
}
.oc .oc-grade-vector {
  white-space: normal;
  overflow-wrap: anywhere;
}
.oc .oc-order-note {
  border-left: 3px solid var(--prx-accent);
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
}
.oc .oc-ring {
  display: inline-block;
  width: 0.8em;
  height: 0.8em;
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
  vertical-align: -0.1em;
  margin-right: 0.3em;
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "one-correction",
    title: "One correction moves other grades",
    frame: "v2",
    className: "oc prx-rc prx-rb",
    css: CSS,
    keys: {
      data: { type: "choice", values: ["six", "league"], value: "six" },
      score: { type: "choice", values: ["A", "B", "AB"], value: "A" },
      unit: { type: "choice", values: ALL_IDS, value: "C" },
      mode: { type: "choice", values: ["mean", "sd", "drop"], value: "mean" },
      mean: { type: "number", min: -2, max: 2, step: 0.05, value: -1 },
      sd: { type: "number", min: 0.05, max: 1.2, step: 0.05, value: 1 },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      cap: { type: "custom", value: 3, parse: parseCap },
    },
    build(ctx) {
      const { h } = ctx;
      let renderToken = 0;
      ctx.onCleanup(() => {
        renderToken += 1;
      });
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };

      // Primary intervention controls in ctx.controls
      const unit = ctx.select({
        label: "Unit",
        name: "unit",
        options: ALL_IDS.map((id) => ({ value: id, label: id.length === 1 ? `Site ${id}` : id })),
        value: ctx.state.unit,
        onChange: (v) => {
          const m = correctionModel(ctx.state);
          const i = m.ids.indexOf(v);
          ctx.set({ unit: v, mean: m.mean[i][0], sd: m.sd[i][0] });
        },
      });
      const mode = ctx.segmented({
        label: "Change",
        name: "mode",
        options: [
          { value: "mean", label: "Posterior mean" },
          { value: "sd", label: "Posterior SD" },
          { value: "drop", label: "Drop unit" },
        ],
        value: ctx.state.mode,
        onChange: (v) => ctx.set({ mode: v }),
      });
      const mean = ctx.slider({
        label: "Corrected mean",
        ...ctx.key("mean"),
        onInput: (v) => ctx.set({ mean: v }),
      });
      const sd = ctx.slider({
        label: "Corrected SD",
        ...ctx.key("sd"),
        onInput: (v) => ctx.set({ sd: v }),
      });
      ctx.primaryControl(mean.root);
      ctx.primaryControl(sd.root);
      ctx.controls.append(unit.root, mode.root, mean.root, sd.root);

      // Secondary parameters in Settings disclosure
      const data = ctx.segmented({
        label: "Population",
        name: "data",
        options: [
          { value: "six", label: "Six sites" },
          { value: "league", label: "Simulated league" },
        ],
        value: ctx.state.data,
        onChange: (v) =>
          ctx.set(
            v === "league"
              ? { data: v, score: "A", unit: "U15", mode: "drop", cap: "all", tau: 0.2 }
              : { data: v, score: "A", unit: "C", mode: "mean", cap: 3, mean: -1, sd: 1 },
          ),
      });
      const score = ctx.select({
        label: "Score used to choose grades",
        name: "score",
        options: [
          { value: "A", label: "Score A" },
          { value: "B", label: "Score B" },
          { value: "AB", label: "Scores A and B, equal weights" },
        ],
        value: ctx.state.score,
        onChange: (v) => {
          const m = correctionModel({ data: "six", score: v });
          const i = m.ids.indexOf(ctx.state.unit);
          ctx.set({
            score: v,
            mode: v === "AB" ? "drop" : ctx.state.mode,
            cap: v === "AB" ? "all" : ctx.state.cap,
            mean: m.mean[i][0],
            sd: m.sd[i][0],
          });
        },
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      const cap = ctx.select({
        label: "At most this many grades",
        name: "cap",
        options: [...[2, 3, 4, 5, 6].map((g) => ({ value: g, label: String(g) })), { value: "all", label: "All reports (no cap)" }],
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(h("div", { class: "oc-settings-grid" }, data.root, score.root, cap.root, tau.root));

      // Primary Stage: ONE unified before/after unit-interval & grade graphic + changed untouched-pair pills
      const stageChart = h("div", { class: "oc-stage-chart" });
      const changeRow = h("div", { class: "oc-change-row" });
      const stageMeta = h("p", { class: "oc-stage-meta" });
      ctx.stage.append(stageChart, changeRow, stageMeta);

      // Data disclosure: complete before/after report cards, pairwise relation matrix, untouched-pair table, and tie combinations
      const dataBox = ctx.dataBox("Data, relation matrix and unit tables");
      const cards = ["Before correction", "After correction"].map((title) => ({
        root: h("section", { class: "oc-panel prx-light-panel", "aria-label": title }),
        chart: h("div"),
        slots: [],
        header: h("p"),
        legend: h("div"),
        marker: h("p", { class: "oc-note" }),
      }));
      cards.forEach((c, k) => c.root.append(ctx.panelTitle(k === 0 ? "Before correction" : "After correction"), c.header, c.chart, c.marker, c.legend));
      const cardsRow = h("div", { class: "oc-cards" }, ...cards.map((c) => c.root));

      const matrix = h("div", { class: "prx-rb-matrix-chart" });
      const matrixLegend = h("div", { class: "prx-rb-legend", "data-prx-part": "legend" });
      const changedList = h("div");
      const counts = h("p");
      const tableWrap = h("div");
      const listBox = h("div", { class: "oc-list" }, tableWrap);
      changedList.append(ctx.panelTitle("Pairs between untouched units"), counts, listBox);

      const pin = h("div", { class: "oc-pin", "aria-hidden": "true", hidden: true });
      const colPin = h("div", { class: "oc-colpin", "aria-hidden": "true", hidden: true });
      const corner = h("div", { class: "oc-corner", "aria-hidden": "true", hidden: true }, h("span"));
      const matrixInner = h("div", { class: "oc-matrix-inner" }, corner, colPin, pin, matrix);
      const matrixWrap = ctx.scrollRegion(
        h("div", { class: "oc-scroll" }, matrixInner),
        "All common-unit relations; scroll horizontally to inspect every unit",
        { stickyLabels: true },
      );
      ctx.listen(matrixWrap, "scroll", () => matrixWrap.classList.toggle("oc-scrolled-y", matrixWrap.scrollTop > 1), { passive: true });
      const matrixPanel = h(
        "section",
        { class: "oc-panel prx-light-panel" },
        ctx.panelTitle("After-report relations; outlines mark changes"),
        matrixWrap,
        matrixLegend,
        h("p", { class: "oc-note", text: "Each pair appears twice, once in each triangle. Only units present in both reports enter this comparison." }),
      );
      const changesPanel = h("section", { class: "oc-panel prx-light-panel" }, changedList);
      const tiedNote = h("p", { class: "oc-note" });
      const tieTable = ctx.scrollRegion(h("div", { class: "oc-scroll" }), "Every tied before and after report combination");
      const ties = h("section", {}, ctx.panelTitle("All smallest-risk report combinations"), tiedNote, tieTable);
      ctx.scrollRegion(tableWrap, "Changed relations between untouched units");
      dataBox.body.append(h("div", { class: "oc-data-stack" }, cardsRow, h("div", { class: "oc-matrix-area" }, matrixPanel, changesPanel), ties));

      // Method disclosure: cross-unit optimization policy, unchanged untouched-pair probabilities, and excluded-unit reporting
      const methodBox = ctx.methodBox("Method and why untouched pairs move");
      const inputLine = h("p", { class: "oc-note" });
      const policy = h("p", { class: "oc-order-note" });
      const scope = h("p", { class: "oc-note" });
      const exclusion = h(
        "p",
        { class: "oc-note" },
        "A removed unit is unassessed here, not placed in the lowest grade. ",
        appLink(ctx, "report-designer", { title: "Grade a case and report it" }),
        " explains how to report excluded units (its excluded-unit note).",
      );
      methodBox.body.append(h("div", { class: "oc-method-stack" }, inputLine, policy, scope, exclusion));

      ctx.caption.replaceChildren(
        captionNode(ctx, "teaching-posterior"),
        ". ",
        ctx.num(0.9, formatPercent(0.9)),
        " marginal posterior intervals; removed units are excluded rather than graded last.",
      );

      const LIST_LABEL = "Changed relations between untouched units; the list scrolls";
      function syncListStop() {
        if (!listBox.isConnected) return;
        const over = listBox.scrollHeight > listBox.clientHeight + 1;
        if (over) {
          listBox.setAttribute("tabindex", "0");
          listBox.setAttribute("role", "region");
          listBox.setAttribute("aria-label", LIST_LABEL);
        } else if (ctx.doc.activeElement !== listBox) {
          for (const a of ["tabindex", "role", "aria-label"]) listBox.removeAttribute(a);
        }
      }

      const PIN_SKIP = /^(?:width|height|viewBox|role|aria-[\w-]+|id|tabindex)$/;
      const SVG_NS = "http://www.w3.org/2000/svg";
      const labelCopy = (figure, labels, w, hh) => {
        const copy = ctx.doc.createElementNS(SVG_NS, "svg");
        for (const a of Array.from(figure.svg.attributes)) if (!PIN_SKIP.test(a.name)) copy.setAttribute(a.name, a.value);
        copy.setAttribute("width", String(w));
        copy.setAttribute("height", String(hh));
        copy.setAttribute("viewBox", `0 0 ${w} ${hh}`);
        copy.setAttribute("aria-hidden", "true");
        copy.style.width = `${w}px`;
        copy.style.height = `${hh}px`;
        copy.style.background = "var(--prx-plot-bg)";
        copy.append(labels.cloneNode(true));
        return copy;
      };
      function pinLabels(figure, on) {
        const rows = on ? figure?.figure?.querySelector('g[aria-label="y-axis tick label"]') : null;
        const cols = on ? figure?.figure?.querySelector('g[aria-label="x-axis tick label"]') : null;
        const geo = figure?.relationGeometry;
        matrixWrap.classList.toggle("oc-league-scroll", Boolean(on));
        if (!rows || !cols || !figure?.svg || !geo) {
          for (const n of [pin, colPin]) n.replaceChildren();
          pin.hidden = colPin.hidden = corner.hidden = true;
          matrixWrap.style.removeProperty("scroll-padding-left");
          matrixWrap.style.removeProperty("scroll-padding-top");
          return;
        }
        pin.style.width = `${geo.marginLeft}px`;
        pin.replaceChildren(labelCopy(figure, rows, geo.marginLeft, geo.height));
        colPin.style.width = `${geo.width}px`;
        colPin.replaceChildren(labelCopy(figure, cols, geo.width, geo.marginTop));
        corner.style.width = `${geo.marginLeft}px`;
        Object.assign(corner.firstChild.style, { width: `${geo.marginLeft}px`, height: `${geo.marginTop}px` });
        pin.hidden = colPin.hidden = corner.hidden = false;
        matrixWrap.style.scrollPaddingLeft = `${geo.marginLeft}px`;
        matrixWrap.style.scrollPaddingTop = `${geo.marginTop}px`;
      }
      const revealCell = (d) => {
        if (!matrixWrap.classList.contains("oc-league-scroll")) return;
        matrix.querySelector(".prx-kbd-point:focus")?.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (d?.i === 0) matrixWrap.scrollTop = 0;
        if (d?.j === 0) matrixWrap.scrollLeft = 0;
      };

      function drawCard(c, ids, means, sds, result, key, domain, state, model) {
        while (c.slots.length < model.criteria.length) {
          const box = h("div");
          const slot = h("div");
          box.append(ctx.panelTitle(criterionName(model.criteria[c.slots.length])), slot);
          c.chart.append(box);
          c.slots.push({ box, slot });
        }
        c.slots.forEach((x, k) => {
          x.box.hidden = k >= model.criteria.length;
          if (k < model.criteria.length) x.box.firstChild.textContent = criterionName(model.criteria[k]);
        });
        const selected = ids.indexOf(state.unit);
        let out;
        for (let k = 0; k < model.criteria.length; k++) {
          const card = gaussianCard({
            ids,
            names: ids.map((id) => (model.league ? id : `Site ${id}`)),
            mean: means.map((row) => row[k]),
            sd: sds.map((row) => row[k]),
            axis: `${criterionName(model.criteria[k])}, posterior value`,
            grade1: "Grade 1 = stated highest, as the posterior judges it. Same grade: not compared.",
            unit: model.unit,
            units: model.units,
            title: `${key === "before" ? "Original" : "Corrected"} report, ${criterionName(model.criteria[k])}`,
            storedOrder: "input",
            digits: model.league ? 3 : undefined,
          });
          out = drawReportCard(c.slots[k].slot, card, {
            grade: Array.from(result.grade),
            order: "grade",
            domain,
            selected: selected < 0 ? undefined : selected,
          });
        }
        c.marker.hidden = selected < 0;
        c.marker.replaceChildren(
          h("span", { class: "oc-ring", "aria-hidden": "true" }),
          state.mode === "drop" ? `Ring: unit removed from the second report, ${state.unit}.` : `Ring: correction target, ${state.unit}.`,
        );
        c.legend.replaceChildren(
          gradeLegend(ctx.doc, {
            grade: Array.from(result.grade),
            colors: out.colors,
            unit: model.unit,
            units: model.units,
            grade1: "Grade 1 = stated highest. Same grade: not compared.",
          }),
        );
        const vector = ro(`${key}Grade`, Array.from(result.grade), formatGrades(Array.from(result.grade)));
        vector.classList.add("oc-grade-vector");
        const tag = tagNode(ctx, result, { key, orderWords: model.league ? "expected-rank order" : undefined });
        tag.querySelector("[data-prx-family-size]")?.setAttribute("data-prx-readout", `${key}FamilySize`);
        c.header.replaceChildren(
          tag,
          model.league ? "; grade " : `; report in input order ${ids.join(", ")}: `,
          model.league ? ro(`${key}Sizes`, disclosure(result.grade).sizes, formatSizes(disclosure(result.grade).sizes)) : vector,
          ".",
        );
        if (!model.league) c.header.append(" Grade ", ro(`${key}Sizes`, disclosure(result.grade).sizes, formatSizes(disclosure(result.grade).sizes)), ".");
        if (model.league) c.header.append(h("span", { class: "prx-sr-only" }, " Grade vector in input order ", ids.join(", "), ": ", vector));
        if (model.league) {
          c.header.append(
            " Expected-rank order is recomputed for this population.",
            h("span", { class: "prx-sr-only" }, " ", labelNode(ctx, result, { key: `${key}-order` }), " (", familySizeNode(ctx, result), " contiguous reports)."),
          );
        }
        c.header.append(" N = ", ro(`${key}N`, result.N, formatCount(result.N)), "; risk ", ro(`${key}Risk`, result.risk, formatRisk(result.risk)), ".");
        if (result.tieCount > 1) {
          c.header.append(
            " ",
            ro(`${key}TieCount`, result.tieCount, formatCount(result.tieCount)),
            " reports share the smallest risk; this card shows the first (equal-risk tolerance ",
            ctx.num(result.tieTol, formatSci(result.tieTol)),
            ").",
          );
        }
      }

      function renderUnifiedStage(state, r, movedUntouchedIds) {
        const { model } = r;
        const summarizeCriteria = (means, sds) =>
          model.criteria.length === 1
            ? { mean: means.map((row) => row[0]), sd: sds.map((row) => row[0]) }
            : {
                mean: means.map((row) => 0.5 * (row[0] + row[1])),
                sd: sds.map((row) => 0.5 * Math.hypot(row[0], row[1])),
              };

        const bSum = summarizeCriteria(model.mean, model.sd);
        const aSum = summarizeCriteria(r.mean, r.sd);
        const bCard = gaussianCard({
          ids: model.ids,
          names: model.ids.map((id) => (model.league ? id : `Site ${id}`)),
          mean: bSum.mean,
          sd: bSum.sd,
          expectedRank: model.league ? expectedRank(r.before.E, { w: model.weights }) : null,
          storedOrder: model.league ? "expected_rank" : "input",
        });
        const aCard = gaussianCard({
          ids: r.ids,
          names: r.ids.map((id) => (model.league ? id : `Site ${id}`)),
          mean: aSum.mean,
          sd: aSum.sd,
          expectedRank: model.league ? expectedRank(r.E, { w: model.weights }) : null,
          storedOrder: model.league ? "expected_rank" : "input",
        });

        const bGrade = Array.from(r.before.result.grade);
        const aGrade = Array.from(r.after.grade);
        const bOrder = cardRows(bCard, bGrade, "grade");
        const aOrder = cardRows(aCard, aGrade, "grade");

        const loRaw = Math.min(...bCard.lower, ...aCard.lower);
        const hiRaw = Math.max(...bCard.upper, ...aCard.upper);
        const pad = (hiRaw - loRaw) * 0.05 || 0.5;
        const lo = loRaw - pad;
        const hi = hiRaw + pad;

        const width = Math.max(250, Math.round(stageChart.clientWidth || ctx.width() - 28));
        const isDense = model.league;
        const sideBySide = true;
        const colGap = width < 440 ? 12 : 28;
        const colW = Math.floor((width - colGap) / 2);
        const compactCol = colW < 220;
        const rowH = isDense ? (compactCol ? 7.4 : 9.5) : compactCol ? 25 : 28;
        const headH = compactCol ? 20 : 24;
        const axisH = compactCol ? 34 : 38;
        const marginLeft = isDense ? (compactCol ? 56 : 72) : compactCol ? 48 : 84;
        const marginRight = compactCol ? 6 : 12;
        const stripeXOffset = 4;
        const stripeW = compactCol ? 22 : 24;
        const innerW = Math.max(40, colW - marginLeft - marginRight);

        const bBodyH = Math.round(bOrder.length * rowH);
        const aBodyH = Math.round(aOrder.length * rowH);
        const stackGap = 12;
        const height = sideBySide
          ? headH + Math.max(bBodyH, aBodyH) + axisH
          : headH + bBodyH + stackGap + headH + aBodyH + axisH;

        const ticks = niceLinearTicks(lo, hi, innerW);
        const axisLabel = compactCol
          ? "Posterior"
          : model.league
            ? "League posterior value"
            : model.criteria.length > 1
              ? "Equal-weight composite posterior"
              : `${criterionName(model.criteria[0])} posterior`;

        svgScene(
          stageChart,
          {
            width,
            height,
            alt: `Before and after grade assignments across ${model.ids.length} ${model.units}: ${state.mode === "drop" ? `removing ${state.unit}` : `correcting ${state.unit}`} changes ${r.other.pairs.length} of ${r.other.M} untouched pairs.`,
          },
          (scene) => {
            const { el: sEl, palette: pal } = scene;

            const drawPanel = ({ titleText, card, grade, order, panelX, panelY, bodyH, showAxis }) => {
              const G = Math.max(...grade);
              const colors = gradeColors(G, pal);
              const n = order.length;
              const plotTop = panelY + headH;
              const plotBottom = plotTop + bodyH;
              const xLeft = panelX + marginLeft;
              const xRight = panelX + colW - marginRight;
              const xOf = (v) => xLeft + ((v - lo) / (hi - lo)) * innerW;
              const yOfPos = (pos) => plotTop + ((pos + 0.5) / n) * bodyH;

              const rows = order.map((idx, pos) => ({
                idx,
                pos,
                id: card.ids[idx],
                name: card.names[idx],
                grade: grade[idx],
                mean: card.mean[idx],
                lower: card.lower[idx],
                upper: card.upper[idx],
              }));

              const bands = [];
              for (const row of rows) {
                const b = bands[row.grade - 1] ?? (bands[row.grade - 1] = { grade: row.grade, first: row.pos, last: row.pos, size: 0 });
                b.last = row.pos;
                b.size += 1;
              }
              for (const b of bands) b.mid = (b.first + b.last) / 2;

              const g = sEl("g");
              // Panel title
              g.append(
                sEl("text", {
                  x: panelX + stripeXOffset,
                  y: panelY + 15,
                  fontWeight: 700,
                  fill: pal.plotFg,
                  text: titleText,
                }),
              );

              // Plot frame background & subtle grid lines
              g.append(
                sEl("rect", {
                  x: xLeft,
                  y: plotTop,
                  width: innerW,
                  height: bodyH,
                  fill: pal.plotBg,
                  stroke: pal.plotGrid,
                  strokeWidth: 1,
                }),
              );
              for (const tv of ticks) {
                const tx = xOf(tv);
                g.append(
                  sEl("line", {
                    x1: tx,
                    x2: tx,
                    y1: plotTop,
                    y2: plotBottom,
                    stroke: pal.plotGrid,
                    strokeWidth: 1,
                  }),
                );
              }

              // Alternating odd-grade bands + dashed grade-boundary rules
              for (const b of bands) {
                const y1 = plotTop + (b.first / n) * bodyH;
                const y2 = plotTop + ((b.last + 1) / n) * bodyH;
                if (b.grade % 2 === 1) {
                  g.append(
                    sEl("rect", {
                      x: xLeft,
                      y: y1,
                      width: innerW,
                      height: Math.max(1, y2 - y1),
                      fill: pal.plotGrid,
                      fillOpacity: 0.5,
                    }),
                  );
                }
                if (b.grade > 1) {
                  g.append(
                    sEl("line", {
                      x1: panelX + stripeXOffset,
                      x2: xRight,
                      y1,
                      y2: y1,
                      stroke: pal.plotMuted,
                      strokeDasharray: "4,3",
                      strokeWidth: 1,
                    }),
                  );
                }
              }

              // Left grade-color stripe + PR-03 17px-tall rounded badge pills (placeDirectLabels mapped by item.id, WA-02)
              const stripeX = panelX + stripeXOffset;
              for (const b of bands) {
                const y1 = plotTop + (b.first / n) * bodyH + 0.5;
                const y2 = plotTop + ((b.last + 1) / n) * bodyH - 0.5;
                g.append(
                  sEl("rect", {
                    x: stripeX,
                    y: y1,
                    width: stripeW,
                    height: Math.max(1, y2 - y1),
                    fill: colors[b.grade - 1],
                    rx: 2,
                  }),
                );
              }
              const spaced = pickSpacedBands(bands, yOfPos, 18);
              const placedPills = placeDirectLabels(
                spaced.map((b) => ({ id: String(b.grade), y: yOfPos(b.mid), height: 17 })),
                { minGapPx: 18, bounds: [plotTop + 9, plotBottom - 9] },
              );
              const pillById = new Map(placedPills.map((p) => [p.id, p]));
              for (const b of spaced) {
                const py = pillById.get(String(b.grade))?.y ?? yOfPos(b.mid);
                const fill = colors[b.grade - 1];
                g.append(
                  sEl("rect", {
                    x: stripeX,
                    y: py - 8.5,
                    width: stripeW,
                    height: 17,
                    rx: 3,
                    fill,
                    stroke: pal.plotBg,
                    strokeWidth: 1,
                  }),
                  scene.numText(
                    {
                      x: stripeX + stripeW / 2,
                      y: py,
                      textAnchor: "middle",
                      dominantBaseline: "central",
                      fontWeight: 700,
                      fill: labelOn(fill, pal),
                    },
                    b.grade,
                    formatCount(b.grade),
                  ),
                );
              }

              // Unit rows: intervals, dots, target highlight, and moved untouched flags
              for (const row of rows) {
                const cy = yOfPos(row.pos);
                const isTarget = row.id === state.unit;
                const isMovedUntouched = !isTarget && movedUntouchedIds.has(row.id);
                const gColor = colors[row.grade - 1];
                const x1 = Math.max(xLeft, Math.min(xRight, xOf(row.lower)));
                const x2 = Math.max(xLeft, Math.min(xRight, xOf(row.upper)));
                const xm = Math.max(xLeft, Math.min(xRight, xOf(row.mean)));

                if (isTarget) {
                  const rh = Math.max(6, bodyH / n);
                  g.append(
                    sEl("rect", {
                      x: xLeft,
                      y: cy - rh / 2,
                      width: innerW,
                      height: rh,
                      fill: pal.est,
                      fillOpacity: 0.12,
                    }),
                  );
                }

                g.append(
                  sEl("line", {
                    x1,
                    x2,
                    y1: cy,
                    y2: cy,
                    stroke: isTarget ? pal.est : gColor,
                    strokeWidth: isTarget ? 2.8 : 2.1,
                  }),
                );

                if (isTarget) {
                  g.append(
                    sEl("circle", {
                      cx: xm,
                      cy,
                      r: isDense ? 5.5 : 6.8,
                      fill: "none",
                      stroke: pal.plotFg,
                      strokeWidth: 2,
                    }),
                    sEl("circle", {
                      cx: xm,
                      cy,
                      r: isDense ? 3.2 : 4,
                      fill: pal.est,
                      stroke: pal.plotBg,
                      strokeWidth: 1,
                    }),
                  );
                } else if (isMovedUntouched) {
                  g.append(
                    sEl("circle", {
                      cx: xm,
                      cy,
                      r: isDense ? 3.8 : 4.8,
                      fill: pal.plotBg,
                      stroke: pal.errText,
                      strokeWidth: 1.9,
                    }),
                    sEl("circle", {
                      cx: xm,
                      cy,
                      r: isDense ? 1.7 : 2.1,
                      fill: gColor,
                    }),
                  );
                } else {
                  g.append(
                    sEl("circle", {
                      cx: xm,
                      cy,
                      r: isDense ? 2.4 : 3.5,
                      fill: gColor,
                      stroke: pal.plotBg,
                      strokeWidth: 0.8,
                    }),
                  );
                }

                // Unit labels: all rows for six sites; target callout only for 30-unit league
                if (!isDense || isTarget) {
                  const ly = isDense ? Math.max(plotTop + 7, Math.min(plotBottom - 7, cy)) : cy;
                  const labelStr = !isDense && compactCol ? row.id : row.name;
                  g.append(
                    sEl("text", {
                      x: xLeft - 5,
                      y: ly,
                      textAnchor: "end",
                      dominantBaseline: "central",
                      fontWeight: isTarget ? 700 : isMovedUntouched ? 600 : 400,
                      fill: isTarget ? pal.estText : pal.plotFg,
                      "data-prx-name": "",
                      text: labelStr,
                    }),
                  );
                }
              }

              // Bottom quantitative axis
              if (showAxis) {
                const axisY = plotBottom;
                g.append(
                  sEl("line", {
                    x1: xLeft,
                    x2: xRight,
                    y1: axisY,
                    y2: axisY,
                    stroke: pal.plotAxis,
                    strokeWidth: 1,
                  }),
                );
                const tickGroup = sEl("g", { "aria-label": "x-axis tick label" });
                ticks.forEach((tv, ti) => {
                  const tx = xOf(tv);
                  const nearLeft = tx - xLeft < 12;
                  const nearRight = xRight - tx < 12;
                  tickGroup.append(
                    sEl("line", {
                      x1: tx,
                      x2: tx,
                      y1: axisY,
                      y2: axisY + 4,
                      stroke: pal.plotAxis,
                      strokeWidth: 1,
                    }),
                    scene.numText(
                      {
                        x: tx,
                        y: axisY + 16,
                        textAnchor: nearLeft ? "start" : nearRight ? "end" : "middle",
                        fill: pal.plotAxis,
                      },
                      tv,
                      tickLabel(tv, ti, ticks),
                    ),
                  );
                });
                g.append(
                  tickGroup,
                  sEl("text", {
                    x: xLeft + innerW / 2,
                    y: axisY + 33,
                    textAnchor: "middle",
                    fill: pal.plotAxis,
                    text: axisLabel,
                  }),
                );
              }

              return g;
            };

            if (sideBySide) {
              const sharedBodyH = Math.max(bBodyH, aBodyH);
              scene.add(
                drawPanel({
                  titleText: compactCol ? "Before" : "Before correction",
                  card: bCard,
                  grade: bGrade,
                  order: bOrder,
                  panelX: 0,
                  panelY: 0,
                  bodyH: sharedBodyH,
                  showAxis: true,
                }),
                drawPanel({
                  titleText: compactCol ? "After" : state.mode === "drop" ? "After unit removal" : "After correction",
                  card: aCard,
                  grade: aGrade,
                  order: aOrder,
                  panelX: colW + colGap,
                  panelY: 0,
                  bodyH: sharedBodyH,
                  showAxis: true,
                }),
              );
            } else {
              scene.add(
                drawPanel({
                  titleText: "Before correction",
                  card: bCard,
                  grade: bGrade,
                  order: bOrder,
                  panelX: 0,
                  panelY: 0,
                  bodyH: bBodyH,
                  showAxis: false,
                }),
                drawPanel({
                  titleText: state.mode === "drop" ? "After unit removal" : "After correction",
                  card: aCard,
                  grade: aGrade,
                  order: aOrder,
                  panelX: 0,
                  panelY: headH + bBodyH + stackGap,
                  bodyH: aBodyH,
                  showAxis: true,
                }),
              );
            }
          },
        );
      }

      let lastState = null;
      let lastResult = null;
      let lastDomain = null;

      function relationWords(direction, first, second) {
        if (direction === "withheld") return "withheld";
        return direction === "above" ? first + " above " + second : second + " above " + first;
      }

      function renderDataDetails(state, r, domain, token) {
        const { model } = r;
        const otherIds = r.ids.filter((id) => id !== state.unit);
        const pairLabel = (p) => `${otherIds[p.i]}–${otherIds[p.j]}`;

        const finish = () => {
          const cells = new Set();
          for (const p of r.delta.pairs) {
            cells.add(`${p.i},${p.j}`);
            cells.add(`${p.j},${p.i}`);
          }
          matrixInner.classList.remove("oc-league");
          const figure = drawRelationMatrix(
            ctx,
            matrix,
            matrixLegend,
            { n: r.ids.length, ids: r.ids, g: Array.from(r.after.grade) },
            { changed: { after: Array.from(r.after.grade), cells }, onFocus: revealCell },
          );
          matrixInner.classList.toggle("oc-league", model.league);
          pinLabels(figure, model.league);
          const outline = matrixLegend.querySelector(".prx-rb-swatch-outline");
          if (outline) outline.parentNode.lastChild.textContent = "outline: changed from the original report";

          const rows = r.other.pairs.map((p) =>
            h(
              "tr",
              {},
              h("th", { scope: "row", text: pairLabel(p) }),
              h("td", { text: relationWords(p.from, otherIds[p.i], otherIds[p.j]) }),
              h("td", { text: relationWords(p.to, otherIds[p.i], otherIds[p.j]) }),
            ),
          );
          tableWrap.hidden = !rows.length;
          tableWrap.replaceChildren(
            h(
              "table",
              { class: "oc-table" },
              h("thead", {}, h("tr", {}, ...["Pair", "Before", "After"].map((t) => h("th", { scope: "col", text: t })))),
              h("tbody", {}, ...rows),
            ),
          );
          counts.replaceChildren(
            ctx.num(r.other.pairs.length, formatCount(r.other.pairs.length)),
            " of ",
            ctx.num(r.other.M, formatCount(r.other.M)),
            " pairs between untouched units changed. Largest change in their pair-error probabilities: ",
            ro("coefficientGap", r.coefficientGap, formatDecimal(r.coefficientGap, { digits: 0 })),
            ". By criterion: ",
            ...r.coefficientGaps.flatMap((v, k) => [
              k ? "; " : "",
              criterionName(model.criteria[k]),
              " ",
              ro(`coefficientGap-${k}`, v, formatDecimal(v, { digits: 0 })),
            ]),
            ".",
            rows.length ? "" : " None of their relations changed.",
          );
          ctx.timeout(syncListStop, 0);
        };

        if (model.league) {
          ctx.scheduleStages(
            [
              () => {
                if (token !== renderToken) return;
                drawCard(cards[0], model.ids, model.mean, model.sd, r.before.result, "before", domain, state, model);
              },
              () => {
                if (token !== renderToken) return;
                drawCard(cards[1], r.ids, r.mean, r.sd, r.after, "after", domain, state, model);
              },
              () => {
                if (token === renderToken) finish();
              },
            ],
            { yieldMs: 0 },
          );
        } else {
          ctx.scheduleStages([]);
          drawCard(cards[0], model.ids, model.mean, model.sd, r.before.result, "before", domain, state, model);
          drawCard(cards[1], r.ids, r.mean, r.sd, r.after, "after", domain, state, model);
          finish();
        }
      }

      mobileControls(ctx, { primary: [unit.root, mean.root, sd.root] });
      return {
        render(state, info = {}) {
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && lastState && lastResult && lastDomain) {
              const token = ++renderToken;
              renderDataDetails(lastState, lastResult, lastDomain, token);
            }
            return;
          }

          const token = ++renderToken;
          const model = correctionModel(state);
          const restricted = model.league || state.score === "AB";
          if (!model.ids.includes(state.unit)) {
            ctx.set({ unit: model.league ? "U15" : "C" });
            return;
          }
          if (restricted && state.mode !== "drop") {
            ctx.set({ mode: "drop" });
            return;
          }
          if (model.league && (state.cap !== "all" || state.score !== "A")) {
            ctx.set({ cap: "all", score: "A" });
            return;
          }

          data.set(state.data);
          score.set(state.score);
          score.setDisabled(model.league);
          unit.set(state.unit);
          mode.set(state.mode);
          mode.setDisabled(restricted);
          mean.set(state.mean);
          sd.set(state.sd);
          tau.set(state.tau);
          cap.set(state.cap);
          cap.setDisabled(model.league);
          [...unit.input.options].forEach((option, i) => {
            option.hidden = !model.ids.includes(ALL_IDS[i]);
            option.disabled = option.hidden;
          });
          mean.root.hidden = state.mode !== "mean";
          sd.root.hidden = state.mode !== "sd";
          const activePrimary = state.mode === "mean" ? mean.root : state.mode === "sd" ? sd.root : unit.root;
          for (const ctl of [unit.root, mean.root, sd.root]) {
            if (ctl === activePrimary) ctl.setAttribute("data-prx-primary-control", "");
            else ctl.removeAttribute("data-prx-primary-control");
          }

          const r = correctionResult(state);
          const index = model.ids.indexOf(state.unit);

          inputLine.replaceChildren(
            state.mode === "drop" ? `${state.unit} is removed from the second report.` : `Site ${state.unit}, ${criterionName(model.criteria[0])}: original posterior mean `,
            ...(state.mode === "drop"
              ? []
              : [
                  ctx.num(model.mean[index][0], formatDecimal(model.mean[index][0], { digits: 2 })),
                  ", SD ",
                  ctx.num(model.sd[index][0], formatDecimal(model.sd[index][0], { digits: 2 })),
                  "; corrected ",
                  state.mode === "mean" ? "mean " : "SD ",
                  ctx.num(state[state.mode], formatDecimal(state[state.mode], { digits: 2 })),
                  ".",
                ]),
          );

          if (model.league) {
            policy.replaceChildren(
              "Simulated league from seed ",
              ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
              "; normal prior SD ",
              ctx.num(0.15, formatDecimal(0.15, { digits: 2 })),
              ". We compute a new expected-rank order for each population and find its best contiguous cuts without a cap. Each optimum is specific to its own order.",
            );
          } else {
            policy.replaceChildren(
              ...[
                state.score === "AB"
                  ? [
                      "Scores A and B have equal weights ",
                      ctx.num(0.5, formatDecimal(0.5, { digits: 1 })),
                      " and ",
                      ctx.num(0.5, formatDecimal(0.5, { digits: 1 })),
                      ". Both marginal-card views show this same joint report. ",
                    ]
                  : ["Only ", criterionName(model.criteria[0]), " determines the report and its corrected marginal. "],
                state.cap === "all" ? "Every report in the full family is evaluated." : ["Every report with at most ", ctx.num(state.cap, formatCount(state.cap)), " grades is evaluated."],
                state.score === "AB" ? " Choose one score to correct a marginal instead of dropping a unit." : "",
              ].flat(Infinity),
            );
          }

          const intervals = [
            ...model.mean.flatMap((row, i) => row.map((m, k) => normalInterval(m, model.sd[i][k], 0.9))),
            ...r.mean.flatMap((row, i) => row.map((m, k) => normalInterval(m, r.sd[i][k], 0.9))),
          ];
          const lo = Math.min(...intervals.map((v) => v.lower));
          const hi = Math.max(...intervals.map((v) => v.upper));
          const pad = 0.04 * (hi - lo);
          const domain = [lo - pad, hi + pad];

          matrix.classList.toggle("oc-matrix-wide", model.league);
          scope.replaceChildren(
            state.mode === "drop"
              ? "Removing a unit leaves the other marginal posteriors in place. It changes the comparison population, which can change the expected-rank order. We calculate risk using the pair count for each population. "
              : `Only the selected ${criterionName(model.criteria[0])} marginal changes. `,
            "Every criterion's pair-error probabilities among untouched units are unchanged. Grade numbers themselves are labels. Lines show ",
            ctx.num(0.9, formatPercent(0.9)),
            " marginal posterior intervals; all cards share one axis domain.",
          );

          const hasTies = r.before.result.tieCount > 1 || r.after.tieCount > 1;
          ties.hidden = !hasTies;
          if (hasTies) {
            const bs = r.before.result.grades ?? [r.before.result.grade];
            const as = r.after.grades ?? [r.after.grade];
            const untouched = r.indices.filter((i) => i !== index);
            const positions = untouched.map((i) => r.indices.indexOf(i));
            tiedNote.replaceChildren(
              "Cards, matrix and headline use the first report on each side. This table compares every listed tied combination. Vectors use the input-ID orders printed on their cards; equal-risk tolerance ",
              ro("tieTolerance", r.after.tieTol, formatSci(r.after.tieTol)),
              ".",
            );
            if (r.before.result.tieCount === 1) tiedNote.append(h("span", { class: "prx-sr-only", "aria-hidden": "true" }, ro("beforeTieCount", 1, formatCount(1))));
            if (r.after.tieCount === 1) tiedNote.append(h("span", { class: "prx-sr-only", "aria-hidden": "true" }, ro("afterTieCount", 1, formatCount(1))));
            const combinations = [];
            for (const bg of bs) {
              for (const ag of as) {
                const k = combinations.length;
                const common = relationChange(r.indices.map((i) => bg[i]), ag);
                const other = relationChange(untouched.map((i) => bg[i]), positions.map((i) => ag[i]));
                combinations.push(
                  h(
                    "tr",
                    {},
                    h("td", {}, ro(`tie-beforeGrade-${k}`, Array.from(bg), formatGrades(Array.from(bg)))),
                    h("td", {}, ro(`tie-afterGrade-${k}`, Array.from(ag), formatGrades(Array.from(ag)))),
                    h("td", {}, ro(`tie-commonChanged-${k}`, common.pairs.length, formatCount(common.pairs.length))),
                    h("td", {}, ro(`tie-untouchedChanged-${k}`, other.pairs.length, formatCount(other.pairs.length)))),
                );
              }
            }
            tieTable.replaceChildren(
              h(
                "table",
                { class: "oc-table oc-ties-table prx-sticky-first" },
                h(
                  "thead",
                  {},
                  h("tr", {}, ...["Before grade vector", "After grade vector", "Changed common relations", "Changed untouched relations"].map((text) => h("th", { scope: "col", text }))),
                ),
                h("tbody", {}, ...combinations),
              ),
            );
            if (bs.length < r.before.result.tieCount || as.length < r.after.tieCount) {
              tiedNote.append(" The engine's tied-report list is truncated; additional tied reports are not shown.");
            }
          }

          const otherIds = r.ids.filter((id) => id !== state.unit);
          const pairLabel = (p) => `${otherIds[p.i]}–${otherIds[p.j]}`;
          const movedUntouchedIds = new Set();
          for (const p of r.other.pairs) {
            movedUntouchedIds.add(otherIds[p.i]);
            movedUntouchedIds.add(otherIds[p.j]);
          }

          // Concise <= 35-word readout without inline buttons/chips
          ctx.readout.set([
            hasTies ? "First representatives: " : "",
            state.mode === "drop" ? "Removing " : "Correcting ",
            state.unit,
            " changes ",
            ro("otherChanged", r.other.pairs.length, formatCount(r.other.pairs.length)),
            " of ",
            ro("otherPairs", r.other.M, formatCount(r.other.M)),
            " pairs between units whose inputs stayed fixed. Across all common units, ",
            ro("changed", r.delta.pairs.length, formatCount(r.delta.pairs.length)),
            " of ",
            ro("commonPairs", r.delta.M, formatCount(r.delta.M)),
            " relations change: ",
            ro("newWithheld", r.delta.nNewWithheld, formatCount(r.delta.nNewWithheld)),
            " newly withheld, ",
            ro("newDisclosed", r.delta.nNewDisclosed, formatCount(r.delta.nNewDisclosed)),
            " newly stated, ",
            ro("reversed", r.delta.nReversed, formatCount(r.delta.nReversed)),
            " reversed.",
          ]);

          // Render unified 13px before/after SVG on ctx.stage
          renderUnifiedStage(state, r, movedUntouchedIds);

          // Stage strip for moved untouched pairs (.oc-change-chip visible on ctx.stage)
          const firstPairs = r.other.pairs.slice(0, 4);
          const more = r.other.pairs.length - firstPairs.length;
          const first = firstPairs[0];
          const chips = firstPairs.map(pair =>
            h("span", { class: "oc-change-chip", "data-prx-name": "" }, pairLabel(pair)));
          const example = first && h("span", { class: "oc-change-witness" },
            "For ", h("span", { "data-prx-name": "" }, pairLabel(first)), ", ",
            relationWords(first.from, otherIds[first.i], otherIds[first.j]), " → ",
            relationWords(first.to, otherIds[first.i], otherIds[first.j]), ".");
          changeRow.replaceChildren(
            h("span", { class: "oc-change-label" }, "Moved untouched pairs:"),
            chips.length
              ? h(
                  "span",
                  { class: "oc-change-chips", "aria-label": "Changed pairs between untouched units" },
                  ...chips,
                  more ? h("span", { class: "oc-change-more" }, "and ", ctx.num(more, formatCount(more)), " more") : null,
                )
              : h("span", { class: "oc-change-none" }, "none (", ctx.num(0, formatCount(0)), " of ", ctx.num(r.other.M, formatCount(r.other.M)), ")"),
          );
          if (example) changeRow.append(example);

          const bSizes = disclosure(r.before.result.grade).sizes;
          const aSizes = disclosure(r.after.grade).sizes;
          const targetBits =
            state.mode === "drop"
              ? [h("span", { "data-prx-name": "" }, state.unit), " excluded in After · "]
              : [
                  h("span", { "data-prx-name": "" }, `Site ${state.unit}`),
                  " ",
                  state.mode === "mean" ? "mean " : "SD ",
                  ctx.num(model[state.mode][index][0], formatReadoutEst(model[state.mode][index][0])),
                  " → ",
                  ctx.num(state[state.mode], formatReadoutEst(state[state.mode])),
                  " · ",
                ];
          stageMeta.replaceChildren(
            ...targetBits,
            "ring: target · outlined dot: moved untouched unit · Before: ",
            ctx.num(bSizes, formatSizes(bSizes)),
            " → After: ",
            ctx.num(aSizes, formatSizes(aSizes)),
            ".",
          );

          lastState = state;
          lastResult = r;
          lastDomain = domain;
          renderDataDetails(state, r, domain, token);
        },
      };
    },
  });
}
