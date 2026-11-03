// Descriptive summaries that Part 1 widgets show beside the posterior: sample mean and SD, the average squared
// distance between two vectors, the units whose posterior mean ends farther from the truth than its estimate,
// the interval-overlap tally of every pair, and central rank intervals read off a rank distribution function.
//
// Definitions (engine/API.md "summaries.ts"; Step 5.14). Every function is pure and checks its inputs.
//   summaryStats: n, mean and the sample SD with divisor n − 1, as R's mean() and sd() (sum/n with one correction
//     pass, then Σ(x − mean)²/(n − 1)); sd is null for n = 1.
//   meanSquaredDistance(a, b) = (1/n) Σ_i (a_i − b_i)² (compensated sum).
//   fartherCount: unit i ends farther when |m_i − θ_i| > |y_i − θ_i| (strict, so an equal distance is not farther).
//   intervalOverlapTally: for each pair i < j the intervals overlap when max(l_i, l_j) < min(u_i, u_j) (strict, so
//     intervals that only touch do not overlap); the pair's direction probability is p = max(π_ij, π_ji), its first
//     unit the one with the larger π (i on ties); an overlapping pair is "high" when p > threshold, else "low"; a
//     pair whose intervals do not overlap is "apart". `best` is the overlapping pair with the largest p (the first
//     such pair in the order (0, 1), (0, 2), …, (1, 2), … on ties), null when no pair overlaps. Each pair also has
//     amount = min(u_i, u_j) − max(l_i, l_j) (the overlap's length when positive, the gap when negative) and nested
//     (one interval inside the other, ends included; equal intervals are nested), counted in nestedCount (v3 Part 1
//     supplement, Step 3.27).
//   rankIntervals: with tail = (1 − level)/2, the best end of unit i is the smallest rank r with
//     F_i(r) ≥ tail − tieTol and the worst end the smallest r with F_i(r) ≥ 1 − tail − tieTol, where
//     F_i(r) = pTop[r − 1][i] = Pr(R_i ≤ r).

import { Accumulator } from "./pairwise.ts";
import { readOptions } from "./options.ts";

export interface SummaryStats {
  n: number;
  mean: number;
  /** sample SD with divisor n − 1; null when n = 1 */
  sd: number | null;
}

export interface FartherCount {
  count: number;
  /** flags[i] = |m_i − θ_i| > |y_i − θ_i| */
  flags: boolean[];
  /** the indices i with flags[i] true, in increasing order */
  units: number[];
}

export type OverlapClass = "apart" | "high" | "low";

export interface OverlapPair {
  i: number;
  j: number;
  /** the unit with the larger direction probability (i on ties) */
  first: number;
  second: number;
  /** π[first][second] = max(π_ij, π_ji) */
  pi: number;
  overlap: boolean;
  class: OverlapClass;
  /** min(upper_i, upper_j) − max(lower_i, lower_j): the length of the overlap when positive, the gap when negative */
  amount: number;
  /** (lower_i ≤ lower_j and upper_j ≤ upper_i) or (lower_j ≤ lower_i and upper_i ≤ upper_j); equal intervals are nested */
  nested: boolean;
}

export interface OverlapTally {
  n: number;
  M: number;
  threshold: number;
  /** pairs whose intervals do not overlap */
  apart: number;
  /** pairs whose intervals overlap (high + low) */
  overlapping: number;
  /** overlapping pairs with max(π_ij, π_ji) > threshold */
  high: number;
  /** overlapping pairs with max(π_ij, π_ji) ≤ threshold */
  low: number;
  /** one row per pair i < j, in the order (0, 1), (0, 2), …, (1, 2), … */
  pairs: OverlapPair[];
  /** the overlapping pair with the largest π[first][second]; null when no pair overlaps */
  best: { i: number; j: number; first: number; second: number; pi: number } | null;
  /** pairs whose intervals are nested */
  nestedCount: number;
}

export interface OverlapOptions {
  /** the direction probability that splits the overlapping pairs (default .9) */
  threshold?: number;
}

export interface RankIntervalOptions {
  /** central level in (0, 1) (default .9) */
  level?: number;
  /** slack for the cumulative comparisons (default 1e-12) */
  tieTol?: number;
}

