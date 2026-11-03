// The browser MIP: optimal reports over the unrestricted family with highs-js 1.15.4 (solver bundle only).
//
// This module is NOT exported from index.ts, so js/pr-core.js never contains the solver. It is bundled with
// highs-js by scripts/build-solver.mjs into js/bundles/solver.js (browser: blob-URL Worker,
// window.PRX_SOLVER = { mipSolve, ready }) and js/bundles/solver-node.mjs (Node, in-process).
//
// Formulation (postrank theory book ch. 14 sec-ordered-partition-formulation, prp-total-preorder-formulation;
// Step 1.6 spike, verdict PASS)
//   Variables z_ab = 1{g_a ≤ g_b} for a ≠ b (binary); column of z_ab = a(n − 1) + (b < a ? b : b − 1).
//   Completeness  z_ab + z_ba ≥ 1               once per unordered pair a < b;
//   Transitivity  z_ab + z_bc − z_ac ≤ 1        for every ordered triple of distinct units.
//   With x_ij = 1{g_i < g_j} = 1 − z_ji, the theory book's Z(g) = Σ_{i≠j}(ebar_ij − τ) x_ij and R = τ + Z/M:
//     Z = C + obj,  C = Σ_{i≠j}(ebar_ij − τ) (constant),  obj = Σ_{a≠b} z_ab (τ − ebar_ba) (the HiGHS objective).
//   So upper = τ + (C + obj)/M is the risk of the returned report and lower = τ + (C + bound)/M, with bound
//   the HiGHS dual bound; gap = upper − lower on the risk scale (U_R, L_R and U_R − L_R = (U_Z − L_Z)/M of
//   ch. 14 objective-units-determine-the-meaning-of-a-gap; CONTRACT 6.3).
//   ebar = Σ_k w_k e_k (any K). Only the objective depends on (E, w, τ); the constraints depend on n alone.
//
// Solver settings: mip_rel_gap = 0 and mip_abs_gap = 0 (the HiGHS defaults 1e-4 and 1e-6 may stop at a
// runner-up when two reports nearly tie), time_limit = timeLimit (seconds, per solve: the clocks are reset
// before each run), output off; everything else is the HiGHS default. HiGHS still compares objectives with
// internal tolerances: near τ-path breakpoints of 7-unit problems it returned the runner-up for objective
// differences up to 1e-7 (risk differences up to 5e-9) and never for 3e-7 or more. Hence the result label
// "optimal within solver tolerances", never "exact".
//
// Persistent model (CONTRACT 6.3; Step 2.11 acceptance test): a solver keeps the model of the last (E, w).
// A new τ (same E and w) changes only the column costs (changeColsCost) and runs again; new E or w builds a
// new model (the old one is disposed).
//
// Grade recovery: from the rounded z, the number of units strictly above unit i (z_ji = 1 and z_ij = 0)
// orders the grades; canonicalGrade() turns the counts into labels 1..G. The relation of the recovered grade
// is checked against z entry by entry.
//
// Status: "optimal" (HiGHS model status Optimal), "time limit" (status Time limit reached; the best report
// found so far, its upper value and the bound are reported as they are, or null when HiGHS has none), and
// otherwise the HiGHS status name in lower case. Only an "optimal" result carries the label
// "optimal-within-solver-tolerances"; any other result has label null.

import { Accumulator, type ErrorArray } from "./pairwise.ts";
import { type Grade, canonicalGrade } from "./report.ts";
import { type ReportEvaluation, checkTau, evaluateReport } from "./risk.ts";
import { type FamilyLabel, familyInfo, prepare } from "./optimize.ts";
import { readOptions } from "./options.ts";

// ---------------------------------------------------------------------------------------------------------
// The part of the highs-js 1.15.4 API used here (structural types, so this file does not import the package)

export interface HighsSparseMatrix {
  format: "csr";
  numRows: number;
  numCols: number;
  starts: Int32Array;
  indices: Int32Array;
  values: Float64Array;
}

/** highs-js ModelData for the weak-order MIP (binary columns, CSR rows). */
export interface MipModelData {
  numCols: number;
  numRows: number;
  colCost: Float64Array;
  colLower: Float64Array;
  colUpper: Float64Array;
  rowLower: Float64Array;
  rowUpper: Float64Array;
  matrix: HighsSparseMatrix;
  integrality: Int32Array;
}

