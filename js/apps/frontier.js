// Frontier hull view; linked mixture examples are supplied by app 2.11 through the exported renderer.
import { createWidget, uid } from "../shared/base.js";
import { canvasLayer, numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatExpectedCount, formatGrades, formatProb, formatRational, formatRisk, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import {
  exactOptimum, finiteLawPairwise, halfSlopeEligible, lowerHull, matchedDisclosure, orderHull, pairCount, reportCloud,
  supportingVertex, rankSummaries,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "frontier",
  label: "The frontier: every report at its disclosure and expected wrong directions, and the lower boundary H(m)",
  title: "Every report at (N, E), and the boundary H(m)",
  data: Object.freeze({ array: "one" }),
  tau: Object.freeze({ min: 0.01, max: 0.5, step: 0.01, value: 0.2 }),
  families: Object.freeze(["all", "cap3"]),
  family: "all",
  cap: 3,
  examples: Object.freeze(["six", "tb16"]),
  example: "six",
  views: Object.freeze(["near", "all"]),
  view: "near",
  m: Object.freeze({ min: 0, max: 15, value: 10 }),
  half: 0.5,
  // theory book ch. 16 (sec-matched-frontier-example): four units, two criteria, two states
  tb16: Object.freeze({
    states: Object.freeze([
      Object.freeze([Object.freeze([4, 4]), Object.freeze([3, 2]), Object.freeze([2, 3]), Object.freeze([1, 1])]),
      Object.freeze([Object.freeze([3, 1]), Object.freeze([4, 2]), Object.freeze([2, 3]), Object.freeze([1, 4])]),
    ]),
    probs: Object.freeze([0.75, 0.25]),
    w: Object.freeze([0.6, 0.4]),
    ids: Object.freeze(["A", "B", "C", "D"]),
    criteria: Object.freeze(["c1", "c2"]),
    m: 4,
  }),
  // theory book ch. 19: the three-unit law of Which ranking? (L-09), kept in its posterior-mean order A, B, C
  tb19: Object.freeze({
    states: Object.freeze([
      Object.freeze([Object.freeze([20]), Object.freeze([4]), Object.freeze([3])]),
      Object.freeze([Object.freeze([0]), Object.freeze([4]), Object.freeze([3])]),
    ]),
    probs: Object.freeze([0.3, 0.7]),
    ids: Object.freeze(["A", "B", "C"]),
    order: Object.freeze([0, 1, 2]),
  }),
  tieTol: 1e-12,
  // y domain of the view near the boundary: the largest per-N smallest E times nearHead, rounded up to a tenth
  nearHead: 1.15,
  yRound: 10,
  chart: Object.freeze({
    aspect: 0.6, minHeight: 250, maxHeight: 420, marginTop: 28, marginRight: 22, marginBottom: 42, marginLeft: 50,
    dash: 5, dashWidth: 1.5, dashAlpha: 0.45, column: 1, minDot: 3.5, vertexDot: 4.5, ring: 9, ringWidth: 2,
    hullWidth: 2, hullDash: "7 4", lineWidth: 1.5, mixDot: 6, bestSquare: 7, triangle: 3.5, tickRoom: 24, tickStep: 5,
    labelGap: 12, mixRule: "2 3", roomyPlot: 420, xPad: 0.5, thin: 1.25, halo: 3, hullLabelDy: 14,
  }),
  mini: Object.freeze({ width: 360, height: 190, marginTop: 14, marginRight: 22, marginBottom: 38, marginLeft: 44, pad: 0.2, yHead: 1.15, dot: 4.5, ref: "2 3", hullDash: "7 4" }),
  text: Object.freeze({
    slider: "Withholding cost τ (the slope of the line)",
    sliderHint: "Raise a line of this slope from below: the first report it touches is the best report at this τ.",
    familyLegend: "Family of reports",
    familyAll: "no cap",
    familyFixed: "(the four-unit example uses all reports)",
    notUsed: "(not used in the four-unit example)",
    reports: "reports",
    viewLegend: "View",
    viewNear: "Near the boundary",
    viewAll: "Every report (full height)",
    headSix: "Six sites, score A:",
    headTb16: "Four units, two criteria, weights",
    headIn: "every one of the",
    headInEnd: "reports in",
    tb16Note: "Showing the four-unit example of the Deeper layer.",
    xLabel: "pairs stated, N",
    yLabel: "expected wrong directions, E",
    yLabelWeighted: "expected weighted wrong directions, E",
    wrongWords: "expected wrong directions",
    wrongWordsWeighted: "expected weighted wrong directions",
    chartAlt: "Report cloud: for each number of pairs stated N, a gray column of reports from the smallest to the largest expected wrong directions E.",
    chartAltBoundary: " The lower boundary H(m) runs through its vertices, and a line of slope τ touches it.",
    tableCaption: "Reports by the number of pairs they state",
    keyboardLabel: "Columns of reports by the number of pairs stated. Use the arrow keys to read each column.",
    legendReport: "each gray dash is one report (reports with nearly equal E overlap); the column spans the reports that state N pairs",
    legendMin: "the report with the fewest ⟨E⟩ among those that state N pairs",
    legendAbove: "the column continues above the view",
    legendVertex: "vertex of H(m): a report",
    legendHull: "H(m) between vertices:",
    legendLine: "the line of slope τ =",
    legendRing: "the vertex the line touches",
    legendMix: "the mixture at m =",
    legendBest: "the best single report that states exactly m pairs",
    vertexHeading: "Vertices of H(m)",
    vertexNote: "N is the pairs stated and E the ⟨E⟩. Each slope is a τ at which the line stops touching one vertex and moves to the next: below it the line touches the vertex on this row, above it the next one.",
    touchedMark: "touched",
    noNext: "none (last vertex)",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    riskWords: "expected loss per pair (risk)",
    setBack: "Shown at the question's setting:",
    deeperTag: "Deeper",
    mixHeading: "Mixing two complete reports",
    mixIntro: "Between two vertices, H(m) is reached only by choosing one of two complete reports at random: the one that states more pairs with some chance, the other otherwise. Each draw prints a whole report; the average point lies on the dashed segment.",
    mSlider: "Mean disclosure m (pairs stated, on average)",
    orderHeading: "A fixed order",
    exampleHeading: "A second example: four units, two criteria",
    exampleLegend: "Example",
    exampleSix: "Six sites, score A",
    exampleTb16: "Four units, two criteria (theory book, chapter 16)",
    ebarLine: "Each pair's error is the weighted average of its two criterion errors, weights",
    ebarEnd: "; the page",
    ebarPage: "One grade for two scores",
    ebarTail: " defines it.",
    exampleNow: "The figure, the table of vertices and the sections above now show the four-unit example.",
    miniAlt: "The boundary of the three-unit law within its posterior-mean order A, B, C: vertices at N = 0, 2 and 3. Its last edge is steeper than the dotted reference line of slope one half.",
    miniTable: "Vertices of the boundary within the order A, B, C",
    note: "Six fictional sites from the postrank tutorial, score A only; their normal posteriors are specified for teaching and taken as given. Every report of the family is evaluated in this browser.",
    noteTb16: "The four-unit law is the theory book's stipulated two-state posterior (chapter 16), taken as given; every one of its reports is evaluated in this browser.",
  }),
});

