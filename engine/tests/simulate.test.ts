import { test } from "node:test";
import assert from "node:assert/strict";
import { directionMatrix, drawErrors, errorArray, finiteLawPairwise } from "../src/pairwise.ts";
import { pairDecision } from "../src/risk.ts";
import { normals, rng } from "../src/random.ts";
import { normalCdf, normalQuantile } from "../src/special.ts";
import { expectedRank } from "../src/rules.ts";
import {
  LEAGUE_SEED, drawLeague, envelopeRadius, expectedMisorderedPairs, extremeCounts, fragilePairs, gaussianDraws, krwExample1Band,
  league30, mcse, misorderedPairs, normalInterval, normalPosterior, rankSummaries, rankSummariesMC, simulateEstimates, topKOverlap,
  type NormalPosterior,
} from "../src/simulate.ts";

const close = (got: number | null, want: number, tol: number, what = "") =>
  assert.ok(got !== null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const post = (est: number[], se: number[] | number, priorSd = 0.15) => normalPosterior(est, se, { priorSd }) as NormalPosterior<number[]>;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

test("simulateEstimates: truth + se·normals(seed, count); about 2Φ(1) − 1 of them within one SE", () => {
  const x = simulateEstimates(0.5, 0.2, 20, 1);
  const z = normals(1, 20);
  assert.deepEqual(x, Array.from(z, (v) => 0.5 + 0.2 * v));
  close(20 * (2 * normalCdf(1) - 1), 13.65, 5e-3, "expected count within one SE");
  const within = x.filter((v) => Math.abs(v - 0.5) <= 0.2).length;
  assert.ok(within >= 5 && within <= 20);
  assert.deepEqual(simulateEstimates(0.5, 0, 3, 9), [0.5, 0.5, 0.5]);
  assert.deepEqual(simulateEstimates(0.5, 0.2, 0, 1), []);
  assert.throws(() => simulateEstimates(0.5, -1, 3, 1), /se must be ≥ 0/);
  assert.throws(() => simulateEstimates(0.5, 0.2, 2.5, 1), /count/);
});

test("league30: the SR-06 specification (sizes 16/64/256 cycling, SE .20/.10/.05, r_i = 19i mod 31)", () => {
  const L = league30();
  assert.equal(L.ids.length, 30);
  assert.equal(L.ids[0], "U01");
  assert.equal(L.ids[29], "U30");
  assert.deepEqual(L.size.slice(0, 4), [16, 64, 256, 16]);
  assert.deepEqual(L.group.slice(0, 3), ["small", "medium", "large"]);
  assert.deepEqual(L.se.slice(0, 3), [0.2, 0.1, 0.05]);
  assert.deepEqual([...L.rank].sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(L.rank[0], 19);
  assert.equal(L.rank[1], 7);
  L.theta.forEach((t, i) => assert.equal(t, 0.15 * normalQuantile((L.rank[i] - 0.5) / 30)));
  // larger r means larger θ; the quantile grid is symmetric
  for (let i = 0; i < 30; i += 1) for (let j = 0; j < 30; j += 1) if (L.rank[i] > L.rank[j]) assert.ok(L.theta[i] > L.theta[j]);
  close(L.theta.reduce((a, b) => a + b, 0), 0, 1e-15);
  // of the 10 truly extreme positions (top 5 and bottom 5), small units hold 3 and large units 3
  const ext = extremeCounts(L.theta, L.group, 5);
  assert.equal(ext.total.small, 3);
  assert.equal(ext.total.large, 3);
  assert.equal(ext.total.medium, 4);
});

test("drawLeague: θ̂_i = θ_i + SE_i·normals(seed, 30)_i, default seed 20261030; agrees with simulateEstimates", () => {
  const L = league30();
  const d = drawLeague();
  assert.equal(d.seed, LEAGUE_SEED);
  assert.equal(LEAGUE_SEED, 20261030);
  const z = normals(20261030, 30);
  d.estimate.forEach((x, i) => assert.equal(x, L.theta[i] + L.se[i] * z[i]));
  d.estimate.forEach((x, i) => assert.equal(x, simulateEstimates(L.theta[i], L.se[i], 30, 20261030)[i]));
  assert.notDeepEqual(drawLeague(20261031).estimate, d.estimate);
});

test("normalPosterior: shrink .36/.69/.90 for the league's SEs at prior SD .15; mean B·est, SD √B·SE", () => {
  const L = league30();
  const est = drawLeague().estimate;
  const p = post(est, L.se);
  close(p.shrink[0], 0.36, 1e-15);
  close(p.shrink[1], 0.6923, 5e-5);
  close(p.shrink[2], 0.9, 1e-15);
  p.mean.forEach((m, i) => assert.equal(m, 0 + p.shrink[i] * (est[i] - 0)));
  p.sd.forEach((s, i) => close(s, Math.sqrt((0.15 ** 2 * L.se[i] ** 2) / (0.15 ** 2 + L.se[i] ** 2)), 1e-16));
  // scalar in, scalar out; a prior mean; the flat prior
  const one = normalPosterior(0.3, 0.1, { priorMean: 0.1, priorSd: 0.1 }) as NormalPosterior<number>;
  close(one.shrink, 0.5, 1e-15);
  close(one.mean, 0.2, 1e-15);
  close(one.sd, Math.sqrt(0.005), 1e-15);
  assert.deepEqual(normalPosterior([0.3, -0.2], 0.1, { priorSd: Number.POSITIVE_INFINITY }), { mean: [0.3, -0.2], sd: [0.1, 0.1], shrink: [1, 1] });
  // equal SEs: one shrink share, so the posterior means keep the estimate order
  assert.equal(misorderedPairs(est, post(est, 0.1).mean).count, 0);
  assert.ok(misorderedPairs(est, p.mean).count > 0);
  assert.throws(() => normalPosterior(0.3, 0.1, { priorSd: 0 }), /priorSd/);
});

test("normalInterval: mean ± Φ⁻¹((1 + level)/2)·sd", () => {
  const r = normalInterval(1, 2, 0.9) as { lower: number; upper: number };
  close(r.upper - 1, 2 * 1.6448536269514722, 1e-14);
  close(normalCdf((r.upper - 1) / 2) - normalCdf((r.lower - 1) / 2), 0.9, 1e-15);
  const v = normalInterval([0, 1], [1, 0.5], 0.95) as { lower: number[]; upper: number[] };
  close(v.upper[0], 1.959963984540054, 1e-14);
  close(v.lower[1], 1 - 0.5 * 1.959963984540054, 1e-14);
  assert.throws(() => normalInterval(0, 1, 1), /level/);
});

test("expectedMisorderedPairs: league closed forms 88.1 (estimate order) and 80.7 (posterior means, prior SD .15)", () => {
  const L = league30();
  const raw = expectedMisorderedPairs(L.theta, L.se);
  const pm = expectedMisorderedPairs(L.theta, L.se, { priorSd: 0.15 });
  close(raw, 88.12, 0.005, "estimate order");
  close(pm, 80.69, 0.005, "posterior-mean order");
  // seeded Monte Carlo of misorderedPairs over replays agrees with both closed forms
  const R = 2000;
  const a: number[] = [];
  const b: number[] = [];
  for (let r = 0; r < R; r += 1) {
    const est = drawLeague(LEAGUE_SEED + r).estimate;
    a.push(misorderedPairs(est, L.theta).count);
    b.push(misorderedPairs(post(est, L.se).mean, L.theta).count);
  }
  for (const [xs, want] of [[a, raw], [b, pm]] as const) {
    const m = xs.reduce((s, x) => s + x, 0) / R;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (R - 1));
    assert.ok(Math.abs(m - want) < 4 * (sd / Math.sqrt(R)), `MC mean ${m} against ${want} (MCSE ${sd / Math.sqrt(R)})`);
  }
  // equal true values count 1; no noise counts 0 for distinct values
  assert.equal(expectedMisorderedPairs([1, 1], 0.1), 1);
  assert.equal(expectedMisorderedPairs([1, 0], 0), 0);
  close(expectedMisorderedPairs([0.1, 0], 0.1), normalCdf(-0.1 / Math.hypot(0.1, 0.1)), 1e-16);
});

test("misorderedPairs, topKOverlap and extremeCounts", () => {
  assert.deepEqual(misorderedPairs([3, 2, 1], [1, 2, 3]), { count: 3, pairs: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }] });
  assert.deepEqual(misorderedPairs([3, 2, 1], [3, 2, 2]), { count: 1, pairs: [{ i: 1, j: 2 }] });
  assert.equal(misorderedPairs(SIX, SIX).count, 0);
  assert.deepEqual(topKOverlap([5, 4, 3, 2, 1], [1, 4, 5, 3, 2], 2), { count: 1, members: [1] });
  assert.deepEqual(topKOverlap([1, 1, 1], [1, 1, 1], 2), { count: 2, members: [0, 1] });
  const e = extremeCounts([5, 4, 3, 2, 1], ["s", "m", "s", "l", "m"], 2);
  assert.deepEqual(e, { k: 2, top: { s: 1, m: 1, l: 0 }, bottom: { s: 0, m: 1, l: 1 }, total: { s: 1, m: 2, l: 1 } });
  assert.throws(() => extremeCounts([1, 2], ["a"], 1), /group/);
  assert.throws(() => topKOverlap([1, 2], [1, 2], 3), /k must be at most 2/);
  // small units fill the extremes of the estimate order (L-03); averages over 20 replays
  const L = league30();
  let small = 0;
  let large = 0;
  let overlap = 0;
  for (let r = 0; r < 20; r += 1) {
    const est = drawLeague(LEAGUE_SEED + r).estimate;
    const x = extremeCounts(est, L.group, 5).total;
    small += x.small / 20;
    large += x.large / 20;
    overlap += topKOverlap(est, L.theta, 10).count / 20;
  }
  assert.ok(small > 3 && large < 3, `small ${small}, large ${large}`);
  assert.ok(overlap > 5 && overlap < 9.5, `overlap ${overlap}`);
});

