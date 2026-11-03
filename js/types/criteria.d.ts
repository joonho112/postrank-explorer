import { type ErrorArray } from "./pairwise.ts";
import { type Family, type Grade, type RelationChange } from "./report.ts";
import { type ReportEvaluation, type RiskOptions } from "./risk.ts";
import { type FamilyLabel } from "./optimize.ts";
export interface NormalCompositeOptions {
    /** General finite coefficients; they need not be nonnegative or sum to one. */
    a: readonly number[];
    /** Positive rescaling of each criterion; default all 1. */
    multiplier?: readonly number[];
    ids?: readonly string[];
}
export interface NormalComposite {
    mean: number[];
    sd: number[];
    /** One weak-error criterion named composite, under the declared independent Normal joint law. */
    E: ErrorArray;
}
export interface CompareReportsOptions extends RiskOptions {
}
export interface CompareReportPair {
    i: number;
    j: number;
    /** +1: i above j, 0: withheld, −1: i below j. */
    beforeRelation: -1 | 0 | 1;
    afterRelation: -1 | 0 | 1;
    beforeCost: number;
    afterCost: number;
    costDifference: number;
    normalizedDifference: number;
}
export interface CompareReports {
    before: ReportEvaluation;
    after: ReportEvaluation;
    deltaRisk: number;
    errorTermDelta: number;
    withholdingTermDelta: number;
    change: RelationChange;
    /** Every changed unordered pair, ordered by i then j. */
    pairs: CompareReportPair[];
}
export interface ProtectionEnvelopeOptions extends RiskOptions {
    q: readonly (number | null)[];
    /** Proposed coefficient envelope radius, a scalar broadcast or a length-K vector. */
    epsilon: number | readonly number[];
    family?: Family;
    /** Nonnegative absolute tolerance in count units; default 0 (raw homogeneous tests). */
    feasibilityTol?: number;
    /** Advisory coefficient comparison tolerance; default 1e-12. */
    coefficientTol?: number;
}
export interface ProtectionMembership {
    inner: boolean;
    nominal: boolean;
    exact: boolean;
    outer: boolean;
}
export interface ProtectionSlack {
    inner: (number | null)[];
    nominal: (number | null)[];
    exact: (number | null)[];
    outer: (number | null)[];
}
export interface ProtectionEnvelopeRow {
    grade: Grade;
    N: number;
    estimated: ReportEvaluation;
    exact: ReportEvaluation;
    membership: ProtectionMembership;
    /** threshold * N − expected wrong count, null on unprotected criteria; thresholds are never clipped. */
    slack: ProtectionSlack;
}
export interface CoefficientCheck {
    /** Maximum absolute directional coefficient error for every criterion, including zero-weight ones. */
    maxAbs: number[];
    /** maxAbs[k] − epsilon[k], without rounding. */
    excess: number[];
    strictEnvelopeHolds: boolean;
    /** An advisory numerical comparison, not a certificate of either actual set inclusion. */
    withinCoefficientTolerance: boolean;
    coefficientTol: number;
}
export interface ActualBracketInclusions {
    innerSubsetExact: boolean;
    exactSubsetOuter: boolean;
    innerSubsetNominal: boolean;
    nominalSubsetOuter: boolean;
    /** Lexicographically first counterexample, or null. */
    counterexampleInnerExact: Grade | null;
    counterexampleExactOuter: Grade | null;
}
export interface ProtectionEnvelopes {
    family: FamilyLabel;
    tau: number;
    w: number[];
    q: (number | null)[];
    epsilon: number[];
    innerThreshold: (number | null)[];
    outerThreshold: (number | null)[];
    feasibilityTol: number;
    coefficientCheck: CoefficientCheck;
    actualBracketInclusions: ActualBracketInclusions;
    counts: {
        inner: number;
        nominal: number;
        exact: number;
        outer: number;
    };
    empty: ProtectionMembership;
    rows: ProtectionEnvelopeRow[];
}
/**
 * Composite of explicitly INDEPENDENT Normals: independent units and independent criteria within each unit.
 * mean_i = sum a_k multiplier_k means_ik; sd_i² = sum (a_k multiplier_k sds_ik)².
 * Independence is a caller declaration, never inferred from marginal error arrays. Zero-SD point masses use
 * the weak event mean_i ≤ mean_j, including error 1 in both directions when deterministic means are equal.
 */
export declare function normalComposite(means: readonly ArrayLike<number>[], sds: readonly ArrayLike<number>[], options: NormalCompositeOptions): NormalComposite;
/** Full risk accounting for two fixed reports under the same supplied coefficients and loss. The difference
 * can be negative; this helper supplies no baseline-optimality or causal certificate. */
export declare function compareReports(g0: ArrayLike<number>, g1: ArrayLike<number>, E: ErrorArray, options: CompareReportsOptions): CompareReports;
/**
 * Enumerate estimated inner/nominal/outer and exact protection sets E_k(g) ≤ threshold_k N(g), with raw
 * comparisons by default. Active criteria are protected even at zero weight. The coefficient error check is
 * separate from the actual inclusions, which are computed from all family members. No probability, solver
 * certificate or joint-law validity claim is inferred from these numerical comparisons.
 */
export declare function protectionEnvelopes(Ehat: ErrorArray, Eexact: ErrorArray, options: ProtectionEnvelopeOptions): ProtectionEnvelopes;
