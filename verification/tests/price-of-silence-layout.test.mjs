// 2.4 price-of-silence in frame v2: primary τ slider + strip in toolbar controls, family & step in Settings,
// concise 3-sig-fig read-out, linked matrix + risk bars on stage, and Score your report + Details disclosures.
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
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: "https://app.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
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

test("2.4: toolbar holds the τ slider, presets, and Settings family switch; strip sits in riskBox on stage; read-out uses 3 sig figs", async () => {
  const { el } = mountAt("?preset=tau20-cap3");
  const { mountWidget } = await import(`${ROOT}js/apps/price-of-silence.js`);
  const app = mountWidget(el);
  const root = el.querySelector(".prx-widget");
  assert.equal(root.getAttribute("data-prx-frame"), "v2");
  assert.equal(root.getAttribute("data-prx-layout"), "v2");
  const toolbar = root.querySelector(".prx-toolbar");
  const controls = toolbar.querySelector(".prx-controls");
  const tau = controls.querySelector(".prx-pos-tau");
  assert.ok(tau.querySelector("input[type=range]"), "τ slider in controls");
  assert.equal(controls.querySelector(".prx-pos-strip-chart"), null, "strip moved out of dark-mode toolbar controls");
  const riskBox = root.querySelector(".prx-stage .prx-pos-risk");
  assert.ok(riskBox.querySelector(".prx-pos-strip-chart svg"), "strip in riskBox inside .prx-stage");
  assert.ok(riskBox.querySelector("[data-prx-strip-marker]"), "the strip's τ marker");
  assert.ok(riskBox.querySelector(".prx-pos-strip .prx-pos-note")?.textContent.length > 0, "stripNote mounted in DOM");
  assert.match(riskBox.querySelector(".prx-pos-strip-chart svg").textContent, /N = 12/, "wide segment labeled N = 12");
  assert.equal(root.querySelectorAll(".prx-pos-strip-chart").length, 1, "one strip");
  // secondary family switch sits cleanly inside Settings in the v2 toolbar
  const settings = toolbar.querySelector('details[data-prx-disclosure="settings"]');
  assert.equal(settings.open, false);
  const family = settings.querySelector("fieldset.prx-pos-family");
  assert.equal(family.querySelector("legend").textContent, "Family of reports");
  assert.deepEqual(
    [...family.querySelectorAll(".prx-seg")].map((b) => b.textContent),
    ["At most 3 grades · 603 reports", "No cap (all reports) · 4,683 reports"],
  );
  assert.ok(root.querySelector(".prx-readout").previousElementSibling === toolbar, "read-out right under the toolbar");
  assert.equal(
    readout(root),
    "τ = .20, at most 3 grades (603 reports): best report {A, B} > {C, D} > {E, F}, 12 of 15 stated, risk .0417; A–B and E–F are withheld although each error is below τ.",
  );
  // a click on the family switch changes the family
  family.querySelector('.prx-seg[data-value="none"]').click();
  assert.equal(app.state.cap, "none");
  assert.equal(
    readout(root),
    "τ = .20, no cap (all 4,683 reports on 6 units): best report {A} > {B} > {C, D} > {E} > {F}, 14 of 15 stated, risk .0372.",
  );
  app.update({ tau: 0.15, cap: 3 });
  assert.equal(
    readout(root),
    "τ = .15, at most 3 grades (603 reports): best report {A, B} > {C, D} > {E, F}, 12 of 15 stated, risk .0317; E–F is withheld although its error is below τ.",
  );
  app.destroy();
});

test("2.4: stage pairs matrix and risk bars; Score your report keeps Enter focus & yoursRisk; Details keeps every hook", async () => {
  const { win, el } = mountAt("");
  const { mountWidget } = await import(`${ROOT}js/apps/price-of-silence.js`);
  const app = mountWidget(el);
  const root = el.querySelector(".prx-widget");
  const stage = root.querySelector(".prx-stage");
  assert.match(
    stage.querySelector(".prx-pos-matrix .prx-pos-matrix-caption").textContent,
    /^Below τ but withheld by the best report: 2 \(A and B; E and F\)\.$/,
  );
  assert.ok(stage.querySelector(".prx-pos-matrix-chart").hasAttribute("data-prx-primary"), "the matrix is the primary graphic");
  assert.ok(stage.querySelector(".prx-pos-bars-chart svg"), "linked risk bars on stage");

  // Score your report disclosure: entry precedes result line; Enter scores and retains input focus
  const scoreBox = root.querySelector('details[data-prx-disclosure="score"]');
  assert.equal(scoreBox.open, false);
  const entry = scoreBox.querySelector(".prx-pos-entry");
  const yoursLine = scoreBox.querySelector(".prx-pos-yours");
  assert.ok(entry.compareDocumentPosition(yoursLine) & win.Node.DOCUMENT_POSITION_FOLLOWING);

  // Details: closed, with the tiles, the all-withheld sentence, the confident-pair counts and the family hint
  const details = root.querySelector('details[data-prx-disclosure="details"]');
  assert.equal(details.open, false);
  assert.equal(details.querySelector("summary").textContent, "Details");
  for (const hook of ["N", "M", "s", "E", "risk", "allWithheld", "tau", "belowCount", "statedOver"]) {
    assert.equal(root.querySelectorAll(`[data-prx-readout="${hook}"]`).length, 1, hook);
    assert.ok(details.querySelector(`[data-prx-readout="${hook}"]`), `${hook} in Details`);
  }
  assert.match(details.textContent, /Change the family: at most 3 grades \(shown now\) or no cap/);

  // Enter-to-score retains focus on the text input and reveals yoursRisk + a third bar
  scoreBox.open = true;
  const input = entry.querySelector('input[name="yours"]');
  input.focus();
  input.value = "1,2,3,4,5,6";
  input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.deepEqual(app.state.yours, [1, 2, 3, 4, 5, 6]);
  assert.equal(win.document.activeElement, input, "Enter-to-score keeps focus on the input");
  assert.equal(root.querySelectorAll('[data-prx-readout="yoursRisk"]').length, 1);
  assert.equal(yoursLine.hidden, false);
  app.destroy();
});
