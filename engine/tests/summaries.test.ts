// Step 5.14: the Part 1 summaries that widgets used to compute themselves (summaries.ts, leagueReplays in
// simulate.ts, unitRelationCounts in report.ts). Each test checks the definition on small hand-made inputs and the
// league values the pages state, and that the engine reproduces the widget's former computation exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { directionMatrix } from "../src/pairwise.ts";
import { canonicalGrade, relations, unitRelationCounts } from "../src/report.ts";
import { rng } from "../src/random.ts";
import {
  LEAGUE_SEED, drawLeague, extremeCounts, league30, leagueReplays, misorderedPairs, normalInterval, normalPosterior,
  rankSummaries, rankSummariesMC, topKOverlap, type NormalPosterior,
} from "../src/simulate.ts";
import { strictOrder } from "../src/rules.ts";
import { pairDirection } from "../src/pairwise.ts";
import { fartherCount, intervalOverlapTally, meanSquaredDistance, rankIntervals, summaryStats } from "../src/summaries.ts";

const close = (got: number | null, want: number, tol: number, what = "") =>
  assert.ok(got !== null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);
const round = (x: number, d: number) => Number(x.toFixed(d));

const L = league30();
const EST = drawLeague(LEAGUE_SEED).estimate;
const post = (sd: number) => normalPosterior(EST, L.se, { priorMean: 0, priorSd: sd }) as NormalPosterior<number[]>;

// --- the widgets' former code, kept here as the reference the engine must reproduce
const naiveMean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const naiveSd = (a: number[]) => {
  const m = naiveMean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
};

test("summaryStats: n, mean and sample SD (divisor n − 1); sd null for one value; input checks", () => {
  const s = summaryStats([1, 2, 3, 4]);
  assert.equal(s.n, 4);
  assert.equal(s.mean, 2.5);
  close(s.sd, Math.sqrt(5 / 3), 1e-15);
  assert.deepEqual(summaryStats([7]), { n: 1, mean: 7, sd: null });
  assert.equal(summaryStats(new Float64Array([2, 2, 2])).sd, 0);
  assert.throws(() => summaryStats([]), /nonempty/);
  assert.throws(() => summaryStats([1, Number.NaN]), /finite/);
  // league spreads at prior SD .15 (L-04 view 2: .162, .098, .149) and agreement with the widget's two-pass SD
  const pm = post(0.15).mean;
  for (const [x, want] of [[EST, 0.162], [pm, 0.098], [L.theta, 0.149]] as [number[], number][]) {
    const sd = summaryStats(x).sd as number;
    assert.equal(round(sd, 3), want);
    close(sd, naiveSd(x), 1e-15 * sd);
  }
});

test("meanSquaredDistance: (1/n) Σ (a_i − b_i)²; league .0163 (estimates) and .0096 (posterior means, prior SD .15)", () => {
  assert.equal(meanSquaredDistance([1, 2, 3], [1, 2, 3]), 0);
  close(meanSquaredDistance([0, 0], [1, 3]), 5, 1e-15);
  assert.throws(() => meanSquaredDistance([1, 2], [1]), /2 values/);
  const naive = (a: number[]) => naiveMean(a.map((x, i) => (x - L.theta[i]) * (x - L.theta[i])));
  const est = meanSquaredDistance(EST, L.theta);
  const pm = meanSquaredDistance(post(0.15).mean, L.theta);
  assert.equal(round(est, 4), 0.0163);
  assert.equal(round(pm, 4), 0.0096);
  close(est, naive(EST), 1e-15 * est);
  close(pm, naive(post(0.15).mean), 1e-15 * pm);
  // a prior that is too narrow (.02) moves the posterior means farther from the truth on average
  assert.ok(meanSquaredDistance(post(0.02).mean, L.theta) > est);
});

test("fartherCount: strict |m − θ| > |y − θ|; 14 league units at prior SD .15", () => {
  const r = fartherCount([1, 0, 2, 5], [0.5, 1, 1, 3], [0, 0.5, 1.5, 4]);
  // unit 1: |1 − .5| = |0 − .5| (equal distance is not farther); unit 2: |1 − 1.5| = |2 − 1.5|; unit 3: 1 = 1
  assert.deepEqual(r.flags, [false, false, false, false]);
  const s = fartherCount([1, 0], [0.5, -1], [0, 0]);
  assert.deepEqual(s, { count: 1, flags: [false, true], units: [1] });
  assert.throws(() => fartherCount([1], [1, 2], [1]), /values/);
  for (const sd of [0.02, 0.05, 0.15, 0.3, 0.6]) {
    const pm = post(sd).mean;
    const f = fartherCount(EST, pm, L.theta);
    const widget = pm.map((m, i) => Math.abs(m - L.theta[i]) > Math.abs(EST[i] - L.theta[i]));
    assert.deepEqual(f.flags, widget, `prior SD ${sd}`);
    assert.equal(f.count, widget.filter(Boolean).length);
    assert.deepEqual(f.units, widget.flatMap((x, i) => (x ? [i] : [])));
  }
  assert.equal(fartherCount(EST, post(0.15).mean, L.theta).count, 14);
});

