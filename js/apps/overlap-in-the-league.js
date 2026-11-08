// overlap-in-the-league (app 1.12): "435 pairs: overlap against direction". Ported from postrank Explorer v1 L-06
// (js/widgets/interval-overlap.js and styles/widgets/interval-overlap.css), its view "The simulated league" in full,
// without the prediction gate (the gate's question was about the other view, app 1.11 interval-overlap, whose interval
// drawing, figure keys and pair card this app imports).
//
// The simulated league comes live from the engine: league30() and the draw drawLeague(LEAGUE_SEED), with the teaching
// posterior of app 1.5 (normalPosterior, prior mean 0, prior SD priorSd). One state { level, pair, priorSd } drives
// every part:
//   league figure  the thirty central posterior intervals at the level (engine normalInterval), one row per unit,
//                  highest posterior mean at the top (engine strictOrder); the two chosen units dark and marked first
//                  and second, the others dimmed; dashed lines at the two ends of the stretch the two intervals share
//                  (or of the gap between them), with a gray band over the shared stretch. Next to the marks, the
//                  pair's numbers (review 044 repair, X-01): "chance .988" after first (the probability that its true
//                  value is larger than the second's) and "overlap .005" or "gap .002" after second (pairLabels)
//   pair card      the two intervals, whether they overlap and by how much, the posterior means and SDs, and the
//                  probability that the first unit's true value is larger than the second's (engine pairDirection)
//   tally          all 435 pairs (engine pairCount) in three classes of engine intervalOverlapTally: intervals apart;
//                  overlapping, with one direction above .90; overlapping, with neither; a share bar per class (figure
//                  inks), the chosen pair's row marked, and the overlapping pair with the highest probability
//   read-out       the chosen pair and the tally in words
// The app uses the shared result-first frame (base.js layout "result-first"; review 044 repair, X-01): the controls and
// the preset row, the read-out directly under them, then the league figure (the primary graphic: the chosen pair drawn
// dark among all thirty) with the pair card and the tally beside it where there is room, under it where not.
// Choosing units: the two selects, a click at an interval's row in the figure, or Enter on a unit's keyboard point;
// clicks alternate between the first and the second unit, and a unit already in the other slot swaps places. The
// button "Overlapping pair with the highest probability" sets pair "overlap-high", the engine's pick, which follows the
// level and the prior SD.
// Keys: level (90 or 95; other values are ignored), pair ("overlap-high" in any case, or two different unit ids
// "U13-U05", first then second, any case) and priorSd (.02 to .60). The league's seed is fixed (no key). The app loads
// on the first preset, v1's default: the engine's pick at 90% and prior SD .15.
//
// The overlap of two intervals is the stretch from the larger lower end to the smaller upper end (the engine's strict
// rule: they overlap when max(lower) < min(upper)); when one interval lies inside the other, that is the inner one.
// The chosen pair's row of the tally gives whether the two overlap, by how much (amount: the stretch's length, or the
// gap between them when negative) and whether one lies inside the other (nested); the app keeps the stretch's ends to
// draw it.
//
// Exports (for a later app on the same league): CONFIG, parsePair(v), leagueSummary(priorSd, levelPct),
// pairInfo(s, a, b), resolvePair(key, s), leagueDomain(s), drawLeagueFigure(el, s, pair, options).
import { appLink, createWidget } from "../shared/base.js";
import { CONFIG as CHART, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatPercent, formatProb } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  LEAGUE_SEED, directionMatrix, drawLeague, intervalOverlapTally, league30, normalCdf, normalInterval, normalPosterior,
  pairCount, pairDirection, strictOrder,
} from "../pr-core.js";
import {
  CONFIG as IO, cssFor, fill, intervalMarks, keyItem, keyNode, overlapMarks, pairCard, textKit, words,
} from "./interval-overlap.js";

