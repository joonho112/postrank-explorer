// two-units (app 1.8): "Two units, one probability". Two independent normal posteriors set by the reader, their
// densities, the posterior of the difference θ_A − θ_B on the same scales with the area above 0 shaded, and the
// direction probability π_AB = Pr(θ_A > θ_B ∣ Y) = Φ((mean_A − mean_B) / √(SD_A² + SD_B²)) in a formula that
// updates live, with the reverse π_BA = 1 − π_AB and the condition under which it holds.
// Starting point: postrank Explorer v1 L-07 (js/widgets/two-units.js), its core, without the prediction gate. v1's
// three Deeper boxes are their own apps: 1.9 correlated-units (correlation) and 1.10 beyond-normal (joint laws, a
// two-bump posterior).
//
// One state { muA, sdA, muB, sdB } drives every part, all redrawn on every render:
//   controls  one fieldset per unit, "Unit A (solid line)" and "Unit B (dashed line)" (the legends name the line
//             styles of the figure of the two posteriors), each with its posterior mean and posterior SD
//   upper     the two posteriors, navy (A solid, B dashed), each named at its peak
//   lower     the posterior of θ_A − θ_B (dash-dot): normal with mean = the gap and SD = √(SD_A² + SD_B²) (engine
//             pairDifference); the area above 0 shaded (it is π_AB), named "π_AB →" and "← π_BA" on either side of the
//             line at 0
//   formula   the general formula (with its symbols in words), the formula at these settings and the reverse line
//   read-out  π_AB and π_BA (engine pairDifference, each computed on its own, not as 1 − π), the mean and SD of the
//             difference and the gap in SDs of the difference, as a size with "above" or "below"
// π of two normal posteriors with positive SDs lies strictly inside (0, 1), so a probability whose double is 0 or 1
// reads "below .001" or "above .999", never "0" or "1" (probText: formatProb with open).
// Both panels share one x domain (the union of what each curve needs within 4 SDs, and 0) and one y scale in density
// units, so the posterior of the difference is visibly lower and wider than either unit's posterior. The panels are
// stacked, so the shared x scale lines up, and sit side by side only in a container of at least 64rem (class
// prx-two-units-stacked; the apps that reuse the panel grid go side by side from 56rem).
//
// Keys: muA and muB (−2 to 2), sdA and sdB (.05 to 1); numbers, clamped to the slider ends and not snapped.
//
// Exports for the apps that build on this one (1.9 correlated-units, 1.10 beyond-normal):
//   CONFIG, CSS            the settings and the app's rules, all under .prx-two-units (an app that reuses the
//                          fieldsets, panels or formula box adds that class to its className and its css)
//   unitKeys()             the four keys muA, sdA, muB, sdB (a fresh object for createWidget)
//   niceDomain(lo, hi), paddedDomain(lo, hi), densityPoints(mu, sd, lo, hi, extra)   axis and curve helpers
//   compute({ muA, sdA, muB, sdB })   the gap, the SD of the difference, z, π_AB and π_BA (engine pairDifference)
//   sharedDomain(r), sharedYMax(r)    the one x domain and the one y maximum of both panels
//   probText(raw, options)            a direction probability of normal posteriors as text (formatProb with open)
//   probTex(f, raw), signedTex(f, raw, display, cls), workedTex(r), reverseTex(r)   formula pieces (math.js
//                          formulaNums f): a bound as a relation, a negative value in parentheses, the two live formulas
//   piName(h, pair), symName(h, base, sub)   π_AB (or θ_A) as HTML, with the subscript
//   unitControls(ctx, { onInput })    the two unit fieldsets with their four sliders: { roots, sliders, set(state) }
//   plotWidth(el)                     the width chart.plot gives a figure in el (for label geometry)
//   peakLabels(r, domain, ymax, { width, height }), topMarks(c, P, r, domain, ymax, { width, height }),
//   drawTop(el, r, domain, ymax, options)                                        the two posteriors
//   diffLabel(d, domain, text), diffMarks(c, P, d, domain, options), areaLabels(domain, ymax, { width }),
//   drawDiff(el, r, domain, ymax, options)                                       the posterior of the difference
// Labels never sit on a curve, the line at 0 or a tick label: a peak label the other unit's curve runs through moves
// beside its peak; the difference's label moves beside its peak, away from 0, when the peak is near 0 (the rule of
// the correlation figure, which 1.9 draws with diffLabel too); and when one side of 0 is too narrow for its area
// label, both area labels share the other.
import { createWidget } from "../shared/base.js";
import { CONFIG as CHART, plot } from "../shared/chart.js";
import { formatDecimal, formatProb, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { normalPdf, pairDifference } from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "two-units",
  label: "Two units: the probability that one unit's true value is larger than the other's",
  className: "prx-two-units",
  mean: Object.freeze({ min: -2, max: 2, step: 0.01 }),
  sd: Object.freeze({ min: 0.05, max: 1, step: 0.01 }),
  // the defaults, equal to the first preset (gap20)
  setting: Object.freeze({ muA: 0.3, sdA: 0.2, muB: 0.1, sdB: 0.2 }),
  // density curves: an even grid over the axis, a denser grid within `reach` SDs of the mean; one x domain for both
  // panels (padded by `pad` of its span) and one y domain, `headroom` above the highest peak
  grid: Object.freeze({ base: 121, dense: 81, reach: 4, pad: 0.04, headroom: 1.15 }),
  nice: Object.freeze({ ticks: 6, mantissas: Object.freeze([1, 2, 2.5, 5, 10]), decimals: 12 }),
  digits: Object.freeze({ gap: 2, sd: 3, z: 3 }),
  chart: Object.freeze({
    heightTop: 180, heightDiff: 180, marginTop: 24, marginBottom: 36, marginLeft: 44, marginRight: 20, yTicks: 3,
    line: 2, dash: "6,4", dashDiff: "9,3,2,3", halo: 3,
    labelDy: -9, labelDx: 9, overlap: 0.12, labelTop: 0.93, piDx: 6,
    // a peak label's box in px (a bold capital at the 12 px figure font, with room around it) and the samples taken
    // of the other unit's curve across it: a label the other curve runs through moves beside its own peak, one
    // labelDx step at a time, up to `steps` steps (it stays at the first step when no step clears the curve)
    labelBox: Object.freeze({ width: 9, height: 13, pad: 2, samples: 8, steps: 3 }),
    // the width in px of one area label ("π_AB →", about 49 px at the site's font): when one side of 0 has less room
    // than a label and its offset, both labels go on the other side, on one line
    piLabelWidth: 52,
    // keyboard points for the two areas of the lower figure: this share of the x span on either side of 0
    areaDx: 0.06,
  }),
  units: Object.freeze(["A", "B"]),
  text: Object.freeze({
    unit: Object.freeze({ A: "Unit A (solid line)", B: "Unit B (dashed line)" }),
    meanLabel: "Posterior mean",
    sdLabel: "Posterior SD",
    meanName: "Posterior mean of unit ",
    sdName: "Posterior SD of unit ",
    general: "For independent normal posteriors",
    worked: "At these settings",
    reverseNote: "This holds when the two true values have probability zero of being equal (here: their difference is normal with positive SD).",
    // the symbols of the general formula in words
    glossA: " is the probability that A is truly higher: that A's true value, ",
    glossB: ", is larger than B's, ",
    glossC: ", given the data ",
    glossD: ". ",
    glossPhiA: ") is the area under the normal curve with mean ",
    glossPhiB: " and SD ",
    glossPhiC: " to the left of ",
    regionGeneral: "The direction probability for independent normal posteriors",
    regionWorked: "The direction probability at these settings",
    regionReverse: "The reverse direction",
    xTop: "True value",
    xDiff: "True value of A minus true value of B",
    yLabel: "Density",
    diffLabel: "A − B",
    altTop: "Posterior densities of the true values of unit A (solid line) and unit B (dashed line).",
    altDiff: "Posterior density of the difference of the true values, A minus B (dash-dot line), on the same scales as the figure of the two posteriors. The area to the right of zero is shaded; it is the probability that A's true value is larger than B's.",
    tableTop: "Posterior mean and SD of each unit",
    tableDiff: "Posterior mean and SD of the difference A minus B",
    colUnit: "Unit",
    colQuantity: "Quantity",
    colMean: "Posterior mean",
    colSd: "Posterior SD",
    diffRow: "A minus B",
    readA: "The probability that A's true value is larger than B's is ",
    readB: ", and the reverse is ",
    // a probability shown as a bound ("above .999") follows its symbol in words
    readBoundA: "The probability that A's true value is larger than B's, ",
    readBoundB: ", and the reverse, ",
    readIs: ", is ",
    readC: "The difference A minus B has posterior mean ",
    readD: " and SD ",
    // the gap in SDs of the difference, as a size with a direction ("A's mean is .316 … below B's")
    readE: ", so A's mean is ",
    readAbove: " SDs of the difference above B's.",
    readBelow: " SDs of the difference below B's.",
    readEqual: ", so the two means are ",
    readApart: " SDs of the difference apart.",
    // keyboard reading of the figures (arrow keys)
    kbTop: "The two posteriors: the arrow keys read each unit's posterior mean and SD.",
    kbDiff: "The posterior of A minus B: the arrow keys read its mean and SD and the two areas on either side of 0.",
    kbUnit: "Unit ",
    kbMean: ": posterior mean ",
    kbSd: ", posterior SD ",
    kbDiff1: "A minus B: posterior mean ",
    kbAbove: "Shaded area to the right of 0: the probability that A's true value is larger than B's, ",
    kbBelow: "Area to the left of 0: the probability that B's true value is larger than A's, ",
  }),
  tex: Object.freeze({
    general: "\\begin{aligned}\\pi_{AB} &= \\Pr(\\theta_A > \\theta_B \\mid Y) \\\\ &= \\Phi\\left(\\frac{\\class{prx-post}{\\text{mean}_A} - \\class{prx-post}{\\text{mean}_B}}{\\sqrt{\\class{prx-post}{\\text{SD}_A}^{2} + \\class{prx-post}{\\text{SD}_B}^{2}}}\\right)\\end{aligned}",
    piAB: "\\pi_{AB}",
    piBA: "\\pi_{BA}",
    // the two areas of the lower figure, named on either side of the line at 0
    areaAB: "\\pi_{AB} \\rightarrow",
    areaBA: "\\leftarrow \\pi_{BA}",
    // a minus between two colored \text values gets the spaces Temml gives an uncolored one (Chromium sets it tight)
    minus: "\\:-\\:",
    post: "prx-post",
  }),
  // inside a formula a bound is written as a relation (formatProb with bounds "symbols": ">.999", "<.001")
  bounds: "symbols",
  // a read-out probability shown as a bound ("above .999", "below .001")
  boundWords: /^(?:above|below) /,
});

