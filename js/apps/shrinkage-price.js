// shrinkage-price (app 1.6): "How much to shrink" (Frame v2 Redesign).
// Preserves all exports (CONFIG, GRID, closedForms, curvesFor, certaintyAt, mountWidget),
// 100% of state keys { priorSd, seed } and catalog presets, all 45 data-prx-readout hooks,
// and leaves ../shared/domain/shrinkage.js untouched.

import { appLink, createWidget, roundTo, stepDecimals, uid } from "../shared/base.js";
import { numText, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatReadoutEst,
  formatReadoutExpected,
  formatReadoutRisk,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  drawLeague,
  errorArray,
  expectedMisorderedPairs,
  expectedSquaredDistance,
  fartherCount,
  league30,
  meanSquaredDistance,
  misorderedPairs,
  normalPosterior,
  pairCertainty,
  pairCount,
} from "../pr-core.js";
import { CONFIG as SH, compute, valueDomain } from "../shared/domain/shrinkage.js";

export const CONFIG = Object.freeze({
  name: "shrinkage-price",
  label: "How much to shrink: the simulated league's distance to the true values and its pair probabilities at every prior SD",
  title: "The simulated league at every prior SD",
  className: "prx-sp",
  priorSd: Object.freeze({ min: 0.01, max: 1, step: 0.01, value: 0.15 }),
  priorMean: SH.priorMean,
  seed: SH.seed,
  thresholds: Object.freeze([0.9, 0.99]),
  compare: Object.freeze({ narrow: 0.05, wide: 0.45 }),
  fineStep: 0.001,
  memo: 6,
  digits: Object.freeze({ mse: 4, spread: 3 }),
  curve: Object.freeze({
    height: 196,
    heightWide: 218,
    primaryDesktopHeight: 358,
    primaryMobileHeight: 224,
    marginTop: 28,
    marginRight: 16,
    primaryMarginRightDesktop: 132,
    primaryMarginRightMobile: 96,
    marginBottom: 40,
    marginLeft: 48,
    ticks: 4,
    mantissas: Object.freeze([1, 2, 5]),
    line: 2.1,
    ref: 1.6,
    dash: "6,4",
    dotted: "1.5,3",
    spreadDash: "4,3",
    chosen: 1.35,
    dot: 4.8,
    dotRim: 1.5,
    pad: 0.06,
    defaultWidth: 560,
    label: Object.freeze({ dx: 8, minGapPx: 17, height: 15, halo: 3.2, char: 7.6, edge: 6 }),
  }),
  text: Object.freeze({
    sliderLabel: SH.text.sliderLabel,
    sliderHint: SH.text.sliderHint,
    seedLabel: "Seed of the draw",
    seedHint: "A seed, a whole number, fixes the noise of a draw, so the same seed always gives the same draw. The curves over many draws do not depend on it.",
    keyPost: "posterior means",
    keyEst: "the estimates (no pull: a flat prior)",
    keyDraw: "this draw",
    keyClosed: "over many draws (closed form)",
    keyClosedLong: "expected over many draws of the estimates, with these true values (closed form)",
    keySpread: "the true spread, {spread} (the SD of the true values)",
    keyChosen: "the chosen prior SD",
    keyLabel: "What the lines of the four panels mean",
    keyCell: "{which}, {line}",
    pickHint: "Click a panel, or press Enter on one of its points, to move the prior SD there.",
    xLabel: "Prior SD (log scale)",
    colPriorSd: "Prior SD",
    estimatesRow: "Estimates (no pull)",
    tipPrior: "Prior SD ",
    distance: Object.freeze({
      title: "Average squared distance to the true values",
      alt: "The average squared distance from the posterior means to the true values along the prior SD, in this draw (solid) and over many draws (dashed), beside the estimates' two levels.",
      table: "Average squared distance to the true values at each prior SD",
      colDraw: "This draw",
      colClosed: "Over many draws (closed form)",
      tipDraw: " in this draw, ",
      tipClosed: " over many draws",
    }),
    order: Object.freeze({
      title: "Pairs ordered against the true order, of {M}",
      value: "At prior SD {ps}: {draw} in this draw, {closed} expected over many draws; the estimates {estDraw} and {estClosed}.",
      note: "Expected over many draws, these pairs are fewest at prior SD {s}: {v}, against {est} for the estimates. Both orders state a direction for all {M} pairs, so the counts are a fair comparison.",
      alt: "The pairs of units the posterior means order against the true order, along the prior SD: in this draw (solid steps) and expected over many draws (dashed), beside the estimates' two levels.",
      table: "Pairs ordered against the true order at each prior SD",
      colDraw: "This draw",
      colClosed: "Expected over many draws (closed form)",
      tipDraw: " pairs in this draw, ",
      tipClosed: " expected over many draws",
    }),
    farther: Object.freeze({
      title: "Units that end farther from their true value than their estimate was, of {n}",
      value: "At prior SD {ps}: {count} in this draw, ringed in the units view below.",
      note: "In this draw the count stays at {settled} from about prior SD {from} on.",
      noteWhole: "In this draw the count is {settled} at every prior SD on the slider.",
      noteWhy: " No prior SD on the slider brings it to {zero}: a unit whose estimate lies between {zero} and its true value moves away from it under any pull toward {zero}.",
      alt: "The number of units whose posterior mean ends farther from its true value than its estimate was, along the prior SD, in this draw.",
      table: "Units that end farther than their estimate at each prior SD",
      col: "Units that end farther",
      tip: " units end farther in this draw",
    }),
    certainty: Object.freeze({
      title: "Pairs with one direction above {t90} or above {t99}, of {M}",
      key: "Solid: above {t90}; dotted: above {t99}.",
      value: "With a flat prior: {f90} above {t90} and {f99} above {t99}.",
      note: "The pairwise probability comes from the posterior distribution of the difference in true values. Under a flat prior, each unit has a normal posterior centered at its estimate, with a standard deviation equal to its SE. The analyst chooses the prior SD or estimates it from the data. postrank takes the resulting posterior as input.",
      alt: "The number of pairs in which the posterior puts one direction above .90 (solid) or above .99 (dotted), along the prior SD, beside the counts under a flat prior.",
      table: "Pairs with one direction above the lower threshold, {t90}, and above the higher, {t99}, at each prior SD",
      colLower: "Above the lower threshold",
      colHigher: "Above the higher threshold",
      tipA: " pairs above ",
      tipB: ", ",
      tipC: " above ",
    }),
    compare: Object.freeze({
      heading: "Too narrow and too wide",
      leadA: "Over many draws, a prior about a third of the true spread ({narrow}) and one about three times it ({wide}) end about as far from the true values: {cN} and {cW}.",
      leadB: " Yet in this draw the posterior puts one direction above {t90} in {sN} pairs under the first and in {sW} under the second.",
      leadC: " These are the posterior's own probabilities; whether such directions are right under the true values is checked in ",
      table: "Two priors and the estimates, against the true values",
      colNarrow: "Too narrow, prior SD {narrow}",
      colWide: "Too wide, prior SD {wide}",
      colEst: "The estimates (a flat prior)",
      rowMse: "Average squared distance, this draw",
      rowClosed: "Average squared distance, over many draws (closed form)",
      rowPairs: "Pairs against the true order, this draw",
      rowExpected: "Pairs against the true order, expected over many draws",
      rowFarther: "Units that end farther than their estimate was",
      rowSure: "Pairs with one direction above {t}",
      noMove: "— (no pull)",
      data: "Data, secondary curves and exact values",
    }),
    league: Object.freeze({
      heading: "The league at prior SD {ps}",
      unitsLabel: "The units of the league at the chosen prior SD",
      direction: "For independent normal posteriors, whatever their SDs, the larger posterior mean is always the more likely direction, so each crossing is a pair whose more likely direction differs from the order of the estimates.",
    }),
  }),
});

const T = CONFIG.text;
const S = SH.text;
const LEAGUE = league30();
const N_UNITS = LEAGUE.ids.length;
const M = pairCount(N_UNITS);
const THETA = Object.freeze(Array.from(LEAGUE.theta));
const SE = Object.freeze(Array.from(LEAGUE.se));

