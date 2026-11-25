// Unit tests for Frame v2:
// design tokens, frame v2 styles navbar clearance, B14 CDE dark contrast,
// chart.js palette cache (B1/B6), opt-in v2 13px font floor, B10 focus clamping,
// hiddenTable tiny non-zero formatting, placeDirectLabels, translucent labelOn, and svgScene/svgEl.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(`${ROOT}tools/package.json`);
const { JSDOM } = require("jsdom");

const {
  CONFIG,
  plot,
  hiddenTable,
  clampFocusPoint,
  placeDirectLabels,
  labelOn,
  labelInk,
  contrast,
  svgEl,
  svgScene,
} = await import(`${ROOT}js/shared/chart.js`);
const { CDE_COMMON_CSS, mountCdeView } = await import(`${ROOT}js/shared/domain/cde.js`);

const D3 = readFileSync(`${ROOT}js/vendor/d3.min.js`, "utf8");
const PLOT = readFileSync(`${ROOT}js/vendor/plot.min.js`, "utf8");
const TOKENS_CSS = readFileSync(`${ROOT}styles/tokens.css`, "utf8");
const APP_CSS = readFileSync(`${ROOT}styles/app.css`, "utf8");
const SITE_SCSS = readFileSync(`${ROOT}styles/site.scss`, "utf8");

function makeDom({ withStyles = true, withPlot = true, html = '<div id="app"></div>' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: "https://prx.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window: win } = dom;
  if (withStyles) {
    const s1 = win.document.createElement("style");
    s1.textContent = TOKENS_CSS;
    const s2 = win.document.createElement("style");
    s2.textContent = APP_CSS;
    win.document.head.append(s1, s2);
  }
  if (withPlot) {
    win.eval(D3);
    win.eval(PLOT);
  }
  return { dom, win, doc: win.document, el: win.document.getElementById("app") };
}

test("placeDirectLabels resolves collisions symmetrically, preserves input order, and clamps to [minY, maxY]", () => {
  assert.deepEqual(placeDirectLabels([]), []);

  // Non-colliding labels remain at exact target y
  const spaced = placeDirectLabels([{ id: "a", y: 24 }, { id: "b", y: 80 }], { minGap: 14, minY: 0, maxY: 200 });
  assert.deepEqual(spaced.map((d) => d.y), [24, 80]);
  assert.deepEqual(spaced.map((d) => d.dy), [0, 0]);

  // Symmetric separation around midpoint when away from bounds
  const pair = placeDirectLabels([{ id: "hi", y: 50 }, { id: "lo", y: 50 }], { minGap: 14, minY: 0, maxY: 120 });
  assert.deepEqual(pair.map((d) => d.id), ["hi", "lo"]);
  assert.ok(Math.abs(pair[0].y - 43) < 1e-9);
  assert.ok(Math.abs(pair[1].y - 57) < 1e-9);

  // Input array order is preserved even when series items are not sorted by y
  const unsorted = placeDirectLabels(
    [
      { id: "s1", y: 100, color: "#009E73" },
      { id: "s2", y: 20, color: "#CC79A7" },
      { id: "s3", y: 102, color: "#8C564B" },
    ],
    { minGap: 14, minY: 0, maxY: 160 },
  );
  assert.deepEqual(unsorted.map((d) => d.id), ["s1", "s2", "s3"]);
  assert.equal(unsorted[1].y, 20);
  assert.ok(unsorted[2].y - unsorted[0].y >= 14 - 1e-9);
  assert.equal(unsorted[0].color, "#009E73");

  // Top and bottom pileups clamp cleanly via forward + backward sweeps
  const topPile = placeDirectLabels(
    [{ id: "t1", y: 2 }, { id: "t2", y: 2 }, { id: "t3", y: 25 }],
    { minGap: 14, minY: 0, maxY: 100 },
  );
  assert.deepEqual(topPile.map((d) => Math.round(d.y)), [0, 14, 28]);

  const bottomPile = placeDirectLabels(
    [{ id: "b1", y: 75 }, { id: "b2", y: 98 }, { id: "b3", y: 98 }],
    { minGap: 14, minY: 0, maxY: 100 },
  );
  assert.deepEqual(bottomPile.map((d) => Math.round(d.y)), [72, 86, 100]);

  // Respects taller item height and bounds/minGapPx aliases; stays within bounds even when overfull
  const tall = placeDirectLabels(
    [{ id: "m1", y: 50, height: 24 }, { id: "m2", y: 50, height: 20 }],
    { minGapPx: 14, bounds: [10, 120] },
  );
  assert.ok(tall[1].y - tall[0].y >= 22 - 1e-9);

  const crowded = placeDirectLabels(
    Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, y: 40 })),
    { minGap: 14, minY: 10, maxY: 70 },
  );
  for (let i = 0; i < crowded.length; i += 1) {
    assert.ok(crowded[i].y >= 10 - 1e-9 && crowded[i].y <= 70 + 1e-9);
    if (i > 0) assert.ok(crowded[i].y > crowded[i - 1].y);
  }
});

