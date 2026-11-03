#!/usr/bin/env node
// Data contract check (CONTRACT 2.7, 7.5, 8.7, 12.1) for data/released/ and data/precomputed/.
//   node verification/check_data_contract.mjs              check the files on disk
//   node verification/check_data_contract.mjs --self-test  inject faults in memory and require every one to be caught
//                                                           (--verbose lists every error each fault raises)
//
// Checks, against data/released/data_contract.json:
//   - every data/released/*.json (except the contract) and data/precomputed/*.json is declared, and every declared file
//     exists; every .js in data/released is the twin of a declared file (or the contract's own twin);
//   - the structure of each file (facts keys; table fields and row counts; array member shapes; GeoJSON feature
//     properties) equals the contract's `structure`, and the primary table's fields and rows equal `fields` and `rows`;
//     table columns have equal lengths; arrays are rectangular; probability cubes (e, b, t, d) have a null diagonal and
//     off-diagonal values in [0, 1], with ids and criteria matching their shape;
//   - sha256 and bytes of every file (and of every twin) match;
//   - license_scope is one of the five known scopes and defined in the contract; the file repeats the contract's scope,
//     attribution, change notice and notice; every required notice phrase of the scope is present; author files are
//     synthetic and carry no upstream block; other scopes list upstream source, terms and fields that exist in the file;
//   - no key at any depth matches a forbidden individual-level pattern (student, pupil, respondent, person, child) or a
//     historical rights field (the frozen objects' FALSE clearance fields are never exported as current status);
//   - each .js twin is a classic script `window.PRX_DATA = window.PRX_DATA || {}; window.PRX_DATA["<key>"] = <json>;`
//     whose value equals the JSON; the contract's twin equals the contract without `created`;
//   - each runtime asset's twin is at most runtime_asset_max_bytes and GeoJSON at most geojson_max_bytes; the total of
//     the runtime assets is reported.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = "data/released";
const PRE = "data/precomputed";
const CONTRACT = `${REL}/data_contract.json`;
const CONTRACT_TWIN = `${REL}/data_contract.js`;
const KNOWN_SCOPES = ["author", "cde-source-conditions", "cc-by-nc-krw", "cc-by-4.0-atlas", "public-domain-census"];
const TWIN_HEAD = "window.PRX_DATA = window.PRX_DATA || {};";
const PROB_MEMBERS = new Set(["e", "b", "t", "d"]);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// ---- structure (mirrors structure_of() in r-export/20_export_teaching.R) --------------------------------------------
const shapeOf = (x) => (Array.isArray(x) ? (x.length ? [x.length, ...shapeOf(x[0])] : [0]) : []);
const rectangular = (x, shape) => (shape.length === 0 ? !Array.isArray(x)
  : Array.isArray(x) && x.length === shape[0] && x.every((c) => rectangular(c, shape.slice(1))));
export function structureOf(o, prefix = "") {
  const out = {};
  if (o.features) {
    out.features = { kind: "features", fields: Object.keys(o.features[0]?.properties ?? {}), rows: o.features.length,
      geometry: [...new Set(o.features.map((f) => f.geometry?.type))] };
  }
  if (o.facts) out[`${prefix}facts`] = { kind: "facts", fields: Object.keys(o.facts) };
  for (const [t, tb] of Object.entries(o.tables ?? {})) {
    out[`${prefix}tables.${t}`] = { kind: "table", fields: Object.keys(tb), rows: (Object.values(tb)[0] ?? []).length };
  }
  for (const [a, m] of Object.entries(o.arrays ?? {})) {
    const members = {};
    for (const [nm, v] of Object.entries(m)) if (Array.isArray(v)) members[nm] = shapeOf(v);
    out[`${prefix}arrays.${a}`] = { kind: "array", members };
  }
  for (const [k, an] of Object.entries(o.analyses ?? {})) Object.assign(out, structureOf(an, `${prefix}analyses.${k}.`));
  return out;
}

