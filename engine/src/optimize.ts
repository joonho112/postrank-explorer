// Exact optima over small report families, the fixed-order dynamic program, and the τ and weight paths.
//
// Definitions (postrank theory book; postrank 1.1.0)
//   Families (ch. 9 sec-exact-counts-caps-and-a-fixed-order): 𝒜_n (every canonical ordered partition),
//     𝒜_≤G, 𝒜_=G, and the contiguous family 𝒜ᵨ of one declared order (optionally capped or exact, with
//     indivisible blocks of equal order scores). Sizes come from familySize() (report.ts).
//   Risk (ch. 11 prp-weighted-directional-risk): R(g) = (Ew + τ(M − N))/M = τ + Z/M with Z = Ew − τN, so an
//     optimum minimizes Ew − τN over the family.
//   Tolerance (one convention, E-19): two reports tie when their risks differ by at most tieTol (default
//     1e-12, risk scale), that is when their Z differ by at most tieTol·M (count units).
//   Optima within a family: every report within tieTol of the minimum, in lexicographic order of the grade vector
//     (`grades`, at most maxTies of them, with the full `tieCount`). `grade` is the lexicographically first
//     optimum, except for an order family, where it is the package's choice (fewer grades, then the earlier cut;
//     E-1), the report fixedOrderDP returns.
//   Budgets (ch. 13; App. B 𝒜_q): E_k(g) ≤ q_k N(g) for every criterion k with q_k given; N = 0 passes.
//   Fixed-order DP (ch. 14 prp-fixed-order-dynamic-program): positions s < t of the order ρ,
//     η_st = ebar_{ρ_s ρ_t} − τ, block saving W(a, b) = Σ_{a<s<t≤b} η_st, T = W(0, n);
//     V_h(c) = max_{h−1≤b<c} V_{h−1}(b) + W(b, c), V_0(0) = 0; risk = τ + (T − V)/M.
//     Package tie rules (postrank_cuts(rule = "optimal"), R/baselines.R .pr_cuts_core): units with equal order
//     scores form indivisible blocks (cuts only at block boundaries); at equal objective the fewer occupied
//     grades win (which.min over the terminal values), then the lexicographically earlier vector of cut
//     positions (.pr_lexicographic_less, kept per DP state). The package compares with epsilon 0; here equal
//     means within tieTol on the risk scale (|ΔV| ≤ tieTol·M); tieTol: 0 gives the package's exact comparison.
//     The tied optima are the cut sets reached through tied choices at every DP state.
//   τ path (ch. 16 prp-matched-disclosure-frontier): each report's risk is linear in τ, so the optimum over
//     τ ∈ (0, 1/2] follows the lower convex hull of (N, min Ew); breakpoints are the hull edge slopes.
//   Weight breakpoints (K = 2): with w = (w1, 1 − w1) each report's Z = E_2 − τN + w1(E_1 − E_2) is linear in
//     w1, so the optimum over w1 ∈ [0, 1] follows the lower hull of (E_2 − E_1, E_2 − τN).
//
// Enumeration is a walk over typed arrays with incremental evaluation (N and the pair sums are updated as each
// unit receives its grade, so a leaf costs O(n)); no array of all reports is ever built (CONTRACT 8.8).
// Budget: n ≤ 20 and at most 600,000 reports (n = 8 unrestricted: 545,835; n = 12, at most 3 grades: 523,251;
// n = 20, exactly one grade: 1).

import { formatCount } from "./format.ts";
import { Accumulator, type ErrorArray } from "./pairwise.ts";
import { type Family, type Grade, familySizeExact, pairCount, scoreOrder } from "./report.ts";
import { type ReportEvaluation, checkTau, checkWeights, evaluateReport } from "./risk.ts";
import { attachExact, checkKeys, checkMaxTies, countValue, plural, readOptions } from "./options.ts";

/** Exact enumeration limits: at most `maxReports` reports in the family and at most `maxUnits` units. */
export const ENUMERATION_BUDGET: Readonly<{ maxReports: number; maxUnits: number }> = Object.freeze({
  maxReports: 600000,
  maxUnits: 20,
});

/** Above this many reports reportCloud() returns no full point list. */
export const CLOUD_POINTS_LIMIT = 5000;

const DEFAULT_TIE_TOL = 1e-12;
/** Absolute tolerance on the budget residual E_k − q_k N (count units; a feasibility tolerance, not a tie test). */
const BUDGET_TOL = 1e-12;
/** fixedOrderDP lists its tied optima lexicographically when tieCount·n is at most this; else in the package's order. */
const DP_TIE_LIST_WORK = 20000000n;

// ---------------------------------------------------------------------------------------------------------
// Types

/** A family as shown with a result: symbol, words and exact size. */
export interface FamilyLabel {
  /** badge form, e.g. "𝒜₆", "𝒜_≤3", "𝒜_=2", "𝒜ᵨ,≤4"; with budgets "𝒜_q (𝒜_≤3)" */
  name: string;
  /** the family in words, e.g. "reports with at most 3 grades" */
  words: string;
  /** number of reports in the family (after any budgets or pair constraints): a number up to 2^53, else a
   *  decimal string */
  size: number | string;
  /** the same count as a BigInt (non-enumerable: JSON.stringify and deep-equality checks skip it) */
  readonly sizeExact: bigint;
  /** with budgets or pair constraints: the size of the base family (number up to 2^53, else a decimal string) */
  baseSize?: number | string;
  /** with budgets only: q_k per criterion (null = no budget on k) */
  budgets?: (number | null)[];
}

/** The result of any optimizing function on an empty family (E-15). */
export interface EmptyResult<L extends string = string> {
  empty: true;
  family: FamilyLabel;
  containsAllWithheld: false;
  label: L;
}

export type EmptyOptimum = EmptyResult<"exact-within-family">;

export interface OptimumOptions {
  /** withholding cost, 0 < τ ≤ 1/2 */
  tau: number;
  /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
  w?: readonly number[];
  /** report family; default { kind: "all" } */
  family?: Family;
  /** error budgets: q[k] ≥ 0 restricts to E_k ≤ q_k N; null or undefined = no budget on criterion k */
  q?: readonly (number | null | undefined)[];
  /** risk tolerance for tied optima; default 1e-12 */
  tieTol?: number;
  /** at most this many tied optima are listed in `grades` (tieCount gives them all); default 100 */
  maxTies?: number;
}

/** Exact optimization after requiring each listed pair direction, within one ordinary report family. */
export interface PairConstrainedOptions {
  tau: number;
  w?: readonly number[];
  family?: Family;
  /** [i, j] requires g_i < g_j; duplicate entries are removed in first-occurrence order. */
  stating?: readonly (readonly number[])[];
  tieTol?: number;
  maxTies?: number;
}

export interface PairConstraintMetadata {
  /** The ordinary, unfiltered family, with its full candidate count. */
  baseFamily: FamilyLabel;
  /** Validated distinct-index pairs, with duplicates removed. */
  stating: [number, number][];
}

export type PairConstrainedOptimum = (
  | ExactOptimum
  | EmptyOptimum
  | FixedOrderResult
  | EmptyResult<"optimal-within-order">
) & PairConstraintMetadata;

export interface ExactOptimum {
  empty: false;
  /** the lexicographically first optimum; for an order family, the package's choice (fewer grades, then the
   *  earlier cut), as fixedOrderDP */
  grade: Grade;
  /** the optima within tieTol of the minimum risk, in lexicographic order (at most maxTies) */
  grades: Grade[];
  /** the number of optima within tieTol (grades.length < tieCount when the list was cut at maxTies) */
  tieCount: number;
  /** risk of `grade` (evaluateReport) */
  risk: number;
  N: number;
  G: number;
  Ew: number;
  E: number[];
  EoverN: (number | null)[];
  /** full evaluation of `grade` */
  evaluation: ReportEvaluation;
  family: FamilyLabel;
  /** the family contains the all-withheld report (so E ≤ τN holds at the optimum, CONTRACT 6.4) */
  containsAllWithheld: boolean;
  tieTol: number;
  label: "exact-within-family";
}

/** The declared order of fixedOrderDP and orderHull: top-level `order` (with G, exact, blocks), `scores`
 *  (+ direction, ids), or `family` ({ kind: "order", … }, or { kind: "atMost" | "exactly" | "all" } with a
 *  top-level order or scores). */
export interface OrderInputs {
  /** unit indices from highest to lowest priority (a permutation of 0..n−1) */
  order?: readonly number[];
  /** at most G grades (default: no cap) */
  G?: number;
  /** exactly this many grades */
  exact?: number;
  /** sizes of the indivisible runs of equal order scores along `order` (sum n); default all 1 */
  blocks?: readonly number[];
  /** the family: { kind: "order", order, G?, exact?, blocks? }, or a grade-count family with a top-level order */
  family?: Family;
  /** order scores instead of order and blocks: scoreOrder(scores, { direction, ids }) */
  scores?: ArrayLike<number>;
  /** with scores: "descending" (default) or "ascending" */
  direction?: "descending" | "ascending";
  /** with scores: entity ids for the tie order; default E.ids */
  ids?: readonly string[];
}

export interface FixedOrderOptions extends OrderInputs {
  tau: number;
  w?: readonly number[];
  /** return the DP table */
  trace?: boolean;
  /** risk tolerance for equal objectives (|ΔV| ≤ tieTol·M); default 1e-12; 0 = exact comparison as the package */
  tieTol?: number;
  /** at most this many tied optima in `grades`; default 100 */
  maxTies?: number;
}

export interface FixedOrderTrace {
  /** M = n(n − 1)/2 */
  M: number;
  /** T = W(0, n): the saving of withholding everything (all-singleton risk = τ + T/M) */
  T: number;
  /** block sizes along the order */
  blocks: number[];
  /** unit positions of the block boundaries, 0 … n (length m + 1) */
  boundaries: number[];
  /** W[a][b] for block boundaries a ≤ b (W[a][a] = 0); null for a > b */
  W: (number | null)[][];
  /** V[h][c] for h = 0..H and c = 0..m; null for infeasible states (−∞) */
  V: (number | null)[][];
  /** the chosen predecessor b of state (h, c); null when h = 0 or the state is infeasible */
  pred: (number | null)[][];
  /** risk of the best report with exactly h grades (index h; index 0 is null) */
  riskByG: (number | null)[];
  /** grade count of the returned report */
  chosenG: number;
  /** states visited by the backtrack, from (0, 0) to (chosenG, m) */
  path: { h: number; c: number }[];
}

