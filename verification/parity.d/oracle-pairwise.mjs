// Parity for engine/src/pairwise.ts against base-R closed forms (r-export/02_pairwise.R, group oracle-pairwise).
// Each golden row names the engine function in args.fn; the call follows engine/API.md exactly.
// Golden matrices store the NaN diagonal as null, so engine outputs are mapped NaN -> null (typed arrays -> plain
// arrays) before comparison. No input of this group contains a matrix.
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
// An ErrorArray-shaped result may be a bare criterion-major Matrix[] or an ErrorArray object { ids, criteria, e }.
const cube = (x) => (x && !Array.isArray(x) && !ArrayBuffer.isView(x) && "e" in x ? x.e : x);
const threw = (f) => { try { f(); return { threw: false }; } catch { return { threw: true }; } };
const errorArrayOut = (r) => ({ ids: nn(r.ids), criteria: nn(r.criteria), e: nn(cube(r)) });

const RUN = {
  pairDirection: (a, pc) => ({ pi: pc.pairDirection(a.meanA, a.sdA, a.meanB, a.sdB, { corr: a.corr }) }),
  pairDirectionThrows: (a, pc) => threw(() => pc.pairDirection(a.meanA, a.sdA, a.meanB, a.sdB, { corr: a.corr })),
  directionMatrix: (a, pc) => ({ pi: nn(pc.directionMatrix(a.means, a.sds)) }),
  errorArray: (a, pc) => errorArrayOut(pc.errorArray(a.means, a.sds, { ids: a.ids, criteria: a.criteria, orient: a.orient })),
  finiteLawPairwise: (a, pc) => {
    const r = pc.finiteLawPairwise(a.states, a.probs, { ids: a.ids, criteria: a.criteria });
    return { pi: nn(cube(r.pi)), e: nn(cube(r.e)), t: nn(cube(r.t)) };
  },
  mixturePairDirection: (a, pc) => ({ pi: pc.mixturePairDirection(a.components) }),
  drawErrors: (a, pc) => errorArrayOut(pc.drawErrors(a.draws, { ids: a.ids, criteria: a.criteria })),
  tieLawPairwise: (a, pc) => {
    const r = pc.tieLawPairwise(a.states, a.probs, { ids: a.ids, criteria: a.criteria });
    return { b: nn(cube(r.b)), t: nn(cube(r.t)), d: nn(cube(r.d)) };
  },
};

export default {
  group: "oracle-pairwise",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Closed-form probabilities (pnorm of a z-score, sums of exact masses, draw shares): 1e-12 absolute. Inputs are
  // written with 15 significant digits (e.g. probabilities 1/3 as 0.333333333333333), which moves results by ~1e-15.
  default: { abs: 1e-12, rel: 0 },
};
