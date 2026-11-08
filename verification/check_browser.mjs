#!/usr/bin/env node
// Browser check of the rendered site (docs/) in the system Chrome. Every request outside the local server is refused,
// so "loads" means "loads offline".
//   node verification/check_browser.mjs [--only <name>] [--no-timing] [--verbose]
// --only also takes an app that is still building (a builder in a worktree). --no-timing skips the speed step: timings
// are taken by the integrator, one app at a time, on a quiet machine.
// Checks
//   pages    every site page at 1280 x 800: no console error, no failed request; on an app page the app starts
//            within the first screen (at least FIRST_SCREEN_MIN px of it visible; it may run below), and there is no
//            horizontal scroll at 1280 and at 375 px
//   frames   every embed at 1280 x 800, light and dark (?theme=): no console error, no failed request, no horizontal
//            scroll, the theme reaches the app, the read-out is not empty
//   speed    each preset and five slider steps at CPU x4: every update renders within 150 ms. An app that renders
//            in stages keeps aria-busy="true" on its root until it is done: the budget is the synchronous part, and
//            the whole staged render must end within STAGED_MS
//   keyboard Tab reaches every control of the app and its figure (visible focus); arrows move a slider; Enter on a
//            preset button applies the preset
//   file://  every embed opens from the file system with no error
//   bridge   an embed inside an iframe follows postMessage({ prx: { preset } }) and ({ prx: { theme } }) from its parent
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { appsFor, docsPages, DOCS, launchChrome, openTab, pool, sleep, startServer } from "./browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const verbose = args.includes("--verbose");
const timing = !args.includes("--no-timing");
const BUDGET_MS = 150;
// PRX_PAGE_HEIGHT and PRX_BUDGET_MS exist to see the checks fail on purpose (for example PRX_PAGE_HEIGHT=600)
const PAGE_H = Number(process.env.PRX_PAGE_HEIGHT) || 800;
/** A Tab step that moves focus this far back up the page is reported (a warning, not a failure). */
const CONFIG_TAB_UP_PX = 40;
const BUDGET = Number(process.env.PRX_BUDGET_MS) || BUDGET_MS;
const FIRST_SCREEN_MIN = 200;
const STAGED_MS = 3000;
const FRAMES = [[1280, 800]];
const THEMES = ["light", "dark"];
const JOBS = 6;

const apps = appsFor(only);
const failures = [];
const notes = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

