// Step 3.27: the Part 1 supplement of engine/API.md ("v3 helpers: Part 1 supplement (Step 3.27)") and formatProb's
// `open` option (CR-008). Every example of the section (exact where the example prints the double, otherwise within
// 1e-12, relative for small values), every input check (RangeError for a bad value, TypeError for an unknown option
// key or a non-object options argument), the four extensions (new fields only; the old fields and the behaviour
// unchanged), and properties checked against references written here (Gaussian conditioning by matrix inversion for
// sharedMeanPosterior, path enumeration for chainCountLaw, direct loops for the counts).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as prCore from "../src/index.ts";
import {
  type ErrorArray, directionMatrix, drawErrors, errorArray, finiteLawCells, finiteLawMargins, leastCertainPairs, majorityWins,
  maxCoefficientError, pairDifference, pairDirection,
} from "../src/pairwise.ts";
import { claimsByDistance, evaluateReport } from "../src/risk.ts";
import { disclosure } from "../src/report.ts";
import {
  binomialMcse, chainCountLaw, chainMeanVariance, envelopeRadius, gaussianDraws, mcse, runningMean, selectionOnDraws,
  sharedMeanPosterior, withinBand,
} from "../src/simulate.ts";
import { evidenceFlags, strictOrder } from "../src/rules.ts";
import { intervalOverlapTally } from "../src/summaries.ts";
import { normalCdf, normalCoverage } from "../src/special.ts";
import { formatProb } from "../src/format.ts";
import { uniforms } from "../src/random.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const NaNd = Number.NaN;

/** An ErrorArray from n × n matrices (the diagonal is set to NaN). */
const cube = (...e: number[][][]): ErrorArray => ({
  ids: e[0].map((_, i) => String.fromCharCode(65 + i)),
  criteria: e.map((_, k) => `k${k + 1}`),
  e: e.map((m) => m.map((row, i) => row.map((x, j) => (i === j ? NaNd : x)))),
});

/** A tie-free random array on n units (e_ij + e_ji = 1) from the engine stream. */
const randomCube = (n: number, seed: number, K = 1): ErrorArray => {
  const u = uniforms(seed, n * n * K);
  const e = Array.from({ length: K }, (_, k) => {
    const m = Array.from({ length: n }, () => new Array<number>(n).fill(NaNd));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        m[i][j] = u[(k * n + i) * n + j];
        m[j][i] = 1 - m[i][j];
      }
    }
    return m;
  });
  return cube(...e);
};

/** |got − want| ≤ rel·|want| (exact when want is 0): "within 1e-12" as the example's digits allow, relative so that
 *  it also binds for the small values. */
const near = (got: number, want: number, what: string, rel = 1e-12) =>
  assert.ok(want === 0 ? got === 0 : Math.abs(got - want) <= rel * Math.abs(want), `${what}: got ${got}, want ${want} (relative tolerance ${rel})`);
const nearAll = (got: ArrayLike<number>, want: readonly number[], what: string, rel = 1e-12) => {
  assert.equal(got.length, want.length, `${what}: length`);
  want.forEach((w, i) => near(got[i], w, `${what}[${i}]`, rel));
};

const rangeError = (fn: () => unknown, message: RegExp) => assert.throws(fn, { name: "RangeError", message });
const typeError = (fn: () => unknown, message: RegExp) => assert.throws(fn, { name: "TypeError", message });

// The six sites, score A (independent normals, SD .20).
const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);

const KRW = JSON.parse(fs.readFileSync(path.join(ROOT, "data/released/case-krw.json"), "utf8"));
const krwArray = (criterion: string): ErrorArray => {
  const a = KRW.arrays.error;
  const k = a.criteria.indexOf(criterion);
  assert.ok(k >= 0, `the released array holds ${criterion}`);
  return { ids: a.ids, criteria: [criterion], e: [(a.e[k] as (number | null)[][]).map((row) => row.map((x) => (x === null ? NaNd : x)))] };
};

const PART1 = [
  "pairDifference", "normalCoverage", "withinBand", "sharedMeanPosterior", "binomialMcse", "chainCountLaw", "runningMean",
  "claimsByDistance", "finiteLawCells", "maxCoefficientError",
];

test("exports: the ten Part 1 helpers are in the public API; each has golden rows or a pending parity exemption with a reason", () => {
  for (const name of PART1) assert.equal(typeof (prCore as Record<string, unknown>)[name], "function", name);
  const exempt = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/parity-exempt.json"), "utf8"));
  const golden = path.join(ROOT, "verification/golden");
  const covered = new Set<string>();
  for (const file of fs.readdirSync(golden).filter((f) => f.endsWith(".json"))) {
    const body = JSON.parse(fs.readFileSync(path.join(golden, file), "utf8"));
    for (const row of body.rows ?? []) if (row?.args?.fn) covered.add(row.args.fn);
  }
  for (const name of PART1) {
    const pending = exempt.exempt.includes(name);
    if (pending) assert.equal(typeof exempt.reasons[name], "string", `${name}: an exemption needs a reason`);
    assert.ok(covered.has(name) || pending, `${name} has golden rows or a pending exemption`);
  }
  // the extended functions keep their existing golden rows (no exemption)
  for (const name of ["disclosure", "leastCertainPairs", "intervalOverlapTally", "majorityWins", "formatProb"]) {
    assert.ok(covered.has(name), `${name} has golden rows`);
    assert.ok(!exempt.exempt.includes(name), `${name} is not exempt`);
  }
});

// ---------------------------------------------------------------------------------------------------------
// pairDifference

test("pairDifference: the spec examples (mean, SD, z, π; corr .5; (.20, .20, .20, .40); the 3.2897 pair)", () => {
  const a = pairDifference(0.3, 0.2, 0.1, 0.2);
  assert.deepEqual(Object.keys(a), ["mean", "sd", "z", "pi"]);
  assert.equal(a.mean, 0.19999999999999998); // "in double .19999999999999998"
  near(a.sd, 0.282842712474619, "sd");
  near(a.z, 0.707106781186547, "z");
  near(a.pi, 0.760249938906523, "pi");
  assert.equal(a.pi, pairDirection(0.3, 0.2, 0.1, 0.2)); // ρ = 0: the value of pairDirection
  const b = pairDifference(0.3, 0.2, 0.1, 0.2, { corr: 0.5 });
  near(b.sd, 0.2, "sd at corr .5");
  near(b.z, 1, "z at corr .5");
  near(b.pi, 0.841344746068543, "pi at corr .5");
  const c = pairDifference(0.3, 0.2, 0.1, 0.6);
  near(c.sd, 0.632455532033676, "sd");
  near(c.z, 0.316227766016838, "z");
  near(c.pi, 0.624085182977075, "pi");
  assert.deepEqual(pairDifference(0.2, 0.2, 0.2, 0.4), { mean: 0, sd: Math.sqrt(0.2 * 0.2 + 0.4 * 0.4), z: 0, pi: 0.5 });
  const d = pairDifference(3.289707253902943, 1, 0, 1);
  near(d.sd, 1.4142135623731, "sd");
  near(d.z, 2.32617430735335, "z");
  near(d.pi, 0.989995373141941, "pi");
});

