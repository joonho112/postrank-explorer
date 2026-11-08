// frontier-ruler.test.mjs (review 044 repair, G2-F1, X-01, X-14, X-16, X-23): app 2.10's result-first redesign. The
// read-out cases (verification/readouts/frontier.json) check the numbers at each setting; these checks cover what they
// cannot script: the frame's order and the primary graphic, the τ ruler (one band per vertex a τ of the slider touches,
// the touched band pressed, a band sets τ inside its range), the result card (every vertex with its τ range, rows below
// the slider marked and without a button, a row's button sets τ), Enter on a chart point picks its vertex and keeps
// focus there, v1's vertex table and the cloud's key complete in closed boxes, the mixture caption outside them, and the
// phone order (Family and View follow the chart, the card starts closed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const APP = "js/apps/frontier.js";
const NARROW = "(max-width: 37.5em)";
const box = (root, name) => root.querySelector(`details[data-prx-disclosure="${name}"]`);
const bands = (root) => [...root.querySelectorAll(".prx-frt-ruler [data-prx-band]")];
const hook = (root, name) => root.querySelector(`[data-prx-readout="${name}"]`)?.getAttribute("data-num");
// a click from the keyboard (Enter or Space on a button) has no pointer position: detail 0
const keyClick = (win, node) => node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 0 }));
const pointerClick = (win, node) => node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));

test("2.10: the result-first order, the chart as the primary graphic, the τ range in the read-out", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    assert.equal(m.root.getAttribute("data-prx-layout"), "result-first");
    assert.deepEqual([...m.root.children].map((n) => n.getAttribute("data-prx-part")), ["title", "controls", "readout", "chart", "disclosures", "caption"]);
    assert.ok(m.root.querySelector(".prx-fr-chart").hasAttribute("data-prx-primary"), "the cloud is the primary graphic");
    assert.ok(m.root.querySelector(".prx-slider").hasAttribute("data-prx-primary-control"), "the τ slider is the primary control");
    assert.equal(hook(m.root, "N"), "14");
    assert.equal(Number(hook(m.root, "bestFrom")).toFixed(4), "0.1884");
    assert.equal(Number(hook(m.root, "bestTo")).toFixed(4), "0.3618");
    assert.match(m.root.querySelector(".prx-readout").textContent, /N = 14 of 15 pairs stated.*This report is best for every τ from \.1884 to \.3618\.$/);
  } finally { m.close(); }
});

test("2.10: the τ ruler has one band per vertex on the slider, the touched one pressed; a band sets τ inside its range", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("data-prx-band")), ["12", "13", "14", "15"]);
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("aria-pressed")), ["false", "false", "true", "false"]);
    const widths = bands(m.root).map((b) => parseFloat(b.style.flexBasis));
    assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 100) < 1e-9, "the bands cover the slider");
    // band 13 (N = 13 is best for τ from .1444 to .1884): τ .17, the step nearest the middle of that range
    const b13 = bands(m.root).find((b) => b.getAttribute("data-prx-band") === "13");
    assert.match(b13.getAttribute("aria-label"), /N = 13: the best report for τ from \.1444 to \.1884\. Sets τ to \.17\./);
    b13.focus();
    keyClick(m.win, b13);
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.17);
    assert.equal(hook(m.root, "N"), "13");
    assert.equal(m.doc.activeElement?.getAttribute("data-prx-band"), "13", "a key press keeps focus on the band (redrawn)");
    assert.equal(bands(m.root).find((b) => b.getAttribute("data-prx-band") === "13").getAttribute("aria-pressed"), "true");
    // a pointer click on band 15 sets τ inside (.3618, .50] and moves focus to the slider
    pointerClick(m.win, bands(m.root).find((b) => b.getAttribute("data-prx-band") === "15"));
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.43);
    assert.equal(hook(m.root, "N"), "15");
    assert.equal(m.doc.activeElement, m.root.querySelector(".prx-slider input[type=range]"), "a pointer click moves focus to the slider");
    // the capped family: one band for the whole slider, and the read-out says the report stays the same
    m.handle.applyPreset("cap3");
    await settle(m.win, m.el);
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("data-prx-band")), ["12"]);
    assert.match(m.root.querySelector(".prx-readout").textContent, /from \.0038 to \.50: the same report for every τ on this slider\.$/);
  } finally { m.close(); }
});

