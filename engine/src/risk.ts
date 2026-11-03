// Loss and risk of a fixed report: evaluation, the isolated pair, KRW's scalar risk, the equality-neutral loss
// and the averaging conventions for disclosed-error fractions.
//
// Definitions (postrank theory book; postrank 1.1.0 postrank_evaluate() and postrank_tie_evaluate())
//   ebar_ij   = Σ_k w_k e_ij,k (weights ≥ 0 summing to 1; w = [1] when K = 1).
//   E_k(g)    = Σ_{g_i < g_j} e_ij,k, the expected wrong-direction count; Ew = Σ_k w_k E_k.
//   R(g)      = (Ew + τ(M − N))/M = τ + M⁻¹ Σ_{g_i<g_j} (ebar_ij − τ)   (ch. 11 prp-weighted-directional-risk)
//   R_k(g)    = (E_k + τ(M − N))/M; E_k/N is null when N = 0 ("NA: no disclosure", never 0).
//   Isolated pair (ch. 10 sec-pair-versus-grade): costs e_ij (i above j), e_ji (j above i), τ (withhold).
//   KRW (ch. 10 prp-krw-pair-risk, prp-scalar-krw-affine): R_K,λ = (1 − λ)·DR − λ·τ̄ with DR = E/M and
//              τ̄ = E[I] = (N − 2E)/M under a tie-free law; λ = τ/(1 − τ), τ = λ/(1 + λ), and
//              R_τ = τ + (1 − τ)·R_K,λ on a common domain.
//   Equality-neutral loss (ch. 11 sec-tie-aware-loss, prp-tie-aware-risk; App. B sec-tie-aware-notation):
//              R_TA = (A_TA + τ(T_w − Q_w))/M = R0 + M⁻¹ Σ_{g_i<g_j}(c_ij − τ δ_ij), R0 = τ T_w/M, with
//              strict errors b, distinctness d, c = Σ_k w_k b_k, δ = Σ_k w_k d_k, T_w = Σ_{i<j} δ_ij.
//   Disclosed-error estimands (ch. 16 sec-disclosed-error-estimands): ERR = E[A]/E[N], the mean of A/N over
//              cases with N > 0, the zero-imputed mean, Pr(N > 0) and E[N/M]; with case weights p (ch. 16,
//              "Averaging conventions for disclosed-error fractions"; v3 helpers) ERR = Σ p·A/Σ p·N,
//              meanFraction = Σ_{N>0} p·A/N / Σ_{N>0} p, zeroImputed = Σ_{N>0} p·A/N, positiveFrequency =
//              Σ_{N>0} p, meanDisclosure = Σ p·N/M ((Σ p·N)/M for one common M), plain sums in case order.
//   v3 helpers (engine/API.md "v3 helpers (Phase 2, Step 2.1)"):
//   largestStatedError    the stated direction with the largest ebar_ij (the first in (i, j) order on ties) (2.13).
//   wrongCountDistribution the law of A = Σ_k w_k D_k of a fixed report under a finite law (D_k from realizedWrong,
//              a tie is wrong; A a plain sum in criterion order): distinct A (===) ascending with probabilities
//              summed in state order, E[A], Pr(A = 0), Pr(every D_k = 0) and the Bonferroni bound
//              max(0, 1 − Σ_stated Σ_k Pr(θ_ik ≤ θ_jk)) (2.8).
//   claimsByDistance      (Part 1 supplement, Step 3.27) the claims of a strict order grouped by the distance b − a of
//              their grades: per distance the number of claims, their summed weighted error (expected wrong claims)
//              and the largest one (1.16).
//
// τ must lie in (0, 1/2]; out-of-range input throws (widgets clamp before calling). Weights are checked, not
// normalized (sum within 1e-12, as postrank). Probabilities are criterion-major e[k][i][j] (K × n × n); rows
// may be any array-like of numbers (typed arrays included). Options are objects; a number in their place or an
// unknown key throws.

import {
  Accumulator, type ErrorArray, type Matrix, type TieLawPairwise, type UnitTable, checkCube, checkProbabilityVector, checkWeights,
  errorCube, finiteLawPairwise, readLaw, readTable, weighted,
} from "./pairwise.ts";
import { counts, reportGrade } from "./report.ts";
import { readOptions } from "./options.ts";

