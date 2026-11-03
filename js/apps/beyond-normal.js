// beyond-normal (app 1.10): "Same means, different directions". For jointly normal posteriors the larger mean is always
// the more likely direction (apps 1.8 and 1.9). Without the normal shape the means no longer settle the direction, and
// without independence even the two posteriors taken one at a time do not give π_AB. Two panels, side by side:
//   joint law  two units whose true values are each 0, 1 or 2, and the posterior of the pair (A, B), its joint law, as
//              a 3 x 3 table. Law 1 and law 2 (after the postrank theory book, ch. 9, Fig. f09b) give each unit the
//              same posterior (every row and column total is 1/3), yet π_AB is 1/3 under law 1 and 2/3 under law 2.
//              A "Joint law" row of buttons (Law 1, Law 2, Independent, Always equal) sets only the table; the table
//              is an editor: each cell counts the law's equally probable pairs with those two values (0 to 9, a
//              base.js numberInput named "Count of pairs with A = a and B = b" and described by its cell's
//              probability), so a cell's probability is its count over the total. The cells (engine finiteLawCells),
//              the totals (finiteLawMargins), both direction probabilities and the probability of a tie
//              (finiteLawPairwise), π_AB + π_BA (tieLawPairwise) and both posterior means (rankSummaries) follow the
//              counts; the totals line keeps law 1's and law 2's π_AB on screen beside the law shown. The independence
//              law (all nine pairs once) and the always-equal law (the diagonal) keep the same totals: ties make
//              π_AB + π_BA fall below 1, so tie-freeness is an assumption about the joint law, not about the margins.
//   two bumps  another pair of units: A's posterior is a mixture of two normal bumps (weight w near 1.00, else near
//              −.10, SD .10 each), B's is normal with mean 0 and SD .10. A small bump far above B pulls A's mean up but
//              adds little to π_AB (engine mixturePairDirection for the whole posterior, pairDirection per bump,
//              rankSummaries of the bump centers for A's mean): for w from .10 to .30 the mean and π_AB point to
//              different units. Dotted rules mark both posterior means.
// Each panel's text on how to read it sits under its table or figure. A line under the preset row says that a preset
// sets both panels, while the panels' own controls change only their panel.
// Starting point: postrank Explorer v1 L-07 (js/widgets/two-units.js), its Deeper boxes 2 and 3, shown at once and
// without the boxes. The shared parts come from app 1.8 (js/apps/two-units.js): its CSS (the panel grid, the symbol
// names), the density grid, the axis domain, the line styles and the figure frame.
//
// Keys: cells (nine digits 0–9, rows A = 0, 1, 2 and columns B = 0, 1, 2; at least one nonzero; commas are allowed in
// a URL: cells=0,1,0,0,0,1,1,0,0) and mixW (the weight of A's upper bump, .05 to .95).
import { createWidget, uid } from "../shared/base.js";
import { hiddenTable, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatProb, formatRational, formatSetting, setNum } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  finiteLawCells, finiteLawMargins, finiteLawPairwise, mixturePairDirection, normalPdf, pairDirection, rankSummaries, tieLawPairwise,
} from "../pr-core.js";
import { CONFIG as TU, CSS as TU_CSS, densityPoints, paddedDomain, piName, plotWidth, symName } from "./two-units.js";