export const CSS = `.prx-fr .prx-fr-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-subheading {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fr .prx-fr-head {
  margin: 0.25rem 0 0.35rem;
  font-weight: 600;
}

.prx-fr .prx-fr-vector-key {
  margin: .35rem 0;
  font-size: .9em;
  color: var(--prx-fg-muted);
}

.prx-fr .prx-fr-decoded {
  font-weight: normal;
}

.prx-fr .prx-fr-label {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.95em;
}

.prx-fr .prx-fr-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-sym {
  white-space: nowrap;
}

.prx-fr .prx-fr-lock {
  margin-top: 0.15rem;
}

.prx-fr .prx-fr-family,
.prx-fr .prx-fr-view,
.prx-fr .prx-fr-example {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}

.prx-fr .prx-fr-family > legend,
.prx-fr .prx-fr-view > legend,
.prx-fr .prx-fr-example > legend,
.prx-fr .prx-fr-family > .prx-hint {
  flex: 1 1 100%;
}

.prx-fr .prx-fr-chart,
.prx-fr .prx-fr-mini {
  min-width: 0;
  max-width: 100%;
}

.prx-fr .prx-fr-mini {
  max-width: 24rem;
  margin-top: 0.5rem;
}


.prx-fr .prx-fr-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius);
}

.prx-fr .prx-fr-legend .prx-result-caption {
  color: var(--prx-plot-muted);
}

.prx-fr .prx-fr-key {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.prx-fr .prx-fr-swatch {
  flex: none;
  position: relative;
  display: inline-block;
  width: 1.6em;
  height: 1em;
}

.prx-fr .prx-fr-sw-dash::before,
.prx-fr .prx-fr-sw-line::before,
.prx-fr .prx-fr-sw-hull::before {
  content: "";
  position: absolute;
  left: 0.15em;
  right: 0.15em;
  top: calc(50% - 1px);
  border-top: 2px solid var(--prx-neutral-5);
}

.prx-fr .prx-fr-sw-dash::before {
  left: 0.45em;
  right: 0.45em;
}

.prx-fr .prx-fr-sw-line::before {
  border-top: 1.5px solid var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-hull::before {
  border-top: 2px dashed var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-min::before,
.prx-fr .prx-fr-sw-vertex::before,
.prx-fr .prx-fr-sw-ring::before,
.prx-fr .prx-fr-sw-best::before,
.prx-fr .prx-fr-sw-mix::before,
.prx-fr .prx-fr-sw-above::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.prx-fr .prx-fr-sw-min::before {
  width: 0.6em;
  height: 0.6em;
  border: 1.25px solid var(--prx-plot-fg);
  border-radius: 50%;
  background: var(--prx-plot-bg);
}

.prx-fr .prx-fr-sw-vertex::before {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-ring::before {
  width: 1.1em;
  height: 1.1em;
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
}

.prx-fr .prx-fr-sw-best::before {
  width: 0.9em;
  height: 0.9em;
  border: 1.25px solid var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-mix::before {
  width: 0.7em;
  height: 0.7em;
  border: 2px solid var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  transform: translate(-50%, -50%) rotate(45deg);
}

.prx-fr .prx-fr-sw-above::before {
  width: 0;
  height: 0;
  border-left: 0.35em solid transparent;
  border-right: 0.35em solid transparent;
  border-bottom: 0.6em solid var(--prx-neutral-5);
}


.prx-fr .prx-fr-vertices {
  margin: 1rem 0 0;
  min-width: 0;
}

.prx-fr .prx-fr-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.prx-fr .prx-fr-table {
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}

.prx-fr .prx-fr-table th,
.prx-fr .prx-fr-table td {
  padding: 0.2rem 0.6rem 0.2rem 0;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
}

.prx-fr .prx-fr-table thead th {
  font-weight: 600;
  border-bottom: 1px solid var(--prx-border-strong);
}

.prx-fr .prx-fr-row-touched th,
.prx-fr .prx-fr-row-touched td {
  font-weight: 600;
}

.prx-fr .prx-fr-touched {
  display: inline-block;
  padding: 0 0.35rem;
  font-size: 0.85em;
  font-weight: 600;
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius);
}


.prx-fr .prx-fr-deeper {
  margin: 1rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
  background: var(--prx-bg-raised);
}

.prx-fr .prx-fr-deeper > summary {
  cursor: pointer;
  font-weight: 600;
}

.prx-fr .prx-fr-tag {
  display: inline-block;
  padding: 0 0.4rem;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--prx-on-accent);
  background: var(--prx-accent);
  border-radius: var(--prx-radius);
}

.prx-fr .prx-fr-section {
  margin: 0.9rem 0 0;
  min-width: 0;
}

.prx-fr .prx-fr-section p {
  margin: 0.35rem 0 0;
}

.prx-fr .prx-fr-badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  font-weight: 600;
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius);
  background: var(--prx-bg);
}`;

