// Focused source-content repair check; no CPU benchmark or new statistical producer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, launchChrome, openTab, waitForWidgetIdle, ROOT } from '../browser.mjs';
import { caseInput } from '../../js/shared/case-inputs.js';
const entry = JSON.parse(readFileSync(join(ROOT, 'catalog/entries/T.2-report-designer.json')));
const oracle = JSON.parse(readFileSync(join(ROOT, 'verification/golden/oracle-v3p5-tools.json'))).rows;
const evidence = process.env.PRX_REPORTING_EVIDENCE;
const readout = (page, key) => page.$eval(`[data-prx-readout="${key}"]`, e => ({ text: e.textContent, raw: Number.isFinite(Number(e.dataset.num)) ? Number(e.dataset.num) : e.dataset.num }));
const clickPreset = async (page, id) => { await page.click(`.prx-presets button[data-value="${id}"]`); await waitForWidgetIdle(page); };
const reportView = async page => { await page.click('[data-prx-focus-key="radio:view:2"]'); await waitForWidgetIdle(page); };
async function captureTxt(page) {
  await page.click('[data-prx-focus-key="download-sentence"]');
  return page.evaluate(async () => { const d = __reportingDownloads.at(-1); return { filename: d.filename, text: await d.blob.text() }; });
}
test('all public reporting presets keep their frozen results and self-contained native TXT at page/embed desktop/mobile in both themes', async () => {
  const server = await startServer(), browser = await launchChrome(), results = [];
  if (evidence) mkdirSync(join(evidence, 'native-txt'), { recursive: true });
  try {
    for (const surface of ['pages/tools', 'embed']) for (const width of [1280, 375]) for (const theme of ['light', 'dark']) {
      const tab = await openTab(browser, { origin: server.origin, width, height: 800, scheme: theme === 'dark' ? 'dark' : 'light' }), page = tab.page;
      await page.evaluateOnNewDocument(() => {
        window.__reportingDownloads = [];
        const makeURL = URL.createObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = makeURL(blob); __reportingDownloads.push({ blob, url }); return url; };
        document.addEventListener('click', e => { const a = e.target.closest('a[download]'); if (a) { e.preventDefault(); const d = __reportingDownloads.find(d => d.url === a.href); if (d) d.filename = a.download; } });
      });
      await page.goto(`${server.origin}/${surface}/report-designer.html?theme=${theme}`, { waitUntil: 'load' });
      await waitForWidgetIdle(page);
      await page.evaluate(theme => __prxApp.update({ theme }), theme); await waitForWidgetIdle(page);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      const samples = [];
      for (const preset of entry.presets) {
        await clickPreset(page, preset.id);
        const row = oracle.find(r => r.id === 'tool-designer-' + preset.id), input = caseInput(row.args.case), e = row.expect.optimum.evaluation;
        assert.equal((await readout(page, 'N')).raw, e.N);
        assert.ok(Math.abs((await readout(page, 'risk')).raw - e.risk) < 1e-12);
        assert.equal((await readout(page, 'tieCount')).raw, row.expect.optimum.tieCount);
        assert.equal((await readout(page, 'changed')).raw, row.expect.change.changed);
        await reportView(page);
        const model = await page.$eval('[data-prx-readout="model-sentence"]', e => e.textContent), txt = await captureTxt(page);
        assert.ok(txt.text.startsWith(model + '\n\n'), 'the visible and downloaded models share one construction');
        assert.ok(model.includes(input.grade1));
        assert.ok(model.includes(input.conditioning));
        for (const c of input.criteria) assert.ok(model.includes(input.targets[c]));
        assert.ok(txt.text.includes(input.notice.attribution) && txt.text.includes(input.notice.changes) && txt.text.includes(input.notice.text));
        if (row.args.case === 'krw') assert.match(model, /historical experiment, not any firm’s current conduct/);
        if (row.args.case === 'alabama') assert.match(model, /most favorable historical outcomes, not a measure of need/);
        if (e.N === 0) assert.match(model, /NA: no disclosure/);
        const checklist = await page.$eval('[data-prx-readout="reporting-checklist"]', e => e.textContent);
        assert.match(checklist, /Unscored reporting checklist/);
        assert.match(checklist, /Not computed here.*commonality cost Δ_k/);
        assert.match(checklist, /matched disclosure N.*ψ mixture/);
        for (const field of ['input$targets', 'provenance$orientation', 'input$provenance', 'input$context', 'evaluation$M', 'settings$tau', 'settings$weights', 'settings$G_max', 'settings$exact_G', 'settings$q', 'get_risk()', 'fit$objective$bound_source', 'postrank_mc_fragility()', 'evaluation$N', 'get_relations()', 'get_profile()$E_over_N', 'postrank_commonality_cost()$table', 'postrank_compare()']) assert.ok(checklist.includes(field), field);
        assert.match(checklist, /selection posterior and is not an external calibration claim/);
        assert.match(checklist, /Averaging realized wrong fractions over datasets is a different statistic from the ratio of expected wrong to expected stated directions/);
        assert.match(checklist, /does not compute an external calibration study or either across-dataset average/);
        assert.equal(await page.$$eval('.des-export-buttons button', e => e.length), 6);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (evidence) writeFileSync(join(evidence, 'native-txt', `${surface.replace('/', '-')}-${width}-${theme}-${preset.id}.txt`), txt.text);
        samples.push({ preset: preset.id, N: e.N, risk: e.risk, changed: row.expect.change.changed, txtBytes: txt.text.length });
      }
      // Native edits leave the stored solve metadata fixed while both risk evaluations use the current loss.
      for (const key of ['cde', 'krw', 'alabama']) {
        await clickPreset(page, key); const before = await readout(page, 'archive-risk');
        const input = caseInput(key), stored = { tau: await readout(page, 'archive-tau'), cap: await readout(page, 'archive-cap'), weights: await readout(page, 'archive-weights') };
        await page.focus('input[name="tau"]'); await page.keyboard.press('ArrowRight'); await waitForWidgetIdle(page);
        await page.focus('input[name="cap"]'); await page.keyboard.press('ArrowDown'); await waitForWidgetIdle(page);
        if (key !== 'cde') { await page.focus('input[name="w"]'); await page.keyboard.press('ArrowRight'); await waitForWidgetIdle(page); }
        assert.deepEqual(await readout(page, 'archive-tau'), stored.tau);
        assert.deepEqual(await readout(page, 'archive-cap'), stored.cap);
        assert.deepEqual(await readout(page, 'archive-weights'), stored.weights);
        assert.notEqual((await readout(page, 'archive-risk')).raw, before.raw);
        assert.equal((await readout(page, 'archive-tau')).raw, input.archive.settings.tau);
        await reportView(page); const txt = await captureTxt(page), model = await page.$eval('[data-prx-readout="model-sentence"]', e => e.textContent);
        assert.ok(txt.text.startsWith(model + '\n\n'));
        if (evidence) writeFileSync(join(evidence, 'native-txt', `${surface.replace('/', '-')}-${width}-${theme}-${key}-native-edits.txt`), txt.text);
        if (key === 'krw') { const axes = await page.$eval('[data-prx-readout="krw-settings"]', e => e.textContent); assert.match(axes, /common analysis τ = \.25.*cards λ = \.25.*τ = \.20/); }
      }
      await clickPreset(page, 'cde-cap2');
      assert.equal((await readout(page, 'changed')).raw, 27);
      assert.match(await page.$eval('[data-prx-readout="archive-cap"]', e => e.closest('section').textContent), /more grades than the current cap/);
      await clickPreset(page, 'cde-withheld'); await reportView(page);
      await page.type('textarea', 'E/N = 0. These tiers are ranks.');
      assert.match(await page.$eval('textarea', e => e.nextElementSibling.textContent), /At N = 0.*NA: no disclosure/);
      assert.match(await page.$eval('textarea', e => e.nextElementSibling.textContent), /Call the reported categories grades/);
      // Each follow-up opens the complete local app using a native link click, including file:// embeds below.
      await clickPreset(page, 'krw'); await reportView(page);
      const links = await page.$$eval('.des-checklist a', links => links.map(a => ({ label: a.textContent, href: a.href })));
      assert.equal(links.length, 5);
      if (evidence) {
        const stem = `${surface.replace('/', '-')}-${width}-${theme}`;
        await page.$eval('[data-prx-readout="model-sentence"]', e => e.scrollIntoView());
        await page.screenshot({ path: join(evidence, stem + '-model.png') });
        await page.$eval('.des-checklist', e => e.scrollIntoView());
        await page.screenshot({ path: join(evidence, stem + '-checklist.png') });
        await page.$eval('[data-prx-readout="archive-tau"]', e => e.closest('section').scrollIntoView());
        await page.screenshot({ path: join(evidence, stem + '-archive.png') });
      }
      for (const link of links) {
        const here = page.url();
        const linkIndex = links.findIndex(l => l.label === link.label), handles = await page.$$('.des-checklist a');
        await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), handles[linkIndex].click()]);
        assert.equal(page.url(), link.href);
        await waitForWidgetIdle(page);
        await page.goto(here, { waitUntil: 'load' }); await waitForWidgetIdle(page); await page.evaluate(theme => __prxApp.update({ theme }), theme); await waitForWidgetIdle(page); await reportView(page);
      }
      assert.deepEqual(tab.errors, []); assert.deepEqual(tab.failed, []);
      results.push({ surface, width, theme, samples, linkedApps: links.map(l => new URL(l.href).pathname), errors: tab.errors, failed: tab.failed });
      await page.close();
    }
    // Standalone links also resolve without an HTTP server.
    const fileTab = await openTab(browser, { width: 375, height: 800 });
    await fileTab.page.goto('file://' + join(ROOT, 'docs/embed/report-designer.html') + '?preset=krw&view=report&theme=dark', { waitUntil: 'load' });
    await waitForWidgetIdle(fileTab.page);
    for (let i = 0; i < 5; i++) {
      const href = await fileTab.page.$$eval('.des-checklist a', (as, i) => as[i].href, i), here = fileTab.page.url();
      const links = await fileTab.page.$$('.des-checklist a');
      await Promise.all([fileTab.page.waitForNavigation({ waitUntil: 'load' }), links[i].click()]);
      assert.equal(fileTab.page.url(), href); await waitForWidgetIdle(fileTab.page);
      await fileTab.page.goto(here, { waitUntil: 'load' }); await waitForWidgetIdle(fileTab.page);
    }
    assert.deepEqual(fileTab.errors, []); assert.deepEqual(fileTab.failed, []); await fileTab.page.close();
    if (evidence) writeFileSync(join(evidence, 'native-reporting-results.json'), JSON.stringify({ surfaces: results, fileLinks: '5/5 passed' }, null, 2) + '\n');
  } finally { await browser.close(); await server.close(); }
});

