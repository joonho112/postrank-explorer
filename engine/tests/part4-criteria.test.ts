import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type ErrorArray, drawErrors, finiteLawPairwise } from "../src/pairwise.ts";
import { relationChange } from "../src/report.ts";
import { evaluateReport, pairDecision } from "../src/risk.ts";
import { commonalityCost } from "../src/multi.ts";
import { compareReports, normalComposite, protectionEnvelopes } from "../src/criteria.ts";

const close = (got: number, want: number, tol = 1e-14) => assert.ok(Math.abs(got - want) <= tol, `got ${got}, want ${want}`);

function pairE(forward: number[], reverse = forward.map((v) => 1 - v)): ErrorArray {
  return {
    ids: ["A", "B"], criteria: forward.map((_, k) => `c${k + 1}`),
    e: forward.map((v, k) => [[NaN, v], [reverse[k], NaN]]),
  };
}

test("pairDecision directional minimum excludes withholding and is not generally expected statewise gamma", () => {
  const withheld = pairDecision(0.6, 0.7, 0.2);
  assert.equal(withheld.directionalMinimum, 0.6);
  assert.deepEqual(withheld.costs, { iAboveJ: 0.6, jAboveI: 0.7, withhold: 0.2 });
  assert.deepEqual(withheld.best, ["withhold"]);
  assert.deepEqual(pairDecision(0.2 + 1e-13, 0.8, 0.2).best, ["iAboveJ", "withhold"]);
  const law = finiteLawPairwise([[1, 0], [0, 1]], [0.5, 0.5]);
  assert.equal(pairDecision(law.e[0][0][1], law.e[0][1][0], 0.25).directionalMinimum, 0.5);
  // Every known state has one zero directional error: its gamma is zero, hence E[gamma] = zero.
  assert.equal(pairDecision(0, 1, 0.25).directionalMinimum, 0);
  assert.equal(pairDecision(1, 0, 0.25).directionalMinimum, 0);
});

test("commonalityCost profiles every retained common optimum while preserving first-common results and truncation", () => {
  const E = pairE([0, 1]);
  const r = commonalityCost(E, { tau: 0.5, w: [0.5, 0.5] });
  assert.equal(r.empty, false);
  if (r.empty) return;
  assert.equal(r.common.tieCount, 3);
  assert.deepEqual(r.commonReports, [
    { grade: [1, 1], Rk: [0.5, 0.5], delta: [0.5, 0.5], relationAgreement: [0, 0] },
    { grade: [1, 2], Rk: [0, 1], delta: [0, 1], relationAgreement: [1, 0] },
    { grade: [2, 1], Rk: [1, 0], delta: [1, 0], relationAgreement: [0, 1] },
  ]);
  assert.deepEqual(r.criteria.map((c) => [c.commonRk, c.delta, c.relationAgreement]), [[0.5, 0.5, 0], [0.5, 0.5, 0]]);
  assert.deepEqual(r.commonReports.map((p) => p.grade), r.common.grades);
  const truncated = commonalityCost(E, { tau: 0.5, w: [0.5, 0.5], maxTies: 2 });
  assert.equal(truncated.empty, false);
  if (truncated.empty) return;
  assert.equal(truncated.common.tieCount, 3);
  assert.deepEqual(truncated.commonReports, r.commonReports.slice(0, 2));
  assert.equal(commonalityCost(E, { tau: 0.5, w: [0.5, 0.5], family: { kind: "exactly", G: 3 } }).empty, true);
});

