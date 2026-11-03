#!/usr/bin/env node
// "What to try" numbers: every number a page quotes for a setting is what the app shows at that setting.
//   node verification/check_try.mjs [--only <name>]   (--only also takes an app that is still building)
// For each built app, its catalog entry lists `try`: [{ preset: "<id>" | query: "tau=.3", shows: ["...", ...] }].
// Each string in `shows` must appear (1) in the "What to try" section of the rendered page (docs/pages/<slug>/<name>.html)
// and (2) in the visible text of the app (or its figure's SVG text) after loading its embed with that preset or query.
// A built app with a "What to try" section must have try entries, and every bullet of the section must name at least
// one number that some entry checks (so a new number cannot slip in unchecked).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { appsFor, DOCS, launchChrome, openTab, pool, sleep, startServer, waitForWidgetIdle } from "./browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const apps = appsFor(only);
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
// an app that computes in stages keeps aria-busy="true" on its root until it is done (as check_browser and
// check_readouts read it); the quotes are compared only after that
const BUSY_MS = 30000;

const decode = (s) => s.replace(/<[^>]+>/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** The "What to try" section of a rendered page: its whole text and its bullets. */
function trySection(html) {
  const m = /<section id="what-to-try"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  if (!m) return null;
  const bullets = [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((b) => decode(b[1]).trim());
  return { text: decode(m[1]), bullets };
}

const server = await startServer(DOCS);
const browser = await launchChrome();
let checked = 0;

await pool(apps, 4, async (a) => {
  const pagePath = `pages/${a.slug}/${a.name}.html`;
  const file = join(DOCS, pagePath);
  if (!existsSync(file)) { fail(a.name, `${pagePath} not rendered`); return; }
  const section = trySection(readFileSync(file, "utf8"));
  const entries = a.try ?? [];
  if (!section) { fail(pagePath, 'no "What to try" section'); return; }
  if (!entries.length) { fail(a.name, "catalog entry has no try list"); return; }
  const all = entries.flatMap((e) => e.shows);
  section.bullets.forEach((b, i) => {
    if (/\d/.test(b) && !all.some((s) => b.includes(s))) fail(pagePath, `bullet ${i + 1} quotes numbers that no try entry checks: "${b.slice(0, 80)}…"`);
  });
  for (const e of entries) {
    const query = e.preset ? `preset=${encodeURIComponent(e.preset)}` : String(e.query).replace(/^\?/, "");
    const where = `${a.name} ?${query}`;
    for (const s of e.shows) if (!section.text.includes(s)) fail(where, `"${s}" is not in the page's What to try`);
    const tab = await openTab(browser, { origin: server.origin, width: 1280, height: 720 });
    try {
      await tab.page.goto(`${server.origin}/embed/${a.name}.html?${query}&theme=light`, { waitUntil: "load" });
      await tab.page.waitForSelector(".prx-widget .prx-readout", { timeout: 10000 });
      await waitForWidgetIdle(tab.page, { timeout: BUSY_MS });
      await sleep(150);
      // visible text only, as laid out (innerText: blocks are separated, inline runs are not, so "5, medium" reads as
      // shown); hidden tables and screen-reader-only text do not count (this tab is closed right after)
      const shown = await tab.page.evaluate(() => {
        const root = document.querySelector(".prx-widget");
        for (const n of root.querySelectorAll(".prx-sr-only")) n.remove();
        return root.innerText.replace(/\s+/g, " ");
      });
      for (const s of e.shows) { checked += 1; if (!shown.includes(s)) fail(where, `the app does not show "${s}"`); }
    } catch (err) {
      fail(where, String(err?.message ?? err));
    } finally {
      for (const x of tab.errors) fail(where, `console error: ${x}`);
      await tab.page.close();
    }
  }
});

await browser.close();
await server.close();
for (const f of failures) console.log(`FAIL ${f}`);
console.log(`check_try: ${apps.length} app(s), ${checked} quoted numbers compared with the app; ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
