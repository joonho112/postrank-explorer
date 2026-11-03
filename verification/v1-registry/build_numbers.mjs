#!/usr/bin/env node
// Number registry builder (CONTRACT 5.1-5.3). Computes every engine key of numbers/spec/*.json with js/pr-core.js,
// formats it with the engine's formatters (never by hand), and writes
//   data/numbers.json                 key -> { type, value, display, tolerance, settings, source, license_scope, owner }
//   _extensions/num/registry.json     display strings of numbers.json + numbers-cases.json, and the catalog presets,
//                                     read by the num / setting / preset shortcodes (so no shortcode runs JavaScript)
//   data/numbers.js                   the registry twin for widgets: a classic script that sets
//                                     window.PRX_DATA.numbers = key -> { type, value, display } for both files
//                                     (math.js reads it for \prxnum; embeds and pages load it, CONTRACT 8.7)
// Output is deterministic: keys in code-point order, one entry per line, no timestamps.
//
//   node scripts/build_numbers.mjs                     every numbers/spec/*.json except _*.json
//   node scripts/build_numbers.mjs --spec <file|dir>   these spec files instead (repeatable; _example.json allowed)
//        --out <dir>        where numbers.json is written and numbers-cases.json is read (default data/)
//        --registry <file>  registry.json path (default _extensions/num/registry.json)
//        --catalog <dir>    catalog fragments (default catalog/entries)
//        --data-root <dir>  root of released/ and precomputed/ for $data references (default data/)
//        --engine <file>    engine ES module (default js/pr-core.js)
// Importing this module runs nothing; the CLI runs only when the file is the entry script.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve, relative, dirname, basename, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { KEY_RE, SETTINGS_PREFIX, TYPES, NUMBERS_FILE, CASES_FILE, createRegistry, isSettingKey } from "./registry.mjs";
import { NAMED_FORMATS } from "../js/widgets/format.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SCHEMA = JSON.parse(readFileSync(join(ROOT, "numbers/schema.json"), "utf8"));
export const DEFAULTS = {
  specDir: join(ROOT, "numbers/spec"),
  out: join(ROOT, "data"),
  registry: join(ROOT, "_extensions/num/registry.json"),
  catalog: join(ROOT, "catalog/entries"),
  dataRoot: join(ROOT, "data"),
  engine: join(ROOT, "js/pr-core.js"),
};
export const REGISTRY_FORMAT = "postrank-explorer-registry/1";
export const NUMBERS_TWIN_FILE = "numbers.js";
// Options that carry a setting value; in spec args they must be {"$setting": "settings.<name>"} (CONTRACT 5.3, 5.4).
export const SETTING_OPTIONS = ["tau", "lambda", "w"];
const NUMERIC_TYPES = new Set(["scalar", "vector", "fraction", "set"]);
const posix = (p) => p.split(sep).join("/");
// Repo-relative path for files inside the repository, absolute otherwise.
const rel = (p) => { const r = relative(ROOT, p); return r.startsWith("..") ? p : posix(r); };

// ---------------------------------------------------------------------------------------------------------------
// A validator for the JSON Schema keywords numbers/schema.json uses.
// ---------------------------------------------------------------------------------------------------------------
function typeOk(v, t) {
  return (Array.isArray(t) ? t : [t]).some((x) =>
    x === "null" ? v === null
      : x === "integer" ? Number.isInteger(v)
      : x === "number" ? typeof v === "number" && Number.isFinite(v)
      : x === "array" ? Array.isArray(v)
      : x === "object" ? v !== null && typeof v === "object" && !Array.isArray(v)
      : typeof v === x);
}

