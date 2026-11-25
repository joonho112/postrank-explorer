// Full S-02 lambda-grid view, retaining the entire v2 stated-error matrix in frame v2.
import { createWidget } from '../shared/base.js';
import { canvasLayer, gradeColors, labelOn, numText, palette, parseColor, placeDirectLabels, plot, svgEl } from '../shared/chart.js';
import {
    formatCount,
    formatDecimal,
    formatDistinguishing,
    formatProb,
    formatReadoutRisk,
    formatRisk,
    formatSetting,
    formatShare,
    formatSizes,
} from '../shared/format.js';
import { captionNode } from '../shared/labels.js';
import { relationChange, statedAbove, unitRelationCounts } from '../pr-core.js';
import {
    KRW_COMMON_CSS,
    ARCHIVE_KEYS,
    archiveSnapshot,
    readKrwModel,
    blockOrder,
    createKrwHeader,
    riskDigits,
    appendKrwNotice,
    ro,
} from '../shared/domain/krw.js';

const layers = new WeakMap();
const grids = new WeakMap();
const changes = new WeakMap();
const pairErrors = new WeakMap();

// Only the paint ramp is prepared here; every probability remains the released value.
function colorRamp(steps) {
    const colors = steps.map(step => parseColor(step));
    return t => {
        const x = Math.min(1, Math.max(0, t)) * (steps.length - 1);
        const k = Math.min(steps.length - 2, Math.floor(x));
        const a = colors[k];
        const b = colors[k + 1];
        const u = x - k;
        return a && b
            ? `rgb(${a.map((v, c) => Math.round(v + (b[c] - v) * u)).join(', ')})`
            : steps[k];
    };
}

function pickSpacedBands(bands, yPxOf, minGapPx = 18) {
    if (bands.length <= 1) return bands.slice();
    const out = [bands[0]];
    for (let i = 1; i < bands.length; i += 1) {
        if (yPxOf(bands[i].mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) {
            out.push(bands[i]);
        }
    }
    const last = bands[bands.length - 1];
    if (out[out.length - 1] !== last) {
        if (out.length > 1 && yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) < minGapPx) {
            out[out.length - 1] = last;
        }
        else if (yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) {
            out.push(last);
        }
    }
    return out;
}

