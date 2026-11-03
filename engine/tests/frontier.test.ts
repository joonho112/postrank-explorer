import { test } from "node:test";
import assert from "node:assert/strict";
import { errorArray, finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { type Family } from "../src/report.ts";
import { evaluateReport } from "../src/risk.ts";
import { rng } from "../src/random.ts";
import { exactOptimum, type ExactOptimum } from "../src/optimize.ts";
import {
  halfSlopeEligible, lowerHull, matchedDisclosure, orderHull, reportCloud, supportingVertex, type HullVertex,
} from "../src/frontier.ts";

const close = (got: number | null | undefined, want: number, tol: number, what = "") =>
  assert.ok(got != null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);

// ch. 14/16 four-unit two-criterion law, weights (3/5, 2/5)
const LAW4 = finiteLawPairwise(
  [
    [[4, 4], [3, 2], [2, 3], [1, 1]],
    [[3, 1], [4, 2], [2, 3], [1, 4]],
  ],
  [3 / 4, 1 / 4],
);
const W4 = [3 / 5, 2 / 5];

function randomE(seed: number, n: number, K: number): ErrorArray {
  const u = rng(seed);
  const e = Array.from({ length: K }, () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? Number.NaN : 0))));
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const x = u();
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

/** H at m by brute force: the smallest chord value over all pairs of points bracketing m. */
function bruteH(points: { N: number; Ew: number }[], m: number): number {
  let best = Infinity;
  for (const a of points) {
    for (const b of points) {
      if (a.N <= m && m <= b.N) {
        // endpoints exactly (a chord evaluated at its own end must not pick up rounding from the other end)
        const v = m === a.N ? a.Ew : m === b.N ? b.Ew : a.Ew + ((b.Ew - a.Ew) * (m - a.N)) / (b.N - a.N);
        if (v < best) best = v;
      }
    }
  }
  return best;
}

const slopes = (hull: HullVertex[]) => hull.slice(1).map((v, q) => (v.Ew - hull[q].Ew) / (v.N - hull[q].N));

// ---------------------------------------------------------------------------------------------------------

test("reportCloud: per-N min, max and counts of all 4,683 six-site reports, with full points (≤ 5,000)", () => {
  const cloud = reportCloud(E6);
  assert.equal(cloud.n, 6);
  assert.equal(cloud.M, 15);
  assert.deepEqual(cloud.family, { name: "𝒜₆", words: "all reports on 6 units", size: 4683 });
  assert.equal(cloud.containsAllWithheld, true);
  assert.ok(cloud.points);
  assert.equal(cloud.points.length, 4683);
  assert.equal(cloud.byN.reduce((s, r) => s + r.count, 0), 4683);
  // every point agrees with evaluateReport; the rows agree with the points
  for (const p of cloud.points) {
    const ev = evaluateReport(p.grade, E6, { tau: 0.2 });
    assert.equal(p.N, ev.N);
    close(p.Ew, ev.Ew, 1e-15 * Math.max(1, ev.Ew), "Ew (plain against compensated sums)");
  }
  for (const r of cloud.byN) {
    const at = cloud.points.filter((p) => p.N === r.N);
    assert.equal(r.count, at.length);
    assert.equal(r.minEw, Math.min(...at.map((p) => p.Ew)));
    assert.equal(r.maxEw, Math.max(...at.map((p) => p.Ew)));
    // the first report (lexicographic order) at the smallest Ew
    assert.deepEqual(r.minGrade, at.find((p) => p.Ew <= r.minEw + 1e-12 * 15)?.grade);
    assert.deepEqual(r.maxGrade, at.find((p) => p.Ew >= r.maxEw - 1e-12 * 15)?.grade);
  }
  assert.deepEqual(cloud.byN[0], { N: 0, minEw: 0, maxEw: 0, count: 1, minGrade: [1, 1, 1, 1, 1, 1], maxGrade: [1, 1, 1, 1, 1, 1] });
  assert.equal(cloud.byN[cloud.byN.length - 1].N, 15);
  assert.equal(cloud.byN[cloud.byN.length - 1].count, 720);
  // larger families: per-N rows only
  const seven = reportCloud(errorArray([1, 0.8, 0.5, 0.2, 0, -0.4, -0.9], 0.3));
  assert.equal(seven.points, null);
  assert.equal(seven.byN.reduce((s, r) => s + r.count, 0), 47293);
  const cap3 = reportCloud(E6, { family: { kind: "atMost", G: 3 } });
  assert.equal(cap3.points?.length, 603);
  assert.equal(cap3.byN[cap3.byN.length - 1].N, 12); // N_max(3) = 15 − 3·C(2, 2) for n = 6 (ch. 16)
  // an exact count without the all-withheld report has no origin; an empty family has no cloud
  const ex2 = reportCloud(E6, { family: { kind: "exactly", G: 2 } });
  assert.equal(ex2.containsAllWithheld, false);
  assert.ok(ex2.byN[0].N > 0);
  const none = reportCloud(E6, { family: { kind: "exactly", G: 9 } });
  assert.equal(none.empty, true);
  assert.equal(none.family.size, 0);
  assert.throws(() => reportCloud(randomE(1, 9, 1)), /600,000/);
});

