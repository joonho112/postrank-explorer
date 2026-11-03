import { test } from "node:test";
import assert from "node:assert/strict";
import {
  directionMatrix, drawErrors, errorArray, finiteLawPairwise, mixturePairDirection, pairDirection, tieLawPairwise,
} from "../src/pairwise.ts";
import { normalCdf } from "../src/special.ts";

// The six sites (course storyboard §A): posterior means for score A, SD .20, independent.
const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];

const close = (got: number, want: number, tol: number, what = "") =>
  assert.ok(Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

/** Every off-diagonal pair (i, j) of an n × n matrix. */
function offDiagonal(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) out.push([i, j]);
  return out;
}

test("pairDirection: Φ(mean difference / SD of the difference), hand values", () => {
  // e_AB of the six sites = Pr(A ≤ B) = Φ(−.25/√.08) ≈ .1884
  const eAB = pairDirection(0.95, 0.2, 1.2, 0.2);
  close(eAB, 0.18838, 5e-6, "e_AB");
  close(eAB, normalCdf(-0.25 / Math.sqrt(0.08)), 1e-16, "e_AB closed form");
  assert.equal(pairDirection(0.3, 0.1, 0.3, 0.4), 0.5);
  // corr .5 with equal SDs .2: the difference has variance .04, so π = Φ(.5/.2) = Φ(2.5) ≈ .99379
  close(pairDirection(1, 0.2, 0.5, 0.2, { corr: 0.5 }), 0.9937903346742238, 1e-15, "corr .5");
  // corr −1 doubles the SD: Φ(.5/.4)
  close(pairDirection(1, 0.2, 0.5, 0.2, { corr: -1 }), normalCdf(1.25), 1e-15, "corr −1");
  // π_AB + π_BA = 1 for a continuous pair
  close(pairDirection(0.4, 0.3, 0.1, 0.2) + pairDirection(0.1, 0.2, 0.4, 0.3), 1, 2e-16, "complement");
});

test("pairDirection throws when the difference has SD 0 or inputs are invalid", () => {
  assert.throws(() => pairDirection(1, 0, 0, 0), /SD 0/);
  assert.throws(() => pairDirection(1, 0.2, 0, 0.2, { corr: 1 }), /SD 0/);
  assert.throws(() => pairDirection(1, -0.1, 0, 0.2), RangeError);
  assert.throws(() => pairDirection(Number.NaN, 0.1, 0, 0.2), RangeError);
  assert.throws(() => pairDirection(1, 0.1, 0, 0.2, { corr: 1.2 }), RangeError);
  // one point mass and one normal is still a normal difference
  close(pairDirection(1, 0, 0.5, 0.25), normalCdf(2), 1e-16, "one SD 0");
});

test("directionMatrix: six sites, NaN diagonal, π_ij + π_ji = 1", () => {
  const pi = directionMatrix(SIX, 0.2);
  assert.equal(pi.length, 6);
  for (let i = 0; i < 6; i += 1) assert.ok(Number.isNaN(pi[i][i]));
  close(pi[0][1], 1 - 0.18838, 5e-6, "π_AB");
  close(pi[0][1], normalCdf(0.25 / Math.sqrt(0.08)), 1e-16, "π_AB closed form");
  for (const [i, j] of offDiagonal(6)) close(pi[i][j] + pi[j][i], 1, 2.3e-16, `π_${i}${j} + π_${j}${i}`);
  // an SD vector gives the same matrix as the common SD
  assert.deepEqual(directionMatrix(SIX, new Array(6).fill(0.2)), pi);
});

test("errorArray: e_ij = Pr(θ_i ≤ θ_j) computed directly; e_ji = 1 − e_ij for normals; orientation", () => {
  const E = errorArray(SIX, 0.2);
  assert.deepEqual(E.ids, ["A", "B", "C", "D", "E", "F"]);
  assert.deepEqual(E.criteria, ["k1"]);
  assert.equal(E.e.length, 1);
  close(E.e[0][0][1], 0.18838, 5e-6, "e_AB");
  const pi = directionMatrix(SIX, 0.2);
  for (const [i, j] of offDiagonal(6)) {
    assert.equal(E.e[0][i][j], pi[j][i], "e_ij = π_ji exactly (same closed form)");
    close(E.e[0][i][j] + E.e[0][j][i], 1, 2.3e-16, "reverse complement holds without ties");
  }
  // the smallest error is computed directly, not as 1 − π: e_AF = Φ(−2/√(.2² + .2²)) ≈ 7.7e-13, to full
  // relative precision (1 − π_AF would keep only about 4 digits)
  const eAF = normalCdf(-2 / Math.sqrt(0.2 * 0.2 + 0.2 * 0.2));
  close(E.e[0][0][5] / eAF, 1, 1e-15, "far-tail e_AF");
  assert.ok(Math.abs((1 - pi[5][0]) / eAF - 1) > 1e-6, "the complement loses precision in the tail");
  // orient −1 flips the target: e_ij(−1) = e_ji(+1)
  const flip = errorArray(SIX, 0.2, { orient: [-1] });
  for (const [i, j] of offDiagonal(6)) assert.equal(flip.e[0][i][j], E.e[0][j][i]);
});

