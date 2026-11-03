// which-ranking (app 1.14): "Three rankings from one posterior". Ported from postrank Explorer v1 L-09
// (js/widgets/which-ranking.js and styles/widgets/which-ranking.css) without the prediction gate: the read-out, the unit
// card, the rank distributions and all three columns of the slope chart are shown at once. v1's collapsed box on the
// chapter 10 law on orders is its own app, 1.15 (majority-wins).
//
// One posterior answers different ranking questions differently. Linked views, all redrawn from one state:
//   posterior  the three-unit law's two states (a table with the posterior means), or a note on the league
//   orders     a slope chart: three columns, each listing the units from 1st (top) to last by one summary, the posterior
//              mean (larger first), the expected rank (smaller first; theory book ch. 5, the unit's average position
//              under the posterior) and the probability of being in the top k (k = 1: of being first). A line joins each
//              unit's places, so crossing lines show pairs that two summaries order differently. Runs of equal values sit
//              in a dashed box and keep the order of the column before, so a box adds no crossing of its own
//   ranks      each unit's rank distribution (one bar per rank, on one scale for all units), its expected rank (a
//              diamond) and its 90% rank interval (engine rankIntervals), rows in the order of the chosen summary
//   card       the selected unit (or the one under the pointer): its numbers and its worked expected rank, and on another
//              scale its worked posterior mean
// The scale switch puts the same posterior on another increasing scale: √θ for the three-unit law, exp(kθ) for the
// league (engine transformedMeans). Only the posterior-mean column moves. Expected ranks, rank distributions and
// top-group probabilities depend on the order of the units in each state alone, which a common increasing change of
// scale keeps (theory book ch. 4 and ch. 12, "Invariance under common strictly increasing transformations"), so they are
// the ones computed on θ.
// Data: the theory book's ch. 19 law, exact (rankSummaries; direction probabilities from finiteLawPairwise), and the
// simulated league (league30, drawLeague(LEAGUE_SEED), normalPosterior): exact posterior means and expected ranks
// (expectedRank of the normal errorArray, as postrank_expected_rank()), Monte Carlo top-group probabilities, rank
// distributions and rank intervals (rankSummariesMC, 4,000 draws, seed 1; caption "Monte Carlo, 4,000 draws, seed 1").
// Orders and equal-value blocks come from scoreOrder (equal scores in id order), the pairs two orders put differently
// from misorderedPairs.
// Speed: each league prior SD is computed once and kept, and every step of the prior-SD slider is computed ahead in
// idle time, nearest to the current prior SD first, so a drag redraws without drawing 4,000 posterior samples again.
// A change of the selected unit toggles attributes on the drawn marks and redraws only the card.
//
// Keys: data ("puzzle" | "league"), summary ("mean" | "expected_rank" | "top"), k (1-10; the three-unit law uses at
// most 2), priorSd (.02-.60, league only), scale ("theta", or the data set's other scale: "sqrt" for the law, "exp"
// for the league), expK (k of exp(kθ), 1-20), unit (the selected unit's id; "" = the default unit, which follows the
// summary, k and prior SD).
//
// Exports for the apps that build on these views (1.15 majority-wins imports them):
//   data         dataset(data, priorSd) (memoized), topOrder(d, k), kFor(d, k), scaledMeans(d, scale, k), LAW, LEAGUE
//   columns      rankColumns(n, specs) (slots, shared places and equal-value blocks of any list of orders),
//                columns(d, k, scaled), placeText(col, u, tiedWord), defaultUnit(cols, summary), ordinal(n)
//   the views    drawSlopeChart(ctx, slot, options) (labels on plot-paper boxes; headers kept apart on a narrow
//                chart), drawRankDistributions(ctx, slot, options), markUnits(svgs, selected, hovered),
//                slopeUnitAt(geom, event), rowUnitAt(geom, event), captionedTable(ctx, table, caption, label) (a table
//                with its caption above its scroll box)
//   helpers      fill(template, slots), fillText(template, slots), tagUnits(rows), cssFor(rootClass) (the views' CSS
//                under another root class), CONFIG (geometry in CONFIG.bump and CONFIG.ranks; CONFIG.narrowPx, the app
//                width below which formulas set their result on a line of its own)
import { appLink, createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatPercent, formatProb, formatSetting, formatSig } from "../shared/format.js";
import { captionNode, exposeResult } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, drawLeague, errorArray, expectedRank, finiteLawPairwise, league30, misorderedPairs, normalPosterior,
  pairCount, rankIntervals, rankSummaries, rankSummariesMC, scoreOrder, transformedMeans,
} from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "which-ranking",
  label: "Three rankings from one posterior: the units ranked by posterior mean, by expected rank and by the probability of being in the top group, with each unit's rank distribution",
  className: "prx-wr",
  data: Object.freeze({ values: Object.freeze(["puzzle", "league"]), value: "puzzle" }),
  summary: Object.freeze({ values: Object.freeze(["mean", "expected_rank", "top"]), value: "mean" }),
  k: Object.freeze({ min: 1, max: 10, step: 1, value: 1, puzzleMax: 2 }),
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  priorMean: 0,
  // the scale of the true values: θ as given, or the data set's other increasing scale
  scale: Object.freeze({ values: Object.freeze(["theta", "sqrt", "exp"]), value: "theta", puzzle: "sqrt", league: "exp" }),
  expK: Object.freeze({ min: 1, max: 20, step: 1, value: 10 }),
  // the theory book's ch. 19 law: two states of (A, B, C) and their probabilities
  law: Object.freeze({
    ids: Object.freeze(["A", "B", "C"]),
    states: Object.freeze([Object.freeze([20, 4, 3]), Object.freeze([0, 4, 3])]),
    probs: Object.freeze([0.3, 0.7]),
  }),
  mc: Object.freeze({ S: 4000, seed: 1 }),
  level: 0.9,
  half: 0.5,
  tieTol: 1e-12,
  // data sets kept: every step of the prior-SD slider ((.60 − .02) / .01 + 1 = 59) plus the three-unit law
  memo: 64,
  // idle precompute of the prior-SD steps: requestIdleCallback's timeout, or the delay between steps without it (ms)
  idle: Object.freeze({ timeout: 1000, fallbackMs: 40 }),
  listed: 5,
  ordinal: Object.freeze({ hundred: 100, teens: Object.freeze([11, 12, 13]) }),
  digits: Object.freeze({
    puzzle: Object.freeze({ value: 0, mean: 0, er: 1, prob: 1, scaled: 2 }),
    league: Object.freeze({ mean: 3, sd: 3, se: 2, er: 2, prob: 2, scaledSig: 3 }),
  }),
  // slope chart geometry (px); x runs over the three columns, y over the places
  bump: Object.freeze({
    puzzle: Object.freeze({ rowH: 46, marginTop: 50, marginBottom: 12, marginLeft: 30, marginRight: 46, maxWidth: 520, dot: 6, font: 13, valueFont: 12, labelGap: 11, tieW: 0.16 }),
    league: Object.freeze({ rowH: 15, marginTop: 50, marginBottom: 8, marginLeft: 38, marginRight: 38, maxWidth: 560, dot: 3.4, font: 10, valueFont: 10, labelGap: 7, tieW: 0.1 }),
    headerFont: 12, headerGap: 8, band: 0.3, bandEnd: 0.16, bandHead: 0.92, tiePad: 0.42, tieClear: 1.5, halo: 3, dash: "3,3", line: 1.25, lineOpacity: 0.55,
    // a plot-paper box behind every unit id and value label, so that no line runs through a label (its padding, as a
    // share of the label's own box)
    labelBox: Object.freeze({ padX: 0.12, padY: 0.04 }),
    // narrow charts: the headers' font steps down (to minFont at most) until neighboring headers keep minGap px apart;
    // they are measured only below fitBelow px (at 12 px they touch below about 370 px), so a desktop render reads no
    // layout back
    headerFit: Object.freeze({ fitBelow: 440, minGap: 4, minFont: 9, passes: 4 }),
  }),
  // rank-distribution geometry: row i spans [i, i + 1] in y; bars stand on `base`, the interval and diamond at `ivY`.
  // League rows are 28 px, so that bars of a few hundredths still show (their height stays p over the largest
  // probability of any rank of any unit)
  ranks: Object.freeze({
    puzzle: Object.freeze({ rowH: 58, marginTop: 10, marginBottom: 44, marginLeft: 30, marginRight: 14, maxWidth: 520, bar: 0.28, base: 0.66, height: 0.5, ivY: 0.85, font: 13, valueFont: 11, diamond: 6, ivWidth: 1.5, ticks: null }),
    league: Object.freeze({ rowH: 28, marginTop: 10, marginBottom: 44, marginLeft: 38, marginRight: 10, maxWidth: 560, bar: 0.42, base: 0.72, height: 0.66, ivY: 0.88, font: 9, valueFont: 0, diamond: 3.4, ivWidth: 1, ticks: Object.freeze([1, 5, 10, 15, 20, 25, 30]) }),
    labelOffset: 34, labelGap: 6, valueDy: -3, cap: 0.32,
  }),
  // below this app width (px) a formula sets its result on a line of its own (CR-065)
  narrowPx: 400,
  text: Object.freeze({
    // controls
    dataLegend: "Data",
    dataPuzzle: "Three-unit law (theory book, chapter 19)",
    dataLeague: "Simulated league (30 units)",
    summaryLegend: "Rank the units by",
    summaryMean: "Posterior mean (larger first)",
    summaryEr: "Expected rank (smaller first)",
    summaryTop: "Probability of being in the top group (larger first)",
    kLegend: "Top group",
    kFirst: "First place only",
    kTopTwo: "Top two",
    kLabel: "Size of the top group (1 = first place only)",
    priorLabel: "Prior SD of the league's teaching posterior",
    // {app}: the title of app 1.5, a link once it is built (base.js appLink)
    priorHint: "A smaller prior SD pulls the league's posterior means closer together and narrows each posterior (see {app}).",
    shrinkageApp: "shrinkage",
    scaleLegend: "Scale of the true values θ",
    scaleTheta: "θ as given",
    scaleSqrt: "√θ",
    scaleExp: "exp(kθ)",
    scaleHintPuzzle: "The same posterior on another increasing scale: both states keep their order of the three units.",
    scaleHintLeague: "The same posterior on another increasing scale: every state of the true values keeps its order of the units.",
    expKLabel: "k in exp(kθ)",
    expKHint: "A larger k bends the scale more.",
    howTo: "Hover, focus or tap a dot or a row to follow one unit; a click, a tap or keyboard focus selects it. With the keyboard, Tab to a figure and use the arrow keys.",
    numberWords: Object.freeze(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]),
    // the scale in words
    sqrtSym: "√θ",
    expSym: "exp(kθ)",
    expOneSym: "exp(θ)",
    // posterior table (three-unit law)
    lawHeading: "The posterior: two possible states of the true values",
    lawCaption: "The posterior of the three-unit law: each row is one state of the three true values",
    lawTable: "The two states of the three-unit law",
    colState: "State",
    colProb: "Probability",
    colOrder: "Order, highest first",
    stateHigh: "Large A",
    stateLow: "Small A",
    meanRow: "Posterior mean",
    meanRowTheta: "Posterior mean of θ",
    meanRowScale: "Posterior mean of {scale}",
    meanNote: "A's posterior mean, {mean}, is a value A takes in neither state.",
    meanNoteScale: " On the {scale} scale A's posterior mean, {a}, falls below B's {b} and C's {c}. The states and the order of the units in each stay as they are, so the expected ranks and the probabilities of being first or in the top two do not move.",
    leagueLaw: "Each league unit has an independent normal posterior, the teaching posterior of {app}. Hover or focus a unit to see its posterior mean and SD.",
    leagueWidths: " The posteriors differ in width: posterior SD {small} for the small units, {medium} for the medium and {large} for the large. With one common width, independent normal posteriors would put the posterior means and the expected ranks in the same order (theory book, chapter 5).",
    leagueLawExp: " On the exp(kθ) scale a wider posterior raises a unit's posterior mean, so of two units with the same posterior mean of θ the wider one comes first; the card works it out for the selected unit.",
    // slope chart
    bumpHeading: "Three summaries, three orders",
    bumpNote: "Each column lists the units from 1st (top) to last. A line joins each unit's places; where two lines cross, two summaries order that pair differently. The shaded column is the summary chosen above.",
    tieNote: "Dashed box: units with equal values; the order inside a box means nothing.",
    scaleNote: "Only the first column moves: on the {scale} scale the posterior means put {moved} of the {M} pairs in another order than the posterior means of θ. The expected ranks, the rank distributions and the probabilities of being in the top group stay, because {scale} keeps the order of the units in every state of the true values (postrank theory book, chapter 12).",
    colMean: "Posterior\nmean",
    colMeanScale: "Posterior mean\nof {scale}",
    colEr: "Expected\nrank",
    colTopFirst: "Probability\nof being first",
    colTopK: "Probability of being\nin the top {k}",
    bumpAlt: "Slope chart with three columns that list the units from first (top) to last: by {mean}, by expected rank and by {top}. A line joins each unit's three places; crossing lines show pairs that two summaries order differently.",
    bumpKeyboard: "Places in the three columns. Left and Right move across the columns, Up and Down one place.",
    bumpTable: "Each unit's place by the three summaries (rows {order})",
    colUnit: "Unit",
    colPlaceMean: "Place by posterior mean",
    colPlaceMeanScale: "Place by posterior mean of {scale}",
    colPlaceEr: "Place by expected rank",
    colPlaceTop: "Place by this probability",
    tied: "shared ",
    byMean: "By posterior mean",
    byMeanScale: "By posterior mean of {scale}",
    byEr: "By expected rank",
    byTop: "By {top}",
    meanWords: "posterior mean",
    meanWordsScale: "posterior mean of {scale}",
    // rank distributions
    ranksHeading: "Each unit's rank distribution",
    ranksNote: "Bars: the probability of each rank, on one scale for all units. Diamond: the expected rank. Line: the {level} rank interval; the unit ranks better than the line's left end with probability at most {tail}, and worse than its right end with probability at most {tail}.",
    ranksAlt: "Rank distributions: for each unit, rows {order}, bars give the probability of each rank from first (left) to last, a diamond marks the expected rank and a line the {level} rank interval.",
    ranksKeyboard: "Rank distributions, one unit per row. Up and Down move one row.",
    ranksXLabel: "Rank (1st = largest true value)",
    ranksTable: "Rank distributions: the probability of each rank, the expected rank and the {level} rank interval of each unit (rows {order})",
    colRankProb: "Pr({place})",
    colExpected: "Expected rank",
    colLower: "Rank interval, best end",
    colUpper: "Rank interval, worst end",
    rowTitlePuzzle: "{id}: {probs}; expected rank {er}; {level} rank interval {lo} to {hi}.",
    rowTitleLeague: "{id}: expected rank {er}; {level} rank interval {lo} to {hi}; most likely rank {mode} (probability {pmode}).",
    rankWith: "{place} with probability {p}",
    // unit card and formulas
    cardSelected: "Selected unit",
    cardHovered: "Unit under the pointer",
    cardLine: "{id}: posterior mean {mean} ({pmean}); expected rank {er} ({per}); {top} {ptop} ({pplace}); {level} rank interval from rank {lo} to rank {hi}.",
    cardLeague: "{id}, a {group} unit (SE {se}), posterior SD {sd}.",
    cardScale: "On the {scale} scale its posterior mean is {m} ({place}).",
    cardWorked: "The worked expected rank",
    cardWorkedScale: "The worked posterior mean on the other scale",
    formulaNote: "The expected rank is the average place under the posterior ({one} at the top); chapter 5 of the theory book writes it as one plus the probabilities that each other unit is higher. No two units here can have equal true values; where they can, postrank's expected rank also counts each unit with an equal value as higher.",
    probFirst: "probability of being first",
    probTopK: "probability of being in the top {k}",
    // read-out
    readPuzzle: "Three-unit law",
    readLeague: "Simulated league, prior SD ",
    readRanked: ", ranked by {summary}: ",
    summaryWordsMean: "posterior mean",
    summaryWordsMeanScale: "the posterior mean of {scale}",
    summaryWordsEr: "expected rank",
    summaryWordsFirst: "the probability of being first",
    summaryWordsTopK: "the probability of being in the top {k}",
    readMore: ", and so on",
    readMis: " Posterior mean and expected rank order {mis} of the {M} pairs differently.",
    readMisScale: " The posterior mean of {scale} and the expected rank order {mis} of the {M} pairs differently.",
    subjectMean: "The posterior mean",
    subjectMeanScale: "The posterior mean of {scale}",
    readFirstSame: " {subject} also ranks {first} first.",
    readFirstDiff: " {subject} ranks {mean} first instead.",
    readZeros: " {count} units are never in the top {k} in these draws and share the last place.",
    readZerosFirst: " {count} units are never first in these draws and share the last place.",
    readMc: " (Monte Carlo)",
    // notes and captions
    notePuzzle: "Three units with two possible states of their true values, after the postrank theory book, chapter 19. The law is specified directly (no data, no fitted model), so every value here is exact.",
    noteLeague: "Simulated league of {n} units (ten small, ten medium, ten large), one fixed draw of the estimates (seed {seed}); teaching posterior with a normal prior of mean {zero} and SD {prior}. Posterior means and expected ranks are exact. Changing the Monte Carlo seed would move only the Monte Carlo summaries, not the exact expected ranks.",
    mcLead: "Top-group probabilities and rank distributions: ",
    postLead: "The league's posterior: ",
    groupWords: Object.freeze({ small: "small", medium: "medium", large: "large" }),
  }),
});