/** The interval-overlap widget's former league tally (orientation by posterior-mean rank). */
function widgetTally(sd: number, level: number, threshold: number) {
  const p = post(sd);
  const iv = normalInterval(p.mean, p.sd, level) as { lower: number[]; upper: number[] };
  const rank = strictOrder(p.mean);
  const counts = { apart: 0, high: 0, low: 0 };
  const cls: string[] = [];
  let best: { first: number; second: number; pi: number } | null = null;
  for (let i = 0; i < 30; i += 1) {
    for (let j = i + 1; j < 30; j += 1) {
      const [hi, lo] = rank[i] < rank[j] ? [i, j] : [j, i];
      const pi = pairDirection(p.mean[hi], p.sd[hi], p.mean[lo], p.sd[lo]);
      const overlap = iv.lower[hi] < iv.upper[lo];
      const c = overlap ? (pi > threshold ? "high" : "low") : "apart";
      counts[c as keyof typeof counts] += 1;
      cls.push(c);
      if (overlap && (!best || pi > best.pi)) best = { first: hi, second: lo, pi };
    }
  }
  return { counts, cls, best, iv, p };
}

test("intervalOverlapTally: apart / high / low on hand-made pairs; touching intervals do not overlap", () => {
  const pi = [[Number.NaN, 0.95, 0.6], [0.05, Number.NaN, 0.3], [0.4, 0.7, Number.NaN]];
  const t = intervalOverlapTally([2, 0, 1], [3, 2, 2.5], pi, { threshold: 0.9 });
  // (0, 1): [2, 3] and [0, 2] touch at 2: apart; (0, 2): overlap, max π = .6: low; (1, 2): overlap, max π = .7 (2 first): low
  assert.deepEqual(t.pairs.map((p) => [p.i, p.j, p.class, p.first, p.second, p.pi]), [
    [0, 1, "apart", 0, 1, 0.95], [0, 2, "low", 0, 2, 0.6], [1, 2, "low", 2, 1, 0.7],
  ]);
  assert.equal(t.M, 3);
  assert.deepEqual([t.apart, t.overlapping, t.high, t.low], [1, 2, 0, 2]);
  assert.deepEqual(t.best, { i: 1, j: 2, first: 2, second: 1, pi: 0.7 });
  const u = intervalOverlapTally([2, 0, 1], [3, 2, 2.5], pi, { threshold: 0.65 });
  assert.deepEqual([u.apart, u.high, u.low], [1, 1, 1]);
  // equal probabilities: i comes first; equal best values: the first pair in pair order
  const half = [[Number.NaN, 0.5, 0.5], [0.5, Number.NaN, 0.5], [0.5, 0.5, Number.NaN]];
  const h = intervalOverlapTally([0, 0, 0], [1, 1, 1], half);
  assert.equal(h.threshold, 0.9);
  assert.deepEqual(h.best, { i: 0, j: 1, first: 0, second: 1, pi: 0.5 });
  assert.equal(intervalOverlapTally([0, 2], [1, 3], [[Number.NaN, 0.99], [0.01, Number.NaN]]).best, null);
  assert.throws(() => intervalOverlapTally([1, 0], [0, 1], half.slice(0, 2).map((r) => r.slice(0, 2))), /lower\[0\]/);
  assert.throws(() => intervalOverlapTally([0, 0], [1, 1], [[0, 2], [0, 0]]), /probability/);
  assert.throws(() => intervalOverlapTally([0, 0], [1, 1], [[0, 0.5], [0.5, 0]], { threshold: 2 }), /threshold/);
  assert.throws(() => intervalOverlapTally([0, 0], [1, 1], [[0, 0.5], [0.5, 0]], { tau: 0.1 } as never), /unknown option/);
});

