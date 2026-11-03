// noisy-league (app 1.3): "Ranking noisy estimates". Ported from postrank Explorer v1 L-03 (js/widgets/noisy-league.js
// and styles/widgets/noisy-league.css) without the prediction gate: everything the gate held back is shown at once.
//
// The simulated league comes live from the engine at any seed: league30() (30 units in three size groups, true values
// fixed by the specification and unrelated to size) and drawLeague(seed) (estimate = true value + SE × a seeded
// normal). The first draw uses the seed; replay r uses seed + r (leagueReplays). Linked views, all redrawn from one
// state { seed, reveal, replays, highlight, draw }:
//   size card      the three size groups (observations, SE, dot size) and the truth: which groups hold the true top 5
//                  and bottom 5
//   league table   one row per unit in estimate order, highest at the top: a vermillion dot at the estimate, its size
//                  the unit's SE (a larger dot is a noisier estimate: the small units, with the fewest observations,
//                  have the largest dots; never the true value). With the true values shown, a black diamond marks the
//                  true value, a gray line joins it to the estimate, and the true rank sits at the right. Dashed lines
//                  set off the top 5 and the bottom 5 (the 10 extreme positions); the highlight shades them and dims
//                  the other rows. Arrow keys move row by row.
//   tallies        the units of each size in the top 5, the bottom 5 and all 10 extreme positions of the draw shown
//                  (extremeCounts), beside the truth (extremeCounts on the true values) and the replays' average
//   replays        replays 1-20 (leagueReplays, which also gives the averages over the replays run so far): small and
//                  large units among the 10 extreme positions against the truth, and, with the true values shown, the
//                  pairs the estimates order the wrong way (misorderedPairs) against the closed-form expectation
//                  (expectedMisorderedPairs). "Replay ×20" steps through the replays (all at once under reduced
//                  motion); the draw menu (the draw key) chooses the draw the league table shows.
// Keys: seed (integer), reveal (1 or 0, or the flag words of CONFIG.flags), replays (0-20), highlight ("none" or
// "extremes"), draw (0 = the first draw, r = replay r; never more than the replays run).
//
// Exports for the apps that build on this league (1.4 winners-curse, 1.12 overlap-in-the-league):
//   the league        LEAGUE (league30()), GROUP (observations, SE and count per size group), TRUTH (extremeCounts of
//                     the true values), TRUE_RANK, EXPECTED (expectedMisorderedPairs), PAIRS (pairCount(30))
//   the draws         drawSummary(seed), leagueSummary(seed), summaryMemo(size), replayAverages(seed, count)
//   rows and axis     leagueRows(draw), valueDomain(summary, withReplays), isExtreme(pos, k)
//   the views         sizeCard(ctx), drawLeagueTable(ctx, slots, options), drawLineNodes(ctx, r, seed, options),
//                     drawTallies(ctx, slot, options), drawEndsChart(ctx, slots, options), drawWrongChart(ctx, slots,
//                     options), drawAverages(ctx, slots, options)
//   the replays       replayRunner(ctx, options) (the ×20 animation), drawSelect(ctx, options) (the draw menu)
//   helpers           parseFlag, fill, words, textKit(ctx), cssFor(rootClass) (the views' CSS under another root class)
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  LEAGUE_SEED, drawLeague, expectedMisorderedPairs, extremeCounts, league30, leagueReplays, misorderedPairs, pairCount,
  strictOrder, topKOverlap,
} from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "noisy-league",
  label: "Ranking noisy estimates: thirty simulated units ranked by their estimates, with replays",
  title: "Thirty units ranked by their estimates",
  className: "prx-nl",
  seed: Object.freeze({ min: 1, max: 4294967295, value: LEAGUE_SEED }),
  replays: Object.freeze({ min: 0, max: 20, value: 0 }),
  // the draw the league table shows: 0 = the first draw, r = replay r (never more than the replays run)
  draw: Object.freeze({ min: 0, max: 20, value: 0 }),
  highlight: Object.freeze({ values: Object.freeze(["none", "extremes"]), value: "none", on: "extremes", off: "none" }),
  flags: Object.freeze({ on: Object.freeze(["1", "true", "on", "yes"]), off: Object.freeze(["0", "false", "off", "no"]) }),
  // the extreme positions: the top k and the bottom k of a ranking; the hit rate counts the top `topK`
  k: 5,
  topK: 10,
  groups: Object.freeze(["small", "medium", "large"]),
  // dot radius (px) of each size group in the league table and the size card: the noisier the estimate (the larger
  // the SE), the larger the dot
  radius: Object.freeze({ small: 6.5, medium: 4.5, large: 3 }),
  // the replay chart's marks (counts, not estimates): small units as small filled dots, large units as large rings
  replayRadius: Object.freeze({ small: 3, large: 6.5 }),
  // one replay step of the animation (ms); the read-out is written once, when the last replay is in
  stepMs: 140,
  // memoized seeds (each holds the first draw and its replays)
  memo: 6,
  // estimates and true values at 3 decimals, averages over the replays at 2; the expected count of wrongly ordered pairs
  // is an expected count, at four significant digits (formatExpectedCount, register CR-002), as in 1.5 and 1.6
  digits: Object.freeze({ estimate: 3, average: 2 }),
  nice: Object.freeze({ step: 0.1, decimals: 12, pad: 0.02 }),
  chart: Object.freeze({
    row: 15, marginTop: 34, marginBottom: 40, marginLeft: 42, marginRight: 40, nameDx: 6, headDy: 6,
    diamond: 3.5, link: 1.5, dash: "4,3", dimOpacity: 0.3, halo: 1, xTicks: 6,
    replayHeight: 180, wrongHeight: 160, replayMarginTop: 26, replayMarginBottom: 38, replayMarginLeft: 40,
    replayMarginRight: 14, ring: 1.75, wrongDot: 3, yTicks: 5,
    replayTicks: Object.freeze([1, 5, 10, 15, 20]), half: 0.5, wrongHeadroom: 1.15, wrongStep: 20,
  }),
  text: Object.freeze({
    groupWord: Object.freeze({ small: "Small", medium: "Medium", large: "Large" }),
    // controls
    reveal: "Reveal true values",
    replay: "Replay ×{R}",
    highlight: "Highlight the extreme positions (top {k} and bottom {k})",
    seed: "Seed of the first draw",
    seedHint: "A seed, a whole number, fixes the noise of a draw, so the same seed always gives the same draw. Replay r uses this seed plus r.",
    draw: "Draw shown in the league table",
    drawFirst: "First draw",
    drawReplay: "Replay {r}",
    // size card
    cardLead: "Dot size shows how noisy a unit's estimate is: the larger the SE, the larger the dot, so the small units, with the fewest observations, have the largest dots. Size says nothing about the true value.",
    cardGroup: "{group}: {g} units, {obs} observations each, SE {se}",
    cardTruth: "Truly, the {ext} extreme positions (the true top {k} and bottom {k}) hold {trueSmall} small, {trueMedium} medium and {trueLarge} large units.",
    // league table
    leagueHead: "League table, ranked by estimate (highest at the top)",
    drawFirstLine: "First draw, seed {seed}",
    drawReplayLine: "Replay {r}, seed {seed}",
    drawFirstWords: "first draw, seed {seed}",
    drawReplayWords: "replay {r}, seed {seed}",
    // axis labels in plain words (an SVG text puts a combining hat over the subscript, not over θ)
    xEstimate: "Estimate",
    xBoth: "Estimate (dot) and true value (diamond)",
    colUnit: "Unit",
    colRank: "True\nrank",
    keyDot: "estimate θ̂ᵢ; a larger dot is a noisier estimate (a larger SE, fewer observations)",
    keyTick: "true value θᵢ",
    keyLink: "the noise in the estimate (estimate minus true value)",
    keyRank: "right column: the true rank ({one} = largest true value)",
    keySeparators: "dashed lines: the top {k} and the bottom {k} by estimate",
    keyShade: "shaded rows: the {ext} extreme positions; the other rows are dimmed",
    leagueAlt: "League table of the thirty units, one row per unit in the order of the estimates, highest at the top. Each dot is a unit's estimate; a larger dot is a noisier estimate, from a unit with fewer observations.",
    leagueAltReveal: " A black diamond marks each unit's true value, a gray line joins it to the estimate, and the true rank is written at the right.",
    leagueTable: "The units in the order of their estimates",
    leagueKbd: "League table: one point per unit, in the order of the estimates",
    tPosition: "Position by estimate",
    tUnit: "Unit",
    tSize: "Size",
    tObs: "Observations",
    tEstimate: "Estimate",
    tTheta: "True value",
    tTrueRank: "True rank",
    // tallies
    talliesCaption: "Units of each size at the ends of the estimate ranking. Top, bottom and all count this draw only ({draw}); the next columns give the truth and the replays' average.",
    talliesLabel: "Units of each size at the ends of the estimate ranking",
    hSize: "Size",
    hTop: "Top {k}",
    hBottom: "Bottom {k}",
    hAll: "All {ext}",
    hTruly: "Truly",
    hAverage: "Average, {R} replays",
    // replays
    replaysHead: "Replays: new noise in every estimate, the true values unchanged",
    endsHead: "Small and large units among the {ext} extreme positions, replay by replay",
    endsY: "Units among the extreme positions",
    replayX: "Replay",
    keySmall: "small units",
    keyLarge: "large units",
    // the replay chart's marks count units: their size tells the two groups apart and runs the other way from the
    // league table's dots, whose size is the SE
    keySizes: "here a mark's size shows the group, not the SE",
    keyTruth: "dashed line: the truth, {trueSmall} small and {trueLarge} large units",
    endsAlt: "Dot chart over the replays: for each replay, the number of small units (small filled dots) and of large units (large rings) among the extreme positions by estimate, with a dashed line at the true number.",
    endsTable: "Each replay: the units of each size among the extreme positions by estimate",
    endsKbd: "Replays: one point per replay",
    wrongHead: "Pairs the estimates order the wrong way, replay by replay (of {M} pairs)",
    wrongY: "Pairs in the wrong order",
    keyWrong: "dashed line: the number expected over many draws, {expected}",
    wrongAlt: "Dot chart over the replays: for each replay, the number of pairs of units that the estimates order differently from the true values, with a dashed line at the number expected over many draws.",
    wrongTable: "Each replay: the pairs the estimates order the wrong way",
    wrongKbd: "Pairs in the wrong order: one point per replay",
    tReplay: "Replay",
    tSeed: "Seed",
    tSmall: "Small units at the ends",
    tMedium: "Medium units at the ends",
    tLarge: "Large units at the ends",
    tTop: "Also in the true top ten",
    tWrong: "Pairs in the wrong order",
    averageEnds: "Average over the {R} replays: small units hold {avgSmall} of the {ext} extreme positions, medium units {avgMedium} and large units {avgLarge} (truly {trueSmall}, {trueMedium} and {trueLarge}).",
    averageTruth: "Of the top {topK} by estimate, {avgTop} are in the true top {topK} on average; the estimates order {avgWrong} of the {M} pairs the wrong way on average (expected over many draws: {expected}).",
    replayNote: "; replay r uses seed {seed} + r.",
    // read-out (one aria-live region): v1's three conditional sentences
    readEnds: "{draw}: of the {ext} extreme positions by estimate, small units hold {small}, medium units {medium} and large units {large}; truly they hold {trueSmall}, {trueMedium} and {trueLarge}.",
    readTruth: " Of the top {topK} by estimate, {top} are in the true top {topK}, and the estimates order {wrong} of the {M} pairs the wrong way (expected over many draws: {expected}).",
    readReplays: " Over {R} replays, small units hold {avgSmall} and large units {avgLarge} of the extreme positions on average.",
    // keyboard titles
    keyPoint: "Position {pos}: {id}, a {group} unit ({obs} observations, SE {se}); estimate {est}.",
    keyPointTruth: " True value {theta}, true rank {rank}.",
    keyReplay: "Replay {r} (seed {seed}): {small} small and {large} large units among the extreme positions.",
    keyReplayTruth: " {top} of the top {topK} in the true top {topK}; {wrong} pairs in the wrong order.",
    keyWrongPoint: "Replay {r} (seed {seed}): {wrong} pairs in the wrong order; expected {expected}.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const R = CONFIG.replays.max;
const K = CONFIG.k;

// ---------------------------------------------------------------------------------------------- the league

/** The thirty units (engine league30): ids, sizes, groups, SEs, true values. */
export const LEAGUE = league30();
const N_UNITS = LEAGUE.ids.length;
/** The pairs of the league (pairCount(30) = 435). */
export const PAIRS = pairCount(N_UNITS);
const EXT = 2 * K;
/** The true rank of each unit (1 = largest true value). */
export const TRUE_RANK = strictOrder(LEAGUE.theta);
/** The truth at the ends: extremeCounts of the true values (top, bottom and total by size group). */
export const TRUTH = extremeCounts(LEAGUE.theta, LEAGUE.group, K);
/** Pairs the estimates are expected to order the wrong way over many draws (closed form). */
export const EXPECTED = expectedMisorderedPairs(LEAGUE.theta, LEAGUE.se);
/** One unit of each group: its number of observations and SE (every unit of a group has the same), and the count. */
export const GROUP = Object.freeze(Object.fromEntries(CONFIG.groups.map((g) => {
  const i = LEAGUE.group.indexOf(g);
  return [g, Object.freeze({ obs: LEAGUE.size[i], se: LEAGUE.se[i], count: LEAGUE.group.filter((x) => x === g).length })];
})));

/** A boolean key: true, false, 1, 0 or the words of CONFIG.flags (a URL gives strings). */
export function parseFlag(v) {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (CONFIG.flags.on.includes(s)) return true;
  if (CONFIG.flags.off.includes(s)) return false;
  return undefined;
}

/** One draw of the league at a seed: the estimates and what the views show of them (all from the engine). */
export function drawSummary(seed) {
  const { estimate } = drawLeague(seed);
  return {
    seed,
    estimate,
    rank: strictOrder(estimate),
    ext: extremeCounts(estimate, LEAGUE.group, K),
    top: topKOverlap(estimate, LEAGUE.theta, CONFIG.topK).count,
    wrong: misorderedPairs(estimate, LEAGUE.theta).count,
  };
}

/** The replays seed + 1 … seed + count (engine leagueReplays: k extreme positions at each end, top group CONFIG.topK). */
const replayRun = (seed, count) => leagueReplays(seed, { replays: count, k: K, topK: CONFIG.topK });

/** Averages of an engine leagueReplays result: units of each group among the extreme positions, top overlap, wrong
 * pairs. */
function averagesOf(run) {
  return {
    ...Object.fromEntries(CONFIG.groups.map((g) => [g, run.mean.extreme[g]])),
    top: run.mean.topOverlap,
    wrong: run.mean.misordered,
  };
}

/** Averages over the first `count` replays of a seed (count ≥ 1), from the engine. */
export function replayAverages(seed, count) {
  return averagesOf(replayRun(seed, count));
}

/** The first draw at a seed and its R replays (seed + 1 … seed + R, engine leagueReplays), with the averages over all
 * R replays. */
export function leagueSummary(seed) {
  const first = drawSummary(seed);
  const run = replayRun(seed, R);
  const replays = run.draws.map((d) => ({
    r: d.r, seed: d.seed, estimate: d.estimate, rank: strictOrder(d.estimate), ext: d.extreme, top: d.topOverlap, wrong: d.misordered,
  }));
  return { seed, first, replays, avg: averagesOf(run) };
}

/** leagueSummary memoized over the `size` most recent seeds (first in, first out). */
export function summaryMemo(size = CONFIG.memo) {
  const memo = new Map();
  return (seed) => {
    if (!memo.has(seed)) {
      if (memo.size >= size) memo.delete(memo.keys().next().value);
      memo.set(seed, leagueSummary(seed));
    }
    return memo.get(seed);
  };
}

/** An axis domain on multiples of CONFIG.nice.step that holds every true value and every estimate of the first draw,
 * and once replays run, of every replay too (so the axis stays put while the replays step through). */
export function valueDomain(summary, withReplays = true) {
  const all = [...LEAGUE.theta, ...summary.first.estimate, ...(withReplays ? summary.replays.flatMap((d) => d.estimate) : [])];
  const { step, decimals, pad } = CONFIG.nice;
  const lo = Math.min(...all) - pad;
  const hi = Math.max(...all) + pad;
  const round = (x) => Number(x.toFixed(decimals));
  return [round(Math.floor(lo / step) * step), round(Math.ceil(hi / step) * step)];
}

/** The rows of the league table for one draw: position by estimate, unit, group, estimate, true value, true rank. */
export function leagueRows(draw) {
  const rows = LEAGUE.ids.map((id, i) => ({
    i, id, group: LEAGUE.group[i], obs: LEAGUE.size[i], se: LEAGUE.se[i], est: draw.estimate[i],
    theta: LEAGUE.theta[i], pos: draw.rank[i], trueRank: TRUE_RANK[i], r: CONFIG.radius[LEAGUE.group[i]],
  }));
  rows.sort((a, b) => a.pos - b.pos);
  return rows;
}

/** True for the top k and the bottom k positions of the league. */
export const isExtreme = (pos, k = K) => pos <= k || pos > N_UNITS - k;

// ---------------------------------------------------------------------------------------------- text helpers

/** "{name}" slots of a template filled with nodes (functions are called) or strings; returns the parts. */
export function fill(template, slots) {
  return String(template).split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (!m || !(m[1] in slots)) return p;
    const v = slots[m[1]];
    return typeof v === "function" ? v() : v;
  });
}