export interface RankIntervals {
  level: number;
  /** (1 − level)/2 */
  tail: number;
  /** best (smallest) end per unit, a rank 1..R; null if F_i never reaches tail − tieTol */
  lower: (number | null)[];
  /** worst (largest) end per unit; null if F_i never reaches 1 − tail − tieTol */
  upper: (number | null)[];
}

// ---------------------------------------------------------------------------------------------------------
// Helpers

function readVector(x: ArrayLike<number>, name: string): number[] {
  if (x == null || typeof x !== "object" || typeof x.length !== "number" || x.length < 1) throw new RangeError(`${name} must be a nonempty array`);
  const out = Array.from(x);
  if (!out.every((v) => typeof v === "number" && Number.isFinite(v))) throw new RangeError(`${name} must be finite numbers`);
  return out;
}

function sameLength(n: number, ...pairs: [number[], string][]): void {
  for (const [v, name] of pairs) if (v.length !== n) throw new RangeError(`${name} must have ${n} values`);
}

/** R's mean(): sum/n, then one correction pass (Σ(x − mean))/n. */
function rMean(x: readonly number[]): number {
  const n = x.length;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += x[i];
  let mean = sum / n;
  if (Number.isFinite(mean)) {
    let c = 0;
    for (let i = 0; i < n; i += 1) c += x[i] - mean;
    mean += c / n;
  }
  return mean;
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/** n, mean and sample SD (divisor n − 1) of a nonempty vector, as R's mean() and sd(); sd is null for n = 1. */
export function summaryStats(values: ArrayLike<number>): SummaryStats {
  const x = readVector(values, "values");
  const n = x.length;
  const mean = rMean(x);
  if (n < 2) return { n, mean, sd: null };
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += (x[i] - mean) * (x[i] - mean);
  return { n, mean, sd: Math.sqrt(ss / (n - 1)) };
}

/** Average squared distance (1/n) Σ (a_i − b_i)² of two vectors of the same length. */
export function meanSquaredDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const x = readVector(a, "a");
  const y = readVector(b, "b");
  sameLength(x.length, [y, "b"]);
  const acc = new Accumulator();
  for (let i = 0; i < x.length; i += 1) acc.add((x[i] - y[i]) * (x[i] - y[i]));
  return acc.value / x.length;
}

/**
 * Units whose posterior mean m_i ends farther from the true value θ_i than its estimate y_i was:
 * |m_i − θ_i| > |y_i − θ_i| (strict).
 */
export function fartherCount(estimates: ArrayLike<number>, posteriorMeans: ArrayLike<number>, truth: ArrayLike<number>): FartherCount {
  const y = readVector(estimates, "estimates");
  const m = readVector(posteriorMeans, "posteriorMeans");
  const t = readVector(truth, "truth");
  sameLength(y.length, [m, "posteriorMeans"], [t, "truth"]);
  const flags = y.map((yi, i) => Math.abs(m[i] - t[i]) > Math.abs(yi - t[i]));
  const units = flags.flatMap((f, i) => (f ? [i] : []));
  return { count: units.length, flags, units };
}

/**
 * Sort every pair of units into intervals apart / overlapping with one direction above `threshold` / overlapping
 * and neither direction above it. `lower[i] ≤ upper[i]` are interval ends; `pi[i][j]` = Pr(θ_i > θ_j) for i ≠ j
 * (the diagonal is not read), as `directionMatrix` returns.
 */
