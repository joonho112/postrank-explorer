// Grade reports: canonical labels, disclosure counts, relations and family sizes.
//
// Definitions (postrank theory book ch. 9, sec-grade-actions; App. B; postrank 1.1.0)
//   A report is an ordered partition of the n units, written as a canonical grade vector g: labels 1..G,
//   every label used, grade 1 = highest priority (canonical_postrank_grade()).
//   x_ij = 1{g_i < g_j} states "i above j"; a shared grade withholds the direction (it asserts no equality).
//   z_ij = 1{g_i <= g_j} is the weak reporting relation (ch. 14 encoding): complete (z_ij + z_ji >= 1) and
//   transitive (z_ij + z_jk − z_ik <= 1). For distinct units x_ij = 1 − z_ji.
//   M = n(n − 1)/2; N(g) = Σ_{h<l} n_h n_l = M − Σ_h C(n_h, 2) counts each cross-grade pair once; s = N/M.
//   Family sizes (ch. 9 sec-exact-counts-caps-and-a-fixed-order): |A_n| = Σ_k k! S(n, k) (ordered Bell /
//   Fubini numbers), |A_=G| = G! S(n, G), |A_<=G| = Σ_{k<=G} k! S(n, k); a fixed order has C(m − 1, G − 1)
//   reports with exactly G grades (2^(m−1) in all), where m is the number of units, or of indivisible
//   blocks when equal order scores are kept together. Exact integer arithmetic (BigInt).
//   Part 3 helpers (Step 7.1; engine/API.md): stated directions that run against a score order, the change of
//   pair relations between two reports (postrank_compare()$relations), and a grade vector from cut positions.

import { type ErrorArray, type Matrix, defaultIds, nanMatrix } from "./pairwise.ts";
import { checkKeys, readOptions } from "./options.ts";
import { checkWeights, errorCube, weighted } from "./risk.ts";

/** Canonical grade vector: labels 1..G, grade 1 = highest priority, one entry per unit. */
export type Grade = number[];

/** A declared report family. */
export type Family =
  | { kind: "all" }
  | { kind: "atMost"; G: number }
  | { kind: "exactly"; G: number }
  | {
      kind: "order";
      /** unit indices, top first (a permutation of 0..n−1) */
      order: readonly number[];
      /** at most G grades */
      G?: number;
      /** exactly this many grades */
      exact?: number;
      /** sizes of the indivisible consecutive blocks along `order` (equal order scores); they sum to n */
      blocks?: readonly number[];
    };

export interface Disclosure {
  M: number;
  N: number;
  s: number;
  G: number;
  /** grade sizes, grade 1 first */
  sizes: number[];
  /** M − N: the pairs inside a grade, whose direction the report withholds */
  withheld: number;
}

export interface UnitRelationCounts {
  n: number;
  /** n − 1: the pairs each unit belongs to */
  partners: number;
  /** above[i]: units j with g_i < g_j (i is stated above j) */
  above: number[];
  /** below[i]: units j with g_i > g_j (i is stated below j) */
  below: number[];
  /** above + below: the directions the report states about unit i */
  stated: number[];
  /** the other units of unit i's grade: the pairs with i whose direction is withheld */
  withheld: number[];
}

export interface WeakRelation {
  /** z[i][j] = 1 if g_i ≤ g_j, else 0 (i ≠ j); NaN diagonal */
  z: Matrix;
  /** z_ij + z_ji ≥ 1 for every pair */
  complete: boolean;
  /** z_ij + z_jk − z_ik ≤ 1 for every triple of distinct units */
  transitive: boolean;
}

/** Row-order keys for a report card. `expectedRank`: smaller first; `mean`: larger first. */
export interface CardSummaries {
  ids?: readonly string[];
  expectedRank?: ArrayLike<number>;
  mean?: ArrayLike<number>;
}

export type CardSort = "grade" | "expected_rank" | "mean" | "label";

