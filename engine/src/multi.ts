// Several criteria: conflicting pairs, weighted errors, the cost of a common grade, the two estimands at a
// known state, error budgets, the criterion-mixture reading of the risk, expected-criterion minimax, and the
// weight at which a fixed report's risk crosses τ.
//
// Definitions (postrank theory book; postrank 1.1.0)
//   ebar_ij = Σ_k w_k e_ij,k; R_k(g) = (E_k + τ(M − N))/M; R(g) = Σ_k w_k R_k(g) (ch. 11 prp-criterion-mixture:
//     the weighted risk is the single-criterion risk of a criterion drawn with probabilities w).
//   Conflict (ch. 12): a pair whose more likely direction differs across criteria. On criterion k the more
//     likely direction is the one with the smaller error (E-10): i above j when e_ij,k < e_ji,k, j above i when
//     e_ij,k > e_ji,k (equal within tieTol: neither). With latent ties e_ij + e_ji = 1 + t_ij, so the reference
//     is the reverse error, not 1/2.
//   Cost of a common grade (vignette m2; postrank_commonality_cost(), R/decision-frontier.R; ch. 17
//     sec-separate-card-comparators): Δ_k = R_k(common) − min over the same family of R_k (criterion k's own
//     problem: weight e_k, the same τ and family), clipped at 0 as the package's cost_lower (the common report
//     belongs to every own family). Here both optima are exact within the family, so the interval is a point.
//   Two estimands at a known state Θ (ch. 12 sec-two-estimands): stating i above j costs Σ_k w_k 1{θ_ik ≤ θ_jk}
//     under the criterion-direction loss and 1{c_i ≤ c_j} under the composite-direction loss, with
//     c_i = Σ_k a_k s_k θ_ik (s_k = multiplier[k], the declared rescaling of criterion k, ch. 12
//     cardinal-composites-require-a-different-scale-argument; the package's postrank_composite(scales =) divides
//     by its scale, so multiplier = 1/scales); withholding costs τ under both.
//   Budgets (ch. 13; App. B 𝒜_q): E_k(g) ≤ q_k N(g) for each criterion with a budget; N = 0 passes.
//   Expected-criterion minimax (ch. 13 sec-expected-criterion-minimax): min over the family of max_{k ∈ K+} R_k,
//     K+ the included criteria (postrank_settings(minimax_criteria = NULL) = all criteria; the book stresses that
//     K+ may differ from the positive-weight support of w).
//   Weight crossing (K = 2): R(w) = w R_1 + (1 − w) R_2 is linear in the first-criterion weight w.

import { Accumulator, type ErrorArray, type LabelOptions, type Matrix, type UnitTable, nanMatrix, readTable, resolveLabels } from "./pairwise.ts";
import { type Family, type Grade, reportGrade } from "./report.ts";
import { type PairDecision, type ReportEvaluation, checkTau, checkWeights, evaluateReport, pairDecision } from "./risk.ts";
import {
  CLOUD_POINTS_LIMIT, type EmptyResult, type ExactOptimum, type FamilyLabel, TieCollector, checkEnumerable, checkTol, createWalker,
  emptyResult, exactOptimum, familyHasAllWithheld, familyInfo, prepare,
} from "./optimize.ts";
import { checkMaxTies, readOptions } from "./options.ts";

/** Absolute tolerance on the budget residual E_k − q_k N (count units; a feasibility tolerance, not a tie test),
 *  as in exactOptimum. */
const BUDGET_TOL = 1e-12;

// ---------------------------------------------------------------------------------------------------------
// Types

export interface ConflictPair {
  i: number;
  j: number;
  /** criteria on which i is more likely above j (e_ij,k < e_ji,k) */
  iAbove: number[];
  /** criteria on which j is more likely above i (e_ij,k > e_ji,k) */
  jAbove: number[];
}

export interface ConflictPairs {
  count: number;
  /** pairs i < j, ordered by i then j */
  pairs: ConflictPair[];
}