/** Validate `value` against `#/$defs/<def>` of numbers/schema.json (or a schema object). Returns error strings. */
export function validateSchema(value, def, { schema = SCHEMA, path = "$" } = {}) {
  const root = schema;
  const deref = (r) => r.replace(/^#\//, "").split("/").reduce((o, p) => o?.[p], root);
  const check = (v, s, p, errs) => {
    if (!s || typeof s !== "object") return;
    if (s.$ref) {
      const target = deref(s.$ref);
      if (!target) { errs.push(`${p}: schema reference ${s.$ref} not found`); return; }
      check(v, target, p, errs);
    }
    if (s.type && !typeOk(v, s.type)) { errs.push(`${p}: expected ${[].concat(s.type).join(" or ")}, got ${JSON.stringify(v)?.slice(0, 60)}`); return; }
    if (s.enum && !s.enum.some((x) => x === v)) errs.push(`${p}: ${JSON.stringify(v)} is not one of ${s.enum.join(", ")}`);
    if ("const" in s && s.const !== v) errs.push(`${p}: expected ${JSON.stringify(s.const)}`);
    if (typeof v === "string") {
      if (s.pattern && !new RegExp(s.pattern, "u").test(v)) errs.push(`${p}: "${v}" does not match ${s.pattern}`);
      if (s.minLength != null && v.length < s.minLength) errs.push(`${p}: shorter than ${s.minLength}`);
      if (s.maxLength != null && v.length > s.maxLength) errs.push(`${p}: longer than ${s.maxLength}`);
    }
    if (typeof v === "number") {
      if (s.minimum != null && v < s.minimum) errs.push(`${p}: ${v} < ${s.minimum}`);
      if (s.maximum != null && v > s.maximum) errs.push(`${p}: ${v} > ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) errs.push(`${p}: fewer than ${s.minItems} items`);
      if (s.items) v.forEach((x, i) => check(x, s.items, `${p}[${i}]`, errs));
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const keys = Object.keys(v);
      for (const r of s.required ?? []) if (!(r in v)) errs.push(`${p}: missing required "${r}"`);
      if (s.minProperties != null && keys.length < s.minProperties) errs.push(`${p}: fewer than ${s.minProperties} properties`);
      for (const k of keys) {
        if (s.propertyNames) check(k, s.propertyNames, `${p} key "${k}"`, errs);
        if (s.properties && k in s.properties) check(v[k], s.properties[k], `${p}.${k}`, errs);
        else if (s.additionalProperties === false) errs.push(`${p}: unknown property "${k}"`);
        else if (s.additionalProperties && typeof s.additionalProperties === "object") check(v[k], s.additionalProperties, `${p}.${k}`, errs);
      }
    }
    if (s.anyOf) {
      const branches = s.anyOf.map((b) => { const e = []; check(v, b, p, e); return e; });
      if (!branches.some((e) => e.length === 0)) {
        const best = branches.reduce((a, b) => (b.length < a.length ? b : a));
        const short = best.map((e) => (e.startsWith(p) ? e.slice(p.length).replace(/^[:.]\s*/, "") || e : e));
        errs.push(`${p}: matches none of ${branches.length} alternatives; closest: ${short.join("; ")}`);
      }
    }
  };
  const errs = [];
  check(value, typeof def === "string" ? { $ref: `#/$defs/${def}` } : def, path, errs);
  return errs;
}

// ---------------------------------------------------------------------------------------------------------------
// Spec files
// ---------------------------------------------------------------------------------------------------------------
/** Spec files in a directory, sorted; files starting with "_" are examples and are skipped unless asked for. */
export function listSpecFiles(dir = DEFAULTS.specDir, { includeExamples = false } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && (includeExamples || !f.startsWith("_")))
    .sort()
    .map((f) => join(dir, f));
}

/** Expand --spec arguments (files or directories; a named directory includes its examples only if asked). */
export function resolveSpecPaths(args) {
  const out = [];
  for (const a of args) {
    const p = resolve(a);
    if (!existsSync(p)) throw new Error(`spec path not found: ${a}`);
    if (statSync(p).isDirectory()) out.push(...listSpecFiles(p));
    else out.push(p);
  }
  return out;
}

/** Read and schema-check spec files. Returns { specs: [{ file, owner, spec }], errors }. */
export function loadSpecs(paths) {
  const specs = [];
  const errors = [];
  for (const file of paths) {
    const owner = rel(file);
    let spec;
    try { spec = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { errors.push(`${owner}: not valid JSON (${e.message})`); continue; }
    const errs = validateSchema(spec, "spec", { path: owner });
    if (errs.length) { errors.push(...errs); continue; }
    specs.push({ file, owner, spec });
  }
  return { specs, errors };
}

// ---------------------------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------------------------
const isRef = (o, k) => o !== null && typeof o === "object" && !Array.isArray(o) && k in o;

/** Follow a dot path ("a.b.0.c"); numeric segments index arrays. Throws with the available keys on a miss. */
export function getPath(value, path, what = "value") {
  if (path == null || path === "") return value;
  let cur = value;
  const seen = [];
  for (const seg of String(path).split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") {
      throw new Error(`${what}: path "${path}" stops at "${seen.join(".") || "(root)"}" (not an object)`);
    }
    if (!(seg in cur)) {
      const keys = ArrayBuffer.isView(cur) || Array.isArray(cur) ? `length ${cur.length}` : `keys ${Object.keys(cur).slice(0, 12).join(", ")}`;
      throw new Error(`${what}: no "${seg}" at "${seen.join(".") || "(root)"}" (${keys})`);
    }
    cur = cur[seg];
    seen.push(seg);
  }
  return cur;
}

/** JSON-safe copy of an engine value: typed arrays to arrays, safe BigInts to numbers, NaN/Infinity to null. */
export function toPlain(v, what = "value") {
  if (typeof v === "bigint") {
    if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= -BigInt(Number.MAX_SAFE_INTEGER)) return Number(v);
    return v.toString();
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === undefined) return null;
  if (v === null || typeof v === "string" || typeof v === "boolean") return v;
  if (ArrayBuffer.isView(v)) return Array.from(v, (x) => toPlain(x, what));
  if (Array.isArray(v)) return v.map((x) => toPlain(x, what));
  if (typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toPlain(v[k], what);
    return o;
  }
  throw new Error(`${what}: cannot store a ${typeof v}`);
}

/** Leaves of a (nested) array, in order. */
export function flatten(v) {
  return Array.isArray(v) ? v.flatMap(flatten) : [v];
}

/** Why `value` does not fit `type`, or null. */
export function typeProblem(type, value) {
  switch (type) {
    case "scalar":
    case "fraction":
      return typeof value === "number" && Number.isFinite(value) ? null : `expected a finite number, got ${JSON.stringify(value)}`;
    case "vector": {
      if (!Array.isArray(value)) return `expected an array, got ${JSON.stringify(value)?.slice(0, 60)}`;
      const bad = flatten(value).find((x) => !(x === null || (typeof x === "number" && Number.isFinite(x))));
      return bad === undefined ? null : `vector element ${JSON.stringify(bad)} is not a number or null`;
    }
    case "text":
      return typeof value === "string" ? null : `expected a string, got ${JSON.stringify(value)?.slice(0, 60)}`;
    case "na":
      return value === null ? null : `expected null (NA), got ${JSON.stringify(value)?.slice(0, 60)}`;
    case "set":
      return Array.isArray(value) ? null : `expected an array (set), got ${JSON.stringify(value)?.slice(0, 60)}`;
    default:
      return `unknown type ${JSON.stringify(type)} (one of ${TYPES.join(", ")})`;
  }
}

function tolOne(t, i) {
  if (Array.isArray(t)) return t[i];
  return t;
}
function within(a, b, t) {
  if (a === null || b === null) return a === b;
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  const abs = typeof t === "number" ? t : t?.abs ?? 0;
  const relTol = typeof t === "object" && t ? t.rel ?? 0 : 0;
  return Math.abs(a - b) <= abs + relTol * Math.abs(b);
}

/**
 * Compare a stored value with a recomputed one under a tolerance. Returns null when they agree, otherwise a short
 * reason. Vectors compare element-wise (per-element tolerance), sets ignore order, text and na compare exactly.
 */
export function compareValues(type, stored, fresh, tolerance = 0) {
  if (type === "text" || type === "na") return stored === fresh ? null : `${JSON.stringify(stored)} != ${JSON.stringify(fresh)}`;
  if (type === "scalar" || type === "fraction") {
    return within(stored, fresh, tolOne(tolerance, 0)) ? null : `${stored} vs recomputed ${fresh} (|diff| ${Math.abs(stored - fresh)})`;
  }
  if (type === "vector") {
    const shape = (v) => JSON.stringify(v, (k, x) => (Array.isArray(x) ? x : 0));
    if (shape(stored) !== shape(fresh)) return `shape differs: ${JSON.stringify(stored)?.slice(0, 80)} vs ${JSON.stringify(fresh)?.slice(0, 80)}`;
    const a = flatten(stored), b = flatten(fresh);
    for (let i = 0; i < a.length; i++) {
      if (!within(a[i], b[i], tolOne(tolerance, i))) return `element ${i}: ${a[i]} vs recomputed ${b[i]}`;
    }
    return null;
  }
  if (type === "set") {
    if (!Array.isArray(stored) || !Array.isArray(fresh) || stored.length !== fresh.length) return `set size ${stored?.length} vs ${fresh?.length}`;
    const used = new Array(fresh.length).fill(false);
    for (const s of stored) {
      const j = fresh.findIndex((f, k) => !used[k] && compareValues(Array.isArray(s) ? "vector" : typeof s === "number" ? "scalar" : "text", s, f, tolerance) === null);
      if (j < 0) return `set member ${JSON.stringify(s)} not in the recomputed set ${JSON.stringify(fresh).slice(0, 80)}`;
      used[j] = true;
    }
    return null;
  }
  return `unknown type ${type}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Engine and formatting
// ---------------------------------------------------------------------------------------------------------------
/** Import the engine ES module. */
export async function loadEngine(file = DEFAULTS.engine) {
  return import(pathToFileURL(file).href);
}

function engineFn(engine, name, { formatter }) {
  const f = engine[name];
  if (typeof f !== "function") throw new Error(`"${name}" is not a function exported by the engine`);
  const isFormat = name.startsWith("format");
  if (formatter && !isFormat) throw new Error(`"${name}" is not an engine formatter (format*)`);
  if (!formatter && isFormat) throw new Error(`"${name}" is a formatter; use it under "format", not as fn`);
  return f;
}

/**
 * A format with a named format (js/widgets/format.js NAMED_FORMATS: formatShare, formatExpectedCount) replaced by
 * the engine formatter and options it stands for; an engine export of the same name wins. A named format takes no
 * options of its own (its options are the point of the name).
 */
export function expandFormat(engine, fmt) {
  if (!fmt || typeof fmt !== "object") return fmt;
  let out = fmt;
  const named = Object.prototype.hasOwnProperty.call(NAMED_FORMATS, fmt.fn) && typeof engine?.[fmt.fn] !== "function" ? NAMED_FORMATS[fmt.fn] : null;
  if (named) {
    if (fmt.options) throw new Error(`format ${fmt.fn}: a named format takes no options (it is ${named.fn} with ${JSON.stringify(named.options)})`);
    out = { ...fmt, fn: named.fn, options: { ...named.options } };
  }
  if (out.item) out = { ...out, item: expandFormat(engine, out.item) };
  return out;
}

/** Format a value with an engine formatter described by { fn, options, item, spread }. Returns a string. */
export function formatWith(engine, format, value) {
  const fmt = expandFormat(engine, format);
  const f = engineFn(engine, fmt.fn, { formatter: true });
  if (fmt.item && fmt.options) throw new Error(`format ${fmt.fn}: give options or item, not both`);
  let args;
  if (fmt.spread) {
    if (!Array.isArray(value)) throw new Error(`format ${fmt.fn}: spread needs an array value`);
    args = [...value];
  } else args = [value];
  if (fmt.item) {
    const g = engineFn(engine, fmt.item.fn, { formatter: true });
    const o = fmt.item.options;
    args.push(o ? (v) => g(v, o) : (v) => g(v));
  } else if (fmt.options) args.push(fmt.options);
  const s = f(...args);
  if (typeof s !== "string") throw new Error(`format ${fmt.fn} returned ${Array.isArray(s) ? "an array" : typeof s}, not a string (use formatTuple for several values)`);
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// Released data ($data)
// ---------------------------------------------------------------------------------------------------------------
/**
 * A reader for $data keys. A key is a released key of data/released/data_contract.json (its "files" and
 * "precomputed" entries, matched by "key"); without a contract entry it falls back to data/released/<key>.json,
 * then data/precomputed/<key>.json. Returns { value, file, sha256, license_scope } (scope null when unknown).
 */
export function fileDataReader(dataRoot = DEFAULTS.dataRoot) {
  const cache = new Map();
  let index = null;
  const contractIndex = () => {
    if (index) return index;
    index = new Map();
    const cp = join(dataRoot, "released", "data_contract.json");
    if (existsSync(cp)) {
      const c = JSON.parse(readFileSync(cp, "utf8"));
      for (const group of [c.files ?? {}, c.precomputed ?? {}]) {
        for (const e of Object.values(group)) {
          if (e && typeof e.key === "string" && typeof e.path === "string") {
            index.set(e.key, { file: join(dataRoot, e.path.replace(/^data\//, "")), license_scope: e.license_scope ?? null });
          }
        }
      }
    }
    return index;
  };
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const listed = contractIndex().get(key);
    const candidates = listed ? [listed.file] : [join(dataRoot, "released", `${key}.json`), join(dataRoot, "precomputed", `${key}.json`)];
    const file = candidates.find((p) => existsSync(p));
    if (!file) throw new Error(`$data "${key}": no ${candidates.map(rel).join(" or ")}${listed ? " (listed in data_contract.json)" : ""}`);
    const bytes = readFileSync(file);
    const hit = {
      value: JSON.parse(bytes.toString("utf8")),
      file: rel(file),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      license_scope: listed?.license_scope ?? null,
    };
    cache.set(key, hit);
    return hit;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Computing the registry
// ---------------------------------------------------------------------------------------------------------------
function keyProblems(key) {
  const out = [];
  if (!KEY_RE.test(key)) out.push(`key "${key}" does not match ${KEY_RE}`);
  else if (key.split(".").some((s) => s === "")) out.push(`key "${key}" has an empty dotted segment`);
  return out;
}

/**
 * Keys that hold the same quantity must display alike (N2-06). A spec key with "same_as": "<other key>" names a key
 * of the specs or of the case file (data/numbers-cases.json); the two display strings must be identical. `links` is
 * [{ key, other, owner }]; `entries` the computed spec entries; `cases` the case file (key -> entry). Returns errors.
 */
export function sameAsProblems(links, entries, cases = {}) {
  const errors = [];
  for (const { key, other, owner } of links) {
    const where = `${owner}: ${key}: same_as "${other}"`;
    if (other === key) { errors.push(`${where}: a key cannot be the same as itself`); continue; }
    const a = entries[key];
    if (!a) continue; // the key itself failed; its own error is reported
    const b = entries[other] ?? cases?.[other];
    if (!b) { errors.push(`${where}: no such key in the specs or ${CASES_FILE}`); continue; }
    if (a.display !== b.display) errors.push(`${where}: displays differ (${JSON.stringify(a.display)} here, ${JSON.stringify(b.display)} there)`);
  }
  return errors;
}

/**
 * Compute every key of the given specs. `engine` is the imported engine module (or a stand-in with the same exports).
 * `cases` (key -> entry) is the case file that "same_as" may name; by default data/numbers-cases.json, read only when
 * a same_as names a key outside the specs.
 * Returns { entries: { key: entry } (code-point order), errors: string[] }. A key with an error is left out.
 */
export function computeEntries(specs, { engine, readData = fileDataReader(), cases } = {}) {
  const { entries, errors } = computeSpecEntries(specs, { engine, readData });
  const links = [];
  for (const { owner, spec } of specs) {
    for (const [key, def] of Object.entries(spec.keys ?? {})) {
      if (def && typeof def === "object" && "same_as" in def) links.push({ key, other: def.same_as, owner });
    }
  }
  if (links.length) {
    const needCases = links.some((l) => !(l.other in entries));
    const caseMap = cases ?? (needCases ? readNumbersFile(join(DEFAULTS.out, CASES_FILE)) ?? {} : {});
    errors.push(...sameAsProblems(links, entries, caseMap));
  }
  return { entries, errors };
}

function computeSpecEntries(specs, { engine, readData }) {
  const errors = [];
  const entries = {};
  // Pass 1: every key once across all files; settings are global (a Part spec uses settings.json).
  const owners = new Map();
  const settings = new Map();
  for (const { owner, spec } of specs) {
    for (const [key, def] of Object.entries(spec.keys)) {
      for (const p of keyProblems(key)) errors.push(`${owner}: ${p}`);
      if (owners.has(key)) { errors.push(`${owner}: key "${key}" is already defined in ${owners.get(key)}`); continue; }
      owners.set(key, owner);
      const isSetting = "setting" in def;
      if (isSettingKey(key) !== isSetting) {
        errors.push(`${owner}: ${key}: ${isSetting ? "a setting value needs a settings.* key" : "a settings.* key must be a literal setting (with \"setting\" and \"value\")"}`);
        continue;
      }
      if (isSetting) settings.set(key, { owner, spec, def });
    }
  }

  // Settings entries.
  for (const [key, { owner, spec, def }] of settings) {
    try {
      const problem = typeProblem(def.type, def.value);
      if (problem) throw new Error(problem);
      const display = def.format ? formatWith(engine, def.format, def.value)
        : def.type === "text" ? def.value : formatWith(engine, { fn: "formatSetting" }, def.value);
      entries[key] = {
        type: def.type,
        value: def.value,
        display,
        ...(def.type === "text" ? {} : { tolerance: 0 }),
        settings: {},
        source: { setting: def.setting },
        license_scope: def.license_scope ?? spec.license_scope,
        owner,
      };
    } catch (e) { errors.push(`${owner}: ${key}: ${e.message}`); }
  }

  // Engine keys, spec by spec (inputs are local to their spec).
  for (const { owner, spec } of specs) {
    const inputs = spec.inputs ?? {};
    const memo = new Map();   // input name -> { value, usage }
    const calls = new Map();  // fn|args JSON -> { value, usage }
    const active = new Set();

    const newUsage = () => ({ settings: new Map(), data: new Map(), inputs: new Set() });
    const merge = (into, from) => {
      for (const [k, v] of from.settings) into.settings.set(k, v);
      for (const [k, v] of from.data) into.data.set(k, v);
      for (const k of from.inputs) into.inputs.add(k);
    };

    const resolveArgs = (node, usage, where) => {
      if (Array.isArray(node)) return node.map((x) => resolveArgs(x, usage, where));
      if (node === null || typeof node !== "object") return node;
      if (isRef(node, "$setting")) {
        if (Object.keys(node).length !== 1) throw new Error(`${where}: {"$setting"} takes no other keys`);
        const sk = node.$setting;
        const s = settings.get(sk);
        if (!s) throw new Error(`${where}: unknown setting "${sk}"`);
        usage.settings.set(sk, s.def.setting);
        return s.def.value;
      }
      if (isRef(node, "$input")) {
        const extra = Object.keys(node).filter((k) => k !== "$input" && k !== "path");
        if (extra.length) throw new Error(`${where}: {"$input"} takes only "path" (got ${extra.join(", ")})`);
        const hit = evalInput(node.$input, where);
        merge(usage, hit.usage);
        usage.inputs.add(node.$input);
        return getPath(hit.value, node.path, `${where}: $input ${node.$input}`);
      }
      if (isRef(node, "$data")) {
        const extra = Object.keys(node).filter((k) => k !== "$data" && k !== "path");
        if (extra.length) throw new Error(`${where}: {"$data"} takes only "path" (got ${extra.join(", ")})`);
        const hit = readData(node.$data);
        usage.data.set(node.$data, { key: node.$data, file: hit.file, sha256: hit.sha256, license_scope: hit.license_scope ?? null });
        return getPath(hit.value, node.path, `${where}: $data ${node.$data}`);
      }
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (SETTING_OPTIONS.includes(k) && !isRef(v, "$setting")) {
          throw new Error(`${where}: option "${k}" must be {"$setting": "settings.<name>"} (a literal ${JSON.stringify(v)} would bypass the settings registry)`);
        }
        out[k] = resolveArgs(v, usage, where);
      }
      return out;
    };

    const call = (fn, rawArgs, where) => {
      const id = `${fn}|${JSON.stringify(rawArgs)}`;
      if (calls.has(id)) return calls.get(id);
      const usage = newUsage();
      const args = resolveArgs(rawArgs, usage, where);
      const f = engineFn(engine, fn, { formatter: false });
      let value;
      try { value = f(...args); }
      catch (e) { throw new Error(`${where}: ${fn} threw: ${e.message}`); }
      const hit = { value, usage };
      calls.set(id, hit);
      return hit;
    };

    const evalInput = (name, where) => {
      if (memo.has(name)) return memo.get(name);
      const def = inputs[name];
      if (!def) throw new Error(`${where}: unknown input "${name}" (inputs: ${Object.keys(inputs).join(", ") || "none"})`);
      if (active.has(name)) throw new Error(`${where}: input "${name}" refers to itself`);
      active.add(name);
      try {
        let hit;
        if ("$data" in def) {
          const usage = newUsage();
          const value = resolveArgs({ $data: def.$data, ...(def.path ? { path: def.path } : {}) }, usage, `input ${name}`);
          hit = { value, usage };
        } else {
          const c = call(def.fn, def.args, `input ${name}`);
          hit = { value: getPath(c.value, def.field, `input ${name}`), usage: c.usage };
        }
        memo.set(name, hit);
        return hit;
      } finally { active.delete(name); }
    };

    for (const [key, def] of Object.entries(spec.keys)) {
      if ("setting" in def || owners.get(key) !== owner) continue;
      const where = `${owner}: ${key}`;
      try {
        if (("fn" in def || "args" in def) && "from" in def) throw new Error(`give fn + args or from, not both`);
        if (!("from" in def) && !("fn" in def && "args" in def)) throw new Error(`needs fn + args or from`);
        if (def.type !== "text" && !def.format) throw new Error(`format is required for type ${def.type}`);
        if (NUMERIC_TYPES.has(def.type) && def.tolerance === undefined) throw new Error(`tolerance is required for type ${def.type}`);
        let result, usage, srcFn, srcArgs;
        if ("from" in def) {
          const inp = inputs[def.from];
          if (!inp) throw new Error(`from: unknown input "${def.from}"`);
          if (!("fn" in inp)) throw new Error(`from: input "${def.from}" is not an engine call`);
          if (inp.field) throw new Error(`from: input "${def.from}" has a field; use $input with a path instead`);
          const hit = evalInput(def.from, where);
          result = hit.value;
          usage = newUsage();
          merge(usage, hit.usage);
          srcFn = inp.fn;
          srcArgs = inp.args;
        } else {
          const hit = call(def.fn, def.args, where);
          result = hit.value;
          usage = hit.usage;
          srcFn = def.fn;
          srcArgs = def.args;
        }
        const raw = getPath(result, def.field, where);
        const value = toPlain(raw, where);
        const problem = typeProblem(def.type, value);
        if (problem) throw new Error(`field ${def.field ?? "(whole result)"}: ${problem}`);
        if (Array.isArray(def.tolerance)) {
          if (def.type === "set") throw new Error(`a set takes one tolerance for every member (a number or {abs, rel}), not an array`);
          const n = flatten(value).length;
          if (def.tolerance.length !== n) throw new Error(`tolerance has ${def.tolerance.length} elements, the value has ${n}`);
        }
        const display = def.format ? formatWith(engine, def.format, raw) : value;
        if (typeof display !== "string") throw new Error(`display is not a string`);

        // Settings: derived from $setting references, or declared (then every reference must be listed).
        const used = [...usage.settings.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        let keySettings;
        if (def.settings) {
          for (const [name, v] of Object.entries(def.settings)) {
            if (typeof v === "string" && v.startsWith(SETTINGS_PREFIX) && !settings.has(v)) throw new Error(`settings.${name}: unknown setting "${v}"`);
          }
          const listed = new Set(Object.values(def.settings));
          const missing = used.filter(([k]) => !listed.has(k)).map(([k]) => k);
          if (missing.length) throw new Error(`settings does not list ${missing.join(", ")} (used in args)`);
          keySettings = sortObject(def.settings);
        } else {
          keySettings = {};
          for (const [k, name] of used) {
            if (name in keySettings && keySettings[name] !== k) {
              throw new Error(`two "${name}" settings (${keySettings[name]}, ${k}); declare "settings" explicitly`);
            }
            keySettings[name] = k;
          }
          keySettings = sortObject(keySettings);
        }

        // Data imply a licence scope (CONTRACT 10.2): a value computed from non-author data carries that scope.
        const scope = def.license_scope ?? spec.license_scope;
        const dataScopes = [...new Set([...usage.data.values()].map((d) => d.license_scope).filter((x) => x && x !== "author"))];
        if (dataScopes.length > 1) throw new Error(`uses data under several licence scopes (${dataScopes.join(", ")})`);
        if (dataScopes.length && dataScopes[0] !== scope) throw new Error(`license_scope is ${scope}, but it is computed from ${dataScopes[0]} data`);

        const usedInputs = [...usage.inputs].filter((n) => n !== def.from).sort();
        const source = { fn: srcFn, args: srcArgs, field: def.field ?? null };
        if (usedInputs.length) source.inputs = Object.fromEntries(usedInputs.map((n) => [n, inputs[n]]));
        if (usage.data.size) {
          source.data = [...usage.data.values()].map(({ key: k, file, sha256 }) => ({ key: k, file, sha256 }))
            .sort((a, b) => (a.key < b.key ? -1 : 1));
        }
        entries[key] = {
          type: def.type,
          value,
          display,
          ...(def.tolerance !== undefined ? { tolerance: def.tolerance } : {}),
          settings: keySettings,
          source,
          license_scope: scope,
          owner,
        };
      } catch (e) {
        errors.push(e.message.startsWith(where) ? e.message : `${where}: ${e.message}`);
      }
    }
  }
  return { entries: sortObject(entries), errors };
}

function sortObject(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

/** Serialize a key -> entry map: code-point key order, one entry per line (stable diffs), trailing newline. */
export function serializeNumbers(entries) {
  const keys = Object.keys(entries).sort();
  if (!keys.length) return "{}\n";
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k])}`).join(",\n")}\n}\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// Presets (catalog fragments) and the shortcode registry
// ---------------------------------------------------------------------------------------------------------------
const SYMBOL_WORDS = [[/\bomega_2\b/g, "ω₂"], [/\bomega\b/g, "ω"], [/\btau\b/g, "τ"], [/\blambda\b/g, "λ"]];
const KEEP_CASE = new Set(["Deeper", "Alabama", "California", "Kline", "Walters", "Rose"]);
// A setting name is one or two words ("τ", "prior SD", "direction probability") that does not end in a function word.
const NAME = "[A-Za-zτλω₂]+(?: [A-Za-zτλω₂]+)?";
const NOT_A_NAME_END = new Set(["of", "at", "by", "to", "in", "on", "with", "for", "from", "the", "a", "an", "and", "or"]);
const NUM = "−?(?:\\d{1,3}(?:,\\d{3})+|\\d+)?(?:\\.\\d+)?(?:/\\d+)?";
const NAME_VALUE = new RegExp(`^(${NAME}) (${NUM})( \\([^()]*\\))?$`, "u");
const NAME_EQ = new RegExp(`^(${NAME}) = (${NUM}|\\([^()]*\\))$`, "u");