/** The actual v2 by-grade matrix: Purples stated errors, withheld gray, blank diagonal and grade stripe. */
export function drawStatedErrorMatrix(ctx, slot, model, c, { sort = 'mean' } = {}) {
    const order = blockOrder(model, c.grade, sort);
    const blocks = [];
    order.forEach((i, p) => {
        const g = c.grade[i];
        const last = blocks.at(-1);
        if (last?.grade === g) last.end = p + 1;
        else blocks.push({ grade: g, start: p, end: p + 1 });
    });
    const n = model.n;
    const rawW = Math.round(slot.clientWidth || ctx.width() || 320);
    const width = Math.min(350, Math.max(200, rawW));
    const strip = Math.max(8, Math.round((24 * n) / Math.max(120, width - 28)));
    const cell = (width - 2) / (n + strip);
    const height = Math.max(200, Math.round(cell * n + 4));
    const innerH = Math.max(1, height - 4);
    const yPxOf = v => 2 + (v / n) * innerH;
    const dataYOf = py => ((py - 2) / innerH) * n;
    const halfPill = (8.5 / innerH) * n;

    const pal = palette(ctx.root);
    const gc = gradeColors(c.d.G, pal);
    const rel = unitRelationCounts(c.grade);
    const firms = order.map((u, p) => ({
        u,
        p,
        name: model.names[u],
        grade: c.grade[u],
        mean: model.mean[u],
        lo: model.lower[u],
        hi: model.upper[u],
        stated: rel.stated[u],
        withheld: rel.withheld[u],
    }));
    const bands = blocks.map(b => ({
        ...b,
        fill: gc[b.grade - 1],
        ink: labelOn(gc[b.grade - 1], pal),
        mid: (b.start + b.end) / 2,
    }));
    const spaced = pickSpacedBands(bands, yPxOf, 19);
    const placed = placeDirectLabels(
        spaced.map(b => ({ id: String(b.grade), y: yPxOf(b.mid), band: b })),
        { minGapPx: 19, bounds: [11, height - 11] },
    );
    const byId = new Map(placed.map(p => [p.id, p]));
    const labeledBands = spaced.map(b => ({
        ...b,
        labelMid: dataYOf(byId.get(String(b.grade))?.y ?? yPxOf(b.mid)),
    }));

    let layer = layers.get(slot);
    if (!layer) {
        layer = { canvas: null, paint: null };
        layers.set(slot, layer);
    }
    layer.paint = { model, c, order };
    const fig = plot(slot, {
        width,
        height,
        aspect: false,
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 0,
        marginRight: 2,
        x: { domain: [-strip, n], axis: null },
        y: { domain: [n, 0], axis: null },
        alt: 'All firm pairs by grade: stated directions shaded by wrong-direction probability in Purples; within-grade pairs gray, diagonal blank. Grade colors are in the left stripe.',
        table: {
            caption: 'All firms in matrix order, supplied marginal summaries and per-firm relation counts',
            columns: [
                { label: 'Position', value: d => d.p + 1, format: formatCount },
                { label: 'Firm', value: 'name' },
                { label: 'Grade', value: 'grade', format: formatCount },
                { label: 'Posterior mean', value: 'mean', format: v => formatDecimal(v, { digits: 3 }) },
                { label: 'Central interval, lower', value: 'lo', format: v => formatDecimal(v, { digits: 3 }) },
                { label: 'Central interval, upper', value: 'hi', format: v => formatDecimal(v, { digits: 3 }) },
                { label: 'Pairs stated', value: 'stated', format: formatCount },
                { label: 'Pairs withheld', value: 'withheld', format: formatCount },
            ],
            rows: firms,
        },
        keyboard: {
            data: firms,
            x: d => d.p + .5,
            y: d => d.p + .5,
            sort: false,
            key: d => String(d.u),
            label: 'The firms along the diagonal. Use arrow keys to read each firm and its relation counts.',
            title: d => `${d.name}: grade ${d.grade} of ${c.d.G}; posterior mean ${formatDecimal(d.mean, { digits: 3 })}, 90% interval ${formatDecimal(d.lo, { digits: 3 })} to ${formatDecimal(d.hi, { digits: 3 })}; ${d.stated} pairs stated, ${d.withheld} withheld.`,
        },
        marks: (k, P) => [
            P.rect(bands, { x1: -strip + .6, x2: -.6, y1: 'start', y2: 'end', fill: 'fill' }),
            P.rect(labeledBands, {
                x1: -strip + .5,
                x2: -.5,
                y1: b => b.labelMid - halfPill,
                y2: b => b.labelMid + halfPill,
                fill: 'fill',
                stroke: k.plotBg,
                strokeWidth: 1,
                rx: 3,
            }),
            numText(labeledBands, {
                x: -strip / 2,
                y: 'labelMid',
                value: 'grade',
                format: formatCount,
                fill: 'ink',
                fontWeight: 700,
                fontSize: 13,
            }),
            P.rect(blocks.filter(b => b.end - b.start > 1), {
                x1: 'start',
                x2: 'end',
                y1: 'start',
                y2: 'end',
                fill: 'none',
                stroke: k.plotFg,
                strokeWidth: 1.4,
            }),
        ],
    });
    if (!layer.canvas || !slot.contains(layer.canvas)) {
        const current = layer;
        layer.canvas = canvasLayer(fig, (g, { x, y, palette: k }) => {
            const { model: m, c: r, order: o } = current.paint;
            const cw = Math.abs(x(1) - x(0));
            const ch = Math.abs(y(1) - y(0));
            const xs = o.map((_, p) => x(p));
            const ys = o.map((_, p) => y(p));
            const ramp = colorRamp(k.purples);
            for (let p = 0; p < n; p++) {
                for (let q = 0; q < n; q++) {
                    const i = o[p];
                    const j = o[q];
                    g.fillStyle = i === j
                        ? k.plotBg
                        : r.grade[i] === r.grade[j]
                            ? k.relWithheld
                            : ramp((r.grade[i] < r.grade[j] ? m.e[i][j] : m.e[j][i]) / .5);
                    g.fillRect(xs[q], ys[p], cw + .25, ch + .25);
                }
            }
        }).canvas;
    }
    return fig;
}

