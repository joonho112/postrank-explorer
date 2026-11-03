// Pairwise direction and error probabilities: the inputs of every report, risk and optimum.
//
// Definitions (postrank theory book, App. B and chs. 9-11; postrank 1.1.0)
//   pi_ij      = Pr(theta_i > theta_j | Y), the direction probability (Part 1).
//   e_ij,k     = Pr(theta_ik <= theta_jk | Y), the weak-error event: stating i above j on criterion k is wrong
//                when theta_ik <= theta_jk, so latent equality counts as an error in BOTH directions and
//                e_ij + e_ji = 1 + Pr(theta_i = theta_j). The reverse complement e_ji = 1 - e_ij holds only
//                when equality has probability zero (ch. 11, "Latent equality and conditional calculations").
//   b_ij,k     = Pr(theta_ik < theta_jk), t_ij,k = Pr(theta_ik = theta_jk), d_ij,k = 1 - t_ij,k: strict error,
//                equality and distinctness for the equality-neutral loss (ch. 11 sec-tie-aware-loss; App. B
//                sec-tie-aware-notation; package postrank_tie_pairwise() fields b, t, d).
//
// Conventions (CONTRACT 7.3): units 0..n-1, criteria 0..K-1, arrays criterion-major e[k][i][j], diagonal NaN.
// Finite laws and draws are aggregated directly from the states (never as 1 - pi), so ties are handled
// exactly. Normal laws use the closed form Phi(mean difference / SD of the difference).
//
// v3 helpers (engine/API.md "v3 helpers (Phase 2, Step 2.1)"), with ebar_ij = Σ_k w_k e_ij,k:
//   finiteLawMargins   the marginal law of each unit and criterion of a finite law: distinct values (===) in
//                      ascending order, their probabilities summed in state order (1.10).
//   majorityWins       i beats j when ebar_ij < ebar_ji − tieTol, a majority tie when |ebar_ij − ebar_ji| ≤ tieTol;
//                      wins, ties, the order by wins (index order on equal wins), cyclic triples, counted and listed
//                      as [a, x, y] with a the smallest index, a beating x, x beating y, y beating a (1.15).
//   leastCertainPairs  the k pairs i < j with the largest min(ebar_ij, ebar_ji), (i, j) order on equal values; with
//                      a display order, the distance between the two units' positions in it (1.13).
//   pairCertainty      pairs i < j with min(ebar_ij, ebar_ji) < 1 − threshold (strict), per threshold (1.6).
//
// Part 1 supplement (engine/API.md "v3 helpers: Part 1 supplement (Step 3.27)"):
//   pairDifference      θ_A − θ_B for two normal posteriors with correlation ρ: mean, SD
//                       √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB), z = mean/SD and π = Φ(z) (1.8, 1.9, 1.11, 1.13).
//   finiteLawCells      the joint law of (θ_i, θ_j) on one criterion of a finite law: distinct values (===) ascending
//                       and the cell probabilities, summed in state order (1.10).
//   maxCoefficientError ε_k = max_{i≠j} |ê_ijk − e_ijk| and the first (i, j) in row-major order where it occurs (1.17).

import { normalCdf } from "./special.ts";
import { readOptions } from "./options.ts";

/** n × n matrix of ordered-pair values; the diagonal is NaN (JSON null in golden files). */
export type Matrix = number[][];

/** Directional error probabilities, criterion-major: e[k][i][j] = Pr(theta_ik <= theta_jk | Y). */
export interface ErrorArray {
  ids: string[];
  criteria: string[];
  e: Matrix[];
}

/** Equal-weight weak errors with the original integer tallies retained before division by S. */
export interface DrawErrorArray extends ErrorArray {
  S: number;
  /** Criterion-major K × n × n integer counts; NaN on the diagonal, as in e. */
  counts: Matrix[];
}

/** Optional unit and criterion ids. Defaults: A, B, … (n ≤ 26) or U01, U02, … ; k1, k2, …. */
export interface LabelOptions {
  ids?: readonly string[];
  criteria?: readonly string[];
}

export interface ErrorArrayOptions extends LabelOptions {
  /** orient[k] = +1 (larger is higher priority) or −1 (the target's sign is flipped); default all +1. */
  orient?: readonly number[];
}

export interface PairDirectionOptions {
  /** Correlation of theta_A and theta_B, in [−1, 1]; default 0. */
  corr?: number;
}

/** finiteLawPairwise result: an ErrorArray (field e) that also carries pi and the equality probability t. */
export interface FiniteLawPairwise extends ErrorArray {
  pi: Matrix[];
  t: Matrix[];
}

/** tieLawPairwise result: strict error b, equality t and distinctness d (each criterion-major, NaN diagonal). */
export interface TieLawPairwise {
  ids: string[];
  criteria: string[];
  b: Matrix[];
  t: Matrix[];
  d: Matrix[];
}

/** One bivariate normal component of a mixture for the pair (A, B). */
export interface MixtureComponent {
  w: number;
  meanA: number;
  sdA: number;
  meanB: number;
  sdB: number;
  corr?: number;
}

