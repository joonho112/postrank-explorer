import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINUS, NA, NO_DISCLOSURE, formatCount, formatDecimal, formatEoverN, formatFraction, formatGrades, formatPercent,
  formatProb, formatRatio, formatRational, formatRisk, formatSci, formatSetting, formatSig, formatSigned, formatSizes,
  formatTuple, rationalApprox,
} from "../src/format.ts";
import { rng } from "../src/random.ts";
import { readFixture } from "./helpers.ts";

const m = (s: string) => s.replaceAll("-", MINUS); // write expected negatives with an ASCII hyphen

interface FormatFixture {
  r_version: string;
  rows: [number, number, string][];
}

test("rounding equals R sprintf on exact binary ties, near ties, random and large values (digits 0–6)", (t) => {
  const R = readFixture<FormatFixture>("format-r.json");
  assert.match(R.r_version, /^R version 4\.6\.0/);
  let ties = 0;
  for (const [x, d, s] of R.rows) {
    // house rules on top of printf: U+2212 minus, and a value displayed as zero carries no sign
    const expected = s.replace(/^-(0(\.0*)?)$/, "$1").replace("-", MINUS);
    assert.equal(formatDecimal(x, { digits: d, leadingZero: true, group: false }), expected, `x = ${x}, digits = ${d}`);
    if (Number.isInteger(x * 2 ** (d + 1)) && (x * 2 ** (d + 1)) % 2 !== 0) ties += 1;
  }
  t.diagnostic(`${R.rows.length} rows, ${ties} exact ties`);
  assert.ok(ties > 100);
});

test("rounding is half-even on the exact binary value", () => {
  assert.equal(formatProb(0.1875), ".188"); // 187.5 → 188 (even)
  assert.equal(formatProb(0.0625), ".062"); // 62.5 → 62 (even)
  assert.equal(formatProb(0.4375), ".438"); // 437.5 → 438
  assert.equal(formatDecimal(2.5, { digits: 0 }), "2");
  assert.equal(formatDecimal(3.5, { digits: 0 }), "4");
  assert.equal(formatDecimal(0.125, { digits: 2 }), ".12");
  assert.equal(formatDecimal(0.375, { digits: 2 }), ".38");
  assert.equal(formatDecimal(2.675, { digits: 2 }), "2.67"); // 2.675 is stored below the tie
  assert.equal(formatDecimal(1.0005, { digits: 3 }), "1.000"); // stored as 1.000499…
  assert.equal(formatProb(0.0005), ".001"); // stored as 0.000500…01, above the tie
  assert.equal(formatRisk(0.00005), ".0001"); // stored above the tie
  assert.equal(formatRisk(0.041666666666666664), ".0417");
  assert.equal(formatRisk(0.04165), ".0416"); // stored below the tie
});

test("the exact rounding path (digits > 20, large values) agrees with Number#toFixed away from ties", () => {
  const u = rng(11);
  for (let i = 0; i < 2000; i += 1) {
    const x = u();
    for (const d of [21, 25, 30]) assert.equal(formatDecimal(x, { digits: d, leadingZero: true }), x.toFixed(d));
  }
  assert.equal(formatDecimal(1e21, { digits: 1 }), "1,000,000,000,000,000,000,000.0");
  assert.equal(formatDecimal(2 ** 70, { digits: 0 }), "1,180,591,620,717,411,303,424");
});

test("probabilities: 3 decimals, no leading zero, exact ends, bounds", () => {
  assert.equal(formatProb(0.188), ".188");
  assert.equal(formatProb(0.81234), ".812");
  assert.equal(formatProb(0.5), ".500");
  assert.equal(formatProb(0), "0");
  assert.equal(formatProb(-0), "0");
  assert.equal(formatProb(1), "1");
  assert.equal(formatProb(0.0004999), "below .001");
  assert.equal(formatProb(1e-300), "below .001");
  assert.equal(formatProb(0.9995), "above .999"); // 0.9995 is stored above the tie
  assert.equal(formatProb(0.99949), ".999");
  assert.equal(formatProb(0.99999, { bounds: "symbols" }), ">.999");
  assert.equal(formatProb(0.0001, { bounds: "symbols" }), "<.001");
  assert.equal(formatProb(0.0001, { bounds: false }), ".000");
  assert.equal(formatProb(0.99999, { bounds: false }), "1.000");
  assert.equal(formatProb(0.99993, { digits: 4 }), ".9999");
  assert.equal(formatProb(0.00009, { digits: 4 }), ".0001");
  assert.equal(formatProb(0.2, { digits: 2 }), ".20");
  assert.equal(formatProb(1.25), "1.250"); // not a probability: plain rounding
});

