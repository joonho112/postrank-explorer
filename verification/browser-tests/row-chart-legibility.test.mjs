// Measure rendered data marks in CSS pixels, including the mobile layout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCS, launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

test('individual firms and ranks remain distinct in the full-size charts', async t => {
  const server = await startServer(DOCS);
  t.after(() => server.close());
  const browser = await launchChrome();
  t.after(() => browser.close());
  for (const width of [375, 1280]) {
    const {page, errors, failed} = await openTab(browser, {origin: server.origin, width, height: width === 375 ? 812 : 800});
    try {
      for (const [name, selector, count] of [
        ['case-zero', '.prx-cz-card-chart', 97], ['krw-card', '.kr-stage-chart', 97],
        ['several-criteria', '.sev-stage-col', 30],
      ]) {
        await page.goto(server.origin + '/embed/' + name + '.html');
        await waitForWidgetIdle(page);
        const geometry = await page.$eval(selector, (chart, count) => {
          const rows = [...chart.querySelectorAll('g[aria-label="dot"]')].find(g => g.children.length >= count);
          const centers = [...rows.children].map(dot => {
            const {top, height} = dot.getBoundingClientRect();
            return Math.round((top + height / 2) * 10) / 10;
          });
          const ys = [...new Set(centers)].sort((a, b) => a - b);
          return {count: ys.length, pitch: Math.min(...ys.slice(1).map((y, i) => y - ys[i]))};
        }, count);
        assert.equal(geometry.count, count, name);
        assert.ok(geometry.pitch >= 11.8, name + ' at ' + width + 'px has only ' + geometry.pitch + 'px between rows');
        if (name === 'several-criteria') continue;

        assert.equal(await page.$eval(selector, el => el.querySelectorAll('svg g[aria-label="x-axis tick label"]').length), 2,
          'The numeric scale is readable from both ends of the firm card');
        const stop = selector + ' .prx-kbd-point[tabindex="0"]';
        await page.focus(stop);
        for (const key of ['End', 'Home']) {
          await page.keyboard.press(key);
          await waitForWidgetIdle(page);
          const focus = await page.$eval(selector, (chart, key) => {
            const el = document.activeElement, rect = el.getBoundingClientRect();
            const dots = [...chart.querySelectorAll('g[aria-label="dot"]')].find(g => g.children.length === 97);
            const edge = (key === 'Home' ? dots.firstElementChild : dots.lastElementChild).getBoundingClientRect();
            return {active: el.matches('.prx-kbd-point'), y: rect.top + rect.height / 2, h: innerHeight,
              edgeY: edge.top + edge.height / 2};
          }, key);
          assert.ok(focus.active && focus.y > 0 && focus.y < focus.h && Math.abs(focus.y - focus.edgeY) < 3,
            name + ' ' + key + ' must focus the corresponding end of the roster inside the viewport: ' + JSON.stringify(focus));
        }
        if (name === 'krw-card') {
          await page.evaluate(() => window.__prxApp.update({reveal: 1}));
          await waitForWidgetIdle(page);
          const fewer = await page.$eval(selector, chart => ({
            dots: chart.querySelector('g[aria-label="dot"]').children.length,
            svgHeight: chart.querySelector('svg').getBoundingClientRect().height,
            note: chart.querySelector('svg').textContent.includes('Remaining grades not shown yet'),
          }));
          assert.ok(fewer.note && fewer.dots < 97 && fewer.svgHeight < 97 * geometry.pitch, 'grade reveal draws its visible rows and a short remainder');
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
    } finally { await page.close(); }
  }
});