function splitTop(label) {
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    if (c === "(") depth++;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "," && label[i + 1] === " " && depth === 0) { parts.push(cur); cur = ""; i++; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
function lowerFirst(s) {
  const word = s.split(/[\s,:]/)[0];
  if (/^[A-Z][a-z]+(?:-[a-z]+)*$/u.test(word) && !KEEP_CASE.has(word)) return s[0].toLowerCase() + s.slice(1);
  return s;
}
function nameValue(part) {
  const ok = (name) => !NOT_A_NAME_END.has(name.split(" ").pop().toLowerCase());
  let m = NAME_VALUE.exec(part);
  if (m && /\d/.test(m[2]) && ok(m[1])) return `${lowerFirst(m[1])} to ${m[2]}${m[3] ?? ""}`;
  m = NAME_EQ.exec(part);
  if (m && /\d/.test(m[2]) && ok(m[1])) return `${lowerFirst(m[1])} to ${m[2]}`;
  return null;
}

/**
 * The "What to try" sentence for a catalog preset label: tau, lambda and omega become τ, λ and ω; a label that
 * starts with "<name> <value>" reads "Set <name> to <value>, ..." and any other label reads "Set the widget to
 * <label>.".
 */
export function presetSentence(label) {
  let s = String(label).trim();
  for (const [re, sym] of SYMBOL_WORDS) s = s.replace(re, sym);
  const parts = splitTop(s);
  let body;
  if (nameValue(parts[0])) body = `Set ${parts.map((p) => nameValue(p) ?? p).join(", ")}`;
  else body = `Set the widget to ${lowerFirst(s)}`;
  return /[.?!]$/.test(body) ? body : `${body}.`;
}

/** Read catalog fragments: { id: { embed, page, presets: [...] } }. */
export function loadCatalogPresets(dir = DEFAULTS.catalog) {
  const out = {};
  const errors = [];
  if (!existsSync(dir)) return { presets: out, errors: [`catalog directory not found: ${rel(dir)}`] };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    let e;
    try { e = JSON.parse(readFileSync(join(dir, f), "utf8")); }
    catch (err) { errors.push(`${f}: not valid JSON (${err.message})`); continue; }
    out[e.id] = { embed: e.embed ?? null, page: e.page ?? null, presets: e.presets ?? [] };
  }
  return { presets: out, errors };
}