const CSS = `${KRW_COMMON_CSS}
.prx-kr.krw-lambda-v2 .kr-purples{background:linear-gradient(90deg,var(--prx-purples-1),var(--prx-purples-4),var(--prx-purples-7));width:2.6rem}
.prx-kr.krw-lambda-v2 .kr-swatch{flex-shrink:0}
.prx-kr.krw-lambda-v2 .kr-key{overflow-wrap:normal;word-break:keep-all}
.prx-kr.krw-lambda-v2 .kr-key-label{overflow-wrap:normal;word-break:keep-all}
.prx-kr.krw-lambda-v2 .kr-stage-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem;align-items:start}
@media(min-width:52em){.prx-kr.krw-lambda-v2 .kr-stage-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.22fr);gap:.65rem 1.15rem}}
.prx-kr.krw-lambda-v2 .kr-stage-col{min-width:0}
.prx-kr.krw-lambda-v2 .kr-stage-col .kr-grade1{margin:0 0 .2rem;font-size:.82rem;line-height:1.3;color:var(--prx-fg)}
.prx-kr.krw-lambda-v2 .prx-stage .kr-map{max-width:340px;margin:0}
@media(max-width:48em){
.prx-widget.krw-lambda-v2[data-prx-frame="v2"]{padding:.38rem .42rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar{gap:.18rem .28rem;margin-bottom:.26rem;align-items:flex-end}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-controls{gap:.18rem .5rem;flex:1 1 100%}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 auto}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets>.prx-seg-label{margin:0 0 .06rem;font-size:.7rem;line-height:1.05}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.16rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.14rem .32rem;font-size:.73rem;line-height:1.1}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure{padding:0 .35rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure>summary{font-size:.76rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"]>.prx-readout{margin-bottom:.28rem;padding:.2rem .45rem;font-size:.84rem;line-height:1.26}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-stage{padding:.35rem .42rem}
.prx-kr.krw-lambda-v2 .prx-panel-title{margin-bottom:.08rem;font-size:.81rem}
.prx-kr.krw-lambda-v2 .prx-stage .kr-map{max-width:244px}
.prx-kr.krw-lambda-v2 .prx-stage .kr-legend{margin:.18rem 0 0;padding:0;font-size:.75rem;gap:.15rem .45rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"]>.prx-disclosures{margin-top:.4rem;gap:.35rem}
}
.prx-kr.krw-lambda-v2 .prx-stage .kr-legend{margin:.3rem 0 0;padding:.1rem 0;font-size:.8rem;color:var(--prx-fg-muted);gap:.25rem .6rem}
.prx-kr.krw-lambda-v2 .kr-progress{min-height:4px;margin:2px 0 0;font-size:.78rem;line-height:1.2;color:var(--prx-fg-muted)}
.prx-kr.krw-lambda-v2 .kr-lambda-summary,.prx-kr.krw-lambda-v2 .kr-lambda-change{margin:0;display:inline}
.prx-kr.krw-lambda-v2 .kr-lambda-change{font-weight:600}
.prx-kr.krw-lambda-v2 .kr-sort-strip{display:flex;flex-wrap:wrap;align-items:center;gap:.15rem .5rem;margin:0}
.prx-kr.krw-lambda-v2 .kr-sort-strip>legend{margin:0 .25rem 0 0;display:inline-block}
.prx-kr.krw-lambda-v2 .kr-sort-strip .prx-radio{margin-right:0}
@media(min-width:48.01em){
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar{gap:.28rem .65rem;margin-bottom:.35rem;align-items:center}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-controls{gap:.3rem .85rem;flex:1 1 100%;align-items:center}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{flex:0 1 15rem;max-width:16rem;grid-template-columns:auto minmax(7rem,1fr) auto;column-gap:.45rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider>label{grid-column:auto;margin:0;white-space:nowrap}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 42rem;flex-direction:row;align-items:center;gap:.35rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets>.prx-seg-label{margin:0;white-space:nowrap}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.22rem;flex:1 1 auto}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-presets .prx-seg{min-height:1.72rem;padding:.1rem .42rem;font-size:.775rem;line-height:1.18}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure{align-self:center;padding:0 .5rem}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure>summary{min-height:1.72rem;padding:.1rem 0}
.prx-widget.krw-lambda-v2[data-prx-frame="v2"] .kr-sort-strip .prx-radio{min-height:1.72rem}
}
`;