const T = CONFIG.text;
const C = CONFIG.chart;

export const CSS = `
.prx-two-units .prx-two-units-unit { flex: 1 1 15rem; min-width: 0; margin: 0; padding: 0.25rem 0.75rem 0.75rem;
  border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-two-units .prx-two-units-unit > legend { width: auto; margin: 0; padding: 0 0.25rem; font-size: 1em; font-weight: 600;
  color: var(--prx-fg-heading); }
.prx-two-units .prx-two-units-unit > .prx-slider { max-width: none; }
.prx-two-units .prx-two-units-unit > .prx-slider + .prx-slider { margin-top: 0.5rem; }
.prx-two-units .prx-controls > .prx-presets { flex: 1 1 100%; }
.prx-two-units .prx-two-units-sym sub { font-size: 0.75em; }
.prx-two-units .prx-two-units-charts { container-type: inline-size; }
.prx-two-units .prx-two-units-panels { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }
.prx-two-units .prx-two-units-panel { min-width: 0; }
@container (min-width: 56rem) {
  .prx-two-units .prx-two-units-panels:not(.prx-two-units-stacked) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* this app's own two panels stay stacked, one scale above the other, up to a wider container than the panels of the
   apps that reuse the grid */
@container (min-width: 64rem) {
  .prx-two-units .prx-two-units-panels.prx-two-units-stacked { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.prx-two-units .prx-two-units-formula { container-type: inline-size; margin: 0.75rem 0 0; padding: 0.5rem 0.75rem;
  background: var(--prx-bg); border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-two-units .prx-two-units-formula-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.5rem 1.5rem; }
@container (min-width: 44rem) {
  .prx-two-units .prx-two-units-formula-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-two-units .prx-two-units-formula-grid > .prx-two-units-step:last-child { grid-column: 1 / -1; }
}
.prx-two-units .prx-two-units-step { min-width: 0; }
.prx-two-units .prx-two-units-head.prx-panel-title { margin: 0; font-size: 0.9em; font-weight: 600; color: var(--prx-fg-muted); }
.prx-two-units .prx-two-units-tex { max-width: 100%; overflow-x: auto; overflow-y: hidden; overflow-wrap: normal; }
.prx-two-units .prx-two-units-tex math { max-width: none; }
.prx-two-units .prx-two-units-note { margin: 0.25rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
`;

