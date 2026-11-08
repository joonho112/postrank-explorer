// 2.5 tau-path after the review 044 repair: the τ control follows the cost window (G1-F5), keyboard steps land on a
// grid anchored at 0 (X-13), and the read-out names a tie (X-12) (jsdom from tools/node_modules).
//   node --test verification/tests/tau-path-slider.test.mjs
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

/** A window with Plot loaded and the app's query; jsdom's own "not implemented" notices (canvas) are dropped. */
function mountAt(query) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "https://app.test/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const win = dom.window;
  win.__PRX_QUERY = query;
  win.eval(D3);
  win.eval(PLOT);
  return { win, el: win.document.getElementById("app") };
}

const shownSliders = (el) => [...el.querySelectorAll(".prx-widget input[type=range]")].filter((n) => !n.closest("[hidden]"));
const press = (win, el, key) => shownSliders(el)[0].dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const shownValue = (el) => shownSliders(el)[0].parentElement.querySelector("output").textContent;

test("2.5: keyboard steps on a grid anchored at 0; the low-cost zoom has its own slider over [0, .02]", async () => {
  const { win, el } = mountAt("");
  const { mountWidget } = await import(`${ROOT}js/apps/tau-path.js`);
  const app = mountWidget(el);
  assert.equal(shownSliders(el).length, 1, "one τ slider shown");
  assert.equal(shownSliders(el)[0].max, "0.5");
  press(win, el, "ArrowRight");
  assert.equal(app.state.tau, 0.21);
  assert.equal(shownValue(el), ".21");
  press(win, el, "Home");
  assert.equal(app.state.tau, 0.000001, "the minimum stays a clamp");
  assert.equal(shownValue(el), ".000001");
  press(win, el, "ArrowRight");
  assert.equal(app.state.tau, 0.01);
  // the zoom: its own slider, the same tau key
  el.querySelector('.prx-seg[data-value="low"]').click();
  assert.equal(app.state.zoom, "low");
  assert.equal(app.state.tau, 0.01);
  assert.equal(shownSliders(el).length, 1);
  assert.equal(shownSliders(el)[0].max, "0.02");
  app.update({ tau: 0.005 });
  press(win, el, "ArrowRight");
  assert.equal(app.state.tau, 0.0051);
  assert.equal(shownValue(el), ".0051");
  // off-grid presets stay exact; the next key lands on the grid
  app.applyPreset("early");
  assert.equal(shownValue(el), ".0005");
  press(win, el, "ArrowRight");
  assert.equal(app.state.tau, 0.0006);
  app.applyPreset("bend");
  assert.equal(shownSliders(el)[0].max, "0.5");
  assert.equal(shownValue(el), ".14442218");
  press(win, el, "ArrowRight");
  assert.equal(app.state.tau, 0.15);
  // a τ above the zoom's window (from a URL) shows its exact value, with its data-num
  app.update({ zoom: "low", tau: 0.3 });
  const out = shownSliders(el)[0].parentElement.querySelector("output");
  assert.equal(out.textContent, ".30");
  assert.equal(out.getAttribute("data-num"), "0.3");
  app.destroy();
});

test("2.5: at a tie of the smallest risk the read-out says so where it names the report", async () => {
  const { el } = mountAt("?preset=bend");
  const { mountWidget } = await import(`${ROOT}js/apps/tau-path.js`);
  const app = mountWidget(el);
  const ro = el.querySelector(".prx-readout");
  assert.match(ro.textContent, /^At τ = \.14442218, \{A, B\} > \{C, D\} > \{E, F\} \(one of 2 equal-risk best reports; showing the first\) states 12 of 15 pairs/);
  assert.equal(ro.querySelector(".prx-result-ties .prx-num").getAttribute("data-num"), "2");
  app.applyPreset("overview");
  assert.equal(ro.querySelector(".prx-result-ties"), null, "no tie, no qualifier");
  // the complete path is one click away, complete
  const box = el.querySelector('details[data-prx-disclosure="path"]');
  assert.equal(box.open, false);
  assert.equal(box.querySelectorAll("tbody tr").length, 6);
  assert.equal(box.querySelectorAll(".prx-tp-changes li").length, 5);
  assert.ok(el.querySelector(".prx-tp-endpoint") && !el.querySelector(".prx-tp-endpoint").closest("details"), "endpoint example stays visible");
  app.destroy();
});