test("clampFocusPoint and chart.plot keyboard points clamp out-of-domain marks to [0%, 100%] (B10)", () => {
  const inBox = clampFocusPoint(120, 80, { width: 400, height: 200 });
  assert.equal(inBox.clamped, false);
  assert.equal(inBox.leftPct, 30);
  assert.equal(inBox.topPct, 40);

  const above = clampFocusPoint({ x: -25, y: -310 }, { width: 400, height: 200 });
  assert.equal(above.clamped, true);
  assert.equal(above.x, 0);
  assert.equal(above.y, 0);
  assert.equal(above.leftPct, 0);
  assert.equal(above.topPct, 0);

  const belowRight = clampFocusPoint(520, 260, { width: 400, height: 200 });
  assert.equal(belowRight.clamped, true);
  assert.equal(belowRight.leftPct, 100);
  assert.equal(belowRight.topPct, 100);

  // App 4.9 scenario: y domain [0, 0.25] while an extreme point has risk 0.736
  const { win, el } = makeDom();
  const rows = [
    { id: "low", x: 1, risk: -0.1 },
    { id: "mid", x: 2, risk: 0.12 },
    { id: "high", x: 3, risk: 0.736 },
  ];
  plot(el, {
    alt: "Out-of-domain focus clamping check",
    width: 480,
    height: 220,
    x: { domain: [0, 4] },
    y: { domain: [0, 0.25] },
    marks: (c, P) => [P.dot(rows, { x: "x", y: "risk", fill: c.post, clip: true })],
    keyboard: {
      data: rows,
      x: "x",
      y: "risk",
      key: "id",
      sort: false,
      title: (d) => `${d.id}: ${d.risk}`,
    },
  });

  const buttons = [...el.querySelectorAll(".prx-kbd-point")];
  assert.equal(buttons.length, 3);
  for (const btn of buttons) {
    const left = Number.parseFloat(btn.style.left);
    const top = Number.parseFloat(btn.style.top);
    assert.ok(left >= 0 && left <= 100, `left out of [0, 100]: ${btn.style.left}`);
    assert.ok(top >= 0 && top <= 100, `top out of [0, 100]: ${btn.style.top}`);
  }
  assert.equal(buttons[0].getAttribute("data-clamped"), "true", "below-domain point is marked data-clamped");
  assert.equal(buttons[0].style.top, "100%");
  assert.equal(buttons[1].getAttribute("data-clamped"), null, "in-domain point is not clamped");
  assert.equal(buttons[2].getAttribute("data-clamped"), "true", "above-domain point (0.736 > 0.25) is clamped at top edge");
  assert.equal(buttons[2].style.top, "0%");

  // Also check virtual keyboard mode updates data-clamped dynamically across arrow navigation
  plot(el, {
    alt: "Virtual keyboard clamping check",
    width: 480,
    height: 220,
    x: { domain: [0, 4] },
    y: { domain: [0, 0.25] },
    marks: (c, P) => [P.dot(rows, { x: "x", y: "risk", fill: c.post, clip: true })],
    keyboard: {
      data: rows,
      x: "x",
      y: "risk",
      key: "id",
      sort: false,
      virtual: true,
      title: (d) => `${d.id}: ${d.risk}`,
    },
  });
  const vBtn = el.querySelector(".prx-kbd-point");
  assert.equal(vBtn.getAttribute("data-clamped"), "true");
  vBtn.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  assert.equal(vBtn.getAttribute("data-clamped"), null);
  vBtn.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  assert.equal(vBtn.getAttribute("data-clamped"), "true");
  assert.equal(vBtn.style.top, "0%");
  win.close();
});

