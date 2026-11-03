import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalGrade, disclosure, familySize, pairCount, relations, reportCardRows, weakRelation,
} from "../src/report.ts";

/** Every canonical grade vector on n units (labels 1..G, all used), by brute force over {1..n}^n. */
function allReports(n: number): number[][] {
  const out: number[][] = [];
  const g = new Array<number>(n).fill(1);
  for (;;) {
    const used = new Set(g);
    const G = Math.max(...g);
    if (used.size === G) out.push([...g]);
    let q = n - 1;
    while (q >= 0 && g[q] === n) {
      g[q] = 1;
      q -= 1;
    }
    if (q < 0) return out;
    g[q] += 1;
  }
}

/** Ordered Bell numbers by the independent recurrence a(n) = Σ_{k=1}^n C(n, k) a(n − k), a(0) = 1. */
function fubiniRecurrence(nMax: number): bigint[] {
  const a: bigint[] = [1n];
  const C: bigint[][] = [[1n]];
  for (let n = 1; n <= nMax; n += 1) {
    C[n] = [1n];
    for (let k = 1; k <= n; k += 1) C[n][k] = (C[n - 1][k - 1] ?? 0n) + (C[n - 1][k] ?? 0n);
    let s = 0n;
    for (let k = 1; k <= n; k += 1) s += C[n][k] * a[n - k];
    a[n] = s;
  }
  return a;
}

test("canonicalGrade: consecutive labels, smallest input label = grade 1", () => {
  assert.deepEqual(canonicalGrade([2, 5, 9]), [1, 2, 3]);
  assert.deepEqual(canonicalGrade([10, 10, 30]), [1, 1, 2]);
  assert.deepEqual(canonicalGrade([3, 1, 3, 2]), [3, 1, 3, 2]);
  assert.deepEqual(canonicalGrade([0, 0, 1, -4]), [2, 2, 3, 1]);
  assert.deepEqual(canonicalGrade(Int8Array.from([0, 2, 2, 1])), [1, 3, 3, 2]);
  assert.deepEqual(canonicalGrade([7, 7, 7]), [1, 1, 1]);
  assert.throws(() => canonicalGrade([1, 1.5]), /integers/);
  assert.throws(() => canonicalGrade([1, Number.NaN]), /integers/);
});

test("pairCount: M = n(n − 1)/2", () => {
  assert.equal(pairCount(2), 1);
  assert.equal(pairCount(6), 15);
  assert.equal(pairCount(30), 435);
  assert.equal(pairCount(97), 4656);
  assert.throws(() => pairCount(2.5), RangeError);
});

test("disclosure: the six-site report 1/1/2/2/3/3, all-withheld, strict order, and the book's n = 4 pair", () => {
  assert.deepEqual(disclosure([1, 1, 2, 2, 3, 3]), { M: 15, N: 12, s: 0.8, G: 3, sizes: [2, 2, 2], withheld: 3 });
  assert.deepEqual(disclosure([1, 1, 1, 1, 1, 1]), { M: 15, N: 0, s: 0, G: 1, sizes: [6], withheld: 15 });
  assert.deepEqual(disclosure([1, 2, 3, 4, 5, 6]), { M: 15, N: 15, s: 1, G: 6, sizes: [1, 1, 1, 1, 1, 1], withheld: 0 });
  // ch. 9: (1,2,2,2) and (1,1,2,2) both use two grades but disclose 3 and 4 of 6 pairs
  assert.deepEqual(disclosure([1, 2, 2, 2]), { M: 6, N: 3, s: 1 / 2, G: 2, sizes: [1, 3], withheld: 3 });
  assert.deepEqual(disclosure([1, 1, 2, 2]), { M: 6, N: 4, s: 4 / 6, G: 2, sizes: [2, 2], withheld: 2 });
  // gaps in the labels are canonicalized first
  assert.deepEqual(disclosure([10, 10, 30]), { M: 3, N: 2, s: 2 / 3, G: 2, sizes: [2, 1], withheld: 1 });
  assert.throws(() => disclosure([1]), /two units/);
});

