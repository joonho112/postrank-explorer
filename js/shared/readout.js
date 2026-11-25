// readout.js: bound number and phrase writer for widget read-outs and summaries.
// Every numeric helper wraps its formatted display in <span class="prx-num" data-num="...">...</span> via ctx.num.

import * as FMT from "./format.js";
import * as LABELS from "./labels.js";

export {
  captionNode,
  captionNodes,
  familyNameNode,
  familySizeNode,
  labelNode,
  plural,
  tagNode,
  tieNode,
  withheldNodes,
  withheldPhrase,
} from "./labels.js";

/**
 * @typedef {object} ReadoutSpanOptions
 * @property {string} [hook] Optional data-prx-readout hook name.
 * @property {string} [className] Extra CSS class on the span.
 * @property {string} [title] Optional tooltip override.
 * @property {boolean} [signed] Prepend "+" on positive values where supported.
 * @property {boolean} [abs] Take absolute difference in diff(a, b, { abs: true }).
 * @property {string} [style] Exact-number display style ("percent" | "decimal" | "fraction").
 * @property {number} [digits] Exact-number decimal digits.
 * @property {number} [minSig] Minimum significant digits for distinguishing near-ties.
 * @property {number} [maxSig] Maximum significant digits for distinguishing near-ties.
 */

const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/**
 * Resolve a Document from a widget ctx, DOM element, or Document.
 * @param {any} target
 * @returns {Document}
 */
function docOf(target) {
  const d = target?.doc ?? (target?.nodeType === 9 ? target : target?.ownerDocument) ?? globalThis.document;
  if (!d) throw new TypeError("readout: pass a widget ctx, an element, or a document");
  return d;
}

/**
 * Create a bound readout writer for a widget `ctx` (or a Document/Element).
 * Dynamically resolves `FMT.formatReadout*` at call time.
 * @param {any} ctx
 */
export function createReadoutWriter(ctx) {
  /**
   * @param {any} raw
   * @param {string} display
   * @param {ReadoutSpanOptions} [opts]
   * @returns {HTMLSpanElement}
   */
  const makeSpan = (raw, display, opts) => {
    const spanOpts = {
      ...(opts?.className ? { className: opts.className } : {}),
      ...(opts?.title ? { title: opts.title } : {}),
    };
    const span = typeof ctx?.num === "function"
      ? ctx.num(raw, display, spanOpts)
      : FMT.numSpan(raw, display, { document: docOf(ctx), ...spanOpts });
    if (opts?.hook) span.setAttribute("data-prx-readout", String(opts.hook));
    return span;
  };

  const fallbackProb = (x) => {
    if (typeof x !== "number" || !Number.isFinite(x)) return FMT.NA;
    if (x === 0) return "0";
    if (x === 1) return "1";
    if (x > 0 && x < 0.001) return "below .001";
    if (x > 0.999 && x < 1) return "above .999";
    return FMT.formatSig(x, { sig: 3 });
  };

  const fallbackRisk = (x, opts) => {
    if (typeof x !== "number" || !Number.isFinite(x)) return FMT.NA;
    if (x === 0) return "0";
    const s = Math.abs(x) < 1e-4 ? FMT.formatSci(x, { sig: 3 }) : FMT.formatSig(x, { sig: 3 });
    return opts?.signed && x > 0 && !s.startsWith("+") ? `+${s}` : s;
  };

  const fallbackExpected = (x) => {
    if (typeof x !== "number" || !Number.isFinite(x)) return FMT.NA;
    if (x === 0) return "0";
    return Math.abs(x) < 1e-4 ? FMT.formatSci(x, { sig: 3 }) : FMT.formatSig(x, { sig: 3 });
  };

  return {
    /** Raw ctx.num wrapper with optional { hook, className, title }. */
    num(raw, display, opts) {
      return makeSpan(raw, display, opts);
    },
    /** Probability in [0, 1] at 3 sig figs with strict boundary floors/ceilings. */
    prob(x, opts) {
      const fmt = FMT.formatReadoutProb ?? fallbackProb;
      return makeSpan(x, fmt(x), opts);
    },
    /** Risk / loss / increment at 3 sig figs (scientific below 1e-4). */
    risk(x, opts) {
      const fmt = FMT.formatReadoutRisk ?? fallbackRisk;
      return makeSpan(x, fmt(x, opts), opts);
    },
    /** Share (E/N, DR, N/M) at 3 sig figs ("NA: no disclosure" when null). */
    share(x, opts) {
      return makeSpan(x, FMT.formatShare(x), opts);
    },
    /** Expected count in prose at 3 sig figs. */
    expected(x, opts) {
      const fmt = FMT.formatReadoutExpected ?? fallbackExpected;
      return makeSpan(x, fmt(x), opts);
    },
    /** Continuous estimate / posterior mean / SE / z-score at 3 sig figs. */
    est(x, opts) {
      const fmt = FMT.formatReadoutEst ?? fallbackRisk;
      return makeSpan(x, fmt(x, opts), opts);
    },
    /** Exact integer or BigInt count with thousands separators. */
    count(x, opts) {
      return makeSpan(x, FMT.formatCount(x), opts);
    },
    /** Parameter setting (tau, lambda, cap, seed) in house setting style. */
    setting(x, opts) {
      return makeSpan(x, FMT.formatSetting(x), opts);
    },
    /** Canonical rational/exact string formatted via formatExactText. */
    exact(raw, opts) {
      const exactOpts = opts ? { ...(opts.style ? { style: opts.style } : {}), ...(opts.digits !== undefined ? { digits: opts.digits } : {}) } : {};
      return makeSpan(raw, FMT.formatExactText(raw, exactOpts), opts);
    },
    /** Difference a - b (or |a - b| with { abs: true }, or single delta when b is omitted/options). */
    diff(a, b, opts) {
      const hasSecondNumber = typeof b === "number";
      const resolvedOpts = /** @type {ReadoutSpanOptions | undefined} */ (!hasSecondNumber && isRecord(b) ? b : opts);
      const rawDelta = hasSecondNumber ? a - b : a;
      const d = typeof rawDelta === "number" && resolvedOpts?.abs ? Math.abs(rawDelta) : rawDelta;
      const fmt = FMT.formatReadoutRisk ?? fallbackRisk;
      return makeSpan(d, fmt(d, resolvedOpts), resolvedOpts);
    },
    /** Near-tie distinguishing value against a reference value (S2-01). */
    distinguishing(x, ref, opts) {
      const fmt = FMT.formatDistinguishing ?? ((v) => fallbackRisk(v, opts));
      return makeSpan(x, fmt(x, ref, opts), opts);
    },
    /** Tie qualifier node when result.tieCount > 1, or null. */
    ties(result, opts) {
      return LABELS.tieNode(ctx, result, opts);
    },
    /** Standardized withholding phrase as DOM-safe nodes with data-num counts. */
    withheld(stated, total, noun = "pair") {
      return LABELS.withheldNodes(ctx, stated, total, noun);
    },
    /** Convenience pass-through to ctx.readout.set(content). */
    set(content) {
      return ctx?.readout?.set?.(content) ?? false;
    },
  };
}

/** Shorthand alias for createReadoutWriter(ctx). */
export const ro = createReadoutWriter;