/** The same template as plain text (control labels, aria labels, keyboard titles). */
export const words = (template, slots) => String(template).replace(/\{(\w+)\}/g, (all, k) => (k in slots ? String(slots[k]) : all));

const KITS = new WeakMap();

/** Number and node helpers of one app (its ctx): every number on screen is a data-num span, with an optional read-out
 * hook (data-prx-readout); swatches of the size groups; the fixed numbers and the truth as slot nodes. */
export function textKit(ctx) {
  if (KITS.has(ctx)) return KITS.get(ctx);
  const { h } = ctx;
  const tagged = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
  const count = (raw, name) => tagged(ctx.num(raw, formatCount(raw)), name);
  const setting = (raw, name) => tagged(ctx.num(raw, formatSetting(raw)), name);
  const average = (raw, name) => tagged(ctx.num(raw, formatDecimal(raw, { digits: CONFIG.digits.average })), name);
  const expected = (name) => tagged(ctx.num(EXPECTED, formatExpectedCount(EXPECTED)), name);
  const swatch = (group, ring = false) => h("span", {
    class: `prx-nl-swatch prx-nl-swatch-${group}${ring ? " prx-nl-swatch-ring" : ""}`, "aria-hidden": "true",
  });
  const mark = (cls) => h("span", { class: cls, "aria-hidden": "true" });
  const truthNodes = (suffix = "") => ({
    trueSmall: () => count(TRUTH.total.small, suffix && `${suffix}-true-small`),
    trueMedium: () => count(TRUTH.total.medium, suffix && `${suffix}-true-medium`),
    trueLarge: () => count(TRUTH.total.large, suffix && `${suffix}-true-large`),
  });
  const fixedNodes = () => ({
    k: () => count(K), ext: () => count(EXT), R: () => count(R), topK: () => count(CONFIG.topK), M: () => count(PAIRS),
    n: () => count(N_UNITS),
  });
  const kit = { h, tagged, count, setting, average, expected, swatch, mark, truthNodes, fixedNodes };
  KITS.set(ctx, kit);
  return kit;
}

