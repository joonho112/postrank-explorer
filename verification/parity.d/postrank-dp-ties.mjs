// Parity for the fixed-order DP's tie rules and scoreOrder against postrank 1.1.0 (r-export/13_dp_ties.R, group
// postrank-dp-ties):
//   fixedOrderDP   .pr_cuts_core (R/baselines.R, the package's contiguous-partition DP) on exact ties: the theory book
//                  ch. 10 law along A, B, C at tau = 1/5 (1/2/2), a fewer-grades tie (1/2/2/2; exactly 3 grades
//                  1/2/3/3), the all-withheld tie (1/1/1), and the one-ulp case of finding E-11 with tieTol = 0 (the
//                  package compares floats exactly); postrank_cuts(rule = "optimal") given scores (+ direction, ids)
//   exactOptimum   the order family follows the same rule (decision E-1)
//   scoreOrder     the package's order(direction score, entity id, method = "radix") and exact-equality score blocks
// Input decoding and option filtering as in oracle-ties.mjs.
import { RUN as TIES } from "./oracle-ties.mjs";

const RUN = {
  fixedOrderDP: TIES.fixedOrderDP,
  exactOptimum: TIES.exactOptimum,
  scoreOrder: (a, pc) => {
    const scores = a.scores.map((x) => (x && typeof x === "object" && "$sum" in x ? x.$sum.reduce((s, v) => s + v) : x));
    const r = pc.scoreOrder(scores, { direction: a.direction, ids: a.ids });
    return { order: Array.from(r.order), blocks: Array.from(r.blocks) };
  },
};

export default {
  group: "postrank-dp-ties",
  functions: ["fixedOrderDP", "exactOptimum", "scoreOrder"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Exact rationals, dyadic inputs and pnorm coefficients (six sites): 1e-12 absolute; grades, orders and blocks exactly.
  default: { abs: 1e-12, rel: 0 },
};
