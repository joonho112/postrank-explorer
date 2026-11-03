import { test } from "node:test";
import assert from "node:assert/strict";
import { errorArray, finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { familySize, type Family } from "../src/report.ts";
import { evaluateReport, relaxedPairRisk } from "../src/risk.ts";
import { rng } from "../src/random.ts";
import {
  ENUMERATION_BUDGET, enumerateReports, exactOptimum, fixedOrderDP, tauPath, weightPath, type ExactOptimum, type FixedOrderResult,
  type TauPath, type WeightPathPoint,
} from "../src/optimize.ts";
import { orderHull } from "../src/frontier.ts";

const close = (got: number | null, want: number, tol: number, what = "") =>
  assert.ok(got !== null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

/** exactOptimum when the family is known to be nonempty. */
function opt(E: ErrorArray, options: Parameters<typeof exactOptimum>[1]): ExactOptimum {
  const r = exactOptimum(E, options);
  assert.equal(r.empty, false, "the family should not be empty");
  return r as ExactOptimum;
}

// The six sites, score A (means A–F, SD .20, independent).
const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);

// Theory-book three-unit law (ch. 10): ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10.
const LAW3 = finiteLawPairwise([[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]], [3 / 5, 3 / 20, 3 / 20, 1 / 10]);

// Theory-book four-unit two-criterion law (ch. 14 sec-fixed-order-dp-example): states (3/4, 1/4) with criterion
// orders (ABCD, ACBD) and (BACD, DCBA), values 4, 3, 2, 1 down each string; weights (3/5, 2/5), τ = 1/4.
const LAW4 = finiteLawPairwise(
  [
    [[4, 4], [3, 2], [2, 3], [1, 1]],
    [[3, 1], [4, 2], [2, 3], [1, 4]],
  ],
  [3 / 4, 1 / 4],
);
const W4 = [3 / 5, 2 / 5];

/** Every canonical report on n units (labels 1..G, all used), in lexicographic order — brute force. */
function allReports(n: number): number[][] {
  const out: number[][] = [];
  const g = new Array<number>(n).fill(1);
  for (;;) {
    if (new Set(g).size === Math.max(...g)) out.push([...g]);
    let q = n - 1;
    while (q >= 0 && g[q] === n) g[q--] = 1;
    if (q < 0) return out;
    g[q] += 1;
  }
}

const lexLess = (a: readonly number[], b: readonly number[]) => {
  for (let q = 0; q < a.length; q += 1) if (a[q] !== b[q]) return a[q] < b[q];
  return false;
};

/** Brute-force membership in a family (contiguous along the order, blocks unsplit, grade-count rules). */
function inFamily(g: readonly number[], family: Family): boolean {
  const G = Math.max(...g);
  switch (family.kind) {
    case "all":
      return true;
    case "atMost":
      return G <= family.G;
    case "exactly":
      return G === family.G;
    case "order": {
      const along = family.order.map((u) => g[u]);
      for (let t = 1; t < along.length; t += 1) if (along[t] !== along[t - 1] && along[t] !== along[t - 1] + 1) return false;
      if (along[0] !== 1) return false;
      if (family.blocks) {
        let pos = 0;
        for (const b of family.blocks) {
          for (let s = 1; s < b; s += 1) if (along[pos + s] !== along[pos]) return false;
          pos += b;
        }
      }
      if (family.exact !== undefined && G !== family.exact) return false;
      if (family.G !== undefined && G > family.G) return false;
      return true;
    }
  }
}

/** A random error array: n units, K criteria, e_ij uniform and e_ji = 1 − e_ij (or from a discrete set). */
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

function randomBlocks(seed: number, n: number): number[] {
  const u = rng(seed);
  const out: number[] = [];
  let left = n;
  while (left > 0) {
    const b = Math.min(left, u() < 0.7 ? 1 : 2 + Math.floor(u() * 2));
    out.push(b);
    left -= b;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// enumerateReports

test("enumerateReports: canonical, lexicographic and complete for 𝒜_n, 𝒜_≤G and 𝒜_=G (n ≤ 6), counts = familySize", () => {
  for (let n = 1; n <= 6; n += 1) {
    const brute = allReports(n);
    const families: Family[] = [{ kind: "all" }];
    for (let G = 0; G <= n + 1; G += 1) families.push({ kind: "atMost", G }, { kind: "exactly", G });
    for (const family of families) {
      const got = Array.from(enumerateReports(n, family), (g) => Array.from(g));
      const want = brute.filter((g) => inFamily(g, family));
      assert.deepEqual(got, want, `n = ${n}, ${JSON.stringify(family)}`);
      assert.equal(got.length, familySize(n, family));
    }
  }
});

test("enumerateReports: contiguous cuts of a declared order, with caps, exact counts and indivisible blocks", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const n = 2 + (seed % 5);
    const order = shuffle(seed, n);
    const blocks = seed % 3 === 0 ? randomBlocks(seed + 99, n) : undefined;
    const m = blocks ? blocks.length : n;
    const variants: Family[] = [
      { kind: "order", order, ...(blocks ? { blocks } : {}) },
      { kind: "order", order, G: 1 + (seed % m), ...(blocks ? { blocks } : {}) },
      { kind: "order", order, exact: 1 + ((seed * 7) % m), ...(blocks ? { blocks } : {}) },
    ];
    for (const family of variants) {
      const got = Array.from(enumerateReports(n, family), (g) => Array.from(g));
      const want = allReports(n).filter((g) => inFamily(g, family));
      assert.deepEqual(got, want, `seed ${seed} ${JSON.stringify(family)}`);
      assert.equal(got.length, familySize(n, family));
      checked += 1;
    }
  }
  assert.equal(checked, 180);
});

test("enumerateReports: Int8Array output, reuse option, laziness, empty families and the budget", () => {
  const first = enumerateReports(8, { kind: "all" }).next().value as Int8Array;
  assert.ok(first instanceof Int8Array);
  assert.deepEqual(Array.from(first), [1, 1, 1, 1, 1, 1, 1, 1]);
  // reuse: one buffer, still the right sequence
  const seen = new Set<Int8Array>();
  const copies: number[][] = [];
  for (const g of enumerateReports(4, { kind: "atMost", G: 2 }, { reuse: true })) {
    seen.add(g);
    copies.push(Array.from(g));
  }
  assert.equal(seen.size, 1);
  assert.deepEqual(copies, Array.from(enumerateReports(4, { kind: "atMost", G: 2 }), (g) => Array.from(g)));
  // empty families yield nothing (and are never refused)
  assert.deepEqual([...enumerateReports(6, { kind: "exactly", G: 7 })], []);
  assert.deepEqual([...enumerateReports(20, { kind: "atMost", G: 0 })], []);
  // the budget: n = 8 unrestricted (545,835) and n = 12 with at most 3 grades (523,251) fit; larger families are refused
  assert.equal(familySize(8, { kind: "all" }), 545835);
  assert.equal(familySize(12, { kind: "atMost", G: 3 }), 523251);
  assert.deepEqual(ENUMERATION_BUDGET, { maxReports: 600000, maxUnits: 20 });
  assert.throws(() => enumerateReports(9, { kind: "all" }), /covers at most 600,000 reports; 𝒜₉ \(all reports on 9 units\) has 7,087,261 reports on n = 9 units/);
  assert.throws(() => enumerateReports(12, { kind: "atMost", G: 4 }), /600,000/);
  // n = 13..20: a small family is enumerable (E-14); n = 21 is refused by the unit limit
  assert.equal([...enumerateReports(13, { kind: "order", order: shuffle(3, 13), G: 2 })].length, 13);
  assert.throws(() => enumerateReports(21, { kind: "exactly", G: 1 }), /covers at most 20 units; 𝒜_=1 \(reports with exactly 1 grade\) is on n = 21 units \(1 report\)/);
  assert.throws(() => enumerateReports(0, { kind: "all" }), RangeError);
});

// ---------------------------------------------------------------------------------------------------------
// exactOptimum

test("six sites, τ = .20: exact optimum within all 4,683 reports is 1/2/3/3/4/5 (risk ≈ .0372, N = 14)", () => {
  const r = opt(E6, { tau: 0.2 });
  assert.deepEqual(r.grade, [1, 2, 3, 3, 4, 5]);
  assert.deepEqual(r.grades, [[1, 2, 3, 3, 4, 5]]);
  close(r.risk, 0.0372, 5e-5, "risk");
  assert.equal(r.N, 14);
  assert.equal(r.G, 5);
  close(r.Ew, 0.358, 5e-4, "E (storyboard .358)");
  assert.deepEqual(r.family, { name: "𝒜₆", words: "all reports on 6 units", size: 4683 });
  assert.equal(r.containsAllWithheld, true);
  assert.equal(r.label, "exact-within-family");
  assert.equal(r.tieTol, 1e-12);
  assert.deepEqual(r.evaluation, evaluateReport(r.grade, E6, { tau: 0.2 }));
  assert.equal(r.risk, r.evaluation.risk);
  // brute force: no report has smaller risk
  let min = Infinity;
  for (const g of allReports(6)) min = Math.min(min, evaluateReport(g, E6, { tau: 0.2 }).risk);
  close(r.risk, min, 1e-15, "brute-force minimum");
  // the mean bound E ≤ τN holds at the optimum of a family containing the all-withheld report (CONTRACT 6.4)
  assert.ok(r.Ew <= 0.2 * r.N);
});

test("six sites, τ = .20: with at most 3 grades the optimum is 1/1/2/2/3/3 (risk ≈ .0417) within 603 reports", () => {
  const r = opt(E6, { tau: 0.2, family: { kind: "atMost", G: 3 } });
  assert.deepEqual(r.grades, [[1, 1, 2, 2, 3, 3]]);
  close(r.risk, 0.0417, 5e-5, "risk");
  close(r.risk, 0.04165164, 5e-9, "risk (archived tutorial_one .04165164)");
  assert.equal(r.N, 12);
  assert.deepEqual(r.family, { name: "𝒜_≤3", words: "reports with at most 3 grades", size: 603 });
  // exactly 3 grades gives the same report; exactly 2 grades excludes the all-withheld report
  const e3 = opt(E6, { tau: 0.2, family: { kind: "exactly", G: 3 } });
  assert.deepEqual(e3.grade, [1, 1, 2, 2, 3, 3]);
  assert.equal(e3.family.size, 540);
  const e2 = opt(E6, { tau: 0.2, family: { kind: "exactly", G: 2 } });
  assert.equal(e2.containsAllWithheld, false);
  assert.equal(e2.family.name, "𝒜_=2");
  // at most 6 against strict order (storyboard: .0372 against .0480)
  const strict = opt(E6, { tau: 0.2, family: { kind: "exactly", G: 6 } });
  close(strict.risk, 0.048, 5e-5, "strict order risk");
});

test("three-unit law (ch. 10), τ = 1/5: two optima 1/1/2 and 1/2/2 at risk 11/60", () => {
  const r = opt(LAW3, { tau: 1 / 5 });
  assert.deepEqual(r.grades, [[1, 1, 2], [1, 2, 2]]);
  assert.deepEqual(r.grade, [1, 1, 2]);
  close(r.risk, 11 / 60, 1e-15, "risk");
  close(evaluateReport([1, 2, 2], LAW3, { tau: 1 / 5 }).risk, 11 / 60, 1e-15, "second optimum");
  assert.deepEqual(r.family, { name: "𝒜₃", words: "all reports on 3 units", size: 13 });
  // the relaxed pair choices are lower but not a report (storyboard .1595 < .1728 at another τ; here a strict bound)
  assert.ok(relaxedPairRisk(LAW3, { tau: 1 / 5 }) < r.risk);
  // a tighter tolerance cannot split a mathematical tie computed in two summation orders by more than a few ulps
  const tight = opt(LAW3, { tau: 1 / 5, tieTol: 1e-15 });
  assert.equal(tight.grades.length, 2);
});

test("ties: every report within tieTol is listed in lexicographic order (e = 1/2 = τ ties all 75 reports)", () => {
  const E = randomE(1, 4, 1, [0.5]);
  const r = opt(E, { tau: 0.5 });
  assert.equal(r.grades.length, 75);
  assert.deepEqual(r.grades, allReports(4));
  assert.deepEqual(r.grade, [1, 1, 1, 1]);
  close(r.risk, 0.5, 0, "risk");
  // tieTol = 0 still keeps exact ties (dyadic values are exact)
  assert.equal(opt(E, { tau: 0.5, tieTol: 0 }).grades.length, 75);
});

test("exact optimum equals brute force on random cases (all families, K = 1 and 2, with tie-heavy inputs)", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const n = 3 + (seed % 3);
    const K = 1 + (seed % 2);
    const E = randomE(seed, n, K, seed % 4 === 0 ? [0, 0.25, 0.5, 0.75, 1] : undefined);
    const w = K === 1 ? undefined : [0.375, 0.625];
    const tau = [0.1, 0.2, 0.25, 0.5][seed % 4];
    for (const family of [{ kind: "all" }, { kind: "atMost", G: 2 }, { kind: "exactly", G: 3 }] as Family[]) {
      const r = opt(E, { tau, w, family });
      const risks = allReports(n)
        .filter((g) => inFamily(g, family))
        .map((g) => ({ g, risk: evaluateReport(g, E, { tau, w }).risk }));
      const min = Math.min(...risks.map((x) => x.risk));
      const want = risks.filter((x) => x.risk <= min + 1e-12).map((x) => x.g);
      assert.deepEqual(r.grades, want, `seed ${seed} ${JSON.stringify(family)}`);
      close(r.risk, min, 1e-15, "risk");
    }
  }
});

