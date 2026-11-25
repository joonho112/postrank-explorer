// base.js: the frame every app is built on: state and keys, controls, the preset row, the read-out, resize, reduced
// motion, theme, URL parameters and the postMessage bridge. No DOM access at import time, so node can import it; every node
// is made with the document that owns the mount element, so jsdom windows and iframes work.
// (From postrank Explorer v1, js/widgets/base.js, without the prediction gate and present mode.)
//
// An app file looks like this (js/apps/price-of-silence.js is the worked example; README.md describes the repository):
//
//   import { createWidget } from "../shared/base.js";
//   export function mountWidget(el, spec = {}) {
//     return createWidget(el, spec, {
//       name: "my-app",                                   // = the catalog name: presets and caption come from there
//       keys: { tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 } },
//       build(ctx) {
//         const tau = ctx.slider({ label: "Withholding cost τ", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
//         ctx.controls.append(tau.root);
//         const fig = ctx.h("div", { class: "prx-panel" });
//         ctx.charts.append(fig);
//         return { render(state) { tau.set(state.tau); ctx.readout.set(["τ = ", ctx.num(state.tau, formatSetting(state.tau))]); } };
//       },
//     });
//   }
//
// createWidget(el, spec, def) -> { update(partial), applyPreset(idOrSpec), destroy(), state, root }
//   def.name     the app's catalog name (catalog.json). The catalog entry gives the preset row (entry.presets; its label
//                is entry.presetLabel, default "Presets") and the
//                caption line (entry.caption); an app that is not in the catalog gets neither.
//   def.css      the app's own CSS rules (a string), added once per document as <style data-prx-app="name">; prefix
//                every selector with the app's root class (def.className) so apps never touch each other
//   def.className  a short class on the app root (for example "pos"), used to scope def.css
//   def.title    an optional title inside the app, above its controls (<h3 class="prx-title">; ctx.title)
//   def.layout   "classic" (default: controls, charts, read-out, caption) or "result-first" (review 044, X-01): the
//                read-out sits directly under the controls, so the one live sentence is next to what changes it:
//                title, controls (primary controls, ctx.disclosure "Settings" boxes, the preset row), read-out,
//                charts (the panel that changes first), disclosures (ctx.disclosure boxes), caption. The root carries
//                data-prx-layout="result-first"; at <= 600 px the preset row stays one line that scrolls sideways.
//   def.keys     { key: { type, min, max, step, value, values, snap, minLength, maxLength, parse } }; types "number",
//                "integer", "boolean", "string", "choice" (values: [...]), "numbers" (an array of numbers; a comma list
//                in a URL) and "custom" (parse(v, previous) -> value | undefined). Unknown keys are ignored; numbers
//                are clamped to [min, max] (snapped to the step grid only with snap: true); unreadable values keep
//                the old value.
//   def.build(ctx) -> { render(state, info), resize?(width), primary?(), destroy?() }; info = { initial, changed,
//                reason }. render runs once at mount, after every update that changes a key, and (debounced) on
//                resize and theme change. primary() is the app's main action (for example "Draw again"): Enter on a
//                slider, radio, checkbox or text field of the app runs it (ctx.onPrimary sets it too).
//   Spec, URL and message keys: the app's keys, plus `preset` (a preset id of the catalog entry), `theme`
//                ("light" | "dark") and `open` (names of ctx.disclosure boxes to open: ?open=data,method). The URL (location.search, or window.__PRX_QUERY) wins over the spec; a preset is
//                applied first and explicit keys after it. Theme colors follow <html data-theme>: embed pages
//                set it from ?theme= in their head, and a { theme } message sets it on the page. postMessage({ prx: { tau: 0.4 } }) or
//                postMessage({ prx: { preset: "tau40" } }) from the parent window reaches update() (bridge.js).
//   A preset is a whole setting: the keys its query does not name return to their defaults. A preset button is shown
//                pressed whenever the state equals its setting, however the state was reached.
//
// ctx: { el, root, frame, doc, win, h, state, set(partial), key(name), title, controls, charts, readout, caption,
//        num(raw, display), dataNum, slider, segmented, toggle, select, button, radioGroup, numberInput, panelTitle,
//        scrollRegion(node, label), part(name, node), presets, width(), reducedMotion, requestRender(reason),
//        keepFocus(fn), onPrimary(fn), listen, timeout, onCleanup, layout, disclosure(options), disclosures }
//   key(name)      { min, max, step, value } of a number key (value = current), to spread into a slider
//   readout.set(content)  the one aria-live region: strings and ctx.num nodes; an unchanged read-out is not rewritten
//   num(raw, display)     <span class="prx-num" data-num="raw">display</span> (format.js numSpan); use it for every
//                         number the app shows in text, so checks can read the raw value back
//   presets        the preset row (a node already placed after the app's controls, or null without presets)
//   part(name, node)      marks a node as a named part of the app (data-prx-part) and returns it; checks and CSS use it
//   scrollRegion(node, label)  a box that may scroll sideways becomes a keyboard stop (tabindex 0, role region)
//   keepFocus(fn)         runs fn and puts keyboard focus back on the control that had it (render does this already)
//   onPrimary(fn)         sets the app's main action, run by Enter on a slider, radio, checkbox or text field
//   disclosure({ name, title, open, placement })  a native <details> box for secondary or exhaustive material that
//                         stays complete but closed by default (review 044, X-14): returns { root, summary, body, open }.
//                         placement "end" (default) puts it in the disclosures group after the charts; "controls"
//                         puts it in the controls row before the preset row (a "Settings" box); { after: node } or
//                         { before: node } puts it next to the panel it belongs to; "none" leaves it to the app.
//                         Opening a box renders the app once more (info.reason "disclosure", info.disclosure = its
//                         name), so a figure inside is drawn at its real width; an app may skip costly figures outside
//                         that box. The box is made once in build, so redraws keep it open or closed. className adds
//                         classes to the box; its summary may be rewritten in render (a state-dependent count).
//   primaryGraphic(node)  marks the graphic the primary control changes (data-prx-primary); measurement and reviews
//                         read the first view against it; with several marked, the first one shown counts (review 044)
//   primaryControl(node)  marks the control that changes that graphic (data-prx-primary-control), when it is not the
//                         first control of the row; measurement also reports the distance from it to the read-out
//   afterPresets(...nodes)  puts controls whose set changes with a mode after the preset row, so the preset buttons
//                         never move when the mode changes (review 044, X-18; 1.9 is the example)
//   disclosures           the group of "end" boxes (made by the first such box), or null
//   Every listener, timer and observer made through ctx ends with destroy().
//
// Keyboard: Tab order follows the DOM (controls, preset row, figure). Sliders: arrows = one step, Shift+arrows and
// PageUp/PageDown = ten steps, Home/End = the ends. Buttons: Enter and Space (the browser's own). Enter on a slider,
// radio, checkbox or text field runs the app's main action, if it has one (primary / onPrimary).

import { attachBridge, CONFIG as BRIDGE, queryString, readQuery } from "./bridge.js";
import { dataNum, formatSetting, numSpan, setNum } from "./format.js";
import { markLabelStarts } from "./labels.js";
import CATALOG from "../../catalog.json" with { type: "json" };
import SITE_COPY from "../../catalog/site-copy.json" with { type: "json" };

export const CONFIG = Object.freeze({
  rootClass: "prx-widget",
  frameClass: "prx-frame",
  resizeDebounceMs: 120,
  readoutSettleMs: 500,
  resizeMinDelta: 4,
  defaultWidth: 640,
  shiftMultiplier: 10,
  pageMultiplier: 10,
  maxStepDecimals: 12,
  stepTolerance: 1e-9,
  presetTolerance: 1e-9,
  maxStringLength: 200,
  panelTitle: Object.freeze({ className: "prx-panel-title", level: 2, tag: "p", minLevel: 1, maxLevel: 6 }),
  scrollRegion: Object.freeze({ className: "prx-scroll-region", slackPx: 1 }),
  // links to other apps: a site page names its offset to the site root; a standalone page sits in embed/
  links: Object.freeze({ offsetMeta: 'meta[name="quarto:offset"]', embedPath: /\/embed\/[^/]+$/, embedRoot: "../" }),
  queries: Object.freeze({
    reducedMotion: "(prefers-reduced-motion: reduce)",
    dark: "(prefers-color-scheme: dark)",
  }),
  text: Object.freeze({ presets: "Presets", disclosure: "Details", settings: "Settings", data: "Data and exact values", method: "Method and details", renderError: "Unable to update this view." }),
  layouts: Object.freeze(["classic", "result-first", "v2"]),
  disclosure: Object.freeze({ className: "prx-disclosure", summaryClass: "prx-disclosure-summary", bodyClass: "prx-disclosure-body", groupClass: "prx-disclosures", placements: Object.freeze(["end", "controls", "none"]) }),
});

const RESERVED = new Set(BRIDGE.reservedKeys);
const FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Inputs on which Enter runs the app's main action (buttons keep the browser's own Enter and Space). */
const ENTER_TARGETS = new Set(["range", "radio", "checkbox", "number", "text", "search", "email", "url", "tel"]);
const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const tagIs = (node, tag) => node?.tagName?.toLowerCase() === tag;

let counter = 0;
/** A document-unique id with a prefix. */
export const uid = (prefix = "prx") => `${prefix}-${(counter += 1)}`;

// ------------------------------------------------------------------------------------------------- catalog

/** The catalog entry of an app (catalog.json), or null. */
const displayName = (name) => SITE_COPY.apps[name]?.title;

export function appInfo(name) {
  return CATALOG.apps.find((a) => a.name === name) ?? null;
}

/** The parts of the catalog, in order. */
export const parts = () => CATALOG.parts.slice();

