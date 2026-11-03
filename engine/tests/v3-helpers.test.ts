// Phase 2, Step 2.2: the v3 helpers of engine/API.md "v3 helpers (Phase 2, Step 2.1)".
// Every example of the specification, every input check (RangeError for a bad value, TypeError for an unknown
// option key or a non-object options argument, each naming the option), the tie rules, and properties checked against
// brute-force references written here (path enumeration for the chain variance, direct sums for the wrong-count law,
// Monte Carlo for the closed forms).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as prCore from "../src/index.ts";
import {
  type ErrorArray, drawErrors, errorArray, finiteLawMargins, finiteLawPairwise, leastCertainPairs, majorityWins, pairCertainty,
} from "../src/pairwise.ts";
import {
  confidentPairs, disclosedErrorEstimands, evaluateReport, largestStatedError, realizedWrong, statedAbove, wrongCountDistribution,
} from "../src/risk.ts";
import {
  LEAGUE_SEED, chainMeanVariance, drawLeague, expectedSquaredDistance, extremeCounts, gaussianDraws, league30, leagueGradingReplays,
  leagueOvershoot, normalPosterior, rankSummaries, regretBound, selectionOnDraws, topKOvershoot, transformedMeans, twoStateChain,
  weightedRadius,
} from "../src/simulate.ts";
import { exactOptimum, fixedOrderDP } from "../src/optimize.ts";
import { strictOrder } from "../src/rules.ts";
import { meanSquaredDistance, summaryStats } from "../src/summaries.ts";
import { uniforms } from "../src/random.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const NaNd = Number.NaN;

/** An ErrorArray from n × n matrices (the diagonal is set to NaN). */
const cube = (...e: number[][][]): ErrorArray => ({
  ids: e[0].map((_, i) => String.fromCharCode(65 + i)),
  criteria: e.map((_, k) => `k${k + 1}`),
  e: e.map((m) => m.map((row, i) => row.map((x, j) => (i === j ? NaNd : x)))),
});

/** A tie-free random array on n units (e_ij + e_ji = 1) from the engine stream. */
const randomCube = (n: number, seed: number, K = 1): ErrorArray => {
  const u = uniforms(seed, n * n * K);
  const e = Array.from({ length: K }, (_, k) => {
    const m = Array.from({ length: n }, () => new Array<number>(n).fill(NaNd));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        m[i][j] = u[(k * n + i) * n + j];
        m[j][i] = 1 - m[i][j];
      }
    }
    return m;
  });
  return cube(...e);
};