export const CONFIG = Object.freeze({
  name: "beyond-normal",
  label: "Same means, different directions: two joint laws with the same margins, and a posterior with two bumps",
  className: "prx-bn",
  units: TU.units,
  // the joint laws: each true value is one of `values`; a law is nine counts of equally probable pairs, row-major
  // (rows: A's value; columns: B's value), each count 0 to maxCount
  values: Object.freeze([0, 1, 2]),
  maxCount: 9,
  // the named laws, in preset order: law 1 and law 2 of the theory book (ch. 9), the independence law (every pair
  // once) and the always-equal law (the diagonal); all four put 1/3 on each value of each unit
  // (label: its button in the panel's "Joint law" row, which sets only the cells key)
  laws: Object.freeze([
    Object.freeze({ id: "law1", cells: "010001100", name: "law 1", title: "Law 1", label: "Law 1" }),
    Object.freeze({ id: "law2", cells: "001100010", name: "law 2", title: "Law 2", label: "Law 2" }),
    Object.freeze({ id: "independent", cells: "111111111", name: "the independence law", title: "The independence law", label: "Independent" }),
    Object.freeze({ id: "equal", cells: "100010001", name: "the always-equal law", title: "The always-equal law", label: "Always equal" }),
  ]),
  // margins and π are compared with this tolerance (they are exact counts over the total)
  tol: 1e-12,
  // A's posterior: a lower bump (center lo) and an upper bump (center hi, weight w), each normal with SD sd; B's
  // posterior: normal with mean meanB and SD sdB, independent of A's
  mix: Object.freeze({ min: 0.05, max: 0.95, step: 0.05, value: 0.2, lo: -0.1, hi: 1, sd: 0.1, meanB: 0, sdB: 0.1 }),
  // the side of one half on which π_AB lies says which unit is more probably the higher
  half: 0.5,
  digits: Object.freeze({ center: 2, mean: 3, lawMean: 2 }),
  chart: Object.freeze({
    height: 170, thin: 1.5, rule: "1,3",
    // A's mean is labeled at meanTop of the height, meanDx px beside its rule; when a curve, a peak label or B's rule
    // is in the way there (on either side), the label sits above the plot area, topDy px above it, beside its rule on
    // the side away from B's mean. B's mean (a rule too) is labeled above the plot area, beside its rule on the side
    // away from A's mean, so the two labels never meet
    meanTop: 0.7, meanDx: 4, topDy: -12,
    // label boxes in px at the 12 px figure font, with room around them, and the samples taken of a curve across a box
    peakBox: Object.freeze({ width: 9, height: 13 }),
    meanBox: Object.freeze({ width: 52, height: 13 }),
    pad: 2, samples: 8, steps: 3,
  }),
  text: Object.freeze({
    // --- the joint law
    jointTitle: "The same two posteriors, two different answers",
    lawPick: "Joint law",
    presetNote: "A preset sets both panels; the Joint law buttons, the count boxes and the weight slider each change only their own panel.",
    jointIntro: Object.freeze([
      "Here each true value is one of ", "{v0}", ", ", "{v1}", " or ", "{v2}",
      ", and the posterior of the pair (A, B), called the joint law, lists equally probable pairs. Each box counts the pairs with those two values (",
      "{min}", " to ", "{max}", "), so a cell's probability is its count over the total; each unit's own posterior is a row or column total.",
    ]),
    lawRegion: "The joint law: the probability of each pair of true values, with a box for its count",
    caption: ": the probability of each pair of true values (rows: A's true value; columns: B's true value)",
    rowHead: "A = ",
    colHead: "B = ",
    total: "Total",
    aboveNote: " (A above B)",
    tieNote: " (A equals B)",
    countA: "Count of pairs with A = ",
    countB: " and B = ",
    thisLaw: "this law",
    thisLawTitle: "This law",
    key: Object.freeze(["Blue cells: A's true value is larger than B's, and ", "{piAB}", " is the total of their probabilities. A cell with count ", "{zero}", " has probability zero."]),
    tieKey: Object.freeze(["Cells with a dashed outline: the two true values are equal, and ", "{t}", " is the total of their probabilities."]),
    resultA: "Under ",
    resultB: ", ",
    resultC: " = ",
    resultD: " and ",
    moreB: ", so B is more probably the higher unit.",
    moreA: ", so A is more probably the higher unit.",
    neither: ": neither unit is more probably the higher.",
    sameMargins: Object.freeze(["The totals, each unit's own posterior, put ", "{third}", " on each value, as under ", "{law1}", " and ", "{law2}",
      ": A and B have the same posterior mean, ", "{mean}", "."]),
    // law 1's and law 2's π_AB stay on screen beside the law shown, for every law the table holds
    sameLaw1: Object.freeze([" With the same totals, ", "{law2}", " gives ", "{piAB}", " = ", "{pi2}", "."]),
    sameLaw2: Object.freeze([" With the same totals, ", "{law1}", " gives ", "{piAB}", " = ", "{pi1}", "."]),
    sameOther: Object.freeze([" With the same totals, ", "{law1}", " gives ", "{piAB}", " = ", "{pi1}", " and ", "{law2}", " gives ", "{pi2}", "."]),
    otherMargins: Object.freeze(["The totals, each unit's own posterior, differ from those of ", "{law1}", " and ", "{law2}", " (", "{third}",
      " on each value, with ", "{piAB}", " = ", "{pi1}", " and ", "{pi2}", "): the posterior means are ", "{meanA}", " for A and ", "{meanB}", " for B."]),
    noTie: Object.freeze(["The two true values are never equal here (", "{t}", "), so ", "{piAB}", " + ", "{piBA}", " = ", "{d}", "."]),
    tie: Object.freeze(["The two true values are equal with probability ", "{t}", ", so ", "{piAB}", " + ", "{piBA}", " = ", "{d}", ", not ", "{one}",
      ". Tie-freeness (that the two true values are never exactly equal) is an assumption about the joint law: even continuous margins (each unit's own posterior) allow ",
      "{thA}", " = ", "{thB}", "."]),
    // --- the two-bump posterior
    mixTitle: "A posterior with two bumps",
    mixIntro: Object.freeze([
      "Another pair of units. Unit A's posterior has two bumps: with probability w its true value lies near ", "{hi}",
      ", far above B's; otherwise it lies near ", "{lo}", ", just below B's. Each bump is normal with SD ", "{sd}",
      ". Unit B's posterior is normal with mean ", "{meanB}", " and SD ", "{sdB}", ", independent of A's.",
    ]),
    mixSlider: "Weight w of A's upper bump",
    mixSliderName: "Weight of the upper bump of unit A's posterior",
    xLabel: "True value",
    meanLabel: "A's mean",
    meanLabelB: "B's mean",
    alt: "Posterior density of unit A, a mixture of two normal bumps (solid line), and of unit B (dashed line), with dotted vertical lines at A's and B's posterior means.",
    table: "Unit A's posterior bump by bump, and as a whole",
    colPart: "Part of A's posterior",
    colWeight: "Weight",
    colCenter: "Center (mean)",
    colPi: "Chance that A is above B",
    rowLower: "Lower bump",
    rowUpper: "Upper bump",
    rowWhole: "Whole posterior (weighted average)",
    mixResultA: "A's posterior mean, ",
    above: ", is above B's mean, ",
    below: ", is below B's mean, ",
    equals: ", equals B's mean, ",
    mixResultB: ", ",
    yet: "yet ",
    and: "and ",
    flipB: ": B's true value is more probably the larger.",
    flipA: ": A's true value is more probably the larger.",
    agrees: " agrees.",
    stop: ".",
    mixExplain: Object.freeze([
      "A small bump far above B pulls A's mean up but adds little to ", "{piAB}", ": the mean averages the two centers, while ", "{piAB}",
      " averages the bumps' chances (last column), so the upper bump adds at most w. On the slider, A's mean and ", "{piAB}",
      " point to different units for w from ", "{from}", " to ", "{to}", ".",
    ]),
    kbLabel: "The two posteriors: the arrow keys read A's two bumps, B's posterior and mean, and A's mean.",
    kbLower: "A's lower bump: center ",
    kbUpper: "A's upper bump: center ",
    kbWeight: ", weight ",
    kbWithin: "; within it, the chance that A is above B is ",
    kbB: "Unit B: posterior mean ",
    kbSd: ", posterior SD ",
    kbMean: "A's posterior mean: ",
    kbMeanAbove: ", above B's mean, ",
    kbMeanBelow: ", below B's mean, ",
    kbMeanEqual: ", equal to B's mean, ",
    kbMeanPi: "; the probability that A's true value is larger than B's is ",
    // --- the read-out
    gives: " gives ",
    liveTie: ", and A equals B with probability ",
    liveMixA: ". With two bumps, w = ",
    liveMixB: " gives A a posterior mean of ",
    liveMixC: " against B's ",
    liveMixD: ", and ",
  }),
});