test("hiddenTable formats tiny non-zero numbers (< 5e-7) with scientific notation instead of zero", () => {
  const { win, doc } = makeDom({ withStyles: false, withPlot: false });

  // 1) Record array auto-schema
  const recWrap = hiddenTable(doc, [
    { unit: "A", val: 0, vec: [0, 1.23e-8] },
    { unit: "B", val: 2.5e-8, vec: [-3.4e-9, 0.25] },
    { unit: "C", val: -4.9e-7, vec: [1, 2] },
  ]);
  const recCells = [...recWrap.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((td) => ({ text: td.textContent, num: td.getAttribute("data-num") })),
  );
  assert.equal(recCells[0][1].text, "0", "exact zero remains 0");
  assert.notEqual(recCells[1][1].text, "0");
  assert.doesNotMatch(recCells[1][1].text, /^[−-]?0*(?:\.0+)?$/, "2.5e-8 must not format as 0 or .000000");
  assert.equal(recCells[1][1].num, "2.5e-8");
  assert.doesNotMatch(recCells[2][1].text, /^[−-]?0*(?:\.0+)?$/, "-4.9e-7 must not format as -0 or -.000000");
  assert.ok(!recCells[0][2].text.endsWith(", 0)") && !recCells[0][2].text.endsWith(", .000000)"), "tuple element uses non-zero scientific fallback");

  // 2) Explicit columns without custom format function
  const expWrap = hiddenTable(doc, {
    caption: "Explicit columns",
    columns: [
      { label: "Unit", value: "unit" },
      { label: "Gap", value: "gap" },
      { label: "Custom", value: "gap", format: () => "custom-fmt" },
    ],
    rows: [
      { unit: "U1", gap: 0 },
      { unit: "U2", gap: 1.04e-9 },
    ],
  });
  const expRows = [...expWrap.querySelectorAll("tbody tr")];
  assert.equal(expRows[0].children[1].textContent, "0");
  assert.doesNotMatch(expRows[1].children[1].textContent, /^[−-]?0*(?:\.0+)?$/);
  assert.equal(expRows[1].children[1].getAttribute("data-num"), "1.04e-9");
  assert.equal(expRows[1].children[2].textContent, "custom-fmt", "explicit custom formatter is preserved");
  win.close();
});

test("palette cache hits across renders/charts and invalidates on theme, skin, media query, or inline --prx-* (B1, B6)", () => {
  const { win, doc } = makeDom({
    html: '<div class="prx-widget" id="w"><div id="c1"></div><div id="c2"></div></div>',
  });
  const root = doc.getElementById("w");
  const c1 = doc.getElementById("c1");
  const c2 = doc.getElementById("c2");

  let darkMedia = false;
  win.matchMedia = (q) => ({
    media: q,
    get matches() { return q.includes("dark") ? darkMedia : false; },
    addEventListener() {},
    removeEventListener() {},
  });

  let probeCalls = 0;
  const origGetComputedStyle = win.getComputedStyle.bind(win);
  win.getComputedStyle = (target, pseudo) => {
    if (target?.classList?.contains("prx-panel-probe")) probeCalls += 1;
    return origGetComputedStyle(target, pseudo);
  };

  const draw = (target) =>
    plot(target, {
      alt: "Cache test",
      width: 320,
      height: 160,
      marks: (pal, P) => [P.dot([{ x: 1, y: 2 }], { x: "x", y: "y", fill: "var(--prx-post)", stroke: pal.est })],
    });

  const fig1 = draw(c1);
  assert.equal(probeCalls, 1, "first plot computes panel style once");
  assert.equal(fig1.palette.plotBg.toLowerCase(), "#ffffff");

  // Re-rendering c1 and rendering a second chart c2 in the same theme must NOT call getComputedStyle(probe)
  const fig1Again = draw(c1);
  const fig2 = draw(c2);
  assert.equal(probeCalls, 1, "repeat renders and sibling charts reuse cached palette");
  assert.equal(fig1Again.palette, fig1.palette);
  assert.equal(fig2.palette, fig1.palette);

  // Document dark theme invalidates cache once, then caches dark theme
  doc.documentElement.setAttribute("data-theme", "dark");
  const figDark = draw(c1);
  assert.equal(probeCalls, 2, "theme change triggers one fresh read");
  assert.equal(figDark.palette.plotBg.toLowerCase(), "#f0eee8", "dark mode uses dimmed paper plotBg");
  assert.equal(figDark.palette.fg.toLowerCase(), "#1f2421", "panel fg stays dark plot ink inside dark chrome");
  draw(c2);
  assert.equal(probeCalls, 2, "subsequent dark render hits dark cache");

  // Switching back to light reuses existing light cache entry with zero new getComputedStyle calls
  doc.documentElement.removeAttribute("data-theme");
  const figBackToLight = draw(c1);
  assert.equal(probeCalls, 2, "returning to light theme hits cached light entry");
  assert.equal(figBackToLight.palette, fig1.palette);

  // OS prefers-color-scheme: dark invalidates rootThemeKey when data-theme is unset
  darkMedia = true;
  draw(c1);
  assert.equal(probeCalls, 3, "OS dark media change invalidates theme cache key");
  draw(c2);
  assert.equal(probeCalls, 3, "subsequent render under same OS dark media key hits cache");
  darkMedia = false;

  // Skin change (data-skin="jhl") invalidates cache once, then caches
  doc.documentElement.setAttribute("data-skin", "jhl");
  draw(c1);
  assert.equal(probeCalls, 4, "skin change invalidates theme cache key");
  draw(c2);
  assert.equal(probeCalls, 4, "subsequent render under jhl skin hits cache");
  doc.documentElement.removeAttribute("data-skin");

  // Inline --prx-* custom property on el or root bypasses cache for live accuracy
  c1.style.setProperty("--prx-post", "#123456");
  const figInline = draw(c1);
  assert.equal(probeCalls, 5, "inline --prx-* falls back to live getComputedStyle");
  assert.equal(figInline.palette.post.toLowerCase(), "#123456");

  c1.style.removeProperty("--prx-post");
  const figRestored = draw(c1);
  assert.equal(probeCalls, 5, "removing inline --prx-* returns to cached palette");
  assert.equal(figRestored.palette, fig1.palette);
  win.close();
});

