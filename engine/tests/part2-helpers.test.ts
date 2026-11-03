// Step 6.14: the Part 2 helpers that replace widget code (engine/API.md "Step 6.14: Part 2 helpers").
// finiteLawDraws (simulate.ts) is checked against the cumulative rule applied to `uniforms` as G-05 used to do it;
// confidentPairs (risk.ts) on small hand cases and on KRW's released race array and card (S-02: 1,575 / 575 at τ .20).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { uniforms } from "../src/random.ts";
import { finiteLawDraws } from "../src/simulate.ts";
import { confidentPairs } from "../src/risk.ts";
import type { ErrorArray } from "../src/pairwise.ts";

// --- the reference rule: G-05's former code (cumulative sums by reduce, first strict u < c, else the last index)
const reference = (probs: number[], S: number, seed: number): number[] => {
  const cum = probs.reduce<number[]>((acc, p, k) => [...acc, (k ? acc[k - 1] : 0) + p], []);
  return Array.from(uniforms(seed, S), (x) => {
    const k = cum.findIndex((c) => x < c);
    return k < 0 ? cum.length - 1 : k;
  });
};

// chapter 10 law: orders ABC, ACB, BAC, CBA with probabilities 3/5, 3/20, 3/20, 1/10
const CH10 = [3 / 5, 3 / 20, 3 / 20, 1 / 10];

test("finiteLawDraws: chapter 10 law, seed 1: first five draws, shares over 100 draws, and the cumulative rule", () => {
  const d = finiteLawDraws(CH10, 100, 1);
  assert.ok(d instanceof Int32Array);
  assert.equal(d.length, 100);
  assert.deepEqual(Array.from(d), reference(CH10, 100, 1));
  // u = .6271, .0027, .5274, .9811, .9684 → ACB, ABC, ABC, CBA, CBA
  assert.deepEqual(Array.from(d.slice(0, 5)), [1, 0, 0, 3, 3]);
  const counts = [0, 0, 0, 0];
  for (const k of d) counts[k] += 1;
  assert.deepEqual(counts.map((c) => c / 100), [0.61, 0.15, 0.12, 0.12]);
  // the first S draws do not depend on S (one stream), and other seeds follow the same rule
  assert.deepEqual(Array.from(finiteLawDraws(CH10, 5, 1)), [1, 0, 0, 3, 3]);
  for (const seed of [0, 2, 20261030, -1, 2 ** 32 + 1]) assert.deepEqual(Array.from(finiteLawDraws(CH10, 250, seed)), reference(CH10, 250, seed));
  // seeds reduce mod 2^32 as in uniforms
  assert.deepEqual(Array.from(finiteLawDraws(CH10, 50, 2 ** 32 + 1)), Array.from(finiteLawDraws(CH10, 50, 1)));
});

test("finiteLawDraws: sums short of 1 (u at or above the last sum → last index), strict comparison, S = 0", () => {
  const u = uniforms(1, 100);
  // probs sum to .8: u_3 = .981 lands above the last sum and gives the last index
  const short = [0.5, 0.3];
  const d = finiteLawDraws(short, 100, 1);
  assert.deepEqual(Array.from(d), reference(short, 100, 1));
  assert.ok(u[3] >= 0.8);
  assert.equal(d[3], 1);
  assert.equal(d[0], 1); // u_0 = .627 in [.5, .8)
  assert.equal(d[1], 0);
  // the fallback is the last index even when the last state has probability 0
  const zeroLast = [0.5, 0.3, 0];
  const z = finiteLawDraws(zeroLast, 100, 1);
  assert.deepEqual(Array.from(z), reference(zeroLast, 100, 1));
  for (let s = 0; s < 100; s += 1) assert.equal(z[s], u[s] < 0.5 ? 0 : u[s] < 0.8 ? 1 : 2);
  // u exactly at the last sum: c = [0, u_0] gives u_0 < c_1 false, so the last index
  assert.deepEqual(Array.from(finiteLawDraws([0, u[0]], 1, 1)), [1]);
  // u exactly at an interior sum is not below it (strict): c_0 = u_0, so draw 0 is index 1, not 0
  assert.equal(finiteLawDraws([u[0], 0.2], 1, 1)[0], 1);
  // one state: always 0
  assert.deepEqual(Array.from(finiteLawDraws([0.3], 10, 1)), new Array(10).fill(0));
  // S = 0: an empty Int32Array
  const empty = finiteLawDraws(CH10, 0, 1);
  assert.ok(empty instanceof Int32Array);
  assert.equal(empty.length, 0);
});

