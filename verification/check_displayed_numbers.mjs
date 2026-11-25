#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Displayed-number verifier:
// Evaluates widgets across the catalog state roster (default + presets + distinct try queries) via widget_harness.mjs
// and verifies every [data-num] element:
//   1. nested-data-num: no [data-num] element contains another [data-num] descendant.
//   2. bad-data-num: data-num is non-empty and parses as finite float(s), BigInt, canonical rational p/q, or "NA".
//   3. bare-zero: no finite nonzero scalar in a non-axis-tick context displays bare zero
//      ("0", ".000", ".000000", "0%").
//   4. display-mismatch: numerical agreement between data-num raw value and visible text (3 sig figs, fixed decimals,
//      percents, scientific notation, "below ...", "above ...", integers, exact rationals, tuples).
//   5. v2-readout-precision: readouts and captions use three significant figures except for exact values,
//      control settings and the precision exceptions in verification/near-tie-exceptions.json.
//   6. named-role-count and named-role-value: every state has a portable contract for the exact numeric
//      nodes of each named role. New roles, missing roles, duplicates and changes in their values fail.
//
// Usage:
//   node verification/check_displayed_numbers.mjs [--only app1,app2] [--quiet]
//   node verification/check_displayed_numbers.mjs --selftest

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  describe,
  displayProblem,
  exactElementDisplayProblem,
  parseDataNum,
  parseExactDataNum,
} from "./dom_rules.mjs";
import { makeWindow } from "./dom-env.mjs";
import { loadCatalog, mountCase, ROOT } from "./widget_harness.mjs";
import { createWidget } from "../js/shared/base.js";
import {
  formatCount,
  formatReadoutEst,
  formatReadoutExpected,
  formatReadoutProb,
  formatReadoutRisk,
  formatSetting,
} from "../js/shared/format.js";

const BARE_ZERO_RE = /^[-−+]?(?:0+(?:\.0+)?|\.0+)%?$/u;
const AXIS_TICK_SELECTOR = 'g[aria-label*="axis"], g[aria-label*="tick"], .tick';
const FLOAT_SCI_RE = /^[+−-]?(?:(\d+(?:\.\d+)?)|(\.\d+))[eE][+−-]?\d+%?$/u;
const FLOAT_DEC_RE = /^[+−-]?(?:(\d+)\.(\d+)|\.(\d+))%?$/u;
const PLAIN_INT_RE = /^[+−-]?\d[\d,]*%?$/u;
const BOUNDARY_RE = /^(?:below |above |<|>)/u;
const FRACTION_RE = /^[+−-]?\d+\/\d+$/u;

function loadAppsFromCatalogSources(rootDir = ROOT) {
  const sitePath = path.join(rootDir, "catalog", "site.json");
  const entriesDir = path.join(rootDir, "catalog", "entries");
  if (!fs.existsSync(sitePath) || !fs.existsSync(entriesDir)) {
    return loadCatalog().apps ?? [];
  }
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  const partOrder = new Map((site.parts ?? []).map((p, i) => [p.key, i]));
  return fs
    .readdirSync(entriesDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(entriesDir, f), "utf8")))
    .sort((a, b) => {
      const pa = partOrder.get(a.part) ?? 999;
      const pb = partOrder.get(b.part) ?? 999;
      if (pa !== pb) return pa - pb;
      const na = Number(String(a.id ?? "").split(".")[1] ?? 0);
      const nb = Number(String(b.id ?? "").split(".")[1] ?? 0);
      if (na !== nb) return na - nb;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
}

export function statesForApp(app) {
  const states = [{ state: "default", query: "" }];
  const presetQueries = new Set([""]);
  const presetIds = new Set();
  for (const p of app.presets ?? []) {
    states.push({ state: `preset:${p.id}`, query: `?preset=${p.id}` });
    presetQueries.add(String(p.query ?? "").replace(/^\?/, ""));
    presetIds.add(p.id);
  }
  const seenTry = new Set();
  for (const t of app.try ?? []) {
    const baseQ = t.query ? String(t.query).replace(/^\?/, "") : t.preset ? `preset=${t.preset}` : "";
    const openSuffix = Array.isArray(t.open) && t.open.length ? `open=${t.open.join(",")}` : "";
    const q = [baseQ, openSuffix].filter(Boolean).join("&");
    if (!q) continue;
    const m = /^preset=([^&]+)$/.exec(q);
    if (m && presetIds.has(m[1])) continue;
    if (presetQueries.has(q) || seenTry.has(q)) continue;
    seenTry.add(q);
    states.push({ state: `query:${q}`, query: `?${q}` });
  }
  return states;
}

function readFixture(name, rootDir = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "verification", name), "utf8"));
}