test("disclosure: N = Σ_{h<l} n_h n_l = (n² − Σ n_h²)/2 = number of pairs in different grades, for every n = 5 report", () => {
  for (const g of allReports(5)) {
    const d = disclosure(g);
    let direct = 0;
    for (let i = 0; i < 5; i += 1) for (let j = i + 1; j < 5; j += 1) if (g[i] !== g[j]) direct += 1;
    assert.equal(d.N, direct);
    assert.equal(d.N, (25 - d.sizes.reduce((s, m) => s + m * m, 0)) / 2);
    assert.equal(d.G, Math.max(...g));
    assert.equal(d.s === 0, d.G === 1);
    assert.equal(d.s === 1, d.G === 5);
  }
});

test("relations: +1 above, 0 withheld or diagonal, −1 below; antisymmetric", () => {
  assert.deepEqual(relations([1, 2, 2]), [
    [0, 1, 1],
    [-1, 0, 0],
    [-1, 0, 0],
  ]);
  const r = relations([2, 1, 3, 1]);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) assert.equal(r[i][j], -r[j][i] || 0);
  assert.equal(r[1][3], 0, "shared grade withholds");
  assert.equal(r[1][0], 1, "grade 1 above grade 2");
});

test("weakRelation: z_ij = 1{g_i ≤ g_j}; complete and transitive for every report; x_ij = 1 − z_ji", () => {
  const { z, complete, transitive } = weakRelation([1, 1, 2]);
  assert.ok(Number.isNaN(z[0][0]));
  assert.equal(z[0][1], 1);
  assert.equal(z[1][0], 1, "a shared grade has z_ij = z_ji = 1");
  assert.equal(z[0][2], 1);
  assert.equal(z[2][0], 0);
  assert.ok(complete && transitive);
  for (const g of allReports(4)) {
    const w = weakRelation(g);
    assert.ok(w.complete && w.transitive, g.join("/"));
    const rel = relations(g);
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) if (i !== j) assert.equal(rel[i][j] === 1 ? 1 : 0, 1 - w.z[j][i]);
  }
});

test("familySize: |A_n| = ordered Bell numbers; the book's 3, 13, 75 and the course's 4,683 and 545,835", () => {
  assert.equal(familySize(1, { kind: "all" }), 1);
  assert.equal(familySize(2, { kind: "all" }), 3);
  assert.equal(familySize(3, { kind: "all" }), 13);
  assert.equal(familySize(4, { kind: "all" }), 75);
  assert.equal(familySize(6, { kind: "all" }), 4683);
  assert.equal(familySize(8, { kind: "all" }), 545835);
  assert.equal(familySize(12, { kind: "all" }), 28091567595);
  const a = fubiniRecurrence(30);
  for (let n = 1; n <= 30; n += 1) {
    const got = familySize(n, { kind: "all" });
    assert.equal(BigInt(got), a[n], `n = ${n}`);
    assert.equal(typeof got, a[n] <= BigInt(Number.MAX_SAFE_INTEGER) ? "number" : "bigint", `type at n = ${n}`);
  }
  // a(16) is the last ordered Bell number below 2^53; a(17) needs BigInt
  assert.equal(familySize(16, { kind: "all" }), 5315654681981355);
  assert.equal(familySize(17, { kind: "all" }), 130370767029135901n);
});

test("familySize: at most G and exactly G grades (k!·S(n, k)), checked by enumeration", () => {
  assert.equal(familySize(6, { kind: "atMost", G: 3 }), 603);
  assert.equal(familySize(12, { kind: "atMost", G: 3 }), 523251);
  assert.equal(familySize(4, { kind: "exactly", G: 2 }), 14);
  assert.equal(familySize(6, { kind: "exactly", G: 6 }), 720);
  assert.equal(familySize(6, { kind: "atMost", G: 6 }), 4683);
  assert.equal(familySize(6, { kind: "atMost", G: 9 }), 4683, "a cap above n is redundant");
  assert.equal(familySize(6, { kind: "atMost", G: 0 }), 0, "a cap below 1 is empty");
  assert.equal(familySize(6, { kind: "exactly", G: 0 }), 0);
  assert.equal(familySize(6, { kind: "exactly", G: 7 }), 0);
  for (const n of [3, 4, 5, 6]) {
    const reports = allReports(n);
    assert.equal(familySize(n, { kind: "all" }), reports.length);
    for (let G = 1; G <= n; G += 1) {
      assert.equal(familySize(n, { kind: "exactly", G }), reports.filter((g) => Math.max(...g) === G).length);
      assert.equal(familySize(n, { kind: "atMost", G }), reports.filter((g) => Math.max(...g) <= G).length);
    }
  }
  assert.throws(() => familySize(6, { kind: "atMost", G: 2.5 }), /integer/);
  assert.throws(() => familySize(6, { kind: "nope" } as never), /unknown family/);
});

