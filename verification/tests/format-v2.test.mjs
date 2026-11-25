import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWindow } from "../dom-env.mjs";
import {
  MINUS,
  NA,
  formatReadoutProb,
  formatReadoutRisk,
  formatReadoutExpected,
  formatReadoutEst,
  formatDistinguishing,
  formatExpectedCount,
  formatShare,
  formatExactText,
  numSpan,
  setNum,
  sciGloss,
} from "../../js/shared/format.js";
import { tieNode, plural, withheldPhrase, withheldNodes } from "../../js/shared/labels.js";
import { exactDisplayProblem, numberFindings, displayFindings, badTokenFindings } from "../dom_rules.mjs";
import { loadSources, checkCaseFile, validateSchema, formatWith } from "../check_readouts.mjs";
import { createWidget } from "../../js/shared/base.js";

test("formatReadoutProb enforces 3-sig-fig house style and strict (.001, .999) boundaries (S1-03)", () => {
  assert.equal(formatReadoutProb(null), NA);
  assert.equal(formatReadoutProb(undefined), NA);
  assert.equal(formatReadoutProb(NaN), NA);
  assert.equal(formatReadoutProb(Infinity), NA);
  assert.equal(formatReadoutProb(0), "0");
  assert.equal(formatReadoutProb(-0), "0");
  assert.equal(formatReadoutProb(1), "1");

  // Strict lower floor (0, 0.001)
  assert.equal(formatReadoutProb(1e-12), "below .001");
  assert.equal(formatReadoutProb(0.0009999), "below .001");
  assert.equal(formatReadoutProb(0.001), ".00100");
  assert.equal(formatReadoutProb(0.04123), ".0412");
  assert.equal(formatReadoutProb(0.76025), ".760");

  // Strict upper ceiling (0.999, 1), including >= 0.9995 that would round to 1.00
  assert.equal(formatReadoutProb(0.999), ".999");
  assert.equal(formatReadoutProb(0.9990001), "above .999");
  assert.equal(formatReadoutProb(0.9994), "above .999");
  assert.equal(formatReadoutProb(0.9995), "above .999");
  assert.equal(formatReadoutProb(0.99999), "above .999");
});

test("formatReadoutRisk handles 3-sig-fig, < 1e-4 scientific notation, and signed increments", () => {
  assert.equal(formatReadoutRisk(null), NA);
  assert.equal(formatReadoutRisk(undefined), NA);
  assert.equal(formatReadoutRisk(NaN), NA);
  assert.equal(formatReadoutRisk(0), "0");
  assert.equal(formatReadoutRisk(0, { signed: true }), "0");

  assert.equal(formatReadoutRisk(0.08234), ".0823");
  assert.equal(formatReadoutRisk(0.001192), ".00119");
  assert.equal(formatReadoutRisk(0.008513, { signed: true }), "+.00851");
  assert.equal(formatReadoutRisk(-0.008513, { signed: true }), `${MINUS}.00851`);
  assert.equal(formatReadoutRisk(1e-4), ".000100");
  assert.equal(formatReadoutRisk(1e-4, { signed: true }), "+.000100");

  // |x| < 1e-4 uses 3-sig-fig scientific notation
  assert.equal(formatReadoutRisk(1.374e-5), `1.37e${MINUS}5`);
  assert.equal(formatReadoutRisk(1.374e-5, { signed: true }), `+1.37e${MINUS}5`);
  assert.equal(formatReadoutRisk(-1.374e-5, { signed: true }), `${MINUS}1.37e${MINUS}5`);
  assert.equal(sciGloss(`+1.37e${MINUS}5`), `+1.37e${MINUS}5 is +1.37 × 10⁻⁵`);
});