const roundNice = (x) => Number(x.toFixed(CONFIG.nice.decimals));

/** A "nice" axis domain that holds [lo, hi]: ends on multiples of 1, 2, 2.5 or 5 × 10^k. */
export function niceDomain(lo, hi) {
  const span = hi - lo > 0 ? hi - lo : 1;
  const raw = span / CONFIG.nice.ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = (CONFIG.nice.mantissas.find((m) => m * p >= raw) ?? CONFIG.nice.mantissas.at(-1)) * p;
  return [roundNice(Math.floor(lo / step) * step), roundNice(Math.ceil(hi / step) * step)];
}

/** niceDomain of [lo, hi] padded by CONFIG.grid.pad of its span. */
export const paddedDomain = (lo, hi) => niceDomain(lo - CONFIG.grid.pad * (hi - lo), hi + CONFIG.grid.pad * (hi - lo));

function evenGrid(lo, hi, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(lo + ((hi - lo) * i) / (count - 1));
  return out;
}

/** Points of the normal density with mean mu and SD sd over [lo, hi] (engine normalPdf), x values in order. */
export function densityPoints(mu, sd, lo, hi, extra = []) {
  const { base, dense, reach } = CONFIG.grid;
  const xs = [...evenGrid(lo, hi, base), ...evenGrid(Math.max(lo, mu - reach * sd), Math.min(hi, mu + reach * sd), dense), ...extra]
    .filter((x) => x >= lo && x <= hi)
    .sort((a, b) => a - b);
  const out = [];
  for (const x of xs) if (!out.length || x > out[out.length - 1].x) out.push({ x, y: normalPdf((x - mu) / sd) / sd });
  return out;
}

