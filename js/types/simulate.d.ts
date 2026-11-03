import { type ErrorArray, type UnitTable } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type DisclosedErrorEstimands } from "./risk.ts";
/** Default league seed (SR-06); replay r uses LEAGUE_SEED + r. */
export declare const LEAGUE_SEED = 20261030;
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
    pairs: {
        i: number;
        j: number;
    }[];
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
    mean: {
        extreme: Record<string, number>;
        topOverlap: number;
        misordered: number;
    };
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
/** `count` seeded estimates of one unit: truth + se·z with z = normals(seed, count). */
export declare function simulateEstimates(truth: number, se: number, count: number, seed: number): number[];
/** The SR-06 league of 30 units (no randomness): ids, size, group, SE, true values θ and r_i. */
export declare function league30(): League;
/** League estimates for one seed: θ̂_i = θ_i + SE_i·z_i with z = normals(seed, 30) in unit order. */
export declare function drawLeague(seed?: number): {
    seed: number;
    estimate: number[];
};
/**
 * The teaching normal–normal posterior of each estimate: shrink B = σ²/(σ² + SE²), mean m + B(est − m),
 * SD √B·SE. `est` and `se` are numbers or arrays (a number is recycled); the result has the same shape as
 * `est` (arrays when either input is an array). priorSd = Infinity gives the flat prior (B = 1).
 */
export declare function normalPosterior(est: number | ArrayLike<number>, se: number | ArrayLike<number>, options?: PosteriorOptions): NormalPosterior<number> | NormalPosterior<number[]>;
/** Central normal interval mean ± Φ⁻¹((1 + level)/2)·sd; numbers or arrays (a number is recycled). */
export declare function normalInterval(mean: number | ArrayLike<number>, sd: number | ArrayLike<number>, level: number): {
    lower: number;
    upper: number;
} | {
    lower: number[];
    upper: number[];
};
/**
 * Closed-form expected number of pairs whose order disagrees with the true order θ (fixed), for the estimate
 * order (θ̂_i ~ N(θ_i, SE_i²) independent): Σ_{i<j} Φ(−|θ_i − θ_j|/√(SE_i² + SE_j²)); with `priorSd`, for the
 * posterior-mean order m + B_i(θ̂_i − m): Σ_{i<j} Φ(−t_ij·(B_i(θ_i − m) − B_j(θ_j − m))/√(B_i²SE_i² + B_j²SE_j²)),
 * t_ij = sign(θ_i − θ_j). A pair with equal true values counts 1 (any strict estimate order disagrees with it).
 */
export declare function expectedMisorderedPairs(theta: ArrayLike<number>, se: ArrayLike<number> | number, options?: MisorderOptions): number;
/** Pairs i < j that two scores order differently: sign(a_i − a_j) ≠ sign(b_i − b_j) (a tie in one only counts). */
export declare function misorderedPairs(a: ArrayLike<number>, b: ArrayLike<number>): PairList;
/** Units in both top-k sets (the k largest of each score; equal scores in index order, as strictOrder). */
export declare function topKOverlap(a: ArrayLike<number>, b: ArrayLike<number>, k: number): TopKOverlap;
/**
 * Per group, the number of units among the k largest scores (top), the k smallest (bottom) and both (total);
 * equal scores in index order. Keys are the group names in order of first appearance; absent groups count 0.
 */
export declare function extremeCounts(score: ArrayLike<number>, group: ArrayLike<string>, k: number): ExtremeCounts;
/**
 * The SR-06 league's replays: for r = 1..R the draw drawLeague(seed + r), with the units of each size group among
 * the 2k extreme positions by estimate (extremeCounts), the overlap of the top `topK` by estimate with the true
 * top `topK` (topKOverlap) and the pairs ordered against the true values (misorderedPairs), and the averages of
 * these counts over the R replays (L-03). The first draw (seed itself) is not a replay.
 */
export declare function leagueReplays(seed?: number, options?: LeagueReplayOptions): LeagueReplays;
/**
 * S seeded draws of a finite law's state index (0-based): u = uniforms(seed, S), cumulative sums c_k = c_{k−1} + p_k
 * (left to right, c_0 = p_0), and draw s is the smallest k with u_s < c_k (strict); when no k qualifies (u_s ≥ the
 * last sum, possible only when the probabilities sum short of 1) it is the last index K − 1. `probs` are finite
 * numbers in [0, 1] in state order and are not normalized (their sum is not checked); S = 0 gives an empty array.
 */
