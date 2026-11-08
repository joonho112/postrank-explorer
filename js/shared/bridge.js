/**
 * bridge.js: URL parameters and the postMessage bridge for embedded apps (from postrank Explorer v1, without the
 * prediction-gate and present-mode keys).
 *
 * readQuery({ allowed, types, window }) -> { spec, preset, theme, open, ignored }
 *   Reads window.__PRX_QUERY ?? location.search (an empty string in __PRX_QUERY still wins).
 *     spec     the allowed app keys, parsed by `types`. Parsing only: an out-of-range value passes through unchanged
 *              and the app clamps it. Unknown keys and unreadable values are dropped.
 *     preset   a preset id (short plain text) or null; the app looks it up in its catalog entry.
 *     theme    one of CONFIG.themes or null.
 *     open     the names of the app's disclosures to open at mount (open=data,method), or null (review 044 repair).
 *     ignored  [{ key, value, reason }] for every parameter that was dropped (for checks and debugging).
 *   The reserved keys preset, theme and open never enter `spec`. A repeated key keeps its first value.
 *
 * attachBridge(app, { allowed, parse, window }) -> detach()
 *   Listens for postMessage({ prx: spec }) and calls app.update(partial) with the allowed keys only. A message is
 *   accepted only when event.source === window.parent. The origin is not checked: on file:// it is "null".
 *   `parse` is either a function (value, key) -> parsed value (undefined drops the key) or a types object of the
 *   same form as readQuery's `types`; without it, values are inferred (finite numbers, booleans, short plain text,
 *   flat lists of these). Nothing is sent back and focus is never moved, so keyboard focus stays in the parent page.
 *
 * Types: "number", "integer", "boolean", "string", "numbers" and "strings" (comma lists in a query, arrays in a
 * message), an array of allowed strings, or a function (value, key) -> parsed value | undefined.
 */

export const CONFIG = Object.freeze({
  messageKey: "prx",
  reservedKeys: Object.freeze(["preset", "theme", "open"]),
  themes: Object.freeze(["light", "dark"]),
  onWords: Object.freeze(["on", "true", "1", "yes"]),
  offWords: Object.freeze(["off", "false", "0", "no"]),
  typeNames: Object.freeze(["number", "integer", "boolean", "string", "numbers", "strings"]),
  maxTextLength: 64,
  maxListLength: 64,
});

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_TEXT = /^[\p{L}\p{N}\p{Zs}_.,:;()/+-]+$/u;

const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isSafeKey = (k) => typeof k === "string" && k !== "" && !FORBIDDEN_KEYS.has(k);

function hostWindow(win) {
  if (win) return win;
  return typeof window === "undefined" ? undefined : window;
}

/** The query string the app reads: window.__PRX_QUERY ?? location.search. */
export function queryString(win) {
  const w = hostWindow(win);
  if (!w) return "";
  const q = w.__PRX_QUERY ?? w.location?.search;
  return typeof q === "string" ? q : "";
}

function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(v) {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (CONFIG.onWords.includes(s)) return true;
  if (CONFIG.offWords.includes(s)) return false;
  return undefined;
}

function toText(v) {
  if (typeof v !== "string" || v.length > CONFIG.maxTextLength || !SAFE_TEXT.test(v)) return undefined;
  return v;
}

function toList(v, item) {
  const parts = Array.isArray(v) ? v : typeof v === "string" ? v.split(",").map((s) => s.trim()) : null;
  if (!parts || parts.length === 0 || parts.length > CONFIG.maxListLength) return undefined;
  const out = parts.map(item);
  return out.some((x) => x === undefined) ? undefined : out;
}

function infer(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "false") return s === "true";
    return toNumber(v) ?? toText(v);
  }
  if (Array.isArray(v)) return toList(v, (x) => (Array.isArray(x) || isRecord(x) ? undefined : infer(x)));
  return undefined;
}