export interface HighsModelLike {
  options: { set(values: Record<string, number | boolean | string>): unknown };
  info: { get(name: string): unknown };
  changeColsCost(selection: { kind: "range"; from: number; to: number }, costs: Float64Array): unknown;
  zeroAllClocks(): unknown;
  run(): unknown;
  getModelStatus(): number;
  getObjectiveValue(): number;
  getSolution(): { colValue: ArrayLike<number> };
  dispose(): void;
}

export interface HighsLike {
  /** the value highs-js uses for an infinite bound */
  infinity: number;
  createModel(data: MipModelData): HighsModelLike;
  version?: string;
}

// ---------------------------------------------------------------------------------------------------------
// Types

export interface MipOptions {
  /** withholding cost, 0 < τ ≤ 1/2 */
  tau: number;
  /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
  w?: readonly number[];
  /** HiGHS time_limit in seconds for this solve (> 0; Infinity allowed); default 30 */
  timeLimit?: number;
}

export type MipLabel = "optimal-within-solver-tolerances";

export interface MipResult {
  /** canonical grade vector of the returned report; null when HiGHS has no feasible solution */
  grade: Grade | null;
  /** "optimal", "time limit", or another HiGHS model status name in lower case */
  status: string;
  /** τ + (C + obj)/M: the risk of the returned report; null when there is none */
  upper: number | null;
  /** τ + (C + bound)/M (≤ upper); null when HiGHS has no finite bound */
  lower: number | null;
  /** upper − lower (absolute, risk scale); null when either is null */
  gap: number | null;
  /** wall-clock seconds of this call (model build or objective update, solve, recovery) */
  seconds: number;
  /** the result label (CONTRACT 6.2) for an optimal result; null for any other status */
  label: MipLabel | null;
  /** the unrestricted family 𝒜_n (CONTRACT 6.6); size a number up to 2^53, else a decimal string */
  family: FamilyLabel;
  /** HiGHS model status code (7 = Optimal, 13 = Time limit reached) */
  statusCode: number;
  /** true when the persistent model of the same (E, w) was reused (only the costs changed) */
  reused: boolean;
  n: number;
  M: number;
  tau: number;
  timeLimit: number;
  /** C = Σ_{i≠j}(ebar_ij − τ), the constant that turns the HiGHS objective into Z */
  offset: number;
  /** HiGHS objective obj = Σ z_ab(τ − ebar_ba) of the returned solution; null when there is none */
  objective: number | null;
  /** HiGHS dual bound on obj (not above objective); null when not finite */
  bound: number | null;
  /** branch-and-bound nodes */
  nodes: number | null;
  /** evaluateReport() of grade, and its main fields (null when grade is null) */
  evaluation: ReportEvaluation | null;
  N: number | null;
  G: number | null;
  Ew: number | null;
  E: number[] | null;
  EoverN: (number | null)[] | null;
}

export interface MipSolver {
  /** Optimal report over 𝒜_n at τ; reuses the model when (E, w) equals the previous call's. */
  solve(E: ErrorArray, options: MipOptions): MipResult;
  /** Dispose the persistent model (the solver stays usable; the next solve builds a new model). */
  dispose(): void;
  /** number of models built so far (for the persistent-model acceptance test) */
  readonly builds: number;
}

/** Extra HiGHS options for tests only (for example the default gaps, to show why they are set to 0). */
export interface MipSolverSettings {
  highsOptions?: Record<string, number | boolean | string>;
}

export const MIP_LABEL: MipLabel = "optimal-within-solver-tolerances";
export const MIP_DEFAULT_TIME_LIMIT = 30;

// HiGHS model status names (HighsModelStatus; highs-js legacy strings), in lower case.
const STATUS_NAMES: readonly string[] = [
  "not set",
  "load error",
  "model error",
  "presolve error",
  "solve error",
  "postsolve error",
  "empty",
  "optimal",
  "infeasible",
  "primal infeasible or unbounded",
  "unbounded",
  "bound on objective reached",
  "target for objective reached",
  "time limit reached",
  "iteration limit reached",
  "unknown",
  "solution limit reached",
  "interrupted by user",
];
const STATUS_OPTIMAL = 7;
const STATUS_TIME_LIMIT = 13;

// ---------------------------------------------------------------------------------------------------------
// Model pieces (pure functions)

/** Column of z_ab (a ≠ b): a(n − 1) + (b < a ? b : b − 1). */
export function mipColumn(n: number, a: number, b: number): number {
  return a * (n - 1) + (b < a ? b : b - 1);
}

