// Parity for the v3 helpers (engine/API.md "v3 helpers (Phase 2, Step 2.1)") against base R (r-export/17_v3_helpers.R,
// group oracle-v3): topKOvershoot, leagueOvershoot, expectedSquaredDistance, finiteLawMargins, majorityWins,
// weightedRadius, regretBound, twoStateChain, chainMeanVariance, wrongCountDistribution, disclosedErrorEstimands (case
// weights), leagueGradingReplays, largestStatedError, leastCertainPairs, transformedMeans, selectionOnDraws,
// pairCertainty. Each row names its function in args.fn and keeps the options as top-level args (passed only when
// present, so the engine's defaults are exercised); "transformedMeansThrows" rows expect the call to throw (and, where
// the API says so, a RangeError).
// Inputs: matrices store the NaN diagonal as null (E is an ErrorArray { ids, criteria, e }); {"$num": "Infinity"} is the
// flat prior SD; {"$sum": [a, b]} is a + b in double precision (a value one ulp off a decimal).
// Shapes are normalized here, never the values:
//   leagueOvershoot      draws[] -> r, seeds, units, overshoot, posteriorOvershoot (arrays in replay order)
//   finiteLawMargins     margins[i][k] -> values[i][k], probs[i][k]
//   leagueGradingReplays draws[] -> r, seeds, grade, N, E, EoverN, D, DoverN, risk; a one-criterion E, E/N, D or D/N
//                        given as a one-element array is read as its element (API.md names them per draw)
//   largestStatedError   null -> { isNull: true, e: null, i: null, j: null }
//   leastCertainPairs    [{ i, j, e, above }] -> count, pairs [[i, j]], e, above
//   echoes               a non-finite priorSd is compared as its string ("Infinity")
const isArr = (x) => Array.isArray(x) || ArrayBuffer.isView(x);
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
const arr = (x) => Array.from(x, nn);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, decode(a[k])]));
const echo = (x) => (typeof x === "number" && !Number.isFinite(x) ? String(x) : x);
const one = (x) => (isArr(x) && x.length === 1 ? x[0] : x);
const threw = (f) => { try { f(); return { threw: false, rangeError: false }; } catch (err) { return { threw: true, rangeError: err instanceof RangeError }; } };
// seed first, then the options object; with neither, the function is called without arguments (all defaults).
const seeded = (pc, name, a, keys) => {
  const o = pick(a, keys);
  if (Object.keys(o).length) return pc[name](a.seed, o);
  return a.seed === undefined ? pc[name]() : pc[name](a.seed);
};
const ESTIMANDS = ["ERR", "meanFraction", "zeroImputed", "positiveFrequency", "meanDisclosure"];