const T = CONFIG.text;
const M = CONFIG.mix;
const K = CONFIG.chart;
const C = TU.chart;
const G = TU.grid;
const V = CONFIG.values;
const NCELLS = V.length * V.length;

export const CSS = `
.prx-bn .prx-two-units-panels { align-items: start; gap: 1rem 1.75rem; }
.prx-bn .prx-bn-panel { min-width: 0; }
.prx-bn .prx-bn-preset-note { flex: 1 1 100%; margin: -0.2rem 0 0; font-size: 0.92em; color: var(--prx-fg-muted); }
.prx-bn .prx-bn-law { margin: 0 0 0.5rem; font-size: 0.875rem; }
.prx-bn .prx-two-units-law + .prx-bn-text { margin: 0.4rem 0 0; font-size: 0.92em; }
.prx-bn .prx-bn-figure + .prx-bn-text { margin: 0.35rem 0 0.5rem; font-size: 0.92em; }
.prx-bn .prx-bn-title.prx-panel-title { margin: 0 0 0.3rem; font-size: 0.95em; color: var(--prx-fg-heading); }
.prx-bn .prx-bn-text { margin: 0 0 0.5rem; }
.prx-bn .prx-bn-slider { display: flex; margin: 0.25rem 0 0.4rem; }
.prx-bn .prx-bn-slider > .prx-slider { flex: 1 1 auto; max-width: 24rem; }
.prx-bn .prx-two-units-law { max-width: 100%; overflow-x: auto; }
.prx-bn .prx-two-units-law table { margin: 0; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.prx-bn .prx-two-units-law caption { caption-side: top; padding: 0 0 0.35rem; font-size: 0.9em; text-align: left; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-law th, .prx-bn .prx-two-units-law td { min-width: 3.25em; height: 2.5em; padding: 0.2rem 0.45rem; text-align: center;
  vertical-align: middle; color: var(--prx-plot-fg); background: var(--prx-plot-bg); border: 1px solid var(--prx-plot-grid); }
.prx-bn .prx-two-units-law th { font-weight: 600; white-space: nowrap; }
.prx-bn .prx-two-units-law .prx-two-units-corner { border: 0; background: transparent; }
.prx-bn .prx-two-units-law .prx-two-units-above { background: var(--prx-blues-3); color: var(--prx-label-dark);
  box-shadow: inset 0 0 0 1px var(--prx-cell-border); }
.prx-bn .prx-two-units-law .prx-bn-tie { outline: 1px dashed var(--prx-cell-border); outline-offset: -4px; }
.prx-bn .prx-two-units-law .prx-two-units-total { font-weight: 600; background: var(--prx-plot-grid); color: var(--prx-label-dark); }
.prx-bn .prx-bn-p { display: block; min-height: 1.35em; line-height: 1.35; font-weight: 600; }
.prx-bn .prx-two-units-law input.prx-bn-count { display: block; width: 3.4em; min-height: 1.75rem; margin: 0.1rem auto 0.05rem;
  padding: 0.05rem 0.2rem; text-align: center; color: var(--prx-plot-fg); background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border); border-radius: 4px; }
.prx-bn .prx-two-units-law input.prx-bn-count:focus-visible { outline: 2px solid var(--prx-plot-focus); outline-offset: 1px;
  box-shadow: 0 0 0 3px var(--prx-plot-focus-halo); }
.prx-bn .prx-two-units-key { display: flex; gap: 0.5rem; align-items: center; margin: 0.4rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-swatch { flex: none; width: 1.1em; height: 1.1em; background: var(--prx-blues-3); border: 1px solid var(--prx-cell-border); }
.prx-bn .prx-two-units-swatch.prx-bn-swatch-tie { background: var(--prx-plot-bg); border-style: dashed; }
.prx-bn .prx-two-units-result { margin: 0.5rem 0 0; padding: 0.4rem 0.75rem; background: var(--prx-bg-sunken); border-radius: var(--prx-radius);
  font-variant-numeric: tabular-nums; }
.prx-bn .prx-two-units-result > p { margin: 0; }
.prx-bn .prx-two-units-result > p + p { margin-top: 0.3rem; }
.prx-bn .prx-bn-figure { margin: 0.25rem 0 0; }
.prx-bn .prx-two-units-mixtable .prx-data-table table { margin: 0.5rem 0 0; }
.prx-bn .prx-two-units-mixtable caption { caption-side: top; padding: 0 0 0.35rem; font-size: 0.9em; text-align: left; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-mixtable th, .prx-bn .prx-two-units-mixtable td { vertical-align: top; overflow-wrap: normal; word-break: normal; }
.prx-bn .prx-two-units-mixtable tbody tr:last-child > * { font-weight: 600; border-top: 2px solid var(--prx-border-strong); }
.prx-bn .prx-bn-explain { margin: 0.5rem 0 0; }
@media (max-width: 30em) {
  .prx-bn .prx-two-units-law th, .prx-bn .prx-two-units-law td { min-width: 2.9em; padding: 0.2rem 0.3rem; }
  .prx-bn .prx-two-units-mixtable table { font-size: 0.9em; }
  .prx-bn .prx-two-units-mixtable th, .prx-bn .prx-two-units-mixtable td { padding: 0.2rem 0.3rem; }
}
`;

// ---------------------------------------------------------------------------------------------- the joint law

/**
 * The cells key: nine digits 0–9 (rows A = 0, 1, 2; columns B = 0, 1, 2), at least one of them nonzero. Takes a
 * string ("010001100", or with commas or spaces between the digits), a number (leading zeros restored) or an array of
 * nine integers; returns the nine-digit string, or undefined when the value is not a law.
 */
export function parseCells(v) {
  let digits = null;
  if (Array.isArray(v) || ArrayBuffer.isView(v)) digits = Array.from(v, Number);
  else if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) digits = [...String(v).padStart(NCELLS, "0")].map(Number);
  else if (typeof v === "string") {
    const s = v.replace(/[\s,;]/g, "");
    if (/^\d+$/.test(s)) digits = [...s].map(Number);
  }
  if (!digits || digits.length !== NCELLS) return undefined;
  if (!digits.every((d) => Number.isInteger(d) && d >= 0 && d <= CONFIG.maxCount)) return undefined;
  if (!digits.some((d) => d > 0)) return undefined;
  return digits.join("");
}

