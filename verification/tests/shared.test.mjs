// Unit tests of the shared modules and the catalog (jsdom from tools/node_modules).
//   node --test verification/tests/
// An embedded app is simulated as an iframe window whose parent is the outer page. jsdom's own postMessage
// sets event.source to null, so messages are dispatched as MessageEvents with an explicit source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(`${ROOT}tools/package.json`);
const { JSDOM } = require("jsdom");
const { readQuery } = await import(`${ROOT}js/shared/bridge.js`);
const { createWidget, parsePresetQuery, appInfo } = await import(`${ROOT}js/shared/base.js`);
const { validate, loadCatalog, generate } = await import(`${ROOT}scripts/build.mjs`);

const D3 = readFileSync(`${ROOT}js/vendor/d3.min.js`, "utf8");
const PLOT = readFileSync(`${ROOT}js/vendor/plot.min.js`, "utf8");

/** An outer window with an iframe; the app mounts in the iframe (inner.parent === outer). */
function frames({ query = "", plot = false } = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://outer.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const outer = dom.window;
  const iframe = outer.document.createElement("iframe");
  outer.document.body.appendChild(iframe);
  const inner = iframe.contentWindow;
  inner.__PRX_QUERY = query;
  inner.document.body.innerHTML = '<div id="app"><p>fallback</p></div>';
  if (plot) { inner.eval(D3); inner.eval(PLOT); }
  return { outer, inner, el: inner.document.getElementById("app") };
}

const send = (win, data, source) => win.dispatchEvent(new win.MessageEvent("message", { data, source, origin: "null" }));

