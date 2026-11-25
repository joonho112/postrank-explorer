import assert from "node:assert/strict";
import { test } from "node:test";
import { mountCase, settle } from "../widget_harness.mjs";

test("1.15 links a unit's orders, first place and opponent evidence with disclosures closed", async () => {
  const m = await mountCase({ module: "js/apps/majority-wins.js", query: "?data=orders&unit=A" });
  const stage = m.root.querySelector(".prx-stage");
  const raw = (name) => Number(stage.querySelector(`[data-prx-readout="${name}"]`).dataset.num);
  try {
    assert.equal(m.root.querySelector("details[open]"), null);
    assert.ok(stage.querySelector(".prx-wr-bump-chart svg"));
    assert.ok(stage.querySelector(".prx-mw-pairs-chart svg"));
    assert.ok(stage.querySelector(".prx-mw-legend"));
    assert.equal(raw("chance-first"), 0.51);
    assert.equal(raw("card-wins"), 2);
    const picker = m.root.querySelector(".prx-mw-unit-select select");
    picker.value = "B";
    picker.dispatchEvent(new m.win.Event("change", { bubbles: true }));
    await settle(m.win, m.el);
    assert.equal(raw("chance-first"), 0.48);
    assert.equal(raw("card-wins"), 1);
    assert.equal(raw("card-er"), 1.52);
    const bars = [...stage.querySelectorAll(".prx-mw-pairs-chart .prx-kbd-point")];
    assert.equal(bars.length, 2);
    bars[0].focus();
    assert.match(stage.querySelector(".prx-mw-opponent").textContent, /B above C.*Counts as a majority win/);
    assert.equal(raw("opponent-probability"), 0.99);
    bars[0].dispatchEvent(new m.win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.match(stage.querySelector(".prx-mw-opponent").textContent, /B above A.*opponent wins/);
    assert.equal(raw("opponent-probability"), 0.49);
    assert.equal(raw("chance-first"), 0.48);

    m.handle.update({ data: "league", unit: "" });
    await settle(m.win, m.el);
    assert.match(stage.querySelector(".prx-mw-first").textContent, /First in .* of 4,000 posterior draws/);
    assert.equal(stage.querySelector("[data-prx-readout='chance-first']"), null);
    m.handle.update({ data: "krw", criterion: "gender", unit: "" });
    await settle(m.win, m.el);
    assert.match(stage.querySelector(".prx-mw-first").textContent, /requires a joint law/);
    assert.equal(stage.querySelector("[data-prx-readout='first-draw-count']"), null);
    assert.ok(stage.querySelector(".prx-mw-opponent [data-num]"));
  } finally {
    m.close();
  }
});
