/** n × n matrix of ordered-pair values; the diagonal is NaN (JSON null in golden files). */
export type Matrix = number[][];
/** Directional error probabilities, criterion-major: e[k][i][j] = Pr(theta_ik <= theta_jk | Y). */
export interface ErrorArray {
    ids: string[];
    criteria: string[];
    e: Matrix[];
}
/** Equal-weight weak errors with the original integer tallies retained before division by S. */
export interface DrawErrorArray extends ErrorArray {
    S: number;
    /** Criterion-major K × n × n integer counts; NaN on the diagonal, as in e. */
    counts: Matrix[];
}
/** Optional unit and criterion ids. Defaults: A, B, … (n ≤ 26) or U01, U02, … ; k1, k2, …. */
export interface LabelOptions {
    ids?: readonly string[];
    criteria?: readonly string[];
}
export interface ErrorArrayOptions extends LabelOptions {
    /** orient[k] = +1 (larger is higher priority) or −1 (the target's sign is flipped); default all +1. */
    orient?: readonly number[];
}
export interface PairDirectionOptions {
    /** Correlation of theta_A and theta_B, in [−1, 1]; default 0. */
    corr?: number;
}
/** finiteLawPairwise result: an ErrorArray (field e) that also carries pi and the equality probability t. */
export interface FiniteLawPairwise extends ErrorArray {
    pi: Matrix[];
    t: Matrix[];
}
/** tieLawPairwise result: strict error b, equality t and distinctness d (each criterion-major, NaN diagonal). */
export interface TieLawPairwise {
    ids: string[];
    criteria: string[];
    b: Matrix[];
    t: Matrix[];
    d: Matrix[];
}
/** One bivariate normal component of a mixture for the pair (A, B). */
export interface MixtureComponent {
    w: number;
    meanA: number;
    sdA: number;
    meanB: number;
    sdB: number;
    corr?: number;
}
/** One unit's values: a number when K = 1, or K criterion values. */
export type UnitValues = number | ArrayLike<number>;
/** n units × K criteria, x[i][k] (or x[i] as a number when K = 1). */
export type UnitTable = ArrayLike<UnitValues>;
/** Neumaier compensated summation: the sum is accurate to about one rounding, independent of order. */
export declare class Accumulator {
    private s;
    private c;
    add(x: number): void;
    get value(): number;
}
/** Default unit ids: A … Z for n ≤ 26, otherwise U01 … Un (zero-padded, so text order = index order). */
export declare function defaultIds(n: number): string[];
/** Default criterion ids k1 … kK. */
export declare function defaultCriteria(K: number): string[];
/** Resolve ids and criteria (validated lengths, distinct strings) for n units and K criteria. */
export declare function resolveLabels(options: LabelOptions | undefined, n: number, K: number): {
    ids: string[];
    criteria: string[];
};
/** A fresh n × n matrix of zeros with a NaN diagonal. */
export declare function nanMatrix(n: number): Matrix;
/** A unit table read into a flat array: v[i * K + k]. */
export interface Table {
    n: number;
    K: number;
    v: Float64Array;
}
/** Read x[i][k] (or x[i] when K = 1) into a flat table; every value must be finite and every row have K values. */
export declare function readTable(x: UnitTable, name: string): Table;
/** Criterion weights: length K, finite, ≥ 0, sum 1 within 1e-12; [1] by default when K = 1. (Internal; re-exported
 *  by risk.ts, where the other modules import it.) */
export declare function checkWeights(w: readonly number[] | undefined, K: number): number[];
/** Shape check of a criterion-major array (K × n × n) of n × n matrices whose rows may be typed arrays; n and K.
 *  (Internal; exported for risk.ts.) */
export declare function checkCube(e: readonly ArrayLike<ArrayLike<number>>[] | undefined, name: string): {
    n: number;
    K: number;
};
/** Shape check of an ErrorArray (internal; re-exported by risk.ts): n, K and the matrices. `name` (default "E")
 *  names the argument in the error messages. */