test("normalComposite uses general coefficients and positive rescaling under declared independent Normals", () => {
  // Composite coefficients are 2 and -2; the first SD is sqrt(6² + (-8)²) = 10.
  const r = normalComposite([[2, 3], [1, 4], [0, 0]], [[3, 4], [0, 0], [0, 0]], { a: [2, -1], multiplier: [1, 2], ids: ["X", "Y", "Z"] });
  assert.deepEqual(r.mean, [-2, -6, 0]);
  assert.deepEqual(r.sd, [10, 0, 0]);
  assert.deepEqual(r.E.ids, ["X", "Y", "Z"]);
  assert.deepEqual(r.E.criteria, ["composite"]);
  close(r.E.e[0][0][1], 0.3445782583896758); // Phi(-0.4), standard Normal table value.
  assert.equal(r.E.e[0][1][2], 1);
  assert.equal(r.E.e[0][2][1], 0);
  assert.ok(Number.isNaN(r.E.e[0][0][0]));
  assert.deepEqual(Object.keys(r).sort(), ["E", "mean", "sd"]);
  const independent = normalComposite([[0, 0], [0, 0]], [[3, 4], [0, 0]], { a: [1, -1] });
  assert.deepEqual(independent.sd, [5, 0]);
  assert.equal(independent.E.e[0][0][1], 0.5);
  const degenerate = normalComposite([[2, 3], [1, 4]], [[3, 4], [5, 6]], { a: [0, 0] });
  assert.deepEqual(degenerate.mean, [0, 0]);
  assert.deepEqual(degenerate.sd, [0, 0]);
  assert.deepEqual(degenerate.E.e, [[[NaN, 1], [1, NaN]]]);
  const pointMass = normalComposite([[2], [1]], [[0], [0]], { a: [1] });
  assert.deepEqual(pointMass.E.e, [[[NaN, 0], [1, NaN]]]);
});

test("normalComposite rejects invalid axes, values, coefficients and options", () => {
  const m = [[0, 1], [2, 3]];
  const s = [[0, 0], [1, 1]];
  for (const bad of [[], [[0, 1]], [[0, 1], [2]], [[0, 1], [2, NaN]], [0, 1]]) {
    assert.throws(() => normalComposite(bad as number[][], s, { a: [1, 1] }), /rectangular|criterion|finite/);
  }
  assert.throws(() => normalComposite(m, [[0], [1]], { a: [1, 1] }), /as means/);
  assert.throws(() => normalComposite(m, [[0, -1], [0, 1]], { a: [1, 0] }), /SDs/);
  for (const a of [[], [1], [1, NaN], [1, Infinity]]) assert.throws(() => normalComposite(m, s, { a }), /coefficients/);
  for (const multiplier of [[1], [0, 1], [-1, 1], [Infinity, 1]]) assert.throws(() => normalComposite(m, s, { a: [1, 1], multiplier }), /multipliers/);
  assert.throws(() => normalComposite(m, s, { a: [1, 1], ids: ["A", "A"] }), /distinct/);
  assert.throws(() => normalComposite(m, s, { a: [1, 1], corr: 0 } as never), /unknown option/);
  assert.throws(() => normalComposite(m, s, 0 as never), /options object expected/);
});

test("compareReports accounts for every newly disclosed, withheld and reversed unordered pair", () => {
  const E: ErrorArray = {
    ids: ["A", "B", "C"], criteria: ["c"],
    e: [[[NaN, 0.1, 0.2], [0.9, NaN, 0.3], [0.8, 0.7, NaN]]],
  };
  const g0 = [1, 1, 2];
  const g1 = [2, 1, 1];
  const r = compareReports(g0, g1, E, { tau: 0.25 });
  assert.deepEqual(r.before, evaluateReport(g0, E, { tau: 0.25 }));
  assert.deepEqual(r.after, evaluateReport(g1, E, { tau: 0.25 }));
  assert.deepEqual(r.change, relationChange(g0, g1, E));
  assert.deepEqual(r.change.pairs.map((p) => [p.i, p.j, p.error]), [[0, 1, 0.9], [0, 2, 0.8], [1, 2, null]], "changed relation errors use the supplied law; withholding has no stated error");
  assert.deepEqual(r.pairs.map((p) => [p.i, p.j, p.beforeRelation, p.afterRelation, p.beforeCost, p.afterCost]), [
    [0, 1, 0, -1, 0.25, 0.9], [0, 2, 1, -1, 0.2, 0.8], [1, 2, 1, 0, 0.3, 0.25],
  ]);
  close(r.errorTermDelta, 1.2 / 3);
  assert.equal(r.withholdingTermDelta, 0);
  close(r.deltaRisk, 0.4);
  close(r.pairs.reduce((sum, p) => sum + p.normalizedDifference, 0), r.deltaRisk);
  close(r.pairs.reduce((sum, p) => sum + p.costDifference, 0), 1.2);
  const reverse = compareReports(g1, g0, E, { tau: 0.25 });
  close(reverse.deltaRisk, -0.4);
  const withheld = compareReports(g1, [1, 1, 1], E, { tau: 0.25 });
  close(withheld.withholdingTermDelta, 0.5 / 3);
  close(withheld.errorTermDelta, -1.7 / 3);
  close(withheld.deltaRisk, -0.4);
  assert.deepEqual(compareReports(g0, [10, 10, 20], E, { tau: 0.25 }).pairs, []);
});