export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, {
        name: 'krw-lambda',
        frame: 'v2',
        className: 'prx-kr krw-lambda-v2',
        css: CSS,
        label: 'KRW’s complete lambda grid and stated errors',
        keys: { ...ARCHIVE_KEYS },
        build(ctx) {
            const { h } = ctx;
            const lambdaCtl = ctx.slider({
                label: 'KRW’s λ',
                name: 'lambda',
                min: .01,
                max: 1,
                step: .01,
                value: ctx.state.lambda,
                onInput: v => ctx.set({ lambda: v }),
            });
            ctx.primaryControl(lambdaCtl.input);
            const sortCtl = ctx.radioGroup({
                legend: 'Sort',
                name: 'sort',
                className: 'kr-sort-strip',
                options: [
                    { value: 'mean', label: 'Mean' },
                    { value: 'estimate', label: 'Estimate' },
                    { value: 'krw', label: 'KRW' },
                ],
                value: ctx.state.sort,
                onChange: v => ctx.set({ sort: v }),
            });
            ctx.controls.append(lambdaCtl.root, sortCtl.root);

            const settings = ctx.settingsBox('Settings');
            const criterionCtl = ctx.radioGroup({
                legend: 'Signed contact-gap target',
                name: 'criterion',
                options: [
                    { value: 'race', label: 'Race: white-name advantage' },
                    { value: 'gender', label: 'Gender: male-name advantage' },
                ],
                value: ctx.state.criterion,
                onChange: v => ctx.set({ criterion: v }),
            });
            settings.body.append(criterionCtl.root);

            const Gchart = h('div', { class: 'kr-gridchart' });
            const top = h('p', { class: 'kr-grade1' });
            const history = h('div', { class: 'kr-lambda-history', 'data-prx-readout': 'archive-preview' });
            const matrix = h('div', { class: 'kr-map' });
            const legend = h(
                'p',
                { class: 'kr-legend', 'data-prx-part': 'legend' },
                h(
                    'span',
                    { class: 'kr-key' },
                    h('span', { class: 'kr-swatch kr-purples' }),
                    h('span', { class: 'kr-key-label' }, 'stated error: ', ro(ctx, null, 0, formatCount), ' to ', ro(ctx, null, .5, formatSetting), '+ (saturated)'),
                ),
                h(
                    'span',
                    { class: 'kr-key' },
                    h('span', { class: 'kr-swatch', style: { background: 'var(--prx-rel-withheld)' } }),
                    'withheld',
                ),
            );
            const progress = h('p', { class: 'kr-progress', 'aria-hidden': 'true' });
            ctx.stage.append(
                h(
                    'div',
                    { class: 'kr-stage-grid' },
                    h('div', { class: 'kr-stage-col' }, ctx.panelTitle('Pairs by grade'), top, matrix, legend, history),
                    h('div', { class: 'kr-stage-col' }, ctx.panelTitle('Grades along λ'), Gchart),
                ),
                progress,
            );

            const intro = h('p', { class: 'kr-grid-intro' });
            const shares = h('div', { class: 'kr-gridchart' });
            const en = h('div', { class: 'kr-gridchart' });
            const risk = h('div', { class: 'kr-gridchart' });
            const split = h('p', { class: 'kr-note' });
            const doubtful = h('div');
            const table = h('div', { class: 'kr-scroll kr-table-wrap' });
            const dataBox = ctx.dataBox('Data, path charts and grid table');
            dataBox.body.append(
                intro,
                h('div', { class: 'kr-grid' }, shares, en),
                risk,
                split,
                doubtful,
                ctx.scrollRegion(table, 'All archived grid rows, with positive-tau risk unavailable at lambda zero'),
            );

            const header = h('section', { class: 'kr-header' });
            const fullReadout = h('p', { class: 'kr-note' });
            const methodBox = ctx.methodBox('Method and loss');
            methodBox.body.append(
                header,
                fullReadout,
                h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ', ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '. τ = λ/(', ctx.num(1, formatCount(1)), ' + λ); the grid starts at the first positive λ.'),
                h('p', { class: 'kr-note', text: 'We read each grid card as KRW’s code left it; we do not claim that a grid card is the best card at its λ.' }),
                h('p', { class: 'kr-note' }, captionNode(ctx, 'tau-not-compared'), '. Each risk is paired with its own all-withheld risk τ. ', captionNode(ctx, 'fixed-report'), '.'),
                h('p', { class: 'kr-note', text: 'Neighbor changes compare adjacent grid rows, not the last setting you visited.' }),
            );
            const headerView = createKrwHeader(ctx, header);
            appendKrwNotice(ctx);

            function drawCurve(slot, rows, c, { kind, title, ylabel, domain, log = false }) {
                const measured = Math.round(slot.clientWidth || 0);
                const fallbackW = kind === 'G' ? Math.max(240, Math.round(ctx.width() * 0.52)) : Math.max(240, Math.round(ctx.width()));
                const width = Math.max(220, measured > 0 ? measured : fallbackW);
                const narrow = width < 400;
                const height = kind === 'G' ? (narrow ? 196 : 292) : 226;
                const cur = rows.find(r => r.index === c.index);
                const tip = r => `λ ${formatSetting(r.lambda)}: ${r.d.G} grades, ${formatCount(r.d.N)} pairs stated, s ${formatShare(r.d.s)}, DR ${formatShare(r.DR)}, E/N ${formatShare(r.ev.EoverN[0])}, risk ${formatRisk(r.ev.risk)}`;
                let marks;
                const base = (k, P) => [P.ruleX([c.lambda], { stroke: k.plotMuted, strokeDasharray: '4,3' })];
                if (kind === 'G') {
                    marks = (k, P) => [
                        ...base(k, P),
                        P.line(rows, { x: 'lambda', y: r => r.d.G, stroke: k.plotFg, curve: 'step-after' }),
                        P.dot(rows, { x: 'lambda', y: r => r.d.G, r: 1.8, fill: k.plotFg }),
                        P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.d.G, r: 5, fill: 'none', stroke: k.plotFg, strokeWidth: 2 }),
                        numText(cur ? [cur] : [], {
                            x: 'lambda',
                            y: r => r.d.G,
                            value: r => r.d.G,
                            format: formatCount,
                            dx: c.lambda >= .83 ? -12 : 12,
                            dy: c.d.G >= 55 ? 15 : -10,
                            textAnchor: c.lambda >= .83 ? 'end' : 'start',
                            fill: k.plotFg,
                            fontSize: 13,
                            fontWeight: 700,
                            render(index, scales, values, dims, context, next) {
                                const group = next(index, scales, values, dims, context);
                                group.removeAttribute('transform');
                                const textNode = group.querySelector('text');
                                if (textNode && index.length) {
                                    const i = index[0];
                                    const anchor = c.lambda >= .83 ? 'end' : 'start';
                                    const dxPx = c.lambda >= .83 ? -10 : 10;
                                    const dyPx = c.d.G >= 55 ? 15 : -12;
                                    const labelStr = textNode.textContent || '';
                                    const pw = Math.max(18, Math.ceil(labelStr.length * 8.2 + 10));
                                    const ph = 17;
                                    const rawPx = values.x[i] + dxPx;
                                    const px = anchor === 'end'
                                        ? Math.max(dims.marginLeft + pw - 5, Math.min(dims.width - dims.marginRight - 2, rawPx))
                                        : Math.max(dims.marginLeft + 2, Math.min(dims.width - dims.marginRight - pw + 5, rawPx));
                                    const py = Math.max(dims.marginTop + ph / 2, Math.min(dims.height - dims.marginBottom - ph / 2, values.y[i] + dyPx));
                                    textNode.setAttribute('data-prx-readout', 'lambda-selected-grade-mark');
                                    textNode.removeAttribute('transform');
                                    textNode.removeAttribute('dx');
                                    textNode.removeAttribute('dy');
                                    textNode.setAttribute('x', px.toFixed(1));
                                    textNode.setAttribute('y', py.toFixed(1));
                                    textNode.setAttribute('dominant-baseline', 'central');
                                    textNode.setAttribute('text-anchor', anchor);
                                    textNode.style.textAnchor = anchor;
                                    const rx0 = anchor === 'end' ? px - pw + 5 : px - 5;
                                    const rect = context.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                                    rect.setAttribute('x', rx0.toFixed(1));
                                    rect.setAttribute('y', (py - ph / 2).toFixed(1));
                                    rect.setAttribute('width', String(pw));
                                    rect.setAttribute('height', String(ph));
                                    rect.setAttribute('rx', '3');
                                    rect.setAttribute('fill', k.plotBg);
                                    rect.setAttribute('stroke', k.cellBorder);
                                    rect.setAttribute('stroke-width', '1');
                                    textNode.before(rect);
                                }
                                return group;
                            },
                        }),
                        P.tip(rows, P.pointerX({ x: 'lambda', y: r => r.d.G, title: tip })),
                    ];
                }
                else if (kind === 'shares') {
                    const endRow = rows.at(-1);
                    const endLabels = endRow
                        ? [
                            { id: 's', lambda: endRow.lambda, yVal: endRow.d.s, label: 's = N/M', inkKey: 'plotFg' },
                            { id: 'dr', lambda: endRow.lambda, yVal: endRow.DR, label: 'DR = E/M', inkKey: 'errText' },
                        ]
                        : [];
                    marks = (k, P) => [
                        ...base(k, P),
                        P.line(rows, { x: 'lambda', y: r => r.d.s, stroke: k.plotFg }),
                        P.line(rows, { x: 'lambda', y: 'DR', stroke: k.err, strokeDasharray: '5,3' }),
                        P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.d.s, r: 5, fill: 'none', stroke: k.plotFg }),
                        P.dot(cur ? [cur] : [], { x: 'lambda', y: 'DR', r: 5, fill: 'none', stroke: k.err }),
                        P.text(endLabels, {
                            x: 'lambda',
                            y: 'yVal',
                            text: 'label',
                            textAnchor: 'start',
                            render(index, scales, values, dims) {
                                const items = Array.from(index, i => ({ id: endLabels[i].id, y: values.y[i], height: 16 }));
                                const placed = placeDirectLabels(items, {
                                    minGapPx: 16,
                                    bounds: [dims.marginTop + 8, dims.height - dims.marginBottom - 8],
                                });
                                const byId = new Map(placed.map(p => [p.id, p]));
                                const g = svgEl(ctx.doc, 'g', { 'aria-label': 'text' });
                                for (const i of index) {
                                    const d = endLabels[i];
                                    const px = values.x[i] + 6;
                                    const py = byId.get(d.id)?.y ?? values.y[i];
                                    const wPill = Math.ceil(d.label.length * 7.2 + 6);
                                    g.append(
                                        svgEl(ctx.doc, 'rect', {
                                            x: px - 3,
                                            y: py - 8,
                                            width: wPill,
                                            height: 16,
                                            rx: 3,
                                            fill: k.plotBg,
                                            fillOpacity: 0.92,
                                        }),
                                        svgEl(ctx.doc, 'text', {
                                            x: px,
                                            y: py,
                                            fill: k[d.inkKey],
                                            fontWeight: 600,
                                            fontSize: 13,
                                            dominantBaseline: 'central',
                                            textAnchor: 'start',
                                            style: { textAnchor: 'start' },
                                            text: d.label,
                                        }),
                                    );
                                }
                                return g;
                            },
                        }),
                    ];
                }
                else if (kind === 'risk') {
                    marks = (k, P) => [
                        ...base(k, P),
                        P.line(rows, { x: 'lambda', y: r => r.ev.risk, stroke: k.plotFg }),
                        P.line(rows, { x: 'lambda', y: 'tau', stroke: k.wh, strokeDasharray: '5,3' }),
                        P.dot(cur ? [cur] : [], { x: 'lambda', y: r => r.ev.risk, r: 5, fill: 'none', stroke: k.plotFg }),
                    ];
                }
                else {
                    marks = (k, P) => [
                        ...base(k, P),
                        P.line(rows, { x: 'lambda', y: r => r.ev.EoverN[0], defined: r => r.d.N > 0, stroke: k.err }),
                        P.dot(cur && cur.d.N > 0 ? [cur] : [], { x: 'lambda', y: r => r.ev.EoverN[0], r: 5, fill: 'none', stroke: k.err }),
                    ];
                }
                return plot(slot, {
                    width,
                    height,
                    aspect: false,
                    marginTop: 22,
                    marginBottom: 42,
                    marginLeft: 52,
                    marginRight: kind === 'shares' ? 84 : 20,
                    x: {
                        domain: [0, 1],
                        inset: 6,
                        ticks: narrow ? [0, .25, .5, .75, 1] : [0, .2, .4, .6, .8, 1],
                        label: 'KRW’s λ',
                        labelAnchor: 'center',
                        labelArrow: 'none',
                    },
                    y: {
                        ...(log ? { type: 'log', ticks: [1, 2, 5, 10, 20, 50, 100] } : { insetTop: 6, insetBottom: 4 }),
                        domain,
                        label: ylabel,
                        labelArrow: 'none',
                        grid: true,
                    },
                    alt: title,
                    table: {
                        caption: title,
                        columns: [
                            { label: 'λ', value: 'lambda', format: formatSetting },
                            { label: 'Grades', value: r => r.d.G, format: formatCount },
                            { label: 'Pairs stated', value: r => r.d.N, format: formatCount },
                            { label: 's=N/M', value: r => r.d.s, format: formatShare },
                            { label: 'DR', value: 'DR', format: formatShare },
                            { label: 'E/N', value: r => r.ev.EoverN[0], format: formatShare },
                            { label: 'Risk at own τ', value: r => r.ev.risk, format: v => formatRisk(v) },
                        ],
                        rows,
                    },
                    keyboard: {
                        data: rows,
                        x: 'lambda',
                        y: kind === 'G' ? r => r.d.G : kind === 'shares' ? r => r.d.s : kind === 'risk' ? r => r.ev.risk : r => r.ev.EoverN[0],
                        sort: false,
                        key: r => String(r.index),
                        label: 'Grid cards along λ. Use arrow keys to read every positive-grid card.',
                        title: tip,
                    },
                    marks,
                });
            }

            const tables = new WeakMap();
            let introModel = null;
            let isSettled = false;

            ctx.onCleanup(() => {
                progress.textContent = '';
                for (const slot of [Gchart, shares, en, risk, matrix]) slot.__prxChart?.handle.destroy();
                layers.delete(matrix);
            });

            function gridCache(model) {
                if (!grids.has(model)) grids.set(model, { all: [], rows: null });
                return grids.get(model);
            }

            function tableView(model) {
                if (!tables.has(model)) {
                    const labels = ['λ', 'Grades', 'N', 's=N/M', 'DR=E/M', 'E/N', 'Risk at own τ', 'All withheld τ'];
                    const body = h('tbody');
                    tables.set(model, {
                        body,
                        rows: [],
                        current: null,
                        node: h(
                            'table',
                            { class: 'kr-table kr-wide-table prx-sticky-first' },
                            h('caption', { text: 'Every archived row; λ zero is outside postrank’s positive-τ risk domain' }),
                            h('thead', {}, h('tr', {}, ...labels.map(text => h('th', { scope: 'col', text })))),
                            body,
                        ),
                    });
                }
                return tables.get(model);
            }

            function appendTableRows(view, all) {
                const end = Math.min(all.length, view.rows.length + 51);
                const fragment = ctx.doc.createDocumentFragment();
                while (view.rows.length < end) {
                    const r = all[view.rows.length];
                    const rFmt = v => formatRisk(v, { digits: riskDigits(r) });
                    const row = h(
                        'tr',
                        { 'data-prx-grid-row': String(r.index) },
                        ...[
                            [r.lambda, formatSetting],
                            [r.d.G, formatCount],
                            [r.d.N, formatCount],
                            [r.d.s, formatShare],
                            [r.DR, formatShare],
                            [r.ev.EoverN[0], formatShare],
                            [r.ev.risk, rFmt],
                            [r.tau === 0 ? null : r.tau, rFmt],
                        ].map(([v, f]) => h('td', {}, ro(ctx, null, v, f))),
                    );
                    view.rows.push(row);
                    fragment.append(row);
                }
                view.body.append(fragment);
            }

            function adjacentChangeLine(model, c) {
                if (!changes.has(c)) changes.set(c, c.index > 1 ? relationChange(model.grid.grade[c.index - 1], c.grade) : null);
                const ch = changes.get(c);
                return h(
                    'span',
                    { class: 'kr-lambda-change' },
                    ...(ch
                        ? [
                            'From λ = ', ro(ctx, 'chg-prev', model.grid.lambda[c.index - 1], formatSetting),
                            ': ', ro(ctx, 'chg-stated', ch.nNewDisclosed, formatCount), ' newly stated, ',
                            ro(ctx, 'chg-withheld', ch.nNewWithheld, formatCount), ' withheld, ',
                            ro(ctx, 'chg-reversed', ch.nReversed, formatCount), ' reversed.',
                        ]
                        : ['At the first positive λ: one grade.']),
                );
            }

            function showResult(model, c) {
                const first = Math.max(1, c.index - 2);
                history.replaceChildren(h('strong', { text: 'Recent archived cards' }),
                    ...Array.from({ length: c.index - first + 1 }, (_, offset) => {
                        const i = first + offset;
                        const grades = new Set(model.grid.grade[i]).size;
                        return h('div', {}, i === c.index ? 'Current λ ' : 'λ ', ro(ctx, null, model.grid.lambda[i], formatSetting),
                            ' · ', ro(ctx, null, grades, formatCount), grades === 1 ? ' grade' : ' grades');
                    }));
                if (c.index > 1) {
                    const previous = model.grid.grade[c.index - 1];
                    const change = relationChange(previous, c.grade);
                    const pair = change.pairs[0];
                    if (pair) {
                        const describe = grade => grade[pair.i] === grade[pair.j] ? 'withheld'
                            : model.names[grade[pair.i] < grade[pair.j] ? pair.i : pair.j] + ' above ' + model.names[grade[pair.i] < grade[pair.j] ? pair.j : pair.i];
                        history.append(h('p', {}, model.names[pair.i], ' / ', model.names[pair.j], ' · Previous: ', describe(previous),
                            '. Current: ', describe(c.grade), '.'));
                    } else history.append(h('p', { text: 'Every pair keeps its previous relation.' }));
                }

                const rFmt = c.d.N > 0
                    ? v => formatDistinguishing(v, c.tau, { minSig: 3 })
                    : formatReadoutRisk;
                const tFmt = c.d.N > 0
                    ? v => formatDistinguishing(v, c.ev.risk, { minSig: 3 })
                    : formatReadoutRisk;
                fullReadout.replaceChildren(
                    'At λ = ', ro(ctx, null, c.lambda, formatSetting),
                    ' (τ = ', ro(ctx, null, c.tau, tFmt), '), the card has ',
                    ro(ctx, null, c.d.G, formatCount), c.d.G === 1 ? ' grade and states ' : ' grades and states ',
                    ro(ctx, null, c.d.N, formatCount), ' of ', ro(ctx, null, model.M, formatCount),
                    ' pairs; risk ', ro(ctx, null, c.ev.risk, rFmt), '. ',
                    ...(c.d.N > 0 ? ['E/N = ', ro(ctx, null, c.ev.EoverN[0], formatShare), '. '] : ['E/N = NA: no disclosure. ']),
                    'DR = ', ro(ctx, 'ro-DR', c.DR, formatShare), '.',
                );
                ctx.readout.set([
                    h(
                        'span',
                        { class: 'kr-lambda-summary' },
                        'At λ = ', ro(ctx, 'ro-lambda', c.lambda, formatSetting),
                        ' (τ = ', ro(ctx, 'ro-tau', c.tau, tFmt), '), ',
                        ro(ctx, 'ro-G', c.d.G, formatCount), c.d.G === 1 ? ' grade states ' : ' grades state ',
                        ro(ctx, 'ro-N', c.d.N, formatCount), ' of ', ro(ctx, 'ro-M', model.M, formatCount),
                        ' pairs (risk ', ro(ctx, 'ro-risk', c.ev.risk, rFmt),
                        ', E/N = ', ...(c.d.N > 0 ? [ro(ctx, 'ro-EoverN', c.ev.EoverN[0], formatShare)] : ['NA: no disclosure']),
                        '). ',
                    ),
                    adjacentChangeLine(model, c),
                ]);
            }

            function drawNotes(model, rows) {
                const first = rows.find(r => r.d.G > 1);
                const i = first?.grade.indexOf(1);
                const topEstimate = model.estimate.indexOf(Math.max(...model.estimate));
                split.replaceChildren(
                    'First split: λ ', ro(ctx, 'first-lambda', first.lambda, formatSetting),
                    ', τ ', ro(ctx, 'first-tau', first.tau, formatSetting),
                    ', ', model.names[i], ' alone in grade 1, ', ro(ctx, 'first-sizes', first.d.sizes, formatSizes), '. ',
                    ...(i !== topEstimate
                        ? [
                            model.names[i], ' has SE ', ro(ctx, 'first-se', model.se[i], v => formatDecimal(v, { digits: 3 })),
                            ' versus ', ro(ctx, 'top-se', model.se[topEstimate], v => formatDecimal(v, { digits: 3 })),
                            ' for ', model.names[topEstimate], '. KRW (§VI) explain the race reversal by AutoNation’s larger standard error.',
                        ]
                        : ['This firm also has the largest estimate.']),
                    ' At small λ, silence is cheap: many uncertain pairs can stay within one grade. Separating one firm above the other ',
                    ro(ctx, 'first-other-firms', model.n - 1, formatCount),
                    ' firms states every one of those directions at once, so its posterior must be sufficiently clear of the others for that tradeoff. The split comes from the archive, where KRW selected the card using their original probabilities.',
                );
            }

            function drawPairNotes(model, c) {
                if (!pairErrors.has(c)) pairErrors.set(c, statedAbove(c.grade, model.E, { tau: .5 }));
                const aboveHalf = pairErrors.get(c);
                doubtful.replaceChildren(
                    h(
                        'p',
                        { class: 'kr-note' },
                        'Purples saturates at ', ro(ctx, null, .5, formatSetting), ': the darkest color includes larger errors. ',
                        ro(ctx, 'matrix-doubtful-count', aboveHalf.count, formatCount),
                        ' stated directions here are more likely wrong than right.',
                        ...(aboveHalf.count
                            ? [' Largest error ', ro(ctx, 'matrix-doubtful-max', Math.max(...aboveHalf.pairs.map(p => p.error)), formatProb), '. Their actual probabilities follow.']
                            : []),
                    ),
                    ...aboveHalf.pairs.map(p => h(
                        'p',
                        { class: 'kr-note' },
                        model.names[p.i], ' above ', model.names[p.j], ': wrong-direction probability ',
                        ro(ctx, `matrix-doubtful-error-${p.i}-${p.j}`, p.error, formatProb), '.',
                    )),
                );
                const names = blockOrder(model, c.grade, 'mean').filter(i => c.grade[i] === 1).map(i => model.names[i]);
                top.replaceChildren(
                    ...(c.d.G === 1
                        ? ['One grade: no directions stated.']
                        : [
                            'Grade 1: ',
                            h('b', { text: names.length <= 3 ? names.join(', ') : '' }),
                            ...(names.length > 3 ? [ro(ctx, null, names.length, formatCount), ' firms'] : []),
                            '.',
                        ]),
                );
            }

            function renderDataCharts(rows, c) {
                drawCurve(shares, rows, c, { kind: 'shares', title: 's = N/M, solid; DR = E/M, dashed vermillion', ylabel: 'Share of all pairs', domain: [0, 1] });
                drawCurve(en, rows, c, { kind: 'en', title: 'Expected wrong share among stated pairs; no value when nothing is stated', ylabel: 'E/N', domain: [0, .5] });
                drawCurve(risk, rows, c, { kind: 'risk', title: 'Solid: risk at each card’s own τ; dashed gray: all withheld at that τ', ylabel: 'Risk / all-withheld τ', domain: [0, .5] });
            }

            return {
                render(s, info = {}) {
                    if (info.reason === 'disclosure') {
                        if (info.disclosure === 'data' && isSettled) {
                            const model = readKrwModel(s.criterion);
                            const cache = gridCache(model);
                            const c = archiveSnapshot(model, s.lambda);
                            if (cache.rows) renderDataCharts(cache.rows, c);
                        }
                        return;
                    }

                    lambdaCtl.set(s.lambda);
                    sortCtl.set(s.sort);
                    criterionCtl.set(s.criterion);

                    const model = readKrwModel(s.criterion);
                    const cache = gridCache(model);
                    const c = archiveSnapshot(model, s.lambda);
                    showResult(model, c);

                    isSettled = false;
                    progress.textContent = 'Updating the complete grid and pair matrix…';

                    const view = tableView(model);
                    const steps = [];

                    let plannedAll = cache.all.length;
                    const totalGrid = model.grid.lambda.length;
                    while (plannedAll < totalGrid) {
                        steps.push(() => ctx.keepFocus(() => {
                            const end = Math.min(totalGrid, cache.all.length + 34);
                            while (cache.all.length < end) {
                                cache.all.push(archiveSnapshot(model, model.grid.lambda[cache.all.length]));
                            }
                            if (cache.all.length === totalGrid && !cache.rows) {
                                cache.rows = cache.all.filter(r => r.tau > 0);
                            }
                        }));
                        plannedAll += 34;
                    }

                    steps.push(() => ctx.keepFocus(() => {
                        const { all, rows } = cache;
                        drawCurve(Gchart, rows, c, {
                            kind: 'G',
                            title: 'Number of grades of each archived card on a log scale; current card ringed',
                            ylabel: 'Grades G (log scale)',
                            domain: [1, 100],
                            log: true,
                        });
                        headerView.render(model, c);
                        if (introModel !== model) {
                            intro.replaceChildren(
                                'The grid has ', ro(ctx, 'grid-count', all.length, formatCount),
                                ' cards, one per λ from ', ro(ctx, null, 0, formatCount),
                                ' to ', ro(ctx, null, 1, formatCount),
                                ' in steps of ', ro(ctx, null, .01, formatSetting),
                                '; charts start at the first positive λ.',
                            );
                            drawNotes(model, rows);
                            introModel = model;
                        }
                    }));

                    steps.push(() => ctx.keepFocus(() => {
                        drawStatedErrorMatrix(ctx, matrix, model, c, { sort: s.sort });
                        drawPairNotes(model, c);
                    }));

                    let plannedTableRows = view.rows.length;
                    while (plannedTableRows < totalGrid) {
                        steps.push(() => ctx.keepFocus(() => {
                            if (view.node.parentNode !== table) table.replaceChildren(view.node);
                            appendTableRows(view, cache.all);
                        }));
                        plannedTableRows += 51;
                    }

                    steps.push(() => ctx.keepFocus(() => {
                        drawCurve(shares, cache.rows, c, { kind: 'shares', title: 's = N/M, solid; DR = E/M, dashed vermillion', ylabel: 'Share of all pairs', domain: [0, 1] });
                        drawCurve(en, cache.rows, c, { kind: 'en', title: 'Expected wrong share among stated pairs; no value when nothing is stated', ylabel: 'E/N', domain: [0, .5] });
                    }));

                    steps.push(() => ctx.keepFocus(() => {
                        drawCurve(risk, cache.rows, c, { kind: 'risk', title: 'Solid: risk at each card’s own τ; dashed gray: all withheld at that τ', ylabel: 'Risk / all-withheld τ', domain: [0, .5] });
                        if (view.node.parentNode !== table) table.replaceChildren(view.node);
                        view.current?.removeAttribute('aria-current');
                        view.current = view.rows[c.index];
                        view.current?.setAttribute('aria-current', 'true');
                        progress.textContent = '';
                        isSettled = true;
                    }));

                    ctx.scheduleStages(steps, { yieldMs: 12 });
                },
            };
        },
    });
}