export interface ScoreOrderOptions {
  /** "descending" (default): a larger score is higher priority; "ascending": a smaller score is */
  direction?: "descending" | "ascending";
  /** entity ids (distinct strings) for the tie order; default A, B, … / U01, … (index order) */
  ids?: readonly string[];
}

export interface ScoreOrder {
  /** unit indices from highest to lowest priority */
  order: number[];
  /** sizes of the runs of exactly equal scores along `order` (sum n) */
  blocks: number[];
}

export interface StatedAgainstOptions {
  /** "descending" (default): a larger score is the better position; "ascending": a smaller one is */
  direction?: "descending" | "ascending";
}

export interface StatedAgainstPair {
  /** the unit the report states higher */
  above: number;
  /** the unit stated below it although its score is better */
  below: number;
}

export interface StatedAgainst {
  count: number;
  /** stated pairs whose scores run the other way (strictly), in pair order (0, 1), (0, 2), …, (1, 2), … */
  pairs: StatedAgainstPair[];
  /** ascending indices of the units that appear as `below` in some pair */
  units: number[];
}

/** i's relation to j in a report. */
export type PairRelation = "above" | "below" | "withheld";

export interface RelationChangeOptions {
  /** criterion weights for the stated error of a changed pair (only with E); default [1] when K = 1 */
  w?: readonly number[];
}

export interface RelationChangePair {
  i: number;
  j: number;
  /** i's relation to j under g0 */
  from: PairRelation;
  /** i's relation to j under g1 */
  to: PairRelation;
  /** the stated error under g1 (ebar_ij if i above j, ebar_ji if j above i); null when g1 withholds or E is null */
  error: number | null;
}

export interface RelationChange {
  M: number;
  /** pairs with the same relation in both reports */
  nSame: number;
  /** withheld by g0, stated by g1 */
  nNewDisclosed: number;
  /** stated by g0, withheld by g1 */
  nNewWithheld: number;
  /** stated in opposite directions */
  nReversed: number;
  /** newly disclosed + newly withheld + reversed */
  changed: number;
  /** changed / M */
  changeShare: number;
  /** nSame / M */
  agreement: number;
  /** the changed pairs, in pair order */
  pairs: RelationChangePair[];
}

export interface CutGradeOptions {
  /** unit indices from the top position down (a permutation of 0…n−1); default the identity */
  order?: readonly number[] | null;
  /** position ranges [from, to] (1-based, inclusive) that must share a grade */
  blocks?: readonly (readonly number[])[] | null;
}

// ---------------------------------------------------------------------------------------------------------
// Internal helpers (exported for risk.ts; not part of the public API in index.ts)

/** Canonical grade of a report on n units (n ≥ 2), with a length check against the probabilities. */
export function reportGrade(g: ArrayLike<number>, n?: number): Grade {
  const c = canonicalGrade(g);
  if (n !== undefined && c.length !== n) throw new RangeError(`the grade vector must have one entry per unit (${n})`);
  if (c.length < 2) throw new RangeError("a report needs at least two units");
  return c;
}

/** M, N, G, grade sizes and withheld = M − N of a canonical grade vector. */
export function counts(c: readonly number[]): Disclosure {
  const n = c.length;
  let G = 0;
  for (const h of c) if (h > G) G = h;
  const sizes = new Array<number>(G).fill(0);
  for (const h of c) sizes[h - 1] += 1;
  const M = pairCount(n);
  let within = 0;
  for (const m of sizes) within += (m * (m - 1)) / 2;
  const N = M - within;
  return { M, N, s: N / M, G, sizes, withheld: M - N };
}

