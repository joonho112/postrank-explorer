// pairwise-matrix (app 1.13): "All pairs at once". Ported from postrank Explorer v1 L-08 (js/widgets/pairwise-matrix.js
// and styles/widgets/pairwise-matrix.css) without the prediction gate: the filled matrix, the legend, the read-out and
// the pair panel are shown at once.
//
// Every pair's direction probability π_ij = Pr(θ_i > θ_j ∣ Y) in one matrix: the cell in row i and column j is the
// probability that the row unit's true value is larger than the column unit's, the same direction rule as the
// package's postrank_plot_pairwise() (row above column, first unit in the top row and the left column, an empty
// diagonal); that figure shows 1 − π in each cell. Two data sets:
//   six      the six sites of the postrank tutorial, their reading score (score_A; data/released/six-sites.json):
//            independent normal posteriors taken as given
//   league   the simulated league (engine league30 and drawLeague at LEAGUE_SEED) with the teaching normal–normal
//            posterior (engine normalPosterior, prior mean 0, prior SD set by the reader)
// Every probability comes from the engine: π from directionMatrix, the error array from errorArray, the least
// certain pairs and how far each sits from the diagonal in the order shown from leastCertainPairs (with `order`), the
// worked formula's difference from pairDifference; the row order from reportCardRows (posterior mean, larger first,
// or label; remaining ties by id, as the package). A normal pair probability lies strictly inside (0, 1), so it is
// written with formatProb's `open` (CR-008). Linked views, all drawn from one state { data, sort, priorSd, cell } and
// the cell under the pointer:
//   matrix   (matrixView) π in the 7-step Blues ramp (CONFIG.blueCuts: the mirror cell of step k is in step 8 − k), a
//            value in every cell (two decimals in the league), row and column labels, a gray diagonal; outlines mark
//            the selected cell (solid) and its mirror cell (dashed). The keyboard grid (chart.js keyboard with
//            columns) moves one cell with Left and Right and one row with Up and Down; its one Tab stop is the
//            selected cell, and focusing a cell selects it (the pair panel follows after CONFIG.pairDeferMs, so that
//            held arrow keys stay light). Hovering shows a tip and the cell's two posteriors; a click or tap selects
//            the cell. The league matrix keeps cells of at least CONFIG.matrix.league.minCell px and scrolls sideways
//            inside its own box (then a keyboard stop) when the column is narrower. When only the prior SD, the order
//            or the cell changes, the drawn matrix is updated in place (cell fills, values and data-num, labels,
//            keyboard names, the hidden table) instead of being drawn again.
//   pair     (pairView) the two posteriors of the selected (or hovered) cell: the row unit solid, the column unit
//            dashed, short ticks at every unit's posterior mean, how far the cell sits from the diagonal, the worked
//            formula π = Φ(gap / SD of the difference) with every number as data-num, its scope and Φ in words, and
//            the mirror cell's 1 − π. The arrow keys read the posteriors drawn.
//   least    (leastView) the least certain pairs (engine leastCertainPairs, CONFIG.least of them), each written in
//            its more likely direction, with its probability and how far its cell sits from the diagonal in the order
//            shown (the engine's `apart`); choosing one selects its cell
// The read-out names the least certain pair and how far its cell sits from the diagonal in the current order; the
// selection starts there.
//
// Keys: data ("six" | "league"), sort ("mean" | "label"), priorSd (number .02–.60, clamped, not snapped; it acts only
// on the league, so its slider is in the controls only while the league is shown) and cell ("auto": the least
// certain pair, or "<row id>,<column id>" such as "C,D" or "U19,U25"; a cell the data set shown does not have reads
// as auto). Choosing the data set returns the cell to auto; a reader's pick survives changes of the prior SD and the
// order. A preset is a whole setting, so it selects the least certain pair unless it names a cell.
//
// Exports for the apps that build on this matrix (1.12 overlap-in-the-league, 1.15 majority-wins):
//   data      dataset(data, priorSd) (memoized: ids, posterior means and SDs, π, the error array, the least certain
//             pairs), leastInOrder(d, order), orderOf(d, sort), parseCell(v), cellKey(d, cell), resolveCell(d, key),
//             stepsApart(order, cell)
//   geometry  blueStep(p), niceDomain(lo, hi), densityFrame(d), densityPoints(mu, sd, lo, hi), spreadLabels(...)
//   views     matrixView(ctx, { onFocus }), pairView(ctx), leastView(ctx, { onPick }), legendNodes(ctx)
//   text      fill(template, slots), fillText(template, slots)
//   CSS       cssFor(rootClass) (the views' CSS under another root class)
import { appLink, createWidget, uid } from "../shared/base.js";
import { labelOn, numText, plot } from "../shared/chart.js";
import { dataNum, formatCount, formatDecimal, formatProb, formatSetting, setNum } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, directionMatrix, drawLeague, errorArray, league30, leastCertainPairs, normalPdf, normalPosterior,
  pairCount, pairDifference, reportCardRows,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "pairwise-matrix",
  label: "All pairs at once: the direction probability of every pair of units, as a matrix",
  title: "Every pair at once: the row unit above the column unit",
  className: "prx-pm",
  data: Object.freeze({ values: Object.freeze(["six", "league"]), value: "six" }),
  sort: Object.freeze({ values: Object.freeze(["mean", "label"]), value: "mean" }),
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  // the selected cell: "auto" follows the least certain pair; otherwise "<row id>,<column id>"
  cell: Object.freeze({ auto: "auto", separator: "," }),
  // the criterion name of each data set's error array (engine errorArray)
  criterion: Object.freeze({ six: "score_A", league: "theta" }),
  priorMean: 0,
  half: 0.5,
  percent: 100,
  memo: 8,
  // the pair panel follows a keyboard move after this many ms of quiet (held arrow keys draw it once)
  pairDeferMs: 150,
  // keys whose change keeps the matrix's shape, so the drawn cells are updated in place
  inPlaceKeys: Object.freeze(["priorSd", "sort", "cell"]),
  // the Blues steps: step k holds π in [cut k−1, cut k); symmetric about one half, so a mirror cell (1 − π) sits in
  // step 8 − k (a value exactly on a cut aside)
  blueCuts: Object.freeze([0.05, 0.2, 0.4, 0.6, 0.8, 0.95]),
  // how many of the least certain pairs the list shows (engine leastCertainPairs; clamped to the number of pairs)
  least: Object.freeze({ six: 3, league: 10 }),
  matrix: Object.freeze({
    // the league writes its column labels upright (rotated a quarter turn), so they need a taller top margin
    six: Object.freeze({ minCell: 40, maxCell: 64, font: 12, labelFont: 13, digits: 3, marginTop: 24, rotate: 0 }),
    league: Object.freeze({ minCell: 22, maxCell: 30, font: 9, labelFont: 10, digits: 2, marginTop: 34, rotate: -90 }),
    marginLeft: 38, marginRight: 4, marginBottom: 4, labelGap: 6, inset: 0.5, halo: 2.5,
  }),
  // the pair panel's density figure: an even grid over the axis and a denser one within `reach` SDs of each mean;
  // one x domain and one y domain per data set, so the panel does not jump between cells
  density: Object.freeze({
    height: 170, marginTop: 22, marginBottom: 38, marginLeft: 44, marginRight: 14, base: 161, dense: 81, reach: 4,
    pad: 0.03, headroom: 1.2, line: 2, dash: "6,4", labelDy: -8, labelDx: 6, minLabelPx: 16, rug: 0.08,
    rugWidth: 1, rugOn: 2.5, yTicks: 3, ticks: 6, labelOffset: 30,
  }),
  nice: Object.freeze({ mantissas: Object.freeze([1, 2, 2.5, 5, 10]), decimals: 12 }),
  digits: Object.freeze({
    six: Object.freeze({ mean: 2, sd: 2 }),
    league: Object.freeze({ mean: 3, sd: 3, se: 2 }),
    z: 3,
  }),
  text: Object.freeze({
    dataLegend: "Data",
    dataSix: "Six sites (reading score)",
    dataLeague: "Simulated league (30 units)",
    sortLegend: "Order of the rows and columns",
    sortMean: "By posterior mean, highest first",
    sortLabel: "By label",
    priorLabel: "Prior SD of the league's teaching posterior",
    // {app}: the title of app 1.5, a link once it is built (base.js appLink)
    priorHint: "A smaller prior SD pulls the league's posterior means closer together and narrows each posterior (see {app}).",
    priorApp: "shrinkage",
    howTo: "Hover, focus or tap a cell to see the two posteriors behind it. With the keyboard, Tab to the matrix and use the arrow keys: Left and Right move one cell, Up and Down one row.",
    scrollNote: "The matrix is wider than this column: scroll sideways inside its box to see every column.",
    scrollLabel: "The matrix, in a box that scrolls sideways",
    orderMean: "Rows and columns follow one order: by posterior mean, highest first (the top row and the left column).",
    orderLabel: "Rows and columns follow one order: by label.",
    sameOrder: "For the six sites the labels already follow the posterior means, so both orders give the same matrix.",
    legendTitle: "Pr(row truly higher)",
    below: "below",
    andAbove: "and above",
    legendDiagonal: "gray diagonal: a unit is not compared with itself",
    legendOutline: "solid outline: the selected cell; dashed outline: its mirror cell, with row and column swapped",
    sizeWords: Object.freeze({ six: "Six-by-six", league: "Thirty-by-thirty" }),
    matrixAlt: "{size} matrix of direction probabilities. The cell in row i and column j is the probability that the row unit's true value is larger than the column unit's; darker blue means a larger probability, and the gray diagonal is empty.",
    keyboardLabel: "Matrix cells. Left and Right move one cell, Up and Down move one row.",
    tableCaption: "Direction probabilities: each cell is the probability that the row unit's true value is larger than the column unit's (rows and columns {order})",
    tableOrderMean: "by posterior mean, highest first",
    tableOrderLabel: "by label",
    colRow: "Row unit",
    sameUnit: "same unit",
    tipCell: "Row {rowLabel}, column {colLabel}: probability {pi} that {row}'s true value is larger than {col}'s.",
    tipDiagonal: "Row {row}, column {row}: the same unit, not compared.",
    groupSuffix: Object.freeze({ small: " (small unit)", medium: " (medium unit)", large: " (large unit)" }),
    groupWord: Object.freeze({ small: "small", medium: "medium", large: "large" }),
    pairHeading: "The two posteriors behind one cell",
    selected: "Selected cell",
    hovered: "Cell under the pointer",
    rowWord: "row",
    colWord: "column",
    statusNext: ", next to the diagonal",
    statusFar: " cells from the diagonal",
    rowRole: "Row unit",
    colRole: "Column unit",
    unitLine: "{id}: posterior mean {mean}, posterior SD {sd}.",
    leagueLine: "{id}, a {group} unit ({obs} observations, SE {se}): posterior mean {mean}, posterior SD {sd}.",
    diagonalNote: "A unit is not compared with itself, so the diagonal is empty.",
    // under the worked formula: its scope and Φ in words (as app 1.8 writes them)
    workedScope: "For two independent normal posteriors.",
    glossPhiA: ") is the area under the normal curve with mean ",
    glossPhiB: " and SD ",
    glossPhiC: " to the left of ",
    mirrorHead: "Its mirror cell, row {col}, column {row}:",
    mirrorNote: "This holds when the two true values have probability zero of being equal (here: their difference is normal with positive SD).",
    densityAlt: "Posterior densities of the true values of {row} (solid line) and {col} (dashed line); short ticks along the bottom mark every unit's posterior mean, the two of this cell darker.",
    densityAltSame: "Posterior density of the true value of {row}; short ticks along the bottom mark every unit's posterior mean.",
    ticksNote: "Solid line: the row unit; dashed line: the column unit. Ticks along the bottom: every unit's posterior mean, the two of this cell darker.",
    densityTable: "Posterior mean and SD of each unit shown",
    densityKeyboard: "Posteriors in the panel. Use the arrow keys to read each one.",
    densityPoint: "{role} {id}{line}: posterior mean {mean}, posterior SD {sd}",
    densityLine: Object.freeze({ row: " (solid line)", col: " (dashed line)" }),
    colUnit: "Unit",
    colMean: "Posterior mean",
    colSd: "Posterior SD",
    xLabel: "True value",
    yLabel: "Density",
    readSix: "Six sites",
    readLeague: "Simulated league, prior SD ",
    readByMean: ", sorted by posterior mean: ",
    readByLabel: ", sorted by label: ",
    readPairs: " pairs, each in two mirror cells. The least certain direction is ",
    readAbove: " above ",
    // where the least certain pair's cell sits (the read-out's last clause, after "; ")
    readNext: "its cell is next to the diagonal",
    readFar: "its cell is {steps} cells from the diagonal",
    noteSix: "Six fictional sites from postrank's tutorial data ({data}), their reading score ({score} there): independent normal posteriors with SD {sd} each, specified for teaching and taken as given.",
    noteLeague: "Simulated league of {n} units (ten small, ten medium, ten large), one fixed draw of the estimates (seed {seed}); teaching posterior with a normal prior of mean {zero} and SD {prior}.",
    notePackage: "{fn} draws this matrix with the same rule, row above column, but each of its cells shows {one} − π, the probability that stating the row unit above the column unit is wrong; postrank chooses its grades from those error probabilities.",
    rData: "pr_tutorial",
    rScore: "score_A",
    rPlot: "postrank_plot_pairwise()",
    leastHeading: "The least certain pairs",
    leastLead: "The {k} pairs whose direction probability is closest to one half, each written in its more likely direction, and how far its cell sits from the diagonal in this order. Choose a pair to select its cell.",
    leastAll: "All {k} are next to the diagonal in this order.",
    leastNone: "None of these {k} is next to the diagonal in this order; the farthest is {far} cells away.",
    leastSome: "{next} of these {k} are next to the diagonal in this order; the farthest is {far} cells away.",
    leastColPair: "Direction",
    leastColPi: "Probability",
    // a cell next to the diagonal is one step from it ({one}: the number 1)
    leastColSteps: "Steps from the diagonal (next to it: {one})",
    leastAbove: " above ",
  }),
  tex: Object.freeze({ minus: "\\:-\\:", post: "prx-post" }),
});

