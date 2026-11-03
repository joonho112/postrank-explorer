// shrinkage (app 1.5): "What a posterior adds". The simulated league (30 units of sizes 16, 64 and 256 observations,
// SE = .8/√size; engine league30 and drawLeague) with a normal–normal teaching posterior: prior mean 0 and a prior SD
// the reader sets. Each posterior mean keeps the share prior SD²/(prior SD² + SE_i²) of its estimate and each
// posterior SD is √share·SE_i (engine normalPosterior); nothing here writes its own posterior.
// Starting point: postrank Explorer v1 L-04 (js/widgets/shrinkage.js), both views, without the prediction gate.
//
// One state { priorSd, equalSe, seed, view } drives every part; the two views are linked through the units figure:
//   units    one row per unit, grouped by size (small units at the top), each group ordered by estimate: a
//            vermillion dot at the estimate, an arrow to the navy posterior mean and the dashed prior mean; view 2
//            adds the true values (×) and rings, on a shaded row, every unit whose posterior mean ends farther from
//            its true value than its estimate was
//   order    view 1: the units by estimate (left) and by posterior mean (right), one line per unit, so that each
//            crossing of two lines is one pair whose order changes (engine strictOrder and misorderedPairs)
//   price    view 2: this draw against the true values (average squared distance, pairs against the true order,
//            spread across the units, units that end farther: engine meanSquaredDistance, misorderedPairs,
//            summaryStats, fartherCount), then the closed-form expectations with the true values fixed (engine
//            expectedMisorderedPairs and expectedSquaredDistance); its lead sentence follows this draw's table, and
//            calls the prior too narrow only when the closed form agrees
//   rule     the closed form of the posterior and a table of the share kept, the fraction moved and the posterior
//            SD for each size, with the scope of a fixed share
// Equal SEs gives every unit the SE CONFIG.equalSe and keeps the estimates where they are: every unit then keeps the
// same share, so no pair can change order. These estimates were drawn with the real SEs, so view 2 then compares no
// distances to the true values; it says why.
//
// Keys: priorSd (number .02–.60, clamped, not snapped), equalSe (on/off, 1/0, true/false, yes/no), seed (integer; the
// frozen draw LEAGUE_SEED is the default; no control, the note shows it) and view (1 or 2).
//
// Exports for the apps that build on this one (1.4 winners-curse, 1.6 shrinkage-price):
//   CONFIG, parseOnOff(v)
//   compute({ priorSd, equalSe, seed })   the posterior and every number both views show, from the engine
//   rowLayout(units), valueDomain(units)   the units figure's rows (fixed by the draw) and its x domain
//   unitsMarks(c, P, lay, options)         the rows, arrows, true values and rings as Plot marks
//   drawUnits(el, r, options)              the units figure (unitsMarks inside chart.plot, with keyboard and table)
//   orderMarks(c, P, units)                the slope chart's lines (crossings), dots and ids as Plot marks
//   drawOrder(el, r, options)              the order figure (orderMarks inside chart.plot, with keyboard and table)
import { createWidget, uid } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, drawLeague, expectedMisorderedPairs, expectedSquaredDistance, fartherCount, league30, meanSquaredDistance,
  misorderedPairs, normalPosterior, pairCount, strictOrder, summaryStats,
} from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "shrinkage",
  label: "What a posterior adds: each league estimate and its posterior mean under a teaching normal prior",
  title: "The simulated league: estimates and posterior means",
  className: "prx-shrink",
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  priorMean: 0,
  equalSe: 0.1,
  seed: Object.freeze({ min: 1, max: 4294967295, value: LEAGUE_SEED }),
  view: Object.freeze({ min: 1, max: 2, value: 1 }),
  onWords: Object.freeze(["on", "true", "1", "yes"]),
  offWords: Object.freeze(["off", "false", "0", "no"]),
  groups: Object.freeze(["small", "medium", "large"]),
  // the expected counts of pairs against the true order are expected counts, at four significant digits
  // (formatExpectedCount, register CR-002), as in 1.3 and 1.6
  digits: Object.freeze({ value: 3, share: 2, sd: 3, mse: 4, spread: 3 }),
  views: Object.freeze([
    Object.freeze({ value: 1, label: "Shrinkage and the order" }),
    Object.freeze({ value: 2, label: "Against the true values" }),
  ]),
  // units figure: one row per unit (rowPx tall), a header row above each size group and a gap between groups; the
  // x domain holds every estimate, true value and the prior mean, padded by `pad` of its span
  chart: Object.freeze({
    rowPx: 12, headRows: 1.4, gapRows: 1.2, headDy: 0.95, marginTop: 6, marginBottom: 40, marginLeft: 36, marginRight: 14,
    dot: 3.6, dotRim: 0.8, ring: 7, ringWidth: 1.4, truth: 4.2, truthWidth: 1.6, line: 1.3, headLength: 6, arrowMinPx: 11,
    band: 0.48, idDx: -5, idSize: 10, headInset: 2, headHalo: 4, rule: "4,3", pad: 0.03, labelOffset: 32, defaultWidth: 640,
  }),
  // order figure: rank 1 at the top on both sides; line dashes tell the sizes apart
  order: Object.freeze({
    rowPx: 12, marginTop: 8, marginBottom: 8, marginLeft: 38, marginRight: 38, dot: 2.8, line: 1.3, idDx: 6, idSize: 10,
    dashes: Object.freeze({ small: null, medium: "5,3", large: "1.5,2.5" }),
  }),
  text: Object.freeze({
    gloss: "In plain words: this prior was chosen for teaching, and this browser computes the posterior from it.",
    sliderLabel: "Prior SD",
    // the prior's center is the average of the league's true values (0 by construction, set by hand): the claims about
    // the prior SD rest on it
    sliderHint: "A prior describes where true values usually lie: here a normal curve centered at {zero}, the average of the league's true values (set by hand). A smaller prior SD says that true values lie closer to {zero}.",
    toggleLabel: "Equal SEs",
    toggleHint: "Give every unit the same SE, {se}. The estimates stay where they are.",
    viewLegend: "View",
    groupHead: Object.freeze({
      small: "Small units: few observations",
      medium: "Medium units",
      large: "Large units: many observations",
    }),
    groupHeadEqual: Object.freeze({ small: "Small units, SE set equal", medium: "Medium units, SE set equal", large: "Large units, SE set equal" }),
    groupWord: Object.freeze({ small: "small", medium: "medium", large: "large" }),
    groupName: Object.freeze({ small: "Small", medium: "Medium", large: "Large" }),
    xLabel: "Value: estimate, posterior mean or true value",
    xLabelPost: "Value: estimate or posterior mean",
    unitsAlt: "One row per unit of the simulated league, grouped by size: small units at the top, then medium, then large. Vermillion dots are the estimates; arrows run to the navy posterior means; the dashed line is the prior mean.",
    unitsAltTruth: " Crosses are the true values; a ring on a shaded row marks a posterior mean that ends farther from its true value than its estimate was.",
    unitsTable: "Each unit: size, SE, estimate and posterior",
    orderHeading: "The order of the units",
    orderLeft: "Estimate",
    orderRight: "Posterior mean",
    orderAlt: "Two columns of the thirty units, ranked by estimate on the left and by posterior mean on the right, with one line per unit; each crossing of two lines is one pair whose order changes.",
    orderTable: "Rank of each unit by estimate and by posterior mean",
    priceHeading: "Against the true values",
    // the lead follows this draw's numbers (closer on average or not, and whether some units end farther); it calls
    // the prior too narrow only when the closed form below says so too
    priceLead: Object.freeze({
      closerSome: "At this prior SD, in this draw, the posterior means are closer to the true values on average (a smaller average squared distance), but some units end farther from their true value than their estimate was.",
      closer: "At this prior SD, in this draw, the posterior means are closer to the true values on average (a smaller average squared distance).",
      farther: "At this prior SD the prior is too narrow for these true values: the posterior means are farther from the true values on average than the estimates (a larger average squared distance), in this draw and over many draws.",
      fartherDraw: "At this prior SD, in this draw, the posterior means are farther from the true values on average than the estimates (a larger average squared distance), although over many draws they would be closer.",
    }),
    priceTable: "This draw against the true values",
    colEstimates: "Estimates",
    colPosterior: "Posterior means",
    rowMse: "Average squared distance to the true value",
    rowTruth: "Pairs ordered against the true order, of ",
    rowSpread: "Spread across the units (SD)",
    spreadTruthA: "The true values have a spread (SD) of ",
    spreadTruthB: ".",
    farther: "Units that end farther from their true value than their estimate was: ",
    fartherEnd: " (ringed in the figure).",
    expectedA: "Expected over many draws of the estimates, with these true values (closed form): ",
    expectedB: " pairs against the true order for the estimates and ",
    expectedC: " for the posterior means. Both orders state a direction for all ",
    expectedD: " pairs, so the two counts are a fair comparison.",
    expectedMseA: "The expected average squared distance, in the same closed form, is ",
    expectedMseB: " for the estimates and ",
    expectedMseC: " for the posterior means.",
    equalNoteA: "With every SE set to ",
    equalNoteB: ", the posterior no longer matches how these estimates were drawn, so this view compares no distances. The posterior means keep the estimate order, so both orders put ",
    equalNoteC: " pairs against the true order.",
    keyEstimate: "estimate",
    keyPosterior: "posterior mean",
    keyArrow: "the move from estimate to posterior mean",
    keyPrior: "prior mean ",
    keyTruth: "true value",
    keyFarther: "ring on a shaded row: the posterior mean ends farther from the true value than the estimate was",
    keyOrderSmall: "small units",
    keyOrderMedium: "medium units",
    keyOrderLarge: "large units",
    sizesA: "Small units: ",
    sizesB: " observations each, SE ",
    sizesMedium: ". Medium units: ",
    sizesLarge: ". Large units: ",
    sizesComma: ", SE ",
    sizesEqualA: "Equal SEs: every unit gets the SE ",
    sizesEqualB: "; the estimates stay where they are, and each unit keeps its size in observations.",
    orderNoteA: "Left: by estimate; right: by posterior mean. Each crossing of two lines is one pair whose order changes: ",
    orderNoteB: " of the ",
    orderNoteC: " pairs here.",
    ruleHead: "The rule, with the prior mean at ",
    ruleTable: "Share kept, fraction moved and posterior SD for each size",
    formulas: "The posterior mean and SD of each unit",
    symbolsA: "In the formulas, ",
    symbolsB: " is the estimate of unit ",
    symbolsUnit: "i",
    symbolsC: " and ",
    symbolsD: " its SE.",
    colUnits: "Units",
    colSe: "SE",
    colShare: "Keeps",
    colMoved: "Moves",
    colPostSd: "Posterior SD",
    ruleNote: "Keeps: the share of its estimate a posterior mean keeps. Moves: the fraction of the way to the prior mean, one minus the share kept.",
    // the scope of a fixed share: it comes from the prior, not from shrinkage in general
    ruleScope: "A fixed share holds only for one normal curve centered at {zero}, shared by all units, as here. Kline, Rose and Walters (2024) estimate a prior from all their firms that is not normal and depends on each firm's SE; under it a posterior mean need not even keep its estimate's sign.",
    obsEach: " observations",
    readPrior: "Prior SD ",
    readEvery: ", every SE ",
    readSmall: ": small units move ",
    readWay: " of the way to ",
    readMedium: ", medium units ",
    readLarge: " and large units ",
    readAll: ": every unit moves ",
    readOrder: ". In this draw the order changes for ",
    readOf: " of the ",
    readPairs: " pairs.",
    note: "Simulated league of {n} units; the estimates are drawn with seed {seed}. Every number is computed in this browser.",
    tipEstimate: "estimate ",
    tipPosterior: "posterior mean ",
    tipKeeps: "keeps ",
    tipTruth: "true value ",
    tipFarther: "it ends farther from its true value than its estimate was",
    tipCloser: "it ends no farther from its true value than its estimate was",
    tipOrder: "its order changes with ",
    tipOrderOne: "other unit",
    tipOrderMany: "other units",
    tipRank: "rank ",
    tipByEstimate: " by estimate, rank ",
    tipByPosterior: " by posterior mean",
    colUnit: "Unit",
    colSize: "Size (observations)",
    colEstimate: "Estimate",
    colPostMean: "Posterior mean",
    colTruth: "True value",
    colFarther: "Ends farther",
    colRankEst: "Rank by estimate",
    colRankPost: "Rank by posterior mean",
    colChanges: "Order changes with",
    yes: "yes",
    no: "no",
  }),
  tex: Object.freeze({
    mean: "\\class{prx-post}{\\text{posterior mean}} = \\frac{\\text{prior SD}^2}{\\text{prior SD}^2 + \\mathrm{SE}_i^2}\\times\\class{prx-est}{\\hat\\theta_i}",
    sd: "\\class{prx-post}{\\text{posterior SD}} = \\sqrt{\\frac{\\text{prior SD}^2}{\\text{prior SD}^2 + \\mathrm{SE}_i^2}}\\times\\mathrm{SE}_i",
    estimate: "\\class{prx-est}{\\hat\\theta_i}",
    se: "\\mathrm{SE}_i",
  }),
});

