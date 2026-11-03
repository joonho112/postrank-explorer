import { type ErrorArray } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type ReportEvaluation } from "./risk.ts";
/** Exact enumeration limits: at most `maxReports` reports in the family and at most `maxUnits` units. */
export declare const ENUMERATION_BUDGET: Readonly<{
    maxReports: number;
    maxUnits: number;
}>;
/** Above this many reports reportCloud() returns no full point list. */
export declare const CLOUD_POINTS_LIMIT = 5000;
/** A family as shown with a result: symbol, words and exact size. */
export interface FamilyLabel {
    /** badge form, e.g. "𝒜₆", "𝒜_≤3", "𝒜_=2", "𝒜ᵨ,≤4"; with budgets "𝒜_q (𝒜_≤3)" */
    name: string;
    /** the family in words, e.g. "reports with at most 3 grades" */
    words: string;
    /** number of reports in the family (after any budgets or pair constraints): a number up to 2^53, else a
     *  decimal string */
    size: number | string;
    /** the same count as a BigInt (non-enumerable: JSON.stringify and deep-equality checks skip it) */
    readonly sizeExact: bigint;
    /** with budgets or pair constraints: the size of the base family (number up to 2^53, else a decimal string) */
    baseSize?: number | string;
    /** with budgets only: q_k per criterion (null = no budget on k) */
    budgets?: (number | null)[];
}
/** The result of any optimizing function on an empty family (E-15). */
export interface EmptyResult<L extends string = string> {
    empty: true;
    family: FamilyLabel;
    containsAllWithheld: false;
    label: L;
}
export type EmptyOptimum = EmptyResult<"exact-within-family">;
export interface OptimumOptions {
    /** withholding cost, 0 < τ ≤ 1/2 */
    tau: number;
    /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
    w?: readonly number[];
    /** report family; default { kind: "all" } */
    family?: Family;
    /** error budgets: q[k] ≥ 0 restricts to E_k ≤ q_k N; null or undefined = no budget on criterion k */
    q?: readonly (number | null | undefined)[];
    /** risk tolerance for tied optima; default 1e-12 */
    tieTol?: number;
    /** at most this many tied optima are listed in `grades` (tieCount gives them all); default 100 */
    maxTies?: number;
}
/** Exact optimization after requiring each listed pair direction, within one ordinary report family. */
export interface PairConstrainedOptions {
    tau: number;
    w?: readonly number[];
    family?: Family;
    /** [i, j] requires g_i < g_j; duplicate entries are removed in first-occurrence order. */
    stating?: readonly (readonly number[])[];
    tieTol?: number;
    maxTies?: number;
}
export interface PairConstraintMetadata {
    /** The ordinary, unfiltered family, with its full candidate count. */
    baseFamily: FamilyLabel;
    /** Validated distinct-index pairs, with duplicates removed. */
    stating: [number, number][];
}
export type PairConstrainedOptimum = (ExactOptimum | EmptyOptimum | FixedOrderResult | EmptyResult<"optimal-within-order">) & PairConstraintMetadata;
export interface ExactOptimum {
    empty: false;
    /** the lexicographically first optimum; for an order family, the package's choice (fewer grades, then the
     *  earlier cut), as fixedOrderDP */
    grade: Grade;
    /** the optima within tieTol of the minimum risk, in lexicographic order (at most maxTies) */
    grades: Grade[];
    /** the number of optima within tieTol (grades.length < tieCount when the list was cut at maxTies) */
    tieCount: number;
    /** risk of `grade` (evaluateReport) */
    risk: number;
    N: number;
    G: number;
    Ew: number;
    E: number[];
    EoverN: (number | null)[];
    /** full evaluation of `grade` */
    evaluation: ReportEvaluation;
    family: FamilyLabel;
    /** the family contains the all-withheld report (so E ≤ τN holds at the optimum, CONTRACT 6.4) */
    containsAllWithheld: boolean;
    tieTol: number;
    label: "exact-within-family";
}
/** The declared order of fixedOrderDP and orderHull: top-level `order` (with G, exact, blocks), `scores`
 *  (+ direction, ids), or `family` ({ kind: "order", … }, or { kind: "atMost" | "exactly" | "all" } with a
 *  top-level order or scores). */