const T = CONFIG.text;
const GRID = CONFIG.matrix;
const D = CONFIG.density;

// ---------------------------------------------------------------------------------------------- data

const SIX_UNITS = SIX.tables.units;
const SIX_DATA = Object.freeze({
  ids: Object.freeze(SIX_UNITS.id.slice()),
  mean: Object.freeze(SIX_UNITS.mean_A.slice()),
  sd: Object.freeze(SIX_UNITS.sd_A.slice()),
});
const LEAGUE = league30();
const LEAGUE_IDS = Object.freeze(Array.from(LEAGUE.ids));
const LEAGUE_EST = Object.freeze(Array.from(drawLeague(LEAGUE_SEED).estimate));
const LEAGUE_SE = Object.freeze(Array.from(LEAGUE.se));
// unit ids by data set, upper case -> id (the cell key is read in any case)
const ID_SETS = Object.freeze([SIX_DATA.ids, LEAGUE_IDS].map((ids) => new Map(ids.map((id) => [id.toUpperCase(), id]))));

/** "{name}" slots of a template filled with nodes or strings; returns the parts. */
export const fill = (template, slots) => String(template).split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  return m && m[1] in slots ? slots[m[1]] : p;
});
/** The same template as plain text (aria labels, keyboard titles, alt texts). */
export const fillText = (template, slots) => fill(template, slots).map((p) => (typeof p === "string" ? p : String(p))).join("");

const memo = new Map();

/** An engine least-certain pair written in its more likely direction: { i (the more likely higher unit), j, e, apart }. */
const oriented = (p) => ({ i: p.above, j: p.above === p.i ? p.j : p.i, e: p.e, apart: p.apart });

/**
 * One data set at a prior SD: ids, posterior means and SDs, the π matrix (engine directionMatrix), the error array
 * (engine errorArray) and its least certain pairs (engine leastCertainPairs, CONFIG.least of them), each oriented
 * { i, j } with i the more likely higher unit, and the first of them as `least` (leastInOrder adds how far each sits
 * from the diagonal in a display order).
 */
export function dataset(data, priorSd) {
  const key = data === "league" ? `league:${priorSd}` : "six";
  if (memo.has(key)) return memo.get(key);
  let d;
  if (data === "league") {
    const post = normalPosterior(LEAGUE_EST.slice(), LEAGUE_SE.slice(), { priorMean: CONFIG.priorMean, priorSd });
    d = { data: "league", priorSd, ids: LEAGUE_IDS.slice(), mean: Array.from(post.mean), sd: Array.from(post.sd) };
  } else {
    d = { data: "six", priorSd: null, ids: SIX_DATA.ids.slice(), mean: SIX_DATA.mean.slice(), sd: SIX_DATA.sd.slice() };
  }
  d.n = d.ids.length;
  d.M = pairCount(d.n);
  d.pi = directionMatrix(d.mean, d.sd);
  d.E = errorArray(d.mean, d.sd, { ids: d.ids, criteria: [CONFIG.criterion[d.data]] });
  d.leastList = leastCertainPairs(d.E, { k: CONFIG.least[d.data] }).map(oriented);
  d.least = d.leastList.length ? { i: d.leastList[0].i, j: d.leastList[0].j } : null;
  d.leastBy = new Map();
  if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
  memo.set(key, d);
  return d;
}

/**
 * The least certain pairs of data set d in a display order (engine leastCertainPairs with `order`): as d.leastList,
 * each with `apart`, how many cells its cell sits from the diagonal in that order. Cached on the data set per order.
 */
export function leastInOrder(d, order) {
  const key = order.join(",");
  if (!d.leastBy.has(key)) d.leastBy.set(key, leastCertainPairs(d.E, { k: CONFIG.least[d.data], order: order.slice() }).map(oriented));
  return d.leastBy.get(key);
}

/** A normal pair probability lies strictly inside (0, 1): it never reads as 0 or 1 (formatProb's open; CR-008). */
const fmtPi = (p, options = {}) => formatProb(p, { ...options, open: true });

/** Unit indices in display order (engine reportCardRows: posterior mean, larger first, or label; ties by id). */
export function orderOf(d, sort) {
  return reportCardRows(d.ids.map(() => 1), { ids: d.ids, mean: d.mean }, sort === "label" ? "label" : "mean");
}

/** The cell key: "auto", or "<row id>,<column id>" with both ids from one data set (any case); else undefined. */
export function parseCell(v) {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s.toLowerCase() === CONFIG.cell.auto) return CONFIG.cell.auto;
  const parts = s.split(CONFIG.cell.separator).map((x) => x.trim().toUpperCase());
  if (parts.length !== 2) return undefined;
  for (const ids of ID_SETS) {
    if (ids.has(parts[0]) && ids.has(parts[1])) return `${ids.get(parts[0])}${CONFIG.cell.separator}${ids.get(parts[1])}`;
  }
  return undefined;
}

/** The key of a cell { i, j } of data set d. */
export const cellKey = (d, c) => `${d.ids[c.i]}${CONFIG.cell.separator}${d.ids[c.j]}`;

