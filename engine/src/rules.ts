// Common reporting rules read as reports: strict orders, fixed quantile tiers, standardized-evidence flags and
// the weighted expected rank.
//
// Definitions (postrank theory book ch. 17 define-the-analytical-comparators-through-their-operations, ch. 5,
// ch. 19; postrank 1.1.0 R/baselines.R)
//   Strict order: grade = position in the descending score order (ties broken by unit index), a complete report.
//   Quantile tiers (postrank_cuts(rule = "quantile"), .pr_cuts_core): units sorted by score (descending; equal
//     scores by unit id), position p gets the raw tier 1 + ⌊(p − 1)G_b/n⌋ with G_b = min(G, n); exactly equal
//     scores form indivisible blocks, and every raw tier a block straddles is merged with the others it
//     straddles (union–find, transitively), so the realized number of tiers can be below G_b; labels are then
//     renumbered 1..G in order.
//   Evidence flags (ch. 17 reference-evidence comparator; ch. 2): z_i = (y_i − r)/s_i; |z_i| > c flags the unit
//     above (z > c) or below (z < −c); read as a report, flagged above / not flagged / flagged below are grades
//     1 / 2 / 3 (canonical labels, so an unused group leaves no gap).
//   Expected rank (postrank_expected_rank()): r_i = Σ_k b_k {1 + Σ_{j≠i} e_ij,k}, smaller = higher priority,
//     equal weights 1/K by default, the inner sums taken over columns in entity-id order.

import { type ErrorArray, defaultIds } from "./pairwise.ts";
import { type Grade, canonicalGrade } from "./report.ts";
import { prepare } from "./optimize.ts";
import { readOptions } from "./options.ts";

export type ScoreDirection = "descending" | "ascending";

export interface ScoreOptions {
  /** "descending" (default): a larger score is higher priority; "ascending": a smaller score is (expected rank) */
  direction?: ScoreDirection;
}

export interface EvidenceOptions {
  /** reference value r; default 0 */
  ref?: number;
  /** cutoff c ≥ 0; a unit is flagged when |z| > c (strict); default 1.96 */
  crit?: number;
}

export interface EvidenceFlags {
  /** canonical grades: flagged above first, then not flagged, then flagged below */
  grade: Grade;
  /** z_i = (est_i − ref)/se_i */
  z: number[];
  /** the flag group of each unit: 1 above, 2 not flagged, 3 below (before canonical renumbering) */
  labels: number[];
}

// ---------------------------------------------------------------------------------------------------------
// Helpers

function readScores(scores: ArrayLike<number>, name = "scores"): number[] {
  if (scores == null || typeof scores !== "object" || typeof scores.length !== "number" || scores.length < 1) {
    throw new RangeError(`${name} must be a nonempty array of numbers`);
  }
  const out = Array.from(scores);
  if (!out.every((x) => typeof x === "number" && Number.isFinite(x))) throw new RangeError(`${name} must be finite numbers`);
  return out;
}

