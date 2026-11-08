import { type Rational } from './rational.ts';
import type { MdomainDecision, MdomainInput } from './types.ts';
export interface ParsedDecision {
    decision: MdomainDecision;
    weights: Rational[];
    tau: Rational[];
    q: Rational[] | null;
    t: Rational[] | null;
    alpha: Rational;
}
export declare function bindDecision(input: MdomainInput, value: MdomainDecision): ParsedDecision;
