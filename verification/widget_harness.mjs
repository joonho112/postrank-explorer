// Mounting an app in jsdom for the read-out check (verification/check_readouts.mjs). The window comes from
// verification/dom-env.mjs (the site's styles, the vendored D3, Plot and Temml, a ResizeObserver stub). Apps import
// their data as JSON, so nothing is loaded into the window besides the vendored libraries. (From postrank Explorer
// v1, verification/widget_harness.mjs, without the prediction gate: there is no predict=off and no scripted
// prediction.) Importing this module runs nothing.
//
//   mountCase({ module, query, spec, updates, timeout }) -> { env, win, doc, el, handle, root, initial, close() }
//     module   a path (project-relative or absolute) to an ES module that exports mountWidget, or a module object
//     query    "?k=v&..." as caseQuery gives it; window.__PRX_QUERY carries it, as an embed's address would
//     spec     the object passed to mountWidget(el, spec) (base.js: a preset first, then the spec, then the URL keys)
//     updates  partial specs passed to handle.update() in order after the first render; each is settled
//     The app is mounted on #w of a fresh window; handle is what mountWidget returned, root its .prx-widget, and
//     initial what the first render showed, before the updates: { state, pressed, widget } = the app's state, the ids
//     of the preset buttons shown pressed, and the root's data-prx-widget (createWidget's name). The caller closes it
//     (close() destroys the app and the window).
//   settle(win, el)   two event-loop turns, then wait while an element at, inside or around el has aria-busy="true"
//     (an app that renders in stages marks itself busy until it is done), then one more turn. It throws when the app
//     is still busy after the timeout (CONFIG.settleTimeoutMs).
//   caseQuery(c, entry) -> { query, presetQuery, problems: [{ rule, text }] }   the query of a read-out case. A preset
//     case mounts at "?preset=<id>", the way a reader reaches a preset (a ?preset= link, the preset row, a message):
//     base.js applies the preset of the app's own catalog entry; presetQuery is that preset's query in the catalog
//     entry (catalog.json apps[].presets, by its v3 id). A query case mounts at its raw query. Problems: an unknown
//     preset (rule "case"); a query that sets predict (rule "predict": v3 has no prediction gate); a raw query that
//     sets preset (rule "case": name the preset in the case's preset field).
//   appKeyProblems({ initial, defaults, query, presetQuery, spec, updates, preset }) -> [{ where, text }]   settings a
//     case names that the app does not show. Names: keys of the query, the preset's query, the spec and the updates
//     that are not keys of the app (Object.keys(initial.state)): the app ignores them (a key renamed in the port, a v1
//     key such as present). Values (with `defaults`, the app's state at an empty query): a key of the query or the
//     preset's query whose value the app did not take, so it shows its default for that key although the value names
//     another setting (a value it cannot read, a choice it does not offer, a non-integer for an integer key, or a value
//     it clamps to its default). Keys the spec also sets are not value-checked. Reserved keys pass: theme in a query;
//     preset, theme and query in a spec; preset and theme in an update.
//   importClosure(file) -> Set of project-relative paths: the module and everything it imports through relative
//     specifiers, transitively (JSON included, not followed); comment lines are skipped
//   loadCatalog(), entryFor(id), entryByName(name)   catalog.json (written by scripts/build.mjs) and its apps
//   loadAppModule(module)   import an app module (or pass a module object through)
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeWindow } from "./dom-env.mjs";
import { widgetKeyDefinition } from "../js/shared/base.js";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const CONFIG = Object.freeze({
  settleTimeoutMs: 10000,
  pollMs: 10,
  catalog: "catalog.json",
  busy: '[aria-busy="true"]',
  url: "https://site.test/embed/check.html",
  rootSelector: ".prx-widget",
  presetRow: '[data-prx-part="presets"]',
  reserved: Object.freeze({
    query: Object.freeze(["theme", "preset"]),
    spec: Object.freeze(["preset", "theme", "query"]),
    update: Object.freeze(["preset", "theme"]),
  }),
  // base.js reads these words for a boolean key (base.js sanitize)
  on: Object.freeze(["true", "on", "yes", "1"]),
  off: Object.freeze(["false", "off", "no", "0"]),
  sameTolerance: 1e-9,
});

const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p));
const posix = (p) => p.split(sep).join("/");
let catalogCache = null;