export interface RiskOptions {
  /** withholding cost, 0 < τ ≤ 1/2 */
  tau: number;
  /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
  w?: readonly number[];
}

export interface WeightOptions {
  w?: readonly number[];
}

export interface StatedAboveOptions extends RiskOptions {
  /** a stated pair counts when ebar > τ + tieTol (risk scale); default 1e-12 */
  tieTol?: number;
}

export interface KrwOptions {
  /** λ in [0, 1] */
  lambda: number;
  /** equality probabilities t[k][i][j] (finiteLawPairwise().t): any off-diagonal t > 1e-15 throws, since the
   *  correspondence needs a tie-free law */
  t?: readonly ArrayLike<ArrayLike<number>>[];
}

export type PairAction = "iAboveJ" | "jAboveI" | "withhold";

export interface PairDecision {
  costs: { iAboveJ: number; jAboveI: number; withhold: number };
  /** min(e_ij, e_ji): the smaller directional cost, excluding withholding (not generally E[gamma]). */
  directionalMinimum: number;
  /** every action within 1e-12 of the minimum cost, in the order iAboveJ, jAboveI, withhold */
  best: PairAction[];
}

export interface ReportEvaluation {
  M: number;
  N: number;
  s: number;
  G: number;
  /** E_k per criterion */
  E: number[];
  /** E_k/N; null when N = 0 (no disclosure) */
  EoverN: (number | null)[];
  EoverM: number[];
  /** R_k = (E_k + τ(M − N))/M */
  Rk: number[];
  Ew: number;
  risk: number;
  /** Ew/M */
  errorTerm: number;
  /** τ(M − N)/M */
  withholdingTerm: number;
}

export interface GradePairErrors {
  h: number;
  hp: number;
  /** number of stated pairs between the two grades, n_h·n_hp */
  pairs: number;
  meanError: number;
  maxError: number;
}

export interface StatedPair {
  /** unit stated above */
  i: number;
  /** unit stated below */
  j: number;
  /** weighted error ebar_ij of stating i above j */
  error: number;
}

export interface StatedAbove {
  /** stated pairs with ebar > τ + tieTol, ordered by i then j */
  pairs: StatedPair[];
  count: number;
  /** largest weighted error among all stated pairs; null when nothing is stated */
  max: number | null;
}

export interface ConfidentPair {
  i: number;
  j: number;
  /** g_i = g_j: the pair is confident but the report withholds it (a shared grade) */
  withheld: boolean;
}

export interface ConfidentPairs {
  /** pairs i < j with min(ebar_ij, ebar_ji) < τ (strict) */
  count: number;
  /** confident pairs inside a grade */
  withheld: number;
  /** count − withheld: confident pairs the report states */
  stated: number;
  /** the confident pairs in row-major upper-triangle order (0, 1), (0, 2), …, (1, 2), … */
  pairs: ConfidentPair[];
}

export interface RealizedWrong {
  N: number;
  /** D_k: stated directions wrong on criterion k at this state (theta_ik ≤ theta_jk counts as wrong) */
  D: number[];
  /** D_k/N; null when N = 0 */
  DoverN: (number | null)[];
  /** A = Σ_k w_k D_k; null when K > 1 and no weights were given */
  A: number | null;
  /** A/N; null when N = 0 or A is null */
  AoverN: number | null;
  /** the wrong stated pairs per criterion, ordered by i then j */
  pairs: { i: number; j: number }[][];
}

export interface TieInput {
  b: Matrix[];
  d: Matrix[];
}

export interface EqualityNeutralRisk {
  risk: number;
  R0: number;
}

export interface DisclosureCase {
  /** weighted wrong count A (0 ≤ A ≤ N; A = 0 when N = 0) */
  A: number;
  /** disclosed pairs N */
  N: number;
  /** total pairs M (needed only for meanDisclosure) */
  M?: number;
}

export interface DisclosedErrorEstimands {
  /** E[A]/E[N]; null when no case discloses */
  ERR: number | null;
  /** E[A/N | N > 0]; null when no case discloses */
  meanFraction: number | null;
  /** mean of A/N with the undefined fractions replaced by 0 (a different statistic) */
  zeroImputed: number;
  /** Pr(N > 0) */
  positiveFrequency: number;
  /** E[N/M]; null when M is not supplied */
  meanDisclosure: number | null;
}

