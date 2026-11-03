import { type ErrorArray, type Matrix } from "./pairwise.ts";
/** Canonical grade vector: labels 1..G, grade 1 = highest priority, one entry per unit. */
export type Grade = number[];
/** A declared report family. */
export type Family = {
    kind: "all";
} | {
    kind: "atMost";
    G: number;
} | {
    kind: "exactly";
    G: number;
} | {
    kind: "order";
    /** unit indices, top first (a permutation of 0..n−1) */
    order: readonly number[];
    /** at most G grades */
    G?: number;
    /** exactly this many grades */
    exact?: number;
    /** sizes of the indivisible consecutive blocks along `order` (equal order scores); they sum to n */
    blocks?: readonly number[];
};
export interface Disclosure {
    M: number;
    N: number;
    s: number;
    G: number;
    /** grade sizes, grade 1 first */
    sizes: number[];
    /** M − N: the pairs inside a grade, whose direction the report withholds */
    withheld: number;
}
export interface UnitRelationCounts {
    n: number;
    /** n − 1: the pairs each unit belongs to */
    partners: number;
    /** above[i]: units j with g_i < g_j (i is stated above j) */
    above: number[];
    /** below[i]: units j with g_i > g_j (i is stated below j) */
    below: number[];
    /** above + below: the directions the report states about unit i */
    stated: number[];
    /** the other units of unit i's grade: the pairs with i whose direction is withheld */
    withheld: number[];
}
export interface WeakRelation {
    /** z[i][j] = 1 if g_i ≤ g_j, else 0 (i ≠ j); NaN diagonal */
    z: Matrix;
    /** z_ij + z_ji ≥ 1 for every pair */
    complete: boolean;
    /** z_ij + z_jk − z_ik ≤ 1 for every triple of distinct units */
    transitive: boolean;
}
/** Row-order keys for a report card. `expectedRank`: smaller first; `mean`: larger first. */
export interface CardSummaries {
    ids?: readonly string[];
    expectedRank?: ArrayLike<number>;
    mean?: ArrayLike<number>;
}
export type CardSort = "grade" | "expected_rank" | "mean" | "label";
export interface ScoreOrderOptions {
    /** "descending" (default): a larger score is higher priority; "ascending": a smaller score is */
    direction?: "descending" | "ascending";
    /** entity ids (distinct strings) for the tie order; default A, B, … / U01, … (index order) */
    ids?: readonly string[];
}
export interface ScoreOrder {
    /** unit indices from highest to lowest priority */
    order: number[];
    /** sizes of the runs of exactly equal scores along `order` (sum n) */
    blocks: number[];
}
export interface StatedAgainstOptions {
    /** "descending" (default): a larger score is the better position; "ascending": a smaller one is */
    direction?: "descending" | "ascending";
}
export interface StatedAgainstPair {
    /** the unit the report states higher */
    above: number;
    /** the unit stated below it although its score is better */
    below: number;
}
export interface StatedAgainst {
    count: number;
    /** stated pairs whose scores run the other way (strictly), in pair order (0, 1), (0, 2), …, (1, 2), … */
    pairs: StatedAgainstPair[];
    /** ascending indices of the units that appear as `below` in some pair */
    units: number[];
}
/** i's relation to j in a report. */
export type PairRelation = "above" | "below" | "withheld";
export interface RelationChangeOptions {
    /** criterion weights for the stated error of a changed pair (only with E); default [1] when K = 1 */
    w?: readonly number[];
}
export interface RelationChangePair {
    i: number;
    j: number;
    /** i's relation to j under g0 */
    from: PairRelation;
    /** i's relation to j under g1 */
    to: PairRelation;
    /** the stated error under g1 (ebar_ij if i above j, ebar_ji if j above i); null when g1 withholds or E is null */
    error: number | null;
}
export interface RelationChange {
    M: number;
    /** pairs with the same relation in both reports */
    nSame: number;
    /** withheld by g0, stated by g1 */
    nNewDisclosed: number;
    /** stated by g0, withheld by g1 */
    nNewWithheld: number;
    /** stated in opposite directions */
    nReversed: number;
    /** newly disclosed + newly withheld + reversed */
    changed: number;
    /** changed / M */
    changeShare: number;
    /** nSame / M */
    agreement: number;
    /** the changed pairs, in pair order */
    pairs: RelationChangePair[];
}
export interface CutGradeOptions {
    /** unit indices from the top position down (a permutation of 0…n−1); default the identity */
    order?: readonly number[] | null;
    /** position ranges [from, to] (1-based, inclusive) that must share a grade */
    blocks?: readonly (readonly number[])[] | null;
}
/** Canonical grade of a report on n units (n ≥ 2), with a length check against the probabilities. */
export declare function reportGrade(g: ArrayLike<number>, n?: number): Grade;
/** M, N, G, grade sizes and withheld = M − N of a canonical grade vector. */
export declare function counts(c: readonly number[]): Disclosure;
/**
 * Labels renumbered 1..G in order of priority: the smallest input label becomes grade 1, the next smallest
 * grade 2, and so on (canonical_postrank_grade()). Every pair relation is preserved. Labels must be integers.
 */
