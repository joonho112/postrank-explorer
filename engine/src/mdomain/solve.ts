// Author: JoonHo Lee (jlee296@ua.edu).
import { fail } from './error.ts';
import { mdomainInput } from './input.ts';
import { candidateKey, enumerateCards, validateFamily } from './family.ts';
import { bindDecision } from './policy.ts';
import { evaluatePrepared } from './evaluate.ts';
import { cmp, type Rational } from './rational.ts';
import type { MdomainCandidateRow, MdomainDecision, MdomainFamily, MdomainFit, MdomainInput } from './types.ts';

/** Exhaust the complete bounded product; retain every exact feasible minimizer. */
export function mdomainSolve(input: MdomainInput, family: MdomainFamily, decision: MdomainDecision): MdomainFit {
  const checked = mdomainInput(input);
  const bank = validateFamily(checked, family);
  const policy = bindDecision(checked, decision);
  const cards = enumerateCards(bank);
  const evaluated = cards.map(grades => evaluatePrepared(checked, grades, policy));
  let best: Rational | null = null;
  for (const item of evaluated) {
    if (item.evaluation.feasible && (best === null || cmp(item.risk, best) < 0)) best = item.risk;
  }
  if (best === null) fail('mdomainFamilyInvalid', 'family', 'No feasible member remains in the declared product.');
  const optimum = best;
  const optimalIndexes = evaluated.flatMap((item, i) => item.evaluation.feasible && cmp(item.risk, optimum) === 0 ? [i] : []);
  const selectedIndex = optimalIndexes[0];
  const selected = evaluated[selectedIndex].evaluation;
  const candidateTable: MdomainCandidateRow[] = evaluated.map((item, i) => {
    const e = item.evaluation;
    return {
      candidateId: candidateKey(e.grades), grades: e.grades, riskExact: e.riskExact,
      jointProbabilityExact: e.jointProbabilityExact, meanFeasible: e.meanFeasible,
      jointFeasible: e.jointFeasible, feasible: e.feasible,
      disclosedCounts: e.domains.map(d => d.disclosedPairs), gradeCounts: e.domains.map(d => d.gradeCount),
      optimal: e.feasible && cmp(item.risk, optimum) === 0, selected: i === selectedIndex,
    };
  });
  return {
    inputId: checked.inputId, lawId: checked.lawId, decisionId: policy.decision.decisionId,
    familyId: bank.sourceSpec.familyId, candidateTable,
    optimizerIds: optimalIndexes.map(i => candidateTable[i].candidateId), selectedId: candidateTable[selectedIndex].candidateId,
    selectedGrades: { unitIds: [...selected.grades.unitIds], domainIds: [...selected.grades.domainIds],
      values: selected.grades.values.map(row => [...row]) },
    riskExact: selected.riskExact, jointProbabilityExact: selected.jointProbabilityExact,
    searchScope: { type: 'declared_cartesian_product', candidateCount: cards.length, examinedActions: cards.length,
      fullProductExamined: true, unrestrictedOptimalityClaim: false },
    assurance: { arithmetic: 'exact_represented_finite_law', properLawStatus: 'producer_declaration', numericalGuarantee: false,
      intendedPosteriorFeasibilityCertified: false, searchOptimality: 'candidate_restricted' },
  };
}
