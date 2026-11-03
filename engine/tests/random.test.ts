import { test } from "node:test";
import assert from "node:assert/strict";
import { normalStream, normals, rng, rngUint32, uniforms } from "../src/random.ts";
import { readFixture, ulps } from "./helpers.ts";

interface StreamFixture {
  r_version: string;
  code: string;
  cases: { seed: number; uint32: number[]; uniform: number[]; normal: number[] }[];
}
const R = readFixture<StreamFixture>("stream-r.json");

test("same seed gives the same sequence; different seeds give different sequences", () => {
  for (const seed of [0, 1, 7, 42, 20261031, 4294967295]) {
    const a = rng(seed);
    const b = rng(seed);
    for (let i = 0; i < 1000; i += 1) assert.equal(a(), b());
    const za = normalStream(seed);
    const zb = normalStream(seed);
    for (let i = 0; i < 1001; i += 1) assert.equal(za(), zb());
  }
  assert.notDeepEqual(Array.from(uniforms(1, 8)), Array.from(uniforms(2, 8)));
  // streams are independent objects: drawing from one does not move another with the same seed
  const a = rng(5);
  a();
  a();
  assert.equal(rng(5)(), uniforms(5, 1)[0]);
});

test("seed handling: integers reduced mod 2^32; non-integers throw", () => {
  assert.deepEqual(Array.from(uniforms(-1, 5)), Array.from(uniforms(4294967295, 5)));
  assert.deepEqual(Array.from(uniforms(2 ** 32, 5)), Array.from(uniforms(0, 5)));
  assert.deepEqual(Array.from(uniforms(2 ** 32 + 9, 5)), Array.from(uniforms(9, 5)));
  for (const bad of [1.5, Number.NaN, Infinity, -Infinity]) {
    assert.throws(() => rng(bad), RangeError);
    assert.throws(() => normalStream(bad), RangeError);
  }
  assert.throws(() => uniforms(1, -1), RangeError);
  assert.throws(() => normals(1, 2.5), RangeError);
  assert.equal(uniforms(1, 0).length, 0);
});

test("pinned values: seed 0 starts 1144304738, 1416247, 958946056 (README.md)", () => {
  const next = rngUint32(0);
  const x = next();
  assert.equal(x, 1144304738);
  assert.equal(x / 2 ** 32, 0.26642920868471265);
  assert.deepEqual([next(), next()], [1416247, 958946056]); // as stated in README.md
});

test("uniforms lie in the open interval (0, 1) and are (x + 1/2) / 2^32", () => {
  const ints = rngUint32(99);
  const us = rng(99);
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < 200000; i += 1) {
    const x = ints();
    const u = us();
    assert.ok(Number.isInteger(x) && x >= 0 && x < 2 ** 32);
    assert.equal(u, (x + 0.5) / 2 ** 32);
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
  }
  assert.ok(lo > 0 && hi < 1);
  // the extreme outputs map strictly inside (0, 1)
  assert.equal((0 + 0.5) / 2 ** 32, 2 ** -33);
  assert.ok((2 ** 32 - 1 + 0.5) / 2 ** 32 < 1);
});

test("normalStream is Box–Muller on consecutive uniform pairs: cos first, then the cached sin", () => {
  const u = uniforms(314, 200);
  const z = normals(314, 200);
  for (let k = 0; k < 100; k += 1) {
    const r = Math.sqrt(-2 * Math.log(u[2 * k]));
    const t = 2 * Math.PI * u[2 * k + 1];
    assert.equal(z[2 * k], r * Math.cos(t));
    assert.equal(z[2 * k + 1], r * Math.sin(t));
  }
  // an odd count stops after a cos variate
  assert.deepEqual(Array.from(normals(314, 3)), Array.from(z.slice(0, 3)));
});

test("normal draws have mean 0 and variance 1 (200,000 draws, 5 standard errors)", () => {
  const z = normals(20261031, 200000);
  let s = 0;
  let s2 = 0;
  for (const v of z) {
    s += v;
    s2 += v * v;
  }
  const n = z.length;
  const mean = s / n;
  const variance = s2 / n - mean * mean;
  assert.ok(Math.abs(mean) < 5 / Math.sqrt(n), `mean ${mean}`);
  assert.ok(Math.abs(variance - 1) < 5 * Math.sqrt(2 / n), `variance ${variance}`);
});

test("R reimplementation from README: integers and uniforms bit for bit, normals within 4 ulps", (t) => {
  assert.match(R.r_version, /^R version 4\.6\.0/);
  assert.match(R.code, /1831565813/);
  let worst = 0;
  let differ = 0;
  let total = 0;
  for (const c of R.cases) {
    const n = c.uint32.length;
    const ints = rngUint32(c.seed);
    for (let i = 0; i < n; i += 1) assert.equal(ints(), c.uint32[i], `seed ${c.seed}, integer ${i}`);
    assert.deepEqual(Array.from(uniforms(c.seed, n)), c.uniform, `seed ${c.seed}: uniforms`);
    const z = normals(c.seed, n);
    for (let i = 0; i < n; i += 1) {
      const d = ulps(z[i], c.normal[i]);
      worst = Math.max(worst, d);
      if (d > 0) differ += 1;
      total += 1;
    }
  }
  t.diagnostic(`normals: ${differ} of ${total} differ from R in the last place; largest difference ${worst.toFixed(2)} ulp`);
  assert.ok(worst <= 4, `largest normal difference ${worst} ulp`);
});
