// chart.js: the Observable Plot wrapper every widget figure goes through.
// Plot 0.6.17 and D3 7.9.0 are vendored classic globals (js/vendor/); this module reads `Plot` from the window that
// owns the chart element, else from globalThis.
//
//   import { plot, numText } from "./chart.js";
//   const fig = plot(ctx.charts, {
//     alt: "Posterior means of six units with 95% intervals",          // or table: {...} (one of the two is required)
//     table: { caption: "Posterior means", columns: [{ label: "Unit", value: "id" },
//                                                    { label: "Mean", value: "m", format: (v) => formatDecimal(v) }], rows },
//     y: { domain: [0, 1] },
//     marks: (c, P) => [P.dot(rows, { x: "id", y: "m", fill: c.post }), numText(rows, { x: "id", y: "m", value: "m", format: (v) => formatProb(v) })],
//     formulas: [{ tex: "\\hat\\theta_i", x: "A", y: 0.9, anchor: "start" }],
//     keyboard: { data: rows, x: "id", y: "m", title: (d) => `${d.id}: mean ${formatDecimal(d.m)}` },
//   });
//
// plot(el, options) -> { figure, svg, area, legends, table, scale(name), palette, exportSVG(), toPNG(), destroy() }
//   Colours. Any string "var(--prx-…[, fallback])" in the scale options, style and SVG output is resolved to a
//     concrete colour as seen from inside the plot panel (a hidden .prx-light-panel probe in the chart: CSS custom
//     property, then the var() fallback, then CONFIG.tokens, the light values of styles/tokens.css). The panel is
//     light paper in every theme, so text inks (--prx-fg, --prx-fg-muted, --prx-err-text, --prx-wh-text,
//     --prx-est-text, --prx-post-text) resolve to the panel inks of base.css there, never to dark-theme chrome inks
//     (A2-02); data colours and --prx-plot-* are the same as seen from `el`. `marks` may be a function (palette, Plot) -> marks, so channel colours can use
//     the resolved palette. Plot cannot use var() itself: a ramp legend or an interpolated scale turns it into
//     black, and canvas and PNG output have no CSS at all.
//   Figure shape. Plot.plot returns <figure> when a legend or caption is present and <svg> otherwise; the wrapper
//     always returns { figure: <figure class="prx-figure">, svg: the main plot <svg> }. Legends carry
//     data-prx-part="legend" (present mode can hide them).
//   Text alternative. `alt` (the svg's accessible name) or `table` (a visually hidden data table after the figure,
//     numbers with data-num) is required; with only a table, the alt text is its caption. The main svg is role="img"
//     and its children are aria-hidden="true", so Plot's inner groups stay out of the accessibility tree.
//     A record array also works as `table`: columns retain all record fields, categorical IDs, numeric vectors
//     and missing values. Use the explicit schema above for descriptive headers and quantity-specific formats.
//   Ticks. Numeric axes get house-style tick labels (format.tickLabel) with data-num. Log axes are drawn by the
//     wrapper: Plot 0.6.17 blanks the labels of 5 × 10^k ticks on a log scale whatever tickFormat says, so the
//     wrapper places the ticks itself (CONFIG.logMantissas, or scale.ticks) and writes them through the axis mark's
//     text channel ("1", "5", "50", "500", "1,000", "10⁵", "5 × 10⁵").
//   Keyboard. Plot's tip mark answers the pointer only. options.keyboard adds one Tab stop over the plot: arrow keys
//     move through the points (roving tabindex), each point button is named by title(d), and a visible tip shows
//     the same text. A figure with a pointer tip and no keyboard option logs a warning. For a grid (a matrix whose
//     points are given row by row), keyboard.columns = n keeps the data order and makes Up and Down move one row instead of one point;
//     keyboard.virtual=true reads all points through one movable focus button for dense canvas matrices;
//     keyboard.onFocus(d, i) is called when a point is shown (to link the figure to a table, for example).
//   Formulas. options.formulas places MathML labels (math.js renderTex) in an HTML layer over the plot, in data
//     coordinates (x, y) or in fractions of the plot (left, top).
//   Re-drawing the same element keeps the keyboard position and gives focus back after the redraw.
//
// canvasLayer(chart, draw) paints large clouds on a <canvas> under the svg marks with resolved
//   colours: draw(context2d, { x, y, palette, width, height }). exportSVG(chart) -> standalone SVG text (concrete
//   colours, a background rect); toPNG(chart, { scale }) -> Promise of a PNG data URL (browser only).

import { keepFocus, scrollRegion } from "./base.js";
import { dataNum, formatSci, formatTuple, setNum, tickLabel } from "./format.js";
import { renderTex } from "./math.js";