function expectedRoles(appContract, state) {
  const states = appContract?.states;
  if (!states || !Object.hasOwn(states, state)) throw new Error(`No named numeric-role contract for ${state}`);
  const entry = states[state];
  const roles = typeof entry === "string" && Object.hasOwn(states, entry) ? states[entry] : entry;
  if (!roles || typeof roles !== "object" || Array.isArray(roles) || !Object.keys(roles).length) {
    throw new Error(`Invalid named numeric-role contract for ${state}`);
  }
  return { roles, replacements: appContract.replacements?.[state] ?? [] };
}

function isFormulaElement(el) {
  return Boolean(el.classList?.contains("prx-math-label") || el.querySelector?.("math"));
}

function floatPrecisionStats(text) {
  const s = text.trim();
  const sci = FLOAT_SCI_RE.exec(s);
  if (sci) {
    const mant = (sci[1] ?? sci[2]).replace(".", "");
    const sig = mant.replace(/^0+/, "");
    const dec = ((sci[1] ?? sci[2]).split(".")[1] ?? "").length;
    return { isFloat: true, sigFigs: Math.max(1, sig.length), decimals: dec, isSci: true };
  }
  const decMatch = FLOAT_DEC_RE.exec(s);
  if (decMatch) {
    const intPart = decMatch[1] ?? "";
    const fracPart = decMatch[2] ?? decMatch[3] ?? "";
    const allDigits = (intPart + fracPart).replace(/^0+/, "");
    return {
      isFloat: true,
      sigFigs: allDigits.length === 0 ? 1 : allDigits.length,
      decimals: fracPart.length,
      isSci: false,
    };
  }
  return { isFloat: false, sigFigs: 0, decimals: 0, isSci: false };
}

function matchesNearTieException(el, stateId, text, declared) {
  const exList = declared?.nearTieExceptions;
  if (!exList) return { exempt: false, maxSig: 3 };
  if (exList === true) return { exempt: true, maxSig: 8 };
  if (!Array.isArray(exList)) return { exempt: false, maxSig: 3 };
  const hook = el.getAttribute("data-prx-readout") ?? "";
  for (const ex of exList) {
    if (typeof ex === "string") {
      if (ex === hook || ex === stateId || ex === text) return { exempt: true, maxSig: 8 };
      try {
        if (el.matches?.(ex)) return { exempt: true, maxSig: 8 };
      } catch {
        // ignore non-selector string
      }
    } else if (ex && typeof ex === "object") {
      const stateOk = !ex.state || ex.state === stateId;
      const hookOk = !ex.hook || ex.hook === hook;
      let selectOk = true;
      if (ex.select) {
        try {
          selectOk = Boolean(el.matches?.(ex.select));
        } catch {
          selectOk = false;
        }
      }
      if (stateOk && hookOk && selectOk) {
        return { exempt: true, maxSig: typeof ex.maxSig === "number" ? ex.maxSig : 8 };
      }
    }
  }
  return { exempt: false, maxSig: 3 };
}

