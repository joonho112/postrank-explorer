// A-CLR-001: the inclusive seed endpoint must not turn 100 reruns into duplicates. These checks exercise
// all crossing windows and compare the mounted histogram/coverage against fresh public-engine evaluations.
// Scientific golden expectations remain independently generated in R; this is a seed-plumbing regression.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import { CONFIG, runRecord, seedsOf } from "../../js/apps/mc-error.js";
import { drawErrors, gaussianDraws, summaryStats, weightedError } from "../../js/pr-core.js";
import { mountCase, settle } from "../widget_harness.mjs";

const { min, max } = CONFIG.seed;
const raw = (root, hook) => Number(root.querySelector(`[data-prx-readout="${hook}"]`).getAttribute("data-num"));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} versus ${expected}`);

test("1.17: last 99 crossing starts, preceding endpoint and ordinary seeds each give 100 distinct valid seeds", () => {
  for (const first of [min, 25, 20261030, ...Array.from({ length: 100 }, (_, r) => max - 99 + r)]) {
    const seeds = seedsOf(first);
    assert.equal(seeds.length, 100, `length at ${first}`);
    assert.equal(new Set(seeds).size, 100, `distinct at ${first}`);
    assert.equal(seeds[0], first);
    // An explicit successor check is independent of the modulo implementation.
    let want = first;
    for (const seed of seeds) {
      assert.ok(Number.isInteger(seed) && seed >= min && seed <= max, `range at ${first}`);
      assert.equal(seed, want, `sequence at ${first}`);
      want = want === max ? min : want + 1;
    }
  }
  assert.deepEqual(seedsOf(25), Array.from({ length: 100 }, (_, r) => 25 + r), "ordinary runs unchanged");
  assert.equal(seedsOf(max - 99).at(-1), max, "the last non-crossing window ends at max");
  assert.equal(seedsOf(max - 98).at(-1), min, "the first crossing window ends at min");
});

test("1.17: every boundary run seed and A–B estimate agrees with independent base-R streams", () => {
  const golden = JSON.parse(readFileSync(new URL("../golden/oracle-v3-review-a.json", import.meta.url), "utf8"));
  for (const row of golden.rows) {
    const e = row.expect;
    assert.deepEqual(seedsOf(e.seedFirst), e.seeds, row.id);
    e.seeds.forEach((seed, r) => closeTo(runRecord("A", 100, seed).wHat[0][1], e.eHatAB[r]));
  }
});

test("1.17: mounted boundary histograms/spread use fresh engine runs for each distinct seed", async () => {
  const units = SIX.tables.units;
  const means = units.mean_A.map((x) => [x]);
  const sds = units.sd_A.map((x) => [x]);
  for (const first of [max, max - 49, 1]) {
    const estimates = [];
    let seed = first;
    for (let r = 0; r < 100; r += 1) {
      const eHat = drawErrors(gaussianDraws(means, sds, 100, seed));
      estimates.push(weightedError(eHat)[0][1]);
      seed = seed === max ? min : seed + 1;
    }
    assert.ok(new Set(estimates).size > 1, "these are different runs, not one estimate copied 100 times");
    const m = await mountCase({ module: "js/apps/mc-error.js", query: `?S=100&seed=${first}` });
    try {
      closeTo(raw(m.root, "runs-sd"), summaryStats(estimates).sd);
      closeTo(raw(m.root, "read-est"), estimates[0]);
      assert.equal(raw(m.root, "runs-from"), first);
      assert.equal(raw(m.root, "runs-to"), seed === min ? max : seed - 1);
      const wraps = m.root.querySelectorAll('[data-prx-note="seed-wrap"]');
      assert.equal(wraps.length, first > max - 99 ? 3 : 0, "histogram, tally and caption agree on wrap policy");
      const table = [...m.root.querySelectorAll("table")].find((t) => t.caption?.textContent === "Runs by the estimate of the pair followed");
      const bins = [...table.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("th[data-num], td[data-num]")].map((n) => Number(n.getAttribute("data-num"))));
      assert.ok(bins.length > 1, "maximum seed no longer produces a single .1900 bin");
      assert.equal(bins.reduce((n, b) => n + b[2], 0), 100);
      bins.forEach(([lo, hi, n], i) => assert.equal(n, estimates.filter((v) => v >= lo - 1e-10 && (v < hi - 1e-10 || i === bins.length - 1 && v <= hi + 1e-10)).length));
    } finally { m.close(); }
  }
});

test("1.17: zero-estimate runs retain separate SD/trace-MCSE values and the warning against false certainty", async () => {
  const m = await mountCase({ module: "js/apps/mc-error.js", query: `?S=100&seed=${max}&pair=A,F` });
  try {
    assert.equal(raw(m.root, "runs-constant"), 0);
    assert.equal(raw(m.root, "runs-sd"), 0);
    assert.equal(raw(m.root, "runs-mcse"), raw(m.root, "read-mcse"));
    assert.ok(m.root.textContent.includes("Agreement across runs is not proof that the probability equals their estimate."));
    assert.ok(!m.root.textContent.includes("The MCSE is then"));
  } finally { m.close(); }
});

test("1.17: Redraw wraps to min, and a settings change cancels stale boundary work", async () => {
  const m = await mountCase({ module: "js/apps/mc-error.js", query: `?S=100&seed=${max}` });
  try {
    const redraw = [...m.root.querySelectorAll("button")].find((b) => b.textContent === "Redraw");
    redraw.click();
    await settle(m.win, m.el);
    assert.equal(m.handle.state.seed, min);
    assert.equal(raw(m.root, "runs-from"), min);
    assert.equal(raw(m.root, "runs-to"), 100);
    assert.equal(m.root.querySelectorAll('[data-prx-note="seed-wrap"]').length, 0);
    m.handle.update({ S: 4000, criteria: "AB", seed: max - 49 });
    m.handle.update({ S: 100, criteria: "A", seed: 25 });
    await settle(m.win, m.el);
    assert.equal(m.handle.state.seed, 25);
    assert.equal(raw(m.root, "runs-from"), 25);
    assert.equal(raw(m.root, "runs-to"), 124);
    assert.equal(m.root.hasAttribute("aria-busy"), false);
  } finally { m.close(); }
});
