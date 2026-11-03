// Additive Part 4 helpers: a declared independent Normal composite, the full fixed-report risk difference,
// and estimated/exact protection sets. Numerical contracts: engine/API.md (4, 5, 7).
// Protection coefficients are checked for shape, matching labels and range [0, 1], not joint-law realizability.
// A coefficient tolerance is advisory; actual set inclusions are always checked from every family member.

import { Accumulator, type ErrorArray, checkWeights, errorCube, nanMatrix, resolveLabels, weighted } from "./pairwise.ts";
import { type Family, type Grade, type RelationChange, relationChange, reportGrade } from "./report.ts";
import { type ReportEvaluation, type RiskOptions, checkTau, evaluateReport } from "./risk.ts";
import { type FamilyLabel, checkEnumerable, createWalker, familyInfo } from "./optimize.ts";
import { readOptions } from "./options.ts";
import { normalCdf } from "./special.ts";

export interface NormalCompositeOptions {
  /** General finite coefficients; they need not be nonnegative or sum to one. */
  a: readonly number[];
  /** Positive rescaling of each criterion; default all 1. */
  multiplier?: readonly number[];
  ids?: readonly string[];
}

export interface NormalComposite {
  mean: number[];
  sd: number[];
  /** One weak-error criterion named composite, under the declared independent Normal joint law. */
  E: ErrorArray;
}

export interface CompareReportsOptions extends RiskOptions {}

export interface CompareReportPair {
  i: number;
  j: number;
  /** +1: i above j, 0: withheld, −1: i below j. */
  beforeRelation: -1 | 0 | 1;
  afterRelation: -1 | 0 | 1;
  beforeCost: number;
  afterCost: number;
  costDifference: number;
  normalizedDifference: number;
}

export interface CompareReports {
  before: ReportEvaluation;
  after: ReportEvaluation;
  deltaRisk: number;
  errorTermDelta: number;
  withholdingTermDelta: number;
  change: RelationChange;
  /** Every changed unordered pair, ordered by i then j. */
  pairs: CompareReportPair[];
}

export interface ProtectionEnvelopeOptions extends RiskOptions {
  q: readonly (number | null)[];
  /** Proposed coefficient envelope radius, a scalar broadcast or a length-K vector. */
  epsilon: number | readonly number[];
  family?: Family;
  /** Nonnegative absolute tolerance in count units; default 0 (raw homogeneous tests). */
  feasibilityTol?: number;
  /** Advisory coefficient comparison tolerance; default 1e-12. */
  coefficientTol?: number;
}

export interface ProtectionMembership {
  inner: boolean;
  nominal: boolean;
  exact: boolean;
  outer: boolean;
}

export interface ProtectionSlack {
  inner: (number | null)[];
  nominal: (number | null)[];
  exact: (number | null)[];
  outer: (number | null)[];
}

export interface ProtectionEnvelopeRow {
  grade: Grade;
  N: number;
  estimated: ReportEvaluation;
  exact: ReportEvaluation;
  membership: ProtectionMembership;
  /** threshold * N − expected wrong count, null on unprotected criteria; thresholds are never clipped. */
  slack: ProtectionSlack;
}

export interface CoefficientCheck {
  /** Maximum absolute directional coefficient error for every criterion, including zero-weight ones. */
  maxAbs: number[];
  /** maxAbs[k] − epsilon[k], without rounding. */
  excess: number[];
  strictEnvelopeHolds: boolean;
  /** An advisory numerical comparison, not a certificate of either actual set inclusion. */
  withinCoefficientTolerance: boolean;
  coefficientTol: number;
}

export interface ActualBracketInclusions {
  innerSubsetExact: boolean;
  exactSubsetOuter: boolean;
  innerSubsetNominal: boolean;
  nominalSubsetOuter: boolean;
  /** Lexicographically first counterexample, or null. */
  counterexampleInnerExact: Grade | null;
  counterexampleExactOuter: Grade | null;
}

