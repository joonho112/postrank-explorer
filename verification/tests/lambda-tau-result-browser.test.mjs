import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

const readout = '[data-prx-part="readout"]';
const presets = [
    ['lambda10', ['1/11', '10/11', '{A, B} > {C, D} > {E, F}']],
    ['lambda25', ['.20', '.80', '{A} > {B} > {C, D} > {E} > {F}']],
    ['lambda50', ['1/3', '2/3']],
    ['lambda1', ['.50', '{A} > {B} > {C} > {D} > {E} > {F}']],
    ['tau40', ['2/3', '.40']],
    ['lambda08', ['.0741']],
];

test('linked λ/τ controls keep the exact cut and common blocks in view', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.goto(`${server.origin}/pages/cases/lambda-tau.html`);
                await page.waitForSelector(readout);
                await waitForWidgetIdle(page);
                const input = '[data-prx-primary-control]';
                await page.focus(input);
                await page.keyboard.press('Home');
                assert.equal(await page.$eval('[data-prx-readout="tau"]', n => Number(n.dataset.num)), .01 / 1.01);
                assert.match(await page.$eval(readout, n => n.innerText), /\{A, B\} > \{C, D\} > \{E, F\}/);
                assert.ok(await page.$eval(input, n => n === document.activeElement));
                if (width === 375) {
                    const collisions = await page.$$eval('.kb-pair svg', figures => figures.map(figure => {
                        const nodes = [...figure.querySelectorAll('text')];
                        const rect = text => nodes.find(n => n.textContent === text).getBoundingClientRect();
                        const a = rect('state i above j'), b = rect('state j above i');
                        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
                    }));
                    assert.deepEqual(collisions, [false, false]);
                }
                await page.keyboard.press('End');
                assert.equal(await page.$eval('[data-prx-readout="tau"]', n => Number(n.dataset.num)), .5);
                for (const [id, strings] of presets) {
                    const preset = `.prx-presets [data-value="${id}"]`;
                    await page.focus(preset);
                    await page.keyboard.press('Enter');
                    const result = await page.$eval(readout, n => {
                        n.scrollIntoView({ block: 'center', behavior: 'instant' });
                        const rect = n.getBoundingClientRect();
                        return { text: n.innerText, top: rect.top, bottom: rect.bottom, height: innerHeight };
                    });
                    for (const expected of strings) assert.ok(result.text.includes(expected), `${id}: ${expected}`);
                    assert.ok(result.top >= 0 && result.bottom <= result.height);
                }
                const panels = await page.$$eval('.kb-pair .prx-chart-area svg', nodes => nodes.length);
                assert.equal(panels, 2);
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