test("rankSummaries: the ch. 19 three-unit law (Pr(first) .3/.7/0, means 6/4/3, expected ranks 2.4/1.3/2.3)", () => {
  const r = rankSummaries({ states: [[20, 4, 3], [0, 4, 3]], probs: [0.3, 0.7] });
  r.pTop[0].forEach((x, i) => close(x, [0.3, 0.7, 0][i], 1e-16, "Pr(first)"));
  r.means.forEach((x, i) => close(x, [6, 4, 3][i], 1e-15, "mean"));
  r.expectedRank.forEach((x, i) => close(x, [2.4, 1.3, 2.3][i], 1e-15, "expected rank"));
  assert.deepEqual(r.pTop[2], [1, 1, 1]);
  assert.equal(r.tieFree, true);
  // rank distributions: each unit's column sums to 1, each rank's row to 1 (tie-free)
  for (let i = 0; i < 3; i += 1) close(r.rankProbs.reduce((s, row) => s + row[i], 0), 1, 1e-15);
  r.rankProbs.forEach((row) => close(row.reduce((s, x) => s + x, 0), 1, 1e-15));
  // ch. 10 law: orders ABC, BCA, CBA with .51, .48, .01: expected ranks 1.98, 1.52, 2.50
  const ten = rankSummaries({ states: [[3, 2, 1], [1, 3, 2], [1, 2, 3]], probs: [0.51, 0.48, 0.01] });
  ten.expectedRank.forEach((x, i) => close(x, [1.98, 1.52, 2.5][i], 1e-15));
  // tie-free: expected rank = postrank_expected_rank on the law's error array
  const law = finiteLawPairwise([[3, 2, 1], [1, 3, 2], [1, 2, 3]], [0.51, 0.48, 0.01]);
  expectedRank(law).forEach((x, i) => close(x, ten.expectedRank[i], 1e-15));
  // equal weights (probs null) and a tie: the tied units share the best position
  const tie = rankSummaries({ states: [[1, 1, 0], [0, 1, 2]] });
  assert.equal(tie.tieFree, false);
  assert.deepEqual(tie.pTop[0], [0.5, 0.5, 0.5]);
  assert.deepEqual(tie.expectedRank, [2, 1.5, 2]);
  assert.throws(() => rankSummaries({ states: [[1, 2]], probs: [0.5] }), /sum to 1/);
  assert.throws(() => rankSummaries({ states: [[[1, 2], [3, 4]]] }), /one value per unit/);
});

