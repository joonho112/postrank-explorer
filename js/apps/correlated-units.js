// correlated-units (app 1.9): "When two posteriors move together" (Frame v2 Targeted migration).
// Two jointly normal posteriors whose true values may be correlated: the joint posterior of (θ_A, θ_B) as a .90
// contour ellipse with θ_A > θ_B shaded below the 45° equality diagonal, paired on the primary stage with the
// posterior density of θ_A − θ_B (with correlation vs. independent). Marginal unit curves, exact 6-decimal summaries,
// and formulas live in progressive Data and Method disclosures while preserving 100% of keys, presets, exports, and
// audit hooks. Leaves ../shared/domain/two-units.js 100% untouched.

import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import {
  formatDecimal,
  formatProb,
  formatReadoutEst,
  formatReadoutProb,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import { normalPdf, normalPosterior, pairDifference, sharedMeanPosterior } from "../pr-core.js";
import {
  CONFIG as TWO,
  CSS as TWO_CSS,
  densityPoints,
  diffLabel,
  diffMarks,
  paddedDomain,
  piName,
  plotWidth,
  probTex,
  probText,
  topMarks,
  unitControls,
  unitKeys,
} from "../shared/domain/two-units.js";

export const CONFIG = Object.freeze({
  name: "correlated-units",
  label: "When two posteriors move together: the posterior of the pair and the probability that A's true value is larger",
  className: "prx-two-units cu",
  corr: Object.freeze({ min: -0.95, max: 0.95, step: 0.05, value: 0.5 }),
  source: Object.freeze({ values: Object.freeze(["hand", "shared"]), value: "hand" }),
  model: Object.freeze({
    estimate: Object.freeze({ min: -2, max: 2, step: 0.01 }),
    se: Object.freeze({ min: 0.05, max: 1, step: 0.01 }),
    setting: Object.freeze({ yA: 0.3, seA: 0.2, yB: 0.1, seB: 0.2 }),
    priorSd: Object.freeze({ min: 0.05, max: 1, step: 0.01, value: 0.1 }),
    meanSd: Object.freeze({ min: 0, max: 1, step: 0.01, value: 0.5 }),
    center: 0,
  }),
  level: 0.9,
  ellipse: Object.freeze({ points: 181 }),
  digits: Object.freeze({ gap: 2, sd: 3, z: 3, computed: 3, shrink: 3, variance: 4, exact: 6 }),
  chart: Object.freeze({
    heightDiffDesktop: 210,
    heightDiffCompact: 136,
    marginTop: 26,
    marginBottom: 34,
    marginLeft: 44,
    marginRight: 20,
    yTicks: 3,
    line: 2,
    thin: 1.5,
    dot: "2,3",
    halo: 3,
    labelDy: -10,
    shoulder: 1.45,
    shoulderDx: 6,
    pair: Object.freeze({
      marginTop: 26,
      marginBottom: 38,
      marginLeft: 44,
      marginRight: 16,
      corner: 0.06,
      cross: 7,
      kbInset: 0.16,
      ticks: 6,
      wash: 0.16,
      reach: 3.5,
      steps: 10,
      labelBox: Object.freeze({ width: 32, height: 22, margin: 4 }),
    }),
    areaDx: 0.06,
  }),
  text: Object.freeze({
    sourceLabel: "Posterior",
    sourceHand: "Set by hand",
    sourceShared: "From a shared prior mean",
    pairLegend: "The pair (A, B)",
    corrLabel: "Correlation ρ",
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
    settingsTitle: "Settings",
    dataTitle: "Data, marginals and exact values",
    methodTitle: "Method and formulas",
    // panel titles
    pairTitle: "The posterior of the pair (A, B)",
    unitsTitle: "Each unit's posterior",
    diffTitle: "The difference A minus B",
    exactTableCaption: "Exact posterior summaries and direction probabilities",
    // pair figure
    xPair: "True value of A",
    yPair: "True value of B",
    // compact stage legend
    keyCorr: Object.freeze({ hand: "with the chosen correlation", shared: "with the shared prior mean's correlation" }),
    keyCorrParts: " (ellipse; difference)",
    keyIndep: Object.freeze({ hand: "independent (dotted)", shared: "taken as independent (dotted)" }),
    keyLine: "equal values",
    keyMeans: "posterior means",
    keyRegionA: "A larger (",
    keyRegionB: ")",
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
    rowIndep: Object.freeze({ hand: "independent", shared: "taken as independent" }),
    kbPair: "The posterior of the pair: the arrow keys read its center and the probability on each side of the line where the two true values are equal.",
    kbCenterA: "Center: posterior means ",
    kbCenterB: " (A) and ",
    kbCenterC: " (B), SDs ",
    kbCenterD: " and ",
    kbCenterE: ", correlation ",
    kbBelow: "Shaded region below the line, where A's true value is larger: probability ",
    kbAbove: "Region above the line, where B's true value is larger: probability ",
    // each unit's posterior
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
    // difference density
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
    // compact result strip under difference chart
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
    // formulas in Method disclosure
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
    // concise v2 readout (25-31 words, 3 sig figs)
    liveA: "Correlation ",
    liveB: " gives ",
    liveC: Object.freeze({ hand: " (independent: ", shared: " (taken as independent: " }),
    liveD: ").",
    liveZeroA: "Correlation ",
    liveZeroB: " gives the independent ",
    sharedA: "The shared prior mean gives correlation ",
    sharedB: " and ",
    sharedZeroA: "With a known prior mean, correlation is ",
    sideA: " Under joint normality, with A's mean ",
    sideAbove: "above B's, ",
    sideBelow: "below B's, ",
    sideEqual: "Under joint normality, with equal means, ",
    sideStaysAbove: " stays above one half at every correlation.",
    sideStaysBelow: " stays below one half at every correlation.",
    sideHalf: " is one half at every correlation.",
    gloss: "Uncertainty about the shared prior mean gives the two posterior values their dependence.",
  }),
  tex: Object.freeze({
    sdDiff: "\\mathrm{SD}_{A-B}",
    meanA: "\\mathrm{mean}_A",
    meanB: "\\mathrm{mean}_B",
    sdA: "\\mathrm{SD}_A",
    sdB: "\\mathrm{SD}_B",
    corr: "\\mathrm{corr}",
    priorSd: "\\mathrm{prior}\\,\\mathrm{SD}",
    se: (u) => `\\mathrm{SE}_${u}`,
    shrink: (u) => `k_${u}`,
    v: "v",
    regionAB: "\\pi_{AB}",
    regionBA: "\\pi_{BA}",
  }),
  bounds: "symbols",
  boundWords: /^(?:above|below) /,
});

const T = CONFIG.text;
const C = CONFIG.chart;
const X = CONFIG.tex;
const M = CONFIG.model;
const SVG_NS = "http://www.w3.org/2000/svg";
const NBSP = " ";

/** Fixed-decimal formatter guarded against rounding small non-zero numbers to bare zero. */
function safeDec(digits) {
  const floor = 0.5 * 10 ** -digits;
  return (x) => {
    if (x === 0) return "0";
    if (Math.abs(x) < floor) return formatSci(x, { sig: 3 });
    return formatDecimal(x, { digits });
  };
}

/** Open-interval 3-sig-fig probability for jointly normal posteriors strictly inside (0, 1) (CP-1.2, S1-03). */
function readoutProbOpen(x) {
  if (x <= 0) return "below .001";
  if (x >= 1) return "above .999";
  return formatReadoutProb(x);
}

/** Display rules by how the posterior was set: settings when set by hand; 3-sig-fig / safe-decimal when computed. */
const FORMATS = Object.freeze({
  hand: Object.freeze({
    mean: (x) => (x === 0 ? "0" : formatSetting(x)),
    sd: formatSetting,
    corr: (x) => (x === 0 ? "0" : formatSetting(x)),
    gap: safeDec(CONFIG.digits.gap),
    readoutCorr: (x) => (x === 0 ? formatSetting(0) : formatSetting(x)),
  }),
  shared: Object.freeze({
    mean: safeDec(CONFIG.digits.computed),
    sd: safeDec(CONFIG.digits.computed),
    corr: safeDec(CONFIG.digits.computed),
    gap: safeDec(CONFIG.digits.computed),
    readoutCorr: (x) => (x === 0 ? formatSetting(0) : formatReadoutEst(x)),
  }),
});
const fmtSdFixed = safeDec(CONFIG.digits.sd);
const fmtZFixed = safeDec(CONFIG.digits.z);

export const CSS = `${TWO_CSS}
.cu.prx-widget[data-prx-frame="v2"] .prx-controls {
  flex: 1 1 14rem;
}
.cu.prx-widget[data-prx-frame="v2"] .prx-controls > .prx-slider {
  flex: 1 1 14rem;
  max-width: 22rem;
}
.cu .cu-settings-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
}
.cu .cu-source {
  flex: 0 0 auto;
}
.cu .cu-set {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  width: 100%;
  min-width: 0;
}
.cu .cu-set > .prx-two-units-unit {
  flex: 1 1 14.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: 0.35rem 0.75rem;
  padding: 0.25rem 0.65rem 0.5rem;
}
.cu .cu-set > .prx-two-units-unit > legend {
  grid-column: 1 / -1;
}
.cu .cu-set > .prx-two-units-unit > .prx-slider + .prx-slider {
  margin-top: 0;
}
.cu .cu-bounds-hint {
  flex: 1 1 100%;
  margin: 0;
}
/* Primary stage: PR-01 reset of legacy grid-area rules so page@1280, page@375, and embed@1280 render at 1:1 scale */
.cu.prx-widget[data-prx-frame="v2"] .prx-stage {
  container-type: inline-size;
}
.cu .prx-stage .cu-figs {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem 1.25rem;
  align-items: start;
}
.cu .prx-stage .cu-fig,
.cu .prx-stage .cu-pair,
.cu .prx-stage .cu-diff,
.cu .prx-stage .cu-key,
.cu .prx-stage .prx-two-units-panel {
  grid-area: auto;
  min-width: 0;
}
.cu .prx-stage .cu-pair {
  max-width: 15rem;
}
@container (min-width: 44rem) {
  .cu .prx-stage .cu-figs {
    grid-template-columns: minmax(0, 22.5rem) minmax(0, 1fr);
  }
  .cu .prx-stage .cu-pair {
    max-width: 22.5rem;
  }
  .cu .prx-stage .cu-key {
    grid-column: 1 / -1;
  }
}
.cu .prx-stage .cu-key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.9rem;
  margin: 0;
  padding: 0.3rem 0.1rem 0.05rem;
  border-top: 1px solid var(--prx-border);
  font-size: 0.8125rem;
  line-height: 1.35;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.cu .cu-key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
}
.cu .cu-line {
  position: relative;
  display: inline-block;
  flex: none;
  width: 1.45rem;
  height: 0.85rem;
}
.cu .cu-line::before {
  content: "";
  position: absolute;
  left: 0.08rem;
  right: 0.08rem;
  top: calc(50% - 1px);
  border-top: 2px solid var(--prx-post);
}
.cu .cu-line-dot::before { border-top: 2px dotted var(--prx-post); }
.cu .cu-line-axis::before { border-top-color: var(--prx-plot-axis); }
.cu .cu-line-svg {
  display: inline-block;
  flex: none;
  width: 1.45rem;
  height: 0.6rem;
  overflow: visible;
}
.cu .cu-line-svg line { stroke: var(--prx-post); stroke-width: 2; }
.cu .cu-plus {
  display: inline-block;
  flex: none;
  width: 0.9rem;
  text-align: center;
  font-weight: 700;
  color: var(--prx-post);
}
.cu .cu-region { background: var(--prx-blues-3); }
.cu .prx-stage .cu-result {
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.65rem;
  background: var(--prx-bg-sunken);
  color: var(--prx-plot-fg);
  border-radius: var(--prx-radius);
  font-size: 0.84375rem;
  line-height: 1.38;
  font-variant-numeric: tabular-nums;
}
.cu .cu-data-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}
.cu .cu-units-card.prx-light-panel {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.cu .prx-disclosure-body .prx-two-units-formula {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.cu .prx-two-units-formula-grid > .cu-model { grid-column: 1 / -1; }
.cu .cu-model-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.25rem 1.5rem;
  align-items: center;
}
@container (min-width: 44rem) {
  .cu .prx-two-units-formula-grid > .prx-two-units-step:last-child { grid-column: auto; }
  .cu .prx-two-units-formula-grid > .cu-model { grid-column: 1 / -1; }
  .cu .cu-model-body { grid-template-columns: minmax(0, auto) minmax(0, 1fr); }
}
.cu .cu-model[hidden] { display: none; }
@media (max-width: 30em) {
  .cu.prx-widget[data-prx-frame="v2"] { padding: 0.4rem 0.5rem 0.35rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.4rem; margin-bottom: 0.25rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .cu.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.14rem 0.44rem; font-size: 0.8125rem; }
  .cu.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.32rem; padding: 0.24rem 0.45rem; font-size: 0.875rem; line-height: 1.32; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.38rem 0.45rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-stage .cu-figs { gap: 0.45rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-stage .prx-panel-title { margin-bottom: 0.15rem; font-size: 0.875rem; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-stage .cu-result { margin-top: 0.2rem; padding: 0.25rem 0.45rem; font-size: 0.8125rem; line-height: 1.3; }
  .cu.prx-widget[data-prx-frame="v2"] .prx-stage .cu-key { padding-top: 0.2rem; gap: 0.14rem 0.6rem; font-size: 0.78rem; }
  .cu.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.4rem; gap: 0.3rem; }
  .cu.prx-widget[data-prx-frame="v2"] > .prx-caption { margin-top: 0.25rem; }
}
`;

// ---------------------------------------------------------------------------------------------- computing

/**
 * The posterior of (θ_A, θ_B) under the shared-prior-mean model: { shrinkA, shrinkB, meanOfMean, variance, muA, sdA,
 * muB, sdB, corr }. Uncertain prior mean (meanSd > 0): sharedMeanPosterior. Known prior mean (meanSd = 0): independent
 * normalPosterior around M.center with correlation 0.
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
 * difference θ_A − θ_B with corr and independent (engine pairDifference), and π_BA from the reverse pair.
 */
export function pairOf(p) {
  const d = pairDifference(p.muA, p.sdA, p.muB, p.sdB, { corr: p.corr });
  const indep = pairDifference(p.muA, p.sdA, p.muB, p.sdB);
  return {
    ...p, gap: d.mean, sd: d.sd, sdIndep: indep.sd, z: d.z, zIndep: indep.z,
    pi: d.pi,
    piReverse: pairDifference(p.muB, p.sdB, p.muA, p.sdA, { corr: p.corr }).pi,
    piIndep: indep.pi,
    piIndepReverse: pairDifference(p.muB, p.sdB, p.muA, p.sdA).pi,
  };
}

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
 * The same ellipse as vertical slices { x, y1, y2 } (for a filled area).
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

function unitDomain(p) {
  const reach = TWO.grid.reach;
  return paddedDomain(Math.min(p.muA - reach * p.sdA, p.muB - reach * p.sdB), Math.max(p.muA + reach * p.sdA, p.muB + reach * p.sdB));
}

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

function insideEllipse({ muA, sdA, muB, sdB, corr }, x, y, level = CONFIG.level) {
  const a = (x - muA) / sdA;
  const b = (y - muB) / sdB;
  return (a * a - 2 * corr * a * b + b * b) / (1 - corr * corr) <= -2 * Math.log(1 - level);
}

function regionLabels(d, [lo, hi], inner, ellipses) {
  const G = C.pair;
  const span = hi - lo;
  const px = span / Math.max(1, inner);
  const w = G.labelBox.width * px;
  const hgt = G.labelBox.height * px;
  const m = G.labelBox.margin * px;
  const c = G.corner * span;
  const mid = (lo + hi) / 2;
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

const paren = (t) => `\\left(${t}\\right)`;

function generalTex() {
  const f = formulaNums();
  const post = (t) => `\\class{${TWO.tex.post}}{${t}}`;
  const tex = `\\begin{aligned}${TWO.tex.piAB} &= \\Phi\\left(\\frac{${post(X.meanA)} - ${post(X.meanB)}}{${X.sdDiff}}\\right), \\\\ `
    + `${X.sdDiff}^{2} &= ${post(X.sdA)}^{2} + ${post(X.sdB)}^{2} - ${f.num(2, "2")}\\,${X.corr}\\,${post(X.sdA)}\\,${post(X.sdB)}\\end{aligned}`;
  return { tex, raws: f.raws };
}

/**
 * Worked formula at one setting d = pairOf(...): preserves exact 11 <mtext> indices (0..10) expected by
 * verification/readouts/correlated-units.json while protecting non-zero values from bare-zero rounding.
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
  const sd = f.num(d.sd, fmtSdFixed(d.sd));
  const gap = f.num(d.gap, fmt.gap(d.gap));
  const sd2 = f.num(d.sd, fmtSdFixed(d.sd));
  const z = f.num(d.z, fmtZFixed(d.z));
  const tex = `\\begin{aligned}${X.sdDiff}^{2} &= ${sA}^{2} + ${sB}^{2} \\\\ &\\quad - ${two}\\,${paren(corr)}${paren(sA2)}${paren(sB2)} = ${sd}^{2} \\\\ `
    + `${TWO.tex.piAB} &= \\Phi\\left(\\frac{${gap}}{${sd2}}\\right) = \\Phi(${z}) ${probTex(f, d.pi)}\\end{aligned}`;
  return { tex, raws: f.raws };
}

function modelTex(m) {
  const f = formulaNums();
  const fmtShrink = safeDec(CONFIG.digits.shrink);
  const fmtComp = safeDec(CONFIG.digits.computed);
  const shrink = (x) => f.num(x, fmtShrink(x));
  const one = () => f.num(1, "1");
  const post = (t) => `\\class{${TWO.tex.post}}{${t}}`;
  const tex = `\\begin{aligned}${X.shrink("i")} &= \\frac{${X.priorSd}^{2}}{${X.priorSd}^{2} + ${X.se("i")}^{2}}:\\quad `
    + `${X.shrink("A")} = ${shrink(m.shrinkA)},\\; ${X.shrink("B")} = ${shrink(m.shrinkB)} \\\\ `
    + `${X.corr} &= \\frac{\\left(${one()} - ${X.shrink("A")}\\right)\\left(${one()} - ${X.shrink("B")}\\right)${X.v}}{${post(X.sdA)}\\,${post(X.sdB)}} `
    + `= ${f.num(m.corr, fmtComp(m.corr))}\\end{aligned}`;
  return { tex, raws: f.raws };
}

// ---------------------------------------------------------------------------------------------- figures

const frame = (height) => ({ height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight });
const yAxis = (ymax) => ({ domain: [0, ymax], label: T.yLabel, ticks: C.yTicks });
const halo = (c) => ({ fill: c.plotFg, fontWeight: "bold", stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke" });

/** Primary joint posterior contour/ellipse figure with θ_A = θ_B diagonal. */
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
    x: { domain: [lo, hi], label: T.xPair, ticks: G.ticks },
    y: { domain: [lo, hi], label: T.yPair, ticks: G.ticks },
    marks: (c, P) => [
      P.areaY([{ x: lo, y1: lo, y2: lo }, { x: hi, y1: lo, y2: hi }], { x: "x", y1: "y1", y2: "y2", fill: c.blues[2] }),
      P.line([{ x: lo, y: lo }, { x: hi, y: hi }], { x: "x", y: "y", stroke: c.plotAxis, strokeWidth: C.line }),
      P.areaY(ellipseBand(same ? { ...d, corr: 0 } : d), { x: "x", y1: "y1", y2: "y2", fill: c.post, fillOpacity: G.wash }),
      same ? null : P.line(indep, { x: "x", y: "y", stroke: c.post, strokeWidth: C.thin, strokeDasharray: C.dot }),
      P.line(same ? indep : withCorr, { x: "x", y: "y", stroke: c.post, strokeWidth: C.line, strokeDasharray: same ? C.dot : null }),
      P.dot([{ x: d.muA, y: d.muB }], { x: "x", y: "y", symbol: "plus", r: G.cross / 2, stroke: c.post, strokeWidth: C.thin }),
    ],
    formulas: regionLabels(d, [lo, hi], inner, same ? [indep] : [withCorr, indep]),
    keyboard: {
      // Entry point "above" sits near the top of the square so side-by-side Tab order never jumps upward (B7-B9).
      data: [
        { key: "above", ...above, title: `${T.kbAbove}${probText(d.piReverse)}.` },
        {
          key: "center", x: d.muA, y: d.muB,
          title: `${T.kbCenterA}${fmt.mean(d.muA)}${T.kbCenterB}${fmt.mean(d.muB)}${T.kbCenterC}${fmt.sd(d.sdA)}${T.kbCenterD}${fmt.sd(d.sdB)}${T.kbCenterE}${fmt.corr(d.corr)}.`,
        },
        { key: "below", ...below, title: `${T.kbBelow}${probText(d.pi)}.` },
      ],
      x: "x", y: "y", key: "key", sort: false, label: T.kbPair, title: (p) => p.title,
    },
  });
}