test("pairDifference: SD evaluated left to right as √(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB); π = Φ(z) = pairDirection(…, { corr }); antisymmetric", () => {
  const u = uniforms(11, 400);
  for (let q = 0; q < 100; q += 1) {
    const mA = 2 * u[4 * q] - 1;
    const mB = 2 * u[4 * q + 1] - 1;
    const sA = 0.05 + u[4 * q + 2];
    const sB = 0.05 + u[4 * q + 3];
    const corr = 1.8 * u[(4 * q + 7) % 400] - 0.9;
    const r = pairDifference(mA, sA, mB, sB, { corr });
    assert.equal(r.mean, mA - mB);
    assert.equal(r.sd, Math.sqrt(sA * sA + sB * sB - 2 * corr * sA * sB));
    assert.equal(r.z, r.mean / r.sd);
    assert.equal(r.pi, normalCdf(r.z));
    assert.equal(r.pi, pairDirection(mA, sA, mB, sB, { corr }));
    const s = pairDifference(mB, sB, mA, sA, { corr });
    near(s.sd, r.sd, "swapped SD", 1e-15); // 2·ρ·sdB·sdA and 2·ρ·sdA·sdB may round apart
    assert.ok(Math.abs(s.pi - (1 - r.pi)) <= 1e-15);
  }
  // ρ = −1 and ρ = 1 with different SDs are proper differences
  assert.equal(pairDifference(0, 0.1, 0, 0.3, { corr: -1 }).sd, Math.sqrt(0.1 * 0.1 + 0.3 * 0.3 + 2 * 0.1 * 0.3));
  near(pairDifference(0, 0.1, 0, 0.3, { corr: 1 }).sd, 0.2, "ρ = 1, SDs .1 and .3");
});

test("pairDifference: input checks", () => {
  for (const bad of [NaNd, Number.POSITIVE_INFINITY, "0.3" as never]) {
    rangeError(() => pairDifference(bad, 0.2, 0.1, 0.2), /pairDifference: meanA must be a finite number/);
    rangeError(() => pairDifference(0.3, 0.2, bad, 0.2), /pairDifference: meanB must be a finite number/);
  }
  for (const bad of [0, -0.1, NaNd, Number.POSITIVE_INFINITY, null as never]) {
    rangeError(() => pairDifference(0.3, bad, 0.1, 0.2), /pairDifference: sdA must be a finite SD > 0/);
    rangeError(() => pairDifference(0.3, 0.2, 0.1, bad), /pairDifference: sdB must be a finite SD > 0/);
  }
  for (const corr of [1.5, -1.0001, NaNd, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "0.5" as never]) {
    rangeError(() => pairDifference(0.3, 0.2, 0.1, 0.2, { corr }), /pairDifference: corr must be a number in \[−1, 1\]/);
  }
  // a degenerate difference: ρ = 1 with equal SDs
  rangeError(() => pairDifference(0.3, 0.2, 0.1, 0.2, { corr: 1 }), /SD 0/);
  typeError(() => pairDifference(0.3, 0.2, 0.1, 0.2, { rho: 0.5 } as never), /pairDifference: unknown option "rho"/);
  typeError(() => pairDifference(0.3, 0.2, 0.1, 0.2, 0.5 as never), /pairDifference: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// normalCoverage

test("normalCoverage: the spec examples (0, 1, 2), Infinity → 1, and Φ(k) − Φ(−k) = 1 − 2Φ(−k)", () => {
  assert.equal(normalCoverage(0), 0);
  assert.equal(normalCoverage(1), 0.6826894921370859);
  assert.equal(normalCoverage(2), 0.9544997361036416);
  assert.equal(normalCoverage(Number.POSITIVE_INFINITY), 1);
  assert.equal(normalCoverage(40), 1);
  for (const k of [0.1, 0.5, 1.2816, 1.6449, 1.96, 2.5758, 3, 5]) {
    assert.equal(normalCoverage(k), normalCdf(k) - normalCdf(-k));
    assert.ok(Math.abs(normalCoverage(k) - (1 - 2 * normalCdf(-k))) <= 4.5e-16, `k = ${k}`);
  }
  near(normalCoverage(1.959963984540054), 0.95, "1.96 SEs", 1e-15);
});

test("normalCoverage: input checks (k ≥ 0, finite or Infinity)", () => {
  for (const k of [-1, -1e-300, NaNd, Number.NEGATIVE_INFINITY, "1" as never, null as never, undefined as never]) {
    rangeError(() => normalCoverage(k), /normalCoverage: k must be a number ≥ 0/);
  }
});

// ---------------------------------------------------------------------------------------------------------
// withinBand

test("withinBand: the spec example (within 2 of 4; share .6826894921370859, expected 2.7307579685483434)", () => {
  const est = [0.5, 0.8, 0.1, 0.45];
  const r = withinBand(est, 0.2, { ref: 0.5 });
  assert.deepEqual(r, { within: 2, n: 4, share: 0.6826894921370859, expected: 2.7307579685483434 });
  // the z values of the example, as evidenceFlags computes them
  const flags = evidenceFlags(est, 0.2, { ref: 0.5, crit: 1 });
  assert.deepEqual(flags.z.slice(0, 3), [0, 1.5000000000000002, -2]);
  near(flags.z[3], -0.25, "z of .45", 1e-15);
  assert.equal(flags.labels.filter((x) => x === 2).length, r.within);
});

test("withinBand: the units evidenceFlags leaves unflagged; ref and se as numbers or arrays; crit 0 and the ends of the band", () => {
  const u = uniforms(5, 200);
  for (const crit of [0.5, 1, 1.96, 2.5]) {
    const est = Array.from({ length: 50 }, (_, i) => 3 * u[i] - 1.5);
    const se = Array.from({ length: 50 }, (_, i) => 0.2 + u[50 + i]);
    const r = withinBand(est, se, { ref: 0.1, crit });
    assert.equal(r.within, evidenceFlags(est, se, { ref: 0.1, crit }).labels.filter((x) => x === 2).length);
    assert.equal(r.share, normalCoverage(crit));
    assert.equal(r.expected, 50 * normalCoverage(crit));
    // a per-unit reference equal to the common one gives the same count
    assert.deepEqual(withinBand(est, se, { ref: new Array<number>(50).fill(0.1), crit }), r);
  }
  // per-unit references: each unit against its own value
  assert.equal(withinBand([1, 2, 3], [1, 1, 1], { ref: [1, 0, 3.5] }).within, 2);
  // |z| ≤ crit counts the ends; crit 0 counts only exact hits (share 0, expected 0)
  assert.equal(withinBand([0.5, 0.7, 0.3, 0.70001], 0.2, { ref: 0.5, crit: 1 }).within, 3);
  assert.deepEqual(withinBand([0.5, 0.6], 0.1, { ref: 0.5, crit: 0 }), { within: 1, n: 2, share: 0, expected: 0 });
  // default crit 1
  assert.deepEqual(withinBand([0.5, 0.8], 0.2, { ref: 0.5 }), withinBand([0.5, 0.8], 0.2, { ref: 0.5, crit: 1 }));
});

test("withinBand: input checks", () => {
  rangeError(() => withinBand([], 0.2, { ref: 0 }), /withinBand: est must be a nonempty array/);
  rangeError(() => withinBand([0.1, NaNd], 0.2, { ref: 0 }), /withinBand: est must be finite numbers/);
  for (const se of [0, -0.2, [0.2, 0]]) rangeError(() => withinBand([0.1, 0.2], se, { ref: 0 }), /withinBand: se must be > 0/);
  rangeError(() => withinBand([0.1, 0.2], NaNd, { ref: 0 }), /withinBand: se must be a finite number/);
  rangeError(() => withinBand([0.1, 0.2], [0.2, Number.POSITIVE_INFINITY], { ref: 0 }), /withinBand: se must be finite numbers/);
  rangeError(() => withinBand([0.1, 0.2], [0.2], { ref: 0 }), /withinBand: se must have 2 values/);
  rangeError(() => withinBand([0.1, 0.2], 0.2, {} as never), /withinBand: ref is required/);
  rangeError(() => withinBand([0.1, 0.2], 0.2, { ref: null } as never), /withinBand: ref is required/);
  rangeError(() => withinBand([0.1, 0.2], 0.2, { ref: NaNd }), /withinBand: ref must be a finite number/);
  rangeError(() => withinBand([0.1, 0.2], 0.2, { ref: [0, 0, 0] }), /withinBand: ref must have 2 values/);
  for (const crit of [-1, NaNd, Number.POSITIVE_INFINITY, "1" as never]) {
    rangeError(() => withinBand([0.1, 0.2], 0.2, { ref: 0, crit }), /withinBand: crit must be a finite number ≥ 0/);
  }
  typeError(() => withinBand([0.1, 0.2], 0.2, { ref: 0, tau: 0.2 } as never), /withinBand: unknown option "tau"/);
  typeError(() => withinBand([0.1, 0.2], 0.2, undefined as never), /withinBand: options object expected/);
  typeError(() => withinBand([0.1, 0.2], 0.2, 0.5 as never), /withinBand: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// sharedMeanPosterior

/** Inverse of a small square matrix (Gauss–Jordan with partial pivoting). */
function inverse(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    const d = m[c][c];
    for (let j = 0; j < 2 * n; j += 1) m[c][j] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = m[r][c];
      for (let j = 0; j < 2 * n; j += 1) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row) => row.slice(n));
}

/** The posterior of θ by Gaussian conditioning on the joint law (a reference independent of the closed form):
 *  prior precision P (proper μ prior: (σ²I + s_μ²J)⁻¹; flat μ: (I − J/n)/σ²), posterior covariance (P + D⁻¹)⁻¹ and
 *  mean V(P·μ₀1 + D⁻¹ est). */
function conditioned(est: number[], se: number[], sigma: number, meanSd: number, mu0: number) {
  const n = est.length;
  const s2 = sigma * sigma;
  const P = Number.isFinite(meanSd)
    ? inverse(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? s2 : 0) + meanSd * meanSd)))
    : Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => ((i === j ? 1 : 0) - 1 / n) / s2));
  const V = inverse(P.map((row, i) => row.map((x, j) => x + (i === j ? 1 / (se[i] * se[i]) : 0))));
  const b = est.map((y, i) => P[i].reduce((acc, x) => acc + x * mu0, 0) + y / (se[i] * se[i]));
  const means = V.map((row) => row.reduce((acc, x, j) => acc + x * b[j], 0));
  const sds = V.map((row, i) => Math.sqrt(row[i]));
  const corr = V.map((row, i) => row.map((x, j) => (i === j ? 1 : x / (sds[i] * sds[j]))));
  return { means, sds, corr };
}