function checkCount(x: number, name: string): void {
  if (!Number.isSafeInteger(x)) throw new RangeError(`${name} must be an integer`);
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function exactNumber(x: bigint): number | bigint {
  return x <= MAX_SAFE ? Number(x) : x;
}

/** k!·S(n, k) for k = 0..n: the surjections of n labelled units onto k ordered grades. */
function surjections(n: number): bigint[] {
  // row r holds k!·S(r, k); recurrence a(r, k) = k·(a(r − 1, k) + a(r − 1, k − 1)), a(0, 0) = 1
  let row: bigint[] = [1n];
  for (let r = 1; r <= n; r += 1) {
    const next = new Array<bigint>(r + 1).fill(0n);
    for (let k = 1; k <= r; k += 1) next[k] = BigInt(k) * ((row[k] ?? 0n) + row[k - 1]);
    row = next;
  }
  return row;
}

function binomial(m: number, r: number): bigint {
  if (r < 0 || r > m) return 0n;
  let out = 1n;
  const rr = Math.min(r, m - r);
  for (let q = 1; q <= rr; q += 1) out = (out * BigInt(m - rr + q)) / BigInt(q);
  return out;
}

/** Order of strings by Unicode code point (= UTF-8 byte order, as R's sort(method = "radix")). */
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
 * Labels renumbered 1..G in order of priority: the smallest input label becomes grade 1, the next smallest
 * grade 2, and so on (canonical_postrank_grade()). Every pair relation is preserved. Labels must be integers.
 */
export function canonicalGrade(g: ArrayLike<number>): Grade {
  if (g == null || typeof g !== "object" || typeof g.length !== "number") throw new RangeError("g must be an array of grade labels");
  const values = Array.from(g);
  for (const v of values) {
    if (typeof v !== "number" || !Number.isSafeInteger(v)) throw new RangeError("grade labels must be integers");
  }
  const labels = [...new Set(values)].sort((a, b) => a - b);
  const rank = new Map(labels.map((v, q) => [v, q + 1]));
  return values.map((v) => rank.get(v) as number);
}

/** M = n(n − 1)/2, the number of unordered pairs. */
export function pairCount(n: number): number {
  checkCount(n, "n");
  if (n < 0) throw new RangeError("n must be ≥ 0");
  return (n * (n - 1)) / 2;
}

/** Counts of a report: M, N (pairs in different grades), s = N/M, G, grade sizes (grade 1 first) and withheld = M − N
 *  (the pairs inside a grade; v3 Part 1 supplement). */
export function disclosure(g: ArrayLike<number>): Disclosure {
  return counts(reportGrade(g));
}

/** Matrix of +1 (row stated above column), 0 (withheld, or the diagonal) and −1 (row stated below column). */
export function relations(g: ArrayLike<number>): Matrix {
  const c = canonicalGrade(g);
  return c.map((gi) => c.map((gj) => (gi < gj ? 1 : gi > gj ? -1 : 0)));
}

/**
 * Per unit, the relations a report states about it: above[i] = #{j : g_i < g_j} (i stated above j),
 * below[i] = #{j : g_i > g_j}, stated = above + below, withheld = #{j ≠ i : g_j = g_i} (the other units of its
 * grade), and partners = n − 1 = stated + withheld. These are the row counts of `relations(g)`.
 */
export function unitRelationCounts(g: ArrayLike<number>): UnitRelationCounts {
  const c = canonicalGrade(g);
  const n = c.length;
  if (n < 1) throw new RangeError("g must hold at least one grade");
  const { sizes } = counts(c);
  // units in grades better (smaller label) than each grade: cumulative sizes
  const before = new Array<number>(sizes.length + 1).fill(0);
  for (let h = 0; h < sizes.length; h += 1) before[h + 1] = before[h] + sizes[h];
  const below = c.map((h) => before[h - 1]);
  const withheld = c.map((h) => sizes[h - 1] - 1);
  const above = c.map((_, i) => n - 1 - withheld[i] - below[i]);
  const stated = above.map((a, i) => a + below[i]);
  return { n, partners: n - 1, above, below, stated, withheld };
}

/** The weak relation z_ij = 1{g_i ≤ g_j} (i ≠ j; NaN diagonal) with its completeness and transitivity checks. */
export function weakRelation(g: ArrayLike<number>): WeakRelation {
  const c = canonicalGrade(g);
  const n = c.length;
  const z = nanMatrix(n);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) z[i][j] = c[i] <= c[j] ? 1 : 0;
  let complete = true;
  for (let i = 0; i < n && complete; i += 1) for (let j = i + 1; j < n; j += 1) if (z[i][j] + z[j][i] < 1) complete = false;
  let transitive = true;
  for (let i = 0; i < n && transitive; i += 1) {
    for (let j = 0; j < n && transitive; j += 1) {
      if (j === i) continue;
      for (let k = 0; k < n; k += 1) {
        if (k === i || k === j) continue;
        if (z[i][j] + z[j][k] - z[i][k] > 1) {
          transitive = false;
          break;
        }
      }
    }
  }
  return { z, complete, transitive };
}

