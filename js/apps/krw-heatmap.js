import { createWidget } from '../shared/base.js';
import { drawKrwHeat, heatCounts, BLUE_CUTS, thresholdAt } from '../shared/krw-model.js';
import { formatCount, formatSetting } from '../shared/format.js';
import { KRW_COMMON_CSS, ARCHIVE_KEYS, archiveControls, archiveSnapshot, readKrwModel, createKrwHeader, createArchiveReadout, appendKrwNotice, ro } from './krw-common.js';
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'krw-heatmap', className: 'prx-kr', css: KRW_COMMON_CSS, label: 'All KRW firm-pair probabilities, thresholded and overlaid by card grades', keys: { ...ARCHIVE_KEYS, stage: { type: 'choice', values: [1, 2, 3], value: 1 } }, build(ctx) {
            const { h } = ctx, controls = archiveControls(ctx), stage = ctx.radioGroup({ legend: 'Heat-map stage', name: 'stage', options: [{ value: 1, label: '1: direction probabilities' }, { value: 2, label: '2: cells above 1 − τ' }, { value: 3, label: '3: the grade blocks' }], value: ctx.state.stage, onChange: v => ctx.set({ stage: Number(v) }) });
            ctx.controls.append(stage.root);
            const header = h('section', { class: 'kr-header' }), order = h('p', { class: 'kr-note' }), chart = h('div', { class: 'kr-map' }), legend = h('div', { class: 'kr-legend' }), note = h('p', { class: 'kr-stage-note' }), box = h('section', { class: 'kr-box prx-light-panel' }, h('h4', { text: 'Direction probabilities of all pairs' }), order, chart, legend, note, h('p', { class: 'kr-note', text: 'KRW’s card has no cap on the number of grades: bright cells inside one grade come from coherence, not a grade cap. Sharing a grade does not say that the posterior cannot order the firms.' }));
            ctx.charts.append(box, header);
            const headerView = createKrwHeader(ctx, header);
            appendKrwNotice(ctx);
            return { render(s) {
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        controls.render(s);
                        stage.set(s.stage);
                        const model = readKrwModel(s.criterion), c = archiveSnapshot(model, s.lambda), counts = heatCounts(model, c.grade, c.tau), cut = 1 - c.tau;
                        headerView.render(model, c);
                        const sortWords = s.sort === 'krw' ? 'KRW’s figure order (the λ = 1 card)' : s.sort === 'mean' ? 'posterior mean, largest first' : 'estimate, largest first';
                        order.textContent = s.stage === 3 ? `Rows and columns: grade 1 first; within each grade, ${sortWords}.` : `Rows and columns: ${sortWords}.`;
                        drawKrwHeat(ctx, chart, null, model, { grade: c.grade, tau: c.tau, sort: s.sort, stage: s.stage });
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
                        createArchiveReadout(ctx, model, c, ['Showing the heat map, stage ', ro(ctx, 'ro-stage', s.stage, formatCount), ' of ', ro(ctx, null, 3, formatCount), ': ', ro(ctx, 'ro-P', counts.P, formatCount), ' pairs have direction probability above ', ro(ctx, null, 1, formatCount), ' − τ.']);
                    }
                    finally {
                        ctx.root.removeAttribute('aria-busy');
                    }
                } };
        } });
}