const T = CONFIG.text;
const LEAGUE = league30();
const N_UNITS = LEAGUE.ids.length;
const M = pairCount(N_UNITS);
const THETA = Object.freeze(Array.from(LEAGUE.theta));
const REAL_SE = Object.freeze(Array.from(LEAGUE.se));
// the closed form without a prior depends on neither the seed nor the prior SD
const EXPECTED_RAW = expectedMisorderedPairs(THETA.slice(), REAL_SE.slice(), {});

const CSS = `
/* a wide slider keeps its hint to fewer lines, so the figures start higher; the toggle and its hint take the rest of
   the row */
.prx-shrink .prx-controls > .prx-slider { flex: 1 1 26rem; max-width: 32rem; }
.prx-shrink .prx-controls > .prx-toggle { flex: 1 1 16rem; max-width: 26rem; }
.prx-shrink .prx-toggle { flex-wrap: wrap; }
.prx-shrink .prx-toggle > .prx-hint { flex: 1 1 100%; margin: 0.25rem 0 0; }
.prx-shrink .prx-shrink-views { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0 0 0.5rem; }
.prx-shrink .prx-shrink-views > legend { flex: 1 1 100%; }
.prx-shrink .prx-shrink-charts { container-type: inline-size; }
.prx-shrink .prx-shrink-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.prx-shrink .prx-shrink-units, .prx-shrink .prx-shrink-side { min-width: 0; }
@container (min-width: 46rem) {
  .prx-shrink .prx-shrink-grid { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
}
.prx-shrink .prx-shrink-heading { margin: 0 0 0.25rem; }
.prx-shrink .prx-shrink-note, .prx-shrink .prx-shrink-lead { margin: 0.25rem 0; font-size: 0.9em; color: var(--prx-fg-muted); }
.prx-shrink .prx-shrink-lead { color: var(--prx-fg); font-weight: 600; }
.prx-shrink .prx-shrink-order-heads { display: flex; justify-content: space-between; margin: 0.25rem 0 0; font-size: 0.85em; font-weight: 600; color: var(--prx-fg); }
.prx-shrink .prx-shrink-order-figure { max-width: 22rem; }
.prx-shrink .prx-shrink-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.25rem 0; font-size: 0.85em; color: var(--prx-fg); }
.prx-shrink .prx-shrink-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.prx-shrink .prx-shrink-swatch { position: relative; display: inline-block; flex: 0 0 auto; width: 1.6rem; height: 1rem;
  background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: 3px; }
.prx-shrink .prx-shrink-swatch::before, .prx-shrink .prx-shrink-swatch::after { content: ""; position: absolute; }
.prx-shrink .prx-shrink-dot::before { left: 50%; top: 50%; width: 0.55rem; height: 0.55rem; border-radius: 50%; transform: translate(-50%, -50%); }
.prx-shrink .prx-shrink-dot-est::before { background: var(--prx-est); }
.prx-shrink .prx-shrink-dot-post::before { background: var(--prx-post); }
.prx-shrink .prx-shrink-arrow::before { left: 0.15rem; right: 0.4rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-shrink .prx-shrink-arrow::after { right: 0.15rem; top: calc(50% - 3.5px); border-left: 6px solid var(--prx-plot-muted);
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; }
.prx-shrink .prx-shrink-rule-line::before { left: calc(50% - 0.75px); top: 0.1rem; bottom: 0.1rem; border-left: 1.5px dashed var(--prx-plot-axis); }
.prx-shrink .prx-shrink-cross::before { content: "×"; inset: 0; font-weight: 700; line-height: 1rem; text-align: center; color: var(--prx-plot-fg); }
.prx-shrink .prx-shrink-ring { background: var(--prx-plot-grid); }
.prx-shrink .prx-shrink-ring::before { left: 50%; top: 50%; width: 0.75rem; height: 0.75rem; border: 1.5px solid var(--prx-plot-fg);
  border-radius: 50%; transform: translate(-50%, -50%); }
.prx-shrink .prx-shrink-ring::after { left: 50%; top: 50%; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--prx-post);
  transform: translate(-50%, -50%); }
.prx-shrink .prx-shrink-line::before { left: 0.15rem; right: 0.15rem; top: calc(50% - 0.75px); border-top: 1.5px solid var(--prx-plot-muted); }
.prx-shrink .prx-shrink-line-medium::before { border-top-style: dashed; }
.prx-shrink .prx-shrink-line-large::before { top: calc(50% - 1px); border-top: 2px dotted var(--prx-plot-muted); }
.prx-shrink .prx-shrink-table-wrap { max-width: 100%; overflow-x: auto; }
.prx-shrink .prx-shrink-table { border-collapse: collapse; margin: 0.25rem 0; font-size: 0.9em; }
.prx-shrink .prx-shrink-table caption { caption-side: top; text-align: left; font-weight: 600; color: var(--prx-fg-muted); }
.prx-shrink .prx-shrink-table th, .prx-shrink .prx-shrink-table td { padding: 0.2rem 0.5rem; border-bottom: 1px solid var(--prx-border);
  text-align: right; vertical-align: top; overflow-wrap: normal; word-break: normal; }
.prx-shrink .prx-shrink-table thead th:first-child { text-align: left; }
.prx-shrink .prx-shrink-sub { display: block; font-size: 0.85em; color: var(--prx-fg-muted); }
.prx-shrink .prx-shrink-table th[scope="row"] { text-align: left; font-weight: 400; }
.prx-shrink .prx-shrink-table thead th { font-weight: 600; }
.prx-shrink .prx-shrink-price-body > p { margin: 0.4rem 0; font-size: 0.9em; }
.prx-shrink .prx-shrink-rule { container-type: inline-size; margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; background: var(--prx-bg);
  border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-shrink .prx-shrink-formulas { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
.prx-shrink .prx-shrink-tex { overflow-wrap: normal; }
.prx-shrink .prx-shrink-tex math { max-width: none; }
.prx-shrink .prx-shrink-gloss { display: block; font-style: normal; }
.prx-shrink .prx-shrink-source { margin-top: 0; }
@container (max-width: 24rem) {
  .prx-shrink .prx-shrink-rule .prx-shrink-table { font-size: 0.82em; }
  .prx-shrink .prx-shrink-rule .prx-shrink-table th, .prx-shrink .prx-shrink-rule .prx-shrink-table td { padding: 0.2rem 0.3rem; }
}
@container (max-width: 19.5rem) {
  .prx-shrink .prx-shrink-rule .prx-shrink-table { font-size: 0.78em; }
  .prx-shrink .prx-shrink-rule .prx-shrink-table th, .prx-shrink .prx-shrink-rule .prx-shrink-table td { padding: 0.2rem 0.15rem; }
}
`;

