// result-first-frame.test.mjs (review 044 repair, Phase 2): the shared result-first frame, disclosures, the tie
// qualifier of result tags and the pointer/touch reading of keyboard figures. Every new behavior is opt-in, so the
// classic frame must stay exactly as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWidget } from "../../js/shared/base.js";
import { tagNode, tieNode } from "../../js/shared/labels.js";
import { plot } from "../../js/shared/chart.js";
import { makeWindow, sleep } from "../dom-env.mjs";

const PRESETS = [{ id: "low", label: "Low", query: "v=1" }, { id: "high", label: "High", query: "v=5" }];
const parts = (root) => [...root.children].map((n) => n.getAttribute("data-prx-part") ?? n.tagName.toLowerCase());

function mount(env, def) {
  return createWidget(env.el, {}, { name: "frame-test", bridge: false, presets: PRESETS, keys: { v: { type: "integer", min: 0, max: 9, value: 3 } }, ...def });
}

test("classic layout is unchanged: controls, charts, read-out, caption; no layout attribute", () => {
  const env = makeWindow({ plot: false });
  const h = mount(env, { build(ctx) { ctx.controls.append(ctx.h("span", { text: "control" })); return { render(s) { ctx.readout.set(["v ", String(s.v)]); } }; } });
  try {
    assert.deepEqual(parts(h.root), ["controls", "chart", "readout", "caption"]);
    assert.equal(h.root.hasAttribute("data-prx-layout"), false);
    assert.equal(h.root.querySelector("[data-prx-part=disclosures]"), null, "no disclosure group unless an app asks for one");
  } finally { h.destroy(); env.restore(); }
});

test("result-first puts the read-out directly under the controls and marks the root", () => {
  const env = makeWindow({ plot: false });
  const h = mount(env, { layout: "result-first", build(ctx) { ctx.charts.append(ctx.h("div", { text: "figure" })); return { render(s) { ctx.readout.set(["v ", String(s.v)]); } }; } });
  try {
    assert.equal(h.root.getAttribute("data-prx-layout"), "result-first");
    assert.deepEqual(parts(h.root), ["controls", "readout", "chart", "caption"]);
    assert.equal(h.root.querySelector(".prx-readout").textContent, "v 3");
    h.applyPreset("high");
    assert.equal(h.root.querySelector(".prx-readout").textContent, "v 5", "presets and the read-out work as before");
    assert.equal(h.root.querySelector("[data-prx-part=presets]").parentNode, h.root.querySelector("[data-prx-part=controls]"));
  } finally { h.destroy(); env.restore(); }
});

test("an unknown layout falls back to classic", () => {
  const env = makeWindow({ plot: false });
  const h = mount(env, { layout: "sideways", build() { return { render() {} }; } });
  try { assert.deepEqual(parts(h.root), ["controls", "chart", "readout", "caption"]); } finally { h.destroy(); env.restore(); }
});

test("end disclosures: one group between the charts and the caption, closed, complete, re-rendered when opened", async () => {
  const env = makeWindow({ plot: false });
  const reasons = [];
  let data, method;
  const h = mount(env, {
    layout: "result-first",
    build(ctx) {
      data = ctx.disclosure({ name: "data", title: "Data and exact values" });
      method = ctx.disclosure({ name: "method", title: "Method and scope" });
      const table = ctx.h("table", {}, ctx.h("tbody", {}, ...Array.from({ length: 12 }, (_, i) => ctx.h("tr", {}, ctx.h("td", { text: `row ${i + 1}` })))));
      data.body.append(table);
      method.body.append(ctx.h("p", { text: "How the numbers are computed." }));
      return { render(s, info) { reasons.push(info.reason); ctx.readout.set(["v ", String(s.v)]); } };
    },
  });
  try {
    assert.deepEqual(parts(h.root), ["controls", "readout", "chart", "disclosures", "caption"]);
    const group = h.root.querySelector("[data-prx-part=disclosures]");
    assert.equal(group.children.length, 2, "both boxes share one group");
    assert.equal(data.root.tagName.toLowerCase(), "details");
    assert.equal(data.root.open, false, "closed by default");
    assert.equal(data.root.getAttribute("data-prx-disclosure"), "data");
    assert.equal(data.summary.textContent, "Data and exact values");
    assert.equal(data.body.querySelectorAll("tr").length, 12, "content complete while closed");
    const before = reasons.length;
    data.open = true;
    data.root.dispatchEvent(new env.win.Event("toggle"));
    await sleep(0);
    assert.ok(reasons.length >= before + 1, "opening renders once more");
    assert.equal(reasons.at(-1), "disclosure");
    h.update({ v: 7 });
    assert.equal(data.root.open, true, "an update keeps the box open");
    assert.equal(data.body.querySelectorAll("tr").length, 12);
  } finally { h.destroy(); env.restore(); }
});