// ---------------------------------------------------------------------------------------------- views

/** The size card: the three size groups (observations, SE, a dot swatch at the league table's size) and the truth at
 * the ends. Returns the node (data-prx-part "legend"). */
export function sizeCard(ctx) {
  const k = textKit(ctx);
  const { h } = ctx;
  return ctx.part("legend", h("div", { class: "prx-nl-card" },
    h("p", { class: "prx-nl-card-lead", text: T.cardLead }),
    h("ul", { class: "prx-nl-card-groups" }, ...CONFIG.groups.map((g) => h("li", {},
      k.swatch(g),
      h("span", {}, ...fill(T.cardGroup, {
        group: T.groupWord[g], g: () => k.count(GROUP[g].count), obs: () => k.count(GROUP[g].obs, `obs-${g}`),
        se: () => k.setting(GROUP[g].se, `se-${g}`),
      }))))),
    h("p", { class: "prx-nl-card-truth" }, ...fill(T.cardTruth, { ...k.fixedNodes(), ...k.truthNodes("card") }))));
}

/** "First draw, seed s" or "Replay r, seed s" (lower: "first draw, seed s"), as parts; prefix names the read-out hooks
 * (`<prefix>-seed`, `<prefix>-replay`). */
export function drawLineNodes(ctx, r, seed, { prefix = "", lower = false } = {}) {
  const k = textKit(ctx);
  const seedNode = () => k.setting(seed, prefix && `${prefix}-seed`);
  return r === 0
    ? fill(lower ? T.drawFirstWords : T.drawFirstLine, { seed: seedNode })
    : fill(lower ? T.drawReplayWords : T.drawReplayLine, { r: () => k.count(r, prefix && `${prefix}-replay`), seed: seedNode });
}

