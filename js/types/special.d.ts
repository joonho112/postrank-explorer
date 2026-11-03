/**
 * Standard normal distribution function Φ(z) = Pr(Z ≤ z).
 * Accurate relative to Φ(z) itself in the lower tail (down to z = −37.5193, below which it returns 0,
 * as R's pnorm). Returns NaN for NaN, 0 at −Infinity and 1 at +Infinity.
 */
export declare function normalCdf(z: number): number;
/**
 * normalCdf(k) − normalCdf(−k): the chance that a normal estimate lies within k standard errors of its mean
 * (engine/API.md, "v3 helpers: Part 1 supplement"). k must be ≥ 0, finite or Infinity (which gives 1);
 * anything else (a negative number, NaN, a non-number) throws a RangeError. normalCoverage(0) = 0.
 */
export declare function normalCoverage(k: number): number;
/**
 * Standard normal survival function 1 − Φ(z) = Pr(Z > z), computed directly (not as 1 − normalCdf),
 * so it keeps full relative precision in the upper tail up to z = 37.5193 (beyond it returns 0, as R's
 * pnorm(z, lower.tail = FALSE)). normalSf(z) = normalCdf(−z).
 */
export declare function normalSf(z: number): number;
/**
 * Standard normal density φ(z) = exp(−z²/2)/√(2π). For |z| ≥ 5 the square is formed exactly by splitting
 * z = z1 + z2 with z1 a multiple of 2^−16 (as R's dnorm), so φ keeps full relative precision to |z| = 38.
 */
export declare function normalPdf(z: number): number;
export interface QuantileOptions {
    /** true (default): p = Pr(Z ≤ x). false: p = Pr(Z > x), so small upper-tail probabilities keep full precision. */
    lowerTail?: boolean;
}
/**
 * Standard normal quantile Φ⁻¹(p): the x with Pr(Z ≤ x) = p (or Pr(Z > x) = p with `lowerTail: false`).
 * Wichura's AS 241 (PPND16). Both tails are accurate: for p near 1 the tail 1 − p is formed exactly
 * (p ≥ 1/2 makes 1 − p exact), and `lowerTail: false` takes a tiny upper-tail probability directly.
 * Returns −Infinity at p = 0, +Infinity at p = 1 (reversed with lowerTail false), NaN outside [0, 1].
 */
export declare function normalQuantile(p: number, options?: QuantileOptions): number;
/**
 * Complementary error function erfc(x) = (2/√π) ∫_x^∞ exp(−t²) dt, computed directly (Cody's CALERF),
 * with full relative precision for large x (returns 0 for x ≥ 26.543, as CALERF) and erfc(x) = 2 − erfc(−x)
 * for negative x. Returns NaN for NaN, 0 at +Infinity and 2 at −Infinity.
 */
export declare function erfc(x: number): number;
