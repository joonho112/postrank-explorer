import assert from "node:assert/strict";
import { test } from "node:test";
import { launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

test("posterior tiers selects each displayed risk row natively and leaves the unsearched optimum disabled", async () => {
  const server = await startServer();
  const browser = await launchChrome();
  try {
    for (const width of [1280, 375]) {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width });
      try {
        await page.goto(`${server.origin}/embed/posterior-tiers.html?preset=league8-cuts`);
        await waitForWidgetIdle(page);
        const rows = await page.$$eval("[data-prx-risk-rule]", nodes => nodes.map(row => ({
          key: row.dataset.prxRiskRule,
          pairs: row.querySelector('[data-prx-readout$="-N"]').textContent,
          risk: row.querySelector('[data-prx-readout$="-risk"]').textContent,
          y: row.getBoundingClientRect().top,
        })));
        assert.deepEqual(rows.map(({ key, pairs, risk }) => [key, pairs, risk]), [
          ["pm-tiers", "21", ".1612"], ["pm-cuts", "17", ".1455"],
          ["optimum", "17", ".1455"], ["er-cuts", "17", ".1455"],
        ]);
        assert.ok(rows.every((row, i) => !i || row.y > rows[i - 1].y));
        await page.focus('[data-prx-risk-rule="pm-cuts"] input');
        await page.keyboard.press("ArrowDown");
        assert.equal(await page.$eval('[data-prx-risk-rule="optimum"] input', n => n.checked && n === document.activeElement), true);
        assert.match(await page.$eval(".prx-pt-hero", n => n.textContent), /Exact optimum.*17 pairs stated/);
        await page.select('select[name="data"]', "2");
        assert.equal(await page.$eval('[data-prx-risk-rule="optimum"] input', n => n.disabled && !n.checked), true);
        assert.match(await page.$eval('[data-prx-risk-rule="optimum"]', n => n.textContent), /Not searched: 30 units/);
        assert.equal(await page.$$eval("[data-prx-risk-rule]", nodes => nodes.length), 4);
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
