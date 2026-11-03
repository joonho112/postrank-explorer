import { test } from "node:test";
import assert from "node:assert/strict";
import { Accumulator, errorArray, finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { canonicalGrade, disclosure } from "../src/report.ts";
import { fixedOrderDP } from "../src/optimize.ts";
import { rng } from "../src/random.ts";
import { normalSf } from "../src/special.ts";
import { evidenceFlags, expectedRank, strictOrder, tierGrades } from "../src/rules.ts";

const close = (got: number, want: number, tol: number, what = "") =>
  assert.ok(Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];

/**
 * Independent reading of postrank_cuts(rule = "quantile"): raw tiers at fixed positions, then every group of
 * raw tiers joined by a run of equal scores collapses into one tier (interval merging), labels renumbered.
 */
function quantileTiers(scores: number[], G: number): number[] {
  const n = scores.length;
  const Gb = Math.min(G, n);
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  const raw = order.map((_, p) => 1 + Math.floor((p * Gb) / n));
  // link[h] = true when raw tiers h and h + 1 must merge (some run of equal scores spans both)
  const link = new Array<boolean>(Gb + 2).fill(false);
  let start = 0;
  for (let p = 1; p <= n; p += 1) {
    if (p === n || scores[order[p]] !== scores[order[start]]) {
      for (let h = raw[start]; h < raw[p - 1]; h += 1) link[h] = true;
      start = p;
    }
  }
  const tierOf = new Array<number>(Gb + 1);
  let t = 0;
  for (let h = 1; h <= Gb; h += 1) {
    if (h === 1 || !link[h - 1]) t += 1;
    tierOf[h] = t;
  }
  const g = new Array<number>(n);
  order.forEach((u, p) => (g[u] = tierOf[raw[p]]));
  return g;
}

test("strictOrder: positions by descending score, ties broken by unit index; ascending option", () => {
  assert.deepEqual(strictOrder(SIX), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(strictOrder([0.1, 0.5, 0.5, -1]), [3, 1, 2, 4]);
  assert.deepEqual(strictOrder([0.1, 0.5, 0.5, -1], { direction: "ascending" }), [2, 3, 4, 1]);
  assert.deepEqual(strictOrder([3]), [1]);
  assert.throws(() => strictOrder([1, Number.NaN]), /finite/);
  assert.throws(() => strictOrder([]), /nonempty/);
  assert.throws(() => strictOrder([1, 2], { direction: "up" as never }), /direction/);
});

test("tierGrades: package quantile positions 1 + ⌊(p − 1)G/n⌋; n = 30 shares .517, .690, .775, .828, .931", () => {
  const s = Array.from({ length: 30 }, (_, i) => 30 - i + 0.5 * Math.sin(i));
  const want: Record<number, number> = { 2: 0.517, 3: 0.69, 4: 0.775, 5: 0.828, 10: 0.931 };
  for (const [G, share] of Object.entries(want)) close(disclosure(tierGrades(s, Number(G))).s, share, 5e-4, `G = ${G}`);
  // three tiers of 10 state 300 of 435 pairs (20/29); four tiers have sizes 8/7/8/7, N = 337
  assert.deepEqual(disclosure(tierGrades(s, 3)), { M: 435, N: 300, s: 20 / 29, G: 3, sizes: [10, 10, 10], withheld: 135 });
  const d4 = disclosure(tierGrades(s, 4));
  assert.deepEqual(d4.sizes, [8, 7, 8, 7]);
  assert.equal(d4.N, 337);
  // G above n is capped at n (every unit its own tier); G = 1 withholds everything
  assert.deepEqual(tierGrades(SIX, 9), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(tierGrades(SIX, 1), [1, 1, 1, 1, 1, 1]);
  // tiers follow the score, not the input order
  assert.deepEqual(tierGrades([-0.8, 0.25, 1.2, -0.5, 0.95, 0.15], 3), [3, 2, 1, 3, 1, 2]);
  assert.throws(() => tierGrades(SIX, 0), /positive integer/);
  assert.throws(() => tierGrades(SIX, 2.5), /positive integer/);
});

test("tierGrades: equal scores are never split; every tier a tied run straddles merges (transitively)", () => {
  // n = 6, G = 3: raw tiers 1 1 2 2 3 3. A tie across positions 2–3 merges raw tiers 1 and 2 entirely.
  assert.deepEqual(tierGrades([5, 4, 4, 3, 2, 1], 3), [1, 1, 1, 1, 2, 2]);
  // ties across 2–3 and 4–5 chain tiers 1–2 and 2–3: one tier
  assert.deepEqual(tierGrades([9, 8, 8, 7, 7, 1], 3), [1, 1, 1, 1, 1, 1]);
  // a tie inside a raw tier changes nothing
  assert.deepEqual(tierGrades([9, 8, 7, 7, 2, 1], 3), [1, 1, 2, 2, 3, 3]);
  // a run spanning three raw tiers (G = 6)
  assert.deepEqual(tierGrades([6, 5, 5, 5, 4, 3], 6), [1, 2, 2, 2, 3, 4]);
  // random tie-heavy scores: the package rule equals the interval-merging reading, never splits ties,
  // never exceeds G tiers, and is a function of the scores (permuting units permutes the grades)
  const u = rng(11);
  for (let s = 0; s < 400; s += 1) {
    const n = 2 + Math.floor(u() * 14);
    const G = 1 + Math.floor(u() * 7);
    const scores = Array.from({ length: n }, () => Math.floor(u() * 6) / 2);
    const g = tierGrades(scores, G);
    assert.deepEqual(g, quantileTiers(scores, G), `case ${s}`);
    assert.deepEqual(g, canonicalGrade(g));
    assert.ok(Math.max(...g) <= Math.min(G, n));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (scores[i] === scores[j]) assert.equal(g[i], g[j]);
        if (scores[i] > scores[j]) assert.ok(g[i] <= g[j]);
      }
    }
    const perm = Array.from({ length: n }, (_, i) => i).sort(() => u() - 0.5);
    assert.deepEqual(tierGrades(perm.map((p) => scores[p]), G), perm.map((p) => g[p]));
    assert.deepEqual(tierGrades(scores.map((x) => -x), G, { direction: "ascending" }), g);
  }
});

test("evidenceFlags: z = (est − ref)/se, strict cutoff, canonical grades (two-unit example: z = 4.0 and 1.5)", () => {
  const f = evidenceFlags([0.2, 0.3], [0.05, 0.2]);
  close(f.z[0], 4, 1e-14);
  close(f.z[1], 1.5, 1e-14);
  assert.deepEqual(f.labels, [1, 2]);
  assert.deepEqual(f.grade, [1, 2]);
  // the stated direction A above B is wrong with probability .686 under the flat-prior posterior
  close(normalSf((0.2 - 0.3) / Math.hypot(0.05, 0.2)), 0.686, 5e-4);
  // three groups; a reference and a cutoff; one common SE
  const g = evidenceFlags([3, 0.5, -3, 2.5, -0.1], 1, { ref: 0.2, crit: 1.96 });
  assert.deepEqual(g.labels, [1, 2, 3, 1, 2]);
  assert.deepEqual(g.grade, [1, 2, 3, 1, 2]);
  // nobody flagged above: grades are renumbered (no empty grade)
  assert.deepEqual(evidenceFlags([0.1, -5], 1).grade, [1, 2]);
  assert.deepEqual(evidenceFlags([0.1, 0.2], 1).grade, [1, 1]);
  // strict: |z| equal to the cutoff is not flagged
  const z0 = evidenceFlags([0.3], [0.1]).z[0];
  assert.deepEqual(evidenceFlags([0.3, -0.3], [0.1, 0.1], { crit: z0 }).labels, [2, 2]);
  assert.throws(() => evidenceFlags([1, 2], [1, 0]), /positive/);
  assert.throws(() => evidenceFlags([1, 2], [1, 1, 1]), /se must have 2/);
  assert.throws(() => evidenceFlags([1, 2], 1, { crit: -1 }), /crit/);
});

test("expectedRank: Σ_k w_k {1 + Σ_{j≠i} e_ij,k}; default weights 1/K; equals 1 + Σ π_ji for one criterion", () => {
  const E = errorArray(SIX, 0.2);
  const r = expectedRank(E);
  for (let i = 0; i < 6; i += 1) {
    const acc = new Accumulator();
    for (let j = 0; j < 6; j += 1) if (j !== i) acc.add(E.e[0][i][j]);
    close(r[i], 1 + acc.value, 1e-14, `unit ${i}`);
  }
  assert.ok(r.every((x, i) => i === 0 || x > r[i - 1]), "expected ranks follow the means here");
  // K = 2: default equal weights; explicit weights
  const B = [0.7, 0.4, 0.9, 0.6, -0.5, -0.7];
  const E2 = errorArray(SIX.map((a, i) => [a, B[i]]), 0.2);
  const rA = expectedRank({ ...E2, e: [E2.e[0]] });
  const rB = expectedRank({ ...E2, e: [E2.e[1]] });
  expectedRank(E2).forEach((x, i) => close(x, (rA[i] + rB[i]) / 2, 1e-14));
  expectedRank(E2, { w: [0.6, 0.4] }).forEach((x, i) => close(x, 0.6 * rA[i] + 0.4 * rB[i], 1e-14));
  assert.throws(() => expectedRank(E2, { w: [0.6, 0.6] }), /sum to 1/);
  // the theory book's three-unit law (ch. 19; tie-free): 2.4, 1.3, 2.3
  const law = finiteLawPairwise([[20, 4, 3], [0, 4, 3]], [0.3, 0.7]);
  expectedRank(law).forEach((x, i) => close(x, [2.4, 1.3, 2.3][i], 1e-15));
});

test("expectedRank: columns summed in entity-id order, so reordering units keeps every named score bit for bit", () => {
  const u = rng(5);
  const n = 9;
  const means = Array.from({ length: n }, () => u() * 2);
  const ids = ["Q", "b", "A", "z", "M", "a", "Ä", "K", "c"];
  const E = errorArray(means, 0.3, { ids });
  const r = expectedRank(E);
  for (let s = 0; s < 20; s += 1) {
    const perm = Array.from({ length: n }, (_, i) => i).sort(() => u() - 0.5);
    const Ep: ErrorArray = { ids: perm.map((p) => ids[p]), criteria: E.criteria, e: [perm.map((p) => perm.map((q) => E.e[0][p][q]))] };
    const rp = expectedRank(Ep);
    perm.forEach((p, q) => assert.equal(rp[q], r[p]));
  }
  // two units with identical error rows and columns get exactly equal ranks, so a declared order keeps them in
  // one block; fixedOrderDP on that order with blocks never splits them
  const same = errorArray([1, 0.4, 0.4, -0.2], 0.25);
  const rs = expectedRank(same);
  assert.equal(rs[1], rs[2]);
  const order = rs.map((_, i) => i).sort((a, b) => rs[a] - rs[b] || a - b);
  const dp = fixedOrderDP(same, { order, tau: 0.45, blocks: [1, 2, 1] });
  assert.equal(dp.grade[1], dp.grade[2]);
});