test("finiteLawDraws: input checks", () => {
  assert.throws(() => finiteLawDraws([], 3, 1), /nonempty/);
  assert.throws(() => finiteLawDraws([0.5, Number.NaN], 3, 1), /finite/);
  assert.throws(() => finiteLawDraws([0.5, -0.1], 3, 1), /\[0, 1\]/);
  assert.throws(() => finiteLawDraws([1.5], 3, 1), /\[0, 1\]/);
  assert.throws(() => finiteLawDraws(CH10, -1, 1), /S must be an integer/);
  assert.throws(() => finiteLawDraws(CH10, 2.5, 1), /S must be an integer/);
  assert.throws(() => finiteLawDraws(CH10, 3, 1.5), /seed must be an integer/);
  assert.deepEqual(Array.from(finiteLawDraws(new Float64Array(CH10), 5, 1)), [1, 0, 0, 3, 3]);
});

// --- confidentPairs

const NaNd = Number.NaN;
const cube = (...e: number[][][]): ErrorArray => ({
  ids: e[0].map((_, i) => String.fromCharCode(65 + i)),
  criteria: e.map((_, k) => `c${k + 1}`),
  e,
});

test("confidentPairs: one criterion; a pair exactly at τ is not confident; either direction counts", () => {
  const E = cube([
    [NaNd, 0.1, 0.2, 0.6],
    [0.9, NaNd, 0.5, 0.85],
    [0.8, 0.5, NaNd, 0.19],
    [0.4, 0.15, 0.81, NaNd],
  ]);
  // (0,1): min .1 confident; (0,2): min .2 = τ, not; (0,3): .4 not; (1,2): .5 not; (1,3): min(.85, .15) confident;
  // (2,3): .19 confident
  const r = confidentPairs([1, 1, 2, 2], E, { tau: 0.2 });
  assert.deepEqual(r, {
    count: 3, withheld: 2, stated: 1,
    pairs: [{ i: 0, j: 1, withheld: true }, { i: 1, j: 3, withheld: false }, { i: 2, j: 3, withheld: true }],
  });
  // the same with the default w and with w = [1]; grade labels need not be canonical
  assert.deepEqual(confidentPairs([5, 5, 7, 7], E, { tau: 0.2, w: [1] }), r);
  // a strict order withholds nothing; one grade withholds every confident pair
  assert.deepEqual(confidentPairs([1, 2, 3, 4], E, { tau: 0.2 }), { ...r, withheld: 0, stated: 3, pairs: r.pairs.map((p) => ({ ...p, withheld: false })) });
  assert.equal(confidentPairs([1, 1, 1, 1], E, { tau: 0.2 }).withheld, 3);
  // τ just above .2 picks up (0, 2); τ = .1 has none (.1 is not below .1)
  assert.equal(confidentPairs([1, 1, 2, 2], E, { tau: 0.2000001 }).count, 4);
  assert.deepEqual(confidentPairs([1, 1, 2, 2], E, { tau: 0.1 }), { count: 0, withheld: 0, stated: 0, pairs: [] });
  // typed-array rows and JSON-null diagonals are accepted
  const typed = { ...E, e: E.e.map((m) => m.map((row) => Float64Array.from(row))) } as unknown as ErrorArray;
  assert.deepEqual(confidentPairs([1, 1, 2, 2], typed, { tau: 0.2 }), r);
});

