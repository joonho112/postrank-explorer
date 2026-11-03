// The one seeded random stream of postrank Explorer (CONTRACT.md 7.5).
//
// Integers   mulberry32 (Tommy Ettinger, public domain): 32-bit state, one unsigned 32-bit output per call.
// Uniforms   u = (x + 1/2) / 2^32 for each 32-bit output x, so 2^-33 <= u <= 1 - 2^-33: never 0, never 1,
//            and exact in double precision.
// Normals    Box-Muller from consecutive uniforms (u1, u2): R = sqrt(-2 log u1), t = (2 pi) u2,
//            first z1 = R cos t, then z2 = R sin t (cached and returned by the next call).
//
// engine/README.md ("Random stream") states the algorithm step by step with 32-bit integer arithmetic so
// an R oracle can reproduce it: the integers and uniforms bit for bit, the normals to within a few units
// in the last place (log, cos and sin come from different maths libraries in R and in JavaScript).

const GOLDEN_GAMMA = 0x6d2b79f5; // mulberry32 increment, 1831565813
const TWO_POW_32 = 4294967296;
const TWO_PI = 2 * Math.PI; // exact doubling of the double nearest to pi

/** Reduce an integer seed to the 32-bit initial state (ToUint32: seed mod 2^32). Throws on non-integers. */
function seedState(seed: number): number {
  if (!Number.isInteger(seed)) throw new RangeError(`seed must be an integer, got ${String(seed)}`);
  return seed >>> 0;
}

/**
 * mulberry32 as a stream of unsigned 32-bit integers (0 … 2^32 − 1). `rng` and `normalStream` are built on
 * this stream; it is exported so parity checks can compare the integers themselves.
 */
export function rngUint32(seed: number): () => number {
  let state = seedState(seed);
  return () => {
    state = (state + GOLDEN_GAMMA) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Seeded uniform stream on the open interval (0, 1): u = (x + 1/2)/2^32 for each mulberry32 output x. */
export function rng(seed: number): () => number {
  const next = rngUint32(seed);
  return () => (next() + 0.5) / TWO_POW_32;
}

/**
 * Seeded standard normal stream (Box–Muller on `rng(seed)`). Calls 1, 3, 5, … draw two uniforms u1, u2 and
 * return R cos t with R = √(−2 log u1) and t = 2π u2; calls 2, 4, 6, … return the cached R sin t.
 */
export function normalStream(seed: number): () => number {
  const uniform = rng(seed);
  let cached = 0;
  let hasCached = false;
  return () => {
    if (hasCached) {
      hasCached = false;
      return cached;
    }
    const u1 = uniform();
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    const t = TWO_PI * u2;
    cached = r * Math.sin(t);
    hasCached = true;
    return r * Math.cos(t);
  };
}

/** The first `count` uniforms of `rng(seed)`. */
export function uniforms(seed: number, count: number): Float64Array {
  const next = rng(seed);
  const out = new Float64Array(checkCount(count));
  for (let i = 0; i < out.length; i += 1) out[i] = next();
  return out;
}

/** The first `count` normals of `normalStream(seed)`. */
export function normals(seed: number, count: number): Float64Array {
  const next = normalStream(seed);
  const out = new Float64Array(checkCount(count));
  for (let i = 0; i < out.length; i += 1) out[i] = next();
  return out;
}

function checkCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`count must be a nonnegative integer, got ${String(count)}`);
  return count;
}
