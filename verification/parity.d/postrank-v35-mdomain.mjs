// Exact finite-law parity against independent public postrank1.2.0 oracles.
export default {
  group: 'postrank-v35-mdomain',
  functions: ['mdomainInput', 'mdomainGrades', 'mdomainFamily', 'mdomainEvaluate', 'mdomainSolve', 'mdomainExample'],
  default: { abs: 0, rel: 0 },
  run(args, core) {
    const input = core.mdomainInput(args.input);
    const family = core.mdomainFamily(input, args.family);
    const fit = core.mdomainSolve(input, family, args.decision);
    const result = {
      fit, selectedEvaluation: core.mdomainEvaluate(input, fit.selectedGrades, args.decision),
      canonicalGrades: core.mdomainGrades(input, args.grades),
    };
    if (args.checkExample) {
      const request = core.mdomainExample('dependence', { couplingIndex: 10 });
      result.exampleMath = { states: request.input.states, masses: request.input.masses,
        weights: request.decision.weights, tau: request.decision.tau, q: request.decision.q,
        t: request.decision.t, alpha: request.decision.alpha };
    }
    return result;
  },
};