export interface DisclosedErrorOptions {
  /** total pairs M for every case without its own M */
  M?: number;
  /** case probabilities (finite, ≥ 0, sum 1 within 1e-12; one per case); null or omitted = equally likely */
  weights?: ArrayLike<number> | null;
}

export interface LargestStatedError {
  /** the weighted error ebar_ij of the stated direction i above j */
  e: number;
  /** unit stated above */
  i: number;
  /** unit stated below */
  j: number;
}

export interface WrongCountDistribution {
  /** pairs the report states */
  N: number;
  /** the distinct values of A = Σ_k w_k D_k (===), ascending */
  values: number[];
  /** Pr(A = values[v]), state probabilities summed in state order (count/S for equal weights) */
  probs: number[];
  /** E[A] = Σ_s probs[s]·A(s) */
  expected: number;
  /** Pr(A = 0) */
  pNone: number;
  /** Pr(D_k = 0 for every k) */
  pAllCriteriaRight: number;
  /** max(0, 1 − Σ_{stated (i, j)} Σ_k Pr(θ_ik ≤ θ_jk)), the Bonferroni lower bound on pAllCriteriaRight */
  unionBound: number;
}

export interface DistanceClaims {
  /** d = b − a: the claim "the unit with grade a is above the unit with grade b" */
  distance: number;
  /** n − d claims at this distance */
  count: number;
  /** the sum of their weighted errors ebar (the expected number of wrong claims at this distance), summed for a = 1, 2, … */
  expected: number;
  /** the largest of their weighted errors */
  max: number;
}

// ---------------------------------------------------------------------------------------------------------
// Validation

/** τ ∈ (0, 1/2]; anything else throws. */
export function checkTau(tau: number): number {
  if (typeof tau !== "number" || !(tau > 0 && tau <= 0.5)) {
    throw new RangeError(`tau must lie in (0, 1/2], got ${String(tau)}`);
  }
  return tau;
}

// The weight check, the ErrorArray shape check and ebar live in pairwise.ts beside the ErrorArray type (so the
// pairwise v3 helpers need no import from this module); they are re-exported here for the modules that import
// them from risk.ts.
export { checkWeights, errorCube, weighted } from "./pairwise.ts";

// ---------------------------------------------------------------------------------------------------------
// Public API

/** The isolated-pair decision: costs e_ij (i above j), e_ji (j above i), τ (withhold) and every best action. */
export function pairDecision(eIJ: number, eJI: number, tau: number): PairDecision {
  checkTau(tau);
  for (const [x, name] of [
    [eIJ, "eIJ"],
    [eJI, "eJI"],
  ] as const) {
    if (typeof x !== "number" || !Number.isFinite(x)) throw new RangeError(`${name} must be a finite number`);
  }
  const costs = { iAboveJ: eIJ, jAboveI: eJI, withhold: tau };
  const min = Math.min(eIJ, eJI, tau);
  const best = (["iAboveJ", "jAboveI", "withhold"] as const).filter((a) => costs[a] - min <= 1e-12);
  return { costs, directionalMinimum: Math.min(eIJ, eJI), best };
}

/** Evaluation of a fixed report: counts, E_k, E_k/N (null at N = 0), E_k/M, R_k, Ew and the risk split. */
export function evaluateReport(g: ArrayLike<number>, E: ErrorArray, options: RiskOptions): ReportEvaluation {
  const o = readOptions<RiskOptions>(options, ["tau", "w"], "evaluateReport", true);
  const { n, K, e } = errorCube(E);
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const c = reportGrade(g, n);
  const { M, N, s, G } = counts(c);
  const Ek: number[] = [];
  for (let k = 0; k < K; k += 1) {
    const acc = new Accumulator();
    const ek = e[k];
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (c[i] < c[j]) acc.add(ek[i][j]);
    Ek.push(acc.value);
  }
  const wsum = new Accumulator();
  for (let k = 0; k < K; k += 1) wsum.add(w[k] * Ek[k]);
  const Ew = wsum.value;
  const withheld = tau * (M - N);
  return {
    M,
    N,
    s,
    G,
    E: Ek,
    EoverN: Ek.map((x) => (N === 0 ? null : x / N)),
    EoverM: Ek.map((x) => x / M),
    Rk: Ek.map((x) => (x + withheld) / M),
    Ew,
    risk: (Ew + withheld) / M,
    errorTerm: Ew / M,
    withholdingTerm: withheld / M,
  };
}

