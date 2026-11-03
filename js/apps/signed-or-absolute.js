import { createWidget } from '../shared/base.js';
import ABS from '../../data/released/krw-absolute-gender.json' with { type: 'json' };
import { expectedRank, fixedOrderDP, disclosure, evaluateReport, relationChange, scoreOrder } from '../pr-core.js';
import { formatCount, formatPercent, formatDecimal, formatGrades, formatRisk, formatShare, formatSizes, formatSci } from '../shared/format.js';
import { tagNode, labelNode, captionNode } from '../shared/labels.js';
import { KRW_COMMON_CSS, createKrwCardView, createKrwPrecisionView, readKrwModel, ro, appendKrwNotice } from './krw-common.js';
const cache = new Map();
export function signedAbsoluteModel() {
    if (cache.has('model'))
        return cache.get('model');
    const signed = readKrwModel('gender'), a = ABS.arrays.error, u = ABS.tables.units;
    if (a.ids.length !== signed.n || a.ids.some((id, i) => id !== signed.ids[i] || u.id[i] !== id))
        throw new Error('The signed and folded KRW firm IDs do not match');
    const folded = { ...signed, criterion: 'absolute', target: 'gender_absolute', E: a, e: a.e[0], mean: u.mean.slice(), lower: u.lower.slice(), upper: u.upper.slice() }, reports = [signed, folded].map(model => { const rank = expectedRank(model.E), order = scoreOrder(rank, { direction: 'ascending' }).order, opt = fixedOrderDP(model.E, { scores: rank, direction: 'ascending', G: 4, tau: .2, tieTol: 1e-12, maxTies: 100 }), ev = evaluateReport(opt.grade, model.E, { tau: .2 }); return { model, rank, order, opt, c: { grade: opt.grade, d: disclosure(opt.grade), ev, tau: .2, DR: ev.EoverM[0] } }; }), change = relationChange(reports[0].c.grade, reports[1].c.grade);
    const result = { signed: reports[0], absolute: reports[1], change };
    cache.set('model', result);
    return result;
}
const relation = (r, i, j, names) => r === 'withheld' ? 'withheld' : r === 'above' ? `${names[i]} above ${names[j]}` : `${names[j]} above ${names[i]}`;
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'signed-or-absolute', className: 'prx-kr prx-rc prx-soa', css: KRW_COMMON_CSS + `.prx-soa .kr-wide-table{min-width:60rem}.prx-soa .kr-scroll table caption{text-align:left}.prx-soa .kr-stage-status{min-height:1.5em;margin:.3rem 0}`, label: 'The signed gender gap versus its absolute size under their exact released posterior laws', keys: { view: { type: 'choice', values: ['cards', 'pairs', 'firms'], value: 'cards' } }, build(ctx) {
            const { h } = ctx, view = ctx.radioGroup({ legend: 'Inspect', name: 'view', options: [{ value: 'cards', label: 'Both report cards' }, { value: 'pairs', label: 'Every changed pair' }, { value: 'firms', label: 'All firm summaries and orders' }], value: ctx.state.view, onChange: v => ctx.set({ view: v }) });
            const progress = h('p', { class: 'kr-note kr-stage-status', 'aria-hidden': 'true' });
            ctx.controls.append(view.root, progress);
            const header = h('section', { class: 'kr-header' }), cards = h('div', { class: 'kr-grid' }), left = h('section'), right = h('section'), pairs = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'Every pair whose report relation changes across targets'), firms = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'All firms, their exact supplied summaries, expected ranks and grades');
            cards.append(left, right);
            const precision = h('div', { class: 'kr-grid' }), signedPrecision = h('section'), absolutePrecision = h('section');
            precision.append(signedPrecision, absolutePrecision);
            const precisionViews = [createKrwPrecisionView(ctx, signedPrecision, { prefix: 'signed' }), createKrwPrecisionView(ctx, absolutePrecision, { prefix: 'absolute' })];
            const scrollHint = h('p', { class: 'kr-note', text: 'The complete tables scroll sideways. Focus a table region and use arrow keys to reach every column.' });
            ctx.charts.append(cards, precision, header, scrollHint, pairs, firms);
            const renderers = [createKrwCardView(ctx, left), createKrwCardView(ctx, right)];
            appendKrwNotice(ctx);
            // The two exact target reports never depend on the selected view. Keep their model and
            // complete DOM, and repaint only the figures whose width/theme has actually changed.
            let data, both, names, readout, pairBody, firmBody, generation = 0, cancelNext = null, dead = false;
            const painted = [null, null, null, null];
            const stop = () => { generation++; cancelNext?.(); cancelNext = null; };
            ctx.onCleanup(() => { dead = true; stop(); progress.textContent = ''; ctx.root.removeAttribute('aria-busy'); });
            const prepare = () => {
                if (data) return;
                data = signedAbsoluteModel(); both = [data.signed, data.absolute]; names = data.signed.model.names;
                header.replaceChildren(h('h4', { text: 'Two targets, each with its own declared expected-rank order' }), h('p', {}, 'Both use at most ', ro(ctx, 'cap', 4, formatCount), ' grades at τ ', ro(ctx, 'tau', .2, formatRisk), '. Signed means male-name minus female-name contact advantage; absolute means the size of either advantage. The absolute law uses folded posterior cells, not the absolute value of a signed mean and not a Gaussian approximation.'), h('p', { class: 'kr-note', text: 'The two expected-rank orders define different families. Evaluate each report under its own target law; their risks are not a same-loss comparison. These are newly computed order-constrained reports, not KRW’s archived cards.' }), h('p', {}, ro(ctx, 'changed', data.change.changed, formatCount), ' of ', ro(ctx, 'M', data.change.M, formatCount), ' pair relations differ: ', ro(ctx, 'newly-stated', data.change.nNewDisclosed, formatCount), ' newly stated, ', ro(ctx, 'newly-withheld', data.change.nNewWithheld, formatCount), ' newly withheld, ', ro(ctx, 'reversed', data.change.nReversed, formatCount), ' reversed. “New” reads from signed to absolute.'));
                readout = ['Signed report: N ', ro(ctx, 'ro-signed-N', data.signed.c.d.N, formatCount), ', E/N ', ro(ctx, 'ro-signed-EoverN', data.signed.c.ev.EoverN[0], formatShare), '. Absolute report: N ', ro(ctx, 'ro-absolute-N', data.absolute.c.d.N, formatCount), ', E/N ', ro(ctx, 'ro-absolute-EoverN', data.absolute.c.ev.EoverN[0], formatShare), '. Each is optimal within its own expected-rank order, with the same cap and withholding cost.'];
            };
            const renderCard = k => {
                const r = both[k], slot = k === 0 ? left : right;
                renderers[k].render(r.model, r.c, { sort: 'mean', reveal: 0, sortInstruction: 'Rows stay in posterior-mean order within each grade. A shared grade states no direction between its firms.' });
                slot.querySelector('.kr-computed-info')?.remove();
                const info = h('div', { class: 'kr-note kr-computed-info' }, h('b', { text: k === 0 ? 'Signed gender gap' : 'Absolute gender-gap size' }), ': ', labelNode(ctx, r.opt), '. ', tagNode(ctx, r.opt, { orderWords: k === 0 ? "the signed-target expected-rank order" : "the absolute-target expected-rank order" }), '. At most ', ro(ctx, null, 4, formatCount), ' grades, τ ', ro(ctx, null, .2, formatRisk), '. Family size ', ro(ctx, `${k ? 'absolute' : 'signed'}-familySize`, r.opt.family.size, formatCount), '. N ', ro(ctx, `${k ? 'absolute' : 'signed'}-N`, r.c.d.N, formatCount), '; ', ro(ctx, `${k ? 'absolute' : 'signed'}-sizes`, r.c.d.sizes, formatSizes), '; E/N ', ro(ctx, `${k ? 'absolute' : 'signed'}-EoverN`, r.c.ev.EoverN[0], formatShare), '; risk ', ro(ctx, `${k ? 'absolute' : 'signed'}-risk`, r.c.ev.risk, formatRisk), '. ', ro(ctx, `${k ? 'absolute' : 'signed'}-tieCount`, r.opt.tieCount, formatCount), r.opt.tieCount === 1 ? ' equal-risk optimum, tolerance ' : ' equal-risk optima, tolerance ', ro(ctx, `${k ? 'absolute' : 'signed'}-tieTol`, r.opt.tieTol, formatSci), '.');
                if (r.opt.tieCount > 1)
                    info.append(h('p', {}, 'Returned equal-risk grade vectors: ', ...r.opt.grades.map(g => h('span', {}, ro(ctx, null, g, formatGrades), ' ')), '. The displayed representative follows the engine’s first optimal cut policy; all tied alternatives are retained.'));
                const vectors = h('details', {}, h('summary', { text: 'Full selected and returned equal-risk grade vectors' }), h('p', {}, 'Selected grades in released firm-ID order: ', ro(ctx, `${k ? 'absolute' : 'signed'}-grade`, r.c.grade, formatGrades)), ...r.opt.grades.map((g, j) => h('p', {}, 'Returned optimum ', ro(ctx, null, j + 1, formatCount), ': ', ro(ctx, null, g, formatGrades))));
                info.append(vectors);
                slot.prepend(info);
            };
            const pairRow = p => {
                const err = (r, d) => d === 'withheld' ? null : d === 'above' ? r.model.e[p.i][p.j] : r.model.e[p.j][p.i];
                return h('tr', { 'data-prx-pair': `${p.i}-${p.j}` }, h('th', { scope: 'row', text: names[p.i] }), h('td', { text: names[p.j] }), h('td', { 'data-prx-relation': p.from, 'data-prx-readout': `signed-pair-relation-${p.i}-${p.j}`, text: relation(p.from, p.i, p.j, names) }), h('td', { 'data-prx-relation': p.to, 'data-prx-readout': `absolute-pair-relation-${p.i}-${p.j}`, text: relation(p.to, p.i, p.j, names) }), h('td', {}, ro(ctx, `signed-pair-error-${p.i}-${p.j}`, err(data.signed, p.from), formatShare)), h('td', {}, ro(ctx, `absolute-pair-error-${p.i}-${p.j}`, err(data.absolute, p.to), formatShare)));
            };
            const firmRow = (name, i) => h('tr', { 'data-prx-firm-row': String(i) }, h('th', { scope: 'row', text: name }), ...both.flatMap(r => [r.model.mean[i], r.model.lower[i], r.model.upper[i]]).map(v => h('td', {}, ro(ctx, null, v, v => formatDecimal(v, { digits: 3 })))), ...both.map(r => h('td', {}, ro(ctx, null, r.rank[i], v => formatDecimal(v, { digits: 3 })))), ...both.map(r => h('td', {}, ro(ctx, null, r.c.grade[i], formatCount))));
            const finish = () => { cancelNext = null; progress.textContent = ''; ctx.readout.set(readout); ctx.root.removeAttribute('aria-busy'); };
            return { render(s) {
                    stop(); const epoch = generation;
                    prepare(); view.set(s.view);
                    cards.hidden = precision.hidden = s.view !== 'cards';
                    scrollHint.hidden = s.view === 'cards';
                    pairs.hidden = s.view !== 'pairs'; firms.hidden = s.view !== 'firms';
                    const stages = [];
                    if (s.view === 'cards') {
                        const theme = ctx.root.getAttribute('data-theme') || ctx.doc.documentElement.getAttribute('data-theme') || (ctx.win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                        const stamp = JSON.stringify([ctx.width(), theme, ctx.reducedMotion]);
                        for (let k = 0; k < 2; k++) {
                            if (painted[k] !== stamp) stages.push(() => { renderCard(k); painted[k] = stamp; });
                            if (painted[k + 2] !== stamp) stages.push(() => { precisionViews[k].render(both[k].model, both[k].c); painted[k + 2] = stamp; });
                        }
                    }
                    if (s.view === 'pairs') {
                        if (!pairBody) stages.push(() => {
                            pairBody = h('tbody');
                            pairs.replaceChildren(h('table', { class: 'kr-table kr-wide-table' }, h('caption', { text: 'Complete list of changed unordered pairs; report directions concern different targets' }), h('thead', {}, h('tr', {}, ...['Firm i', 'Firm j', 'Signed report', 'Absolute report', 'Signed stated error', 'Absolute stated error'].map(text => h('th', { scope: 'col', text })))), pairBody));
                        });
                        // Rows are retained when a view is interrupted; resume its exact missing suffix.
                        for (let start = pairBody?.children.length || 0; start < data.change.pairs.length; start += 64) {
                            const from = start;
                            stages.push(() => pairBody.append(...data.change.pairs.slice(from, from + 64).map(pairRow)));
                        }
                    }
                    if (s.view === 'firms') {
                        if (!firmBody) stages.push(() => {
                            firmBody = h('tbody');
                            firms.replaceChildren(h('table', { class: 'kr-table kr-wide-table' }, h('caption', {}, 'All firms in released ID order; supplied central ', ro(ctx, null, .9, formatPercent), ' intervals, expected ranks and newly computed grades'), h('thead', {}, h('tr', {}, ...['Firm', 'Signed mean', 'Signed lower', 'Signed upper', 'Absolute mean', 'Absolute lower', 'Absolute upper', 'Signed expected rank', 'Absolute expected rank', 'Signed grade', 'Absolute grade'].map(text => h('th', { scope: 'col', text })))), firmBody));
                        });
                        for (let start = firmBody?.children.length || 0; start < names.length; start += 24) {
                            const from = start;
                            stages.push(() => firmBody.append(...names.slice(from, from + 24).map((name, i) => firmRow(name, from + i))));
                        }
                    }
                    if (!stages.length) { finish(); return; }
                    ctx.root.setAttribute('aria-busy', 'true'); progress.textContent = 'Updating reports…';
                    ctx.readout.set(['Updating the complete signed and absolute target views…']);
                    let stage = 0;
                    const next = () => {
                        if (dead || epoch !== generation) return;
                        ctx.keepFocus(() => stages[stage++]());
                        if (dead || epoch !== generation) return;
                        if (stage < stages.length) cancelNext = ctx.timeout(next, 20);
                        else finish();
                    };
                    cancelNext = ctx.timeout(next, 20);
                } };
        } });
}