/** The cell { i, j } a key names in data set d; "auto", or a cell d does not have, gives the least certain pair. */
export function resolveCell(d, key) {
  if (typeof key === "string" && key !== CONFIG.cell.auto) {
    const [a, b] = key.split(CONFIG.cell.separator);
    const i = d.ids.indexOf(a);
    const j = d.ids.indexOf(b);
    if (i >= 0 && j >= 0) return { i, j };
  }
  return d.least ? { i: d.least.i, j: d.least.j } : null;
}

/** How many cells a cell { i, j } sits from the diagonal in a display order: |position of i − position of j|. */
export function stepsApart(order, c) {
  const a = order.indexOf(c.i);
  const b = order.indexOf(c.j);
  return a < 0 || b < 0 ? null : Math.abs(a - b);
}

/** The Blues step (1–7) of a direction probability. */
export const blueStep = (p) => 1 + CONFIG.blueCuts.filter((c) => p >= c).length;

const roundNice = (x) => Number(x.toFixed(CONFIG.nice.decimals));

/** A "nice" axis domain that holds [lo, hi]: ends on multiples of 1, 2, 2.5 or 5 × 10^k. */
export function niceDomain(lo, hi) {
  const span = hi - lo > 0 ? hi - lo : 1;
  const raw = span / D.ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = (CONFIG.nice.mantissas.find((m) => m * p >= raw) ?? CONFIG.nice.mantissas.at(-1)) * p;
  return [roundNice(Math.floor(lo / step) * step), roundNice(Math.ceil(hi / step) * step)];
}

/** The density figure's x and y domains for one data set (every unit within `reach` SDs of its mean). */
export function densityFrame(d) {
  const lo = Math.min(...d.mean.map((m, i) => m - D.reach * d.sd[i]));
  const hi = Math.max(...d.mean.map((m, i) => m + D.reach * d.sd[i]));
  const [a, b] = niceDomain(lo - D.pad * (hi - lo), hi + D.pad * (hi - lo));
  const ymax = D.headroom * Math.max(...d.sd.map((s) => normalPdf(0) / s));
  return { x: [a, b], ymax };
}

function evenGrid(lo, hi, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(lo + ((hi - lo) * i) / (count - 1));
  return out;
}

/** Points of the normal density with mean mu and SD sd over [lo, hi] (engine normalPdf), x values in order. */
export function densityPoints(mu, sd, lo, hi) {
  const xs = [...evenGrid(lo, hi, D.base), ...evenGrid(Math.max(lo, mu - D.reach * sd), Math.min(hi, mu + D.reach * sd), D.dense), mu]
    .filter((x) => x >= lo && x <= hi)
    .sort((a, b) => a - b);
  const out = [];
  for (const x of xs) if (!out.length || x > out[out.length - 1].x) out.push({ x, y: normalPdf((x - mu) / sd) / sd });
  return out;
}

/** Peak labels that do not collide: neighbors closer than minLabelPx move apart (left one ends, right one starts). */
export function spreadLabels(labels, [lo, hi], innerWidth) {
  const out = labels.map((l) => ({ ...l, dx: 0, anchor: "middle" })).sort((a, b) => a.x - b.x);
  for (let k = 1; k < out.length; k += 1) {
    const gap = ((out[k].x - out[k - 1].x) / (hi - lo)) * innerWidth;
    if (gap < D.minLabelPx) {
      out[k - 1].dx = -D.labelDx;
      out[k - 1].anchor = "end";
      out[k].dx = D.labelDx;
      out[k].anchor = "start";
    }
  }
  return out;
}

const groupOf = (i) => LEAGUE.group[i];
const unitLabel = (d, i) => (d.data === "league" ? `${d.ids[i]}${T.groupSuffix[groupOf(i)]}` : d.ids[i]);
const nameNodeOf = (ctx) => (id) => ctx.h("span", { "data-prx-name": id, text: id });

/** The keyboard name of a matrix cell (also its tip text when focused). */
function cellTitle(d, c) {
  return c.diagonal
    ? fillText(T.tipDiagonal, { row: unitLabel(d, c.i) })
    : fillText(T.tipCell, { rowLabel: unitLabel(d, c.i), colLabel: unitLabel(d, c.j), row: d.ids[c.i], col: d.ids[c.j], pi: fmtPi(c.pi) });
}

// ---------------------------------------------------------------------------------------------- views

/** The legend's nodes (on the plot panel): the seven Blues steps, the gray diagonal and the two outlines. */
export function legendNodes(ctx) {
  const { h } = ctx;
  const cuts = CONFIG.blueCuts;
  const range = (k) => {
    if (k === 0) return [`${T.below} `, ctx.num(cuts[0], formatSetting(cuts[0]))];
    if (k === cuts.length) return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), ` ${T.andAbove}`];
    return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), "–", ctx.num(cuts[k], formatSetting(cuts[k]))];
  };
  const items = [h("span", { class: "prx-pm-legend-title", text: T.legendTitle })];
  for (let k = 0; k <= cuts.length; k += 1) {
    items.push(h("span", { class: "prx-pm-key" },
      h("span", { class: "prx-pm-swatch", style: { background: `var(--prx-blues-${k + 1})` } }), h("span", {}, ...range(k))));
  }
  items.push(h("span", { class: "prx-pm-key prx-pm-key-wide" }, h("span", { class: "prx-pm-swatch prx-pm-swatch-diagonal" }), T.legendDiagonal));
  items.push(h("span", { class: "prx-pm-key prx-pm-key-wide" },
    h("span", { class: "prx-pm-swatch prx-pm-swatch-sel" }), h("span", { class: "prx-pm-swatch prx-pm-swatch-mirror" }), T.legendOutline));
  return items;
}

/**
 * The matrix section: the matrix in its scroll box (with the scroll note), the legend, then the order note and the
 * how-to hint, so the matrix comes first; the selected cell, its mirror cell, the cell under the pointer and the
 * pointer tip are overlays placed in percent of the plot. options.onFocus(cell) is called when a keyboard cell is
 * focused (cell: { i, j, … }).
 * Returns { root, slot, draw(state, d, order, { avail, inPlace, selection, hovered }), overlays(selection, hovered),
 * syncStop(selection), cellAt(event), note(state, d), reveal(selection), scrollToSelected(), geom }.
 */
