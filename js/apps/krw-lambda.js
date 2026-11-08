// Full S-02 lambda-grid view, retaining the entire v2 stated-error matrix.
import { createWidget } from '../shared/base.js';
import { canvasLayer, gradeColors, labelOn, numText, palette, parseColor, plot } from '../shared/chart.js';
import { formatCount, formatDecimal, formatRisk, formatProb, formatSetting, formatShare, formatSizes } from '../shared/format.js';
import { captionNode } from '../shared/labels.js';
import { relationChange, statedAbove, unitRelationCounts } from '../pr-core.js';
import { KRW_COMMON_CSS, ARCHIVE_KEYS, archiveControls, archiveSnapshot, readKrwModel, blockOrder, createKrwHeader, riskDigits, appendKrwNotice, ro } from './krw-common.js';
const layers = new WeakMap();
const grids = new WeakMap(), changes = new WeakMap(), pairErrors = new WeakMap();
// Only the paint ramp is prepared here; every probability remains the released value.
function colorRamp(steps) {
    const colors = steps.map(step => parseColor(step));
    return t => { const x = Math.min(1, Math.max(0, t)) * (steps.length - 1), k = Math.min(steps.length - 2, Math.floor(x)), a = colors[k], b = colors[k + 1], u = x - k; return a && b ? `rgb(${a.map((v, c) => Math.round(v + (b[c] - v) * u)).join(', ')})` : steps[k]; };
}
/** The actual v2 by-grade matrix: Purples stated errors, withheld gray, blank diagonal and grade stripe. */
export function drawStatedErrorMatrix(ctx, slot, model, c, { sort = 'mean' } = {}) {
    const order = blockOrder(model, c.grade, sort), blocks = [];
    order.forEach((i, p) => {
        const g = c.grade[i], last = blocks.at(-1);
        if (last?.grade === g)
            last.end = p + 1;
        else
            blocks.push({ grade: g, start: p, end: p + 1 });
    });
    const n = model.n, width = Math.min(560, Math.max(1, Math.round(slot.clientWidth || ctx.width()))), strip = 6, cell = width / (n + strip), pal = palette(ctx.root), gc = gradeColors(c.d.G, pal), rel = unitRelationCounts(c.grade), firms = order.map((u, p) => ({ u, p, name: model.names[u], grade: c.grade[u], mean: model.mean[u], lo: model.lower[u], hi: model.upper[u], stated: rel.stated[u], withheld: rel.withheld[u] })), bands = blocks.map(b => ({ ...b, fill: gc[b.grade - 1], ink: labelOn(gc[b.grade - 1], pal), mid: (b.start + b.end) / 2 }));
    let layer = layers.get(slot);
    if (!layer) {
        layer = { canvas: null, paint: null };
        layers.set(slot, layer);
    }
    layer.paint = { model, c, order };
    const fig = plot(slot, { width, height: Math.round(cell * n + 4), aspect: false, marginTop: 2, marginBottom: 2, marginLeft: 0, marginRight: 2, x: { domain: [-strip, n], axis: null }, y: { domain: [n, 0], axis: null }, alt: 'All firm pairs by grade: stated directions shaded by wrong-direction probability in Purples; within-grade pairs gray, diagonal blank. Grade colors are in the left stripe.', table: { caption: 'All firms in matrix order, supplied marginal summaries and per-firm relation counts', columns: [{ label: 'Position', value: d => d.p + 1, format: formatCount }, { label: 'Firm', value: 'name' }, { label: 'Grade', value: 'grade', format: formatCount }, { label: 'Posterior mean', value: 'mean', format: v => formatDecimal(v, { digits: 3 }) }, { label: 'Central interval, lower', value: 'lo', format: v => formatDecimal(v, { digits: 3 }) }, { label: 'Central interval, upper', value: 'hi', format: v => formatDecimal(v, { digits: 3 }) }, { label: 'Pairs stated', value: 'stated', format: formatCount }, { label: 'Pairs withheld', value: 'withheld', format: formatCount }], rows: firms }, keyboard: { data: firms, x: d => d.p + .5, y: d => d.p + .5, sort: false, key: d => String(d.u), label: 'The firms along the diagonal. Use arrow keys to read each firm and its relation counts.', title: d => `${d.name}: grade ${d.grade} of ${c.d.G}; posterior mean ${formatDecimal(d.mean, { digits: 3 })}, 90% interval ${formatDecimal(d.lo, { digits: 3 })} to ${formatDecimal(d.hi, { digits: 3 })}; ${d.stated} pairs stated, ${d.withheld} withheld.` }, marks: (k, P) => [P.rect(bands, { x1: -strip + .6, x2: -.6, y1: 'start', y2: 'end', fill: 'fill' }), numText(bands.filter(b => (b.end - b.start) * cell >= 13), { x: -strip / 2, y: 'mid', value: 'grade', format: formatCount, fill: 'ink', fontWeight: 700, fontSize: 10 }), P.rect(blocks.filter(b => b.end - b.start > 1), { x1: 'start', x2: 'end', y1: 'start', y2: 'end', fill: 'none', stroke: k.plotFg, strokeWidth: 1.4 })] });
    if (!layer.canvas || !slot.contains(layer.canvas)) {
        const current = layer;
        layer.canvas = canvasLayer(fig, (g, { x, y, palette: k }) => {
            const { model: m, c: r, order: o } = current.paint, cw = Math.abs(x(1) - x(0)), ch = Math.abs(y(1) - y(0)), xs = o.map((_, p) => x(p)), ys = o.map((_, p) => y(p)), ramp = colorRamp(k.purples);
            for (let p = 0; p < n; p++)
                for (let q = 0; q < n; q++) {
                    const i = o[p], j = o[q];
                    g.fillStyle = i === j ? k.plotBg : r.grade[i] === r.grade[j] ? k.relWithheld : ramp((r.grade[i] < r.grade[j] ? m.e[i][j] : m.e[j][i]) / .5);
                    g.fillRect(xs[q], ys[p], cw + .25, ch + .25);
                }
        }).canvas;
    }
    return fig;
}
const CSS = `${KRW_COMMON_CSS}.prx-kr .kr-gridchart{min-width:0}.prx-kr .kr-purples{background:linear-gradient(90deg,var(--prx-purples-1),var(--prx-purples-4),var(--prx-purples-7));width:3rem}.prx-kr .kr-grid-intro{font-size:.85rem}.prx-kr .kr-swatch{flex-shrink:0}.prx-kr .kr-progress{min-height:1.5em;font-size:.85rem;margin:.3rem 0}
.prx-kr .kr-lambda-summary,.prx-kr .kr-lambda-change{margin:0}.prx-kr .kr-lambda-change{font-weight:600}`;
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'krw-lambda', className: 'prx-kr', css: CSS, layout: 'result-first', label: 'KRW’s complete lambda grid and stated errors', keys: { ...ARCHIVE_KEYS }, build(ctx) {
            const { h } = ctx, controls = archiveControls(ctx), header = h('section', { class: 'kr-header' }), intro = h('p', { class: 'kr-grid-intro' }), Gchart = ctx.primaryGraphic(h('div')), shares = h('div'), en = h('div'), risk = h('div'), split = h('p', { class: 'kr-note' }), table = h('div', { class: 'kr-scroll kr-table-wrap' }), matrix = h('div', { class: 'kr-map' }), top = h('p', { class: 'kr-grade1' }), doubtful = h('div');
            const slider = ctx.controls.querySelector('input[type="range"]');
            ctx.primaryControl(slider);
            ctx.afterPresets(slider.closest('.prx-control'));
            const grid = h('section', { class: 'kr-box prx-light-panel' }, h('h4', { text: 'KRW’s λ grid' }), Gchart, intro, h('p', { class: 'kr-note', text: 'We read each grid card as KRW’s code left it; we do not claim that a grid card is the best card at its λ.' }), h('div', { class: 'kr-grid' }, shares, en), risk, h('p', { class: 'kr-note' }, captionNode(ctx, 'tau-not-compared'), '. Each risk is paired with its own all-withheld risk τ. ', captionNode(ctx, 'fixed-report'), '.'), h('p', { class: 'kr-note', text: 'Neighbor changes compare adjacent grid rows, not the last setting you visited.' }), split, ctx.scrollRegion(table, 'All archived grid rows, with positive-tau risk unavailable at lambda zero'));
            ctx.charts.append(grid, header, h('section', { class: 'kr-box prx-light-panel' }, h('h4', { text: 'All pairs of the firms, by grade' }), top, matrix, h('p', { class: 'kr-legend' }, h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch kr-purples' }), h('span', {}, 'stated: chance its direction is wrong, ', ro(ctx, null, 0, formatCount), ' to ', ro(ctx, null, .5, formatSetting), ' or greater (saturated)')), h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: 'var(--prx-rel-withheld)' } }), 'withheld: same grade')), doubtful));
            const headerView = createKrwHeader(ctx, header);
            appendKrwNotice(ctx);
            function drawCurve(slot, rows, c, { kind, title, ylabel, domain, log = false }) {
                const width = Math.max(1, Math.round(slot.clientWidth || ctx.width())), cur = rows.find(r => r.index === c.index), tip = r => `λ ${formatSetting(r.lambda)}: ${r.d.G} grades, ${formatCount(r.d.N)} pairs stated, s ${formatShare(r.d.s)}, DR ${formatShare(r.DR)}, E/N ${formatShare(r.ev.EoverN[0])}, risk ${formatRisk(r.ev.risk)}`;
                let marks;
                const base = (k, P) => [P.ruleX([c.lambda], { stroke: k.plotMuted, strokeDasharray: '4,3' })];
                if (kind === 'G')
                    marks = (k, P) => [...base(k, P), P.line(rows, { x: 'lambda', y: r => r.d.G, stroke: k.plotFg, curve: 'step-after' }), P.dot(rows, { x: 'lambda', y: r => r.d.G, r: 1.8, fill: k.plotFg }), P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.d.G, r: 5, fill: 'none', stroke: k.plotFg, strokeWidth: 2 }), numText(cur ? [cur] : [], { x: 'lambda', y: r => r.d.G, value: r => r.d.G, format: formatCount, dx: c.lambda >= .83 ? -11 : 11, dy: -8, textAnchor: c.lambda >= .83 ? 'end' : 'start', fill: k.plotFg, stroke: k.plotBg, strokeWidth: 3, paintOrder: 'stroke', fontWeight: 'bold', render(index, scales, values, dims, context, next) {
                        const group = next(index, scales, values, dims, context);
                        group.querySelector('text')?.setAttribute('data-prx-readout', 'lambda-selected-grade-mark');
                        return group;
                    } }), P.tip(rows, P.pointerX({ x: 'lambda', y: r => r.d.G, title: tip }))];
                else if (kind === 'shares')
                    marks = (k, P) => [...base(k, P), P.line(rows, { x: 'lambda', y: r => r.d.s, stroke: k.plotFg }), P.line(rows, { x: 'lambda', y: 'DR', stroke: k.err, strokeDasharray: '5,3' }), P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.d.s, r: 5, fill: 'none', stroke: k.plotFg }), P.dot(cur ? [cur] : [], { x: 'lambda', y: 'DR', r: 5, fill: 'none', stroke: k.err }), P.text(rows.length ? [rows.at(-1)] : [], { x: 'lambda', y: r => r.d.s, text: () => 's = N/M', dx: 4, textAnchor: 'start', fill: k.plotFg }), P.text(rows.length ? [rows.at(-1)] : [], { x: 'lambda', y: 'DR', text: () => 'DR = E/M', dx: 4, textAnchor: 'start', fill: k.errText })];
                else if (kind === 'risk')
                    marks = (k, P) => [...base(k, P), P.line(rows, { x: 'lambda', y: r => r.ev.risk, stroke: k.plotFg }), P.line(rows, { x: 'lambda', y: 'tau', stroke: k.wh, strokeDasharray: '5,3' }), P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.ev.risk, r: 5, fill: 'none', stroke: k.plotFg })];
                else
                    marks = (k, P) => [...base(k, P), P.line(rows, { x: 'lambda', y: r => r.ev.EoverN[0], defined: r => r.d.N > 0, stroke: k.err }), P.dot(cur && cur.d.N > 0 ? [cur] : [], { x: 'lambda', y: r => r.ev.EoverN[0], r: 5, fill: 'none', stroke: k.err })];
                return plot(slot, { width, height: kind === 'G' ? 260 : 230, aspect: false, marginTop: 22, marginBottom: 42, marginLeft: 56, marginRight: kind === 'shares' ? 76 : 20, x: { domain: [0, 1], label: 'KRW’s λ', labelAnchor: 'center', labelArrow: 'none' }, y: { ...(log ? { type: 'log', ticks: [1, 2, 5, 10, 20, 50, 100] } : {}), domain, label: ylabel, labelArrow: 'none', grid: true }, alt: title, table: { caption: title, columns: [{ label: 'λ', value: 'lambda', format: formatSetting }, { label: 'Grades', value: r => r.d.G, format: formatCount }, { label: 'Pairs stated', value: r => r.d.N, format: formatCount }, { label: 's=N/M', value: r => r.d.s, format: formatShare }, { label: 'DR', value: 'DR', format: formatShare }, { label: 'E/N', value: r => r.ev.EoverN[0], format: formatShare }, { label: 'Risk at own τ', value: r => r.ev.risk, format: v => formatRisk(v) }], rows }, keyboard: { data: rows, x: 'lambda', y: kind === 'G' ? r => r.d.G : kind === 'shares' ? r => r.d.s : kind === 'risk' ? r => r.ev.risk : r => r.ev.EoverN[0], sort: false, key: r => String(r.index), label: 'Grid cards along λ. Use arrow keys to read every positive-grid card.', title: tip }, marks });
            }
            const progress = h('p', { class: 'kr-progress', 'aria-hidden': 'true' });
            grid.append(progress);
            const tables = new WeakMap();
            let generation = 0, cancelNext = null, dead = false;
            const stop = () => { generation++; cancelNext?.(); cancelNext = null; };
            const finish = () => { progress.textContent = ''; ctx.root.setAttribute('aria-busy', 'false'); };
            ctx.onCleanup(() => {
                dead = true;
                stop();
                for (const slot of [Gchart, shares, en, risk, matrix]) slot.__prxChart?.handle.destroy();
                layers.delete(matrix);
                finish();
            });
            function gridCache(model) {
                if (!grids.has(model)) grids.set(model, { all: [], rows: null });
                return grids.get(model);
            }
            function tableView(model) {
                if (!tables.has(model)) {
                    const labels = ['λ', 'Grades', 'N', 's=N/M', 'DR=E/M', 'E/N', 'Risk at own τ', 'All withheld τ'], body = h('tbody');
                    tables.set(model, { body, rows: [], current: null, node: h('table', { class: 'kr-table kr-wide-table' }, h('caption', { text: 'Every archived row; λ zero is outside postrank’s positive-τ risk domain' }), h('thead', {}, h('tr', {}, ...labels.map(text => h('th', { scope: 'col', text })))), body) });
                }
                return tables.get(model);
            }
            function appendTableRows(view, all) {
                const end = Math.min(all.length, view.rows.length + 25), fragment = ctx.doc.createDocumentFragment();
                while (view.rows.length < end) {
                    const r = all[view.rows.length], risk = v => formatRisk(v, { digits: riskDigits(r) }),
                        row = h('tr', { 'data-prx-grid-row': String(r.index) }, ...[[r.lambda, formatSetting], [r.d.G, formatCount], [r.d.N, formatCount], [r.d.s, formatShare], [r.DR, formatShare], [r.ev.EoverN[0], formatShare], [r.ev.risk, risk], [r.tau === 0 ? null : r.tau, risk]].map(([v, f]) => h('td', {}, ro(ctx, null, v, f))));
                    view.rows.push(row);
                    fragment.append(row);
                }
                view.body.append(fragment);
            }
            function adjacentChangeLine(model, c) {
                if (!changes.has(c)) changes.set(c, c.index > 1 ? relationChange(model.grid.grade[c.index - 1], c.grade) : null);
                const ch = changes.get(c);
                return h('p', { class: 'kr-lambda-change' }, ...(ch ? [
                    'λ ', ro(ctx, 'chg-prev', model.grid.lambda[c.index - 1], formatSetting),
                    ' → ', ro(ctx, null, c.lambda, formatSetting),
                    ': ', ro(ctx, 'chg-stated', ch.nNewDisclosed, formatCount), ' newly stated · ',
                    ro(ctx, 'chg-withheld', ch.nNewWithheld, formatCount), ' withheld · ',
                    ro(ctx, 'chg-reversed', ch.nReversed, formatCount), ' reversed',
                ] : ['This is the first positive λ on the grid: every firm shares one grade.']));
            }
            function showResult(model, c) {
                const f = v => formatRisk(v, { digits: riskDigits(c) });
                ctx.readout.set([
                    h('p', { class: 'kr-lambda-summary' },
                        'λ ', ro(ctx, 'ro-lambda', c.lambda, formatSetting), ' (τ ', ro(ctx, 'ro-tau', c.tau, f), ') · ',
                        ro(ctx, 'ro-G', c.d.G, formatCount), c.d.G === 1 ? ' grade · ' : ' grades · ',
                        ro(ctx, 'ro-N', c.d.N, formatCount), ' of ', ro(ctx, 'ro-M', model.M, formatCount), ' pairs stated · ',
                        'risk ', ro(ctx, 'ro-risk', c.ev.risk, f), ' · ',
                        ...(c.d.N > 0 ? ['E/N ', ro(ctx, 'ro-EoverN', c.ev.EoverN[0], formatShare), ' · '] : []),
                        'DR ', ro(ctx, 'ro-DR', c.DR, formatShare)), ' ', adjacentChangeLine(model, c),
                ]);
            }
            function drawNotes(model, rows) {
                const first = rows.find(r => r.d.G > 1), i = first?.grade.indexOf(1), topEstimate = model.estimate.indexOf(Math.max(...model.estimate));
                split.replaceChildren('First split: λ ', ro(ctx, 'first-lambda', first.lambda, formatSetting), ', τ ', ro(ctx, 'first-tau', first.tau, formatSetting), ', ', model.names[i], ' alone in grade 1, ', ro(ctx, 'first-sizes', first.d.sizes, formatSizes), '. ', ...(i !== topEstimate ? [model.names[i], ' has SE ', ro(ctx, 'first-se', model.se[i], v => formatDecimal(v, { digits: 3 })), ' versus ', ro(ctx, 'top-se', model.se[topEstimate], v => formatDecimal(v, { digits: 3 })), ' for ', model.names[topEstimate], '. KRW (§VI) explain the race reversal by AutoNation’s larger standard error.'] : ['This firm also has the largest estimate.']), ' At small λ, silence is cheap: many uncertain pairs can stay within one grade. Separating one firm above the other ', ro(ctx, 'first-other-firms', model.n - 1, formatCount), ' firms states every one of those directions at once, so its posterior must be sufficiently clear of the others for that tradeoff. The split comes from the archive, where KRW selected the card using their original probabilities.');
            }
            function drawPairNotes(model, c) {
                if (!pairErrors.has(c)) pairErrors.set(c, statedAbove(c.grade, model.E, { tau: .5 }));
                const aboveHalf = pairErrors.get(c);
                doubtful.replaceChildren(h('p', { class: 'kr-note' }, 'Purples saturates at ', ro(ctx, null, .5, formatSetting), ': the darkest color includes larger errors. ', ro(ctx, 'matrix-doubtful-count', aboveHalf.count, formatCount), ' stated directions here are more likely wrong than right.', ...(aboveHalf.count ? [' Largest error ', ro(ctx, 'matrix-doubtful-max', Math.max(...aboveHalf.pairs.map(p => p.error)), formatProb), '. Their actual probabilities follow.'] : [])), ...aboveHalf.pairs.map(p => h('p', { class: 'kr-note' }, model.names[p.i], ' above ', model.names[p.j], ': wrong-direction probability ', ro(ctx, `matrix-doubtful-error-${p.i}-${p.j}`, p.error, formatProb), '.')));
                const names = blockOrder(model, c.grade, 'mean').filter(i => c.grade[i] === 1).map(i => model.names[i]);
                top.replaceChildren(...(c.d.G === 1 ? ['One grade: no directions stated.'] : ['Grade 1: ', h('b', { text: names.length <= 3 ? names.join(', ') : '' }), ...(names.length > 3 ? [ro(ctx, null, names.length, formatCount), ' firms'] : []), '.']));
            }
            return { render(s) {
                stop();
                const epoch = generation;
                controls.render(s);
                ctx.root.setAttribute('aria-busy', 'true');
                progress.textContent = 'Updating the complete grid and pair matrix…';
                const model = readKrwModel(s.criterion), cache = gridCache(model), c = archiveSnapshot(model, s.lambda);
                showResult(model, c);
                let stages = null, stage = 0;
                const next = () => {
                    if (dead || epoch !== generation) return;
                    cancelNext = null;
                    try {
                        ctx.keepFocus(() => {
                            if (!cache.rows) {
                                // Cache full engine evaluations in bounded slices; canceled work is reused.
                                const end = Math.min(model.grid.lambda.length, cache.all.length + 8);
                                while (cache.all.length < end) cache.all.push(archiveSnapshot(model, model.grid.lambda[cache.all.length]));
                                if (cache.all.length === model.grid.lambda.length) cache.rows = cache.all.filter(r => r.tau > 0);
                                return;
                            }
                            if (!stages) {
                                const { all, rows } = cache, view = tableView(model);
                                stages = [
                                    () => {
                                        headerView.render(model, c);
                                        intro.replaceChildren('The grid has ', ro(ctx, 'grid-count', all.length, formatCount), ' cards, one per λ from ', ro(ctx, null, 0, formatCount), ' to ', ro(ctx, null, 1, formatCount), ' in steps of ', ro(ctx, null, .01, formatSetting), '; charts start at the first positive λ.');
                                        drawNotes(model, rows);
                                    },
                                    () => drawCurve(Gchart, rows, c, { kind: 'G', title: 'Number of grades of each archived card on a log scale; current card ringed', ylabel: 'Grades G (log scale)', domain: [1, 100], log: true }),
                                    () => drawCurve(shares, rows, c, { kind: 'shares', title: 's = N/M, solid; DR = E/M, dashed vermillion', ylabel: 'Share of all pairs', domain: [0, 1] }),
                                    () => drawCurve(en, rows, c, { kind: 'en', title: 'Expected wrong share among stated pairs; no value when nothing is stated', ylabel: 'E/N', domain: [0, .5] }),
                                    () => drawCurve(risk, rows, c, { kind: 'risk', title: 'Solid: risk at each card’s own τ; dashed gray: all withheld at that τ', ylabel: 'Risk / all-withheld τ', domain: [0, .5] }),
                                    () => { if (view.node.parentNode !== table) table.replaceChildren(view.node); }
                                ];
                                for (let from = view.rows.length; from < all.length; from += 25) stages.push(() => appendTableRows(view, all));
                                stages.push(() => {
                                    view.current?.removeAttribute('aria-current');
                                    view.current = view.rows[c.index];
                                    view.current.setAttribute('aria-current', 'true');
                                }, () => drawStatedErrorMatrix(ctx, matrix, model, c, { sort: s.sort }), () => {
                                    drawPairNotes(model, c);
                                });
                            }
                            stages[stage++]();
                        });
                    } catch (err) {
                        if (!dead && epoch === generation) finish();
                        throw err;
                    }
                    if (dead || epoch !== generation) return;
                    if (stages && stage === stages.length) finish();
                    else cancelNext = ctx.timeout(next, 20);
                };
                cancelNext = ctx.timeout(next, 20);
            } };
        } });
}
