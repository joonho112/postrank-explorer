// shrinkage-price (app 1.6): "How much to shrink". The simulated league of app 1.5 (engine league30 and drawLeague)
// under its teaching posterior (a normal prior with mean 0; engine normalPosterior) at every prior SD on the slider's
// steps, .01 to 1. The prior SD is set or estimated by the producer (whoever fits the model and gives postrank the
// posterior) before postrank reads the posterior: the app shows what it does to the distance from the posterior means
// to the true values and to the pair probabilities postrank reads.
// Starting point: postrank Explorer v1 L-04, view 2 ("Against the true values", one prior SD at a time), whose figures
// come from app 1.5's exports; the curves over the whole range and the pair probabilities along it are new.
//
// One state { priorSd, seed } drives every part:
//   curves    four panels over the prior SD (log scale), under one key (a 2 × 2 table: color tells posterior means
//             from estimates, the line this draw from many draws): the distance and the certainty across the full
//             width, then order and farther side by side; the slider's hint, the panels' click hint and the seed
//             follow them. Each draws the true spread (the SD of the true values, engine summaryStats) as a dashed
//             rule and the chosen prior SD as a rule with a dot on every curve:
//             distance   the average squared distance from the posterior means to the true values in this draw (engine
//                        meanSquaredDistance) and its expectation over many draws of the estimates with the true
//                        values fixed (closed form, engine expectedSquaredDistance), beside the estimates' two levels
//             order      pairs ordered against the true order in this draw (engine misorderedPairs) and expected over
//                        many draws (closed form, engine expectedMisorderedPairs), beside the estimates'
//             farther    units whose posterior mean ends farther from its true value than its estimate was (engine
//                        fartherCount)
//             certainty  pairs with one direction above .90 and above .99 (engine pairCertainty on the posterior's
//                        error array, engine errorArray), beside a flat prior (the estimates with their SEs)
//   compare   a prior about a third of the true spread (.05) and one about three times it (.45), beside the estimates
//   league    app 1.5's units figure (rows, arrows, true values and rings: drawUnits) and order figure (the crossing
//             lines: drawOrder) at the chosen prior SD, from 1.5's compute(), with 1.5's lead sentence
// The closed forms depend on neither key and are computed once; the draw's curves depend only on the seed and are kept
// for the last CONFIG.memo seeds. Where a curve is lowest is read off the slider's steps (the first lowest step); the
// closed-form distance's minimum is also searched in steps of CONFIG.fineStep.
//
// Keys: priorSd (number .01–1, step .01, clamped, not snapped; default .15) and seed (integer; default the frozen draw
// LEAGUE_SEED). The app loads on its first preset, prior SD .15 on the frozen draw.
//
// Layout (review 044 repair, X-01 and X-14/U1-F8): base.js's result-first frame (the read-out under the slider and the
// presets). The distance panel is the primary graphic (ctx.primaryGraphic). The two full-width panels write their
// values at the chosen prior SD next to its dots, on the side away from the true-spread rule. The league (1.5's units
// and order figures at the chosen prior SD) is complete in a closed box directly under the four panels ("Units at
// prior SD …"), and the comparison keeps its lead visible with its table complete in a closed box ("Data and exact
// values"); both are drawn at every render, so their hooks and hidden tables are always in the page.
//
// Exports (for Reported and realized error, app 2.9, which reads the league along the prior SD): CONFIG, GRID, closedForms(),
// curvesFor(seed), certaintyAt(r).
import { appLink, createWidget, roundTo, stepDecimals, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  drawLeague, errorArray, expectedMisorderedPairs, expectedSquaredDistance, fartherCount, league30, meanSquaredDistance,
  misorderedPairs, normalPosterior, pairCertainty, pairCount,
} from "../pr-core.js";
import { CONFIG as SH, compute, drawOrder, drawUnits } from "./shrinkage.js";