export declare function errorCube(E: ErrorArray, name?: string): {
    n: number;
    K: number;
    e: Matrix[];
};
/** ebar_ij = Σ_k w_k e[k][i][j] (exactly e[0][i][j] when K = 1 and w = [1]; internal, re-exported by risk.ts). */
export declare function weighted(e: Matrix[], w: readonly number[], i: number, j: number): number;
/** Check that weights are finite, ≥ 0 and sum to 1 within 1e-12 (no automatic normalization, as postrank). */
export declare function checkProbabilityVector(p: ArrayLike<number>, name: string): void;
/** A finite law (states with probabilities) or equal-weight draws (probs null), read into flat tables
 *  (internal; exported for risk.ts and simulate.ts). */
export interface Law {
    S: number;
    n: number;
    K: number;
    /** states[s][i * K + k] */
    states: Float64Array[];
    p: Float64Array | null;
}
/** Read a finite law: states S × n × K (finite, one shape) and probs (finite, ≥ 0, sum 1 within 1e-12; null =
 *  equal weights). Internal; exported for risk.ts and simulate.ts. */
export declare function readLaw(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, name: string): Law;
/**
 * π = Pr(theta_A > theta_B) for a bivariate normal: Φ((meanA − meanB) / sqrt(sdA² + sdB² − 2·corr·sdA·sdB)).
 * Throws when the difference has SD 0 (then the direction is a point mass, not a normal probability).
 */
export declare function pairDirection(meanA: number, sdA: number, meanB: number, sdB: number, options?: PairDirectionOptions): number;
/** Matrix of π_ij = Pr(theta_i > theta_j) for independent normals (Part 1); `sds` may be one common SD. */
export declare function directionMatrix(means: ArrayLike<number>, sds: ArrayLike<number> | number): Matrix;
/**
 * ErrorArray for independent normal posteriors: e[k][i][j] = Pr(theta_ik ≤ theta_jk), computed directly as
 * Φ(orient_k·(mean_jk − mean_ik) / sqrt(sd_ik² + sd_jk²)). `means` and `sds` are n × K (or n-vectors when
 * K = 1); `sds` may be one common SD. orient[k] = −1 flips the target's sign (smaller is higher priority).
 */
export declare function errorArray(means: UnitTable, sds: UnitTable | number, options?: ErrorArrayOptions): ErrorArray;
/**
 * Exact pair probabilities of a finite law: `states[s][i][k]` with probabilities `probs[s]` (finite, ≥ 0, sum 1;
 * null for equal weights). Returns an ErrorArray (e = Pr(theta_i ≤ theta_j), ties wrong in both directions)
 * that also carries pi = Pr(theta_i > theta_j) and t = Pr(theta_i = theta_j). Every field is summed directly.
 */
export declare function finiteLawPairwise(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, options?: LabelOptions): FiniteLawPairwise;
/** π = Σ_c w_c Pr_c(theta_A > theta_B) under a mixture of bivariate normals; weights ≥ 0 summing to 1. */
export declare function mixturePairDirection(components: readonly MixtureComponent[]): number;
/** Weak errors from equal-weight draws `draws[s][i][k]`: original integer counts and their shares count/S,
 * with theta_i ≤ theta_j (ties count). Counts are saved from the original tally, never reconstructed as e*S. */
export declare function drawErrors(draws: ArrayLike<UnitTable>, options?: LabelOptions): DrawErrorArray;
/**
 * Strict error b = Pr(theta_i < theta_j), equality t = Pr(theta_i = theta_j) and distinctness
 * d = Pr(theta_i ≠ theta_j) = 1 − t of a finite law (probs null for equal-weight draws). b_ij + b_ji = d_ij.
 */
