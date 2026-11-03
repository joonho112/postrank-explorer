// App formulas. Renders TeX to MathML with the vendored Temml (loaded once as the classic
// global `temml` from js/vendor/temml/temml.min.js), the macros below and the same options as the page post-render:
// throwOnError, and `trust` only for \class (colours come from \class{prx-...}{...} and styles/temml.css).
//
//   import { renderTex } from "./math.js";
//   renderTex(el, "R_\\tau(g) = \\class{prx-err}{E/M} + \\class{prx-wh}{\\tau(M-N)/M}", { display: true });
//
// - Results are cached by the TeX string and display mode; an unchanged formula does not touch the DOM.
// - On any failure (Temml not loaded, a TeX error) the element shows the TeX as plain text, gets the
//   class prx-math-fallback, and the console gets one warning per distinct formula.
// - Numbers in a live formula: build the TeX with formulaNums().num(raw, display, cls), which writes
//   \text{display} and remembers raw; pass { nums: f.raws } to renderTex and every number <mtext> gets the data-num
//   of its raw value (on every call, cached or not), so the checks can read each number back. In such a formula every
//   \text{} must come from num(), and a \mathrm{} group with a digit (rewritten to \text{}, see fixMathrmDigits) is
//   written as \mathrm{U}19 instead. Chromium drops the spacing of an "=" that is followed only by \text{} (also at
//   the start of a line); add \; or a symbol after it.
// An app that renders formulas sets "math": true in its catalog entry, so its embed loads temml.min.js.

import { dataNum } from "./format.js";

export const CONFIG = Object.freeze({
  cacheMax: 500,
  fallbackClass: "prx-math-fallback",
});

// ---- macros (from postrank Explorer v1's notation; scripts/post-render-math.mjs uses the same set for pages) ----
export const MACROS = Object.freeze({
  "\\prPis": "\\Pi_s",
  "\\prind": "\\mathbf1",
  "\\prebar": "\\bar e",
  "\\prA": "\\mathcal A",
  "\\prAn": "\\mathcal A_n",
  "\\prAle": "\\mathcal A_{\\le G_{\\max}}",
  "\\prAeq": "\\mathcal A_{=G_0}",
  "\\prArho": "\\mathcal A_\\rho",
  "\\prAq": "\\mathcal A_q",
  "\\prGmax": "G_{\\max}",
  "\\prL": "L_{w,\\tau}",
  "\\prR": "R_{w,\\tau}",
  "\\prRs": "R^s_{w,\\tau}",
  "\\prRP": "R^P_{w,\\tau}",
  "\\prRk": "R_k",
  "\\prRks": "R^s_k",
  "\\prRmax": "R_{\\max}",
  "\\prRmaxs": "R^s_{\\max}",
  "\\prKplus": "\\mathcal K_+",
  "\\prPset": "\\mathcal P",
  "\\prLK": "L_{\\mathrm K,\\lambda}",
  "\\prRK": "R_{\\mathrm K,\\lambda}",
  "\\prDlt": "D_{<}",
  "\\prTeq": "T_{=}",
  "\\prDR": "\\operatorname{DR}",
  "\\prERR": "\\mathrm{ERR}",
  "\\prPrMC": "\\Pr_{\\rm MC}",
  "\\prRTA": "R_{\\rm TA}",
  "\\prRTAs": "R^s_{\\rm TA}",
  "\\prRzero": "R_0",
  "\\prRzeros": "R^s_0",
  "\\prATA": "A_{\\rm TA}",
  "\\prATAs": "A^s_{\\rm TA}",
  "\\prZTA": "Z_{\\rm TA}",
  "\\prEb": "E^{b}",
  "\\prEbs": "E^{b,s}",
  "\\prLa": "L^{(a)}",
  "\\prRa": "R^{(a)}",
  "\\prKdist": "\\mathcal K",
  "\\prEx": "\\mathbb E",
  "\\prghat": "\\widehat g",
  "\\prerank": "\\bar R_{#1}^{\\downarrow}",
});
// ---- end of macros ----

