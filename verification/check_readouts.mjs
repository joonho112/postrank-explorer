#!/usr/bin/env node
// Read-out check: every number a reader sees in an app is matched to a source that is not the app's own code, so a
// port that changes a number fails. (From postrank Explorer v1, verification/check_readouts.mjs, whose case files
// the v1 ports bring along; v1's prediction gate is gone, and v1's numbers registry is frozen in
// verification/v1-registry/ as a source of expected values only.)
//
// For each case file verification/readouts/<app>.json (schema: verification/readouts/_schema.json) the app module
// js/apps/<app>.js is mounted in jsdom once per case (verification/widget_harness.mjs), at the case's preset (by its
// v3 id in catalog.json, reached as a reader reaches it: ?preset=<id>, applied by base.js) or its raw query
// (window.__PRX_QUERY); the case's updates are run and the app is settled (aria-busy included). Then:
//   (a) display   an expected element's text equals format(raw) with the formatter of its kind (the expectation's
//                 format, else the registry key's own one, and then also the registry's display string)
//   (b) raw       its data-num equals the expected value within tol; the expected value comes from a golden row of
//                 postrank 1.1.0 or of the base-R oracle (verification/golden/), or from v1's frozen numbers registry
//                 (verification/v1-registry/), never from the app's own code
//   (c) coverage  every number visible in read-outs, tables and figure labels carries data-num (dom_rules.mjs
//                 numberFindings; its structural exceptions are listed there, and v3 adds one: the catalog caption
//                 line base.js writes, authored text), and every data-num element's text reads back as its raw value
//                 (displayFindings)
//   (d) tokens    no NaN, undefined, Infinity or [object …] in the app's text or attributes
//   (e) predict   a case may not script a prediction: v3 apps have no prediction gate, so a case with predict, or a
//                 query that sets predict, is an error (a port drops such a case)
//   plus: every figure has a text alternative; a literal string names a row of v1's contract
//   (verification/v1-registry/contract-rows.json), and a 6.2 literal is a result label and a 6.5 literal a caption of
//   js/shared/labels.js in its v3 wording (a literal with "slots": true is compared with each data-num element of the
//   text written as a slot ⟨name⟩, and writes no digit outside its slots), and no literal quotes v1's wording of a
//   label or caption that v3 rewords; every `value` written in the case file agrees with its source (a stale case
//   file fails); a selector matches exactly one element (or has index); and, new in v3:
//     query     every key a case's query, preset, spec or updates name is a key of the app, and every query value is
//               one the app takes (a key renamed in a port, or a value it cannot read, is reported, not ignored)
//     app       the app's createWidget name is its catalog name (base.js takes presets and caption from that entry)
//     preset    at ?preset=<id> the preset row shows the preset pressed: base.js applied it
//     math      an app that renders formulas has "math": true in its catalog entry (else readers see the TeX)
//     source    the app's modules import none of this check's expected-value sources (verification/golden,
//               v1-registry, parity.d), so no number is compared with itself
//     registry  the frozen registry still matches its MANIFEST.json, whose own SHA-256 is pinned below
//
//   node verification/check_readouts.mjs                     every case file (verification/readouts/*.json, not _*)
//   node verification/check_readouts.mjs --only <name>       the case file of one app (none yet = pass)
//   node verification/check_readouts.mjs <file> ...          these case files
//   node verification/check_readouts.mjs --changed <list>    the case files the changed paths touch (<list>: a file
//                                                            with one project-relative path per line); none = pass
//   node verification/check_readouts.mjs --self-test         planted faults must all be caught, clean cases must pass
//   options: --quiet (the summary and the findings only); --verbose with --self-test (the finding that caught each
//            planted fault)
// Changed path -> case files: verification/readouts/<a>.json itself; catalog/entries/<id>-<a>.json the file of app
// <a>; a module the files' apps import (js/apps/<a>.js, or another app's exported helpers) the files of those apps;
// a fixture directory the files whose module is in it; shared inputs (js/shared/, the engine, js/vendor/, data/,
// catalog.json, catalog/site.json, the styles, verification/golden/, parity.d/ and v1-registry/, the schema, this
// check and its helpers) every file.
// Exit 0 clean, 1 on any finding or a failed self-test, 2 on a bad argument. Importing this module runs nothing.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { badTokenFindings, displayFindings, numberFindings, parseDataNum, textAlternativeFindings } from "./dom_rules.mjs";
import { appKeyProblems, caseQuery, entryByName, entryFor, importClosure, loadCatalog, mountCase, ROOT } from "./widget_harness.mjs";

export const CONFIG = Object.freeze({
  dir: "verification/readouts",
  schema: "verification/readouts/_schema.json",
  golden: "verification/golden",
  parity: "verification/parity.d",
  registry: "verification/v1-registry",
  manifest: "MANIFEST.json",
  // the SHA-256 of MANIFEST.json itself, so a frozen value cannot be edited together with its listed hash
  manifestSha256: "931ffaad631dd74a75be9fb0018cf36b0bd9f27993c7ba1f78633ee04367d813",
  // files of verification/v1-registry/ that MANIFEST.json does not list (dotfiles such as .DS_Store are skipped too)
  unlisted: Object.freeze(["README.txt", "MANIFEST.json"]),
  // the check's expected-value sources: an app that imports from them would be compared with itself (rule source)
  expectedSources: /^verification\/(?:golden|v1-registry|parity\.d)\//,
  labels: "js/shared/labels.js",
  formats: "js/shared/format.js",
  base: "js/shared/base.js",
  engine: "js/pr-core.js",
  apps: "js/apps",
  fixture: "verification/fixtures/readout-app/readout-app.json",
  // a slot in a slotted literal; on screen each slot is one data-num element
  slotMark: "⟨⟩",
  // literal rows whose strings come from js/shared/labels.js: result labels and captions
  labelRow: "6.2",
  captionRow: "6.5",
  sharedPaths: Object.freeze([/^js\/shared\//, /^js\/pr-core/, /^js\/vendor\//, /^data\//, /^catalog\.json$/,
    /^catalog\/site\.json$/, /^styles\/(?:tokens|app|temml)\.css$/, /^verification\/(?:golden|parity\.d|v1-registry)\//,
    /^verification\/readouts\/_/, /^verification\/(?:check_readouts|dom_rules|widget_harness|dom-env)\.mjs$/]),
});

const posix = (p) => p.split("\\").join("/");
// project-relative for files inside the project, absolute otherwise
const rel = (p) => { const r = relative(ROOT, p); return r.startsWith("..") ? p : posix(r); };
const SLOT = /⟨[^⟩]*⟩/g;
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const href = (p) => pathToFileURL(join(ROOT, p)).href;
const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------------------------- values
// (From v1's scripts/build_numbers.mjs, frozen in verification/v1-registry/: the schema validator, dot paths, value
// comparison and engine formatting the read-out check used there.)

function typeOk(v, t) {
  return (Array.isArray(t) ? t : [t]).some((x) =>
    x === "null" ? v === null
      : x === "integer" ? Number.isInteger(v)
      : x === "number" ? typeof v === "number" && Number.isFinite(v)
      : x === "array" ? Array.isArray(v)
      : x === "object" ? v !== null && typeof v === "object" && !Array.isArray(v)
      : typeof v === x);
}

