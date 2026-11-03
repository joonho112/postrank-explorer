// The jsdom window an app is mounted in by verification/widget_harness.mjs (the read-out check), and by any jsdom test
// that needs a whole page: the site's styles, the vendored D3, Plot and Temml, matchMedia, a ResizeObserver stub and a
// recording 2D canvas. (From postrank Explorer v1, verification/tests/dom-env.mjs; the stylesheets are v3's.)
// Importing this module runs nothing.
//
//   makeWindow(options) -> { dom, win, doc, el, media, ro, listeners, canvas, restore() }
//     url          page URL (default https://site.test/embed/test.html)
//     query        window.__PRX_QUERY before anything is mounted (base.js reads it before location.search)
//     css          inject styles/app.css (default true); tokens: also styles/tokens.css first (default false);
//                  temmlCss: also styles/temml.css (default false)
//     plot         evaluate the vendored d3.min.js and plot.min.js in the window (default true); chart.js reads
//                  window.Plot from the window that owns the chart
//     temml        evaluate temml.min.js and expose it as globalThis.temml (math.js reads the global): true, or false
//                  (default) for a page without it, as an embed of an app whose catalog entry has no "math": true; in
//                  both cases globalThis.temml is what this window has until restore() gives back the previous value
//     media        initial matchMedia answers { "(prefers-reduced-motion: reduce)": true, ... }
//     resizeObserver  install a controllable ResizeObserver stub (default true); it never fires on its own
//     canvas       install a recording 2D context on HTMLCanvasElement (default true; jsdom has none)
//     body         the body HTML; the mount element is #w
//   media.set(query, matches) changes an answer and fires "change"; media.count() = live change listeners.
//   ro.fire(width) calls every connected observer; ro.live() = connected observers.
//   listeners.count(type) = window listeners added and not removed.
//   canvas.fills = every fillStyle assigned on any fake context.
//   restore() closes the window and gives globalThis.temml back.
// key(target, k, opts) dispatches a keydown; sleep(ms); describe(node) names a focusable element for Tab-order tests.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(`${ROOT}tools/package.json`);
export const { JSDOM } = require("jsdom");

export const CONFIG = Object.freeze({
  url: "https://site.test/embed/test.html",
  styles: Object.freeze({ app: "styles/app.css", tokens: "styles/tokens.css", temml: "styles/temml.css" }),
  vendor: Object.freeze({ d3: "js/vendor/d3.min.js", plot: "js/vendor/plot.min.js", temml: "js/vendor/temml/temml.min.js" }),
  body: '<div id="outside">outside</div><div id="w"><p class="fallback">This app needs JavaScript.</p></div>',
  mountId: "w",
});

const cache = new Map();
/** A project file's text, read once. */
export const source = (p) => {
  if (!cache.has(p)) cache.set(p, readFileSync(`${ROOT}${p}`, "utf8"));
  return cache.get(p);
};

