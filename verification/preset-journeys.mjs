// Compare a complete sequence of real preset gestures with one clean page load per preset.
// node verification/preset-journeys.mjs [--only app-name] [--width 375] [--jobs 3] [--output directory]
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { builtApps, launchChrome, openTab, pool, sleep, startServer, waitForWidgetIdle } from "./browser.mjs";

function getReading() {
  const widget = document.querySelector(".prx-widget");
  const headline = widget?.querySelector(".prx-readout");
  const text = n => (n?.innerText ?? n?.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    state: window.__prxApp?.state ?? null,
    headline: text(headline),
    numbers: [...(headline?.querySelectorAll("[data-num]") ?? [])].map(n => ({
      raw: n.getAttribute("data-num"), role: n.getAttribute("data-prx-readout"), text: text(n),
    })),
    // Inspect the complete descendant set, including hidden secondary readouts; old nodes can survive a preset switch.
    subtree: [...widget.querySelectorAll('[data-prx-part~="readout"] [data-num]')].map(n => n.getAttribute("data-num")),
    pressed: [...widget.querySelectorAll('.prx-presets button[aria-pressed="true"]')].map(b => b.dataset.value),
    error: widget.getAttribute("data-prx-error"),
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function reading(page) {
  await waitForWidgetIdle(page);
  let last = await page.evaluate(getReading);
  for (let i = 0; i < 5; i++) {
    await sleep(55);
    await waitForWidgetIdle(page);
    const next = await page.evaluate(getReading);
    if (equal(last, next)) return next;
    last = next;
  }
  throw Error("The visible reading did not settle.");
}

async function targetAtCenter(id, touch) {
  const button = [...document.querySelectorAll(".prx-presets button")].find(el => el.dataset.value === id);
  if (!button) throw Error("Missing preset button " + id);
  const track = button.closest(".prx-seg-buttons");
  const before = track?.scrollLeft ?? 0;
  const initial = button.getBoundingClientRect();
  const trackBox = track?.getBoundingClientRect();
  const clippedBefore = !!trackBox && (initial.left < trackBox.left - 1 || initial.right > trackBox.right + 1);
  button.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  // DOM scroll coordinates update synchronously. Wait until the touchscreen compositor sees the new position.
  if (touch) await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  const b = button.getBoundingClientRect();
  const x = b.left + b.width / 2, y = b.top + b.height / 2;
  const hit = document.elementFromPoint(x, y);
  return { x, y, width: b.width, height: b.height, hit: button.contains(hit), hitTag: hit?.tagName,
    strip: { scrollBefore: before, scrollAfter: track?.scrollLeft ?? 0, clippedBefore, clientWidth: track?.clientWidth, scrollWidth: track?.scrollWidth } };
}

async function load(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.__prxApp && !!document.querySelector(".prx-widget .prx-readout"), { timeout: 25000 });
}

export async function presetJourney(browser, origin, app, width) {
  const record = { id: app.id, name: app.name, width, presets: [], errors: [], failed: [] };
  const tabs = [];
  try {
    for (let i = 0; i < 2; i++) {
      const tab = await openTab(browser, { origin, width, height: width === 375 ? 812 : 800 });
      tabs.push(tab);
      await tab.page.setViewport({ width, height: width === 375 ? 812 : 800, hasTouch: width === 375, deviceScaleFactor: 1 });
      await tab.page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    }
    const [sequence, direct] = tabs.map(t => t.page);
    const base = `${origin}/pages/${app.slug}/${app.name}.html`;
    await load(sequence, base);
    await reading(sequence);
    for (const preset of app.presets) {
      const row = { preset: preset.id };
      record.presets.push(row);
      try {
        if (width === 375) await sequence.bringToFront();
        row.target = await sequence.evaluate(targetAtCenter, preset.id, width === 375);
        if (!row.target.hit) throw Error("Preset center was covered after scrolling.");
        const { x, y } = row.target;
        if (width === 375) await sequence.touchscreen.tap(x, y);
        else await sequence.mouse.click(x, y);
        const [clicked, fresh] = await Promise.all([
          sequence.waitForFunction(id => [...document.querySelectorAll(".prx-presets [aria-pressed=true]")]
            .some(b => b.dataset.value === id), { timeout: 1500, polling: 50 }, preset.id)
            .catch(() => null).then(() => reading(sequence)),
          load(direct, base + "?preset=" + encodeURIComponent(preset.id)).then(() => reading(direct)),
        ]);
        row.clicked = { state: clicked.state, pressed: clicked.pressed, headline: clicked.headline, numbers: clicked.numbers };
        row.fresh = { state: fresh.state, pressed: fresh.pressed, headline: fresh.headline, numbers: fresh.numbers };
        row.subtree = { clicked: clicked.subtree.length, fresh: fresh.subtree.length,
          clickedHash: digest(clicked.subtree), freshHash: digest(fresh.subtree) };
        row.checks = { state: equal(canonical(clicked.state), canonical(fresh.state)),
          pressed: equal(clicked.pressed, [preset.id]) && equal(fresh.pressed, [preset.id]),
          headline: clicked.headline === fresh.headline,
          numbersInOrder: equal(clicked.numbers, fresh.numbers),
          rawMultiplicity: equal(clicked.numbers.map(n => n.raw).sort(), fresh.numbers.map(n => n.raw).sort()),
          subtreeInOrder: equal(clicked.subtree, fresh.subtree),
          subtreeMultiplicity: equal([...clicked.subtree].sort(), [...fresh.subtree].sort()),
          renderer: !clicked.error && !fresh.error };
        if (!row.checks.subtreeInOrder) row.subtree.firstDifference = {
          clicked: clicked.subtree, fresh: fresh.subtree,
        };
        row.ok = Object.values(row.checks).every(Boolean);
      } catch (error) {
        row.error = String(error);
        row.ok = false;
      }
    }
  } catch (error) {
    record.error = String(error);
  } finally {
    for (const tab of tabs) {
      record.errors.push(...tab.errors);
      record.failed.push(...tab.failed);
      await tab.page.close();
    }
  }
  record.ok = !record.error && !record.errors.length && !record.failed.length &&
    record.presets.length === app.presets.length && record.presets.every(p => p.ok);
  return record;
}

async function main() {
  const { values } = parseArgs({ options: {
    only: { type: "string" }, width: { type: "string" }, output: { type: "string" }, jobs: { type: "string", default: "3" },
  } });
  const apps = builtApps().filter(a => !values.only || a.name === values.only || a.id === values.only);
  const widths = values.width ? [Number(values.width)] : [1280, 375];
  const jobs = Number(values.jobs);
  if (!apps.length || !widths.every(w => [1280, 375].includes(w)) || !Number.isInteger(jobs) || jobs < 1) throw Error("Invalid app, width, or jobs.");
  const directory = values.output && resolve(values.output);
  if (directory) await mkdir(directory, { recursive: true });
  const server = await startServer();
  let browser;
  const stats = {};
  try {
    browser = await launchChrome();
    for (const width of widths) {
      let done = 0;
      const records = [];
      let nextApp = 0;
      // A phone lane has its own browser: a new tab in another lane must never steal touch focus.
      await pool(Array.from({ length: Math.min(jobs, apps.length) }), jobs, async () => {
        const worker = width === 375 ? await launchChrome() : browser;
        try {
          while (nextApp < apps.length) {
            const app = apps[nextApp++];
            const result = await presetJourney(worker, server.origin, app, width);
            records.push(result);
            if (directory) await writeFile(join(directory, `${app.name}-${width}.json`), JSON.stringify(result) + "\n");
            if (++done % 15 === 0) console.log(`${width}px completed ${done}/${apps.length} apps`);
          }
        } finally {
          if (worker !== browser) await worker.close();
        }
      });
      const all = records.flatMap(r => r.presets);
      stats[width] = { apps: records.length, appPasses: records.filter(r => r.ok).length, presets: all.length,
        passed: all.filter(r => r.ok).length, hit: all.filter(r => r.target?.hit).length,
        clippedBefore: all.filter(r => r.target?.strip.clippedBefore).length,
        scrolledStrip: all.filter(r => r.target?.strip.scrollAfter !== r.target?.strip.scrollBefore).length,
        numericOrderPasses: all.filter(r => r.checks?.numbersInOrder).length,
        rawMultiplicityPasses: all.filter(r => r.checks?.rawMultiplicity).length,
        subtreeMultiplicityPasses: all.filter(r => r.checks?.subtreeMultiplicity).length,
        failures: records.filter(r => !r.ok).map(r => ({ id: r.id, name: r.name, error: r.error, console: r.errors, failed: r.failed,
          presets: r.presets.filter(x => !x.ok).map(x => ({ id: x.preset, error: x.error, failed: Object.keys(x.checks ?? {}).filter(k => !x.checks[k]) })) })) };
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  if (directory) await writeFile(join(directory, "summary.json"), JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats));
  if (Object.values(stats).some(s => s.appPasses !== s.apps)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(async () => {
      // Chromium's protocol client can leave timers in the parent after a multi-browser run.
      // main has already closed every owned browser and server and persisted the results.
      await Promise.all([process.stdout, process.stderr].map(stream => new Promise(done => stream.write("", done))));
      process.exit(process.exitCode ?? 0);
    });
}
