import { confidentPairs, statedAbove } from '../pr-core.js';
import { createWidget } from '../shared/base.js';
import { drawKrwHeat, heatCounts, BLUE_CUTS, thresholdAt } from '../shared/krw-model.js';
import { formatCount, formatReadoutProb, formatReadoutRisk, formatSetting } from '../shared/format.js';
import {
    KRW_COMMON_CSS,
    ARCHIVE_KEYS,
    SORTS,
    keyOrder,
    blockOrder,
    archiveSnapshot,
    readKrwModel,
    createKrwHeader,
    archiveReadoutParts,
    appendKrwNotice,
    ro,
} from '../shared/domain/krw.js';

const CSS = `${KRW_COMMON_CSS}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar{align-items:flex-start}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex:0 1 12.5rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{flex:1 1 11.5rem;max-width:14.5rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 30rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure{align-self:flex-start;margin-top:1.25rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure[open]{margin-top:0}
.prx-kr-heat .kr-heat-threshold{grid-column:1/-1;font-size:.76rem;line-height:1.2;color:var(--prx-fg-muted);margin:0}
.prx-kr-heat .kr-pair-pickers{display:grid;grid-template-columns:repeat(2,minmax(14rem,1fr));gap:.5rem .75rem;flex:1 1 100%;width:100%;min-width:0}
.prx-kr-heat .kr-pair-pickers>.prx-control{min-width:0;width:100%}
.prx-kr-heat .kr-pair-pickers select{width:100%;min-width:0}
.prx-kr-heat .kr-heat-stages{flex-basis:100%}
.prx-kr-heat .kr-heat-box{display:grid;grid-template-columns:minmax(0,488px) minmax(16.5rem,1fr);gap:.85rem 1.15rem;align-items:start;border:0;margin:0;padding:0;background:transparent}
.prx-kr-heat .kr-heat-box .prx-kbd-tip{display:none}
.prx-kr-heat .kr-heat-box .kr-map{width:100%;max-width:488px;margin:0 auto}
.prx-kr-heat .kr-heat-side{display:grid;gap:.55rem;min-width:0;align-content:start}
.prx-kr-heat .prx-stage .kr-pair-card{padding:.5rem .65rem;border:1px solid var(--prx-border-strong);border-left:3px solid var(--prx-plot-fg);border-radius:6px;background:var(--prx-plot-bg);color:var(--prx-plot-fg);font-size:.875rem;line-height:1.4;min-height:3.6rem}
.prx-kr-heat .prx-stage .kr-pair-card>span{display:block}
.prx-kr-heat .prx-stage .kr-pair-meta{color:var(--prx-plot-muted);font-size:.83rem;margin-top:.12rem}
.prx-kr-heat .prx-stage .kr-legend-card{display:grid;gap:.35rem;padding:.45rem .6rem;border:1px solid var(--prx-border);border-radius:6px;background:var(--prx-plot-bg);color:var(--prx-plot-fg)}
.prx-kr-heat .prx-stage .kr-legend-title{margin:0;font-size:.84rem;font-weight:700;color:var(--prx-plot-fg)}
.prx-kr-heat .prx-stage .kr-legend{display:flex;flex-wrap:wrap;gap:.3rem .65rem;font-size:.8rem;line-height:1.35;color:var(--prx-plot-fg)}
.prx-kr-heat .prx-stage .kr-key{display:inline-flex;align-items:center;gap:.32rem;margin:0}
.prx-kr-heat .prx-stage .kr-swatch{display:inline-block;flex:none;width:1.05rem;min-width:1.05rem;height:.78rem;border:1px solid var(--prx-plot-muted);border-radius:2px}
.prx-kr-heat .kr-heat-agree{background:var(--prx-blues-6)}
.prx-kr-heat .kr-heat-pale{background:var(--prx-neutral-1)}
.prx-kr-heat .kr-heat-hatch{background:repeating-linear-gradient(135deg,#793b06 0 1px,#ffd197 1px 3px)}
.prx-kr-heat .kr-heat-outline{background:#f0e5fb;box-shadow:inset 0 0 0 2px #6b269c}
.prx-kr-heat .prx-stage .kr-order-cue{margin:0;font-size:.8rem;line-height:1.35;color:var(--prx-plot-muted)}
@media(min-width:48.01em){
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.26rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.18rem .44rem;font-size:.8rem}
}
@media(min-width:64em){
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar{gap:.4rem .55rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex:0 1 11rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{flex:1 1 10.5rem;max-width:11.5rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 28rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.24rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.18rem .42rem;font-size:.79rem}
}
@media(max-width:54em){
.prx-kr-heat .kr-heat-box{grid-template-columns:minmax(0,1fr);gap:.4rem}
}
@media(max-width:48em){
.prx-widget.prx-kr-heat[data-prx-frame="v2"]{padding:.4rem .3125rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar{gap:.25rem .4rem;margin-bottom:.3rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex:1 1 100%}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{max-width:none;flex-basis:100%}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 auto}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets>.prx-seg-label{font-size:.75rem;margin-bottom:.1rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.22rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.12rem .36rem;font-size:.75rem;line-height:1.15}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure{margin-top:0;padding:0 .5rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure>summary{padding:.1rem 0;font-size:.8rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"]>.prx-readout,.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-readout{padding:.25rem .45rem;margin-bottom:.35rem;font-size:.875rem;line-height:1.3}
.prx-widget.prx-kr-heat[data-prx-frame="v2"] .prx-stage{padding:.38rem .25rem}
.prx-widget.prx-kr-heat[data-prx-frame="v2"]>.prx-disclosures{margin-top:.45rem;gap:.35rem}
.prx-kr-heat .kr-heat-side{gap:.35rem}
.prx-kr-heat .kr-pair-pickers{grid-template-columns:1fr;gap:.45rem}
.prx-kr-heat [data-prx-disclosure="settings"]>.prx-disclosure-body>.prx-control{flex:1 1 100%;width:100%}
.prx-kr-heat .kr-heat-stages .prx-radio{font-size:.84rem}
.prx-kr-heat .prx-stage .kr-pair-card{padding:.35rem .45rem;font-size:.82rem;line-height:1.32;min-height:0}
.prx-kr-heat .prx-stage .kr-pair-meta{font-size:.79rem;margin-top:.08rem}
.prx-kr-heat .prx-stage .kr-legend-card{padding:.32rem .45rem;gap:.25rem}
.prx-kr-heat .prx-stage .kr-legend{gap:.2rem .5rem;font-size:.77rem}
.prx-kr-heat .prx-stage .kr-order-cue{font-size:.76rem}
}`;

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
    else {
        const hdr = svgNode(ctx.doc, 'g', { 'aria-hidden': true, 'pointer-events': 'none' });
        const landmark = svgNode(ctx.doc, 'text', {
            x: x(0),
            y: 14,
            fill: 'var(--prx-plot-muted)',
            'font-size': 13,
            'text-anchor': 'start',
        });
        landmark.textContent = 'Row firm vs. column firm';
        hdr.append(landmark);
        svg.append(hdr);
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
        name: 'krw-heatmap',
        frame: 'v2',
        className: 'prx-kr prx-kr-heat',
        css: CSS,
        label: 'All KRW firm-pair probabilities, thresholded and overlaid by card grades',
        keys: { ...ARCHIVE_KEYS, stage: { type: 'choice', values: [1, 2, 3], value: 1 } },
        build(ctx) {
            const { h } = ctx;
            const lambda = ctx.slider({
                label: 'KRW’s λ',
                name: 'lambda',
                min: .01,
                max: 1,
                step: .01,
                value: ctx.state.lambda,
                onInput: value => ctx.set({ lambda: value }),
            });
            const threshold = h('span', { class: 'kr-heat-threshold' });
            lambda.root.append(threshold);
            ctx.primaryControl(lambda.input);
            ctx.controls.append(lambda.root);

            const settings = ctx.settingsBox('Settings');
            const target = ctx.radioGroup({
                legend: 'Signed contact-gap target',
                name: 'criterion',
                options: [
                    { value: 'race', label: 'Race: white-name advantage' },
                    { value: 'gender', label: 'Gender: male-name advantage' },
                ],
                value: ctx.state.criterion,
                onChange: criterion => ctx.set({ criterion }),
            });
            const stage = ctx.radioGroup({
                legend: 'Heat-map stage',
                name: 'stage',
                className: 'kr-heat-stages',
                options: [
                    { value: 1, label: 'Direction probabilities' },
                    { value: 2, label: ['Cells above ', ctx.num(1, '1'), ' − τ'] },
                    { value: 3, label: 'Grade blocks' },
                ],
                value: ctx.state.stage,
                onChange: value => ctx.set({ stage: Number(value) }),
            });
            const sorting = ctx.select({
                label: 'Within each grade, sort by',
                name: 'sort',
                options: SORTS,
                value: ctx.state.sort,
                onChange: sort => ctx.set({ sort }),
            });
            const names = readKrwModel(ctx.state.criterion).names.map((label, value) => ({ label, value }));
            const rowPick = ctx.select({
                label: 'Row firm',
                name: 'row-firm',
                options: names,
                onChange: i => selectPair(i, selected[1]),
            });
            const colPick = ctx.select({
                label: 'Column firm',
                name: 'column-firm',
                options: names,
                onChange: j => selectPair(selected[0], j),
            });
            const pickers = h('div', { class: 'kr-pair-pickers' }, rowPick.root, colPick.root);
            settings.body.append(target.root, sorting.root);

            const chart = h('div', { class: 'kr-map' });
            const pairCard = h('div', { class: 'kr-pair-card', 'data-krw-pair-line': '' });
            const legendTitle = h('p', { class: 'kr-legend-title', text: 'Pr(row truly higher)' });
            const legend = h('div', { class: 'kr-legend' });
            const orderCue = h('p', { class: 'kr-order-cue' });
            const legendCard = h('div', { class: 'kr-legend-card', 'data-prx-part': 'legend' }, legendTitle, legend, orderCue);
            const side = h('div', { class: 'kr-heat-side' }, stage.root, pickers, pairCard, legendCard);
            const box = h('section', { class: 'kr-heat-box' }, chart, side);
            ctx.stage.append(box);

            const orderNote = h('p', { class: 'kr-note' });
            const note = h('p', { class: 'kr-stage-note' });
            const visibleCounts = h('div', { class: 'kr-scroll' });
            const firmCounts = ctx.dataBox('Data and firm counts', { name: 'firm-counts' });
            firmCounts.body.append(
                orderNote,
                note,
                ctx.scrollRegion(visibleCounts, 'Per-firm counts in the current heat-map order'),
            );

            const header = h('section', { class: 'kr-header' });
            const archiveText = h('p', { class: 'kr-note' });
            const methodBox = ctx.methodBox('Method and archive notes');
            methodBox.body.append(
                header,
                archiveText,
                h('p', { class: 'kr-note', text: 'KRW placed no cap on the number of grades. Some pairs within a grade have high posterior support for one direction, but the card withholds them to keep the full report coherent.' }),
                h('p', { class: 'kr-note' }, 'τ = λ/(', ctx.num(1, formatCount(1)), ' + λ). The grid starts at the first positive λ.'),
                h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ',
                    ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '.'),
            );
            const headerView = createKrwHeader(ctx, header);
            appendKrwNotice(ctx);

            let view, selected, active;
            function selectPair(i, j) {
                if (!active || i === undefined || j === undefined) return;
                selected = [i, j];
                const { model, c } = active;
                const { names: firmNames, e } = model, g = c.grade;
                rowPick.set(i);
                colPick.set(j);
                view.highlight(i, j);
                const direction = (a, b) => a === i && b === j ? 'row above column' : 'column above row';
                const isolated = e[i][j] < c.tau ? direction(i, j) : e[j][i] < c.tau ? direction(j, i) : 'withholds';
                const cardDirection = g[i] === g[j] ? 'withholds' : g[i] < g[j] ? direction(i, j) : direction(j, i);
                const pair = i === j ? [
                    h('span', {}, h('strong', { text: firmNames[i] }), ' · diagonal (same firm, grade ',
                        ro(ctx, 'heat-pair-row-grade', g[i], formatCount), ')'),
                ] : [
                    h('span', {}, h('strong', { text: `${firmNames[i]} vs ${firmNames[j]}` }), ' · Pr(row higher) ',
                        ro(ctx, 'heat-pair-probability', 1 - e[i][j], formatReadoutProb)),
                    h('span', { class: 'kr-pair-meta' }, 'Pair rule: ', isolated, ' · Card: ', cardDirection, ' (grades ',
                        ro(ctx, 'heat-pair-row-grade', g[i], formatCount), ' and ', ro(ctx, 'heat-pair-column-grade', g[j], formatCount), ')'),
                ];
                pairCard.dataset.rowFirm = String(i);
                pairCard.dataset.columnFirm = String(j);
                pairCard.replaceChildren(...pair);
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

            return {
                render(s, info = {}) {
                    if (info.reason === 'disclosure') return;
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        target.set(s.criterion);
                        sorting.set(s.sort);
                        lambda.set(s.lambda);
                        stage.set(s.stage);
                        const model = readKrwModel(s.criterion);
                        const c = archiveSnapshot(model, s.lambda);
                        const counts = heatCounts(model, c.grade, c.tau);
                        const cut = 1 - c.tau;

                        headerView.render(model, c);
                        const sortWords = s.sort === 'krw' ? 'KRW’s figure order (the λ = 1 card)' : s.sort === 'mean' ? 'posterior mean, largest first' : 'estimate, largest first';
                        orderNote.textContent = s.stage === 3 ? `Rows and columns: grade 1 first; within each grade, ${sortWords}.` : `Rows and columns: ${sortWords}.`;
                        const shortSort = s.sort === 'krw' ? 'KRW order' : s.sort === 'mean' ? 'posterior mean' : 'estimate';
                        orderCue.textContent = s.stage === 3
                            ? `Order: grade, then ${shortSort} · click or arrow keys.`
                            : `Order: ${shortSort} · click or arrow keys.`;

                        const fig = drawKrwHeat(ctx, chart, null, model, { grade: c.grade, tau: c.tau, sort: s.sort, stage: s.stage, pointer: true });
                        const order = s.stage === 3 ? blockOrder(model, c.grade, s.sort) : keyOrder(model, s.sort);
                        view = drawSelection(ctx, fig, model.n, model, c, order, s.stage, rowPick.input.id);
                        active = { model, c, counts, stage: s.stage };
                        selectPair(...(selected ?? [order[0], order[1]]));

                        threshold.replaceChildren(
                            'τ = ', ro(ctx, 'heat-visible-tau', c.tau, formatReadoutRisk),
                            ' · cut ', ro(ctx, null, cut, formatReadoutProb),
                        );

                        const targetWord = s.criterion === 'race' ? 'white-name' : 'male-name';
                        if (s.stage === 1) {
                            ctx.readout.set([
                                'Across ', ro(ctx, null, model.M, formatCount), ' firm pairs on the ', targetWord, ' gap, ',
                                ro(ctx, 'heat-visible-P', counts.P, formatCount), ' exceed ',
                                ro(ctx, null, 1, formatCount), ' − τ = ', ro(ctx, null, cut, formatReadoutProb),
                                ' while ', ro(ctx, null, c.d.G, formatCount),
                                c.d.G === 1 ? ' card grade states ' : ' card grades state ',
                                ro(ctx, null, c.d.N, formatCount), ' pairs.',
                            ]);
                        }
                        else if (s.stage === 2) {
                            ctx.readout.set([
                                'At cut ', ro(ctx, null, 1, formatCount), ' − τ = ', ro(ctx, null, cut, formatReadoutProb),
                                ' on the ', targetWord, ' gap, the isolated rule states ',
                                ro(ctx, 'heat-visible-P', counts.P, formatCount), ' of ',
                                ro(ctx, null, model.M, formatCount), ' pairs; other cells fade.',
                            ]);
                        }
                        else {
                            ctx.readout.set([
                                'On the ', targetWord, ' gap, ', ro(ctx, null, counts.P, formatCount),
                                ' pairs pass ', ro(ctx, null, 1, formatCount), ' − τ = ',
                                ro(ctx, 'heat-visible-cut', cut, formatReadoutProb), ': the card withholds ',
                                ro(ctx, 'heat-visible-W', counts.W, formatCount), ' confident pairs and states ',
                                ro(ctx, 'heat-visible-S', counts.S, formatCount), ' below cut.',
                            ]);
                        }

                        const alt = [
                            'Heat map, stage one of three: every ordered firm pair and its direction probability.',
                            'Heat map, stage two of three: cells above one minus tau retain their color; other cells fade.',
                            'Heat map, stage three of three: card grades outlined, firms sorted by grade and then by the chosen key.',
                        ];
                        chart.querySelector('svg')?.setAttribute('aria-label', alt[s.stage - 1]);
                        const cap = chart.querySelector('.prx-data-table caption');
                        if (cap) {
                            cap.textContent = [
                                'Stage one, direction probabilities: each firm and the number of firms it is above with probability above one minus tau',
                                'Stage two, cells above one minus tau: each firm and its above-threshold count',
                                'Stage three, grade blocks: each firm, its grade and its above-threshold count',
                            ][s.stage - 1];
                        }

                        const first = s.stage >= 2 ? BLUE_CUTS.filter(v => v <= cut).length : 0;
                        const keyItem = (swatchEl, ...words) => h('span', { class: 'kr-key' }, swatchEl, h('span', {}, ...words));
                        const items = [];
                        for (let k = first; k <= BLUE_CUTS.length; k++) {
                            const low = Math.max(s.stage >= 2 ? cut : 0, k === 0 ? 0 : BLUE_CUTS[k - 1]);
                            const high = k === BLUE_CUTS.length ? 1 : BLUE_CUTS[k];
                            items.push(keyItem(
                                h('span', { class: 'kr-swatch', style: { background: `var(--prx-blues-${k + 1})` } }),
                                s.stage >= 2 && k === first ? '>' : '',
                                ro(ctx, null, low, s.stage >= 2 && k === first ? formatReadoutProb : formatSetting),
                                '–',
                                ro(ctx, null, high, formatSetting),
                            ));
                        }
                        if (s.stage >= 2) {
                            items.push(keyItem(
                                h('span', { class: 'kr-swatch', style: { background: 'var(--prx-neutral-1)' } }),
                                '≤ ', ro(ctx, null, 1, formatCount), ' − τ',
                            ));
                        }
                        items.push(keyItem(
                            h('span', { class: 'kr-swatch', style: { background: 'var(--prx-plot-grid)' } }),
                            'diagonal',
                        ));
                        if (s.stage === 3) {
                            const key = (swatch, ...words) => keyItem(h('span', { class: `kr-swatch ${swatch}` }), ...words);
                            items.push(
                                key('kr-heat-hatch', 'Withheld > cut (', ctx.num(counts.W, formatCount(counts.W)), ')'),
                                key('kr-heat-outline', 'Stated ≤ cut (', ctx.num(counts.S, formatCount(counts.S)), ')'),
                                key('kr-heat-agree', 'Both state'),
                                key('kr-heat-pale', 'Both withhold'),
                            );
                        }
                        legend.replaceChildren(...items);

                        const nums = [
                            'Threshold ', ro(ctx, 'cut', cut, formatSetting), '; ',
                            ro(ctx, 'heat-P', counts.P, formatCount), ' pairs pass; ',
                            ro(ctx, 'heat-W', counts.W, formatCount), ' pass but are withheld; ',
                            ro(ctx, 'heat-S', counts.S, formatCount), ' stated pairs have error above τ.',
                        ];
                        note.replaceChildren(...(s.stage === 1
                            ? ['Each cell is the probability that the row firm’s true gap is larger than the column firm’s: a darker blue is a larger probability. ', ...nums]
                            : s.stage === 2
                                ? ['Bright cells: a direction probability above ', ro(ctx, null, 1, formatCount), ' − τ = ', ro(ctx, null, cut, formatSetting), '. The isolated pairwise rule would state ', ro(ctx, null, counts.P, formatCount), ' pairs, one cell each; other cells fade. ', ...nums]
                                : ['Outlined squares are the card’s grades. Inside, ', ro(ctx, null, counts.W, formatCount), ' bright cells are pairs the pairwise rule would state but the card withholds. Above and to the right, ', ro(ctx, null, counts.S, formatCount), ' faded cells are stated pairs with error above τ. ', ...nums]));

                        // Source stage-one table also retains each firm’s above-threshold count.
                        if (s.stage === 1) {
                            const diag = thresholdAt(model, s.lambda), table = chart.querySelector('.prx-data-table table');
                            if (table) {
                                table.querySelector('thead tr').append(h('th', { scope: 'col', text: 'Firms it is above with probability above one minus τ' }));
                                table.querySelectorAll('tbody tr').forEach(tr => {
                                    const name = tr.firstElementChild?.textContent, i = model.names.indexOf(name);
                                    if (i >= 0) tr.append(h('td', { 'data-prx-unitcount': String(i) }, ro(ctx, null, diag.aboveCounts[i], formatCount)));
                                });
                            }
                        }

                        const tableClone = chart.querySelector('.prx-data-table table')?.cloneNode(true);
                        if (tableClone) {
                            tableClone.classList.add('kr-table');
                            tableClone.querySelectorAll('[data-prx-unitcount]').forEach(cell => cell.removeAttribute('data-prx-unitcount'));
                            visibleCounts.replaceChildren(tableClone);
                        }

                        archiveText.replaceChildren(...archiveReadoutParts(ctx, model, c, [
                            'Showing the heat map, stage ', ro(ctx, 'ro-stage', s.stage, formatCount),
                            ' of ', ro(ctx, null, 3, formatCount), ': ',
                            ro(ctx, 'ro-P', counts.P, formatCount),
                            ' pairs have direction probability above ', ro(ctx, null, 1, formatCount), ' − τ.',
                        ]));
                    }
                    finally {
                        ctx.root.removeAttribute('aria-busy');
                    }
                },
            };
        },
    });
}
