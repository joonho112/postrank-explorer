// winners-curse (app 1.4): "Too good to be true at the top". A new angle on the simulated league of 1.3 noisy-league
// (v1 L-03) with the teaching posterior of 1.5 shrinkage (v1 L-04): the k units at one end of the league table by estimate
// (the top k, or the bottom k, its mirror) have estimates past their true values on average, and the posterior means of
// the same units take much of that gap back.
//
// Engine: leagueOvershoot(seed, { replays, k, side, priorSd }) runs replay r = 1 … R on drawLeague(seed + r) and gives, for
// each replay, the k units at the chosen end by estimate and two averages over them, estimate minus true value
// (overshoot) and posterior mean minus true value (posteriorOvershoot, teaching posterior with prior mean 0), with their
// means over the replays. mcse gives each mean's Monte Carlo SE, summaryStats the spread of the true values. The default
// seed is LEAGUE_SEED − 1, so replay 1 (seed LEAGUE_SEED) is the draw that 1.3 and 1.5 show first, and 2,000 replays are
// leagueOvershoot(20261029, { replays: 2000 }), the run engine/API.md documents.
//
// Views, all redrawn from one state { seed, replays, k, side, priorSd, draw }:
//   league table  1.3's drawLeagueTable for the replay shown (seed + draw), true values shown; the k units followed are
//                 ringed, with an arrow from the estimate to the navy posterior mean (1.5's compute for that draw); its
//                 x axis holds every estimate of the run, so it never moves while the replay shown moves; its key, on the
//                 plot panel, ends with 1.3's dot-size sentence and size groups; the seed and the two sliders' hints sit
//                 under it
//   histograms    one average per replay, stacked in bins: estimate minus true value (vermillion) above and posterior
//                 mean minus true value of the same units (navy) below, on one x axis and one count scale; a solid line
//                 at 0 (no gap), a dashed line at the mean over the replays with "mean" and its value written at its
//                 top end, one row above the triangle and the dotted line at the replay shown
//   summary       the replay shown beside the average over the replays (a table), one sentence on what the posterior
//                 means did on average (words chosen by what is left of the gap against the gap, CONFIG.band, with both
//                 averages), the Monte Carlo SEs of the two averages
//
// Layout (review 044 repair, X-01 with U1-F5, and X-16 with U1-F6): base.js's result-first frame. The controls are one
// row: the end, k, the prior SD, the replays and the replay shown (its slider and hint, which sat under the league
// table out of sight of what it moves), then the preset row and the read-out, which reports the replay shown too. The
// two histograms are the primary graphic (ctx.primaryGraphic), each with its mean written on its dashed line, and no
// note sits between them and the read-out (the note on replays and bins follows their key). The views are in a phone's
// reading order (one column): the histograms with their key, the league table of the replay shown (with its key, the
// seed and the hints), then the lead, the summary table and the Monte Carlo SEs; from a 56rem container on, two columns
// as before, placed by named grid areas: the league table on the left, the histograms and the summary on the right. Tab
// follows the DOM, so on a page it visits the histograms (right) before the league table (left).
//
// Keys: seed (integer), replays (20, 200 or 2000), k (1–15, so the two ends never overlap), side (top or bottom),
// priorSd (.02–.60 as in 1.5, clamped, not snapped), draw (the replay shown: 1 to the replays run; a larger value is set
// back to the last replay while drawing).
//
// Imported, not copied: from 1.3 noisy-league its text (CONFIG.text), LEAGUE, GROUP, drawSummary, valueDomain,
// drawLeagueTable (with its hooks for extra marks, key items, table columns and keyboard text), drawLineNodes, fill,
// words, textKit and cssFor; from 1.5 shrinkage its prior-SD key and text (CONFIG) and compute (the posterior of one draw).
//
// Exports: CONFIG, overshootRun(state) (memoized leagueOvershoot), runDomain(state) (the league table's x domain for a
// run), replayBins(R, est, post) (the histograms' bins).
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { LEAGUE_SEED, drawLeague, leagueOvershoot, mcse, summaryStats } from "../pr-core.js";
import {
  CONFIG as LEAGUE_APP, GROUP, LEAGUE, cssFor, drawLeagueTable, drawLineNodes, drawSummary, fill, textKit, valueDomain, words,
} from "./noisy-league.js";
import { CONFIG as SHRINK, compute } from "./shrinkage.js";