export interface FixedOrderResult {
  empty: false;
  /** the package's choice among the tied optima: fewer grades, then the earlier cut */
  grade: Grade;
  /** tied optima (at most maxTies): lexicographic grade order (gradesOrder "lexicographic", the same list as
   *  exactOptimum over this order family), or for very many ties the package's order of preference ("package") */
  grades: Grade[];
  gradesOrder: "lexicographic" | "package";
  /** number of tied optima: a number up to 2^53, else a decimal string (tieCountExact: the BigInt, non-enumerable) */
  tieCount: number | string;
  readonly tieCountExact: bigint;
  /** risk of `grade` (evaluateReport) */
  risk: number;
  N: number;
  G: number;
  Ew: number;
  E: number[];
  EoverN: (number | null)[];
  evaluation: ReportEvaluation;
  /** the declared order and its blocks (from `scores` when they were given) */
  order: number[];
  blocks: number[];
  /** cut positions along the order (number of units above each cut), increasing */
  cuts: number[];
  /** the same cuts in block positions (postrank_cuts()$cuts) */
  blockCuts: number[];
  /** total block saving V of the returned report */
  saving: number;
  family: FamilyLabel;
  /** the family contains the all-withheld report (no exact count above one), so E ≤ τN holds (CONTRACT 6.4) */
  containsAllWithheld: boolean;
  tieTol: number;
  label: "optimal-within-order";
  trace?: FixedOrderTrace;
}

export interface TauPathOptions {
  w?: readonly number[];
  family?: Family;
  tieTol?: number;
  /** at most this many reports in endpointOptima; default 100 */
  maxTies?: number;
}

export interface TauInterval {
  tauFrom: number;
  tauTo: number;
  /** the optimum on this interval (the lexicographically first report at this N with the smallest Ew) */
  grade: Grade;
  N: number;
  G: number;
  Ew: number;
  /** E_k per criterion */
  E: number[];
  /** E_k/N per criterion; null when N = 0 */
  EoverN: (number | null)[];
  /** Ew/N; null when N = 0 */
  EwOverN: number | null;
  /** risk at tauFrom and at tauTo (the risk is linear in τ) */
  riskFrom: number;
  riskTo: number;
}

export interface TauPath {
  empty: false;
  /** closed intervals covering (0, 1/2], ascending; a zero-length last interval [1/2, 1/2] when a different
   *  report becomes optimal exactly at τ = 1/2 */
  intervals: TauInterval[];
  /** every report optimal at τ = 1/2 (within tieTol), lexicographic, at most maxTies */
  endpointOptima: Grade[];
  /** the number of reports optimal at τ = 1/2 */
  endpointTieCount: number;
  family: FamilyLabel;
  containsAllWithheld: boolean;
  tieTol: number;
  label: "exact-within-family";
}

export interface WeightPathOptions {
  tau: number;
  family?: Family;
  /** first-criterion weights in [0, 1]; default 0, .05, …, 1 */
  grid?: readonly number[];
  tieTol?: number;
  /** at most this many tied optima per grid weight; default 100 */
  maxTies?: number;
}

export interface WeightPathPoint {
  w1: number;
  w: [number, number];
  grade: Grade;
  grades: Grade[];
  tieCount: number;
  risk: number;
  N: number;
  G: number;
  Ew: number;
  E: number[];
  EoverN: (number | null)[];
}

export interface WeightBreakpointsOptions {
  tau: number;
  family?: Family;
  tieTol?: number;
}

export interface WeightInterval {
  /** first-criterion weights w1 (w = (w1, 1 − w1)) */
  wFrom: number;
  wTo: number;
  /** the optimum on this interval (lexicographically first among reports at the same hull point) */
  grade: Grade;
  N: number;
  G: number;
  /** E_1 and E_2 */
  E: number[];
  EoverN: (number | null)[];
  /** risk at wFrom and at wTo (the risk is linear in w1) */
  riskFrom: number;
  riskTo: number;
}

export interface WeightBreakpoints {
  empty: false;
  /** closed intervals covering [0, 1], ascending; zero-length intervals at 0 or 1 when a different report is
   *  optimal exactly at that end */
  intervals: WeightInterval[];
  /** the interior breakpoints (where the optimum changes), ascending */
  breakpoints: number[];
  /** Maximum risk of the lower envelope, and the weights attaining it (risk ties use tieTol). */
  envelopeMaximum: { risk: number; intervals: { from: number; to: number }[]; tieTol: number };
  tau: number;
  family: FamilyLabel;
  containsAllWithheld: boolean;
  tieTol: number;
  label: "exact-within-family";
}

export interface EnumerateOptions {
  /** yield the same buffer each time (no allocation); default false (a fresh Int8Array per report) */
  reuse?: boolean;
}

export interface BestReportsOptions {
  /** withholding cost, 0 < τ ≤ 1/2 */
  tau: number;
  /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
  w?: readonly number[];
  /** report family; default { kind: "all" } */
  family?: Family;
  /** how many reports to return (an integer ≥ 1); default 1 */
  k?: number;
  /** pairs [i, j], each meaning "i above j" (g_i < g_j): only reports that state all of them count */
  stating?: readonly (readonly number[])[];
  /** two risks within tieTol·(1 + |risk|) keep enumeration order; default 1e-12 */
  tieTol?: number;
}

export interface RankedReport {
  grade: Grade;
  /** evaluateReport(grade, E, { tau, w }).risk */
  risk: number;
  N: number;
  Ew: number;
}

export interface BestReports {
  family: FamilyLabel;
  /** reports of the family that state every listed pair */
  matched: number;
  /** the first k of them by risk (ties in enumeration order) */
  reports: RankedReport[];
  tieTol: number;
  label: "exact-within-family";
}

// ---------------------------------------------------------------------------------------------------------
// Internal helpers (exported for frontier.ts and multi.ts; not part of the public API in index.ts)

/** Error array prepared for enumeration: flat weighted errors and per-criterion errors (diagonal 0). */
export interface Prepared {
  n: number;
  K: number;
  M: number;
  w: number[];
  /** ebar[i * n + j] = Σ_k w_k e[k][i][j] */
  ebar: Float64Array;
  /** ek[k][i * n + j] = e[k][i][j] */
  ek: Float64Array[];
}

/** Validate E and w (through evaluateReport) and flatten the arrays. */
export function prepare(E: ErrorArray, w: readonly number[] | undefined): Prepared {
  const e0 = (E as { e?: unknown } | null | undefined)?.e;
  const first = Array.isArray(e0) ? (e0[0] as { length?: unknown } | null | undefined) : undefined;
  const n = first != null && typeof first === "object" && typeof first.length === "number" ? first.length : 0;
  // evaluateReport checks the shape, finiteness of every off-diagonal entry, and the weights
  evaluateReport(new Array<number>(Math.max(n, 0)).fill(1), E, { tau: 0.5, w });
  const K = E.e.length;
  const ww = checkWeights(w, K);
  const ek = E.e.map((m) => {
    const f = new Float64Array(n * n);
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) f[i * n + j] = m[i][j];
    return f;
  });
  const ebar = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      if (K === 1) ebar[i * n + j] = ww[0] * ek[0][i * n + j];
      else {
        const acc = new Accumulator();
        for (let k = 0; k < K; k += 1) acc.add(ww[k] * ek[k][i * n + j]);
        ebar[i * n + j] = acc.value;
      }
    }
  }
  return { n, K, M: pairCount(n), w: ww, ebar, ek };
}

/** A tolerance option: finite and ≥ 0; default 1e-12. */
export function checkTol(x: number | undefined, name: string): number {
  const v = x ?? DEFAULT_TIE_TOL;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a finite number ≥ 0`);
  return v;
}

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (x: number): string => Array.from(String(x), (d) => SUBSCRIPT[Number(d)]).join("");

/** A family label { name, words, size, budgets? } with sizeExact attached (non-enumerable). */
export function makeLabel(fields: Omit<FamilyLabel, "size" | "sizeExact">, size: bigint): FamilyLabel {
  const label = { name: fields.name, words: fields.words, size: countValue(size) } as FamilyLabel;
  if (fields.baseSize !== undefined) label.baseSize = fields.baseSize;
  if (fields.budgets !== undefined) label.budgets = fields.budgets;
  return attachExact(label, "sizeExact", size);
}

/** Name, words and exact size of a family on n units (familySize validates the family). */
export function familyInfo(n: number, family: Family): FamilyLabel {
  const size = familySizeExact(n, family);
  const grades = (x: number) => `${x} ${plural(x, "grade")}`;
  switch (family.kind) {
    case "all":
      return makeLabel({ name: `𝒜${subscript(n)}`, words: `all reports on ${n} units` }, size);
    case "atMost":
      return makeLabel({ name: `𝒜_≤${family.G}`, words: `reports with at most ${grades(family.G)}` }, size);
    case "exactly":
      return makeLabel({ name: `𝒜_=${family.G}`, words: `reports with exactly ${grades(family.G)}` }, size);
    case "order": {
      let name = "𝒜ᵨ";
      let words = "contiguous cuts of the declared order";
      if (family.exact !== undefined) {
        name += `,=${family.exact}`;
        words += ` with exactly ${grades(family.exact)}`;
      } else if (family.G !== undefined) {
        name += `,≤${family.G}`;
        words += ` with at most ${grades(family.G)}`;
      }
      if (family.blocks !== undefined && family.blocks.some((b) => b > 1)) words += ", equal order scores kept together";
      return makeLabel({ name, words }, size);
    }
    default:
      throw new RangeError("unknown family kind");
  }
}

/** Whether the family contains the all-withheld report 1/1/…/1 (it passes every budget). */
export function familyHasAllWithheld(n: number, family: Family): boolean {
  if (familySizeExact(n, family) === 0n) return false;
  switch (family.kind) {
    case "all":
    case "atMost":
      return true;
    case "exactly":
      return family.G === 1;
    case "order":
      return family.exact === undefined || family.exact === 1;
    default:
      return false;
  }
}

/** The result of an optimizing function on an empty family. */
export function emptyResult<L extends string>(family: FamilyLabel, label: L): EmptyResult<L> {
  return { empty: true, family, containsAllWithheld: false, label };
}

/** Validate pair directions once; preserve the caller's order while normalizing duplicates. */
function readStating(stating: PairConstrainedOptions["stating"], n: number): [number, number][] {
  if (stating === undefined) return [];
  if (!Array.isArray(stating)) throw new RangeError("pairConstrainedOptimum: stating must be a list of [i, j] pairs");
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (const pair of stating) {
    if (
      !Array.isArray(pair) || pair.length !== 2 ||
      !pair.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < n) || pair[0] === pair[1]
    ) {
      throw new RangeError(`pairConstrainedOptimum: each stating entry must be [i, j] with distinct unit indices in 0…${n - 1}`);
    }
    const key = `${pair[0]},${pair[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push([pair[0], pair[1]]);
    }
  }
  return pairs;
}