test("sharedMeanPosterior: the spec examples (two units with s_μ .50; three units with a flat prior on μ)", () => {
  const a = sharedMeanPosterior([0.3, 0.1], 0.2, { priorSd: 0.1, meanSd: 0.5 });
  assert.deepEqual(Object.keys(a), ["weight", "muMean", "muVar", "means", "sds", "corr"]);
  assert.deepEqual(a.weight, [0.2, 0.2]);
  near(a.muMean, 2 / 11, "muMean");
  near(a.muVar, 1 / 44, "muVar");
  assert.deepEqual(a.means, [0.20545454545454547, 0.16545454545454547]);
  nearAll(a.sds, [0.15015143870590966, 0.15015143870590966], "sds");
  assert.equal(a.corr[0][0], 1);
  assert.equal(a.corr[1][1], 1);
  near(a.corr[0][1], 20 / 31, "corr");
  assert.equal(a.corr[1][0], a.corr[0][1]);
  // then pairDifference with that correlation, and without it
  near(pairDifference(a.means[0], a.sds[0], a.means[1], a.sds[1], { corr: a.corr[0][1] }).pi, 0.6240851829770754, "pi with corr");
  near(pairDifference(a.means[0], a.sds[0], a.means[1], a.sds[1]).pi, 0.5747073311990831, "pi with corr 0");

  const b = sharedMeanPosterior([0.3, 0.1, -0.2], [0.1, 0.2, 0.4], { priorSd: 0.15 });
  assert.deepEqual(b.weight, [0.6923076923076923, 0.36, 0.12328767123287669]);
  assert.equal(b.muMean, 0.18631816715069377);
  assert.equal(b.muVar, 0.01913923846402065);
  assert.deepEqual(b.means, [0.26502097450790574, 0.155243626976444, 0.13868989996773157]);
  nearAll(b.sds, [0.0934616275854064, 0.14912891092897734, 0.18557185975765336], "sds");
  near(b.corr[0][1], 0.2704120748654439, "corr (0, 1)");
  near(b.corr[0][2], 0.29768225472223053, "corr (0, 2)");
  near(b.corr[1][2], 0.38805007788997653, "corr (1, 2)");
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) assert.equal(b.corr[i][j], b.corr[j][i]);
});

test("sharedMeanPosterior: agrees with Gaussian conditioning on the joint law (proper and flat prior on μ)", () => {
  const u = uniforms(23, 300);
  for (let q = 0; q < 20; q += 1) {
    const n = 2 + (q % 4);
    const est = Array.from({ length: n }, (_, i) => u[10 * q + i] - 0.5);
    const se = Array.from({ length: n }, (_, i) => 0.05 + 0.4 * u[200 + ((7 * q + i) % 100)]);
    const sigma = 0.05 + 0.3 * u[q];
    for (const [meanSd, mu0] of [[Number.POSITIVE_INFINITY, 0], [0.5, 0], [0.2, 0.3], [2, -0.1]]) {
      const r = sharedMeanPosterior(est, se, { priorSd: sigma, meanSd, priorMean: mu0 });
      const ref = conditioned(est, se, sigma, meanSd, mu0);
      const what = `case ${q}, meanSd ${meanSd}`;
      r.means.forEach((m, i) => assert.ok(Math.abs(m - ref.means[i]) <= 1e-12, `${what}: mean ${i}`));
      nearAll(r.sds, ref.sds, `${what}: sds`, 1e-10);
      for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) assert.ok(Math.abs(r.corr[i][j] - ref.corr[i][j]) <= 1e-10, `${what}: corr`);
    }
  }
});