export const CONFIG = Object.freeze({
  name: "overlap-in-the-league",
  label: "Overlap against direction in the simulated league: thirty posterior intervals, a chosen pair, and every pair sorted by interval overlap and direction probability",
  className: "prx-iol",
  levels: IO.levels,
  percent: IO.percent,
  defaults: Object.freeze({ level: 90, pair: "overlap-high", priorSd: 0.15 }),
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01 }),
  priorMean: 0,
  pick: "overlap-high",
  // the probability that splits the overlapping pairs of the tally (above it for one direction, or at most it)
  threshold: 0.9,
  // league summaries kept for this many (prior SD, level) settings
  memo: 8,
  digits: Object.freeze({ value: 3, amount: 3, threshold: 2 }),
  // the league figure (review 044 repair, X-01: rows 12.5 px apart and a 4 px top margin, so at 1280 the first
  // control, the read-out and the whole figure fit one screen, the second unit's mark included; they were 15 and 14)
  leagueChart: Object.freeze({
    rowPx: 12.5, marginTop: 4, marginBottom: 40, marginLeft: 40, marginRight: 52, half: 0.5, nameDx: 6,
    line: 3.4, dot: 4.2, markDx: 6, step: 0.1, decimals: 12, pad: 0.02, xTicks: 6, halo: 3,
    // the pair's numbers written next to its marks (review 044 repair, X-01): `gap` px after the mark word, `edge` px
    // kept from the figure's right edge and the plot's left edge; text widths are measured in the figure's font, or
    // estimated (`char` and `charBold` px a character) where no canvas measures them
    label: Object.freeze({ gap: 5, edge: 2, char: 6.6, charBold: 7.2 }),
  }),
  groupWord: Object.freeze({ small: "small", medium: "medium", large: "large" }),
  // a unit's size in words where it names a unit (lists, keyboard titles): size is the number of observations
  groupUnit: Object.freeze({ small: "small unit (few observations)", medium: "medium unit", large: "large unit (many observations)" }),
  // the apps whose titles the text names: a link once built, else in quotes (base.js appLink, with 1.11's link class)
  apps: Object.freeze({
    shrinkage: Object.freeze({ app: "shrinkage", title: "What a posterior adds" }),
    league: Object.freeze({ app: "noisy-league", title: "Ranking noisy estimates" }),
    twoUnits: IO.text.twoUnits,
  }),
  text: Object.freeze({
    levelLegend: IO.text.levelLegend,
    priorLabel: "Prior SD of the teaching posterior",
    priorHint: "The normal prior of {app}, centered at zero, the average of the league's true values.",
    firstLabel: "First unit",
    secondLabel: "Second unit",
    unitOption: "{id}, {group}",
    bestButton: "Overlapping pair with the highest probability",
    pickHint: "Click an interval, or press Enter on it in the figure, to choose a unit; clicks alternate between the first and the second unit. Next click: {next}.",
    nextFirst: "the first unit",
    nextSecond: "the second unit",
    // league figure
    leagueSection: "The simulated league",
    leagueHead: "The simulated league: {level} posterior intervals, highest posterior mean at the top",
    xLeague: "True value",
    altLeague: "Thirty posterior intervals of the simulated league, one row per unit, highest posterior mean at the top, each with a dot at its posterior mean. The two chosen units are drawn darker and marked first and second; {guides}",
    altGuides: Object.freeze({
      overlap: "dashed lines mark the lower end of the higher one and the upper end of the lower one, with a gray band where the two intervals overlap.",
      nested: "dashed lines mark the two ends of the shorter interval, which lies inside the other, with a gray band where the two intervals overlap.",
      apart: "dashed lines mark the lower end of the higher one and the upper end of the lower one; the two intervals do not overlap.",
    }),
    tableLeague: "Each unit of the league in the order of the posterior means: size, posterior mean, posterior SD and interval ends",
    kbdLeague: "League intervals: one point per unit, in the order of the posterior means; press Enter to choose a unit",
    kbdPoint: "{id}, a {group}: posterior mean {mean}, {level} interval from {lower} to {upper}.",
    kbdChosen: Object.freeze({ first: " The first unit of the pair.", second: " The second unit of the pair." }),
    colPosition: "Position",
    colUnit: IO.text.colUnit,
    colSize: "Size",
    colMean: IO.text.colMean,
    colSd: IO.text.colSd,
    colLower: IO.text.colLower,
    colUpper: IO.text.colUpper,
    markFirst: "first",
    markSecond: "second",
    // the pair's numbers next to its marks (review 044 repair, X-01): the probability that the first unit's true value
    // is larger, after "first"; the overlap of the two intervals (or the gap between them), after "second". Where the
    // words do not fit on either side of the unit's interval, the number stands alone
    markChance: "chance",
    markOverlap: "overlap",
    markGap: "gap",
    keyInterval: "light navy lines: each unit's {level} posterior interval, with a dot at its posterior mean",
    keyChosen: "darker lines: the two chosen units",
    keyGuides: Object.freeze({
      overlap: "dashed lines and gray band: the lower end of the higher unit, the upper end of the lower unit, and their overlap",
      nested: "dashed lines and gray band: the two ends of the shorter interval, which lies inside the other, and their overlap",
      apart: "dashed lines: the lower end of the higher unit and the upper end of the lower unit, with the gap between them",
    }),
    // pair card
    leagueEnds: "{a}: {aLower} to {aUpper}. {b}: {bLower} to {bUpper}.",
    leagueOverlap: "They overlap by {amount}.",
    leagueApart: "They do not overlap: {amount} lies between them.",
    leagueInside: "{inner}'s interval lies inside {outer}'s.",
    leagueMoments: "Posterior means {aMean} and {bMean}; posterior SDs {aSd} and {bSd}.",
    cardPi: IO.text.cardPi,
    cardNext: IO.text.cardNext,
    // tally
    tallyLabel: "The pairs of league units, by interval overlap and direction probability",
    tallyCaption: "The {M} pairs of league units at prior SD {prior}, with {level} intervals",
    tallyKind: "Pairs",
    tallyCount: "Count",
    tallyRows: Object.freeze({
      apart: "Intervals do not overlap (in each such pair, one direction has a probability above {bound})",
      high: "Intervals overlap, and one direction has a probability above {thr}",
      low: "Intervals overlap, and neither direction has a probability above {thr}",
      all: "All pairs",
    }),
    chosenTag: "the chosen pair",
    tallyBest: "Highest probability among the {ov} overlapping pairs: {pi}, {a} above {b}.",
    tallyNoBest: "No two intervals overlap.",
    // read-out (one aria-live region): the pair, then the count of the table in one sentence (v1's hooks kept)
    readLeagueOverlap: "{a} and {b}: their {level} intervals overlap, ",
    readLeagueApart: "{a} and {b}: their {level} intervals do not overlap, ",
    readPi: "and the chance that {a}'s true value is larger than {b}'s is {pi}.",
    readTally: " Of the {M} pairs, {apart} have intervals that do not overlap and {ov} have overlapping ones: {high} of these with one direction above {thr}, {low} with neither.",
    // caption: the teaching-posterior caption of labels.js and its gloss; the one line on the league names the draw
    gloss: "The normal posterior gives both the marginal intervals and the direction probabilities for the league.",
    note: "The simulated league of {league}, built for this site: thirty units with independent normal posteriors, from the estimates drawn with seed {seed}, under the teaching posterior of {shrinkage} (prior mean {mean}, prior SD {prior}).",
  }),
});