test("chart.plot keeps 12px default for legacy frames and uses 13px floor inside data-prx-frame=v2", () => {
  const { win, doc } = makeDom({
    html: `
      <div class="prx-widget" id="legacy"><div id="c-legacy"></div></div>
      <div class="prx-widget" data-prx-frame="v2" id="v2"><div id="c-v2"></div></div>
    `,
  });
  assert.equal(CONFIG.fontSize, 12);
  assert.equal(CONFIG.fontSizeV2, 13);

  const fLegacy = plot(doc.getElementById("c-legacy"), {
    alt: "Legacy font size",
    width: 300,
    height: 150,
    marks: (c, P) => [P.dot([{ x: 1, y: 1 }], { x: "x", y: "y", fill: c.post })],
  });
  const fV2 = plot(doc.getElementById("c-v2"), {
    alt: "v2 font size",
    width: 300,
    height: 150,
    marks: (c, P) => [P.dot([{ x: 1, y: 1 }], { x: "x", y: "y", fill: c.post })],
  });
  assert.match(fLegacy.svg.getAttribute("style") ?? "", /font-size:\s*12px/);
  assert.match(fV2.svg.getAttribute("style") ?? "", /font-size:\s*13px/);
  win.close();
});

test("labelOn and labelInk handle solid and translucent fills over plotBg", () => {
  assert.equal(labelInk, labelOn);
  const pal = { labelDark: "#111111", labelLight: "#ffffff", plotBg: "#ffffff" };

  // Solid fills preserve exact behavior
  assert.equal(labelOn("#153653", pal), "#ffffff");
  assert.equal(labelOn("#EFF3FF", pal), "#111111");
  assert.equal(labelOn("#E69F00", pal), "#111111");
  assert.ok(contrast("#E69F00", labelOn("#E69F00", pal)) >= 4.5);

  // Translucent dark navy at low alpha over white paper is visually light -> must choose dark ink (#111111)
  assert.equal(labelOn("rgba(21, 54, 83, 0.15)", pal), "#111111");
  assert.equal(labelOn("rgb(21 54 83 / 18%)", pal), "#111111");
  assert.equal(labelOn("#15365326", pal), "#111111");

  // Translucent dark navy at high alpha over white paper stays dark -> must choose light ink (#ffffff)
  assert.equal(labelOn("rgba(21, 54, 83, 0.92)", pal), "#ffffff");

  // Unparseable fill falls back safely to dark label ink
  assert.equal(labelOn("url(#grad)", pal), "#111111");
  assert.equal(labelOn("#153653"), "#ffffff");
});