/** The page of a built app, relative to the site root ("pages/<slug>/<name>.html"), or null while it is not built:
 *  a reference to another app is a link only when this returns a path. */
export function builtPage(name) {
  const a = appInfo(name);
  if (!a || a.status !== "built") return null;
  const slug = CATALOG.parts.find((s) => s.key === a.part)?.slug;
  return slug ? `pages/${slug}/${name}.html` : null;
}

/** Where links to other apps point from this document: { root, newTab } (a site page: Quarto's offset to the site
 *  root; a standalone page in embed/: the root above it, opened in a new tab), or null where page links cannot work
 *  (an app mounted elsewhere). */
export function linkRoot(doc) {
  const L = CONFIG.links;
  const meta = doc?.querySelector?.(L.offsetMeta);
  if (meta) {
    const c = (meta.getAttribute("content") || "").trim();
    return { root: c === "" ? "./" : c.endsWith("/") ? c : `${c}/`, newTab: false };
  }
  const path = doc?.defaultView?.location?.pathname ?? "";
  const pageRoot = doc?.querySelector?.('meta[name="prx-page-root"]')?.getAttribute("content");
  return L.embedPath.test(path) ? { root: pageRoot || L.embedRoot, newTab: true } : null;
}

/** Another app named in an app's text: its site title (else its catalog title or `title`) as a link once built
 *  and links work here, otherwise the title in quotes so it never runs into the sentence. */
export function appLink(ctx, name, { title, className = "prx-app-link" } = {}) {
  const text = displayName(name) ?? appInfo(name)?.title ?? title ?? name;
  const path = builtPage(name);
  const base = linkRoot(ctx.doc);
  if (!path || !base) return ctx.h("span", { class: className }, `“${text}”`);
  return ctx.h("a", {
    href: `${base.root}${path}`, class: className,
    target: base.newTab ? "_blank" : undefined, rel: base.newTab ? "noopener" : undefined,
  }, text);
}

// ------------------------------------------------------------------------------------------------- scope

/**
 * A scope owns the listeners, observers and timers of one app, and makes nodes with the mount element's document.
 * cleanup() removes everything it registered (idempotent).
 */
export function createScope(el) {
  const doc = el?.ownerDocument;
  if (!doc) throw new TypeError("createScope: a DOM element is required");
  const win = doc.defaultView;
  const undo = [];
  let closed = false;
  const removeUndo = (fn) => {
    const idx = undo.indexOf(fn);
    if (idx >= 0) undo.splice(idx, 1);
  };
  const scope = {
    el, doc, win,
    get closed() { return closed; },
    /** addEventListener that cleanup() removes; returns the remover. */
    listen(target, type, fn, options) {
      if (closed || !target || typeof target.addEventListener !== "function") return () => {};
      target.addEventListener(type, fn, options);
      let on = true;
      const off = () => {
        if (!on) return;
        on = false;
        removeUndo(off);
        target.removeEventListener(type, fn, options);
      };
      undo.push(off);
      return off;
    },
    /** setTimeout that cleanup() clears; removes itself from undo once fired. */
    timeout(fn, ms) {
      if (closed) return () => {};
      let active = true;
      let id = 0;
      const off = () => {
        if (!active) return;
        active = false;
        removeUndo(off);
        win.clearTimeout(id);
      };
      undo.push(off);
      id = win.setTimeout(() => {
        if (!active) return;
        active = false;
        removeUndo(off);
        if (!closed) fn();
      }, ms);
      return off;
    },
    /** Register any teardown function. */
    onCleanup(fn) {
      if (closed) return fn;
      undo.push(fn);
      return fn;
    },
    cleanup() {
      if (closed) return;
      closed = true;
      while (undo.length) {
        try { undo.pop()(); } catch (err) { console.warn("base: cleanup step failed", err); }
      }
    },
  };
  scope.h = elementFactory(doc, scope);
  return scope;
}

/**
 * Reusable child scope for transient listeners/timers created inside render().
 * cleanup() drains all registered listeners/timers before the next render (and on parent destroy)
 * while remaining open for subsequent renders until parentScope closes.
 */
function createRenderScope(parentScope) {
  const { el, doc, win } = parentScope;
  const undo = [];
  const removeUndo = (fn) => {
    const idx = undo.indexOf(fn);
    if (idx >= 0) undo.splice(idx, 1);
  };
  const child = {
    el, doc, win,
    get closed() { return parentScope.closed; },
    get activity() { return parentScope.activity; },
    listen(target, type, fn, options) {
      if (parentScope.closed || !target || typeof target.addEventListener !== "function") return () => {};
      target.addEventListener(type, fn, options);
      let on = true;
      const off = () => {
        if (!on) return;
        on = false;
        removeUndo(off);
        target.removeEventListener(type, fn, options);
      };
      undo.push(off);
      return off;
    },
    timeout(fn, ms) {
      if (parentScope.closed) return () => {};
      let active = true;
      let id = 0;
      const off = () => {
        if (!active) return;
        active = false;
        removeUndo(off);
        win.clearTimeout(id);
      };
      undo.push(off);
      id = win.setTimeout(() => {
        if (!active) return;
        active = false;
        removeUndo(off);
        if (!parentScope.closed) fn();
      }, ms);
      return off;
    },
    onCleanup(fn) {
      if (parentScope.closed) return fn;
      undo.push(fn);
      return fn;
    },
    cleanup() {
      while (undo.length) {
        try { undo.pop()(); } catch (err) { console.warn("base: renderScope cleanup step failed", err); }
      }
    },
  };
  child.h = elementFactory(doc, child);
  parentScope.onCleanup(() => child.cleanup());
  return child;
}

/**
 * h(tag, attrs, ...children). attrs: class, text, style (object), dataset (object), on<event> (function; removed by
 * the scope's cleanup), boolean true -> empty attribute, false/null/undefined -> no attribute. SVG is made by Plot.
 */
export function elementFactory(doc, scope) {
  return function h(tag, attrs = {}, ...children) {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") {
        if (scope) scope.listen(node, k.slice(2).toLowerCase(), v);
        else node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "class") node.className = v;
      else if (k === "text") node.textContent = String(v);
      else if (k === "style" && isRecord(v)) for (const [p, s] of Object.entries(v)) node.style.setProperty(p, String(s));
      else if (k === "dataset" && isRecord(v)) for (const [p, s] of Object.entries(v)) node.dataset[p] = String(s);
      else if (k === "hidden") node.hidden = Boolean(v);
      else node.setAttribute(k, v === true ? "" : String(v));
    }
    append(node, children);
    return node;
  };
}

function append(node, children) {
  for (const c of [children].flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === "object" ? c : String(c));
  }
}

const contentList = (content) => [content].flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);

/** The text of content: a string, a node, or an array of strings and nodes. */
export function textOf(content) {
  return contentList(content).map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join("");
}

// --------------------------------------------------------------------------------------------- utilities

/** True when the reader asked for less motion. */
export function reducedMotion(win) {
  const w = win ?? (typeof window === "undefined" ? undefined : window);
  return Boolean(w && typeof w.matchMedia === "function" && w.matchMedia(CONFIG.queries.reducedMotion)?.matches);
}

/** Decimals of a step or bound value (0.01 -> 2, 0.25 -> 2, 1 -> 0). */
export function stepDecimals(x) {
  const a = Math.abs(x);
  if (!Number.isFinite(a) || a === 0) return 0;
  for (let d = 0; d <= CONFIG.maxStepDecimals; d += 1) {
    const p = 10 ** d;
    if (Math.abs(Math.round(a * p) - a * p) < CONFIG.stepTolerance * Math.max(1, a * p)) return d;
  }
  return CONFIG.maxStepDecimals;
}

/** Round to a number of decimals without binary drift (0.1 + 0.2 -> 0.3). */
export const roundTo = (v, d) => Number(v.toFixed(d));

/**
 * Snap a numeric value to a key's step grid without binary drift.
 * @param {number} v
 * @param {{ min?: number, max?: number, step?: number, stepOrigin?: number }} [options]
 */
export function snapToKeyGrid(v, { min = -Infinity, max = Infinity, step = 1, stepOrigin } = {}) {
  const lo = Number.isFinite(min) ? min : -Infinity;
  const hi = Number.isFinite(max) ? max : Infinity;
  const bounded = clamp(v, lo, hi);
  if (!(Number.isFinite(step) && step > 0)) return bounded;
  const origin = Number.isFinite(stepOrigin) ? stepOrigin : (Number.isFinite(lo) ? lo : 0);
  const dd = Math.max(
    stepDecimals(step),
    Number.isFinite(lo) ? stepDecimals(lo) : 0,
    stepDecimals(origin),
  );
  return roundTo(clamp(origin + Math.round((bounded - origin) / step) * step, lo, hi), dd);
}

/** The focusable elements of `root` in Tab order (disabled and hidden elements skipped; a radio group is one stop). */
export function tabOrder(root) {
  const win = root.ownerDocument.defaultView;
  const directSummary = (details) => {
    for (const c of details.children) if (tagIs(c, "summary")) return c;
    return null;
  };
  const visible = (n) => {
    for (let x = n; x && x !== root.parentNode; x = x.parentElement) {
      if (x.hidden) return false;
      const p = x.parentElement;
      if (p && tagIs(p, "details") && !p.open && directSummary(p) !== x) return false;
      const cs = win?.getComputedStyle?.(x);
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) return false;
    }
    return true;
  };
  const all = [...root.querySelectorAll(FOCUSABLE)].filter((n) => {
    if (n.disabled) return false;
    const ti = n.getAttribute("tabindex");
    if (ti !== null && Number(ti) < 0) return false;
    if (tagIs(n, "input") && n.type === "hidden") return false;
    if (tagIs(n, "a") && !n.hasAttribute("href") && ti === null) return false;
    if (tagIs(n, "summary") && (!tagIs(n.parentElement, "details") || directSummary(n.parentElement) !== n) && ti === null) return false;
    return visible(n);
  });
  const seenGroups = new Set();
  const out = [];
  for (const n of all) {
    if (tagIs(n, "input") && n.type === "radio" && n.name) {
      if (seenGroups.has(n.name)) continue;
      const group = all.filter((r) => tagIs(r, "input") && r.type === "radio" && r.name === n.name);
      seenGroups.add(n.name);
      out.push(group.find((r) => r.checked) ?? group[0]);
    } else out.push(n);
  }
  return out;
}