// ---------------------------------------------------------------------------------------------- data

/** The released error array of score A (JSON null on the diagonal becomes NaN). */
export function errorArrayOf(six) {
  const a = six.arrays[CONFIG.data.array];
  return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))) };
}

const SIX_E = errorArrayOf(SIX);
const deep = (x) => (Array.isArray(x) ? x.map(deep) : x);
const TB16_E = finiteLawPairwise(deep(CONFIG.tb16.states), Array.from(CONFIG.tb16.probs), { ids: Array.from(CONFIG.tb16.ids), criteria: Array.from(CONFIG.tb16.criteria) });
const TB19_E = finiteLawPairwise(deep(CONFIG.tb19.states), Array.from(CONFIG.tb19.probs), { ids: Array.from(CONFIG.tb19.ids) });

const EX = Object.freeze({
  six: { E: SIX_E, w: undefined, weights: [1], exact: false },
  tb16: { E: TB16_E, w: Array.from(CONFIG.tb16.w), weights: Array.from(CONFIG.tb16.w), exact: true },
});

export const familyOf = (key) => (key === "cap3" ? { kind: "atMost", G: CONFIG.cap } : { kind: "all" });
const effectiveFamily = (state) => (state.example === "tb16" ? "all" : state.family);

/** The finite law's criterion-specific tie flags are engine summaries; six-site normals have positive variance. */
const tieFreeFlags = (example) => example === "six" ? [true] : CONFIG.tb16.criteria.map((_, k) =>
  rankSummaries({ states: CONFIG.tb16.states.map((state) => state.map((row) => row[k])), probs: Array.from(CONFIG.tb16.probs) }).tieFree);

