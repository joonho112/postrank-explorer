// 2.4 price-of-silence after the review 044 repair (G1-F1, X-01, X-14): the proposed first view in the result-first
// frame (jsdom from tools/node_modules).
//   node --test verification/tests/price-of-silence-layout.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(`${ROOT}tools/package.json`);
const { JSDOM, VirtualConsole } = require("jsdom");
const D3 = readFileSync(`${ROOT}js/vendor/d3.min.js`, "utf8");
const PLOT = readFileSync(`${ROOT}js/vendor/plot.min.js`, "utf8");
const TEMML = readFileSync(`${ROOT}js/vendor/temml/temml.min.js`, "utf8");

/** A window with Plot and Temml loaded and the app's query; jsdom's own "not implemented" notices are dropped. */
function mountAt(query) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "https://app.test/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const win = dom.window;
  win.__PRX_QUERY = query;
  win.eval(D3);
  win.eval(PLOT);
  win.eval(TEMML);
  return { win, el: win.document.getElementById("app") };
}

/** The read-out as a sighted reader sees it (the screen-reader words form of the blocks left out). */
function readout(root) {
  const node = root.querySelector(".prx-readout").cloneNode(true);
  for (const n of node.querySelectorAll(".prx-sr-only")) n.remove();
  return node.textContent;
}

test("2.4: controls hold the τ slider with its strip and the family switch; the read-out is the review's sentence", async () => {
  const { el } = mountAt("?preset=tau20-cap3");
  const { mountWidget } = await import(`${ROOT}js/apps/price-of-silence.js`);
  const app = mountWidget(el);
  const root = el.querySelector(".prx-widget");
  assert.equal(root.getAttribute("data-prx-layout"), "result-first");
  const controls = root.querySelector(".prx-controls");
  // the strip is drawn inside the τ slider's control, under its track
  const tau = controls.querySelector(".prx-pos-tau");
  assert.ok(tau.querySelector("input[type=range]") && tau.querySelector(".prx-pos-strip-chart svg"), "strip in the slider's control");
  assert.ok(tau.querySelector("[data-prx-strip-marker]"), "the strip's τ marker");
  assert.equal(root.querySelectorAll(".prx-pos-strip-chart").length, 1, "one strip");
  // the family switch beside it, before the preset row; its buttons are the family badges
  const family = controls.querySelector("fieldset.prx-pos-family");
  assert.equal(family.querySelector("legend").textContent, "Family of reports");
  assert.deepEqual([...family.querySelectorAll(".prx-seg")].map((b) => b.textContent), ["At most 3 grades · 603 reports", "No cap (all reports) · 4,683 reports"]);
  assert.ok(family.compareDocumentPosition(controls.querySelector(".prx-presets")) & 4, "family before the presets");
  assert.ok(root.querySelector(".prx-readout").previousElementSibling === controls, "read-out right under the controls");
  assert.equal(readout(root), "τ = .20, at most 3 grades (603 reports): best report {A, B} > {C, D} > {E, F}, 12 of 15 stated, risk .0417; A–B and E–F are withheld although each error is below τ.");
  // a click on the family switch changes the family
  family.querySelector('.prx-seg[data-value="none"]').click();
  assert.equal(app.state.cap, "none");
  assert.equal(readout(root), "τ = .20, no cap (all 4,683 reports on 6 units): best report {A} > {B} > {C, D} > {E} > {F}, 14 of 15 stated, risk .0372.");
  app.update({ tau: 0.15, cap: 3 });
  assert.equal(readout(root), "τ = .15, at most 3 grades (603 reports): best report {A, B} > {C, D} > {E, F}, 12 of 15 stated, risk .0317; E–F is withheld although its error is below τ.");
  app.destroy();
});

test("2.4: the scoring input leads to the bars and result; the matrix and Details keep every hook", async () => {
  const { el } = mountAt("");
  const { mountWidget } = await import(`${ROOT}js/apps/price-of-silence.js`);
  const app = mountWidget(el);
  const root = el.querySelector(".prx-widget");
  assert.match(root.querySelector(".prx-pos-matrix .prx-pos-matrix-caption").textContent, /^Below τ but withheld by the best report: 2 \(A and B; E and F\)\.$/);
  assert.ok(root.querySelector(".prx-pos-matrix-chart").hasAttribute("data-prx-primary"), "the matrix is the primary graphic");
  // Review 044 G1-F1: the form precedes its result so scoring with Enter does not scroll away from focus.
  const bars = root.querySelector(".prx-pos-bars-chart");
  const entry = root.querySelector(".prx-pos-entry");
  assert.ok(entry.compareDocumentPosition(bars) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(bars.nextElementSibling.classList.contains("prx-pos-yours"));
  // Details: closed, with the tiles, the all-withheld sentence, the confident-pair counts and the family hint
  const details = root.querySelector('details[data-prx-disclosure="details"]');
  assert.equal(details.open, false);
  assert.equal(details.querySelector("summary").textContent, "Details");
  for (const hook of ["N", "M", "s", "E", "risk", "allWithheld", "tau", "belowCount", "statedOver"]) {
    assert.equal(root.querySelectorAll(`[data-prx-readout="${hook}"]`).length, 1, hook);
    assert.ok(details.querySelector(`[data-prx-readout="${hook}"]`), `${hook} in Details`);
  }
  assert.match(details.textContent, /Change the family: at most 3 grades \(shown now\) or no cap/);
  // a scored report: a third bar, the line under the row, hooks once each
  app.update({ yours: [1, 2, 3, 4, 5, 6] });
  assert.equal(root.querySelectorAll('[data-prx-readout="yoursRisk"]').length, 1);
  assert.equal(root.querySelector(".prx-pos-yours").hidden, false);
  app.destroy();
});
