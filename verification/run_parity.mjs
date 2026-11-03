#!/usr/bin/env node
// Engine parity: compares every row of every golden group with the engine.
// One adapter per group in verification/parity.d/<group>.mjs:
//   export default { group, run(args, prCore) -> actual, tolerance: { field: { abs, rel } }, default: { abs, rel } }
// A row passes when every expected field matches: |a - e| <= abs + rel * |e| (numbers, element-wise for arrays),
// equality for strings, booleans and null. Fails on: missing golden or adapter, manifest checksum mismatch,
// a group with zero rows, a missing field, or any mismatch.
//   node verification/run_parity.mjs [--group name] [--json out.json]
//   node verification/run_parity.mjs --self-test
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GOLDEN = join(ROOT, "verification", "golden");
const PARITY = join(ROOT, "verification", "parity.d");
const ENGINE = join(ROOT, "js", "pr-core.js");

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
// JSON for error messages; a BigInt in an engine result is shown as 123n instead of crashing the report.
const show = (v) => JSON.stringify(v, (k, x) => (typeof x === "bigint" ? `${x}n` : x));

function close(a, e, tol, path, errs) {
  if (e === null || typeof e === "string" || typeof e === "boolean") {
    if (a !== e) errs.push(`${path}: expected ${show(e)}, got ${show(a)}`);
    return;
  }
  if (typeof e === "number") {
    if (typeof a !== "number" || Number.isNaN(a)) { errs.push(`${path}: expected number ${e}, got ${show(a)}`); return; }
    if (!Number.isFinite(e)) { if (a !== e) errs.push(`${path}: expected ${e}, got ${a}`); return; }
    const bound = tol.abs + tol.rel * Math.abs(e);
    if (Math.abs(a - e) > bound) errs.push(`${path}: expected ${e}, got ${a} (diff ${Math.abs(a - e).toExponential(2)} > ${bound.toExponential(2)})`);
    return;
  }
  if (Array.isArray(e)) {
    if (!Array.isArray(a) || a.length !== e.length) { errs.push(`${path}: expected array of ${e.length}, got ${show(a)?.slice(0, 60)}`); return; }
    e.forEach((x, i) => close(a[i], x, tol, `${path}[${i}]`, errs));
    return;
  }
  if (typeof e === "object") {
    if (a === null || typeof a !== "object") { errs.push(`${path}: expected object, got ${show(a)}`); return; }
    for (const [k, v] of Object.entries(e)) {
      if (!(k in a)) { errs.push(`${path}.${k}: missing in engine result`); continue; }
      close(a[k], v, tol, `${path}.${k}`, errs);
    }
  }
}

export async function checkGroup(golden, manifest, adapter, prCore) {
  const errs = [];
  if (!golden) return { errs: ["golden file missing"], compared: 0 };
  if (!manifest) errs.push("manifest fragment missing");
  else if (manifest.sha256 !== golden.sha256) errs.push("manifest checksum does not match the golden file");
  const rows = golden.body.rows ?? [];
  if (!rows.length) errs.push("golden group has zero rows");
  let compared = 0;
  for (const row of rows) {
    let actual;
    try { actual = await adapter.run(row.args, prCore); } catch (err) { errs.push(`${row.id}: engine threw ${err.message}`); continue; }
    for (const [field, expect] of Object.entries(row.expect)) {
      const tol = { abs: 0, rel: 0, ...(adapter.default ?? {}), ...(adapter.tolerance?.[field] ?? {}) };
      if (!(field in (actual ?? {}))) { errs.push(`${row.id}.${field}: missing in engine result`); continue; }
      close(actual[field], expect, tol, `${row.id}.${field}`, errs);
      compared += 1;
    }
  }
  if (rows.length && compared === 0) errs.push("no field was compared");
  return { errs, compared };
}

function loadGolden(group) {
  const path = join(GOLDEN, `${group}.json`);
  if (!existsSync(path)) return null;
  return { body: JSON.parse(readFileSync(path, "utf8")), sha256: sha256(path) };
}