/**
 * Run fn() and give focus back to the "same" element afterward only when focus was lost (e.g. a redraw replaced it).
 * If fn() deliberately focused a different element inside root, preserve that focus.
 */
export function keepFocus(root, fn) {
  const doc = root.ownerDocument;
  const active = doc.activeElement;
  const inside = Boolean(active && active !== doc.body && active !== doc.documentElement && root.contains(active));
  const key = inside ? active.getAttribute("data-prx-focus-key") : null;
  const id = inside ? active.id : null;
  const result = fn();
  if (inside) {
    const now = doc.activeElement;
    const lost = !now || now === doc.body || now === doc.documentElement || !root.contains(now);
    if (lost) {
      const esc = (s) => String(s).replace(/["\\]/g, "\\$&");
      const again = (key && root.querySelector(`[data-prx-focus-key="${esc(key)}"]`)) || (id && root.querySelector(`[id="${esc(id)}"]`));
      if (again && typeof again.focus === "function") again.focus({ preventScroll: true });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------- controls

/**
 * Labeled range slider with an <output>. The slider keeps the exact current value (a preset off the step grid stays
 * exact); pointer moves snap to the declared step grid unless continuous: true (CP-1.4, S1-08); keyboard moves land on
 * the grid. Returns { root, input, output, get(), set(v), setDisabled(b) }.
 */
export function slider(scope, { label, min, max, step, stepOrigin, value, valueType, snap = false, continuous = false, format = (v) => formatSetting(v), onInput, onChange, name, hint, key } = {}) {
  if (!(Number.isFinite(min) && Number.isFinite(max) && max > min)) throw new RangeError(`slider "${label}": min < max required`);
  const { h } = scope;
  const id = uid("prx-sl");
  const hasExplicitStep = Number.isFinite(step) && step > 0;
  const st = hasExplicitStep ? step : 1;
  // A linked float can have a converted endpoint outside its regular decimal keyboard grid.
  const origin = Number.isFinite(stepOrigin) ? stepOrigin : min;
  const dd = Math.max(stepDecimals(st), stepDecimals(min), stepDecimals(origin));
  const at = (k) => roundTo(clamp(origin + k * st, min, max), dd);
  const normalize = (v) => {
    const bounded = clamp(v, min, max);
    return snap ? snapToKeyGrid(bounded, { min, max, step: st, stepOrigin: origin }) : valueType === "integer" ? Math.round(bounded) : bounded;
  };
  const stepFrom = (v, dir, count) => {
    const pos = (v - origin) / st;
    const base = dir > 0 ? Math.floor(pos + CONFIG.stepTolerance) : Math.ceil(pos - CONFIG.stepTolerance);
    return at(base + dir * count);
  };
  let current = normalize(Number.isFinite(value) ? value : min);
  const hintId = hint ? uid("prx-hint") : undefined;
  const input = h("input", {
    // Float keys admit off-grid settings; integer and snapped keys retain a valid native grid.
    // Untyped callers keep their declared native step. Keyboard increments always use st.
    id, type: "range", name, min, max, step: snap || !valueType ? st : valueType === "integer" ? 1 : "any", value: current,
    "aria-describedby": hintId, "data-prx-focus-key": key ?? (name ? `slider:${name}` : undefined),
  });
  const output = h("output", { for: id, class: "prx-value", "aria-hidden": "true" });
  const show = () => {
    const text = format(current);
    setNum(output, current, text);
    input.setAttribute("aria-valuetext", text);
    if (Number(input.value) !== current) input.value = String(current);
  };
  const win = scope.win;
  const raf = typeof win?.requestAnimationFrame === "function" ? win.requestAnimationFrame.bind(win) : null;
  const caf = typeof win?.cancelAnimationFrame === "function" ? win.cancelAnimationFrame.bind(win) : () => {};
  let pending;
  let hasPending = false;
  let frameId = 0;
  const flush = () => {
    if (frameId) { caf(frameId); frameId = 0; }
    if (!hasPending) return;
    const v = pending;
    hasPending = false;
    pending = undefined;
    if (!scope.closed) onInput?.(v);
  };
  scope.onCleanup(() => { if (frameId) caf(frameId); frameId = 0; hasPending = false; });
  const move = (v, { deferred = false } = {}) => {
    const next = normalize(v);
    if (next === current) {
      if (Number(input.value) !== current) input.value = String(current);
      return false;
    }
    current = next;
    show();
    scope.activity?.();
    if (deferred && raf && onInput) {
      pending = current;
      hasPending = true;
      if (!frameId) frameId = raf(() => { frameId = 0; flush(); });
    } else onInput?.(current);
    return true;
  };
  scope.listen(input, "input", () => {
    const raw = Number(input.value);
    const endTol = Math.max(1e-12, 4 * Number.EPSILON * Math.max(1, Math.abs(min), Math.abs(max)));
    const atEnd = raw <= min + endTol ? min : raw >= max - endTol ? max : null;
    const snapped = atEnd !== null
      ? atEnd
      : !continuous && hasExplicitStep
        ? snapToKeyGrid(raw, { min, max, step: st, stepOrigin: origin })
        : raw;
    move(snapped, { deferred: true });
  });
  scope.listen(input, "change", () => { flush(); onChange?.(current); });
  scope.listen(input, "keydown", (e) => {
    let target;
    const mult = e.shiftKey ? CONFIG.shiftMultiplier : 1;
    switch (e.key) {
      case "ArrowRight": case "ArrowUp": target = stepFrom(current, 1, mult); break;
      case "ArrowLeft": case "ArrowDown": target = stepFrom(current, -1, mult); break;
      case "PageUp": target = stepFrom(current, 1, CONFIG.pageMultiplier); break;
      case "PageDown": target = stepFrom(current, -1, CONFIG.pageMultiplier); break;
      case "Home": target = min; break;
      case "End": target = max; break;
      default: return;
    }
    e.preventDefault();
    flush();
    if (move(target)) onChange?.(current);
  });
  show();
  const root = h("div", { class: "prx-control prx-slider" },
    h("label", { for: id, text: label }),
    input,
    output,
    hint ? h("p", { id: hintId, class: "prx-hint" }, hint) : null);
  return {
    root, input, output,
    get: () => current,
    set(v) {
      if (!Number.isFinite(Number(v))) return;
      current = normalize(Number(v));
      show();
    },
    setDisabled(b) { input.disabled = Boolean(b); },
  };
}

/** Native button. primary marks the app's main action (styling only). */
export function button(scope, { label, onClick, primary = false, title, key, describedBy } = {}) {
  const node = scope.h("button", {
    type: "button", class: primary ? "prx-btn prx-btn-primary" : "prx-btn", title,
    "aria-describedby": describedBy, "data-prx-focus-key": key,
  }, label);
  if (onClick) scope.listen(node, "click", (e) => onClick(e));
  return { root: node, input: node, setDisabled(b) { node.disabled = Boolean(b); }, setLabel(t) { node.textContent = t; } };
}

/**
 * Segmented choice (dpprior style): a labeled row of buttons with aria-pressed, one of them pressed (or none, when
 * the value matches no option). options: [{ value, label, title? }]; a label is a string or nodes.
 * Returns { root, buttons, get(), set(v), setDisabled(b) }. onChange(value) fires on a click.
 */
export function segmented(scope, { label, options = [], value, onChange, name, className = "" } = {}) {
  const { h } = scope;
  const labelId = uid("prx-seg");
  let current = value;
  const same = (a, b) => Object.is(a, b) || (a !== undefined && a !== null && String(a) === String(b));
  const buttons = options.map((o, i) => {
    const b = h("button", {
      type: "button", class: "prx-seg", title: o.title, "aria-pressed": String(same(o.value, value)),
      "data-prx-focus-key": `seg:${name ?? labelId}:${i}`, "data-value": String(o.value),
    }, o.label ?? String(o.value));
    scope.listen(b, "click", () => {
      current = o.value;
      sync();
      onChange?.(o.value);
    });
    return b;
  });
  const sync = () => buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(same(options[i].value, current))));
  const root = h("div", { class: `prx-control prx-segmented ${className}`.trim(), role: "group", "aria-labelledby": label ? labelId : undefined },
    label ? h("span", { id: labelId, class: "prx-seg-label", text: label }) : null,
    h("span", { class: "prx-seg-buttons" }, ...buttons));
  return {
    root, buttons,
    get: () => current,
    set(v) { current = v; sync(); },
    setDisabled(d) { for (const b of buttons) b.disabled = Boolean(d); },
  };
}

/** Labeled select. options: [{ value, label }]. Returns { root, input, get(), set(v) }. */
export function select(scope, { label, options = [], value, onChange, name, key } = {}) {
  const { h } = scope;
  const id = uid("prx-se");
  const input = h("select", { id, name, "data-prx-focus-key": key ?? (name ? `select:${name}` : undefined) },
    ...options.map((o, i) => h("option", { value: String(i) }, o.label ?? String(o.value))));
  const indexOf = (v) => options.findIndex((o) => Object.is(o.value, v) || o.value === v);
  const set = (v) => { const i = indexOf(v); if (i >= 0) input.value = String(i); };
  set(value ?? options[0]?.value);
  scope.listen(input, "change", () => onChange?.(options[Number(input.value)]?.value));
  const root = h("div", { class: "prx-control prx-select" }, h("label", { for: id, text: label }), input);
  return { root, input, get: () => options[Number(input.value)]?.value, set, setDisabled(b) { input.disabled = Boolean(b); } };
}

/** Radio group in a fieldset with a legend. options: [{ value, label }]. Returns { root, inputs, get(), set(v) }. */
export function radioGroup(scope, { legend, options = [], value, onChange, name, className = "" } = {}) {
  const { h } = scope;
  const group = uid(name ? `prx-${name}` : "prx-rg");
  const inputs = options.map((o, i) => {
    const id = `${group}-${i}`;
    const input = h("input", { id, type: "radio", name: group, value: String(i), "data-prx-focus-key": `radio:${name ?? group}:${i}` });
    input.checked = value !== undefined && (Object.is(o.value, value) || o.value === value);
    scope.listen(input, "change", () => { if (input.checked) onChange?.(o.value); });
    return { input, label: h("label", { for: id, class: "prx-radio" }, input, h("span", {}, o.label ?? String(o.value))) };
  });
  const root = h("fieldset", { class: `prx-control prx-radio-group ${className}`.trim() },
    h("legend", {}, legend), ...inputs.map((x) => x.label));
  return {
    root,
    inputs: inputs.map((x) => x.input),
    get() { const i = inputs.findIndex((x) => x.input.checked); return i >= 0 ? options[i].value : undefined; },
    set(v) { inputs.forEach((x, i) => { x.input.checked = Object.is(options[i].value, v) || options[i].value === v; }); },
    setDisabled(b) { for (const x of inputs) x.input.disabled = Boolean(b); },
  };
}

/** Checkbox with a label. Returns { root, input, get(), set(b) }. */
export function toggle(scope, { label, checked = false, onChange, name, key, hint } = {}) {
  const { h } = scope;
  const id = uid("prx-tg");
  const hintId = hint ? uid("prx-hint") : undefined;
  const input = h("input", { id, type: "checkbox", name, "aria-describedby": hintId, "data-prx-focus-key": key ?? (name ? `toggle:${name}` : undefined) });
  input.checked = Boolean(checked);
  scope.listen(input, "change", () => onChange?.(input.checked));
  const root = h("div", { class: "prx-control prx-toggle" }, input, h("label", { for: id, text: label }),
    hint ? h("p", { id: hintId, class: "prx-hint" }, hint) : null);
  return { root, input, get: () => input.checked, set(b) { input.checked = Boolean(b); }, setDisabled(b) { input.disabled = Boolean(b); } };
}

/** Labeled number (or text) field. get() returns the clamped number, or undefined when unreadable. */
export function numberInput(scope, { label, min = -Infinity, max = Infinity, step = "any", value, onInput, onChange, type = "number", name, key, ariaLabel, describedBy } = {}) {
  const { h } = scope;
  const id = uid("prx-nf");
  // ariaLabel names the input when the visible label is short (a cell of a grid); describedBy points at a hint
  const input = h("input", {
    id, type: type === "text" ? "text" : "number", name, step, inputmode: type === "text" ? undefined : "decimal",
    min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined,
    "aria-invalid": "false", "data-prx-focus-key": key ?? (name ? `number:${name}` : undefined),
    "aria-label": ariaLabel || undefined, "aria-describedby": describedBy || undefined,
  });
  if (value !== undefined && value !== null) input.value = String(value);
  const read = () => {
    if (type === "text") return input.value.trim() === "" ? undefined : input.value.trim().slice(0, CONFIG.maxStringLength);
    const s = input.value.trim();
    const v = Number(s);
    return s === "" || !Number.isFinite(v) ? undefined : clamp(v, min, max);
  };
  let lastEmitted = type !== "text" && value !== undefined && value !== null && Number.isFinite(Number(value))
    ? clamp(Number(value), min, max)
    : undefined;
  let lastChanged = lastEmitted;
  let dirty = false;
  if (type === "text") {
    scope.listen(input, "input", () => {
      const v = read();
      input.setAttribute("aria-invalid", "false");
      if (v !== undefined) onInput?.(v);
    });
    scope.listen(input, "change", () => {
      const v = read();
      if (v !== undefined) onChange?.(v);
    });
  } else {
    // Deferred clamping: mark aria-invalid while typing out-of-range/incomplete text without silently clamping;
    // clamp and synchronize input.value on commit (change, blur, or Enter before primary action).
    scope.listen(input, "input", () => {
      const s = input.value.trim();
      const v = Number(s);
      dirty = true;
      if (s === "" || !Number.isFinite(v) || v < min || v > max) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.setAttribute("aria-invalid", "false");
      lastEmitted = v;
      onInput?.(v);
    });
    const commit = () => {
      const s = input.value.trim();
      if (s === "") return;
      const raw = Number(s);
      if (!Number.isFinite(raw)) return;
      const c = clamp(raw, min, max);
      input.value = String(c);
      input.setAttribute("aria-invalid", "false");
      if (!Object.is(c, lastEmitted)) {
        lastEmitted = c;
        onInput?.(c);
      }
      if (dirty || !Object.is(c, lastChanged)) {
        dirty = false;
        lastChanged = c;
        onChange?.(c);
      }
    };
      if (onInput || onChange) {
        scope.listen(input, "change", commit);
        scope.listen(input, "blur", commit);
        scope.listen(input, "keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) commit();
        });
      }
  }
  const root = h("div", { class: "prx-control prx-number" }, h("label", { for: id }, label), input);
  return {
    root, input, get: read,
    set(v) {
      input.value = v === undefined || v === null ? "" : String(v);
      input.setAttribute("aria-invalid", "false");
      dirty = false;
      if (type !== "text") {
        lastEmitted = v !== undefined && v !== null && Number.isFinite(Number(v)) ? clamp(Number(v), min, max) : undefined;
        lastChanged = lastEmitted;
      }
    },
    setDisabled(b) { input.disabled = Boolean(b); },
  };
}

// ---------------------------------------------------------------------------------------------- panels

/** A panel title read as a heading: <p class="prx-panel-title" role="heading" aria-level="2">content</p>. */
export function panelTitle(target, content, { level = CONFIG.panelTitle.level, className, tag = CONFIG.panelTitle.tag, id } = {}) {
  const doc = target?.doc ?? (target?.nodeType === 9 ? target : target?.ownerDocument) ?? globalThis.document;
  if (!doc) throw new TypeError("panelTitle: pass a ctx, an element or a document");
  const C = CONFIG.panelTitle;
  const lv = clamp(Math.round(Number.isFinite(Number(level)) ? Number(level) : C.level), C.minLevel, C.maxLevel);
  const t = /^[a-z][a-z0-9]*$/i.test(String(tag)) ? String(tag).toLowerCase() : C.tag;
  const node = doc.createElement(t);
  node.className = className ? `${C.className} ${className}` : C.className;
  if (!/^h[1-6]$/.test(t)) {
    node.setAttribute("role", "heading");
    node.setAttribute("aria-level", String(lv));
  }
  if (id) node.id = id;
  append(node, [content]);
  return node;
}

/** Make a box that may scroll sideways reachable and scrollable by keyboard; returns the node. Once laid out, the box
 *  is a keyboard stop (tabindex 0, role region, its label) only while its content overflows it. */
export function scrollRegion(node, label, { stickyLabels = false } = {}) {
  if (!node || node.nodeType !== 1) throw new TypeError("scrollRegion: an element is required");
  if (label !== undefined && label !== null && String(label).trim() !== "") node.__prxScrollLabel = String(label);
  // a box whose own content pins its row labels (a sticky SVG column) fades only its right edge, like a sticky table
  if (stickyLabels) node.setAttribute("data-prx-sticky-labels", "");
  setStop(node, true);
  node.classList.add(CONFIG.scrollRegion.className);
  watchOverflow(node);
  return node;
}

function setStop(node, on) {
  if (on) {
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "region");
    if (node.__prxScrollLabel) node.setAttribute("aria-label", node.__prxScrollLabel);
  } else if (node.getAttribute("tabindex") === "0" && node.ownerDocument?.activeElement !== node) {
    for (const a of ["tabindex", "role", "aria-label"]) node.removeAttribute(a);
  }
}

/** Keep data-prx-overflow = "start", "end" or "both" on a scroll box while it has more content past that edge (the
 *  CSS cue fades that edge; CR-065), no attribute when everything fits, and the keyboard stop only while it overflows.
 *  Measured after layout, on scroll, when the box or its content resizes, and when the content is replaced. */
const overflowControls = new WeakMap();
const overflowNodes = new WeakSet();
function watchOverflow(node, { keyboardStop = true } = {}) {
  const previous = overflowControls.get(node);
  if (previous) return previous.stop;
  const { slackPx } = CONFIG.scrollRegion;
  const win = node.ownerDocument?.defaultView;
  let stopped = false, ro = null, mo = null, frameId = null;
  const update = () => {
    if (stopped || !node.isConnected) return;
    const max = node.scrollWidth - node.clientWidth;
    const start = max > slackPx && node.scrollLeft > slackPx;
    const end = max > slackPx && node.scrollLeft < max - slackPx;
    const v = start && end ? "both" : start ? "start" : end ? "end" : null;
    if (v === null) node.removeAttribute("data-prx-overflow");
    else if (node.getAttribute("data-prx-overflow") !== v) node.setAttribute("data-prx-overflow", v);
    // a box whose table keeps its row labels in view fades only its right edge (styles/app.css; review 044 repair)
    const sticky = node.hasAttribute("data-prx-sticky-labels") || Boolean(node.querySelector?.("table.prx-sticky-first, table.prx-sticky-two"));
    if (sticky !== node.hasAttribute("data-prx-sticky")) node.toggleAttribute("data-prx-sticky", sticky);
    if (keyboardStop) setStop(node, max > slackPx);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    ro?.disconnect(); mo?.disconnect();
    if (frameId !== null) win?.cancelAnimationFrame?.(frameId);
    node.removeEventListener("scroll", update);
    if (node.__prxOverflow === update) delete node.__prxOverflow;
    overflowControls.delete(node);
  };
  overflowControls.set(node, { stop });
  overflowNodes.add(node);
  node.__prxOverflow = update;
  node.addEventListener("scroll", update, { passive: true });
  if (win?.ResizeObserver) {
    ro = new win.ResizeObserver(update);
    ro.observe(node);
    let child = node.firstElementChild;
    if (child) ro.observe(child);
    if (win.MutationObserver) {
      mo = new win.MutationObserver(() => {
        if (stopped) return;
        if (node.firstElementChild !== child) {
          if (child) ro.unobserve(child);
          child = node.firstElementChild;
          if (child) ro.observe(child);
        }
        update();
      });
      mo.observe(node, { childList: true });
    }
  }
  if (win?.requestAnimationFrame) frameId = win.requestAnimationFrame(update);
  else update();
  return stop;
}

// ---------------------------------------------------------------------------------------------- read-out

/**
 * The app's one aria-live="polite" region. set(content) takes a string, a node, or an array of strings and nodes; an
 * unchanged read-out is not rewritten. While a slider moves, the text updates at once but the region is
 * aria-live="off" until no move has come for settleMs; then the settled content is announced once.
 */
export function createReadout(scope, { className = "prx-readout", settleMs = CONFIG.readoutSettleMs } = {}) {
  const node = scope.h("div", { class: className, "aria-live": "polite", "aria-atomic": "true", "data-prx-part": "readout" });
  let stamp = null;
  let parts = [];
  let held = false;
  let heldStamp = null;
  let timer = 0;
  const win = scope.win;
  const signature = (list) => list.map((p) => (typeof p === "object" ? `${p.textContent}\u0000${p.getAttribute?.("data-num") ?? ""}` : String(p))).join("\u0001");
  const write = () => {
    node.replaceChildren();
    append(node, parts.map((p) => (typeof p === "object" && p.cloneNode ? p.cloneNode(true) : p)));
  };
  const announce = () => {
    node.replaceChildren();
    scope.timeout(write, 0);
  };
  scope.onCleanup(() => { if (timer) win.clearTimeout(timer); timer = 0; });
  const settle = () => {
    timer = 0;
    if (scope.closed) return;
    held = false;
    node.setAttribute("aria-live", "polite");
    if (stamp !== heldStamp) announce();
  };
  return {
    node,
    set(content) {
      const list = [content].flat(Infinity).filter((p) => p !== null && p !== undefined && p !== false);
      const s = signature(list);
      if (s === stamp) return false;
      stamp = s;
      parts = list;
      write();
      return true;
    },
    text: () => node.textContent,
    announce,
    hold() {
      if (!held) {
        held = true;
        heldStamp = stamp;
        node.setAttribute("aria-live", "off");
      }
      if (timer) win.clearTimeout(timer);
      timer = win.setTimeout(settle, settleMs);
    },
    get held() { return held; },
  };
}

// ---------------------------------------------------------------------------------------------- spec handling

const typeOf = (def) => def.type ?? (Array.isArray(def.values) ? "choice" : Array.isArray(def.value) ? "numbers" : typeof def.value);

function sanitize(def, v, prev) {
  const type = typeOf(def);
  const lo = Number.isFinite(def.min) ? def.min : -Infinity;
  const hi = Number.isFinite(def.max) ? def.max : Infinity;
  const num = (x) => {
    const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
    if (!Number.isFinite(n)) return undefined;
    let c = clamp(n, lo, hi);
    if (def.snap && Number.isFinite(def.step) && def.step > 0) {
      c = snapToKeyGrid(c, { min: lo, max: hi, step: def.step, stepOrigin: def.stepOrigin });
    }
    return c;
  };
  switch (type) {
    case "number": return num(v);
    case "integer": { const n = num(v); return n === undefined ? undefined : clamp(Math.round(n), Math.ceil(lo), Math.floor(hi)); }
    case "boolean":
      if (typeof v === "boolean") return v;
      if (v === 1 || v === 0) return v === 1;
      if (typeof v === "string" && ["true", "false", "on", "off", "yes", "no", "1", "0"].includes(v.trim().toLowerCase())) return ["true", "on", "yes", "1"].includes(v.trim().toLowerCase());
      return undefined;
    case "string":
      return typeof v === "string" ? v.slice(0, def.maxLength ?? CONFIG.maxStringLength) : undefined;
    case "choice":
      return (def.values ?? []).find((x) => Object.is(x, v) || x === v || String(x) === String(v));
    case "numbers": {
      const raw = typeof v === "string" ? v.split(",") : Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v) : null;
      if (!raw) return undefined;
      const list = raw.map(num);
      if (list.some((x) => x === undefined)) return undefined;
      if (Number.isFinite(def.minLength) && list.length < def.minLength) return undefined;
      if (Number.isFinite(def.maxLength) && list.length > def.maxLength) return undefined;
      return list;
    }
    case "custom": return typeof def.parse === "function" ? def.parse(v, prev) : undefined;
    default: return undefined;
  }
}