const T = CONFIG.text;
const BUMP = CONFIG.bump;
const RANKS = CONFIG.ranks;
const HALF = CONFIG.half;

// ---------------------------------------------------------------------------------------------- data

/** The theory book's ch. 19 law (ids, two states, their probabilities). */
export const LAW = CONFIG.law;
/** The simulated league (engine league30): ids, sizes, groups, SEs, true values. */
export const LEAGUE = league30();
const LEAGUE_IDS = Object.freeze(Array.from(LEAGUE.ids));
const LEAGUE_EST = Object.freeze(Array.from(drawLeague(LEAGUE_SEED).estimate));
const LEAGUE_SE = Object.freeze(Array.from(LEAGUE.se));
const STEP_DIGITS = 2;
/** Every step of the prior-SD slider, as the slider writes it. */
const PRIOR_GRID = Object.freeze(Array.from(
  { length: Math.round((CONFIG.priorSd.max - CONFIG.priorSd.min) / CONFIG.priorSd.step) + 1 },
  (_, i) => Number((CONFIG.priorSd.min + i * CONFIG.priorSd.step).toFixed(STEP_DIGITS)),
));
/** The values the unit key takes: "" (the default unit) or a unit id of either data set. */
const UNIT_VALUES = Object.freeze(["", ...LAW.ids, ...LEAGUE_IDS]);

/** "{name}" slots of a template filled with strings, nodes, arrays of these or functions (called for fresh nodes);
 * returns the parts as one flat list. A node used twice gets a copy the second time (a node sits in one place only). */
export function fill(template, slots) {
  const used = new Set();
  return String(template).split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (!m || !(m[1] in slots)) return p;
    let v = slots[m[1]];
    if (typeof v === "function") v = v();
    if (v && typeof v === "object" && typeof v.cloneNode === "function") {
      if (used.has(v)) return v.cloneNode(true);
      used.add(v);
    }
    return v;
  }).flat(Infinity);
}

/** The same template as plain text (labels, alt text, keyboard titles). */
export const fillText = (template, slots) => [fill(template, slots)].flat(Infinity)
  .map((p) => (typeof p === "string" ? p : p?.textContent ?? String(p))).join("");