function rawValuesAgree(actualDn, expectedDn) {
  if (actualDn === expectedDn) return true;
  const pa = parseDataNum(actualDn);
  const pb = parseDataNum(expectedDn);
  if (!pa.ok || !pb.ok) return false;
  if (typeof pa.value === "number" && typeof pb.value === "number") {
    return Math.abs(pa.value - pb.value) <= 1e-12 * Math.max(1, Math.abs(pb.value));
  }
  return false;
}

// Each role is an ordered sequence. A role on a text-only heading is outside the numeric contract.
function inspectNamedRoles(el, state, contract) {
  const found = new Map();
  for (const node of el.querySelectorAll("[data-prx-readout][data-num]")) {
    const role = node.getAttribute("data-prx-readout");
    if (!found.has(role)) found.set(role, []);
    found.get(role).push(node.getAttribute("data-num"));
  }
  const problems = [];
  const add = (rule, role, text) => problems.push({ rule, state, where: `[data-prx-readout="${role}"]`, text });
  const compare = (role, expected) => {
    const actual = found.get(role) ?? [];
    if (!Array.isArray(expected) || expected.some(value => !parseDataNum(value).ok)) {
      throw new Error(`Invalid expected raw values for ${role} in ${state}`);
    }
    if (actual.length !== expected.length) {
      add("named-role-count", role, `expected ${expected.length} numeric node(s), found ${actual.length}`);
      return;
    }
    for (const [i, value] of actual.entries()) {
      if (!rawValuesAgree(value, expected[i])) {
        add("named-role-value", role, `node ${i + 1} has data-num="${value}", expected "${expected[i]}"`);
      }
    }
  };
  const { roles, replacements } = contract;
  for (const [role, values] of Object.entries(roles)) compare(role, values);
  for (const role of found.keys()) {
    if (!Object.hasOwn(roles, role)) compare(role, []);
  }
  for (const { role, expectedCount, replacement, values } of replacements) {
    if ((roles[role]?.length ?? 0) !== expectedCount || !Object.hasOwn(roles, replacement) || !values?.length) {
      throw new Error(`Inconsistent replacement contract for ${role} in ${state}`);
    }
    compare(replacement, values);
  }
  return problems;
}

/**
 * Inspect all [data-num] elements inside a mounted widget container `el`.
 * Returns { numCount, findings }.
 */