/** M⁻¹ Σ_{i<j} min(ebar_ij, ebar_ji, τ): independent pair choices, a lower bound that need not be a report. */
export function relaxedPairRisk(E: ErrorArray, options: RiskOptions): number {
  const o = readOptions<RiskOptions>(options, ["tau", "w"], "relaxedPairRisk", true);
  const { n, K, e } = errorCube(E);
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const acc = new Accumulator();
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) acc.add(Math.min(weighted(e, w, i, j), weighted(e, w, j, i), tau));
  }
  return acc.value / ((n * (n - 1)) / 2);
}

/** For each grade pair h < h′: the number of stated pairs between them and their mean and largest ebar. */
export function betweenGradeErrors(g: ArrayLike<number>, E: ErrorArray, options: WeightOptions = {}): GradePairErrors[] {
  const o = readOptions<WeightOptions>(options, ["w"], "betweenGradeErrors");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  const c = reportGrade(g, n);
  const G = counts(c).G;
  const sums = Array.from({ length: G }, () => Array.from({ length: G }, () => new Accumulator()));
  const num = Array.from({ length: G }, () => new Array<number>(G).fill(0));
  const max = Array.from({ length: G }, () => new Array<number>(G).fill(Number.NEGATIVE_INFINITY));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (!(c[i] < c[j])) continue;
      const x = weighted(e, w, i, j);
      const h = c[i] - 1;
      const hp = c[j] - 1;
      sums[h][hp].add(x);
      num[h][hp] += 1;
      if (x > max[h][hp]) max[h][hp] = x;
    }
  }
  const out: GradePairErrors[] = [];
  for (let h = 0; h < G; h += 1) {
    for (let hp = h + 1; hp < G; hp += 1) {
      out.push({ h: h + 1, hp: hp + 1, pairs: num[h][hp], meanError: sums[h][hp].value / num[h][hp], maxError: max[h][hp] });
    }
  }
  return out;
}

/** Stated pairs whose weighted error exceeds τ + tieTol (default 1e-12), their count, and the largest stated
 *  error (null if N = 0). */
export function statedAbove(g: ArrayLike<number>, E: ErrorArray, options: StatedAboveOptions): StatedAbove {
  const o = readOptions<StatedAboveOptions>(options, ["tau", "w", "tieTol"], "statedAbove", true);
  const { n, K, e } = errorCube(E);
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const tieTol = o.tieTol ?? 1e-12;
  if (typeof tieTol !== "number" || !Number.isFinite(tieTol) || tieTol < 0) throw new RangeError("tieTol must be a finite number ≥ 0");
  const c = reportGrade(g, n);
  const pairs: StatedPair[] = [];
  let max: number | null = null;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (!(c[i] < c[j])) continue;
      const x = weighted(e, w, i, j);
      if (max === null || x > max) max = x;
      if (x > tau + tieTol) pairs.push({ i, j, error: x });
    }
  }
  return { pairs, count: pairs.length, max };
}

/**
 * Confident pairs (Step 6.14; S-02 heat map): a pair i < j is confident when min(ebar_ij, ebar_ji) < τ (strict, no
 * tolerance; a pair exactly at τ is not confident), i.e. one of its directions is wrong with probability below τ.
 * Counts the confident pairs, those inside a grade (g_i = g_j: withheld) and those stated, and lists them in
 * row-major upper-triangle order. ebar is combined as in statedAbove (w = [1] by default when K = 1).
 */
export function confidentPairs(g: ArrayLike<number>, E: ErrorArray, options: RiskOptions): ConfidentPairs {
  const o = readOptions<RiskOptions>(options, ["tau", "w"], "confidentPairs", true);
  const { n, K, e } = errorCube(E);
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const c = reportGrade(g, n);
  const pairs: ConfidentPair[] = [];
  let withheld = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (!(Math.min(weighted(e, w, i, j), weighted(e, w, j, i)) < tau)) continue;
      const tied = c[i] === c[j];
      if (tied) withheld += 1;
      pairs.push({ i, j, withheld: tied });
    }
  }
  return { count: pairs.length, withheld, stated: pairs.length - withheld, pairs };
}