/** Validate a value against a JSON schema (the keywords the case schema uses). Returns error strings. */
export function validateSchema(value, def, { schema, path = "$" } = {}) {
  const root = schema ?? def;
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
      for (const r of s.required ?? []) if (!(r in v)) errs.push(`${p}: missing required "${r}"`);
      for (const k of Object.keys(v)) {
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
  check(value, def, path, errs);
  return errs;
}

/** Follow a dot path ("a.b.0.c"); numeric segments index arrays. Throws with the available keys on a miss. */
export function getPath(value, path, what = "value") {
  if (path == null || path === "") return value;
  let cur = value;
  const seen = [];
  for (const seg of String(path).split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") throw new Error(`${what}: path "${path}" stops at "${seen.join(".") || "(root)"}" (not an object)`);
    if (!(seg in cur)) {
      const keys = Array.isArray(cur) ? `length ${cur.length}` : `keys ${Object.keys(cur).slice(0, 12).join(", ")}`;
      throw new Error(`${what}: no "${seg}" at "${seen.join(".") || "(root)"}" (${keys})`);
    }
    cur = cur[seg];
    seen.push(seg);
  }
  return cur;
}

const flatten = (v) => (Array.isArray(v) ? v.flatMap(flatten) : [v]);
const tolOne = (t, i) => (Array.isArray(t) ? t[i] : t);
function within(a, b, t) {
  if (a === null || b === null) return a === b;
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  const abs = typeof t === "number" ? t : t?.abs ?? 0;
  const relTol = typeof t === "object" && t ? t.rel ?? 0 : 0;
  return Math.abs(a - b) <= abs + relTol * Math.abs(b);
}

/** Compare a value with the expected one under a tolerance: null when they agree, else a short reason. Vectors compare
 * element-wise (per-element tolerance), text and NA exactly. */
export function compareValues(type, stored, fresh, tolerance = 0) {
  if (type === "text" || type === "na") return stored === fresh ? null : `${JSON.stringify(stored)} != ${JSON.stringify(fresh)}`;
  if (type === "scalar") return within(stored, fresh, tolOne(tolerance, 0)) ? null : `${stored} vs ${fresh} (|diff| ${Math.abs(stored - fresh)})`;
  if (type === "vector") {
    const shape = (v) => JSON.stringify(v, (k, x) => (Array.isArray(x) ? x : 0));
    if (shape(stored) !== shape(fresh)) return `shape differs: ${JSON.stringify(stored)?.slice(0, 80)} vs ${JSON.stringify(fresh)?.slice(0, 80)}`;
    const a = flatten(stored), b = flatten(fresh);
    for (let i = 0; i < a.length; i++) if (!within(a[i], b[i], tolOne(tolerance, i))) return `element ${i}: ${a[i]} vs ${b[i]}`;
    return null;
  }
  return `unknown type ${type}`;
}

function engineFormatter(engine, name) {
  const f = engine[name];
  if (typeof f !== "function" || !name.startsWith("format")) throw new Error(`"${name}" is not an engine formatter (format*) of ${CONFIG.engine}`);
  return f;
}

/** A format with a named format of js/shared/format.js (formatShare, formatExpectedCount) replaced by the engine
 * formatter and options it stands for; an engine export of the same name wins. */
export function expandFormat(engine, named, fmt) {
  if (!isRecord(fmt)) return fmt;
  let out = fmt;
  const n = Object.hasOwn(named ?? {}, fmt.fn) && typeof engine?.[fmt.fn] !== "function" ? named[fmt.fn] : null;
  if (n) {
    if (fmt.options) throw new Error(`format ${fmt.fn}: a named format takes no options (it is ${n.fn} with ${JSON.stringify(n.options)})`);
    out = { ...fmt, fn: n.fn, options: { ...n.options } };
  }
  if (out.item) out = { ...out, item: expandFormat(engine, named, out.item) };
  return out;
}

/** Format a value with an engine formatter described by { fn, options, item, spread }. Returns a string. */
export function formatWith(engine, named, format, value) {
  const fmt = expandFormat(engine, named, format);
  const f = engineFormatter(engine, fmt.fn);
  if (fmt.item && fmt.options) throw new Error(`format ${fmt.fn}: give options or item, not both`);
  let args;
  if (fmt.spread) {
    if (!Array.isArray(value)) throw new Error(`format ${fmt.fn}: spread needs an array value`);
    args = [...value];
  } else args = [value];
  if (fmt.item) {
    const g = engineFormatter(engine, fmt.item.fn);
    const o = fmt.item.options;
    args.push(o ? (v) => g(v, o) : (v) => g(v));
  } else if (fmt.options) args.push(fmt.options);
  const s = f(...args);
  if (typeof s !== "string") throw new Error(`format ${fmt.fn} returned ${Array.isArray(s) ? "an array" : typeof s}, not a string`);
  return s;
}

// ---------------------------------------------------------------------------------------------- sources

/** Every file under a directory (relative posix paths, sorted). */
function listFiles(dir) {
  const out = [];
  const walk = (sub) => {
    for (const name of readdirSync(join(dir, sub)).sort()) {
      const r = sub ? `${sub}/${name}` : name;
      if (statSync(join(dir, r)).isDirectory()) walk(r);
      else out.push(r);
    }
  };
  if (existsSync(dir)) walk("");
  return out;
}

/**
 * Problems of the frozen registry (verification/v1-registry/): MANIFEST.json itself changed (its SHA-256 is pinned in
 * CONFIG), a file listed in it that is missing or whose SHA-256 changed, and a file it does not list. read(rel) ->
 * bytes and list() -> relative paths may be replaced (the self-test plants faults through them).
 */
export function registryIntegrity({ dir = CONFIG.registry, read = (r) => readFileSync(join(ROOT, dir, r)), list = () => listFiles(join(ROOT, dir)), pin = CONFIG.manifestSha256 } = {}) {
  const problems = [];
  let manifest;
  try {
    const bytes = read(CONFIG.manifest);
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== pin) problems.push(`${dir}/${CONFIG.manifest} was changed (SHA-256 ${got.slice(0, 12)}…, check_readouts.mjs pins ${pin.slice(0, 12)}…): the frozen files and their hashes stay as copied`);
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch (e) { return [`${dir}/${CONFIG.manifest} cannot be read: ${e.message}`]; }
  const listed = isRecord(manifest?.files) ? manifest.files : {};
  for (const [r, { sha256 } = {}] of Object.entries(listed)) {
    let bytes;
    try { bytes = read(r); } catch { problems.push(`${dir}/${r} is missing (it is listed in ${CONFIG.manifest})`); continue; }
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== sha256) problems.push(`${dir}/${r} was changed (SHA-256 ${got.slice(0, 12)}…, ${CONFIG.manifest} has ${String(sha256).slice(0, 12)}…): v1's values are frozen`);
  }
  for (const r of list()) {
    // a dotfile (a Finder .DS_Store) is not a file of the registry
    if (r.split("/").some((s) => s.startsWith("."))) continue;
    if (!Object.hasOwn(listed, r) && !CONFIG.unlisted.includes(r)) problems.push(`${dir}/${r} is not a frozen v1 file (${CONFIG.manifest} does not list it)`);
  }
  return problems;
}

/** Contract row ids from contract-rows.json ({ rows: [{ id }] }). */
export function contractRows(doc) {
  return new Set((doc?.rows ?? []).map((r) => r.id));
}

/** Everything the expectations are resolved against, loaded once. */
export async function loadSources() {
  const R = CONFIG.registry;
  const integrity = registryIntegrity();
  const readIf = (p, empty) => (existsSync(join(ROOT, p)) ? readJson(p) : empty);
  const registry = new Map();
  for (const [name, file] of [["numbers.json", readIf(`${R}/numbers.json`, {})], ["numbers-cases.json", readIf(`${R}/numbers-cases.json`, {})]]) {
    for (const [k, e] of Object.entries(file)) {
      if (registry.has(k)) integrity.push(`${R}: key "${k}" is in both numbers.json and ${name}`);
      else registry.set(k, e);
    }
  }
  const specs = new Map();
  const specDir = join(ROOT, R, "spec");
  for (const f of existsSync(specDir) ? readdirSync(specDir).filter((x) => x.endsWith(".json") && !x.startsWith("_")).sort() : []) {
    for (const [k, def] of Object.entries(readJson(`${R}/spec/${f}`).keys ?? {})) specs.set(k, def);
  }
  const goldens = new Map();
  const golden = (group) => {
    if (!goldens.has(group)) {
      const p = `${CONFIG.golden}/${group}.json`;
      goldens.set(group, /^[a-z0-9][a-z0-9-]*$/.test(group) && existsSync(join(ROOT, p)) ? readJson(p) : null);
    }
    return goldens.get(group);
  };
  const parityMods = new Map();
  for (const f of existsSync(join(ROOT, CONFIG.parity)) ? readdirSync(join(ROOT, CONFIG.parity)).filter((x) => x.endsWith(".mjs")) : []) {
    parityMods.set(basename(f, ".mjs"), (await import(href(`${CONFIG.parity}/${f}`))).default);
  }
  const parityTol = (group, field) => {
    const m = parityMods.get(group);
    if (!m) return 0;
    const top = String(field).split(".")[0];
    return m.tolerance?.[top] ?? m.default ?? 0;
  };
  return {
    registry, specs, golden, parityTol, integrity,
    labels: (await import(href(CONFIG.labels))).CONFIG,
    named: (await import(href(CONFIG.formats))).NAMED_FORMATS,
    engine: await import(href(CONFIG.engine)),
    rows: contractRows(readIf(`${R}/contract-rows.json`, { rows: [] })),
    v1captions: readIf(`${R}/captions.json`, { captions: [] }),
    schema: readJson(CONFIG.schema),
  };
}

/** The registry key's own formatter (as v1's build_numbers.mjs wrote its display), or null for text. */
export function registryFormat(key, entry, specs) {
  const def = specs.get(key);
  if (def?.format) return def.format;
  if (key.startsWith("settings.")) return entry.type === "text" ? null : { fn: "formatSetting" };
  if (entry.source?.display_format) return entry.source.display_format;
  return null;
}

const shapeType = (v) => (Array.isArray(v) ? "vector" : v === null ? "na" : typeof v === "string" ? "text" : "scalar");
const sameFormat = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const slotShape = (s) => s.replace(SLOT, CONFIG.slotMark);

/** A literal (under any row) that still quotes v1's wording of a label or caption that v3 rewords. A v3 wording that
 * keeps v1's text inside it (an extension) retires only the exact old string; a rewording retires the old phrase
 * wherever it appears. */
function retiredWordingProblem(value, src) {
  const L = src.labels;
  const v1 = [...(src.v1captions.labels ?? []).map((x) => [x, L.labels[x.id]]), ...(src.v1captions.captions ?? []).map((x) => [x, L.captions[x.id]])];
  for (const [old, now] of v1) {
    if (typeof old.text !== "string" || typeof now !== "string" || now === old.text) continue;
    const hit = now.includes(old.text) ? value === old.text : value.includes(old.text);
    if (hit) return `"${value}" quotes v1's wording of the ${old.id} ${L.labels[old.id] ? "label" : "caption"}; v3 reads "${now}" (${CONFIG.labels})`;
  }
  return null;
}

/** A 6.2 literal is a result label and a 6.5 literal a caption of js/shared/labels.js (its v3 wording). */
function labelLiteralProblem(value, ref, src) {
  const L = src.labels;
  if (ref === CONFIG.labelRow) {
    const ok = Object.values(L.labels).some((t) => {
      if (!t.includes(L.slot)) return t === value;
      const [a, b] = t.split(L.slot);
      return value.startsWith(a) && value.endsWith(b) && value.length > a.length + b.length;
    });
    return ok ? null : `"${value}" is not one of the result labels of ${CONFIG.labels} (CONFIG.labels; a family name fills ${L.slot})`;
  }
  if (ref === CONFIG.captionRow) {
    return Object.values(L.captions).includes(value) ? null : `"${value}" is not a caption of ${CONFIG.labels} (CONFIG.captions)`;
  }
  return null;
}

/** A slotted 6.5 literal is a caption template of labels.js (or a caption without numbers). */
function slottedCaptionProblem(value, src) {
  const L = src.labels;
  const shapes = [...Object.values(L.templates ?? {}), ...Object.values(L.captions)].map(slotShape);
  return shapes.includes(slotShape(value)) ? null : `"${value}" is not a caption template of ${CONFIG.labels} (CONFIG.templates: ${Object.values(L.templates ?? {}).join("; ")})`;
}