function queryTypes(keys) {
  const out = {};
  for (const [k, d] of Object.entries(keys)) {
    const type = typeOf(d);
    if (["number", "integer", "boolean", "string", "numbers"].includes(type)) out[k] = type;
    else out[k] = (v) => sanitize(d, v);
  }
  return out;
}

const sameScalar = (a, b) => (typeof a === "number" && typeof b === "number"
  ? Math.abs(a - b) <= CONFIG.presetTolerance * Math.max(1, Math.abs(b))
  : Object.is(a, b) || String(a) === String(b));
const sameValue = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((x, i) => sameScalar(x, b[i]))
  : sameScalar(a, b));
// Preset highlighting is approximate; an admitted scientific input is exact state.
// Close values can lie on different sides of a report boundary, so never discard one here.
const sameStateValue = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  : Object.is(a, b));

/** Serialize only declared, representable public controls. Pasted tool inputs and draft text live outside state. */
function modeQuery(keys, state, reference, presetId, theme) {
  const params = new URLSearchParams();
  if (presetId) params.set("preset", presetId);
  for (const [key, def] of Object.entries(keys)) {
    const value = state[key];
    if (sameStateValue(value, reference[key])) continue;
    const candidates = value === null ? ["none", "off", "", "auto"] : [String(value)];
    const encoded = candidates.find(text => sameStateValue(sanitize(def, text, reference[key]), value));
    if (encoded !== undefined) params.set(key, encoded);
  }
  if (theme === "light" || theme === "dark" || theme === "system") params.set("theme", theme);
  return params.toString();
}