/**
 * Wrong stated directions at one state `theta[i][k]` (theta[i] when K = 1): stating i above j is wrong on k when
 * theta_ik ≤ theta_jk (equality counts as wrong). `w` (default [1] when K = 1) gives A = Σ_k w_k D_k.
 */
export function realizedWrong(g: ArrayLike<number>, theta: UnitTable, options: WeightOptions = {}): RealizedWrong {
  const o = readOptions<WeightOptions>(options, ["w"], "realizedWrong");
  const t = readTable(theta, "theta");
  const { n, K, v } = t;
  const c = reportGrade(g, n);
  const w = o.w === undefined && K > 1 ? null : checkWeights(o.w, K);
  const N = counts(c).N;
  const D = new Array<number>(K).fill(0);
  const pairs: { i: number; j: number }[][] = Array.from({ length: K }, () => []);
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (c[i] < c[j] && v[i * K + k] <= v[j * K + k]) {
          D[k] += 1;
          pairs[k].push({ i, j });
        }
      }
    }
  }
  let A: number | null = null;
  if (w !== null) {
    const acc = new Accumulator();
    for (let k = 0; k < K; k += 1) acc.add(w[k] * D[k]);
    A = acc.value;
  }
  return {
    N,
    D,
    DoverN: D.map((x) => (N === 0 ? null : x / N)),
    A,
    AoverN: A === null || N === 0 ? null : A / N,
    pairs,
  };
}

/** τ = λ/(1 + λ), for λ in (0, 1]. */
export function lambdaToTau(lambda: number): number {
  if (typeof lambda !== "number" || !(lambda > 0 && lambda <= 1)) throw new RangeError(`lambda must lie in (0, 1], got ${String(lambda)}`);
  return lambda / (1 + lambda);
}

/** λ = τ/(1 − τ), for τ in (0, 1/2]. */
export function tauToLambda(tau: number): number {
  checkTau(tau);
  return tau / (1 - tau);
}

/**
 * KRW's scalar risk (K = 1) in the course orientation: (1 − λ)·DR − λ·τ̄ with DR = E/M and τ̄ = (N − 2E)/M,
 * λ in [0, 1]. τ̄ = (N − 2E)/M uses e_ji = 1 − e_ij, which holds only under a tie-free law; then R_τ = τ +
 * (1 − τ)·R_K,λ for λ = τ/(1 − τ). Pass the law's equality probabilities `t` (finiteLawPairwise().t) to have
 * that checked: any t > 1e-15 throws "the KRW correspondence needs a tie-free law" (E-9).
 */
export function krwRisk(g: ArrayLike<number>, E: ErrorArray, options: KrwOptions): number {
  const o = readOptions<KrwOptions>(options, ["lambda", "t"], "krwRisk", true);
  const { n, K, e } = errorCube(E);
  if (K !== 1) throw new RangeError("krwRisk takes one criterion (K = 1)");
  const lambda = o.lambda;
  if (typeof lambda !== "number" || !(lambda >= 0 && lambda <= 1)) throw new RangeError(`lambda must lie in [0, 1], got ${String(lambda)}`);
  if (o.t !== undefined) {
    const shape = checkCube(o.t, "t");
    if (shape.n !== n || shape.K !== 1) throw new RangeError(`t must be one ${n} × ${n} matrix of equality probabilities (K = 1), as E`);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) if (i !== j && o.t[0][i][j] > 1e-15) throw new RangeError("the KRW correspondence needs a tie-free law");
    }
  }
  const c = reportGrade(g, n);
  const { M, N } = counts(c);
  const acc = new Accumulator();
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (c[i] < c[j]) acc.add(e[0][i][j]);
  const Ev = acc.value;
  const DR = Ev / M;
  const tauBar = (N - 2 * Ev) / M;
  return (1 - lambda) * DR - lambda * tauBar;
}

