import { confidentPairs, statedAbove } from '../pr-core.js';
import { createWidget } from '../shared/base.js';
import { drawKrwHeat, heatCounts, BLUE_CUTS, thresholdAt } from '../shared/krw-model.js';
import { formatCount, formatProb, formatSetting } from '../shared/format.js';
import { KRW_COMMON_CSS, ARCHIVE_KEYS, SORTS, keyOrder, blockOrder, archiveSnapshot, readKrwModel, createKrwHeader, createArchiveReadout, appendKrwNotice, ro } from './krw-common.js';
const CSS = `${KRW_COMMON_CSS}
.prx-kr-heat .kr-heat-box{border:0;margin:0;padding:0}
.prx-kr-heat .kr-heat-box .prx-kbd-tip{display:none}
.prx-kr-heat .kr-pair-pickers{display:flex;gap:.5rem;margin:0 auto;max-width:560px}
.prx-kr-heat .kr-pair-pickers>.prx-control{flex:1;min-width:0}
.prx-kr-heat .kr-pair-pickers select{width:100%;min-width:0}
.prx-kr-heat .kr-heat-count,.prx-kr-heat .kr-pair-line{display:block}
.prx-kr-heat .kr-heat-count{font-weight:600}
.prx-kr-heat .kr-pair-line{min-height:2.8em}
.prx-kr-heat .kr-pair-line>span{display:block}
.prx-kr-heat .kr-heat-threshold{grid-column:1/-1;font-size:.82rem;color:var(--prx-fg-muted)}
.prx-kr-heat .kr-heat-agree{background:var(--prx-blues-6)}
.prx-kr-heat .kr-heat-pale{background:var(--prx-neutral-1)}
.prx-kr-heat .kr-heat-hatch{background:repeating-linear-gradient(135deg,#793b06 0 1px,#ffd197 1px 3px)}
.prx-kr-heat .kr-heat-outline{background:#f0e5fb;outline:2px solid #6b269c;outline-offset:-3px}
.prx-kr-heat .kr-heat-stages{flex-basis:100%}
@media(max-width:40em){.prx-kr-heat .kr-pair-pickers{gap:.35rem}.prx-kr-heat .kr-heat-stages .prx-radio{font-size:.82rem}.prx-kr-heat .kr-pair-line{min-height:5.6em}.prx-kr-heat .kr-heat-box .kr-map{margin-inline:-.5rem}}`;

const SVG = 'http://www.w3.org/2000/svg';
function svgNode(doc, tag, attrs) {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
}

