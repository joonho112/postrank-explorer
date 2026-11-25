import { appLink, createWidget } from '../shared/base.js';
import { readQuery } from '../shared/bridge.js';
import ABS from '../../data/released/krw-absolute-gender.json' with { type: 'json' };
import { expectedRank, fixedOrderDP, disclosure, evaluateReport, relationChange, scoreOrder } from '../pr-core.js';
import {
    formatCount,
    formatPercent,
    formatDecimal,
    formatGrades,
    formatReadoutEst,
    formatReadoutRisk,
    formatRisk,
    formatShare,
    formatSizes,
    formatSci,
} from '../shared/format.js';
import { plot, numText, gradeColors, labelOn, placeDirectLabels } from '../shared/chart.js';
import { tagNode, labelNode } from '../shared/labels.js';
import {
    KRW_COMMON_CSS,
    createKrwCardView,
    createKrwPrecisionView,
    readKrwModel,
    publishedCardMatches,
    ro,
    shortName,
    appendKrwNotice,
} from '../shared/domain/krw.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const cache = new Map();
const VIEWS = Object.freeze(['cards', 'pairs', 'firms']);

export function signedAbsoluteModel() {
    if (cache.has('model')) return cache.get('model');
    const signed = readKrwModel('gender');
    const a = ABS.arrays.error;
    const u = ABS.tables.units;
    if (a.ids.length !== signed.n || a.ids.some((id, i) => id !== signed.ids[i] || u.id[i] !== id)) {
        throw new Error('The signed and folded KRW firm IDs do not match');
    }
    const folded = {
        ...signed,
        criterion: 'absolute',
        target: 'gender_absolute',
        E: a,
        e: a.e[0],
        mean: u.mean.slice(),
        lower: u.lower.slice(),
        upper: u.upper.slice(),
    };
    const reports = [signed, folded].map(model => {
        const rank = expectedRank(model.E);
        const order = scoreOrder(rank, { direction: 'ascending' }).order;
        const opt = fixedOrderDP(model.E, { scores: rank, direction: 'ascending', G: 4, tau: .2, tieTol: 1e-12, maxTies: 100 });
        const ev = evaluateReport(opt.grade, model.E, { tau: .2 });
        return { model, rank, order, opt, c: { grade: opt.grade, d: disclosure(opt.grade), ev, tau: .2, DR: ev.EoverM[0] } };
    });
    const change = relationChange(reports[0].c.grade, reports[1].c.grade);
    const result = { signed: reports[0], absolute: reports[1], change };
    cache.set('model', result);
    return result;
}

const relation = (r, i, j, names) =>
    r === 'withheld' ? 'withheld' : r === 'above' ? `${names[i]} above ${names[j]}` : `${names[j]} above ${names[i]}`;

const SOA_CSS = `
.prx-soa.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls:empty { display: none; }
.prx-soa .kr-wide-table { min-width: 60rem; }
.prx-soa .kr-scroll table caption { text-align: left; }
.prx-soa .prx-stage .kr-soa-ranks { margin: 0; padding: 0; border: 0; background: var(--prx-plot-bg); color: var(--prx-plot-fg); }
.prx-soa .prx-stage .kr-soa-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .2rem .8rem; margin: 0 0 .25rem; }
.prx-soa .prx-stage .kr-soa-ranks h4 { margin: 0; font-size: .95rem; color: var(--prx-plot-fg); }
.prx-soa .prx-stage .kr-soa-key { display: flex; flex-wrap: wrap; align-items: center; gap: .2rem .65rem; font-size: .8125rem; margin: 0; line-height: 1.3; color: var(--prx-plot-muted); }
.prx-soa .prx-stage .kr-soa-key-item { display: inline-flex; align-items: center; gap: .32rem; }
.prx-soa .prx-stage .kr-soa-line-sw { display: inline-block; width: 1.25rem; height: 0; vertical-align: middle; }
.prx-soa .prx-stage .kr-soa-line-sw[data-kind="female"] { border-top: 2.2px dashed var(--prx-crit-ink-1); }
.prx-soa .prx-stage .kr-soa-line-sw[data-kind="male"] { border-top: 2.2px solid var(--prx-crit-ink-2); }
.prx-soa .prx-stage .kr-soa-line-sw[data-kind="same"] { border-top: 1.5px solid var(--prx-neutral-4); opacity: .55; }
.prx-soa .prx-stage .kr-soa-meta { display: grid; gap: .18rem; margin-top: .3rem; padding-top: .3rem; border-top: 1px solid var(--prx-plot-grid); }
.prx-soa .prx-stage .kr-soa-detail { font-size: .835rem; line-height: 1.35; margin: 0; color: var(--prx-plot-fg); }
.prx-soa .prx-stage .kr-soa-detail-sub { color: var(--prx-plot-muted); }
.prx-soa .prx-stage .kr-soa-detail-sub b { color: var(--prx-plot-fg); }
.prx-soa .kr-soa-filter { margin: .35rem 0 .45rem; }
.prx-soa .prx-stage .kr-soa-filter .prx-seg[aria-pressed="true"] { background: var(--prx-plot-fg); color: var(--prx-plot-bg); border-color: var(--prx-plot-fg); }
.prx-soa .prx-stage .kr-soa-view-title { font-size: .95rem; margin: 0 0 .3rem; color: var(--prx-plot-fg); }
.prx-soa .kr-computed-info { font-size: .82rem; line-height: 1.35; }
.prx-soa .kr-cards-stack { display: grid; gap: .65rem; min-width: 0; }
.prx-soa .kr-grid > * { min-width: 0; }
.prx-soa .kr-cards-stack .kr-grid > .kr-box { margin: 0; }
.prx-soa [data-prx-disclosure="precision"] .kr-grid { grid-template-columns: minmax(0, 1fr); }
.prx-soa details > summary { min-height: var(--prx-control-height, 2.25rem); display: list-item; align-content: center; cursor: pointer; }
@media (pointer: coarse), (max-width: 48em) {
  .prx-soa.prx-widget[data-prx-frame="v2"] .prx-stage { padding: .45rem .35rem; }
  .prx-soa .prx-stage .kr-cards-stack .kr-box { padding: .35rem .25rem; }
  .prx-soa.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: .2rem .48rem;
    font-size: .8125rem;
    min-height: var(--prx-touch-target, 2.75rem);
  }
  .prx-soa details > summary,
  .prx-soa .prx-stage .kr-soa-filter .prx-seg {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
`;