/** One unit's values: a number when K = 1, or K criterion values. */
export type UnitValues = number | ArrayLike<number>;
/** n units × K criteria, x[i][k] (or x[i] as a number when K = 1). */
export type UnitTable = ArrayLike<UnitValues>;

// ---------------------------------------------------------------------------------------------------------
// Internal helpers (exported for report.ts and risk.ts; not part of the public API in index.ts)

/** Neumaier compensated summation: the sum is accurate to about one rounding, independent of order. */
export class Accumulator {
  private s = 0;
  private c = 0;
  add(x: number): void {
    const t = this.s + x;
    if (Math.abs(this.s) >= Math.abs(x)) this.c += this.s - t + x;
    else this.c += x - t + this.s;
    this.s = t;
  }
  get value(): number {
    return this.s + this.c;
  }
}

/** Default unit ids: A … Z for n ≤ 26, otherwise U01 … Un (zero-padded, so text order = index order). */
export function defaultIds(n: number): string[] {
  if (n <= 26) return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const width = String(n).length;
  return Array.from({ length: n }, (_, i) => `U${String(i + 1).padStart(width, "0")}`);
}

/** Default criterion ids k1 … kK. */
export function defaultCriteria(K: number): string[] {
  return Array.from({ length: K }, (_, k) => `k${k + 1}`);
}

function checkIds(ids: readonly string[] | undefined, count: number, what: string, fallback: string[]): string[] {
  if (ids === undefined) return fallback;
  if (!Array.isArray(ids) || ids.length !== count) throw new RangeError(`${what} must be ${count} strings`);
  if (!ids.every((x) => typeof x === "string") || new Set(ids).size !== ids.length) {
    throw new RangeError(`${what} must be distinct strings`);
  }
  return [...ids];
}

/** Resolve ids and criteria (validated lengths, distinct strings) for n units and K criteria. */
export function resolveLabels(options: LabelOptions | undefined, n: number, K: number): { ids: string[]; criteria: string[] } {
  return {
    ids: checkIds(options?.ids, n, "ids", defaultIds(n)),
    criteria: checkIds(options?.criteria, K, "criteria", defaultCriteria(K)),
  };
}

/** A fresh n × n matrix of zeros with a NaN diagonal. */
export function nanMatrix(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => {
    const row = new Array<number>(n).fill(0);
    row[i] = Number.NaN;
    return row;
  });
}

/** A unit table read into a flat array: v[i * K + k]. */
export interface Table {
  n: number;
  K: number;
  v: Float64Array;
}

/** Read x[i][k] (or x[i] when K = 1) into a flat table; every value must be finite and every row have K values. */
export function readTable(x: UnitTable, name: string): Table {
  if (x == null || typeof x !== "object" || typeof x.length !== "number" || x.length < 1) {
    throw new RangeError(`${name} must be a nonempty array of units`);
  }
  const n = x.length;
  const first = x[0];
  const K = typeof first === "number" ? 1 : (first as ArrayLike<number> | null)?.length;
  if (typeof K !== "number" || K < 1) throw new RangeError(`${name}[0] must be a number or a nonempty array`);
  const v = new Float64Array(n * K);
  for (let i = 0; i < n; i += 1) {
    const row = x[i];
    if (typeof row === "number") {
      if (K !== 1) throw new RangeError(`${name}[${i}] must have ${K} criterion values`);
      v[i] = row;
    } else {
      if (row == null || typeof row !== "object" || row.length !== K) {
        throw new RangeError(`${name}[${i}] must have ${K} criterion values`);
      }
      for (let k = 0; k < K; k += 1) v[i * K + k] = row[k];
    }
  }
  for (let q = 0; q < v.length; q += 1) {
    if (!Number.isFinite(v[q])) throw new RangeError(`${name} must contain finite numbers only`);
  }
  return { n, K, v };
}

function checkFinite(x: number, name: string): void {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new RangeError(`${name} must be a finite number`);
}

function checkSd(x: number, name: string): void {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError(`${name} must be a finite SD ≥ 0`);
}

/** SD of theta_A − theta_B: sqrt(sdA² + sdB² − 2·corr·sdA·sdB). Throws when it is 0. */
function differenceSd(sdA: number, sdB: number, corr: number): number {
  const v = sdA * sdA + sdB * sdB - 2 * corr * sdA * sdB;
  if (!(v > 0)) {
    throw new RangeError(
      "the difference of the two targets has SD 0, so its direction is not a normal probability (use finiteLawPairwise for point masses)",
    );
  }
  return Math.sqrt(v);
}

/** Criterion weights: length K, finite, ≥ 0, sum 1 within 1e-12; [1] by default when K = 1. (Internal; re-exported
 *  by risk.ts, where the other modules import it.) */
export function checkWeights(w: readonly number[] | undefined, K: number): number[] {
  if (w === undefined || w === null) {
    if (K === 1) return [1];
    throw new RangeError(`weights w are required when there are ${K} criteria`);
  }
  if (!Array.isArray(w) || w.length !== K) throw new RangeError(`w must hold ${K} weights`);
  const acc = new Accumulator();
  for (const x of w) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError("weights must be finite and ≥ 0");
    acc.add(x);
  }
  if (Math.abs(acc.value - 1) > 1e-12) throw new RangeError("weights must sum to 1 (within 1e-12); they are not normalized");
  return [...w];
}