export function inspectWidgetNumbers(
  el,
  {
    stateId = "default",
    stateValues = [],
    declared = null,
    roleContract = null,
  } = {}
) {
  const widgetRoot = el.matches?.(".prx-widget") ? el : el.querySelector?.(".prx-widget") ?? el;
  const isV2 =
    widgetRoot.getAttribute?.("data-prx-frame") === "v2" ||
    Boolean(el.querySelector?.('[data-prx-frame="v2"]'));

  const findings = [];
  const allNums = [
    ...(el.matches?.("[data-num]") ? [el] : []),
    ...el.querySelectorAll("[data-num]"),
  ];

  for (const node of allNums) {
    const where = describe(node, widgetRoot);
    const dn = node.getAttribute("data-num");
    const text = (node.textContent ?? "").trim();

    // 1. Nested [data-num] check
    const nestedChild = node.querySelector?.("[data-num]");
    if (nestedChild) {
      findings.push({
        rule: "nested-data-num",
        state: stateId,
        where,
        text: `[data-num="${dn}"] contains nested descendant [data-num="${nestedChild.getAttribute("data-num")}"]`,
      });
    }

    // 2. Valid data-num attribute grammar
    if (dn === null || dn.trim() === "") {
      findings.push({
        rule: "bad-data-num",
        state: stateId,
        where,
        text: `empty data-num attribute on "${text}"`,
      });
      continue;
    }
    const parsed = parseDataNum(dn);
    const exactFormat = node.getAttribute("data-prx-format") === "mdomain-exact";
    if (!parsed.ok || (exactFormat && dn !== "NA" && !parseExactDataNum(dn))) {
      findings.push({
        rule: "bad-data-num",
        state: stateId,
        where,
        text: `invalid data-num="${dn}" on "${text}"`,
      });
      continue;
    }

    // 3. Bare-zero check for finite nonzero scalars outside axis ticks
    const inAxisTick = Boolean(node.closest?.(AXIS_TICK_SELECTOR));
    if (!inAxisTick && !parsed.list) {
      const isNonZeroScalar =
        (typeof parsed.value === "number" && Number.isFinite(parsed.value) && parsed.value !== 0) ||
        (typeof parsed.value === "bigint" && parsed.value !== 0n) ||
        (typeof parsed.value === "string" && parsed.value !== "0");
      if (isNonZeroScalar && BARE_ZERO_RE.test(text)) {
        // Legacy 3.5.0 unmigrated chart.hiddenTable (.prx-data-table) uses axis tickLabel / fixed-decimal
        // column formatters before Track A's chart.js update and frame="v2" app migration.
        // Visible tables/readouts/cards fail in both v1 and v2; migrated frame="v2" apps fail in .prx-data-table too.
        const legacyHiddenTable = !isV2 && Boolean(node.closest?.(".prx-data-table"));
        if (!legacyHiddenTable) {
          findings.push({
            rule: "bare-zero",
            state: stateId,
            where,
            text: `nonzero data-num="${dn}" displayed as bare zero "${text}"`,
          });
        }
      }
    }

    // 4. Numerical agreement between data-num and displayed text
    if (exactFormat) {
      const prob = exactElementDisplayProblem(node);
      if (prob) {
        findings.push({
          rule: "display-mismatch",
          state: stateId,
          where,
          text: `${prob} (data-num="${dn}")`,
        });
      }
    } else if (isFormulaElement(node)) {
      if (!parsed.list) {
        const tokens = [...text.matchAll(/[+−-]?(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+−-]?\d+)?%?/gu)].map((m) => m[0]);
        if (!tokens.some((tok) => displayProblem(tok, parsed) === null)) {
          findings.push({
            rule: "display-mismatch",
            state: stateId,
            where,
            text: `formula "${text}" contains no token agreeing with data-num="${dn}"`,
          });
        }
      }
    } else {
      const prob = displayProblem(text, parsed);
      if (prob) {
        findings.push({
          rule: "display-mismatch",
          state: stateId,
          where,
          text: `${prob} (data-num="${dn}")`,
        });
      }
    }

    // 5. Migrated frame="v2" 3-sig-fig readout & caption policy
    if (isV2 && !parsed.list && !isFormulaElement(node)) {
      const inReadoutOrCaption = Boolean(
        node.closest?.('[data-prx-part~="readout"], [data-prx-part~="caption"]')
      );
      if (inReadoutOrCaption) {
        const isNa = parsed.value === null;
        const isExactInt =
          (typeof parsed.value === "bigint" || Number.isInteger(parsed.value)) && PLAIN_INT_RE.test(text);
        const isExactRational =
          exactFormat || typeof parsed.value === "string" || FRACTION_RE.test(text);
        const isBoundary = BOUNDARY_RE.test(text);
        const isControlSetting =
          typeof parsed.value === "number" &&
          stateValues.some((sv) => typeof sv === "number" && sv === parsed.value && formatSetting(sv) === text);

        if (!isNa && !isExactInt && !isExactRational && !isBoundary && !isControlSetting) {
          const stats = floatPrecisionStats(text);
          if (stats.isFloat) {
            const nearTie = matchesNearTieException(node, stateId, text, declared);
            const maxSig = nearTie.exempt ? nearTie.maxSig : 3;
            const maxDec = nearTie.exempt ? Math.max(6, nearTie.maxSig + 2) : 6;
            if (stats.sigFigs > maxSig || stats.decimals > maxDec) {
              findings.push({
                rule: "v2-readout-precision",
                state: stateId,
                where,
                text: `v2 readout/caption number "${text}" (data-num="${dn}") has ${stats.sigFigs} sig figs / ${stats.decimals} decimals (limit ${maxSig} sig figs; see verification/near-tie-exceptions.json)`,
              });
            }
          }
        }
      }
    }
  }

  if (roleContract) findings.push(...inspectNamedRoles(el, stateId, roleContract));

  return { numCount: allNums.length, findings };
}

