// Parity for engine/src/risk.ts against postrank 1.1.0 (r-export/03_report_risk.R, group postrank-report-risk):
// postrank_evaluate() on the six tutorial sites (one and two criteria) and on the KRW race card (pr_case_krw, tau .2,
// lambda .25), and postrank_tie_evaluate() on exact finite tie laws. Each row names its function in args.fn.
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN, outputs NaN -> null.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const tieIn = (t) => ({ ...t, b: toNaN(t.b), d: toNaN(t.d) });
const num = (x, key) => (typeof x === "number" ? x : x?.[key]);

const RUN = {
  evaluateReport: (a, pc) => nn(pc.evaluateReport(a.g, errIn(a.E), { tau: a.tau, w: a.w })),
  // One row carries the 97 x 97 KRW race array once; it checks evaluateReport and krwRisk on the same input.
  krwCard: (a, pc) => {
    const E = errIn(a.E);
    const r = nn(pc.evaluateReport(a.g, E, { tau: a.tau, w: [1] }));
    return { krwCard: { ...r, krwRisk: num(pc.krwRisk(a.g, E, { lambda: a.lambda }), "risk") } };
  },
  equalityNeutralRisk: (a, pc) => {
    const r = pc.equalityNeutralRisk(a.g, tieIn(a.tie), { tau: a.tau, w: a.w });
    return { risk: r.risk, R0: r.R0 };
  },
};

export default {
  group: "postrank-report-risk",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Six-site and tie-law values are closed form (pnorm coefficients, exact rationals; at most 15 pairs): 1e-12 absolute.
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // KRW pair probabilities come from KRW's numerical integration over the cell law; the golden file keeps them at
    // 15 significant digits, so the engine's sums over 1,324 stated pairs (E about 180) can differ from the
    // package's full-precision sums by about 1e-12. 1e-10 absolute leaves margin and is still 1e-12 relative to E.
    krwCard: { abs: 1e-10, rel: 0 },
  },
};