test("rankSummariesMC: rank summaries of gaussianDraws (K = 1) as shares of the draws; league check", () => {
  const means = [0.3, 0.1, 0.25, -0.2];
  const sds = [0.1, 0.2, 0.05, 0.1];
  const mc = rankSummariesMC(means, sds, 500, 3);
  const states = gaussianDraws(means, sds, 500, 3).map((d) => d.map((x) => x[0]));
  const exact = rankSummaries({ states });
  assert.deepEqual({ ...mc, S: undefined, seed: undefined, label: undefined }, { ...exact, S: undefined, seed: undefined, label: undefined });
  assert.equal(mc.label, "monte-carlo");
  mc.pTop[0].forEach((x) => assert.equal(x * 500, Math.round(x * 500)));
  // league teaching posterior, S = 4,000: expected ranks near the exact 1 + Σ_j π_ji
  const L = league30();
  const p = post(drawLeague().estimate, L.se);
  const S = 4000;
  const r = rankSummariesMC(p.mean, p.sd, S, 7);
  const pi = directionMatrix(p.mean, p.sd);
  for (let i = 0; i < 30; i += 1) {
    let er = 1;
    for (let j = 0; j < 30; j += 1) if (j !== i) er += pi[j][i];
    close(r.expectedRank[i], er, 0.25, `unit ${i}`);
  }
  assert.ok(Math.abs(r.pTop[9].reduce((s, x) => s + x, 0) - 10) < 1e-9);
});

