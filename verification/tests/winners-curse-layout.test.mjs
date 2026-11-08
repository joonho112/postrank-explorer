// winners-curse-layout.test.mjs (review 044 repair, Phase 3, group U-D): app 1.4's result-first layout. The replay
// shown sits in the controls row (U1-F5), the read-out directly under the controls, the two histograms are the primary
// graphic, the views are in a phone's reading order (U1-F6: histograms, league table, summary) and each histogram
// writes its mean on its dashed line with the same raw value as its heading. Fix round: the Prior SD slider is the
// primary control, and each mean label sits one row above the triangle of the replay shown, at the top end of its
// dashed line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const MODULE = "js/apps/winners-curse.js";
const partsOf = (root) => [...root.children].map((n) => n.getAttribute("data-prx-part") ?? n.tagName.toLowerCase());
const num = (root, hook) => [...root.querySelectorAll(`[data-prx-readout="${hook}"]`)].map((n) => Number(n.getAttribute("data-num")));

test("1.4: result-first frame with the replay shown in the controls row, before the preset row", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3" });
  try {
    const root = m.root;
    assert.equal(root.getAttribute("data-prx-layout"), "result-first");
    assert.deepEqual(partsOf(root).filter((p) => p !== "title"), ["controls", "readout", "chart", "caption"]);
    const controls = root.querySelector('[data-prx-part="controls"]');
    const draw = root.querySelector('input[name="draw"]');
    const presets = root.querySelector('[data-prx-part="presets"]');
    assert.ok(controls.contains(draw), "the replay slider is in the controls area");
    assert.ok(draw.compareDocumentPosition(presets) & 4, "the replay slider comes before the preset row");
    const row = draw.closest(".prx-wc-row");
    const nameOf = (n) => n.querySelector("input[name]")?.getAttribute("name") ?? n.querySelector(".prx-seg")?.getAttribute("data-prx-focus-key")?.split(":")[1];
    assert.deepEqual([...row.children].map(nameOf), ["side", "k", "priorSd", "replays", "draw"],
      "one row: the end, k, the prior SD, the replays, the replay shown");
    assert.equal(root.querySelector(".prx-wc-draw .prx-hint").textContent, "Replay 1 of 2,000 (seed 20261029 + 1).");
    // the seed stays under the league table, outside the controls area
    const seed = root.querySelector('input[name="seed"]');
    assert.ok(!controls.contains(seed) && seed.closest(".prx-wc-league"), "the seed stays under the league table");
  } finally { m.close(); }
});

test("1.4: views in a phone's reading order; the histograms are the primary graphic", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3" });
  try {
    const views = m.root.querySelector(".prx-wc-views");
    assert.deepEqual([...views.children].map((n) => n.className), ["prx-wc-dist", "prx-wc-league", "prx-wc-sum"]);
    const primary = m.root.querySelectorAll("[data-prx-primary]");
    assert.equal(primary.length, 1);
    assert.ok(primary[0].classList.contains("prx-wc-hists"));
    assert.equal(primary[0].querySelectorAll("svg").length >= 2, true, "both histograms inside the primary graphic");
    // nothing but the heading between the read-out and the histograms: the note follows the key
    const dist = views.querySelector(".prx-wc-dist");
    assert.deepEqual([...dist.children].map((n) => n.classList.contains("prx-wc-hists") ? "hists" : n.classList.contains("prx-wc-note") ? "note"
      : n.classList.contains("prx-nl-key") ? "key" : "heading"), ["heading", "hists", "key", "note"]);
    // the summary block keeps the lead, the table and the Monte Carlo SEs
    const sum = views.querySelector(".prx-wc-sum");
    assert.ok(sum.querySelector(".prx-wc-lead") && sum.querySelector("table") && sum.querySelector(".prx-wc-mcse"));
  } finally { m.close(); }
});

test("1.4: each histogram's mean on its dashed line has the heading's raw value and follows the controls", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3", updates: [{ priorSd: 0.05 }, { draw: 9 }] });
  try {
    const root = m.root;
    for (const which of ["est", "post"]) {
      const onLine = num(root, `chart-mean-${which}`);
      assert.equal(onLine.length, 1, `one label for ${which}`);
      assert.deepEqual(onLine, num(root, `mean-${which}`), `the label equals the heading's mean (${which})`);
      assert.deepEqual(onLine, num(root, `read-${which}`), `and the read-out's average (${which})`);
    }
    assert.equal(num(root, "read-prior-sd")[0], 0.05);
    assert.equal(Number(root.querySelector('input[name="draw"]').value), 9, "the replay slider shows the replay set by an update");
    assert.equal(num(root, "read-replay")[0], 9);
  } finally { m.close(); }
});

test("1.4: a new number of replays remakes the replay slider in the same slot of the controls row", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=replay9" });
  try {
    const slot = m.root.querySelector(".prx-wc-draw");
    m.handle.update({ replays: 20 });
    await settle(m.win, m.el);
    assert.equal(m.root.querySelector(".prx-wc-draw"), slot, "same slot");
    const input = slot.querySelector('input[name="draw"]');
    assert.equal(Number(input.max), 20);
    assert.equal(Number(input.value), 9);
    assert.equal(slot.querySelector(".prx-hint").textContent, "Replay 9 of 20 (seed 20261029 + 9).");
  } finally { m.close(); }
});

test("1.4: the Prior SD slider is the primary control", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3" });
  try {
    const marked = m.root.querySelectorAll("[data-prx-primary-control]");
    assert.equal(marked.length, 1);
    assert.equal(marked[0].getAttribute("name"), "priorSd");
  } finally { m.close(); }
});

test("1.4: each mean label sits one row above the replay triangle, at the top end of its dashed line", async () => {
  // the vertical position of an SVG element: its own and its groups' translate() offsets
  const ty = (el) => {
    let y = 0;
    for (let n = el; n && n.tagName.toLowerCase() !== "svg"; n = n.parentElement) {
      const match = /translate\(\s*[-\d.e]+\s*,\s*([-\d.e]+)\s*\)/.exec(n.getAttribute("transform") ?? "");
      if (match) y += Number(match[1]);
    }
    return y;
  };
  for (const preset of ["top3", "bottom3", "prior05"]) {
    const m = await mountCase({ module: MODULE, query: `?preset=${preset}` });
    try {
      for (const which of ["est", "post"]) {
        const svg = m.root.querySelector(`.prx-wc-${which}-chart svg`);
        const label = svg.querySelector(`[data-prx-readout="chart-mean-${which}"]`);
        const line = svg.querySelector('g[stroke-dasharray="5,3"] line');
        const triangle = [...svg.querySelectorAll("path")].find((p) => /rotate\(180\)/.test(p.getAttribute("transform") ?? ""));
        const labelY = ty(label);
        const lineTop = Number(line.getAttribute("y1")) + ty(line);
        const triangleY = ty(triangle);
        assert.equal(Number(line.getAttribute("x1")).toFixed(1), Number(/translate\(\s*([-\d.e]+)/.exec(label.getAttribute("transform"))[1]).toFixed(1),
          `${preset} ${which}: the label is written at the dashed line`);
        assert.ok(labelY < lineTop && lineTop < triangleY - 6, `${preset} ${which}: label (${labelY}) above the line's top (${lineTop}), triangle (${triangleY}) below it`);
        assert.ok(triangleY - labelY >= 20, `${preset} ${which}: a row between the label and the triangle`);
      }
    } finally { m.close(); }
  }
});