export interface OrderInputs {
    /** unit indices from highest to lowest priority (a permutation of 0..n−1) */
    order?: readonly number[];
    /** at most G grades (default: no cap) */
    G?: number;
    /** exactly this many grades */
    exact?: number;
    /** sizes of the indivisible runs of equal order scores along `order` (sum n); default all 1 */
    blocks?: readonly number[];
    /** the family: { kind: "order", order, G?, exact?, blocks? }, or a grade-count family with a top-level order */
    family?: Family;
    /** order scores instead of order and blocks: scoreOrder(scores, { direction, ids }) */
    scores?: ArrayLike<number>;
    /** with scores: "descending" (default) or "ascending" */
    direction?: "descending" | "ascending";
    /** with scores: entity ids for the tie order; default E.ids */
    ids?: readonly string[];
}
export interface FixedOrderOptions extends OrderInputs {
    tau: number;
    w?: readonly number[];
    /** return the DP table */
    trace?: boolean;
    /** risk tolerance for equal objectives (|ΔV| ≤ tieTol·M); default 1e-12; 0 = exact comparison as the package */
    tieTol?: number;
    /** at most this many tied optima in `grades`; default 100 */
    maxTies?: number;
}
export interface FixedOrderTrace {
    /** M = n(n − 1)/2 */
    M: number;
    /** T = W(0, n): the saving of withholding everything (all-singleton risk = τ + T/M) */
    T: number;
    /** block sizes along the order */
    blocks: number[];
    /** unit positions of the block boundaries, 0 … n (length m + 1) */
    boundaries: number[];
    /** W[a][b] for block boundaries a ≤ b (W[a][a] = 0); null for a > b */
    W: (number | null)[][];
    /** V[h][c] for h = 0..H and c = 0..m; null for infeasible states (−∞) */
    V: (number | null)[][];
    /** the chosen predecessor b of state (h, c); null when h = 0 or the state is infeasible */
    pred: (number | null)[][];
    /** risk of the best report with exactly h grades (index h; index 0 is null) */
    riskByG: (number | null)[];
    /** grade count of the returned report */
    chosenG: number;
    /** states visited by the backtrack, from (0, 0) to (chosenG, m) */
    path: {
        h: number;
        c: number;
    }[];
}
export interface FixedOrderResult {
    empty: false;
    /** the package's choice among the tied optima: fewer grades, then the earlier cut */
    grade: Grade;
    /** tied optima (at most maxTies): lexicographic grade order (gradesOrder "lexicographic", the same list as
     *  exactOptimum over this order family), or for very many ties the package's order of preference ("package") */
    grades: Grade[];
    gradesOrder: "lexicographic" | "package";
    /** number of tied optima: a number up to 2^53, else a decimal string (tieCountExact: the BigInt, non-enumerable) */
    tieCount: number | string;
    readonly tieCountExact: bigint;
    /** risk of `grade` (evaluateReport) */
    risk: number;
    N: number;
    G: number;
    Ew: number;
    E: number[];
    EoverN: (number | null)[];
    evaluation: ReportEvaluation;
    /** the declared order and its blocks (from `scores` when they were given) */
    order: number[];
    blocks: number[];
    /** cut positions along the order (number of units above each cut), increasing */
    cuts: number[];
    /** the same cuts in block positions (postrank_cuts()$cuts) */
    blockCuts: number[];
    /** total block saving V of the returned report */
    saving: number;
    family: FamilyLabel;
    /** the family contains the all-withheld report (no exact count above one), so E ≤ τN holds (CONTRACT 6.4) */
    containsAllWithheld: boolean;
    tieTol: number;
    label: "optimal-within-order";
    trace?: FixedOrderTrace;
}
export interface TauPathOptions {
    w?: readonly number[];
    family?: Family;
    tieTol?: number;
    /** at most this many reports in endpointOptima; default 100 */
    maxTies?: number;
}
export interface TauInterval {
    tauFrom: number;
    tauTo: number;
    /** the optimum on this interval (the lexicographically first report at this N with the smallest Ew) */
    grade: Grade;
    N: number;
    G: number;
    Ew: number;
    /** E_k per criterion */
    E: number[];
    /** E_k/N per criterion; null when N = 0 */
    EoverN: (number | null)[];
    /** Ew/N; null when N = 0 */
    EwOverN: number | null;
    /** risk at tauFrom and at tauTo (the risk is linear in τ) */
    riskFrom: number;
    riskTo: number;
}
export interface TauPath {
    empty: false;
    /** closed intervals covering (0, 1/2], ascending; a zero-length last interval [1/2, 1/2] when a different
     *  report becomes optimal exactly at τ = 1/2 */
    intervals: TauInterval[];
    /** every report optimal at τ = 1/2 (within tieTol), lexicographic, at most maxTies */
    endpointOptima: Grade[];
    /** the number of reports optimal at τ = 1/2 */
    endpointTieCount: number;
    family: FamilyLabel;
    containsAllWithheld: boolean;
    tieTol: number;
    label: "exact-within-family";
}
export interface WeightPathOptions {
    tau: number;
    family?: Family;
    /** first-criterion weights in [0, 1]; default 0, .05, …, 1 */
    grid?: readonly number[];
    tieTol?: number;
    /** at most this many tied optima per grid weight; default 100 */
    maxTies?: number;
}
export interface WeightPathPoint {
    w1: number;
    w: [number, number];
    grade: Grade;
    grades: Grade[];
    tieCount: number;
    risk: number;
    N: number;
    G: number;
    Ew: number;
    E: number[];
    EoverN: (number | null)[];
}
export interface WeightBreakpointsOptions {
    tau: number;
    family?: Family;
    tieTol?: number;
}
export interface WeightInterval {
    /** first-criterion weights w1 (w = (w1, 1 − w1)) */
    wFrom: number;
    wTo: number;
    /** the optimum on this interval (lexicographically first among reports at the same hull point) */
    grade: Grade;
    N: number;
    G: number;
    /** E_1 and E_2 */
    E: number[];
    EoverN: (number | null)[];
    /** risk at wFrom and at wTo (the risk is linear in w1) */
    riskFrom: number;
    riskTo: number;
}
export interface WeightBreakpoints {
    empty: false;
    /** closed intervals covering [0, 1], ascending; zero-length intervals at 0 or 1 when a different report is
     *  optimal exactly at that end */
    intervals: WeightInterval[];
    /** the interior breakpoints (where the optimum changes), ascending */
    breakpoints: number[];
    /** Maximum risk of the lower envelope, and the weights attaining it (risk ties use tieTol). */
    envelopeMaximum: {
        risk: number;
        intervals: {
            from: number;
            to: number;
        }[];
        tieTol: number;
    };
    tau: number;
    family: FamilyLabel;
    containsAllWithheld: boolean;
    tieTol: number;
    label: "exact-within-family";
}
export interface EnumerateOptions {
    /** yield the same buffer each time (no allocation); default false (a fresh Int8Array per report) */
    reuse?: boolean;
}
export interface BestReportsOptions {
    /** withholding cost, 0 < τ ≤ 1/2 */
    tau: number;
    /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
    w?: readonly number[];
    /** report family; default { kind: "all" } */
    family?: Family;
    /** how many reports to return (an integer ≥ 1); default 1 */
    k?: number;
    /** pairs [i, j], each meaning "i above j" (g_i < g_j): only reports that state all of them count */
    stating?: readonly (readonly number[])[];
    /** two risks within tieTol·(1 + |risk|) keep enumeration order; default 1e-12 */
    tieTol?: number;
}
export interface RankedReport {
    grade: Grade;
    /** evaluateReport(grade, E, { tau, w }).risk */
    risk: number;
    N: number;
    Ew: number;
}
export interface BestReports {
    family: FamilyLabel;
    /** reports of the family that state every listed pair */
    matched: number;
    /** the first k of them by risk (ties in enumeration order) */
    reports: RankedReport[];
    tieTol: number;
    label: "exact-within-family";
}
/** Error array prepared for enumeration: flat weighted errors and per-criterion errors (diagonal 0). */
export interface Prepared {
    n: number;
    K: number;
    M: number;
    w: number[];
    /** ebar[i * n + j] = Σ_k w_k e[k][i][j] */
    ebar: Float64Array;
    /** ek[k][i * n + j] = e[k][i][j] */
    ek: Float64Array[];
}
/** Validate E and w (through evaluateReport) and flatten the arrays. */
export declare function prepare(E: ErrorArray, w: readonly number[] | undefined): Prepared;
/** A tolerance option: finite and ≥ 0; default 1e-12. */
export declare function checkTol(x: number | undefined, name: string): number;
/** A family label { name, words, size, budgets? } with sizeExact attached (non-enumerable). */
export declare function makeLabel(fields: Omit<FamilyLabel, "size" | "sizeExact">, size: bigint): FamilyLabel;
/** Name, words and exact size of a family on n units (familySize validates the family). */
export declare function familyInfo(n: number, family: Family): FamilyLabel;
/** Whether the family contains the all-withheld report 1/1/…/1 (it passes every budget). */
export declare function familyHasAllWithheld(n: number, family: Family): boolean;
/** The result of an optimizing function on an empty family. */
export declare function emptyResult<L extends string>(family: FamilyLabel, label: L): EmptyResult<L>;
/** Throw unless the family fits the enumeration budget (n ≤ 20 units and at most 600,000 reports). */
export declare function checkEnumerable(n: number, info: FamilyLabel, family?: Family): void;
/** A walk over the reports of a family: after next() returns true, g holds the report, N its disclosure
 *  and sum(c) its sum over stated pairs (g_i < g_j) of channel c (an n × n flat array). */