test("formatReadoutExpected and formatReadoutEst format 3-sig-fig house values while preserving legacy formatters", () => {
  assert.equal(formatReadoutExpected(null), NA);
  assert.equal(formatReadoutExpected(0), "0");
  assert.equal(formatReadoutExpected(1.988), "1.99");
  assert.equal(formatReadoutExpected(14.28), "14.3");
  assert.equal(formatReadoutExpected(0.1449), ".145");
  assert.equal(formatReadoutExpected(180.1), "180");
  assert.equal(formatReadoutExpected(3e-7), `3.00e${MINUS}7`);
  // Legacy Data-table formatter stays at sig: 4
  assert.equal(formatExpectedCount(1.988), "1.988");
  assert.equal(formatShare(0.1364), ".136");

  assert.equal(formatReadoutEst(null), NA);
  assert.equal(formatReadoutEst(0), "0");
  assert.equal(formatReadoutEst(-0.2714), `${MINUS}.271`);
  assert.equal(formatReadoutEst(1.364), "1.36");
  assert.equal(formatReadoutEst(42.81), "42.8");
  assert.equal(formatReadoutEst(-4.5e-6), `${MINUS}4.50e${MINUS}6`);
  assert.equal(formatReadoutEst(0.1234, { signed: true }), "+.123");
});

test("formatDistinguishing expands precision minimally to separate near-ties (S2-01, 5.3 lam08)", () => {
  const a = 0.07406036268117103;
  const b = 0.07407407407407407;
  // At sig: 3 both would collide at ".0741"; sig: 4 separates them cleanly into ".07406" vs ".07407"
  assert.equal(formatDistinguishing(a, b), ".07406");
  assert.equal(formatDistinguishing(b, a), ".07407");
  // Options-object overload used by check_readouts formatWith
  assert.equal(formatDistinguishing(a, { ref: b, minSig: 3 }), ".07406");
  assert.equal(formatDistinguishing(a, { ref: b, minSig: 3, signed: true }), "+.07406");

  // Already distinct at minSig = 3 stays at 3 sig figs
  assert.equal(formatDistinguishing(0.08234, 0.09123), ".0823");
  // Equal values stay at minSig = 3
  assert.equal(formatDistinguishing(a, a), ".0741");
  assert.equal(formatDistinguishing(0, b), "0");
  assert.equal(formatDistinguishing(NaN, b), NA);
});

test("setNum and numSpan never leave nested [data-num] descendants", () => {
  const m = makeWindow({ plot: false });
  try {
    const inner = numSpan(0.25, ".250", { document: m.doc });
    const outer = m.doc.createElement("td");
    outer.append("Risk ", inner);
    setNum(outer, 0.25, ".250");
    assert.equal(outer.getAttribute("data-num"), "0.25");
    assert.equal(outer.textContent, ".250");
    assert.equal(outer.querySelectorAll("[data-num]").length, 0);

    // Passing a numSpan accidentally as display unwraps text instead of nesting or writing [object]
    const wrapped = numSpan(0.25, inner, { document: m.doc });
    assert.equal(wrapped.getAttribute("data-num"), "0.25");
    assert.equal(wrapped.textContent, ".250");
    assert.equal(wrapped.querySelectorAll("[data-num]").length, 0);
    assert.deepEqual(badTokenFindings(wrapped), []);
  } finally {
    m.restore();
  }
});

test("mdomain formatExactText and dom_rules agree on 'below 1%' for positive rationals rounding to 0% (S1-04)", () => {
  for (const raw of ["1/400", "1/200", "1/1000"]) {
    assert.equal(formatExactText(raw, { style: "percent", digits: 0 }), "below 1%");
    assert.equal(exactDisplayProblem("below 1%", raw, { style: "percent", digits: 0 }), null);
    assert.ok(exactDisplayProblem("0%", raw, { style: "percent", digits: 0 }));
  }
  assert.equal(formatExactText("0", { style: "percent", digits: 0 }), "0%");
  assert.equal(exactDisplayProblem("0%", "0", { style: "percent", digits: 0 }), null);
  assert.equal(formatExactText("3/200", { style: "percent", digits: 0 }), "2%");
  // Decimal behavior remains unchanged
  assert.equal(formatExactText("1/200", { style: "decimal", digits: 2 }), ".00");
  assert.equal(exactDisplayProblem(".00", "1/200", { style: "decimal", digits: 2 }), null);
});

