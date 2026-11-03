export declare const MINUS = "\u2212";
export declare const NA = "NA";
export declare const NO_DISCLOSURE = "NA: no disclosure";
/** A value that may be missing; missing and non-finite values display as "NA". */
export type MaybeNumber = number | null | undefined;
/** How a nonzero value that rounds to the end of [0, 1] is written: words ("below .001"), symbols ("<.001") or plain rounding. */
export type Bounds = boolean | "words" | "symbols";
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
export declare function formatDecimal(x: MaybeNumber, options?: DecimalOptions): string;
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
/**
 * A probability or a share (π, e, N/M, E/N): 3 decimals by default, no leading zero (".188").
 * Exact 0 and 1 are "0" and "1"; any other value in (0, 1) is never shown as 0 or 1
 * ("below .001", "above .999"; `bounds: "symbols"` gives "<.001", ">.999"; `bounds: false` plain rounding).
 * `open: true` (CR-008) says the value lies strictly inside (0, 1), so an exact 0 or 1 is written the same way
 * ("below .001", "above .999"); with `bounds: false` it changes nothing. `open` is true or false (default false).
 */
export declare function formatProb(x: MaybeNumber, options?: ProbOptions): string;
/**
 * A risk (expected loss per pair) or a small expected count: 4 decimals by default, no leading zero (".0417";
 * 1.8288 keeps its integer part). Exact 0 is "0"; a nonzero value that rounds to zero reads "below .0001"
 * (negative: "above −.0001"). Negative values (the KRW scalar risk) carry U+2212: "−.0227".
 */
export declare function formatRisk(x: MaybeNumber, options?: BoundedOptions): string;
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
export declare function formatSig(x: MaybeNumber, options?: SigOptions): string;
export interface SciOptions {
    /** Significant digits of the mantissa (default 3). */
    sig?: number;
    /** Drop trailing zeros of the mantissa (default false): 1e−12 instead of 1.00e−12. */
    trim?: boolean;
    /** "e" (default): 1.39e−17; "times": 1.39 × 10⁻¹⁷. */
    style?: "e" | "times";
}
/** Scientific notation for very small or large values (solver gaps, tie tolerances): "1.39e−17", "5 × 10⁵". Exact 0 is "0". */
export declare function formatSci(x: MaybeNumber, options?: SciOptions): string;
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
export declare function formatPercent(x: MaybeNumber, options?: PercentOptions): string;
/**
 * An exact count with thousands separators: 4683 → "4,683". Accepts a safe integer or a BigInt
 * (28091567595n → "28,091,567,595"). Non-integers and unsafe integers throw (a count must be exact).
 */
export declare function formatCount(n: number | bigint | null | undefined): string;
export interface RatioOptions {
    /** Decimal places (formatProb rules; default 3). */
    digits?: number;
    /** Significant digits instead of decimal places (formatSig rules). */
    sig?: number;
    /** As for formatProb (default true). */
    bounds?: Bounds;
}
/** num/den as a share (formatProb rules, or significant digits with `sig`); "NA" when den is 0 or an input is missing. */
export declare function formatRatio(num: MaybeNumber, den: MaybeNumber, options?: RatioOptions): string;
/**
 * The share of stated directions expected to be wrong, E/N, with "NA: no disclosure" when N = 0. Three forms:
 * formatEoverN(E, N, options) from the counts; formatEoverN(EoverN, options) from one engine value (null, the
 * engine's E/N when N = 0, reads "NA: no disclosure"); formatEoverN(EoverN[], options) maps an array (for
 * example evaluateReport().EoverN) to strings. formatProb(null) is plain "NA", so E/N goes through here.
 */
export declare function formatEoverN(EoverN: MaybeNumber, options?: RatioOptions): string;
export declare function formatEoverN(EoverN: ArrayLike<MaybeNumber>, options?: RatioOptions): string[];
export declare function formatEoverN(E: MaybeNumber, N: MaybeNumber, options?: RatioOptions): string;
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
export declare function formatSigned(x: MaybeNumber, options?: SignedOptions): string;
/** An exact fraction in lowest terms: formatFraction(22, 120) → "11/60"; (−1, 2) → "−1/2"; (6, 3) → "2"; den 0 → "NA". */
export declare function formatFraction(num: number | bigint, den: number | bigint): string;
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
export declare function rationalApprox(x: MaybeNumber, options?: RationalOptions): {
    num: number;
    den: number;
} | null;
/** x written as its exact fraction ("11/60"); throws when no fraction with denominator ≤ maxDenominator is within tolerance. */
export declare function formatRational(x: MaybeNumber, options?: RationalOptions): string;
/**
 * A setting as the course writes it. A scalar (τ, λ, a cutoff, an interval level) uses the shortest exact
 * decimal with at least two places (.20, .25, .125, 1.96), else a fraction with denominator ≤ 12 (1/3), else
 * 4 decimals; integers (caps, seeds) are written plainly without separators ("3", "20240101").
 * A weight vector is written as fractions when every weight is k/q with q in {1, 2, 3, 4, 6, 8, 12}
 * ("(1/2, 1/2)", "(1/2, 1/4, 1/4)"), otherwise as shortest decimals ("(.8, .2)").
 */
export declare function formatSetting(value: MaybeNumber | ArrayLike<number>): string;
/** A grade vector in unit order: [1, 1, 2, 2, 3, 3] → "1/1/2/2/3/3" (grade 1 = highest priority). */
export declare function formatGrades(g: ArrayLike<number>): string;
/** Grade sizes, grade 1 first: [3, 6, 3] → "sizes 3, 6, 3" (`label: false` → "3, 6, 3"). */
export declare function formatSizes(sizes: ArrayLike<number>, options?: {
    label?: boolean;
}): string;
/** A tuple of values with one formatter: formatTuple([.15, .85, .2], (v) => formatProb(v, { digits: 2 })) → "(.15, .85, .20)". */
export declare function formatTuple(values: ArrayLike<MaybeNumber>, format?: (v: MaybeNumber) => string): string;
