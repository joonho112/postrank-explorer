import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type ErrorArray, finiteLawPairwise } from "../src/pairwise.ts";
import { type Family } from "../src/report.ts";
import { enumerateReports, exactOptimum } from "../src/optimize.ts";
import { evaluateReport, krwRisk } from "../src/risk.ts";
import { type KrwCorrespondence, krwBridgeParameters, krwCorrespondence } from "../src/krw.ts";

const close = (got: number, want: number, tolerance = 1e-14) => assert.ok(Math.abs(got - want) <= tolerance, `${got} versus ${want}`);
const pair = (e: number, reverse = 1 - e): ErrorArray => ({ ids: ["A", "B"], criteria: ["score"], e: [[[NaN, e], [reverse, NaN]]] });
const neutral = (n: number): ErrorArray => ({ ids: Array.from({ length: n }, (_, i) => `U${i}`), criteria: ["score"], e: [Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? NaN : 0.5))] });
function nonempty(result: KrwCorrespondence) {
  if (result.postrank.empty || result.krw === null) assert.fail("nonempty family expected");
  return { ...result, postrank: result.postrank, krw: result.krw };
}

test("KRW bridge parameters retain the source axes and unrounded audience/cut/slope values", () => {
  assert.deepEqual(krwBridgeParameters({ lambda: 0.25 }), { lambda: 0.25, tau: 0.2, cut: 0.8, informedShare: 0.6, slope: 3 });
  assert.deepEqual(krwBridgeParameters({ tau: 0.5 }), { lambda: 1, tau: 0.5, cut: 0.5, informedShare: 0, slope: 0 });
  const thirds = krwBridgeParameters({ tau: 0.25 });
  assert.equal(thirds.lambda, 1 / 3); assert.equal(thirds.cut, 0.75); assert.equal(thirds.informedShare, 0.5);
  assert.equal(thirds.slope, (1 - 1 / 3) / (1 / 3));
  assert.deepEqual(krwBridgeParameters({ lambda: 0.25, tau: undefined }), krwBridgeParameters({ lambda: 0.25 }));
  for (const axis of [{ lambda: Number.MIN_VALUE }, { tau: Number.MIN_VALUE }]) {
    const p = krwBridgeParameters(axis);
    assert.equal(p.lambda, Number.MIN_VALUE); assert.equal(p.tau, Number.MIN_VALUE);
    assert.equal(p.cut, 1); assert.equal(p.informedShare, 1); assert.equal(p.slope, Infinity);
  }
});

test("KRW bridge parameters reject absent, duplicate, invalid and unknown axes", () => {
  for (const bad of [undefined, null, 1, [], "0.25", {}, { lambda: undefined }, { lambda: 0.25, tau: 0.2 }, { lambda: null }, { tau: null }, { lambda: "0.25" }, { lambda: 0 }, { lambda: -1 }, { lambda: 1.01 }, { tau: 0 }, { tau: -1 }, { tau: 0.51 }, { lambda: NaN }, { tau: Infinity }, { lambda: 0.25, phi: 0.6 }]) {
    assert.throws(() => krwBridgeParameters(bad as never), /options object|exactly one|lambda|tau|unknown option/);
  }
});

test("the isolated direction/withholding boundary and its neighbors preserve complete scaled-tolerance ties", () => {
  const boundary = nonempty(krwCorrespondence(pair(0.25), { tau: 0.25, tieFree: true }));
  assert.equal(boundary.reportsEnumerated, 3);
  assert.deepEqual(boundary.krw.grades, [[1, 1], [1, 2]]);
  assert.equal(boundary.krw.tieCount, 2); assert.equal(boundary.krw.minRisk, 0);
  assert.equal(boundary.krw.tieTol, 1e-12 / 0.75); assert.equal(boundary.sameFullSet, true);
  for (const [e, grade] of [[0.25 - 1e-8, [1, 2]], [0.25 + 1e-8, [1, 1]]] as const) {
    const r = nonempty(krwCorrespondence(pair(e), { tau: 0.25, tieFree: true }));
    assert.deepEqual(r.krw.grades, [grade]); assert.equal(r.sameFullSet, true);
  }
  // KRW's near-tie is above 1e-12 but inside the required 1e-12/(1-tau).
  const near = nonempty(krwCorrespondence(pair(0.25 + 0.875e-12), { tau: 0.25, tieFree: true }));
  assert.equal(near.krw.tieCount, 2); assert.equal(near.sameFullSet, true);
  const exact = nonempty(krwCorrespondence(pair(0.25 + 0.875e-12), { tau: 0.25, tieFree: true, tieTol: 0 }));
  assert.deepEqual(exact.krw.grades, [[1, 1]]); assert.equal(exact.sameFullSet, true);
});