export async function checkAppStates(app, { contracts, exceptions, rootDir = ROOT } = {}) {
  const appContract = (contracts ?? readFixture("fixtures/numeric-roles.json", rootDir).apps)[app.name];
  const mod = `js/apps/${app.name}.js`;
  const declared = (exceptions ?? readFixture("near-tie-exceptions.json", rootDir))[app.name];
  const states = statesForApp(app);
  const findings = [];
  let numCount = 0;

  const roster = new Set(states.map(item => item.state));
  for (const state of Object.keys(appContract?.states ?? {})) {
    if (!roster.has(state)) throw new Error(`${app.name}: unused numeric-role state ${state}`);
  }

  for (const item of states) {
    const roleContract = expectedRoles(appContract, item.state);
    let m;
    try {
      m = await mountCase({ module: mod, query: item.query });
    } catch (err) {
      findings.push({
        rule: "mount",
        state: item.state,
        where: "",
        text: err.message,
      });
      continue;
    }
    try {
      const stateObj = m.handle?.state ?? m.initial?.state ?? {};
      const stateValues = Object.values(stateObj);
      const res = inspectWidgetNumbers(m.el, {
        stateId: item.state,
        stateValues,
        declared,
        roleContract,
      });
      numCount += res.numCount;
      findings.push(...res.findings);
    } finally {
      m.close();
    }
  }

  return {
    id: app.id,
    name: app.name,
    states: states.length,
    numbers: numCount,
    findings,
  };
}

