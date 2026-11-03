// Simulation and Monte Carlo: seeded estimates, the simulated league (SR-06), the teaching normal–normal
// posterior, closed-form misordering counts, rank summaries, KRW Example 1, Gaussian draws, MCSE, the IID
// envelope radius and the package's Monte Carlo fragility rule.
//
// Definitions (postrank theory book ch. 5, 10, 15, 19; postrank 1.1.0 R/mc-diagnostics.R,
// R/iid-coefficient-bounds.R; engine/API.md "Simulated league specification")
//   Seeded draws use the one stream (random.ts): z = normals(seed, count), consumed in the documented order.
//   Teaching posterior (normal prior N(m, σ²), estimate θ̂ ~ N(θ, SE²)): shrink B = σ²/(σ² + SE²),
//     mean m + B(θ̂ − m), SD √B·SE ("a posterior the course specifies for teaching; postrank does not fit it").
//   Expected misordered pairs against a fixed true θ: with t_ij = sign(θ_i − θ_j), the order of the estimates
//     disagrees with t_ij with probability Φ(−|θ_i − θ_j|/√(SE_i² + SE_j²)); the order of the posterior means
//     B_iθ̂_i (prior mean 0) with probability Φ(−t_ij(B_iθ_i − B_jθ_j)/√(B_i²SE_i² + B_j²SE_j²)).
//   Rank from the top (ch. 5): R_i(θ) = 1 + #{j ≠ i : θ_j > θ_i}; expected rank, Pr(R_i = r), Pr(R_i ≤ k).
//   KRW Example 1 (ch. 10; KRW 2024): independent N(ω_i, 1) beliefs with ω_1 = 2, ω_3 = 0; deciding each pair
//     alone at withholding cost τ, the pairwise rule states 1 above 3 (π_13 = Φ(√2) ≥ 1 − τ) while withholding
//     1–2 and 2–3 exactly for ω_2 in (2 − √2 z, √2 z), z = Φ⁻¹(1 − τ).
//   MCSE (postrank_mc_fragility(), IID regime): sample SD (divisor S − 1) over √S.
//   Envelope radius (ch. 15 independent-draw-coefficient-envelope; postrank_iid_bounds()): package (tie-free,
//     2M one-sided events, one criterion at a time) √((log 2 + log M − log α)/(2S)); book (ch. 15
//     prp-iid-coefficient-envelope: equality permitted, 4MK events over K criteria) √(log(4MK/α)/(2S)); not
//     capped at 1.
//   Fragility (postrank_mc_fragility()): d = min(ebar_ij, ebar_ji) (ties: i ahead), flagged when
//     |d − τ| < z·MCSE of the weighted indicator trace Σ_k w_k 1{θ_ak ≤ θ_bk} of the better direction a over b;
//     only pairs with |d − τ| below the screen margin z·0.5/√max(1, S − 1) are traced (no pair that could be
//     flagged is screened out).
//   Finite-law draws (Step 6.14; G-05): u = uniforms(seed, S); c_k = c_{k−1} + p_k left to right (c_0 = p_0);
//     draw s is the smallest k with u_s < c_k (strict), or the last index K − 1 when u_s ≥ every sum.
//
// v3 helpers (engine/API.md "v3 helpers (Phase 2, Step 2.1)"; plain sums in index order):
//   topKOvershoot / leagueOvershoot (1.4): the winner's curse, (1/k) Σ_u (estimate_u − θ_u) over the top (or
//     bottom) k by estimate (ties by index), for one draw and over league replays drawLeague(seed + r).
//   expectedSquaredDistance (1.6): E[(m_i − θ_i)²] = ((1 − B_i)(μ − θ_i))² + B_i²SE_i² for the teaching posterior.
//   weightedRadius, regretBound (1.17, 2.17; ch. 15 "Coefficient perturbation and regret on a common domain"):
//     δ_w = Σ_k w_k ε_k; N·δ_w/M, (N + N*)·δ_w/M + η and 2δ_w + η.
//   twoStateChain, chainMeanVariance (1.18; ch. 15 "Finite-sample coefficient error in a stationary two-state
//     chain"): a seeded stationary 0/1 chain, and the exact variance of its mean with ρ = 1 − p01 − p10.
//   leagueGradingReplays (2.19): fixedOrderDP reports of the league replays and their self-reported and realized
//     errors, with disclosedErrorEstimands over the realized (D, N).
//   transformedMeans (1.14): posterior means of f(θ) (identity, √, log, exp(kθ)) and their order.
//   selectionOnDraws (2.18; ch. 15): the optimum on drawErrors(draws) judged under the exact errors, with the
//     coefficient error ε_k (maxCoefficientError), δ_w and the evaluation and regret bounds.
//
// Part 1 supplement (engine/API.md "v3 helpers: Part 1 supplement (Step 3.27)"; plain sums in index order):
//   withinBand (1.2): units with |est_i − ref_i|/se_i ≤ crit (those evidenceFlags leaves unflagged), beside the
//     expected count n·normalCoverage(crit).
//   sharedMeanPosterior (1.9): the normal model est_i ~ N(θ_i, se_i²), θ_i ~ N(μ, σ²), μ ~ N(μ₀, s_μ²) (s_μ = ∞: a
//     flat prior on μ): the weights B_i = σ²/(σ² + se_i²), the posterior of μ, and the posterior means, SDs and
//     correlations of the θ_i (correlated through the shared μ).
//   binomialMcse (1.17): √(e(1 − e)/S), the Monte Carlo SE of a share with exact value e (the register's exact-e
//     approximation; the apps report mcse(trace)).
//   chainCountLaw (1.18): the exact law of the number of ones in S draws of the stationary two-state chain, by the
//     forward recursion over (count, current state), and the exact chance that the chain mean misses π₁ by more
//     than a radius.
//   runningMean (1.18): the running mean of a trace.

import {
  Accumulator, type ErrorArray, type UnitTable, defaultIds, drawErrors, errorArray, maxCoefficientError, readLaw, readTable,
} from "./pairwise.ts";
import { type Family, type Grade, pairCount, reportGrade } from "./report.ts";
import {
  type DisclosedErrorEstimands, checkTau, checkWeights, disclosedErrorEstimands, errorCube, evaluateReport, realizedWrong,
} from "./risk.ts";
import { exactOptimum, fixedOrderDP } from "./optimize.ts";
import { strictOrder } from "./rules.ts";
import { normals, uniforms } from "./random.ts";
import { normalCdf, normalCoverage, normalQuantile, normalSf } from "./special.ts";
import { checkKeys, readOptions } from "./options.ts";

/** Default league seed (SR-06); replay r uses LEAGUE_SEED + r. */
export const LEAGUE_SEED = 20261030;

// ---------------------------------------------------------------------------------------------------------
// Types

export interface League {
  ids: string[];
  /** 16, 64, 256 cycling from U01 */
  size: number[];
  /** "small" / "medium" / "large" */
  group: string[];
  /** SE_i = 0.8/√size_i (.20, .10, .05) */
  se: number[];
  /** θ_i = .15·Φ⁻¹((r_i − .5)/30) */
  theta: number[];
  /** r_i = (19·i) mod 31 for i = 1..30 (a permutation of 1..30; larger r means larger θ) */
  rank: number[];
}

export interface PosteriorOptions {
  /** prior mean m; default 0 */
  priorMean?: number;
  /** prior SD σ > 0; default .15; Infinity gives the flat prior (B = 1) */
  priorSd?: number;
}

export interface NormalPosterior<T> {
  mean: T;
  sd: T;
  shrink: T;
}

export interface MisorderOptions {
  /** with a prior SD, the count for the posterior-mean order B_iθ̂_i; without, for the estimate order */
  priorSd?: number | null;
  /** prior mean (default 0) of the posterior-mean order */
  priorMean?: number;
}

export interface PairList {
  count: number;
  /** pairs i < j, ordered by i then j */
  pairs: { i: number; j: number }[];
}

export interface TopKOverlap {
  count: number;
  /** units in both top-k sets, ascending index */
  members: number[];
}

export interface ExtremeCounts {
  k: number;
  /** per group: units among the k highest scores */
  top: Record<string, number>;
  /** per group: units among the k lowest scores */
  bottom: Record<string, number>;
  /** top + bottom */
  total: Record<string, number>;
}

export interface LeagueReplayOptions {
  /** number of replays R (default 20); replay r = 1..R uses seed + r */
  replays?: number;
  /** extreme positions: the top k and the bottom k by estimate (default 5) */
  k?: number;
  /** size of the top group compared with the true top group (default 10) */
  topK?: number;
}

export interface LeagueReplayDraw {
  r: number;
  seed: number;
  /** drawLeague(seed).estimate */
  estimate: number[];
  /** extremeCounts(estimate, group, k): units of each size among the top k, the bottom k and both */
  extreme: ExtremeCounts;
  /** topKOverlap(estimate, theta, topK).count */
  topOverlap: number;
  /** misorderedPairs(estimate, theta).count */
  misordered: number;
}

export interface LeagueReplays {
  seed: number;
  replays: number;
  k: number;
  topK: number;
  /** seed + 1, …, seed + R */
  seeds: number[];
  draws: LeagueReplayDraw[];
  /** averages over the R replays (sum/R of integer counts) */
  mean: { extreme: Record<string, number>; topOverlap: number; misordered: number };
}

export interface FiniteLaw {
  /** states[s][i]: one value per unit (or [value]) */
  states: ArrayLike<UnitTable>;
  /** state probabilities (≥ 0, sum 1); null or omitted = equal weights */
  probs?: ArrayLike<number> | null;
}

export interface RankSummaries {
  n: number;
  /** E[θ_i] */
  means: number[];
  /** E[R_i] */
  expectedRank: number[];
  /** rankProbs[r][i] = Pr(R_i = r + 1) */
  rankProbs: number[][];
  /** pTop[k][i] = Pr(R_i ≤ k + 1) (k-major) */
  pTop: number[][];
  /** no state has two equal values */
  tieFree: boolean;
}

export interface RankSummariesMC extends RankSummaries {
  S: number;
  seed: number;
  label: "monte-carlo";
}