test("krwExample1Band: (2 − √2 z, √2 z) at τ = .20 is about (.810, 1.190); empty at τ = .25 and at τ = .05", () => {
  const b = krwExample1Band(0.2);
  assert.equal(b.empty, false);
  close(b.lower, 0.81, 5e-4);
  close(b.upper, 1.19, 5e-4);
  close(b.pi13, 0.921, 5e-4);
  // inside the band the pairwise rule withholds 1–2 and 2–3 and states 1 above 3; outside it does not
  const decide = (o2: number, tau: number) => {
    const pi = directionMatrix([2, o2, 0], 1);
    return [
      pairDecision(1 - pi[0][1], pi[0][1], tau).best,
      pairDecision(1 - pi[1][2], pi[1][2], tau).best,
      pairDecision(1 - pi[0][2], pi[0][2], tau).best,
    ];
  };
  assert.deepEqual(decide(1, 0.2), [["withhold"], ["withhold"], ["iAboveJ"]]);
  // below the band 1 above 2 is stated; above it 2 above 3
  assert.deepEqual(decide(0.7, 0.2)[0], ["iAboveJ"]);
  assert.deepEqual(decide(1.3, 0.2)[1], ["iAboveJ"]);
  // τ = .25: empty, and the pairwise choices at ω₂ = 1 form the report 1/2/3
  const e = krwExample1Band(0.25);
  assert.deepEqual([e.empty, e.lower, e.upper, e.states13], [true, null, null, true]);
  assert.deepEqual(decide(1, 0.25), [["iAboveJ"], ["iAboveJ"], ["iAboveJ"]]);
  // τ = .05: the interval is nonempty but the rule would not state 1 above 3
  const low = krwExample1Band(0.05);
  assert.deepEqual([low.empty, low.states13], [true, false]);
  // the band exists for τ between 1 − Φ(√2) ≈ .0786 and 1 − Φ(1/√2) ≈ .2398
  assert.equal(krwExample1Band(0.079).empty, false);
  assert.equal(krwExample1Band(0.078).empty, true);
  assert.equal(krwExample1Band(0.2397).empty, false);
  assert.equal(krwExample1Band(0.2399).empty, true);
  assert.throws(() => krwExample1Band(0.6), /tau/);
});

test("gaussianDraws: theta[s][i][k] = means[i][k] + sds[i][k]·z[(s·n + i)·K + k], z = normals(seed, S·n·K)", () => {
  const means = [[1, 0], [0.5, 2], [-1, 1]];
  const sds = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];
  const d = gaussianDraws(means, sds, 7, 42);
  const z = normals(42, 7 * 3 * 2);
  assert.equal(d.length, 7);
  for (let s = 0; s < 7; s += 1) for (let i = 0; i < 3; i += 1) for (let k = 0; k < 2; k += 1) assert.equal(d[s][i][k], means[i][k] + sds[i][k] * z[(s * 3 + i) * 2 + k]);
  // n-vector means (K = 1) and one common SD
  const v = gaussianDraws(SIX, 0.2, 3, 1);
  const z1 = normals(1, 18);
  assert.deepEqual(v[2], SIX.map((m, i) => [m + 0.2 * z1[12 + i]]));
  assert.throws(() => gaussianDraws(SIX, -1, 3, 1), /sds/);
  assert.throws(() => gaussianDraws(SIX, 0.2, 0, 1), /S must be/);
});