// ---------------------------------------------------------------------------------------------- computing

/** equalSe: true, false, 1, 0 and the on/off words of a query or a preset link; anything else keeps the old value. */
export function parseOnOff(v) {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (CONFIG.onWords.includes(s)) return true;
  if (CONFIG.offWords.includes(s)) return false;
  return undefined;
}

/** The SD across units with divisor n − 1 (engine summaryStats, as R's sd). */
const spread = (a) => summaryStats(a).sd;

/**
 * Everything both views show for one setting { priorSd, equalSe, seed }. Posteriors, orders, distances, spreads, the
 * units that end farther and the closed forms come from the engine; the closed forms always use the real SEs (they
 * describe how the estimates were drawn) and do not depend on the seed.
 */
export function compute({ priorSd = CONFIG.priorSd.value, equalSe = false, seed = CONFIG.seed.value } = {}) {
  const est = Array.from(drawLeague(seed).estimate);
  const theta = THETA.slice();
  const se = equalSe ? est.map(() => CONFIG.equalSe) : REAL_SE.slice();
  const post = normalPosterior(est, se, { priorMean: CONFIG.priorMean, priorSd });
  const pm = Array.from(post.mean);
  const psd = Array.from(post.sd);
  const share = Array.from(post.shrink);
  const reorder = misorderedPairs(est, pm);
  // how many other units each unit changes order with: the count of its pairs in the engine's list
  const changes = est.map(() => 0);
  for (const p of reorder.pairs) { changes[p.i] += 1; changes[p.j] += 1; }
  const rankEst = strictOrder(est);
  const rankPost = strictOrder(pm);
  const far = fartherCount(est, pm, theta);
  const units = LEAGUE.ids.map((id, i) => ({
    i, id, group: LEAGUE.group[i], size: LEAGUE.size[i], se: se[i], est: est[i], pm: pm[i], psd: psd[i], share: share[i],
    moved: 1 - share[i], theta: theta[i], farther: far.flags[i],
    rankEst: rankEst[i], rankPost: rankPost[i], changes: changes[i],
  }));
  // one row of the rule table per size: every unit of a size has the same SE, so the first one stands for all
  const bySize = CONFIG.groups.map((g) => units.find((u) => u.group === g));
  const closed = expectedSquaredDistance(THETA.slice(), REAL_SE.slice(), { priorSd, priorMean: CONFIG.priorMean });
  return {
    priorSd, equalSe, seed, units, bySize, reordered: reorder.count, pairs: M, n: N_UNITS,
    mseEst: meanSquaredDistance(est, theta), msePost: meanSquaredDistance(pm, theta),
    farther: far.count,
    truthEst: misorderedPairs(est, theta).count,
    truthPost: misorderedPairs(pm, theta).count,
    expectedEst: EXPECTED_RAW,
    expectedPost: expectedMisorderedPairs(THETA.slice(), REAL_SE.slice(), { priorSd, priorMean: CONFIG.priorMean }),
    expectedMseEst: closed.rawMean, expectedMsePost: closed.mean,
    spreadEst: spread(est), spreadPost: spread(pm), spreadTruth: spread(theta),
  };
}

