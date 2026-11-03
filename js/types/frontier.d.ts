import type { ErrorArray } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type CloudPoint, type CloudRow, type EmptyResult, type FamilyLabel, type OrderInputs } from "./optimize.ts";
/** orderHull limits (E-13): without a cap at most 150 units; with a cap or exact count at most 5·10⁷ table
 *  cells H·m·M (H grade layers, m blocks, M pairs). */
export declare const ORDER_HULL_BUDGET: Readonly<{
    maxUnitsUncapped: number;
    maxCells: number;
}>;
export interface CloudOptions {
    w?: readonly number[];
    /** default { kind: "all" } */
    family?: Family;
    /** risk-scale tolerance for choosing the lexicographically first report at the smallest Ew; default 1e-12 */
    tieTol?: number;
}
export interface ReportCloud {
    empty: false;
    n: number;
    M: number;
    K: number;
    w: number[];
    family: FamilyLabel;
    containsAllWithheld: boolean;
    /** one row per attained N, ascending: { N, minEw, maxEw, count, minGrade, maxGrade } */
    byN: CloudRow[];
    /** every report { grade, N, Ew } in lexicographic order, only when the family has at most 5,000 reports */
    points: CloudPoint[] | null;
    tieTol: number;
    label: "exact-within-family";
}
export interface HullVertex {
    N: number;
    Ew: number;
    /** one report attaining the vertex (null when the input points carried none) */
    grade: Grade | null;
}
/** A point for lowerHull: { N, Ew } or a cloud row { N, minEw }, with an optional grade. */
export interface HullInput {
    N: number;
    Ew?: number;
    minEw?: number;
    grade?: Grade | null;
    minGrade?: Grade | null;
}
export interface SupportingVertex {
    /** the tied vertex with the smallest N */
    vertex: HullVertex;
    /** every vertex whose risk is within tieTol of the smallest (Ew − τN within tieTol·M), ascending N */
    vertices: HullVertex[];
    /** min Ew − τN (risk = τ + value/M) */
    value: number;
}
export interface MatchedDisclosure {
    /** the matched disclosure m */
    N: number;
    /** H(m) */
    H: number;
    /** weight on the upper vertex; 0 when m is a vertex */
    psi: number;
    lower: HullVertex;
    upper: HullVertex;
    /** the best single report with exactly N disclosed pairs; null when no report (or no cloud) has that N */
    best: {
        grade: Grade;
        Ew: number;
    } | null;
    /** best.Ew − H(m) ≥ 0; null when best is null */
    gap: number | null;
}
export interface OrderHullOptions extends OrderInputs {
    w?: readonly number[];
    /** risk tolerance of the hull (points within tieTol·M of a chord are not vertices); default 1e-12 */
    tieTol?: number;
}
export interface HullOptions {
    /** risk tolerance (default 1e-12), converted to count units with M */
    tieTol?: number;
    /** pairs M = n(n − 1)/2; default from the cloud or from a vertex grade */
    M?: number;
}
export interface HalfSlopeInput {
    family: Family;
    /** no latent ties on the positive-weight criteria (true/false), or one flag per criterion */
    tieFree: boolean | readonly boolean[];
    /** with per-criterion `tieFree`: the weights (or flags) marking the criteria whose ties matter */
    positiveWeights?: readonly (number | boolean)[];
}
export interface ReportsAtNOptions {
    w?: readonly number[];
    /** default { kind: "all" } */
    family?: Family;
    /** the number of stated pairs (an integer ≥ 0) */
    N: number;
    /** how many reports to return (an integer ≥ 1); default 1 */
    k?: number;
    /** two values of Ew within tieTol·(1 + |Ew|) keep enumeration order; default 1e-12 */
    tieTol?: number;
}
export interface ReportsAtN {
    family: FamilyLabel;
    N: number;
    /** reports of the family with exactly N stated pairs */
    count: number;
    /** the k of them with the smallest Ew (ties in enumeration order); empty when count = 0 */
    reports: {
        grade: Grade;
        Ew: number;
    }[];
    tieTol: number;
    label: "exact-within-family";
}
export interface RuleGapOptions {
    w?: readonly number[];
    /** vertices of H(m) as lowerHull returns them (ascending N) */
    hull: readonly HullVertex[];
    /** gap is set to 0 when |Ew − H| ≤ tieTol·M; default 1e-12 */
    tieTol?: number;
}
export interface RuleGap {
    /** stated pairs of the report */
    N: number;
    /** Σ_k w_k E_k of the report */
    Ew: number;
    /** the lower hull at N */
    H: number;
    /** Ew − H, set to 0 within tieTol·M */
    gap: number;
    /** weight on the lower vertex, (N_b − N)/(N_b − N_a); null when N is a vertex */
    psi: number | null;
    lower: HullVertex;
    upper: HullVertex;
    /** gap === 0 */
    onFrontier: boolean;
}
/**
 * Every report of an enumerable family as (N, Ew), summarized per N: smallest and largest Ew, count, and the
 * lexicographically first report at each extreme. Full points only when the family has ≤ 5,000 reports.
 */