test("compareReports uses weighted directional costs and ordinary validation", () => {
  const E = pairE([0.1, 0.9]);
  const r = compareReports([1, 1], [1, 2], E, { tau: 0.25, w: [0.75, 0.25] });
  close(r.pairs[0].afterCost, 0.3);
  close(r.change.pairs[0].error as number, 0.3, 1e-15);
  close(r.deltaRisk, 0.05);
  close(r.errorTermDelta + r.withholdingTermDelta, r.deltaRisk);
  assert.throws(() => compareReports([1, 1], [1, 2], E, { tau: 0.25 }), /weights w/);
  assert.throws(() => compareReports([1, 1], [1, 2], E, { tau: 0.25, w: [1, 1] }), /sum to 1/);
  assert.throws(() => compareReports([1, 1], [1, 2], E, { tau: 0.6, w: [1, 0] }), /tau/);
  assert.throws(() => compareReports([1, 1], [1, 2], E, { tau: 0.25, w: [1, 0], tieTol: 0 } as never), /unknown option/);
});

test("protectionEnvelopes keeps raw decimal comparisons separate from advisory coefficient checks", () => {
  const h = pairE([0.2]);
  const x = pairE([0.3]);
  const r = protectionEnvelopes(h, x, { tau: 0.25, q: [0.25], epsilon: 0.1 });
  assert.equal(r.feasibilityTol, 0);
  assert.deepEqual(r.coefficientCheck, {
    maxAbs: [0.10000000000000009], excess: [0.10000000000000009 - 0.1],
    strictEnvelopeHolds: false, withinCoefficientTolerance: true, coefficientTol: 1e-12,
  });
  assert.deepEqual(r.counts, { inner: 1, nominal: 2, exact: 1, outer: 2 });
  assert.deepEqual(r.empty, { inner: false, nominal: false, exact: false, outer: false });
  assert.deepEqual(r.actualBracketInclusions, {
    innerSubsetExact: true, exactSubsetOuter: true, innerSubsetNominal: true, nominalSubsetOuter: true,
    counterexampleInnerExact: null, counterexampleExactOuter: null,
  });
  assert.deepEqual(r.rows.map((p) => p.grade), [[1, 1], [1, 2], [2, 1]]);
  assert.deepEqual(r.rows[0].membership, { inner: true, nominal: true, exact: true, outer: true });
  assert.deepEqual(r.rows[0].estimated.EoverN, [null]);
  assert.deepEqual(r.rows[0].exact.EoverN, [null]);
  assert.deepEqual(r.rows[0].slack, { inner: [0], nominal: [0], exact: [0], outer: [0] });
  assert.deepEqual(r.rows[1].estimated, evaluateReport([1, 2], h, { tau: 0.25 }));
  close(r.rows[1].slack.inner[0] as number, -0.05);
  close(r.rows[1].slack.nominal[0] as number, 0.05);
  close(r.rows[1].slack.exact[0] as number, -0.05);
  close(r.rows[1].slack.outer[0] as number, 0.15);
});