test("sharedMeanPosterior: the limits (a tight prior on μ fixes it; a flat prior equals a very wide one; one unit)", () => {
  const est = [0.3, 0.1, -0.2];
  const se = [0.1, 0.2, 0.4];
  // s_μ → 0: μ = μ₀, so the posterior is the teaching posterior around μ₀ and the units are independent
  const tight = sharedMeanPosterior(est, se, { priorSd: 0.15, meanSd: 1e-9, priorMean: 0.05 });
  const s2 = 0.15 * 0.15;
  est.forEach((y, i) => {
    const B = s2 / (s2 + se[i] * se[i]);
    assert.ok(Math.abs(tight.means[i] - (0.05 + B * (y - 0.05))) <= 1e-12);
    assert.ok(Math.abs(tight.sds[i] - Math.sqrt(B) * se[i]) <= 1e-9);
  });
  assert.ok(Math.abs(tight.corr[0][1]) < 1e-12);
  // s_μ = ∞ (the default) against a very wide prior
  const flat = sharedMeanPosterior(est, se, { priorSd: 0.15 });
  assert.deepEqual(flat, sharedMeanPosterior(est, se, { priorSd: 0.15, meanSd: Number.POSITIVE_INFINITY, priorMean: 0.7 }));
  const wide = sharedMeanPosterior(est, se, { priorSd: 0.15, meanSd: 1e6 });
  assert.ok(Math.abs(wide.muMean - flat.muMean) < 1e-10);
  // one unit with a flat prior on μ: muMean = est, muVar = σ² + se²
  const one = sharedMeanPosterior([0.4], [0.2], { priorSd: 0.1 });
  near(one.muMean, 0.4, "one unit: muMean");
  near(one.muVar, 0.05, "one unit: muVar");
  assert.deepEqual(one.corr, [[1]]);
  // a common SE as one number
  assert.deepEqual(sharedMeanPosterior(est, 0.2, { priorSd: 0.15 }), sharedMeanPosterior(est, [0.2, 0.2, 0.2], { priorSd: 0.15 }));
});

