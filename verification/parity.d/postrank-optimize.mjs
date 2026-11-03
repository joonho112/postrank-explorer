// Parity for engine/src/optimize.ts against postrank 1.1.0 (r-export/04_optimize.R, group postrank-optimize):
//   fixedOrderDP          postrank_cuts(rule = "optimal"), the package's contiguous-partition DP, on declared orders:
//                         the six tutorial sites (posterior-mean, B-A-C-D-E-F, composite, expected-rank and tied-score
//                         orders; caps and exact counts), 30 Gaussian sites (poverty, expected-rank order) and the
//                         67 Alabama counties (weighted expected-rank order, the archived B3 report). Exactly equal
//                         scores are indivisible blocks (args.blocks). Each optimum is unique among all contiguous cut
//                         sets by more than 1e-10 in risk (checked by brute force in R), so no tie rule decides it.
//   exactOptimumArchived  archived HiGHS optima from the package's cached analyses (tutorial_frontier: risk, N and G
//                         at five tau; case_cde_12: grade, risk, N, G); N and G are counted from the engine's grade.
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN before the call.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const arr = (g) => Array.from(g);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const wrap = (a, out) => (a.arraySource === "package" ? { pkg: out } : out);
const disclosed = (g) => { let N = 0; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i] !== g[j]) N += 1; return N; };

const RUN = {
  fixedOrderDP: (a, pc) => {
    const r = pc.fixedOrderDP(errIn(a.E), pick(a, ["order", "tau", "w", "G", "exact", "blocks"]));
    return wrap(a, { grade: arr(r.grade), risk: r.risk, label: r.label });
  },
  exactOptimumArchived: (a, pc) => {
    const r = pc.exactOptimum(errIn(a.E), pick(a, ["tau", "w", "family"]));
    const g = arr(r.grade);
    return wrap(a, { grade: g, risk: r.risk, N: disclosed(g), G: Math.max(...g) });
  },
};

export default {
  group: "postrank-optimize",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Six-site and 30-site Gaussian arrays are closed form (pnorm coefficients): 1e-12 absolute.
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // Precomputed package probability arrays (Alabama, CDE): 1e-10 absolute. The golden array keeps 15 significant
    // digits, so sums over up to 2,211 pairs can move by ~1e-13 against the package's full-precision values.
    pkg: { abs: 1e-10, rel: 0 },
  },
};