/** The four keys of the two units (a fresh object, for createWidget). */
export function unitKeys() {
  const keys = {};
  for (const u of CONFIG.units) {
    keys[`mu${u}`] = { type: "number", ...CONFIG.mean, value: CONFIG.setting[`mu${u}`] };
    keys[`sd${u}`] = { type: "number", ...CONFIG.sd, value: CONFIG.setting[`sd${u}`] };
  }
  return keys;
}

/**
 * Everything the app shows for one setting, from the engine's posterior of the difference θ_A − θ_B
 * (pairDifference): its mean (the gap), its SD, z and π_AB; π_BA is the reverse pair's, on its own and not 1 − π_AB.
 */
export function compute({ muA, sdA, muB, sdB }) {
  const d = pairDifference(muA, sdA, muB, sdB);
  return {
    muA, sdA, muB, sdB, gap: d.mean, sdDiff: d.sd, z: d.z, pi: d.pi,
    piReverse: pairDifference(muB, sdB, muA, sdA).pi,
  };
}

/** The one x domain of both panels: it holds each unit's and the difference's density within `reach` SDs, and 0. */
export function sharedDomain(r) {
  const { reach } = CONFIG.grid;
  const lo = Math.min(0, r.muA - reach * r.sdA, r.muB - reach * r.sdB, r.gap - reach * r.sdDiff);
  const hi = Math.max(0, r.muA + reach * r.sdA, r.muB + reach * r.sdB, r.gap + reach * r.sdDiff);
  return paddedDomain(lo, hi);
}

/** The one y domain of both panels, in density units: the difference has the larger SD, so a unit's peak is highest. */
export function sharedYMax(r) {
  return CONFIG.grid.headroom * Math.max(normalPdf(0) / r.sdA, normalPdf(0) / r.sdB, normalPdf(0) / r.sdDiff);
}

// ---------------------------------------------------------------------------------------------- formulas

/** A direction probability of normal posteriors as text: it lies strictly inside (0, 1), so formatProb is told so
 *  (open) and writes a double of exactly 0 or 1 as "below .001" or "above .999". options: formatProb's (bounds …). */
export const probText = (raw, options = {}) => formatProb(raw, { ...options, open: true });

/** A probability inside a formula: "= .760", or the bound as a relation (">.999", "<.001"). */
export function probTex(f, raw) {
  const s = probText(raw, { bounds: CONFIG.bounds });
  return /^[<>]/.test(s) ? `\\;${f.num(raw, s)}` : `= ${f.num(raw, s)}`;
}

/** A formula value in parentheses when it is negative, so "− (−.50)" reads as a difference. */
export function signedTex(f, raw, display, cls) {
  const t = f.num(raw, display, cls);
  return raw < 0 ? `\\left(${t}\\right)` : t;
}

/** The worked formula at one setting, and the raw values of its numbers in order (muA, muB, sdA, sdB, gap, SD, z, π). */
export function workedTex(r) {
  const f = formulaNums();
  const P = CONFIG.tex.post;
  const mA = f.num(r.muA, formatSetting(r.muA), P);
  const mB = signedTex(f, r.muB, formatSetting(r.muB), P);
  const sA = f.num(r.sdA, formatSetting(r.sdA), P);
  const sB = f.num(r.sdB, formatSetting(r.sdB), P);
  const gap = f.num(r.gap, formatDecimal(r.gap, { digits: CONFIG.digits.gap }));
  const sd = f.num(r.sdDiff, formatDecimal(r.sdDiff, { digits: CONFIG.digits.sd }));
  const z = f.num(r.z, formatDecimal(r.z, { digits: CONFIG.digits.z }));
  const tex = `\\begin{aligned}${CONFIG.tex.piAB} &= \\Phi\\left(\\frac{${mA} ${CONFIG.tex.minus} ${mB}}{\\sqrt{${sA}^{2} + ${sB}^{2}}}\\right) \\\\ `
    + `&= \\Phi\\left(\\frac{${gap}}{${sd}}\\right) = \\Phi(${z}) ${probTex(f, r.pi)}\\end{aligned}`;
  return { tex, raws: f.raws };
}