export interface KrwBand {
  tau: number;
  /** no ω₂ gives the contradiction: the interval is empty, or the rule would not state 1 above 3 */
  empty: boolean;
  /** open interval (lower, upper) of ω₂; null when empty */
  lower: number | null;
  upper: number | null;
  /** π_13 = Φ(√2) */
  pi13: number;
  /** the pairwise rule states 1 above 3 (e_13 = 1 − π_13 ≤ τ) */
  states13: boolean;
}

export interface FragilityOptions {
  tau: number;
  /** criterion weights; default [1] when K = 1 */
  w?: readonly number[];
  /** MCSE multiplier, > 0; default 2 */
  z?: number;
  /** trace only pairs with margin below this (> 0; Infinity traces every pair); default z·0.5/√max(1, S − 1) */
  screenMargin?: number;
  /** a report whose relation of each traced pair is labelled (postrank_mc_fragility(fit = …)) */
  grade?: ArrayLike<number>;
  ids?: readonly string[];
}

export interface FragilePair {
  i: number;
  j: number;
  idI: string;
  idJ: string;
  betterDirection: "i_ahead" | "j_ahead";
  /** d = min(ebar_ij, ebar_ji) */
  weightedError: number;
  /** |d − τ| */
  margin: number;
  /** d < τ */
  disclosePreferred: boolean;
  /** null when S = 1 */
  mcse: number | null;
  /** margin/mcse */
  ratio: number | null;
  /** margin < z·mcse; null when the MCSE is unavailable */
  fragile: boolean | null;
  relationInGrade?: "tied" | "disclosed_better_direction" | "disclosed_reverse";
}

export interface Fragility {
  S: number;
  n: number;
  K: number;
  tau: number;
  w: number[];
  z: number;
  screenMargin: number;
  regime: "iid";
  mcseMethod: "iid_sample_sd_over_sqrt_S";
  /** traced pairs in the package's order (upper triangle, column-major: (0,1), (0,2), (1,2), (0,3), …) */
  pairs: FragilePair[];
  summary: {
    pairs: number;
    traced: number;
    fragile: number | null;
    fragileShare: number | null;
    mcseUnavailable: number;
    fragileDisclosed?: number | null;
    fragileTied?: number | null;
  };
  label: "monte-carlo";
}

// ---------------------------------------------------------------------------------------------------------
// Helpers

function checkFinite(x: number, name: string): number {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new RangeError(`${name} must be a finite number`);
  return x;
}

function checkCount(x: number, name: string, min = 0): number {
  if (!Number.isSafeInteger(x) || x < min) throw new RangeError(`${name} must be an integer ≥ ${min}`);
  return x;
}

function readVector(x: ArrayLike<number>, name: string): number[] {
  if (x == null || typeof x !== "object" || typeof x.length !== "number" || x.length < 1) throw new RangeError(`${name} must be a nonempty array`);
  const out = Array.from(x);
  if (!out.every((v) => typeof v === "number" && Number.isFinite(v))) throw new RangeError(`${name} must be finite numbers`);
  return out;
}

/** A vector, or one number recycled to length n. */
function readOrRecycle(x: ArrayLike<number> | number, n: number, name: string): number[] {
  if (typeof x === "number") return new Array<number>(n).fill(checkFinite(x, name));
  const v = readVector(x, name);
  if (v.length !== n) throw new RangeError(`${name} must have ${n} values (or be one number)`);
  return v;
}

function checkSds(s: readonly number[], name: string): void {
  if (!s.every((x) => x >= 0)) throw new RangeError(`${name} must be ≥ 0`);
}

/** Unit indices from highest to lowest score; equal scores in index order. */
function descending(s: readonly number[]): number[] {
  return s.map((_, i) => i).sort((a, b) => s[b] - s[a] || a - b);
}

/** R's sd(): two-pass mean with a correction pass, then Σ(x − mean)²/(S − 1), all plain left-to-right sums. */
function sampleSd(x: ArrayLike<number>): number {
  const S = x.length;
  let sum = 0;
  for (let s = 0; s < S; s += 1) sum += x[s];
  let mean = sum / S;
  if (Number.isFinite(mean)) {
    let c = 0;
    for (let s = 0; s < S; s += 1) c += x[s] - mean;
    mean += c / S;
  }
  let ss = 0;
  for (let s = 0; s < S; s += 1) ss += (x[s] - mean) * (x[s] - mean);
  return Math.sqrt(ss / (S - 1));
}

/** Draws draws[s][i][k] (or draws[s][i] when K = 1) as a flat array v[(s·n + i)·K + k]. */
function readDraws(draws: ArrayLike<UnitTable>, name: string): { S: number; n: number; K: number; v: Float64Array } {
  if (draws == null || typeof draws !== "object" || typeof draws.length !== "number" || draws.length < 1) {
    throw new RangeError(`${name} must be a nonempty array of draws`);
  }
  const S = draws.length;
  const first = readTable(draws[0], `${name}[0]`);
  const { n, K } = first;
  const v = new Float64Array(S * n * K);
  v.set(first.v, 0);
  for (let s = 1; s < S; s += 1) {
    const t = readTable(draws[s], `${name}[${s}]`);
    if (t.n !== n || t.K !== K) throw new RangeError(`${name}[${s}] must have ${n} units × ${K} criteria, as ${name}[0]`);
    v.set(t.v, s * n * K);
  }
  return { S, n, K, v };
}

/** Ranks from the top, R_i = 1 + #{j ≠ i : x_j > x_i}, of one state (strict comparison: equal values share the best rank). */
function ranksOf(x: ArrayLike<number>, n: number, out: Int32Array): boolean {
  let tieFree = true;
  for (let i = 0; i < n; i += 1) {
    let r = 1;
    const xi = x[i];
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      if (x[j] > xi) r += 1;
      else if (x[j] === xi) tieFree = false;
    }
    out[i] = r;
  }
  return tieFree;
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/** `count` seeded estimates of one unit: truth + se·z with z = normals(seed, count). */
export function simulateEstimates(truth: number, se: number, count: number, seed: number): number[] {
  checkFinite(truth, "truth");
  if (checkFinite(se, "se") < 0) throw new RangeError("se must be ≥ 0");
  const z = normals(seed, checkCount(count, "count"));
  return Array.from(z, (x) => truth + se * x);
}

/** The SR-06 league of 30 units (no randomness): ids, size, group, SE, true values θ and r_i. */
export function league30(): League {
  const ids = defaultIds(30);
  const sizes = [16, 64, 256];
  const groups = ["small", "medium", "large"];
  const size: number[] = [];
  const group: string[] = [];
  const se: number[] = [];
  const theta: number[] = [];
  const rank: number[] = [];
  for (let i = 1; i <= 30; i += 1) {
    const c = (i - 1) % 3;
    size.push(sizes[c]);
    group.push(groups[c]);
    se.push(0.8 / Math.sqrt(sizes[c]));
    const r = (19 * i) % 31;
    rank.push(r);
    theta.push(0.15 * normalQuantile((r - 0.5) / 30));
  }
  return { ids, size, group, se, theta, rank };
}

/** League estimates for one seed: θ̂_i = θ_i + SE_i·z_i with z = normals(seed, 30) in unit order. */
export function drawLeague(seed: number = LEAGUE_SEED): { seed: number; estimate: number[] } {
  const { theta, se } = league30();
  const z = normals(seed, 30);
  return { seed, estimate: theta.map((t, i) => t + se[i] * z[i]) };
}

/**
 * The teaching normal–normal posterior of each estimate: shrink B = σ²/(σ² + SE²), mean m + B(est − m),
 * SD √B·SE. `est` and `se` are numbers or arrays (a number is recycled); the result has the same shape as
 * `est` (arrays when either input is an array). priorSd = Infinity gives the flat prior (B = 1).
 */
export function normalPosterior(est: number | ArrayLike<number>, se: number | ArrayLike<number>, options: PosteriorOptions = {}): NormalPosterior<number> | NormalPosterior<number[]> {
  options = readOptions<PosteriorOptions>(options, ["priorMean", "priorSd"], "normalPosterior");
  const m = checkFinite(options?.priorMean ?? 0, "priorMean");
  const sigma = options?.priorSd ?? 0.15;
  if (typeof sigma !== "number" || !(sigma > 0)) throw new RangeError("priorSd must be > 0 (Infinity for a flat prior)");
  const scalar = typeof est === "number" && typeof se === "number";
  const n = typeof est === "number" ? (typeof se === "number" ? 1 : se.length) : est.length;
  const y = readOrRecycle(est, n, "est");
  const s = readOrRecycle(se, n, "se");
  checkSds(s, "se");
  const v2 = sigma * sigma;
  const shrink = s.map((x) => (sigma === Number.POSITIVE_INFINITY ? 1 : v2 / (v2 + x * x)));
  const mean = y.map((x, i) => m + shrink[i] * (x - m));
  const sd = s.map((x, i) => Math.sqrt(shrink[i]) * x);
  return scalar ? { mean: mean[0], sd: sd[0], shrink: shrink[0] } : { mean, sd, shrink };
}

/** Central normal interval mean ± Φ⁻¹((1 + level)/2)·sd; numbers or arrays (a number is recycled). */
export function normalInterval(mean: number | ArrayLike<number>, sd: number | ArrayLike<number>, level: number): { lower: number; upper: number } | { lower: number[]; upper: number[] } {
  if (typeof level !== "number" || !(level > 0 && level < 1)) throw new RangeError("level must lie in (0, 1)");
  const z = normalQuantile((1 + level) / 2);
  const scalar = typeof mean === "number" && typeof sd === "number";
  const n = typeof mean === "number" ? (typeof sd === "number" ? 1 : sd.length) : mean.length;
  const m = readOrRecycle(mean, n, "mean");
  const s = readOrRecycle(sd, n, "sd");
  checkSds(s, "sd");
  const lower = m.map((x, i) => x - z * s[i]);
  const upper = m.map((x, i) => x + z * s[i]);
  return scalar ? { lower: lower[0], upper: upper[0] } : { lower, upper };
}

/**
 * Closed-form expected number of pairs whose order disagrees with the true order θ (fixed), for the estimate
 * order (θ̂_i ~ N(θ_i, SE_i²) independent): Σ_{i<j} Φ(−|θ_i − θ_j|/√(SE_i² + SE_j²)); with `priorSd`, for the
 * posterior-mean order m + B_i(θ̂_i − m): Σ_{i<j} Φ(−t_ij·(B_i(θ_i − m) − B_j(θ_j − m))/√(B_i²SE_i² + B_j²SE_j²)),
 * t_ij = sign(θ_i − θ_j). A pair with equal true values counts 1 (any strict estimate order disagrees with it).
 */
