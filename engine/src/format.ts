// Display precision: the one module that turns engine numbers into the strings learners read
// (CONTRACT.md 5.1 and 5.5). Widgets and the registry builder (build_numbers) both call these functions,
// so a number reads the same in prose, formulas, read-outs and tables. Every function is pure.
//
// House rules (engine/README.md, "Display rules")
//   Rounding     the exact binary value of the double is rounded to the stated number of decimal places,
//                ties to even. This is what C printf and R's sprintf("%.3f") do, so strings written by R
//                and by the engine agree: 0.1875 -> .188, 0.0625 -> .062, 1.0005 -> 1.000 (1.0005 is stored
//                as 1.000499999...).
//   Leading zero dropped when the displayed absolute value is below 1 (.188, −.0227); kept in percentages
//                (0.02%) and when a function is asked to keep it.
//   Minus sign   U+2212 (−). A value displayed as zero never carries a sign.
//   Exact ends   an exact 0 is written 0; an exact probability 1 is written 1.
//   Bounds       a probability, share or risk that is not exactly 0 (or 1) is never displayed as 0 (or 1):
//                it reads "below .001" (or "above .999") at the stated precision. formatProb's `open: true` says
//                the value is known to lie strictly inside (0, 1) (CR-008), so even an exact 0 or 1 (a normal pair
//                probability whose double rounded to 1) reads "below .001" or "above .999".
//   Grouping     thousands separators "," in the integer part (4,683; 28,091,567,595), never in decimals.
//   NA           null, undefined, NaN and ±Infinity are written "NA"; E/N with N = 0 is "NA: no disclosure".
//                formatProb(null) is "NA": an E/N value (null when N = 0) must go through formatEoverN.
//   Options      objects; an unknown key throws (a misspelt option is never ignored).

import { readOptions } from "./options.ts";

export const MINUS = "−";
export const NA = "NA";
export const NO_DISCLOSURE = "NA: no disclosure";

/** A value that may be missing; missing and non-finite values display as "NA". */
export type MaybeNumber = number | null | undefined;

/** How a nonzero value that rounds to the end of [0, 1] is written: words ("below .001"), symbols ("<.001") or plain rounding. */
export type Bounds = boolean | "words" | "symbols";