export const CONFIG = Object.freeze({
  name: "shrinkage-price",
  label: "How much to shrink: the simulated league's distance to the true values and its pair probabilities at every prior SD",
  title: "The simulated league at every prior SD",
  className: "prx-sp",
  priorSd: Object.freeze({ min: 0.01, max: 1, step: 0.01, value: 0.15 }),
  priorMean: SH.priorMean,
  seed: SH.seed,
  // a pair counts when the posterior puts one of its two directions above the threshold (engine pairCertainty)
  thresholds: Object.freeze([0.9, 0.99]),
  // the two priors compared with each other and with the estimates: about a third of the true spread and about three
  // times it (both on the slider's steps)
  compare: Object.freeze({ narrow: 0.05, wide: 0.45 }),
  // the closed-form distance's minimum is also searched in these steps, over the slider's range
  fineStep: 0.001,
  // the draw's curves are kept for this many seeds
  memo: 6,
  digits: Object.freeze({ mse: 4, spread: 3 }),
  curve: Object.freeze({
    height: 178, heightWide: 210, marginTop: 12, marginRight: 14, marginBottom: 38, marginLeft: 46, ticks: 4,
    mantissas: Object.freeze([1, 2, 5]), line: 2, ref: 1.5, dash: "6,4", dotted: "1.5,3", spreadDash: "4,3", chosen: 1.25,
    dot: 4.5, dotRim: 1.5, pad: 0.06, defaultWidth: 480,
    // the values written next to the chosen dots (review 044, X-01): px beside and above or below the dot, the text
    // height kept inside the plot, the least space between two labels, the halo, the width of one character of the
    // bold 12 px digits (to know a label's width before it is drawn) and the space kept from the plot's edges
    label: Object.freeze({ dx: 8, gap: 3, height: 13, space: 5, halo: 3, char: 7.2, edge: 4 }),
  }),
  text: Object.freeze({
    sliderLabel: SH.text.sliderLabel,
    sliderHint: SH.text.sliderHint,
    seedLabel: "Seed of the draw",
    seedHint: "A seed, a whole number, fixes the noise of a draw, so the same seed always gives the same draw. The curves over many draws do not depend on it.",
    readA: "Prior SD {ps}, against a true spread of {spread}: the average squared distance to the true values is {mse} in this draw and {closed} over many draws ({mseEst} and {closedEst} for the estimates).",
    readB: " In {s90} of the {M} pairs the posterior puts one direction above {t90}, in {s99} above {t99}.",
    // the key: color tells posterior means from estimates, the line this draw from many draws (a 2 × 2 table), then
    // the true spread and the chosen prior SD
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
      note: "In this draw the distance is lowest at prior SD {sDraw} ({vDraw}); over many draws at {sClosed} ({vClosed}). A finer search puts the closed form's lowest point at about {sFine}, next to the true spread, {spread}.",
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
      // review 044 (U1-F8): the league is in the closed box "Units at prior SD …" directly under the panels
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
      // the counts at the chosen prior SD are in the read-out; this line gives the flat prior's
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
      // the counts are the posterior's own probabilities; app 2.9 checks directions against the true values
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
      // the closed box that holds the table (review 044, X-14)
      data: "Data and exact values",
    }),
    league: Object.freeze({
      // the closed box that holds the league (review 044, X-14/U1-F8): a noun phrase, with the units that end farther
      show: "Units at prior SD {ps} (rings mark the {count} that end farther)",
      showOne: "Units at prior SD {ps} (a ring marks the {count} that ends farther)",
      showNone: "Units at prior SD {ps} (none ends farther)",
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

/** The prior SDs on the slider's steps, CONFIG.priorSd.min to max. */
export const GRID = (() => {
  const { min, max, step } = CONFIG.priorSd;
  const d = Math.max(stepDecimals(step), stepDecimals(min));
  return Object.freeze(Array.from({ length: Math.round((max - min) / step) + 1 }, (_, k) => roundTo(min + k * step, d)));
})();

const CSS = `
.prx-sp .prx-controls > .prx-slider { max-width: 24rem; }
.prx-sp .prx-sp-seed { flex: 1 1 16rem; max-width: 24rem; }
.prx-sp .prx-sp-seed input[type="number"] { width: 9rem; max-width: 100%; }
.prx-sp .prx-sp-seed .prx-hint { margin: 0.15rem 0 0; }
.prx-sp .prx-sp-after { margin: 0.75rem 0 0; }
.prx-sp .prx-sp-after .prx-hint { margin: 0.2rem 0 0; font-size: 0.85em; }
.prx-sp .prx-sp-prior-hint strong { font-weight: 600; color: var(--prx-fg); }
.prx-sp .prx-sp-seed-row { display: flex; flex-wrap: wrap; gap: 0.5rem 1.4rem; margin: 0.6rem 0 0; font-size: 0.875rem; }
.prx-sp .prx-sp-charts { container-type: inline-size; }
.prx-sp .prx-sp-curves, .prx-sp .prx-sp-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.25rem; }
/* the distance and the pair probabilities take the full width; the two counts share a row */
@container (min-width: 46rem) {
  .prx-sp .prx-sp-curves { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-sp .prx-sp-panel-distance, .prx-sp .prx-sp-panel-certainty { grid-column: 1 / -1; }
  .prx-sp .prx-sp-grid { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
}
/* the key: a 2 × 2 table (color by row, line by column), then the true spread and the chosen prior SD */
.prx-sp .prx-sp-keygrid { border-collapse: collapse; margin: 0; font-size: 1em; }
.prx-sp .prx-sp-keygrid th, .prx-sp .prx-sp-keygrid td { padding: 0.1rem 0.75rem 0.1rem 0; border: 0; text-align: left; vertical-align: middle; }
.prx-sp .prx-sp-keygrid thead th { font-weight: 600; }
.prx-sp .prx-sp-keygrid tbody th { font-weight: 400; }
.prx-sp .prx-sp-keygrid td { text-align: center; }
.prx-sp .prx-sp-key-side { display: flex; flex-direction: column; gap: 0.3rem; justify-content: center; }
.prx-sp .prx-sp-panel, .prx-sp .prx-sp-units, .prx-sp .prx-sp-side { min-width: 0; }
.prx-sp .prx-sp-heading { margin: 0 0 0.2rem; }
.prx-sp .prx-sp-value { margin: 0 0 0.25rem; font-size: 0.85em; color: var(--prx-fg); }
.prx-sp .prx-sp-note, .prx-sp .prx-sp-lead { margin: 0.25rem 0; font-size: 0.85em; color: var(--prx-fg-muted); }
.prx-sp .prx-sp-lead { color: var(--prx-fg); font-weight: 600; }
.prx-sp .prx-sp-section { margin: 1.1rem 0 0; }
.prx-sp .prx-sp-pick { margin: 0; }
.prx-sp .prx-sp-curve-chart svg { cursor: pointer; }
.prx-sp .prx-sp-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0 0 0.6rem; font-size: 0.85em; color: var(--prx-fg); }
.prx-sp .prx-sp-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.prx-sp .prx-sp-swatch { position: relative; display: inline-block; flex: 0 0 auto; width: 1.6rem; height: 1rem;
  background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: 3px; }
.prx-sp .prx-sp-swatch::before, .prx-sp .prx-sp-swatch::after { content: ""; position: absolute; }
.prx-sp .prx-sp-line::before { left: 0.15rem; right: 0.15rem; top: calc(50% - 1px); border-top: 2px solid var(--prx-plot-fg); }
.prx-sp .prx-sp-line-post::before { border-top-color: var(--prx-post); }
.prx-sp .prx-sp-line-est::before { border-top-color: var(--prx-est); }
.prx-sp .prx-sp-line-dash::before { border-top-style: dashed; }
.prx-sp .prx-sp-vrule::before { left: calc(50% - 0.75px); top: 0.1rem; bottom: 0.1rem; border-left: 1.5px dashed var(--prx-plot-axis); }
.prx-sp .prx-sp-chosen::before { left: calc(50% - 0.6px); top: 0.05rem; bottom: 0.05rem; border-left: 1.25px solid var(--prx-plot-fg); }
.prx-sp .prx-sp-chosen::after { left: 50%; top: 50%; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--prx-post);
  box-shadow: 0 0 0 1.5px var(--prx-plot-bg); transform: translate(-50%, -50%); }
.prx-sp .prx-sp-dot::before { left: 50%; top: 50%; width: 0.55rem; height: 0.55rem; border-radius: 50%; transform: translate(-50%, -50%); }
.prx-sp .prx-sp-dot-est::before { background: var(--prx-est); }
.prx-sp .prx-sp-dot-post::before { background: var(--prx-post); }
.prx-sp .prx-sp-arrow::before { left: 0.15rem; right: 0.4rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-sp .prx-sp-arrow::after { right: 0.15rem; top: calc(50% - 3.5px); border-left: 6px solid var(--prx-plot-muted);
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; }
.prx-sp .prx-sp-rule-line::before { left: calc(50% - 0.75px); top: 0.1rem; bottom: 0.1rem; border-left: 1.5px dashed var(--prx-plot-axis); }
.prx-sp .prx-sp-cross::before { content: "×"; inset: 0; font-weight: 700; line-height: 1rem; text-align: center; color: var(--prx-plot-fg); }
.prx-sp .prx-sp-ring { background: var(--prx-plot-grid); }
.prx-sp .prx-sp-ring::before { left: 50%; top: 50%; width: 0.75rem; height: 0.75rem; border: 1.5px solid var(--prx-plot-fg);
  border-radius: 50%; transform: translate(-50%, -50%); }
.prx-sp .prx-sp-ring::after { left: 50%; top: 50%; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--prx-post);
  transform: translate(-50%, -50%); }
.prx-sp .prx-sp-size::before { left: 0.15rem; right: 0.15rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-sp .prx-sp-size-medium::before { border-top-style: dashed; }
.prx-sp .prx-sp-size-large::before { top: calc(50% - 1px); border-top: 2px dotted var(--prx-plot-muted); }
.prx-sp .prx-sp-order-heads { display: flex; justify-content: space-between; margin: 0.25rem 0 0; font-size: 0.85em; font-weight: 600; color: var(--prx-fg); }
.prx-sp .prx-sp-order-figure { max-width: 22rem; }
.prx-sp .prx-sp-table-wrap { max-width: 100%; overflow-x: auto; }
.prx-sp .prx-sp-table { border-collapse: collapse; margin: 0.25rem 0; font-size: 0.9em; }
.prx-sp .prx-sp-table caption { caption-side: top; text-align: left; font-weight: 600; color: var(--prx-fg-muted); }
.prx-sp .prx-sp-table th, .prx-sp .prx-sp-table td { padding: 0.2rem 0.5rem; border-bottom: 1px solid var(--prx-border);
  text-align: right; vertical-align: top; overflow-wrap: normal; word-break: normal; }
.prx-sp .prx-sp-table th[scope="row"] { text-align: left; font-weight: 400; min-width: 11em; }
.prx-sp .prx-sp-table thead th { font-weight: 600; min-width: 6.5em; }
.prx-sp .prx-sp-gloss { display: block; font-style: normal; }
.prx-sp .prx-sp-source { margin-top: 0; }
/* the closed boxes of the league and the comparison table (review 044, X-14) sit in the flow of the panels, a little
   below what they follow; the league section starts at the top of its box */
.prx-sp .prx-sp-box { margin-top: 0.75rem; }
.prx-sp .prx-sp-box > .prx-disclosure-body > .prx-sp-section { margin-top: 0; }
@container (max-width: 30rem) {
  .prx-sp .prx-sp-table { font-size: 0.82em; }
  .prx-sp .prx-sp-table th, .prx-sp .prx-sp-table td { padding: 0.2rem 0.25rem; }
  .prx-sp .prx-sp-table th[scope="row"] { min-width: 7em; }
  .prx-sp .prx-sp-table thead th { min-width: 0; }
}
`;

// ---------------------------------------------------------------------------------------------- computing

/** The first row with the smallest value of key (the slider's steps in order). */
const lowest = (rows, key) => rows.reduce((a, b) => (b[key] < a[key] ? b : a));

/** From which step on the value of key equals its value at the last step: { value, s, whole }. */
function settledFrom(rows, key) {
  const last = rows[rows.length - 1][key];
  let k = rows.length - 1;
  while (k > 0 && rows[k - 1][key] === last) k -= 1;
  return { value: last, s: rows[k].s, whole: k === 0 };
}

const priorOptions = (s) => ({ priorSd: s, priorMean: CONFIG.priorMean });

let CLOSED = null;
/**
 * The closed forms along the slider's steps (they depend on neither the seed nor the prior SD shown): the expected
 * average squared distance (engine expectedSquaredDistance) and the expected pairs against the true order (engine
 * expectedMisorderedPairs), each always with the real SEs; the estimates' own values (no prior); the first lowest step
 * of each; and the distance's minimum searched in steps of CONFIG.fineStep. Computed once.
 */
export function closedForms() {
  if (CLOSED) return CLOSED;
  const theta = THETA.slice();
  const se = SE.slice();
  const rows = GRID.map((s) => ({
    s, mse: expectedSquaredDistance(theta, se, priorOptions(s)).mean, expected: expectedMisorderedPairs(theta, se, priorOptions(s)),
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
    raw: { mse: expectedSquaredDistance(theta, se, priorOptions(Infinity)).mean, expected: expectedMisorderedPairs(theta, se, {}) },
    lowestMse: lowest(rows, "mse"), lowestExpected: lowest(rows, "expected"), fine,
  });
  return CLOSED;
}

/** The pairs with one direction above each of CONFIG.thresholds, for independent normal posteriors (engine errorArray
 * and pairCertainty). */
const certainty = (means, sds) => pairCertainty(errorArray(means, sds), { thresholds: CONFIG.thresholds.slice() }).counts;

/** What the draw's curves show at one prior SD: distance, pairs against the true order, units farther, certainty. */
function pointAt(est, s) {
  const post = normalPosterior(est, SE.slice(), priorOptions(s));
  const pm = Array.from(post.mean);
  const [sure90, sure99] = certainty(pm, Array.from(post.sd));
  return { mse: meanSquaredDistance(pm, THETA), pairs: misorderedPairs(pm, THETA).count, farther: fartherCount(est, pm, THETA).count, sure90, sure99 };
}

const MEMO = new Map();
/**
 * The curves of one draw (seed): at each prior SD of the slider's steps, this draw's distance, pairs against the true
 * order, units farther and certainty, with the closed forms beside them; the estimates' values (a flat prior: the
 * certainty takes each true value as normal around its estimate, with its SE); where the draw's distance is lowest;
 * from which step the farther count stays as it is at the last step; and the two compared priors. Kept for the last
 * CONFIG.memo seeds.
 */
export function curvesFor(seed) {
  if (MEMO.has(seed)) return MEMO.get(seed);
  const closed = closedForms();
  const est = Array.from(drawLeague(seed).estimate);
  const rows = GRID.map((s, k) => ({ s, ...pointAt(est, s), closed: closed.rows[k].mse, expected: closed.rows[k].expected }));
  const [flat90, flat99] = certainty(est, SE.slice());
  const at = (s) => rows.find((r) => r.s === s);
  const out = Object.freeze({
    seed, rows,
    estimates: {
      mse: meanSquaredDistance(est, THETA), closed: closed.raw.mse, pairs: misorderedPairs(est, THETA).count,
      expected: closed.raw.expected, sure90: flat90, sure99: flat99,
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

/** The certainty of the posterior of a 1.5 compute() result r: [above .90, above .99]. */
export const certaintyAt = (r) => certainty(r.units.map((u) => u.pm), r.units.map((u) => u.psd));

// ---------------------------------------------------------------------------------------------- drawing

const fmtSd = (v) => formatSetting(v);
const fmtMse = (v) => formatDecimal(v, { digits: CONFIG.digits.mse });
const fmtSpread = (v) => formatDecimal(v, { digits: CONFIG.digits.spread });

/** Fill "{slot}" places of a template with nodes or strings; a function slot makes a fresh node for each place. */
const fill = (template, slots) => template.split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  if (!m || !(m[1] in slots)) return p;
  const v = slots[m[1]];
  return typeof v === "function" ? v() : v;
});

/** The same template as plain text (screen-reader names). */
const words = (template, slots) => template.replace(/\{(\w+)\}/g, (all, k) => (k in slots ? String(slots[k]) : all));

/** The prior SD on the slider's steps nearest to v, inside the slider's range. */
function snapPriorSd(v) {
  const { min, max, step } = CONFIG.priorSd;
  const k = Math.round((Math.min(max, Math.max(min, v)) - min) / step);
  return GRID[Math.min(GRID.length - 1, Math.max(0, k))];
}

/**
 * The values at the chosen prior SD written next to their dots (review 044, X-01), as text with data-num. Both go on
 * the side of the chosen rule away from the true-spread rule, so they never cross it, unless that side has no room
 * for them (near an end of the axis); then on the other side. The highest value sits just above its dot and the next
 * just below its own, at least one text height and CONFIG.curve.label.space apart, inside the plot (the second is
 * moved, never the two drawn over each other). format(raw) is the panel's formatter; spread is the true spread and
 * width the figure's width (px).
 */
function chosenLabels(P, c, chosen, format, { spread, width }) {
  const L = CONFIG.curve.label;
  const C = CONFIG.curve;
  const { min, max } = CONFIG.priorSd;
  const share = (v) => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
  // highest first: the first label goes above its dot, the second below its own
  const rows = chosen.values.map((v) => ({ s: chosen.s, v })).sort((a, b) => b.v - a.v).slice(0, 2);
  const plotW = Math.max(1, width - C.marginLeft - C.marginRight);
  const x = share(chosen.s) * plotW;
  const need = L.dx + L.edge + L.char * Math.max(...rows.map((r) => format(r.v).length));
  const room = { right: plotW + C.marginRight - x, left: x };
  const away = spread > chosen.s ? "left" : "right";
  const other = away === "left" ? "right" : "left";
  const side = room[away] >= need ? away : room[other] >= need ? other : (room.right >= room.left ? "right" : "left");
  const right = side === "right";
  const half = L.height / 2;
  const apart = L.height + L.space;
  const render = (index, scales, values, dims, context, next) => {
    const Y = values.y;
    const top = dims.marginTop + half;
    const bottom = dims.height - dims.marginBottom - half;
    const at = Array.from(index);
    const y0 = Y[at[0]] - L.gap - half;
    const y1 = at.length > 1 ? Y[at[1]] + L.gap + half : null;
    let a = Math.max(top, Math.min(bottom, y0));
    let b = y1 === null ? null : Math.max(top, Math.min(bottom, y1));
    if (b !== null && b - a < apart) {
      // pushed against an edge: keep one text height and a space between them, inside the plot
      if (b >= bottom) a = b - apart; else b = a + apart;
      if (a < top) { a = top; b = top + apart; }
    }
    Y[at[0]] = a;
    if (b !== null) Y[at[1]] = b;
    return next(index, scales, values, dims, context);
  };
  return numText(rows, {
    x: "s", y: "v", value: "v", format, render, lineAnchor: "middle", textAnchor: right ? "start" : "end",
    dx: right ? L.dx : -L.dx, fill: c.plotFg, stroke: c.plotBg, strokeWidth: L.halo, paintOrder: "stroke", fontWeight: 600,
  });
}

/**
 * One panel of curves in el: the true spread (dashed rule), the estimates' levels (vermillion rules), the lines of the
 * posterior means (navy; solid, dashed or dotted), and the chosen prior SD (a rule with a dot on every line, and with
 * spec.labels, a formatter, the values written next to the dots).
 * spec: { width, rows, lines: [{ y, dash, step }], refs: [{ value, dash }], chosen: { s, values }, labels, domain,
 * spread, alt, table, keyboard: { y, title, onFocus } }.
 */
function drawCurves(el, spec) {
  const C = CONFIG.curve;
  const marker = spec.chosen.values.map((v) => ({ s: spec.chosen.s, v }));
  return plot(el, {
    alt: spec.alt,
    table: spec.table,
    width: spec.width,
    height: spec.height ?? C.height,
    marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
    aspect: false,
    // chart.js draws a log axis itself (ticks at C.mantissas × 10^k); the label sits at the right end with its arrow
    x: { type: "log", domain: [GRID[0], GRID[GRID.length - 1]], mantissas: C.mantissas, label: T.xLabel },
    y: { domain: spec.domain, nice: true, ticks: C.ticks, label: null, grid: true },
    marks: (c, P) => [
      P.ruleX([spec.spread], { stroke: c.plotAxis, strokeDasharray: C.spreadDash }),
      ...spec.refs.map((r) => P.ruleY([r.value], { stroke: c.est, strokeWidth: C.ref, strokeDasharray: r.dash ?? undefined })),
      ...spec.lines.map((l) => P.line(spec.rows, {
        x: "s", y: l.y, stroke: c.post, strokeWidth: C.line, strokeDasharray: l.dash ?? undefined, curve: l.step ? "step" : "linear",
      })),
      P.ruleX([spec.chosen.s], { stroke: c.plotFg, strokeWidth: C.chosen }),
      // A cap still identifies the dashed reference when the two SDs nearly coincide.
      P.text([spec.spread], { x: d => d, frameAnchor: "top", dy: -7, text: () => "True spread",
        fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", fontSize: 11 }),
      P.dot(marker, { x: "s", y: "v", r: C.dot, fill: c.post, stroke: c.plotBg, strokeWidth: C.dotRim }),
      typeof spec.labels === "function" ? chosenLabels(P, c, spec.chosen, spec.labels, { spread: spec.spread, width: spec.width ?? C.defaultWidth }) : null,
    ],
    keyboard: {
      data: spec.rows, x: "s", y: spec.keyboard.y, key: "s", label: spec.alt, title: spec.keyboard.title, onFocus: spec.keyboard.onFocus,
    },
  });
}

/** The y domain of a panel: from 0 (or a little below the lowest value) to the highest value of its lines and
 * reference levels; Plot then rounds it (nice). */
function domainOf(rows, keys, refs, { zero = false } = {}) {
  const vals = rows.flatMap((r) => keys.map((k) => r[k])).concat(refs);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return [zero ? 0 : lo - CONFIG.curve.pad * (hi - lo), hi];
}

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    // review 044 repair (X-01): the read-out directly under the slider and the preset row
    layout: "result-first",
    css: CSS,
    keys: {
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
      const num = (raw, display) => ctx.num(raw, display);
      const zero = () => num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 }));
      const sd = (v, name) => (name ? ro(name, v, fmtSd(v)) : num(v, fmtSd(v)));
      const mse = (v, name) => (name ? ro(name, v, fmtMse(v)) : num(v, fmtMse(v)));
      const count = (v, name) => (name ? ro(name, v, formatCount(v)) : num(v, formatCount(v)));
      const expected = (v, name) => (name ? ro(name, v, formatExpectedCount(v)) : num(v, formatExpectedCount(v)));
      const spreadNum = (v, name) => (name ? ro(name, v, fmtSpread(v)) : num(v, fmtSpread(v)));
      const [t90, t99] = CONFIG.thresholds;
      const th = (t) => () => num(t, fmtSd(t));
      const pairsAll = () => num(M, formatCount(M));

      // --- controls: the prior SD (1.5's label). Its hint (1.5's), the panels' click hint and the seed of the draw sit
      // under the four panels, so the panels start within the first screen; the slider is still described by its hint
      const prior = ctx.slider({
        label: T.sliderLabel, ...ctx.key("priorSd"), name: "priorSd", onInput: (v) => ctx.set({ priorSd: v }),
      });
      const priorHint = h("span", { id: uid("prx-sp-prior") }, ...fill(T.sliderHint, { zero }));
      prior.input.setAttribute("aria-describedby", priorHint.id);
      const seedHintId = uid("prx-sp-seed-hint");
      const seed = ctx.numberInput({
        label: T.seedLabel, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      seed.root.classList.add("prx-sp-seed");
      ctx.controls.append(prior.root);
      // (the result-first frame puts the read-out between the controls and the figures)

      // --- the key of the four panels
      const swatch = (cls) => h("span", { class: `prx-sp-swatch ${cls}`, "aria-hidden": "true" });
      const item = (cls, ...content) => h("span", { class: "prx-sp-item" }, swatch(cls), h("span", {}, ...content));
      const curveKey = h("div", { class: "prx-sp-key", "data-prx-part": "legend", role: "group", "aria-label": T.keyLabel });

      // --- the four panels: a title, the values at the chosen prior SD, the figure and a note
      const panel = (name) => {
        const title = ctx.panelTitle("", { className: "prx-sp-heading" });
        const value = h("p", { class: "prx-sp-value", "data-prx-part": "readout" });
        const slot = h("div", { class: "prx-sp-curve-chart" });
        const note = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
        const extra = h("p", { class: "prx-sp-note", "data-prx-part": "legend" });
        const root = h("section", { class: `prx-sp-panel prx-sp-panel-${name}` }, title, value, extra, slot, note);
        const p = { root, title, value, slot, note, extra, chart: null, focused: null };
        // a click moves the prior SD to the step nearest the click; Enter (or Space) on a keyboard point, which
        // clicks it with no pointer position, moves it to that point's prior SD
        ctx.listen(slot, "click", (e) => {
          let s = null;
          if (e.detail === 0) s = p.focused?.s ?? null;
          else if (p.chart?.svg) {
            const box = p.chart.svg.getBoundingClientRect();
            const vb = p.chart.svg.viewBox?.baseVal;
            const x = p.chart.scale("x");
            if (box.width > 0 && typeof x?.invert === "function") {
              const px = (e.clientX - box.left) * (vb?.width ? vb.width / box.width : 1);
              s = snapPriorSd(x.invert(px));
            }
          }
          if (Number.isFinite(s) && s !== ctx.state.priorSd) ctx.set({ priorSd: s });
        });
        return p;
      };
      const pDist = panel("distance");
      // the U-curve the slider moves along, directly under the read-out and the key (base.js primaryGraphic)
      ctx.primaryGraphic(pDist.slot);
      const pOrder = panel("order");
      const pFar = panel("farther");
      const pSure = panel("certainty");
      for (const p of [pDist, pOrder, pFar]) p.extra.hidden = true;
      // the distance (the idea) and the pair probabilities postrank reads take the full width; then the two counts
      // side by side. The distance's values are in the read-out, so its panel has no value line.
      pDist.value.hidden = true;
      const curves = h("div", { class: "prx-sp-curves" }, pDist.root, pSure.root, pOrder.root, pFar.root);
      const pickHint = h("p", { class: "prx-sp-note prx-sp-pick", text: T.pickHint });
      // under the panels (and the closed box of the league): how to pick a prior SD on them, the slider's hint, the seed
      const after = h("div", { class: "prx-sp-after" },
        h("div", { "data-prx-part": "notes" }, pickHint, h("p", { class: "prx-hint prx-sp-prior-hint" }, h("strong", { text: `${T.sliderLabel}. ` }), priorHint)),
        ctx.part("controls", h("div", { class: "prx-sp-seed-row" }, seed.root)));

      // --- the comparison of a too-narrow and a too-wide prior: its lead in view (it carries the two counts and the link
      // to 2.9), its table complete in a closed box under it (review 044, X-14/U1-F8)
      const compareLead = h("p", { class: "prx-sp-note", "data-prx-part": "readout" });
      const compareTable = h("div", { "data-prx-part": "readout" });
      const compareData = ctx.disclosure({ name: "data", title: T.compare.data, placement: "none", className: "prx-sp-box" });
      compareData.body.append(compareTable);
      const compareBox = h("section", { class: "prx-sp-section prx-sp-compare", "aria-label": T.compare.heading },
        ctx.panelTitle(T.compare.heading, { className: "prx-sp-heading" }), compareLead, compareData.root);

      // --- the league at the chosen prior SD: 1.5's units figure and order figure
      const leagueHead = ctx.panelTitle("", { className: "prx-sp-heading" });
      const leagueLead = h("p", { class: "prx-sp-lead" });
      const unitsSlot = h("div", { class: "prx-sp-units-chart" });
      const unitsKey = h("div", { class: "prx-sp-key", "data-prx-part": "legend" });
      const sizesNote = h("p", { class: "prx-sp-note", "data-prx-part": "notes" });
      const unitsBox = h("section", { class: "prx-sp-units", "aria-label": T.league.unitsLabel }, unitsSlot, unitsKey, sizesNote);
      const orderSlot = h("div", { class: "prx-sp-order-chart" });
      const orderNote = h("p", { class: "prx-sp-note", "data-prx-part": "readout" });
      const orderKey = h("div", { class: "prx-sp-key", "data-prx-part": "legend" },
        ...[["small", S.keyOrderSmall], ["medium", S.keyOrderMedium], ["large", S.keyOrderLarge]].map(([g, w]) => item(`prx-sp-size prx-sp-size-${g}`, w)));
      const orderBox = h("section", { class: "prx-sp-side", "aria-label": S.orderHeading },
        ctx.panelTitle(S.orderHeading, { className: "prx-sp-heading" }), orderNote,
        h("div", { class: "prx-sp-order-figure" },
          h("div", { class: "prx-sp-order-heads", "aria-hidden": "true" }, h("span", { text: S.orderLeft }), h("span", { text: S.orderRight })),
          orderSlot),
        orderKey,
        h("p", { class: "prx-sp-note", text: T.league.direction }));
      const leagueBox = h("section", { class: "prx-sp-section prx-sp-league" }, leagueHead, leagueLead,
        h("div", { class: "prx-sp-grid" }, unitsBox, orderBox));
      // the league, complete, in a closed box directly under the four panels; its summary names the prior SD and the
      // units the farther panel counts (review 044, X-14/U1-F8). Opening it renders once more, at its real width.
      const unitsView = ctx.disclosure({ name: "units", title: "", placement: "none", className: "prx-sp-box prx-sp-units-box" });
      unitsView.body.append(leagueBox);

      ctx.charts.classList.add("prx-sp-charts");
      ctx.charts.append(curveKey, curves, unitsView.root, after, compareBox);

      const note = ctx.part("notes", h("p", { class: "prx-sp-note prx-sp-source" }));
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), " ", h("span", { class: "prx-sp-gloss", text: S.gloss }));
      ctx.caption.after(note);

      // the units key (1.5's words) and its sizes note are fixed: real SEs, true values shown
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
        const se = (i) => num(LEAGUE.se[i], formatDecimal(LEAGUE.se[i], { digits: SH.digits.share }));
        sizesNote.replaceChildren(S.sizesA, n(s), S.sizesB, se(s), S.sizesMedium, n(m), S.sizesComma, se(m), S.sizesLarge, n(l), S.sizesComma, se(l), ".");
      }

      // ------------------------------------------------------------------------------------------- drawing

      /** The key as a 2 × 2 table (color: posterior means or estimates; line: this draw or over many draws), then the
       * true spread and the chosen prior SD. Each cell's swatch is named for screen readers. */
      function drawKey(spread) {
        const cell = (cls, which, line) => h("td", {}, swatch(cls), h("span", { class: "prx-sr-only", text: words(T.keyCell, { which, line }) }));
        const grid = h("table", { class: "prx-sp-keygrid" },
          h("caption", { class: "prx-sr-only", text: T.keyLabel }),
          h("thead", {}, h("tr", {}, h("td", {}),
            h("th", { scope: "col", text: T.keyDraw }), h("th", { scope: "col", text: T.keyClosed, title: T.keyClosedLong }))),
          h("tbody", {},
            h("tr", {}, h("th", { scope: "row", text: T.keyPost }),
              cell("prx-sp-line prx-sp-line-post", T.keyPost, T.keyDraw), cell("prx-sp-line prx-sp-line-post prx-sp-line-dash", T.keyPost, T.keyClosed)),
            h("tr", {}, h("th", { scope: "row", text: T.keyEst }),
              cell("prx-sp-line prx-sp-line-est", T.keyEst, T.keyDraw), cell("prx-sp-line prx-sp-line-est prx-sp-line-dash", T.keyEst, T.keyClosed))));
        curveKey.replaceChildren(
          grid,
          h("span", { class: "prx-sp-key-side" },
            item("prx-sp-vrule", ...fill(T.keySpread, { spread: () => spreadNum(spread) })),
            item("prx-sp-chosen", T.keyChosen)),
        );
      }

      function drawPanels(state, cv, r, sure, width) {
        const C = CONFIG.curve;
        const closed = closedForms();
        const E = cv.estimates;
        const ps = () => sd(state.priorSd);
        const spread = r.spreadTruth;
        const tableRows = (cols) => [...cv.rows, { s: T.estimatesRow, ...cols }];
        const sdCol = { label: T.colPriorSd, value: "s", format: (v) => (typeof v === "number" ? fmtSd(v) : v) };
        const common = { rows: cv.rows, spread };
        // each panel at its own width; the two full-width panels a little taller
        const sized = (p, wide = false) => ({ width: p.slot.clientWidth || width, height: wide ? C.heightWide : C.height });

        // distance (its values at the chosen prior SD are in the read-out)
        const D = T.distance;
        pDist.title.replaceChildren(D.title);
        pDist.chart = drawCurves(pDist.slot, {
          ...common, ...sized(pDist, true),
          lines: [{ y: "mse" }, { y: "closed", dash: C.dash }],
          refs: [{ value: E.mse }, { value: E.closed, dash: C.dash }],
          chosen: { s: state.priorSd, values: [r.msePost, r.expectedMsePost] },
          labels: fmtMse,
          domain: domainOf(cv.rows, ["mse", "closed"], [E.mse, E.closed], { zero: true }),
          alt: D.alt,
          table: {
            caption: D.table,
            columns: [sdCol, { label: D.colDraw, value: "mse", format: (v) => fmtMse(v) }, { label: D.colClosed, value: "closed", format: (v) => fmtMse(v) }],
            rows: tableRows({ mse: E.mse, closed: E.closed }),
          },
          keyboard: { y: "mse", onFocus: (d) => { pDist.focused = d; }, title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${fmtMse(d.mse)}${D.tipDraw}${fmtMse(d.closed)}${D.tipClosed}` },
        });
        pDist.note.replaceChildren(...fill(D.note, {
          sDraw: () => sd(cv.lowestMse.s, "lowest-sd"), vDraw: () => mse(cv.lowestMse.mse, "lowest-mse"),
          sClosed: () => sd(closed.lowestMse.s, "lowest-closed-sd"), vClosed: () => mse(closed.lowestMse.mse, "lowest-closed-mse"),
          sFine: () => sd(closed.fine.s, "fine-sd"), spread: () => spreadNum(spread),
        }));

        // pairs against the true order
        const O = T.order;
        pOrder.title.replaceChildren(...fill(O.title, { M: pairsAll }));
        pOrder.value.replaceChildren(...fill(O.value, {
          ps, draw: () => count(r.truthPost, "truth-post"), closed: () => expected(r.expectedPost, "expected-post"),
          estDraw: () => count(r.truthEst, "truth-est"), estClosed: () => expected(r.expectedEst, "expected-est"),
        }));
        pOrder.chart = drawCurves(pOrder.slot, {
          ...common, ...sized(pOrder),
          lines: [{ y: "pairs", step: true }, { y: "expected", dash: C.dash }],
          refs: [{ value: E.pairs }, { value: E.expected, dash: C.dash }],
          chosen: { s: state.priorSd, values: [r.truthPost, r.expectedPost] },
          domain: domainOf(cv.rows, ["pairs", "expected"], [E.pairs, E.expected]),
          alt: O.alt,
          table: {
            caption: O.table,
            columns: [sdCol, { label: O.colDraw, value: "pairs", format: (v) => formatCount(v) }, { label: O.colClosed, value: "expected", format: (v) => formatExpectedCount(v) }],
            rows: tableRows({ pairs: E.pairs, expected: E.expected }),
          },
          keyboard: { y: "pairs", onFocus: (d) => { pOrder.focused = d; }, title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.pairs)}${O.tipDraw}${formatExpectedCount(d.expected)}${O.tipClosed}` },
        });
        pOrder.note.replaceChildren(...fill(O.note, {
          s: () => sd(closed.lowestExpected.s, "fewest-sd"), v: () => expected(closed.lowestExpected.expected, "fewest-expected"),
          est: () => expected(closed.raw.expected), M: pairsAll,
        }));

        // units that end farther
        const F = T.farther;
        pFar.title.replaceChildren(...fill(F.title, { n: () => num(N_UNITS, formatCount(N_UNITS)) }));
        pFar.value.replaceChildren(...fill(F.value, { ps, count: () => count(r.farther, "farther") }));
        pFar.chart = drawCurves(pFar.slot, {
          ...common, ...sized(pFar),
          lines: [{ y: "farther", step: true }],
          refs: [],
          chosen: { s: state.priorSd, values: [r.farther] },
          domain: domainOf(cv.rows, ["farther"], [], { zero: true }),
          alt: F.alt,
          table: { caption: F.table, columns: [sdCol, { label: F.col, value: "farther", format: (v) => formatCount(v) }], rows: cv.rows },
          keyboard: { y: "farther", onFocus: (d) => { pFar.focused = d; }, title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.farther)}${F.tip}` },
        });
        const st = cv.settled;
        pFar.note.replaceChildren(
          ...fill(st.whole ? F.noteWhole : F.note, { settled: () => count(st.value, "farther-settled"), from: () => sd(st.s, "farther-from") }),
          ...(cv.fartherMin > 0 && st.value > 0 ? fill(F.noteWhy, { zero }) : []),
        );

        // pairs the posterior is nearly sure of
        const Q = T.certainty;
        pSure.title.replaceChildren(...fill(Q.title, { t90: th(t90), t99: th(t99), M: pairsAll }));
        pSure.extra.replaceChildren(...fill(Q.key, { t90: th(t90), t99: th(t99) }));
        // the counts at the chosen prior SD are in the read-out; the value line gives the flat prior's
        pSure.value.replaceChildren(...fill(Q.value, {
          t90: th(t90), t99: th(t99), f90: () => count(E.sure90, "flat-90"), f99: () => count(E.sure99, "flat-99"),
        }));
        pSure.chart = drawCurves(pSure.slot, {
          ...common, ...sized(pSure, true),
          lines: [{ y: "sure90", step: true }, { y: "sure99", step: true, dash: C.dotted }],
          refs: [{ value: E.sure90 }, { value: E.sure99, dash: C.dotted }],
          chosen: { s: state.priorSd, values: sure },
          labels: (v) => formatCount(v),
          domain: domainOf(cv.rows, ["sure90", "sure99"], [E.sure90, E.sure99], { zero: true }),
          alt: Q.alt,
          table: {
            caption: fill(Q.table, { t90: th(t90), t99: th(t99) }),
            columns: [sdCol,
              { label: Q.colLower, value: "sure90", format: (v) => formatCount(v) },
              { label: Q.colHigher, value: "sure99", format: (v) => formatCount(v) }],
            rows: tableRows({ sure90: E.sure90, sure99: E.sure99 }),
          },
          keyboard: {
            y: "sure90",
            onFocus: (d) => { pSure.focused = d; },
            title: (d) => `${T.tipPrior}${fmtSd(d.s)}: ${formatCount(d.sure90)}${Q.tipA}${fmtSd(t90)}${Q.tipB}${formatCount(d.sure99)}${Q.tipC}${fmtSd(t99)}`,
          },
        });
        pSure.note.replaceChildren(Q.note);
      }

      const wrapTable = (table, label) => ctx.scrollRegion(h("div", { class: "prx-sp-table-wrap" }, table), label);

      function drawCompare(cv) {
        const K = T.compare;
        const { narrow, wide } = cv;
        const E = cv.estimates;
        const cN = narrow.closed;
        const cW = wide.closed;
        compareLead.replaceChildren(
          ...fill(K.leadA, { narrow: () => sd(narrow.s), wide: () => sd(wide.s), cN: () => mse(cN, "narrow-closed"), cW: () => mse(cW, "wide-closed") }),
          ...fill(K.leadB, { t90: th(t90), sN: () => count(narrow.sure90, "narrow-sure-90"), sW: () => count(wide.sure90, "wide-sure-90") }),
          K.leadC, appLink(ctx, "reported-and-realized"), ".",
        );
        const row = (head, cells) => h("tr", {}, h("th", { scope: "row" }, ...head), ...cells.map((c) => h("td", {}, c)));
        const table = h("table", { class: "prx-sp-table" },
          h("caption", {}, K.table),
          h("thead", {}, h("tr", {}, h("td", {}),
            h("th", { scope: "col" }, ...fill(K.colNarrow, { narrow: () => sd(narrow.s) })),
            h("th", { scope: "col" }, ...fill(K.colWide, { wide: () => sd(wide.s) })),
            h("th", { scope: "col", text: K.colEst }))),
          h("tbody", {},
            row([K.rowMse], [mse(narrow.mse, "narrow-mse"), mse(wide.mse, "wide-mse"), mse(E.mse, "estimates-mse")]),
            row([K.rowClosed], [mse(cN), mse(cW), mse(E.closed, "estimates-closed")]),
            row([K.rowPairs], [count(narrow.pairs, "narrow-pairs"), count(wide.pairs, "wide-pairs"), count(E.pairs, "estimates-pairs")]),
            row([K.rowExpected], [expected(narrow.expected, "narrow-expected"), expected(wide.expected, "wide-expected"), expected(E.expected, "estimates-expected")]),
            row([K.rowFarther], [count(narrow.farther, "narrow-farther"), count(wide.farther, "wide-farther"), K.noMove]),
            row(fill(K.rowSure, { t: th(t90) }), [count(narrow.sure90), count(wide.sure90), count(E.sure90)]),
            row(fill(K.rowSure, { t: th(t99) }), [count(narrow.sure99, "narrow-sure-99"), count(wide.sure99, "wide-sure-99"), count(E.sure99)])));
        compareTable.replaceChildren(wrapTable(table, K.table));
      }

      function drawLeagueViews(state, r, width) {
        // the closed box's summary: the prior SD and the units that end farther (the rings inside)
        const L0 = T.league;
        unitsView.summary.replaceChildren(...fill(r.farther === 0 ? L0.showNone : r.farther === 1 ? L0.showOne : L0.show, {
          ps: () => sd(state.priorSd), count: () => count(r.farther),
        }));
        leagueHead.replaceChildren(...fill(T.league.heading, { ps: () => sd(state.priorSd) }));
        // 1.5's lead: it follows this draw's distances and calls the prior too narrow only when the closed form agrees
        const L = S.priceLead;
        leagueLead.textContent = r.msePost < r.mseEst
          ? (r.farther > 0 ? L.closerSome : L.closer)
          : (r.expectedMsePost < r.expectedMseEst ? L.fartherDraw : L.farther);
        drawUnits(unitsSlot, r, { truth: true, equalSe: false, width: unitsSlot.clientWidth || width });
        drawOrder(orderSlot, r);
        orderNote.replaceChildren(S.orderNoteA, ro("crossings", r.reordered, formatCount(r.reordered)), S.orderNoteB, pairsAll(), S.orderNoteC);
      }

      function drawReadout(state, r, sure) {
        ctx.readout.set([
          ...fill(T.readA, {
            ps: () => ro("prior-sd", state.priorSd, fmtSd(state.priorSd)), spread: () => spreadNum(r.spreadTruth, "spread-truth"),
            mse: () => mse(r.msePost, "mse-post"), closed: () => mse(r.expectedMsePost, "expected-mse-post"),
            mseEst: () => mse(r.mseEst, "mse-est"), closedEst: () => mse(r.expectedMseEst, "expected-mse-est"),
          }),
          ...fill(T.readB, {
            s90: () => count(sure[0], "read-sure-90"), M: () => ro("pairs", M, formatCount(M)), t90: th(t90),
            s99: () => count(sure[1], "read-sure-99"), t99: th(t99),
          }),
        ]);
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            prior.set(state.priorSd);
            if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
            const r = compute({ priorSd: state.priorSd, equalSe: false, seed: state.seed });
            const sure = certaintyAt(r);
            const cv = curvesFor(state.seed);
            const width = pDist.slot.clientWidth || CONFIG.curve.defaultWidth;
            drawKey(r.spreadTruth);
            drawPanels(state, cv, r, sure, width);
            drawCompare(cv);
            drawLeagueViews(state, r, ctx.width());
            drawReadout(state, r, sure);
            note.replaceChildren(...fill(S.note, {
              n: () => num(N_UNITS, formatCount(N_UNITS)),
              seed: () => ro("seed", state.seed, formatSetting(state.seed)),
            }));
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
