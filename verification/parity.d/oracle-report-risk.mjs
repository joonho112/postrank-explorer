// Parity for engine/src/report.ts and engine/src/risk.ts against base R (r-export/03_report_risk.R, group
// oracle-report-risk): exact counts, closed forms and the theory book's worked examples (ch. 9, 10, 11, 14, 16).
// Each golden row names the engine function in args.fn; the call follows engine/API.md.
// Golden matrices store the NaN diagonal as null: matrix inputs are mapped null -> NaN before the call, and engine
// outputs NaN -> null (typed arrays -> plain arrays) before comparison.
// familySize: the golden value is a decimal string and the engine result is compared as String(result), which is
// exact for a safe-integer number and for a BigInt (28,091,567,595 for all n = 12; n = 18 and 20 exceed 2^53).
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const errIn = (E) => ({ ...E, e: toNaN(E.e) });                          // ErrorArray { ids, criteria, e }
const tieIn = (t) => ({ ...t, b: toNaN(t.b), d: toNaN(t.d) });            // tie = { b, d } (criterion-major, like e)
const opts = (a) => (a.w === undefined ? { tau: a.tau } : { tau: a.tau, w: a.w });   // K = 1 rows may omit w (default [1])
const num = (x, key) => (typeof x === "number" ? x : x?.[key]);           // a scalar, or an object carrying it
const isArr = (x) => Array.isArray(x) || ArrayBuffer.isView(x);
const as01 = (v) => (typeof v === "boolean" ? Number(v) : v);
const threw = (f) => { try { f(); return { threw: false }; } catch { return { threw: true }; } };
const BEST_ORDER = ["iAboveJ", "jAboveI", "withhold"];                     // compare the set of best actions
const lex = (p, q) => p[0] - q[0] || p[1] - q[1];                          // compare the set of stated pairs

const RUN = {
  canonicalGrade: (a, pc) => ({ grade: nn(pc.canonicalGrade(a.g)) }),
  pairCount: (a, pc) => ({ M: pc.pairCount(a.n) }),
  disclosure: (a, pc) => nn(pc.disclosure(a.g)),
  relations: (a, pc) => ({ rel: nn(pc.relations(a.g)) }),
  weakRelation: (a, pc) => {
    const r = pc.weakRelation(a.g);
    const z = nn(isArr(r) ? r : r.z).map((row, i) => row.map((v, j) => (i === j ? null : as01(v))));  // API fixes i != j only
    return { z, complete: r.complete, transitive: r.transitive };
  },
  familySize: (a, pc) => ({ size: String(pc.familySize(a.n, a.family)) }),
  pairDecision: (a, pc) => {
    const r = pc.pairDecision(a.eIJ, a.eJI, a.tau);
    return { costs: r.costs, best: [...r.best].sort((x, y) => BEST_ORDER.indexOf(x) - BEST_ORDER.indexOf(y)) };
  },
  pairDecisionThrows: (a, pc) => threw(() => pc.pairDecision(a.eIJ, a.eJI, a.tau)),
  evaluateReport: (a, pc) => nn(pc.evaluateReport(a.g, errIn(a.E), opts(a))),
  evaluateReportThrows: (a, pc) => threw(() => pc.evaluateReport(a.g, errIn(a.E), opts(a))),
  relaxedPairRisk: (a, pc) => ({ risk: num(pc.relaxedPairRisk(errIn(a.E), opts(a)), "risk") }),
  betweenGradeErrors: (a, pc) => ({ rows: nn(pc.betweenGradeErrors(a.g, errIn(a.E), { w: a.w })) }),
  // statedAbove: pairs [{ i, j, error }] (0-based), sorted by (i, j) with each pair's weighted error kept beside it.
  statedAbove: (a, pc) => {
    const r = pc.statedAbove(a.g, errIn(a.E), opts(a));
    const list = Array.from(r.pairs, (p) => ({ ij: [p.i, p.j], error: p.error })).sort((p, q) => lex(p.ij, q.ij));
    return { pairs: list.map((p) => p.ij), errors: list.map((p) => p.error), count: r.count, max: nn(r.max) };
  },
  // realizedWrong(g, theta, { w }) -> { N, D, DoverN, A, AoverN } (A null when K > 1 and no w; ratios null at N = 0).
  realizedWrong: (a, pc) => {
    const r = pc.realizedWrong(a.g, a.theta, a.w === undefined ? {} : { w: a.w });
    return { N: r.N, D: nn(r.D), DoverN: nn(r.DoverN), A: nn(r.A), AoverN: nn(r.AoverN) };
  },
  lambdaToTau: (a, pc) => ({ tau: pc.lambdaToTau(a.lambda) }),
  tauToLambda: (a, pc) => ({ lambda: pc.tauToLambda(a.tau) }),
  krwRisk: (a, pc) => ({ risk: num(pc.krwRisk(a.g, errIn(a.E), { lambda: a.lambda }), "risk") }),
  equalityNeutralRisk: (a, pc) => {
    const r = pc.equalityNeutralRisk(a.g, tieIn(a.tie), opts(a));
    return { risk: r.risk, R0: r.R0 };
  },
  // confidentPairs(g, E, { tau, w }) -> { count, withheld, stated, pairs: [{ i, j, withheld }] } (0-based, upper
  // triangle in row-major order): pairs compared in the engine's order as [i, j], each withheld flag beside it.
  confidentPairs: (a, pc) => {
    const r = pc.confidentPairs(a.g, errIn(a.E), opts(a));
    const list = Array.from(r.pairs);
    return { count: r.count, withheld: r.withheld, stated: r.stated, pairs: list.map((p) => [p.i, p.j]), pairWithheld: list.map((p) => p.withheld) };
  },
  confidentPairsThrows: (a, pc) => threw(() => pc.confidentPairs(a.g, errIn(a.E), a.opts)),
  // cases [{ A, N }], equally likely; M (pairs per case) is an option, and rows without M expect meanDisclosure null.
  disclosedErrorEstimands: (a, pc) => nn(pc.disclosedErrorEstimands(a.cases, a.M === undefined ? {} : { M: a.M })),
};

export default {
  group: "oracle-report-risk",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Exact counts and closed-form probabilities, risks and ratios (sums of at most 15 terms of exact or pnorm
  // values): 1e-12 absolute. Inputs carry 15 significant digits, which moves results by ~1e-15; the engine's
  // compensated sums differ from R's by ~1e-15 relative, far inside 1e-12 for values below 1,000.
  default: { abs: 1e-12, rel: 0 },
};