test("errorArray: K = 2, unit-major input, per-unit SDs, ids and criteria", () => {
  const means = SIX.map((m, i) => [m, [0.3, 0.9, 0.2, 0.8, -0.6, -0.1][i]]);
  const sds = SIX.map((_, i) => [0.2, 0.1 + 0.05 * i]);
  const E = errorArray(means, sds, { ids: ["a", "b", "c", "d", "e", "f"], criteria: ["score_A", "score_B"], orient: [1, -1] });
  assert.equal(E.e.length, 2);
  assert.deepEqual(E.criteria, ["score_A", "score_B"]);
  // criterion 2 is flipped: e[1][i][j] = Pr(θ_i ≥ θ_j) = Φ((m_i − m_j)/sd)
  const sd = Math.sqrt(0.1 * 0.1 + 0.15 * 0.15);
  close(E.e[1][0][1], normalCdf((0.3 - 0.9) / sd), 1e-16, "flipped criterion");
  close(E.e[0][0][1], 0.18838, 5e-6, "criterion 1 unchanged");
  assert.throws(() => errorArray(means, sds, { orient: [1] }), /orient/);
  assert.throws(() => errorArray(means, sds, { ids: ["a", "b"] }), /ids/);
  assert.throws(() => errorArray(means, sds, { ids: ["a", "a", "c", "d", "e", "f"] }), /distinct/);
  assert.throws(() => errorArray(means, [[0.2], [0.2], [0.2], [0.2], [0.2], [0.2]]), /sds/);
  assert.throws(() => errorArray([1, 1], 0), /SD 0/);
});

test("default ids: letters up to 26 units, zero-padded U01 … beyond", () => {
  assert.deepEqual(errorArray([1, 0, -1], 1).ids, ["A", "B", "C"]);
  const ids = errorArray(Array.from({ length: 30 }, (_, i) => i), 1).ids;
  assert.equal(ids[0], "U01");
  assert.equal(ids[29], "U30");
  assert.deepEqual([...ids].sort(), ids);
});

test("finiteLawPairwise: theory-book three-unit law (ch. 10): errors 1/4, 1/4, 1/10, no ties", () => {
  // ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10, written as values (A, B, C)
  const states = [[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]];
  const law = finiteLawPairwise(states, [3 / 5, 3 / 20, 3 / 20, 1 / 10]);
  close(law.e[0][0][1], 1 / 4, 1e-16, "e_AB");
  close(law.e[0][1][2], 1 / 4, 1e-16, "e_BC");
  close(law.e[0][0][2], 1 / 10, 1e-16, "e_AC");
  for (const [i, j] of offDiagonal(3)) {
    assert.equal(law.t[0][i][j], 0);
    close(law.pi[0][i][j] + law.e[0][i][j], 1, 2.3e-16, "π + e = 1");
    close(law.e[0][i][j] + law.e[0][j][i], 1, 2.3e-16, "reverse complement without ties");
  }
  assert.ok(Number.isNaN(law.e[0][1][1]) && Number.isNaN(law.pi[0][1][1]) && Number.isNaN(law.t[0][1][1]));
});

test("finiteLawPairwise: equal marginals, two couplings (ch. 9): Pr(A > B) = 1/3 against 2/3", () => {
  const q1 = finiteLawPairwise([[0, 1], [1, 2], [2, 0]], [1 / 3, 1 / 3, 1 / 3]);
  const q2 = finiteLawPairwise([[0, 2], [1, 0], [2, 1]], [1 / 3, 1 / 3, 1 / 3]);
  close(q1.pi[0][0][1], 1 / 3, 1e-16, "Q1");
  close(q2.pi[0][0][1], 2 / 3, 1e-16, "Q2");
  // null probabilities: equal weights, exact count / S
  assert.equal(finiteLawPairwise([[0, 1], [1, 2], [2, 0]], null).pi[0][0][1], 1 / 3);
});

test("finite law with ties (package m4): e_AB + e_BA = 1 + t, so the reverse complement fails", () => {
  // B = 1; A = 0, 1, 2 with probabilities .1, .4, .5
  const law = finiteLawPairwise([[0, 1], [1, 1], [2, 1]], [0.1, 0.4, 0.5]);
  close(law.e[0][0][1], 0.5, 1e-16, "e_AB = Pr(A ≤ B)");
  close(law.e[0][1][0], 0.9, 1e-16, "e_BA = Pr(B ≤ A)");
  close(law.t[0][0][1], 0.4, 1e-16, "t");
  close(law.pi[0][0][1], 0.5, 1e-16, "π_AB = Pr(A > B)");
  close(law.e[0][0][1] + law.e[0][1][0], 1 + law.t[0][0][1], 2.3e-16, "e_ij + e_ji = 1 + t");
  assert.ok(Math.abs(law.e[0][1][0] - (1 - law.e[0][0][1])) > 0.3, "e_ji ≠ 1 − e_ij under ties");
});

