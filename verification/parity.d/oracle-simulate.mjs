// Parity for engine/src/simulate.ts against base R (r-export/08_simulate.R, group oracle-simulate): the SR-06 league
// and its seeded draws (engine/API.md "Simulated league specification"; the stream is r-export/_rng.R), the teaching
// normal-normal posterior, closed-form expected misordered pairs, order statistics, exact rank summaries of finite
// laws, KRW Example 1's band, envelope radii (package form, and the theory book ch. 15 form with K criteria), MCSE and
// the fragility rule. Each row names its function in args.fn.
// Results are read in the shapes engine/README.md documents:
//   league30 { ids, size, group, se, theta, rank }; drawLeague { seed, estimate }; simulateEstimates -> array;
//   normalPosterior { mean, sd, shrink }; normalInterval { lower, upper }; expectedMisorderedPairs -> number;
//   misorderedPairs, topKOverlap { count, ... }; extremeCounts { top, bottom } keyed by group;
//   rankSummaries { means, expectedRank, pTop } (pTop[k][i] = Pr(rank_i <= k + 1)); krwExample1Band { empty, lower,
//   upper }; envelopeRadius(M, S, alpha, form, { K }) -> number; mcse -> number | null;
//   fragilePairs { screenMargin, pairs: [{ i, j, betterDirection, weightedError, margin, mcse, fragile }], summary }:
//     compared are the fragile set (pairs, count), the screen, the traced pairs in the package's order (upper
//     triangle, column-major) with their direction, weighted error, margin, MCSE and flag, and the summary. A null
//     flag with S >= 2 is an error (MCSE is defined for every traced pair once there are two draws).
const isArr = (x) => Array.isArray(x) || ArrayBuffer.isView(x);
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const lex = (p, q) => p[0] - q[0] || p[1] - q[1];

export const RUN = {
  league30: (a, pc) => { const r = pc.league30(); return Object.fromEntries(["ids", "size", "group", "se", "theta", "rank"].map((f) => [f, nn(Array.from(r[f]))])); },
  drawLeague: (a, pc) => { const r = pc.drawLeague(a.seed); return { seed: r.seed, estimate: nn(Array.from(r.estimate)) }; },
  simulateEstimates: (a, pc) => ({ estimates: nn(Array.from(pc.simulateEstimates(a.truth, a.se, a.count, a.seed))) }),
  normalPosterior: (a, pc) => {
    const r = pc.normalPosterior(a.est, a.se, { priorMean: a.priorMean, priorSd: a.priorSd });
    return { mean: nn(r.mean), sd: nn(r.sd), shrink: nn(r.shrink) };
  },
  normalInterval: (a, pc) => { const r = pc.normalInterval(a.mean, a.sd, a.level); return { lower: r.lower, upper: r.upper }; },
  expectedMisorderedPairs: (a, pc) => ({ expected: pc.expectedMisorderedPairs(a.theta, a.se, a.priorSd === undefined ? {} : { priorSd: a.priorSd }) }),
  misorderedPairs: (a, pc) => ({ count: pc.misorderedPairs(a.a, a.b).count }),
  topKOverlap: (a, pc) => ({ count: pc.topKOverlap(a.a, a.b, a.k).count }),
  extremeCounts: (a, pc) => {
    const r = pc.extremeCounts(a.score, a.group, a.k);
    const groups = [...new Set(a.group)].sort();
    return Object.fromEntries(["top", "bottom"].map((side) => [side, Object.fromEntries(groups.map((g) => [g, r[side][g]]))]));
  },
  rankSummaries: (a, pc) => {
    const r = pc.rankSummaries(a.law);
    return { mean: nn(r.means), expectedRank: nn(r.expectedRank), pFirst: nn(r.pTop[0]), pTop: nn(r.pTop) };
  },
  krwExample1Band: (a, pc) => {
    const r = pc.krwExample1Band(a.tau);
    return r.empty ? { empty: true } : { empty: false, lower: r.lower, upper: r.upper };
  },
  envelopeRadius: (a, pc) => ({ radius: a.K === undefined ? pc.envelopeRadius(a.M, a.S, a.alpha, a.form) : pc.envelopeRadius(a.M, a.S, a.alpha, a.form, { K: a.K }) }),
  mcse: (a, pc) => ({ mcse: nn(pc.mcse(a.trace)) }),
  fragilePairs: (a, pc) => {
    const r = pc.fragilePairs(a.draws, { tau: a.tau, w: a.w, z: a.z });
    if (r.S >= 2 && r.pairs.some((p) => typeof p.fragile !== "boolean")) throw new Error("fragile flag is not a boolean with S >= 2");
    const fragile = r.pairs.filter((p) => p.fragile === true).map((p) => [p.i, p.j]).sort(lex);
    return {
      pairs: fragile, count: fragile.length, screenMargin: r.screenMargin,
      traced: r.pairs.map((p) => [p.i, p.j]), betterDirection: r.pairs.map((p) => p.betterDirection),
      weightedError: r.pairs.map((p) => p.weightedError), margin: r.pairs.map((p) => p.margin),
      mcseTraced: r.pairs.map((p) => nn(p.mcse)), flags: r.pairs.map((p) => p.fragile),
      summary: { pairs: r.summary.pairs, traced: r.summary.traced, fragile: r.summary.fragile, fragileShare: r.summary.fragileShare,
                 mcseUnavailable: r.summary.mcseUnavailable },
    };
  },
};

export default {
  group: "oracle-simulate",
  functions: ["league30", "drawLeague", "simulateEstimates", "normalPosterior", "normalInterval", "expectedMisorderedPairs",
    "misorderedPairs", "topKOverlap", "extremeCounts", "rankSummaries", "krwExample1Band", "envelopeRadius", "mcse", "fragilePairs"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Closed forms, exact counts and exact finite-law sums: 1e-12 absolute (the 435-term misordered-pair sums have
  // magnitude below 100, so summation order moves them by ~1e-14).
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // Seeded normals agree with R to a few ulps (different libm for log, cos, sin): relative 1e-14 on
    // theta + se * z, with a 1e-15 absolute floor for estimates near zero.
    estimate: { abs: 1e-15, rel: 1e-14 },
    estimates: { abs: 1e-15, rel: 1e-14 },
  },
};
