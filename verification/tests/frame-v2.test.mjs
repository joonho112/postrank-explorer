// Unit tests for Step 5.5: App Frame v2 (def.frame = "v2") and base.js core lifecycle, focus, slider, input, and stage fixes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  createScope,
  createWidget,
  keepFocus,
  numberInput,
  slider,
  snapToKeyGrid,
  tabOrder,
} from "../../js/shared/base.js";
import { VISUAL_CSS } from "../../js/shared/mdomain/visual.js";

const require = createRequire(new URL("../../tools/package.json", import.meta.url));
const { JSDOM } = require("jsdom");

function makeDom(query = "", extraBody = "") {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>${extraBody}<div id="app"><p>fallback</p></div></body></html>`,
    { url: `https://example.test/embed/toy.html${query}`, pretendToBeVisual: true },
  );
  const win = dom.window;
  const doc = win.document;
  const el = doc.getElementById("app");
  return { dom, win, doc, el, close: () => win.close() };
}

const wait = (win, ms = 0) => new Promise((resolve) => win.setTimeout(resolve, ms));

const PRESETS = [
  { id: "low", label: "Low", query: "tau=.05" },
  { id: "mid", label: "Middle", query: "tau=.20" },
  { id: "high", label: "High", query: "tau=.45" },
];

test("frame: v2 creates base-owned slots in reading order before build(ctx) and marks root", () => {
  const env = makeDom();
  let buildSnapshot = null;
  const handle = createWidget(env.el, {}, {
    name: "v2-order-test",
    frame: "v2",
    title: "Widget Heading",
    firstPreset: "high",
    bridge: false,
    presets: PRESETS,
    keys: { tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 } },
    build(ctx) {
      buildSnapshot = {
        presetsInBuild: ctx.presets !== null,
        stageEqualsCharts: ctx.stage === ctx.charts,
        stagePrimary: ctx.stage.hasAttribute("data-prx-primary"),
        presetOrder: [...ctx.presets.querySelectorAll("button.prx-seg")].map((b) => b.dataset.value),
      };
      const sl = ctx.slider({ label: "τ", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      ctx.controls.append(sl.root);
      // Call methodBox BEFORE dataBox to verify dataBox still precedes methodBox in DOM.
      const method = ctx.methodBox();
      const data = ctx.dataBox();
      const settings = ctx.settingsBox();
      settings.body.append(ctx.h("span", { text: "secondary control" }));
      data.body.append(ctx.h("p", { text: "exact values" }));
      method.body.append(ctx.h("p", { text: "derivation" }));
      return {
        render(state) {
          sl.set(state.tau);
          ctx.readout.set(`tau=${state.tau}`);
        },
      };
    },
  });

  try {
    assert.deepEqual(buildSnapshot, {
      presetsInBuild: true,
      stageEqualsCharts: true,
      stagePrimary: true,
      presetOrder: ["high", "low", "mid"],
    });
    assert.equal(handle.root.getAttribute("data-prx-frame"), "v2");
    assert.equal(handle.root.getAttribute("data-prx-layout"), "v2");

    const topParts = [...handle.root.children].map((n) => n.getAttribute("data-prx-part"));
    assert.deepEqual(topParts, ["title", "toolbar", "readout", "chart", "scope", "disclosures", "caption"]);

    const toolbar = handle.root.querySelector('[data-prx-part="toolbar"]');
    const toolbarKids = [...toolbar.children].map((n) => n.getAttribute("data-prx-part") ?? n.getAttribute("data-prx-disclosure"));
    assert.deepEqual(toolbarKids, ["controls", "presets", "settings"]);

    const settingsEl = toolbar.querySelector('details[data-prx-disclosure="settings"]');
    assert.equal(settingsEl.getAttribute("data-prx-placement"), "controls");
    assert.equal(settingsEl.open, false);

    const scopeEl = handle.root.querySelector('[data-prx-part="scope"]');
    assert.equal(scopeEl.hidden, true, "empty scope line stays hidden");

    const discGroup = handle.root.querySelector('[data-prx-part="disclosures"]');
    assert.deepEqual(
      [...discGroup.children].map((n) => n.getAttribute("data-prx-disclosure")),
      ["data", "method"],
    );
    assert.equal(discGroup.children[0].querySelector("summary").textContent, "Data and exact values");
    assert.equal(discGroup.children[1].querySelector("summary").textContent, "Method and details");
  } finally {
    handle.destroy();
    env.close();
  }
});

test("ctx.setScope toggles scopeLine visibility and ?hide=title hides titles but never credit (S2-03)", () => {
  const env = makeDom(
    "?hide=title,credit",
    '<h1 class="prx-embed-title">Embed Heading</h1><p class="prx-credit">Author and license notice</p>',
  );
  let setScopeFn;
  const handle = createWidget(env.el, {}, {
    name: "v2-hide-test",
    layout: "v2",
    title: "Inner Title",
    bridge: false,
    keys: { x: { type: "integer", min: 0, max: 5, value: 1 } },
    build(ctx) {
      setScopeFn = ctx.setScope;
      return { render() { ctx.readout.set("ok"); } };
    },
  });

  try {
    assert.equal(handle.root.querySelector(".prx-title").hidden, true, "widget title hidden by ?hide=title");
    assert.equal(env.doc.querySelector(".prx-embed-title").hidden, true, "embed title hidden by ?hide=title");
    assert.equal(env.doc.querySelector(".prx-credit").hidden, false, "credit is never hidden even if ?hide=credit is passed");

    const scopeEl = handle.root.querySelector('[data-prx-part="scope"]');
    assert.equal(scopeEl.hidden, true);
    setScopeFn(["Scope: 6 benchmark units"]);
    assert.equal(scopeEl.hidden, false);
    assert.equal(scopeEl.textContent, "Scope: 6 benchmark units");
    setScopeFn([]);
    assert.equal(scopeEl.hidden, true);
  } finally {
    handle.destroy();
    assert.equal(env.doc.querySelector(".prx-embed-title").hidden, false, "embed title restored on destroy");
    env.close();
  }
});

test("ctx.presets is already non-null inside build(ctx) in classic and result-first while preserving DOM order", () => {
  for (const layout of ["classic", "result-first"]) {
    const env = makeDom();
    let presetsDuringBuild = null;
    const handle = createWidget(env.el, {}, {
      name: `presets-${layout}`,
      layout,
      bridge: false,
      presets: PRESETS,
      keys: { tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 } },
      build(ctx) {
        presetsDuringBuild = ctx.presets;
        ctx.controls.append(ctx.h("button", { class: "primary-btn", text: "Go" }));
        return { render() {} };
      },
    });
    try {
      assert.ok(presetsDuringBuild, `ctx.presets is non-null during build in ${layout}`);
      const controlsKids = [...handle.root.querySelector('[data-prx-part="controls"]').children];
      assert.equal(controlsKids[0].className, "primary-btn");
      assert.equal(controlsKids[1], presetsDuringBuild);
    } finally {
      handle.destroy();
      env.close();
    }
  }
});