function pairFamilyInfo(base: FamilyLabel, size: bigint, constrained: boolean): FamilyLabel {
  return makeLabel({
    name: constrained ? `𝒜_S (${base.name})` : base.name,
    words: constrained ? `${base.words} satisfying the stated pair directions` : base.words,
    baseSize: base.size,
  }, size);
}

/** A segment [b, c) is admissible exactly when b >= minStart[c]. Counts all complete admissible reports,
 * independently of the loss or its optimal ties, using BigInt prefix sums over grade-count states. */
function orderPairConstraints(
  n: number, family: Extract<Family, { kind: "order" }>, stating: readonly [number, number][],
): { minStart: Int32Array; size: bigint } {
  const sizes = family.blocks ?? new Array<number>(n).fill(1);
  const m = sizes.length;
  const blockOf = new Int32Array(n);
  let pos = 0;
  sizes.forEach((size, block) => {
    for (let s = 0; s < size; s += 1) blockOf[family.order[pos++]] = block;
  });
  const minStart = new Int32Array(m + 1);
  for (const [above, below] of stating) {
    const a = blockOf[above];
    const b = blockOf[below];
    // The declared order and indivisible blocks cannot supply this direction.
    if (a >= b) return { minStart, size: 0n };
    minStart[b + 1] = Math.max(minStart[b + 1], a + 1);
  }
  for (let c = 1; c <= m; c += 1) minStart[c] = Math.max(minStart[c], minStart[c - 1]);
  const H = family.exact ?? Math.min(family.G ?? m, m);
  let previous = new Array<bigint>(m + 1).fill(0n);
  previous[0] = 1n;
  let size = 0n;
  for (let h = 1; h <= H; h += 1) {
    const prefix = new Array<bigint>(m + 2).fill(0n);
    for (let c = 0; c <= m; c += 1) prefix[c + 1] = prefix[c] + previous[c];
    const current = new Array<bigint>(m + 1).fill(0n);
    for (let c = h; c <= m; c += 1) current[c] = prefix[c] - prefix[minStart[c]];
    if (family.exact === undefined || family.exact === h) size += current[m];
    previous = current;
  }
  return { minStart, size };
}

/** What to use instead of enumeration for a family that does not fit (E-14; CONTRACT 6.6: the browser solver
 *  takes the unrestricted family only). */
function alternative(family: Family): string {
  switch (family.kind) {
    case "order":
      return "Use fixedOrderDP for a declared order (any n).";
    case "all":
      return "Use fixedOrderDP for a declared order, or the browser solver for the unrestricted family.";
    default:
      return "Use fixedOrderDP for a declared order with this grade count (the browser solver takes the unrestricted family only).";
  }
}

/** Throw unless the family fits the enumeration budget (n ≤ 20 units and at most 600,000 reports). */
export function checkEnumerable(n: number, info: FamilyLabel, family?: Family): void {
  const { maxReports, maxUnits } = ENUMERATION_BUDGET;
  const size = info.sizeExact;
  const reports = `${formatCount(size)} ${plural(size, "report")}`;
  const what = `${info.name} (${info.words})`;
  const next = family === undefined ? "Use fixedOrderDP for a declared order." : alternative(family);
  if (n > maxUnits) {
    throw new RangeError(
      `exact enumeration covers at most ${maxUnits} units; ${what} is on n = ${n} ${plural(n, "unit")} (${reports}). ${next}`,
    );
  }
  if (size > BigInt(maxReports)) {
    throw new RangeError(
      `exact enumeration covers at most ${formatCount(maxReports)} reports; ${what} has ${reports} on n = ${n} ${plural(n, "unit")}. ${next}`,
    );
  }
}

/** A walk over the reports of a family: after next() returns true, g holds the report, N its disclosure
 *  and sum(c) its sum over stated pairs (g_i < g_j) of channel c (an n × n flat array). */
export interface ReportStream {
  readonly g: Int8Array;
  N: number;
  next(): boolean;
  sum(c: number): number;
}

/**
 * Depth-first walk over canonical grade vectors in lexicographic order (labels 1..cap, every label up to the
 * largest used). A prefix is extended only when it can still be completed: with r positions left, the labels
 * missing below the current maximum (or below G for an exact count) must fit in r.
 */
class TreeWalker implements ReportStream {
  readonly g: Int8Array;
  N = 0;
  private readonly n: number;
  private readonly cap: number;
  private readonly exact: number;
  private readonly ch: Float64Array[];
  private readonly C: number;
  private readonly cnt: Int32Array;
  private distinct = 0;
  private readonly maxAt: Int32Array;
  private readonly Nd: Int32Array;
  private readonly Sd: Float64Array;
  private state = 0;

  constructor(n: number, cap: number, exact: number, ch: Float64Array[]) {
    this.n = n;
    this.cap = cap;
    this.exact = exact;
    this.ch = ch;
    this.C = ch.length;
    this.g = new Int8Array(n);
    this.cnt = new Int32Array(cap + 2);
    this.maxAt = new Int32Array(n + 1);
    this.Nd = new Int32Array(n + 1);
    this.Sd = new Float64Array((n + 1) * Math.max(this.C, 1));
  }

  sum(c: number): number {
    return this.Sd[this.n * this.C + c];
  }

  private uncount(v: number): void {
    this.cnt[v] -= 1;
    if (this.cnt[v] === 0) this.distinct -= 1;
  }

  next(): boolean {
    if (this.state === 2) return false;
    const { n, cap, exact, g, cnt, maxAt, Nd, Sd, C, ch } = this;
    let p: number;
    if (this.state === 0) {
      this.state = 1;
      p = 0;
      g[0] = 0;
    } else {
      p = n - 1;
      this.uncount(g[p]);
    }
    for (;;) {
      const r = n - 1 - p;
      const m = maxAt[p];
      let v = g[p] + 1;
      for (; v <= cap; v += 1) {
        const d2 = this.distinct + (cnt[v] === 0 ? 1 : 0);
        if (exact > 0 ? exact - d2 <= r : (v > m ? v : m) - d2 <= r) break;
      }
      if (v > cap) {
        g[p] = 0;
        if (p === 0) {
          this.state = 2;
          return false;
        }
        p -= 1;
        this.uncount(g[p]);
        continue;
      }
      g[p] = v;
      cnt[v] += 1;
      if (cnt[v] === 1) this.distinct += 1;
      maxAt[p + 1] = v > m ? v : m;
      // incremental evaluation: pairs (q, p) with q < p
      let N = Nd[p];
      if (C === 1) {
        const c0 = ch[0];
        let s = Sd[p];
        for (let q = 0; q < p; q += 1) {
          const gq = g[q];
          if (gq === v) continue;
          N += 1;
          s += gq < v ? c0[q * n + p] : c0[p * n + q];
        }
        Sd[p + 1] = s;
      } else {
        const base = p * C;
        const nxt = base + C;
        for (let c = 0; c < C; c += 1) Sd[nxt + c] = Sd[base + c];
        for (let q = 0; q < p; q += 1) {
          const gq = g[q];
          if (gq === v) continue;
          N += 1;
          const idx = gq < v ? q * n + p : p * n + q;
          for (let c = 0; c < C; c += 1) Sd[nxt + c] += ch[c][idx];
        }
      }
      Nd[p + 1] = N;
      if (p === n - 1) {
        this.N = N;
        return true;
      }
      p += 1;
      g[p] = 0;
    }
  }
}

/** Walk over a precomputed (small) list of reports, evaluated from scratch. */
class ListWalker implements ReportStream {
  readonly g: Int8Array;
  N = 0;
  private readonly n: number;
  private readonly list: Int8Array[];
  private readonly ch: Float64Array[];
  private readonly sums: Float64Array;
  private at = -1;

  constructor(n: number, list: Int8Array[], ch: Float64Array[]) {
    this.n = n;
    this.list = list;
    this.ch = ch;
    this.g = new Int8Array(n);
    this.sums = new Float64Array(Math.max(ch.length, 1));
  }

  sum(c: number): number {
    return this.sums[c];
  }

  next(): boolean {
    this.at += 1;
    if (this.at >= this.list.length) return false;
    const { n, g, ch, sums } = this;
    g.set(this.list[this.at]);
    let N = 0;
    sums.fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (g[i] === g[j]) continue;
        N += 1;
        const idx = g[i] < g[j] ? i * n + j : j * n + i;
        for (let c = 0; c < ch.length; c += 1) sums[c] += ch[c][idx];
      }
    }
    this.N = N;
    return true;
  }
}

function compareGrades(a: ArrayLike<number>, b: ArrayLike<number>): number {
  for (let q = 0; q < a.length; q += 1) if (a[q] !== b[q]) return a[q] - b[q];
  return 0;
}

/** Every report of a (validated, nonempty) order family, sorted lexicographically. */
function orderFamilyGrades(n: number, family: Extract<Family, { kind: "order" }>): Int8Array[] {
  const sizes = family.blocks === undefined ? new Array<number>(n).fill(1) : Array.from(family.blocks);
  const m = sizes.length;
  const lo = family.exact ?? 1;
  const hi = family.exact ?? Math.min(family.G ?? m, m);
  const out: Int8Array[] = [];
  for (let mask = 0; mask < 2 ** (m - 1); mask += 1) {
    let groups = 1;
    for (let b = 0; b < m - 1; b += 1) if ((mask >> b) & 1) groups += 1;
    if (groups < lo || groups > hi) continue;
    const g = new Int8Array(n);
    let grade = 1;
    let pos = 0;
    for (let b = 0; b < m; b += 1) {
      if (b > 0 && (mask >> (b - 1)) & 1) grade += 1;
      for (let s = 0; s < sizes[b]; s += 1) g[family.order[pos++]] = grade;
    }
    out.push(g);
  }
  return out.sort(compareGrades);
}