/**
 * Equality-neutral risk of a fixed report for strict errors `tie.b` and distinctness `tie.d` (tieLawPairwise):
 * Σ_k w_k (E^b_k + τ H_k)/M with E^b_k = Σ_{g_i<g_j} b_ij,k and H_k = Σ_{i<j, g_i=g_j} d_ij,k
 * (postrank_tie_evaluate()), and the all-withheld baseline R0 = τ T_w/M, T_w = Σ_k w_k Σ_{i<j} d_ij,k.
 */
export function equalityNeutralRisk(g: ArrayLike<number>, tie: TieInput | TieLawPairwise, options: RiskOptions): EqualityNeutralRisk {
  const o = readOptions<RiskOptions>(options, ["tau", "w"], "equalityNeutralRisk", true);
  if (tie == null || typeof tie !== "object") throw new RangeError("tie must hold the arrays b and d");
  const { n, K } = checkCube(tie.b, "tie.b");
  const dShape = checkCube(tie.d, "tie.d");
  if (dShape.n !== n || dShape.K !== K) throw new RangeError("tie.b and tie.d must have the same shape");
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const c = reportGrade(g, n);
  const M = counts(c).M;
  const risk = new Accumulator();
  const base = new Accumulator();
  for (let k = 0; k < K; k += 1) {
    const Eb = new Accumulator();
    const H = new Accumulator();
    const T = new Accumulator();
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (c[i] < c[j]) Eb.add(tie.b[k][i][j]);
        if (i < j) {
          T.add(tie.d[k][i][j]);
          if (c[i] === c[j]) H.add(tie.d[k][i][j]);
        }
      }
    }
    risk.add(w[k] * ((Eb.value + tau * H.value) / M));
    base.add(w[k] * ((tau * T.value) / M));
  }
  return { risk: risk.value, R0: base.value };
}

/**
 * Averaging conventions for disclosed-error fractions over equally likely cases [{ A, N, M? }] (ch. 16):
 * ERR = ΣA/ΣN, the mean of A/N over cases with N > 0, the zero-imputed mean, Pr(N > 0) and E[N/M]
 * (M per case, or `options.M` for all; null when unknown). With `weights` p (one probability per case: the
 * kernel of a randomized report or a design over datasets) ERR = Σ p·A / Σ p·N (null when Σ p·N = 0),
 * meanFraction = Σ_{N>0} p·A/N / Σ_{N>0} p (null when no case with positive weight discloses), zeroImputed =
 * Σ_{N>0} p·A/N, positiveFrequency = Σ_{N>0} p and meanDisclosure = Σ p·N/M (one common M: (Σ p·N)/M, a single
 * division as without weights), plain sums in case order.
 */