export interface ReportStream {
    readonly g: Int8Array;
    N: number;
    next(): boolean;
    sum(c: number): number;
}
/** A walk over a validated, nonempty family that fits the enumeration budget. */
export declare function createWalker(n: number, family: Family, channels: Float64Array[]): ReportStream;
/**
 * The tied optima of a walk, in walk (lexicographic) order: every report whose value is within `tol` of the
 * smallest value seen. Reports are packed into one growing Int8Array, so even a family where every report ties
 * (545,835 reports of n = 8 at equal means) costs a few megabytes, never an object per report (E-3).
 */
export declare class TieCollector {
    /** the smallest value pushed so far */
    best: number;
    private readonly n;
    private readonly tol;
    private prunedAt;
    private len;
    private g;
    private z;
    constructor(n: number, tol: number);
    push(g: ArrayLike<number>, z: number): void;
    private compact;
    /** Visit every tied report (a view into the buffer) in walk order. */
    forEach(f: (g: Int8Array, z: number) => void): void;
    /** The number of tied reports. */
    count(): number;
    /** The first `max` tied reports as grade vectors. */
    first(max: number): Grade[];
}
/**
 * The k smallest keys of a walk with tolerant ties, in one pass (Step 7.1: bestReports, reportsAtN). The order is
 * the greedy one: repeatedly take, among the reports not yet taken, the first in walk order whose key is within
 * tol·(1 + |m|) of the smallest remaining key m. Exact ties and clear separations give the plain sort by
 * (key, walk order); a near-tie run within the tolerance keeps walk order. Only reports whose key is within the
 * tolerance of the k-th smallest key seen so far are kept (packed, as in TieCollector), so memory stays small
 * unless very many reports tie.
 */
