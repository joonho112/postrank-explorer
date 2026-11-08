import { test } from "node:test";
import assert from "node:assert/strict";
import { MdomainError, fail, type JsonValue } from "../src/mdomain/error.ts";
import {
  ZERO, ONE, rational, fromInteger, parseExact, toExact,
  add, sub, mul, div, cmp, floor, toNumber,
} from "../src/mdomain/rational.ts";

function rejects(value: unknown, field = "policy.alpha"): void {
  assert.throws(() => parseExact(value, field), (error: unknown) =>
    error instanceof MdomainError && error.code === "mdomainPolicyInvalid" && error.field === field);
}

test("canonical nonnegative exact text round-trips without Number coercion", () => {
  for (const text of ["0", "1", "12", "3/20", "9007199254740993", "9007199254740993/9007199254740992"])
    assert.equal(toExact(parseExact(text)), text);
  for (const value of [null, undefined, true, 0, 1, 0.1, 1n, {}, [], new String("1"), "", " 1", "1 ", "1\n", "+1", "-1", "-0", "01", "00", "1.0", ".1", "1e3", "1/0", "1/01", "01/2", "2/4", "0/2", "1/1", "2/1", "1 /2", "１"])
    rejects(value);
});

test("parser enforces 256-character bound before BigInt construction", () => {
  const valid = "9".repeat(256);
  assert.equal(toExact(parseExact(valid)), valid);
  rejects("9".repeat(257));
});

test("input parsing preserves caller-selected typed error category and field", () => {
  assert.throws(() => parseExact("2/4", "input.masses[0]", "mdomainInputInvalid"),
    (e: unknown) => e instanceof MdomainError && e.code === "mdomainInputInvalid" && e.field === "input.masses[0]");
});

test("signed internal rational normalisation is separate from portable policy parsing", () => {
  assert.equal(toExact(rational(6n, -8n)), "-3/4");
  assert.equal(toExact(rational(-6n, -8n)), "3/4");
  assert.equal(toExact(rational(0n, -99n)), "0");
  assert.equal(toExact(rational(8n, 4n)), "2");
  assert.throws(() => rational(1n, 0n), MdomainError);
  assert.throws(() => rational(1 as unknown as bigint), MdomainError);
});

test("safe integer constructor distinguishes count inputs from exact-text policies", () => {
  assert.equal(toExact(fromInteger(Number.MAX_SAFE_INTEGER)), "9007199254740991");
  assert.equal(toExact(fromInteger(9007199254740993n)), "9007199254740993");
  assert.equal(toExact(fromInteger(-3)), "-3");
  for (const value of [NaN, Infinity, -Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => fromInteger(value), MdomainError);
});

test("addition and subtraction retain exact policy boundaries", () => {
  const p = parseExact("1/10"), c = parseExact("1/20");
  assert.equal(toExact(sub(add(p, p), c)), "3/20");
  assert.equal(cmp(sub(add(p, p), c), parseExact("3/20")), 0);
  assert.equal(toExact(sub(p, parseExact("1/5"))), "-1/10");
  assert.equal(toExact(add(parseExact("1/6"), parseExact("1/3"))), "1/2");
});

test("multiplication/division reduce terms and reject division by zero", () => {
  assert.equal(toExact(mul(parseExact("3/20"), parseExact("10/9"))), "1/6");
  assert.equal(toExact(div(parseExact("3/20"), parseExact("1/10"))), "3/2");
  assert.equal(toExact(div(rational(-1n, 2n), rational(-3n, 4n))), "2/3");
  assert.equal(toExact(mul(ZERO, parseExact("5/7"))), "0");
  assert.throws(() => div(ONE, ZERO), MdomainError);
});

test("comparison above 2^53 does not collapse distinguishable values", () => {
  const a = parseExact("9007199254740993/9007199254740992");
  assert.equal(cmp(a, ONE), 1);
  assert.equal(cmp(ONE, a), -1);
  assert.equal(cmp(rational(-3n, 4n), rational(-2n, 3n)), -1);
  assert.equal(toExact(sub(a, ONE)), "1/9007199254740992");
});

test("floor yields mathematical floor and the strict exceedance cutoff", () => {
  assert.equal(floor(parseExact("3/2")), 1n);
  assert.equal(floor(rational(-3n, 2n)), -2n);
  assert.equal(floor(rational(-4n, 2n)), -2n);
  assert.equal(floor(ZERO), 0n);
  assert.equal(floor(mul(parseExact("1/20"), fromInteger(500))) + 1n, 26n);
});

test("display projection handles large finite ratios and subnormal boundaries", () => {
  assert.equal(toNumber(parseExact("1/10")), 0.1);
  assert.equal(toNumber(rational(-1n, 4n)), -0.25);
  const huge = 1n << 4000n;
  assert.equal(toNumber(rational(huge + 1n, huge + 3n)), 1);
  assert.equal(toNumber(rational(1n << 1023n)), 2 ** 1023);
  assert.equal(toNumber(rational(1n, 1n << 1074n)), Number.MIN_VALUE);
  assert.equal(toNumber(rational(1n, 1n << 1075n)), 0);
  assert.equal(toNumber(rational(3n, 1n << 1076n)), Number.MIN_VALUE);
  assert.equal(toNumber(rational(1n << 1200n)), Infinity);
});

test("portable fraction transport contains only strings, not native BigInt", () => {
  const payload = { mass: toExact(parseExact("3/20")), count: toExact(fromInteger(9007199254740993n)) };
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { mass: "3/20", count: "9007199254740993" });
  assert.equal(Object.isFrozen(ZERO), true);
  assert.equal(Object.isFrozen(ONE), true);
});

test("typed error JSON includes message and a defensive JSON-safe details copy", () => {
  const source = { maxActions: 256, supplied: ["a", "b"] };
  const error = new MdomainError("mdomainResourceCap", "family.maxActions", "Too many cards.", source);
  source.supplied.push("changed");
  assert.deepEqual(JSON.parse(JSON.stringify(error)), {
    code: "mdomainResourceCap", field: "family.maxActions", message: "Too many cards.",
    details: { maxActions: 256, supplied: ["a", "b"] },
  });
  assert.equal(error instanceof Error, true);
  assert.throws(() => fail("mdomainGradesInvalid", "grades.values", "Bad grades."),
    (e: unknown) => e instanceof MdomainError && e.name === "MdomainError" && e.field === "grades.values");
  const unsafe = { raw: 1n } as unknown as JsonValue;
  assert.equal(new MdomainError("mdomainInputInvalid", "input", "Bad input.", unsafe).details, undefined);
});

test("bounded exact inputs can produce wider exact outputs without truncation", () => {
  const base = 10n ** 125n;
  const a = parseExact(`${base + 1n}/${base + 3n}`);
  const b = parseExact(`${base + 7n}/${base + 9n}`);
  const result = mul(a, b);
  const text = toExact(result);
  assert.ok(text.length > 256);
  assert.equal(result.n, (base + 1n) * (base + 7n));
  assert.equal(result.d, (base + 3n) * (base + 9n));
  assert.equal(cmp(result, ONE), -1);
  assert.equal(Number.isFinite(toNumber(result)), true);
  assert.equal(JSON.parse(JSON.stringify({ riskExact: text })).riskExact, text);
  // The wider result is an output; the separately bounded input parser stays strict.
  rejects(text);
});
