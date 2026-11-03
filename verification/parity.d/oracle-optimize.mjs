// Parity for engine/src/optimize.ts against base-R enumeration (r-export/04_optimize.R, group oracle-optimize):
// exactOptimum on the six tutorial sites (one and two scores, every family of the API, budgets q), the theory book's
// three- and four-unit laws (ch. 10, 14, 16), eight sites unrestricted (545,835 reports) and the twelve CDE schools
// with at most three grades (523,251 reports); weightPath (K = 2, a grid of first-criterion weights); enumerateReports
// (canonical, lexicographic); fixedOrderDP against a brute force over every contiguous cut set. Each golden row
// names the engine function in args.fn.
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN before the call.
// Tied optima: the engine's `grades` are compared in the order returned, which API.md fixes as lexicographic (the
// golden list is lexicographic), and `grade` must be the lexicographically first optimum for every family that is not
// an order family (the order-family rows here have a unique optimum). family.size is compared as returned: a number
// up to 2^53 (decision E-12).
// Rows whose array comes from a package dataset (args.arraySource = "package") are wrapped as { pkg: ... } so that
// they get the 1e-10 tolerance below.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const arr = (g) => Array.from(g);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const wrap = (a, out) => (a.arraySource === "package" ? { pkg: out } : out);
const optimum = (r) => (r.empty
  ? { empty: true, familySize: r.family.size }
  : { grade: arr(r.grade), grades: Array.from(r.grades, arr), risk: r.risk, familySize: r.family.size,
      containsAllWithheld: r.containsAllWithheld, label: r.label });

const RUN = {
  exactOptimum: (a, pc) => wrap(a, optimum(pc.exactOptimum(errIn(a.E), pick(a, ["tau", "w", "family", "q", "tieTol"])))),
  enumerateReports: (a, pc) => {
    const reports = Array.from(pc.enumerateReports(a.n, a.family), arr);   // copy each yield (a reused buffer is fine)
    return { count: reports.length, reports };
  },
  // weightPath: one entry per grid weight (an array, or an object holding one); each entry's optimum grade and risk.
  weightPath: (a, pc) => {
    const list = pc.weightPath(errIn(a.E), { tau: a.tau, family: a.family, grid: a.grid });
    return { grade: list.map((x) => arr(x.grade)), risk: list.map((x) => x.risk) };
  },
  fixedOrderDP: (a, pc) => {
    const r = pc.fixedOrderDP(errIn(a.E), pick(a, ["order", "tau", "w", "G", "exact", "blocks"]));
    return wrap(a, { grade: arr(r.grade), risk: r.risk, label: r.label });
  },
};

export default {
  group: "oracle-optimize",
  functions: ["exactOptimum", "enumerateReports", "weightPath", "fixedOrderDP"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Closed-form inputs (pnorm coefficients, exact rationals) and exact counts: 1e-12 absolute. The oracle computes
  // every value from the same 15-significant-digit inputs the engine receives, and every case has its tie set
  // separated from the next report by more than 1e-10 in risk, so summation order cannot change the optima.
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // The CDE array (pr_case_cde$input$e, numerical quadrature probabilities from the package): 1e-10 absolute.
    pkg: { abs: 1e-10, rel: 0 },
  },
};