/** Round up to the next tenth, for the top of an axis. */
const niceTop = (v) => Math.ceil(v * CONFIG.yRound) / CONFIG.yRound;

const models = new Map();
/** The cloud, the hull and what follows from them for one example and family (cached: they do not depend on τ). */
export function modelOf(example, familyKey) {
  const id = `${example}:${familyKey}`;
  if (models.has(id)) return models.get(id);
  const ex = EX[example];
  const family = familyOf(familyKey);
  const opts = ex.w ? { w: ex.w, family } : { family };
  const cloud = reportCloud(ex.E, opts);
  const hull = lowerHull(cloud);
  const M = cloud.M;
  const slopes = hull.slice(1).map((v, q) => (v.Ew - hull[q].Ew) / (v.N - hull[q].N));
  // the near view keeps the same height for both families of one example (taken from the full family)
  const full = familyKey === "all" ? cloud : modelOf(example, "all").cloud;
  const yNear = niceTop(Math.max(...full.byN.map((r) => r.minEw)) * CONFIG.nearHead);
  const yAll = niceTop(Math.max(...full.byN.map((r) => r.maxEw)));
  const flags = tieFreeFlags(example);
  const eligible = halfSlopeEligible({ family, tieFree: flags, positiveWeights: ex.weights });
  const fmt = ex.exact
    ? { E: (v) => formatRational(v), slope: (v) => formatRational(v), psi: (v) => formatRational(v), risk: (v) => formatRational(v) }
    : { E: (v) => formatExpectedCount(v), slope: (v) => formatRisk(v), psi: (v) => formatProb(v, { digits: 2 }), risk: (v) => formatRisk(v) };
  // the two-criterion law weighs its pair errors, so its E counts expected weighted wrong directions
  const weighted = Boolean(ex.w);
  const wrong = weighted ? CONFIG.text.wrongWordsWeighted : CONFIG.text.wrongWords;
  const m = { example, familyKey, family, opts, E: ex.E, ex, cloud, hull, M, n: cloud.n, slopes, yNear, yAll, eligible, fmt, weighted, wrong };
  models.set(id, m);
  return m;
}

const optima = new Map();
export function optimumOf(model, tau) {
  const id = `${model.example}:${model.familyKey}:${tau}`;
  if (!optima.has(id)) {
    if (optima.size > CONFIG.tau.max / CONFIG.tau.step * 4) optima.clear();
    optima.set(id, exactOptimum(model.E, { ...model.opts, tau }));
  }
  return optima.get(id);
}

let tb19Cache = null;
export function tb19Model() {
  if (!tb19Cache) {
    const hull = orderHull(TB19_E, { order: Array.from(CONFIG.tb19.order) });
    const slopes = hull.slice(1).map((v, q) => (v.Ew - hull[q].Ew) / (v.N - hull[q].N));
    const sv = supportingVertex(hull, CONFIG.half);
    tb19Cache = { hull, slopes, sv, M: pairCount(CONFIG.tb19.ids.length) };
  }
  return tb19Cache;
}

