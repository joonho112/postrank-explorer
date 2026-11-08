import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

test('the KRW common card risk moves beside its control and selected firms retain both marginals', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.goto(`${server.origin}/pages/cases/krw-two.html`);
                const primary = '[data-prx-primary-control]', readout = '[data-prx-part="readout"]';
                const mark = '[data-prx-readout="common-risk-mark"]';
                await page.waitForSelector(mark);
                await waitForWidgetIdle(page);
                assert.ok(Math.abs(await page.$eval(mark, n => Number(n.dataset.num)) - .2454704108702616) < 1e-12);
                await page.focus(primary);
                await page.keyboard.press('End');
                const result = await page.$eval(readout, n => {
                    const slider = document.querySelector('[data-prx-primary-control]');
                    slider.scrollIntoView({ block: 'start', behavior: 'instant' });
                    const chart = document.querySelector('[data-prx-primary]');
                    return { text: n.innerText, gap: n.getBoundingClientRect().top - slider.getBoundingClientRect().bottom,
                        chartTop: chart.getBoundingClientRect().top, chartBottom: chart.getBoundingClientRect().bottom };
                });
                assert.match(result.text, /Race only/);
                assert.ok(result.gap >= 0 && result.gap <= 150);
                assert.ok(result.chartTop > 0 && result.chartBottom <= 812);
                const point = '.k2-firms .prx-kbd-point[tabindex="0"]';
                await page.focus(point);
                await page.keyboard.press('ArrowRight');
                const details = await page.$eval('.k2-left .k2-detail', n => ({
                    text: n.innerText, rows: n.querySelectorAll('tbody tr').length,
                }));
                assert.match(details.text, /race/i);
                assert.match(details.text, /gender/i);
                assert.equal(details.rows, 2);
                assert.equal(await page.$$eval('.k2-tablebox table', rows => rows.length) > 3, true);
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
