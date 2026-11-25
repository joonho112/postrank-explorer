// frontier-ruler.test.mjs: app 2.10 ("The frontier") Frame v2 and 3-sig-fig checks.
// The read-out cases (verification/readouts/frontier.json) check every oracle/registry number; these tests verify:
//   1. Frame v2 slot order (title, toolbar, readout, chart, scope, disclosures, caption), primary graphic, primary
//      control, and concise 3-sig-fig readout with exact raw data-num values.
//   2. Interactive τ-interval ruler inside the stage: one band per slider-reachable vertex, touched band pressed,
//      keyboard click keeps focus on the band, pointer click sets τ and focuses the τ slider, and cap3 single-band span.
//   3. Unified frontier vertex table in Data disclosure (closed by default): lists all vertices with exact values,
//      marks rows below the slider without pick buttons, and sets τ when a row's pick button is activated.
//   4. Keyboard and pointer interaction on chart column marks: Enter picks a vertex while keeping focus on the point,
//      pointer click focuses the τ slider, and reader text states the 3-sig-fig τ range and risk.
//   5. Progressive disclosures (Settings, Data, Method) closed by default with complete hooks, tolerances, aria-describedby
//      slider hint, and visible mixture caption on the stage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const APP = "js/apps/frontier.js";
const box = (root, name) => root.querySelector(`details[data-prx-disclosure="${name}"]`);
const bands = (root) => [...root.querySelectorAll(".prx-frt-ruler [data-prx-band]")];
const hook = (root, name) => root.querySelector(`[data-prx-readout="${name}"]`)?.getAttribute("data-num");
const keyClick = (win, node) => node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 0 }));
const pointerClick = (win, node) => node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));

test("2.10: frame v2 order, primary stage and control, and concise 3-sig-fig readout with exact data-num", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    assert.equal(m.root.getAttribute("data-prx-frame"), "v2");
    assert.equal(m.root.getAttribute("data-prx-layout"), "v2");
    assert.deepEqual(
      [...m.root.children].map((n) => n.getAttribute("data-prx-part")),
      ["title", "toolbar", "readout", "chart", "scope", "disclosures", "caption"],
    );
    const toolbarParts = [...m.root.querySelector('[data-prx-part="toolbar"]').children].map(
      (n) => n.getAttribute("data-prx-part") ?? n.getAttribute("data-prx-disclosure"),
    );
    assert.deepEqual(toolbarParts, ["controls", "presets", "settings"]);
    assert.ok(m.root.querySelector('[data-prx-part="chart"]').hasAttribute("data-prx-primary"), "stage is the primary graphic");
    assert.ok(m.root.querySelector(".prx-slider").hasAttribute("data-prx-primary-control"), "the τ slider is the primary control");
    assert.equal(hook(m.root, "N"), "14");
    assert.equal(Number(hook(m.root, "E")).toFixed(4), "0.3576");
    assert.equal(Number(hook(m.root, "bestFrom")).toFixed(4), "0.1884");
    assert.equal(Number(hook(m.root, "bestTo")).toFixed(4), "0.3618");
    const roText = m.root.querySelector(".prx-readout").textContent;
    assert.match(roText, /At τ = \.20 \(4,683 reports\), \{A\} > \{B\} > \{C, D\} > \{E\} > \{F\} states N = 14 of 15 pairs \(E = \.358, risk \.0372\); best for τ from \.188 to \.362\.$/);
  } finally {
    m.close();
  }
});