/** The merged catalog (catalog.json: { about, parts, apps }), read once. */
export function loadCatalog() {
  if (!catalogCache) catalogCache = existsSync(abs(CONFIG.catalog)) ? JSON.parse(readFileSync(abs(CONFIG.catalog), "utf8")) : { parts: [], apps: [] };
  return catalogCache;
}

/** One app of the catalog by its id ("1.3"), or null. */
export function entryFor(id) {
  return (loadCatalog().apps ?? []).find((a) => a.id === id) ?? null;
}

/** One app of the catalog by its name ("noisy-league"), or null. */
export function entryByName(name) {
  return (loadCatalog().apps ?? []).find((a) => a.name === name) ?? null;
}

/** The query of a read-out case (see the header). */
export function caseQuery(c, entry) {
  const problems = [];
  let query = "";
  let presetQuery = null;
  if (c.preset !== undefined) {
    const p = (entry?.presets ?? []).find((x) => x.id === c.preset);
    if (!entry) problems.push({ rule: "case", text: `preset "${c.preset}" needs a catalog entry` });
    else if (!p) problems.push({ rule: "case", text: `preset "${c.preset}" is not a preset of ${entry.id} ${entry.name} (its presets: ${(entry.presets ?? []).map((x) => x.id).join(", ") || "none"}); v3 presets have their own ids` });
    else {
      query = `?preset=${encodeURIComponent(c.preset)}`;
      presetQuery = String(p.query ?? "").replace(/^\?/, "");
    }
  } else {
    query = c.query ?? "";
    if (query && !query.startsWith("?")) query = `?${query}`;
  }
  const params = new URLSearchParams(c.preset !== undefined ? presetQuery ?? "" : query);
  if (params.has("predict")) problems.push({ rule: "predict", text: `the ${c.preset !== undefined ? `preset's query (${presetQuery})` : `query (${query})`} sets predict: v3 apps have no prediction gate, so there is nothing to switch off; drop the key` });
  if (c.preset === undefined && params.has("preset")) problems.push({ rule: "case", text: `the query sets preset (${query}): give the preset as the case's "preset" (its v3 id), and further keys as an update` });
  return { query, presetQuery, problems };
}

/** Does a query value name the setting `d` (a key's value in the app's state)? */
function names(v, d, definition) {
  // A custom null sentinel can have an explicit spelling such as auto or an empty string.
  // Ask the actual parser; treating every nullable key as accepting auto would hide invalid queries.
  if (d === null && definition?.type === "custom" && typeof definition.parse === "function") {
    try { return definition.parse(v, d) === null; } catch { return false; }
  }
  if (typeof d === "number") {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && Math.abs(n - d) <= CONFIG.sameTolerance * Math.max(1, Math.abs(d));
  }
  if (typeof d === "boolean") {
    const w = v.trim().toLowerCase();
    return d ? CONFIG.on.includes(w) : CONFIG.off.includes(w);
  }
  if (Array.isArray(d)) {
    const parts = v.split(",");
    return parts.length === d.length && parts.every((x, i) => names(x, d[i]));
  }
  // a custom key's object value: a query value cannot be compared with it, so it is not reported
  if (d !== null && typeof d === "object") return true;
  return v === String(d);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Settings a case names that the mounted app does not show (see the header). */
export function appKeyProblems({ initial, defaults, query = "", presetQuery = null, spec, updates, preset, handle } = {}) {
  const state = initial?.state;
  if (!state || typeof state !== "object") return [];
  const keys = new Set(Object.keys(state));
  const list = `its keys: ${[...keys].join(", ")}`;
  const out = [];
  const R = CONFIG.reserved;
  const fromPreset = presetQuery !== null;
  const params = new URLSearchParams(fromPreset ? presetQuery : query);
  const seen = new Set();
  for (const [k, v] of params) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (R.query.includes(k)) continue;
    const where = fromPreset ? `preset "${preset}" sets ${k}` : `the query sets ${k}`;
    if (!keys.has(k)) {
      out.push({ where: "query", text: `${where}, which is not a key of the app (${list}); ${fromPreset ? "the catalog preset or the app is wrong" : "the app ignores it"}` });
      continue;
    }
    if (!defaults || Object.hasOwn(spec ?? {}, k)) continue;
    if (same(state[k], defaults[k]) && !names(v, defaults[k], widgetKeyDefinition(handle, k))) {
      out.push({ where: "query", text: `${where}=${v}, but the app shows its default ${k} = ${JSON.stringify(defaults[k])}: a value it cannot read, a choice it does not offer, or one it clamps to its default${fromPreset ? " (the catalog preset or the app is wrong)" : ""}` });
    }
  }
  for (const k of Object.keys(spec ?? {})) {
    if (!keys.has(k) && !R.spec.includes(k)) out.push({ where: "spec", text: `the spec sets ${k}, which is not a key of the app (${list}); the app ignores it` });
  }
  (updates ?? []).forEach((u, i) => {
    for (const k of Object.keys(u ?? {})) {
      if (!keys.has(k) && !R.update.includes(k)) out.push({ where: `update[${i}]`, text: `the update sets ${k}, which is not a key of the app (${list}); the app ignores it` });
    }
  });
  return out;
}

// static imports and re-exports at the start of a line (they may run over several lines), side-effect imports, and
// dynamic imports with a literal specifier
const IMPORTS = [/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm, /^[ \t]*import\s*["']([^"']+)["']/gm, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g];

/** A module and everything it imports through relative specifiers (see the header). */
export function importClosure(file) {
  const out = new Set();
  const visit = (f) => {
    const r = posix(relative(ROOT, f));
    if (out.has(r) || r.startsWith("..")) return;
    out.add(r);
    if (!/\.m?js$/.test(f) || !existsSync(f)) return;
    const text = readFileSync(f, "utf8");
    for (const re of IMPORTS) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(text.lastIndexOf("\n", m.index) + 1, m.index).trimStart();
        if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
        const spec = m[1];
        if (spec.startsWith("./") || spec.startsWith("../")) visit(resolve(dirname(f), spec));
        else if (spec.startsWith("file:")) visit(fileURLToPath(spec));
      }
    }
  };
  visit(abs(file));
  return out;
}

