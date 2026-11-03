import { createWidget } from '../shared/base.js';
import { statedAbove } from '../pr-core.js';
import { formatCount, formatProb } from '../shared/format.js';
import { KRW_COMMON_CSS, ARCHIVE_KEYS, archiveControls, archiveSnapshot, readKrwModel, createKrwHeader, createKrwRiskView, createKrwDenominatorView, createKrwCardView, createKrwPrecisionView, createArchiveReadout, appendKrwNotice, ro } from './krw-common.js';
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'krw-card', className: 'prx-kr prx-rc', css: KRW_COMMON_CSS, label: 'Read KRW’s full race and signed gender report cards', keys: { ...ARCHIVE_KEYS, reveal: { type: 'integer', min: 0, max: 97, value: 0 } }, build(ctx) {
            const { h } = ctx, controls = archiveControls(ctx);
            let lastG = 1;
            const reveal = ctx.button({ label: 'Reveal grade by grade', key: 'reveal-next', onClick: () => ctx.set({ reveal: ctx.state.reveal === 0 || ctx.state.reveal >= lastG ? 1 : ctx.state.reveal + 1 }) }), all = ctx.button({ label: 'Show all grades', key: 'reveal-all', onClick: () => ctx.set({ reveal: 0 }) });
            ctx.controls.append(h('div', { class: 'prx-control' }, reveal.root, all.root));
            const header = h('section', { class: 'kr-header' }), card = h('section'), precision = h('section'), risk = h('section'), denom = h('section'), note = h('section', { class: 'kr-box prx-light-panel' });
            ctx.charts.append(card, precision, header, h('div', { class: 'kr-grid' }, risk, denom), note);
            const views = [createKrwHeader(ctx, header), createKrwRiskView(ctx, risk), createKrwDenominatorView(ctx, denom)], cardView = createKrwCardView(ctx, card), precisionView = createKrwPrecisionView(ctx, precision);
            appendKrwNotice(ctx);
            return { render(s) {
                    ctx.root.setAttribute('aria-busy', 'true');
                    try {
                        controls.render(s);
                        const model = readKrwModel(s.criterion), c = archiveSnapshot(model, s.lambda);
                        views.forEach(v => v.render(model, c));
                        const out = cardView.render(model, c, s);
                        precisionView.render(model, c);
                        lastG = c.d.G;
                        reveal.setLabel(s.reveal === 0 ? 'Reveal grade by grade' : out.shown < c.d.G ? 'Reveal next grade' : 'Start again at grade 1');
                        reveal.setDisabled(c.d.G === 1);
                        all.setDisabled(s.reveal === 0 || s.reveal >= c.d.G || c.d.G === 1);
                        if (s.criterion === 'race') {
                            note.replaceChildren(h('h4', { text: 'Grades follow the posterior, not raw estimates' }), h('p', {}, 'On the published baseline card, grade 1 holds Genuine Parts (Napa Auto) and AutoNation. Four grade-2 firms have larger estimates than Genuine Parts: Nationwide, Costco, Builders FirstSource and CVS Health. AutoNation has the largest estimate; Genuine Parts has the largest posterior mean. Under KRW’s precision-dependent prior, a wider posterior can pull an estimate toward the middle.'), h('p', { class: 'kr-note' }, 'KRW call ★ (one star) the worst grade (§VI). Direction table: postrank grades ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), ' = stars ★/★★/★★★ = exported labels ', ro(ctx, null, [1, 2, 3], v => v.map(formatCount).join('/')), '; body labels dᵢ ', ro(ctx, null, [3, 2, 1], v => v.map(formatCount).join('/')), '; reconstructed dᵢ* ', ro(ctx, null, [1, 3, 84], v => v.map(formatCount).join('/')), '.'));
                        }
                        else {
                            const questionable = statedAbove(c.grade, model.E, { tau: .5 });
                            note.replaceChildren(h('h4', { text: 'Both ends of the signed scale are contact gaps' }), h('p', {}, 'A male-name advantage is positive; a female-name advantage is negative. Read KRW’s stars with the target, not as better or worse. Coherence may state doubtful directions: ', ro(ctx, 'doubtful-count', questionable.count, formatCount), ' stated directions here are more likely wrong than right.'), ...questionable.pairs.map(p => h('p', { class: 'kr-note' }, model.names[p.i], ' above ', model.names[p.j], ': wrong-direction probability ', ro(ctx, `doubtful-error-${p.i}-${p.j}`, p.error, formatProb), '.')));
                        }
                        createArchiveReadout(ctx, model, c, ['Showing the card, rows by ', ...(s.sort === 'krw' ? ['KRW’s figure order (the λ = ', ro(ctx, null, 1, formatCount), ' grid card)'] : [s.sort === 'mean' ? 'the posterior mean' : 'the estimate']), ' within grades, grades 1 to ', ro(ctx, 'ro-shown', out.shown, formatCount), ' of ', ro(ctx, null, c.d.G, formatCount), '.']);
                    }
                    finally {
                        ctx.root.removeAttribute('aria-busy');
                    }
                } };
        } });
}
