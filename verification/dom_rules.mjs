// DOM rules of the read-out check (verification/check_readouts.mjs). Pure functions over a DOM subtree (jsdom or a
// browser); nothing here mounts or reads files. Importing runs nothing. (From postrank Explorer v1,
// verification/dom_rules.mjs, without the prediction gate's parts.)
//
// numberFindings(root, { authored })   every number visible in a read-out, table or figure label carries data-num.
//   The scanned parts are CONFIG.numberScope (read-outs, tables, figures and their legends, captions, notes, titles,
//   <output>, MathML, formula labels, result labels and captions); controls are not scanned (native form labels and
//   the preset row; a slider's value is its <output>, which carries data-num). A numeric token is any run with an
//   ASCII digit: 12, 1,234, .20, 0.5, −.0227, +.049, 14%, 1e−12, 1/2/2. It passes when an ancestor (or the element
//   itself) has data-num. Not text: script, style, template, noscript, SVG title and desc, MathML annotation, anything
//   inside an element with the hidden attribute (pointer and keyboard tips). Structural exceptions, all tight:
//     identifier   digits joined to a letter or underscore on the left (A1, θ1, U08), or an ordinal suffix on the
//                  right (2nd)
//     reference    a plain integer right after Grade(s), grade(s), Part, Step, Rung, Figure, Table, Criterion,
//                  criterion, Chapter/chapter, Section/section, Appendix, Example, Exercise, Question, Slide(s)/slide(s),
//                  Equation, Box/box ("Grade 1 = highest priority"); a list or range after the word is not covered
//                  ("grades 1–3": the 3 fails)
//     year         a plain four-digit integer 1900–2099 directly inside a parenthesis: "(2024)", "(2024," or "2024)"
//     math index   an <mn> in a script position of msub, msup, msubsup, munder, mover, munderover, mmultiscripts
//     names        plain integers inside data-prx-name (a unit name or id: "Site 12"); a decimal, a grouped number
//                  or a percentage in a name still fails
//     labels       the text of data-prx-label and data-prx-family (the family name is an identifier such as 𝒜_≤3;
//                  the family size is a data-num element)
//     authored     (v3) a text node directly inside a caption part ([data-prx-part~="caption"]) whose whole text is one
//                  of the strings in `authored`: the catalog caption that base.js writes at mount (source and scope,
//                  authored in catalog/entries/, not computed). Anything an app writes into the caption, or a caption
//                  it rewrites, is scanned as usual
// badTokenFindings(root, { allow })  NaN, undefined, Infinity and [object …] in any text (hidden text included) or in
//   the attributes aria-label, aria-valuetext, aria-description, title, alt, placeholder; data-num values that do
//   not follow the format.js grammar. allow(token, context) may accept an occurrence.
// displayFindings(root, { skip })   for every [data-num] element: the display reads back as its raw value (a generic
//   rounding check: the raw value lies within half a unit of the last displayed digit; "below .001", "above .999",
//   fractions, percentages, scientific forms, grade vectors, sizes and tuples are read). A display that does not read
//   as a number fails, except formula labels (one number of the formula must agree). Elements in `skip` (covered by
//   an exact read-out expectation) are left to that check.
// textAlternativeFindings(root)     every figure, svg, canvas and img has a text alternative: alt (img), aria-label,
//   aria-labelledby with text, an SVG <title>, a figcaption, a labelled graphic inside a figure, or the hidden data
//   table chart.js puts next to the figure. aria-hidden="true", role presentation/none and alt="" with one of those
//   mark a decorative graphic. A graphic inside a figure (or an svg) that passes is covered by it.
// widgetFindings(root, { skip, authored })  all four.
// parseDataNum(text) -> { ok, value }    "NA" -> null, "1,2,2" -> [1, 2, 2], digits beyond 2^53 -> BigInt
// describe(node, root) -> a short selector-like path for messages; notRendered(node, root)
export const CONFIG = Object.freeze({
  numberScope: [
    '[data-prx-part~="readout"]', '[data-prx-part~="table"]', '[data-prx-part~="chart"]', '[data-prx-part~="legend"]',
    '[data-prx-part~="caption"]', '[data-prx-part~="notes"]', '[data-prx-part~="title"]', "[aria-live]", "table",
    "figure", "svg", "output", "math", ".prx-math-label", "[data-prx-label]", "[data-prx-caption]",
  ].join(", "),
  captionPart: '[data-prx-part~="caption"]',
  notText: new Set(["script", "style", "template", "noscript", "title", "desc", "annotation", "annotation-xml"]),
  exemptText: '[data-prx-label], [data-prx-family]',
  nameAttr: "data-prx-name",
  referenceWords: ["Grade", "Grades", "grade", "grades", "Part", "Step", "Rung", "rung", "Figure", "Table", "Criterion",
    "criterion", "Chapter", "chapter", "Section", "section", "Appendix", "Example", "Exercise", "Question", "Slide", "slide",
    "Slides", "slides", "Equation", "Box", "box"],
  yearMin: 1900,
  yearMax: 2099,
  mathScripts: new Set(["msub", "msup", "msubsup", "munder", "mover", "munderover", "mmultiscripts"]),
  badAttributes: ["aria-label", "aria-valuetext", "aria-description", "title", "alt", "placeholder"],
  fractionTolerance: 1e-9,
  readTolerance: 1e-12,
  graphics: "figure, svg, canvas, img",
  dataTable: ".prx-data-table",
  contextChars: 40,
});

