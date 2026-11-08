import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

test('KRW reward path shows the current grade and the adjacent archived step by the control', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.goto(`${server.origin}/pages/cases/krw-lambda.html`);
                await page.waitForSelector('[data-prx-readout="lambda-selected-grade-mark"]');
                await waitForWidgetIdle(page);
                const slider = '[data-prx-primary-control]';
                await page.focus(slider);
                for (let step = 0; step < 5; step += 1) await page.keyboard.press('ArrowRight');
                await waitForWidgetIdle(page);
                const values = await page.evaluate(() => {
                    const n = key => Number(document.querySelector(`[data-prx-readout="${key}"]`).dataset.num);
                    const mark = document.querySelector('[data-prx-readout="lambda-selected-grade-mark"]');
                    const live = document.querySelector('[data-prx-part="readout"]');
                    const input = document.querySelector('[data-prx-primary-control]');
                    const chart = document.querySelector('[data-prx-primary]');
                    input.scrollIntoView({ block: 'start' });
                    return {
                        summary: ['ro-lambda', 'ro-G', 'ro-N', 'chg-prev', 'chg-stated', 'chg-withheld', 'chg-reversed'].map(n),
                        svg: [Number(mark.dataset.num), mark.textContent],
                        changeInReadout: live.contains(document.querySelector('[data-prx-readout="chg-stated"]')),
                        controlDistance: live.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
                        chartTop: chart.getBoundingClientRect().top,
                        rows: document.querySelectorAll('[data-prx-grid-row]').length,
                        current: document.querySelector('[data-prx-grid-row][aria-current="true"]').dataset.prxGridRow,
                        zero: [...document.querySelector('[data-prx-grid-row="0"]').cells].slice(-3).map(n => n.textContent),
                        risk08: document.querySelector('[data-prx-grid-row="8"] td:nth-child(7) [data-num]').dataset.num,
                    };
                });
                assert.deepEqual(values.summary, [.30, 3, 2128, .29, 830, 92, 0]);
                assert.deepEqual(values.svg, [3, '3']);
                assert.ok(values.changeInReadout);
                assert.ok(values.controlDistance >= 0 && values.controlDistance <= 150);
                assert.ok(values.chartTop > 0 && values.chartTop < 812);
                assert.equal(values.rows, 101);
                assert.equal(values.current, '30');
                assert.deepEqual(values.zero, ['NA: no disclosure', 'NA', 'NA']);
                assert.ok(Number(values.risk08) < .08 / 1.08);
                await page.focus(slider);
                await page.keyboard.press('Home');
                await waitForWidgetIdle(page);
                assert.equal(await page.$('[data-prx-readout="ro-EoverN"]'), null);
                assert.equal(await page.$eval('[data-prx-readout="lambda-selected-grade-mark"]', n => n.textContent), '1');
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