/** A walk over a validated, nonempty family that fits the enumeration budget. */
export function createWalker(n: number, family: Family, channels: Float64Array[]): ReportStream {
  switch (family.kind) {
    case "all":
      return new TreeWalker(n, n, 0, channels);
    case "atMost":
      return new TreeWalker(n, Math.min(family.G, n), 0, channels);
    case "exactly":
      return new TreeWalker(n, family.G, family.G, channels);
    case "order":
      return new ListWalker(n, orderFamilyGrades(n, family), channels);
    default:
      throw new RangeError("unknown family kind");
  }
}

function resolveFamily(family: Family | undefined): Family {
  return family ?? { kind: "all" };
}

/** Budgets q: null when none is active; otherwise q_k (≥ 0) or null per criterion. */
function readBudgets(q: readonly (number | null | undefined)[] | undefined | null, K: number): (number | null)[] | null {
  if (q === undefined || q === null) return null;
  if (!Array.isArray(q) || q.length !== K) throw new RangeError(`q must hold ${K} ${plural(K, "budget")} (null for none)`);
  const out = q.map((x, k) => {
    if (x === null || x === undefined) return null;
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError(`q[${k}] must be finite and ≥ 0, or null`);
    return x;
  });
  return out.some((x) => x !== null) ? out : null;
}

/**
 * The tied optima of a walk, in walk (lexicographic) order: every report whose value is within `tol` of the
 * smallest value seen. Reports are packed into one growing Int8Array, so even a family where every report ties
 * (545,835 reports of n = 8 at equal means) costs a few megabytes, never an object per report (E-3).
 */
export class TieCollector {
  /** the smallest value pushed so far */
  best = Number.POSITIVE_INFINITY;
  private readonly n: number;
  private readonly tol: number;
  private prunedAt = Number.POSITIVE_INFINITY;
  private len = 0;
  private g: Int8Array;
  private z: Float64Array;

  constructor(n: number, tol: number) {
    this.n = n;
    this.tol = tol;
    this.g = new Int8Array(16 * n);
    this.z = new Float64Array(16);
  }

  push(g: ArrayLike<number>, z: number): void {
    if (z < this.best) {
      this.best = z;
      if (z < this.prunedAt - this.tol) {
        this.compact();
        this.prunedAt = z;
      }
    }
    if (z <= this.best + this.tol) {
      if (this.len === this.z.length) {
        const zz = new Float64Array(this.z.length * 2);
        zz.set(this.z);
        this.z = zz;
        const gg = new Int8Array(this.g.length * 2);
        gg.set(this.g);
        this.g = gg;
      }
      this.z[this.len] = z;
      this.g.set(g, this.len * this.n);
      this.len += 1;
    }
  }

  private compact(): void {
    const limit = this.best + this.tol;
    let k = 0;
    for (let q = 0; q < this.len; q += 1) {
      if (this.z[q] <= limit) {
        if (k !== q) {
          this.z[k] = this.z[q];
          this.g.copyWithin(k * this.n, q * this.n, (q + 1) * this.n);
        }
        k += 1;
      }
    }
    this.len = k;
  }

  /** Visit every tied report (a view into the buffer) in walk order. */
  forEach(f: (g: Int8Array, z: number) => void): void {
    const limit = this.best + this.tol;
    for (let q = 0; q < this.len; q += 1) if (this.z[q] <= limit) f(this.g.subarray(q * this.n, (q + 1) * this.n), this.z[q]);
  }

  /** The number of tied reports. */
  count(): number {
    const limit = this.best + this.tol;
    let c = 0;
    for (let q = 0; q < this.len; q += 1) if (this.z[q] <= limit) c += 1;
    return c;
  }

  /** The first `max` tied reports as grade vectors. */
  first(max: number): Grade[] {
    const limit = this.best + this.tol;
    const out: Grade[] = [];
    for (let q = 0; q < this.len && out.length < max; q += 1) if (this.z[q] <= limit) out.push(Array.from(this.g.subarray(q * this.n, (q + 1) * this.n)));
    return out;
  }
}

/**
 * The k smallest keys of a walk with tolerant ties, in one pass (Step 7.1: bestReports, reportsAtN). The order is
 * the greedy one: repeatedly take, among the reports not yet taken, the first in walk order whose key is within
 * tol·(1 + |m|) of the smallest remaining key m. Exact ties and clear separations give the plain sort by
 * (key, walk order); a near-tie run within the tolerance keeps walk order. Only reports whose key is within the
 * tolerance of the k-th smallest key seen so far are kept (packed, as in TieCollector), so memory stays small
 * unless very many reports tie.
 */
export class KBest {
  private readonly n: number;
  private readonly k: number;
  private readonly tol: number;
  /** max-heap of the k smallest keys seen */
  private readonly heap: Float64Array;
  private heapSize = 0;
  private len = 0;
  private compactAt = 1024;
  private g: Int8Array;
  private z: Float64Array;

  constructor(n: number, k: number, tol: number) {
    this.n = n;
    this.k = k;
    this.tol = tol;
    this.heap = new Float64Array(Math.min(k, 1 << 20));
    this.g = new Int8Array(64 * n);
    this.z = new Float64Array(64);
  }

  private threshold(): number {
    if (this.heapSize < this.k) return Number.POSITIVE_INFINITY;
    const m = this.heap[0];
    return m + this.tol * (1 + Math.abs(m));
  }

  private heapPush(x: number): void {
    const h = this.heap;
    if (this.heapSize < this.k && this.heapSize < h.length) {
      let q = this.heapSize++;
      h[q] = x;
      while (q > 0) {
        const parent = (q - 1) >> 1;
        if (h[parent] >= h[q]) break;
        const t = h[parent];
        h[parent] = h[q];
        h[q] = t;
        q = parent;
      }
      return;
    }
    if (this.heapSize < this.k) {
      // k beyond the heap's capacity: no threshold is ever set (every report is kept)
      return;
    }
    if (!(x < h[0])) return;
    h[0] = x;
    let q = 0;
    const size = this.heapSize;
    for (;;) {
      const l = 2 * q + 1;
      const r = l + 1;
      let top = q;
      if (l < size && h[l] > h[top]) top = l;
      if (r < size && h[r] > h[top]) top = r;
      if (top === q) break;
      const t = h[top];
      h[top] = h[q];
      h[q] = t;
      q = top;
    }
  }

  push(g: ArrayLike<number>, key: number): void {
    this.heapPush(key);
    if (!(key <= this.threshold())) return;
    if (this.len === this.z.length) {
      this.compact();
      if (this.len === this.z.length) {
        const zz = new Float64Array(this.z.length * 2);
        zz.set(this.z);
        this.z = zz;
        const gg = new Int8Array(this.g.length * 2);
        gg.set(this.g);
        this.g = gg;
      }
    }
    this.z[this.len] = key;
    this.g.set(g, this.len * this.n);
    this.len += 1;
    if (this.len >= this.compactAt) {
      this.compact();
      this.compactAt = Math.max(1024, 2 * this.len);
    }
  }

  private compact(): void {
    const limit = this.threshold();
    let k = 0;
    for (let q = 0; q < this.len; q += 1) {
      if (this.z[q] <= limit) {
        if (k !== q) {
          this.z[k] = this.z[q];
          this.g.copyWithin(k * this.n, q * this.n, (q + 1) * this.n);
        }
        k += 1;
      }
    }
    this.len = k;
  }

  /** The first k reports in the greedy tolerant order: { grade, key }. */
  result(): { grade: Grade; key: number }[] {
    this.compact();
    const B = this.len;
    const z = this.z;
    const sorted = Array.from({ length: B }, (_, q) => q).sort((a, b) => z[a] - z[b] || a - b);
    const taken = new Uint8Array(B);
    // min-heap of walk positions inside the tolerance window
    const win: number[] = [];
    const winPush = (x: number): void => {
      let q = win.length;
      win.push(x);
      while (q > 0) {
        const parent = (q - 1) >> 1;
        if (win[parent] <= win[q]) break;
        [win[parent], win[q]] = [win[q], win[parent]];
        q = parent;
      }
    };
    const winPop = (): number => {
      const top = win[0];
      const last = win.pop() as number;
      if (win.length > 0) {
        win[0] = last;
        let q = 0;
        for (;;) {
          const l = 2 * q + 1;
          const r = l + 1;
          let m = q;
          if (l < win.length && win[l] < win[m]) m = l;
          if (r < win.length && win[r] < win[m]) m = r;
          if (m === q) break;
          [win[m], win[q]] = [win[q], win[m]];
          q = m;
        }
      }
      return top;
    };
    const out: { grade: Grade; key: number }[] = [];
    let lo = 0;
    let hi = 0;
    while (out.length < this.k && out.length < B) {
      while (taken[sorted[lo]]) lo += 1;
      const m = z[sorted[lo]];
      const limit = m + this.tol * (1 + Math.abs(m));
      while (hi < B && z[sorted[hi]] <= limit) winPush(sorted[hi++]);
      const q = winPop();
      taken[q] = 1;
      out.push({ grade: Array.from(this.g.subarray(q * this.n, (q + 1) * this.n)), key: z[q] });
    }
    return out;
  }
}

/** k: an integer ≥ 1; default 1. */
export function checkK(x: number | undefined, fn: string): number {
  const v = x ?? 1;
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 1) throw new RangeError(`${fn}: k must be an integer ≥ 1, got ${String(v)}`);
  return v;
}

/** Cut positions along an order (units above each cut) of a grade vector that is contiguous along it. */
function cutsAlong(g: ArrayLike<number>, order: readonly number[]): number[] {
  const cuts: number[] = [];
  for (let p = 1; p < order.length; p += 1) if (g[order[p]] !== g[order[p - 1]]) cuts.push(p);
  return cuts;
}

/** The package's preference among reports of one order: fewer grades, then the lexicographically earlier cuts. */
function packageLess(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return a.length < b.length;
  for (let q = 0; q < a.length; q += 1) if (a[q] !== b[q]) return a[q] < b[q];
  return false;
}

/** Per-N summary of a family: smallest and largest Ew, count, and the lexicographically first report at the
 *  smallest (largest) Ew within tieTol·M. */
export interface CloudRow {
  N: number;
  minEw: number;
  maxEw: number;
  count: number;
  minGrade: Grade;
  maxGrade: Grade;
}

export interface CloudPoint {
  grade: Grade;
  N: number;
  Ew: number;
}