const close = (got: number, want: number, tol: number, what: string) =>
  assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want} (tolerance ${tol})`);

const rangeError = (fn: () => unknown, message: RegExp) => assert.throws(fn, { name: "RangeError", message });
const typeError = (fn: () => unknown, message: RegExp) => assert.throws(fn, { name: "TypeError", message });

// The six sites, score A (independent normals, SD .20).
const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);
// Chapter 19's three-unit law: A is 20 with probability .3, else 0; B is 4; C is 3.
const CH19 = { states: [[20, 4, 3], [0, 4, 3]], probs: [0.3, 0.7] };

const KRW = JSON.parse(fs.readFileSync(path.join(ROOT, "data/released/case-krw.json"), "utf8"));
const krwArray = (criterion: string): ErrorArray => {
  const a = KRW.arrays.error;
  const k = a.criteria.indexOf(criterion);
  assert.ok(k >= 0, `the released array holds ${criterion}`);
  return { ids: a.ids, criteria: [criterion], e: [(a.e[k] as (number | null)[][]).map((row) => row.map((x) => (x === null ? NaNd : x)))] };
};

const V3 = [
  "topKOvershoot", "leagueOvershoot", "expectedSquaredDistance", "finiteLawMargins", "majorityWins", "weightedRadius", "regretBound",
  "twoStateChain", "chainMeanVariance", "wrongCountDistribution", "leagueGradingReplays", "largestStatedError", "leastCertainPairs",
  "transformedMeans", "selectionOnDraws", "pairCertainty",
];

test("exports: the sixteen v3 helpers are in the public API and have base-R golden rows (oracle-v3), none exempt", () => {
  for (const name of [...V3, "disclosedErrorEstimands"]) assert.equal(typeof (prCore as Record<string, unknown>)[name], "function", name);
  const exempt = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/parity-exempt.json"), "utf8"));
  const golden = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/golden/oracle-v3.json"), "utf8"));
  const covered = new Set(golden.rows.map((r: { args: { fn: string } }) => r.args.fn));
  for (const name of [...V3, "disclosedErrorEstimands"]) {
    assert.ok(covered.has(name), `${name} has rows in verification/golden/oracle-v3.json`);
    assert.ok(!exempt.exempt.includes(name), `${name} is not exempt from parity`);
  }
  // the internal law reader stays out of the public API (it is not a numerical function with golden rows)
  assert.equal((prCore as Record<string, unknown>).readLaw, undefined);
});

// ---------------------------------------------------------------------------------------------------------
// topKOvershoot

test("topKOvershoot: the spec example (top, bottom, posterior)", () => {
  const est = [3, 1, 2, 2];
  const truth = [1, 1, 1, 1];
  assert.deepEqual(topKOvershoot(est, truth, { k: 2 }), { k: 2, side: "top", units: [0, 2], overshoot: 1.5, posteriorOvershoot: null });
  assert.deepEqual(topKOvershoot(est, truth, { k: 2, side: "bottom" }), { k: 2, side: "bottom", units: [3, 1], overshoot: 0.5, posteriorOvershoot: null });
  const withPost = topKOvershoot(est, truth, { k: 2, posterior: [2, 1, 1.5, 1.5] });
  assert.deepEqual(withPost.units, [0, 2]);
  assert.equal(withPost.posteriorOvershoot, 0.75);
  assert.deepEqual(topKOvershoot(est, truth, { k: 2, posterior: null }), topKOvershoot(est, truth, { k: 2 }));
});

test("topKOvershoot: the order of extremeCounts (largest first, equal estimates in index order); k = n; posterior = estimate", () => {
  const est = [0.5, 2, 2, -1, 0.5, 2];
  const truth = [0, 1, 0, 0, 1, 0];
  // order: 1, 2, 5 (the three 2s by index), 0, 4 (the two .5s), 3
  assert.deepEqual(topKOvershoot(est, truth, { k: 6 }).units, [1, 2, 5, 0, 4, 3]);
  assert.deepEqual(topKOvershoot(est, truth, { k: 2 }).units, [1, 2]);
  assert.deepEqual(topKOvershoot(est, truth, { k: 2, side: "bottom" }).units, [4, 3]);
  // the top k of topKOvershoot are the units extremeCounts counts as top
  const groups = est.map((_, i) => `u${i}`);
  const top3 = extremeCounts(est, groups, 3).top;
  assert.deepEqual(topKOvershoot(est, truth, { k: 3 }).units.sort(), Object.keys(top3).filter((g) => top3[g] === 1).map((g) => Number(g.slice(1))).sort());
  // k = n: top and bottom take every unit; the overshoot is the mean difference
  const all = topKOvershoot(est, truth, { k: 6 });
  let s = 0;
  for (const u of all.units) s += est[u] - truth[u];
  assert.equal(all.overshoot, s / 6);
  close(topKOvershoot(est, truth, { k: 6, side: "bottom" }).overshoot, all.overshoot, 1e-15, "bottom k = n");
  // the posterior equal to the estimate gives the same overshoot; typed arrays are accepted
  const same = topKOvershoot(Float64Array.from(est), truth, { k: 3, posterior: Float64Array.from(est) });
  assert.equal(same.posteriorOvershoot, same.overshoot);
});

test("topKOvershoot: input checks", () => {
  const est = [3, 1, 2, 2];
  const truth = [1, 1, 1, 1];
  for (const k of [0, 5, 1.5, -1, Number.NaN]) rangeError(() => topKOvershoot(est, truth, { k }), /topKOvershoot: k must be an integer in 1\.\.4/);
  rangeError(() => topKOvershoot(est, truth, {} as never), /k must be an integer in 1\.\.4/);
  rangeError(() => topKOvershoot(est, truth, { k: 1, side: "middle" as never }), /side must be "top" or "bottom"/);
  rangeError(() => topKOvershoot(est, [1, 1, 1], { k: 1 }), /truth must have 4 values/);
  rangeError(() => topKOvershoot(est, truth, { k: 1, posterior: [1, 2] }), /posterior must have 4 values/);
  rangeError(() => topKOvershoot(est, truth, { k: 1, posterior: [1, 2, NaNd, 3] }), /posterior must be finite/);
  rangeError(() => topKOvershoot([3, NaNd, 2, 2], truth, { k: 1 }), /estimate must be finite/);
  rangeError(() => topKOvershoot([], [], { k: 1 }), /estimate must be a nonempty array/);
  typeError(() => topKOvershoot(est, truth, undefined as never), /topKOvershoot: options object expected/);
  typeError(() => topKOvershoot(est, truth, 2 as never), /options object expected/);
  typeError(() => topKOvershoot(est, truth, { k: 1, K: 2 } as never), /unknown option "K"/);
});

// ---------------------------------------------------------------------------------------------------------
// leagueOvershoot

test("leagueOvershoot: the spec example, seeds 20261030 + 0 … 1999: means about .160 (estimate) and −.007 (posterior)", () => {
  const r = leagueOvershoot(LEAGUE_SEED - 1, { replays: 2000 });
  assert.equal(r.draws[0].seed, 20261030);
  assert.equal(r.draws[1999].seed, 20261030 + 1999);
  close(r.mean.overshoot, 0.16, 0.0005, "mean overshoot of the estimates");
  close(r.mean.posteriorOvershoot, -0.007, 0.0005, "mean overshoot of the posterior means");
  // the shrinkage removes most of the winner's curse
  assert.ok(Math.abs(r.mean.posteriorOvershoot) < r.mean.overshoot / 10);
});

test("leagueOvershoot: each draw is topKOvershoot of drawLeague(seed + r) with the teaching posterior; means in replay order", () => {
  const L = league30();
  for (const [seed, opts] of [[LEAGUE_SEED, {}], [12345, { replays: 7, k: 5, side: "bottom" as const, priorSd: 0.05 }]] as const) {
    const r = leagueOvershoot(seed, opts);
    const R = (opts as { replays?: number }).replays ?? 20;
    const k = (opts as { k?: number }).k ?? 3;
    const side = (opts as { side?: "top" | "bottom" }).side ?? "top";
    const priorSd = (opts as { priorSd?: number }).priorSd ?? 0.15;
    assert.deepEqual([r.seed, r.replays, r.k, r.side, r.priorSd], [seed, R, k, side, priorSd]);
    assert.equal(r.draws.length, R);
    let so = 0;
    let sp = 0;
    r.draws.forEach((d, q) => {
      assert.equal(d.r, q + 1);
      assert.equal(d.seed, seed + q + 1);
      const est = drawLeague(seed + q + 1).estimate;
      const post = normalPosterior(est, L.se, { priorSd }) as { mean: number[] };
      const x = topKOvershoot(est, L.theta, { k, side, posterior: post.mean });
      assert.deepEqual(d, { r: q + 1, seed: seed + q + 1, units: x.units, overshoot: x.overshoot, posteriorOvershoot: x.posteriorOvershoot });
      so += d.overshoot;
      sp += d.posteriorOvershoot;
    });
    assert.equal(r.mean.overshoot, so / R);
    assert.equal(r.mean.posteriorOvershoot, sp / R);
  }
  // defaults: seed LEAGUE_SEED, 20 replays, k 3, top, prior SD .15
  assert.deepEqual(leagueOvershoot(), leagueOvershoot(LEAGUE_SEED, { replays: 20, k: 3, side: "top", priorSd: 0.15 }));
});

test("leagueOvershoot: the flat prior keeps the estimates (posterior overshoot = overshoot); the bottom side undershoots", () => {
  const flat = leagueOvershoot(LEAGUE_SEED, { replays: 50, priorSd: Number.POSITIVE_INFINITY });
  for (const d of flat.draws) assert.equal(d.posteriorOvershoot, d.overshoot);
  assert.equal(flat.mean.posteriorOvershoot, flat.mean.overshoot);
  const bottom = leagueOvershoot(LEAGUE_SEED, { replays: 500, side: "bottom" });
  assert.ok(bottom.mean.overshoot < -0.1, `the lowest estimates sit below their true values (${bottom.mean.overshoot})`);
});

test("leagueOvershoot: input checks", () => {
  rangeError(() => leagueOvershoot(1.5), /leagueOvershoot: seed must be a safe integer/);
  rangeError(() => leagueOvershoot(2 ** 53), /seed must be a safe integer/);
  rangeError(() => leagueOvershoot(LEAGUE_SEED, { replays: 0 }), /replays must be an integer ≥ 1/);
  rangeError(() => leagueOvershoot(LEAGUE_SEED, { replays: 2.5 }), /replays must be an integer ≥ 1/);
  for (const k of [0, 31, 2.5]) rangeError(() => leagueOvershoot(LEAGUE_SEED, { k }), /k must be an integer in 1\.\.30/);
  rangeError(() => leagueOvershoot(LEAGUE_SEED, { side: "both" as never }), /side must be "top" or "bottom"/);
  for (const priorSd of [0, -0.1, Number.NaN]) rangeError(() => leagueOvershoot(LEAGUE_SEED, { priorSd }), /priorSd must be > 0/);
  typeError(() => leagueOvershoot(LEAGUE_SEED, { topK: 3 } as never), /leagueOvershoot: unknown option "topK"/);
  typeError(() => leagueOvershoot(LEAGUE_SEED, 20 as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// expectedSquaredDistance

test("expectedSquaredDistance: the spec example, the league at prior SD .02, .10, .15, .20 (rawMean .0175)", () => {
  const L = league30();
  const want: [number, number][] = [[0.02, 0.019149], [0.1, 0.00846], [0.15, 0.007536], [0.2, 0.008193]];
  for (const [sigma, mean] of want) {
    const r = expectedSquaredDistance(L.theta, L.se, { priorSd: sigma });
    close(r.mean, mean, 5e-7, `mean at σ ${sigma}`);
    close(r.rawMean, 0.0175, 1e-15, "rawMean");
    assert.equal(r.perUnit.length, 30);
  }
});

test("expectedSquaredDistance: the closed form unit by unit, the flat prior, a prior mean, and a Monte Carlo check", () => {
  const L = league30();
  const r = expectedSquaredDistance(L.theta, L.se, { priorSd: 0.15, priorMean: 0.05 });
  r.perUnit.forEach((x, i) => {
    const B = 0.15 ** 2 / (0.15 ** 2 + L.se[i] ** 2);
    close(x, ((1 - B) * (0.05 - L.theta[i])) ** 2 + B * B * L.se[i] ** 2, 1e-17, `unit ${i}`);
  });
  let s = 0;
  for (const x of r.perUnit) s += x;
  assert.equal(r.mean, s / 30);
  // σ = ∞: B = 1, the posterior mean is the estimate, perUnit = SE² and mean = rawMean exactly
  const flat = expectedSquaredDistance(L.theta, L.se, { priorSd: Number.POSITIVE_INFINITY });
  assert.deepEqual(flat.perUnit, L.se.map((x) => x * x));
  assert.equal(flat.mean, flat.rawMean);
  // one common SE is recycled
  assert.deepEqual(expectedSquaredDistance([0, 1], 0.2), expectedSquaredDistance([0, 1], [0.2, 0.2]));
  // Monte Carlo over 4,000 league replays: the average squared distance of the posterior means to θ
  const R = 4000;
  const msd: number[] = [];
  for (let q = 1; q <= R; q += 1) {
    const est = drawLeague(LEAGUE_SEED + q).estimate;
    msd.push(meanSquaredDistance((normalPosterior(est, L.se, { priorSd: 0.15 }) as { mean: number[] }).mean, L.theta));
  }
  const st = summaryStats(msd);
  const exact = expectedSquaredDistance(L.theta, L.se).mean; // default prior SD .15, mean 0
  close(st.mean, exact, 4 * (st.sd as number) / Math.sqrt(R), "Monte Carlo average squared distance");
});

test("expectedSquaredDistance: input checks", () => {
  rangeError(() => expectedSquaredDistance([], []), /theta must be a nonempty array/);
  rangeError(() => expectedSquaredDistance([0, NaNd], [0.1, 0.1]), /theta must be finite/);
  rangeError(() => expectedSquaredDistance([0, 1], [0.1]), /se must have 2 values/);
  rangeError(() => expectedSquaredDistance([0, 1], [0.1, -0.1]), /se must be ≥ 0/);
  for (const priorSd of [0, -1, Number.NaN]) rangeError(() => expectedSquaredDistance([0, 1], [0.1, 0.1], { priorSd }), /priorSd must be > 0/);
  rangeError(() => expectedSquaredDistance([0, 1], [0.1, 0.1], { priorMean: Number.POSITIVE_INFINITY }), /priorMean must be a finite number/);
  typeError(() => expectedSquaredDistance([0, 1], [0.1, 0.1], { sigma: 0.1 } as never), /expectedSquaredDistance: unknown option "sigma"/);
});

// ---------------------------------------------------------------------------------------------------------
// finiteLawMargins

test("finiteLawMargins: the spec example, both couplings of chapter 9 have the margins 0, 1, 2 with 1/3 each", () => {
  const third = { values: [0, 1, 2], probs: [1 / 3, 1 / 3, 1 / 3] };
  for (const states of [[[0, 1], [1, 2], [2, 0]], [[0, 2], [1, 0], [2, 1]]]) {
    assert.deepEqual(finiteLawMargins(states, [1 / 3, 1 / 3, 1 / 3]), { margins: [[third], [third]] });
  }
});

test("finiteLawMargins: distinct values ascending, probabilities summed in state order; K = 2; equal weights; labels", () => {
  const r = finiteLawMargins([[2, 1], [0, 1], [2, 3]], [0.5, 0.2, 0.3]);
  assert.deepEqual(r.margins[0], [{ values: [0, 2], probs: [0.2, 0.5 + 0.3] }]);
  assert.deepEqual(r.margins[1], [{ values: [1, 3], probs: [0.5 + 0.2, 0.3] }]);
  // two criteria: margins[i][k]
  const two = finiteLawMargins([[[1, 5], [0, 5]], [[1, 4], [2, 5]]], [0.25, 0.75]);
  assert.deepEqual(two.margins, [
    [{ values: [1], probs: [0.25 + 0.75] }, { values: [4, 5], probs: [0.75, 0.25] }],
    [{ values: [0, 2], probs: [0.25, 0.75] }, { values: [5], probs: [0.25 + 0.75] }],
  ]);
  // equal weights (probs null): exact counts over S
  assert.deepEqual(finiteLawMargins([[1, 0], [1, 2], [3, 0]], null).margins, [[{ values: [1, 3], probs: [2 / 3, 1 / 3] }], [{ values: [0, 2], probs: [2 / 3, 1 / 3] }]]);
  // equal means ===: −0 and 0 are one value
  assert.deepEqual(finiteLawMargins([[-0, 1], [0, 1]], [0.5, 0.5]).margins[0], [{ values: [0], probs: [1] }]);
  // ids and criteria come back when given (and only then)
  const named = finiteLawMargins([[0, 1], [1, 0]], [0.5, 0.5], { ids: ["x", "y"], criteria: ["c"] });
  assert.deepEqual([named.ids, named.criteria], [["x", "y"], ["c"]]);
  assert.equal("ids" in finiteLawMargins([[0, 1], [1, 0]], [0.5, 0.5]), false);
});

test("finiteLawMargins: each margin is a probability law whose mean is the unit's posterior mean", () => {
  const u = uniforms(7, 40);
  const states = Array.from({ length: 8 }, (_, s) => Array.from({ length: 5 }, (_, i) => Math.floor(u[s * 5 + i] * 4)));
  const raw = Array.from(uniforms(8, 8));
  const total = raw.reduce((a, b) => a + b, 0);
  const probs = raw.map((x) => x / total);
  probs[7] = 1 - probs.slice(0, 7).reduce((a, b) => a + b, 0);
  const r = finiteLawMargins(states, probs);
  const means = rankSummaries({ states, probs }).means;
  r.margins.forEach(([m], i) => {
    for (let v = 1; v < m.values.length; v += 1) assert.ok(m.values[v] > m.values[v - 1], "ascending, distinct");
    close(m.probs.reduce((a, b) => a + b, 0), 1, 1e-12, `unit ${i} total`);
    close(m.values.reduce((a, x, v) => a + x * m.probs[v], 0), means[i], 1e-12, `unit ${i} mean`);
  });
});

test("finiteLawMargins: input checks (as finiteLawPairwise)", () => {
  rangeError(() => finiteLawMargins([[0, 1], [1, 0]], [0.5, 0.4]), /sum to 1/);
  rangeError(() => finiteLawMargins([[0, 1], [1, 0]], [1.5, -0.5]), /≥ 0/);
  rangeError(() => finiteLawMargins([[0, 1]], [0.5, 0.5]), /one value per state/);
  rangeError(() => finiteLawMargins([[0, 1], [1, 0, 2]], [0.5, 0.5]), /units/);
  rangeError(() => finiteLawMargins([], null), /nonempty/);
  rangeError(() => finiteLawMargins([[0, NaNd]], null), /finite/);
  rangeError(() => finiteLawMargins([[0, 1]], null, { ids: ["a"] }), /ids must be 2 strings/);
  typeError(() => finiteLawMargins([[0, 1]], null, { labels: ["a", "b"] } as never), /finiteLawMargins: unknown option "labels"/);
});

// ---------------------------------------------------------------------------------------------------------
// majorityWins

test("majorityWins: the spec example, six sites (wins 5 … 0, no ties, no cycles, strict order)", () => {
  assert.deepEqual(majorityWins(E6), { wins: [5, 4, 3, 2, 1, 0], ties: [0, 0, 0, 0, 0, 0], order: [0, 1, 2, 3, 4, 5], cycles: 0, strictOrder: true, cycleTriples: [] });
});

test("majorityWins: the spec example on KRW's released arrays: race a strict order, gender one 3-cycle", () => {
  const race = majorityWins(krwArray("race_signed"));
  assert.equal(race.strictOrder, true);
  assert.equal(race.cycles, 0);
  // a strict order: wins are n − 1, …, 0 along `order`
  assert.deepEqual(race.order.map((u) => race.wins[u]), Array.from({ length: 97 }, (_, p) => 96 - p));
  const gender = majorityWins(krwArray("gender_signed"));
  assert.equal(gender.cycles, 1);
  assert.equal(gender.strictOrder, false);
  assert.equal(gender.ties.reduce((a, b) => a + b, 0), 0);
});

test("majorityWins: tie rule (|ē_ij − ē_ji| ≤ tieTol), strict wins, equal wins in index order, cycles in both orientations", () => {
  // 0–1 a majority tie; 0 beats 2; 1 beats 2
  const tie = cube([
    [0, 0.5, 0.2],
    [0.5, 0, 0.3],
    [0.8, 0.7, 0],
  ]);
  assert.deepEqual(majorityWins(tie), { wins: [1, 1, 0], ties: [1, 1, 0], order: [0, 1, 2], cycles: 0, strictOrder: false, cycleTriples: [] });
  // within the tolerance: a difference of 1e-13 ties at the default 1e-12, and is a win at tieTol 0
  const near = cube([
    [0, 0.5, 0.2],
    [0.5 + 1e-13, 0, 0.3],
    [0.8, 0.7, 0],
  ]);
  assert.deepEqual(majorityWins(near).ties, [1, 1, 0]);
  const exact = majorityWins(near, { tieTol: 0 });
  assert.deepEqual([exact.wins, exact.ties, exact.strictOrder], [[2, 1, 0], [0, 0, 0], true]);
  // a 3-cycle 0 → 1 → 2 → 0: one cyclic triple, wins 1 each, order by index
  const cyc = cube([
    [0, 0.3, 0.7],
    [0.7, 0, 0.3],
    [0.3, 0.7, 0],
  ]);
  assert.deepEqual(majorityWins(cyc), { wins: [1, 1, 1], ties: [0, 0, 0], order: [0, 1, 2], cycles: 1, strictOrder: false, cycleTriples: [[0, 1, 2]] });
  // the reverse orientation 0 → 2 → 1 → 0 counts as well
  const rev = cube([
    [0, 0.7, 0.3],
    [0.3, 0, 0.7],
    [0.7, 0.3, 0],
  ]);
  assert.equal(majorityWins(rev).cycles, 1);
  // a triple with a tied pair is not cyclic
  const tied = cube([
    [0, 0.3, 0.5],
    [0.7, 0, 0.3],
    [0.5, 0.7, 0],
  ]);
  assert.equal(majorityWins(tied).cycles, 0);
  // 4 units: a cycle among 1, 2, 3 under a unit 0 that beats all of them
  const four = cube([
    [0, 0.1, 0.1, 0.1],
    [0.9, 0, 0.3, 0.7],
    [0.9, 0.7, 0, 0.3],
    [0.9, 0.3, 0.7, 0],
  ]);
  assert.deepEqual(majorityWins(four), { wins: [3, 1, 1, 1], ties: [0, 0, 0, 0], order: [0, 1, 2, 3], cycles: 1, strictOrder: false, cycleTriples: [[1, 2, 3]] });
});

test("majorityWins: weights combine the criteria (ē = Σ_k w_k e_k); random arrays agree with a direct count", () => {
  const e1 = [
    [0, 0.2, 0.3],
    [0.8, 0, 0.4],
    [0.7, 0.6, 0],
  ];
  const e2 = [
    [0, 0.9, 0.6],
    [0.1, 0, 0.2],
    [0.4, 0.8, 0],
  ];
  const E = cube(e1, e2);
  assert.deepEqual(majorityWins(E, { w: [1, 0] }).order, [0, 1, 2]);
  assert.deepEqual(majorityWins(E, { w: [0, 1] }).order, [1, 2, 0]);
  // w = (.5, .5): ē_01 = .55 > ē_10 = .45 so 1 beats 0; ē_02 = .45 < .55; ē_12 = .3 < .7: a 3-cycle? 1 > 0, 0 > 2, 1 > 2 → no
  const half = majorityWins(E, { w: [0.5, 0.5] });
  assert.deepEqual([half.wins, half.cycles], [[1, 2, 0], 0]);
  for (const seed of [1, 2, 3]) {
    const R = randomCube(7, seed);
    const m = majorityWins(R);
    let cycles = 0;
    const b = (i: number, j: number) => R.e[0][i][j] < R.e[0][j][i] - 1e-12;
    for (let x = 0; x < 7; x += 1) {
      for (let y = x + 1; y < 7; y += 1) {
        for (let z = y + 1; z < 7; z += 1) if ((b(x, y) && b(y, z) && b(z, x)) || (b(x, z) && b(z, y) && b(y, x))) cycles += 1;
      }
    }
    assert.equal(m.cycles, cycles);
    assert.deepEqual(m.wins, Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => (i !== j && b(i, j) ? 1 : 0)).reduce((p, q) => p + q, 0)));
  }
});

test("majorityWins: input checks", () => {
  rangeError(() => majorityWins({ ids: ["A"], criteria: ["k1"], e: [[[NaNd]]] }), /at least two units/);
  rangeError(() => majorityWins(E6, { tieTol: -1 }), /majorityWins: tieTol must be a finite number ≥ 0/);
  rangeError(() => majorityWins(E6, { tieTol: Number.NaN }), /tieTol must be a finite number ≥ 0/);
  rangeError(() => majorityWins(cube([[0, 0.5], [0.5, 0]], [[0, 0.5], [0.5, 0]])), /weights w are required/);
  rangeError(() => majorityWins(E6, { w: [0.5, 0.5] }), /w must hold 1 weights/);
  typeError(() => majorityWins(E6, { tau: 0.2 } as never), /majorityWins: unknown option "tau"/);
  typeError(() => majorityWins(E6, 0.2 as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// weightedRadius and regretBound

test("regretBound: the spec example (N 12, N* 9, M 15, δ_w .05: evaluation .04, regret .07, uniform .1) and η", () => {
  const r = regretBound({ N: 12, Nstar: 9, M: 15, deltaW: 0.05 });
  close(r.evaluation, 0.04, 1e-16, "evaluation");
  close(r.regret, 0.07, 1e-16, "regret");
  close(r.uniform, 0.1, 1e-16, "uniform");
  assert.deepEqual(r, { evaluation: (12 * 0.05) / 15, regret: (21 * 0.05) / 15, uniform: 0.1 });
  const eta = regretBound({ N: 12, Nstar: 9, M: 15, deltaW: 0.05, eta: 0.01 });
  assert.deepEqual(eta, { evaluation: r.evaluation, regret: (21 * 0.05) / 15 + 0.01, uniform: 0.1 + 0.01 });
  // N = 0 and N* = 0: nothing stated, nothing to bound but the slack
  assert.deepEqual(regretBound({ N: 0, Nstar: 0, M: 15, deltaW: 0.05, eta: 0.02 }), { evaluation: 0, regret: 0.02, uniform: 0.1 + 0.02 });
});

test("weightedRadius: δ_w = Σ_k w_k ε_k in criterion order; K = 1 needs no weights", () => {
  assert.equal(weightedRadius([0.05]), 0.05);
  assert.equal(weightedRadius([0.05], [1]), 0.05);
  assert.equal(weightedRadius([0.1, 0.02], [0.5, 0.5]), 0.5 * 0.1 + 0.5 * 0.02);
  assert.equal(weightedRadius([0.1, 0.02, 0.3], [0.2, 0.3, 0.5]), 0.2 * 0.1 + 0.3 * 0.02 + 0.5 * 0.3);
  assert.equal(weightedRadius([0, 0], [0.25, 0.75]), 0);
  // with all weight on one criterion it is that criterion's ε
  assert.equal(weightedRadius([0.1, 0.02], [0, 1]), 0.02);
});

test("weightedRadius and regretBound: input checks", () => {
  rangeError(() => weightedRadius([0.1, -0.01], [0.5, 0.5]), /weightedRadius: eps must be ≥ 0/);
  rangeError(() => weightedRadius([0.1, NaNd], [0.5, 0.5]), /eps must be finite/);
  rangeError(() => weightedRadius([], []), /eps must be a nonempty array/);
  rangeError(() => weightedRadius([0.1, 0.2]), /weights w are required/);
  rangeError(() => weightedRadius([0.1, 0.2], [1]), /w must hold 2 weights/);
  rangeError(() => weightedRadius([0.1, 0.2], [0.5, 0.6]), /sum to 1/);
  rangeError(() => weightedRadius([0.1, 0.2], [1.5, -0.5]), /weights must be finite and ≥ 0/);
  const ok = { N: 12, Nstar: 9, M: 15, deltaW: 0.05 };
  for (const M of [0, 1.5, -15]) rangeError(() => regretBound({ ...ok, M }), /regretBound: M must be a positive integer/);
  for (const N of [16, -1, 2.5]) rangeError(() => regretBound({ ...ok, N }), /regretBound: N must be an integer in 0\.\.15/);
  rangeError(() => regretBound({ ...ok, Nstar: 16 }), /Nstar must be an integer in 0\.\.15/);
  rangeError(() => regretBound({ ...ok, deltaW: -0.1 }), /deltaW must be a finite number ≥ 0/);
  rangeError(() => regretBound({ ...ok, deltaW: Number.POSITIVE_INFINITY }), /deltaW must be a finite number ≥ 0/);
  rangeError(() => regretBound({ ...ok, eta: Number.NaN }), /eta must be a finite number ≥ 0/);
  rangeError(() => regretBound({ N: 1, M: 3, deltaW: 0.1 } as never), /Nstar must be an integer/);
  typeError(() => regretBound(undefined as never), /regretBound: options object expected/);
  typeError(() => regretBound({ ...ok, delta: 0.05 } as never), /regretBound: unknown option "delta"/);
});

// ---------------------------------------------------------------------------------------------------------
// twoStateChain and chainMeanVariance

/** The chain rule written out from the specification, for one chain on its slice of uniforms. */
const referenceChain = (u: ArrayLike<number>, p01: number, p10: number): number[] => {
  const pi1 = p01 / (p01 + p10);
  const x = [u[0] < pi1 ? 1 : 0];
  for (let b = 1; b < u.length; b += 1) x.push(x[b - 1] === 0 ? (u[b] < p01 ? 1 : 0) : u[b] < p10 ? 0 : 1);
  return x;
};

test("twoStateChain: p01 = p10 = 1 alternates; the first state from u < π₁ = 1/2; chain c uses uniforms c·S … c·S + S − 1", () => {
  const r = twoStateChain({ p01: 1, p10: 1, S: 9, chains: 4, seed: 3 });
  assert.equal(r.pi1, 0.5);
  const u = uniforms(3, 36);
  r.chains.forEach((x, c) => {
    assert.equal(x[0], u[c * 9] < 0.5 ? 1 : 0);
    for (let b = 1; b < 9; b += 1) assert.equal(x[b], 1 - x[b - 1], `chain ${c} alternates`);
  });
  assert.deepEqual(Object.keys(r), ["p01", "p10", "S", "seed", "pi1", "chains"]);
  assert.deepEqual([r.p01, r.p10, r.S, r.seed], [1, 1, 9, 3]);
  for (const [p01, p10, S, C, seed] of [[0.2, 0.3, 25, 3, 1], [0.01, 0.01, 50, 2, 20261030], [0.9, 0.05, 7, 5, -4]] as const) {
    const ch = twoStateChain({ p01, p10, S, chains: C, seed });
    const uu = uniforms(seed, C * S);
    ch.chains.forEach((x, c) => assert.deepEqual(x, referenceChain(uu.subarray(c * S, c * S + S), p01, p10)));
    assert.ok(ch.chains.every((x) => Array.isArray(x) && x.every((v) => v === 0 || v === 1)));
  }
  // chains defaults to 1, and the first chain does not depend on how many follow it
  const one = twoStateChain({ p01: 0.2, p10: 0.3, S: 25, seed: 1 });
  assert.equal(one.chains.length, 1);
  assert.deepEqual(one.chains[0], twoStateChain({ p01: 0.2, p10: 0.3, S: 25, chains: 3, seed: 1 }).chains[0]);
});

test("twoStateChain: strict comparisons (u equal to a probability does not move the chain); long-run share ≈ π₁", () => {
  const u = uniforms(1, 2);
  // p10 = 1 gives π₁ = u1/(u1 + 1) < u0, so X_1 = 0; then X_2 = 1 only when u1 < p01 (strict)
  assert.deepEqual(twoStateChain({ p01: u[1], p10: 1, S: 2, seed: 1 }).chains[0], [0, 0]);
  const up = u[1] + 2 ** -60;
  assert.ok(up > u[1]);
  assert.deepEqual(twoStateChain({ p01: up, p10: 1, S: 2, seed: 1 }).chains[0], [0, 1]);
  // X_1 = 1 exactly when u0 < π₁: p01 = u0, p10 = 1 − u0 make π₁ = u0 exactly (a 33-bit dyadic), which gives 0
  const at = twoStateChain({ p01: u[0], p10: 1 - u[0], S: 1, seed: 1 });
  assert.equal(at.pi1, u[0]);
  assert.deepEqual(at.chains, [[0]]);
  const above = twoStateChain({ p01: u[0] + 2 ** -40, p10: 1 - u[0], S: 1, seed: 1 });
  assert.ok(above.pi1 > u[0]);
  assert.deepEqual(above.chains, [[1]]);
  // a long chain spends about π₁ of its time in state 1; the first states of many chains are Bernoulli(π₁)
  const long = twoStateChain({ p01: 0.2, p10: 0.3, S: 200000, seed: 11 }).chains[0];
  close(long.reduce((a, b) => a + b, 0) / long.length, 0.4, 0.01, "long-run share of 1s");
  const firsts = twoStateChain({ p01: 0.2, p10: 0.3, S: 1, chains: 20000, seed: 12 }).chains.map((x) => x[0]);
  close(firsts.reduce((a, b) => a + b, 0) / firsts.length, 0.4, 0.015, "share of chains starting in 1");
});

test("chainMeanVariance: the spec (book) example, p01 = p10 = .01, S = 100", () => {
  const r = chainMeanVariance({ p01: 0.01, p10: 0.01, S: 100 });
  assert.equal(r.pi1, 0.5);
  close(r.rho, 0.98, 1e-15, "rho");
  close(r.variance, 0.1412459, 5e-8, "variance");
  close(r.iidVariance, 0.0025, 1e-18, "iidVariance");
  close(r.equivalentDraws, 1.76996, 5e-6, "equivalentDraws");
  close(r.asymptoticEquivalent as number, 1.010101, 5e-7, "asymptoticEquivalent");
  close(r.noSwitch, 0.3697296, 5e-8, "noSwitch");
  assert.equal(r.equivalentDraws, r.pi1 * (1 - r.pi1) / r.variance);
});

/** The exact variance of the chain mean and the no-switch chance by enumerating all 2^S paths. */
const enumerateChain = (p01: number, p10: number, S: number): { variance: number; noSwitch: number } => {
  const pi1 = p01 / (p01 + p10);
  const P = [[1 - p01, p01], [p10, 1 - p10]];
  let m1 = 0;
  let m2 = 0;
  let still = 0;
  for (let code = 0; code < 2 ** S; code += 1) {
    const x = Array.from({ length: S }, (_, b) => (code >> b) & 1);
    let pr = x[0] === 1 ? pi1 : 1 - pi1;
    for (let b = 1; b < S; b += 1) pr *= P[x[b - 1]][x[b]];
    const mean = x.reduce((a, v) => a + v, 0) / S;
    m1 += pr * mean;
    m2 += pr * mean * mean;
    if (x.every((v) => v === x[0])) still += pr;
  }
  return { variance: m2 - m1 * m1, noSwitch: still };
};

test("chainMeanVariance: the variance equals the brute-force covariance sum and the 2^S path enumeration for small S", () => {
  for (const [p01, p10] of [[0.2, 0.3], [0.01, 0.01], [0.9, 0.8], [0.5, 0.5], [1, 0.4], [0.05, 0.7]]) {
    for (const S of [1, 2, 3, 5, 8, 12]) {
      const r = chainMeanVariance({ p01, p10, S });
      const q = r.pi1 * (1 - r.pi1);
      let cov = 0;
      for (let a = 0; a < S; a += 1) for (let b = 0; b < S; b += 1) cov += q * r.rho ** Math.abs(a - b);
      close(r.variance, cov / (S * S), 1e-15, `covariance sum p01 ${p01} p10 ${p10} S ${S}`);
      const exact = enumerateChain(p01, p10, S);
      close(r.variance, exact.variance, 1e-14, `path enumeration p01 ${p01} p10 ${p10} S ${S}`);
      close(r.noSwitch, exact.noSwitch, 1e-15, `no-switch chance p01 ${p01} p10 ${p10} S ${S}`);
      assert.equal(r.iidVariance, q / S);
    }
  }
});

test("chainMeanVariance: ρ = 0 is the IID case, ρ = −1 has no asymptotic form, and Monte Carlo chains agree", () => {
  // ρ = 0 (p01 + p10 = 1): the chain is IID, variance = iidVariance and S equivalent draws
  const iid = chainMeanVariance({ p01: 0.3, p10: 0.7, S: 40 });
  assert.equal(iid.rho, 0);
  assert.equal(iid.variance, iid.iidVariance);
  close(iid.equivalentDraws, 40, 1e-12, "equivalent draws of an IID chain");
  close(iid.asymptoticEquivalent as number, 40, 1e-12, "asymptotic form at ρ = 0");
  // ρ = −1 (p01 = p10 = 1): the chain alternates; an even S has a known mean (variance 0), an odd S does not
  const even = chainMeanVariance({ p01: 1, p10: 1, S: 4 });
  assert.deepEqual([even.rho, even.variance, even.equivalentDraws, even.asymptoticEquivalent, even.noSwitch], [-1, 0, Number.POSITIVE_INFINITY, null, 0]);
  const odd = chainMeanVariance({ p01: 1, p10: 1, S: 3 });
  close(odd.variance, 1 / 36, 1e-17, "alternating chain of 3: mean 1/3 or 2/3");
  assert.equal(odd.asymptoticEquivalent, null);
  assert.equal(chainMeanVariance({ p01: 1, p10: 1, S: 1 }).noSwitch, 1);
  // a negatively correlated chain mixes faster than IID draws
  assert.ok(chainMeanVariance({ p01: 0.9, p10: 0.8, S: 50 }).equivalentDraws > 50);
  // Monte Carlo: the sample variance of 4,000 chain means
  const C = 4000;
  const means = twoStateChain({ p01: 0.2, p10: 0.3, S: 20, chains: C, seed: 5 }).chains.map((x) => x.reduce((a, b) => a + b, 0) / 20);
  const v = (summaryStats(means).sd as number) ** 2;
  const exact = chainMeanVariance({ p01: 0.2, p10: 0.3, S: 20 }).variance;
  close(v, exact, 4 * exact * Math.sqrt(2 / (C - 1)), "Monte Carlo variance of the chain mean");
});

test("twoStateChain and chainMeanVariance: input checks", () => {
  const ok = { p01: 0.2, p10: 0.3, S: 10, seed: 1 };
  for (const p01 of [0, -0.1, 1.5, Number.NaN]) rangeError(() => twoStateChain({ ...ok, p01 }), /twoStateChain: p01 must lie in \(0, 1\]/);
  rangeError(() => twoStateChain({ ...ok, p10: 0 }), /p10 must lie in \(0, 1\]/);
  for (const S of [0, 2.5, -1]) rangeError(() => twoStateChain({ ...ok, S }), /S must be an integer ≥ 1/);
  rangeError(() => twoStateChain({ ...ok, chains: 0 }), /chains must be an integer ≥ 1/);
  rangeError(() => twoStateChain({ p01: 0.2, p10: 0.3, S: 10 } as never), /twoStateChain: seed must be a safe integer/);
  rangeError(() => twoStateChain({ ...ok, seed: 0.5 }), /seed must be a safe integer/);
  typeError(() => twoStateChain({ ...ok, rho: 0.5 } as never), /twoStateChain: unknown option "rho"/);
  typeError(() => twoStateChain(undefined as never), /twoStateChain: options object expected/);
  rangeError(() => chainMeanVariance({ p01: 0.2, p10: 1.01, S: 10 }), /chainMeanVariance: p10 must lie in \(0, 1\]/);
  rangeError(() => chainMeanVariance({ p01: 0.2, p10: 0.3, S: 0 }), /S must be an integer ≥ 1/);
  typeError(() => chainMeanVariance({ p01: 0.2, p10: 0.3, S: 10, seed: 1 } as never), /chainMeanVariance: unknown option "seed"/);
  typeError(() => chainMeanVariance(undefined as never), /chainMeanVariance: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// wrongCountDistribution

test("wrongCountDistribution: the spec example, chapter 19's law and the report 2/1/2", () => {
  const r = wrongCountDistribution([2, 1, 2], CH19.states, CH19.probs);
  assert.deepEqual(r, { N: 2, values: [0, 1], probs: [0.7, 0.3], expected: 0.3, pNone: 0.7, pAllCriteriaRight: 0.7, unionBound: 0.7 });
});

/** A random finite law (S states × n units × K criteria) with small integer values, so ties occur. */
const randomLaw = (S: number, n: number, K: number, seed: number) => {
  const u = uniforms(seed, S * n * K + S);
  const states = Array.from({ length: S }, (_, s) => Array.from({ length: n }, (_, i) => Array.from({ length: K }, (_, k) => Math.floor(u[(s * n + i) * K + k] * 3))));
  const raw = Array.from(u.subarray(S * n * K));
  const total = raw.reduce((a, b) => a + b, 0);
  const probs = raw.map((x) => x / total);
  return { states, probs };
};

test("wrongCountDistribution: probabilities sum to 1, E[A] = evaluateReport's Ew, and a brute-force recount of every field", () => {
  for (const [S, n, K, seed, w, g] of [
    [6, 4, 1, 1, [1], [1, 2, 2, 3]],
    [9, 5, 2, 2, [0.25, 0.75], [2, 1, 3, 1, 2]],
    [12, 4, 3, 3, [0.2, 0.3, 0.5], [1, 2, 3, 4]],
    [5, 3, 2, 4, [0.5, 0.5], [3, 3, 1]],
  ] as const) {
    const { states, probs } = randomLaw(S, n, K, seed);
    const r = wrongCountDistribution(g, states, probs, { w: [...w] });
    close(r.probs.reduce((a, b) => a + b, 0), 1, 1e-12, "total probability");
    for (let v = 1; v < r.values.length; v += 1) assert.ok(r.values[v] > r.values[v - 1], "values ascending and distinct");
    // E[A] = Σ_k w_k Σ_stated Pr(θ_ik ≤ θ_jk) = the expected weighted wrong count of evaluateReport
    const law = finiteLawPairwise(states, probs);
    close(r.expected, evaluateReport([...g], law, { tau: 0.5, w: [...w] }).Ew, 1e-12, "expected = Ew");
    // brute force
    const A: number[] = [];
    let pAll = 0;
    let union = 0;
    states.forEach((st, s) => {
      let a = 0;
      let right = true;
      for (let k = 0; k < K; k += 1) {
        let D = 0;
        for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (g[i] < g[j] && st[i][k] <= st[j][k]) D += 1;
        a += w[k] * D;
        if (D > 0) right = false;
      }
      A.push(a);
      if (right) pAll += probs[s];
    });
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (g[i] < g[j]) for (let k = 0; k < K; k += 1) union += law.e[k][i][j];
    r.values.forEach((v, q) => {
      const mass = A.reduce((acc, a, s) => acc + (a === v ? probs[s] : 0), 0);
      close(r.probs[q], mass, 1e-15, `Pr(A = ${v})`);
    });
    close(r.pNone, A.reduce((acc, a, s) => acc + (a === 0 ? probs[s] : 0), 0), 1e-15, "pNone");
    close(r.pAllCriteriaRight, pAll, 1e-15, "pAllCriteriaRight");
    close(r.unionBound, Math.max(0, 1 - union), 1e-15, "unionBound");
    assert.ok(r.unionBound <= r.pAllCriteriaRight + 1e-15, "the Bonferroni bound is a lower bound");
    if (w.every((x) => x > 0)) assert.equal(r.pNone, r.pAllCriteriaRight);
    // each state's D is realizedWrong's; A is the plain criterion-order sum (realizedWrong's compensated A agrees to
    // about one rounding, exactly for K ≤ 2)
    states.forEach((st, s) => {
      const rw = realizedWrong([...g], st, { w: [...w] });
      let a = 0;
      for (let k = 0; k < K; k += 1) a += w[k] * rw.D[k];
      assert.equal(A[s], a);
      if (K <= 2) assert.equal(A[s], rw.A);
      else close(A[s], rw.A as number, 4e-15, "compensated A");
    });
  }
});

test("wrongCountDistribution: A is a plain criterion-order sum and values are distinct under ===, as the spec states", () => {
  // w = (.2, .3, .5) and the order 1/2/3 (pairs (0, 1), (0, 2), (1, 2)): the first state has D = (1, 3, 2), the
  // second D = (3, 0, 3). Both are 2.1 in exact arithmetic, but the plain sums are 2.0999999999999996 and 2.1, so
  // they are two values (a compensated sum would give 2.1 twice).
  const states = [
    [[2, 1, 3], [3, 2, 2], [1, 3, 4]],
    [[1, 3, 1], [2, 2, 2], [3, 1, 3]],
  ];
  const r = wrongCountDistribution([1, 2, 3], states, [0.5, 0.5], { w: [0.2, 0.3, 0.5] });
  assert.deepEqual(states.map((st) => realizedWrong([1, 2, 3], st, { w: [0.2, 0.3, 0.5] }).D), [[1, 3, 2], [3, 0, 3]]);
  assert.deepEqual(r.values, [0.2 * 1 + 0.3 * 3 + 0.5 * 2, 0.2 * 3 + 0.3 * 0 + 0.5 * 3]);
  assert.deepEqual(r.values, [2.0999999999999996, 2.1]);
  assert.deepEqual(r.probs, [0.5, 0.5]);
});

test("wrongCountDistribution: weak error (a tie is wrong), a zero weight separates pNone from pAllCriteriaRight, N = 0, equal weights", () => {
  // B above A is wrong when they tie
  const tie = wrongCountDistribution([2, 1], [[1, 1], [0, 2]], [0.4, 0.6]);
  assert.deepEqual([tie.values, tie.probs, tie.pNone], [[0, 1], [0.6, 0.4], 0.6]);
  // two criteria, all weight on the first: the second criterion's errors do not change A but break "every criterion right"
  const states = [
    [[2, 0], [1, 5]],
    [[2, 9], [1, 5]],
    [[0, 9], [1, 5]],
  ];
  const r = wrongCountDistribution([1, 2], states, [0.5, 0.3, 0.2], { w: [1, 0] });
  assert.deepEqual(r.values, [0, 1]);
  close(r.pNone, 0.8, 1e-15, "pNone");
  close(r.pAllCriteriaRight, 0.3, 1e-15, "pAllCriteriaRight");
  assert.ok(r.pNone > r.pAllCriteriaRight);
  // unionBound = max(0, 1 − (Pr(θ_A1 ≤ θ_B1) + Pr(θ_A2 ≤ θ_B2))) = max(0, 1 − (.2 + .5)) = .3
  close(r.unionBound, 0.3, 1e-15, "unionBound");
  // N = 0: values [0], probs [1], every probability 1 (exactly, whatever the law)
  assert.deepEqual(wrongCountDistribution([4, 4, 4], CH19.states, CH19.probs), { N: 0, values: [0], probs: [1], expected: 0, pNone: 1, pAllCriteriaRight: 1, unionBound: 1 });
  // the bound is cut at 0 when the stated errors add up past 1
  assert.equal(wrongCountDistribution([3, 2, 1], CH19.states, CH19.probs).unionBound, 0);
  // equal weights (probs null): exact counts over S
  const eq = wrongCountDistribution([1, 2, 3], [[3, 2, 1], [1, 2, 3], [2, 3, 1]], null);
  assert.deepEqual([eq.values, eq.probs, eq.expected], [[0, 1, 3], [1 / 3, 1 / 3, 1 / 3], 4 / 3]);
  // labels need not be consecutive
  assert.deepEqual(wrongCountDistribution([5, 2, 5], CH19.states, CH19.probs), wrongCountDistribution([2, 1, 2], CH19.states, CH19.probs));
});

test("wrongCountDistribution: input checks", () => {
  rangeError(() => wrongCountDistribution([2, 0, 2], CH19.states, CH19.probs), /wrongCountDistribution: g must hold positive integer grade labels/);
  rangeError(() => wrongCountDistribution([2, 1.5, 2], CH19.states, CH19.probs), /positive integer grade labels/);
  rangeError(() => wrongCountDistribution([2, 1], CH19.states, CH19.probs), /one entry per unit \(3\)/);
  rangeError(() => wrongCountDistribution(null as never, CH19.states, CH19.probs), /g must be an array of grade labels/);
  rangeError(() => wrongCountDistribution([2, 1, 2], CH19.states, [0.3, 0.6]), /sum to 1/);
  rangeError(() => wrongCountDistribution([2, 1, 2], CH19.states, [0.3]), /one value per state/);
  rangeError(() => wrongCountDistribution([1, 2], [[[0, 1], [1, 0]]], null), /weights w are required/);
  rangeError(() => wrongCountDistribution([1, 2], [[[0, 1], [1, 0]]], null, { w: [0.5, 0.6] }), /sum to 1/);
  typeError(() => wrongCountDistribution([2, 1, 2], CH19.states, CH19.probs, { tau: 0.2 } as never), /wrongCountDistribution: unknown option "tau"/);
  typeError(() => wrongCountDistribution([2, 1, 2], CH19.states, CH19.probs, [1] as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// disclosedErrorEstimands with case weights

test("disclosedErrorEstimands with weights: the spec example (ERR 4/7, meanFraction 2/3, zeroImputed 1/2, 3/4, 7/12)", () => {
  const cases = [{ A: 2, N: 2 }, { A: 0, N: 3 }, { A: 0, N: 0 }];
  const r = disclosedErrorEstimands(cases, { M: 3, weights: [1 / 2, 1 / 4, 1 / 4] });
  assert.deepEqual(r, { ERR: 4 / 7, meanFraction: 2 / 3, zeroImputed: 1 / 2, positiveFrequency: 3 / 4, meanDisclosure: 7 / 12 });
  // without M: meanDisclosure null; the others unchanged
  assert.deepEqual(disclosedErrorEstimands(cases, { weights: [1 / 2, 1 / 4, 1 / 4] }), { ...r, meanDisclosure: null });
});

test("disclosedErrorEstimands: no weights keeps the equally likely behaviour; equal weights agree with it; zero weights drop cases", () => {
  const cases = [{ A: 2, N: 2 }, { A: 0, N: 3 }, { A: 0, N: 0 }];
  const plain = disclosedErrorEstimands(cases, { M: 3 });
  assert.deepEqual(plain, { ERR: 2 / 5, meanFraction: 1 / 2, zeroImputed: 1 / 3, positiveFrequency: 2 / 3, meanDisclosure: 5 / 9 });
  assert.deepEqual(disclosedErrorEstimands(cases, { M: 3, weights: null }), plain);
  assert.deepEqual(disclosedErrorEstimands(cases, { M: 3, weights: undefined }), plain);
  const eq = disclosedErrorEstimands(cases, { M: 3, weights: [1 / 3, 1 / 3, 1 / 3] });
  for (const key of ["ERR", "meanFraction", "zeroImputed", "positiveFrequency", "meanDisclosure"] as const) {
    close(eq[key] as number, plain[key] as number, 1e-15, `equal weights: ${key}`);
  }
  // a zero weight removes a case: the first two cases at 1/2 each = the unweighted first two cases
  const two = disclosedErrorEstimands(cases.slice(0, 2), { M: 3 });
  const dropped = disclosedErrorEstimands(cases, { M: 3, weights: [0.5, 0.5, 0] });
  for (const key of ["ERR", "meanFraction", "zeroImputed", "positiveFrequency", "meanDisclosure"] as const) {
    close(dropped[key] as number, two[key] as number, 1e-15, `zero weight: ${key}`);
  }
  // when only cases that disclose nothing carry weight: ERR and meanFraction are null, zeroImputed 0
  assert.deepEqual(disclosedErrorEstimands(cases, { M: 3, weights: [0, 0, 1] }), { ERR: null, meanFraction: null, zeroImputed: 0, positiveFrequency: 0, meanDisclosure: 0 });
  // per-case M: Σ p·N/M_case
  const perCase = disclosedErrorEstimands([{ A: 1, N: 2, M: 4 }, { A: 1, N: 3, M: 6 }], { weights: [0.25, 0.75] });
  assert.equal(perCase.meanDisclosure, (0.25 * 2) / 4 + (0.75 * 3) / 6);
  assert.equal(perCase.ERR, (0.25 * 1 + 0.75 * 1) / (0.25 * 2 + 0.75 * 3));
  assert.equal(perCase.meanFraction, ((0.25 * 1) / 2 + (0.75 * 1) / 3) / (0.25 + 0.75));
  assert.equal(perCase.zeroImputed, (0.25 * 1) / 2 + (0.75 * 1) / 3);
  // typed-array weights
  assert.deepEqual(disclosedErrorEstimands(cases, { M: 3, weights: Float64Array.from([0.5, 0.25, 0.25]) }), disclosedErrorEstimands(cases, { M: 3, weights: [0.5, 0.25, 0.25] }));
});

test("disclosedErrorEstimands with weights: input checks", () => {
  const cases = [{ A: 2, N: 2 }, { A: 0, N: 3 }, { A: 0, N: 0 }];
  rangeError(() => disclosedErrorEstimands(cases, { weights: [0.5, 0.5] }), /disclosedErrorEstimands: weights must hold one probability per case \(3\)/);
  rangeError(() => disclosedErrorEstimands(cases, { weights: [0.5, 0.7, -0.2] }), /disclosedErrorEstimands: weights must be finite and ≥ 0/);
  rangeError(() => disclosedErrorEstimands(cases, { weights: [0.5, 0.25, NaNd] }), /weights must be finite and ≥ 0/);
  rangeError(() => disclosedErrorEstimands(cases, { weights: [0.5, 0.25, 0.2] }), /weights must sum to 1/);
  rangeError(() => disclosedErrorEstimands(cases, { weights: 1 as never }), /weights must hold one probability per case/);
  // the case checks run as before
  rangeError(() => disclosedErrorEstimands([{ A: 1, N: 0 }], { weights: [1] }), /discloses nothing/);
  typeError(() => disclosedErrorEstimands(cases, { weight: [1, 0, 0] } as never), /disclosedErrorEstimands: unknown option "weight"/);
});

// ---------------------------------------------------------------------------------------------------------
// leagueGradingReplays

test("leagueGradingReplays: each draw is fixedOrderDP along the posterior-mean order, evaluateReport and realizedWrong", () => {
  const L = league30();
  for (const [seed, opts] of [[LEAGUE_SEED, {}], [77, { replays: 4, priorSd: 0.05, tau: 0.35, cap: 5 }]] as const) {
    const r = leagueGradingReplays(seed, opts);
    const o = { replays: 20, priorSd: 0.15, tau: 0.2, cap: 3, ...opts };
    assert.deepEqual([r.seed, r.replays, r.priorSd, r.tau, r.cap], [seed, o.replays, o.priorSd, o.tau, o.cap]);
    assert.equal(r.draws.length, o.replays);
    r.draws.forEach((d, q) => {
      const est = drawLeague(seed + q + 1).estimate;
      const post = normalPosterior(est, L.se, { priorSd: o.priorSd }) as { mean: number[]; sd: number[] };
      const E = errorArray(post.mean, post.sd);
      const order = post.mean.map((_, i) => i).sort((a, b) => post.mean[b] - post.mean[a] || a - b);
      const dp = fixedOrderDP(E, { order, tau: o.tau, G: o.cap });
      assert.equal(dp.empty, false);
      const grade = (dp as { grade: number[] }).grade;
      const ev = evaluateReport(grade, E, { tau: o.tau });
      const rw = realizedWrong(grade, L.theta);
      assert.deepEqual(d, {
        r: q + 1, seed: seed + q + 1, grade, N: ev.N, E: ev.E[0], EoverN: ev.EoverN[0], D: rw.D[0], DoverN: rw.DoverN[0], risk: ev.risk,
      });
      assert.ok(Math.max(...grade) <= o.cap);
      // the posterior-mean order of strictOrder
      assert.deepEqual(strictOrder(post.mean).map((p) => order[p - 1]), post.mean.map((_, i) => i));
    });
    assert.deepEqual(r.estimands, disclosedErrorEstimands(r.draws.map((d) => ({ A: d.D, N: d.N })), { M: 435 }));
  }
});

test("leagueGradingReplays: the default replays (values for the report) and one grade (cap 1: nothing disclosed)", (t) => {
  const r = leagueGradingReplays();
  assert.deepEqual(r.draws.map((d) => d.seed), Array.from({ length: 20 }, (_, q) => LEAGUE_SEED + q + 1));
  assert.ok(r.draws.every((d) => d.N > 0 && d.EoverN !== null && d.DoverN !== null));
  assert.equal(r.estimands.positiveFrequency, 1);
  t.diagnostic(`leagueGradingReplays() estimands ${JSON.stringify(r.estimands)}`);
  t.diagnostic(`first draw N ${r.draws[0].N}, E ${r.draws[0].E}, D ${r.draws[0].D}, risk ${r.draws[0].risk}`);
  const one = leagueGradingReplays(LEAGUE_SEED, { replays: 3, cap: 1 });
  for (const d of one.draws) {
    assert.deepEqual([d.N, d.E, d.EoverN, d.D, d.DoverN], [0, 0, null, 0, null]);
    assert.ok(d.grade.every((x) => x === 1));
    close(d.risk, 0.2, 1e-15, "all-withheld risk = τ");
  }
  assert.deepEqual(one.estimands, { ERR: null, meanFraction: null, zeroImputed: 0, positiveFrequency: 0, meanDisclosure: 0 });
});

test("leagueGradingReplays: input checks", () => {
  rangeError(() => leagueGradingReplays(0.5), /leagueGradingReplays: seed must be a safe integer/);
  rangeError(() => leagueGradingReplays(LEAGUE_SEED, { replays: 0 }), /replays must be an integer ≥ 1/);
  rangeError(() => leagueGradingReplays(LEAGUE_SEED, { priorSd: 0 }), /leagueGradingReplays: priorSd must be > 0/);
  for (const tau of [0, 0.6, Number.NaN]) rangeError(() => leagueGradingReplays(LEAGUE_SEED, { tau }), /tau must lie in \(0, 1\/2\]/);
  for (const cap of [0, 31, 2.5]) rangeError(() => leagueGradingReplays(LEAGUE_SEED, { cap }), /leagueGradingReplays: cap must be an integer in 1\.\.30/);
  typeError(() => leagueGradingReplays(LEAGUE_SEED, { G: 3 } as never), /leagueGradingReplays: unknown option "G"/);
});

// ---------------------------------------------------------------------------------------------------------
// largestStatedError

test("largestStatedError: the spec example, six sites, 1/1/2/2/3/3: D above E, e .0107781", () => {
  const r = largestStatedError([1, 1, 2, 2, 3, 3], E6);
  assert.deepEqual([r?.i, r?.j], [3, 4]);
  close(r?.e as number, 0.0107781, 5e-8, "e");
  assert.equal(r?.e, statedAbove([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 }).max);
});

test("largestStatedError: equal errors go to the first stated pair in (i, j) order; nothing stated gives null; weights", () => {
  const E = cube([
    [0, 0.3, 0.3],
    [0.7, 0, 0.5],
    [0.7, 0.5, 0],
  ]);
  assert.deepEqual(largestStatedError([1, 2, 2], E), { e: 0.3, i: 0, j: 1 });
  // the report states 1 above 0 and 2 above 0 with equal errors .7: (1, 0) comes before (2, 0)
  assert.deepEqual(largestStatedError([2, 1, 1], E), { e: 0.7, i: 1, j: 0 });
  assert.equal(largestStatedError([1, 1, 1], E), null);
  assert.equal(largestStatedError([7, 7, 7], E), null);
  // it is the maximum of statedAbove over random reports
  for (const seed of [1, 2, 3]) {
    const R = randomCube(6, seed);
    const u = uniforms(seed + 10, 6);
    const g = Array.from(u, (x) => 1 + Math.floor(x * 3));
    const r = largestStatedError(g, R);
    assert.equal(r === null ? null : r.e, statedAbove(g, R, { tau: 0.5 }).max);
    if (r) assert.equal(R.e[0][r.i][r.j], r.e);
  }
  // two criteria: ē = Σ_k w_k e_k
  const two = cube(
    [
      [0, 0.1],
      [0.9, 0],
    ],
    [
      [0, 0.5],
      [0.5, 0],
    ],
  );
  assert.deepEqual(largestStatedError([1, 2], two, { w: [0.25, 0.75] }), { e: 0.25 * 0.1 + 0.75 * 0.5, i: 0, j: 1 });
});

test("largestStatedError: input checks", () => {
  rangeError(() => largestStatedError([1, 2], E6), /one entry per unit \(6\)/);
  rangeError(() => largestStatedError([1, 1, 2, 2, 3, 3.5], E6), /grade labels must be integers/);
  rangeError(() => largestStatedError([1, 2], cube([[0, 0.5], [0.5, 0]], [[0, 0.5], [0.5, 0]])), /weights w are required/);
  typeError(() => largestStatedError([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 } as never), /largestStatedError: unknown option "tau"/);
  typeError(() => largestStatedError([1, 1, 2, 2, 3, 3], E6, 0.2 as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// leastCertainPairs

test("leastCertainPairs: the spec example, six sites, k 3: (C, D) .3618 above C; (A, B) .1884 above A; (E, F) .1444 above E", () => {
  const r = leastCertainPairs(E6, { k: 3 });
  assert.deepEqual(r.map((p) => [p.i, p.j, p.above]), [[2, 3, 2], [0, 1, 0], [4, 5, 4]]);
  close(r[0].e, 0.3618, 5e-5, "C–D");
  close(r[1].e, 0.1884, 5e-5, "A–B");
  close(r[2].e, 0.1444, 5e-5, "E–F");
  // default k 10; k above M is clamped to M
  assert.equal(leastCertainPairs(E6).length, 10);
  const all = leastCertainPairs(E6, { k: 1000 });
  assert.equal(all.length, 15);
  for (let q = 1; q < all.length; q += 1) assert.ok(all[q].e <= all[q - 1].e, "descending");
  assert.deepEqual(leastCertainPairs(E6, { k: 3 }), all.slice(0, 3));
});

test("leastCertainPairs: equal values keep (i, j) order; above = i when ē_ij ≤ ē_ji; weights", () => {
  const E = cube([
    [0, 0.5, 0.2, 0.4],
    [0.5, 0, 0.6, 0.2],
    [0.8, 0.4, 0, 0.3],
    [0.6, 0.8, 0.7, 0],
  ]);
  // mins: (0,1) .5 (equal, above 0), (0,2) .2, (0,3) .4, (1,2) .4 (above 2), (1,3) .2, (2,3) .3
  assert.deepEqual(leastCertainPairs(E, { k: 6 }), [
    { i: 0, j: 1, e: 0.5, above: 0 },
    { i: 0, j: 3, e: 0.4, above: 0 },
    { i: 1, j: 2, e: 0.4, above: 2 },
    { i: 2, j: 3, e: 0.3, above: 2 },
    { i: 0, j: 2, e: 0.2, above: 0 },
    { i: 1, j: 3, e: 0.2, above: 1 },
  ]);
  const two = cube(
    [
      [0, 0.1],
      [0.9, 0],
    ],
    [
      [0, 0.7],
      [0.3, 0],
    ],
  );
  // w = (.5, .5): ē_01 = .5·.1 + .5·.7 = .4 (0.39999999999999997 in double arithmetic), ē_10 = .6
  assert.deepEqual(leastCertainPairs(two, { w: [0.5, 0.5] }), [{ i: 0, j: 1, e: 0.5 * 0.1 + 0.5 * 0.7, above: 0 }]);
  assert.deepEqual(leastCertainPairs(two, { w: [0, 1] }), [{ i: 0, j: 1, e: 0.3, above: 1 }]);
});

test("leastCertainPairs: input checks", () => {
  for (const k of [0, -1, 2.5, Number.POSITIVE_INFINITY]) rangeError(() => leastCertainPairs(E6, { k }), /leastCertainPairs: k must be a positive integer/);
  rangeError(() => leastCertainPairs(E6, { w: [0.5, 0.5] }), /w must hold 1 weights/);
  rangeError(() => leastCertainPairs({ e: [] } as never), /nonempty/);
  typeError(() => leastCertainPairs(E6, { n: 3 } as never), /leastCertainPairs: unknown option "n"/);
  typeError(() => leastCertainPairs(E6, 3 as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// transformedMeans

test("transformedMeans: the spec example, chapter 19's law (identity 6, 4, 3; sqrt 1.341641, 2, 1.732051) and a lognormal mean", () => {
  const id = transformedMeans(CH19);
  close(id.means[0], 6, 1e-15, "A");
  close(id.means[1], 4, 1e-15, "B");
  close(id.means[2], 3, 1e-15, "C");
  assert.deepEqual(id.order, [0, 1, 2]);
  const sq = transformedMeans(CH19, { transform: "sqrt" });
  close(sq.means[0], 1.341641, 5e-7, "√ A");
  close(sq.means[1], 2, 1e-15, "√ B");
  close(sq.means[2], 1.732051, 5e-7, "√ C");
  assert.deepEqual(sq.order, [1, 2, 0]);
  const ln = transformedMeans({ means: [0], sds: [1] }, { transform: "exp" });
  close(ln.means[0], 1.648721, 5e-7, "exp(1/2)");
  assert.equal(ln.means[0], Math.exp(0.5));
  // the pair probabilities do not change under the increasing transform (so neither do grades)
  const sqrtStates = CH19.states.map((st) => st.map(Math.sqrt));
  assert.deepEqual(finiteLawPairwise(sqrtStates, CH19.probs).e, finiteLawPairwise(CH19.states, CH19.probs).e);
});

test("transformedMeans: finite-law means summed in state order; log and exp(kθ); a criterion; equal means in index order", () => {
  const law = { states: [[[1, 4], [2, 1]], [[3, 1], [2, 2]]], probs: [0.25, 0.75] };
  const id0 = transformedMeans(law);
  assert.deepEqual(id0.means, [0.25 * 1 + 0.75 * 3, 0.25 * 2 + 0.75 * 2]);
  assert.deepEqual(transformedMeans(law, { criterion: 1 }).means, [0.25 * 4 + 0.75 * 1, 0.25 * 1 + 0.75 * 2]);
  assert.deepEqual(transformedMeans(law, { transform: "log" }).means, [0.25 * Math.log(1) + 0.75 * Math.log(3), 0.25 * Math.log(2) + 0.75 * Math.log(2)]);
  assert.deepEqual(transformedMeans(law, { transform: "exp", k: -0.5 }).means, [0.25 * Math.exp(-0.5) + 0.75 * Math.exp(-1.5), 0.25 * Math.exp(-1) + 0.75 * Math.exp(-1)]);
  // identity on a finite law = rankSummaries' posterior means
  const { states, probs } = randomLaw(7, 5, 1, 9);
  const flat = states.map((st) => st.map((x) => x[0]));
  const tm = transformedMeans({ states: flat, probs });
  rankSummaries({ states: flat, probs }).means.forEach((m, i) => close(tm.means[i], m, 1e-15, `unit ${i}`));
  // equal weights (probs null)
  assert.deepEqual(transformedMeans({ states: [[1, 2], [3, 2]] }).means, [2, 2]);
  // equal means in index order; the order is by mean descending
  assert.deepEqual(transformedMeans({ states: [[1, 2, 2, 0]], probs: [1] }).order, [1, 2, 0, 3]);
  // normal posteriors: identity returns the means; exp(k·m + k²s²/2); one common SD
  assert.deepEqual(transformedMeans({ means: [0.5, -1, 0.5], sds: [0.1, 0.2, 0.3] }), { means: [0.5, -1, 0.5], order: [0, 2, 1] });
  const ex = transformedMeans({ means: [0.5, -1, 0.5], sds: [0.1, 0.2, 0.3] }, { transform: "exp", k: 2 });
  assert.deepEqual(ex.means, [Math.exp(2 * 0.5 + (4 * 0.01) / 2), Math.exp(-2 + (4 * 0.04) / 2), Math.exp(1 + (4 * (0.3 * 0.3)) / 2)]);
  assert.deepEqual(ex.order, [2, 0, 1]);
  assert.deepEqual(transformedMeans({ means: [0, 1], sds: 0.5 }, { transform: "exp" }), transformedMeans({ means: [0, 1], sds: [0.5, 0.5] }, { transform: "exp" }));
});

test("transformedMeans: input checks (support errors name the unit)", () => {
  rangeError(() => transformedMeans({ states: [[1, -1], [2, 3]], probs: [0.5, 0.5] }, { transform: "sqrt" }), /transformedMeans: "sqrt" needs θ ≥ 0, but unit 1 is -1 in state 0/);
  rangeError(() => transformedMeans({ states: [[1, 4], [0, 3]], probs: [0.5, 0.5] }, { transform: "log" }), /"log" needs θ > 0, but unit 0 is 0 in state 1/);
  // a zero-probability state is still checked
  rangeError(() => transformedMeans({ states: [[1, 4], [-1, 3]], probs: [1, 0] }, { transform: "sqrt" }), /unit 0/);
  rangeError(() => transformedMeans({ means: [0, 1], sds: [1, 1] }, { transform: "sqrt" }), /normal posteriors take transform "identity" or "exp"/);
  rangeError(() => transformedMeans({ means: [0, 1], sds: [1, 1] }, { transform: "log" }), /normal posteriors take transform/);
  rangeError(() => transformedMeans(CH19, { transform: "square" as never }), /transform must be "identity", "sqrt", "log" or "exp"/);
  for (const k of [0, Number.POSITIVE_INFINITY, Number.NaN]) rangeError(() => transformedMeans(CH19, { transform: "exp", k }), /transformedMeans: k must be a finite nonzero number/);
  rangeError(() => transformedMeans(CH19, { criterion: 1 }), /criterion must be an integer in 0\.\.0/);
  rangeError(() => transformedMeans(CH19, { criterion: -1 }), /criterion must be a criterion index/);
  rangeError(() => transformedMeans({ means: [0, 1], sds: [1, 1] }, { criterion: 1 }), /normal posteriors have one criterion/);
  rangeError(() => transformedMeans({ means: [0, 1], sds: [1, -1] }), /law\.sds must be ≥ 0/);
  rangeError(() => transformedMeans({ states: CH19.states, probs: [0.5, 0.6] }), /sum to 1/);
  rangeError(() => transformedMeans(null as never), /law must be \{ states, probs \}/);
  rangeError(() => transformedMeans({ values: [1] } as never), /law must be \{ states, probs \}/);
  typeError(() => transformedMeans({ states: CH19.states, probs: CH19.probs, means: [1] } as never), /unknown key "means"/);
  typeError(() => transformedMeans(CH19, { scale: "log" } as never), /transformedMeans: unknown option "scale"/);
});

// ---------------------------------------------------------------------------------------------------------
// selectionOnDraws

test("selectionOnDraws: the spec example (ê = 1/4, e = .4, τ .45: gap −.15, bound .15, regret 0, regretBound .3)", () => {
  const E = cube([
    [0, 0.4],
    [0.6, 0],
  ]);
  const r = selectionOnDraws([[1, 0], [1, 0], [0, 1], [1, 0]], E, { tau: 0.45 });
  assert.deepEqual(r.grade, [1, 2]);
  assert.equal(r.N, 1);
  assert.equal(r.inSample, 0.25);
  assert.equal(r.exact, 0.4);
  close(r.gap, -0.15, 1e-15, "gap");
  assert.equal(r.epsilon.length, 1);
  close(r.epsilon[0], 0.15, 1e-15, "epsilon");
  close(r.deltaW, 0.15, 1e-15, "deltaW");
  close(r.bound, 0.15, 1e-15, "bound");
  assert.equal(r.best, 0.4);
  assert.equal(r.regret, 0);
  close(r.regretBound, 0.3, 1e-15, "regretBound");
});

test("selectionOnDraws: |gap| ≤ bound and 0 ≤ regret ≤ regretBound on Gaussian draws (one and two criteria, capped family)", () => {
  const SIXB = [0.7, 0.4, 0.9, 0.6, -0.5, -0.7];
  const means2 = SIX.map((a, i) => [a, SIXB[i]]);
  const cases = [
    { draws: gaussianDraws(SIX, 0.2, 40, 1), E: E6, options: { tau: 0.2 } },
    { draws: gaussianDraws(SIX, 0.2, 15, 2), E: E6, options: { tau: 0.3, family: { kind: "atMost" as const, G: 3 } } },
    { draws: gaussianDraws(means2, 0.2, 60, 3), E: errorArray(means2, 0.2), options: { tau: 0.25, w: [0.5, 0.5] } },
    { draws: gaussianDraws(means2, 0.2, 25, 4), E: errorArray(means2, 0.2), options: { tau: 0.15, w: [0.3, 0.7], family: { kind: "exactly" as const, G: 2 } } },
  ];
  for (const { draws, E, options } of cases) {
    const r = selectionOnDraws(draws, E, options);
    const Ehat = drawErrors(draws);
    const chosen = exactOptimum(Ehat, options);
    const star = exactOptimum(E, options);
    assert.equal(chosen.empty || star.empty, false);
    assert.deepEqual(r.grade, (chosen as { grade: number[] }).grade);
    const w = (options as { w?: number[] }).w ?? [1];
    assert.equal(r.inSample, evaluateReport(r.grade, Ehat, { tau: options.tau, w }).risk);
    assert.equal(r.exact, evaluateReport(r.grade, E, { tau: options.tau, w }).risk);
    assert.equal(r.best, (star as { risk: number }).risk);
    assert.equal(r.gap, r.inSample - r.exact);
    assert.equal(r.regret, r.exact - r.best);
    // ε_k = max_{i≠j} |ê − e|, δ_w = weightedRadius(ε, w), the bounds = regretBound
    r.epsilon.forEach((eps, k) => {
      let m = 0;
      for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) if (i !== j) m = Math.max(m, Math.abs(Ehat.e[k][i][j] - E.e[k][i][j]));
      assert.equal(eps, m);
    });
    assert.equal(r.deltaW, weightedRadius(r.epsilon, w));
    const b = regretBound({ N: r.N, Nstar: (star as { N: number }).N, M: 15, deltaW: r.deltaW });
    assert.deepEqual([r.bound, r.regretBound], [b.evaluation, b.regret]);
    // the guarantees of ch. 15
    assert.ok(Math.abs(r.gap) <= r.bound + 1e-12, `|gap| ${Math.abs(r.gap)} ≤ bound ${r.bound}`);
    assert.ok(r.regret >= -1e-12, `regret ${r.regret} ≥ 0`);
    assert.ok(r.regret <= r.regretBound + 1e-12, `regret ${r.regret} ≤ ${r.regretBound}`);
  }
});

test("selectionOnDraws: input checks", () => {
  const E = cube([
    [0, 0.4],
    [0.6, 0],
  ]);
  const draws = [[1, 0], [0, 1]];
  rangeError(() => selectionOnDraws([[1, 0, 2]], E, { tau: 0.45 }), /selectionOnDraws: draws must be S × 2 units × 1 criteria, as E/);
  rangeError(() => selectionOnDraws([[[1, 0], [0, 1]]], E, { tau: 0.45 }), /draws must be S × 2 units × 1 criteria/);
  rangeError(() => selectionOnDraws([], E, { tau: 0.45 }), /nonempty/);
  rangeError(() => selectionOnDraws(draws, E, { tau: 0.6 }), /tau must lie in \(0, 1\/2\]/);
  rangeError(() => selectionOnDraws(draws, E, { tau: 0.2, w: [0.5, 0.5] }), /w must hold 1 weights/);
  rangeError(() => selectionOnDraws(gaussianDraws(new Array(9).fill(0), 1, 3, 1), errorArray(new Array(9).fill(0), 1), { tau: 0.2 }), /exact enumeration covers at most 600,000 reports/);
  typeError(() => selectionOnDraws(draws, E, { tau: 0.2, tieTol: 0 } as never), /selectionOnDraws: unknown option "tieTol"/);
  typeError(() => selectionOnDraws(draws, E, 0.2 as never), /options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// pairCertainty

test("pairCertainty: the spec example, six sites, thresholds .9 and .99: 12 and 11 of 15", () => {
  assert.deepEqual(pairCertainty(E6), { M: 15, thresholds: [0.9, 0.99], counts: [12, 11] });
  assert.deepEqual(pairCertainty(E6, { thresholds: [0.9, 0.99] }), pairCertainty(E6));
});

test("pairCertainty: strict at 1 − threshold; equals confidentPairs at τ = 1 − threshold; weights", () => {
  const cut = 1 - 0.9; // 0.09999999999999998 in double arithmetic
  const E = cube([
    [0, cut, 0.05],
    [1 - cut, 0, 0.5],
    [0.95, 0.5, 0],
  ]);
  // (0,1) at exactly 1 − .9 is not counted; (0,2) .05 is; (1,2) .5 is not
  assert.deepEqual(pairCertainty(E, { thresholds: [0.9] }).counts, [1]);
  assert.deepEqual(pairCertainty(E, { thresholds: [0.9 - 1e-15] }).counts, [2]);
  for (const seed of [1, 2, 3]) {
    const R = randomCube(8, seed);
    const th = [0.55, 0.7, 0.8, 0.95];
    const r = pairCertainty(R, { thresholds: th });
    th.forEach((t, q) => assert.equal(r.counts[q], confidentPairs(new Array(8).fill(1), R, { tau: 1 - t }).count));
    for (let q = 1; q < th.length; q += 1) assert.ok(r.counts[q] <= r.counts[q - 1], "higher thresholds count fewer pairs");
  }
  // 1 − threshold is computed in double arithmetic: 1 − .99 = 0.010000000000000009, so e = .01 counts at .99,
  // while 1 − .9 = 0.09999999999999998, so e = .1 does not count at .9
  assert.equal(1 - 0.99, 0.010000000000000009);
  assert.deepEqual(pairCertainty(cube([[0, 0.01], [0.99, 0]])).counts, [1, 1]);
  assert.deepEqual(pairCertainty(cube([[0, 0.1], [0.9, 0]])).counts, [0, 0]);
  const two = cube(
    [
      [0, 0.011],
      [0.989, 0],
    ],
    [
      [0, 0.5],
      [0.5, 0],
    ],
  );
  assert.deepEqual(pairCertainty(two, { w: [1, 0] }).counts, [1, 0]);
  assert.deepEqual(pairCertainty(two, { w: [0.5, 0.5] }).counts, [0, 0]);
});

test("pairCertainty: input checks", () => {
  for (const t of [0.5, 1, 0.4, Number.NaN]) rangeError(() => pairCertainty(E6, { thresholds: [t] }), /pairCertainty: thresholds must lie in \(1\/2, 1\)/);
  rangeError(() => pairCertainty(E6, { thresholds: [0.99, 0.9] }), /strictly increasing/);
  rangeError(() => pairCertainty(E6, { thresholds: [0.9, 0.9] }), /strictly increasing/);
  rangeError(() => pairCertainty(E6, { thresholds: [] }), /nonempty array/);
  rangeError(() => pairCertainty({ ids: ["A"], criteria: ["k1"], e: [[[NaNd]]] }), /at least two units/);
  typeError(() => pairCertainty(E6, { threshold: 0.9 } as never), /pairCertainty: unknown option "threshold"/);
});