export const CONFIG = Object.freeze({
  name: "winners-curse",
  label: "Too good to be true at the top: the units with the largest (or smallest) estimates of the simulated league, their estimates and posterior means against their true values, replay by replay",
  title: "The ends of the league table against the true values",
  className: "prx-wc",
  // replay r uses seed + r, so the default seed puts the draw that 1.3 and 1.5 show first (LEAGUE_SEED) at replay 1
  seed: Object.freeze({ min: 1, max: 4294967295, value: LEAGUE_SEED - 1 }),
  replays: Object.freeze({ values: Object.freeze([20, 200, 2000]), value: 2000 }),
  // the units followed at one end; at most half the league, so the top k and the bottom k never share a unit
  k: Object.freeze({ min: 1, max: 15, value: 3 }),
  side: Object.freeze({ values: Object.freeze(["top", "bottom"]), value: "top" }),
  // the replay shown in the league table (1 = the first replay)
  draw: Object.freeze({ min: 1, max: 2000, value: 1 }),
  memo: 16,
  // the words of the take-back sentence: what is left of the gap (posterior mean minus true value) against the gap
  // (estimate minus true value); up to a tenth of it, on either side of the true values, reads as about the whole
  // gap; up to a half, on the estimates' side, as most of it
  band: Object.freeze({ near: 0.1, most: 0.5 }),
  digits: Object.freeze({ value: 3, gap: 3, mcse: 3 }),
  // histogram bins: about this many over the span of the estimates' averages, on a nice width (the width depends on the
  // estimates only, so moving the prior SD never re-bins the upper histogram)
  bins: Object.freeze({ target: Object.freeze({ 20: 12, 200: 24, 2000: 36 }), fallback: 30, widths: Object.freeze([0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.5]), eps: 1e-9, decimals: 6 }),
  chart: Object.freeze({
    // the top margin holds two rows: on top "mean" and the mean, written at the end of the dashed line, which reaches up
    // to them (review 044 repair, X-01: the decisive number on the changed mark); below, the triangle of the replay
    // shown, so the label never sits on the triangle (fix round, review A1). px: the label's center is lineTop − 7 from
    // the top, the dashed line starts at lineTop, the triangle's center is markerDy above the plot area
    height: 172, marginTop: 40, marginBottom: 40, marginLeft: 46, marginRight: 14, xTicks: 6, yTicks: 4,
    zeroWidth: 1.25, meanWidth: 1.75, meanDash: "5,3", shownWidth: 1.5, shownDash: "1.5,2.5", marker: 4.5, markerDy: -8, barRim: 0.5,
    meanLabel: Object.freeze({ dy: -32, lineTop: 15, gap: 3, char: 6.2, edge: 2, minWidth: 200, defaultWidth: 640 }),
    // league table additions: a ring around the estimate dot, then 1.5's posterior-mean dot and arrow (its sizes) drawn
    // in 1.3's table; the arrow starts clear of the largest estimate dot, and 1.3's diamond is drawn again on top
    ringPad: 3, ringWidth: 1.5, arrowWidth: 1.4,
    postDot: SHRINK.chart.dot, postRim: SHRINK.chart.dotRim, headLength: SHRINK.chart.headLength,
    insetStart: LEAGUE_APP.radius.small, diamond: LEAGUE_APP.chart.diamond, halo: LEAGUE_APP.chart.halo,
    // a move shorter than the two insets, the head and 2 px is drawn as a plain line (1.5 uses its arrowMinPx without
    // the start inset)
    arrowMinPx: LEAGUE_APP.radius.small + SHRINK.chart.dot + SHRINK.chart.headLength + 2,
  }),
  text: Object.freeze({
    // controls
    k: "Units at the end, k",
    kHint: "The k units with the largest estimates (top) or the smallest (bottom), picked again in every replay.",
    side: "End of the league table",
    sideWords: Object.freeze({ top: "Top", bottom: "Bottom" }),
    sideLower: Object.freeze({ top: "top", bottom: "bottom" }),
    // the prior's center is the average of the league's true values (0 by construction, set by hand); the claims about
    // the prior SD rest on it
    priorHint: "The posterior means use one normal prior centered at {zero}, the average of the league's true values (set by hand), shared by all units. The true values have a spread (SD) of {spread}.",
    replays: "Replays",
    draw: "Replay shown in the league table",
    drawHint: "Replay {r} of {R} (seed {seed} + {r2}).",
    seed: "Seed of the replays",
    // league table
    leagueHead: "League table of the replay shown, ranked by estimate (highest at the top)",
    keyRing: "ring: the {end} {k} by estimate in this replay, the units the histograms follow",
    keyPost: "posterior mean of a unit followed",
    keyArrow: "the move from its estimate to its posterior mean",
    tPostMean: "Posterior mean",
    tFollowed: "Followed",
    yes: "yes",
    no: "no",
    keyFollowed: " Followed here: posterior mean {pm}; estimate minus true value {gap}; posterior mean minus true value {pgap}.",
    keyOther: " Posterior mean {pm}.",
    // histograms
    distHead: "{R} replays: the {end} {k} by estimate against their true values",
    distNote: "Each replay keeps the true values fixed, draws new estimates, and selects its {end} {k} units by estimate. The bars count how many replays fall in each range of the average error.",
    estHead: "Estimate minus true value, averaged over the {k} units: mean {mean} (dashed line)",
    postHead: "Posterior mean minus true value, same units, prior SD {sd}: mean {mean} (dashed line)",
    estX: "Average of estimate minus true value",
    postX: "Average of posterior mean minus true value",
    yLabel: "Replays",
    estAlt: "Histogram of the replays: for each replay, the average of estimate minus true value over the units followed, in bins; a solid line at 0, a dashed line at the mean over the replays and a triangle at the replay shown in the league table.",
    postAlt: "Histogram of the replays: for each replay, the average of posterior mean minus true value over the same units, in bins; a solid line at 0, a dashed line at the mean over the replays and a triangle at the replay shown in the league table.",
    estTable: "Replays by the average of estimate minus true value",
    postTable: "Replays by the average of posterior mean minus true value",
    tFrom: "From",
    tTo: "To",
    tReplays: "Replays",
    estKbd: "Estimates: one point per bin of replays",
    postKbd: "Posterior means: one point per bin of replays",
    // the word before the mean written on its dashed line
    meanWord: "mean",
    kbdBin: "{which}: {n} of {R} replays average from {lo} to {hi}.",
    kbdEst: "Estimates",
    kbdPost: "Posterior means",
    keyEstBar: "estimates",
    keyPostBar: "posterior means",
    keyZero: "solid line at {zero}: no gap, on target",
    keyMean: "dashed line: the mean over the replays",
    keyShown: "triangle and dotted line: replay {r}, the one in the league table",
    // summary
    tableCaption: "The {end} {k} by estimate",
    colShown: "Replay {r}",
    colAverage: "Average, {R} replays",
    rowGap: "Estimate minus true value",
    rowPostGap: "Posterior mean minus true value",
    tableLabel: "The replay shown and the average over the replays",
    // what the posterior means did, on average over these replays: the words follow what is left of the gap against
    // the gap (CONFIG.band), and the sentence gives both averages, {e} (estimate minus true value) and {p} (posterior
    // mean minus true value)
    lead: Object.freeze({
      pastSlight: "At this prior SD the posterior means take back about the whole gap, and slightly more: on average over these replays, the gap of {e} between estimate and true value becomes {p}.",
      past: "At this prior SD the posterior means take back more than the gap: on average over these replays, the gap of {e} between estimate and true value becomes {p}, on the other side of the true values.",
      nearly: "At this prior SD the posterior means take back nearly the whole gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      most: "At this prior SD the posterior means take back most of the gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      part: "At this prior SD the posterior means take back part of the gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      all: "At this prior SD the posterior means are on target to three decimals, on average over these replays: they take back the whole gap of {e} between estimate and true value.",
      none: "At this prior SD the posterior means are no closer to the true values than the estimates, on average over these replays: the gap of {e} between estimate and true value becomes {p}.",
      level: "On average over these replays the estimates of these units are on target to three decimals, so there is no gap to take back.",
    }),
    mcseNote: "Monte Carlo SE of the two averages (their SD across the replays over the square root of {R}): {a} and {b}.",
    // read-out and caption
    readout: "{End} {k} by estimate, over {R} replays: estimate minus true value averages {e}; posterior mean minus true value averages {p} (prior SD {sd}). In replay {r} (seed {seed}): {er} and {pr}.",
    league: "A simulated league built for this site: thirty fictional units with fixed true values; every replay adds noise of the unit's SE to each true value, computed in this browser.",
    postFrom: "The posterior means come from ",
    replayNote: "; replay r uses seed {seed} + r.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const NL = LEAGUE_APP.text;
/** The spread (SD, divisor n − 1) of the league's true values (engine summaryStats). */
const SPREAD = summaryStats(LEAGUE.theta).sd;
const ZERO = 0;

const fmtValue = (x) => formatDecimal(x, { digits: CONFIG.digits.value });
const fmtGap = (x) => formatDecimal(x, { digits: CONFIG.digits.gap });
const fmtMcse = (x) => formatDecimal(x, { digits: CONFIG.digits.mcse });

// ---------------------------------------------------------------------------------------------- computing

/** A first-in first-out memo of `size` entries. */
function memo(size, make) {
  const store = new Map();
  return (key, ...args) => {
    if (!store.has(key)) {
      if (store.size >= size) store.delete(store.keys().next().value);
      store.set(key, make(...args));
    }
    return store.get(key);
  };
}

const runMemo = memo(CONFIG.memo, (seed, replays, k, side, priorSd) => leagueOvershoot(seed, { replays, k, side, priorSd }));

/** leagueOvershoot for a state (memoized): the replays seed + 1 … seed + R, the k units at one end, the averages. */
export function overshootRun({ seed, replays, k, side, priorSd }) {
  return runMemo(`${seed}|${replays}|${k}|${side}|${priorSd}`, seed, replays, k, side, priorSd);
}

/** The league table's x domain for a run: every true value and every estimate of replays 1 … R at the seed (1.3's
 * valueDomain over their range), so the axis never moves while the replay shown moves. Kept with the run's memo, per
 * seed and number of replays (k, the end and the prior SD do not change the estimates). */
const domainMemo = memo(CONFIG.memo, (seed, R) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 1; r <= R; r += 1) {
    for (const x of drawLeague(seed + r).estimate) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return valueDomain({ first: { estimate: [lo, hi] }, replays: [] }, false);
});

/** The league table's x domain for a state (memoized per seed and replays). */
export const runDomain = ({ seed, replays }) => domainMemo(`${seed}|${replays}`, seed, replays);

/** The smallest nice bin width at least x. */
function niceWidth(x) {
  const w = CONFIG.bins.widths;
  return w.find((v) => v >= x) ?? w[w.length - 1];
}

const round = (x) => Number(x.toFixed(CONFIG.bins.decimals));

/**
 * The histograms' bins: one width for both (about CONFIG.bins.target[R] bins over the span of the estimates' averages
 * and 0), edges on multiples of the width, a domain that holds both sets of averages and 0. Returns { lo, hi, width,
 * est, post } with est and post the bins [{ i, lo, hi, n }] that hold at least one replay.
 */
export function replayBins(R, est, post) {
  const B = CONFIG.bins;
  const span = Math.max(ZERO, ...est) - Math.min(ZERO, ...est);
  const width = niceWidth(span / (B.target[R] ?? B.fallback));
  const lo = round(Math.floor(Math.min(ZERO, ...est, ...post) / width + B.eps) * width);
  let hi = round(Math.ceil(Math.max(ZERO, ...est, ...post) / width - B.eps) * width);
  if (!(hi > lo)) hi = round(lo + width);
  const count = Math.round((hi - lo) / width);
  const binsOf = (values) => {
    const n = new Array(count).fill(0);
    for (const v of values) n[Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width + B.eps)))] += 1;
    return n.map((c, i) => ({ i, lo: round(lo + i * width), hi: round(lo + (i + 1) * width), n: c })).filter((b) => b.n > 0);
  };
  return { lo, hi, width, est: binsOf(est), post: binsOf(post) };
}

