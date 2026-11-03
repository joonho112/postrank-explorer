// Full six-site risk, linked staged matrix, change-point strip, and fixed-report comparison.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, plot } from "../shared/chart.js";
import { formatCount, formatExpectedCount, formatGrades, formatProb, formatRisk, formatSci, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { canonicalGrade, confidentPairs, evaluateReport, exactOptimum, familySize, pairCount, relations, tauPath } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "price-of-silence",
  label: "The price of silence: the best grade report for six sites at a withholding cost",
  title: "Six sites, score A: which report has the smallest risk?",
  data: Object.freeze({ array: "one", criterion: "score_A" }),
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  cap: Object.freeze({ capped: 3, none: "none", value: 3, split: 4.5, noneWords: Object.freeze(["none", "all", "off", "no", "false"]) }),
  // stage 1-2 fill: seven Purples steps, cut at these error probabilities
  purpleCuts: Object.freeze([0.01, 0.05, 0.1, 0.2, 0.35, 0.5]),
  matrix: Object.freeze({
    marginTop: 24, marginLeft: 26, marginRight: 6, marginBottom: 6,
    minCell: 34, maxCell: 58, inset: 0.5, outline: 2.5, outlineThin: 1.25, outlineInset: 3, dotShare: 0.3, labelHalo: 3,
    hatchSpacing: 6, hatchWidth: 1.2, columns: 6,
  }),
  // change-point strip: tick labels sit labelDy px below the band; a label closer than minLabelGap px to the previous
  // label on the first line goes to a second line, lineStep px lower (the strip then grows by lineStep)
  strip: Object.freeze({
    height: 62, marginTop: 6, marginBottom: 22, marginLeft: 10, marginRight: 14, band: 0.62, marker: 2.5, rotate: 180,
    labelDy: 9, lineStep: 12, minLabelGap: 36, tauDx: 9,
  }),
  bars: Object.freeze({ row: 30, marginTop: 6, marginBottom: 40, marginLeft: 104, marginRight: 52, labelOffset: 34, minLabelPx: 40, padding: 0.3, rule: "4 3" }),
  stages: Object.freeze([
    Object.freeze({ value: 1, label: "Pair errors" }),
    Object.freeze({ value: 2, label: "Errors below τ" }),
    Object.freeze({ value: 3, label: "The best report's blocks" }),
  ]),
  choices: Object.freeze([
    Object.freeze({ value: "r111111", grade: Object.freeze([1, 1, 1, 1, 1, 1]), label: "All six sites in one grade" }),
    Object.freeze({ value: "r112233", grade: Object.freeze([1, 1, 2, 2, 3, 3]), label: "{A, B} > {C, D} > {E, F}" }),
    Object.freeze({ value: "r123333", grade: Object.freeze([1, 2, 3, 3, 3, 3]), label: "{A} > {B} > {C, D, E, F}" }),
    Object.freeze({ value: "r111222", grade: Object.freeze([1, 1, 1, 2, 2, 2]), label: "{A, B, C} > {D, E, F}" }),
  ]),
  close: Object.freeze([Object.freeze([0, 1]), Object.freeze([2, 3]), Object.freeze([4, 5])]),
  text: Object.freeze({
    slider: "Withholding cost τ",
    // the hint as parts: {one} is the cost of a wrong direction, a data-num node
    sliderHint: Object.freeze(["A wrong stated direction costs ", "{one}", "; staying silent on one pair costs τ."]),
    stagesLegend: "Matrix view",
    stageHints: Object.freeze([
      "Each cell is the probability that stating the row site above the column site is wrong. Darker purple means a larger error.",
      "Outlined cells have an error below τ: on its own, stating that direction costs less than staying silent on the pair.",
      "Colors show what the best report does with each pair; the outlines still mark the errors below τ. Numbers are still the error of stating the row site above the column site.",
    ]),
    numbersStill: "Numbers are still the error of stating the row site above the column site.",
    purplesTitle: "Pr(stating row above column is wrong)",
    relationTitle: "Row relative to column in the best report",
    relAbove: "row site stated above",
    relWithheld: "withheld (not a claim of equality)",
    relBelow: "row site stated below",
    outlineLegend: "outline: error below τ",
    outlineThin: "thinner where the best report states the pair",
    gradeLegend: "circle: the site's grade (grade 1 = highest priority on score A, the sites visited first)",
    belowWord: "below",
    andAbove: "and above",
    matrixAlt: "Six-by-six matrix of the six sites: each cell is about the statement 'row site above column site'.",
    matrixTable: "The fifteen pairs, the error of stating the higher site above the lower one, and what the best report does",
    stripHeading: "Where the best report changes as τ moves",
    stripNote: "Bands: one best report each; the number in a band is the pairs it states, N.",
    stripNone: "No change point between the ends of the slider in this family.",
    stripAlt: "Strip of τ values between the slider ends, cut at the τ values where the best report changes; the current τ is marked.",
    stripTable: "The best report on each stretch of τ",
    riskHeading: "Risk of the best report",
    barsAlt: "Bars of the risk split: the error term and the withholding term of the best report, beside the all-withheld report, whose risk is τ.",
    barsTable: "Risk split of the reports shown",
    best: "Best report",
    allWithheld: "All withheld",
    yours: "Your report",
    errLegend: "E/M: expected wrong directions per pair",
    whLegend: "τ(M − N)/M: the price of the withheld pairs, per pair",
    axisNote: "The dashed line is at the current τ, the risk of the all-withheld report;",
    // the second stage's summary: "Change the family: at most 3 grades (shown now) or no cap", with "(shown now)"
    // after the family on screen
    stage2: "Change the family:",
    stage2Shown: "(shown now)",
    stage2Or: "or",
    stage2NoCap: "no cap",
    stage2Hint: "The family is the set of reports the best report is chosen from. Switch it, then compare the outlined cells with the colors of the third view.",
    familyLegend: "Family of reports",
    capWords: "At most",
    capGrades: "grades",
    noCap: "No cap (all reports)",
    reports: "reports",
    note: "Six fictional sites from the postrank tutorial, score A only; their normal posteriors are specified for teaching and taken as given. Every report in the family is evaluated in this browser.",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    belowCount: "Pairs with an error below τ in one direction:",
    belowWithheld: "Below τ but withheld by the best report:",
    statedOver: "Stated by the best report although the error is τ or more:",
    statedOverNote: "(for these six sites no τ on the slider gives such a pair, in either family)",
    riskWords: "with expected loss per pair (risk)",
    blockAnd: " and ",
    blockThen: ", then ",
  }),
});

