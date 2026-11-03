// Parity for engine/src/format.ts and erfc (engine/src/special.ts) against base R (r-export/11_format.R, group
// oracle-format): display strings from R's sprintf (exact binary value, ties to even) and the display rules of
// engine/README.md, rationalApprox against a brute-force denominator search, erfc against mpmath at 50 digits.
// Each row calls pc[args.fn](...args.call) with positional arguments. Tokens that JSON cannot hold are decoded here:
//   {"$num": "NaN" | "Infinity" | "-Infinity"} -> number, {"$bigint": "123"} -> BigInt, {"$undef": true} -> undefined,
//   {"$fn": "formatSetting"} -> the engine export of that name, {"$sum": [a, b]} -> a + b in double precision.
// Rows whose fn ends in "Throws" call the function without the suffix and expect it to throw.
const decode = (v, pc) => {
  if (Array.isArray(v)) return v.map((x) => decode(x, pc));
  if (v && typeof v === "object") {
    if ("$num" in v) return Number(v.$num);
    if ("$bigint" in v) return BigInt(v.$bigint);
    if ("$undef" in v) return undefined;
    if ("$fn" in v) { const f = pc[v.$fn]; if (typeof f !== "function") throw new Error(`no export ${v.$fn}`); return f; }
    if ("$sum" in v) return v.$sum.reduce((s, x) => s + x);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x, pc)]));
  }
  return v;
};

function run(args, pc) {
  const call = decode(args.call ?? [], pc);
  if (args.fn.endsWith("Throws")) {
    const f = pc[args.fn.slice(0, -"Throws".length)];
    try { f(...call); return { threw: false }; } catch { return { threw: true }; }
  }
  const f = pc[args.fn];
  if (typeof f !== "function") throw new Error(`no export ${args.fn}`);
  const out = f(...call);
  if (args.fn === "erfc") return { erfc: out };
  if (args.fn === "rationalApprox") return { value: out == null ? null : { num: out.num, den: out.den } };
  return { text: out };
}

export default {
  group: "oracle-format",
  functions: ["formatProb", "formatRisk", "formatDecimal", "formatSig", "formatSci", "formatPercent", "formatCount",
    "formatFraction", "rationalApprox", "formatRational", "formatRatio", "formatEoverN", "formatSigned", "formatSetting",
    "formatGrades", "formatSizes", "formatTuple", "erfc"],
  run,
  // Strings and rationalApprox's integers are compared exactly.
  default: { abs: 0, rel: 0 },
  tolerance: {
    // erfc: relative 1e-14 against 50-digit values (README: max 5.2e-16 observed); below the smallest normal double
    // (x > 26.543) the engine returns 0 and mpmath a subnormal, so an absolute floor of DBL_MIN applies.
    erfc: { abs: 2.2250738585072014e-308, rel: 1e-14 },
  },
};