const MINUS = "−";
const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const TOKEN = /[+−-]?(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+−-]?\d+)?%?/gu;
const REFERENCE = new RegExp(`(?:^|[^\\p{L}])(?:${CONFIG.referenceWords.join("|")})\\s+$`, "u");
const LEFT_IDENT = /[\p{L}\p{N}_]/u;
const ORDINAL = /^(?:st|nd|rd|th)\b/;
const BAD = [
  { token: "NaN", re: /\bNaN\b/g },
  { token: "undefined", re: /\bundefined\b/g },
  { token: "Infinity", re: /(?<![\p{L}\p{N}_])-?Infinity\b/gu },
  { token: "[object]", re: /\[object [A-Za-z]+\]/g },
];
const DATA_NUM = /^(?:NA|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:,(?:NA|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?))*$/;

const tag = (n) => n?.tagName?.toLowerCase?.() ?? "";

/** A short selector-like path of a node inside root (for messages). */
export function describe(node, root) {
  const parts = [];
  for (let n = node?.nodeType === 3 ? node.parentElement : node; n && n !== root?.parentElement && parts.length < 4; n = n.parentElement) {
    let s = tag(n);
    if (n.id) s += `#${n.id}`;
    const part = n.getAttribute?.("data-prx-part");
    if (part) s += `[data-prx-part="${part}"]`;
    else if (n.classList?.length) s += `.${[...n.classList].slice(0, 2).join(".")}`;
    parts.unshift(s);
    if (n === root) break;
  }
  return parts.join(" > ");
}

const excerpt = (s, at = 0, len = CONFIG.contextChars) => {
  const a = Math.max(0, at - len / 2);
  return s.slice(a, a + len * 2).replace(/\s+/g, " ").trim();
};

/** True when node (an element or text) is not rendered text: inside a non-text element or a hidden element. */
export function notRendered(node, root) {
  for (let n = node.nodeType === 3 ? node.parentElement : node; n; n = n.parentElement) {
    if (CONFIG.notText.has(tag(n))) return true;
    if (n.hasAttribute?.("hidden")) return true;
    if (n === root) break;
  }
  return false;
}