const server = await startServer(DOCS, {
  virtual: Object.fromEntries(apps.map((a) => [`/__frame-${a.name}.html`,
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0"><iframe id="f" src="/embed/${a.name}.html" style="border:0;width:1280px;height:720px"></iframe></body></html>`])),
});
const browser = await launchChrome();
const t0 = Date.now();

async function visit(url, opts, work) {
  const tab = await openTab(browser, { origin: server.origin, ...opts });
  try {
    await tab.page.goto(url, { waitUntil: "load", timeout: 30000 });
    await sleep(150);
    return await work(tab);
  } catch (err) {
    return { error: String(err?.message ?? err) };
  } finally {
    await tab.page.close();
  }
}

const report = (where, tab, extra = {}) => {
  if (extra.error) fail(where, extra.error);
  for (const e of tab?.errors ?? []) fail(where, `console error: ${e}`);
  for (const f of tab?.failed ?? []) fail(where, f);
};

// ------------------------------------------------------------------------------------------------- pages
const appPages = new Map(apps.map((a) => [`pages/${a.slug}/${a.name}.html`, a]));
const pages = docsPages().filter((p) => !p.startsWith("embed/") && (!only || appPages.has(p)));
await pool(pages, JOBS, async (p) => {
  let tab;
  const res = await visit(`${server.origin}/${p}`, { width: 1280, height: PAGE_H }, async (t) => {
    tab = t;
    if (!appPages.has(p)) return {};
    await t.page.waitForSelector(".prx-widget", { timeout: 10000 });
    await sleep(200);
    const m = await t.page.evaluate(() => {
      const r = document.querySelector(".prx-widget").getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth };
    });
    if (m.top < 0 || m.top > m.h - FIRST_SCREEN_MIN) fail(p, `app does not start within the first screen at 1280 x ${PAGE_H} (its top is at ${Math.round(m.top)} px; at least ${FIRST_SCREEN_MIN} px of it must show)`);
    if (m.sw > m.w + 1) fail(p, `horizontal scroll at 1280 px (${m.sw} px wide)`);
    await t.page.setViewport({ width: 375, height: 812 });
    await sleep(300);
    const sw = await t.page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 376) fail(p, `horizontal scroll at 375 px (${sw} px wide)`);
    // every preset at 375 px too: a preset can show a wider table or control than the default setting
    for (const pr of appPages.get(p).presets ?? []) {
      const psw = await t.page.evaluate(async (id, limit) => {
        window.__prxApp.applyPreset(id);
        await new Promise((r) => setTimeout(r, 120));
        const root = document.querySelector(".prx-widget");
        const t0 = performance.now();
        while (root.getAttribute("aria-busy") === "true" && performance.now() - t0 < limit) await new Promise((r) => setTimeout(r, 20));
        return document.documentElement.scrollWidth;
      }, pr.id, STAGED_MS);
      if (psw > 376) fail(p, `preset ${pr.id}: horizontal scroll at 375 px (${psw} px wide)`);
    }
    return { app: Math.round(m.bottom) };
  });
  report(p, tab, res);
  if (verbose) notes.push(`page ${p}${res.app ? ` (app bottom ${res.app} px)` : ""}`);
});

// ------------------------------------------------------------------------------------------------- frames
const lum = (rgb) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb);
  if (!m) return NaN;
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
};
const frameJobs = [];
for (const a of apps) for (const [w, h] of FRAMES) for (const theme of THEMES) frameJobs.push({ a, w, h, theme });
await pool(frameJobs, JOBS, async ({ a, w, h, theme }) => {
  const where = `embed/${a.name}.html ${w}x${h} ${theme}`;
  let tab;
  const res = await visit(`${server.origin}/embed/${a.name}.html?theme=${theme}`, { width: w, height: h }, async (t) => {
    tab = t;
    await t.page.waitForSelector(".prx-widget", { timeout: 10000 });
    await sleep(250);
    const m = await t.page.evaluate(() => {
      const de = document.documentElement;
      const root = document.querySelector(".prx-widget");
      return {
        sw: de.scrollWidth, iw: innerWidth, theme: de.getAttribute("data-theme"),
        bg: getComputedStyle(document.body).backgroundColor, readout: root.querySelector(".prx-readout")?.textContent ?? "",
      };
    });
    if (m.sw > m.iw + 1) fail(where, `horizontal scroll (content ${m.sw} px wide in a ${m.iw} px frame)`);
    if (m.theme !== theme) fail(where, `data-theme is ${m.theme}`);
    const L = lum(m.bg);
    if (theme === "dark" ? !(L < 0.1) : !(L > 0.6)) fail(where, `page background ${m.bg} does not look ${theme}`);
    if (!m.readout.trim()) fail(where, "empty read-out");
    return {};
  });
  report(where, tab, res);
  if (verbose) notes.push(where);
});