const arrayLike = (x: unknown): x is ArrayLike<unknown> =>
  x != null && typeof x === "object" && typeof (x as { length?: unknown }).length === "number";

/** Shape check of a criterion-major array (K × n × n) of n × n matrices whose rows may be typed arrays; n and K.
 *  (Internal; exported for risk.ts.) */
export function checkCube(e: readonly ArrayLike<ArrayLike<number>>[] | undefined, name: string): { n: number; K: number } {
  if (!Array.isArray(e) || e.length < 1) throw new RangeError(`${name} must be a nonempty criterion-major array e[k][i][j] (K × n × n)`);
  const n = arrayLike(e[0]) ? e[0].length : 0;
  if (n < 2) throw new RangeError(`${name} must have at least two units`);
  for (let k = 0; k < e.length; k += 1) {
    const m = e[k];
    if (!arrayLike(m) || m.length !== n) throw new RangeError(`${name}[${k}] must be ${n} × ${n}`);
    for (let i = 0; i < n; i += 1) {
      const row = m[i];
      if (!arrayLike(row) || row.length !== n) throw new RangeError(`${name}[${k}] must be ${n} × ${n}`);
      for (let j = 0; j < n; j += 1) {
        if (i !== j && (typeof row[j] !== "number" || !Number.isFinite(row[j]))) {
          throw new RangeError(`${name}[${k}][${i}][${j}] must be a finite number`);
        }
      }
    }
  }
  return { n, K: e.length };
}

/** Shape check of an ErrorArray (internal; re-exported by risk.ts): n, K and the matrices. `name` (default "E")
 *  names the argument in the error messages. */
export function errorCube(E: ErrorArray, name = "E"): { n: number; K: number; e: Matrix[] } {
  if (E == null || typeof E !== "object") throw new RangeError(`${name} must be an ErrorArray { ids, criteria, e }`);
  return { ...checkCube(E.e, `${name}.e`), e: E.e };
}

/** ebar_ij = Σ_k w_k e[k][i][j] (exactly e[0][i][j] when K = 1 and w = [1]; internal, re-exported by risk.ts). */
export function weighted(e: Matrix[], w: readonly number[], i: number, j: number): number {
  if (e.length === 1) return w[0] * e[0][i][j];
  const acc = new Accumulator();
  for (let k = 0; k < e.length; k += 1) acc.add(w[k] * e[k][i][j]);
  return acc.value;
}

/** Check that weights are finite, ≥ 0 and sum to 1 within 1e-12 (no automatic normalization, as postrank). */
export function checkProbabilityVector(p: ArrayLike<number>, name: string): void {
  const acc = new Accumulator();
  for (let q = 0; q < p.length; q += 1) {
    const x = p[q];
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError(`${name} must be finite and ≥ 0`);
    acc.add(x);
  }
  if (Math.abs(acc.value - 1) > 1e-12) throw new RangeError(`${name} must sum to 1 (within 1e-12); they are not normalized`);
}

/** A finite law (states with probabilities) or equal-weight draws (probs null), read into flat tables
 *  (internal; exported for risk.ts and simulate.ts). */
export interface Law {
  S: number;
  n: number;
  K: number;
  /** states[s][i * K + k] */
  states: Float64Array[];
  p: Float64Array | null;
}

/** Read a finite law: states S × n × K (finite, one shape) and probs (finite, ≥ 0, sum 1 within 1e-12; null =
 *  equal weights). Internal; exported for risk.ts and simulate.ts. */
export function readLaw(states: ArrayLike<UnitTable>, probs: ArrayLike<number> | null | undefined, name: string): Law {
  if (states == null || typeof states !== "object" || typeof states.length !== "number" || states.length < 1) {
    throw new RangeError(`${name} must be a nonempty array of states`);
  }
  const S = states.length;
  const tables: Float64Array[] = [];
  let n = 0;
  let K = 0;
  for (let s = 0; s < S; s += 1) {
    const t = readTable(states[s], `${name}[${s}]`);
    if (s === 0) {
      n = t.n;
      K = t.K;
    } else if (t.n !== n || t.K !== K) {
      throw new RangeError(`${name}[${s}] must have ${n} units × ${K} criteria, as ${name}[0]`);
    }
    tables.push(t.v);
  }
  let p: Float64Array | null = null;
  if (probs != null) {
    if (typeof probs !== "object" || probs.length !== S) throw new RangeError(`probs must have one value per state (${S})`);
    checkProbabilityVector(probs, "probs");
    p = Float64Array.from(probs as ArrayLike<number>);
  }
  return { S, n, K, states: tables, p };
}

// Comparison events for the ordered pair (a = theta_i, b = theta_j).
const LT = 0; // a < b
const EQ = 1; // a = b
const GT = 2; // a > b
const LE = 3; // a <= b
const NE = 4; // a != b

