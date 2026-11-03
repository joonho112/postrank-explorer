import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS, ROOT, docsPages, startServer, launchChrome, openTab, waitForWidgetIdle } from '../browser.mjs';

const selector = '.callout-header[data-bs-toggle="collapse"]';
const include = readFileSync(join(ROOT, 'js/site/recipe-keyboard.html'), 'utf8');
const scriptPattern = /<script id="prx-recipe-keyboard">([\s\S]*?)<\/script>/;
const script = include.match(scriptPattern)[1];
const evidenceDir = process.env.PRX_RECIPE_EVIDENCE_DIR;
const representatives = [
  'uncertainty/two-units', 'grades/price-of-silence', 'grades/averaging-errors',
  'criteria/two-scores', 'rules/posterior-tiers', 'cases/cde-cuts', 'tools/report-designer',
];

async function collapsed(page, expanded) {
  await page.waitForFunction((selector, expanded) => {
    const header = document.querySelector(selector);
    const panel = document.getElementById(header.getAttribute('aria-controls'));
    return header.getAttribute('aria-expanded') === String(expanded) &&
      !panel.classList.contains('collapsing') && panel.classList.contains('show') === expanded;
  }, {}, selector, expanded);
}

// Reach the disclosure through the browser's real sequential focus navigation.
async function tabTo(page, target) {
  await page.evaluate(target => {
    const node = document.querySelector(target);
    const stops = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.disabled && el.getClientRects().length);
    const index = stops.indexOf(node);
    if (index < 1) throw new Error('Disclosure must have a preceding Tab stop');
    node.scrollIntoView({ block: 'center' });
    stops[index - 1].focus({ preventScroll: true });
  }, target);
  await page.keyboard.press('Tab');
  assert.equal(await page.$eval(target, node => document.activeElement === node), true);
}

async function focusAppearance(page, target) {
  const appearance = await page.$eval(target, node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    const outset = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
    const ring = { left: rect.left - outset, right: rect.right + outset, top: rect.top - outset, bottom: rect.bottom + outset };
    const clippedBy = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
      if (/(hidden|clip|auto|scroll)/.test(css.overflowX) && (ring.left < box.left || ring.right > box.right)) clippedBy.push(parent.tagName);
      if (/(hidden|clip|auto|scroll)/.test(css.overflowY) && (ring.top < box.top || ring.bottom > box.bottom)) clippedBy.push(parent.tagName);
    }
    return { visible: node.matches(':focus-visible'), style: style.outlineStyle, width: parseFloat(style.outlineWidth),
      clippedBy, withinViewport: ring.left >= 0 && ring.right <= innerWidth && ring.top >= 0 && ring.bottom <= innerHeight };
  });
  assert.equal(appearance.visible, true);
  assert.notEqual(appearance.style, 'none');
  assert.ok(appearance.width >= 2);
  assert.deepEqual(appearance.clippedBy, []);
  assert.equal(appearance.withinViewport, true);
  return appearance;
}