function directionSign(options: ScoreOptions | undefined): number {
  const d = options?.direction ?? "descending";
  if (d !== "descending" && d !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  return d === "descending" ? -1 : 1;
}

/** Unit indices from highest to lowest priority; equal scores in index order (= default-id order). */
function priorityOrder(s: readonly number[], sign: number): number[] {
  const idx = s.map((_, i) => i);
  idx.sort((a, b) => sign * s[a] - sign * s[b] || a - b);
  return idx;
}

/** Code-point order of strings (R's order(method = "radix")). */
function compareCodePoints(a: string, b: string): number {
  const A = Array.from(a);
  const B = Array.from(b);
  const len = Math.min(A.length, B.length);
  for (let q = 0; q < len; q += 1) {
    const d = (A[q].codePointAt(0) as number) - (B[q].codePointAt(0) as number);
    if (d !== 0) return d;
  }
  return A.length - B.length;
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/**
 * The complete report of a score order: grade = position 1..n in descending score order (a larger score is
 * higher priority; `direction: "ascending"` reverses this), equal scores broken by unit index.
 */
export function strictOrder(scores: ArrayLike<number>, options: ScoreOptions = {}): Grade {
  options = readOptions<ScoreOptions>(options, ["direction"], "strictOrder");
  const s = readScores(scores);
  const order = priorityOrder(s, directionSign(options));
  const grade = new Array<number>(s.length);
  order.forEach((u, p) => (grade[u] = p + 1));
  return grade;
}

/**
 * Fixed tiers at the package's quantile positions, exactly as postrank_cuts(rule = "quantile"): position p of
 * the descending score order gets 1 + ⌊(p − 1)G_b/n⌋ (G_b = min(G, n)); exactly equal scores are never split,
 * and every tier that a run of equal scores straddles is merged with the tiers it straddles (transitively), so
 * fewer than G_b tiers can result. Returns canonical grades. `direction: "ascending"` orders smaller first.
 */
export function tierGrades(scores: ArrayLike<number>, G: number, options: ScoreOptions = {}): Grade {
  options = readOptions<ScoreOptions>(options, ["direction"], "tierGrades");
  const s = readScores(scores);
  const n = s.length;
  if (!Number.isSafeInteger(G) || G < 1) throw new RangeError("G must be a positive integer");
  const Gb = Math.min(G, n);
  const order = priorityOrder(s, directionSign(options));
  // exact-score blocks along the order (no epsilon), 1-based as in the package
  const block = new Array<number>(n);
  block[0] = 1;
  for (let p = 1; p < n; p += 1) block[p] = block[p - 1] + (s[order[p]] !== s[order[p - 1]] ? 1 : 0);
  const B = block[n - 1];
  const raw = Array.from({ length: n }, (_, p) => 1 + Math.floor((p * Gb) / n));
  // union–find over raw tiers (parent[h] for h = 1..Gb)
  const parent = Array.from({ length: Gb + 1 }, (_, h) => h);
  const find = (h: number): number => {
    while (parent[h] !== h) h = parent[h];
    return h;
  };
  for (let bl = 1; bl <= B; bl += 1) {
    const tiers = [...new Set(raw.filter((_, p) => block[p] === bl))];
    if (tiers.length > 1) {
      const root = find(Math.min(...tiers));
      for (const h of tiers) parent[find(h)] = root;
    }
  }
  const merged = raw.map(find);
  const blockGrade = new Array<number>(B + 1);
  for (let p = n - 1; p >= 0; p -= 1) blockGrade[block[p]] = merged[p]; // the block's first position wins
  const grade = new Array<number>(n);
  order.forEach((u, p) => (grade[u] = blockGrade[block[p]]));
  return canonicalGrade(grade);
}

/**
 * Standardized-evidence flags read as a report: z_i = (est_i − ref)/se_i; flagged above when z_i > crit
 * (grade 1), flagged below when z_i < −crit (last grade), otherwise not flagged. Strict cutoff; canonical
 * grades. `se` is one SE per unit or one common SE (> 0).
 */
export function evidenceFlags(est: ArrayLike<number>, se: ArrayLike<number> | number, options: EvidenceOptions = {}): EvidenceFlags {
  options = readOptions<EvidenceOptions>(options, ["ref", "crit"], "evidenceFlags");
  const y = readScores(est, "est");
  const n = y.length;
  const s = typeof se === "number" ? new Array<number>(n).fill(se) : readScores(se, "se");
  if (s.length !== n) throw new RangeError(`se must have ${n} values (or be one number)`);
  if (!s.every((x) => x > 0)) throw new RangeError("se must be positive");
  const ref = options?.ref ?? 0;
  const crit = options?.crit ?? 1.96;
  if (typeof ref !== "number" || !Number.isFinite(ref)) throw new RangeError("ref must be a finite number");
  if (typeof crit !== "number" || !Number.isFinite(crit) || crit < 0) throw new RangeError("crit must be a finite number ≥ 0");
  const z = y.map((v, i) => (v - ref) / s[i]);
  const labels = z.map((x) => (x > crit ? 1 : x < -crit ? 3 : 2));
  return { grade: canonicalGrade(labels), z, labels };
}

/**
 * Weighted expected ranks, exactly as postrank_expected_rank(): r_i = Σ_k w_k {1 + Σ_{j≠i} e[k][i][j]} (1 =
 * highest priority; smaller is higher). Default weights 1/K. The inner sum runs over columns in entity-id
 * code-point order and both sums are plain left-to-right additions, as the package's rowSums and %*%, so
 * mathematically equal ranks come out equal whenever the package's do (equal ranks are indivisible blocks of a
 * declared order).
 */
export function expectedRank(E: ErrorArray, options: { w?: readonly number[] } = {}): number[] {
  options = readOptions<{ w?: readonly number[] }>(options, ["w"], "expectedRank");
  const K = Array.isArray(E?.e) ? E.e.length : 0;
  const w = options?.w ?? new Array<number>(K).fill(1 / Math.max(K, 1));
  const P = prepare(E, w);
  const { n, ek } = P;
  const ids = Array.isArray(E.ids) && E.ids.length === n ? E.ids : defaultIds(n);
  const columns = ids.map((_, j) => j).sort((a, b) => compareCodePoints(ids[a], ids[b]) || a - b);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let r = 0;
    for (let k = 0; k < P.K; k += 1) {
      let s = 0;
      for (const j of columns) s += j === i ? 0 : ek[k][i * n + j];
      r += (1 + s) * P.w[k];
    }
    out[i] = r;
  }
  return out;
}