test("complete optimizer sets are compared before truncation and beyond the chosen representative's risk", () => {
  const three = nonempty(krwCorrespondence(pair(0.5), { lambda: 1, tieFree: true, maxTies: 1 }));
  assert.equal(three.postrank.tieCount, 3); assert.equal(three.krw.tieCount, 3);
  assert.deepEqual(three.postrank.grades, [[1, 1]]); assert.deepEqual(three.krw.grades, [[1, 1]]);
  assert.equal(three.sameFullSet, true);
  const all = nonempty(krwCorrespondence(neutral(4), { tau: 0.5, tieFree: true, maxTies: 2 }));
  assert.equal(all.reportsEnumerated, 75); assert.equal(all.postrank.tieCount, 75); assert.equal(all.krw.tieCount, 75);
  assert.equal(all.krw.grades.length, 2); assert.equal(all.sameFullSet, true);
  // The lexicographic representative withholds, slightly above the raw minimum. The reverse direction is
  // within tolerance of that representative but outside tolerance of the actual minimum.
  const E = pair(0.5 - 0.75e-12);
  const r = nonempty(krwCorrespondence(E, { tau: 0.5, tieFree: true }));
  assert.deepEqual(r.postrank.grade, [1, 1]); assert.equal(r.postrank.risk, 0.5);
  assert.equal(r.postrank.tieCount, 2); assert.deepEqual(r.krw.grades, [[1, 1], [1, 2]]);
  assert.equal(r.sameFullSet, true);
});

test("declared-order representatives and exact/block families retain their actual optimizer rules", () => {
  const E = neutral(3);
  const family: Family = { kind: "order", order: [2, 1, 0], exact: 2 };
  const r = nonempty(krwCorrespondence(E, { tau: 0.5, family, tieFree: true, maxTies: 1 }));
  assert.deepEqual(r.postrank, exactOptimum(E, { tau: 0.5, family, maxTies: 1 }));
  assert.deepEqual(r.postrank.grade, [2, 2, 1]); // Package preference: earlier cut.
  assert.deepEqual(r.krw.grade, [2, 1, 1]); // KRW's lexicographic first.
  assert.equal(r.krw.tieCount, 2); assert.equal(r.sameFullSet, true);
  for (const f of [{ kind: "atMost", G: 2 }, { kind: "exactly", G: 2 }, { kind: "order", order: [0, 1, 2], blocks: [1, 2] }] as Family[]) {
    const out = nonempty(krwCorrespondence(E, { tau: 0.5, family: f, tieFree: true, maxTies: 1 }));
    assert.deepEqual(out.postrank, exactOptimum(E, { tau: 0.5, family: f, maxTies: 1 }));
    assert.equal(out.sameFullSet, true); assert.equal(out.krw.tieCount, out.reportsEnumerated);
  }
});

test("zero tolerance preserves actual optimizer membership when risk-scale rescoring rounds differently", () => {
  const E = neutral(4);
  E.e[0] = E.e[0].map((row, i) => row.map((_, j) => i === j ? NaN : i < j ? 0.05 : 0.95));
  const family: Family = { kind: "order", order: [0, 1, 2, 3] };
  const r = nonempty(krwCorrespondence(E, { tau: 0.05, family, tieFree: true, tieTol: 0, maxTies: 1 }));
  assert.deepEqual(r.postrank, exactOptimum(E, { tau: 0.05, family, tieTol: 0, maxTies: 1 }));
  assert.deepEqual(r.postrank.grades, [[1, 2, 3, 4]]);
  assert.deepEqual(r.krw.grade, [1, 1, 2, 3]); assert.equal(r.krw.tieCount, 3);
  assert.equal(r.sameFullSet, false, "Using raw R minima for postrank instead of the actual Z collector would incorrectly report equality");
  assert.equal(krwCorrespondence(E, { tau: 0.05, family, tieFree: true }).sameFullSet, true);
  const truncated = nonempty(krwCorrespondence({ ...E, e: [E.e[0].map((row, i) => row.map((_, j) => i === j ? NaN : i < j ? 0.2 : 0.8))] }, { tau: 0.2, family, tieFree: true, tieTol: 0, maxTies: 1 }));
  assert.equal(truncated.sameFullSet, false);
});

test("affine residuals use actual public-scorer values over every same-family report", () => {
  const E = pair(0.1);
  const result = nonempty(krwCorrespondence(E, { lambda: 0.25, tieFree: true }));
  const risks = [...enumerateReports(2)].map(g => ({ pr: evaluateReport(g, E, { tau: 0.2 }).risk, kr: krwRisk(g, E, { lambda: 0.25 }) }));
  const maximum = Math.max(...risks.map(row => Math.abs(row.pr - (0.2 + 0.8 * row.kr))));
  assert.ok(maximum > 0, "This decimal case exposes a floating residual; theoretical zero must not be substituted");
  assert.equal(result.maxAffineResidual, maximum);
  assert.equal(result.krw.minRisk, Math.min(...risks.map(row => row.kr)));
  close(result.krw.minRisk, -0.125);
});

