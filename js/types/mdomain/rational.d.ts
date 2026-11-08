/** Exact internal arithmetic. Portable policies and results use canonical fraction text. */
import { type MdomainErrorCode } from "./error.ts";
export interface Rational {
    n: bigint;
    d: bigint;
}
export declare const ZERO: Rational;
export declare const ONE: Rational;
/** Internal signed fractions have a positive denominator and reduced terms. */
export declare function rational(n: bigint, d?: bigint): Rational;
/** Numbers are accepted here only when they are exact safe integer counts. */
export declare function fromInteger(n: number | bigint): Rational;
export declare function toExact(r: Rational): string;
/** No Number coercion, decimal notation, unreduced terms, signs or whitespace. */
export declare function parseExact(value: unknown, field?: string, code?: MdomainErrorCode): Rational;
export declare function add(a: Rational, b: Rational): Rational;
export declare function sub(a: Rational, b: Rational): Rational;
export declare function mul(a: Rational, b: Rational): Rational;
export declare function div(a: Rational, b: Rational): Rational;
export declare function cmp(a: Rational, b: Rational): -1 | 0 | 1;
/** Mathematical floor, including negative internal intermediates. */
export declare function floor(r: Rational): bigint;
/** Approximate display projection only; never use this result to decide a tie or cap. */
export declare function toNumber(r: Rational): number;