export declare function finiteLawDraws(probs: ArrayLike<number>, S: number, seed: number): Int32Array;
/**
 * Exact rank summaries of a finite law { states[s][i], probs } (probs null = equal weights): E[θ_i], expected
 * rank, Pr(R_i = r) and Pr(R_i ≤ k) with R_i = 1 + #{j : θ_j > θ_i} (ch. 5). Under a tie-free law the expected
 * rank equals 1 + Σ_j e_ij (postrank_expected_rank); with ties this rank is the best shared position.
 */
export declare function rankSummaries(law: FiniteLaw): RankSummaries;
/**
 * Monte Carlo rank summaries from S seeded draws of independent normals N(means_i, sds_i²)
 * (gaussianDraws with K = 1; "Monte Carlo, S draws, seed shown"): sample means, mean ranks, Pr(R_i = r) and
 * Pr(R_i ≤ k) as exact shares of the draws.
 */
export declare function rankSummariesMC(means: ArrayLike<number>, sds: ArrayLike<number> | number, S: number, seed: number): RankSummariesMC;
/**
 * KRW Example 1 (independent N(ω_i, 1), ω_1 = 2, ω_3 = 0): the open ω₂ interval (2 − √2 z, √2 z),
 * z = Φ⁻¹(1 − τ), on which the pairwise rule withholds 1–2 and 2–3 while stating 1 above 3. Empty when the
 * interval is empty (τ ≥ about .2398) or when the rule would not state 1 above 3 (π_13 < 1 − τ, τ below about
 * .0786).
 */
export declare function krwExample1Band(tau: number): KrwBand;
/**
 * S seeded IID draws from independent normals: theta[s][i][k] = means[i][k] + sds[i][k]·z[(s·n + i)·K + k] with
 * z = normals(seed, S·n·K). `means` is n × K (or an n-vector when K = 1); `sds` the same shape or one number.
 */
export declare function gaussianDraws(means: UnitTable, sds: UnitTable | number, S: number, seed: number): number[][][];
/** IID Monte Carlo standard error of a trace: sample SD (divisor S − 1) over √S; null for fewer than two draws. */
export declare function mcse(trace: ArrayLike<number>): number | null;
/**
 * IID envelope radius for M pairs, S draws and failure chance α: "package" √((log 2 + log M − log α)/(2S))
 * (postrank_iid_bounds(): tie-free, 2M events, one criterion at a time) or "book" √(log(4·M·K/α)/(2S)) (ch. 15
 * prp-iid-coefficient-envelope: equality permitted, 4MK events over all K criteria; `options.K`, default 1;
 * E-7). K does not enter the package form. Not capped at 1.
 */
export declare function envelopeRadius(M: number, S: number, alpha: number, form?: "package" | "book", options?: {
    K?: number;
}): number;
/**
 * The package's Monte Carlo fragility screen (postrank_mc_fragility(), IID regime) on equal-weight joint draws
 * `draws[s][i][k]`: for each pair, d = min(ebar_ij, ebar_ji) with e from the draws (share with θ_i ≤ θ_j) and
 * ebar = Σ_k w_k e_k; pairs with |d − τ| below the screen margin are traced, and a traced pair is fragile when
 * |d − τ| < z·MCSE of its weighted indicator trace. Pairs are in the package's order (column-major upper
 * triangle). Descriptive only: grades are chosen jointly, so a fragile pair need not change the report.
 */
export declare function fragilePairs(draws: ArrayLike<UnitTable>, options: FragilityOptions): Fragility;
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
    mean: {
        overshoot: number;
        posteriorOvershoot: number;
    };
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
export type TransformLaw = {
    states: ArrayLike<UnitTable>;
    probs?: ArrayLike<number> | null;
} | {
    means: ArrayLike<number>;
    sds: ArrayLike<number> | number;
};
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
/**
 * The winner's curse for one draw: units ordered by estimate (largest first, equal estimates in index order, as
 * extremeCounts); `units` are the first k ("top") or the last k ("bottom", in that order), and overshoot =
 * (1/k) Σ_u (estimate[u] − truth[u]) over them; posteriorOvershoot is the same with posterior[u] (null without it).
 */
