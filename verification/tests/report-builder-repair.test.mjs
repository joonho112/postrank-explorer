// Review 044 repair of 2.2 report-builder (group G-E): the shared relation matrix is sized from the room its slot has
// now (G1-F4), touch drags start only after a press-and-hold or a sideways move (G1-F3), the one-line result under
// the boxes (G1-F2 in X-16), and the folded hint and counts (X-14). jsdom has no layout, so the slot's width is
// modeled as CSS would give it: its container's width, capped by its own max-width and width.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWindow, sleep } from "../dom-env.mjs";
import { createWidget } from "../../js/shared/base.js";
import { CONFIG, drawRelationMatrix, mountWidget } from "../../js/apps/report-builder.js";

test("the relation matrix is sized from the room its slot has now, not from the last drawing (G1-F4)", () => {
  const env = makeWindow();
  let handle, slot, room = 500;
  try {
    handle = createWidget(env.el, {}, {
      name: "rb-width-test", keys: { n: { type: "integer", min: 2, max: 6, value: 6 } },
      build(ctx) {
        slot = ctx.h("div");
        const legend = ctx.h("div");
        const cap = (v) => (v ? parseFloat(v) : Infinity);
        Object.defineProperty(slot, "clientWidth", { configurable: true, get: () => Math.min(room, cap(slot.style.maxWidth), cap(slot.style.width)) });
        ctx.charts.append(slot, legend);
        return { render(s) { const ids = "ABCDEF".slice(0, s.n).split(""); drawRelationMatrix(ctx, slot, legend, { n: s.n, ids, g: ids.map((_, i) => (i === 0 ? 1 : 2)) }); } };
      },
    });
    const width = () => Number(slot.querySelector("svg").getAttribute("width"));
    assert.equal(width(), 338, "six sites: 52 px cells");
    handle.update({ n: 4 });
    assert.equal(width(), 234, "four sites");
    handle.update({ n: 6 });
    assert.equal(width(), 338, "back to six sites: the four-site drawing does not cap the measurement (it gave 230)");
    room = 300;
    handle.update({ n: 5 });
    handle.update({ n: 6 });
    assert.equal(width(), 296, "a narrower slot gives smaller cells (45 px)");
    room = 500;
    handle.update({ n: 5 });
    handle.update({ n: 6 });
    assert.equal(width(), 338, "a wider slot grows the matrix again");
    assert.equal(slot.style.maxWidth, "338px");
  } finally {
    handle?.destroy();
    env.restore();
  }
});

/** A pointer event as the browser sends it (jsdom may lack PointerEvent: a MouseEvent with the pointer fields). */
function pointer(env, type, target, { x, y, pointerType = "touch", id = 7, button = 0 }) {
  const E = env.win.PointerEvent ?? env.win.MouseEvent;
  const ev = new E(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button, pointerId: id, pointerType });
  if (ev.pointerType !== pointerType) Object.defineProperty(ev, "pointerType", { value: pointerType });
  if (ev.pointerId !== id) Object.defineProperty(ev, "pointerId", { value: id });
  target.dispatchEvent(ev);
  return ev;
}

function mountBuilder(query = "") {
  const env = makeWindow({ query });
  const handle = mountWidget(env.el);
  const chip = (id) => env.el.querySelector(`.prx-rb-site[data-prx-site="${id}"]`);
  const grades = () => [...env.el.querySelectorAll(".prx-rb-box")].map((b) => `${b.getAttribute("data-prx-box")}:${[...b.querySelectorAll(".prx-rb-site")].map((c) => c.textContent).join("")}`).join(" ");
  const dragging = () => Boolean(env.el.querySelector(".prx-rb-dragging"));
  return { env, handle, chip, grades, dragging };
}