test("keepFocus restores focus when lost on redraw, and respects deliberate focus moves inside root", () => {
  const env = makeDom();
  const root = env.doc.createElement("div");
  env.el.replaceChildren(root);

  const makeButtons = () => {
    const a = env.doc.createElement("button");
    a.setAttribute("data-prx-focus-key", "btn:a");
    a.textContent = "A";
    const b = env.doc.createElement("button");
    b.setAttribute("data-prx-focus-key", "btn:b");
    b.textContent = "B";
    root.replaceChildren(a, b);
    return { a, b };
  };

  try {
    const first = makeButtons();
    first.a.focus();
    assert.equal(env.doc.activeElement, first.a);

    // Case 1: redraw replaces DOM without focusing anything -> focus is lost to body and must restore to new btn:a.
    let second;
    keepFocus(root, () => {
      second = makeButtons();
    });
    assert.equal(env.doc.activeElement, second.a, "restores replaced element via data-prx-focus-key");

    // Case 2: fn() deliberately moves focus to btn:b inside root -> keepFocus must NOT override it back to btn:a!
    keepFocus(root, () => {
      const third = makeButtons();
      third.b.focus();
    });
    assert.equal(env.doc.activeElement.getAttribute("data-prx-focus-key"), "btn:b", "respects deliberate focus move");
  } finally {
    env.close();
  }
});

test("tabOrder includes <summary> and skips controls inside closed <details> (including nested details)", () => {
  const env = makeDom();
  const root = env.doc.createElement("div");
  root.innerHTML = `
    <button id="top-btn">Top</button>
    <details id="closed-box">
      <summary id="closed-sum">Data</summary>
      <div>
        <button id="hidden-inside-closed">Inside Closed</button>
        <details id="nested-open" open>
          <summary id="nested-sum">Nested Summary</summary>
          <button id="nested-btn">Nested Btn</button>
        </details>
      </div>
    </details>
    <details id="open-box" open>
      <summary id="open-sum">Settings</summary>
      <div><input id="open-input" type="text" /></div>
    </details>
  `;
  env.el.replaceChildren(root);
  try {
    const ids = tabOrder(root).map((n) => n.id);
    assert.deepEqual(ids, ["top-btn", "closed-sum", "open-sum", "open-input"]);

    env.doc.getElementById("closed-box").open = true;
    const idsAfterOpen = tabOrder(root).map((n) => n.id);
    assert.deepEqual(idsAfterOpen, [
      "top-btn",
      "closed-sum",
      "hidden-inside-closed",
      "nested-sum",
      "nested-btn",
      "open-sum",
      "open-input",
    ]);
  } finally {
    env.close();
  }
});