const FAMILY_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  all: ["kind"],
  atMost: ["kind", "G"],
  exactly: ["kind", "G"],
  order: ["kind", "order", "G", "exact", "blocks"],
});

/** Exact family size as a BigInt (validates the family; unknown keys throw). Internal; see familySize. */
export function familySizeExact(n: number, family: Family): bigint {
  checkCount(n, "n");
  if (n < 1) throw new RangeError("n must be ≥ 1");
  if (family == null || typeof family !== "object") throw new RangeError("family must be a family object");
  const keys = FAMILY_KEYS[(family as { kind?: string }).kind as string];
  if (keys === undefined) throw new RangeError(`unknown family kind ${String((family as { kind?: unknown }).kind)}`);
  checkKeys(family, keys, `family { kind: "${family.kind}" }`);
  switch (family.kind) {
    case "all":
    case "atMost": {
      const cap = family.kind === "all" ? n : family.G;
      checkCount(cap, "G");
      const a = surjections(n);
      let total = 0n;
      for (let k = 1; k <= Math.min(cap, n); k += 1) total += a[k];
      return total;
    }
    case "exactly": {
      checkCount(family.G, "G");
      if (family.G < 1 || family.G > n) return 0n;
      return surjections(n)[family.G];
    }
    case "order": {
      const order = family.order;
      if (!Array.isArray(order) || order.length !== n) throw new RangeError(`order must list all ${n} unit indices`);
      const seen = new Set<number>();
      for (const u of order) {
        if (!Number.isInteger(u) || u < 0 || u >= n || seen.has(u)) throw new RangeError("order must be a permutation of 0..n−1");
        seen.add(u);
      }
      let m = n;
      if (family.blocks !== undefined) {
        const b = family.blocks;
        if (!Array.isArray(b) || !b.every((x) => Number.isSafeInteger(x) && x >= 1) || b.reduce((x, y) => x + y, 0) !== n) {
          throw new RangeError(`blocks must be positive block sizes along the order, summing to ${n}`);
        }
        m = b.length;
      }
      if (family.exact !== undefined) {
        checkCount(family.exact, "exact");
        if (family.G !== undefined) checkCount(family.G, "G");
        if (family.exact < 1 || family.exact > m || (family.G !== undefined && family.exact > family.G)) return 0n;
        return binomial(m - 1, family.exact - 1);
      }
      if (family.G !== undefined) {
        checkCount(family.G, "G");
        let total = 0n;
        for (let k = 1; k <= Math.min(family.G, m); k += 1) total += binomial(m - 1, k - 1);
        return total;
      }
      return 1n << BigInt(m - 1);
    }
    default:
      throw new RangeError(`unknown family kind ${String((family as { kind?: unknown }).kind)}`);
  }
}

/**
 * Exact number of reports in a family of reports on n units: a number, or a BigInt when it exceeds
 * Number.MAX_SAFE_INTEGER (2^53 − 1). Empty families (a cap below 1, an exact count outside 1..n) give 0.
 * A family key that does not belong to its kind throws.
 */