/** The named law with these cells, or null. */
export const namedLaw = (cells) => CONFIG.laws.find((l) => l.cells === cells) ?? null;

/** The law's equally probable pairs [a, b], one per count, in row-major cell order. */
export function lawPairs(cells) {
  const pairs = [];
  V.forEach((a, i) => V.forEach((b, j) => {
    for (let k = 0; k < Number(cells[i * V.length + j]); k += 1) pairs.push([a, b]);
  }));
  return pairs;
}

/**
 * Everything the joint-law panel shows for a law (its nine-digit cells). The engine computes from the law's equally
 * probable pairs (probabilities null: each pair has weight one over their number): the probability of each cell of
 * the table, the joint law of (θ_A, θ_B) (finiteLawCells), π_AB, π_BA and the tie probability t (finiteLawPairwise),
 * π_AB + π_BA = 1 − t (tieLawPairwise d), both margins (finiteLawMargins) and both posterior means (rankSummaries).
 */
export function jointCompute(cells) {
  const counts = [...cells].map(Number);
  const pairs = lawPairs(cells);
  const states = pairs.map(([a, b]) => [[a], [b]]);
  const ids = [...CONFIG.units];
  const pw = finiteLawPairwise(states, null, { ids });
  const tie = tieLawPairwise(states, null, { ids });
  const margins = finiteLawMargins(states, null).margins;
  const joint = finiteLawCells(states, null, { i: 0, j: 1 });
  const means = rankSummaries({ states: pairs, probs: null }).means;
  const marginOf = (m) => V.map((v) => { const at = m.values.indexOf(v); return at < 0 ? 0 : m.probs[at]; });
  // the table's cell (a, b): the joint law's cell with those values (a value that no pair takes has no row or column)
  const cellOf = (a, b) => {
    const r = joint.rowValues.indexOf(a);
    const c = joint.colValues.indexOf(b);
    return r < 0 || c < 0 ? 0 : joint.cells[r][c];
  };
  return {
    cells, counts,
    p: V.flatMap((a) => V.map((b) => cellOf(a, b))),
    piAB: pw.pi[0][0][1], piBA: pw.pi[0][1][0], t: pw.t[0][0][1], d: tie.d[0][0][1],
    marginA: marginOf(margins[0][0]), marginB: marginOf(margins[1][0]),
    meanA: means[0], meanB: means[1],
  };
}

const LAW1 = jointCompute(CONFIG.laws[0].cells);
const LAW2 = jointCompute(CONFIG.laws[1].cells);

/** True when the law's margins equal law 1's (1/3 on each value, for both units). */
export const sameMarginsAsLaw1 = (j) => [...j.marginA, ...j.marginB].every((p, i) => Math.abs(p - [...LAW1.marginA, ...LAW1.marginB][i]) <= CONFIG.tol);

// ---------------------------------------------------------------------------------------------- the two bumps

/** The density of A's two-bump posterior at x (engine normalPdf). */
export function mixDensity(x, w) {
  return ((1 - w) * normalPdf((x - M.lo) / M.sd) + w * normalPdf((x - M.hi) / M.sd)) / M.sd;
}

/**
 * The two-bump posterior at weight w of A's upper bump: per-bump π (engine pairDirection), the whole π (engine
 * mixturePairDirection) and A's posterior mean, the mean of the finite law of the bump centers (engine rankSummaries).
 */
export function mixCompute(w) {
  const lower = 1 - w;
  const comp = (weight, center) => ({ w: weight, meanA: center, sdA: M.sd, meanB: M.meanB, sdB: M.sdB, corr: 0 });
  return {
    w, lower,
    meanA: rankSummaries({ states: [[M.lo], [M.hi]], probs: [lower, w] }).means[0],
    piLower: pairDirection(M.lo, M.sd, M.meanB, M.sdB),
    piUpper: pairDirection(M.hi, M.sd, M.meanB, M.sdB),
    pi: mixturePairDirection([comp(lower, M.lo), comp(w, M.hi)]),
  };
}

/** What A's mean and π_AB each say (+1: A higher, −1: B higher, 0: neither) and whether they point to different units. */
export function mixVerdict(m) {
  const meansSay = Math.sign(m.meanA - M.meanB);
  const piSays = Math.sign(m.pi - CONFIG.half);
  return { meansSay, piSays, flip: meansSay !== 0 && piSays !== 0 && meansSay !== piSays };
}

/** The weights on the slider grid at which A's mean and π_AB point to different units: { from, to, all }. */
export function flipRange() {
  const n = Math.round((M.max - M.min) / M.step);
  const all = [];
  for (let k = 0; k <= n; k += 1) {
    const w = Number((M.min + k * M.step).toFixed(2));
    if (mixVerdict(mixCompute(w)).flip) all.push(w);
  }
  return { from: all[0] ?? null, to: all.at(-1) ?? null, all };
}

/** The fixed axes of the figure: both bumps' and B's densities within 4 SDs (padded, nice), and 1.15 × the highest peak. */
const MIX_DOMAIN = paddedDomain(Math.min(M.lo - G.reach * M.sd, M.meanB - G.reach * M.sdB), Math.max(M.hi + G.reach * M.sd, M.meanB + G.reach * M.sdB));
const MIX_YMAX = G.headroom * Math.max(normalPdf(0) / M.sdB, normalPdf(0) / M.sd);

/** Pixel geometry of the figure (chart.js frame) for a width. */
function geometry(width) {
  const [lo, hi] = MIX_DOMAIN;
  const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
  const innerH = Math.max(1, K.height - C.marginTop - C.marginBottom);
  return {
    width, lo, hi, innerW,
    px: (x) => C.marginLeft + ((x - lo) / (hi - lo)) * innerW,
    py: (y) => C.marginTop + (1 - y / MIX_YMAX) * innerH,
    xOf: (X) => lo + ((X - C.marginLeft) / innerW) * (hi - lo),
  };
}

