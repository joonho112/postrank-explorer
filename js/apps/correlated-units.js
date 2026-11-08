// correlated-units (app 1.9): "When two posteriors move together". Two normal posteriors whose true values may be
// correlated: the posterior of the pair (θ_A, θ_B) as an ellipse with the region θ_A > θ_B shaded, each unit's own
// posterior, and the posterior of the difference θ_A − θ_B with the chosen correlation beside the independent one.
// Correlation leaves both posteriors and the mean of the difference as they are and changes only the SD of the
// difference, SD_{A−B}² = SD_A² + SD_B² − 2·corr·SD_A·SD_B, so π_AB = Φ((mean_A − mean_B)/SD_{A−B}) moves toward or
// away from one half but never past it, while the pair's posterior is normal.
// Starting point: postrank Explorer v1 L-07 (js/widgets/two-units.js), its Deeper box "Correlated posteriors" as the
// main view, with the four unit sliders it read. New here: the posterior of the pair as an ellipse, each unit's
// posterior beside it, and a second way to set the posterior, from a stated model in which a shared, uncertain prior
// mean makes the two posteriors move together.
//
// One state drives every part, all redrawn on every render. The app uses the shared result-first frame (base.js layout
// "result-first"; review 044 repair, X-01), top to bottom:
//   controls  "Posterior": set by hand or from a shared prior mean; then the preset row (before the fieldsets that
//             depend on the choice, base.js afterPresets, so the row stays put when a preset switches between the two:
//             review 044, X-18's placement); then those fieldsets: by hand, the two unit fieldsets of 1.8 and the
//             correlation slider (|corr| ≤ .95; the primary control, base.js primaryControl), or from a shared prior
//             mean, each unit's estimate and SE, the prior SD and the SD of the prior mean
//   read-out  directly under the controls: π_AB with the correlation and the independent π_AB, and the side of one half
//             the means fix
//   pair      the ellipse that marks where .90 of the posterior of (θ_A, θ_B) lies, with the chosen correlation (solid)
//             and for independent posteriors (dotted; from a shared prior mean, the same two posteriors taken as
//             independent), the line θ_A = θ_B and the region below it shaded: its posterior probability is π_AB
//             (engine pairDifference with { corr }); its title carries π_AB and the independent π_AB (review 044, X-01:
//             the answer next to the mark the correlation turns; ctx.primaryGraphic marks this figure)
//   diff      the posterior of A − B with the chosen correlation (dash-dot, the area above 0 shaded) and for
//             independent posteriors (dotted), as in v1's box; the result line under it
//   units     each unit's posterior (1.8's upper figure: A solid, B dashed); correlation does not change it
//   key       one key that names the line styles of the pair and the difference (solid ellipse and dash-dot difference
//             with the correlation, dotted without) and the + of the posterior means
//   formula   under the figures, always shown: with a shared prior mean, the correlation it gives; the general formula
//             with corr; the formula at these settings
// The figures follow the result-first order (the panels the correlation changes first): in a wide container the pair
// with the key under it on the left, the difference above each unit's posterior on the right; in a narrow one pair,
// difference, units, key, in DOM order (so focus follows what is seen at every width).
//
// The shared prior mean (closed form, exact; engine sharedMeanPosterior): estimate y_i ~ N(θ_i, SE_i²); given the
// prior mean μ, θ_i ~ N(μ, prior SD²), independently; μ ~ N(0, SD_μ²). Given μ, each posterior is normal and keeps the
// share k_i = prior SD²/(prior SD² + SE_i²) of its own estimate (the share kept, as in app 1.7), and the two are
// independent; given both estimates, μ is normal with mean μ̂ and variance v. Over μ: mean_i = (1 − k_i)μ̂ + k_i y_i,
// SD_i² = (1 − k_i)²v + k_i SE_i² and Cov = (1 − k_A)(1 − k_B)v, so the posteriors move together; with equal SEs the
// shared part cancels from A − B. With the prior mean known (SD 0, v = 0) nothing is shared: the posteriors are
// independent (engine normalPosterior around the known prior mean, the limit of the model; sharedMeanPosterior takes an
// uncertain one), and the app says so.
// π of jointly normal posteriors lies strictly inside (0, 1): a double of 0 or 1 reads "below .001" or "above .999"
// (1.8's probText).
//
// Keys: muA, muB (−2 to 2), sdA, sdB (.05 to 1) and corr (−.95 to .95): the posterior set by hand; source (hand |
// shared); yA, yB (−2 to 2), seA, seB (.05 to 1), priorSd (.05 to 1) and meanSd (0 to 1): the shared-prior-mean
// model. Numbers, clamped to the slider ends and not snapped.
//
// Imports from 1.8 two-units (CONFIG, CSS, the unit keys and fieldsets, the density grid, the upper figure's marks,
// the difference's marks and label rule, the formula pieces, probText); exports CONFIG, CSS, sharedMean, pairOf,
// ellipse and ellipseBand.
import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { formatDecimal, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { normalPdf, normalPosterior, pairDifference, sharedMeanPosterior } from "../pr-core.js";
import {
  CONFIG as TWO, CSS as TWO_CSS, densityPoints, diffLabel, diffMarks, paddedDomain, piName, plotWidth, probTex, probText,
  topMarks, unitControls, unitKeys,
} from "./two-units.js";

export const CONFIG = Object.freeze({
  name: "correlated-units",
  label: "When two posteriors move together: the posterior of the pair and the probability that A's true value is larger",
  className: "prx-two-units cu",
  // the correlation of the two posteriors; it stops at ±.95 so that the difference always has a positive SD. The
  // default, .50, is the first preset, so the app opens on two posteriors that move together (0 is the preset
  // Independent)
  corr: Object.freeze({ min: -0.95, max: 0.95, step: 0.05, value: 0.5 }),
  source: Object.freeze({ values: Object.freeze(["hand", "shared"]), value: "hand" }),
  // the shared-prior-mean model; its defaults are the preset "Shared prior mean"
  model: Object.freeze({
    estimate: Object.freeze({ min: -2, max: 2, step: 0.01 }),
    se: Object.freeze({ min: 0.05, max: 1, step: 0.01 }),
    setting: Object.freeze({ yA: 0.3, seA: 0.2, yB: 0.1, seB: 0.2 }),
    priorSd: Object.freeze({ min: 0.05, max: 1, step: 0.01, value: 0.1 }),
    meanSd: Object.freeze({ min: 0, max: 1, step: 0.01, value: 0.5 }),
    // the center of the prior mean's own normal prior
    center: 0,
  }),
  // the ellipse of the pair holds this share of its posterior (radius √(−2 ln(1 − level)) in SDs, the bivariate
  // normal's exact region); `points` samples per ellipse
  level: 0.9,
  ellipse: Object.freeze({ points: 181 }),
  digits: Object.freeze({ gap: 2, sd: 3, z: 3, computed: 3, shrink: 3, variance: 4 }),
  chart: Object.freeze({
    heightDiff: 170, marginTop: 24, marginBottom: 36, marginLeft: 44, marginRight: 20, yTicks: 3,
    line: 2, thin: 1.5, dot: "2,3", halo: 3, labelDy: -9,
    // the wider of two difference curves is labeled on its right shoulder, `shoulder` SDs from the mean
    shoulder: 1.5, shoulderDx: 6,
    // the square figure of the pair: margins, the corners where the two regions are named (share of the span from
    // the corner), the center mark and keyboard points
    // (labelBox: the size in px of a region label, "π_AB" at the site's font, and the room kept around it)
    pair: Object.freeze({
      marginTop: 26, marginBottom: 38, marginLeft: 44, marginRight: 16, corner: 0.06, cross: 7, kbInset: 0.16, ticks: 6, wash: 0.16,
      reach: 3.5, steps: 10, labelBox: Object.freeze({ width: 30, height: 20, margin: 4 }),
    }),
    // keyboard point of the shaded area of the difference figure: this share of the x span right of 0
    areaDx: 0.06,
  }),
  text: Object.freeze({
    sourceLabel: "Posterior",
    sourceHand: "Set by hand",
    sourceShared: "From a shared prior mean",
    pairLegend: "The pair (A, B)",
    corrLabel: "Correlation corr",
    corrName: "Correlation between the two posteriors",
    corrHintA: "The slider stops at ±",
    corrHintB: ": at a correlation of one with equal SDs, the difference would have no spread at all.",
    estimate: "Estimate",
    se: "Standard error",
    estimateName: "Estimate of unit ",
    seNameA: "Standard error of unit ",
    seNameB: "'s estimate",
    priorLegend: "The prior they share",
    priorSd: "Prior SD",
    priorSdName: "Prior SD: the spread of the true values around the prior mean",
    priorSdHint: "spread of the true values around the prior mean",
    meanSd: "SD of the prior mean",
    meanSdName: "SD of the prior mean: how uncertain it is before the data",
    meanSdHintA: "how uncertain the prior mean is (",
    meanSdHintB: ": known, and the two posteriors are independent)",
    // panel titles
    pairTitle: "The posterior of the pair (A, B)",
    unitsTitle: "Each unit's posterior",
    diffTitle: "The difference A minus B",
    // the figure of the pair
    xPair: "True value of A",
    yPair: "True value of B",
    // the key names the line styles of both the pair and the difference: with the correlation the ellipse is solid and
    // the difference dash-dot; without it both are dotted
    keyCorr: Object.freeze({ hand: "with the chosen correlation", shared: "with the shared prior mean's correlation" }),
    keyCorrParts: " (ellipse; difference)",
    keyIndep: Object.freeze({ hand: "independent (both figures)", shared: "taken as independent (both figures)" }),
    keyLine: "the two true values equal",
    keyMeans: "the posterior means",
    keyRegionA: "A's true value larger: its posterior probability is ",
    keyLevelA: "Each ellipse only marks where ",
    keyLevelB: " of its posterior lies. The line itself has probability zero (the difference is normal with positive SD), so ",
    keyLevelC: " = ",
    keyLevelD: " − ",
    keyLevelE: ".",
    altPair: Object.freeze({
      hand: "The posterior of the pair of true values, A across and B up: the ellipse that marks where nine tenths of it lie, with the chosen correlation (solid line) and with independent posteriors (dotted line). The region below the line where the two are equal is shaded: there A's true value is larger, and the posterior probability of that region is the probability that A is above B.",
      shared: "The posterior of the pair of true values, A across and B up: the ellipse that marks where nine tenths of it lie, with the correlation the shared prior mean gives (solid line) and with the same two posteriors taken as independent (dotted line). The region below the line where the two are equal is shaded: there A's true value is larger, and the posterior probability of that region is the probability that A is above B.",
      zero: "The posterior of the pair of true values, A across and B up: the ellipse that marks where nine tenths of it lie, for independent posteriors (dotted line). The region below the line where the two are equal is shaded: there A's true value is larger, and the posterior probability of that region is the probability that A is above B.",
    }),
    tablePair: "The posterior of the pair (A, B): the probability of each side of the line where the two true values are equal",
    colCase: "Posteriors",
    colCorr: "Correlation",
    colPiAB: "Probability that A is above B",
    colPiBA: "Probability that B is above A",
    rowCorr: Object.freeze({ hand: "with the chosen correlation", shared: "with the shared prior mean's correlation" }),
    // from a shared prior mean the comparison is the same two posteriors, wrongly taken as independent
    rowIndep: Object.freeze({ hand: "independent", shared: "taken as independent" }),
    kbPair: "The posterior of the pair: the arrow keys read its center and the probability on each side of the line where the two true values are equal.",
    kbCenterA: "Center: posterior means ",
    kbCenterB: " (A) and ",
    kbCenterC: " (B), SDs ",
    kbCenterD: " and ",
    kbCenterE: ", correlation ",
    kbBelow: "Shaded region below the line, where A's true value is larger: probability ",
    kbAbove: "Region above the line, where B's true value is larger: probability ",
    // each unit's posterior (1.8's upper figure)
    xUnits: "True value",
    yLabel: "Density",
    altUnits: "Posterior densities of the true values of unit A (solid line) and unit B (dashed line).",
    tableUnits: "Posterior mean and SD of each unit",
    colUnit: "Unit",
    colMean: "Posterior mean",
    colSd: "Posterior SD",
    kbUnits: "The two posteriors: the arrow keys read each unit's posterior mean and SD.",
    kbUnit: "Unit ",
    kbMean: ": posterior mean ",
    kbSd: ", posterior SD ",
    // the difference (v1's box figure)
    xDiff: "True value of A minus true value of B",
    withCorr: "with corr",
    independent: Object.freeze({ hand: "independent", shared: "taken as independent" }),
    altDiff: Object.freeze({
      hand: "Posterior density of the difference A minus B with the chosen correlation (dash-dot line, the area to the right of zero shaded) and with independent posteriors (dotted line), on the same axes.",
      shared: "Posterior density of the difference A minus B with the correlation the shared prior mean gives (dash-dot line, the area to the right of zero shaded) and with the same two posteriors taken as independent (dotted line), on the same axes.",
      zero: "Posterior density of the difference A minus B for independent posteriors (dotted line), the area to the right of zero shaded.",
    }),
    tableDiff: Object.freeze({
      hand: "The difference A minus B with the chosen correlation and with independent posteriors",
      shared: "The difference A minus B with the shared prior mean's correlation and with the same two posteriors taken as independent",
    }),
    colDiffMean: "Posterior mean of A minus B",
    colDiffSd: "Posterior SD of A minus B",
    kbDiff: "The posterior of A minus B: the arrow keys read the curve with the correlation, the independent one and the shaded area.",
    kbWith: "With corr: posterior mean of A minus B ",
    kbIndep: Object.freeze({ hand: "Independent: posterior mean of A minus B ", shared: "Taken as independent: posterior mean of A minus B " }),
    kbSdD: ", SD ",
    kbPi: "; probability that A is above B ",
    kbArea: "Shaded area to the right of 0: the probability that A's true value is larger than B's, ",
    // result line (v1's two forms)
    resultA: "With corr = ",
    resultB: ", the SD of the difference is ",
    resultC: Object.freeze({ hand: " (independent: ", shared: " (taken as independent: " }),
    resultD: ") and ",
    resultIs: " is ",
    resultE: ").",
    zeroA: "With corr = ",
    zeroB: " the posteriors are independent: the SD of the difference is ",
    zeroC: " and ",
    zeroD: ".",
    // formulas
    modelHead: "From the shared prior mean",
    generalHead: "For jointly normal posteriors with correlation corr",
    workedHead: "At these settings, with this corr",
    regionModel: "The correlation a shared prior mean gives",
    regionGeneral: "The direction probability for jointly normal posteriors with correlation corr",
    regionWorked: "The direction probability at these settings",
    modelNoteA: ", the share kept, is the weight each posterior puts on its own estimate, given the prior mean; the rest goes to the prior mean. ",
    modelNoteVar: "Given both estimates the prior mean has variance ",
    modelNoteB: " (SD ",
    modelNoteC: "), and both true values lean on it, so they move together. Posterior means ",
    // with the prior mean known (its SD 0) nothing is shared
    modelNoteKnownA: "The prior mean is known (",
    modelNoteKnownB: "), so nothing is shared: the two posteriors are independent. Posterior means ",
    modelNoteD: " and ",
    modelNoteE: ", SDs ",
    modelNoteF: " and ",
    modelNoteG: ".",
    glossA: " is the probability that A's true value is larger than B's; Φ(",
    glossB: ") is the area under the normal curve with mean ",
    glossC: " and SD ",
    glossD: " to the left of ",
    glossE: ".",
    claim: "Correlation changes only the SD of the difference, so π_AB moves toward or away from one half, never past it, while the pair's posterior is normal.",
    // read-out
    liveA: "Correlation ",
    liveB: " gives ",
    liveC: Object.freeze({ hand: " (independent: ", shared: " (taken as independent: " }),
    liveD: ").",
    liveZeroA: "Correlation ",
    liveZeroB: " gives the independent ",
    sharedA: "The shared prior mean gives correlation ",
    sharedB: " and ",
    sharedZeroA: "The prior mean is known, so nothing is shared: correlation ",
    sideA: " Because the pair's posterior is normal and A's posterior mean is ",
    sideAbove: "above B's, ",
    sideBelow: "below B's, ",
    sideEqual: "Because the pair's posterior is normal and the two posterior means are equal, ",
    sideStaysAbove: " stays above one half at every correlation.",
    sideStaysBelow: " stays below one half at every correlation.",
    sideHalf: " is one half at every correlation.",
    // the caption's gloss when the browser computes the posterior from the stated model
    gloss: "Uncertainty about the shared prior mean gives the two posterior values their dependence.",
  }),
  tex: Object.freeze({
    sdDiff: "\\mathrm{SD}_{A-B}",
    meanA: "\\mathrm{mean}_A",
    meanB: "\\mathrm{mean}_B",
    sdA: "\\mathrm{SD}_A",
    sdB: "\\mathrm{SD}_B",
    corr: "\\mathrm{corr}",
    // words are \mathrm groups joined by a thin space (a space inside \mathrm would be one more <mtext>)
    priorSd: "\\mathrm{prior}\\,\\mathrm{SD}",
    se: (u) => `\\mathrm{SE}_${u}`,
    // the share of its estimate a posterior mean keeps (k, not B, which names a unit)
    shrink: (u) => `k_${u}`,
    v: "v",
    regionAB: "\\pi_{AB}",
    regionBA: "\\pi_{BA}",
  }),
  // inside a formula a bound is written as a relation (formatProb with bounds "symbols": ">.999", "<.001")
  bounds: "symbols",
  boundWords: /^(?:above|below) /,
});

const T = CONFIG.text;
const C = CONFIG.chart;
const X = CONFIG.tex;
const M = CONFIG.model;
const SVG_NS = "http://www.w3.org/2000/svg";
// a space that does not break a line (the pair title keeps "(independent .760)" together)
const NBSP = " ";
const dec = (digits) => (x) => formatDecimal(x, { digits });

/** Display rules by how the posterior was set: by hand its numbers are settings; from the model they are computed. */
const FORMATS = Object.freeze({
  hand: Object.freeze({ mean: formatSetting, sd: formatSetting, corr: formatSetting, gap: dec(CONFIG.digits.gap) }),
  shared: Object.freeze({
    mean: dec(CONFIG.digits.computed), sd: dec(CONFIG.digits.computed), corr: dec(CONFIG.digits.computed), gap: dec(CONFIG.digits.computed),
  }),
});
const fmtSd = dec(CONFIG.digits.sd);
const fmtZ = dec(CONFIG.digits.z);

export const CSS = `${TWO_CSS}
.cu .prx-controls > .cu-source { flex: 1 1 100%; }
.cu .cu-set { display: flex; flex-wrap: wrap; gap: 0.5rem 1.4rem; flex: 1 1 100%; min-width: 0; }
.cu .cu-set > .prx-two-units-unit { flex: 1 1 15rem; }
.cu .prx-two-units-unit .prx-hint { margin-top: 0.1rem; }
/* the figures in result-first order (review 044, X-01): narrow, one column in DOM order (pair, difference, units, key);
   wide, the pair with the key under it on the left and the difference above the units on the right */
.cu .cu-figs { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "pair" "side" "key"; gap: 0.85rem 1.25rem;
  align-items: start; }
.cu .cu-fig { min-width: 0; }
.cu .cu-pair { grid-area: pair; max-width: 27rem; }
.cu .cu-side { grid-area: side; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.85rem; min-width: 0; }
.cu .cu-figs > .cu-key { grid-area: key; }
@container (min-width: 48rem) {
  .cu .cu-figs { grid-template-columns: minmax(0, 26rem) minmax(0, 1fr); grid-template-areas: "pair side" "key side"; grid-template-rows: auto 1fr; }
  .cu .cu-pair { max-width: none; }
}
.cu .cu-key { display: flex; flex-wrap: wrap; gap: 0.15rem 1rem; margin: 0; padding: 0.25rem 0.5rem 0.35rem;
  font-size: 0.8125rem; line-height: 1.35; }
.cu .cu-key-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.cu .cu-key-note { flex: 1 1 100%; }
.cu .cu-line { position: relative; display: inline-block; flex: none; width: 1.6rem; height: 0.9rem; }
.cu .cu-line::before { content: ""; position: absolute; left: 0.1rem; right: 0.1rem; top: calc(50% - 1px); border-top: 2px solid var(--prx-post); }
.cu .cu-line-dot::before { border-top: 2px dotted var(--prx-post); }
.cu .cu-line-axis::before { border-top-color: var(--prx-plot-axis); }
.cu .cu-line-svg { display: inline-block; flex: none; width: 1.6rem; height: 0.6rem; overflow: visible; }
.cu .cu-line-svg line { stroke: var(--prx-post); stroke-width: 2; }
.cu .cu-plus { display: inline-block; flex: none; width: 1rem; text-align: center; font-weight: 700; color: var(--prx-post); }
.cu .cu-region { background: var(--prx-blues-3); }
.cu .cu-result { margin: 0.4rem 0 0; padding: 0.4rem 0.75rem; background: var(--prx-bg-sunken); border-radius: var(--prx-radius);
  font-variant-numeric: tabular-nums; }
.cu .prx-two-units-formula-grid > .cu-model { grid-column: 1 / -1; }
.cu .cu-model-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem 1.5rem; align-items: center; }
@container (min-width: 44rem) {
  .cu .prx-two-units-formula-grid > .prx-two-units-step:last-child { grid-column: auto; }
  .cu .prx-two-units-formula-grid > .cu-model { grid-column: 1 / -1; }
  .cu .cu-model-body { grid-template-columns: minmax(0, auto) minmax(0, 1fr); }
}
.cu .cu-model[hidden] { display: none; }
`;

// ---------------------------------------------------------------------------------------------- computing

/**
 * The posterior of (θ_A, θ_B) under the shared-prior-mean model: { shrinkA, shrinkB (k_i, the share of its own
 * estimate a posterior mean keeps given the prior mean), meanOfMean and variance (the prior mean given both estimates;
 * variance 0 when its SD is 0), muA, sdA, muB, sdB, corr }. An uncertain prior mean (SD > 0): engine
 * sharedMeanPosterior. A known one (SD 0), the model's limit: nothing is shared, so each unit has its own normal
 * posterior around it (engine normalPosterior) and the correlation is 0.
 */
export function sharedMean({ yA, seA, yB, seB, priorSd, meanSd }) {
  if (!(meanSd > 0)) {
    const known = normalPosterior([yA, yB], [seA, seB], { priorMean: M.center, priorSd });
    return {
      shrinkA: known.shrink[0], shrinkB: known.shrink[1], meanOfMean: M.center, variance: 0,
      muA: known.mean[0], sdA: known.sd[0], muB: known.mean[1], sdB: known.sd[1], corr: 0,
    };
  }
  const s = sharedMeanPosterior([yA, yB], [seA, seB], { priorSd, meanSd, priorMean: M.center });
  return {
    shrinkA: s.weight[0], shrinkB: s.weight[1], meanOfMean: s.muMean, variance: s.muVar,
    muA: s.means[0], sdA: s.sds[0], muB: s.means[1], sdB: s.sds[1], corr: s.corr[0][1],
  };
}

/**
 * Everything the app shows for one posterior of the pair p = { muA, sdA, muB, sdB, corr }: the posterior of the
 * difference θ_A − θ_B with corr and independent (engine pairDifference: the gap, the SD, z and π_AB), and π_BA from
 * the reverse pair, each on its own, with corr and independent.
 */
export function pairOf(p) {
  const d = pairDifference(p.muA, p.sdA, p.muB, p.sdB, { corr: p.corr });
  const indep = pairDifference(p.muA, p.sdA, p.muB, p.sdB);
  return {
    ...p, gap: d.mean, sd: d.sd, sdIndep: indep.sd, z: d.z,
    pi: d.pi,
    piReverse: pairDifference(p.muB, p.sdB, p.muA, p.sdA, { corr: p.corr }).pi,
    piIndep: indep.pi,
    piIndepReverse: pairDifference(p.muB, p.sdB, p.muA, p.sdA).pi,
  };
}

/** The posterior of the pair for a state: by hand, or from the shared-prior-mean model (with the model's parts). */
function posteriorOf(state) {
  if (state.source === "shared") {
    const m = sharedMean(state);
    return { source: "shared", model: m, muA: m.muA, sdA: m.sdA, muB: m.muB, sdB: m.sdB, corr: m.corr };
  }
  return { source: "hand", muA: state.muA, sdA: state.sdA, muB: state.muB, sdB: state.sdB, corr: state.corr };
}

/**
 * The ellipse of a bivariate normal posterior that holds `level` of it: points (x = θ_A, y = θ_B) at Mahalanobis
 * radius √(−2 ln(1 − level)), the first point repeated at the end.
 */
export function ellipse({ muA, sdA, muB, sdB, corr }, level = CONFIG.level, count = CONFIG.ellipse.points) {
  const r = Math.sqrt(-2 * Math.log(1 - level));
  const s = Math.sqrt(1 - corr * corr);
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const t = (2 * Math.PI * k) / (count - 1);
    out.push({ x: muA + r * sdA * Math.cos(t), y: muB + r * sdB * (corr * Math.cos(t) + s * Math.sin(t)) });
  }
  return out;
}