/** π_BA = 1 − π_AB at one setting, and the raw values of its numbers (the 1, then π_BA). */
export function reverseTex(r) {
  const f = formulaNums();
  const tex = `${CONFIG.tex.piBA} = ${f.num(1, "1")} - ${CONFIG.tex.piAB} ${probTex(f, r.piReverse)}`;
  return { tex, raws: f.raws };
}

// ---------------------------------------------------------------------------------------------- HTML pieces

/** A symbol with a subscript as HTML: symName(h, "θ", "A") is θ_A. */
export const symName = (h, base, sub) => h("span", { class: "prx-two-units-sym" }, base, h("sub", {}, sub));

/** π with a subscript pair as HTML: π_AB. */
export const piName = (h, pair) => symName(h, "π", pair);

/**
 * The two unit fieldsets, "Unit A (solid line)" and "Unit B (dashed line)", each with the sliders "Posterior mean"
 * and "Posterior SD" (aria-labels "Posterior mean of unit A" …). The app must have the keys of unitKeys().
 * onInput(key, value) defaults to ctx.set({ [key]: value }). Returns { roots, sliders: [[key, slider]], set(state) }.
 */
export function unitControls(ctx, { onInput } = {}) {
  const { h } = ctx;
  const sliders = [];
  const send = onInput ?? ((key, v) => ctx.set({ [key]: v }));
  const roots = CONFIG.units.map((u) => {
    const meanKey = `mu${u}`;
    const sdKey = `sd${u}`;
    const mean = ctx.slider({ label: T.meanLabel, ...ctx.key(meanKey), onInput: (v) => send(meanKey, v) });
    const sd = ctx.slider({ label: T.sdLabel, ...ctx.key(sdKey), onInput: (v) => send(sdKey, v) });
    mean.input.setAttribute("aria-label", `${T.meanName}${u}`);
    sd.input.setAttribute("aria-label", `${T.sdName}${u}`);
    sliders.push([meanKey, mean], [sdKey, sd]);
    return h("fieldset", { class: "prx-control prx-two-units-unit" }, h("legend", { text: T.unit[u] }), mean.root, sd.root);
  });
  return { roots, sliders, set(state) { for (const [k, s] of sliders) s.set(state[k]); } };
}

// ---------------------------------------------------------------------------------------------- figures

const yAxis = (ymax) => ({ domain: [0, ymax], label: T.yLabel, ticks: C.yTicks });
const frame = (height) => ({ height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight });
const fmtGap = (x) => formatDecimal(x, { digits: CONFIG.digits.gap });
const fmtSd = (x) => formatDecimal(x, { digits: CONFIG.digits.sd });
const extraMarks = (extra, c, P) => (typeof extra === "function" ? [extra(c, P)].flat() : []);
const density = (x, mu, sd) => normalPdf((x - mu) / sd) / sd;

/** The width chart.plot gives a figure in el: its measured width (at least chart.js's minimum), else the default. */
export function plotWidth(el) {
  const measured = Math.round(el?.clientWidth || el?.getBoundingClientRect?.().width || 0);
  return measured > 0 ? Math.max(CHART.minWidth, measured) : CHART.defaultWidth;
}

/**
 * True when the curve f (a density of x) runs through the box of a peak label drawn at (x, y) with dx and anchor, in
 * a figure of the given width and height over [lo, hi] × [0, ymax]. The curve's pixel heights across the box are
 * sampled; as the curve is continuous, it passes through the box when their range meets the box's height.
 */
function labelHit(f, d, { lo, hi, ymax, width, height }) {
  const B = C.labelBox;
  const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
  const innerH = Math.max(1, height - C.marginTop - C.marginBottom);
  const px = (x) => C.marginLeft + ((x - lo) / (hi - lo)) * innerW;
  const py = (y) => C.marginTop + (1 - y / ymax) * innerH;
  const left = px(d.x) + d.dx - (d.anchor === "middle" ? B.width / 2 : d.anchor === "end" ? B.width : 0) - B.pad;
  const right = left + B.width + 2 * B.pad;
  const mid = py(d.y) + C.labelDy;
  const top = mid - B.height / 2 - B.pad;
  const bottom = mid + B.height / 2 + B.pad;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k <= B.samples; k += 1) {
    const X = left + ((right - left) * k) / B.samples;
    const Y = py(Math.min(ymax, f(lo + ((X - C.marginLeft) / innerW) * (hi - lo))));
    min = Math.min(min, Y);
    max = Math.max(max, Y);
  }
  return min <= bottom && max >= top;
}