const changeType = p => (p.from === 'withheld' ? 'stated' : p.to === 'withheld' ? 'withheld' : 'reversed');

function estimatePillWidth(str) {
    let w = 0;
    for (const ch of String(str ?? '')) {
        if ("ilI1.,:;'!| ".includes(ch)) w += 3.9;
        else if ('tfjJr/()[]{}'.includes(ch)) w += 4.8;
        else if ('mwMW'.includes(ch)) w += 10.6;
        else if (ch >= 'A' && ch <= 'Z') w += 8.6;
        else w += 7.3;
    }
    return Math.max(24, Math.ceil(w * 1.05 + 12));
}

function clampPillX(rawPx, anchor, pillW, dims, edgePad = 4) {
    const minLeft = edgePad;
    const maxRight = dims.width - edgePad;
    if (anchor === 'end') return Math.min(maxRight - 6, Math.max(minLeft + pillW - 6, rawPx));
    if (anchor === 'middle') return Math.max(minLeft + pillW / 2, Math.min(maxRight - pillW / 2, rawPx));
    return Math.max(minLeft + 6, Math.min(maxRight - pillW + 6, rawPx));
}

function buildRankRows(reports) {
    const positions = reports.map(r => {
        const ordered = [...r.order].sort((i, j) => r.c.grade[i] - r.c.grade[j]);
        return new Map(ordered.map((i, j) => [i, j + .5]));
    });
    return reports[0].order.map(i => ({
        i,
        signed: positions[0].get(i),
        absolute: positions[1].get(i),
        before: reports[0].c.grade[i],
        after: reports[1].c.grade[i],
        positive: reports[0].model.mean[i] >= 0,
    }));
}

