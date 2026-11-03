// Parity for the Part 1 engine supplement (engine/API.md "v3 helpers: Part 1 supplement (Step 3.27)") against base R
// (r-export/18_v3_part1.R, group oracle-v3p1): the ten new functions (pairDifference, normalCoverage, withinBand,
// sharedMeanPosterior, claimsByDistance, finiteLawCells, binomialMcse, maxCoefficientError, chainCountLaw, runningMean),
// the extensions (disclosure withheld, leastCertainPairs order -> apart, intervalOverlapTally amount/nested/nestedCount,
// majorityWins cycleTriples, formatProb open) and the read-out pins (existing functions at the Part 1 apps' settings).
// Each row names its function in args.fn and keeps the options as top-level args, passed only when present so the
// engine's defaults are exercised; a row with args.opts passes that value verbatim as the options argument (unknown
// keys, a number in the options place). "<name>Throws" rows expect the call to throw: they fail, not pass, when the
// engine lacks the function, and "leastCertainPairsOrderThrows" first checks that a valid `order` is accepted, so a
// refused option never counts as the expected throw. Rows of the existing functions compare only existing fields.
// Inputs: matrices store the NaN diagonal as null (E is an ErrorArray { ids, criteria, e }); {"$num": "<decimal>"} is
// Number(decimal) (an exact 17-digit double, "Infinity", "-Infinity" or "NaN"); {"$sum": [a, b]} is a + b in double.
// Shapes are normalized here, never the values:
//   claimsByDistance        [{ distance, count, expected, max }] -> distance[], count[], expected[], max[]
//   maxCoefficientError     at[k] -> { i, j }
//   leastCertainPairs       [{ i, j, e, above, apart? }] -> count, pairs [[i, j]], e, above, apart (null where absent),
//                           apartPresent (some pair has an `apart` key)
//   intervalOverlapTally    pairs[] -> pairs [[i, j]], amount[], nested[] (null where absent), nestedCount
//   majorityWins            cycleTriples (null when absent)
//   leagueOvershoot         draws[] -> r, seeds, units, overshoot, posteriorOvershoot; a non-finite priorSd as String
//   drawErrorsOfGaussianDraws  drawErrors(gaussianDraws(means, sds, S, seed), { ids, criteria }) (the 1.17 pipeline)
//   throws                  { threw, rangeError, typeError, namesKey } (namesKey: the message names args.unknownKey)
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const decode = (x) => {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map(decode);
  if ("$num" in x) return Number(x.$num);
  if ("$sum" in x) return x.$sum.reduce((s, v) => s + v);
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, decode(v)]));
};
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const cube = (x) => (x && !Array.isArray(x) && !ArrayBuffer.isView(x) && "e" in x ? x.e : x);
const arr = (x) => Array.from(x, nn);
const mat = (m) => Array.from(m, (r) => Array.from(r, nn));
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, decode(a[k])]));
const opts = (a, keys) => (a.opts !== undefined ? decode(a.opts) : pick(a, keys));
const echo = (x) => (typeof x === "number" && !Number.isFinite(x) ? String(x) : x);
const need = (pc, name) => {
  if (typeof pc[name] !== "function") throw new Error(`no export ${name} (engine/API.md Step 3.27)`);
  return pc[name];
};
const threw = (f, a) => {
  try { f(); } catch (err) {
    return { threw: true, rangeError: err instanceof RangeError, typeError: err instanceof TypeError,
             namesKey: a.unknownKey === undefined ? null : String(err?.message ?? "").includes(a.unknownKey) };
  }
  return { threw: false, rangeError: false, typeError: false, namesKey: false };
};
const NEW = ["pairDifference", "normalCoverage", "withinBand", "sharedMeanPosterior", "claimsByDistance", "finiteLawCells",
  "binomialMcse", "maxCoefficientError", "chainCountLaw", "runningMean"];

