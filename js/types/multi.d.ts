import { type ErrorArray, type LabelOptions, type Matrix, type UnitTable } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type PairDecision } from "./risk.ts";
import { type EmptyResult, type ExactOptimum, type FamilyLabel } from "./optimize.ts";
export interface ConflictPair {
    i: number;
    j: number;
    /** criteria on which i is more likely above j (e_ij,k < e_ji,k) */
    iAbove: number[];
    /** criteria on which j is more likely above i (e_ij,k > e_ji,k) */
    jAbove: number[];
}
export interface ConflictPairs {
    count: number;
    /** pairs i < j, ordered by i then j */
    pairs: ConflictPair[];
}
export interface CommonalityOptions {
    tau: number;
    w?: readonly number[];
    /** default { kind: "all" } */
    family?: Family;
    tieTol?: number;
    /** at most this many tied optima per list (common.grades, ownGrades); default 100 */
    maxTies?: number;
}
export interface CommonalityRow {
    k: number;
    criterion: string;
    /** the common report's weight on criterion k */
    weight: number;
    /** R_k of the common report */
    commonRk: number;
    /** the first of criterion k's own optima (lexicographic) */
    ownGrade: Grade;
    /** the own optima within tieTol (weight e_k, same τ and family), lexicographic, at most maxTies */
    ownGrades: Grade[];
    /** the number of own optima */
    ownTieCount: number;
    /** R_k of the own optimum, its minimum within the family */
    ownRk: number;
    ownN: number;
    ownG: number;
    /** Δ_k = max(0, commonRk − ownRk) */
    delta: number;
    /** share of unordered pairs with the same relation (above, shared, below) in ownGrade and the common grade */
    relationAgreement: number;
}
export interface CommonalityCost {
    empty: false;
    /** the common exact optimum under w */
    common: ExactOptimum;
    family: FamilyLabel;
    tau: number;
    w: number[];
    criteria: CommonalityRow[];
    /** Each retained common optimum, in common.grades order, compared with the same own optima. */
    commonReports: CommonalityReport[];
    containsAllWithheld: boolean;
    label: "exact-within-family";
}
export interface CommonalityReport {
    grade: Grade;
    Rk: number[];
    /** max(0, Rk[k] − criteria[k].ownRk), in criterion order */
    delta: number[];
    /** pair-relation agreement with criteria[k].ownGrade, in criterion order */
    relationAgreement: number[];
}
export interface EstimandOptions extends LabelOptions {
    /** error weights w_k (≥ 0, sum 1) of the criterion-direction loss */
    w?: readonly number[];
    /** composite coefficients a_k (any finite numbers) */
    a: readonly number[];
    tau: number;
    /** positive multiplier s_k applied to criterion k before the composite (criterion k is multiplied by
     *  multiplier[k]); default all 1. The package's postrank_composite(scales =) divides: multiplier = 1/scales */
    multiplier?: readonly number[];
    /** the pair (i, j) whose three costs are returned; default [0, 1] */
    pair?: readonly [number, number] | readonly number[];
}
export interface EstimandCosts {
    pair: [number, number];
    /** c_i = Σ_k a_k s_k θ_ik for every unit */
    c: number[];
    /** costs of i above j, j above i and withholding under the weighted criterion-direction loss, and the best */
    criterionLoss: PairDecision;
    /** the same under the composite-direction loss */
    compositeLoss: PairDecision;
    /** the known state as an ErrorArray: e[k][i][j] = 1{θ_ik ≤ θ_jk} (pass to exactOptimum with w) */
    criterionE: ErrorArray;
    /** the composite as a one-criterion ErrorArray: e[0][i][j] = 1{c_i ≤ c_j} */
    compositeE: ErrorArray;
}
export interface BudgetFamilyOptions {
    tau: number;
    w?: readonly number[];
    family?: Family;
    /** q[k] ≥ 0, or null/undefined for no budget on criterion k */
    q?: readonly (number | null | undefined)[];
    tieTol?: number;
    /** at most this many tied optima in optimum.grades; default 100 */
    maxTies?: number;
}
export interface BudgetFamily {
    empty: boolean;
    /** number of reports in the family that meet every budget */
    size: number;
    /** size of the base family (number up to 2^53, else a decimal string) */
    baseSize: number | string;
    family: FamilyLabel;
    /** the exact optimum within the budget family; null when it is empty */
    optimum: ExactOptimum | null;
    /** the members (lexicographic) when the base family has at most 5,000 reports; otherwise null */
    members: Grade[] | null;
    /** the budget family contains the all-withheld report (it meets every budget whenever the base has it) */
    containsAllWithheld: boolean;
    label: "exact-within-family";
}
export interface BudgetRow {
    k: number;
    criterion: string;
    q: number;
    E: number;
    N: number;
    qN: number;
    /** E_k/N; null when N = 0 */
    EoverN: number | null;
    /** qN − E (≥ 0 when the budget is met) */
    slack: number;
    /** E ≤ qN (absolute tolerance 1e-12; N = 0 passes) */
    meets: boolean;
}
export interface BudgetCheck {
    /** one row per criterion with a budget, in criterion order */
    rows: BudgetRow[];
    /** every row meets its budget */
    meets: boolean;
}
export interface CriterionMixtureRisk {
    /** Σ_k w_k R_k */
    risk: number;
    Rk: number[];
    w: number[];
    /** evaluateReport risk (Ew + τ(M − N))/M */
    weightedRisk: number;
    /** risk − weightedRisk (0 up to rounding) */
    difference: number;
}
export interface MinimaxOptions {
    tau: number;
    w?: readonly number[];
    family?: Family;
    /** criteria included in the maximum (indices or criterion ids); default every criterion */
    criteria?: readonly (number | string)[];
    tieTol?: number;
    /** at most this many tied optima per list; default 100 */
    maxTies?: number;
}
export interface MinimaxReport {
    grade: Grade;
    N: number;
    Rk: number[];
    /** max of Rk over the included criteria */
    max: number;
    /** Σ_k w_k R_k */
    weighted: number;
}
export interface MinimaxChoice {
    empty: false;
    family: FamilyLabel;
    tau: number;
    w: number[];
    /** the included criteria (indices, ascending) */
    included: number[];
    /** every report of the family with its criterion risks, when the family has at most 5,000 reports; else null */
    reports: MinimaxReport[] | null;
    /** the weighted optimum (exactOptimum) */
    weighted: {
        grade: Grade;
        grades: Grade[];
        tieCount: number;
        risk: number;
        Rk: number[];
        max: number;
    };
    /** the minimax optimum: smallest largest included R_k, ties within tieTol listed lexicographically (at most
     *  maxTies; tieCount counts them all) */
    minimax: {
        grade: Grade;
        grades: Grade[];
        tieCount: number;
        value: number;
        Rk: number[];
        weightedRisk: number;
    };
    containsAllWithheld: boolean;
    tieTol: number;
    label: "exact-within-family";
}
export interface WeightCrossingOptions {
    tau: number;
}
/**
 * Pairs i < j whose more likely direction differs across criteria (E-10): on criterion k, i is more likely above
 * j when e[k][i][j] < e[k][j][i] and j above i when e[k][i][j] > e[k][j][i] (the smaller error marks the more
 * likely direction; equal within tieTol, default 1e-12, favours neither). Correct under latent ties, where
 * e_ij + e_ji exceeds 1.
 */