test("lowerHull, six sites (uncapped): vertices (0, 0), (8, .0095), (12, .0248), (13, .1692), (14, .3576), (15, .7194)", () => {
  const cloud = reportCloud(E6);
  const hull = lowerHull(cloud);
  const want = [[0, 0], [8, 0.0095], [12, 0.0248], [13, 0.1692], [14, 0.3576], [15, 0.7194]];
  assert.equal(hull.length, want.length);
  hull.forEach((v, q) => {
    assert.equal(v.N, want[q][0]);
    close(v.Ew, want[q][1], 5e-5, `vertex ${q}`);
    assert.ok(v.grade);
    const ev = evaluateReport(v.grade, E6, { tau: 0.2 });
    assert.equal(ev.N, v.N);
    close(ev.Ew, v.Ew, 1e-15, "vertex report attains the vertex");
  });
  assert.deepEqual(hull[4].grade, [1, 2, 3, 3, 4, 5]);
  // convex: slopes increase; the full tie-free family has every slope in [0, 1/2] (half-slope endpoint)
  const s = slopes(hull);
  for (let q = 1; q < s.length; q += 1) assert.ok(s[q] > s[q - 1]);
  assert.ok(s.every((x) => x >= 0 && x <= 0.5));
  // H(N(h)) ≤ Ew(h) for every report h, and H matches the brute-force chord minimum
  const pts = cloud.points ?? [];
  for (let N = 0; N <= 15; N += 1) {
    const md = matchedDisclosure(cloud, hull, N);
    close(md.H, bruteH(pts, N), 1e-15, `H(${N})`);
    for (const p of pts) if (p.N === N) assert.ok(md.H <= p.Ew + 1e-15);
  }
  // a list of points works too; points on an edge are not vertices
  assert.deepEqual(
    lowerHull([{ N: 0, Ew: 0 }, { N: 1, Ew: 1 }, { N: 2, Ew: 2 }, { N: 3, Ew: 4 }, { N: 1, Ew: 5 }]).map((v) => [v.N, v.Ew, v.grade]),
    [[0, 0, null], [2, 2, null], [3, 4, null]],
  );
  assert.throws(() => lowerHull([{ N: 0, Ew: Number.NaN }]), /finite/);
});

test("supportingVertex: slope τ = .20 touches N = 14 (1/2/3/3/4/5); it agrees with exactOptimum; ties at breakpoints", () => {
  const hull = lowerHull(reportCloud(E6));
  const sv = supportingVertex(hull, 0.2);
  assert.equal(sv.vertex.N, 14);
  assert.deepEqual(sv.vertex.grade, [1, 2, 3, 3, 4, 5]);
  assert.equal(sv.vertices.length, 1);
  close(0.2 + sv.value / 15, (exactOptimum(E6, { tau: 0.2 }) as ExactOptimum).risk, 1e-15, "risk = τ + value/M");
  for (const tau of [0.001, 0.01, 0.05, 0.1, 0.15, 0.25, 0.3, 0.4, 0.5]) {
    const r = exactOptimum(E6, { tau }) as ExactOptimum;
    const v = supportingVertex(hull, tau);
    assert.equal(v.vertex.N, r.N, `τ = ${tau}`);
    assert.deepEqual(v.vertex.grade, r.grade);
  }
  // at a breakpoint the two adjacent vertices are both supporting
  const s = slopes(hull);
  const at = supportingVertex(hull, s[2]);
  assert.deepEqual(at.vertices.map((v) => v.N), [12, 13]);
  assert.throws(() => supportingVertex(hull, 0.6), /tau/);
  assert.throws(() => supportingVertex([], 0.2), /nonempty/);
});

