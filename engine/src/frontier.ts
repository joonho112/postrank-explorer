// Matched-disclosure frontier: the report cloud, its lower hull H(m), supporting vertices, ψ mixtures, the
// hull of one order's contiguous cuts, and the half-slope endpoint condition.
//
// Definitions (postrank theory book ch. 16 sec-matched-disclosure-frontier; App. B)
//   Each report g of a fixed family is the point (N(g), Ew(g)), Ew = Σ_k w_k E_k (the book's A(g)).
//   H(m) = min { Σ ψ_g Ew(g) : ψ ≥ 0, Σ ψ_g = 1, Σ ψ_g N(g) = m } for m in [min N, max N]: the lower convex hull
//   of the points, convex and piecewise affine (prp-matched-disclosure-frontier). Every report h satisfies
//   H(N(h)) ≤ Ew(h). Between adjacent vertices (N₋, A₋) and (N₊, A₊), the mixture puts ψ = (m − N₋)/(N₊ − N₋)
//   on the upper-disclosure report and gives (1 − ψ)A₋ + ψA₊ = H(m): "a mixture of two complete reports, not a
//   report we can print" (CONTRACT 6.5).
//   The origin (0, 0) belongs to the cloud exactly when the family contains the all-withheld report.
//   An exact minimizer of Ew − τN lies on the supporting line of slope τ.
//   Half-slope endpoint (ch. 16 "The unrestricted half-cost endpoint"): with the full family 𝒜_n and no latent
//   ties on positive-weight criteria (ebar_ij + ebar_ji = 1), every hull edge slope lies in [0, 1/2] and a
//   strict report is optimal at τ = 1/2. Caps, exact counts, fixed orders and budgets lose this guarantee.
//
// Large clouds are summarized per N (min, max, count), never drawn one mark per report (CONTRACT 8.8); full
// point lists are returned only for families of at most 5,000 reports.
// Tolerance (E-19): a tie is a risk difference of at most tieTol (default 1e-12), that is tieTol·M in the count
// units of Ew − τN; supportingVertex and lowerHull convert with M (from the cloud, options.M or a vertex grade).

import type { ErrorArray } from "./pairwise.ts";
import { type Family, type Grade, pairCount } from "./report.ts";
import { checkTau, evaluateReport } from "./risk.ts";
import {
  CLOUD_POINTS_LIMIT, type CloudPoint, type CloudRow, type EmptyResult, type FamilyLabel, KBest, type OrderInputs, checkEnumerable,
  checkK, checkTol, createWalker, emptyResult, familyHasAllWithheld, familyInfo, lowerHullIndices, prepare, resolveOrderFamily,
  scanCloud,
} from "./optimize.ts";
import { formatCount } from "./format.ts";
import { checkKeys, readOptions } from "./options.ts";

/** orderHull limits (E-13): without a cap at most 150 units; with a cap or exact count at most 5·10⁷ table
 *  cells H·m·M (H grade layers, m blocks, M pairs). */
export const ORDER_HULL_BUDGET: Readonly<{ maxUnitsUncapped: number; maxCells: number }> = Object.freeze({
  maxUnitsUncapped: 150,
  maxCells: 5e7,
});

export interface CloudOptions {
  w?: readonly number[];
  /** default { kind: "all" } */
  family?: Family;
  /** risk-scale tolerance for choosing the lexicographically first report at the smallest Ew; default 1e-12 */
  tieTol?: number;
}

export interface ReportCloud {
  empty: false;
  n: number;
  M: number;
  K: number;
  w: number[];
  family: FamilyLabel;
  containsAllWithheld: boolean;
  /** one row per attained N, ascending: { N, minEw, maxEw, count, minGrade, maxGrade } */
  byN: CloudRow[];
  /** every report { grade, N, Ew } in lexicographic order, only when the family has at most 5,000 reports */
  points: CloudPoint[] | null;
  tieTol: number;
  label: "exact-within-family";
}

export interface HullVertex {
  N: number;
  Ew: number;
  /** one report attaining the vertex (null when the input points carried none) */
  grade: Grade | null;
}

/** A point for lowerHull: { N, Ew } or a cloud row { N, minEw }, with an optional grade. */
export interface HullInput {
  N: number;
  Ew?: number;
  minEw?: number;
  grade?: Grade | null;
  minGrade?: Grade | null;
}