/** The data the Lua shortcodes read: merged display strings and the presets with their sentences and links. */
export function buildShortcodeRegistry(numbers, cases, catalog) {
  const reg = createRegistry(numbers, cases);   // throws on duplicate keys across the two files
  const nums = {};
  for (const k of reg.keys()) {
    const e = reg.get(k);
    nums[k] = { display: e.display, type: e.type };
  }
  const presets = {};
  const errors = [];
  for (const id of Object.keys(catalog).sort()) {
    const c = catalog[id];
    if (!c.presets.length) continue;
    const target = c.embed ?? c.page;
    if (!target) { errors.push(`${id}: presets but neither embed nor page`); continue; }
    const items = {};
    for (const p of c.presets) {
      if (p.id in items) { errors.push(`${id}: preset id "${p.id}" appears twice`); continue; }
      // the standalone page opened from a lesson skips the prediction the lesson already asked
      items[p.id] = { label: p.label, query: p.query, sentence: presetSentence(p.label), href: `${target}${p.query}${p.query ? "&" : "?"}predict=off` };
    }
    presets[id] = { target, items: sortObject(items) };
  }
  if (errors.length) throw new Error(`catalog presets:\n  ${errors.join("\n  ")}`);
  return { format: REGISTRY_FORMAT, numbers: nums, presets };
}