export declare function topKOvershoot(estimate: ArrayLike<number>, truth: ArrayLike<number>, options: OvershootOptions): TopKOvershoot;
/**
 * The winner's curse over league replays: replay r = 1..R draws drawLeague(seed + r) (as leagueReplays), takes the
 * teaching posterior normalPosterior(estimate, league30().se, { priorSd }) (prior mean 0) and the truth
 * league30().theta, and records topKOvershoot; `mean` averages overshoot and posteriorOvershoot over the replays.
 */
export declare function leagueOvershoot(seed?: number, options?: LeagueOvershootOptions): LeagueOvershoot;
/**
 * The closed-form expected squared distance from the teaching posterior mean m_i = μ + B_i(est_i − μ) to a fixed
 * θ_i over the estimate noise est_i = θ_i + SE_i z_i (B_i = σ²/(σ² + SE_i²), 1 when σ = ∞):
 * perUnit_i = ((1 − B_i)(μ − θ_i))² + B_i²SE_i², mean = (1/n) Σ_i perUnit_i, rawMean = (1/n) Σ_i SE_i².
 */
export declare function expectedSquaredDistance(theta: ArrayLike<number>, se: ArrayLike<number> | number, options?: PosteriorOptions): ExpectedSquaredDistance;
/** δ_w = Σ_k w_k ε_k summed in criterion order: eps nonnegative finite, one per criterion; w weights of that length
 *  (default [1] for one criterion). */
export declare function weightedRadius(eps: ArrayLike<number>, w?: readonly number[]): number;
/**
 * Bounds of ch. 15 ("Coefficient perturbation and regret on a common domain") on the event that every
 * coefficient error on criterion k is at most ε_k (δ_w = weightedRadius(ε, w)): evaluation = N·δ_w/M (the bound
 * on |R̂(g) − R(g)| for a report disclosing N), regret = (N + Nstar)·δ_w/M + η (g against the exact optimum
 * disclosing Nstar, η the optimization slack) and uniform = 2δ_w + η.
 */
export declare function regretBound(input: RegretBoundInput): RegretBound;
/**
 * Seeded stationary two-state chains X_1..X_S ∈ {0, 1}: X_1 = 1 when u < π₁ = p01/(p01 + p10); from state 0 the
 * chain moves to 1 when u < p01, from state 1 to 0 when u < p10 (strict). u = uniforms(seed, chains·S), chain c
 * using entries c·S … c·S + S − 1 in order (the first for X_1).
 */
export declare function twoStateChain(options: TwoStateChainOptions): TwoStateChain;
/**
 * The exact variance of the mean of a stationary two-state chain (ch. 15, "Finite-sample coefficient error in a
 * stationary two-state chain"): ρ = 1 − p01 − p10, Cov(X_b, X_{b+h}) = π₁(1 − π₁)ρ^h, variance = π₁(1 − π₁)/S² ·
 * {S + 2 Σ_{h=1}^{S−1} (S − h)ρ^h} (summed for h = 1, 2, …), the IID variance π₁(1 − π₁)/S, the equivalent
 * number of IID draws π₁(1 − π₁)/variance, its large-S form S(1 − ρ)/(1 + ρ) (null when ρ = −1) and the chance
 * that the chain never switches.
 */
export declare function chainMeanVariance(options: ChainOptions): ChainMeanVariance;
/**
 * Graded league replays: replay r = 1..R draws drawLeague(seed + r), forms the teaching posterior (prior SD
 * `priorSd`, mean 0) and its errorArray (one criterion, larger is higher), grades with fixedOrderDP along the
 * posterior-mean order (descending, equal means in index order) with at most `cap` grades at `tau` (the package's
 * choice among ties), and records evaluateReport's E, N, E/N and risk and realizedWrong's D, D/N against
 * league30().theta. `estimands` = disclosedErrorEstimands over the realized (A = D, N), equally weighted, M = 435.
 */