export interface SupportingVertex {
  /** the tied vertex with the smallest N */
  vertex: HullVertex;
  /** every vertex whose risk is within tieTol of the smallest (Ew − τN within tieTol·M), ascending N */
  vertices: HullVertex[];
  /** min Ew − τN (risk = τ + value/M) */
  value: number;
}

export interface MatchedDisclosure {
  /** the matched disclosure m */
  N: number;
  /** H(m) */
  H: number;
  /** weight on the upper vertex; 0 when m is a vertex */
  psi: number;
  lower: HullVertex;
  upper: HullVertex;
  /** the best single report with exactly N disclosed pairs; null when no report (or no cloud) has that N */
  best: { grade: Grade; Ew: number } | null;
  /** best.Ew − H(m) ≥ 0; null when best is null */
  gap: number | null;
}

export interface OrderHullOptions extends OrderInputs {
  w?: readonly number[];
  /** risk tolerance of the hull (points within tieTol·M of a chord are not vertices); default 1e-12 */
  tieTol?: number;
}

export interface HullOptions {
  /** risk tolerance (default 1e-12), converted to count units with M */
  tieTol?: number;
  /** pairs M = n(n − 1)/2; default from the cloud or from a vertex grade */
  M?: number;
}

export interface HalfSlopeInput {
  family: Family;
  /** no latent ties on the positive-weight criteria (true/false), or one flag per criterion */
  tieFree: boolean | readonly boolean[];
  /** with per-criterion `tieFree`: the weights (or flags) marking the criteria whose ties matter */
  positiveWeights?: readonly (number | boolean)[];
}

export interface ReportsAtNOptions {
  w?: readonly number[];
  /** default { kind: "all" } */
  family?: Family;
  /** the number of stated pairs (an integer ≥ 0) */
  N: number;
  /** how many reports to return (an integer ≥ 1); default 1 */
  k?: number;
  /** two values of Ew within tieTol·(1 + |Ew|) keep enumeration order; default 1e-12 */
  tieTol?: number;
}

export interface ReportsAtN {
  family: FamilyLabel;
  N: number;
  /** reports of the family with exactly N stated pairs */
  count: number;
  /** the k of them with the smallest Ew (ties in enumeration order); empty when count = 0 */
  reports: { grade: Grade; Ew: number }[];
  tieTol: number;
  label: "exact-within-family";
}

export interface RuleGapOptions {
  w?: readonly number[];
  /** vertices of H(m) as lowerHull returns them (ascending N) */
  hull: readonly HullVertex[];
  /** gap is set to 0 when |Ew − H| ≤ tieTol·M; default 1e-12 */
  tieTol?: number;
}

export interface RuleGap {
  /** stated pairs of the report */
  N: number;
  /** Σ_k w_k E_k of the report */
  Ew: number;
  /** the lower hull at N */
  H: number;
  /** Ew − H, set to 0 within tieTol·M */
  gap: number;
  /** weight on the lower vertex, (N_b − N)/(N_b − N_a); null when N is a vertex */
  psi: number | null;
  lower: HullVertex;
  upper: HullVertex;
  /** gap === 0 */
  onFrontier: boolean;
}

// ---------------------------------------------------------------------------------------------------------

/**
 * Every report of an enumerable family as (N, Ew), summarized per N: smallest and largest Ew, count, and the
 * lexicographically first report at each extreme. Full points only when the family has ≤ 5,000 reports.
 */
export function reportCloud(E: ErrorArray, options: CloudOptions = {}): ReportCloud | EmptyResult<"exact-within-family"> {
  const o = readOptions<CloudOptions>(options, ["w", "family", "tieTol"], "reportCloud");
  const P = prepare(E, o.w);
  const family = o.family ?? { kind: "all" };
  const tieTol = checkTol(o.tieTol, "tieTol");
  const info = familyInfo(P.n, family);
  if (info.sizeExact === 0n) return emptyResult(info, "exact-within-family");
  checkEnumerable(P.n, info, family);
  const { rows, points } = scanCloud(P, family, tieTol, info.sizeExact <= BigInt(CLOUD_POINTS_LIMIT));
  return {
    empty: false,
    n: P.n,
    M: P.M,
    K: P.K,
    w: P.w,
    family: info,
    containsAllWithheld: familyHasAllWithheld(P.n, family),
    byN: rows,
    points,
    tieTol,
    label: "exact-within-family",
  };
}