function tableAndArrayErrors(o, name, prefix = "") {
  const errors = [];
  for (const [t, tb] of Object.entries(o.tables ?? {})) {
    const lens = Object.entries(tb).map(([c, v]) => [c, Array.isArray(v) ? v.length : -1]);
    if (lens.some(([, n]) => n < 0)) errors.push(`${name}: ${prefix}tables.${t}: a column is not an array`);
    else if (new Set(lens.map(([, n]) => n)).size > 1) errors.push(`${name}: ${prefix}tables.${t}: columns differ in length`);
  }
  for (const [a, m] of Object.entries(o.arrays ?? {})) {
    for (const [nm, v] of Object.entries(m)) {
      if (!Array.isArray(v)) continue;
      const sh = shapeOf(v);
      if (!rectangular(v, sh)) { errors.push(`${name}: ${prefix}arrays.${a}.${nm} is not rectangular`); continue; }
      if (PROB_MEMBERS.has(nm) && sh.length === 3) {
        const [K, n, n2] = sh;
        if (n !== n2) errors.push(`${name}: ${prefix}arrays.${a}.${nm} is not K x n x n`);
        if (Array.isArray(m.ids) && m.ids.length !== n) errors.push(`${name}: ${prefix}arrays.${a}: ids length ${m.ids.length} differs from n = ${n}`);
        if (Array.isArray(m.criteria) && m.criteria.length !== K) errors.push(`${name}: ${prefix}arrays.${a}: criteria length differs from K = ${K}`);
        let diag = 0, range = 0;
        for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n2; j++) {
          const x = v[k][i][j];
          if (i === j) { if (x !== null) diag++; } else if (typeof x !== "number" || !(x >= 0 && x <= 1)) range++;
        }
        if (diag) errors.push(`${name}: ${prefix}arrays.${a}.${nm}: ${diag} diagonal entries are not null`);
        if (range) errors.push(`${name}: ${prefix}arrays.${a}.${nm}: ${range} off-diagonal entries are not probabilities in [0, 1]`);
      }
    }
  }
  for (const [k, an] of Object.entries(o.analyses ?? {})) errors.push(...tableAndArrayErrors(an, name, `${prefix}analyses.${k}.`));
  return errors;
}

function allKeys(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}

function evalTwin(text) {
  const sandbox = { window: {} };
  vm.runInNewContext(text, sandbox, { timeout: 10000 });
  return sandbox.window.PRX_DATA;
}

function upstreamFieldExists(structure, path) {
  const cut = path.lastIndexOf(".");
  if (cut < 0) return false;
  const head = path.slice(0, cut), field = path.slice(cut + 1), s = structure[head];
  if (!s) return false;
  if (s.kind === "features") return field === "geometry" || s.fields.includes(field);
  if (s.kind === "array") return Object.hasOwn(s.members, field);
  return (s.fields ?? []).includes(field);
}

