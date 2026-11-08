import { appLink, createWidget } from '../shared/base.js';
import { readQuery } from '../shared/bridge.js';
import ABS from '../../data/released/krw-absolute-gender.json' with { type: 'json' };
import { expectedRank, fixedOrderDP, disclosure, evaluateReport, relationChange, scoreOrder } from '../pr-core.js';
import { formatCount, formatPercent, formatDecimal, formatGrades, formatRisk, formatShare, formatSizes, formatSci } from '../shared/format.js';
import { plot, numText, gradeColors } from '../shared/chart.js';
import { tagNode, labelNode, captionNode } from '../shared/labels.js';
import { KRW_COMMON_CSS, createKrwCardView, createKrwPrecisionView, readKrwModel, publishedCardMatches, ro, appendKrwNotice } from './krw-common.js';
const cache = new Map(), VIEWS = Object.freeze(['cards', 'pairs', 'firms']);
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
const SOA_CSS = `
.prx-soa .kr-wide-table{min-width:60rem}.prx-soa .kr-scroll table caption{text-align:left}
.prx-soa .kr-stage-status{margin:0;font-size:.8rem}.prx-soa .kr-stage-status:empty{display:none}
.prx-soa .kr-soa-result{font-size:.9rem;line-height:1.25;margin:.45rem 0}
.prx-soa .kr-soa-result p{margin:.22rem 0}.prx-soa .kr-soa-ranks h4{margin:.1rem 0}
.prx-soa .kr-soa-key{font-size:.77rem;margin:.22rem 0;line-height:1.22}
.prx-soa .kr-soa-detail{font-size:.84rem;line-height:1.3;margin:.2rem 0}
.prx-soa .kr-soa-selectors{display:grid;grid-template-columns:8rem minmax(0,1fr);align-items:center;gap:.35rem;min-width:0}
.prx-soa .kr-soa-filter{margin:.4rem 0}.prx-soa .kr-soa-view-title{font-size:.97rem;margin:.25rem 0}
.prx-soa .kr-computed-info{font-size:.81rem;line-height:1.25}
.prx-soa .kr-soa-selectors>.prx-control{margin:0;min-width:0}
.prx-soa .kr-soa-selectors .prx-seg-buttons{display:flex;overflow:auto;min-width:0}
.prx-soa .kr-soa-selectors>button{font-weight:600}.prx-soa .kr-soa-selectors>button[aria-pressed=true]{border-color:var(--prx-plot-fg)}
@media(max-width:40em){
.prx-soa .kr-soa-selectors{grid-template-columns:repeat(2,minmax(0,1fr))}
.prx-soa .kr-soa-selectors .prx-presets,.prx-soa .kr-soa-selectors .prx-seg-buttons{display:contents}
.prx-soa .kr-soa-selectors .prx-seg-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.prx-soa .kr-soa-selectors button,.prx-soa .kr-soa-selectors .prx-presets button.prx-seg[data-value]{white-space:normal;font-size:.83rem;text-align:center;margin:0;line-height:1.12;min-height:2.55rem}
}
`;
const changeType = p => p.from === 'withheld' ? 'stated' : p.to === 'withheld' ? 'withheld' : 'reversed';
function buildRankRows(reports) {
    const positions = reports.map(r => {
        const ordered = [...r.order].sort((i, j) => r.c.grade[i] - r.c.grade[j]);
        return new Map(ordered.map((i, j) => [i, j + .5]));
    });
    return reports[0].order.map(i => ({ i, signed: positions[0].get(i), absolute: positions[1].get(i),
        before: reports[0].c.grade[i], after: reports[1].c.grade[i], positive: reports[0].model.mean[i] >= 0 }));
}
export function mountWidget(el, spec = {}) {
    let chooseCards, refreshView;
    const handle = createWidget(el, spec, { name: 'signed-or-absolute', className: 'prx-kr prx-rc prx-soa', layout: 'result-first', css: KRW_COMMON_CSS + SOA_CSS, label: 'The signed gender gap versus its absolute size under their exact released posterior laws', keys: { view: { type: 'choice', values: VIEWS, value: 'cards' } }, build(ctx) {
            const { h } = ctx, view = ctx.radioGroup({ legend: 'Inspect', name: 'view', options: [{ value: 'cards', label: 'Both report cards' }, { value: 'pairs', label: 'Every changed pair' }, { value: 'firms', label: 'All firm summaries and orders' }], value: ctx.state.view, onChange: v => ctx.set({ view: v }) });
            const progress = h('p', { class: 'kr-note kr-stage-status', 'aria-hidden': 'true' });
            const route = spec.query === false ? null : readQuery({ allowed: ['view'], types: { view: VIEWS }, window: ctx.win });
            let showFull = spec.view === 'cards' || spec.preset === 'cards' || route?.spec.view === 'cards' || route?.preset === 'cards';
            let selectingLinks = false;
            chooseCards = () => {
                if (selectingLinks || showFull) return false;
                showFull = true; return true;
            };
            const linked = ctx.button({ label: 'Linked ranks', key: 'linked-ranks', onClick: () => {
                showFull = false;
                if (ctx.state.view === 'cards') ctx.requestRender('linked');
                else { selectingLinks = true; try { ctx.set({ view: 'cards' }); } finally { selectingLinks = false; } }
            } });
            linked.root.setAttribute('aria-pressed', String(!showFull));
            const selectors = h('div', { class: 'kr-soa-selectors' }, linked.root);
            ctx.controls.append(ctx.primaryControl(selectors));
            let chosenCards = false;
            const syncShownPreset = () => {
                const button = selectors.querySelector('.prx-presets button[data-value="cards"]');
                if (button && !chosenCards && button.getAttribute('aria-pressed') === 'true') button.setAttribute('aria-pressed', 'false');
            };
            const pressed = new ctx.win.MutationObserver(syncShownPreset);
            pressed.observe(selectors, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
            ctx.onCleanup(() => pressed.disconnect());
            const header = h('section', { class: 'kr-header' }), cards = h('div', { class: 'kr-grid' }), left = h('section'), right = h('section'), pairs = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'Every pair whose report relation changes across targets'), firms = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'All firms, their exact supplied summaries, expected ranks and grades');
            cards.append(left, right);
            const precision = h('div', { class: 'kr-grid' }), signedPrecision = h('section'), absolutePrecision = h('section');
            precision.append(signedPrecision, absolutePrecision);
            let precisionInspection = null;
            const precisionViews = [signedPrecision, absolutePrecision].map((slot, side) => createKrwPrecisionView(ctx, slot, {
                prefix: side ? 'absolute' : 'signed',
                onInspect(row) { if (precisionBox.open) { precisionInspection = { ...row, side }; writeSummary(); } },
            }));
            const scrollHint = h('p', { class: 'kr-note', text: 'The complete tables scroll sideways. Focus a table region and use arrow keys to reach every column.' });
            const summary = h('div', { class: 'kr-soa-result', 'aria-label': 'What changes across targets' }), chart = h('div'), picked = h('p', { class: 'kr-soa-detail' }), ranks = ctx.primaryGraphic(h('section', { class: 'kr-soa-ranks prx-light-panel' },
                h('h4', { text: 'Same firms, two rankings' }),
                h('p', { class: 'kr-soa-key', text: 'Teal dashes: female-name advantage · blue: zero or male-name advantage · thicker lines: grade changes' }), chart, picked));
            const filter = ctx.segmented({ name: 'pair-type', label: 'Show changed pairs', value: 'all', options: [
                { value: 'all', label: 'All' }, { value: 'reversed', label: 'Reversed' }, { value: 'stated', label: 'Newly stated' }, { value: 'withheld', label: 'Newly withheld' },
            ], onChange: v => { pairType = v; filter.set(v); sortPairView(); if (data) writeSummary(); } });
            filter.root.classList.add('kr-soa-filter');
            const pairView = h('section', {}, h('h4', { class: 'kr-soa-view-title', text: 'Complete list of changed unordered pairs' }), filter.root, pairs);
            const firmTitle = h('h4', { class: 'kr-soa-view-title' });
            const firmView = h('section', {}, firmTitle, firms), method = ctx.disclosure({ name: 'method', title: 'Method, exact families and report controls' }), precisionBox = ctx.disclosure({ name: 'precision', title: 'Original precision and full firm data' });
            const fullReadout = h('p', { class: 'kr-note' });
            ctx.charts.append(ranks, progress, ctx.primaryGraphic(cards), scrollHint, ctx.primaryGraphic(pairView), ctx.primaryGraphic(firmView));
            method.body.append(header, fullReadout, view.root); precisionBox.body.append(precision);
            const renderers = [createKrwCardView(ctx, left, { onPick: i => pick(i) }), createKrwCardView(ctx, right, { onPick: i => pick(i) })];
            let scrollFrom = null;
            renderers.forEach((r, k) => ctx.listen(r.scroll, 'scroll', () => {
                const other = renderers[1 - k].scroll;
                if (r.scroll === scrollFrom) { scrollFrom = null; return; }
                if (other.scrollTop === r.scroll.scrollTop) return;
                scrollFrom = other; other.scrollTop = r.scroll.scrollTop;
            }, { passive: true }));
            appendKrwNotice(ctx);
            // The two exact target reports never depend on the selected view. Keep their model and
            // complete DOM, and repaint only the figures whose width/theme has actually changed.
            let data, both, names, pairBody, firmBody, generation = 0, cancelNext = null, dead = false;
            const painted = [null, null, null, null];
            let rankRows, rankStamp, selected, pairType = 'all';
            const fmt = x => formatDecimal(x, { digits: 3 });
            const title = row => [names[row.i], ...both.map((r, k) => `${k ? 'Absolute' : 'Signed'} grade ${formatCount(r.c.grade[row.i])} · ${fmt(r.model.mean[row.i])} [${fmt(r.model.lower[row.i])}, ${fmt(r.model.upper[row.i])}]`)].join('\n');
            const pick = i => {
                if (!Number.isInteger(i) || i === selected) return;
                selected = i; precisionInspection = null; ctx.requestRender('pick');
            };
            const renderRanks = () => {
                const n = names.length, bandRows = both.flatMap((r, side) => {
                    let cursor = 0;
                    const bands = r.c.d.sizes.map((size, i) => {
                        const band = { side, g: i + 1, y1: cursor, y2: cursor + size, mid: cursor + size / 2, labelY: cursor + size / 2 };
                        cursor += size; return band;
                    });
                    bands.forEach((band, j) => { if (j) band.labelY = Math.max(band.labelY, bands[j - 1].labelY + 4.5); });
                    return bands;
                });
                const row = rankRows.find(d => d.i === selected) ?? rankRows.find(d => d.before !== d.after) ?? rankRows[0];
                const fillFor = d => d.positive ? '#245b92' : '#087c73';
                picked.replaceChildren(h('b', { text: names[row.i] }), ...both.map((r, k) => h('span', {},
                    k ? ' · Absolute grade ' : ' · Signed grade ', ro(ctx, null, r.c.grade[row.i], formatCount), ': ', ro(ctx, null, r.model.mean[row.i], fmt),
                    ' [', ro(ctx, null, r.model.lower[row.i], fmt), ', ', ro(ctx, null, r.model.upper[row.i], fmt), ']')));
                const one = [row], lines = [...rankRows].sort((a, b) => Number(a.before !== a.after) - Number(b.before !== b.after));
                plot(chart, { width: chart.clientWidth || ctx.width(), height: 302, marginLeft: 52, marginRight: 52, marginTop: 22, marginBottom: 8,
                    x: { domain: [-.07, 1.07], axis: null }, y: { domain: [n, 0], axis: null }, color: { type: 'identity' },
                    alt: 'Two axes show the signed and absolute expected-rank orders within their grade bands. Select any firm to read both supplied central posterior intervals.',
                    keyboard: { data: rankRows, x: () => 0, y: 'signed', key: d => both[0].model.ids[d.i], sort: false, label: 'Firms by signed expected rank; use the arrows to compare both intervals', title, pointer: true, pointerRadius: 40, onSelect: d => pick(d.i) },
                    marks: (k, P) => {
                        const colors = gradeColors(Math.max(...both.map(r => r.c.d.G)), k);
                        const links = (rows, positive) => P.link(rows.filter(d => d.positive === positive), { x1: 0, x2: 1, y1: 'signed', y2: 'absolute',
                            stroke: fillFor, strokeWidth: d => d.before !== d.after ? 1.7 : .65, strokeOpacity: d => d.before !== d.after ? .86 : .22,
                            ...(positive ? {} : { strokeDasharray: '3,2' }) });
                        return [
                            P.rect(bandRows, { x1: d => d.side - .04, x2: d => d.side + .04, y1: 'y1', y2: 'y2', fill: d => colors[d.g - 1], fillOpacity: .25, inset: .4 }),
                            links(lines, true), links(lines, false),
                            P.link(one, { x1: 0, x2: 1, y1: 'signed', y2: 'absolute', stroke: k.plotFg, strokeWidth: 2.5 }),
                            P.dot(one, { x: 0, y: 'signed', fill: fillFor, stroke: k.plotFg, r: 3.5 }), P.dot(one, { x: 1, y: 'absolute', fill: fillFor, stroke: k.plotFg, r: 3.5 }),
                            ...[0, 1].map(side => numText(bandRows.filter(d => d.side === side), { x: 'side', y: 'labelY', dx: side ? 18 : -18, value: 'g', format: formatCount, fill: k.plotFg, fontWeight: 'bold' })),
                            P.text([{ x: 0, label: 'Signed grades' }, { x: 1, label: 'Absolute grades' }], { x: 'x', y: 0, dy: -12, text: 'label', fill: k.plotFg, fontWeight: 'bold' }),
                        ];
                    } });
                chart.querySelectorAll('.prx-kbd-point').forEach((point, i) => point.addEventListener('click', e => { if (e.detail === 0) pick(rankRows[i].i); }));
            };
            const stop = () => { generation++; cancelNext?.(); cancelNext = null; };
            ctx.onCleanup(() => { dead = true; stop(); progress.textContent = ''; ctx.root.removeAttribute('aria-busy'); });
            const prepare = () => {
                if (data) return;
                data = signedAbsoluteModel(); both = [data.signed, data.absolute]; names = data.signed.model.names; rankRows = buildRankRows(both);
                firmTitle.replaceChildren('All firms in released ID order · ', ro(ctx, null, names.length, formatCount));
                const matches = publishedCardMatches(data.signed.model, data.signed.c.grade);
                summary.replaceChildren(h('p', {}, h('strong', {}, ro(ctx, 'changed', data.change.changed, formatCount), ' of ', ro(ctx, 'M', data.change.M, formatCount), ' pair relations change'), ' · ', ro(ctx, 'reversed', data.change.nReversed, formatCount), ' reversed · ', ro(ctx, 'newly-stated', data.change.nNewDisclosed, formatCount), ' newly stated · ', ro(ctx, 'newly-withheld', data.change.nNewWithheld, formatCount), ' newly withheld.'), h('p', {}, matches ? 'Signed grades match KRW’s published gender card (Fig. ' : 'Signed grades differ from KRW’s published gender card (Fig. ', ro(ctx, null, 14, formatCount), '). Each risk uses its own target.'));
                ['reversed','stated','withheld'].forEach((type, j) => filter.buttons[j + 1].append(' ', ro(ctx, null, [data.change.nReversed, data.change.nNewDisclosed, data.change.nNewWithheld][j], formatCount)));
                header.replaceChildren(h('h4', { text: 'Two targets, each with its own declared expected-rank order' }), h('p', {}, 'Both use at most ', ro(ctx, 'cap', 4, formatCount), ' grades at τ ', ro(ctx, 'tau', .2, formatRisk), '. Signed means male-name minus female-name contact advantage; absolute means the size of either advantage. The absolute law uses folded posterior cells, not the absolute value of a signed mean and not a Gaussian approximation.'), h('p', { class: 'kr-note', text: 'Each target has its own expected-rank order and probabilities. The browser searches cuts of each order and evaluates the resulting report under its own loss. The signed search can recover the archived grades from the probabilities.' }), h('p', { class: 'kr-note' }, 'See the released signed comparison in ', appLink(ctx, 'krw-card'), '.'),
                    h('p', {}, ro(ctx, null, data.change.changed, formatCount), ' of ', ro(ctx, null, data.change.M, formatCount), ' pair relations differ: ', ro(ctx, null, data.change.nNewDisclosed, formatCount), ' newly stated, ', ro(ctx, null, data.change.nNewWithheld, formatCount), ' newly withheld, ', ro(ctx, null, data.change.nReversed, formatCount), ' reversed. “New” reads from signed to absolute.'));
                fullReadout.replaceChildren('Signed report: N ', ro(ctx, 'ro-signed-N', data.signed.c.d.N, formatCount), ', E/N ', ro(ctx, 'ro-signed-EoverN', data.signed.c.ev.EoverN[0], formatShare), '. Absolute report: N ', ro(ctx, 'ro-absolute-N', data.absolute.c.d.N, formatCount), ', E/N ', ro(ctx, 'ro-absolute-EoverN', data.absolute.c.ev.EoverN[0], formatShare), '. Each is optimal within its own expected-rank order, with the same cap and withholding cost.');
            };
            const renderCard = k => {
                const r = both[k], slot = k === 0 ? left : right;
                const wasHidden = cards.hidden;
                cards.hidden = false;
                try { renderers[k].render(r.model, r.c, { sort: 'mean', reveal: 0, selected, sortInstruction: 'Rows stay in posterior-mean order within each grade. A shared grade states no direction between its firms.' }); }
                finally { cards.hidden = wasHidden; }
                slot.querySelector('.kr-computed-info')?.remove();
                const info = h('div', { class: 'kr-note kr-computed-info' }, h('b', { text: k === 0 ? 'Signed gender gap' : 'Absolute gender-gap size' }), ': ', labelNode(ctx, r.opt), '. ', tagNode(ctx, r.opt, { orderWords: k === 0 ? "the signed-target expected-rank order" : "the absolute-target expected-rank order" }), '. Uses at most ', ro(ctx, null, 4, formatCount), ' grades, τ ', ro(ctx, null, .2, formatRisk), '. Family size ', ro(ctx, `${k ? 'absolute' : 'signed'}-familySize`, r.opt.family.size, formatCount), '. N ', ro(ctx, `${k ? 'absolute' : 'signed'}-N`, r.c.d.N, formatCount), '; ', ro(ctx, `${k ? 'absolute' : 'signed'}-sizes`, r.c.d.sizes, formatSizes), '; E/N ', ro(ctx, `${k ? 'absolute' : 'signed'}-EoverN`, r.c.ev.EoverN[0], formatShare), '; risk ', ro(ctx, `${k ? 'absolute' : 'signed'}-risk`, r.c.ev.risk, formatRisk), '. ', ro(ctx, `${k ? 'absolute' : 'signed'}-tieCount`, r.opt.tieCount, formatCount), r.opt.tieCount === 1 ? ' equal-risk optimum, tolerance ' : ' equal-risk optima, tolerance ', ro(ctx, `${k ? 'absolute' : 'signed'}-tieTol`, r.opt.tieTol, formatSci), '.');
                if (r.opt.tieCount > 1)
                    info.append(h('p', {}, 'Returned equal-risk grade vectors: ', ...r.opt.grades.map(g => h('span', {}, ro(ctx, null, g, formatGrades), ' ')), '. The app shows the first optimal cut and lists the other tied reports.'));
                const vectors = h('details', {}, h('summary', { text: 'Full selected and returned equal-risk grade vectors' }), h('p', {}, 'Selected grades in released firm-ID order: ', ro(ctx, `${k ? 'absolute' : 'signed'}-grade`, r.c.grade, formatGrades)), ...r.opt.grades.map((g, j) => h('p', {}, 'Returned optimum ', ro(ctx, null, j + 1, formatCount), ': ', ro(ctx, null, g, formatGrades))));
                info.append(vectors);
                slot.prepend(info);
            };
            const pairError = (p, r, d) => d === 'withheld' ? null : d === 'above' ? r.model.e[p.i][p.j] : r.model.e[p.j][p.i];
            const pairRow = (p, index) => {
                const err = (r, d) => pairError(p, r, d);
                return h('tr', { 'data-prx-pair': `${p.i}-${p.j}`, 'data-type': changeType(p), 'data-pair-index': String(index), 'data-sort-error': String(err(data.absolute, p.to) ?? err(data.signed, p.from)), hidden: pairType !== 'all' && pairType !== changeType(p) ? true : undefined }, h('th', { scope: 'row', text: names[p.i] }), h('td', { text: names[p.j] }), h('td', { 'data-prx-relation': p.from, 'data-prx-readout': `signed-pair-relation-${p.i}-${p.j}`, text: relation(p.from, p.i, p.j, names) }), h('td', { 'data-prx-relation': p.to, 'data-prx-readout': `absolute-pair-relation-${p.i}-${p.j}`, text: relation(p.to, p.i, p.j, names) }), h('td', {}, ro(ctx, `signed-pair-error-${p.i}-${p.j}`, err(data.signed, p.from), formatShare)), h('td', {}, ro(ctx, `absolute-pair-error-${p.i}-${p.j}`, err(data.absolute, p.to), formatShare)));
            };
            const sortPairView = () => {
                if (!pairBody) return;
                const rows = [...pairBody.rows];
                for (const row of rows) row.hidden = pairType !== 'all' && row.dataset.type !== pairType;
                rows.sort((a, b) => pairType === 'all' ? +a.dataset.pairIndex - +b.dataset.pairIndex :
                    +b.dataset.sortError - +a.dataset.sortError || +a.dataset.pairIndex - +b.dataset.pairIndex);
                pairBody.append(...rows);
            };
            const firmRow = (name, i) => h('tr', { 'data-prx-firm-row': String(i) }, h('th', { scope: 'row', text: name }), ...both.flatMap(r => [r.model.mean[i], r.model.lower[i], r.model.upper[i]]).map(v => h('td', {}, ro(ctx, null, v, v => formatDecimal(v, { digits: 3 })))), ...both.map(r => h('td', {}, ro(ctx, null, r.rank[i], v => formatDecimal(v, { digits: 3 })))), ...both.map(r => h('td', {}, ro(ctx, null, r.c.grade[i], formatCount))));
            function writeSummary() {
                const { change } = data;
                const count = value => ro(ctx, null, value, formatCount);
                const context = h('p', { class: 'kr-soa-context' });
                if (ctx.state.view === 'pairs') {
                    const mode = {
                        all: [change.changed, 'changed'],
                        reversed: [change.nReversed, 'reversed'],
                        stated: [change.nNewDisclosed, 'newly stated'],
                        withheld: [change.nNewWithheld, 'newly withheld'],
                    }[pairType];
                    context.append('Showing ', count(mode[0]), ' ', mode[1], ' pairs.');
                } else if (ctx.state.view === 'firms') {
                    context.append('Showing both targets for all ', count(names.length), ' firms.');
                } else if (precisionInspection && precisionBox.open) {
                    const r = precisionInspection;
                    context.append(r.name, ': original signed sampling SE ', ro(ctx, null, r.se, x => formatDecimal(x, { digits: 4 })),
                        r.side ? '; absolute grade ' : '; signed grade ', count(r.grade), '.');
                } else if (selected !== undefined) {
                    context.append(names[selected], ': signed grade ', count(both[0].c.grade[selected]),
                        ', absolute grade ', count(both[1].c.grade[selected]), '.');
                } else if (showFull) context.append('Showing both full report cards.');
                // Build the full atomic announcement with the original numerical hooks and one local effect.
                const live = summary.cloneNode(true);
                if (context.childNodes.length) live.append(context);
                ctx.readout.set([live]);
            }
            const finish = () => { if (ctx.state.view === 'pairs' && pairType !== 'all') sortPairView(); syncShownPreset(); cancelNext = null; progress.textContent = ''; writeSummary(); ctx.root.removeAttribute('aria-busy'); };
            refreshView = () => ctx.requestRender('both');
            return { render(s) {
                    stop(); const epoch = generation;
                    prepare(); view.set(s.view);
                    if (ctx.presets && ctx.presets.parentNode !== selectors) selectors.append(ctx.presets);
                    const linkedMode = s.view === 'cards' && !showFull;
                    chosenCards = s.view === 'cards' && showFull;
                    if (s.view !== 'cards' || !precisionBox.open) precisionInspection = null;
                    linked.root.setAttribute('aria-pressed', String(linkedMode));
                    ranks.hidden = !linkedMode;
                    cards.hidden = s.view !== 'cards' || linkedMode;
                    precisionBox.root.hidden = s.view !== 'cards';
                    scrollHint.hidden = s.view === 'cards';
                    pairView.hidden = s.view !== 'pairs'; firmView.hidden = s.view !== 'firms';
                    const stages = [];
                    if (s.view === 'cards') {
                        const theme = ctx.root.getAttribute('data-theme') || ctx.doc.documentElement.getAttribute('data-theme') || (ctx.win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                        const stamp = JSON.stringify([ctx.width(), theme, ctx.reducedMotion]);
                        const rk = JSON.stringify([stamp, selected]);
                        if (linkedMode && rk !== rankStamp) { renderRanks(); rankStamp = rk; }
                        const cardStamp = JSON.stringify([rk, showFull]);
                        const precisionStamp = JSON.stringify([stamp, precisionBox.open]);
                        for (let k = 0; k < 2; k++) {
                            if (painted[k] !== cardStamp) stages.push(() => { renderCard(k); painted[k] = cardStamp; });
                            if (painted[k + 2] !== precisionStamp) stages.push(() => { precisionViews[k].render(both[k].model, both[k].c); painted[k + 2] = precisionStamp; });
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
                            stages.push(() => pairBody.append(...data.change.pairs.slice(from, from + 64).map((p, j) => pairRow(p, from + j))));
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
                    writeSummary();
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
    // Old view=cards and preset=cards continue to request the original dual cards.
    // The unqualified default uses the same reports with the linked view first.
    const update = handle.update;
    handle.update = partial => {
        const explicit = partial?.view === 'cards' || partial?.preset === 'cards';
        const same = handle.state.view === 'cards';
        const changed = explicit && chooseCards?.();
        const result = update(partial);
        if (changed && same && handle.state.view === 'cards') refreshView?.();
        return result;
    };
    return handle;
}
