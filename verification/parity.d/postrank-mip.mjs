// Parity for the browser MIP adapter mipSolve (engine/API.md "mip.ts", Step 2.11) against postrank 1.1.0
// (r-export/09_mip.R, group postrank-mip): HiGHS optima of the unrestricted family (G_max = n) for K = 1 and K = 2,
// n = 6 (tutorial sites), 7 (near ties), 10, 12 (a problem whose LP relaxation is fractional at tau .40), 15, 20, 25.
//   mipSolve(E, { tau, w, timeLimit }) -> { grade, status, upper, lower, gap, seconds, label }
// mipSolve lives in the solver bundle, not in js/pr-core.js: this adapter imports the Node entry
// js/bundles/solver-node.mjs (export mipSolve, named or on the default export) and throws "solver bundle not built"
// for every row while that file does not exist. The prCore argument of run() is not used.
// Checks per row (expect fields):
//   risk              upper equals the package's optimal risk within 1e-9 (solver tolerance)
//   gradeRisk         the risk of the returned grade, recomputed here from E, equals the package risk within 1e-9
//   upperIsGradeRisk  upper is the returned grade's risk (CONTRACT 6.3: U_R = evaluateReport risk), within 1e-12
//   lowerLeUpper      lower is finite and lower <= upper (1e-12 allowance for a bound inversion by rounding)
//   gap               |gap| <= 1e-9 (expected value 0)
//   status            "optimal", compared case-insensitively ("Optimal" from HiGHS passes)
//   label             "optimal-within-solver-tolerances"
//   canonical         grade has length n and canonical labels 1..G
//   grade             only on rows with args.unique_known = true: n <= 7, where R enumerated the whole family and
//                     no other report is within 1e-9 of the optimum, so the minimizer is the only report that can
//                     pass the risk check. Elsewhere the grade is not compared (the optimum may not be unique).
// Golden matrices store the NaN diagonal as null: inputs are mapped null -> NaN before the call. Per-row extras in
// the golden file (row.record: the package's grade, bound, gap, termination, enumeration and LP-relaxation
// diagnostics) are documentation and are not read here.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUNDLE = fileURLToPath(new URL("../../js/bundles/solver-node.mjs", import.meta.url));
let loading = null;

async function solver() {
  if (!existsSync(BUNDLE)) throw new Error("solver bundle not built");
  loading ??= import(pathToFileURL(BUNDLE).href);
  const mod = await loading;
  const fn = mod.mipSolve ?? mod.default?.mipSolve;
  if (typeof fn !== "function") throw new Error("solver bundle does not export mipSolve");
  return fn;
}

const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });

// R = tau + M^-1 sum_{g_i < g_j} (ebar_ij - tau), ebar = sum_k w_k e[k] (engine/API.md shared types).
function reportRisk(g, E, tau, w) {
  const n = g.length, M = (n * (n - 1)) / 2;
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j || !(g[i] < g[j])) continue;
    let eb = 0;
    for (let k = 0; k < E.e.length; k++) eb += w[k] * E.e[k][i][j];
    s += eb - tau;
  }
  return tau + s / M;
}

function canonical(g, n) {
  if (g.length !== n || !g.every((x) => Number.isInteger(x) && x >= 1)) return false;
  const labels = [...new Set(g)].sort((a, b) => a - b);
  return labels.every((x, i) => x === i + 1);
}

const RUN = {
  mipSolve: async (a) => {
    const mipSolve = await solver();
    const E = errIn(a.E);
    const r = await mipSolve(E, { tau: a.tau, w: a.w, timeLimit: a.timeLimit });
    const grade = Array.from(r.grade, Number);
    const gradeRisk = reportRisk(grade, E, a.tau, a.w);
    return {
      risk: r.upper,
      gradeRisk,
      upperIsGradeRisk: Number.isFinite(r.upper) && Math.abs(r.upper - gradeRisk) <= 1e-12,
      lowerLeUpper: Number.isFinite(r.lower) && r.lower <= r.upper + 1e-12,
      gap: r.gap,
      status: String(r.status).toLowerCase(),
      label: r.label,
      canonical: canonical(grade, a.E.ids.length),
      grade,
    };
  },
};

export default {
  group: "postrank-mip",
  run(args) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args);
  },
  // Grades, flags and strings are exact; risks and the gap carry the solver tolerance.
  default: { abs: 0, rel: 0 },
  tolerance: {
    risk: { abs: 1e-9, rel: 0 },
    gradeRisk: { abs: 1e-9, rel: 0 },
    gap: { abs: 1e-9, rel: 0 },
  },
};