/** The pixel box of a text label at data (x, y) with dx, dy, anchor, of a box size { width, height }. */
function labelBox(d, size, g) {
  const X = g.px(d.x) + (d.dx ?? 0);
  const left = d.anchor === "middle" ? X - size.width / 2 : d.anchor === "end" ? X - size.width : X;
  const mid = g.py(d.y) + (d.dy ?? 0);
  return { left: left - K.pad, right: left + size.width + K.pad, top: mid - size.height / 2 - K.pad, bottom: mid + size.height / 2 + K.pad };
}

/** True when the curve f (a density of x) runs through a pixel box: its heights across the box meet the box's span. */
function curveHits(f, box, g) {
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k <= K.samples; k += 1) {
    const X = box.left + ((box.right - box.left) * k) / K.samples;
    const Y = g.py(Math.min(MIX_YMAX, f(g.xOf(X))));
    min = Math.min(min, Y);
    max = Math.max(max, Y);
  }
  return min <= box.bottom && max >= box.top;
}

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The figure's labels for a mixCompute() result m in a figure of the given width: bold "A" at the heavier bump's peak
 * and "B" at B's peak, 9 px above; peaks within 12% of the x span push the labels 9 px apart (A to the left, B to the
 * right). A label that the other curve runs through, that touches a rule (A's mean, B's mean) or the other label,
 * moves: above its peak, to the other side, then further out, 9 px at a time. "A's mean" sits at 70% of the height,
 * 4 px beside its rule, on the side away from B's mean (or away from A's peak label when that is close); when a curve,
 * a peak label or B's rule is in the way there, on the other side; else above the plot area, beside its rule on the
 * side away from B's mean. "B's mean" sits above the plot area, beside its rule on the side away from A's mean.
 */
export function mixLabels(m, width) {
  const g = geometry(width);
  const fA = (x) => mixDensity(x, m.w);
  const fB = (x) => normalPdf((x - M.meanB) / M.sdB) / M.sdB;
  const span = g.hi - g.lo;
  const peakA = m.lower >= m.w ? { x: M.lo, y: mixDensity(M.lo, m.w) } : { x: M.hi, y: mixDensity(M.hi, m.w) };
  const peakB = { x: M.meanB, y: normalPdf(0) / M.sdB };
  const close = Math.abs(peakA.x - peakB.x) < C.overlap * span;
  const ruleX = g.px(m.meanA);
  const ruleB = g.px(M.meanB);
  const crosses = (box, X) => box.left <= X + 1 && box.right >= X - 1;
  const beside = (side, step) => ({ dx: side * step * C.labelDx, anchor: side < 0 ? "end" : "start" });
  const middle = { dx: 0, anchor: "middle" };
  const place = (peak, text, side, other, taken) => {
    const tries = close
      ? [beside(side, 1), middle, beside(-side, 1), ...Array.from({ length: K.steps }, (_, k) => [beside(side, k + 2), beside(-side, k + 2)]).flat()]
      : [middle, beside(side, 1), beside(-side, 1), ...Array.from({ length: K.steps }, (_, k) => [beside(side, k + 2), beside(-side, k + 2)]).flat()];
    const labels = tries.map((t) => ({ ...peak, text, dy: C.labelDy, ...t }));
    const ok = (d) => {
      const box = labelBox(d, K.peakBox, g);
      if (box.left < 0 || box.right > g.width) return false;
      if (crosses(box, ruleX) || crosses(box, ruleB)) return false;
      if (curveHits(other, box, g)) return false;
      return !taken.some((b) => overlaps(b, box));
    };
    return labels.find(ok) ?? labels[0];
  };
  const sideA = peakA.x <= peakB.x ? -1 : 1;
  const labelA = place(peakA, CONFIG.units[0], sideA, fB, []);
  const labelB = place(peakB, CONFIG.units[1], -sideA, fA, [labelBox(labelA, K.peakBox, g)]);
  const peakBoxes = [labelA, labelB].map((d) => labelBox(d, K.peakBox, g));
  // A's mean: the side away from B's mean (or from A's label) first, then the other side, then above the plot area
  const away = m.meanA >= M.meanB ? 1 : -1;
  const nearPeak = Math.abs(peakA.x - m.meanA) < C.overlap * span && Math.sign(peakA.x - m.meanA) === away;
  const first = nearPeak ? -away : away;
  const at = (side) => ({ x: m.meanA, y: K.meanTop * MIX_YMAX, text: T.meanLabel, dx: side * K.meanDx, dy: 0, anchor: side > 0 ? "start" : "end" });
  const clear = (d) => {
    const box = labelBox(d, K.meanBox, g);
    if (box.left < 0 || box.right > g.width) return false;
    if (crosses(box, ruleB)) return false;
    if (curveHits(fA, box, g) || curveHits(fB, box, g)) return false;
    return !peakBoxes.some((p) => overlaps(p, box));
  };
  // above the plot area each mean's label sits on its own side of the two rules, so the two never meet
  const top = (x, text, side) => ({ x, y: MIX_YMAX, text, dx: side * K.meanDx, dy: K.topDy, anchor: side > 0 ? "start" : "end" });
  const mean = [at(first), at(-first)].find(clear) ?? top(m.meanA, T.meanLabel, away);
  const meanB = top(M.meanB, T.meanLabelB, -away);
  return { peaks: [labelA, labelB], mean, meanB, peakA, peakB };
}

// ---------------------------------------------------------------------------------------------- the app

