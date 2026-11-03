// Standard normal distribution and the complementary error function.
//
// Definitions and sources
//   normalCdf, normalSf  W. J. Cody (1993), "Algorithm 715: SPECFUN", ACM TOMS 19, 22-32, routine ANORM:
//                        rational Chebyshev approximations on |z| <= 0.67449, (0.67449, sqrt(32)] and
//                        (sqrt(32), 37.5193), with the exp(-z^2/2) factor split as exp(-zr^2/2) exp(-d/2),
//                        zr = trunc(16 z)/16, so the far tail keeps full relative precision. This is the
//                        algorithm of R's pnorm() (nmath/pnorm.c, pnorm_both), including its cut-offs.
//   normalPdf            exp(-z^2/2)/sqrt(2 pi); for |z| >= 5 z is split as z1 + z2 with z1 a multiple of
//                        2^-16 (M. Welinder, R PR#15620), as R's dnorm() does.
//   normalQuantile       M. J. Wichura (1988), "Algorithm AS 241: The percentage points of the normal
//                        distribution", Applied Statistics 37, 477-484, routine PPND16 (about 16 digits).
//                        This is the algorithm of R's qnorm() for min(p, 1 - p) >= 1e-300.
//   erfc                 W. J. Cody (1969), "Rational Chebyshev approximations for the error function",
//                        Mathematics of Computation 23, 631-637; SPECFUN routine CALERF (JINT = 1), with the
//                        same split of exp(-x^2).
//   normalCoverage       Φ(k) − Φ(−k), the chance that a normal estimate lies within k SEs of its mean (v3 helpers,
//                        Part 1 supplement; apps 1.1, 1.2).
//
// Accuracy (engine/tests/special.test.ts): relative error at most 1e-14 against R 4.6.0 pnorm, pnorm(upper),
// dnorm and qnorm on |z| <= 37 and p down to 1e-300, and against 50-digit mpmath values for erfc.
// The relative error is measured on the smaller tail: normalSf(z) for z > 0 and normalCdf(z) for z < 0.

import { readOptions } from "./options.ts";

const SQRT_32 = 5.656854249492380195206754896838; // sqrt(32)
const INV_SQRT_2PI = 0.398942280401432677939946059934; // 1/sqrt(2 pi)
const HALF_EPS = Number.EPSILON * 0.5;
const SIXTEEN = 16; // exact scale for the exp(-z^2/2) split

// ANORM (Cody 1993) coefficients, as in R's pnorm.c.
const A = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582, 18154.981253343561249, 0.065682337918207449113];
const B = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205, 45507.789335026729956];
const C = [
  0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979, 597.27027639480026226, 2494.5375852903726711,
  6848.1904505362823326, 11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8,
];
const D = [
  22.266688044328115691, 235.38790178262499861, 1519.377599407554805, 6485.558298266760755, 18615.571640885098091,
  34900.952721145977266, 38912.003286093271411, 19685.429676859990727,
];
const P = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807, 0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];
const Q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515, 0.00378239633202758244, 7.29751555083966205e-5];

// R's cut-offs beyond which the lower (or upper) tail is returned as exactly 0 or 1.
const TAIL_ZERO = 37.5193; // Pr(Z <= -37.5193) is below the smallest normal double
const TAIL_ONE = 8.2924; // Pr(Z <= 8.2924) rounds to 1

/**
 * Both tails of the standard normal at z: [lower, upper] = [Pr(Z <= z), Pr(Z > z)].
 * Each tail is computed directly (never as 1 minus the other) when it is the smaller one.
 */
function normalTails(z: number): [number, number] {
  const y = Math.abs(z);
  if (y <= 0.67448975) {
    // |z| <= qnorm(3/4)
    let xnum = 0;
    let xden = 0;
    if (y > HALF_EPS) {
      const xsq = z * z;
      xnum = A[4] * xsq;
      xden = xsq;
      for (let i = 0; i < 3; i += 1) {
        xnum = (xnum + A[i]) * xsq;
        xden = (xden + B[i]) * xsq;
      }
    }
    const temp = (z * (xnum + A[3])) / (xden + B[3]);
    return [0.5 + temp, 0.5 - temp];
  }
  let small: number; // the tail beyond |z|: Pr(Z > |z|)
  if (y <= SQRT_32) {
    let xnum = C[8] * y;
    let xden = y;
    for (let i = 0; i < 7; i += 1) {
      xnum = (xnum + C[i]) * y;
      xden = (xden + D[i]) * y;
    }
    const temp = (xnum + C[7]) / (xden + D[7]);
    small = splitExp(y) * temp;
  } else if (y < TAIL_ZERO) {
    const xsq = 1 / (z * z);
    let xnum = P[5] * xsq;
    let xden = xsq;
    for (let i = 0; i < 4; i += 1) {
      xnum = (xnum + P[i]) * xsq;
      xden = (xden + Q[i]) * xsq;
    }
    let temp = (xsq * (xnum + P[4])) / (xden + Q[4]);
    temp = (INV_SQRT_2PI - temp) / y;
    small = splitExp(z) * temp;
  } else {
    small = 0;
  }
  // small = Pr(Z > |z|); place it on the correct side
  return z > 0 ? [1 - small, small] : [small, 1 - small];
}