test("slider snaps pointer input to grid unless continuous: true, while keeping off-grid URL/preset/set exact (S1-08)", () => {
  assert.equal(snapToKeyGrid(0.12, { min: 0.025, max: 0.5, step: 0.05 }), 0.125, "respects min precision");

  const env = makeDom("?tau=.123456789012345&angle=.3333333");
  let tauSlider, angleSlider;
  const handle = createWidget(env.el, {}, {
    name: "slider-snap-test",
    frame: "v2",
    bridge: false,
    presets: [{ id: "offgrid", label: "Off grid", query: "tau=.234567" }],
    keys: {
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      angle: { type: "number", min: 0, max: 1, step: 0.01, value: 0.5, continuous: true },
    },
    build(ctx) {
      // Clear rAF in test window so pointer input flushes synchronously for direct assertion.
      ctx.win.requestAnimationFrame = null;
      tauSlider = ctx.slider({ label: "τ", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      angleSlider = ctx.slider({ label: "Angle", ...ctx.key("angle"), onInput: (v) => ctx.set({ angle: v }) });
      ctx.controls.append(tauSlider.root, angleSlider.root);
      return {
        render(state) {
          tauSlider.set(state.tau);
          angleSlider.set(state.angle);
          ctx.readout.set(`${state.tau}:${state.angle}`);
        },
      };
    },
  });

  try {
    // Off-grid URL values stay exact at mount and input.step remains "any".
    assert.equal(tauSlider.input.step, "any");
    assert.equal(handle.state.tau, 0.123456789012345);
    assert.equal(handle.state.angle, 0.3333333);

    // Off-grid preset stays exact via applyPreset / slider.set.
    handle.applyPreset("offgrid");
    assert.equal(handle.state.tau, 0.234567);
    assert.equal(tauSlider.get(), 0.234567);

    // Pointer input on standard key snaps to 0.01 grid.
    tauSlider.input.value = "0.2864";
    tauSlider.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(handle.state.tau, 0.29);
    assert.equal(tauSlider.input.value, "0.29");

    // Pointer input on continuous: true key stays unsnapped.
    angleSlider.input.value = "0.6789";
    angleSlider.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(handle.state.angle, 0.6789);
  } finally {
    handle.destroy();
    env.close();
  }
});

test("numberInput defers clamping until commit (blur/change/Enter) and sets aria-invalid while typing out-of-range", () => {
  const env = makeDom();
  const emitted = [];
  const committed = [];
  let primarySeen = null;
  let numCtl;

  const handle = createWidget(env.el, {}, {
    name: "num-input-test",
    frame: "v2",
    bridge: false,
    keys: { n: { type: "integer", min: 10, max: 100, value: 25 } },
    build(ctx) {
      numCtl = ctx.numberInput({
        label: "Sample size",
        min: 10,
        max: 100,
        value: ctx.state.n,
        onInput: (v) => { emitted.push(v); ctx.set({ n: v }); },
        onChange: (v) => committed.push(v),
      });
      ctx.controls.append(numCtl.root);
      ctx.onPrimary(() => { primarySeen = handle.state.n; });
      return { render() { ctx.readout.set(`n=${ctx.state.n}`); } };
    },
  });

  try {
    // User starts typing "50" by first typing "5" (< min=10): must NOT clamp or emit 10!
    numCtl.input.value = "5";
    numCtl.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "true");
    assert.equal(numCtl.input.value, "5", "visible text is untouched while typing");
    assert.deepEqual(emitted, [], "no premature clamped emission");

    // User finishes typing "50": valid -> aria-invalid="false", emits 50 immediately.
    numCtl.input.value = "50";
    numCtl.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "false");
    assert.deepEqual(emitted, [50]);

    // User types "4" and blurs -> clamps to 10, updates input.value, clears aria-invalid, emits 10.
    numCtl.input.value = "4";
    numCtl.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "true");
    assert.deepEqual(emitted, [50]);
    numCtl.input.dispatchEvent(new env.win.Event("blur"));
    assert.equal(numCtl.input.value, "10");
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "false");
    assert.deepEqual(emitted, [50, 10]);
    assert.deepEqual(committed, [10]);

    // User types "250" (> max=100) and presses Enter -> clamps BEFORE widget primary() runs!
    numCtl.input.value = "250";
    numCtl.input.dispatchEvent(new env.win.Event("input", { bubbles: true }));
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "true");
    numCtl.input.dispatchEvent(new env.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.equal(numCtl.input.value, "100");
    assert.equal(numCtl.input.getAttribute("aria-invalid"), "false");
    assert.equal(handle.state.n, 100);
    assert.equal(primarySeen, 100, "primary action saw the newly clamped state");
  } finally {
    handle.destroy();
    env.close();
  }
});