/** Parts with {slot} entries filled by slot functions (each returns a node). */
const fill = (parts, slot) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slot[m[1]]() : p; });
const frac = (x) => formatRational(x);
const fmtCenter = (x) => formatDecimal(x, { digits: CONFIG.digits.center });
const fmtMean = (x) => formatDecimal(x, { digits: CONFIG.digits.mean });
const fmtLawMean = (x) => formatDecimal(x, { digits: CONFIG.digits.lawMean });

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: `${CONFIG.className} ${TU.className}`,
    css: `${TU_CSS}${CSS}`,
    keys: {
      cells: { type: "custom", value: CONFIG.laws[0].cells, parse: (v) => parseCells(v) },
      mixW: { type: "number", min: M.min, max: M.max, step: M.step, value: M.value },
    },
    build(ctx) {
      const { h } = ctx;
      const tag = (node, name) => { node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => (name ? tag(ctx.num(raw, display), name) : ctx.num(raw, display));
      const pi = (pair) => piName(h, pair);
      const tSym = () => h("i", { text: "t" });
      // a law's name in text ("law 1"): data-prx-name, so its digit reads as a name, not a number
      const lawName = (law, capital = false) => (law
        ? h("span", { "data-prx-name": law.id }, capital ? law.title : law.name)
        : (capital ? T.thisLawTitle : T.thisLaw));
      const para = (cls, ...children) => h("p", { class: cls }, ...children);
      const title = (text) => ctx.panelTitle(text, { className: "prx-bn-title" });

      ctx.charts.classList.add("prx-two-units-charts");
      const panels = h("div", { class: "prx-two-units-panels" });
      ctx.charts.append(panels);

      // --- the joint law: a 3 x 3 table on the plot panel, each cell a count box and its probability
      const intro = para("prx-bn-text", ...fill(T.jointIntro, {
        v0: () => num(V[0], formatCount(V[0]), "joint-v0"), v1: () => num(V[1], formatCount(V[1]), "joint-v1"), v2: () => num(V[2], formatCount(V[2]), "joint-v2"),
        min: () => num(0, formatCount(0), "joint-count-min"), max: () => num(CONFIG.maxCount, formatCount(CONFIG.maxCount), "joint-count-max"),
      }));
      const capName = h("span");
      const inputs = [];
      const probs = [];
      const marginA = [];
      const marginB = [];
      const head = (prefix, v, name, scope) => h("th", { scope }, prefix, num(v, formatCount(v), name));
      const countOf = (k) => Number(ctx.state.cells[k]);
      // a count is one digit: a digit typed beside the old one (the caret before or after it) replaces it
      const onCount = (k, input) => {
        const s = input.value.trim();
        if (s === "") return;
        const old = String(countOf(k));
        let v;
        if (/^\d{2}$/.test(s) && (s[0] === old || s[1] === old)) v = Number(s[0] === old ? s[1] : s[0]);
        else v = Number(s);
        if (!Number.isFinite(v)) return;
        const c = Math.min(CONFIG.maxCount, Math.max(0, Math.round(v)));
        if (String(c) !== s) input.value = String(c);
        const counts = [...ctx.state.cells].map(Number);
        if (counts[k] === c) return;
        counts[k] = c;
        const next = parseCells(counts);
        // a law keeps at least one pair: emptying the last cell is refused
        if (next === undefined) { input.value = String(countOf(k)); return; }
        ctx.set({ cells: next });
      };
      const cell = (a, b, k) => {
        const above = a > b;
        const equal = a === b;
        const pid = uid("prx-bn-p");
        const prob = tag(h("span", { class: "prx-bn-p", id: pid }), `joint-cell-${a}-${b}`);
        // the count box: named in full and described by its cell's probability; the row and column heads show its two
        // values, so it has no label of its own on screen and only the field goes into the cell
        const box = ctx.numberInput({
          min: 0, max: CONFIG.maxCount, step: 1, key: `count:${a}-${b}`,
          ariaLabel: `${T.countA}${a}${T.countB}${b}`, describedBy: pid, onInput: () => onCount(k, box.input),
        });
        const { input } = box;
        input.classList.add("prx-bn-count");
        // a count is one digit: the keypad without a decimal point
        input.setAttribute("inputmode", "numeric");
        ctx.listen(input, "blur", () => { input.value = String(countOf(k)); });
        inputs.push(input);
        probs.push(prob);
        return h("td", { class: above ? "prx-two-units-above" : equal ? "prx-bn-tie" : null }, prob, input,
          above ? h("span", { class: "prx-sr-only", text: T.aboveNote }) : equal ? h("span", { class: "prx-sr-only", text: T.tieNote }) : null);
      };
      const rows = V.map((a, i) => {
        const total = tag(h("td", { class: "prx-two-units-total" }), `joint-margin-a${a}`);
        marginA.push(total);
        return h("tr", {}, head(T.rowHead, a, `joint-row-${a}`, "row"), ...V.map((b, j) => cell(a, b, i * V.length + j)), total);
      });
      const totals = h("tr", { class: "prx-two-units-totals" }, h("th", { scope: "row", text: T.total }),
        ...V.map((b) => { const td = tag(h("td", { class: "prx-two-units-total" }), `joint-margin-b${b}`); marginB.push(td); return td; }),
        h("td", {}));
      const lawTable = ctx.scrollRegion(h("div", { class: "prx-two-units-law" },
        h("table", {}, h("caption", {}, capName, T.caption),
          h("thead", {}, h("tr", {}, h("td", { class: "prx-two-units-corner" }), ...V.map((b) => head(T.colHead, b, `joint-col-${b}`, "col")),
            h("th", { scope: "col", text: T.total }))),
          h("tbody", {}, ...rows, totals))), T.lawRegion);
      const keys = h("div", {},
        para("prx-two-units-key", h("span", { class: "prx-two-units-swatch", "aria-hidden": "true" }),
          h("span", {}, ...fill(T.key, { piAB: () => pi("AB"), zero: () => num(0, formatCount(0), "joint-count-zero") }))),
        para("prx-two-units-key", h("span", { class: "prx-two-units-swatch prx-bn-swatch-tie", "aria-hidden": "true" }), h("span", {}, ...fill(T.tieKey, { t: tSym }))));
      const jointResult = para("prx-bn-result-line");
      const marginLine = para("prx-bn-margin-line");
      const tieLine = para("prx-bn-tie-line");
      // the panel's own law choice: it sets only the cells key (a preset sets both panels)
      const lawPick = ctx.segmented({
        label: T.lawPick, name: "law", className: "prx-bn-law", value: ctx.state.cells,
        // a law's digit is part of its name (data-prx-name), not a number
        options: CONFIG.laws.map((l) => ({ value: l.cells, label: h("span", { "data-prx-name": l.id }, l.label) })),
        onChange: (cells) => ctx.set({ cells }),
      });
      // how to read the table sits under it, so the table comes first
      panels.append(h("div", { class: "prx-two-units-panel prx-bn-panel" },
        title(T.jointTitle), lawPick.root, lawTable, intro, keys, h("div", { class: "prx-two-units-result" }, jointResult, marginLine, tieLine)));

      // --- the two-bump posterior: the settings, the weight, the figure, the bump-by-bump table and the result
      const mixIntro = para("prx-bn-text", ...fill(T.mixIntro, {
        hi: () => num(M.hi, fmtCenter(M.hi), "mix-hi"), lo: () => num(M.lo, fmtCenter(M.lo), "mix-lo"),
        sd: () => num(M.sd, formatSetting(M.sd), "mix-sd"), meanB: () => num(M.meanB, formatSetting(M.meanB), "mix-mean-b"),
        sdB: () => num(M.sdB, formatSetting(M.sdB), "mix-sd-b"),
      }));
      const mixSlider = ctx.slider({ label: T.mixSlider, ...ctx.key("mixW"), onInput: (v) => ctx.set({ mixW: v }) });
      mixSlider.input.setAttribute("aria-label", T.mixSliderName);
      const figure = h("div", { class: "prx-two-units-panel prx-bn-figure" });
      const m0 = mixCompute(M.value);
      const tableRow = (part, weight, center, piv) => ({ part, weight, center, pi: piv });
      const mixTable = hiddenTable(ctx.doc, {
        visible: true,
        caption: T.table,
        columns: [
          { label: T.colPart, value: "part" },
          { label: T.colWeight, value: "weight", format: (v) => (v === null ? "" : formatSetting(v)) },
          { label: T.colCenter, value: "center", format: (v) => fmtCenter(v) },
          { label: T.colPi, value: "pi", format: (v) => formatProb(v, { bounds: TU.bounds }) },
        ],
        rows: [tableRow(T.rowLower, m0.lower, M.lo, m0.piLower), tableRow(T.rowUpper, m0.w, M.hi, m0.piUpper), tableRow(T.rowWhole, null, m0.meanA, m0.pi)],
      });
      // read-out hooks on the table cells (rows: lower, upper, whole; columns: weight, center, π)
      const hooks = [["mix-weight-lower", "mix-center-lower", "mix-pi-lower"], ["mix-weight-upper", "mix-center-upper", "mix-pi-upper"], [null, "mix-mean-a", "mix-pi"]];
      const tableCells = [...mixTable.querySelectorAll("tbody tr")].map((tr, i) => {
        const tds = [...tr.querySelectorAll("td")];
        hooks[i].forEach((name, k) => { if (name) tds[k].setAttribute("data-prx-readout", name); });
        return tds;
      });
      const range = flipRange();
      const mixResult = para("prx-two-units-result");
      const explain = para("prx-bn-explain", ...fill(T.mixExplain, {
        piAB: () => pi("AB"),
        from: () => num(range.from, formatSetting(range.from), "mix-flip-from"),
        to: () => num(range.to, formatSetting(range.to), "mix-flip-to"),
      }));
      // the settings of the two posteriors sit under the figure, so the figure comes first
      panels.append(h("div", { class: "prx-two-units-panel prx-bn-panel" },
        title(T.mixTitle), h("div", { class: "prx-bn-slider" }, mixSlider.root), figure, mixIntro,
        h("div", { class: "prx-two-units-mixtable" }, mixTable), mixResult, explain));

      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));
      // a line under the preset row (placed at the first render, once base.js has added the row)
      const presetNote = para("prx-bn-preset-note", T.presetNote);

      function drawJoint(j, law) {
        capName.replaceChildren(lawName(law, true));
        j.counts.forEach((c, k) => {
          const input = inputs[k];
          const typing = ctx.doc.activeElement === input && input.value.trim() === "";
          if (!typing && input.value !== String(c)) input.value = String(c);
          if (c > 0) setNum(probs[k], j.p[k], frac(j.p[k]));
          else { probs[k].removeAttribute("data-num"); probs[k].textContent = ""; }
        });
        j.marginA.forEach((p, i) => setNum(marginA[i], p, frac(p)));
        j.marginB.forEach((p, i) => setNum(marginB[i], p, frac(p)));
        const ending = j.piAB < j.piBA - CONFIG.tol ? T.moreB : j.piAB > j.piBA + CONFIG.tol ? T.moreA : T.neither;
        jointResult.replaceChildren(T.resultA, lawName(law), T.resultB, pi("AB"), T.resultC, num(j.piAB, frac(j.piAB), "joint-pi"),
          T.resultD, pi("BA"), T.resultC, num(j.piBA, frac(j.piBA), "joint-pi-ba"), ending);
        const L = CONFIG.laws;
        const third = () => num(LAW1.marginA[0], frac(LAW1.marginA[0]), "joint-third");
        // law 1's and law 2's π_AB (engine, on their own laws) beside the law shown
        const lawSlots = {
          third, law1: () => lawName(L[0]), law2: () => lawName(L[1]), piAB: () => pi("AB"),
          pi1: () => num(LAW1.piAB, frac(LAW1.piAB), "joint-law1-pi"), pi2: () => num(LAW2.piAB, frac(LAW2.piAB), "joint-law2-pi"),
        };
        const compare = law?.id === L[0].id ? T.sameLaw1 : law?.id === L[1].id ? T.sameLaw2 : T.sameOther;
        marginLine.replaceChildren(...(sameMarginsAsLaw1(j)
          ? [...fill(T.sameMargins, { ...lawSlots, mean: () => num(j.meanA, fmtLawMean(j.meanA), "joint-mean") }), ...fill(compare, lawSlots)]
          : fill(T.otherMargins, {
            ...lawSlots,
            meanA: () => num(j.meanA, fmtLawMean(j.meanA), "joint-mean-a"), meanB: () => num(j.meanB, fmtLawMean(j.meanB), "joint-mean-b"),
          })));
        const tie = j.t > CONFIG.tol;
        tieLine.replaceChildren(...fill(tie ? T.tie : T.noTie, {
          t: () => h("span", {}, tSym(), " = ", num(j.t, frac(j.t), "joint-t")),
          piAB: () => pi("AB"), piBA: () => pi("BA"), d: () => num(j.d, frac(j.d), "joint-d"), one: () => num(1, formatCount(1)),
          thA: () => symName(h, "θ", "A"), thB: () => symName(h, "θ", "B"),
        }));
      }

      function drawMix(m) {
        mixSlider.set(m.w);
        const cellsNow = [[m.lower, M.lo, m.piLower], [m.w, M.hi, m.piUpper], [null, m.meanA, m.pi]];
        cellsNow.forEach(([weight, center, piv], i) => {
          const [wTd, cTd, pTd] = tableCells[i];
          if (weight === null) wTd.textContent = "";
          else setNum(wTd, weight, formatSetting(weight));
          setNum(cTd, center, i === 2 ? fmtMean(center) : fmtCenter(center));
          setNum(pTd, piv, formatProb(piv, { bounds: TU.bounds }));
        });
        const v = mixVerdict(m);
        const rel = v.meansSay > 0 ? T.above : v.meansSay < 0 ? T.below : T.equals;
        const ending = v.flip ? (v.piSays < 0 ? T.flipB : T.flipA) : v.meansSay !== 0 && v.piSays !== 0 ? T.agrees : T.stop;
        mixResult.replaceChildren(T.mixResultA, num(m.meanA, fmtMean(m.meanA), "mix-result-mean-a"), rel,
          num(M.meanB, formatSetting(M.meanB), "mix-result-mean-b"), T.mixResultB, v.flip ? T.yet : T.and,
          pi("AB"), T.resultC, num(m.pi, formatProb(m.pi), "mix-result-pi"), ending);
        drawMixFigure(m, v);
      }

      function drawMixFigure(m, v) {
        const [lo, hi] = MIX_DOMAIN;
        // A's curve on the union of the two bumps' grids
        const xs = [...new Set([...densityPoints(M.lo, M.sd, lo, hi, [M.lo]), ...densityPoints(M.hi, M.sd, lo, hi, [M.hi])].map((p) => p.x))]
          .sort((p, q) => p - q);
        const a = xs.map((x) => ({ x, y: mixDensity(x, m.w) }));
        const b = densityPoints(M.meanB, M.sdB, lo, hi, [M.meanB]);
        const width = plotWidth(figure);
        const labels = mixLabels(m, width);
        const relWords = v.meansSay > 0 ? T.kbMeanAbove : v.meansSay < 0 ? T.kbMeanBelow : T.kbMeanEqual;
        const points = [
          { key: "lower", x: M.lo, y: mixDensity(M.lo, m.w),
            title: `${T.kbLower}${fmtCenter(M.lo)}${T.kbWeight}${formatSetting(m.lower)}${T.kbWithin}${formatProb(m.piLower)}.` },
          { key: "b", x: M.meanB, y: normalPdf(0) / M.sdB, title: `${T.kbB}${formatSetting(M.meanB)}${T.kbSd}${formatSetting(M.sdB)}.` },
          { key: "mean", x: m.meanA, y: K.meanTop * MIX_YMAX,
            title: `${T.kbMean}${fmtMean(m.meanA)}${relWords}${formatSetting(M.meanB)}${T.kbMeanPi}${formatProb(m.pi)}.` },
          { key: "upper", x: M.hi, y: mixDensity(M.hi, m.w),
            title: `${T.kbUpper}${fmtCenter(M.hi)}${T.kbWeight}${formatSetting(m.w)}${T.kbWithin}${formatProb(m.piUpper)}.` },
        ];
        const text = (k, P, d, bold) => P.text([d], { x: "x", y: "y", text: "text", dx: d.dx, dy: d.dy, textAnchor: d.anchor, fill: k.plotFg,
          fontWeight: bold ? "bold" : undefined, stroke: k.plotBg, strokeWidth: C.halo, paintOrder: "stroke" });
        plot(figure, {
          alt: T.alt,
          width,
          height: K.height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [lo, hi], label: T.xLabel },
          y: { domain: [0, MIX_YMAX], label: TU.text.yLabel, ticks: C.yTicks },
          marks: (k, P) => [
            P.ruleY([0], { stroke: k.plotAxis }),
            P.ruleX([m.meanA, M.meanB], { stroke: k.plotFg, strokeWidth: K.thin, strokeDasharray: K.rule }),
            P.lineY(a, { x: "x", y: "y", stroke: k.post, strokeWidth: C.line }),
            P.lineY(b, { x: "x", y: "y", stroke: k.post, strokeWidth: C.line, strokeDasharray: C.dash }),
            ...labels.peaks.map((d) => text(k, P, d, true)),
            text(k, P, labels.mean, false),
            text(k, P, labels.meanB, false),
          ],
          keyboard: { data: points, x: "x", y: "y", key: "key", label: T.kbLabel, title: (d) => d.title },
        });
      }

      return {
        render(state) {
          if (ctx.presets && presetNote.previousElementSibling !== ctx.presets) ctx.presets.after(presetNote);
          const law = namedLaw(state.cells);
          lawPick.set(state.cells);
          const j = jointCompute(state.cells);
          drawJoint(j, law);
          const m = mixCompute(state.mixW);
          drawMix(m);
          ctx.readout.set([
            lawName(law, true), T.gives, pi("AB"), T.resultC, num(j.piAB, frac(j.piAB), "live-joint-pi"),
            T.resultD, pi("BA"), T.resultC, num(j.piBA, frac(j.piBA), "live-joint-pi-ba"),
            ...(j.t > CONFIG.tol ? [T.liveTie, num(j.t, frac(j.t), "live-joint-t")] : []),
            T.liveMixA, num(m.w, formatSetting(m.w), "live-mix-w"), T.liveMixB, num(m.meanA, fmtMean(m.meanA), "live-mix-mean-a"),
            T.liveMixC, num(M.meanB, formatSetting(M.meanB), "live-mix-mean-b"), T.liveMixD, pi("AB"), T.resultC,
            num(m.pi, formatProb(m.pi), "live-mix-pi"), ".",
          ]);
        },
      };
    },
  });
}