test("risks and small expected counts: 4 decimals; negative values use U+2212", () => {
  assert.equal(formatRisk(0.0417), ".0417");
  assert.equal(formatRisk(0.0248), ".0248");
  assert.equal(formatRisk(1.8288), "1.8288");
  assert.equal(formatRisk(-0.0227), m("-.0227"));
  assert.equal(formatRisk(0.2), ".2000");
  assert.equal(formatRisk(0), "0");
  assert.equal(formatRisk(0.00004), "below .0001");
  assert.equal(formatRisk(-0.00004), `above ${MINUS}.0001`);
  assert.equal(formatRisk(-0.00004, { bounds: false }), ".0000"); // no "−.0000"
  assert.equal(formatRisk(0.063774, { digits: 6 }), ".063774");
  assert.equal(formatRisk(1), "1.0000"); // the exact-1 rule is for probabilities only
});

test("missing and non-finite values are NA in every formatter", () => {
  for (const v of [null, undefined, Number.NaN, Infinity, -Infinity]) {
    for (const f of [formatProb, formatRisk, formatDecimal, formatSig, formatSci, formatPercent, formatSigned, formatSetting, formatRational]) {
      assert.equal(f(v), NA);
    }
    assert.equal(formatCount(v as number), NA);
  }
  assert.equal(NA, "NA");
});

test("counts: thousands separators, BigInt-safe, integers only", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1000), "1,000");
  assert.equal(formatCount(4683), "4,683");
  assert.equal(formatCount(17014861), "17,014,861");
  assert.equal(formatCount(28091567595), "28,091,567,595");
  assert.equal(formatCount(28091567595n), "28,091,567,595");
  assert.equal(formatCount(123456789012345678901234567890n), "123,456,789,012,345,678,901,234,567,890");
  assert.equal(formatCount(-1324), m("-1,324"));
  assert.equal(formatCount(-5n), m("-5"));
  assert.equal(formatCount(Number.MAX_SAFE_INTEGER), "9,007,199,254,740,991");
  assert.throws(() => formatCount(2.5), RangeError);
  assert.throws(() => formatCount(2 ** 53), RangeError);
});

test("exact fractions", () => {
  assert.equal(formatFraction(11, 60), "11/60");
  assert.equal(formatFraction(22, 120), "11/60");
  assert.equal(formatFraction(-1, 2), m("-1/2"));
  assert.equal(formatFraction(1, -2), m("-1/2"));
  assert.equal(formatFraction(6, 3), "2");
  assert.equal(formatFraction(0, 7), "0");
  assert.equal(formatFraction(1, 0), NA);
  assert.equal(formatFraction(3n, 9n), "1/3");
  assert.throws(() => formatFraction(0.5, 2), RangeError);
  // values computed in floating point are recognised as their fractions
  const cases: [number, string][] = [
    [11 / 60, "11/60"], [1 / 6, "1/6"], [7 / 20, "7/20"], [7 / 40, "7/40"], [1 / 4, "1/4"], [3 / 10, "3/10"],
    [2 / 5, "2/5"], [13 / 20, "13/20"], [21 / 20, "21/20"], [1 / 3, "1/3"], [19 / 60, "19/60"], [7 / 15, "7/15"],
    [0.1 + 0.2, "3/10"], [-1 / 2, m("-1/2")], [0, "0"], [3, "3"], [5 / 9, "5/9"],
  ];
  for (const [x, s] of cases) assert.equal(formatRational(x), s, String(x));
  assert.deepEqual(rationalApprox(0.75), { num: 3, den: 4 });
  assert.equal(rationalApprox(Math.PI), null);
  assert.equal(rationalApprox(1 / 1009), null); // denominator above the default limit
  assert.deepEqual(rationalApprox(1 / 1009, { maxDenominator: 2000 }), { num: 1, den: 1009 });
  assert.throws(() => formatRational(Math.SQRT2), RangeError);
});