test("a controls disclosure (Settings) sits in the controls row before the preset row", () => {
  const env = makeWindow({ plot: false });
  let settings;
  const h = mount(env, {
    layout: "result-first",
    build(ctx) {
      ctx.controls.append(ctx.h("span", { class: "primary", text: "primary control" }));
      settings = ctx.disclosure({ name: "settings", title: "Settings", placement: "controls" });
      settings.body.append(ctx.h("span", { text: "seed" }));
      return { render(s) { ctx.readout.set(String(s.v)); } };
    },
  });
  try {
    const controls = h.root.querySelector("[data-prx-part=controls]");
    const kids = [...controls.children];
    assert.equal(kids[0].className, "primary");
    assert.equal(kids[1], settings.root);
    assert.equal(kids[2].getAttribute("data-prx-part"), "presets");
    assert.equal(settings.root.getAttribute("data-prx-placement"), "controls");
    assert.equal(h.root.querySelector("[data-prx-part=disclosures]"), null, "a controls box makes no end group");
  } finally { h.destroy(); env.restore(); }
});

test("tagNode ties: opt-in qualifier with the engine's tieCount as data-num; unchanged without the option", () => {
  const env = makeWindow({ plot: false });
  try {
    const result = { label: "exact-within-family", family: { name: "𝒜₆", words: "all reports", size: 4683 }, tieCount: 3 };
    const plain = tagNode(env.doc, result);
    assert.equal(plain.textContent, "best of all 4,683 reports");
    const tied = tagNode(env.doc, result, { ties: true });
    assert.equal(tied.textContent, "best of all 4,683 reports (one of 3 equal-risk best reports; showing the first)");
    assert.equal(tied.querySelector(".prx-result-ties [data-num]").getAttribute("data-num"), "3");
    assert.equal(tagNode(env.doc, { ...result, tieCount: 1 }, { ties: true }).textContent, "best of all 4,683 reports", "one best report: no qualifier");
    assert.equal(tieNode(env.doc, { tieCount: 0 }), null);
    assert.equal(tieNode(env.doc, result, { lead: false, showing: "" }).textContent, "one of 3 equal-risk best reports");
  } finally { env.restore(); }
});

test("tagNode uses singular family wording and keeps the exact singleton count", () => {
  const env = makeWindow({ plot: false });
  try {
    const family = { name: "𝒜_≤1", words: "reports with at most 1 grade that meet the error budgets E_k ≤ q_k N", sizeExact: 1n, budgets: [0, null] };
    for (const [label, words, expected] of [
      ["exact-within-family", family.words, "only 1 report with at most 1 grade that meets the error budget"],
      ["exact-within-family", "all reports on 1 unit", "only 1 report"],
      ["optimal-within-order", "contiguous cuts of the declared order", "best along one order (1 report)"],
    ]) {
      const tag = tagNode(env.doc, { label, family: { ...family, words } });
      assert.equal(tag.textContent, expected);
      assert.equal(tag.querySelector("[data-prx-family-size]").dataset.num, "1");
    }
  } finally { env.restore(); }
});

test("keyboard.pointer: hover shows the keyboard text, a click selects and calls onSelect, touch moves are ignored", async () => {
  const env = makeWindow({});
  const host = env.doc.createElement("div");
  host.style.width = "600px";
  env.el.append(host);
  const data = [{ id: "A", x: 1, y: 1 }, { id: "B", x: 2, y: 3 }, { id: "C", x: 3, y: 2 }];
  const selected = [];
  const focused = [];
  try {
    const P = env.win.Plot;
    const chart = plot(host, {
      alt: "three points", width: 600, height: 300, x: { domain: [0, 4] }, y: { domain: [0, 4] },
      marks: () => [P.dot(data, { x: "x", y: "y" })],
      keyboard: { data, x: "x", y: "y", title: (d) => `${d.id}: ${d.x}, ${d.y}`, pointer: true, onSelect: (d) => selected.push(d.id), onFocus: (d) => focused.push(d.id) },
    });
    const area = chart.area;
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300 });
    const sx = chart.scale("x"), sy = chart.scale("y");
    const at = (d) => ({ clientX: sx.apply(d.x), clientY: sy.apply(d.y), bubbles: true });
    const tip = host.querySelector(".prx-kbd-tip");
    area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("pointermove", at(data[1])));
    assert.equal(tip.hidden, false);
    assert.equal(tip.textContent, "B: 2, 3", "hover text equals the keyboard reader's text");
    const touch = new env.win.MouseEvent("pointermove", at(data[2]));
    Object.defineProperty(touch, "pointerType", { value: "touch" });
    area.querySelector("svg").dispatchEvent(touch);
    assert.equal(tip.textContent, "B: 2, 3", "a touch move (a scroll) does not read points");
    area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("click", { ...at(data[2]), detail: 1 }));  // a mouse click has detail 1
    assert.deepEqual(selected, ["C"]);
    assert.deepEqual(focused, ["C"], "a click selects the point like keyboard focus");
    assert.equal(tip.textContent, "C: 3, 2");
    area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("pointermove", { clientX: 590, clientY: 5, bubbles: true }));
    assert.equal(tip.textContent, "C: 3, 2", "away from every point, the pinned point's tip stays");
    await sleep(0);
  } finally { env.restore(); }
});