test("mcse: sample SD (divisor S − 1) over √S; null for one draw; six sites e_AB at S = 1,000 is about .0124", () => {
  assert.equal(mcse([0.3]), null);
  assert.equal(mcse([]), null);
  close(mcse([1, 2, 3, 4]) as number, Math.sqrt(5 / 3) / 2, 1e-16);
  // a 0/1 trace: √(ê(1 − ê)/(S − 1))
  const u = rng(3);
  const trace = Array.from({ length: 1000 }, () => (u() < 0.188 ? 1 : 0));
  const eHat = trace.reduce((s, x) => s + x, 0) / 1000;
  close(mcse(trace) as number, Math.sqrt((eHat * (1 - eHat)) / 999), 1e-15);
  close(Math.sqrt((0.188 * 0.812) / 1000), 0.0124, 5e-5, "closed form at the exact e");
  // shift invariance and a constant trace
  close(mcse(trace.map((x) => x + 1e6)) as number, mcse(trace) as number, 1e-9);
  assert.equal(mcse([0.2, 0.2, 0.2]), 0);
  assert.throws(() => mcse([1, Number.NaN]), /finite/);
});

test("envelopeRadius: M = 15, α = .05: S = 1,000 gives .0566 (package) and .0595 (book); S = 100 .1788 / .1883", () => {
  close(envelopeRadius(15, 1000, 0.05), 0.0566, 5e-5);
  close(envelopeRadius(15, 1000, 0.05, "book"), 0.0595, 5e-5);
  close(envelopeRadius(15, 100, 0.05, "package"), 0.1788, 5e-5);
  close(envelopeRadius(15, 100, 0.05, "book"), 0.1883, 5e-5);
  close(envelopeRadius(15, 1000, 0.05), Math.sqrt(Math.log((2 * 15) / 0.05) / 2000), 1e-15);
  close(envelopeRadius(15, 1000, 0.05, "book"), Math.sqrt(Math.log((4 * 15) / 0.05) / 2000), 1e-15);
  // not capped at 1
  assert.ok(envelopeRadius(435, 1, 0.01) > 1);
  assert.throws(() => envelopeRadius(15, 1000, 1), /alpha/);
  assert.throws(() => envelopeRadius(15, 0, 0.05), /S must be/);
  assert.throws(() => envelopeRadius(15, 10, 0.05, "other" as never), /form/);
});

test("fragilePairs: the package rule on six-site draws (A–B at S = 1,000; C–D at S = 400, τ = .35)", () => {
  const ab = fragilePairs(gaussianDraws(SIX, 0.2, 1000, 1), { tau: 0.2 });
  assert.equal(ab.summary.pairs, 15);
  close(ab.screenMargin, (2 * 0.5) / Math.sqrt(999), 1e-16);
  const pAB = ab.pairs.find((p) => p.i === 0 && p.j === 1);
  assert.ok(pAB !== undefined);
  assert.equal(pAB.betterDirection, "i_ahead");
  assert.equal(pAB.fragile, true);
  close(pAB.mcse, 0.0124, 5e-4);
  const cd = fragilePairs(gaussianDraws(SIX, 0.2, 400, 1), { tau: 0.35 });
  const pCD = cd.pairs.find((p) => p.idI === "C" && p.idJ === "D");
  assert.equal(pCD?.fragile, true);
  close(pCD?.weightedError ?? null, 0.362, 0.01);
});