function hullPoints(cloud: ReportCloud | readonly HullInput[]): { N: number; Ew: number; grade: Grade | null }[] {
  if (!Array.isArray(cloud) && (cloud as { empty?: unknown } | null)?.empty === true) return [];
  const raw: readonly HullInput[] = Array.isArray(cloud) ? cloud : (cloud as ReportCloud)?.byN;
  if (!Array.isArray(raw)) throw new RangeError("lowerHull needs a reportCloud() result or an array of { N, Ew } points");
  const byN = new Map<number, { N: number; Ew: number; grade: Grade | null }>();
  for (const [q, p] of raw.entries()) {
    const N = p?.N;
    const Ew = p?.minEw ?? p?.Ew;
    if (typeof N !== "number" || !Number.isFinite(N) || typeof Ew !== "number" || !Number.isFinite(Ew)) {
      throw new RangeError(`point ${q} must have finite N and Ew (or minEw)`);
    }
    const grade = p.minGrade ?? p.grade ?? null;
    const prev = byN.get(N);
    if (prev === undefined || Ew < prev.Ew) byN.set(N, { N, Ew, grade: grade === null ? null : Array.from(grade) });
  }
  return [...byN.values()].sort((a, b) => a.N - b.N);
}

/** M for a tolerance: options.M, else the cloud's M, else from the first vertex grade; null when unknown. */
function pairsOf(M: number | undefined, cloud: unknown, pts: readonly { grade?: Grade | null }[]): number | null {
  if (M !== undefined) {
    if (typeof M !== "number" || !Number.isSafeInteger(M) || M < 1) throw new RangeError("M must be a positive integer (n(n − 1)/2)");
    return M;
  }
  const cm = (cloud as { M?: unknown } | null)?.M;
  if (!Array.isArray(cloud) && typeof cm === "number") return cm;
  const g = pts.find((p) => Array.isArray(p.grade))?.grade;
  return g ? pairCount(g.length) : null;
}

/**
 * Vertices of the lower convex hull H(m) of a cloud (its per-N minima) or of a list of points, ascending N.
 * Points on a hull edge (within tieTol·M, risk scale; M from the cloud, options.M or the vertex grades, else
 * 1e-12·max(1, |Ew|)) are not vertices. Each vertex carries one report attaining it. An empty cloud gives [].
 */
export function lowerHull(cloud: ReportCloud | readonly HullInput[], options: HullOptions = {}): HullVertex[] {
  const o = readOptions<HullOptions>(options, ["tieTol", "M"], "lowerHull");
  const tieTol = checkTol(o.tieTol, "tieTol");
  const pts = hullPoints(cloud);
  const M = pairsOf(o.M, cloud, pts);
  return lowerHullIndices(
    pts.map((p) => p.N),
    pts.map((p) => p.Ew),
    M === null ? undefined : tieTol * M,
  ).map((i) => pts[i]);
}

function checkHull(hull: readonly HullVertex[]): void {
  if (!Array.isArray(hull) || hull.length < 1) throw new RangeError("hull must be a nonempty array of vertices");
  for (let q = 0; q < hull.length; q += 1) {
    const v = hull[q];
    if (!Number.isFinite(v?.N) || !Number.isFinite(v?.Ew)) throw new RangeError(`hull vertex ${q} must have finite N and Ew`);
    if (q > 0 && !(v.N > hull[q - 1].N)) throw new RangeError("hull vertices must have increasing N");
  }
}

/**
 * The hull vertex (or vertices) touched by the supporting line of slope τ: the minimizers of Ew − τN, every
 * vertex whose risk is within `tieTol` (risk scale, default 1e-12) of the smallest, that is within tieTol·M in
 * count units (M from options.M or the vertex grades; required when the vertices carry no grade), ascending N.
 */
export function supportingVertex(hull: readonly HullVertex[], tau: number, options: HullOptions = {}): SupportingVertex {
  const o = readOptions<HullOptions>(options, ["tieTol", "M"], "supportingVertex");
  checkTau(tau);
  checkHull(hull);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const M = pairsOf(o.M, null, hull);
  if (M === null) throw new RangeError("supportingVertex needs M (options.M) when the hull vertices carry no grade");
  const values = hull.map((v) => v.Ew - tau * v.N);
  const value = Math.min(...values);
  const vertices = hull.filter((_, q) => values[q] <= value + tieTol * M);
  return { vertex: vertices[0], vertices, value };
}