test("without keyboard.pointer a figure ignores the pointer, as before", () => {
  const env = makeWindow({});
  const host = env.doc.createElement("div");
  env.el.append(host);
  const data = [{ id: "A", x: 1, y: 1 }];
  try {
    const P = env.win.Plot;
    const chart = plot(host, { alt: "one point", width: 300, height: 200, marks: () => [P.dot(data, { x: "x", y: "y" })], keyboard: { data, x: "x", y: "y", title: (d) => d.id } });
    chart.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 });
    chart.area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("pointermove", { clientX: chart.scale("x").apply(1), clientY: chart.scale("y").apply(1), bubbles: true }));
    assert.equal(host.querySelector(".prx-kbd-tip").hidden, true);
  } finally { env.restore(); }
});

test("a disclosure can sit next to its panel ({ after } / { before }), and opening it names it to render", async () => {
  const env = makeWindow({ plot: false });
  const infos = [];
  let near, after, before;
  const h = mount(env, {
    layout: "result-first",
    build(ctx) {
      near = ctx.h("div", { class: "panel" });
      ctx.charts.append(near);
      after = ctx.disclosure({ name: "card-source", title: "Card source", placement: { after: near } });
      before = ctx.disclosure({ name: "note", title: "Note", placement: { before: near } });
      return { render(s, info) { infos.push(info); ctx.readout.set(String(s.v)); } };
    },
  });
  try {
    assert.equal(near.nextElementSibling, after.root);
    assert.equal(near.previousElementSibling, before.root);
    assert.equal(h.root.querySelector("[data-prx-part=disclosures]"), null, "boxes next to a panel make no end group");
    after.open = true;
    after.root.dispatchEvent(new env.win.Event("toggle"));
    await sleep(0);
    assert.equal(infos.at(-1).reason, "disclosure");
    assert.equal(infos.at(-1).disclosure, "card-source");
  } finally { h.destroy(); env.restore(); }
});

test("result-first with seven or more presets asks for two preset lines on phones; fewer stay one line", () => {
  const env = makeWindow({ plot: false });
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, query: `v=${i}` }));
  const h1 = createWidget(env.el, {}, { name: "frame-test", bridge: false, layout: "result-first", presets: many, keys: { v: { type: "integer", min: 0, max: 9, value: 3 } }, build() { return { render() {} }; } });
  try { assert.equal(h1.root.querySelector("[data-prx-part=presets]").getAttribute("data-prx-preset-rows"), "2"); } finally { h1.destroy(); }
  const h2 = mount(env, { layout: "result-first", build() { return { render() {} }; } });
  try { assert.equal(h2.root.querySelector("[data-prx-part=presets]").hasAttribute("data-prx-preset-rows"), false); } finally { h2.destroy(); env.restore(); }
});

test("primaryGraphic marks the graphic the primary control changes", () => {
  const env = makeWindow({ plot: false });
  let fig;
  const h = mount(env, { layout: "result-first", build(ctx) { fig = ctx.primaryGraphic(ctx.h("div")); ctx.charts.append(fig); return { render() {} }; } });
  try { assert.equal(fig.hasAttribute("data-prx-primary"), true); } finally { h.destroy(); env.restore(); }
});