export declare function conflictPairs(E: ErrorArray, options?: {
    tieTol?: number;
}): ConflictPairs;
/** ebar_ij = Σ_k w_k e[k][i][j] (compensated), an n × n matrix with a NaN diagonal; w defaults to [1] when K = 1. */
export declare function weightedError(E: ErrorArray, w?: readonly number[]): Matrix;
/**
 * The cost of a common grade for each criterion (postrank_commonality_cost(), vignette m2; "package quantity"):
 * the common exact optimum under w, each criterion's own exact optima in the same family (weight e_k, same τ;
 * tied optima listed up to maxTies), and Δ_k = max(0, R_k(common) − R_k(own)). Both solves are exhaustive
 * enumerations, so a family above the enumeration budget throws (case pages read the archived costs); an empty
 * family returns `{ empty: true, family }`.
 */
export declare function commonalityCost(E: ErrorArray, options: CommonalityOptions): CommonalityCost | EmptyResult<"exact-within-family">;
/**
 * Action costs for one pair at a known state `state[i][k]` (ch. 12): under the weighted criterion-direction
 * loss, stating i above j costs Σ_k w_k 1{θ_ik ≤ θ_jk}; under the composite-direction loss it costs
 * 1{c_i ≤ c_j} with c_i = Σ_k a_k s_k θ_ik (s = `multiplier`: criterion k is multiplied by multiplier[k] > 0;
 * the package's scales divide, so multiplier = 1/scales; a need not lie on the simplex); withholding costs τ.
 * Also returns both losses as ErrorArrays of the whole state, so exactOptimum(criterionE, { tau, w }) and
 * exactOptimum(compositeE, { tau }) give each loss's report.
 */
