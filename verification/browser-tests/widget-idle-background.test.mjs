// DOM completion must remain observable when a background tab has no animation frames.
// The real S=4,000 app retains its 100 seeded runs; numeric pins come from independent R18.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOT, launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

const rows = JSON.parse(readFileSync(new URL("../golden/oracle-v3p1.json", import.meta.url), "utf8")).rows;
const pin = id => rows.find(row => row.id === id).expect;
const estimate = pin("drawErrorsOfGaussianDraws-pin-1.17-six-scoreA-S4000-seed1").e[0][0][1];
const mcse = pin("binomialMcse-pin-1.17-released-eAB-S4000").mcse;
const radius = pin("envelopeRadius-pin-1.17-M15-S4000-alpha.05-package").radius;
const entry = JSON.parse(readFileSync(new URL("../../catalog/entries/1.17-mc-error.json", import.meta.url), "utf8"));
const quotes = entry.try.find(item => item.preset === "s4000").shows;

function suspendFrames() {
  window.__frameRequests = 0;
  window.requestAnimationFrame = () => ++window.__frameRequests;
  window.cancelAnimationFrame = () => {};
}

test("Widget idle waiting observes DOM completion without animation frames", { timeout: 30000 }, async t => {
  const server = await startServer(ROOT, { virtual: { "/idle-fixture.html": "<!doctype html><title>Idle fixture</title><body></body>" } });
  const browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });

  await t.test("a busy widget finishes while animation frames stay suspended", async () => {
    const { page } = await openTab(browser, { origin: server.origin });
    try {
      await page.evaluateOnNewDocument(suspendFrames);
      await page.goto(`${server.origin}/idle-fixture.html`);
      await page.evaluate(() => {
        const root = document.createElement("div"); root.className = "prx-widget"; root.setAttribute("aria-busy", "true");
        window.__idleReads = 0;
        const original = root.getAttribute.bind(root);
        root.getAttribute = name => { if (name === "aria-busy") ++window.__idleReads; return original(name); };
        document.body.append(root);
      });
      const waiting = waitForWidgetIdle(page, { timeout: 1500 });
      await page.waitForFunction(() => window.__idleReads > 0, { polling: 10, timeout: 1000 });
      await page.evaluate(() => document.querySelector(".prx-widget").removeAttribute("aria-busy"));
      await waiting;
      assert.equal(await page.$eval(".prx-widget", node => node.hasAttribute("aria-busy")), false);
    } finally { await page.close(); }
  });

  await t.test("a missing or genuinely busy widget never passes", async () => {
    const { page } = await openTab(browser, { origin: server.origin });
    try {
      await page.evaluateOnNewDocument(suspendFrames);
      await page.goto(`${server.origin}/idle-fixture.html`);
      await assert.rejects(waitForWidgetIdle(page, { timeout: 150 }), error => error.name === "TimeoutError");
      await page.evaluate(() => { const root = document.createElement("div"); root.className = "prx-widget"; root.setAttribute("aria-busy", "true"); document.body.append(root); });
      await assert.rejects(waitForWidgetIdle(page, { timeout: 150 }), error => error.name === "TimeoutError");
      assert.equal(await page.$eval(".prx-widget", node => node.getAttribute("aria-busy")), "true");
    } finally { await page.close(); }
  });

  await t.test("S=4,000 completes all 100 runs and its numeric outputs without animation frames", async () => {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin });
    try {
      await page.evaluateOnNewDocument(() => {
        window.__sawBusy = false;
        new MutationObserver(() => { if (document.querySelector('.prx-widget')?.getAttribute('aria-busy') === 'true') window.__sawBusy = true; }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });
      });
      await page.evaluateOnNewDocument(suspendFrames);
      await page.goto(`${server.origin}/embed/mc-error.html?preset=s4000&theme=light`);
      await waitForWidgetIdle(page, { timeout: 5000 });
      const result = await page.evaluate(() => {
        const raw = key => Number(document.querySelector(`[data-prx-readout="${key}"]`).dataset.num);
        const totals = [...document.querySelectorAll('.prx-mce-runs table')].map(table => [...table.tBodies[0].rows].reduce((sum, row) => sum + Number(row.cells[2].querySelector('[data-num]')?.dataset.num ?? row.cells[2].dataset.num), 0));
        return { sawBusy: __sawBusy, frameRequests: __frameRequests, S: raw('runs-S'), runs: raw('runs-R'), from: raw('runs-from'), to: raw('runs-to'), estimate: raw('read-est'), mcse: raw('exact-se'), radius: raw('formula-radius'), totals, stale: document.querySelectorAll('.prx-mce-stale').length, text: document.querySelector('.prx-widget').innerText.replace(/\s+/g, ' ') };
      });
      assert.equal(result.sawBusy, true); assert.ok(result.frameRequests > 0);
      assert.equal(result.S, 4000); assert.equal(result.runs, 100); assert.equal(result.from, 1); assert.equal(result.to, 100);
      assert.equal(result.estimate, estimate); assert.ok(Math.abs(result.mcse - mcse) < 1e-12); assert.ok(Math.abs(result.radius - radius) < 1e-12);
      assert.deepEqual(result.totals, [100, 100]); assert.equal(result.stale, 0);
      for (const quote of quotes) assert.ok(result.text.includes(quote), `S=4,000 quote: ${quote}`);
      assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    } finally { await page.close(); }
  });
});
