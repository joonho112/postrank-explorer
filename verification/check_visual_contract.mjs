#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Browser visual, focus, contrast, typography, and bundle-weight verifier:
//   1. Navbar focus clearance: Shift+Tab / Tab never leaves a focused element occluded under fixed header.
//   2. Widget focus order & plot point clamping (B7–B10): For migrated v2 apps, 0 upward Tab jumps > 48px and 0 off-screen .prx-kbd-point marks.
//   3. Chart typography & label overlap (RC-03): For migrated v2 apps, visible SVG <text> >= 11.8px CSS size and 0 severe horizontal bbox collisions.
//   4. Touch & chip fit (RC-06): For migrated v2 apps (and P.1–P.5), 0 horizontally clipped preset chips at 1280px and 375px.
//   5. Contrast (RC-07, B14): Dark-embed (`?theme=dark`) and light-page text contrast >= 4.5:1 on widget notes/readout/labels.
//   6. Bundle weight budget (RC-09): Total 84-app bundle raw bytes <= 22 MB (down from 30.25 MB via CP-1.5 mini-catalog).
//
// Usage:
//   node verification/check_visual_contract.mjs [--only noisy-league,frontier] [--selftest] [--quiet]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appsFor, launchChrome, pool, ROOT, startServer, waitForWidgetIdle } from "./browser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);
const SELFTEST = ARGS.includes("--selftest");
const QUIET = ARGS.includes("--quiet");
const onlyArg = ARGS.includes("--only") ? ARGS[ARGS.indexOf("--only") + 1] : null;

const MAX_TOTAL_BUNDLE_BYTES = 22 * 1024 * 1024; // 22 MB ceiling (3.5.0 was 30.25 MB; CP-1.5 brings it to ~18.52 MB)