export const RUN = {
  // ---- new functions -------------------------------------------------------------------------------------------
  pairDifference: (a, pc) => {
    const r = need(pc, "pairDifference")(decode(a.meanA), decode(a.sdA), decode(a.meanB), decode(a.sdB), opts(a, ["corr"]));
    return { mean: r.mean, sd: r.sd, z: r.z, pi: r.pi };
  },
  normalCoverage: (a, pc) => ({ coverage: need(pc, "normalCoverage")(decode(a.k)) }),
  withinBand: (a, pc) => {
    const r = need(pc, "withinBand")(decode(a.est), decode(a.se), opts(a, ["ref", "crit"]));
    return { within: r.within, n: r.n, share: r.share, expected: r.expected };
  },
  sharedMeanPosterior: (a, pc) => {
    const r = need(pc, "sharedMeanPosterior")(decode(a.est), decode(a.se), opts(a, ["priorSd", "meanSd", "priorMean"]));
    return { weight: arr(r.weight), muMean: r.muMean, muVar: r.muVar, means: arr(r.means), sds: arr(r.sds), corr: mat(r.corr) };
  },
  claimsByDistance: (a, pc) => {
    const r = Array.from(need(pc, "claimsByDistance")(a.g, errIn(a.E), opts(a, ["w"])));
    return { distance: r.map((x) => x.distance), count: r.map((x) => x.count), expected: r.map((x) => x.expected), max: r.map((x) => x.max) };
  },
  finiteLawCells: (a, pc) => {
    const r = need(pc, "finiteLawCells")(decode(a.states), decode(a.probs), opts(a, ["i", "j", "criterion"]));
    return { rowValues: arr(r.rowValues), colValues: arr(r.colValues), cells: mat(r.cells) };
  },
  binomialMcse: (a, pc) => ({ mcse: need(pc, "binomialMcse")(decode(a.e), decode(a.S)) }),
  maxCoefficientError: (a, pc) => {
    const r = need(pc, "maxCoefficientError")(errIn(a.Ehat), errIn(a.E));
    return { epsilon: arr(r.epsilon), at: Array.from(r.at, (x) => ({ i: x.i, j: x.j })) };
  },
  chainCountLaw: (a, pc) => {
    const r = need(pc, "chainCountLaw")(opts(a, ["p01", "p10", "S", "radius"]));
    return { pi1: r.pi1, probs: arr(r.probs), outside: nn(r.outside) };
  },
  runningMean: (a, pc) => ({ running: arr(need(pc, "runningMean")(decode(a.trace))) }),
  // ---- extensions (existing functions with new fields or options) ------------------------------------------------
  disclosure: (a, pc) => {
    const r = pc.disclosure(a.g);
    return { M: r.M, N: r.N, s: r.s, G: r.G, sizes: arr(r.sizes), withheld: nn(r.withheld) };
  },
  leastCertainPairs: (a, pc) => {
    const r = Array.from(pc.leastCertainPairs(errIn(a.E), opts(a, ["k", "w", "order"])));
    return { count: r.length, pairs: r.map((p) => [p.i, p.j]), e: r.map((p) => p.e), above: r.map((p) => p.above),
             apart: r.map((p) => nn(p.apart)), apartPresent: r.some((p) => "apart" in p) };
  },
  leastCertainPairsOrderThrows: (a, pc) => {
    const E = errIn(a.E), o = opts(a, ["k", "w", "order"]);
    pc.leastCertainPairs(E, { ...o, order: Array.from({ length: E.ids.length }, (_, i) => i) });   // must accept `order`
    return threw(() => pc.leastCertainPairs(E, o), a);
  },
  intervalOverlapTally: (a, pc) => {
    const r = pc.intervalOverlapTally(a.lower, a.upper, toNaN(a.pi), pick(a, ["threshold"]));
    const P = Array.from(r.pairs);
    return { pairs: P.map((p) => [p.i, p.j]), amount: P.map((p) => nn(p.amount)), nested: P.map((p) => (p.nested === undefined ? null : p.nested)),
             nestedCount: nn(r.nestedCount) };
  },
  majorityWins: (a, pc) => {
    const r = pc.majorityWins(errIn(a.E), pick(a, ["w", "tieTol"]));
    return { wins: arr(r.wins), ties: arr(r.ties), order: arr(r.order), cycles: r.cycles, strictOrder: r.strictOrder,
             cycleTriples: r.cycleTriples === undefined ? null : Array.from(r.cycleTriples, arr) };
  },
  formatProb: (a, pc) => ({ text: pc.formatProb(...decode(a.call ?? [])) }),
  // ---- read-out pins (existing functions) --------------------------------------------------------------------------
  simulateEstimates: (a, pc) => ({ estimates: arr(pc.simulateEstimates(a.truth, a.se, a.count, a.seed)) }),
  leagueOvershoot: (a, pc) => {
    const r = pc.leagueOvershoot(a.seed, pick(a, ["replays", "k", "side", "priorSd"]));
    const d = Array.from(r.draws);
    return {
      seed: r.seed, replays: r.replays, k: r.k, side: r.side, priorSd: echo(r.priorSd),
      r: d.map((x) => x.r), seeds: d.map((x) => x.seed), units: d.map((x) => arr(x.units)),
      overshoot: d.map((x) => x.overshoot), posteriorOvershoot: d.map((x) => nn(x.posteriorOvershoot)),
      mean: { overshoot: r.mean.overshoot, posteriorOvershoot: nn(r.mean.posteriorOvershoot) },
    };
  },
  meanSquaredDistance: (a, pc) => ({ value: pc.meanSquaredDistance(a.a, a.b) }),
  expectedSquaredDistance: (a, pc) => {
    const r = pc.expectedSquaredDistance(a.theta, a.se, pick(a, ["priorSd", "priorMean"]));
    return { perUnit: arr(r.perUnit), mean: r.mean, rawMean: r.rawMean };
  },
  pairCertainty: (a, pc) => {
    const r = pc.pairCertainty(errIn(a.E), pick(a, ["w", "thresholds"]));
    return { M: r.M, thresholds: arr(r.thresholds), counts: arr(r.counts) };
  },
  fartherCount: (a, pc) => {
    const r = pc.fartherCount(a.estimates, a.posteriorMeans, a.truth);
    return { count: r.count, units: arr(r.units), flags: Array.from(r.flags) };
  },
  misorderedPairs: (a, pc) => ({ count: pc.misorderedPairs(a.a, a.b).count }),
  expectedMisorderedPairs: (a, pc) => ({ expected: pc.expectedMisorderedPairs(a.theta, a.se, pick(a, ["priorSd", "priorMean"])) }),
  normalPosterior: (a, pc) => {
    const r = pc.normalPosterior(a.est, a.se, pick(a, ["priorMean", "priorSd"]));
    return { mean: nn(r.mean), sd: nn(r.sd), shrink: nn(r.shrink) };
  },
  errorArray: (a, pc) => {
    const r = pc.errorArray(a.means, a.sds, pick(a, ["ids", "criteria", "orient"]));
    return { ids: nn(r.ids), criteria: nn(r.criteria), e: nn(cube(r)) };
  },
  pairDirection: (a, pc) => ({ pi: pc.pairDirection(a.meanA, a.sdA, a.meanB, a.sdB, pick(a, ["corr"])) }),
  finiteLawPairwise: (a, pc) => {
    const r = pc.finiteLawPairwise(a.states, a.probs, pick(a, ["ids", "criteria"]));
    return { pi: nn(cube(r.pi)), e: nn(cube(r.e)), t: nn(cube(r.t)) };
  },
  tieLawPairwise: (a, pc) => {
    const r = pc.tieLawPairwise(a.states, a.probs, pick(a, ["ids", "criteria"]));
    return { b: nn(cube(r.b)), t: nn(cube(r.t)), d: nn(cube(r.d)) };
  },
  rankSummaries: (a, pc) => {
    const r = pc.rankSummaries(a.law);
    return { means: arr(r.means), expectedRank: arr(r.expectedRank), pTop: mat(r.pTop) };
  },
  mixturePairDirection: (a, pc) => ({ pi: pc.mixturePairDirection(decode(a.components)) }),
  transformedMeans: (a, pc) => {
    const r = pc.transformedMeans(decode(a.law), pick(a, ["transform", "k", "criterion"]));
    return { means: arr(r.means), order: arr(r.order) };
  },
  drawErrorsOfGaussianDraws: (a, pc) => {
    const r = pc.drawErrors(pc.gaussianDraws(a.means, a.sds, a.S, a.seed), pick(a, ["ids", "criteria"]));
    return { ids: nn(r.ids), criteria: nn(r.criteria), e: nn(cube(r)) };
  },
  envelopeRadius: (a, pc) => ({
    radius: a.K === undefined ? pc.envelopeRadius(a.M, a.S, a.alpha, a.form) : pc.envelopeRadius(a.M, a.S, a.alpha, a.form, { K: a.K }),
  }),
};
for (const name of NEW) RUN[`${name}Throws`] = (a, pc) => { need(pc, name); return threw(() => RUN[name](a, pc), a); };