test("familySize: fixed order (compositions): 2^(n−1), C(n − 1, G − 1), caps and indivisible blocks", () => {
  const order = [5, 4, 3, 2, 1, 0];
  assert.equal(familySize(4, { kind: "order", order: [0, 1, 2, 3] }), 8, "the book's 8 actions per order at n = 4");
  assert.equal(familySize(6, { kind: "order", order }), 32);
  assert.equal(familySize(6, { kind: "order", order, exact: 3 }), 10);
  assert.equal(familySize(6, { kind: "order", order, G: 3 }), 1 + 5 + 10);
  assert.equal(familySize(6, { kind: "order", order, G: 3, exact: 4 }), 0, "exactly 4 grades exceeds a cap of 3");
  assert.equal(familySize(6, { kind: "order", order, G: 4, exact: 4 }), 10);
  // blocks of sizes 2, 1, 3 along the order act as three units
  assert.equal(familySize(6, { kind: "order", order, blocks: [2, 1, 3] }), 4);
  assert.equal(familySize(6, { kind: "order", order, blocks: [2, 1, 3], exact: 2 }), 2);
  assert.equal(familySize(6, { kind: "order", order, blocks: [2, 1, 3], exact: 4 }), 0);
  assert.equal(familySize(6, { kind: "order", order, blocks: [6] }), 1);
  // contiguous cuts of one order, counted by brute force: reports whose grades never decrease along the order
  for (const n of [3, 4, 5]) {
    for (const perm of [Array.from({ length: n }, (_, i) => n - 1 - i), Array.from({ length: n }, (_, i) => (i + 1) % n)]) {
      const inOrder = allReports(n).filter((g) => perm.every((u, q) => q === 0 || g[perm[q - 1]] <= g[u]));
      assert.equal(familySize(n, { kind: "order", order: perm }), inOrder.length);
      for (let G = 1; G <= n; G += 1) {
        const exact = inOrder.filter((g) => Math.max(...g) === G).length;
        assert.equal(familySize(n, { kind: "order", order: perm, exact: G }), exact);
        assert.equal(familySize(n, { kind: "order", order: perm, G }), inOrder.filter((g) => Math.max(...g) <= G).length);
      }
    }
  }
  const big = familySize(60, { kind: "order", order: Array.from({ length: 60 }, (_, i) => i) });
  assert.equal(big, 2n ** 59n, "2^59 exceeds 2^53 and is returned as a BigInt");
  assert.throws(() => familySize(4, { kind: "order", order: [0, 1, 2] }), /order/);
  assert.throws(() => familySize(4, { kind: "order", order: [0, 1, 1, 2] }), /permutation/);
  assert.throws(() => familySize(4, { kind: "order", order: [0, 1, 2, 3], blocks: [2, 1] }), /blocks/);
});

test("reportCardRows: grades contiguous, then the secondary key, then unit id (code-point order)", () => {
  const g = [2, 1, 1, 2, 3];
  const ids = ["E", "D", "C", "B", "A"];
  const mean = [0.1, 0.4, 0.9, 0.3, -1];
  const expectedRank = [3.5, 2.1, 1.2, 3.1, 4.9];
  assert.deepEqual(reportCardRows(g, { ids, mean, expectedRank }, "grade"), [1, 2, 0, 3, 4], "input order within grades");
  assert.deepEqual(reportCardRows(g, { ids, mean }, "mean"), [2, 1, 3, 0, 4], "larger mean first");
  assert.deepEqual(reportCardRows(g, { ids, expectedRank }, "expected_rank"), [2, 1, 3, 0, 4], "smaller expected rank first");
  assert.deepEqual(reportCardRows(g, { ids }, "label"), [2, 1, 3, 0, 4], "id order within grades");
  // equal keys fall back to the id; default ids are A, B, …
  assert.deepEqual(reportCardRows([1, 1, 1], { mean: [0, 0, 0], ids: ["b", "a", "B"] }, "mean"), [2, 1, 0]);
  assert.deepEqual(reportCardRows([2, 1, 2], { expectedRank: [2, 1, 2] }), [1, 0, 2]);
  assert.throws(() => reportCardRows(g, { ids }, "mean"), /summaries.mean/);
  assert.throws(() => reportCardRows(g, { ids: ["a"] }, "label"), /ids/);
});