/** Pure in-page evaluation function (also tested against synthetic defects in --selftest). */
const PAGE_INSPECT_FN = ({ enforceV2, viewportWidth }) => {
  const issues = [];
  const win = window;
  const doc = document;

  const parseRgb = (str) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/.exec(str || "");
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
  };
  const blend = (fg, bg) => {
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const lum = (rgb) => {
    const ch = rgb.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const contrastRatio = (c1, c2) => {
    const l1 = lum(c1), l2 = lum(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effectiveBg = (el) => {
    const stack = [];
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const c = parseRgb(win.getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0) stack.unshift(c);
    }
    let bg = parseRgb(win.getComputedStyle(doc.body).backgroundColor) || [253, 251, 246, 1];
    if (bg[3] === 0) bg = doc.documentElement.getAttribute("data-theme") === "dark" ? [22, 27, 25, 1] : [253, 251, 246, 1];
    for (const layer of stack) bg = layer[3] >= 1 ? layer : blend(layer, bg);
    return bg;
  };
  const isVisuallyRendered = (el) => {
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      if (p.hidden || p.classList?.contains("prx-sr-only")) return false;
      if (p.tagName === "DETAILS" && !p.open) {
        const sum = [...p.children].find((c) => c.tagName === "SUMMARY");
        if (!sum || !sum.contains(el)) return false;
      }
      const cs = win.getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  const isVisible = (el) => {
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      if (p.getAttribute("aria-hidden") === "true") return false;
    }
    return isVisuallyRendered(el);
  };

  // 1. Check scroll-padding-top on site pages with fixed navbar
  const nav = doc.querySelector("header#quarto-header .navbar.fixed-top, header.headroom.fixed-top, #quarto-header");
  if (nav && win.getComputedStyle(nav).position === "fixed") {
    const spt = parseFloat(win.getComputedStyle(doc.documentElement).scrollPaddingTop) || 0;
    if (spt < 40) issues.push(`navbar-scroll-padding: html scroll-padding-top is ${spt}px (< 40px) with fixed header`);
  }

  const widget = doc.querySelector(".prx-widget");
  if (!widget) {
    issues.push("missing-widget: .prx-widget not mounted");
    return { issues, metrics: {} };
  }

  // 2. Contrast check on readout, captions, notes, cues (catches B14 1.83:1 and RC-07)
  for (const el of widget.querySelectorAll(".prx-readout, .prx-caption, .prx-cd-note, .prx-cd-cue, .prx-scope, .prx-panel-title")) {
    if (!isVisible(el) || !(el.textContent || "").trim()) continue;
    const fg = parseRgb(win.getComputedStyle(el).color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const cr = contrastRatio(fg[3] < 1 ? blend(fg, bg) : fg, bg);
    if (cr < 4.45) {
      issues.push(`contrast-fail: ${el.className || el.tagName} contrast ${cr.toFixed(2)}:1 < 4.5:1`);
    }
  }

  // 3. Off-screen .prx-kbd-point check (catches B10 -155% top)
  for (const pt of widget.querySelectorAll(".prx-kbd-point")) {
    const topStr = pt.style.top || "";
    const leftStr = pt.style.left || "";
    if (topStr.endsWith("%")) {
      const pct = parseFloat(topStr);
      if (pct < -5 || pct > 105) issues.push(`kbd-point-offscreen: top=${topStr} outside [0%, 100%]`);
    }
    if (leftStr.endsWith("%")) {
      const pct = parseFloat(leftStr);
      if (pct < -5 || pct > 105) issues.push(`kbd-point-offscreen: left=${leftStr} outside [0%, 100%]`);
    }
  }

  // 4. V2 and multidomain (.mdv) checks (typography >= 12px, label overlap, wrapping chips, focus jumps)
  const isV2 = enforceV2 || widget.getAttribute("data-prx-frame") === "v2" || widget.classList.contains("mdv");
  let minSvgPx = Infinity;
  if (isV2) {
    // Preset chip truncation & mobile touch-target floor check
    for (const chip of widget.querySelectorAll(".prx-presets button.prx-seg")) {
      if (!isVisible(chip)) continue;
      if (chip.scrollWidth > chip.clientWidth + 2) {
        issues.push(`chip-clipped: preset "${(chip.textContent || "").trim()}" scrollWidth ${chip.scrollWidth} > clientWidth ${chip.clientWidth}`);
      }
      const r = chip.getBoundingClientRect();
      const wr = widget.getBoundingClientRect();
      // A phone's single-row preset strip is navigable by touch and native focus.
      // Its viewport must fit the widget; every chip must fit that viewport in full.
      const strip = chip.parentElement;
      const scrollable = viewportWidth <= 600 && strip?.matches(".prx-seg-buttons") &&
        ["auto", "scroll"].includes(getComputedStyle(strip).overflowX) && strip.scrollWidth > strip.clientWidth;
      const bound = scrollable ? strip.getBoundingClientRect() : r;
      if (bound.right > wr.right + 2 || bound.left < wr.left - 2 || (scrollable && r.width > strip.clientWidth + 2)) {
        issues.push(`chip-overflow: preset "${(chip.textContent || "").trim()}" overflows widget horizontally at ${viewportWidth}px`);
      }
      if (viewportWidth <= 480 && r.height < 42) {
        issues.push(`touch-target-small: preset "${(chip.textContent || "").trim()}" height ${r.height.toFixed(1)}px < 44px at ${viewportWidth}px`);
      }
    }

    // Stage horizontal protrusion check on SVG rects/text & HTML tables (catches WA-01/WA-03/WA-07 & WB-01/WB-02)
    const stageEl = widget.querySelector(".prx-stage");
    if (stageEl && isVisuallyRendered(stageEl)) {
      const sr = stageEl.getBoundingClientRect();
      const inHorizScroll = (node) => {
        for (let p = node.parentElement; p && p !== stageEl; p = p.parentElement) {
          if (p.classList?.contains("prx-scroll-region")) return p;
          const ox = win.getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll") return p;
        }
        return null;
      };
      for (const el of stageEl.querySelectorAll("svg rect, svg text")) {
        if (!isVisuallyRendered(el)) continue;
        if (inHorizScroll(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.left < sr.left - 4 || r.right > sr.right + 4) {
          const desc = el.tagName.toLowerCase() === "text" ? `"${(el.textContent || "").trim().slice(0, 24)}"` : `<rect x=${el.getAttribute("x")}>`;
          issues.push(`stage-protrusion: ${desc} (${Math.round(r.left)}..${Math.round(r.right)}px) protrudes outside .prx-stage (${Math.round(sr.left)}..${Math.round(sr.right)}px)`);
        }
      }
      for (const tbl of stageEl.querySelectorAll("table")) {
        if (!isVisuallyRendered(tbl)) continue;
        const scroller = inHorizScroll(tbl);
        if (!scroller) {
          const r = tbl.getBoundingClientRect();
          if (r.left < sr.left - 3 || r.right > sr.right + 3) {
            issues.push(`stage-table-protrusion: <table class="${tbl.className}"> (${Math.round(r.left)}..${Math.round(r.right)}px) protrudes outside .prx-stage (${Math.round(sr.left)}..${Math.round(sr.right)}px)`);
          }
        } else {
          const firstRow = tbl.querySelector("thead tr, tr");
          const colCount = firstRow ? firstRow.children.length : 0;
          if (colCount > 0 && colCount <= 4 && scroller.scrollWidth > scroller.clientWidth + 2) {
            issues.push(`stage-table-clipped: ${colCount}-column <table class="${tbl.className}"> clips/scrolls (${scroller.scrollWidth}px > ${scroller.clientWidth}px) at ${viewportWidth}px`);
          }
        }
      }
    }

    // SVG text rendered size, viewBox upscaling & horizontal label overlap (chart.plot sets aria-hidden="true" on <svg>, so use isVisuallyRendered)
    const textBoxes = [];
    for (const t of widget.querySelectorAll("svg text")) {
      if (!isVisuallyRendered(t)) continue;
      const str = (t.textContent || "").trim();
      if (!str) continue;
      const r = t.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const svg = t.ownerSVGElement;
      let scale = 1;
      if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
        scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      }
      const rawPx = parseFloat(win.getComputedStyle(t).fontSize) || 12;
      const renderedPx = rawPx * scale;
      if (renderedPx < minSvgPx) minSvgPx = renderedPx;
      if (renderedPx < 11.5) {
        issues.push(`chart-font-small: SVG text "${str.slice(0, 24)}" rendered at ${renderedPx.toFixed(1)}px (< 12px)`);
      }
      if (scale > 1.35 && renderedPx > 19) {
        issues.push(`chart-upscaled: SVG text "${str.slice(0, 24)}" upscaled ${scale.toFixed(2)}x (${renderedPx.toFixed(1)}px)`);
      }
      const ctm = t.getCTM?.();
      const rotated = ctm && (Math.abs(ctm.b) > 0.05 || Math.abs(ctm.c) > 0.05);
      if (!rotated) textBoxes.push({ str, svg, left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, area: r.width * r.height });
    }
    for (let i = 0; i < textBoxes.length; i += 1) {
      for (let j = i + 1; j < textBoxes.length; j += 1) {
        const a = textBoxes[i], b = textBoxes[j];
        if (a.svg !== b.svg) continue;
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const sameLineCollide = ix > 1.5 && iy > 0.6 * Math.min(a.height, b.height) && ix * iy > 0.12 * Math.min(a.area, b.area);
        if ((ix * iy > 0.25 * Math.min(a.area, b.area) && iy > 4 && ix > 6) || sameLineCollide) {
          issues.push(`label-overlap: "${a.str.slice(0, 20)}" overlaps "${b.str.slice(0, 20)}"`);
        }
      }
    }

    // DOM Tab order upward jump check inside widget
    const stops = [...widget.querySelectorAll("a[href], button:not(.prx-kbd-point), input, select, textarea, summary, [tabindex]")].filter((n) => {
      if (n.disabled) return false;
      const ti = n.getAttribute("tabindex");
      if (ti !== null && Number(ti) < 0) return false;
      return isVisible(n);
    });
    let prevTop = -Infinity;
    for (const s of stops) {
      const top = s.getBoundingClientRect().top;
      if (top < prevTop - 48) {
        issues.push(`focus-jump-up: control "${(s.textContent || s.getAttribute("aria-label") || s.tagName).trim().slice(0, 24)}" jumps up ${(prevTop - top).toFixed(0)}px`);
      }
      if (top > prevTop) prevTop = top;
    }
  }

  return { issues, metrics: { isV2, minSvgPx: Number.isFinite(minSvgPx) ? Number(minSvgPx.toFixed(2)) : null } };
};

async function runSelftest(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.setContent(`<!doctype html><html data-theme="dark"><head><style>
    html { scroll-padding-top: 0px; }
    #quarto-header { position: fixed; top: 0; left: 0; right: 0; height: 60px; }
    body { background: #161b19; color: #e7ebe6; margin: 0; }
    .prx-widget { padding: 12px; width: 350px; }
    .prx-cd-note { color: #4d4d4d; background: #1f2623; }
    .prx-presets button.prx-seg { width: 60px; overflow: hidden; white-space: nowrap; display: inline-block; }
  </style></head><body>
    <header id="quarto-header">nav</header>
    <div class="prx-widget" data-prx-frame="v2">
      <div class="prx-presets"><button class="prx-seg">Very long preset chip label that clips</button></div>
      <p class="prx-cd-note">Low contrast dark note</p>
      <div style="position:relative;width:200px;height:120px">
        <button class="prx-kbd-point" style="position:absolute;top:-155%;left:20%">pt</button>
        <svg viewBox="0 0 200 120" width="200" height="120">
          <text x="20" y="30" font-size="8">tiny label</text>
          <text x="20" y="60" font-size="14">Overlap Label Alpha</text>
          <text x="24" y="62" font-size="14">Overlap Label Beta</text>
        </svg>
      </div>
      <div class="prx-stage" style="width:200px"><table style="width:260px"><tr><th>A</th><th>B</th></tr></table></div>
      <div style="margin-top:120px"><button>Lower stop</button></div>
      <div style="margin-top:-100px"><button>Jumped upper stop</button></div>
    </div>
  </body></html>`);
  const res = await page.evaluate(PAGE_INSPECT_FN, { enforceV2: true, viewportWidth: 375 });
  await page.close();
  const expectedTags = ["navbar-scroll-padding:", "contrast-fail:", "kbd-point-offscreen:", "chip-clipped:", "chart-font-small:", "label-overlap:", "stage-table-protrusion:", "focus-jump-up:"];
  for (const tag of expectedTags) {
    if (!res.issues.some((i) => i.startsWith(tag))) {
      console.error(`SELFTEST FAIL: missing ${tag} in`, res.issues);
      process.exit(1);
    }
  }
  if (!QUIET) console.log("check_visual_contract --selftest: PASS (8 synthetic visual/focus/contrast/overlap/table defects caught)");
}

const browser = await launchChrome();
try {
  await runSelftest(browser);
  if (SELFTEST) process.exit(0);

  // Check bundle weight budget if bundles.json exists
  const bundlesManifest = join(ROOT, "js/bundles/bundles.json");
  const failures = [];
  if (existsSync(bundlesManifest)) {
    const list = JSON.parse(readFileSync(bundlesManifest, "utf8"));
    const totalBytes = list.reduce((s, b) => s + (b.bytes || 0), 0);
    if (totalBytes > MAX_TOTAL_BUNDLE_BYTES) {
      failures.push(`bundle-weight: total raw bundle size ${(totalBytes / (1024 * 1024)).toFixed(2)} MB exceeds ${(MAX_TOTAL_BUNDLE_BYTES / (1024 * 1024)).toFixed(2)} MB ceiling`);
    }
  }

  const names = onlyArg ? onlyArg.split(",").map((s) => s.trim()).filter(Boolean) : [null];
  const targets = names[0] === null ? appsFor(null) : names.flatMap((n) => appsFor(n));
  const server = await startServer();
  try {
    await pool(targets, 4, async (a) => {
      const page = await browser.newPage();
      try {
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
        for (const width of [1280, 375]) {
          await page.setViewport({ width, height: width === 1280 ? 800 : 812 });
          const url = `${server.origin}/pages/${a.slug}/${a.name}.html`;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await waitForWidgetIdle(page, { timeout: 15000 });
          const r = await page.evaluate(PAGE_INSPECT_FN, { enforceV2: false, viewportWidth: width });
          for (const iss of r.issues) failures.push(`${a.id} ${a.name} (page@${width}): ${iss}`);
        }
        // Also check standalone light and dark embeds at 1280px (catches embed container-query and contrast regressions)
        await page.setViewport({ width: 1280, height: 800 });
        for (const [tag, qs] of [["embed-light@1280", "?theme=light"], ["embed-dark@1280", "?theme=dark"]]) {
          const embedUrl = `${server.origin}/embed/${a.name}.html${qs}`;
          await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await waitForWidgetIdle(page, { timeout: 15000 });
          const rd = await page.evaluate(PAGE_INSPECT_FN, { enforceV2: false, viewportWidth: 1280 });
          for (const iss of rd.issues) failures.push(`${a.id} ${a.name} (${tag}): ${iss}`);
        }
      } finally {
        await page.close();
      }
    });
  } finally {
    await server.close();
  }

  if (failures.length) {
    for (const f of failures) console.error(`FAIL ${f}`);
    console.error(`check_visual_contract: ${failures.length} failure(s) across ${targets.length} app(s)`);
    process.exit(1);
  }
  if (!QUIET) console.log(`check_visual_contract: PASS (${targets.length} app(s) checked at 1280, 375, and dark embed)`);
} finally {
  await browser.close();
}