/**
 * The league table of one draw in `slot` (one row per unit in estimate order, highest at the top) and its key in `key`.
 *   draw       a drawSummary, or a replay of leagueSummary: { seed, estimate, rank }
 *   domain     the x domain [lo, hi] (valueDomain)
 *   reveal     the true values: diamonds, links, true ranks, the reveal sentence of the alt text, two table columns
 *   highlight  shade the k rows at each end and dim the marks of the other rows
 *   k          the rows set off at each end by dashed lines (and shaded); default CONFIG.k
 *   marks      (c, P, rows) => extra Plot marks, drawn over the estimates and true values (an app that builds on the
 *              table adds its own marks here)
 *   keyItems   (kit) => extra key items (nodes); columns: extra hidden-table columns; title: (d) => extra keyboard text
 * Returns the chart.js handle.
 */
export function drawLeagueTable(ctx, { slot, key = null }, {
  draw, domain, reveal = false, highlight = false, k = K, marks = null, keyItems = null, columns = [], title = null,
} = {}) {
  const kit = textKit(ctx);
  const { h } = ctx;
  const rows = leagueRows(draw);
  const [lo, hi] = domain;
  const dim = (d) => (highlight && !isExtreme(d.pos, k) ? C.dimOpacity : 1);
  const height = C.marginTop + C.marginBottom + N_UNITS * C.row;
  const seps = [k + C.half, N_UNITS - k + C.half];
  const bands = [{ y1: C.half, y2: k + C.half }, { y1: N_UNITS - k + C.half, y2: N_UNITS + C.half }];
  const value3 = (v) => formatDecimal(v, { digits: CONFIG.digits.estimate });
  // the unit ids are names, not numbers (data-prx-name)
  const tagNames = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
    Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-name", rows[i].id));
    return g;
  };
  const cols = [
    { label: T.tPosition, value: "pos", format: (v) => formatCount(v) },
    { label: T.tUnit, value: "id" },
    { label: T.tSize, value: (d) => T.groupWord[d.group] },
    { label: T.tObs, value: "obs", format: (v) => formatCount(v) },
    { label: T.tEstimate, value: "est", format: value3 },
  ];
  if (reveal) {
    cols.push({ label: T.tTheta, value: "theta", format: value3 });
    cols.push({ label: T.tTrueRank, value: "trueRank", format: (v) => formatCount(v) });
  }
  cols.push(...columns);
  const chart = plot(slot, {
    alt: reveal ? T.leagueAlt + T.leagueAltReveal : T.leagueAlt,
    table: { caption: T.leagueTable, columns: cols, rows },
    height,
    marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
    x: { domain: [lo, hi], label: reveal ? T.xBoth : T.xEstimate, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.xTicks },
    y: { domain: [N_UNITS + C.half, C.half], axis: null },
    r: { type: "identity" },
    marks: (c, P) => [
      highlight ? P.rect(bands, { x1: lo, x2: hi, y1: "y1", y2: "y2", fill: c.plotGrid }) : null,
      P.ruleY(seps, { stroke: c.plotAxis, strokeDasharray: C.dash }),
      reveal ? P.link(rows, { x1: "est", x2: "theta", y1: "pos", y2: "pos", stroke: c.plotMuted, strokeWidth: C.link, strokeOpacity: dim }) : null,
      P.dot(rows, { x: "est", y: "pos", r: "r", fill: c.est, stroke: c.plotBg, strokeWidth: C.halo, fillOpacity: dim }),
      reveal ? P.dot(rows, { x: "theta", y: "pos", symbol: "diamond", r: C.diamond, fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, fillOpacity: dim }) : null,
      typeof marks === "function" ? marks(c, P, rows) : null,
      P.text(rows, { y: "pos", text: "id", frameAnchor: "left", textAnchor: "end", dx: -C.nameDx, fill: c.plotFg, render: tagNames }),
      P.text([T.colUnit], { text: (d) => d, frameAnchor: "top-left", textAnchor: "end", lineAnchor: "bottom", dx: -C.nameDx, dy: -C.headDy, fill: c.plotMuted }),
      reveal ? numText(rows, { y: "pos", value: "trueRank", format: (v) => formatCount(v), frameAnchor: "right", textAnchor: "middle", dx: C.marginRight * C.half, fill: c.plotFg }) : null,
      reveal ? P.text([T.colRank], { text: (d) => d, frameAnchor: "top-right", textAnchor: "middle", lineAnchor: "bottom", dx: C.marginRight * C.half, dy: -C.headDy, fill: c.plotMuted }) : null,
    ],
    keyboard: {
      data: rows, x: "est", y: "pos", key: (d) => d.id, sort: false, label: T.leagueKbd,
      title: (d) => {
        let text = words(T.keyPoint, {
          pos: formatCount(d.pos), id: d.id, group: T.groupWord[d.group].toLowerCase(), obs: formatCount(d.obs),
          se: formatSetting(d.se), est: value3(d.est),
        });
        if (reveal) text += words(T.keyPointTruth, { theta: value3(d.theta), rank: formatCount(d.trueRank) });
        if (typeof title === "function") text += title(d) ?? "";
        return text;
      },
    },
  });
  if (key) {
    const ends = { k: () => kit.count(k), ext: () => kit.count(2 * k) };
    const item = (...children) => h("span", { class: "prx-nl-key-item" }, ...children);
    const items = [
      item(kit.swatch("medium"), T.keyDot),
      item(kit.mark("prx-nl-swatch-dash"), h("span", {}, ...fill(T.keySeparators, ends))),
    ];
    if (reveal) {
      items.push(item(kit.mark("prx-nl-swatch-diamond"), T.keyTick));
      items.push(item(kit.mark("prx-nl-swatch-link"), T.keyLink));
      items.push(item(h("span", {}, ...fill(T.keyRank, { one: () => kit.count(1) }))));
    }
    if (highlight) items.push(item(kit.mark("prx-nl-swatch-shade"), h("span", {}, ...fill(T.keyShade, ends))));
    if (typeof keyItems === "function") items.push(...[keyItems(kit)].flat().filter(Boolean));
    key.replaceChildren(...items);
  }
  return chart;
}