/**
 * The direct labels of the upper figure: bold "A" and "B" 9 px above their peaks. Close peaks (within 12% of the x
 * span and of ymax) push the labels 9 px apart, A to the side of its own mean (left when A's mean is at most B's);
 * a label that the other unit's curve runs through moves beside its peak, to the same side, 9 px at a time until the
 * curve clears it (at most CONFIG.chart.labelBox.steps steps). geometry: { width, height } of the figure in px.
 */
export function peakLabels(r, [lo, hi], ymax, { width = CHART.defaultWidth, height = C.heightTop } = {}) {
  const peakA = normalPdf(0) / r.sdA;
  const peakB = normalPdf(0) / r.sdB;
  const close = Math.abs(r.muA - r.muB) < C.overlap * (hi - lo) && Math.abs(peakA - peakB) < C.overlap * ymax;
  const sideA = r.muA <= r.muB ? -1 : 1;
  const beside = (side, step = 1) => ({ dx: side * step * C.labelDx, anchor: side < 0 ? "end" : "start" });
  const label = (x, y, text, side) => ({ x, y, text, side, ...(close ? beside(side) : { dx: 0, anchor: "middle" }) });
  const labels = [label(r.muA, peakA, CONFIG.units[0], sideA), label(r.muB, peakB, CONFIG.units[1], -sideA)];
  const others = [(x) => density(x, r.muB, r.sdB), (x) => density(x, r.muA, r.sdA)];
  const g = { lo, hi, ymax, width, height };
  return labels.map((d, i) => {
    if (!labelHit(others[i], d, g)) return d;
    for (let step = 1; step <= C.labelBox.steps; step += 1) {
      const moved = { ...d, ...beside(d.side, step) };
      if (!labelHit(others[i], moved, g)) return moved;
    }
    return { ...d, ...beside(d.side) };
  });
}

/**
 * The marks of the upper figure for a compute() result r: the baseline, A solid and B dashed (navy, width 2), and
 * the peak labels (peakLabels) with a halo. geometry: { width, height } of the figure in px (for the labels).
 */