export function disclosedErrorEstimands(cases: readonly DisclosureCase[], options: DisclosedErrorOptions = {}): DisclosedErrorEstimands {
  options = readOptions<DisclosedErrorOptions>(options, ["M", "weights"], "disclosedErrorEstimands");
  if (!Array.isArray(cases) || cases.length < 1) throw new RangeError("cases must be a nonempty array of { A, N }");
  const count = cases.length;
  const sumA = new Accumulator();
  const sumN = new Accumulator();
  const fractions = new Accumulator();
  const share = new Accumulator();
  let positive = 0;
  let haveM = true;
  const Ms = new Set<number>();
  const caseM: number[] = [];
  for (const [q, x] of cases.entries()) {
    const { A, N } = x ?? ({} as DisclosureCase);
    if (typeof A !== "number" || !Number.isFinite(A) || A < 0) throw new RangeError(`cases[${q}].A must be finite and ≥ 0`);
    if (typeof N !== "number" || !Number.isFinite(N) || N < 0) throw new RangeError(`cases[${q}].N must be finite and ≥ 0`);
    if (N === 0 && A !== 0) throw new RangeError(`cases[${q}] discloses nothing, so its wrong count must be 0`);
    sumA.add(A);
    sumN.add(N);
    if (N > 0) {
      positive += 1;
      fractions.add(A / N);
    }
    const M = x.M ?? options.M;
    if (M === undefined) haveM = false;
    else {
      if (typeof M !== "number" || !Number.isFinite(M) || M <= 0 || N > M) throw new RangeError(`cases[${q}].M must be positive and ≥ N`);
      share.add(N / M);
      Ms.add(M);
      caseM.push(M);
    }
  }
  if (options.weights !== undefined && options.weights !== null) {
    const p = options.weights;
    if (typeof p !== "object" || typeof p.length !== "number" || p.length !== count) {
      throw new RangeError(`disclosedErrorEstimands: weights must hold one probability per case (${count})`);
    }
    checkProbabilityVector(p, "disclosedErrorEstimands: weights");
    // plain sums in case order (engine/API.md, v3 helpers); one common M divides once, as without weights
    const common = haveM && Ms.size === 1 ? [...Ms][0] : null;
    let sA = 0;
    let sN = 0;
    let frac = 0;
    let pos = 0;
    let disc = 0;
    for (let q = 0; q < count; q += 1) {
      const { A, N } = cases[q];
      const pq = p[q];
      sA += pq * A;
      sN += pq * N;
      if (N > 0) {
        frac += (pq * A) / N;
        pos += pq;
      }
      if (haveM) disc += common !== null ? pq * N : (pq * N) / caseM[q];
    }
    return {
      ERR: sN > 0 ? sA / sN : null,
      meanFraction: pos > 0 ? frac / pos : null,
      zeroImputed: frac,
      positiveFrequency: pos,
      meanDisclosure: !haveM ? null : common !== null ? disc / common : disc,
    };
  }
  // one common M: ΣN/(M·cases), a single rounding (5/9 in the three-case example)
  const meanDisclosure = !haveM ? null : Ms.size === 1 ? sumN.value / ([...Ms][0] * count) : share.value / count;
  return {
    ERR: sumN.value > 0 ? sumA.value / sumN.value : null,
    meanFraction: positive > 0 ? fractions.value / positive : null,
    zeroImputed: fractions.value / count,
    positiveFrequency: positive / count,
    meanDisclosure,
  };
}

// ---------------------------------------------------------------------------------------------------------
// v3 helpers (Phase 2, Step 2.1; engine/API.md "v3 helpers")

/**
 * The stated direction (g_i < g_j: i above j) with the largest weighted error ebar_ij, as `{ e, i, j }`; on equal
 * errors the first in (i, j) index order. null when the report states nothing (N = 0).
 */
export function largestStatedError(g: ArrayLike<number>, E: ErrorArray, options: WeightOptions = {}): LargestStatedError | null {
  const o = readOptions<WeightOptions>(options, ["w"], "largestStatedError");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  const c = reportGrade(g, n);
  let best: LargestStatedError | null = null;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (!(c[i] < c[j])) continue;
      const x = weighted(e, w, i, j);
      if (best === null || x > best.e) best = { e: x, i, j };
    }
  }
  return best;
}

/**
 * The law of the realized weighted wrong count A = Σ_k w_k D_k of a fixed report g under a finite joint law
 * `states[s][i][k]`, `probs[s]` (checked as in finiteLawPairwise; null = equal weights). D_k(s) counts the stated
 * directions i above j with states[s][i][k] ≤ states[s][j][k] (a tie is wrong), over pairs in index order
 * (realizedWrong), and A is a plain sum in criterion order. `values` are the distinct A (===) ascending with their
 * probabilities summed in state order; expected = Σ_s probs[s]·A(s); pNone = Pr(A = 0); pAllCriteriaRight =
 * Pr(D_k = 0 for every k) (= pNone when every weight is positive); unionBound = max(0, 1 − Σ_{stated (i, j)}
 * Σ_k Pr(θ_ik ≤ θ_jk)), the Bonferroni lower bound on pAllCriteriaRight. N = 0: values [0], probs [1], every
 * probability 1. Equal weights use exact counts over S. g holds positive integer labels (canonicalized).
 */