const SVGNS = "http://www.w3.org/2000/svg";
const N_STAGES = CONFIG.stages.length;

// ---------------------------------------------------------------------------------------------- data and family

/** The released error array of score A (JSON null on the diagonal becomes NaN). */
function errorArrayOf(six) {
  const a = six.arrays[CONFIG.data.array];
  return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))) };
}

const ERRORS = errorArrayOf(SIX);
const IDS = ERRORS.ids;
const N_UNITS = IDS.length;
const M = pairCount(N_UNITS);
const E0 = ERRORS.e[0];
const ALL_WITHHELD = Object.freeze(IDS.map(() => 1));

/** The cap key: 3 or "none" (a number goes to the nearer of the two; words meaning "no cap" give "none"). */
function parseCap(v) {
  if (typeof v === "string" && CONFIG.cap.noneWords.includes(v.trim().toLowerCase())) return CONFIG.cap.none;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return n < CONFIG.cap.split ? CONFIG.cap.capped : CONFIG.cap.none;
}

const familyOf = (cap) => (cap === CONFIG.cap.none ? { kind: "all" } : { kind: "atMost", G: cap });

/** The sites of each grade, grade 1 first. */
function blocksOf(grade) {
  const G = Math.max(...grade);
  const out = [];
  for (let h = 1; h <= G; h += 1) out.push(IDS.filter((_, i) => grade[i] === h));
  return out;
}

/** Blocks of a grade vector in grade order: "{A, B} > {C, D} > {E, F}". */
const blocksText = (grade) => blocksOf(grade).map((b) => `{${b.join(", ")}}`).join(" > ");

/** The same blocks in words for screen readers: "A and B, then C and D, then E and F". */
function blocksWords(grade) {
  const T = CONFIG.text;
  const list = (b) => (b.length < 2 ? b.join("") : `${b.slice(0, -1).join(", ")}${T.blockAnd}${b.at(-1)}`);
  return blocksOf(grade).map(list).join(T.blockThen);
}

/** The step (1-7) of the Purples ramp for an error probability. */
const purpleStep = (e) => 1 + CONFIG.purpleCuts.filter((c) => e >= c).length;

/** For each unordered pair i < j: the smaller error of its two directions, and whether it is below τ. */
function pairRows(tau, rel) {
  const rows = [];
  for (let i = 0; i < N_UNITS; i += 1) {
    for (let j = i + 1; j < N_UNITS; j += 1) {
      const up = E0[i][j] <= E0[j][i];
      const [a, b] = up ? [i, j] : [j, i];
      const e = E0[a][b];
      const stated = rel ? rel[a][b] !== 0 : null;
      const statedUp = rel ? rel[a][b] === 1 : null;
      rows.push({ a, b, e, below: e < tau, stated, statedUp, statedError: stated ? (statedUp ? e : E0[b][a]) : null });
    }
  }
  return rows;
}

/** Canonical report labels, in A–F order, or null when no report is entered. */
export function parseYourReport(value) {
  if (value === null || value === "" || value === "none") return null;
  const grade = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value)
    : typeof value === "string" ? value.trim().split(/[\s,;/]+/).map(Number) : [];
  if (grade.length !== N_UNITS || !grade.every(Number.isSafeInteger)) return undefined;
  return Array.from(canonicalGrade(grade));
}