test("percentages with stated decimals, rounded on the exact share", () => {
  assert.equal(formatPercent(0.14), "14%");
  assert.equal(formatPercent(0.052, { digits: 1 }), "5.2%");
  assert.equal(formatPercent(0.172, { digits: 1 }), "17.2%");
  assert.equal(formatPercent(0.0002, { digits: 2 }), "0.02%");
  assert.equal(formatPercent(0.96), "96%");
  assert.equal(formatPercent(0.145), "14%"); // 0.145 is stored below the tie
  assert.equal(formatPercent(0.125), "12%"); // exact tie 12.5 → 12 (even)
  assert.equal(formatPercent(0.135), "14%");
  assert.equal(formatPercent(0), "0%");
  assert.equal(formatPercent(1), "100%");
  assert.equal(formatPercent(0.00001), "below 1%");
  assert.equal(formatPercent(0.00001, { digits: 1 }), "below 0.1%");
  assert.equal(formatPercent(0.99999), "above 99%");
  assert.equal(formatPercent(0.00001, { bounds: false }), "0%");
  assert.equal(formatPercent(1.5), "150%");
  assert.equal(formatPercent(-0.05), m("-5%"));
});

test("E/N: NA: no disclosure when N = 0; ratios: NA for a zero denominator", () => {
  assert.equal(formatEoverN(0, 0), NO_DISCLOSURE);
  assert.equal(NO_DISCLOSURE, "NA: no disclosure");
  assert.equal(formatEoverN(0.3576, 14, { digits: 4 }), ".0255");
  assert.equal(formatEoverN(0.0248, 12, { sig: 3 }), ".00207");
  assert.equal(formatEoverN(7 / 20, 2), ".175");
  assert.equal(formatEoverN(null, 5), NA);
  assert.equal(formatRatio(3, 0), NA);
  assert.equal(formatRatio(12, 15), ".800");
  assert.equal(formatRatio(15, 15), "1");
});

test("signed values", () => {
  assert.equal(formatSigned(0.049), "+.049");
  assert.equal(formatSigned(-0.0227, { digits: 4 }), m("-.0227"));
  assert.equal(formatSigned(0), "0");
  assert.equal(formatSigned(0.0001), ".000"); // displayed as zero: no sign
  assert.equal(formatSigned(-0.0001), ".000");
  assert.equal(formatSigned(1.5, { digits: 1 }), "+1.5");
  assert.equal(formatSigned(-0.0000123, { sig: 2 }), m("-.000012"));
});

test("settings: τ and λ as short decimals, weights as fractions", () => {
  assert.equal(formatSetting(0.2), ".20");
  assert.equal(formatSetting(0.25), ".25");
  assert.equal(formatSetting(0.5), ".50");
  assert.equal(formatSetting(0.05), ".05");
  assert.equal(formatSetting(0.125), ".125");
  assert.equal(formatSetting(0.0012), ".0012");
  assert.equal(formatSetting(0.25 / 1.25), ".20"); // τ = λ/(1 + λ) at λ = .25
  assert.equal(formatSetting(0.1 + 0.2), ".30");
  assert.equal(formatSetting(1 / 3), "1/3");
  assert.equal(formatSetting(1.96), "1.96");
  assert.equal(formatSetting(0.9), ".90");
  assert.equal(formatSetting(3), "3");
  assert.equal(formatSetting(20240101), "20240101"); // seeds and caps: no separators
  assert.equal(formatSetting(Math.PI), "3.1416");
  assert.equal(formatSetting([0.5, 0.5]), "(1/2, 1/2)");
  assert.equal(formatSetting([0.5, 0.25, 0.25]), "(1/2, 1/4, 1/4)");
  assert.equal(formatSetting([1 / 3, 2 / 3]), "(1/3, 2/3)");
  assert.equal(formatSetting([1, 0]), "(1, 0)");
  assert.equal(formatSetting([0.8, 0.2]), "(.8, .2)");
  assert.equal(formatSetting([0.7, 0.3]), "(.7, .3)");
  assert.equal(formatSetting(new Float64Array([0.5, 0.5])), "(1/2, 1/2)");
  assert.equal(formatSetting([0.5, Number.NaN]), NA);
});