test('site recipes retain content and use native Tab, Enter and Space with Bootstrap state', async t => {
  const pages = docsPages().filter(path => !path.startsWith('embed/')).map(path => ({ path, html: readFileSync(join(DOCS, path), 'utf8') }));
  const recipes = pages.filter(({ html }) => /class="callout-header[^"\n]*"[^>]*data-bs-toggle="collapse"/.test(html));
  assert.ok(recipes.length > representatives.length, 'Inventory covers every rendered collapsed recipe, beyond the samples');
  for (const { path, html } of pages) assert.match(html, scriptPattern, `${path}: site-wide include rendered`);

  const server = await startServer(DOCS);
  t.after(() => server.close());
  const browser = await launchChrome();
  t.after(() => browser.close());
  const evidence = { inventoryPages: recipes.map(({ path }) => path), inventory: null, representatives: [], native: [] };
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });

  await t.test('every generated recipe receives semantics without changing text, code, or Bootstrap attributes', async st => {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin });
    st.after(() => page.close());
    await page.goto(`${server.origin}/index.html`);
    // Extract all real recipe markup into one document: no scientific app scripts run in this inventory.
    const before = await page.evaluate((sources, selector) => {
      const container = document.createElement('main');
      for (const source of sources) {
        const parsed = new DOMParser().parseFromString(source.html, 'text/html');
        for (const header of parsed.querySelectorAll(selector)) container.append(header.closest('.callout'));
      }
      document.body.replaceChildren(container);
      window.recipeSnapshot = () => [...document.querySelectorAll(selector)].map(header => ({
        text: header.closest('.callout').textContent,
        code: [...header.closest('.callout').querySelectorAll('pre code')].map(code => code.textContent),
        controls: header.getAttribute('aria-controls'), target: header.getAttribute('data-bs-target'),
        expanded: header.getAttribute('aria-expanded'),
      }));
      return window.recipeSnapshot();
    }, recipes, selector);
    await page.addScriptTag({ content: script });
    await page.addScriptTag({ content: script });
    assert.deepEqual(await page.evaluate(() => window.recipeSnapshot()), before);
    const semantics = await page.$$eval(selector, headers => headers.map(header => ({
      role: header.getAttribute('role'), tabindex: header.getAttribute('tabindex'), name: header.getAttribute('aria-label'),
    })));
    assert.equal(semantics.length, before.length);
    for (const header of semantics) {
      assert.equal(header.role, 'button');
      assert.equal(header.tabindex, '0');
      assert.match(header.name, /^In (postrank|R)$/);
    }
    evidence.inventory = { headers: before.length, codeHash: createHash('sha256').update(JSON.stringify(before)).digest('hex'), textAndCodeUnchanged: true };
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  });

  for (const width of [375, 1280]) for (const app of representatives) await t.test(`${app}, ${width}px`, async st => {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 900 });
    st.after(() => page.close());
    const path = `/pages/${app}.html`, html = readFileSync(join(DOCS, path), 'utf8');
    // The same Quarto output with only this repair removed demonstrates the original defect.
    server.virtual[path] = html.replace(scriptPattern, '');
    try {
      await page.goto(server.origin + path);
      await waitForWidgetIdle(page);
      const baseline = await page.$eval(selector, header => ({
        role: header.getAttribute('role'), tabindex: header.getAttribute('tabindex'),
        name: header.getAttribute('aria-label'), controls: header.getAttribute('aria-controls'),
        text: header.closest('.callout').textContent,
      }));
      assert.equal(baseline.role, null);
      assert.equal(baseline.tabindex, null);
      // Make the baseline div focusable just for this negative test; it still has no keyboard activation.
      await page.$eval(selector, header => { header.tabIndex = -1; header.focus(); });
      for (const key of ['Enter', 'Space']) {
        await page.keyboard.press(key);
        assert.equal(await page.$eval(selector, header => header.getAttribute('aria-expanded')), 'false');
      }
      await page.click(selector);
      await collapsed(page, true);
      delete server.virtual[path];
      await page.goto(server.origin + path);
      await waitForWidgetIdle(page);
      assert.equal(await page.$eval(selector, header => header.closest('.callout').textContent), baseline.text);
      assert.equal(await page.$eval(selector, header => header.getAttribute('aria-controls')), baseline.controls);
      assert.equal(await page.$eval(selector, header => header.getAttribute('role')), 'button');
      const name = await page.$eval(selector, header => header.getAttribute('aria-label'));
      assert.equal(name, app === 'grades/averaging-errors' ? 'In R' : 'In postrank');
      await page.addScriptTag({ content: script }); // a second initializer must not duplicate activation
      await tabTo(page, selector);
      const focus = await focusAppearance(page, selector);
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.$eval(selector, header => { window.recipeClicks = 0; header.addEventListener('click', () => window.recipeClicks++); });
      await page.keyboard.press('Enter');
      await collapsed(page, true);
      await page.keyboard.press('Enter');
      await collapsed(page, false);
      await page.keyboard.down('Space');
      await page.keyboard.down('Space'); // repeat=true must not toggle a second time
      await page.keyboard.up('Space');
      await collapsed(page, true);
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Space must not scroll the page');
      await page.keyboard.press('Space');
      await collapsed(page, false);
      assert.equal(await page.evaluate(() => window.recipeClicks), 4, 'one existing Bootstrap click per nonrepeat activation');
      assert.equal(await page.$eval(selector, header => document.activeElement === header), true);
      await focusAppearance(page, selector);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (evidenceDir && ['uncertainty/two-units', 'cases/cde-cuts'].includes(app)) {
        await page.screenshot({ path: join(evidenceDir, `${app.replaceAll('/', '-')}-${width}.png`) });
      }
      evidence.representatives.push({ app, width, baseline: { role: baseline.role, tabindex: baseline.tabindex, name: baseline.name,
        enterAndSpaceInactive: true, clickWorks: true }, repaired: { name, tab: true, enter: true, space: true, repeatIgnored: true,
        bootstrapAriaPreserved: true, textUnchanged: true, focus, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) } });
    } finally { delete server.virtual[path]; }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  });

  for (const width of [375, 1280]) for (const app of ['krw-two', 'alabama-map']) await t.test(`native ${app}, ${width}px`, async st => {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 900 });
    st.after(() => page.close());
    await page.goto(`${server.origin}/pages/cases/${app}.html`);
    await waitForWidgetIdle(page);
    const summary = 'details.prx-recipe summary';
    await page.addScriptTag({ content: script });
    await tabTo(page, summary);
    const focus = await focusAppearance(page, summary);
    assert.equal(await page.$eval(summary, node => node.hasAttribute('data-prx-recipe-keyboard')), false);
    assert.equal(await page.$eval('details.prx-recipe', node => node.open), false);
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('details.prx-recipe', node => node.open), true);
    assert.equal(await page.$eval('details.prx-recipe pre', node => node.textContent.trim().split('\n').length), 3);
    await page.keyboard.press('Space');
    assert.equal(await page.$eval('details.prx-recipe', node => node.open), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (evidenceDir) await page.screenshot({ path: join(evidenceDir, `native-${app}-${width}.png`) });
    evidence.native.push({ app, width, tab: true, enter: true, space: true, focus, codeLines: 3 });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  });
  if (evidenceDir) writeFileSync(join(evidenceDir, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n');
});
