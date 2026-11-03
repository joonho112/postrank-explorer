// Parity for engine/src/random.ts, gaussianDraws and rankSummariesMC (engine/src/simulate.ts) against base R
// (r-export/10_stream.R, group oracle-stream; the stream reimplemented in r-export/_rng.R from engine/README.md).
// Calls follow engine/API.md: rngUint32(seed), rng(seed) and normalStream(seed) return generators (the first `count`
// calls are compared); uniforms(seed, count) and normals(seed, count) return Float64Arrays; gaussianDraws(means, sds,
// S, seed) returns draws[s][i][k]; rankSummariesMC(means, sds, S, seed) returns { n, means, expectedRank, rankProbs,
// pTop, tieFree, S, seed, label }; finiteLawDraws(probs, S, seed) returns an Int32Array of 0-based state indices
// (rows with `probs33` give the probabilities as exact numerators over 2^33; dividing by 2^33 is exact).
// Uniforms are compared as u * 2^33 (an exact odd integer; the golden JSON keeps 15 significant digits, which cannot
// hold a 33-bit dyadic fraction), so integers and uniforms must match bit for bit.
const arr = (x) => Array.from(x);
const take = (gen, count) => Array.from({ length: count }, () => gen());
const TWO33 = 2 ** 33;
const threw = (f) => { try { f(); return { threw: false }; } catch (err) { return { threw: err instanceof RangeError }; } };

const RUN = {
  rngUint32: (a, pc) => ({ ints: take(pc.rngUint32(a.seed), a.count) }),
  rng: (a, pc) => ({ u33: take(pc.rng(a.seed), a.count).map((u) => u * TWO33) }),
  uniforms: (a, pc) => ({ u33: arr(pc.uniforms(a.seed, a.count)).map((u) => u * TWO33) }),
  rngThrows: (a, pc) => threw(() => pc.rng(a.seed)),
  normals: (a, pc) => ({ values: arr(pc.normals(a.seed, a.count)) }),
  normalStream: (a, pc) => ({ values: take(pc.normalStream(a.seed), a.count) }),
  gaussianDraws: (a, pc) => ({ draws: Array.from(pc.gaussianDraws(a.means, a.sds, a.S, a.seed), (d) => Array.from(d, arr)) }),
  finiteLawDraws: (a, pc) => ({ draws: arr(pc.finiteLawDraws(a.probs ?? a.probs33.map((x) => x / TWO33), a.S, a.seed)) }),
  finiteLawDrawsThrows: (a, pc) => { try { pc.finiteLawDraws(a.probs, a.S, a.seed); return { threw: false }; } catch { return { threw: true }; } },
  rankSummariesMC: (a, pc) => {
    const r = pc.rankSummariesMC(a.means, a.sds, a.S, a.seed);
    return {
      n: r.n, means: arr(r.means), expectedRank: arr(r.expectedRank), rankProbs: Array.from(r.rankProbs, arr),
      pTop: Array.from(r.pTop, arr), tieFree: r.tieFree, S: r.S, seed: r.seed, label: r.label,
    };
  },
};

export default {
  group: "oracle-stream",
  functions: ["rng", "rngUint32", "uniforms", "normals", "normalStream", "gaussianDraws", "rankSummariesMC", "finiteLawDraws"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Integers, uniforms (as exact integers), finite-law draws (state indices) and Monte Carlo shares (exact counts over S, one correctly rounded
  // division in both languages): exact.
  default: { abs: 0, rel: 0 },
  tolerance: {
    // Normals and draws: a few ulps from a different libm (log, cos, sin) plus the 15-digit golden rounding.
    values: { abs: 0, rel: 1e-14 },
    draws: { abs: 1e-15, rel: 1e-14 },
    // Draw means: a sum of S normals (summation order may differ), magnitude below 10.
    means: { abs: 1e-12, rel: 0 },
  },
};