export function expectedMisorderedPairs(theta: ArrayLike<number>, se: ArrayLike<number> | number, options: MisorderOptions = {}): number {
  options = readOptions<MisorderOptions>(options, ["priorSd", "priorMean"], "expectedMisorderedPairs");
  const t = readVector(theta, "theta");
  const n = t.length;
  const s = readOrRecycle(se, n, "se");
  checkSds(s, "se");
  const sigma = options?.priorSd ?? null;
  const m = checkFinite(options?.priorMean ?? 0, "priorMean");
  let B: number[];
  if (sigma === null) B = new Array<number>(n).fill(1);
  else {
    if (typeof sigma !== "number" || !(sigma > 0)) throw new RangeError("priorSd must be > 0 (or null for the estimate order)");
    B = s.map((x) => (sigma === Number.POSITIVE_INFINITY ? 1 : (sigma * sigma) / (sigma * sigma + x * x)));
  }
  const acc = new Accumulator();
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const sign = Math.sign(t[i] - t[j]);
      if (sign === 0) {
        acc.add(1);
        continue;
      }
      const sd = Math.hypot(B[i] * s[i], B[j] * s[j]);
      const diff = sigma === null ? Math.abs(t[i] - t[j]) : sign * (B[i] * (t[i] - m) - B[j] * (t[j] - m));
      if (sd === 0) acc.add(diff > 0 ? 0 : 1);
      else acc.add(normalCdf(-diff / sd));
    }
  }
  return acc.value;
}

/** Pairs i < j that two scores order differently: sign(a_i − a_j) ≠ sign(b_i − b_j) (a tie in one only counts). */
export function misorderedPairs(a: ArrayLike<number>, b: ArrayLike<number>): PairList {
  const x = readVector(a, "a");
  const y = readVector(b, "b");
  if (x.length !== y.length) throw new RangeError("a and b must have the same length");
  const pairs: { i: number; j: number }[] = [];
  for (let i = 0; i < x.length; i += 1) {
    for (let j = i + 1; j < x.length; j += 1) if (Math.sign(x[i] - x[j]) !== Math.sign(y[i] - y[j])) pairs.push({ i, j });
  }
  return { count: pairs.length, pairs };
}

/** Units in both top-k sets (the k largest of each score; equal scores in index order, as strictOrder). */
export function topKOverlap(a: ArrayLike<number>, b: ArrayLike<number>, k: number): TopKOverlap {
  const x = readVector(a, "a");
  const y = readVector(b, "b");
  if (x.length !== y.length) throw new RangeError("a and b must have the same length");
  checkCount(k, "k");
  if (k > x.length) throw new RangeError(`k must be at most ${x.length}`);
  const top = new Set(descending(x).slice(0, k));
  const members = descending(y)
    .slice(0, k)
    .filter((u) => top.has(u))
    .sort((p, q) => p - q);
  return { count: members.length, members };
}

/**
 * Per group, the number of units among the k largest scores (top), the k smallest (bottom) and both (total);
 * equal scores in index order. Keys are the group names in order of first appearance; absent groups count 0.
 */
export function extremeCounts(score: ArrayLike<number>, group: ArrayLike<string>, k: number): ExtremeCounts {
  const x = readVector(score, "score");
  const n = x.length;
  if (group == null || group.length !== n || !Array.from(group).every((g) => typeof g === "string")) {
    throw new RangeError(`group must hold ${n} group names`);
  }
  checkCount(k, "k");
  if (k > n) throw new RangeError(`k must be at most ${n}`);
  const names = [...new Set(Array.from(group))];
  const zero = (): Record<string, number> => Object.fromEntries(names.map((g) => [g, 0]));
  const top = zero();
  const bottom = zero();
  const order = descending(x);
  for (const u of order.slice(0, k)) top[group[u]] += 1;
  for (const u of order.slice(n - k)) bottom[group[u]] += 1;
  const total = Object.fromEntries(names.map((g) => [g, top[g] + bottom[g]]));
  return { k, top, bottom, total };
}

/**
 * The SR-06 league's replays: for r = 1..R the draw drawLeague(seed + r), with the units of each size group among
 * the 2k extreme positions by estimate (extremeCounts), the overlap of the top `topK` by estimate with the true
 * top `topK` (topKOverlap) and the pairs ordered against the true values (misorderedPairs), and the averages of
 * these counts over the R replays (L-03). The first draw (seed itself) is not a replay.
 */
export function leagueReplays(seed: number = LEAGUE_SEED, options: LeagueReplayOptions = {}): LeagueReplays {
  options = readOptions<LeagueReplayOptions>(options, ["replays", "k", "topK"], "leagueReplays");
  if (!Number.isSafeInteger(seed)) throw new RangeError("seed must be an integer");
  const R = checkCount(options.replays ?? 20, "replays", 1);
  const k = checkCount(options.k ?? 5, "k");
  const topK = checkCount(options.topK ?? 10, "topK");
  const L = league30();
  const names = [...new Set(L.group)];
  const draws: LeagueReplayDraw[] = [];
  for (let r = 1; r <= R; r += 1) {
    const { estimate } = drawLeague(seed + r);
    draws.push({
      r, seed: seed + r, estimate,
      extreme: extremeCounts(estimate, L.group, k),
      topOverlap: topKOverlap(estimate, L.theta, topK).count,
      misordered: misorderedPairs(estimate, L.theta).count,
    });
  }
  const avg = (f: (d: LeagueReplayDraw) => number): number => {
    let sum = 0;
    for (const d of draws) sum += f(d);
    return sum / R;
  };
  return {
    seed, replays: R, k, topK, seeds: draws.map((d) => d.seed), draws,
    mean: {
      extreme: Object.fromEntries(names.map((g) => [g, avg((d) => d.extreme.total[g])])),
      topOverlap: avg((d) => d.topOverlap),
      misordered: avg((d) => d.misordered),
    },
  };
}

/**
 * S seeded draws of a finite law's state index (0-based): u = uniforms(seed, S), cumulative sums c_k = c_{k−1} + p_k
 * (left to right, c_0 = p_0), and draw s is the smallest k with u_s < c_k (strict); when no k qualifies (u_s ≥ the
 * last sum, possible only when the probabilities sum short of 1) it is the last index K − 1. `probs` are finite
 * numbers in [0, 1] in state order and are not normalized (their sum is not checked); S = 0 gives an empty array.
 */
export function finiteLawDraws(probs: ArrayLike<number>, S: number, seed: number): Int32Array {
  const p = readVector(probs, "probs");
  if (!p.every((x) => x >= 0 && x <= 1)) throw new RangeError("probs must lie in [0, 1]");
  checkCount(S, "S");
  if (!Number.isSafeInteger(seed)) throw new RangeError("seed must be an integer");
  const K = p.length;
  const cum = new Float64Array(K);
  cum[0] = p[0];
  for (let k = 1; k < K; k += 1) cum[k] = cum[k - 1] + p[k];
  const u = uniforms(seed, S);
  const out = new Int32Array(S);
  for (let s = 0; s < S; s += 1) {
    let k = 0;
    while (k < K && !(u[s] < cum[k])) k += 1;
    out[s] = k < K ? k : K - 1;
  }
  return out;
}

/**
 * Exact rank summaries of a finite law { states[s][i], probs } (probs null = equal weights): E[θ_i], expected
 * rank, Pr(R_i = r) and Pr(R_i ≤ k) with R_i = 1 + #{j : θ_j > θ_i} (ch. 5). Under a tie-free law the expected
 * rank equals 1 + Σ_j e_ij (postrank_expected_rank); with ties this rank is the best shared position.
 */
export function rankSummaries(law: FiniteLaw): RankSummaries {
  if (law == null || typeof law !== "object") throw new RangeError("law must be { states, probs }");
  const d = readDraws(law.states, "law.states");
  if (d.K !== 1) throw new RangeError("rankSummaries takes one value per unit");
  const { S, n, v } = d;
  let p: number[] | null = null;
  if (law.probs != null) {
    const probs = readVector(law.probs, "law.probs");
    if (probs.length !== S) throw new RangeError(`law.probs must have one value per state (${S})`);
    const acc = new Accumulator();
    for (const x of probs) {
      if (x < 0) throw new RangeError("law.probs must be ≥ 0");
      acc.add(x);
    }
    if (Math.abs(acc.value - 1) > 1e-12) throw new RangeError("law.probs must sum to 1 (within 1e-12); they are not normalized");
    p = probs;
  }
  return summarize(S, n, v, p);
}

function summarize(S: number, n: number, v: Float64Array, p: number[] | null): RankSummaries {
  const R = new Int32Array(n);
  let tieFree = true;
  if (p === null) {
    const count = Array.from({ length: n }, () => new Float64Array(n)); // count[r][i]
    const sums = Array.from({ length: n }, () => new Accumulator());
    const rankSum = new Float64Array(n);
    for (let s = 0; s < S; s += 1) {
      const x = v.subarray(s * n, s * n + n);
      if (!ranksOf(x, n, R)) tieFree = false;
      for (let i = 0; i < n; i += 1) {
        count[R[i] - 1][i] += 1;
        rankSum[i] += R[i];
        sums[i].add(x[i]);
      }
    }
    const rankProbs = count.map((row) => Array.from(row, (c) => c / S));
    const pTop: number[][] = [];
    const cum = new Float64Array(n);
    for (let k = 0; k < n; k += 1) {
      for (let i = 0; i < n; i += 1) cum[i] += count[k][i];
      pTop.push(Array.from(cum, (c) => c / S));
    }
    return { n, means: sums.map((a) => a.value / S), expectedRank: Array.from(rankSum, (r) => r / S), rankProbs, pTop, tieFree };
  }
  const mass = Array.from({ length: n }, () => Array.from({ length: n }, () => new Accumulator())); // mass[r][i]
  const top = Array.from({ length: n }, () => Array.from({ length: n }, () => new Accumulator())); // top[k][i]
  const means = Array.from({ length: n }, () => new Accumulator());
  const er = Array.from({ length: n }, () => new Accumulator());
  for (let s = 0; s < S; s += 1) {
    const x = v.subarray(s * n, s * n + n);
    if (!ranksOf(x, n, R)) tieFree = false;
    const ps = p[s];
    for (let i = 0; i < n; i += 1) {
      mass[R[i] - 1][i].add(ps);
      for (let k = R[i] - 1; k < n; k += 1) top[k][i].add(ps);
      means[i].add(ps * x[i]);
      er[i].add(ps * R[i]);
    }
  }
  return {
    n,
    means: means.map((a) => a.value),
    expectedRank: er.map((a) => a.value),
    rankProbs: mass.map((row) => row.map((a) => a.value)),
    pTop: top.map((row) => row.map((a) => a.value)),
    tieFree,
  };
}