test("budgets q restrict the family to E_k ≤ q_k N (N = 0 passes); an empty family returns { empty: true }", () => {
  // a second criterion for the six sites
  const B = [0.3, 1.0, -0.2, 0.6, 0.1, -0.4];
  const E = errorArray(SIX.map((a, i) => [a, B[i]]), 0.2);
  const w = [0.5, 0.5];
  for (const q of [[null, 0.02], [0.01, 0.05], [0.004, null]] as (number | null)[][]) {
    const r = opt(E, { tau: 0.2, w, q, family: { kind: "atMost", G: 3 } });
    const feasible = allReports(6)
      .filter((g) => Math.max(...g) <= 3)
      .map((g) => ({ g, ev: evaluateReport(g, E, { tau: 0.2, w }) }))
      .filter(({ ev }) => ev.E.every((x, k) => q[k] === null || x <= (q[k] as number) * ev.N));
    const min = Math.min(...feasible.map((x) => x.ev.risk));
    assert.deepEqual(r.grades, feasible.filter((x) => x.ev.risk <= min + 1e-12).map((x) => x.g), `q = ${q}`);
    assert.equal(r.family.size, feasible.length);
    assert.equal(r.family.baseSize, 603);
    assert.deepEqual(r.family.budgets, q);
    assert.equal(r.family.name, "𝒜_q (𝒜_≤3)");
    r.E.forEach((x, k) => q[k] === null || assert.ok(x <= (q[k] as number) * r.N));
  }
  // q = 0: only reports without expected error pass; with normal laws that is the all-withheld report only
  const zero = opt(E6, { tau: 0.2, q: [0] });
  assert.deepEqual(zero.grades, [[1, 1, 1, 1, 1, 1]]);
  assert.equal(zero.family.size, 1);
  assert.equal(zero.EoverN[0], null);
  // exactly two grades and q = 0: the family is empty
  const none = exactOptimum(E6, { tau: 0.2, q: [0], family: { kind: "exactly", G: 2 } });
  assert.equal(none.empty, true);
  assert.equal(none.family.size, 0);
  assert.equal(none.family.baseSize, 62);
  // an empty base family
  const e7 = exactOptimum(E6, { tau: 0.2, family: { kind: "exactly", G: 7 } });
  assert.deepEqual(e7, { empty: true, family: { name: "𝒜_=7", words: "reports with exactly 7 grades", size: 0 }, containsAllWithheld: false, label: "exact-within-family" });
  // all-null budgets are no budgets
  assert.deepEqual(opt(E6, { tau: 0.2, q: [null] }).family, opt(E6, { tau: 0.2 }).family);
});