export function mountWidget(el, spec = {}) {
    let chooseCards;
    let refreshView;
    const handle = createWidget(el, spec, {
        name: 'signed-or-absolute',
        frame: 'v2',
        className: 'prx-kr prx-rc prx-soa',
        css: KRW_COMMON_CSS + SOA_CSS,
        label: 'The signed gender gap versus its absolute size under their exact released posterior laws',
        keys: { view: { type: 'choice', values: VIEWS, value: 'cards' } },
        build(ctx) {
            const { h } = ctx;
            const view = ctx.radioGroup({
                legend: 'Inspect',
                name: 'view',
                options: [
                    { value: 'cards', label: 'Both report cards' },
                    { value: 'pairs', label: 'Every changed pair' },
                    { value: 'firms', label: 'All firm summaries and orders' },
                ],
                value: ctx.state.view,
                onChange: v => {
                    if (v === 'cards') showFull = true;
                    ctx.set({ view: v });
                },
            });

            const route = spec.query === false ? null : readQuery({ allowed: ['view'], types: { view: VIEWS }, window: ctx.win });
            let showFull = spec.view === 'cards' || spec.preset === 'cards' || route?.spec.view === 'cards' || route?.preset === 'cards';
            let selectingLinks = false;
            let chosenCards = false;

            chooseCards = () => {
                if (selectingLinks || showFull) return false;
                showFull = true;
                return true;
            };

            const linkedBtn = h('button', {
                type: 'button',
                class: 'prx-seg',
                'data-prx-focus-key': 'linked-ranks',
                'data-value': 'linked',
                'aria-pressed': String(!showFull),
                onClick: () => {
                    showFull = false;
                    chosenCards = false;
                    if (ctx.state.view === 'cards') ctx.requestRender('linked');
                    else {
                        selectingLinks = true;
                        try { ctx.set({ view: 'cards' }); } finally { selectingLinks = false; }
                    }
                },
            }, 'Linked ranks');
            ctx.primaryControl(linkedBtn);
            const presetButtonsWrap = ctx.presets?.querySelector('.prx-seg-buttons');
            if (presetButtonsWrap) presetButtonsWrap.prepend(linkedBtn);
            else ctx.controls.append(linkedBtn);

            const syncShownPreset = () => {
                const isLinked = ctx.state.view === 'cards' && !chosenCards;
                if (linkedBtn.getAttribute('aria-pressed') !== String(isLinked)) {
                    linkedBtn.setAttribute('aria-pressed', String(isLinked));
                }
                const cardsBtn = ctx.presets?.querySelector('button[data-value="cards"]');
                if (cardsBtn && !chosenCards && cardsBtn.getAttribute('aria-pressed') === 'true') {
                    cardsBtn.setAttribute('aria-pressed', 'false');
                }
            };
            if (ctx.presets) {
                const pressed = new ctx.win.MutationObserver(syncShownPreset);
                pressed.observe(ctx.presets, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
                ctx.onCleanup(() => pressed.disconnect());
            }

            const header = h('section', { class: 'kr-header' });
            const left = h('section');
            const right = h('section');
            const leftDetails = h('div', { class: 'kr-box prx-light-panel' });
            const rightDetails = h('div', { class: 'kr-box prx-light-panel' });
            const leftBetween = h('div');
            const rightBetween = h('div');
            const leftVectors = h('div', { class: 'kr-box prx-light-panel kr-note' });
            const rightVectors = h('div', { class: 'kr-box prx-light-panel kr-note' });
            const cards = h(
                'div',
                { class: 'kr-cards-stack' },
                h('div', { class: 'kr-grid' }, left, right),
                h('div', { class: 'kr-grid' }, leftDetails, rightDetails),
                h('div', { class: 'kr-grid' }, leftBetween, rightBetween),
                h('div', { class: 'kr-grid' }, leftVectors, rightVectors),
            );

            const pairs = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'Every pair whose report relation changes across targets');
            const firms = ctx.scrollRegion(h('div', { class: 'kr-scroll kr-table-wrap' }), 'All firms, their exact supplied summaries, expected ranks and grades');

            const precision = h('div', { class: 'kr-grid' });
            const signedPrecision = h('section');
            const absolutePrecision = h('section');
            precision.append(signedPrecision, absolutePrecision);

            let precisionInspection = null;
            const precisionViews = [signedPrecision, absolutePrecision].map((slot, side) => createKrwPrecisionView(ctx, slot, {
                prefix: side ? 'absolute' : 'signed',
                onInspect(row) {
                    if (precisionBox.open) {
                        precisionInspection = { ...row, side };
                        writeSummary();
                    }
                },
            }));

            const scrollHint = h('p', { class: 'kr-note', text: 'The complete tables scroll sideways. Focus a table region and use arrow keys to reach every column.' });
            const chart = h('div');
            const picked = h('p', { class: 'kr-soa-detail' });
            const anchorExtra = h('p', { class: 'kr-soa-detail kr-soa-detail-sub' });
            const ranks = h(
                'section',
                { class: 'kr-soa-ranks prx-light-panel' },
                h(
                    'div',
                    { class: 'kr-soa-head' },
                    h('h4', { text: 'Same firms, two rankings' }),
                    h(
                        'p',
                        { class: 'kr-soa-key', 'data-prx-part': 'legend' },
                        h('span', { class: 'kr-soa-key-item' }, h('span', { class: 'kr-soa-line-sw', 'data-kind': 'female', 'aria-hidden': 'true' }), 'Female-name advantage (changed)'),
                        h('span', { class: 'kr-soa-key-item' }, h('span', { class: 'kr-soa-line-sw', 'data-kind': 'male', 'aria-hidden': 'true' }), 'Male-name advantage (changed)'),
                        h('span', { class: 'kr-soa-key-item' }, h('span', { class: 'kr-soa-line-sw', 'data-kind': 'same', 'aria-hidden': 'true' }), 'Unchanged grade'),
                    ),
                ),
                chart,
                h('div', { class: 'kr-soa-meta' }, picked, anchorExtra),
            );

            const filter = ctx.segmented({
                name: 'pair-type',
                label: 'Show changed pairs',
                value: 'all',
                options: [
                    { value: 'all', label: 'All' },
                    { value: 'reversed', label: 'Reversed' },
                    { value: 'stated', label: 'Newly stated' },
                    { value: 'withheld', label: 'Newly withheld' },
                ],
                onChange: v => {
                    pairType = v;
                    filter.set(v);
                    sortPairView();
                    if (data) writeSummary();
                },
            });
            filter.root.classList.add('kr-soa-filter');

            const pairView = h('section', {}, h('h4', { class: 'kr-soa-view-title', text: 'Complete list of changed unordered pairs' }), filter.root, pairs);
            const firmTitle = h('h4', { class: 'kr-soa-view-title' });
            const firmView = h('section', {}, firmTitle, firms);

            const method = ctx.methodBox('Method, exact families and report controls');
            const precisionBox = ctx.disclosure({ name: 'precision', title: 'Original precision and full firm data' });
            const fullReadout = h('p', { class: 'kr-note' });

            const pairPreview = h('p', { class: 'kr-note', 'data-prx-readout': 'target-changed-pair' });
            ctx.stage.append(ranks, cards, pairPreview, scrollHint, pairView, firmView);
            method.body.append(header, fullReadout, view.root);
            precisionBox.body.append(precision);

            const renderers = [
                createKrwCardView(ctx, left, { detailsTarget: leftDetails, betweenTarget: leftBetween, onPick: i => pick(i) }),
                createKrwCardView(ctx, right, { detailsTarget: rightDetails, betweenTarget: rightBetween, onPick: i => pick(i) }),
            ];
            let scrollFrom = null;
            renderers.forEach((r, k) => ctx.listen(r.scroll, 'scroll', () => {
                const other = renderers[1 - k].scroll;
                if (r.scroll === scrollFrom) { scrollFrom = null; return; }
                if (other.scrollTop === r.scroll.scrollTop) return;
                scrollFrom = other;
                other.scrollTop = r.scroll.scrollTop;
            }, { passive: true }));

            appendKrwNotice(ctx);

            let data;
            let both;
            let names;
            let pairBody;
            let firmBody;
            const painted = [null, null, null, null];
            let rankRows;
            let rankStamp;
            let selected;
            let pairType = 'all';
            let honeywellIdx = 46;
            let ascenaIdx = 92;

            const fmt = x => formatDecimal(x, { digits: 3 });
            const title = row => [
                names[row.i],
                ...both.map((r, k) => `${k ? 'Absolute' : 'Signed'} grade ${formatCount(r.c.grade[row.i])} · ${fmt(r.model.mean[row.i])} [${fmt(r.model.lower[row.i])}, ${fmt(r.model.upper[row.i])}]`),
            ].join('\n');

            const pick = i => {
                if (!Number.isInteger(i) || i === selected) return;
                selected = i;
                precisionInspection = null;
                ctx.requestRender('pick');
            };

            const renderFirmLine = (targetEl, unitIdx) => {
                targetEl.replaceChildren(
                    h('b', { text: names[unitIdx] }),
                    ...both.map((r, k) => h(
                        'span',
                        {},
                        k ? ' · Absolute grade ' : ' · Signed grade ',
                        ro(ctx, null, r.c.grade[unitIdx], formatCount),
                        ': ',
                        ro(ctx, null, r.model.mean[unitIdx], fmt),
                        ' [',
                        ro(ctx, null, r.model.lower[unitIdx], fmt),
                        ', ',
                        ro(ctx, null, r.model.upper[unitIdx], fmt),
                        ']',
                    )),
                );
            };

            const renderRanks = () => {
                const n = names.length;
                const width = Math.max(260, Math.round(chart.clientWidth || ctx.stage.clientWidth || ctx.width()));
                const narrow = width < 480;
                const height = narrow ? 280 : 310;
                const marginTop = 34;
                const marginBottom = 10;
                const marginLeft = 52;
                const marginRight = 52;
                const innerH = Math.max(1, height - marginTop - marginBottom);
                const yToPx = yVal => marginTop + (yVal / n) * innerH;

                const bandRows = both.flatMap((r, side) => {
                    let cursor = 0;
                    const sideBands = r.c.d.sizes.map((size, idx) => {
                        const mid = cursor + size / 2;
                        const rawPy = yToPx(mid);
                        const band = {
                            id: `${side}-${idx + 1}`,
                            side,
                            g: idx + 1,
                            y1: cursor,
                            y2: cursor + size,
                            mid,
                            rawPy,
                            lane: 0,
                        };
                        cursor += size;
                        return band;
                    });
                    if (sideBands.length >= 2 && sideBands[1].rawPy - sideBands[0].rawPy < 19) {
                        sideBands[1].lane = 1;
                    }
                    const placedById = new Map();
                    for (const lane of [0, 1]) {
                        const laneBands = sideBands.filter(b => b.lane === lane);
                        if (!laneBands.length) continue;
                        const hasOuterStagger = lane === 0 && sideBands.some(b => b.lane === 1);
                        const placed = placeDirectLabels(
                            laneBands.map(b => ({
                                id: b.id,
                                y: hasOuterStagger && b.g === 1 ? Math.min(b.rawPy, marginTop - 4.5) : b.rawPy,
                            })),
                            {
                                minGapPx: 18,
                                bounds: [lane === 0 ? marginTop - 5 : marginTop + 2, height - marginBottom - 8],
                            },
                        );
                        for (const p of placed) placedById.set(p.id, p.y);
                    }
                    return sideBands.map(b => ({ ...b, placedPxY: placedById.get(b.id) ?? b.rawPy }));
                });
                const bandCuts = bandRows.filter(b => b.y1 > 0);

                const activeRow = rankRows.find(d => d.i === selected)
                    ?? rankRows.find(d => d.i === honeywellIdx)
                    ?? rankRows.find(d => d.before !== d.after)
                    ?? rankRows[0];
                const secondAnchorIdx = activeRow.i === ascenaIdx ? honeywellIdx : ascenaIdx;
                renderFirmLine(picked, activeRow.i);
                renderFirmLine(anchorExtra, secondAnchorIdx);

                const unchanged = rankRows.filter(d => d.before === d.after);
                const changedMale = rankRows.filter(d => d.before !== d.after && d.positive);
                const changedFemale = rankRows.filter(d => d.before !== d.after && !d.positive);
                const changedAll = rankRows.filter(d => d.before !== d.after);

                const anchorIds = [...new Set([honeywellIdx, ascenaIdx, activeRow.i])];
                const anchorRows = anchorIds.map(idx => rankRows.find(d => d.i === idx)).filter(Boolean);
                const secondaryAnchors = anchorRows.filter(d => d.i !== activeRow.i);

                const labelX = 0.16;
                const rawLabelItems = anchorRows.map(d => {
                    const anchorY = d.signed + labelX * (d.absolute - d.signed);
                    return {
                        ...d,
                        id: String(both[0].model.ids[d.i]),
                        labelText: shortName(names[d.i]),
                        x: labelX,
                        anchorY,
                        rawPy: yToPx(anchorY),
                        isActive: d.i === activeRow.i,
                    };
                });
                const placedLabels = placeDirectLabels(
                    rawLabelItems.map(item => ({ id: item.id, y: item.rawPy })),
                    { minGapPx: 21, bounds: [marginTop + 12, height - marginBottom - 12] },
                );
                const placedLabelById = new Map(placedLabels.map(p => [p.id, p.y]));
                const labelItems = rawLabelItems.map(item => {
                    const py = placedLabelById.get(item.id) ?? item.rawPy;
                    return { ...item, placedPy: py, placedY: ((py - marginTop) / innerH) * n, shifted: Math.abs(py - item.rawPy) > 3.5 };
                });

                const headers = [
                    { x: -.038, label: 'Signed grades', anchor: 'start', dx: -45 },
                    { x: 1.038, label: 'Absolute grades', anchor: 'end', dx: 45 },
                ];

                plot(chart, {
                    width,
                    height,
                    marginLeft,
                    marginRight,
                    marginTop,
                    marginBottom,
                    x: { domain: [-.08, 1.08], axis: null },
                    y: { domain: [n, 0], axis: null },
                    color: { type: 'identity' },
                    alt: 'Two axes show the signed and absolute expected-rank orders within their grade bands. Select any firm to read both supplied central posterior intervals.',
                    keyboard: {
                        data: rankRows,
                        x: () => 0,
                        y: 'signed',
                        key: d => both[0].model.ids[d.i],
                        sort: false,
                        label: 'Firms by signed expected rank; use the arrows to compare both intervals',
                        title,
                        pointer: true,
                        pointerRadius: 40,
                        onSelect: d => pick(d.i),
                    },
                    marks: (k, P) => {
                        const colors = gradeColors(Math.max(...both.map(r => r.c.d.G)), k);
                        const strokeFor = d => (d.positive ? k.critInk[1] : k.critInk[0]);
                        const renderGradeBadges = side => {
                            const items = bandRows.filter(d => d.side === side);
                            return numText(items, {
                                x: 'side',
                                y: 'mid',
                                value: 'g',
                                format: formatCount,
                                fontSize: 13,
                                fontWeight: 700,
                                fill: d => labelOn(colors[d.g - 1], k),
                                render(index, scales, values, dims, context, next) {
                                    const g = next(index, scales, values, dims, context);
                                    g.removeAttribute('transform');
                                    const bandOuterPx = scales.x(side ? 1.038 : -.038);
                                    const texts = [...g.querySelectorAll('text')];
                                    Array.from(index).forEach((i, j) => {
                                        const tNode = texts[j];
                                        const d = items[i];
                                        if (!tNode || !d) return;
                                        const pw = 18;
                                        const ph = 16;
                                        const offset = d.lane === 1 ? 36 : 14;
                                        const rawPx = bandOuterPx + (side ? offset : -offset);
                                        const px = Math.max(pw / 2 + 2, Math.min(dims.width - pw / 2 - 2, rawPx));
                                        const py = d.placedPxY;
                                        tNode.removeAttribute('transform');
                                        tNode.removeAttribute('dx');
                                        tNode.removeAttribute('dy');
                                        tNode.setAttribute('x', px.toFixed(1));
                                        tNode.setAttribute('y', py.toFixed(1));
                                        tNode.setAttribute('dominant-baseline', 'central');
                                        tNode.setAttribute('text-anchor', 'middle');
                                        tNode.style.textAnchor = 'middle';
                                        if (d.lane === 1 || Math.abs(py - d.rawPy) > 2.5) {
                                            const tick = context.document.createElementNS(SVG_NS, 'line');
                                            const xFrom = side ? px - pw / 2 : px + pw / 2;
                                            const xTo = bandOuterPx + (side ? 1 : -1);
                                            tick.setAttribute('x1', xFrom.toFixed(1));
                                            tick.setAttribute('y1', py.toFixed(1));
                                            tick.setAttribute('x2', xTo.toFixed(1));
                                            tick.setAttribute('y2', d.rawPy.toFixed(1));
                                            tick.setAttribute('stroke', k.plotFg);
                                            tick.setAttribute('stroke-opacity', '0.55');
                                            tick.setAttribute('stroke-width', '1.2');
                                            tNode.before(tick);
                                        }
                                        const rect = context.document.createElementNS(SVG_NS, 'rect');
                                        rect.setAttribute('x', (px - pw / 2).toFixed(1));
                                        rect.setAttribute('y', (py - ph / 2).toFixed(1));
                                        rect.setAttribute('width', String(pw));
                                        rect.setAttribute('height', String(ph));
                                        rect.setAttribute('rx', '3');
                                        rect.setAttribute('fill', colors[d.g - 1]);
                                        rect.setAttribute('stroke', k.plotBg);
                                        rect.setAttribute('stroke-width', '1');
                                        tNode.before(rect);
                                    });
                                    return g;
                                },
                            });
                        };

                        const renderAnchorPills = P.text(labelItems, {
                            x: 'x',
                            y: 'anchorY',
                            text: 'labelText',
                            fontSize: 13,
                            fontWeight: 700,
                            fill: d => (d.isActive ? k.plotFg : strokeFor(d)),
                            render(index, scales, values, dims, context, next) {
                                const g = next(index, scales, values, dims, context);
                                g.removeAttribute('transform');
                                const texts = [...g.querySelectorAll('text')];
                                Array.from(index).forEach((i, j) => {
                                    const tNode = texts[j];
                                    const d = labelItems[i];
                                    if (!tNode || !d) return;
                                    const anchor = 'start';
                                    const pw = estimatePillWidth(d.labelText);
                                    const ph = 18;
                                    const px = clampPillX(values.x[i] + 8, anchor, pw, dims);
                                    const py = placedLabelById.get(d.id) ?? values.y[i];
                                    tNode.removeAttribute('transform');
                                    tNode.removeAttribute('dx');
                                    tNode.removeAttribute('dy');
                                    tNode.setAttribute('x', px.toFixed(1));
                                    tNode.setAttribute('y', py.toFixed(1));
                                    tNode.setAttribute('dominant-baseline', 'central');
                                    tNode.setAttribute('text-anchor', anchor);
                                    tNode.style.textAnchor = anchor;
                                    const rect = context.document.createElementNS(SVG_NS, 'rect');
                                    rect.setAttribute('x', (px - 6).toFixed(1));
                                    rect.setAttribute('y', (py - ph / 2).toFixed(1));
                                    rect.setAttribute('width', String(pw));
                                    rect.setAttribute('height', String(ph));
                                    rect.setAttribute('rx', '3');
                                    rect.setAttribute('fill', k.plotBg);
                                    rect.setAttribute('stroke', d.isActive ? k.plotFg : strokeFor(d));
                                    rect.setAttribute('stroke-width', d.isActive ? '1.35' : '1');
                                    tNode.before(rect);
                                });
                                return g;
                            },
                        });

                        return [
                            P.rect(bandRows, {
                                x1: d => d.side - .038,
                                x2: d => d.side + .038,
                                y1: 'y1',
                                y2: 'y2',
                                fill: d => colors[d.g - 1],
                                fillOpacity: .24,
                                inset: .4,
                            }),
                            P.ruleY(bandCuts, {
                                y: 'y1',
                                x1: d => d.side - .042,
                                x2: d => d.side + .042,
                                stroke: k.plotBg,
                                strokeWidth: 1.5,
                            }),
                            P.link(unchanged, {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: k.neutral[4],
                                strokeWidth: .75,
                                strokeOpacity: .18,
                            }),
                            P.link(changedMale, {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: k.critInk[1],
                                strokeWidth: 2.0,
                                strokeOpacity: .9,
                            }),
                            P.link(changedFemale, {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: k.critInk[0],
                                strokeWidth: 2.1,
                                strokeOpacity: .92,
                                strokeDasharray: '5.5,2.8',
                            }),
                            P.dot(changedAll, { x: 0, y: 'signed', fill: strokeFor, r: 2.4 }),
                            P.dot(changedAll, { x: 1, y: 'absolute', fill: strokeFor, r: 2.4 }),
                            P.link(secondaryAnchors, {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: k.plotBg,
                                strokeWidth: 4.0,
                                strokeOpacity: .8,
                            }),
                            P.link(secondaryAnchors, {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: strokeFor,
                                strokeWidth: 2.5,
                                strokeDasharray: d => (d.positive ? undefined : '5.5,2.8'),
                            }),
                            P.dot(secondaryAnchors, { x: 0, y: 'signed', fill: strokeFor, stroke: k.plotBg, strokeWidth: 1.2, r: 3.8 }),
                            P.dot(secondaryAnchors, { x: 1, y: 'absolute', fill: strokeFor, stroke: k.plotBg, strokeWidth: 1.2, r: 3.8 }),
                            P.link([activeRow], { x1: 0, x2: 1, y1: 'signed', y2: 'absolute', stroke: k.plotBg, strokeWidth: 4.5, strokeOpacity: .85 }),
                            P.link([activeRow], {
                                x1: 0,
                                x2: 1,
                                y1: 'signed',
                                y2: 'absolute',
                                stroke: k.plotFg,
                                strokeWidth: 2.7,
                                ...(activeRow.positive ? {} : { strokeDasharray: '6,2.8' }),
                            }),
                            P.dot([activeRow], { x: 0, y: 'signed', fill: strokeFor, stroke: k.plotFg, strokeWidth: 1.5, r: 4.3 }),
                            P.dot([activeRow], { x: 1, y: 'absolute', fill: strokeFor, stroke: k.plotFg, strokeWidth: 1.5, r: 4.3 }),
                            P.link(labelItems.filter(d => d.shifted), {
                                x1: 'x',
                                y1: 'anchorY',
                                x2: 'x',
                                y2: 'placedY',
                                stroke: d => (d.isActive ? k.plotFg : strokeFor(d)),
                                strokeWidth: 1,
                                strokeOpacity: .7,
                            }),
                            P.dot(labelItems, {
                                x: 'x',
                                y: 'anchorY',
                                fill: d => (d.isActive ? k.plotFg : strokeFor(d)),
                                stroke: k.plotBg,
                                strokeWidth: 1,
                                r: 2.8,
                            }),
                            renderAnchorPills,
                            renderGradeBadges(0),
                            renderGradeBadges(1),
                            ...headers.map(hd => P.text([hd], {
                                x: 'x',
                                y: 0,
                                dx: hd.dx,
                                dy: -20,
                                text: 'label',
                                textAnchor: hd.anchor,
                                fill: k.plotFg,
                                fontSize: 13,
                                fontWeight: 700,
                            })),
                        ];
                    },
                });
                chart.querySelectorAll('.prx-kbd-point').forEach((point, i) =>
                    point.addEventListener('click', e => {
                        if (e.detail === 0) pick(rankRows[i].i);
                    }),
                );
            };

            const prepare = () => {
                if (data) return;
                data = signedAbsoluteModel();
                both = [data.signed, data.absolute];
                names = data.signed.model.names;
                rankRows = buildRankRows(both);
                const hw = names.findIndex(nm => nm === 'Honeywell');
                if (hw >= 0) honeywellIdx = hw;
                const asc = names.findIndex(nm => nm.startsWith('Ascena'));
                if (asc >= 0) ascenaIdx = asc;

                firmTitle.replaceChildren('All firms in released ID order · ', ro(ctx, null, names.length, formatCount));
                const matches = publishedCardMatches(data.signed.model, data.signed.c.grade);
                ['reversed', 'stated', 'withheld'].forEach((type, j) =>
                    filter.buttons[j + 1].append(
                        ' ',
                        ro(ctx, null, [data.change.nReversed, data.change.nNewDisclosed, data.change.nNewWithheld][j], formatCount),
                    ),
                );
                header.replaceChildren(
                    h('h4', { text: 'Two targets, each with its own declared expected-rank order' }),
                    h(
                        'p',
                        {},
                        'Both use at most ',
                        ro(ctx, 'cap', 4, formatCount),
                        ' grades at τ ',
                        ro(ctx, 'tau', .2, formatRisk),
                        '. Signed means male-name minus female-name contact advantage; absolute means the size of either advantage. The absolute law uses folded posterior cells, not the absolute value of a signed mean and not a Gaussian approximation.',
                    ),
                    h('p', {
                        class: 'kr-note',
                        text: 'Each target has its own expected-rank order and probabilities. The browser searches cuts of each order and evaluates the resulting report under its own loss. The signed search can recover the archived grades from the probabilities.',
                    }),
                    h('p', { class: 'kr-note' }, 'See the released signed comparison in ', appLink(ctx, 'krw-card'), '.'),
                    h(
                        'p',
                        {},
                        ro(ctx, 'changed', data.change.changed, formatCount),
                        ' of ',
                        ro(ctx, 'M', data.change.M, formatCount),
                        ' pair relations differ: ',
                        ro(ctx, 'newly-stated', data.change.nNewDisclosed, formatCount),
                        ' newly stated, ',
                        ro(ctx, 'newly-withheld', data.change.nNewWithheld, formatCount),
                        ' newly withheld, ',
                        ro(ctx, 'reversed', data.change.nReversed, formatCount),
                        ' reversed. “New” reads from signed to absolute.',
                    ),
                    h(
                        'p',
                        {},
                        matches ? 'Signed grades match KRW’s published gender card (Fig. ' : 'Signed grades differ from KRW’s published gender card (Fig. ',
                        ro(ctx, null, 14, formatCount),
                        '). Each risk uses its own target.',
                    ),
                );
                fullReadout.replaceChildren(
                    'Signed report: N ',
                    ro(ctx, 'ro-signed-N', data.signed.c.d.N, formatCount),
                    ', E/N ',
                    ro(ctx, 'ro-signed-EoverN', data.signed.c.ev.EoverN[0], formatShare),
                    '. Absolute report: N ',
                    ro(ctx, 'ro-absolute-N', data.absolute.c.d.N, formatCount),
                    ', E/N ',
                    ro(ctx, 'ro-absolute-EoverN', data.absolute.c.ev.EoverN[0], formatShare),
                    '. Each is optimal within its own expected-rank order, with the same cap and withholding cost.',
                );
            };

            const renderCard = k => {
                const r = both[k];
                const slot = k === 0 ? left : right;
                const wasHidden = cards.hidden;
                cards.hidden = false;
                try {
                    renderers[k].render(r.model, r.c, {
                        sort: 'mean',
                        reveal: 0,
                        selected,
                        sortInstruction: 'Rows stay in posterior-mean order within each grade. A shared grade states no direction between its firms.',
                    });
                    const cardScroll = slot.querySelector('.kr-card-scroll');
                    if (cardScroll && (cardScroll.clientWidth || ctx.width()) < 400) {
                        const tickTexts = [...cardScroll.querySelectorAll('g[aria-label="x-axis tick label"] text')];
                        if (tickTexts.length >= 5) {
                            tickTexts.forEach((node, idx) => {
                                if (idx % 2 === 1) node.style.display = 'none';
                            });
                        }
                    }
                } finally {
                    cards.hidden = wasHidden;
                }
                slot.querySelector('.kr-computed-info')?.remove();
                const prefix = k ? 'absolute' : 'signed';
                const info = h(
                    'div',
                    { class: 'kr-note kr-computed-info' },
                    h('b', { text: k === 0 ? 'Signed gender gap' : 'Absolute gender-gap size' }),
                    ': ',
                    labelNode(ctx, r.opt),
                    '. ',
                    tagNode(ctx, r.opt, { orderWords: k === 0 ? 'the signed-target expected-rank order' : 'the absolute-target expected-rank order' }),
                    '. Uses at most ',
                    ro(ctx, null, 4, formatCount),
                    ' grades, τ ',
                    ro(ctx, null, .2, formatRisk),
                    '. Family size ',
                    ro(ctx, `${prefix}-familySize`, r.opt.family.size, formatCount),
                    '. N ',
                    ro(ctx, `${prefix}-N`, r.c.d.N, formatCount),
                    '; ',
                    ro(ctx, `${prefix}-sizes`, r.c.d.sizes, formatSizes),
                    '; E/N ',
                    ro(ctx, `${prefix}-EoverN`, r.c.ev.EoverN[0], formatShare),
                    '; risk ',
                    ro(ctx, `${prefix}-risk`, r.c.ev.risk, formatRisk),
                    '. ',
                    ro(ctx, `${prefix}-tieCount`, r.opt.tieCount, formatCount),
                    r.opt.tieCount === 1 ? ' equal-risk optimum, tolerance ' : ' equal-risk optima, tolerance ',
                    ro(ctx, `${prefix}-tieTol`, r.opt.tieTol, formatSci),
                    '.',
                );
                if (r.opt.tieCount > 1) {
                    info.append(
                        h(
                            'p',
                            {},
                            'Returned equal-risk grade vectors: ',
                            ...r.opt.grades.map(g => h('span', {}, ro(ctx, null, g, formatGrades), ' ')),
                            '. The app shows the first optimal cut and lists the other tied reports.',
                        ),
                    );
                }
                const vectors = h(
                    'details',
                    {},
                    h('summary', { text: 'Full selected and returned equal-risk grade vectors' }),
                    h('p', {}, 'Selected grades in released firm-ID order: ', ro(ctx, `${prefix}-grade`, r.c.grade, formatGrades)),
                    ...r.opt.grades.map((g, j) => h('p', {}, 'Returned optimum ', ro(ctx, null, j + 1, formatCount), ': ', ro(ctx, null, g, formatGrades))),
                );
                (k === 0 ? leftVectors : rightVectors).replaceChildren(
                    h('b', { text: k === 0 ? 'Signed gender gap: ' : 'Absolute gender-gap size: ' }),
                    vectors,
                );
                slot.prepend(info);
            };

            const pairError = (p, r, d) => (d === 'withheld' ? null : d === 'above' ? r.model.e[p.i][p.j] : r.model.e[p.j][p.i]);
            const pairRow = (p, index) => {
                const err = (r, d) => pairError(p, r, d);
                return h(
                    'tr',
                    {
                        'data-prx-pair': `${p.i}-${p.j}`,
                        'data-type': changeType(p),
                        'data-pair-index': String(index),
                        'data-sort-error': String(err(data.absolute, p.to) ?? err(data.signed, p.from)),
                        hidden: pairType !== 'all' && pairType !== changeType(p) ? true : undefined,
                    },
                    h('th', { scope: 'row', text: names[p.i] }),
                    h('td', { text: names[p.j] }),
                    h('td', { 'data-prx-relation': p.from, 'data-prx-readout': `signed-pair-relation-${p.i}-${p.j}`, text: relation(p.from, p.i, p.j, names) }),
                    h('td', { 'data-prx-relation': p.to, 'data-prx-readout': `absolute-pair-relation-${p.i}-${p.j}`, text: relation(p.to, p.i, p.j, names) }),
                    h('td', {}, ro(ctx, `signed-pair-error-${p.i}-${p.j}`, err(data.signed, p.from), formatShare)),
                    h('td', {}, ro(ctx, `absolute-pair-error-${p.i}-${p.j}`, err(data.absolute, p.to), formatShare)),
                );
            };

            const sortPairView = () => {
                if (!pairBody) return;
                const rows = [...pairBody.rows];
                for (const row of rows) row.hidden = pairType !== 'all' && row.dataset.type !== pairType;
                rows.sort((a, b) =>
                    pairType === 'all'
                        ? +a.dataset.pairIndex - +b.dataset.pairIndex
                        : +b.dataset.sortError - +a.dataset.sortError || +a.dataset.pairIndex - +b.dataset.pairIndex,
                );
                pairBody.append(...rows);
            };

            const firmRow = (name, i) =>
                h(
                    'tr',
                    { 'data-prx-firm-row': String(i) },
                    h('th', { scope: 'row', text: name }),
                    ...both.flatMap(r => [r.model.mean[i], r.model.lower[i], r.model.upper[i]]).map(v => h('td', {}, ro(ctx, null, v, x => formatDecimal(x, { digits: 3 })))),
                    ...both.map(r => h('td', {}, ro(ctx, null, r.rank[i], x => formatDecimal(x, { digits: 3 })))),
                    ...both.map(r => h('td', {}, ro(ctx, null, r.c.grade[i], formatCount))),
                );

            function writeSummary() {
                const { change } = data;
                const n = (val, fn = formatCount) => ro(ctx, null, val, fn);
                const sC = data.signed.c;
                const aC = data.absolute.c;

                if (ctx.state.view === 'pairs') {
                    if (pairType === 'all') {
                        ctx.readout.set([
                            'Showing all ', n(change.changed), ' changed pair relations (share ',
                            n(change.changed / change.M, formatShare), ' of ', n(change.M),
                            ' pairs) from the signed report to the absolute report.',
                        ]);
                    } else {
                        const [subCount, label] = {
                            reversed: [change.nReversed, 'reversed pair directions'],
                            stated: [change.nNewDisclosed, 'newly stated pair directions'],
                            withheld: [change.nNewWithheld, 'newly withheld pair relations'],
                        }[pairType];
                        ctx.readout.set([
                            'Showing ', n(subCount), ' ', label, ' (share ',
                            n(subCount / change.changed, formatShare), ' of ', n(change.changed),
                            ' changed pairs) from signed to absolute grades.',
                        ]);
                    }
                    return;
                }

                if (ctx.state.view === 'firms') {
                    ctx.readout.set([
                        'Showing posterior summaries, expected ranks, and target-specific grades for all ',
                        n(names.length), ' firms (risk ', n(sC.ev.risk, formatReadoutRisk),
                        ' signed, ', n(aC.ev.risk, formatReadoutRisk), ' absolute).',
                    ]);
                    return;
                }

                if (precisionInspection && precisionBox.open) {
                    const r = precisionInspection;
                    ctx.readout.set([
                        r.name, ': original signed-estimate sampling SE ', n(r.se, formatReadoutEst),
                        '; ', r.side ? 'absolute' : 'signed', ' report grade ', n(r.grade),
                        ' of ', n(4), ' across the ', n(names.length), ' firms.',
                    ]);
                    return;
                }

                if (selected !== undefined) {
                    ctx.readout.set([
                        names[selected], ' has signed grade ', n(sC.grade[selected]),
                        ' (mean ', n(data.signed.model.mean[selected], formatReadoutEst),
                        ') and absolute grade ', n(aC.grade[selected]),
                        ' (mean ', n(data.absolute.model.mean[selected], formatReadoutEst),
                        ') across ', n(change.changed), ' changed pairs.',
                    ]);
                    return;
                }

                if (showFull) {
                    ctx.readout.set([
                        'Signed grades state ', n(sC.d.N), ' pairs (E/N = ', n(sC.ev.EoverN[0], formatShare),
                        ', risk ', n(sC.ev.risk, formatReadoutRisk), '); absolute grades state ',
                        n(aC.d.N), ' pairs (E/N = ', n(aC.ev.EoverN[0], formatShare),
                        ', risk ', n(aC.ev.risk, formatReadoutRisk), ').',
                    ]);
                    return;
                }

                ctx.readout.set([
                    'Switching from signed to absolute gender gaps changes ',
                    n(change.changed), ' of ', n(change.M), ' pair relations (share ',
                    n(change.changed / change.M, formatShare), '), reversing ',
                    n(change.nReversed), ' stated directions.',
                ]);
            }

            refreshView = () => ctx.requestRender('both');

            return {
                render(s) {
                    prepare();
                    view.set(s.view);
                    const linkedMode = s.view === 'cards' && !showFull;
                    chosenCards = s.view === 'cards' && showFull;
                    if (s.view !== 'cards' || !precisionBox.open) precisionInspection = null;

                    ranks.hidden = !linkedMode;
                    cards.hidden = s.view !== 'cards' || linkedMode;
                    precisionBox.root.hidden = s.view !== 'cards';
                    scrollHint.hidden = s.view === 'cards';
                    pairView.hidden = s.view !== 'pairs';
                    firmView.hidden = s.view !== 'firms';

                    pairPreview.hidden = s.view !== 'cards';
                    const changed = selected === undefined ? data.change.pairs[0] : data.change.pairs.find(p => p.i === selected || p.j === selected);
                    pairPreview.textContent = changed
                        ? names[changed.i] + ' and ' + names[changed.j] + ' · Signed gap: ' + relation(changed.from, changed.i, changed.j, names)
                          + '. Absolute gap: ' + relation(changed.to, changed.i, changed.j, names) + '.'
                        : 'Both targets give this firm the same relations.';
                    syncShownPreset();
                    writeSummary();

                    const stages = [];
                    if (s.view === 'cards') {
                        const theme = ctx.root.getAttribute('data-theme')
                            || ctx.doc.documentElement.getAttribute('data-theme')
                            || (ctx.win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                        const stamp = JSON.stringify([ctx.width(), theme, ctx.reducedMotion]);
                        const rk = JSON.stringify([stamp, selected]);
                        if (linkedMode && rk !== rankStamp) {
                            renderRanks();
                            rankStamp = rk;
                        }
                        const cardStamp = JSON.stringify([rk, showFull]);
                        const precisionStamp = JSON.stringify([stamp, precisionBox.open]);
                        for (let k = 0; k < 2; k++) {
                            if (painted[k] !== cardStamp) {
                                stages.push(() => ctx.keepFocus(() => { renderCard(k); painted[k] = cardStamp; }));
                            }
                            if (painted[k + 2] !== precisionStamp) {
                                stages.push(() => ctx.keepFocus(() => { precisionViews[k].render(both[k].model, both[k].c); painted[k + 2] = precisionStamp; }));
                            }
                        }
                    }

                    if (s.view === 'pairs') {
                        const CHUNK = 32;
                        if (!pairBody) {
                            stages.push(() => ctx.keepFocus(() => {
                                pairBody = h('tbody');
                                pairs.replaceChildren(
                                    h(
                                        'table',
                                        { class: 'kr-table kr-wide-table' },
                                        h('caption', { text: 'Complete list of changed unordered pairs; report directions concern different targets' }),
                                        h(
                                            'thead',
                                            {},
                                            h('tr', {}, ...['Firm i', 'Firm j', 'Signed report', 'Absolute report', 'Signed stated error', 'Absolute stated error'].map(text => h('th', { scope: 'col', text }))),
                                        ),
                                        pairBody,
                                    ),
                                );
                                pairBody.append(...data.change.pairs.slice(0, CHUNK).map((p, j) => pairRow(p, j)));
                            }));
                            for (let start = CHUNK; start < data.change.pairs.length; start += CHUNK) {
                                const from = start;
                                stages.push(() => ctx.keepFocus(() => {
                                    pairBody.append(...data.change.pairs.slice(from, from + CHUNK).map((p, j) => pairRow(p, from + j)));
                                }));
                            }
                        } else {
                            for (let start = pairBody.children.length; start < data.change.pairs.length; start += CHUNK) {
                                const from = start;
                                stages.push(() => ctx.keepFocus(() => {
                                    pairBody.append(...data.change.pairs.slice(from, from + CHUNK).map((p, j) => pairRow(p, from + j)));
                                }));
                            }
                        }
                        if (pairType !== 'all') {
                            if (stages.length) stages.push(() => ctx.keepFocus(() => sortPairView()));
                            else sortPairView();
                        }
                    }

                    if (s.view === 'firms') {
                        const CHUNK = 25;
                        if (!firmBody) {
                            stages.push(() => ctx.keepFocus(() => {
                                firmBody = h('tbody');
                                firms.replaceChildren(
                                    h(
                                        'table',
                                        { class: 'kr-table kr-wide-table' },
                                        h('caption', {}, 'All firms in released ID order; supplied central ', ro(ctx, null, .9, formatPercent), ' intervals, expected ranks and newly computed grades'),
                                        h(
                                            'thead',
                                            {},
                                            h('tr', {}, ...['Firm', 'Signed mean', 'Signed lower', 'Signed upper', 'Absolute mean', 'Absolute lower', 'Absolute upper', 'Signed expected rank', 'Absolute expected rank', 'Signed grade', 'Absolute grade'].map(text => h('th', { scope: 'col', text }))),
                                        ),
                                        firmBody,
                                    ),
                                );
                                firmBody.append(...names.slice(0, CHUNK).map((name, i) => firmRow(name, i)));
                            }));
                            for (let start = CHUNK; start < names.length; start += CHUNK) {
                                const from = start;
                                stages.push(() => ctx.keepFocus(() => {
                                    firmBody.append(...names.slice(from, from + CHUNK).map((name, i) => firmRow(name, from + i)));
                                }));
                            }
                        } else {
                            for (let start = firmBody.children.length; start < names.length; start += CHUNK) {
                                const from = start;
                                stages.push(() => ctx.keepFocus(() => {
                                    firmBody.append(...names.slice(from, from + CHUNK).map((name, i) => firmRow(name, from + i)));
                                }));
                            }
                        }
                    }

                    ctx.scheduleStages(stages, { yieldMs: s.view === 'pairs' ? 4 : 0 });
                },
            };
        },
    });

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
