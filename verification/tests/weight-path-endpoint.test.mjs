import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

test('the weight path shows the boundary crossing in view and retains a raw audit of the zero-width tie', async () => {
  const server = await startServer();
  const browser = await launchChrome();
  try {
    for (const width of [1280, 375]) {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: width === 375 ? 812 : 800 });
      try {
        await page.goto(`${server.origin}/pages/criteria/weight-path.html?w=.41&tau=.2&cap=3`);
        await waitForWidgetIdle(page);
        const input = '[data-prx-primary-control] input[type=range]';
        const guides = () => page.$$eval('.wpath-overview svg g[aria-label="rule"] line', lines => lines.map(n => Number(n.getAttribute('x1'))));
        await page.focus(input);
        await page.$eval(input, n => {
          document.documentElement.style.scrollBehavior = 'auto';
          n.scrollIntoView({ block: 'start' });
          scrollBy(0, -75);
        });
        assert.match(await page.$eval('.prx-readout', n => n.textContent), /8 of 15 pairs/);
        const before = await guides();
        await page.keyboard.press('ArrowRight');
        await waitForWidgetIdle(page);
        const after = await guides();
        assert.equal(before.length, 2);
        assert.ok(after.every((x, i) => x > before[i]));
        assert.equal(after[0], after[1], 'strip and share guides share the same x scale');
        assert.equal(await page.$eval(input, n => n.value === '0.42' && document.activeElement === n), true);
        const result = await page.$eval('.prx-readout', n => ({ text: n.textContent, visible: n.getBoundingClientRect().bottom <= innerHeight }));
        assert.equal(result.visible, true);
        assert.match(result.text, /\{A, B, C, D\} > \{E\} > \{F\}: 9 of 15 pairs, optimal from \.41698 to \.63805/);
        assert.match(result.text, /\.0177 on score A and \.0267 on score B; weighted risk \.0938/);
        assert.match(await page.$eval('.wpath-overview', n => n.textContent), /5 interior boundaries.*2 reports tie/s);
        const data = 'details[data-prx-disclosure="data"]';
        await page.focus(`${data} > summary`);
        await page.keyboard.press('Enter');
        await waitForWidgetIdle(page);
        assert.equal(await page.$eval(data, n => n.open), true);
        assert.deepEqual(await page.$$eval('[data-prx-readout="to-0"], [data-prx-readout="from-1"]', nodes => nodes.map(n => n.dataset.num)), ['0','0']);
        await page.focus(`${data} details > summary`);
        await page.keyboard.press('Enter');
        assert.equal(await page.$eval(`${data} details`, n => n.open), true);
        const raw = await page.$eval(`${data} details tbody tr td:nth-child(2) [data-num]`, n => Number(n.dataset.num));
        assert.ok(raw > 0 && raw < 1e-12);
        const endpointReports = await page.$$eval('[data-prx-readout^="boundary-grade-0-"]', nodes => nodes.map(n => n.textContent).sort());
        assert.deepEqual(endpointReports, ['1/2/1/1/3/3', '2/2/1/2/3/3']);
        await page.focus(input);
        await page.keyboard.press('Home');
        assert.match(await page.$eval('.prx-readout', n => n.textContent), /2 reports tie.*\.200 on score A.*\.215 on score A/s);
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
