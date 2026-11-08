// Scalar KRW/postrank correspondence under one declared tie-free law (theory book ch. 10).
// Coefficient consistency cannot establish the latent-law declaration.
import { type ErrorArray, checkCube, errorCube } from "./pairwise.ts";
import { type Family, type Grade } from "./report.ts";
import { type KrwOptions, evaluateReport, krwRisk, lambdaToTau, tauToLambda } from "./risk.ts";
import { type EmptyOptimum, type ExactOptimum, type FamilyLabel, enumerateReports, exactOptimum } from "./optimize.ts";
import { readOptions } from "./options.ts";

export type KrwAxis = { lambda: number; tau?: never } | { tau: number; lambda?: never };

export interface KrwBridgeParameters {
  lambda: number;
  tau: number;
  cut: number;
  informedShare: number;
  /** Can overflow to +Infinity for positive subnormal lambda. */
  slope: number;
}

export type KrwCorrespondenceOptions = KrwAxis & {
  family?: Family;
  tieTol?: number;
  maxTies?: number;
  /** Scientific declaration, not inferred from reverse-complement consistency. */
  tieFree: true;
  t?: KrwOptions["t"];
};

export interface KrwMinimizers {
  grade: Grade;
  grades: Grade[];
  tieCount: number;
  minRisk: number;
  /** postrank's risk-scale tie tolerance divided by 1 - tau. */
  tieTol: number;
}

export interface KrwCorrespondence {
  parameters: KrwBridgeParameters;
  family: FamilyLabel;
  reportsEnumerated: number;
  postrank: ExactOptimum | EmptyOptimum;
  krw: KrwMinimizers | null;
  /** Complete minimizing sets are compared before either returned list is truncated. */
  sameFullSet: boolean | null;
  maxAffineResidual: number | null;
}

function parametersOf(axis: KrwAxis, fn: string): KrwBridgeParameters {
  const hasLambda = axis.lambda !== undefined;
  const hasTau = axis.tau !== undefined;
  if (hasLambda === hasTau) throw new RangeError(`${fn}: give exactly one numeric axis, lambda or tau`);
  let lambda: number;
  let tau: number;
  if (hasLambda) {
    lambda = axis.lambda as number;
    if (typeof lambda !== "number" || !Number.isFinite(lambda)) throw new RangeError(`${fn}: lambda must be finite and in (0, 1]`);
    tau = lambdaToTau(lambda);
  } else {
    tau = axis.tau as number;
    if (typeof tau !== "number" || !Number.isFinite(tau)) throw new RangeError(`${fn}: tau must be finite and in (0, 1/2]`);
    lambda = tauToLambda(tau);
  }
  return { lambda, tau, cut: 1 / (1 + lambda), informedShare: 1 - 2 * tau, slope: (1 - lambda) / lambda };
}

/** Positive-axis conversion, the isolated-pair cut, and the stipulated informed-audience share. No rounding. */
export function krwBridgeParameters(axis: KrwAxis): KrwBridgeParameters {
  return parametersOf(readOptions<KrwAxis>(axis, ["lambda", "tau"], "krwBridgeParameters", true), "krwBridgeParameters");
}