/**
 * H at disclosure N (a real number between the smallest and largest N of the hull) by linear interpolation
 * between the adjacent vertices, the mixing weight ψ = (N − N₋)/(N₊ − N₋) on the upper vertex (0 at a vertex),
 * and the best single report with exactly N disclosed pairs from the cloud (null when there is none).
 */
export function matchedDisclosure(cloud: ReportCloud | null, hull: readonly HullVertex[], N: number): MatchedDisclosure {
  checkHull(hull);
  const lo = hull[0].N;
  const hi = hull[hull.length - 1].N;
  if (typeof N !== "number" || !Number.isFinite(N) || N < lo || N > hi) {
    throw new RangeError(`N must lie between the smallest and largest disclosure of the family (${lo} … ${hi})`);
  }
  let q = 0;
  while (q < hull.length - 1 && hull[q + 1].N <= N) q += 1;
  const lower = hull[q];
  const upper = lower.N === N ? lower : hull[q + 1];
  const psi = upper === lower ? 0 : (N - lower.N) / (upper.N - lower.N);
  const H = upper === lower ? lower.Ew : (1 - psi) * lower.Ew + psi * upper.Ew;
  let best: MatchedDisclosure["best"] = null;
  const row = cloud?.byN?.find((r) => r.N === N);
  if (row) best = { grade: row.minGrade, Ew: row.minEw };
  return { N, H, psi, lower, upper, best, gap: best === null ? null : best.Ew - H };
}

/**
 * Lower hull of the contiguous cuts of one declared order (optionally at most G or exactly `exact` grades,
 * with indivisible `blocks`; the order from `order`, `scores` or `family` as fixedOrderDP): an exact DP along
 * the withheld-pair count gives the smallest Ew at every attainable N, then the hull is taken. No enumeration,
 * but the table has H·m·M cells, so it is refused above ORDER_HULL_BUDGET (E-13): more than 150 units without a
 * cap, or more than 5·10⁷ cells with one. An empty family returns `{ empty: true, family }`.
 */