/**
 * Monte Carlo rank summaries from S seeded draws of independent normals N(means_i, sds_i²)
 * (gaussianDraws with K = 1; "Monte Carlo, S draws, seed shown"): sample means, mean ranks, Pr(R_i = r) and
 * Pr(R_i ≤ k) as exact shares of the draws.
 */
export function rankSummariesMC(means: ArrayLike<number>, sds: ArrayLike<number> | number, S: number, seed: number): RankSummariesMC {
  const m = readVector(means, "means");
  const n = m.length;
  const s = readOrRecycle(sds, n, "sds");
  checkSds(s, "sds");
  checkCount(S, "S", 1);
  const z = normals(seed, S * n);
  const v = new Float64Array(S * n);
  for (let q = 0; q < S * n; q += 1) v[q] = m[q % n] + s[q % n] * z[q];
  return { ...summarize(S, n, v, null), S, seed, label: "monte-carlo" };
}

/**
 * KRW Example 1 (independent N(ω_i, 1), ω_1 = 2, ω_3 = 0): the open ω₂ interval (2 − √2 z, √2 z),
 * z = Φ⁻¹(1 − τ), on which the pairwise rule withholds 1–2 and 2–3 while stating 1 above 3. Empty when the
 * interval is empty (τ ≥ about .2398) or when the rule would not state 1 above 3 (π_13 < 1 − τ, τ below about
 * .0786).
 */
export function krwExample1Band(tau: number): KrwBand {
  checkTau(tau);
  const z = normalQuantile(tau, { lowerTail: false });
  const lower = 2 - Math.SQRT2 * z;
  const upper = Math.SQRT2 * z;
  const pi13 = normalCdf(Math.SQRT2);
  const states13 = normalSf(Math.SQRT2) <= tau;
  const empty = !states13 || !(lower < upper);
  return { tau, empty, lower: empty ? null : lower, upper: empty ? null : upper, pi13, states13 };
}

/**
 * S seeded IID draws from independent normals: theta[s][i][k] = means[i][k] + sds[i][k]·z[(s·n + i)·K + k] with
 * z = normals(seed, S·n·K). `means` is n × K (or an n-vector when K = 1); `sds` the same shape or one number.
 */
export function gaussianDraws(means: UnitTable, sds: UnitTable | number, S: number, seed: number): number[][][] {
  const m = readTable(means, "means");
  const { n, K } = m;
  let sd: Float64Array;
  if (typeof sds === "number") sd = new Float64Array(n * K).fill(checkFinite(sds, "sds"));
  else {
    const t = readTable(sds, "sds");
    if (t.n !== n || t.K !== K) throw new RangeError(`sds must be ${n} units × ${K} criteria, as means`);
    sd = t.v;
  }
  if (!sd.every((x) => x >= 0)) throw new RangeError("sds must be ≥ 0");
  checkCount(S, "S", 1);
  const z = normals(seed, S * n * K);
  const out: number[][][] = new Array(S);
  for (let s = 0; s < S; s += 1) {
    const draw: number[][] = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const row = new Array<number>(K);
      for (let k = 0; k < K; k += 1) row[k] = m.v[i * K + k] + sd[i * K + k] * z[(s * n + i) * K + k];
      draw[i] = row;
    }
    out[s] = draw;
  }
  return out;
}

/** IID Monte Carlo standard error of a trace: sample SD (divisor S − 1) over √S; null for fewer than two draws. */
export function mcse(trace: ArrayLike<number>): number | null {
  if (trace == null || typeof trace !== "object" || typeof trace.length !== "number") throw new RangeError("trace must be an array of numbers");
  for (let s = 0; s < trace.length; s += 1) checkFinite(trace[s], "trace values");
  if (trace.length < 2) return null;
  return sampleSd(trace) / Math.sqrt(trace.length);
}

/**
 * IID envelope radius for M pairs, S draws and failure chance α: "package" √((log 2 + log M − log α)/(2S))
 * (postrank_iid_bounds(): tie-free, 2M events, one criterion at a time) or "book" √(log(4·M·K/α)/(2S)) (ch. 15
 * prp-iid-coefficient-envelope: equality permitted, 4MK events over all K criteria; `options.K`, default 1;
 * E-7). K does not enter the package form. Not capped at 1.
 */
export function envelopeRadius(M: number, S: number, alpha: number, form: "package" | "book" = "package", options: { K?: number } = {}): number {
  const o = readOptions<{ K?: number }>(options, ["K"], "envelopeRadius");
  if (typeof M !== "number" || !Number.isFinite(M) || !(M >= 1)) throw new RangeError("M must be ≥ 1");
  if (typeof S !== "number" || !Number.isFinite(S) || !(S > 0)) throw new RangeError("S must be > 0");
  if (typeof alpha !== "number" || !(alpha > 0 && alpha < 1)) throw new RangeError("alpha must lie in (0, 1)");
  if (form !== "package" && form !== "book") throw new RangeError('form must be "package" or "book"');
  const K = o.K ?? 1;
  if (!Number.isSafeInteger(K) || K < 1) throw new RangeError("K must be a positive integer (the number of criteria)");
  if (form === "package") return Math.sqrt((Math.log(2) + Math.log(M) - Math.log(alpha)) / (2 * S));
  return Math.sqrt(Math.log((4 * M * K) / alpha) / (2 * S));
}

/**
 * The package's Monte Carlo fragility screen (postrank_mc_fragility(), IID regime) on equal-weight joint draws
 * `draws[s][i][k]`: for each pair, d = min(ebar_ij, ebar_ji) with e from the draws (share with θ_i ≤ θ_j) and
 * ebar = Σ_k w_k e_k; pairs with |d − τ| below the screen margin are traced, and a traced pair is fragile when
 * |d − τ| < z·MCSE of its weighted indicator trace. Pairs are in the package's order (column-major upper
 * triangle). Descriptive only: grades are chosen jointly, so a fragile pair need not change the report.
 */
export function fragilePairs(draws: ArrayLike<UnitTable>, options: FragilityOptions): Fragility {
  options = readOptions<FragilityOptions>(options, ["tau", "w", "z", "screenMargin", "grade", "ids"], "fragilePairs", true);
  const { S, n, K, v } = readDraws(draws, "draws");
  if (n < 2) throw new RangeError("draws must hold at least two units");
  const tau = checkTau(options?.tau);
  const w = checkWeights(options?.w, K);
  const z = options?.z ?? 2;
  if (typeof z !== "number" || !Number.isFinite(z) || !(z > 0)) throw new RangeError("z must be a positive number");
  const screenMargin = options?.screenMargin ?? (z * 0.5) / Math.sqrt(Math.max(1, S - 1));
  if (typeof screenMargin !== "number" || !(screenMargin > 0)) throw new RangeError("screenMargin must be a positive number");
  const ids = options?.ids === undefined ? defaultIds(n) : Array.from(options.ids);
  if (ids.length !== n) throw new RangeError(`ids must hold ${n} strings`);
  const grade = options?.grade === undefined ? null : reportGrade(options.grade, n);
  // column layout col[(i·K + k)·S + s], so each pair count runs over contiguous draws
  const col = new Float64Array(S * n * K);
  for (let s = 0; s < S; s += 1) for (let q = 0; q < n * K; q += 1) col[q * S + s] = v[s * n * K + q];
  const column = (i: number, k: number) => col.subarray((i * K + k) * S, (i * K + k + 1) * S);
  // e[k][i][j] = count(θ_ik ≤ θ_jk)/S (colMeans of a logical matrix), then ebar = w_1 e_1 + w_2 e_2 + … (Reduce)
  const ebar = new Float64Array(n * n);
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const ci = column(i, k);
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const cj = column(j, k);
        let c = 0;
        for (let s = 0; s < S; s += 1) if (ci[s] <= cj[s]) c += 1;
        const term = w[k] * (c / S);
        ebar[i * n + j] = k === 0 ? term : ebar[i * n + j] + term;
      }
    }
  }
  const pairs: FragilePair[] = [];
  let total = 0;
  let traced = 0;
  let fragile = 0;
  let unavailable = 0;
  let fragileDisclosed = 0;
  let fragileTied = 0;
  const trace = new Float64Array(S);
  for (let j = 1; j < n; j += 1) {
    for (let i = 0; i < j; i += 1) {
      total += 1;
      const forward = ebar[i * n + j];
      const backward = ebar[j * n + i];
      const aheadI = forward <= backward;
      const d = aheadI ? forward : backward;
      const margin = Math.abs(d - tau);
      if (!(margin < screenMargin)) continue;
      traced += 1;
      const a = aheadI ? i : j;
      const b = aheadI ? j : i;
      trace.fill(0);
      for (let k = 0; k < K; k += 1) {
        const ca = column(a, k);
        const cb = column(b, k);
        for (let s = 0; s < S; s += 1) trace[s] = trace[s] + w[k] * (ca[s] <= cb[s] ? 1 : 0);
      }
      const se = S > 1 ? sampleSd(trace) / Math.sqrt(S) : null;
      const flag = se === null ? null : margin < z * se;
      if (se === null) unavailable += 1;
      const row: FragilePair = {
        i,
        j,
        idI: ids[i],
        idJ: ids[j],
        betterDirection: aheadI ? "i_ahead" : "j_ahead",
        weightedError: d,
        margin,
        disclosePreferred: d < tau,
        mcse: se,
        ratio: se === null ? null : margin / se,
        fragile: flag,
      };
      if (grade !== null) {
        const rel = grade[i] < grade[j] ? 1 : grade[i] > grade[j] ? -1 : 0;
        row.relationInGrade = rel === 0 ? "tied" : (rel === 1) === aheadI ? "disclosed_better_direction" : "disclosed_reverse";
        if (flag === true) {
          if (rel === 0) fragileTied += 1;
          else fragileDisclosed += 1;
        }
      }
      if (flag === true) fragile += 1;
      pairs.push(row);
    }
  }
  const none = traced > 0 && unavailable === traced;
  const summary: Fragility["summary"] = {
    pairs: total,
    traced,
    fragile: none ? null : fragile,
    fragileShare: none ? null : fragile / total,
    mcseUnavailable: unavailable,
  };
  if (grade !== null) {
    summary.fragileDisclosed = none ? null : fragileDisclosed;
    summary.fragileTied = none ? null : fragileTied;
  }
  return { S, n, K, tau, w, z, screenMargin, regime: "iid", mcseMethod: "iid_sample_sd_over_sqrt_S", pairs, summary, label: "monte-carlo" };
}

