// P9-A11Y01: system contrast options preserve the source-fixed L-09/F15 normal baseline.
// This does not close inherited C1-R7's normal-baseline author check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launchChrome, openTab, startServer, waitForWidgetIdle } from '../browser.mjs';

const apps = ['which-ranking', 'majority-wins'].map(name =>
  JSON.parse(readFileSync(join(ROOT, `catalog/entries/1.${name === 'which-ranking' ? 14 : 15}-${name}.json`), 'utf8')));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const evidence = [];

async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.prx-widget');
    return {
      dom: root.outerHTML,
      state: window.__prxApp.state,
      paths: [...root.querySelectorAll('svg path')].map(n => n.getAttribute('d')),
      raw: [...root.querySelectorAll('[data-num]')].map(n => [n.getAttribute('data-num'), n.textContent]),
      tables: [...root.querySelectorAll('table')].map(n => n.outerHTML),
      readout: root.querySelector('.prx-readout').textContent,
    };
  });
}

async function links(page) {
  return page.evaluate(() => {
    const rgb = color => {
      const m = /^rgba?\(([^)]+)\)$/.exec(color);
      if (!m) throw new Error(`Unresolved color: ${color}`);
      return m[1].split(/[, /]+/).map(Number);
    };
    const luminance = color => color.slice(0, 3).map(v => {
      const x = v / 255;
      return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const contrast = (ink, background, opacity) => {
      const a = opacity * (ink[3] ?? 1);
      const visible = ink.slice(0, 3).map((v, i) => a * v + (1 - a) * background[i]);
      const l = [luminance(visible), luminance(background)].sort((a, b) => b - a);
      return (l[0] + .05) / (l[1] + .05);
    };
    return [...document.querySelectorAll('[data-prx-role="link"]')].map(n => {
      const s = getComputedStyle(n), area = n.closest('.prx-chart-area');
      const probe = document.createElement('span');
      probe.style.color = 'var(--prx-plot-muted)';
      area.append(probe);
      const plotMuted = getComputedStyle(probe).color;
      probe.remove();
      // Both paper and the chosen-column band occur behind each connection.
      const backgrounds = [getComputedStyle(area).backgroundColor,
        getComputedStyle(n.closest('svg').querySelector('rect')).fill];
      let opacity = Number(s.strokeOpacity);
      for (let p = n; p && p !== area; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
      return {
        unit: n.getAttribute('data-prx-unit'), on: n.getAttribute('data-prx-on'),
        width: s.strokeWidth, opacity: Number(s.strokeOpacity), stroke: s.stroke, plotMuted, dash: s.strokeDasharray,
        backgrounds, minContrast: Math.min(...backgrounds.map(bg => contrast(rgb(s.stroke), rgb(bg), opacity))),
      };
    });
  });
}

function normalBaseline(rows) {
  const normal = rows.filter(n => !n.on), selected = rows.filter(n => n.on === 'sel');
  assert.ok(normal.length > 0, 'unselected original connections remain');
  for (const n of normal) {
    assert.equal(n.width, '1.25px', 'source-fixed width');
    assert.equal(n.opacity, .55, 'source-fixed normal opacity');
    assert.equal(n.stroke, n.plotMuted, 'source-fixed normal muted ink');
  }
  assert.ok(selected.length > 0, 'selected-unit overlay remains');
  for (const n of selected) {
    assert.equal(n.width, '3.5px');
    assert.equal(n.opacity, 1);
  }
}

function contrastOption(rows) {
  assert.ok(rows.length > 0);
  for (const n of rows) {
    assert.equal(n.opacity, 1);
    assert.ok(n.minContrast >= 3, `connection ${n.unit}: ${n.minContrast}:1 on ${n.backgrounds}`);
    assert.equal(n.width, n.on === 'sel' ? '3.5px' : n.on === 'hover' ? '2.25px' : '1.25px');
  }
}

test('System contrast options keep every ranking path, raw number, table and native linked interaction', async t => {
  const server = await startServer(ROOT), browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });
  for (const app of apps) for (const width of [375, 1280]) for (const theme of ['light', 'dark']) {
    await t.test(`${app.name} ${width}px ${theme}`, async () => {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
      try {
        const cdp = await page.createCDPSession();
        const media = async features => {
          await cdp.send('Emulation.setEmulatedMedia', { features });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        };
        await page.goto(`${server.origin}/embed/${app.name}.html?theme=${theme}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await waitForWidgetIdle(page);
        await page.evaluate(() => {
          window.__rankingTrusted = { keydown: 0, click: 0, pointermove: 0 };
          for (const type of Object.keys(window.__rankingTrusted)) document.addEventListener(type, e => {
            if (e.isTrusted) window.__rankingTrusted[type]++;
          }, true);
        });
        for (const preset of app.presets) {
          await media([]);
          await page.mouse.move(0, 0);
          const buttons = await page.$$('[data-prx-part="presets"] button');
          let button;
          for (const candidate of buttons) if (await candidate.evaluate((n, label) => n.textContent === label, preset.label)) button = candidate;
          assert.ok(button, `native preset ${preset.id}`);
          await button.focus();
          await page.keyboard.press('Enter');
          await waitForWidgetIdle(page);
          await media([]); // Let the layout/scroll-region observers settle before exact DOM comparison.
          const before = await snapshot(page), baseline = await links(page);
          normalBaseline(baseline);
          assert.ok(before.raw.length > 0 && before.tables.length > 0 && before.paths.length > 0);
          assert.ok(before.readout.trim());

          await media([{ name: 'prefers-contrast', value: 'more' }]);
          assert.equal(await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches), true);
          const high = await links(page);
          contrastOption(high);
          assert.equal(digest(await snapshot(page)), digest(before), 'contrast changes only computed paint, including all path d/raw data/tables');

          await media([]);
          normalBaseline(await links(page));
          assert.equal(digest(await snapshot(page)), digest(before), 'normal reset is exact');
          await media([{ name: 'prefers-contrast', value: 'more' }]);

          // Real pointer hover, click and roving keyboard focus retain the linked unit overlays.
          const node = await page.$('.prx-wr-bump-chart [data-prx-role="node"]:not([data-prx-on])');
          assert.ok(node);
          const hoveredUnit = await node.evaluate(n => n.getAttribute('data-prx-unit'));
          await node.hover();
          let highlighted = await links(page);
          const hover = highlighted.filter(n => n.on === 'hover');
          assert.ok(hover.length > 0);
          for (const n of hover) {
            assert.equal(n.unit, hoveredUnit); assert.equal(n.width, '2.25px'); assert.equal(n.dash, '5px, 3px');
          }
          contrastOption(highlighted);
          await node.click();
          await waitForWidgetIdle(page);
          highlighted = await links(page);
          assert.ok(highlighted.some(n => n.on === 'sel' && n.unit === hoveredUnit), 'native click selects hovered unit');
          await page.mouse.move(0, 0);
          const point = await page.$('.prx-wr-bump-chart .prx-kbd-point[tabindex="0"]');
          await point.focus();
          await page.keyboard.press('End');
          const focused = await page.evaluate(() => {
            const n = document.activeElement;
            return { key: n.getAttribute('data-prx-focus-key'), label: n.getAttribute('aria-label'), unit: window.__prxApp.state.unit };
          });
          assert.ok(focused.unit && focused.label, 'keyboard focus names and selects a unit');
          const selectedUnit = focused.key.split('|').at(-1);
          highlighted = await links(page);
          assert.ok(highlighted.some(n => n.on === 'sel' && n.unit === selectedUnit), 'focus and links share the unit');
          contrastOption(highlighted);
          await media([]);
          normalBaseline(await links(page));
          evidence.push({ app: app.name, width, theme, preset: preset.id, links: baseline.length,
            normalUnselectedOpacity: .55, normalUnselectedWidth: '1.25px',
            minHighContrast: Math.min(...high.map(n => n.minContrast)),
            domHash: digest(before.dom), pathHash: digest(before.paths), rawHash: digest(before.raw), tableHash: digest(before.tables),
            preservedAcrossMedia: true, nativeHoverClickFocus: true });
        }
        const trusted = await page.evaluate(() => window.__rankingTrusted);
        assert.ok(trusted.keydown >= app.presets.length * 2 && trusted.click >= app.presets.length && trusted.pointermove >= app.presets.length);
        assert.deepEqual(errors, []); assert.deepEqual(failed, []);
        await cdp.detach();
      } finally { await page.close(); }
    });
  }
  assert.equal(evidence.length, 44);
  if (process.env.PRX_EVIDENCE_DIR) {
    mkdirSync(process.env.PRX_EVIDENCE_DIR, { recursive: true });
    writeFileSync(join(process.env.PRX_EVIDENCE_DIR, 'ranking-system-contrast.json'), JSON.stringify({
      obligation: 'P9-A11Y01', inheritedBaselineAuthorCheck: 'C1-R7 remains open', scenarios: evidence,
    }, null, 2) + '\n');
  }
});