const V2_UNITS = Object.freeze({
  rowPxDesktop: 16.5,
  rowPxMobile: 15,
  headRows: 1.26,
  gapRows: 0.7,
  headDy: 0.9,
  marginTop: 8,
  marginBottom: 40,
  marginLeft: 42,
  marginRight: 16,
  dot: 4.0,
  dotRim: 0.9,
  ring: 7.2,
  ringWidth: 1.45,
  truth: 4.3,
  truthWidth: 1.65,
  line: 1.4,
  headLength: 6.2,
  arrowMinPx: 11.5,
  band: 0.45,
  idDx: -6,
  idSizeDesktop: 12.6,
  idSizeMobile: 12.3,
  headInset: 4,
  headHalo: 4,
  rule: "4,3",
  labelOffset: 35,
  defaultWidth: 560,
});

const V2_ORDER = Object.freeze({
  rowPx: 16.5,
  marginTop: 12,
  marginBottom: 12,
  marginLeft: 44,
  marginRight: 44,
  dot: 3.2,
  line: 1.4,
  idDx: 7,
  fontSize: 12.4,
  dashes: SH.order.dashes,
  defaultWidth: 360,
});

/** The prior SDs on the slider's steps, CONFIG.priorSd.min to max. */
export const GRID = (() => {
  const { min, max, step } = CONFIG.priorSd;
  const d = Math.max(stepDecimals(step), stepDecimals(min));
  return Object.freeze(Array.from({ length: Math.round((max - min) / step) + 1 }, (_, k) => roundTo(min + k * step, d)));
})();

const CSS = `
.prx-sp > .prx-title {
  margin: 0 0 0.28rem;
  font-size: 1rem;
  line-height: 1.25;
}
.prx-sp .prx-controls > .prx-slider {
  flex: 1 1 16rem;
  max-width: 24rem;
}
@media (max-width: 30em) {
  .prx-sp.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-sp.prx-widget[data-prx-frame="v2"] > .prx-title { font-size: 0.9rem; margin-bottom: 0.15rem; }
  .prx-sp.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.4rem; margin-bottom: 0.25rem; }
  .prx-sp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-sp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem; }
  .prx-sp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.12rem 0.42rem; font-size: 0.8125rem; }
  .prx-sp.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.35rem; padding: 0.24rem 0.48rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-sp.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.5rem; }
}
.prx-sp .prx-sp-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.25rem;
  align-items: flex-start;
  width: 100%;
}
.prx-sp .prx-sp-seed { flex: 1 1 16rem; max-width: 26rem; }
.prx-sp .prx-sp-seed input[type="number"] { width: 9rem; max-width: 100%; }
.prx-sp .prx-sp-seed .prx-hint { margin: 0.18rem 0 0; }
.prx-sp .prx-stage {
  container-type: inline-size;
}
.prx-sp .prx-stage > * {
  grid-area: auto;
  min-width: 0;
}
.prx-sp .prx-stage .prx-sp-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.2rem 0.85rem;
  margin: 0 0 0.2rem;
  padding: 0 0 0.25rem;
  border-bottom: 1px solid var(--prx-border);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-sp .prx-stage .prx-sp-stage-meta {
  margin: 0;
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-sp .prx-stage .prx-sp-strip {
  display: grid;
  gap: 0.16rem;
  margin: 0.3rem 0 0;
  padding: 0.3rem 0.4rem 0.1rem;
  border-top: 1px solid var(--prx-border);
  font-size: 0.8125rem;
  line-height: 1.35;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-sp .prx-stage .prx-sp-strip > p {
  margin: 0;
}
.prx-sp .prx-sp-data-wrap {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}
.prx-sp .prx-sp-panel,
.prx-sp .prx-sp-units,
.prx-sp .prx-sp-side {
  grid-area: auto;
  min-width: 0;
}
.prx-sp .prx-sp-data-curves,
.prx-sp .prx-sp-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem 1.25rem;
}
@container (min-width: 46rem) {
  .prx-sp .prx-sp-grid { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
}
.prx-sp .prx-sp-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
}
.prx-sp .prx-sp-method-stack > p {
  margin: 0;
}
.prx-sp .prx-sp-prior-hint strong { font-weight: 600; color: var(--prx-fg); }
.prx-sp .prx-sp-keygrid { border-collapse: collapse; margin: 0; font-size: 1em; }
.prx-sp .prx-sp-keygrid th, .prx-sp .prx-sp-keygrid td { padding: 0.1rem 0.75rem 0.1rem 0; border: 0; text-align: left; vertical-align: middle; }
.prx-sp .prx-sp-keygrid thead th { font-weight: 600; }
.prx-sp .prx-sp-keygrid tbody th { font-weight: 400; }
.prx-sp .prx-sp-keygrid td { text-align: center; }
.prx-sp .prx-sp-key-side { display: flex; flex-direction: column; gap: 0.3rem; justify-content: center; }
.prx-sp .prx-sp-heading { margin: 0 0 0.2rem; }
.prx-sp .prx-stage .prx-sp-heading { margin: 0; }
.prx-sp .prx-sp-value { margin: 0 0 0.25rem; font-size: 0.85em; color: var(--prx-fg); }
.prx-sp .prx-sp-note, .prx-sp .prx-sp-lead { margin: 0.25rem 0; font-size: 0.875em; color: var(--prx-fg-muted); }
.prx-sp .prx-sp-lead { color: var(--prx-fg); font-weight: 600; }
.prx-sp .prx-sp-section { margin: 0; }
.prx-sp .prx-sp-pick { margin: 0; }
.prx-sp .prx-sp-curve-chart svg { cursor: pointer; }
.prx-sp .prx-sp-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.25rem 0; font-size: 0.85em; color: var(--prx-fg); }
.prx-sp .prx-sp-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.prx-sp .prx-sp-swatch {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 1.6rem;
  height: 1rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border);
  border-radius: 3px;
}
.prx-sp .prx-sp-swatch::before, .prx-sp .prx-sp-swatch::after { content: ""; position: absolute; }
.prx-sp .prx-sp-line::before { left: 0.15rem; right: 0.15rem; top: calc(50% - 1px); border-top: 2px solid var(--prx-plot-fg); }
.prx-sp .prx-sp-line-post::before { border-top-color: var(--prx-post); }
.prx-sp .prx-sp-line-est::before { border-top-color: var(--prx-est); }
.prx-sp .prx-sp-line-dash::before { border-top-style: dashed; }
.prx-sp .prx-sp-vrule::before { left: calc(50% - 0.75px); top: 0.1rem; bottom: 0.1rem; border-left: 1.5px dashed var(--prx-plot-axis); }
.prx-sp .prx-sp-chosen::before { left: calc(50% - 0.6px); top: 0.05rem; bottom: 0.05rem; border-left: 1.25px solid var(--prx-plot-fg); }
.prx-sp .prx-sp-chosen::after {
  left: 50%;
  top: 50%;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--prx-post);
  box-shadow: 0 0 0 1.5px var(--prx-plot-bg);
  transform: translate(-50%, -50%);
}
.prx-sp .prx-sp-dot::before { left: 50%; top: 50%; width: 0.55rem; height: 0.55rem; border-radius: 50%; transform: translate(-50%, -50%); }
.prx-sp .prx-sp-dot-est::before { background: var(--prx-est); }
.prx-sp .prx-sp-dot-post::before { background: var(--prx-post); }
.prx-sp .prx-sp-arrow::before { left: 0.15rem; right: 0.4rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-sp .prx-sp-arrow::after {
  right: 0.15rem;
  top: calc(50% - 3.5px);
  border-left: 6px solid var(--prx-plot-muted);
  border-top: 3.5px solid transparent;
  border-bottom: 3.5px solid transparent;
}
.prx-sp .prx-sp-rule-line::before { left: calc(50% - 0.75px); top: 0.1rem; bottom: 0.1rem; border-left: 1.5px dashed var(--prx-plot-axis); }
.prx-sp .prx-sp-cross::before {
  content: "×";
  inset: 0;
  font-weight: 700;
  line-height: 1rem;
  text-align: center;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-sp .prx-sp-ring { background: var(--prx-plot-grid); }
.prx-sp .prx-sp-ring::before {
  left: 50%;
  top: 50%;
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid var(--prx-plot-fg);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.prx-sp .prx-sp-ring::after {
  left: 50%;
  top: 50%;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--prx-post);
  transform: translate(-50%, -50%);
}
.prx-sp .prx-sp-size::before { left: 0.15rem; right: 0.15rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-sp .prx-sp-size-medium::before { border-top-style: dashed; }
.prx-sp .prx-sp-size-large::before { top: calc(50% - 1px); border-top: 2px dotted var(--prx-plot-muted); }
.prx-sp .prx-sp-order-heads { display: flex; justify-content: space-between; margin: 0.25rem 0 0; font-size: 0.85em; font-weight: 600; color: var(--prx-fg); }
.prx-sp .prx-sp-order-figure { max-width: 24rem; }
.prx-sp .prx-sp-table-wrap { max-width: 100%; overflow-x: auto; }
.prx-sp .prx-sp-table { border-collapse: collapse; margin: 0.25rem 0; font-size: 0.9em; }
.prx-sp .prx-sp-table caption { caption-side: top; text-align: left; font-weight: 600; color: var(--prx-fg-muted); }
.prx-sp .prx-sp-table th, .prx-sp .prx-sp-table td {
  padding: 0.2rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: right;
  vertical-align: top;
  overflow-wrap: normal;
  word-break: normal;
}
.prx-sp .prx-sp-table th[scope="row"] { text-align: left; font-weight: 400; min-width: 11em; }
.prx-sp .prx-sp-table thead th { font-weight: 600; min-width: 6.5em; }
.prx-sp .prx-sp-gloss { display: inline; font-style: normal; }
@container (max-width: 30rem) {
  .prx-sp .prx-sp-table { font-size: 0.82em; }
  .prx-sp .prx-sp-table th, .prx-sp .prx-sp-table td { padding: 0.2rem 0.25rem; }
  .prx-sp .prx-sp-table th[scope="row"] { min-width: 7em; }
  .prx-sp .prx-sp-table thead th { min-width: 0; }
}
`;