/** Shared canvas cloud, min/max columns, hull, supporting line and optional mixture marks. */
export function createCloudRenderer(ctx, chartSlot) {
  const T = CONFIG.text;
  let cloudLayer = null;
  let paint = { points: [], yTop: 1 };
  ctx.onCleanup(() => cloudLayer?.remove());
  return function drawChart(state, model, opt, sv, mix = null, show = true) {
    const C = CONFIG.chart;
    const M = model.M;
    const yTop = state.view === "all" ? model.yAll : model.yNear;
    const rows = model.cloud.byN.map((r) => ({ ...r, top: Math.min(r.maxEw, yTop), above: r.maxEw > yTop, vertex: model.hull.some((v) => v.N === r.N) }));
    const width = Math.max(1, Math.round(chartSlot.clientWidth || ctx.width()));
    const height = Math.max(C.minHeight, Math.min(C.maxHeight, Math.round(width * C.aspect)));
    const inner = width - C.marginLeft - C.marginRight;
    // every N when there is room; otherwise every fifth N (0, 5, 10, 15 for the six sites), so labels never run together
    const roomy = inner / (M + 1) >= C.tickRoom;
    const xticks = [];
    for (let t = 0; t <= M; t += 1) if (roomy || t % C.tickStep === 0) xticks.push(t);
    const hull = model.hull;
    const touched = show ? sv.vertices : [];
    const lineEnd = (state.tau > 0) ? Math.min(M, (yTop - sv.value) / state.tau) : M;
    const line = [{ N: Math.max(0, -sv.value / state.tau), y: 0 }, { N: lineEnd, y: sv.value + state.tau * lineEnd }];
    const fmtE = model.fmt.E;
    const Hat = (N) => matchedDisclosure(null, hull, N).H;
    const titleOf = (d) => {
      let s = `N = ${formatCount(d.N)}: ${formatCount(d.count)} ${d.count === 1 ? "report states" : "reports state"} ${formatCount(d.N)} pairs. `;
      s += d.count === 1
        ? `Its ${model.wrong}: ${fmtE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}).`
        : `Their ${model.wrong} run from ${fmtE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}) to ${fmtE(d.maxEw)}.`;
      if (show) {
        if (d.vertex) s += " The smallest is a vertex of H(m).";
        else s += ` The smallest lies above H(${formatCount(d.N)}) = ${fmtE(Hat(d.N))}, which a mixture of two reports reaches.`;
      }
      return s;
    };
    paint = { points: model.cloud.points ?? [], yTop };
    const columns = [
      { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
      { label: "Reports", value: "count", format: (v) => formatCount(v) },
      { label: "Smallest E", value: "minEw", format: (v) => fmtE(v) },
      { label: "Report with the smallest E", value: (d) => Array.from(d.minGrade), format: (v) => formatGrades(v) },
      { label: "Largest E", value: "maxEw", format: (v) => fmtE(v) },
    ];
    if (show) columns.push({ label: "H at this N", value: (d) => Hat(d.N), format: (v) => fmtE(v) });
    const fig = plot(chartSlot, {
      alt: T.chartAlt + (show ? T.chartAltBoundary : ""),
      table: { caption: T.tableCaption, columns, rows },
      width, height,
      marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
      x: { domain: [-C.xPad, M + C.xPad], ticks: xticks, tickFormat: (d) => formatCount(d), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
      y: { domain: [0, yTop], label: model.weighted ? T.yLabelWeighted : T.yLabel, labelArrow: "none", grid: true },
      color: { type: "identity" },
      marks: (c, P) => {
        const marks = [
          P.ruleX(rows, { x: "N", y1: "minEw", y2: "top", stroke: c.neutral[4], strokeWidth: C.column }),
          P.dot(rows.filter((d) => d.above), { x: "N", y: () => yTop, symbol: "triangle", r: C.triangle, fill: c.neutral[4] }),
          P.dot(rows, { x: "N", y: "minEw", r: C.minDot, fill: c.plotBg, stroke: c.plotFg, strokeWidth: C.thin }),
        ];
        if (show) {
          marks.push(
            P.line(hull, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
            P.line(line, { x: "N", y: "y", stroke: c.plotFg, strokeWidth: C.lineWidth, clip: true }),
            P.dot(hull.filter((v) => v.Ew <= yTop), { x: "N", y: "Ew", r: C.vertexDot, fill: c.plotFg, stroke: c.plotBg }),
            P.dot(touched, { x: "N", y: "Ew", r: C.ring, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }),
            P.text([line[1]], { x: "N", y: "y", text: () => "τ", dx: C.labelGap / 2, dy: C.labelGap, textAnchor: "start", fill: c.plotFg, fontStyle: "italic" }),
            P.text([hull.at(-1)].filter((v) => v.Ew <= yTop && inner >= C.roomyPlot), { x: "N", y: "Ew", text: () => "H(m)", dx: -C.labelGap, dy: C.hullLabelDy, textAnchor: "end", fill: c.plotFg }),
            numText(roomy ? touched.slice(0, 1) : [], {
              render(index, scales, values, dims, context, next) {
                const mark = next(index, scales, values, dims, context);
                mark.setAttribute("data-prx-cloud-report-label", "");
                return mark;
              },
              x: "N", y: "Ew", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v),
              dx: touched[0]?.N > M / 2 ? -C.labelGap : C.labelGap, dy: -C.labelGap,
              textAnchor: touched[0]?.N > M / 2 ? "end" : "start", fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke",
            }),
          );
          if (mix) {
            marks.push(
              P.ruleX([mix], { x: "N", y1: 0, y2: "H", stroke: c.plotMuted, strokeDasharray: C.mixRule }),
              mix.best ? P.dot([mix], { x: "N", y: (d) => d.best.Ew, symbol: "square", r: C.bestSquare,
                render(index, scales, values, dims, context, next) {
                  const mark = next(index, scales, values, dims, context);
                  mark.setAttribute("data-prx-cloud-best", "");
                  return mark;
                }, fill: "none", stroke: c.plotFg, strokeWidth: C.thin, clip: true }) : null,
              P.dot([mix], { x: "N", y: "H", symbol: "diamond", r: C.mixDot, fill: c.plotBg, stroke: c.plotFg, strokeWidth: 2 }),
            );
          }
        }
        return marks;
      },
      keyboard: { data: rows, x: "N", y: "minEw", key: (d) => `N${d.N}`, label: T.keyboardLabel, title: titleOf },
    });
    // Preserve the usual direct-label offset unless a mixture's best-report square intersects it.
    // Measure actual SVG glyphs so this works for both viewport sizes and grade-vector lengths.
    const reportLabel = fig.svg.querySelector('[data-prx-cloud-report-label] text');
    const bestSquare = fig.svg.querySelector('[data-prx-cloud-best] path');
    if (reportLabel && bestSquare) {
      const labelBox = reportLabel.getBoundingClientRect();
      const squareBox = bestSquare.getBoundingClientRect();
      const pad = C.halo + C.thin;
      const intersects = labelBox.width > 0 && labelBox.left < squareBox.right + pad && labelBox.right > squareBox.left - pad
        && labelBox.top < squareBox.bottom + pad && labelBox.bottom > squareBox.top - pad;
      if (intersects) {
        const svgBox = fig.svg.getBoundingClientRect();
        const ratio = width / svgBox.width;
        let shift = squareBox.top - pad - labelBox.bottom;
        if (labelBox.top + shift < svgBox.top + C.marginTop / ratio) shift = squareBox.bottom + pad - labelBox.top;
        reportLabel.setAttribute("transform", `${reportLabel.getAttribute("transform") ?? ""} translate(0,${shift * ratio})`);
        reportLabel.setAttribute("data-prx-label-placement", "avoids-best-square");
        const shifted = reportLabel.getBoundingClientRect();
        const leader = fig.svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
        leader.setAttribute("x1", fig.scale("x").apply(touched[0].N));
        leader.setAttribute("y1", fig.scale("y").apply(touched[0].Ew));
        leader.setAttribute("x2", (Math.min(shifted.right, Math.max(shifted.left, squareBox.right)) - svgBox.left) * ratio);
        leader.setAttribute("y2", ((shift < 0 ? shifted.bottom : shifted.top) - svgBox.top) * ratio);
        leader.setAttribute("stroke", fig.palette.plotMuted);
        leader.setAttribute("stroke-width", C.thin);
        leader.setAttribute("aria-hidden", "true");
        leader.setAttribute("data-prx-report-leader", "");
        reportLabel.parentNode.before(leader);
      }
    }
    if (!cloudLayer) {
      cloudLayer = canvasLayer(fig, (g, { x, y, palette }) => {
        g.save?.();
        g.globalAlpha = C.dashAlpha;
        g.strokeStyle = palette.neutral[4];
        g.lineWidth = C.dashWidth;
        g.beginPath();
        for (const p of paint.points) {
          if (p.Ew > paint.yTop) continue;
          const px = x(p.N);
          const py = y(p.Ew);
          g.moveTo(px - C.dash, py);
          g.lineTo(px + C.dash, py);
        }
        g.stroke();
        g.restore?.();
      });
    }
  };
}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fr",
    css: CSS,
    keys: {
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
      view: { type: "choice", values: CONFIG.views.slice(), value: CONFIG.view },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;

      // helpers: a read-out number with its hook; nodes for a grade vector
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const gradeNum = (name, g) => h("span", { class: "prx-fr-report" }, ro(name, Array.from(g), formatGrades(Array.from(g))),
        h("span", { class: "prx-fr-decoded" }, ` = ${blocksText(g, SIX_E.ids)}`));
      const famNode = (fam) => { const node = familyNameNode(ctx, { family: fam }); node.classList.add("prx-fr-sym"); return node; };
      const half = () => ctx.num(CONFIG.half, formatRational(CONFIG.half));
      const point = (model, v, prefix) => ["(", ro(`${prefix}N`, v.N, formatCount(v.N)), ", ", ro(`${prefix}E`, v.Ew, model.fmt.E(v.Ew)), ")"];

      // --- controls: τ, the family, the view
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderHint, onInput: (v) => ctx.set({ tau: v }),
      });
      // the family labels name the current example's families (the four-unit example offers all reports only)
      const famLabel = (f, example = "six") => {
        const words = f === "all" ? [T.familyAll] : ["at most ", ctx.num(CONFIG.cap, formatCount(CONFIG.cap)), " grades"];
        if (example === "tb16" && f !== "all") return [...words, ` ${T.notUsed}`];
        const fam = modelOf(example, f).cloud.family;
        return [famNode(fam), " · ", ctx.num(fam.size, formatCount(fam.size)), ` ${T.reports} (`, ...words, ")"];
      };
      let labelledFor = "six";
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend, name: "family", className: "prx-fr-family",
        options: CONFIG.families.map((f) => ({ value: f, label: famLabel(f) })),
        value: ctx.state.family, onChange: (v) => ctx.set({ family: v }),
      });
      const familyFixed = h("p", { class: "prx-hint", hidden: true, text: T.familyFixed });
      familySwitch.root.append(familyFixed);
      const viewSwitch = ctx.radioGroup({
        legend: T.viewLegend, name: "view", className: "prx-fr-view",
        options: [{ value: "near", label: T.viewNear }, { value: "all", label: T.viewAll }],
        value: ctx.state.view, onChange: (v) => ctx.set({ view: v }),
      });
      ctx.controls.append(tau.root, familySwitch.root, viewSwitch.root);

      // --- result headline: the live read-out, then the label with the family and its size
      const labelLine = h("p", { class: "prx-fr-label", "data-prx-part": "readout" });
      const vectorKey = h("p", { class: "prx-fr-vector-key", "data-prx-part": "notes" },
        `Vector positions: ${SIX_E.ids.join(" / ")}. Smaller grades mean higher priority; equal grades withhold. > means “stated above”.`);
      ctx.controls.after(vectorKey, ctx.readout.node);
      ctx.readout.node.after(labelLine);

      // --- the figure
      const head = h("p", { class: "prx-fr-head" });
      const chartSlot = h("div", { class: "prx-fr-chart" });
      const legend = h("div", { class: "prx-fr-legend", "data-prx-part": "legend" });
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexHeadingId = uid("prx-fr-vertices");
      ctx.charts.append(head, chartSlot, legend, vertexBox);
      const drawChart = createCloudRenderer(ctx, chartSlot);

      // --------------------------------------------------------------------------------------- drawing

      function drawHead(state, model) {
        const fam = model.cloud.family;
        const pre = state.example === "tb16"
          ? [`${T.headTb16} (`, ...model.ex.weights.flatMap((w, k) => [k ? ", " : "", ctx.num(w, formatRational(w))]), "): "]
          : [`${T.headSix} `];
        head.replaceChildren(...pre, `${T.headIn} `, ro("familySize", fam.size, formatCount(fam.size)), ` ${T.headInEnd} `,
          famNode(fam), ".");
      }

      function drawLegend(state, model, mix, show) {
        const key = (cls, ...text) => h("span", { class: "prx-fr-key" }, h("span", { class: `prx-fr-swatch ${cls}` }), h("span", {}, ...text));
        const items = [
          key("prx-fr-sw-dash", T.legendReport),
          key("prx-fr-sw-min", T.legendMin.replace("⟨E⟩", model.wrong)),
        ];
        const yTop = state.view === "all" ? model.yAll : model.yNear;
        if (model.cloud.byN.some((r) => r.maxEw > yTop)) items.push(key("prx-fr-sw-above", T.legendAbove));
        if (show) {
          items.push(
            key("prx-fr-sw-vertex", T.legendVertex),
            key("prx-fr-sw-hull", `${T.legendHull} `, captionNode(ctx, "mixture-not-report")),
            key("prx-fr-sw-line", `${T.legendLine} `, ctx.num(state.tau, formatSetting(state.tau))),
            key("prx-fr-sw-ring", T.legendRing),
          );
          if (mix) {
            items.push(key("prx-fr-sw-mix", `${T.legendMix} `, ctx.num(mix.N, formatCount(mix.N))));
            if (mix.best) items.push(key("prx-fr-sw-best", T.legendBest));
          }
        }
        legend.replaceChildren(...items);
      }

      function drawHeadline(state, model, opt, sv) {
        const fmt = model.fmt;
        const fam = opt.family;
        const tauNode = ctx.num(state.tau, formatSetting(state.tau));
        const sym = famNode(fam);
        if (sv.vertices.length > 1) {
          const a = sv.vertices[0];
          const b = sv.vertices.at(-1);
          ctx.readout.set(["τ = ", tauNode, " in ", sym, ": the line of slope τ lies along the edge from ", ...point(model, a, "edgeA"), " to ",
            ...point(model, b, "edgeB"), "; the reports at both ends, ",
            ...opt.grades.flatMap((g, k) => [k ? " and " : "", gradeNum(`tiedGrade${k}`, g)]),
            `, share the smallest ${T.riskWords}, `, ro("risk", opt.risk, fmt.risk(opt.risk)), "."]);
        } else {
          const v = sv.vertex;
          ctx.readout.set(["τ = ", tauNode, " in ", sym, ": the line of slope τ touches H(m) at the vertex N = ", ro("N", v.N, formatCount(v.N)),
            ", E = ", ro("E", v.Ew, fmt.E(v.Ew)), ", the report ", gradeNum("grades", v.grade), `, with ${T.riskWords} `,
            ro("risk", opt.risk, fmt.risk(opt.risk)), "."]);
        }
        const parts = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated). ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`];
        labelLine.replaceChildren(...parts);
      }

      function drawVertices(state, model, sv) {
        const fmt = model.fmt;
        const hull = model.hull;
        const touched = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = hull.map((v, q2) => {
          const s = model.slopes[q2];
          const mark = touched.has(v.N) ? h("span", { class: "prx-fr-touched" }, `${T.touchedMark} at τ = `, ctx.num(state.tau, formatSetting(state.tau))) : "";
          return h("tr", { class: touched.has(v.N) ? "prx-fr-row-touched" : "" },
            h("th", { scope: "row" }, ro(`vN-${q2}`, v.N, formatCount(v.N))),
            h("td", {}, ro(`vE-${q2}`, v.Ew, fmt.E(v.Ew))),
            h("td", {}, gradeNum(`vGrade-${q2}`, v.grade), " ", mark),
            h("td", {}, s === undefined ? T.noNext : ro(`slope-${q2 + 1}`, s, fmt.slope(s))));
        });
        vertexBox.replaceChildren(
          h("h4", { class: "prx-fr-heading", id: vertexHeadingId, text: T.vertexHeading }),
          h("div", { class: "prx-fr-table-wrap" }, h("table", { class: "prx-fr-table", "aria-labelledby": vertexHeadingId },
            h("thead", {}, h("tr", {}, th("N"), th("E"), th("Report"), th("Slope of the next edge"))),
            h("tbody", {}, ...rows))),
          h("p", { class: "prx-fr-note", text: T.vertexNote.replace("⟨E⟩", model.wrong) }));
        ctx.scrollRegion(vertexBox.querySelector(".prx-fr-table-wrap"), T.vertexHeading);
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const show = true;
            const model = modelOf("six", state.family);
            tau.set(state.tau);
            familySwitch.set(state.family);
            viewSwitch.set(state.view);
            const opt = optimumOf(model, state.tau);
            const sv = supportingVertex(model.hull, state.tau, { M: model.M });
            drawHead(state, model);
            drawHeadline(state, model, opt, sv);
            drawChart(state, model, opt, sv);
            drawLegend(state, model, null, show);
            drawVertices(state, model, sv);
            ctx.caption.textContent = T.note;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