const T = CONFIG.text;
const LC = CONFIG.leagueChart;

// ---------------------------------------------------------------------------------------------- the league

const LEAGUE = league30();
const DRAW = drawLeague(LEAGUE_SEED);
const N_UNITS = LEAGUE.ids.length;
const M = pairCount(N_UNITS);
const INDEX = new Map(LEAGUE.ids.map((id, i) => [id, i]));
const PAIR_RE = /^\s*(U\d+)\s*-\s*(U\d+)\s*$/i;

/** The pair key: "overlap-high" (the engine's pick, any case), or two different league ids "U13-U05" (first,
 * second; any case, spaces allowed around the hyphen); anything else is unreadable (undefined keeps the old value). */
export function parsePair(v) {
  if (typeof v !== "string") return undefined;
  if (v.trim().toLowerCase() === CONFIG.pick) return CONFIG.pick;
  const m = PAIR_RE.exec(v);
  if (!m) return undefined;
  const a = m[1].toUpperCase();
  const b = m[2].toUpperCase();
  return INDEX.has(a) && INDEX.has(b) && a !== b ? `${a}-${b}` : undefined;
}

const pairKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);

/** The league at one prior SD and level: posterior, intervals, positions, every pair's row of the tally (by pair key)
 * and the engine's pick (engine intervalOverlapTally: overlap is strict, a pair's probability is its more likely
 * direction's, and the pick is the overlapping pair with the largest one, first = the more likely higher unit).
 * bound = Φ(z) for the level's upper normal quantile z: in a pair whose intervals do not overlap, one direction has a
 * larger probability. */
export function leagueSummary(priorSd, levelPct) {
  const level = levelPct / CONFIG.percent;
  const post = normalPosterior(DRAW.estimate, LEAGUE.se, { priorMean: CONFIG.priorMean, priorSd });
  const iv = normalInterval(post.mean, post.sd, level);
  const rank = strictOrder(post.mean);
  const tally = intervalOverlapTally(iv.lower, iv.upper, directionMatrix(post.mean, post.sd), { threshold: CONFIG.threshold });
  const counts = { apart: tally.apart, high: tally.high, low: tally.low, overlapping: tally.overlapping };
  const pairs = new Map(tally.pairs.map((p) => [pairKey(p.i, p.j), p]));
  const best = tally.best ? { first: tally.best.first, second: tally.best.second, pi: tally.best.pi } : null;
  const z = normalInterval(0, 1, level).upper;
  return { priorSd, levelPct, level, post, iv, rank, counts, pairs, best, M, bound: normalCdf(z) };
}

/** One chosen pair (first a, second b) in a league summary: the higher unit by posterior mean (hi) and the lower (lo);
 * the stretch the two intervals share, from `from` (the larger lower end) to `to` (the smaller upper end), or the gap
 * between them when to < from, for the drawing; from the pair's row of the tally: overlap (the engine's strict rule),
 * amount (the stretch's length, negative for a gap) and the class; inner, when one interval lies inside the other
 * (the row's nested: then the shared stretch is the inner interval itself); pi = Pr(a's true value > b's) (engine
 * pairDirection). */
export function pairInfo(s, a, b) {
  const { lower, upper } = s.iv;
  const [hi, lo] = s.rank[a] < s.rank[b] ? [a, b] : [b, a];
  const row = s.pairs.get(pairKey(a, b));
  const from = Math.max(lower[a], lower[b]);
  const to = Math.min(upper[a], upper[b]);
  const inner = !row.nested ? null : lower[a] === from && upper[a] === to ? a : b;
  return {
    a, b, hi, lo, from, to, amount: row.amount, overlap: row.overlap,
    inner, outer: inner === null ? null : inner === a ? b : a,
    pi: pairDirection(s.post.mean[a], s.post.sd[a], s.post.mean[b], s.post.sd[b]),
    cls: row.class,
  };
}

/** The two units of the pair key in a summary: [first, second] indices. The pick falls back to the two highest units
 * when no two intervals overlap (not reached on this league). */
export function resolvePair(key, s) {
  if (key === CONFIG.pick) return s.best ? [s.best.first, s.best.second] : [s.rank.indexOf(1), s.rank.indexOf(2)];
  const [a, b] = String(key).split("-");
  return [INDEX.get(a), INDEX.get(b)];
}

/** A round x domain for the league figure: every interval end, padded, on multiples of CONFIG.leagueChart.step. */
export function leagueDomain(s) {
  const { step, decimals, pad } = LC;
  const lo = Math.min(...s.iv.lower) - pad;
  const hi = Math.max(...s.iv.upper) + pad;
  const round = (x) => Number(x.toFixed(decimals));
  return [round(Math.floor(lo / step) * step), round(Math.ceil(hi / step) * step)];
}