const CSS = `.prx-pos .prx-pos-heading{
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-pos .prx-pos-strip{
  margin: 1rem 0 0;
  min-width: 0;
}
.prx-pos .prx-pos-note{
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}
.prx-pos .prx-pos-label{
  margin: 0.5rem 0 0.75rem;
  font-size: 0.95em;
}
.prx-pos .prx-pos-label .prx-result-label{
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-pos .prx-pos-grid{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  min-width: 0;
}
.prx-pos .prx-pos-matrix, .prx-pos .prx-pos-risk{
  min-width: 0;
}
.prx-pos .prx-pos-stages{
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
  margin: 0 0 0.25rem;
}
.prx-pos .prx-pos-stages > legend{
  flex: 1 1 100%;
}
.prx-pos .prx-pos-stage-hint{
  margin: 0 0 0.5rem;
}
.prx-pos .prx-pos-matrix-chart, .prx-pos .prx-pos-bars-chart, .prx-pos .prx-pos-strip-chart{
  min-width: 0;
  max-width: 100%;
}
.prx-pos .prx-pos-legend{
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius, 6px);
}
.prx-pos .prx-pos-legend-title{
  flex: 1 1 100%;
  font-weight: 600;
}
.prx-pos .prx-pos-legend-note{
  flex: 1 1 100%;
}
.prx-pos .prx-pos-key{
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}
.prx-pos .prx-pos-swatch{
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}
.prx-pos .prx-pos-swatch-hatch{
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 5px);
}
.prx-pos .prx-pos-swatch-outline{
  background: var(--prx-plot-bg);
  border: 3px solid var(--prx-plot-fg);
}
.prx-pos .prx-pos-swatch-dot{
  background: var(--prx-grade-1);
  border-radius: 50%;
}
.prx-pos .prx-pos-counts p{
  margin: 0.35rem 0 0;
  font-size: 0.9em;
}
.prx-pos .prx-pos-formula{
  max-width: 100%;
  margin: 0 0 0.5rem;
  overflow-x: auto;
}
.prx-pos .prx-pos-formula math{
  margin: 0.15rem 0;
}
.prx-pos .prx-pos-tiles{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.5rem;
  margin: 0.75rem 0 0;
}
.prx-pos .prx-pos-tile{
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.prx-pos .prx-pos-tile-name{
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}
.prx-pos .prx-pos-tile-value{
  font-size: 1.15em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.prx-pos .prx-pos-reference, .prx-pos .prx-pos-yours{
  margin: 0.5rem 0 0;
  font-size: 0.95em;
}
.prx-pos .prx-pos-stage2{
  margin: 1rem 0 0;
  padding: 0 0.75rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}
.prx-pos .prx-pos-stage2 > .prx-hint{
  margin: 0.5rem 0;
}
.prx-pos .prx-pos-family{
  margin: 0 0 0.5rem;
}
.prx-pos .prx-pos-badge{
  display: inline;
  overflow-wrap: anywhere;
}

.prx-pos .prx-pos-stage2 { padding: .65rem .75rem; }
.prx-pos .prx-pos-family-heading { margin: 0 0 .5rem; font-weight: 600; }
.prx-pos .prx-pos-entry { margin-top: 1rem; padding: .75rem; border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-pos .prx-pos-entry input { max-width: 100%; width: 100%; box-sizing: border-box; margin: .25rem 0 .5rem; }
.prx-pos .prx-pos-entry label { display: block; }
`;

/** Draw the six-site tauPath bands into caller-owned slot and note nodes. */
export function drawTauStrip(ctx, { slot: stripSlot, note: stripNote }, state, path, { lo = CONFIG.tau.min, hi = CONFIG.tau.max } = {}) {
  const T = CONFIG.text;
  const segs = path.intervals
    .map((iv) => ({ ...iv, from: Math.max(lo, iv.tauFrom), to: Math.min(hi, iv.tauTo) }))
    .filter((iv) => iv.to > iv.from);
  const changes = segs.slice(1).map((s, k) => {
    const before = segs[k];
    const r0 = relations(Array.from(before.grade));
    const r1 = relations(Array.from(s.grade));
    const newly = [];
    for (let i = 0; i < N_UNITS; i += 1) for (let j = 0; j < N_UNITS; j += 1) if (r1[i][j] === 1 && r0[i][j] !== 1) newly.push(`${IDS[i]} above ${IDS[j]} (error ${formatProb(E0[i][j])})`);
    return { tau: s.from, from: before.grade, to: s.grade, newly };
  });
  const ends = [lo, hi];
  const tickText = (d) => (ends.some((x) => Math.abs(x - d) < Number.EPSILON) ? formatSetting(d) : formatProb(d));
  const S = CONFIG.strip;
  const fills = (pal) => [pal.plotGrid, pal.plotBg];
  // Place each tick in the first row with room; low-cost ranges can need more than two rows.
  const width = Math.max(1, Math.round(stripSlot.clientWidth || ctx.width()));
  const inner = Math.max(1, width - S.marginLeft - S.marginRight);
  const ticks = [lo, ...changes.map((c) => c.tau), hi].map((t, k) => ({ t, k: String(k), row: 1 }));
  const lastByRow = [];
  for (const d of ticks) {
    const px = ((d.t - lo) / (hi - lo)) * inner;
    let row = lastByRow.findIndex((last) => px - last >= S.minLabelGap);
    if (row < 0) row = lastByRow.length;
    lastByRow[row] = px;
    d.row = row + 1;
  }
  const extraHeight = Math.max(0, lastByRow.length - 1) * S.lineStep;
  const tagTicks = (rows) => (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
    Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-tick", rows[i].k));
    return g;
  };
  const tickLabels = (c, row) => {
    const rows = ticks.filter((d) => d.row === row);
    return numText(rows, {
      x: "t", y: 0, value: "t", format: (v) => tickText(v), dy: S.labelDy + (row - 1) * S.lineStep,
      lineAnchor: "top", textAnchor: "middle", fill: c.plotFg, render: tagTicks(rows),
    });
  };
  plot(stripSlot, {
    alt: T.stripAlt,
    table: {
      caption: T.stripTable,
      columns: [
        { label: "From τ", value: "from", format: (v) => tickText(v), header: false },
        { label: "To τ", value: "to", format: (v) => tickText(v) },
        { label: "Best report", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v) },
        { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v) },
      ],
      rows: segs,
    },
    width,
    height: S.height + extraHeight, marginTop: S.marginTop, marginBottom: S.marginBottom + extraHeight,
    marginLeft: S.marginLeft, marginRight: S.marginRight,
    // the axis draws the tick lines; the labels are text marks so that a crowded one can take a second line
    x: { domain: [lo, hi], ticks: ticks.map((d) => d.t), tickFormat: () => "", label: null },
    y: { domain: [0, 1], axis: null },
    color: { type: "identity" },
    marks: (c, P) => [
      ...lastByRow.map((_, row) => tickLabels(c, row + 1)),
      P.rect(segs, { x1: "from", x2: "to", y1: 0, y2: S.band, fill: (d, i) => fills(c)[i % 2], stroke: c.cellBorder }),
      numText(segs, { x: (d) => (d.from + d.to) / 2, y: S.band / 2, value: "N", format: (v) => formatCount(v), fill: c.plotFg }),
      P.ruleX(changes, { x: "tau", y1: 0, y2: S.band, stroke: c.plotAxis, strokeWidth: 2 }),
      P.ruleX([state.tau], { y1: 0, y2: 1, stroke: c.plotFg, strokeWidth: S.marker }),
      P.dot([state.tau], { x: (d) => d, y: 1, symbol: "triangle", r: 4, fill: c.plotFg, rotate: S.rotate }),
      // the τ mark's letter sits on the side with room (right of the marker in the left half, left of it in the right half)
      P.text([state.tau], { x: (d) => d, y: 1, text: () => "τ", dx: state.tau > (lo + hi) / 2 ? -S.tauDx : S.tauDx, textAnchor: state.tau > (lo + hi) / 2 ? "end" : "start", fill: c.plotFg }),
    ],
    keyboard: {
      data: changes.length ? changes : [{ tau: (lo + hi) / 2, none: true, grade: segs[0]?.grade }],
      x: "tau", y: () => S.band / 2, sort: false,
      label: T.stripHeading,
      title: (d) => (d.none
        ? `${T.stripNone} Best report ${formatGrades(Array.from(d.grade ?? []))}.`
        : `τ = ${formatProb(d.tau)}: the best report changes from ${formatGrades(Array.from(d.from))} to ${formatGrades(Array.from(d.to))}; it now also states ${d.newly.join(", ")}.`),
    },
  });
  stripNote.replaceChildren(changes.length ? T.stripNote : T.stripNone);
}