export function matrixView(ctx, { onFocus, label = CONFIG.title, generic = null } = {}) {
  // Optional arbitrary-input presentation; the original six/league law and text stay the default.
  // generic accepts caller-authored alt/orderNote/tableCaption/howTo/legendTitle and probabilityOpen(d).
  // Its keyboard selection reveals itself inside the scroll viewport without requiring a linked-panel callback.
  const custom = generic !== null;
  if (custom && (typeof generic !== "object" || Array.isArray(generic))) throw new TypeError("generic must be an options object");
  const keyboardKey = c => custom ? JSON.stringify([c.row, c.col]) : `${c.row}|${c.col}`;
  const probability = (p, options = {}) => custom ? formatProb(p, { ...options, open: typeof generic.probabilityOpen === "function" ? generic.probabilityOpen(drawnData) : Boolean(generic.probabilityOpen) }) : fmtPi(p, options);
  const customText = (name, state, d, fallback) => custom && generic[name] !== undefined ? typeof generic[name] === "function" ? generic[name](state, d) : generic[name] : fallback;
  const titleOf = (d, c) => !custom ? cellTitle(d, c) : c.diagonal ? `${d.ids[c.i]}: the same unit, not compared.` : `${d.ids[c.i]} higher priority than ${d.ids[c.j]}: probability ${probability(c.pi)}.`;
  const captionOf = (state, d) => customText("tableCaption", state, d, custom ? "Direction probabilities: row has higher priority than column; the diagonal is unused." : fillText(T.tableCaption, { order: orderWordsOf(state) }));
  const { h } = ctx;
  const nameNode = nameNodeOf(ctx);
  const orderNote = h("p", { class: "prx-pm-note", "data-prx-part": "notes" });
  const howTo = h("p", { class: "prx-hint prx-pm-howto", "data-prx-part": "notes", text: customText("howTo", null, null, custom ? "Hover, focus or tap a cell to read its probability. Arrow keys move one cell left or right and one row up or down." : T.howTo) });
  const slot = h("div", { class: "prx-pm-matrix-chart" });
  const scrollBox = h("div", { class: "prx-pm-scroll" }, slot);
  const scrollNote = h("p", { class: "prx-hint prx-pm-scroll-note", "data-prx-part": "notes", text: T.scrollNote, hidden: true });
  const legend = h("div", { class: "prx-pm-legend", "data-prx-part": "legend" }, ...legendNodes(ctx));
  const root = h("section", { class: "prx-pm-matrix", "aria-label": label }, scrollBox, scrollNote, legend, orderNote, howTo);
  if (custom) legend.firstElementChild.textContent = generic.legendTitle ?? "Pr(row has higher priority)";
  const overlay = {
    sel: h("div", { class: "prx-pm-mark prx-pm-mark-sel", "aria-hidden": "true", hidden: true }),
    mirror: h("div", { class: "prx-pm-mark prx-pm-mark-mirror", "aria-hidden": "true", hidden: true }),
    hover: h("div", { class: "prx-pm-mark prx-pm-mark-hover", "aria-hidden": "true", hidden: true }),
    tip: h("div", { class: "prx-pm-tip", "aria-hidden": "true", hidden: true }),
  };
  // the matrix as drawn last: geometry for the pointer, the overlays and the cells in display order
  let geom = null;
  let customSelection = null;
  let drawnData = null;   // the data set the matrix shows (keyboard names read it after updates in place)
  const pct = (v, total) => `${(v / total) * CONFIG.percent}%`;

  function place(node, ri, ci) {
    const g = geom;
    node.style.left = pct(g.marginLeft + ci * g.cell, g.width);
    node.style.top = pct(g.mt + ri * g.cell, g.height);
    node.style.width = pct(g.cell, g.width);
    node.style.height = pct(g.cell, g.height);
  }

  function overlays(selection, hovered) {
    const g = geom;
    if (!g || !g.area) {
      for (const n of Object.values(overlay)) n.hidden = true;
      return;
    }
    if (overlay.sel.parentNode !== g.area) g.area.append(overlay.mirror, overlay.sel, overlay.hover, overlay.tip);
    const at = (i, j) => [g.pos[i], g.pos[j]];
    if (selection) {
      place(overlay.sel, ...at(selection.i, selection.j));
      overlay.sel.hidden = false;
      if (selection.i !== selection.j) {
        place(overlay.mirror, ...at(selection.j, selection.i));
        overlay.mirror.hidden = false;
      } else overlay.mirror.hidden = true;
    } else {
      overlay.sel.hidden = true;
      overlay.mirror.hidden = true;
    }
    const hov = hovered && !(selection && hovered.i === selection.i && hovered.j === selection.j) ? hovered : null;
    if (hov) {
      place(overlay.hover, ...at(hov.i, hov.j));
      overlay.hover.hidden = false;
    } else overlay.hover.hidden = true;
    if (hovered) {
      const d = g.d;
      const [ri, ci] = at(hovered.i, hovered.j);
      const c = g.cells[ri * g.n + ci];
      overlay.tip.replaceChildren(...(c.diagonal
        ? [fillText(T.tipDiagonal, { row: d.ids[c.i] })]
        : [nameNode(d.ids[c.i]), custom ? " higher priority than " : " above ", nameNode(d.ids[c.j]), ": ", ctx.num(c.pi, probability(c.pi))]));
      const right = ci > g.n / 2;
      const low = ri > g.n / 2;
      overlay.tip.style.left = pct(g.marginLeft + (right ? ci : ci + 1) * g.cell, g.width);
      overlay.tip.style.top = pct(g.mt + (low ? ri : ri + 1) * g.cell, g.height);
      overlay.tip.style.transform = `translate(${right ? "-100%" : "0"}, ${low ? "-100%" : "0"})`;
      overlay.tip.hidden = false;
    } else overlay.tip.hidden = true;
  }

  /** The cells of the matrix in display order (row by row), for unit order `order`. */
  const cellsOf = (d, order) => {
    const cells = [];
    for (const r of order) {
      for (const c of order) cells.push({ i: r, j: c, row: d.ids[r], col: d.ids[c], diagonal: r === c, pi: r === c ? null : d.pi[r][c] });
    }
    return cells;
  };
  const valueText = (spec, pi) => probability(pi, { digits: spec.digits, bounds: "symbols" });
  const orderWordsOf = (state) => (state.sort === "label" ? T.tableOrderLabel : T.tableOrderMean);

  /** The matrix's shape at one width: cell size, frame and whether it scrolls. */
  function shapeOf(d, avail) {
    const spec = custom ? { ...GRID[d.n > 8 ? "league" : "six"], rotate: -90 } : GRID[d.data];
    const n = d.n;
    // Full caller IDs remain on both axes; any extra width scrolls inside the existing matrix region.
    let labelWidth = 0;
    if (custom) {
      const measure = typeof ctx.win.CanvasRenderingContext2D === "function" ? ctx.doc.createElement("canvas").getContext("2d") : null;
      if (measure) measure.font = `bold ${spec.labelFont}px ${ctx.win.getComputedStyle(ctx.root).fontFamily}`;
      labelWidth = Math.ceil(Math.max(...d.ids.map(id => measure ? measure.measureText(id).width : Array.from(id).length * spec.labelFont))) + GRID.labelGap * 2;
    }
    const marginLeft = Math.max(GRID.marginLeft, labelWidth);
    const marginTop = Math.max(spec.marginTop, labelWidth);
    const fitted = Math.floor((avail - marginLeft - GRID.marginRight) / n);
    const cell = Math.max(spec.minCell, Math.min(spec.maxCell, fitted));
    const width = marginLeft + GRID.marginRight + n * cell;
    const mt = marginTop;
    const height = mt + GRID.marginBottom + n * cell;
    return { spec, n, cell, width, mt, height, marginLeft, overflow: width > avail + 1 };
  }

  /** A box that scrolls sideways is a keyboard stop, named for what it holds; a box that fits is not. */
  function setScrolls(on) {
    scrollBox.classList.toggle("prx-pm-scrolls", on);
    scrollNote.hidden = !on;
    if (on && !scrollBox.hasAttribute("tabindex")) ctx.scrollRegion(scrollBox, T.scrollLabel);
    if (!on && scrollBox.hasAttribute("tabindex")) {
      for (const a of ["tabindex", "role", "aria-label"]) scrollBox.removeAttribute(a);
      scrollBox.classList.remove("prx-scroll-region");
    }
  }

  /** The one Tab stop of the keyboard grid sits on the selected cell, unless focus is already in the grid. */
  function syncStop(selection) {
    const g = geom;
    if (!g || !g.buttons?.length || !selection) return;
    const active = ctx.doc.activeElement;
    if (active && g.buttons.includes(active)) return;
    const k = g.pos[selection.i] * g.n + g.pos[selection.j];
    if (!g.buttons[k]) return;
    for (const b of g.buttons) if (b.tabIndex !== -1) b.tabIndex = -1;
    g.buttons[k].tabIndex = 0;
  }

  /**
   * Update the drawn matrix in place for a new prior SD or order: same data set, size and shape, so every node stays
   * and only its fill, value, data-num, label or name changes. The positions do not move: the cell in display row r
   * and column c is still there, it now holds another pair.
   */
  function updateInPlace(state, d, order) {
    const g = geom;
    const { n, pal, parts, spec } = g;
    const pos = [];
    order.forEach((u, k) => { pos[u] = k; });
    const ids = order.map((u) => d.ids[u]);
    for (let ri = 0; ri < n; ri += 1) {
      for (let ci = 0; ci < n; ci += 1) {
        const c = g.cells[ri * n + ci];
        c.i = order[ri]; c.j = order[ci]; c.row = ids[ri]; c.col = ids[ci];
        c.pi = c.diagonal ? null : d.pi[c.i][c.j];
      }
    }
    const rects = parts.off.g.children;
    const texts = parts.text.g.children;
    parts.off.index.forEach((m, k) => {
      const c = g.cells[g.offPos[m]];
      const f = pal.blues[blueStep(c.pi) - 1];
      if (rects[k] && rects[k].getAttribute("fill") !== f) rects[k].setAttribute("fill", f);
    });
    parts.text.index.forEach((m, k) => {
      const c = g.cells[g.offPos[m]];
      const t = texts[k];
      if (!t) return;
      const f = pal.blues[blueStep(c.pi) - 1];
      const shown = valueText(spec, c.pi);
      if (t.textContent !== shown) t.textContent = shown;
      t.setAttribute("data-num", dataNum(c.pi));
      if (t.getAttribute("stroke") !== f) { t.setAttribute("stroke", f); t.setAttribute("fill", labelOn(f, pal)); }
    });
    for (const lab of [parts.colLabels, parts.rowLabels]) {
      const nodes = lab.g.querySelectorAll("text");
      lab.index.forEach((m, k) => {
        const t = nodes[k];
        if (!t || t.textContent === ids[m]) return;
        t.textContent = ids[m];
        t.setAttribute("data-prx-name", ids[m]);
      });
    }
    g.buttons.forEach((b, k) => {
      const c = g.cells[k];
      b.setAttribute("aria-label", titleOf(d, c).replace(/\s*\n\s*/g, ", "));
      b.setAttribute("data-prx-focus-key", `${g.focusPrefix}${keyboardKey(c)}`);
    });
    const tbl = g.table;
    if (tbl) {
      const cap = tbl.querySelector("caption");
      if (cap) cap.textContent = captionOf(state, d);
      const head = tbl.querySelectorAll("thead th");
      ids.forEach((id, k) => { if (head[k + 1]) head[k + 1].textContent = id; });
      tbl.querySelectorAll("tbody tr").forEach((tr, ri) => {
        const cellsRow = tr.children;
        if (cellsRow[0]) cellsRow[0].textContent = ids[ri];
        for (let ci = 0; ci < n; ci += 1) {
          const td = cellsRow[ci + 1];
          if (!td || ri === ci) continue;
          const pi = d.pi[order[ri]][order[ci]];
          setNum(td, pi, probability(pi));
        }
      });
    }
    g.d = d;
    g.pos = pos;
  }

  function draw(state, d, order, { avail, inPlace = false, selection = customSelection, hovered = null } = {}) {
    if (custom && (!Array.isArray(d?.ids) || d.n !== d.ids.length || d.n < 1 || new Set(d.ids).size !== d.n || d.ids.some(id => typeof id !== "string" || !id) || !Array.isArray(d.pi) || d.pi.length !== d.n || d.pi.some((row, i) => !Array.isArray(row) || row.length !== d.n || row.some((p, j) => i !== j && (!Number.isFinite(p) || p < 0 || p > 1))) || order.length !== d.n || new Set(order).size !== d.n || order.some(i => !Number.isInteger(i) || i < 0 || i >= d.n))) throw new TypeError("Generic matrix requires aligned IDs, a complete probability matrix, and a permutation order");
    if (custom) {
      if (selection && (![selection.i, selection.j].every(i => Number.isInteger(i) && i >= 0 && i < d.n))) selection = null;
      customSelection = selection ? { i: selection.i, j: selection.j } : null;
    }
    drawnData = d;
    const sh = shapeOf(d, avail);
    const { spec, n, cell, width, mt, height, marginLeft } = sh;
    const key = [d.data, n, cell, width, height].join("|");
    if (inPlace && geom && geom.key === key && geom.parts) {
      updateInPlace(state, d, order);
      overlays(selection, hovered);
      syncStop(selection);
      return;
    }
    slot.style.width = `${width}px`;
    setScrolls(sh.overflow);
    const ids = order.map((u) => d.ids[u]);
    const pos = [];
    order.forEach((u, k) => { pos[u] = k; });
    const cells = cellsOf(d, order);
    const offPos = [];
    cells.forEach((x, k) => { if (!x.diagonal) offPos.push(k); });
    // the marks' groups and their index, kept for updates in place
    const parts = {};
    const keep = (name, inner) => (index, scales, values, dims, context, next) => {
      const g = inner ? inner(index, scales, values, dims, context, next) : next(index, scales, values, dims, context);
      parts[name] = { g, index: Array.from(index) };
      return g;
    };
    const tagNames = (rows) => (index, scales, values, dims, context, next) => {
      const g = next(index, scales, values, dims, context);
      const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
      Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-name", rows[i]));
      return g;
    };
    const handle = plot(slot, {
      alt: customText("alt", state, d, custom ? "Every ordered-pair direction probability: row has higher priority than column. Darker blue means a larger probability; the gray diagonal is unused." : fillText(T.matrixAlt, { size: T.sizeWords[d.data] })),
      table: {
        caption: captionOf(state, d),
        columns: [
          { label: T.colRow, value: "id", ...(custom ? { name: true } : {}) },
          ...order.map((c) => ({
            label: d.ids[c],
            value: (row) => (row.u === c ? null : d.pi[row.u][c]),
            format: (v) => (v === null ? T.sameUnit : probability(v)),
          })),
        ],
        rows: order.map((u) => ({ id: d.ids[u], u })),
      },
      width, height, aspect: false,
      marginTop: mt, marginLeft, marginRight: GRID.marginRight, marginBottom: GRID.marginBottom,
      x: { domain: ids, padding: 0, axis: null },
      y: { domain: ids, padding: 0, axis: null },
      color: { type: "identity" },
      marks: (c, P) => {
        // seven fills, so seven label inks
        const inks = new Map(c.blues.map((f) => [f, labelOn(f, c)]));
        const off = offPos.map((k) => {
          const x = cells[k];
          const f = c.blues[blueStep(x.pi) - 1];
          return { ...x, fill: f, ink: inks.get(f) };
        });
        const diag = cells.filter((x) => x.diagonal);
        return [
          P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, stroke: c.cellBorder, strokeWidth: 1, inset: GRID.inset }),
          P.cell(off, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: GRID.inset, render: keep("off") }),
          numText(off, {
            x: "col", y: "row", value: "pi", format: (v) => valueText(spec, v),
            fill: "ink", stroke: "fill", strokeWidth: GRID.halo, paintOrder: "stroke", fontSize: spec.font,
            render: keep("text"),
          }),
          P.text(ids, {
            x: (v) => v, frameAnchor: "top", dy: -GRID.labelGap, fill: c.plotFg, rotate: spec.rotate,
            ...(spec.rotate ? { textAnchor: "start", lineAnchor: "middle" } : { lineAnchor: "bottom" }),
            fontSize: spec.labelFont, fontWeight: "bold", render: keep("colLabels", tagNames(ids)),
          }),
          P.text(ids, {
            y: (v) => v, frameAnchor: "left", dx: -GRID.labelGap, textAnchor: "end", fill: c.plotFg,
            fontSize: spec.labelFont, fontWeight: "bold", render: keep("rowLabels", tagNames(ids)),
          }),
        ];
      },
      keyboard: {
        data: cells, x: "col", y: "row", key: keyboardKey, sort: false, columns: n,
        label: T.keyboardLabel,
        // the cells are updated in place, so the title reads the data set drawn last
        title: (x) => titleOf(drawnData ?? d, x),
        onFocus: (x) => {
          if (custom) {
            customSelection = { i: x.i, j: x.j };
            overlays(customSelection, null);
            reveal(customSelection);
            scrollToSelected();
          }
          onFocus?.(x);
        },
      },
    });
    const buttons = [...handle.area.querySelectorAll(".prx-kbd-point")];
    const first = buttons[0]?.getAttribute("data-prx-focus-key") ?? "";
    const focusPrefix = first.slice(0, first.length - keyboardKey(cells[0]).length);
    const complete = parts.off && parts.text && parts.colLabels && parts.rowLabels && buttons.length === cells.length;
    geom = {
      d, n, cell, mt, width, height, marginLeft, cells, offPos, pos, area: handle.area, svg: handle.svg, key, spec,
      pal: handle.palette, parts: complete ? parts : null, buttons, focusPrefix, table: handle.table?.querySelector?.("table") ?? null,
    };
    if (custom && geom.table) for (const th of [...geom.table.querySelectorAll("thead th")].slice(1)) th.setAttribute("data-prx-name", "");
    overlays(selection, hovered);
    syncStop(selection);
  }

  /** The cell under a pointer event, or null (through the svg's box and its intrinsic size). */
  function cellAt(ev) {
    const g = geom;
    if (!g || !g.svg?.getBoundingClientRect) return null;
    const r = g.svg.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    const x = (ev.clientX - r.left) * (g.width / r.width);
    const y = (ev.clientY - r.top) * (g.height / r.height);
    const ci = Math.floor((x - g.marginLeft) / g.cell);
    const ri = Math.floor((y - g.mt) / g.cell);
    if (ci < 0 || ri < 0 || ci >= g.n || ri >= g.n) return null;
    return g.cells[ri * g.n + ci];
  }

  /** The order note (one order for rows and columns; for the six sites by label, why nothing moved). */
  function note(state, d) {
    if (custom) { orderNote.replaceChildren(customText("orderNote", state, d, "Rows and columns use the same declared unit order.")); return; }
    orderNote.replaceChildren(state.sort === "label" ? T.orderLabel : T.orderMean,
      ...(d.data === "six" && state.sort === "label" ? [" ", T.sameOrder] : []));
  }

  /** Scroll the box sideways (only the box, never the page) so that the selected cell is in view. */
  function reveal(selection) {
    const g = geom;
    if (!g || !selection || !scrollBox.classList.contains("prx-pm-scrolls")) return;
    const x0 = g.marginLeft + g.pos[selection.j] * g.cell;
    const left = scrollBox.scrollLeft;
    const w = scrollBox.clientWidth;
    if (!(w > 0)) return;
    if (x0 < left || x0 + g.cell > left + w) scrollBox.scrollLeft = Math.max(0, x0 - (w - g.cell) / 2);
  }

  /** Bring the selected cell's outline into view (a keyboard move inside the scroll box). */
  const scrollToSelected = () => { if (!overlay.sel.hidden) overlay.sel.scrollIntoView?.({ block: "nearest", inline: "nearest" }); };

  return { root, slot, scrollBox, draw, overlays, syncStop, cellAt, note, reveal, scrollToSelected, get geom() { return geom; } };
}