export function makeWindow({
  url = CONFIG.url,
  query,
  css = true,
  tokens = false,
  temmlCss = false,
  plot = true,
  temml = false,
  media = {},
  resizeObserver = true,
  canvas = true,
  body = CONFIG.body,
} = {}) {
  const sheets = [tokens && CONFIG.styles.tokens, css && CONFIG.styles.app, temmlCss && CONFIG.styles.temml].filter(Boolean);
  const styles = sheets.map((p) => `<style>${source(p)}</style>`).join("");
  const dom = new JSDOM(`<!doctype html><html lang="en"><head>${styles}</head><body>${body}</body></html>`, {
    url, runScripts: "outside-only", pretendToBeVisual: true,
  });
  const win = dom.window;
  const doc = win.document;
  if (query !== undefined) win.__PRX_QUERY = query;

  // window listener bookkeeping
  const live = new Map();
  const add = win.addEventListener.bind(win);
  const remove = win.removeEventListener.bind(win);
  win.addEventListener = (type, fn, opts) => { live.set(type, (live.get(type) ?? 0) + 1); return add(type, fn, opts); };
  win.removeEventListener = (type, fn, opts) => { live.set(type, (live.get(type) ?? 0) - 1); return remove(type, fn, opts); };
  const listeners = { count: (type) => live.get(type) ?? 0 };

  // matchMedia
  const answers = new Map(Object.entries(media));
  const lists = new Map();
  win.matchMedia = (q) => {
    if (!lists.has(q)) {
      const fns = new Set();
      const mql = {
        media: q,
        get matches() { return Boolean(answers.get(q)); },
        addEventListener(type, fn) { if (type === "change") fns.add(fn); },
        removeEventListener(type, fn) { if (type === "change") fns.delete(fn); },
        addListener(fn) { fns.add(fn); },
        removeListener(fn) { fns.delete(fn); },
        fns,
      };
      lists.set(q, mql);
    }
    return lists.get(q);
  };
  const mediaApi = {
    set(q, matches) {
      answers.set(q, matches);
      const mql = win.matchMedia(q);
      for (const fn of [...mql.fns]) fn({ matches, media: q });
    },
    count() { let n = 0; for (const m of lists.values()) n += m.fns.size; return n; },
  };

  // ResizeObserver
  const observers = new Set();
  if (resizeObserver) {
    win.ResizeObserver = class {
      constructor(cb) { this.cb = cb; this.targets = []; }
      observe(t) { this.targets.push(t); observers.add(this); }
      unobserve() {}
      disconnect() { observers.delete(this); this.disconnected = true; }
    };
  }
  const ro = {
    fire(width) { for (const o of [...observers]) o.cb(o.targets.map((target) => ({ target, contentRect: { width, height: 0 } })), o); },
    live: () => observers.size,
  };

  // a recording 2D canvas context (jsdom has none)
  const fills = [];
  if (canvas) {
    win.HTMLCanvasElement.prototype.getContext = function getContext() {
      if (!this.__ctx) {
        const calls = [];
        this.__ctx = {
          calls,
          set fillStyle(v) { fills.push(v); calls.push(["fillStyle", v]); this._fill = v; },
          get fillStyle() { return this._fill ?? "#000000"; },
          set strokeStyle(v) { calls.push(["strokeStyle", v]); this._stroke = v; },
          get strokeStyle() { return this._stroke ?? "#000000"; },
          fillRect(...a) { calls.push(["fillRect", ...a]); },
          clearRect() {}, setTransform() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
          save() { calls.push(["save"]); }, restore() { calls.push(["restore"]); },
          rect(...a) { calls.push(["rect", ...a]); }, clip() { calls.push(["clip"]); },
          fill() { calls.push(["fill"]); }, stroke() { calls.push(["stroke"]); }, arc() {}, drawImage() {},
        };
      }
      return this.__ctx;
    };
    win.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,AA==";
  }

  if (plot) {
    win.eval(source(CONFIG.vendor.d3));
    win.eval(source(CONFIG.vendor.plot));
  }
  const previousTemml = globalThis.temml;
  if (temml) win.eval(source(CONFIG.vendor.temml));
  globalThis.temml = temml ? win.temml : undefined;
  return {
    dom, win, doc, el: doc.getElementById(CONFIG.mountId), media: mediaApi, ro, listeners, canvas: { fills },
    restore() {
      globalThis.temml = previousTemml;
      win.close();
    },
  };
}

/** Dispatch a keydown (bubbling, cancelable); returns the event. */
export function key(target, k, opts = {}) {
  const win = target.ownerDocument.defaultView;
  const e = new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(e);
  return e;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Short description of a focusable element for Tab-order assertions. */
export function describe(n) {
  const tag = n.tagName.toLowerCase();
  if (tag === "input") return `input:${n.type}${n.name ? `:${n.name.replace(/-\d+$/, "")}` : ""}`;
  if (tag === "button") return `button:${n.textContent || n.getAttribute("aria-label")}`;
  return tag;
}