test("fragilePairs = its definition (brute force), with K = 2, a grade and the package's pair order", () => {
  const means = SIX.map((a, i) => [a, [0.7, 0.4, 0.9, 0.6, -0.5, -0.7][i]]);
  const S = 300;
  const draws = gaussianDraws(means, 0.2, S, 8);
  const w = [0.5, 0.5];
  const tau = 0.25;
  const grade = [1, 1, 1, 1, 2, 3];
  const f = fragilePairs(draws, { tau, w, grade, screenMargin: Number.POSITIVE_INFINITY });
  const E = drawErrors(draws);
  const order: [number, number][] = [];
  for (let j = 1; j < 6; j += 1) for (let i = 0; i < j; i += 1) order.push([i, j]);
  assert.deepEqual(f.pairs.map((p) => [p.i, p.j]), order, "every pair traced, column-major upper triangle");
  let fragile = 0;
  for (const p of f.pairs) {
    const fwd = w[0] * E.e[0][p.i][p.j] + w[1] * E.e[1][p.i][p.j];
    const bwd = w[0] * E.e[0][p.j][p.i] + w[1] * E.e[1][p.j][p.i];
    const aheadI = fwd <= bwd;
    assert.equal(p.weightedError, aheadI ? fwd : bwd);
    assert.equal(p.betterDirection, aheadI ? "i_ahead" : "j_ahead");
    const [a, b] = aheadI ? [p.i, p.j] : [p.j, p.i];
    const trace = draws.map((d) => w[0] * (d[a][0] <= d[b][0] ? 1 : 0) + w[1] * (d[a][1] <= d[b][1] ? 1 : 0));
    close(p.mcse, mcse(trace) as number, 1e-17);
    assert.equal(p.margin, Math.abs(p.weightedError - tau));
    assert.equal(p.fragile, p.margin < 2 * (p.mcse as number));
    assert.equal(p.disclosePreferred, p.weightedError < tau);
    const rel = grade[p.i] === grade[p.j] ? "tied" : (grade[p.i] < grade[p.j]) === aheadI ? "disclosed_better_direction" : "disclosed_reverse";
    assert.equal(p.relationInGrade, rel);
    if (p.fragile) fragile += 1;
  }
  assert.equal(f.summary.fragile, fragile);
  assert.equal(f.summary.fragileShare, fragile / 15);
  assert.equal((f.summary.fragileDisclosed ?? 0) + (f.summary.fragileTied ?? 0), fragile);
  // the default screen keeps every pair that could be flagged
  const screened = fragilePairs(draws, { tau, w });
  assert.equal(screened.summary.fragile, fragile);
  assert.ok(screened.summary.traced <= 15);
  for (const p of screened.pairs) assert.ok(p.margin < screened.screenMargin);
  // one draw: MCSE unavailable, flags null
  const single = fragilePairs([draws[0]], { tau: 0.5, w, screenMargin: Number.POSITIVE_INFINITY });
  assert.equal(single.summary.fragile, null);
  assert.equal(single.summary.mcseUnavailable, 15);
  assert.throws(() => fragilePairs(draws, { tau, w, z: 0 }), /z must be/);
  assert.throws(() => fragilePairs(draws, { tau }), /weights w are required/);
});

test("timing: fragilePairs at n = 30, S = 4,000, K = 3 (league teaching posteriors of three draws)", (t) => {
  const L = league30();
  const P = [0, 1, 2].map((r) => post(drawLeague(LEAGUE_SEED + r).estimate, L.se));
  const means = L.theta.map((_, i) => P.map((p) => p.mean[i]));
  const sds = L.theta.map((_, i) => P.map((p) => p.sd[i]));
  const draws = gaussianDraws(means, sds, 4000, LEAGUE_SEED);
  const ms: number[] = [];
  let summary = fragilePairs(draws, { tau: 0.2, w: [0.5, 0.25, 0.25] }).summary;
  for (let r = 0; r < 7; r += 1) {
    const t0 = performance.now();
    summary = fragilePairs(draws, { tau: 0.2, w: [0.5, 0.25, 0.25] }).summary;
    ms.push(performance.now() - t0);
  }
  const t0 = performance.now();
  gaussianDraws(means, sds, 4000, LEAGUE_SEED);
  const gen = performance.now() - t0;
  assert.equal(summary.pairs, 435);
  t.diagnostic(
    `fragilePairs n = 30, S = 4,000, K = 3: ${median(ms).toFixed(1)} ms median of 7 (${summary.traced} traced, ${summary.fragile} fragile); gaussianDraws ${gen.toFixed(1)} ms`,
  );
  assert.ok(median(ms) < 5000);
  // the drawn error array agrees with the exact normal errors to Monte Carlo precision
  const Ehat = drawErrors(draws);
  const Eex = errorArray(means, sds);
  for (let i = 0; i < 30; i += 1) for (let j = 0; j < 30; j += 1) if (i !== j) close(Ehat.e[1][i][j], Eex.e[1][i][j], 0.04);
});