test("intervalOverlapTally: the league at prior SD .15 (36 apart, 88 high, 311 low at 90%; 22 apart at 95%) and the widget's former tally", () => {
  const p = post(0.15);
  const pi = directionMatrix(p.mean, p.sd);
  const iv90 = normalInterval(p.mean, p.sd, 0.9) as { lower: number[]; upper: number[] };
  const t = intervalOverlapTally(iv90.lower, iv90.upper, pi, { threshold: 0.9 });
  assert.deepEqual([t.apart, t.overlapping, t.high, t.low], [36, 399, 88, 311]);
  assert.equal(L.ids[t.best!.first], "U13");
  assert.equal(L.ids[t.best!.second], "U05");
  close(t.best!.pi, 0.98781943458425, 1e-13);
  const iv95 = normalInterval(p.mean, p.sd, 0.95) as { lower: number[]; upper: number[] };
  const t95 = intervalOverlapTally(iv95.lower, iv95.upper, pi, { threshold: 0.9 });
  assert.equal(t95.apart, 22);
  assert.equal(L.ids[t95.best!.first], "U03");
  assert.equal(L.ids[t95.best!.second], "U15");
  for (const sd of [0.02, 0.05, 0.15, 0.31, 0.6]) {
    for (const level of [0.9, 0.95]) {
      const w = widgetTally(sd, level, 0.9);
      const q = directionMatrix(w.p.mean, w.p.sd);
      const e = intervalOverlapTally(w.iv.lower, w.iv.upper, q, { threshold: 0.9 });
      assert.deepEqual({ apart: e.apart, high: e.high, low: e.low }, w.counts, `prior SD ${sd}, level ${level}`);
      assert.deepEqual(e.pairs.map((x) => x.class), w.cls);
      assert.deepEqual(e.best && { first: e.best.first, second: e.best.second, pi: e.best.pi }, w.best);
    }
  }
});

/** which-ranking's former rankInterval(pTop, i, level). */
function widgetInterval(pTop: number[][], i: number, level = 0.9, tieTol = 1e-12) {
  const tail = (1 - level) / 2;
  let lo: number | null = null;
  let hi: number | null = null;
  for (let k = 0; k < pTop.length; k += 1) {
    if (lo === null && pTop[k][i] >= tail - tieTol) lo = k + 1;
    if (hi === null && pTop[k][i] >= 1 - tail - tieTol) hi = k + 1;
  }
  return { lo, hi };
}

test("rankIntervals: first rank whose cumulative probability reaches (1 − level)/2, and 1 − (1 − level)/2", () => {
  // the ch. 19 law: A is 1st with .3, 3rd with .7; B 1st .7, 2nd .3; C 2nd .7, 3rd .3
  const law = rankSummaries({ states: [[20, 4, 3], [0, 4, 3]], probs: [0.3, 0.7] });
  const r = rankIntervals(law.pTop);
  assert.equal(r.level, 0.9);
  close(r.tail, 0.05, 1e-16);
  assert.deepEqual(r.lower, [1, 1, 2]);
  assert.deepEqual(r.upper, [3, 2, 3]);
  // a cumulative value exactly at the tail counts (≥), within tieTol below it too
  const exact = rankIntervals([[0.05, 0.5], [0.95, 1], [1, 1]], { level: 0.9 });
  assert.deepEqual(exact.lower, [1, 1]);
  assert.deepEqual(exact.upper, [2, 2]);
  const below = rankIntervals([[0.05 - 2e-12, 0.5], [1, 1]], { level: 0.9 });
  assert.deepEqual(below.lower, [2, 1]);
  assert.deepEqual(rankIntervals([[0.05 - 2e-12, 0.5], [1, 1]], { level: 0.9, tieTol: 1e-11 }).lower, [1, 1]);
  // never reached: null
  assert.deepEqual(rankIntervals([[0.01], [0.5]]).upper, [null]);
  assert.throws(() => rankIntervals([[0.5, 1], [1]]), /2 values/);
  assert.throws(() => rankIntervals([[1]], { level: 1 }), /level/);
  // the league posterior at prior SD .15 (Monte Carlo, 4,000 draws, seed 1): the widget's former reading
  const p = post(0.15);
  const mc = rankSummariesMC(p.mean, p.sd, 4000, 1);
  const e = rankIntervals(mc.pTop, { level: 0.9 });
  for (let i = 0; i < 30; i += 1) {
    const w = widgetInterval(mc.pTop, i);
    assert.equal(e.lower[i], w.lo);
    assert.equal(e.upper[i], w.hi);
    assert.ok((e.lower[i] as number) <= (e.upper[i] as number));
  }
  for (const i of [0, 1, 2]) {
    const w = widgetInterval(law.pTop, i);
    assert.deepEqual([r.lower[i], r.upper[i]], [w.lo, w.hi]);
  }
});