/** Resolve one expectation against its source: { value, tol, format, registryDisplay, kind, problems }. */
export function resolveExpectation(x, src) {
  const problems = [];
  const kind = x.kind ?? (x.source === "literal" ? "text" : "number");
  const out = { kind, value: undefined, tol: x.tol ?? 0, format: x.format ?? null, registryDisplay: null, problems };
  if (x.source === "registry") {
    if (typeof x.ref !== "string") { problems.push("a registry ref is a key string"); return out; }
    if (!src.registry.has(x.ref)) { problems.push(`unknown registry key "${x.ref}" (not in ${CONFIG.registry}/numbers.json or numbers-cases.json)`); return out; }
    const entry = src.registry.get(x.ref);
    out.value = entry.value;
    out.tol = x.tol ?? entry.tolerance ?? 0;
    const own = registryFormat(x.ref, entry, src.specs);
    out.format = x.format ?? own;
    if (!x.format || (own && sameFormat(x.format, own))) out.registryDisplay = entry.display;
  } else if (x.source === "golden" || x.source === "oracle") {
    const r = x.ref;
    if (!isRecord(r)) { problems.push(`a ${x.source} ref is { group, row, field }`); return out; }
    const g = src.golden(r.group);
    if (!g) { problems.push(`no golden group "${r.group}" (${CONFIG.golden}/${r.group}.json)`); return out; }
    if (x.source === "golden" && g.uses_postrank !== true) { problems.push(`golden ref "${r.group}" is a base-R oracle group (uses_postrank false): use source "oracle"`); return out; }
    if (x.source === "oracle" && g.uses_postrank !== false) { problems.push(`oracle ref "${r.group}" is a postrank golden group (uses_postrank true): use source "golden"`); return out; }
    const row = (g.rows ?? []).find((y) => y.id === r.row);
    if (!row) { problems.push(`golden group "${r.group}" has no row "${r.row}"`); return out; }
    try { out.value = getPath(row.expect, r.field, `${r.group}/${r.row} expect`); } catch (e) { problems.push(e.message); return out; }
    out.tol = x.tol ?? src.parityTol(r.group, r.field);
    if (kind === "number" && !x.format) problems.push(`${x.source === "oracle" ? "an oracle" : "a golden"} number needs a format (the app's formatter for this element)`);
  } else if (x.source === "literal") {
    if (typeof x.ref !== "string" || !src.rows.has(x.ref)) problems.push(`a literal ref names a row of ${CONFIG.registry}/contract-rows.json ("6.2", "11.4"), got ${JSON.stringify(x.ref)}`);
    if (kind !== "text") problems.push("a literal is only for fixed strings (kind text), never a number");
    const retired = typeof x.value === "string" ? retiredWordingProblem(x.value, src) : null;
    if (typeof x.value !== "string") problems.push("a literal value is a string");
    else if (retired) problems.push(retired);
    else if (x.slots) {
      if (/\d/.test(x.value.replace(SLOT, ""))) problems.push(`a slotted literal writes every number as a slot ⟨name⟩, not in digits: "${x.value}"`);
      else if (x.ref === CONFIG.captionRow) {
        const p = slottedCaptionProblem(x.value, src);
        if (p) problems.push(p);
      }
    } else {
      const p = labelLiteralProblem(x.value, x.ref, src);
      if (p) problems.push(p);
    }
    out.value = x.value;
    return out;
  }
  if (out.value === undefined) return out;
  if (kind === "text" && typeof out.value !== "string") problems.push(`kind text needs a string source value, got ${JSON.stringify(out.value)?.slice(0, 40)}`);
  if (kind === "number" && typeof out.value === "string" && !/^\d+$/.test(out.value)) problems.push(`kind number needs a numeric source value, got "${out.value}"`);
  if (kind === "number" && !out.format) problems.push("no formatter for this number (give format)");
  // the value written in the case file must agree with the source
  const why = compareValues(shapeType(out.value), x.value, out.value, out.tol);
  if (why) problems.push(`value ${JSON.stringify(x.value)?.slice(0, 60)} disagrees with the source (${why}): a stale case file`);
  return out;
}

const comparable = (raw, expected) => {
  const norm = (v, e) => (typeof v === "bigint" ? (typeof e === "string" ? v.toString() : Number(v)) : typeof e === "string" && typeof v === "number" ? String(v) : v);
  if (Array.isArray(expected) && !Array.isArray(raw)) raw = [raw];
  return Array.isArray(raw) ? raw.map((v, i) => norm(v, Array.isArray(expected) ? expected[i] : expected)) : norm(raw, expected);
};

// ---------------------------------------------------------------------------------------------- case files

/** Problems of a case file before anything is mounted: [{ rule, text, case? }]. entry: a catalog entry to use instead
 * of catalog.json's (the self-test's). */
export function caseFileProblems(doc, file, src, { entry: given } = {}) {
  if (!isRecord(doc)) return [{ rule: "case-file", text: "a case file is a JSON object" }];
  const out = [];
  const copy = { ...doc };
  // v1 leftovers are named plainly (the schema would only call them unknown properties)
  if ("widget" in copy) {
    out.push({ rule: "case-file", text: `"widget": ${JSON.stringify(copy.widget)} is v1's field; v3 names the app: "app": "<its catalog name>"` });
    delete copy.widget;
  }
  if (Array.isArray(copy.cases)) {
    copy.cases = copy.cases.map((c) => {
      if (!isRecord(c) || !("predict" in c)) return c;
      out.push({ rule: "predict", case: c.id ?? null, text: `case ${c.id ?? "(no id)"} scripts a prediction (predict ${JSON.stringify(c.predict)}): v3 apps have no prediction gate, so a case cannot script one; drop it when porting (the cases at the same setting without predict check its read-outs)` });
      const { predict: _p, ...rest } = c;
      return rest;
    });
  }
  out.push(...validateSchema(copy, src.schema, { schema: src.schema, path: "$" }).map((text) => ({ rule: "case-file", text })));
  if (typeof copy.catalog === "string" && /^[A-Z]-\d{2}$/.test(copy.catalog)) {
    const from = (loadCatalog().apps ?? []).filter((a) => new RegExp(`\\bv1 [^;]*\\b${copy.catalog}\\b`).test(a.from ?? ""));
    out.push({ rule: "case-file", text: `"${copy.catalog}" is a v1 catalog id; ${from.length ? `the v3 app from it is ${from.map((a) => `${a.id} ${a.name}`).join(", ")}` : "no v3 app names it in its from field"} (give the v3 id)` });
  }
  if (out.length) return out;
  const p = (text) => out.push({ rule: "case-file", text });
  if (!file.startsWith("(") && basename(file) !== `${doc.app}.json`) p(`the file name must be ${doc.app}.json`);
  const named = entryByName(doc.app);
  if (doc.catalog !== null) {
    const e = given ?? entryFor(doc.catalog);
    if (!e) p(`catalog entry ${doc.catalog} is not in catalog.json${named ? ` (${doc.app} is ${named.id})` : ""}`);
    else if (e.name !== doc.app) p(`catalog entry ${doc.catalog} is ${e.name}, not ${doc.app}${named ? ` (${doc.app} is ${named.id})` : ""}`);
    if (doc.module !== undefined) p(`module is for a fixture only: an app of the catalog is ${CONFIG.apps}/${doc.app}.js`);
  } else if (named) p(`${doc.app} is catalog app ${named.id}: give "catalog": "${named.id}" (null is for a fixture)`);
  else if (!doc.module) p("an app without a catalog entry is a fixture: give its module");
  const ids = new Set();
  for (const c of doc.cases) {
    if (ids.has(c.id)) p(`case id "${c.id}" is used twice`);
    ids.add(c.id);
    if ((c.preset === undefined) === (c.query === undefined)) p(`case ${c.id}: give exactly one of preset and query`);
    for (const x of c.expect) {
      const kind = x.kind ?? (x.source === "literal" ? "text" : "number");
      if (x.attr && kind !== "text") p(`case ${c.id}: attr is for kind text only`);
      if (x.slots && (kind !== "text" || x.source !== "literal" || x.attr)) p(`case ${c.id}: slots is for a literal text of an element (not an attribute)`);
    }
  }
  return out;
}

const finding = (file, c, rule, where, text) => ({ file, case: c, rule, where, text });

/** The text of an element with each outermost data-num element written as one slot (CONFIG.slotMark). */
export function slotText(node) {
  let out = "";
  const walk = (n) => {
    for (const ch of n.childNodes) {
      if (ch.nodeType === 3) out += ch.data;
      else if (ch.nodeType === 1) {
        if (ch.hasAttribute("data-num")) out += CONFIG.slotMark;
        else walk(ch);
      }
    }
  };
  if (node.nodeType === 1 && node.hasAttribute("data-num")) return CONFIG.slotMark;
  walk(node);
  return out.trim();
}

/** Check one case file (a parsed object). opts: { file, src, module (override: a path or module object), entry
 * (override of the catalog entry) }. Returns { findings, counts }. */