export const CONFIG = Object.freeze({
  defaultWidth: 640,
  minWidth: 200,
  fontSize: 12,
  logMantissas: Object.freeze([1, 5]),
  logPlainMin: 0.001,
  logPlainMax: 10000,
  logEpsilon: 1e-9,
  logPrecision: 15,
  maxLogDecades: 40,
  maxVarDepth: 8,
  percent: 100,
  colorAttributes: Object.freeze(["fill", "stroke", "color", "stop-color", "flood-color", "lighting-color"]),
  positionAxes: Object.freeze(["x", "y", "fx", "fy"]),
  axisLabelKeys: Object.freeze(["label", "labelAnchor", "labelArrow", "labelOffset"]),
  scaleKeys: Object.freeze(["x", "y", "fx", "fy", "color", "opacity", "r", "symbol", "length"]),
  // The light values of styles/tokens.css (:root). Used only when the stylesheet is missing (a test, a bare page);
  // verification/tests/shared.test.mjs checks that every entry equals tokens.css.
  tokens: Object.freeze({
    "--prx-bg": "#fdfbf6", "--prx-bg-raised": "#f3f1e8", "--prx-fg": "#343b36", "--prx-fg-muted": "#5c6560",
    "--prx-link": "#3c6657", "--prx-accent": "#17645E", "--prx-focus": "#17645E", "--prx-border-strong": "#7f857e",
    "--prx-plot-bg": "#ffffff", "--prx-plot-fg": "#1f2421", "--prx-plot-muted": "#4d4d4d", "--prx-plot-axis": "#333333",
    "--prx-plot-grid": "#e5e5e5", "--prx-cell-border": "#767676", "--prx-hatch": "#6b6b6b",
    "--prx-label-dark": "#111111", "--prx-label-light": "#ffffff", "--prx-plot-focus": "#111111", "--prx-plot-focus-halo": "#ffffff",
    "--prx-est": "#D55E00", "--prx-post": "#1f3a5f",
    "--prx-rel-above": "#0072B2", "--prx-rel-withheld": "#cccccc", "--prx-rel-below": "#E69F00",
    "--prx-err": "#D55E00", "--prx-wh": "#6b6b6b", "--prx-err-text": "#b04800", "--prx-wh-text": "#6b6b6b",
    "--prx-est-text": "#b04800", "--prx-post-text": "#1f3a5f",
    "--prx-blues-1": "#EFF3FF", "--prx-blues-2": "#C6DBEF", "--prx-blues-3": "#9ECAE1", "--prx-blues-4": "#6BAED6",
    "--prx-blues-5": "#4292C6", "--prx-blues-6": "#2171B5", "--prx-blues-7": "#084594",
    "--prx-purples-1": "#F2F0F7", "--prx-purples-2": "#DADAEB", "--prx-purples-3": "#BCBDDC", "--prx-purples-4": "#9E9AC8",
    "--prx-purples-5": "#807DBA", "--prx-purples-6": "#6A51A3", "--prx-purples-7": "#4A1486",
    "--prx-neutral-1": "#F7F7F7", "--prx-neutral-2": "#D9D9D9", "--prx-neutral-3": "#BDBDBD", "--prx-neutral-4": "#969696",
    "--prx-neutral-5": "#737373", "--prx-neutral-6": "#525252", "--prx-neutral-7": "#252525",
    "--prx-grade-1": "#153653", "--prx-grade-2": "#1D425E", "--prx-grade-3": "#264D68", "--prx-grade-4": "#2E5973",
    "--prx-grade-5": "#36647E", "--prx-grade-6": "#3E7089", "--prx-grade-7": "#477B93", "--prx-grade-8": "#4F879E",
    "--prx-crit-1": "#009E73", "--prx-crit-2": "#CC79A7", "--prx-crit-3": "#8C564B",
    "--prx-crit-ink-1": "#006B4F", "--prx-crit-ink-2": "#963F73", "--prx-crit-ink-3": "#8C564B",
    "--prx-chg-unchanged": "#ebebeb", "--prx-chg-disclosed": "#0072B2", "--prx-chg-withheld": "#999999", "--prx-chg-reversed": "#D55E00",
    "--prx-font-sans": "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
  }),
  rampSteps: 7,
  gradeSteps: 8,
  criteria: 3,
  channelMax: 255,
  hexRadix: 16,
  luminance: Object.freeze({ r: 0.2126, g: 0.7152, b: 0.0722, knee: 0.03928, low: 12.92, offset: 0.055, scale: 1.055, gamma: 2.4, flare: 0.05 }),
  // gradeRamp: how far the light end goes from --prx-grade-8 toward the plot panel, and the path's sample count
  gradeRampTint: 0.6,
  gradeRampSamples: 240,
  // CIE L* from relative luminance Y: f(Y) = ∛Y above (6/29)³, else Y/(3(6/29)²) + 4/29; L* = 116 f − 16
  cieLab: Object.freeze({ epsilon: (6 / 29) ** 3, slope: 1 / (3 * (6 / 29) ** 2), offset: 4 / 29, scale: 116, shift: 16 }),
  pngScale: 2,
  panelClass: "prx-light-panel",
  probeClass: "prx-panel-probe",
  text: Object.freeze({
    pointsLabel: "Data points. Use the arrow keys to read each value.",
    missingAlt: "chart.plot: every figure needs alt text or a data table",
    tipWarning: "chart.plot: this figure has a pointer tip; pass options.keyboard so keyboard users can read the values too",
  }),
});

const WRAPPER_KEYS = new Set(["alt", "table", "formulas", "keyboard", "marks", "className", "aspect"]);
const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
let chartCounter = 0;
let activePlot = null;

function plotGlobal(el) {
  const P = el?.ownerDocument?.defaultView?.Plot ?? globalThis.Plot;
  if (!P || typeof P.plot !== "function") throw new Error("Observable Plot is not loaded (js/vendor/d3.min.js, then js/vendor/plot.min.js)");
  return P;
}

// ------------------------------------------------------------------------------------------- colours

function computed(el) {
  const win = el?.ownerDocument?.defaultView;
  return win?.getComputedStyle ? win.getComputedStyle(el) : null;
}

/** The value of one CSS custom property as seen from el ("" when unset). */
export function cssToken(el, name, cs = computed(el)) {
  return cs ? String(cs.getPropertyValue(name) ?? "").trim() : "";
}

function splitVar(body) {
  // "--name, fallback" -> [name, fallback | undefined]; commas inside the fallback's parentheses stay
  const i = body.indexOf(",");
  return i < 0 ? [body.trim(), undefined] : [body.slice(0, i).trim(), body.slice(i + 1).trim()];
}

/**
 * Replace every var(--name[, fallback]) in `value` by the custom property seen from `el`, else the fallback, else
 * CONFIG.tokens[name]. Nested var() in values and fallbacks are resolved too. Other strings pass through.
 */
export function resolveColor(el, value, depth = 0, cs) {
  if (typeof value !== "string" || !value.includes("var(")) return value;
  const style = cs ?? computed(el);
  let out = "";
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf("var(", i);
    if (start < 0) { out += value.slice(i); break; }
    out += value.slice(i, start);
    let level = 0;
    let end = start + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === "(") level += 1;
      else if (value[end] === ")") { level -= 1; if (level === 0) break; }
    }
    const [name, fallback] = splitVar(value.slice(start + 4, end));
    let v = cssToken(el, name, style);
    if (!v && fallback !== undefined) v = fallback;
    if (!v) v = CONFIG.tokens[name] ?? "";
    out += depth < CONFIG.maxVarDepth ? resolveColor(el, v, depth + 1, style) : v;
    i = end + 1;
  }
  return out.trim();
}

