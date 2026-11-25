import { createWidget } from '../shared/base.js';
import { statedAbove } from '../pr-core.js';
import { gradeColors, labelOn, numText, placeDirectLabels, plot } from '../shared/chart.js';
import {
    formatCount,
    formatDecimal,
    formatDistinguishing,
    formatPercent,
    formatProb,
    formatReadoutEst,
    formatReadoutRisk,
    formatSetting,
    formatShare,
    tickLabel,
} from '../shared/format.js';
import { plural } from '../shared/labels.js';
import {
    KRW_COMMON_CSS,
    ARCHIVE_KEYS,
    SORTS,
    archiveSnapshot,
    readKrwModel,
    criterionSpec,
    blockOrder,
    keyOrder,
    createKrwHeader,
    createKrwRiskView,
    createKrwDenominatorView,
    createKrwCardView,
    createKrwPrecisionView,
    archiveReadoutParts,
    appendKrwNotice,
    ro,
} from '../shared/domain/krw.js';

const STAGE_CSS = `
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex:1 1 100%;align-items:flex-start}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{flex:1 1 13rem;max-width:18rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:1 1 36rem}
.krw-first .kr-lambda-chip{grid-column:1/-1;font-size:.76rem;line-height:1.15;color:var(--prx-fg-muted);margin:0}
.krw-first .kr-reveal{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
@media(max-width:40em){
.prx-widget.krw-first[data-prx-frame="v2"]{padding:.45rem .5rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar{gap:.25rem .45rem;margin-bottom:.3rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex-wrap:nowrap;gap:.45rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-seg{padding:.15rem .45rem;font-size:.8125rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-controls .prx-slider{flex:1 1 8.5rem;min-width:7.5rem;max-width:none}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-presets>.prx-seg-label{font-size:.78rem;margin-bottom:.1rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.22rem}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.12rem .38rem;font-size:.8rem;line-height:1.15}
.prx-widget.krw-first[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure>summary{padding:.1rem 0}
.prx-widget.krw-first[data-prx-frame="v2"]>.prx-readout,.prx-widget.krw-first[data-prx-frame="v2"] .prx-readout{padding:.25rem .5rem;margin-bottom:.35rem;font-size:.875rem;line-height:1.3}
}
.krw-first .kr-firm-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem}
@media(min-width:56em){.krw-first .kr-firm-layout{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}}
.krw-first .kr-firm-preview{width:100%;table-layout:fixed;font-size:.82rem}
.krw-first .kr-firm-preview th:first-child{width:32%}
.krw-first .kr-firm-preview th,.krw-first .kr-firm-preview td{white-space:normal;overflow-wrap:anywhere;padding:.2rem}
.krw-first .prx-stage .kr-firm-preview caption{color:var(--prx-plot-fg);font-weight:650}
.krw-first .prx-stage .prx-select{margin:.4rem 0}
.krw-first .prx-stage .prx-select select{max-width:100%}
.krw-first .kr-card-jump{display:none}
@media(max-width:55.99em){.krw-first .kr-card-jump{display:inline-block;font:inherit;font-size:.84rem;min-height:44px;background:transparent;border:0;text-decoration:underline;color:inherit;cursor:pointer}}
.krw-first .kr-stage-chart .prx-kbd-point{scroll-margin-block:6rem 2rem}
.krw-first .prx-stage .kr-stage-chart{min-width:0;max-width:100%}
.krw-first .prx-stage .kr-stage-meta{display:grid;gap:.25rem;margin-top:.45rem;font-size:.86rem;line-height:1.4;color:var(--prx-plot-fg)}
.krw-first .prx-stage .kr-stage-grades,.krw-first .prx-stage .kr-stage-inspect,.krw-first .prx-stage .kr-card-movement{margin:0;overflow-wrap:break-word;white-space:normal}
.krw-first .prx-stage .kr-stage-inspect{color:var(--prx-plot-muted)}
.krw-first .prx-stage .kr-stage-inspect strong{color:var(--prx-plot-fg)}
.krw-first .prx-stage .kr-card-movement{margin-bottom:.35rem;padding:.25rem .5rem;border-left:3px solid var(--prx-plot-axis);background:var(--prx-bg-sunken);border-radius:4px;font-size:.84rem}
.krw-first [data-kr-doubtful]{stroke:var(--prx-err-text);stroke-width:1.8}
.krw-first .kr-top-axis{height:22px;background:var(--prx-plot-bg)}
.krw-first .kr-top-axis svg{display:block;max-width:100%}
`;

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

