#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Static code & copy policy verifier:
//   LINT-01: Zero app->app and zero shared->app module imports
//   LINT-02: Zero `new URL(..., import.meta.url).pathname` in scripts/verification (use fileURLToPath)
//   LINT-03: Zero `--prx-plot-muted` / `--prx-plot-fg` on non-plot chrome rules in migrated/shared CSS, and zero raw `--prx-crit-1|2` text color
//   LINT-04: Zero forbidden word `\bcertified\b` in product JS, pages, or catalog
//   LINT-05: Zero `setTimeout(..., 20)` stage-hop copies in migrated frame:"v2" apps
//   TSC:     TypeScript `checkJs` passes on `tsconfig.shared.json`
//
// Usage:
//   node verification/check_code_policy.mjs [--selftest] [--quiet]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ARGS = process.argv.slice(2);
const SELFTEST = ARGS.includes("--selftest");
const QUIET = ARGS.includes("--quiet");

const IMPORT_RE = /(?:^|[;\n])\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.\.?\/[^"']+)["']/g;

export function analyzeModuleSource(relPath, content) {
  const problems = [];
  const normRel = relPath.replace(/\\/g, "/");
  if (normRel === "verification/check_code_policy.mjs") return problems;
  const baseDir = dirname(join(ROOT, normRel));

  // LINT-01: zero -> js/apps/ imports from js/apps/ or js/shared/
  if (normRel.startsWith("js/apps/") || normRel.startsWith("js/shared/")) {
    for (const m of content.matchAll(IMPORT_RE)) {
      const spec = m[1];
      const target = relative(ROOT, normalize(join(baseDir, spec))).replace(/\\/g, "/");
      if (target.startsWith("js/apps/")) {
        problems.push(`[LINT-01] ${normRel}: forbidden import into js/apps/ (${spec} -> ${target})`);
      }
    }
  }

  // LINT-02: URL(...).pathname breaks workspace paths with spaces
  if ((normRel.startsWith("scripts/") || normRel.startsWith("engine/scripts/") || normRel.startsWith("verification/")) && !normRel.endsWith("check_code_policy.mjs")) {
    if (/new\s+URL\([^)]*import\.meta\.url[^)]*\)\.pathname/.test(content)) {
      problems.push(`[LINT-02] ${normRel}: use fileURLToPath(new URL(..., import.meta.url)) instead of .pathname`);
    }
  }

  // LINT-04: forbidden affirmative claim "certified" (exclude JS comments/regexes on JS files, and explicit negations "not/no/never ... certified")
  const isProductCopy =
    normRel.startsWith("pages/") ||
    normRel.startsWith("catalog/") ||
    normRel.startsWith("js/apps/") ||
    normRel.startsWith("js/shared/") ||
    normRel === "index.qmd" ||
    normRel === "catalog.qmd";
  if (isProductCopy && /\bcertified\b/i.test(content)) {
    const isJsFile = /\.(?:m?js|ts)$/.test(normRel);
    const baseText = isJsFile
      ? content
          .replace(/(^|[^:])\/\/.*$/gm, "$1")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[dgimsuvy]*/g, "")
      : content;
    const stripped = baseText.replace(/\b(?:no|not|never|without|neither|nor)\b[^.!?;]{0,80}\bcertified\b/gi, "");
    if (/\bcertified\b/i.test(stripped)) {
      problems.push(`[LINT-04] ${normRel}: forbidden word "certified" in product source`);
    }
  }

  // LINT-03 & LINT-05 on migrated v2 apps/domain modules, mdomain visual shell, and shared stylesheets
  const isV2 = /\b(?:frame|layout)\s*:\s*["']v2["']/.test(content);
  const checkStyleTokens =
    isV2 ||
    normRel === "js/shared/domain/cde.js" ||
    normRel === "js/shared/mdomain/visual.js" ||
    normRel === "styles/app.css" ||
    normRel === "styles/site.scss";
  if (checkStyleTokens) {
    for (const ruleMatch of content.matchAll(/([^{};]+)\{([^{}]+)\}/g)) {
      const sel = ruleMatch[1].trim();
      const body = ruleMatch[2];
      const isPlotSurface = /--prx-plot-bg|prx-light-panel|prx-chart-area|mdv-stage|prx-stage|prx-cd-box|prx-math-label|paper/i.test(sel + " " + body);
      if (!isPlotSurface && /(?:^|[;\s])color\s*:\s*var\(--prx-plot-(?:muted|fg)\)/.test(body)) {
        problems.push(`[LINT-03] ${normRel}: plot text token used on non-plot chrome selector "${sel.slice(-50)}"`);
      }
      if (/(?:^|[;\s])color\s*:\s*var\(--prx-crit-[12]\)/.test(body)) {
        problems.push(`[LINT-03] ${normRel}: raw --prx-crit-1/2 used as text color (use --prx-crit-ink-1/2)`);
      }
    }
  }
  if (isV2 && /\b(?:setTimeout|(?:ctx|scope)\.timeout)\s*\([^;]*?,\s*20\s*\)/.test(content)) {
    problems.push(`[LINT-05] ${normRel}: 20ms ad-hoc stage hop in v2 app (use ctx.scheduleStages)`);
  }

  return problems;
}