// ---------------------------------------------------------------------------------------------------------
// v3 helpers (Phase 2, Step 2.1; engine/API.md "v3 helpers")

export type OvershootSide = "top" | "bottom";

export interface OvershootOptions {
  /** how many units: an integer in 1..n */
  k: number;
  /** "top" (default): the first k of the estimate order; "bottom": the last k */
  side?: OvershootSide;
  /** posterior means (n finite numbers) for posteriorOvershoot; null or omitted: none */
  posterior?: ArrayLike<number> | null;
}

export interface TopKOvershoot {
  k: number;
  side: OvershootSide;
  /** the selected units in the estimate order (largest first, equal estimates in index order) */
  units: number[];
  /** (1/k) Σ_u (estimate[u] − truth[u]) over units, in listed order */
  overshoot: number;
  /** the same with posterior[u] in place of estimate[u]; null without posterior */
  posteriorOvershoot: number | null;
}

export interface LeagueOvershootOptions {
  /** replays R (an integer ≥ 1; default 20): replay r = 1..R uses drawLeague(seed + r) */
  replays?: number;
  /** units per draw, 1..30; default 3 */
  k?: number;
  side?: OvershootSide;
  /** teaching prior SD σ > 0 (prior mean 0); default .15; Infinity = flat prior (posterior mean = estimate) */
  priorSd?: number;
}

export interface LeagueOvershootDraw {
  r: number;
  seed: number;
  units: number[];
  overshoot: number;
  posteriorOvershoot: number;
}

export interface LeagueOvershoot {
  seed: number;
  replays: number;
  k: number;
  side: OvershootSide;
  priorSd: number;
  draws: LeagueOvershootDraw[];
  /** arithmetic means over the replays, in replay order */
  mean: { overshoot: number; posteriorOvershoot: number };
}

export interface ExpectedSquaredDistance {
  /** ((1 − B_i)(μ − θ_i))² + B_i²·SE_i² */
  perUnit: number[];
  /** (1/n) Σ_i perUnit_i */
  mean: number;
  /** (1/n) Σ_i SE_i²: the same expectation for the estimates themselves */
  rawMean: number;
}

export interface RegretBoundInput {
  /** pairs the report g discloses, an integer in 0..M */
  N: number;
  /** pairs the exact optimum g* discloses, an integer in 0..M */
  Nstar: number;
  /** pairs in all, a positive integer */
  M: number;
  /** δ_w = Σ_k w_k ε_k (weightedRadius), finite and ≥ 0 */
  deltaW: number;
  /** optimization slack η ≥ 0 (finite); default 0 */
  eta?: number;
}

export interface RegretBound {
  /** N·δ_w/M: the bound on |R̂(g) − R(g)| */
  evaluation: number;
  /** (N + N*)·δ_w/M + η */
  regret: number;
  /** 2δ_w + η */
  uniform: number;
}

export interface ChainOptions {
  /** Pr(0 → 1), in (0, 1] */
  p01: number;
  /** Pr(1 → 0), in (0, 1] */
  p10: number;
  /** chain length S, an integer ≥ 1 */
  S: number;
}

export interface TwoStateChainOptions extends ChainOptions {
  /** number of chains, an integer ≥ 1; default 1 */
  chains?: number;
  /** stream seed (a safe integer): uniforms(seed, chains·S), chain c using entries c·S … c·S + S − 1 */
  seed: number;
}

export interface TwoStateChain {
  p01: number;
  p10: number;
  S: number;
  seed: number;
  /** π₁ = p01/(p01 + p10), the stationary Pr(X = 1) */
  pi1: number;
  /** chains[c][b] = X_{b+1} of chain c (0 or 1) */
  chains: number[][];
}

export interface ChainMeanVariance {
  pi1: number;
  /** ρ = 1 − p01 − p10 */
  rho: number;
  /** Var of the mean of X_1..X_S started in stationarity: π₁(1 − π₁)/S² · {S + 2 Σ_{h=1}^{S−1} (S − h)ρ^h} */
  variance: number;
  /** π₁(1 − π₁)/S */
  iidVariance: number;
  /** π₁(1 − π₁)/variance (Infinity when the variance is 0: ρ = −1 and S even) */
  equivalentDraws: number;
  /** S(1 − ρ)/(1 + ρ); null when ρ = −1 */
  asymptoticEquivalent: number | null;
  /** (1 − π₁)(1 − p01)^(S−1) + π₁(1 − p10)^(S−1): the chance that all S states are equal */
  noSwitch: number;
}

export interface LeagueGradingOptions {
  /** replays R (an integer ≥ 1; default 20): replay r = 1..R uses drawLeague(seed + r) */
  replays?: number;
  /** teaching prior SD σ > 0 (prior mean 0); default .15 */
  priorSd?: number;
  /** withholding cost in (0, 1/2]; default .2 */
  tau?: number;
  /** at most this many grades, an integer in 1..30; default 3 */
  cap?: number;
}

export interface LeagueGradingDraw {
  r: number;
  seed: number;
  /** fixedOrderDP's report along the posterior-mean order (the package's choice among ties) */
  grade: Grade;
  N: number;
  /** self-reported E = Σ_{stated} e_ij under the teaching posterior (evaluateReport) */
  E: number;
  /** E/N; null when N = 0 */
  EoverN: number | null;
  /** realized wrong stated directions against league30().theta (realizedWrong) */
  D: number;
  /** D/N; null when N = 0 */
  DoverN: number | null;
  risk: number;
}

export interface LeagueGradingReplays {
  seed: number;
  replays: number;
  priorSd: number;
  tau: number;
  cap: number;
  draws: LeagueGradingDraw[];
  /** disclosedErrorEstimands over the replays' realized (A = D, N), equally weighted, M = 435 */
  estimands: DisclosedErrorEstimands;
}

export type MeanTransform = "identity" | "sqrt" | "log" | "exp";

export interface TransformOptions {
  /** f: θ, √θ (θ ≥ 0), log θ (θ > 0) or exp(kθ); default "identity" */
  transform?: MeanTransform;
  /** the exp(kθ) multiplier, finite and nonzero; default 1 */
  k?: number;
  /** the criterion of a finite law (an integer in range); default 0 */
  criterion?: number;
}

/** A finite law { states[s][i][k], probs } or independent normal posteriors { means, sds } (one criterion). */
export type TransformLaw =
  | { states: ArrayLike<UnitTable>; probs?: ArrayLike<number> | null }
  | { means: ArrayLike<number>; sds: ArrayLike<number> | number };

export interface TransformedMeans {
  /** means[i] = E f(θ_i) */
  means: number[];
  /** units by mean descending, equal means in index order */
  order: number[];
}

export interface SelectionOptions {
  /** withholding cost, 0 < τ ≤ 1/2 */
  tau: number;
  /** criterion weights; default [1] when K = 1 */
  w?: readonly number[];
  /** report family (enumerable); default { kind: "all" } */
  family?: Family;
}

export interface SelectionOnDraws {
  /** ĝ = exactOptimum(Ê, { tau, w, family }).grade, Ê = drawErrors(draws) */
  grade: Grade;
  /** N(ĝ) */
  N: number;
  /** R̂(ĝ): risk under Ê */
  inSample: number;
  /** R(ĝ): risk under E */
  exact: number;
  /** inSample − exact (either sign) */
  gap: number;
  /** epsilon[k] = max_{i≠j} |ê_ijk − e_ijk| */
  epsilon: number[];
  /** Σ_k w_k·epsilon[k] */
  deltaW: number;
  /** N(ĝ)·deltaW/M (|gap| ≤ bound) */
  bound: number;
  /** the risk of exactOptimum(E, { tau, w, family }) */
  best: number;
  /** exact − best */
  regret: number;
  /** (N(ĝ) + N(g*))·deltaW/M */
  regretBound: number;
}

function readSeed(x: unknown, fn: string): number {
  if (typeof x !== "number" || !Number.isSafeInteger(x)) throw new RangeError(`${fn}: seed must be a safe integer, got ${String(x)}`);
  return x;
}

function readSide(x: unknown, fn: string): OvershootSide {
  const side = x ?? "top";
  if (side !== "top" && side !== "bottom") throw new RangeError(`${fn}: side must be "top" or "bottom", got ${String(side)}`);
  return side;
}

function readK(x: unknown, n: number, fn: string): number {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 1 || x > n) throw new RangeError(`${fn}: k must be an integer in 1..${n}, got ${String(x)}`);
  return x;
}

function readPriorSd(x: unknown, fn: string): number {
  const v = x ?? 0.15;
  if (typeof v !== "number" || !(v > 0)) throw new RangeError(`${fn}: priorSd must be > 0 (Infinity for a flat prior), got ${String(v)}`);
  return v;
}

function readTransitions(o: { p01?: unknown; p10?: unknown }, fn: string): { p01: number; p10: number } {
  for (const key of ["p01", "p10"] as const) {
    const x = o[key];
    if (typeof x !== "number" || !(x > 0 && x <= 1)) throw new RangeError(`${fn}: ${key} must lie in (0, 1], got ${String(x)}`);
  }
  return { p01: o.p01 as number, p10: o.p10 as number };
}