test("2.10: the τ ruler in ctx.stage has one band per vertex on the slider, pressed when touched; clicking sets τ", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    assert.ok(m.root.querySelector(".prx-stage .prx-frt-ruler"), "ruler lives inside ctx.stage");
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("data-prx-band")), ["12", "13", "14", "15"]);
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("aria-pressed")), ["false", "false", "true", "false"]);
    const widths = bands(m.root).map((b) => parseFloat(b.style.flexBasis));
    assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 100) < 1e-9, "the bands cover the slider span");

    const b13 = bands(m.root).find((b) => b.getAttribute("data-prx-band") === "13");
    assert.match(b13.getAttribute("aria-label"), /N = 13: the best report for τ from \.144 to \.188\. Sets τ to \.17\./);
    b13.focus();
    keyClick(m.win, b13);
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.17);
    assert.equal(hook(m.root, "N"), "13");
    assert.equal(m.doc.activeElement?.getAttribute("data-prx-band"), "13", "a key press keeps focus on the band (redrawn)");
    assert.equal(bands(m.root).find((b) => b.getAttribute("data-prx-band") === "13").getAttribute("aria-pressed"), "true");

    pointerClick(m.win, bands(m.root).find((b) => b.getAttribute("data-prx-band") === "15"));
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.43);
    assert.equal(hook(m.root, "N"), "15");
    assert.equal(m.doc.activeElement, m.root.querySelector(".prx-slider input[type=range]"), "a pointer click moves focus to the slider");

    m.handle.applyPreset("cap3");
    await settle(m.win, m.el);
    assert.deepEqual(bands(m.root).map((b) => b.getAttribute("data-prx-band")), ["12"]);
    assert.match(m.root.querySelector(".prx-readout").textContent, /from \.00382 to \.50: the same report across this slider\.$/);
  } finally {
    m.close();
  }
});

test("2.10: Data disclosure lists every vertex with exact values and τ intervals; row buttons set τ", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const data = box(m.root, "data");
    assert.ok(data, "Data disclosure exists");
    assert.equal(data.open, false, "closed by default in frame v2");
    const rows = [...data.querySelectorAll("tbody tr")];
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
  } finally {
    m.close();
  }
});

test("2.10: Enter on a vertex's chart point picks it (focus stays); reader text names 3-sig-fig τ range and risk", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const point = () => [...m.root.querySelectorAll(".prx-kbd-point")].find((b) => (b.getAttribute("aria-label") ?? "").startsWith("N = 13:"));
    assert.match(point().getAttribute("aria-label"), /The smallest is a vertex of H\(m\)\. Best for τ from \.144 to \.188; risk at τ = \.20: \.0379\.$/);
    const above = [...m.root.querySelectorAll(".prx-kbd-point")].find((b) => (b.getAttribute("aria-label") ?? "").startsWith("N = 9:"));
    assert.match(above.getAttribute("aria-label"), /which a mixture of two reports reaches\.$/, "a column above H(m) keeps mixture explanation");

    point().focus();
    keyClick(m.win, point());
    await settle(m.win, m.el);
    assert.equal(m.handle.state.tau, 0.17);
    assert.equal(hook(m.root, "N"), "13");
    assert.ok((m.doc.activeElement?.getAttribute("aria-label") ?? "").startsWith("N = 13:"), "focus stays on the point after redraw");
  } finally {
    m.close();
  }
});

test("2.10: Settings, Data, and Method disclosures start closed; hooks, mixture caption, and slider hint stay wired", async () => {
  const m = await mountCase({ module: APP, query: "?preset=tau20" });
  try {
    const settings = box(m.root, "settings");
    const data = box(m.root, "data");
    const method = box(m.root, "method");
    assert.equal(settings.open, false);
    assert.equal(data.open, false);
    assert.equal(method.open, false);
    assert.ok(settings.querySelector(".prx-fr-family"), "Family control is in Settings");
    assert.ok(settings.querySelector(".prx-fr-view"), "View control is in Settings");

    for (let q = 0; q < 6; q += 1) {
      for (const k of [`vN-${q}`, `vE-${q}`, `vGrade-${q}`]) {
        assert.ok(data.querySelector(`[data-prx-readout="${k}"]`), `${k} is in the Data box`);
      }
    }
    for (let q = 1; q < 6; q += 1) {
      assert.ok(data.querySelector(`[data-prx-readout="slope-${q}"]`), `slope-${q} is in the Data box`);
    }
    assert.match(data.textContent, /touched at τ = \.20/);

    const caption = m.root.querySelector('[data-prx-caption="mixture-not-report"]');
    assert.equal(caption.closest("details"), null, "mixture caption is visible on stage without opening a box");
    assert.ok(caption.closest(".prx-frt-keymain"), "mixture caption sits in stage key");

    const descId = m.root.querySelector(".prx-slider input").getAttribute("aria-describedby");
    assert.ok(descId && method.querySelector(`#${descId}`), "slider aria-describedby points to the method hint");
  } finally {
    m.close();
  }
});
