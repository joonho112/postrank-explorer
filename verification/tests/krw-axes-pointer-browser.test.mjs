import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

const chart = '.kb-cloud';
const focus = `${chart} .prx-kbd-point`;
const tip = `${chart} .prx-kbd-tip`;

test('the KRW report cloud reads one actual point identically by keyboard, pointer and touch', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.setViewport({ width, height: 812, hasTouch: width === 375 });
                await page.goto(`${server.origin}/pages/cases/krw-axes.html`);
                await page.waitForSelector(focus);
                await waitForWidgetIdle(page);
                await page.focus(focus);
                await page.keyboard.press('Home');
                const expected = await page.$eval(focus, node => node.getAttribute('aria-label'));
                assert.match(expected, /Report 1\/1\/1\/1\/1\/1/);
                assert.equal(await page.$eval(tip, node => node.textContent), expected);
                await page.keyboard.press('Escape');
                assert.ok(await page.$eval(tip, node => node.hidden));
                const { x, y } = await page.$eval(focus, node => {
                    node.closest('.prx-chart-area').scrollIntoView({ block: 'center', behavior: 'instant' });
                    const rect = node.getBoundingClientRect();
                    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                });
                if (width === 375) await page.touchscreen.tap(x, y);
                else await page.mouse.move(x, y);
                await page.waitForFunction(selector => !document.querySelector(selector)?.hidden, {}, tip);
                assert.equal(await page.$eval(tip, node => node.textContent), expected);
                if (width === 1280) {
                    await page.mouse.click(x, y);
                    assert.equal(await page.$eval(tip, node => node.textContent), expected);
                }
                assert.equal(await page.$eval(chart, node => node.dataset.prxReports), '4683');
                const toggle = 'input[data-prx-focus-key="toggle:grid"]';
                await page.focus(toggle);
                await page.keyboard.press('Space');
                await waitForWidgetIdle(page);
                const result = await page.$eval('[data-prx-part="readout"]', node => {
                    const value = key => Number(node.querySelector(`[data-prx-readout="${key}"]`).dataset.num);
                    return [value('ro-grid-same'), value('ro-grid-count'), value('ro-grid-diff')];
                });
                assert.deepEqual(result.slice(0, 2), [49, 49]);
                assert.ok(result[2] < 1e-14);
                assert.equal(await page.$$eval('.kb-grid tbody tr', rows => rows.length), 49);
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