/**
 * The winner's curse for one draw: units ordered by estimate (largest first, equal estimates in index order, as
 * extremeCounts); `units` are the first k ("top") or the last k ("bottom", in that order), and overshoot =
 * (1/k) Σ_u (estimate[u] − truth[u]) over them; posteriorOvershoot is the same with posterior[u] (null without it).
 */
export function topKOvershoot(estimate: ArrayLike<number>, truth: ArrayLike<number>, options: OvershootOptions): TopKOvershoot {
  const o = readOptions<OvershootOptions>(options, ["k", "side", "posterior"], "topKOvershoot", true);
  const y = readVector(estimate, "estimate");
  const n = y.length;
  const t = readVector(truth, "truth");
  if (t.length !== n) throw new RangeError(`topKOvershoot: truth must have ${n} values, as estimate`);
  let post: number[] | null = null;
  if (o.posterior !== undefined && o.posterior !== null) {
    post = readVector(o.posterior, "posterior");
    if (post.length !== n) throw new RangeError(`topKOvershoot: posterior must have ${n} values, as estimate`);
  }
  const k = readK(o.k, n, "topKOvershoot");
  const side = readSide(o.side, "topKOvershoot");
  const order = descending(y);
  const units = side === "top" ? order.slice(0, k) : order.slice(n - k);
  const over = (x: readonly number[]): number => {
    let s = 0;
    for (const u of units) s += x[u] - t[u];
    return s / k;
  };
  return { k, side, units, overshoot: over(y), posteriorOvershoot: post === null ? null : over(post) };
}

/**
 * The winner's curse over league replays: replay r = 1..R draws drawLeague(seed + r) (as leagueReplays), takes the
 * teaching posterior normalPosterior(estimate, league30().se, { priorSd }) (prior mean 0) and the truth
 * league30().theta, and records topKOvershoot; `mean` averages overshoot and posteriorOvershoot over the replays.
 */
export function leagueOvershoot(seed: number = LEAGUE_SEED, options: LeagueOvershootOptions = {}): LeagueOvershoot {
  const o = readOptions<LeagueOvershootOptions>(options, ["replays", "k", "side", "priorSd"], "leagueOvershoot");
  readSeed(seed, "leagueOvershoot");
  const R = checkCount(o.replays ?? 20, "replays", 1);
  const k = readK(o.k ?? 3, 30, "leagueOvershoot");
  const side = readSide(o.side, "leagueOvershoot");
  const priorSd = readPriorSd(o.priorSd, "leagueOvershoot");
  const L = league30();
  const draws: LeagueOvershootDraw[] = [];
  let sumOver = 0;
  let sumPost = 0;
  for (let r = 1; r <= R; r += 1) {
    const { estimate } = drawLeague(seed + r);
    const post = normalPosterior(estimate, L.se, { priorSd }) as NormalPosterior<number[]>;
    const x = topKOvershoot(estimate, L.theta, { k, side, posterior: post.mean });
    const posteriorOvershoot = x.posteriorOvershoot as number;
    draws.push({ r, seed: seed + r, units: x.units, overshoot: x.overshoot, posteriorOvershoot });
    sumOver += x.overshoot;
    sumPost += posteriorOvershoot;
  }
  return { seed, replays: R, k, side, priorSd, draws, mean: { overshoot: sumOver / R, posteriorOvershoot: sumPost / R } };
}

/**
 * The closed-form expected squared distance from the teaching posterior mean m_i = μ + B_i(est_i − μ) to a fixed
 * θ_i over the estimate noise est_i = θ_i + SE_i z_i (B_i = σ²/(σ² + SE_i²), 1 when σ = ∞):
 * perUnit_i = ((1 − B_i)(μ − θ_i))² + B_i²SE_i², mean = (1/n) Σ_i perUnit_i, rawMean = (1/n) Σ_i SE_i².
 */
export function expectedSquaredDistance(theta: ArrayLike<number>, se: ArrayLike<number> | number, options: PosteriorOptions = {}): ExpectedSquaredDistance {
  const o = readOptions<PosteriorOptions>(options, ["priorSd", "priorMean"], "expectedSquaredDistance");
  const t = readVector(theta, "theta");
  const n = t.length;
  const s = readOrRecycle(se, n, "se");
  checkSds(s, "se");
  const priorSd = readPriorSd(o.priorSd, "expectedSquaredDistance");
  const mu = checkFinite(o.priorMean ?? 0, "priorMean");
  const B = (normalPosterior(t, s, { priorSd, priorMean: mu }) as NormalPosterior<number[]>).shrink;
  const perUnit = t.map((th, i) => {
    const bias = (1 - B[i]) * (mu - th);
    return bias * bias + B[i] * B[i] * (s[i] * s[i]);
  });
  let sum = 0;
  for (const x of perUnit) sum += x;
  let raw = 0;
  for (const x of s) raw += x * x;
  return { perUnit, mean: sum / n, rawMean: raw / n };
}

/** δ_w = Σ_k w_k ε_k summed in criterion order: eps nonnegative finite, one per criterion; w weights of that length
 *  (default [1] for one criterion). */
export function weightedRadius(eps: ArrayLike<number>, w?: readonly number[]): number {
  const e = readVector(eps, "eps");
  if (!e.every((x) => x >= 0)) throw new RangeError("weightedRadius: eps must be ≥ 0");
  const ww = checkWeights(w, e.length);
  let s = 0;
  for (let k = 0; k < e.length; k += 1) s += ww[k] * e[k];
  return s;
}

/**
 * Bounds of ch. 15 ("Coefficient perturbation and regret on a common domain") on the event that every
 * coefficient error on criterion k is at most ε_k (δ_w = weightedRadius(ε, w)): evaluation = N·δ_w/M (the bound
 * on |R̂(g) − R(g)| for a report disclosing N), regret = (N + Nstar)·δ_w/M + η (g against the exact optimum
 * disclosing Nstar, η the optimization slack) and uniform = 2δ_w + η.
 */
export function regretBound(input: RegretBoundInput): RegretBound {
  const o = readOptions<RegretBoundInput>(input, ["N", "Nstar", "M", "deltaW", "eta"], "regretBound", true);
  const M = o.M;
  if (typeof M !== "number" || !Number.isSafeInteger(M) || M < 1) throw new RangeError(`regretBound: M must be a positive integer, got ${String(M)}`);
  for (const key of ["N", "Nstar"] as const) {
    const x = o[key];
    if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0 || x > M) throw new RangeError(`regretBound: ${key} must be an integer in 0..${M}, got ${String(x)}`);
  }
  const eta = o.eta ?? 0;
  for (const [key, x] of [["deltaW", o.deltaW], ["eta", eta]] as const) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError(`regretBound: ${key} must be a finite number ≥ 0, got ${String(x)}`);
  }
  const { N, Nstar, deltaW } = o;
  return { evaluation: (N * deltaW) / M, regret: ((N + Nstar) * deltaW) / M + eta, uniform: 2 * deltaW + eta };
}

/**
 * Seeded stationary two-state chains X_1..X_S ∈ {0, 1}: X_1 = 1 when u < π₁ = p01/(p01 + p10); from state 0 the
 * chain moves to 1 when u < p01, from state 1 to 0 when u < p10 (strict). u = uniforms(seed, chains·S), chain c
 * using entries c·S … c·S + S − 1 in order (the first for X_1).
 */
export function twoStateChain(options: TwoStateChainOptions): TwoStateChain {
  const o = readOptions<TwoStateChainOptions>(options, ["p01", "p10", "S", "chains", "seed"], "twoStateChain", true);
  const { p01, p10 } = readTransitions(o, "twoStateChain");
  const S = checkCount(o.S, "S", 1);
  const C = checkCount(o.chains ?? 1, "chains", 1);
  const seed = readSeed(o.seed, "twoStateChain");
  const pi1 = p01 / (p01 + p10);
  const u = uniforms(seed, C * S);
  const chains: number[][] = [];
  for (let c = 0; c < C; c += 1) {
    const x = new Array<number>(S);
    let state = u[c * S] < pi1 ? 1 : 0;
    x[0] = state;
    for (let b = 1; b < S; b += 1) {
      const v = u[c * S + b];
      if (state === 0) state = v < p01 ? 1 : 0;
      else state = v < p10 ? 0 : 1;
      x[b] = state;
    }
    chains.push(x);
  }
  return { p01, p10, S, seed, pi1, chains };
}

/**
 * The exact variance of the mean of a stationary two-state chain (ch. 15, "Finite-sample coefficient error in a
 * stationary two-state chain"): ρ = 1 − p01 − p10, Cov(X_b, X_{b+h}) = π₁(1 − π₁)ρ^h, variance = π₁(1 − π₁)/S² ·
 * {S + 2 Σ_{h=1}^{S−1} (S − h)ρ^h} (summed for h = 1, 2, …), the IID variance π₁(1 − π₁)/S, the equivalent
 * number of IID draws π₁(1 − π₁)/variance, its large-S form S(1 − ρ)/(1 + ρ) (null when ρ = −1) and the chance
 * that the chain never switches.
 */
export function chainMeanVariance(options: ChainOptions): ChainMeanVariance {
  const o = readOptions<ChainOptions>(options, ["p01", "p10", "S"], "chainMeanVariance", true);
  const { p01, p10 } = readTransitions(o, "chainMeanVariance");
  const S = checkCount(o.S, "S", 1);
  const rho = 1 - p01 - p10;
  const pi1 = p01 / (p01 + p10);
  const q = pi1 * (1 - pi1);
  let sum = 0;
  for (let h = 1; h <= S - 1; h += 1) {
    const r = Math.pow(rho, h);
    if (r === 0) break; // |ρ| < 1 and ρ^h underflowed: every later term is 0 too
    sum += (S - h) * r;
  }
  const variance = (q / (S * S)) * (S + 2 * sum);
  return {
    pi1,
    rho,
    variance,
    iidVariance: q / S,
    equivalentDraws: q / variance,
    asymptoticEquivalent: rho === -1 ? null : (S * (1 - rho)) / (1 + rho),
    noSwitch: (1 - pi1) * Math.pow(1 - p01, S - 1) + pi1 * Math.pow(1 - p10, S - 1),
  };
}

