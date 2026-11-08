import assert from "node:assert/strict";
import { test } from "node:test";
import { launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

test("the exact cost path moves its guide with the native slider and shows misses only for the active families", async () => {
  const server = await startServer();
  const browser = await launchChrome();
  try {
    for (const width of [1280, 375]) {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width });
      try {
        const url = `${server.origin}/embed/order-misses.html`;
        await page.goto(`${url}?preset=tau25`);
        await waitForWidgetIdle(page);
        const guide = () => page.$eval("[data-prx-current-tau]", g => ({
          tau: Number(g.dataset.prxCurrentTau), x: Number(g.querySelector("line").getAttribute("x1")),
        }));
        const missRects = () => page.$$eval('[data-prx-miss-band] rect', nodes => nodes.length);
        assert.equal(await missRects(), 1);
        assert.deepEqual(await page.$$eval('[data-prx-tie-prices] text', nodes => nodes.map(n => n.textContent).sort()), [".15", ".30", ".35"]);
        const before = await guide();
        const selector = '[data-prx-primary-control] input[type="range"]';
        await page.focus(selector);
        await page.keyboard.press("ArrowRight");
        const after = await guide();
        assert.equal(before.tau, .25);
        assert.equal(after.tau, .26);
        assert.ok(after.x > before.x);
        assert.equal(await page.$eval(selector, n => n === document.activeElement), true);
        await page.$eval(selector, n => {
          n.value = ".30";
          n.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await page.waitForFunction(() => document.querySelector(".prx-readout").textContent.includes("Tied at .2000"));
        assert.match(await page.$eval(".prx-readout", n => n.textContent), /2\/1\/2 \(N 2\).*3\/1\/2 \(N 3\)/);
        assert.equal(await page.$$eval('details[data-prx-disclosure="all-reports"] tbody tr', nodes => nodes.length), 13);
        await page.goto(`${url}?cap=1&opt=cap`);
        await waitForWidgetIdle(page);
        assert.equal(await missRects(), 0);
        assert.doesNotMatch(await page.$eval(".prx-readout", n => n.textContent), /misses above/);
        assert.deepEqual(errors, []);
        assert.deepEqual(failed, []);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