export function wrongCountDistribution(
  g: ArrayLike<number>,
  states: ArrayLike<UnitTable>,
  probs: ArrayLike<number> | null | undefined,
  options: WeightOptions = {},
): WrongCountDistribution {
  const o = readOptions<WeightOptions>(options, ["w"], "wrongCountDistribution");
  const law = readLaw(states, probs, "states");
  const { S, n, K, p } = law;
  const w = checkWeights(o.w, K);
  if (g == null || typeof g !== "object" || typeof g.length !== "number") {
    throw new RangeError("wrongCountDistribution: g must be an array of grade labels");
  }
  for (let q = 0; q < g.length; q += 1) {
    const x = g[q];
    if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 1) {
      throw new RangeError(`wrongCountDistribution: g must hold positive integer grade labels, got ${String(x)}`);
    }
  }
  const c = reportGrade(g, n);
  const { N } = counts(c);
  if (N === 0) return { N, values: [0], probs: [1], expected: 0, pNone: 1, pAllCriteriaRight: 1, unionBound: 1 };
  const A = new Float64Array(S);
  const right = new Uint8Array(S);
  for (let s = 0; s < S; s += 1) {
    // D_k from realizedWrong; A as a plain sum in criterion order (the spec), so that equal A values are
    // identified (===) exactly as an index-order sum does (realizedWrong's A is compensated: equal for K ≤ 2)
    const { D } = realizedWrong(c, states[s], { w });
    let a = 0;
    for (let k = 0; k < K; k += 1) a += w[k] * D[k];
    A[s] = a;
    right[s] = D.every((d) => d === 0) ? 1 : 0;
  }
  // masses in state order (counts when the states are equally likely, divided by S at the end)
  const mass = new Map<number, number>();
  let expected = 0;
  let pNone = 0;
  let pAll = 0;
  for (let s = 0; s < S; s += 1) {
    const ps = p === null ? 1 : p[s];
    const a = A[s];
    mass.set(a, (mass.get(a) ?? 0) + ps);
    expected += ps * a;
    if (a === 0) pNone += ps;
    if (right[s]) pAll += ps;
  }
  const scale = p === null ? S : 1;
  const values = [...mass.keys()].sort((x, y) => x - y);
  // Bonferroni: Σ over the stated pairs (i, j) in index order, then the criteria, of Pr(θ_ik ≤ θ_jk)
  const e = finiteLawPairwise(states, probs).e;
  let union = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) if (c[i] < c[j]) for (let k = 0; k < K; k += 1) union += e[k][i][j];
  }
  return {
    N,
    values,
    probs: values.map((v) => (mass.get(v) as number) / scale),
    expected: expected / scale,
    pNone: pNone / scale,
    pAllCriteriaRight: pAll / scale,
    unionBound: Math.max(0, 1 - union),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Part 1 supplement (Step 3.27; engine/API.md "v3 helpers: Part 1 supplement")

/**
 * The claims of a strict order grouped by distance. `g` is a strict order: a permutation of the grades 1..n
 * (grade 1 on top). The claim "the unit with grade a is above the unit with grade b" (a < b) has distance b − a
 * and weighted error ebar = Σ_k w_k e_k[unit_a][unit_b]. For d = 1, …, n − 1, in order: count = n − d, expected =
 * the sum of the errors of the claims at distance d (a plain sum for a = 1, 2, …) and max = the largest of them.
 */
export function claimsByDistance(g: ArrayLike<number>, E: ErrorArray, options: WeightOptions = {}): DistanceClaims[] {
  const o = readOptions<WeightOptions>(options, ["w"], "claimsByDistance");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  if (g == null || typeof g !== "object" || typeof g.length !== "number" || g.length !== n) {
    throw new RangeError(`claimsByDistance: g must be a strict order of the ${n} units (a permutation of the grades 1..${n})`);
  }
  // unitAt[a − 1] = the unit with grade a
  const unitAt = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    const a = g[i];
    if (typeof a !== "number" || !Number.isSafeInteger(a) || a < 1 || a > n || unitAt[a - 1] !== -1) {
      throw new RangeError(`claimsByDistance: g must be a permutation of the grades 1..${n} (each grade once), got ${String(a)} at unit ${i}`);
    }
    unitAt[a - 1] = i;
  }
  const rows: DistanceClaims[] = [];
  for (let d = 1; d < n; d += 1) {
    let expected = 0;
    let max = Number.NEGATIVE_INFINITY;
    for (let a = 1; a + d <= n; a += 1) {
      const x = weighted(e, w, unitAt[a - 1], unitAt[a + d - 1]);
      expected += x;
      if (x > max) max = x;
    }
    rows.push({ distance: d, count: n - d, expected, max });
  }
  return rows;
}
