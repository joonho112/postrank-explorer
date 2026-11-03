// Parity for engine/src/special.ts against base R pnorm/dnorm/qnorm (r-export/01_special.R), including upper-tail
// quantiles normalQuantile(p, { lowerTail: false }) against qnorm(p, lower.tail = FALSE).
export default {
  group: "oracle-special",
  functions: ["normalCdf", "normalSf", "normalPdf", "normalQuantile"],
  run(args, pc) {
    if ("p" in args) return { quantile: args.lowerTail === false ? pc.normalQuantile(args.p, { lowerTail: false }) : pc.normalQuantile(args.p) };
    return { cdf: pc.normalCdf(args.z), sf: pc.normalSf(args.z), pdf: pc.normalPdf(args.z) };
  },
  // Relative tolerance 1e-13 on every value (tails included); abs floor 0 so tiny tails are compared relatively.
  default: { abs: 0, rel: 1e-13 },
  tolerance: { quantile: { abs: 1e-13, rel: 1e-13 } },
};