/** exp(-x^2/2) as exp(-xr^2/2) exp(-d/2), xr = trunc(16 x)/16, d = (x - xr)(x + xr): exact split of x^2. */
function splitExp(x: number): number {
  const xr = Math.trunc(x * SIXTEEN) / SIXTEEN;
  const del = (x - xr) * (x + xr);
  return Math.exp(-xr * (xr * 0.5)) * Math.exp(-(del * 0.5));
}

/**
 * Standard normal distribution function Φ(z) = Pr(Z ≤ z).
 * Accurate relative to Φ(z) itself in the lower tail (down to z = −37.5193, below which it returns 0,
 * as R's pnorm). Returns NaN for NaN, 0 at −Infinity and 1 at +Infinity.
 */
export function normalCdf(z: number): number {
  if (Number.isNaN(z)) return Number.NaN;
  if (z <= -TAIL_ZERO) return 0;
  if (z >= TAIL_ONE) return 1;
  return normalTails(z)[0];
}

/**
 * normalCdf(k) − normalCdf(−k): the chance that a normal estimate lies within k standard errors of its mean
 * (engine/API.md, "v3 helpers: Part 1 supplement"). k must be ≥ 0, finite or Infinity (which gives 1);
 * anything else (a negative number, NaN, a non-number) throws a RangeError. normalCoverage(0) = 0.
 */
export function normalCoverage(k: number): number {
  if (typeof k !== "number" || !(k >= 0)) throw new RangeError(`normalCoverage: k must be a number ≥ 0 (or Infinity), got ${String(k)}`);
  if (k === Number.POSITIVE_INFINITY) return 1;
  return normalCdf(k) - normalCdf(-k);
}

/**
 * Standard normal survival function 1 − Φ(z) = Pr(Z > z), computed directly (not as 1 − normalCdf),
 * so it keeps full relative precision in the upper tail up to z = 37.5193 (beyond it returns 0, as R's
 * pnorm(z, lower.tail = FALSE)). normalSf(z) = normalCdf(−z).
 */
export function normalSf(z: number): number {
  if (Number.isNaN(z)) return Number.NaN;
  if (z >= TAIL_ZERO) return 0;
  if (z <= -TAIL_ONE) return 1;
  return normalTails(z)[1];
}

// R's dnorm: no underflow hoops beyond sqrt(-2 ln 2 (DBL_MIN_EXP + 1 - DBL_MANT_DIG)) = 38.5677
const PDF_ZERO = Math.sqrt(-2 * Math.LN2 * (-1021 + 1 - 53));
const TWO_POW_16 = 65536;

/**
 * Standard normal density φ(z) = exp(−z²/2)/√(2π). For |z| ≥ 5 the square is formed exactly by splitting
 * z = z1 + z2 with z1 a multiple of 2^−16 (as R's dnorm), so φ keeps full relative precision to |z| = 38.
 */
export function normalPdf(z: number): number {
  if (Number.isNaN(z)) return Number.NaN;
  const x = Math.abs(z);
  if (x === Infinity) return 0;
  if (x < 5) return INV_SQRT_2PI * Math.exp(-0.5 * x * x);
  if (x > PDF_ZERO) return 0;
  const x1 = roundHalfEven(x * TWO_POW_16) / TWO_POW_16;
  const x2 = x - x1;
  return INV_SQRT_2PI * (Math.exp(-0.5 * x1 * x1) * Math.exp((-0.5 * x2 - x1) * x2));
}