export function intervalOverlapTally(lower: ArrayLike<number>, upper: ArrayLike<number>, pi: ArrayLike<ArrayLike<number>>, options: OverlapOptions = {}): OverlapTally {
  options = readOptions<OverlapOptions>(options, ["threshold"], "intervalOverlapTally");
  const l = readVector(lower, "lower");
  const u = readVector(upper, "upper");
  const n = l.length;
  if (n < 2) throw new RangeError("intervalOverlapTally needs at least two units");
  sameLength(n, [u, "upper"]);
  l.forEach((x, i) => {
    if (!(x <= u[i])) throw new RangeError(`lower[${i}] must be ≤ upper[${i}]`);
  });
  const threshold = options.threshold ?? 0.9;
  if (typeof threshold !== "number" || !(threshold >= 0 && threshold <= 1)) throw new RangeError("threshold must lie in [0, 1]");
  if (pi == null || typeof pi !== "object" || pi.length !== n) throw new RangeError(`pi must be an ${n} × ${n} matrix`);
  const p = (i: number, j: number): number => {
    const row = pi[i];
    if (row == null || typeof row !== "object" || row.length !== n) throw new RangeError(`pi must be an ${n} × ${n} matrix`);
    const v = row[j];
    if (typeof v !== "number" || !(v >= 0 && v <= 1)) throw new RangeError(`pi[${i}][${j}] must be a probability`);
    return v;
  };
  const pairs: OverlapPair[] = [];
  let apart = 0;
  let high = 0;
  let low = 0;
  let nestedCount = 0;
  let best: OverlapTally["best"] = null;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const pij = p(i, j);
      const pji = p(j, i);
      const [first, second, pmax] = pij >= pji ? [i, j, pij] : [j, i, pji];
      const overlap = Math.max(l[i], l[j]) < Math.min(u[i], u[j]);
      const cls: OverlapClass = overlap ? (pmax > threshold ? "high" : "low") : "apart";
      if (cls === "apart") apart += 1;
      else if (cls === "high") high += 1;
      else low += 1;
      const amount = Math.min(u[i], u[j]) - Math.max(l[i], l[j]);
      const nested = (l[i] <= l[j] && u[j] <= u[i]) || (l[j] <= l[i] && u[i] <= u[j]);
      if (nested) nestedCount += 1;
      pairs.push({ i, j, first, second, pi: pmax, overlap, class: cls, amount, nested });
      if (overlap && (best === null || pmax > best.pi)) best = { i, j, first, second, pi: pmax };
    }
  }
  return { n, M: (n * (n - 1)) / 2, threshold, apart, overlapping: high + low, high, low, pairs, best, nestedCount };
}

/**
 * Central rank intervals at `level` from a rank distribution function pTop[r][i] = Pr(R_i ≤ r + 1) (r-major, as
 * `rankSummaries` and `rankSummariesMC` return it): with tail = (1 − level)/2, the best end is the first rank
 * whose cumulative probability reaches tail − tieTol and the worst end the first that reaches
 * 1 − tail − tieTol.
 */
export function rankIntervals(pTop: ArrayLike<ArrayLike<number>>, options: RankIntervalOptions = {}): RankIntervals {
  options = readOptions<RankIntervalOptions>(options, ["level", "tieTol"], "rankIntervals");
  const level = options.level ?? 0.9;
  if (typeof level !== "number" || !(level > 0 && level < 1)) throw new RangeError("level must lie in (0, 1)");
  const tieTol = options.tieTol ?? 1e-12;
  if (typeof tieTol !== "number" || !(tieTol >= 0)) throw new RangeError("tieTol must be ≥ 0");
  if (pTop == null || typeof pTop !== "object" || typeof pTop.length !== "number" || pTop.length < 1) {
    throw new RangeError("pTop must be a nonempty array of rows");
  }
  const R = pTop.length;
  const rows = Array.from({ length: R }, (_, r) => readVector(pTop[r], `pTop[${r}]`));
  const n = rows[0].length;
  rows.forEach((row, r) => {
    if (row.length !== n) throw new RangeError(`pTop[${r}] must have ${n} values`);
  });
  const tail = (1 - level) / 2;
  const loCut = tail - tieTol;
  const hiCut = 1 - tail - tieTol;
  const lower: (number | null)[] = new Array<number | null>(n).fill(null);
  const upper: (number | null)[] = new Array<number | null>(n).fill(null);
  for (let r = 0; r < R; r += 1) {
    for (let i = 0; i < n; i += 1) {
      if (lower[i] === null && rows[r][i] >= loCut) lower[i] = r + 1;
      if (upper[i] === null && rows[r][i] >= hiCut) upper[i] = r + 1;
    }
  }
  return { level, tail, lower, upper };
}

