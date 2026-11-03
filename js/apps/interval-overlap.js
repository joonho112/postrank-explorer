// interval-overlap (app 1.11): "Intervals do not decide directions". Ported from postrank Explorer v1 L-06
// (js/widgets/interval-overlap.js and styles/widgets/interval-overlap.css), its view "Two units with equal SDs" in full,
// without the prediction gate: the posterior of the difference and the probability, which the gate held back, are shown
// at once. The widget's other view, the simulated league, is app 1.12 (overlap-in-the-league), which imports the
// interval drawing and the pair card below.
//
// Two units with independent normal posteriors and equal SDs: each posterior has SD 1, B's posterior mean is 0 and A's
// is `gap` posterior SDs above it; gap "touch" is the exact distance at which A's lower end meets B's upper end at the
// level chosen. One state { level, gap } drives every part:
//   intervals   the two central posterior intervals at the level (engine normalInterval), A above B, each with end
//               ticks and a dot at its posterior mean; a gray band with a thin edge where they overlap (only then) and
//               a dashed line where they just touch (only then)
//   difference  the posterior of A − B on the same x scale (its mean, SD and the area above zero from engine
//               pairDifference, the density from normalPdf), with the area above zero shaded: the probability that A's
//               true value is larger than B's (a double of 1 reads "above .999": formatProb with open)
//   pair card   the intervals (they touch, overlap by an amount, or lie apart; the four ends) beside the direction (the
//               probability, and the distance between the posterior means in SDs of the difference)
//   read-out    the level, the distance between the posterior means and the probability
// Keys: level (90 or 95; other values are ignored) and gap ("touch" in any case, or a distance in posterior SDs clamped
// to [0, 5]; the slider stores a number, and "touch" follows the level). The app loads on the first preset, v1's
// default: 90% intervals that just touch.
//
// Exports for 1.12 overlap-in-the-league (the league view of the same v1 widget):
//   CONFIG                    keys, digits, the touch figures' geometry, the shared league styles and every string
//   parseGap(v), touchSetting(levelPct, gapKey), statusOf(amount, touching)   the gap key, the touch numbers, the
//                             status rule (touch within CONFIG.touch.tol, overlap when the amount is positive, else apart)
//   densityPoints(mu, sd, lo, hi, extra)   points of a normal density (engine normalPdf), x in increasing order
//   fill(template, slots), words(template, slots)   "{slot}" templates filled with nodes, or as plain text
//   textKit(ctx)              number nodes with an optional read-out hook (data-prx-readout): prob (a direction
//                             probability of normal posteriors, strictly inside (0, 1): formatProb with open), dec,
//                             count, pct, setting; unitName(id) (data-prx-name)
//   intervalMarks(c, P, rows, options)   the interval drawing as Plot marks: rows [{ y, lower, upper, mean, name,
//                             strong }] each drawn as a navy line from its lower to its upper end with a dot at its
//                             posterior mean and its name at the left (bold); rows with strong: false are drawn light
//                             navy (options.weak, opacity .6: at least 3:1 against the plot paper in both themes); end
//                             ticks with options.ticks; options.nameRender(rows) is a Plot render hook for the names
//                             (to tag them with data-prx-name)
//   overlapMarks(c, P, { from, to, y1, y2, band, lines, outline })   the gray band from `from` to `to` (only when band
//                             is true; with outline, a thin plot-muted edge, since the band's fill alone is faint) and
//                             dashed lines at the x positions in `lines`, both from y1 to y2
//   keyItem(ctx, swatch, content)   one item of a figure key; swatches "line", "line-dim", "band", "band-outline",
//                             "dash", "shade"
//   appLink(ctx, name, { title, className })   base.js's appLink, re-exported: an app's title as a link to its page
//                             once the catalog marks it built and links work here (a site page or a standalone
//                             embed), else the title in quotes; this app and 1.12 pass className CONFIG.linkClass
//   keyNode(ctx)              an empty figure key on the plot panel (data-prx-part legend)
//   pairCard(ctx)             the pair card, two cells "The intervals" and "The direction" side by side when there is
//                             room; set({ intervals, direction }) writes them, each a list of lines: content, or
//                             { content, status } (the bold status line, data-prx-status), { content, pi } (the
//                             probability line, class prx-io-pi) or { content, hint }
//   drawIntervals(el, t), drawDifference(el, t)   this app's two figures (with their hidden tables and keyboard)
//   cssFor(rootClass)         the CSS of the controls group, headings, keys, swatches and pair card under another
//                             root class (an app that shows them adds it to its own css)
import { appLink, createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatPercent, formatProb, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { normalInterval, normalPdf, pairDifference } from "../pr-core.js";

export { appLink };

export const CONFIG = Object.freeze({
  name: "interval-overlap",
  label: "Intervals do not decide directions: whether two posterior intervals overlap, beside the probability that one unit's true value is larger than the other's",
  className: "prx-io",
  levels: Object.freeze([90, 95]),
  percent: 100,
  defaults: Object.freeze({ level: 90, gap: "touch" }),
  // each posterior has SD `sd` and B's posterior mean is `meanB`; gap = A's posterior mean (posterior SDs); "touch"
  // within `tol` of zero overlap
  touch: Object.freeze({ sd: 1, meanB: 0, word: "touch", tol: 1e-9 }),
  gap: Object.freeze({ min: 0, max: 5, step: 0.01 }),
  digits: Object.freeze({ end: 3, gap: 3, sd: 3, z: 3, value: 3, amount: 3 }),
  // density curves: an even grid over the axis and a denser one within `reach` SDs of the mean; y headroom over the peak
  grid: Object.freeze({ base: 121, dense: 81, reach: 4, headroom: 1.15 }),
  touchChart: Object.freeze({
    domain: Object.freeze([-4, 9]), ticks: Object.freeze([-4, -2, 0, 2, 4, 6, 8]),
    heightTop: 150, heightDiff: 170, marginTop: 24, marginBottom: 38, marginLeft: 30, marginRight: 14,
    rowA: 2, rowB: 1, rowPad: 0.62, tick: 0.16, band: 0.34, line: 3, dot: 4.5, nameDx: 8,
    halo: 3, diffLine: 2, dashDiff: "9,3,2,3", guide: "4,3", labelDy: -9,
  }),
  // dimmed rows of intervalMarks (v1's league: the units not chosen), drawn light navy: navy at this opacity keeps at
  // least 3:1 against the plot paper, light and dark
  weak: Object.freeze({ line: 1.6, dot: 2.6, opacity: 0.6 }),
  // the overlap band's thin edge (overlapMarks with outline)
  bandEdge: 1,
  // the class of a link to another app's page (appLink; its colours are in cssFor)
  linkClass: "prx-io-app",
  text: Object.freeze({
    levelLegend: "Interval level",
    gapLabel: "Distance between the two posterior means (posterior SDs)",
    gapHint: "Each posterior has SD {sd}, and B's posterior mean is at zero.",
    touchButton: "Make the intervals just touch",
    // upper figure
    topHead: "Two posterior intervals",
    xTop: "True value, in posterior SDs",
    // v1's alt text, with only the part that is drawn at the status shown
    altTop: "The central posterior intervals of unit A (upper line) and unit B (lower line), each with a dot at its posterior mean{status}",
    altStatus: Object.freeze({
      overlap: "; a shaded band marks where the two intervals overlap.",
      touch: "; a dashed line marks the point where they touch.",
      apart: "; the two intervals do not overlap.",
    }),
    tableTop: "Posterior mean, SD and interval ends of each unit, in posterior SDs",
    kbdTop: "Two posterior intervals: one point per unit, and one where the intervals overlap, touch or lie apart",
    kbdUnit: "{unit}: posterior mean {mean}, posterior SD {sd}, {level} interval from {lower} to {upper}.",
    kbdBetween: Object.freeze({
      touch: "The two intervals touch at {at}.",
      overlap: "The two intervals overlap from {from} to {to}: {amount} posterior SDs.",
      apart: "Between the two intervals, from {from} to {to}: {amount} posterior SDs.",
    }),
    keyInterval: "navy line: a unit's {level} posterior interval, with a dot at its posterior mean",
    keyOverlap: "gray band: where the two intervals overlap",
    keyTouch: "dashed line: the point where the two intervals touch",
    // lower figure
    diffHead: "The posterior of the difference, A minus B",
    xDiff: "A's true value minus B's, in posterior SDs",
    diffName: "A − B",
    altDiff: "Posterior density of the difference of the two true values, A minus B (dash-dot line), on the same x scale as the upper figure; the area to the right of zero is shaded; it is the probability that A's true value is larger than B's.",
    tableDiff: "Posterior mean and SD of the difference A minus B, and the probability that it is above zero",
    kbdDiff: "The posterior of the difference, A minus B: one point at zero and one at its posterior mean",
    kbdZero: "Zero: to its right A's true value is larger than B's; the shaded area there is {pi}.",
    kbdPeak: "A − B: posterior mean {mean}, posterior SD {sd}.",
    keyShade: "shaded: the area above zero, the chance that A's true value is larger than B's ({pi})",
    colUnit: "Unit",
    colQuantity: "Quantity",
    colMean: "Posterior mean",
    colSd: "Posterior SD",
    colLower: "Lower end",
    colUpper: "Upper end",
    colAbove: "Probability above zero",
    diffRow: "A minus B",
    unitWord: Object.freeze({ A: "A", B: "B" }),
    // pair card
    cardIntervals: "The intervals",
    cardDirection: "The direction",
    touchEnds: "A: {aLower} to {aUpper}. B: {bLower} to {bUpper} (posterior SDs).",
    statusTouch: "They just touch.",
    statusOverlap: "They overlap by {amount} posterior SDs.",
    statusApart: "They do not overlap: {amount} posterior SDs lie between them.",
    cardPi: "Chance that {a}'s true value is larger than {b}'s: {pi}",
    cardSd: "The difference A − B has SD √{var} = {sd}, less than {sum}, the sum of the two posterior SDs, so the posterior means are {z} SDs of the difference apart.",
    // {app}: the title of app 1.8, a link once it is built (appLink)
    cardNext: "The app {app} shows how this probability is computed.",
    twoUnits: Object.freeze({ app: "two-units", title: "Two units, one probability" }),
    // read-out (one aria-live region)
    readTouch: Object.freeze({
      touch: "The {level} intervals just touch: the posterior means are {gap} posterior SDs apart.",
      overlap: "The {level} intervals overlap by {amount} posterior SDs: the posterior means are {gap} posterior SDs apart.",
      apart: "The {level} intervals do not overlap: the posterior means are {gap} posterior SDs apart.",
    }),
    readPi: " The chance that {a}'s true value is larger than {b}'s is {pi}.",
    // caption: the teaching-posterior caption of labels.js, then the scope of this app
    captionScope: "Two independent normal posteriors with equal SDs; computed in this browser.",
  }),
});

const T = CONFIG.text;
const TC = CONFIG.touchChart;

// ---------------------------------------------------------------------------------------------- numbers

/** The gap key: the word "touch" (any case), or a distance in posterior SDs clamped to CONFIG.gap; anything else is
 * unreadable (undefined keeps the old value). */
export function parseGap(v) {
  if (typeof v === "string" && v.trim().toLowerCase() === CONFIG.touch.word) return CONFIG.touch.word;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(CONFIG.gap.max, Math.max(CONFIG.gap.min, n));
}

/** "touch" when the intervals are said to touch or meet within CONFIG.touch.tol, "overlap" when they share a stretch
 * (amount > 0), else "apart". amount = the upper end of the lower interval minus the lower end of the higher one. */
export function statusOf(amount, touching = false) {
  return touching || Math.abs(amount) <= CONFIG.touch.tol ? "touch" : amount > 0 ? "overlap" : "apart";
}

/** Everything the touch view shows at one level (90 or 95) and gap key ("touch" or a distance in posterior SDs). */
export function touchSetting(levelPct, gapKey) {
  const { sd, meanB, word } = CONFIG.touch;
  const level = levelPct / CONFIG.percent;
  const B = normalInterval(meanB, sd, level);
  // A's posterior mean when A's lower end meets B's upper end: the upper end of an interval centered on that point
  const touchGap = normalInterval(B.upper, sd, level).upper;
  const touching = gapKey === word;
  const gap = touching ? touchGap : gapKey;
  const A = normalInterval(gap, sd, level);
  const amount = B.upper - A.lower;
  // the difference A − B of two independent normal posteriors (engine pairDifference): its mean, its SD √(sd² + sd²),
  // z (the distance between the posterior means in that SD) and the probability above zero. varDiff is the sum of the
  // two variances under the card's root sign, sdSum the sum of the two SDs it is compared with
  const diff = pairDifference(gap, sd, meanB, sd);
  return {
    levelPct, level, A, B, sd, meanB, gap, touchGap, touching, amount, status: statusOf(amount, touching),
    meanDiff: diff.mean, varDiff: sd * sd + sd * sd, sdDiff: diff.sd, sdSum: sd + sd, z: diff.z, pi: diff.pi,
  };
}

function evenGrid(lo, hi, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(lo + ((hi - lo) * i) / (count - 1));
  return out;
}

/** Points of the normal density with mean mu and SD sd over [lo, hi] (engine normalPdf), x values in increasing order;
 * `extra` adds x values that must be on the curve (zero, the mean). */
export function densityPoints(mu, sd, lo, hi, extra = []) {
  const { base, dense, reach } = CONFIG.grid;
  const xs = [...evenGrid(lo, hi, base), ...evenGrid(Math.max(lo, mu - reach * sd), Math.min(hi, mu + reach * sd), dense), ...extra]
    .filter((x) => x >= lo && x <= hi)
    .sort((p, q) => p - q);
  const out = [];
  for (const x of xs) if (!out.length || x > out[out.length - 1].x) out.push({ x, y: normalPdf((x - mu) / sd) / sd });
  return out;
}

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

/** The same template as plain text (keyboard titles, aria labels). */
export const words = (template, slots) => String(template).replace(/\{(\w+)\}/g, (all, k) => (k in slots ? String(slots[k]) : all));

/** A direction probability of normal posteriors as text: it lies strictly inside (0, 1), so formatProb is told so
 *  (open) and writes a double of exactly 0 or 1 as "below .001" or "above .999". */
const probText = (raw) => formatProb(raw, { open: true });

/** Number nodes of one app (its ctx): every number on screen is a data-num span, with an optional read-out hook. */
export function textKit(ctx) {
  const tagged = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
  return {
    tagged,
    prob: (raw, name) => tagged(ctx.num(raw, probText(raw)), name),
    dec: (raw, digits, name) => tagged(ctx.num(raw, formatDecimal(raw, { digits })), name),
    count: (raw, name) => tagged(ctx.num(raw, formatCount(raw)), name),
    pct: (levelPct, name) => tagged(ctx.num(levelPct / CONFIG.percent, formatPercent(levelPct / CONFIG.percent)), name),
    setting: (raw, name) => tagged(ctx.num(raw, formatSetting(raw)), name),
    unitName: (id) => ctx.h("span", { "data-prx-name": id, text: id }),
  };
}

// ---------------------------------------------------------------------------------------------- drawing

/** The interval drawing as Plot marks (see the header). Dimmed rows are drawn first, so the strong ones sit on top. */
export function intervalMarks(c, P, rows, {
  ticks = false, line = TC.line, dot = TC.dot, tick = TC.tick, nameDx = TC.nameDx, weak = CONFIG.weak, nameRender,
} = {}) {
  const strong = rows.filter((r) => r.strong !== false);
  const dim = rows.filter((r) => r.strong === false);
  const layer = (list, s) => {
    if (!list.length) return [];
    const ends = ticks ? list.flatMap((r) => [{ x: r.lower, y: r.y }, { x: r.upper, y: r.y }]) : [];
    return [
      P.ruleY(list, { y: "y", x1: "lower", x2: "upper", stroke: c.post, strokeWidth: s.line, strokeOpacity: s.opacity }),
      ticks ? P.link(ends, { x1: "x", x2: "x", y1: (d) => d.y - tick, y2: (d) => d.y + tick, stroke: c.post, strokeWidth: s.line, strokeOpacity: s.opacity }) : null,
      P.dot(list, { x: "mean", y: "y", r: s.dot, fill: c.post, fillOpacity: s.opacity }),
      P.text(list, {
        y: "y", text: "name", frameAnchor: "left", textAnchor: "end", dx: -nameDx, fill: c.plotFg,
        fontWeight: s.bold ? "bold" : "normal", render: nameRender ? nameRender(list) : undefined,
      }),
    ];
  };
  return [
    ...layer(dim, { line: weak.line, dot: weak.dot, opacity: weak.opacity, bold: false }),
    ...layer(strong, { line, dot, opacity: 1, bold: true }),
  ].filter(Boolean);
}

/** The gray band where two intervals overlap (only when band is true; with outline, a thin plot-muted edge) and dashed
 * lines at `lines`, from y1 to y2. */
export function overlapMarks(c, P, { from, to, y1, y2, band = to > from, lines = [], outline = false } = {}) {
  const edge = outline ? { stroke: c.plotMuted, strokeWidth: CONFIG.bandEdge } : {};
  return [
    band ? P.rect([{ x1: from, x2: to }], { x1: "x1", x2: "x2", y1: () => y1, y2: () => y2, fill: c.plotGrid, ...edge }) : null,
    lines.length ? P.ruleX(lines, { y1: () => y1, y2: () => y2, stroke: c.plotAxis, strokeDasharray: TC.guide }) : null,
  ].filter(Boolean);
}

const SWATCH = Object.freeze({
  line: "prx-io-swatch-line", "line-dim": "prx-io-swatch-line prx-io-swatch-dim", band: "prx-io-swatch-band",
  "band-outline": "prx-io-swatch-band prx-io-swatch-edge", dash: "prx-io-swatch-dash", shade: "prx-io-swatch-shade",
});

/** One item of a figure key: a swatch of the figure's marks and its words (text or nodes). */
export function keyItem(ctx, swatch, content) {
  const { h } = ctx;
  return h("span", { class: "prx-io-key-item" }, h("span", { class: SWATCH[swatch] ?? SWATCH.line, "aria-hidden": "true" }), h("span", {}, content));
}

/** An empty figure key on the plot panel (fill it with keyItem nodes). */
export const keyNode = (ctx) => ctx.h("p", { class: "prx-io-key", "data-prx-part": "legend" });

/** The pair card (see the header). Returns { root, intervals, direction, set({ intervals, direction }) }. */
export function pairCard(ctx) {
  const { h } = ctx;
  const intervals = h("div", { class: "prx-io-cell" });
  const direction = h("div", { class: "prx-io-cell prx-io-cell-pi" });
  const root = ctx.part("readout", h("div", { class: "prx-io-pair" }, intervals, direction));
  const line = (l) => {
    if (l === null || l === undefined || l === false) return null;
    if (Array.isArray(l) || typeof l === "string" || l.nodeType) return h("p", {}, l);
    const cls = l.status ? "prx-io-status" : l.pi ? "prx-io-pi" : l.hint ? "prx-hint" : undefined;
    return h("p", { class: cls, "data-prx-status": l.status || undefined }, l.content);
  };
  const head = (text) => h("p", { class: "prx-io-cell-head", text });
  return {
    root, intervals, direction,
    set({ intervals: a = [], direction: b = [] } = {}) {
      intervals.replaceChildren(head(T.cardIntervals), ...a.map(line).filter(Boolean));
      direction.replaceChildren(head(T.cardDirection), ...b.map(line).filter(Boolean));
    },
  };
}

const end3 = (v) => formatDecimal(v, { digits: CONFIG.digits.end });

/** The upper figure: the two intervals at the setting t (touchSetting), with the overlap band or the touching line,
 * its hidden table and a keyboard reading (each unit, then where the intervals overlap, touch or lie apart). */
export function drawIntervals(el, t) {
  const [lo, hi] = TC.domain;
  const rows = [
    { unit: T.unitWord.A, name: T.unitWord.A, y: TC.rowA, mean: t.gap, sd: t.sd, lower: t.A.lower, upper: t.A.upper },
    { unit: T.unitWord.B, name: T.unitWord.B, y: TC.rowB, mean: t.meanB, sd: t.sd, lower: t.B.lower, upper: t.B.upper },
  ];
  const levelWords = formatPercent(t.level);
  const between = { kind: t.status, x: (t.A.lower + t.B.upper) / 2, y: (TC.rowA + TC.rowB) / 2 };
  const [from, to] = t.status === "apart" ? [t.B.upper, t.A.lower] : [t.A.lower, t.B.upper];
  return plot(el, {
    alt: words(T.altTop, { status: T.altStatus[t.status] }),
    table: {
      caption: T.tableTop,
      columns: [
        { label: T.colUnit, value: "unit" },
        { label: T.colMean, value: "mean", format: (v) => end3(v) },
        { label: T.colSd, value: "sd", format: (v) => formatSetting(v) },
        { label: T.colLower, value: "lower", format: (v) => end3(v) },
        { label: T.colUpper, value: "upper", format: (v) => end3(v) },
      ],
      rows,
    },
    height: TC.heightTop,
    marginTop: TC.marginTop, marginBottom: TC.marginBottom, marginLeft: TC.marginLeft, marginRight: TC.marginRight,
    x: { domain: [lo, hi], ticks: TC.ticks, label: T.xTop, labelAnchor: "center", labelArrow: "none" },
    y: { domain: [TC.rowB - TC.rowPad, TC.rowA + TC.rowPad], axis: null },
    marks: (c, P) => [
      ...overlapMarks(c, P, {
        from: t.A.lower, to: t.B.upper, y1: TC.rowB - TC.band, y2: TC.rowA + TC.band,
        band: t.status === "overlap", lines: t.status === "touch" ? [t.B.upper] : [], outline: true,
      }),
      ...intervalMarks(c, P, rows, { ticks: true }),
    ],
    keyboard: {
      data: [...rows, between],
      x: (d) => (d.kind ? d.x : d.mean),
      y: "y",
      key: (d) => d.kind ? "between" : d.unit,
      label: T.kbdTop,
      title: (d) => (d.kind
        ? words(T.kbdBetween[d.kind], { at: end3(t.B.upper), from: end3(from), to: end3(to), amount: formatDecimal(Math.abs(t.amount), { digits: CONFIG.digits.amount }) })
        : words(T.kbdUnit, { unit: d.unit, mean: end3(d.mean), sd: formatSetting(d.sd), level: levelWords, lower: end3(d.lower), upper: end3(d.upper) })),
    },
  });
}

/** The lower figure: the posterior of A − B at the setting t on the upper figure's x scale, the area above zero shaded,
 * with its hidden table and a keyboard reading (zero, then the posterior mean of the difference). */
export function drawDifference(el, t) {
  const [lo, hi] = TC.domain;
  const mu = t.meanDiff;
  const curve = densityPoints(mu, t.sdDiff, lo, hi, [0, mu]);
  const above = curve.filter((p) => p.x >= 0);
  const peakY = normalPdf(0) / t.sdDiff;
  const peak = { x: mu, y: peakY, text: T.diffName };
  const points = [
    { key: "zero", x: 0, y: normalPdf((0 - mu) / t.sdDiff) / t.sdDiff },
    { key: "mean", x: mu, y: peakY },
  ];
  const sd3 = (v) => formatDecimal(v, { digits: CONFIG.digits.sd });
  return plot(el, {
    alt: T.altDiff,
    table: {
      caption: T.tableDiff,
      columns: [
        { label: T.colQuantity, value: "q" },
        { label: T.colMean, value: "mean", format: (v) => formatDecimal(v, { digits: CONFIG.digits.gap }) },
        { label: T.colSd, value: "sd", format: (v) => sd3(v) },
        { label: T.colAbove, value: "pi", format: (v) => probText(v) },
      ],
      rows: [{ q: T.diffRow, mean: mu, sd: t.sdDiff, pi: t.pi }],
    },
    height: TC.heightDiff,
    marginTop: TC.marginTop, marginBottom: TC.marginBottom, marginLeft: TC.marginLeft, marginRight: TC.marginRight,
    x: { domain: [lo, hi], ticks: TC.ticks, label: T.xDiff, labelAnchor: "center", labelArrow: "none" },
    y: { domain: [0, CONFIG.grid.headroom * peakY], axis: null },
    marks: (c, P) => [
      P.areaY(above, { x: "x", y: "y", fill: c.blues[2] }),
      P.ruleY([0], { stroke: c.plotAxis }),
      P.lineY(curve, { x: "x", y: "y", stroke: c.post, strokeWidth: TC.diffLine, strokeDasharray: TC.dashDiff }),
      P.ruleX([0], { stroke: c.plotAxis, strokeWidth: TC.diffLine }),
      P.text([peak], {
        x: "x", y: "y", text: "text", dy: TC.labelDy, textAnchor: "middle", fill: c.plotFg, fontWeight: "bold",
        stroke: c.plotBg, strokeWidth: TC.halo, paintOrder: "stroke",
      }),
    ],
    keyboard: {
      data: points, x: "x", y: "y", key: "key", label: T.kbdDiff,
      title: (d) => (d.key === "zero"
        ? words(T.kbdZero, { pi: probText(t.pi) })
        : words(T.kbdPeak, { mean: formatDecimal(mu, { digits: CONFIG.digits.gap }), sd: sd3(t.sdDiff) })),
    },
  });
}

// The CSS of the shared parts; %r stands for the root class of the app that shows them.
const CSS_TEMPLATE = `
%r .prx-io-level { flex: 0 1 auto; }
%r .prx-io-level .prx-radio { font-weight: 400; }
%r .prx-io-group { display: flex; flex: 1 1 22rem; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: flex-end; min-width: 0; }
%r .prx-io-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
%r .prx-io-view { min-width: 0; }
%r .prx-io-panel { min-width: 0; }
%r .prx-io-diff { margin-top: 0.75rem; }
%r .prx-io-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0.25rem 0 0; padding: 0.35rem 0.6rem; font-size: 0.9em;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
%r .prx-io-key-item { display: inline-flex; align-items: center; gap: 0.45rem; min-width: 0; }
%r .prx-io-swatch-line, %r .prx-io-swatch-band, %r .prx-io-swatch-dash, %r .prx-io-swatch-shade { flex: none; display: inline-block; box-sizing: border-box; }
%r .prx-io-swatch-line { width: 18px; height: 3px; background: var(--prx-post); }
%r .prx-io-swatch-dim { height: 2px; opacity: 0.6; }
%r .prx-io-swatch-band { width: 14px; height: 12px; background: var(--prx-plot-grid); border-left: 1px dashed var(--prx-plot-axis);
  border-right: 1px dashed var(--prx-plot-axis); }
%r .prx-io-swatch-edge { border: 1px solid var(--prx-plot-muted); }
%r a.prx-io-app { color: var(--prx-link); }
%r a.prx-io-app:hover, %r a.prx-io-app:focus-visible { color: var(--prx-link-hover); }
%r .prx-io-swatch-dash { width: 0; height: 14px; border-left: 2px dashed var(--prx-plot-axis); }
%r .prx-io-swatch-shade { width: 14px; height: 12px; background: var(--prx-blues-3); border: 1px solid var(--prx-post); }
%r .prx-io-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 0.5rem; margin: 0.75rem 0 0; }
%r .prx-io-cell { min-width: 0; padding: 0.4rem 0.75rem; background: var(--prx-bg); border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
%r .prx-io-cell p { margin: 0.2rem 0; }
%r .prx-io-cell-head { font-size: 0.9em; font-weight: 600; color: var(--prx-fg-muted); }
%r .prx-io-status { font-weight: 600; }
%r .prx-io-pi { font-size: 1.05em; font-variant-numeric: tabular-nums; }
`;

/** The CSS of the shared parts under `.rootClass` (an app that shows them adds it to its own css). */
export const cssFor = (rootClass) => CSS_TEMPLATE.replaceAll("%r", `.${rootClass}`);

// ---------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  const D = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: cssFor(CONFIG.className),
    keys: {
      level: { type: "choice", values: CONFIG.levels, value: D.level },
      gap: { type: "custom", value: D.gap, parse: (v) => parseGap(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const k = textKit(ctx);

      // --- controls: the level, the distance and the touch button (the preset row follows them)
      const levelGroup = ctx.radioGroup({
        legend: T.levelLegend, name: "level", value: ctx.state.level, className: "prx-io-level",
        options: CONFIG.levels.map((l) => ({ value: l, label: formatPercent(l / CONFIG.percent) })),
        onChange: (v) => ctx.set({ level: v }),
      });
      const gapSlider = ctx.slider({
        label: T.gapLabel, ...CONFIG.gap, name: "gap",
        hint: fill(T.gapHint, { sd: () => k.setting(CONFIG.touch.sd) }),
        value: touchSetting(ctx.state.level, ctx.state.gap).gap,
        // the distance has one set of digits everywhere: the slider shows 3.290, as the read-out and the card do
        format: (v) => formatDecimal(v, { digits: CONFIG.digits.gap }),
        onInput: (v) => ctx.set({ gap: v }),
      });
      const touchBtn = ctx.button({ label: T.touchButton, key: "touch", onClick: () => ctx.set({ gap: CONFIG.touch.word }) });
      ctx.controls.append(levelGroup.root,
        h("div", { class: "prx-io-group" }, gapSlider.root, h("div", { class: "prx-io-buttons" }, touchBtn.root)));

      // --- figures: the two intervals, and under them the posterior of the difference on the same x scale
      ctx.charts.classList.add("prx-io-charts");
      const topSlot = h("div", { class: "prx-io-panel" });
      const topKey = keyNode(ctx);
      const diffSlot = h("div", { class: "prx-io-panel" });
      const diffKey = keyNode(ctx);
      ctx.charts.append(h("section", { class: "prx-io-view prx-io-touch", "aria-label": T.topHead },
        ctx.panelTitle(T.topHead, { className: "prx-io-heading" }), topSlot, topKey,
        h("div", { class: "prx-io-diff" }, ctx.panelTitle(T.diffHead, { className: "prx-io-heading" }), diffSlot, diffKey)));

      // --- pair card (before the read-out) and caption
      const card = pairCard(ctx);
      ctx.root.insertBefore(card.root, ctx.readout.node);
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), ". ", T.captionScope);

      const amountNode = (t, name) => k.dec(Math.abs(t.amount), CONFIG.digits.amount, name);
      const endSlots = (t, prefix) => ({
        aLower: () => k.dec(t.A.lower, CONFIG.digits.end, `${prefix}a-lower`),
        aUpper: () => k.dec(t.A.upper, CONFIG.digits.end, `${prefix}a-upper`),
        bLower: () => k.dec(t.B.lower, CONFIG.digits.end, `${prefix}b-lower`),
        bUpper: () => k.dec(t.B.upper, CONFIG.digits.end, `${prefix}b-upper`),
      });

      function writeKeys(t) {
        const items = [keyItem(ctx, "line", fill(T.keyInterval, { level: () => k.pct(t.levelPct) }))];
        if (t.status === "overlap") items.push(keyItem(ctx, "band-outline", T.keyOverlap));
        if (t.status === "touch") items.push(keyItem(ctx, "dash", T.keyTouch));
        topKey.replaceChildren(...items);
        diffKey.replaceChildren(keyItem(ctx, "shade", fill(T.keyShade, { pi: () => k.prob(t.pi, "diff-pi") })));
      }

      function writeCard(t) {
        const status = t.status === "touch" ? T.statusTouch
          : fill(t.status === "overlap" ? T.statusOverlap : T.statusApart, { amount: () => amountNode(t, "card-amount") });
        card.set({
          intervals: [
            { status: t.status, content: status },
            fill(T.touchEnds, endSlots(t, "card-")),
          ],
          direction: [
            { pi: true, content: fill(T.cardPi, { a: T.unitWord.A, b: T.unitWord.B, pi: () => k.prob(t.pi, "card-pi") }) },
            fill(T.cardSd, {
              var: () => k.setting(t.varDiff, "diff-var"), sd: () => k.dec(t.sdDiff, CONFIG.digits.sd, "diff-sd"),
              sum: () => k.setting(t.sdSum, "sd-sum"),
              z: () => k.dec(t.z, CONFIG.digits.z, "diff-z"),
            }),
            { hint: true, content: fill(T.cardNext, { app: () => appLink(ctx, T.twoUnits.app, { title: T.twoUnits.title, className: CONFIG.linkClass }) }) },
          ],
        });
      }

      function writeReadout(t) {
        ctx.readout.set([
          ...fill(T.readTouch[t.status], {
            level: () => k.pct(t.levelPct, "level"), gap: () => k.dec(t.gap, CONFIG.digits.gap, "gap"),
            amount: () => amountNode(t, "amount"),
          }),
          ...fill(T.readPi, { a: T.unitWord.A, b: T.unitWord.B, pi: () => k.prob(t.pi, "pi") }),
        ]);
      }

      return {
        render(state) {
          levelGroup.set(state.level);
          const t = touchSetting(state.level, state.gap);
          gapSlider.set(t.gap);
          drawIntervals(topSlot, t);
          drawDifference(diffSlot, t);
          writeKeys(t);
          writeCard(t);
          writeReadout(t);
        },
      };
    },
  });
}