// ------------------------------------------------------------------------------------------------- speed and keyboard
// one app at a time: timings taken while other tabs load measure the machine, not the app
await pool(apps, 1, async (a) => {
  const where = `embed/${a.name}.html`;
  let tab;
  const res = await visit(`${server.origin}/embed/${a.name}.html?theme=light`, { width: 1280, height: 720 }, async (t) => {
    tab = t;
    const { page } = t;
    await page.waitForSelector(".prx-widget", { timeout: 10000 });
    // --- speed at CPU x4: presets (applyPreset renders synchronously) and slider steps (keyboard). An app may make
    // its controls again when a preset changes them, so each control is looked up where it is used.
    // the first visible, enabled slider (an app may hide a control at some settings)
    const findSlider = async () => {
      const hdl = await page.evaluateHandle(() => [...document.querySelectorAll(".prx-widget input[type=range]")].find((n) =>
        !n.matches(":disabled") && n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        && !n.closest("details:not([open])")) ?? null);
      const el = hdl.asElement();
      if (!el) await hdl.dispose();
      return el;
    };
    let slowest = NaN;
    if (timing) {
      const cdp = await page.createCDPSession();
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const times = [];
      for (const p of [...(a.presets ?? []), ...(a.presets ?? [])]) {
        times.push(await page.evaluate((id) => { const t0 = performance.now(); window.__prxApp.applyPreset(id); return performance.now() - t0; }, p.id));
        const staged = await page.evaluate(async (limit) => {
          const root = document.querySelector(".prx-widget");
          const t0 = performance.now();
          while (root.getAttribute("aria-busy") === "true" && performance.now() - t0 < limit) await new Promise((r) => setTimeout(r, 20));
          return root.getAttribute("aria-busy") === "true" ? -1 : performance.now() - t0;
        }, STAGED_MS);
        if (staged < 0) fail(where, `preset ${p.id}: the staged render was still busy after ${STAGED_MS} ms at CPU x4`);
      }
      const slider = await findSlider();
      if (slider) {
        await slider.focus();
        // step away from the end the slider sits at, so every press is a real update
        const atMax = await slider.evaluate((n) => Number(n.value) >= Number(n.max));
        for (let k = 0; k < 5; k += 1) {
          await page.keyboard.press(atMax ? "ArrowLeft" : "ArrowRight");
          times.push(await page.evaluate(() => Number(document.querySelector(".prx-widget").dataset.renderMs)));
        }
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      slowest = Math.max(...times);
      if (!(slowest <= BUDGET)) fail(where, `an update took ${slowest.toFixed(1)} ms at CPU x4 (budget ${BUDGET} ms)`);
    }
    // --- keyboard: Tab from the top reaches every control and the figure's keyboard points, once a staged render
    // started by the last update has finished (its second stage may make figures and their keyboard layers again)
    await page.evaluate(async (limit) => {
      const root = document.querySelector(".prx-widget");
      const t0 = performance.now();
      while (root.getAttribute("aria-busy") === "true" && performance.now() - t0 < limit) await new Promise((r) => setTimeout(r, 20));
      // scrollRegion initially exposes a stop, then measures overflow across two animation
      // frames. Count the final layout after staged work replaces tables and their regions.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, STAGED_MS);
    async function walkKeyboard(label) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      const root = document.querySelector('.prx-widget'), previous = root.getAttribute('tabindex');
      root.setAttribute('tabindex', '-1'); root.focus();
      if (previous === null) root.removeAttribute('tabindex'); else root.setAttribute('tabindex', previous);
      root.querySelectorAll('[data-kb]').forEach(n => n.removeAttribute('data-kb'));
    });
    const wanted = await page.evaluate(() => {
      const root = document.querySelector(".prx-widget");
      const visible = n => {
        if (!n.getClientRects().length || !n.checkVisibility({visibilityProperty:true})) return false;
        for (let p=n.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS'&&!p.open) {
          const summary=[...p.children].find(c=>c.tagName==='SUMMARY');
          if (!summary?.contains(n)) return false;
        }
        return true;
      };
      const all = [...root.querySelectorAll("input, button, select, summary, [tabindex='0']")].filter((n) => !n.disabled && visible(n) && n.tabIndex >= 0);
      // a radio group is one Tab stop (the checked radio, else the first), as in Chrome and base.js tabOrder()
      const stopOf = (r) => { const g = all.filter((x) => x.type === "radio" && x.name === r.name); return g.find((x) => x.checked) ?? g[0]; };
      // a figure's keyboard points are one stop, counted by the figure's place among the keyboard layers: an app may
      // redraw one figure when focus in another changes the selection, so its points are new nodes
      const plain = all.filter((n) => !n.closest(".prx-kbd-layer") && (!(n.tagName === "INPUT" && n.type === "radio" && n.name) || stopOf(n) === n));
      plain.forEach((n, i) => n.setAttribute("data-kb", String(i)));
      const layers = [...root.querySelectorAll(".prx-kbd-layer")].filter((l) => l.querySelector("[tabindex='0']") && visible(l));
      // Explicit SVG indicators must be transparent before focus. An always-painted mark is not a focus ring.
      root.querySelectorAll('[data-prx-focus-ring]').forEach(n=>n.dataset.kbUnfocusedStroke=getComputedStyle(n).stroke);
      return plain.length + layers.length;
    });
    const seen = new Set();
    const ringMissing = new Set();
    const upMoves = [];
    let prevStop = null;
    for (let k = 0; k < wanted + 12 && seen.size < wanted; k += 1) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const n = document.activeElement;
        if (!n) return null;
        const layer = n.closest(".prx-kbd-layer");
        const root = document.querySelector(".prx-widget");
        const id = layer && root.contains(layer) ? `layer:${[...root.querySelectorAll(".prx-kbd-layer")].indexOf(layer)}` : n.getAttribute("data-kb");
        if (id === null) return null;
        const cs = getComputedStyle(n);
        const opaque = color => color !== 'none' && color !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/.test(color);
        const svgRing = [...n.querySelectorAll('[data-prx-focus-ring]')].some(r=>{
          const s=getComputedStyle(r),b=r.getBoundingClientRect();
          return opaque(s.stroke)&&!opaque(r.dataset.kbUnfocusedStroke)&&parseFloat(s.strokeWidth)>=2&&Number(s.strokeOpacity)*Number(s.opacity)>0&&b.width>0&&b.height>0;
        });
        const box = n.getBoundingClientRect();
        return { id, key:n.dataset.prxFocusKey??n.tagName+':'+id, ring: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && opaque(cs.outlineColor)) || svgRing, top: box.top + scrollY };
      });
      if (f) {
        seen.add(f.id); if (!f.ring) ringMissing.add(f.key);
        // review 044 repair (pilot review S3): report, without failing, a Tab step that jumps back up the page
        if (prevStop && f.top < prevStop.top - CONFIG_TAB_UP_PX) upMoves.push(`${prevStop.key} → ${f.key} (${Math.round(prevStop.top)} → ${Math.round(f.top)} px)`);
        prevStop = f;
      }
    }
    if (upMoves.length) console.log(`WARN ${where}: ${label}: Tab moves back up the page ${upMoves.length}×: ${upMoves.slice(0, 3).join("; ")}`);
    // a figure's keyboard points are one Tab stop (roving tabindex): only the point with tabindex 0 is counted
    if (seen.size < wanted) fail(where, `${label}: Tab reached ${seen.size} of ${wanted} controls`);
    if (ringMissing.size) fail(where, `${label}: focused controls without a visible focus ring: ${[...ringMissing].join(', ')}`);
    return `${label} ${seen.size}/${wanted}`;
    }
    const stops = [await walkKeyboard('default')];
    // Expand through native summary activation, then inspect the real keyboard surface of the audit data too.
    if (await page.$('[data-mdv-details]')) {
      for (const kind of ['settings','data']) {
        const summary=await page.$(`[data-mdv-details="${kind}"] > summary`);
        if (summary) {
          const open=await summary.evaluate(n=>n.parentElement.open);
          if(!open){await summary.focus();await page.keyboard.press('Enter');}
          if(!await summary.evaluate(n=>n.parentElement.open))fail(where,`${kind}: Enter did not open the disclosure`);
        }
      }
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      stops.push(await walkKeyboard('expanded'));
    }
    const slider = await findSlider();
    if (slider) {
      const before = await page.evaluate(() => JSON.stringify(window.__prxApp.state));
      await slider.focus();
      // step away from the end the slider sits at (an app may open with a slider at its minimum)
      const atMin = await slider.evaluate((n) => Number(n.value) <= Number(n.min));
      await page.keyboard.press(atMin ? "ArrowRight" : "ArrowLeft");
      await page.keyboard.press(atMin ? "ArrowRight" : "ArrowLeft");
      const after = await page.evaluate(() => JSON.stringify(window.__prxApp.state));
      if (before === after) fail(where, "arrow keys on the slider did not change the state");
    }
    const presetButtons = await page.$$(".prx-presets .prx-seg");
    if (presetButtons.length) {
      const last = presetButtons[presetButtons.length - 1];
      await last.focus();
      if(!await last.evaluate(n=>n===document.activeElement))fail(where,'preset button did not receive keyboard focus');
      await page.keyboard.press("Enter");
      const on = await page.evaluate((el) => el.getAttribute("aria-pressed"), last);
      if (on !== "true") fail(where, "Enter on a preset button did not apply it");
    }
    return { slowest: timing ? slowest.toFixed(1) : null, stops: stops.join('; ') };
  });
  report(`${where} (${timing ? "speed, " : ""}keyboard)`, tab, res);
  if (verbose && res.stops) notes.push(`${where}: ${res.slowest ? `slowest update ${res.slowest} ms at CPU x4; ` : ""}Tab reached ${res.stops}`);
});

