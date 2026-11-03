import { type ErrorArray, type Matrix, type TieLawPairwise, type UnitTable } from "./pairwise.ts";
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
    costs: {
        iAboveJ: number;
        jAboveI: number;
        withhold: number;
    };
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
    pairs: {
        i: number;
        j: number;
    }[][];
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
/** τ ∈ (0, 1/2]; anything else throws. */
export declare function checkTau(tau: number): number;
export { checkWeights, errorCube, weighted } from "./pairwise.ts";
/** The isolated-pair decision: costs e_ij (i above j), e_ji (j above i), τ (withhold) and every best action. */
export declare function pairDecision(eIJ: number, eJI: number, tau: number): PairDecision;
/** Evaluation of a fixed report: counts, E_k, E_k/N (null at N = 0), E_k/M, R_k, Ew and the risk split. */
export declare function evaluateReport(g: ArrayLike<number>, E: ErrorArray, options: RiskOptions): ReportEvaluation;
/** M⁻¹ Σ_{i<j} min(ebar_ij, ebar_ji, τ): independent pair choices, a lower bound that need not be a report. */
export declare function relaxedPairRisk(E: ErrorArray, options: RiskOptions): number;
/** For each grade pair h < h′: the number of stated pairs between them and their mean and largest ebar. */
export declare function betweenGradeErrors(g: ArrayLike<number>, E: ErrorArray, options?: WeightOptions): GradePairErrors[];
/** Stated pairs whose weighted error exceeds τ + tieTol (default 1e-12), their count, and the largest stated
 *  error (null if N = 0). */
export declare function statedAbove(g: ArrayLike<number>, E: ErrorArray, options: StatedAboveOptions): StatedAbove;
/**
 * Confident pairs (Step 6.14; S-02 heat map): a pair i < j is confident when min(ebar_ij, ebar_ji) < τ (strict, no
 * tolerance; a pair exactly at τ is not confident), i.e. one of its directions is wrong with probability below τ.
 * Counts the confident pairs, those inside a grade (g_i = g_j: withheld) and those stated, and lists them in
 * row-major upper-triangle order. ebar is combined as in statedAbove (w = [1] by default when K = 1).
 */
export declare function confidentPairs(g: ArrayLike<number>, E: ErrorArray, options: RiskOptions): ConfidentPairs;
/**
 * Wrong stated directions at one state `theta[i][k]` (theta[i] when K = 1): stating i above j is wrong on k when
 * theta_ik ≤ theta_jk (equality counts as wrong). `w` (default [1] when K = 1) gives A = Σ_k w_k D_k.
 */
export declare function realizedWrong(g: ArrayLike<number>, theta: UnitTable, options?: WeightOptions): RealizedWrong;
/** τ = λ/(1 + λ), for λ in (0, 1]. */
export declare function lambdaToTau(lambda: number): number;
/** λ = τ/(1 − τ), for τ in (0, 1/2]. */
export declare function tauToLambda(tau: number): number;
/**
 * KRW's scalar risk (K = 1) in the course orientation: (1 − λ)·DR − λ·τ̄ with DR = E/M and τ̄ = (N − 2E)/M,
 * λ in [0, 1]. τ̄ = (N − 2E)/M uses e_ji = 1 − e_ij, which holds only under a tie-free law; then R_τ = τ +
 * (1 − τ)·R_K,λ for λ = τ/(1 − τ). Pass the law's equality probabilities `t` (finiteLawPairwise().t) to have
 * that checked: any t > 1e-15 throws "the KRW correspondence needs a tie-free law" (E-9).
 */
export declare function krwRisk(g: ArrayLike<number>, E: ErrorArray, options: KrwOptions): number;
/**
 * Equality-neutral risk of a fixed report for strict errors `tie.b` and distinctness `tie.d` (tieLawPairwise):
 * Σ_k w_k (E^b_k + τ H_k)/M with E^b_k = Σ_{g_i<g_j} b_ij,k and H_k = Σ_{i<j, g_i=g_j} d_ij,k
 * (postrank_tie_evaluate()), and the all-withheld baseline R0 = τ T_w/M, T_w = Σ_k w_k Σ_{i<j} d_ij,k.
 */
export declare function equalityNeutralRisk(g: ArrayLike<number>, tie: TieInput | TieLawPairwise, options: RiskOptions): EqualityNeutralRisk;
/**
 * Averaging conventions for disclosed-error fractions over equally likely cases [{ A, N, M? }] (ch. 16):
 * ERR = ΣA/ΣN, the mean of A/N over cases with N > 0, the zero-imputed mean, Pr(N > 0) and E[N/M]
 * (M per case, or `options.M` for all; null when unknown). With `weights` p (one probability per case: the
 * kernel of a randomized report or a design over datasets) ERR = Σ p·A / Σ p·N (null when Σ p·N = 0),
 * meanFraction = Σ_{N>0} p·A/N / Σ_{N>0} p (null when no case with positive weight discloses), zeroImputed =
 * Σ_{N>0} p·A/N, positiveFrequency = Σ_{N>0} p and meanDisclosure = Σ p·N/M (one common M: (Σ p·N)/M, a single
 * division as without weights), plain sums in case order.
 */
export declare function disclosedErrorEstimands(cases: readonly DisclosureCase[], options?: DisclosedErrorOptions): DisclosedErrorEstimands;
/**
 * The stated direction (g_i < g_j: i above j) with the largest weighted error ebar_ij, as `{ e, i, j }`; on equal
 * errors the first in (i, j) index order. null when the report states nothing (N = 0).
 */
export declare function largestStatedError(g: ArrayLike<number>, E: ErrorArray, options?: WeightOptions): LargestStatedError | null;
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
export declare function wrongCountDistribution(g: ArrayLike<number>, states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, options?: WeightOptions): WrongCountDistribution;
/**
 * The claims of a strict order grouped by distance. `g` is a strict order: a permutation of the grades 1..n
 * (grade 1 on top). The claim "the unit with grade a is above the unit with grade b" (a < b) has distance b − a
 * and weighted error ebar = Σ_k w_k e_k[unit_a][unit_b]. For d = 1, …, n − 1, in order: count = n − d, expected =
 * the sum of the errors of the claims at distance d (a plain sum for a = 1, 2, …) and max = the largest of them.
 */
export declare function claimsByDistance(g: ArrayLike<number>, E: ErrorArray, options?: WeightOptions): DistanceClaims[];
