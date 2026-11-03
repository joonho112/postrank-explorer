// labels.js: result labels and captions (from postrank Explorer v1, whose caption registry these strings were).
//
// A widget shows a result label only through this module, so that the label always comes from the engine's return
// value and the checks can find it:
//
//   import { captionNodes, familySizeNode, labelNode } from "./labels.js";
//   const r = exactOptimum(E, { tau: state.tau, family });
//   ctx.readout.set([labelNode(ctx, r), " (", familySizeNode(ctx, r), " reports); risk ", ctx.num(r.risk, formatRisk(r.risk))]);
//   const d = fixedOrderDP(E, { order, tau: state.tau, G: 3 });          // a label without a family slot:
//   ctx.readout.set([labelNode(ctx, d, { key: "order" }), " in ", familyNameNode(ctx, d), " (", familySizeNode(ctx, d), " cut sets)"]);
//   ctx.caption.replaceChildren(...captionNodes(ctx, evaluation));        // "evaluation of a fixed report"
//
// labelId(result)          the label of an engine return value, or null:
//                            label "exact-within-family"               -> "exact-within-family"
//                            label "optimal-within-order"              -> "optimal-within-order"
//                            label "optimal-within-solver-tolerances"  -> the same, only with status "optimal"
//                            no label field, status "optimal"          -> "optimal-within-solver-tolerances" (the status
//                                                                         field of a released archived solve)
//                            an empty family, label null or "monte-carlo", anything else -> null
// labelText(id, family, { slot })  the registry string; the family slot takes family.name (or a name string), or
//                          family.words with slot "words" (pages before G-04, where the family symbols are introduced).
//                          This is the text form (textContent of a label node): the engine name as it is, 𝒜_≤3.
// familyContent(target, name)  the screen form of a family name, as nodes: every low line and the run after it (up
//                          to a space or a parenthesis) become a hidden low line and a <sub>, so 𝒜_≤3 is drawn as 𝒜
//                          with ≤3 as a subscript and 𝒜_q (𝒜_≤3) as 𝒜 sub q (𝒜 sub ≤3). The hidden low line keeps the
//                          text form unchanged (textContent, read-out checks); CSS hides it (base.css .prx-family-low)
//                          and it is aria-hidden.
//                          label_form. Names without a low line (𝒜₆, 𝒜ᵨ,≤3) are written as they are.
// markLabelStarts(root)    marks with data-prx-label-start every block (p, div, li, td, …) whose first content is a
//                          result label, so CSS capitalises the label's first letter there (base.css; the strings stay
//                          exact). base.js runs it after every render and on every DOM change inside a widget.
// tagNode(ctx, result)     the short form ("best of all 4,683 reports"); prefer it inside apps
// captionText(id)          the registry string of a caption
// captionIds(result)       the captions a result needs: ["monte-carlo"] for label "monte-carlo", ["fixed-report"] for a
//                          report evaluation (risk, N and M, no label, no family), [] otherwise
// sourceOf(result)         the engine fields a label is derived from: { label?, status?, empty, family }
// exposeResult(ctx, result, key)  keep the engine return value on the widget root (non-enumerable root.__prxResults[key])
//                          so a check can derive the label again from the object itself; returns the key
// labelNode(ctx, result, { key })  <span class="prx-result-label" data-prx-label data-prx-family data-prx-source
//                          data-prx-result>label</span>, or null when the result has no label. With a ctx (or the widget
//                          root) the result is exposed under key (default "main"); with a document it is not.
// familyNameNode(ctx, result)  <span data-prx-family>name</span> (screen form, familyContent): the family name outside
//                          the label, required beside a label without a family slot
// familySizeNode(ctx, result)  <span class="prx-num" data-num data-prx-family-size>size</span>
// captionNode(ctx, id, slots)  <span class="prx-result-caption" data-prx-caption="id">caption</span>; with slots, a
//                          caption that has a template is written in its screen form, each slot a data-num span
// captionNodes(ctx, result)  captionNode for every id of captionIds(result), slots filled from the result
//
// The first argument may be a widget ctx, the widget root, any element, or a document. Nodes are made with that
// document, so jsdom windows work. Node text never contains a number outside a data-num span except the family name,
// which sits in data-prx-family (an identifier, not a number).

import { formatCount, formatSetting, numSpan } from "./format.js";

