// beyond-normal (app 1.10): "Same means, different directions" (Frame v2 Targeted migration).
// Shows (1) a 3x3 joint law on {0, 1, 2} where identical uniform margins (mean 1.00) yield π_AB = 1/3 under Law 1
// vs 2/3 under Law 2 (and ties under Independent / Always equal), paired with (2) a two-bump mixture posterior for A
// vs normal B where A's mean exceeds B's for w in [.10, .30] while π_AB stays below .50.
// Primary toolbar holds Joint law + Weight w; Settings holds the 3x3 cell-weight editor (44px touch targets, 0 focus jumps);
// Data holds the exact 3x3 probability table + bump-by-bump summary table; Method holds tie-freeness and mixture notes.

import { createWidget, uid } from "../shared/base.js";
import { hiddenTable, labelOn, plot, svgScene } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatProb,
  formatRational,
  formatReadoutEst,
  formatSetting,
  setNum,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import {
  finiteLawCells,
  finiteLawMargins,
  finiteLawPairwise,
  mixturePairDirection,
  normalPdf,
  pairDirection,
  rankSummaries,
  tieLawPairwise,
} from "../pr-core.js";
import {
  CONFIG as TU,
  CSS as TU_CSS,
  densityPoints,
  paddedDomain,
  piName,
  plotWidth,
  symName,
} from "../shared/domain/two-units.js";

