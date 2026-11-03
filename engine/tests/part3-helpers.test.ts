// Step 7.1: the Part 3 helpers that replace widget code (engine/API.md "Step 7.1: Part 3 helpers").
// statedAgainst, relationChange, cutGrade (report.ts), bestReports (optimize.ts), reportsAtN and ruleGap (frontier.ts):
// hand cases for every rule of the spec, brute-force checks against evaluateReport over small families, and the CDE
// 12-school numbers of Part 3 (data/released/case-cde.json; τ .20, at most 3 grades).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cutGrade, relationChange, scoreOrder, statedAgainst } from "../src/report.ts";
import { bestReports, enumerateReports, exactOptimum } from "../src/optimize.ts";
import { lowerHull, reportCloud, reportsAtN, ruleGap, type ReportCloud } from "../src/frontier.ts";
import { evaluateReport } from "../src/risk.ts";
import { uniforms } from "../src/random.ts";
import type { ErrorArray } from "../src/pairwise.ts";
import * as prCore from "../src/index.ts";

/** An n-unit, K-criterion error array from n × n matrices (diagonal NaN). */
const cube = (...e: number[][][]): ErrorArray => ({
  ids: e[0].map((_, i) => String.fromCharCode(65 + i)),
  criteria: e.map((_, k) => `k${k + 1}`),
  e: e.map((m) => m.map((row, i) => row.map((x, j) => (i === j ? Number.NaN : x)))),
});