/**
 * The same ellipse as vertical slices { x, y1, y2 } (for a filled area): x runs across the ellipse with cosine
 * spacing, and each slice is the conditional mean of θ_B given θ_A = x, ± its half-height.
 */
export function ellipseBand({ muA, sdA, muB, sdB, corr }, level = CONFIG.level, count = CONFIG.ellipse.points) {
  const r = Math.sqrt(-2 * Math.log(1 - level));
  const s = Math.sqrt(1 - corr * corr);
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const t = (Math.PI * k) / (count - 1);
    const u = -Math.cos(t);
    const half = r * sdB * s * Math.sin(t);
    const mid = muB + r * sdB * corr * u;
    out.push({ x: muA + r * sdA * u, y1: mid - half, y2: mid + half });
  }
  return out;
}

/** The x domain of the units' figure: each unit within 4 SDs, padded, nice (as in 1.8). */
function unitDomain(p) {
  const reach = TWO.grid.reach;
  return paddedDomain(Math.min(p.muA - reach * p.sdA, p.muB - reach * p.sdB), Math.max(p.muA + reach * p.sdA, p.muB + reach * p.sdB));
}

/**
 * The one domain of both axes of the pair's square figure: each unit within `reach` SDs (the ellipse reaches 2.15),
 * padded, with ends on a step of 1, 2, 2.5, 5 or 10 × 10^k chosen for `steps` steps, so the ellipse fills the square.
 */