/** Marginal unit curves (in Data disclosure; re-rendered at open width per PR-06 / PR-09). */
function drawUnits(el, d, fmt) {
  const domain = unitDomain(d);
  const ymax = TWO.grid.headroom * normalPdf(0) / Math.min(d.sdA, d.sdB);
  const width = plotWidth(el);
  const geometry = { width, height: TWO.chart.heightTop };
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
    width,
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

/** Difference θ_A − θ_B density paired beside the joint posterior on ctx.stage, with collision-safe direct labels. */
function drawDiff(el, d, fmt, mode) {
  const sdWide = Math.max(d.sd, d.sdIndep);
  const reach = TWO.grid.reach;
  const domain = paddedDomain(Math.min(0, d.gap - reach * sdWide), Math.max(0, d.gap + reach * sdWide));
  const [lo, hi] = domain;
  const ymax = TWO.grid.headroom * normalPdf(0) / Math.min(d.sd, d.sdIndep);
  const width = plotWidth(el);
  const height = width >= 420 ? C.heightDiffDesktop : C.heightDiffCompact;
  const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
  const same = d.corr === 0;
  const indep = densityPoints(d.gap, d.sdIndep, lo, hi, [0, d.gap]);
  const peak = (sd, text) => ({ ...diffLabel({ mean: d.gap, sd }, domain, text), dy: C.labelDy });
  const shoulder = (sd, text) => {
    const estPx = text.length * 7.2 + C.shoulderDx + 6;
    const xRight = d.gap + C.shoulder * sd;
    const pxRight = ((xRight - lo) / (hi - lo)) * innerW;
    // Flip to left shoulder if right shoulder would overflow narrow mobile plot area.
    if (pxRight + estPx > innerW && ((d.gap - C.shoulder * sd - lo) / (hi - lo)) * innerW > estPx) {
      return { x: d.gap - C.shoulder * sd, y: normalPdf(C.shoulder) / sd, text, dx: -C.shoulderDx, dy: C.labelDy, anchor: "end" };
    }
    return { x: xRight, y: normalPdf(C.shoulder) / sd, text, dx: C.shoulderDx, dy: C.labelDy, anchor: "start" };
  };
  const corrTaller = d.sd < d.sdIndep;
  const indepWord = same ? T.independent.hand : T.independent[mode];
  const labels = same ? [peak(d.sdIndep, indepWord)]
    : corrTaller ? [peak(d.sd, T.withCorr), shoulder(d.sdIndep, indepWord)]
      : [peak(d.sdIndep, indepWord), shoulder(d.sd, T.withCorr)];
  const fmtGap = fmt.gap;
  // Entry point "area" sits in the lower half of diffSlot so side-by-side Tab order from pairSlot never jumps up.
  const points = [
    { key: "area", x: Math.min(C.areaDx * (hi - lo), hi / 2), y: 0.3 * ymax, title: `${T.kbArea}${probText(d.pi)}.` },
    ...(same ? [] : [{ key: "with", x: d.gap, y: normalPdf(0) / d.sd, title: `${T.kbWith}${fmtGap(d.gap)}${T.kbSdD}${fmtSdFixed(d.sd)}${T.kbPi}${probText(d.pi)}.` }]),
    { key: "indep", x: d.gap, y: normalPdf(0) / d.sdIndep, title: `${same ? T.kbIndep.hand : T.kbIndep[mode]}${fmtGap(d.gap)}${T.kbSdD}${fmtSdFixed(d.sdIndep)}${T.kbPi}${probText(d.piIndep)}.` },
  ];
  return plot(el, {
    alt: same ? T.altDiff.zero : T.altDiff[mode],
    table: {
      caption: T.tableDiff[mode],
      columns: [
        { label: T.colCase, value: "label" },
        { label: T.colCorr, value: "corr", format: (v) => (v === 0 ? formatSetting(0) : fmt.corr(v)) },
        { label: T.colDiffMean, value: "mean", format: (v) => fmtGap(v) },
        { label: T.colDiffSd, value: "sd", format: (v) => fmtSdFixed(v) },
        { label: T.colPiAB, value: "pi", format: (v) => probText(v) },
      ],
      rows: [
        { label: T.rowCorr[mode], corr: d.corr, mean: d.gap, sd: d.sd, pi: d.pi },
        { label: same ? T.rowIndep.hand : T.rowIndep[mode], corr: 0, mean: d.gap, sd: d.sdIndep, pi: d.piIndep },
      ],
    },
    width,
    ...frame(height),
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
    frame: "v2",
    keys: appKeys(),
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);
      const num = (raw, display, hook) => writer.num(raw, display, hook ? { hook } : undefined);

      // --- toolbar: single primary slider in ctx.controls (Correlation ρ in hand mode; SD of prior mean in shared mode)
      const corr = ctx.slider({
        label: T.corrLabel, ...ctx.key("corr"), onInput: (v) => ctx.set({ corr: v }),
      });
      corr.input.setAttribute("aria-label", T.corrName);
      ctx.primaryControl(corr.root);

      const meanSdPrimary = ctx.slider({
        label: T.meanSd, ...ctx.key("meanSd"), onInput: (v) => ctx.set({ meanSd: v }),
      });
      meanSdPrimary.input.setAttribute("aria-label", T.meanSdName);
      ctx.primaryControl(meanSdPrimary.root);

      let shownPrimary = corr.root;
      ctx.controls.append(shownPrimary);

      // --- secondary controls inside Settings disclosure (mode switch + unit/prior parameters + slider bounds notes)
      const settingsBox = ctx.settingsBox(T.settingsTitle);
      const source = ctx.segmented({
        label: T.sourceLabel, name: "source", className: "cu-source", value: ctx.state.source,
        options: [{ value: "hand", label: T.sourceHand }, { value: "shared", label: T.sourceShared }],
        onChange: (v) => ctx.set({ source: v }),
      });
      const units = unitControls(ctx);
      const corrBoundsNote = h(
        "p",
        { class: "prx-hint cu-bounds-hint" },
        T.corrHintA,
        num(CONFIG.corr.max, formatSetting(CONFIG.corr.max), "corr-max"),
        T.corrHintB,
      );
      const handSet = h("div", { class: "cu-set", "data-prx-source": "hand" }, ...units.roots, corrBoundsNote);

      const modelSliders = [];
      const modelSlider = (key, label, name, hint) => {
        const s = ctx.slider({ label, ...ctx.key(key), onInput: (v) => ctx.set({ [key]: v }), hint });
        s.input.setAttribute("aria-label", name);
        modelSliders.push([key, s]);
        return s.root;
      };
      const modelUnits = TWO.units.map((u) => h(
        "fieldset",
        { class: "prx-control prx-two-units-unit" },
        h("legend", { text: TWO.text.unit[u] }),
        modelSlider(`y${u}`, T.estimate, `${T.estimateName}${u}`),
        modelSlider(`se${u}`, T.se, `${T.seNameA}${u}${T.seNameB}`),
      ));
      const meanSdNote = h(
        "p",
        { class: "prx-hint cu-bounds-hint" },
        T.meanSdHintA,
        ctx.num(M.meanSd.min, formatSetting(M.meanSd.min)),
        T.meanSdHintB,
      );
      const priorSet = h(
        "fieldset",
        { class: "prx-control prx-two-units-unit" },
        h("legend", { text: T.priorLegend }),
        modelSlider("priorSd", T.priorSd, T.priorSdName, T.priorSdHint),
        meanSdNote,
      );
      const sharedSet = h("div", { class: "cu-set", "data-prx-source": "shared" }, ...modelUnits, priorSet);

      let shownSet = handSet;
      settingsBox.body.append(h("div", { class: "cu-settings-stack" }, source.root, shownSet));

      // --- primary stage: joint posterior (A, B) with θ_A = θ_B diagonal + difference density + compact 1-line legend
      ctx.stage.classList.add("prx-two-units-charts");
      const pairSlot = h("div", { class: "prx-two-units-panel" });
      const diffSlot = h("div", { class: "prx-two-units-panel" });
      const keyLine = (cls) => h("span", { class: `cu-line ${cls}`.trim(), "aria-hidden": "true" });
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
      const keyRegion = h(
        "span",
        { class: "cu-key-item" },
        h("span", { class: "prx-swatch cu-region", "aria-hidden": "true" }),
        h("span", {}, T.keyRegionA, piName(h, "AB"), T.keyRegionB),
      );
      const key = ctx.part("legend", h("p", { class: "prx-light-panel cu-key" }, keyCorr, keyIndep, keyEqual, keyMeans, keyRegion));

      const result = h("p", { class: "cu-result" });
      const covTerm = h("p", { "data-prx-evidence": "covariance-term" });
      const title = (text) => ctx.panelTitle(text);
      const pairTitle = title(T.pairTitle);
      const pairSection = h("section", { class: "cu-fig cu-pair", "aria-label": T.pairTitle }, pairTitle, pairSlot);
      const diffSection = h("section", { class: "cu-fig cu-diff", "aria-label": T.diffTitle }, title(T.diffTitle), diffSlot, result, covTerm);
      ctx.stage.append(h("div", { class: "cu-figs" }, pairSection, diffSection, key));

      // --- Data disclosure: marginal unit curves + exact 3-sig-fig & 6-decimal summary table
      const dataBox = ctx.dataBox(T.dataTitle);
      const unitsSlot = h("div", { class: "prx-two-units-panel" });
      const marginalScope = h("p", { class: "prx-two-units-note" });
      const unitsSection = h(
        "section",
        { class: "cu-fig cu-units-card prx-light-panel", "aria-label": T.unitsTitle },
        title(T.unitsTitle),
        unitsSlot,
        marginalScope,
      );
      const exactTableHost = h("div", { class: "cu-exact-table" });
      dataBox.body.append(h("div", { class: "cu-data-stack" }, unitsSection, exactTableHost));

      // --- Method disclosure: shared-prior-mean formulas, general formula + ellipse/equality notes, and worked formula
      const methodBox = ctx.methodBox(T.methodTitle);
      const tex = (name, label) => ctx.scrollRegion(h("div", { class: "prx-two-units-tex", "data-prx-tex": name }), label);
      const model = tex("model", T.regionModel);
      const general = tex("corr-general", T.regionGeneral);
      const worked = tex("corr-worked", T.regionWorked);
      const modelNote = h("p", { class: "prx-two-units-note" });
      const head = (text) => ctx.panelTitle(text, { className: "prx-two-units-head" });
      const gloss = h(
        "p",
        { class: "prx-two-units-note" },
        piName(h, "AB"), T.glossA, h("i", { text: "z" }), T.glossB, ctx.num(0, formatSetting(0)), T.glossC, ctx.num(1, formatSetting(1)),
        T.glossD, h("i", { text: "z" }), T.glossE,
      );
      const claim = h("p", { class: "prx-two-units-note" }, ...T.claim.split("π_AB").flatMap((s, i) => (i ? [piName(h, "AB"), s] : [s])));
      const keyNote = h(
        "p",
        { class: "prx-two-units-note" },
        T.keyLevelA, ctx.num(CONFIG.level, formatSetting(CONFIG.level)), T.keyLevelB,
        piName(h, "BA"), T.keyLevelC, ctx.num(1, formatSetting(1)), T.keyLevelD, piName(h, "AB"), T.keyLevelE,
      );
      const modelStep = h("div", { class: "prx-two-units-step cu-model" }, head(T.modelHead), h("div", { class: "cu-model-body" }, model, modelNote));
      const formula = ctx.part(
        "formula",
        h(
          "div",
          { class: "prx-two-units-formula" },
          h(
            "div",
            { class: "prx-two-units-formula-grid" },
            modelStep,
            h("div", { class: "prx-two-units-step" }, head(T.generalHead), general, gloss, claim, keyNote),
            h("div", { class: "prx-two-units-step" }, head(T.workedHead), worked),
          ),
        ),
      );
      methodBox.body.append(formula);
      const g = generalTex();
      renderTex(general, g.tex, { display: true, nums: g.raws });

      const probAfter = (raw, hookName, plain = " = ") => {
        const s = readoutProbOpen(raw);
        return [CONFIG.boundWords.test(s) ? T.resultIs : plain, num(raw, s, hookName)];
      };
      const probGives = (raw, hookName) => {
        const s = readoutProbOpen(raw);
        return CONFIG.boundWords.test(s) ? [" ", num(raw, s, hookName)] : [" = ", num(raw, s, hookName)];
      };

      function drawResult(d, fmt, mode) {
        const cov = d.corr * d.sdA * d.sdB;
        covTerm.replaceChildren("Cov(A, B) = ", num(cov, formatReadoutEst(cov)),
          ". Its contribution to Var(A − B) is −", num(2, "2"), " Cov(A, B) = ",
          num(-2 * cov || 0, formatReadoutEst(-2 * cov || 0), "stage-covariance-term"), ".");
        const corrN = num(d.corr, fmt.readoutCorr(d.corr), "corr-value");
        if (d.corr === 0) {
          result.replaceChildren(
            T.zeroA, corrN, T.zeroB, num(d.sdIndep, formatReadoutEst(d.sdIndep), "corr-sd"), T.zeroC,
            piName(h, "AB"), ...probAfter(d.pi, "corr-pi"), T.zeroD,
          );
          return;
        }
        result.replaceChildren(
          T.resultA, corrN, T.resultB, num(d.sd, formatReadoutEst(d.sd), "corr-sd"),
          T.resultC[mode], num(d.sdIndep, formatReadoutEst(d.sdIndep), "corr-sd-indep"), T.resultD,
          piName(h, "AB"), ...probAfter(d.pi, "corr-pi"),
          T.resultC[mode], num(d.piIndep, readoutProbOpen(d.piIndep), "corr-pi-indep"), T.resultE,
        );
      }

      function drawPairTitle(d, mode) {
        const indep = d.corr === 0 ? [] : [" (", T.independent[mode], NBSP, num(d.piIndep, readoutProbOpen(d.piIndep), "pair-pi-indep"), ")"];
        pairTitle.replaceChildren(T.pairTitle, ": ", piName(h, "AB"), ...probGives(d.pi, "pair-pi"), ...indep);
      }

      function drawModel(m) {
        const mt = modelTex(m);
        renderTex(model, mt.tex, { display: true, nums: mt.raws });
        const est = (x) => formatReadoutEst(x);
        const shared = m.variance > 0
          ? [
              T.modelNoteVar, h("i", { text: "v" }), " = ", num(m.variance, est(m.variance), "model-variance"),
              T.modelNoteB, num(Math.sqrt(m.variance), est(Math.sqrt(m.variance)), "model-mean-sd"), T.modelNoteC,
            ]
          : [T.modelNoteKnownA, h("i", { text: "v" }), " = ", num(m.variance, formatSetting(m.variance), "model-variance"), T.modelNoteKnownB];
        modelNote.replaceChildren(
          h("i", { text: "k" }), T.modelNoteA, ...shared,
          num(m.muA, est(m.muA), "model-mean-a"), T.modelNoteD, num(m.muB, est(m.muB), "model-mean-b"),
          T.modelNoteE, num(m.sdA, est(m.sdA), "model-sd-a"), T.modelNoteF, num(m.sdB, est(m.sdB), "model-sd-b"), T.modelNoteG,
        );
      }

      function renderExactTable(d, fmt, mode) {
        const exact6 = safeDec(CONFIG.digits.exact);
        const rows = [
          {
            item: "Unit A posterior",
            corr: null,
            mean3: d.muA,
            sd3: d.sdA,
            mean6: d.muA,
            sd6: d.sdA,
            z: null,
            pi: null,
            piExact: null,
          },
          {
            item: "Unit B posterior",
            corr: null,
            mean3: d.muB,
            sd3: d.sdB,
            mean6: d.muB,
            sd6: d.sdB,
            z: null,
            pi: null,
            piExact: null,
          },
          {
            item: `Difference A − B (${T.rowCorr[mode]})`,
            corr: d.corr,
            mean3: d.gap,
            sd3: d.sd,
            mean6: d.gap,
            sd6: d.sd,
            z: d.z,
            pi: d.pi,
            piExact: d.pi,
          },
          {
            item: `Difference A − B (${d.corr === 0 ? T.rowIndep.hand : T.rowIndep[mode]})`,
            corr: 0,
            mean3: d.gap,
            sd3: d.sdIndep,
            mean6: d.gap,
            sd6: d.sdIndep,
            z: d.zIndep,
            pi: d.piIndep,
            piExact: d.piIndep,
          },
        ];
        const tbl = renderDataTable(ctx, {
          caption: T.exactTableCaption,
          label: T.exactTableCaption,
          sticky: 1,
          columns: [
            { label: "Quantity", key: "item", rowHeader: true },
            {
              label: "Correlation ρ",
              key: "corr",
              align: "right",
              render: (v) => (v === null ? "—" : ctx.num(v, fmt.readoutCorr(v))),
            },
            {
              label: "Posterior mean",
              key: "mean3",
              align: "right",
              render: (v) => ctx.num(v, formatReadoutEst(v)),
            },
            {
              label: "Posterior SD",
              key: "sd3",
              align: "right",
              render: (v) => ctx.num(v, formatReadoutEst(v)),
            },
            {
              label: "Gap z",
              key: "z",
              align: "right",
              render: (v) => (v === null ? "—" : ctx.num(v, formatReadoutEst(v))),
            },
            {
              label: "Pr(θ_A > θ_B)",
              key: "pi",
              align: "right",
              render: (v) => (v === null ? "—" : ctx.num(v, readoutProbOpen(v))),
            },
            {
              label: "Exact mean",
              key: "mean6",
              align: "right",
              render: (v) => ctx.num(v, exact6(v)),
            },
            {
              label: "Exact SD",
              key: "sd6",
              align: "right",
              render: (v) => ctx.num(v, exact6(v)),
            },
            {
              label: "Exact Pr(θ_A > θ_B)",
              key: "piExact",
              align: "right",
              render: (v) => (v === null ? "—" : ctx.num(v, formatProb(v, { digits: 6, open: true }))),
            },
          ],
          rows,
        });
        exactTableHost.replaceChildren(tbl);
      }

      function writeReadout(d, fmt) {
        const corrN = num(d.corr, fmt.readoutCorr(d.corr), "live-corr");
        const mode = d.source;
        const first = mode === "shared" && d.corr !== 0
          ? [
              T.sharedA, corrN, T.sharedB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), T.liveC.shared,
              num(d.piIndep, readoutProbOpen(d.piIndep), "live-corr-pi-indep"), T.liveD,
            ]
          : mode === "shared"
            ? [T.sharedZeroA, corrN, T.sharedB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), "."]
            : d.corr === 0
              ? [T.liveZeroA, corrN, T.liveZeroB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), "."]
              : [
                  T.liveA, corrN, T.liveB, piName(h, "AB"), ...probGives(d.pi, "live-corr-pi"), T.liveC.hand,
                  num(d.piIndep, readoutProbOpen(d.piIndep), "live-corr-pi-indep"), T.liveD,
                ];
        const side = d.gap === 0
          ? [" ", T.sideEqual, piName(h, "AB"), T.sideHalf]
          : [T.sideA, d.gap > 0 ? T.sideAbove : T.sideBelow, piName(h, "AB"), d.gap > 0 ? T.sideStaysAbove : T.sideStaysBelow];
        writer.set([...first, ...side]);
      }

      let lastD = null;
      let lastFmt = null;

      return {
        render(state, info) {
          // PR-06 / PR-09: never re-render primary stage or readout on disclosure toggle; redraw secondary SVG in Data at real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && lastD && lastFmt) {
              drawUnits(unitsSlot, lastD, lastFmt);
            }
            return;
          }

          source.set(state.source);
          units.set(state);
          corr.set(state.corr);
          meanSdPrimary.set(state.meanSd);
          for (const [k, s] of modelSliders) s.set(state[k]);

          const mode = state.source;
          const wantPrimary = mode === "shared" ? meanSdPrimary.root : corr.root;
          if (shownPrimary !== wantPrimary) { shownPrimary.replaceWith(wantPrimary); shownPrimary = wantPrimary; }
          const wantSet = mode === "shared" ? sharedSet : handSet;
          if (shownSet !== wantSet) { shownSet.replaceWith(wantSet); shownSet = wantSet; }
          modelStep.hidden = mode !== "shared";

          const fmt = FORMATS[mode];
          const p = posteriorOf(state);
          const d = pairOf(p);
          lastD = d;
          lastFmt = fmt;

          keyCorr.hidden = d.corr === 0;
          keyCorrWords.textContent = `${T.keyCorr[mode]}${T.keyCorrParts}`;
          keyIndepWords.textContent = d.corr === 0 ? T.keyIndep.hand : T.keyIndep[mode];

          drawPairTitle(d, mode);
          drawPair(pairSlot, d, fmt, mode);
          drawDiff(diffSlot, d, fmt, mode);
          drawUnits(unitsSlot, d, fmt);
          renderExactTable(d, fmt, mode);

          marginalScope.textContent = mode === "shared"
            ? "In the shared-prior model, changing the prior can change each unit’s posterior spread."
            : "The correlation slider changes the joint posterior; the two marginal means and spreads stay fixed.";
          drawResult(d, fmt, mode);

          if (mode === "shared") drawModel(p.model);
          else model.replaceChildren();
          const w = workedTex(d, fmt);
          renderTex(worked, w.tex, { display: true, nums: w.raws });

          writeReadout(d, fmt);
          const cap = captionNode(ctx, "teaching-posterior");
          ctx.caption.replaceChildren(...(mode === "shared" ? [cap, ". ", h("span", { text: T.gloss })] : [cap]));
        },
      };
    },
  });
}
