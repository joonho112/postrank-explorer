// Parity for engine/src/multi.ts against postrank 1.1.0 (r-export/06_multi.R, group postrank-multi). Routes:
//   commonalityCost-tutorial_commonality   cached solves reproduced by enumeration of A_<=3 (603 reports)
//   budgetFamily-tutorial_two-q1.1          cached solve = exact optimum of A_<=3 (budgets of one bind nothing)
//   criterionMixtureRisk-tutorial_two-*     the cached grade's weighted and criterion risks (evaluation)
//   commonalityByOrderDP-commonality_30x3*  cached solves reproduced by fixedOrderDP (Step 2.6) along the orders in
//                                           args: the weighted expected-rank order for the common report, each
//                                           criterion's own expected-rank order for its own best report (no score
//                                           ties, so no blocks); criterion risks of the common grade via
//                                           criterionMixtureRisk with unit weights; delta = commonRk - ownRk
//   krwTwoCriterion-cards-tau.25            weightCrossing, criterionMixtureRisk (unit weights) and conflictPairs on
//                                           pr_case_krw$input (97 x 97 x 2) for KRW's race and gender cards and the
//                                           archived common grade (S-03)
//   estimandCosts-postrank_composite-*      composite targets against postrank_composite() (simplex a; engine
//                                           multiplier = 1 / package scale, since the package divides)
// Result-shape mapping is shared with oracle-multi.mjs (see its header).
import { RUN as ORACLE } from "./oracle-multi.mjs";

const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const unit = (K, k) => Array.from({ length: K }, (_, l) => (l === k ? 1 : 0));

const RUN = {
  commonalityCost: ORACLE.commonalityCost,
  budgetFamily: ORACLE.budgetFamily,
  criterionMixtureRisk: ORACLE.criterionMixtureRisk,
  estimandCosts: ORACLE.estimandCosts,
  commonalityByOrderDP: (a, pc) => {
    const E = errIn(a.E); const K = E.criteria.length;
    const common = pc.fixedOrderDP(E, { order: a.commonOrder, tau: a.tau, w: a.w, G: a.G });
    const perCriterion = a.ownOrders.map((order, k) => {
      const own = pc.fixedOrderDP(E, { order, tau: a.tau, w: unit(K, k), G: a.G });
      const commonRk = pc.criterionMixtureRisk(common.grade, E, { w: unit(K, k), tau: a.tau }).risk;
      return { commonRk, ownRk: own.risk, delta: commonRk - own.risk };
    });
    return { commonGrade: Array.from(common.grade, Number), commonRisk: common.risk, perCriterion };
  },
  krwTwoCriterion: (a, pc) => {
    const E = errIn(a.E); const K = E.criteria.length;
    const crossing = {}; const Rk = {};
    for (const [name, g] of Object.entries(a.grades)) {
      crossing[name] = ORACLE.weightCrossing({ g, E: a.E, tau: a.tau }, pc).omega;
      Rk[name] = Array.from({ length: K }, (_, k) => pc.criterionMixtureRisk(g, E, { w: unit(K, k), tau: a.tau }).risk);
    }
    return { crossing, Rk, conflictCount: ORACLE.conflictPairs({ E: a.E }, pc).count };
  },
};

export default {
  group: "postrank-multi",
  functions: ["commonalityCost", "budgetFamily", "criterionMixtureRisk", "estimandCosts", "fixedOrderDP", "weightCrossing", "conflictPairs"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Six-site values are closed form (pnorm coefficients, at most 15 pairs) and the 30-site array holds exact
  // multiples of 1/4,000 (S = 4,000 draws): 1e-12 absolute. The cached solver risks are validated action risks
  // recomputed by postrank_evaluate(), and base R reproduces each to 1e-12 (asserted in the script).
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // KRW pair probabilities come from numerical integration and are stored with 15 significant digits; sums over
    // up to 4,656 pairs can move by ~1e-12, and the crossing divides by R_1 - R_2 (about .1): 1e-10 absolute.
    crossing: { abs: 1e-10, rel: 0 },
    Rk: { abs: 1e-10, rel: 0 },
  },
};