function pairDomain(p) {
  const { reach, steps } = C.pair;
  const lo = Math.min(p.muA - reach * p.sdA, p.muB - reach * p.sdB);
  const hi = Math.max(p.muA + reach * p.sdA, p.muB + reach * p.sdB);
  const pad = TWO.grid.pad * (hi - lo);
  const raw = (hi - lo + 2 * pad) / steps;
  const scale = 10 ** Math.floor(Math.log10(raw));
  const step = (TWO.nice.mantissas.find((m) => m * scale >= raw) ?? TWO.nice.mantissas.at(-1)) * scale;
  const round = (x) => Number(x.toFixed(TWO.nice.decimals));
  return [round(Math.floor((lo - pad) / step) * step), round(Math.ceil((hi + pad) / step) * step)];
}

/** True when (x, y) lies inside the ellipse of p that holds `level` of its posterior. */
function insideEllipse({ muA, sdA, muB, sdB, corr }, x, y, level = CONFIG.level) {
  const a = (x - muA) / sdA;
  const b = (y - muB) / sdB;
  return (a * a - 2 * corr * a * b + b * b) / (1 - corr * corr) <= -2 * Math.log(1 - level);
}

/**
 * The chart.js formula labels π_AB (in the shaded region below the line) and π_BA (above it), each at the first of
 * its places that keeps its box clear of the drawn ellipses: the region's far corner, then the middle of its outer
 * edge across, then of its outer edge up or down. inner: the side of the square plot area in px.
 */