export declare function tieLawPairwise(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, options?: LabelOptions): TieLawPairwise;
/** The marginal law of one unit on one criterion. */
export interface MarginalLaw {
    /** the distinct values (===) in ascending order */
    values: number[];
    /** probs[v]: the state probabilities with value values[v], summed in state order (count/S for equal weights) */
    probs: number[];
}
export interface FiniteLawMargins {
    /** present when given in the options */
    ids?: string[];
    /** present when given in the options */
    criteria?: string[];
    /** margins[i][k]: the marginal law of unit i on criterion k */
    margins: MarginalLaw[][];
}
export interface MajorityOptions {
    /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
    w?: readonly number[];
    /** a pair is a majority tie when |ebar_ij − ebar_ji| ≤ tieTol (finite, ≥ 0); default 1e-12 */
    tieTol?: number;
}
export interface MajorityWins {
    /** wins[i]: the units i beats (ebar_ij < ebar_ji − tieTol) */
    wins: number[];
    /** ties[i]: the units i ties with (|ebar_ij − ebar_ji| ≤ tieTol) */
    ties: number[];
    /** units by wins descending, equal wins in index order */
    order: number[];
    /** unordered triples whose three pairs are strict and cyclic (a beats b, b beats c, c beats a) */
    cycles: number;
    /** no pair ties and no triple is cyclic (then `order` is the majority order) */
    strictOrder: boolean;
    /** the cyclic triples (cycles of them) in lexicographic order of their sorted indices a < b < c, each written
     *  [a, x, y] with a its smallest index: a beats x, x beats y and y beats a */
    cycleTriples: number[][];
}
export interface LeastCertainOptions {
    /** how many pairs (a positive integer, clamped to M); default 10 */
    k?: number;
    w?: readonly number[];
    /** a permutation of 0..n − 1 (e.g. a display order); each pair then also has `apart`; null or omitted: no `apart` */
    order?: readonly number[] | null;
}
export interface UncertainPair {
    i: number;
    j: number;
    /** min(ebar_ij, ebar_ji) */
    e: number;
    /** i when ebar_ij ≤ ebar_ji, else j (the more likely higher unit) */
    above: number;
    /** with `order`: |pos(i) − pos(j)|, the distance between the two units' positions in the order */
    apart?: number;
}
export interface PairDifference {
    /** meanA − meanB */
    mean: number;
    /** √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB), evaluated left to right */
    sd: number;
    /** mean/sd */
    z: number;
    /** Pr(θ_A > θ_B) = normalCdf(z) (pairDirection when ρ = 0) */
    pi: number;
}
export interface FiniteLawCellsOptions {
    /** the row unit, an integer index */
    i: number;
    /** the column unit, an integer index other than i */
    j: number;
    /** the criterion, an integer index; default 0 */
    criterion?: number;
}
export interface FiniteLawCells {
    /** the distinct values (===) of states[s][i][criterion], ascending */
    rowValues: number[];
    /** the distinct values (===) of states[s][j][criterion], ascending */
    colValues: number[];
    /** cells[r][c]: the probabilities of the states with θ_i = rowValues[r] and θ_j = colValues[c], summed in state
     *  order (equal weights: the exact count over S); 0 where no state falls */
    cells: number[][];
}
export interface MaxCoefficientError {
    /** epsilon[k] = the largest |ê_ijk − e_ijk| over ordered pairs i ≠ j */
    epsilon: number[];
    /** at[k]: the first ordered pair, in row-major (i, j) order, where epsilon[k] occurs */
    at: {
        i: number;
        j: number;
    }[];
}
export interface PairCertaintyOptions {
    w?: readonly number[];
    /** thresholds in (1/2, 1), strictly increasing; default [.9, .99] */
    thresholds?: readonly number[];
}
export interface PairCertainty {
    M: number;
    thresholds: number[];
    /** counts[t]: pairs i < j with min(ebar_ij, ebar_ji) < 1 − thresholds[t] (strict) */
    counts: number[];
}
/**
 * Marginal laws of a finite joint law `states[s][i][k]` with probabilities `probs[s]` (checked as in
 * finiteLawPairwise; null = equal weights): margins[i][k] = { values, probs } with the distinct values of
 * states[s][i][k] (equal means ===) in ascending order and, for each, the sum of the state probabilities with that
 * value, summed in state order (equal weights: the exact count over S). `ids` and `criteria` (optional, checked as
 * in finiteLawPairwise) are returned when given.
 */