// ------------------------------------------------------------------------------------------------- file:// and bridge
await pool(apps, JOBS, async (a) => {
  {
    const where = `file://docs/embed/${a.name}.html`;
    let tab;
    const url = `${pathToFileURL(join(DOCS, "embed", `${a.name}.html`)).href}?theme=dark`;
    const res = await visit(url, { width: 1280, height: 720 }, async (t) => {
      tab = t;
      await t.page.waitForSelector(".prx-widget .prx-readout", { timeout: 10000 });
      const txt = await t.page.evaluate(() => document.querySelector(".prx-readout").textContent);
      if (!txt.trim()) fail(where, "empty read-out");
      return {};
    });
    report(where, tab, res);
  }
  const where = `bridge embed/${a.name}.html`;
  let tab;
  const res = await visit(`${server.origin}/__frame-${a.name}.html`, { width: 1300, height: 760 }, async (t) => {
    tab = t;
    const frame = await (await t.page.waitForSelector("#f")).contentFrame();
    await frame.waitForSelector(".prx-widget .prx-readout", { timeout: 10000 });
    const target = (a.presets ?? []).at(-1);
    if (!target) { fail(where, "no preset to send"); return {}; }
    await t.page.evaluate((id) => document.getElementById("f").contentWindow.postMessage({ prx: { preset: id } }, "*"), target.id);
    await sleep(200);
    const pressed = await frame.evaluate(() => [...document.querySelectorAll(".prx-presets .prx-seg[aria-pressed=true]")].map((b) => b.textContent));
    if (pressed.length !== 1 || pressed[0] !== target.label) fail(where, `after postMessage({prx: {preset: "${target.id}"}}) the pressed preset is ${JSON.stringify(pressed)}`);
    await t.page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ prx: { theme: "dark" } }, "*"));
    await sleep(200);
    const theme = await frame.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (theme !== "dark") fail(where, `after postMessage({prx: {theme: "dark"}}) the embed's theme is ${theme}`);
    return {};
  });
  report(where, tab, res);
});

await browser.close();
await server.close();
const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (verbose) for (const n of notes) console.log(`  ${n}`);
for (const f of failures) console.log(`FAIL ${f}`);
console.log(`check_browser: ${pages.length} pages, ${frameJobs.length} embed frames, ${apps.length} app(s) ${timing ? "timed and " : ""}keyboard-checked, ${apps.length} file:// loads, ${apps.length} bridge(s); ${failures.length} failure(s) in ${secs} s`);
process.exit(failures.length ? 1 : 0);