/** Row positions of the units figure: groups in CONFIG.groups order, each by estimate (largest first, ties by index),
 * with a header row above each group. Depends only on the draw, so rows stay in place while the prior SD moves. */
export function rowLayout(units) {
  const C = CONFIG.chart;
  const rows = [];
  const heads = [];
  let y = 0;
  CONFIG.groups.forEach((g, k) => {
    if (k) y += C.gapRows;
    y += C.headRows;
    heads.push({ group: g, y: y - C.headDy });
    const members = units.filter((u) => u.group === g).sort((a, b) => b.est - a.est || a.i - b.i);
    for (const u of members) { rows.push({ ...u, y }); y += 1; }
  });
  return { rows, heads, top: heads[0].y - C.band, bottom: y - 1 + C.band };
}

/** The x domain of the units figure: every estimate, every true value and the prior mean, padded. */
export function valueDomain(units) {
  const xs = units.flatMap((u) => [u.est, u.theta]).concat(CONFIG.priorMean);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const pad = CONFIG.chart.pad * (hi - lo || 1);
  return [lo - pad, hi + pad];
}

// ---------------------------------------------------------------------------------------------- drawing

const fmtShare = (x) => formatDecimal(x, { digits: CONFIG.digits.share });
const fmtValue = (x) => formatDecimal(x, { digits: CONFIG.digits.value });
const fmtSd = (x) => formatDecimal(x, { digits: CONFIG.digits.sd });
const sizeText = (u) => `${T.groupWord[u.group]} unit (${formatCount(u.size)}${T.obsEach}, SE ${fmtShare(u.se)})`;