export async function checkCaseFile(doc, { file = "(memory)", src, module, entry: given } = {}) {
  const findings = [];
  const counts = { cases: 0, expectations: 0, numbers: 0 };
  const fileProblems = caseFileProblems(doc, file, src, { entry: given });
  if (fileProblems.length) {
    for (const p of fileProblems) findings.push(finding(file, p.case ?? null, p.rule, "", p.text));
    return { findings, counts };
  }
  const entry = given ?? (doc.catalog ? entryFor(doc.catalog) : null);
  const mod = module ?? doc.module ?? `${CONFIG.apps}/${doc.app}.js`;
  // the catalog caption base.js writes is authored text (dom_rules.mjs numberFindings, "authored")
  const authored = typeof entry?.caption === "string" ? [entry.caption] : [];
  // rule source: an app that imports the check's own expected values would be compared with itself
  if (typeof mod === "string") {
    for (const p of [...importClosure(mod)].filter((x) => CONFIG.expectedSources.test(x))) {
      findings.push(finding(file, null, "source", "", `${rel(resolve(ROOT, mod))} imports ${p}, an expected-value source of this check; an app takes its numbers from the engine or data/`));
    }
  }
  // the app's state at an empty query (for the value check of rule query), mounted once when a case needs it
  let defaults;
  const appDefaults = async () => {
    if (defaults === undefined) {
      try { const d = await mountCase({ module: mod, query: "" }); defaults = d.initial?.state ?? null; d.close(); } catch { defaults = null; }
    }
    return defaults;
  };
  const presetIds = (entry?.presets ?? []).map((x) => x.id);
  const unknownPreset = (id) => `preset "${id}" is not a preset of ${entry ? `${entry.id} ${entry.name} (its presets: ${presetIds.join(", ") || "none"})` : "this app (it has no catalog entry)"}`;
  const once = new Set();
  for (const c of doc.cases) {
    counts.cases += 1;
    const resolved = c.expect.map((x) => resolveExpectation(x, src));
    let bad = false;
    resolved.forEach((r, i) => {
      for (const p of r.problems) { findings.push(finding(file, c.id, "case", `expect[${i}]`, p)); bad = true; }
    });
    const { query, presetQuery, problems: qp } = caseQuery(c, entry);
    for (const p of qp) { findings.push(finding(file, c.id, p.rule, "query", p.text)); bad = true; }
    if (isRecord(c.spec) && Object.hasOwn(c.spec, "preset") && !presetIds.includes(c.spec.preset)) { findings.push(finding(file, c.id, "case", "spec", unknownPreset(c.spec.preset))); bad = true; }
    (c.update ?? []).forEach((u, i) => {
      if (!isRecord(u) || !Object.hasOwn(u, "preset") || presetIds.includes(u.preset)) return;
      findings.push(finding(file, c.id, "case", `update[${i}]`, unknownPreset(u.preset)));
      bad = true;
    });
    if (bad) continue;
    const base = presetQuery !== null || query.replace(/^\?/, "") !== "" ? await appDefaults() : null;
    let m;
    try {
      m = await mountCase({ module: mod, query, spec: c.spec ?? {}, updates: c.update ?? [] });
    } catch (err) {
      findings.push(finding(file, c.id, "mount", "", err.message));
      continue;
    }
    try {
      const el = m.el;
      const first = (rule) => !once.has(rule) && once.add(rule);
      if (m.initial.widget !== doc.app && first("app")) {
        findings.push(finding(file, c.id, "app", "", `the app's root has data-prx-widget="${m.initial.widget}", not "${doc.app}": createWidget's name must be the catalog name, since base.js takes the presets and the caption from the catalog entry of that name`));
      }
      // (a spec that sets keys of the app changes the preset's setting on purpose, so the preset is not shown pressed)
      const specSets = Object.keys(c.spec ?? {}).some((k) => !["preset", "theme", "query"].includes(k));
      if (c.preset !== undefined && !specSets && !m.initial.pressed.includes(c.preset)) {
        // a preset with the same query as another is shown as the first of them
        const twins = (entry?.presets ?? []).filter((p) => p.id !== c.preset && String(p.query ?? "").replace(/^\?/, "") === presetQuery).map((p) => p.id);
        if (!m.initial.pressed.some((id) => twins.includes(id))) {
          findings.push(finding(file, c.id, "preset", "", `at ?preset=${c.preset} the preset row does not show ${c.preset} pressed (pressed: ${m.initial.pressed.join(", ") || "none"}): base.js did not apply it, so a reader's link or button does not reach this setting`));
        }
      }
      if (entry && entry.math !== true && [...el.querySelectorAll("*")].some((n) => n.__prxMath !== undefined) && first("math")) {
        findings.push(finding(file, c.id, "math", "", `the app renders formulas (js/shared/math.js), but its catalog entry has no "math": true, so its page and embed do not load Temml and readers see the TeX`));
      }
      for (const p of appKeyProblems({ initial: m.initial, defaults: base, query, presetQuery, spec: c.spec, updates: c.update, preset: c.preset, handle: m.handle })) findings.push(finding(file, c.id, "query", p.where, p.text));
      const covered = new Set();
      c.expect.forEach((x, i) => {
        counts.expectations += 1;
        const r = resolved[i];
        const where = `expect[${i}] ${x.select}${x.index !== undefined ? ` #${x.index}` : ""}`;
        let els;
        try { els = [...el.querySelectorAll(x.select)]; } catch (e) { findings.push(finding(file, c.id, "select", where, `invalid selector: ${e.message}`)); return; }
        let node;
        if (x.index !== undefined) node = els[x.index];
        else if (els.length === 1) node = els[0];
        if (!node) {
          findings.push(finding(file, c.id, "select", where, x.index !== undefined ? `${els.length} match(es), no index ${x.index}` : `${els.length} matches (one is required, or give index)`));
          return;
        }
        if (r.kind === "text") {
          const actual = x.attr ? node.getAttribute(x.attr) : x.slots ? slotText(node) : (node.textContent ?? "").trim();
          const want = x.slots ? slotShape(r.value) : r.value;
          if (actual !== want) findings.push(finding(file, c.id, "text", where, `${x.attr ? `@${x.attr} ` : x.slots ? "slots " : ""}${JSON.stringify(actual)} != ${JSON.stringify(want)} (${x.source} ${typeof x.ref === "string" ? x.ref : x.ref.group})`));
          return;
        }
        covered.add(node);
        const dn = node.getAttribute("data-num");
        if (dn === null) { findings.push(finding(file, c.id, "no-data-num", where, `the element shows "${(node.textContent ?? "").trim()}" without data-num`)); return; }
        const parsed = parseDataNum(dn);
        if (!parsed.ok) { findings.push(finding(file, c.id, "bad-data-num", where, `data-num "${dn}"`)); return; }
        counts.numbers += 1;
        const why = compareValues(shapeType(r.value), comparable(parsed.value, r.value), r.value, r.tol);
        if (why) findings.push(finding(file, c.id, "raw", where, `data-num ${dn} vs ${x.source} ${typeof x.ref === "string" ? x.ref : `${x.ref.group}/${x.ref.row}/${x.ref.field}`} = ${JSON.stringify(r.value)} within ${JSON.stringify(r.tol)}: ${why}`));
        const display = (node.textContent ?? "").trim();
        let want;
        // Only structured formatters consume the declared vector shape. Scalar formatters may
        // legitimately select a one-criterion source vector (e.g. E/N) as one scalar. Keep
        // parsed numeric/BigInt types; comparable() normalizes exact-count strings for equality only.
        try {
          const formatSpec = expandFormat(src.engine, src.named, r.format);
          const vectorFormat = formatSpec.spread || ["formatGrades", "formatSizes", "formatTuple", "formatSetting"].includes(formatSpec.fn);
          const displayRaw = vectorFormat && Array.isArray(r.value) && !Array.isArray(parsed.value) ? [parsed.value] : parsed.value;
          want = formatWith(src.engine, src.named, r.format, displayRaw);
        } catch (e) { findings.push(finding(file, c.id, "display", where, `${r.format.fn}(${dn}) failed: ${e.message}`)); return; }
        if (display !== want) findings.push(finding(file, c.id, "display", where, `"${display}" != ${r.format.fn}(${dn}) = "${want}"`));
        else if (r.registryDisplay !== null && display !== r.registryDisplay) findings.push(finding(file, c.id, "display", where, `"${display}" != v1's registry display "${r.registryDisplay}" of ${x.ref}`));
      });
      for (const f of [...numberFindings(el, { authored }), ...badTokenFindings(el), ...displayFindings(el, { skip: covered }), ...textAlternativeFindings(el)]) {
        findings.push(finding(file, c.id, f.rule, f.where, `${f.text}${f.token && f.rule === "no-data-num" ? ` (token "${f.token}"${f.count > 1 ? `, ${f.count} in this text` : ""})` : ""}`));
      }
      counts.numbers += [...el.querySelectorAll("[data-num]")].filter((n) => !covered.has(n)).length;
    } finally {
      m.close();
    }
  }
  return { findings, counts };
}

// ---------------------------------------------------------------------------------------------- file selection