test("dom_rules numberScope scans [data-prx-part~='scope'] and labels helpers stay intact (S2-04, S2-06)", () => {
  const m = makeWindow({ plot: false });
  try {
    const scope = m.doc.createElement("p");
    scope.setAttribute("data-prx-part", "scope");
    scope.textContent = "Scope covers 42 candidates";
    m.el.append(scope);
    const findings = numberFindings(m.el);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].token, "42");

    // tieNode & withholding helpers
    const tie = tieNode(m.doc, { tieCount: 3 });
    assert.ok(tie);
    assert.equal(tie.textContent, " (one of 3 equal-risk best reports; showing the first)");
    assert.equal(plural(1, "pair"), "pair");
    assert.equal(plural(3, "pair"), "pairs");
    assert.equal(withheldPhrase(0, 45), "withholds every pair");
    assert.equal(withheldPhrase(45, 45), "states every pair");
    assert.equal(withheldPhrase(15, 45), "withholds 30 of 45 pairs");

    const p = m.doc.createElement("p");
    p.setAttribute("data-prx-part", "readout");
    p.append(...withheldNodes(m.doc, 15, 45));
    m.el.replaceChildren(p);
    assert.deepEqual(numberFindings(m.el), []);
    assert.deepEqual(displayFindings(m.el), []);
  } finally {
    m.restore();
  }
});

test("check_readouts and _schema.json accept formatReadout* and formatDistinguishing (S1-03)", async () => {
  const src = await loadSources();
  const riskA = 0.04165163994548712; // six.A.cap3.tau20.risk in v1 registry
  const doc = {
    app: "readout-v2-fmt",
    catalog: null,
    module: "(memory)",
    cases: [
      {
        id: "v2-formats",
        query: "",
        expect: [
          {
            select: "[data-prx-readout='pi']",
            source: "oracle",
            ref: { group: "oracle-pairwise", row: "pairDirection-A-above", field: "pi" },
            value: 0.811620441094209,
            format: { fn: "formatReadoutProb" },
          },
          {
            select: "[data-prx-readout='risk']",
            source: "registry",
            ref: "six.A.cap3.tau20.risk",
            value: riskA,
            format: { fn: "formatReadoutRisk" },
          },
          {
            select: "[data-prx-readout='delta']",
            source: "registry",
            ref: "six.A.cap3.tau20.risk",
            value: riskA,
            format: { fn: "formatReadoutRisk", options: { signed: true } },
          },
          {
            select: "[data-prx-readout='near']",
            source: "registry",
            ref: "six.A.cap3.tau20.risk",
            value: riskA,
            format: { fn: "formatDistinguishing", options: { ref: 0.04169 } },
          },
        ],
      },
    ],
  };
  assert.deepEqual(validateSchema(doc, src.schema, { schema: src.schema, path: "$" }), []);
  assert.equal(formatWith(src.engine, src.named, { fn: "formatReadoutExpected" }, 1.988), "1.99");
  assert.equal(formatWith(src.engine, src.named, { fn: "formatReadoutEst" }, -0.2714), `${MINUS}.271`);

  const mod = {
    mountWidget(el, spec) {
      return createWidget(el, spec, {
        name: "readout-v2-fmt",
        keys: {},
        build(ctx) {
          return {
            render() {
              const pi = ctx.num(0.811620441094209, formatReadoutProb(0.811620441094209));
              pi.setAttribute("data-prx-readout", "pi");
              const r = ctx.num(riskA, formatReadoutRisk(riskA));
              r.setAttribute("data-prx-readout", "risk");
              const d = ctx.num(riskA, formatReadoutRisk(riskA, { signed: true }));
              d.setAttribute("data-prx-readout", "delta");
              const near = ctx.num(riskA, formatDistinguishing(riskA, 0.04169));
              near.setAttribute("data-prx-readout", "near");
              ctx.readout.set([pi, " ", r, " ", d, " ", near]);
            },
          };
        },
      });
    },
  };
  const res = await checkCaseFile(doc, { src, module: mod });
  assert.deepEqual(res.findings, []);
});