// ---- one declared file ------------------------------------------------------------------------------------------------
function checkFile(name, spec, files, contract, kind) {
  const errors = [];
  const path = spec.path;
  const buf = files.get(path);
  if (!buf) return { errors: [`${name}: declared (${path}) but missing`], twinBytes: 0 };
  let data;
  try { data = JSON.parse(buf.toString("utf8")); } catch (e) { return { errors: [`${name}: not valid JSON (${e.message})`], twinBytes: 0 }; }
  // bytes and hash
  if (sha256(buf) !== spec.sha256) errors.push(`${name}: sha256 ${sha256(buf).slice(0, 12)} differs from the contract ${String(spec.sha256).slice(0, 12)}`);
  if (buf.length !== spec.bytes) errors.push(`${name}: ${buf.length} bytes, contract says ${spec.bytes}`);
  // header repeated in the file
  for (const f of ["key", "title", "level", "license_scope", "attribution", "change_notice", "notice"]) {
    if (data[f] !== spec[f]) errors.push(`${name}: file field "${f}" differs from the contract`);
  }
  if (`${spec.key}.json` !== name) errors.push(`${name}: key "${spec.key}" does not match the file name`);
  // sources
  if (!Array.isArray(spec.sources) || !spec.sources.length || spec.sources.some((s) => !s.object || !s.path)) {
    errors.push(`${name}: sources must list the source object and path`);
  }
  // scope, notices, upstream
  const scopes = contract.license_scopes ?? {};
  const sc = spec.license_scope;
  if (!KNOWN_SCOPES.includes(sc) || !scopes[sc]) errors.push(`${name}: unknown license_scope "${sc}"`);
  else {
    const text = `${spec.attribution ?? ""} ${spec.notice ?? ""}`.toLowerCase();
    const req = scopes[sc].required_notice ?? [];
    if (!req.length) errors.push(`${name}: scope "${sc}" defines no required notice`);
    for (const r of req) if (!text.includes(String(r).toLowerCase())) errors.push(`${name}: required notice "${r}" of scope "${sc}" is missing`);
  }
  if (!spec.change_notice || spec.change_notice.length < 20) errors.push(`${name}: change notice missing`);
  if (sc === "author") {
    if (spec.level !== "synthetic") errors.push(`${name}: author scope on ${spec.level}-level data`);
    if (spec.upstream) errors.push(`${name}: author scope with an upstream block`);
  } else {
    if (spec.level === "synthetic") errors.push(`${name}: scope "${sc}" on synthetic data`);
    const up = spec.upstream;
    if (!up || !up.source || !up.terms || !Array.isArray(up.fields) || !up.fields.length) {
      errors.push(`${name}: scope "${sc}" needs upstream source, terms and fields`);
    }
  }
  // structure
  const st = structureOf(data);
  if (!same(st, spec.structure ?? {})) {
    const want = spec.structure ?? {};
    const paths = [...new Set([...Object.keys(st), ...Object.keys(want)])].filter((p) => !same(st[p], want[p]));
    errors.push(`${name}: structure differs from the contract at ${paths.slice(0, 4).join(", ")}`);
  }
  const prim = st[spec.primary];
  if (!prim) errors.push(`${name}: primary "${spec.primary}" not found`);
  else {
    if (!same(prim.fields, spec.fields)) errors.push(`${name}: fields of ${spec.primary} differ from the contract`);
    if (prim.rows !== spec.rows) errors.push(`${name}: ${prim.rows} rows in ${spec.primary}, contract says ${spec.rows}`);
  }
  for (const u of spec.upstream?.fields ?? []) if (!upstreamFieldExists(st, u)) errors.push(`${name}: upstream field "${u}" is not in the file`);
  errors.push(...tableAndArrayErrors(data, name));
  // forbidden keys
  const forbidden = (contract.forbidden_field_patterns ?? []).map((p) => new RegExp(p, "i"));
  const rights = (contract.forbidden_rights_key_patterns ?? []).map((p) => new RegExp(p, "i"));
  const keys = allKeys(data);
  for (const k of keys) {
    if (forbidden.some((re) => re.test(k))) errors.push(`${name}: forbidden individual-level field "${k}"`);
    if (rights.some((re) => re.test(k))) errors.push(`${name}: historical rights field "${k}" (not exported as current status)`);
  }
  // GeoJSON size
  if (data.features && buf.length > contract.geojson_max_bytes) errors.push(`${name}: GeoJSON ${buf.length} bytes exceeds ${contract.geojson_max_bytes}`);
  // twin
  let twinBytes = 0;
  if (kind === "released") {
    const tb = files.get(spec.twin);
    if (!spec.twin || !tb) errors.push(`${name}: .js twin missing`);
    else {
      twinBytes = tb.length;
      if (sha256(tb) !== spec.twin_sha256 || tb.length !== spec.twin_bytes) errors.push(`${name}: twin sha256 or bytes differ from the contract`);
      const text = tb.toString("utf8");
      if (!text.startsWith(TWIN_HEAD)) errors.push(`${name}: twin does not start with "${TWIN_HEAD}"`);
      try {
        const reg = evalTwin(text);
        const ks = Object.keys(reg ?? {});
        if (ks.length !== 1 || ks[0] !== spec.key) errors.push(`${name}: twin registers [${ks.join(", ")}], expected ["${spec.key}"]`);
        else if (JSON.stringify(reg[spec.key]) !== JSON.stringify(data)) errors.push(`${name}: .js twin data differ from the JSON`);
      } catch (e) { errors.push(`${name}: twin does not run as a classic script (${e.message})`); }
      if (spec.runtime_asset && tb.length > contract.runtime_asset_max_bytes) {
        errors.push(`${name}: runtime asset ${tb.length} bytes exceeds ${contract.runtime_asset_max_bytes}`);
      }
    }
  }
  return { errors, twinBytes };
}