/** Draw linked risk bars; rows contain { label, err, wh, risk }, and state contains tau. */
export function drawRiskBars(ctx, barsSlot, state, rows) {
  const T = CONFIG.text;
  const B = CONFIG.bars;
  const segs = rows.flatMap((r) => [
    { label: r.label, part: "err", x1: 0, x2: r.err, value: r.err },
    { label: r.label, part: "wh", x1: r.err, x2: r.err + r.wh, value: r.wh },
  ]).filter((s) => s.x2 > s.x1);
  // the axis runs from 0 to the largest risk shown, and at least to τ (a fixed report can cost more than
  // the all-withheld report); the dashed line marks τ
  const top = Math.max(state.tau, ...rows.map((r) => r.risk));
  const inner = Math.max(1, (barsSlot.clientWidth || ctx.width()) - B.marginLeft - B.marginRight);
  const roomy = segs.filter((s) => ((s.x2 - s.x1) / top) * inner >= B.minLabelPx);
  plot(barsSlot, {
    alt: T.barsAlt,
    table: {
      caption: T.barsTable,
      columns: [
        { label: "Report", value: "label" },
        { label: "E/M", value: "err", format: (v) => formatShare(v) },
        { label: "τ(M − N)/M", value: "wh", format: (v) => formatRisk(v) },
        { label: "Risk", value: "risk", format: (v) => formatRisk(v) },
      ],
      rows,
    },
    height: B.marginTop + B.marginBottom + rows.length * B.row,
    marginTop: B.marginTop, marginBottom: B.marginBottom, marginLeft: B.marginLeft, marginRight: B.marginRight,
    x: { domain: [0, top], ticks: [0, state.tau], tickFormat: (d) => formatSetting(d), label: "expected loss per pair (risk)", labelAnchor: "center", labelArrow: "none", labelOffset: B.labelOffset },
    y: { domain: rows.map((r) => r.label), label: null, padding: B.padding, tickSize: 0 },
    color: { type: "identity" },
    marks: (c, P) => [
      P.barX(segs, { x1: "x1", x2: "x2", y: "label", fill: (d) => (d.part === "err" ? c.err : c.wh) }),
      numText(roomy.filter(d => d.part === "err"), { render: (index, scales, values, dims, context, next) => { const g = next(index, scales, values, dims, context); g.setAttribute("data-prx-risk-part", "err"); return g; }, x: (d) => (d.x1 + d.x2) / 2, y: "label", value: "value", format: (v) => formatShare(v), fill: labelOn(c.err, c) }),
      numText(roomy.filter(d => d.part === "wh"), { render: (index, scales, values, dims, context, next) => { const g = next(index, scales, values, dims, context); g.setAttribute("data-prx-risk-part", "wh"); return g; }, x: (d) => (d.x1 + d.x2) / 2, y: "label", value: "value", format: (v) => formatRisk(v), fill: labelOn(c.wh, c) }),
      P.ruleX([state.tau], { stroke: c.plotAxis, strokeDasharray: B.rule }),
      numText(rows, { x: "risk", y: "label", value: "risk", format: (v) => formatRisk(v), dx: 4, textAnchor: "start", fill: c.plotFg }),
    ],
    keyboard: { data: rows, x: "risk", y: "label", sort: false, label: T.barsTable,
      title: (d) => `${d.label}: expected wrong directions per pair ${formatShare(d.err)}; withholding cost per pair ${formatRisk(d.wh)}; risk ${formatRisk(d.risk)}.` },
  });
}


// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-pos",
    css: CSS,
    keys: {
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      cap: { type: "custom", value: CONFIG.cap.value, parse: parseCap },
      stage: { type: "integer", min: 1, max: 3, step: 1, value: 3 },
      yours: { type: "custom", value: null, parse: parseYourReport },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;
      const hatchId = uid("prx-pos-hatch");
      const paths = new Map();
      const pathOf = (cap) => {
        if (!paths.has(cap)) paths.set(cap, tauPath(ERRORS, { family: familyOf(cap) }));
        return paths.get(cap);
      };
      const sizes = new Map([CONFIG.cap.capped, CONFIG.cap.none].map((c) => [c, familySize(N_UNITS, familyOf(c))]));

      // helpers: a read-out number with its hook, a family's words with their digits as data-num
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const wordsNodes = (words) => String(words).split(/(\d+)/).map((part, k) => (k % 2 ? ctx.num(Number(part), formatCount(Number(part))) : part)).filter((x) => x !== "");
      // blocks shown with braces; screen readers get the words form ("A and B, then C and D, then E and F")
      const blocksNodes = (grade) => [
        h("span", { "aria-hidden": "true", text: blocksText(grade) }),
        h("span", { class: "prx-sr-only", text: blocksWords(grade) }),
      ];

      // --- controls: τ
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderHint.join(""), onInput: (v) => ctx.set({ tau: v }),
      });
      tau.root.querySelector(".prx-hint")?.replaceChildren(...T.sliderHint.map((p) => (p === "{one}" ? ctx.num(1, formatCount(1)) : p)));
      ctx.controls.append(tau.root);

      // --- change points (after the matrix and the risk split)
      const stripSlot = h("div", { class: "prx-pos-strip-chart" });
      const stripNote = h("p", { class: "prx-pos-note", "data-prx-part": "notes" });
      const stripBox = h("section", { class: "prx-pos-strip", "aria-label": T.stripHeading, "data-prx-part": "chart" },
        h("h4", { class: "prx-pos-heading", text: T.stripHeading }), stripSlot, stripNote);

      // --- result headline: the live read-out, then the label with the family named in words and its size
      const labelLine = h("p", { class: "prx-pos-label", "data-prx-part": "readout" });

      // --- staged matrix
      const stages = ctx.radioGroup({
        legend: T.stagesLegend, name: "stage", className: "prx-pos-stages",
        options: CONFIG.stages.map((s) => ({ value: s.value, label: `Step ${s.value}: ${s.label}` })),
        value: ctx.state.stage, onChange: (v) => ctx.set({ stage: v }),
      });
      ctx.part("controls", stages.root);
      const stageHintId = uid("prx-pos-stage-hint");
      const stageHint = h("p", { id: stageHintId, class: "prx-hint prx-pos-stage-hint", "data-prx-part": "notes" });
      const matrixSlot = h("div", { class: "prx-pos-matrix-chart" });
      const matrixLegend = h("div", { class: "prx-pos-legend", "data-prx-part": "legend" });
      const matrixCounts = h("div", { class: "prx-pos-counts", "data-prx-part": "readout" });
      const matrixBox = h("section", { class: "prx-pos-matrix", "aria-label": T.stagesLegend },
        stages.root, stageHint, matrixSlot, matrixLegend, matrixCounts);

      // --- risk split
      const formulaBox = h("div", { class: "prx-pos-formula", "data-prx-part": "readout", "data-prx-tex": "risk" });
      const barsSlot = h("div", { class: "prx-pos-bars-chart" });
      const barsLegend = h("div", { class: "prx-pos-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch", style: { background: "var(--prx-err)" } }), T.errLegend),
        h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch", style: { background: "var(--prx-wh)" } }), T.whLegend));
      const barsNote = h("p", { class: "prx-pos-note", "data-prx-part": "caption" }, `${T.axisNote} `, captionNode(ctx, "tau-not-compared"), ".");
      const tiles = h("div", { class: "prx-pos-tiles", "data-prx-part": "readout" });
      const reference = h("p", { class: "prx-pos-reference", "data-prx-part": "readout" });
      const yoursLine = h("p", { class: "prx-pos-yours", "data-prx-part": "readout", hidden: true });
      const riskBox = h("section", { class: "prx-pos-risk", "aria-label": T.riskHeading },
        h("h4", { class: "prx-pos-heading", text: T.riskHeading }), h("p", { class: "prx-pos-note" }, "E is the expected number of wrong directions; M counts all unordered pairs; N counts stated pairs. Pairs inside one grade are withheld."), formulaBox, barsSlot, barsLegend, barsNote, tiles, reference, yoursLine);

      // order inside the widget: slider, the live read-out and the label, then matrix and risk side by side, then
      // the change points, then the second stage
      const grid = h("div", { class: "prx-pos-grid" }, matrixBox, riskBox);
      ctx.controls.after(ctx.readout.node);
      ctx.readout.node.after(labelLine);
      ctx.charts.append(grid, stripBox);

      // --- second stage: the cap switch with the family badges
      const badge = (cap) => {
        const words = cap === CONFIG.cap.none ? [T.noCap] : [`${T.capWords} `, ctx.num(cap, formatSetting(cap)), ` ${T.capGrades}`];
        // Families are named in words with their sizes; the family symbols arrive on G-04.
        return h("span", { class: "prx-pos-badge" }, ...words, " · ",
          ctx.num(sizes.get(cap), formatCount(sizes.get(cap))), ` ${T.reports}`);
      };
      const capSwitch = ctx.radioGroup({
        legend: T.familyLegend, name: "cap", className: "prx-pos-family",
        options: [CONFIG.cap.capped, CONFIG.cap.none].map((c) => ({ value: c, label: badge(c) })),
        value: ctx.state.cap, onChange: (v) => ctx.set({ cap: v }),
      });
      const summary = h("p", { class: "prx-pos-family-heading" });
      const drawSummary = (cap) => {
        const shown = (c) => (c === cap ? [` ${T.stage2Shown}`] : []);
        summary.replaceChildren(`${T.stage2} ${T.capWords.toLowerCase()} `, ctx.num(CONFIG.cap.capped, formatSetting(CONFIG.cap.capped)), ` ${T.capGrades}`,
          ...shown(CONFIG.cap.capped), ` ${T.stage2Or} ${T.stage2NoCap}`, ...shown(CONFIG.cap.none));
      };
      drawSummary(ctx.state.cap);
      const details = h("section", { class: "prx-pos-stage2", "data-prx-part": "controls", "aria-label": T.familyLegend },
        summary, h("p", { class: "prx-hint", text: T.stage2Hint }), capSwitch.root);
      ctx.charts.after(details);
      ctx.caption.textContent = T.note;

      // Every entered report is scored as a fixed report at the current withholding cost.
      const yourId = uid("prx-pos-your-report");
      const yourInput = h("input", { id: yourId, type: "text", name: "yours", autocomplete: "off",
        placeholder: "A, B, C, D, E, F: grade labels", "aria-describedby": `${yourId}-hint` });
      const yourHint = h("p", { id: `${yourId}-hint`, class: "prx-hint",
        text: "Enter one integer grade for each site, A through F, separated by commas. Smaller labels have higher priority; labels are renumbered without changing the report." });
      function applyYours() {
        const value = parseYourReport(yourInput.value);
        yourInput.setCustomValidity(value === undefined ? "Enter six integer grade labels, or leave the field blank." : "");
        if (value === undefined) { yourInput.reportValidity(); return; }
        ctx.set({ yours: value });
      }
      ctx.listen(yourInput, "change", applyYours);
      ctx.listen(yourInput, "keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyYours(); } });
      const quick = ctx.select({ label: "Quick report", name: "quick-report",
        options: [{ value: "none", label: "Choose a report" }, ...CONFIG.choices.map((c) => ({ value: c.value, label: c.label }))],
        value: "none", onChange: (v) => ctx.set({ yours: v === "none" ? null : Array.from(CONFIG.choices.find((c) => c.value === v).grade) }) });
      const yourBox = h("section", { class: "prx-pos-entry", "aria-label": "Your report" }, ctx.panelTitle("Score your report"),
        quick.root, h("label", { for: yourId, text: "Grade labels in site order" }), yourInput,
        ctx.button({ label: "Score report", onClick: applyYours }).root, yourHint);
      details.after(yourBox);
      ctx.scrollRegion(formulaBox, "Risk decomposition formula");

      // --------------------------------------------------------------------------------------- drawing


      function drawMatrix(state, opt, st) {
        const rel = st === N_STAGES ? relations(Array.from(opt.grade)) : null;
        const avail = matrixSlot.clientWidth || Math.min(ctx.width(), CONFIG.matrix.maxCell * N_UNITS + CONFIG.matrix.marginLeft + CONFIG.matrix.marginRight);
        const Mx = CONFIG.matrix;
        const cell = Math.max(Mx.minCell, Math.min(Mx.maxCell, Math.floor((avail - Mx.marginLeft - Mx.marginRight) / N_UNITS)));
        const width = Mx.marginLeft + Mx.marginRight + N_UNITS * cell;
        const height = Mx.marginTop + Mx.marginBottom + N_UNITS * cell;
        matrixSlot.style.maxWidth = `${width}px`;
        const cells = [];
        const diag = [];
        for (let i = 0; i < N_UNITS; i += 1) {
          for (let j = 0; j < N_UNITS; j += 1) {
            if (i === j) { diag.push({ i, row: IDS[i], col: IDS[j], grade: opt.grade[i] }); continue; }
            cells.push({ i, j, row: IDS[i], col: IDS[j], e: E0[i][j], below: E0[i][j] < state.tau, rel: rel ? rel[i][j] : null });
          }
        }
        // every cell in row order (diagonal included) for the keyboard grid
        const everyCell = [];
        for (let i = 0, k = 0; i < N_UNITS; i += 1) {
          for (let j = 0; j < N_UNITS; j += 1) everyCell.push(i === j ? { ...diag[i], diagonal: true } : cells[k++]);
        }
        const G = Math.max(...opt.grade);
        const pairs = pairRows(state.tau, rel);
        const statement = (d) => `stating ${d.row} above ${d.col} is wrong with probability ${formatProb(d.e)}`;
        const relWords = (d) => {
          if (d.rel === 1) return `the best report states ${d.row} above ${d.col}`;
          if (d.rel === -1) return `the best report states ${d.col} above ${d.row}`;
          return `the best report withholds this pair (${d.row} and ${d.col} share grade ${opt.grade[d.i]})`;
        };
        const columns = [
          { label: "Statement", value: (r) => `${IDS[r.a]} above ${IDS[r.b]}` },
          { label: "Error probability", value: "e", format: (v) => formatProb(v) },
        ];
        if (st >= 2) columns.push({ label: "Below τ", value: (r) => (r.below ? "yes" : "no") });
        if (st === N_STAGES) columns.push({ label: "Best report", value: (r) => (r.statedUp ? "stated" : r.stated ? "reversed" : "withheld") });
        plot(matrixSlot, {
          alt: T.matrixAlt,
          table: { caption: T.matrixTable, columns, rows: pairs },
          width, height,
          marginTop: Mx.marginTop, marginLeft: Mx.marginLeft, marginRight: Mx.marginRight, marginBottom: Mx.marginBottom,
          x: { domain: IDS, padding: 0, axis: "top", label: null, tickSize: 0 },
          y: { domain: IDS, padding: 0, label: null, tickSize: 0 },
          color: { type: "identity" },
          marks: (c, P) => {
            const fillOf = (d) => (st === N_STAGES
              ? (d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld)
              : c.purples[purpleStep(d.e) - 1]);
            const filled = cells.map((d) => ({ ...d, fill: fillOf(d), ink: labelOn(fillOf(d), c) }));
            const withheld = filled.filter((d) => d.rel === 0);
            const grades = gradeColors(G, c);
            const dots = diag.map((d) => ({ ...d, fill: grades[d.grade - 1], ink: labelOn(grades[d.grade - 1], c) }));
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({ id: hatchId, patternUnits: "userSpaceOnUse", width: Mx.hatchSpacing, height: Mx.hatchSpacing, patternTransform: "rotate(45)" })) pat.setAttribute(k, String(v));
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: Mx.hatchSpacing, stroke: c.hatch, "stroke-width": Mx.hatchWidth })) line.setAttribute(k, String(v));
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            return [
              P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, inset: Mx.inset }),
              P.cell(filled, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: Mx.inset }),
              st === N_STAGES ? hatch : null,
              st === N_STAGES ? P.cell(withheld, { x: "col", y: "row", fill: `url(#${hatchId})`, inset: Mx.inset }) : null,
              // below-τ outlines; in the third view a stated (relation-colored) cell gets a thinner one, so the hatched
              // cells inside a grade keep the strong outline
              st >= 2 ? P.cell(filled.filter((d) => d.below && !(st === N_STAGES && d.rel !== 0)), { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: Mx.outline, inset: Mx.outlineInset }) : null,
              st === N_STAGES ? P.cell(filled.filter((d) => d.below && d.rel !== 0), { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: Mx.outlineThin, inset: Mx.outlineInset }) : null,
              numText(filled, { x: "col", y: "row", value: "e", format: (v) => formatProb(v, { bounds: "symbols" }), fill: "ink", stroke: "fill", strokeWidth: Mx.labelHalo, paintOrder: "stroke" }),
              st === N_STAGES ? P.dot(dots, { x: "col", y: "row", r: cell * Mx.dotShare, fill: "fill", stroke: c.plotBg }) : null,
              st === N_STAGES ? numText(dots, { x: "col", y: "row", value: "grade", format: (v) => formatCount(v), fill: "ink" }) : null,
            ];
          },
          keyboard: {
            data: everyCell, x: "col", y: "row", key: (d) => `${d.row}${d.col}`, sort: false, columns: Mx.columns,
            label: T.matrixAlt,
            title: (d) => {
              if (d.diagonal) {
                return st === N_STAGES ? `Row ${d.row}, column ${d.col}: the same site, in grade ${d.grade} of the best report.` : `Row ${d.row}, column ${d.col}: the same site.`;
              }
              let s = `Row ${d.row}, column ${d.col}: ${statement(d)}.`;
              if (st >= 2) s += d.below ? ` That is below τ = ${formatSetting(state.tau)}.` : ` That is not below τ = ${formatSetting(state.tau)}.`;
              if (st === N_STAGES) s += ` In grades: ${relWords(d)}.`;
              return s;
            },
          },
        });
        return pairs;
      }

      function drawMatrixLegend(state, st) {
        const items = [];
        if (st < N_STAGES) {
          const cuts = CONFIG.purpleCuts;
          const range = (k) => {
            if (k === 0) return [`${T.belowWord} `, ctx.num(cuts[0], formatSetting(cuts[0]))];
            if (k === cuts.length) return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), ` ${T.andAbove}`];
            return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), "–", ctx.num(cuts[k], formatSetting(cuts[k]))];
          };
          items.push(h("span", { class: "prx-pos-legend-title", text: T.purplesTitle }));
          for (let k = 0; k <= cuts.length; k += 1) {
            items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch", style: { background: `var(--prx-purples-${k + 1})` } }), h("span", {}, ...range(k))));
          }
        } else {
          items.push(h("span", { class: "prx-pos-legend-title", text: T.relationTitle }));
          items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch", style: { background: "var(--prx-rel-above)" } }), T.relAbove));
          items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch prx-pos-swatch-hatch" }), T.relWithheld));
          items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch", style: { background: "var(--prx-rel-below)" } }), T.relBelow));
          items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch prx-pos-swatch-dot" }), T.gradeLegend));
        }
        if (st >= 2) {
          // one text span beside the swatch, so the words wrap as a sentence (the key is a flex row)
          items.push(h("span", { class: "prx-pos-key" }, h("span", { class: "prx-pos-swatch prx-pos-swatch-outline" }),
            h("span", {}, `${T.outlineLegend} = `, ctx.num(state.tau, formatSetting(state.tau)), st === N_STAGES ? `; ${T.outlineThin}` : "")));
        }
        if (st === N_STAGES) items.push(h("span", { class: "prx-pos-legend-note", text: T.numbersStill }));
        matrixLegend.replaceChildren(...items);
      }

      function drawCounts(state, pairs, st, grade) {
        const confidence = confidentPairs(grade, ERRORS, { tau: state.tau });
        const below = pairs.filter((p) => p.below);
        const lines = [];
        if (st >= 2) {
          lines.push(h("p", {}, `${T.belowCount} `, ro("belowCount", confidence.count, formatCount(confidence.count)),
            " of ", ctx.num(M, formatCount(M)), "."));
        }
        if (st === N_STAGES) {
          const kept = below.filter((p) => !p.stated);
          const overCount = pairs.filter((p) => p.stated && p.statedError >= state.tau).length;
          const names = kept.map((p) => `${IDS[p.a]} and ${IDS[p.b]}`).join("; ");
          lines.push(h("p", {}, `${T.belowWithheld} `, ro("belowWithheld", confidence.withheld, formatCount(confidence.withheld)),
            kept.length ? ` (${names})` : "", "."));
          lines.push(h("p", {}, `${T.statedOver} `, ro("statedOver", overCount, formatCount(overCount)), ` ${T.statedOverNote}.`));
        }
        matrixCounts.replaceChildren(...lines);
        matrixCounts.hidden = lines.length === 0;
      }

      function drawRisk(state, opt, allW, yours) {
        const ev = opt.evaluation;
        const fmtTau = formatSetting(state.tau);
        // one formula, numbers made in formula order (formulaNums tags the <mtext> nodes in that order): the symbols,
        // then E, M, τ, M, N, M, then the two terms and the risk; "=\;" keeps the space before a line that starts with
        // a number (math.js)
        const f = formulaNums();
        const m = () => f.num(M, formatCount(M));
        const numbers = `\\class{prx-err}{\\frac{${f.num(ev.Ew, formatExpectedCount(ev.Ew))}}{${m()}}} + \\class{prx-wh}{\\frac{${f.num(state.tau, fmtTau)}\\times(${m()}-${f.num(ev.N, formatCount(ev.N))})}{${m()}}}`;
        const terms = `\\class{prx-err}{${f.num(ev.errorTerm, formatShare(ev.errorTerm))}} + \\class{prx-wh}{${f.num(ev.withholdingTerm, formatRisk(ev.withholdingTerm))}} = ${f.num(ev.risk, formatRisk(ev.risk))}`;
        const tex = "\\begin{aligned}R_\\tau(g) &= \\class{prx-err}{\\frac{E}{M}} + \\class{prx-wh}{\\frac{\\tau\\,(M-N)}{M}} \\\\ "
          + `&=\\; ${numbers} \\\\ &=\\; ${terms}\\end{aligned}`;
        renderTex(formulaBox, tex, { display: true, nums: f.raws });

        const rows = [
          { key: "best", label: T.best, err: ev.errorTerm, wh: ev.withholdingTerm, risk: ev.risk },
          { key: "withheld", label: T.allWithheld, err: allW.errorTerm, wh: allW.withholdingTerm, risk: allW.risk },
        ];
        if (yours) rows.push({ key: "yours", label: T.yours, err: yours.errorTerm, wh: yours.withholdingTerm, risk: yours.risk });
        drawRiskBars(ctx, barsSlot, state, rows);

        tiles.replaceChildren(
          tile("Pairs stated, N", [ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", M, formatCount(M))]),
          tile("Share stated, N/M", [ro("s", ev.s, formatShare(ev.s))]),
          tile("Expected wrong directions, E", [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile("Expected loss per pair (risk)", [ro("risk", ev.risk, formatRisk(ev.risk))]),
        );
        reference.replaceChildren(`All withheld (every site in one grade): risk `, ro("allWithheld", allW.risk, formatRisk(allW.risk)),
          " (", captionNode(ctx, "fixed-report"), "), which equals τ = ", ro("tau", state.tau, fmtTau), ".");
      }

      function tile(name, value) {
        return h("div", { class: "prx-pos-tile" }, h("span", { class: "prx-pos-tile-name", text: name }), h("span", { class: "prx-pos-tile-value" }, ...value));
      }

      function drawHeadline(state, opt) {
        const fam = opt.family;
        ctx.readout.set([
          "τ = ", ctx.num(state.tau, formatSetting(state.tau)), ", ", ...wordsNodes(fam.words), ": the best report is ",
          ...blocksNodes(opt.grade), `, ${T.riskWords} `, ctx.num(opt.risk, formatRisk(opt.risk)), ".",
        ]);
        const parts = [
          // The family symbols are introduced on G-04, so the label names the family in words.
          tagNode(ctx, opt), ". Best report ",
          ro("grades", Array.from(opt.grade), formatGrades(Array.from(opt.grade))), `. ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`,
        ];
        if (opt.tieCount > 1) {
          const listed = opt.grades.map((g) => ctx.num(Array.from(g), formatGrades(Array.from(g))));
          parts.push(" ", ro("tieCount", opt.tieCount, formatCount(opt.tieCount)), " reports share the smallest risk at this τ (",
            ...listed.flatMap((n, k) => (k ? [", ", n] : [n])), "); the read-outs show the first.");
        }
        labelLine.replaceChildren(...parts);

      }

      function drawYours(state, opt, yours) {
        if (!yours) { yoursLine.hidden = true; return; }
        const inFamily = state.cap === CONFIG.cap.none || Math.max(...state.yours) <= state.cap;
        const same = Math.abs(yours.risk - opt.risk) <= opt.tieTol;
        const comparison = inFamily && same ? [", the smallest risk in this family."]
          : inFamily ? [", above the best report's ", ctx.num(opt.risk, formatRisk(opt.risk)), "."]
          : ["; not in this family. The best report in the selected family has risk ", ctx.num(opt.risk, formatRisk(opt.risk)), "."];
        yoursLine.replaceChildren(`${T.yours}, ${blocksText(state.yours)}: risk `, ro("yoursRisk", yours.risk, formatRisk(yours.risk)),
          " (", captionNode(ctx, "fixed-report"), ")", ...comparison,
          " Your report states ", ro("yoursN", yours.N, formatCount(yours.N)), " of ", ctx.num(M, formatCount(M)),
          " pairs; the best report states ", ro("comparisonBestN", opt.N, formatCount(opt.N)), " of ", ctx.num(M, formatCount(M)), ".",
          ...(yours.N !== opt.N ? [" ", captionNode(ctx, "different-disclosure"), "."] : []));
        yoursLine.hidden = false;
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            tau.set(state.tau);
            capSwitch.set(state.cap);
            drawSummary(state.cap);
            stages.set(state.stage);
            stageHint.textContent = T.stageHints[state.stage - 1];
            yourInput.value = state.yours ? Array.from(state.yours).join(",") : "";
            yourInput.setCustomValidity("");
            const match = CONFIG.choices.find((c) => state.yours && c.grade.every((g, i) => g === state.yours[i]));
            quick.set(match?.value ?? "none");
            const opt = exactOptimum(ERRORS, { tau: state.tau, family: familyOf(state.cap) });
            const allW = evaluateReport(ALL_WITHHELD, ERRORS, { tau: state.tau });
            const yours = state.yours ? evaluateReport(state.yours, ERRORS, { tau: state.tau }) : null;

            drawHeadline(state, opt);
            drawTauStrip(ctx, { slot: stripSlot, note: stripNote }, state, pathOf(state.cap));
            const pairs = drawMatrix(state, opt, state.stage);
            drawMatrixLegend(state, state.stage);
            drawCounts(state, pairs, state.stage, opt.grade);
            drawRisk(state, opt, allW, yours);
            drawYours(state, opt, yours);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