const caseOf = (pair) => (!pair.overlap ? "apart" : pair.inner !== null ? "nested" : "overlap");
const value3 = (v) => formatDecimal(v, { digits: CONFIG.digits.value });
// a direction probability written next to a mark: as in the read-out, strictly inside (0, 1), a bound as a relation
const markProb = (v) => formatProb(v, { open: true, bounds: "symbols" });

/** The width in px of a text in the figure's font (bold for the mark words): measured on a canvas, or estimated where
 *  there is none (jsdom), so that the pair's numbers can sit next to the marks (pairLabels). */
function textMeter(el) {
  const doc = el.ownerDocument;
  const canvas = typeof doc?.defaultView?.CanvasRenderingContext2D === "function" ? doc.createElement("canvas").getContext("2d") : null;
  const scale = Number(el.closest?.(".prx-widget")?.getAttribute("data-prx-font-scale")) || 1;
  const size = CHART.fontSize * scale;
  const family = palette(el).fontSans || "system-ui, sans-serif";
  return (text, bold = false) => {
    if (!canvas) return text.length * (bold ? LC.label.charBold : LC.label.char) * scale;
    canvas.font = `${bold ? "bold " : ""}${size}px ${family}`;
    return canvas.measureText(text).width;
  };
}

/**
 * The pair's numbers next to its marks (review 044 repair, X-01: the answer on the changed mark), from the same engine
 * values as the card and the read-out: after "first", the probability that the first unit's true value is larger than
 * the second's ("chance .988"); after "second", the overlap of the two intervals ("overlap .005"; when one lies inside
 * the other, the inner one's length) or the gap between them ("gap .002"). Each stays in its unit's row: after the
 * mark word when it fits before the figure's right edge, else left of the unit's interval when it fits after the
 * plot's left edge; a label never crosses a dashed line, it starts (or ends) past it; where the words fit on neither
 * side, the number stands alone, after the mark word or left of the interval (a sweep of every ordered pair at the
 * presets' levels and prior SDs, on a site page and standalone at 375 and 1280 px, found every label inside the figure
 * and clear of the names, its interval, the marks and the dashed lines). width: the figure's width in px;
 * measure(text, bold): textMeter.
 */
function pairLabels(s, pair, [lo, hi], width, measure) {
  const G = LC.label;
  const plotW = Math.max(1, width - LC.marginLeft - LC.marginRight);
  const px = (x) => LC.marginLeft + ((x - lo) / (hi - lo)) * plotW;
  const amount = Math.abs(pair.amount);
  // the dashed lines run through both chosen rows: a label never crosses one, it starts (or ends) past it
  const guides = [px(pair.from), px(pair.to)];
  return [
    { i: pair.a, mark: T.markFirst, word: T.markChance, raw: pair.pi, format: markProb, hook: "mark-pi" },
    { i: pair.b, mark: T.markSecond, word: pair.overlap ? T.markOverlap : T.markGap, raw: amount, format: value3, hook: "mark-amount" },
  ].map((d) => {
    const display = d.format(d.raw);
    const upper = s.iv.upper[d.i];
    const lower = s.iv.lower[d.i];
    const xu = px(upper);
    const xl = px(lower);
    const full = measure(`${d.word} ${display}`);
    const num = measure(display);
    // right of the mark word: where a label of width w starts (px), past a dashed line that would cross it
    const startRight = (w) => {
      let x = xu + LC.markDx + measure(d.mark, true) + G.gap;
      for (const g of [...guides].sort((u, v) => u - v)) if (g > xu && g >= x - G.gap && g <= x + w) x = g + G.gap;
      return x;
    };
    // left of the interval: where a label of width w ends (px), before a dashed line that would cross it
    const endLeft = (w) => {
      let x = xl - LC.markDx;
      for (const g of [...guides].sort((u, v) => v - u)) if (g < xl && g <= x + G.gap && g >= x - w) x = g - G.gap;
      return x;
    };
    const fitsRight = (w) => startRight(w) + w <= width - G.edge;
    const fitsLeft = (w) => endLeft(w) - w >= LC.marginLeft + G.edge;
    const [side, withWord] = fitsRight(full) ? ["right", true] : fitsLeft(full) ? ["left", true] : fitsRight(num) ? ["right", false] : ["left", false];
    const w = withWord ? full : num;
    // dx from the interval end the label is placed at (the upper end on the right, the lower end on the left)
    const dx = side === "right" ? startRight(w) - xu : endLeft(w) - xl;
    return { ...d, y: s.rank[d.i], upper, lower, side, withWord, dx, num, wordRoom: measure(`${d.word} `), space: measure(" ") };
  });
}

/** The marks of one pair label (pairLabels): the number (numText, data-num, its read-out hook) and, when it fits, its
 *  word, both with the marks' halo; right of the mark word (text-anchor start) or left of the interval (end). */
