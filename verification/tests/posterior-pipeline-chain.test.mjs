// posterior-pipeline-chain.test.mjs (review 044 repair, U2-F2 and X-12; Phase 3 fix round A1-1, A1-2, B-F3, B-F4): app
// 1.7 is one linked chain whose box headers are its four stages. The read-out cases
// (verification/readouts/posterior-pipeline.json) check what the app shows at a setting; these checks cover what they
// cannot script: a box header opens the closed box of the four texts first and then changes the open box (so the live
// part changes while it can be announced), the box holds all four texts with the open one first and marked, only a
// pointer click scrolls the open text into view (when it is below the viewport), box 3's "See also" link opens the
// routes box, a preset opens no box, the chain is a row only where the row's CSS query also holds, and the tie
// qualifier next to the best report's chips appears only while several reports tie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const APP = "js/apps/posterior-pipeline.js";
const ROW_QUERY = "(min-width: 57.5em)";
const box = (root, name) => root.querySelector(`details[data-prx-disclosure="${name}"]`);
const pressed = (root) => [...root.querySelectorAll(".prx-pp-box")].map((b) => b.getAttribute("aria-pressed") === "true");
// a header press waits two animation frames once the box opens (jsdom's are timers of about 16 ms)
const frames = (win) => new Promise((r) => win.setTimeout(r, 90));
const liveTitle = (root) => root.querySelector("[data-prx-part~='readout'] .prx-pp-title").textContent;

test("1.7: the result-first order, the chain as the primary graphic, its four headers and the two closed boxes", async () => {
  const m = await mountCase({ module: APP });
  try {
    const order = [...m.root.children].map((n) => n.getAttribute("data-prx-part"));
    assert.deepEqual(order, ["controls", "readout", "chart", "disclosures", "caption"]);
    assert.equal(m.root.getAttribute("data-prx-layout"), "result-first");
    const flow = m.root.querySelector(".prx-pp-flow");
    assert.ok(flow.hasAttribute("data-prx-primary"), "the chain's row of stages is the primary graphic");
    const stages = [...flow.querySelectorAll(":scope > .prx-pp-stage")];
    assert.equal(stages.length, 4);
    stages.forEach((s, i) => assert.equal(s.querySelector(":scope > .prx-pp-box")?.getAttribute("data-prx-box"), String(i + 1), `stage ${i + 1} is headed by box ${i + 1}`));
    assert.equal(flow.querySelectorAll(":scope > .prx-pp-arrow").length, 3, "one set of three arrows");
    assert.equal(m.root.querySelector(".prx-presets .prx-seg-label")?.textContent, "Worked settings (set every slider)");
    for (const name of ["boxes", "routes"]) assert.equal(box(m.root, name)?.open, false, `${name} starts closed`);
    assert.ok(box(m.root, "boxes").querySelector(".prx-pp-panel .prx-pp-live"), "the panel of the open box is inside the first box");
    assert.ok(box(m.root, "routes").querySelector(".prx-pp-routes table"), "the routes table is inside the second box");
  } finally { m.close(); }
});

test("1.7: a header press opens the box of the four texts first, then changes the open box (B-F4); the box holds all four texts, the open one first and marked (A1-1)", async () => {
  const m = await mountCase({ module: APP });
  try {
    const details = box(m.root, "boxes");
    m.root.querySelector(".prx-pp-box[data-prx-box='3']").click();
    assert.equal(details.open, true, "the box opens at once");
    assert.equal(liveTitle(m.root), "Box 1: Data", "the live part has not changed yet: it changes once the open box is drawn");
    assert.equal(m.handle.state.box, 1);
    await frames(m.win);
    await settle(m.win, m.el);
    assert.equal(m.handle.state.box, 3);
    assert.deepEqual(pressed(m.root), [false, false, true, false]);
    assert.ok(m.root.querySelector("[data-prx-stage='3']").hasAttribute("data-open"), "the stage is outlined");
    assert.equal(liveTitle(m.root), "Box 3: Posterior");
    const panel = details.querySelector(".prx-pp-panel");
    assert.equal(panel.getAttribute("aria-current"), "true", "the open box's text is marked");
    assert.equal(panel.getAttribute("data-prx-box-text"), "3");
    assert.deepEqual([...details.querySelectorAll(".prx-pp-others > .prx-pp-other")].map((n) => n.getAttribute("data-prx-box-text")), ["1", "2", "4"],
      "then the other boxes in box order");
    // every box's text is in the box once: four headings, four "Who makes this box", four examples and sources, box 3's "See also"
    for (const [sel, n] of [[".prx-pp-title", 4], [".prx-pp-what", 4], [".prx-pp-who", 4], [".prx-pp-example", 4], [".prx-pp-source", 4], [".prx-pp-more", 1]]) {
      assert.equal(details.querySelectorAll(sel).length, n, sel);
    }
    assert.deepEqual([...details.querySelectorAll(".prx-pp-title")].map((t) => t.textContent), ["Box 3: Posterior", "Box 1: Data", "Box 2: Model", "Box 4: Decision"]);
    assert.equal(details.querySelectorAll("[aria-live]").length, 1, "one live part, the open box's");
    // with the box open, a press changes the open box at once (its live part is in the accessibility tree)
    m.root.querySelector(".prx-pp-box[data-prx-box='2']").click();
    assert.equal(m.handle.state.box, 2);
    assert.equal(liveTitle(m.root), "Box 2: Model");
    // a later press wins over a press still waiting for the box to be drawn
    details.open = false;
    m.root.querySelector(".prx-pp-box[data-prx-box='4']").click();
    m.root.querySelector(".prx-pp-box[data-prx-box='1']").click();
    await frames(m.win);
    await settle(m.win, m.el);
    assert.equal(m.handle.state.box, 1);
    // a preset sets the keys; it opens no closed box
    details.open = false;
    m.handle.applyPreset("decision");
    await settle(m.win, m.el);
    assert.equal(m.handle.state.box, 4);
    assert.deepEqual(pressed(m.root), [false, false, false, true]);
    assert.equal(details.open, false, "a preset is a setting of the keys; it opens no closed box");
  } finally { m.close(); }
});