/**
 * One pass over an enumerable family: per-N rows (ascending N) and, if asked, every point; `half` also collects
 * the reports optimal at τ = 1/2 (value Ew − N/2). minGrade (maxGrade) is the lexicographically first report
 * with Ew within tieTol·M of the final minimum (maximum) at its N: when a run of near-ties moves the minimum so
 * that the stored report falls out of the band, that N is settled exactly by a second pass (E-19).
 */
export function scanCloud(P: Prepared, family: Family, tieTol: number, withPoints: boolean, half?: TieCollector): { rows: CloudRow[]; points: CloudPoint[] | null } {
  const { n, M } = P;
  const tolZ = tieTol * M;
  const minEw = new Float64Array(M + 1).fill(Number.POSITIVE_INFINITY);
  const maxEw = new Float64Array(M + 1).fill(Number.NEGATIVE_INFINITY);
  const minGE = new Float64Array(M + 1);
  const maxGE = new Float64Array(M + 1);
  const count = new Int32Array(M + 1);
  const minG = new Int8Array((M + 1) * n);
  const maxG = new Int8Array((M + 1) * n);
  const redoMin = new Uint8Array(M + 1);
  const redoMax = new Uint8Array(M + 1);
  let redo = false;
  const points: CloudPoint[] | null = withPoints ? [] : null;
  const walker = createWalker(n, family, [P.ebar]);
  while (walker.next()) {
    const N = walker.N;
    const Ew = walker.sum(0);
    count[N] += 1;
    if (count[N] === 1) {
      minEw[N] = Ew;
      maxEw[N] = Ew;
      minGE[N] = Ew;
      maxGE[N] = Ew;
      minG.set(walker.g, N * n);
      maxG.set(walker.g, N * n);
    } else {
      const lo = minEw[N];
      if (Ew < lo) {
        minEw[N] = Ew;
        if (Ew < lo - tolZ || minGE[N] > Ew + tolZ) {
          // no earlier report lies in the new band, or the stored one fell out of it
          if (!(Ew < lo - tolZ)) {
            redoMin[N] = 1;
            redo = true;
          }
          minGE[N] = Ew;
          minG.set(walker.g, N * n);
        }
      }
      const hi = maxEw[N];
      if (Ew > hi) {
        maxEw[N] = Ew;
        if (Ew > hi + tolZ || maxGE[N] < Ew - tolZ) {
          if (!(Ew > hi + tolZ)) {
            redoMax[N] = 1;
            redo = true;
          }
          maxGE[N] = Ew;
          maxG.set(walker.g, N * n);
        }
      }
    }
    if (points) points.push({ grade: Array.from(walker.g), N, Ew });
    if (half) half.push(walker.g, Ew - 0.5 * N);
  }
  if (redo) {
    const doneMin = new Uint8Array(M + 1);
    const doneMax = new Uint8Array(M + 1);
    const again = createWalker(n, family, [P.ebar]);
    while (again.next()) {
      const N = again.N;
      const Ew = again.sum(0);
      if (redoMin[N] && !doneMin[N] && Ew <= minEw[N] + tolZ) {
        minG.set(again.g, N * n);
        doneMin[N] = 1;
      }
      if (redoMax[N] && !doneMax[N] && Ew >= maxEw[N] - tolZ) {
        maxG.set(again.g, N * n);
        doneMax[N] = 1;
      }
    }
  }
  const rows: CloudRow[] = [];
  for (let N = 0; N <= M; N += 1) {
    if (count[N] === 0) continue;
    rows.push({
      N,
      minEw: minEw[N],
      maxEw: maxEw[N],
      count: count[N],
      minGrade: Array.from(minG.subarray(N * n, N * n + n)),
      maxGrade: Array.from(maxG.subarray(N * n, N * n + n)),
    });
  }
  return { rows, points };
}

/**
 * Indices of the vertices of the lower convex hull of points (x[i], y[i]) with increasing x (monotone chain).
 * A point that lies on or above the chord of its neighbours, or below it by at most `tol` (in y units), is not
 * a vertex. Default tol: 1e-12·max(1, |y|) of the chord's ends.
 */
export function lowerHullIndices(x: ArrayLike<number>, y: ArrayLike<number>, tol?: number): number[] {
  const stack: number[] = [];
  for (let c = 0; c < x.length; c += 1) {
    while (stack.length >= 2) {
      const a = stack[stack.length - 2];
      const b = stack[stack.length - 1];
      const cross = (x[b] - x[a]) * (y[c] - y[a]) - (y[b] - y[a]) * (x[c] - x[a]);
      const below = cross / (x[c] - x[a]); // how far b lies below the chord from a to c
      const t = tol ?? 1e-12 * Math.max(1, Math.abs(y[a]), Math.abs(y[c]));
      if (below > t) break;
      stack.pop();
    }
    stack.push(c);
  }
  return stack;
}

function lexLessExtended(prefix: Int32Array, last: number, other: Int32Array): boolean {
  for (let q = 0; q < prefix.length; q += 1) if (prefix[q] !== other[q]) return prefix[q] < other[q];
  return last < other[prefix.length];
}

const ORDER_KEYS = ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids"] as const;

/**
 * The declared-order family of fixedOrderDP and orderHull (E-2, E-8): top-level `order` (with G, exact,
 * blocks), or `scores` (+ direction, ids; ids default E.ids) in place of order and blocks, or `family` — either
 * { kind: "order", order, G?, exact?, blocks? } or a grade-count family ({ kind: "atMost", G },
 * { kind: "exactly", G } or { kind: "all" }) together with a top-level order or scores. Anything given twice throws.
 */
