import assert from "node:assert/strict";
import { test } from "node:test";
import { shortNumericQuote, tryMatcher } from "../try_match.mjs";

test("Try rejects planted numeric fragments accepted by the former substring check", () => {
  const planted = [
    ["Reverse cost 1.0000.", ".0000"], ["An error of −.04.", ".04"],
    ["The change is +.40.", ".40"], ["Risk 12/30.", "12"],
    ["Grades 1/2/2/3.", "1/2"], ["There are 3,300 pairs.", "300"],
    ["Coverage is 95%.", "95"], ["Site U08.", "08"],
    ["Tolerance 1e−12.", "12"], ["There are 30 pairs.", "3"],
    ["Report 1/2/3.", "Report 1/2"], ["Exactly 12 pairs.", "Exactly 1"],
  ];
  for (const [text, quote] of planted) {
    assert.ok(text.includes(quote));
    assert.equal(tryMatcher(text)(quote), false, `${JSON.stringify(quote)} in ${text}`);
  }
});

test("Try retains exact displayed numbers, prose punctuation and nonnumeric evidence", () => {
  const valid = [
    ["Cost .3000.", ".3000"], ["Costs 0, .2000 and 1.0000.", "0"],
    ["Grade sizes 3, 4.", "3"], ["Risk 1/3.", "1/3"],
    ["Grades 1/2/2/3.", "1/2/2/3"], ["1,324 of 4,656 pairs.", "1,324"],
    ["Coverage is 95%.", "95%"], ["Tolerance 1e−12.", "1e−12"],
    ["The risk changes by −.00061.", "−.00061"],
    ["2 (A and B; E and F)", "2 (A and B; E and F)"],
    ["Earlier 103, later 3.", "3"], ["There is NA: no disclosure.", "NA: no disclosure"],
  ];
  for (const [text, quote] of valid) {
    assert.equal(tryMatcher(text)(quote), true, `${JSON.stringify(quote)} in ${text}`);
  }
  for (const quote of ["0", "12", ".3"]) assert.equal(shortNumericQuote(quote), true);
  for (const quote of ["no", "1/2", "95%"]) assert.equal(shortNumericQuote(quote), false);
});
