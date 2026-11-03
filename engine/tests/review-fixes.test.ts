// Step 2.12: the engine fixes for the review findings E-1 … E-22 (engine/API.md), one test
// (or more) per decision. E-4, E-5, E-6 and E-20 are not engine changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { errorArray, finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { type Family, familySize, scoreOrder } from "../src/report.ts";
import { evaluateReport, krwRisk, pairDecision, relaxedPairRisk, statedAbove, tauToLambda } from "../src/risk.ts";
import { rng } from "../src/random.ts";
import {
  ENUMERATION_BUDGET, enumerateReports, exactOptimum, fixedOrderDP, tauPath, weightBreakpoints, weightPath,
  type ExactOptimum, type FixedOrderResult, type TauPath, type WeightBreakpoints, type WeightPathPoint,
} from "../src/optimize.ts";
import { ORDER_HULL_BUDGET, lowerHull, orderHull, reportCloud, supportingVertex, type HullVertex, type ReportCloud } from "../src/frontier.ts";
import { budgetFamily, commonalityCost, conflictPairs, minimaxChoice, type MinimaxChoice } from "../src/multi.ts";
import { envelopeRadius } from "../src/simulate.ts";
import { NA, NO_DISCLOSURE, formatEoverN, formatProb } from "../src/format.ts";
import { normalQuantile } from "../src/special.ts";

const close = (got: number | null | undefined, want: number, tol: number, what = "") =>
  assert.ok(got != null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);
const B6 = [0.3, 1.0, -0.2, 0.6, 0.1, -0.4];
const E6x2 = errorArray(SIX.map((a, i) => [a, B6[i]]), 0.2);

// Theory-book three-unit law (ch. 10): ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10.
const LAW3 = finiteLawPairwise([[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]], [3 / 5, 3 / 20, 3 / 20, 1 / 10]);

/** An error array with every off-diagonal entry 1/2 (equal means): every report ties at τ = 1/2. */
function halves(n: number): ErrorArray {
  return errorArray(new Array<number>(n).fill(0), 1);
}

/** A random tie-free error array (e_ji = 1 − e_ij), optionally from a discrete set of values. */
function randomE(seed: number, n: number, K: number, values?: readonly number[]): ErrorArray {
  const u = rng(seed);
  const e = Array.from({ length: K }, () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? Number.NaN : 0))));
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const x = values ? values[Math.floor(u() * values.length)] : u();
        e[k][i][j] = x;
        e[k][j][i] = 1 - x;
      }
    }
  }
  return { ids: Array.from({ length: n }, (_, i) => `U${i}`), criteria: Array.from({ length: K }, (_, k) => `k${k}`), e };
}

