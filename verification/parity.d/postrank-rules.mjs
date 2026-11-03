// Parity for engine/src/rules.ts against postrank 1.1.0 (r-export/07_rules.R, group postrank-rules):
// tierGrades against postrank_cuts(rule = "quantile", direction = "descending", G_b = G) including tied scores
// (straddled tiers merged, G_b capped at n), strictOrder against the same cuts with G_b = n on tie-free scores, and
// expectedRank against postrank_expected_rank() with weights (pr_tutorial, pr_example_gaussian, the pr_example_draws
// array of analysis_30x3, postrank_toy, pr_case_krw$input). Result mapping as in oracle-rules.mjs.
import { RUN } from "./oracle-rules.mjs";

export default {
  group: "postrank-rules",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Grades are exact. Expected ranks are sums of at most 96 coefficients per unit: closed-form pnorm values, exact
  // draw shares (multiples of 1/4,000 or 1/32) or, for KRW, numerically integrated probabilities stored with 15
  // significant digits (ranks up to 97). A plain left-to-right sum of the golden inputs reproduces every golden rank
  // to 7e-14 (KRW) or better, so 1e-12 absolute holds for every row, KRW included.
  default: { abs: 1e-12, rel: 0 },
};