export function familySize(n: number, family: Family): number | bigint {
  return exactNumber(familySizeExact(n, family));
}

/**
 * The declared order and indivisible blocks of a score vector, exactly as postrank_cuts() builds them: units
 * sorted by score (`direction`, default "descending": larger first), equal scores in entity-id code-point order
 * (R's radix sort; `ids` default A, B, … / U01, …, which is index order), and every run of exactly equal scores
 * (no epsilon) one block. Pass the result to fixedOrderDP or orderHull, or give them `scores` directly.
 */
export function scoreOrder(scores: ArrayLike<number>, options: ScoreOrderOptions = {}): ScoreOrder {
  const o = readOptions<ScoreOrderOptions>(options, ["direction", "ids"], "scoreOrder");
  if (scores == null || typeof scores !== "object" || typeof scores.length !== "number" || scores.length < 1) {
    throw new RangeError("scores must be a nonempty array of numbers");
  }
  const s = Array.from(scores);
  if (!s.every((x) => typeof x === "number" && Number.isFinite(x))) throw new RangeError("scores must be finite numbers");
  const n = s.length;
  const d = o.direction ?? "descending";
  if (d !== "descending" && d !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  const ids = o.ids === undefined ? defaultIds(n) : Array.from(o.ids);
  if (ids.length !== n || !ids.every((x) => typeof x === "string") || new Set(ids).size !== n) {
    throw new RangeError(`ids must be ${n} distinct strings`);
  }
  const sign = d === "descending" ? -1 : 1;
  const order = s.map((_, i) => i).sort((a, b) => sign * (s[a] - s[b]) || compareCodePoints(ids[a], ids[b]));
  const blocks: number[] = [];
  for (let p = 0; p < n; p += 1) {
    if (p > 0 && s[order[p]] === s[order[p - 1]]) blocks[blocks.length - 1] += 1;
    else blocks.push(1);
  }
  return { order, blocks };
}

/**
 * Row order of a report card (unit indices), with the package's rules (postrank_report_card(),
 * postrank_plot_report_card()): grades stay contiguous, grade 1 first; within a grade
 *   "grade"          keeps the input order (the stored card order),
 *   "expected_rank"  smaller summaries.expectedRank first (pass the weighted expected rank),
 *   "mean"           larger summaries.mean first (one criterion's posterior mean),
 *   "label"          unit id order;
 * remaining ties are broken by unit id in code-point order (R's radix sort). Ids default to A, B, … / U01, ….
 */
export function reportCardRows(g: ArrayLike<number>, summaries: CardSummaries = {}, sort: CardSort = "expected_rank"): number[] {
  readOptions(summaries, ["ids", "expectedRank", "mean"], "reportCardRows summaries");
  summaries = summaries ?? {};
  const c = canonicalGrade(g);
  const n = c.length;
  const ids = summaries.ids === undefined ? defaultIds(n) : Array.from(summaries.ids);
  if (ids.length !== n || !ids.every((x) => typeof x === "string")) throw new RangeError(`summaries.ids must be ${n} strings`);
  const keyOf = (field: "expectedRank" | "mean", sign: number): number[] => {
    const x = summaries[field];
    if (x == null || x.length !== n) throw new RangeError(`sort "${sort}" needs summaries.${field} with ${n} values`);
    const out = Array.from(x, (v) => sign * v);
    if (!out.every(Number.isFinite)) throw new RangeError(`summaries.${field} must be finite`);
    return out;
  };
  let key: number[];
  switch (sort) {
    case "grade":
      key = c.map((_, i) => i);
      break;
    case "expected_rank":
      key = keyOf("expectedRank", 1);
      break;
    case "mean":
      key = keyOf("mean", -1);
      break;
    case "label":
      key = new Array<number>(n).fill(0);
      break;
    default:
      throw new RangeError(`sort must be "grade", "expected_rank", "mean" or "label"`);
  }
  const rows = c.map((_, i) => i);
  rows.sort((a, b) => c[a] - c[b] || key[a] - key[b] || compareCodePoints(ids[a], ids[b]) || a - b);
  return rows;
}

// ---------------------------------------------------------------------------------------------------------
// Part 3 helpers (Step 7.1)

/**
 * Stated directions that run against a score order: a pair i < j is listed when the report states a direction
 * (g_i ≠ g_j) and the scores order the two strictly the other way ("descending": the unit stated above has the
 * smaller score). Equal scores are never against. `units`: the units stated below a unit with a worse score.
 */
export function statedAgainst(g: ArrayLike<number>, scores: ArrayLike<number>, options: StatedAgainstOptions = {}): StatedAgainst {
  const o = readOptions<StatedAgainstOptions>(options, ["direction"], "statedAgainst");
  const c = reportGrade(g);
  const n = c.length;
  if (scores == null || typeof scores !== "object" || typeof scores.length !== "number" || scores.length !== n) {
    throw new RangeError(`statedAgainst: scores must hold one number per unit (${n})`);
  }
  const s = Array.from(scores);
  if (!s.every((x) => typeof x === "number" && Number.isFinite(x))) throw new RangeError("statedAgainst: scores must be finite numbers");
  const d = o.direction ?? "descending";
  if (d !== "descending" && d !== "ascending") throw new RangeError('statedAgainst: direction must be "descending" or "ascending"');
  // better(a, b): a's score puts it strictly higher than b
  const better = d === "descending" ? (a: number, b: number) => s[a] > s[b] : (a: number, b: number) => s[a] < s[b];
  const pairs: StatedAgainstPair[] = [];
  const flagged = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (c[i] === c[j]) continue;
      const above = c[i] < c[j] ? i : j;
      const below = above === i ? j : i;
      if (better(below, above)) {
        pairs.push({ above, below });
        flagged[below] = 1;
      }
    }
  }
  const units: number[] = [];
  for (let i = 0; i < n; i += 1) if (flagged[i]) units.push(i);
  return { count: pairs.length, pairs, units };
}

