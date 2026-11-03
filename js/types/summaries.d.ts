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
    best: {
        i: number;
        j: number;
        first: number;
        second: number;
        pi: number;
    } | null;
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
/** n, mean and sample SD (divisor n − 1) of a nonempty vector, as R's mean() and sd(); sd is null for n = 1. */
export declare function summaryStats(values: ArrayLike<number>): SummaryStats;
/** Average squared distance (1/n) Σ (a_i − b_i)² of two vectors of the same length. */
export declare function meanSquaredDistance(a: ArrayLike<number>, b: ArrayLike<number>): number;
/**
 * Units whose posterior mean m_i ends farther from the true value θ_i than its estimate y_i was:
 * |m_i − θ_i| > |y_i − θ_i| (strict).
 */
export declare function fartherCount(estimates: ArrayLike<number>, posteriorMeans: ArrayLike<number>, truth: ArrayLike<number>): FartherCount;
/**
 * Sort every pair of units into intervals apart / overlapping with one direction above `threshold` / overlapping
 * and neither direction above it. `lower[i] ≤ upper[i]` are interval ends; `pi[i][j]` = Pr(θ_i > θ_j) for i ≠ j
 * (the diagonal is not read), as `directionMatrix` returns.
 */
export declare function intervalOverlapTally(lower: ArrayLike<number>, upper: ArrayLike<number>, pi: ArrayLike<ArrayLike<number>>, options?: OverlapOptions): OverlapTally;
/**
 * Central rank intervals at `level` from a rank distribution function pTop[r][i] = Pr(R_i ≤ r + 1) (r-major, as
 * `rankSummaries` and `rankSummariesMC` return it): with tail = (1 − level)/2, the best end is the first rank
 * whose cumulative probability reaches tail − tieTol and the worst end the first that reaches
 * 1 − tail − tieTol.
 */
export declare function rankIntervals(pTop: ArrayLike<ArrayLike<number>>, options?: RankIntervalOptions): RankIntervals;