/** A token by name ("--prx-post" or "prx-post"), resolved. */
export const token = (el, name, cs) => resolveColor(el, `var(${name.startsWith("--") ? name : `--${name}`})`, 0, cs);

/** Resolve var() strings inside plain objects and arrays (scale options, style). Functions and class instances
 * (marks, Dates, typed arrays) are left as they are. */
export function resolveDeep(el, value, cs = computed(el)) {
  if (typeof value === "string") return resolveColor(el, value, 0, cs);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(el, v, cs));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(el, v, cs)]));
  return value;
}

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

/** The resolved palette as seen from el (concrete colours for Plot, canvas and PNG); cs: a computed style (default:
 * the live one). */
export function palette(el, cs = computed(el)) {
  const t = (n) => token(el, `--prx-${n}`, cs);
  return {
    bg: t("bg"), bgRaised: t("bg-raised"), fg: t("fg"), fgMuted: t("fg-muted"), link: t("link"), accent: t("accent"),
    focus: t("focus"), borderStrong: t("border-strong"),
    plotBg: t("plot-bg"), plotFg: t("plot-fg"), plotMuted: t("plot-muted"), plotAxis: t("plot-axis"), plotGrid: t("plot-grid"),
    cellBorder: t("cell-border"), hatch: t("hatch"), labelDark: t("label-dark"), labelLight: t("label-light"),
    plotFocus: t("plot-focus"), plotFocusHalo: t("plot-focus-halo"),
    est: t("est"), post: t("post"),
    relAbove: t("rel-above"), relWithheld: t("rel-withheld"), relBelow: t("rel-below"),
    err: t("err"), wh: t("wh"), errText: t("err-text"), whText: t("wh-text"), estText: t("est-text"), postText: t("post-text"),
    blues: range(CONFIG.rampSteps, (i) => t(`blues-${i}`)),
    purples: range(CONFIG.rampSteps, (i) => t(`purples-${i}`)),
    neutral: range(CONFIG.rampSteps, (i) => t(`neutral-${i}`)),
    grades: range(CONFIG.gradeSteps, (i) => t(`grade-${i}`)),
    crit: range(CONFIG.criteria, (i) => t(`crit-${i}`)),
    critInk: range(CONFIG.criteria, (i) => t(`crit-ink-${i}`)),
    chg: { unchanged: t("chg-unchanged"), disclosed: t("chg-disclosed"), withheld: t("chg-withheld"), reversed: t("chg-reversed") },
    fontSans: t("font-sans"),
  };
}

/** "#rgb", "#rrggbb" or "rgb(r, g, b)" -> [r, g, b] (0–255), or null. */
export function parseColor(c) {
  const s = String(c ?? "").trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => Number.parseInt(m[1].slice(i, i + 2), CONFIG.hexRadix));
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [0, 1, 2].map((i) => Number.parseInt(m[1][i] + m[1][i], CONFIG.hexRadix));
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  return m ? [m[1], m[2], m[3]].map(Number) : null;
}