export const CONFIG = Object.freeze({
  slot: "⟨family⟩",
  labels: Object.freeze({
    "exact-within-family": "exact optimum within ⟨family⟩",
    "optimal-within-order": "optimal within this order",
    "optimal-within-solver-tolerances": "optimal within solver tolerances",
  }),
  captions: Object.freeze({
    "fixed-report": "evaluation of a fixed report",
    "fixed-tiers": "fixed tiers, not optimized",
    "krw-card": "KRW card computed by KRW's code under KRW's archived pair probabilities (KRW's solver tolerances)",
    "mixture-not-report": "a mixture of two complete reports, not a report we can print",
    "different-disclosure": "these reports disclose different amounts",
    "tau-not-compared": "risks at different τ are not compared",
    "teaching-posterior": "a posterior set by hand for teaching; postrank does not fit it",
    "flat-posterior": "the chance a direction is wrong takes each true value as normal around its estimate, with its SE",
    "monte-carlo": "Monte Carlo, S draws, seed shown",
    "package-quantity": "package quantity",
    "learning-use": "learning use; an analysis for reporting runs in R",
  }),
  templates: Object.freeze({
    "monte-carlo": "Monte Carlo, ⟨S⟩ draws, seed ⟨seed⟩",
  }),
  solverLabel: "optimal-within-solver-tolerances",
  solverStatus: "optimal",
  monteCarlo: "monte-carlo",
  fixedReport: "fixed-report",
  defaultKey: "main",
  resultsProperty: "__prxResults",
  labelClass: "prx-result-label",
  captionClass: "prx-result-caption",
  attributes: Object.freeze({
    label: "data-prx-label",
    family: "data-prx-family",
    source: "data-prx-source",
    result: "data-prx-result",
    familySize: "data-prx-family-size",
    caption: "data-prx-caption",
    slot: "data-prx-slot",
  }),
  // A page before the family symbols are introduced fills the label slot with the family in words.
  slotWords: "words",
  // The screen form of a family name.
  familyForm: Object.freeze({
    low: "_",
    subscriptRun: "[^\\s()]+",
    lowClass: "prx-family-low",
    subClass: "prx-family-sub",
  }),
  // A block whose first content is a result label: CSS capitalises its first letter (I-03).
  labelStart: "data-prx-label-start",
  blockTags: Object.freeze(["P", "DIV", "LI", "DD", "DT", "TD", "TH", "CAPTION", "FIGCAPTION", "LEGEND", "SUMMARY",
    "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION", "ARTICLE", "ASIDE", "OUTPUT"]),
});

const A = CONFIG.attributes;
const SLOT = /⟨([^⟩]+)⟩/g;
// screen formatters of the template slots
const SLOT_FORMAT = Object.freeze({ S: (v) => formatCount(v), seed: (v) => formatSetting(v) });

const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const has = (o, k) => isRecord(o) && Object.prototype.hasOwnProperty.call(o, k);

function docOf(target) {
  const d = target?.doc ?? (target?.nodeType === 9 ? target : target?.ownerDocument) ?? globalThis.document;
  if (!d) throw new TypeError("labels: pass a widget ctx, an element or a document");
  return d;
}

function rootOf(target) {
  if (target?.root?.nodeType === 1) return target.root;
  if (target?.nodeType === 1) return target.closest?.(".prx-widget") ?? target;
  return null;
}

/** The result label id of an engine return value, or null (see the header). */
export function labelId(result) {
  if (!isRecord(result) || result.empty === true) return null;
  if (has(result, "label")) {
    const L = result.label;
    if (L === CONFIG.solverLabel) return result.status === CONFIG.solverStatus ? L : null;
    return L !== CONFIG.solverLabel && has(CONFIG.labels, L) ? L : null;
  }
  return result.status === CONFIG.solverStatus ? CONFIG.solverLabel : null;
}

/** The registry string of a label, the family slot filled with family.name (or a name string); with
 *  { slot: "words" } it takes family.words. */
export function labelText(id, family, { slot } = {}) {
  const text = CONFIG.labels[id];
  if (text === undefined) throw new RangeError(`labels: unknown label "${id}"`);
  if (!text.includes(CONFIG.slot)) return text;
  const raw = typeof family === "string" ? family : slot === CONFIG.slotWords ? family?.words : family?.name;
  // the engine writes the budget condition in code form; show it with subscripts
  const name = typeof raw === "string" ? raw.replace(/E_k ≤ q_k N/g, "Eₖ ≤ qₖN") : raw;
  if (typeof name !== "string" || name === "") throw new TypeError(`labels: the label "${id}" needs the family name (result.family.name)`);
  return text.replace(CONFIG.slot, name);
}

/** The registry string of a caption. */
export function captionText(id) {
  const text = CONFIG.captions[id];
  if (text === undefined) throw new RangeError(`labels: unknown caption "${id}"`);
  return text;
}

const isEvaluation = (r) => isRecord(r) && !has(r, "label") && !has(r, "family")
  && Number.isFinite(r.risk) && Number.isFinite(r.N) && Number.isFinite(r.M);

