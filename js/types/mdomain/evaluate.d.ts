import { type ParsedDecision } from './policy.ts';
import { type Rational } from './rational.ts';
import type { GradeMatrix, MdomainDecision, MdomainEvaluation, MdomainInput } from './types.ts';
export interface EvaluatedCard {
    evaluation: MdomainEvaluation;
    risk: Rational;
}
/** Internal path: callers have validated and copied input, grades and policy. */
export declare function evaluatePrepared(input: MdomainInput, grades: GradeMatrix, policy: ParsedDecision): EvaluatedCard;
/** A fixed card under the explicitly declared finite law and policy. */
export declare function mdomainEvaluate(input: MdomainInput, grades: GradeMatrix, decision: MdomainDecision): MdomainEvaluation;