function regionLabels(d, [lo, hi], inner, ellipses) {
  const G = C.pair;
  const span = hi - lo;
  const px = span / Math.max(1, inner);
  const w = G.labelBox.width * px;
  const hgt = G.labelBox.height * px;
  const m = G.labelBox.margin * px;
  const c = G.corner * span;
  const mid = (lo + hi) / 2;
  // each place: the label's anchor point, its anchors, and its box [x0, x1] × [y0, y1] in data units (y up)
  const place = (x, y, anchor, valign) => {
    const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    const y1 = valign === "top" ? y : valign === "bottom" ? y + hgt : y + hgt / 2;
    return { x, y, anchor, valign, box: [x0 - m, x0 + w + m, y1 - hgt - m, y1 + m] };
  };
  const clear = ({ box: [x0, x1, y0, y1] }) => {
    for (const pts of ellipses) for (const q of pts) if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) return false;
    const corners = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]];
    return !corners.some(([x, y]) => insideEllipse(d, x, y) || insideEllipse({ ...d, corr: 0 }, x, y));
  };
  const pick = (places) => places.find(clear) ?? places[0];
  const ab = pick([
    place(hi - c, lo + c, "end", "bottom"),
    place(mid + w, lo + c, "middle", "bottom"),
    place(hi - c, mid - hgt, "end", "middle"),
  ]);
  const ba = pick([
    place(lo + c, hi - c, "start", "top"),
    place(mid - w, hi - c, "middle", "top"),
    place(lo + c, mid + hgt, "start", "middle"),
  ]);
  return [
    { key: "ab", tex: X.regionAB, x: ab.x, y: ab.y, anchor: ab.anchor, valign: ab.valign },
    { key: "ba", tex: X.regionBA, x: ba.x, y: ba.y, anchor: ba.anchor, valign: ba.valign },
  ];
}