test("renderScope cleans up transient listeners/timers before each render and scope.timeout cleans itself on fire", async () => {
  const env = makeDom();
  const externalBus = env.doc.createElement("div");
  let busHits = 0;
  let staleBtn = null;
  let staleBtnClicks = 0;

  const handle = createWidget(env.el, {}, {
    name: "render-scope-test",
    frame: "v2",
    bridge: false,
    keys: { v: { type: "integer", min: 0, max: 10, value: 1 } },
    build(ctx) {
      return {
        render(state) {
          ctx.renderScope.listen(externalBus, "ping", () => { busHits += 1; });
          const btn = ctx.renderScope.h("button", {
            type: "button",
            text: `Run ${state.v}`,
            onclick: () => { staleBtnClicks += 1; },
          });
          if (!staleBtn) staleBtn = btn;
          ctx.stage.replaceChildren(btn);
          ctx.readout.set(`v=${state.v}`);
        },
      };
    },
  });

  try {
    externalBus.dispatchEvent(new env.win.Event("ping"));
    assert.equal(busHits, 1);

    // Redraw 5 times: previous renderScope listeners must be removed before each render!
    for (let k = 2; k <= 6; k += 1) handle.update({ v: k });
    externalBus.dispatchEvent(new env.win.Event("ping"));
    assert.equal(busHits, 2, "only the latest render's listener fired (zero leaked listeners)");

    staleBtn.click();
    assert.equal(staleBtnClicks, 0, "detached button from render #1 has its onclick listener removed");

    // Verify createScope.timeout fires cleanly and stops after cleanup.
    const sc = createScope(env.el);
    let fired = 0;
    sc.timeout(() => { fired += 1; }, 0);
    await wait(env.win, 5);
    assert.equal(fired, 1);
    sc.cleanup();
  } finally {
    handle.destroy();
    externalBus.dispatchEvent(new env.win.Event("ping"));
    assert.equal(busHits, 2, "destroy() cleans up the final renderScope listener");
    env.close();
  }
});

test("renderDisclosure fast path skips full render when returning true, and falls back when returning false", () => {
  const env = makeDom();
  const calls = [];
  let dataBox, methodBox;

  const handle = createWidget(env.el, {}, {
    name: "disclosure-fast-path",
    frame: "v2",
    bridge: false,
    keys: { v: { type: "integer", min: 0, max: 5, value: 2 } },
    build(ctx) {
      dataBox = ctx.dataBox();
      methodBox = ctx.methodBox();
      return {
        render(state, info) {
          calls.push(`render:${info.reason}`);
          ctx.readout.set(`v=${state.v}`);
        },
        renderDisclosure(name, state) {
          calls.push(`disc:${name}:${state.v}`);
          if (name === "data") {
            dataBox.body.textContent = `lazy data ${state.v}`;
            return true;
          }
          return false;
        },
      };
    },
  });

  try {
    assert.deepEqual(calls, ["render:mount"]);
    dataBox.open = true;
    dataBox.root.dispatchEvent(new env.win.Event("toggle"));
    assert.deepEqual(calls, ["render:mount", "disc:data:2"], "fast path skipped full render");
    assert.equal(dataBox.body.textContent, "lazy data 2");

    methodBox.open = true;
    methodBox.root.dispatchEvent(new env.win.Event("toggle"));
    assert.deepEqual(calls, ["render:mount", "disc:data:2", "disc:method:2", "render:disclosure"]);
  } finally {
    handle.destroy();
    env.close();
  }
});

