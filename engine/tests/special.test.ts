import { test } from "node:test";
import assert from "node:assert/strict";
import { erfc, normalCdf, normalPdf, normalQuantile, normalSf } from "../src/special.ts";
import { maxError, readFixture, relErr } from "./helpers.ts";

// Target: relative error at most 1e-14 against R for |z| <= 37 and p >= 1e-300.
const TOL = 1e-14;

interface NormalFixture {
  r_version: string;
  code: string;
  z: number[];
  pnorm: number[];
  pnorm_upper: number[];
  dnorm: number[];
  p: number[];
  qnorm: number[];
  p_upper: number[];
  qnorm_upper: number[];
}
const R = readFixture<NormalFixture>("normal-r.json");

test("fixture: R 4.6.0 values on |z| <= 37 and p down to 1e-300, with the generating code", () => {
  assert.match(R.r_version, /^R version 4\.6\.0/);
  assert.match(R.code, /pnorm\(z, lower\.tail = FALSE\)/);
  assert.equal(Math.max(...R.z.map(Math.abs)), 37);
  assert.ok(Math.min(...R.p) <= 1e-300 * (1 + 1e-14));
  assert.ok(R.z.length > 3000 && R.p.length > 3000 && R.p_upper.length > 1000);
});

test("normalCdf matches R pnorm (relative error, lower tail) on |z| <= 37", (t) => {
  const r = maxError(R.z, (z, i) => relErr(normalCdf(z), R.pnorm[i]));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at z = ${r.at}`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at z = ${r.at}`);
});

test("normalSf matches R pnorm(lower.tail = FALSE) (relative error, upper tail) on |z| <= 37", (t) => {
  const r = maxError(R.z, (z, i) => relErr(normalSf(z), R.pnorm_upper[i]));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at z = ${r.at}`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at z = ${r.at}`);
});

test("smaller tail: relative error of min(Φ(z), 1 − Φ(z)) on |z| <= 37", (t) => {
  const r = maxError(R.z, (z, i) => (z > 0 ? relErr(normalSf(z), R.pnorm_upper[i]) : relErr(normalCdf(z), R.pnorm[i])));
  t.diagnostic(`max relative error of the smaller tail ${r.max.toExponential(2)} at z = ${r.at}`);
  assert.ok(r.max <= TOL);
  // the far tail is computed, not rounded away: Pr(Z > 37) is about 5.7e-300
  assert.ok(normalSf(37) > 5e-300 && normalSf(37) < 6e-300);
  assert.equal(normalSf(37), normalCdf(-37));
});

test("normalPdf matches R dnorm (relative error) on |z| <= 37", (t) => {
  const r = maxError(R.z, (z, i) => relErr(normalPdf(z), R.dnorm[i]));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at z = ${r.at}`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at z = ${r.at}`);
});

test("normalQuantile matches R qnorm for p in [1e-300, 1)", (t) => {
  // relative error of the quantile; at p = 1/2 both are exactly 0
  const r = maxError(R.p, (p, i) => (R.qnorm[i] === 0 ? Math.abs(normalQuantile(p)) : relErr(normalQuantile(p), R.qnorm[i])));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at p = ${r.at}`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at p = ${r.at}`);
});

test("normalQuantile(p, { lowerTail: false }) matches R qnorm(p, lower.tail = FALSE) down to 1e-300", (t) => {
  const r = maxError(R.p_upper, (p, i) => relErr(normalQuantile(p, { lowerTail: false }), R.qnorm_upper[i]));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at p = ${r.at}`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at p = ${r.at}`);
});

test("quantile and tail functions invert each other on the smaller tail", () => {
  for (let z = -37; z <= 37; z += 0.125) {
    const back = z <= 0 ? normalQuantile(normalCdf(z)) : normalQuantile(normalSf(z), { lowerTail: false });
    assert.ok(Math.abs(back - z) <= 1e-14 * Math.max(1, Math.abs(z)), `z = ${z}: ${back}`);
  }
});

