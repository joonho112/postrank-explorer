import { createWidget } from '../shared/base.js';
import { statedAbove } from '../pr-core.js';
import { formatCount, formatProb, formatRisk, formatSetting, formatShare } from '../shared/format.js';
import { KRW_COMMON_CSS, ARCHIVE_KEYS, compactArchiveControls, riskDigits, archiveSnapshot, readKrwModel, createKrwHeader, createKrwRiskView, createKrwDenominatorView, createKrwCardView, createKrwPrecisionView, archiveReadoutParts, appendKrwNotice, ro } from './krw-common.js';
const FIRST_CSS = `
.krw-first .kr-compact-controls{display:grid;grid-template-columns:auto minmax(10rem,1fr) auto auto;gap:.3rem .85rem;align-items:start}
.krw-first .kr-lambda-chip{font-size:.8rem;color:var(--prx-fg-muted)}
.krw-first .kr-card-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35rem;margin:.35rem 0}
.krw-first .kr-card-tile{border:1px solid var(--prx-border);border-radius:6px;padding:.3rem .5rem;min-width:0;font-size:.85rem;line-height:1.2}
.krw-first .kr-card-tile strong{display:block;font-size:1rem;overflow-wrap:anywhere}
.krw-first .kr-card-layout{display:grid;grid-template-columns:minmax(0,2.15fr) minmax(0,1fr);gap:.65rem;align-items:start}
.krw-first .kr-card-layout>section,.krw-first .kr-card-layout .kr-between-side>.kr-box{margin-top:.15rem}
.krw-first .kr-card-layout .kr-between-side{min-width:0;position:sticky;top:5.5rem}
.krw-first .kr-card-layout .kr-card-scroll{max-height:none;overflow:visible}
.krw-first .kr-top-axis{position:sticky;top:5.5rem;z-index:2;background:var(--prx-plot-bg);height:22px}
.krw-first .kr-top-axis svg{display:block;max-width:100%}
.krw-first [data-kr-doubtful]{stroke:var(--prx-err-text);stroke-width:1.7}
.krw-first .kr-card-warning{color:var(--prx-err-text);font-weight:600}
.krw-first .kr-card-risk,.krw-first .kr-card-warning,.krw-first .kr-card-movement{font-size:.83rem;margin:.2rem 0;line-height:1.3}
.krw-first .kr-reveal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:14.5rem;gap:.2rem}
.krw-first .kr-reveal button{white-space:normal;min-height:2.8rem;padding-inline:.4rem;line-height:1.15}
@media(max-width:60em){.krw-first .kr-compact-controls{grid-template-columns:1fr 1fr}.krw-first .kr-card-layout{grid-template-columns:minmax(0,1fr)}.krw-first .kr-card-layout .kr-between-side{position:static}}
@media(max-width:40em){.krw-first .kr-card-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.krw-first .kr-reveal{width:auto}.krw-first .kr-reveal button{height:3.8rem;padding:.2rem .25rem}.krw-first .kr-top-axis{top:0}#quarto-content .krw-first .kr-top-axis{top:61px}.krw-first .kr-compact-controls .prx-select select{max-width:100%}}
`;
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'krw-card', className: 'prx-kr prx-rc krw-first', layout: 'result-first', css: KRW_COMMON_CSS + FIRST_CSS, label: 'Read KRW’s full race and signed gender report cards', keys: { ...ARCHIVE_KEYS, reveal: { type: 'integer', min: 0, max: 97, value: 0 } }, build(ctx) {
            const { h } = ctx, controls = compactArchiveControls(ctx);
            let lastG = 1;
            const reveal = ctx.button({ label: 'Reveal grade by grade', key: 'reveal-next', onClick: () => ctx.set({ reveal: ctx.state.reveal === 0 || ctx.state.reveal >= lastG ? 1 : ctx.state.reveal + 1 }) }), all = ctx.button({ label: 'Show all grades', key: 'reveal-all', onClick: () => ctx.set({ reveal: 0 }) });
            controls.row.append(h('div', { class: 'kr-reveal' }, reveal.root, all.root));
            const header = h('section', { class: 'kr-header' }), card = h('section'), precision = h('section'), risk = h('section'), denom = h('section'), note = h('section', { class: 'kr-box prx-light-panel' });
            const summary = h('div', { class: 'kr-card-summary' }), riskLine = h('p', { class: 'kr-card-risk' }), warning = h('p', { class: 'kr-card-warning' }), movement = h('div', { class: 'kr-card-movement' }), between = h('div', { class: 'kr-between-side', role: 'complementary', 'aria-label': 'Reliability between grades' });
            const grid = h('div', { class: 'kr-card-layout' }, ctx.primaryGraphic(card), between);
            ctx.charts.append(movement, grid);
            const disclosure = ctx.disclosure({ name: 'by-grade', title: 'Disclosure by grade and interval guide' });
            const detail = ctx.disclosure({ name: 'evaluation', title: 'Card source, risk and pair denominators' });
            const precisionBox = ctx.disclosure({ name: 'precision', title: 'Precision and full grade vector' });
            const stars = ctx.disclosure({ name: 'directions', title: 'KRW’s stars and doubtful directions' });
            const fullReadout = h('p', { class: 'kr-note' });
            detail.body.append(header, fullReadout,
                h('p', { class: 'kr-note', text: 'Signed contact-gap target' }),
                h('p', { class: 'kr-note', text: 'Race: white-name advantage' }),
                h('p', { class: 'kr-note', text: 'Gender: male-name advantage' }),
                h('p', { class: 'kr-note', text: 'Archived KRW card at this value of λ' }),
                h('p', { class: 'kr-note', text: 'Within each grade, sort by' }),
                h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ', ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '.'),
                h('p', { class: 'kr-note' }, 'τ = λ/(', ctx.num(1, formatCount(1)), ' + λ). The grid starts at the first positive λ.'),
                h('div', { class: 'kr-grid' }, risk, denom));
            precisionBox.body.append(precision); stars.body.append(note);
            const views = [createKrwHeader(ctx, header), createKrwRiskView(ctx, risk), createKrwDenominatorView(ctx, denom)], cardView = createKrwCardView(ctx, card, { rowPx: 10, topAxis: true, betweenTarget: between, detailsTarget: disclosure.body, movementTarget: movement }), precisionView = createKrwPrecisionView(ctx, precision);
            const tile = (label, ...value) => h('div', { class: 'kr-card-tile' }, h('strong', {}, ...value), label);
            appendKrwNotice(ctx);
            return { render(s) {
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        const model = readKrwModel(s.criterion), c = archiveSnapshot(model, s.lambda), questionable = s.criterion === 'gender' ? statedAbove(c.grade, model.E, { tau: .5 }) : { count: 0, pairs: [] };
                        controls.render(s, c);
                        const n = (raw, fmt = formatCount) => ro(ctx, null, raw, fmt), f = v => formatRisk(v, { digits: riskDigits(c) });
                        summary.replaceChildren(
                            tile(c.d.G === 1 ? 'All firms share it' : c.d.G > 10 ? 'Largest grade size' : 'Firms in each grade', c.d.G === 1 ? 'One grade' : h('span', {}, n(c.d.G), ' grades · ', c.d.G > 10 ? n(Math.max(...c.d.sizes)) : h('span', {}, ...c.d.sizes.flatMap((size, i) => i ? [' / ', n(size)] : [n(size)])))),
                            tile('Pairs stated', n(c.d.N), ' of ', n(model.M)),
                            tile('E/N · stated pairs', n(c.ev.EoverN[0], formatShare)),
                            tile('DR · all pairs', n(c.DR, v => formatRisk(v, { digits: 4 }))),
                        );
                        riskLine.replaceChildren('Risk at τ ', n(c.tau, riskDigits(c) > 4 ? f : formatSetting), ': ', n(c.ev.risk, f), ' = ', n(c.ev.errorTerm, f), ' errors + ', n(c.ev.withholdingTerm, f), ' withholding.', ...(c.d.N > 0 ? [' All withheld: ', n(c.tau, f), '.'] : []));
                        warning.replaceChildren(n(questionable.count), ' stated directions are more likely wrong than right. Outlined dots mark the firms involved.');
                        ctx.readout.set([summary, riskLine, ...(questionable.count ? [warning] : [])]);
                        views.forEach(v => v.render(model, c));
                        const out = cardView.render(model, c, { ...s, flagged: questionable.pairs.flatMap(p => [p.i, p.j]) });
                        movement.hidden = s.sort === 'mean';
                        precisionView.render(model, c);
                        lastG = c.d.G;
                        reveal.setLabel(s.reveal === 0 ? 'Reveal grade by grade' : out.shown < c.d.G ? 'Reveal next grade' : 'Start again at grade 1');
                        reveal.setDisabled(c.d.G === 1);
                        all.setDisabled(s.reveal === 0 || s.reveal >= c.d.G || c.d.G === 1);
                        if (s.criterion === 'race') {
                            note.replaceChildren(h('h4', { text: 'Grades follow the posterior, not raw estimates' }), h('p', {}, 'On the published baseline card, grade 1 holds Genuine Parts (Napa Auto) and AutoNation. Four grade-2 firms have larger estimates than Genuine Parts: Nationwide, Costco, Builders FirstSource and CVS Health. AutoNation has the largest estimate; Genuine Parts has the largest posterior mean. Under KRW’s precision-dependent prior, a wider posterior can pull an estimate toward the middle.'), h('p', { class: 'kr-note' }, 'KRW call ★ (one star) the worst grade (§VI). Direction table: postrank grades ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), ' = stars ★/★★/★★★ = exported labels ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), '; body labels dᵢ ', ro(ctx, null, [3, 2, 1], v => v.map(formatCount).join('/')), '; reconstructed dᵢ* ', ro(ctx, null, [1, 3, 84], v => v.map(formatCount).join('/')), '.'));
                        }
                        else {
                            note.replaceChildren(h('h4', { text: 'Both ends of the signed scale are contact gaps' }), h('p', {}, 'A male-name advantage is positive; a female-name advantage is negative. Read KRW’s stars with the target, not as better or worse. Coherence may state doubtful directions: ', ro(ctx, 'doubtful-count', questionable.count, formatCount), ' stated directions here are more likely wrong than right.'), ...questionable.pairs.map(p => h('p', { class: 'kr-note' }, model.names[p.i], ' above ', model.names[p.j], ': wrong-direction probability ', ro(ctx, `doubtful-error-${p.i}-${p.j}`, p.error, formatProb), '.')));
                        }
                        fullReadout.replaceChildren(...archiveReadoutParts(ctx, model, c, ['Showing the card, rows by ', ...(s.sort === 'krw' ? ['KRW’s figure order (the λ = ', ro(ctx, null, 1, formatCount), ' grid card)'] : [s.sort === 'mean' ? 'the posterior mean' : 'the estimate']), ' within grades, grades 1 to ', ro(ctx, 'ro-shown', out.shown, formatCount), ' of ', ro(ctx, null, c.d.G, formatCount), '.']));
                    }
                    finally {
                        ctx.root.removeAttribute('aria-busy');
                    }
                } };
        } });
}