export declare function leagueGradingReplays(seed?: number, options?: LeagueGradingOptions): LeagueGradingReplays;
/**
 * Posterior means of a transformed target f(θ): θ ("identity"), √θ ("sqrt", θ ≥ 0), log θ ("log", θ > 0) or
 * exp(kθ) ("exp"). A finite law { states, probs } (as finiteLawPairwise; probs null = equal weights) gives
 * means[i] = Σ_s probs[s]·f(states[s][i][criterion]) summed in state order; independent normal posteriors
 * { means, sds } (one criterion) take "identity" (the means) or "exp" (the lognormal mean exp(k·m + k²s²/2)).
 * `order` lists the units by mean descending, equal means in index order. A value outside the transform's
 * support throws a RangeError naming the unit.
 */
export declare function transformedMeans(law: TransformLaw, options?: TransformOptions): TransformedMeans;
/**
 * A report chosen on posterior draws and judged under the exact errors (ch. 15, "Coefficient perturbation and
 * regret on a common domain", "Uniform bounds for optimization using the same draws"): Ê = drawErrors(draws),
 * ĝ = exactOptimum(Ê, { tau, w, family }).grade, inSample = R̂(ĝ), exact = R(ĝ), gap = inSample − exact,
 * epsilon[k] = max_{i≠j} |ê_ijk − e_ijk| (maxCoefficientError), deltaW = weightedRadius(epsilon, w),
 * bound = N(ĝ)·deltaW/M, best = the risk of exactOptimum(E, { tau, w, family }), regret = exact − best,
 * regretBound = (N(ĝ) + N(g*))·deltaW/M.
 */
export declare function selectionOnDraws(draws: ArrayLike<UnitTable>, E: ErrorArray, options: SelectionOptions): SelectionOnDraws;
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
export declare function withinBand(est: ArrayLike<number>, se: ArrayLike<number> | number, options: WithinBandOptions): WithinBand;
/**
 * The normal model with a shared, uncertain mean: est_i | θ_i ~ N(θ_i, se_i²), θ_i | μ ~ N(μ, σ²) independently,
 * μ ~ N(μ₀, s_μ²) (σ = priorSd, s_μ = meanSd, μ₀ = priorMean; meanSd = Infinity is a flat prior on μ). With
 * v_i = σ² + se_i² and B_i = σ²/v_i: muVar = 1/(1/s_μ² + Σ_i 1/v_i), muMean = muVar·(μ₀/s_μ² + Σ_i est_i/v_i)
 * (the s_μ terms are 0 when s_μ = ∞), means_i = (1 − B_i)·muMean + B_i·est_i, var_i = σ²·se_i²/v_i +
 * (1 − B_i)²·muVar, cov_ij = (1 − B_i)(1 − B_j)·muVar, corr_ij = cov_ij/(sds_i·sds_j). Sums in unit order (each
 * Σ_i is summed first, then the s_μ term is added).
 */
export declare function sharedMeanPosterior(est: ArrayLike<number>, se: ArrayLike<number> | number, options: SharedMeanOptions): SharedMeanPosterior;
/**
 * √(e·(1 − e)/S), evaluated as written: the Monte Carlo SE of a share with exact value e over S independent draws
 * (the register's "exact-e approximation"; the MCSE the apps report is mcse(trace)). e in [0, 1]; S an integer ≥ 1.
 */
export declare function binomialMcse(e: number, S: number): number;
/**
 * The exact law of the count of ones C = Σ_b X_b in S draws of the stationary chain of twoStateChain (X_1 = 1 with
 * probability π₁ = p01/(p01 + p10)), by the forward recursion over (count c, current state x): f_1(x, x) = π_x
 * (π_0 = 1 − π₁), f_{t+1}(c + y, y) gains f_t(c, x)·P(x → y) with P(0 → 1) = p01, P(0 → 0) = 1 − p01,
 * P(1 → 0) = p10, P(1 → 1) = 1 − p10; probs[c] = f_S(c, 0) + f_S(c, 1). With `radius` r, outside = Σ probs[c] over
 * the c with |c/S − π₁| > r (strict), summed in c order: the exact chance that the chain mean misses π₁ by more
 * than r (null without a radius). p01, p10 in (0, 1]; S an integer in 1..5000; radius null or finite ≥ 0.
 */
export declare function chainCountLaw(options: ChainCountOptions): ChainCountLaw;
/** The running mean of a trace: m_b = (trace[0] + … + trace[b − 1], summed in order)/b for b = 1..S. The trace is
 *  a nonempty array of finite numbers. */
export declare function runningMean(trace: ArrayLike<number>): Float64Array;
