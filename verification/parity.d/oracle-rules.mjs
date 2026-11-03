// Parity for engine/src/rules.ts against base R (r-export/07_rules.R, group oracle-rules): strict orders, quantile
// tiers with the package's exact-score merging, evidence flags (theory book ch. 2) and weighted expected ranks.
// Each golden row names the engine function in args.fn; calls follow engine/API.md.
// Result mapping (engine/README.md shapes):
//   strictOrder, tierGrades -> { grade } from the returned grade vector
//   evidenceFlags           -> { grade, z } from { grade, z, labels }; the grade is compared exactly as returned (the
//                              API returns canonical labels: flagged above < not flagged < flagged below, 1..G)
//   expectedRank            -> { rank } from the returned vector
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const vec = (r) => Array.from(r, Number);

export const RUN = {
  strictOrder: (a, pc) => ({ grade: vec(pc.strictOrder(a.scores)) }),
  tierGrades: (a, pc) => ({ grade: vec(pc.tierGrades(a.scores, a.G)) }),
  evidenceFlags: (a, pc) => {
    const r = pc.evidenceFlags(a.est, a.se, { ref: a.ref, crit: a.crit });
    return { grade: vec(r.grade), z: vec(r.z) };
  },
  expectedRank: (a, pc) => ({ rank: vec(pc.expectedRank(errIn(a.E), { w: a.w })) }),
};

export default {
  group: "oracle-rules",
  functions: ["strictOrder", "tierGrades", "evidenceFlags", "expectedRank"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Grades are exact; z and expected ranks are closed forms (one division; sums of at most 6 pnorm values or exact
  // rationals, inputs with 15 significant digits): 1e-12 absolute.
  default: { abs: 1e-12, rel: 0 },
};