export async function selfTest({ quiet = false } = {}) {
  const failures = [];
  let planted = 0;
  let caught = 0;
  let cleanChecks = 0;
  let cleanPassed = 0;

  // Build a clean v2 synthetic widget and verify it passes cleanly
  const makeSyntheticV2 = (mutate, roleContract = null) => {
    const env = makeWindow({ plot: false });
    const handle = createWidget(env.el, {}, {
      name: "selftest-v2-widget",
      keys: { tau: { type: "number", min: 0.05, max: 0.5, value: 0.2 } },
      build(ctx) {
        ctx.root.setAttribute("data-prx-frame", "v2");
        const tbl = ctx.h(
          "table",
          {},
          ctx.h(
            "tbody",
            {},
            ctx.h("tr", {}, ctx.h("td", { "data-test-cell": "small" }, ctx.num(3e-7, formatReadoutExpected(3e-7))))
          )
        );
        ctx.charts.append(tbl);
        return {
          render(s) {
            const p = ctx.num(0.76025, formatReadoutProb(0.76025));
            p.setAttribute("data-test-prob", "");
            p.setAttribute("data-prx-readout", "posterior-probability");
            const lo = ctx.num(0.0004, formatReadoutProb(0.0004));
            const hi = ctx.num(0.9996, formatReadoutProb(0.9996));
            const r = ctx.num(0.008513, formatReadoutRisk(0.008513, { signed: true }));
            r.setAttribute("data-test-risk", "");
            r.setAttribute("data-prx-readout", "expected-risk");
            const n = ctx.num(435, formatCount(435));
            const t = ctx.num(s.tau, formatSetting(s.tau));
            const est = ctx.num(-0.2714, formatReadoutEst(-0.2714));
            ctx.readout.set(["At τ = ", t, " (", n, " pairs), prob ", p, " (", lo, ", ", hi, "), ΔR = ", r, ", θ = ", est, "."]);
          },
        };
      },
    });
    mutate?.(env.el, env.doc);
    const res = inspectWidgetNumbers(env.el, {
      stateId: "selftest",
      roleContract,
      stateValues: Object.values(handle.state),
    });
    handle.destroy();
    env.restore();
    return res;
  };

  // Clean synthetic v2 check
  cleanChecks += 1;
  const cleanSyn = makeSyntheticV2(null);
  if (cleanSyn.findings.length === 0) cleanPassed += 1;
  else failures.push(`clean synthetic v2 widget had findings: ${JSON.stringify(cleanSyn.findings)}`);

  const expectDefect = (label, expectedRule, mutate, contract) => {
    planted += 1;
    const res = makeSyntheticV2(mutate, contract);
    if (res.findings.some((f) => f.rule === expectedRule)) {
      caught += 1;
    } else {
      failures.push(
        `defect "${label}" did not trigger "${expectedRule}" (got: ${res.findings.map((f) => `${f.rule}: ${f.text}`).join("; ") || "none"})`
      );
    }
  };

  // (a) Nested [data-num]
  expectDefect("nested [data-num]", "nested-data-num", (el, doc) => {
    const target = el.querySelector("[data-test-prob]");
    const nested = doc.createElement("span");
    nested.setAttribute("data-num", "0.76025");
    nested.textContent = ".760";
    target.replaceChildren(nested);
  });

  // (b) Nonzero 3e-7 displayed as ".000000"
  expectDefect("nonzero 3e-7 shown as .000000", "bare-zero", (el) => {
    const cellSpan = el.querySelector("[data-test-cell='small'] [data-num]");
    cellSpan.setAttribute("data-num", "3e-7");
    cellSpan.textContent = ".000000";
  });

  // (c) Mismatched data-num="0.25" with text ".410"
  expectDefect("mismatched data-num=0.25 with .410", "display-mismatch", (el) => {
    const target = el.querySelector("[data-test-prob]");
    target.setAttribute("data-num", "0.25");
    target.textContent = ".410";
  });

  // (d) Undeclared 6-decimal float "+.008513" inside a data-prx-frame="v2" readout
  expectDefect("undeclared 6-decimal +.008513 in v2 readout", "v2-readout-precision", (el) => {
    const target = el.querySelector("[data-test-risk]");
    target.setAttribute("data-num", "0.008513");
    target.textContent = "+.008513";
  });

  const roleContract = {
    roles: { "posterior-probability": ["0.76025"], "expected-risk": ["0.008513"] },
    replacements: [],
  };
  expectDefect("removed named numeric role", "named-role-count", el => {
    el.querySelector("[data-test-prob]").remove();
  }, roleContract);
  expectDefect("removed numeric attribute", "named-role-count", el => {
    el.querySelector("[data-test-prob]").removeAttribute("data-num");
  }, roleContract);
  expectDefect("duplicate named role with identical value", "named-role-count", el => {
    const node = el.querySelector("[data-test-risk]");
    node.after(node.cloneNode(true));
  }, roleContract);
  expectDefect("value and text drift together", "named-role-value", el => {
    const node = el.querySelector("[data-test-risk]");
    node.setAttribute("data-num", "0.007");
    node.textContent = ".007";
  }, roleContract);
  expectDefect("unexpected named role", "named-role-count", el => {
    const extra = el.querySelector("[data-test-risk]").cloneNode(true);
    extra.setAttribute("data-prx-readout", "unexpected-role");
    el.querySelector("[data-test-risk]").after(extra);
  }, roleContract);
  const repeated = {
    roles: { ...roleContract.roles, "expected-risk": ["0.008513", "0.008513"] },
    replacements: [],
  };
  expectDefect("missing one of two required copies", "named-role-count", null, repeated);
  expectDefect("historical role replacement has another value", "named-role-value", null, {
    ...roleContract,
    replacements: [{ role: "previous-risk", expectedCount: 0, replacement: "expected-risk", values: ["0.01"] }],
  });
  cleanChecks += 1;
  if (!makeSyntheticV2(null, roleContract).findings.length) cleanPassed += 1;
  else failures.push("clean named-role contract failed");

  const apps = loadAppsFromCatalogSources();
  const contracts = readFixture("fixtures/numeric-roles.json").apps;
  const exceptions = readFixture("near-tie-exceptions.json");
  for (const sampleName of ["noisy-league", "two-units", "profile-dependence"]) {
    const app = apps.find((a) => a.name === sampleName);
    if (!app) {
      failures.push(`selftest sample app "${sampleName}" missing in catalog`);
      continue;
    }
    cleanChecks += 1;
    const res = await checkAppStates(app, { contracts, exceptions });
    if (res.findings.length === 0) cleanPassed += 1;
    else failures.push(`clean numeric-role app ${sampleName} failed: ${res.findings[0].text}`);
  }

  for (const f of failures) console.error(`  ${f}`);
  const ok = failures.length === 0 && caught === planted && cleanPassed === cleanChecks;
  if (!quiet || !ok) {
    console.log(
      `check_displayed_numbers --selftest: caught ${caught}/${planted} planted defects, ${cleanPassed}/${cleanChecks} clean checks passed: ${ok ? "PASS" : "FAIL"}`
    );
  }
  return ok;
}