export const RUN = {
  topKOvershoot: (a, pc) => {
    const r = pc.topKOvershoot(a.estimate, a.truth, pick(a, ["k", "side", "posterior"]));
    return { k: r.k, side: r.side, units: arr(r.units), overshoot: r.overshoot, posteriorOvershoot: nn(r.posteriorOvershoot) };
  },
  leagueOvershoot: (a, pc) => {
    const r = seeded(pc, "leagueOvershoot", a, ["replays", "k", "side", "priorSd"]);
    const d = Array.from(r.draws);
    return {
      seed: r.seed, replays: r.replays, k: r.k, side: r.side, priorSd: echo(r.priorSd),
      r: d.map((x) => x.r), seeds: d.map((x) => x.seed), units: d.map((x) => arr(x.units)),
      overshoot: d.map((x) => x.overshoot), posteriorOvershoot: d.map((x) => nn(x.posteriorOvershoot)),
      mean: { overshoot: r.mean.overshoot, posteriorOvershoot: nn(r.mean.posteriorOvershoot) },
    };
  },
  expectedSquaredDistance: (a, pc) => {
    const r = pc.expectedSquaredDistance(a.theta, a.se, pick(a, ["priorSd", "priorMean"]));
    return { perUnit: arr(r.perUnit), mean: r.mean, rawMean: r.rawMean };
  },
  finiteLawMargins: (a, pc) => {
    const r = pc.finiteLawMargins(decode(a.states), a.probs);
    const m = Array.from(r.margins, (u) => Array.from(u));
    return { values: m.map((u) => u.map((c) => arr(c.values))), probs: m.map((u) => u.map((c) => arr(c.probs))) };
  },
  majorityWins: (a, pc) => {
    const r = pc.majorityWins(errIn(a.E), pick(a, ["w", "tieTol"]));
    return { wins: arr(r.wins), ties: arr(r.ties), order: arr(r.order), cycles: r.cycles, strictOrder: r.strictOrder };
  },
  weightedRadius: (a, pc) => ({ value: a.w === undefined ? pc.weightedRadius(a.eps) : pc.weightedRadius(a.eps, a.w) }),
  regretBound: (a, pc) => {
    const r = pc.regretBound(pick(a, ["N", "Nstar", "M", "deltaW", "eta"]));
    return { evaluation: r.evaluation, regret: r.regret, uniform: r.uniform };
  },
  twoStateChain: (a, pc) => {
    const r = pc.twoStateChain(pick(a, ["p01", "p10", "S", "chains", "seed"]));
    return { p01: r.p01, p10: r.p10, S: r.S, seed: r.seed, pi1: r.pi1, chains: Array.from(r.chains, arr) };
  },
  chainMeanVariance: (a, pc) => {
    const r = pc.chainMeanVariance(pick(a, ["p01", "p10", "S"]));
    return { pi1: r.pi1, rho: r.rho, variance: r.variance, iidVariance: r.iidVariance, equivalentDraws: r.equivalentDraws,
             asymptoticEquivalent: nn(r.asymptoticEquivalent), noSwitch: r.noSwitch };
  },
  wrongCountDistribution: (a, pc) => {
    const r = pc.wrongCountDistribution(a.g, a.states, a.probs, pick(a, ["w"]));
    return { N: r.N, values: arr(r.values), probs: arr(r.probs), expected: r.expected, pNone: r.pNone,
             pAllCriteriaRight: r.pAllCriteriaRight, unionBound: r.unionBound };
  },
  disclosedErrorEstimands: (a, pc) => {
    const r = pc.disclosedErrorEstimands(a.cases, pick(a, ["M", "weights"]));
    return Object.fromEntries(ESTIMANDS.map((k) => [k, nn(r[k])]));
  },
  leagueGradingReplays: (a, pc) => {
    const r = seeded(pc, "leagueGradingReplays", a, ["replays", "priorSd", "tau", "cap"]);
    const d = Array.from(r.draws);
    return {
      seed: r.seed, replays: r.replays, priorSd: echo(r.priorSd), tau: r.tau, cap: r.cap,
      r: d.map((x) => x.r), seeds: d.map((x) => x.seed), grade: d.map((x) => arr(x.grade)), N: d.map((x) => x.N),
      E: d.map((x) => nn(one(x.E))), EoverN: d.map((x) => nn(one(x.EoverN))), D: d.map((x) => nn(one(x.D))),
      DoverN: d.map((x) => nn(one(x.DoverN))), risk: d.map((x) => x.risk),
      estimands: Object.fromEntries(ESTIMANDS.map((k) => [k, nn(r.estimands[k])])),
    };
  },
  largestStatedError: (a, pc) => {
    const r = pc.largestStatedError(a.g, errIn(a.E), pick(a, ["w"]));
    return r == null ? { isNull: true, e: null, i: null, j: null } : { isNull: false, e: r.e, i: r.i, j: r.j };
  },
  leastCertainPairs: (a, pc) => {
    const r = Array.from(pc.leastCertainPairs(errIn(a.E), pick(a, ["k", "w"])));
    return { count: r.length, pairs: r.map((p) => [p.i, p.j]), e: r.map((p) => p.e), above: r.map((p) => p.above) };
  },
  transformedMeans: (a, pc) => {
    const r = pc.transformedMeans(decode(a.law), pick(a, ["transform", "k", "criterion"]));
    return { means: arr(r.means), order: arr(r.order) };
  },
  transformedMeansThrows: (a, pc) => threw(() => pc.transformedMeans(decode(a.law), pick(a, ["transform", "k", "criterion"]))),
  selectionOnDraws: (a, pc) => {
    const r = pc.selectionOnDraws(a.draws, errIn(a.E), pick(a, ["tau", "w", "family"]));
    return { grade: arr(r.grade), N: r.N, inSample: r.inSample, exact: r.exact, gap: r.gap, epsilon: arr(r.epsilon),
             deltaW: r.deltaW, bound: r.bound, best: r.best, regret: r.regret, regretBound: r.regretBound };
  },
  pairCertainty: (a, pc) => {
    const r = pc.pairCertainty(errIn(a.E), pick(a, ["w", "thresholds"]));
    return { M: r.M, thresholds: arr(r.thresholds), counts: arr(r.counts) };
  },
};