export declare class KBest {
    private readonly n;
    private readonly k;
    private readonly tol;
    /** max-heap of the k smallest keys seen */
    private readonly heap;
    private heapSize;
    private len;
    private compactAt;
    private g;
    private z;
    constructor(n: number, k: number, tol: number);
    private threshold;
    private heapPush;
    push(g: ArrayLike<number>, key: number): void;
    private compact;
    /** The first k reports in the greedy tolerant order: { grade, key }. */
    result(): {
        grade: Grade;
        key: number;
    }[];
}
/** k: an integer ≥ 1; default 1. */
export declare function checkK(x: number | undefined, fn: string): number;
/** Per-N summary of a family: smallest and largest Ew, count, and the lexicographically first report at the
 *  smallest (largest) Ew within tieTol·M. */
export interface CloudRow {
    N: number;
    minEw: number;
    maxEw: number;
    count: number;
    minGrade: Grade;
    maxGrade: Grade;
}
export interface CloudPoint {
    grade: Grade;
    N: number;
    Ew: number;
}
/**
 * One pass over an enumerable family: per-N rows (ascending N) and, if asked, every point; `half` also collects
 * the reports optimal at τ = 1/2 (value Ew − N/2). minGrade (maxGrade) is the lexicographically first report
 * with Ew within tieTol·M of the final minimum (maximum) at its N: when a run of near-ties moves the minimum so
 * that the stored report falls out of the band, that N is settled exactly by a second pass (E-19).
 */