// ---------------------------------------------------------------------------------------------- computing

const lowest = (rows, key) => rows.reduce((a, b) => (b[key] < a[key] ? b : a));

function settledFrom(rows, key) {
  const last = rows[rows.length - 1][key];
  let k = rows.length - 1;
  while (k > 0 && rows[k - 1][key] === last) k -= 1;
  return { value: last, s: rows[k].s, whole: k === 0 };
}

const priorOptions = (s) => ({ priorSd: s, priorMean: CONFIG.priorMean });

let CLOSED = null;
/**
 * Closed-form expected squared distance and expected misordered pairs along GRID,
 * raw-estimate closed forms, lowest grid steps, and fine-grid (.001) minimum.
 */
export function closedForms() {
  if (CLOSED) return CLOSED;
  const theta = THETA.slice();
  const se = SE.slice();
  const rows = GRID.map((s) => ({
    s,
    mse: expectedSquaredDistance(theta, se, priorOptions(s)).mean,
    expected: expectedMisorderedPairs(theta, se, priorOptions(s)),
  }));
  const { min, max } = CONFIG.priorSd;
  const d = stepDecimals(CONFIG.fineStep);
  let fine = null;
  for (let k = 0, n = Math.round((max - min) / CONFIG.fineStep); k <= n; k += 1) {
    const s = roundTo(min + k * CONFIG.fineStep, d);
    const v = expectedSquaredDistance(theta, se, priorOptions(s)).mean;
    if (!fine || v < fine.mse) fine = { s, mse: v };
  }
  CLOSED = Object.freeze({
    rows,
    raw: {
      mse: expectedSquaredDistance(theta, se, priorOptions(Infinity)).mean,
      expected: expectedMisorderedPairs(theta, se, {}),
    },
    lowestMse: lowest(rows, "mse"),
    lowestExpected: lowest(rows, "expected"),
    fine,
  });
  return CLOSED;
}

const certainty = (means, sds) => pairCertainty(errorArray(means, sds), { thresholds: CONFIG.thresholds.slice() }).counts;

function pointAt(est, s) {
  const post = normalPosterior(est, SE.slice(), priorOptions(s));
  const pm = Array.from(post.mean);
  const [sure90, sure99] = certainty(pm, Array.from(post.sd));
  return {
    mse: meanSquaredDistance(pm, THETA),
    pairs: misorderedPairs(pm, THETA).count,
    farther: fartherCount(est, pm, THETA).count,
    sure90,
    sure99,
  };
}

const MEMO = new Map();
/**
 * Curves for one draw (seed) across GRID, memoized for the last CONFIG.memo seeds.
 */
export function curvesFor(seed) {
  if (MEMO.has(seed)) return MEMO.get(seed);
  const closed = closedForms();
  const est = Array.from(drawLeague(seed).estimate);
  const rows = GRID.map((s, k) => ({
    s,
    ...pointAt(est, s),
    closed: closed.rows[k].mse,
    expected: closed.rows[k].expected,
  }));
  const [flat90, flat99] = certainty(est, SE.slice());
  const at = (s) => rows.find((r) => r.s === s);
  const out = Object.freeze({
    seed,
    rows,
    estimates: {
      mse: meanSquaredDistance(est, THETA),
      closed: closed.raw.mse,
      pairs: misorderedPairs(est, THETA).count,
      expected: closed.raw.expected,
      sure90: flat90,
      sure99: flat99,
    },
    lowestMse: lowest(rows, "mse"),
    settled: settledFrom(rows, "farther"),
    fartherMin: Math.min(...rows.map((r) => r.farther)),
    narrow: at(CONFIG.compare.narrow),
    wide: at(CONFIG.compare.wide),
  });
  MEMO.set(seed, out);
  while (MEMO.size > CONFIG.memo) MEMO.delete(MEMO.keys().next().value);
  return out;
}

/** Pair certainty of a 1.5 compute() result r: [above .90, above .99]. */
export const certaintyAt = (r) => certainty(r.units.map((u) => u.pm), r.units.map((u) => u.psd));

// ---------------------------------------------------------------------------------------------- drawing

const fmtSd = (v) => formatSetting(v);
const fmtMse = (v) => formatDecimal(v, { digits: CONFIG.digits.mse });
const fmtSpread = (v) => formatDecimal(v, { digits: CONFIG.digits.spread });

/** Format fixed-decimal continuous table values without bare-zero collapse. */
const formatTableVal = (v, digits = 3) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

const fmtShare2 = (x) => formatTableVal(x, SH.digits.share);
const fmtValue3 = (x) => formatTableVal(x, SH.digits.value);
const fmtSd3 = (x) => formatTableVal(x, SH.digits.sd);
const sizeText = (u) => `${S.groupWord[u.group]} unit (${formatCount(u.size)}${S.obsEach}, SE ${fmtShare2(u.se)})`;

const fill = (template, slots) =>
  template
    .split(/(\{\w+\})/)
    .filter((p) => p !== "")
    .map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (!m || !(m[1] in slots)) return p;
      const v = slots[m[1]];
      return typeof v === "function" ? v() : v;
    });

const words = (template, slots) => template.replace(/\{(\w+)\}/g, (all, k) => (k in slots ? String(slots[k]) : all));

function snapPriorSd(v) {
  const { min, max, step } = CONFIG.priorSd;
  const k = Math.round((Math.min(max, Math.max(min, v)) - min) / step);
  return GRID[Math.min(GRID.length - 1, Math.max(0, k))];
}

function domainOf(rows, keys, refs, { zero = false } = {}) {
  const vals = rows.flatMap((r) => keys.map((k) => r[k])).concat(refs);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return [zero ? 0 : lo - CONFIG.curve.pad * (hi - lo), hi];
}

/**
 * Collision-free labels next to the chosen prior SD dots using placeDirectLabels.
 * Placed strictly inside the inner plot width [marginLeft, width - marginRight] so
 * they never touch right-margin series labels or top reference headers.
 */