// ---- everything -----------------------------------------------------------------------------------------------------------
export function checkAll(files) {
  const errors = [];
  const cbuf = files.get(CONTRACT);
  if (!cbuf) return { errors: [`${CONTRACT} missing`], rows: [] };
  const contract = JSON.parse(cbuf.toString("utf8"));
  for (const s of KNOWN_SCOPES) if (!contract.license_scopes?.[s]) errors.push(`contract: license scope "${s}" not defined`);
  const decl = Object.entries(contract.files ?? {});
  const pre = Object.entries(contract.precomputed ?? {});
  const declaredPaths = new Set([...decl, ...pre].map(([, s]) => s.path));
  const twinPaths = new Set(decl.map(([, s]) => s.twin));
  for (const p of files.keys()) {
    if (p.startsWith(`${REL}/`) && p.endsWith(".json") && p !== CONTRACT && !declaredPaths.has(p)) errors.push(`${p}: present but not declared in the contract`);
    if (p.startsWith(`${PRE}/`) && p.endsWith(".json") && !declaredPaths.has(p)) errors.push(`${p}: present but not declared in the contract`);
    if (p.startsWith(`${REL}/`) && p.endsWith(".js") && p !== CONTRACT_TWIN && !twinPaths.has(p)) errors.push(`${p}: a .js file that is not the twin of a declared file`);
  }
  const rows = [];
  for (const [name, spec] of decl) {
    if (spec.path !== `${REL}/${name}`) errors.push(`${name}: contract path "${spec.path}" is not ${REL}/${name}`);
    const r = checkFile(name, spec, files, contract, "released");
    errors.push(...r.errors);
    rows.push({ name, bytes: spec.bytes, twinBytes: r.twinBytes, rows: spec.rows, scope: spec.license_scope, runtime: Boolean(spec.runtime_asset) });
  }
  for (const [name, spec] of pre) {
    if (spec.path !== `${PRE}/${name}`) errors.push(`${name}: contract path "${spec.path}" is not ${PRE}/${name}`);
    const r = checkFile(name, spec, files, contract, "precomputed");
    errors.push(...r.errors.map((e) => `precomputed ${e}`));
    rows.push({ name: `precomputed/${name}`, bytes: spec.bytes, twinBytes: 0, rows: spec.rows, scope: spec.license_scope, runtime: false });
  }
  // the contract's own twin
  const ct = files.get(CONTRACT_TWIN);
  if (!ct) errors.push(`${CONTRACT_TWIN}: contract twin missing`);
  else {
    try {
      const reg = evalTwin(ct.toString("utf8"));
      const want = { ...contract };
      for (const k of contract.contract_twin_omits ?? []) delete want[k];
      if (!reg || JSON.stringify(reg["data-contract"]) !== JSON.stringify(want)) errors.push(`${CONTRACT_TWIN}: contract twin differs from the contract (apart from ${(contract.contract_twin_omits ?? []).join(", ")})`);
    } catch (e) { errors.push(`${CONTRACT_TWIN}: contract twin does not run (${e.message})`); }
  }
  return { errors, rows, contract };
}

function loadDisk() {
  const files = new Map();
  for (const dir of [REL, PRE]) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const n of readdirSync(abs)) {
      const p = join(abs, n);
      if (statSync(p).isFile() && !n.startsWith(".")) files.set(`${dir}/${n}`, readFileSync(p));
    }
  }
  return files;
}