/** A tiny app with two keys and three presets (passed directly, not from the catalog). */
function mountToy(el, spec = {}) {
  let renders = 0;
  const handle = createWidget(el, spec, {
    name: "toy",
    keys: { tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 }, cap: { type: "choice", values: ["none", 3], value: "none" } },
    presets: [
      { id: "low", label: "τ .02", query: "tau=.02" },
      { id: "high", label: "τ .40", query: "tau=.40" },
      { id: "capped", label: "τ .20, at most 3", query: "tau=.20&cap=3" },
    ],
    build(ctx) {
      const s = ctx.slider({ label: "τ", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      ctx.controls.append(s.root);
      return { render(state) { renders += 1; s.set(state.tau); ctx.readout.set(`tau ${state.tau} cap ${state.cap}`); } };
    },
  });
  return { handle, renders: () => renders };
}

const pressed = (el) => [...el.querySelectorAll(".prx-presets .prx-seg")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);

test("nearby admitted values update the actual state while preset matching stays approximate", () => {
  const { el, inner } = frames();
  const { handle, renders } = mountToy(el);
  handle.update({ tau: .4 });
  const near = .4000000005;
  handle.update({ tau: near });
  assert.equal(handle.state.tau, near, "a preset tolerance must not swallow a changed setting");
  assert.deepEqual(pressed(el), ["τ .40"], "approximate preset highlighting remains useful");
  const before = renders();
  handle.update({ tau: near });
  assert.equal(renders(), before, "identical input still avoids redundant renders");
  handle.destroy(); inner.close();
  const second = frames();
  const list = createWidget(second.el, {}, {
    keys: { w: { type: "numbers", min: 0, max: 1, value: [.5, .5], minLength: 2, maxLength: 2 } },
    build() { return { render() {} }; },
  });
  list.update({ w: [.5000000005, .4999999995] });
  assert.deepEqual(list.state.w, [.5000000005, .4999999995], "numeric-vector state retains exact admitted inputs too");
  list.destroy(); second.inner.close();
});

test("native range values retain admitted off-grid settings and numeric keyboard increments", () => {
  const { el, inner } = frames({ query: "?tau=.123456789012345" });
  const { handle } = mountToy(el);
  const input=el.querySelector('input[type="range"]');
  assert.equal(input.step,"any");
  assert.ok(Math.abs(Number(input.value)-handle.state.tau)<=Number.EPSILON);
  const press=key=>input.dispatchEvent(new inner.KeyboardEvent("keydown",{key,bubbles:true,cancelable:true}));
  input.focus();press("ArrowRight");assert.equal(handle.state.tau,.13);
  press("Home");assert.equal(handle.state.tau,.02);
  press("End");assert.equal(handle.state.tau,.5);
  assert.equal(inner.document.activeElement,input);
  handle.destroy();inner.close();
});

test("readQuery keeps app keys, preset and theme apart, and drops the rest", () => {
  const w = new JSDOM("<!doctype html>", { url: "https://x.test/e.html?tau=.3&preset=high&theme=dark&bogus=1&cap=3" }).window;
  const q = readQuery({ allowed: ["tau", "cap"], types: { tau: "number" }, window: w });
  assert.deepEqual(q.spec, { tau: 0.3, cap: 3 });
  assert.equal(q.preset, "high");
  assert.equal(q.theme, "dark");
  assert.deepEqual(q.ignored.map((x) => x.key), ["bogus"]);
});

test("parsePresetQuery reads a preset's query with or without '?'", () => {
  assert.deepEqual(parsePresetQuery("?tau=.20&cap=3"), { tau: ".20", cap: "3" });
  assert.deepEqual(parsePresetQuery("tau=.4"), { tau: ".4" });
});

test("defaults, spec and URL: the URL wins; a preset is applied before explicit keys", () => {
  const a = frames();
  assert.deepEqual(mountToy(a.el).handle.state, { tau: 0.2, cap: "none" });
  const b = frames({ query: "?tau=.35" });
  assert.equal(mountToy(b.el, { tau: 0.1 }).handle.state.tau, 0.35);
  const c = frames({ query: "?preset=capped&tau=.3" });
  assert.deepEqual(mountToy(c.el).handle.state, { tau: 0.3, cap: 3 });
  const d = frames({ query: "?tau=9" });
  assert.equal(mountToy(d.el).handle.state.tau, 0.5, "numbers are clamped");
});

test("v1 widget API: snap, number lists, parts, scroll regions and the main action on Enter", () => {
  const { el, inner } = frames({ query: "?w=.2,.35&k=.234" });
  let drawn = 0;
  let scroller;
  const handle = createWidget(el, {}, {
    name: "toy-v1",
    keys: {
      k: { type: "number", min: 0, max: 1, step: 0.05, value: 0.5, snap: true },
      w: { type: "numbers", min: 0, max: 1, value: [0.5, 0.5], minLength: 2, maxLength: 2 },
    },
    build(ctx) {
      const s = ctx.slider({ label: "k", ...ctx.key("k"), onInput: (v) => ctx.set({ k: v }) });
      ctx.controls.append(ctx.part("settings", s.root));
      scroller = ctx.scrollRegion(ctx.h("div"), "Wide table");
      ctx.charts.append(scroller);
      ctx.onPrimary(() => { drawn += 1; });
      return { render(state) { s.set(state.k); ctx.readout.set(`k ${state.k} w ${state.w.join(" ")}`); } };
    },
  });
  assert.equal(handle.state.k, 0.25, "snap: true puts a number on the step grid");
  assert.deepEqual(handle.state.w, [0.2, 0.35], "a numbers key reads a comma list from the URL");
  handle.update({ w: [0.1] });
  assert.deepEqual(handle.state.w, [0.2, 0.35], "a list of the wrong length is ignored");
  assert.equal(el.querySelector("[data-prx-part=settings]")?.classList.contains("prx-slider"), true);
  assert.equal(scroller.getAttribute("tabindex"), "0");
  assert.equal(scroller.getAttribute("role"), "region");
  assert.equal(scroller.getAttribute("aria-label"), "Wide table");
  const input = el.querySelector("input[type=range]");
  input.dispatchEvent(new inner.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.equal(drawn, 1, "Enter on a slider runs the main action");
  el.querySelector("button")?.dispatchEvent(new inner.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.equal(drawn, 1, "Enter on a button is the browser's own");
});

test("set() while the app renders (the first render too) is applied after that render, as one more update", () => {
  const { el } = frames({ query: "?k=7" });
  const seen = [];
  const handle = createWidget(el, {}, {
    name: "toy-set-in-render",
    keys: { k: { type: "integer", min: 0, max: 9, value: 0 } },
    build(ctx) {
      return { render(state) { seen.push(state.k); if (state.k > 5) ctx.set({ k: 5 }); } };
    },
  });
  assert.equal(handle.state.k, 5, "the correction made in the first render is applied");
  assert.deepEqual(seen, [7, 5], "one render with the URL value, one with the correction");
  handle.update({ k: 8 });
  assert.equal(handle.state.k, 5);
  assert.deepEqual(seen, [7, 5, 8, 5]);
});

test("control hints take nodes, so a number in a hint keeps its data-num; toggles take a hint too", () => {
  const { el } = frames({});
  createWidget(el, {}, {
    name: "toy-hints",
    keys: { k: { type: "number", min: 0, max: 1, step: 0.05, value: 0.5 }, on: { type: "boolean", value: false } },
    build(ctx) {
      const num = ctx.h("span", { "data-num": "0.15", text: ".15" });
      const s = ctx.slider({ label: "k", ...ctx.key("k"), hint: ["The true spread is ", num, "."], onInput: (v) => ctx.set({ k: v }) });
      const t = ctx.toggle({ label: "Equal SEs", checked: false, hint: "Every unit gets the middle SE.", onChange: (b) => ctx.set({ on: b }) });
      ctx.controls.append(s.root, t.root);
      return { render() {} };
    },
  });
  const hints = [...el.querySelectorAll(".prx-hint")];
  assert.equal(hints.length, 2);
  assert.equal(hints[0].textContent, "The true spread is .15.");
  assert.equal(hints[0].querySelector("[data-num]")?.getAttribute("data-num"), "0.15", "the number node is kept");
  assert.equal(el.querySelector("input[type=range]").getAttribute("aria-describedby"), hints[0].id);
  assert.equal(el.querySelector("input[type=checkbox]").getAttribute("aria-describedby"), hints[1].id);
});

test("the preset row: one button per preset, pressed when the state equals its setting", () => {
  const { el } = frames();
  const { handle } = mountToy(el);
  assert.deepEqual([...el.querySelectorAll(".prx-presets .prx-seg")].map((b) => b.textContent), ["τ .02", "τ .40", "τ .20, at most 3"]);
  assert.deepEqual(pressed(el), []);
  handle.update({ tau: 0.4 });
  assert.deepEqual(pressed(el), ["τ .40"], "reaching a preset's setting by hand presses it");
  el.querySelectorAll(".prx-presets .prx-seg")[2].click();
  assert.deepEqual(handle.state, { tau: 0.2, cap: 3 });
  assert.deepEqual(pressed(el), ["τ .20, at most 3"]);
  handle.applyPreset("low");
  assert.deepEqual(handle.state, { tau: 0.02, cap: "none" }, "a preset is a whole setting: cap returns to its default");
  handle.update({ tau: 0.05 });
  assert.deepEqual(pressed(el), []);
});

test("the bridge: messages from the parent window drive keys and presets; others are ignored", () => {
  const { outer, inner, el } = frames();
  const { handle } = mountToy(el);
  send(inner, { prx: { tau: 0.33 } }, outer);
  assert.equal(handle.state.tau, 0.33);
  send(inner, { prx: { preset: "capped" } }, outer);
  assert.deepEqual(handle.state, { tau: 0.2, cap: 3 });
  const stranger = new JSDOM("<!doctype html>").window;
  send(inner, { prx: { tau: 0.45 } }, stranger);
  assert.equal(handle.state.tau, 0.2, "a message from another window is ignored");
  send(inner, { prx: { theme: "dark" } }, outer);
  assert.equal(handle.root.getAttribute("data-theme"), "dark");
  assert.equal(inner.document.documentElement.getAttribute("data-theme"), "dark", "a theme message re-themes the page");
});

test("render runs once at mount and once per change; destroy restores the mount element", () => {
  const { el } = frames();
  const { handle, renders } = mountToy(el);
  assert.equal(renders(), 1);
  handle.update({ tau: 0.2 });
  assert.equal(renders(), 1, "an unchanged value does not render");
  handle.update({ tau: 0.25 });
  assert.equal(renders(), 2);
  assert.match(el.querySelector(".prx-readout").textContent, /tau 0.25 cap none/);
  handle.destroy();
  assert.equal(el.textContent, "fallback");
});

test("price-of-silence mounts with its catalog presets and caption and shows the engine's numbers", async () => {
  const { el, inner } = frames({ query: "?preset=tau20-cap3", plot: true });
  const { mountWidget } = await import(`${ROOT}js/apps/price-of-silence.js`);
  const app = mountWidget(el);
  assert.deepEqual(app.state, { tau: 0.2, cap: 3, stage: 3, yours: null });
  assert.equal(el.querySelectorAll(".prx-presets .prx-seg").length, appInfo("price-of-silence").presets.length);
  assert.equal(el.querySelector(".prx-caption").textContent, appInfo("price-of-silence").caption);
  const text = el.querySelector(".prx-readout").textContent;
  assert.match(text, /\{A, B\} > \{C, D\} > \{E, F\}/);
  assert.match(text, /\.0417/);
  assert.ok(inner.document.head.querySelector('style[data-prx-app="price-of-silence"]'), "the app's CSS is injected once");
  app.update({ stage: 1, yours: [1, 2, 3, 4, 5, 6] });
  app.applyPreset("tau40-nocap");
  assert.equal(app.state.stage, 3, "a whole-setting preset restores the matrix stage");
  assert.equal(app.state.yours, null, "a whole-setting preset clears the custom report");
  assert.equal(el.querySelector('[data-prx-readout="N"]').getAttribute("data-num"), "15");
  assert.equal(el.querySelector('[data-prx-readout="M"]').getAttribute("data-num"), "15");
});

test("the catalog is valid, and planted faults are caught", () => {
  const cat = loadCatalog();
  assert.deepEqual(validate(cat), []);
  assert.equal(new Set(cat.apps.map((a) => a.id)).size, cat.apps.length);
  const bad = structuredClone(cat);
  bad.apps[0].part = "Z";
  bad.apps[1].name = bad.apps[2].name;
  bad.apps[3].status = "done";
  delete bad.apps[4].idea;
  const coherence = bad.apps.find((a) => a.id === "2.6");
  coherence.try.push({ preset: "nope", shows: ["x"] });
  bad.apps.find((a) => a.id === "2.8").id = "3.8";
  const part4 = bad.apps.filter((a) => a.part === "4");
  part4[part4.length - 1].id = `4.${part4.length + 1}`;                 // a gap at the end of part 4
  const errs = validate(bad);
  const gap = new RegExp(`part 4: app numbers must run 1 to ${part4.length} without gaps`);
  for (const re of [/unknown part/, /duplicate name/, /status must be/, /missing idea/, /unknown preset nope/, /id must be <part>\.<n> with part 2/, gap]) {
    assert.ok(errs.some((e) => re.test(e)), `missed ${re}`);
  }
});

test("generated pages: every built app has an embed, landing card and content-category menu link", () => {
  const cat = loadCatalog();
  const files = generate(cat);
  for (const a of cat.apps.filter((x) => x.status === "built")) {
    assert.ok(files.get(`embed/${a.name}.html`).includes(`js/bundles/${a.name}.js`));
  }
  const nav = files.get("_nav.yml");
  assert.equal((nav.match(/\bmenu:/g)||[]).length,6);
  for (const a of cat.apps) {
    assert.equal(nav.includes(`/${a.name}.qmd`),a.status==='built',a.name);
    const part=cat.parts.find(p=>p.key===a.part);
    assert.ok(files.get(`pages/${part.slug}/_apps.md`).includes(`/${a.name}.html`),a.name);
    assert.ok(cat.websiteNavigation.sections.some(s=>s.parts.includes(a.part)),a.name);
  }
  assert.equal(cat.websiteNavigation.sections.length,6);
  assert.ok(files.get('pages/criteria/_profile-apps.md').includes('profile-dependence.html'));
});

test("chart.js fallback tokens equal the light values of styles/tokens.css", async () => {
  const { CONFIG } = await import(`${ROOT}js/shared/chart.js`);
  const css = readFileSync(`${ROOT}styles/tokens.css`, "utf8");
  const light = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)"));
  for (const [name, value] of Object.entries(CONFIG.tokens)) {
    const m = new RegExp(`${name}:\\s*([^;]+);`).exec(light);
    assert.ok(m, `${name} is not in tokens.css`);
    assert.equal(m[1].trim().toLowerCase(), value.toLowerCase(), name);
  }
});