function chosenLabels(c, chosen, format, { spread, width, marginLeft, marginRight }) {
  const L = CONFIG.curve.label;
  const { min, max } = CONFIG.priorSd;
  const share = (v) => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
  const rows = chosen.values
    .map((v) => ({ s: chosen.s, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2);
  const plotW = Math.max(1, width - marginLeft - marginRight);
  const x = share(chosen.s) * plotW;
  const need = L.dx + L.edge + L.char * Math.max(...rows.map((r) => format(r.v).length));
  const room = { right: plotW - x, left: x };
  const away = spread > chosen.s ? "left" : "right";
  const other = away === "left" ? "right" : "left";
  const side = room[away] >= need ? away : room[other] >= need ? other : room.right >= room.left ? "right" : "left";
  const right = side === "right";

  const render = (index, scales, values, dims, context, next) => {
    const Y = values.y;
    const at = Array.from(index);
    const minY = dims.marginTop + L.height / 2 + 2;
    const maxY = dims.height - dims.marginBottom - L.height / 2 - 2;
    const seeded = at.map((idx, rank) => ({
      id: idx,
      y: Y[idx] + (at.length > 1 ? (rank === 0 ? -7 : 7) : -7),
      height: L.height,
    }));
    const placed = placeDirectLabels(seeded, { minGapPx: L.minGapPx, minY, maxY });
    for (const item of placed) {
      Y[item.id] = item.y;
    }
    return next(index, scales, values, dims, context);
  };

  return numText(rows, {
    x: "s",
    y: "v",
    value: "v",
    format,
    render,
    lineAnchor: "middle",
    textAnchor: right ? "start" : "end",
    dx: right ? L.dx : -L.dx,
    fill: c.plotFg,
    stroke: c.plotBg,
    strokeWidth: L.halo,
    paintOrder: "stroke",
    fontWeight: 600,
    fontSize: 13,
  });
}

/**
 * Right-margin direct series labels at x = 1 placed via placeDirectLabels.
 */
function directSeriesMarks(c, P, seriesItems) {
  const maxS = GRID[GRID.length - 1];
  const labelDx = 12;
  const rows = seriesItems.map((item, id) => ({ ...item, id, s: maxS }));
  const render = (index, scales, values, dims, context, next) => {
    const Y = values.y;
    const X = values.x;
    const at = Array.from(index);
    const origY = new Map(at.map((idx) => [idx, Y[idx]]));
    const minY = dims.marginTop + 8;
    const maxY = dims.height - dims.marginBottom - 8;
    const placed = placeDirectLabels(
      at.map((idx) => ({ id: idx, y: Y[idx], height: 15 })),
      { minGapPx: 16, minY, maxY },
    );
    for (const item of placed) {
      Y[item.id] = item.y;
    }
    const g = next(index, scales, values, dims, context);
    const doc = g?.ownerDocument;
    if (doc) {
      const ns = "http://www.w3.org/2000/svg";
      for (const idx of at) {
        const y0 = origY.get(idx);
        const y1 = Y[idx];
        const x0 = X[idx] - labelDx;
        const row = rows[idx];
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(y1) || !row) continue;
        const p = doc.createElementNS(ns, "path");
        p.setAttribute("d", `M${(x0 + 2).toFixed(1)},${y0.toFixed(1)}L${(x0 + 5).toFixed(1)},${y0.toFixed(1)}L${(x0 + 9.5).toFixed(1)},${y1.toFixed(1)}`);
        p.setAttribute("fill", "none");
        p.setAttribute("stroke", row.kind === "post" ? c.post : c.est);
        p.setAttribute("stroke-width", "1.15");
        if (!row.solid) p.setAttribute("stroke-dasharray", "2.5,2");
        g.prepend(p);
      }
    }
    return g;
  };

  return P.text(rows, {
    x: "s",
    y: "v",
    text: "label",
    render,
    dx: labelDx,
    textAnchor: "start",
    lineAnchor: "middle",
    fill: (d) => (d.kind === "post" ? c.postText : c.estText),
    fontWeight: (d) => (d.solid ? 600 : 500),
    fontSize: 13,
  });
}

/**
 * Shared curve plotter for the primary MSE stage chart and the three secondary Data curves.
 */
function drawCurves(el, spec) {
  const C = CONFIG.curve;
  const width = Math.max(240, Math.round(spec.width || el.clientWidth || C.defaultWidth));
  const marginLeft = spec.marginLeft ?? C.marginLeft;
  const marginRight = spec.marginRight ?? C.marginRight;
  const marginTop = spec.marginTop ?? C.marginTop;
  const marginBottom = spec.marginBottom ?? C.marginBottom;
  const marker = spec.chosen.values.map((v) => ({ s: spec.chosen.s, v }));

  return plot(el, {
    alt: spec.alt,
    table: spec.table,
    width,
    height: spec.height ?? C.height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    aspect: false,
    x: { type: "log", domain: [GRID[0], GRID[GRID.length - 1]], mantissas: C.mantissas, label: T.xLabel },
    y: { domain: spec.domain, nice: true, ticks: C.ticks, label: null, grid: true },
    marks: (c, P) => [
      P.ruleX([spec.spread], { stroke: c.plotAxis, strokeDasharray: C.spreadDash }),
      ...spec.refs.map((r) => P.ruleY([r.value], { stroke: c.est, strokeWidth: C.ref, strokeDasharray: r.dash ?? undefined })),
      ...spec.lines.map((l) =>
        P.line(spec.rows, {
          x: "s",
          y: l.y,
          stroke: c.post,
          strokeWidth: C.line,
          strokeDasharray: l.dash ?? undefined,
          curve: l.step ? "step" : "linear",
        }),
      ),
      P.ruleX([spec.chosen.s], { stroke: c.plotFg, strokeWidth: C.chosen }),
      P.text([spec.spread], {
        x: (d) => d,
        frameAnchor: "top",
        dy: -9,
        text: () => "True spread",
        fill: c.plotFg,
        stroke: c.plotBg,
        strokeWidth: 3,
        paintOrder: "stroke",
        fontSize: 13,
      }),
      P.dot(marker, { x: "s", y: "v", r: C.dot, fill: c.post, stroke: c.plotBg, strokeWidth: C.dotRim }),
      typeof spec.labels === "function"
        ? chosenLabels(c, spec.chosen, spec.labels, { spread: spec.spread, width, marginLeft, marginRight })
        : null,
      Array.isArray(spec.directSeries) && spec.directSeries.length ? directSeriesMarks(c, P, spec.directSeries) : null,
    ],
    keyboard: {
      data: spec.rows,
      x: "s",
      y: spec.keyboard.y,
      key: "s",
      pointer: Boolean(spec.pointer),
      label: spec.alt,
      title: spec.keyboard.title,
      onFocus: spec.keyboard.onFocus,
    },
  });
}

/** Row layout for the 30-unit league figure inside Data disclosure (>= 15px row pitch, >= 12.3px text). */
function v2RowLayout(units) {
  const U = V2_UNITS;
  const rows = [];
  const heads = [];
  let y = 0;
  SH.groups.forEach((g, k) => {
    if (k) y += U.gapRows;
    y += U.headRows;
    heads.push({ group: g, y: y - U.headDy });
    const members = units.filter((u) => u.group === g).sort((a, b) => b.est - a.est || a.i - b.i);
    for (const u of members) {
      rows.push({ ...u, y });
      y += 1;
    }
  });
  return { rows, heads, top: heads[0].y - U.band, bottom: y - 1 + U.band };
}

/** V2 units figure inside Data disclosure (100% kbd/aria preserved, >= 12.3px text bare-zero-safe table). */
function drawV2Units(el, r, { width } = {}) {
  const U = V2_UNITS;
  const lay = v2RowLayout(r.units);
  const [lo, hi] = valueDomain(r.units);
  const w = Math.max(240, Math.round(width || el.clientWidth || U.defaultWidth));
  const mobile = w < 420;
  const rowPx = mobile ? U.rowPxMobile : U.rowPxDesktop;
  const idSize = mobile ? U.idSizeMobile : U.idSizeDesktop;
  const inner = Math.max(1, w - U.marginLeft - U.marginRight);
  const pxPerUnit = inner / (hi - lo || 1);
  const far = lay.rows.filter((d) => d.farther);
  const px = (d) => Math.abs(d.pm - d.est) * pxPerUnit;

  const columns = [
    { label: S.colUnit, value: "id" },
    { label: S.colSize, value: "size", format: (v) => formatCount(v) },
    { label: S.colSe, value: "se", format: (v) => fmtShare2(v) },
    { label: S.colEstimate, value: "est", format: (v) => fmtValue3(v) },
    { label: S.colShare, value: "share", format: (v) => fmtShare2(v) },
    { label: S.colPostMean, value: "pm", format: (v) => fmtValue3(v) },
    { label: S.colPostSd, value: "psd", format: (v) => fmtSd3(v) },
    { label: S.colTruth, value: "theta", format: (v) => fmtValue3(v) },
    { label: S.colFarther, value: (d) => (d.farther ? S.yes : S.no) },
  ];

  return plot(el, {
    alt: S.unitsAlt + S.unitsAltTruth,
    table: { caption: S.unitsTable, columns, rows: lay.rows },
    width: w,
    height: U.marginTop + U.marginBottom + Math.round((lay.bottom - lay.top) * rowPx),
    marginTop: U.marginTop,
    marginBottom: U.marginBottom,
    marginLeft: U.marginLeft,
    marginRight: U.marginRight,
    aspect: false,
    x: {
      domain: [lo, hi],
      nice: true,
      ticks: mobile ? 5 : 7,
      label: S.xLabel,
      labelAnchor: "center",
      labelArrow: "none",
      labelOffset: U.labelOffset,
    },
    y: { domain: [lay.top, lay.bottom], reverse: true, axis: null },
    marks: (c, P) => [
      P.rect(far, { y1: (d) => d.y - U.band, y2: (d) => d.y + U.band, fill: c.plotGrid }),
      P.ruleX([CONFIG.priorMean], { stroke: c.plotAxis, strokeDasharray: U.rule }),
      P.text(lay.heads, {
        frameAnchor: "left",
        y: "y",
        text: (d) => S.groupHead[d.group],
        dx: -U.marginLeft + U.headInset,
        textAnchor: "start",
        fill: c.plotFg,
        fontWeight: "bold",
        fontSize: mobile ? 12.6 : 13,
        stroke: c.plotBg,
        strokeWidth: U.headHalo,
        paintOrder: "stroke",
      }),
      P.text(lay.rows, {
        frameAnchor: "left",
        y: "y",
        text: "id",
        dx: U.idDx,
        textAnchor: "end",
        fill: c.plotMuted,
        fontSize: idSize,
      }),
      P.link(lay.rows.filter((d) => px(d) < U.arrowMinPx), {
        x1: "est",
        x2: "pm",
        y1: "y",
        y2: "y",
        stroke: c.plotMuted,
        strokeWidth: U.line,
      }),
      P.arrow(lay.rows.filter((d) => px(d) >= U.arrowMinPx), {
        x1: "est",
        x2: "pm",
        y1: "y",
        y2: "y",
        stroke: c.plotMuted,
        strokeWidth: U.line,
        headLength: U.headLength,
        insetEnd: U.dot,
        bend: 0,
      }),
      P.dot(lay.rows, { x: "theta", y: "y", symbol: "times", r: U.truth, stroke: c.plotFg, strokeWidth: U.truthWidth }),
      P.dot(lay.rows, { x: "est", y: "y", r: U.dot, fill: c.est, stroke: c.plotBg, strokeWidth: U.dotRim }),
      P.dot(lay.rows, { x: "pm", y: "y", r: U.dot, fill: c.post, stroke: c.plotBg, strokeWidth: U.dotRim }),
      P.dot(far, { x: "pm", y: "y", r: U.ring, fill: "none", stroke: c.plotFg, strokeWidth: U.ringWidth }),
    ],
    keyboard: {
      data: lay.rows,
      x: "pm",
      y: "y",
      key: "id",
      sort: false,
      label: S.unitsAlt,
      title: (d) => {
        const s = `${d.id}, ${sizeText(d)}: ${S.tipEstimate}${formatDecimal(d.est, { digits: SH.digits.value })}, ${S.tipPosterior}${formatDecimal(d.pm, { digits: SH.digits.value })} (${S.tipKeeps}${formatDecimal(d.share, { digits: SH.digits.share })}); ${S.tipTruth}${formatDecimal(d.theta, { digits: SH.digits.value })}, so ${d.farther ? S.tipFarther : S.tipCloser}`;
        return `${s}.`;
      },
    },
  });
}

/** V2 order slope figure inside Data disclosure (16.5px row pitch, >= 12.4px text, 0 label collisions). */
function drawV2Order(el, r, { width } = {}) {
  const O = V2_ORDER;
  const w = Math.max(220, Math.round(width || el.clientWidth || O.defaultWidth));
  const byRank = r.units.slice().sort((a, b) => a.rankEst - b.rankEst);
  return plot(el, {
    alt: S.orderAlt,
    table: {
      caption: S.orderTable,
      columns: [
        { label: S.colUnit, value: "id" },
        { label: S.colSize, value: "size", format: (v) => formatCount(v) },
        { label: S.colRankEst, value: "rankEst", format: (v) => formatCount(v) },
        { label: S.colRankPost, value: "rankPost", format: (v) => formatCount(v) },
        { label: S.colChanges, value: "changes", format: (v) => formatCount(v) },
      ],
      rows: byRank,
    },
    width: w,
    height: O.marginTop + O.marginBottom + Math.round((r.units.length - 1) * O.rowPx),
    marginTop: O.marginTop,
    marginBottom: O.marginBottom,
    marginLeft: O.marginLeft,
    marginRight: O.marginRight,
    aspect: false,
    x: { domain: [0, 1], axis: null },
    y: { domain: [1, r.units.length], reverse: true, axis: null },
    marks: (c, P) => [
      ...SH.groups.map((g) =>
        P.link(
          r.units.filter((u) => u.group === g),
          {
            x1: 0,
            x2: 1,
            y1: "rankEst",
            y2: "rankPost",
            stroke: c.plotMuted,
            strokeWidth: O.line,
            strokeDasharray: O.dashes[g] ?? undefined,
          },
        ),
      ),
      P.dot(r.units, { x: 0, y: "rankEst", r: O.dot, fill: c.est }),
      P.dot(r.units, { x: 1, y: "rankPost", r: O.dot, fill: c.post }),
      P.text(r.units, { x: 0, y: "rankEst", text: "id", dx: -O.idDx, textAnchor: "end", fill: c.plotMuted, fontSize: O.fontSize }),
      P.text(r.units, { x: 1, y: "rankPost", text: "id", dx: O.idDx, textAnchor: "start", fill: c.plotMuted, fontSize: O.fontSize }),
    ],
    keyboard: {
      data: byRank,
      x: () => 0,
      y: "rankEst",
      key: "id",
      sort: false,
      label: S.orderAlt,
      title: (d) =>
        `${d.id}, ${sizeText(d)}: ${S.tipRank}${formatCount(d.rankEst)}${S.tipByEstimate}${formatCount(d.rankPost)}${S.tipByPosterior}; ${S.tipOrder}${formatCount(d.changes)} ${d.changes === 1 ? S.tipOrderOne : S.tipOrderMany}.`,
    },
  });
}

/** Render visible sticky 30-unit table inside Data disclosure. */
function renderFullUnitDataTable(ctx, slot, r) {
  const lay = v2RowLayout(r.units);
  const val4 = (v) => formatTableVal(v, 4);
  const columns = [
    { key: "id", label: S.colUnit, rowHeader: true, name: true },
    { label: S.colUnits, value: (d) => S.groupName[d.group] },
    { key: "size", label: S.colSize, kind: "count" },
    { key: "se", label: S.colSe, kind: "setting" },
    { key: "est", label: S.colEstimate, format: val4 },
    { key: "share", label: S.colShare, kind: "share" },
    { key: "pm", label: S.colPostMean, format: val4 },
    { key: "psd", label: S.colPostSd, format: val4 },
    { key: "theta", label: S.colTruth, format: val4 },
    { label: S.colFarther, value: (d) => (d.farther ? S.yes : S.no) },
    { key: "rankEst", label: S.colRankEst, kind: "count" },
    { key: "rankPost", label: S.colRankPost, kind: "count" },
    { key: "changes", label: S.colChanges, kind: "count" },
  ];
  const caption = [
    "All ",
    ctx.num(N_UNITS, formatCount(N_UNITS)),
    " units at prior SD ",
    ctx.num(r.priorSd, formatSetting(r.priorSd)),
    " (seed ",
    ctx.num(r.seed, formatSetting(r.seed)),
    ")",
  ];
  slot.replaceChildren(
    renderDataTable(ctx, {
      columns,
      rows: lay.rows,
      caption,
      label: "All thirty simulated league units at the chosen prior SD",
      sticky: 1,
    }),
  );
}

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const hook = (name, raw, display) => w.num(raw, display, { hook: name });
      const num = (raw, display) => ctx.num(raw, display);
      const zero = () => num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 }));
      const sd = (v, name) => (name ? hook(name, v, fmtSd(v)) : num(v, fmtSd(v)));
      const mse4 = (v, name) => (name ? hook(name, v, fmtMse(v)) : num(v, fmtMse(v)));
      const count = (v, name) => (name ? hook(name, v, formatCount(v)) : num(v, formatCount(v)));
      const expected4 = (v, name) => (name ? hook(name, v, formatExpectedCount(v)) : num(v, formatExpectedCount(v)));
      const spreadNum = (v, name) => (name ? hook(name, v, fmtSpread(v)) : num(v, fmtSpread(v)));
      const [t90, t99] = CONFIG.thresholds;
      const th = (t) => () => num(t, fmtSd(t));
      const pairsAll = () => num(M, formatCount(M));

      // --- Primary control (ctx.controls): Prior SD slider
      const prior = ctx.slider({
        label: T.sliderLabel,
        ...ctx.key("priorSd"),
        name: "priorSd",
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      ctx.primaryControl(prior.input);
      ctx.controls.append(prior.root);

      // --- Secondary control (ctx.settingsBox): Seed of the draw + hint
      const seedHintId = uid("prx-sp-seed-hint");
      const seed = ctx.numberInput({
        label: T.seedLabel,
        min: CONFIG.seed.min,
        max: CONFIG.seed.max,
        step: 1,
        value: ctx.state.seed,
        name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      seed.root.classList.add("prx-sp-seed");
      ctx.settingsBox("Settings").body.append(h("div", { class: "prx-sp-settings-grid" }, seed.root));

      // --- Click-to-select helper for log-SD curve panels
      const bindCurveClick = (slot, holder) => {
        ctx.listen(slot, "click", (e) => {
          let s = null;
          if (e.detail === 0) s = holder.focused?.s ?? null;
          else if (holder.chart?.svg) {
            const box = holder.chart.svg.getBoundingClientRect();
            const vb = holder.chart.svg.viewBox?.baseVal;
            const x = holder.chart.scale("x");
            if (box.width > 0 && typeof x?.invert === "function") {
              const px = (e.clientX - box.left) * (vb?.width ? vb.width / box.width : 1);
              s = snapPriorSd(x.invert(px));
            }
          }
          if (Number.isFinite(s) && s !== ctx.state.priorSd) ctx.set({ priorSd: s });
        });
      };

      // --- Primary Stage (ctx.stage): 1-line header + generous MSE U-curve + 2-line companion summary strip
      const distTitle = ctx.panelTitle(T.distance.title, { className: "prx-sp-heading" });
      const stageMeta = h("p", { class: "prx-sp-stage-meta", "data-prx-part": "notes" });
      const stageHead = h("div", { class: "prx-sp-stage-head" }, distTitle, stageMeta);
      const distSlot = ctx.primaryGraphic(h("div", { class: "prx-sp-curve-chart prx-sp-primary-chart" }));
      const pDist = { slot: distSlot, chart: null, focused: null };
      bindCurveClick(distSlot, pDist);

      const stripMinLine = h("p", {});
      const stripAtLine = h("p", { "data-prx-evidence": "prior-loss-benchmark" });
      const stageStrip = h("div", { class: "prx-sp-strip", "data-prx-part": "notes" }, stripMinLine, stripAtLine);
      ctx.stage.append(stageHead, distSlot, stageStrip);

      // --- Data disclosure ("Data, secondary curves and exact values")
      const swatch = (cls) => h("span", { class: `prx-sp-swatch ${cls}`, "aria-hidden": "true" });
      const item = (cls, ...content) => h("span", { class: "prx-sp-item" }, swatch(cls), h("span", {}, ...content));
      const curveKey = h("div", { class: "prx-sp-key", "data-prx-part": "legend", role: "group", "aria-label": T.keyLabel });
      const pickHint = h("p", { class: "prx-sp-note prx-sp-pick", "data-prx-part": "notes", text: T.pickHint });

      const secondaryPanel = (name) => {
        const title = ctx.panelTitle("", { className: "prx-sp-heading" });
        const value = h("p", { class: "prx-sp-value", "data-prx-part": "notes" });
        const extra = h("p", { class: "prx-sp-note", "data-prx-part": "legend" });
        const slot = h("div", { class: "prx-sp-curve-chart" });
        const note = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
        const root = h("section", { class: `prx-sp-panel prx-sp-panel-${name}` }, title, value, extra, slot, note);
        const p = { root, title, value, extra, slot, note, chart: null, focused: null };
        bindCurveClick(slot, p);
        return p;
      };
      const pSure = secondaryPanel("certainty");
      const pOrder = secondaryPanel("order");
      const pFar = secondaryPanel("farther");
      pOrder.extra.hidden = true;
      pFar.extra.hidden = true;
      const dataCurves = h("div", { class: "prx-sp-data-curves" }, pSure.root, pOrder.root, pFar.root);

      const compareLead = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
      const compareTable = h("div", { "data-prx-part": "table" });
      const compareBox = h(
        "section",
        { class: "prx-sp-section prx-sp-compare", "aria-label": T.compare.heading },
        ctx.panelTitle(T.compare.heading, { className: "prx-sp-heading" }),
        compareLead,
        compareTable,
      );

      const leagueHead = ctx.panelTitle("", { className: "prx-sp-heading" });
      const leagueLead = h("p", { class: "prx-sp-lead" });
      const unitsSlot = h("div", { class: "prx-sp-units-chart" });
      const unitsKey = h("div", { class: "prx-sp-key", "data-prx-part": "legend" });
      const sizesNote = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
      const unitsBox = h("section", { class: "prx-sp-units", "aria-label": T.league.unitsLabel }, unitsSlot, unitsKey, sizesNote);

      const orderSlot = h("div", { class: "prx-sp-order-chart" });
      const orderNote = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
      const orderKey = h(
        "div",
        { class: "prx-sp-key", "data-prx-part": "legend" },
        ...[["small", S.keyOrderSmall], ["medium", S.keyOrderMedium], ["large", S.keyOrderLarge]].map(([g, labelText]) =>
          item(`prx-sp-size prx-sp-size-${g}`, labelText),
        ),
      );
      const orderBox = h(
        "section",
        { class: "prx-sp-side", "aria-label": S.orderHeading },
        ctx.panelTitle(S.orderHeading, { className: "prx-sp-heading" }),
        orderNote,
        h(
          "div",
          { class: "prx-sp-order-figure" },
          h("div", { class: "prx-sp-order-heads", "aria-hidden": "true" }, h("span", { text: S.orderLeft }), h("span", { text: S.orderRight })),
          orderSlot,
        ),
        orderKey,
      );
      const leagueBox = h(
        "section",
        { class: "prx-sp-section prx-sp-league" },
        leagueHead,
        leagueLead,
        h("div", { class: "prx-sp-grid" }, unitsBox, orderBox),
      );
      const fullUnitsTableSlot = h("div", { class: "prx-sp-full-units-table" });

      const dataBox = ctx.dataBox(T.compare.data);
      const dataWrap = h(
        "div",
        { class: "prx-sp-data-wrap" },
        h("div", {}, curveKey, pickHint),
        dataCurves,
        compareBox,
        leagueBox,
        fullUnitsTableSlot,
      );
      dataBox.body.append(dataWrap);

      // --- Method disclosure ("Method and details")
      const priorHint = h("span", { id: uid("prx-sp-prior") }, ...fill(T.sliderHint, { zero }));
      prior.input.setAttribute("aria-describedby", priorHint.id);
      const priorMethodNote = h(
        "p",
        { class: "prx-sp-note prx-sp-prior-hint", "data-prx-part": "notes" },
        h("strong", { text: `${T.sliderLabel}. ` }),
        priorHint,
      );
      const certaintyMethodNote = h("p", { class: "prx-sp-note", "data-prx-part": "notes", text: T.certainty.note });
      const directionMethodNote = h("p", { class: "prx-sp-note", "data-prx-part": "notes", text: T.league.direction });
      const sourceNote = h("p", { class: "prx-sp-note prx-sp-source", "data-prx-part": "notes" });

      ctx.methodBox("Method and details").body.append(
        h("div", { class: "prx-sp-method-stack" }, priorMethodNote, certaintyMethodNote, directionMethodNote, sourceNote),
      );

      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), ". ", h("span", { class: "prx-sp-gloss", text: S.gloss }));

      unitsKey.replaceChildren(
        item("prx-sp-dot prx-sp-dot-est", S.keyEstimate),
        item("prx-sp-dot prx-sp-dot-post", S.keyPosterior),
        item("prx-sp-arrow", S.keyArrow),
        item("prx-sp-rule-line", S.keyPrior, zero()),
        item("prx-sp-cross", S.keyTruth),
        item("prx-sp-ring", S.keyFarther),
      );
      {
        const [s, m, l] = SH.groups.map((g) => LEAGUE.ids.findIndex((_, i) => LEAGUE.group[i] === g));
        const n = (i) => num(LEAGUE.size[i], formatCount(LEAGUE.size[i]));
        const se = (i) => num(LEAGUE.se[i], fmtShare2(LEAGUE.se[i]));
        sizesNote.replaceChildren(
          S.sizesA, n(s), S.sizesB, se(s),
          S.sizesMedium, n(m), S.sizesComma, se(m),
          S.sizesLarge, n(l), S.sizesComma, se(l), ".",
        );
      }

      const wrapTable = (table, label) => ctx.scrollRegion(h("div", { class: "prx-sp-table-wrap" }, table), label);

      function drawKey(spread) {
        const cell = (cls, which, line) =>
          h("td", {}, swatch(cls), h("span", { class: "prx-sr-only", text: words(T.keyCell, { which, line }) }));
        const grid = h(
          "table",
          { class: "prx-sp-keygrid" },
          h("caption", { class: "prx-sr-only", text: T.keyLabel }),
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("td", {}),
              h("th", { scope: "col", text: T.keyDraw }),
              h("th", { scope: "col", text: T.keyClosed, title: T.keyClosedLong }),
            ),
          ),
          h(
            "tbody",
            {},
            h(
              "tr",
              {},
              h("th", { scope: "row", text: T.keyPost }),
              cell("prx-sp-line prx-sp-line-post", T.keyPost, T.keyDraw),
              cell("prx-sp-line prx-sp-line-post prx-sp-line-dash", T.keyPost, T.keyClosed),
            ),
            h(
              "tr",
              {},
              h("th", { scope: "row", text: T.keyEst }),
              cell("prx-sp-line prx-sp-line-est", T.keyEst, T.keyDraw),
              cell("prx-sp-line prx-sp-line-est prx-sp-line-dash", T.keyEst, T.keyClosed),
            ),
          ),
        );
        curveKey.replaceChildren(
          grid,
          h(
            "span",
            { class: "prx-sp-key-side" },
            item("prx-sp-vrule", ...fill(T.keySpread, { spread: () => spreadNum(spread) })),
            item("prx-sp-chosen", T.keyChosen),
          ),
        );
      }

      function drawPrimaryStage(state, cv, r, sure) {
        const C = CONFIG.curve;
        const closed = closedForms();
        const E = cv.estimates;
        const D = T.distance;
        const spread = r.spreadTruth;
        const stageW = Math.max(260, Math.round(distSlot.clientWidth || ctx.stage.clientWidth || ctx.width() || C.defaultWidth));
        const mobile = stageW < 480;
        const marginRight = mobile ? C.primaryMarginRightMobile : C.primaryMarginRightDesktop;
        const height = Math.max(C.primaryMobileHeight, Math.min(C.primaryDesktopHeight, Math.round(stageW * 0.42)));
        const last = cv.rows[cv.rows.length - 1];
        const tableRows = [...cv.rows, { s: T.estimatesRow, mse: E.mse, closed: E.closed }];
        const sdCol = { label: T.colPriorSd, value: "s", format: (v) => (typeof v === "number" ? fmtSd(v) : v) };

        stageMeta.replaceChildren(
          w.count(N_UNITS),
          " units · seed ",
          w.setting(state.seed, { hook: "seed" }),
        );

        pDist.chart = drawCurves(distSlot, {
          width: stageW,
          height,
          marginRight,
          rows: cv.rows,
          spread,
          lines: [{ y: "mse" }, { y: "closed", dash: C.dash }],
          refs: [{ value: E.mse }, { value: E.closed, dash: C.dash }],
          chosen: { s: state.priorSd, values: [r.msePost, r.expectedMsePost] },
          labels: (v) => formatReadoutRisk(v),
          directSeries: [
            { v: last.mse, label: mobile ? "Post. draw" : "Posterior (draw)", kind: "post", solid: true },
            { v: last.closed, label: mobile ? "Post. exp." : "Posterior (exp.)", kind: "post", solid: false },
            { v: E.mse, label: mobile ? "Est. draw" : "Estimates (draw)", kind: "est", solid: true },
            { v: E.closed, label: mobile ? "Est. exp." : "Estimates (exp.)", kind: "est", solid: false },
          ],
          domain: domainOf(cv.rows, ["mse", "closed"], [E.mse, E.closed], { zero: true }),
          alt: D.alt,
          pointer: true,
          table: {
            caption: D.table,
            columns: [
              sdCol,
              { label: D.colDraw, value: "mse", format: (v) => fmtMse(v) },
              { label: D.colClosed, value: "closed", format: (v) => fmtMse(v) },
            ],
            rows: tableRows,
          },
          keyboard: {
            y: "mse",
            onFocus: (d) => { pDist.focused = d; },
            title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${fmtMse(d.mse)}${D.tipDraw}${fmtMse(d.closed)}${D.tipClosed}`,
          },
        });

        stripMinLine.replaceChildren(
          "Lowest MSE: ",
          w.setting(cv.lowestMse.s, { hook: "lowest-sd" }),
          " (",
          w.risk(cv.lowestMse.mse, { hook: "lowest-mse" }),
          ") in this draw; ",
          w.setting(closed.lowestMse.s, { hook: "lowest-closed-sd" }),
          " (",
          w.risk(closed.lowestMse.mse, { hook: "lowest-closed-mse" }),
          ") expected (fine grid ",
          w.setting(closed.fine.s, { hook: "fine-sd" }),
          ").",
        );

        stripAtLine.replaceChildren(
          "Selected prior SD ", w.setting(state.priorSd), " vs. true spread ", w.est(r.spreadTruth),
          ". MSE in this draw ", w.risk(r.msePost), ", expected MSE ", w.risk(r.expectedMsePost), ". ",

          w.count(sure[0], { hook: "read-sure-90" }),
          " of the ",
          w.count(M, { hook: "pairs" }),
          " pairs > ",
          w.setting(t90),
          " (",
          w.count(sure[1], { hook: "read-sure-99" }),
          " > ",
          w.setting(t99),
          ") · ",
          w.count(r.truthPost),
          " misordered (",
          w.expected(r.expectedPost),
          " expected) · ",
          w.count(r.farther),
          " of ",
          w.count(N_UNITS),
          " units end farther.",
        );
      }

      function drawSecondaryCurves(state, cv, r, sure, fallbackWidth) {
        const C = CONFIG.curve;
        const closed = closedForms();
        const E = cv.estimates;
        const ps = () => sd(state.priorSd);
        const spread = r.spreadTruth;
        const tableRows = (cols) => [...cv.rows, { s: T.estimatesRow, ...cols }];
        const sdCol = { label: T.colPriorSd, value: "s", format: (v) => (typeof v === "number" ? fmtSd(v) : v) };
        const common = { rows: cv.rows, spread };
        const sized = (p, wide = false) => ({
          width: p.slot.clientWidth || fallbackWidth,
          height: wide ? C.heightWide : C.height,
        });

        // Pair certainty (> .90 and > .99)
        const Q = T.certainty;
        pSure.title.replaceChildren(...fill(Q.title, { t90: th(t90), t99: th(t99), M: pairsAll }));
        pSure.extra.replaceChildren(...fill(Q.key, { t90: th(t90), t99: th(t99) }));
        pSure.value.replaceChildren(
          ...fill(Q.value, {
            t90: th(t90),
            t99: th(t99),
            f90: () => count(E.sure90, "flat-90"),
            f99: () => count(E.sure99, "flat-99"),
          }),
        );
        pSure.chart = drawCurves(pSure.slot, {
          ...common,
          ...sized(pSure, true),
          lines: [
            { y: "sure90", step: true },
            { y: "sure99", step: true, dash: C.dotted },
          ],
          refs: [
            { value: E.sure90 },
            { value: E.sure99, dash: C.dotted },
          ],
          chosen: { s: state.priorSd, values: sure },
          labels: (v) => formatCount(v),
          domain: domainOf(cv.rows, ["sure90", "sure99"], [E.sure90, E.sure99], { zero: true }),
          alt: Q.alt,
          table: {
            caption: fill(Q.table, { t90: th(t90), t99: th(t99) }),
            columns: [
              sdCol,
              { label: Q.colLower, value: "sure90", format: (v) => formatCount(v) },
              { label: Q.colHigher, value: "sure99", format: (v) => formatCount(v) },
            ],
            rows: tableRows({ sure90: E.sure90, sure99: E.sure99 }),
          },
          keyboard: {
            y: "sure90",
            onFocus: (d) => { pSure.focused = d; },
            title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.sure90)}${Q.tipA}${fmtSd(t90)}${Q.tipB}${formatCount(d.sure99)}${Q.tipC}${fmtSd(t99)}`,
          },
        });
        pSure.note.hidden = true;

        // Pairs ordered against the true order
        const O = T.order;
        pOrder.title.replaceChildren(...fill(O.title, { M: pairsAll }));
        pOrder.value.replaceChildren(
          ...fill(O.value, {
            ps,
            draw: () => count(r.truthPost, "truth-post"),
            closed: () => expected4(r.expectedPost, "expected-post"),
            estDraw: () => count(r.truthEst, "truth-est"),
            estClosed: () => expected4(r.expectedEst, "expected-est"),
          }),
        );
        pOrder.chart = drawCurves(pOrder.slot, {
          ...common,
          ...sized(pOrder),
          lines: [{ y: "pairs", step: true }, { y: "expected", dash: C.dash }],
          refs: [{ value: E.pairs }, { value: E.expected, dash: C.dash }],
          chosen: { s: state.priorSd, values: [r.truthPost, r.expectedPost] },
          domain: domainOf(cv.rows, ["pairs", "expected"], [E.pairs, E.expected]),
          alt: O.alt,
          table: {
            caption: O.table,
            columns: [
              sdCol,
              { label: O.colDraw, value: "pairs", format: (v) => formatCount(v) },
              { label: O.colClosed, value: "expected", format: (v) => formatExpectedCount(v) },
            ],
            rows: tableRows({ pairs: E.pairs, expected: E.expected }),
          },
          keyboard: {
            y: "pairs",
            onFocus: (d) => { pOrder.focused = d; },
            title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.pairs)}${O.tipDraw}${formatExpectedCount(d.expected)}${O.tipClosed}`,
          },
        });
        pOrder.note.replaceChildren(
          ...fill(O.note, {
            s: () => sd(closed.lowestExpected.s, "fewest-sd"),
            v: () => expected4(closed.lowestExpected.expected, "fewest-expected"),
            est: () => expected4(closed.raw.expected),
            M: pairsAll,
          }),
        );

        // Units that end farther
        const F = T.farther;
        pFar.title.replaceChildren(...fill(F.title, { n: () => num(N_UNITS, formatCount(N_UNITS)) }));
        pFar.value.replaceChildren(...fill(F.value, { ps, count: () => count(r.farther, "farther") }));
        pFar.chart = drawCurves(pFar.slot, {
          ...common,
          ...sized(pFar),
          lines: [{ y: "farther", step: true }],
          refs: [],
          chosen: { s: state.priorSd, values: [r.farther] },
          domain: domainOf(cv.rows, ["farther"], [], { zero: true }),
          alt: F.alt,
          table: { caption: F.table, columns: [sdCol, { label: F.col, value: "farther", format: (v) => formatCount(v) }], rows: cv.rows },
          keyboard: {
            y: "farther",
            onFocus: (d) => { pFar.focused = d; },
            title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.farther)}${F.tip}`,
          },
        });
        const st = cv.settled;
        pFar.note.replaceChildren(
          ...fill(st.whole ? F.noteWhole : F.note, {
            settled: () => count(st.value, "farther-settled"),
            from: () => sd(st.s, "farther-from"),
          }),
          ...(cv.fartherMin > 0 && st.value > 0 ? fill(F.noteWhy, { zero }) : []),
        );
      }

      function drawCompare(cv) {
        const K = T.compare;
        const { narrow, wide } = cv;
        const E = cv.estimates;
        const cN = narrow.closed;
        const cW = wide.closed;
        compareLead.replaceChildren(
          ...fill(K.leadA, { narrow: () => sd(narrow.s), wide: () => sd(wide.s), cN: () => mse4(cN, "narrow-closed"), cW: () => mse4(cW, "wide-closed") }),
          ...fill(K.leadB, { t90: th(t90), sN: () => count(narrow.sure90, "narrow-sure-90"), sW: () => count(wide.sure90, "wide-sure-90") }),
          K.leadC,
          appLink(ctx, "reported-and-realized"),
          ".",
        );
        const row = (head, cells) => h("tr", {}, h("th", { scope: "row" }, ...head), ...cells.map((cellContent) => h("td", {}, cellContent)));
        const table = h(
          "table",
          { class: "prx-sp-table" },
          h("caption", {}, K.table),
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("td", {}),
              h("th", { scope: "col" }, ...fill(K.colNarrow, { narrow: () => sd(narrow.s) })),
              h("th", { scope: "col" }, ...fill(K.colWide, { wide: () => sd(wide.s) })),
              h("th", { scope: "col", text: K.colEst }),
            ),
          ),
          h(
            "tbody",
            {},
            row([K.rowMse], [mse4(narrow.mse, "narrow-mse"), mse4(wide.mse, "wide-mse"), mse4(E.mse, "estimates-mse")]),
            row([K.rowClosed], [mse4(cN), mse4(cW), mse4(E.closed, "estimates-closed")]),
            row([K.rowPairs], [count(narrow.pairs, "narrow-pairs"), count(wide.pairs, "wide-pairs"), count(E.pairs, "estimates-pairs")]),
            row([K.rowExpected], [expected4(narrow.expected, "narrow-expected"), expected4(wide.expected, "wide-expected"), expected4(E.expected, "estimates-expected")]),
            row([K.rowFarther], [count(narrow.farther, "narrow-farther"), count(wide.farther, "wide-farther"), K.noMove]),
            row(fill(K.rowSure, { t: th(t90) }), [count(narrow.sure90), count(wide.sure90), count(E.sure90)]),
            row(fill(K.rowSure, { t: th(t99) }), [count(narrow.sure99, "narrow-sure-99"), count(wide.sure99, "wide-sure-99"), count(E.sure99)]),
          ),
        );
        compareTable.replaceChildren(wrapTable(table, K.table));
      }

      function drawLeagueFigures(state, r, fallbackWidth) {
        leagueHead.replaceChildren(...fill(T.league.heading, { ps: () => sd(state.priorSd) }));
        const L = S.priceLead;
        leagueLead.textContent = r.msePost < r.mseEst
          ? (r.farther > 0 ? L.closerSome : L.closer)
          : (r.expectedMsePost < r.expectedMseEst ? L.fartherDraw : L.farther);
        const uW = unitsSlot.clientWidth || Math.max(240, Math.round(fallbackWidth * 0.58));
        const oW = orderSlot.clientWidth || Math.min(360, Math.max(220, Math.round(fallbackWidth * 0.38)));
        drawV2Units(unitsSlot, r, { width: uW });
        drawV2Order(orderSlot, r, { width: oW });
        orderNote.replaceChildren(
          S.orderNoteA,
          hook("crossings", r.reordered, formatCount(r.reordered)),
          S.orderNoteB,
          pairsAll(),
          S.orderNoteC,
        );
      }

      function drawReadout(state, r) {
        w.set([
          "Prior SD ",
          w.setting(state.priorSd, { hook: "prior-sd" }),
          " (true spread ",
          w.est(r.spreadTruth, { hook: "spread-truth" }),
          "): mean squared error is ",
          w.risk(r.msePost, { hook: "mse-post" }),
          " in this draw and ",
          w.risk(r.expectedMsePost, { hook: "expected-mse-post" }),
          " expected, versus ",
          w.risk(r.mseEst, { hook: "mse-est" }),
          " and ",
          w.risk(r.expectedMseEst, { hook: "expected-mse-est" }),
          " for the estimates.",
        ]);
      }

      return {
        render(state, info) {
          const r = compute({ priorSd: state.priorSd, equalSe: false, seed: state.seed });
          const sure = certaintyAt(r);
          const cv = curvesFor(state.seed);
          const openFallbackW = Math.max(260, Math.round((dataWrap.clientWidth || ctx.stage.clientWidth || ctx.width() || CONFIG.curve.defaultWidth) - 8));

          // PR-06 / PR-09: opening a <details> disclosure never re-renders ctx.stage or re-fires ctx.readout;
          // when Data opens, re-measure and redraw its width-dependent SVGs at their real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open) {
              drawSecondaryCurves(state, cv, r, sure, openFallbackW);
              drawLeagueFigures(state, r, openFallbackW);
            }
            return;
          }

          prior.set(state.priorSd);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);

          drawReadout(state, r);
          drawPrimaryStage(state, cv, r, sure);
          drawKey(r.spreadTruth);
          drawSecondaryCurves(state, cv, r, sure, openFallbackW);
          drawCompare(cv);
          drawLeagueFigures(state, r, openFallbackW);
          renderFullUnitDataTable(ctx, fullUnitsTableSlot, r);

          sourceNote.replaceChildren(
            ...fill(S.note, {
              n: () => num(N_UNITS, formatCount(N_UNITS)),
              seed: () => num(state.seed, formatSetting(state.seed)),
            }),
          );
        },
      };
    },
  });
}