export function orderHull(E: ErrorArray, options: OrderHullOptions): HullVertex[] | EmptyResult<"optimal-within-order"> {
  const o = readOptions<OrderHullOptions>(
    options,
    ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids", "w", "tieTol"],
    "orderHull",
    true,
  );
  const P = prepare(E, o.w);
  const { n, M, ebar } = P;
  const tieTol = checkTol(o.tieTol, "tieTol");
  const family = resolveOrderFamily(n, o, E, "orderHull");
  const info = familyInfo(n, family); // validates order, blocks, G and exact
  if (info.sizeExact === 0n) return emptyResult(info, "optimal-within-order");
  const order = Array.from(family.order);
  const sizes = family.blocks === undefined ? new Array<number>(n).fill(1) : Array.from(family.blocks);
  const m = sizes.length;
  const bounds = [0];
  for (const s of sizes) bounds.push(bounds[bounds.length - 1] + s);
  const exact = family.exact;
  const capped = exact !== undefined || (family.G !== undefined && family.G < m);
  const H = exact ?? Math.min(family.G ?? m, m);
  const { maxUnitsUncapped, maxCells } = ORDER_HULL_BUDGET;
  if (!capped && n > maxUnitsUncapped) {
    throw new RangeError(
      `orderHull covers at most ${maxUnitsUncapped} units without a grade cap; ${info.name} is on n = ${n} units. ` +
        "Use fixedOrderDP for the optimum at one τ, or give a cap G.",
    );
  }
  if (capped && H * m * M > maxCells) {
    throw new RangeError(
      `orderHull keeps a table of H·m·M cells, at most ${formatCount(maxCells)}; ${info.name} needs ${formatCount(H * m * M)} ` +
        `(H = ${H} grade layers, m = ${m} blocks, M = ${formatCount(M)} pairs). Use fixedOrderDP for the optimum at one τ.`,
    );
  }

  // X(a, b) = Σ_{s ≤ a < t ≤ b} ebar_{ρ_s ρ_t}: stated pairs between the prefix [1..a] and the block (a, b]
  const n1 = n + 1;
  const X = new Float64Array(n1 * n1);
  for (let b = 1; b <= n; b += 1) {
    const ub = order[b - 1];
    let cp = 0;
    for (let a = 1; a < b; a += 1) {
      cp += ebar[order[a - 1] * n + ub];
      X[a * n1 + b] = X[a * n1 + b - 1] + cp;
    }
  }
  const layers = capped ? H + 1 : 1;
  const W1 = M + 1;
  const at = (layer: number, c: number, wd: number) => (layer * (m + 1) + c) * W1 + wd;
  const F = new Float64Array(layers * (m + 1) * W1).fill(Number.POSITIVE_INFINITY);
  const pred = m < 32768 ? new Int16Array(layers * (m + 1) * W1).fill(-1) : new Int32Array(layers * (m + 1) * W1).fill(-1);
  const lo = new Int32Array(layers * (m + 1)).fill(W1);
  const hi = new Int32Array(layers * (m + 1)).fill(-1);
  F[at(0, 0, 0)] = 0;
  lo[0] = 0;
  hi[0] = 0;
  const relax = (from: number, b: number, to: number, c: number) => {
    const s = from * (m + 1) + b;
    if (lo[s] > hi[s]) return;
    const sz = bounds[c] - bounds[b];
    const add = (sz * (sz - 1)) / 2;
    const cost = X[bounds[b] * n1 + bounds[c]];
    const t = to * (m + 1) + c;
    for (let wd = lo[s]; wd <= hi[s]; wd += 1) {
      const v = F[at(from, b, wd)];
      if (v === Number.POSITIVE_INFINITY) continue;
      const j = at(to, c, wd + add);
      const x = v + cost;
      if (x < F[j]) {
        F[j] = x;
        pred[j] = b;
        if (wd + add < lo[t]) lo[t] = wd + add;
        if (wd + add > hi[t]) hi[t] = wd + add;
      }
    }
  };
  if (capped) {
    for (let h = 1; h <= H; h += 1) for (let c = h; c <= m; c += 1) for (let b = h - 1; b < c; b += 1) relax(h - 1, b, h, c);
  } else {
    for (let c = 1; c <= m; c += 1) for (let b = 0; b < c; b += 1) relax(0, b, 0, c);
  }
  const terminal = capped ? (exact !== undefined ? [exact] : Array.from({ length: H }, (_, q) => q + 1)) : [0];
  // per withheld count: the smallest Ew over the terminal layers (fewer grades first on equal Ew)
  const Ns: number[] = [];
  const Ews: number[] = [];
  const where: { layer: number; wd: number }[] = [];
  for (let wd = M; wd >= 0; wd -= 1) {
    let best = Number.POSITIVE_INFINITY;
    let layerBest = -1;
    for (const layer of terminal) {
      const v = F[at(layer, m, wd)];
      if (v < best) {
        best = v;
        layerBest = layer;
      }
    }
    if (layerBest < 0) continue;
    Ns.push(M - wd);
    Ews.push(best);
    where.push({ layer: layerBest, wd });
  }
  const gradeOf = (layer: number, wd0: number): Grade => {
    const grade = new Array<number>(n);
    const groups: [number, number][] = [];
    let c = m;
    let wd = wd0;
    let h = layer;
    while (c > 0) {
      const b = pred[at(h, c, wd)];
      groups.push([b, c]);
      const sz = bounds[c] - bounds[b];
      wd -= (sz * (sz - 1)) / 2;
      c = b;
      if (capped) h -= 1;
    }
    groups.reverse();
    groups.forEach(([b, c2], r) => {
      for (let pos = bounds[b]; pos < bounds[c2]; pos += 1) grade[order[pos]] = r + 1;
    });
    return grade;
  };
  return lowerHullIndices(Ns, Ews, tieTol * M).map((i) => ({ N: Ns[i], Ew: Ews[i], grade: gradeOf(where[i].layer, where[i].wd) }));
}

/**
 * Whether the half-slope endpoint (every hull edge slope in [0, 1/2], a strict optimum at τ = 1/2) is
 * guaranteed: only for the full family 𝒜_n (kind "all") with no latent ties on positive-weight criteria.
 * `tieFree` may be one flag, or one flag per criterion together with `positiveWeights` (only criteria with a
 * positive weight must be tie-free).
 */