export const CONFIG = Object.freeze({
  name: "beyond-normal",
  label: "Same means, different directions: two joint laws with the same margins, and a posterior with two bumps",
  className: "prx-bn",
  units: TU.units,
  values: Object.freeze([0, 1, 2]),
  maxCount: 9,
  laws: Object.freeze([
    Object.freeze({ id: "law1", cells: "010001100", name: "law 1", title: "Law 1", label: "Law 1" }),
    Object.freeze({ id: "law2", cells: "001100010", name: "law 2", title: "Law 2", label: "Law 2" }),
    Object.freeze({ id: "independent", cells: "111111111", name: "the independence law", title: "The independence law", label: "Independent" }),
    Object.freeze({ id: "equal", cells: "100010001", name: "the always-equal law", title: "The always-equal law", label: "Always equal" }),
  ]),
  tol: 1e-12,
  mix: Object.freeze({ min: 0.05, max: 0.95, step: 0.05, value: 0.2, lo: -0.1, hi: 1, sd: 0.1, meanB: 0, sdB: 0.1 }),
  half: 0.5,
  digits: Object.freeze({ center: 2, mean: 3, lawMean: 2 }),
  chart: Object.freeze({
    height: 244,
    heightMobile: 214,
    marginTop: 28,
    marginBottom: 38,
    thin: 1.5,
    rule: "1,3",
    meanTop: 0.68,
    meanDx: 5,
    topDy: -13,
    peakBox: Object.freeze({ width: 13, height: 16 }),
    meanBox: Object.freeze({ width: 66, height: 16 }),
    pad: 4,
    samples: 8,
    steps: 4,
  }),
  text: Object.freeze({
    jointTitle: "The same two posteriors, two different answers",
    lawPick: "Joint law",
    jointAlt: "Three-by-three joint-law probability matrix and marginal posterior bars for units A and B on values 0, 1, and 2.",
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
    sameLaw1: Object.freeze([" With the same totals, ", "{law2}", " gives ", "{piAB}", " = ", "{pi2}", "."]),
    sameLaw2: Object.freeze([" With the same totals, ", "{law1}", " gives ", "{piAB}", " = ", "{pi1}", "."]),
    sameOther: Object.freeze([" With the same totals, ", "{law1}", " gives ", "{piAB}", " = ", "{pi1}", " and ", "{law2}", " gives ", "{pi2}", "."]),
    otherMargins: Object.freeze(["The totals, each unit's own posterior, differ from those of ", "{law1}", " and ", "{law2}", " (", "{third}",
      " on each value, with ", "{piAB}", " = ", "{pi1}", " and ", "{pi2}", "): the posterior means are ", "{meanA}", " for A and ", "{meanB}", " for B."]),
    noTie: Object.freeze(["The two true values are never equal here (", "{t}", "), so ", "{piAB}", " + ", "{piBA}", " = ", "{d}", "."]),
    tie: Object.freeze(["The two true values are equal with probability ", "{t}", ", so ", "{piAB}", " + ", "{piBA}", " = ", "{d}", ", not ", "{one}",
      ". Tie-freeness (that the two true values are never exactly equal) is an assumption about the joint law: even continuous margins (each unit's own posterior) allow ",
      "{thA}", " = ", "{thB}", "."]),
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
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 1.1rem;
  flex: 1 1 15rem;
  max-width: 21rem;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-law {
  margin: 0;
  flex: 1 1 100%;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-law .prx-seg-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-controls > .prx-slider {
  flex: 1 1 14rem;
  max-width: 21rem;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-stage {
  container-type: inline-size;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-stage .prx-two-units-panels,
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-stage .prx-bn-panel {
  grid-area: auto;
  min-width: 0;
}
.prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem 1.35rem;
  align-items: start;
}
@container (min-width: 48rem) {
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.prx-bn .prx-bn-panel { min-width: 0; }
.prx-bn .prx-bn-title.prx-panel-title {
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
}
.prx-bn .prx-bn-figure { margin: 0; }
.prx-bn .prx-bn-stage-line,
.prx-bn .prx-stage p.prx-two-units-result {
  margin: 0.35rem 0 0;
  padding: 0.3rem 0.55rem;
  font-size: 0.86rem;
  line-height: 1.35;
  background: var(--prx-bg-sunken);
  color: var(--prx-fg);
  border-radius: var(--prx-radius);
  font-variant-numeric: tabular-nums;
}
.prx-bn .prx-bn-weight-wrap {
  flex: 1 1 100%;
  width: 100%;
  max-width: 28rem;
}
.prx-bn .prx-bn-weight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem 0.6rem;
}
.prx-bn .prx-bn-weight-cell > .prx-number {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.15rem;
  margin: 0;
}
.prx-bn .prx-bn-weight-cell label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--prx-fg-muted);
}
.prx-bn .prx-bn-weight-cell input.prx-bn-count {
  width: 100%;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.prx-bn .prx-bn-data-stack {
  display: grid;
  gap: 0.85rem;
}
.prx-bn .prx-two-units-law { max-width: 100%; overflow-x: auto; }
.prx-bn .prx-two-units-law table { margin: 0; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.prx-bn .prx-two-units-law caption { caption-side: top; padding: 0 0 0.35rem; font-size: 0.9em; text-align: left; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-law th, .prx-bn .prx-two-units-law td {
  min-width: 3.25em; height: 2.25em; padding: 0.2rem 0.5rem; text-align: center;
  vertical-align: middle; color: var(--prx-plot-fg); background: var(--prx-plot-bg); border: 1px solid var(--prx-plot-grid);
}
.prx-bn .prx-two-units-law th { font-weight: 600; white-space: nowrap; }
.prx-bn .prx-two-units-law .prx-two-units-corner { border: 0; background: transparent; }
.prx-bn .prx-two-units-law .prx-two-units-above {
  background: var(--prx-blues-3); color: var(--prx-label-dark);
  box-shadow: inset 0 0 0 1px var(--prx-cell-border);
}
.prx-bn .prx-two-units-law .prx-bn-tie { outline: 1px dashed var(--prx-cell-border); outline-offset: -4px; }
.prx-bn .prx-two-units-law .prx-two-units-total { font-weight: 600; background: var(--prx-plot-grid); color: var(--prx-label-dark); }
.prx-bn .prx-bn-p { display: block; min-height: 1.35em; line-height: 1.35; font-weight: 600; }
.prx-bn .prx-two-units-key { display: flex; gap: 0.5rem; align-items: center; margin: 0.35rem 0 0; font-size: 0.88em; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-swatch { flex: none; width: 1.1em; height: 1.1em; background: var(--prx-blues-3); border: 1px solid var(--prx-cell-border); }
.prx-bn .prx-two-units-swatch.prx-bn-swatch-tie { background: var(--prx-plot-bg); border-style: dashed; }
.prx-bn .prx-bn-margin-box {
  margin: 0.45rem 0 0; padding: 0.4rem 0.65rem; background: var(--prx-bg-sunken);
  border-radius: var(--prx-radius); font-size: 0.9em; font-variant-numeric: tabular-nums;
}
.prx-bn .prx-bn-margin-box > p { margin: 0; }
.prx-bn .prx-two-units-mixtable .prx-data-table table { margin: 0; }
.prx-bn .prx-two-units-mixtable caption { caption-side: top; padding: 0 0 0.35rem; font-size: 0.9em; text-align: left; color: var(--prx-fg-muted); }
.prx-bn .prx-two-units-mixtable th, .prx-bn .prx-two-units-mixtable td { vertical-align: top; overflow-wrap: normal; word-break: normal; }
.prx-bn .prx-two-units-mixtable tbody tr:last-child > * { font-weight: 600; border-top: 2px solid var(--prx-border-strong); }
.prx-bn .prx-bn-method-stack > p { margin: 0; }
.prx-bn .prx-bn-method-stack > p + p { margin-top: 0.5rem; }
@media (max-width: 30em) {
  .prx-bn.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.3rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons,
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-law .prx-seg-buttons { gap: 0.25rem; }
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg,
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-bn-law .prx-seg { padding: 0.18rem 0.48rem; font-size: 0.8125rem; }
  .prx-bn.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.45rem; font-size: 0.875rem; line-height: 1.35; }
  .prx-bn.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.5rem; }
  .prx-bn .prx-two-units-law th, .prx-bn .prx-two-units-law td { min-width: 2.9em; padding: 0.2rem 0.3rem; }
  .prx-bn .prx-two-units-mixtable table { font-size: 0.9em; }
  .prx-bn .prx-two-units-mixtable th, .prx-bn .prx-two-units-mixtable td { padding: 0.2rem 0.3rem; }
}
`;

// ---------------------------------------------------------------------------------------------- the joint law

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

export const namedLaw = (cells) => CONFIG.laws.find((l) => l.cells === cells) ?? null;

export function lawPairs(cells) {
  const pairs = [];
  V.forEach((a, i) => V.forEach((b, j) => {
    for (let k = 0; k < Number(cells[i * V.length + j]); k += 1) pairs.push([a, b]);
  }));
  return pairs;
}

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
  const cellOf = (a, b) => {
    const r = joint.rowValues.indexOf(a);
    const c = joint.colValues.indexOf(b);
    return r < 0 || c < 0 ? 0 : joint.cells[r][c];
  };
  return {
    cells,
    counts,
    p: V.flatMap((a) => V.map((b) => cellOf(a, b))),
    piAB: pw.pi[0][0][1],
    piBA: pw.pi[0][1][0],
    t: pw.t[0][0][1],
    d: tie.d[0][0][1],
    marginA: marginOf(margins[0][0]),
    marginB: marginOf(margins[1][0]),
    meanA: means[0],
    meanB: means[1],
  };
}

const LAW1 = jointCompute(CONFIG.laws[0].cells);
const LAW2 = jointCompute(CONFIG.laws[1].cells);

export const sameMarginsAsLaw1 = (j) =>
  [...j.marginA, ...j.marginB].every((p, i) => Math.abs(p - [...LAW1.marginA, ...LAW1.marginB][i]) <= CONFIG.tol);

// ---------------------------------------------------------------------------------------------- the two bumps

export function mixDensity(x, w) {
  return ((1 - w) * normalPdf((x - M.lo) / M.sd) + w * normalPdf((x - M.hi) / M.sd)) / M.sd;
}

export function mixCompute(w) {
  const lower = 1 - w;
  const comp = (weight, center) => ({ w: weight, meanA: center, sdA: M.sd, meanB: M.meanB, sdB: M.sdB, corr: 0 });
  return {
    w,
    lower,
    meanA: rankSummaries({ states: [[M.lo], [M.hi]], probs: [lower, w] }).means[0],
    piLower: pairDirection(M.lo, M.sd, M.meanB, M.sdB),
    piUpper: pairDirection(M.hi, M.sd, M.meanB, M.sdB),
    pi: mixturePairDirection([comp(lower, M.lo), comp(w, M.hi)]),
  };
}

export function mixVerdict(m) {
  const meansSay = Math.sign(m.meanA - M.meanB);
  const piSays = Math.sign(m.pi - CONFIG.half);
  return { meansSay, piSays, flip: meansSay !== 0 && piSays !== 0 && meansSay !== piSays };
}

export function flipRange() {
  const n = Math.round((M.max - M.min) / M.step);
  const all = [];
  for (let k = 0; k <= n; k += 1) {
    const w = Number((M.min + k * M.step).toFixed(2));
    if (mixVerdict(mixCompute(w)).flip) all.push(w);
  }
  return { from: all[0] ?? null, to: all.at(-1) ?? null, all };
}

const MIX_DOMAIN = paddedDomain(
  Math.min(M.lo - G.reach * M.sd, M.meanB - G.reach * M.sdB),
  Math.max(M.hi + G.reach * M.sd, M.meanB + G.reach * M.sdB)
);
const MIX_YMAX = G.headroom * Math.max(normalPdf(0) / M.sdB, normalPdf(0) / M.sd);

const chartHeightFor = (width) => (width < 380 ? K.heightMobile : K.height);

function geometry(width, height = chartHeightFor(width)) {
  const [lo, hi] = MIX_DOMAIN;
  const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
  const innerH = Math.max(1, height - K.marginTop - K.marginBottom);
  return {
    width,
    lo,
    hi,
    innerW,
    px: (x) => C.marginLeft + ((x - lo) / (hi - lo)) * innerW,
    py: (y) => K.marginTop + (1 - y / MIX_YMAX) * innerH,
    xOf: (X) => lo + ((X - C.marginLeft) / innerW) * (hi - lo),
  };
}

function labelBox(d, size, g) {
  const X = g.px(d.x) + (d.dx ?? 0);
  const left = d.anchor === "middle" ? X - size.width / 2 : d.anchor === "end" ? X - size.width : X;
  const mid = g.py(d.y) + (d.dy ?? 0);
  return { left: left - K.pad, right: left + size.width + K.pad, top: mid - size.height / 2 - K.pad, bottom: mid + size.height / 2 + K.pad };
}

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
  const top = (x, text, side) => ({ x, y: MIX_YMAX, text, dx: side * K.meanDx, dy: K.topDy, anchor: side > 0 ? "start" : "end" });
  const mean = [at(first), at(-first)].find(clear) ?? top(m.meanA, T.meanLabel, away);
  const meanB = top(M.meanB, T.meanLabelB, -away);
  return { peaks: [labelA, labelB], mean, meanB, peakA, peakB };
}

// ---------------------------------------------------------------------------------------------- the app

const fill = (parts, slot) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slot[m[1]]() : p; });
const frac = (x) => formatRational(x);
const fmtCenter = (x) => formatDecimal(x, { digits: CONFIG.digits.center });
const fmtLawMean = (x) => formatDecimal(x, { digits: CONFIG.digits.lawMean });

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: `${CONFIG.className} ${TU.className}`,
    css: `${TU_CSS}${CSS}`,
    frame: "v2",
    keys: {
      cells: { type: "custom", value: CONFIG.laws[0].cells, parse: (v) => parseCells(v) },
      mixW: { type: "number", min: M.min, max: M.max, step: M.step, value: M.value },
    },
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);
      const tag = (node, name) => { node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => (name ? tag(ctx.num(raw, display), name) : ctx.num(raw, display));
      const pi = (pair) => piName(h, pair);
      const tSym = () => h("i", { text: "t" });
      const lawName = (law, capital = false) => (law
        ? h("span", { "data-prx-name": law.id }, capital ? law.title : law.name)
        : (capital ? T.thisLawTitle : T.thisLaw));
      const para = (cls, ...children) => h("p", { class: cls }, ...children);
      const title = (text) => ctx.panelTitle(text, { className: "prx-bn-title" });

      // --- 1. Primary toolbar controls: Joint law segmented + Weight w slider
      const lawPick = ctx.segmented({
        label: T.lawPick,
        name: "law",
        className: "prx-bn-law",
        value: ctx.state.cells,
        options: CONFIG.laws.map((l) => ({ value: l.cells, label: h("span", { "data-prx-name": l.id }, l.label) })),
        onChange: (cells) => ctx.set({ cells }),
      });
      const mixSlider = ctx.slider({ label: T.mixSlider, ...ctx.key("mixW"), onInput: (v) => ctx.set({ mixW: v }) });
      mixSlider.input.setAttribute("aria-label", T.mixSliderName);
      ctx.controls.append(ctx.primaryControl(mixSlider.root));

      // --- 2. Settings disclosure: Joint law selector + 3x3 cell-weight editor (44px touch targets, monotonic Tab order, deferred clamping)
      const settingsBox = ctx.settingsBox("Edit 3×3 joint-law weights");
      const weightGrid = h("div", { class: "prx-bn-weight-grid" });
      settingsBox.body.append(lawPick.root, h("div", { class: "prx-bn-weight-wrap" }, weightGrid));

      const countBoxes = [];
      const probs = [];
      const marginA = [];
      const marginB = [];
      const countOf = (k) => Number(ctx.state.cells[k]);

      const applyCellCount = (k, rawVal, box) => {
        if (!Number.isFinite(rawVal)) return;
        const c = Math.min(CONFIG.maxCount, Math.max(0, Math.round(rawVal)));
        const counts = [...ctx.state.cells].map(Number);
        if (counts[k] === c) {
          if (box.input.value !== String(c)) box.set(c);
          return;
        }
        counts[k] = c;
        const next = parseCells(counts);
        if (next === undefined) {
          box.set(countOf(k));
          return;
        }
        ctx.set({ cells: next });
      };

      // --- 3. Exact Data table & bump-by-bump table (built eagerly inside Data disclosure)
      const capName = h("span");
      const head = (prefix, v, name, scope) => h("th", { scope }, prefix, num(v, formatCount(v), name));
      const makeCell = (a, b, k) => {
        const above = a > b;
        const equal = a === b;
        const pid = uid("prx-bn-p");
        const prob = tag(h("span", { class: "prx-bn-p", id: pid }), `joint-cell-${a}-${b}`);
        const box = ctx.numberInput({
          label: `A = ${a}, B = ${b}`,
          min: 0,
          max: CONFIG.maxCount,
          step: 1,
          value: countOf(k),
          name: `cell-${a}-${b}`,
          key: `count:${a}-${b}`,
          ariaLabel: `${T.countA}${a}${T.countB}${b}`,
          describedBy: pid,
          onInput: (v) => applyCellCount(k, v, box),
          onChange: (v) => applyCellCount(k, v, box),
        });
        box.input.classList.add("prx-bn-count");
        box.input.setAttribute("inputmode", "numeric");
        ctx.listen(box.input, "blur", () => {
          if (box.input.value.trim() === "" || box.input.getAttribute("aria-invalid") === "true") {
            box.set(countOf(k));
          }
        });
        weightGrid.append(h("div", { class: "prx-bn-weight-cell" }, box.root));
        countBoxes.push(box);
        probs.push(prob);
        return h(
          "td",
          { class: above ? "prx-two-units-above" : equal ? "prx-bn-tie" : null },
          prob,
          above ? h("span", { class: "prx-sr-only", text: T.aboveNote }) : equal ? h("span", { class: "prx-sr-only", text: T.tieNote }) : null
        );
      };

      const rows = V.map((a, i) => {
        const total = tag(h("td", { class: "prx-two-units-total" }), `joint-margin-a${a}`);
        marginA.push(total);
        return h("tr", {}, head(T.rowHead, a, `joint-row-${a}`, "row"), ...V.map((b, j) => makeCell(a, b, i * V.length + j)), total);
      });
      const totals = h(
        "tr",
        { class: "prx-two-units-totals" },
        h("th", { scope: "row", text: T.total }),
        ...V.map((b) => {
          const td = tag(h("td", { class: "prx-two-units-total" }), `joint-margin-b${b}`);
          marginB.push(td);
          return td;
        }),
        h("td", {})
      );
      const lawTable = ctx.scrollRegion(
        h(
          "div",
          { class: "prx-two-units-law" },
          h(
            "table",
            {},
            h("caption", {}, capName, T.caption),
            h("thead", {}, h("tr", {}, h("td", { class: "prx-two-units-corner" }), ...V.map((b) => head(T.colHead, b, `joint-col-${b}`, "col")), h("th", { scope: "col", text: T.total }))),
            h("tbody", {}, ...rows, totals)
          )
        ),
        T.lawRegion
      );

      const keys = h(
        "div",
        { class: "prx-bn-keys" },
        para(
          "prx-two-units-key",
          h("span", { class: "prx-two-units-swatch", "aria-hidden": "true" }),
          h("span", {}, ...fill(T.key, { piAB: () => pi("AB"), zero: () => num(0, formatCount(0), "joint-count-zero") }))
        ),
        para(
          "prx-two-units-key",
          h("span", { class: "prx-two-units-swatch prx-bn-swatch-tie", "aria-hidden": "true" }),
          h("span", {}, ...fill(T.tieKey, { t: tSym }))
        )
      );
      const marginLine = para("prx-bn-margin-line");
      marginLine.setAttribute("data-prx-evidence", "joint-law-margins");

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
        rows: [
          tableRow(T.rowLower, m0.lower, M.lo, m0.piLower),
          tableRow(T.rowUpper, m0.w, M.hi, m0.piUpper),
          tableRow(T.rowWhole, null, m0.meanA, m0.pi),
        ],
      });
      const hooks = [
        ["mix-weight-lower", "mix-center-lower", "mix-pi-lower"],
        ["mix-weight-upper", "mix-center-upper", "mix-pi-upper"],
        [null, "mix-mean-a", "mix-pi"],
      ];
      const tableCells = [...mixTable.querySelectorAll("tbody tr")].map((tr, i) => {
        const tds = [...tr.querySelectorAll("td")];
        hooks[i].forEach((name, k) => { if (name) tds[k].setAttribute("data-prx-readout", name); });
        return tds;
      });

      // --- 4. Primary visual stage: 3x3 joint-law probability/marginals scene + generous two-bump density plot
      ctx.stage.classList.add("prx-two-units-charts");
      const jointFigure = h("div", { class: "prx-two-units-panel prx-bn-figure" });
      const jointResult = para("prx-bn-result-line prx-bn-stage-line");
      const mixFigure = h("div", { class: "prx-two-units-panel prx-bn-figure" });
      const mixResult = para("prx-two-units-result");
      ctx.stage.append(
        h(
          "div",
          { class: "prx-bn-stage-grid" },
          h("div", { class: "prx-bn-panel" }, title(T.jointTitle), jointFigure, jointResult, marginLine),
          h("div", { class: "prx-bn-panel" }, title(T.mixTitle), mixFigure, mixResult)
        )
      );

      // --- 5. Data & Method disclosures
      const dataBox = ctx.dataBox("Data and exact joint law");
      dataBox.body.append(
        h(
          "div",
          { class: "prx-bn-data-stack" },
          h("div", {}, lawTable, keys),
          h("div", { class: "prx-two-units-mixtable" }, mixTable)
        )
      );

      const methodBox = ctx.methodBox("Method and details");
      const tieLine = para("prx-bn-tie-line");
      const intro = para(
        "prx-bn-text",
        ...fill(T.jointIntro, {
          v0: () => num(V[0], formatCount(V[0]), "joint-v0"),
          v1: () => num(V[1], formatCount(V[1]), "joint-v1"),
          v2: () => num(V[2], formatCount(V[2]), "joint-v2"),
          min: () => num(0, formatCount(0), "joint-count-min"),
          max: () => num(CONFIG.maxCount, formatCount(CONFIG.maxCount), "joint-count-max"),
        })
      );
      const mixIntro = para(
        "prx-bn-text",
        ...fill(T.mixIntro, {
          hi: () => num(M.hi, fmtCenter(M.hi), "mix-hi"),
          lo: () => num(M.lo, fmtCenter(M.lo), "mix-lo"),
          sd: () => num(M.sd, formatSetting(M.sd), "mix-sd"),
          meanB: () => num(M.meanB, formatSetting(M.meanB), "mix-mean-b"),
          sdB: () => num(M.sdB, formatSetting(M.sdB), "mix-sd-b"),
        })
      );
      const range = flipRange();
      const explain = para(
        "prx-bn-explain",
        ...fill(T.mixExplain, {
          piAB: () => pi("AB"),
          from: () => num(range.from, formatSetting(range.from), "mix-flip-from"),
          to: () => num(range.to, formatSetting(range.to), "mix-flip-to"),
        })
      );
      methodBox.body.append(h("div", { class: "prx-bn-method-stack" }, tieLine, intro, mixIntro, explain));

      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));

      function drawJointGraphic(j) {
        const wEst = plotWidth(jointFigure);
        const hJoint = chartHeightFor(wEst);
        const compact = hJoint <= K.heightMobile;
        svgScene(
          jointFigure,
          {
            height: hJoint,
            fontSize: 13,
            alt: T.jointAlt,
          },
          (scene) => {
            const { width: W, height: H, palette: pal, el: sEl } = scene;
            const labelX = 48;
            const gridX = 54;
            const avail = Math.max(180, W - gridX - 8);
            const cellStep = Math.min(82, Math.max(50, Math.floor((avail - 82) / 3)));
            const cellW = cellStep - 4;
            const cellH = compact ? 38 : 44;
            const gridY = compact ? 23 : 26;
            const rowStep = compact ? 41 : 48;
            const margX = gridX + 3 * cellStep + 8;
            const margW = Math.max(68, W - margX - 6);
            const barMaxW = Math.max(26, margW - 38);

            const numTspan = (raw, disp) => sEl("tspan", { "data-num": dataNum(raw) }, disp);

            // Column headers: B = 0, 1, 2 and Pr(A)
            V.forEach((b, col) => {
              const cx = gridX + col * cellStep + cellW / 2;
              scene.add(
                sEl(
                  "text",
                  { x: cx, y: 16, textAnchor: "middle", fontWeight: "600", fill: pal.plotFg },
                  "B = ",
                  numTspan(b, formatCount(b))
                )
              );
            });
            scene.add(
              sEl("text", { x: margX, y: 16, textAnchor: "start", fontWeight: "600", fill: pal.plotFg }, "Pr(A)")
            );

            // 3x3 cells + right marginal Pr(A = a) bars
            const textMidDy = compact ? 22 : 25;
            V.forEach((a, rIdx) => {
              const ry = gridY + rIdx * rowStep;
              scene.add(
                sEl(
                  "text",
                  { x: labelX, y: ry + textMidDy + 1, textAnchor: "end", fontWeight: "600", fill: pal.plotFg },
                  "A = ",
                  numTspan(a, formatCount(a))
                )
              );

              V.forEach((b, cIdx) => {
                const k = rIdx * V.length + cIdx;
                const p = j.p[k];
                const cx = gridX + cIdx * cellStep;
                const above = a > b;
                const equal = a === b;
                const bg = above
                  ? (p > 0 ? pal.blues[2] : pal.blues[0])
                  : equal
                    ? (p > 0 ? pal.neutral[1] : pal.plotBg)
                    : (p > 0 ? pal.bgRaised : pal.plotBg);
                const border = above ? pal.relAbove : pal.cellBorder;

                scene.add(
                  sEl("rect", {
                    x: cx,
                    y: ry,
                    width: cellW,
                    height: cellH,
                    rx: 4,
                    fill: bg,
                    stroke: border,
                    strokeWidth: above && p > 0 ? 1.5 : 1,
                    strokeDasharray: equal ? "4,3" : undefined,
                  })
                );

                if (p > 0) {
                  const barW = Math.max(4, Math.round((cellW - 10) * p));
                  scene.add(
                    sEl("rect", {
                      x: cx + 5,
                      y: ry + cellH - 7,
                      width: barW,
                      height: 4,
                      rx: 2,
                      fill: above ? pal.relAbove : equal ? pal.neutral[5] : pal.relBelow,
                    })
                  );
                }

                const fg = p > 0 ? labelOn(bg, pal) : pal.plotMuted;
                scene.add(
                  scene.numText(
                    {
                      x: cx + cellW / 2,
                      y: ry + textMidDy,
                      textAnchor: "middle",
                      fontWeight: p > 0 ? "700" : "400",
                      fill: fg,
                    },
                    p,
                    frac(p)
                  )
                );
              });

              // Marginal Pr(A = a) bar + exact fraction
              const pA = j.marginA[rIdx];
              const barY = ry + (compact ? 13 : 16);
              scene.add(
                sEl("rect", { x: margX, y: barY, width: barMaxW, height: 11, rx: 2, fill: pal.plotGrid }),
                pA > 0
                  ? sEl("rect", {
                      x: margX,
                      y: barY,
                      width: Math.max(3, Math.round(barMaxW * pA)),
                      height: 11,
                      rx: 2,
                      fill: pal.post,
                    })
                  : null,
                scene.numText(
                  {
                    x: margX + barMaxW + 6,
                    y: ry + textMidDy + 1,
                    textAnchor: "start",
                    fontWeight: "600",
                    fill: pal.plotFg,
                  },
                  pA,
                  frac(pA)
                )
              );
            });

            // Bottom marginal Pr(B = b) bars + exact fractions
            const bRowY = gridY + 3 * rowStep + 5;
            scene.add(
              sEl("text", { x: labelX, y: bRowY + 21, textAnchor: "end", fontWeight: "600", fill: pal.plotFg }, "Pr(B)")
            );
            V.forEach((b, cIdx) => {
              const pB = j.marginB[cIdx];
              const cx = gridX + cIdx * cellStep;
              const trackW = cellW - 8;
              scene.add(
                sEl("rect", { x: cx + 4, y: bRowY, width: trackW, height: 6, rx: 2, fill: pal.plotGrid }),
                pB > 0
                  ? sEl("rect", {
                      x: cx + 4,
                      y: bRowY,
                      width: Math.max(3, Math.round(trackW * pB)),
                      height: 6,
                      rx: 2,
                      fill: pal.post,
                    })
                  : null,
                scene.numText(
                  {
                    x: cx + cellW / 2,
                    y: bRowY + 21,
                    textAnchor: "middle",
                    fontWeight: "600",
                    fill: pal.plotFg,
                  },
                  pB,
                  frac(pB)
                )
              );
            });

            // Bottom summary strip: π_AB + π_BA on left; Marginal means on right
            const stripY = H - 8;
            scene.add(
              sEl(
                "text",
                { x: 4, y: stripY, textAnchor: "start", fill: pal.plotMuted },
                "π",
                sEl("tspan", { dy: 3, fontSize: 10 }, "AB"),
                sEl("tspan", { dy: -3 }, " + π"),
                sEl("tspan", { dy: 3, fontSize: 10 }, "BA"),
                sEl("tspan", { dy: -3 }, " = "),
                sEl("tspan", { fontWeight: "600", fill: pal.plotFg, "data-num": dataNum(j.d) }, frac(j.d))
              ),
              sEl(
                "text",
                { x: W - 4, y: stripY, textAnchor: "end", fill: pal.plotMuted },
                "Means: ",
                sEl("tspan", { fontWeight: "600", fill: pal.plotFg, "data-num": dataNum(j.meanA) }, formatReadoutEst(j.meanA)),
                ", ",
                sEl("tspan", { fontWeight: "600", fill: pal.plotFg, "data-num": dataNum(j.meanB) }, formatReadoutEst(j.meanB))
              )
            );
          }
        );
      }

      function drawJoint(j, law) {
        capName.replaceChildren(lawName(law, true));
        j.counts.forEach((c, k) => {
          const box = countBoxes[k];
          if (ctx.doc.activeElement !== box.input && box.input.value !== String(c)) {
            box.set(c);
          }
          if (c > 0) setNum(probs[k], j.p[k], frac(j.p[k]));
          else {
            probs[k].removeAttribute("data-num");
            probs[k].textContent = "";
          }
        });
        j.marginA.forEach((p, i) => setNum(marginA[i], p, frac(p)));
        j.marginB.forEach((p, i) => setNum(marginB[i], p, frac(p)));

        const ending = j.piAB < j.piBA - CONFIG.tol ? T.moreB : j.piAB > j.piBA + CONFIG.tol ? T.moreA : T.neither;
        jointResult.replaceChildren(
          T.resultA,
          lawName(law),
          T.resultB,
          pi("AB"),
          T.resultC,
          num(j.piAB, frac(j.piAB), "joint-pi"),
          T.resultD,
          pi("BA"),
          T.resultC,
          num(j.piBA, frac(j.piBA), "joint-pi-ba"),
          ending
        );

        const L = CONFIG.laws;
        const third = () => num(LAW1.marginA[0], frac(LAW1.marginA[0]), "joint-third");
        const lawSlots = {
          third,
          law1: () => lawName(L[0]),
          law2: () => lawName(L[1]),
          piAB: () => pi("AB"),
          pi1: () => num(LAW1.piAB, frac(LAW1.piAB), "joint-law1-pi"),
          pi2: () => num(LAW2.piAB, frac(LAW2.piAB), "joint-law2-pi"),
        };
        const compare = law?.id === L[0].id ? T.sameLaw1 : law?.id === L[1].id ? T.sameLaw2 : T.sameOther;
        marginLine.replaceChildren(
          ...(sameMarginsAsLaw1(j)
            ? [...fill(T.sameMargins, { ...lawSlots, mean: () => num(j.meanA, fmtLawMean(j.meanA), "joint-mean") }), ...fill(compare, lawSlots)]
            : fill(T.otherMargins, {
                ...lawSlots,
                meanA: () => num(j.meanA, fmtLawMean(j.meanA), "joint-mean-a"),
                meanB: () => num(j.meanB, fmtLawMean(j.meanB), "joint-mean-b"),
              }))
        );

        const tie = j.t > CONFIG.tol;
        tieLine.replaceChildren(
          ...fill(tie ? T.tie : T.noTie, {
            t: () => h("span", {}, tSym(), " = ", num(j.t, frac(j.t), "joint-t")),
            piAB: () => pi("AB"),
            piBA: () => pi("BA"),
            d: () => num(j.d, frac(j.d), "joint-d"),
            one: () => num(1, formatCount(1)),
            thA: () => symName(h, "θ", "A"),
            thB: () => symName(h, "θ", "B"),
          })
        );

        drawJointGraphic(j);
      }

      function drawMixFigure(m, v) {
        const [lo, hi] = MIX_DOMAIN;
        const xs = [...new Set([...densityPoints(M.lo, M.sd, lo, hi, [M.lo]), ...densityPoints(M.hi, M.sd, lo, hi, [M.hi])].map((p) => p.x))].sort(
          (p, q) => p - q
        );
        const a = xs.map((x) => ({ x, y: mixDensity(x, m.w) }));
        const b = densityPoints(M.meanB, M.sdB, lo, hi, [M.meanB]);
        const width = plotWidth(mixFigure);
        const hMix = chartHeightFor(width);
        const labels = mixLabels(m, width);
        const relWords = v.meansSay > 0 ? T.kbMeanAbove : v.meansSay < 0 ? T.kbMeanBelow : T.kbMeanEqual;
        const points = [
          {
            key: "lower",
            x: M.lo,
            y: mixDensity(M.lo, m.w),
            title: `${T.kbLower}${fmtCenter(M.lo)}${T.kbWeight}${formatSetting(m.lower)}${T.kbWithin}${formatProb(m.piLower)}.`,
          },
          {
            key: "b",
            x: M.meanB,
            y: normalPdf(0) / M.sdB,
            title: `${T.kbB}${formatSetting(M.meanB)}${T.kbSd}${formatSetting(M.sdB)}.`,
          },
          {
            key: "mean",
            x: m.meanA,
            y: K.meanTop * MIX_YMAX,
            title: `${T.kbMean}${formatReadoutEst(m.meanA)}${relWords}${formatSetting(M.meanB)}${T.kbMeanPi}${formatProb(m.pi)}.`,
          },
          {
            key: "upper",
            x: M.hi,
            y: mixDensity(M.hi, m.w),
            title: `${T.kbUpper}${fmtCenter(M.hi)}${T.kbWeight}${formatSetting(m.w)}${T.kbWithin}${formatProb(m.piUpper)}.`,
          },
        ];
        const text = (k, P, d, bold) =>
          P.text([d], {
            x: "x",
            y: "y",
            text: "text",
            dx: d.dx,
            dy: d.dy,
            textAnchor: d.anchor,
            fill: k.plotFg,
            fontWeight: bold ? "bold" : undefined,
            stroke: k.plotBg,
            strokeWidth: C.halo,
            paintOrder: "stroke",
          });
        plot(mixFigure, {
          alt: T.alt,
          width,
          height: hMix,
          marginTop: K.marginTop,
          marginBottom: K.marginBottom,
          marginLeft: C.marginLeft,
          marginRight: C.marginRight,
          x: { domain: [lo, hi], label: T.xLabel },
          y: { domain: [0, MIX_YMAX], label: TU.text.yLabel, ticks: C.yTicks },
          marks: (k, P) => [
            P.areaY(a, { x: "x", y: "y", fill: k.blues[1], fillOpacity: 0.5 }),
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

      function drawMix(m) {
        mixSlider.set(m.w);
        const cellsNow = [
          [m.lower, M.lo, m.piLower],
          [m.w, M.hi, m.piUpper],
          [null, m.meanA, m.pi],
        ];
        cellsNow.forEach(([weight, center, piv], i) => {
          const [wTd, cTd, pTd] = tableCells[i];
          if (weight === null) wTd.textContent = "";
          else setNum(wTd, weight, formatSetting(weight));
          setNum(cTd, center, i === 2 ? formatReadoutEst(center) : fmtCenter(center));
          setNum(pTd, piv, formatProb(piv, { bounds: TU.bounds }));
        });
        const v = mixVerdict(m);
        const rel = v.meansSay > 0 ? T.above : v.meansSay < 0 ? T.below : T.equals;
        const ending = v.flip ? (v.piSays < 0 ? T.flipB : T.flipA) : v.meansSay !== 0 && v.piSays !== 0 ? T.agrees : T.stop;
        mixResult.replaceChildren(
          T.mixResultA,
          writer.est(m.meanA, { hook: "mix-result-mean-a" }),
          rel,
          writer.setting(M.meanB, { hook: "mix-result-mean-b" }),
          T.mixResultB,
          v.flip ? T.yet : T.and,
          pi("AB"),
          T.resultC,
          writer.prob(m.pi, { hook: "mix-result-pi" }),
          ending
        );
        drawMixFigure(m, v);
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          const law = namedLaw(state.cells);
          lawPick.set(state.cells);
          const j = jointCompute(state.cells);
          drawJoint(j, law);
          const m = mixCompute(state.mixW);
          drawMix(m);
          writer.set([
            lawName(law, true),
            " gives ",
            pi("AB"),
            " = ",
            writer.num(j.piAB, frac(j.piAB), { hook: "live-joint-pi" }),
            ", ",
            pi("BA"),
            " = ",
            writer.num(j.piBA, frac(j.piBA), { hook: "live-joint-pi-ba" }),
            ...(j.t > CONFIG.tol ? [" (tie ", tSym(), " = ", writer.num(j.t, frac(j.t), { hook: "live-joint-t" }), ")"] : []),
            ". Two bumps (w = ",
            writer.setting(m.w, { hook: "live-mix-w" }),
            "): A's mean is ",
            writer.est(m.meanA, { hook: "live-mix-mean-a" }),
            " vs. B's ",
            writer.setting(M.meanB, { hook: "live-mix-mean-b" }),
            ", with ",
            pi("AB"),
            " = ",
            writer.prob(m.pi, { hook: "live-mix-pi" }),
            ".",
          ]);
        },
      };
    },
  });
}
