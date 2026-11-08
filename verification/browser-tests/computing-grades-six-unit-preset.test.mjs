import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS, launchChrome, openTab, startServer, waitForWidgetIdle } from "../browser.mjs";

const preset = '[data-value="joint-solver-six"]';
const solve = "[data-prx-solve]";
// Independent enumeration used the six frozen posterior marginals from seed 20261030.
// It scored all 4,683 reports at tau .25 with independent normal pair errors.
const exact = { risk: 0.1455122761563118, grade: "1,2,1,1,3,1", family: "4683" };

async function checkRisk(page, hook) {
  const raw = await page.$eval(`[data-prx-readout="${hook}"]`, node => node.getAttribute("data-num"));
  assert.notEqual(raw, null);
  assert.ok(Math.abs(Number(raw) - exact.risk) < 1e-10, `${hook}: ${raw}`);
}

test("the six-unit teaching preset is lazy and its joint solve matches exhaustive enumeration", async t => {
  const server = await startServer(DOCS);
  const browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });
  for (const [width, height, route, deepLink] of [
    [1280, 800, "pages/grades/computing-grades.html", false],
    [375, 812, "embed/computing-grades.html?preset=joint-solver-six&theme=dark", true],
  ]) {
    await t.test(`${width}px ${deepLink ? "standalone deep link" : "page preset button"}`, async scenario => {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height });
      scenario.after(() => page.close());
      const solverRequests = [];
      page.on("request", request => {
        if (new URL(request.url()).pathname.endsWith("/js/bundles/solver.js")) solverRequests.push(request.url());
      });
      await page.goto(`${server.origin}/${route}`, { waitUntil: "load" });
      await waitForWidgetIdle(page);
      if (!deepLink) {
        await page.click(preset);
        await waitForWidgetIdle(page);
      }
      assert.equal(await page.$eval(preset, node => node.getAttribute("aria-pressed")), "true");
      const state = await page.evaluate(() => {
        const { view, solverN, tau, timeLimit } = window.__prxApp.state;
        return { view, solverN, tau, timeLimit };
      });
      assert.deepEqual(state, { view: "solver", solverN: 6, tau: .25, timeLimit: 2 });
      assert.equal(solverRequests.length, 0);
      assert.equal(await page.$("[data-prx-solver-status]"), null);
      assert.match(await page.$eval(".prx-readout", node => node.textContent), /not run at these settings/);
      await checkRisk(page, "solver-dp-risk");

      await page.focus(solve);
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-prx-solver-status]");
      await waitForWidgetIdle(page);
      assert.equal(solverRequests.length, 1);
      assert.equal(await page.$eval("[data-prx-solver-status]", node => node.textContent), "optimal");
      assert.match(await page.$eval("[data-prx-solver-label]", node => node.textContent), /optimal within solver tolerances/);
      assert.equal(await page.$eval("[data-prx-solver-label] [data-prx-family-size]", node => node.dataset.num), exact.family);
      await checkRisk(page, "solver-upper");
      await checkRisk(page, "solver-lower");
      assert.equal(await page.$eval('[data-prx-readout="solver-gap"]', node => node.dataset.num), "0");
      assert.equal(await page.$eval('[data-prx-readout="solver-grades"]', node => node.dataset.num), exact.grade);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-prx-focus-key")), "solver:solve");
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
    });
  }
});
