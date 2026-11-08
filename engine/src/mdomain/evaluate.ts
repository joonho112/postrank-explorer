// Author: JoonHo Lee (jlee296@ua.edu).
import { mdomainInput } from './input.ts';
import { mdomainGrades } from './grades.ts';
import { bindDecision, type ParsedDecision } from './policy.ts';
import { evaluateProtection } from './protection.ts';
import { add, div, fromInteger, mul, parseExact, toExact, ZERO, type Rational } from './rational.ts';
import type { GradeMatrix, MdomainDecision, MdomainDomainResult, MdomainEvaluation, MdomainInput } from './types.ts';

export interface EvaluatedCard { evaluation: MdomainEvaluation; risk: Rational }

/** Internal path: callers have validated and copied input, grades and policy. */
export function evaluatePrepared(input: MdomainInput, grades: GradeMatrix, policy: ParsedDecision): EvaluatedCard {
  const n = input.unitIds.length;
  const D = input.domainIds.length;
  const M = n * (n - 1) / 2;
  const masses = input.masses.map((v, s) => parseExact(v, `input.masses[${s}]`, 'mdomainInputInvalid'));
  const disclosed = Array<number>(D).fill(0);
  const falseCounts = input.states.map(() => Array<number>(D).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      for (let d = 0; d < D; d += 1) {
        if (grades.values[i][d] === grades.values[j][d]) continue;
        disclosed[d] += 1;
        const high = grades.values[i][d] < grades.values[j][d] ? i : j;
        const low = high === i ? j : i;
        for (let s = 0; s < input.states.length; s += 1) {
          if (input.states[s][high][d] <= input.states[s][low][d]) falseCounts[s][d] += 1;
        }
      }
    }
  }
  const expectedFalse = input.domainIds.map((_, d) => masses.reduce(
    (total, mass, s) => add(total, mul(mass, fromInteger(falseCounts[s][d]))), ZERO));
  const protection = evaluateProtection(policy, masses, falseCounts, disclosed, expectedFalse);
  let risk = ZERO;
  const domains: MdomainDomainResult[] = input.domainIds.map((domainId, d) => {
    const N = disclosed[d];
    const loss = div(add(expectedFalse[d], mul(policy.tau[d], fromInteger(M - N))), fromInteger(M));
    const weighted = mul(policy.weights[d], loss);
    risk = add(risk, weighted);
    const eventProbability = protection.probabilities[d];
    return {
      domainId, gradeCount: new Set(grades.values.map(row => row[d])).size,
      disclosedPairs: N, withheldPairs: M - N, expectedFalseCountExact: toExact(expectedFalse[d]),
      expectedFalseProportionExact: N === 0 ? null : toExact(div(expectedFalse[d], fromInteger(N))),
      lossExact: toExact(loss), weightedLossExact: toExact(weighted),
      meanGuardSatisfied: protection.meanGuards[d],
      thresholdExact: policy.t === null ? null : toExact(policy.t[d]),
      firstExceedanceCount: protection.cutoffs[d],
      eventProbabilityExact: eventProbability === null ? null : toExact(eventProbability),
      eventActive: protection.active[d],
    };
  });
  const evaluation: MdomainEvaluation = {
    inputId: input.inputId, lawId: input.lawId, decisionId: policy.decision.decisionId,
    grades: { unitIds: [...grades.unitIds], domainIds: [...grades.domainIds], values: grades.values.map(row => [...row]) },
    originalPairs: M, riskExact: toExact(risk), jointProbabilityExact: toExact(protection.joint),
    meanFeasible: protection.meanFeasible, jointFeasible: protection.jointFeasible,
    feasible: protection.meanFeasible && protection.jointFeasible, jointStatus: protection.jointStatus,
    domains, states: input.stateIds.map((stateId, s) => ({
      stateId, falseCounts: [...falseCounts[s]], exceedances: [...protection.exceedances[s]], unionExceeded: protection.unions[s],
    })),
    assurance: { arithmetic: 'exact_represented_finite_law', properLawStatus: 'producer_declaration',
      numericalGuarantee: false, intendedPosteriorFeasibilityCertified: false, searchOptimality: 'fixed_card' },
  };
  return { evaluation, risk };
}

/** A fixed card under the explicitly declared finite law and policy. */
export function mdomainEvaluate(input: MdomainInput, grades: GradeMatrix, decision: MdomainDecision): MdomainEvaluation {
  const checked = mdomainInput(input);
  return evaluatePrepared(checked, mdomainGrades(checked, grades), bindDecision(checked, decision)).evaluation;
}