export declare function estimandCosts(state: UnitTable, options: EstimandOptions): EstimandCosts;
/**
 * The reports of a family that meet every error budget E_k ≤ q_k N (N = 0 passes): their number, the exact
 * optimum among them (exactOptimum with q), or empty; the members themselves when the base family has at most
 * 5,000 reports. Refuses families above the enumeration budget.
 */
export declare function budgetFamily(E: ErrorArray, options: BudgetFamilyOptions): BudgetFamily;
/**
 * Budget rows E_k ≤ q_k N for a displayed report (a feasibility check, not an optimization): one row per
 * criterion with a budget (q_k ≥ 0; null or undefined = none), with E_k, N, q_k N, E_k/N, slack and whether it
 * is met (absolute tolerance 1e-12, as exactOptimum; N = 0 passes).
 */
export declare function budgetCheck(g: ArrayLike<number>, E: ErrorArray, q: readonly (number | null | undefined)[]): BudgetCheck;
/**
 * The weighted risk read as a criterion mixture (ch. 11 prp-criterion-mixture): Σ_k w_k R_k, the risk of a
 * criterion drawn with probabilities w, beside evaluateReport's risk (they agree up to rounding).
 */
export declare function criterionMixtureRisk(g: ArrayLike<number>, E: ErrorArray, options: {
    tau: number;
    w?: readonly number[];
}): CriterionMixtureRisk;
/**
 * Weighted and expected-criterion minimax choices within an enumerable family (ch. 13): the weighted optimum
 * (exactOptimum) and the report minimizing max_{k ∈ K+} R_k, with every report's criterion risks when the
 * family has at most 5,000 reports. K+ (`criteria`, indices or ids) defaults to every criterion, as
 * postrank_settings(minimax_criteria = NULL): a criterion with weight 0 still counts. Tied optima are listed up
 * to maxTies (tieCount counts them all). An empty family returns `{ empty: true, family }`.
 */
export declare function minimaxChoice(E: ErrorArray, options: MinimaxOptions): MinimaxChoice | EmptyResult<"exact-within-family">;
/**
 * K = 2: the first-criterion weight w at which a fixed report's weighted risk w R_1 + (1 − w) R_2 equals τ,
 * w = (E_2 − τN)/(E_2 − E_1). Null when the crossing is not in the open interval (0, 1), or when the risk does
 * not depend on w (E_1 = E_2, for example the all-withheld report, whose risk is τ for every w).
 */
export declare function weightCrossing(g: ArrayLike<number>, E: ErrorArray, options: WeightCrossingOptions): number | null;