/**
 * The tallies of the draw shown in `slot`: the units of each size in the top k, the bottom k and all 2k extreme
 * positions, the truth, and once replays have run the average over them (a table that scrolls inside its own box).
 *   draw     the draw shown ({ seed, ext }); shown: its index (0 = the first draw, r = replay r)
 *   seed     the seed of the first draw (replay r uses seed + r); replays: the replays run so far
 */
export function drawTallies(ctx, slot, { draw, shown = 0, seed, replays = 0 }) {
  const k = textKit(ctx);
  const { h } = ctx;
  const withAvg = replays > 0;
  const avg = withAvg ? replayAverages(seed, replays) : null;
  const cell = (tag, content, attrs = {}) => h(tag, attrs, ...[].concat(content));
  const head = [
    cell("th", T.hSize, { scope: "col" }),
    cell("th", fill(T.hTop, k.fixedNodes()), { scope: "col" }),
    cell("th", fill(T.hBottom, k.fixedNodes()), { scope: "col" }),
    cell("th", fill(T.hAll, k.fixedNodes()), { scope: "col" }),
    cell("th", T.hTruly, { scope: "col" }),
  ];
  if (withAvg) head.push(cell("th", fill(T.hAverage, { R: () => k.count(replays) }), { scope: "col" }));
  const body = CONFIG.groups.map((g) => {
    const tds = [
      cell("th", [k.swatch(g), T.groupWord[g]], { scope: "row" }),
      cell("td", k.count(draw.ext.top[g], `top-${g}`)),
      cell("td", k.count(draw.ext.bottom[g], `bottom-${g}`)),
      cell("td", k.count(draw.ext.total[g], `ext-${g}`)),
      cell("td", k.count(TRUTH.total[g], `truth-${g}`)),
    ];
    if (withAvg) tds.push(cell("td", k.average(avg[g], `avg-${g}`)));
    return h("tr", {}, ...tds);
  });
  const caption = h("caption", {}, ...fill(T.talliesCaption, { draw: () => h("span", {}, ...drawLineNodes(ctx, shown, draw.seed, { lower: true })) }));
  const wrap = h("div", { class: "prx-nl-table-wrap", "data-prx-focus-key": "nl-tallies" },
    h("table", { class: "prx-nl-table" }, caption, h("thead", {}, h("tr", {}, ...head)), h("tbody", {}, ...body)));
  // a table that may scroll sideways at 375 px is a keyboard stop, named by its caption
  ctx.scrollRegion(wrap, T.talliesLabel);
  slot.replaceChildren(wrap);
}

/** The replay axis: replays 1–R on a fixed domain (dots fill in from the left), and the marker of the replay shown. */
function replayAxis(shown) {
  return {
    x: { domain: [C.half, R + C.half], ticks: C.replayTicks.filter((t) => t <= R), label: T.replayX, labelAnchor: "center", labelArrow: "none" },
    marker: shown > 0 ? [shown] : [],
  };
}

/**
 * The ends chart: small units (small filled dots) and large units (large rings) among the extreme positions of each
 * replay run, a dashed line at the truth, and a vertical line at the replay the league table shows.
 *   slots    { head, slot, key }; options { run (the replays of leagueSummary run so far), reveal, shown }
 */
export function drawEndsChart(ctx, { head, slot, key }, { run, reveal = false, shown = 0 }) {
  const k = textKit(ctx);
  const { h } = ctx;
  const truthValues = [...new Set([TRUTH.total.small, TRUTH.total.large])];
  const axis = replayAxis(shown);
  head.replaceChildren(...fill(T.endsHead, k.fixedNodes()));
  const columns = [
    { label: T.tReplay, value: "r", format: (v) => formatCount(v) },
    { label: T.tSeed, value: "seed", format: (v) => formatSetting(v) },
    { label: T.tSmall, value: (d) => d.ext.total.small, format: (v) => formatCount(v) },
    { label: T.tMedium, value: (d) => d.ext.total.medium, format: (v) => formatCount(v) },
    { label: T.tLarge, value: (d) => d.ext.total.large, format: (v) => formatCount(v) },
  ];
  if (reveal) {
    columns.push({ label: T.tTop, value: "top", format: (v) => formatCount(v) });
    columns.push({ label: T.tWrong, value: "wrong", format: (v) => formatCount(v) });
  }
  plot(slot, {
    alt: T.endsAlt,
    table: { caption: T.endsTable, columns, rows: run },
    height: C.replayHeight,
    marginTop: C.replayMarginTop, marginBottom: C.replayMarginBottom, marginLeft: C.replayMarginLeft, marginRight: C.replayMarginRight,
    x: axis.x,
    y: { domain: [0, EXT], ticks: C.yTicks, label: T.endsY, labelArrow: "none", grid: true },
    r: { type: "identity" },
    marks: (c, P) => [
      P.ruleY(truthValues, { stroke: c.plotAxis, strokeDasharray: C.dash }),
      P.ruleX(axis.marker, { stroke: c.plotMuted }),
      P.dot(run, { x: "r", y: (d) => d.ext.total.large, r: CONFIG.replayRadius.large, fill: "none", stroke: c.est, strokeWidth: C.ring }),
      P.dot(run, { x: "r", y: (d) => d.ext.total.small, r: CONFIG.replayRadius.small, fill: c.est }),
    ],
    keyboard: {
      data: run, x: "r", y: (d) => d.ext.total.small, key: (d) => `r${d.r}`, sort: false, label: T.endsKbd,
      title: (d) => {
        const base = words(T.keyReplay, { r: formatCount(d.r), seed: formatSetting(d.seed), small: formatCount(d.ext.total.small), large: formatCount(d.ext.total.large) });
        return reveal ? base + words(T.keyReplayTruth, { top: formatCount(d.top), topK: formatCount(CONFIG.topK), wrong: formatCount(d.wrong) }) : base;
      },
    },
  });
  key.replaceChildren(
    h("span", { class: "prx-nl-key-item" }, k.swatch("replay-small"), T.keySmall),
    h("span", { class: "prx-nl-key-item" }, k.swatch("replay-large", true), T.keyLarge),
    h("span", { class: "prx-nl-key-item prx-nl-key-sizes" }, T.keySizes),
    h("span", { class: "prx-nl-key-item" }, k.mark("prx-nl-swatch-dash"), h("span", {}, ...fill(T.keyTruth, k.truthNodes()))),
  );
}