/** The caption ids a result needs (see the header). */
export function captionIds(result) {
  if (!isRecord(result)) return [];
  if (result.label === CONFIG.monteCarlo) return [CONFIG.monteCarlo];
  if (isEvaluation(result)) return [CONFIG.fixedReport];
  return [];
}

const sizeOf = (family) => {
  const exact = family?.sizeExact;
  if (typeof exact === "bigint") return exact.toString();
  return family?.size === undefined || family?.size === null ? null : String(family.size);
};

/** The engine fields a label is derived from (written into data-prx-source). */
export function sourceOf(result) {
  const out = {};
  if (has(result, "label")) out.label = result.label ?? null;
  if (has(result, "status")) out.status = result.status ?? null;
  out.empty = isRecord(result) && result.empty === true;
  out.family = isRecord(result?.family) ? { name: result.family.name ?? null, size: sizeOf(result.family) } : null;
  if (out.family && typeof result.family.words === "string") out.family.words = result.family.words;
  return out;
}

/** Keep an engine return value on the widget root for the checks; returns the key. */
export function exposeResult(target, result, key = CONFIG.defaultKey) {
  const root = rootOf(target);
  if (!root) throw new TypeError("labels: exposeResult needs a widget ctx or the widget root");
  let store = root[CONFIG.resultsProperty];
  if (!store) {
    store = {};
    Object.defineProperty(root, CONFIG.resultsProperty, { value: store, configurable: true, enumerable: false });
  }
  store[key] = result;
  return key;
}

/** The engine return values exposed on a widget root ({} when none). */
export function exposedResults(root) {
  return root?.[CONFIG.resultsProperty] ?? {};
}

const FAMILY_RE = new RegExp(`${CONFIG.familyForm.low.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(${CONFIG.familyForm.subscriptRun})`, "gu");
const BLOCKS = new Set(CONFIG.blockTags);

/** The screen form of a family name as nodes (see the header): text, then a hidden low line and a <sub> for every
 *  low-line run. Returns an array of strings and elements made with the target's document. */
export function familyContent(target, name) {
  const s = String(name ?? "");
  const doc = docOf(target);
  const out = [];
  let at = 0;
  for (const m of s.matchAll(FAMILY_RE)) {
    if (m.index > at) out.push(s.slice(at, m.index));
    const low = doc.createElement("span");
    low.className = CONFIG.familyForm.lowClass;
    low.setAttribute("aria-hidden", "true");
    low.textContent = CONFIG.familyForm.low;
    const sub = doc.createElement("sub");
    sub.className = CONFIG.familyForm.subClass;
    sub.textContent = m[1];
    out.push(low, sub);
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}

const firstContent = (el) => {
  for (const n of el.childNodes) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.data.trim() !== "") return n;
  }
  return null;
};

/** Mark the blocks inside root whose first content is a result label (see the header); old marks are cleared.
 *  Returns the number of marked blocks. */
export function markLabelStarts(root) {
  if (!root?.querySelectorAll) return 0;
  const marked = new Set();
  for (const label of root.querySelectorAll(`[${A.label}]`)) {
    for (let n = label; n && n !== root;) {
      const p = n.parentElement;
      if (!p || !root.contains(p) || firstContent(p) !== n) break;
      if (BLOCKS.has(p.tagName.toUpperCase())) { marked.add(p); break; }
      n = p;
    }
  }
  for (const el of root.querySelectorAll(`[${CONFIG.labelStart}]`)) if (!marked.has(el)) el.removeAttribute(CONFIG.labelStart);
  for (const el of marked) if (!el.hasAttribute(CONFIG.labelStart)) el.setAttribute(CONFIG.labelStart, "");
  return marked.size;
}

/** A label node for an engine result, or null when it has no label (see the header). */
export function labelNode(target, result, { key, slot } = {}) {
  const id = labelId(result);
  if (!id) return null;
  const doc = docOf(target);
  const node = doc.createElement("span");
  node.className = CONFIG.labelClass;
  node.setAttribute(A.label, id);
  if (CONFIG.labels[id].includes(CONFIG.slot)) {
    node.setAttribute(A.family, result.family?.name ?? "");
    if (slot === CONFIG.slotWords) node.setAttribute(A.slot, CONFIG.slotWords);
  }
  node.setAttribute(A.source, JSON.stringify(sourceOf(result)));
  if (rootOf(target) && target?.nodeType !== 9) node.setAttribute(A.result, exposeResult(target, result, key ?? CONFIG.defaultKey));
  const text = labelText(id, result.family, { slot });
  const slotted = CONFIG.labels[id].includes(CONFIG.slot);
  if (!slotted || slot === CONFIG.slotWords || typeof result.family?.name !== "string") {
    node.textContent = text;
    return node;
  }
  // the family slot in its screen form; the text form (textContent) is unchanged
  const [before, after] = CONFIG.labels[id].split(CONFIG.slot);
  node.append(before, ...familyContent(doc, result.family.name), after);
  return node;
}