export interface ProtectionEnvelopes {
  family: FamilyLabel;
  tau: number;
  w: number[];
  q: (number | null)[];
  epsilon: number[];
  innerThreshold: (number | null)[];
  outerThreshold: (number | null)[];
  feasibilityTol: number;
  coefficientCheck: CoefficientCheck;
  actualBracketInclusions: ActualBracketInclusions;
  counts: { inner: number; nominal: number; exact: number; outer: number };
  empty: ProtectionMembership;
  rows: ProtectionEnvelopeRow[];
}

/** Read a rectangular numerical n × K array. Unlike the ordinary one-criterion table shorthand, rows are
 * required so the independent-criterion axes are explicit. Typed numeric rows are also accepted. */
function rectangular(x: readonly ArrayLike<number>[], name: string): { n: number; K: number } {
  if (!Array.isArray(x) || x.length < 2) throw new RangeError(`${name} must be a rectangular array with at least two units`);
  const K = x[0]?.length;
  if (!Number.isSafeInteger(K) || K < 1) throw new RangeError(`${name} must have at least one criterion per unit`);
  for (let i = 0; i < x.length; i += 1) {
    const row = x[i];
    if (row === null || typeof row !== "object" || row.length !== K) throw new RangeError(`${name}[${i}] must have ${K} criterion values`);
    for (let k = 0; k < K; k += 1) {
      if (typeof row[k] !== "number" || !Number.isFinite(row[k])) throw new RangeError(`${name} must contain finite numbers only`);
    }
  }
  return { n: x.length, K };
}