export function topMarks(c, P, r, [lo, hi], ymax, geometry = {}) {
  const a = densityPoints(r.muA, r.sdA, lo, hi, [r.muA]);
  const b = densityPoints(r.muB, r.sdB, lo, hi, [r.muB]);
  const labels = peakLabels(r, [lo, hi], ymax, geometry);
  return [
    P.ruleY([0], { stroke: c.plotAxis }),
    P.lineY(a, { x: "x", y: "y", stroke: c.post, strokeWidth: C.line }),
    P.lineY(b, { x: "x", y: "y", stroke: c.post, strokeWidth: C.line, strokeDasharray: C.dash }),
    ...labels.map((d) => P.text([d], { x: "x", y: "y", text: "text", dx: d.dx, dy: C.labelDy, textAnchor: d.anchor, fill: c.plotFg, fontWeight: "bold",
      stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke" })),
  ];
}

/**
 * The upper figure in el: topMarks on the shared domain and y scale, the hidden table "Posterior mean and SD of each
 * unit" and keyboard points at the two peaks. options: marks(c, P) for extra marks drawn last, keyboard (false: none).
 * Returns the chart.plot handle.
 */
export function drawTop(el, r, domain = sharedDomain(r), ymax = sharedYMax(r), { marks: extra, keyboard = true } = {}) {
  const [lo, hi] = domain;
  const geometry = { width: plotWidth(el), height: C.heightTop };
  const peaks = [
    { key: "A", x: r.muA, y: normalPdf(0) / r.sdA, mean: r.muA, sd: r.sdA },
    { key: "B", x: r.muB, y: normalPdf(0) / r.sdB, mean: r.muB, sd: r.sdB },
  ];
  return plot(el, {
    alt: T.altTop,
    table: {
      caption: T.tableTop,
      columns: [
        { label: T.colUnit, value: "unit" },
        { label: T.colMean, value: "mean", format: (v) => formatSetting(v) },
        { label: T.colSd, value: "sd", format: (v) => formatSetting(v) },
      ],
      rows: [{ unit: CONFIG.units[0], mean: r.muA, sd: r.sdA }, { unit: CONFIG.units[1], mean: r.muB, sd: r.sdB }],
    },
    ...frame(C.heightTop),
    x: { domain: [lo, hi], label: T.xTop },
    y: yAxis(ymax),
    marks: (c, P) => [...topMarks(c, P, r, domain, ymax, geometry), ...extraMarks(extra, c, P)],
    keyboard: keyboard ? {
      data: peaks, x: "x", y: "y", key: "key", sort: false, label: T.kbTop,
      title: (d) => `${T.kbUnit}${d.key}${T.kbMean}${formatSetting(d.mean)}${T.kbSd}${formatSetting(d.sd)}.`,
    } : undefined,
  });
}

/**
 * The peak label of a difference posterior d = { mean, sd } on [lo, hi]: at the peak, 9 px above; a peak within 12%
 * of the span from 0 has its label beside it (6 px), on the side away from the line at 0.
 */
export function diffLabel({ mean, sd }, [lo, hi], text = T.diffLabel) {
  const nearZero = Math.abs(mean) < C.overlap * (hi - lo);
  const side = mean >= 0 ? 1 : -1;
  return { x: mean, y: normalPdf(0) / sd, text, dx: nearZero ? side * C.piDx : 0, anchor: nearZero ? (side > 0 ? "start" : "end") : "middle" };
}

/**
 * The marks of a difference posterior d = { mean, sd } on [lo, hi] (a domain that holds 0): the area above 0 in
 * blues-3, the baseline, the density (navy, dash-dot "9,3,2,3", width 2), the rule at 0 (axis ink, width 2) and the
 * bold peak label (diffLabel) with a halo. options: label (default "A − B"; null for none), dash, width, shade
 * (false: no area).
 */
export function diffMarks(c, P, { mean, sd }, [lo, hi], { label = T.diffLabel, dash = C.dashDiff, width = C.line, shade = true } = {}) {
  const d = densityPoints(mean, sd, lo, hi, [0, mean]);
  const peak = label ? diffLabel({ mean, sd }, [lo, hi], label) : null;
  return [
    shade ? P.areaY(d.filter((p) => p.x >= 0), { x: "x", y: "y", fill: c.blues[2] }) : null,
    P.ruleY([0], { stroke: c.plotAxis }),
    P.lineY(d, { x: "x", y: "y", stroke: c.post, strokeWidth: width, strokeDasharray: dash }),
    P.ruleX([0], { stroke: c.plotAxis, strokeWidth: C.line }),
    peak ? P.text([peak], { x: "x", y: "y", text: "text", dx: peak.dx, dy: C.labelDy, textAnchor: peak.anchor, fill: c.plotFg, fontWeight: "bold",
      stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke" }) : null,
  ].filter(Boolean);
}

/**
 * The chart.js formula labels of the two areas: "π_AB →" right of 0 and "← π_BA" left of it, at 93% of ymax. When
 * one side of 0 has too little room for its label (in a figure of the given width), both labels sit on the other
 * side, on one line, each arrow still pointing to its area.
 */
export function areaLabels([lo, hi], ymax, { width = CHART.defaultWidth } = {}) {
  const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
  const zero = ((0 - lo) / (hi - lo)) * innerW;
  const need = C.piLabelWidth + C.piDx;
  const far = C.piDx + C.piLabelWidth + C.piDx;
  const y = C.labelTop * ymax;
  const ab = { key: "ab", tex: CONFIG.tex.areaAB, x: 0, y, anchor: "start", dx: C.piDx };
  const ba = { key: "ba", tex: CONFIG.tex.areaBA, x: 0, y, anchor: "end", dx: -C.piDx };
  if (zero < need) return [{ ...ab, dx: far }, { ...ba, anchor: "start", dx: C.piDx }];
  if (innerW - zero < need) return [{ ...ab, anchor: "end", dx: -C.piDx }, { ...ba, dx: -far }];
  return [ab, ba];
}

/**
 * The lower figure in el for a compute() result r: diffMarks for the difference (mean = the gap, SD = √(SD_A² +
 * SD_B²)) on the shared domain and y scale, the MathML labels "π_AB →" and "← π_BA" (areaLabels), the hidden table
 * "Posterior mean and SD of the difference A minus B" and keyboard points at the peak and at the two areas.
 * options: marks(c, P) for extra marks drawn last, keyboard (false: none). Returns the chart.plot handle.
 */
export function drawDiff(el, r, domain = sharedDomain(r), ymax = sharedYMax(r), { marks: extra, keyboard = true } = {}) {
  const [lo, hi] = domain;
  const y = C.labelTop * ymax;
  const dx = C.areaDx * (hi - lo);
  const points = [
    { key: "diff", x: r.gap, y: normalPdf(0) / r.sdDiff, title: `${T.kbDiff1}${fmtGap(r.gap)}${T.kbSd}${fmtSd(r.sdDiff)}.` },
    { key: "above", x: Math.min(dx, hi / 2), y, title: `${T.kbAbove}${probText(r.pi)}.` },
    { key: "below", x: Math.max(-dx, lo / 2), y, title: `${T.kbBelow}${probText(r.piReverse)}.` },
  ];
  return plot(el, {
    alt: T.altDiff,
    table: {
      caption: T.tableDiff,
      columns: [
        { label: T.colQuantity, value: "q" },
        { label: T.colMean, value: "mean", format: (v) => fmtGap(v) },
        { label: T.colSd, value: "sd", format: (v) => fmtSd(v) },
      ],
      rows: [{ q: T.diffRow, mean: r.gap, sd: r.sdDiff }],
    },
    ...frame(C.heightDiff),
    x: { domain: [lo, hi], label: T.xDiff },
    y: yAxis(ymax),
    marks: (c, P) => [...diffMarks(c, P, { mean: r.gap, sd: r.sdDiff }, domain), ...extraMarks(extra, c, P)],
    formulas: areaLabels(domain, ymax, { width: plotWidth(el) }),
    keyboard: keyboard ? { data: points, x: "x", y: "y", key: "key", sort: false, label: T.kbDiff, title: (d) => d.title } : undefined,
  });
}

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    keys: unitKeys(),
    build(ctx) {
      const { h } = ctx;
      const num = (raw, display, name) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };

      // --- controls: one fieldset per unit
      const units = unitControls(ctx);
      ctx.controls.append(...units.roots);

      // --- figures: the two posteriors, then the posterior of the difference on the same scales
      ctx.charts.classList.add("prx-two-units-charts");
      const topSlot = h("div", { class: "prx-two-units-panel" });
      const diffSlot = h("div", { class: "prx-two-units-panel" });
      ctx.charts.append(h("div", { class: "prx-two-units-panels prx-two-units-stacked" }, topSlot, diffSlot));

      // --- formula: the general formula with its symbols in words, the formula at these settings, the reverse line
      const tex = (name, label) => ctx.scrollRegion(h("div", { class: "prx-two-units-tex", "data-prx-tex": name }), label);
      const general = tex("general", T.regionGeneral);
      const worked = tex("worked", T.regionWorked);
      const reverse = tex("reverse", T.regionReverse);
      const gloss = h("p", { class: "prx-two-units-note" },
        piName(h, "AB"), T.glossA, symName(h, "θ", "A"), T.glossB, symName(h, "θ", "B"), T.glossC, h("i", { text: "Y" }), T.glossD,
        "Φ(", h("i", { text: "z" }), T.glossPhiA, ctx.num(0, formatSetting(0)), T.glossPhiB, ctx.num(1, formatSetting(1)), T.glossPhiC,
        h("i", { text: "z" }), ".");
      const head = (text) => ctx.panelTitle(text, { className: "prx-two-units-head" });
      const formula = ctx.part("formula", h("div", { class: "prx-two-units-formula" },
        h("div", { class: "prx-two-units-formula-grid" },
          h("div", { class: "prx-two-units-step" }, head(T.general), general, gloss),
          h("div", { class: "prx-two-units-step" }, head(T.worked), worked),
          h("div", { class: "prx-two-units-step" }, reverse, h("p", { class: "prx-two-units-note", text: T.reverseNote })))));
      ctx.root.insertBefore(formula, ctx.readout.node);
      renderTex(general, CONFIG.tex.general, { display: true });
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));

      /** "is π_AB = .760", or ", π_AB, is above .999" when the probability shows as a bound. */
      function probPhrase(raw, pair, name, plain, bound) {
        const s = probText(raw);
        return CONFIG.boundWords.test(s)
          ? [bound, piName(h, pair), T.readIs, num(raw, s, name)]
          : [plain, piName(h, pair), " = ", num(raw, s, name)];
      }

      return {
        render(state) {
          units.set(state);
          const r = compute(state);
          const x = sharedDomain(r);
          const ymax = sharedYMax(r);
          drawTop(topSlot, r, x, ymax);
          drawDiff(diffSlot, r, x, ymax);
          const w = workedTex(r);
          renderTex(worked, w.tex, { display: true, nums: w.raws });
          const v = reverseTex(r);
          renderTex(reverse, v.tex, { display: true, nums: v.raws });
          const size = Math.abs(r.z);
          const apart = num(size, formatDecimal(size, { digits: CONFIG.digits.z }), "z");
          ctx.readout.set([
            ...probPhrase(r.pi, "AB", "pi", T.readA, T.readBoundA),
            ...probPhrase(r.piReverse, "BA", "pi-reverse", T.readB, T.readBoundB), ". ",
            T.readC, num(r.gap, fmtGap(r.gap), "diff-mean"),
            T.readD, num(r.sdDiff, fmtSd(r.sdDiff), "diff-sd"),
            ...(r.z === 0 ? [T.readEqual, apart, T.readApart] : [T.readE, apart, r.z > 0 ? T.readAbove : T.readBelow]),
          ]);
        },
      };
    },
  });
}