export declare function scanCloud(P: Prepared, family: Family, tieTol: number, withPoints: boolean, half?: TieCollector): {
    rows: CloudRow[];
    points: CloudPoint[] | null;
};
/**
 * Indices of the vertices of the lower convex hull of points (x[i], y[i]) with increasing x (monotone chain).
 * A point that lies on or above the chord of its neighbours, or below it by at most `tol` (in y units), is not
 * a vertex. Default tol: 1e-12·max(1, |y|) of the chord's ends.
 */
export declare function lowerHullIndices(x: ArrayLike<number>, y: ArrayLike<number>, tol?: number): number[];
/**
 * The declared-order family of fixedOrderDP and orderHull (E-2, E-8): top-level `order` (with G, exact,
 * blocks), or `scores` (+ direction, ids; ids default E.ids) in place of order and blocks, or `family` — either
 * { kind: "order", order, G?, exact?, blocks? } or a grade-count family ({ kind: "atMost", G },
 * { kind: "exactly", G } or { kind: "all" }) together with a top-level order or scores. Anything given twice throws.
 */
export declare function resolveOrderFamily(n: number, o: OrderInputs, E: ErrorArray, fn: string): Extract<Family, {
    kind: "order";
}>;
/**
 * Every report of a family on n units as canonical grade vectors (labels 1..G, grade 1 highest) in
 * lexicographic order. A generator over Int8Array: nothing is materialized. With `reuse: true` the same buffer
 * is yielded each time (copy it to keep it). Families above the enumeration budget (n > 20 or more than
 * 600,000 reports) are refused when the generator is created; an empty family yields nothing.
 */
export declare function enumerateReports(n: number, family?: Family, options?: EnumerateOptions): Generator<Int8Array, void, undefined>;
/**
 * Exact optimum by exhaustive enumeration of a family (label "exact-within-family"): every report whose risk
 * is within `tieTol` (risk scale, default 1e-12) of the minimum, in lexicographic order (`grades`, at most
 * `maxTies`, default 100; `tieCount` counts them all). `grade` is the first of them, except for an order family,
 * where it is the package's choice (fewer grades, then the earlier cut), as fixedOrderDP. With budgets `q` the
 * family is restricted to E_k ≤ q_k N (N = 0 passes). An empty family returns `{ empty: true, family }`.
 * Refuses families above the enumeration budget (n ≤ 20 units, at most 600,000 reports).
 */