export interface CommonalityOptions {
  tau: number;
  w?: readonly number[];
  /** default { kind: "all" } */
  family?: Family;
  tieTol?: number;
  /** at most this many tied optima per list (common.grades, ownGrades); default 100 */
  maxTies?: number;
}

export interface CommonalityRow {
  k: number;
  criterion: string;
  /** the common report's weight on criterion k */
  weight: number;
  /** R_k of the common report */
  commonRk: number;
  /** the first of criterion k's own optima (lexicographic) */
  ownGrade: Grade;
  /** the own optima within tieTol (weight e_k, same τ and family), lexicographic, at most maxTies */
  ownGrades: Grade[];
  /** the number of own optima */
  ownTieCount: number;
  /** R_k of the own optimum, its minimum within the family */
  ownRk: number;
  ownN: number;
  ownG: number;
  /** Δ_k = max(0, commonRk − ownRk) */
  delta: number;
  /** share of unordered pairs with the same relation (above, shared, below) in ownGrade and the common grade */
  relationAgreement: number;
}

export interface CommonalityCost {
  empty: false;
  /** the common exact optimum under w */
  common: ExactOptimum;
  family: FamilyLabel;
  tau: number;
  w: number[];
  criteria: CommonalityRow[];
  /** Each retained common optimum, in common.grades order, compared with the same own optima. */
  commonReports: CommonalityReport[];
  containsAllWithheld: boolean;
  label: "exact-within-family";
}

export interface CommonalityReport {
  grade: Grade;
  Rk: number[];
  /** max(0, Rk[k] − criteria[k].ownRk), in criterion order */
  delta: number[];
  /** pair-relation agreement with criteria[k].ownGrade, in criterion order */
  relationAgreement: number[];
}

export interface EstimandOptions extends LabelOptions {
  /** error weights w_k (≥ 0, sum 1) of the criterion-direction loss */
  w?: readonly number[];
  /** composite coefficients a_k (any finite numbers) */
  a: readonly number[];
  tau: number;
  /** positive multiplier s_k applied to criterion k before the composite (criterion k is multiplied by
   *  multiplier[k]); default all 1. The package's postrank_composite(scales =) divides: multiplier = 1/scales */
  multiplier?: readonly number[];
  /** the pair (i, j) whose three costs are returned; default [0, 1] */
  pair?: readonly [number, number] | readonly number[];
}

export interface EstimandCosts {
  pair: [number, number];
  /** c_i = Σ_k a_k s_k θ_ik for every unit */
  c: number[];
  /** costs of i above j, j above i and withholding under the weighted criterion-direction loss, and the best */
  criterionLoss: PairDecision;
  /** the same under the composite-direction loss */
  compositeLoss: PairDecision;
  /** the known state as an ErrorArray: e[k][i][j] = 1{θ_ik ≤ θ_jk} (pass to exactOptimum with w) */
  criterionE: ErrorArray;
  /** the composite as a one-criterion ErrorArray: e[0][i][j] = 1{c_i ≤ c_j} */
  compositeE: ErrorArray;
}

export interface BudgetFamilyOptions {
  tau: number;
  w?: readonly number[];
  family?: Family;
  /** q[k] ≥ 0, or null/undefined for no budget on criterion k */
  q?: readonly (number | null | undefined)[];
  tieTol?: number;
  /** at most this many tied optima in optimum.grades; default 100 */
  maxTies?: number;
}

export interface BudgetFamily {
  empty: boolean;
  /** number of reports in the family that meet every budget */
  size: number;
  /** size of the base family (number up to 2^53, else a decimal string) */
  baseSize: number | string;
  family: FamilyLabel;
  /** the exact optimum within the budget family; null when it is empty */
  optimum: ExactOptimum | null;
  /** the members (lexicographic) when the base family has at most 5,000 reports; otherwise null */
  members: Grade[] | null;
  /** the budget family contains the all-withheld report (it meets every budget whenever the base has it) */
  containsAllWithheld: boolean;
  label: "exact-within-family";
}

