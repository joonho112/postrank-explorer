// chosen-and-judged-ties.test.mjs (review 044 repair, Phase 4, group G-F2): app 2.18's headline states the range of
// its "look worse" count over every way of breaking the runs' tied selections (X-12, G4-F8). The app takes each run's
// tied draw-based optima from exactOptimum (maxTies Infinity); here the same tie sets are found independently, by
// enumerating every report of the family (all weak orders of the six sites, or those with at most three grades) and
// keeping those within the engine's equal-risk tolerance of the minimum. Review 044's verifier found, at the default
// setting (S 100, first seed 1, score A, τ .20, all reports), 14 tied runs and a count of 33 to 37 (artifacts/batches/G4,
// verify.json and verify2.json); the mounted read-out must say exactly that, from the engine, with data-num hooks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountCase, ROOT } from "../widget_harness.mjs";
import { drawErrors, errorArray, evaluateReport, gaussianDraws, selectionOnDraws } from "../../js/pr-core.js";
import { CONFIG as MC } from "../../js/apps/mc-error.js";
import { CONFIG, tieRange, tieRun } from "../../js/apps/chosen-and-judged.js";

const MODULE = "js/apps/chosen-and-judged.js";
const SIX = JSON.parse(readFileSync(`${ROOT}/data/released/six-sites.json`, "utf8"));
const U = SIX.tables.units, IDS = U.id, TOL = 1e-12;
const seedAt = (seed, run) => 1 + (seed - 1 + run - 1) % 4294967295;

function law(c) {
  const cols = MC.criteriaOf[c].map((k) => (k === "score_A" ? ["mean_A", "sd_A"] : ["mean_B", "sd_B"]));
  const means = IDS.map((_, i) => cols.map(([m]) => U[m][i])), sds = IDS.map((_, i) => cols.map(([, s]) => U[s][i]));
  return { means, sds, w: MC.weights[c], criteria: MC.criteriaOf[c], E: errorArray(means, sds, { ids: IDS, criteria: MC.criteriaOf[c] }) };
}

/** Every weak order of n units as a grade vector (grade 1 highest), optionally with at most G grades. */
function allReports(n, G = n) {
  const out = [];
  const grades = new Array(n).fill(1);
  const rec = (i) => {
    if (i === n) {
      // a grade vector is a report (a weak order) when the grades it uses are exactly 1..k
      const k = Math.max(...grades);
      if (k <= G && new Set(grades).size === k) out.push(grades.slice());
      return;
    }
    for (let g = 1; g <= n; g++) { grades[i] = g; rec(i + 1); }
  };
  rec(0);
  return out;
}

/** Independent tie sets: every report within TOL of the minimum draw-based risk, with its signed gap. */
function independentTies(s, L, family) {
  const Ehat = drawErrors(gaussianDraws(L.means, L.sds, s.S, s.seed), { ids: IDS, criteria: L.criteria });
  const scored = family.map((g) => ({ g, risk: evaluateReport(g, Ehat, { tau: s.tau, w: L.w }).risk }));
  const min = Math.min(...scored.map((x) => x.risk));
  const tied = scored.filter((x) => x.risk - min <= TOL);
  return tied.map((x) => x.risk - evaluateReport(x.g, L.E, { tau: s.tau, w: L.w }).risk);
}

test("2.18: weak orders of six units: 4,683 reports, 603 with at most three grades", () => {
  assert.equal(allReports(6).length, 4683);
  assert.equal(allReports(6, 3).length, 603);
});

test("2.18: tieRun finds every tied selection of each run; the default count ranges 33 to 37 over 14 tied runs", () => {
  const s0 = { S: 100, seed: 1, criteria: "A", tau: 0.2, cap: "none" };
  const L = law("A"), family = allReports(6);
  const rows = [], ties = [];
  let independentTied = 0, wmin = 0, wmax = 0;
  for (let i = 0; i < CONFIG.runs; i++) {
    const s = { ...s0, seed: seedAt(s0.seed, i + 1) };
    const r = selectionOnDraws(gaussianDraws(L.means, L.sds, s.S, s.seed), L.E, { tau: s.tau, w: L.w, family: { kind: "all" } });
    const t = tieRun(s);
    const gaps = independentTies(s, L, family);
    rows.push({ gap: r.gap });
    ties.push(t);
    // the same tie set as the independent enumeration, and the run's own report is its first member
    assert.equal(t.tieCount, gaps.length, `run ${i + 1}: tie count`);
    const appGaps = (t.gaps ?? [r.gap]).slice().sort((a, b) => a - b), indGaps = gaps.slice().sort((a, b) => a - b);
    appGaps.forEach((g, j) => assert.ok(Math.abs(g - indGaps[j]) < 1e-15, `run ${i + 1}: gap ${j}`));
    if (t.gaps) assert.ok(Math.abs(t.gaps[0] - r.gap) < 1e-15, `run ${i + 1}: the first tied report is the run's own`);
    if (gaps.length > 1) independentTied++;
    if (gaps.every((g) => g > 0)) wmin++;
    if (gaps.some((g) => g > 0)) wmax++;
  }
  const range = tieRange(rows, ties);
  assert.deepEqual(range, { tied: independentTied, worseMin: wmin, worseMax: wmax });
  assert.deepEqual(range, { tied: 14, worseMin: 33, worseMax: 37 }, "review 044 verifier (G4 verify2.json)");
  assert.equal(rows.filter((r) => r.gap > 0).length, 33, "the first representatives give 33");
});

test("2.18: the read-out states the range and the tie count (data-num hooks); the followed run's line names its tie", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=own" });
  try {
    const ro = m.root.querySelector(".prx-readout");
    const text = ro.textContent.replace(/\s+/g, " ").trim();
    assert.match(text, /67 look better on their own draws and 33 look worse \(33–37 depending on how the 14 tied selections are broken\); mean signed gap −\.00139\./);
    const raw = (hook) => Number(m.root.querySelector(`[data-prx-readout="${hook}"]`).getAttribute("data-num"));
    assert.equal(raw("worse"), 33);
    assert.equal(raw("worse-min"), 33);
    assert.equal(raw("worse-max"), 37);
    assert.equal(raw("tied-runs"), 14);
    assert.equal(m.root.getAttribute("data-prx-layout"), "result-first");
    // the cloud is the primary graphic, and the followed run's line sits directly under it with the run slider
    const primary = m.root.querySelectorAll("[data-prx-primary]");
    assert.equal(primary.length, 1);
    assert.ok(primary[0].querySelector("svg"));
    const line = m.root.querySelector(".cj-follow").textContent.replace(/\s+/g, " ");
    assert.match(line, /^Run 1 \(seed 1\): own-draw risk \.0373 against exact \.0379, so gap −\.00061; \|gap\| ≤ \.05041 · 2 tied reports \(gaps −\.00061, \+\.00016\)$/);
    assert.equal(raw("follow-gap"), raw("gap"), "the line and the card show the same gap");
  } finally { m.close(); }
});

test("2.18: without tied selections the headline has no range (Tighter family preset)", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=cap" });
  try {
    const text = m.root.querySelector(".prx-readout").textContent.replace(/\s+/g, " ").trim();
    assert.match(text, /53 look better on their own draws and 47 look worse; mean signed gap \+\.00002\./);
    assert.equal(m.root.querySelector('[data-prx-readout="tied-runs"]'), null);
  } finally { m.close(); }
});