function nonnegativeTolerance(x: number | undefined, fallback: number, name: string): number {
  const v = x === undefined ? fallback : x;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a finite number ≥ 0`);
  return v;
}

/**
 * Composite of explicitly INDEPENDENT Normals: independent units and independent criteria within each unit.
 * mean_i = sum a_k multiplier_k means_ik; sd_i² = sum (a_k multiplier_k sds_ik)².
 * Independence is a caller declaration, never inferred from marginal error arrays. Zero-SD point masses use
 * the weak event mean_i ≤ mean_j, including error 1 in both directions when deterministic means are equal.
 */
export function normalComposite(
  means: readonly ArrayLike<number>[],
  sds: readonly ArrayLike<number>[],
  options: NormalCompositeOptions,
): NormalComposite {
  const o = readOptions<NormalCompositeOptions>(options, ["a", "multiplier", "ids"], "normalComposite", true);
  const { n, K } = rectangular(means, "means");
  const shape = rectangular(sds, "sds");
  if (shape.n !== n || shape.K !== K) throw new RangeError(`sds must be ${n} units × ${K} criteria, as means`);
  const a = o.a;
  if (!Array.isArray(a) || a.length !== K || !a.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new RangeError(`a must hold ${K} finite composite coefficients`);
  }
  const multiplier = o.multiplier === undefined ? new Array<number>(K).fill(1) : o.multiplier;
  if (!Array.isArray(multiplier) || multiplier.length !== K || !multiplier.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)) {
    throw new RangeError(`multiplier must hold ${K} finite positive multipliers`);
  }
  const { ids } = resolveLabels({ ids: o.ids }, n, 1);
  const mean: number[] = [];
  const sd: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const m = new Accumulator();
    const variance = new Accumulator();
    for (let k = 0; k < K; k += 1) {
      if (sds[i][k] < 0) throw new RangeError("sds must contain SDs ≥ 0");
      const coefficient = a[k] * multiplier[k];
      m.add(coefficient * means[i][k]);
      const componentSd = coefficient * sds[i][k];
      variance.add(componentSd * componentSd);
    }
    mean.push(m.value);
    sd.push(Math.sqrt(variance.value));
    if (!Number.isFinite(mean[i]) || !Number.isFinite(sd[i])) throw new RangeError("normalComposite: composite mean and SD must remain finite");
  }
  const e = nanMatrix(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const differenceSd = Math.hypot(sd[i], sd[j]);
      e[i][j] = differenceSd === 0 ? Number(mean[i] <= mean[j]) : normalCdf((mean[j] - mean[i]) / differenceSd);
    }
  }
  return { mean, sd, E: { ids, criteria: ["composite"], e: [e] } };
}

/** Full risk accounting for two fixed reports under the same supplied coefficients and loss. The difference
 * can be negative; this helper supplies no baseline-optimality or causal certificate. */
export function compareReports(
  g0: ArrayLike<number>,
  g1: ArrayLike<number>,
  E: ErrorArray,
  options: CompareReportsOptions,
): CompareReports {
  const o = readOptions<CompareReportsOptions>(options, ["tau", "w"], "compareReports", true);
  const { n, K, e } = errorCube(E);
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  const a = reportGrade(g0, n);
  const b = reportGrade(g1, n);
  const before = evaluateReport(a, E, { tau, w });
  const after = evaluateReport(b, E, { tau, w });
  const pairs: CompareReportPair[] = [];
  const cost = (relation: number, i: number, j: number) => relation === 0 ? tau : relation > 0 ? weighted(e, w, i, j) : weighted(e, w, j, i);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const beforeRelation = Math.sign(a[j] - a[i]) as -1 | 0 | 1;
      const afterRelation = Math.sign(b[j] - b[i]) as -1 | 0 | 1;
      if (beforeRelation === afterRelation) continue;
      const beforeCost = cost(beforeRelation, i, j);
      const afterCost = cost(afterRelation, i, j);
      const costDifference = afterCost - beforeCost;
      pairs.push({ i, j, beforeRelation, afterRelation, beforeCost, afterCost, costDifference, normalizedDifference: costDifference / before.M });
    }
  }
  return {
    before,
    after,
    deltaRisk: after.risk - before.risk,
    errorTermDelta: (after.Ew - before.Ew) / before.M,
    withholdingTermDelta: tau * (before.N - after.N) / before.M,
    change: relationChange(a, b, E, { w }),
    pairs,
  };
}

/**
 * Enumerate estimated inner/nominal/outer and exact protection sets E_k(g) ≤ threshold_k N(g), with raw
 * comparisons by default. Active criteria are protected even at zero weight. The coefficient error check is
 * separate from the actual inclusions, which are computed from all family members. No probability, solver
 * certificate or joint-law validity claim is inferred from these numerical comparisons.
 */
export function protectionEnvelopes(Ehat: ErrorArray, Eexact: ErrorArray, options: ProtectionEnvelopeOptions): ProtectionEnvelopes {
  const o = readOptions<ProtectionEnvelopeOptions>(options, ["q", "epsilon", "family", "tau", "w", "feasibilityTol", "coefficientTol"], "protectionEnvelopes", true);
  const h = errorCube(Ehat, "Ehat");
  const x = errorCube(Eexact, "Eexact");
  const { n, K } = h;
  if (x.n !== n || x.K !== K) throw new RangeError("Ehat and Eexact must have matching dimensions");
  for (const [E, name] of [[Ehat, "Ehat"], [Eexact, "Eexact"]] as const) {
    if (!Array.isArray(E.ids) || !Array.isArray(E.criteria)) throw new RangeError(`${name} must have ids and criteria arrays`);
    if (!Array.from(E.ids).every((id) => typeof id === "string") || !Array.from(E.criteria).every((id) => typeof id === "string")) {
      throw new RangeError(`${name} ids and criteria must be strings`);
    }
    resolveLabels({ ids: E.ids, criteria: E.criteria }, n, K);
    for (let k = 0; k < K; k += 1) {
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          if (i !== j && (E.e[k][i][j] < 0 || E.e[k][i][j] > 1)) throw new RangeError(`${name}.e off-diagonal entries must lie in [0, 1]`);
        }
      }
    }
  }
  if (Ehat.ids.some((id, i) => id !== Eexact.ids[i]) || Ehat.criteria.some((id, k) => id !== Eexact.criteria[k])) {
    throw new RangeError("Ehat and Eexact must have matching ids and criteria in the same order");
  }
  const tau = checkTau(o.tau);
  const w = checkWeights(o.w, K);
  if (!Array.isArray(o.q) || o.q.length !== K) throw new RangeError(`q must hold ${K} protection thresholds (null for none)`);
  const q = Array.from(o.q, (v, k) => {
    if (v === null) return null;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) throw new RangeError(`q[${k}] must lie in [0, 1], or be null`);
    return v;
  });
  const radius = typeof o.epsilon === "number" ? new Array<number>(K).fill(o.epsilon) : o.epsilon;
  if (!Array.isArray(radius) || radius.length !== K || !Array.from(radius).every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
    throw new RangeError(`epsilon must be a finite nonnegative scalar or ${K} finite nonnegative radii`);
  }
  const epsilon = [...radius];
  const feasibilityTol = nonnegativeTolerance(o.feasibilityTol, 0, "feasibilityTol");
  const coefficientTol = nonnegativeTolerance(o.coefficientTol, 1e-12, "coefficientTol");
  const innerThreshold = q.map((v, k) => v === null ? null : v - epsilon[k]);
  const outerThreshold = q.map((v, k) => v === null ? null : v + epsilon[k]);
  const declaredFamily = o.family ?? { kind: "all" };
  const family = familyInfo(n, declaredFamily);
  checkEnumerable(n, family, declaredFamily);
  const maxAbs = new Array<number>(K).fill(0);
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i !== j) maxAbs[k] = Math.max(maxAbs[k], Math.abs(h.e[k][i][j] - x.e[k][i][j]));
      }
    }
  }
  const excess = maxAbs.map((v, k) => v - epsilon[k]);
  const coefficientCheck: CoefficientCheck = {
    maxAbs, excess,
    strictEnvelopeHolds: excess.every((v) => v <= 0),
    withinCoefficientTolerance: excess.every((v) => v <= coefficientTol),
    coefficientTol,
  };
  const rows: ProtectionEnvelopeRow[] = [];
  const counts = { inner: 0, nominal: 0, exact: 0, outer: 0 };
  const actualBracketInclusions: ActualBracketInclusions = {
    innerSubsetExact: true, exactSubsetOuter: true, innerSubsetNominal: true, nominalSubsetOuter: true,
    counterexampleInnerExact: null, counterexampleExactOuter: null,
  };
  if (family.sizeExact !== 0n) {
    const walker = createWalker(n, declaredFamily, []);
    while (walker.next()) {
      const grade = Array.from(walker.g);
      const estimated = evaluateReport(grade, Ehat, { tau, w });
      const exact = evaluateReport(grade, Eexact, { tau, w });
      const N = estimated.N;
      const slackFor = (threshold: (number | null)[], errors: number[]) => threshold.map((v, k) => v === null ? null : v * N - errors[k]);
      const slack: ProtectionSlack = {
        inner: slackFor(innerThreshold, estimated.E), nominal: slackFor(q, estimated.E),
        exact: slackFor(q, exact.E), outer: slackFor(outerThreshold, estimated.E),
      };
      // Use the stated E <= threshold*N + tolerance comparison directly, without division or clipping.
      const meets = (threshold: (number | null)[], errors: number[]) => threshold.every((v, k) => v === null || errors[k] <= v * N + feasibilityTol);
      const membership: ProtectionMembership = {
        inner: meets(innerThreshold, estimated.E), nominal: meets(q, estimated.E),
        exact: meets(q, exact.E), outer: meets(outerThreshold, estimated.E),
      };
      for (const key of ["inner", "nominal", "exact", "outer"] as const) if (membership[key]) counts[key] += 1;
      if (membership.inner && !membership.exact) {
        actualBracketInclusions.innerSubsetExact = false;
        if (actualBracketInclusions.counterexampleInnerExact === null) actualBracketInclusions.counterexampleInnerExact = [...grade];
      }
      if (membership.exact && !membership.outer) {
        actualBracketInclusions.exactSubsetOuter = false;
        if (actualBracketInclusions.counterexampleExactOuter === null) actualBracketInclusions.counterexampleExactOuter = [...grade];
      }
      if (membership.inner && !membership.nominal) actualBracketInclusions.innerSubsetNominal = false;
      if (membership.nominal && !membership.outer) actualBracketInclusions.nominalSubsetOuter = false;
      rows.push({ grade, N, estimated, exact, membership, slack });
    }
  }
  const empty = { inner: counts.inner === 0, nominal: counts.nominal === 0, exact: counts.exact === 0, outer: counts.outer === 0 };
  return { family, tau, w, q, epsilon, innerThreshold, outerThreshold, feasibilityTol, coefficientCheck, actualBracketInclusions, counts, empty, rows };
}