export interface BudgetRow {
  k: number;
  criterion: string;
  q: number;
  E: number;
  N: number;
  qN: number;
  /** E_k/N; null when N = 0 */
  EoverN: number | null;
  /** qN − E (≥ 0 when the budget is met) */
  slack: number;
  /** E ≤ qN (absolute tolerance 1e-12; N = 0 passes) */
  meets: boolean;
}

export interface BudgetCheck {
  /** one row per criterion with a budget, in criterion order */
  rows: BudgetRow[];
  /** every row meets its budget */
  meets: boolean;
}

export interface CriterionMixtureRisk {
  /** Σ_k w_k R_k */
  risk: number;
  Rk: number[];
  w: number[];
  /** evaluateReport risk (Ew + τ(M − N))/M */
  weightedRisk: number;
  /** risk − weightedRisk (0 up to rounding) */
  difference: number;
}

export interface MinimaxOptions {
  tau: number;
  w?: readonly number[];
  family?: Family;
  /** criteria included in the maximum (indices or criterion ids); default every criterion */
  criteria?: readonly (number | string)[];
  tieTol?: number;
  /** at most this many tied optima per list; default 100 */
  maxTies?: number;
}

export interface MinimaxReport {
  grade: Grade;
  N: number;
  Rk: number[];
  /** max of Rk over the included criteria */
  max: number;
  /** Σ_k w_k R_k */
  weighted: number;
}

export interface MinimaxChoice {
  empty: false;
  family: FamilyLabel;
  tau: number;
  w: number[];
  /** the included criteria (indices, ascending) */
  included: number[];
  /** every report of the family with its criterion risks, when the family has at most 5,000 reports; else null */
  reports: MinimaxReport[] | null;
  /** the weighted optimum (exactOptimum) */
  weighted: { grade: Grade; grades: Grade[]; tieCount: number; risk: number; Rk: number[]; max: number };
  /** the minimax optimum: smallest largest included R_k, ties within tieTol listed lexicographically (at most
   *  maxTies; tieCount counts them all) */
  minimax: { grade: Grade; grades: Grade[]; tieCount: number; value: number; Rk: number[]; weightedRisk: number };
  containsAllWithheld: boolean;
  tieTol: number;
  label: "exact-within-family";
}

export interface WeightCrossingOptions {
  tau: number;
}

// ---------------------------------------------------------------------------------------------------------
// Helpers

/** Validate an ErrorArray of any K (through prepare) without requiring weights. */
function prepared(E: ErrorArray) {
  const K = Array.isArray(E?.e) ? E.e.length : 0;
  return prepare(E, K <= 1 ? undefined : new Array<number>(K).fill(1 / K));
}

function criterionIds(E: ErrorArray, K: number): string[] {
  return Array.isArray(E.criteria) && E.criteria.length === K ? [...E.criteria] : Array.from({ length: K }, (_, k) => `k${k + 1}`);
}

function unitVector(K: number, k: number): number[] {
  return Array.from({ length: K }, (_, q) => (q === k ? 1 : 0));
}

/** Share of unordered pairs whose relation (above, shared, below) is the same in two reports. */
function relationAgreement(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  let same = 0;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      total += 1;
      if (Math.sign(a[i] - a[j]) === Math.sign(b[i] - b[j])) same += 1;
    }
  }
  return same / total;
}