export declare function canonicalGrade(g: ArrayLike<number>): Grade;
/** M = n(n − 1)/2, the number of unordered pairs. */
export declare function pairCount(n: number): number;
/** Counts of a report: M, N (pairs in different grades), s = N/M, G, grade sizes (grade 1 first) and withheld = M − N
 *  (the pairs inside a grade; v3 Part 1 supplement). */
export declare function disclosure(g: ArrayLike<number>): Disclosure;
/** Matrix of +1 (row stated above column), 0 (withheld, or the diagonal) and −1 (row stated below column). */
export declare function relations(g: ArrayLike<number>): Matrix;
/**
 * Per unit, the relations a report states about it: above[i] = #{j : g_i < g_j} (i stated above j),
 * below[i] = #{j : g_i > g_j}, stated = above + below, withheld = #{j ≠ i : g_j = g_i} (the other units of its
 * grade), and partners = n − 1 = stated + withheld. These are the row counts of `relations(g)`.
 */
export declare function unitRelationCounts(g: ArrayLike<number>): UnitRelationCounts;
/** The weak relation z_ij = 1{g_i ≤ g_j} (i ≠ j; NaN diagonal) with its completeness and transitivity checks. */
export declare function weakRelation(g: ArrayLike<number>): WeakRelation;
/** Exact family size as a BigInt (validates the family; unknown keys throw). Internal; see familySize. */
export declare function familySizeExact(n: number, family: Family): bigint;
/**
 * Exact number of reports in a family of reports on n units: a number, or a BigInt when it exceeds
 * Number.MAX_SAFE_INTEGER (2^53 − 1). Empty families (a cap below 1, an exact count outside 1..n) give 0.
 * A family key that does not belong to its kind throws.
 */
export declare function familySize(n: number, family: Family): number | bigint;
/**
 * The declared order and indivisible blocks of a score vector, exactly as postrank_cuts() builds them: units
 * sorted by score (`direction`, default "descending": larger first), equal scores in entity-id code-point order
 * (R's radix sort; `ids` default A, B, … / U01, …, which is index order), and every run of exactly equal scores
 * (no epsilon) one block. Pass the result to fixedOrderDP or orderHull, or give them `scores` directly.
 */
export declare function scoreOrder(scores: ArrayLike<number>, options?: ScoreOrderOptions): ScoreOrder;
/**
 * Row order of a report card (unit indices), with the package's rules (postrank_report_card(),
 * postrank_plot_report_card()): grades stay contiguous, grade 1 first; within a grade
 *   "grade"          keeps the input order (the stored card order),
 *   "expected_rank"  smaller summaries.expectedRank first (pass the weighted expected rank),
 *   "mean"           larger summaries.mean first (one criterion's posterior mean),
 *   "label"          unit id order;
 * remaining ties are broken by unit id in code-point order (R's radix sort). Ids default to A, B, … / U01, ….
 */
export declare function reportCardRows(g: ArrayLike<number>, summaries?: CardSummaries, sort?: CardSort): number[];
/**
 * Stated directions that run against a score order: a pair i < j is listed when the report states a direction
 * (g_i ≠ g_j) and the scores order the two strictly the other way ("descending": the unit stated above has the
 * smaller score). Equal scores are never against. `units`: the units stated below a unit with a worse score.
 */
export declare function statedAgainst(g: ArrayLike<number>, scores: ArrayLike<number>, options?: StatedAgainstOptions): StatedAgainst;
/**
 * How the pair relations change from report g0 to report g1 (postrank_compare()$relations): for each pair i < j,
 * r = sign(g_j − g_i) (+1: i above j, 0: withheld); same, newly disclosed (0 → stated), newly withheld (stated → 0)
 * or reversed. `pairs` lists the changed pairs with the error g1 states (ebar as in statedAbove; null without E).
 */
export declare function relationChange(g0: ArrayLike<number>, g1: ArrayLike<number>, E?: ErrorArray | null, options?: RelationChangeOptions): RelationChange;
/**
 * Grade vector from cut positions along an order: a cut c (1 ≤ c ≤ n − 1, strictly increasing) falls after the
 * c-th unit of `order` (default the identity), and the unit at position p (1-based) gets grade 1 + #{cuts < p}.
 * `blocks` lists position ranges [from, to] (1-based, inclusive) that must share a grade: a cut with
 * from ≤ c < to throws a RangeError naming the block. n 12, cuts [4, 8] → sizes 4/4/4.
 */
export declare function cutGrade(n: number, cuts: readonly number[], options?: CutGradeOptions): Int8Array;