function drawSelection(ctx, fig, n, model, c, order, stage, id) {
    const x = fig.scale('x').apply, y = fig.scale('y').apply;
    const svg = fig.svg, dw = x(1) - x(0), dh = y(1) - y(0);
    const pos = new Map(order.map((i, k) => [i, k]));
    const bounds = (r, q) => ({ x: x(q), y: y(r), width: dw, height: dh });
    const area = svgNode(ctx.doc, 'g', { 'aria-hidden': true, 'pointer-events': 'none' });
    // Place cell marks below the original SVG grade-block borders.
    svg.insertBefore(area, svg.querySelector('g'));
    if (stage === 3) {
        const patternId = `kr-heat-hatch-${id}`;
        const pattern = svgNode(ctx.doc, 'pattern', { id: patternId, patternUnits: 'userSpaceOnUse', width: 3, height: 3 });
        pattern.append(svgNode(ctx.doc, 'rect', { width: 3, height: 3, fill: '#ffd197' }),
            svgNode(ctx.doc, 'path', { d: 'M-1,1 L1,-1 M0,3 L3,0 M2,4 L4,2', stroke: '#793b06', 'stroke-width': 1 }));
        const defs = svgNode(ctx.doc, 'defs', {});
        defs.append(pattern);
        area.append(defs);
        const mark = (i, j, kind, paint) => area.append(svgNode(ctx.doc, 'rect', {
            ...bounds(pos.get(i), pos.get(j)), ...paint, 'data-krw-mismatch': kind, 'data-row-firm': i, 'data-column-firm': j,
        }));
        for (const { i, j, withheld } of confidentPairs(c.grade, model.E, { tau: c.tau }).pairs) {
            const [row, col] = model.e[i][j] < c.tau ? [i, j] : [j, i];
            if (withheld) mark(row, col, 'withheld', { fill: `url(#${patternId})` });
            else if (c.grade[row] > c.grade[col]) {
                // The card states the reverse; its stated direction gets the purple mark.
                area.append(svgNode(ctx.doc, 'rect', { ...bounds(pos.get(row), pos.get(col)), fill: 'var(--prx-neutral-1)' }));
            }
        }
        for (const { i, j } of statedAbove(c.grade, model.E, { tau: c.tau }).pairs) {
            mark(i, j, 'stated', { fill: '#f0e5fb', stroke: '#6b269c', 'stroke-width': .9 });
        }
    }
    const guides = svgNode(ctx.doc, 'g', { 'aria-hidden': true, 'pointer-events': 'none', 'data-krw-crosshair': '' });
    const row = svgNode(ctx.doc, 'rect', { x: x(0), width: x(n) - x(0), height: dh });
    const col = svgNode(ctx.doc, 'rect', { y: y(0), width: dw, height: y(n) - y(0) });
    const cell = svgNode(ctx.doc, 'rect', { width: dw, height: dh, fill: 'none', stroke: '#171717', 'stroke-width': 1.5 });
    for (const bar of [row, col]) {
        bar.setAttribute('fill', '#fff');
        bar.setAttribute('fill-opacity', '.16');
        bar.setAttribute('stroke', '#171717');
        bar.setAttribute('stroke-opacity', '.6');
        bar.setAttribute('stroke-width', '.55');
    }
    guides.append(row, col, cell);
    svg.append(guides);
    return {
        svg,
        point(px, py) {
            const r = Math.floor((py - y(0)) / dh), q = Math.floor((px - x(0)) / dw);
            return r >= 0 && r < n && q >= 0 && q < n ? [order[r], order[q]] : null;
        },
        highlight(i, j) {
            const r = pos.get(i), q = pos.get(j);
            row.setAttribute('y', y(r));
            col.setAttribute('x', x(q));
            cell.setAttribute('x', x(q));
            cell.setAttribute('y', y(r));
            guides.dataset.rowFirm = i;
            guides.dataset.columnFirm = j;
        },
    };
}