/** Status string for a HiGHS model status code: "optimal", "time limit", else the HiGHS name in lower case. */
export function mipStatusName(code: number): string {
  if (code === STATUS_OPTIMAL) return "optimal";
  if (code === STATUS_TIME_LIMIT) return "time limit";
  return STATUS_NAMES[code] ?? `highs model status ${String(code)}`;
}

/**
 * The constraint part of the model on n units: n(n − 1) binary columns, C(n, 2) completeness rows and
 * n(n − 1)(n − 2) transitivity rows (CSR). Costs are zero; mipCosts() supplies them.
 */
export function mipModelData(n: number, infinity: number): MipModelData {
  if (!Number.isSafeInteger(n) || n < 2) throw new RangeError("the MIP needs at least two units");
  const numCols = n * (n - 1);
  const pairs = (n * (n - 1)) / 2;
  const triples = n * (n - 1) * (n - 2);
  const numRows = pairs + triples;
  const starts = new Int32Array(numRows + 1);
  const indices = new Int32Array(2 * pairs + 3 * triples);
  const values = new Float64Array(2 * pairs + 3 * triples);
  const rowLower = new Float64Array(numRows);
  const rowUpper = new Float64Array(numRows);
  let r = 0;
  let k = 0;
  const put = (col: number, v: number) => {
    indices[k] = col;
    values[k] = v;
    k += 1;
  };
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const ab = mipColumn(n, a, b);
      const ba = mipColumn(n, b, a);
      put(Math.min(ab, ba), 1);
      put(Math.max(ab, ba), 1);
      rowLower[r] = 1;
      rowUpper[r] = infinity;
      r += 1;
      starts[r] = k;
    }
  }
  const entry: [number, number][] = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let a = 0; a < n; a += 1) {
    for (let b = 0; b < n; b += 1) {
      if (b === a) continue;
      for (let c = 0; c < n; c += 1) {
        if (c === a || c === b) continue;
        entry[0] = [mipColumn(n, a, b), 1];
        entry[1] = [mipColumn(n, b, c), 1];
        entry[2] = [mipColumn(n, a, c), -1];
        entry.sort((x, y) => x[0] - y[0]);
        for (const [col, v] of entry) put(col, v);
        rowLower[r] = -infinity;
        rowUpper[r] = 1;
        r += 1;
        starts[r] = k;
      }
    }
  }
  return {
    numCols,
    numRows,
    colCost: new Float64Array(numCols),
    colLower: new Float64Array(numCols),
    colUpper: new Float64Array(numCols).fill(1),
    rowLower,
    rowUpper,
    matrix: { format: "csr", numRows, numCols, starts, indices, values },
    integrality: new Int32Array(numCols).fill(1),
  };
}

/** Column costs τ − ebar_ba for z_ab (ebar flat, ebar[i·n + j]). */
export function mipCosts(ebar: ArrayLike<number>, n: number, tau: number): Float64Array {
  const c = new Float64Array(n * (n - 1));
  for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) if (a !== b) c[mipColumn(n, a, b)] = tau - ebar[b * n + a];
  return c;
}

/** C = Σ_{i≠j}(ebar_ij − τ), compensated. */
export function mipOffset(ebar: ArrayLike<number>, n: number, tau: number): number {
  const acc = new Accumulator();
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) acc.add(ebar[i * n + j] - tau);
  return acc.value;
}

/**
 * Canonical grade from a solved z (column values, rounded at 1/2): unit i's grade is ordered by the number of
 * units strictly above it (z_ji = 1, z_ij = 0). Throws when z is not a complete, transitive relation.
 */
export function gradeFromZ(colValue: ArrayLike<number>, n: number): Grade {
  const z = (a: number, b: number) => colValue[mipColumn(n, a, b)] > 0.5;
  const above = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (j !== i && z(j, i) && !z(i, j)) above[i] += 1;
  const grade = canonicalGrade(above);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i !== j && z(i, j) !== grade[i] <= grade[j]) {
        throw new Error(`the solver returned a relation that is not a weak order (pair ${i}, ${j})`);
      }
    }
  }
  return grade;
}

function checkTimeLimit(x: number | undefined): number {
  const v = x ?? MIP_DEFAULT_TIME_LIMIT;
  if (typeof v !== "number" || !(v > 0)) throw new RangeError(`timeLimit must be a positive number of seconds, got ${String(v)}`);
  return v;
}

