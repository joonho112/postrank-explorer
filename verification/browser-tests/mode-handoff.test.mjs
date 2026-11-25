import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DOCS, ROOT, launchChrome, startServer } from "../browser.mjs";

test("same-app mode links retain a nondefault report family and an edited withholding cost", async t => {
  const server = await startServer();
  const browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  const route = "/pages/grades/price-of-silence.html";
  await page.goto(server.origin + route + "?preset=tau20-nocap");
  const slider = page.locator('input[type=range][name=tau]');
  await slider.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  const expected = await page.evaluate(() => window.__prxApp.state);
  assert.notEqual(expected.tau, 0.2);
  const go = async selector => {
    await Promise.all([page.waitForNavigation({waitUntil:"load"}), page.locator(selector).click()]);
    assert.deepEqual(await page.evaluate(() => window.__prxApp.state), expected);
  };
  await go('main a[href*="/embed/price-of-silence.html"]');
  await go(".prx-embed-open");
  assert.equal(new URL(page.url()).pathname, route);
  await page.goto(server.origin + "/pages/grades/one-pair.html?preset=pi85");
  await page.focus('input[name=pi]');
  await page.keyboard.press("ArrowLeft");
  const custom = await page.evaluate(()=>window.__prxApp.state);
  assert.equal(custom.tau,.2);
  await Promise.all([page.waitForNavigation(),page.locator('main a[href*="/embed/one-pair.html"]').click()]);
  assert.deepEqual(await page.evaluate(()=>window.__prxApp.state),custom);
  await Promise.all([page.waitForNavigation(),page.locator(".prx-embed-open").click()]);
  assert.deepEqual(await page.evaluate(()=>window.__prxApp.state),custom);
  for (const folder of [ROOT, DOCS]) {
    const url = pathToFileURL(join(folder, "embed/price-of-silence.html"));
    url.search = "?preset=tau20-nocap";
    await page.goto(url.href);
    const before = await page.evaluate(() => window.__prxApp.state);
    await Promise.all([page.waitForNavigation({waitUntil:"load"}), page.locator(".prx-embed-open").click()]);
    assert.equal(new URL(page.url()).pathname, pathToFileURL(join(DOCS, route.slice(1))).pathname);
    assert.deepEqual(await page.evaluate(() => window.__prxApp.state), before);
  }
});

test("a phone opens the pictured example and a 44px standalone target; full pages stay light while standalone honors theme", async t => {
  const server = await startServer();
  const browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(server.origin + "/index.html");
  assert.equal(await page.$(".prx-site-theme"), null);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
  await Promise.all([page.waitForNavigation(), page.locator(".prx-tile-thumb img").click()]);
  assert.equal(new URL(page.url()).pathname, "/pages/uncertainty/noisy-league.html");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");

  // Handoff from full page to standalone omits ?theme=light so standalone follows OS dark/light or explicit ?theme=
  await Promise.all([page.waitForNavigation(), page.locator('main a[href*="/embed/noisy-league.html"]').click()]);
  assert.equal(new URL(page.url()).pathname, "/embed/noisy-league.html");
  assert.equal(new URL(page.url()).searchParams.get("theme"), null);

  // Explicit ?theme=dark and ?theme=system work on standalone, and returning to full page stays light
  await page.goto(server.origin + "/embed/noisy-league.html?preset=true&theme=dark");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await Promise.all([page.waitForNavigation(), page.locator(".prx-embed-open").click()]);
  assert.equal(new URL(page.url()).pathname, "/pages/uncertainty/noisy-league.html");
  assert.equal(new URL(page.url()).searchParams.get("theme"), null);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");

  await page.goto(server.origin + "/embed/noisy-league.html?theme=system");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.themePreference), "system");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  for (const offset of [-10, 10]) {
    await page.goto(server.origin + "/pages/uncertainty/index.html");
    const point = await page.$eval(".prx-card-links a", async (a, offset) => {
      await document.fonts.ready;
      a.scrollIntoView({block:"center",behavior:"instant"});
      // Quarto retracts its sticky header after scroll, which can shift the client rectangle.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const rect = a.getBoundingClientRect();
      const x=rect.x+rect.width/2, y=rect.y+rect.height/2+offset;
      return {x,y,h:rect.height,hit:document.elementFromPoint(x,y)?.closest("a")===a};
    }, offset);
    assert.ok(point.h >= 44 && point.hit);
    await Promise.all([page.waitForNavigation(), page.mouse.click(point.x,point.y)]);
    assert.equal(new URL(page.url()).pathname, "/embed/case-zero.html");
  }
});