/**
 * The wrong-pairs chart (shown only with the true values): the pairs each replay's estimates order the wrong way, a
 * dashed line at the closed-form expectation, and the marker of the replay shown. slots { part, head, slot, key }.
 */
export function drawWrongChart(ctx, { part, head, slot, key }, { run, reveal = false, shown = 0 }) {
  const k = textKit(ctx);
  const { h } = ctx;
  part.hidden = !reveal;
  if (!reveal) return;
  const axis = replayAxis(shown);
  head.replaceChildren(...fill(T.wrongHead, k.fixedNodes()));
  const top = Math.max(EXPECTED, ...run.map((d) => d.wrong)) * C.wrongHeadroom;
  const yMax = Math.ceil(top / C.wrongStep) * C.wrongStep;
  plot(slot, {
    alt: T.wrongAlt,
    table: {
      caption: T.wrongTable,
      columns: [
        { label: T.tReplay, value: "r", format: (v) => formatCount(v) },
        { label: T.tSeed, value: "seed", format: (v) => formatSetting(v) },
        { label: T.tWrong, value: "wrong", format: (v) => formatCount(v) },
      ],
      rows: run,
    },
    height: C.wrongHeight,
    marginTop: C.replayMarginTop, marginBottom: C.replayMarginBottom, marginLeft: C.replayMarginLeft, marginRight: C.replayMarginRight,
    x: axis.x,
    y: { domain: [0, yMax], ticks: C.yTicks, label: T.wrongY, labelArrow: "none", grid: true },
    marks: (c, P) => [
      P.ruleY([EXPECTED], { stroke: c.plotAxis, strokeDasharray: C.dash }),
      P.ruleX(axis.marker, { stroke: c.plotMuted }),
      P.dot(run, { x: "r", y: "wrong", r: C.wrongDot, fill: c.plotFg }),
    ],
    keyboard: {
      data: run, x: "r", y: "wrong", key: (d) => `w${d.r}`, sort: false, label: T.wrongKbd,
      title: (d) => words(T.keyWrongPoint, {
        r: formatCount(d.r), seed: formatSetting(d.seed), wrong: formatCount(d.wrong), expected: formatExpectedCount(EXPECTED),
      }),
    },
  });
  key.replaceChildren(h("span", { class: "prx-nl-key-item" }, k.mark("prx-nl-swatch-dash"),
    h("span", {}, ...fill(T.keyWrong, { expected: () => k.expected() }))));
}

/**
 * The averages over all R replays and the Monte Carlo caption ("Monte Carlo, R draws, seed s; replay r uses seed s +
 * r."), written once every replay is in and nothing animates (done). slots { lines, caption }.
 */
export function drawAverages(ctx, { lines, caption }, { summary, reveal = false, done = false }) {
  lines.hidden = !done;
  caption.hidden = !done;
  if (!done) return;
  const k = textKit(ctx);
  const { h } = ctx;
  const s = summary;
  const slots = {
    ...k.fixedNodes(), ...k.truthNodes(),
    avgSmall: () => k.average(s.avg.small, "avg-ends-small"), avgMedium: () => k.average(s.avg.medium, "avg-ends-medium"),
    avgLarge: () => k.average(s.avg.large, "avg-ends-large"), avgTop: () => k.average(s.avg.top, "avg-top"),
    avgWrong: () => k.average(s.avg.wrong, "avg-wrong"), expected: () => k.expected("expected-wrong"),
  };
  const out = [h("p", {}, ...fill(T.averageEnds, slots))];
  if (reveal) out.push(h("p", {}, ...fill(T.averageTruth, slots)));
  lines.replaceChildren(...out);
  caption.replaceChildren(captionNode(ctx, "monte-carlo", { S: R, seed: s.seed }), ...fill(T.replayNote, { seed: () => k.setting(s.seed) }));
}

// ---------------------------------------------------------------------------------------------- replay machinery

/**
 * The ×R replay: run() steps r = 1 … count every stepMs (onStep(r) for each; `running` is true meanwhile and `region`
 * carries aria-busy), then onDone(). Under reduced motion run() calls onStep(count) once, with nothing running. run()
 * stops a running animation and starts again from replay 1; stop() ends it; destroy ends it too.
 */
export function replayRunner(ctx, { count = R, stepMs = CONFIG.stepMs, region = null, onStep, onDone } = {}) {
  let step = null;
  let cancel = null;
  const stop = () => {
    cancel?.();
    cancel = null;
    step = null;
    region?.removeAttribute("aria-busy");
  };
  const run = () => {
    stop();
    if (ctx.reducedMotion) {
      onStep?.(count);
      return;
    }
    region?.setAttribute("aria-busy", "true");
    const next = (r) => {
      step = r;
      onStep?.(r);
      if (r < count) cancel = ctx.timeout(() => next(r + 1), stepMs);
      else {
        stop();
        onDone?.();
      }
    };
    next(1);
  };
  ctx.onCleanup(stop);
  return { run, stop, get running() { return step !== null; }, get step() { return step; } };
}

/**
 * The draw menu: "First draw", "Replay 1" … "Replay count". sync(replays, shown) hides and disables the replays not
 * yet run, hides the menu while none has run, and selects the draw shown. onChange(r) gets the chosen draw.
 */
export function drawSelect(ctx, { onChange, count = R } = {}) {
  const sel = ctx.select({
    label: T.draw, name: "draw", value: 0,
    options: Array.from({ length: count + 1 }, (_, r) => ({ value: r, label: r === 0 ? T.drawFirst : words(T.drawReplay, { r: formatCount(r) }) })),
    onChange,
  });
  sel.root.classList.add("prx-nl-draw");
  return {
    ...sel,
    sync(replays, shown) {
      for (const [r, opt] of Array.from(sel.input.options).entries()) {
        opt.disabled = r > replays;
        opt.hidden = r > replays;
      }
      sel.set(shown);
      sel.root.hidden = replays === 0;
    },
  };
}