function readBudgetVector(q: readonly (number | null | undefined)[] | undefined | null, K: number): (number | null)[] {
  if (q === undefined || q === null) return new Array<number | null>(K).fill(null);
  if (!Array.isArray(q) || q.length !== K) throw new RangeError(`q must hold ${K} budgets (null for none)`);
  return q.map((x, k) => {
    if (x === null || x === undefined) return null;
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new RangeError(`q[${k}] must be finite and ≥ 0, or null`);
    return x;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/**
 * Pairs i < j whose more likely direction differs across criteria (E-10): on criterion k, i is more likely above
 * j when e[k][i][j] < e[k][j][i] and j above i when e[k][i][j] > e[k][j][i] (the smaller error marks the more
 * likely direction; equal within tieTol, default 1e-12, favours neither). Correct under latent ties, where
 * e_ij + e_ji exceeds 1.
 */
export function conflictPairs(E: ErrorArray, options: { tieTol?: number } = {}): ConflictPairs {
  const o = readOptions<{ tieTol?: number }>(options, ["tieTol"], "conflictPairs");
  const tieTol = checkTol(o.tieTol, "tieTol");
  const P = prepared(E);
  const { n, K, ek } = P;
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const iAbove: number[] = [];
      const jAbove: number[] = [];
      for (let k = 0; k < K; k += 1) {
        const d = ek[k][i * n + j] - ek[k][j * n + i];
        if (d < -tieTol) iAbove.push(k);
        else if (d > tieTol) jAbove.push(k);
      }
      if (iAbove.length > 0 && jAbove.length > 0) pairs.push({ i, j, iAbove, jAbove });
    }
  }
  return { count: pairs.length, pairs };
}

/** ebar_ij = Σ_k w_k e[k][i][j] (compensated), an n × n matrix with a NaN diagonal; w defaults to [1] when K = 1. */
export function weightedError(E: ErrorArray, w?: readonly number[]): Matrix {
  const P = prepare(E, w);
  const out = nanMatrix(P.n);
  for (let i = 0; i < P.n; i += 1) for (let j = 0; j < P.n; j += 1) if (i !== j) out[i][j] = P.ebar[i * P.n + j];
  return out;
}

/**
 * The cost of a common grade for each criterion (postrank_commonality_cost(), vignette m2; "package quantity"):
 * the common exact optimum under w, each criterion's own exact optima in the same family (weight e_k, same τ;
 * tied optima listed up to maxTies), and Δ_k = max(0, R_k(common) − R_k(own)). Both solves are exhaustive
 * enumerations, so a family above the enumeration budget throws (case pages read the archived costs); an empty
 * family returns `{ empty: true, family }`.
 */
export function commonalityCost(E: ErrorArray, options: CommonalityOptions): CommonalityCost | EmptyResult<"exact-within-family"> {
  const o = readOptions<CommonalityOptions>(options, ["tau", "w", "family", "tieTol", "maxTies"], "commonalityCost", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const family = o.family ?? { kind: "all" };
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "commonalityCost");
  const common = exactOptimum(E, { tau, w: P.w, family, tieTol, maxTies });
  if (common.empty) return common;
  const ids = criterionIds(E, P.K);
  const criteria: CommonalityRow[] = [];
  for (let k = 0; k < P.K; k += 1) {
    const own = exactOptimum(E, { tau, w: unitVector(P.K, k), family, tieTol, maxTies }) as ExactOptimum;
    const commonRk = common.evaluation.Rk[k];
    criteria.push({
      k,
      criterion: ids[k],
      weight: P.w[k],
      commonRk,
      ownGrade: own.grade,
      ownGrades: own.grades,
      ownTieCount: own.tieCount,
      ownRk: own.risk,
      ownN: own.N,
      ownG: own.G,
      delta: Math.max(0, commonRk - own.risk),
      relationAgreement: relationAgreement(own.grade, common.grade),
    });
  }
  const commonReports = common.grades.map((grade) => {
    const Rk = evaluateReport(grade, E, { tau, w: P.w }).Rk;
    return {
      grade: [...grade],
      Rk,
      delta: criteria.map((row, k) => Math.max(0, Rk[k] - row.ownRk)),
      relationAgreement: criteria.map((row) => relationAgreement(row.ownGrade, grade)),
    };
  });
  return { empty: false, common, family: common.family, tau, w: P.w, criteria, commonReports, containsAllWithheld: common.containsAllWithheld, label: "exact-within-family" };
}

/**
 * Action costs for one pair at a known state `state[i][k]` (ch. 12): under the weighted criterion-direction
 * loss, stating i above j costs Σ_k w_k 1{θ_ik ≤ θ_jk}; under the composite-direction loss it costs
 * 1{c_i ≤ c_j} with c_i = Σ_k a_k s_k θ_ik (s = `multiplier`: criterion k is multiplied by multiplier[k] > 0;
 * the package's scales divide, so multiplier = 1/scales; a need not lie on the simplex); withholding costs τ.
 * Also returns both losses as ErrorArrays of the whole state, so exactOptimum(criterionE, { tau, w }) and
 * exactOptimum(compositeE, { tau }) give each loss's report.
 */
export function estimandCosts(state: UnitTable, options: EstimandOptions): EstimandCosts {
  const o = readOptions<EstimandOptions>(options, ["w", "a", "tau", "multiplier", "pair", "ids", "criteria"], "estimandCosts", true);
  const t = readTable(state, "state");
  const { n, K, v } = t;
  if (n < 2) throw new RangeError("state must hold at least two units");
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const a = o.a;
  if (!Array.isArray(a) || a.length !== K || !a.every((x) => typeof x === "number" && Number.isFinite(x))) {
    throw new RangeError(`a must hold ${K} finite composite coefficients`);
  }
  const multiplier = o.multiplier ?? new Array<number>(K).fill(1);
  if (!Array.isArray(multiplier) || multiplier.length !== K || !multiplier.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) {
    throw new RangeError(`multiplier must hold ${K} finite positive multipliers`);
  }
  const pair = o.pair ?? [0, 1];
  const [pi, pj] = Array.isArray(pair) ? pair : [Number.NaN, Number.NaN];
  if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pi) || !Number.isInteger(pj) || pi < 0 || pj < 0 || pi >= n || pj >= n || pi === pj) {
    throw new RangeError(`pair must be two distinct unit indices in 0..${n - 1}`);
  }
  const { ids, criteria } = resolveLabels(o, n, K);
  const c = Array.from({ length: n }, (_, i) => {
    const acc = new Accumulator();
    for (let k = 0; k < K; k += 1) acc.add(a[k] * (multiplier[k] * v[i * K + k]));
    return acc.value;
  });
  const crit = Array.from({ length: K }, () => nanMatrix(n));
  const comp = [nanMatrix(n)];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      for (let k = 0; k < K; k += 1) crit[k][i][j] = v[i * K + k] <= v[j * K + k] ? 1 : 0;
      comp[0][i][j] = c[i] <= c[j] ? 1 : 0;
    }
  }
  const cost = (i: number, j: number) => {
    const acc = new Accumulator();
    for (let k = 0; k < K; k += 1) acc.add(w[k] * crit[k][i][j]);
    return acc.value;
  };
  return {
    pair: [pi, pj],
    c,
    criterionLoss: pairDecision(cost(pi, pj), cost(pj, pi), tau),
    compositeLoss: pairDecision(comp[0][pi][pj], comp[0][pj][pi], tau),
    criterionE: { ids, criteria, e: crit },
    compositeE: { ids, criteria: ["composite"], e: comp },
  };
}