function checkTypes(types) {
  if (types === undefined || types === null) return {};
  if (!isRecord(types)) throw new TypeError("bridge: types must be an object of key -> type");
  for (const [key, t] of Object.entries(types)) {
    const ok = typeof t === "function" || (Array.isArray(t) && t.every((x) => typeof x === "string")) || CONFIG.typeNames.includes(t);
    if (!ok) throw new TypeError(`bridge: unknown type for "${key}": ${JSON.stringify(t)}`);
  }
  return types;
}

/** Parse one value (a query string or a message value) by its declared type; undefined = drop it. */
export function coerce(type, value, key) {
  if (typeof type === "function") return type(value, key);
  if (Array.isArray(type)) return typeof value === "string" && type.includes(value) ? value : undefined;
  switch (type) {
    case undefined:
    case null:
      return infer(value);
    case "number":
      return toNumber(value);
    case "integer": {
      const n = toNumber(value);
      return Number.isInteger(n) ? n : undefined;
    }
    case "boolean":
      return toBoolean(value);
    case "string":
      return toText(value);
    case "numbers":
      return toList(value, toNumber);
    case "strings":
      return toList(value, toText);
    default:
      return undefined;
  }
}

const describe = (t) => (typeof t === "string" ? t : Array.isArray(t) ? `one of ${t.join(", ")}` : "value");

/** Read the embed URL parameters (see the header). */
export function readQuery({ allowed = [], types, window: win } = {}) {
  const typeMap = checkTypes(types);
  const keys = new Set(allowed.filter((k) => isSafeKey(k) && !CONFIG.reservedKeys.includes(k)));
  const out = { spec: {}, preset: null, theme: null, open: null, ignored: [] };
  const seen = new Set();
  for (const [key, value] of new URLSearchParams(queryString(win))) {
    const drop = (reason) => out.ignored.push({ key, value, reason });
    if (seen.has(key)) {
      drop("repeated key; the first value is used");
      continue;
    }
    seen.add(key);
    if (key === "theme") {
      if (CONFIG.themes.includes(value)) out.theme = value;
      else drop(`theme takes ${CONFIG.themes.join(", ")}`);
    } else if (key === "preset") {
      const v = toText(value);
      if (v === undefined) drop("preset takes a preset id");
      else out.preset = v;
    } else if (key === "open") {
      const v = toList(value, toText);
      if (v === undefined) drop("open takes disclosure names");
      else out.open = v;
    } else if (!keys.has(key)) {
      drop("not an allowed key");
    } else {
      const v = coerce(typeMap[key], value, key);
      if (v === undefined) drop(`not a valid ${describe(typeMap[key])}`);
      else out.spec[key] = v;
    }
  }
  return out;
}

/** Accept postMessage({ prx: spec }) from the parent window only, for the allowed keys only. */
export function attachBridge(widget, { allowed = [], parse, window: win } = {}) {
  if (!widget || typeof widget.update !== "function") throw new TypeError("attachBridge: the widget has no update(partial) method");
  const w = hostWindow(win);
  if (!w || typeof w.addEventListener !== "function") return () => {};
  const keys = new Set(allowed.filter(isSafeKey));
  let parseValue;
  if (typeof parse === "function") {
    parseValue = parse;
  } else {
    const typeMap = checkTypes(parse);
    parseValue = (value, key) => coerce(typeMap[key], value, key);
  }
  const onMessage = (event) => {
    if (event.source !== w.parent) return;
    const data = event.data;
    if (!isRecord(data) || !Object.prototype.hasOwnProperty.call(data, CONFIG.messageKey)) return;
    const spec = data[CONFIG.messageKey];
    if (!isRecord(spec)) return;
    const partial = {};
    let count = 0;
    for (const key of Object.keys(spec)) {
      if (!keys.has(key)) continue;
      const v = parseValue(spec[key], key);
      if (v === undefined) continue;
      partial[key] = v;
      count += 1;
    }
    if (count === 0) return;
    try {
      widget.update(partial);
    } catch (err) {
      console.warn("bridge: widget.update failed", err);
    }
  };
  w.addEventListener("message", onMessage);
  let attached = true;
  return function detach() {
    if (!attached) return;
    attached = false;
    w.removeEventListener("message", onMessage);
  };
}
