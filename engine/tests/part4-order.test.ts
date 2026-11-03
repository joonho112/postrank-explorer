import { test } from "node:test";
import assert from "node:assert/strict";
import { finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { type Family } from "../src/report.ts";
import { evaluateReport } from "../src/risk.ts";
import {
  enumerateReports, exactOptimum, familyInfo, fixedOrderDP, pairConstrainedOptimum, weightBreakpoints,
  type PairConstrainedOptimum, type WeightBreakpoints,
} from "../src/optimize.ts";

const close = (actual: number, expected: number, tol = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} differs from ${expected}`);

function constantErrors(n: number, value: number, K = 1): ErrorArray {
  return {
    ids: Array.from({ length: n }, (_, i) => `U${i}`),
    criteria: Array.from({ length: K }, (_, k) => `C${k}`),
    e: Array.from({ length: K }, () => Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? Number.NaN : value))),
  };
}

function twoUnitErrors(forward: [number, number]): ErrorArray {
  return {
    ids: ["A", "B"], criteria: ["first", "second"],
    e: forward.map((value) => [[Number.NaN, value], [1 - value, Number.NaN]]),
  };
}

function cuts(g: number[], order: readonly number[]): number[] {
  return order.flatMap((u, p) => p > 0 && g[u] !== g[order[p - 1]] ? [p] : []);
}

function packageCompare(a: number[], b: number[], order: readonly number[]): number {
  const ac = cuts(a, order);
  const bc = cuts(b, order);
  if (ac.length !== bc.length) return ac.length - bc.length;
  for (let p = 0; p < ac.length; p += 1) if (ac[p] !== bc[p]) return ac[p] - bc[p];
  return 0;
}

/** An independent small-family check: enumerate first, filter whole grade vectors, then evaluate each. */
function checkFiltered(
  E: ErrorArray, family: Family, stating: [number, number][], tau = 0.25,
  w?: number[], tieTol = 1e-12, maxTies = Infinity,
): PairConstrainedOptimum {
  const eligible = Array.from(enumerateReports(E.ids.length, family), (g) => Array.from(g))
    .filter((g) => stating.every(([above, below]) => g[above] < g[below]));
  const result = pairConstrainedOptimum(E, { tau, w, family, stating, tieTol, maxTies });
  const base = familyInfo(E.ids.length, family);
  assert.deepEqual(result.baseFamily, base);
  assert.equal(result.family.baseSize, base.size);
  assert.equal(result.family.size, eligible.length);
  assert.equal(result.family.sizeExact, BigInt(eligible.length));
  assert.equal(Object.getOwnPropertyDescriptor(result.family, "sizeExact")?.enumerable, false);
  assert.equal(result.label, family.kind === "order" ? "optimal-within-order" : "exact-within-family");
  if (stating.length > 0) {
    assert.equal(result.family.name, `𝒜_S (${base.name})`);
    assert.equal(result.family.words, `${base.words} satisfying the stated pair directions`);
    assert.equal(result.containsAllWithheld, false);
  }
  assert.equal(result.empty, eligible.length === 0);
  if (result.empty) {
    assert.equal("grade" in result, false);
    assert.equal("risk" in result, false);
    return result;
  }
  const evaluated = eligible.map((grade) => ({ grade, evaluation: evaluateReport(grade, E, { tau, w }) }));
  const minimum = Math.min(...evaluated.map((row) => row.evaluation.risk));
  const minimizing = evaluated.filter((row) => row.evaluation.risk <= minimum + tieTol).map((row) => row.grade);
  assert.equal(result.tieCount, minimizing.length);
  assert.deepEqual(result.grades, minimizing.slice(0, maxTies));
  const representative = family.kind === "order"
    ? [...minimizing].sort((a, b) => packageCompare(a, b, family.order))[0]
    : minimizing[0];
  assert.deepEqual(result.grade, representative);
  assert.deepEqual(result.evaluation, evaluateReport(representative, E, { tau, w }));
  close(result.risk, minimum, tieTol + 1e-14);
  if (result.label === "optimal-within-order") {
    assert.equal(result.gradesOrder, "lexicographic");
    assert.equal(result.tieCountExact, BigInt(minimizing.length));
    assert.deepEqual(result.order, family.kind === "order" ? family.order : []);
    assert.deepEqual(result.cuts, cuts(representative, result.order));
  }
  return result;
}

const LAW = finiteLawPairwise([
  [[5, 4], [4, 2], [3, 5], [2, 1], [1, 3]],
  [[4, 1], [5, 3], [2, 4], [3, 5], [1, 2]],
  [[3, 3], [5, 5], [4, 1], [1, 2], [2, 4]],
  [[5, 2], [4, 5], [3, 4], [2, 3], [1, 1]],
], [0.25, 0.25, 0.25, 0.25]);

test("pair constraints: enumerable families match complete filtered enumeration, including all minimizing ties", () => {
  const families: Family[] = [
    { kind: "all" }, { kind: "atMost", G: 2 }, { kind: "atMost", G: 3 },
    { kind: "exactly", G: 1 }, { kind: "exactly", G: 3 }, { kind: "atMost", G: 0 },
  ];
  for (const family of families) {
    for (const stating of [[[0, 1]], [[1, 0]], [[0, 2], [2, 4]], [[0, 1], [1, 0]]] as [number, number][][]) {
      checkFiltered(LAW, family, stating, 0.25, [0.5, 0.5], 0);
    }
  }
  const flat = constantErrors(5, 0.25);
  const full = checkFiltered(flat, { kind: "all" }, [[0, 4]], 0.25);
  const short = checkFiltered(flat, { kind: "all" }, [[0, 4]], 0.25, undefined, 1e-12, 2);
  assert.equal(short.tieCount, full.tieCount);
  assert.ok(!short.empty && short.grades.length < Number(short.tieCount));
});

test("pair constraints: fixed-order DP matches filtered small orders, caps, exact counts and indivisible blocks", () => {
  const orders = [[0, 1, 2, 3, 4], [3, 1, 4, 0, 2], [4, 3, 2, 1, 0]];
  for (const order of orders) {
    for (const blocks of [undefined, [2, 1, 2], [1, 3, 1]]) {
      const m = blocks?.length ?? order.length;
      const families: Family[] = [{ kind: "order", order, blocks }];
      for (let G = 0; G <= m + 1; G += 1) {
        families.push({ kind: "order", order, blocks, G });
        families.push({ kind: "order", order, blocks, exact: G });
      }
      families.push({ kind: "order", order, blocks, G: 2, exact: 3 });
      for (const family of families) {
        for (const stating of [
          [[order[0], order[4]]], [[order[4], order[0]]],
          [[order[0], order[2]], [order[1], order[4]]],
          [[order[0], order[1]]], [[order[0], order[4]], [order[4], order[0]]],
        ] as [number, number][][]) checkFiltered(LAW, family, stating, 0.25, [0.5, 0.5], 0);
      }
    }
  }
});

test("pair constraints: package representative is fewer grades then earlier cuts, with a lexicographic tied list", () => {
  const E = constantErrors(5, 0.25);
  const family: Family = { kind: "order", order: [4, 2, 0, 3, 1], G: 4 };
  const result = checkFiltered(E, family, [[4, 1]], 0.25, undefined, 0, 1);
  assert.ok(!result.empty && result.label === "optimal-within-order");
  assert.deepEqual(result.cuts, [1]);
  assert.equal(result.G, 2);
  assert.equal(result.tieCount, 14);
  assert.notDeepEqual(result.grade, result.grades[0]);
  assert.deepEqual(result.blocks, [1, 1, 1, 1, 1]);
  close(result.saving, 0);
  const exact = checkFiltered(E, { ...family, exact: 3 }, [[4, 1]], 0.25, undefined, 0);
  assert.ok(!exact.empty && exact.label === "optimal-within-order");
  assert.deepEqual(exact.cuts, [1, 2]);
});

test("pair constraints: no constraints preserve every ordinary result field and empty label", () => {
  const families: Family[] = [
    { kind: "all" }, { kind: "atMost", G: 3 }, { kind: "exactly", G: 0 },
    { kind: "order", order: [3, 0, 4, 2, 1], G: 3, blocks: [2, 1, 2] },
    { kind: "order", order: [0, 1, 2, 3, 4], exact: 6 },
  ];
  for (const family of families) {
    const options = { tau: 0.25, w: [0.25, 0.75], family, maxTies: 2, tieTol: 0 };
    const ordinary = family.kind === "order" ? fixedOrderDP(LAW, options) : exactOptimum(LAW, options);
    const constrained = pairConstrainedOptimum(LAW, options);
    const { baseFamily, stating, ...result } = constrained;
    const { baseSize, ...label } = result.family;
    assert.deepEqual({ ...result, family: label }, ordinary);
    assert.equal(baseSize, ordinary.family.size);
    assert.deepEqual(baseFamily, ordinary.family);
    assert.deepEqual(stating, []);
    if (!constrained.empty && constrained.label === "optimal-within-order" && !ordinary.empty && ordinary.label === "optimal-within-order") {
      assert.equal(constrained.tieCountExact, ordinary.tieCountExact);
    }
  }
});

test("pair constraints: duplicate normalization, contradictory cycles, reverse directions and blocked endpoints", () => {
  const E = constantErrors(4, 0.25);
  const stating: [number, number][] = [[0, 3], [1, 2], [0, 3], [1, 2]];
  for (const family of [{ kind: "all" }, { kind: "order", order: [0, 1, 2, 3] }] as Family[]) {
    const duplicate = pairConstrainedOptimum(E, { tau: 0.25, family, stating });
    const unique = pairConstrainedOptimum(E, { tau: 0.25, family, stating: [[0, 3], [1, 2]] });
    assert.deepEqual(duplicate, unique);
    assert.deepEqual(duplicate.stating, [[0, 3], [1, 2]]);
    checkFiltered(E, family, [[0, 1], [1, 2], [2, 0]]);
  }
  for (const [family, pairs] of [
    [{ kind: "order", order: [0, 1, 2, 3], G: 1 }, [[0, 3]]],
    [{ kind: "order", order: [0, 1, 2, 3], blocks: [2, 2] }, [[0, 1]]],
    [{ kind: "order", order: [0, 1, 2, 3] }, [[3, 0]]],
  ] as [Family, [number, number][]][]) {
    const result = checkFiltered(E, family, pairs);
    assert.equal(result.empty, true);
    assert.equal(result.label, "optimal-within-order");
  }
});

test("pair constraints: risk-scale tolerance keeps the full band and maxTies only truncates its list", () => {
  const E = constantErrors(4, 0.25);
  E.e[0][0][3] += 3e-6;
  E.e[0][2][3] += 3e-6;
  for (const family of [{ kind: "all" }, { kind: "atMost", G: 3 }] as Family[]) {
    const narrow = checkFiltered(E, family, [[0, 1]], 0.25, undefined, 0);
    const wide = checkFiltered(E, family, [[0, 1]], 0.25, undefined, 1.1e-6, 1);
    assert.ok(!narrow.empty && !wide.empty);
    assert.ok(wide.tieCount > narrow.tieCount);
    assert.equal(wide.grades.length, 1);
  }
  // A binary-exact small perturbation also exercises the constrained DP's ordinary tolerant tie policy.
  const D = constantErrors(4, 0.25);
  D.e[0][0][3] += 2 ** -20;
  checkFiltered(D, { kind: "order", order: [0, 1, 2, 3], G: 2 }, [[0, 3]], 0.25, undefined, 2 ** -20);
});

test("pair constraints: exact feasible counts retain number/string boundaries and hidden BigInts without enumeration", () => {
  for (const n of [55, 56]) {
    const E = constantErrors(n, 0.25);
    const result = pairConstrainedOptimum(E, {
      tau: 0.25, family: { kind: "order", order: Array.from({ length: n }, (_, i) => i) },
      stating: [[0, 1]], maxTies: 2, tieTol: 0,
    });
    assert.ok(!result.empty && result.label === "optimal-within-order");
    const feasible = 1n << BigInt(n - 2); // one mandatory boundary, all remaining boundaries freely chosen
    assert.equal(result.family.sizeExact, feasible);
    assert.equal(result.tieCountExact, feasible);
    assert.equal(result.family.size, n === 55 ? Number(feasible) : feasible.toString());
    assert.equal(result.tieCount, result.family.size);
    assert.equal(result.baseFamily.sizeExact, feasible * 2n);
    assert.equal(result.family.baseSize, result.baseFamily.size);
    assert.equal(result.gradesOrder, "package");
    assert.equal(result.grades.length, 2);
    assert.deepEqual(result.cuts, [1]);
    assert.equal(Object.getOwnPropertyDescriptor(result, "tieCountExact")?.enumerable, false);
    assert.doesNotThrow(() => JSON.stringify(result));
  }
});

test("pair constraints: n97 uses polynomial order DP for cap4, uncapped and impossible full chains", () => {
  const n = 97;
  const E = constantErrors(n, 0.25);
  const order = Array.from({ length: n }, (_, i) => i);
  const capped = pairConstrainedOptimum(E, { tau: 0.25, family: { kind: "order", order, G: 4 }, stating: [[0, 1]], maxTies: 3 });
  assert.ok(!capped.empty && capped.label === "optimal-within-order");
  // Mandatory cut after unit 0; choose zero, one or two of the remaining 95 boundaries.
  assert.equal(capped.family.size, 1 + 95 + 95 * 94 / 2);
  assert.equal(capped.tieCount, capped.family.size);
  assert.equal(capped.baseFamily.size, 1 + 96 + 96 * 95 / 2 + 96 * 95 * 94 / 6);
  assert.deepEqual(capped.cuts, [1]);
  const uncapped = pairConstrainedOptimum(E, { tau: 0.25, family: { kind: "order", order }, stating: [[0, 1]], maxTies: 1 });
  assert.ok(!uncapped.empty && uncapped.label === "optimal-within-order");
  assert.equal(uncapped.family.sizeExact, 2n ** 95n);
  assert.equal(uncapped.tieCountExact, 2n ** 95n);
  const chain: [number, number][] = order.slice(1).map((i) => [i - 1, i]);
  const impossible = pairConstrainedOptimum(E, { tau: 0.25, family: { kind: "order", order, G: 4 }, stating: chain });
  assert.equal(impossible.empty, true);
  assert.equal(impossible.family.sizeExact, 0n);
  const strict = pairConstrainedOptimum(E, { tau: 0.25, family: { kind: "order", order, exact: n }, stating: chain });
  assert.ok(!strict.empty && strict.label === "optimal-within-order");
  assert.equal(strict.family.size, 1);
  assert.deepEqual(strict.grade, order.map((i) => i + 1));
});

test("pair constraints: invalid input and enumeration budgets retain ordinary validation", () => {
  const E = constantErrors(3, 0.25);
  for (const stating of [null, 1, {}, [[0]], [[0, 1, 2]], [[0, 0]], [[-1, 1]], [[0, 3]], [[0.5, 1]], [[NaN, 1]], [["0", 1]], [new Int32Array([0, 1])]]) {
    assert.throws(() => pairConstrainedOptimum(E, { tau: 0.25, stating } as never), /stating|distinct unit indices/);
  }
  for (const options of [
    { tau: 0.25, q: [0.5] }, { tau: 0.25, maxTies: 0 }, { tau: 0.25, maxTies: 1.5 },
    { tau: 0.25, tieTol: -1 }, { tau: 0.25, tieTol: Infinity }, { tau: 0 }, { tau: 0.6 },
    { tau: 0.25, w: [0] }, { tau: 0.25, family: { kind: "order", order: [0, 1, 1] } },
    { tau: 0.25, family: { kind: "order", order: [0, 1, 2], blocks: [1, 1] }, stating: [[1, 0]] },
    { tau: 0.25, family: { kind: "all", extra: true } },
  ]) assert.throws(() => pairConstrainedOptimum(E, options as never));
  assert.throws(() => pairConstrainedOptimum(E, 0.25 as never), /options object expected/);
  assert.throws(() => pairConstrainedOptimum(constantErrors(21, 0.25), { tau: 0.25, stating: [[0, 1]] }), /at most 20 units/);
  assert.throws(() => pairConstrainedOptimum(constantErrors(9, 0.25), { tau: 0.25, stating: [[0, 1], [1, 0]] }), /at most 600,000 reports/);
});

function path(E: ErrorArray, options: Parameters<typeof weightBreakpoints>[1]): WeightBreakpoints {
  const result = weightBreakpoints(E, options);
  assert.equal(result.empty, false);
  return result as WeightBreakpoints;
}

test("weight envelope maximum: exact interior peak has risk units, distinct from deterministic minimax", () => {
  const E = finiteLawPairwise([[[1, 0], [0, 1]]], [1]);
  const result = path(E, { tau: 0.25, family: { kind: "exactly", G: 2 }, tieTol: 0 });
  assert.deepEqual(result.envelopeMaximum, { risk: 0.5, intervals: [{ from: 0.5, to: 0.5 }], tieTol: 0 });
  const criterionWorst = Array.from(enumerateReports(2, { kind: "exactly", G: 2 }), (g) =>
    Math.max(evaluateReport(g, E, { tau: 0.25, w: [1, 0] }).risk,
      evaluateReport(g, E, { tau: 0.25, w: [0, 1] }).risk));
  assert.equal(Math.min(...criterionWorst), 1);
  assert.ok(result.envelopeMaximum.risk < Math.min(...criterionWorst));
});

test("weight envelope maximum: flat maximizing plateau, constant envelope and end-only reports are retained", () => {
  const E = twoUnitErrors([0, 1]);
  const plateau = path(E, { tau: 0.25, tieTol: 0 });
  assert.deepEqual(plateau.envelopeMaximum, { risk: 0.25, intervals: [{ from: 0.25, to: 0.75 }], tieTol: 0 });
  const constant = path(E, { tau: 0.2, family: { kind: "exactly", G: 1 } });
  assert.deepEqual(constant.envelopeMaximum, { risk: 0.2, intervals: [{ from: 0, to: 1 }], tieTol: 1e-12 });
  const endpoint = path(twoUnitErrors([0, 0.25]), { tau: 0.25, tieTol: 0 });
  assert.ok(endpoint.intervals.some((interval) => interval.wFrom === 0 && interval.wTo === 0));
  assert.deepEqual(endpoint.envelopeMaximum, { risk: 0.25, intervals: [{ from: 0, to: 0 }], tieTol: 0 });
  const empty = weightBreakpoints(E, { tau: 0.25, family: { kind: "atMost", G: 0 } });
  assert.equal(empty.empty, true);
  assert.equal("envelopeMaximum" in empty, false);
});

test("weight envelope maximum: endpoint maxima and risk ties do not widen weight coordinates", () => {
  const family: Family = { kind: "order", order: [0, 1], exact: 2 };
  const decreasing = path(twoUnitErrors([0.2, 0.8]), { tau: 0.25, family });
  assert.deepEqual(decreasing.envelopeMaximum.intervals, [{ from: 0, to: 0 }]);
  close(decreasing.envelopeMaximum.risk, 0.8);
  const increasing = path(twoUnitErrors([0.8, 0.2]), { tau: 0.25, family });
  assert.deepEqual(increasing.envelopeMaximum.intervals, [{ from: 1, to: 1 }]);
  const almostFlat = twoUnitErrors([0.3, 0.3 + 5e-13]);
  const exact = path(almostFlat, { tau: 0.25, family, tieTol: 0 });
  assert.deepEqual(exact.envelopeMaximum.intervals, [{ from: 0, to: 0 }]);
  const tied = path(almostFlat, { tau: 0.25, family, tieTol: 1e-12 });
  assert.deepEqual(tied.envelopeMaximum.intervals, [{ from: 0, to: 0 }, { from: 1, to: 1 }]);
  assert.equal(tied.envelopeMaximum.tieTol, 1e-12);
});

test("weight envelope maximum agrees with independent all-line intersections on a small family", () => {
  const E: ErrorArray = {
    ids: LAW.ids.slice(0, 4), criteria: LAW.criteria,
    e: LAW.e.map((matrix) => matrix.slice(0, 4).map((row) => row.slice(0, 4))),
  };
  for (const family of [{ kind: "all" }, { kind: "atMost", G: 3 }, { kind: "exactly", G: 2 }] as Family[]) {
    const reports = Array.from(enumerateReports(4, family));
    const lines = reports.map((grade) => {
      const at0 = evaluateReport(grade, E, { tau: 0.3, w: [0, 1] }).risk;
      const at1 = evaluateReport(grade, E, { tau: 0.3, w: [1, 0] }).risk;
      return { a: at0, b: at1 - at0 };
    });
    const candidates = [0, 1];
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[i].b === lines[j].b) continue;
        const weight = (lines[j].a - lines[i].a) / (lines[i].b - lines[j].b);
        if (weight >= 0 && weight <= 1) candidates.push(weight);
      }
    }
    const lower = (weight: number) => Math.min(...lines.map(({ a, b }) => a + weight * b));
    let maximum = Number.NEGATIVE_INFINITY;
    for (const weight of candidates) maximum = Math.max(maximum, lower(weight));
    const result = path(E, { tau: 0.3, family });
    close(result.envelopeMaximum.risk, maximum);
    for (const { from, to } of result.envelopeMaximum.intervals) {
      close(lower(from), maximum);
      close(lower(to), maximum);
      close(lower((from + to) / 2), maximum);
    }
  }
});
