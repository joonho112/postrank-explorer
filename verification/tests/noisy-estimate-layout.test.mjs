// noisy-estimate-layout.test.mjs (review 044 repair, Phase 3, group U-D): app 1.2's result-first layout. The read-out
// sits directly under the controls, the dot plot is the primary graphic, the DOM keeps the plot, legend, parts order
// (the phone order is CSS only), and the full note's words are always in the page, marked shown only at the cap, so
// on a phone it can share the draws hint's cell and the preset row never moves. Fix round: Draw is the primary
// control, and the arrow carries the latest noise ("noise −.271") with the parts box's raw value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const MODULE = "js/apps/noisy-estimate.js";
const partsOf = (root) => [...root.children].map((n) => n.getAttribute("data-prx-part") ?? n.tagName.toLowerCase());
const NOTE = "The app holds at most 200 estimates; press Clear to start again.";

test("1.2: result-first frame; the dot plot is the primary graphic; DOM order of the charts unchanged", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=se20" });
  try {
    const root = m.root;
    assert.equal(root.getAttribute("data-prx-layout"), "result-first");
    assert.deepEqual(partsOf(root), ["controls", "readout", "chart", "caption"]);
    const charts = root.querySelector('[data-prx-part="chart"]');
    assert.deepEqual([...charts.children].map((n) => n.classList.contains("nse-chart") ? "plot" : n.classList.contains("nse-legend") ? "legend"
      : n.classList.contains("nse-parts") ? "parts" : n.className), ["plot", "legend", "parts"]);
    const primary = root.querySelectorAll("[data-prx-primary]");
    assert.equal(primary.length, 1);
    assert.ok(primary[0].classList.contains("nse-chart") && primary[0].querySelector("svg"));
    // the sliders keep their order (read-out cases read .prx-slider output by index)
    assert.deepEqual([...root.querySelectorAll(".prx-slider input")].map((i) => i.name), ["truth", "se"]);
  } finally { m.close(); }
});

test("1.2: the full note is always in the page and marked shown only at the cap, on the note and its group", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=se20" });
  try {
    const note = m.root.querySelector(".nse-full");
    const box = m.root.querySelector(".nse-draws");
    const hint = box.querySelector(".nse-draws-hint");
    assert.equal(hint.textContent, "Each draw collects new data once and adds its estimate.");
    assert.equal(note.textContent, NOTE, "the note's words are there below the cap (shown only at the cap, by CSS)");
    assert.equal(note.hasAttribute("hidden"), false);
    assert.equal(note.hasAttribute("data-nse-full"), false);
    assert.equal(box.hasAttribute("data-nse-full"), false);
    m.handle.update({ draws: 200 });
    await settle(m.win, m.el);
    assert.equal(note.hasAttribute("data-nse-full"), true);
    assert.equal(box.hasAttribute("data-nse-full"), true);
    assert.equal(note.textContent, NOTE);
    assert.equal(Number(note.querySelector("[data-num]").getAttribute("data-num")), 200);
    const [drawOne, drawMany, clear] = box.querySelectorAll("button");
    assert.equal(drawOne.disabled && drawMany.disabled && !clear.disabled, true, "Draw and Draw 20 disabled at the cap, Clear enabled");
    m.handle.update({ draws: 20 });
    await settle(m.win, m.el);
    assert.equal(note.hasAttribute("data-nse-full"), false);
    assert.equal(box.hasAttribute("data-nse-full"), false);
  } finally { m.close(); }
});

test("1.2: Draw is the primary control; the arrow's label carries the parts box's noise (data-num, hook chart-noise)", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=se20" });
  try {
    const marked = m.root.querySelectorAll("[data-prx-primary-control]");
    assert.equal(marked.length, 1);
    assert.equal(marked[0].getAttribute("data-prx-focus-key"), "draw:one", "the Draw button");
    const label = m.root.querySelector('.nse-chart svg [data-prx-readout="chart-noise"]');
    assert.ok(label, "the noise is written on the arrow at SE .20");
    assert.equal(label.closest("text").textContent, "noise −.271");
    const raw = (hook) => m.root.querySelector(`[data-prx-readout="${hook}"]`).getAttribute("data-num");
    assert.equal(label.getAttribute("data-num"), raw("parts-noise"), "the same raw value as the parts box");
    assert.equal(label.getAttribute("data-num"), raw("noise"), "and as the read-out");
    // an arrow shorter than 6 px is not drawn, so neither is its label (200 draws: the latest noise is +.004)
    m.handle.update({ draws: 200 });
    await settle(m.win, m.el);
    assert.equal(m.root.querySelector('[data-prx-readout="chart-noise"]'), null);
  } finally { m.close(); }
});