// ---------------------------------------------------------------------------------------------- CSS

// The views' CSS; %r stands for the root class of the app that shows them, so every selector starts with it.
const CSS_TEMPLATE = `
%r .prx-nl-card { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.9em; color: var(--prx-plot-fg);
  background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
%r .prx-nl-card p { margin: 0.25rem 0; }
%r .prx-nl-card-groups { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0.35rem 0; padding: 0; list-style: none; }
%r .prx-nl-card-groups > li { display: inline-flex; align-items: center; gap: 0.45rem; min-width: 0; margin: 0; }
%r .prx-nl-swatch { flex: none; display: inline-block; box-sizing: border-box; border-radius: 50%; background: var(--prx-est);
  border: 1px solid var(--prx-plot-bg); }
%r .prx-nl-swatch-small { width: 13px; height: 13px; }
%r .prx-nl-swatch-medium { width: 9px; height: 9px; }
%r .prx-nl-swatch-large { width: 6px; height: 6px; }
%r .prx-nl-swatch-replay-small { width: 6px; height: 6px; }
%r .prx-nl-swatch-replay-large { width: 13px; height: 13px; }
%r .prx-nl-swatch-ring { background: transparent; border: 2px solid var(--prx-est); }
%r .prx-nl-swatch-diamond { flex: none; display: inline-block; width: 6px; height: 6px; margin: 0 1px; background: var(--prx-plot-fg);
  transform: rotate(45deg); }
%r .prx-nl-swatch-link { flex: none; display: inline-block; width: 1.25rem; height: 0; border-top: 2px solid var(--prx-plot-muted); }
%r .prx-nl-swatch-dash { flex: none; display: inline-block; width: 1.25rem; height: 0; border-top: 1.5px dashed var(--prx-plot-axis); }
%r .prx-nl-swatch-shade { flex: none; display: inline-block; width: 1em; height: 0.8em; background: var(--prx-plot-grid);
  border: 1px solid var(--prx-cell-border); }
%r .prx-nl-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
%r .prx-nl-toggle[aria-pressed="true"] { color: var(--prx-on-accent); background: var(--prx-accent); border-color: var(--prx-accent); }
%r .prx-nl-seed { flex: 1 1 16rem; max-width: 24rem; }
%r .prx-nl-seed input[type="number"] { width: 9rem; max-width: 100%; }
%r .prx-nl-seed .prx-hint { margin: 0.15rem 0 0; }
%r .prx-nl-charts { container-type: inline-size; }
%r .prx-nl-views { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.5rem; align-items: start; }
@container (min-width: 56rem) {
  %r .prx-nl-views { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto 1fr;
    grid-template-areas: "league tallies" "league replays"; }
  %r .prx-nl-league { grid-area: league; }
  %r .prx-nl-tallies { grid-area: tallies; }
  %r .prx-nl-replays { grid-area: replays; }
  %r .prx-nl-tallies .prx-nl-table-wrap { margin-top: 0; }
}
%r .prx-nl-league, %r .prx-nl-tallies, %r .prx-nl-replays, %r .prx-nl-league-chart, %r .prx-nl-replay-chart { min-width: 0; max-width: 100%; }
%r .prx-nl-heading { margin: 0 0 0.25rem; font-size: 0.95em; font-weight: 600; line-height: 1.3; color: var(--prx-fg-heading); }
%r .prx-nl-subheading { margin: 0.75rem 0 0.25rem; font-size: 0.9em; font-weight: 600; line-height: 1.3; color: var(--prx-fg); }
%r .prx-nl-drawline { margin: 0 0 0.25rem; font-size: 0.9em; color: var(--prx-fg-muted); }
%r .prx-nl-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.35rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.85em;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border-radius: var(--prx-radius); }
%r .prx-nl-key-item { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
%r .prx-nl-table-wrap { max-width: 100%; margin: 0.75rem 0 0; overflow-x: auto; }
%r .prx-nl-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.9em; font-variant-numeric: tabular-nums; }
%r .prx-nl-table caption { caption-side: top; padding: 0 0 0.35rem; text-align: left; color: var(--prx-fg); }
%r .prx-nl-table th, %r .prx-nl-table td { padding: 0.2rem 0.5rem; text-align: right; border-bottom: 1px solid var(--prx-border); }
%r .prx-nl-table thead th { font-weight: 600; vertical-align: bottom; white-space: normal; overflow-wrap: normal; }
@media (max-width: 30em) {
  %r .prx-nl-table th, %r .prx-nl-table td { padding: 0.2rem 0.3rem; }
}
%r .prx-nl-table tbody th { font-weight: 400; text-align: left; white-space: nowrap; }
%r .prx-nl-table tbody th .prx-nl-swatch { margin-right: 0.4rem; vertical-align: middle; }
%r .prx-nl-summary p { margin: 0.5rem 0 0; font-size: 0.95em; }
%r .prx-nl-caption { margin: 0.35rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); }
`;

/** The CSS of the views above, every selector under `.rootClass` (an app that shows them adds it to its own css). */
export const cssFor = (rootClass) => CSS_TEMPLATE.replaceAll("%r", `.${rootClass}`);