function holds(event: number, a: number, b: number): boolean {
  switch (event) {
    case LT:
      return a < b;
    case EQ:
      return a === b;
    case GT:
      return a > b;
    case LE:
      return a <= b;
    default:
      return a !== b;
  }
}

/**
 * For each requested event, the criterion-major array of its probabilities over ordered pairs.
 * With probabilities: a compensated sum of the masses of the states where the event holds. With equal-weight
 * draws: the exact count divided by S (as R's colMeans of a logical matrix).
 */
function eventArrays(law: Law, events: readonly number[], integerCounts?: Matrix[][]): Matrix[][] {
  const { S, n, K, states, p } = law;
  const out = events.map(() => Array.from({ length: K }, () => nanMatrix(n)));
  const counts = new Float64Array(events.length);
  const accs = events.map(() => new Accumulator());
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const ai = i * K + k;
        const bj = j * K + k;
        if (p === null) {
          counts.fill(0);
          for (let s = 0; s < S; s += 1) {
            const a = states[s][ai];
            const b = states[s][bj];
            for (let q = 0; q < events.length; q += 1) if (holds(events[q], a, b)) counts[q] += 1;
          }
          for (let q = 0; q < events.length; q += 1) {
            if (integerCounts !== undefined) integerCounts[q][k][i][j] = counts[q];
            out[q][k][i][j] = counts[q] / S;
          }
        } else {
          for (let q = 0; q < events.length; q += 1) accs[q] = new Accumulator();
          for (let s = 0; s < S; s += 1) {
            const a = states[s][ai];
            const b = states[s][bj];
            for (let q = 0; q < events.length; q += 1) if (holds(events[q], a, b)) accs[q].add(p[s]);
          }
          for (let q = 0; q < events.length; q += 1) out[q][k][i][j] = accs[q].value;
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/**
 * π = Pr(theta_A > theta_B) for a bivariate normal: Φ((meanA − meanB) / sqrt(sdA² + sdB² − 2·corr·sdA·sdB)).
 * Throws when the difference has SD 0 (then the direction is a point mass, not a normal probability).
 */
export function pairDirection(meanA: number, sdA: number, meanB: number, sdB: number, options: PairDirectionOptions = {}): number {
  checkFinite(meanA, "meanA");
  checkFinite(meanB, "meanB");
  checkSd(sdA, "sdA");
  checkSd(sdB, "sdB");
  const corr = readOptions<PairDirectionOptions>(options, ["corr"], "pairDirection").corr ?? 0;
  if (typeof corr !== "number" || !(corr >= -1 && corr <= 1)) throw new RangeError("corr must lie in [−1, 1]");
  return normalCdf((meanA - meanB) / differenceSd(sdA, sdB, corr));
}

/** Matrix of π_ij = Pr(theta_i > theta_j) for independent normals (Part 1); `sds` may be one common SD. */
export function directionMatrix(means: ArrayLike<number>, sds: ArrayLike<number> | number): Matrix {
  const m = readTable(means, "means");
  if (m.K !== 1) throw new RangeError("directionMatrix takes one mean per unit");
  const n = m.n;
  const s = typeof sds === "number" ? new Float64Array(n).fill(sds) : readTable(sds, "sds").v;
  if (s.length !== n) throw new RangeError(`sds must have ${n} values`);
  s.forEach((x, i) => checkSd(x, `sds[${i}]`));
  const pi = nanMatrix(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i !== j) pi[i][j] = normalCdf((m.v[i] - m.v[j]) / differenceSd(s[i], s[j], 0));
    }
  }
  return pi;
}

/**
 * ErrorArray for independent normal posteriors: e[k][i][j] = Pr(theta_ik ≤ theta_jk), computed directly as
 * Φ(orient_k·(mean_jk − mean_ik) / sqrt(sd_ik² + sd_jk²)). `means` and `sds` are n × K (or n-vectors when
 * K = 1); `sds` may be one common SD. orient[k] = −1 flips the target's sign (smaller is higher priority).
 */
export function errorArray(means: UnitTable, sds: UnitTable | number, options: ErrorArrayOptions = {}): ErrorArray {
  options = readOptions<ErrorArrayOptions>(options, ["ids", "criteria", "orient"], "errorArray");
  const m = readTable(means, "means");
  const { n, K } = m;
  let s: Float64Array;
  if (typeof sds === "number") {
    s = new Float64Array(n * K).fill(sds);
  } else {
    const t = readTable(sds, "sds");
    if (t.n !== n || t.K !== K) throw new RangeError(`sds must be ${n} units × ${K} criteria, as means`);
    s = t.v;
  }
  s.forEach((x) => checkSd(x, "sds"));
  const orient = options.orient ?? new Array<number>(K).fill(1);
  if (orient.length !== K || !Array.from(orient).every((o) => o === 1 || o === -1)) {
    throw new RangeError(`orient must hold ${K} values, each +1 or −1`);
  }
  const { ids, criteria } = resolveLabels(options, n, K);
  const e = Array.from({ length: K }, () => nanMatrix(n));
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const sd = differenceSd(s[i * K + k], s[j * K + k], 0);
        e[k][i][j] = normalCdf((orient[k] * (m.v[j * K + k] - m.v[i * K + k])) / sd);
      }
    }
  }
  return { ids, criteria, e };
}

