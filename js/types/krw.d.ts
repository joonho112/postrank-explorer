import { type ErrorArray } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type KrwOptions } from "./risk.ts";
import { type EmptyOptimum, type ExactOptimum, type FamilyLabel } from "./optimize.ts";
export type KrwAxis = {
    lambda: number;
    tau?: never;
} | {
    tau: number;
    lambda?: never;
};
export interface KrwBridgeParameters {
    lambda: number;
    tau: number;
    cut: number;
    informedShare: number;
    /** Can overflow to +Infinity for positive subnormal lambda. */
    slope: number;
}
export type KrwCorrespondenceOptions = KrwAxis & {
    family?: Family;
    tieTol?: number;
    maxTies?: number;
    /** Scientific declaration, not inferred from reverse-complement consistency. */
    tieFree: true;
    t?: KrwOptions["t"];
};
export interface KrwMinimizers {
    grade: Grade;
    grades: Grade[];
    tieCount: number;
    minRisk: number;
    /** postrank's risk-scale tie tolerance divided by 1 - tau. */
    tieTol: number;
}
export interface KrwCorrespondence {
    parameters: KrwBridgeParameters;
    family: FamilyLabel;
    reportsEnumerated: number;
    postrank: ExactOptimum | EmptyOptimum;
    krw: KrwMinimizers | null;
    /** Complete minimizing sets are compared before either returned list is truncated. */
    sameFullSet: boolean | null;
    maxAffineResidual: number | null;
}
/** Positive-axis conversion, the isolated-pair cut, and the stipulated informed-audience share. No rounding. */
export declare function krwBridgeParameters(axis: KrwAxis): KrwBridgeParameters;
/** Independently score both objectives over the complete same family, with KRW's scaled tie tolerance. */
export declare function krwCorrespondence(E: ErrorArray, options: KrwCorrespondenceOptions): KrwCorrespondence;