test("significant digits and scientific notation", () => {
  assert.equal(formatSig(0.0016533), ".00165");
  assert.equal(formatSig(0.000203), ".000203");
  assert.equal(formatSig(0.0091123), ".00911");
  assert.equal(formatSig(1324), "1,320");
  assert.equal(formatSig(28091567595), "28,100,000,000");
  assert.equal(formatSig(9.9996, { sig: 4 }), "10.00");
  assert.equal(formatSig(0.00099996, { sig: 3 }), ".00100");
  assert.equal(formatSig(-0.0227, { sig: 2 }), m("-.023"));
  assert.equal(formatSig(0), "0");
  assert.equal(formatSci(1.39e-17), m("1.39e-17"));
  assert.equal(formatSci(1.1e-16, { sig: 2 }), m("1.1e-16"));
  assert.equal(formatSci(1e-12, { trim: true }), m("1e-12"));
  assert.equal(formatSci(1e-12), m("1.00e-12"));
  assert.equal(formatSci(5e5, { trim: true, style: "times" }), "5 × 10⁵");
  assert.equal(formatSci(1.39e-17, { style: "times" }), "1.39 × 10⁻¹⁷");
  assert.equal(formatSci(-2.5e3, { sig: 2 }), m("-2.5e3"));
  assert.equal(formatSci(9.999e-5, { sig: 3 }), m("1.00e-4"));
  assert.equal(formatSci(5e-324, { sig: 1 }), m("5e-324"));
});

test("fixed decimals for other quantities, grouping in the integer part only", () => {
  assert.equal(formatDecimal(13.649), "13.65");
  assert.equal(formatDecimal(88.06, { digits: 1 }), "88.1");
  assert.equal(formatDecimal(180.1, { digits: 1 }), "180.1");
  assert.equal(formatDecimal(1249.5, { digits: 1 }), "1,249.5");
  assert.equal(formatDecimal(1249.5, { digits: 1, group: false }), "1249.5");
  assert.equal(formatDecimal(0.0175, { digits: 4 }), ".0175");
  assert.equal(formatDecimal(0.329, { digits: 3, leadingZero: true }), "0.329");
  assert.equal(formatDecimal(-0.00001, { digits: 2 }), ".00");
  assert.equal(formatDecimal(0.996, { digits: 2 }), "1.00");
  assert.equal(formatDecimal(-3.14159, { digits: 2 }), m("-3.14"));
  assert.equal(formatDecimal(0.1234567, { digits: 6 }), ".123457");
  assert.throws(() => formatDecimal(1, { digits: -1 }), RangeError);
  assert.throws(() => formatDecimal(1, { digits: 1.5 }), RangeError);
});

test("grade vectors, sizes and tuples", () => {
  assert.equal(formatGrades([1, 1, 2, 2, 3, 3]), "1/1/2/2/3/3");
  assert.equal(formatGrades(new Int8Array([1, 2, 2])), "1/2/2");
  assert.throws(() => formatGrades([0, 1]), RangeError);
  assert.throws(() => formatGrades([1, 1.5]), RangeError);
  assert.equal(formatSizes([3, 6, 3]), "sizes 3, 6, 3");
  assert.equal(formatSizes([2, 81, 14], { label: false }), "2, 81, 14");
  assert.equal(formatSizes([1, 1324]), "sizes 1, 1,324");
  assert.equal(formatTuple([0.15, 0.85, 0.2], (v) => formatProb(v, { digits: 2 })), "(.15, .85, .20)");
  assert.equal(formatTuple([0.0177, 0.0267]), "(.018, .027)");
  // a formatter passed point-free gets one argument (no index in the options position)
  assert.equal(formatTuple([0.0417, 0.05], formatRisk), "(.0417, .0500)");
  assert.equal(formatTuple([0.052, 0.5], formatPercent), "(5%, 50%)");
  assert.throws(() => [0.1].map(formatProb as never), /options object expected/);
});

test("no formatter writes an ASCII hyphen-minus for a negative number", () => {
  const u = rng(3);
  for (let i = 0; i < 500; i += 1) {
    const x = -(10 ** (6 * u() - 4));
    for (const s of [formatDecimal(x), formatRisk(x), formatSig(x), formatSci(x), formatSigned(x), formatPercent(x), formatSetting(x)]) {
      assert.ok(!s.includes("-"), s);
    }
  }
});

test("formatters are pure: the same input gives the same output and inputs are not modified", () => {
  const w = [0.5, 0.25, 0.25];
  const g = [1, 2, 2];
  assert.equal(formatSetting(w), formatSetting(w));
  assert.equal(formatGrades(g), formatGrades(g));
  assert.deepEqual(w, [0.5, 0.25, 0.25]);
  assert.deepEqual(g, [1, 2, 2]);
});