/** Round to the nearest integer, ties to even (C nearbyint under the default rounding mode). */
function roundHalfEven(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

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
export function normalQuantile(p: number, options: QuantileOptions = {}): number {
  const lowerTail = readOptions<QuantileOptions>(options, ["lowerTail"], "normalQuantile").lowerTail ?? true;
  if (Number.isNaN(p) || p < 0 || p > 1) return Number.NaN;
  if (p === 0) return lowerTail ? -Infinity : Infinity;
  if (p === 1) return lowerTail ? Infinity : -Infinity;
  // q = (lower-tail probability) - 1/2, formed so the tail closest to 0 or 1 stays exact
  const pLower = lowerTail ? p : 0.5 - p + 0.5;
  const q = pLower - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r +
          133.14166789178437745) * r + 3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r +
        42.313330701600911252) * r + 1)
    );
  }
  // tail: the smaller of the two tail probabilities, taken from the argument without cancellation
  let tail: number;
  if (lowerTail) tail = q > 0 ? 0.5 - p + 0.5 : p;
  else tail = q > 0 ? p : 0.5 - p + 0.5;
  let r = Math.sqrt(-Math.log(tail));
  let val: number;
  if (r <= 5) {
    r -= 1.6;
    val =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r +
        1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r +
        0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r +
        2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    val =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r +
        0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r +
        0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -val : val;
}

// CALERF (Cody 1969) coefficients for erfc.
const EA = [3.1611237438705656, 113.864154151050156, 377.485237685302021, 3209.37758913846947, 0.185777706184603153];
const EB = [23.6012909523441209, 244.024637934444173, 1282.61652607737228, 2844.23683343917062];
const EC = [
  0.564188496988670089, 8.88314979438837594, 66.1191906371416295, 298.635138197400131, 881.95222124176909,
  1712.04761263407058, 2051.07837782607147, 1230.33935479799725, 2.15311535474403846e-8,
];
const ED = [
  15.7449261107098347, 117.693950891312499, 537.181101862009858, 1621.38957456669019, 3290.79923573345963,
  4362.61909014324716, 3439.36767414372164, 1230.33935480374942,
];
const EP = [0.305326634961232344, 0.360344899949804439, 0.125781726111229246, 0.0160837851487422766, 6.58749161529837803e-4, 0.0163153871373020978];
const EQ = [2.56852019228982242, 1.87295284992346725, 0.527905102951428412, 0.0605183413124413191, 2.33520497626869185e-3];
const INV_SQRT_PI = 0.56418958354775628695; // 1/sqrt(pi)
const ERFC_ZERO = 26.543; // CALERF XBIG: erfc(x) is below the smallest normal double beyond it

/**
 * Complementary error function erfc(x) = (2/√π) ∫_x^∞ exp(−t²) dt, computed directly (Cody's CALERF),
 * with full relative precision for large x (returns 0 for x ≥ 26.543, as CALERF) and erfc(x) = 2 − erfc(−x)
 * for negative x. Returns NaN for NaN, 0 at +Infinity and 2 at −Infinity.
 */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  const y = Math.abs(x);
  let result: number;
  if (y <= 0.46875) {
    let ysq = 0;
    if (y > HALF_EPS) ysq = y * y;
    let xnum = EA[4] * ysq;
    let xden = ysq;
    for (let i = 0; i < 3; i += 1) {
      xnum = (xnum + EA[i]) * ysq;
      xden = (xden + EB[i]) * ysq;
    }
    return 1 - (x * (xnum + EA[3])) / (xden + EB[3]);
  }
  if (y <= 4) {
    let xnum = EC[8] * y;
    let xden = y;
    for (let i = 0; i < 7; i += 1) {
      xnum = (xnum + EC[i]) * y;
      xden = (xden + ED[i]) * y;
    }
    result = (xnum + EC[7]) / (xden + ED[7]);
    result *= splitExpSquare(y);
  } else if (y >= ERFC_ZERO) {
    result = 0;
  } else {
    const ysq = 1 / (y * y);
    let xnum = EP[5] * ysq;
    let xden = ysq;
    for (let i = 0; i < 4; i += 1) {
      xnum = (xnum + EP[i]) * ysq;
      xden = (xden + EQ[i]) * ysq;
    }
    result = (ysq * (xnum + EP[4])) / (xden + EQ[4]);
    result = (INV_SQRT_PI - result) / y;
    result *= splitExpSquare(y);
  }
  return x < 0 ? 2 - result : result;
}

/** exp(-y^2) as exp(-yr^2) exp(-d), yr = trunc(16 y)/16, d = (y - yr)(y + yr). */
function splitExpSquare(y: number): number {
  const yr = Math.trunc(y * SIXTEEN) / SIXTEEN;
  const del = (y - yr) * (y + yr);
  return Math.exp(-yr * yr) * Math.exp(-del);
}
