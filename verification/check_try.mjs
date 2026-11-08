#!/usr/bin/env node
// "What to try" numbers: every number a page quotes for a setting is what the app shows at that setting.
//   node verification/check_try.mjs [--only <name>]   (--only also takes an app that is still building)
// For each built app, its catalog entry lists `try`: [{ preset: "<id>" | query: "tau=.3", shows: ["...", ...] }].
// Each string in `shows` must appear (1) in the "What to try" section of the rendered page (docs/pages/<slug>/<name>.html)
// and (2) in the visible text of the app (or its figure's SVG text) after loading its embed with that preset or query.
// Numeric quotes must match whole display tokens. Selected examples additionally
// check their exact, visible result hooks so a tick or control cannot pass the quote.
// A built app with a "What to try" section must have try entries, and every bullet of the section must name at least
// one number that some entry checks (so a new number cannot slip in unchecked).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { shortNumericQuote, tryMatcher } from "./try_match.mjs";
import { appsFor, DOCS, launchChrome, openTab, pool, sleep, startServer, waitForWidgetIdle } from "./browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const apps = appsFor(only);
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
// an app that computes in stages keeps aria-busy="true" on its root until it is done (as check_browser and
// check_readouts read it); the quotes are compared only after that
const BUSY_MS = 30000;

// These quotes are semantically distinct from any matching axis or input value.
// Multiple selectors for one quote all have to pass.
const RESULT_TARGETS = {
  "conflict-pairs": {
    uncertain: { "0": ['[data-prx-readout="state-0-gamma"]', '[data-prx-readout="state-1-gamma"]'] },
    "zero-weight": { "0": ['[data-prx-readout="directional-min"]'] },
    "latent-ties": {
      ".6000": ['[data-prx-readout="criterion-0-forward"]'],
      ".9000": ['[data-prx-readout="criterion-0-reverse"]'],
    },
  },
  "composite-or-criterion": {
    known: { "0": ['[data-prx-readout="overview-composite-jAboveI"]'] },
    scale25: { ".250": ['[data-prx-readout="composite-0-0"]'] },
    ch19: {
      "75": ['[data-prx-readout="all-report-count"]'],
      "5": ['[data-prx-readout="criterion-N-1-2-2-3"]', '[data-prx-readout="composite-N-1-1-2-3"]'],
    },
  },
  "criterion-mixture": {
    "zero-weight": {
      "0": ['[data-prx-readout="directional-min"]', '[data-prx-readout="selected-branch-chance"]'],
      "1.0000": ['[data-prx-readout="selected-branch-risk"]'],
    },
  },
  "pairs-leave-open": {
    halfway: { ".250": ['[data-prx-readout="all-right"]'] },
    chapter: {
      ".870": ['[data-prx-readout="mean-correct"]'],
      ".750": ['[data-prx-readout="all-right"]'],
      "5": ['[data-prx-readout="selected-N"]'],
      "2.600": ['[data-prx-readout="state-1-A"]'],
    },
  },
};

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
let checked = 0, targeted = 0, shortUntargeted = 0;

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
    if (/\d/.test(b) && !all.some(tryMatcher(b))) fail(pagePath, `bullet ${i + 1} quotes numbers that no try entry checks: "${b.slice(0, 80)}…"`);
  });
  const pageHas = tryMatcher(section.text);
  for (const e of entries) {
    const query = e.preset ? `preset=${encodeURIComponent(e.preset)}` : String(e.query).replace(/^\?/, "");
    const where = `${a.name} ?${query}`;
    const resultTargets = RESULT_TARGETS[a.name]?.[e.preset] ?? {};
    for (const s of Object.keys(resultTargets)) if (!e.shows.includes(s)) fail(where, `missing the quoted result "${s}" for a configured target`);
    for (const s of e.shows) if (!pageHas(s)) fail(where, `"${s}" is not in the page's What to try`);
    const tab = await openTab(browser, { origin: server.origin, width: 1280, height: 720 });
    try {
      await tab.page.goto(`${server.origin}/embed/${a.name}.html?${query}&theme=light`, { waitUntil: "load" });
      await tab.page.waitForSelector(".prx-widget .prx-readout", { timeout: 10000 });
      await waitForWidgetIdle(tab.page, { timeout: BUSY_MS });
      await sleep(150);
      if(a.part==='P') {
        const summary=await tab.page.$('[data-mdv-details="data"] > summary');
        if(!summary)throw Error('Missing native exact-data disclosure');
        await summary.focus();await tab.page.keyboard.press('Enter');
        if(!await summary.evaluate(n=>n.parentElement.open))throw Error('Exact-data disclosure did not open with native Enter');
        await waitForWidgetIdle(tab.page,{timeout:BUSY_MS});
      }
      // A legacy try entry may name result-first disclosures to open (review 044 repair, decision I-4): the quoted
      // numbers then live in a closed box by design. Each named box must exist and open with native Enter.
      for (const name of Array.isArray(e.open) ? e.open : []) {
        const summary = await tab.page.$(`.prx-widget details[data-prx-disclosure="${String(name).replace(/["\\]/g, "\\$&")}"] > summary`);
        if (!summary) throw Error(`try entry names disclosure "${name}", which the app does not have`);
        await summary.focus(); await tab.page.keyboard.press("Enter");
        if (!await summary.evaluate((n) => n.parentElement.open)) throw Error(`disclosure "${name}" did not open with native Enter`);
        await waitForWidgetIdle(tab.page, { timeout: BUSY_MS });
        await sleep(100);
      }
      // visible text only, as laid out (innerText: blocks are separated, inline runs are not, so "5, medium" reads as
      // shown); hidden tables and screen-reader-only text do not count (this tab is closed right after)
      const { shown, targets } = await tab.page.evaluate(selectors => {
        const root = document.querySelector(".prx-widget");
        for (const n of root.querySelectorAll(".prx-sr-only")) n.remove();
        const visible = node => !node.closest("details:not([open]), [hidden]") && node.getClientRects().length &&
          (!node.checkVisibility || node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
        return {
          shown: root.innerText.replace(/\s+/g, " "),
          targets: Object.fromEntries(selectors.map(selector => {
            const nodes = [...root.querySelectorAll(selector)];
            const value = nodes.length === 1 && visible(nodes[0])
              ? (nodes[0].innerText ?? nodes[0].textContent).replace(/\s+/g, " ").trim() : null;
            return [selector, { count: nodes.length, value }];
          })),
        };
      }, Object.values(resultTargets).flat());
      const appHas = tryMatcher(shown);
      for (const s of e.shows) {
        checked++;
        const selectors = Object.hasOwn(resultTargets, s) ? resultTargets[s] : [];
        if (!selectors.length) {
          if (shortNumericQuote(s)) shortUntargeted++;
          if (!appHas(s)) fail(where, `the app does not show "${s}" as a complete value`);
        }
        for (const selector of selectors) {
          targeted++;
          const { count, value } = targets[selector];
          if (count !== 1 || value === null) fail(where, `"${s}" requires one visible result at ${selector} (found ${count})`);
          else if (value !== s) fail(where, `${selector} shows "${value}", expected "${s}"`);
        }
      }
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
console.log(`check_try: ${targeted} exact visible result target(s), ${shortUntargeted} short numeric quote(s) without a result selector`);
console.log(`check_try: ${apps.length} app(s), ${checked} quoted numbers compared with the app (P: natively expanded exact Data; legacy: default visible, or the disclosures a try entry names); ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
