import { test } from "node:test";
import assert from "node:assert/strict";
import { launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

const REGION = ".prx-rc-between-scroll";

test("2.13: the between-grade table is a labeled keyboard stop when it overflows", async (t) => {
  const server = await startServer();
  let browser;
  t.after(async () => {
    await browser?.close();
    await server.close();
  });
  browser = await launchChrome();

  for (const { width, query, overflows } of [
    { width: 1280, query: "preset=six-grade", overflows: false },
    { width: 375, query: "data=thirty&tau=.50&cap=6", overflows: true },
  ]) {
    await t.test(`${width}px`, async (subtest) => {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
      subtest.after(() => page.close());
      await page.goto(`${server.origin}/pages/grades/report-card.html?${query}`, { waitUntil: "load" });
      await waitForWidgetIdle(page);
      const region = await page.$eval(REGION, (node) => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({
          overflow: node.scrollWidth - node.clientWidth,
          tabIndex: node.getAttribute("tabindex"),
          role: node.getAttribute("role"),
          label: node.getAttribute("aria-label"),
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
        })));
      }));
      assert.ok(region.pageOverflow <= 1, "horizontal overflow stays inside the table region");
      assert.equal(region.overflow > 1, overflows);

      if (overflows) {
        assert.equal(region.tabIndex, "0");
        assert.equal(region.role, "region");
        assert.match(region.label, /Between-grade expected wrong shares/i);
        await page.focus(REGION);
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction((selector) => document.querySelector(selector).scrollLeft > 0, {}, REGION);
        assert.equal(await page.$eval(REGION, (node) => document.activeElement === node), true);
      } else {
        assert.equal(region.tabIndex, null);
        assert.equal(region.role, null);
        assert.equal(region.label, null);
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
    });
  }
});