function shuffle(seed: number, n: number): number[] {
  const u = rng(seed);
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(u() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

const opt = (E: ErrorArray, o: Parameters<typeof exactOptimum>[1]) => {
  const r = exactOptimum(E, o);
  assert.equal(r.empty, false);
  return r as ExactOptimum;
};
const dp = (E: ErrorArray, o: Parameters<typeof fixedOrderDP>[1]) => {
  const r = fixedOrderDP(E, o);
  assert.equal(r.empty, false);
  return r as FixedOrderResult;
};

// ---------------------------------------------------------------------------------------------------------
// E-1: one family, one report

test("E-1: the ch. 10 law along ABC at τ = 1/5: exactOptimum and fixedOrderDP both choose 1/2/2 and list both optima", () => {
  const family: Family = { kind: "order", order: [0, 1, 2] };
  const en = opt(LAW3, { tau: 1 / 5, family });
  const d = dp(LAW3, { tau: 1 / 5, order: [0, 1, 2] });
  assert.deepEqual(en.grade, [1, 2, 2], "package rule: equal grades, the earlier cut");
  assert.deepEqual(d.grade, [1, 2, 2]);
  assert.deepEqual(en.grades, [[1, 1, 2], [1, 2, 2]], "grades stay lexicographic");
  assert.deepEqual(d.grades, en.grades);
  assert.equal(d.gradesOrder, "lexicographic");
  assert.equal(en.tieCount, 2);
  assert.equal(d.tieCount, 2);
  close(en.risk, 11 / 60, 1e-15, "risk");
  close(d.risk, 11 / 60, 1e-15, "risk");
  // other families keep the lexicographically first optimum
  assert.deepEqual(opt(LAW3, { tau: 1 / 5 }).grade, [1, 1, 2]);
  // fewer grades win over earlier cuts: every error 1/2 at τ = 1/2 ties all 16 cuts of 5 units
  const E = halves(5);
  const order = [3, 0, 4, 1, 2];
  const all = opt(E, { tau: 0.5, family: { kind: "order", order } });
  assert.deepEqual(all.grade, [1, 1, 1, 1, 1]);
  assert.equal(all.tieCount, 16);
  const ex3 = opt(E, { tau: 0.5, family: { kind: "order", order, exact: 3 } });
  const dp3 = dp(E, { tau: 0.5, order, exact: 3 });
  assert.deepEqual(ex3.grade, dp3.grade);
  assert.deepEqual(dp3.cuts, [1, 2]);
  assert.deepEqual(ex3.grades, dp3.grades);
  assert.equal(dp3.tieCount, 6);
});

test("E-1: on random tie-heavy order families exactOptimum and fixedOrderDP return the same grade and the same tied list", () => {
  let ties = 0;
  for (let seed = 1; seed <= 300; seed += 1) {
    const n = 2 + (seed % 6);
    const E = randomE(seed, n, 1, seed % 3 === 0 ? [0.5] : [0, 0.25, 0.5, 0.75, 1]);
    const tau = [0.25, 0.5][seed % 2];
    const order = shuffle(seed + 7, n);
    const mode = seed % 3;
    const family: Family = { kind: "order", order, ...(mode === 1 ? { G: 1 + (seed % n) } : mode === 2 ? { exact: 1 + ((seed * 3) % n) } : {}) };
    const en = opt(E, { tau, family, maxTies: Infinity });
    const d = dp(E, { tau, family, maxTies: Infinity });
    assert.deepEqual(d.grade, en.grade, `seed ${seed}`);
    assert.deepEqual(d.grades, en.grades, `seed ${seed}`);
    assert.equal(d.tieCount, en.tieCount, `seed ${seed}`);
    assert.equal(en.grades.length, en.tieCount);
    if (en.tieCount > 1) ties += 1;
  }
  assert.ok(ties >= 50, `${ties} cases with tied optima`);
});

test("E-1: fixedOrderDP counts tied cut sets beyond 2^53 and lists the first ones in the package's order", () => {
  const E = halves(60);
  const order = Array.from({ length: 60 }, (_, i) => i);
  const d = dp(E, { tau: 0.5, order });
  assert.equal(d.tieCount, "576460752303423488", "all 2^59 cut sets tie");
  assert.equal(d.tieCountExact, 2n ** 59n);
  assert.equal(d.gradesOrder, "package");
  assert.equal(d.grades.length, 100);
  assert.deepEqual(d.grades[0], d.grade);
  assert.deepEqual(d.grade, new Array<number>(60).fill(1));
  assert.equal(new Set(d.grades.map((g) => g.join())).size, 100);
  // two grades next, with the earliest cut first
  assert.deepEqual(d.grades[1], [1, ...new Array<number>(59).fill(2)]);
  assert.doesNotThrow(() => JSON.stringify(d));
});

// ---------------------------------------------------------------------------------------------------------
// E-2: family is read (or refused), never ignored; unknown option keys throw

test("E-2: fixedOrderDP and orderHull take the family form; every exported options object refuses unknown keys", () => {
  const E = errorArray([2, 1.6, 1.1, 0.7, 0.2, -0.3], 0.3);
  const order = [0, 1, 2, 3, 4, 5];
  const top = dp(E, { tau: 0.2, order, G: 2 });
  const viaAtMost = dp(E, { tau: 0.2, order, family: { kind: "atMost", G: 2 } });
  const viaOrder = dp(E, { tau: 0.2, family: { kind: "order", order, G: 2 } });
  assert.ok(top.G <= 2);
  assert.deepEqual(viaAtMost.grade, top.grade);
  assert.deepEqual(viaOrder.grade, top.grade);
  assert.equal(viaAtMost.family.name, "𝒜ᵨ,≤2");
  assert.deepEqual(dp(E, { tau: 0.2, order, family: { kind: "exactly", G: 3 } }).grade, dp(E, { tau: 0.2, order, exact: 3 }).grade);
  const hullTop = orderHull(E, { order, G: 2 }) as HullVertex[];
  assert.deepEqual(orderHull(E, { order, family: { kind: "atMost", G: 2 } }), hullTop);
  assert.deepEqual(orderHull(E, { family: { kind: "order", order, G: 2 } }), hullTop);
  assert.ok(hullTop.length < (orderHull(E, { order }) as HullVertex[]).length);
  // given twice, or missing
  assert.throws(() => fixedOrderDP(E, { tau: 0.2, order, G: 3, family: { kind: "atMost", G: 2 } }), /given twice/);
  assert.throws(() => fixedOrderDP(E, { tau: 0.2, order, family: { kind: "order", order } }), /given twice/);
  assert.throws(() => fixedOrderDP(E, { tau: 0.2, family: { kind: "atMost", G: 2 } }), /needs a declared order/);
  assert.throws(() => fixedOrderDP(E, { tau: 0.2, family: { kind: "order", order, cap: 2 } as never }), /unknown key "cap"/);
  // unknown option keys, in a sample of modules
  assert.throws(() => fixedOrderDP(E, { tau: 0.2, order, cap: 2 } as never), /fixedOrderDP: unknown option "cap"/);
  assert.throws(() => orderHull(E, { order, tau: 0.2 } as never), /orderHull: unknown option "tau"/);
  assert.throws(() => exactOptimum(E, { tau: 0.2, famly: { kind: "all" } } as never), /unknown option "famly"/);
  assert.throws(() => tauPath(E, { G: 2 } as never), /tauPath: unknown option "G"/);
  assert.throws(() => reportCloud(E, { tol: 1e-9 } as never), /unknown option "tol" \(it is now called tieTol\)/);
  assert.throws(() => evaluateReport([1, 2, 3, 4, 5, 6], E, { tau: 0.2, weights: [1] } as never), /unknown option "weights"/);
  assert.throws(() => formatProb(0.2, { digit: 2 } as never), /formatProb: unknown option "digit"/);
  assert.throws(() => normalQuantile(0.2, { lower: false } as never), /unknown option "lower"/);
  assert.throws(() => errorArray([1, 0], 1, { orientation: [1] } as never), /unknown option "orientation"/);
  assert.throws(() => familySize(3, { kind: "atMost", G: 2, exact: 1 } as never), /unknown key "exact"/);
  assert.throws(() => enumerateReports(3, { kind: "all" }, { resue: true } as never), /unknown option "resue"/);
});

// ---------------------------------------------------------------------------------------------------------
// E-3: a bounded list of tied optima

test("E-3: equal means at τ = 1/2 tie all 545,835 reports of n = 8; grades holds maxTies of them, tieCount all", (t) => {
  const E = halves(8);
  const before = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const r = opt(E, { tau: 0.5 });
  const ms = performance.now() - t0;
  const heapMB = (process.memoryUsage().heapUsed - before) / 2 ** 20;
  assert.equal(r.tieCount, 545835);
  assert.equal(r.grades.length, 100);
  const lex: number[][] = [];
  for (const g of enumerateReports(8)) {
    lex.push(Array.from(g));
    if (lex.length === 100) break;
  }
  assert.deepEqual(r.grades, lex, "the first 100 in lexicographic order");
  assert.equal(opt(E, { tau: 0.5, maxTies: 3 }).grades.length, 3);
  assert.throws(() => exactOptimum(E, { tau: 0.5, maxTies: 0 }), /maxTies/);
  const m = minimaxChoice(E, { tau: 0.5 }) as MinimaxChoice;
  assert.equal(m.minimax.tieCount, 545835);
  assert.equal(m.minimax.grades.length, 100);
  assert.equal(m.weighted.tieCount, 545835);
  assert.equal((minimaxChoice(halves(5), { tau: 0.5, maxTies: 7 }) as MinimaxChoice).minimax.grades.length, 7);
  t.diagnostic(`exactOptimum, 545,835 tied reports: ${ms.toFixed(0)} ms, heap +${heapMB.toFixed(0)} MB`);
  assert.ok(ms < 5000);
});

// ---------------------------------------------------------------------------------------------------------
// E-7: the book's envelope radius has K

test("E-7: envelopeRadius book form √(log(4MK/α)/(2S)); the package form is unchanged and has no K", () => {
  close(envelopeRadius(15, 1000, 0.05, "book", { K: 2 }), Math.sqrt(Math.log((4 * 15 * 2) / 0.05) / 2000), 1e-16);
  close(envelopeRadius(15, 1000, 0.05, "book", { K: 2 }), 0.0624, 5e-5, "M = 15, K = 2");
  close(envelopeRadius(15, 1000, 0.05, "book"), 0.0595, 5e-5, "K = 1");
  assert.equal(envelopeRadius(15, 1000, 0.05, "package", { K: 2 }), envelopeRadius(15, 1000, 0.05, "package"));
  close(envelopeRadius(15, 1000, 0.05), 0.0566, 5e-5);
  assert.throws(() => envelopeRadius(15, 1000, 0.05, "book", { K: 0 }), /K must be a positive integer/);
  assert.throws(() => envelopeRadius(15, 1000, 0.05, "book", { k: 2 } as never), /unknown option "k"/);
});

// ---------------------------------------------------------------------------------------------------------
// E-8: the package's order and blocks from scores

test("E-8: scoreOrder builds the package's order and exact-equality blocks; fixedOrderDP and orderHull take scores", () => {
  assert.deepEqual(scoreOrder([3, 3, 2, 2, 1, 1]), { order: [0, 1, 2, 3, 4, 5], blocks: [2, 2, 2] });
  assert.deepEqual(scoreOrder([1, 3, 2, 3]), { order: [1, 3, 2, 0], blocks: [2, 1, 1] });
  assert.deepEqual(scoreOrder([1, 3, 2, 3], { direction: "ascending" }), { order: [0, 2, 1, 3], blocks: [1, 1, 2] });
  // ties go to the entity id in code-point order ("B" < "a" < "b"), not to the index
  assert.deepEqual(scoreOrder([5, 5, 5], { ids: ["b", "a", "B"] }).order, [2, 1, 0]);
  assert.throws(() => scoreOrder([1, 2], { ids: ["a", "a"] }), /distinct/);
  assert.throws(() => scoreOrder([1, Number.NaN]), /finite/);
  // declared scores tie in pairs; the posterior means do not, so without blocks the DP would split the ties
  const E = errorArray([3, 2.9, 2, 1.9, 1, 0.9], 0.1);
  const scores = [3, 3, 2, 2, 1, 1];
  const free = dp(E, { tau: 0.4, order: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(free.grade, [1, 2, 3, 4, 5, 6]);
  const viaScores = dp(E, { tau: 0.4, scores });
  assert.deepEqual(viaScores.grade, [1, 1, 2, 2, 3, 3]);
  assert.deepEqual(viaScores.blocks, [2, 2, 2]);
  assert.deepEqual(viaScores.order, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(viaScores.grade, dp(E, { tau: 0.4, ...scoreOrder(scores) }).grade);
  assert.match(viaScores.family.words, /equal order scores kept together/);
  // the tie order uses E.ids by default
  const Eids: ErrorArray = { ...E, ids: ["F", "E", "D", "C", "B", "A"] };
  assert.deepEqual(dp(Eids, { tau: 0.4, scores }).order, [1, 0, 3, 2, 5, 4]);
  assert.deepEqual(orderHull(E, { scores }), orderHull(E, { ...scoreOrder(scores) }));
  assert.throws(() => fixedOrderDP(E, { tau: 0.4, scores, order: [0, 1, 2, 3, 4, 5] }), /not both/);
  assert.throws(() => fixedOrderDP(E, { tau: 0.4, order: [0, 1, 2, 3, 4, 5], direction: "ascending" }), /only together with scores/);
  assert.throws(() => fixedOrderDP(E, { tau: 0.4, scores: [1, 2, 3] }), /one value per unit/);
});

// ---------------------------------------------------------------------------------------------------------
// E-9, E-10: tie laws

// m4 law (ch. 11): B = 1; A = 0, 1, 2 with probabilities .1, .4, .5 (Pr(A = B) = .4)
const M4 = finiteLawPairwise([[0, 1], [1, 1], [2, 1]], [0.1, 0.4, 0.5]);

test("E-9: krwRisk refuses a law with latent ties when given its equality probabilities t", () => {
  const lambda = tauToLambda(0.25);
  assert.throws(() => krwRisk([1, 2], M4, { lambda, t: M4.t }), /the KRW correspondence needs a tie-free law/);
  // a tie-free law passes and gives the same number as without t
  assert.equal(krwRisk([1, 1, 2], LAW3, { lambda, t: LAW3.t }), krwRisk([1, 1, 2], LAW3, { lambda }));
  // without t nothing is checked (the documented tie-free assumption)
  assert.equal(typeof krwRisk([1, 2], M4, { lambda }), "number");
  assert.throws(() => krwRisk([1, 1, 2], LAW3, { lambda, t: M4.t }), /t must be one 3 × 3 matrix/);
});

test("E-10: conflictPairs compares e_ij with e_ji, so a likely tie is not read as the reverse direction", () => {
  // criterion 1: A > B with .25, A = B with .75 (e_AB = .75 < e_BA = 1: A is the more likely above);
  // criterion 2: A > B always. No conflict, although e_AB,1 > 1/2.
  const law = finiteLawPairwise([[[2, 2], [1, 1]], [[1, 2], [1, 1]]], [0.25, 0.75]);
  assert.equal(law.e[0][0][1], 0.75);
  assert.equal(law.e[0][1][0], 1);
  assert.equal(conflictPairs(law).count, 0);
  // reverse criterion 2: now a conflict, A above on criterion 1, B above on criterion 2
  const flip = finiteLawPairwise([[[2, 1], [1, 2]], [[1, 1], [1, 2]]], [0.25, 0.75]);
  assert.deepEqual(conflictPairs(flip).pairs, [{ i: 0, j: 1, iAbove: [0], jAbove: [1] }]);
  // tie-free inputs are unchanged (e_ij < 1/2 ⇔ e_ij < e_ji)
  const E2 = errorArray(SIX.map((a, i) => [a, [0.7, 0.4, 0.9, 0.6, -0.5, -0.7][i]]), 0.2);
  assert.equal(conflictPairs(E2).count, 3);
});

// ---------------------------------------------------------------------------------------------------------
// E-11: tieTol 0 is the package's exact comparison

test("E-11: fixedOrderDP with tieTol: 0 compares exactly, as the package (e_AB = .1 + .2, e_BC = .3, τ = .25)", () => {
  const eAB = 0.1 + 0.2;
  const E: ErrorArray = {
    ids: ["A", "B", "C"],
    criteria: ["k1"],
    e: [[[Number.NaN, eAB, 0.1], [1 - eAB, Number.NaN, 0.3], [0.9, 0.7, Number.NaN]]],
  };
  const order = [0, 1, 2];
  const exact = dp(E, { tau: 0.25, order, tieTol: 0 });
  assert.deepEqual(exact.grade, [1, 1, 2], "postrank_cuts: the smaller sum wins, 1/1/2");
  assert.equal(exact.tieCount, 1);
  const tol = dp(E, { tau: 0.25, order });
  assert.deepEqual(tol.grade, [1, 2, 2], "within 1e-12 the two tie and the earlier cut wins");
  assert.equal(tol.tieCount, 2);
  assert.equal(tol.tieTol, 1e-12);
  assert.equal(exact.tieTol, 0);
});

// ---------------------------------------------------------------------------------------------------------
// E-12: sizes stay serializable

test("E-12: family.size is a number up to 2^53 and a decimal string above, with sizeExact as a BigInt", () => {
  const E60 = halves(60);
  const d60 = dp(E60, { tau: 0.2, order: Array.from({ length: 60 }, (_, i) => i) });
  assert.equal(d60.family.size, "576460752303423488");
  assert.equal(d60.family.sizeExact, 2n ** 59n);
  assert.equal(familySize(60, { kind: "order", order: Array.from({ length: 60 }, (_, i) => i) }), 2n ** 59n);
  const json = JSON.parse(JSON.stringify(d60)) as FixedOrderResult;
  assert.equal(json.family.size, "576460752303423488");
  assert.equal("sizeExact" in json.family, false, "the BigInt stays out of JSON");
  // 2^53 is still a number (exact as a double); 2^53 + … above becomes a string
  const d54 = dp(halves(54), { tau: 0.2, order: Array.from({ length: 54 }, (_, i) => i) });
  assert.equal(d54.family.size, 2 ** 53);
  assert.equal(d54.family.sizeExact, 2n ** 53n);
  const d55 = dp(halves(55), { tau: 0.2, order: Array.from({ length: 55 }, (_, i) => i) });
  assert.equal(d55.family.size, String(2n ** 54n));
  // small sizes keep their number and deep-equal the old shape (sizeExact is non-enumerable)
  const r = opt(E6, { tau: 0.2 });
  assert.deepEqual(r.family, { name: "𝒜₆", words: "all reports on 6 units", size: 4683 });
  assert.equal(r.family.sizeExact, 4683n);
  assert.equal(Object.keys(r.family).includes("sizeExact"), false);
});

// ---------------------------------------------------------------------------------------------------------
// E-13, E-14: budgets and refusal messages

test("E-13: orderHull refuses tables above its budget, naming the limit", () => {
  assert.deepEqual(ORDER_HULL_BUDGET, { maxUnitsUncapped: 150, maxCells: 5e7 });
  const E151 = errorArray(Array.from({ length: 151 }, (_, i) => -i / 30), 0.5);
  const order151 = Array.from({ length: 151 }, (_, i) => i);
  assert.throws(() => orderHull(E151, { order: order151 }), /at most 150 units without a grade cap; 𝒜ᵨ is on n = 151 units/);
  // with a cap: H·m·M = 4·300·44,850 = 53,820,000 cells is above 5·10⁷, 3·300·44,850 is below
  const E300 = errorArray(Array.from({ length: 300 }, (_, i) => -i / 50), 0.5);
  const order300 = Array.from({ length: 300 }, (_, i) => i);
  assert.throws(() => orderHull(E300, { order: order300, G: 4 }), /at most 50,000,000; 𝒜ᵨ,≤4 needs 53,820,000 \(H = 4 grade layers, m = 300 blocks, M = 44,850 pairs\)/);
  // a 150-unit uncapped hull and a capped 120-unit hull are fine
  const E150 = errorArray(Array.from({ length: 150 }, (_, i) => -i / 30), 0.5);
  assert.ok((orderHull(E150, { order: Array.from({ length: 150 }, (_, i) => i) }) as HullVertex[]).length >= 2);
  // the DP has no such limit
  assert.equal(dp(E300, { tau: 0.2, order: order300, G: 4 }).label, "optimal-within-order");
});

test("E-14: enumeration allows any family of at most 600,000 reports on up to 20 units; messages name the failed limit", () => {
  assert.deepEqual(ENUMERATION_BUDGET, { maxReports: 600000, maxUnits: 20 });
  const E20 = errorArray(Array.from({ length: 20 }, (_, i) => -i / 4), 0.5);
  const one = opt(E20, { tau: 0.2, family: { kind: "exactly", G: 1 } });
  assert.deepEqual(one.grade, new Array<number>(20).fill(1));
  assert.equal(one.family.size, 1);
  const order = Array.from({ length: 20 }, (_, i) => i);
  const short = opt(E20, { tau: 0.2, family: { kind: "order", order, G: 3 } });
  assert.equal(short.family.size, 1 + 19 + 171);
  close(short.risk, dp(E20, { tau: 0.2, order, G: 3 }).risk, 1e-15, "enumeration = DP");
  // the unit limit, with a correct singular
  const E21 = errorArray(Array.from({ length: 21 }, (_, i) => -i / 4), 0.5);
  assert.throws(
    () => exactOptimum(E21, { tau: 0.2, family: { kind: "exactly", G: 1 } }),
    /covers at most 20 units; 𝒜_=1 \(reports with exactly 1 grade\) is on n = 21 units \(1 report\)\. Use fixedOrderDP for a declared order with this grade count/,
  );
  // the report limit; capped families point to the fixed-order DP, never to the solver
  const E13 = errorArray(Array.from({ length: 13 }, (_, i) => -i / 4), 0.5);
  let message = "";
  try {
    exactOptimum(E13, { tau: 0.2, family: { kind: "atMost", G: 3 } });
  } catch (err) {
    message = (err as Error).message;
  }
  assert.match(message, /covers at most 600,000 reports; 𝒜_≤3 \(reports with at most 3 grades\) has 1,\d{3},\d{3} reports on n = 13 units/);
  assert.match(message, /fixedOrderDP/);
  assert.match(message, /the browser solver takes the unrestricted family only/);
  assert.throws(() => exactOptimum(randomE(1, 9, 1), { tau: 0.2 }), /or the browser solver for the unrestricted family/);
});

// ---------------------------------------------------------------------------------------------------------
// E-15: one convention for empty families

test("E-15: every optimizing function returns { empty: true, family } for an empty family", () => {
  const order = [0, 1, 2, 3, 4, 5];
  const none: Family = { kind: "exactly", G: 7 };
  const results: [string, { empty: boolean; family: { size: number | string } }][] = [
    ["exactOptimum", exactOptimum(E6, { tau: 0.2, family: none })],
    ["budgetFamily", budgetFamily(E6, { tau: 0.2, family: none })],
    ["tauPath", tauPath(E6, { family: none })],
    ["orderHull", orderHull(E6, { order, exact: 7 }) as never],
    ["reportCloud", reportCloud(E6, { family: none })],
    ["fixedOrderDP", fixedOrderDP(E6, { tau: 0.2, order, exact: 7 })],
    ["minimaxChoice", minimaxChoice(E6, { tau: 0.2, family: none })],
    ["commonalityCost", commonalityCost(E6x2, { tau: 0.2, w: [0.5, 0.5], family: none })],
    ["weightPath", weightPath(E6x2, { tau: 0.2, family: none }) as never],
    ["weightBreakpoints", weightBreakpoints(E6x2, { tau: 0.2, family: none })],
  ];
  for (const [name, r] of results) {
    assert.equal(r.empty, true, name);
    assert.equal(r.family.size, 0, name);
  }
  // the nonempty results say so too
  assert.equal(reportCloud(E6).empty, false);
  assert.equal((tauPath(E6) as TauPath).empty, false);
  assert.equal(dp(E6, { tau: 0.2, order }).empty, false);
  // an empty cloud has an empty hull
  assert.deepEqual(lowerHull(reportCloud(E6, { family: none }) as never), []);
});

// ---------------------------------------------------------------------------------------------------------
// E-17: the τ = 1/2 endpoint

test("E-17: with equal means the strict report becomes optimal exactly at τ = 1/2 and keeps a zero-length interval", () => {
  const E = halves(6);
  const tp = tauPath(E) as TauPath;
  assert.deepEqual(
    tp.intervals.map((p) => [p.tauFrom, p.tauTo, p.N]),
    [[0, 0.5, 0], [0.5, 0.5, 15]],
  );
  assert.deepEqual(tp.intervals[1].grade, [1, 2, 3, 4, 5, 6]);
  assert.equal(tp.intervals[1].riskFrom, 0.5);
  assert.equal(tp.endpointTieCount, 4683, "every report is optimal at τ = 1/2");
  assert.equal(tp.endpointOptima.length, 100);
  assert.deepEqual(tp.endpointOptima[0], [1, 1, 1, 1, 1, 1]);
  assert.equal((tauPath(E, { maxTies: 2 }) as TauPath).endpointOptima.length, 2);
  // the supporting line at 1/2 touches both hull vertices
  const hull = lowerHull(reportCloud(E) as ReportCloud);
  assert.deepEqual(supportingVertex(hull, 0.5).vertices.map((v) => v.N), [0, 15]);
  // without a tie at 1/2 nothing is added: six sites end on the strict report with a positive interval
  const six = tauPath(E6) as TauPath;
  assert.ok(six.intervals.every((p) => p.tauFrom < p.tauTo));
  assert.deepEqual(six.endpointOptima, [six.intervals[six.intervals.length - 1].grade]);
});

// ---------------------------------------------------------------------------------------------------------
// E-18: all-withheld flag and E/N display

test("E-18: fixedOrderDP reports containsAllWithheld; formatEoverN takes one value or an array", () => {
  const order = [0, 1, 2, 3, 4, 5];
  assert.equal(dp(E6, { tau: 0.2, order }).containsAllWithheld, true);
  assert.equal(dp(E6, { tau: 0.2, order, G: 3 }).containsAllWithheld, true);
  assert.equal(dp(E6, { tau: 0.2, order, exact: 1 }).containsAllWithheld, true);
  assert.equal(dp(E6, { tau: 0.2, order, exact: 3 }).containsAllWithheld, false);
  const ev = evaluateReport([1, 1, 1, 1, 1, 1], E6x2, { tau: 0.2, w: [0.5, 0.5] });
  assert.deepEqual(formatEoverN(ev.EoverN), [NO_DISCLOSURE, NO_DISCLOSURE]);
  assert.equal(formatEoverN(ev.EoverN[0]), NO_DISCLOSURE);
  assert.equal(formatProb(ev.EoverN[0]), NA, "formatProb keeps NA: E/N must use formatEoverN");
  const ev2 = evaluateReport([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 });
  assert.equal(formatEoverN(ev2.EoverN[0], { sig: 3 }), formatEoverN(ev2.E[0], ev2.N, { sig: 3 }));
  assert.deepEqual(formatEoverN([0.2, null, Number.NaN], { digits: 2 }), [".20", NO_DISCLOSURE, NA]);
  // the two-number form is unchanged
  assert.equal(formatEoverN(0, 0), NO_DISCLOSURE);
  assert.equal(formatEoverN(7 / 20, 2), ".175");
  assert.equal(formatEoverN(null, 5), NA);
  assert.throws(() => formatEoverN(0.2, { digit: 2 } as never), /unknown option "digit"/);
});

// ---------------------------------------------------------------------------------------------------------
// E-19: one tolerance convention

test("E-19: supportingVertex and statedAbove use tieTol on the risk scale", () => {
  // three vertices on 4 units (M = 6) whose Ew − τN differ by 3e-12 in count units (5e-13 on the risk scale)
  const hull: HullVertex[] = [
    { N: 0, Ew: 0, grade: [1, 1, 1, 1] },
    { N: 3, Ew: 0.6 + 3e-12, grade: [1, 1, 2, 2] },
    { N: 6, Ew: 1.6, grade: [1, 2, 3, 4] },
  ];
  assert.deepEqual(supportingVertex(hull, 0.2).vertices.map((v) => v.N), [0, 3], "tie within 1e-12 on the risk scale");
  assert.deepEqual(supportingVertex(hull, 0.2, { tieTol: 1e-13 }).vertices.map((v) => v.N), [0]);
  const bare = hull.map(({ N, Ew }) => ({ N, Ew, grade: null }));
  assert.throws(() => supportingVertex(bare, 0.2), /needs M/);
  assert.deepEqual(supportingVertex(bare, 0.2, { M: 6 }).vertices.map((v) => v.N), [0, 3]);
  assert.throws(() => supportingVertex(hull, 0.2, { tol: 1e-12 } as never), /unknown option "tol" \(it is now called tieTol\)/);
  // statedAbove: an error above τ by rounding only is not counted
  const E: ErrorArray = { ids: ["A", "B"], criteria: ["k1"], e: [[[Number.NaN, 0.1 + 0.1 + 0.1 - 0.1], [0.8, Number.NaN]]] };
  assert.ok(E.e[0][0][1] > 0.2);
  assert.equal(statedAbove([1, 2], E, { tau: 0.2 }).count, 0);
  assert.equal(statedAbove([1, 2], E, { tau: 0.2, tieTol: 0 }).count, 1);
  assert.deepEqual(pairDecision(0.2 + 1e-13, 0.8, 0.2).best, ["iAboveJ", "withhold"]);
});

test("E-19: reportCloud's minGrade and maxGrade are the lexicographically first reports within tieTol·M of the extremes", () => {
  // a coarse tolerance makes chains of near-ties common
  let redone = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const n = 4 + (seed % 2);
    const E = randomE(seed, n, 1);
    const tieTol = [0.002, 0.01, 0.03][seed % 3];
    const cloud = reportCloud(E, { tieTol }) as ReportCloud;
    const M = (n * (n - 1)) / 2;
    const all = [...enumerateReports(n)].map((g) => ({ g: Array.from(g), ev: evaluateReport(g, E, { tau: 0.5 }) }));
    for (const row of cloud.byN) {
      const at = all.filter((x) => x.ev.N === row.N);
      const firstMin = at.find((x) => x.ev.Ew <= row.minEw + tieTol * M + 1e-15);
      const firstMax = at.find((x) => x.ev.Ew >= row.maxEw - tieTol * M - 1e-15);
      assert.deepEqual(row.minGrade, firstMin?.g, `seed ${seed} N = ${row.N} min`);
      assert.deepEqual(row.maxGrade, firstMax?.g, `seed ${seed} N = ${row.N} max`);
      const naive = at.find((x) => Math.abs(x.ev.Ew - Math.min(...at.map((y) => y.ev.Ew))) <= 1e-15);
      if (naive && naive.g.join() !== firstMin?.g.join()) redone += 1;
    }
  }
  assert.ok(redone > 0, "some rows differ from the plain argmin");
});

// ---------------------------------------------------------------------------------------------------------
// E-21: input forms

test("E-21: typed-array rows are accepted; a number in place of the options object gives a clear message", () => {
  const typed: ErrorArray = { ids: E6.ids, criteria: E6.criteria, e: E6.e.map((m) => m.map((row) => Float64Array.from(row))) as never };
  assert.deepEqual(evaluateReport([1, 1, 2, 2, 3, 3], typed, { tau: 0.2 }), evaluateReport([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 }));
  assert.deepEqual(opt(typed, { tau: 0.2 }).grade, opt(E6, { tau: 0.2 }).grade);
  assert.equal(relaxedPairRisk(typed, { tau: 0.2 }), relaxedPairRisk(E6, { tau: 0.2 }));
  assert.throws(() => evaluateReport([1, 1, 2, 2, 3, 3], E6, 0.2 as never), /evaluateReport: options object expected: \{tau, w\}, got 0\.2/);
  assert.throws(() => evaluateReport([1, 1, 2, 2, 3, 3], E6, undefined as never), /options object expected: \{tau, w\}/);
  assert.throws(() => exactOptimum(E6, 0.2 as never), /exactOptimum: options object expected: \{tau, w, family, q, tieTol, maxTies\}/);
  assert.throws(() => fixedOrderDP(E6, [0, 1, 2, 3, 4, 5] as never), /options object expected/);
  assert.throws(() => evaluateReport([1, 2], { ids: [], criteria: [], e: [] } as ErrorArray, { tau: 0.2 }), /criterion-major array e\[k\]\[i\]\[j\] \(K × n × n\)/);
});

// ---------------------------------------------------------------------------------------------------------
// E-22: exact weight breakpoints

test("E-22: weightBreakpoints gives the exact breakpoints of the optimum over w1 ∈ [0, 1] (six sites, two scores)", () => {
  for (const family of [{ kind: "atMost", G: 3 }, { kind: "all" }] as Family[]) {
    const wb = weightBreakpoints(E6x2, { tau: 0.2, family }) as WeightBreakpoints;
    assert.equal(wb.empty, false);
    const iv = wb.intervals;
    assert.equal(iv[0].wFrom, 0);
    assert.equal(iv[iv.length - 1].wTo, 1);
    for (let q = 1; q < iv.length; q += 1) assert.equal(iv[q].wFrom, iv[q - 1].wTo);
    assert.deepEqual(wb.breakpoints, iv.slice(1).map((v) => v.wFrom));
    assert.ok(iv.length >= 2, "the optimum changes with the weight");
    for (const p of iv) {
      // the interval's report is the exact optimum inside it
      const mid = (p.wFrom + p.wTo) / 2;
      const r = opt(E6x2, { tau: 0.2, w: [mid, 1 - mid], family });
      assert.deepEqual(r.grade, p.grade, `w1 = ${mid}`);
      close(p.riskFrom, evaluateReport(p.grade, E6x2, { tau: 0.2, w: [p.wFrom, 1 - p.wFrom] }).risk, 1e-15, "riskFrom");
    }
    // both neighbours tie at each breakpoint
    for (let q = 1; q < iv.length; q += 1) {
      const w1 = iv[q].wFrom;
      const at = opt(E6x2, { tau: 0.2, w: [w1, 1 - w1], family, tieTol: 1e-10 });
      const names = at.grades.map((g) => g.join(""));
      assert.ok(names.includes(iv[q - 1].grade.join("")) && names.includes(iv[q].grade.join("")), `tie at w1 = ${w1}`);
    }
    // a fine weight grid never finds a report outside the intervals
    const grid = Array.from({ length: 201 }, (_, q) => q / 200);
    const wp = weightPath(E6x2, { tau: 0.2, family, grid }) as WeightPathPoint[];
    for (const p of wp) {
      const inside = iv.filter((v) => v.wFrom <= p.w1 && p.w1 <= v.wTo);
      assert.ok(inside.some((v) => p.grades.some((g) => g.join() === v.grade.join())), `w1 = ${p.w1}`);
    }
  }
  assert.throws(() => weightBreakpoints(E6, { tau: 0.2 }), /K = 2/);
});

test("E-22: a criterion-symmetric case: zero-length intervals at the ends and a breakpoint at 1/2", () => {
  // two units, criterion 1 says A above B, criterion 2 says B above A, each with error .1
  const E: ErrorArray = {
    ids: ["A", "B"],
    criteria: ["c1", "c2"],
    e: [
      [[Number.NaN, 0.1], [0.9, Number.NaN]],
      [[Number.NaN, 0.9], [0.1, Number.NaN]],
    ],
  };
  const r12 = (x: number) => Math.round(x * 1e12) / 1e12;
  const show = (w: WeightBreakpoints) => w.intervals.map((v) => [r12(v.wFrom), r12(v.wTo), v.grade.join("")]);
  const wb = weightBreakpoints(E, { tau: 0.3 }) as WeightBreakpoints;
  assert.deepEqual(show(wb), [[0, 0.25, "21"], [0.25, 0.75, "11"], [0.75, 1, "12"]]);
  assert.deepEqual(wb.breakpoints.map(r12), [0.25, 0.75]);
  close(wb.intervals[1].riskFrom, 0.3, 1e-15, "withholding risk = τ");
  // at τ = 1/2 the withheld report is optimal only at w1 = 1/2: a breakpoint where all three tie
  const half = weightBreakpoints(E, { tau: 0.5 }) as WeightBreakpoints;
  assert.deepEqual(show(half), [[0, 0.5, "21"], [0.5, 1, "12"]]);
  // w1 = 0 and 1 are closed ends: a report optimal exactly there gets a zero-length interval (here all three
  // reports tie at w1 = 0; the hull keeps the extreme one, as tauPath keeps hull vertices only)
  const ends: ErrorArray = {
    ids: ["A", "B"],
    criteria: ["c1", "c2"],
    e: [
      [[Number.NaN, 0.3], [0.7, Number.NaN]],
      [[Number.NaN, 0.5], [0.5, Number.NaN]],
    ],
  };
  const z = weightBreakpoints(ends, { tau: 0.5 }) as WeightBreakpoints;
  assert.deepEqual(show(z), [[0, 0, "21"], [0, 1, "12"]]);
});
