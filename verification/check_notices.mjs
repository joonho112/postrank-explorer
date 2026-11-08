// check_notices.mjs: every element of a required data notice is visible wherever the licensed data are shown
// (review 044, X-19). For each built app, the notices come from data/released/data_contract.json: the
// license_scopes[scope].required_notice of every file in the app's catalogue "data" list. The check opens the site
// page and the standalone page at 1280 x 800 in Chrome and looks for each element in the visible text (innerText) or
// in a visible link's address, in the page's main content: a site page's footer counts only for the author scope
// (its "CC BY 4.0" is the site licence for the author's own data); a standalone page carries it in its credit line.
// An app that shows a licensed file only in some of its settings names that setting below (STATE_FOR): the scope's
// notice is then checked at that preset, where the data are on screen.
//   node verification/check_notices.mjs [--only <name>]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appsFor, catalog, DOCS, launchChrome, openTab, pool, ROOT, sleep, startServer, waitForWidgetIdle } from "./browser.mjs";

const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const contract = JSON.parse(readFileSync(join(ROOT, "data/released/data_contract.json"), "utf8"));
/** Apps whose licensed data appear only in some settings: scope -> the preset that shows them. */
const STATE_FOR = {
  "why-withheld": { "cde-source-conditions": "cde", "cc-by-nc-krw": "krw" },
  "report-designer": { "cde-source-conditions": "cde", "cc-by-nc-krw": "krw", "cc-by-4.0-atlas": "alabama" },
};
const norm = (s) => String(s).toLowerCase().replace(/doi:\s*/g, "").replace(/[-‐‑–—\s]+/g, "");

function requiredByScope(app) {
  const out = {};
  for (const d of app.data ?? []) {
    const file = d.split("/").pop();
    const entry = contract.files?.[file] ?? contract.precomputed?.[file];
    if (!entry) continue;
    const list = contract.license_scopes?.[entry.license_scope]?.required_notice ?? [];
    if (list.length) out[entry.license_scope] = [...new Set([...(out[entry.license_scope] ?? []), ...list])];
  }
  return out;
}

const cat = catalog();
const slugOf = (a) => cat.parts.find((p) => p.key === a.part)?.slug;
const apps = appsFor(ONLY).filter((a) => Object.keys(requiredByScope(a)).length);
const server = await startServer(DOCS);
const browser = await launchChrome();
const failures = [];
let checked = 0;
const jobs = [];
for (const a of apps) {
  const scopes = requiredByScope(a);
  for (const mode of ["page", "embed"]) {
    const groups = new Map();
    for (const [scope, items] of Object.entries(scopes)) {
      const preset = STATE_FOR[a.name]?.[scope] ?? null;
      if (!groups.has(preset)) groups.set(preset, []);
      groups.get(preset).push([scope, items]);
    }
    for (const [preset, list] of groups) jobs.push({ a, mode, preset, list });
  }
}
await pool(jobs, 4, async ({ a, mode, preset, list }) => {
  const path = mode === "page" ? `pages/${slugOf(a)}/${a.name}.html` : `embed/${a.name}.html`;
  const query = preset ? `?preset=${encodeURIComponent(preset)}` : "";
  const where = `${a.id} ${a.name} ${mode}${preset ? ` ?preset=${preset}` : ""}`;
  const tab = await openTab(browser, { origin: server.origin, width: 1280, height: 800 });
  try {
    await tab.page.goto(`${server.origin}/${path}${query}`, { waitUntil: "load", timeout: 60000 });
    await tab.page.waitForSelector(".prx-widget .prx-readout", { timeout: 20000 });
    await waitForWidgetIdle(tab.page, { timeout: 45000 });
    await sleep(200);
    const shown = await tab.page.evaluate(() => {
      const textOf = (root) => (root ? root.innerText + " " + [...root.querySelectorAll("a[href]")].filter((x) => x.getClientRects().length).map((x) => x.href).join(" ") : "");
      const main = document.querySelector("main") ?? document.body;
      return { main: textOf(main), body: textOf(document.body) };
    });
    const mainText = norm(shown.main), bodyText = norm(shown.body);
    for (const [scope, items] of list) for (const s of items) {
      checked += 1;
      const text = scope === "author" ? bodyText : mainText;
      if (!text.includes(norm(s))) failures.push(`${where}: ${scope} notice element "${s}" is not visible${scope === "author" ? "" : " in the main content"}`);
    }
  } catch (err) {
    failures.push(`${where}: ${String(err?.message ?? err)}`);
  } finally {
    for (const x of tab.errors) failures.push(`${where}: console error: ${x}`);
    await tab.page.close();
  }
});
await browser.close();
await server.close();
for (const f of failures.sort()) console.log(`FAIL ${f}`);
console.log(`check_notices: ${apps.length} app(s) with licensed data, ${checked} notice elements checked on site and standalone pages; ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