test("partBar: widths from the counts, every count a hooked data-num, a sliver for a single pair, aria-hidden track", async () => {
  const { partBar } = await import("../../js/shared/partbar.js");
  const env = makeWindow({ plot: false });
  let bar;
  const h = mount(env, {
    layout: "result-first",
    build(ctx) {
      bar = partBar(ctx, { hook: "pairs", parts: [{ key: "agree", role: "agree" }, { key: "against", role: "against" }, { key: "silent", role: "silent" }] });
      ctx.charts.append(bar.root);
      return { render() {
        bar.set({ title: (total) => ["All ", total(), " pairs"], total: 4656, counts: { agree: 730, against: 1, silent: 3925 },
          words: { agree: " stated as the table does", against: " stated the other way", silent: " silent" } });
      } };
    },
  });
  try {
    const root = bar.root;
    assert.equal(root.querySelector(".prx-partbar-track").getAttribute("aria-hidden"), "true");
    assert.equal(root.querySelector('[data-prx-readout="pairs-all"]').getAttribute("data-num"), "4656");
    assert.equal(root.querySelector('[data-prx-readout="pairs-against"]').textContent, "1");
    const segs = [...root.querySelectorAll(".prx-partbar-seg")];
    assert.equal(segs[1].classList.contains("prx-partbar-some"), true, "a single pair keeps a sliver");
    assert.match(segs[0].style.width, /^15\.67/);
    assert.equal(root.querySelector(".prx-partbar-title").textContent, "All 4,656 pairs");
    assert.equal(root.querySelectorAll(".prx-partbar-key").length, 3);
  } finally { h.destroy(); env.restore(); }
});

test("keyboard.pointer ignores a keyboard-generated click (no pointer position)", () => {
  const env = makeWindow({});
  const host = env.doc.createElement("div");
  env.el.append(host);
  const data = [{ id: "A", x: 1, y: 1 }, { id: "B", x: 3, y: 3 }];
  const selected = [];
  try {
    const P = env.win.Plot;
    const chart = plot(host, { alt: "two points", width: 400, height: 300, x: { domain: [0, 4] }, y: { domain: [0, 4] }, marks: () => [P.dot(data, { x: "x", y: "y" })],
      keyboard: { data, x: "x", y: "y", title: (d) => d.id, pointer: true, onSelect: (d) => selected.push(d.id) } });
    chart.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 });
    chart.area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("click", { clientX: 0, clientY: 0, detail: 0, bubbles: true }));
    assert.deepEqual(selected, [], "a click with detail 0 selects nothing");
    chart.area.querySelector("svg").dispatchEvent(new env.win.MouseEvent("click", { clientX: chart.scale("x").apply(3), clientY: chart.scale("y").apply(3), detail: 1, bubbles: true }));
    assert.deepEqual(selected, ["B"]);
  } finally { env.restore(); }
});

test("?open=name opens the named disclosures at mount, and an { open } update opens them later", () => {
  const env = makeWindow({ plot: false, query: "?open=data" });
  let data, method;
  const h = mount(env, { layout: "result-first", build(ctx) {
    data = ctx.disclosure({ name: "data", title: "Data and exact values" });
    method = ctx.disclosure({ name: "method", title: "Method and scope" });
    return { render() {} };
  } });
  try {
    assert.equal(data.open, true, "opened by the URL");
    assert.equal(method.open, false);
    h.update({ open: ["method"] });
    assert.equal(method.open, true, "opened by a message");
    assert.deepEqual(Object.keys(h.state), ["v"], "open is never part of the state");
  } finally { h.destroy(); env.restore(); }
});

test("primaryControl marks the control that moves the primary graphic", () => {
  const env = makeWindow({ plot: false });
  let ctl;
  const h = mount(env, { layout: "result-first", build(ctx) { ctl = ctx.primaryControl(ctx.h("button", { text: "Draw" })); ctx.controls.append(ctl); return { render() {} }; } });
  try { assert.equal(ctl.hasAttribute("data-prx-primary-control"), true); } finally { h.destroy(); env.restore(); }
});

test("afterPresets puts mode-dependent controls behind the preset row", () => {
  const env = makeWindow({ plot: false });
  let modeSet, primary;
  const h = mount(env, { layout: "result-first", build(ctx) {
    primary = ctx.h("span", { class: "primary", text: "switch" });
    ctx.controls.append(primary);
    modeSet = ctx.afterPresets(ctx.h("fieldset", { class: "mode-set" }));
    return { render() {} };
  } });
  try {
    const kids = [...h.root.querySelector("[data-prx-part=controls]").children];
    assert.deepEqual(kids.map((n) => n.getAttribute("data-prx-part") ?? n.className), ["primary", "presets", "mode-set"]);
    assert.equal(kids[2], modeSet);
  } finally { h.destroy(); env.restore(); }
});