export declare function exactOptimum(E: ErrorArray, options: OptimumOptions): ExactOptimum | EmptyOptimum;
/**
 * The exact optimum among reports stating every required direction. Non-order families keep the ordinary
 * enumeration budget and every minimizing tie; order families use the fixed-order DP with forbidden grade
 * segments, so no reports are enumerated. The feasible family count is independent of the optimal tie count.
 */
export declare function pairConstrainedOptimum(E: ErrorArray, options: PairConstrainedOptions): PairConstrainedOptimum;
/**
 * Optimal contiguous cuts of a declared order (label "optimal-within-order"; theory book ch. 14 interval-saving
 * DP) under at most `G` grades or exactly `exact` grades, with the package's tie rules (postrank_cuts(rule =
 * "optimal")): `blocks` of equal order scores are never split, equal objective → fewer grades, then the
 * lexicographically earlier cut vector. The order comes from `order`, `scores` (scoreOrder) or `family`
 * (resolveOrderFamily). `grades` lists the tied optima (at most maxTies) and `tieCount` counts them; the risk is
 * evaluateReport() of the returned grade. An empty family returns `{ empty: true, family }`.
 */
export declare function fixedOrderDP(E: ErrorArray, options: FixedOrderOptions): FixedOrderResult | EmptyResult<"optimal-within-order">;
/**
 * The optimum of an enumerable family as τ moves over (0, 1/2]: each report's risk is linear in τ, so the
 * optimum follows the lower convex hull of (N, min Ew), and the breakpoints are its edge slopes (exact up to
 * floating point). Intervals are closed and share their endpoints (both reports are optimal at a breakpoint);
 * the first starts at 0 (open) and the last ends at 1/2. A report that becomes optimal exactly at τ = 1/2 gets a
 * zero-length interval [1/2, 1/2] (E-17), and `endpointOptima` lists every report optimal at τ = 1/2. Along the
 * path N never decreases. An empty family returns `{ empty: true, family }`.
 */
export declare function tauPath(E: ErrorArray, options?: TauPathOptions): TauPath | EmptyOptimum;
/**
 * The exact optimum at each first-criterion weight w1 of `grid` (K = 2, w = (w1, 1 − w1)), over one
 * enumerable family at a fixed τ: one enumeration, then each grid point in a single pass. Ties within tieTol
 * (risk scale) are listed in lexicographic order (at most maxTies, with tieCount), as in exactOptimum. An empty
 * family returns `{ empty: true, family }`.
 */
export declare function weightPath(E: ErrorArray, options: WeightPathOptions): WeightPathPoint[] | EmptyOptimum;
/**
 * K = 2: exact breakpoints of the optimum of an enumerable family at fixed τ as the first weight w1 moves over
 * [0, 1] (w = (w1, 1 − w1); E-22). Each report's Z = E_2 − τN + w1(E_1 − E_2) is linear in w1, so the optimum
 * follows the lower hull of the points (E_2 − E_1, E_2 − τN) and the breakpoints are its edge slopes. Intervals
 * are closed and share their endpoints, as in tauPath; a report optimal exactly at w1 = 0 or w1 = 1 only gets a
 * zero-length interval there. Ties within tieTol (risk scale). An empty family returns `{ empty: true, family }`.
 */
export declare function weightBreakpoints(E: ErrorArray, options: WeightBreakpointsOptions): WeightBreakpoints | EmptyOptimum;
/**
 * The k reports of an enumerable family with the smallest risk (Step 7.1), optionally only those that state every
 * listed pair (`stating`: [i, j] = "i above j", g_i < g_j). One pass over the family as exactOptimum walks it
 * (same families and budget); risks within tieTol·(1 + |risk|) keep enumeration (lexicographic) order (KBest).
 * `matched` counts the reports that pass the filter; each listed report carries evaluateReport's risk, N and Ew.
 */
export declare function bestReports(E: ErrorArray, options: BestReportsOptions): BestReports;
