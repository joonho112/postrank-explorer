// Public-API composites compared with the independent base-R UI pins. No expected values are
// calculated here: outputs are the engine's costs, optima, coefficients, counts and stated bounds.
const nn = x => x == null ? null : typeof x === "number" ? Number.isNaN(x) ? null : x
  : ArrayBuffer.isView(x) || Array.isArray(x) ? Array.from(x, nn)
  : typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)])) : x;
const actions = [[1, 2], [2, 1], [1, 1]];
const names = ["iAboveJ", "jAboveI", "withhold"];
const costsInput = (tie, e) => ({ ids: tie.ids, criteria: tie.criteria, e });
const normalInput = (pc, means, sds, ids) => pc.errorArray(means.map(x => [x]), sds.map(x => [x]), { ids, criteria: ["score"] });
const countSummary = r => ({ grade: Array.from(r.grade), risk: r.risk, N: r.N, Ew: r.Ew,
  EoverN: r.evaluation.EoverN[0], familySize: r.family.size, tieCount: r.tieCount });
const pickChanges = r => Object.fromEntries(["M", "nSame", "nNewDisclosed", "nNewWithheld", "nReversed"].map(k => [k, r[k]]));

function pairAt(pc, t, tau, certain = false) {
  const states = [[[0], [1]], [[1], [1]], [[2], [1]]];
  const probs = certain ? [0, 1, 0] : [.1, t, .9 - t];
  const labels = { ids: ["A", "B"], criteria: ["score"] };
  const weak = pc.finiteLawPairwise(states, probs, labels);
  const tie = pc.tieLawPairwise(states, probs, labels);
  const opts = { tau, w: [1] };
  const weakCosts = actions.map(g => pc.evaluateReport(g, weak, opts).risk);
  const neutralCosts = actions.map(g => pc.equalityNeutralRisk(g, tie, opts).risk);
  const N = actions.map(g => pc.disclosure(g).N);
  const strict = actions.map(g => pc.evaluateReport(g, costsInput(tie, tie.b), opts).Ew);
  const Q = actions.map(g => pc.evaluateReport(g, costsInput(tie, tie.d), opts).Ew);
  const T = pc.evaluateReport(actions[0], costsInput(tie, tie.d), opts).Ew;
  const R0 = pc.equalityNeutralRisk(actions[2], tie, opts).R0;
  const weakBest = pc.pairDecision(weakCosts[0], weakCosts[1], tau).best.map(x => names.indexOf(x));
  // With zero distinctness all three neutral costs are identically zero. The mathematical guard
  // permits only the shared report, which is separately recorded as admissibility, not optimization.
  const neutralBest = R0 > 0 ? pc.pairDecision(neutralCosts[0], neutralCosts[1], R0).best.map(x => names.indexOf(x)) : [0, 1, 2];
  return { weakCosts, neutralCosts, weakBest, neutralBest, N, strict, Q, T, R0,
    EoverN: strict.map((v, i) => N[i] > 0 ? v / N[i] : null),
    EoverQ: strict.map((v, i) => Q[i] > 0 ? v / Q[i] : null),
    familySize: pc.familySize(2, { kind: "all" }), guardAdmissible: certain ? [false, false, true] : [true, true, true] };
}
function crossings(pc, tau, loss) {
  const lo = pairAt(pc, 0, tau)[loss];
  const hi = pairAt(pc, .9, tau)[loss];
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const slope = ((hi[i] - lo[i]) - (hi[j] - lo[j])) / .9;
    if (Math.abs(slope) <= 1e-12) continue;
    const t = (lo[j] - lo[i]) / slope;
    if (t < -1e-12 || t > .9 + 1e-12) continue;
    const at = pairAt(pc, Math.min(.9, Math.max(0, t)), tau);
    const best = loss === "weakCosts" ? at.weakBest : at.neutralBest;
    if (best.includes(i) && best.includes(j) && !out.some(x => Math.abs(x - t) <= 1e-12)) out.push(t);
  }
  return out.sort((a, b) => a - b);
}
function dominance(a, pc) {
  const E = pc.finiteLawPairwise(a.states, a.probs, { ids: a.ids, criteria: ["score"] });
  const r = pc.exactOptimum(E, { tau: a.tau, family: a.family });
  const sep = pc.evaluateReport([1, 1, 2, 2], E, { tau: a.tau });
  return { ...countSummary(r), crossProbabilities: [0, 1].flatMap(i => [2, 3].map(j => 1 - E.e[0][i][j])),
    threshold: 1 - a.tau, separatingRisk: sep.risk, separatingN: sep.N, separatingEw: sep.Ew, separatingEoverN: sep.EoverN[0] };
}
function anotherLaw(a, pc) {
  const E0 = normalInput(pc, a.means, a.sds, a.ids);
  const changed = a.means.slice(); changed[a.unit] += a.shift;
  const E1 = normalInput(pc, changed, a.sds.map(x => x * a.scale), a.ids);
  const opts = { tau: a.tau, family: a.family, tieTol: 0 };
  const o0 = pc.exactOptimum(E0, opts), o1 = pc.exactOptimum(E1, opts);
  const risk = (grade, E) => pc.evaluateReport(grade, E, { tau: a.tau }).risk;
  const r00 = risk(o0.grade, E0), r01 = risk(o0.grade, E1), r10 = risk(o1.grade, E0), r11 = risk(o1.grade, E1);
  const epsilon = pc.maxCoefficientError(E0, E1).epsilon;
  const deltaW = pc.weightedRadius(epsilon, [1]);
  const bounds = pc.regretBound({ N: o0.N, Nstar: o1.N, M: o0.evaluation.M, deltaW, eta: 0 });
  return { selectedGrade: o0.grade, evaluationGrade: o1.grade,
    selectionFamilySize: o0.family.size, evaluationFamilySize: o1.family.size, selectedN: o0.N, evaluationN: o1.N,
    r00, r01, r10, r11, candidateShift: r01 - r00, candidateDiscrepancy: Math.abs(r01 - r00), regret: r01 - r11,
    delta: epsilon[0], deltaW, candidateBound: bounds.evaluation, regretBound: bounds.regret, uniformBound: bounds.uniform };
}
function correction(a, pc) {
  const E0 = normalInput(pc, a.means, a.sds, a.ids);
  const opts = { tau: a.tau, family: { kind: "atMost", G: a.cap }, tieTol: 1e-12 };
  const before = pc.exactOptimum(E0, opts);
  const common = a.ids.map((_, i) => i).filter(i => a.mode !== "drop" || i !== a.unit);
  const means = a.means.slice(), sds = a.sds.slice();
  if (a.mode === "mean") means[a.unit] = a.value;
  if (a.mode === "sd") sds[a.unit] = a.value;
  const E1 = normalInput(pc, common.map(i => means[i]), common.map(i => sds[i]), common.map(i => a.ids[i]));
  const after = pc.exactOptimum(E1, opts);
  const commonBeforeGrade = pc.canonicalGrade(common.map(i => before.grade[i]));
  const overall = pc.relationChange(commonBeforeGrade, after.grade);
  const untouched = a.ids.map((_, i) => i).filter(i => i !== a.unit);
  const inAfter = untouched.map(i => common.indexOf(i));
  const uBefore = pc.canonicalGrade(untouched.map(i => before.grade[i]));
  const uAfter = pc.canonicalGrade(inAfter.map(i => after.grade[i]));
  const untouchedChange = pc.relationChange(uBefore, uAfter);
  const subset = (E, indices) => ({ ids: indices.map(i => E.ids[i]), criteria: E.criteria,
    e: E.e.map(m => indices.map(i => indices.map(j => m[i][j]))) });
  const gap = pc.maxCoefficientError(subset(E0, untouched), subset(E1, inAfter)).epsilon[0];
  return { beforeGrade: before.grade, afterGrade: after.grade,
    commonBeforeGrade, commonAfterGrade: after.grade, commonIds: common.map(i => a.ids[i]),
    beforeRisk: before.risk, afterRisk: after.risk, beforeN: before.N, afterN: after.N,
    beforeEw: before.Ew, afterEw: after.Ew, beforeEoverN: before.evaluation.EoverN[0], afterEoverN: after.evaluation.EoverN[0],
    beforeFamilySize: before.family.size, afterFamilySize: after.family.size, beforeTieCount: before.tieCount, afterTieCount: after.tieCount,
    overall: pickChanges(overall), overallAgreement: overall.agreement,
    untouched: pickChanges(untouchedChange), untouchedAgreement: untouchedChange.agreement, untouchedEpsilon: gap };
}
function couplingSummary(a, pc) {
  const r = pc.wrongCountDistribution(a.g, a.states, a.probs);
  return { N: r.N, E: r.expected, EoverN: r.N > 0 ? r.expected / r.N : null,
    pNone: r.pNone, unionBound: r.unionBound, values: Array.from(r.values), probs: Array.from(r.probs) };
}
function coupling(a, pc) {
  const r = couplingSummary(a, pc);
  const e = pc.finiteLawPairwise(a.states, a.probs).e[0];
  return { ...r, pairErrors: [e[0][1], e[1][2], e[0][2]] };
}
function couplingMC(a, pc) {
  const states = Array.from(pc.finiteLawDraws(a.probs, a.S, a.seed), i => a.states[i]);
  const r = couplingSummary({ ...a, states, probs: null }, pc);
  return { ...r, wrongCounts: states.map(theta => pc.realizedWrong(a.g, theta).D[0]) };
}
function familyBoundary(a, pc) {
  const E = normalInput(pc, a.means, a.sds, a.ids);
  const all = pc.exactOptimum(E, { tau: a.tau, tieTol: a.tieTol, family: { kind: "all" } });
  const cap3 = pc.exactOptimum(E, { tau: a.tau, tieTol: a.tieTol, family: { kind: "atMost", G: 3 } });
  const summary = r => ({ familySize: r.family.size, tieCount: r.tieCount,
    grades: r.grades.map(g => Array.from(g)), Ns: r.grades.map(g => pc.disclosure(g).N) });
  return { all: summary(all), cap3: summary(cap3), tieTol: all.tieTol,
    allRisk: all.risk, cap3Risk: cap3.risk };
}
export default {
  group: "oracle-v3p2-readouts",
  run(a, pc) {
    if (a.kind === "denominator-tie") {
      const E=normalInput(pc,a.means,a.sds,a.ids),r=pc.exactOptimum(E,{tau:a.tau,family:{kind:"all"}});
      const v=r.grades.map(g=>pc.evaluateReport(g,E,{tau:a.tau}));
      return nn({tieCount:r.tieCount,tieTol:r.tieTol,grades:r.grades.map(g=>Array.from(g)),
        Ns:v.map(x=>x.N),EoverMs:v.map(x=>x.EoverM[0]),EoverNs:v.map(x=>x.EoverN[0])});
    }
    if (a.kind === "finite-family-ties") {
      const E = pc.finiteLawPairwise(a.states, a.probs);
      const opts = { tau:a.tau, w:a.w, tieTol:a.tieTol };
      const summary = r => ({ familySize:r.family.size, tieCount:r.tieCount,
        grades:r.grades.map(g=>Array.from(g)), Ns:r.grades.map(g=>pc.disclosure(g).N) });
      return nn({ all:summary(pc.exactOptimum(E,{...opts,family:{kind:"all"}})),
        cap3:summary(pc.exactOptimum(E,{...opts,family:{kind:"atMost",G:3}})),
        order:summary(pc.fixedOrderDP(E,{...opts,family:{kind:"order",order:[0,1,2,3]}})),tieTol:a.tieTol });
    }
    if (a.kind === "tau-family-boundary") return nn(familyBoundary(a, pc));
    if (a.kind === "coupling") return nn(coupling(a, pc));
    if (a.kind === "coupling-mc") return nn(couplingMC(a, pc));
    if (a.kind === "normal-pair-boundary") {
      const E = pc.errorArray([a.meanA, a.meanB], [a.sdA, a.sdB]);
      return { error: E.e[0][0][1], pi: pc.pairDirection(a.meanA, a.sdA, a.meanB, a.sdB) };
    }
    if (a.kind === "pair-equality") return nn({ ...pairAt(pc, a.t, a.tau, a.certain),
      weakSwitch: a.certain ? [] : crossings(pc, a.tau, "weakCosts"),
      neutralSwitch: a.certain ? [] : crossings(pc, a.tau, "neutralCosts") });
    if (a.kind === "dominance") return nn(dominance(a, pc));
    if (a.kind === "another-law") return nn(anotherLaw(a, pc));
    if (a.kind === "one-correction") return nn(correction(a, pc));
    throw new Error(`Unknown Part 2 readout pin kind: ${a.kind}`);
  },
  // Counts, grades, family sizes, admissibility and nulls are exact. Only continuous quantities
  // receive the declared floating-point tolerance; nested relation-count objects remain exact.
  default: { abs: 0, rel: 0 },
  tolerance: Object.fromEntries([
    "EoverMs", "EoverNs", "allRisk", "cap3Risk", "E", "pNone", "unionBound", "probs", "pairErrors", "error", "pi",
    "weakCosts", "neutralCosts", "strict", "Q", "T", "R0", "EoverN", "EoverQ", "weakSwitch", "neutralSwitch",
    "risk", "Ew", "crossProbabilities", "threshold", "separatingRisk", "separatingEw", "separatingEoverN",
    "r00", "r01", "r10", "r11", "candidateShift", "candidateDiscrepancy", "regret", "delta", "deltaW",
    "candidateBound", "regretBound", "uniformBound", "beforeRisk", "afterRisk", "beforeEw", "afterEw",
    "beforeEoverN", "afterEoverN", "overallAgreement", "untouchedAgreement",
  ].map(k => [k, { abs: 1e-12, rel: 1e-12 }])),
};
