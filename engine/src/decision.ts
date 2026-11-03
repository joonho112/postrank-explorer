// Native decision objectives and rule diagnostics, independent of DOM/rendering.
// Contracts: engine/API.md Part 3 supplement; public theory book chapters16–19.
import { type ErrorArray, drawErrors } from "./pairwise.ts";
import { pairCount, reportGrade } from "./report.ts";
import { evaluateReport, krwRisk } from "./risk.ts";
import { weightedError } from "./multi.ts";
import { mcse } from "./simulate.ts";
import { summaryStats } from "./summaries.ts";
import { readOptions } from "./options.ts";

export interface TierSizeDistribution {
  n: number; G: number; M: number; totalPatterns: number;
  distribution: { N: number; withheld: number; count: number; probability: number }[];
  maxN: number; maxShare: number; balancedSizes: number[];
}
export function tierSizeDistribution(n: number, G: number): TierSizeDistribution {
  if (!Number.isInteger(n) || n < 2 || n > 30 || !Number.isInteger(G) || G < 1 || G > n)
    throw new RangeError("tierSizeDistribution: integer n in2..30 and G in1..n required");
  let previous = new Map<number, Map<number, number>>([[0, new Map([[0, 1]])]]);
  for (let g = 1; g <= G; g += 1) {
    const next = new Map<number, Map<number, number>>();
    for (const [used, counts] of previous) for (let size = 1; size <= n - used - (G - g); size += 1) {
      const total = used + size, loss = size * (size - 1) / 2;
      let bucket = next.get(total);
      if (!bucket) { bucket = new Map(); next.set(total, bucket); }
      for (const [withheld, count] of counts) bucket.set(withheld + loss, (bucket.get(withheld + loss) ?? 0) + count);
    }
    previous = next;
  }
  const M = pairCount(n), counts = previous.get(n)!;
  const totalPatterns = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const distribution = Array.from(counts, ([withheld, count]) => ({N: M - withheld, withheld, count, probability: count / totalPatterns})).sort((a, b) => a.N - b.N);
  const balancedSizes = Array.from({length: G}, (_, i) => Math.floor(n / G) + (i < n % G ? 1 : 0));
  const maxN = distribution[distribution.length - 1].N;
  return {n, G, M, totalPatterns, distribution, maxN, maxShare: maxN / M, balancedSizes};
}
export function reportInformation(g: ArrayLike<number>, E: ErrorArray): number {
  const value = -krwRisk(g, E, {lambda: 1});
  return value === 0 ? 0 : value;
}
export type ThresholdViolationKind = "twoWithheld" | "statedChain" | "directedCycle";
export interface ThresholdViolation { i: number; j: number; k: number; kind: ThresholdViolationKind }
export interface ThresholdViolationOptions { tau: number; w?: readonly number[]; details?: boolean }
export interface ThresholdViolations {
  n: number; M: number; tau: number; relation: number[][];
  statedPairs: {above: number; below: number; error: number}[]; statedCount: number; aboveCounts: number[];
  triples: number; invalidCount: number; counts: Record<ThresholdViolationKind, number>; printable: boolean;
  unitIncidence: number[]; pairIncidence: number[][]; violations: ThresholdViolation[] | null;
}
export function thresholdViolations(E: ErrorArray, options: ThresholdViolationOptions): ThresholdViolations {
  const o = readOptions<ThresholdViolationOptions>(options, ["tau", "w", "details"], "thresholdViolations", true);
  if (!Number.isFinite(o.tau) || o.tau < 0 || o.tau > .5) throw new RangeError("thresholdViolations: tau must be in[0,.5]");
  if (o.details !== undefined && typeof o.details !== "boolean") throw new TypeError("thresholdViolations: details must be boolean");
  const e = weightedError(E, o.w), n = e.length, M = pairCount(n);
  const relation = Array.from({length: n}, () => Array<number>(n).fill(0));
  const statedPairs: ThresholdViolations["statedPairs"] = [];
  const aboveCounts = Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    const a = e[i][j] < o.tau, b = e[j][i] < o.tau;
    if (a && b) throw new RangeError("thresholdViolations: both directions qualify for one pair");
    const r = a ? 1 : b ? -1 : 0; relation[i][j] = r; relation[j][i] = -r;
    if (r) {
      const above = a ? i : j;
      statedPairs.push({above, below: a ? j : i, error: a ? e[i][j] : e[j][i]});
      aboveCounts[above] += 1;
    }
  }
  const counts = {twoWithheld: 0, statedChain: 0, directedCycle: 0};
  const violations: ThresholdViolation[] | null = o.details ? [] : null;
  const unitIncidence = Array<number>(n).fill(0), pairIncidence = Array.from({length: n}, () => Array<number>(n).fill(0));
  let triples = 0, invalidCount = 0;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) for (let k = j + 1; k < n; k += 1) {
    triples += 1;
    const a = relation[i][j], b = relation[j][k], c = relation[i][k];
    const stated = Number(a !== 0) + Number(b !== 0) + Number(c !== 0);
    let kind: ThresholdViolationKind | null = null;
    if (stated === 1) kind = "twoWithheld";
    else if (stated === 2) {
      // The only valid two-edge patterns have a common source or a common sink.
      if ((c === 0 && a === b) || (b === 0 && a === -c) || (a === 0 && b === -c)) kind = "statedChain";
    } else if (stated === 3 && a === b && a === -c) kind = "directedCycle";
    if (kind !== null) {
      invalidCount += 1; counts[kind] += 1; violations?.push({i, j, k, kind});
      for (const u of [i, j, k]) unitIncidence[u] += 1;
      for (const [u, v] of [[i, j], [i, k], [j, k]]) { pairIncidence[u][v] += 1; pairIncidence[v][u] += 1; }
    }
  }
  return {n, M, tau: o.tau, relation, statedPairs, statedCount: statedPairs.length, aboveCounts, triples, invalidCount, counts, printable: invalidCount === 0, unitIncidence, pairIncidence, violations};
}
export interface CompareReportLossOptions { tau: number; w?: readonly number[]; tieTol?: number }
export interface ComparedReportLosses {
  lossBest: number[]; lossRule: number[]; delta: number[]; meanBest: number; meanRule: number; meanDelta: number;
  mcseDelta: number | null; ruleWins: number; bestWins: number; ties: number;
  ruleWinShare: number; bestWinShare: number; tieShare: number; S: number; tieTol: number;
}
export function compareReportLosses(gBest: ArrayLike<number>, gRule: ArrayLike<number>, draws: readonly (readonly number[] | readonly (readonly number[])[])[], options: CompareReportLossOptions): ComparedReportLosses {
  const o = readOptions<CompareReportLossOptions>(options, ["tau", "w", "tieTol"], "compareReportLosses", true);
  const tieTol = o.tieTol ?? 1e-12;
  if (!Number.isFinite(tieTol) || tieTol < 0) throw new RangeError("compareReportLosses: tieTol must be finite and nonnegative");
  if (!Array.isArray(draws) || draws.length < 1) throw new RangeError("compareReportLosses: nonempty whole-state draws required");
  const g0 = reportGrade(gBest), g1 = reportGrade(gRule, g0.length);
  const lossBest: number[] = [], lossRule: number[] = [];
  for (const state of draws) {
    const E = drawErrors([state]);
    lossBest.push(evaluateReport(g0, E, {tau: o.tau, w: o.w}).risk);
    lossRule.push(evaluateReport(g1, E, {tau: o.tau, w: o.w}).risk);
  }
  const delta = lossRule.map((v, i) => v - lossBest[i]), S = draws.length;
  const ruleWins = delta.filter(v => v < -tieTol).length, bestWins = delta.filter(v => v > tieTol).length, ties = S - ruleWins - bestWins;
  return {lossBest, lossRule, delta, meanBest: summaryStats(lossBest).mean, meanRule: summaryStats(lossRule).mean,
    meanDelta: summaryStats(delta).mean, mcseDelta: mcse(delta), ruleWins, bestWins, ties, ruleWinShare: ruleWins / S, bestWinShare: bestWins / S, tieShare: ties / S, S, tieTol};
}
export interface AllocationOptions { values: readonly number[]; pTop: readonly number[]; budget: number }
export interface AllocationValue {
  inclusion: number[]; expectedValue: number; expectedOverlap: number; overlapShare: number | null;
  selectedCount: number; budget: number; boundaryGrade: number | null; boundaryMembers: number[];
  boundarySize: number; remaining: number; aboveCount: number;
}
export function allocationValue(g: ArrayLike<number>, options: AllocationOptions): AllocationValue {
  const o = readOptions<AllocationOptions>(options, ["values", "pTop", "budget"], "allocationValue", true);
  const grade = reportGrade(g), n = grade.length, b = o.budget;
  if (!Array.isArray(o.values) || o.values.length !== n || !o.values.every(Number.isFinite)) throw new RangeError("allocationValue: n finite values required");
  if (!Array.isArray(o.pTop) || o.pTop.length !== n || !o.pTop.every(p => Number.isFinite(p) && p >= 0 && p <= 1)) throw new RangeError("allocationValue: n probabilities in[0,1] required");
  if (!Number.isInteger(b) || b < 0 || b > n) throw new RangeError("allocationValue: integer budget in0..n required");
  if (Math.abs(o.pTop.reduce((a, v) => a + v, 0) - b) > 1e-10 * Math.max(1, n)) throw new RangeError("allocationValue: exact-cardinality pTop must sum to budget");
  const inclusion = Array<number>(n).fill(0);
  let boundaryGrade: number | null = null, boundaryMembers: number[] = [], remaining = 0, aboveCount = 0;
  if (b > 0) for (let h = 1; h <= Math.max(...grade); h += 1) {
    const members = grade.flatMap((v, i) => v === h ? [i] : []);
    if (aboveCount + members.length >= b) {
      boundaryGrade = h; boundaryMembers = members; remaining = b - aboveCount;
      for (const i of members) inclusion[i] = remaining / members.length;
      break;
    }
    for (const i of members) inclusion[i] = 1;
    aboveCount += members.length;
  }
  const expectedValue = inclusion.reduce((sum, q, i) => sum + q * o.values[i], 0);
  const expectedOverlap = inclusion.reduce((sum, q, i) => sum + q * o.pTop[i], 0);
  return {inclusion, expectedValue, expectedOverlap, overlapShare: b === 0 ? null : expectedOverlap / b,
    selectedCount: inclusion.reduce((a, v) => a + v, 0), budget: b, boundaryGrade, boundaryMembers, boundarySize: boundaryMembers.length, remaining, aboveCount};
}
export interface ClassificationOptions { falsePositiveCost: number; falseNegativeCost: number; positive?: readonly (boolean | number)[]; values?: readonly number[] }
export interface ThresholdClassification {
  positive: boolean[]; bayesPositive: boolean[]; positiveCount: number; cutoff: number;
  positiveCost: number[]; negativeCost: number[]; expectedFalsePositives: number; expectedFalseNegatives: number;
  totalCost: number; meanCost: number; selectedValue: number | null;
}
export function thresholdClassification(probabilities: readonly number[], options: ClassificationOptions): ThresholdClassification {
  const o = readOptions<ClassificationOptions>(options, ["falsePositiveCost", "falseNegativeCost", "positive", "values"], "thresholdClassification", true);
  if (!Array.isArray(probabilities) || !probabilities.length || !probabilities.every(p => Number.isFinite(p) && p >= 0 && p <= 1)) throw new RangeError("thresholdClassification: nonempty probabilities in[0,1] required");
  const fp = o.falsePositiveCost, fn = o.falseNegativeCost;
  if (!Number.isFinite(fp) || !Number.isFinite(fn) || fp < 0 || fn < 0 || !Number.isFinite(fp + fn) || fp + fn <= 0) throw new RangeError("thresholdClassification: finite nonnegative costs with positive sum required");
  const cutoff = fp / (fp + fn), bayesPositive = probabilities.map(p => p >= cutoff);
  if (o.positive !== undefined && (!Array.isArray(o.positive) || o.positive.length !== probabilities.length || !o.positive.every(v => typeof v === "boolean" || v === 0 || v === 1))) throw new RangeError("thresholdClassification: positive must be a matching boolean or0/1 vector");
  const positive = o.positive === undefined ? bayesPositive.slice() : o.positive.map(Boolean);
  if (o.values !== undefined && (!Array.isArray(o.values) || o.values.length !== probabilities.length || !o.values.every(Number.isFinite))) throw new RangeError("thresholdClassification: values must be matching finite values");
  const selectedValue = o.values === undefined ? null : o.values.reduce((sum, value, i) => sum + (positive[i] ? value : 0), 0);
  const positiveCost = probabilities.map(p => fp * (1 - p)), negativeCost = probabilities.map(p => fn * p);
  const expectedFalsePositives = probabilities.reduce((sum, p, i) => sum + (positive[i] ? 1 - p : 0), 0);
  const expectedFalseNegatives = probabilities.reduce((sum, p, i) => sum + (positive[i] ? 0 : p), 0);
  const totalCost = fp * expectedFalsePositives + fn * expectedFalseNegatives;
  return {positive, bayesPositive, positiveCount: positive.filter(Boolean).length, cutoff, positiveCost, negativeCost,
    expectedFalsePositives, expectedFalseNegatives, totalCost, meanCost: totalCost / probabilities.length, selectedValue};
}