// Tolerances (|a - e| <= abs + rel |e|). Expected values are written with 15 significant digits, which alone moves a
// value by up to 5e-15 relative, so "exact" doubles that are not short decimals get rel 1e-14.
//   exact (default): counts, indices, grades, orders, booleans, strings, throws, echoed inputs.
//   rel 1e-14: one or a few correctly rounded operations on input doubles, identical in both languages when the
//     specification fixes the order (pairDifference sd/z, amount, epsilon, binomialMcse, B, sds, corr, pi1, radii);
//     pnorm against the engine's normalCdf (a few ulps, relative even in the far tail: pi, e); exact count shares (e of
//     drawErrors, finite-law pi/e/t/b/d, cells with probs null); input values (rowValues, colValues, max).
//   rel 1e-13: chain probs (the literal forward recursion is bit-identical; room for an equivalent ordering).
//   abs 1e-15 + rel 1e-14: differences of nearby normalCdf values and short sums that can be near zero (share,
//     coverage, muMean, means, mean, running, value, estimates, overshoots: seeded normals agree to ~2 ulp).
//   rel 1e-13: expected (sums of up to 96 errors in claimsByDistance; 435 pnorm terms in expectedMisorderedPairs).
//   abs 1e-14 + rel 1e-13: outside (a plain and a compensated sum over up to 1,001 terms differ by < 1e-15 here).
const R14 = { abs: 0, rel: 1e-14 };
const NEAR0 = { abs: 1e-15, rel: 1e-14 };
export default {
  group: "oracle-v3p1",
  functions: [...NEW, "disclosure", "leastCertainPairs", "intervalOverlapTally", "majorityWins", "formatProb"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  default: { abs: 0, rel: 0 },
  tolerance: {
    sd: R14, z: R14, pi: R14, e: R14, t: R14, b: R14, d: R14, amount: R14, epsilon: R14, mcse: R14, weight: R14, muVar: R14,
    sds: R14, corr: R14, pi1: R14, radius: R14, s: R14, max: R14, rowValues: R14, colValues: R14, cells: R14, shrink: R14,
    perUnit: R14, rawMean: R14,
    share: NEAR0, coverage: NEAR0, muMean: NEAR0, means: NEAR0, mean: NEAR0, running: NEAR0, value: NEAR0, estimates: NEAR0,
    overshoot: NEAR0, posteriorOvershoot: NEAR0, expectedRank: NEAR0, pTop: NEAR0,
    probs: { abs: 0, rel: 1e-13 }, expected: { abs: 0, rel: 1e-13 }, outside: { abs: 1e-14, rel: 1e-13 },
  },
};