/**
 * The pair panel: the two posteriors behind one cell (one posterior for a diagonal cell), the unit lines, the cell's
 * distance from the diagonal, the worked formula and the mirror cell. Returns { root, draw(d, order, cell,
 * { hovered, measured }), defer(redraw), cancel(), reset(), width() }; `measured` is the panel width read before a
 * render changed anything, so the render forces no layout.
 */
export function pairView(ctx) {
  const { h } = ctx;
  const nameNode = nameNodeOf(ctx);
  const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
  const heading = h("h4", { class: "prx-pm-heading", text: T.pairHeading });
  const status = h("p", { class: "prx-pm-status", "data-prx-part": "readout" });
  const units = h("div", { class: "prx-pm-units", "data-prx-part": "readout" });
  const densSlot = h("div", { class: "prx-pm-density-chart" });
  const ticksNote = h("p", { class: "prx-pm-note", "data-prx-part": "notes", text: T.ticksNote });
  const texWorked = h("div", { class: "prx-pm-tex", "data-prx-tex": "worked" });
  // the worked formula's scope and Φ in words: "Φ(z) is the area under the normal curve with mean 0 and SD 1 to the
  // left of z" (0 and 1 as data-num)
  const zName = () => h("i", { text: "z" });
  const workedNote = h("p", { class: "prx-pm-note prx-pm-worked-note" }, T.workedScope, " Φ(", zName(), T.glossPhiA,
    ctx.num(0, formatSetting(0)), T.glossPhiB, ctx.num(1, formatSetting(1)), T.glossPhiC, zName(), ".");
  const texMirror = h("div", { class: "prx-pm-tex", "data-prx-tex": "mirror" });
  const mirrorHead = h("p", { class: "prx-pm-mirror-head" });
  const mirrorNote = h("p", { class: "prx-pm-note", text: T.mirrorNote });
  const mirrorBox = h("div", { class: "prx-pm-mirror" }, mirrorHead, texMirror, mirrorNote);
  const sameNote = h("p", { class: "prx-pm-note", text: T.diagonalNote, hidden: true });
  const detail = h("div", { class: "prx-pm-detail", "data-prx-part": "readout" }, texWorked, workedNote, mirrorBox, sameNote);
  const root = h("section", { class: "prx-pm-pair", "aria-label": T.pairHeading }, heading, status, units, densSlot, ticksNote, detail);
  let stamp = null;
  let timer = 0;
  const cancel = () => {
    if (timer) ctx.win.clearTimeout(timer);
    timer = 0;
    root.removeAttribute("aria-busy");
  };
  // a keyboard move draws the panel once the keys have been quiet for CONFIG.pairDeferMs; the panel is aria-busy
  // while it waits
  const defer = (redraw) => {
    cancel();
    root.setAttribute("aria-busy", "true");
    timer = ctx.win.setTimeout(() => {
      timer = 0;
      root.removeAttribute("aria-busy");
      redraw();
    }, CONFIG.pairDeferMs);
  };
  ctx.onCleanup(() => { if (timer) ctx.win.clearTimeout(timer); timer = 0; });

  function draw(d, order, cell, { hovered = false, measured } = {}) {
    if (!cell) return;
    const densW = measured ?? densSlot.clientWidth;
    const { i, j } = cell;
    const s = `${d.data}|${d.priorSd ?? ""}|${i},${j}|${hovered ? "h" : "s"}|${order.join(",")}|${densW}`;
    if (s === stamp) return;
    stamp = s;
    const frame = densityFrame(d);
    const [lo, hi] = frame.x;
    const width = Math.max(1, Math.round(densW || root.clientWidth || ctx.width()));
    const inner = Math.max(1, width - D.marginLeft - D.marginRight);
    const digits = CONFIG.digits[d.data];
    const mean = (x) => formatDecimal(x, { digits: digits.mean });
    const sd = (x) => formatDecimal(x, { digits: digits.sd });
    const same = i === j;
    const steps = same ? null : stepsApart(order, cell);
    status.replaceChildren(`${hovered ? T.hovered : T.selected}: ${T.rowWord} `, nameNode(d.ids[i]), `, ${T.colWord} `, nameNode(d.ids[j]),
      ...(steps === null ? [] : steps === 1 ? [T.statusNext] : [", ", ctx.num(steps, formatCount(steps)), T.statusFar]), ".");
    const unitLine = (role, u, hook) => {
      const slots = {
        id: nameNode(d.ids[u]),
        mean: ro(`${hook}-mean`, d.mean[u], mean(d.mean[u])),
        sd: ro(`${hook}-sd`, d.sd[u], sd(d.sd[u])),
      };
      if (d.data === "league") {
        slots.group = T.groupWord[groupOf(u)];
        slots.obs = ctx.num(LEAGUE.size[u], formatCount(LEAGUE.size[u]));
        slots.se = ctx.num(LEAGUE.se[u], formatDecimal(LEAGUE.se[u], { digits: CONFIG.digits.league.se }));
      }
      return h("p", { class: "prx-pm-unit" }, h("span", { class: "prx-pm-role", text: `${role}. ` }),
        ...fill(d.data === "league" ? T.leagueLine : T.unitLine, slots));
    };
    units.replaceChildren(unitLine(T.rowRole, i, "row"), ...(same ? [] : [unitLine(T.colRole, j, "col")]));
    const show = same ? [i] : [i, j];
    const curves = show.map((u, k) => ({ k, pts: densityPoints(d.mean[u], d.sd[u], lo, hi) }));
    const labels = spreadLabels(show.map((u) => ({ x: d.mean[u], y: normalPdf(0) / d.sd[u], text: d.ids[u] })), frame.x, inner);
    const rug = d.ids.map((id, u) => ({ x: d.mean[u], on: show.includes(u) }));
    // the keyboard reads each posterior drawn, at its peak
    const peaks = show.map((u, k) => ({
      id: d.ids[u], m: d.mean[u], s: d.sd[u], y: normalPdf(0) / d.sd[u],
      role: k === 0 ? T.rowRole : T.colRole, line: same ? "" : k === 0 ? T.densityLine.row : T.densityLine.col,
    }));
    plot(densSlot, {
      alt: same ? fillText(T.densityAltSame, { row: d.ids[i] }) : fillText(T.densityAlt, { row: d.ids[i], col: d.ids[j] }),
      table: {
        caption: T.densityTable,
        columns: [
          { label: T.colUnit, value: "id" },
          { label: T.colMean, value: "m", format: (v) => mean(v) },
          { label: T.colSd, value: "s", format: (v) => sd(v) },
        ],
        rows: show.map((u) => ({ id: d.ids[u], m: d.mean[u], s: d.sd[u] })),
      },
      width, height: D.height, aspect: false,
      marginTop: D.marginTop, marginBottom: D.marginBottom, marginLeft: D.marginLeft, marginRight: D.marginRight,
      x: { domain: frame.x, label: T.xLabel, labelAnchor: "center", labelArrow: "none", labelOffset: D.labelOffset },
      y: { domain: [0, frame.ymax], label: T.yLabel, ticks: D.yTicks },
      color: { type: "identity" },
      marks: (c, P) => [
        P.ruleY([0], { stroke: c.plotAxis }),
        P.ruleX(rug.filter((r) => !r.on), { x: "x", y1: 0, y2: D.rug * frame.ymax, stroke: c.plotMuted, strokeWidth: D.rugWidth }),
        P.ruleX(rug.filter((r) => r.on), { x: "x", y1: 0, y2: D.rug * frame.ymax, stroke: c.post, strokeWidth: D.rugOn }),
        ...curves.map((cv) => P.lineY(cv.pts, { x: "x", y: "y", stroke: c.post, strokeWidth: D.line, strokeDasharray: cv.k === 1 ? D.dash : undefined })),
        ...labels.map((l) => P.text([l], {
          x: "x", y: "y", text: "text", dx: l.dx, dy: D.labelDy, textAnchor: l.anchor, fill: c.plotFg, fontWeight: "bold",
          stroke: c.plotBg, strokeWidth: GRID.halo, paintOrder: "stroke",
          render: (index, scales, values, dims, context, next) => {
            const g = next(index, scales, values, dims, context);
            g?.querySelector?.("text")?.setAttribute("data-prx-name", l.text);
            return g;
          },
        })),
      ],
      keyboard: {
        data: peaks, x: "m", y: "y", sort: false, label: T.densityKeyboard,
        title: (p) => fillText(T.densityPoint, { role: p.role, id: p.id, line: p.line, mean: mean(p.m), sd: sd(p.s) }),
      },
    });
    sameNote.hidden = !same;
    texWorked.hidden = same;
    workedNote.hidden = same;
    mirrorBox.hidden = same;
    if (same) return;
    // the worked formula: every number through formulaNums (data-num on each <mtext>); a unit id with digits is
    // written \mathrm{U}19 (the vendored Temml drops the last character of \mathrm{U19})
    const tid = (id) => (id.length > 1 ? id.replace(/^([A-Za-z]+)(\d+)$/, "\\mathrm{$1}$2") : id);
    const sub = (a, b) => (a.length > 1 ? `${tid(a)}\\,${tid(b)}` : `${a}${b}`);
    const f = formulaNums();
    const P = CONFIG.tex.post;
    const signed = (raw) => { const t = f.num(raw, mean(raw), P); return raw < 0 ? `\\left(${t}\\right)` : t; };
    const mA = signed(d.mean[i]);
    const mB = signed(d.mean[j]);
    const sA = f.num(d.sd[i], sd(d.sd[i]), P);
    const sB = f.num(d.sd[j], sd(d.sd[j]), P);
    // the difference of the two independent normal posteriors (engine pairDifference): its z and π = Φ(z), the
    // value of the cell (directionMatrix computes the same π)
    const diff = pairDifference(d.mean[i], d.sd[i], d.mean[j], d.sd[j]);
    const zT = f.num(diff.z, formatDecimal(diff.z, { digits: CONFIG.digits.z }));
    const p = diff.pi;
    const ps = fmtPi(p, { bounds: "symbols" });
    const pT = f.num(p, ps);
    const rel = /^[<>]/.test(ps) ? `\\;${pT}` : `= ${pT}`;
    const [a, b] = [d.ids[i], d.ids[j]];
    const tex = `\\begin{aligned}\\pi_{${sub(a, b)}} &= \\Pr(\\theta_{${tid(a)}} > \\theta_{${tid(b)}} \\mid Y) \\\\ `
      + `&= \\Phi\\left(\\frac{${mA} ${CONFIG.tex.minus} ${mB}}{\\sqrt{${sA}^{2} + ${sB}^{2}}}\\right) \\\\ `
      + `&= \\Phi(${zT}) ${rel}\\end{aligned}`;
    renderTex(texWorked, tex, { display: true, nums: f.raws });
    const g = formulaNums();
    const q = d.pi[j][i];
    const qs = fmtPi(q, { bounds: "symbols" });
    const oneT = g.num(1, "1");
    const qT = g.num(q, qs);
    const mirrorTex = `\\pi_{${sub(b, a)}} = ${oneT} - \\pi_{${sub(a, b)}} ${/^[<>]/.test(qs) ? `\\;${qT}` : `= ${qT}`}`;
    renderTex(texMirror, mirrorTex, { display: true, nums: g.raws });
    mirrorHead.replaceChildren(...fill(T.mirrorHead, { row: nameNode(a), col: nameNode(b) }));
    texWorked.querySelectorAll("mtext").forEach((n, k) => { if (k === f.raws.length - 1) n.setAttribute("data-prx-readout", "sel-pi"); });
    texMirror.querySelectorAll("mtext").forEach((n, k) => { if (k === g.raws.length - 1) n.setAttribute("data-prx-readout", "sel-pi-mirror"); });
  }

  return { root, draw, defer, cancel, reset: () => { stamp = null; }, width: () => densSlot.clientWidth };
}