/** All case files (project-relative), sorted. */
export function caseFiles() {
  const dir = join(ROOT, CONFIG.dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort().map((f) => `${CONFIG.dir}/${f}`);
}

/** The case file of one app (--only): { files } with its file, or none and a note when the app has none yet, or
 * { error } when neither a catalog app nor a case file has the name. */
export function filesForOnly(name, { files = caseFiles(), known = (n) => Boolean(entryByName(n)) } = {}) {
  const f = `${CONFIG.dir}/${name}.json`;
  if (files.includes(f)) return { files: [f] };
  if (known(name)) return { files: [], note: `${name} has no read-out case file yet (${f})` };
  return { error: `--only ${name}: no catalog app and no case file has that name` };
}

/** The project files a case file's app is built from: its module and everything the module imports (relative). */
const closureOf = (d) => importClosure(d?.module ?? `${CONFIG.apps}/${d?.app}.js`);

/** Case files the changed paths touch (see the header). closure(doc) -> Set of project paths may be replaced. */
export function filesForChanged(changed, files = caseFiles(), read = (f) => readJson(f), closure = closureOf) {
  const docs = files.map((f) => {
    try { return { f, d: read(f) }; } catch { return { f, d: null }; }
  });
  const closures = new Map();
  const uses = (f, d, p) => {
    if (!closures.has(f)) closures.set(f, d ? closure(d) : new Set());
    return closures.get(f).has(p);
  };
  const out = new Set();
  for (const raw of changed) {
    const p = raw.trim().replace(/^\.\//, "");
    if (!p) continue;
    if (CONFIG.sharedPaths.some((re) => re.test(p))) return files.slice();
    const own = /^verification\/readouts\/([^/_][^/]*)\.json$/.exec(p);
    if (own) { if (files.includes(p)) out.add(p); continue; }
    const app = /^catalog\/entries\/(?:[1-9][0-9]*|T)\.[1-9][0-9]*-([a-z0-9][a-z0-9-]*)\.json$/.exec(p)?.[1];
    for (const { f, d } of docs) {
      const dir = d?.module ? d.module.split("/").slice(0, -1).join("/") : null;
      // the app's own catalog entry, a file of a fixture's folder, or any module the app imports (another app's
      // exported helpers included)
      if ((app && d?.app === app) || (dir && p.startsWith(`${dir}/`)) || uses(f, d, p)) out.add(f);
    }
  }
  return files.filter((f) => out.has(f));
}

// ---------------------------------------------------------------------------------------------- report

function print(results, quiet) {
  const total = { files: 0, cases: 0, expectations: 0, numbers: 0, findings: 0 };
  for (const r of results) {
    total.files += 1;
    total.cases += r.counts.cases;
    total.expectations += r.counts.expectations;
    total.numbers += r.counts.numbers;
    total.findings += r.findings.length;
    if (!quiet || r.findings.length) {
      console.log(`  ${r.file}: ${r.counts.cases} case(s), ${r.counts.expectations} expectation(s), ${r.counts.numbers} number(s): ${r.findings.length ? `${r.findings.length} finding(s)` : "ok"}`);
    }
    for (const f of r.findings) console.log(`    ${f.case ? `case ${f.case}: ` : ""}${f.rule}${f.where ? ` [${f.where}]` : ""}: ${f.text}`);
  }
  return total;
}

// ---------------------------------------------------------------------------------------------- self-test

/** A wrapper module whose mountWidget applies fault(root, el, handle) after the real mount. */
function patched(mod, fault) {
  return {
    mountWidget(el, spec) {
      const h = mod.mountWidget(el, spec);
      fault(h.root, el, h);
      return h;
    },
  };
}

async function selfTest({ verbose = false } = {}) {
  const src = await loadSources();
  const failures = [];
  let planted = 0, caught = 0, cleanTotal = 0, clean = 0;
  const note = (name, f) => { if (verbose) console.log(`  caught "${name}": ${f.rule}${f.where ? ` [${f.where}]` : ""}: ${f.text}`); };
  const fixtureFile = CONFIG.fixture;
  const base = readJson(fixtureFile);
  const fixture = await import(href(base.module));
  const appBase = await import(href(CONFIG.base));
  const fmt = await import(href(CONFIG.formats));
  const lab = await import(href(CONFIG.labels));
  const pc = src.engine;
  const one = (caseId) => ({ ...base, cases: base.cases.filter((c) => c.id === caseId) });
  const readout = (root) => root.querySelector('[data-prx-part~="readout"]');
  const nums = (root) => [...readout(root).querySelectorAll(".prx-num")];
  const doc = (root) => root.ownerDocument;
  const caption = (root) => root.querySelector('[data-prx-part~="caption"]');
  const show = (r) => r.findings.map((f) => `${f.rule}: ${f.text}`).join(" | ") || "no findings";

  const run = (caseDoc, opts) => checkCaseFile(caseDoc, { file: opts.file ?? "(self-test)", src, module: opts.module, entry: opts.entry });
  const expectClean = async (name, caseDoc, opts = {}) => {
    cleanTotal += 1;
    const r = await run(caseDoc, opts);
    if (r.findings.length === 0) clean += 1;
    else failures.push(`clean case "${name}" has findings: ${show(r)}`);
    return r;
  };
  const expectCaught = async (name, rule, caseDoc, opts = {}) => {
    planted += 1;
    const r = await run(caseDoc, opts);
    const hit = r.findings.filter((f) => f.rule === rule && (!opts.match || opts.match.test(f.text)));
    if (hit.length) { caught += 1; note(name, hit[0]); }
    else failures.push(`fault "${name}" not caught as ${rule}${opts.match ? ` matching ${opts.match}` : ""}: ${show(r)}`);
  };
  const fault = (name, rule, fn, caseId = "defaults") => expectCaught(name, rule, one(caseId), { module: patched(fixture, fn), file: fixtureFile });
  const cleanWith = (name, fn, caseId = "defaults") => expectClean(name, one(caseId), { module: patched(fixture, fn), file: fixtureFile });
  const add = (root, html, where = readout(root)) => { const t = doc(root).createElement("span"); t.innerHTML = html; where.append(t); };
  const withCase = (patch, caseId = "defaults") => {
    const d = clone(one(caseId));
    patch(d.cases[0]);
    return d;
  };
  const fx = { file: fixtureFile };

  // clean: the fixture's case file as written
  await expectClean("readout-app.json as written", base, fx);

  // data-num's comma-list encoding has no comma for a one-element vector. Its declared
  // source shape must be used for formatting as well as for the existing raw comparison.
  const singletonDoc = clone(one("defaults"));
  singletonDoc.cases[0].expect = [{select:"[data-test-singleton]",source:"oracle",ref:{group:"oracle-v3p3",row:"sizes-n30-G1",field:"balancedSizes"},value:[30],format:{fn:"formatSizes"}}];
  const singletonModule = (raw, text) => patched(fixture, root => {
    const node = fmt.numSpan(raw, text, {document:doc(root)}); node.setAttribute("data-test-singleton", "");
    readout(root).replaceChildren(node);
  });
  await expectClean("one-element vector keeps its source shape for formatting", singletonDoc, {file:fixtureFile,module:singletonModule([30],pc.formatSizes([30]))});
  await expectCaught("one-element vector wrong raw still fails", "raw", singletonDoc, {file:fixtureFile,module:singletonModule([31],pc.formatSizes([31]))});
  await expectCaught("one-element vector wrong display still fails", "display", singletonDoc, {file:fixtureFile,module:singletonModule([30],"30")});

  // A source may encode exact report counts as decimal strings. That normalization is for raw
  // equality only: formatCount must receive the parsed numeric/BigInt value, never that string.
  const exactCountDoc = clone(one("defaults"));
  exactCountDoc.cases[0].expect = [{select:"[data-test-singleton]",source:"oracle",ref:{group:"oracle-report-risk",row:"familySize-n3-all",field:"size"},value:"13",format:{fn:"formatCount"}}];
  await expectClean("string-encoded count source keeps the numeric display value", exactCountDoc, {file:fixtureFile,module:singletonModule(13,pc.formatCount(13))});
  await expectCaught("string-encoded count source wrong raw still fails", "raw", exactCountDoc, {file:fixtureFile,module:singletonModule(14,pc.formatCount(14))});
  await expectCaught("string-encoded count source wrong display still fails", "display", exactCountDoc, {file:fixtureFile,module:singletonModule(13,"14")});
  for (const [n,value] of [[18,"3385534663256845323"],[20,"2677687796244384203115"]]) {
    const largeCountDoc = clone(exactCountDoc);
    largeCountDoc.cases[0].expect[0].ref.row = `familySize-n${n}-all`;
    largeCountDoc.cases[0].expect[0].value = value;
    const raw = BigInt(value);
    await expectClean(`unsafe integer count n${n} keeps its exact BigInt display value`, largeCountDoc, {file:fixtureFile,module:singletonModule(raw,pc.formatCount(raw))});
    await expectCaught(`unsafe integer count n${n} wrong raw still fails`, "raw", largeCountDoc, {file:fixtureFile,module:singletonModule(raw+1n,pc.formatCount(raw+1n))});
  }
  const componentDoc = clone(one("defaults"));
  componentDoc.cases[0].expect = [{select:"[data-test-singleton]",source:"golden",ref:{group:"postrank-report-risk",row:"evaluateReport-pr_tutorial-one-tau.2-112233",field:"EoverM"},value:[0.00165163994548711],format:{fn:"formatShare"}}];
  await expectClean("scalar share formatter reads a one-criterion source vector component", componentDoc, {file:fixtureFile,module:singletonModule(.00165163994548711,fmt.formatShare(.00165163994548711))});
  const invalidFormatDoc = clone(componentDoc);
  invalidFormatDoc.cases[0].expect[0].format.options = {sig:3};
  await expectCaught("invalid named formatter options become a display finding", "display", invalidFormatDoc, {file:fixtureFile,module:singletonModule(.00165163994548711,fmt.formatShare(.00165163994548711))});

  // (b) wrong number, (a) wrong display, (c) numbers without data-num, (d) bad tokens, text alternatives
  await fault("wrong number: τ raw .23 shown as .23", "raw", (root) => { const s = nums(root)[0]; s.setAttribute("data-num", "0.23"); s.textContent = ".23"; });
  await fault("wrong display: τ raw .2 shown as .25", "display", (root) => { nums(root)[0].textContent = ".25"; });
  await fault("display not the registry string (.200 for .20)", "display", (root) => { nums(root)[0].textContent = ".200"; });
  await fault("number without data-num in the read-out", "no-data-num", (root) => readout(root).append("; pairs 6"));
  await fault("data-num removed from a read-out span", "no-data-num", (root) => nums(root)[2].removeAttribute("data-num"));
  await fault("number without data-num in the hidden table", "no-data-num", (root) => root.querySelector("td[data-num]").removeAttribute("data-num"));
  await fault("number without data-num on an axis tick", "no-data-num", (root) => root.querySelector('g[aria-label$="tick label"] text[data-num]').removeAttribute("data-num"));
  await fault("number without data-num on a figure label", "no-data-num", (root) => { for (const t of root.querySelectorAll("svg text[data-num]")) if (/^\.\d+$/.test(t.textContent) && !t.closest('g[aria-label$="tick label"]')) { t.removeAttribute("data-num"); break; } });
  await fault("number without data-num in the caption", "no-data-num", (root) => caption(root).append(" Seed 2024."));
  await fault("expected element without data-num", "no-data-num", (root) => nums(root)[1].removeAttribute("data-num"));
  await fault("NaN in the read-out", "bad-token", (root) => { nums(root)[2].textContent = "NaN"; });
  await fault("undefined in the caption", "bad-token", (root) => caption(root).append(" undefined"));
  await fault("[object Object] in the read-out", "bad-token", (root) => readout(root).append(" [object Object]"));
  await fault("Infinity in a figure label", "bad-token", (root) => root.querySelector("svg text").append("Infinity"));
  await fault("NaN in an aria-label", "bad-token", (root) => root.querySelector("svg[role=img]").setAttribute("aria-label", "Points NaN"));
  await fault("generic display: a table cell .72 for data-num .12", "display-generic", (root) => { root.querySelector("td[data-num]").textContent = ".72"; });
  await fault("generic display: words inside a data-num span", "display-generic", (root) => { nums(root)[2].textContent = "0 runs"; });
  await fault("malformed data-num", "bad-data-num", (root) => nums(root)[2].setAttribute("data-num", "zero"));
  await fault("figure without a text alternative", "no-text-alternative", (root) => { root.querySelector("svg[role=img]").removeAttribute("aria-label"); root.querySelector(".prx-data-table")?.remove(); });

  // structural exceptions stay tight: these pass ...
  await cleanWith("exceptions: Grade 2, U08, A1, (2024), 2nd, a name, a math index, a hidden number, an svg title", (root) => {
    add(root, " Grade 2 = second; unit U08; unit A1; Kline (2024); the 2nd unit; <span data-prx-name=\"\">Site 12</span>; "
      + "<math><msub><mi>θ</mi><mn>1</mn></msub></math><span hidden> 0.5 </span>");
    const t = doc(root).createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = "Point A at .12";
    root.querySelector("svg[role=img]").append(t);
  });
  // ... and these fail
  await fault("a seed is not a year", "no-data-num", (root) => add(root, " seed 2024"));
  await fault("a range after a reference word", "no-data-num", (root) => add(root, " grades 1–3"));
  await fault("a decimal inside a name", "no-data-num", (root) => add(root, '<span data-prx-name="">Site .25</span>'));
  await fault("a number in MathML that is not an index", "no-data-num", (root) => add(root, "<math><mi>τ</mi><mo>=</mo><mn>.20</mn></math>"));
  await fault("a percentage without data-num", "no-data-num", (root) => add(root, " 14% withheld"));
  await fault("a grade vector without data-num", "no-data-num", (root) => add(root, " report 1/2/2"));

  // (e) a case may not script a prediction (v3 has no gate)
  await expectCaught("a case scripts a prediction (a choice)", "predict", withCase((c) => { c.predict = { choice: "more" }; }), fx);
  await expectCaught("a case scripts a prediction (a typed value)", "predict", withCase((c) => { c.predict = { input: 0.76 }; }), fx);
  await expectCaught("a case scripts a prediction (skip)", "predict", withCase((c) => { c.predict = "skip"; }), fx);
  await expectCaught("a query sets predict=off", "predict", withCase((c) => { c.query = "?tau=.20&predict=off"; }), fx);

  // expectations against their sources (case problems found before anything is mounted)
  await expectCaught("unknown registry key", "case", withCase((c) => { c.expect[0].ref = "settings.tau21"; }), fx);
  await expectCaught("stale value: the case value disagrees with the registry", "case", withCase((c) => { c.expect[0].value = 0.25; }), fx);
  await expectCaught("golden group missing", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "golden", ref: { group: "no-such-group", row: "x", field: "pi" }, value: 0.2, format: { fn: "formatSetting" } }; }), fx);
  await expectCaught("golden row missing", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "oracle", ref: { group: "oracle-pairwise", row: "no-such-row", field: "pi" }, value: 0.5, format: { fn: "formatProb" } }; }), fx);
  await expectCaught("golden field missing", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "oracle", ref: { group: "oracle-pairwise", row: "pairDirection-eq-means", field: "pj" }, value: 0.5, format: { fn: "formatProb" } }; }), fx);
  await expectCaught("oracle ref to a postrank golden", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "oracle", ref: { group: "postrank-report-risk", row: "evaluateReport-pr_tutorial-one-tau.2-112233", field: "risk" }, value: 0.0416516399454871, format: { fn: "formatRisk" } }; }), fx);
  await expectCaught("golden ref to an oracle group", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "golden", ref: { group: "oracle-pairwise", row: "pairDirection-eq-means", field: "pi" }, value: 0.5, format: { fn: "formatProb" } }; }), fx);
  await expectCaught("golden number without a format", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "oracle", ref: { group: "oracle-pairwise", row: "pairDirection-eq-means", field: "pi" }, value: 0.5 }; }), fx);
  await expectCaught("stale value: the case value disagrees with an oracle row", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", source: "oracle", ref: { group: "oracle-pairwise", row: "pairDirection-eq-means", field: "pi" }, value: 0.6, format: { fn: "formatProb" } }; }), fx);
  await expectCaught("literal ref is not a contract row", "case", withCase((c) => { c.expect[3].ref = "11.9"; }), fx);
  await expectCaught("literal used for a number", "case", withCase((c) => { c.expect[0] = { select: ".prx-slider output", kind: "number", source: "literal", ref: "5.5", value: ".20" }; }), fx);
  await expectCaught("6.5 literal that is not a caption of labels.js", "case", withCase((c) => { c.expect[3] = { select: "[data-prx-part~=\"caption\"]", source: "literal", ref: "6.5", value: "Test data; nothing here is computed by the engine." }; }), fx);
  await expectCaught("6.2 literal that is not a result label", "case", withCase((c) => { c.expect[3] = { select: "[data-prx-part~=\"caption\"]", source: "literal", ref: "6.2", value: "the best report of all" }; }), fx);
  await expectCaught("a slotted literal with a number in digits", "case", withCase((c) => { c.expect.push({ select: "[data-prx-part~=\"readout\"]", kind: "text", slots: true, source: "literal", ref: "9.1", value: "τ = ⟨tau⟩; family unrestricted; units 4; runs ⟨runs⟩." }); }), fx);
  await expectClean("a slotted literal of the read-out sentence", withCase((c) => { c.expect.push({ select: "[data-prx-part~=\"readout\"]", kind: "text", slots: true, source: "literal", ref: "9.1", value: "τ = ⟨tau⟩; family unrestricted; units ⟨units⟩; runs ⟨runs⟩." }); }), fx);
  await expectCaught("a slotted literal whose words differ on screen", "text", withCase((c) => { c.expect.push({ select: "[data-prx-part~=\"readout\"]", kind: "text", slots: true, source: "literal", ref: "9.1", value: "τ = ⟨tau⟩; family capped; units ⟨units⟩; runs ⟨runs⟩." }); }), fx);
  await expectCaught("literal text differs on screen", "text", withCase((c) => { c.expect[3].value = "Test pointz"; }), fx);
  await expectCaught("unknown selector: it matches nothing", "select", withCase((c) => { c.expect[0].select = "[data-prx-readout=\"risk\"]"; delete c.expect[0].index; }), fx);
  await expectCaught("selector matches several elements without index", "select", withCase((c) => { delete c.expect[0].index; }), fx);
  await expectCaught("index beyond the matches", "select", withCase((c) => { c.expect[0].index = 9; }), fx);
  await expectCaught("invalid selector", "select", withCase((c) => { c.expect[0].select = "[data-prx-readout="; }), fx);

  // the case file itself
  const drop = (o, ...keys) => { const out = { ...o }; for (const k of keys) delete out[k]; return out; };
  const [appA, appB] = loadCatalog().apps;
  const casesOf = one("defaults").cases;
  await expectCaught("schema: unknown property", "case-file", withCase((c) => { c.expect[0].tolerance = 0; }), fx);
  await expectCaught("schema: preset and query both given", "case-file", withCase((c) => { c.preset = "tau20"; }), fx);
  await expectCaught("slots on a number expectation", "case-file", withCase((c) => { c.expect[0].slots = true; }), fx);
  await expectCaught("attr on a number expectation", "case-file", withCase((c) => { c.expect[0].attr = "title"; }), fx);
  await expectCaught("a case id used twice", "case-file", { ...base, cases: [...one("defaults").cases, ...one("defaults").cases] }, fx);
  await expectCaught("v1's widget field instead of app", "case-file", { ...drop(one("defaults"), "app"), widget: "readout-app" }, fx);
  await expectCaught("the file name is not <app>.json", "case-file", one("defaults"), { file: `${CONFIG.dir}/readout-fixture.json` });
  await expectCaught("a v1 catalog id", "case-file", { app: appA.name, catalog: "L-03", cases: casesOf }, { file: `${CONFIG.dir}/${appA.name}.json`, match: /is a v1 catalog id/ });
  await expectCaught("the catalog id of another app", "case-file", { app: appA.name, catalog: appB.id, cases: casesOf }, { file: `${CONFIG.dir}/${appA.name}.json`, match: new RegExp(`${appA.name} is ${appA.id.replace(".", "\\.")}`) });
  await expectCaught("a catalog app written as a fixture", "case-file", { app: appA.name, catalog: null, module: `${CONFIG.apps}/${appA.name}.js`, cases: casesOf }, { file: `${CONFIG.dir}/${appA.name}.json` });
  await expectCaught("a module on a catalog app", "case-file", { app: appA.name, catalog: appA.id, module: `${CONFIG.apps}/${appA.name}.js`, cases: casesOf }, { file: `${CONFIG.dir}/${appA.name}.json` });
  await expectCaught("a fixture without its module", "case-file", drop(one("defaults"), "module"), fx);
  await expectCaught("an unknown preset of a real catalog app (a v1 preset id)", "case", { app: appA.name, catalog: appA.id, cases: [{ id: "x", preset: "no-such-preset", expect: casesOf[0].expect }] }, { file: `${CONFIG.dir}/${appA.name}.json` });
  await expectCaught("module missing", "mount", { ...one("defaults"), module: "verification/fixtures/readout-app/missing.js" }, fx);

  // keys the app does not have: the app would ignore them and show its defaults
  await expectCaught("a query key the app does not have (renamed in a port)", "query", withCase((c) => { c.query = "?tau=.20&units=4"; }), fx);
  await expectCaught("a v1 present-mode key in a query", "query", withCase((c) => { c.query = "?present=on"; }), fx);
  await expectCaught("a raw query that sets preset", "case", withCase((c) => { c.query = "?preset=tau20"; }), fx);
  await expectCaught("an update key the app does not have", "query", withCase((c) => { c.update = [{ taus: 0.4 }]; }), fx);
  await expectCaught("a spec key the app does not have", "query", withCase((c) => { c.spec = { bogus: 1 }; }), fx);
  await expectClean("reserved keys pass: theme in a query and in an update", withCase((c) => { c.query = "?theme=dark"; c.update = [{ theme: "light" }]; }), fx);
  // values the app does not take: it shows its default for the key although the query names another setting
  await expectCaught("a choice the app does not offer (?family=capt)", "query", withCase((c) => { c.query = "?family=capt"; }), fx);
  await expectCaught("a non-integer for an integer key (?n=2.5)", "query", withCase((c) => { c.query = "?n=2.5"; }), fx);
  await expectCaught("a value the app cannot read (?tau=.20x)", "query", withCase((c) => { c.query = "?tau=.20x"; }), fx);
  await expectClean("values equal to the defaults are taken (?tau=.20&n=4&show=on)", withCase((c) => { c.query = "?tau=.20&n=4&show=on"; }), fx);

  // presets by their v3 id and the catalog caption line, through a catalog entry made for the test; the fixture gets
  // the entry's presets as base.js would from the catalog, and the case mounts at ?preset=<id> as a reader would
  const entryT = {
    id: "T.9", name: "readout-app", title: "Read-out fixture", math: true,
    caption: "Fixture data: 4 test points, 1,000 draws, τ = .20 (2024).",
    presets: [{ id: "tau30-two", label: "τ .30, 2 units", query: "tau=.30&n=2" }, { id: "bad-key", label: "τ .30, 2 units (v1 key)", query: "tau=.30&units=2" }],
  };
  const asEntry = (d) => ({ ...drop(d, "module"), catalog: entryT.id });
  const app = ({ presets = entryT.presets, name } = {}) => ({ mountWidget: (el, spec) => fixture.mountWidget(el, spec, { presets, name }) });
  const writeCaption = (root) => { caption(root).textContent = entryT.caption; };
  const writesCaption = patched(app(), writeCaption);
  const tx = (module, entry = entryT) => ({ module, entry, file: fixtureFile });
  const presetCase = (preset, more = {}) => asEntry({ ...one("tau30-two-units"), cases: [{ id: "preset", preset, ...more, expect: one("tau30-two-units").cases[0].expect.slice(0, 2) }] });
  await expectClean("the catalog caption base.js writes: numbers in authored text", asEntry(one("defaults")), tx(writesCaption));
  await expectCaught("a number the app appends to the catalog caption", "no-data-num", asEntry(one("defaults")), tx(patched(app(), (root) => { writeCaption(root); caption(root).append(" Seed 2025."); })));
  await expectCaught("a caption the app rewrites with a number", "no-data-num", asEntry(one("defaults")), tx(patched(app(), (root) => { caption(root).textContent = "Fixture data: 5 test points."; })));
  await expectClean("a case at a catalog preset (its v3 id), reached through base.js", presetCase("tau30-two"), tx(writesCaption));
  await expectClean("a preset and a spec: base.js applies the spec after the preset (units 3, not the preset's 2)", asEntry({ ...one("tau30-two-units"), cases: [{ id: "preset-spec", preset: "tau30-two", spec: { n: 3 }, expect: [one("tau30-two-units").cases[0].expect[0], { ...one("tau30-two-units").cases[0].expect[1], ref: "settings.cap3", value: 3 }] }] }), tx(writesCaption));
  await expectCaught("a preset that is not in the catalog entry", "case", presetCase("tau30"), tx(writesCaption));
  await expectCaught("a preset whose query names a key the app does not have", "query", presetCase("bad-key"), tx(writesCaption));
  await expectCaught("a preset base.js does not apply (the app lacks it)", "preset", presetCase("tau30-two"), tx(patched(app({ presets: [entryT.presets[1]] }), writeCaption)));
  await expectCaught("an app whose createWidget name is not its catalog name", "app", presetCase("tau30-two"), tx(patched(app({ name: "readout-app-v1" }), writeCaption)));
  await expectCaught("an update that names an unknown preset", "case", presetCase("tau30-two", { update: [{ preset: "tau40" }] }), tx(writesCaption));
  await expectCaught("a spec that names an unknown preset", "case", asEntry(withCase((c) => { c.spec = { preset: "tau40" }; })), tx(writesCaption));
  await expectCaught("formulas without \"math\": true in the catalog entry", "math", asEntry(one("defaults")), tx(writesCaption, drop(entryT, "math")));
  await expectCaught("an app that imports an expected-value source", "source", { ...one("defaults"), module: "verification/fixtures/readout-app/leaky-app.js" }, fx);

  // result labels and captions come from js/shared/labels.js, in their v3 wording
  const captionApp = (wording) => ({
    mountWidget(el, spec) {
      return appBase.createWidget(el, spec, {
        name: "caption-check", label: "Caption check",
        keys: { tau: { type: "number", min: 0.05, max: 0.5, value: 0.2 } },
        build(ctx) {
          return {
            render(s) {
              ctx.readout.set(["τ = ", ctx.num(s.tau, fmt.formatSetting(s.tau))]);
              const teaching = lab.captionNode(ctx, "teaching-posterior");
              if (wording) teaching.textContent = wording;
              ctx.caption.replaceChildren(teaching, "; ", lab.captionNode(ctx, "monte-carlo", { S: 1000, seed: 20261030 }));
            },
          };
        },
      });
    },
  });
  const v1teaching = (src.v1captions.captions ?? []).find((c) => c.id === "teaching-posterior")?.text ?? "";
  const capCase = (patch) => {
    const d = {
      app: "caption-check", catalog: null, module: "(memory)",
      cases: [{
        id: "captions", query: "",
        expect: [
          { select: "[data-prx-caption=\"teaching-posterior\"]", kind: "text", source: "literal", ref: "6.5", value: src.labels.captions["teaching-posterior"] },
          { select: "[data-prx-caption=\"monte-carlo\"]", kind: "text", slots: true, source: "literal", ref: "6.5", value: "Monte Carlo, ⟨S⟩ draws, seed ⟨seed⟩" },
          { select: "[data-prx-caption=\"monte-carlo\"] .prx-num", index: 1, about: "the seed", source: "registry", ref: "settings.seed.league", value: 20261030 },
        ],
      }],
    };
    patch?.(d.cases[0]);
    return d;
  };
  await expectClean("captions in their v3 wording (a template with slots)", capCase(), { module: captionApp() });
  await expectCaught("a caption literal in v1's wording", "case", capCase((c) => { c.expect[0].value = v1teaching; }), { module: captionApp(), match: /v3 reads/ });
  await expectCaught("v1's caption wording cited under another row (11.4)", "case", capCase((c) => { c.expect[0].ref = "11.4"; c.expect[0].value = v1teaching; }), { module: captionApp(v1teaching), match: /v3 reads/ });
  await expectCaught("an app that still shows v1's wording", "text", capCase(), { module: captionApp(v1teaching) });
  await expectCaught("a slotted 6.5 literal that is not a caption template", "case", capCase((c) => { c.expect[1].value = "Monte Carlo with ⟨S⟩ draws"; }), { module: captionApp() });

  // engine-computed apps: oracle, golden and registry sources, clean and with a planted mistake
  const pairApp = {
    mountWidget(el, spec) {
      return appBase.createWidget(el, spec, {
        name: "pair-check", label: "Pair check",
        keys: { muA: { type: "number", value: 0 }, sdA: { type: "number", min: 0, value: 1 }, muB: { type: "number", value: 0 }, sdB: { type: "number", min: 0, value: 1 } },
        build(ctx) {
          return {
            render(s) {
              const pi = pc.pairDirection(s.muA, s.sdA, s.muB, s.sdB);
              const span = ctx.num(pi, fmt.formatProb(pi));
              span.setAttribute("data-prx-readout", "pi");
              ctx.readout.set(["Pr(A above B) = ", span]);
            },
          };
        },
      });
    },
  };
  const piExpect = (row, value) => [{ select: "[data-prx-readout=\"pi\"]", format: { fn: "formatProb" }, source: "oracle", ref: { group: "oracle-pairwise", row, field: "pi" }, value }];
  const pairCase = {
    app: "pair-check", catalog: null, module: "(memory)",
    cases: [
      { id: "eq-means", query: "?muA=.4&sdA=.2&muB=.4&sdB=.3", expect: piExpect("pairDirection-eq-means", 0.5) },
      { id: "a-above", query: "?muA=1.2&sdA=.2&muB=.95&sdB=.2", expect: piExpect("pairDirection-A-above", 0.811620441094209) },
    ],
  };
  await expectClean("an oracle-sourced app", pairCase, { module: pairApp });
  await expectCaught("an app that computes from the wrong inputs", "raw", { ...pairCase, cases: [{ id: "a-above", query: "?muA=1.2&sdA=.2&muB=.95&sdB=.6", expect: piExpect("pairDirection-A-above", 0.811620441094209) }] }, { module: pairApp });
  const riskRow = src.golden("postrank-report-risk").rows.find((r) => r.id === "evaluateReport-pr_tutorial-one-tau.2-112233");
  const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
  const riskApp = (tauShift) => ({
    mountWidget(el, spec) {
      return appBase.createWidget(el, spec, {
        name: "risk-check", label: "Risk check",
        keys: { tau: { type: "number", min: 0.05, max: 0.5, value: 0.2 } },
        build(ctx) {
          return {
            render(s) {
              const ev = pc.evaluateReport(riskRow.args.g, { ...riskRow.args.E, e: toNaN(riskRow.args.E.e) }, { tau: s.tau + tauShift, w: riskRow.args.w });
              const r = ctx.num(ev.risk, fmt.formatRisk(ev.risk));
              r.setAttribute("data-prx-readout", "risk");
              const n = ctx.num(ev.N, fmt.formatCount(ev.N));
              n.setAttribute("data-prx-readout", "N");
              ctx.readout.set(["risk ", r, "; N = ", n]);
            },
          };
        },
      });
    },
  });
  const riskCase = {
    app: "risk-check", catalog: null, module: "(memory)",
    cases: [{
      id: "tutorial-112233", query: "?tau=.2",
      expect: [
        { select: "[data-prx-readout=\"risk\"]", format: { fn: "formatRisk" }, source: "golden", ref: { group: "postrank-report-risk", row: riskRow.id, field: "risk" }, value: 0.0416516399454871 },
        { select: "[data-prx-readout=\"N\"]", format: { fn: "formatCount" }, source: "golden", ref: { group: "postrank-report-risk", row: riskRow.id, field: "N" }, value: 12 },
        { select: "[data-prx-readout=\"risk\"]", format: { fn: "formatRisk" }, source: "registry", ref: "six.A.cap3.tau20.risk", value: 0.04165163994548712 },
      ],
    }],
  };
  await expectClean("a golden- and registry-sourced app", riskCase, { module: riskApp(0) });
  await expectCaught("an app that computes at a different τ (off by more than tol)", "raw", riskCase, { module: riskApp(0.01) });

  // asynchronous apps: aria-busy is waited for; an app that never finishes fails
  const asyncApp = (finish) => ({
    mountWidget(el, spec) {
      return appBase.createWidget(el, spec, {
        name: "async-check", label: "Async check",
        keys: { tau: { type: "number", min: 0.05, max: 0.5, value: 0.2 } },
        build(ctx) {
          return {
            render(s) {
              ctx.root.setAttribute("aria-busy", "true");
              ctx.readout.set(["τ = …"]);
              if (finish) ctx.timeout(() => { ctx.readout.set(["τ = ", ctx.num(s.tau, fmt.formatSetting(s.tau))]); ctx.root.removeAttribute("aria-busy"); }, 30);
            },
          };
        },
      });
    },
  });
  const asyncCase = { app: "async-check", catalog: null, module: "(memory)", cases: [{ id: "busy", query: "?tau=.30", expect: [{ select: "[data-prx-part~=\"readout\"] .prx-num", format: { fn: "formatSetting" }, source: "registry", ref: "settings.tau30", value: 0.3 }] }] };
  await expectClean("an aria-busy app is waited for", asyncCase, { module: asyncApp(true) });
  planted += 1;
  try {
    const m = await mountCase({ module: asyncApp(false), query: "", timeout: 60 });
    m.close();
    failures.push("fault \"an app that stays aria-busy\" not caught");
  } catch (e) {
    if (/aria-busy/.test(e.message)) { caught += 1; note("an app that stays aria-busy", { rule: "mount", text: e.message }); }
    else failures.push(`fault "an app that stays aria-busy" failed differently: ${e.message}`);
  }

  // the frozen registry: intact as copied; an edited, deleted or added file is caught
  cleanTotal += 1;
  if (src.integrity.length === 0) clean += 1;
  else failures.push(`the frozen registry is not intact: ${src.integrity.join(" | ")}`);
  const real = (r) => readFileSync(join(ROOT, CONFIG.registry, r));
  const realList = () => listFiles(join(ROOT, CONFIG.registry));
  const edited = Buffer.concat([real("numbers.json"), Buffer.from(" ")]);
  const rehashed = (() => {
    const m = JSON.parse(real(CONFIG.manifest).toString("utf8"));
    m.files["numbers.json"].sha256 = createHash("sha256").update(edited).digest("hex");
    return Buffer.from(JSON.stringify(m, null, 1));
  })();
  const tampered = [
    ["a frozen value edited (numbers.json)", { read: (r) => (r === "numbers.json" ? edited : real(r)), list: realList }],
    ["a frozen value edited together with its hash in MANIFEST.json", { read: (r) => (r === "numbers.json" ? edited : r === CONFIG.manifest ? rehashed : real(r)), list: realList }],
    ["a frozen file deleted (captions.json)", { read: (r) => { if (r === "captions.json") throw new Error("ENOENT"); return real(r); }, list: () => realList().filter((f) => f !== "captions.json") }],
    ["a file added to the frozen folder", { read: real, list: () => [...realList(), "numbers-v3.json"] }],
  ];
  for (const [name, io] of tampered) {
    planted += 1;
    const p = registryIntegrity(io);
    if (p.length) { caught += 1; note(name, { rule: "registry", text: p[0] }); }
    else failures.push(`fault "${name}" not caught by the registry check`);
  }
  cleanTotal += 1;
  const finder = registryIntegrity({ read: real, list: () => [...realList(), ".DS_Store", "spec/.DS_Store"] });
  if (finder.length === 0) clean += 1;
  else failures.push(`a Finder .DS_Store in the frozen folder is reported: ${finder.join(" | ")}`);

  // a v3 wording that keeps v1's text inside it retires only the exact old string (labels.js as if v3 extended it)
  const extended = { ...src, labels: { ...src.labels, captions: { ...src.labels.captions, "fixed-tiers": "fixed tiers, not optimized for this posterior" } } };
  for (const [name, x] of [
    ["the extended v3 wording itself", { select: "x", source: "literal", ref: "6.5", value: "fixed tiers, not optimized for this posterior" }],
    ["a heading that contains v1's (extended) phrase", { select: "x", source: "literal", ref: "11.4", value: "Risk of the fixed tiers, not optimized, at each τ" }],
  ]) {
    cleanTotal += 1;
    const p = resolveExpectation(x, extended).problems;
    if (p.length === 0) clean += 1;
    else failures.push(`clean literal "${name}" has problems: ${p.join(" | ")}`);
  }
  planted += 1;
  const exact = resolveExpectation({ select: "x", source: "literal", ref: "6.5", value: "fixed tiers, not optimized" }, extended).problems;
  if (exact.some((p) => /v3 reads/.test(p))) { caught += 1; note("v1's exact wording of an extended caption", { rule: "case", text: exact[0] }); }
  else failures.push(`fault "v1's exact wording of an extended caption" not caught: ${exact.join(" | ") || "no problems"}`);

  // file selection: --changed and --only
  const docs = {
    "verification/readouts/a.json": { app: "two-units", catalog: "1.8" },
    "verification/readouts/b.json": { app: "price-of-silence", catalog: "2.4" },
    "verification/readouts/c.json": { app: "readout-app", catalog: null, module: "verification/fixtures/readout-app/readout-app.js" },
  };
  const files = Object.keys(docs);
  const [fa, fb, fc] = files;
  // the real import closures, except that price-of-silence is made to import a helper of report-card (an app that
  // exports functions for its siblings)
  const closure = (d) => (d.app === "price-of-silence" ? new Set([...closureOf(d), "js/apps/report-card.js"]) : closureOf(d));
  const map = (changed) => filesForChanged(changed, files, (f) => docs[f], closure);
  const mapCases = [
    [["js/apps/two-units.js"], [fa]],
    [["catalog/entries/2.4-price-of-silence.json"], [fb]],
    [["verification/readouts/b.json", "js/apps/two-units.js"], [fa, fb]],
    [["verification/fixtures/readout-app/readout-app.js"], [fc]],
    [["js/apps/report-card.js"], [fb]],
    [["js/shared/labels.js"], files],
    [["verification/v1-registry/numbers.json"], files],
    [["verification/golden/oracle-pairwise.json"], files],
    [["catalog.json"], files],
    [["verification/readouts/_schema.json"], files],
    [["pages/uncertainty/two-units.qmd", "log/x.qmd", "js/bundles/two-units.js"], []],
  ];
  for (const [changed, want] of mapCases) {
    planted += 1;
    const got = map(changed);
    if (JSON.stringify(got) === JSON.stringify(want)) caught += 1;
    else failures.push(`--changed ${changed.join(",")}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  const known = (n) => ["two-units", "two-scores"].includes(n);
  const onlyCases = [
    ["two-units", { files: ["verification/readouts/two-units.json"] }],
    ["two-scores", { files: [], note: "two-scores has no read-out case file yet (verification/readouts/two-scores.json)" }],
    ["no-such-app", { error: "--only no-such-app: no catalog app and no case file has that name" }],
  ];
  for (const [name, want] of onlyCases) {
    planted += 1;
    const got = filesForOnly(name, { files: ["verification/readouts/two-units.json"], known });
    if (JSON.stringify(got) === JSON.stringify(want)) caught += 1;
    else failures.push(`--only ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }

  for (const f of failures) console.error(`  ${f}`);
  const ok = failures.length === 0 && caught === planted && clean === cleanTotal;
  console.log(`check_readouts self-test: caught ${caught}/${planted} planted faults, ${clean}/${cleanTotal} clean cases passed: ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

// ---------------------------------------------------------------------------------------------- main

async function main(argv) {
  const opt = { files: [], changed: null, only: null, quiet: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") opt.selfTest = true;
    else if (a === "--quiet") opt.quiet = true;
    else if (a === "--verbose") opt.verbose = true;
    else if (a === "--changed" || a === "--only") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) { console.error(`check_readouts: ${a} needs a value`); return 2; }
      opt[a.slice(2)] = v;
    } else if (a.startsWith("--")) { console.error(`check_readouts: unknown option ${a}`); return 2; }
    else opt.files.push(a);
  }
  if (opt.selfTest) return (await selfTest({ verbose: opt.verbose })) ? 0 : 1;
  let files;
  let none = "no read-out case files yet (verification/readouts/<app>.json)";
  if (opt.only !== null) {
    const r = filesForOnly(opt.only);
    if (r.error) { console.error(`check_readouts: ${r.error}`); return 2; }
    files = r.files;
    if (r.note) none = r.note;
  } else if (opt.changed !== null) {
    if (!existsSync(opt.changed)) { console.error(`check_readouts: no such file ${opt.changed}`); return 2; }
    files = filesForChanged(readFileSync(opt.changed, "utf8").split("\n").filter(Boolean));
    none = "no read-out case file is touched by the changed files";
  } else if (opt.files.length) files = opt.files.map((f) => rel(resolve(f)));
  else files = caseFiles();
  if (!files.length) {
    const integrity = registryIntegrity();
    for (const p of integrity) console.log(`  registry: ${p}`);
    console.log(`check_readouts: ${none}; the frozen v1 registry is ${integrity.length ? `not intact (${integrity.length} problem(s))` : "intact"}: ${integrity.length ? "FAIL" : "PASS"}`);
    return integrity.length ? 1 : 0;
  }
  const src = await loadSources();
  const t0 = Date.now();
  const results = [];
  if (src.integrity.length) results.push({ file: CONFIG.registry, counts: { cases: 0, expectations: 0, numbers: 0 }, findings: src.integrity.map((p) => finding(CONFIG.registry, null, "registry", "", p)) });
  for (const f of files) {
    let d;
    try { d = readJson(f); } catch (e) { results.push({ file: f, counts: { cases: 0, expectations: 0, numbers: 0 }, findings: [finding(f, null, "case-file", "", `cannot read: ${e.message}`)] }); continue; }
    results.push({ file: f, ...(await checkCaseFile(d, { file: f, src })) });
  }
  const t = print(results, opt.quiet);
  const ok = t.findings === 0;
  console.log(`check_readouts: ${files.length} case file(s), ${t.cases} case(s), ${t.expectations} expectation(s), ${t.numbers} number(s) with data-num (${((Date.now() - t0) / 1000).toFixed(1)} s); ${t.findings} finding(s): ${ok ? "PASS" : "FAIL"}`);
  return ok ? 0 : 1;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { console.error(`check_readouts: ${err.stack ?? err.message}`); process.exit(1); });
}
