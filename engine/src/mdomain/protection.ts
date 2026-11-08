// Author: JoonHo Lee (jlee296@ua.edu).
import { add, cmp, floor, fromInteger, mul, ZERO, type Rational } from './rational.ts';
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

export function evaluateProtection(
  policy: ParsedDecision, masses: Rational[], falseCounts: number[][],
  disclosed: number[], expectedFalse: Rational[],
): ProtectionResult {
  const D = disclosed.length;
  const meanGuards = disclosed.map((N, d) => policy.q === null
    ? null : cmp(expectedFalse[d], mul(policy.q[d], fromInteger(N))) <= 0);
  const cutoffs = disclosed.map((N, d) => policy.t === null
    ? null : Number(floor(mul(policy.t[d], fromInteger(N)))) + 1);
  const active = disclosed.map((N, d) => policy.t !== null && N > 0 && (cutoffs[d] as number) <= N);
  const exceedances = falseCounts.map(counts => counts.map((F, d) => active[d] && F >= (cutoffs[d] as number)));
  const unions = exceedances.map(row => row.some(Boolean));
  const probabilities = Array.from({ length: D }, (_, d) => {
    if (policy.t === null) return null;
    return masses.reduce((total, mass, s) => exceedances[s][d] ? add(total, mass) : total, ZERO);
  });
  const joint = masses.reduce((total, mass, s) => unions[s] ? add(total, mass) : total, ZERO);
  return {
    meanGuards, meanFeasible: meanGuards.every(v => v !== false), cutoffs, active, exceedances, unions,
    probabilities, joint, jointFeasible: cmp(joint, policy.alpha) <= 0,
    jointStatus: policy.t === null ? 'disabled' : active.some(Boolean) ? 'evaluated' : 'analytic_zero',
  };
}
