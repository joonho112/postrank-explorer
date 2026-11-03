// The solver bundle in Chrome: js/shared/solver-loader.js fetches docs/js/bundles/solver.js only after a click, from
// file:// and over http, and HiGHS (in its blob-URL Worker) then finds the same risk as enumerating every report.
//   node verification/check_solver.mjs
// A probe page in verification/report/solver-check/ mirrors the site's layout (embed/ beside js/bundles/): its
// bundle holds the loader, the engine and the six sites; solver.js is the rendered site's copy, which must equal
// js/bundles/solver.js. Problems: six sites, one score and two scores (w = 1/2, 1/2), τ = .15, .25, .40, against
// exactOptimum over all 4,683 reports (the solver's upper risk within 1e-9 of it, its lower bound below; the grade one
// of the tied optima).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DOCS, ROOT, launchChrome, openTab, startServer } from "./browser.mjs";

const { build } = createRequire(join(ROOT, "engine", "package.json"))("esbuild");

const OUT = join(ROOT, "verification", "report", "solver-check");
const SOURCE = join(ROOT, "js", "bundles", "solver.js");
const RENDERED = join(DOCS, "js", "bundles", "solver.js");
const fails = [];
const fail = (m) => fails.push(m);

const PROBE_ENTRY = `
import { loadSolver } from "../js/shared/solver-loader.js";
import { exactOptimum } from "../js/pr-core.js";
import SIX from "../data/released/six-sites.json" with { type: "json" };
const nan = (a) => ({ ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((r) => r.map((v) => (v === null ? NaN : v)))) });
window.PROBE = {
  async run() {
    const solver = await loadSolver();
    const info = await solver.ready;
    const rows = [];
    for (const [name, E, w] of [["one score", nan(SIX.arrays.one), undefined], ["two scores", nan(SIX.arrays.two), [0.5, 0.5]]]) {
      for (const tau of [0.15, 0.25, 0.4]) {
        const r = await solver.mipSolve(E, w ? { tau, w } : { tau });
        const x = exactOptimum(E, w ? { tau, w } : { tau });
        rows.push({ name, tau, status: r.status, label: r.label, risk: r.upper, lower: r.lower, gap: r.gap, exact: x.risk, grade: r.grade, grades: x.grades, size: x.family.size });
      }
    }
    return { highs: info.highs, rows };
  },
};
`;

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>solver probe</title></head>
<body><button id="go" type="button">Solve</button>
<script src="../js/bundles/probe.js"></script>
<script>
document.getElementById("go").addEventListener("click", function () {
  PROBE.run().then(function (r) { window.__probe = { ok: true, result: r }; },
                   function (e) { window.__probe = { ok: false, error: String(e && e.message || e) }; });
});
</script>
</body></html>
`;

// ------------------------------------------------------------------------------------------- the probe site

if (!existsSync(RENDERED)) {
  console.error(`check_solver: ${RENDERED} is missing; render the site (quarto render) first`);
  process.exit(1);
}
if (!readFileSync(RENDERED).equals(readFileSync(SOURCE))) fail("docs/js/bundles/solver.js differs from js/bundles/solver.js (render the site)");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "embed"), { recursive: true });
mkdirSync(join(OUT, "js", "bundles"), { recursive: true });
const esbuildOpts = { bundle: true, format: "iife", target: "es2020", write: false, logLevel: "warning", minify: false };
const probe = await build({ ...esbuildOpts, stdin: { contents: PROBE_ENTRY, resolveDir: join(ROOT, "verification"), sourcefile: "probe.entry.js", loader: "js" } });
writeFileSync(join(OUT, "js", "bundles", "probe.js"), probe.outputFiles[0].text);
copyFileSync(RENDERED, join(OUT, "js", "bundles", "solver.js"));
writeFileSync(join(OUT, "embed", "probe.html"), PAGE);
// no page of the site names the solver bundle, so nothing fetches it on load (an app loads it on demand)
for (const f of ["catalog.html", "index.html"]) {
  const p = join(DOCS, f);
  if (existsSync(p) && readFileSync(p, "utf8").includes("solver.js")) fail(`${f} names solver.js`);
}

// ------------------------------------------------------------------------------------------------ in Chrome

const server = await startServer(OUT);
const browser = await launchChrome();
let total = 0;
try {
  for (const [how, url] of [["file://", pathToFileURL(join(OUT, "embed", "probe.html")).href], ["http", `${server.origin}/embed/probe.html`]]) {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin });
    const requested = [];
    page.on("request", (req) => requested.push(req.url()));
    await page.goto(url, { waitUntil: "load" });
    if (requested.some((u) => u.endsWith("/solver.js"))) fail(`${how}: solver.js was fetched before the click`);
    await page.click("#go");
    await page.waitForFunction(() => window.__probe !== undefined, { timeout: 60000 }).catch(() => fail(`${how}: no result within 60 s`));
    const out = await page.evaluate(() => window.__probe);
    if (!requested.some((u) => u.endsWith("/solver.js"))) fail(`${how}: solver.js was not fetched after the click`);
    if (!out?.ok) fail(`${how}: the probe failed: ${out?.error ?? "no result"}`);
    else {
      if (out.result.highs !== "1.15.4") fail(`${how}: HiGHS ${out.result.highs}, expected 1.15.4`);
      for (const r of out.result.rows) {
        total += 1;
        const where = `${how}: ${r.name}, τ ${r.tau}`;
        if (r.status !== "optimal" || r.label !== "optimal-within-solver-tolerances") fail(`${where}: status ${r.status}, label ${r.label}`);
        if (!(Math.abs(r.risk - r.exact) <= 1e-9)) fail(`${where}: solver risk ${r.risk} against ${r.exact} for the best of all ${r.size} reports`);
        if (!(r.lower <= r.risk + 1e-12) || !(r.gap >= 0)) fail(`${where}: bound ${r.lower} and gap ${r.gap} do not bracket the risk ${r.risk}`);
        if (!r.grades.some((g) => g.join() === r.grade.join())) fail(`${where}: the solver's grade ${r.grade.join("")} is not among the tied optima`);
      }
    }
    for (const e of errors) fail(`${how}: console: ${e}`);
    for (const f of failed) fail(`${how}: ${f}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (fails.length) {
  console.error(`check_solver: ${fails.length} failure(s)\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log(`check_solver: solver.js fetched only after the click; HiGHS in its Worker equals enumeration on ${total} problems (file:// and http): PASS`);