test("finiteLawPairwise validates the law", () => {
  assert.throws(() => finiteLawPairwise([[0, 1], [1, 0]], [0.5, 0.4]), /sum to 1/);
  assert.throws(() => finiteLawPairwise([[0, 1], [1, 0]], [1.5, -0.5]), /≥ 0/);
  assert.throws(() => finiteLawPairwise([[0, 1], [1, 0, 2]], [0.5, 0.5]), /units/);
  assert.throws(() => finiteLawPairwise([[0, 1]], [0.5, 0.5]), /one value per state/);
  assert.throws(() => finiteLawPairwise([], null), /nonempty/);
});

test("drawErrors: share of draws with θ_i ≤ θ_j; ties count as errors in both directions", () => {
  // draws of (A, B): ties in 2 of 4 draws
  const draws = [[1, 1], [2, 1], [0, 1], [1, 1]];
  const E = drawErrors(draws);
  assert.equal(E.e[0][0][1], 3 / 4);
  assert.equal(E.e[0][1][0], 3 / 4);
  assert.equal(E.e[0][0][1] + E.e[0][1][0], 1.5, "1 + Pr(A = B) = 1 + 1/2");
  // without ties the reverse complement holds exactly
  const free = drawErrors([[1, 0], [2, 3], [0, -1], [5, 4], [1, 2]]);
  assert.equal(free.e[0][0][1], 2 / 5);
  assert.equal(free.e[0][0][1] + free.e[0][1][0], 1);
  // K = 2 draws, draws[s][i][k]
  const two = drawErrors(
    [
      [[1, 0], [0, 0]],
      [[0, 1], [1, 0]],
    ],
    { criteria: ["x", "y"] },
  );
  assert.deepEqual(two.criteria, ["x", "y"]);
  assert.equal(two.e[0][0][1], 1 / 2);
  assert.equal(two.e[1][0][1], 1 / 2);
  assert.equal(two.e[1][1][0], 1);
});

test("drawErrors equals finiteLawPairwise with equal weights", () => {
  const draws = Array.from({ length: 50 }, (_, s) => [Math.sin(s), Math.cos(3 * s), Math.round(Math.sin(s))]);
  const a = drawErrors(draws);
  const b = finiteLawPairwise(draws, null);
  assert.deepEqual(a.e, b.e);
});

test("mixturePairDirection: weighted average of component directions", () => {
  const one = { w: 1, meanA: 0.95, sdA: 0.2, meanB: 1.2, sdB: 0.2 };
  assert.equal(mixturePairDirection([one]), pairDirection(0.95, 0.2, 1.2, 0.2));
  const sym = mixturePairDirection([
    { w: 0.5, meanA: 1, sdA: 0.2, meanB: 0, sdB: 0.2 },
    { w: 0.5, meanA: 0, sdA: 0.2, meanB: 1, sdB: 0.2 },
  ]);
  close(sym, 0.5, 2e-16, "symmetric mixture");
  const mix = mixturePairDirection([
    { w: 0.25, meanA: 1, sdA: 0.3, meanB: 0, sdB: 0.4, corr: 0.5 },
    { w: 0.75, meanA: 0, sdA: 0.2, meanB: 0.1, sdB: 0.2 },
  ]);
  const want = 0.25 * normalCdf(1 / Math.sqrt(0.09 + 0.16 - 2 * 0.5 * 0.3 * 0.4)) + 0.75 * normalCdf(-0.1 / Math.sqrt(0.08));
  close(mix, want, 1e-16, "two components");
  assert.throws(() => mixturePairDirection([{ ...one, w: 0.5 }]), /sum to 1/);
  assert.throws(() => mixturePairDirection([]), /nonempty/);
});

test("tieLawPairwise: b + b' = d = 1 − t (package m4 law)", () => {
  const tie = tieLawPairwise([[0, 1], [1, 1], [2, 1]], [0.1, 0.4, 0.5], { criteria: ["score"] });
  close(tie.b[0][0][1], 0.1, 1e-16, "b_AB = Pr(A < B)");
  close(tie.b[0][1][0], 0.5, 1e-16, "b_BA = Pr(B < A)");
  close(tie.t[0][0][1], 0.4, 1e-16, "t");
  close(tie.d[0][0][1], 0.6, 1e-16, "d");
  for (const [i, j] of offDiagonal(2)) {
    close(tie.b[0][i][j] + tie.b[0][j][i], tie.d[0][i][j], 2.3e-16, "b_ij + b_ji = d_ij");
    close(tie.d[0][i][j], 1 - tie.t[0][i][j], 2.3e-16, "d = 1 − t");
  }
  // without ties, b = e and d = 1
  const free = tieLawPairwise([[3, 2, 1], [1, 2, 3]], [0.7, 0.3]);
  const law = finiteLawPairwise([[3, 2, 1], [1, 2, 3]], [0.7, 0.3]);
  assert.deepEqual(free.b, law.e);
  for (const [i, j] of offDiagonal(3)) assert.equal(free.d[0][i][j], 1);
});