async function main(argv) {
  let onlyRaw = null;
  let quiet = false;
  let runSelfTest = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--selftest" || a === "--self-test") runSelfTest = true;
    else if (a === "--quiet") quiet = true;
    else if (a === "--only") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) {
        console.error("check_displayed_numbers: --only requires a comma-separated app list");
        return 2;
      }
      onlyRaw = v;
    } else {
      console.error(`check_displayed_numbers: unknown option ${a}`);
      return 2;
    }
  }

  if (runSelfTest) {
    return (await selfTest({ quiet })) ? 0 : 1;
  }

  const allApps = loadAppsFromCatalogSources();
  let targetApps = allApps;
  if (onlyRaw !== null) {
    const tokens = onlyRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const missing = [];
    const picked = new Map();
    for (const tok of tokens) {
      const found = allApps.find((a) => a.name === tok || a.id === tok);
      if (!found) missing.push(tok);
      else picked.set(found.name, found);
    }
    if (missing.length) {
      console.error(`check_displayed_numbers: unknown --only app(s): ${missing.join(", ")}`);
      return 2;
    }
    targetApps = [...picked.values()];
  }

  const t0 = Date.now();
  const contracts = readFixture("fixtures/numeric-roles.json").apps;
  const exceptions = readFixture("near-tie-exceptions.json");
  const appNames = new Set(allApps.map(app => app.name));
  for (const name of Object.keys(contracts)) {
    if (!appNames.has(name)) throw new Error(`Unused numeric-role app ${name}`);
  }
  let totalStates = 0;
  let totalNumbers = 0;
  let totalFindings = 0;

  for (const app of targetApps) {
    const res = await checkAppStates(app, { contracts, exceptions });
    totalStates += res.states;
    totalNumbers += res.numbers;
    totalFindings += res.findings.length;
    if (!quiet || res.findings.length > 0) {
      console.log(
        `  ${res.id} ${res.name}: ${res.states} state(s), ${res.numbers} [data-num] node(s): ${res.findings.length ? `${res.findings.length} finding(s)` : "ok"}`
      );
    }
    for (const f of res.findings) {
      console.log(`    [${f.state}] ${f.rule}${f.where ? ` (${f.where})` : ""}: ${f.text}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = totalFindings === 0;
  console.log(
    `check_displayed_numbers: ${targetApps.length} app(s), ${totalStates} state(s), ${totalNumbers} [data-num] node(s) (${elapsed} s); ${totalFindings} finding(s): ${ok ? "PASS" : "FAIL"}`
  );
  return ok ? 0 : 1;
}

const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1] ?? "") === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`check_displayed_numbers: ${err.stack ?? err.message}`);
      process.exit(1);
    }
  );
}