const TEX_ESCAPES = {
  "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "%": "\\%", "_": "\\_",
  "#": "\\#", "&": "\\&", "$": "\\$", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

/** Escape a display string for use inside \text{...} (one pass). */
export function escapeTeX(s) {
  return String(s).replace(/[\\{}%_#&$~^]/g, (c) => TEX_ESCAPES[c]);
}

const cache = new Map();
const warned = new Set();
const trust = (ctx) => ctx.command === "\\class";

/** TeX -> MathML string (throws on failure). Uses the cache. */
// Temml 0.14.0 drops the last character of a \mathrm{...} group that holds a digit ("U19" shows "U1"); such a
// group is written as \text{...}, which renders the same upright letters and every digit.
export const fixMathrmDigits = (tex) => String(tex).replace(/\\mathrm\{([^{}]*\d[^{}]*)\}/g, "\\text{$1}");

export function texToMathML(tex, { display = false } = {}) {
  const expanded = fixMathrmDigits(String(tex));
  const key = (display ? "D:" : "I:") + expanded;
  const hit = cache.get(key);
  if (hit !== undefined) {
    if (hit.error) throw hit.error;
    return hit.html;
  }
  const temml = globalThis.temml;
  let entry;
  if (!temml || typeof temml.renderToString !== "function") {
    entry = { error: new Error("temml.min.js is not loaded") };   // not cached: the script may arrive later
    throw entry.error;
  }
  try {
    entry = { html: temml.renderToString(expanded, { displayMode: display, macros: { ...MACROS }, throwOnError: true, trust }) };
  } catch (e) {
    entry = { error: e instanceof Error ? e : new Error(String(e)) };
  }
  if (cache.size >= CONFIG.cacheMax) cache.delete(cache.keys().next().value);
  cache.set(key, entry);
  if (entry.error) throw entry.error;
  return entry.html;
}

/**
 * Render `tex` into `el`. Returns { ok, changed, ms }: ok is false when the plain-text fallback was shown; changed is
 * false when el already showed this formula; ms is the time spent (cache lookup and DOM update included).
 */
export function renderTex(el, tex, { display = false, nums } = {}) {
  const t0 = globalThis.performance?.now?.() ?? Date.now();
  const stamp = (display ? "D:" : "I:") + tex;
  let ok = true, changed = false;
  try {
    const html = texToMathML(tex, { display });
    if (el.__prxMath !== stamp || el.__prxMathHtml !== html) {
      el.innerHTML = html;
      el.classList?.remove(CONFIG.fallbackClass);
      el.__prxMath = stamp;
      el.__prxMathHtml = html;
      changed = true;
    }
  } catch (e) {
    ok = false;
    if (el.__prxMath !== stamp || el.__prxMathHtml !== null) {
      el.textContent = tex;
      el.classList?.add(CONFIG.fallbackClass);
      el.__prxMath = stamp;
      el.__prxMathHtml = null;
      changed = true;
    }
    if (!warned.has(stamp)) {
      warned.add(stamp);
      console.warn(`math.js: showing plain text for ${JSON.stringify(tex)}: ${String(e?.message ?? e).split("\n")[0]}`);
    }
  }
  if (ok && nums) tagNums(el, nums);
  const ms = (globalThis.performance?.now?.() ?? Date.now()) - t0;
  return { ok, changed, ms };
}

/** A builder for numbers in a live formula: num(raw, display, cls) returns \text{display} (in \class{cls} when given)
 *  and appends raw to raws, in formula order. */
export function formulaNums() {
  const raws = [];
  return {
    raws,
    num(raw, display, cls) {
      raws.push(raw);
      const t = `\\text{${escapeTeX(display)}}`;
      return cls ? `\\class{${cls}}{${t}}` : t;
    },
  };
}

const tagWarned = new Set();
/** Give each <mtext> of el the data-num of its raw value (formulaNums order); false (one warning) on a count mismatch. */
export function tagNums(el, raws) {
  const nodes = [...el.querySelectorAll("mtext")];
  if (nodes.length !== raws.length) {
    const key = `${nodes.length}/${raws.length}:${el.__prxMath ?? ""}`;
    if (!tagWarned.has(key)) {
      tagWarned.add(key);
      console.warn(`math.js: a formula shows ${nodes.length} text nodes for ${raws.length} numbers`);
    }
    return false;
  }
  nodes.forEach((n, i) => n.setAttribute("data-num", dataNum(raws[i])));
  return true;
}

/** Number of cached formulas (for tests). */
export const cacheSize = () => cache.size;
