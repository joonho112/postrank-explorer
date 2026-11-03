import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeWindow, sleep } from '../dom-env.mjs';
import { caseInput } from '../../js/shared/case-inputs.js';
import { DEFAULTS, designerModel, mountWidget, csvText, exportR, exportTables, reportSentence, sentenceHints } from '../../js/apps/report-designer.js';
const settings = key => ({ case: key, ...DEFAULTS[key], qa: null, qb: null });
test('budget edits check the same report and N=0 keeps undefined shares', () => {
    const initial = designerModel(settings('cde')), budgeted = designerModel({ ...settings('cde'), qa: .0001 });
    assert.equal(initial.optimum, budgeted.optimum, 'q is absent from the optimization cache key');
    assert.deepEqual(initial.grade, budgeted.grade);
    assert.equal(budgeted.budget.rows[0].meets, false);
    const empty = designerModel({ ...settings('cde'), cap: 1, qa: .1 });
    assert.equal(empty.evaluation.N, 0);
    assert.equal(empty.evaluation.EoverN[0], null);
    assert.equal(empty.budget.rows[0].meets, true);
});
test('a private draft survives public-setting/view updates without entering state, URL, messages or storage; explicit download reproduces it', async () => {
    const env = makeWindow({ query: 'case=cde&cap=1&view=report' }), messages = [], blobs = [];
    let handle;
    env.win.postMessage = message => messages.push(message);
    env.win.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:local-test'; };
    env.win.URL.revokeObjectURL = () => { };
    env.doc.addEventListener('click', e => { if (e.target.closest('a[download]'))
        e.preventDefault(); });
    try {
        handle = mountWidget(env.el);
        await sleep(30);
        const draft = env.el.querySelector('textarea'), privateText = 'Local "quoted", Unicode 학교\nsecond line';
        draft.value = privateText;
        draft.dispatchEvent(new env.win.Event('input', { bubbles: true }));
        handle.update({ tau: .21, qa: .1, view: 'card' });
        await sleep(30);
        handle.update({ view: 'report' });
        await sleep(30);
        assert.equal(draft.value, privateText);
        assert.ok(!JSON.stringify(handle.state).includes(privateText));
        assert.ok(!env.win.location.href.includes('Local'));
        assert.ok(!JSON.stringify(messages).includes('Unicode'));
        assert.equal(env.win.localStorage.length, 0);
        assert.equal(env.win.sessionStorage.length, 0);
        [...env.el.querySelectorAll('button')].find(b => b.textContent === 'My draft TXT').click();
        assert.equal(blobs.length, 1);
        const text = await new Promise((ok, no) => { const reader = new env.win.FileReader(); reader.onload = () => ok(reader.result); reader.onerror = no; reader.readAsText(blobs[0]); });
        assert.ok(text.startsWith(privateText + '\n\n'));
        handle.update({ tau: .22 });
        handle.destroy();
        await sleep(20);
        assert.equal(env.el.querySelector('.prx-widget'), null, 'a queued computation cannot resurrect a destroyed widget');
        assert.equal(env.ro.live(),0,'all owned and reused overflow observers are disposed on destruction');
    }
    finally {
        handle?.destroy();
        env.restore();
    }
});
test('CSV escaping preserves quotes, commas, newlines and Unicode labels with complete n-squared relation rows', () => {
    const m = designerModel(settings('krw')), tables = exportTables(m);
    assert.equal(tables.relations.length, caseInput('krw').n ** 2 + 1);
    assert.equal(tables.units.length, 98);
    assert.equal(csvText([['001', '"A", 학교\nsecond']]), '"001","""A"", 학교\nsecond"\r\n');
    assert.equal(sentenceHints('Shared grades do not assert equality. tau .2; cap three; criterion weights; within this family.').length, 0);
    assert.ok(sentenceHints('λ = τ').some(h=>h.repair.includes('different loss parameters')));
    assert.ok(sentenceHints('Equal scores with a confidence level and error rate.').length >= 3);
});
test('the downloaded R scripts execute with postrank1.1.0 and round-trip every released coefficient and supplied marginal at double precision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prx-designer-export-'));
    try {
        for (const key of ['cde', 'krw', 'alabama']) {
            const m = designerModel(settings(key)), binary = join(dir, key + '.bin'), file = join(dir, key + '.R'), ids = join(dir, key + '-ids.txt');
            writeFileSync(file, exportR(m) + `\nwriteBin(c(as.double(e),as.double(summaries$means),as.double(summaries$lower),as.double(summaries$upper),summaries$level,settings$tau,as.double(settings$weights),as.double(q),archive_record$tau,as.double(archive_record$weights),archive_record$lower_bound,archive_record$gap),${JSON.stringify(binary)},size=8,endian="little")\nwriteLines(ids,${JSON.stringify(ids)},useBytes=TRUE)\nstopifnot(as.character(packageVersion("postrank"))=="1.1.0")\n`);
            const run = spawnSync('Rscript', [file], { encoding: 'utf8', env: { ...process.env, R_LIBS_USER: process.env.POSTRANK_LIB || resolve('.R-library') } });
            assert.equal(run.status, 0, run.stderr);
            const bytes = readFileSync(binary), values = [];
            for (let k = 0; k < m.input.K; k++)
                for (let j = 0; j < m.input.n; j++)
                    for (let i = 0; i < m.input.n; i++)
                        values.push(m.input.E.e[k][i][j]);
            for (const name of ['mean', 'lower', 'upper'])
                values.push(...m.input.marginals[name].flat());
            values.push(m.input.marginals.level,m.tau,...m.w,...m.q,m.input.archive.settings.tau,...m.input.archive.settings.w,m.input.archive.lowerBound,m.input.archive.gap);
            assert.equal(bytes.length, values.length * 8);
            for (let j = 0; j < values.length; j++)
                values[j] === null ? assert.ok(Number.isNaN(bytes.readDoubleLE(j * 8)), key + ' missing diagonal ' + j) : assert.equal(bytes.readDoubleLE(j * 8), values[j], key + ' coefficient ' + j);
            assert.deepEqual(readFileSync(ids, 'utf8').trimEnd().split('\n'), m.input.ids);
        }
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('reporting models retain target orientation and posterior conditioning with current weights and undefined shares', () => {
    for (const key of ['cde', 'krw', 'alabama']) {
        const m = designerModel(settings(key)), d = m.input, text = reportSentence(m);
        assert.ok(text.includes(d.grade1));
        assert.ok(text.includes(d.conditioning));
        for (const c of d.criteria) assert.ok(text.includes(d.targets[c]));
        assert.match(text, /tie tolerance/);
        assert.match(text, /unassessed units suppressed rather than graded last/);
        assert.equal(sentenceHints(text, m).length, 0, 'the declared targets and expected-rank order are valid terminology');
    }
    assert.equal(sentenceHints('tau .2; cap three; criterion weights; within this family. A grade is not a tier or a rank.').length, 0);
    const changed = designerModel({ ...settings('krw'), w: .75 });
    assert.match(reportSentence(changed), /weights \(\.75, \.25\)/);
    assert.match(reportSentence(changed), /historical experiment, not any firm’s current conduct/);
    assert.match(reportSentence(designerModel(settings('alabama'))), /most favorable historical outcomes, not a measure of need/);
    const empty = designerModel({ ...settings('cde'), cap: 1 });
    assert.match(reportSentence(empty), /NA: no disclosure/);
    assert.ok(sentenceHints('E/N = 0.', empty).some(h => h.repair.includes('At N = 0')));
    assert.ok(sentenceHints('These tiers are ranks.').some(h => h.repair.includes('Call the reported categories grades')));
});