test("2.10: the result card lists every vertex with its τ range; rows below the slider have no button; a row's button sets τ", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const card = box(m.root, "vertices-tau");
    assert.ok(card, "the result card is a disclosure");
    assert.equal(card.open, true, "open by default where the screen is wider than 37.5em");
    const rows = [...card.querySelectorAll("tbody tr")];
    assert.deepEqual(rows.map((r) => r.getAttribute("data-prx-vertex")), ["0", "8", "12", "13", "14", "15"]);
    assert.deepEqual(rows.map((r) => r.hasAttribute("data-prx-pick")), [false, false, true, true, true, true]);
    assert.deepEqual(rows.map((r) => r.getAttribute("aria-current")), [null, null, null, null, "true", null], "the touched row is marked");
    assert.match(rows[0].textContent, /up to \.0012 \(below this slider\)/);
    assert.match(rows[1].textContent, /from \.0012 to \.0038 \(below this slider\)/);
    assert.match(rows[5].textContent, /from \.3618 to \.50/);
    assert.equal(rows[0].querySelector("button"), null);
    keyClick(m.win, rows[2].querySelector("button"));
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.08, "N = 12 is best for τ from .0038 to .1444: τ .08");
    assert.equal(hook(m.root, "N"), "12");
  } finally { m.close(); }
});

test("2.10: Enter on a vertex's chart point picks it (focus stays); the reader text names its τ range and risk", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const point = () => [...m.root.querySelectorAll(".prx-kbd-point")].find((b) => (b.getAttribute("aria-label") ?? "").startsWith("N = 13:"));
    assert.match(point().getAttribute("aria-label"), /The smallest is a vertex of H\(m\)\. Best for τ from \.1444 to \.1884; risk at τ = \.20: \.0379\.$/);
    const above = [...m.root.querySelectorAll(".prx-kbd-point")].find((b) => (b.getAttribute("aria-label") ?? "").startsWith("N = 9:"));
    assert.match(above.getAttribute("aria-label"), /which a mixture of two reports reaches\.$/, "a column above H(m) keeps v1's text");
    point().focus();
    keyClick(m.win, point());
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.17);
    assert.equal(hook(m.root, "N"), "13");
    assert.ok((m.doc.activeElement?.getAttribute("aria-label") ?? "").startsWith("N = 13:"), "focus stays on the point after the redraw");
  } finally { m.close(); }
});

test("2.10: v1's vertex table and the cloud's key are complete in closed boxes; the mixture caption stays outside them", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const data = box(m.root, "data");
    const key = box(m.root, "key");
    assert.equal(data.open, false);
    assert.equal(key.open, false);
    for (let q = 0; q < 6; q += 1) for (const k of [`vN-${q}`, `vE-${q}`, `vGrade-${q}`]) assert.ok(data.querySelector(`[data-prx-readout="${k}"]`), `${k} is in the Data box`);
    for (let q = 1; q < 6; q += 1) assert.ok(data.querySelector(`[data-prx-readout="slope-${q}"]`), `slope-${q} is in the Data box`);
    assert.match(data.textContent, /touched at τ = \.20/);
    assert.equal(key.querySelectorAll(".prx-fr-key").length, 3, "the gray dash, the per-N minimum and the triangle");
    const caption = m.root.querySelector('[data-prx-caption="mixture-not-report"]');
    assert.equal(caption.closest("details"), null, "the mixture caption is visible without opening a box");
    assert.ok(caption.closest(".prx-frt-keymain"), "beside the hull's key entry, under the chart");
    assert.ok(m.root.querySelector(".prx-frt-keymain .prx-hint")?.id, "the slider's hint sits in the key under the chart");
    assert.equal(m.root.querySelector(".prx-slider input").getAttribute("aria-describedby"), m.root.querySelector(".prx-frt-keymain .prx-hint").id);
  } finally { m.close(); }
});

test("2.10: on phones Family and View follow the chart and the result card starts closed (nodes move, focus kept)", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const toggles = m.root.querySelector(".prx-frt-toggles");
    assert.equal(toggles.parentNode, m.root.querySelector(".prx-controls"));
    const radio = toggles.querySelector("input[type=radio]");
    radio.focus();
    m.env.media.set(NARROW, true);
    assert.equal(toggles.parentNode, m.root.querySelector(".prx-frt-main"), "after the chart");
    assert.equal(m.doc.activeElement, radio, "the focused radio keeps focus");
    assert.equal(box(m.root, "vertices-tau").open, false);
    const presets = m.root.querySelector(".prx-presets");
    assert.equal(presets.previousElementSibling, m.root.querySelector(".prx-slider"), "the preset row follows the slider");
    m.env.media.set(NARROW, false);
    assert.equal(toggles.parentNode, m.root.querySelector(".prx-controls"));
    assert.equal(toggles.nextElementSibling, presets, "back before the preset row");
  } finally { m.close(); }
});