test("ch. 16 four-unit law: frontier (0, 0), (3, 3/10), (5, 13/20), (6, 21/20); ψ = 1/2 at m = 4 gives 19/40, best single report 7/10", () => {
  const cloud = reportCloud(LAW4, { w: W4 });
  assert.equal(cloud.family.size, 75);
  const hull = lowerHull(cloud);
  const want = [[0, 0], [3, 3 / 10], [5, 13 / 20], [6, 21 / 20]];
  assert.equal(hull.length, 4);
  hull.forEach((v, q) => {
    assert.equal(v.N, want[q][0]);
    close(v.Ew, want[q][1], 1e-15, `vertex ${q}`);
  });
  slopes(hull).forEach((x, q) => close(x, [1 / 10, 7 / 40, 2 / 5][q], 1e-15, `slope ${q}`));
  const md = matchedDisclosure(cloud, hull, 4);
  close(md.H, 19 / 40, 1e-15, "H(4)");
  assert.equal(md.psi, 0.5);
  assert.deepEqual([md.lower.N, md.upper.N], [3, 5]);
  assert.deepEqual(md.lower.grade, [1, 1, 1, 2]);
  assert.deepEqual(md.upper.grade, [1, 2, 2, 3]);
  assert.ok(md.best);
  close(md.best.Ew, 7 / 10, 1e-15, "best report with N = 4");
  close(md.gap, 7 / 10 - 19 / 40, 1e-15, "gap");
  close(md.H / 4, 19 / 160, 1e-15, "ratio of expected counts");
  // at a vertex ψ = 0; between integers no single report exists; outside the range nothing can be matched
  const v5 = matchedDisclosure(cloud, hull, 5);
  assert.equal(v5.psi, 0);
  assert.equal(v5.lower, v5.upper);
  close(v5.H, 13 / 20, 1e-15, "H(5)");
  close(v5.gap, 0, 1e-15, "gap at a vertex");
  const half = matchedDisclosure(cloud, hull, 4.5);
  assert.equal(half.best, null);
  assert.equal(half.gap, null);
  close(half.psi, 0.75, 1e-15, "ψ at 4.5");
  assert.throws(() => matchedDisclosure(cloud, hull, 6.5), /between/);
  assert.throws(() => matchedDisclosure(cloud, hull, -1), /between/);
  assert.equal(matchedDisclosure(null, hull, 4).best, null);
  // the order ABCD gives the same frontier; DCBA gives (0, 0), (5, 81/20), (6, 99/20), slopes above 1/2
  const abcd = orderHull(LAW4, { order: [0, 1, 2, 3], w: W4 });
  assert.deepEqual(abcd.map((v) => v.N), [0, 3, 5, 6]);
  abcd.forEach((v, q) => close(v.Ew, want[q][1], 1e-15, `ABCD vertex ${q}`));
  const dcba = orderHull(LAW4, { order: [3, 2, 1, 0], w: W4 });
  assert.deepEqual(dcba.map((v) => v.N), [0, 5, 6]);
  close(dcba[1].Ew, 81 / 20, 1e-15, "DCBA (5, 81/20)");
  close(dcba[2].Ew, 99 / 20, 1e-15, "DCBA (6, 99/20)");
  slopes(dcba).forEach((x, q) => close(x, [81 / 100, 9 / 10][q], 1e-15, `DCBA slope ${q}`));
  assert.ok(slopes(dcba).every((x) => x > 0.5), "a fixed order can need slopes above 1/2");
});

