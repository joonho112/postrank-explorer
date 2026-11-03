// Parity for the Step 7.1 Part 3 helpers (engine/API.md "Step 7.1: Part 3 helpers" and its implementation notes) against
// base R (r-export/16_part3.R, group oracle-part3): statedAgainst, relationChange, cutGrade (report.ts), bestReports
// (optimize.ts), reportsAtN and ruleGap (frontier.ts) on the six sites (score A; A + B with weights), the frozen 30-unit
// league and its first eight units (R-02, R-04), the theory book's ch. 19 three-unit law, the twelve CDE schools (S-01,
// 523,251 reports with at most three grades) and the KRW lambda-grid cards (S-02). Each golden row names the engine
// function in args.fn; "<fn>Throws" rows expect the call to throw (and, where the API says so, a RangeError).
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN before the call.
// Shapes are normalized here, never the values:
//   statedAgainst  pairs [{ above, below }] -> [[above, below]] in the engine's order (pair order of the API);
//   relationChange pairs [{ i, j, from, to, error }] -> pairs [[i, j]], from, to, error (null when withheld or no E);
//   bestReports / reportsAtN  family.size (Number) as `size`, reports -> grade, risk, N, Ew arrays in listed order;
//   ruleGap        lower/upper vertices -> lowerN, lowerEw, upperN, upperEw.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const arr = (g) => Array.from(g);
const nn = (x) => (x === undefined || (typeof x === "number" && Number.isNaN(x)) ? null : x);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const wrap = (a, out) => (a.arraySource === "package" ? { pkg: out } : out);
// Throw rows: { threw } always, and { rangeError } compared only where the golden row expects it (API: "a RangeError").
const threw = (f) => { try { f(); return { threw: false, rangeError: false }; } catch (err) { return { threw: true, rangeError: err instanceof RangeError }; } };
const reportsOut = (r) => ({
  size: Number(r.family.size), matched: r.matched, count: r.count, N: r.N,
  grade: r.reports.map((x) => arr(x.grade)), risk: r.reports.map((x) => x.risk), Ns: r.reports.map((x) => x.N),
  Ew: r.reports.map((x) => x.Ew),
});

const RUN = {
  statedAgainst: (a, pc) => {
    const r = a.direction === undefined ? pc.statedAgainst(a.g, a.scores) : pc.statedAgainst(a.g, a.scores, { direction: a.direction });
    return { count: r.count, pairs: Array.from(r.pairs, (p) => [p.above, p.below]), units: arr(r.units) };
  },
  statedAgainstThrows: (a, pc) => threw(() => pc.statedAgainst(a.g, a.scores, a.opts)),
  relationChange: (a, pc) => {
    const r = a.w === undefined ? pc.relationChange(a.g0, a.g1, a.E ? errIn(a.E) : null)
      : pc.relationChange(a.g0, a.g1, a.E ? errIn(a.E) : null, { w: a.w });
    const list = Array.from(r.pairs ?? []);
    return { M: r.M, nSame: r.nSame, nNewDisclosed: r.nNewDisclosed, nNewWithheld: r.nNewWithheld, nReversed: r.nReversed,
      agreement: r.agreement, pairs: list.map((p) => [p.i, p.j]), from: list.map((p) => p.from), to: list.map((p) => p.to),
      error: list.map((p) => nn(p.error)) };
  },
  relationChangeThrows: (a, pc) => threw(() => (a.w === undefined
    ? pc.relationChange(a.g0, a.g1, a.E ? errIn(a.E) : null) : pc.relationChange(a.g0, a.g1, a.E ? errIn(a.E) : null, { w: a.w }))),
  cutGrade: (a, pc) => {
    const o = pick(a, ["order", "blocks"]);
    return { grade: arr(Object.keys(o).length ? pc.cutGrade(a.n, a.cuts, o) : pc.cutGrade(a.n, a.cuts)) };
  },
  cutGradeThrows: (a, pc) => {
    const o = pick(a, ["order", "blocks"]);
    return threw(() => (Object.keys(o).length ? pc.cutGrade(a.n, a.cuts, o) : pc.cutGrade(a.n, a.cuts)));
  },
  bestReports: (a, pc) => {
    const r = reportsOut(pc.bestReports(errIn(a.E), pick(a, ["tau", "w", "family", "k", "stating", "tieTol"])));
    return wrap(a, { size: r.size, matched: r.matched, grade: r.grade, risk: r.risk, N: r.Ns, Ew: r.Ew });
  },
  bestReportsThrows: (a, pc) => threw(() => pc.bestReports(errIn(a.E), a.opts)),
  reportsAtN: (a, pc) => {
    const r = reportsOut(pc.reportsAtN(errIn(a.E), pick(a, ["w", "family", "N", "k", "tieTol"])));
    return wrap(a, { size: r.size, N: r.N, count: r.count, grade: r.grade, Ew: r.Ew });
  },
  reportsAtNThrows: (a, pc) => threw(() => pc.reportsAtN(errIn(a.E), a.opts)),
  ruleGap: (a, pc) => {
    const r = pc.ruleGap(a.g, errIn(a.E), pick(a, ["w", "hull", "tieTol"]));
    return { N: r.N, Ew: r.Ew, H: r.H, gap: r.gap, psi: nn(r.psi), lowerN: r.lower?.N ?? null, lowerEw: r.lower?.Ew ?? null,
      upperN: r.upper?.N ?? null, upperEw: r.upper?.Ew ?? null, onFrontier: r.onFrontier };
  },
  ruleGapThrows: (a, pc) => threw(() => pc.ruleGap(a.g, errIn(a.E), pick(a, ["w", "hull"]))),
};

export default {
  group: "oracle-part3",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Exact counts, exact rationals and pnorm inputs with 15 significant digits; the oracle computes every value from the
  // same inputs the engine receives, and every listed tie set is separated from the next value by more than 1e-10, so
  // summation order cannot change which reports are listed: 1e-12 absolute (risks, Ew, H and gaps below 25).
  default: { abs: 1e-12, rel: 0 },
  tolerance: { pkg: { abs: 1e-10, rel: 0 } },
};