/** Keep the native link URL current for pointer, keyboard, copy-link and new-tab navigation. */
function modeLinkBinding(scope, appName) {
  const { doc, win } = scope;
  const pagePath = builtPage(appName);
  let links = [];
  let query = "";
  const apply = () => {
    for (const { node, url } of links) {
      url.search = query;
      node.href = url.href;
    }
  };
  const discover = () => {
    if (!pagePath || !doc.body || !["http:", "https:", "file:"].includes(win.location.protocol)) return;
    const base = linkRoot(doc);
    if (!base) return;
    const isEmbed = doc.body.classList.contains("prx-embed");
    const destination = new URL(base.root + (isEmbed ? pagePath : "embed/" + appName + ".html"), win.location.href);
    const selector = isEmbed ? ".prx-embed-credit a[href]" : "main a[href]";
    links = Array.from(doc.querySelectorAll(selector)).filter(node => {
      const url = new URL(node.href);
      return url.protocol === destination.protocol && url.host === destination.host && url.pathname === destination.pathname;
    }).map(node => ({ node, url: new URL(node.href) }));
    apply();
  };
  if (doc.readyState === "loading") scope.listen(doc, "DOMContentLoaded", discover, { once: true });
  else discover();
  return value => { query = value; apply(); };
}

/** Parse a preset query ("tau=.20&cap=3" or "?tau=.20") into raw strings by key. */
export function parsePresetQuery(query) {
  const out = {};
  for (const [k, v] of new URLSearchParams(String(query ?? "").replace(/^\?/, ""))) if (!(k in out)) out[k] = v;
  return out;
}

// ---------------------------------------------------------------------------------------------- createWidget helpers

const HIDE_ALLOWED = new Set(["title", "caption", "presets", "disclosures"]);
const parseHideList = (val) => (Array.isArray(val) ? val : typeof val === "string" ? val.split(",") : [])
  .flatMap((s) => {
    const k = String(s).trim().toLowerCase();
    return k === "chrome" ? ["title", "caption"] : [k];
  })
  .filter((k) => HIDE_ALLOWED.has(k)); // Never allow hiding credit (S2-03, S3-04).

