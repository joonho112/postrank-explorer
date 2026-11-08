import assert from "node:assert/strict";
import { test } from "node:test";
import { launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

const raw = (page, name) => page.$eval(`[data-prx-readout="${name}"]`, node => Number(node.dataset.num));
const headline = page => page.$eval(".prx-readout", node => node.innerText);

test("Grade report first views and exact details preserve their meanings", async t => {
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
      const press = async (selector, key) => {
        await page.focus(selector);
        await page.keyboard.press(key);
        await waitForWidgetIdle(page);
      };

      await s.test("2.12: no disclosure and the single-criterion dominance wording", async () => {
        await open("families", "example=six&family=atmost&G=1&tau=.2");
        assert.match(await headline(page), /states no pair directions/);
        assert.doesNotMatch(await headline(page), /Every direction/);
        await open("families", "preset=dominance");
        assert.match(await headline(page), /error/);
        assert.doesNotMatch(await headline(page), /weighted error/);
        const tracks = await page.$$eval(".prx-fam-bar", bars => bars.map(bar => {
          const { x, width } = bar.getBoundingClientRect();
          return [x, width];
        }));
        assert.equal(tracks.length, 4);
        assert.ok(tracks.every(track => track.every((value, i) => Math.abs(value - tracks[0][i]) <= 1)), JSON.stringify(tracks));
      });

      await s.test("2.13: the same-grade diagonal and the grade means have different scales", async () => {
        await open("report-card", "preset=six-grade");
        const read = () => page.evaluate(() => ({
          diagonal: [...document.querySelectorAll(".prx-rc-between-table .prx-rc-diag")].map(node => node.innerText),
          means: [...document.querySelectorAll(".prx-rc-means [data-prx-readout]")].map(node => Number(node.dataset.num)),
          rows: [...document.querySelectorAll(".prx-rc-between-table [data-prx-readout^='between-']")].map(node => Number(node.dataset.num)),
        }));
        const values = await read();
        assert.deepEqual(values.diagonal, ["—", "—", "—"]);
        assert.equal(values.means.length, 3);
        assert.ok(values.means.some(value => value < 0));
        assert.equal(values.rows.length, 3);
        assert.ok(values.rows.every(value => value >= 0 && value <= 1));
        await open("krw-card", "preset=card");
        const archival = await page.$$eval(".prx-rc-between-table .prx-rc-diag [data-prx-readout^='bg-gmean-']", nodes => nodes.length);
        assert.equal(archival, 3);
      });

      await s.test("2.14: linked controls announce the changed report and the archive stays fixed", async () => {
        await open("two-denominators", "lambda=.25");
        const fixed = await Promise.all(["den-card-dr", "den-card-en"].map(name => raw(page, name)));
        await press('input[name="lambda"]', "ArrowRight");
        assert.match(await headline(page), /^At λ/);
        assert.equal(await raw(page, "den-ro-lambda"), .26);
        await press('input[name="tau"]', "ArrowRight");
        assert.match(await headline(page), /^At τ/);
        assert.equal(await raw(page, "den-ro-tau"), .21);
        assert.deepEqual(await Promise.all(["den-card-dr", "den-card-en"].map(name => raw(page, name))), fixed);
        const zero = await page.$eval(".den-panel", node => node.innerText);
        assert.match(zero, /N = 0.*DR is 0.*E\/N has no defined value \(NA: no disclosure\)/s);
      });

      await s.test("2.17: risk bars precede details and the exact bounds open by keyboard", async () => {
        await open("another-law", "preset=move");
        const reports = '[data-prx-disclosure="reports"]';
        const bounds = '[data-prx-disclosure="bounds"]';
        assert.equal(await page.$eval('[data-prx-readout="regret"]', node => node.innerText), ".0817");
        const chartBeforeDetails = await page.evaluate(() => {
          const chart = document.querySelector('[data-prx-primary]');
          const details = document.querySelector('[data-prx-disclosure="reports"]');
          return chart.getBoundingClientRect().bottom <= details.getBoundingClientRect().top;
        });
        assert.ok(chartBeforeDetails);
        assert.match(await headline(page), /both bounds.*at least 1/);
        assert.equal(await page.$eval(reports, node => node.open), false);
        assert.equal(await page.$eval(bounds, node => node.open), false);
        await press(`${reports} > summary`, "Enter");
        assert.ok(await page.$eval(reports, node => node.open));
        assert.equal(await page.$$eval(`${reports} tbody tr`, rows => rows.length), 2);
        await press(`${bounds} > summary`, "Enter");
        assert.ok(await page.$eval(bounds, node => node.open));
        assert.equal(await page.$$eval(`${bounds} .prx-al-bound-row`, rows => rows.length), 3);
        await open("another-law", "preset=same");
        assert.equal(await raw(page, "regret"), 0);
      });

      await s.test("2.20: the headline answers for untouched pairs and retains the complete list", async () => {
        await open("one-correction", "preset=mean");
        assert.match(await headline(page), /^Correcting C changes 2 of 10 pairs between units whose inputs stayed fixed/);
        assert.deepEqual(await page.$$eval(".oc-change-chip", nodes => nodes.map(node => node.innerText)), ["D–E", "E–F"]);
        assert.equal(await raw(page, "coefficientGap"), 0);
        await open("one-correction", "preset=drop");
        assert.match(await headline(page), /^Removing E changes 1 of 10 pairs/);
        assert.equal(await page.$$eval(".oc-change-chip", nodes => nodes.length), 1);
        await open("one-correction", "unit=C&mode=mean&mean=.15&tau=.5&cap=6");
        const single = await page.$$eval('.prx-sr-only [data-prx-readout$="TieCount"]', nodes =>
          nodes.map(node => [Number(node.dataset.num), node.parentElement.getAttribute("aria-hidden")]));
        assert.deepEqual(single, [[1, "true"]]);
      });

      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
    });
  }
});