test("leagueReplays: replays seed + 1 … seed + 20 and their averages 4.35, 3.65, 2.00, 7.45, 83.90 (L-03)", () => {
  const R = leagueReplays(LEAGUE_SEED);
  assert.equal(R.replays, 20);
  assert.equal(R.k, 5);
  assert.equal(R.topK, 10);
  assert.deepEqual(R.seeds, Array.from({ length: 20 }, (_, r) => LEAGUE_SEED + r + 1));
  assert.deepEqual(Object.keys(R.mean.extreme), ["small", "medium", "large"]);
  assert.equal(R.mean.extreme.small, 4.35);
  assert.equal(R.mean.extreme.medium, 3.65);
  assert.equal(R.mean.extreme.large, 2);
  assert.equal(R.mean.topOverlap, 7.45);
  assert.equal(R.mean.misordered, 83.9);
  // replays 1-3 (oracle rows exist for these): top-10 overlap 6, 8, 7; pairs against the true order 116, 90, 80
  assert.deepEqual(R.draws.slice(0, 3).map((d) => [d.topOverlap, d.misordered]), [[6, 116], [8, 90], [7, 80]]);
  for (const d of R.draws) {
    const { estimate } = drawLeague(d.seed);
    assert.deepEqual(d.estimate, estimate);
    assert.deepEqual(d.extreme, extremeCounts(estimate, L.group, 5));
    assert.equal(d.topOverlap, topKOverlap(estimate, L.theta, 10).count);
    assert.equal(d.misordered, misorderedPairs(estimate, L.theta).count);
    assert.equal(d.extreme.total.small + d.extreme.total.medium + d.extreme.total.large, 10);
  }
  // the widget's former averages: plain mean of the twenty counts
  const mean = (f: (d: (typeof R.draws)[number]) => number) => R.draws.reduce((s, d) => s + f(d), 0) / 20;
  assert.equal(R.mean.extreme.medium, mean((d) => d.extreme.total.medium));
  assert.equal(R.mean.misordered, mean((d) => d.misordered));
  const short = leagueReplays(1, { replays: 2, k: 3, topK: 4 });
  assert.deepEqual(short.seeds, [2, 3]);
  assert.equal(short.draws[1].extreme.k, 3);
  assert.throws(() => leagueReplays(LEAGUE_SEED, { replays: 0 }), /replays/);
  assert.throws(() => leagueReplays(1.5), /seed/);
  assert.throws(() => leagueReplays(1, { seed: 2 } as never), /unknown option/);
});

test("unitRelationCounts: the row counts of relations(g): above, below, stated, withheld, partners", () => {
  const r = unitRelationCounts([2, 1, 2, 3, 1]);
  assert.deepEqual(r, { n: 5, partners: 4, above: [1, 3, 1, 0, 3], below: [2, 0, 2, 4, 0], stated: [3, 3, 3, 4, 3], withheld: [1, 1, 1, 0, 1] });
  // labels are canonicalised first (any integers, grade 1 = smallest label)
  assert.deepEqual(unitRelationCounts([10, -4, 10]), unitRelationCounts([2, 1, 2]));
  assert.deepEqual(unitRelationCounts([1]), { n: 1, partners: 0, above: [0], below: [0], stated: [0], withheld: [0] });
  assert.throws(() => unitRelationCounts([]), /at least one/);
  const u = rng(20261031);
  for (let t = 0; t < 50; t += 1) {
    const n = 2 + Math.floor(u() * 30);
    const G = 1 + Math.floor(u() * 5);
    const g = canonicalGrade(Array.from({ length: n }, () => 1 + Math.floor(u() * G)));
    const rel = relations(g);
    const c = unitRelationCounts(g);
    rel.forEach((row, i) => {
      assert.equal(c.above[i], row.filter((v) => v === 1).length);
      assert.equal(c.below[i], row.filter((v) => v === -1).length);
      assert.equal(c.stated[i], row.reduce((acc, v) => acc + (v !== 0 ? 1 : 0), 0));
      assert.equal(c.withheld[i], g.filter((h) => h === g[i]).length - 1);
      assert.equal(c.stated[i] + c.withheld[i], n - 1);
    });
  }
});