test("empty families preserve ordinary metadata while leaving undefined comparisons null", () => {
  const E = neutral(3);
  for (const family of [{ kind: "exactly", G: 4 }, { kind: "order", order: [0, 1, 2], blocks: [1, 2], exact: 3 }] as Family[]) {
    const r = krwCorrespondence(E, { tau: 0.2, family, tieFree: true });
    assert.deepEqual(r.postrank, exactOptimum(E, { tau: 0.2, family }));
    assert.equal(r.family, r.postrank.family); assert.equal(r.family.size, 0);
    assert.equal(r.reportsEnumerated, 0); assert.equal(r.krw, null); assert.equal(r.sameFullSet, null); assert.equal(r.maxAffineResidual, null);
  }
});

test("tie-free declarations, coefficient ranges/complements and supplied equality cubes are validated", () => {
  for (const tieFree of [undefined, false, null, 1, "true"]) assert.throws(() => krwCorrespondence(pair(0.2), { tau: 0.2, tieFree } as never), /tieFree/);
  assert.throws(() => krwCorrespondence(neutral(2), { tau: 0.2, tieFree: true, t: [[[NaN, 0.1], [0.1, NaN]]] }), /tie-free law/);
  for (const t of [[[[NaN, -1e-20], [0, NaN]]], [[[NaN, 2], [0, NaN]]], [[[NaN, NaN], [0, NaN]]], [[[NaN, 0, 0], [0, NaN, 0], [0, 0, NaN]]], []]) {
    assert.throws(() => krwCorrespondence(pair(0.2), { tau: 0.2, tieFree: true, t }), /t|finite/);
  }
  assert.equal(krwCorrespondence(pair(0.2), { tau: 0.2, tieFree: true, t: [[[NaN, 1e-15], [0, NaN]]] }).reportsEnumerated, 3);
  for (const E of [pair(-1e-20), pair(1.01), pair(NaN), pair(Infinity), pair(0.2, 0.7), { ...neutral(2), e: [] }, { ...neutral(2), e: [neutral(2).e[0], neutral(2).e[0]] }]) {
    assert.throws(() => krwCorrespondence(E, { tau: 0.2, tieFree: true }), /probabilities|finite|criterion|nonempty/);
  }
  // Consistency within tolerance is allowed, but still needs the explicit scientific declaration.
  assert.equal(krwCorrespondence(pair(0.2, 0.8 + 5e-13), { tau: 0.2, tieFree: true }).reportsEnumerated, 3);
  const tiedLaw = finiteLawPairwise([[1, 1]], [1]);
  assert.throws(() => krwCorrespondence(tiedLaw, { tau: 0.2, tieFree: true, t: tiedLaw.t }), /complements|tie-free law/);
});

test("correspondence rejects invalid options even on empty families and follows existing enumeration limits", () => {
  const E = pair(0.2);
  for (const options of [undefined, null, 0, [], { tau: 0.2 }, { tau: 0.2, lambda: 0.25, tieFree: true }, { tau: 0.2, tieFree: true, q: [0.1] }, { tau: 0.2, tieFree: true, weights: [1] }]) {
    assert.throws(() => krwCorrespondence(E, options as never), /options object|tieFree|exactly one|unknown option/);
  }
  for (const tieTol of [null, NaN, Infinity, -1, "0"]) assert.throws(() => krwCorrespondence(E, { tau: 0.2, tieFree: true, family: { kind: "exactly", G: 3 }, tieTol } as never), /tieTol/);
  for (const maxTies of [null, 0, -1, 1.1, Infinity, NaN, "2", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => krwCorrespondence(E, { tau: 0.2, tieFree: true, family: { kind: "exactly", G: 3 }, maxTies } as never), /maxTies/);
  assert.throws(() => krwCorrespondence(E, { tau: 0.2, tieFree: true, family: { kind: "all", G: 2 } as never }), /unknown key/);
  assert.throws(() => krwCorrespondence(neutral(21), { tau: 0.2, tieFree: true, family: { kind: "exactly", G: 1 } }), /at most 20 units/);
  assert.throws(() => krwCorrespondence(neutral(9), { tau: 0.2, tieFree: true }), /at most 600,000 reports/);
  const one = nonempty(krwCorrespondence(neutral(20), { tau: 0.2, tieFree: true, family: { kind: "exactly", G: 1 } }));
  assert.equal(one.reportsEnumerated, 1); assert.equal(one.sameFullSet, true);
});

test("all 49 source-grid settings retain the complete 4,683-report domain", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/released/six-sites.json", import.meta.url), "utf8"));
  const a = data.arrays.one;
  const E: ErrorArray = { ids: a.ids, criteria: a.criteria, e: a.e.map((m: (number | null)[][]) => m.map(row => row.map(x => x === null ? NaN : x))) };
  for (let hundredths = 2; hundredths <= 50; ++hundredths) {
    const tau = hundredths / 100;
    const r = nonempty(krwCorrespondence(E, { tau, tieFree: true, maxTies: 4683 }));
    assert.equal(r.reportsEnumerated, 4683); assert.equal(r.sameFullSet, true, `tau=${tau}`);
    assert.equal(r.krw.grades.length, r.krw.tieCount);
    assert.deepEqual(r.postrank, exactOptimum(E, { tau, maxTies: 4683 }));
    assert.ok(r.maxAffineResidual !== null && r.maxAffineResidual < 1e-14);
  }
});