export declare function reportCloud(E: ErrorArray, options?: CloudOptions): ReportCloud | EmptyResult<"exact-within-family">;
/**
 * Vertices of the lower convex hull H(m) of a cloud (its per-N minima) or of a list of points, ascending N.
 * Points on a hull edge (within tieTol·M, risk scale; M from the cloud, options.M or the vertex grades, else
 * 1e-12·max(1, |Ew|)) are not vertices. Each vertex carries one report attaining it. An empty cloud gives [].
 */
export declare function lowerHull(cloud: ReportCloud | readonly HullInput[], options?: HullOptions): HullVertex[];
/**
 * The hull vertex (or vertices) touched by the supporting line of slope τ: the minimizers of Ew − τN, every
 * vertex whose risk is within `tieTol` (risk scale, default 1e-12) of the smallest, that is within tieTol·M in
 * count units (M from options.M or the vertex grades; required when the vertices carry no grade), ascending N.
 */
export declare function supportingVertex(hull: readonly HullVertex[], tau: number, options?: HullOptions): SupportingVertex;
/**
 * H at disclosure N (a real number between the smallest and largest N of the hull) by linear interpolation
 * between the adjacent vertices, the mixing weight ψ = (N − N₋)/(N₊ − N₋) on the upper vertex (0 at a vertex),
 * and the best single report with exactly N disclosed pairs from the cloud (null when there is none).
 */
export declare function matchedDisclosure(cloud: ReportCloud | null, hull: readonly HullVertex[], N: number): MatchedDisclosure;
/**
 * Lower hull of the contiguous cuts of one declared order (optionally at most G or exactly `exact` grades,
 * with indivisible `blocks`; the order from `order`, `scores` or `family` as fixedOrderDP): an exact DP along
 * the withheld-pair count gives the smallest Ew at every attainable N, then the hull is taken. No enumeration,
 * but the table has H·m·M cells, so it is refused above ORDER_HULL_BUDGET (E-13): more than 150 units without a
 * cap, or more than 5·10⁷ cells with one. An empty family returns `{ empty: true, family }`.
 */
export declare function orderHull(E: ErrorArray, options: OrderHullOptions): HullVertex[] | EmptyResult<"optimal-within-order">;
/**
 * Whether the half-slope endpoint (every hull edge slope in [0, 1/2], a strict optimum at τ = 1/2) is
 * guaranteed: only for the full family 𝒜_n (kind "all") with no latent ties on positive-weight criteria.
 * `tieFree` may be one flag, or one flag per criterion together with `positiveWeights` (only criteria with a
 * positive weight must be tie-free).
 */
export declare function halfSlopeEligible(input: HalfSlopeInput): boolean;
/**
 * The reports of an enumerable family with exactly N stated pairs (Step 7.1): their number and the k with the
 * smallest Ew, in one pass (ties within tieTol·(1 + |Ew|) keep enumeration order, as bestReports). Ew is
 * evaluateReport's. `reports` is empty when no report has that N.
 */
export declare function reportsAtN(E: ErrorArray, options: ReportsAtNOptions): ReportsAtN;
/**
 * How far a report lies above the lower hull H(m) at its own disclosure (Step 7.1): N and Ew of the report
 * (evaluateReport), H at N (the vertex at N, or the mixture of the adjacent vertices with weight
 * psi = (N_b − N)/(N_b − N_a) on the lower one), gap = Ew − H set to 0 when |Ew − H| ≤ tieTol·M, and
 * onFrontier = (gap === 0). N outside the hull's range throws.
 */
export declare function ruleGap(g: ArrayLike<number>, E: ErrorArray, options: RuleGapOptions): RuleGap;
