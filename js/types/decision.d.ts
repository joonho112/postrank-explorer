import { type ErrorArray } from "./pairwise.ts";
export interface TierSizeDistribution {
    n: number;
    G: number;
    M: number;
    totalPatterns: number;
    distribution: {
        N: number;
        withheld: number;
        count: number;
        probability: number;
    }[];
    maxN: number;
    maxShare: number;
    balancedSizes: number[];
}
export declare function tierSizeDistribution(n: number, G: number): TierSizeDistribution;
export declare function reportInformation(g: ArrayLike<number>, E: ErrorArray): number;
export type ThresholdViolationKind = "twoWithheld" | "statedChain" | "directedCycle";
export interface ThresholdViolation {
    i: number;
    j: number;
    k: number;
    kind: ThresholdViolationKind;
}
export interface ThresholdViolationOptions {
    tau: number;
    w?: readonly number[];
    details?: boolean;
}
export interface ThresholdViolations {
    n: number;
    M: number;
    tau: number;
    relation: number[][];
    statedPairs: {
        above: number;
        below: number;
        error: number;
    }[];
    statedCount: number;
    aboveCounts: number[];
    triples: number;
    invalidCount: number;
    counts: Record<ThresholdViolationKind, number>;
    printable: boolean;
    unitIncidence: number[];
    pairIncidence: number[][];
    violations: ThresholdViolation[] | null;
}
export declare function thresholdViolations(E: ErrorArray, options: ThresholdViolationOptions): ThresholdViolations;
export interface CompareReportLossOptions {
    tau: number;
    w?: readonly number[];
    tieTol?: number;
}
export interface ComparedReportLosses {
    lossBest: number[];
    lossRule: number[];
    delta: number[];
    meanBest: number;
    meanRule: number;
    meanDelta: number;
    mcseDelta: number | null;
    ruleWins: number;
    bestWins: number;
    ties: number;
    ruleWinShare: number;
    bestWinShare: number;
    tieShare: number;
    S: number;
    tieTol: number;
}
export declare function compareReportLosses(gBest: ArrayLike<number>, gRule: ArrayLike<number>, draws: readonly (readonly number[] | readonly (readonly number[])[])[], options: CompareReportLossOptions): ComparedReportLosses;
export interface AllocationOptions {
    values: readonly number[];
    pTop: readonly number[];
    budget: number;
}
export interface AllocationValue {
    inclusion: number[];
    expectedValue: number;
    expectedOverlap: number;
    overlapShare: number | null;
    selectedCount: number;
    budget: number;
    boundaryGrade: number | null;
    boundaryMembers: number[];
    boundarySize: number;
    remaining: number;
    aboveCount: number;
}
export declare function allocationValue(g: ArrayLike<number>, options: AllocationOptions): AllocationValue;
export interface ClassificationOptions {
    falsePositiveCost: number;
    falseNegativeCost: number;
    positive?: readonly (boolean | number)[];
    values?: readonly number[];
}
export interface ThresholdClassification {
    positive: boolean[];
    bayesPositive: boolean[];
    positiveCount: number;
    cutoff: number;
    positiveCost: number[];
    negativeCost: number[];
    expectedFalsePositives: number;
    expectedFalseNegatives: number;
    totalCost: number;
    meanCost: number;
    selectedValue: number | null;
}
export declare function thresholdClassification(probabilities: readonly number[], options: ClassificationOptions): ThresholdClassification;