function walkFiles(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "vendor") continue;
      out.push(...walkFiles(full, exts));
    } else if (exts.some((e) => name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function runSelftest() {
  const cases = [
    { rel: "js/apps/fake.js", code: `import { x } from "./other.js";`, expect: "LINT-01" },
    { rel: "js/shared/domain/fake.js", code: `import { x } from "../../apps/other.js";`, expect: "LINT-01" },
    { rel: "scripts/fake.mjs", code: `const p = new URL(".", import.meta.url).pathname;`, expect: "LINT-02" },
    { rel: "js/apps/fake.js", code: `const x = { frame: "v2", css: ".note { color: var(--prx-plot-muted); }" };`, expect: "LINT-03" },
    { rel: "js/apps/fake.js", code: `const s = "This is a certified ranking.";`, expect: "LINT-04" },
    { rel: "js/apps/fake.js", code: `const x = { frame: "v2" }; setTimeout(step, 20);`, expect: "LINT-05" },
  ];
  for (const c of cases) {
    const found = analyzeModuleSource(c.rel, c.code);
    if (!found.some((p) => p.includes(c.expect))) {
      console.error(`SELFTEST FAIL: expected ${c.expect} on ${c.rel}, got:`, found);
      process.exit(1);
    }
  }
  const clean = analyzeModuleSource("js/apps/clean.js", `import { createWidget } from "../shared/base.js";\nexport function mountWidget(el, spec) { return createWidget(el, spec, { name: "clean", frame: "v2", css: ".paper { background: var(--prx-plot-bg); color: var(--prx-plot-fg); }", build() { return { render() {} }; } }); }`);
  if (clean.length) {
    console.error("SELFTEST FAIL: clean sample flagged:", clean);
    process.exit(1);
  }
  if (!QUIET) console.log("check_code_policy --selftest: PASS (6 synthetic defects caught, 0 false positives)");
}

if (SELFTEST) {
  runSelftest();
  process.exit(0);
}

runSelftest();

const files = [
  ...walkFiles(join(ROOT, "js/apps"), [".js"]),
  ...walkFiles(join(ROOT, "js/shared"), [".js"]),
  ...walkFiles(join(ROOT, "scripts"), [".mjs", ".js"]),
  ...walkFiles(join(ROOT, "engine/scripts"), [".mjs", ".js"]),
  ...walkFiles(join(ROOT, "verification"), [".mjs", ".js"]),
  ...walkFiles(join(ROOT, "styles"), [".css", ".scss"]),
  ...walkFiles(join(ROOT, "pages"), [".qmd"]),
  ...walkFiles(join(ROOT, "catalog/entries"), [".json"]),
  join(ROOT, "catalog/site-copy.json"),
  join(ROOT, "index.qmd"),
  join(ROOT, "catalog.qmd"),
].filter((p) => existsSync(p));

const problems = [];
for (const full of files) {
  const rel = relative(ROOT, full).replace(/\\/g, "/");
  problems.push(...analyzeModuleSource(rel, readFileSync(full, "utf8")));
}

// TypeScript checkJs on tsconfig.shared.json
const tscBin = join(ROOT, "engine/node_modules/typescript/bin/tsc");
const tsconfig = join(ROOT, "tsconfig.shared.json");
if (existsSync(tscBin) && existsSync(tsconfig)) {
  const res = spawnSync(process.execPath, [tscBin, "--noEmit", "-p", tsconfig], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    problems.push(`[TSC] tsconfig.shared.json failed:\n${(res.stdout || "") + (res.stderr || "")}`);
  }
} else {
  problems.push(`[TSC] missing typescript binary (${tscBin}) or tsconfig.shared.json`);
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`check_code_policy: ${problems.length} problem(s)`);
  process.exit(1);
}
if (!QUIET) console.log(`check_code_policy: PASS (${files.length} files checked, 0 app->app imports, tsc checkJs clean)`);