// ---------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    css: cssFor(CONFIG.className),
    keys: {
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      reveal: { type: "custom", value: false, parse: (v) => parseFlag(v) },
      replays: { type: "integer", min: CONFIG.replays.min, max: CONFIG.replays.max, value: CONFIG.replays.value },
      highlight: { type: "choice", values: CONFIG.highlight.values, value: CONFIG.highlight.value },
      draw: { type: "integer", min: CONFIG.draw.min, max: CONFIG.draw.max, value: CONFIG.draw.value },
    },
    build(ctx) {
      const { h } = ctx;
      const kit = textKit(ctx);
      const summaryOf = summaryMemo(CONFIG.memo);
      // true while the app changes its own replays and draw keys (the replay button), so render does not take the
      // change for one from outside
      let own = false;
      const setOwn = (partial) => {
        own = true;
        try { ctx.set(partial); } finally { own = false; }
      };

      // --- size card (before the controls)
      const card = sizeCard(ctx);

      // --- controls
      const revealBtn = ctx.button({ label: T.reveal, key: "reveal", onClick: () => ctx.set({ reveal: !ctx.state.reveal }) });
      revealBtn.root.classList.add("prx-nl-toggle");
      const replayBtn = ctx.button({ label: words(T.replay, { R: formatCount(R) }), key: "replay", primary: true, onClick: () => runner.run() });
      const highlight = ctx.toggle({
        label: words(T.highlight, { k: formatCount(K) }), name: "highlight", checked: ctx.state.highlight === CONFIG.highlight.on,
        onChange: (b) => ctx.set({ highlight: b ? CONFIG.highlight.on : CONFIG.highlight.off }),
      });
      const seedHintId = uid("prx-nl-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      seed.root.classList.add("prx-nl-seed");
      // the draw the league table shows (shown once replays have run; a control, so its option names are not read-outs)
      const select = drawSelect(ctx, { onChange: (r) => ctx.set({ draw: r }) });
      ctx.controls.append(h("div", { class: "prx-nl-buttons" }, revealBtn.root, replayBtn.root), select.root, highlight.root, seed.root);
      ctx.controls.before(card);

      // --- league table (with the tallies)
      const drawLine = h("p", { class: "prx-nl-drawline", "data-prx-part": "notes" });
      const leagueSlot = h("div", { class: "prx-nl-league-chart" });
      const leagueKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const tallies = h("div", { class: "prx-nl-tallies", "data-prx-part": "readout" });
      const leagueBox = h("section", { class: "prx-nl-league", "aria-label": T.leagueHead },
        h("h4", { class: "prx-nl-heading", text: T.leagueHead }), drawLine, leagueSlot, leagueKey);

      // --- replays
      const endsSlot = h("div", { class: "prx-nl-replay-chart prx-nl-ends-chart" });
      const endsKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const wrongSlot = h("div", { class: "prx-nl-replay-chart prx-nl-wrong-chart" });
      const wrongKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const endsHead = h("h5", { class: "prx-nl-subheading", "data-prx-part": "notes" });
      const wrongHead = h("h5", { class: "prx-nl-subheading", "data-prx-part": "notes" });
      const wrongPart = h("div", { class: "prx-nl-wrong" }, wrongHead, wrongSlot, wrongKey);
      const summaryLines = h("div", { class: "prx-nl-summary", "data-prx-part": "readout", hidden: true });
      const replayCaption = h("p", { class: "prx-nl-caption", "data-prx-part": "caption", hidden: true });
      const replayInner = h("div", { class: "prx-nl-replay-inner" },
        h("h4", { class: "prx-nl-heading", text: T.replaysHead }), endsHead, endsSlot, endsKey, wrongPart, summaryLines, replayCaption);
      const replayBox = h("section", { class: "prx-nl-replays", "aria-label": T.replaysHead }, replayInner);
      ctx.charts.classList.add("prx-nl-charts");
      // the tallies follow the league table (one column); in two columns they sit beside it, above the replays
      ctx.charts.append(h("div", { class: "prx-nl-views" }, leagueBox, tallies, replayBox));

      // --- replays: one step per CONFIG.stepMs (each shows replay r in the league table), or all at once under
      // reduced motion; the read-out, the averages and the caption are written when the last replay is in
      const runner = replayRunner(ctx, {
        count: R,
        region: replayInner,
        onStep: (r) => {
          const now = ctx.state;
          if (now.replays === r && now.draw === r) ctx.requestRender("replay-step");
          else setOwn({ replays: r, draw: r });
        },
        onDone: () => ctx.requestRender("replays-done"),
      });

      function writeReadout(state, draw, s, shown) {
        const parts = [...fill(T.readEnds, {
          ...kit.fixedNodes(), ...kit.truthNodes("read"),
          draw: () => h("span", {}, ...drawLineNodes(ctx, shown, draw.seed, { prefix: "read" })),
          small: () => kit.count(draw.ext.total.small, "read-small"), medium: () => kit.count(draw.ext.total.medium, "read-medium"),
          large: () => kit.count(draw.ext.total.large, "read-large"),
        })];
        if (state.reveal) {
          parts.push(...fill(T.readTruth, {
            ...kit.fixedNodes(), top: () => kit.count(draw.top, "read-top"), wrong: () => kit.count(draw.wrong, "read-wrong"),
            expected: () => kit.expected("read-expected"),
          }));
        }
        if (state.replays === R) {
          parts.push(...fill(T.readReplays, {
            R: () => kit.count(R), avgSmall: () => kit.average(s.avg.small, "read-avg-small"), avgLarge: () => kit.average(s.avg.large, "read-avg-large"),
          }));
        }
        ctx.readout.set(parts);
      }

      return {
        render(state, info) {
          const changed = new Set(info.changed);
          // an outside change of the replays (a preset, a query, an update) stops a running animation; unless it names
          // a draw too, the league table shows the first draw again. The draw shown is never beyond the replays run.
          const outside = changed.has("replays") && !own && info.reason !== "mount";
          if (outside && runner.running) runner.stop();
          const shown = outside && !changed.has("draw") ? 0 : Math.max(0, Math.min(state.draw, state.replays));
          if (shown !== state.draw) {
            // the draw key follows the draw on screen, set once this render is over (a render does not change the
            // state it draws); a newer change of the two keys wins
            const from = { draw: state.draw, replays: state.replays };
            ctx.timeout(() => {
              const now = ctx.state;
              if (now.draw === from.draw && now.replays === from.replays) ctx.set({ draw: shown });
            }, 0);
          }

          revealBtn.root.setAttribute("aria-pressed", String(state.reveal));
          highlight.set(state.highlight === CONFIG.highlight.on);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
          select.sync(state.replays, shown);
          replayInner.hidden = state.replays === 0;

          const s = summaryOf(state.seed);
          const draw = shown === 0 ? s.first : s.replays[shown - 1];
          if (!runner.running) writeReadout(state, draw, s, shown);
          drawLine.replaceChildren(...drawLineNodes(ctx, shown, draw.seed, { prefix: "draw" }));
          drawLeagueTable(ctx, { slot: leagueSlot, key: leagueKey }, {
            draw, domain: valueDomain(s, state.replays > 0), reveal: state.reveal, highlight: state.highlight === CONFIG.highlight.on,
          });
          drawTallies(ctx, tallies, { draw, shown, seed: s.seed, replays: state.replays });
          if (state.replays > 0) {
            const run = s.replays.slice(0, state.replays);
            drawEndsChart(ctx, { head: endsHead, slot: endsSlot, key: endsKey }, { run, reveal: state.reveal, shown });
            drawWrongChart(ctx, { part: wrongPart, head: wrongHead, slot: wrongSlot, key: wrongKey }, { run, reveal: state.reveal, shown });
            drawAverages(ctx, { lines: summaryLines, caption: replayCaption }, {
              summary: s, reveal: state.reveal, done: state.replays === R && !runner.running,
            });
          }
        },
        destroy() { runner.stop(); },
      };
    },
  });
}