test("orderHull = lower hull of the enumerated contiguous family (caps, exact counts, blocks) on random cases", () => {
  for (let seed = 1; seed <= 120; seed += 1) {
    const n = 2 + (seed % 7);
    const K = 1 + (seed % 2);
    const E = randomE(seed, n, K);
    const w = K === 1 ? undefined : [0.6, 0.4];
    const order = shuffle(seed + 7, n);
    const blocks = seed % 5 === 0 ? (n >= 3 ? [2, ...new Array<number>(n - 2).fill(1)] : undefined) : undefined;
    const m = blocks ? blocks.length : n;
    const mode = seed % 3;
    const G = mode === 1 ? 1 + (seed % m) : undefined;
    const exact = mode === 2 ? 1 + ((seed * 3) % m) : undefined;
    const family: Family = { kind: "order", order, ...(G !== undefined ? { G } : {}), ...(exact !== undefined ? { exact } : {}), ...(blocks ? { blocks } : {}) };
    const want = lowerHull(reportCloud(E, { w, family }));
    const got = orderHull(E, { order, w, G, exact, blocks });
    assert.deepEqual(got.map((v) => v.N), want.map((v) => v.N), `seed ${seed}`);
    got.forEach((v, q) => {
      close(v.Ew, want[q].Ew, 1e-12, `seed ${seed} vertex ${q}`);
      assert.ok(v.grade);
      const ev = evaluateReport(v.grade, E, { tau: 0.5, w });
      assert.equal(ev.N, v.N);
      close(ev.Ew, v.Ew, 1e-12, "vertex report");
      if (exact !== undefined) assert.equal(ev.G, exact);
      if (G !== undefined) assert.ok(ev.G <= G);
    });
  }
  // empty family: no frontier
  const none = orderHull(E6, { order: [0, 1, 2, 3, 4, 5], exact: 7 });
  assert.ok(!Array.isArray(none) && none.empty === true);
});

test("orderHull for 30 units (no enumeration): a convex boundary with the origin, attained by its reports", (t) => {
  const means = Array.from({ length: 30 }, (_, i) => 2 - (4 * i) / 29 + 0.25 * Math.cos(i));
  const E = errorArray(means, 0.35);
  const order = Array.from({ length: 30 }, (_, i) => i).sort((a, b) => means[b] - means[a]);
  let t0 = performance.now();
  const hull = orderHull(E, { order });
  const msFree = performance.now() - t0;
  t0 = performance.now();
  const hull4 = orderHull(E, { order, G: 4 });
  const ms4 = performance.now() - t0;
  t.diagnostic(`orderHull n = 30: uncapped ${msFree.toFixed(1)} ms, at most 4 grades ${ms4.toFixed(1)} ms`);
  for (const h of [hull, hull4]) {
    assert.deepEqual([h[0].N, h[0].Ew], [0, 0]);
    const s = slopes(h);
    for (let q = 1; q < s.length; q += 1) assert.ok(s[q] > s[q - 1]);
    for (const v of h) close(evaluateReport(v.grade as number[], E, { tau: 0.5 }).Ew, v.Ew, 1e-12, "vertex");
  }
  assert.equal(hull[hull.length - 1].N, 435);
  // a cap restricts the family, so its boundary lies on or above the uncapped one
  for (const v of hull4) assert.ok(matchedDisclosure(null, hull, v.N).H <= v.Ew + 1e-12);
});

test("halfSlopeEligible: only the full family with no latent ties on positive-weight criteria", () => {
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: true }), true);
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: false }), false);
  assert.equal(halfSlopeEligible({ family: { kind: "atMost", G: 3 }, tieFree: true }), false);
  assert.equal(halfSlopeEligible({ family: { kind: "exactly", G: 6 }, tieFree: true }), false);
  assert.equal(halfSlopeEligible({ family: { kind: "order", order: [0, 1, 2] }, tieFree: true }), false);
  // per criterion: ties on a zero-weight criterion do not matter
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: [true, false], positiveWeights: [1, 0] }), true);
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: [true, false], positiveWeights: [0.5, 0.5] }), false);
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: [true, false], positiveWeights: [true, false] }), true);
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: [true, false] }), false);
  assert.equal(halfSlopeEligible({ family: { kind: "all" }, tieFree: [true, true] }), true);
  assert.throws(() => halfSlopeEligible({ family: { kind: "all" }, tieFree: [true], positiveWeights: [1, 0] }), /one entry per criterion/);
  assert.throws(() => halfSlopeEligible({ family: { kind: "all" }, tieFree: "yes" as unknown as boolean }), /tieFree/);
});