// ---------------------------------------------------------------------------------------------- CSS

// Layout (review 044 repair, X-01/U1-F5 and X-16/U1-F6): the controls row holds the replay shown after the replays, so
// on a page at 1280 the five controls share one row (the two sliders narrower than before) and the replay hint keeps
// two lines in every state, so the row never changes height while the replay moves. The views are in a phone's reading
// order (histograms, league table, summary); from a 56rem container on, named grid areas put the league table on the
// left and the histograms over the summary on the right, as before (row gap 0: the parts keep their own spacing).
const CSS = `${cssFor(CONFIG.className)}
.prx-wc .prx-wc-row { display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: flex-start; min-width: 0; }
.prx-wc .prx-wc-row > .prx-slider { flex: 1 1 8rem; max-width: 13rem; }
.prx-wc .prx-wc-seed { flex: 1 1 14rem; max-width: 22rem; }
.prx-wc .prx-wc-seed input[type="number"] { width: 9rem; max-width: 100%; }
.prx-wc .prx-wc-seed .prx-hint, .prx-wc .prx-wc-draw .prx-hint { margin: 0.15rem 0 0; }
.prx-wc .prx-wc-draw { flex: 1 1 15rem; max-width: 22rem; min-width: 0; }
.prx-wc .prx-wc-draw > .prx-slider { max-width: none; }
.prx-wc .prx-wc-draw .prx-hint { min-height: 2.8em; }
@media (max-width: 30em) {
  .prx-wc .prx-wc-row > .prx-slider, .prx-wc .prx-wc-row > .prx-wc-draw { flex-basis: 100%; max-width: none; }
}
.prx-wc .prx-wc-charts { container-type: inline-size; }
.prx-wc .prx-wc-views { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.5rem; align-items: start; }
@container (min-width: 56rem) {
  .prx-wc .prx-wc-views { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto 1fr; row-gap: 0;
    grid-template-areas: "league dist" "league sum"; }
  .prx-wc .prx-wc-league { grid-area: league; }
  .prx-wc .prx-wc-dist { grid-area: dist; }
  .prx-wc .prx-wc-sum { grid-area: sum; }
}
.prx-wc .prx-wc-league, .prx-wc .prx-wc-dist, .prx-wc .prx-wc-sum, .prx-wc .prx-wc-hists, .prx-wc .prx-wc-hist { min-width: 0; max-width: 100%; }
.prx-wc .prx-wc-hist + .prx-wc-hist { margin-top: 0.6rem; }
.prx-wc .prx-wc-hist-head { margin: 0 0 0.2rem; font-size: 0.875em; font-weight: 600; line-height: 1.3; color: var(--prx-fg); }
.prx-wc .prx-wc-note { margin: 0.4rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
/* the league key on the plot panel: its items in two columns where there is room, then the dot-size sentence and the
   three sizes on rows of their own */
.prx-wc .prx-wc-league-key { display: block; column-gap: 1.25rem; }
.prx-wc .prx-wc-league-key > .prx-nl-key-item { display: flex; break-inside: avoid; margin: 0 0 0.25rem; }
.prx-wc .prx-wc-key-wide { display: block; column-span: all; margin: 0.3rem 0 0; }
.prx-wc .prx-wc-size-row { display: flex; flex-wrap: wrap; gap: 0.15rem 1.1rem; }
@container (min-width: 30rem) {
  .prx-wc .prx-wc-league-key { column-count: 2; }
}
.prx-wc .prx-wc-replay-row { margin: 0.75rem 0 0; font-size: 0.875rem; }
.prx-wc .prx-wc-hints { margin: 0.6rem 0 0; font-size: 0.875rem; }
.prx-wc .prx-wc-hints > .prx-hint { margin: 0.2rem 0 0; }
.prx-wc .prx-wc-hints strong { font-weight: 600; color: var(--prx-fg); }
.prx-wc .prx-wc-lead { margin: 0.6rem 0 0.3rem; font-size: 0.9em; font-weight: 600; color: var(--prx-fg); }
.prx-wc .prx-wc-mcse { margin: 0.3rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); }
.prx-wc .prx-wc-sw { flex: none; display: inline-block; box-sizing: border-box; }
.prx-wc .prx-wc-sw-ring { width: 13px; height: 13px; border: 1.5px solid var(--prx-plot-fg); border-radius: 50%; }
.prx-wc .prx-wc-sw-post { width: 8px; height: 8px; margin: 0 2px; background: var(--prx-post); border-radius: 50%; }
.prx-wc .prx-wc-sw-arrow { position: relative; width: 1.4rem; height: 0; border-top: 1.5px solid var(--prx-post); }
.prx-wc .prx-wc-sw-arrow::after { content: ""; position: absolute; right: -1px; top: -4.25px; border-left: 6px solid var(--prx-post);
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; }
.prx-wc .prx-wc-sw-bar { width: 0.8rem; height: 0.8rem; border: 1px solid var(--prx-plot-bg); }
.prx-wc .prx-wc-sw-est { background: var(--prx-est); }
.prx-wc .prx-wc-sw-postbar { background: var(--prx-post); }
.prx-wc .prx-wc-sw-zero { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 1.5px solid var(--prx-plot-axis); }
.prx-wc .prx-wc-sw-mean { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px dashed var(--prx-plot-fg); }
.prx-wc .prx-wc-sw-marker { width: 0; height: 0; margin: 0 0.15rem; border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; }
.prx-wc .prx-wc-table { width: auto; max-width: 100%; }
.prx-wc .prx-wc-table thead th:first-child { text-align: left; }
.prx-wc .prx-wc-table th, .prx-wc .prx-wc-table td { overflow-wrap: normal; word-break: normal; }
.prx-wc .prx-wc-table tbody th { white-space: normal; min-width: 7.5rem; }
.prx-wc .prx-wc-keep { white-space: nowrap; }
`;

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    // review 044 repair (X-01): the read-out directly under the controls and the preset row
    layout: "result-first",
    css: CSS,
    keys: {
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      replays: { type: "choice", values: CONFIG.replays.values, value: CONFIG.replays.value },
      k: { type: "integer", min: CONFIG.k.min, max: CONFIG.k.max, value: CONFIG.k.value },
      side: { type: "choice", values: CONFIG.side.values, value: CONFIG.side.value },
      priorSd: { type: "number", min: SHRINK.priorSd.min, max: SHRINK.priorSd.max, step: SHRINK.priorSd.step, value: SHRINK.priorSd.value },
      draw: { type: "integer", min: CONFIG.draw.min, max: CONFIG.draw.max, value: CONFIG.draw.value },
    },
    build(ctx) {
      const { h } = ctx;
      const kit = textKit(ctx);
      const ro = (name, raw, display) => kit.tagged(ctx.num(raw, display), name);
      const zero = () => ctx.num(ZERO, formatDecimal(ZERO, { digits: 0 }));

      // --- controls: the end and k, the prior SD, the replays, the replay shown, the seed
      const side = ctx.segmented({
        label: T.side, name: "side", value: ctx.state.side,
        options: CONFIG.side.values.map((v) => ({ value: v, label: T.sideWords[v] })),
        onChange: (v) => ctx.set({ side: v }),
      });
      const kSlider = ctx.slider({
        label: T.k, ...ctx.key("k"), name: "k", format: (v) => formatCount(v),
        onInput: (v) => ctx.set({ k: Math.round(v) }),
      });
      const prior = ctx.slider({
        label: SHRINK.text.sliderLabel, ...ctx.key("priorSd"), name: "priorSd",
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      // the prior SD is the primary control: it moves the posterior histogram and the read-out's second average
      // (review 044 fix round: base.js primaryControl, so the probe measures the read-out from it)
      ctx.primaryControl(prior.input);
      // the two sliders' hints sit under the league table (the figures come first); each still describes its slider
      const kHint = h("span", { id: uid("prx-wc-k-hint") }, T.kHint);
      const priorHint = h("span", { id: uid("prx-wc-prior-hint") }, ...fill(T.priorHint, { zero, spread: () => ro("spread", SPREAD, fmtValue(SPREAD)) }));
      kSlider.input.setAttribute("aria-describedby", kHint.id);
      prior.input.setAttribute("aria-describedby", priorHint.id);
      const hints = ctx.part("notes", h("div", { class: "prx-wc-hints" },
        h("p", { class: "prx-hint" }, h("strong", { text: `${T.k}. ` }), kHint),
        h("p", { class: "prx-hint" }, h("strong", { text: `${SHRINK.text.sliderLabel}. ` }), priorHint)));
      const replays = ctx.segmented({
        label: T.replays, name: "replays", value: ctx.state.replays,
        options: CONFIG.replays.values.map((v) => ({ value: v, label: formatCount(v) })),
        onChange: (v) => ctx.set({ replays: v }),
      });
      // the replay shown: a slider over 1 … R, made again when R changes (its range is fixed when it is made)
      const drawSlot = h("div", { class: "prx-wc-draw" });
      const drawHint = h("p", { class: "prx-hint", id: uid("prx-wc-draw-hint") });
      let drawSlider = null;
      let drawMax = 0;
      const makeDrawSlider = (R, value) => {
        drawMax = R;
        drawSlider = ctx.slider({
          label: T.draw, min: CONFIG.draw.min, max: R, step: 1, value, name: "draw", key: "slider:draw",
          format: (v) => formatCount(v), onInput: (v) => ctx.set({ draw: Math.round(v) }),
        });
        drawSlider.input.setAttribute("aria-describedby", drawHint.id);
        drawSlot.replaceChildren(drawSlider.root, drawHint);
      };
      makeDrawSlider(ctx.state.replays, Math.min(ctx.state.draw, ctx.state.replays));
      const seedHintId = uid("prx-wc-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: NL.seedHint }));
      seed.root.classList.add("prx-wc-seed");
      // one row: which units (the end, k, the prior SD of their posterior means), how many replays and the replay shown
      // (review 044 repair, X-01/U1-F5: it moves the league table, the triangles on the histograms and the read-out's
      // second sentence, so it sits with the controls, above all three); the seed stays under the league table with the
      // sliders' hints. (The result-first frame puts the read-out between the controls, with the preset row, and the
      // figures.)
      ctx.controls.append(h("div", { class: "prx-wc-row" }, side.root, kSlider.root, prior.root, replays.root, drawSlot));

      // --- league table of the replay shown, with the seed and the hints under it
      const drawLine = h("p", { class: "prx-nl-drawline", "data-prx-part": "notes" });
      const leagueSlot = h("div", { class: "prx-nl-league-chart" });
      const leagueKey = h("div", { class: "prx-nl-key prx-wc-league-key", "data-prx-part": "legend" });
      const replayRow = ctx.part("controls", h("div", { class: "prx-wc-row prx-wc-replay-row" }, seed.root));
      const leagueBox = h("section", { class: "prx-wc-league", "aria-label": T.leagueHead },
        ctx.panelTitle(T.leagueHead, { className: "prx-nl-heading" }), drawLine, leagueSlot, leagueKey, replayRow, hints);

      // --- the replays: the two histograms (the primary graphic, base.js primaryGraphic) and their key; then the
      // summary: the lead, the table and the Monte Carlo SEs
      const distTitle = ctx.panelTitle("", { className: "prx-nl-heading" });
      const distNote = h("p", { class: "prx-wc-note", "data-prx-part": "notes" });
      const estHead = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-wc-hist-head" }));
      const estSlot = h("div", { class: "prx-wc-hist-chart prx-wc-est-chart" });
      const postHead = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-wc-hist-head" }));
      const postSlot = h("div", { class: "prx-wc-hist-chart prx-wc-post-chart" });
      const distKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const lead = h("p", { class: "prx-wc-lead", "data-prx-part": "readout" });
      const summary = h("div", { class: "prx-wc-summary", "data-prx-part": "readout" });
      const mcseNote = h("p", { class: "prx-wc-mcse", "data-prx-part": "notes" });
      const hists = ctx.primaryGraphic(h("div", { class: "prx-wc-hists" },
        h("div", { class: "prx-wc-hist" }, estHead, estSlot),
        h("div", { class: "prx-wc-hist" }, postHead, postSlot)));
      // the note on what a replay and a bar are follows the key, so no note sits between the read-out and the
      // histograms (review 044 repair, X-01/X-16)
      const distBox = h("section", { class: "prx-wc-dist", "aria-label": T.replays }, distTitle, hists, distKey, distNote);
      const sumBox = h("div", { class: "prx-wc-sum" }, lead, summary, mcseNote);
      ctx.charts.classList.add("prx-wc-charts");
      // a phone's reading order (review 044 repair, X-16/U1-F6): the histograms, the evidence across replays, before the
      // league table of one replay, then the summary; two columns from a 56rem container on (CSS grid areas)
      ctx.charts.append(h("div", { class: "prx-wc-views" }, distBox, leagueBox, sumBox));

      // ------------------------------------------------------------------------------------------- drawing

      function drawTable(state, shown, d, post) {
        const followed = new Set(d.units);
        const pm = post.units.map((u) => u.pm);
        const domain = runDomain(state);
        const end = T.sideLower[state.side];
        drawLeagueTable(ctx, { slot: leagueSlot, key: leagueKey }, {
          draw: shown, domain, reveal: true, k: state.k,
          marks: (c, P, rows) => {
            const units = rows.filter((row) => followed.has(row.i)).map((row) => ({ ...row, pm: pm[row.i] }));
            const [lo, hi] = domain;
            const inner = Math.max(1, (leagueSlot.clientWidth || ctx.width()) - LEAGUE_APP.chart.marginLeft - LEAGUE_APP.chart.marginRight);
            const px = (u) => (Math.abs(u.pm - u.est) * inner) / (hi - lo);
            return [
              P.dot(units, { x: "est", y: "pos", r: (u) => u.r + C.ringPad, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }),
              P.link(units.filter((u) => px(u) < C.arrowMinPx), { x1: "est", x2: "pm", y1: "pos", y2: "pos", stroke: c.post, strokeWidth: C.arrowWidth }),
              P.arrow(units.filter((u) => px(u) >= C.arrowMinPx), {
                x1: "est", x2: "pm", y1: "pos", y2: "pos", stroke: c.post, strokeWidth: C.arrowWidth, headLength: C.headLength,
                insetStart: C.insetStart, insetEnd: C.postDot, bend: 0,
              }),
              P.dot(units, { x: "pm", y: "pos", r: C.postDot, fill: c.post, stroke: c.plotBg, strokeWidth: C.postRim }),
              // the true value stays visible where a posterior mean lands on it
              P.dot(units, { x: "theta", y: "pos", symbol: "diamond", r: C.diamond, fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo }),
            ];
          },
          keyItems: (kk) => {
            const item = (...children) => h("span", { class: "prx-nl-key-item" }, ...children);
            return [
              item(h("span", { class: "prx-wc-sw prx-wc-sw-ring", "aria-hidden": "true" }),
                h("span", {}, ...fill(T.keyRing, { end, k: () => kk.count(state.k) }))),
              item(h("span", { class: "prx-wc-sw prx-wc-sw-post", "aria-hidden": "true" }), T.keyPost),
              item(h("span", { class: "prx-wc-sw prx-wc-sw-arrow", "aria-hidden": "true" }), T.keyArrow),
              // the dot sizes, on the plot panel with the rest of the key: 1.3's size sentence and its group template
              h("span", { class: "prx-wc-key-wide prx-wc-size-lead" }, NL.cardLead),
              h("span", { class: "prx-wc-key-wide prx-wc-size-row" }, ...LEAGUE_APP.groups.map((g) => item(kk.swatch(g),
                h("span", {}, ...fill(NL.cardGroup, {
                  group: NL.groupWord[g], g: () => kk.count(GROUP[g].count), obs: () => kk.count(GROUP[g].obs, `obs-${g}`),
                  se: () => kk.setting(GROUP[g].se, `se-${g}`),
                }))))),
            ];
          },
          columns: [
            { label: T.tPostMean, value: (row) => pm[row.i], format: fmtValue },
            { label: T.tFollowed, value: (row) => (followed.has(row.i) ? T.yes : T.no) },
          ],
          title: (row) => (followed.has(row.i)
            ? words(T.keyFollowed, { pm: fmtValue(pm[row.i]), gap: fmtGap(row.est - row.theta), pgap: fmtGap(pm[row.i] - row.theta) })
            : words(T.keyOther, { pm: fmtValue(pm[row.i]) })),
        });
      }

      /**
       * "mean" and the mean over the replays at the top end of the dashed line (review 044 repair, X-01: the decisive
       * number on the changed mark): the word ends just left of the line and the number starts just right of it, in the
       * top row of the top margin, one row above the triangle of the replay shown (the dashed line reaches up to the
       * label, CONFIG.chart.meanLabel.lineTop); near an edge of the figure both move inward. The number is data-num with
       * the hook chart-mean-est or chart-mean-post.
       */
      function meanMarks(c, P, { which, mean, lo, hi, width }) {
        const L = C.meanLabel;
        const inner = Math.max(1, width - C.marginLeft - C.marginRight);
        const x = C.marginLeft + ((mean - lo) / (hi - lo)) * inner;
        const text = fmtGap(mean);
        const left = x - L.gap - L.char * T.meanWord.length;
        const right = x + L.gap + L.char * text.length;
        const dx = left < L.edge ? L.edge - left : right > width - L.edge ? width - L.edge - right : 0;
        const hook = (index, scales, values, dims, context, next) => {
          const g = next(index, scales, values, dims, context);
          for (const node of g?.querySelectorAll ? g.querySelectorAll("text") : []) node.setAttribute("data-prx-readout", `chart-mean-${which}`);
          return g;
        };
        const at = { x: (v) => v, frameAnchor: "top", dy: L.dy, lineAnchor: "middle", fill: c.plotFg };
        return [
          P.text([mean], { ...at, text: () => T.meanWord, dx: dx - L.gap, textAnchor: "end" }),
          numText([mean], { ...at, value: (v) => v, format: fmtGap, dx: dx + L.gap, textAnchor: "start", fontWeight: 600, render: hook }),
        ];
      }

      function drawHistogram(slot, { which, bins, lo, hi, yMax, mean, shown, R }) {
        const est = which === "est";
        const L = C.meanLabel;
        const measured = Math.round(slot.clientWidth || 0);
        const width = measured > 0 ? Math.max(L.minWidth, measured) : L.defaultWidth;
        plot(slot, {
          alt: est ? T.estAlt : T.postAlt,
          table: {
            caption: est ? T.estTable : T.postTable,
            columns: [
              { label: T.tFrom, value: "lo", format: fmtGap },
              { label: T.tTo, value: "hi", format: fmtGap },
              { label: T.tReplays, value: "n", format: (v) => formatCount(v) },
            ],
            rows: bins,
          },
          width,
          height: C.height,
          marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [lo, hi], label: est ? T.estX : T.postX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.xTicks },
          y: { domain: [0, yMax], nice: true, label: T.yLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.yTicks },
          marks: (c, P) => [
            P.rect(bins, { x1: "lo", x2: "hi", y1: 0, y2: "n", fill: est ? c.est : c.post, stroke: c.plotBg, strokeWidth: C.barRim }),
            P.ruleY([0], { stroke: c.plotAxis }),
            P.ruleX([ZERO], { stroke: c.plotAxis, strokeWidth: C.zeroWidth }),
            // the dashed mean line runs from the label row (above the triangle's row) down through the plot area
            P.ruleX([mean], { stroke: c.plotFg, strokeWidth: C.meanWidth, strokeDasharray: C.meanDash, insetTop: C.meanLabel.lineTop - C.marginTop }),
            P.ruleX([shown], { stroke: c.plotMuted, strokeWidth: C.shownWidth, strokeDasharray: C.shownDash }),
            P.dot([shown], { x: (v) => v, frameAnchor: "top", dy: C.markerDy, symbol: "triangle", rotate: 180, r: C.marker, fill: c.plotFg }),
            ...meanMarks(c, P, { which, mean, lo, hi, width }),
          ],
          keyboard: {
            data: bins, x: (b) => (b.lo + b.hi) / 2, y: "n", key: (b) => `${which}${b.i}`, label: est ? T.estKbd : T.postKbd,
            title: (b) => words(T.kbdBin, {
              which: est ? T.kbdEst : T.kbdPost, n: formatCount(b.n), R: formatCount(R), lo: fmtGap(b.lo), hi: fmtGap(b.hi),
            }),
          },
        });
      }

      function drawReplays(state, run, d, r) {
        const R = run.replays;
        const end = T.sideLower[state.side];
        const est = run.draws.map((x) => x.overshoot);
        const post = run.draws.map((x) => x.posteriorOvershoot);
        const b = replayBins(R, est, post);
        const yMax = Math.max(...b.est.map((x) => x.n), ...b.post.map((x) => x.n));
        const slots = { R: () => kit.count(R), end, k: () => kit.count(state.k) };
        distTitle.replaceChildren(...fill(T.distHead, slots));
        distNote.replaceChildren(...fill(T.distNote, slots));
        estHead.replaceChildren(...fill(T.estHead, { ...slots, mean: () => ro("mean-est", run.mean.overshoot, fmtGap(run.mean.overshoot)) }));
        postHead.replaceChildren(...fill(T.postHead, {
          ...slots, sd: () => ro("prior-sd", state.priorSd, formatSetting(state.priorSd)),
          mean: () => ro("mean-post", run.mean.posteriorOvershoot, fmtGap(run.mean.posteriorOvershoot)),
        }));
        drawHistogram(estSlot, { which: "est", bins: b.est, lo: b.lo, hi: b.hi, yMax, mean: run.mean.overshoot, shown: d.overshoot, R });
        drawHistogram(postSlot, { which: "post", bins: b.post, lo: b.lo, hi: b.hi, yMax, mean: run.mean.posteriorOvershoot, shown: d.posteriorOvershoot, R });
        const item = (cls, ...words) => h("span", { class: "prx-nl-key-item" }, h("span", { class: `prx-wc-sw ${cls}`, "aria-hidden": "true" }), ...words);
        distKey.replaceChildren(
          item("prx-wc-sw-bar prx-wc-sw-est", T.keyEstBar),
          item("prx-wc-sw-bar prx-wc-sw-postbar", T.keyPostBar),
          item("prx-wc-sw-zero", h("span", {}, ...fill(T.keyZero, { zero }))),
          item("prx-wc-sw-mean", T.keyMean),
          item("prx-wc-sw-marker", h("span", {}, ...fill(T.keyShown, { r: () => kit.count(r) }))),
        );
        // what the posterior means did on average, in words that follow what is left of the gap (p) against the gap
        // (e), with both averages in the sentence
        const e = run.mean.overshoot;
        const p = run.mean.posteriorOvershoot;
        const L = T.lead;
        const B = CONFIG.band;
        // a value that reads as zero at the digits shown is zero for the wording, so the lead never turns on a digit
        // the reader cannot see
        const shows = (x) => /[1-9]/.test(fmtGap(x));
        const left = p / e;
        const which = !shows(e) ? "level" : !shows(p) ? "all"
          : left < 0 ? (-left <= B.near ? "pastSlight" : "past")
            : left < 1 ? (left <= B.near ? "nearly" : left <= B.most ? "most" : "part") : "none";
        lead.replaceChildren(...fill(L[which], { e: () => ro("lead-est", e, fmtGap(e)), p: () => ro("lead-post", p, fmtGap(p)) }));
        // the replay shown beside the average over the replays
        const cell = (name, raw) => h("td", {}, ro(name, raw, fmtGap(raw)));
        const table = h("table", { class: "prx-nl-table prx-wc-table" },
          h("caption", {}, ...fill(T.tableCaption, { end, k: () => kit.count(state.k) })),
          h("thead", {}, h("tr", {},
            h("td", {}),
            h("th", { scope: "col" }, h("span", { class: "prx-wc-keep" }, ...fill(T.colShown, { r: () => kit.count(r) }))),
            h("th", { scope: "col" }, ...fill(T.colAverage, { R: () => kit.count(R) })))),
          h("tbody", {},
            h("tr", {}, h("th", { scope: "row", text: T.rowGap }), cell("shown-est", d.overshoot), cell("avg-est", e)),
            h("tr", {}, h("th", { scope: "row", text: T.rowPostGap }), cell("shown-post", d.posteriorOvershoot), cell("avg-post", p))));
        summary.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-nl-table-wrap" }, table), T.tableLabel));
        const se = (values, name) => () => { const m = mcse(values); return ro(name, m, fmtMcse(m)); };
        mcseNote.replaceChildren(...fill(T.mcseNote, { R: () => kit.count(R), a: se(est, "mcse-est"), b: se(post, "mcse-post") }));
      }

      function writeReadout(state, run, d, r) {
        ctx.readout.set(fill(T.readout, {
          End: T.sideWords[state.side], k: () => ro("read-k", state.k, formatCount(state.k)), R: () => ro("read-replays", run.replays, formatCount(run.replays)),
          e: () => ro("read-est", run.mean.overshoot, fmtGap(run.mean.overshoot)),
          p: () => ro("read-post", run.mean.posteriorOvershoot, fmtGap(run.mean.posteriorOvershoot)),
          sd: () => ro("read-prior-sd", state.priorSd, formatSetting(state.priorSd)),
          r: () => ro("read-replay", r, formatCount(r)), seed: () => ro("read-seed", d.seed, formatSetting(d.seed)),
          er: () => ro("read-shown-est", d.overshoot, fmtGap(d.overshoot)),
          pr: () => ro("read-shown-post", d.posteriorOvershoot, fmtGap(d.posteriorOvershoot)),
        }));
      }

      function writeCaption(state, run) {
        ctx.caption.replaceChildren(
          T.league, " ", T.postFrom, captionNode(ctx, "teaching-posterior"), ". ", SHRINK.text.gloss, " ",
          captionNode(ctx, "monte-carlo", { S: run.replays, seed: state.seed }),
          ...fill(T.replayNote, { seed: () => ro("caption-seed", state.seed, formatSetting(state.seed)) }),
        );
      }

      return {
        render(state) {
          const R = state.replays;
          // the replay shown is never beyond the replays run: a larger draw is set back to the last replay
          const r = Math.max(CONFIG.draw.min, Math.min(state.draw, R));
          if (r !== state.draw) ctx.set({ draw: r });
          side.set(state.side);
          kSlider.set(state.k);
          prior.set(state.priorSd);
          replays.set(state.replays);
          if (drawMax !== R) ctx.keepFocus(() => makeDrawSlider(R, r));
          else drawSlider.set(r);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);

          const run = overshootRun(state);
          const d = run.draws[r - 1];
          const shown = drawSummary(d.seed);
          const post = compute({ priorSd: state.priorSd, equalSe: false, seed: d.seed });
          // "Replay r of R (seed s + r)": the seed key, so the hint matches the seed box under it (the draw line above the
          // table gives the replay's own seed)
          drawHint.replaceChildren(...fill(T.drawHint, {
            r: () => ro("draw-replay", r, formatCount(r)), R: () => kit.count(R), seed: () => ro("draw-seed", state.seed, formatSetting(state.seed)),
            r2: () => kit.count(r),
          }));
          drawLine.replaceChildren(...drawLineNodes(ctx, r, d.seed, { prefix: "line" }));
          drawTable(state, shown, d, post);
          drawReplays(state, run, d, r);
          writeReadout(state, run, d, r);
          writeCaption(state, run);
        },
      };
    },
  });
}