function labelMarks(c, P, d) {
  const style = { fill: c.plotFg, stroke: c.plotBg, strokeWidth: LC.halo, paintOrder: "stroke" };
  const right = d.side === "right";
  const at = right ? d.upper : d.lower;
  const hooked = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    for (const t of g?.querySelectorAll?.("text") ?? []) t.setAttribute("data-prx-readout", d.hook);
    return g;
  };
  const marks = [numText([d], {
    x: () => at, y: "y", value: "raw", format: d.format, textAnchor: right ? "start" : "end",
    dx: right ? d.dx + (d.withWord ? d.wordRoom : 0) : d.dx, render: hooked, ...style,
  })];
  if (d.withWord) {
    marks.push(P.text([d], {
      x: () => at, y: "y", text: "word", textAnchor: right ? "start" : "end",
      dx: right ? d.dx : d.dx - d.num - d.space, ...style,
    }));
  }
  return marks;
}

/** Unit names in a Plot text mark carry data-prx-name (a Plot render hook over the rows of that mark). */
const nameRender = (list) => (index, scales, values, dims, context, next) => {
  const g = next(index, scales, values, dims, context);
  const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
  Array.from(index).forEach((k, j) => nodes[j]?.setAttribute("data-prx-name", list[k].name));
  return g;
};

/** The league figure in el for a summary s and a chosen pair (pairInfo): rows by position, the chosen units dark with
 * their first and second marks and the pair's numbers next to them (pairLabels), the dashed lines and the band; its
 * hidden table and keyboard reading. Returns { chart, rows } (rows: one per unit, in position order, with i, id, pos). */
export function drawLeagueFigure(el, s, pair) {
  const [lo, hi] = leagueDomain(s);
  // the figure's width as chart.js takes it (given explicitly, so the labels' room is computed for the same width)
  const measured = Math.round(el.clientWidth || el.getBoundingClientRect?.().width || 0);
  const width = measured > 0 ? Math.max(CHART.minWidth, measured) : CHART.defaultWidth;
  const labels = pairLabels(s, pair, [lo, hi], width, textMeter(el));
  const rows = LEAGUE.ids.map((id, i) => ({
    i, id, name: id, group: LEAGUE.group[i], pos: s.rank[i], y: s.rank[i], mean: s.post.mean[i], sd: s.post.sd[i],
    lower: s.iv.lower[i], upper: s.iv.upper[i], strong: i === pair.a || i === pair.b,
    mark: i === pair.a ? T.markFirst : i === pair.b ? T.markSecond : "",
  })).sort((p, q) => p.pos - q.pos);
  const marked = rows.filter((r) => r.strong);
  const span = [Math.min(s.rank[pair.a], s.rank[pair.b]), Math.max(s.rank[pair.a], s.rank[pair.b])];
  const levelWords = formatPercent(s.level);
  const chart = plot(el, {
    alt: words(T.altLeague, { guides: T.altGuides[caseOf(pair)] }),
    table: {
      caption: T.tableLeague,
      columns: [
        { label: T.colPosition, value: "pos", format: (v) => formatCount(v) },
        { label: T.colUnit, value: "id" },
        { label: T.colSize, value: (d) => CONFIG.groupWord[d.group] },
        { label: T.colMean, value: "mean", format: (v) => value3(v) },
        { label: T.colSd, value: "sd", format: (v) => value3(v) },
        { label: T.colLower, value: "lower", format: (v) => value3(v) },
        { label: T.colUpper, value: "upper", format: (v) => value3(v) },
      ],
      rows,
    },
    width,
    height: LC.marginTop + LC.marginBottom + N_UNITS * LC.rowPx,
    marginTop: LC.marginTop, marginBottom: LC.marginBottom, marginLeft: LC.marginLeft, marginRight: LC.marginRight,
    x: { domain: [lo, hi], ticks: LC.xTicks, label: T.xLeague, labelAnchor: "center", labelArrow: "none", grid: true },
    y: { domain: [N_UNITS + LC.half, LC.half], axis: null },
    marks: (c, P) => [
      ...overlapMarks(c, P, { from: pair.from, to: pair.to, y1: span[0], y2: span[1], band: pair.overlap, lines: [pair.from, pair.to] }),
      ...intervalMarks(c, P, rows, { line: LC.line, dot: LC.dot, nameDx: LC.nameDx, nameRender }),
      P.text(marked, {
        x: "upper", y: "y", text: "mark", textAnchor: "start", dx: LC.markDx, fill: c.plotFg, fontWeight: "bold",
        stroke: c.plotBg, strokeWidth: LC.halo, paintOrder: "stroke",
      }),
      ...labels.flatMap((d) => labelMarks(c, P, d)),
    ],
    keyboard: {
      data: rows, x: "mean", y: "pos", key: (d) => d.id, sort: false, label: T.kbdLeague,
      title: (d) => words(T.kbdPoint, {
        id: d.id, group: CONFIG.groupUnit[d.group], mean: value3(d.mean), level: levelWords, lower: value3(d.lower), upper: value3(d.upper),
      }) + (d.i === pair.a ? T.kbdChosen.first : d.i === pair.b ? T.kbdChosen.second : ""),
    },
  });
  return { chart, rows };
}

// ---------------------------------------------------------------------------------------------- app