// ---- self-test: faults injected in memory -----------------------------------------------------------------------------
const twinOf = (key, obj) => Buffer.from(`${TWIN_HEAD}\nwindow.PRX_DATA["${key}"] = ${JSON.stringify(obj)};\n`);
function editContract(files, edit) {
  const c = JSON.parse(files.get(CONTRACT).toString("utf8"));
  edit(c);
  files.set(CONTRACT, Buffer.from(JSON.stringify(c, null, 1)));
  const t = { ...c };
  for (const k of c.contract_twin_omits ?? []) delete t[k];
  files.set(CONTRACT_TWIN, twinOf("data-contract", t));
}
// change one released file, keep its twin and the contract's hashes consistent (so only the targeted check can fire)
function editFile(files, name, edit, { keepTwin = false, specEdit = null, structure = false } = {}) {
  const path = `${REL}/${name}`;
  const obj = JSON.parse(files.get(path).toString("utf8"));
  edit(obj);
  const buf = Buffer.from(JSON.stringify(obj));
  files.set(path, buf);
  const twin = keepTwin ? files.get(path.replace(/\.json$/, ".js")) : twinOf(obj.key, obj);
  files.set(path.replace(/\.json$/, ".js"), twin);
  editContract(files, (c) => {
    const s = c.files[name];
    s.sha256 = sha256(buf); s.bytes = buf.length; s.twin_sha256 = sha256(twin); s.twin_bytes = twin.length;
    if (structure) { s.structure = structureOf(obj); const p = s.structure[s.primary]; if (p) { s.fields = p.fields; s.rows = p.rows; } }
    if (specEdit) specEdit(s);
  });
}