/**
 * The reports of a family that meet every error budget E_k ≤ q_k N (N = 0 passes): their number, the exact
 * optimum among them (exactOptimum with q), or empty; the members themselves when the base family has at most
 * 5,000 reports. Refuses families above the enumeration budget.
 */
export function budgetFamily(E: ErrorArray, options: BudgetFamilyOptions): BudgetFamily {
  const o = readOptions<BudgetFamilyOptions>(options, ["tau", "w", "family", "q", "tieTol", "maxTies"], "budgetFamily", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const { n } = P;
  const family = o.family ?? { kind: "all" };
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "budgetFamily");
  const q = readBudgetVector(o.q, P.K);
  const r = exactOptimum(E, { tau, w: P.w, family, q, tieTol, maxTies });
  const base = familyInfo(n, family);
  const size = Number(r.family.size);
  let members: Grade[] | null = null;
  if (base.sizeExact !== 0n && base.sizeExact <= BigInt(CLOUD_POINTS_LIMIT)) {
    checkEnumerable(n, base, family);
    const active: number[] = [];
    q.forEach((x, k) => x !== null && active.push(k));
    const walker = createWalker(n, family, active.map((k) => P.ek[k]));
    members = [];
    while (walker.next()) {
      let ok = true;
      for (let s = 0; s < active.length && ok; s += 1) if (walker.sum(s) > (q[active[s]] as number) * walker.N + BUDGET_TOL) ok = false;
      if (ok) members.push(Array.from(walker.g));
    }
    if (members.length !== size) throw new Error("internal: budget member count disagrees with exactOptimum");
  }
  return {
    empty: r.empty,
    size,
    baseSize: base.size,
    family: r.family,
    optimum: r.empty ? null : r,
    members,
    containsAllWithheld: !r.empty && familyHasAllWithheld(n, family),
    label: "exact-within-family",
  };
}