test("1.7: only a pointer click scrolls the open box's text into view, and only when it is below the viewport (A1-2)", async () => {
  const m = await mountCase({ module: APP });
  try {
    const panel = box(m.root, "boxes").querySelector(".prx-pp-panel");
    const calls = [];
    panel.scrollIntoView = (options) => calls.push(options);
    let bottom = m.win.innerHeight + 300;
    panel.getBoundingClientRect = () => ({ top: bottom - 250, bottom, left: 0, right: 0, width: 0, height: 250 });
    const click = (k, detail) => m.root.querySelector(`.prx-pp-box[data-prx-box='${k}']`)
      .dispatchEvent(new m.win.MouseEvent("click", { bubbles: true, cancelable: true, detail }));
    click(2, 0); // Enter or Space on the header: a click with detail 0
    await frames(m.win);
    await settle(m.win, m.el);
    assert.equal(m.handle.state.box, 2);
    assert.equal(calls.length, 0, "no scroll after a keyboard press");
    click(3, 1); // a pointer's click
    await frames(m.win);
    assert.equal(m.handle.state.box, 3);
    assert.deepEqual(calls.map((o) => o.block), ["nearest"], "a pointer click below the viewport scrolls by the least amount");
    bottom = 400; // the open text is already in view
    click(4, 1);
    await frames(m.win);
    assert.equal(m.handle.state.box, 4);
    assert.equal(calls.length, 1, "no scroll when the text is in view");
    bottom = m.win.innerHeight + 300;
    m.handle.applyPreset("model");
    await frames(m.win);
    assert.equal(m.handle.state.box, 2);
    assert.equal(calls.length, 1, "a preset never scrolls");
  } finally { m.close(); }
});

test("1.7: box 3's See also link opens the closed box of the routes table", async () => {
  const m = await mountCase({ module: APP, query: "?box=3" });
  try {
    const link = m.root.querySelector(".prx-pp-panel .prx-pp-more a[href^='#']");
    assert.ok(link, "box 3's see-also line links the routes table");
    const target = m.doc.getElementById(link.getAttribute("href").slice(1));
    assert.ok(target && box(m.root, "routes").contains(target), "the link points into the routes box");
    assert.equal(box(m.root, "routes").open, false);
    link.dispatchEvent(new m.win.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(box(m.root, "routes").open, true);
  } finally { m.close(); }
});

test("1.7: the chain is a row only when the app is wide enough and the viewport meets the row's CSS query (B-F3)", async () => {
  const m = await mountCase({ module: APP });
  try {
    const chain = () => m.root.getAttribute("data-prx-pp-chain");
    assert.equal(chain(), "column", "jsdom's default width (640 px)");
    m.env.ro.fire(990);
    assert.equal(chain(), "column", "an app 990 px wide whose viewport fails the row's query keeps one column, as its CSS does");
    assert.ok(m.root.hasAttribute("data-prx-pp-split"), "with each stage's figure beside its numbers");
    m.env.media.set(ROW_QUERY, true);
    assert.equal(chain(), "row", "the viewport now meets the query: the stages sit in one row");
    assert.equal(m.root.hasAttribute("data-prx-pp-split"), false);
    m.env.ro.fire(860);
    assert.equal(chain(), "column", "narrower than CONFIG.chainRowMinWidth (880 px)");
  } finally { m.close(); }
});

test("1.7: the tie qualifier sits next to the best report's chips only while several reports tie (X-12)", async () => {
  const tie = await mountCase({ module: APP, query: "?estA=.20&seA=.10&estB=.20&seB=.10&tau=.50" });
  try {
    const q = tie.root.querySelector("[data-prx-readout='report'] ~ .prx-result-tag .prx-result-ties");
    assert.ok(q, "a tie qualifier in the line under the chips");
    assert.equal(q.getAttribute("data-prx-ties"), "3");
    assert.equal(q.querySelector("[data-num]")?.getAttribute("data-num"), "3");
    assert.match(tie.root.querySelector(".prx-readout").textContent, /3 reports share the smallest risk \(equal-risk tolerance/);
  } finally { tie.close(); }
  const one = await mountCase({ module: APP, query: "?preset=decision" });
  try {
    assert.equal(one.root.querySelector(".prx-result-ties"), null, "no qualifier with one best report");
    assert.equal(one.root.querySelector("[data-prx-readout='report']").parentElement.textContent, "{A} > {B}, best of all 3 reports");
  } finally { one.close(); }
});