function loadManifest(group) {
  const path = join(GOLDEN, "manifest.d", `${group}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

async function selfTest() {
  const prCore = { twice: (x) => 2 * x };
  const adapter = { group: "t", run: (args, pc) => ({ y: pc.twice(args.x) }), default: { abs: 1e-12, rel: 1e-12 } };
  const mk = (rows, sha = "s") => ({ body: { rows }, sha256: sha });
  const good = mk([{ id: "a", args: { x: 1 }, expect: { y: 2 } }]);
  const ok = await checkGroup(good, { sha256: "s" }, adapter, prCore);
  if (ok.errs.length || ok.compared !== 1) { console.error("self-test: a clean group failed", ok.errs); process.exit(1); }
  const faults = [
    ["value off", mk([{ id: "a", args: { x: 1 }, expect: { y: 2.001 } }]), { sha256: "s" }],
    ["checksum mismatch", good, { sha256: "other" }],
    ["zero rows", mk([]), { sha256: "s" }],
    ["missing field", mk([{ id: "a", args: { x: 1 }, expect: { z: 2 } }]), { sha256: "s" }],
    ["missing manifest", good, null],
  ];
  let caught = 0;
  for (const [label, g, m] of faults) {
    const r = await checkGroup(g, m, adapter, prCore);
    if (r.errs.length) caught += 1; else console.error(`self-test: missed "${label}"`);
  }
  console.log(`run_parity self-test: caught ${caught}/${faults.length}`);
  process.exit(caught === faults.length ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  const only = args.includes("--group") ? args[args.indexOf("--group") + 1] : null;
  const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
  if (!existsSync(ENGINE)) { console.error("run_parity: js/pr-core.js not built"); process.exit(1); }
  const prCore = await import(pathToFileURL(ENGINE).href);
  const adapters = existsSync(PARITY) ? readdirSync(PARITY).filter((f) => f.endsWith(".mjs")).sort() : [];
  const report = [];
  let failures = 0, compared = 0;
  for (const file of adapters) {
    const adapter = (await import(pathToFileURL(join(PARITY, file)).href)).default;
    if (only && adapter.group !== only) continue;
    const res = await checkGroup(loadGolden(adapter.group), loadManifest(adapter.group), adapter, prCore);
    compared += res.compared;
    failures += res.errs.length;
    report.push({ group: adapter.group, compared: res.compared, failures: res.errs.length, errors: res.errs.slice(0, 20) });
    console.log(`${res.errs.length ? "FAIL" : "ok  "} ${adapter.group}: ${res.compared} comparisons, ${res.errs.length} failures`);
    for (const e of res.errs.slice(0, 10)) console.log(`     ${e}`);
  }
  // Every golden group must have an adapter (no silent skips).
  const goldenGroups = readdirSync(GOLDEN).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const covered = new Set(report.map((r) => r.group));
  for (const g of goldenGroups) if (!only && !covered.has(g) && !g.endsWith("-selftest")) { failures += 1; console.log(`FAIL ${g}: no parity adapter`); }
  if (!report.length) { console.error("run_parity: no adapters ran"); failures += 1; }
  // CONTRACT 7.2: every exported numerical function needs golden rows (args.fn) unless it is exempt.
  if (!only) {
    const EXEMPT = new Set(JSON.parse(readFileSync(join(ROOT, "verification", "parity-exempt.json"), "utf8")).exempt);
    const tested = new Set();
    for (const g of goldenGroups) for (const row of loadGolden(g)?.body.rows ?? []) if (row.args?.fn) tested.add(row.args.fn);
    for (const a of adapters) { const ad = (await import(pathToFileURL(join(PARITY, a)).href)).default; for (const f of ad.functions ?? []) tested.add(f); }
    const untested = Object.keys(prCore).filter((k) => typeof prCore[k] === "function" && !tested.has(k) && !EXEMPT.has(k)).sort();
    if (untested.length) { failures += untested.length; console.log(`FAIL coverage: ${untested.length} exported function(s) without golden rows: ${untested.join(", ")}`); }
    else console.log("ok   coverage: every exported numerical function has golden rows or an exemption");
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ compared, failures, groups: report }, null, 1));
  console.log(`run_parity: ${report.length} groups, ${compared} comparisons, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
