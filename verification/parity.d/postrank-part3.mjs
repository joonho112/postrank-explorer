// Parity for the Step 7.1 Part 3 helpers against postrank 1.1.0 (r-export/16_part3.R, group postrank-part3), with no
// solve: relationChange counts from postrank_compare(<cached analysis>, <grades>, baselines = character())$relations
// (case_cde_12 against the tertiles, all withheld and the strict posterior-mean order; tutorial_one, tutorial_two and
// case_krw_signed97 against supplied grades), and bestReports (k = 1) / reportsAtN (at the optimum's N) from the archived
// HiGHS optima of case_cde_12, tutorial_one and tutorial_two and the archived tutorial_frontier (an optimum at tau has
// the smallest Ew among the family's reports with its N). Each optimum is unique by more than 1e-10 (checked in R).
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN before the call.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const arr = (g) => Array.from(g);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const wrap = (a, out) => (a.arraySource === "package" ? { pkg: out } : out);

const RUN = {
  relationChange: (a, pc) => {
    const r = pc.relationChange(a.g0, a.g1, a.E ? errIn(a.E) : null);
    return { M: r.M, nSame: r.nSame, nNewDisclosed: r.nNewDisclosed, nNewWithheld: r.nNewWithheld, nReversed: r.nReversed, agreement: r.agreement };
  },
  bestReports: (a, pc) => {
    const r = pc.bestReports(errIn(a.E), pick(a, ["tau", "w", "family", "k"]));
    return wrap(a, { grade: r.reports.map((x) => arr(x.grade)), risk: r.reports.map((x) => x.risk), N: r.reports.map((x) => x.N), Ew: r.reports.map((x) => x.Ew) });
  },
  reportsAtN: (a, pc) => {
    const r = pc.reportsAtN(errIn(a.E), pick(a, ["w", "family", "N", "k"]));
    return wrap(a, { grade: r.reports.map((x) => arr(x.grade)), Ew: r.reports.map((x) => x.Ew) });
  },
};

export default {
  group: "postrank-part3",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Counts are exact (agreement = nSame/M to 1e-12). Package arrays (pr_case_cde, pr_tutorial; full precision, written
  // with 15 significant digits) against the package's archived risks and E: 1e-10 absolute.
  default: { abs: 1e-12, rel: 0 },
  tolerance: { pkg: { abs: 1e-10, rel: 0 } },
};