function initWidgetState({ keys, presetList, spec, def, win }) {
  const types = queryTypes(keys);
  const useQuery = def.query !== false && spec.query !== false;
  const q = useQuery
    ? readQuery({ allowed: Object.keys(keys), types, window: win })
    : { spec: {}, preset: null, theme: null, open: null, ignored: [] };
  const rawSearch = useQuery ? (typeof win?.__PRX_QUERY === "string" ? win.__PRX_QUERY : (win?.location?.search ?? "")) : "";
  const urlParams = new URLSearchParams(String(rawSearch).replace(/^\?/, ""));
  const hideSet = new Set([
    ...parseHideList(def.hide),
    ...parseHideList(spec.hide),
    ...parseHideList(urlParams.getAll("hide").flatMap((s) => s.split(","))),
  ]);
  const state = {};
  for (const [k, d] of Object.entries(keys)) state[k] = sanitize(d, d.value, undefined) ?? d.value;
  const defaults = Object.freeze({ ...state });
  const applyKeys = (src, changed) => {
    for (const k of Object.keys(src)) {
      if (RESERVED.has(k) || k === "hide" || !Object.prototype.hasOwnProperty.call(keys, k)) continue;
      const v = sanitize(keys[k], src[k], state[k]);
      if (v === undefined || sameStateValue(v, state[k])) continue;
      state[k] = v;
      changed?.add(k);
    }
  };
  const presetSetting = (p) => {
    const entry = typeof p === "string" ? presetList.find((x) => x.id === p) : null;
    const raw = entry ? parsePresetQuery(entry.query) : isRecord(p) ? p : null;
    if (!raw) return null;
    const out = { ...defaults };
    for (const [k, v] of Object.entries(raw)) {
      if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
      const s = sanitize(keys[k], v, out[k]);
      if (s !== undefined) out[k] = s;
    }
    return out;
  };
  const startPreset = q.preset ?? spec.preset;
  if (startPreset) applyKeys(presetSetting(startPreset) ?? {});
  applyKeys(spec);
  applyKeys(q.spec);
  const pickTheme = (v) => (typeof v === "string" && BRIDGE.themes.includes(v) ? v : null);
  const theme = urlParams.get("theme") === "system" ? null : q.theme ?? pickTheme(spec.theme);
  const preferredPresetId = typeof startPreset === "string" && presetList.some((p) => p.id === startPreset) ? startPreset : null;
  return { types, q, state, defaults, applyKeys, presetSetting, pickTheme, initialTheme: theme, initialOpen: q.open ?? spec.open, hideTitle: hideSet.has("title"), initialPreferredPresetId: preferredPresetId };
}

function createPresetBar(scope, { presetList, firstPreset, label, onSelect }) {
  const orderedPresets = firstPreset && presetList.some((p) => p.id === firstPreset)
    ? [presetList.find((p) => p.id === firstPreset), ...presetList.filter((p) => p.id !== firstPreset)]
    : presetList;
  if (!orderedPresets.length) return { presetRow: null, orderedPresets };
  const presetRow = segmented(scope, {
    label, name: "preset", className: "prx-presets",
    options: orderedPresets.map((p) => ({ value: p.id, label: p.label, title: p.title })),
    value: null,
    onChange: onSelect,
  });
  presetRow.root.setAttribute("data-prx-part", "presets");
  return { presetRow, orderedPresets };
}

function createFrameSlots(scope, { el, def, info, layout, presetRow, hideTitle }) {
  const { doc, win, h } = scope;
  const original = [...el.childNodes];
  const name = displayName(def.name);
  const root = h("div", {
    class: `${CONFIG.rootClass}${def.className ? ` ${def.className}` : ""}`,
    role: "group",
    "aria-label": name ?? def.label ?? info?.title ?? def.name ?? "",
    "aria-description": name && def.label !== name ? def.label : undefined,
    "data-prx-widget": def.name,
  });
  const frame = h("div", { class: CONFIG.frameClass }, root);
  const controls = h("div", { class: "prx-controls", "data-prx-part": "controls" });
  const charts = h("div", { class: layout === "v2" ? "prx-stage prx-charts" : "prx-charts", "data-prx-part": "chart" });
  if (layout === "v2") charts.setAttribute("data-prx-primary", "");
  const toolbar = layout === "v2" ? h("div", { class: "prx-toolbar", "data-prx-part": "toolbar" }, controls, presetRow?.root ?? null) : null;
  const scopeLine = layout === "v2" ? h("p", { class: "prx-scope", "data-prx-part": "scope", hidden: true }) : null;
  const readout = createReadout(scope);
  scope.activity = () => readout.hold();
  const caption = h("p", { class: "prx-caption", "data-prx-part": "caption" });
  if (info?.caption) caption.textContent = info.caption;
  const title = def.title ? h("h3", { class: "prx-title", "data-prx-part": "title", text: def.title }) : null;

  if (layout === "v2") {
    root.setAttribute("data-prx-frame", "v2");
    root.setAttribute("data-prx-layout", "v2");
    append(root, [title, toolbar, readout.node, charts, scopeLine, caption]);
  } else if (layout === "result-first") {
    root.setAttribute("data-prx-layout", layout);
    append(root, [title, controls, readout.node, charts, caption]);
  } else {
    append(root, [title, controls, charts, readout.node, caption]);
  }

  if (hideTitle) {
    if (title) title.hidden = true;
    const embedTitles = [...(doc.querySelectorAll?.(".prx-embed-title") ?? [])].filter((n) => !n.hidden);
    for (const n of embedTitles) n.hidden = true;
    if (embedTitles.length) scope.onCleanup(() => { for (const n of embedTitles) n.hidden = false; });
  }

  el.replaceChildren(frame);

  let disclosureGroup = null;
  const groupOfDisclosures = () => {
    if (disclosureGroup) return disclosureGroup;
    disclosureGroup = h("div", { class: CONFIG.disclosure.groupClass, "data-prx-part": "disclosures" });
    if (caption.parentNode) caption.before(disclosureGroup); else root.append(disclosureGroup);
    return disclosureGroup;
  };

  const syncScopeLine = () => {
    if (!scopeLine) return;
    scopeLine.hidden = scopeLine.children.length === 0 && scopeLine.textContent.trim() === "";
  };
  const setScope = (parts) => {
    if (!scopeLine) return;
    scopeLine.replaceChildren();
    append(scopeLine, contentList(parts));
    syncScopeLine();
  };

  // Own regions created by ctx and by the actual shared chart/card renderers.
  const overflowStops = new Map();
  let overflowDisposed = false, overflowObserver = null;
  const syncOverflowRegions = () => {
    if (overflowDisposed) return;
    overflowObserver?.takeRecords();
    for (const [node, stop] of overflowStops) if (!root.contains(node)) { stop(); overflowStops.delete(node); }
    for (const node of root.querySelectorAll(`.${CONFIG.scrollRegion.className}`)) {
      if (overflowNodes.has(node) && !overflowStops.has(node)) overflowStops.set(node, watchOverflow(node));
    }
  };
  if (win.MutationObserver) {
    overflowObserver = new win.MutationObserver((records) => { if (records.length) syncOverflowRegions(); });
    overflowObserver.observe(root, { childList: true, subtree: true });
  }
  scope.onCleanup(() => {
    overflowDisposed = true;
    overflowObserver?.disconnect();
    for (const stop of overflowStops.values()) stop();
    overflowStops.clear();
  });

  if (def.css && def.name && doc.head && !doc.head.querySelector(`style[data-prx-app="${def.name}"]`)) {
    const style = doc.createElement("style");
    style.setAttribute("data-prx-app", def.name);
    style.textContent = def.css;
    doc.head.append(style);
  }

  return {
    original, root, frame, title, toolbar, controls, charts, scopeLine, readout, caption,
    get disclosureGroup() { return disclosureGroup; },
    groupOfDisclosures, setScope, syncScopeLine, overflowStops, syncOverflowRegions,
  };
}

/**
 * @param {any} scope
 * @param {HTMLElement} root
 * @param {{ onSettle?: () => void }} [options]
 */
function createStageScheduler(scope, root, { onSettle } = {}) {
  let runId = 0;
  let cancelCurrent = null;
  const cancelStages = () => {
    runId += 1;
    if (cancelCurrent) {
      const fn = cancelCurrent;
      cancelCurrent = null;
      fn();
    }
  };
  const scheduleStages = (stages, { yieldMs = 0 } = {}) => {
    if (scope.closed) return { cancel: () => {} };
    const list = Array.isArray(stages) ? stages.filter((fn) => typeof fn === "function") : [];
    cancelStages();
    const myId = runId;
    if (list.length === 0) {
      root.setAttribute("aria-busy", "false");
      return { cancel: () => {} };
    }
    if (list.length === 1) {
      list[0]();
      if (myId === runId && !scope.closed) {
        root.setAttribute("aria-busy", "false");
        onSettle?.();
      }
      return { cancel: () => {} };
    }
    let cancelled = false;
    let offTimer = null;
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      offTimer?.();
      offTimer = null;
      if (cancelCurrent === cancel) cancelCurrent = null;
    };
    cancelCurrent = cancel;
    root.setAttribute("aria-busy", "true");
    try {
      list[0]();
    } catch (err) {
      cancel();
      if (myId === runId && !scope.closed) root.setAttribute("aria-busy", "false");
      throw err;
    }
    if (cancelled || myId !== runId || scope.closed) return { cancel };
    let index = 1;
    const stepNext = () => {
      offTimer = null;
      if (cancelled || myId !== runId || scope.closed) return;
      const fn = list[index];
      index += 1;
      try {
        fn();
      } catch (err) {
        cancel();
        if (myId === runId && !scope.closed) root.setAttribute("aria-busy", "false");
        console.error(err);
        root.dataset.prxError = String(err?.message ?? err);
        return;
      }
      if (cancelled || myId !== runId || scope.closed) return;
      if (index < list.length) {
        offTimer = scope.timeout(stepNext, yieldMs);
      } else {
        cancelCurrent = null;
        root.setAttribute("aria-busy", "false");
        onSettle?.();
      }
    };
    offTimer = scope.timeout(stepNext, yieldMs);
    return { cancel };
  };
  return { scheduleStages, cancelStages };
}