/**
 * Exact pair probabilities of a finite law: `states[s][i][k]` with probabilities `probs[s]` (finite, ≥ 0, sum 1;
 * null for equal weights). Returns an ErrorArray (e = Pr(theta_i ≤ theta_j), ties wrong in both directions)
 * that also carries pi = Pr(theta_i > theta_j) and t = Pr(theta_i = theta_j). Every field is summed directly.
 */
export function finiteLawPairwise(
  states: ArrayLike<UnitTable>,
  probs: ArrayLike<number> | null | undefined,
  options: LabelOptions = {},
): FiniteLawPairwise {
  options = readOptions<LabelOptions>(options, ["ids", "criteria"], "finiteLawPairwise");
  const law = readLaw(states, probs, "states");
  const { ids, criteria } = resolveLabels(options, law.n, law.K);
  const [pi, e, t] = eventArrays(law, [GT, LE, EQ]);
  return { ids, criteria, e, pi, t };
}

/** π = Σ_c w_c Pr_c(theta_A > theta_B) under a mixture of bivariate normals; weights ≥ 0 summing to 1. */
export function mixturePairDirection(components: readonly MixtureComponent[]): number {
  if (!Array.isArray(components) || components.length < 1) throw new RangeError("components must be a nonempty array");
  checkProbabilityVector(
    components.map((c) => c.w),
    "component weights w",
  );
  const acc = new Accumulator();
  for (const c of components) {
    acc.add(c.w * pairDirection(c.meanA, c.sdA, c.meanB, c.sdB, { corr: c.corr ?? 0 }));
  }
  return acc.value;
}

/** Weak errors from equal-weight draws `draws[s][i][k]`: original integer counts and their shares count/S,
 * with theta_i ≤ theta_j (ties count). Counts are saved from the original tally, never reconstructed as e*S. */
export function drawErrors(draws: ArrayLike<UnitTable>, options: LabelOptions = {}): DrawErrorArray {
  options = readOptions<LabelOptions>(options, ["ids", "criteria"], "drawErrors");
  const law = readLaw(draws, null, "draws");
  const { ids, criteria } = resolveLabels(options, law.n, law.K);
  const counts = Array.from({ length: law.K }, () => nanMatrix(law.n));
  const [e] = eventArrays(law, [LE], [counts]);
  return { ids, criteria, e, S: law.S, counts };
}

/**
 * Strict error b = Pr(theta_i < theta_j), equality t = Pr(theta_i = theta_j) and distinctness
 * d = Pr(theta_i ≠ theta_j) = 1 − t of a finite law (probs null for equal-weight draws). b_ij + b_ji = d_ij.
 */
export function tieLawPairwise(
  states: ArrayLike<UnitTable>,
  probs: ArrayLike<number> | null | undefined,
  options: LabelOptions = {},
): TieLawPairwise {
  options = readOptions<LabelOptions>(options, ["ids", "criteria"], "tieLawPairwise");
  const law = readLaw(states, probs, "states");
  const { ids, criteria } = resolveLabels(options, law.n, law.K);
  const [b, t, d] = eventArrays(law, [LT, EQ, NE]);
  return { ids, criteria, b, t, d };
}

// ---------------------------------------------------------------------------------------------------------
// v3 helpers (Phase 2, Step 2.1; engine/API.md "v3 helpers")

/** The marginal law of one unit on one criterion. */
export interface MarginalLaw {
  /** the distinct values (===) in ascending order */
  values: number[];
  /** probs[v]: the state probabilities with value values[v], summed in state order (count/S for equal weights) */
  probs: number[];
}

export interface FiniteLawMargins {
  /** present when given in the options */
  ids?: string[];
  /** present when given in the options */
  criteria?: string[];
  /** margins[i][k]: the marginal law of unit i on criterion k */
  margins: MarginalLaw[][];
}

export interface MajorityOptions {
  /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
  w?: readonly number[];
  /** a pair is a majority tie when |ebar_ij − ebar_ji| ≤ tieTol (finite, ≥ 0); default 1e-12 */
  tieTol?: number;
}

export interface MajorityWins {
  /** wins[i]: the units i beats (ebar_ij < ebar_ji − tieTol) */
  wins: number[];
  /** ties[i]: the units i ties with (|ebar_ij − ebar_ji| ≤ tieTol) */
  ties: number[];
  /** units by wins descending, equal wins in index order */
  order: number[];
  /** unordered triples whose three pairs are strict and cyclic (a beats b, b beats c, c beats a) */
  cycles: number;
  /** no pair ties and no triple is cyclic (then `order` is the majority order) */
  strictOrder: boolean;
  /** the cyclic triples (cycles of them) in lexicographic order of their sorted indices a < b < c, each written
   *  [a, x, y] with a its smallest index: a beats x, x beats y and y beats a */
  cycleTriples: number[][];
}