test("sharedMeanPosterior: input checks", () => {
  rangeError(() => sharedMeanPosterior([], 0.2, { priorSd: 0.1 }), /sharedMeanPosterior: est must be a nonempty array/);
  rangeError(() => sharedMeanPosterior([0.1, NaNd], 0.2, { priorSd: 0.1 }), /sharedMeanPosterior: est must be finite numbers/);
  for (const se of [0, -0.1, [0.2, 0]]) rangeError(() => sharedMeanPosterior([0.1, 0.2], se, { priorSd: 0.1 }), /sharedMeanPosterior: se must be > 0/);
  rangeError(() => sharedMeanPosterior([0.1, 0.2], Number.POSITIVE_INFINITY, { priorSd: 0.1 }), /sharedMeanPosterior: se must be a finite number/);
  rangeError(() => sharedMeanPosterior([0.1, 0.2], [0.2, 0.2, 0.2], { priorSd: 0.1 }), /sharedMeanPosterior: se must have 2 values/);
  for (const priorSd of [undefined, 0, -0.1, NaNd, Number.POSITIVE_INFINITY]) {
    rangeError(() => sharedMeanPosterior([0.1, 0.2], 0.2, { priorSd } as never), /sharedMeanPosterior: priorSd must be a finite number > 0/);
  }
  for (const meanSd of [0, -1, NaNd, "1" as never]) {
    rangeError(() => sharedMeanPosterior([0.1, 0.2], 0.2, { priorSd: 0.1, meanSd }), /sharedMeanPosterior: meanSd must be > 0/);
  }
  for (const priorMean of [NaNd, Number.POSITIVE_INFINITY]) {
    rangeError(() => sharedMeanPosterior([0.1, 0.2], 0.2, { priorSd: 0.1, priorMean }), /sharedMeanPosterior: priorMean must be a finite number/);
  }
  typeError(() => sharedMeanPosterior([0.1, 0.2], 0.2, { priorSd: 0.1, mu0: 0 } as never), /sharedMeanPosterior: unknown option "mu0"/);
  typeError(() => sharedMeanPosterior([0.1, 0.2], 0.2, undefined as never), /sharedMeanPosterior: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// claimsByDistance

test("claimsByDistance: the spec examples (three units; the six sites ranked by posterior mean)", () => {
  const three = cube([
    [0, 0.1, 0.05],
    [0.9, 0, 0.3],
    [0.95, 0.7, 0],
  ]);
  assert.deepEqual(claimsByDistance([1, 2, 3], three), [
    { distance: 1, count: 2, expected: 0.4, max: 0.3 },
    { distance: 2, count: 1, expected: 0.05, max: 0.05 },
  ]);
  const g = strictOrder(SIX);
  assert.deepEqual(g, [1, 2, 3, 4, 5, 6]);
  const rows = claimsByDistance(g, E6);
  assert.deepEqual(rows.map((r) => [r.distance, r.count]), [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]]);
  const want = [
    [0.712080844765332, 0.361836804915882],
    [0.00712677687335478, 0.00400497116494002],
    [0.000205523306237474, 0.000102687868070609],
    [1.23152871637185e-9, 9.25287068693378e-10],
    [7.68729897214031e-13, 7.68729897214031e-13],
  ];
  rows.forEach((r, d) => {
    near(r.expected, want[d][0], `distance ${d + 1}: expected`);
    near(r.max, want[d][1], `distance ${d + 1}: max`);
  });
  // the largest claim at distance 1 is C above D
  assert.equal(rows[0].max, E6.e[0][2][3]);
});

test("claimsByDistance: the claims of g (not of the index order); sums of each distance in grade order; Σ expected = E of the strict order", () => {
  const E = randomCube(7, 3);
  const g = [4, 1, 7, 2, 6, 3, 5];
  const unitAt = new Array<number>(7);
  g.forEach((a, i) => (unitAt[a - 1] = i));
  const rows = claimsByDistance(g, E);
  for (const r of rows) {
    let s = 0;
    let m = Number.NEGATIVE_INFINITY;
    for (let a = 1; a + r.distance <= 7; a += 1) {
      const x = E.e[0][unitAt[a - 1]][unitAt[a + r.distance - 1]];
      s += x;
      m = Math.max(m, x);
    }
    assert.equal(r.expected, s);
    assert.equal(r.max, m);
  }
  assert.equal(rows.reduce((acc, r) => acc + r.count, 0), 21);
  const total = rows.reduce((acc, r) => acc + r.expected, 0);
  assert.ok(Math.abs(total - evaluateReport(g, E, { tau: 0.5 }).E[0]) <= 1e-14);
  // two criteria: ē = Σ_k w_k e_k
  const E2 = randomCube(5, 9, 2);
  const r2 = claimsByDistance([1, 2, 3, 4, 5], E2, { w: [0.25, 0.75] })[0];
  let s = 0;
  for (let a = 0; a < 4; a += 1) s += 0.25 * E2.e[0][a][a + 1] + 0.75 * E2.e[1][a][a + 1];
  assert.ok(Math.abs(r2.expected - s) <= 1e-15);
});

test("claimsByDistance: input checks", () => {
  for (const g of [[1, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 7], [1, 2, 3, 4, 5, 6.5], [1, 2, 3, 4, 5, "6" as never]]) {
    rangeError(() => claimsByDistance(g, E6), /claimsByDistance: g must be a permutation of the grades 1\.\.6/);
  }
  rangeError(() => claimsByDistance([1, 2, 3], E6), /claimsByDistance: g must be a strict order of the 6 units/);
  rangeError(() => claimsByDistance(null as never, E6), /claimsByDistance: g must be a strict order/);
  rangeError(() => claimsByDistance([1], { ids: ["A"], criteria: ["k1"], e: [[[NaNd]]] }), /at least two units/);
  rangeError(() => claimsByDistance([1, 2], randomCube(2, 1, 2)), /weights w are required/);
  rangeError(() => claimsByDistance([1, 2, 3, 4, 5, 6], E6, { w: [0.5, 0.5] }), /w must hold 1 weights/);
  typeError(() => claimsByDistance([1, 2, 3, 4, 5, 6], E6, { tau: 0.2 } as never), /claimsByDistance: unknown option "tau"/);
  typeError(() => claimsByDistance([1, 2, 3, 4, 5, 6], E6, 0.2 as never), /claimsByDistance: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// finiteLawCells

test("finiteLawCells: the spec example (chapter 9's law 1) with probabilities and as equally likely states", () => {
  const states = [[0, 1], [1, 2], [2, 0]];
  const want = {
    rowValues: [0, 1, 2],
    colValues: [0, 1, 2],
    cells: [[0, 1 / 3, 0], [0, 0, 1 / 3], [1 / 3, 0, 0]],
  };
  assert.deepEqual(finiteLawCells(states, [1 / 3, 1 / 3, 1 / 3], { i: 0, j: 1 }), want);
  assert.deepEqual(finiteLawCells(states, null, { i: 0, j: 1 }), want);
  // (j, i) is the transpose
  const t = finiteLawCells(states, null, { i: 1, j: 0 });
  assert.deepEqual(t.cells, [[0, 0, 1 / 3], [1 / 3, 0, 0], [0, 1 / 3, 0]]);
});

test("finiteLawCells: sums in state order; margins as finiteLawMargins; a criterion; equal values (===, −0 = 0) share a cell", () => {
  // A and B on two criteria, four states (states[s][i][k])
  const states = [
    [[0, 5], [1, 5], [9, 9]],
    [[0, 3], [1, 5], [9, 9]],
    [[2, 3], [-0, 7], [9, 9]],
    [[0, 5], [1, 7], [9, 9]],
  ];
  const probs = [0.1, 0.2, 0.3, 0.4];
  const c0 = finiteLawCells(states, probs, { i: 0, j: 1 });
  assert.deepEqual(c0.rowValues, [0, 2]);
  assert.deepEqual(c0.colValues, [0, 1]);
  assert.deepEqual(c0.cells, [[0, 0.1 + 0.2 + 0.4], [0.3, 0]]);
  assert.ok(Object.is(c0.colValues[0], 0)); // −0 and 0 are one value
  const c1 = finiteLawCells(states, probs, { i: 0, j: 1, criterion: 1 });
  assert.deepEqual(c1, { rowValues: [3, 5], colValues: [5, 7], cells: [[0.2, 0.3], [0.1, 0.4]] });
  const margins = finiteLawMargins(states, probs).margins;
  for (const [k, c] of [[0, c0], [1, c1]] as const) {
    nearAll(c.cells.map((row) => row.reduce((a, b) => a + b, 0)), margins[0][k].probs, "row sums", 1e-15);
    nearAll(c.colValues.map((_, q) => c.cells.reduce((a, row) => a + row[q], 0)), margins[1][k].probs, "column sums", 1e-15);
  }
  // equal weights: exact counts over S
  const eq = finiteLawCells(states, null, { i: 2, j: 1 });
  assert.deepEqual(eq, { rowValues: [9], colValues: [0, 1], cells: [[1 / 4, 3 / 4]] });
});

test("finiteLawCells: input checks", () => {
  const states = [[0, 1], [1, 2], [2, 0]];
  rangeError(() => finiteLawCells(states, null, { i: 0, j: 0 }), /finiteLawCells: i and j must be two different units/);
  for (const i of [-1, 2, 0.5, NaNd, undefined]) rangeError(() => finiteLawCells(states, null, { i, j: 1 } as never), /finiteLawCells: i must be a unit index, an integer in 0\.\.1/);
  rangeError(() => finiteLawCells(states, null, { i: 0 } as never), /finiteLawCells: j must be a unit index/);
  rangeError(() => finiteLawCells(states, null, { i: 0, j: 1, criterion: 1 }), /finiteLawCells: criterion must be a criterion index, an integer in 0\.\.0/);
  rangeError(() => finiteLawCells(states, [0.5, 0.5, 0.5], { i: 0, j: 1 }), /probs must sum to 1/);
  rangeError(() => finiteLawCells(states, [0.5, 0.5], { i: 0, j: 1 }), /probs must have one value per state/);
  rangeError(() => finiteLawCells([[0, 1], [1, 2, 3]], null, { i: 0, j: 1 }), /states\[1\] must have 2 units/);
  rangeError(() => finiteLawCells([], null, { i: 0, j: 1 }), /states must be a nonempty array/);
  typeError(() => finiteLawCells(states, null, { i: 0, j: 1, k: 0 } as never), /finiteLawCells: unknown option "k"/);
  typeError(() => finiteLawCells(states, null, undefined as never), /finiteLawCells: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// binomialMcse

test("binomialMcse: the spec examples (e = .18837955890579108 at S 1,000, 100 and 4,000) and the ends", () => {
  const e = 0.18837955890579108;
  assert.equal(binomialMcse(e, 1000), 0.012364978798697985);
  assert.equal(binomialMcse(e, 100), 0.03910149622357828);
  assert.equal(binomialMcse(e, 4000), 0.0061824893993489925);
  assert.equal(binomialMcse(e, 1000), Math.sqrt((e * (1 - e)) / 1000));
  assert.equal(binomialMcse(0, 10), 0);
  assert.equal(binomialMcse(1, 10), 0);
  assert.equal(binomialMcse(0.5, 1), 0.5);
  // the IID MCSE of an indicator trace with share e is binomialMcse(e, S)·√(S/(S − 1))
  const trace = Array.from({ length: 40 }, (_, s) => (s % 4 === 0 ? 1 : 0));
  near(mcse(trace) as number, binomialMcse(0.25, 40) * Math.sqrt(40 / 39), "mcse of a 0/1 trace", 1e-14);
});

test("binomialMcse: input checks", () => {
  for (const e of [-0.1, 1.1, NaNd, Number.POSITIVE_INFINITY, "0.5" as never]) rangeError(() => binomialMcse(e, 100), /binomialMcse: e must be a probability in \[0, 1\]/);
  for (const S of [0, -1, 1.5, NaNd, Number.POSITIVE_INFINITY, "100" as never]) rangeError(() => binomialMcse(0.2, S), /binomialMcse: S must be an integer ≥ 1/);
});

// ---------------------------------------------------------------------------------------------------------
// maxCoefficientError

test("maxCoefficientError: the spec example; the first largest in row-major order; per criterion", () => {
  const Ehat = cube([[0, 0.25], [0.75, 0]]);
  const E = cube([[0, 0.5], [0.5, 0]]);
  assert.deepEqual(maxCoefficientError(Ehat, E), { epsilon: [0.25], at: [{ i: 0, j: 1 }] });
  // ties: the first in (i, j) order; a later strictly larger difference wins
  const A = cube([[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]], [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]]);
  const B = cube([[0, 0.5, 0.4], [0.6, 0, 0.5], [0.4, 0.5, 0]], [[0, 0.5, 0.5], [0.5, 0, 0.45], [0.5, 0.75, 0]]);
  const r = maxCoefficientError(A, B);
  near(r.epsilon[0], 0.1, "criterion 1", 1e-15);
  assert.deepEqual(r.at[0], { i: 0, j: 2 });
  assert.equal(r.epsilon[1], 0.25);
  assert.deepEqual(r.at[1], { i: 2, j: 1 });
  // identical arrays: 0 at the first pair
  assert.deepEqual(maxCoefficientError(E6, E6), { epsilon: [0], at: [{ i: 0, j: 1 }] });
});

test("maxCoefficientError: the epsilon of selectionOnDraws", () => {
  const means = [[1.2, 0.3], [0.95, 0.6], [0.25, 0.1], [0.15, 0.4]];
  const E = errorArray(means, 0.4);
  const draws = gaussianDraws(means, 0.4, 200, 7);
  const r = maxCoefficientError(drawErrors(draws), E);
  const sel = selectionOnDraws(draws, E, { tau: 0.2, w: [0.5, 0.5] });
  assert.deepEqual(r.epsilon, sel.epsilon);
  r.at.forEach(({ i, j }, k) => assert.equal(Math.abs(drawErrors(draws).e[k][i][j] - E.e[k][i][j]), r.epsilon[k]));
});

test("maxCoefficientError: input checks (two ErrorArrays of one shape)", () => {
  rangeError(() => maxCoefficientError(E6, randomCube(5, 1)), /maxCoefficientError: Ehat and E must have the same shape/);
  rangeError(() => maxCoefficientError(randomCube(6, 1, 2), E6), /maxCoefficientError: Ehat and E must have the same shape/);
  rangeError(() => maxCoefficientError(null as never, E6), /Ehat must be an ErrorArray/);
  rangeError(() => maxCoefficientError(E6, null as never), /^E must be an ErrorArray/);
  rangeError(() => maxCoefficientError({ ids: ["A"], criteria: ["k1"], e: [[[NaNd]]] }, E6), /Ehat\.e must have at least two units/);
  rangeError(() => maxCoefficientError(E6, cube([[0, NaNd], [0.5, 0]])), /E\.e\[0\]\[0\]\[1\] must be a finite number/);
});

// ---------------------------------------------------------------------------------------------------------
// chainCountLaw

/** The law of the count of ones by enumerating every path X_1..X_S (a reference for small S). */
function pathLaw(p01: number, p10: number, S: number): number[] {
  const pi1 = p01 / (p01 + p10);
  const probs = new Array<number>(S + 1).fill(0);
  for (let mask = 0; mask < 2 ** S; mask += 1) {
    let x = mask & 1;
    let p = x === 1 ? pi1 : 1 - pi1;
    let c = x;
    for (let b = 1; b < S; b += 1) {
      const y = (mask >> b) & 1;
      p *= x === 0 ? (y === 1 ? p01 : 1 - p01) : y === 0 ? p10 : 1 - p10;
      c += y;
      x = y;
    }
    probs[c] += p;
  }
  return probs;
}

test("chainCountLaw: the spec examples (S 2 and 3; stay .99 and .5 at S 100 and 1,000 with the book and package radii)", () => {
  const a = chainCountLaw({ p01: 0.2, p10: 0.3, S: 2 });
  assert.equal(a.pi1, 0.4);
  nearAll(a.probs, [0.48, 0.24, 0.28], "S 2");
  assert.equal(a.outside, null);
  nearAll(chainCountLaw({ p01: 0.01, p10: 0.01, S: 3 }).probs, [0.49005, 0.00995, 0.00995, 0.49005], "S 3");
  const book100 = envelopeRadius(1, 100, 0.05, "book");
  const package100 = envelopeRadius(1, 100, 0.05, "package");
  const book1000 = envelopeRadius(1, 1000, 0.05, "book");
  near(book100, 0.14802071873008, "book radius, S 100");
  near(package100, 0.135810151574062, "package radius, S 100");
  near(book1000, 0.0468082612082199, "book radius, S 1,000");
  const stay99 = { p01: 0.01, p10: 0.01 };
  const stay50 = { p01: 0.5, p10: 0.5 };
  const cases: [object, number, number, number][] = [
    [stay99, 100, book100, 0.804345459102859],
    [stay99, 100, package100, 0.817706439802635],
    [stay99, 1000, book1000, 0.770173951294846],
    [stay50, 100, book100, 0.00351764172297016],
    [stay50, 1000, book1000, 0.00325259981316338],
  ];
  for (const [chain, S, radius, want] of cases) {
    const r = chainCountLaw({ ...chain, S, radius } as never);
    near(r.outside as number, want, `${JSON.stringify(chain)} S ${S} radius ${radius}`);
  }
  // the printed (rounded) radii give the same counts outside
  assert.equal(chainCountLaw({ ...stay99, S: 100, radius: 0.14802071873008 }).outside, chainCountLaw({ ...stay99, S: 100, radius: book100 }).outside);
  assert.equal(chainCountLaw({ ...stay99, S: 1000, radius: 0.0468082612082199 }).outside, chainCountLaw({ ...stay99, S: 1000, radius: book1000 }).outside);
});

test("chainCountLaw: agrees with path enumeration; mean S·π₁ and Var(C/S) = chainMeanVariance; outside strict; S = 1", () => {
  for (const [p01, p10] of [[0.2, 0.3], [0.01, 0.01], [0.5, 0.5], [0.9, 0.05], [1, 1], [0.3, 1]]) {
    for (const S of [1, 2, 5, 10]) nearAll(chainCountLaw({ p01, p10, S }).probs, pathLaw(p01, p10, S), `p01 ${p01}, p10 ${p10}, S ${S}`, 1e-13);
    for (const S of [10, 100, 400]) {
      const r = chainCountLaw({ p01, p10, S });
      let m = 0;
      let m2 = 0;
      r.probs.forEach((p, c) => {
        m += (p * c) / S;
        m2 += p * (c / S) * (c / S);
      });
      assert.ok(Math.abs(m - r.pi1) <= 1e-13, `mean, p01 ${p01}, S ${S}`);
      const v = chainMeanVariance({ p01, p10, S }).variance;
      assert.ok(Math.abs(m2 - r.pi1 * r.pi1 - v) <= 1e-13, `variance, p01 ${p01}, S ${S}`);
    }
  }
  // outside is strict: at radius 0 every count off π₁ counts, and only those
  const r = chainCountLaw({ p01: 0.5, p10: 0.5, S: 4, radius: 0 });
  near(r.outside as number, 1 - r.probs[2], "radius 0");
  // a count exactly at the radius is inside: S 4, π₁ .5, radius .25 leaves out only c = 0 and 4
  const edge = chainCountLaw({ p01: 0.5, p10: 0.5, S: 4, radius: 0.25 });
  assert.equal(edge.outside, edge.probs[0] + edge.probs[4]);
  assert.deepEqual(chainCountLaw({ p01: 0.2, p10: 0.3, S: 1 }).probs, [1 - 0.4, 0.4]);
  assert.equal(chainCountLaw({ p01: 0.2, p10: 0.3, S: 5, radius: null }).outside, null);
  // the largest S runs (5,000)
  assert.equal(chainCountLaw({ p01: 0.01, p10: 0.01, S: 5000 }).probs.length, 5001);
});

test("chainCountLaw: input checks (as twoStateChain; S in 1..5000; radius null or finite ≥ 0)", () => {
  for (const p of [0, -0.1, 1.5, NaNd, undefined]) {
    rangeError(() => chainCountLaw({ p01: p, p10: 0.3, S: 10 } as never), /chainCountLaw: p01 must lie in \(0, 1\]/);
    rangeError(() => chainCountLaw({ p01: 0.2, p10: p, S: 10 } as never), /chainCountLaw: p10 must lie in \(0, 1\]/);
  }
  for (const S of [0, 5001, 2.5, -1, NaNd, undefined, "10"]) {
    rangeError(() => chainCountLaw({ p01: 0.2, p10: 0.3, S } as never), /chainCountLaw: S must be an integer in 1\.\.5000/);
  }
  for (const radius of [-0.1, NaNd, Number.POSITIVE_INFINITY, "0.1"]) {
    rangeError(() => chainCountLaw({ p01: 0.2, p10: 0.3, S: 10, radius } as never), /chainCountLaw: radius must be null or a finite number ≥ 0/);
  }
  typeError(() => chainCountLaw({ p01: 0.2, p10: 0.3, S: 10, seed: 1 } as never), /chainCountLaw: unknown option "seed"/);
  typeError(() => chainCountLaw(undefined as never), /chainCountLaw: options object expected/);
});

// ---------------------------------------------------------------------------------------------------------
// runningMean

test("runningMean: the spec example; running sums in order; typed input", () => {
  const r = runningMean([1, 0, 0, 1]);
  assert.ok(r instanceof Float64Array);
  assert.deepEqual(Array.from(r), [1, 0.5, 1 / 3, 0.5]);
  const u = uniforms(3, 1000);
  const m = runningMean(u);
  let s = 0;
  for (let b = 0; b < u.length; b += 1) {
    s += u[b];
    assert.equal(m[b], s / (b + 1));
  }
  assert.deepEqual(Array.from(runningMean([0.25])), [0.25]);
});

test("runningMean: input checks", () => {
  rangeError(() => runningMean([]), /runningMean: trace must be a nonempty array/);
  rangeError(() => runningMean([1, NaNd]), /runningMean: trace must be finite numbers/);
  rangeError(() => runningMean(5 as never), /runningMean: trace must be a nonempty array/);
});

// ---------------------------------------------------------------------------------------------------------
// Extensions of existing functions

test("disclosure: withheld = M − N (the spec example 1/1/2/2/3/3 → M 15, N 12, withheld 3) and the pairs inside the grades", () => {
  const d = disclosure([1, 1, 2, 2, 3, 3]);
  assert.deepEqual([d.M, d.N, d.withheld], [15, 12, 3]);
  for (const g of [[1, 1, 1, 1], [1, 2, 3, 4], [2, 1, 2, 3, 1], [5, 5, 9]]) {
    const x = disclosure(g);
    assert.equal(x.withheld, x.M - x.N);
    assert.equal(x.withheld, x.sizes.reduce((a, m) => a + (m * (m - 1)) / 2, 0));
  }
  // the existing fields keep their order, and the new field comes last
  assert.deepEqual(Object.keys(d), ["M", "N", "s", "G", "sizes", "withheld"]);
});

test("leastCertainPairs: with an order, apart = |pos(i) − pos(j)| (the spec example); without one, no apart and no change", () => {
  const r = leastCertainPairs(E6, { k: 3, order: [0, 1, 2, 4, 3, 5] });
  assert.deepEqual(r.map((p) => [p.i, p.j, p.above, p.apart]), [[2, 3, 2, 2], [0, 1, 0, 1], [4, 5, 4, 2]]);
  // the example prints e to 4 decimals: within half a unit of the last place
  r.forEach((p, q) => assert.ok(Math.abs(p.e - [0.3618, 0.1884, 0.1444][q]) <= 5e-5, `pair ${q}: e ${p.e}`));
  const plain = leastCertainPairs(E6, { k: 3 });
  for (const p of plain) assert.ok(!("apart" in p));
  assert.deepEqual(r.map(({ i, j, e, above }) => ({ i, j, e, above })), plain);
  assert.deepEqual(leastCertainPairs(E6, { k: 3, order: null }), plain);
  // the identity order: apart = j − i
  for (const p of leastCertainPairs(E6, { k: 15, order: [0, 1, 2, 3, 4, 5] })) assert.equal(p.apart, p.j - p.i);
  for (const order of [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 4], [0, 1, 2, 3, 4, 6], [0, 1, 2, 3, 4, 5.5], "012345" as never]) {
    rangeError(() => leastCertainPairs(E6, { order }), /leastCertainPairs: order must (list all 6 unit indices|be a permutation of 0\.\.5)/);
  }
});

test("intervalOverlapTally: amount, nested per pair and nestedCount (the spec example); the existing fields unchanged", () => {
  const half = [[NaNd, 0.5, 0.5], [0.5, NaNd, 0.5], [0.5, 0.5, NaNd]];
  const t = intervalOverlapTally([0, 1, 0.5], [2, 3, 1.5], half);
  assert.deepEqual(t.pairs.map((p) => [p.i, p.j, p.amount, p.nested]), [[0, 1, 1, false], [0, 2, 1, true], [1, 2, 0.5, false]]);
  assert.equal(t.nestedCount, 1);
  assert.deepEqual([t.apart, t.overlapping, t.high, t.low], [0, 3, 0, 3]);
  // the gap is negative; touching intervals have amount 0 (not overlapping); equal intervals are nested
  const u = intervalOverlapTally([0, 2, 0, 3], [1, 3, 1, 3], [[NaNd, 0.9, 0.5, 0.95], [0.1, NaNd, 0.2, 0.6], [0.5, 0.8, NaNd, 0.7], [0.05, 0.4, 0.3, NaNd]]);
  const byPair = Object.fromEntries(u.pairs.map((p) => [`${p.i}${p.j}`, p]));
  assert.equal(byPair["01"].amount, -1);
  assert.equal(byPair["01"].nested, false);
  assert.equal(byPair["02"].amount, 1);
  assert.equal(byPair["02"].nested, true); // equal intervals
  assert.equal(byPair["13"].amount, 0); // [2, 3] and the point [3, 3] touch at 3
  assert.equal(byPair["13"].overlap, false);
  assert.equal(byPair["13"].nested, true); // the point 3 lies in [2, 3], ends included
  assert.equal(u.nestedCount, u.pairs.filter((p) => p.nested).length);
  for (const p of u.pairs) assert.equal(p.overlap, p.amount > 0);
  // the league tally: amount > 0 exactly when the pair overlaps; the counts of Step 5.14 unchanged
  const L = prCore.league30();
  const post = prCore.normalPosterior(prCore.drawLeague(20261030).estimate, L.se, { priorSd: 0.15 }) as { mean: number[]; sd: number[] };
  const iv = prCore.normalInterval(post.mean, post.sd, 0.9) as { lower: number[]; upper: number[] };
  const league = intervalOverlapTally(iv.lower, iv.upper, directionMatrix(post.mean, post.sd), { threshold: 0.9 });
  assert.deepEqual([league.apart, league.overlapping, league.high, league.low], [36, 399, 88, 311]);
  for (const p of league.pairs) {
    assert.equal(p.overlap, p.amount > 0);
    assert.equal(p.amount, Math.min(iv.upper[p.i], iv.upper[p.j]) - Math.max(iv.lower[p.i], iv.lower[p.j]));
  }
  assert.equal(league.nestedCount, league.pairs.filter((p) => p.nested).length);
});

test("majorityWins: cycleTriples (the spec examples), one per cyclic triple, lexicographic, each [a, x, y] with a beating x, x beating y, y beating a", () => {
  const three = (pairs: [number, number][]) => {
    const m = [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
    for (const [a, b] of pairs) {
      m[a][b] = 0.3; // a beats b: stating a above b is less often wrong
      m[b][a] = 0.7;
    }
    return cube(m);
  };
  assert.deepEqual(majorityWins(three([[0, 1], [1, 2], [2, 0]])).cycleTriples, [[0, 1, 2]]);
  assert.deepEqual(majorityWins(three([[0, 2], [2, 1], [1, 0]])).cycleTriples, [[0, 2, 1]]);
  assert.deepEqual(majorityWins(E6).cycleTriples, []);
  // random arrays: the triples are the cyclic ones, in lexicographic order of their sorted indices
  for (let seed = 1; seed <= 30; seed += 1) {
    const E = randomCube(7, seed);
    const r = majorityWins(E);
    assert.equal(r.cycleTriples.length, r.cycles);
    const beats = (a: number, b: number) => E.e[0][a][b] < E.e[0][b][a] - 1e-12;
    const want: number[][] = [];
    for (let a = 0; a < 7; a += 1) {
      for (let b = a + 1; b < 7; b += 1) {
        for (let c = b + 1; c < 7; c += 1) {
          if (beats(a, b) && beats(b, c) && beats(c, a)) want.push([a, b, c]);
          else if (beats(a, c) && beats(c, b) && beats(b, a)) want.push([a, c, b]);
        }
      }
    }
    assert.deepEqual(r.cycleTriples, want);
    for (const [a, x, y] of r.cycleTriples) assert.ok(a < x && a < y && beats(a, x) && beats(x, y) && beats(y, a));
  }
  // KRW's gender array: the one 3-cycle is listed; race: none
  const gender = majorityWins(krwArray("gender_signed"));
  assert.equal(gender.cycleTriples.length, 1);
  const [a, x, y] = gender.cycleTriples[0];
  const g = krwArray("gender_signed").e[0];
  assert.ok(a < x && a < y && g[a][x] < g[x][a] && g[x][y] < g[y][x] && g[y][a] < g[a][y]);
  assert.deepEqual(majorityWins(krwArray("race_signed")).cycleTriples, []);
});

// ---------------------------------------------------------------------------------------------------------
// formatProb: the `open` option (CR-008)

test("formatProb: open (a value known to lie in (0, 1)) writes an exact 0 or 1 as a bound; the examples", () => {
  assert.equal(formatProb(1, { open: true }), "above .999");
  assert.equal(formatProb(0, { open: true, bounds: "symbols" }), "<.001");
  assert.equal(formatProb(1, { open: true, digits: 2 }), "above .99");
  assert.equal(formatProb(0.5, { open: true }), ".500");
  assert.equal(formatProb(1), "1"); // unchanged without open
  assert.equal(formatProb(0, { open: true }), "below .001");
  assert.equal(formatProb(-0, { open: true }), "below .001");
  assert.equal(formatProb(1, { open: true, bounds: "symbols" }), ">.999");
  assert.equal(formatProb(1, { open: true, bounds: true }), "above .999");
  assert.equal(formatProb(1, { open: true, bounds: "words" }), "above .999");
  assert.equal(formatProb(0, { open: true, digits: 4 }), "below .0001");
  // the same strings as a value inside (0, 1) that rounds to the end
  assert.equal(formatProb(1, { open: true }), formatProb(0.99999, {}));
  assert.equal(formatProb(0, { open: true, bounds: "symbols" }), formatProb(1e-9, { bounds: "symbols" }));
  // with bounds: false open changes nothing; open: false is the default
  assert.equal(formatProb(1, { open: true, bounds: false }), "1");
  assert.equal(formatProb(0, { open: true, bounds: false }), "0");
  assert.equal(formatProb(0.99999, { open: true, bounds: false }), "1.000");
  assert.equal(formatProb(1, { open: false }), "1");
  assert.equal(formatProb(0, { open: false }), "0");
  // other values: as without open (missing values stay NA)
  for (const x of [0.1875, 0.0004, 0.9996, 0.5, 1.5, -0.25]) assert.equal(formatProb(x, { open: true }), formatProb(x));
  assert.equal(formatProb(null, { open: true }), "NA");
  assert.equal(formatProb(Number.NaN, { open: true }), "NA");
});

test("formatProb: open is read like the other options (an unknown key still throws; open is true or false)", () => {
  typeError(() => formatProb(0.5, { open: true, opne: true } as never), /formatProb: unknown option "opne"/);
  typeError(() => formatProb(0.5, 3 as never), /formatProb: options object expected/);
  for (const open of ["yes", 1, 0]) rangeError(() => formatProb(1, { open } as never), /formatProb: open must be true or false/);
  assert.equal(formatProb(1, { open: undefined }), "1");
  assert.equal(formatProb(1, { open: null } as never), "1");
});