/** Fill "{slot}" places of a template with nodes or strings; a function slot makes a fresh node for each place. */
const fill = (template, slots) => template.split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  if (!m || !(m[1] in slots)) return p;
  const v = slots[m[1]];
  return typeof v === "function" ? v() : v;
});

/**
 * The marks of the units figure, in v1's draw order: shading of farther rows (with truth), the dashed prior mean,
 * group headers, unit ids, short moves as plain lines and longer ones as arrows that stop at the navy dot's rim, true
 * values (×, with truth), estimate dots, posterior-mean dots and rings around farther units (with truth).
 * lay = rowLayout(units); options: truth (draw the true-value layer), equalSe (the header words), pxPerUnit (pixels
 * per unit of value, for the line-or-arrow choice).
 */
export function unitsMarks(c, P, lay, { truth = false, equalSe = false, pxPerUnit = 1 } = {}) {
  const C = CONFIG.chart;
  const heads = equalSe ? T.groupHeadEqual : T.groupHead;
  const far = truth ? lay.rows.filter((d) => d.farther) : [];
  const px = (d) => Math.abs(d.pm - d.est) * pxPerUnit;
  return [
    truth ? P.rect(far, { y1: (d) => d.y - C.band, y2: (d) => d.y + C.band, fill: c.plotGrid }) : null,
    P.ruleX([CONFIG.priorMean], { stroke: c.plotAxis, strokeDasharray: C.rule }),
    // a halo in the panel colour keeps the dashed prior-mean line from running through a header on a narrow figure
    P.text(lay.heads, { frameAnchor: "left", y: "y", text: (d) => heads[d.group], dx: -C.marginLeft + C.headInset, textAnchor: "start", fill: c.plotFg, fontWeight: "bold",
      stroke: c.plotBg, strokeWidth: C.headHalo, paintOrder: "stroke" }),
    P.text(lay.rows, { frameAnchor: "left", y: "y", text: "id", dx: C.idDx, textAnchor: "end", fill: c.plotMuted, fontSize: C.idSize }),
    P.link(lay.rows.filter((d) => px(d) < C.arrowMinPx), { x1: "est", x2: "pm", y1: "y", y2: "y", stroke: c.plotMuted, strokeWidth: C.line }),
    P.arrow(lay.rows.filter((d) => px(d) >= C.arrowMinPx), {
      x1: "est", x2: "pm", y1: "y", y2: "y", stroke: c.plotMuted, strokeWidth: C.line, headLength: C.headLength, insetEnd: C.dot, bend: 0,
    }),
    truth ? P.dot(lay.rows, { x: "theta", y: "y", symbol: "times", r: C.truth, stroke: c.plotFg, strokeWidth: C.truthWidth }) : null,
    P.dot(lay.rows, { x: "est", y: "y", r: C.dot, fill: c.est, stroke: c.plotBg, strokeWidth: C.dotRim }),
    P.dot(lay.rows, { x: "pm", y: "y", r: C.dot, fill: c.post, stroke: c.plotBg, strokeWidth: C.dotRim }),
    truth ? P.dot(far, { x: "pm", y: "y", r: C.ring, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }) : null,
  ];
}

/**
 * The units figure in el for a compute() result r: one row per unit, the hidden table "Each unit: size, SE, estimate
 * and posterior" (v1's column order) and keyboard reading at the posterior means in layout order. options: truth (the
 * true-value layer, view 2 with real SEs), equalSe (header words; default r.equalSe), width (default el's width),
 * marks(c, P, lay) for extra marks drawn last. Returns the chart.plot handle.
 */
export function drawUnits(el, r, { truth = false, equalSe = r.equalSe, width, marks: extra } = {}) {
  const C = CONFIG.chart;
  const lay = rowLayout(r.units);
  const [lo, hi] = valueDomain(r.units);
  const w = Math.max(1, Math.round(width || el.clientWidth || C.defaultWidth));
  const inner = Math.max(1, w - C.marginLeft - C.marginRight);
  const columns = [
    { label: T.colUnit, value: "id" },
    { label: T.colSize, value: "size", format: (v) => formatCount(v) },
    { label: T.colSe, value: "se", format: (v) => fmtShare(v) },
    { label: T.colEstimate, value: "est", format: (v) => fmtValue(v) },
    { label: T.colShare, value: "share", format: (v) => fmtShare(v) },
    { label: T.colPostMean, value: "pm", format: (v) => fmtValue(v) },
    { label: T.colPostSd, value: "psd", format: (v) => fmtSd(v) },
  ];
  if (truth) {
    columns.push({ label: T.colTruth, value: "theta", format: (v) => fmtValue(v) },
      { label: T.colFarther, value: (d) => (d.farther ? T.yes : T.no) });
  }
  return plot(el, {
    alt: T.unitsAlt + (truth ? T.unitsAltTruth : ""),
    table: { caption: T.unitsTable, columns, rows: lay.rows },
    width: w,
    height: C.marginTop + C.marginBottom + Math.round((lay.bottom - lay.top) * C.rowPx),
    marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
    aspect: false,
    x: { domain: [lo, hi], nice: true, label: truth ? T.xLabel : T.xLabelPost, labelAnchor: "center", labelArrow: "none", labelOffset: C.labelOffset },
    y: { domain: [lay.top, lay.bottom], reverse: true, axis: null },
    marks: (c, P) => [
      ...unitsMarks(c, P, lay, { truth, equalSe, pxPerUnit: inner / (hi - lo) }),
      ...(typeof extra === "function" ? [extra(c, P, lay)].flat() : []),
    ],
    keyboard: {
      data: lay.rows, x: "pm", y: "y", key: "id", sort: false, label: T.unitsAlt,
      title: (d) => {
        let s = `${d.id}, ${sizeText(d)}: ${T.tipEstimate}${fmtValue(d.est)}, ${T.tipPosterior}${fmtValue(d.pm)} (${T.tipKeeps}${fmtShare(d.share)})`;
        if (truth) s += `; ${T.tipTruth}${fmtValue(d.theta)}, so ${d.farther ? T.tipFarther : T.tipCloser}`;
        return `${s}.`;
      },
    },
  });
}