export function serializeShortcodeRegistry(reg) {
  return `${JSON.stringify(reg, null, 1)}\n`;
}

/** The registry twin data/numbers.js: both files merged, code-point key order, one entry per line. */
export function serializeNumbersTwin(numbers, cases) {
  const reg = createRegistry(numbers, cases);   // throws on duplicate keys across the two files
  const lines = reg.keys().map((k) => {
    const e = reg.get(k);
    return `  ${JSON.stringify(k)}: ${JSON.stringify({ type: e.type, value: e.value, display: e.display })}`;
  });
  const body = lines.length ? `{\n${lines.join(",\n")}\n}` : "{}";
  return `window.PRX_DATA = window.PRX_DATA || {};\nwindow.PRX_DATA.numbers = ${body};\n`;
}

/** Read a numbers file (missing -> {}); throws on bad JSON. */
export function readNumbersFile(p) {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { spec: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => { if (i + 1 >= argv.length) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === "--spec") o.spec.push(take());
    else if (a === "--out") o.out = resolve(take());
    else if (a === "--registry") o.registry = resolve(take());
    else if (a === "--catalog") o.catalog = resolve(take());
    else if (a === "--data-root") o.dataRoot = resolve(take());
    else if (a === "--engine") o.engine = resolve(take());
    else if (a === "--quiet") o.quiet = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

async function main(argv) {
  const opt = { ...DEFAULTS, ...parseArgs(argv) };
  const specPaths = opt.spec.length ? resolveSpecPaths(opt.spec) : listSpecFiles(opt.specDir);
  const { specs, errors: specErrors } = loadSpecs(specPaths);
  const engine = await loadEngine(opt.engine);
  const casesPath = join(opt.out, CASES_FILE);
  const cases = readNumbersFile(casesPath) ?? {};
  const { entries, errors } = computeEntries(specs, { engine, readData: fileDataReader(opt.dataRoot), cases });
  const all = [...specErrors, ...errors];
  for (const [k, e] of Object.entries(entries)) for (const m of validateSchema(e, "entry", { path: k })) all.push(m);
  if (all.length) {
    console.error(`build_numbers: ${all.length} problem(s); nothing written:\n  ${all.join("\n  ")}`);
    process.exit(1);
  }
  for (const m of validateSchema(cases, "numbersFile", { path: rel(casesPath) })) all.push(m);
  const { presets, errors: catErrors } = loadCatalogPresets(opt.catalog);
  all.push(...catErrors);
  let shortcodes, twin;
  try { shortcodes = buildShortcodeRegistry(entries, cases, presets); twin = serializeNumbersTwin(entries, cases); }
  catch (e) { all.push(e.message); }
  if (all.length) {
    console.error(`build_numbers: ${all.length} problem(s); nothing written:\n  ${all.join("\n  ")}`);
    process.exit(1);
  }
  mkdirSync(opt.out, { recursive: true });
  mkdirSync(dirname(opt.registry), { recursive: true });
  writeFileSync(join(opt.out, NUMBERS_FILE), serializeNumbers(entries));
  writeFileSync(opt.registry, serializeShortcodeRegistry(shortcodes));
  writeFileSync(join(opt.out, NUMBERS_TWIN_FILE), twin);
  if (!opt.quiet) {
    const n = Object.keys(entries).length;
    const s = Object.keys(entries).filter(isSettingKey).length;
    console.log(`build_numbers: ${specs.length} spec file(s), ${n} keys (${s} settings), ${Object.keys(cases).length} case keys, `
      + `${Object.values(shortcodes.presets).reduce((a, p) => a + Object.keys(p.items).length, 0)} presets -> `
      + `${rel(join(opt.out, NUMBERS_FILE))}, ${rel(opt.registry)}, ${rel(join(opt.out, NUMBERS_TWIN_FILE))}`);
  }
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  main(process.argv.slice(2)).catch((e) => { console.error(`build_numbers: ${e.message}`); process.exit(1); });
}