/** "1st", "2nd", "3rd", "4th", "11th", "22nd" … */
export function ordinal(n) {
  const v = n % CONFIG.ordinal.hundred;
  if (CONFIG.ordinal.teens.includes(v)) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

const memo = new Map();
const memoKey = (data, priorSd) => (data === "league" ? `league:${priorSd}` : "puzzle");

/** One data set (the league at one prior SD, or the three-unit law): ids, posterior means, exact expected ranks, the
 * rank distribution (rankProbs[r][i] = Pr(rank r + 1), pTop[k][i] = Pr(rank ≤ k + 1)), 90% rank intervals, orders by
 * mean and by expected rank, and the pairs those two orders put differently. All from the engine; memoized. */
export function dataset(data, priorSd = CONFIG.priorSd.value) {
  const key = memoKey(data, priorSd);
  const hit = memo.get(key);
  if (hit) return hit;
  let d;
  if (data === "league") {
    const post = normalPosterior(Array.from(LEAGUE_EST), Array.from(LEAGUE_SE), { priorMean: CONFIG.priorMean, priorSd });
    const mean = Array.from(post.mean);
    const sd = Array.from(post.sd);
    const er = expectedRank(errorArray(mean, sd, { ids: LEAGUE_IDS.slice() }));
    const mc = rankSummariesMC(mean, sd, CONFIG.mc.S, CONFIG.mc.seed);
    d = { data, priorSd, ids: LEAGUE_IDS.slice(), mean, sd, er, rankProbs: mc.rankProbs, pTop: mc.pTop, pi: null, mc, exact: false };
  } else {
    const r = rankSummaries({ states: LAW.states.map((s) => s.slice()), probs: LAW.probs.slice() });
    const pair = finiteLawPairwise(LAW.states.map((s) => s.map((v) => [v])), LAW.probs.slice(), { ids: LAW.ids.slice() });
    d = { data, priorSd: null, ids: LAW.ids.slice(), mean: r.means, sd: null, er: r.expectedRank, rankProbs: r.rankProbs, pTop: r.pTop, pi: pair.pi[0], mc: null, exact: true };
  }
  d.n = d.ids.length;
  d.M = pairCount(d.n);
  d.byMean = scoreOrder(d.mean, { direction: "descending", ids: d.ids });
  d.byEr = scoreOrder(d.er, { direction: "ascending", ids: d.ids });
  // pairs the two orders put differently (the expected rank negated so that both scores rank larger first)
  d.misordered = misorderedPairs(d.mean, d.er.map((v) => -v)).count;
  const ri = rankIntervals(d.pTop, { level: CONFIG.level, tieTol: CONFIG.tieTol });
  d.interval = ri.lower.map((lo, i) => ({ lo, hi: ri.upper[i] }));
  // the bars' common scale (presentation): the largest probability of any rank of any unit
  d.pmax = Math.max(...d.rankProbs.flat());
  d.byTop = new Map();
  d.scaled = new Map();
  if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
  memo.set(key, d);
  return d;
}

/** The order by the probability of being in the top k (engine scoreOrder), cached on the data set. */
export function topOrder(d, k) {
  if (!d.byTop.has(k)) d.byTop.set(k, scoreOrder(d.pTop[k - 1], { direction: "descending", ids: d.ids }));
  return d.byTop.get(k);
}

/** The usable top-group size for a data set. */
export const kFor = (d, k) => Math.max(1, Math.min(k, d.data === "puzzle" ? CONFIG.k.puzzleMax : CONFIG.k.max, d.n - 1));

/**
 * The posterior means on another scale (engine transformedMeans), or null for θ: √θ for the three-unit law, exp(kθ) for
 * the league. Returns { transform, k, means, byMean (scoreOrder), moved (pairs ordered against the means of θ),
 * misordered (pairs ordered against the expected ranks) }, cached on the data set.
 */
export function scaledMeans(d, scale, k = CONFIG.expK.value) {
  if (!scale || scale === "theta") return null;
  const transform = d.data === "puzzle" ? CONFIG.scale.puzzle : CONFIG.scale.league;
  const key = transform === "exp" ? `exp:${k}` : transform;
  if (d.scaled.has(key)) return d.scaled.get(key);
  const law = d.data === "puzzle"
    ? { states: LAW.states.map((s) => s.map((v) => [v])), probs: LAW.probs.slice() }
    : { means: d.mean.slice(), sds: d.sd.slice() };
  const t = transformedMeans(law, transform === "exp" ? { transform, k } : { transform });
  const out = {
    transform, k: transform === "exp" ? k : null, means: t.means,
    byMean: scoreOrder(t.means, { direction: "descending", ids: d.ids }),
    moved: misorderedPairs(t.means, d.mean).count,
    misordered: misorderedPairs(t.means, d.er.map((v) => -v)).count,
  };
  d.scaled.set(key, out);
  return out;
}

/**
 * Columns of a slope chart from any list of orders: specs = [{ key, so (engine scoreOrder), value }]. For each column,
 * every unit's slot (0 = top), its shared place (equal values share the best place), the order (unit per slot), the
 * blocks of equal values and the set of units in them. Inside a block the units keep the order of the column before,
 * so a block adds no crossing of its own.
 */
export function rankColumns(n, specs) {
  let prev = null;
  return specs.map((s, c) => {
    const slot = new Array(n);
    const place = new Array(n);
    const blocks = [];
    let at = 0;
    for (const size of s.so.blocks) {
      let members = s.so.order.slice(at, at + size);
      if (prev && size > 1) members = members.slice().sort((a, b) => prev[a] - prev[b]);
      members.forEach((u, j) => { slot[u] = at + j; place[u] = at + 1; });
      if (size > 1) blocks.push({ first: at, last: at + size - 1, size, units: members });
      at += size;
    }
    prev = slot;
    const order = new Array(n);
    slot.forEach((sl, u) => { order[sl] = u; });
    return { c, key: s.key, value: s.value, slot, place, order, blocks, tied: new Set(blocks.flatMap((b) => b.units)) };
  });
}

/** The three columns of this app: posterior mean (on the chosen scale), expected rank, probability of the top k. */
export function columns(d, k, scaled = null) {
  return rankColumns(d.n, [
    { key: "mean", so: scaled ? scaled.byMean : d.byMean, value: scaled ? scaled.means : d.mean },
    { key: "expected_rank", so: d.byEr, value: d.er },
    { key: "top", so: topOrder(d, k), value: d.pTop[k - 1] },
  ]);
}

/** "6th", or "shared 23rd" for a place that units with equal values share. */
export const placeText = (col, u, tiedWord = T.tied) => `${col.tied.has(u) ? tiedWord : ""}${ordinal(col.place[u])}`;

/** The default unit: the highest by posterior mean whose place under the summary differs from its place by posterior
 * mean (for the posterior mean itself: by expected rank); the first by posterior mean when none differs. */
export function defaultUnit(cols, summary) {
  const other = cols[summary === "top" ? 2 : 1];
  const mean = cols[0];
  for (const u of mean.order) if (other.place[u] !== mean.place[u]) return u;
  return mean.order[0];
}

// ---------------------------------------------------------------------------------------------- views

/** A Plot render hook that tags each drawn mark with its unit (data-prx-unit), name and role, so that highlighting
 * toggles attributes instead of redrawing. Relies on Plot drawing one child per index, in index order. */
export const tagUnits = (rows) => (index, scales, values, dims, context, next) => {
  const g = next(index, scales, values, dims, context);
  const nodes = g?.children ? Array.from(g.children) : [];
  Array.from(index).forEach((i, j) => {
    const node = nodes[j];
    if (!node) return;
    node.setAttribute("data-prx-unit", String(rows[i].u));
    if (rows[i].name) node.setAttribute("data-prx-name", rows[i].name);
    if (rows[i].role) node.setAttribute("data-prx-role", rows[i].role);
  });
  return g;
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** An SVG <defs> with a filter that paints a plot-paper box behind an element (the element's own box, padded by a
 * share of its size), then the element over it: a label drawn with it is never struck through by a line. */
function labelBoxDefs(doc, id, color) {
  const { padX, padY } = BUMP.labelBox;
  const defs = doc.createElementNS(SVG_NS, "defs");
  const filter = doc.createElementNS(SVG_NS, "filter");
  for (const [k, v] of [["id", id], ["x", -padX], ["y", -padY], ["width", 1 + 2 * padX], ["height", 1 + 2 * padY]]) filter.setAttribute(k, String(v));
  const flood = doc.createElementNS(SVG_NS, "feFlood");
  flood.setAttribute("flood-color", color);
  const over = doc.createElementNS(SVG_NS, "feComposite");
  over.setAttribute("in", "SourceGraphic");
  over.setAttribute("operator", "over");
  filter.append(flood, over);
  defs.append(filter);
  return defs;
}

/**
 * Keep a slope chart's headers apart on a narrow chart: measure them (only below CONFIG.bump.headerFit.fitBelow px)
 * and, where two neighbors come closer than minGap px, step their font down together, each header scaled about its
 * own anchor (the outer headers stay at the outer dot edges and the middle one centered), to minFont at most.
 */
function fitHeaders(svg, width) {
  const F = BUMP.headerFit;
  if (!(width < F.fitBelow) || !svg?.querySelectorAll) return;
  const heads = [...svg.querySelectorAll('[data-prx-role="header"]')];
  if (heads.length < 2 || typeof heads[0].getBoundingClientRect !== "function") return;
  // boxes on the screen (each header has a transform of its own, so its getBBox is local); a header not laid out
  // (width 0, as in jsdom) stops the fit
  const boxesOf = () => heads.map((t) => {
    const b = t.getBoundingClientRect();
    const anchor = t.getAttribute("text-anchor") ?? t.closest("[text-anchor]")?.getAttribute("text-anchor") ?? "start";
    const at = anchor === "end" ? b.right : anchor === "middle" ? (b.left + b.right) / 2 : b.left;
    return { left: b.left, right: b.right, at, width: b.width };
  }).sort((a, b) => a.at - b.at);
  // a system font does not narrow in proportion to its size (small sizes are set wider), so the step is measured
  // again, a few times at most
  for (let pass = 0; pass < F.passes; pass += 1) {
    const boxes = boxesOf();
    if (boxes.some((b) => !(b.width > 0))) return;
    // gap'(s) = (at_b − at_a) + s · ((left_b − at_b) − (right_a − at_a)) for a font scaled by s about each anchor
    let s = 1;
    for (let k = 1; k < boxes.length; k += 1) {
      const a = boxes[k - 1];
      const b = boxes[k];
      const grow = (a.right - a.at) - (b.left - b.at);
      if (grow > 0 && b.left - a.right < F.minGap) s = Math.min(s, (b.at - a.at - F.minGap) / grow);
    }
    if (!(s < 1)) return;
    const current = Number(heads[0].getAttribute("font-size")) || BUMP.headerFont;
    const size = Math.max(F.minFont, Math.floor(current * s * 10) / 10);
    if (!(size < current)) return;
    for (const t of heads) t.setAttribute("font-size", String(size));
  }
}

/** fitHeaders now, and again once the page's fonts have loaded (a font that arrives later is wider or narrower). */
function keepHeadersApart(svg, width) {
  fitHeaders(svg, width);
  const fonts = svg?.ownerDocument?.fonts;
  if (width < BUMP.headerFit.fitBelow && fonts?.status === "loading" && fonts.ready) {
    fonts.ready.then(() => { if (svg.isConnected) fitHeaders(svg, width); });
  }
}

/**
 * The slope chart in `slot`: one column per order listing the units from 1st (top) to last, one muted line per unit
 * between consecutive columns, hollow dots, a dashed box around each run of equal values, a grid band behind the chosen
 * column (its header bold). Every id and value label stands on a plot-paper box, so no line runs through it; on a
 * narrow chart the headers' font steps down until they keep apart (fitHeaders).
 *   ids, cols      unit ids; rankColumns(...) output
 *   headers        one header per column ("\n" breaks the line)
 *   chosen         index of the shaded column
 *   geometry       CONFIG.bump.puzzle or CONFIG.bump.league (or one of their shape)
 *   labels         "all": ids left of every dot and values right of it (few units); "ends": ids left of the first and
 *                  right of the last column, values drawn for every dot but shown by CSS for the highlighted unit only
 *   valueText      (c, v) => the display of column c's value v
 *   title          (point) => the keyboard title of a point { u, c, slot, value }
 *   alt, table     the text alternative and hidden table (chart.js)
 *   keyboardLabel  the keyboard layer's label; onFocus(u) runs when a point is shown (selects its unit)
 * Returns the geometry for slopeUnitAt and markUnits: { n, width, height, mt, ml, mr, rowH, cols, svg, area, blocks }.
 */
export function drawSlopeChart(ctx, slot, {
  ids, cols, headers, chosen = 0, geometry: G, labels = "all", valueText, title, alt, table, keyboardLabel, onFocus, width: wanted,
}) {
  const n = ids.length;
  const avail = Math.max(1, Math.round(wanted || slot.clientWidth || ctx.width()));
  const width = Math.min(avail, G.maxWidth);
  const mt = G.marginTop;
  const rowH = G.rowH;
  const height = mt + G.marginBottom + n * rowH;
  const last = cols.length - 1;
  const nodes = [];
  for (const col of cols) for (let u = 0; u < n; u += 1) nodes.push({ u, c: col.c, slot: col.slot[u], value: col.value[u], name: ids[u], role: "node" });
  const links = [];
  for (let u = 0; u < n; u += 1) {
    for (let c = 0; c < last; c += 1) links.push({ u, x1: c, y1: cols[c].slot[u], x2: c + 1, y2: cols[c + 1].slot[u], role: "link" });
  }
  const blocks = cols.flatMap((col) => col.blocks.map((b) => ({ ...b, c: col.c })));
  // a box's half-width (in columns): the geometry's, but never so wide that its edge runs into a unit's label
  const colPx = Math.max(1, (width - G.marginLeft - G.marginRight) / Math.max(1, last));
  const tieW = Math.min(G.tieW, (G.labelGap - BUMP.tieClear) / colPx);
  const all = labels === "all";
  const idLeft = (all ? nodes : nodes.filter((x) => x.c === 0)).map((x) => ({ ...x, role: "id" }));
  const idRight = all ? [] : nodes.filter((x) => x.c === last).map((x) => ({ ...x, role: "id" }));
  const valueRows = cols.map((col) => nodes.filter((x) => x.c === col.c).map((x) => ({ ...x, role: "value" })));
  const heads = headers.map((text, c) => ({ c, text, on: c === chosen }));
  // the keyboard reads slot by slot across the columns (a grid of `columns` points per row)
  const kbData = Array.from({ length: n }, (_, s) => cols.map((col) => nodes.find((x) => x.c === col.c && x.slot === s))).flat();
  // labels on plot-paper boxes: the filter is defined once per chart, in the first label mark (given its color)
  const boxId = uid("prx-wr-labelbox");
  const boxed = (rows, defsColor = null) => (index, scales, values, dims, context, next) => {
    const g = tagUnits(rows)(index, scales, values, dims, context, next);
    if (!g?.querySelectorAll) return g;
    g.querySelectorAll("text").forEach((t) => t.setAttribute("filter", `url(#${boxId})`));
    if (defsColor) g.append(labelBoxDefs(context.document, boxId, defsColor));
    return g;
  };
  // the headers are tagged, so that fitHeaders can find them
  const header = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    g?.querySelectorAll?.("text").forEach((t) => t.setAttribute("data-prx-role", "header"));
    return g;
  };
  const handle = plot(slot, {
    alt, table, width, height,
    marginTop: mt, marginBottom: G.marginBottom, marginLeft: G.marginLeft, marginRight: G.marginRight,
    x: { domain: [0, last], axis: null },
    y: { domain: [n - HALF, -HALF], axis: null },
    marks: (c, P) => [
      P.rect([{ c: chosen }], {
        x1: (b) => b.c - (b.c === 0 ? BUMP.bandEnd : BUMP.band), x2: (b) => b.c + (b.c === last ? BUMP.bandEnd : BUMP.band),
        y1: n - HALF, y2: -HALF - (BUMP.bandHead * mt) / rowH, fill: c.plotGrid,
      }),
      P.rect(blocks, {
        x1: (b) => b.c - tieW, x2: (b) => b.c + tieW, y1: (b) => b.first - BUMP.tiePad, y2: (b) => b.last + BUMP.tiePad,
        fill: "none", stroke: c.plotAxis, strokeDasharray: BUMP.dash, rx: G.dot,
      }),
      P.link(links, {
        x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: c.plotMuted, strokeWidth: BUMP.line, strokeOpacity: BUMP.lineOpacity,
        render: tagUnits(links),
      }),
      P.dot(nodes, { x: "c", y: "slot", r: G.dot, fill: c.plotBg, stroke: c.plotFg, strokeWidth: BUMP.line, render: tagUnits(nodes) }),
      P.text(idLeft, {
        x: "c", y: "slot", text: "name", dx: -G.labelGap, textAnchor: "end", fill: c.plotFg, fontSize: G.font, fontWeight: "bold",
        stroke: c.plotBg, strokeWidth: BUMP.halo, paintOrder: "stroke", render: boxed(idLeft, c.plotBg),
      }),
      P.text(idRight, {
        x: "c", y: "slot", text: "name", dx: G.labelGap, textAnchor: "start", fill: c.plotFg, fontSize: G.font, fontWeight: "bold",
        render: boxed(idRight),
      }),
      ...valueRows.map((rows, ci) => numText(rows, {
        x: "c", y: "slot", value: "value", format: (v) => valueText(ci, v),
        ...(!all && ci === last ? { dx: -G.labelGap, textAnchor: "end" } : { dx: G.labelGap, textAnchor: "start" }),
        fill: c.plotFg, fontSize: G.valueFont, stroke: c.plotBg, strokeWidth: BUMP.halo, paintOrder: "stroke",
        ...(all ? {} : { dy: -G.labelGap }),
        render: boxed(rows),
      })),
      // one mark per header: text anchor, offset and weight are constants of a Plot mark, not channels
      ...heads.map((hd) => P.text([hd], {
        x: "c", frameAnchor: "top", dy: -BUMP.headerGap, lineAnchor: "bottom", text: "text",
        textAnchor: hd.c === 0 ? "start" : hd.c === last ? "end" : "middle",
        dx: hd.c === 0 ? -G.dot : hd.c === last ? G.dot : 0,
        fill: c.plotFg, fontSize: BUMP.headerFont, fontWeight: hd.on ? "bold" : "normal", render: header,
      })),
    ],
    keyboard: {
      data: kbData, x: "c", y: "slot", key: (x) => `${x.c}|${x.u}`, sort: false, columns: cols.length,
      label: keyboardLabel, title, onFocus: (x) => onFocus?.(x.u),
    },
  });
  keepHeadersApart(handle.svg, width);
  return { n, width, height, mt, ml: G.marginLeft, mr: G.marginRight, rowH, cols, svg: handle.svg, area: handle.area, blocks: blocks.length };
}

/**
 * Each unit's rank distribution in `slot`, one row per unit in `order`: bars (navy, only where p > 0) of height
 * p / pmax on one scale for all units, standing on a grid baseline; the 90% rank interval below it as a line with tick
 * ends (± cap); a diamond at the expected rank; bold unit ids at the left; with geometry.valueFont, every rank's
 * probability above its bar position ("0" included). A transparent band per row is shaded for the highlighted unit.
 *   ids, rankProbs (r-major), interval [{ lo, hi }], er, order, pmax (default: the largest rankProbs value)
 *   geometry       CONFIG.ranks.puzzle or CONFIG.ranks.league
 *   probText       (p) => display of a probability; alt, table, keyboardLabel, title(row), onFocus(u), xLabel
 * Returns { n, width, height, mt, rowH, order, svg } for rowUnitAt and markUnits.
 */
export function drawRankDistributions(ctx, slot, {
  ids, rankProbs, interval, er, order, pmax = Math.max(...rankProbs.flat()), geometry: G, probText, alt, table, keyboardLabel,
  title, onFocus, xLabel = T.ranksXLabel, width: wanted,
}) {
  const n = ids.length;
  const R = rankProbs.length;
  const avail = Math.max(1, Math.round(wanted || slot.clientWidth || ctx.width()));
  const width = Math.min(avail, G.maxWidth);
  const rowH = G.rowH;
  const height = G.marginTop + G.marginBottom + n * rowH;
  const rowOf = new Array(n);
  order.forEach((u, ri) => { rowOf[u] = ri; });
  const bars = [];
  const values = [];
  for (let r = 0; r < R; r += 1) {
    for (let u = 0; u < n; u += 1) {
      const p = rankProbs[r][u];
      const ri = rowOf[u];
      if (ri === undefined) continue;
      const top = ri + G.base - (G.height * p) / pmax;
      if (p > 0) bars.push({ u, x1: r + 1 - G.bar, x2: r + 1 + G.bar, y1: ri + G.base, y2: top });
      if (G.valueFont) values.push({ u, x: r + 1, y: top, p });
    }
  }
  const iv = order.map((u) => ({ u, ri: rowOf[u], lo: interval[u].lo, hi: interval[u].hi, er: er[u] }));
  const bands = order.map((u) => ({ u, ri: rowOf[u], role: "band" }));
  const labels = order.map((u) => ({ u, ri: rowOf[u], name: ids[u], role: "id" }));
  const handle = plot(slot, {
    alt, table, width, height,
    marginTop: G.marginTop, marginBottom: G.marginBottom, marginLeft: G.marginLeft, marginRight: G.marginRight,
    x: {
      domain: [HALF, R + HALF], label: xLabel, labelAnchor: "center", labelArrow: "none", labelOffset: RANKS.labelOffset,
      ticks: G.ticks ? G.ticks.filter((t) => t <= R) : Array.from({ length: R }, (_, r) => r + 1),
    },
    y: { domain: [n, 0], axis: null },
    marks: (c, P) => [
      P.rect(bands, { x1: HALF, x2: R + HALF, y1: (b) => b.ri, y2: (b) => b.ri + 1, fill: "transparent", render: tagUnits(bands) }),
      P.rect(bars, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.post }),
      P.ruleY(bands, { x1: HALF, x2: R + HALF, y: (b) => b.ri + G.base, stroke: c.plotGrid }),
      P.link(iv, {
        x1: (x) => x.lo - RANKS.cap, x2: (x) => x.hi + RANKS.cap, y1: (x) => x.ri + G.ivY, y2: (x) => x.ri + G.ivY,
        stroke: c.plotFg, strokeWidth: G.ivWidth, markerStart: "tick", markerEnd: "tick",
      }),
      P.dot(iv, { x: "er", y: (x) => x.ri + G.ivY, symbol: "diamond", r: G.diamond, fill: c.plotFg, stroke: c.plotBg }),
      G.valueFont ? numText(values, {
        x: "x", y: "y", value: "p", format: (v) => probText(v), dy: RANKS.valueDy, lineAnchor: "bottom", fill: c.plotFg,
        fontSize: G.valueFont,
      }) : null,
      P.text(labels, {
        x: HALF, y: (x) => x.ri + HALF, text: "name", dx: -RANKS.labelGap, textAnchor: "end", fill: c.plotFg,
        fontSize: G.font, fontWeight: "bold", render: tagUnits(labels),
      }),
    ],
    keyboard: {
      data: iv, x: "er", y: (x) => x.ri + G.ivY, key: (x) => ids[x.u], sort: false,
      label: keyboardLabel, title, onFocus: (x) => onFocus?.(x.u),
    },
  });
  return { n, width, height, mt: G.marginTop, rowH, order, svg: handle.svg };
}

