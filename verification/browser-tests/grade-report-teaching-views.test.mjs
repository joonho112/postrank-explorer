import assert from "node:assert/strict";
import { test } from "node:test";
import { launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

const raw = (page, hook) => page.$eval(`[data-prx-readout="${hook}"]`, node => Number(node.dataset.num));
const readout = page => page.$eval(".prx-readout", node => node.innerText);
const selectNative = async (page, selector, key) => {
  await page.focus(selector);
  await page.keyboard.press(key);
};
const horizontalOverflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test("Grade report visuals keep live controls and their exact values together", async t => {
  const server = await startServer();
  const browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });

  for (const width of [375, 1280]) {
    await t.test(`${width}px`, async s => {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
      s.after(() => page.close());
      const open = async (app, query) => {
        await page.goto(`${server.origin}/embed/${app}.html?${query}`, { waitUntil: "load" });
        await waitForWidgetIdle(page);
      };

      await s.test("2.1: complementary axes and current pair tie", async () => {
        await open("one-pair", "preset=pi85-tau10");
        const marker = '[data-prx-formula="marker"]';
        const position = () => page.$eval(marker, node => ({
          raw: Number(node.dataset.num), x: node.getBoundingClientRect().x, label: node.textContent,
        }));
        const before = await position();
        const piTicks = await page.$$eval('[data-prx-pi-scale] [data-num]', nodes =>
          nodes.map(node => Number(node.dataset.num)));
        assert.deepEqual(piTicks, [1, .75, .5, .25, 0]);
        const bottom = await page.$$eval('g[aria-label="x-axis tick label"] text[data-num]', nodes =>
          nodes.map(node => Number(node.dataset.num)));
        assert.equal(bottom[0], 0);
        assert.equal(bottom.at(-1), 1);
        const pi = 'input[name="pi"]';
        await page.focus(pi);
        for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => window.__prxApp.state.pi === .9);
        const after = await position();
        assert.equal(before.raw, .15);
        assert.equal(after.raw, .10);
        assert.ok(after.x < before.x && /\.90.*\.10/.test(after.label), JSON.stringify({ before, after }));
        assert.equal(await raw(page, "best-cost"), .10);
        assert.match(await readout(page), /equally good/);
        if (width === 375) {
          const gap = await page.evaluate(() => document.querySelector('[data-prx-primary] svg').getBoundingClientRect().top
            - document.querySelector('input[name="pi"]').getBoundingClientRect().top);
          assert.ok(gap <= 250, `control-to-plot gap ${gap}px`);
        }
        assert.ok(await horizontalOverflow(page) <= 1);
      });

      await s.test("2.3: five distinguished families and all exact rows", async () => {
        await open("how-many-reports", "preset=three");
        const legend = '.prx-hmr-legend strong [data-num]';
        const values = () => page.$$eval(legend, nodes => nodes.map(node => Number(node.dataset.num)));
        assert.deepEqual(await values(), [13, 13, 6, 4, 6]);
        const colors = await page.$$eval(".prx-hmr-legend line", nodes =>
          nodes.map(node => getComputedStyle(node).stroke));
        assert.equal(new Set(colors).size, 5);
        const endpoints = await page.$$eval('[data-prx-family-end-counts] text[data-num]', nodes =>
          nodes.map(node => ({
            value: Number(node.dataset.num),
            top: node.getBoundingClientRect().top,
            remaining: node.closest("svg").getBoundingClientRect().right - node.getBoundingClientRect().right,
          })));
        assert.deepEqual(endpoints.map(row => row.value), [2048, 519156, 523251, 479001600, 28091567595]);
        for (let i = 1; i < endpoints.length; i++) assert.ok(endpoints[i - 1].top - endpoints[i].top >= 12);
        assert.ok(endpoints.every(row => row.remaining >= 2), JSON.stringify(endpoints));
        await selectNative(page, 'input[name="n"]', "End");
        await page.waitForFunction(() => window.__prxApp.state.n === 12);
        assert.deepEqual(await values(), [28091567595, 523251, 519156, 2048, 479001600]);
        const data = '[data-prx-disclosure="data"]';
        await selectNative(page, `${data} > summary`, "Enter");
        assert.ok(await page.$eval(data, node => node.open));
        assert.equal(await page.$$eval(`${data} .prx-hmr-table tbody tr`, nodes => nodes.length), 11);
        assert.ok(await horizontalOverflow(page) <= 1);
      });

      await s.test("2.5: the interval bands and risk use the same screen coordinates", async () => {
        const readGeometry = () => page.evaluate(() => {
          const main = document.querySelector(".prx-tp [data-prx-primary]");
          const strip = document.querySelector(".prx-tp-strip .prx-chart").parentElement;
          const pixels = (el, value) => {
            const chart = el.__prxChart;
            const frame = el.querySelector("svg").getBoundingClientRect();
            return frame.left + chart.result.scale("x").apply(value) * frame.width / chart.size.width;
          };
          const bends = [...strip.querySelectorAll("[data-prx-tick]")]
            .map(node => Number(node.dataset.num));
          const geometry = bends.map(value => ({ value, main: pixels(main, value), strip: pixels(strip, value) }));
          return { geometry, labels: bends, completeRows: document.querySelectorAll(".prx-tp-table tbody tr").length };
        });
        await open("tau-path", "preset=bend");
        const full = await readGeometry();
        assert.match(await readout(page), /equal-risk best reports/);
        assert.equal(full.labels[0], .02);
        assert.ok(full.labels.some(v => Math.abs(v - .144422183173242) < 1e-10));
        assert.ok(full.geometry.every(d => Math.abs(d.main - d.strip) <= 1), JSON.stringify(full));
        await open("tau-path", "preset=coherence");
        const low = await readGeometry();
        assert.equal(low.labels[0], 0);
        assert.ok(low.geometry.every(d => Math.abs(d.main - d.strip) <= 1), JSON.stringify(low));
        await selectNative(page, 'input[data-prx-focus-key="slider:tau-low"]', "ArrowRight");
        await page.waitForFunction(() => window.__prxApp.state.tau === .0051);
        const path = '[data-prx-disclosure="path"]';
        await selectNative(page, `${path} > summary`, "Enter");
        assert.ok(await page.$eval(path, node => node.open));
        assert.equal(await page.$$eval(".prx-tp-table tbody tr", rows => rows.length), full.completeRows);
        assert.ok(full.completeRows > full.labels.length);
        assert.ok(await horizontalOverflow(page) <= 1);
      });

      await s.test("2.9: the replay chart and slider select the same existing key", async () => {
        await open("reported-and-realized", "preset=same");
        const point = replay => `.prx-rr-section .prx-kbd-point[aria-label^="Observation replay ${replay}, realized"]`;
        const replay = () => raw(page, "selected-replay");
        const input = 'input[name="replay"]';
        const target = width === 375 ? 3 : 4;
        const node = await page.$(point(target));
        assert.ok(node, `found replay ${target} realized point`);
        if (width === 375) await node.tap();
        else await node.click();
        await page.waitForFunction(value => window.__prxApp.state.replay === value, {}, target);
        assert.equal(await replay(), target);
        assert.equal(await page.$eval(input, n => Number(n.value)), target);
        assert.equal(await raw(page, "posterior-draws"), 100);
        await selectNative(page, input, "ArrowRight");
        await page.waitForFunction(value => window.__prxApp.state.replay === value, {}, target + 1);
        assert.equal(await replay(), target + 1);
        await selectNative(page, point(5), "Enter");
        await page.waitForFunction(() => window.__prxApp.state.replay === 5);
        assert.equal(await replay(), 5);
        assert.equal(await raw(page, "posterior-draws"), 100);
        const localShares = await page.$$eval(".prx-rr-section .prx-rr-legend strong [data-num]", nodes =>
          nodes.map(node => Number(node.dataset.num)));
        assert.deepEqual(localShares, await Promise.all(["claimed-share", "reference-share", "realized-share"].map(hook => raw(page, hook))));
        const table = ".prx-rr-section details";
        await selectNative(page, `${table} > summary`, "Enter");
        assert.equal(await page.$$eval(`${table} tbody tr`, rows => rows.length), 20);
        assert.equal(await page.$$eval(`${table} tbody tr[aria-current="true"]`, rows => rows[0].cells[0].innerText), "5");
        assert.ok(await horizontalOverflow(page) <= 1);
      });

      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
    });
  }
});