/** The marks of the order figure: one line per unit from (0, rank by estimate) to (1, rank by posterior mean), dashed
 * by size, so each crossing of two lines is one pair whose order changes; vermillion dots left, navy right, ids on
 * both sides. */
export function orderMarks(c, P, units) {
  const O = CONFIG.order;
  return [
    ...CONFIG.groups.map((g) => P.link(units.filter((u) => u.group === g), {
      x1: 0, x2: 1, y1: "rankEst", y2: "rankPost", stroke: c.plotMuted, strokeWidth: O.line, strokeDasharray: O.dashes[g] ?? undefined,
    })),
    P.dot(units, { x: 0, y: "rankEst", r: O.dot, fill: c.est }),
    P.dot(units, { x: 1, y: "rankPost", r: O.dot, fill: c.post }),
    P.text(units, { x: 0, y: "rankEst", text: "id", dx: -O.idDx, textAnchor: "end", fill: c.plotMuted, fontSize: O.idSize }),
    P.text(units, { x: 1, y: "rankPost", text: "id", dx: O.idDx, textAnchor: "start", fill: c.plotMuted, fontSize: O.idSize }),
  ];
}

/** The order figure in el for a compute() result r, with the hidden rank table and keyboard reading in order of rank
 * by estimate. options: width. Returns the chart.plot handle. */