test("symmetry: normalSf(z) = normalCdf(−z) and Φ⁻¹(1 − p) = −Φ⁻¹(p) exactly", () => {
  for (const z of [0, 1e-300, 0.3, 0.67448975, 1, 2.5, Math.sqrt(32), 6, 8, 8.2923, 20, 37]) {
    assert.equal(normalSf(z), normalCdf(-z));
    assert.equal(normalSf(-z), normalCdf(z));
    assert.equal(normalPdf(z), normalPdf(-z));
  }
  // exact in the tail branches (the tail probability is used as given); in the central branch the two calls form
  // p - 1/2 from p and from 1 - p, which round differently (as in R), so they agree to an ulp or two
  for (const p of [1e-300, 1e-20, 1e-5, 0.01, 0.0749]) {
    assert.equal(normalQuantile(p, { lowerTail: false }), -normalQuantile(p));
  }
  for (const p of [0.075, 0.1, 0.3, 0.49]) {
    assert.ok(relErr(normalQuantile(p, { lowerTail: false }), -normalQuantile(p)) <= 1e-15);
  }
});

test("known values and edge cases", () => {
  assert.equal(normalCdf(0), 0.5);
  assert.equal(normalSf(0), 0.5);
  assert.equal(normalQuantile(0.5), 0);
  assert.ok(relErr(normalPdf(0), 1 / Math.sqrt(2 * Math.PI)) <= 1e-16);
  assert.ok(relErr(normalQuantile(0.975), 1.959963984540054) <= 1e-15);
  assert.ok(relErr(normalCdf(-1.959963984540054), 0.025) <= 1e-15);
  // infinities, NaN and out-of-range inputs
  assert.equal(normalCdf(-Infinity), 0);
  assert.equal(normalCdf(Infinity), 1);
  assert.equal(normalSf(Infinity), 0);
  assert.equal(normalSf(-Infinity), 1);
  assert.equal(normalPdf(Infinity), 0);
  assert.equal(normalPdf(-Infinity), 0);
  for (const f of [normalCdf, normalSf, normalPdf, erfc]) assert.ok(Number.isNaN(f(Number.NaN)));
  assert.equal(normalQuantile(0), -Infinity);
  assert.equal(normalQuantile(1), Infinity);
  assert.equal(normalQuantile(0, { lowerTail: false }), Infinity);
  assert.equal(normalQuantile(1, { lowerTail: false }), -Infinity);
  for (const p of [-1e-300, 1 + 1e-15, Number.NaN]) assert.ok(Number.isNaN(normalQuantile(p)));
  // R's cut-offs: beyond 37.5193 the far tail is returned as 0 (it is below the smallest normal double)
  assert.equal(normalCdf(-37.6), 0);
  assert.equal(normalSf(37.6), 0);
  assert.equal(normalCdf(8.3), 1);
  assert.equal(normalSf(-8.3), 1);
  assert.ok(normalSf(37.5) > 0);
});

interface ErfcFixture {
  mpmath_version: string;
  code: string;
  x: number[];
  erfc: number[];
}
const M = readFixture<ErfcFixture>("erfc-mpmath.json");

test("erfc matches 50-digit mpmath values (relative error) on [−6, 26.5]", (t) => {
  assert.match(M.code, /mp\.erfc/);
  const r = maxError(M.x, (x, i) => relErr(erfc(x), M.erfc[i]));
  t.diagnostic(`max relative error ${r.max.toExponential(2)} at x = ${r.at} (mpmath ${M.mpmath_version})`);
  assert.ok(r.max <= TOL, `max relative error ${r.max} at x = ${r.at}`);
});

test("erfc edge cases and its link to the normal tail", () => {
  assert.equal(erfc(0), 1);
  assert.equal(erfc(Infinity), 0);
  assert.equal(erfc(-Infinity), 2);
  assert.equal(erfc(26.6), 0); // CALERF: below the smallest normal double
  assert.ok(erfc(26.5) > 0);
  // erfc(x) = 2 Φ(−√2 x); the product √2·x is rounded, so allow its conditioning (about 2x² ulps)
  for (let x = -5; x <= 25; x += 0.37) {
    const viaNormal = 2 * normalSf(Math.SQRT2 * x);
    const tol = 1e-15 * (8 + 4 * x * x);
    assert.ok(relErr(erfc(x), viaNormal) <= tol, `x = ${x}: ${erfc(x)} vs ${viaNormal}`);
  }
});