function finite(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function checkDigits(name: string, d: number, min = 0): number {
  if (!Number.isInteger(d) || d < min || d > 100) throw new RangeError(`${name} must be an integer from ${min} to 100, got ${String(d)}`);
  return d;
}

// ---------------------------------------------------------------------------------------------------------
// Exact decimal rounding

const VIEW = new DataView(new ArrayBuffer(8));

/** Exact round-half-even of a·10^d for finite a ≥ 0 and any integer d (BigInt arithmetic on the exact double). */
function exactRound(a: number, d: number): bigint {
  if (a === 0) return 0n;
  VIEW.setFloat64(0, a);
  const hi = VIEW.getUint32(0);
  const lo = VIEW.getUint32(4);
  const expField = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let k: number;
  if (expField === 0) k = -1074;
  else {
    m |= 1n << 52n;
    k = expField - 1075;
  }
  // a = m · 2^k exactly
  let num = m;
  let den = 1n;
  if (k >= 0) num <<= BigInt(k);
  else den <<= BigInt(-k);
  if (d >= 0) num *= 10n ** BigInt(d);
  else den *= 10n ** BigInt(-d);
  const q = num / den;
  const twice = 2n * (num % den);
  if (twice > den) return q + 1n;
  if (twice < den) return q;
  return q % 2n === 0n ? q : q + 1n;
}

/**
 * round-half-even(a·10^d) as a BigInt, for finite a ≥ 0. Fast path: Number#toFixed rounds the exact binary value
 * correctly except that it breaks exact ties upward; an exact tie at d places happens only when a·2^(d+1) is an
 * odd integer, and then the result is moved to the even neighbour.
 */
function roundScaled(a: number, d: number): bigint {
  if (d >= 0 && d <= 20 && a < 1e21) {
    const s = a * 2 ** (d + 1);
    const tie = Number.isInteger(s) && s % 2 === 1;
    let q = BigInt(a.toFixed(d).replace(".", ""));
    if (tie && q % 2n === 1n) q -= 1n;
    return q;
  }
  return exactRound(a, d);
}

function groupThousands(int: string): string {
  if (int.length <= 3) return int;
  const head = int.length % 3;
  const parts: string[] = head ? [int.slice(0, head)] : [];
  for (let i = head; i < int.length; i += 3) parts.push(int.slice(i, i + 3));
  return parts.join(",");
}

/** Unsigned display of q·10^−d with d decimals. */
function render(q: bigint, d: number, leadingZero: boolean, group: boolean): string {
  if (d <= 0) {
    const s = q === 0n ? "0" : q.toString() + "0".repeat(-d);
    return group ? groupThousands(s) : s;
  }
  let s = q.toString();
  if (s.length <= d) s = "0".repeat(d - s.length + 1) + s;
  let int = s.slice(0, s.length - d);
  const frac = s.slice(s.length - d);
  if (int === "0" && !leadingZero) int = "";
  return (group ? groupThousands(int) : int) + "." + frac;
}

function signed(x: number, q: bigint, body: string): string {
  return x < 0 && q !== 0n ? MINUS + body : body;
}

// ---------------------------------------------------------------------------------------------------------
// Fixed decimals

export interface DecimalOptions {
  /** Decimal places (default 2). */
  digits?: number;
  /** Keep the 0 before the point for values below 1 (default false: ".25"). */
  leadingZero?: boolean;
  /** Thousands separators in the integer part (default true). */
  group?: boolean;
}

/**
 * A number with a fixed number of decimals: formatDecimal(13.649, { digits: 2 }) → "13.65";
 * formatDecimal(1249.5, { digits: 1 }) → "1,249.5"; formatDecimal(0.0175, { digits: 4 }) → ".0175".
 * Exact 0 is "0".
 */
export function formatDecimal(x: MaybeNumber, options: DecimalOptions = {}): string {
  options = readOptions<DecimalOptions>(options, ["digits", "leadingZero", "group"], "formatDecimal");
  if (!finite(x)) return NA;
  const d = checkDigits("digits", options.digits ?? 2);
  if (x === 0) return "0";
  const q = roundScaled(Math.abs(x), d);
  return signed(x, q, render(q, d, options.leadingZero ?? false, options.group ?? true));
}

export interface BoundedOptions {
  /** Decimal places. */
  digits?: number;
  /** How a nonzero value that rounds to 0 (or a probability below 1 that rounds to 1) is written (default true = words). */
  bounds?: Bounds;
}

export interface ProbOptions extends BoundedOptions {
  /** The value is known to lie strictly inside (0, 1) (default false): an exact 0 then reads as a nonzero value that
   *  rounds to 0 ("below .001"; "<.001" with `bounds: "symbols"`) and an exact 1 as a value below 1 that rounds to
   *  1 ("above .999"; ">.999"). With `bounds: false` it changes nothing. */
  open?: boolean;
}

function bounded(x: number, d: number, bounds: Bounds, unit: boolean, open = false): string {
  if (unit && open && bounds !== false && (x === 0 || x === 1)) {
    // a value in (0, 1) whose double is an end: written as the nearest value inside that rounds to the end
    const sym = bounds === "symbols";
    if (x === 0) return (sym ? "<" : "below ") + render(1n, d, false, true);
    return (sym ? ">" : "above ") + render(10n ** BigInt(d) - 1n, d, false, true);
  }
  if (x === 0) return "0";
  if (unit && x === 1) return "1";
  const a = Math.abs(x);
  const q = roundScaled(a, d);
  if (bounds !== false) {
    const sym = bounds === "symbols";
    if (q === 0n) {
      const edge = render(1n, d, false, true);
      return x > 0 ? (sym ? "<" : "below ") + edge : (sym ? ">" + MINUS : "above " + MINUS) + edge;
    }
    if (unit && x > 0 && x < 1 && q === 10n ** BigInt(d)) {
      return (sym ? ">" : "above ") + render(q - 1n, d, false, true);
    }
  }
  return signed(x, q, render(q, d, false, true));
}

/**
 * A probability or a share (π, e, N/M, E/N): 3 decimals by default, no leading zero (".188").
 * Exact 0 and 1 are "0" and "1"; any other value in (0, 1) is never shown as 0 or 1
 * ("below .001", "above .999"; `bounds: "symbols"` gives "<.001", ">.999"; `bounds: false` plain rounding).
 * `open: true` (CR-008) says the value lies strictly inside (0, 1), so an exact 0 or 1 is written the same way
 * ("below .001", "above .999"); with `bounds: false` it changes nothing. `open` is true or false (default false).
 */
export function formatProb(x: MaybeNumber, options: ProbOptions = {}): string {
  options = readOptions<ProbOptions>(options, ["digits", "bounds", "open"], "formatProb");
  if (!finite(x)) return NA;
  const open = options.open ?? false;
  if (typeof open !== "boolean") throw new RangeError(`formatProb: open must be true or false, got ${String(open)}`);
  return bounded(x, checkDigits("digits", options.digits ?? 3), options.bounds ?? true, true, open);
}

/**
 * A risk (expected loss per pair) or a small expected count: 4 decimals by default, no leading zero (".0417";
 * 1.8288 keeps its integer part). Exact 0 is "0"; a nonzero value that rounds to zero reads "below .0001"
 * (negative: "above −.0001"). Negative values (the KRW scalar risk) carry U+2212: "−.0227".
 */
export function formatRisk(x: MaybeNumber, options: BoundedOptions = {}): string {
  options = readOptions<BoundedOptions>(options, ["digits", "bounds"], "formatRisk");
  if (!finite(x)) return NA;
  return bounded(x, checkDigits("digits", options.digits ?? 4), options.bounds ?? true, false);
}

// ---------------------------------------------------------------------------------------------------------
// Significant digits and scientific notation

/** Decimal places d at which a ≥ 0 rounds to exactly `sig` significant digits, with the rounded value. */
function sigPlaces(a: number, sig: number): { d: number; q: bigint } {
  let d = sig - 1 - Math.floor(Math.log10(a));
  const lo = 10n ** BigInt(sig - 1);
  const hi = lo * 10n;
  for (let i = 0; i < 5; i += 1) {
    const q = roundScaled(a, d);
    if (q >= hi) d -= 1;
    else if (q < lo) d += 1;
    else return { d, q };
  }
  throw new Error("sigPlaces did not converge");
}

export interface SigOptions {
  /** Significant digits (default 3). */
  sig?: number;
  /** Keep the 0 before the point for values below 1 (default false). */
  leadingZero?: boolean;
  /** Thousands separators (default true). */
  group?: boolean;
}

/**
 * A number to a fixed count of significant digits: formatSig(0.0016533) → ".00165";
 * formatSig(0.000203, { sig: 3 }) → ".000203"; formatSig(1324) → "1,320". Exact 0 is "0".
 */
export function formatSig(x: MaybeNumber, options: SigOptions = {}): string {
  options = readOptions<SigOptions>(options, ["sig", "leadingZero", "group"], "formatSig");
  if (!finite(x)) return NA;
  const sig = checkDigits("sig", options.sig ?? 3, 1);
  if (x === 0) return "0";
  const { d, q } = sigPlaces(Math.abs(x), sig);
  return signed(x, q, render(q, d, options.leadingZero ?? false, options.group ?? true));
}

export interface SciOptions {
  /** Significant digits of the mantissa (default 3). */
  sig?: number;
  /** Drop trailing zeros of the mantissa (default false): 1e−12 instead of 1.00e−12. */
  trim?: boolean;
  /** "e" (default): 1.39e−17; "times": 1.39 × 10⁻¹⁷. */
  style?: "e" | "times";
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

/** Scientific notation for very small or large values (solver gaps, tie tolerances): "1.39e−17", "5 × 10⁵". Exact 0 is "0". */
export function formatSci(x: MaybeNumber, options: SciOptions = {}): string {
  options = readOptions<SciOptions>(options, ["sig", "trim", "style"], "formatSci");
  if (!finite(x)) return NA;
  const sig = checkDigits("sig", options.sig ?? 3, 1);
  if (x === 0) return "0";
  const { d, q } = sigPlaces(Math.abs(x), sig);
  const exponent = sig - 1 - d;
  const digits = q.toString();
  let mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  if (options.trim) mantissa = mantissa.replace(/\.?0+$/, "");
  const sign = x < 0 ? MINUS : "";
  const absExp = String(Math.abs(exponent));
  if (options.style === "times") {
    const sup = (exponent < 0 ? "⁻" : "") + [...absExp].map((c) => SUPERSCRIPT[c]).join("");
    return `${sign}${mantissa} × 10${sup}`;
  }
  return `${sign}${mantissa}e${exponent < 0 ? MINUS : ""}${absExp}`;
}

// ---------------------------------------------------------------------------------------------------------
// Percentages, counts, ratios, signed values

export interface PercentOptions {
  /** Decimals of the percentage (default 0): 0.052 → "5%", with digits 1 → "5.2%". */
  digits?: number;
  /** As for formatProb: a share in (0, 1) never reads 0% or 100% (default true = words). */
  bounds?: Bounds;
}

/**
 * A share as a percentage with the stated decimals; the leading zero is kept ("0.02%"). Rounding is applied to
 * the exact share (no floating multiplication by 100). Exact 0 and 1 are "0%" and "100%";
 * other shares never read 0% or 100% ("below 1%", "above 99%").
 */
export function formatPercent(x: MaybeNumber, options: PercentOptions = {}): string {
  options = readOptions<PercentOptions>(options, ["digits", "bounds"], "formatPercent");
  if (!finite(x)) return NA;
  const d = checkDigits("digits", options.digits ?? 0);
  if (x === 0) return "0%";
  if (x === 1) return "100%";
  const q = roundScaled(Math.abs(x), d + 2);
  const bounds = options.bounds ?? true;
  if (bounds !== false && x > 0 && x < 1) {
    const sym = bounds === "symbols";
    if (q === 0n) return `${sym ? "<" : "below "}${render(1n, d, true, true)}%`;
    if (q === 100n * 10n ** BigInt(d)) return `${sym ? ">" : "above "}${render(q - 1n, d, true, true)}%`;
  }
  return signed(x, q, render(q, d, true, true)) + "%";
}

/**
 * An exact count with thousands separators: 4683 → "4,683". Accepts a safe integer or a BigInt
 * (28091567595n → "28,091,567,595"). Non-integers and unsafe integers throw (a count must be exact).
 */
export function formatCount(n: number | bigint | null | undefined): string {
  if (typeof n === "bigint") return (n < 0n ? MINUS : "") + groupThousands((n < 0n ? -n : n).toString());
  if (!finite(n)) return NA;
  if (!Number.isInteger(n)) throw new RangeError(`formatCount needs an integer, got ${n}`);
  if (!Number.isSafeInteger(n)) throw new RangeError(`formatCount: ${n} is above 2^53; pass a BigInt`);
  if (n === 0) return "0";
  return (n < 0 ? MINUS : "") + groupThousands(String(Math.abs(n)));
}

export interface RatioOptions {
  /** Decimal places (formatProb rules; default 3). */
  digits?: number;
  /** Significant digits instead of decimal places (formatSig rules). */
  sig?: number;
  /** As for formatProb (default true). */
  bounds?: Bounds;
}

/** num/den as a share (formatProb rules, or significant digits with `sig`); "NA" when den is 0 or an input is missing. */
export function formatRatio(num: MaybeNumber, den: MaybeNumber, options: RatioOptions = {}): string {
  options = readOptions<RatioOptions>(options, ["digits", "sig", "bounds"], "formatRatio");
  if (!finite(num) || !finite(den) || den === 0) return NA;
  return ratioValue(num / den, options);
}

function ratioValue(v: number, options: RatioOptions): string {
  if (options.sig !== undefined) return formatSig(v, { sig: options.sig });
  return formatProb(v, { digits: options.digits, bounds: options.bounds });
}

/**
 * The share of stated directions expected to be wrong, E/N, with "NA: no disclosure" when N = 0. Three forms:
 * formatEoverN(E, N, options) from the counts; formatEoverN(EoverN, options) from one engine value (null, the
 * engine's E/N when N = 0, reads "NA: no disclosure"); formatEoverN(EoverN[], options) maps an array (for
 * example evaluateReport().EoverN) to strings. formatProb(null) is plain "NA", so E/N goes through here.
 */
export function formatEoverN(EoverN: MaybeNumber, options?: RatioOptions): string;
export function formatEoverN(EoverN: ArrayLike<MaybeNumber>, options?: RatioOptions): string[];
export function formatEoverN(E: MaybeNumber, N: MaybeNumber, options?: RatioOptions): string;
export function formatEoverN(...args: unknown[]): string | string[] {
  const [a, b, c] = args;
  if (args.length >= 2 && (b === null || typeof b !== "object")) {
    // (E, N, options)
    const options = readOptions<RatioOptions>(c, ["digits", "sig", "bounds"], "formatEoverN");
    const N = b as MaybeNumber;
    if (finite(N) && N === 0) return NO_DISCLOSURE;
    return formatRatio(a as MaybeNumber, N, options);
  }
  const options = readOptions<RatioOptions>(b, ["digits", "sig", "bounds"], "formatEoverN");
  const one = (v: unknown): string => {
    if (v === null || v === undefined) return NO_DISCLOSURE;
    if (!finite(v)) return NA;
    return ratioValue(v, options);
  };
  if (a !== null && typeof a === "object" && typeof (a as ArrayLike<unknown>).length === "number") {
    return Array.from(a as ArrayLike<unknown>, one);
  }
  return one(a);
}

export interface SignedOptions {
  /** Decimal places (default 3). */
  digits?: number;
  /** Significant digits instead of decimal places. */
  sig?: number;
  /** Keep the leading zero (default false). */
  leadingZero?: boolean;
}

/**
 * A difference with an explicit sign: "+.049", "−.0227" (U+2212). Exact 0, and any value displayed as zero,
 * carries no sign.
 */
export function formatSigned(x: MaybeNumber, options: SignedOptions = {}): string {
  options = readOptions<SignedOptions>(options, ["digits", "sig", "leadingZero"], "formatSigned");
  if (!finite(x)) return NA;
  if (x === 0) return "0";
  const body =
    options.sig !== undefined
      ? formatSig(Math.abs(x), { sig: options.sig, leadingZero: options.leadingZero })
      : formatDecimal(Math.abs(x), { digits: options.digits ?? 3, leadingZero: options.leadingZero });
  if (!/[1-9]/.test(body)) return body;
  return (x > 0 ? "+" : MINUS) + body;
}

// ---------------------------------------------------------------------------------------------------------
// Exact fractions

function toBigInt(name: string, v: number | bigint): bigint {
  if (typeof v === "bigint") return v;
  if (!Number.isSafeInteger(v)) throw new RangeError(`${name} must be a safe integer or a BigInt, got ${String(v)}`);
  return BigInt(v);
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** An exact fraction in lowest terms: formatFraction(22, 120) → "11/60"; (−1, 2) → "−1/2"; (6, 3) → "2"; den 0 → "NA". */
export function formatFraction(num: number | bigint, den: number | bigint): string {
  let p = toBigInt("num", num);
  let q = toBigInt("den", den);
  if (q === 0n) return NA;
  if (q < 0n) {
    p = -p;
    q = -q;
  }
  if (p === 0n) return "0";
  const neg = p < 0n;
  if (neg) p = -p;
  const g = gcd(p, q);
  p /= g;
  q /= g;
  return (neg ? MINUS : "") + (q === 1n ? p.toString() : `${p}/${q}`);
}

export interface RationalOptions {
  /** Largest denominator searched (default 1000). */
  maxDenominator?: number;
  /** Accepted |x − p/q|, relative to max(1, |x|) (default 1e−12). Keep it below 1/(2·maxDenominator²) so the fraction is unique. */
  tolerance?: number;
}

/**
 * The fraction p/q (lowest terms, q ≤ maxDenominator) within `tolerance` of x, or null. Searches the
 * continued-fraction convergents of x; with the default tolerance any such fraction is a convergent and unique.
 */
export function rationalApprox(x: MaybeNumber, options: RationalOptions = {}): { num: number; den: number } | null {
  options = readOptions<RationalOptions>(options, ["maxDenominator", "tolerance"], "rationalApprox");
  if (!finite(x)) return null;
  const maxDen = options.maxDenominator ?? 1000;
  const tol = (options.tolerance ?? 1e-12) * Math.max(1, Math.abs(x));
  const sign = x < 0 ? -1 : 1;
  const a0 = Math.abs(x);
  let r = a0;
  let h1 = 1;
  let h2 = 0;
  let k1 = 0;
  let k2 = 1;
  for (let i = 0; i < 64; i += 1) {
    const a = Math.floor(r);
    const h = a * h1 + h2;
    const k = a * k1 + k2;
    if (k > maxDen) return null;
    if (Math.abs(a0 - h / k) <= tol) return { num: sign * h, den: k };
    const frac = r - a;
    if (frac === 0) return null;
    r = 1 / frac;
    h2 = h1;
    h1 = h;
    k2 = k1;
    k1 = k;
  }
  return null;
}

/** x written as its exact fraction ("11/60"); throws when no fraction with denominator ≤ maxDenominator is within tolerance. */
export function formatRational(x: MaybeNumber, options: RationalOptions = {}): string {
  options = readOptions<RationalOptions>(options, ["maxDenominator", "tolerance"], "formatRational");
  if (!finite(x)) return NA;
  const r = rationalApprox(x, options);
  if (!r) throw new RangeError(`formatRational: ${x} is not a fraction with denominator <= ${options.maxDenominator ?? 1000}`);
  return formatFraction(r.num, r.den);
}

// ---------------------------------------------------------------------------------------------------------
// Settings, grade vectors, tuples

const FRACTION_DENOMINATORS = new Set([1, 2, 3, 4, 6, 8, 12]);

/** Shortest decimal with minDigits … maxDigits places equal to v (within 1e−12), or null. */
function shortestDecimal(v: number, minDigits: number, maxDigits: number): string | null {
  const a = Math.abs(v);
  for (let p = minDigits; p <= maxDigits; p += 1) {
    const q = roundScaled(a, p);
    if (Math.abs(a - Number(q) / 10 ** p) <= 1e-12 * Math.max(1, a)) return signed(v, q, render(q, p, false, true));
  }
  return null;
}

function settingScalar(v: number, minDigits: number): string {
  if (Number.isInteger(v)) return (v < 0 ? MINUS : "") + String(Math.abs(v));
  const dec = shortestDecimal(v, minDigits, 4);
  if (dec !== null) return dec;
  const r = rationalApprox(v, { maxDenominator: 12 });
  if (r) return formatFraction(r.num, r.den);
  return formatDecimal(v, { digits: 4 });
}

/**
 * A setting as the course writes it. A scalar (τ, λ, a cutoff, an interval level) uses the shortest exact
 * decimal with at least two places (.20, .25, .125, 1.96), else a fraction with denominator ≤ 12 (1/3), else
 * 4 decimals; integers (caps, seeds) are written plainly without separators ("3", "20240101").
 * A weight vector is written as fractions when every weight is k/q with q in {1, 2, 3, 4, 6, 8, 12}
 * ("(1/2, 1/2)", "(1/2, 1/4, 1/4)"), otherwise as shortest decimals ("(.8, .2)").
 */
export function formatSetting(value: MaybeNumber | ArrayLike<number>): string {
  if (value !== null && value !== undefined && typeof value === "object") {
    const ws = Array.from(value);
    if (!ws.every(finite)) return NA;
    const fracs = ws.map((w) => rationalApprox(w, { maxDenominator: 12 }));
    if (fracs.every((r) => r !== null && FRACTION_DENOMINATORS.has(r.den))) {
      return `(${fracs.map((r) => formatFraction(r!.num, r!.den)).join(", ")})`;
    }
    return `(${ws.map((w) => settingScalar(w, 1)).join(", ")})`;
  }
  if (!finite(value)) return NA;
  return settingScalar(value, 2);
}

function checkGradeLike(name: string, xs: ArrayLike<number>, min: number): number[] {
  const out = Array.from(xs);
  for (const v of out) if (!Number.isInteger(v) || v < min) throw new RangeError(`${name}: entries must be integers >= ${min}, got ${String(v)}`);
  return out;
}

/** A grade vector in unit order: [1, 1, 2, 2, 3, 3] → "1/1/2/2/3/3" (grade 1 = highest priority). */
export function formatGrades(g: ArrayLike<number>): string {
  return checkGradeLike("formatGrades", g, 1).join("/");
}

/** Grade sizes, grade 1 first: [3, 6, 3] → "sizes 3, 6, 3" (`label: false` → "3, 6, 3"). */
export function formatSizes(sizes: ArrayLike<number>, options: { label?: boolean } = {}): string {
  options = readOptions<{ label?: boolean }>(options, ["label"], "formatSizes");
  const body = checkGradeLike("formatSizes", sizes, 0).map((s) => formatCount(s)).join(", ");
  return (options.label ?? true) ? `sizes ${body}` : body;
}

/** A tuple of values with one formatter: formatTuple([.15, .85, .2], (v) => formatProb(v, { digits: 2 })) → "(.15, .85, .20)". */
export function formatTuple(values: ArrayLike<MaybeNumber>, format: (v: MaybeNumber) => string = (v) => formatProb(v)): string {
  // one argument per call: Array#map would pass the index where the options object belongs
  return `(${Array.from(values, (v) => format(v)).join(", ")})`;
}