const finite = (x: unknown): number | null => {
  const v = typeof x === "bigint" ? Number(x) : (x as number);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

// performance.now() exists in browsers, Workers and Node; the engine's lib setting (ES2022) does not declare it
const clock = (globalThis as { performance?: { now(): number } }).performance;
const now = (): number => (clock ? clock.now() : Date.now());

// ---------------------------------------------------------------------------------------------------------
// Solver

/**
 * A MIP solver around one highs-js instance (loaded by the caller: the Worker in solver.js, the module in
 * solver-node.mjs, or a test). It keeps the model of the last (E, w) and changes only the costs when τ moves.
 */
export function createMipSolver(highs: HighsLike, settings: MipSolverSettings = {}): MipSolver {
  settings = readOptions<MipSolverSettings>(settings, ["highsOptions"], "createMipSolver");
  let current: { n: number; ebar: Float64Array; model: HighsModelLike } | null = null;
  let builds = 0;

  const drop = () => {
    if (current) {
      const { model } = current;
      current = null;
      model.dispose();
    }
  };

  const same = (a: Float64Array, b: Float64Array) => {
    if (a.length !== b.length) return false;
    for (let q = 0; q < a.length; q += 1) if (a[q] !== b[q]) return false;
    return true;
  };

  function solve(E: ErrorArray, options: MipOptions): MipResult {
    const t0 = now();
    const o = readOptions<MipOptions>(options, ["tau", "w", "timeLimit"], "mipSolve", true);
    const tau = checkTau(o.tau);
    const timeLimit = checkTimeLimit(o.timeLimit);
    const P = prepare(E, o.w);
    const { n, M, ebar } = P;
    const costs = mipCosts(ebar, n, tau);
    const offset = mipOffset(ebar, n, tau);
    const reused = current !== null && current.n === n && same(current.ebar, ebar);
    if (!reused) {
      drop();
      const model = highs.createModel(mipModelData(n, highs.infinity));
      try {
        model.options.set({ output_flag: false, mip_rel_gap: 0, mip_abs_gap: 0, ...(settings.highsOptions ?? {}) });
      } catch (err) {
        model.dispose();
        throw err;
      }
      builds += 1;
      current = { n, ebar: Float64Array.from(ebar), model };
    }
    const model = (current as { model: HighsModelLike }).model;
    let statusCode: number;
    let colValue: ArrayLike<number> | null = null;
    let objective: number | null;
    let bound: number | null;
    let nodes: number | null;
    try {
      model.changeColsCost({ kind: "range", from: 0, to: n * (n - 1) - 1 }, costs);
      model.options.set({ time_limit: timeLimit });
      model.zeroAllClocks();
      model.run();
      statusCode = model.getModelStatus();
      objective = finite(model.getObjectiveValue());
      const hasSolution = finite(model.info.get("primal_solution_status")) === 2 && objective !== null;
      if (hasSolution) colValue = model.getSolution().colValue;
      else objective = null;
      bound = finite(model.info.get("mip_dual_bound"));
      nodes = finite(model.info.get("mip_node_count"));
    } catch (err) {
      drop();
      throw err;
    }
    // the dual bound never exceeds the incumbent objective (HiGHS sets them equal when the gap closes)
    if (bound !== null && objective !== null && bound > objective) bound = objective;
    const grade = colValue === null ? null : gradeFromZ(colValue, n);
    const evaluation = grade === null ? null : evaluateReport(grade, E, { tau, w: P.w });
    const upper = objective === null ? null : tau + (offset + objective) / M;
    const lower = bound === null ? null : tau + (offset + bound) / M;
    const status = mipStatusName(statusCode);
    return {
      grade,
      status,
      upper,
      lower,
      gap: upper === null || lower === null ? null : upper - lower,
      seconds: (now() - t0) / 1000,
      label: status === "optimal" && grade !== null ? MIP_LABEL : null,
      family: familyInfo(n, { kind: "all" }),
      statusCode,
      reused,
      n,
      M,
      tau,
      timeLimit,
      offset,
      objective,
      bound,
      nodes,
      evaluation,
      N: evaluation?.N ?? null,
      G: evaluation?.G ?? null,
      Ew: evaluation?.Ew ?? null,
      E: evaluation?.E ?? null,
      EoverN: evaluation?.EoverN ?? null,
    };
  }

  return {
    solve,
    dispose: drop,
    get builds() {
      return builds;
    },
  };
}
