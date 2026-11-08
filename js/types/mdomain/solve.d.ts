import type { MdomainDecision, MdomainFamily, MdomainFit, MdomainInput } from './types.ts';
/** Exhaust the complete bounded product; retain every exact feasible minimizer. */
export declare function mdomainSolve(input: MdomainInput, family: MdomainFamily, decision: MdomainDecision): MdomainFit;