const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(CONFIG.hexRadix).padStart(2, "0")).join("")}`;

/**
 * G grade colours, grade 1 first, by the package rule between --prx-grade-1 and --prx-grade-8:
 * channel = floor(a + (b − a)(g − 1)/(G − 1) + 1/2); G = 1 gives grade 1's colour.
 */
export function gradeColors(G, source) {
  const pal = source && Array.isArray(source.grades) ? source : palette(source);
  const a = parseColor(pal.grades[0]);
  const b = parseColor(pal.grades[pal.grades.length - 1]);
  const n = Math.max(1, Math.floor(G));
  if (!a || !b) return range(n, () => pal.grades[0]);
  if (n === 1) return [hex(a)];
  return range(n, (g) => hex(a.map((x, k) => Math.floor(x + ((b[k] - x) * (g - 1)) / (n - 1) + 1 / 2))));
}

function luminance(c) {
  const rgb = parseColor(c);
  if (!rgb) return Number.NaN;
  const L = CONFIG.luminance;
  const lin = rgb.map((v) => {
    const x = v / CONFIG.channelMax;
    return x <= L.knee ? x / L.low : ((x + L.offset) / L.scale) ** L.gamma;
  });
  return L.r * lin[0] + L.g * lin[1] + L.b * lin[2];
}

/**
 * G grade colours for marks without a grade number (map areas, scatter dots), grade 1 first and darkest, in clearly
 * distinct lightness steps: the badge ramp (--prx-grade-1 to --prx-grade-8, as gradeColors) continued to a tint of
 * --prx-grade-8 toward the plot panel (CONFIG.gradeRampTint of the way), sampled at equal steps of CIE lightness L*.
 * G = 1 gives grade 1's colour.
 */
export function gradeRamp(G, source) {
  const pal = source && Array.isArray(source.grades) ? source : palette(source);
  const n = Math.max(1, Math.floor(G));
  const dark = parseColor(pal.grades[0]);
  const mid = parseColor(pal.grades[pal.grades.length - 1]);
  const paper = parseColor(pal.plotBg) ?? [CONFIG.channelMax, CONFIG.channelMax, CONFIG.channelMax];
  if (!dark || !mid) return range(n, () => pal.grades[0]);
  if (n === 1) return [hex(dark)];
  const light = mid.map((x, k) => x + (paper[k] - x) * CONFIG.gradeRampTint);
  // the path dark -> mid -> light, sampled densely (every channel rises along it, so L* rises too)
  const S = CONFIG.gradeRampSamples;
  const path = [];
  for (let s = 0; s <= S; s += 1) {
    const t = (2 * s) / S;
    const [a, b, u] = t <= 1 ? [dark, mid, t] : [mid, light, t - 1];
    const rgb = a.map((x, k) => x + (b[k] - x) * u);
    path.push({ rgb, L: lightness(rgb) });
  }
  const L0 = path[0].L;
  const L1 = path[S].L;
  return range(n, (g) => {
    const target = L0 + ((L1 - L0) * (g - 1)) / (n - 1);
    let k = 1;
    while (k < S && path[k].L < target) k += 1;
    const p = path[k - 1];
    const q = path[k];
    const u = q.L > p.L ? Math.min(1, Math.max(0, (target - p.L) / (q.L - p.L))) : 0;
    return hex(p.rgb.map((x, c) => x + (q.rgb[c] - x) * u));
  });
}

/** CIE L* (0–100) of an sRGB triple. */
function lightness(rgb) {
  const Y = luminance(`rgb(${rgb.map((v) => Math.round(v)).join(", ")})`);
  const e = CONFIG.cieLab;
  const f = Y > e.epsilon ? Math.cbrt(Y) : Y * e.slope + e.offset;
  return e.scale * f - e.shift;
}

/** WCAG contrast ratio of two colours. */
export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  const f = CONFIG.luminance.flare;
  return (Math.max(x, y) + f) / (Math.min(x, y) + f);
}

/** The better direct-label ink (--prx-label-dark or --prx-label-light) on a fill. */
export function labelOn(fill, pal) {
  if (!parseColor(fill)) return pal.labelDark;
  return contrast(fill, pal.labelLight) > contrast(fill, pal.labelDark) ? pal.labelLight : pal.labelDark;
}

// Only the nodes that hold a var() in a colour attribute or their style are visited, and each distinct attribute
// value is resolved once per call (a 9,000-node figure repeats a handful of fills): one call is one render, so the
// computed style it reads cannot change in between (P-01).
const VAR_ATTRIBUTES = [...CONFIG.colorAttributes, "style"];
// (jsdom's selector engine does not match a "(" inside an attribute value, so the selector looks for "var" and the
// loop checks for "var(")
const VAR_SELECTOR = VAR_ATTRIBUTES.map((a) => `[${a}*="var"]`).join(", ");

function resolveNodeColors(el, node, cs = computed(el), cache = new Map()) {
  const resolve = (v) => {
    let r = cache.get(v);
    if (r === undefined) { r = resolveColor(el, v, 0, cs); cache.set(v, r); }
    return r;
  };
  const all = node.matches?.(VAR_SELECTOR) ? [node, ...node.querySelectorAll(VAR_SELECTOR)] : node.querySelectorAll(VAR_SELECTOR);
  for (const n of all) {
    for (const a of VAR_ATTRIBUTES) {
      const v = n.getAttribute(a);
      if (v && v.includes("var(")) n.setAttribute(a, resolve(v));
    }
  }
  return cache;
}

// ------------------------------------------------------------------------------------------- ticks

/** Tick values for a log axis over [lo, hi]: m × 10^k for every mantissa m (default CONFIG.logMantissas). */
export function logTicks(lo, hi, { mantissas = CONFIG.logMantissas } = {}) {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  if (!(a > 0) || !Number.isFinite(b)) return [];
  const e0 = Math.floor(Math.log10(a) + CONFIG.logEpsilon);
  const e1 = Math.ceil(Math.log10(b) - CONFIG.logEpsilon);
  const out = [];
  for (let e = e0; e <= e1 && e - e0 <= CONFIG.maxLogDecades; e += 1) {
    for (const m of mantissas) {
      const v = Number((m * 10 ** e).toPrecision(CONFIG.logPrecision));
      if (v >= a * (1 - CONFIG.logEpsilon) && v <= b * (1 + CONFIG.logEpsilon)) out.push(v);
    }
  }
  return out;
}

/** A log-axis tick label: plain inside [CONFIG.logPlainMin, CONFIG.logPlainMax), else "10⁵" or "5 × 10⁵". */
export function logLabel(v) {
  if (!(v > 0)) return tickLabel(v);
  if (v >= CONFIG.logPlainMin && v < CONFIG.logPlainMax) return tickLabel(v);
  const s = formatSci(v, { style: "times", trim: true });
  return s.startsWith("1 × ") ? s.slice("1 × ".length) : s;
}

// ------------------------------------------------------------------------------------------- marks

/**
 * A text mark whose <text> nodes carry data-num: value (field or accessor) is the raw number and
 * format(raw) the label. Other options are Plot.text options.
 */
export function numText(data, { value, format, ...options } = {}) {
  if (typeof format !== "function") throw new TypeError("numText: format(raw) -> string is required (a format.js formatter)");
  const P = activePlot ?? globalThis.Plot;
  if (!P) throw new Error("numText: Observable Plot is not loaded (build marks inside plot(el, { marks: (c, P) => [...] }))");
  const rows = Array.from(data ?? []);
  const get = typeof value === "function" ? value : (d) => d?.[value];
  const raws = rows.map((d, i) => get(d, i));
  const user = options.render;
  return P.text(rows, {
    ...options,
    text: (d, i) => format(raws[i]),
    render(index, scales, values, dims, context, next) {
      const g = user ? user(index, scales, values, dims, context, next) : next(index, scales, values, dims, context);
      const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
      Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-num", dataNum(raws[i])));
      return g;
    },
  });
}

const tableNumber = value => value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))
  ? "NA" : typeof value === "bigint" ? String(value) : tickLabel(value);
const tableNumeric = value => value === null || value === undefined || typeof value === "number" || typeof value === "bigint"
  || (Array.isArray(value) && value.every(v => v === null || typeof v === "number" || typeof v === "bigint"));
function recordTableSpec(rows, caption) {
  if (rows.some(row => !isRecord(row))) throw new TypeError("chart table arrays must contain records; use explicit columns for other shapes");
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const columns = keys.map(value => {
    const numeric = rows.every(row => tableNumeric(row[value]));
    return { label: value, value, num: numeric, name: !numeric,
      format: numeric ? raw => Array.isArray(raw) ? formatTuple(raw, tableNumber) : tableNumber(raw) : undefined };
  });
  return { rows, columns, caption: caption ?? "Complete figure data" };
}

/** A visually hidden data table. Record arrays infer columns; explicit schemas retain their own formatters. */
export function hiddenTable(doc, spec = {}, defaultCaption) {
  const { caption, columns = [], rows = [], visible = false } = Array.isArray(spec) ? recordTableSpec(spec, defaultCaption) : spec;
  const wrap = doc.createElement("div");
  wrap.className = visible ? "prx-data-table" : "prx-sr-only prx-data-table";
  wrap.setAttribute("data-prx-part", "table");
  const table = doc.createElement("table");
  if (caption) {
    // a caption may be text or nodes (so a number in it can carry data-num)
    const cap = doc.createElement("caption");
    if (typeof caption === "string") cap.textContent = caption;
    else cap.append(...[].concat(caption));
    table.append(cap);
  }
  const thead = doc.createElement("thead");
  const tr = doc.createElement("tr");
  for (const c of columns) {
    const th = doc.createElement("th");
    th.scope = "col";
    th.textContent = c.label ?? String(c.value);
    tr.append(th);
  }
  thead.append(tr);
  const tbody = doc.createElement("tbody");
  for (const [ri, row] of Array.from(rows).entries()) {
    const r = doc.createElement("tr");
    for (const [ci, c] of columns.entries()) {
      const cell = doc.createElement(ci === 0 && c.header !== false ? "th" : "td");
      if (cell.tagName === "TH") cell.scope = "row";
      const raw = typeof c.value === "function" ? c.value(row, ri) : row?.[c.value];
      const numeric = typeof raw === "number" || typeof raw === "bigint" || (Array.isArray(raw) && raw.every((x) => typeof x === "number"));
      const display = typeof c.format === "function" ? c.format(raw, row) : numeric && typeof raw === "number" ? tickLabel(raw) : raw === null || raw === undefined ? "" : String(raw);
      if (numeric || c.num) setNum(cell, raw, display);
      else cell.textContent = display;
      if (c.name && typeof raw === "string") cell.setAttribute("data-prx-name", "");
      r.append(cell);
    }
    tbody.append(r);
  }
  table.append(thead, tbody);
  wrap.append(table);
  // a visible table may scroll sideways at 375 px: a keyboard stop named by its caption (A2-09)
  if (visible) scrollRegion(wrap, typeof caption === "string" ? caption : table.caption?.textContent ?? "");
  return wrap;
}

// ------------------------------------------------------------------------------------------- plot

function flatMarks(marks) {
  return [marks].flat(Infinity).filter((m) => m !== null && m !== undefined);
}

function hasPointerTip(marks) {
  return flatMarks(marks).some((m) => m && (m.tip || m.ariaLabel === "tip" || (Array.isArray(m.marks) && hasPointerTip(m.marks))));
}

function accessor(a) {
  if (typeof a === "function") return a;
  if (a === undefined || a === null) return () => undefined;
  return (d) => d?.[a];
}

function position(scale, v) {
  if (!scale || v === undefined || v === null) return undefined;
  const p = scale.apply(v);
  if (!Number.isFinite(p)) return undefined;
  return scale.bandwidth ? p + scale.bandwidth / 2 : p;
}

function plotSize(svg) {
  const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const w = Number(svg.getAttribute("width")) || vb[2] || CONFIG.defaultWidth;
  const h = Number(svg.getAttribute("height")) || vb[3] || w;
  return { width: w, height: h };
}

const pct = (v, total) => `${(v / total) * CONFIG.percent}%`;

function placeLabel(node, x, y, size, { anchor = "middle", valign = "middle" } = {}) {
  node.style.left = pct(x, size.width);
  node.style.top = pct(y, size.height);
  const tx = anchor === "start" ? "0" : anchor === "end" ? "-100%" : "-50%";
  const ty = valign === "top" ? "0" : valign === "bottom" ? "-100%" : "-50%";
  node.style.transform = `translate(${tx}, ${ty})`;
}

// Clip-aware bounds: a full matrix may be wider than its inner scroll viewport.
function pointTipBounds(tip, size) {
  const area = tip.parentElement, win = tip.ownerDocument.defaultView;
  const rect = area?.getBoundingClientRect();
  if (!(rect?.width > 0)) return { left: 0, right: size.width, scale: 1, physicalLeft: null, physicalRight: null };
  let left = Math.max(rect.left, 0), right = Math.min(rect.right, win.innerWidth || rect.right);
  for (let parent = area.parentElement; parent; parent = parent.parentElement) {
    if (!/^(auto|scroll|hidden|clip)$/.test(win.getComputedStyle(parent).overflowX)) continue;
    const box = parent.getBoundingClientRect(), start = box.left + parent.clientLeft;
    if (parent.clientWidth > 0) { left = Math.max(left, start); right = Math.min(right, start + parent.clientWidth); }
  }
  if (!(right > left)) return { left: 0, right: size.width, scale: 1, physicalLeft: null, physicalRight: null };
  const scale = rect.width / size.width;
  return { left: (left - rect.left) / scale, right: (right - rect.left) / scale, scale, physicalLeft: left, physicalRight: right };
}

// Keep the complete description inside every clipping ancestor, including CSS margins.
function placePointTip(tip, p, size) {
  const bounds = pointTipBounds(tip, size);
  const x = Math.max(bounds.left, Math.min(bounds.right, p.x));
  const anchor = x - bounds.left > bounds.right - x ? "end" : "start";
  const style = tip.ownerDocument.defaultView?.getComputedStyle(tip);
  const gutter = (parseFloat(style?.marginLeft) || 0) + (parseFloat(style?.marginRight) || 0);
  const available = (anchor === "end" ? x - bounds.left : bounds.right - x) * bounds.scale - gutter;
  tip.style.maxWidth = `min(18rem, ${Math.max(1, available)}px)`;
  tip.style.boxSizing = "border-box";
  tip.style.overflowWrap = "anywhere";
  placeLabel(tip, x, p.y, size, { anchor, valign: p.y > size.height / 2 ? "bottom" : "top" });
  if (bounds.physicalLeft !== null) {
    const rect = tip.getBoundingClientRect();
    const delta = rect.left < bounds.physicalLeft ? bounds.physicalLeft - rect.left
      : rect.right > bounds.physicalRight ? bounds.physicalRight - rect.right : 0;
    if (delta) tip.style.left = pct(x + delta / bounds.scale, size.width);
  }
}

function drawFormulas(state, result, formulas, size) {
  const { overlay, doc } = state;
  const sx = result.scale("x");
  const sy = result.scale("y");
  const keep = new Set();
  for (const [i, f] of (formulas ?? []).entries()) {
    if (!f || !f.tex) continue;
    const key = f.key ?? `f${i}`;
    keep.add(key);
    let node = overlay.querySelector(`[data-prx-formula="${CSS_ESCAPE(key)}"]`);
    if (!node) {
      node = doc.createElement("span");
      node.setAttribute("data-prx-formula", key);
      overlay.append(node);
    }
    node.className = `prx-math-label${f.className ? ` ${f.className}` : ""}`;
    const px = f.x !== undefined ? position(sx, f.x) : (f.left ?? 0) * size.width;
    const py = f.y !== undefined ? position(sy, f.y) : (f.top ?? 0) * size.height;
    placeLabel(node, (px ?? 0) + (f.dx ?? 0), (py ?? 0) + (f.dy ?? 0), size, f);
    if (f.num !== undefined) node.setAttribute("data-num", dataNum(f.num));
    else node.removeAttribute("data-num");
    renderTex(node, f.tex, { display: Boolean(f.display) });
  }
  for (const node of [...overlay.querySelectorAll("[data-prx-formula]")]) if (!keep.has(node.getAttribute("data-prx-formula"))) node.remove();
}

const CSS_ESCAPE = (s) => String(s).replace(/["\\]/g, "\\$&");

function drawKeyboard(state, result, kb, size) {
  const { layer, tip, doc } = state;
  layer.replaceChildren();
  tip.hidden = true;
  if (!kb || !kb.data) {
    layer.hidden = true;
    return;
  }
  layer.hidden = false;
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-label", kb.label ?? CONFIG.text.pointsLabel);
  const sx = result.scale("x");
  const sy = result.scale("y");
  const gx = accessor(kb.x);
  const gy = accessor(kb.y);
  const title = typeof kb.title === "function" ? kb.title : accessor(kb.title);
  const keyOf = kb.key ? accessor(kb.key) : (_, i) => i;
  const points = Array.from(kb.data, (d, i) => ({ d, i, key: String(keyOf(d, i)), x: position(sx, gx(d, i)), y: position(sy, gy(d, i)) }))
    .filter((p) => p.x !== undefined || p.y !== undefined)
    .map((p) => ({ ...p, x: p.x ?? size.width / 2, y: p.y ?? size.height / 2 }));
  // a grid keeps the data's row order; other point sets are read left to right
  if (kb.sort !== false && !(Number(kb.columns) > 1)) points.sort((a, b) => a.x - b.x || a.y - b.y);
  if (!points.length) return;
  let active = Math.max(0, points.findIndex((p) => p.key === state.activeKey));
  // Dense canvas matrices retain every data point with one movable DOM focus target.
  // A stable focus key lets keepFocus restore the same control after a linked redraw.
  if (kb.virtual === true) {
    const b = doc.createElement("button");
    b.type = "button"; b.className = "prx-kbd-point"; b.tabIndex = 0;
    b.setAttribute("data-prx-focus-key", `kbd:${state.id}:virtual`);
    const show = () => {
      const p = points[active], text = String(title(p.d, p.i) ?? "");
      state.activeKey = p.key;
      b.setAttribute("aria-label", text.replace(/\s*\n\s*/g, ", "));
      placeLabel(b, p.x, p.y, size);
      tip.textContent = text; tip.hidden = false;
      if (typeof kb.onFocus === "function") {
        try { kb.onFocus(p.d, p.i); } catch (err) { console.warn("chart.plot: keyboard.onFocus failed", err); }
      }
      placePointTip(tip, p, size);
    };
    const p = points[active];
    b.setAttribute("aria-label", String(title(p.d, p.i) ?? "").replace(/\s*\n\s*/g, ", "));
    placeLabel(b, p.x, p.y, size); layer.append(b);
    b.addEventListener("focus", show);
    b.addEventListener("keydown", e => {
      if (e.key === "Escape") { tip.hidden = true; return; }
      const cols = Number(kb.columns)>1?Math.floor(kb.columns):0;
      const keys={ArrowRight:active+1,ArrowLeft:active-1,ArrowDown:cols?(active+cols<points.length?active+cols:active):active+1,ArrowUp:cols?(active-cols>=0?active-cols:active):active-1,Home:0,End:points.length-1};
      if (!(e.key in keys)) return;
      e.preventDefault(); active=Math.max(0,Math.min(points.length-1,keys[e.key])); show();
    });
    state.points=points; return;
  }
  const buttons = points.map((p, j) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "prx-kbd-point";
    b.setAttribute("aria-label", String(title(p.d, p.i) ?? "").replace(/\s*\n\s*/g, ", "));
    b.setAttribute("data-prx-focus-key", `kbd:${state.id}:${p.key}`);
    b.tabIndex = j === active ? 0 : -1;
    placeLabel(b, p.x, p.y, size);
    layer.append(b);
    return b;
  });
  const show = (j) => {
    const p = points[j];
    tip.textContent = String(title(p.d, p.i) ?? "");
    tip.hidden = false;
    if (typeof kb.onFocus === "function") {
      try { kb.onFocus(p.d, p.i); } catch (err) { console.warn("chart.plot: keyboard.onFocus failed", err); }
    }
    placePointTip(tip, p, size);
  };
  const go = (j) => {
    active = Math.max(0, Math.min(points.length - 1, j));
    state.activeKey = points[active].key;
    buttons.forEach((b, k) => { b.tabIndex = k === active ? 0 : -1; });
    buttons[active].focus({ preventScroll: true });
    show(active);
  };
  buttons.forEach((b, j) => {
    b.addEventListener("focus", () => { active = j; state.activeKey = points[j].key; show(j); });
    b.addEventListener("keydown", (e) => {
      const cols = Number(kb?.columns) > 1 ? Math.floor(kb.columns) : 0;
      const down = cols ? (active + cols < points.length ? active + cols : active) : active + 1;
      const up = cols ? (active - cols >= 0 ? active - cols : active) : active - 1;
      const keys = { ArrowRight: active + 1, ArrowDown: down, ArrowLeft: active - 1, ArrowUp: up, Home: 0, End: points.length - 1 };
      if (e.key === "Escape") { tip.hidden = true; return; }
      if (!(e.key in keys)) return;
      e.preventDefault();
      go(keys[e.key]);
    });
  });
  state.points = points;
}

function chartState(el) {
  if (el.__prxChart) {
    if (el.__prxChart.container.parentNode !== el) el.replaceChildren(el.__prxChart.container);
    return el.__prxChart;
  }
  const doc = el.ownerDocument;
  const container = doc.createElement("div");
  container.className = "prx-chart";
  const overlay = doc.createElement("div");
  overlay.className = "prx-math-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const layer = doc.createElement("div");
  layer.className = "prx-kbd-layer";
  layer.hidden = true;
  const tip = doc.createElement("div");
  tip.className = "prx-kbd-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  layer.addEventListener("focusout", (e) => { if (!layer.contains(e.relatedTarget)) tip.hidden = true; });
  // colours are resolved as seen from inside the plot panel (see the header): a hidden light-panel probe
  const probe = doc.createElement("span");
  probe.className = `${CONFIG.panelClass} ${CONFIG.probeClass}`;
  probe.hidden = true;
  probe.setAttribute("aria-hidden", "true");
  container.prepend(probe);
  el.replaceChildren(container);
  chartCounter += 1;
  el.__prxChart = { id: `c${chartCounter}`, doc, container, overlay, layer, tip, probe, canvases: [], activeKey: null, warned: false };
  return el.__prxChart;
}

function axisMarks(P, opts, labels) {
  // log axes: the wrapper places and writes the ticks (Plot 0.6.17 blanks 5 × 10^k labels on a log scale)
  const extra = [];
  const needDomain = [];
  for (const k of ["x", "y"]) {
    const s = opts[k];
    if (!s || s.type !== "log" || s.axis === null) continue;
    let ticks = Array.isArray(s.ticks) ? s.ticks.slice() : null;
    if (!ticks && Array.isArray(s.domain) && s.domain.length === 2) ticks = logTicks(s.domain[0], s.domain[1], { mantissas: s.mantissas });
    if (!ticks) { needDomain.push(k); continue; }
    const fmt = typeof s.tickFormat === "function" ? s.tickFormat : logLabel;
    const axis = k === "x" ? P.axisX : P.axisY;
    const { ticks: _t, tickFormat: _f, mantissas: _m, axis: anchor, ...rest } = s;
    opts[k] = rest;
    // the explicit axis mark draws the label, so the scale's label options go to it
    const labelOpts = {};
    for (const key of CONFIG.axisLabelKeys) if (rest[key] !== undefined) labelOpts[key] = rest[key];
    extra.push(axis(ticks, { anchor: anchor ?? undefined, ...labelOpts, text: (d) => record(labels, d, fmt(d)) }));
  }
  return { extra, needDomain };
}

function defaultTick(d, i, t) {
  if (typeof d === "number") return tickLabel(d, i, t);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d === null || d === undefined ? "" : String(d);
}

function record(labels, raw, text) {
  const s = String(text ?? "");
  if (s !== "" && typeof raw === "number") labels.set(s, raw);
  return s;
}

/** Draw (or re-draw) a figure in el. See the header for the options. */
export function plot(el, options = {}) {
  if (!el || el.nodeType !== 1) throw new TypeError("chart.plot: el must be an element");
  const P = plotGlobal(el);
  const { alt, table, formulas, keyboard, marks, className, aspect: aspectOption } = options;
  if (!alt && !table) throw new TypeError(CONFIG.text.missingAlt);
  const state = chartState(el);
  const { doc, container, overlay, layer, tip } = state;
  const root = el.closest?.(".prx-widget");
  const fontScale = Number(root?.getAttribute("data-prx-font-scale")) || 1;
  // one computed style for the whole render (palette, scale options and drawn nodes), read inside the plot panel
  if (state.probe.parentNode !== container) container.prepend(state.probe);
  const cs = computed(state.probe);
  const pal = palette(el, cs);

  const rest = {};
  for (const [k, v] of Object.entries(options)) if (!WRAPPER_KEYS.has(k)) rest[k] = v;
  const opts = {};
  for (const [k, v] of Object.entries(rest)) opts[k] = CONFIG.scaleKeys.includes(k) || k === "style" ? resolveDeep(el, v, cs) : v;
  // a given width skips the measurement (reading clientWidth forces a layout)
  const measured = Number(opts.width) ? 0 : Math.round(el.clientWidth || el.getBoundingClientRect?.().width || 0);
  const width = Number(opts.width) || (measured > 0 ? Math.max(CONFIG.minWidth, measured) : CONFIG.defaultWidth);
  // the app's height, then options.aspect (width / height)
  const aspect = Number(aspectOption) || 0;
  const height = Number(opts.height) || (aspect > 0 ? Math.round(width / aspect) : undefined);

  // numeric tick labels in the house style, recorded for data-num
  const labels = new Map();
  for (const k of CONFIG.positionAxes) {
    const s = opts[k];
    if (s?.type === "log" || s?.axis === null) continue;
    const user = s?.tickFormat;
    if (typeof user === "string") continue;
    const fmt = typeof user === "function" ? user : defaultTick;
    opts[k] = { ...(s ?? {}), tickFormat: (d, i, t) => record(labels, d, fmt(d, i, t)) };
  }

  activePlot = P;
  let markList;
  try {
    markList = typeof marks === "function" ? marks(pal, P) : marks ?? [];
  } finally {
    activePlot = null;
  }
  if (!keyboard && !state.warned && hasPointerTip(markList)) {
    state.warned = true;
    console.warn(CONFIG.text.tipWarning);
  }

  const style = {
    background: "transparent",
    color: pal.plotFg,
    fontFamily: pal.fontSans || "system-ui, sans-serif",
    fontSize: `${CONFIG.fontSize * fontScale}px`,
    overflow: "visible",
    ...(isRecord(opts.style) ? opts.style : {}),
  };
  const make = (o) => {
    const { extra, needDomain } = axisMarks(P, o, labels);
    return { needDomain, out: P.plot({ ...o, width, height, style, document: doc, marks: [...flatMarks(markList), ...extra] }) };
  };
  let built = make({ ...opts });
  if (built.needDomain.length) {
    // a log scale without domain or ticks: read the domain Plot chose, then draw again with wrapper ticks
    const again = { ...opts };
    for (const k of built.needDomain) again[k] = { ...opts[k], domain: built.out.scale(k).domain };
    built = make(again);
  }
  const result = built.out;

  // normalize the shape: always <figure> with the main <svg> inside
  let figure;
  if (result.tagName.toLowerCase() === "figure") figure = result;
  else {
    figure = doc.createElement("figure");
    figure.append(result);
  }
  figure.classList.add("prx-figure");
  if (className) for (const c of String(className).split(/\s+/).filter(Boolean)) figure.classList.add(c);
  const svgs = [...figure.children].filter((n) => n.tagName.toLowerCase() === "svg");
  const svg = svgs.find((n) => !/-ramp\b/.test(n.getAttribute("class") ?? "")) ?? svgs[svgs.length - 1];
  const legends = [...figure.children].filter((n) => n !== svg && n.tagName.toLowerCase() !== "figcaption");
  for (const n of legends) n.setAttribute("data-prx-part", "legend");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", alt || table?.caption || "");
  // the svg is one image: Plot's labelled groups and text inside it stay out of the accessibility tree (A-08); the
  // figure keeps its alt text and the hidden data table
  for (const c of svg.children) c.setAttribute("aria-hidden", "true");
  resolveNodeColors(el, figure, cs);

  // data-num on numeric tick labels
  for (const t of figure.querySelectorAll('g[aria-label$="tick label"] text')) {
    const raw = labels.get(t.textContent);
    if (raw !== undefined) t.setAttribute("data-num", dataNum(raw));
  }

  // plot area: the svg with the canvas, formula and keyboard layers over it (focus is kept across the redraw)
  const size = plotSize(svg);
  const area = doc.createElement("div");
  area.className = "prx-chart-area";
  keepFocus(container, () => {
    svg.replaceWith(area);
    area.append(...state.canvases.map((c) => c.canvas), svg, overlay, layer, tip);
    drawFormulas(state, result, formulas, size);
    drawKeyboard(state, result, keyboard, size);
    const tableNode = table ? hiddenTable(doc, table) : null;
    if (tableNode && Array.isArray(table) && alt) tableNode.querySelector("table").setAttribute("aria-label", alt);
    container.replaceChildren(state.probe, figure, ...(tableNode ? [tableNode] : []));
    state.table = tableNode;
  });
  state.figure = figure;
  state.svg = svg;
  state.result = result;
  state.size = size;
  state.palette = pal;
  for (const c of state.canvases) paintCanvas(state, c);

  const handle = {
    el, figure, svg, area, legends, palette: pal,
    get table() { return state.table; },
    scale: (name) => result.scale(name),
    exportSVG: () => exportSVG(handle),
    toPNG: (o) => toPNG(handle, o),
    destroy() {
      container.remove();
      delete el.__prxChart;
    },
  };
  state.handle = handle;
  return handle;
}

// ------------------------------------------------------------------------------------------- canvas and export

function paintCanvas(state, c) {
  const { canvas, draw } = c;
  const { width, height } = state.size;
  const dpr = state.doc.defaultView?.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx2d = canvas.getContext?.("2d");
  if (!ctx2d) return;
  ctx2d.setTransform?.(dpr, 0, 0, dpr, 0, 0);
  ctx2d.clearRect?.(0, 0, width, height);
  const sx = state.result.scale("x");
  const sy = state.result.scale("y");
  draw(ctx2d, { x: (v) => position(sx, v), y: (v) => position(sy, v), palette: state.palette, width, height });
}

/**
 * Paint under the svg marks on a canvas (large report clouds, CONTRACT 8.8). draw(context2d, { x, y, palette,
 * width, height }) gets data -> pixel functions and the resolved palette; it runs again on every redraw.
 * Returns { canvas, remove() }.
 */
export function canvasLayer(chart, draw) {
  const state = chart.el.__prxChart;
  const canvas = state.doc.createElement("canvas");
  canvas.className = "prx-chart-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const entry = { canvas, draw };
  state.canvases.push(entry);
  chart.area.prepend(canvas);
  paintCanvas(state, entry);
  return {
    canvas,
    remove() {
      state.canvases = state.canvases.filter((c) => c !== entry);
      canvas.remove();
    },
  };
}

/** The main svg as standalone SVG text: concrete colours, currentColor replaced, a background rect first
 * (background: false leaves it out). */
export function exportSVG(chart, { background = true } = {}) {
  const state = chart.el.__prxChart;
  const pal = state.palette;
  const clone = chart.svg.cloneNode(true);
  const SVGNS = "http://www.w3.org/2000/svg";
  clone.setAttribute("xmlns", SVGNS);
  resolveNodeColors(chart.el, clone);
  for (const n of [clone, ...clone.querySelectorAll("*")]) {
    for (const a of CONFIG.colorAttributes) if (n.getAttribute(a) === "currentColor") n.setAttribute(a, pal.plotFg);
  }
  const { width, height } = state.size;
  const bg = state.doc.createElementNS(SVGNS, "rect");
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", pal.plotBg);
  if (background) clone.insertBefore(bg, clone.firstChild);
  return new (state.doc.defaultView.XMLSerializer)().serializeToString(clone);
}

/** PNG data URL of the figure (canvas layers, then the svg), at `scale` × the svg size. Browser only. */
export function toPNG(chart, { scale = CONFIG.pngScale } = {}) {
  const state = chart.el.__prxChart;
  const win = state.doc.defaultView;
  const { width, height } = state.size;
  const canvas = state.doc.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext("2d");
  if (!g) return Promise.reject(new Error("toPNG: no 2D canvas"));
  g.scale(scale, scale);
  g.fillStyle = state.palette.plotBg;
  g.fillRect(0, 0, width, height);
  for (const c of state.canvases) g.drawImage(c.canvas, 0, 0, width, height);
  const text = exportSVG(chart, { background: false });
  const img = new win.Image();
  return new Promise((resolve, reject) => {
    img.onload = () => { g.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL("image/png")); };
    img.onerror = () => reject(new Error("toPNG: the svg could not be drawn"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  });
}
