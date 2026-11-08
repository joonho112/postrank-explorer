import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';
import { readKrwModel, cardAt } from '../../js/shared/krw-model.js';

const pairSelector = '[data-krw-pair-line]';
const map = '.kr-heat-box .kr-map';
const key = `${map} .prx-kbd-point`;

async function pairLine(page) {
    return page.$eval(pairSelector, node => ({
        row: Number(node.dataset.rowFirm), column: Number(node.dataset.columnFirm), text: node.textContent,
    }));
}

async function cellAt(page, row, column) {
    await page.$eval(`${map} svg`, svg => svg.scrollIntoView({ block: 'center', behavior: 'instant' }));
    return page.$eval(`${map} svg`, (svg, r, c) => {
        const { left, top, width } = svg.getBoundingClientRect(), svgW = Number(svg.getAttribute('width'));
        const cell = (svgW - 4) / 97, k = width / svgW;
        return { x: left + k * (2 + (c + .5) * cell), y: top + k * (20 + (r + .5) * cell) };
    }, row, column);
}

function reference(criterion, lambda) {
    const model = readKrwModel(criterion), { grade, tau } = cardAt(model, lambda);
    const withheld = [], stated = [];
    for (let i = 0; i < model.n; i += 1) {
        for (let j = 0; j < model.n; j += 1) {
            if (i !== j && grade[i] === grade[j] && model.e[i][j] < tau) withheld.push(`${i}:${j}`);
            if (grade[i] < grade[j] && model.e[i][j] > tau + 1e-12) stated.push(`${i}:${j}`);
        }
    }
    return { withheld, stated };
}

async function marks(page, criterion, lambda) {
    const found = await page.$$eval('[data-krw-mismatch]', nodes => Object.fromEntries(['withheld', 'stated'].map(kind => [
        kind, nodes.filter(n => n.dataset.krwMismatch === kind).map(n => `${n.dataset.rowFirm}:${n.dataset.columnFirm}`).sort(),
    ])));
    const expected = reference(criterion, lambda);
    assert.deepEqual(found, { withheld: expected.withheld.sort(), stated: expected.stated.sort() });
    return [found.withheld.length, found.stated.length];
}

test('KRW heat map reads the same exact cell by mouse, touch, keyboard, and native pickers', async () => {
    const server = await startServer(), browser = await launchChrome();
    try {
        for (const width of [1280, 375]) {
            const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
            try {
                await page.setViewport({ width, height: 812, hasTouch: width === 375 });
                await page.goto(`${server.origin}/pages/cases/krw-heatmap.html?preset=stage3`);
                await page.waitForSelector(pairSelector);
                await waitForWidgetIdle(page);
                assert.deepEqual(await marks(page, 'race', .25), [575, 324]);
                const geometry = await page.evaluate(() => {
                    const svg = document.querySelector('.kr-heat-box .kr-map svg');
                    return { map: svg.getBoundingClientRect().width, root: document.querySelector('.prx-widget').clientWidth,
                        page: document.documentElement.scrollWidth };
                });
                assert.ok(geometry.page <= width + 1);
                if (width === 375) assert.ok(geometry.map >= geometry.root - 24, JSON.stringify(geometry));
                await page.focus(key);
                await page.keyboard.press('Home');
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('ArrowRight');
                await page.keyboard.press('ArrowRight');
                const expected = await pairLine(page);
                assert.notEqual(expected.row, expected.column);
                const model = readKrwModel('race');
                assert.ok(expected.text.includes(model.names[expected.row]));
                assert.ok(expected.text.includes(model.names[expected.column]));
                assert.equal(Number(await page.$eval('[data-prx-readout="heat-pair-probability"]', n => n.dataset.num)),
                    1 - model.e[expected.row][expected.column]);
                await page.keyboard.press('End');
                assert.match((await pairLine(page)).text, /diagonal/);
                await page.select('select[name="row-firm"]', String(expected.row));
                await page.select('select[name="column-firm"]', String(expected.column));
                assert.deepEqual(await pairLine(page), expected);
                await page.select('select[name="row-firm"]', String((expected.row + 1) % model.n));
                const { x, y } = await cellAt(page, 1, 2);
                if (width === 375) await page.touchscreen.tap(x, y);
                else await page.mouse.move(x, y);
                assert.deepEqual(await pairLine(page), expected);
                if (width === 1280) {
                    await page.select('select[name="row-firm"]', String((expected.row + 1) % model.n));
                    const click = await cellAt(page, 1, 2);
                    await page.mouse.click(click.x, click.y);
                    assert.deepEqual(await pairLine(page), expected);
                }
                const crosshair = await page.$eval('[data-krw-crosshair]', group => ({
                    row: Number(group.dataset.rowFirm), column: Number(group.dataset.columnFirm), bars: group.children.length,
                }));
                assert.deepEqual(crosshair, { row: expected.row, column: expected.column, bars: 3 });
                assert.equal(await page.$eval('.prx-kbd-tip', node => getComputedStyle(node).display), 'none');
                assert.equal(await page.$$eval('td[data-prx-unitcount]', rows => rows.length), 97);
                const counts = '[data-prx-disclosure="firm-counts"]';
                await page.focus(`${counts} summary`);
                await page.keyboard.press('Enter');
                await page.waitForSelector(`${counts} table tbody tr`, { visible: true });
                assert.equal(await page.$$eval(`${counts} tbody tr`, rows => rows.length), 97);
                await page.keyboard.press('Enter');
                const slider = '[data-prx-primary-control]';
                await page.focus(slider);
                for (let step = 0; step < 25; step += 1) await page.keyboard.press('ArrowRight');
                assert.deepEqual(await marks(page, 'race', .50), [49, 545]);
                assert.deepEqual(await pairLine(page).then(({ row, column }) => [row, column]), [expected.row, expected.column]);
                const stage = '[data-prx-focus-key="radio:stage:1"]';
                await page.focus(stage);
                await page.keyboard.press('Space');
                assert.equal(await page.$$eval('[data-krw-mismatch]', nodes => nodes.length), 0);
                await page.focus('[data-prx-focus-key="radio:stage:2"]');
                await page.keyboard.press('Space');
                await page.select('select[name="sort"]', '1');
                await page.focus('[data-prx-focus-key="radio:criterion:1"]');
                await page.keyboard.press('Space');
                await marks(page, 'gender', .50);
                assert.equal(await page.$$eval(`${map} canvas`, nodes => nodes.length), 1);
                assert.deepEqual({ errors, failed }, { errors: [], failed: [] });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); await server.close(); }
});