/**
 * A short tag for a result: what the result is the best of, with the family size.
 *   exact optimum      "best of all 4,683 reports" / "best of the 603 reports with at most 3 grades"
 *                      (with budgets "… that meet the error budgets", "… the error budget" when only one criterion has one)
 *   one order          "best along one order (32 reports)"; with orderWords, the order is named:
 *                      "best along the expected-rank order (4,090 reports)", "best along the order B, A, C, D, E, F (32 reports)"
 *   archived solve     "best found by the solver"
 * The node carries the same data attributes as labelNode, so a check can derive it from the engine result.
 */
export function tagNode(target, result, { key, orderWords } = {}) {
  const id = labelId(result);
  if (!id) return null;
  const doc = docOf(target);
  const node = doc.createElement("span");
  node.className = "prx-result-tag";
  node.setAttribute(A.label, id);
  node.setAttribute(A.source, JSON.stringify(sourceOf(result)));
  if (rootOf(target) && target?.nodeType !== 9) node.setAttribute(A.result, exposeResult(target, result, key ?? CONFIG.defaultKey));
  const size = familySizeNode(doc, result);
  // a tag stays in words: the budget condition the engine writes in code form is left out ("… that meet the error
  // budgets"), and with a budget on exactly one criterion (family.budgets, null = none) it is "the error budget"
  const budgets = Array.isArray(result.family?.budgets) ? result.family.budgets.filter((q) => q !== null && q !== undefined) : [];
  let words = typeof result.family?.words === "string" ? result.family.words.replace(/\s*E_k ≤ q_k N/g, "") : "";
  if (budgets.length === 1) words = words.replace(/\berror budgets\b/, "error budget");
  if (id === "exact-within-family" && size) {
    if (/^all reports/.test(words) || !words) node.append("best of all ", size, " reports");
    else node.append("best of the ", size, " ", words);
  } else if (id === "optimal-within-order") {
    node.append(`best along ${typeof orderWords === "string" && orderWords ? orderWords : "one order"}`);
    if (size) node.append(" (", size, " reports)");
  } else if (id === "optimal-within-solver-tolerances") {
    node.append("best found by the solver");
  } else {
    node.textContent = labelText(id, result.family);
  }
  return node;
}

/** The family name of a result in a data-prx-family span, or null. */
export function familyNameNode(target, result) {
  const name = result?.family?.name;
  if (typeof name !== "string") return null;
  const doc = docOf(target);
  const node = doc.createElement("span");
  node.setAttribute(A.family, name);
  node.append(...familyContent(doc, name));
  return node;
}

/** The family size of a result as a data-num span marked data-prx-family-size, or null. */
export function familySizeNode(target, result) {
  const family = result?.family;
  if (!isRecord(family)) return null;
  const raw = typeof family.sizeExact === "bigint" ? family.sizeExact : typeof family.size === "string" ? BigInt(family.size) : family.size;
  if (raw === undefined || raw === null) return null;
  const node = numSpan(raw, formatCount(raw), { document: docOf(target) });
  node.setAttribute(A.familySize, "");
  return node;
}

/** A caption node; with slots, a caption with a template is written in its screen form. */
export function captionNode(target, id, slots) {
  const text = captionText(id);
  const doc = docOf(target);
  const node = doc.createElement("span");
  node.className = CONFIG.captionClass;
  node.setAttribute(A.caption, id);
  const template = CONFIG.templates[id];
  if (!template || !isRecord(slots)) {
    node.textContent = text;
    return node;
  }
  let at = 0;
  for (const m of template.matchAll(SLOT)) {
    if (m.index > at) node.append(template.slice(at, m.index));
    const name = m[1];
    const v = slots[name];
    const fmt = SLOT_FORMAT[name];
    if (!fmt || !(typeof v === "number" || typeof v === "bigint")) throw new TypeError(`labels: caption "${id}" needs a number for ${name}`);
    node.append(numSpan(v, fmt(v), { document: doc }));
    at = m.index + m[0].length;
  }
  if (at < template.length) node.append(template.slice(at));
  return node;
}

/** Caption nodes for every caption a result needs, slots filled from the result. */
export function captionNodes(target, result) {
  return captionIds(result).map((id) => captionNode(target, id, CONFIG.templates[id] ? result : undefined));
}