export function halfSlopeEligible(input: HalfSlopeInput): boolean {
  if (input != null && typeof input === "object") checkKeys(input, ["family", "tieFree", "positiveWeights"], "halfSlopeEligible input");
  const family = input?.family;
  if (family == null || typeof family !== "object") throw new RangeError("family must be a family object");
  const tieFree = input.tieFree;
  let free: boolean;
  if (typeof tieFree === "boolean") free = tieFree;
  else if (Array.isArray(tieFree) && tieFree.every((x) => typeof x === "boolean")) {
    const pw = input.positiveWeights;
    if (pw !== undefined && (!Array.isArray(pw) || pw.length !== tieFree.length)) {
      throw new RangeError("positiveWeights must have one entry per criterion");
    }
    free = tieFree.every((x, k) => x || (pw !== undefined && !(pw[k] === true || (typeof pw[k] === "number" && (pw[k] as number) > 0))));
  } else throw new RangeError("tieFree must be a boolean or one boolean per criterion");
  return family.kind === "all" && free;
}


/**
 * The reports of an enumerable family with exactly N stated pairs (Step 7.1): their number and the k with the
 * smallest Ew, in one pass (ties within tieTol·(1 + |Ew|) keep enumeration order, as bestReports). Ew is
 * evaluateReport's. `reports` is empty when no report has that N.
 */
export function reportsAtN(E: ErrorArray, options: ReportsAtNOptions): ReportsAtN {
  const o = readOptions<ReportsAtNOptions>(options, ["w", "family", "N", "k", "tieTol"], "reportsAtN", true);
  const P = prepare(E, o.w);
  const n = P.n;
  const family = o.family ?? { kind: "all" };
  const target = o.N;
  if (typeof target !== "number" || !Number.isSafeInteger(target) || target < 0) {
    throw new RangeError(`reportsAtN: N must be an integer ≥ 0, got ${String(target)}`);
  }
  const k = checkK(o.k, "reportsAtN");
  const tieTol = checkTol(o.tieTol, "tieTol");
  const info = familyInfo(n, family);
  const done = (count: number, reports: { grade: Grade; Ew: number }[]): ReportsAtN => ({
    family: info,
    N: target,
    count,
    reports,
    tieTol,
    label: "exact-within-family",
  });
  if (info.sizeExact === 0n) return done(0, []);
  checkEnumerable(n, info, family);
  if (target > P.M) return done(0, []);
  const walker = createWalker(n, family, [P.ebar]);
  const best = new KBest(n, k, tieTol);
  let count = 0;
  while (walker.next()) {
    if (walker.N !== target) continue;
    count += 1;
    best.push(walker.g, walker.sum(0));
  }
  const reports = best.result().map(({ grade }) => ({ grade, Ew: evaluateReport(grade, E, { tau: 0.5, w: P.w }).Ew }));
  return done(count, reports);
}

/**
 * How far a report lies above the lower hull H(m) at its own disclosure (Step 7.1): N and Ew of the report
 * (evaluateReport), H at N (the vertex at N, or the mixture of the adjacent vertices with weight
 * psi = (N_b − N)/(N_b − N_a) on the lower one), gap = Ew − H set to 0 when |Ew − H| ≤ tieTol·M, and
 * onFrontier = (gap === 0). N outside the hull's range throws.
 */
export function ruleGap(g: ArrayLike<number>, E: ErrorArray, options: RuleGapOptions): RuleGap {
  const o = readOptions<RuleGapOptions>(options, ["w", "hull", "tieTol"], "ruleGap", true);
  const hull = o.hull;
  checkHull(hull);
  const tieTol = checkTol(o.tieTol, "tieTol");
  const ev = evaluateReport(g, E, { tau: 0.5, w: o.w });
  const { N, Ew, M } = ev;
  const first = hull[0].N;
  const last = hull[hull.length - 1].N;
  if (N < first || N > last) {
    throw new RangeError(`ruleGap: the report states ${N} pairs, outside the hull's range (${first} … ${last})`);
  }
  let q = 0;
  while (q < hull.length - 1 && hull[q + 1].N <= N) q += 1;
  const lower = hull[q];
  let upper = lower;
  let psi: number | null = null;
  let H = lower.Ew;
  if (lower.N !== N) {
    upper = hull[q + 1];
    psi = (upper.N - N) / (upper.N - lower.N);
    H = psi * lower.Ew + (1 - psi) * upper.Ew;
  }
  const raw = Ew - H;
  const gap = Math.abs(raw) <= tieTol * M ? 0 : raw;
  return { N, Ew, H, gap, psi, lower, upper, onFrontier: gap === 0 };
}