const CSS = `${cssFor(CONFIG.className)}
.prx-iol .prx-iol-group { flex: 1 1 100%; align-items: flex-start; }
.prx-iol .prx-iol-pick-hint { flex: 1 1 18rem; align-self: center; margin: 0; }
.prx-iol .prx-iol-charts { container-type: inline-size; }
.prx-iol .prx-iol-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 1.25rem; align-items: start; }
.prx-iol .prx-iol-side { min-width: 0; }
.prx-iol .prx-iol-side > .prx-io-pair { margin-top: 0; }
.prx-iol .prx-iol-league > .prx-io-pair { margin: .3rem 0 .45rem; }
@container (min-width: 46rem) {
  .prx-iol .prx-iol-layout { grid-template-columns: minmax(0, 1.25fr) minmax(16rem, 1fr); }
}
.prx-iol .prx-iol-league-chart svg { cursor: pointer; }
.prx-iol .prx-iol-tally { margin: 0.75rem 0 0; }
.prx-iol .prx-iol-table-wrap { max-width: 100%; overflow-x: auto; color: var(--prx-plot-fg); background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-iol .prx-iol-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.9em; color: var(--prx-plot-fg);
  font-variant-numeric: tabular-nums; }
.prx-iol .prx-iol-table caption { caption-side: top; padding: 0.35rem 0.6rem; text-align: left; color: var(--prx-plot-fg); font-weight: 600; }
.prx-iol .prx-iol-table th, .prx-iol .prx-iol-table td { padding: 0.3rem 0.6rem; text-align: left; vertical-align: top;
  border-top: 1px solid var(--prx-plot-grid); }
.prx-iol .prx-iol-table thead th { font-weight: 600; }
.prx-iol .prx-iol-table tbody th { font-weight: 400; }
.prx-iol .prx-iol-table th:nth-child(2), .prx-iol .prx-iol-table td:nth-child(2) { width: 1%; text-align: right; white-space: nowrap;
  overflow-wrap: normal; }
.prx-iol .prx-iol-bar-track { display: block; max-width: 24rem; margin-top: 0.3rem; }
.prx-iol .prx-iol-bar { display: block; min-width: 2px; height: 0.7rem; background: var(--prx-plot-muted); border: 1px solid var(--prx-plot-axis); }
.prx-iol .prx-iol-chosen-row > th, .prx-iol .prx-iol-chosen-row > td { background: var(--prx-plot-grid); }
.prx-iol .prx-iol-tag { display: inline-block; margin-left: 0.4rem; padding: 0 0.35rem; font-size: 0.85em; font-weight: 600;
  border: 1px solid var(--prx-plot-axis); border-radius: var(--prx-radius); }
.prx-iol .prx-iol-total-row > th, .prx-iol .prx-iol-total-row > td { font-weight: 600; }
.prx-iol .prx-iol-best { margin: 0; padding: 0.35rem 0.6rem; font-size: 0.9em; border-bottom: 1px solid var(--prx-plot-grid); }
.prx-iol .prx-iol-note { margin: 0.35rem 0 0; font-size: 0.78rem; line-height: 1.35; color: var(--prx-fg-muted); }
`;