export function drawOrder(el, r, { width } = {}) {
  const O = CONFIG.order;
  const byRank = r.units.slice().sort((a, b) => a.rankEst - b.rankEst);
  return plot(el, {
    alt: T.orderAlt,
    table: {
      caption: T.orderTable,
      columns: [
        { label: T.colUnit, value: "id" },
        { label: T.colSize, value: "size", format: (v) => formatCount(v) },
        { label: T.colRankEst, value: "rankEst", format: (v) => formatCount(v) },
        { label: T.colRankPost, value: "rankPost", format: (v) => formatCount(v) },
        { label: T.colChanges, value: "changes", format: (v) => formatCount(v) },
      ],
      rows: byRank,
    },
    width,
    height: O.marginTop + O.marginBottom + r.units.length * O.rowPx,
    marginTop: O.marginTop, marginBottom: O.marginBottom, marginLeft: O.marginLeft, marginRight: O.marginRight,
    aspect: false,
    x: { domain: [0, 1], axis: null },
    y: { domain: [1, r.units.length], reverse: true, axis: null },
    marks: (c, P) => orderMarks(c, P, r.units),
    keyboard: {
      data: byRank, x: () => 0, y: "rankEst", key: "id", sort: false, label: T.orderAlt,
      title: (d) => `${d.id}, ${sizeText(d)}: ${T.tipRank}${formatCount(d.rankEst)}${T.tipByEstimate}${formatCount(d.rankPost)}${T.tipByPosterior}; ${T.tipOrder}${formatCount(d.changes)} ${d.changes === 1 ? T.tipOrderOne : T.tipOrderMany}.`,
    },
  });
}

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    css: CSS,
    keys: {
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      equalSe: { type: "custom", value: false, parse: (v) => parseOnOff(v) },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      view: { type: "integer", min: CONFIG.view.min, max: CONFIG.view.max, value: CONFIG.view.value },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
      const zero = () => ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 }));

      // --- controls: the prior SD and Equal SEs, each with its hint (numbers in the hints are data-num)
      const prior = ctx.slider({
        label: T.sliderLabel, ...ctx.key("priorSd"), name: "priorSd", onInput: (v) => ctx.set({ priorSd: v }),
      });
      const priorHint = h("p", { class: "prx-hint", id: uid("prx-shrink-prior") }, ...fill(T.sliderHint, { zero }));
      prior.root.append(priorHint);
      prior.input.setAttribute("aria-describedby", priorHint.id);
      const equal = ctx.toggle({ label: T.toggleLabel, checked: ctx.state.equalSe, name: "equalSe", onChange: (b) => ctx.set({ equalSe: b }) });
      const equalHint = h("p", { class: "prx-hint", id: uid("prx-shrink-equal") },
        ...fill(T.toggleHint, { se: ctx.num(CONFIG.equalSe, formatSetting(CONFIG.equalSe)) }));
      equal.root.append(equalHint);
      equal.input.setAttribute("aria-describedby", equalHint.id);
      ctx.controls.append(prior.root, equal.root);
      // the read-out sits between the controls and the figures
      ctx.controls.after(ctx.readout.node);

      // --- views and figures: the units figure, then the side panel (order in view 1, price in view 2)
      const views = ctx.radioGroup({
        legend: T.viewLegend, name: "view", className: "prx-shrink-views",
        options: CONFIG.views.map((v) => ({ value: v.value, label: v.label })),
        value: ctx.state.view, onChange: (v) => ctx.set({ view: v }),
      });
      ctx.part("controls", views.root);
      // one Tab stop for the view radios: only the checked radio is tabbable, as in a native group
      const syncViewStops = () => views.inputs.forEach((r) => (r.checked ? r.removeAttribute("tabindex") : r.setAttribute("tabindex", "-1")));
      const unitsSlot = h("div", { class: "prx-shrink-units-chart" });
      const unitsKey = h("div", { class: "prx-shrink-key", "data-prx-part": "legend" });
      const sizesKey = h("p", { class: "prx-shrink-note", "data-prx-part": "notes" });
      const unitsBox = h("section", { class: "prx-shrink-units", "aria-label": CONFIG.title }, unitsSlot, unitsKey, sizesKey);

      const orderSlot = h("div", { class: "prx-shrink-order-chart" });
      const orderKey = h("div", { class: "prx-shrink-key", "data-prx-part": "legend" },
        ...[["small", T.keyOrderSmall], ["medium", T.keyOrderMedium], ["large", T.keyOrderLarge]].map(([g, words]) =>
          h("span", { class: "prx-shrink-item" }, h("span", { class: `prx-shrink-swatch prx-shrink-line prx-shrink-line-${g}`, "aria-hidden": "true" }), words)));
      const orderNote = h("p", { class: "prx-shrink-note", "data-prx-part": "readout" });
      const orderBox = h("section", { class: "prx-shrink-order", "aria-label": T.orderHeading },
        ctx.panelTitle(T.orderHeading, { className: "prx-shrink-heading" }), orderNote,
        h("div", { class: "prx-shrink-order-figure" },
          h("div", { class: "prx-shrink-order-heads", "aria-hidden": "true" }, h("span", { text: T.orderLeft }), h("span", { text: T.orderRight })),
          orderSlot),
        orderKey);

      const priceBody = h("div", { class: "prx-shrink-price-body", "data-prx-part": "readout" });
      const priceLead = h("p", { class: "prx-shrink-lead" });
      const priceBox = h("section", { class: "prx-shrink-price", "aria-label": T.priceHeading },
        ctx.panelTitle(T.priceHeading, { className: "prx-shrink-heading" }), priceLead, priceBody);
      const side = h("div", { class: "prx-shrink-side" }, orderBox, priceBox);

      ctx.charts.classList.add("prx-shrink-charts");
      ctx.charts.append(views.root, h("div", { class: "prx-shrink-grid" }, unitsBox, side));

      // --- the rule: the closed form, a table for each size and the scope of a fixed share
      const ruleHead = ctx.panelTitle("", { className: "prx-shrink-heading" });
      const texMean = h("div", { class: "prx-shrink-tex", "data-prx-tex": "mean" });
      const texSd = h("div", { class: "prx-shrink-tex", "data-prx-tex": "sd" });
      const formulas = ctx.scrollRegion(h("div", { class: "prx-shrink-formulas" }, texMean, texSd), T.formulas);
      // what the formulas' symbols mean, in words
      const symEstimate = h("span");
      const symSe = h("span");
      const symbols = h("p", { class: "prx-shrink-note" }, T.symbolsA, symEstimate, T.symbolsB, h("i", { text: T.symbolsUnit }), T.symbolsC, symSe, T.symbolsD);
      const ruleTable = h("div");
      const ruleScope = h("p", { class: "prx-shrink-note" });
      const rule = ctx.part("readout", h("section", { class: "prx-shrink-rule", "aria-label": T.ruleTable }, ruleHead, formulas, symbols, ruleTable, ruleScope));
      ctx.charts.after(rule);
      renderTex(texMean, CONFIG.tex.mean, { display: true });
      renderTex(texSd, CONFIG.tex.sd, { display: true });
      renderTex(symEstimate, CONFIG.tex.estimate, { display: false });
      renderTex(symSe, CONFIG.tex.se, { display: false });

      const note = ctx.part("notes", h("p", { class: "prx-shrink-note prx-shrink-source" }));
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), " ", h("span", { class: "prx-shrink-gloss", text: T.gloss }));
      ctx.caption.after(note);

      // ------------------------------------------------------------------------------------------- drawing

      function drawUnitsKey(state) {
        const truth = state.view === 2 && !state.equalSe;
        const item = (cls, ...words) => h("span", { class: "prx-shrink-item" }, h("span", { class: `prx-shrink-swatch ${cls}`, "aria-hidden": "true" }), ...words);
        unitsKey.replaceChildren(...[
          item("prx-shrink-dot prx-shrink-dot-est", T.keyEstimate),
          item("prx-shrink-dot prx-shrink-dot-post", T.keyPosterior),
          item("prx-shrink-arrow", T.keyArrow),
          item("prx-shrink-rule-line", T.keyPrior, zero()),
          truth ? item("prx-shrink-cross", T.keyTruth) : null,
          truth ? item("prx-shrink-ring", T.keyFarther) : null,
        ].filter(Boolean));
        const [s, m, l] = CONFIG.groups.map((g) => LEAGUE.ids.findIndex((_, i) => LEAGUE.group[i] === g));
        const n = (i) => ctx.num(LEAGUE.size[i], formatCount(LEAGUE.size[i]));
        const se = (i) => ctx.num(LEAGUE.se[i], fmtShare(LEAGUE.se[i]));
        sizesKey.replaceChildren(...(state.equalSe
          ? [T.sizesEqualA, ctx.num(CONFIG.equalSe, formatSetting(CONFIG.equalSe)), T.sizesEqualB]
          : [T.sizesA, n(s), T.sizesB, se(s), T.sizesMedium, n(m), T.sizesComma, se(m), T.sizesLarge, n(l), T.sizesComma, se(l), "."]));
      }

      function drawOrderPanel(r) {
        drawOrder(orderSlot, r);
        orderNote.replaceChildren(T.orderNoteA, ro("crossings", r.reordered, formatCount(r.reordered)), T.orderNoteB,
          ctx.num(M, formatCount(M)), T.orderNoteC);
      }

      const wrapTable = (table, label) => ctx.scrollRegion(h("div", { class: "prx-shrink-table-wrap" }, table), label);

      function drawPrice(state, r) {
        priceLead.hidden = state.equalSe;
        if (state.equalSe) {
          priceLead.textContent = "";
          priceBody.replaceChildren(h("p", {}, T.equalNoteA, ctx.num(CONFIG.equalSe, formatSetting(CONFIG.equalSe)), T.equalNoteB,
            ro("truth-est", r.truthEst, formatCount(r.truthEst)), T.equalNoteC));
          return;
        }
        const D = CONFIG.digits;
        const mse = (x) => formatDecimal(x, { digits: D.mse });
        const sd = (x) => formatDecimal(x, { digits: D.spread });
        const row = (head, a, b) => h("tr", {}, h("th", { scope: "row" }, ...head), h("td", {}, a), h("td", {}, b));
        const table = h("table", { class: "prx-shrink-table" },
          h("caption", {}, T.priceTable, ", prior SD ", ctx.num(state.priorSd, formatSetting(state.priorSd))),
          h("thead", {}, h("tr", {}, h("td", {}), h("th", { scope: "col", text: T.colEstimates }), h("th", { scope: "col", text: T.colPosterior }))),
          h("tbody", {},
            row([T.rowMse], ro("mse-est", r.mseEst, mse(r.mseEst)), ro("mse-post", r.msePost, mse(r.msePost))),
            row([T.rowTruth, ctx.num(M, formatCount(M))], ro("truth-est", r.truthEst, formatCount(r.truthEst)), ro("truth-post", r.truthPost, formatCount(r.truthPost))),
            row([T.rowSpread], ro("spread-est", r.spreadEst, sd(r.spreadEst)), ro("spread-post", r.spreadPost, sd(r.spreadPost)))));
        const L = T.priceLead;
        priceLead.textContent = r.msePost < r.mseEst
          ? (r.farther > 0 ? L.closerSome : L.closer)
          : (r.expectedMsePost < r.expectedMseEst ? L.fartherDraw : L.farther);
        const ex = (x) => formatExpectedCount(x);
        priceBody.replaceChildren(
          wrapTable(table, `${T.priceTable}, prior SD ${formatSetting(state.priorSd)}`),
          h("p", {}, T.spreadTruthA, ro("spread-truth", r.spreadTruth, sd(r.spreadTruth)), T.spreadTruthB),
          h("p", {}, T.farther, ro("farther", r.farther, formatCount(r.farther)), " of ", ctx.num(N_UNITS, formatCount(N_UNITS)), T.fartherEnd),
          h("p", {}, T.expectedA, ro("expected-est", r.expectedEst, ex(r.expectedEst)), T.expectedB,
            ro("expected-post", r.expectedPost, ex(r.expectedPost)), T.expectedC, ctx.num(M, formatCount(M)), T.expectedD),
          h("p", {}, T.expectedMseA, ro("expected-mse-est", r.expectedMseEst, mse(r.expectedMseEst)), T.expectedMseB,
            ro("expected-mse-post", r.expectedMsePost, mse(r.expectedMsePost)), T.expectedMseC),
        );
      }

      function drawRule(state, r) {
        ruleHead.replaceChildren(T.ruleHead, zero());
        const rows = state.equalSe ? [r.bySize[0]] : r.bySize;
        const cell = (name, raw, display) => h("td", {}, ro(name, raw, display));
        const table = h("table", { class: "prx-shrink-table" },
          h("caption", {}, T.ruleTable),
          h("thead", {}, h("tr", {}, ...[T.colUnits, T.colSe, T.colShare, T.colMoved, T.colPostSd].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...rows.map((u) => {
            const g = state.equalSe ? "all" : u.group;
            const head = state.equalSe
              ? [T.groupName.small, ", ", T.groupWord.medium, " and ", T.groupWord.large]
              : [T.groupName[u.group], h("span", { class: "prx-shrink-sub" }, ctx.num(u.size, formatCount(u.size)), T.obsEach)];
            return h("tr", {}, h("th", { scope: "row" }, ...head),
              cell(`se-${g}`, u.se, fmtShare(u.se)), cell(`share-${g}`, u.share, fmtShare(u.share)),
              cell(`step-${g}`, u.moved, fmtShare(u.moved)), cell(`postsd-${g}`, u.psd, fmtSd(u.psd)));
          })));
        ruleTable.replaceChildren(wrapTable(table, T.ruleTable), h("p", { class: "prx-shrink-note", text: T.ruleNote }));
        ruleScope.replaceChildren(...fill(T.ruleScope, { zero }));
      }

      function drawReadout(state, r) {
        const ps = ro("prior-sd", state.priorSd, formatSetting(state.priorSd));
        const order = [T.readOrder, ro("reordered", r.reordered, formatCount(r.reordered)), T.readOf, ro("pairs", M, formatCount(M)), T.readPairs];
        if (state.equalSe) {
          const u = r.bySize[0];
          ctx.readout.set([T.readPrior, ps, T.readEvery, ro("equal-se", CONFIG.equalSe, formatSetting(CONFIG.equalSe)), T.readAll,
            ro("moved-all", u.moved, fmtShare(u.moved)), T.readWay, zero(), ...order]);
          return;
        }
        const [s, m, l] = r.bySize;
        ctx.readout.set([T.readPrior, ps, T.readSmall, ro("moved-small", s.moved, fmtShare(s.moved)), T.readWay, zero(),
          T.readMedium, ro("moved-medium", m.moved, fmtShare(m.moved)), T.readLarge, ro("moved-large", l.moved, fmtShare(l.moved)), ...order]);
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            prior.set(state.priorSd);
            equal.set(state.equalSe);
            views.set(state.view);
            syncViewStops();
            const r = compute(state);
            const truth = state.view === 2 && !state.equalSe;
            drawUnits(unitsSlot, r, { truth, equalSe: state.equalSe, width: unitsSlot.clientWidth || ctx.width() });
            drawUnitsKey(state);
            orderBox.hidden = state.view !== 1;
            priceBox.hidden = state.view !== 2;
            if (state.view === 1) drawOrderPanel(r);
            else drawPrice(state, r);
            drawRule(state, r);
            drawReadout(state, r);
            note.replaceChildren(...fill(T.note, {
              n: ctx.num(N_UNITS, formatCount(N_UNITS)),
              seed: ro("seed", state.seed, formatSetting(state.seed)),
            }));
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