/**
 * A table under its caption: the caption is a paragraph above the table's box (so a narrow screen never cuts it), and
 * names the table (aria-labelledby); the box scrolls sideways when the table is wider (a keyboard stop with the shared
 * edge cue, ctx.scrollRegion, named `label`). caption: a string or a list of strings and nodes. Returns the two nodes.
 */
export function captionedTable(ctx, table, caption, label) {
  table.classList.add("prx-light-panel");
  const id = uid("prx-wr-caption");
  const p = ctx.h("p", { class: "prx-wr-caption", id }, ...[caption].flat());
  table.setAttribute("aria-labelledby", id);
  return [p, ctx.scrollRegion(ctx.h("div", { class: "prx-wr-table-wrap" }, table), label)];
}

/** Highlight one selected and one hovered unit on drawn charts: data-prx-on="sel" | "hover" on the tagged marks (no
 * redraw); the highlighted unit's lines are moved to the end, so they draw on top. */
export function markUnits(svgs, selected, hovered) {
  for (const svg of svgs) {
    if (!svg?.querySelectorAll) continue;
    svg.querySelectorAll("[data-prx-unit]").forEach((m) => {
      const u = Number(m.getAttribute("data-prx-unit"));
      const on = u === selected ? "sel" : u === hovered ? "hover" : null;
      if (on) m.setAttribute("data-prx-on", on);
      else m.removeAttribute("data-prx-on");
    });
    svg.querySelectorAll('[data-prx-role="link"][data-prx-on="hover"]').forEach((m) => m.parentNode?.append(m));
    svg.querySelectorAll('[data-prx-role="link"][data-prx-on="sel"]').forEach((m) => m.parentNode?.append(m));
  }
}

