import { type Rational } from './rational.ts';
import type { ParsedDecision } from './policy.ts';
import type { MdomainEvaluation } from './types.ts';
export interface ProtectionResult {
    meanGuards: Array<boolean | null>;
    meanFeasible: boolean;
    cutoffs: Array<number | null>;
    active: boolean[];
    exceedances: boolean[][];
    unions: boolean[];
    probabilities: Array<Rational | null>;
    joint: Rational;
    jointFeasible: boolean;
    jointStatus: MdomainEvaluation['jointStatus'];
}
export declare function evaluateProtection(policy: ParsedDecision, masses: Rational[], falseCounts: number[][], disclosed: number[], expectedFalse: Rational[]): ProtectionResult;