// ---------------------------------------------------------------------------------------------- formulas

/** A formula value in parentheses (the cross term's factors). */
const paren = (t) => `\\left(${t}\\right)`;

/** The general formula with correlation (its one number is the 2 of the cross term). */
function generalTex() {
  const f = formulaNums();
  const post = (t) => `\\class{${TWO.tex.post}}{${t}}`;
  const tex = `\\begin{aligned}${TWO.tex.piAB} &= \\Phi\\left(\\frac{${post(X.meanA)} - ${post(X.meanB)}}{${X.sdDiff}}\\right), \\\\ `
    + `${X.sdDiff}^{2} &= ${post(X.sdA)}^{2} + ${post(X.sdB)}^{2} - ${f.num(2, "2")}\\,${X.corr}\\,${post(X.sdA)}\\,${post(X.sdB)}\\end{aligned}`;
  return { tex, raws: f.raws };
}

/**
 * The formula at one setting d = pairOf(...): the variance of the difference, broken before the cross term so that
 * every line fits a narrow screen (no line starts with =), then π_AB. Its 11 numbers, in order: SD_A, SD_B, 2, corr,
 * SD_A, SD_B, SD_{A−B}, gap, SD_{A−B}, z, π_AB.
 */
function workedTex(d, fmt) {
  const f = formulaNums();
  const P = TWO.tex.post;
  const sA = f.num(d.sdA, fmt.sd(d.sdA), P);
  const sB = f.num(d.sdB, fmt.sd(d.sdB), P);
  const two = f.num(2, "2");
  const corr = f.num(d.corr, fmt.corr(d.corr));
  const sA2 = f.num(d.sdA, fmt.sd(d.sdA), P);
  const sB2 = f.num(d.sdB, fmt.sd(d.sdB), P);
  const sd = f.num(d.sd, fmtSd(d.sd));
  const gap = f.num(d.gap, fmt.gap(d.gap));
  const sd2 = f.num(d.sd, fmtSd(d.sd));
  const z = f.num(d.z, fmtZ(d.z));
  const tex = `\\begin{aligned}${X.sdDiff}^{2} &= ${sA}^{2} + ${sB}^{2} \\\\ &\\quad - ${two}\\,${paren(corr)}${paren(sA2)}${paren(sB2)} = ${sd}^{2} \\\\ `
    + `${TWO.tex.piAB} &= \\Phi\\left(\\frac{${gap}}{${sd2}}\\right) = \\Phi(${z}) ${probTex(f, d.pi)}\\end{aligned}`;
  return { tex, raws: f.raws };
}

/**
 * The model's weights and the correlation they give (m = sharedMean(...)): the share k_i of its own estimate each
 * posterior mean keeps (k_A and k_B at these settings), then corr = (1 − k_A)(1 − k_B) v / (SD_A SD_B). Its numbers,
 * in order: k_A, k_B, 1, 1, corr.
 */
function modelTex(m) {
  const f = formulaNums();
  const shrink = (x) => f.num(x, formatDecimal(x, { digits: CONFIG.digits.shrink }));
  const one = () => f.num(1, "1");
  const post = (t) => `\\class{${TWO.tex.post}}{${t}}`;
  const tex = `\\begin{aligned}${X.shrink("i")} &= \\frac{${X.priorSd}^{2}}{${X.priorSd}^{2} + ${X.se("i")}^{2}}:\\quad `
    + `${X.shrink("A")} = ${shrink(m.shrinkA)},\\; ${X.shrink("B")} = ${shrink(m.shrinkB)} \\\\ `
    + `${X.corr} &= \\frac{\\left(${one()} - ${X.shrink("A")}\\right)\\left(${one()} - ${X.shrink("B")}\\right)${X.v}}{${post(X.sdA)}\\,${post(X.sdB)}} `
    + `= ${f.num(m.corr, formatDecimal(m.corr, { digits: CONFIG.digits.computed }))}\\end{aligned}`;
  return { tex, raws: f.raws };
}

// ---------------------------------------------------------------------------------------------- figures