/** Independently score both objectives over the complete same family, with KRW's scaled tie tolerance. */
export function krwCorrespondence(E: ErrorArray, options: KrwCorrespondenceOptions): KrwCorrespondence {
  const o = readOptions<KrwCorrespondenceOptions>(options, ["lambda", "tau", "family", "tieTol", "maxTies", "tieFree", "t"], "krwCorrespondence", true);
  const parameters = parametersOf(o, "krwCorrespondence");
  if (o.tieFree !== true) throw new RangeError("krwCorrespondence requires explicit tieFree: true");
  if (o.tieTol !== undefined && (typeof o.tieTol !== "number" || !Number.isFinite(o.tieTol) || o.tieTol < 0)) {
    throw new RangeError("krwCorrespondence: tieTol must be a finite number ≥ 0");
  }
  if (o.maxTies !== undefined && (!Number.isSafeInteger(o.maxTies) || o.maxTies < 1)) {
    throw new RangeError("krwCorrespondence: maxTies must be a positive integer");
  }
  const { n, K, e } = errorCube(E);
  if (K !== 1) throw new RangeError("krwCorrespondence takes one criterion (K = 1)");
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) {
    if (e[0][i][j] < 0 || e[0][i][j] > 1) throw new RangeError("krwCorrespondence: off-diagonal probabilities must lie in [0, 1]");
    if (j > i && Math.abs(e[0][i][j] + e[0][j][i] - 1) > 1e-12) {
      throw new RangeError("krwCorrespondence: reverse probabilities must be complements within 1e-12");
    }
  }
  const krwOptions: KrwOptions = { lambda: parameters.lambda };
  if (o.t !== undefined) {
    const shape = checkCube(o.t, "t");
    if (shape.n !== n || shape.K !== K) throw new RangeError("krwCorrespondence: t must have the same shape as E.e");
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j && (o.t[0][i][j] < 0 || o.t[0][i][j] > 1)) {
      throw new RangeError("krwCorrespondence: off-diagonal equality probabilities must lie in [0, 1]");
    }
    // Use the public scorer's equality check even when the requested family is empty.
    krwRisk(new Array<number>(n).fill(1), E, { ...krwOptions, t: o.t });
    krwOptions.t = o.t;
  }
  const family = o.family ?? { kind: "all" };
  const { tau } = parameters;
  // The optimizer's actual Z-scale collector defines postrank membership. Its representative can have a
  // slightly larger risk than the raw minimum, and re-scoring on the risk scale can round differently.
  const completePostrank = exactOptimum(E, { tau, family, tieTol: o.tieTol, maxTies: Infinity });
  if (completePostrank.empty) return { parameters, family: completePostrank.family, reportsEnumerated: 0, postrank: completePostrank, krw: null, sameFullSet: null, maxAffineResidual: null };
  const maxTies = o.maxTies ?? 100;
  const postrank = { ...completePostrank, grades: completePostrank.grades.slice(0, maxTies) };

  // A bounded score buffer preserves raw KRW values without materializing every family report.
  const total = Number(postrank.family.size);
  const krwRisks = new Float64Array(total);
  let reportsEnumerated = 0;
  let minKrw = Infinity;
  let maxAffineResidual = 0;
  for (const grade of enumerateReports(n, family, { reuse: true })) {
    const pr = evaluateReport(grade, E, { tau }).risk;
    const kr = krwRisk(grade, E, krwOptions);
    krwRisks[reportsEnumerated] = kr;
    ++reportsEnumerated;
    if (kr < minKrw) minKrw = kr;
    maxAffineResidual = Math.max(maxAffineResidual, Math.abs(pr - (tau + (1 - tau) * kr)));
  }
  const tieTol = postrank.tieTol / (1 - tau);
  const grades: Grade[] = [];
  let tieCount = 0;
  let sameFullSet = true;
  let q = 0;
  let p = 0;
  for (const grade of enumerateReports(n, family, { reuse: true })) {
    const krwMember = krwRisks[q] - minKrw <= tieTol;
    const nextPostrank = completePostrank.grades[p];
    const postrankMember = nextPostrank !== undefined && grade.every((value, i) => value === nextPostrank[i]);
    if (postrankMember) ++p;
    if (krwMember !== postrankMember) sameFullSet = false;
    if (krwMember) {
      ++tieCount;
      if (grades.length < maxTies) grades.push(Array.from(grade));
    }
    ++q;
  }
  return {
    parameters, family: postrank.family, reportsEnumerated, postrank,
    krw: { grade: grades[0], grades, tieCount, minRisk: minKrw, tieTol }, sameFullSet, maxAffineResidual,
  };
}