function textNodes(scope) {
  const doc = scope.ownerDocument ?? scope;
  const out = [];
  const walker = doc.createTreeWalker(scope, doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  return out;
}

function mathIndex(textNode) {
  const el = textNode.parentElement;
  if (tag(el) !== "mn" && tag(el) !== "mi") return false;
  for (let child = el, p = el.parentElement; p; child = p, p = p.parentElement) {
    if (CONFIG.mathScripts.has(tag(p))) return p.firstElementChild !== child;
    if (tag(p) === "math") return false;
  }
  return false;
}

/** The catalog caption written by base.js: a text node directly in a caption part, equal to an authored string. */
function authoredCaption(textNode, authored) {
  if (!authored.size) return false;
  const el = textNode.parentElement;
  return Boolean(el?.matches?.(CONFIG.captionPart)) && authored.has(textNode.data.trim());
}

/** Numbers in the scanned parts of root without a data-num ancestor (see the header). */
export function numberFindings(root, { authored = [] } = {}) {
  const findings = [];
  const seen = new Set();
  const own = new Set([...authored].filter((s) => typeof s === "string" && s.trim() !== "").map((s) => s.trim()));
  const scopes = [...(root.matches?.(CONFIG.numberScope) ? [root] : []), ...root.querySelectorAll(CONFIG.numberScope)];
  for (const scope of scopes) {
    for (const t of textNodes(scope)) {
      if (seen.has(t)) continue;
      seen.add(t);
      if (!/\d/.test(t.data)) continue;
      if (notRendered(t, root)) continue;
      const el = t.parentElement;
      if (el.closest("[data-num]")) continue;
      if (el.closest(CONFIG.exemptText)) continue;
      if (mathIndex(t)) continue;
      if (authoredCaption(t, own)) continue;
      const inName = Boolean(el.closest(`[${CONFIG.nameAttr}]`));
      let prefix = "";
      for (let p = t.previousSibling; p && prefix.length < CONFIG.contextChars; p = p.previousSibling) prefix = (p.textContent ?? "") + prefix;
      const text = t.data;
      const bad = [];
      for (const m of text.matchAll(TOKEN)) {
        const tok = m[0];
        const before = prefix + text.slice(0, m.index);
        const left = Array.from(before).at(-1) ?? "";
        const after = text.slice(m.index + tok.length);
        const plainInt = /^\d+$/.test(tok);
        if (LEFT_IDENT.test(left)) continue;
        if (ORDINAL.test(after)) continue;
        if (plainInt && REFERENCE.test(before)) continue;
        if (plainInt && tok.length === 4 && Number(tok) >= CONFIG.yearMin && Number(tok) <= CONFIG.yearMax && (left === "(" || after[0] === ")")) continue;
        if (plainInt && inName) continue;
        bad.push(tok);
      }
      if (bad.length) {
        findings.push({ rule: "no-data-num", where: describe(el, root), token: bad[0], count: bad.length, text: excerpt(text, text.indexOf(bad[0])) });
      }
    }
  }
  return findings;
}

/** NaN, undefined, Infinity, [object …] in text or attributes, and malformed data-num values (see the header). */
export function badTokenFindings(root, { allow } = {}) {
  const findings = [];
  const check = (s, where, node, kind) => {
    for (const { token, re } of BAD) {
      for (const m of s.matchAll(re)) {
        if (allow?.(token, { text: s, index: m.index, node, kind })) continue;
        findings.push({ rule: "bad-token", where, token, text: excerpt(s, m.index) });
      }
    }
  };
  for (const t of textNodes(root)) {
    const p = t.parentElement;
    if (p && (tag(p) === "script" || tag(p) === "style")) continue;
    if (/NaN|undefined|Infinity|\[object /.test(t.data)) check(t.data, describe(p, root), t, "text");
  }
  const all = [...(root.nodeType === 1 ? [root] : []), ...root.querySelectorAll("*")];
  for (const el of all) {
    for (const a of CONFIG.badAttributes) {
      const v = el.getAttribute(a);
      if (v && /NaN|undefined|Infinity|\[object /.test(v)) check(v, `${describe(el, root)} @${a}`, el, "attribute");
    }
    const dn = el.getAttribute("data-num");
    if (dn !== null && !DATA_NUM.test(dn)) findings.push({ rule: "bad-data-num", where: describe(el, root), token: dn, text: excerpt(el.textContent ?? "") });
  }
  return findings;
}

/** data-num text -> { ok, value }: NA -> null, comma lists -> arrays, integers beyond 2^53 -> BigInt. */
export function parseDataNum(s) {
  if (typeof s !== "string" || !DATA_NUM.test(s)) return { ok: false, value: undefined };
  const one = (x) => {
    if (x === "NA") return null;
    if (/^-?\d+$/.test(x) && !Number.isSafeInteger(Number(x))) return BigInt(x);
    return Number(x);
  };
  const parts = s.split(",");
  return { ok: true, value: parts.length > 1 ? parts.map(one) : one(parts[0]), list: parts.length > 1 };
}

// --------------------------------------------------------------------------------------- reading a display back

function plainNumber(s) {
  const t = s.replace(/−/g, "-").replace(/,(?=\d{3}(?:\D|$))/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(t)) return null;
  const dec = (t.split(".")[1] ?? "").length;
  return { v: Number(t), half: 0.5 * 10 ** -dec };
}

function supNumber(s) {
  let out = "";
  for (const ch of s) {
    if (!(ch in SUPERSCRIPT)) return null;
    out += SUPERSCRIPT[ch];
  }
  return /^-?\d+$/.test(out) ? Number(out) : null;
}

/** One displayed item -> a reading { kind: "value", v, half } | { kind: "below" | "above", x } | { kind: "na" } | null. */
export function readItem(raw) {
  const s = raw.trim();
  if (s === "NA" || s === "NA: no disclosure") return { kind: "na" };
  let m = /^(?:below |<)(.+)$/.exec(s);
  if (m) { const r = readItem(m[1]); return r?.kind === "value" ? { kind: "below", x: r.v } : null; }
  m = /^(?:above |>)(.+)$/.exec(s);
  if (m) { const r = readItem(m[1]); return r?.kind === "value" ? { kind: "above", x: r.v } : null; }
  m = /^(.+)%$/.exec(s);
  if (m) { const r = plainNumber(m[1]); return r ? { kind: "value", v: r.v / 100, half: r.half / 100 } : null; }
  m = /^([+−-]?\d+)\/(\d+)$/.exec(s);
  if (m) {
    const v = Number(m[1].replace(MINUS, "-")) / Number(m[2]);
    return { kind: "value", v, half: CONFIG.fractionTolerance * Math.max(1, Math.abs(v)) };
  }
  m = /^([+−-]?(?:\d+(?:\.\d+)?|\.\d+))e([+−-]?\d+)$/.exec(s);
  if (m) {
    const mant = plainNumber(m[1]);
    const e = Number(m[2].replace(MINUS, "-"));
    return mant ? { kind: "value", v: mant.v * 10 ** e, half: mant.half * 10 ** e } : null;
  }
  m = /^(?:([+−-]?(?:\d+(?:\.\d+)?|\.\d+)) × )?10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(s);
  if (m) {
    const mant = m[1] ? plainNumber(m[1]) : { v: 1, half: 0 };
    const e = supNumber(m[2]);
    return mant && e !== null ? { kind: "value", v: mant.v * 10 ** e, half: Math.max(mant.half, CONFIG.readTolerance) * 10 ** e } : null;
  }
  const r = plainNumber(s);
  return r ? { kind: "value", ...r, digits: /^[+-]?\d[\d,]*$/.test(s) ? s.replace(/,/g, "") : null } : null;
}

/** A display string -> a list of readings (one per element of a vector), or null when it does not read. */
export function readDisplay(display, rawIsList) {
  let s = display.trim();
  if (s.startsWith("sizes ")) s = s.slice("sizes ".length);
  let items;
  const tuple = /^\((.*)\)$/.exec(s);
  if (tuple) items = tuple[1].split(/,\s+/);
  else if (rawIsList && /^\d+(?:\/\d+)+$/.test(s)) items = s.split("/");
  else if (rawIsList && s.includes(", ")) items = s.split(", ");
  else items = [s];
  const out = items.map(readItem);
  return out.some((x) => x === null) ? null : out;
}

function agrees(reading, raw) {
  const v = typeof raw === "bigint" ? Number(raw) : raw;
  if (reading.kind === "na") return raw === null;
  if (raw === null || typeof v !== "number" || !Number.isFinite(v)) return false;
  if (reading.kind === "below") return v !== 0 && Math.abs(v) < reading.x;
  if (reading.kind === "above") return v > reading.x;
  if (typeof raw === "bigint") return reading.digits !== null && reading.digits !== undefined && BigInt(reading.digits) === raw;
  return Math.abs(v - reading.v) <= reading.half + CONFIG.readTolerance * Math.max(1, Math.abs(reading.v));
}

/** Why a display does not read as its raw value, or null when it does. */
export function displayProblem(display, parsed) {
  const raw = parsed.value;
  const list = Array.isArray(raw);
  const readings = readDisplay(display, list);
  if (!readings) return `display "${display}" does not read as a number`;
  const raws = list ? raw : [raw];
  if (readings.length !== raws.length) return `display "${display}" has ${readings.length} value(s), data-num has ${raws.length}`;
  for (let i = 0; i < raws.length; i++) {
    if (!agrees(readings[i], raws[i])) return `display "${display}" does not round from data-num ${list ? `element ${i} ` : ""}${String(raws[i])}`;
  }
  return null;
}

const isFormula = (el) => el.classList?.contains("prx-math-label") || Boolean(el.querySelector?.("math"));

/** Generic display check of every [data-num] element (see the header). */
export function displayFindings(root, { skip = new Set() } = {}) {
  const findings = [];
  const all = [...(root.matches?.("[data-num]") ? [root] : []), ...root.querySelectorAll("[data-num]")];
  for (const el of all) {
    if (skip.has(el)) continue;
    const parsed = parseDataNum(el.getAttribute("data-num"));
    if (!parsed.ok) continue; // badTokenFindings reports it
    const display = (el.textContent ?? "").trim();
    if (isFormula(el)) {
      if (Array.isArray(parsed.value)) continue;
      const tokens = [...display.matchAll(TOKEN)].map((m) => m[0]);
      if (!tokens.some((tok) => displayProblem(tok, parsed) === null)) {
        findings.push({ rule: "display-generic", where: describe(el, root), token: el.getAttribute("data-num"), text: `formula label "${excerpt(display)}" shows no number that rounds from data-num ${el.getAttribute("data-num")}` });
      }
      continue;
    }
    const problem = displayProblem(display, parsed);
    if (problem) findings.push({ rule: "display-generic", where: describe(el, root), token: el.getAttribute("data-num"), text: problem });
  }
  return findings;
}

// ------------------------------------------------------------------------------------------ text alternatives

function nameOf(el) {
  const doc = el.ownerDocument;
  const label = (el.getAttribute("aria-label") ?? "").trim();
  if (label) return label;
  const ids = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
  const byIds = ids.map((id) => doc.getElementById(id)?.textContent ?? "").join(" ").trim();
  if (byIds) return byIds;
  if (tag(el) === "img") return (el.getAttribute("alt") ?? "").trim();
  if (tag(el) === "svg") {
    const title = [...el.children].find((c) => tag(c) === "title");
    if (title?.textContent.trim()) return title.textContent.trim();
  }
  if (tag(el) === "figure") {
    const cap = [...el.children].find((c) => tag(c) === "figcaption");
    if (cap?.textContent.trim()) return cap.textContent.trim();
  }
  if (tag(el) === "canvas" && el.textContent.trim()) return el.textContent.trim();
  return "";
}

const decorative = (el) => el.getAttribute("aria-hidden") === "true" || ["presentation", "none"].includes(el.getAttribute("role") ?? "");

function figurePasses(fig) {
  if (nameOf(fig)) return true;
  if ([...fig.querySelectorAll("svg, img, canvas")].some((g) => !decorative(g) && nameOf(g))) return true;
  const next = fig.nextElementSibling;
  if (next && (next.matches(CONFIG.dataTable) || next.querySelector?.(CONFIG.dataTable))) return true;
  return false;
}

/** Graphics without a text alternative (see the header). */
export function textAlternativeFindings(root) {
  const findings = [];
  for (const el of root.querySelectorAll(CONFIG.graphics)) {
    if (decorative(el) || el.closest('[aria-hidden="true"]')) continue;
    const t = tag(el);
    if (t === "figure") {
      if (!figurePasses(el)) findings.push({ rule: "no-text-alternative", where: describe(el, root), token: t, text: "figure without figcaption, label, labelled graphic or data table" });
      continue;
    }
    if (t !== "svg" && el.parentElement?.closest("svg")) continue;
    if (t === "svg" && el.parentElement?.closest("svg")) continue;
    if (nameOf(el)) continue;
    const fig = el.parentElement?.closest("figure");
    if (fig && figurePasses(fig)) continue;
    if (t === "img" && el.getAttribute("alt") === null) {
      findings.push({ rule: "no-text-alternative", where: describe(el, root), token: t, text: "img without alt" });
      continue;
    }
    findings.push({ rule: "no-text-alternative", where: describe(el, root), token: t, text: `${t} without aria-label, aria-labelledby${t === "svg" ? ", <title>" : ""} or a labelled figure` });
  }
  return findings;
}

/** All rules on a mounted app (numbers, bad tokens, displays, text alternatives). */
export function widgetFindings(root, { skip, authored } = {}) {
  return [...numberFindings(root, { authored }), ...badTokenFindings(root), ...displayFindings(root, { skip }), ...textAlternativeFindings(root)];
}