const relationOf = (r: number): PairRelation => (r > 0 ? "above" : r < 0 ? "below" : "withheld");

/**
 * How the pair relations change from report g0 to report g1 (postrank_compare()$relations): for each pair i < j,
 * r = sign(g_j − g_i) (+1: i above j, 0: withheld); same, newly disclosed (0 → stated), newly withheld (stated → 0)
 * or reversed. `pairs` lists the changed pairs with the error g1 states (ebar as in statedAbove; null without E).
 */
export function relationChange(
  g0: ArrayLike<number>,
  g1: ArrayLike<number>,
  E: ErrorArray | null = null,
  options: RelationChangeOptions = {},
): RelationChange {
  const o = readOptions<RelationChangeOptions>(options, ["w"], "relationChange");
  const a = reportGrade(g0);
  const b = reportGrade(g1, a.length);
  const n = a.length;
  let cube: { e: Matrix[]; w: number[] } | null = null;
  if (E !== null && E !== undefined) {
    const { n: nE, K, e } = errorCube(E);
    if (nE !== n) throw new RangeError(`relationChange: E has ${nE} units, the reports ${n}`);
    cube = { e, w: checkWeights(o.w, K) };
  } else if (o.w !== undefined) {
    throw new RangeError("relationChange: w applies only together with E");
  }
  let nSame = 0;
  let nNewDisclosed = 0;
  let nNewWithheld = 0;
  let nReversed = 0;
  const pairs: RelationChangePair[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const r0 = Math.sign(a[j] - a[i]);
      const r1 = Math.sign(b[j] - b[i]);
      if (r0 === r1) {
        nSame += 1;
        continue;
      }
      if (r0 === 0) nNewDisclosed += 1;
      else if (r1 === 0) nNewWithheld += 1;
      else nReversed += 1;
      let error: number | null = null;
      if (cube !== null && r1 !== 0) error = r1 > 0 ? weighted(cube.e, cube.w, i, j) : weighted(cube.e, cube.w, j, i);
      pairs.push({ i, j, from: relationOf(r0), to: relationOf(r1), error });
    }
  }
  const M = pairCount(n);
  return { M, nSame, nNewDisclosed, nNewWithheld, nReversed, changed: pairs.length, changeShare: pairs.length / M, agreement: nSame / M, pairs };
}

