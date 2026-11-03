// Parity for engine/src/simulate.ts against postrank 1.1.0 (r-export/08_simulate.R, group postrank-simulate):
//   fragilePairs  postrank_mc_fragility() on postrank_toy (32 IID draws, w = (.6, .4)) and on seeded six-site draws
//                 (S = 1,000 on score A; S = 500 on both scores), draws[s][i][k] as in drawErrors: the flagged pairs,
//                 the screen z/(2 sqrt(S - 1)), every traced pair in the package's order with its better direction,
//                 weighted error, margin, MCSE and flag, and the summary (pairs, traced, fragile, share, MCSE
//                 unavailable).
//   mcse          the package's MCSE of every traced pair's weighted indicator trace (better direction), trace in args
//   envelopeRadius postrank_iid_bounds() raw_radius = sqrt((log 2 + log M - log alpha_k)/(2 S_k)), form "package"
// Result mapping as in oracle-simulate.mjs.
import { RUN } from "./oracle-simulate.mjs";

export default {
  group: "postrank-simulate",
  functions: ["fragilePairs", "mcse", "envelopeRadius"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Flags and counts are exact (seeded draws carry 9 decimals and survive the 15-digit JSON round trip exactly; the
  // script checks that the round-tripped toy draws give the same flags); MCSE is a sample SD of at most 1,000
  // values in [0, 1] and the radius one closed form: 1e-12 absolute.
  default: { abs: 1e-12, rel: 0 },
};
