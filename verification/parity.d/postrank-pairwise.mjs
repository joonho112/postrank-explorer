// Parity for engine/src/pairwise.ts against postrank 1.1.0 (r-export/02_pairwise.R, group postrank-pairwise):
// pr_tutorial and pr_example_gaussian arrays (postrank_gaussian_coefficients: closed-form pnorm), postrank_pairwise()
// on postrank_toy draws, and postrank_pairwise()/postrank_tie_pairwise() on exact finite laws (gmp rationals).
// Each golden row names the engine function in args.fn; engine outputs are mapped NaN -> null before comparison.
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const cube = (x) => (x && !Array.isArray(x) && !ArrayBuffer.isView(x) && "e" in x ? x.e : x);
const errorArrayOut = (r) => ({ ids: nn(r.ids), criteria: nn(r.criteria), e: nn(cube(r)) });

const RUN = {
  errorArray: (a, pc) => errorArrayOut(pc.errorArray(a.means, a.sds, { ids: a.ids, criteria: a.criteria, orient: a.orient })),
  drawErrors: (a, pc) => errorArrayOut(pc.drawErrors(a.draws, { ids: a.ids, criteria: a.criteria })),
  finiteLawPairwise: (a, pc) => ({ e: nn(cube(pc.finiteLawPairwise(a.states, a.probs, { ids: a.ids, criteria: a.criteria }).e)) }),
  tieLawPairwise: (a, pc) => {
    const r = pc.tieLawPairwise(a.states, a.probs, { ids: a.ids, criteria: a.criteria });
    return { b: nn(cube(r.b)), t: nn(cube(r.t)), d: nn(cube(r.d)) };
  },
};

export default {
  group: "postrank-pairwise",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Every package value here is closed form (pnorm of a z-score, draw shares, exact rationals projected to double;
  // the package truncates rationals, so it can sit 1 ulp from the engine's rounded quotient): 1e-12 absolute.
  default: { abs: 1e-12, rel: 0 },
};