/**
 * Budget rows E_k ≤ q_k N for a displayed report (a feasibility check, not an optimization): one row per
 * criterion with a budget (q_k ≥ 0; null or undefined = none), with E_k, N, q_k N, E_k/N, slack and whether it
 * is met (absolute tolerance 1e-12, as exactOptimum; N = 0 passes).
 */
export function budgetCheck(g: ArrayLike<number>, E: ErrorArray, q: readonly (number | null | undefined)[]): BudgetCheck {
  const P = prepared(E);
  if (!Array.isArray(q)) throw new RangeError(`q must hold ${P.K} budgets (null for none)`);
  const budgets = readBudgetVector(q, P.K);
  const ev = evaluateReport(g, E, { tau: 0.5, w: P.w });
  const ids = criterionIds(E, P.K);
  const rows: BudgetRow[] = [];
  budgets.forEach((qk, k) => {
    if (qk === null) return;
    const qN = qk * ev.N;
    rows.push({ k, criterion: ids[k], q: qk, E: ev.E[k], N: ev.N, qN, EoverN: ev.EoverN[k], slack: qN - ev.E[k], meets: ev.E[k] <= qN + BUDGET_TOL });
  });
  return { rows, meets: rows.every((r) => r.meets) };
}

/**
 * The weighted risk read as a criterion mixture (ch. 11 prp-criterion-mixture): Σ_k w_k R_k, the risk of a
 * criterion drawn with probabilities w, beside evaluateReport's risk (they agree up to rounding).
 */
export function criterionMixtureRisk(g: ArrayLike<number>, E: ErrorArray, options: { tau: number; w?: readonly number[] }): CriterionMixtureRisk {
  readOptions(options, ["tau", "w"], "criterionMixtureRisk", true);
  const ev: ReportEvaluation = evaluateReport(g, E, options);
  const w = checkWeights(options?.w, ev.Rk.length);
  const acc = new Accumulator();
  ev.Rk.forEach((r, k) => acc.add(w[k] * r));
  return { risk: acc.value, Rk: ev.Rk, w, weightedRisk: ev.risk, difference: acc.value - ev.risk };
}

/**
 * Weighted and expected-criterion minimax choices within an enumerable family (ch. 13): the weighted optimum
 * (exactOptimum) and the report minimizing max_{k ∈ K+} R_k, with every report's criterion risks when the
 * family has at most 5,000 reports. K+ (`criteria`, indices or ids) defaults to every criterion, as
 * postrank_settings(minimax_criteria = NULL): a criterion with weight 0 still counts. Tied optima are listed up
 * to maxTies (tieCount counts them all). An empty family returns `{ empty: true, family }`.
 */