test("exactOptimum input checks", () => {
  assert.throws(() => exactOptimum(E6, { tau: 0 }), /tau must lie in/);
  assert.throws(() => exactOptimum(E6, { tau: 0.6 }), /tau must lie in/);
  assert.throws(() => exactOptimum(E6, { tau: 0.2, q: [0.1, 0.2] }), /q must hold 1 budget \(/);
  assert.throws(() => exactOptimum(E6, { tau: 0.2, q: [-1] }), /q\[0\]/);
  assert.throws(() => exactOptimum(E6, { tau: 0.2, tieTol: -1 }), /tieTol/);
  assert.throws(() => exactOptimum(E6, { tau: 0.2, w: [0.5, 0.5] }), /w must hold 1 weights/);
  assert.throws(() => exactOptimum(randomE(1, 9, 1), { tau: 0.2 }), /7,087,261/);
  assert.throws(() => exactOptimum({ ids: [], criteria: [], e: [] } as ErrorArray, { tau: 0.2 }), RangeError);
});

test("timing: exact optimum within all 545,835 reports (n = 8) and within 523,251 (n = 12, at most 3 grades)", (t) => {
  const E8 = errorArray([2.1, 1.7, 1.2, 0.9, 0.4, 0.1, -0.6, -1.3], 0.35);
  let t0 = performance.now();
  const r8 = opt(E8, { tau: 0.2 });
  const ms8 = performance.now() - t0;
  assert.equal(r8.family.size, 545835);
  // the optimum is no worse than any fixed-order DP and no better than the relaxed pair bound
  assert.ok(r8.risk >= relaxedPairRisk(E8, { tau: 0.2 }) - 1e-15);
  for (let s = 0; s < 5; s += 1) assert.ok(r8.risk <= fixedOrderDP(E8, { order: shuffle(s, 8), tau: 0.2 }).risk + 1e-15);
  assert.ok(r8.risk <= fixedOrderDP(E8, { order: [0, 1, 2, 3, 4, 5, 6, 7], tau: 0.2 }).risk + 1e-15);
  const E12 = randomE(2026, 12, 1);
  t0 = performance.now();
  const r12 = opt(E12, { tau: 0.25, family: { kind: "atMost", G: 3 } });
  const ms12 = performance.now() - t0;
  assert.equal(r12.family.size, 523251);
  assert.ok(r12.G <= 3);
  t.diagnostic(`exactOptimum n = 8, all 545,835 reports: ${ms8.toFixed(0)} ms; n = 12, at most 3 grades (523,251): ${ms12.toFixed(0)} ms`);
  assert.ok(ms8 < 20000 && ms12 < 20000);
});

test("n = 7: the incremental enumeration agrees with evaluateReport on every one of 47,293 reports", () => {
  const E = randomE(77, 7, 2);
  const w = [0.3, 0.7];
  const r = opt(E, { tau: 0.3, w });
  let min = Infinity;
  for (const g of enumerateReports(7)) min = Math.min(min, evaluateReport(g, E, { tau: 0.3, w }).risk);
  close(r.risk, min, 1e-15, "risk");
});

// ---------------------------------------------------------------------------------------------------------
// fixedOrderDP

test("fixed-order DP: the ch. 14 four-unit example (order ABCD, weights 3/5, 2/5, τ = 1/4)", () => {
  const order = [0, 1, 2, 3];
  const want = [
    // G, best at most G (grade, risk), best exactly G (grade, risk)
    [1, [1, 1, 1, 1], 1 / 4, [1, 1, 1, 1], 1 / 4],
    [2, [1, 1, 1, 2], 7 / 40, [1, 1, 1, 2], 7 / 40],
    [3, [1, 2, 2, 3], 3 / 20, [1, 2, 2, 3], 3 / 20],
    [4, [1, 2, 2, 3], 3 / 20, [1, 2, 3, 4], 7 / 40],
  ] as const;
  for (const [G, gCap, rCap, gEx, rEx] of want) {
    const cap = fixedOrderDP(LAW4, { order, tau: 1 / 4, w: W4, G });
    assert.deepEqual(cap.grade, gCap, `at most ${G}`);
    close(cap.risk, rCap, 1e-15, `at most ${G}`);
    const ex = fixedOrderDP(LAW4, { order, tau: 1 / 4, w: W4, exact: G });
    assert.deepEqual(ex.grade, gEx, `exactly ${G}`);
    close(ex.risk, rEx, 1e-15, `exactly ${G}`);
  }
  const r = fixedOrderDP(LAW4, { order, tau: 1 / 4, w: W4, trace: true });
  assert.equal(r.label, "optimal-within-order");
  assert.deepEqual(r.cuts, [1, 3]);
  assert.deepEqual(r.blockCuts, [1, 3]);
  assert.deepEqual(r.family, { name: "𝒜ᵨ", words: "contiguous cuts of the declared order", size: 8 });
  close(r.saving, 3 / 20, 1e-15, "saving");
  assert.equal(r.risk, evaluateReport(r.grade, LAW4, { tau: 1 / 4, w: W4 }).risk);
  const tr = r.trace;
  assert.ok(tr);
  close(tr.T, -9 / 20, 1e-15, "T");
  // the ten interval savings: A B C D 0; AB 0, BC 3/20, CD −3/20; ABC 0, BCD −3/20; ABCD −9/20
  const W = [
    [0, 0, 0, 0, -9 / 20],
    [null, 0, 0, 3 / 20, -3 / 20],
    [null, null, 0, 0, -3 / 20],
    [null, null, null, 0, 0],
    [null, null, null, null, 0],
  ];
  for (let a = 0; a <= 4; a += 1) {
    for (let b = 0; b <= 4; b += 1) {
      if (W[a][b] === null) assert.equal(tr.W[a][b], null);
      else close(tr.W[a][b], W[a][b] as number, 1e-15, `W(${a}, ${b})`);
    }
  }
  assert.deepEqual(tr.path, [{ h: 0, c: 0 }, { h: 1, c: 1 }, { h: 2, c: 3 }, { h: 3, c: 4 }]);
  assert.equal(tr.chosenG, 3);
  assert.equal(tr.riskByG[0], null);
  [1 / 4, 7 / 40, 3 / 20, 7 / 40].forEach((x, h) => close(tr.riskByG[h + 1], x, 1e-15, `exact-${h + 1} risk`));
  assert.equal(tr.V[0][0], 0);
  assert.equal(tr.V[0][1], null);
  assert.equal(tr.V[3][2], null, "V_h(c) = −∞ for h > c");
  // the reverse order DCBA: at τ = 1/2 its optimum withholds every comparison (ch. 16)
  assert.deepEqual(fixedOrderDP(LAW4, { order: [3, 2, 1, 0], tau: 1 / 2, w: W4 }).grade, [1, 1, 1, 1]);
});

/** Contiguous reports of an order by cut sets (blocks unsplit), with their block cut vectors — brute force. */
function contiguous(n: number, order: number[], blocks: number[] | undefined) {
  const sizes = blocks ?? new Array<number>(n).fill(1);
  const m = sizes.length;
  const out: { grade: number[]; cuts: number[]; G: number }[] = [];
  for (let mask = 0; mask < 1 << (m - 1); mask += 1) {
    const cuts: number[] = [];
    for (let b = 1; b < m; b += 1) if ((mask >> (b - 1)) & 1) cuts.push(b);
    const grade = new Array<number>(n);
    let pos = 0;
    let gr = 1;
    for (let b = 0; b < m; b += 1) {
      if (cuts.includes(b)) gr += 1;
      for (let s = 0; s < sizes[b]; s += 1) grade[order[pos++]] = gr;
    }
    out.push({ grade, cuts, G: cuts.length + 1 });
  }
  return out;
}

test("fixed-order DP = enumeration of the contiguous family, with the package tie rules, on random cases", (t) => {
  let cases = 0;
  let tieCases = 0;
  for (let seed = 1; seed <= 360; seed += 1) {
    const n = 2 + (seed % 6);
    const K = 1 + (seed % 2);
    // seeds 301–360: every error 1/2, so many contiguous reports tie (all of them at τ = 1/2)
    const discrete = seed % 2 === 0 || seed > 300;
    const E = randomE(seed, n, K, seed > 300 ? [0.5] : discrete ? [0, 0.25, 0.5, 0.75, 1] : undefined);
    const w = K === 1 ? undefined : [0.25, 0.75];
    const tau = discrete ? [0.25, 0.5][(seed >> 1) % 2] : [0.1, 0.2, 0.3, 0.45][seed % 4];
    const order = shuffle(seed + 1000, n);
    const blocks = seed % 4 === 1 ? randomBlocks(seed + 2000, n) : undefined;
    const m = blocks ? blocks.length : n;
    const mode = seed % 3; // 0: no cap, 1: cap, 2: exact
    const G = mode === 1 ? 1 + (seed % m) : undefined;
    const exact = mode === 2 ? 1 + ((seed * 5) % m) : undefined;
    const dp = fixedOrderDP(E, { order, tau, w, G, exact, blocks });
    const family: Family = { kind: "order", order, ...(G !== undefined ? { G } : {}), ...(exact !== undefined ? { exact } : {}), ...(blocks ? { blocks } : {}) };
    // the same optimum value as enumeration, and the DP report is among the enumerated optima
    const en = opt(E, { tau, w, family });
    close(dp.risk, en.risk, 1e-12, `seed ${seed}`);
    assert.ok(en.grades.some((g) => g.join() === dp.grade.join()), `seed ${seed}: DP report is an enumerated optimum`);
    assert.equal(dp.family.size, en.family.size);
    // the package's selection among the optima: fewer grades, then the lexicographically earlier cut vector
    const all = contiguous(n, order, blocks).filter((x) => (G === undefined || x.G <= G) && (exact === undefined || x.G === exact));
    const risks = all.map((x) => evaluateReport(x.grade, E, { tau, w }).risk);
    const min = Math.min(...risks);
    const tied = all.filter((_, q) => risks[q] <= min + 1e-12);
    if (tied.length > 1) tieCases += 1;
    tied.sort((a, b) => a.G - b.G || (lexLess(a.cuts, b.cuts) ? -1 : lexLess(b.cuts, a.cuts) ? 1 : 0));
    assert.deepEqual(dp.grade, tied[0].grade, `seed ${seed}: package tie rule`);
    assert.deepEqual(dp.blockCuts, tied[0].cuts);
    assert.equal(dp.risk, evaluateReport(dp.grade, E, { tau, w }).risk);
    cases += 1;
  }
  assert.equal(cases, 360);
  t.diagnostic(`${cases} cases, ${tieCases} with several optimal contiguous reports`);
  assert.ok(tieCases >= 50, `tie-heavy cases exercised (${tieCases})`);
});

test("fixed-order DP tie rules: equal objective → fewer grades, then the earlier cut; blocks are never split", () => {
  // every error equals τ = 1/2: every contiguous report has risk 1/2
  const E = randomE(5, 5, 1, [0.5]);
  const order = [4, 2, 0, 1, 3];
  const all = fixedOrderDP(E, { order, tau: 0.5 });
  assert.deepEqual(all.grade, [1, 1, 1, 1, 1], "fewer grades: the all-withheld report");
  assert.equal(all.risk, 0.5);
  const three = fixedOrderDP(E, { order, tau: 0.5, exact: 3 });
  assert.deepEqual(three.cuts, [1, 2], "earliest cuts");
  assert.deepEqual(three.grade, [3, 3, 2, 3, 1]);
  const capped = fixedOrderDP(E, { order, tau: 0.5, G: 4 });
  assert.deepEqual(capped.grade, [1, 1, 1, 1, 1]);
  const blocks = fixedOrderDP(E, { order, tau: 0.5, exact: 2, blocks: [2, 1, 2] });
  assert.deepEqual(blocks.cuts, [2]);
  assert.deepEqual(blocks.blockCuts, [1]);
  assert.deepEqual(blocks.grade, [2, 2, 1, 2, 1]);
  // a positive saving inside a block cannot split it: one block of all five units
  const one = fixedOrderDP(errorArray([0, 0.1, 0.2, 3, 3.1], 0.5), { order: [4, 3, 2, 1, 0], tau: 0.2, blocks: [5] });
  assert.deepEqual(one.grade, [1, 1, 1, 1, 1]);
  assert.equal(one.family.size, 1);
  assert.match(one.family.words, /equal order scores kept together/);
  // empty families return { empty: true, family } (E-15); invalid orders throw
  assert.equal(fixedOrderDP(E6, { order: [0, 1, 2, 3, 4, 5], tau: 0.2, exact: 7 }).empty, true);
  assert.equal(fixedOrderDP(E6, { order: [0, 1, 2, 3, 4, 5], tau: 0.2, G: 2, exact: 3 }).empty, true);
  assert.throws(() => fixedOrderDP(E6, { order: [0, 1, 2, 3, 4, 4], tau: 0.2 }), /permutation/);
  assert.throws(() => fixedOrderDP(E6, { order: [0, 1, 2, 3, 4, 5], tau: 0.2, blocks: [2, 2] }), /blocks/);
});

test("timing: fixed-order DP at n = 100 with at most 5 grades; it agrees with the order hull's supporting vertex", (t) => {
  const means = Array.from({ length: 100 }, (_, i) => 3 - (6 * i) / 99 + 0.3 * Math.sin(i * 1.7));
  const E = errorArray(means, 0.4);
  const order = Array.from({ length: 100 }, (_, i) => i).sort((a, b) => means[b] - means[a]);
  const t0 = performance.now();
  const r = fixedOrderDP(E, { order, tau: 0.2, G: 5, trace: true });
  const ms = performance.now() - t0;
  assert.ok(r.G <= 5);
  assert.equal(r.family.size, 3926176); // Σ_{G ≤ 5} C(99, G − 1)
  assert.equal(r.risk, evaluateReport(r.grade, E, { tau: 0.2 }).risk);
  // an independent DP (along the withheld-pair count) gives the same minimum of Ew − τN
  const hull = orderHull(E, { order, G: 5 });
  const best = Math.min(...hull.map((v) => v.Ew - 0.2 * v.N));
  close(r.risk, 0.2 + best / r.evaluation.M, 1e-12, "risk from the order hull");
  // no single cut move improves it
  for (let q = 0; q < r.cuts.length; q += 1) {
    for (const d of [-1, 1]) {
      const cuts = [...r.cuts];
      cuts[q] += d;
      if (cuts[q] <= (cuts[q - 1] ?? 0) || cuts[q] >= (cuts[q + 1] ?? 100)) continue;
      const g = new Array<number>(100);
      const starts = [0, ...cuts];
      const ends = [...cuts, 100];
      starts.forEach((s, gr) => {
        for (let p = s; p < ends[gr]; p += 1) g[order[p]] = gr + 1;
      });
      assert.ok(evaluateReport(g, E, { tau: 0.2 }).risk >= r.risk - 1e-15);
    }
  }
  t.diagnostic(`fixedOrderDP n = 100, at most 5 grades (3,926,176 contiguous reports), with trace: ${ms.toFixed(2)} ms`);
  assert.ok(ms < 2000);
});

// ---------------------------------------------------------------------------------------------------------
// tauPath and weightPath

test("τ path, six sites (all 4,683 reports): breakpoints ≈ .0012, .0038, .1444, .1884, .3618", (t) => {
  const t0 = performance.now();
  const tp = tauPath(E6) as TauPath;
  const ms = performance.now() - t0;
  const path = tp.intervals;
  assert.equal(tp.empty, false);
  assert.deepEqual(tp.endpointOptima, [[1, 2, 3, 4, 5, 6]]);
  assert.equal(tp.endpointTieCount, 1);
  t.diagnostic(`tauPath six sites (4,683 reports): ${ms.toFixed(2)} ms`);
  assert.equal(path.length, 6);
  assert.deepEqual(path.map((p) => p.N), [0, 8, 12, 13, 14, 15]);
  assert.deepEqual(path.map((p) => p.grade.join("")), ["111111", "112222", "112233", "112234", "123345", "123456"]);
  const breaks = path.slice(1).map((p) => p.tauFrom);
  [0.0012, 0.0038, 0.1444, 0.1884, 0.3618].forEach((x, q) => close(breaks[q], x, 5e-5, `breakpoint ${q + 1}`));
  assert.equal(path[0].tauFrom, 0);
  assert.equal(path[5].tauTo, 0.5);
  for (let q = 1; q < path.length; q += 1) assert.equal(path[q].tauFrom, path[q - 1].tauTo);
  assert.equal(path[0].EoverN[0], null);
  assert.equal(path[0].EwOverN, null);
  close(path[0].riskTo, path[0].tauTo, 1e-16, "all-withheld risk = τ");
  for (const p of path) {
    // the interval's report is the exact optimum inside it, and both neighbours tie at each breakpoint
    const mid = opt(E6, { tau: (p.tauFrom + p.tauTo) / 2 });
    assert.deepEqual(mid.grade, p.grade);
    close(p.riskFrom, evaluateReport(p.grade, E6, { tau: Math.max(p.tauFrom, 1e-300) }).risk, 1e-15, "riskFrom");
  }
  for (let q = 1; q < path.length; q += 1) {
    const at = opt(E6, { tau: path[q].tauFrom });
    const names = at.grades.map((g) => g.join(""));
    assert.ok(names.includes(path[q - 1].grade.join("")) && names.includes(path[q].grade.join("")), `tie at breakpoint ${q}`);
  }
  // N never decreases as τ rises (prp-matched-disclosure-frontier); with a cap the path is shorter
  const cap3 = (tauPath(E6, { family: { kind: "atMost", G: 3 } }) as TauPath).intervals;
  for (let q = 1; q < cap3.length; q += 1) assert.ok(cap3[q].N > cap3[q - 1].N);
  assert.ok(cap3.every((p) => p.G <= 3));
  assert.equal(cap3[cap3.length - 1].tauTo, 0.5);
  // empty family (E-15)
  const none = tauPath(E6, { family: { kind: "exactly", G: 0 } });
  assert.equal(none.empty, true);
  assert.equal(none.family.size, 0);
});

test("τ path with two criteria reports E_k/N per criterion; weight path (K = 2) equals exactOptimum at each grid weight", () => {
  const B = [0.3, 1.0, -0.2, 0.6, 0.1, -0.4];
  const E = errorArray(SIX.map((a, i) => [a, B[i]]), 0.2);
  const path = (tauPath(E, { w: [0.5, 0.5], family: { kind: "atMost", G: 3 } }) as TauPath).intervals;
  for (const p of path) {
    const ev = evaluateReport(p.grade, E, { tau: 0.2, w: [0.5, 0.5] });
    assert.deepEqual(p.E, ev.E);
    assert.deepEqual(p.EoverN, ev.EoverN);
    assert.equal(p.Ew, ev.Ew);
  }
  const grid = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  const wp = weightPath(E, { tau: 0.2, family: { kind: "atMost", G: 3 }, grid }) as WeightPathPoint[];
  assert.equal(wp.length, grid.length);
  wp.forEach((p, q) => {
    assert.equal(p.w1, grid[q]);
    assert.deepEqual(p.w, [grid[q], 1 - grid[q]]);
    const r = opt(E, { tau: 0.2, w: p.w, family: { kind: "atMost", G: 3 } });
    assert.deepEqual(p.grades, r.grades, `w1 = ${grid[q]}`);
    assert.deepEqual(p.grade, r.grade);
    close(p.risk, r.risk, 1e-15, "risk");
  });
  // the default grid is 0, .05, …, 1
  const def = weightPath(E, { tau: 0.2, family: { kind: "atMost", G: 2 } }) as WeightPathPoint[];
  assert.equal(def.length, 21);
  close(def[1].w1, 0.05, 1e-17, "grid step");
  assert.throws(() => weightPath(E6, { tau: 0.2 }), /K = 2/);
  assert.throws(() => weightPath(E, { tau: 0.2, grid: [1.5] }), /grid/);
});
