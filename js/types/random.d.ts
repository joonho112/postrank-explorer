/**
 * mulberry32 as a stream of unsigned 32-bit integers (0 … 2^32 − 1). `rng` and `normalStream` are built on
 * this stream; it is exported so parity checks can compare the integers themselves.
 */
export declare function rngUint32(seed: number): () => number;
/** Seeded uniform stream on the open interval (0, 1): u = (x + 1/2)/2^32 for each mulberry32 output x. */
export declare function rng(seed: number): () => number;
/**
 * Seeded standard normal stream (Box–Muller on `rng(seed)`). Calls 1, 3, 5, … draw two uniforms u1, u2 and
 * return R cos t with R = √(−2 log u1) and t = 2π u2; calls 2, 4, 6, … return the cached R sin t.
 */
export declare function normalStream(seed: number): () => number;
/** The first `count` uniforms of `rng(seed)`. */
export declare function uniforms(seed: number, count: number): Float64Array;
/** The first `count` normals of `normalStream(seed)`. */
export declare function normals(seed: number, count: number): Float64Array;