export interface LeastCertainOptions {
  /** how many pairs (a positive integer, clamped to M); default 10 */
  k?: number;
  w?: readonly number[];
  /** a permutation of 0..n − 1 (e.g. a display order); each pair then also has `apart`; null or omitted: no `apart` */
  order?: readonly number[] | null;
}

export interface UncertainPair {
  i: number;
  j: number;
  /** min(ebar_ij, ebar_ji) */
  e: number;
  /** i when ebar_ij ≤ ebar_ji, else j (the more likely higher unit) */
  above: number;
  /** with `order`: |pos(i) − pos(j)|, the distance between the two units' positions in the order */
  apart?: number;
}

export interface PairDifference {
  /** meanA − meanB */
  mean: number;
  /** √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB), evaluated left to right */
  sd: number;
  /** mean/sd */
  z: number;
  /** Pr(θ_A > θ_B) = normalCdf(z) (pairDirection when ρ = 0) */
  pi: number;
}

export interface FiniteLawCellsOptions {
  /** the row unit, an integer index */
  i: number;
  /** the column unit, an integer index other than i */
  j: number;
  /** the criterion, an integer index; default 0 */
  criterion?: number;
}

export interface FiniteLawCells {
  /** the distinct values (===) of states[s][i][criterion], ascending */
  rowValues: number[];
  /** the distinct values (===) of states[s][j][criterion], ascending */
  colValues: number[];
  /** cells[r][c]: the probabilities of the states with θ_i = rowValues[r] and θ_j = colValues[c], summed in state
   *  order (equal weights: the exact count over S); 0 where no state falls */
  cells: number[][];
}

export interface MaxCoefficientError {
  /** epsilon[k] = the largest |ê_ijk − e_ijk| over ordered pairs i ≠ j */
  epsilon: number[];
  /** at[k]: the first ordered pair, in row-major (i, j) order, where epsilon[k] occurs */
  at: { i: number; j: number }[];
}

export interface PairCertaintyOptions {
  w?: readonly number[];
  /** thresholds in (1/2, 1), strictly increasing; default [.9, .99] */
  thresholds?: readonly number[];
}

export interface PairCertainty {
  M: number;
  thresholds: number[];
  /** counts[t]: pairs i < j with min(ebar_ij, ebar_ji) < 1 − thresholds[t] (strict) */
  counts: number[];
}

/**
 * Marginal laws of a finite joint law `states[s][i][k]` with probabilities `probs[s]` (checked as in
 * finiteLawPairwise; null = equal weights): margins[i][k] = { values, probs } with the distinct values of
 * states[s][i][k] (equal means ===) in ascending order and, for each, the sum of the state probabilities with that
 * value, summed in state order (equal weights: the exact count over S). `ids` and `criteria` (optional, checked as
 * in finiteLawPairwise) are returned when given.
 */
export function finiteLawMargins(
  states: ArrayLike<UnitTable>,
  probs: ArrayLike<number> | null | undefined,
  options: LabelOptions = {},
): FiniteLawMargins {
  const o = readOptions<LabelOptions>(options, ["ids", "criteria"], "finiteLawMargins");
  const law = readLaw(states, probs, "states");
  const { S, n, K, p } = law;
  const labels = resolveLabels(o, n, K);
  const margins: MarginalLaw[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: MarginalLaw[] = [];
    for (let k = 0; k < K; k += 1) {
      // value -> summed probability (or count); a Map key treats −0 and 0 as one value, as ===
      const mass = new Map<number, number>();
      for (let s = 0; s < S; s += 1) {
        const x = law.states[s][i * K + k];
        mass.set(x, (mass.get(x) ?? 0) + (p === null ? 1 : p[s]));
      }
      const values = [...mass.keys()].sort((a, b) => a - b);
      row.push({ values, probs: values.map((v) => (p === null ? (mass.get(v) as number) / S : (mass.get(v) as number))) });
    }
    margins.push(row);
  }
  return {
    ...(o.ids !== undefined ? { ids: labels.ids } : {}),
    ...(o.criteria !== undefined ? { criteria: labels.criteria } : {}),
    margins,
  };
}

/** A tieTol option: finite and ≥ 0; default 1e-12. */
function readTieTol(x: number | undefined, fn: string): number {
  const v = x ?? 1e-12;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`${fn}: tieTol must be a finite number ≥ 0, got ${String(v)}`);
  return v;
}

/**
 * The majority relation of the weighted errors: i beats j when ebar_ij < ebar_ji − tieTol (stating i above j is
 * less often wrong than the reverse), and the pair is a majority tie when |ebar_ij − ebar_ji| ≤ tieTol. Wins and
 * ties per unit, the order by wins (descending, equal wins in index order), the number of cyclic triples (three
 * strict pairs a beats b, b beats c, c beats a, in either orientation) and whether the relation is a strict order
 * (no tie and no cyclic triple).
 */