export function resolveOrderFamily(n: number, o: OrderInputs, E: ErrorArray, fn: string): Extract<Family, { kind: "order" }> {
  let order = o.order;
  let blocks = o.blocks;
  if (o.scores !== undefined) {
    if (order !== undefined || blocks !== undefined) throw new RangeError(`${fn}: give scores, or order with blocks, not both`);
    if ((o.scores as { length?: unknown } | null)?.length !== n) throw new RangeError(`${fn}: scores must have one value per unit (${n})`);
    const ids = o.ids ?? (Array.isArray(E?.ids) && E.ids.length === n ? E.ids : undefined);
    const so = scoreOrder(o.scores, { direction: o.direction, ids });
    order = so.order;
    blocks = so.blocks;
  } else if (o.direction !== undefined || o.ids !== undefined) {
    throw new RangeError(`${fn}: direction and ids apply only together with scores`);
  }
  let G = o.G;
  let exact = o.exact;
  const f = o.family;
  if (f !== undefined) {
    if (f === null || typeof f !== "object") throw new RangeError(`${fn}: family must be a family object`);
    switch (f.kind) {
      case "order":
        checkKeys(f, ["kind", "order", "G", "exact", "blocks"], `${fn}: family { kind: "order" }`);
        if (order !== undefined) throw new RangeError(`${fn}: the order is given twice (family.order, and order or scores)`);
        if (G !== undefined || exact !== undefined || blocks !== undefined) {
          throw new RangeError(`${fn}: give G, exact and blocks inside family { kind: "order" } or at the top level, not both`);
        }
        order = f.order;
        G = f.G;
        exact = f.exact;
        blocks = f.blocks;
        break;
      case "atMost":
      case "exactly":
        checkKeys(f, ["kind", "G"], `${fn}: family { kind: "${f.kind}" }`);
        if (G !== undefined || exact !== undefined) throw new RangeError(`${fn}: the grade count is given twice (family and G or exact)`);
        if (f.kind === "atMost") G = f.G;
        else exact = f.G;
        break;
      case "all":
        checkKeys(f, ["kind"], `${fn}: family { kind: "all" }`);
        break;
      default:
        throw new RangeError(`${fn}: unknown family kind ${String((f as { kind?: unknown }).kind)}`);
    }
  }
  if (order === undefined) throw new RangeError(`${fn} needs a declared order: order, scores, or family { kind: "order", order }`);
  return {
    kind: "order",
    order,
    ...(G !== undefined ? { G } : {}),
    ...(exact !== undefined ? { exact } : {}),
    ...(blocks !== undefined ? { blocks } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/**
 * Every report of a family on n units as canonical grade vectors (labels 1..G, grade 1 highest) in
 * lexicographic order. A generator over Int8Array: nothing is materialized. With `reuse: true` the same buffer
 * is yielded each time (copy it to keep it). Families above the enumeration budget (n > 20 or more than
 * 600,000 reports) are refused when the generator is created; an empty family yields nothing.
 */
export function enumerateReports(n: number, family: Family = { kind: "all" }, options: EnumerateOptions = {}): Generator<Int8Array, void, undefined> {
  const o = readOptions<EnumerateOptions>(options, ["reuse"], "enumerateReports");
  const info = familyInfo(n, family);
  if (info.sizeExact !== 0n) checkEnumerable(n, info, family);
  const reuse = o.reuse === true;
  function* run(): Generator<Int8Array, void, undefined> {
    if (info.sizeExact === 0n) return;
    const walker = createWalker(n, family, []);
    while (walker.next()) yield reuse ? walker.g : walker.g.slice();
  }
  return run();
}

/**
 * Exact optimum by exhaustive enumeration of a family (label "exact-within-family"): every report whose risk
 * is within `tieTol` (risk scale, default 1e-12) of the minimum, in lexicographic order (`grades`, at most
 * `maxTies`, default 100; `tieCount` counts them all). `grade` is the first of them, except for an order family,
 * where it is the package's choice (fewer grades, then the earlier cut), as fixedOrderDP. With budgets `q` the
 * family is restricted to E_k ≤ q_k N (N = 0 passes). An empty family returns `{ empty: true, family }`.
 * Refuses families above the enumeration budget (n ≤ 20 units, at most 600,000 reports).
 */
export function exactOptimum(E: ErrorArray, options: OptimumOptions): ExactOptimum | EmptyOptimum {
  const o = readOptions<OptimumOptions>(options, ["tau", "w", "family", "q", "tieTol", "maxTies"], "exactOptimum", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "exactOptimum");
  const base = familyInfo(n, family);
  const budgets = readBudgets(o.q, P.K);
  const label = (size: number): FamilyLabel =>
    budgets === null
      ? base
      : makeLabel(
          {
            name: `𝒜_q (${base.name})`,
            words: `${base.words} that meet the error budgets E_k ≤ q_k N`,
            baseSize: base.size,
            budgets: [...budgets],
          },
          BigInt(size),
        );
  const empty = (): EmptyOptimum => emptyResult(label(0), "exact-within-family");
  if (base.sizeExact === 0n) return empty();
  checkEnumerable(n, base, family);
  const active: number[] = [];
  if (budgets) budgets.forEach((x, k) => x !== null && active.push(k));
  const walker = createWalker(n, family, [P.ebar, ...active.map((k) => P.ek[k])]);
  const ties = new TieCollector(n, tieTol * M);
  let feasible = 0;
  while (walker.next()) {
    const N = walker.N;
    if (active.length > 0) {
      let ok = true;
      for (let a = 0; a < active.length; a += 1) {
        if (walker.sum(a + 1) > (budgets as number[])[active[a]] * N + BUDGET_TOL) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    feasible += 1;
    ties.push(walker.g, walker.sum(0) - tau * N);
  }
  if (feasible === 0) return empty();
  const grades = ties.first(maxTies);
  let grade = grades[0];
  if (family.kind === "order") {
    // the package's choice among the tied reports of one order (E-1)
    let bestCuts: number[] | null = null;
    ties.forEach((g) => {
      const cuts = cutsAlong(g, family.order);
      if (bestCuts === null || packageLess(cuts, bestCuts)) {
        bestCuts = cuts;
        grade = Array.from(g);
      }
    });
  }
  const evaluation = evaluateReport(grade, E, { tau, w: P.w });
  return {
    empty: false,
    grade,
    grades,
    tieCount: ties.count(),
    risk: evaluation.risk,
    N: evaluation.N,
    G: evaluation.G,
    Ew: evaluation.Ew,
    E: evaluation.E,
    EoverN: evaluation.EoverN,
    evaluation,
    family: label(feasible),
    containsAllWithheld: familyHasAllWithheld(n, family),
    tieTol,
    label: "exact-within-family",
  };
}

/**
 * The exact optimum among reports stating every required direction. Non-order families keep the ordinary
 * enumeration budget and every minimizing tie; order families use the fixed-order DP with forbidden grade
 * segments, so no reports are enumerated. The feasible family count is independent of the optimal tie count.
 */
export function pairConstrainedOptimum(E: ErrorArray, options: PairConstrainedOptions): PairConstrainedOptimum {
  const o = readOptions<PairConstrainedOptions>(options, ["tau", "w", "family", "stating", "tieTol", "maxTies"], "pairConstrainedOptimum", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "pairConstrainedOptimum");
  const stating = readStating(o.stating, n);
  const baseFamily = familyInfo(n, family);
  const finish = (result: ExactOptimum | EmptyOptimum | FixedOrderResult | EmptyResult<"optimal-within-order">): PairConstrainedOptimum =>
    Object.assign(result, {
      family: pairFamilyInfo(baseFamily, result.family.sizeExact, stating.length > 0),
      baseFamily,
      stating,
    });
  if (family.kind === "order") return finish(fixedOrderCore(E, P, tau, family, tieTol, maxTies, false, stating));
  // Delegate the unconstrained case to the existing producer, preserving its exact numerical conventions.
  if (stating.length === 0) return finish(exactOptimum(E, { tau, w: P.w, family, tieTol, maxTies }));
  const empty = () => finish(emptyResult(pairFamilyInfo(baseFamily, 0n, true), "exact-within-family"));
  if (baseFamily.sizeExact === 0n) return empty();
  checkEnumerable(n, baseFamily, family);
  const walker = createWalker(n, family, [P.ebar]);
  const ties = new TieCollector(n, tieTol * M);
  let feasible = 0n;
  while (walker.next()) {
    if (!stating.every(([above, below]) => walker.g[above] < walker.g[below])) continue;
    feasible += 1n;
    ties.push(walker.g, walker.sum(0) - tau * walker.N);
  }
  if (feasible === 0n) return empty();
  const grades = ties.first(maxTies);
  const grade = grades[0];
  const evaluation = evaluateReport(grade, E, { tau, w: P.w });
  return finish({
    empty: false,
    grade,
    grades,
    tieCount: ties.count(),
    risk: evaluation.risk,
    N: evaluation.N,
    G: evaluation.G,
    Ew: evaluation.Ew,
    E: evaluation.E,
    EoverN: evaluation.EoverN,
    evaluation,
    family: pairFamilyInfo(baseFamily, feasible, true),
    containsAllWithheld: false,
    tieTol,
    label: "exact-within-family",
  });
}

/**
 * Optimal contiguous cuts of a declared order (label "optimal-within-order"; theory book ch. 14 interval-saving
 * DP) under at most `G` grades or exactly `exact` grades, with the package's tie rules (postrank_cuts(rule =
 * "optimal")): `blocks` of equal order scores are never split, equal objective → fewer grades, then the
 * lexicographically earlier cut vector. The order comes from `order`, `scores` (scoreOrder) or `family`
 * (resolveOrderFamily). `grades` lists the tied optima (at most maxTies) and `tieCount` counts them; the risk is
 * evaluateReport() of the returned grade. An empty family returns `{ empty: true, family }`.
 */
export function fixedOrderDP(E: ErrorArray, options: FixedOrderOptions): FixedOrderResult | EmptyResult<"optimal-within-order"> {
  const o = readOptions<FixedOrderOptions>(options, [...ORDER_KEYS, "tau", "w", "trace", "tieTol", "maxTies"], "fixedOrderDP", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "fixedOrderDP");
  const family = resolveOrderFamily(P.n, o, E, "fixedOrderDP");
  return fixedOrderCore(E, P, tau, family, tieTol, maxTies, o.trace === true);
}

/** Shared DP, including the package representative and the existing bounded full-tie bookkeeping. */
function fixedOrderCore(
  E: ErrorArray, P: Prepared, tau: number, family: Extract<Family, { kind: "order" }>,
  tieTol: number, maxTies: number, trace: boolean, stating: readonly [number, number][] = [],
): FixedOrderResult | EmptyResult<"optimal-within-order"> {
  const { n, M, ebar } = P;
  const base = familyInfo(n, family); // validates order, blocks, G and exact
  const constraints = stating.length > 0 && base.sizeExact > 0n ? orderPairConstraints(n, family, stating) : null;
  const info = stating.length > 0 ? pairFamilyInfo(base, constraints?.size ?? 0n, true) : base;
  if (info.sizeExact === 0n) return emptyResult(info, "optimal-within-order");
  const order = Array.from(family.order);
  const sizes = family.blocks === undefined ? new Array<number>(n).fill(1) : Array.from(family.blocks);
  const m = sizes.length;
  const bounds = [0];
  for (const s of sizes) bounds.push(bounds[bounds.length - 1] + s);

  // W(a, b) for unit positions 0 ≤ a ≤ b ≤ n: W(a, b) = W(a, b − 1) + Σ_{a<s<b} η_sb (no subtraction)
  const n1 = n + 1;
  const W = new Float64Array(n1 * n1);
  for (let b = 1; b <= n; b += 1) {
    const ub = order[b - 1];
    let running = 0;
    for (let a = b - 1; a >= 0; a -= 1) {
      W[a * n1 + b] = W[a * n1 + b - 1] + running;
      if (a >= 1) running += ebar[order[a - 1] * n + ub] - tau;
    }
  }
  const T = W[n];
  const Wb = (a: number, b: number) => W[bounds[a] * n1 + bounds[b]];

  const exact = family.exact;
  const H = exact ?? Math.min(family.G ?? m, m);
  const tolV = tieTol * M;
  const V = Array.from({ length: H + 1 }, () => new Float64Array(m + 1).fill(Number.NEGATIVE_INFINITY));
  const pred = Array.from({ length: H + 1 }, () => new Int32Array(m + 1).fill(-1));
  const paths: (Int32Array | null)[][] = Array.from({ length: H + 1 }, () => new Array<Int32Array | null>(m + 1).fill(null));
  V[0][0] = 0;
  paths[0][0] = new Int32Array(0);
  for (let h = 1; h <= H; h += 1) {
    for (let c = h; c <= m; c += 1) {
      let best = Number.NEGATIVE_INFINITY;
      let bestB = -1;
      for (let b = h - 1; b < c; b += 1) {
        if (constraints !== null && b < constraints.minStart[c]) continue;
        const prev = V[h - 1][b];
        if (prev === Number.NEGATIVE_INFINITY) continue;
        const cand = prev + Wb(b, c);
        let take = bestB < 0 || cand > best + tolV;
        if (!take && h >= 2 && cand >= best - tolV) {
          take = lexLessExtended(paths[h - 1][b] as Int32Array, b, paths[h][c] as Int32Array);
        }
        if (take) {
          best = cand;
          bestB = b;
          if (h >= 2) {
            const pp = paths[h - 1][b] as Int32Array;
            const path = new Int32Array(h - 1);
            path.set(pp);
            path[h - 2] = b;
            paths[h][c] = path;
          } else paths[h][c] = new Int32Array(0);
        }
      }
      V[h][c] = best;
      pred[h][c] = bestB;
    }
  }
  let hStar: number;
  let maxV = Number.NEGATIVE_INFINITY;
  const terminals: number[] = [];
  if (exact !== undefined) {
    hStar = exact;
    terminals.push(exact);
  } else {
    for (let h = 1; h <= H; h += 1) if (V[h][m] > maxV) maxV = V[h][m];
    for (let h = 1; h <= H; h += 1) if (V[h][m] >= maxV - tolV) terminals.push(h);
    hStar = terminals[0]; // fewer grades on equal objective
  }
  const blockCuts = Array.from(paths[hStar][m] as Int32Array);
  const cuts = blockCuts.map((b) => bounds[b]);
  const gradeOfBlockCuts = (bc: ArrayLike<number>): Grade => {
    const grade = new Array<number>(n);
    let r = 0;
    for (let b = 0; b < m; b += 1) {
      if (r < bc.length && bc[r] === b) r += 1;
      for (let pos = bounds[b]; pos < bounds[b + 1]; pos += 1) grade[order[pos]] = r + 1;
    }
    return grade;
  };
  const grade = gradeOfBlockCuts(blockCuts);

  // the tied optima: cut sets reached through tied choices at every DP state (E-1)
  const tied = (h: number, b: number, c: number) => {
    if (constraints !== null && b < constraints.minStart[c]) return false;
    const prev = V[h - 1][b];
    return prev !== Number.NEGATIVE_INFINITY && prev + Wb(b, c) >= V[h][c] - tolV;
  };
  const countPaths = (): bigint => {
    // forward counts f[h][c] of tied paths from (0, 0); doubles first, BigInt when a count passes 2^53
    let f = Array.from({ length: H + 1 }, () => new Float64Array(m + 1));
    f[0][0] = 1;
    let big = false;
    for (let h = 1; h <= H && !big; h += 1) {
      for (let c = h; c <= m; c += 1) {
        if (V[h][c] === Number.NEGATIVE_INFINITY) continue;
        let s = 0;
        for (let b = h - 1; b < c; b += 1) if (f[h - 1][b] > 0 && tied(h, b, c)) s += f[h - 1][b];
        f[h][c] = s;
        if (s > 2 ** 52) big = true;
      }
    }
    if (!big) return terminals.reduce((acc, h) => acc + BigInt(f[h][m]), 0n);
    f = [];
    const F = Array.from({ length: H + 1 }, () => new Array<bigint>(m + 1).fill(0n));
    F[0][0] = 1n;
    for (let h = 1; h <= H; h += 1) {
      for (let c = h; c <= m; c += 1) {
        if (V[h][c] === Number.NEGATIVE_INFINITY) continue;
        let s = 0n;
        for (let b = h - 1; b < c; b += 1) if (F[h - 1][b] > 0n && tied(h, b, c)) s += F[h - 1][b];
        F[h][c] = s;
      }
    }
    return terminals.reduce((acc, h) => acc + F[h][m], 0n);
  };
  const tieCountExact = countPaths();
  // visit the tied cut sets: terminals by fewer grades, then cut vectors in lexicographic order (the package's
  // order of preference), restricted to the states that lie on a tied path to the terminal
  const walkTied = (visit: (bc: Int32Array) => boolean): void => {
    for (const h of terminals) {
      const reach = Array.from({ length: h + 1 }, () => new Uint8Array(m + 1));
      reach[h][m] = 1;
      for (let k = h; k >= 1; k -= 1) {
        for (let c = k; c <= m; c += 1) {
          if (!reach[k][c]) continue;
          for (let b = k - 1; b < c; b += 1) if (tied(k, b, c)) reach[k - 1][b] = 1;
        }
      }
      const cut = new Int32Array(Math.max(h - 1, 0));
      let stop = false;
      const dfs = (k: number, c: number): void => {
        if (k === h) {
          if (!visit(cut)) stop = true;
          return;
        }
        const last = k + 1 === h;
        for (let c2 = last ? m : c + 1; c2 <= m && !stop; c2 += 1) {
          if (!reach[k + 1][c2] || !tied(k + 1, c, c2)) continue;
          if (!last) cut[k] = c2;
          dfs(k + 1, c2);
        }
      };
      dfs(0, 0);
      if (stop) return;
    }
  };
  let grades: Grade[] = [];
  let gradesOrder: "lexicographic" | "package";
  if (tieCountExact * BigInt(n) <= DP_TIE_LIST_WORK) {
    // every tied cut set, keeping the lexicographically smallest maxTies grade vectors (the exactOptimum list)
    walkTied((bc) => {
      const g = gradeOfBlockCuts(bc);
      if (grades.length >= maxTies && compareGrades(g, grades[grades.length - 1]) >= 0) return true;
      let lo = 0;
      let hi = grades.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (compareGrades(grades[mid], g) < 0) lo = mid + 1;
        else hi = mid;
      }
      grades.splice(lo, 0, g);
      if (grades.length > maxTies) grades.pop();
      return true;
    });
    gradesOrder = "lexicographic";
  } else {
    // too many to visit: the first ones in the package's order (at most 2·10⁶/n even with maxTies: Infinity)
    const limit = Math.min(maxTies, Math.max(1, Math.floor(2e6 / n)));
    walkTied((bc) => {
      grades.push(gradeOfBlockCuts(bc));
      return grades.length < limit;
    });
    // the DP's own choice leads (it is the first in this order in exact arithmetic; rounding can reorder ties)
    const at = grades.findIndex((g) => compareGrades(g, grade) === 0);
    if (at !== 0) {
      if (at > 0) grades.splice(at, 1);
      grades.unshift(grade);
      if (grades.length > limit) grades.pop();
    }
    gradesOrder = "package";
  }
  const evaluation = evaluateReport(grade, E, { tau, w: P.w });
  const result = {
    empty: false,
    grade,
    grades,
    gradesOrder,
    tieCount: countValue(tieCountExact),
    risk: evaluation.risk,
    N: evaluation.N,
    G: evaluation.G,
    Ew: evaluation.Ew,
    E: evaluation.E,
    EoverN: evaluation.EoverN,
    evaluation,
    order,
    blocks: sizes,
    cuts,
    blockCuts,
    saving: V[hStar][m],
    family: info,
    containsAllWithheld: stating.length === 0 && familyHasAllWithheld(n, family),
    tieTol,
    label: "optimal-within-order",
  } as FixedOrderResult;
  attachExact(result, "tieCountExact", tieCountExact);
  if (trace) {
    const fin = (x: number) => (x === Number.NEGATIVE_INFINITY ? null : x);
    const path: { h: number; c: number }[] = [];
    let c = m;
    for (let h = hStar; h >= 1; h -= 1) {
      path.push({ h, c });
      c = pred[h][c];
    }
    path.push({ h: 0, c: 0 });
    path.reverse();
    result.trace = {
      M,
      T,
      blocks: sizes,
      boundaries: bounds,
      W: Array.from({ length: m + 1 }, (_, a) => Array.from({ length: m + 1 }, (_, b) => (a <= b ? Wb(a, b) : null))),
      V: V.map((row) => Array.from(row, fin)),
      pred: pred.map((row, h) => Array.from(row, (b, cc) => (h === 0 || V[h][cc] === Number.NEGATIVE_INFINITY ? null : b))),
      riskByG: Array.from({ length: H + 1 }, (_, h) => (h === 0 || V[h][m] === Number.NEGATIVE_INFINITY ? null : tau + (T - V[h][m]) / M)),
      chosenG: hStar,
      path,
    };
  }
  return result;
}

/**
 * The optimum of an enumerable family as τ moves over (0, 1/2]: each report's risk is linear in τ, so the
 * optimum follows the lower convex hull of (N, min Ew), and the breakpoints are its edge slopes (exact up to
 * floating point). Intervals are closed and share their endpoints (both reports are optimal at a breakpoint);
 * the first starts at 0 (open) and the last ends at 1/2. A report that becomes optimal exactly at τ = 1/2 gets a
 * zero-length interval [1/2, 1/2] (E-17), and `endpointOptima` lists every report optimal at τ = 1/2. Along the
 * path N never decreases. An empty family returns `{ empty: true, family }`.
 */
export function tauPath(E: ErrorArray, options: TauPathOptions = {}): TauPath | EmptyOptimum {
  const o = readOptions<TauPathOptions>(options, ["w", "family", "tieTol", "maxTies"], "tauPath");
  const P = prepare(E, o.w);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "tauPath");
  const info = familyInfo(n, family);
  if (info.sizeExact === 0n) return emptyResult(info, "exact-within-family");
  checkEnumerable(n, info, family);
  const tolZ = tieTol * M;
  const half = new TieCollector(n, tolZ);
  const { rows } = scanCloud(P, family, tieTol, false, half);
  const idx = lowerHullIndices(
    rows.map((r) => r.N),
    rows.map((r) => r.minEw),
    tolZ,
  );
  const verts = idx.map((i) => {
    const grade = rows[i].minGrade;
    return { grade, ev: evaluateReport(grade, E, { tau: 0.5, w: P.w }) };
  });
  const slope = (i: number) => (verts[i].ev.Ew - verts[i - 1].ev.Ew) / (verts[i].ev.N - verts[i - 1].ev.N);
  const interval = (i: number, from: number, to: number): TauInterval => {
    const { grade, ev } = verts[i];
    return {
      tauFrom: from,
      tauTo: to,
      grade,
      N: ev.N,
      G: ev.G,
      Ew: ev.Ew,
      E: ev.E,
      EoverN: ev.EoverN,
      EwOverN: ev.N === 0 ? null : ev.Ew / ev.N,
      riskFrom: (ev.Ew + from * (M - ev.N)) / M,
      riskTo: (ev.Ew + to * (M - ev.N)) / M,
    };
  };
  const zHalf = verts.map((v) => v.ev.Ew - 0.5 * v.ev.N);
  const zMin = Math.min(...zHalf);
  const intervals: TauInterval[] = [];
  let last = -1;
  for (let i = 0; i < verts.length; i += 1) {
    const from = i === 0 ? 0 : Math.max(0, slope(i));
    const to = i === verts.length - 1 ? 0.5 : Math.min(0.5, slope(i + 1));
    if (from < to) {
      intervals.push(interval(i, from, to));
      last = i;
    }
  }
  // vertices past the last interval that are optimal at τ = 1/2 (their edge slope is 1/2 within tieTol)
  for (let i = last + 1; i < verts.length; i += 1) if (zHalf[i] <= zMin + tolZ) intervals.push(interval(i, 0.5, 0.5));
  return {
    empty: false,
    intervals,
    endpointOptima: half.first(maxTies),
    endpointTieCount: half.count(),
    family: info,
    containsAllWithheld: familyHasAllWithheld(n, family),
    tieTol,
    label: "exact-within-family",
  };
}

/** One enumeration of a K = 2 family storing E_1, E_2, N and the grade of every report. */
function storeTwoCriteria(P: Prepared, family: Family, count: number) {
  const { n } = P;
  const E1 = new Float64Array(count);
  const E2 = new Float64Array(count);
  const Ns = new Int32Array(count);
  const G8 = new Int8Array(count * n);
  const walker = createWalker(n, family, [P.ek[0], P.ek[1]]);
  let r = 0;
  while (walker.next()) {
    E1[r] = walker.sum(0);
    E2[r] = walker.sum(1);
    Ns[r] = walker.N;
    G8.set(walker.g, r * n);
    r += 1;
  }
  return { E1, E2, Ns, G8, r };
}

/**
 * The exact optimum at each first-criterion weight w1 of `grid` (K = 2, w = (w1, 1 − w1)), over one
 * enumerable family at a fixed τ: one enumeration, then each grid point in a single pass. Ties within tieTol
 * (risk scale) are listed in lexicographic order (at most maxTies, with tieCount), as in exactOptimum. An empty
 * family returns `{ empty: true, family }`.
 */
export function weightPath(E: ErrorArray, options: WeightPathOptions): WeightPathPoint[] | EmptyOptimum {
  const o = readOptions<WeightPathOptions>(options, ["tau", "family", "grid", "tieTol", "maxTies"], "weightPath", true);
  const tau = checkTau(o.tau);
  const K = Array.isArray(E?.e) ? E.e.length : 0;
  if (K !== 2) throw new RangeError("weightPath needs two criteria (K = 2)");
  const P = prepare(E, [0.5, 0.5]);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "weightPath");
  const grid = o.grid === undefined ? Array.from({ length: 21 }, (_, q) => q / 20) : Array.from(o.grid);
  if (grid.length < 1 || !grid.every((x) => typeof x === "number" && x >= 0 && x <= 1)) {
    throw new RangeError("grid must hold first-criterion weights in [0, 1]");
  }
  const info = familyInfo(n, family);
  if (info.sizeExact === 0n) return emptyResult(info, "exact-within-family");
  checkEnumerable(n, info, family);
  const { E1, E2, Ns, G8, r } = storeTwoCriteria(P, family, Number(info.sizeExact));
  const tolZ = tieTol * M;
  return grid.map((w1) => {
    const w2 = 1 - w1;
    let best = Number.POSITIVE_INFINITY;
    for (let q = 0; q < r; q += 1) {
      const z = w1 * E1[q] + w2 * E2[q] - tau * Ns[q];
      if (z < best) best = z;
    }
    const grades: Grade[] = [];
    let tieCount = 0;
    for (let q = 0; q < r; q += 1) {
      const z = w1 * E1[q] + w2 * E2[q] - tau * Ns[q];
      if (z <= best + tolZ) {
        tieCount += 1;
        if (grades.length < maxTies) grades.push(Array.from(G8.subarray(q * n, q * n + n)));
      }
    }
    const ev = evaluateReport(grades[0], E, { tau, w: [w1, w2] });
    return { w1, w: [w1, w2] as [number, number], grade: grades[0], grades, tieCount, risk: ev.risk, N: ev.N, G: ev.G, Ew: ev.Ew, E: ev.E, EoverN: ev.EoverN };
  });
}

/** A continuous piecewise affine envelope attains its maximum at a segment endpoint or along a flat
 * segment. At shared endpoints use the lower risk, including the preserved end-only tied reports. The
 * tolerance compares risks only: it never expands an interval in weight coordinates. */
function maximumWeightEnvelope(intervals: readonly WeightInterval[], tieTol: number): WeightBreakpoints["envelopeMaximum"] {
  const endpoints = new Map<number, number>();
  const add = (weight: number, risk: number) => endpoints.set(weight, Math.min(endpoints.get(weight) ?? Number.POSITIVE_INFINITY, risk));
  for (const interval of intervals) {
    add(interval.wFrom, interval.riskFrom);
    add(interval.wTo, interval.riskTo);
  }
  let risk = Number.NEGATIVE_INFINITY;
  for (const value of endpoints.values()) risk = Math.max(risk, value);
  const ranges: { from: number; to: number }[] = [];
  for (const [weight, value] of endpoints) if (value >= risk - tieTol) ranges.push({ from: weight, to: weight });
  for (const interval of intervals) {
    if (
      interval.wFrom < interval.wTo && interval.E[0] === interval.E[1] &&
      (endpoints.get(interval.wFrom) as number) >= risk - tieTol &&
      (endpoints.get(interval.wTo) as number) >= risk - tieTol
    ) ranges.push({ from: interval.wFrom, to: interval.wTo });
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: { from: number; to: number }[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
    else merged.push({ ...range });
  }
  return { risk, intervals: merged, tieTol };
}

/**
 * K = 2: exact breakpoints of the optimum of an enumerable family at fixed τ as the first weight w1 moves over
 * [0, 1] (w = (w1, 1 − w1); E-22). Each report's Z = E_2 − τN + w1(E_1 − E_2) is linear in w1, so the optimum
 * follows the lower hull of the points (E_2 − E_1, E_2 − τN) and the breakpoints are its edge slopes. Intervals
 * are closed and share their endpoints, as in tauPath; a report optimal exactly at w1 = 0 or w1 = 1 only gets a
 * zero-length interval there. Ties within tieTol (risk scale). An empty family returns `{ empty: true, family }`.
 */
export function weightBreakpoints(E: ErrorArray, options: WeightBreakpointsOptions): WeightBreakpoints | EmptyOptimum {
  const o = readOptions<WeightBreakpointsOptions>(options, ["tau", "family", "tieTol"], "weightBreakpoints", true);
  const tau = checkTau(o.tau);
  const K = Array.isArray(E?.e) ? E.e.length : 0;
  if (K !== 2) throw new RangeError("weightBreakpoints needs two criteria (K = 2)");
  const P = prepare(E, [0.5, 0.5]);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const info = familyInfo(n, family);
  if (info.sizeExact === 0n) return emptyResult(info, "exact-within-family");
  checkEnumerable(n, info, family);
  const { E1, E2, Ns, G8, r } = storeTwoCriteria(P, family, Number(info.sizeExact));
  const tolZ = tieTol * M;
  const x = new Float64Array(r);
  const a = new Float64Array(r);
  for (let q = 0; q < r; q += 1) {
    x[q] = E2[q] - E1[q];
    a[q] = E2[q] - tau * Ns[q];
  }
  // points by x, then a, then enumeration (lexicographic) order; x within tolZ are one column (its lowest a, the
  // first report within tolZ of it)
  const idx = Uint32Array.from({ length: r }, (_, q) => q).sort((p, q) => x[p] - x[q] || a[p] - a[q] || p - q);
  const px: number[] = [];
  const pa: number[] = [];
  const pr: number[] = [];
  for (let s = 0; s < r; ) {
    let t = s;
    let lowest = s;
    while (t < r && x[idx[t]] - x[idx[s]] <= tolZ) {
      if (a[idx[t]] < a[idx[lowest]]) lowest = t;
      t += 1;
    }
    let pick = idx[lowest];
    for (let u = s; u < t; u += 1) if (a[idx[u]] <= a[idx[lowest]] + tolZ && idx[u] < pick) pick = idx[u];
    px.push(x[pick]);
    pa.push(a[pick]);
    pr.push(pick);
    s = t;
  }
  const hull = lowerHullIndices(px, pa, tolZ);
  const zAt = (h: number, w1: number) => pa[hull[h]] - w1 * px[hull[h]];
  const slope = (h: number) => (pa[hull[h]] - pa[hull[h - 1]]) / (px[hull[h]] - px[hull[h - 1]]);
  const interval = (h: number, from: number, to: number): WeightInterval => {
    const q = pr[hull[h]];
    const grade = Array.from(G8.subarray(q * n, q * n + n));
    const ev = evaluateReport(grade, E, { tau, w: [0.5, 0.5] });
    const risk = (w1: number) => (w1 * ev.E[0] + (1 - w1) * ev.E[1] + tau * (M - ev.N)) / M;
    return { wFrom: from, wTo: to, grade, N: ev.N, G: ev.G, E: ev.E, EoverN: ev.EoverN, riskFrom: risk(from), riskTo: risk(to) };
  };
  const min0 = Math.min(...hull.map((_, h) => zAt(h, 0)));
  const min1 = Math.min(...hull.map((_, h) => zAt(h, 1)));
  const atZero: WeightInterval[] = [];
  const inner: WeightInterval[] = [];
  const atOne: WeightInterval[] = [];
  for (let h = 0; h < hull.length; h += 1) {
    const from = h === 0 ? 0 : Math.max(0, slope(h));
    const to = h === hull.length - 1 ? 1 : Math.min(1, slope(h + 1));
    if (from < to) inner.push(interval(h, from, to));
    else if (to <= 0 && zAt(h, 0) <= min0 + tolZ) atZero.push(interval(h, 0, 0));
    else if (from >= 1 && zAt(h, 1) <= min1 + tolZ) atOne.push(interval(h, 1, 1));
  }
  const intervals = [...atZero, ...inner, ...atOne];
  return {
    empty: false,
    intervals,
    breakpoints: inner.slice(1).map((v) => v.wFrom),
    envelopeMaximum: maximumWeightEnvelope(intervals, tieTol),
    tau,
    family: info,
    containsAllWithheld: familyHasAllWithheld(n, family),
    tieTol,
    label: "exact-within-family",
  };
}

/**
 * The k reports of an enumerable family with the smallest risk (Step 7.1), optionally only those that state every
 * listed pair (`stating`: [i, j] = "i above j", g_i < g_j). One pass over the family as exactOptimum walks it
 * (same families and budget); risks within tieTol·(1 + |risk|) keep enumeration (lexicographic) order (KBest).
 * `matched` counts the reports that pass the filter; each listed report carries evaluateReport's risk, N and Ew.
 */
export function bestReports(E: ErrorArray, options: BestReportsOptions): BestReports {
  const o = readOptions<BestReportsOptions>(options, ["tau", "w", "family", "k", "stating", "tieTol"], "bestReports", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const { n, M } = P;
  const family = resolveFamily(o.family);
  const k = checkK(o.k, "bestReports");
  const tieTol = checkTol(o.tieTol, "tieTol");
  const stating = o.stating ?? [];
  if (!Array.isArray(stating)) throw new RangeError("bestReports: stating must be a list of [i, j] pairs");
  const si: number[] = [];
  const sj: number[] = [];
  for (const pair of stating) {
    const ok =
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < n) &&
      pair[0] !== pair[1];
    if (!ok) throw new RangeError(`bestReports: each stating entry must be [i, j] with distinct unit indices in 0…${n - 1}`);
    si.push(pair[0]);
    sj.push(pair[1]);
  }
  const info = familyInfo(n, family);
  const done = (matched: number, reports: RankedReport[]): BestReports => ({ family: info, matched, reports, tieTol, label: "exact-within-family" });
  if (info.sizeExact === 0n) return done(0, []);
  checkEnumerable(n, info, family);
  const walker = createWalker(n, family, [P.ebar]);
  const best = new KBest(n, k, tieTol);
  const S = si.length;
  const g = walker.g;
  let matched = 0;
  while (walker.next()) {
    let ok = true;
    for (let q = 0; q < S; q += 1) {
      if (!(g[si[q]] < g[sj[q]])) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    matched += 1;
    const N = walker.N;
    best.push(g, (walker.sum(0) + tau * (M - N)) / M);
  }
  const reports = best.result().map(({ grade }) => {
    const ev = evaluateReport(grade, E, { tau, w: P.w });
    return { grade, risk: ev.risk, N: ev.N, Ew: ev.Ew };
  });
  return done(matched, reports);
}