function bindResizeAndTheme(scope, { el, root, frame, win, onWidthChange, onMotionChange, onDarkChange }) {
  const motionMql = typeof win.matchMedia === "function" ? win.matchMedia(CONFIG.queries.reducedMotion) : null;
  const darkMql = typeof win.matchMedia === "function" ? win.matchMedia(CONFIG.queries.dark) : null;
  const setMotion = () => root.setAttribute("data-motion", motionMql?.matches ? "reduce" : "full");
  setMotion();
  const watch = (mql, fn) => {
    if (!mql) return;
    if (typeof mql.addEventListener === "function") scope.listen(mql, "change", fn);
    else if (typeof mql.addListener === "function") { mql.addListener(fn); scope.onCleanup(() => mql.removeListener(fn)); }
  };
  let lastWidth = Math.round(frame.getBoundingClientRect?.().width || 0);
  let cancelResize = null;
  const onWidth = (w) => {
    if (!(w > 0) || Math.abs(w - lastWidth) < CONFIG.resizeMinDelta) return;
    lastWidth = w;
    cancelResize?.();
    cancelResize = scope.timeout(() => {
      cancelResize = null;
      onWidthChange(lastWidth);
    }, CONFIG.resizeDebounceMs);
  };
  if (typeof win.ResizeObserver === "function") {
    const ro = new win.ResizeObserver((entries) => {
      for (const entry of entries) onWidth(Math.round(entry.contentRect?.width ?? frame.clientWidth ?? 0));
    });
    ro.observe(frame);
    scope.onCleanup(() => ro.disconnect());
  } else {
    scope.listen(win, "resize", () => onWidth(Math.round(frame.clientWidth || el.clientWidth || 0)));
  }
  watch(motionMql, () => { setMotion(); onMotionChange(); });
  watch(darkMql, onDarkChange);
  return {
    motionMql,
    getWidth: () => lastWidth || Math.round(frame.getBoundingClientRect?.().width || el.clientWidth || 0) || CONFIG.defaultWidth,
  };
}

// ---------------------------------------------------------------------------------------------- createWidget