/**
 * The least certain pairs (engine leastCertainPairs with the display order, leastInOrder): each pair in its more
 * likely direction, its probability and how far its cell sits from the diagonal in the order shown (the engine's
 * `apart`), with a one-line summary. Choosing a pair calls options.onPick({ i, j }). Returns { root, draw(d, order,
 * selection), mark(selection) }.
 */
export function leastView(ctx, { onPick } = {}) {
  const { h } = ctx;
  const nameNode = nameNodeOf(ctx);
  const headingId = uid("prx-pm-least");
  const heading = h("h4", { class: "prx-pm-heading", id: headingId, text: T.leastHeading });
  const lead = h("p", { class: "prx-pm-note prx-pm-least-lead", "data-prx-part": "notes" });
  const summary = h("p", { class: "prx-pm-least-summary", "data-prx-part": "readout" });
  const body = h("tbody");
  const table = h("table", { class: "prx-pm-least-table", "aria-labelledby": headingId },
    h("thead", {}, h("tr", {},
      h("th", { scope: "col", text: T.leastColPair }), h("th", { scope: "col", text: T.leastColPi }),
      h("th", { scope: "col" }, ...fill(T.leastColSteps, { one: ctx.num(1, formatCount(1)) })))),
    body);
  const root = h("section", { class: "prx-pm-least", "aria-labelledby": headingId }, heading, lead, summary, table);
  let rows = [];
  const num = (raw, display, hook) => { const n = ctx.num(raw, display); if (hook) n.setAttribute("data-prx-readout", hook); return n; };

  /** Mark the pair of the selected cell (in either orientation). */
  function mark(selection) {
    for (const r of rows) {
      const on = Boolean(selection) && ((r.i === selection.i && r.j === selection.j) || (r.i === selection.j && r.j === selection.i));
      r.tr.toggleAttribute("data-prx-selected", on);
      if (on) r.button.setAttribute("aria-current", "true");
      else r.button.removeAttribute("aria-current");
    }
  }

  function draw(d, order, selection) {
    const list = leastInOrder(d, order);
    const k = list.length;
    const steps = list.map((p) => p.apart);
    const next = steps.filter((x) => x === 1).length;
    const far = Math.max(...steps);
    lead.replaceChildren(...fill(T.leastLead, { k: num(k, formatCount(k), "least-k") }));
    const slots = { k: num(k, formatCount(k)), next: num(next, formatCount(next), "least-next"), far: num(far, formatCount(far), "least-far") };
    summary.replaceChildren(...fill(next === k ? T.leastAll : next === 0 ? T.leastNone : T.leastSome, slots));
    rows = list.map((p, r) => {
      const pi = d.pi[p.i][p.j];
      const button = h("button", {
        type: "button", class: "prx-pm-least-pick", "data-prx-focus-key": `least:${d.ids[p.i]},${d.ids[p.j]}`,
        onclick: () => onPick?.({ i: p.i, j: p.j }),
      }, nameNode(d.ids[p.i]), T.leastAbove, nameNode(d.ids[p.j]));
      const tr = h("tr", {},
        h("th", { scope: "row" }, button),
        h("td", { class: "prx-pm-least-pi" }, num(pi, fmtPi(pi), `least-list-pi-${r + 1}`)),
        h("td", { class: "prx-pm-least-steps" }, num(steps[r], formatCount(steps[r]), `least-list-steps-${r + 1}`)));
      return { i: p.i, j: p.j, tr, button };
    });
    body.replaceChildren(...rows.map((r) => r.tr));
    mark(selection);
  }

  return { root, draw, mark };
}