function selfTest() {
  const base = loadDisk();
  const clean = checkAll(base);
  if (clean.errors.length) {
    console.error("data contract self-test: the files on disk do not pass; fix them first");
    for (const e of clean.errors.slice(0, 10)) console.error(`  FAIL ${e}`);
    process.exit(1);
  }
  const clone = () => new Map([...base].map(([k, v]) => [k, Buffer.from(v)]));
  const faults = [
    ["dropped column", /structure differs|fields of tables\.units differ/, (f) =>
      editFile(f, "case-cde.json", (o) => { delete o.tables.units.observed_rate; })],
    ["wrong sha256", /sha256 .* differs from the contract/, (f) =>
      editContract(f, (c) => { c.files["six-sites.json"].sha256 = "0".repeat(64); })],
    ["missing scope notice", /required notice "Noncommercial"/, (f) =>
      editFile(f, "case-krw.json", (o) => { o.notice = o.notice.replace("Noncommercial use only (CC-BY-NC). ", ""); },
        { specEdit: (s) => { s.notice = s.notice.replace("Noncommercial use only (CC-BY-NC). ", ""); } })],
    ["forbidden column", /forbidden individual-level field "child_count"/, (f) =>
      editFile(f, "case-alabama.json", (o) => { o.tables.units.child_count = o.tables.units.mean_income; }, { structure: true })],
    ["twin mismatch", /\.js twin data differ from the JSON/, (f) => {
      const p = `${REL}/thirty-sites.json`; const o = JSON.parse(f.get(p).toString("utf8")); o.arrays.gaussian.e[0][0][1] = 0.5;
      const tw = twinOf(o.key, o); f.set(p.replace(/\.json$/, ".js"), tw);
      editContract(f, (c) => { c.files["thirty-sites.json"].twin_sha256 = sha256(tw); c.files["thirty-sites.json"].twin_bytes = tw.length; });
    }],
    ["oversize runtime asset", /runtime asset \d+ bytes exceeds/, (f) =>
      editFile(f, "case-cde.json", (o) => { o.facts.padding = "x".repeat(400001); }, { structure: true })],
    ["undeclared file", /extra\.json: present but not declared/, (f) => { f.set(`${REL}/extra.json`, Buffer.from("{}")); }],
    ["author scope on case data", /author scope on school-level data/, (f) =>
      editFile(f, "case-cde.json", (o) => { o.license_scope = "author"; o.notice = `${o.notice} CC BY 4.0`; },
        { specEdit: (s) => { s.license_scope = "author"; s.notice = `${s.notice} CC BY 4.0`; } })],
    ["upstream field not in the file", /upstream field "tables\.units\.no_such_column"/, (f) =>
      editContract(f, (c) => { c.files["case-krw.json"].upstream.fields.push("tables.units.no_such_column"); })],
    ["historical rights field", /historical rights field "public_distribution_cleared"/, (f) =>
      editFile(f, "case-cde.json", (o) => { o.facts.public_distribution_cleared = false; }, { structure: true })],
    ["non-null diagonal", /diagonal entries are not null/, (f) =>
      editFile(f, "six-sites.json", (o) => { o.arrays.one.e[0][0][0] = 0; })],
    ["unknown scope", /unknown license_scope "cc-by-sa"/, (f) =>
      editFile(f, "toy.json", (o) => { o.license_scope = "cc-by-sa"; }, { specEdit: (s) => { s.license_scope = "cc-by-sa"; } })],
    ["frozen league changed", /precomputed league-30\.json: sha256/, (f) => {
      const p = `${PRE}/league-30.json`; f.set(p, Buffer.from(f.get(p).toString("utf8").replace('"seed":20261030', '"seed":20261031')));
    }],
    ["contract twin mismatch", /contract twin differs/, (f) => {
      const t = f.get(CONTRACT_TWIN).toString("utf8"); f.set(CONTRACT_TWIN, Buffer.from(t.replace('"package":"postrank 1.1.0"', '"package":"postrank 1.0.0"')));
    }],
    ["declared file missing", /case-alabama\.json: declared .* but missing/, (f) => { f.delete(`${REL}/case-alabama.json`); }],
  ];
  let caught = 0;
  for (const [label, want, inject] of faults) {
    const f = clone();
    inject(f);
    const { errors } = checkAll(f);
    const hit = errors.some((e) => want.test(e));
    if (hit) caught++;
    console.log(`  ${hit ? "caught" : "MISSED"}  ${label}${hit ? "" : `  (errors: ${errors.slice(0, 3).join(" | ") || "none"})`}`);
    if (process.argv.includes("--verbose")) for (const e of errors) console.log(`          ${e}`);
  }
  console.log(`check_data_contract self-test: caught ${caught}/${faults.length}`);
  process.exit(caught === faults.length ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--self-test")) selfTest();
  const { errors, rows } = checkAll(loadDisk());
  const kb = (n) => (n / 1000).toFixed(1).padStart(7);
  console.log("file                          JSON KB   twin KB   rows  scope                  runtime");
  for (const r of rows) console.log(`${r.name.padEnd(28)} ${kb(r.bytes)}  ${r.twinBytes ? kb(r.twinBytes) : "      -"}  ${String(r.rows).padStart(5)}  ${r.scope.padEnd(22)} ${r.runtime ? "yes" : ""}`);
  const rt = rows.filter((r) => r.runtime);
  const total = rows.reduce((s, r) => s + r.bytes, 0);
  console.log(`runtime assets: ${rt.length}, ${(rt.reduce((s, r) => s + r.twinBytes, 0) / 1000).toFixed(1)} KB in total (largest ${Math.max(...rt.map((r) => r.twinBytes), 0) / 1000} KB; limit ${400} KB each)`);
  console.log(`released and precomputed JSON: ${rows.length} files, ${(total / 1000).toFixed(1)} KB`);
  for (const e of errors) console.error(`  FAIL ${e}`);
  const scopes = rows.reduce((m, r) => ({ ...m, [r.scope]: (m[r.scope] ?? 0) + 1 }), {});
  console.log(errors.length ? `check_data_contract: FAIL (${errors.length})`
    : `check_data_contract: PASS (${rows.length} files; scopes ${Object.entries(scopes).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  process.exit(errors.length ? 1 : 0);
}
