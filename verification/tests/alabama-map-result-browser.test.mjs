import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';
import Alabama from '../../data/released/case-alabama.json' with { type: 'json' };

test('Alabama outcome errors lead the map and a real county selection retains both intervals', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.goto(`${server.origin}/pages/cases/alabama-map.html`);
                const primary = '[data-prx-primary-control]', readout = '[data-prx-part="readout"]';
                await page.waitForSelector('.al-bars svg');
                await waitForWidgetIdle(page);
                await page.focus(primary);
                await page.keyboard.press('End');
                const result = await page.$eval(readout, n => {
                    const slider = document.querySelector('[data-prx-primary-control]');
                    slider.scrollIntoView({ block: 'start', behavior: 'instant' });
                    const chart = document.querySelector('[data-prx-primary]');
                    return { text: n.innerText, gap: n.getBoundingClientRect().top - slider.getBoundingClientRect().bottom,
                        chartTop: chart.getBoundingClientRect().top, chartBottom: chart.getBoundingClientRect().bottom };
                });
                assert.match(result.text, /Income only: 1,769 of 2,211/);
                assert.match(result.text, /\.0270 on income, \.349 on incarceration/);
                assert.ok(result.gap >= 0 && result.gap <= 150);
                assert.ok(result.chartTop > 0 && result.chartBottom <= 812);
                const labels = await page.$$eval('.al-bars svg text[data-num]', labels => labels.map(n => n.textContent));
                assert.ok(labels.includes('.0270') && labels.includes('.349'));
                assert.equal(await page.$$eval('.al-map path[data-county][fill]:not([fill="none"])', nodes => nodes.length), 67);
                const points = '.al-map .prx-kbd-point';
                const county = await page.$$eval(points, nodes => {
                    const n = nodes.find(node => node.getAttribute('aria-label').startsWith('Jefferson County'));
                    return n.dataset.prxFocusKey;
                });
                await page.focus(`[data-prx-focus-key="${county}"]`);
                const details = await page.$eval('.al-left .al-detail', n => ({
                    text: n.innerText, rows: n.querySelectorAll('tbody tr').length,
                }));
                assert.match(details.text, /Jefferson County/);
                assert.match(details.text, /34\.40/);
                assert.match(details.text, /3\.36/);
                assert.equal(details.rows, 2);
                await page.click('[data-prx-disclosure="county-details"] > summary');
                await waitForWidgetIdle(page);
                const ownGrades = await page.$$eval('[data-prx-disclosure="county-details"] table', tables => {
                    const table = tables.find(n => n.caption?.textContent.startsWith('All counties in selected report order.'));
                    return Array.from(table.tBodies[0].rows, row => [row.cells[1].textContent, Number(row.cells[3].querySelector('[data-num]').dataset.num)]);
                });
                const archivedP = new Map(Alabama.tables.reports.fips.map((fips, i) => [String(fips), Alabama.tables.reports.P[i]]));
                assert.equal(ownGrades.length, 67);
                assert.deepEqual(new Map(ownGrades), archivedP);
                assert.ok(await page.$eval('body', n => n.innerText.includes(
                    'U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20m), via usmapdata 1.1.0')));
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