export function minimaxChoice(E: ErrorArray, options: MinimaxOptions): MinimaxChoice | EmptyResult<"exact-within-family"> {
  const o = readOptions<MinimaxOptions>(options, ["tau", "w", "family", "criteria", "tieTol", "maxTies"], "minimaxChoice", true);
  const tau = checkTau(o.tau);
  const P = prepare(E, o.w);
  const { n, K, M } = P;
  const family = o.family ?? { kind: "all" };
  const tieTol = checkTol(o.tieTol, "tieTol");
  const maxTies = checkMaxTies(o.maxTies, "minimaxChoice");
  const info = familyInfo(n, family);
  if (info.sizeExact === 0n) return emptyResult(info, "exact-within-family");
  checkEnumerable(n, info, family);
  const ids = criterionIds(E, K);
  let included: number[];
  if (o.criteria === undefined) included = Array.from({ length: K }, (_, k) => k);
  else {
    const c = o.criteria;
    if (!Array.isArray(c) || c.length < 1) throw new RangeError("criteria must list at least one criterion (index or id)");
    const set = new Set<number>();
    for (const x of c) {
      const k = typeof x === "string" ? ids.indexOf(x) : x;
      if (!Number.isInteger(k) || k < 0 || k >= K) throw new RangeError(`unknown criterion ${String(x)}`);
      set.add(k);
    }
    included = [...set].sort((x, y) => x - y);
  }
  const weighted = exactOptimum(E, { tau, w: P.w, family, tieTol, maxTies }) as ExactOptimum;
  const withList = info.sizeExact <= BigInt(CLOUD_POINTS_LIMIT);
  const reports: MinimaxReport[] | null = withList ? [] : null;
  const walker = createWalker(n, family, P.ek);
  // max R_k is on the risk scale already, so the tie tolerance is tieTol itself
  const ties = new TieCollector(n, tieTol);
  const Rk = new Float64Array(K);
  while (walker.next()) {
    const withheld = tau * (M - walker.N);
    let max = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < K; k += 1) Rk[k] = (walker.sum(k) + withheld) / M;
    for (const k of included) if (Rk[k] > max) max = Rk[k];
    if (reports) {
      const acc = new Accumulator();
      for (let k = 0; k < K; k += 1) acc.add(P.w[k] * Rk[k]);
      reports.push({ grade: Array.from(walker.g), N: walker.N, Rk: Array.from(Rk), max, weighted: acc.value });
    }
    ties.push(walker.g, max);
  }
  const grades = ties.first(maxTies);
  const ev = evaluateReport(grades[0], E, { tau, w: P.w });
  const maxOf = (r: readonly number[]) => Math.max(...included.map((k) => r[k]));
  return {
    empty: false,
    family: info,
    tau,
    w: P.w,
    included,
    reports,
    weighted: { grade: weighted.grade, grades: weighted.grades, tieCount: weighted.tieCount, risk: weighted.risk, Rk: weighted.evaluation.Rk, max: maxOf(weighted.evaluation.Rk) },
    minimax: { grade: grades[0], grades, tieCount: ties.count(), value: maxOf(ev.Rk), Rk: ev.Rk, weightedRisk: ev.risk },
    containsAllWithheld: familyHasAllWithheld(n, family),
    tieTol,
    label: "exact-within-family",
  };
}

/**
 * K = 2: the first-criterion weight w at which a fixed report's weighted risk w R_1 + (1 − w) R_2 equals τ,
 * w = (E_2 − τN)/(E_2 − E_1). Null when the crossing is not in the open interval (0, 1), or when the risk does
 * not depend on w (E_1 = E_2, for example the all-withheld report, whose risk is τ for every w).
 */
export function weightCrossing(g: ArrayLike<number>, E: ErrorArray, options: WeightCrossingOptions): number | null {
  const o = readOptions<WeightCrossingOptions>(options, ["tau"], "weightCrossing", true);
  const tau = checkTau(o.tau);
  const K = Array.isArray(E?.e) ? E.e.length : 0;
  if (K !== 2) throw new RangeError("weightCrossing needs two criteria (K = 2)");
  const ev = evaluateReport(reportGrade(g), E, { tau, w: [0.5, 0.5] });
  const d1 = ev.E[0] - tau * ev.N;
  const d2 = ev.E[1] - tau * ev.N;
  if (d1 === d2) return null;
  const w = d2 / (d2 - d1);
  return w > 0 && w < 1 ? w : null;
}

