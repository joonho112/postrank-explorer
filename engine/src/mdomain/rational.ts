/** Exact internal arithmetic. Portable policies and results use canonical fraction text. */
import { fail, type MdomainErrorCode } from "./error.ts";

export interface Rational { n: bigint; d: bigint }

export const ZERO: Rational = Object.freeze({ n: 0n, d: 1n });
export const ONE: Rational = Object.freeze({ n: 1n, d: 1n });

function abs(n: bigint): bigint { return n < 0n ? -n : n; }
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return a;
}

/** Internal signed fractions have a positive denominator and reduced terms. */
export function rational(n: bigint, d: bigint = 1n): Rational {
  if (typeof n !== "bigint" || typeof d !== "bigint")
    fail("mdomainPolicyInvalid", "rational", "Internal numerator and denominator must be BigInt.");
  if (d === 0n) fail("mdomainPolicyInvalid", "rational.denominator", "A fraction denominator cannot be zero.");
  if (n === 0n) return ZERO;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** Numbers are accepted here only when they are exact safe integer counts. */
export function fromInteger(n: number | bigint): Rational {
  if (typeof n === "bigint") return rational(n);
  if (typeof n !== "number" || !Number.isSafeInteger(n))
    fail("mdomainPolicyInvalid", "integer", "Expected an exact safe integer or a BigInt.");
  return rational(BigInt(n));
}

export function toExact(r: Rational): string {
  return r.d === 1n ? String(r.n) : `${r.n}/${r.d}`;
}

/** No Number coercion, decimal notation, unreduced terms, signs or whitespace. */
export function parseExact(
  value: unknown,
  field = "exact",
  code: MdomainErrorCode = "mdomainPolicyInvalid",
): Rational {
  if (typeof value !== "string" || value.length === 0 || value.length > 256)
    fail(code, field, "Expected canonical nonnegative fraction text of at most 256 characters.");
  const match = /^(0|[1-9][0-9]*)(?:\/([1-9][0-9]*))?$/.exec(value);
  if (!match) fail(code, field, "Expected canonical nonnegative integer or fraction text.");
  const out = rational(BigInt(match[1]), match[2] === undefined ? 1n : BigInt(match[2]));
  if (toExact(out) !== value)
    fail(code, field, "Fraction text must be reduced, with zero and integers written without a denominator.");
  return out;
}

export function add(a: Rational, b: Rational): Rational {
  const common = gcd(a.d, b.d);
  return rational(a.n * (b.d / common) + b.n * (a.d / common), (a.d / common) * b.d);
}

export function sub(a: Rational, b: Rational): Rational {
  const common = gcd(a.d, b.d);
  return rational(a.n * (b.d / common) - b.n * (a.d / common), (a.d / common) * b.d);
}

export function mul(a: Rational, b: Rational): Rational {
  if (a.n === 0n || b.n === 0n) return ZERO;
  const left = gcd(a.n, b.d); const right = gcd(b.n, a.d);
  return rational((a.n / left) * (b.n / right), (a.d / right) * (b.d / left));
}

export function div(a: Rational, b: Rational): Rational {
  if (b.n === 0n) fail("mdomainPolicyInvalid", "rational.divisor", "Cannot divide by zero.");
  return mul(a, rational(b.d, b.n));
}

export function cmp(a: Rational, b: Rational): -1 | 0 | 1 {
  const difference = a.n * b.d - b.n * a.d;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

/** Mathematical floor, including negative internal intermediates. */
export function floor(r: Rational): bigint {
  const quotient = r.n / r.d;
  return r.n < 0n && r.n % r.d !== 0n ? quotient - 1n : quotient;
}

/** Approximate display projection only; never use this result to decide a tie or cap. */
export function toNumber(r: Rational): number {
  if (r.n === 0n) return 0;
  const sign = r.n < 0n ? -1 : 1;
  const n = abs(r.n);
  const nShift = Math.max(0, n.toString(2).length - 54);
  const dShift = Math.max(0, r.d.toString(2).length - 54);
  const headRatio = Number(n >> BigInt(nShift)) / Number(r.d >> BigInt(dShift));
  const exponent = nShift - dShift;
  // Split extreme powers so a finite ratio does not become Infinity/Infinity,
  // and subnormal projections round at the final multiplication.
  const magnitude = exponent > 1023
    ? (headRatio * 2 ** 1023) * 2 ** (exponent - 1023)
    : exponent < -1022
      ? (headRatio * 2 ** (exponent + 1022)) * 2 ** -1022
      : headRatio * 2 ** exponent;
  return sign * magnitude;
}