/** A tie-free random array on n units (e_ij + e_ji = 1) from the engine stream. */
const randomCube = (n: number, seed: number, K = 1): ErrorArray => {
  const u = uniforms(seed, n * n * K);
  const e = Array.from({ length: K }, (_, k) => {
    const m = Array.from({ length: n }, () => new Array<number>(n).fill(Number.NaN));
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

const isBefore = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  for (let q = 0; q < a.length; q += 1) if (a[q] !== b[q]) return a[q] < b[q];
  return false;
};

test("exports: the six helpers are in the public API", () => {
  for (const name of ["statedAgainst", "relationChange", "cutGrade", "bestReports", "reportsAtN", "ruleGap"]) {
    assert.equal(typeof (prCore as Record<string, unknown>)[name], "function", name);
  }
});

// ---------------------------------------------------------------------------------------------------------
// statedAgainst

test("statedAgainst: stated pairs whose scores run strictly the other way, in pair order, and the units below", () => {
  // g = 1/2/2/3; descending scores 5, 7, 7, 1: unit 0 is stated above 1 and 2, which have larger scores
  const r = statedAgainst([1, 2, 2, 3], [5, 7, 7, 1]);
  assert.deepEqual(r, { count: 2, pairs: [{ above: 0, below: 1 }, { above: 0, below: 2 }], units: [1, 2] });
  // ascending: a smaller score is better, so units 1, 2 and 0 stated above 3 (score 1) run against
  const a = statedAgainst([1, 2, 2, 3], [5, 7, 7, 1], { direction: "ascending" });
  assert.deepEqual(a, { count: 3, pairs: [{ above: 0, below: 3 }, { above: 1, below: 3 }, { above: 2, below: 3 }], units: [3] });
  // the report states j above i (g_j < g_i): above is the unit the report puts higher, whatever its index
  assert.deepEqual(statedAgainst([2, 1], [9, 1]), { count: 1, pairs: [{ above: 1, below: 0 }], units: [0] });
  assert.deepEqual(statedAgainst([2, 1], [1, 9]), { count: 0, pairs: [], units: [] });
  // labels need not be canonical
  assert.deepEqual(statedAgainst([5, 3], [9, 1]), statedAgainst([2, 1], [9, 1]));
  // pair order is row-major (0, 1), (0, 2), …, (1, 2), …: the strict reverse order of the scores
  assert.deepEqual(statedAgainst([1, 2, 3], [1, 2, 3]).pairs, [
    { above: 0, below: 1 },
    { above: 0, below: 2 },
    { above: 1, below: 2 },
  ]);
});

test("statedAgainst: equal scores are never against, and a withheld pair never counts", () => {
  assert.equal(statedAgainst([1, 2], [3, 3]).count, 0);
  assert.equal(statedAgainst([1, 2], [3, 3], { direction: "ascending" }).count, 0);
  // a shared grade withholds the direction even when the scores differ
  assert.equal(statedAgainst([1, 1], [1, 2]).count, 0);
  assert.equal(statedAgainst([1, 1, 1], [3, 1, 2]).count, 0);
  // a unit appears once in units even when it is below several units with worse scores
  const r = statedAgainst([1, 1, 2], [1, 1, 5]);
  assert.deepEqual(r.units, [2]);
  assert.equal(r.count, 2);
});

test("statedAgainst: input checks", () => {
  assert.throws(() => statedAgainst([1, 2], [1]), /one number per unit/);
  assert.throws(() => statedAgainst([1, 2], [1, Number.NaN]), /finite/);
  assert.throws(() => statedAgainst([1, 2], [1, 2], { direction: "up" as never }), /direction/);
  assert.throws(() => statedAgainst([1, 2], [1, 2], { order: [0, 1] } as never), /unknown option "order"/);
  assert.throws(() => statedAgainst([1, 2], [1, 2], "descending" as never), /options object expected/);
  assert.throws(() => statedAgainst([1], [1]), /at least two units/);
  assert.throws(() => statedAgainst([1, 1.5], [1, 2]), /integers/);
});

// ---------------------------------------------------------------------------------------------------------
// relationChange

test("relationChange: the four classes, i's relation to j, and the error stated under g1", () => {
  // (0, 1): withheld → 0 above 1 (newly disclosed); (0, 2): 0 above 2 → withheld (newly withheld);
  // (1, 2): 1 above 2 → 2 above 1 (reversed)
  const E = cube([
    [0, 0.1, 0.2],
    [0.9, 0, 0.3],
    [0.8, 0.7, 0],
  ]);
  const r = relationChange([1, 1, 2], [1, 2, 1], E);
  assert.equal(r.M, 3);
  assert.deepEqual([r.nSame, r.nNewDisclosed, r.nNewWithheld, r.nReversed, r.agreement], [0, 1, 1, 1, 0]);
  assert.deepEqual(r.pairs, [
    { i: 0, j: 1, from: "withheld", to: "above", error: 0.1 },
    { i: 0, j: 2, from: "above", to: "withheld", error: null },
    { i: 1, j: 2, from: "above", to: "below", error: 0.7 },
  ]);
  // without E every error is null; the counts do not change
  const bare = relationChange([1, 1, 2], [1, 2, 1]);
  assert.deepEqual(bare.pairs.map((p) => p.error), [null, null, null]);
  assert.deepEqual([bare.nNewDisclosed, bare.nNewWithheld, bare.nReversed], [1, 1, 1]);
  assert.deepEqual(relationChange([1, 1, 2], [1, 2, 1], null), bare);
  // the same report: every pair the same, no changed pairs; labels need not be canonical
  const same = relationChange([1, 2, 2, 3], [4, 7, 7, 9]);
  assert.deepEqual([same.M, same.nSame, same.agreement, same.pairs.length], [6, 6, 1, 0]);
  // the four counts always add to M
  const x = relationChange([1, 2, 3, 1, 2], [3, 3, 1, 2, 1]);
  assert.equal(x.nSame + x.nNewDisclosed + x.nNewWithheld + x.nReversed, 10);
  assert.equal(x.agreement, x.nSame / 10);
});

test("relationChange: the stated error is the weighted ebar (as statedAbove) with several criteria", () => {
  const e1 = [
    [0, 0.1],
    [0.9, 0],
  ];
  const e2 = [
    [0, 0.5],
    [0.5, 0],
  ];
  const E = cube(e1, e2);
  const up = relationChange([1, 1], [1, 2], E, { w: [0.25, 0.75] });
  assert.equal(up.pairs[0].error, 0.25 * 0.1 + 0.75 * 0.5);
  const down = relationChange([1, 1], [2, 1], E, { w: [0.25, 0.75] });
  assert.equal(down.pairs[0].error, 0.25 * 0.9 + 0.75 * 0.5);
  assert.equal(down.pairs[0].to, "below");
  assert.throws(() => relationChange([1, 1], [1, 2], E), /weights w are required/);
});

test("relationChange: input checks", () => {
  const E = cube([
    [0, 0.5],
    [0.5, 0],
  ]);
  assert.throws(() => relationChange([1, 2], [1, 2, 3]), /one entry per unit/);
  assert.throws(() => relationChange([1, 2, 3], [1, 2, 3], E), /E has 2 units/);
  assert.throws(() => relationChange([1, 2], [1, 2], null, { w: [1] }), /w applies only together with E/);
  assert.throws(() => relationChange([1, 2], [1, 2], E, { tau: 0.2 } as never), /unknown option "tau"/);
  assert.throws(() => relationChange([1, 2], [1, 2], E, { w: [0.5] }), /sum to 1/);
});

// ---------------------------------------------------------------------------------------------------------
// cutGrade

test("cutGrade: cuts after positions of the order; no cuts is the all-withheld report", () => {
  assert.deepEqual(Array.from(cutGrade(12, [4, 8])), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  assert.ok(cutGrade(12, [4, 8]) instanceof Int8Array);
  assert.deepEqual(Array.from(cutGrade(12, [3, 9])), [1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3]);
  assert.deepEqual(Array.from(cutGrade(4, [])), [1, 1, 1, 1]);
  assert.deepEqual(Array.from(cutGrade(2, [1])), [1, 2]);
  assert.deepEqual(Array.from(cutGrade(4, [1, 2, 3])), [1, 2, 3, 4]);
  // the order lists units from the top position down: unit 2 first, then 0, then 1
  assert.deepEqual(Array.from(cutGrade(3, [1], { order: [2, 0, 1] })), [2, 2, 1]);
  assert.deepEqual(Array.from(cutGrade(3, [2], { order: [2, 0, 1] })), [1, 2, 1]);
  assert.deepEqual(Array.from(cutGrade(3, [1], { order: null, blocks: null })), [1, 2, 2]);
});

test("cutGrade: blocks share a grade; a cut with from ≤ c < to throws naming the block", () => {
  // block [2, 3]: positions 2 and 3 together; cuts at 1 and 3 are at its edges, 2 is inside
  assert.deepEqual(Array.from(cutGrade(5, [1, 3], { blocks: [[2, 3]] })), [1, 2, 2, 3, 3]);
  assert.throws(() => cutGrade(5, [2], { blocks: [[2, 3]] }), (err: Error) => err instanceof RangeError && /block \[2, 3\]/.test(err.message));
  assert.throws(() => cutGrade(5, [3], { blocks: [[1, 1], [3, 5]] }), /block \[3, 5\]/);
  assert.throws(() => cutGrade(5, [4], { blocks: [[3, 5]] }), /cut 4 falls inside block \[3, 5\]/);
  // a one-position block never blocks a cut
  assert.deepEqual(Array.from(cutGrade(3, [1, 2], { blocks: [[2, 2]] })), [1, 2, 3]);
  // blocks are positions along the order, not unit indices
  assert.deepEqual(Array.from(cutGrade(4, [2], { order: [3, 2, 1, 0], blocks: [[1, 2], [3, 4]] })), [2, 2, 1, 1]);
});

test("cutGrade: input checks", () => {
  assert.throws(() => cutGrade(1, []), /n must be an integer ≥ 2/);
  assert.throws(() => cutGrade(4, [0]), /1…3/);
  assert.throws(() => cutGrade(4, [4]), /1…3/);
  assert.throws(() => cutGrade(4, [2, 2]), /strictly increasing/);
  assert.throws(() => cutGrade(4, [3, 1]), /strictly increasing/);
  assert.throws(() => cutGrade(4, [1.5]), /integer/);
  assert.throws(() => cutGrade(3, [1], { order: [0, 1] }), /all 3 unit indices/);
  assert.throws(() => cutGrade(3, [1], { order: [0, 1, 1] }), /permutation/);
  assert.throws(() => cutGrade(3, [1], { blocks: [[2, 1]] }), /from ≤ to/);
  assert.throws(() => cutGrade(3, [1], { blocks: [[1, 4]] }), /from ≤ to ≤ 3/);
  assert.throws(() => cutGrade(3, [1], { G: 2 } as never), /unknown option "G"/);
});

// ---------------------------------------------------------------------------------------------------------
// bestReports

test("bestReports: equal risks keep enumeration order (lexicographic canonical grade vectors)", () => {
  // every pair error .5 at τ = .5: all 13 reports on three units have risk .5
  const half = cube([
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ]);
  const r = bestReports(half, { tau: 0.5, k: 13 });
  const all = Array.from(enumerateReports(3), (g) => Array.from(g));
  assert.equal(r.matched, 13);
  assert.deepEqual(r.reports.map((x) => x.grade), all);
  assert.ok(r.reports.every((x) => x.risk === 0.5));
  assert.deepEqual(r.family.name, "𝒜₃");
  assert.equal(r.family.size, 13);
  assert.equal(r.label, "exact-within-family");
  assert.deepEqual(bestReports(half, { tau: 0.5 }).reports.map((x) => x.grade), [[1, 1, 1]]);
  // k above the family size returns every report
  assert.equal(bestReports(half, { tau: 0.5, k: 50 }).reports.length, 13);
});

test("bestReports: risks within tieTol·(1 + |risk|) keep enumeration order; outside it, ascending risk", () => {
  // two units: [1,1] risk τ, [1,2] risk e01 = .3, [2,1] risk e10 = .7
  const E = cube([
    [0, 0.3],
    [0.7, 0],
  ]);
  const grades = (o: Parameters<typeof bestReports>[1]) => bestReports(E, o).reports.map((x) => x.grade);
  assert.deepEqual(grades({ tau: 0.25, k: 3 }), [[1, 1], [1, 2], [2, 1]]);
  assert.deepEqual(grades({ tau: 0.35, k: 3 }), [[1, 2], [1, 1], [2, 1]]);
  // .35 − .3 = .05 ≤ .05·(1 + .3): the earlier report [1,1] comes first
  assert.deepEqual(grades({ tau: 0.35, k: 3, tieTol: 0.05 }), [[1, 1], [1, 2], [2, 1]]);
  // .05 > .03·1.3: outside the tolerance
  assert.deepEqual(grades({ tau: 0.35, k: 3, tieTol: 0.03 }), [[1, 2], [1, 1], [2, 1]]);
  const r = bestReports(E, { tau: 0.35, k: 2 });
  assert.deepEqual(r.reports, [
    { grade: [1, 2], risk: 0.3, N: 1, Ew: 0.3 },
    { grade: [1, 1], risk: 0.35, N: 0, Ew: 0 },
  ]);
});

test("bestReports: the stating filter keeps the reports that state every listed pair (i above j)", () => {
  const E = cube([
    [0, 0.3],
    [0.7, 0],
  ]);
  const only = bestReports(E, { tau: 0.25, k: 3, stating: [[1, 0]] });
  assert.equal(only.matched, 1);
  assert.deepEqual(only.reports.map((x) => x.grade), [[2, 1]]);
  assert.equal(only.reports[0].risk, 0.7);
  // contradictory pairs: nothing matches
  const none = bestReports(E, { tau: 0.25, stating: [[0, 1], [1, 0]] });
  assert.equal(none.matched, 0);
  assert.deepEqual(none.reports, []);
  // three units: reports stating 0 above 1 and 1 above 2 are the strict orders with 0 > 1 > 2 and the cuts
  // that keep 0, 1, 2 in three grades: only 1/2/3
  const R = randomCube(3, 7);
  const chain = bestReports(R, { tau: 0.3, k: 13, stating: [[0, 1], [1, 2]] });
  assert.equal(chain.matched, 1);
  assert.deepEqual(chain.reports[0].grade, [1, 2, 3]);
  // stating 0 above 2 alone: every report with g_0 < g_2, checked by brute force
  const one = bestReports(R, { tau: 0.3, k: 13, stating: [[0, 2]] });
  const expected = Array.from(enumerateReports(3), (g) => Array.from(g)).filter((g) => g[0] < g[2]);
  assert.equal(one.matched, expected.length);
  assert.deepEqual(
    one.reports.map((x) => x.grade).sort((a, b) => (isBefore(a, b) ? -1 : 1)),
    expected,
  );
  assert.ok(one.reports.every((x) => x.grade[0] < x.grade[2]));
  assert.equal(bestReports(R, { tau: 0.3, stating: [] }).matched, 13);
});

test("bestReports: brute force over small families (all, at most, exactly, order) with evaluateReport risks", () => {
  const families = [
    { kind: "all" } as const,
    { kind: "atMost", G: 2 } as const,
    { kind: "exactly", G: 3 } as const,
    { kind: "order", order: [3, 1, 4, 0, 2], G: 3 } as const,
  ];
  for (const seed of [1, 2, 3]) {
    for (const K of [1, 2]) {
      const E = randomCube(5, seed, K);
      const w = K === 1 ? undefined : [0.4, 0.6];
      for (const family of families) {
        for (const stating of [[], [[1, 3]]] as number[][][]) {
          const tau = 0.2 + 0.1 * seed;
          const list = Array.from(enumerateReports(5, family), (g) => Array.from(g))
            .filter((g) => stating.every(([i, j]) => g[i] < g[j]))
            .map((g) => ({ grade: g, ev: evaluateReport(g, E, { tau, w }) }));
          list.sort((a, b) => a.ev.risk - b.ev.risk || (isBefore(a.grade, b.grade) ? -1 : 1));
          const r = bestReports(E, { tau, w, family, k: 7, stating });
          assert.equal(r.matched, list.length);
          assert.deepEqual(
            r.reports,
            list.slice(0, 7).map((x) => ({ grade: x.grade, risk: x.ev.risk, N: x.ev.N, Ew: x.ev.Ew })),
          );
          if (stating.length === 0 && family.kind !== "order") {
            const opt = exactOptimum(E, { tau, w, family });
            assert.ok(!opt.empty);
            assert.deepEqual(r.reports[0].grade, opt.grade);
            assert.equal(r.reports[0].risk, opt.risk);
          }
        }
      }
    }
  }
});

test("bestReports: one pass keeps only the k best (pruning on 47,293 reports; a family where every report ties)", () => {
  const E = randomCube(7, 11);
  const tau = 0.3;
  const list = Array.from(enumerateReports(7), (g) => Array.from(g)).map((g) => ({ grade: g, risk: evaluateReport(g, E, { tau }).risk }));
  list.sort((a, b) => a.risk - b.risk || (isBefore(a.grade, b.grade) ? -1 : 1));
  for (const k of [1, 25, 2000]) {
    const r = bestReports(E, { tau, k });
    assert.equal(r.matched, 47293);
    assert.deepEqual(r.reports.map((x) => x.grade), list.slice(0, k).map((x) => x.grade));
  }
  // 545,835 reports on eight units, all at risk .5: the first k in enumeration order
  const n = 8;
  const half = cube(...[Array.from({ length: n }, () => new Array<number>(n).fill(0.5))]);
  const r = bestReports(half, { tau: 0.5, k: 5 });
  assert.equal(r.matched, 545835);
  const first: number[][] = [];
  for (const g of enumerateReports(n)) {
    first.push(Array.from(g));
    if (first.length === 5) break;
  }
  assert.deepEqual(r.reports.map((x) => x.grade), first);
});

test("bestReports: empty family, budget and input checks", () => {
  const E = randomCube(3, 1);
  const empty = bestReports(E, { tau: 0.2, family: { kind: "exactly", G: 4 } });
  assert.equal(empty.matched, 0);
  assert.deepEqual(empty.reports, []);
  assert.equal(empty.family.size, 0);
  assert.throws(() => bestReports(randomCube(9, 1), { tau: 0.2 }), /at most 600,000 reports/);
  assert.throws(() => bestReports(E, { tau: 0.2, k: 0 }), /k must be an integer ≥ 1/);
  assert.throws(() => bestReports(E, { tau: 0.2, k: 1.5 }), /k must be an integer ≥ 1/);
  assert.throws(() => bestReports(E, { tau: 0.2, stating: [[0, 0]] }), /distinct unit indices/);
  assert.throws(() => bestReports(E, { tau: 0.2, stating: [[0, 3]] }), /distinct unit indices in 0…2/);
  assert.throws(() => bestReports(E, { tau: 0.2, stating: [0, 1] as never }), /stating entry/);
  assert.throws(() => bestReports(E, { tau: 0.2, stating: "01" as never }), /stating must be a list/);
  assert.throws(() => bestReports(E, { tau: 0.7 }), /tau must lie/);
  assert.throws(() => bestReports(E, { tau: 0.2, tieTol: -1 }), /tieTol/);
  assert.throws(() => bestReports(E, { tau: 0.2, q: [0.1] } as never), /unknown option "q"/);
  assert.throws(() => bestReports(E, undefined as never), /options object expected/);
  assert.throws(() => bestReports(E, { tau: 0.2, family: { kind: "atMost", G: 2, exact: 2 } as never }), /unknown key "exact"/);
});

// ---------------------------------------------------------------------------------------------------------
// reportsAtN

test("reportsAtN: counts per N, N with no reports, and ties in enumeration order", () => {
  const half = cube([
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ]);
  // three units: N = 0 (one report), 2 (six: a pair and a single), 3 (six strict orders); none at N = 1
  const counts = [0, 1, 2, 3].map((N) => reportsAtN(half, { N }).count);
  assert.deepEqual(counts, [1, 0, 6, 6]);
  const none = reportsAtN(half, { N: 1, k: 3 });
  assert.deepEqual([none.count, none.reports, none.N], [0, [], 1]);
  assert.deepEqual(reportsAtN(half, { N: 4 }).reports, []);
  assert.equal(reportsAtN(half, { N: 99 }).count, 0);
  // every report at N = 2 has Ew 1: enumeration order
  const at2 = reportsAtN(half, { N: 2, k: 6 });
  const expected = Array.from(enumerateReports(3), (g) => Array.from(g)).filter((g) => evaluateReport(g, half, { tau: 0.5 }).N === 2);
  assert.deepEqual(at2.reports.map((x) => x.grade), expected);
  assert.ok(at2.reports.every((x) => x.Ew === 1));
  assert.equal(at2.label, "exact-within-family");
  // exactly two grades: no report at N = 0
  assert.equal(reportsAtN(half, { N: 0, family: { kind: "exactly", G: 2 } }).count, 0);
});

test("reportsAtN: brute force and agreement with reportCloud", () => {
  for (const seed of [4, 5]) {
    const E = randomCube(5, seed, 2);
    const w = [0.3, 0.7];
    for (const family of [{ kind: "all" } as const, { kind: "atMost", G: 3 } as const]) {
      const cloud = reportCloud(E, { w, family }) as ReportCloud;
      for (const row of cloud.byN) {
        const r = reportsAtN(E, { w, family, N: row.N, k: 4 });
        assert.equal(r.count, row.count);
        assert.equal(r.reports[0].Ew, evaluateReport(row.minGrade, E, { tau: 0.5, w }).Ew);
        const list = Array.from(enumerateReports(5, family), (g) => Array.from(g))
          .map((g) => ({ grade: g, ev: evaluateReport(g, E, { tau: 0.5, w }) }))
          .filter((x) => x.ev.N === row.N)
          .map((x) => ({ grade: x.grade, Ew: x.ev.Ew }));
        list.sort((a, b) => a.Ew - b.Ew || (isBefore(a.grade, b.grade) ? -1 : 1));
        assert.deepEqual(r.reports, list.slice(0, 4));
      }
    }
  }
});

test("reportsAtN: input checks", () => {
  const E = randomCube(3, 1);
  assert.throws(() => reportsAtN(E, {} as never), /N must be an integer ≥ 0/);
  assert.throws(() => reportsAtN(E, { N: -1 }), /N must be an integer ≥ 0/);
  assert.throws(() => reportsAtN(E, { N: 1.5 }), /N must be an integer ≥ 0/);
  assert.throws(() => reportsAtN(E, { N: 1, k: 0 }), /k must be/);
  assert.throws(() => reportsAtN(E, { N: 1, tau: 0.2 } as never), /unknown option "tau"/);
  assert.throws(() => reportsAtN(randomCube(9, 1), { N: 1 }), /at most 600,000 reports/);
  assert.throws(() => reportsAtN(randomCube(3, 1, 2), { N: 1 }), /weights w are required/);
});

// ---------------------------------------------------------------------------------------------------------
// ruleGap

// three units, every pair error .25: Ew = .25·N; the report 1/2/2 has N = 2 and Ew = .5
const QUARTER = cube([
  [0, 0.25, 0.25],
  [0.25, 0, 0.25],
  [0.25, 0.25, 0],
]);

test("ruleGap: between two vertices, psi = (N_b − N)/(N_b − N_a) on the lower vertex", () => {
  const hull = [
    { N: 0, Ew: 0, grade: null },
    { N: 3, Ew: 0.6, grade: null },
  ];
  const r = ruleGap([1, 2, 2], QUARTER, { hull });
  assert.equal(r.N, 2);
  assert.equal(r.Ew, 0.5);
  assert.equal(r.psi, 1 / 3);
  assert.equal(r.H, (1 / 3) * 0 + (1 - 1 / 3) * 0.6);
  assert.equal(r.gap, 0.5 - r.H);
  assert.ok(Math.abs(r.gap - 0.1) < 1e-15);
  assert.equal(r.lower, hull[0]);
  assert.equal(r.upper, hull[1]);
  assert.equal(r.onFrontier, false);
  // on the chord: the report lies on H, gap exactly 0 (within tolerance)
  const on = ruleGap([1, 2, 2], QUARTER, { hull: [hull[0], { N: 3, Ew: 0.75, grade: null }] });
  assert.equal(on.gap, 0);
  assert.equal(on.onFrontier, true);
});

test("ruleGap: at a hull vertex, H is its Ew, psi null and lower = upper", () => {
  const hull = [
    { N: 0, Ew: 0, grade: null },
    { N: 2, Ew: 0.4, grade: null },
    { N: 3, Ew: 0.75, grade: null },
  ];
  const r = ruleGap([1, 2, 2], QUARTER, { hull });
  assert.equal(r.H, 0.4);
  assert.equal(r.psi, null);
  assert.equal(r.lower, hull[1]);
  assert.equal(r.upper, hull[1]);
  assert.equal(r.gap, 0.5 - 0.4);
  // the end vertices
  assert.equal(ruleGap([1, 1, 1], QUARTER, { hull }).psi, null);
  assert.equal(ruleGap([1, 2, 3], QUARTER, { hull }).H, 0.75);
  assert.equal(ruleGap([1, 2, 3], QUARTER, { hull }).onFrontier, true);
});

test("ruleGap: gap set to 0 when |Ew − H| ≤ tieTol·M, kept otherwise", () => {
  const near = [
    { N: 0, Ew: 0, grade: null },
    { N: 2, Ew: 0.5 + 2e-12, grade: null },
    { N: 3, Ew: 0.75, grade: null },
  ];
  // |−2e-12| ≤ 1e-12·3 → 0
  const r = ruleGap([1, 2, 2], QUARTER, { hull: near });
  assert.equal(r.gap, 0);
  assert.ok(Object.is(r.gap, 0));
  assert.equal(r.onFrontier, true);
  // tighter tolerance: 2e-12 > 1e-13·3, so the (negative) gap is kept
  const tight = ruleGap([1, 2, 2], QUARTER, { hull: near, tieTol: 1e-13 });
  assert.ok(tight.gap < 0 && tight.gap > -3e-12);
  assert.equal(tight.onFrontier, false);
  assert.equal(ruleGap([1, 2, 2], QUARTER, { hull: near, tieTol: 0 }).onFrontier, false);
  // above H by more than the tolerance
  const above = [
    { N: 0, Ew: 0, grade: null },
    { N: 2, Ew: 0.5 - 4e-12, grade: null },
    { N: 3, Ew: 0.75, grade: null },
  ];
  assert.ok(ruleGap([1, 2, 2], QUARTER, { hull: above }).gap > 3e-12);
});

test("ruleGap: weights, a hull from lowerHull, and input checks", () => {
  const E = randomCube(5, 9, 2);
  const w = [0.5, 0.5];
  const hull = lowerHull(reportCloud(E, { w }) as ReportCloud);
  // every hull vertex report lies on the frontier; every report lies on or above it
  for (const v of hull) assert.equal(ruleGap(v.grade as number[], E, { w, hull }).onFrontier, true);
  for (const g of enumerateReports(5)) assert.ok(ruleGap(g, E, { w, hull }).gap >= 0);
  const short = [
    { N: 0, Ew: 0, grade: null },
    { N: 2, Ew: 0.4, grade: null },
  ];
  assert.throws(() => ruleGap([1, 2, 3], QUARTER, { hull: short }), /outside the hull's range \(0 … 2\)/);
  assert.throws(() => ruleGap([1, 2, 2], QUARTER, {} as never), /nonempty array of vertices/);
  assert.throws(() => ruleGap([1, 2, 2], QUARTER, { hull: [short[1], short[0]] }), /increasing N/);
  assert.throws(() => ruleGap([1, 2, 2], QUARTER, { hull: short, tau: 0.2 } as never), /unknown option "tau"/);
  assert.throws(() => ruleGap([1, 2, 2], QUARTER, { hull: short, tieTol: -1 }), /tieTol/);
  assert.throws(() => ruleGap([1, 2], QUARTER, { hull: short }), /one entry per unit/);
});

// ---------------------------------------------------------------------------------------------------------
// CDE 12 schools (Part 3): τ .20, at most 3 grades

const CDE = path.resolve(import.meta.dirname, "../../data/released/case-cde.json");

test("CDE: the best reports, the runner-ups, the reports at N = 48, the tertiles and the relation change", { skip: !fs.existsSync(CDE) && "case-cde.json absent" }, () => {
  const d = JSON.parse(fs.readFileSync(CDE, "utf8"));
  const a = d.arrays.error;
  const E: ErrorArray = { ids: a.ids, criteria: a.criteria, e: a.e.map((m: (number | null)[][]) => m.map((row) => row.map((x) => (x === null ? Number.NaN : x)))) };
  const family = { kind: "atMost", G: 3 } as const;

  // the best report and its two runner-ups
  let t = performance.now();
  const best = bestReports(E, { tau: 0.2, family, k: 3 });
  const tBest = performance.now() - t;
  assert.equal(best.matched, 523251);
  assert.equal(best.family.size, 523251);
  const [r1, r2, r3] = best.reports;
  assert.equal(r1.N, 45);
  assert.ok(Math.abs(r1.risk - 0.0637744657711756) < 1e-12, `best risk ${r1.risk}`);
  assert.equal(r1.risk.toFixed(4), "0.0638");
  assert.deepEqual(r1.grade, [1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3]);
  const opt = exactOptimum(E, { tau: 0.2, family });
  assert.ok(!opt.empty);
  assert.deepEqual(r1.grade, opt.grade);
  assert.equal(r2.risk.toFixed(6), "0.064087");
  assert.equal(r3.risk.toFixed(6), "0.064092");
  assert.deepEqual(r2.grade, [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  assert.deepEqual(r3.grade, [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3]);
  // the registry's fixed-report evaluations of the two runner-ups
  assert.equal(r2.risk, evaluateReport([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3], E, { tau: 0.2 }).risk);
  assert.equal(r3.risk, evaluateReport([1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3], E, { tau: 0.2 }).risk);
  // stating F above I (units 5, 8): the best such report is the first runner-up
  const fi = bestReports(E, { tau: 0.2, family, stating: [[5, 8]] });
  assert.deepEqual(fi.reports[0].grade, r2.grade);
  assert.ok(fi.matched > 0 && fi.matched < 523251);

  // the reports that state exactly 48 directions
  t = performance.now();
  const at48 = reportsAtN(E, { family, N: 48, k: 2 });
  const tAtN = performance.now() - t;
  assert.equal(at48.count, 34650);
  assert.equal(at48.reports[0].Ew.toFixed(4), "1.8288");
  assert.ok(Math.abs(at48.reports[0].Ew - 1.82883787035742) < 1e-12);
  assert.equal(at48.reports[1].Ew.toFixed(4), "1.9088");
  const cloud = reportCloud(E, { family }) as ReportCloud;
  assert.equal(cloud.byN.find((r) => r.N === 48)?.count, 34650);

  // cutGrade(12, [4, 8]) along the posterior-mean order = the released tertiles
  const order = scoreOrder(d.tables.units.mean).order;
  const tertiles = cutGrade(12, [4, 8], { order });
  assert.deepEqual(Array.from(tertiles), d.tables.reports.observed_rate_tertiles);
  assert.deepEqual(Array.from(tertiles), d.tables.reports.posterior_mean_tertiles);
  assert.deepEqual(at48.reports[0].grade, Array.from(tertiles));

  // from the optimum to the tertiles: 9 newly stated, 6 newly withheld
  const change = relationChange(r1.grade, tertiles, E);
  assert.equal(change.nNewDisclosed, 9);
  assert.equal(change.nNewWithheld, 6);
  assert.equal(change.nReversed, 0);
  assert.equal(change.nSame, 66 - 15);
  const near = change.pairs.filter((p) => p.error !== null && p.error > 0.4).map((p) => p.error as number);
  assert.equal(near.length, 4);
  assert.equal(Math.min(...near).toFixed(4), "0.4389");
  assert.equal(Math.max(...near).toFixed(4), "0.4779");

  // gaps to the hull: the optimum and the tertiles are vertices (gap 0 within tieTol·M)
  const hull = lowerHull(cloud);
  assert.deepEqual(hull.map((v) => v.N), [0, 27, 45, 47, 48]);
  const gOpt = ruleGap(r1.grade, E, { hull });
  assert.deepEqual([gOpt.gap, gOpt.psi, gOpt.onFrontier], [0, null, true]);
  const gTer = ruleGap(tertiles, E, { hull });
  assert.deepEqual([gTer.N, gTer.gap, gTer.onFrontier], [48, 0, true]);

  // timing (single pass over 523,251 reports; reported, generous bound for loaded machines)
  console.log(`# CDE timings: bestReports k = 3 ${tBest.toFixed(1)} ms, reportsAtN N = 48 ${tAtN.toFixed(1)} ms`);
  assert.ok(tBest < 1500 && tAtN < 1500);
});
