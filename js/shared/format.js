// format.js: the widget side of the engine's display rules.
//
// Widgets format every number with the engine's formatters, re-exported here so a widget imports one module:
//
//   import { formatProb, numSpan } from "./format.js";
//   readout.set(["Risk ", numSpan(r.risk, formatRisk(r.risk)), " at τ = ", numSpan(tau, formatSetting(tau))]);
//
// numSpan(raw, display, { document, className, title }) -> <span class="prx-num" data-num="raw">display</span>; a
//   display in scientific notation gets the title sciGloss(display) unless a title is given
//   `display` is the formatted string (or a function raw -> string). `raw` is the value the display came from:
//   a number, a BigInt, null (NA), or an array of these (a vector); dataNum() writes it. The read-out check reads
//   data-num, recomputes the display with the same formatter and compares the raw value with its expected value.
// setNum(node, raw, display) puts the same attribute and text on an existing element (a table cell, an <output>,
//   an SVG <text>).
// dataNum(raw) -> the attribute string: the shortest round-trip decimal for a finite number ("0.1875", "-0.0227",
//   "1e-17"), the digits of a BigInt, "NA" for null, undefined, NaN or an infinity, and comma-joined values for an
//   array ("1,2,2"). The hyphen-minus is used here on purpose: data-num is for machines, the display is for people.
//
// tickLabel(v, i, ticks) writes axis tick values in the house style (no leading zero below 1, U+2212 minus,
//   thousands separators, an exact 0 as "0"), with the same number of decimals on every tick of one axis.
//
// Named formats (NAMED_FORMATS):
//   formatShare(x)          a share at 3 significant digits (N2-04): E/N, DR = E/M, s = N/M and other shares read
//                           .136, .121, .0255, .00206, .0387; an E/N of null (N = 0) reads "NA: no disclosure"
//                           (formatEoverN with sig 3, so every share goes through one rule)
//   formatExpectedCount(x)  an expected count (E, E_k, an expected number of wrong pairs) at 4 significant digits
//                           (N2-07): 1.988, 14.28, .1449, 180.1, 1,234 (formatSig with sig 4)
// sciGloss(display) -> the reading of a scientific display ("1e−12" -> "1e−12 is 10⁻¹²", "1.39e−17" -> "1.39e−17 is
//   1.39 × 10⁻¹⁷"), or null. numSpan sets it as the title of a number displayed in scientific notation (I-03: the
//   equal-risk tolerance 1e−12 is glossed where it is shown; the visible text stays the display string).

import {
  MINUS,
  NA,
  NO_DISCLOSURE,
  formatCount,
  formatDecimal,
  formatEoverN,
  formatFraction,
  formatGrades,
  formatPercent,
  formatProb,
  formatRatio,
  formatRational,
  formatRisk,
  formatSci,
  formatSetting,
  formatSig,
  formatSigned,
  formatSizes,
  formatTuple,
  rationalApprox,
} from "../pr-core.js";
import { isCanonicalExact } from "./mdomain/format.js";
export { formatExactText } from "./mdomain/format.js";

export {
  MINUS,
  NA,
  NO_DISCLOSURE,
  formatCount,
  formatDecimal,
  formatEoverN,
  formatFraction,
  formatGrades,
  formatPercent,
  formatProb,
  formatRatio,
  formatRational,
  formatRisk,
  formatSci,
  formatSetting,
  formatSig,
  formatSigned,
  formatSizes,
  formatTuple,
  rationalApprox,
};

/** Named formats: name -> an engine formatter with its options (see the header). */
export const NAMED_FORMATS = Object.freeze({
  formatShare: Object.freeze({ fn: "formatEoverN", options: Object.freeze({ sig: 3 }) }),
  formatExpectedCount: Object.freeze({ fn: "formatSig", options: Object.freeze({ sig: 4 }) }),
});

const ENGINE_FORMATTERS = { formatEoverN, formatSig };

/** A share at 3 significant digits (NAMED_FORMATS.formatShare). */
export function formatShare(x) {
  const f = NAMED_FORMATS.formatShare;
  return ENGINE_FORMATTERS[f.fn](x, { ...f.options });
}

/** An expected count at 4 significant digits (NAMED_FORMATS.formatExpectedCount). */
export function formatExpectedCount(x) {
  const f = NAMED_FORMATS.formatExpectedCount;
  return ENGINE_FORMATTERS[f.fn](x, { ...f.options });
}