export function majorityWins(E: ErrorArray, options: MajorityOptions = {}): MajorityWins {
  const o = readOptions<MajorityOptions>(options, ["w", "tieTol"], "majorityWins");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  const tieTol = readTieTol(o.tieTol, "majorityWins");
  const ebar = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) ebar[i * n + j] = weighted(e, w, i, j);
  const beats = new Uint8Array(n * n);
  const wins = new Array<number>(n).fill(0);
  const ties = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const a = ebar[i * n + j];
      const b = ebar[j * n + i];
      if (a < b - tieTol) {
        beats[i * n + j] = 1;
        wins[i] += 1;
      }
      if (Math.abs(a - b) <= tieTol) ties[i] += 1;
    }
  }
  const order = wins.map((_, i) => i).sort((a, b) => wins[b] - wins[a] || a - b);
  const cycleTriples: number[][] = [];
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let c = b + 1; c < n; c += 1) {
        const forward = beats[a * n + b] && beats[b * n + c] && beats[c * n + a];
        const backward = beats[a * n + c] && beats[c * n + b] && beats[b * n + a];
        // the two orientations exclude each other (a pair cannot be beaten both ways)
        if (forward) cycleTriples.push([a, b, c]);
        else if (backward) cycleTriples.push([a, c, b]);
      }
    }
  }
  const cycles = cycleTriples.length;
  return { wins, ties, order, cycles, strictOrder: cycles === 0 && ties.every((t) => t === 0), cycleTriples };
}

/**
 * The k unordered pairs i < j whose more likely direction is least certain: the largest min(ebar_ij, ebar_ji)
 * first, equal values in (i, j) index order. `above` is i when ebar_ij ≤ ebar_ji, else j. k (default 10) is a
 * positive integer, clamped to M. With `order` (a permutation of 0..n − 1, e.g. a display order) each pair also
 * has apart = |pos(i) − pos(j)|, the distance between the positions of i and j in `order`.
 */
export function leastCertainPairs(E: ErrorArray, options: LeastCertainOptions = {}): UncertainPair[] {
  const o = readOptions<LeastCertainOptions>(options, ["k", "w", "order"], "leastCertainPairs");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  const k = o.k ?? 10;
  if (typeof k !== "number" || !Number.isSafeInteger(k) || k < 1) throw new RangeError(`leastCertainPairs: k must be a positive integer, got ${String(k)}`);
  let pos: Int32Array | null = null;
  if (o.order !== undefined && o.order !== null) {
    if (!Array.isArray(o.order) || o.order.length !== n) throw new RangeError(`leastCertainPairs: order must list all ${n} unit indices`);
    pos = new Int32Array(n).fill(-1);
    o.order.forEach((u, p) => {
      if (typeof u !== "number" || !Number.isInteger(u) || u < 0 || u >= n || (pos as Int32Array)[u] !== -1) {
        throw new RangeError(`leastCertainPairs: order must be a permutation of 0..${n - 1}`);
      }
      (pos as Int32Array)[u] = p;
    });
  }
  const pairs: UncertainPair[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = weighted(e, w, i, j);
      const b = weighted(e, w, j, i);
      pairs.push({ i, j, e: Math.min(a, b), above: a <= b ? i : j });
    }
  }
  pairs.sort((x, y) => y.e - x.e); // stable: equal values keep (i, j) order
  const out = pairs.slice(0, Math.min(k, pairs.length));
  if (pos !== null) for (const pair of out) pair.apart = Math.abs(pos[pair.i] - pos[pair.j]);
  return out;
}

/**
 * How many directions the posterior is nearly sure of: counts[t] = #{i < j : min(ebar_ij, ebar_ji) < 1 −
 * thresholds[t]} (strict), the more likely direction having probability above the threshold. Thresholds lie in
 * (1/2, 1), strictly increasing (default [.9, .99]).
 */
export function pairCertainty(E: ErrorArray, options: PairCertaintyOptions = {}): PairCertainty {
  const o = readOptions<PairCertaintyOptions>(options, ["w", "thresholds"], "pairCertainty");
  const { n, K, e } = errorCube(E);
  const w = checkWeights(o.w, K);
  const thresholds = o.thresholds ?? [0.9, 0.99];
  if (!Array.isArray(thresholds) || thresholds.length < 1) {
    throw new RangeError("pairCertainty: thresholds must be a nonempty array of numbers in (1/2, 1)");
  }
  thresholds.forEach((t, q) => {
    if (typeof t !== "number" || !(t > 0.5 && t < 1)) throw new RangeError(`pairCertainty: thresholds must lie in (1/2, 1), got ${String(t)}`);
    if (q > 0 && !(t > thresholds[q - 1])) throw new RangeError("pairCertainty: thresholds must be strictly increasing");
  });
  const cuts = thresholds.map((t) => 1 - t);
  const counts = new Array<number>(thresholds.length).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const m = Math.min(weighted(e, w, i, j), weighted(e, w, j, i));
      for (let t = 0; t < cuts.length; t += 1) if (m < cuts[t]) counts[t] += 1;
    }
  }
  return { M: (n * (n - 1)) / 2, thresholds: [...thresholds], counts };
}

// ---------------------------------------------------------------------------------------------------------
// Part 1 supplement (Step 3.27; engine/API.md "v3 helpers: Part 1 supplement")