test('long public-case cards reveal each native End/Home/Arrow focus and its full tooltip inside the bounded card', async () => {
  const server = await startServer(), browser = await launchChrome(), results = [];
  try {
    for (const surface of ['pages/tools', 'embed']) for (const width of [1280, 375]) for (const theme of ['light', 'dark']) for (const key of ['krw', 'alabama']) {
      const tab = await openTab(browser, { origin: server.origin, width, height: 800 }), page = tab.page;
      await page.goto(`${server.origin}/${surface}/report-designer.html?preset=${key}&theme=${theme}`, { waitUntil: 'load' });
      await waitForWidgetIdle(page); await page.evaluate(theme => __prxApp.update({ theme }), theme); await waitForWidgetIdle(page);
      const count = caseInput(key).n;
      assert.equal(await page.$$eval('.des-card-scroll .prx-kbd-point', es => es.length), count);
      assert.equal(await page.$$eval('.des-card-scroll tbody tr', es => es.length), count);
      await page.$eval('.des-card-scroll', e => e.scrollIntoView({ block: 'center' }));
      await page.focus('.des-card-scroll .prx-kbd-point[tabindex="0"]');
      const moves = [];
      for (const move of ['End', 'End', 'ArrowDown', 'ArrowUp', 'Home', 'Home', 'ArrowUp', 'ArrowDown', 'End', 'ArrowLeft', 'ArrowRight']) {
        // Deliberately scroll away from the active point before using the native navigation key.
        await page.$eval('.des-card-scroll', (e, move) => { e.scrollTop = move === 'Home' || move === 'ArrowDown' ? e.scrollHeight : 0; }, move);
        await page.keyboard.press(move);
        const boxes = await page.evaluate(() => {
          const active = document.activeElement, tip = active.closest('.des-card-scroll').querySelector('.prx-kbd-tip'), scroll = active.closest('.des-card-scroll');
          const clip = scroll.getBoundingClientRect(), row = active.getBoundingClientRect(), description = tip.getBoundingClientRect();
          return { label: active.getAttribute('aria-label'), top: row.top, bottom: row.bottom, tipTop: description.top, tipBottom: description.bottom, tipLeft: description.left, tipRight: description.right, clipTop: clip.top + scroll.clientTop, clipBottom: clip.top + scroll.clientTop + scroll.clientHeight, clipLeft: clip.left + scroll.clientLeft, clipRight: clip.left + scroll.clientLeft + scroll.clientWidth, scrollTop: scroll.scrollTop, tip: tip.textContent, hidden: tip.hidden };
        });
        assert.ok(boxes.top >= boxes.clipTop - 1 && boxes.bottom <= boxes.clipBottom + 1, JSON.stringify({ surface, width, theme, key, move, boxes }));
        assert.ok(boxes.tipTop >= boxes.clipTop - 1 && boxes.tipBottom <= boxes.clipBottom + 1, JSON.stringify({ surface, width, theme, key, move, boxes }));
        assert.ok(boxes.tipLeft >= boxes.clipLeft - 1 && boxes.tipRight <= boxes.clipRight + 1);
        assert.equal(boxes.hidden, false); assert.ok(boxes.tip.length > 50);
        moves.push({ move, ...boxes });
      }
      if (evidence) await page.screenshot({ path: join(evidence, `${surface.replace('/', '-')}-${width}-${theme}-${key}-native-end.png`) });
      assert.deepEqual(tab.errors, []); assert.deepEqual(tab.failed, []);
      results.push({ surface, width, theme, case: key, retainedRows: count, moves }); await page.close();
    }
    if (evidence) writeFileSync(join(evidence, 'native-longcard-results.json'), JSON.stringify(results, null, 2) + '\n');
  } finally { await browser.close(); await server.close(); }
});