test("error boundary catches render throws, sets data-prx-error, writes fallback readout, and recovers", () => {
  const env = makeDom();
  const origError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  const handle = createWidget(env.el, {}, {
    name: "error-boundary-test",
    frame: "v2",
    bridge: false,
    presets: [{ id: "safe", label: "Safe", query: "v=1" }, { id: "boom", label: "Boom", query: "v=2" }],
    keys: { v: { type: "integer", min: 1, max: 3, value: 2 } },
    build(ctx) {
      return {
        render(state) {
          if (state.v === 2) throw new Error("synthetic solver failure");
          ctx.readout.set(`Recovered ${state.v}`);
        },
      };
    },
  });

  try {
    assert.equal(handle.root.dataset.prxError, "synthetic solver failure");
    assert.ok(handle.root.querySelector(".prx-readout").textContent.length > 0, "fallback message written to empty readout");
    assert.equal(logged.length, 1);

    // Preset bar synced and remains interactive for recovery!
    handle.applyPreset("safe");
    assert.equal(handle.root.dataset.prxError, undefined, "error attribute cleared after recovery");
    assert.equal(handle.root.querySelector(".prx-readout").textContent, "Recovered 1");
  } finally {
    console.error = origError;
    handle.destroy();
    env.close();
  }
});

test("ctx.requestRender coalesces re-entrant calls instead of recursing synchronously", () => {
  const env = makeDom();
  const order = [];
  const handle = createWidget(env.el, {}, {
    name: "reentrant-render-test",
    frame: "v2",
    bridge: false,
    keys: { v: { type: "integer", min: 0, max: 5, value: 0 } },
    build(ctx) {
      let requestedFollowup = false;
      return {
        render(_state, info) {
          order.push(`enter:${info.reason}`);
          if (!requestedFollowup) {
            requestedFollowup = true;
            ctx.requestRender("first-pass");
            ctx.requestRender("coalesced-pass");
          }
          order.push(`exit:${info.reason}`);
          ctx.readout.set(info.reason);
        },
      };
    },
  });

  try {
    assert.deepEqual(order, [
      "enter:mount",
      "exit:mount",
      "enter:coalesced-pass",
      "exit:coalesced-pass",
    ]);
  } finally {
    handle.destroy();
    env.close();
  }
});

test("ctx.scheduleStages manages aria-busy, cancels superseded runs, and removes aria-busy on destroy", { timeout: 10000 }, async () => {
  const env = makeDom();
  let runStages;
  const log = [];

  const handle = createWidget(env.el, {}, {
    name: "stage-scheduler-test",
    frame: "v2",
    bridge: false,
    keys: { v: { type: "integer", min: 0, max: 5, value: 0 } },
    build(ctx) {
      runStages = ctx.scheduleStages;
      return { render() { ctx.readout.set("ready"); } };
    },
  });

  try {
    // Single-stage runs synchronously and sets aria-busy="false".
    runStages([() => log.push("single")]);
    assert.deepEqual(log, ["single"]);
    assert.equal(handle.root.getAttribute("aria-busy"), "false");

    // Multi-stage run #1 starts immediately on stage 0 with aria-busy="true"...
    runStages([
      () => log.push("run1:s0"),
      () => log.push("run1:s1-should-cancel"),
    ]);
    assert.deepEqual(log, ["single", "run1:s0"]);
    assert.equal(handle.root.getAttribute("aria-busy"), "true");

    // Register the completion signal before the replacement run starts.
    const finished = new Promise(resolve => {
      runStages([
        () => log.push("run2:s0"),
        () => log.push("run2:s1"),
        () => { log.push("run2:s2"); resolve(); },
      ]);
    });
    assert.deepEqual(log, ["single", "run1:s0", "run2:s0"]);
    assert.equal(handle.root.getAttribute("aria-busy"), "true");

    await finished;
    assert.deepEqual(log, ["single", "run1:s0", "run2:s0", "run2:s1", "run2:s2"]);
    assert.equal(handle.root.getAttribute("aria-busy"), "false");

    // Start an in-flight run and destroy() mid-flight: aria-busy attribute must be removed and remaining stages skipped!
    runStages([
      () => log.push("run3:s0"),
      () => log.push("run3:s1-after-destroy"),
    ]);
    assert.equal(handle.root.getAttribute("aria-busy"), "true");
    handle.destroy();
    assert.equal(handle.root.hasAttribute("aria-busy"), false, "destroy() removes aria-busy attribute");
    await wait(env.win, 20);
    assert.equal(log.includes("run3:s1-after-destroy"), false);
  } finally {
    handle.destroy();
    env.close();
  }
});

test("VISUAL_CSS preserves 3.5.0 P-app toolbar geometry in Phase 5 while frame: v2 wraps preset chips in app.css (S1-05)", () => {
  assert.match(VISUAL_CSS, /\.mdv\s+\.mdv-toolbar\s+\.prx-seg-buttons\{[^}]*flex-wrap:nowrap/);
  assert.match(VISUAL_CSS, /max\(14px,\.82rem\)/);
});