test("protectionEnvelopes checks actual failures even when the coefficient discrepancy is within advisory tolerance", () => {
  const h = pairE([0.2]);
  const x = pairE([0.3000000000000001]);
  const options = { tau: 0.25, q: [0.30000000000000004], epsilon: 0.1 };
  const raw = protectionEnvelopes(h, x, options);
  assert.equal(raw.coefficientCheck.strictEnvelopeHolds, false);
  assert.equal(raw.coefficientCheck.withinCoefficientTolerance, true);
  assert.equal(raw.actualBracketInclusions.innerSubsetExact, false);
  assert.deepEqual(raw.actualBracketInclusions.counterexampleInnerExact, [1, 2]);
  const tolerant = protectionEnvelopes(h, x, { ...options, feasibilityTol: 1e-12 });
  assert.equal(tolerant.actualBracketInclusions.innerSubsetExact, true);
  assert.equal(tolerant.rows[1].membership.exact, true);
  assert.deepEqual(tolerant.coefficientCheck, raw.coefficientCheck);
  const failed = protectionEnvelopes(pairE([0.2]), pairE([0.7]), { tau: 0.25, q: [0.4], epsilon: 0.01 });
  assert.equal(failed.actualBracketInclusions.innerSubsetExact, false);
  assert.equal(failed.actualBracketInclusions.exactSubsetOuter, false);
  assert.deepEqual(failed.actualBracketInclusions.counterexampleInnerExact, [1, 2]);
  assert.deepEqual(failed.actualBracketInclusions.counterexampleExactOuter, [2, 1]);
});

test("protectionEnvelopes does not clip thresholds or drop zero-weight or unprotected criteria from coefficient checks", () => {
  const E = pairE([0, 1]);
  const r = protectionEnvelopes(E, E, { tau: 0.25, w: [1, 0], q: [null, 0.1], epsilon: [2, 0.2] });
  assert.deepEqual(r.innerThreshold, [null, -0.1]);
  close(r.outerThreshold[1] as number, 0.3);
  assert.deepEqual(r.rows[1].membership, { inner: false, nominal: false, exact: false, outer: false });
  assert.deepEqual(r.rows[2].membership, { inner: false, nominal: true, exact: true, outer: true });
  assert.deepEqual(r.rows[1].slack.nominal, [null, -0.9]);
  const unclipped = protectionEnvelopes(pairE([0]), pairE([0]), { tau: 0.25, q: [1], epsilon: 0.2 });
  assert.deepEqual(unclipped.outerThreshold, [1.2]);
  const allCoefficients = protectionEnvelopes(pairE([0, 0.1]), pairE([0, 0.5]), { tau: 0.25, w: [1, 0], q: [null, null], epsilon: 0.1 });
  assert.equal(allCoefficients.coefficientCheck.strictEnvelopeHolds, false);
  close(allCoefficients.coefficientCheck.maxAbs[1], 0.4);
  assert.deepEqual(allCoefficients.counts, { inner: 3, nominal: 3, exact: 3, outer: 3 });
});

test("protectionEnvelopes distinguishes empty inner and exact sets and handles empty and declared-order families", () => {
  const h = pairE([0]);
  const x = pairE([0.05]);
  const r = protectionEnvelopes(h, x, { tau: 0.25, q: [0.1], epsilon: 0.2, family: { kind: "exactly", G: 2 } });
  assert.deepEqual(r.counts, { inner: 0, nominal: 1, exact: 1, outer: 1 });
  assert.deepEqual(r.empty, { inner: true, nominal: false, exact: false, outer: false });
  const none = protectionEnvelopes(h, x, { tau: 0.25, q: [0.1], epsilon: 0.2, family: { kind: "exactly", G: 3 } });
  assert.equal(none.family.size, 0);
  assert.deepEqual(none.rows, []);
  assert.deepEqual(none.empty, { inner: true, nominal: true, exact: true, outer: true });
  assert.equal(none.actualBracketInclusions.innerSubsetExact, true);
  const ordered = protectionEnvelopes(h, x, { tau: 0.25, q: [0.1], epsilon: 0.2, family: { kind: "order", order: [1, 0] } });
  assert.deepEqual(ordered.rows.map((p) => p.grade), [[1, 1], [2, 1]]);
  const blocked = protectionEnvelopes(h, x, { tau: 0.25, q: [0.1], epsilon: 0.2, family: { kind: "order", order: [0, 1], blocks: [2] } });
  assert.equal(blocked.rows.length, 1);
});