test("a touch swipe that starts on a site does not drag it; a hold or a sideways move does (G1-F3)", async () => {
  const { env, handle, chip, grades, dragging } = mountBuilder();
  try {
    const start = grades();
    assert.equal(start, "top: 1:A 2:BCDE 3:F bottom:");
    // vertical swipe: no drag; the browser takes the pan and cancels the pointer
    let c = chip("C");
    pointer(env, "pointerdown", c, { x: 100, y: 200 });
    pointer(env, "pointermove", c, { x: 101, y: 185 });
    pointer(env, "pointermove", c, { x: 102, y: 120 });
    assert.equal(dragging(), false, "a vertical move before the hold time is a scroll, not a drag");
    pointer(env, "pointercancel", c, { x: 102, y: 120 });
    await sleep(CONFIG.drag.holdMs + 60);
    assert.equal(c.classList.contains("prx-rb-held"), false, "a canceled press is not armed later");
    assert.equal(grades(), start);

    // sideways first: a drag (the drop target is the grade 3 box)
    env.doc.elementFromPoint = () => env.el.querySelector('.prx-rb-box[data-prx-box="3"]');
    c = chip("C");
    pointer(env, "pointerdown", c, { x: 100, y: 200 });
    pointer(env, "pointermove", c, { x: 106, y: 201 });
    assert.equal(dragging(), false, "6 px sideways is still a tap's wobble");
    pointer(env, "pointermove", c, { x: 113, y: 202 });
    assert.equal(dragging(), true, "13 px sideways (and 2 px down) starts the drag");
    pointer(env, "pointermove", c, { x: 120, y: 260 });
    pointer(env, "pointerup", c, { x: 120, y: 260 });
    assert.equal(grades(), "top: 1:A 2:BDE 3:CF bottom:");
    assert.match(env.el.querySelector(".prx-readout").textContent, /Site C moved to grade 3/);

    // press-and-hold, then a vertical move: a drag; while held, the page must not scroll (touchmove prevented)
    env.doc.elementFromPoint = () => env.el.querySelector('.prx-rb-box[data-prx-box="1"]');
    const b = chip("B");
    pointer(env, "pointerdown", b, { x: 60, y: 200 });
    if (env.win.TouchEvent) {
      const early = new env.win.TouchEvent("touchmove", { bubbles: true, cancelable: true });
      b.dispatchEvent(early);
      assert.equal(early.defaultPrevented, false, "before the hold the browser may scroll");
    }
    await sleep(CONFIG.drag.holdMs + 60);
    assert.equal(b.classList.contains("prx-rb-held"), true, "held still: the site shows it can be dragged");
    if (env.win.TouchEvent) {
      const held = new env.win.TouchEvent("touchmove", { bubbles: true, cancelable: true });
      b.dispatchEvent(held);
      assert.equal(held.defaultPrevented, true, "a held site owns the finger");
    }
    pointer(env, "pointermove", b, { x: 60, y: 150 });
    assert.equal(dragging(), true);
    pointer(env, "pointerup", b, { x: 60, y: 120 });
    assert.equal(grades(), "top: 1:AB 2:DE 3:CF bottom:");

    // mouse: unchanged 5 px threshold in any direction
    env.doc.elementFromPoint = () => env.el.querySelector('.prx-rb-box[data-prx-box="2"]');
    const f = chip("F");
    pointer(env, "pointerdown", f, { x: 300, y: 300, pointerType: "mouse", id: 1 });
    pointer(env, "pointermove", f, { x: 300, y: 303, pointerType: "mouse", id: 1 });
    assert.equal(dragging(), false);
    pointer(env, "pointermove", f, { x: 300, y: 306, pointerType: "mouse", id: 1 });
    assert.equal(dragging(), true, "a mouse drag starts after 5 px, also vertically");
    pointer(env, "pointerup", f, { x: 300, y: 250, pointerType: "mouse", id: 1 });
    assert.equal(grades(), "top: 1:AB 2:DEF 3:C bottom:");
  } finally {
    handle.destroy();
    env.restore();
  }
});

test("the one-line result under the boxes carries N of M, the change, the share, the withheld pairs and the grades", () => {
  const { env, handle, chip } = mountBuilder();
  try {
    const result = () => env.el.querySelector(".prx-rb-builder .prx-rb-boxes + .prx-rb-result");
    const hook = (name) => result().querySelector(`[data-prx-readout="${name}"]`)?.getAttribute("data-num");
    assert.equal(result().textContent.replace(/\s+/g, " ").trim(), "9 of 15 pairs stated, share .600; 6 withheld; 3 grades.");
    assert.deepEqual(["result-N", "result-M", "result-share", "result-withheld", "result-G"].map(hook), ["9", "15", "0.6", "6", "3"]);
    assert.equal(hook("result-change"), undefined, "no change shown before a move");
    // a move by number key: B into grade 1 states 2 more pairs
    chip("B").dispatchEvent(new env.win.KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true }));
    assert.equal(result().textContent.replace(/\s+/g, " ").trim(), "11 of 15 pairs stated (+2), share .733; 4 withheld; 3 grades.");
    assert.equal(hook("result-change"), "2");
    // a preset clears the change, as it clears the outlines
    handle.applyPreset("four-units");
    assert.equal(result().textContent.replace(/\s+/g, " ").trim(), "3 of 6 pairs stated, share .500; 3 withheld; 2 grades.");
    handle.update({ grades: [1, 1, 1, 1] });
    assert.match(result().textContent, /; 1 grade\.$/);
  } finally {
    handle.destroy();
    env.restore();
  }
});

test("the full hint and the counts are folded, complete, into closed boxes (X-14)", () => {
  const { env, handle } = mountBuilder("?open=counts");
  try {
    const boxes = env.el.querySelector(".prx-rb-boxes");
    const keys = env.el.querySelector('details[data-prx-disclosure="keyboard"]');
    const counts = env.el.querySelector('details[data-prx-disclosure="counts"]');
    assert.equal(keys.open, false);
    assert.equal(counts.open, true, "?open=counts opens the counts box");
    const described = env.doc.getElementById(boxes.getAttribute("aria-describedby"));
    assert.ok(keys.contains(described), "the full hint stays the list's description, inside the box");
    assert.match(described.textContent, /Escape puts it back/);
    for (const sel of [".prx-rb-tiles", ".prx-rb-rule", ".prx-rb-inside table", ".prx-rb-vector", ".prx-rb-side"]) assert.ok(counts.querySelector(sel), sel);
    assert.equal(counts.querySelectorAll(".prx-rb-inside tbody tr").length, 4, "three grades and the total");
    assert.ok(env.el.querySelector('.prx-rb-orientation[data-prx-part="notes"]'), "the orientation line is plain text, not a legend panel");
  } finally {
    handle.destroy();
    env.restore();
  }
});