export function mountWidget(el, spec = {}) {
  const D = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    // the shared result-first frame (review 044 repair, X-01): the read-out directly under the controls and the preset
    // row; base.js only moves nodes (keys, presets, hooks and the live region are the same)
    layout: "result-first",
    keys: {
      level: { type: "choice", values: CONFIG.levels, value: D.level },
      pair: { type: "custom", value: D.pair, parse: (v) => parsePair(v) },
      priorSd: { type: "number", ...CONFIG.priorSd, value: D.priorSd },
    },
    build(ctx) {
      const { h } = ctx;
      const k = textKit(ctx);
      const memo = new Map();
      const summaryOf = (prior, levelPct) => {
        const key = `${prior}|${levelPct}`;
        if (!memo.has(key)) {
          if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
          memo.set(key, leagueSummary(prior, levelPct));
        }
        return memo.get(key);
      };
      // the slot the next click in the figure fills (the pick hint says which)
      let nextSlot = "first";

      // --- controls: the level, the prior SD, the two units and the pick (the preset row follows them)
      const levelGroup = ctx.radioGroup({
        legend: T.levelLegend, name: "level", value: ctx.state.level, className: "prx-io-level",
        options: CONFIG.levels.map((l) => ({ value: l, label: formatPercent(l / CONFIG.percent) })),
        onChange: (v) => ctx.set({ level: v }),
      });
      const link = (key) => () => appLink(ctx, CONFIG.apps[key].app, { title: CONFIG.apps[key].title, className: IO.linkClass });
      const priorSlider = ctx.slider({
        label: T.priorLabel, ...CONFIG.priorSd, name: "priorSd", hint: fill(T.priorHint, { app: link("shrinkage") }), value: ctx.state.priorSd,
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      const unitOptions = LEAGUE.ids.map((id, i) => ({ value: id, label: words(T.unitOption, { id, group: CONFIG.groupUnit[LEAGUE.group[i]] }) }));
      /** Put unit `id` in a slot; a unit already in the other slot swaps places with the one it replaces. */
      const choose = (slot, id) => {
        const s = summaryOf(ctx.state.priorSd, ctx.state.level);
        const [a, b] = resolvePair(ctx.state.pair, s);
        let first = LEAGUE.ids[a];
        let second = LEAGUE.ids[b];
        if (slot === "first") {
          if (id === second) second = first;
          first = id;
        } else {
          if (id === first) first = second;
          second = id;
        }
        ctx.set({ pair: `${first}-${second}` });
      };
      const firstSelect = ctx.select({ label: T.firstLabel, name: "first", options: unitOptions, onChange: (v) => { nextSlot = "second"; choose("first", v); } });
      const secondSelect = ctx.select({ label: T.secondLabel, name: "second", options: unitOptions, onChange: (v) => { nextSlot = "first"; choose("second", v); } });
      const bestBtn = ctx.button({
        label: T.bestButton, key: "best",
        onClick: () => {
          nextSlot = "first";
          const before = ctx.state.pair;
          ctx.set({ pair: CONFIG.pick });
          if (before === CONFIG.pick) ctx.requestRender("pick");
        },
      });
      const pickHint = h("p", { class: "prx-hint prx-iol-pick-hint" });
      ctx.controls.append(h("div", { class: "prx-io-group prx-iol-group" },
        levelGroup.root, priorSlider.root, firstSelect.root, secondSelect.root, h("div", { class: "prx-io-buttons" }, bestBtn.root), pickHint));

      // --- figure (left) and, beside it when there is room, the pair card and the tally
      ctx.charts.classList.add("prx-iol-charts");
      const leagueHead = ctx.panelTitle("", { className: "prx-io-heading" });
      // the figure the units, the level and the prior SD change (review 044, X-01: base.js primaryGraphic)
      const leagueSlot = ctx.primaryGraphic(h("div", { class: "prx-io-panel prx-iol-league-chart" }));
      const leagueKey = keyNode(ctx);
      const card = pairCard(ctx);
      // the tally sits on the plot panel and scrolls inside its own box (a keyboard stop) when it is too wide
      const tallyWrap = ctx.scrollRegion(h("div", { class: "prx-iol-table-wrap prx-light-panel" }), T.tallyLabel);
      const tally = ctx.part("readout", h("div", { class: "prx-iol-tally" }, tallyWrap));
      const leaguePanel = h("section", { class: "prx-io-view prx-iol-league", "aria-label": T.leagueSection }, leagueHead, leagueSlot, leagueKey);
      const side = h("div", { class: "prx-iol-side" }, card.root, tally);
      ctx.charts.append(h("div", { class: "prx-iol-layout" }, leaguePanel, side));
      // On phones show the chosen pair beside the top of the long chart, so
      // the reader need not go to the bottom to find its direction probability.
      const narrow = ctx.win.matchMedia?.("(max-width: 37.5em)");
      const placePair = () => {
        const to = narrow?.matches ? leaguePanel : side;
        if (card.root.parentNode !== to) ctx.keepFocus(() => narrow.matches ? leagueHead.after(card.root) : side.prepend(card.root));
      };
      placePair();
      if (narrow) ctx.listen(narrow, "change", placePair);

      // --- caption (the teaching-posterior caption and its gloss) and the one line on the league and its draw
      const note = ctx.part("notes", h("p", { class: "prx-iol-note" }));
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), ". ", T.gloss);
      ctx.caption.after(note);

      // --- the league figure: a click at a row's height (or Enter on its keyboard point) chooses that unit
      let figure = null;
      function pickUnit(i) {
        if (i === undefined || i === null) return;
        const slot = nextSlot;
        nextSlot = slot === "first" ? "second" : "first";
        const before = ctx.state.pair;
        choose(slot, LEAGUE.ids[i]);
        // a click that changes nothing (the unit is already in that slot) still moves the next slot
        if (ctx.state.pair === before) ctx.requestRender("pick");
      }
      function rowAt(e) {
        if (!figure) return null;
        const sy = figure.chart.scale("y");
        const svg = figure.chart.svg;
        const rect = svg.getBoundingClientRect();
        const H = Number(svg.getAttribute("height")) || rect.height;
        if (!(rect.height > 0) || !sy?.domain || !sy?.range) return null;
        const yv = ((e.clientY - rect.top) * H) / rect.height;
        const [d0, d1] = sy.domain;
        const [r0, r1] = sy.range;
        const pos = Math.round(d0 + ((yv - r0) * (d1 - d0)) / (r1 - r0));
        const row = figure.rows.find((r) => r.pos === pos);
        return row ? row.i : null;
      }
      ctx.listen(leagueSlot, "click", (e) => {
        const point = e.target?.closest?.(".prx-kbd-point");
        if (point) {
          const id = String(point.getAttribute("data-prx-focus-key") ?? "").split(":").pop();
          if (INDEX.has(id)) pickUnit(INDEX.get(id));
          return;
        }
        if (e.target?.closest?.("svg")) {
          const i = rowAt(e);
          if (i !== null) pickUnit(i);
        }
      });

      const id = (i) => () => k.unitName(LEAGUE.ids[i]);

      function writeKey(s, pair) {
        const kind = caseOf(pair);
        leagueKey.replaceChildren(
          keyItem(ctx, "line-dim", fill(T.keyInterval, { level: () => k.pct(s.levelPct) })),
          keyItem(ctx, "line", T.keyChosen),
          keyItem(ctx, kind === "apart" ? "dash" : "band", T.keyGuides[kind]),
        );
      }

      function writeCard(s, pair) {
        const amount = () => k.dec(Math.abs(pair.amount), CONFIG.digits.amount, "card-amount");
        const dec = (raw, name) => () => k.dec(raw, CONFIG.digits.value, name);
        card.set({
          intervals: [
            fill(T.leagueEnds, {
              a: id(pair.a), b: id(pair.b),
              aLower: dec(s.iv.lower[pair.a], "card-a-lower"), aUpper: dec(s.iv.upper[pair.a], "card-a-upper"),
              bLower: dec(s.iv.lower[pair.b], "card-b-lower"), bUpper: dec(s.iv.upper[pair.b], "card-b-upper"),
            }),
            { status: pair.overlap ? "overlap" : "apart", content: fill(pair.overlap ? T.leagueOverlap : T.leagueApart, { amount }) },
            pair.inner === null ? null : fill(T.leagueInside, { inner: id(pair.inner), outer: id(pair.outer) }),
            fill(T.leagueMoments, {
              aMean: dec(s.post.mean[pair.a], "card-a-mean"), bMean: dec(s.post.mean[pair.b], "card-b-mean"),
              aSd: dec(s.post.sd[pair.a], "card-a-sd"), bSd: dec(s.post.sd[pair.b], "card-b-sd"),
            }),
          ],
          direction: [
            { pi: true, content: fill(T.cardPi, { a: id(pair.a), b: id(pair.b), pi: () => k.prob(pair.pi, "card-pi") }) },
            { hint: true, content: fill(T.cardNext, { app: link("twoUnits") }) },
          ],
        });
      }

      function writeTally(s, pair, state) {
        const thr = () => k.dec(CONFIG.threshold, CONFIG.digits.threshold);
        const classes = [
          { c: "apart", n: s.counts.apart, slots: { bound: () => k.prob(s.bound, "bound") } },
          { c: "high", n: s.counts.high, slots: { thr } },
          { c: "low", n: s.counts.low, slots: { thr } },
        ];
        const body = classes.map((r) => {
          const mine = pair.cls === r.c;
          return h("tr", { class: mine ? "prx-iol-chosen-row" : null },
            h("th", { scope: "row" }, h("span", {}, fill(T.tallyRows[r.c], r.slots)),
              mine ? h("span", { class: "prx-iol-tag" }, T.chosenTag) : null,
              h("span", { class: "prx-iol-bar-track", "aria-hidden": "true" },
                h("span", { class: `prx-iol-bar prx-iol-bar-${r.c}`, style: { width: `${(CONFIG.percent * r.n) / s.M}%` } }))),
            h("td", {}, k.count(r.n, `tally-${r.c}`)));
        });
        body.push(h("tr", { class: "prx-iol-total-row" }, h("th", { scope: "row" }, T.tallyRows.all), h("td", {}, k.count(s.M, "tally-all"))));
        const best = s.best
          ? fill(T.tallyBest, { ov: () => k.count(s.counts.overlapping), pi: () => k.prob(s.best.pi, "tally-best"), a: id(s.best.first), b: id(s.best.second) })
          : T.tallyNoBest;
        // the overlapping pair with the highest probability opens the box (review 044 repair, X-01: with the read-out
        // above the figures, it stays in the first screen at 1280 with the preset row that quotes it)
        tallyWrap.replaceChildren(
          h("p", { class: "prx-iol-best" }, best),
          h("table", { class: "prx-iol-table" },
            h("caption", {}, fill(T.tallyCaption, { M: () => k.count(s.M), prior: () => k.setting(state.priorSd), level: () => k.pct(state.level) })),
            h("thead", {}, h("tr", {}, h("th", { scope: "col" }, T.tallyKind), h("th", { scope: "col" }, T.tallyCount))),
            h("tbody", {}, body)));
      }

      function writeReadout(s, pair, state) {
        ctx.readout.set([
          ...fill(pair.overlap ? T.readLeagueOverlap : T.readLeagueApart, { a: id(pair.a), b: id(pair.b), level: () => k.pct(state.level, "level") }),
          ...fill(T.readPi, { a: id(pair.a), b: id(pair.b), pi: () => k.prob(pair.pi, "pi") }),
          ...fill(T.readTally, {
            M: () => k.count(s.M, "pairs"), apart: () => k.count(s.counts.apart, "apart"),
            ov: () => k.count(s.counts.overlapping, "overlap"), high: () => k.count(s.counts.high, "high"),
            low: () => k.count(s.counts.low, "low"), thr: () => k.dec(CONFIG.threshold, CONFIG.digits.threshold),
          }),
        ]);
      }

      return {
        render(state) {
          levelGroup.set(state.level);
          priorSlider.set(state.priorSd);
          const s = summaryOf(state.priorSd, state.level);
          const [a, b] = resolvePair(state.pair, s);
          const pair = pairInfo(s, a, b);
          firstSelect.set(LEAGUE.ids[a]);
          secondSelect.set(LEAGUE.ids[b]);
          pickHint.replaceChildren(words(T.pickHint, { next: nextSlot === "first" ? T.nextFirst : T.nextSecond }));
          leagueHead.replaceChildren(...fill(T.leagueHead, { level: () => k.pct(state.level) }));
          figure = drawLeagueFigure(leagueSlot, s, pair);
          writeKey(s, pair);
          writeCard(s, pair);
          writeTally(s, pair, state);
          writeReadout(s, pair, state);
          note.replaceChildren(...fill(T.note, {
            league: link("league"), shrinkage: link("shrinkage"),
            seed: () => k.setting(LEAGUE_SEED, "note-seed"), mean: () => k.setting(CONFIG.priorMean, "note-mean"),
            prior: () => k.setting(state.priorSd, "note-prior"),
          }));
        },
      };
    },
  });
}
