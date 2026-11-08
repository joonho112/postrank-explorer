// frontier-mixtures-boxes.test.mjs (review 044 repair, owner decision D-1 2026-11-07; G3-F1, G3-F2, X-14): app 2.11's
// mixture-first redesign. The review's loss check: every half/order hook and the mini figure are inside the closed
// "Endpoint at τ = 1/2 and a fixed order" box, the vertex table inside the closed "Data: vertices of H(m)" box, the
// τ optimum and label line inside the closed Settings box, while the lottery strip and the capped family's endpoint
// status are visible without opening anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase } from "../widget_harness.mjs";

const APP = "js/apps/frontier-mixtures.js";
const box = (root, name) => root.querySelector(`details[data-prx-disclosure="${name}"]`);
const HALF = ["lastSlope", "endN", "endGrade"];
const ORDER = ["orderV0N", "orderV0E", "orderV1N", "orderV1E", "orderV2N", "orderV2E", "orderLastSlope", "orderLastSlope2", "orderTouchGrade"];
const MIX = ["H", "psi", "upperN", "lowerN", "upperGrade", "lowerGrade", "bestGrade", "bestE", "gap"];

test("2.11 (D-1): the endpoint sections and the mini figure sit, complete, in a closed box; the vertex table in another", async () => {
  const m = await mountCase({ module: APP, query: "?preset=m9" });
  try {
    assert.deepEqual([...m.root.children].map((n) => n.getAttribute("data-prx-part")), ["title", "controls", "readout", "chart", "disclosures", "caption"]);
    const endpoint = box(m.root, "endpoint");
    const data = box(m.root, "data");
    const settings = box(m.root, "settings");
    for (const b of [endpoint, data, settings]) assert.equal(b?.open, false, "closed by default");
    assert.equal(endpoint.querySelector("summary").textContent, "Endpoint at τ = 1/2 and a fixed order");
    assert.equal(data.querySelector("summary").textContent, "Data: vertices of H(m)");
    for (const k of [...HALF, ...ORDER, ...MIX]) assert.ok(endpoint.querySelector(`[data-prx-readout="${k}"]`), `${k} is in the endpoint box`);
    assert.ok(endpoint.querySelector(".prx-fr-mini svg"), "the fixed-order mini figure is in the endpoint box");
    assert.ok(endpoint.querySelector(".prx-fr-mini .prx-data-table table"), "with its hidden table");
    assert.deepEqual([...endpoint.querySelectorAll(".prx-fr-section > h4")].map((h) => h.textContent), ["Mixing two complete reports", "The end at τ = 1/2", "How the criterion errors are combined"]);
    assert.equal(endpoint.querySelector("h5")?.textContent, "A fixed order");
    for (let q = 0; q < 6; q += 1) assert.ok(data.querySelector(`[data-prx-readout="vN-${q}"]`), `vN-${q} is in the Data box`);
    for (const k of ["N", "E", "grades", "risk"]) assert.ok(settings.querySelector(`[data-prx-readout="${k}"]`), `the τ optimum's ${k} is in Settings`);
    assert.ok(settings.querySelector(".prx-fr-label [data-prx-label]"), "the label line is in Settings");
    assert.ok(settings.querySelector('input[type=range][name="tau"]'), "τ is in Settings");
    // the lottery and the chart's gap label are in view, with their own hooks
    const lottery = m.root.querySelector(".prx-fm-lottery");
    assert.equal(lottery.closest("details"), null);
    assert.equal(m.root.querySelector('[data-prx-readout="lottery-upperChance"]').textContent, ".25");
    assert.equal(m.root.querySelector('[data-prx-readout="lottery-lowerChance"]').textContent, ".75");
    assert.ok(m.root.querySelector('.prx-fr-chart [data-prx-readout="chart-gap"]'), "the gap bracket's label on the chart");
    assert.ok(m.root.querySelector(".prx-fr-chart").hasAttribute("data-prx-primary"));
  } finally { m.close(); }
});

test("2.11: the capped family's endpoint status is visible without opening anything; the badge stays in its box", async () => {
  const m = await mountCase({ module: APP, query: "?preset=cap3" });
  try {
    const pill = m.root.querySelector(".prx-fm-pill");
    assert.equal(pill.closest("details"), null);
    assert.equal(pill.textContent, "Endpoint at τ = 1/2: not guaranteed for this family (H(m) ends at N = 12 of 15)");
    assert.equal(m.root.querySelectorAll(".prx-fr-badge").length, 1);
    assert.ok(box(m.root, "endpoint").contains(m.root.querySelector(".prx-fr-badge")));
    assert.ok(box(m.root, "endpoint").querySelector('[data-prx-readout="capEndN"]'));
  } finally { m.close(); }
});

test("2.11: ?open=endpoint,data opens the boxes and is not part of the state", async () => {
  const m = await mountCase({ module: APP, query: "?preset=m10&open=endpoint,data" });
  try {
    assert.equal(box(m.root, "endpoint").open, true);
    assert.equal(box(m.root, "data").open, true);
    assert.equal(box(m.root, "settings").open, false);
    assert.equal("open" in m.handle.state, false);
  } finally { m.close(); }
});