export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, {
        name: 'krw-heatmap', className: 'prx-kr prx-kr-heat', css: CSS, layout: 'result-first',
        label: 'All KRW firm-pair probabilities, thresholded and overlaid by card grades',
        keys: { ...ARCHIVE_KEYS, stage: { type: 'choice', values: [1, 2, 3], value: 1 } },
        build(ctx) {
            const { h } = ctx;
            const target = ctx.radioGroup({ legend: 'Signed contact-gap target', name: 'criterion', options: [
                { value: 'race', label: 'Race: white-name advantage' },
                { value: 'gender', label: 'Gender: male-name advantage' },
            ], value: ctx.state.criterion, onChange: criterion => ctx.set({ criterion }) });
            const sorting = ctx.select({ label: 'Within each grade, sort by', name: 'sort', options: SORTS,
                value: ctx.state.sort, onChange: sort => ctx.set({ sort }) });
            const lambda = ctx.slider({ label: 'KRW’s λ', name: 'lambda', min: .01, max: 1, step: .01,
                value: ctx.state.lambda, onInput: value => ctx.set({ lambda: value }) });
            const threshold = h('span', { class: 'kr-heat-threshold' });
            lambda.root.append(threshold);
            ctx.primaryControl(lambda.input);
            const stage = ctx.radioGroup({ legend: 'Heat-map stage', name: 'stage', className: 'kr-heat-stages', options: [
                { value: 1, label: '1: direction probabilities' }, { value: 2, label: '2: cells above 1 − τ' },
                { value: 3, label: '3: the grade blocks' },
            ], value: ctx.state.stage, onChange: value => ctx.set({ stage: Number(value) }) });
            ctx.controls.append(target.root, sorting.root, stage.root);
            ctx.afterPresets(lambda.root);

            const header = h('section', { class: 'kr-header' }), archiveText = h('p', { class: 'kr-note' });
            const archiveCtx = { ...ctx, readout: { set: parts => archiveText.replaceChildren(...parts) } };
            const orderNote = h('p', { class: 'kr-note' }), chart = ctx.primaryGraphic(h('div', { class: 'kr-map' }));
            const legend = h('div', { class: 'kr-legend' }), note = h('p', { class: 'kr-stage-note' });
            const names = readKrwModel(ctx.state.criterion).names.map((label, value) => ({ label, value }));
            const rowPick = ctx.select({ label: 'Row firm', name: 'row-firm', options: names,
                onChange: i => selectPair(i, selected[1]) });
            const colPick = ctx.select({ label: 'Column firm', name: 'column-firm', options: names,
                onChange: j => selectPair(selected[0], j) });
            const pickers = h('div', { class: 'kr-pair-pickers' }, rowPick.root, colPick.root);
            const box = h('section', { class: 'kr-box kr-heat-box prx-light-panel' }, pickers, chart,
                h('h4', { text: 'Direction probabilities of all pairs' }), legend, orderNote, note,
                h('p', { class: 'kr-note', text: 'KRW placed no cap on the number of grades. Some pairs within a grade have high posterior support for one direction, but the card withholds them to keep the full report coherent.' }));
            ctx.charts.append(box);
            const firmCounts = ctx.disclosure({ name: 'firm-counts', title: 'Firm counts', placement: { after: box } });
            const visibleCounts = h('div', { class: 'kr-scroll' });
            firmCounts.body.append(ctx.scrollRegion(visibleCounts, 'Per-firm counts in the current heat-map order'));
            const card = ctx.disclosure({ name: 'card-summary', title: 'Card summary' });
            card.body.append(header, archiveText, h('p', { class: 'kr-note', text: 'Archived KRW card at this value of λ' }),
                h('p', { class: 'kr-note' }, 'τ = λ/(', ctx.num(1, formatCount(1)), ' + λ). The grid starts at the first positive λ.'),
                h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ',
                    ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '.'));
            const headerView = createKrwHeader(ctx, header);
            appendKrwNotice(ctx);

            let view, selected, active;
            function selectPair(i, j) {
                if (!active || i === undefined || j === undefined) return;
                selected = [i, j];
                const { model, c, counts, stage: currentStage } = active;
                const { names, e } = model, g = c.grade;
                rowPick.set(i);
                colPick.set(j);
                view.highlight(i, j);
                const status = currentStage === 3
                    ? ['The card withholds ', ro(ctx, 'heat-visible-W', counts.W, formatCount), ' confident pairs and states ',
                        ro(ctx, 'heat-visible-S', counts.S, formatCount), ' pairs below ', ro(ctx, 'heat-visible-cut', 1 - c.tau, formatSetting), '.']
                    : [ro(ctx, 'heat-visible-P', counts.P, formatCount), ' pairs pass the strict cut.'];
                const direction = (a, b) => a === i && b === j ? 'row above column' : 'column above row';
                const isolated = e[i][j] < c.tau ? direction(i, j) : e[j][i] < c.tau ? direction(j, i) : 'withholds';
                const cardDirection = g[i] === g[j] ? 'withholds' : g[i] < g[j] ? direction(i, j) : direction(j, i);
                const pair = i === j ? [names[i], ' · diagonal (same firm)'] : [
                    h('span', {}, h('strong', { text: `${names[i]} vs ${names[j]}` }), ' · Pr(row higher) ',
                        ro(ctx, 'heat-pair-probability', 1 - e[i][j], formatProb)), ' ',
                    h('span', {}, 'Pair rule: ', isolated, ' · Card: ', cardDirection, ' (grades ',
                        ro(ctx, 'heat-pair-row-grade', g[i], formatCount), ' and ', ro(ctx, 'heat-pair-column-grade', g[j], formatCount), ')'),
                ];
                ctx.readout.set([h('span', { class: 'kr-heat-count' }, ...status), ' ',
                    h('span', { class: 'kr-pair-line', 'data-krw-pair-line': '', 'data-row-firm': i, 'data-column-firm': j }, ...pair)]);
            }

            function selectFromPointer(event) {
                if (!view || (event.type === 'pointermove' && event.pointerType === 'touch') ||
                    (event.type === 'click' && event.detail === 0)) return;
                const { svg } = view, rect = svg.getBoundingClientRect(), width = Number(svg.getAttribute('width'));
                if (!rect.width) return;
                const k = width / rect.width, pair = view.point((event.clientX - rect.left) * k, (event.clientY - rect.top) * k);
                if (pair && (selected[0] !== pair[0] || selected[1] !== pair[1])) selectPair(...pair);
            }
            ctx.listen(chart, 'pointermove', event => {
                if (!event.target.closest('.prx-chart-area')) return;
                // The local matrix hit test avoids a nearest-point scan of all cells on hover.
                event.stopPropagation();
                selectFromPointer(event);
            }, { capture: true });
            ctx.listen(chart, 'click', event => {
                // Chromium may shift a touch-generated click to a nearby target.
                // The original pointerup below already read the cell under the finger.
                if ((event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) &&
                    event.target.closest('.prx-chart-area')) event.stopPropagation();
            }, { capture: true });
            ctx.listen(chart, 'click', selectFromPointer);
            ctx.listen(chart, 'pointerup', event => {
                if (event.pointerType === 'touch') selectFromPointer(event);
            });
            // The shared virtual grid puts its one focus button at the exact current cell.
            function readFocus(event) {
                const button = event.target;
                if (!view || !button.matches('.prx-kbd-point')) return;
                const { svg } = view;
                const pair = view.point(parseFloat(button.style.left) / 100 * Number(svg.getAttribute('width')),
                    parseFloat(button.style.top) / 100 * Number(svg.getAttribute('height')));
                if (pair) selectPair(...pair);
            }
            ctx.listen(chart, 'focusin', readFocus);
            ctx.listen(chart, 'keydown', event => { if (event.defaultPrevented) readFocus(event); });
            return { render(s) {
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        target.set(s.criterion);
                        sorting.set(s.sort);
                        lambda.set(s.lambda);
                        stage.set(s.stage);
                        const model = readKrwModel(s.criterion), c = archiveSnapshot(model, s.lambda), counts = heatCounts(model, c.grade, c.tau), cut = 1 - c.tau;
                        headerView.render(model, c);
                        const sortWords = s.sort === 'krw' ? 'KRW’s figure order (the λ = 1 card)' : s.sort === 'mean' ? 'posterior mean, largest first' : 'estimate, largest first';
                        orderNote.textContent = s.stage === 3 ? `Rows and columns: grade 1 first; within each grade, ${sortWords}.` : `Rows and columns: ${sortWords}.`;
                        const fig = drawKrwHeat(ctx, chart, null, model, { grade: c.grade, tau: c.tau, sort: s.sort, stage: s.stage, pointer: true });
                        const order = s.stage === 3 ? blockOrder(model, c.grade, s.sort) : keyOrder(model, s.sort);
                        view = drawSelection(ctx, fig, model.n, model, c, order, s.stage, rowPick.input.id);
                        active = { model, c, counts, stage: s.stage };
                        selectPair(...(selected ?? [order[0], order[1]]));
                        threshold.replaceChildren('τ ', ro(ctx, 'heat-visible-tau', c.tau, formatSetting),
                            ' · cut ', ro(ctx, null, cut, formatSetting));
                        const alt = ['Heat map, stage one of three: every ordered firm pair and its direction probability.', 'Heat map, stage two of three: cells above one minus tau retain their color; other cells fade.', 'Heat map, stage three of three: card grades outlined, firms sorted by grade and then by the chosen key.'];
                        chart.querySelector('svg')?.setAttribute('aria-label', alt[s.stage - 1]);
                        const cap = chart.querySelector('.prx-data-table caption');
                        if (cap)
                            cap.textContent = ['Stage one, direction probabilities: each firm and the number of firms it is above with probability above one minus tau', 'Stage two, cells above one minus tau: each firm and its above-threshold count', 'Stage three, grade blocks: each firm, its grade and its above-threshold count'][s.stage - 1];
                        const first = s.stage >= 2 ? BLUE_CUTS.filter(v => v <= cut).length : 0, items = [h('b', { text: 'Pr(row truly higher)' })];
                        for (let k = first; k <= BLUE_CUTS.length; k++) {
                            const low = Math.max(s.stage >= 2 ? cut : 0, k === 0 ? 0 : BLUE_CUTS[k - 1]), high = k === BLUE_CUTS.length ? 1 : BLUE_CUTS[k];
                            items.push(h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: `var(--prx-blues-${k + 1})` } }), s.stage >= 2 && k === first ? '>' : '', ro(ctx, null, low, formatSetting), '–', ro(ctx, null, high, formatSetting)));
                        }
                        if (s.stage >= 2)
                            items.push(h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: 'var(--prx-neutral-1)' } }), 'faded: at or below ', ro(ctx, null, 1, formatCount), ' − τ'));
                        items.push(h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: 'var(--prx-plot-grid)' } }), 'gray diagonal: a firm is not compared with itself'));
                        if (s.stage === 3) {
                            const key = (swatch, ...words) => h('span', { class: 'kr-key' }, h('span', { class: `kr-swatch ${swatch}` }), ...words);
                            items.push(key('kr-heat-hatch', 'Confident but withheld by the card: ', ctx.num(counts.W, formatCount(counts.W))),
                                key('kr-heat-outline', 'Stated by the card below the cut: ', ctx.num(counts.S, formatCount(counts.S))),
                                key('kr-heat-agree', 'Stated by both'), key('kr-heat-pale', 'Withheld by both or the other direction'));
                        }
                        legend.replaceChildren(...items);
                        const nums = ['Threshold ', ro(ctx, 'cut', cut, formatSetting), '; ', ro(ctx, 'heat-P', counts.P, formatCount), ' pairs pass; ', ro(ctx, 'heat-W', counts.W, formatCount), ' pass but are withheld; ', ro(ctx, 'heat-S', counts.S, formatCount), ' stated pairs have error above τ.'];
                        note.replaceChildren(...(s.stage === 1 ? ['Each cell is the probability that the row firm’s true gap is larger than the column firm’s: a darker blue is a larger probability. ', ...nums] : s.stage === 2 ? ['Bright cells: a direction probability above ', ro(ctx, null, 1, formatCount), ' − τ = ', ro(ctx, null, cut, formatSetting), '. The isolated pairwise rule would state ', ro(ctx, null, counts.P, formatCount), ' pairs, one cell each; other cells fade. ', ...nums] : ['Outlined squares are the card’s grades. Inside, ', ro(ctx, null, counts.W, formatCount), ' bright cells are pairs the pairwise rule would state but the card withholds. Above and to the right, ', ro(ctx, null, counts.S, formatCount), ' faded cells are stated pairs with error above τ. ', ...nums]));
                        // Source stage-one table also retains each firm’s above-threshold count.
                        if (s.stage === 1) {
                            const diag = thresholdAt(model, s.lambda), table = chart.querySelector('.prx-data-table table');
                            if (table) {
                                table.querySelector('thead tr').append(h('th', { scope: 'col', text: 'Firms it is above with probability above one minus τ' }));
                                table.querySelectorAll('tbody tr').forEach(tr => {
                                    const name = tr.firstElementChild?.textContent, i = model.names.indexOf(name);
                                    if (i >= 0)
                                        tr.append(h('td', { 'data-prx-unitcount': String(i) }, ro(ctx, null, diag.aboveCounts[i], formatCount)));
                                });
                            }
                        }
                        if (firmCounts.open) {
                            const table = chart.querySelector('.prx-data-table table')?.cloneNode(true);
                            if (table) {
                                table.classList.add('kr-table');
                                table.querySelectorAll('[data-prx-unitcount]').forEach(cell => cell.removeAttribute('data-prx-unitcount'));
                                visibleCounts.replaceChildren(table);
                            }
                        }
                        createArchiveReadout(archiveCtx, model, c, ['Showing the heat map, stage ', ro(ctx, 'ro-stage', s.stage, formatCount), ' of ', ro(ctx, null, 3, formatCount), ': ', ro(ctx, 'ro-P', counts.P, formatCount), ' pairs have direction probability above ', ro(ctx, null, 1, formatCount), ' − τ.']);
                    }
                    finally {
                        ctx.root.removeAttribute('aria-busy');
                    }
                } };
        } });
}