test("protectionEnvelopes uses count tolerance without division and finds the first counterexample over the full family", () => {
  const E: ErrorArray = {
    ids: ["A", "B", "C"], criteria: ["c"],
    e: [[[NaN, 0.24, 0.2], [0.76, NaN, 0.2], [0.8, 0.8, NaN]]],
  };
  const options = { tau: 0.25, q: [0.2], epsilon: 0, family: { kind: "order" as const, order: [0, 1, 2], exact: 3 } };
  const insufficient = protectionEnvelopes(E, E, { ...options, feasibilityTol: 0.02 });
  assert.equal(insufficient.rows[0].N, 3);
  close(insufficient.rows[0].slack.nominal[0] as number, -0.04);
  assert.equal(insufficient.rows[0].membership.nominal, false, "a .02 count tolerance must not become a .02 fraction tolerance");
  assert.equal(protectionEnvelopes(E, E, { ...options, feasibilityTol: 0.05 }).rows[0].membership.nominal, true);
  const approximate: ErrorArray = { ...E, e: [E.e[0].map((row, i) => row.map((_, j) => i === j ? NaN : 0.1))] };
  const tiedLaw = finiteLawPairwise([[0, 0, 0]], [1], { criteria: ["c"] });
  const full = protectionEnvelopes(approximate, tiedLaw, { tau: 0.25, q: [0.2], epsilon: 0 });
  assert.equal(full.rows.length, 13);
  assert.deepEqual(full.actualBracketInclusions.counterexampleInnerExact, [1, 1, 2]);
  assert.deepEqual(full.counts, { inner: 13, nominal: 13, exact: 1, outer: 13 });
});

test("protectionEnvelopes validates labels, coefficient ranges, vector lengths, tolerances, loss, families and options", () => {
  const E = pairE([0.2]);
  const options = { tau: 0.25, q: [0.2], epsilon: 0.1 };
  for (const q of [[], [NaN], [Infinity], [-0.1], [1.1], [undefined]]) {
    assert.throws(() => protectionEnvelopes(E, E, { ...options, q } as never), /q/);
  }
  for (const epsilon of [-1, NaN, Infinity, [], [0.1, 0.2], [undefined]]) {
    assert.throws(() => protectionEnvelopes(E, E, { ...options, epsilon } as never), /epsilon/);
  }
  for (const key of ["feasibilityTol", "coefficientTol"] as const) {
    for (const v of [-1, NaN, Infinity, null]) assert.throws(() => protectionEnvelopes(E, E, { ...options, [key]: v } as never), new RegExp(key));
  }
  assert.throws(() => protectionEnvelopes(E, { ...E, ids: ["B", "A"] }, options), /matching ids/);
  assert.throws(() => protectionEnvelopes(E, { ...E, criteria: ["other"] }, options), /matching ids and criteria/);
  assert.throws(() => protectionEnvelopes(E, { ...E, ids: ["A", "A"] }, options), /distinct/);
  assert.throws(() => protectionEnvelopes(E, { ...E, e: [] }, options), /nonempty/);
  assert.throws(() => protectionEnvelopes(E, pairE([0.1, 0.2]), options), /matching dimensions/);
  assert.throws(() => protectionEnvelopes(E, pairE([-0.1]), options), /\[0, 1\]/);
  assert.throws(() => protectionEnvelopes(pairE([1.1]), E, options), /\[0, 1\]/);
  // Approximate coefficients need not be reciprocal complements or establish a realizable joint law.
  assert.doesNotThrow(() => protectionEnvelopes(pairE([0.2], [0.2]), E, options));
  assert.throws(() => protectionEnvelopes(E, E, { ...options, tau: 0.6 }), /tau/);
  assert.throws(() => protectionEnvelopes(E, E, { ...options, w: [2] }), /sum to 1/);
  assert.throws(() => protectionEnvelopes(E, E, { ...options, family: { kind: "all", extra: 1 } } as never), /unknown key/);
  assert.throws(() => protectionEnvelopes(E, E, { ...options, tieTol: 0 } as never), /unknown option/);
  assert.throws(() => protectionEnvelopes(E, E, 0 as never), /options object expected/);
  const big: ErrorArray = { ids: Array.from({ length: 9 }, (_, i) => `U${i}`), criteria: ["c1"], e: [Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => i === j ? NaN : 0.5))] };
  assert.throws(() => protectionEnvelopes(big, big, options), /exact enumeration covers at most/);
});