/** A report written as its grades from the top, units in index order inside a grade: blocksText([1, 1, 2, 3],
 *  ["A", "B", "C", "D"]) → "{A, B} > {C} > {D}". `grade` is a canonical grade vector (grades 1..G all used). */
export function blocksText(grade, ids) {
  const g = Array.from(grade);
  if (!Array.isArray(ids) || ids.length !== g.length) throw new TypeError("blocksText: one label per unit");
  const top = g.reduce((m, v) => Math.max(m, v), 0);
  return Array.from({ length: top }, (_, h) => `{${ids.filter((_, i) => g[i] === h + 1).join(", ")}}`).join(" > ");
}

export const CONFIG = Object.freeze({
  numClass: "prx-num",
  attribute: "data-num",
  naRaw: "NA",
  listSeparator: ",",
  // tick labels: the fewest decimals (up to maxTickDecimals) that write every tick of the axis exactly
  maxTickDecimals: 6,
  tickTolerance: 1e-9,
  // sciGloss: superscript digits and the words of the gloss
  superscript: Object.freeze(["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]),
  superMinus: "⁻",
  glossWords: Object.freeze({ is: " is ", times: " × ", ten: "10" }),
});

const SCI = /^([−-]?)(\d+(?:\.\d+)?)e([−-]?)(\d+)$/u;

/** The reading of a display string in scientific notation, or null (see the header). */
export function sciGloss(display) {
  const m = SCI.exec(String(display ?? "").trim());
  if (!m) return null;
  const W = CONFIG.glossWords;
  const power = `${W.ten}${m[3] ? CONFIG.superMinus : ""}${[...m[4]].map((d) => CONFIG.superscript[Number(d)]).join("")}`;
  const sign = m[1] ? MINUS : "";
  const value = m[2] === "1" ? `${sign}${power}` : `${sign}${m[2]}${W.times}${power}`;
  return `${String(display).trim()}${W.is}${value}`;
}

/** The data-num attribute string for a raw value (see the header). */
export function dataNum(raw) {
  if (Array.isArray(raw) || ArrayBuffer.isView(raw)) return Array.from(raw, (v) => dataNum(v)).join(CONFIG.listSeparator);
  if (typeof raw === "bigint") return raw.toString();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string" && isCanonicalExact(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return String(Number(raw));
  return CONFIG.naRaw;
}

function displayOf(raw, display) {
  if (typeof display === "function") return String(display(raw));
  if (display === undefined || display === null) {
    throw new TypeError("numSpan: a display string (the formatted value) is required; use a format.js formatter");
  }
  return String(display);
}

/** Put data-num and the display text on an existing element; returns the element. */
export function setNum(node, raw, display) {
  node.setAttribute(CONFIG.attribute, dataNum(raw));
  node.textContent = displayOf(raw, display);
  return node;
}

/** <span class="prx-num" data-num="raw">display</span> (see the header). */
export function numSpan(raw, display, { document: doc, className, title } = {}) {
  const d = doc ?? globalThis.document;
  if (!d) throw new Error("numSpan: no document (pass { document })");
  const span = d.createElement("span");
  span.className = className ? `${CONFIG.numClass} ${className}` : CONFIG.numClass;
  setNum(span, raw, display);
  const gloss = title ?? sciGloss(span.textContent);
  if (gloss) span.title = gloss;
  return span;
}

/** Decimals needed to write v exactly (up to CONFIG.maxTickDecimals). */
export function decimalsNeeded(v) {
  if (!Number.isFinite(v)) return 0;
  for (let d = 0; d < CONFIG.maxTickDecimals; d += 1) {
    const p = 10 ** d;
    if (Math.abs(Math.round(v * p) / p - v) <= CONFIG.tickTolerance * Math.max(1, Math.abs(v))) return d;
  }
  return CONFIG.maxTickDecimals;
}

/**
 * A tick label in the house style. Plot calls tickFormat(value, index, ticks); with the tick array the decimals are
 * shared by the whole axis (0, .2, .4, … 1.0). Non-numbers are written with String().
 */
export function tickLabel(v, i, ticks) {
  if (typeof v !== "number") return v === null || v === undefined ? "" : String(v);
  if (!Number.isFinite(v)) return NA;
  const list = Array.isArray(ticks) || ArrayBuffer.isView(ticks) ? Array.from(ticks) : [v];
  const digits = list.reduce((m, t) => Math.max(m, typeof t === "number" ? decimalsNeeded(t) : 0), decimalsNeeded(v));
  return formatDecimal(v, { digits });
}