/** Mount an app (see the header). */
export function createWidget(el, spec = {}, def = {}) {
  if (!el || el.nodeType !== 1) throw new TypeError("mountWidget: el must be an element");
  if (typeof def.build !== "function") throw new TypeError("createWidget: def.build(ctx) is required");
  spec = isRecord(spec) ? spec : {};
  const keys = def.keys ?? {};
  const info = def.name ? appInfo(def.name) : null;
  const presetList = Array.isArray(def.presets) ? def.presets : info?.presets ?? [];
  const requestedLayout = def.frame ?? def.layout;
  const layout = CONFIG.layouts.includes(requestedLayout) ? requestedLayout : "classic";
  const scope = createScope(el);
  const renderScope = createRenderScope(scope);
  const { doc, win, h } = scope;

  const {
    types, state, defaults, applyKeys, presetSetting, pickTheme,
    initialTheme, initialOpen, hideTitle, initialPreferredPresetId,
  } = initWidgetState({ keys, presetList, spec, def, win });
  let theme = initialTheme;
  let preferredPresetId = initialPreferredPresetId;
  let handle = null;

  // Build presetRow BEFORE def.build(ctx) in all layouts so ctx.presets is already non-null.
  const { presetRow, orderedPresets } = createPresetBar(scope, {
    presetList,
    firstPreset: def.firstPreset,
    label: def.presetLabel ?? info?.presetLabel ?? CONFIG.text.presets,
    onSelect: (id) => handle?.applyPreset(id),
  });
  const afterPresetNodes = [];

  const slots = createFrameSlots(scope, { el, def, info, layout, presetRow, hideTitle });
  const { original, root, frame, title, toolbar, controls, charts, scopeLine, readout, caption, groupOfDisclosures, setScope, syncScopeLine, overflowStops, syncOverflowRegions } = slots;
  const setTheme = () => (theme ? root.setAttribute("data-theme", theme) : root.removeAttribute("data-theme"));
  setTheme();

  const syncModeLinks = modeLinkBinding(scope, def.name);
  const syncPresets = () => {
    if (!presetRow) return;
    const matches = (p) => {
      const s = presetSetting(p.id);
      return s && Object.keys(keys).every((k) => sameValue(state[k], s[k]));
    };
    const preferred = orderedPresets.find((p) => p.id === preferredPresetId && matches(p));
    const on = preferred ?? orderedPresets.find(matches);
    presetRow.set(on?.id ?? null);
    if (on && root.clientWidth && root.clientWidth <= 600) {
      const active = presetRow.buttons.find(button => button.dataset.value === on.id);
      const strip = active?.parentElement;
      if (strip && strip.scrollWidth > strip.clientWidth) {
        const buttonBox = active.getBoundingClientRect(), stripBox = strip.getBoundingClientRect();
        if (buttonBox.left < stripBox.left) strip.scrollLeft += buttonBox.left - stripBox.left;
        else if (buttonBox.right > stripBox.right) strip.scrollLeft += buttonBox.right - stripBox.right;
      }
    }
    // A custom handoff lands on the app's implicit startup preset when its URL has no preset.
    // Full site pages are pinned to light mode; do not forward embed-only theme overrides onto full pages
    // or force standalone links to light when opened from a default full page.
    const reference = (on ? presetSetting(on.id) : presetSetting(spec.preset)) ?? defaults;
    const isEmbedHost = Boolean(doc.body?.classList?.contains("prx-embed"));
    const modeTheme = isEmbedHost ? null : theme;
    syncModeLinks(modeQuery(keys, state, reference, on?.id, modeTheme));
  };

  const { scheduleStages, cancelStages } = createStageScheduler(scope, root, {
    onSettle: () => {
      syncOverflowRegions();
      markLabelStarts(root);
    },
  });

  // --- main action (Enter on a slider, radio, checkbox or text field of the app)
  let inst = null;
  let destroyed = false;
  let appPrimary = null;
  scope.listen(root, "keydown", (e) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
    const t = e.target;
    if (!tagIs(t, "input") || !ENTER_TARGETS.has(t.type)) return;
    const action = appPrimary ?? (typeof inst?.primary === "function" ? inst.primary.bind(inst) : null);
    if (!action) return;
    e.preventDefault();
    action(e);
  });

  const watchers = bindResizeAndTheme(scope, {
    el, root, frame, win,
    onWidthChange: (w) => {
      if (typeof inst?.resize === "function") keepFocus(root, () => inst.resize(w));
      else render(new Set(), "resize");
    },
    onMotionChange: () => render(new Set(), "motion"),
    onDarkChange: () => render(new Set(), "theme"),
  });

  let settingsDisclosure = null;
  let dataDisclosure = null;
  let methodDisclosure = null;
  const suppressNextToggle = new WeakSet();
  let rendering = false;
  let handleReady = false;
  let pendingRenderReason = null;
  let renderDepth = 0;
  const queued = [];

  const ctx = {
    el, root, frame, doc, win, h, info, renderScope,
    listen: scope.listen, timeout: scope.timeout, onCleanup: scope.onCleanup,
    get state() { return { ...state }; },
    get defaults() { return defaults; },
    controls, charts, stage: charts, toolbar, scopeLine, setScope, caption, readout, title,
    get presets() { return presetRow?.root ?? null; },
    get reducedMotion() { return Boolean(watchers.motionMql?.matches); },
    key(name) {
      const d = keys[name];
      if (!d) throw new RangeError(`ctx.key: unknown key "${name}"`);
      return {
        min: d.min, max: d.max, step: d.step,
        ...(d.stepOrigin !== undefined ? { stepOrigin: d.stepOrigin } : {}),
        value: state[name], name, valueType: d.type ?? "number",
        snap: Boolean(d.snap), continuous: Boolean(d.continuous),
      };
    },
    num: (raw, display, opts) => numSpan(raw, display, { document: doc, ...opts }),
    dataNum,
    slider: (o) => slider(scope, o),
    segmented: (o) => segmented(scope, o),
    button: (o) => button(scope, o),
    select: (o) => select(scope, o),
    radioGroup: (o) => radioGroup(scope, o),
    toggle: (o) => toggle(scope, o),
    numberInput: (o) => numberInput(scope, o),
    panelTitle: (content, opts) => panelTitle(doc, content, opts),
    scrollRegion: (node, label, options) => {
      const region = scrollRegion(node, label, options);
      overflowStops.set(region, watchOverflow(region));
      return region;
    },
    part(name, node) { node.setAttribute("data-prx-part", name); return node; },
    keepFocus: (fn) => keepFocus(root, fn),
    onPrimary(fn) { appPrimary = typeof fn === "function" ? fn : null; },
    width: () => watchers.getWidth(),
    layout,
    get disclosures() { return slots.disclosureGroup; },
    primaryGraphic(node) { if (node?.nodeType === 1) node.setAttribute("data-prx-primary", ""); return node; },
    primaryControl(node) { if (node?.nodeType === 1) node.setAttribute("data-prx-primary-control", ""); return node; },
    afterPresets(...nodes) {
      const list = nodes.flat().filter((n) => n?.nodeType === 1);
      if (presetRow && (presetRow.root.parentNode === controls || (toolbar && presetRow.root.parentNode === toolbar))) {
        presetRow.root.after(...list);
      } else if (toolbar) {
        controls.after(...list);
      } else {
        controls.append(...list);
        afterPresetNodes.push(...list);
      }
      return list[0] ?? null;
    },
    disclosure({ name, title: label, open = false, placement = "end", className } = {}) {
      const D = CONFIG.disclosure;
      const near = placement && typeof placement === "object" ? (placement.after ?? placement.before ?? null) : null;
      const where = near?.nodeType === 1 ? (placement.after ? "after" : "before") : D.placements.includes(placement) ? placement : "end";
      const box = h("details", { class: className ? `${D.className} ${className}` : D.className, "data-prx-disclosure": name ?? "" });
      const summary = h("summary", { class: D.summaryClass, "data-prx-focus-key": `disclosure:${name ?? uid("d")}` }, label ?? name ?? CONFIG.text.disclosure);
      const body = h("div", { class: D.bodyClass });
      box.append(summary, body);
      if (open) box.open = true;
      if (where === "controls") {
        box.setAttribute("data-prx-placement", "controls");
        if (toolbar) toolbar.append(box);
        else {
          const row = presetRow?.root;
          if (row && row.parentNode === controls) row.before(box); else controls.append(box);
        }
      } else if (where === "after") near.after(box);
      else if (where === "before") near.before(box);
      else if (where === "end") groupOfDisclosures().append(box);
      scope.listen(box, "toggle", () => {
        if (suppressNextToggle.delete(box)) return;
        if (box.open && !destroyed) render(new Set(), "disclosure", false, { disclosure: name ?? null });
      });
      return { root: box, summary, body, get open() { return box.open; }, set open(v) { box.open = Boolean(v); } };
    },
    settingsBox(label = CONFIG.text.settings, opts = {}) {
      if (!settingsDisclosure) settingsDisclosure = ctx.disclosure({ name: "settings", title: label, placement: "controls", ...opts });
      return settingsDisclosure;
    },
    dataBox(label = CONFIG.text.data, opts = {}) {
      if (!dataDisclosure) {
        dataDisclosure = ctx.disclosure({ name: "data", title: label, placement: "end", ...opts });
        if (methodDisclosure?.root.parentNode === slots.disclosureGroup) methodDisclosure.root.before(dataDisclosure.root);
      }
      return dataDisclosure;
    },
    methodBox(label = CONFIG.text.method, opts = {}) {
      if (!methodDisclosure) methodDisclosure = ctx.disclosure({ name: "method", title: label, placement: "end", ...opts });
      return methodDisclosure;
    },
    scheduleStages,
    set(partial) { if (rendering || !handleReady) queued.push(partial); else handle.update(partial); },
    requestRender(reason = "request") {
      if (rendering) {
        pendingRenderReason = reason;
        return;
      }
      render(new Set(), reason);
    },
  };

  function syncHeadingLevels() {
    if (!root.isConnected) return;
    const isVisible = (el) => {
      if (el.closest?.('[aria-hidden="true"], [hidden]')) return false;
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (p.tagName === "DETAILS" && !p.open && p.querySelector(":scope > summary") !== el && !p.querySelector(":scope > summary")?.contains(el)) return false;
      }
      return typeof el.checkVisibility === "function" ? el.checkVisibility() : true;
    };
    const authoredLevel = (el) => {
      if (el.__prxAuthoredLevel) return el.__prxAuthoredLevel;
      const lv = /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : Number(el.getAttribute("aria-level") || CONFIG.panelTitle.level);
      el.__prxAuthoredLevel = clamp(Number.isFinite(lv) ? lv : CONFIG.panelTitle.level, 1, 6);
      el.__prxAuthoredRole = el.getAttribute("role");
      return el.__prxAuthoredLevel;
    };
    let prev = 1;
    if (doc?.querySelectorAll) {
      const before = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(
        (h) => !root.contains(h) && isVisible(h) && Boolean(h.compareDocumentPosition(root) & 4),
      );
      if (before.length) prev = authoredLevel(before[before.length - 1]);
    }
    for (const h of root.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")) {
      if (!isVisible(h)) continue;
      const auth = authoredLevel(h);
      const next = Math.min(auth, prev + 1);
      if (/^H[1-6]$/.test(h.tagName)) {
        if (next !== auth) {
          h.setAttribute("role", "heading");
          h.setAttribute("aria-level", String(next));
        } else {
          if (h.__prxAuthoredRole) h.setAttribute("role", h.__prxAuthoredRole);
          else h.removeAttribute("role");
          h.removeAttribute("aria-level");
        }
      } else {
        h.setAttribute("aria-level", String(next));
      }
      prev = next;
    }
  }

  function flushQueued() {
    while (handleReady && !rendering && queued.length) handle.update(queued.shift());
  }

  function render(changed, reason, initial = false, extra = null) {
    if (destroyed || !inst || (typeof inst.render !== "function" && typeof inst.renderDisclosure !== "function")) return;
    const t0 = win.performance?.now?.() ?? 0;
    rendering = true;
    const renderInfo = { initial, changed: [...changed], reason, ...(extra ?? {}) };
    try {
      let handled = false;
      if (reason === "disclosure" && typeof inst.renderDisclosure === "function") {
        handled = keepFocus(root, () => inst.renderDisclosure(extra?.disclosure ?? null, { ...state }, renderInfo)) === true;
      }
      if (!handled && typeof inst.render === "function") {
        renderScope.cleanup();
        keepFocus(root, () => inst.render({ ...state }, renderInfo));
      }
      delete root.dataset.prxError;
    } catch (err) {
      console.error(err);
      root.dataset.prxError = String(err?.message ?? err);
      if (!readout.text().trim()) readout.set(CONFIG.text.renderError);
    } finally {
      rendering = false;
      syncScopeLine();
      syncOverflowRegions();
      syncHeadingLevels();
    }
    syncPresets();
    markLabelStarts(root);
    root.dataset.renderMs = ((win.performance?.now?.() ?? 0) - t0).toFixed(1);
    flushQueued();
    if (!rendering && pendingRenderReason !== null && renderDepth < 8) {
      const nextReason = pendingRenderReason;
      pendingRenderReason = null;
      renderDepth += 1;
      try {
        render(new Set(), nextReason);
      } finally {
        renderDepth -= 1;
      }
    }
  }

  // --- build and first render
  inst = def.build(ctx) ?? {};
  syncScopeLine();
  if (presetRow && layout !== "v2" && !presetRow.root.parentNode) {
    controls.append(presetRow.root);
    if (afterPresetNodes.length) presetRow.root.after(...afterPresetNodes);
    if (layout === "result-first") {
      if (orderedPresets.length >= 7) {
        presetRow.root.setAttribute("data-prx-preset-rows", "2");
        presetRow.root.style.setProperty("--prx-preset-cols", String(Math.ceil(orderedPresets.length / 2)));
      }
      const buttons = presetRow.root.querySelector(".prx-seg-buttons");
      if (buttons) scope.onCleanup(watchOverflow(buttons, { keyboardStop: false }));
    }
  }
  render(new Set(Object.keys(keys)), "mount", true);

  const openBoxes = (names) => {
    const list = Array.isArray(names) ? names : typeof names === "string" ? names.split(",") : [];
    for (const n of list) {
      const discName = String(n).trim();
      const box = [...root.querySelectorAll("details[data-prx-disclosure]")].find((d) => d.getAttribute("data-prx-disclosure") === discName);
      if (box && !box.open) {
        suppressNextToggle.add(box);
        box.open = true;
        render(new Set(), "disclosure", false, { disclosure: discName });
      }
    }
  };
  openBoxes(initialOpen);

  // --- handle
  handle = {
    root,
    get state() { return { ...state }; },
    /** Apply a preset of the catalog entry by id (or a spec object as a whole setting). */
    applyPreset(p) {
      const s = presetSetting(p);
      if (!s) return handle;
      preferredPresetId = typeof p === "string" ? p : null;
      const result = handle.update(s);
      syncPresets(); // Aliases may have identical keys and therefore need no render.
      return result;
    },
    update(partial) {
      if (destroyed || !isRecord(partial)) return handle;
      if (Object.prototype.hasOwnProperty.call(partial, "preset")) {
        const s = presetSetting(partial.preset);
        const { preset: _p, ...rest } = partial;
        if (s) preferredPresetId = typeof partial.preset === "string" ? partial.preset : null;
        const result = handle.update({ ...(s ?? {}), ...rest });
        syncPresets();
        return result;
      }
      const changed = new Set();
      let rerender = false;
      if (Object.prototype.hasOwnProperty.call(partial, "theme")) {
        theme = pickTheme(partial.theme);
        setTheme();
        if (theme) doc.documentElement.setAttribute("data-theme", theme);
        else doc.documentElement.removeAttribute("data-theme");
        rerender = true;
      }
      applyKeys(partial, changed);
      if (changed.size || rerender) render(changed, changed.size ? "update" : "theme");
      if (Object.prototype.hasOwnProperty.call(partial, "open")) openBoxes(partial.open);
      return handle;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelStages();
      try { inst?.destroy?.(); } catch (err) { console.warn("app destroy failed", err); }
      renderScope.cleanup();
      scope.cleanup();
      root.removeAttribute("aria-busy");
      frame.remove();
      el.replaceChildren(...original);
    },
  };
  widgetDefinitions.set(handle, keys);
  scope.onCleanup(() => widgetDefinitions.delete(handle));
  handleReady = true;
  flushQueued();
  if (def.bridge !== false) {
    const detach = attachBridge(handle, { allowed: [...Object.keys(keys), "preset", "theme", "open"], parse: { ...types, preset: "string", theme: [...BRIDGE.themes], open: "strings" }, window: win });
    scope.onCleanup(detach);
  }
  return handle;
}

export { queryString };

// Read-only declaration lookup for tools that validate a custom key's accepted spelling.
// Definitions and parser functions never enter the serialized state or iframe messages.
const widgetDefinitions = new WeakMap();
export function widgetKeyDefinition(handle, name) {
  const definition = widgetDefinitions.get(handle)?.[name];
  return definition ? { ...definition } : undefined;
}