test("confidentPairs: K = 2 weights combine as statedAbove (ebar = Σ_k w_k e_k)", () => {
  const e1 = [
    [NaNd, 0.1, 0.5],
    [0.9, NaNd, 0.3],
    [0.5, 0.7, NaNd],
  ];
  const e2 = [
    [NaNd, 0.4, 0.05],
    [0.6, NaNd, 0.25],
    [0.95, 0.75, NaNd],
  ];
  const E = cube(e1, e2);
  const g = [1, 1, 2];
  // w = [1, 0]: only (0,1) (.1); w = [0, 1]: only (0,2) (.05); w = [.5, .5]: ebar (0,1) = .25, (0,2) = .275,
  // (1,2) = .275 → none at τ .2, while at τ .26 only (0,1)
  assert.deepEqual(confidentPairs(g, E, { tau: 0.2, w: [1, 0] }).pairs, [{ i: 0, j: 1, withheld: true }]);
  assert.deepEqual(confidentPairs(g, E, { tau: 0.2, w: [0, 1] }).pairs, [{ i: 0, j: 2, withheld: false }]);
  assert.equal(confidentPairs(g, E, { tau: 0.2, w: [0.5, 0.5] }).count, 0);
  assert.deepEqual(confidentPairs(g, E, { tau: 0.26, w: [0.5, 0.5] }), { count: 1, withheld: 1, stated: 0, pairs: [{ i: 0, j: 1, withheld: true }] });
  // w = [.25, .75]: (0,1) .325, (0,2) .1625, (1,2) .2625 → (0,2) stated
  assert.deepEqual(confidentPairs(g, E, { tau: 0.2, w: [0.25, 0.75] }), { count: 1, withheld: 0, stated: 1, pairs: [{ i: 0, j: 2, withheld: false }] });
  assert.throws(() => confidentPairs(g, E, { tau: 0.2 }), /weights w are required/);
  assert.throws(() => confidentPairs(g, E, { tau: 0.2, w: [0.5, 0.6] }), /sum to 1/);
});

test("confidentPairs: input checks", () => {
  const E = cube([
    [NaNd, 0.1],
    [0.9, NaNd],
  ]);
  assert.deepEqual(confidentPairs([1, 2], E, { tau: 0.5 }), { count: 1, withheld: 0, stated: 1, pairs: [{ i: 0, j: 1, withheld: false }] });
  assert.throws(() => confidentPairs([1, 2], E, { tau: 0 }), /tau must lie/);
  assert.throws(() => confidentPairs([1, 2], E, { tau: 0.6 }), /tau must lie/);
  assert.throws(() => confidentPairs([1, 2], E, undefined as never), /options object expected/);
  assert.throws(() => confidentPairs([1, 2], E, 0.2 as never), /options object expected/);
  assert.throws(() => confidentPairs([1, 2], E, { tau: 0.2, tieTol: 0 } as never), /unknown/);
  assert.throws(() => confidentPairs([1, 2, 3], E, { tau: 0.2 }), /one entry per unit/);
  assert.throws(() => confidentPairs([1, 2], { e: [] } as never, { tau: 0.2 }), /nonempty/);
});

const KRW = path.resolve(import.meta.dirname, "../../data/released/case-krw.json");

test("confidentPairs: S-02 heat map on KRW's released race array and card at τ = .20: 1,575 confident, 575 withheld", () => {
  const d = JSON.parse(fs.readFileSync(KRW, "utf8"));
  const a = d.arrays.error;
  const k = a.criteria.indexOf("race_signed");
  assert.ok(k >= 0, "the released array holds the race criterion");
  const race = (a.e[k] as (number | null)[][]).map((row) => row.map((x) => (x === null ? Number.NaN : x)));
  const card = d.tables.reports.race_card as number[];
  assert.equal(card.length, 97);
  const r = confidentPairs(card, { ids: a.ids, criteria: [a.criteria[k]], e: [race] }, { tau: 0.2 });
  assert.equal(r.count, 1575);
  assert.equal(r.withheld, 575);
  assert.equal(r.stated, 1000);
  assert.equal(r.pairs.length, 1575);
  // the two-criterion array with all weight on race gives the same tally
  const both = { ids: a.ids, criteria: a.criteria, e: a.e.map((m: (number | null)[][]) => m.map((row) => row.map((x) => (x === null ? Number.NaN : x)))) };
  const w = a.criteria.map((_: string, q: number) => (q === k ? 1 : 0));
  assert.deepEqual(confidentPairs(card, both, { tau: 0.2, w }), r);
});