const svgPoint = (svg, ev, width, height) => {
  if (!svg?.getBoundingClientRect) return null;
  const r = svg.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return null;
  return { x: (ev.clientX - r.left) * (width / r.width), y: (ev.clientY - r.top) * (height / r.height) };
};

/** The unit under a pointer event in a slope chart (drawSlopeChart's geometry): the slot from y, the nearest column from
 * x, then that column's unit at that slot; null outside the rows. */
export function slopeUnitAt(g, ev) {
  if (!g) return null;
  const p = svgPoint(g.svg, ev, g.width, g.height);
  if (!p) return null;
  const s = Math.floor((p.y - g.mt) / g.rowH);
  if (s < 0 || s >= g.n) return null;
  const span = g.width - g.ml - g.mr;
  const c = Math.round(((p.x - g.ml) / Math.max(1, span)) * (g.cols.length - 1));
  const col = g.cols[Math.max(0, Math.min(g.cols.length - 1, c))];
  return col.order[s];
}

/** The unit under a pointer event in the rank distributions (drawRankDistributions' geometry): its row; or null. */
export function rowUnitAt(g, ev) {
  if (!g) return null;
  const p = svgPoint(g.svg, ev, g.width, g.height);
  if (!p) return null;
  const ri = Math.floor((p.y - g.mt) / g.rowH);
  return ri >= 0 && ri < g.n ? g.order[ri] : null;
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS_TEMPLATE = `
%r .prx-wr-data, %r .prx-wr-summary, %r .prx-wr-k, %r .prx-wr-scale { display: flex; flex-wrap: wrap; column-gap: 1rem; }
%r .prx-wr-data > legend, %r .prx-wr-summary > legend, %r .prx-wr-k > legend, %r .prx-wr-scale > legend { flex: 1 1 100%; }
%r .prx-wr-data > .prx-radio, %r .prx-wr-summary > .prx-radio, %r .prx-wr-k > .prx-radio, %r .prx-wr-scale > .prx-radio { font-weight: 400; }
%r .prx-wr-summary { flex-basis: 100%; }
%r .prx-controls { align-items: flex-start; }
%r .prx-wr-scale { max-width: min(24rem, 100%); }
%r .prx-wr-scale > .prx-hint { flex: 1 1 100%; }
%r .prx-wr-card { margin: 0.5rem 0 0.75rem; padding: 0.5rem 0.75rem; background: var(--prx-bg); border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px); min-width: 0; }
%r .prx-wr-card p { margin: 0.2rem 0; }
%r .prx-wr-card-status { font-weight: 600; color: var(--prx-fg-heading); }
%r .prx-wr-tex { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
/* a formula wider than its box overflows into the box, which scrolls and is the keyboard stop (not the formula) */
%r .prx-wr-tex math { max-width: none; overflow: visible; }
%r .prx-wr-heading { margin: 0 0 0.35rem; font-size: 0.95em; font-weight: 600; color: var(--prx-fg-heading); }
%r .prx-wr-note { margin: 0.35rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
%r .prx-wr-howto { margin: 0.25rem 0 0.5rem; }
%r .prx-wr-scale-note { color: var(--prx-fg); }
%r .prx-wr-law { margin: 0 0 1rem; min-width: 0; }
%r .prx-wr-table-wrap { max-width: 100%; overflow-x: auto; }
%r .prx-wr-table { border-collapse: collapse; font-size: 0.92em; background: var(--prx-plot-bg); color: var(--prx-plot-fg); }
/* a table's caption stands above its scroll box (it names the table through aria-labelledby), so it is never cut */
%r .prx-wr-caption { margin: 0 0 0.25rem; font-size: 0.85em; color: var(--prx-fg-muted); }
%r .prx-wr-table th, %r .prx-wr-table td { padding: 0.2rem 0.45rem; border-bottom: 1px solid var(--prx-plot-grid); text-align: right;
  vertical-align: bottom; }
%r .prx-wr-table th { overflow-wrap: normal; }
%r .prx-wr-table td { white-space: nowrap; }
%r .prx-wr-table th:first-child, %r .prx-wr-table td:last-child:not(:nth-child(2)) { text-align: left; }
%r .prx-wr-states td:last-child { text-align: left; }
%r .prx-wr-mean-row th, %r .prx-wr-mean-row td { font-weight: 600; color: var(--prx-post); border-bottom: none; }
%r .prx-wr-mean-row.prx-wr-mean-plain th, %r .prx-wr-mean-row.prx-wr-mean-plain td { font-weight: 400; color: var(--prx-plot-fg); }
%r .prx-wr-charts { container-type: inline-size; }
%r .prx-wr-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.25rem; align-items: start; min-width: 0; }
@container (min-width: 46rem) {
  %r .prx-wr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
%r .prx-wr-bump, %r .prx-wr-ranks { min-width: 0; }
%r .prx-wr-bump-chart .prx-chart-area, %r .prx-wr-ranks-chart .prx-chart-area { cursor: pointer; }
%r [data-prx-role="link"][data-prx-on] { stroke: var(--prx-plot-fg); stroke-opacity: 1; }
%r [data-prx-role="link"][data-prx-on="sel"] { stroke-width: 3.5px; }
%r [data-prx-role="link"][data-prx-on="hover"] { stroke-width: 2.25px; stroke-dasharray: 5 3; }
/* L-09/F15's normal links stay at 1.25 px and .55 opacity; honor the reader's system contrast preference. */
@media (prefers-contrast: more) {
  %r [data-prx-role="link"] { stroke: var(--prx-plot-fg); stroke-opacity: 1; }
}
%r [data-prx-role="node"][data-prx-on="sel"] { fill: var(--prx-plot-fg); }
%r [data-prx-role="node"][data-prx-on="hover"] { stroke-width: 2.5px; }
%r [data-prx-role="id"][data-prx-on] { text-decoration: underline; }
%r [data-prx-role="band"][data-prx-on="sel"] { fill: var(--prx-plot-grid); }
%r [data-prx-role="band"][data-prx-on="hover"] { fill: var(--prx-plot-grid); fill-opacity: 0.55; }
%r[data-prx-data="league"] [data-prx-role="value"]:not([data-prx-on]) { display: none; }
%r[data-prx-data="league"] [data-prx-role="value"][data-prx-on] { font-weight: 600; }
`;

/** The views' CSS under a root class (for an app that draws these views under its own class). */
export const cssFor = (rootClass) => CSS_TEMPLATE.replaceAll("%r", `.${rootClass}`);

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: cssFor(CONFIG.className),
    keys: {
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      summary: { type: "choice", values: CONFIG.summary.values.slice(), value: CONFIG.summary.value },
      k: { type: "integer", min: CONFIG.k.min, max: CONFIG.k.max, step: CONFIG.k.step, value: CONFIG.k.value },
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      scale: { type: "choice", values: CONFIG.scale.values.slice(), value: CONFIG.scale.value },
      expK: { type: "integer", min: CONFIG.expK.min, max: CONFIG.expK.max, step: CONFIG.expK.step, value: CONFIG.expK.value },
      unit: { type: "choice", values: UNIT_VALUES.slice(), value: "" },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const node = ctx.num(raw, display); if (name) node.setAttribute("data-prx-readout", name); return node; };
      const nameNode = (id) => h("span", { "data-prx-name": id, text: id });
      const digitsOf = (d) => CONFIG.digits[d.data];
      const fmtMean = (d, v) => formatDecimal(v, { digits: digitsOf(d).mean });
      const fmtEr = (d, v) => formatDecimal(v, { digits: digitsOf(d).er });
      const fmtProb = (d, v) => formatProb(v, { digits: digitsOf(d).prob });
      const fmtSd = (v) => formatDecimal(v, { digits: CONFIG.digits.league.sd });
      // the posterior mean on the other scale: two decimals for √θ (values near 2), three significant digits for
      // exp(kθ) (its values span orders of magnitude as k grows)
      const fmtScaled = (d, v) => (d.data === "puzzle"
        ? formatDecimal(v, { digits: CONFIG.digits.puzzle.scaled })
        : formatSig(v, { sig: CONFIG.digits.league.scaledSig }));
      const kWord = (k) => T.numberWords[k - 1];
      const topWords = (k) => (k === 1 ? T.summaryWordsFirst : fillText(T.summaryWordsTopK, { k: kWord(k) }));
      const levelNode = () => ctx.num(CONFIG.level, formatPercent(CONFIG.level));
      // the other scale as text ("√θ", "exp(kθ)") and as parts, its k a number ("exp(", 10, "θ)"; at k = 1, "exp(θ)")
      const scaleSym = (sc) => (sc.transform === "sqrt" ? T.sqrtSym : T.expSym);
      const scaleParts = (sc) => (sc.transform === "sqrt" ? [T.sqrtSym]
        : sc.k === 1 ? [T.expOneSym] : ["exp(", ctx.num(sc.k, formatCount(sc.k)), "θ)"]);
      const meanValue = (d, sc, v) => (sc ? fmtScaled(d, v) : fmtMean(d, v));
      const valueText = (d, key, v, sc) => (key === "mean" ? meanValue(d, sc, v) : key === "expected_rank" ? fmtEr(d, v) : fmtProb(d, v));
      const colHeader = (key, k, sc) => (key === "mean" ? (sc ? fillText(T.colMeanScale, { scale: scaleSym(sc) }) : T.colMean)
        : key === "expected_rank" ? T.colEr : k === 1 ? T.colTopFirst : fillText(T.colTopK, { k: kWord(k) }));
      const byWords = (key, k, sc) => (key === "mean" ? (sc ? fillText(T.byMeanScale, { scale: scaleSym(sc) }) : T.byMean)
        : key === "expected_rank" ? T.byEr : fillText(T.byTop, { top: topWords(k) }));
      const meanWords = (sc) => (sc ? fillText(T.meanWordsScale, { scale: scaleSym(sc) }) : T.meanWords);
      const tid = (id) => (id.length > 1 ? id.replace(/^([A-Za-z]+)(\d+)$/, "\\mathrm{$1}$2") : id);

      // --- controls: data set, summary, top-group size (a radio pair for three units, a slider for the league), the
      // league's prior SD, the scale of the true values and k of exp(kθ)
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-wr-data",
        options: [{ value: "puzzle", label: T.dataPuzzle }, { value: "league", label: T.dataLeague }],
        value: ctx.state.data,
        // a new data set starts from its default unit and keeps the reader's scale (θ, or its own other scale)
        onChange: (v) => ctx.set({ data: v, unit: "", scale: ctx.state.scale === "theta" ? "theta" : CONFIG.scale[v] }),
      });
      const summaryRadio = ctx.radioGroup({
        legend: T.summaryLegend, name: "summary", className: "prx-wr-summary",
        options: [{ value: "mean", label: T.summaryMean }, { value: "expected_rank", label: T.summaryEr }, { value: "top", label: T.summaryTop }],
        value: ctx.state.summary, onChange: (v) => ctx.set({ summary: v }),
      });
      const kRadio = ctx.radioGroup({
        legend: T.kLegend, name: "k-puzzle", className: "prx-wr-k",
        options: [{ value: 1, label: T.kFirst }, { value: CONFIG.k.puzzleMax, label: T.kTopTwo }],
        value: Math.min(ctx.state.k, CONFIG.k.puzzleMax), onChange: (v) => ctx.set({ k: v }),
      });
      const kSlider = ctx.slider({ label: T.kLabel, ...ctx.key("k"), format: (v) => formatCount(v), onInput: (v) => ctx.set({ k: v }) });
      kSlider.root.classList.add("prx-wr-kslider");
      const prior = ctx.slider({
        label: T.priorLabel, ...ctx.key("priorSd"), hint: fill(T.priorHint, { app: () => appLink(ctx, T.shrinkageApp) }),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      prior.root.classList.add("prx-wr-prior");
      const scaleRadio = (name, other, otherLabel, hint) => {
        const g = ctx.radioGroup({
          legend: T.scaleLegend, name, className: "prx-wr-scale",
          options: [{ value: "theta", label: T.scaleTheta }, { value: other, label: otherLabel }],
          value: ctx.state.scale === "theta" ? "theta" : other, onChange: (v) => ctx.set({ scale: v }),
        });
        g.root.append(h("p", { class: "prx-hint", text: hint }));
        return g;
      };
      const scalePuzzle = scaleRadio("scale-puzzle", CONFIG.scale.puzzle, T.scaleSqrt, T.scaleHintPuzzle);
      const scaleLeague = scaleRadio("scale-league", CONFIG.scale.league, T.scaleExp, T.scaleHintLeague);
      const expK = ctx.slider({ label: T.expKLabel, ...ctx.key("expK"), format: (v) => formatCount(v), hint: T.expKHint, onInput: (v) => ctx.set({ expK: v }) });
      expK.root.classList.add("prx-wr-expk");
      // the controls of one data set only are in the page: the other set's controls leave the DOM (not just hidden), and
      // each comes back at its own anchor, so the controls that stay are never moved and keep keyboard focus
      const anchor = (name) => ctx.doc.createComment(name);
      const slots = [
        { node: kRadio.root, at: anchor("k") }, { node: kSlider.root, at: anchor("k-league") }, { node: prior.root, at: anchor("prior") },
        { node: scalePuzzle.root, at: anchor("scale") }, { node: scaleLeague.root, at: anchor("scale-league") }, { node: expK.root, at: anchor("exp-k") },
      ];
      ctx.controls.append(dataRadio.root, summaryRadio.root, ...slots.map((s) => s.at));
      const showControls = (shown) => slots.forEach((s, i) => {
        if (shown[i] && !s.node.isConnected) s.at.before(s.node);
        else if (!shown[i] && s.node.isConnected) s.node.remove();
      });
      ctx.controls.after(ctx.readout.node);

      // --- unit card: its numbers and the worked expected rank (after the read-out); on another scale, the worked mean
      const cardStatus = h("p", { class: "prx-wr-card-status" });
      const cardLine = h("p", { class: "prx-wr-card-line" });
      const cardExtra = h("p", { class: "prx-wr-card-extra" });
      const cardScale = h("p", { class: "prx-wr-card-scale" });
      const texBox = ctx.scrollRegion(h("div", { class: "prx-wr-tex", "data-prx-tex": "expected-rank" }), T.cardWorked);
      const scaleTex = ctx.scrollRegion(h("div", { class: "prx-wr-tex", "data-prx-tex": "scale-mean" }), T.cardWorkedScale);
      const formulaNote = h("p", { class: "prx-wr-note" }, ...fill(T.formulaNote, { one: () => ctx.num(1, formatCount(1)) }));
      const card = h("section", { class: "prx-wr-card", "data-prx-part": "readout", "aria-label": T.cardSelected },
        cardStatus, cardLine, cardExtra, cardScale, texBox, scaleTex, formulaNote);
      ctx.readout.node.after(card);

      // --- the posterior (three-unit law: a table of the two states; league: one note)
      const lawBox = h("section", { class: "prx-wr-law", "aria-label": T.lawHeading });
      // --- slope chart
      const bumpHeading = h("h4", { class: "prx-wr-heading", text: T.bumpHeading });
      const bumpNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes", text: T.bumpNote });
      const tieNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes", text: T.tieNote, hidden: true });
      const scaleNote = h("p", { class: "prx-wr-note prx-wr-scale-note", "data-prx-part": "notes", hidden: true });
      const howTo = h("p", { class: "prx-hint prx-wr-howto", "data-prx-part": "notes", text: T.howTo });
      const bumpSlot = h("div", { class: "prx-wr-bump-chart" });
      const bumpBox = h("section", { class: "prx-wr-bump", "aria-label": T.bumpHeading }, bumpHeading, bumpNote, howTo, bumpSlot, tieNote, scaleNote);
      // --- rank distributions
      const ranksHeading = h("h4", { class: "prx-wr-heading", text: T.ranksHeading });
      const ranksNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes" });
      const ranksSlot = h("div", { class: "prx-wr-ranks-chart" });
      const ranksBox = h("section", { class: "prx-wr-ranks", "aria-label": T.ranksHeading }, ranksHeading, ranksNote, ranksSlot);
      ctx.charts.classList.add("prx-wr-charts");
      ctx.charts.append(lawBox, h("div", { class: "prx-wr-grid" }, bumpBox, ranksBox));

      // --- the source note, after the caption
      const sourceNote = ctx.part("notes", h("p", { class: "prx-wr-note prx-wr-source" }));
      ctx.caption.after(sourceNote);
      const authoredCaption = ctx.info?.caption ?? "";

      let current = null;     // { state, d, k, sc, cols, thetaCols }
      let bumpGeom = null;
      let ranksGeom = null;
      let selected = null;    // unit index: the unit key's unit, or the default unit
      let hovered = null;
      let rendering = false;

      // ------------------------------------------------------------------------------------------- drawing

      function drawLaw(d, sc) {
        if (d.data === "league") {
          const groupSd = (g) => {
            const i = LEAGUE.group.indexOf(g);
            return ro(`law-sd-${g}`, d.sd[i], fmtSd(d.sd[i]));
          };
          lawBox.replaceChildren(h("p", { class: "prx-wr-note" }, ...fill(T.leagueLaw, { app: () => appLink(ctx, T.shrinkageApp) }),
            ...fill(T.leagueWidths, { small: () => groupSd("small"), medium: () => groupSd("medium"), large: () => groupSd("large") }),
            sc ? T.leagueLawExp : null));
          return;
        }
        const dg = digitsOf(d);
        const orderOf = (vals) => scoreOrder(vals.slice(), { direction: "descending", ids: d.ids }).order.map((u) => d.ids[u]).join(", ");
        const rows = LAW.states.map((s, r) => h("tr", {},
          h("th", { scope: "row", text: r === 0 ? T.stateHigh : T.stateLow }),
          h("td", {}, ro(`law-p-${r === 0 ? "high" : "low"}`, LAW.probs[r], formatProb(LAW.probs[r], { digits: dg.prob }))),
          ...s.map((v, i) => h("td", {}, ro(`law-${r === 0 ? "high" : "low"}-${d.ids[i].toLowerCase()}`, v, formatCount(v)))),
          h("td", { text: orderOf(s) })));
        const meanRow = (label, values, hook, fmt, plain) => h("tr", { class: plain ? "prx-wr-mean-row prx-wr-mean-plain" : "prx-wr-mean-row" },
          h("th", { scope: "row", text: label }), h("td", {}),
          ...values.map((m, i) => h("td", {}, ro(`${hook}-${d.ids[i].toLowerCase()}`, m, fmt(m)))), h("td", {}));
        const meanRows = sc
          ? [meanRow(T.meanRowTheta, d.mean, "law-mean", (m) => fmtMean(d, m), true),
            meanRow(fillText(T.meanRowScale, { scale: scaleSym(sc) }), sc.means, "law-scale", (m) => fmtScaled(d, m), false)]
          : [meanRow(T.meanRow, d.mean, "law-mean", (m) => fmtMean(d, m), false)];
        const table = h("table", { class: "prx-wr-table prx-wr-states" },
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.colState }), h("th", { scope: "col", text: T.colProb }),
            ...d.ids.map((id) => h("th", { scope: "col", text: id })), h("th", { scope: "col", text: T.colOrder }))),
          h("tbody", {}, ...rows, ...meanRows));
        const note = h("p", { class: "prx-wr-note" }, ...fill(T.meanNote, { mean: () => ctx.num(d.mean[0], fmtMean(d, d.mean[0])) }),
          ...(sc ? fill(T.meanNoteScale, {
            scale: () => scaleParts(sc), a: () => ctx.num(sc.means[0], fmtScaled(d, sc.means[0])),
            b: () => ctx.num(sc.means[1], fmtScaled(d, sc.means[1])), c: () => ctx.num(sc.means[2], fmtScaled(d, sc.means[2])),
          }) : []));
        lawBox.replaceChildren(h("h4", { class: "prx-wr-heading", text: T.lawHeading }), ...captionedTable(ctx, table, T.lawCaption, T.lawTable), note);
      }

      function drawBump(state, d, k, cols, sc) {
        const chosen = Math.max(0, cols.findIndex((c) => c.key === state.summary));
        const words = byWords(state.summary, k, sc).replace(/^By /, "by ");
        const table = {
          caption: fillText(T.bumpTable, { order: words }),
          columns: [
            { label: T.colUnit, value: "id" },
            { label: colHeader("mean", k, sc).replace("\n", " "), value: (r) => cols[0].value[r.u], format: (v) => meanValue(d, sc, v) },
            { label: sc ? fillText(T.colPlaceMeanScale, { scale: scaleSym(sc) }) : T.colPlaceMean, value: (r) => placeText(cols[0], r.u) },
            { label: T.colEr.replace("\n", " "), value: (r) => d.er[r.u], format: (v) => fmtEr(d, v) },
            { label: T.colPlaceEr, value: (r) => placeText(cols[1], r.u) },
            { label: colHeader("top", k).replace("\n", " "), value: (r) => cols[2].value[r.u], format: (v) => fmtProb(d, v) },
            { label: T.colPlaceTop, value: (r) => placeText(cols[2], r.u) },
          ],
          rows: cols[chosen].order.map((u) => ({ id: d.ids[u], u })),
        };
        bumpGeom = drawSlopeChart(ctx, bumpSlot, {
          ids: d.ids, cols, chosen, geometry: BUMP[d.data], labels: d.data === "puzzle" ? "all" : "ends",
          headers: cols.map((col) => colHeader(col.key, k, sc)),
          valueText: (c, v) => valueText(d, cols[c].key, v, sc),
          alt: fillText(T.bumpAlt, { mean: meanWords(sc), top: topWords(k) }),
          table, keyboardLabel: T.bumpKeyboard,
          title: (x) => `${byWords(cols[x.c].key, k, sc)}, ${placeText(cols[x.c], x.u)}: ${d.ids[x.u]} (${valueText(d, cols[x.c].key, x.value, sc)})`,
          onFocus: (u) => select(u),
          width: bumpSlot.clientWidth || bumpBox.clientWidth,
        });
        tieNote.hidden = !bumpGeom.blocks;
      }

      function drawRanks(state, d, k, col, sc) {
        const tail = (1 - CONFIG.level) / 2;
        ranksNote.replaceChildren(...fill(T.ranksNote, { level: levelNode, tail: () => ctx.num(tail, formatPercent(tail)) }));
        const words = byWords(col.key, k, sc).replace(/^By /, "by ");
        const lv = formatPercent(CONFIG.level);
        const rowTitle = (x) => {
          const u = x.u;
          const lo = ordinal(d.interval[u].lo);
          const hi = ordinal(d.interval[u].hi);
          if (d.data === "puzzle") {
            const probs = d.rankProbs.map((row, r) => fillText(T.rankWith, { place: ordinal(r + 1), p: fmtProb(d, row[u]) })).join(", ");
            return fillText(T.rowTitlePuzzle, { id: d.ids[u], probs, er: fmtEr(d, d.er[u]), level: lv, lo, hi });
          }
          // the most likely rank (the first, when two ranks are equally likely)
          let mode = 0;
          d.rankProbs.forEach((row, r) => { if (row[u] > d.rankProbs[mode][u]) mode = r; });
          return fillText(T.rowTitleLeague, { id: d.ids[u], er: fmtEr(d, d.er[u]), level: lv, lo, hi, mode: ordinal(mode + 1), pmode: fmtProb(d, d.rankProbs[mode][u]) });
        };
        ranksGeom = drawRankDistributions(ctx, ranksSlot, {
          ids: d.ids, rankProbs: d.rankProbs, interval: d.interval, er: d.er, order: col.order, pmax: d.pmax,
          geometry: RANKS[d.data], probText: (v) => fmtProb(d, v),
          alt: fillText(T.ranksAlt, { order: words, level: lv }),
          table: {
            caption: fill(T.ranksTable, { level: levelNode, order: words }),
            columns: [
              { label: T.colUnit, value: "id" },
              ...d.rankProbs.map((row, r) => ({ label: fillText(T.colRankProb, { place: ordinal(r + 1) }), value: (x) => row[x.u], format: (v) => fmtProb(d, v) })),
              { label: T.colExpected, value: (x) => d.er[x.u], format: (v) => fmtEr(d, v) },
              { label: T.colLower, value: (x) => ordinal(d.interval[x.u].lo) },
              { label: T.colUpper, value: (x) => ordinal(d.interval[x.u].hi) },
            ],
            rows: col.order.map((u) => ({ id: d.ids[u], u })),
          },
          keyboardLabel: T.ranksKeyboard, title: rowTitle, onFocus: (u) => select(u),
          width: ranksSlot.clientWidth || ranksBox.clientWidth,
        });
      }

      function highlight() {
        markUnits([bumpGeom?.svg, ranksGeom?.svg], selected, hovered);
        drawCard();
      }

      function drawCard() {
        if (!current) return;
        const { d, k, cols, thetaCols, sc } = current;
        const u = hovered ?? selected;
        if (u === null || u === undefined || u >= d.n) return;
        cardStatus.replaceChildren(`${hovered !== null ? T.cardHovered : T.cardSelected}: `, nameNode(d.ids[u]), ".");
        const iv = d.interval[u];
        cardLine.replaceChildren(...fill(T.cardLine, {
          id: () => nameNode(d.ids[u]),
          mean: () => ro("card-mean", d.mean[u], fmtMean(d, d.mean[u])), pmean: placeText(thetaCols[0], u),
          er: () => ro("card-er", d.er[u], fmtEr(d, d.er[u])), per: placeText(cols[1], u),
          top: k === 1 ? T.probFirst : fillText(T.probTopK, { k: kWord(k) }),
          ptop: () => ro("card-top", cols[2].value[u], fmtProb(d, cols[2].value[u])), pplace: placeText(cols[2], u),
          level: levelNode, lo: () => ro("card-ri-lo", iv.lo, formatCount(iv.lo)), hi: () => ro("card-ri-hi", iv.hi, formatCount(iv.hi)),
        }));
        if (d.data === "league") {
          cardExtra.hidden = false;
          cardExtra.replaceChildren(...fill(T.cardLeague, {
            id: () => nameNode(d.ids[u]), group: T.groupWords[LEAGUE.group[u]],
            se: () => ctx.num(LEAGUE.se[u], formatDecimal(LEAGUE.se[u], { digits: CONFIG.digits.league.se })),
            sd: () => ro("card-sd", d.sd[u], fmtSd(d.sd[u])),
          }));
        } else {
          cardExtra.hidden = true;
          cardExtra.replaceChildren();
        }
        if (sc) {
          cardScale.hidden = false;
          cardScale.replaceChildren(...fill(T.cardScale, {
            scale: () => scaleParts(sc), m: () => ro("card-scale", sc.means[u], fmtScaled(d, sc.means[u])), place: placeText(cols[0], u),
          }));
        } else {
          cardScale.hidden = true;
          cardScale.replaceChildren();
        }
        drawFormula(d, u);
        drawScaleFormula(d, u, sc);
      }

      // the worked expected rank of one unit: its average place and ch. 5's pairwise form (three units), or the pairwise
      // form alone (league). Numbers are made in formula order (formulaNums keeps that order for data-num).
      function drawFormula(d, u) {
        const f = formulaNums();
        const me = tid(d.ids[u]);
        if (d.data === "puzzle") {
          const avg = d.rankProbs.map((row, r) => `${f.num(r + 1, formatCount(r + 1))} \\times ${f.num(row[u], fmtProb(d, row[u]))}`).join(" + ");
          const others = d.ids.map((_, j) => j).filter((j) => j !== u);
          // one direction probability per line, so the formula fits a 375 px screen
          const pis = others.map((j) => `\\Pr(\\theta_{${tid(d.ids[j])}} > \\theta_{${me}} \\mid Y)`).join(" \\\\ &\\quad + ");
          const one = f.num(1, formatCount(1));
          const one2 = f.num(1, formatCount(1));
          const piNums = others.map((j) => f.num(d.pi[j][u], fmtProb(d, d.pi[j][u]))).join(" + ");
          const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
          const tex = `\\begin{aligned}\\prerank{${me}} &= \\;${avg} \\\\ &= \\;${one} + ${pis} \\\\ &= \\;${one2} + ${piNums} = \\;${result}\\end{aligned}`;
          renderTex(texBox, tex, { display: true, nums: f.raws });
          return;
        }
        const one = f.num(1, formatCount(1));
        const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
        const tex = `\\begin{aligned}\\prerank{${me}} &= \\;${one} + \\sum_{j \\neq ${me}} \\Pr(\\theta_j > \\theta_{${me}} \\mid Y) \\\\ &= \\;${result}\\end{aligned}`;
        renderTex(texBox, tex, { display: true, nums: f.raws });
      }

      // the worked posterior mean of one unit on the other scale: the two states' values under √θ (three units), or the
      // lognormal mean exp(k·mean + k²·SD²/2) of a normal posterior (league); the result is the engine's transformedMeans.
      // In a narrow app (below CONFIG.narrowPx) the result gets a line of its own and long lines break after their "+"
      function drawScaleFormula(d, u, sc) {
        if (!sc) {
          scaleTex.hidden = true;
          return;
        }
        scaleTex.hidden = false;
        const narrow = ctx.width() < CONFIG.narrowPx;
        const f = formulaNums();
        const me = tid(d.ids[u]);
        if (sc.transform === "sqrt") {
          const terms = LAW.probs.map((p, s) => `${f.num(p, fmtProb(d, p))} \\times \\sqrt{${f.num(LAW.states[s][u], formatCount(LAW.states[s][u]))}}`).join(" + ");
          const result = f.num(sc.means[u], fmtScaled(d, sc.means[u]), "prx-post");
          const head = `\\mathbb{E}\\big[\\sqrt{\\theta_{${me}}} \\mid Y\\big]`;
          const tex = narrow
            ? `\\begin{aligned}${head} &= \\;${terms} \\\\ &= \\;${result}\\end{aligned}`
            : `${head} = \\;${terms} = \\;${result}`;
          renderTex(scaleTex, tex, { display: true, nums: f.raws });
          return;
        }
        const two = f.num(2, formatCount(2));
        const k1 = f.num(sc.k, formatCount(sc.k));
        const m = f.num(d.mean[u], fmtMean(d, d.mean[u]));
        const k2 = f.num(sc.k, formatCount(sc.k));
        const s = f.num(d.sd[u], fmtSd(d.sd[u]));
        const two2 = f.num(2, formatCount(2));
        const result = f.num(sc.means[u], fmtScaled(d, sc.means[u]), "prx-post");
        // three lines (five in a narrow app), so that the formula fits a 375 px screen
        const plus = narrow ? " \\\\ &\\quad + " : " + ";
        const tex = `\\begin{aligned}\\mathbb{E}\\big[e^{k\\theta_{${me}}} \\mid Y\\big] &= \\exp\\big(k \\cdot \\mathrm{mean}${plus}k^2 \\cdot \\mathrm{SD}^2 / ${two}\\big)`
          + ` \\\\ &= \\exp\\big(${k1} \\times ${m}${plus}${k2}^2 \\times ${s}^2 / ${two2}\\big) \\\\ &= \\;${result}\\end{aligned}`;
        renderTex(scaleTex, tex, { display: true, nums: f.raws });
      }

      function drawReadout(state, d, k, cols, sc) {
        const col = cols.find((c) => c.key === state.summary);
        const summaryWords = state.summary === "mean" ? (sc ? fill(T.summaryWordsMeanScale, { scale: () => scaleParts(sc) }) : [T.summaryWordsMean])
          : state.summary === "expected_rank" ? [T.summaryWordsEr] : [`${topWords(k)}${d.exact ? "" : T.readMc}`];
        const head = d.data === "league" ? [T.readLeague, ro("prior-sd", d.priorSd, formatSetting(d.priorSd))] : [T.readPuzzle];
        const listed = col.order.slice(0, Math.min(CONFIG.listed, d.n));
        const list = [];
        listed.forEach((u, j) => {
          list.push(j ? ", " : "", nameNode(d.ids[u]), " (", ro(`list-${j + 1}`, col.value[u], valueText(d, col.key, col.value[u], sc)), ")");
        });
        if (d.n > listed.length) list.push(T.readMore);
        list.push(".");
        const tail = [];
        if (state.summary === "top") {
          const firstTop = col.order[0];
          const firstMean = cols[0].order[0];
          const subject = () => (sc ? fill(T.subjectMeanScale, { scale: () => scaleParts(sc) }) : T.subjectMean);
          tail.push(...(firstTop === firstMean
            ? fill(T.readFirstSame, { subject, first: () => nameNode(d.ids[firstTop]) })
            : fill(T.readFirstDiff, { subject, mean: () => nameNode(d.ids[firstMean]) })));
          const zeros = col.order.filter((u) => col.value[u] === 0).length;
          if (!d.exact && zeros > 1) {
            // a count up to ten starts its sentence as a word, a larger one as a number
            const word = T.numberWords[zeros - 1];
            const count = word ? word[0].toUpperCase() + word.slice(1) : () => ro("zeros", zeros, formatCount(zeros));
            tail.push(...fill(k === 1 ? T.readZerosFirst : T.readZeros, { count, k: kWord(k) }));
          }
        } else {
          const mis = sc ? sc.misordered : d.misordered;
          tail.push(...fill(sc ? T.readMisScale : T.readMis, {
            scale: () => (sc ? scaleParts(sc) : ""), mis: () => ro("misordered", mis, formatCount(mis)), M: () => ro("pairs", d.M, formatCount(d.M)),
          }));
        }
        ctx.readout.set([...head, ...fill(T.readRanked, { summary: () => summaryWords }), ...list, ...tail]);
      }

      function drawNotes(d) {
        if (d.data === "puzzle") {
          sourceNote.replaceChildren(T.notePuzzle);
          ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption] : []));
          exposeResult(ctx, null, "mc");
          return;
        }
        sourceNote.replaceChildren(...fill(T.noteLeague, {
          n: () => ctx.num(d.n, formatCount(d.n)),
          seed: () => ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
          zero: () => ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })),
          prior: () => ctx.num(d.priorSd, formatSetting(d.priorSd)),
        }));
        exposeResult(ctx, d.mc, "mc");
        ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption, " "] : []), T.mcLead, captionNode(ctx, "monte-carlo", d.mc), ". ",
          T.postLead, captionNode(ctx, "teaching-posterior"), ".");
      }

      function drawScaleNote(d, sc) {
        scaleNote.hidden = !sc;
        if (!sc) {
          scaleNote.replaceChildren();
          return;
        }
        scaleNote.replaceChildren(...fill(T.scaleNote, {
          scale: () => scaleParts(sc), moved: () => ro("scale-moved", sc.moved, formatCount(sc.moved)), M: () => ro("scale-pairs", d.M, formatCount(d.M)),
        }));
      }

      // --- selection, hover and the pointer
      function select(u) {
        if (!current || u === null || u === undefined || u >= current.d.n) return;
        // a figure redrawn during a render may hand focus back to a point: select after the render
        if (rendering) {
          ctx.timeout(() => select(u), 0);
          return;
        }
        const id = current.d.ids[u];
        const had = hovered;
        hovered = null;
        if (current.state.unit === id) {
          if (had !== null) highlight();
          return;
        }
        ctx.set({ unit: id });
      }
      function setHover(u) {
        const next = u ?? null;
        if (next === hovered) return;
        hovered = next;
        highlight();
      }
      ctx.listen(bumpSlot, "pointermove", (ev) => { if (ev.pointerType !== "touch") setHover(slopeUnitAt(bumpGeom, ev)); });
      ctx.listen(bumpSlot, "pointerleave", () => setHover(null));
      ctx.listen(bumpSlot, "click", (ev) => { const u = slopeUnitAt(bumpGeom, ev); if (u !== null && u !== undefined) select(u); });
      ctx.listen(ranksSlot, "pointermove", (ev) => { if (ev.pointerType !== "touch") setHover(rowUnitAt(ranksGeom, ev)); });
      ctx.listen(ranksSlot, "pointerleave", () => setHover(null));
      ctx.listen(ranksSlot, "click", (ev) => { const u = rowUnitAt(ranksGeom, ev); if (u !== null && u !== undefined) select(u); });

      // --- the league at every step of the prior-SD slider, computed ahead in idle time (nearest to the current prior SD
      // first), so that a drag over prior SDs not visited yet redraws without drawing 4,000 posterior samples
      const precompute = (() => {
        const win = ctx.win;
        const ric = typeof win.requestIdleCallback === "function" ? win.requestIdleCallback.bind(win) : null;
        const cancel = typeof win.cancelIdleCallback === "function" ? win.cancelIdleCallback.bind(win) : null;
        let target = CONFIG.priorSd.value;
        let pending = null;
        const nextStep = () => {
          let best;
          for (const p of PRIOR_GRID) {
            if (memo.has(memoKey("league", p))) continue;
            if (best === undefined || Math.abs(p - target) < Math.abs(best - target)) best = p;
          }
          return best;
        };
        const run = () => {
          pending = null;
          const p = nextStep();
          if (p === undefined) return;
          dataset("league", p);
          schedule();
        };
        function schedule(around) {
          if (Number.isFinite(around)) target = around;
          if (pending !== null || nextStep() === undefined) return;
          if (ric) {
            const id = ric(run, { timeout: CONFIG.idle.timeout });
            pending = { cancel: () => cancel?.(id) };
          } else {
            pending = { cancel: ctx.timeout(run, CONFIG.idle.fallbackMs) };
          }
        }
        ctx.onCleanup(() => { pending?.cancel?.(); pending = null; });
        return { schedule };
      })();

      return {
        render(state, info) {
          rendering = true;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const changed = info?.changed ?? [];
            // a new selection toggles attributes and redraws the card only
            const unitOnly = Boolean(current) && !info?.initial && info?.reason === "update"
              && changed.length === 1 && changed[0] === "unit" && current.state.data === state.data;
            const league = state.data === "league";
            const scaled = state.scale !== "theta";
            dataRadio.set(state.data);
            summaryRadio.set(state.summary);
            kRadio.set(Math.min(state.k, CONFIG.k.puzzleMax));
            kSlider.set(state.k);
            prior.set(state.priorSd);
            scalePuzzle.set(scaled ? CONFIG.scale.puzzle : "theta");
            scaleLeague.set(scaled ? CONFIG.scale.league : "theta");
            expK.set(state.expK);
            showControls([!league, league, league, !league, league, league && scaled]);
            ctx.root.setAttribute("data-prx-data", state.data);
            const d = dataset(state.data, state.priorSd);
            const k = kFor(d, state.k);
            const sc = scaledMeans(d, state.scale, state.expK);
            const thetaCols = columns(d, k, null);
            const cols = sc ? columns(d, k, sc) : thetaCols;
            if (changed.includes("data") && !info?.initial) hovered = null;
            if (hovered !== null && hovered >= d.n) hovered = null;
            const ui = d.ids.indexOf(state.unit);
            // the default unit follows the summary, k and prior SD (it is read on θ, so the scale does not move it)
            selected = ui >= 0 ? ui : defaultUnit(thetaCols, state.summary);
            current = { state, d, k, sc, cols, thetaCols };
            if (!unitOnly) {
              drawLaw(d, sc);
              drawBump(state, d, k, cols, sc);
              drawRanks(state, d, k, cols.find((c) => c.key === state.summary), sc);
              drawReadout(state, d, k, cols, sc);
              drawNotes(d);
              drawScaleNote(d, sc);
            }
            highlight();
          } finally {
            ctx.root.removeAttribute("aria-busy");
            rendering = false;
          }
          precompute.schedule(state.priorSd);
        },
      };
    },
  });
}
