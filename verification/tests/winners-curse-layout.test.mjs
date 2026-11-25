// winners-curse-layout.test.mjs: app 1.4's Frame v2 layout. Primary toolbar holds Prior SD + End,
// secondary replay/seed controls live in Settings, the paired histograms + key form the primary stage, the single-replay
// league table and Monte Carlo summary live in Data, and each histogram writes its mean on its dashed line one row above
// the replay triangle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const MODULE = "js/apps/winners-curse.js";
const partsOf = (root) => [...root.children].map((n) => n.getAttribute("data-prx-part") ?? n.tagName.toLowerCase());
const num = (root, hook) => [...root.querySelectorAll(`[data-prx-readout="${hook}"]`)].map((n) => Number(n.getAttribute("data-num")));

test("1.4: frame v2 toolbar with Prior SD and End primary controls, and k/replays/draw/seed inside Settings", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3" });
  try {
    const root = m.root;
    assert.equal(root.getAttribute("data-prx-frame"), "v2");
    assert.equal(root.getAttribute("data-prx-layout"), "v2");
    assert.deepEqual(
      partsOf(root).filter((p) => p !== "title"),
      ["toolbar", "readout", "chart", "scope", "disclosures", "caption"],
    );
    const toolbar = root.querySelector('[data-prx-part="toolbar"]');
    assert.deepEqual(
      [...toolbar.children].map((n) => n.getAttribute("data-prx-part") ?? n.getAttribute("data-prx-disclosure")),
      ["controls", "presets", "settings"],
    );
    const controls = root.querySelector('[data-prx-part="controls"]');
    assert.ok(controls.querySelector('input[name="priorSd"]'), "Prior SD slider in primary controls");
    assert.ok(controls.querySelector('[data-prx-focus-key^="seg:side:"]'), "End segmented in primary controls");

    const settings = toolbar.querySelector('details[data-prx-disclosure="settings"]');
    const draw = root.querySelector('input[name="draw"]');
    const seed = root.querySelector('input[name="seed"]');
    assert.ok(settings.contains(root.querySelector('input[name="k"]')), "k slider in Settings");
    assert.ok(settings.contains(root.querySelector('[data-prx-focus-key^="seg:replays:"]')), "replays segmented in Settings");
    assert.ok(settings.contains(draw), "replay slider in Settings");
    assert.ok(settings.contains(seed), "seed input in Settings");
    assert.equal(root.querySelector(".prx-wc-draw .prx-hint").textContent, "Replay 1 of 2,000 (seed 20261029 + 1).");
  } finally { m.close(); }
});

test("1.4: paired histograms and compact key form the primary stage; league table and summary live in Data", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=top3" });
  try {
    const stage = m.root.querySelector('[data-prx-part="chart"]');
    const primary = m.root.querySelectorAll("[data-prx-primary]");
    assert.equal(primary.length, 1);
    assert.equal(primary[0], stage);
    const hists = stage.querySelector(".prx-wc-hists");
    assert.ok(hists, "histograms inside primary stage");
    assert.equal(hists.querySelectorAll("svg").length >= 2, true, "both histograms inside the primary graphic");
    const dist = stage.querySelector(".prx-wc-dist");
    assert.deepEqual(
      [...dist.children].map((n) => (n.classList.contains("prx-wc-hists") ? "hists" : n.classList.contains("prx-nl-key") ? "key" : n.className)),
      ["hists", "key"],
    );
    // Data disclosure holds the Monte Carlo summary/MCSE table and single-replay league panel
    const dataBox = m.root.querySelector('details[data-prx-disclosure="data"]');
    const sum = dataBox.querySelector(".prx-wc-sum");
    const league = dataBox.querySelector(".prx-wc-league");
    assert.ok(sum && league, "summary and league live in Data disclosure");
    assert.ok(sum.querySelector(".prx-wc-lead") && sum.querySelector("table") && sum.querySelector(".prx-wc-mcse"));
    assert.ok(league.querySelector(".prx-nl-league-chart svg"));
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

test("1.4: a new number of replays remakes the replay slider in the same slot inside Settings", async () => {
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