export function neighboringFirm(model, grades, selected) {
    let best = null;
    for (let other = 0; other < grades.length; other++) {
        if (Math.abs(grades[other] - grades[selected]) !== 1) continue;
        const above = grades[selected] < grades[other] ? selected : other;
        const below = above === selected ? other : selected;
        const error = model.e[above][below];
        if (!best || error > best.error) best = { other, above, below, error };
    }
    return best ?? { other: selected === 0 ? 1 : 0, above: null, below: null, error: null };
}

export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, {
        name: 'krw-card',
        frame: 'v2',
        className: 'prx-kr prx-rc krw-first',
        css: KRW_COMMON_CSS + STAGE_CSS,
        label: 'Read KRW’s full race and signed gender report cards',
        keys: { ...ARCHIVE_KEYS, firm: { type: 'integer', min: -1, max: 96, value: -1 }, reveal: { type: 'integer', min: 0, max: 97, value: 0 } },
        build(ctx) {
            const { h } = ctx;
            let lastG = 1;
            let selectedUnit = null;
            // All archive rows use the same firm identifiers.
            const pickFirm = firm => ctx.set({ firm, reveal: 0 });

            const target = ctx.segmented({
                label: 'Target',
                name: 'criterion',
                value: ctx.state.criterion,
                options: [
                    { value: 'race', label: 'Race', title: 'White-name contact advantage' },
                    { value: 'gender', label: 'Gender', title: 'Male-name contact advantage' },
                ],
                onChange: criterion => ctx.set({ criterion }),
            });
            const lambda = ctx.slider({
                label: 'KRW’s λ',
                name: 'lambda',
                min: .01,
                max: 1,
                step: .01,
                value: ctx.state.lambda,
                onInput: lambda => ctx.set({ lambda }),
            });
            const chip = h('div', { class: 'kr-lambda-chip' });
            lambda.root.append(chip);
            ctx.controls.append(target.root, ctx.primaryControl(lambda.root));

            const settings = ctx.settingsBox();
            const sort = ctx.select({
                label: 'Sort within grades',
                name: 'sort',
                value: ctx.state.sort,
                options: SORTS,
                onChange: sort => ctx.set({ sort }),
            });
            const reveal = ctx.button({
                label: 'Reveal grade by grade',
                key: 'reveal-next',
                onClick: () => ctx.set({ reveal: ctx.state.reveal === 0 || ctx.state.reveal >= lastG ? 1 : ctx.state.reveal + 1 }),
            });
            const all = ctx.button({
                label: 'Show all grades',
                key: 'reveal-all',
                onClick: () => ctx.set({ reveal: 0 }),
            });
            settings.body.append(sort.root, h('div', { class: 'kr-reveal' }, reveal.root, all.root));

            const movement = h('div', { class: 'kr-card-movement' });
            const stageChart = h('div', { class: 'kr-stage-chart' });
            const stageGrades = h('p', { class: 'kr-stage-grades' });
            const stageInspect = h('p', { class: 'kr-stage-inspect' });
            const stageMeta = h('div', { class: 'kr-stage-meta' }, stageGrades, stageInspect);
            const firmOptions = readKrwModel('race').names.map((label, value) => ({ label, value }))
                .sort((a, b) => a.label.localeCompare(b.label));
            const firmPick = ctx.select({ label: 'Inspect a firm', name: 'firm', options: firmOptions, onChange: pickFirm });
            const pairRows = h('tbody');
            const pairMessage = h('p', { class: 'kr-stage-inspect', 'data-prx-readout': 'named-firm-comparison' });
            const pairTable = h('table', { class: 'kr-table kr-firm-preview' },
                h('caption', { text: 'Two firms on this card' }),
                h('thead', {}, h('tr', {}, ...['Firm', 'Grade', 'Gap mean', 'Central interval'].map(text => h('th', { scope: 'col', text })))),
                pairRows);
            const namedCard = h('section', { class: 'kr-named-card', 'aria-label': 'Named firms and pair reliability' },
                firmPick.root, pairTable, pairMessage, stageMeta);
            const compareJump = h('button', { type: 'button', class: 'kr-card-jump', text: 'Compare two firms below the chart' });
            ctx.listen(compareJump, 'click', () => firmPick.input.focus());
            ctx.stage.append(movement, compareJump, h('div', { class: 'kr-firm-layout' }, stageChart, namedCard));

            const dataBox = ctx.dataBox(['Data, ', ctx.num(97, formatCount(97)), ' firms and between-grade details']);
            const methodBox = ctx.methodBox('Method, risk split and precision');

            const card = h('section');
            const between = h('div', { class: 'kr-between-side', role: 'complementary', 'aria-label': 'Reliability between grades' });
            const detailsDiv = h('div');
            dataBox.body.append(card, between, detailsDiv);

            const header = h('section', { class: 'kr-header' });
            const fullReadout = h('p', { class: 'kr-note' });
            const risk = h('section');
            const denom = h('section');
            const precision = h('section');
            const note = h('section', { class: 'kr-box prx-light-panel' });
            methodBox.body.append(
                header,
                fullReadout,
                h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ', ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '.'),
                h('p', { class: 'kr-note' }, 'τ = λ/(', ctx.num(1, formatCount(1)), ' + λ). The grid starts at the first positive λ.'),
                h('div', { class: 'kr-grid' }, risk, denom),
                precision,
                note,
            );

            const views = [createKrwHeader(ctx, header), createKrwRiskView(ctx, risk), createKrwDenominatorView(ctx, denom)];
            const cardView = createKrwCardView(ctx, card, {
                rowPx: 16,
                topAxis: true,
                betweenTarget: between,
                detailsTarget: detailsDiv,
                movementTarget: movement,
                onPick: pickFirm,
            });
            const precisionView = createKrwPrecisionView(ctx, precision);
            appendKrwNotice(ctx);

            const renderStage = (model, c, s, out, questionable) => {
                const flaggedList = questionable.pairs.flatMap(pair => [pair.i, pair.j]);
                const n = (raw, fmt = formatCount) => ro(ctx, null, raw, fmt);
                const order = keyOrder(model, s.sort);
                const rowsUnits = out.order.map(p => order[p]);
                const shown = out.shown;
                const allRows = rowsUnits.map((u, pos) => ({
                    u,
                    pos,
                    id: model.ids[u],
                    name: model.names[u],
                    grade: c.grade[u],
                    mean: model.mean[u],
                    lower: model.lower[u],
                    upper: model.upper[u],
                }));
                const rows = allRows.filter(r => r.grade <= shown);
                const activeUnit = Number.isInteger(selectedUnit) && rows.some(r => r.u === selectedUnit)
                    ? selectedUnit
                    : (rows.find(r => r.u === flaggedList[0])?.u ?? rows[0]?.u ?? rowsUnits[0] ?? 0);

                const bands = [];
                for (const r of rows) {
                    const b = bands[r.grade - 1] ?? (bands[r.grade - 1] = { grade: r.grade, first: r.pos, last: r.pos, size: 0 });
                    b.last = r.pos;
                    b.size += 1;
                }
                for (const b of bands) b.mid = (b.first + b.last) / 2;

                const loRaw = Math.min(...model.lower);
                const hiRaw = Math.max(...model.upper);
                const pad = (hiRaw - loRaw) * 0.04 || 1;
                const lo = loRaw - pad;
                const hi = hiRaw + pad;

                const width = Math.max(240, Math.round(stageChart.clientWidth || ctx.width() || 640));
                const narrow = width < 480;
                // The unrevealed tail needs one caption, while each revealed firm needs a distinct row.
                const remaining = model.n - rows.length;
                const plotRows = rows.length + (remaining ? 3 : 0);
                const marginTop = 48;
                const marginBottom = 40;
                const height = marginTop + Math.max(100, plotRows * (narrow ? 14 : 12)) + marginBottom;
                const marginLeft = 36;
                const marginRight = 14;
                const stripePx = 24;
                const innerW = Math.max(1, width - marginLeft - marginRight);
                const innerH = Math.max(1, height - marginTop - marginBottom);
                const perPx = (hi - lo) / innerW;
                const leftOf = px => lo - px * perPx;
                const stripeX1 = leftOf(marginLeft - 1);
                const stripeX2 = leftOf(marginLeft - 1 - stripePx);
                const stripeMid = (stripeX1 + stripeX2) / 2;
                const yPxOf = pos => marginTop + ((pos + 0.5) / plotRows) * innerH;
                const posOf = yPx => ((yPx - marginTop) / innerH) * plotRows - 0.5;
                const halfPillUnits = (8.5 / innerH) * plotRows;
                const spaced = pickSpacedBands(bands, yPxOf, 18);
                const placedBadges = placeDirectLabels(
                    spaced.map(b => ({ id: String(b.grade), y: yPxOf(b.mid), band: b })),
                    { minGapPx: 18, bounds: [marginTop + 9, height - marginBottom - 9] },
                );
                const labeledBands = placedBadges.map(p => ({ ...p.band, labelPos: posOf(p.y) }));

                const hiddenNotice = remaining ? [{ mid: (rows.length + plotRows - 1) / 2 }] : [];

                const flaggedSet = new Set(flaggedList);
                const flaggedRows = rows.filter(r => flaggedSet.has(r.u));
                const selRows = rows.filter(r => r.u === activeUnit);
                const t = criterionSpec(model.criterion);
                const val3 = v => formatDecimal(v, { digits: 3 });
                const tipText = d => `${d.name}\nGrade ${formatCount(d.grade)} of ${formatCount(c.d.G)}\nPosterior mean ${val3(d.mean)}\n90% interval ${val3(d.lower)} to ${val3(d.upper)}`;

                const updateInspect = u => {
                    firmPick.set(u);
                    // Pick the least certain stated comparison involving this firm and a neighboring grade.
                    const pair = neighboringFirm(model, c.grade, u);
                    const row = i => h('tr', {},
                        h('th', { scope: 'row', 'data-prx-name': '', text: model.names[i] }),
                        h('td', {}, n(c.grade[i])), h('td', {}, n(model.mean[i], formatReadoutEst)),
                        h('td', {}, n(model.lower[i], formatReadoutEst), ' to ', n(model.upper[i], formatReadoutEst)));
                    pairRows.replaceChildren(row(u), row(pair.other));
                    const named = i => h('strong', { 'data-prx-name': '', text: model.names[i] });
                    pairMessage.replaceChildren(...(pair.error === null
                        ? [named(u), ' and ', named(pair.other), ' share a grade. This card withholds their direction.']
                        : ['Of this firm’s comparisons with the neighboring grades, the least certain places ',
                            named(pair.above), ' above ', named(pair.below), '. Its posterior probability of a wrong direction is ',
                            ro(ctx, 'neighbor-error', pair.error, formatProb), '.']));
                    const doubtful = questionable.pairs[0];
                    if (doubtful && (doubtful.i !== pair.above || doubtful.j !== pair.below)) {
                        pairMessage.append(' A doubtful direction on this card places ', named(doubtful.i), ' above ', named(doubtful.j),
                            ' with error probability ', ro(ctx, 'doubtful-pair-error', doubtful.error, formatProb), '.');
                    }
                    stageInspect.replaceChildren(
                        'Selected firm: ',
                        h('strong', { 'data-prx-name': '', text: model.names[u] }),
                        ' · Grade ', n(c.grade[u]), ' of ', n(c.d.G),
                        ' · mean ', n(model.mean[u], formatReadoutEst),
                        ', ', n(0.9, formatPercent), ' interval ',
                        n(model.lower[u], formatReadoutEst), ' to ', n(model.upper[u], formatReadoutEst),
                        ' (estimate ', n(model.estimate[u], formatReadoutEst), ', SE ', n(model.se[u], formatReadoutEst), ').',
                    );
                };
                updateInspect(activeUnit);

                if (c.d.G === 1) {
                    stageGrades.replaceChildren('Grade ', n(1), ' (all ', n(model.n), ' firms): same grade withholds comparison rather than claiming equality.');
                }
                else {
                    const byMean = blockOrder(model, c.grade, 'mean');
                    const topFirms = byMean.filter(i => c.grade[i] === 1);
                    const botFirms = byMean.filter(i => c.grade[i] === c.d.G);
                    const topNames = topFirms.slice(0, 3).flatMap((i, idx) => (
                        idx ? [', ', h('strong', { 'data-prx-name': '', text: model.names[i] })]
                            : [h('strong', { 'data-prx-name': '', text: model.names[i] })]
                    ));
                    if (topFirms.length > 3) topNames.push(' and ', n(topFirms.length - 3), ' more');
                    stageGrades.replaceChildren(
                        'Grade ', n(1), ' (', n(topFirms.length), '): ', ...topNames,
                        ' · Grade ', n(c.d.G), ' (', n(botFirms.length), ', lowest: ',
                        h('strong', { 'data-prx-name': '', text: model.names[botFirms[botFirms.length - 1]] }), ').',
                        ...(flaggedRows.length ? [' Outlined dots mark firms in doubtful stated pairs.'] : []),
                    );
                }

                plot(stageChart, {
                    width,
                    height,
                    aspect: false,
                    marginTop,
                    marginBottom,
                    marginLeft,
                    marginRight,
                    alt: `${t.label} report card across ${formatCount(model.n)} firms: posterior means and 90% central intervals grouped into ${formatCount(c.d.G)} ordered grades.`,
                    x: {
                        domain: [lo, hi],
                        axis: 'bottom',
                        ticks: narrow ? 4 : 5,
                        label: narrow ? t.short : t.axis,
                        labelAnchor: 'center',
                        labelArrow: 'none',
                        grid: true,
                    },
                    y: { domain: [plotRows - 0.5, -0.5], axis: null },
                    color: { type: 'identity' },
                    keyboard: {
                        data: rows,
                        x: 'mean',
                        y: 'pos',
                        key: d => d.id,
                        sort: false,
                        virtual: true,
                        pointer: true,
                        label: 'Inspect firms on the report card with arrow keys or pointer',
                        title: tipText,
                        onFocus: d => {
                            updateInspect(d.u);
                            const focus = ctx.doc.activeElement;
                            if (stageChart.contains(focus)) focus.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                        },
                        onSelect: d => pickFirm(d.u),
                    },
                    marks: (k, P) => {
                        const colors = gradeColors(c.d.G, k);
                        return [
                            P.axisX({ anchor: 'top', ticks: narrow ? 4 : 5, tickFormat: tickLabel,
                                label: narrow ? t.short : t.axis, labelAnchor: 'center', labelArrow: 'none', labelOffset: 35 }),
                            P.rect(bands.filter(b => b.grade % 2 === 1), {
                                x1: () => lo,
                                x2: () => hi,
                                y1: b => b.first - 0.5,
                                y2: b => b.last + 0.5,
                                fill: k.plotGrid,
                                fillOpacity: 0.55,
                            }),
                            P.ruleX([0], { stroke: k.plotAxis, strokeDasharray: '3,3', strokeOpacity: 0.55 }),
                            P.ruleY(bands.slice(1), {
                                y: b => b.first - 0.5,
                                x1: () => stripeX1,
                                x2: () => hi,
                                stroke: k.plotMuted,
                                strokeDasharray: '4,3',
                            }),
                            P.rect(bands, {
                                x1: () => stripeX1,
                                x2: () => stripeX2,
                                y1: b => b.first - 0.5,
                                y2: b => b.last + 0.5,
                                fill: b => colors[b.grade - 1],
                                inset: 0.5,
                            }),
                            P.rect(labeledBands, {
                                x1: () => stripeX1,
                                x2: () => stripeX2,
                                y1: b => b.labelPos - halfPillUnits,
                                y2: b => b.labelPos + halfPillUnits,
                                fill: b => colors[b.grade - 1],
                                stroke: k.plotBg,
                                strokeWidth: 1,
                                rx: 3,
                            }),
                            numText(labeledBands, {
                                x: () => stripeMid,
                                y: 'labelPos',
                                value: 'grade',
                                format: x => formatCount(x),
                                fill: b => labelOn(colors[b.grade - 1], k),
                                fontWeight: 'bold',
                                textAnchor: 'middle',
                            }),
                            P.ruleY(rows, {
                                y: 'pos',
                                x1: 'lower',
                                x2: 'upper',
                                stroke: d => colors[d.grade - 1],
                                strokeWidth: 2,
                            }),
                            P.dot(rows, {
                                x: 'mean',
                                y: 'pos',
                                r: 2.9,
                                fill: d => colors[d.grade - 1],
                                stroke: k.plotBg,
                                strokeWidth: 0.7,
                            }),
                            P.dot(flaggedRows, {
                                x: 'mean',
                                y: 'pos',
                                r: 5,
                                fill: 'none',
                                stroke: k.errText,
                                strokeWidth: 1.8,
                            }),
                            P.dot(selRows, {
                                x: 'mean',
                                y: 'pos',
                                r: 6.2,
                                fill: 'none',
                                stroke: k.plotFg,
                                strokeWidth: 2,
                            }),
                            P.text(hiddenNotice, {
                                x: () => (lo + hi) / 2,
                                y: 'mid',
                                text: () => 'Remaining grades not shown yet',
                                fill: k.plotMuted,
                            }),
                        ];
                    },
                });
            };

            return {
                render(s, info = {}) {
                    if (info.reason === 'disclosure') {
                        const model = readKrwModel(s.criterion);
                        const c = archiveSnapshot(model, s.lambda);
                        if (info.disclosure === 'data') {
                            const questionable = statedAbove(c.grade, model.E, { tau: .5 });
                            const flagged = questionable.pairs.flatMap(p => [p.i, p.j]);
                            cardView.render(model, c, { ...s, selected: selectedUnit, flagged });
                        } else if (info.disclosure === 'method') {
                            precisionView.render(model, c);
                        }
                        return;
                    }
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        selectedUnit = s.firm >= 0 ? s.firm : null;
                        const model = readKrwModel(s.criterion);
                        const c = archiveSnapshot(model, s.lambda);
                        const questionable = statedAbove(c.grade, model.E, { tau: .5 });
                        const flagged = questionable.pairs.flatMap(p => [p.i, p.j]);

                        target.set(s.criterion);
                        lambda.set(s.lambda);
                        sort.set(s.sort);
                        chip.replaceChildren('τ = ', ro(ctx, null, c.tau, formatReadoutRisk));

                        views.forEach(v => v.render(model, c));
                        const out = cardView.render(model, c, { ...s, selected: selectedUnit, flagged });
                        movement.hidden = s.sort === 'mean';
                        precisionView.render(model, c);
                        renderStage(model, c, s, out, questionable);

                        lastG = c.d.G;
                        reveal.setLabel(s.reveal === 0 ? 'Reveal grade by grade' : out.shown < c.d.G ? 'Reveal next grade' : 'Start again at grade 1');
                        reveal.setDisabled(c.d.G === 1);
                        all.setDisabled(s.reveal === 0 || s.reveal >= c.d.G || c.d.G === 1);

                        const n = (raw, fmt = formatCount) => ro(ctx, null, raw, fmt);
                        if (c.d.G === 1) {
                            ctx.readout.set([
                                'One grade holds all ', n(model.n), ' firms and states ', n(0), ' of ', n(model.M),
                                ' pairs (E/N = ', n(c.ev.EoverN[0], formatShare), '); risk at τ = ',
                                n(c.tau, formatReadoutRisk), ' is ', n(c.ev.risk, formatReadoutRisk), ' (all withheld).',
                            ]);
                        }
                        else {
                            const rStr = formatDistinguishing(c.ev.risk, c.tau, { minSig: 3 });
                            const tStr = formatDistinguishing(c.tau, c.ev.risk, { minSig: 3 });
                            const sizeClause = c.d.G === model.n
                                ? [n(1), ' firm each']
                                : c.d.G > 6
                                    ? ['largest ', n(Math.max(...c.d.sizes)), ' firms']
                                    : [...c.d.sizes.flatMap((sz, idx) => (idx ? [' / ', n(sz)] : [n(sz)])), ' firms'];
                            const parts = [
                                n(c.d.G), ' grades (', ...sizeClause, ') state ', n(c.d.N), ' of ', n(model.M),
                                ' pairs (E/N = ', n(c.ev.EoverN[0], formatShare), '); risk ',
                                n(c.ev.risk, () => rStr), ' = ', n(c.ev.errorTerm, formatReadoutRisk), ' errors + ',
                                n(c.ev.withholdingTerm, formatReadoutRisk), ' withholding (all withheld: ', n(c.tau, () => tStr), ').',
                            ];
                            if (out.shown < c.d.G) {
                                parts.push(out.shown === 1 ? ' Showing grade ' : ' Showing grades ', n(1), ...(out.shown > 1 ? [' to ', n(out.shown)] : []), ' of ', n(c.d.G), '.');
                            }
                            if (questionable.count > 0) {
                                parts.push(' ', n(questionable.count), ' ', plural(questionable.count, 'stated direction'), questionable.count === 1 ? ' is' : ' are', ' more likely wrong than right.');
                            }
                            ctx.readout.set(parts);
                        }

                        if (s.criterion === 'race') {
                            note.replaceChildren(
                                h('h4', { text: 'Grades follow the posterior, not raw estimates' }),
                                h('p', {}, 'On the published baseline card, grade 1 holds Genuine Parts (Napa Auto) and AutoNation. Four grade-2 firms have larger estimates than Genuine Parts: Nationwide, Costco, Builders FirstSource and CVS Health. AutoNation has the largest estimate; Genuine Parts has the largest posterior mean. Under KRW’s precision-dependent prior, a wider posterior can pull an estimate toward the middle.'),
                                h('p', { class: 'kr-note' }, 'KRW call ★ (one star) the worst grade (§VI). Direction table: postrank grades ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), ' = stars ★/★★/★★★ = exported labels ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), '; body labels dᵢ ', ro(ctx, null, [3, 2, 1], v => v.map(formatCount).join('/')), '; reconstructed dᵢ* ', ro(ctx, null, [1, 3, 84], v => v.map(formatCount).join('/')), '.'),
                            );
                        }
                        else {
                            note.replaceChildren(
                                h('h4', { text: 'Both ends of the signed scale are contact gaps' }),
                                h('p', {}, 'A male-name advantage is positive; a female-name advantage is negative. Read KRW’s stars with the target, not as better or worse. Coherence may state doubtful directions: ', ro(ctx, 'doubtful-count', questionable.count, formatCount), ' stated directions here are more likely wrong than right.'),
                                ...questionable.pairs.map(p => h('p', { class: 'kr-note' }, model.names[p.i], ' above ', model.names[p.j], ': wrong-direction probability ', ro(ctx, `doubtful-error-${p.i}-${p.j}`, p.error, formatProb), '.')),
                            );
                        }
                        fullReadout.replaceChildren(...archiveReadoutParts(ctx, model, c, [
                            'Showing the card, rows by ',
                            ...(s.sort === 'krw'
                                ? ['KRW’s figure order (the λ = ', ro(ctx, null, 1, formatCount), ' grid card)']
                                : [s.sort === 'mean' ? 'the posterior mean' : 'the estimate']),
                            ' within grades, grades 1 to ', ro(ctx, 'ro-shown', out.shown, formatCount), ' of ', ro(ctx, null, c.d.G, formatCount), '.',
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