/**
 * Grade vector from cut positions along an order: a cut c (1 ≤ c ≤ n − 1, strictly increasing) falls after the
 * c-th unit of `order` (default the identity), and the unit at position p (1-based) gets grade 1 + #{cuts < p}.
 * `blocks` lists position ranges [from, to] (1-based, inclusive) that must share a grade: a cut with
 * from ≤ c < to throws a RangeError naming the block. n 12, cuts [4, 8] → sizes 4/4/4.
 */
export function cutGrade(n: number, cuts: readonly number[], options: CutGradeOptions = {}): Int8Array {
  const o = readOptions<CutGradeOptions>(options, ["order", "blocks"], "cutGrade");
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 2) throw new RangeError("cutGrade: n must be an integer ≥ 2");
  if (!Array.isArray(cuts)) throw new RangeError("cutGrade: cuts must be an array of positions");
  for (let q = 0; q < cuts.length; q += 1) {
    const c = cuts[q];
    if (typeof c !== "number" || !Number.isSafeInteger(c) || c < 1 || c > n - 1) {
      throw new RangeError(`cutGrade: cut ${String(c)} must be an integer in 1…${n - 1}`);
    }
    if (q > 0 && !(c > cuts[q - 1])) throw new RangeError("cutGrade: cuts must be strictly increasing");
  }
  if (cuts.length + 1 > 127) throw new RangeError("cutGrade: at most 126 cuts (127 grades)");
  let order: number[];
  if (o.order === undefined || o.order === null) order = Array.from({ length: n }, (_, i) => i);
  else {
    if (!Array.isArray(o.order) || o.order.length !== n) throw new RangeError(`cutGrade: order must list all ${n} unit indices`);
    const seen = new Uint8Array(n);
    for (const u of o.order) {
      if (typeof u !== "number" || !Number.isInteger(u) || u < 0 || u >= n || seen[u]) {
        throw new RangeError("cutGrade: order must be a permutation of 0…n−1");
      }
      seen[u] = 1;
    }
    order = Array.from(o.order);
  }
  if (o.blocks !== undefined && o.blocks !== null) {
    if (!Array.isArray(o.blocks)) throw new RangeError("cutGrade: blocks must be a list of [from, to] position ranges");
    for (const blk of o.blocks) {
      const ok =
        Array.isArray(blk) &&
        blk.length === 2 &&
        blk.every((x) => typeof x === "number" && Number.isSafeInteger(x)) &&
        blk[0] >= 1 &&
        blk[0] <= blk[1] &&
        blk[1] <= n;
      if (!ok) throw new RangeError(`cutGrade: each block must be [from, to] with 1 ≤ from ≤ to ≤ ${n}`);
      const [from, to] = blk;
      for (const c of cuts) {
        if (from <= c && c < to) {
          throw new RangeError(`cutGrade: cut ${c} falls inside block [${from}, ${to}] (positions ${from}…${to} must share a grade)`);
        }
      }
    }
  }
  const g = new Int8Array(n);
  let grade = 1;
  let q = 0;
  for (let p = 1; p <= n; p += 1) {
    while (q < cuts.length && cuts[q] < p) {
      grade += 1;
      q += 1;
    }
    g[order[p - 1]] = grade;
  }
  return g;
}