const frame = (height) => ({ height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight });
const yAxis = (ymax) => ({ domain: [0, ymax], label: T.yLabel, ticks: C.yTicks });
const halo = (c) => ({ fill: c.plotFg, fontWeight: "bold", stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke" });

/** The square figure of the pair in el: region, line, ellipses, center; hidden table and keyboard points. */
function drawPair(el, d, fmt, mode) {
  const [lo, hi] = pairDomain(d);
  const G = C.pair;
  const width = plotWidth(el);
  const inner = Math.max(1, width - G.marginLeft - G.marginRight);
  const height = Math.round(inner + G.marginTop + G.marginBottom);
  const same = d.corr === 0;
  const withCorr = ellipse(d);
  const indep = ellipse({ ...d, corr: 0 });
  const span = hi - lo;
  const below = { x: hi - G.kbInset * span, y: lo + G.kbInset * span };
  const above = { x: lo + G.kbInset * span, y: hi - G.kbInset * span };
  // at corr 0 the posteriors are independent, not merely taken as independent
  const rows = [
    { label: T.rowCorr[mode], corr: d.corr, ab: d.pi, ba: d.piReverse },
    { label: same ? T.rowIndep.hand : T.rowIndep[mode], corr: 0, ab: d.piIndep, ba: d.piIndepReverse },
  ];
  return plot(el, {
    alt: same ? T.altPair.zero : T.altPair[mode],
    table: {
      caption: T.tablePair,
      columns: [
        { label: T.colCase, value: "label" },
        { label: T.colCorr, value: "corr", format: (v) => (v === 0 ? formatSetting(0) : fmt.corr(v)) },
        { label: T.colPiAB, value: "ab", format: (v) => probText(v) },
        { label: T.colPiBA, value: "ba", format: (v) => probText(v) },
      ],
      rows: same ? rows.slice(1) : rows,
    },
    width, height, marginTop: G.marginTop, marginBottom: G.marginBottom, marginLeft: G.marginLeft, marginRight: G.marginRight,
    // one tick count on both axes, so the square shows the same ticks across and up
    x: { domain: [lo, hi], label: T.xPair, ticks: G.ticks },
    y: { domain: [lo, hi], label: T.yPair, ticks: G.ticks },
    marks: (c, P) => [
      // the region θ_A > θ_B: below the line where the two are equal
      P.areaY([{ x: lo, y1: lo, y2: lo }, { x: hi, y1: lo, y2: hi }], { x: "x", y1: "y1", y2: "y2", fill: c.blues[2] }),
      P.line([{ x: lo, y: lo }, { x: hi, y: hi }], { x: "x", y: "y", stroke: c.plotAxis, strokeWidth: C.line }),
      // the posterior's ellipse, washed in navy so the share of it on each side of the line shows
      P.areaY(ellipseBand(same ? { ...d, corr: 0 } : d), { x: "x", y1: "y1", y2: "y2", fill: c.post, fillOpacity: G.wash }),
      same ? null : P.line(indep, { x: "x", y: "y", stroke: c.post, strokeWidth: C.thin, strokeDasharray: C.dot }),
      P.line(same ? indep : withCorr, { x: "x", y: "y", stroke: c.post, strokeWidth: C.line, strokeDasharray: same ? C.dot : null }),
      P.dot([{ x: d.muA, y: d.muB }], { x: "x", y: "y", symbol: "plus", r: G.cross / 2, stroke: c.post, strokeWidth: C.thin }),
    ],
    formulas: regionLabels(d, [lo, hi], inner, same ? [indep] : [withCorr, indep]),
    keyboard: {
      data: [
        { key: "center", x: d.muA, y: d.muB,
          title: `${T.kbCenterA}${fmt.mean(d.muA)}${T.kbCenterB}${fmt.mean(d.muB)}${T.kbCenterC}${fmt.sd(d.sdA)}${T.kbCenterD}${fmt.sd(d.sdB)}${T.kbCenterE}${fmt.corr(d.corr)}.` },
        { key: "below", ...below, title: `${T.kbBelow}${probText(d.pi)}.` },
        { key: "above", ...above, title: `${T.kbAbove}${probText(d.piReverse)}.` },
      ],
      x: "x", y: "y", key: "key", sort: false, label: T.kbPair, title: (p) => p.title,
    },
  });
}

/** Each unit's posterior in el (1.8's upper figure, its marks imported): A solid, B dashed; table and keyboard. */
function drawUnits(el, d, fmt) {
  const domain = unitDomain(d);
  const ymax = TWO.grid.headroom * normalPdf(0) / Math.min(d.sdA, d.sdB);
  const geometry = { width: plotWidth(el), height: TWO.chart.heightTop };
  const peaks = [
    { key: "A", x: d.muA, y: normalPdf(0) / d.sdA, mean: d.muA, sd: d.sdA },
    { key: "B", x: d.muB, y: normalPdf(0) / d.sdB, mean: d.muB, sd: d.sdB },
  ];
  return plot(el, {
    alt: T.altUnits,
    table: {
      caption: T.tableUnits,
      columns: [
        { label: T.colUnit, value: "unit" },
        { label: T.colMean, value: "mean", format: (v) => fmt.mean(v) },
        { label: T.colSd, value: "sd", format: (v) => fmt.sd(v) },
      ],
      rows: [{ unit: TWO.units[0], mean: d.muA, sd: d.sdA }, { unit: TWO.units[1], mean: d.muB, sd: d.sdB }],
    },
    ...frame(TWO.chart.heightTop),
    x: { domain, label: T.xUnits },
    y: yAxis(ymax),
    marks: (c, P) => topMarks(c, P, d, domain, ymax, geometry),
    keyboard: {
      data: peaks, x: "x", y: "y", key: "key", sort: false, label: T.kbUnits,
      title: (p) => `${T.kbUnit}${p.key}${T.kbMean}${fmt.mean(p.mean)}${T.kbSd}${fmt.sd(p.sd)}.`,
    },
  });
}

/**
 * The difference in el (v1's correlation box figure): with corr (dash-dot, area above 0 shaded) and independent
 * (dotted) on one x domain (0 and the gap ± 4 × the wider SD, padded, nice) and one y scale (1.15 × the taller peak).
 * The taller curve is labeled at its peak (beside it, away from 0, when near 0), the wider on its right shoulder.
 */
function drawDiff(el, d, fmt, mode) {
  const sdWide = Math.max(d.sd, d.sdIndep);
  const reach = TWO.grid.reach;
  const domain = paddedDomain(Math.min(0, d.gap - reach * sdWide), Math.max(0, d.gap + reach * sdWide));
  const [lo, hi] = domain;
  const ymax = TWO.grid.headroom * normalPdf(0) / Math.min(d.sd, d.sdIndep);
  const same = d.corr === 0;
  const indep = densityPoints(d.gap, d.sdIndep, lo, hi, [0, d.gap]);
  const peak = (sd, text) => ({ ...diffLabel({ mean: d.gap, sd }, domain, text), dy: C.labelDy });
  // the shoulder label sits just above its point, so the curve falling away to the right stays clear of it
  const shoulder = (sd, text) => ({ x: d.gap + C.shoulder * sd, y: normalPdf(C.shoulder) / sd, text, dx: C.shoulderDx, dy: C.labelDy, anchor: "start" });
  const corrTaller = d.sd < d.sdIndep;
  // at corr 0 the one curve is the independent posterior itself; otherwise the dotted curve is the comparison
  const indepWord = same ? T.independent.hand : T.independent[mode];
  const labels = same ? [peak(d.sdIndep, indepWord)]
    : corrTaller ? [peak(d.sd, T.withCorr), shoulder(d.sdIndep, indepWord)]
      : [peak(d.sdIndep, indepWord), shoulder(d.sd, T.withCorr)];
  const fmtGap = fmt.gap;
  const points = [
    ...(same ? [] : [{ key: "with", x: d.gap, y: normalPdf(0) / d.sd, title: `${T.kbWith}${fmtGap(d.gap)}${T.kbSdD}${fmtSd(d.sd)}${T.kbPi}${probText(d.pi)}.` }]),
    { key: "indep", x: d.gap, y: normalPdf(0) / d.sdIndep, title: `${same ? T.kbIndep.hand : T.kbIndep[mode]}${fmtGap(d.gap)}${T.kbSdD}${fmtSd(d.sdIndep)}${T.kbPi}${probText(d.piIndep)}.` },
    { key: "area", x: Math.min(C.areaDx * (hi - lo), hi / 2), y: ymax / 2, title: `${T.kbArea}${probText(d.pi)}.` },
  ];
  return plot(el, {
    alt: same ? T.altDiff.zero : T.altDiff[mode],
    table: {
      caption: T.tableDiff[mode],
      columns: [
        { label: T.colCase, value: "label" },
        { label: T.colCorr, value: "corr", format: (v) => (v === 0 ? formatSetting(0) : fmt.corr(v)) },
        { label: T.colDiffMean, value: "mean", format: (v) => fmtGap(v) },
        { label: T.colDiffSd, value: "sd", format: (v) => fmtSd(v) },
        { label: T.colPiAB, value: "pi", format: (v) => probText(v) },
      ],
      rows: [
        { label: T.rowCorr[mode], corr: d.corr, mean: d.gap, sd: d.sd, pi: d.pi },
        { label: same ? T.rowIndep.hand : T.rowIndep[mode], corr: 0, mean: d.gap, sd: d.sdIndep, pi: d.piIndep },
      ],
    },
    ...frame(C.heightDiff),
    x: { domain, label: T.xDiff },
    y: yAxis(ymax),
    marks: (c, P) => [
      ...diffMarks(c, P, { mean: d.gap, sd: same ? d.sdIndep : d.sd }, domain, { label: null, dash: same ? C.dot : TWO.chart.dashDiff }),
      same ? null : P.lineY(indep, { x: "x", y: "y", stroke: c.post, strokeWidth: C.thin, strokeDasharray: C.dot }),
      ...labels.map((l) => P.text([l], { x: "x", y: "y", text: "text", dx: l.dx, dy: l.dy, textAnchor: l.anchor, ...halo(c) })),
    ],
    keyboard: { data: points, x: "x", y: "y", key: "key", sort: false, label: T.kbDiff, title: (p) => p.title },
  });
}

// ---------------------------------------------------------------------------------------------- the app

/** The keys: the posterior by hand (1.8's four and corr), the source, and the shared-prior-mean model. */
function appKeys() {
  const keys = unitKeys();
  keys.corr = { type: "number", ...CONFIG.corr };
  keys.source = { type: "choice", values: [...CONFIG.source.values], value: CONFIG.source.value };
  for (const u of TWO.units) {
    keys[`y${u}`] = { type: "number", ...M.estimate, value: M.setting[`y${u}`] };
    keys[`se${u}`] = { type: "number", ...M.se, value: M.setting[`se${u}`] };
  }
  keys.priorSd = { type: "number", ...M.priorSd };
  keys.meanSd = { type: "number", ...M.meanSd };
  return keys;
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    // the shared result-first frame (review 044 repair, X-01): the controls, the read-out directly under them, then the
    // figures and the formula box; base.js only moves nodes (keys, presets, hooks and the live region are the same)
    layout: "result-first",
    keys: appKeys(),
    build(ctx) {
      const { h } = ctx;
      const tagged = (node, name) => { node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => tagged(ctx.num(raw, display), name);

      // --- controls: how the posterior is set; by hand (1.8's fieldsets and the correlation) or from the model
      const source = ctx.segmented({
        label: T.sourceLabel, name: "source", className: "cu-source", value: ctx.state.source,
        options: [{ value: "hand", label: T.sourceHand }, { value: "shared", label: T.sourceShared }],
        onChange: (v) => ctx.set({ source: v }),
      });
      const units = unitControls(ctx);
      const corr = ctx.slider({
        label: T.corrLabel, ...ctx.key("corr"), onInput: (v) => ctx.set({ corr: v }),
        hint: [T.corrHintA, num(CONFIG.corr.max, formatSetting(CONFIG.corr.max), "corr-max"), T.corrHintB],
      });
      corr.input.setAttribute("aria-label", T.corrName);
      // the correlation slider moves the pair figure (review 044: base.js primaryControl; the mode switch comes first)
      ctx.primaryControl(corr.root);
      const pairSet = h("fieldset", { class: "prx-control prx-two-units-unit" }, h("legend", { text: T.pairLegend }), corr.root);
      const handSet = h("div", { class: "cu-set", "data-prx-source": "hand" }, ...units.roots, pairSet);

      const modelSliders = [];
      const modelSlider = (key, label, name, hint) => {
        const s = ctx.slider({ label, ...ctx.key(key), onInput: (v) => ctx.set({ [key]: v }), hint });
        s.input.setAttribute("aria-label", name);
        modelSliders.push([key, s]);
        return s.root;
      };
      const modelUnits = TWO.units.map((u) => h("fieldset", { class: "prx-control prx-two-units-unit" },
        h("legend", { text: TWO.text.unit[u] }),
        modelSlider(`y${u}`, T.estimate, `${T.estimateName}${u}`),
        modelSlider(`se${u}`, T.se, `${T.seNameA}${u}${T.seNameB}`)));
      const priorSet = h("fieldset", { class: "prx-control prx-two-units-unit" }, h("legend", { text: T.priorLegend }),
        modelSlider("priorSd", T.priorSd, T.priorSdName, T.priorSdHint),
        modelSlider("meanSd", T.meanSd, T.meanSdName, [T.meanSdHintA, ctx.num(M.meanSd.min, formatSetting(M.meanSd.min)), T.meanSdHintB]));
      const sharedSet = h("div", { class: "cu-set", "data-prx-source": "shared" }, ...modelUnits, priorSet);
      // only the fieldsets of the way the posterior is set are in the page (swapped in render), so the first slider
      // is always one the reader sees. They follow the preset row (base.js afterPresets; a swap keeps the place): the
      // two sets differ in height (by 72 px on a page at 1280), so above it they would move the preset buttons when a
      // preset switches between them (review 044: presetShift; X-18's placement)
      let shownSet = handSet;
      ctx.controls.append(source.root);
      ctx.afterPresets(shownSet);

      // --- figures: the pair (square, its title carrying π_AB), the difference with its result line above each unit's
      // posterior, then the key (review 044, X-01: the panels the correlation changes first)
      ctx.charts.classList.add("prx-two-units-charts");
      const pairSlot = h("div", { class: "prx-two-units-panel" });
      const unitsSlot = h("div", { class: "prx-two-units-panel" });
      const diffSlot = h("div", { class: "prx-two-units-panel" });
      const keyLine = (cls) => h("span", { class: `cu-line ${cls}`.trim(), "aria-hidden": "true" });
      // a dash-dot sample (the difference's line, 1.8's dash pattern) drawn as a small inline SVG
      const keyDashDot = () => {
        const s = ctx.doc.createElementNS(SVG_NS, "svg");
        s.setAttribute("class", "cu-line-svg");
        s.setAttribute("viewBox", "0 0 26 10");
        s.setAttribute("aria-hidden", "true");
        s.setAttribute("focusable", "false");
        const l = ctx.doc.createElementNS(SVG_NS, "line");
        for (const [k, v] of Object.entries({ x1: 1, y1: 5, x2: 25, y2: 5, "stroke-dasharray": TWO.chart.dashDiff })) l.setAttribute(k, String(v));
        s.append(l);
        return s;
      };
      const keyCorrWords = h("span", {});
      const keyCorr = h("span", { class: "cu-key-item" }, keyLine(""), keyDashDot(), keyCorrWords);
      const keyIndepWords = h("span", {});
      const keyIndep = h("span", { class: "cu-key-item" }, keyLine("cu-line-dot"), keyIndepWords);
      const keyEqual = h("span", { class: "cu-key-item" }, keyLine("cu-line-axis"), h("span", { text: T.keyLine }));
      const keyMeans = h("span", { class: "cu-key-item" }, h("span", { class: "cu-plus", "aria-hidden": "true", text: "+" }), h("span", { text: T.keyMeans }));
      const keyRegion = h("span", { class: "cu-key-item" }, h("span", { class: "prx-swatch cu-region", "aria-hidden": "true" }),
        h("span", {}, T.keyRegionA, piName(h, "AB")));
      const keyNote = h("span", { class: "cu-key-note" }, T.keyLevelA, ctx.num(CONFIG.level, formatSetting(CONFIG.level)), T.keyLevelB,
        piName(h, "BA"), T.keyLevelC, ctx.num(1, formatSetting(1)), T.keyLevelD, piName(h, "AB"), T.keyLevelE);
      // the key sits on light paper, like the figure, so its marks read the same in both themes
      const key = ctx.part("legend", h("p", { class: "prx-light-panel cu-key" }, keyCorr, keyIndep, keyEqual, keyMeans, keyRegion, keyNote));
      const result = h("p", { class: "cu-result" });
      const title = (text) => ctx.panelTitle(text);
      // the pair's title carries π_AB and the independent π_AB (written in render); the section keeps the plain name
      const pairTitle = title(T.pairTitle);
      const marginalScope = h("p", { class: "prx-two-units-note" });
      const pairSection = ctx.primaryGraphic(h("section", { class: "cu-fig cu-pair", "aria-label": T.pairTitle }, pairTitle, pairSlot));
      ctx.charts.append(h("div", { class: "cu-figs" },
        pairSection,
        h("div", { class: "cu-side" },
          h("section", { class: "cu-fig", "aria-label": T.diffTitle }, title(T.diffTitle), diffSlot, result),
          h("section", { class: "cu-fig", "aria-label": T.unitsTitle }, title(T.unitsTitle), unitsSlot, marginalScope)),
        key));

      // --- formulas: the model's correlation (shared prior mean only), the general formula, the formula at these settings
      const tex = (name, label) => ctx.scrollRegion(h("div", { class: "prx-two-units-tex", "data-prx-tex": name }), label);
      const model = tex("model", T.regionModel);
      const general = tex("corr-general", T.regionGeneral);
      const worked = tex("corr-worked", T.regionWorked);
      const modelNote = h("p", { class: "prx-two-units-note" });
      const head = (text) => ctx.panelTitle(text, { className: "prx-two-units-head" });
      const gloss = h("p", { class: "prx-two-units-note" },
        piName(h, "AB"), T.glossA, h("i", { text: "z" }), T.glossB, ctx.num(0, formatSetting(0)), T.glossC, ctx.num(1, formatSetting(1)),
        T.glossD, h("i", { text: "z" }), T.glossE);
      const claim = h("p", { class: "prx-two-units-note" }, ...T.claim.split("π_AB").flatMap((s, i) => (i ? [piName(h, "AB"), s] : [s])));
      const modelStep = h("div", { class: "prx-two-units-step cu-model" }, head(T.modelHead), h("div", { class: "cu-model-body" }, model, modelNote));
      const formula = ctx.part("formula", h("div", { class: "prx-two-units-formula" },
        h("div", { class: "prx-two-units-formula-grid" },
          modelStep,
          h("div", { class: "prx-two-units-step" }, head(T.generalHead), general, gloss, claim),
          h("div", { class: "prx-two-units-step" }, head(T.workedHead), worked))));
      ctx.charts.append(formula);
      const g = generalTex();
      renderTex(general, g.tex, { display: true, nums: g.raws });

      /** "= .841" after π_AB, or " is above .999" when the probability shows as a bound. */
      const probAfter = (raw, name, plain = " = ") => {
        const s = probText(raw);
        return [CONFIG.boundWords.test(s) ? T.resultIs : plain, num(raw, s, name)];
      };
      const probGives = (raw, name) => {
        const s = probText(raw);
        return CONFIG.boundWords.test(s) ? [" ", num(raw, s, name)] : [" = ", num(raw, s, name)];
      };

      function drawResult(d, fmt, mode) {
        const corrN = num(d.corr, d.corr === 0 ? formatSetting(0) : fmt.corr(d.corr), "corr-value");
        if (d.corr === 0) {
          result.replaceChildren(T.zeroA, corrN, T.zeroB, num(d.sdIndep, fmtSd(d.sdIndep), "corr-sd"), T.zeroC,
            piName(h, "AB"), ...probAfter(d.pi, "corr-pi"), T.zeroD);
          return;
        }
        result.replaceChildren(T.resultA, corrN, T.resultB, num(d.sd, fmtSd(d.sd), "corr-sd"),
          T.resultC[mode], num(d.sdIndep, fmtSd(d.sdIndep), "corr-sd-indep"), T.resultD,
          piName(h, "AB"), ...probAfter(d.pi, "corr-pi"),
          T.resultC[mode], num(d.piIndep, probText(d.piIndep), "corr-pi-indep"), T.resultE);
      }

      /** The pair's title with its values (review 044, X-01): "…: π_AB = .694 (independent .760)"; from a shared prior
       *  mean "(taken as independent …)"; at correlation 0 the two are one, so only "…: π_AB = .760". A bound reads
       *  "π_AB above .999", "(independent below .001)". The space before the independent value does not break, so the
       *  value never ends up alone on a line ("(independent .760)" wraps as one). */
      function drawPairTitle(d, mode) {
        const indep = d.corr === 0 ? [] : [" (", T.independent[mode], NBSP, num(d.piIndep, probText(d.piIndep), "pair-pi-indep"), ")"];
        pairTitle.replaceChildren(T.pairTitle, ": ", piName(h, "AB"), ...probGives(d.pi, "pair-pi"), ...indep);
      }

      function drawModel(m) {
        const mt = modelTex(m);
        renderTex(model, mt.tex, { display: true, nums: mt.raws });
        const c3 = (x) => formatDecimal(x, { digits: CONFIG.digits.computed });
        // the prior mean known (variance 0) shares nothing; an uncertain one is leaned on by both true values
        const shared = m.variance > 0
          ? [T.modelNoteVar, h("i", { text: "v" }), " = ", num(m.variance, formatDecimal(m.variance, { digits: CONFIG.digits.variance }), "model-variance"),
            T.modelNoteB, num(Math.sqrt(m.variance), c3(Math.sqrt(m.variance)), "model-mean-sd"), T.modelNoteC]
          : [T.modelNoteKnownA, h("i", { text: "v" }), " = ", num(m.variance, formatSetting(m.variance), "model-variance"), T.modelNoteKnownB];
        modelNote.replaceChildren(h("i", { text: "k" }), T.modelNoteA, ...shared,
          num(m.muA, c3(m.muA), "model-mean-a"), T.modelNoteD, num(m.muB, c3(m.muB), "model-mean-b"),
          T.modelNoteE, num(m.sdA, c3(m.sdA), "model-sd-a"), T.modelNoteF, num(m.sdB, c3(m.sdB), "model-sd-b"), T.modelNoteG);
      }

      function readout(d, fmt) {
        const corrN = num(d.corr, d.corr === 0 ? formatSetting(0) : fmt.corr(d.corr), "live-corr");
        const mode = d.source;
        const first = mode === "shared" && d.corr !== 0
          ? [T.sharedA, corrN, T.sharedB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), T.liveC.shared,
            num(d.piIndep, probText(d.piIndep), "live-corr-pi-indep"), T.liveD]
          : mode === "shared"
            ? [T.sharedZeroA, corrN, T.sharedB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), "."]
            : d.corr === 0
              ? [T.liveZeroA, corrN, T.liveZeroB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), "."]
              : [T.liveA, corrN, T.liveB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), T.liveC.hand,
                num(d.piIndep, probText(d.piIndep), "live-corr-pi-indep"), T.liveD];
        const side = d.gap === 0
          ? [" ", T.sideEqual, piName(h, "AB"), T.sideHalf]
          : [T.sideA, d.gap > 0 ? T.sideAbove : T.sideBelow, piName(h, "AB"), d.gap > 0 ? T.sideStaysAbove : T.sideStaysBelow];
        ctx.readout.set([...first, ...side]);
      }

      return {
        render(state) {
          source.set(state.source);
          units.set(state);
          corr.set(state.corr);
          for (const [k, s] of modelSliders) s.set(state[k]);
          const mode = state.source;
          const wantSet = mode === "shared" ? sharedSet : handSet;
          if (shownSet !== wantSet) { shownSet.replaceWith(wantSet); shownSet = wantSet; }
          modelStep.hidden = mode !== "shared";
          const fmt = FORMATS[mode];
          const p = posteriorOf(state);
          const d = pairOf(p);
          // the key names the curves the figures draw: at corr 0 only the independent one
          keyCorr.hidden = d.corr === 0;
          keyCorrWords.textContent = `${T.keyCorr[mode]}${T.keyCorrParts}`;
          keyIndepWords.textContent = d.corr === 0 ? T.keyIndep.hand : T.keyIndep[mode];
          drawPairTitle(d, mode);
          drawPair(pairSlot, d, fmt, mode);
          drawDiff(diffSlot, d, fmt, mode);
          drawUnits(unitsSlot, d, fmt);
          marginalScope.textContent = mode === "shared"
            ? "In the shared-prior model, changing the prior can change each unit’s posterior spread."
            : "The correlation slider changes the joint posterior; the two marginal means and spreads stay fixed.";
          drawResult(d, fmt, mode);
          if (mode === "shared") drawModel(p.model);
          else model.replaceChildren();
          const w = workedTex(d, fmt);
          renderTex(worked, w.tex, { display: true, nums: w.raws });
          readout(d, fmt);
          const cap = captionNode(ctx, "teaching-posterior");
          ctx.caption.replaceChildren(...(mode === "shared" ? [cap, ". ", h("span", { text: T.gloss })] : [cap]));
        },
      };
    },
  });
}