/**
 * Graded league replays: replay r = 1..R draws drawLeague(seed + r), forms the teaching posterior (prior SD
 * `priorSd`, mean 0) and its errorArray (one criterion, larger is higher), grades with fixedOrderDP along the
 * posterior-mean order (descending, equal means in index order) with at most `cap` grades at `tau` (the package's
 * choice among ties), and records evaluateReport's E, N, E/N and risk and realizedWrong's D, D/N against
 * league30().theta. `estimands` = disclosedErrorEstimands over the realized (A = D, N), equally weighted, M = 435.
 */
export function leagueGradingReplays(seed: number = LEAGUE_SEED, options: LeagueGradingOptions = {}): LeagueGradingReplays {
  const o = readOptions<LeagueGradingOptions>(options, ["replays", "priorSd", "tau", "cap"], "leagueGradingReplays");
  readSeed(seed, "leagueGradingReplays");
  const R = checkCount(o.replays ?? 20, "replays", 1);
  const priorSd = readPriorSd(o.priorSd, "leagueGradingReplays");
  const tau = checkTau(o.tau ?? 0.2);
  const cap = o.cap ?? 3;
  if (typeof cap !== "number" || !Number.isSafeInteger(cap) || cap < 1 || cap > 30) {
    throw new RangeError(`leagueGradingReplays: cap must be an integer in 1..30, got ${String(cap)}`);
  }
  const L = league30();
  const draws: LeagueGradingDraw[] = [];
  for (let r = 1; r <= R; r += 1) {
    const { estimate } = drawLeague(seed + r);
    const post = normalPosterior(estimate, L.se, { priorSd }) as NormalPosterior<number[]>;
    const E = errorArray(post.mean, post.sd);
    // the posterior-mean order (descending, equal means in index order): strictOrder's positions, inverted
    const order = new Array<number>(L.ids.length);
    strictOrder(post.mean).forEach((p, u) => (order[p - 1] = u));
    const dp = fixedOrderDP(E, { order, tau, G: cap });
    if (dp.empty) throw new RangeError("leagueGradingReplays: the order family is empty");
    const grade = dp.grade;
    const ev = evaluateReport(grade, E, { tau });
    const rw = realizedWrong(grade, L.theta);
    draws.push({ r, seed: seed + r, grade, N: ev.N, E: ev.E[0], EoverN: ev.EoverN[0], D: rw.D[0], DoverN: rw.DoverN[0], risk: ev.risk });
  }
  const estimands = disclosedErrorEstimands(
    draws.map((d) => ({ A: d.D, N: d.N })),
    { M: pairCount(L.ids.length) },
  );
  return { seed, replays: R, priorSd, tau, cap, draws, estimands };
}

/**
 * Posterior means of a transformed target f(θ): θ ("identity"), √θ ("sqrt", θ ≥ 0), log θ ("log", θ > 0) or
 * exp(kθ) ("exp"). A finite law { states, probs } (as finiteLawPairwise; probs null = equal weights) gives
 * means[i] = Σ_s probs[s]·f(states[s][i][criterion]) summed in state order; independent normal posteriors
 * { means, sds } (one criterion) take "identity" (the means) or "exp" (the lognormal mean exp(k·m + k²s²/2)).
 * `order` lists the units by mean descending, equal means in index order. A value outside the transform's
 * support throws a RangeError naming the unit.
 */
export function transformedMeans(law: TransformLaw, options: TransformOptions = {}): TransformedMeans {
  const o = readOptions<TransformOptions>(options, ["transform", "k", "criterion"], "transformedMeans");
  const transform = o.transform ?? "identity";
  if (transform !== "identity" && transform !== "sqrt" && transform !== "log" && transform !== "exp") {
    throw new RangeError(`transformedMeans: transform must be "identity", "sqrt", "log" or "exp", got ${String(transform)}`);
  }
  const k = o.k ?? 1;
  if (typeof k !== "number" || !Number.isFinite(k) || k === 0) throw new RangeError(`transformedMeans: k must be a finite nonzero number, got ${String(k)}`);
  const criterion = o.criterion ?? 0;
  if (typeof criterion !== "number" || !Number.isSafeInteger(criterion) || criterion < 0) {
    throw new RangeError(`transformedMeans: criterion must be a criterion index (an integer ≥ 0), got ${String(criterion)}`);
  }
  if (law == null || typeof law !== "object" || Array.isArray(law)) {
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  }
  let means: number[];
  if ("states" in law) {
    checkKeys(law, ["states", "probs"], "transformedMeans: law { states, probs }");
    const F = readLaw(law.states, law.probs, "law.states");
    if (criterion >= F.K) throw new RangeError(`transformedMeans: criterion must be an integer in 0..${F.K - 1}, got ${criterion}`);
    const f = (x: number, i: number, s: number): number => {
      switch (transform) {
        case "sqrt":
          if (!(x >= 0)) throw new RangeError(`transformedMeans: "sqrt" needs θ ≥ 0, but unit ${i} is ${x} in state ${s}`);
          return Math.sqrt(x);
        case "log":
          if (!(x > 0)) throw new RangeError(`transformedMeans: "log" needs θ > 0, but unit ${i} is ${x} in state ${s}`);
          return Math.log(x);
        case "exp":
          return Math.exp(k * x);
        default:
          return x;
      }
    };
    means = new Array<number>(F.n);
    for (let i = 0; i < F.n; i += 1) {
      let sum = 0;
      for (let s = 0; s < F.S; s += 1) {
        const v = f(F.states[s][i * F.K + criterion], i, s);
        sum += F.p === null ? v : F.p[s] * v;
      }
      means[i] = F.p === null ? sum / F.S : sum;
    }
  } else if ("means" in law) {
    checkKeys(law, ["means", "sds"], "transformedMeans: law { means, sds }");
    const m = readVector(law.means, "law.means");
    const sd = readOrRecycle(law.sds, m.length, "law.sds");
    checkSds(sd, "law.sds");
    if (criterion !== 0) throw new RangeError(`transformedMeans: normal posteriors have one criterion (criterion 0), got ${criterion}`);
    if (transform === "identity") means = m.slice();
    else if (transform === "exp") means = m.map((mi, i) => Math.exp(k * mi + (k * k * (sd[i] * sd[i])) / 2));
    else throw new RangeError(`transformedMeans: normal posteriors take transform "identity" or "exp", not "${transform}"`);
  } else {
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  }
  const order = means.map((_, i) => i).sort((a, b) => (means[b] > means[a] ? 1 : means[b] < means[a] ? -1 : a - b));
  return { means, order };
}

/**
 * A report chosen on posterior draws and judged under the exact errors (ch. 15, "Coefficient perturbation and
 * regret on a common domain", "Uniform bounds for optimization using the same draws"): Ê = drawErrors(draws),
 * ĝ = exactOptimum(Ê, { tau, w, family }).grade, inSample = R̂(ĝ), exact = R(ĝ), gap = inSample − exact,
 * epsilon[k] = max_{i≠j} |ê_ijk − e_ijk| (maxCoefficientError), deltaW = weightedRadius(epsilon, w),
 * bound = N(ĝ)·deltaW/M, best = the risk of exactOptimum(E, { tau, w, family }), regret = exact − best,
 * regretBound = (N(ĝ) + N(g*))·deltaW/M.
 */