// Tolerances (|a - e| <= abs + rel |e|). Expected values are written with 15 significant digits, which alone moves a
// value by up to 5e-15 relative, so "exact" doubles that are not short decimals get rel 1e-14.
//   exact (default): counts, indices, grades, orders, booleans, strings, echoed inputs, chain states (the uniforms
//     match the engine bit for bit), majority classes and cycle counts (no |ebar_ij - ebar_ji| within 1e-14 of tieTol).
//   rel 1e-14, abs 0: input doubles or single correctly rounded operations (margin values, A values, e, pi1, the
//     radius, the regret bound's evaluation and uniform, perUnit and rawMean, D/N, asymptoticEquivalent).
//   rel 1e-14, abs 1e-15: sums of products in the spec's order (the engine may compensate them; the oracle's reference
//     sums are compensated, and every sum here has at most 435 terms of magnitude below 1, so naive summation moves
//     them by ~1e-15), values that can be near zero (overshoots, gaps, regret, rho), seeded league values (normals
//     agree to ~2 ulp; the replay E sums move by < 4e-16 relative under +-2 ulp normals) and libm transforms
//     (exp, log, sqrt in transformedMeans).
//   rel 1e-13: variance, equivalentDraws, noSwitch of chainMeanVariance (rho^h and (1 - p)^(S - 1) by repeated
//     multiplication accumulate up to S - 1 roundings; S <= 200 here, so at most ~4.4e-14 with the sum).
const R14 = { abs: 0, rel: 1e-14 };
const SUM = { abs: 1e-15, rel: 1e-14 };
const POW = { abs: 0, rel: 1e-13 };
export default {
  group: "oracle-v3",
  functions: ["topKOvershoot", "leagueOvershoot", "expectedSquaredDistance", "finiteLawMargins", "majorityWins", "weightedRadius",
    "regretBound", "twoStateChain", "chainMeanVariance", "wrongCountDistribution", "disclosedErrorEstimands", "leagueGradingReplays",
    "largestStatedError", "leastCertainPairs", "transformedMeans", "selectionOnDraws", "pairCertainty"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  default: { abs: 0, rel: 0 },
  tolerance: {
    values: R14, e: R14, pi1: R14, value: R14, evaluation: R14, uniform: R14, perUnit: R14, rawMean: R14, DoverN: R14,
    asymptoticEquivalent: R14, iidVariance: R14,
    overshoot: SUM, posteriorOvershoot: SUM, mean: SUM, probs: SUM, expected: SUM, pNone: SUM, pAllCriteriaRight: SUM,
    unionBound: SUM, ERR: SUM, meanFraction: SUM, zeroImputed: SUM, positiveFrequency: SUM, meanDisclosure: SUM,
    E: SUM, EoverN: SUM, risk: SUM, estimands: SUM, regret: SUM, rho: SUM, means: SUM,
    inSample: SUM, exact: SUM, gap: SUM, epsilon: SUM, deltaW: SUM, bound: SUM, best: SUM, regretBound: SUM,
    variance: POW, equivalentDraws: POW, noSwitch: POW,
  },
};