/**
 * The difference θ_A − θ_B of two normal posteriors with correlation ρ (`corr`, default 0): mean = meanA − meanB,
 * sd = √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB) (evaluated left to right), z = mean/sd and pi = Pr(θ_A > θ_B) =
 * normalCdf(z) (with ρ = 0 the value of pairDirection). Means finite; SDs finite and > 0; ρ in [−1, 1]; a
 * degenerate difference (sd = 0, e.g. ρ = 1 with equal SDs) throws a RangeError.
 */
export function pairDifference(meanA: number, sdA: number, meanB: number, sdB: number, options: PairDirectionOptions = {}): PairDifference {
  const corr = readOptions<PairDirectionOptions>(options, ["corr"], "pairDifference").corr ?? 0;
  checkFinite(meanA, "pairDifference: meanA");
  checkFinite(meanB, "pairDifference: meanB");
  for (const [x, name] of [[sdA, "sdA"], [sdB, "sdB"]] as const) {
    if (typeof x !== "number" || !Number.isFinite(x) || !(x > 0)) throw new RangeError(`pairDifference: ${name} must be a finite SD > 0, got ${String(x)}`);
  }
  if (typeof corr !== "number" || !(corr >= -1 && corr <= 1)) throw new RangeError(`pairDifference: corr must be a number in [−1, 1], got ${String(corr)}`);
  const mean = meanA - meanB;
  const sd = differenceSd(sdA, sdB, corr);
  const z = mean / sd;
  return { mean, sd, z, pi: normalCdf(z) };
}

/**
 * The joint law of (θ_i, θ_j) on one criterion of a finite law `states[s][i][k]`, `probs[s]` (checked as in
 * finiteLawPairwise; null = equally likely states): rowValues and colValues are the distinct values (===) of
 * states[s][i][criterion] and states[s][j][criterion] in ascending order, and cells[r][c] the sum of probs[s] over
 * the states with that pair of values, summed in state order (equal weights: the exact count over S; 0 where no
 * state falls). i ≠ j are unit indices; criterion (default 0) a criterion index.
 */
export function finiteLawCells(
  states: ArrayLike<UnitTable>,
  probs: ArrayLike<number> | null | undefined,
  options: FiniteLawCellsOptions,
): FiniteLawCells {
  const o = readOptions<FiniteLawCellsOptions>(options, ["i", "j", "criterion"], "finiteLawCells", true);
  const law = readLaw(states, probs, "states");
  const { S, n, K, p } = law;
  const index = (x: unknown, name: string, count: number, what: string): number => {
    if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0 || x >= count) {
      throw new RangeError(`finiteLawCells: ${name} must be ${what} index, an integer in 0..${count - 1}, got ${String(x)}`);
    }
    return x;
  };
  const i = index(o.i, "i", n, "a unit");
  const j = index(o.j, "j", n, "a unit");
  if (i === j) throw new RangeError(`finiteLawCells: i and j must be two different units, got ${i} for both`);
  const k = index(o.criterion ?? 0, "criterion", K, "a criterion");
  // distinct values: a Set (and a Map key) treats −0 and 0 as one value, as ===
  const valuesOf = (u: number): number[] => [...new Set(law.states.map((x) => x[u * K + k]))].sort((a, b) => a - b);
  const rowValues = valuesOf(i);
  const colValues = valuesOf(j);
  const rowAt = new Map(rowValues.map((v, r) => [v, r]));
  const colAt = new Map(colValues.map((v, c) => [v, c]));
  const cells = rowValues.map(() => new Array<number>(colValues.length).fill(0));
  for (let s = 0; s < S; s += 1) {
    const r = rowAt.get(law.states[s][i * K + k]) as number;
    const c = colAt.get(law.states[s][j * K + k]) as number;
    cells[r][c] += p === null ? 1 : p[s];
  }
  if (p === null) for (const row of cells) for (let c = 0; c < row.length; c += 1) row[c] /= S;
  return { rowValues, colValues, cells };
}

/**
 * The largest coefficient error per criterion between two ErrorArrays of the same shape (n ≥ 2 units, K criteria):
 * epsilon[k] = max over ordered pairs i ≠ j of |ê_ijk − e_ijk| (the `epsilon` of selectionOnDraws), and at[k] =
 * { i, j } of the first largest difference in row-major (i, j) order.
 */
export function maxCoefficientError(Ehat: ErrorArray, E: ErrorArray): MaxCoefficientError {
  const a = errorCube(Ehat, "Ehat");
  const b = errorCube(E, "E");
  if (a.n !== b.n || a.K !== b.K) {
    throw new RangeError(`maxCoefficientError: Ehat and E must have the same shape (Ehat ${a.K} × ${a.n} × ${a.n}, E ${b.K} × ${b.n} × ${b.n})`);
  }
  const { n, K } = a;
  const epsilon: number[] = [];
  const at: { i: number; j: number }[] = [];
  for (let k = 0; k < K; k += 1) {
    let max = -1;
    let where = { i: 0, j: 1 };
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const d = Math.abs(a.e[k][i][j] - b.e[k][i][j]);
        if (d > max) {
          max = d;
          where = { i, j };
        }
      }
    }
    epsilon.push(max);
    at.push(where);
  }
  return { epsilon, at };
}