export function selectionOnDraws(draws: ArrayLike<UnitTable>, E: ErrorArray, options: SelectionOptions): SelectionOnDraws {
  const o = readOptions<SelectionOptions>(options, ["tau", "w", "family"], "selectionOnDraws", true);
  const { n, K } = errorCube(E);
  const Ehat = drawErrors(draws);
  if (Ehat.ids.length !== n || Ehat.e.length !== K) {
    throw new RangeError(`selectionOnDraws: draws must be S × ${n} units × ${K} criteria, as E (got ${Ehat.ids.length} × ${Ehat.e.length})`);
  }
  const settings = { tau: o.tau, w: o.w, family: o.family };
  const chosen = exactOptimum(Ehat, settings);
  if (chosen.empty) throw new RangeError(`selectionOnDraws: the family ${chosen.family.name} is empty`);
  const star = exactOptimum(E, settings);
  if (star.empty) throw new RangeError(`selectionOnDraws: the family ${star.family.name} is empty`);
  const w = checkWeights(o.w, K);
  const ghat = chosen.grade;
  const inSample = evaluateReport(ghat, Ehat, { tau: o.tau, w });
  const exact = evaluateReport(ghat, E, { tau: o.tau, w });
  const epsilon = maxCoefficientError(Ehat, E).epsilon;
  const deltaW = weightedRadius(epsilon, w);
  const bounds = regretBound({ N: exact.N, Nstar: star.N, M: exact.M, deltaW });
  return {
    grade: ghat,
    N: exact.N,
    inSample: inSample.risk,
    exact: exact.risk,
    gap: inSample.risk - exact.risk,
    epsilon,
    deltaW,
    bound: bounds.evaluation,
    best: star.risk,
    regret: exact.risk - star.risk,
    regretBound: bounds.regret,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Part 1 supplement (Step 3.27; engine/API.md "v3 helpers: Part 1 supplement")

export interface WithinBandOptions {
  /** the reference value r_i: one finite number, or one per unit (required) */
  ref: number | ArrayLike<number>;
  /** the band's half-width in SEs, finite and ≥ 0; default 1 */
  crit?: number;
}

export interface WithinBand {
  /** units with |z_i| ≤ crit, z_i = (est_i − ref_i)/se_i: the units evidenceFlags leaves unflagged */
  within: number;
  /** the number of estimates */
  n: number;
  /** normalCoverage(crit): the chance that one estimate lies within crit SEs of its mean */
  share: number;
  /** n·share */
  expected: number;
}

export interface SharedMeanOptions {
  /** σ, the SD of each θ_i around the shared mean μ: finite and > 0 (required) */
  priorSd: number;
  /** s_μ, the prior SD of μ: > 0; default Infinity (a flat prior on μ) */
  meanSd?: number;
  /** μ₀, the prior mean of μ (finite); default 0 */
  priorMean?: number;
}

export interface SharedMeanPosterior {
  /** B_i = σ²/v_i with v_i = σ² + se_i²: the weight on the unit's own estimate */
  weight: number[];
  /** E[μ | est] = muVar·(μ₀/s_μ² + Σ_i est_i/v_i) */
  muMean: number;
  /** Var[μ | est] = 1/(1/s_μ² + Σ_i 1/v_i) */
  muVar: number;
  /** E[θ_i | est] = (1 − B_i)·muMean + B_i·est_i */
  means: number[];
  /** √(σ²·se_i²/v_i + (1 − B_i)²·muVar) */
  sds: number[];
  /** corr[i][j] = (1 − B_i)(1 − B_j)·muVar/(sds_i·sds_j) for i ≠ j; 1 on the diagonal */
  corr: number[][];
}

export interface ChainCountOptions extends ChainOptions {
  /** a radius r (finite, ≥ 0) for `outside`; null or omitted: outside is null */
  radius?: number | null;
}

export interface ChainCountLaw {
  /** π₁ = p01/(p01 + p10) */
  pi1: number;
  /** probs[c] = Pr(C = c) for the count of ones C in S draws, c = 0..S */
  probs: number[];
  /** Pr(|C/S − π₁| > radius) (strict), summed in c order; null without a radius */
  outside: number | null;
}

/**
 * The units whose estimate lies within `crit` standard errors of the reference: z_i = (est_i − ref_i)/se_i (as in
 * evidenceFlags) and within = #{i : |z_i| ≤ crit} (the units evidenceFlags leaves unflagged), with share =
 * normalCoverage(crit) and the expected count n·share. `se` and `ref` are one number or one per unit.
 */
export function withinBand(est: ArrayLike<number>, se: ArrayLike<number> | number, options: WithinBandOptions): WithinBand {
  const o = readOptions<WithinBandOptions>(options, ["ref", "crit"], "withinBand", true);
  const y = readVector(est, "withinBand: est");
  const n = y.length;
  const s = readOrRecycle(se, n, "withinBand: se");
  if (!s.every((x) => x > 0)) throw new RangeError("withinBand: se must be > 0");
  if (o.ref === undefined || o.ref === null) throw new RangeError("withinBand: ref is required (one finite number, or one per unit)");
  const ref = readOrRecycle(o.ref, n, "withinBand: ref");
  const crit = o.crit ?? 1;
  if (typeof crit !== "number" || !Number.isFinite(crit) || crit < 0) throw new RangeError(`withinBand: crit must be a finite number ≥ 0, got ${String(crit)}`);
  let within = 0;
  for (let i = 0; i < n; i += 1) if (Math.abs((y[i] - ref[i]) / s[i]) <= crit) within += 1;
  const share = normalCoverage(crit);
  return { within, n, share, expected: n * share };
}

/**
 * The normal model with a shared, uncertain mean: est_i | θ_i ~ N(θ_i, se_i²), θ_i | μ ~ N(μ, σ²) independently,
 * μ ~ N(μ₀, s_μ²) (σ = priorSd, s_μ = meanSd, μ₀ = priorMean; meanSd = Infinity is a flat prior on μ). With
 * v_i = σ² + se_i² and B_i = σ²/v_i: muVar = 1/(1/s_μ² + Σ_i 1/v_i), muMean = muVar·(μ₀/s_μ² + Σ_i est_i/v_i)
 * (the s_μ terms are 0 when s_μ = ∞), means_i = (1 − B_i)·muMean + B_i·est_i, var_i = σ²·se_i²/v_i +
 * (1 − B_i)²·muVar, cov_ij = (1 − B_i)(1 − B_j)·muVar, corr_ij = cov_ij/(sds_i·sds_j). Sums in unit order (each
 * Σ_i is summed first, then the s_μ term is added).
 */
export function sharedMeanPosterior(est: ArrayLike<number>, se: ArrayLike<number> | number, options: SharedMeanOptions): SharedMeanPosterior {
  const o = readOptions<SharedMeanOptions>(options, ["priorSd", "meanSd", "priorMean"], "sharedMeanPosterior", true);
  const y = readVector(est, "sharedMeanPosterior: est");
  const n = y.length;
  const s = readOrRecycle(se, n, "sharedMeanPosterior: se");
  if (!s.every((x) => x > 0)) throw new RangeError("sharedMeanPosterior: se must be > 0");
  const sigma = o.priorSd;
  if (typeof sigma !== "number" || !Number.isFinite(sigma) || !(sigma > 0)) {
    throw new RangeError(`sharedMeanPosterior: priorSd must be a finite number > 0 (it is required), got ${String(sigma)}`);
  }
  const meanSd = o.meanSd ?? Number.POSITIVE_INFINITY;
  if (typeof meanSd !== "number" || !(meanSd > 0)) {
    throw new RangeError(`sharedMeanPosterior: meanSd must be > 0 (Infinity for a flat prior on the mean), got ${String(meanSd)}`);
  }
  const mu0 = o.priorMean ?? 0;
  if (typeof mu0 !== "number" || !Number.isFinite(mu0)) throw new RangeError(`sharedMeanPosterior: priorMean must be a finite number, got ${String(mu0)}`);
  const s2 = sigma * sigma;
  const v = s.map((x) => s2 + x * x);
  const weight = v.map((vi) => s2 / vi);
  let precision = 0;
  let pull = 0;
  for (let i = 0; i < n; i += 1) {
    precision += 1 / v[i];
    pull += y[i] / v[i];
  }
  const flat = meanSd === Number.POSITIVE_INFINITY;
  const m2 = meanSd * meanSd;
  const muVar = 1 / ((flat ? 0 : 1 / m2) + precision);
  const muMean = muVar * ((flat ? 0 : mu0 / m2) + pull);
  const means = y.map((x, i) => (1 - weight[i]) * muMean + weight[i] * x);
  const sds = s.map((x, i) => {
    const c = 1 - weight[i];
    return Math.sqrt((s2 * (x * x)) / v[i] + c * c * muVar);
  });
  const corr = y.map((_, i) =>
    y.map((__, j) => (i === j ? 1 : ((1 - weight[i]) * (1 - weight[j]) * muVar) / (sds[i] * sds[j]))),
  );
  return { weight, muMean, muVar, means, sds, corr };
}

/**
 * √(e·(1 − e)/S), evaluated as written: the Monte Carlo SE of a share with exact value e over S independent draws
 * (the register's "exact-e approximation"; the MCSE the apps report is mcse(trace)). e in [0, 1]; S an integer ≥ 1.
 */
export function binomialMcse(e: number, S: number): number {
  if (typeof e !== "number" || !(e >= 0 && e <= 1)) throw new RangeError(`binomialMcse: e must be a probability in [0, 1], got ${String(e)}`);
  if (typeof S !== "number" || !Number.isSafeInteger(S) || S < 1) throw new RangeError(`binomialMcse: S must be an integer ≥ 1, got ${String(S)}`);
  return Math.sqrt((e * (1 - e)) / S);
}

/**
 * The exact law of the count of ones C = Σ_b X_b in S draws of the stationary chain of twoStateChain (X_1 = 1 with
 * probability π₁ = p01/(p01 + p10)), by the forward recursion over (count c, current state x): f_1(x, x) = π_x
 * (π_0 = 1 − π₁), f_{t+1}(c + y, y) gains f_t(c, x)·P(x → y) with P(0 → 1) = p01, P(0 → 0) = 1 − p01,
 * P(1 → 0) = p10, P(1 → 1) = 1 − p10; probs[c] = f_S(c, 0) + f_S(c, 1). With `radius` r, outside = Σ probs[c] over
 * the c with |c/S − π₁| > r (strict), summed in c order: the exact chance that the chain mean misses π₁ by more
 * than r (null without a radius). p01, p10 in (0, 1]; S an integer in 1..5000; radius null or finite ≥ 0.
 */
export function chainCountLaw(options: ChainCountOptions): ChainCountLaw {
  const o = readOptions<ChainCountOptions>(options, ["p01", "p10", "S", "radius"], "chainCountLaw", true);
  const { p01, p10 } = readTransitions(o, "chainCountLaw");
  const S = o.S;
  if (typeof S !== "number" || !Number.isSafeInteger(S) || S < 1 || S > 5000) throw new RangeError(`chainCountLaw: S must be an integer in 1..5000, got ${String(S)}`);
  const radius = o.radius ?? null;
  if (radius !== null && (typeof radius !== "number" || !Number.isFinite(radius) || radius < 0)) {
    throw new RangeError(`chainCountLaw: radius must be null or a finite number ≥ 0, got ${String(radius)}`);
  }
  const pi1 = p01 / (p01 + p10);
  const stay0 = 1 - p01;
  const stay1 = 1 - p10;
  // f0[c] = f_t(c, 0) and f1[c] = f_t(c, 1). Each new cell receives exactly two gains (from x = 0 and x = 1 at the
  // same count), so the order of the gains does not change its value; the update runs from the top count down,
  // in place: f_{t+1}(c, 0) = f_t(c, 0)·(1 − p01) + f_t(c, 1)·p10, f_{t+1}(c + 1, 1) = f_t(c, 0)·p01 + f_t(c, 1)·(1 − p10).
  const f0 = new Float64Array(S + 1);
  const f1 = new Float64Array(S + 1);
  f0[0] = 1 - pi1;
  f1[1] = pi1;
  for (let t = 1; t < S; t += 1) {
    for (let c = t; c >= 0; c -= 1) {
      const a = f0[c];
      const b = f1[c];
      f1[c + 1] = a * p01 + b * stay1;
      f0[c] = a * stay0 + b * p10;
    }
    f1[0] = 0;
  }
  const probs = new Array<number>(S + 1);
  for (let c = 0; c <= S; c += 1) probs[c] = f0[c] + f1[c];
  let outside: number | null = null;
  if (radius !== null) {
    outside = 0;
    for (let c = 0; c <= S; c += 1) if (Math.abs(c / S - pi1) > radius) outside += probs[c];
  }
  return { pi1, probs, outside };
}

/** The running mean of a trace: m_b = (trace[0] + … + trace[b − 1], summed in order)/b for b = 1..S. The trace is
 *  a nonempty array of finite numbers. */
export function runningMean(trace: ArrayLike<number>): Float64Array {
  const x = readVector(trace, "runningMean: trace");
  const out = new Float64Array(x.length);
  let sum = 0;
  for (let b = 0; b < x.length; b += 1) {
    sum += x[b];
    out[b] = sum / (b + 1);
  }
  return out;
}