/** Import an app module (a path) or pass a module object through. */
export async function loadAppModule(module) {
  if (module && typeof module === "object") return module;
  const file = abs(String(module));
  if (!existsSync(file)) throw new Error(`app module not found: ${module}`);
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.mountWidget !== "function") throw new Error(`${module} does not export mountWidget`);
  return mod;
}

const turn = (win) => new Promise((r) => win.setTimeout(r, 0));

/** Wait for an app to finish rendering (see the header). */
export async function settle(win, el, { timeout = CONFIG.settleTimeoutMs } = {}) {
  await turn(win);
  await turn(win);
  const t0 = Date.now();
  const busy = () => el.matches?.(CONFIG.busy) || el.querySelector(CONFIG.busy) || el.closest?.(CONFIG.busy);
  while (busy()) {
    if (Date.now() - t0 > timeout) throw new Error(`the app is still aria-busy after ${timeout} ms`);
    await new Promise((r) => win.setTimeout(r, CONFIG.pollMs));
  }
  await turn(win);
}

/** Mount one app case in a fresh jsdom window (see the header). The caller closes it. */
export async function mountCase({ module, query = "", spec = {}, updates = [], timeout } = {}) {
  const mod = await loadAppModule(module);
  // Temml is always loaded, as in v1: math.js caches rendered formulas per process, so a window without it would not
  // show what an embed without it shows anyway (the check compares a formula with the catalog's "math" flag instead)
  const env = makeWindow({ url: CONFIG.url, query, tokens: true, temml: true });
  let handle = null;
  let initial = null;
  const close = () => {
    try { handle?.destroy?.(); } catch { /* the window goes anyway */ }
    env.restore();
  };
  try {
    handle = mod.mountWidget(env.el, spec);
    if (!handle || typeof handle.update !== "function") throw new Error("mountWidget did not return { update, destroy }");
    await settle(env.win, env.el, { timeout });
    const root = handle.root ?? env.el.querySelector(CONFIG.rootSelector);
    initial = {
      state: handle.state && typeof handle.state === "object" ? { ...handle.state } : null,
      pressed: [...(root?.querySelectorAll(`${CONFIG.presetRow} [aria-pressed="true"]`) ?? [])].map((b) => b.getAttribute("data-value")),
      widget: root?.getAttribute("data-prx-widget") ?? null,
    };
    for (const u of updates) {
      handle.update(u);
      await settle(env.win, env.el, { timeout });
    }
  } catch (err) {
    close();
    throw err;
  }
  return { env, win: env.win, doc: env.doc, el: env.el, handle, root: handle.root ?? env.el.querySelector(CONFIG.rootSelector), initial, close };
}
