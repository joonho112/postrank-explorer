// Parity adapter for the Part 1 summary functions (group oracle-summaries).
// Shapes: engine/API.md "Step 5.14: Part 1 summaries".
const nn = (x) => (x === undefined ? null : Array.isArray(x) ? x.map(nn) : typeof x === "number" && Number.isNaN(x) ? null : x);

export const RUN = {
  summaryStats: (a, pc) => { const r = pc.summaryStats(a.values); return { n: r.n, mean: r.mean, sd: r.sd }; },
  meanSquaredDistance: (a, pc) => ({ value: pc.meanSquaredDistance(a.a, a.b) }),
  fartherCount: (a, pc) => { const r = pc.fartherCount(a.estimates, a.posteriorMeans, a.truth); return { count: r.count, units: r.units, flags: r.flags }; },
  intervalOverlapTally: (a, pc) => {
    const pi = a.pi ?? pc.directionMatrix(a.means, a.sds);
    const r = pc.intervalOverlapTally(a.lower, a.upper, pi, a.threshold === undefined ? {} : { threshold: a.threshold });
    return {
      apart: r.apart, overlapping: r.overlapping, high: r.high, low: r.low,
      best: r.best && { first: r.best.first, second: r.best.second, pi: r.best.pi },
      classes: r.pairs.map((p) => p.class), firsts: r.pairs.map((p) => p.first),
    };
  },
  rankIntervals: (a, pc) => { const r = pc.rankIntervals(a.pTop, { level: a.level }); return { lower: nn(r.lower), upper: nn(r.upper) }; },
  leagueReplays: (a, pc) => {
    const r = pc.leagueReplays(a.seed, { replays: a.replays, k: a.k, topK: a.topK });
    const by = (side) => r.draws.map((d) => ({ small: d.extreme[side].small, medium: d.extreme[side].medium, large: d.extreme[side].large }));
    return {
      seeds: r.seeds, extremeTotal: by("total"), extremeTop: by("top"), extremeBottom: by("bottom"),
      topOverlap: r.draws.map((d) => d.topOverlap), misordered: r.draws.map((d) => d.misordered), mean: r.mean,
    };
  },
  unitRelationCounts: (a, pc) => { const r = pc.unitRelationCounts(a.g); return { partners: r.partners, above: r.above, below: r.below, stated: r.stated, withheld: r.withheld }; },
};

export default {
  group: "oracle-summaries",
  functions: Object.keys(RUN),
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // counts and classes exact; means, SDs and squared distances to 1e-14 relative (R long-double mean, summation order)
  default: { abs: 0, rel: 0 },
  tolerance: { mean: { abs: 1e-15, rel: 1e-14 }, sd: { abs: 1e-15, rel: 1e-14 }, value: { abs: 1e-15, rel: 1e-14 }, best: { abs: 1e-15, rel: 1e-14 } },
};