test("drawErrors retains original integer weak-error tallies, including ties and non-dyadic shares", () => {
  const r = drawErrors([[1, 1], [2, 1], [0, 1], [1, 1]]);
  assert.equal(r.S, 4);
  assert.deepEqual(r.counts, [[[NaN, 3], [3, NaN]]]);
  assert.deepEqual(r.e, [[[NaN, 0.75], [0.75, NaN]]]);
  const nonDyadic = drawErrors(Array.from({ length: 22 }, (_, s) => s < 15 ? [0, 1] : [1, 0]));
  assert.equal(nonDyadic.counts[0][0][1], 15);
  assert.equal(nonDyadic.e[0][0][1], 15 / 22);
  assert.notEqual(nonDyadic.e[0][0][1] * nonDyadic.S, nonDyadic.counts[0][0][1]);
  assert.equal(nonDyadic.counts[0][1][0], 7);
  nonDyadic.counts[0][0][1] = 0;
  assert.equal(nonDyadic.e[0][0][1], 15 / 22, "counts and probabilities are separate returned arrays");
  assert.throws(() => drawErrors([]), /nonempty/);
  assert.throws(() => drawErrors([[1, 0], [1, 0, 2]]), /as draws\[0\]/);
  assert.throws(() => drawErrors([[1, 0]], { extra: true } as never), /unknown option/);
});

test("drawErrors original public toy32 tensor and every fixed prefix retain axes and exact count/S shares", () => {
  // Released source input only, exported with full precision from the original public package tensor.
  // This contains states, not an engine- or parity-generated expected answer.
  const source = JSON.parse(readFileSync(new URL("../../data/released/toy-joint-draws.json", import.meta.url), "utf8"));
  const tensor = source.arrays.joint;
  const states: number[][][] = tensor.values;
  assert.deepEqual(source.facts.axis_order, ["draw", "entity", "criterion"]);
  assert.equal(source.facts.draws, 32);
  assert.equal(source.facts.n, 3);
  assert.equal(source.facts.K, 2);
  for (let S = 1; S <= states.length; S += 1) {
    const r = drawErrors(states.slice(0, S), { ids: tensor.ids, criteria: tensor.criteria });
    assert.equal(r.S, S);
    assert.deepEqual(r.ids, ["001", "site-B", "site C"]);
    assert.deepEqual(r.criteria, ["need_A", "need_B"]);
    for (let k = 0; k < 2; k += 1) {
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          if (i === j) {
            assert.ok(Number.isNaN(r.counts[k][i][j]));
          } else {
            // Direct event definition independently checks axis handling and the retained original tally.
            const count = states.slice(0, S).filter((state) => state[i][k] <= state[j][k]).length;
            assert.equal(r.counts[k][i][j], count);
            assert.ok(Number.isInteger(r.counts[k][i][j]));
            assert.equal(r.e[k][i][j], r.counts[k][i][j] / S);
          }
        }
      }
    }
  }
});