test("svgEl and svgScene render 1:1 viewBox scenes, resolve var() tokens, and attach hidden tables", () => {
  const { win, doc } = makeDom({
    withPlot: false,
    html: '<div class="prx-widget" data-prx-frame="v2"><div id="stage"></div></div>',
  });
  const stage = doc.getElementById("stage");
  Object.defineProperty(stage, "clientWidth", { value: 420, configurable: true });

  const scene = svgScene(
    stage,
    {
      height: 210,
      alt: "Custom two-score slope scene",
      table: [{ unit: "A", gap: 1.5e-8 }],
    },
    (s) => {
      const hatch = s.hatchDef("wh-hatch");
      return [
        svgEl("rect", { x: 0, y: 0, width: s.width, height: s.height, fill: hatch, strokeWidth: 1.5 }),
        s.el("line", { x1: 10, y1: 20, x2: 200, y2: 120, stroke: "var(--prx-crit-1)", strokeWidth: 2 }),
        s.numText({ x: 40, y: 50, textAnchor: "end", fill: "var(--prx-crit-ink-1)" }, 0.42, ".42"),
      ];
    },
  );

  assert.equal(scene.width, 420);
  assert.equal(scene.height, 210);
  assert.equal(scene.svg.getAttribute("viewBox"), "0 0 420 210");
  assert.match(scene.svg.getAttribute("style") ?? "", /font-size:\s*13px/);
  const slopeLine = scene.svg.querySelector("svg > line");
  assert.equal(slopeLine?.getAttribute("stroke")?.toLowerCase(), "#009e73");
  assert.equal(slopeLine?.getAttribute("stroke-width"), "2");
  assert.equal(scene.svg.querySelector("text")?.getAttribute("data-num"), "0.42");
  assert.equal(scene.svg.querySelector("text")?.getAttribute("fill")?.toLowerCase(), "#006b4f");
  assert.ok(scene.table?.querySelector("table"));
  assert.match(scene.exportSVG(), /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  win.close();
});

test("tokens.css, site.scss, app.css frame v2, and cde.js dark chrome contrast (B14)", () => {
  // navbar clearance in site.scss + tokens.css
  assert.match(TOKENS_CSS, /--prx-nav-offset:\s*4\.5rem;/);
  assert.match(TOKENS_CSS, /--prx-touch-target:\s*2\.75rem;/);
  assert.match(TOKENS_CSS, /--prx-control-height:\s*2\.25rem;/);
  assert.match(TOKENS_CSS, /--prx-stage-radius:\s*10px;/);
  assert.match(SITE_SCSS, /html\s*\{\s*scroll-padding-top:\s*var\(--prx-nav-offset,\s*4\.5rem\);\s*\}/);

  // RC-13 outdated 960 x 540 comment removed; frame v2 rules present in app.css
  assert.ok(!APP_CSS.includes("960 x 540"), "outdated 960 x 540 header comment removed");
  assert.match(APP_CSS, /\.prx-widget\[data-prx-frame="v2"\]\s+\.prx-presets\s+\.prx-seg-buttons\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(APP_CSS, /\.prx-stage\s*\{[^}]*background:\s*var\(--prx-plot-bg\)/);
  assert.match(APP_CSS, /\.prx-scope:empty\s*\{\s*display:\s*none;\s*\}/);

  // B14: cde.js .prx-cd-note and .prx-cd-cue use --prx-fg-muted (7.2:1 in dark chrome, not 1.83:1 --prx-plot-muted)
  assert.match(CDE_COMMON_CSS, /\.prx-cd\s+\.prx-cd-note\s*\{[^}]*color:\s*var\(--prx-fg-muted\)/);
  assert.ok(!/\.prx-cd-note\s*\{[^}]*--prx-plot-muted/.test(CDE_COMMON_CSS));

  const { win, doc, el } = makeDom();
  doc.documentElement.setAttribute("data-theme", "dark");
  const app = mountCdeView(el, {}, { name: "cde-cuts", view: "cuts" });
  const injectedCss = doc.head.querySelector('style[data-prx-app="cde-cuts"]')?.textContent ?? "";
  assert.match(injectedCss, /\.prx-cd\s+\.prx-cd-cue\s*\{[^}]*color:\s*var\(--prx-fg-muted\)/);
  assert.ok(contrast("#a7b2ab", "#1f2623") >= 7.0, "dark --prx-fg-muted on --prx-bg-raised achieves >= 7:1 contrast");
  app.destroy();
  win.close();
});