export declare function finiteLawMargins(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, options?: LabelOptions): FiniteLawMargins;
/**
 * The majority relation of the weighted errors: i beats j when ebar_ij < ebar_ji − tieTol (stating i above j is
 * less often wrong than the reverse), and the pair is a majority tie when |ebar_ij − ebar_ji| ≤ tieTol. Wins and
 * ties per unit, the order by wins (descending, equal wins in index order), the number of cyclic triples (three
 * strict pairs a beats b, b beats c, c beats a, in either orientation) and whether the relation is a strict order
 * (no tie and no cyclic triple).
 */
export declare function majorityWins(E: ErrorArray, options?: MajorityOptions): MajorityWins;
/**
 * The k unordered pairs i < j whose more likely direction is least certain: the largest min(ebar_ij, ebar_ji)
 * first, equal values in (i, j) index order. `above` is i when ebar_ij ≤ ebar_ji, else j. k (default 10) is a
 * positive integer, clamped to M. With `order` (a permutation of 0..n − 1, e.g. a display order) each pair also
 * has apart = |pos(i) − pos(j)|, the distance between the positions of i and j in `order`.
 */
export declare function leastCertainPairs(E: ErrorArray, options?: LeastCertainOptions): UncertainPair[];
/**
 * How many directions the posterior is nearly sure of: counts[t] = #{i < j : min(ebar_ij, ebar_ji) < 1 −
 * thresholds[t]} (strict), the more likely direction having probability above the threshold. Thresholds lie in
 * (1/2, 1), strictly increasing (default [.9, .99]).
 */
export declare function pairCertainty(E: ErrorArray, options?: PairCertaintyOptions): PairCertainty;
/**
 * The difference θ_A − θ_B of two normal posteriors with correlation ρ (`corr`, default 0): mean = meanA − meanB,
 * sd = √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB) (evaluated left to right), z = mean/sd and pi = Pr(θ_A > θ_B) =
 * normalCdf(z) (with ρ = 0 the value of pairDirection). Means finite; SDs finite and > 0; ρ in [−1, 1]; a
 * degenerate difference (sd = 0, e.g. ρ = 1 with equal SDs) throws a RangeError.
 */
export declare function pairDifference(meanA: number, sdA: number, meanB: number, sdB: number, options?: PairDirectionOptions): PairDifference;
/**
 * The joint law of (θ_i, θ_j) on one criterion of a finite law `states[s][i][k]`, `probs[s]` (checked as in
 * finiteLawPairwise; null = equally likely states): rowValues and colValues are the distinct values (===) of
 * states[s][i][criterion] and states[s][j][criterion] in ascending order, and cells[r][c] the sum of probs[s] over
 * the states with that pair of values, summed in state order (equal weights: the exact count over S; 0 where no
 * state falls). i ≠ j are unit indices; criterion (default 0) a criterion index.
 */
export declare function finiteLawCells(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, options: FiniteLawCellsOptions): FiniteLawCells;
/**
 * The largest coefficient error per criterion between two ErrorArrays of the same shape (n ≥ 2 units, K criteria):
 * epsilon[k] = max over ordered pairs i ≠ j of |ê_ijk − e_ijk| (the `epsilon` of selectionOnDraws), and at[k] =
 * { i, j } of the first largest difference in row-major (i, j) order.
 */
export declare function maxCoefficientError(Ehat: ErrorArray, E: ErrorArray): MaxCoefficientError;