// ---------------------------------------------------------------------------------------------- CSS

// The views' CSS; %r stands for the root class of the app that shows them, so every selector starts with it. Legends,
// overlays and figures sit on the plot panel (--prx-plot-bg), so data colours keep their meaning in every theme.
const CSS_TEMPLATE = `
%r .prx-pm-data, %r .prx-pm-sort { display: flex; flex-wrap: wrap; column-gap: 1rem; }
%r .prx-pm-data > legend, %r .prx-pm-sort > legend { flex: 1 1 100%; }
%r .prx-pm-data > .prx-radio, %r .prx-pm-sort > .prx-radio { font-weight: 400; }
%r .prx-pm-prior-row { flex: 1 1 100%; min-width: 0; }
%r .prx-pm-sym sub { font-size: 0.75em; }
%r .prx-pm-charts { container-type: inline-size; }
%r .prx-pm-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.25rem; align-items: start; min-width: 0; }
/* six sites: matrix and pair panel side by side from 44rem (the list under the matrix); the league: one column, the
   matrix, then the pair panel at the full width, then the list */
@container (min-width: 44rem) {
  %r[data-prx-data="six"] .prx-pm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "matrix pair" "least pair"; }
  %r[data-prx-data="league"] .prx-pm-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "matrix" "pair" "least"; }
  %r .prx-pm-matrix { grid-area: matrix; }
  %r .prx-pm-pair { grid-area: pair; }
  %r .prx-pm-least { grid-area: least; }
}
%r .prx-pm-matrix, %r .prx-pm-pair, %r .prx-pm-least { min-width: 0; }
%r .prx-pm-heading { margin: 0 0 0.35rem; font-size: 0.95em; font-weight: 600; color: var(--prx-fg-heading); }
%r .prx-pm-note { margin: 0.35rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
%r .prx-pm-howto { margin: 0.25rem 0 0; }
%r .prx-pm-worked-note { margin: 0.2rem 0 0.35rem; }
%r .prx-pm-scroll { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
%r .prx-pm-scroll.prx-pm-scrolls { padding: 0 0 0.35rem; border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
%r .prx-pm-matrix-chart { max-width: none; }
%r .prx-pm-matrix-chart .prx-chart, %r .prx-pm-matrix-chart .prx-figure, %r .prx-pm-matrix-chart .prx-figure > div,
%r .prx-pm-matrix-chart .prx-chart-area, %r .prx-pm-matrix-chart .prx-chart-area > svg { max-width: none; }
%r .prx-pm-matrix-chart .prx-chart-area { cursor: pointer; }
%r .prx-kbd-tip { width: max-content; }
%r .prx-pm-scroll-note { margin: 0.35rem 0 0; }
%r .prx-pm-mark { position: absolute; box-sizing: border-box; pointer-events: none; }
%r .prx-pm-mark-sel { z-index: 1; border: 3px solid var(--prx-plot-focus); box-shadow: inset 0 0 0 2px var(--prx-plot-focus-halo); }
%r .prx-pm-mark-mirror { z-index: 1; border: 2px dashed var(--prx-plot-focus); box-shadow: inset 0 0 0 1px var(--prx-plot-focus-halo); }
%r .prx-pm-mark-hover { z-index: 1; border: 2px solid var(--prx-plot-focus); }
%r .prx-pm-tip { position: absolute; z-index: 3; max-width: min(16rem, 80%); margin: 0.25rem; padding: 0.3rem 0.5rem; font-size: 0.85em;
  color: var(--prx-plot-fg); white-space: nowrap; pointer-events: none; background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border); border-radius: var(--prx-radius); }
%r .prx-pm-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; margin: 0.5rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.85em;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border-radius: var(--prx-radius); }
%r .prx-pm-legend-title { flex: 1 1 100%; font-weight: 600; }
%r .prx-pm-key { display: inline-flex; gap: 0.35rem; align-items: center; min-width: 0; }
%r .prx-pm-key-wide { flex: 1 1 100%; }
%r .prx-pm-swatch { flex: none; display: inline-block; width: 1em; height: 1em; border: 1px solid var(--prx-cell-border); }
%r .prx-pm-swatch-diagonal { background: var(--prx-plot-grid); }
%r .prx-pm-swatch-sel { background: var(--prx-plot-bg); border: 3px solid var(--prx-plot-focus); }
%r .prx-pm-swatch-mirror { background: var(--prx-plot-bg); border: 2px dashed var(--prx-plot-focus); }
%r .prx-pm-status { margin: 0 0 0.25rem; font-weight: 600; }
%r .prx-pm-units p { margin: 0.15rem 0 0; font-size: 0.95em; }
%r .prx-pm-role { color: var(--prx-fg-muted); }
%r .prx-pm-density-chart { min-width: 0; margin: 0.5rem 0 0; }
%r .prx-pm-detail { margin: 0.5rem 0 0; padding: 0.5rem 0.75rem; background: var(--prx-bg); border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius); }
%r .prx-pm-tex { max-width: 100%; overflow-x: auto; overflow-y: hidden; overflow-wrap: normal; }
%r .prx-pm-tex math { max-width: none; }
%r .prx-pm-mirror-head { margin: 0.5rem 0 0; font-size: 0.9em; font-weight: 600; color: var(--prx-fg-muted); }
%r .prx-pm-least-lead { margin: 0 0 0.35rem; }
%r .prx-pm-least-summary { margin: 0 0 0.35rem; font-size: 0.95em; }
%r .prx-pm-least-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.9em; font-variant-numeric: tabular-nums; }
%r .prx-pm-least-table th, %r .prx-pm-least-table td { padding: 0.2rem 0.5rem; text-align: right; border-bottom: 1px solid var(--prx-border);
  overflow-wrap: normal; word-break: normal; }
%r .prx-pm-least-table thead th { font-weight: 600; vertical-align: bottom; }
%r .prx-pm-least-table th:first-child { text-align: left; }
%r .prx-pm-least-table tbody th { font-weight: 400; white-space: nowrap; }
%r .prx-pm-least-table tr[data-prx-selected] > * { background: var(--prx-bg-sunken); }
%r .prx-pm-least-pick { margin: 0; padding: 0; font: inherit; color: var(--prx-link); text-align: left; text-decoration: underline;
  text-underline-offset: 0.15em; cursor: pointer; background: none; border: 0; }
%r .prx-pm-least-pick:hover { color: var(--prx-link-hover); }
%r .prx-pm-least-pick[aria-current="true"] { font-weight: 700; }
@media (max-width: 30em) {
  %r .prx-pm-least-table th, %r .prx-pm-least-table td { padding: 0.2rem 0.3rem; }
}
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
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      sort: { type: "choice", values: CONFIG.sort.values.slice(), value: CONFIG.sort.value },
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      cell: { type: "custom", value: CONFIG.cell.auto, parse: (v) => parseCell(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
      const nameNode = nameNodeOf(ctx);
      const piName = (a, b) => h("span", { class: "prx-pm-sym" }, "π", h("sub", {}, h("span", { "data-prx-name": `${a}${b}`, text: a.length > 1 ? `${a},${b}` : `${a}${b}` })));
      const code = (text) => h("code", { text });

      // --- controls: data set, order, the league's prior SD (choosing the data set starts from its least certain pair)
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-pm-data",
        options: [{ value: "six", label: T.dataSix }, { value: "league", label: T.dataLeague }],
        value: ctx.state.data, onChange: (v) => ctx.set({ data: v, cell: CONFIG.cell.auto }),
      });
      const sortRadio = ctx.radioGroup({
        legend: T.sortLegend, name: "sort", className: "prx-pm-sort",
        options: [{ value: "mean", label: T.sortMean }, { value: "label", label: T.sortLabel }],
        value: ctx.state.sort, onChange: (v) => ctx.set({ sort: v }),
      });
      const prior = ctx.slider({
        label: T.priorLabel, ...ctx.key("priorSd"), hint: fill(T.priorHint, { app: appLink(ctx, T.priorApp) }),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      prior.root.classList.add("prx-pm-prior");
      // the slider takes a row of its own below the two choices
      const priorRow = h("div", { class: "prx-pm-prior-row" }, prior.root);
      ctx.controls.append(dataRadio.root, sortRadio.root, priorRow);
      ctx.controls.after(ctx.readout.node);

      // --- the three views: the matrix, the pair panel, the least certain pairs
      let current = null;      // { state, d, order } of the last render
      let selection = null;    // the selected cell { i, j } (from the cell key)
      let hovered = null;      // the cell under the pointer
      let rendering = false;
      // how the next cell change was asked for: a keyboard move defers the pair panel and scrolls to the cell; a pick
      // from the list reveals the cell inside the scroll box
      const NONE = Object.freeze({ defer: false, scroll: false, reveal: false });
      let pending = NONE;
      const matrix = matrixView(ctx, { onFocus: (x) => select({ i: x.i, j: x.j }, { scroll: true, defer: true }) });
      const pair = pairView(ctx);
      const least = leastView(ctx, { onPick: (c) => { hovered = null; select(c, { reveal: true }); } });
      ctx.charts.classList.add("prx-pm-charts");
      ctx.charts.append(h("div", { class: "prx-pm-grid" }, matrix.root, pair.root, least.root));

      // --- caption and notes
      const sourceNote = ctx.part("notes", h("p", { class: "prx-pm-note prx-pm-source" }));
      const packageNote = ctx.part("notes", h("p", { class: "prx-pm-note prx-pm-package" }));
      ctx.caption.after(sourceNote, packageNote);
      packageNote.replaceChildren(...fill(T.notePackage, { fn: code(T.rPlot), one: ctx.num(1, "1") }));

      const shownCell = () => hovered ?? selection;
      const drawPair = (measured) => {
        if (current) pair.draw(current.d, current.order, shownCell(), { hovered: Boolean(hovered), measured });
      };
      const deferPair = () => pair.defer(() => drawPair());

      /** Select a cell: the cell key changes, and the render moves the outlines and redraws the pair panel. */
      function select(cell, { scroll = false, defer = false, reveal = false } = {}) {
        if (!current || rendering) return;
        if (selection && selection.i === cell.i && selection.j === cell.j) {
          if (scroll) matrix.scrollToSelected();
          if (reveal) matrix.reveal(selection);
          return;
        }
        pending = { defer, scroll, reveal };
        ctx.set({ cell: cellKey(current.d, cell) });
        // the render runs inside set(); a key that did not change leaves nothing pending for a later render
        pending = NONE;
      }
      function setHover(c) {
        const next = c ? { i: c.i, j: c.j } : null;
        if ((next && hovered && next.i === hovered.i && next.j === hovered.j) || (!next && !hovered)) return;
        const width = pair.width();
        hovered = next;
        matrix.overlays(selection, hovered);
        pair.cancel();
        drawPair(width);
      }
      ctx.listen(matrix.slot, "pointermove", (ev) => { if (ev.pointerType !== "touch") setHover(matrix.cellAt(ev)); });
      ctx.listen(matrix.slot, "pointerleave", () => setHover(null));
      ctx.listen(matrix.slot, "click", (ev) => {
        const c = matrix.cellAt(ev);
        if (!c) return;
        const had = hovered;
        hovered = null;
        if (selection && c.i === selection.i && c.j === selection.j) {
          // the selected cell itself: the panel goes back from "under the pointer" to "selected"
          if (had) { const width = pair.width(); matrix.overlays(selection, null); pair.cancel(); drawPair(width); }
          return;
        }
        select(c);
      });

      function drawReadout(state, d, order) {
        // the least certain pair, the first of the engine's list, with how far its cell sits from the diagonal here
        const lc = leastInOrder(d, order)[0];
        const steps = lc.apart;
        const p = d.pi[lc.i][lc.j];
        const head = d.data === "league" ? [T.readLeague, ro("prior-sd", d.priorSd, formatSetting(d.priorSd))] : [T.readSix];
        // the last clause carries a hook of its own (data-prx-readout="least-where"), so its words can be checked
        const where = h("span", { "data-prx-readout": "least-where" },
          ...(steps === 1 ? [T.readNext] : fill(T.readFar, { steps: ro("least-steps", steps, formatCount(steps)) })));
        ctx.readout.set([
          ...head, state.sort === "label" ? T.readByLabel : T.readByMean,
          ro("pairs", d.M, formatCount(d.M)), T.readPairs,
          nameNode(d.ids[lc.i]), T.readAbove, nameNode(d.ids[lc.j]), ", ", piName(d.ids[lc.i], d.ids[lc.j]), " = ",
          ro("least-pi", p, fmtPi(p)), "; ", where, ".",
        ]);
      }

      function drawNotes(d) {
        // the league's posterior is set by hand for teaching; the six sites' posteriors come with the package's
        // tutorial data
        if (d.data === "league") ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));
        else ctx.caption.replaceChildren();
        if (d.data === "six") {
          sourceNote.replaceChildren(...fill(T.noteSix, {
            data: code(T.rData), score: code(T.rScore),
            sd: ctx.num(d.sd[0], formatDecimal(d.sd[0], { digits: CONFIG.digits.six.sd })),
          }));
        } else {
          sourceNote.replaceChildren(...fill(T.noteLeague, {
            n: ctx.num(d.n, formatCount(d.n)),
            seed: ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
            zero: ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })),
            prior: ctx.num(d.priorSd, formatSetting(d.priorSd)),
          }));
        }
      }

      return {
        render(state, info) {
          ctx.root.setAttribute("aria-busy", "true");
          rendering = true;
          const how = pending;
          pending = NONE;
          try {
            const changed = info?.changed ?? [];
            dataRadio.set(state.data);
            sortRadio.set(state.sort);
            prior.set(state.priorSd);
            // the prior SD acts only on the league: its slider is in the controls only while the league is shown
            if (state.data === "league" && priorRow.parentNode !== ctx.controls) sortRadio.root.after(priorRow);
            if (state.data !== "league" && priorRow.parentNode) priorRow.remove();
            ctx.root.setAttribute("data-prx-data", state.data);
            const d = dataset(state.data, state.priorSd);
            if (changed.includes("data") && !info?.initial) hovered = null;
            selection = resolveCell(d, state.cell);
            if (hovered && (hovered.i >= d.n || hovered.j >= d.n)) hovered = null;
            const order = orderOf(d, state.sort);
            const later = Boolean(current && current.d.data === d.data && !info?.initial && changed.length);
            // only the cell: move the outlines, mark the list, redraw the pair panel (later, after a keyboard move)
            if (later && changed.every((k) => k === "cell")) {
              const width = how.defer ? undefined : pair.width();
              current = { state, d, order };
              matrix.overlays(selection, hovered);
              matrix.syncStop(selection);
              least.mark(selection);
              if (how.defer) deferPair();
              else { pair.cancel(); drawPair(width); }
              if (how.scroll) matrix.scrollToSelected();
              if (how.reveal) matrix.reveal(selection);
              return;
            }
            // a change of the prior SD, the order or the cell keeps the matrix's shape: its cells are updated in place.
            // Both widths are read before the figures are written, and the pair panel is drawn before the matrix,
            // while the styles it reads are still clean: nothing after the matrix's writes reads layout back, so no
            // render forces a layout of a newly drawn matrix
            const inPlace = later && changed.every((k) => CONFIG.inPlaceKeys.includes(k));
            const avail = Math.max(1, Math.round(matrix.root.clientWidth || ctx.width()));
            const densW = pair.width();
            current = { state, d, order };
            pair.cancel();
            pair.reset();
            drawPair(densW);
            matrix.draw(state, d, order, { avail, inPlace, selection, hovered });
            drawReadout(state, d, order);
            least.draw(d, order, selection);
            matrix.note(state, d);
            drawNotes(d);
            if (how.reveal) matrix.reveal(selection);
            // a matrix drawn anew in a box that scrolls sideways (the league on a narrow screen) brings the selected
            // cell into view inside its box, after this render (so the render reads no layout back)
            else if (!inPlace) ctx.timeout(() => matrix.reveal(selection), 0);
          } finally {
            rendering = false;
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
