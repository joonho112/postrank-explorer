// Full S-02 common header, risk/denominator boxes and report-card view.
// Source: v1 case-krw-race.js; the supplied non-Gaussian marginals are never refitted.
import KRW from '../../data/released/case-krw.json' with { type: 'json' };
import { drawReportCard, drawBetweenGrades, gradeLegend, REPORT_CARD_CSS } from './report-card.js';
import { betweenGradeErrors, disclosure, pairCount, relationChange, unitRelationCounts } from '../pr-core.js';
import { plot, numText, gradeColors } from '../shared/chart.js';
import { formatCount, formatDecimal, formatExpectedCount, formatGrades, formatPercent, formatRisk, formatSetting, formatShare, formatSizes } from '../shared/format.js';
import { captionNode, exposeResult } from '../shared/labels.js';
import { readKrwModel, cardAt, gridRows, gridIndex, keyOrder, blockOrder, appendKrwNotice } from '../shared/krw-model.js';
export { readKrwModel, gridRows, gridIndex, keyOrder, blockOrder, appendKrwNotice };
export const SORTS = Object.freeze([{ value: 'mean', label: 'posterior mean' }, { value: 'estimate', label: 'estimate' }, { value: 'krw', label: 'KRW’s figure order (the λ = 1 card)' }]);
export const ARCHIVE_KEYS = Object.freeze({ criterion: { type: 'choice', values: ['race', 'gender'], value: 'race' }, lambda: { type: 'number', min: .01, max: 1, step: .01, value: .25 }, sort: { type: 'choice', values: ['mean', 'estimate', 'krw'], value: 'mean' } });
export const KRW_COMMON_CSS = `${REPORT_CARD_CSS}
.prx-kr .kr-box{border:1px solid var(--prx-border);border-radius:6px;padding:.65rem .8rem;min-width:0;margin:.65rem 0}.prx-kr .kr-box h4{margin:0 0 .4rem;font-size:1rem}.prx-kr .kr-box p{margin:.35rem 0}.prx-kr .kr-note{font-size:.86rem;color:var(--prx-fg-muted);line-height:1.5}.prx-kr .kr-header p{margin:.3rem 0}.prx-kr .kr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:.7rem}.prx-kr .kr-scroll{overflow:auto;max-width:100%;outline-offset:2px}.prx-kr .kr-card-scroll{max-height:34rem;overflow:auto}.prx-kr .kr-card-scroll>div{min-width:0}.prx-kr .kr-table{border-collapse:collapse;width:100%;font-size:.86rem}.prx-kr .kr-table th,.prx-kr .kr-table td{padding:.35rem .45rem;border-bottom:1px solid var(--prx-border);text-align:right}.prx-kr .kr-table th:first-child,.prx-kr .kr-table td:first-child{text-align:left}.prx-kr .kr-key{display:inline-flex;align-items:center;gap:.35rem;margin-right:.8rem}.prx-kr .kr-swatch,.prx-kr .krw-map-swatch{display:inline-block;min-width:1.1rem;width:1.1rem;height:.75rem;border:1px solid var(--prx-plot-muted)}.prx-kr .kr-legend{display:flex;flex-wrap:wrap;gap:.35rem .65rem;font-size:.8rem}.prx-kr .kr-err{color:var(--prx-err-text)}.prx-kr .kr-wh{color:var(--prx-wh-text)}.prx-kr .kr-grade1{font-size:.92rem}.prx-kr [data-prx-readout$="sizes"]{white-space:normal;overflow-wrap:anywhere}.prx-kr .kr-wide-table{min-width:34rem}.prx-kr .kr-map{max-width:560px;margin:auto}.prx-kr .kr-table-wrap{max-height:28rem}.prx-kr .kr-precision-chart .prx-data-table table{min-width:28rem}.prx-kr .kr-controls-note{font-size:.85rem;margin:.3rem 0}.prx-kr .krw-map-key{display:inline-flex;align-items:center;gap:.3rem;margin-right:.7rem}.prx-kr .kr-stage-note{font-size:.9rem}.prx-kr .kr-table tr[aria-current="true"]{outline:2px solid var(--prx-plot-fg);outline-offset:-2px}
@media(max-width:40em){.prx-kr .kr-card-scroll{max-height:28rem}.prx-kr .kr-box{padding:.5rem}.prx-kr .kr-table{font-size:.8rem}}
.prx-kr .kr-precision-source code{color:inherit;background:transparent}`;
export function ro(ctx, name, value, format = formatDecimal) {
    const n = ctx.num(value, format(value));
    if (name)
        n.dataset.prxReadout = name;
    return n;
}
export const shortName = name => { const s = String(name).replace(/\s*\([^)]*\)\s*$/, ''); return s.length > 17 ? s.slice(0, 16) + '…' : s; };
export function criterionSpec(criterion) {
    if (criterion === 'absolute')
        return { label: 'Absolute gender', target: 'absolute gender-gap size', axis: 'Absolute log contact gap, either name advantage', short: 'Absolute gender gap', scale: 'Larger values mean a larger contact-gap magnitude, regardless of direction.', figure: 'folded target' };
    return criterion === 'race' ? { label: 'Race', target: 'white-name contact advantage', axis: 'Log contact gap, white-named minus Black-named', short: 'Log gap, white minus Black', scale: 'Positive values mean more contacts for white-named applicants.', figure: 'Figure 7, baseline race card' } : { label: 'Signed gender', target: 'male-name contact advantage', axis: 'Log contact gap, male-named minus female-named', short: 'Log gap, male minus female', scale: 'Positive values mean more contacts for male-named applicants; negative values mean more for female-named applicants.', figure: 'Figure 14, gender card' };
}
export const orientation = model => `Grade 1 = stated highest on ${criterionSpec(model.criterion).target}, as the posterior judges it. Same grade: no comparison, not equality.`;
export function publishedCardMatches(model, grade) { const p = KRW.tables.reports[`${model.criterion}_card`]; return grade.length === p.length && grade.every((g, i) => g === p[i]); }
/** Isolate the archived lambda-zero endpoint: no surrogate risk escapes to a consumer. */
export function archiveSnapshot(model, lambda) {
    const c = cardAt(model, lambda);
    if (c.tau > 0)
        return c;
    return { ...c, ev: { ...c.ev, risk: null, Rk: c.ev.Rk.map(() => null), errorTerm: null, withholdingTerm: null } };
}
export function riskDigits(c) {
    let d = 4;
    if (c.d.N > 0 && c.tau > 0)
        while (d < 6 && formatRisk(c.ev.risk, { digits: d }) === formatRisk(c.tau, { digits: d }))
            d++;
    return d;
}
export function archiveControls(ctx, { sort = true } = {}) { const criterion = ctx.radioGroup({ legend: 'Signed contact-gap target', name: 'criterion', options: [{ value: 'race', label: 'Race: white-name advantage' }, { value: 'gender', label: 'Gender: male-name advantage' }], value: ctx.state.criterion, onChange: v => ctx.set({ criterion: v }) }); const lambda = ctx.slider({ label: 'KRW’s λ: the card of KRW’s grid at this value', name: 'lambda', min: .01, max: 1, step: .01, value: ctx.state.lambda, onInput: v => ctx.set({ lambda: v }), hint: 'τ = λ/(1 + λ). The grid starts at the first positive λ.' }); const sorting = sort ? ctx.radioGroup({ legend: 'Within each grade, sort by', name: 'sort', options: SORTS, value: ctx.state.sort, onChange: v => ctx.set({ sort: v }) }) : null; ctx.controls.append(criterion.root, lambda.root, ...(sorting ? [sorting.root] : []), ctx.h('p', { class: 'kr-controls-note' }, 'λ rewards a correct direction; a wrong direction costs ', ctx.num(1, formatCount(1)), ' and silence pays ', ctx.num(0, formatCount(0)), '.')); return { render(s) { criterion.set(s.criterion); lambda.set(s.lambda); sorting?.set(s.sort); } }; }
// Presentation-only controls for the full card. Archive map/path keep their original controls.
export function compactArchiveControls(ctx) {
    const { h } = ctx;
    const target = ctx.segmented({ label: 'Target', name: 'criterion', value: ctx.state.criterion, options: [
        { value: 'race', label: 'Race', title: 'White-name contact advantage' },
        { value: 'gender', label: 'Gender', title: 'Male-name contact advantage' },
    ], onChange: criterion => ctx.set({ criterion }) });
    const lambda = ctx.slider({ label: 'KRW’s λ', name: 'lambda', min: .01, max: 1, step: .01, value: ctx.state.lambda, onInput: lambda => ctx.set({ lambda }) });
    const sort = ctx.select({ label: 'Sort within grades', name: 'sort', value: ctx.state.sort, options: SORTS, onChange: sort => ctx.set({ sort }) });
    const chip = h('div', { class: 'kr-lambda-chip' });
    lambda.root.append(chip);
    const row = h('div', { class: 'kr-compact-controls' }, target.root, ctx.primaryControl(lambda.root), sort.root);
    ctx.controls.append(row);
    return { row, render(s, c) {
        target.set(s.criterion); lambda.set(s.lambda); sort.set(s.sort);
        chip.replaceChildren('τ ', ro(ctx, null, c.tau, v => riskDigits(c) > 4 ? formatRisk(v, { digits: riskDigits(c) }) : formatSetting(v)));
    } };
}
export function createKrwHeader(ctx, slot) {
    const { h } = ctx;
    return { render(model, c) {
            const t = criterionSpec(model.criterion), n = (key, v, f) => ro(ctx, key, v, f), pub = publishedCardMatches(model, c.grade);
            let counts;
            if (c.d.G === 1)
                counts = ['One grade: every firm shares it, and the card states N = ', n('N', c.d.N, formatCount), ' of M = ', n('M', model.M, formatCount), ' pairs.'];
            else
                counts = [n('G', c.d.G, formatCount), c.d.G === model.n ? ' grades, one firm in each: a full order' : c.d.G > 10 ? ' grades (the largest holds ' : ' grades, ', ...(c.d.G === model.n ? [] : c.d.G > 10 ? [n('largest', Math.max(...c.d.sizes), formatCount), ' firms)'] : [n('sizes', c.d.sizes, formatSizes)]), '; it states N = ', n('N', c.d.N, formatCount), ' of M = ', n('M', model.M, formatCount), ' pairs, a share s = N/M = ', n('s', c.d.s, formatShare), '.'];
            if (c.d.G === 1) {
                counts.push(' ', n('G', c.d.G, formatCount), ' grade; ', n('sizes', c.d.sizes, formatSizes), '; s = ', n('s', c.d.s, formatShare), '.');
            }
            else if (c.d.G > 10)
                counts.push(' ', n('sizes', c.d.sizes, formatSizes), '.');
            slot.replaceChildren(h('h4', {}, 'KRW’s ', model.criterion === 'race' ? 'race' : 'gender', ' card, read with postrank’s loss'), h('p', {}, pub ? 'KRW’s published ' + t.figure : 'KRW’s grid card', ' at λ = ', n('lambda', c.lambda, formatSetting), ', which is τ = λ/(', n(null, 1, formatCount), ' + λ) = ', n('tau', c.tau, formatSetting), '.'), h('p', {}, ...counts), h('p', { class: 'kr-note' }, captionNode(ctx, 'krw-card'), '. KRW chose these grades using their own pair probabilities. We evaluate the published grades as a fixed report. ', captionNode(ctx, 'fixed-report'), '.'), h('p', { class: 'kr-note', text: orientation(model) + ' ' + t.scale }));
        } };
}
export function createKrwRiskView(ctx, slot) {
    const { h } = ctx;
    slot.classList.add('kr-box', 'prx-light-panel');
    return { render(model, c) {
            exposeResult(ctx, c.ev, 'evaluation');
            const body = h('div'), bar = h('div'), d = riskDigits(c), fmt = v => formatRisk(v, { digits: d }), n = (key, v) => ro(ctx, key, v, fmt);
            slot.replaceChildren(h('h4', { text: 'Risk at τ' }), body, bar);
            if (c.tau === 0) {
                body.textContent = 'λ zero is an archived endpoint. All postrank risk terms are unavailable at τ zero.';
                return;
            }
            body.append(h('p', {}, 'postrank’s risk of this card at τ = ', ro(ctx, 'risk-tau', c.tau, d > 4 ? fmt : formatSetting), ': ', n('risk', c.ev.risk), '. Withholding every comparison has risk τ = ', ro(ctx, null, c.tau, d > 4 ? fmt : formatSetting), '.'), h('p', {}, 'Risk = ', h('span', { class: 'kr-err' }, 'E/M'), ' + ', h('span', { class: 'kr-wh' }, 'τ(M − N)/M'), ' = ', h('span', { class: 'kr-err' }, n('err', c.ev.errorTerm)), ' + ', h('span', { class: 'kr-wh' }, n('wh', c.ev.withholdingTerm)), '.'), h('p', { class: 'kr-note' }, 'E is expected wrong directions, M all unordered pairs and N stated pairs. This risk is an ', captionNode(ctx, 'fixed-report'), ': postrank scores the card as it is and does not search for a better one. Its pair probabilities for these firms differ slightly from KRW’s archived ones, so we evaluate the card rather than call it the best one.'));
            slot.append(h('p', { class: 'kr-legend' }, h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: 'var(--prx-err)' } }), 'E/M'), h('span', { class: 'kr-key' }, h('span', { class: 'kr-swatch', style: { background: 'var(--prx-wh)' } }), 'τ(M − N)/M')));
            const rows = [{ term: 'Expected wrong directions / M', x1: 0, x2: c.ev.errorTerm, value: c.ev.errorTerm, kind: 'err' }, { term: 'Cost of withholding', x1: c.ev.errorTerm, x2: c.ev.risk, value: c.ev.withholdingTerm, kind: 'wh' }];
            plot(bar, { width: Math.max(1, Math.round(bar.clientWidth || ctx.width())), height: 86, aspect: false, marginTop: 25, marginBottom: 28, marginLeft: 8, marginRight: 24, x: { domain: [0, Math.max(.5, c.tau)], label: null }, y: { domain: [0, 1], axis: null }, alt: 'Risk is the sum of the expected error term and withholding term; dashed line is all withheld.', table: { caption: 'The two risk terms at this withholding cost', columns: [{ label: 'Term', value: 'term' }, { label: 'Value', value: 'value', format: fmt }], rows }, keyboard: { data: rows, x: 'x2', y: () => .5, sort: false, label: 'Read the two risk terms', title: r => `${r.term}: ${fmt(r.value)}` }, marks: (k, P) => [P.rectX(rows, { x1: 'x1', x2: 'x2', y1: 0, y2: 1, fill: r => r.kind === 'err' ? k.err : k.wh }), P.ruleX([c.tau], { stroke: k.plotFg, strokeDasharray: '4,3' }), P.text([c.tau], { x: v => v, y: () => 1, dy: -8, text: () => 'withhold all: τ', fill: k.plotFg })] });
        } };
}
export function createKrwDenominatorView(ctx, slot) {
    const { h } = ctx;
    slot.classList.add('kr-box', 'prx-light-panel');
    return { render(model, c) {
            slot.replaceChildren(h('h4', { text: 'Two denominators' }));
            if (c.d.N === 0) {
                slot.append(h('p', {}, 'No pairs stated: N = ', ro(ctx, 'denom-N', 0, formatCount), '. E/N is NA: no disclosure; DR = E/M is ', ro(ctx, 'DR', c.DR, formatShare), '. No E/N bar is drawn.'));
                return;
            }
            slot.append(h('p', {}, 'E = ', ro(ctx, 'E', c.ev.E[0], formatExpectedCount), ' expected wrong directions. DR = E/M = ', ro(ctx, 'DR', c.DR, formatShare), '; E/N = ', ro(ctx, 'EoverN', c.ev.EoverN[0], formatShare), '.'), h('p', { class: 'kr-note' }, 'DR = s × E/N: ', ro(ctx, null, c.DR, formatShare), ' ≈ ', ro(ctx, null, c.d.s, formatShare), ' × ', ro(ctx, null, c.ev.EoverN[0], formatShare), '. E/N and τ side by side: ', ro(ctx, null, c.ev.EoverN[0], formatShare), ' and ', ro(ctx, null, c.tau, formatSetting), '. A card that states few pairs can have a small DR beside a larger E/N. ', c.ev.risk < c.tau ? 'Here E/N < τ, so risk is below all withheld.' : 'Risk is below all withheld exactly when E < τN.'));
            const rows = [{ label: 'E/N: stated pairs', v: c.ev.EoverN[0], den: c.d.N }, { label: 'DR: all pairs', v: c.DR, den: model.M }], bar = h('div');
            slot.append(bar);
            plot(bar, { width: Math.max(1, Math.round(bar.clientWidth || ctx.width())), height: 116, aspect: false, marginLeft: 145, marginRight: 42, marginTop: 8, marginBottom: 28, x: { domain: [0, Math.max(.3, ...rows.map(r => r.v))], label: null }, y: { domain: rows.map(r => r.label), label: null, tickSize: 0 }, alt: 'The same expected errors divided by stated pairs or all pairs.', table: { caption: 'Expected wrong shares and denominators', columns: [{ label: 'Share', value: 'label' }, { label: 'Value', value: 'v', format: formatShare }, { label: 'Denominator', value: 'den', format: formatCount }], rows }, keyboard: { data: rows, x: 'v', y: 'label', sort: false, label: 'Read both denominators', title: r => `${r.label}: ${formatShare(r.v)}, denominator ${formatCount(r.den)}` }, marks: (k, P) => [P.barX(rows, { x: 'v', y: 'label', fill: k.err }), numText(rows, { x: 'v', y: 'label', value: 'v', format: formatShare, dx: 5, textAnchor: 'start', fill: k.plotFg })] });
        } };
}
/** Original observation precision against the exact grade vector of the displayed report. */
export function createKrwPrecisionView(ctx, slot, { prefix = 'card', onInspect = null } = {}) {
    const { h } = ctx, chart = h('div', { class: 'kr-precision-chart' }), source = h('p', { class: 'kr-note kr-precision-source' }), active = h('p', { class: 'kr-note kr-precision-active', 'aria-live': onInspect ? undefined : 'polite' }), vectors = h('details');
    slot.classList.add('kr-box', 'prx-light-panel');
    slot.dataset.prxPrecision = prefix;
    slot.append(h('h4', { text: 'Original sampling SE and current grades' }), source, chart, active, vectors, h('p', { class: 'kr-note', text: 'KRW uses a precision-dependent prior. Uncertain firms sharing a middle grade is not evidence of average behavior. This describes the released inputs and current report; it does not establish a causal effect or an accuracy comparison.' }));
    return { render(model, c) {
        const criterion = model.criterion === 'absolute' ? 'gender' : model.criterion, column = `${criterion}_se`, units = KRW.tables.units, se = units[column], fmt = v => formatDecimal(v, { digits: 4 });
        if (!se || model.ids.some((id, i) => id !== units.id[i] || se[i] !== model.se[i]))
            throw new Error('Original sampling SEs and displayed report IDs do not match');
        const rows = model.ids.map((id, i) => ({ i, id, name: model.names[i], se: se[i], grade: c.grade[i] })), title = r => `${r.name} (firm ID ${r.id}): original ${criterion} signed-estimate sampling SE ${fmt(r.se)}; current grade ${r.grade} of ${c.d.G}.`;
        source.replaceChildren(criterionSpec(model.criterion).label, ': all ', ro(ctx, `${prefix}-precision-n`, rows.length, formatCount), ' firms, original ', h('code', { text: column }), ' from the released case-krw observation table, matched by firm ID. ', model.criterion === 'absolute' ? 'For the folded report this is the signed gender estimate’s sampling SE, used only as a precision covariate; it is not an SE of the absolute target.' : 'These are sampling SEs of the original signed estimates, not posterior interval widths.');
        active.textContent = 'Focus the plot and use arrow keys to read every named firm; the matching table row is outlined.';
        const fig = plot(chart, { width: Math.max(1, Math.round(chart.clientWidth || ctx.width())), height: 280, aspect: false, marginLeft: 54, marginRight: 20, marginBottom: 48, marginTop: 16,
            x: { domain: [0, Math.max(...se) * 1.05], label: 'Original signed-estimate sampling SE', labelAnchor: 'center', labelArrow: 'none', grid: true }, y: { type: 'point', domain: Array.from({ length: c.d.G }, (_, i) => i + 1), label: 'Current grade', labelArrow: 'none', ticks: c.d.G <= 8 ? undefined : 8 },
            alt: `${criterionSpec(model.criterion).label}: original signed-estimate sampling standard error against the exact current report grade, for every firm. Grade one is at the top.`,
            table: { visible: true, caption: 'Complete precision view in released firm-ID order; exact original sampling SE and current report grade', columns: [{ label: 'Firm', value: 'name', name: true }, { label: 'Firm ID', value: 'id', name: true }, { label: 'Original signed-estimate sampling SE', value: 'se', format: fmt }, { label: 'Current grade', value: 'grade', format: formatCount }], rows },
            keyboard: { data: rows, x: 'se', y: 'grade', key: 'id', sort: false, label: 'All firms in released ID order. Use arrow keys, Home and End to inspect original sampling SE and current grade.', title, onFocus(r) { active.textContent = title(r); onInspect?.(r); chart.querySelectorAll('[data-prx-precision-row]').forEach(row => row.setAttribute('aria-current', row.dataset.prxPrecisionRow === r.id ? 'true' : 'false')); } },
            marks: (k, P) => { const colors = gradeColors(c.d.G, k); return [P.dot(rows, { x: 'se', y: 'grade', fill: r => colors[r.grade - 1], stroke: k.plotFg, strokeWidth: .45, r: 3.8, title }), P.tip(rows, P.pointer({ x: 'se', y: 'grade', title }))]; }
        });
        const table = fig.table;
        table.classList.add('kr-scroll', 'kr-table-wrap');
        table.querySelector('table').classList.add('kr-table');
        table.querySelectorAll('tbody tr').forEach((row, i) => { row.dataset.prxPrecisionRow = rows[i].id; row.children[2].dataset.prxReadout = `${prefix}-precision-se-${i}`; row.children[3].dataset.prxReadout = `${prefix}-precision-grade-${i}`; });
        vectors.replaceChildren(h('summary', { text: 'Full current grade vector in released firm-ID order' }), h('p', {}, ro(ctx, `${prefix}-precision-grade`, c.grade, formatGrades)));
    } };
}
export function createKrwCardView(ctx, slot, { rowPx = 13, topAxis = false, betweenTarget = null, detailsTarget = null, movementTarget = null, onPick = null } = {}) {
    const { h } = ctx, chart = h('div'), scroll = ctx.scrollRegion(h('div', { class: 'kr-card-scroll' }, chart), 'All firms on the report card; scroll to read every firm'), legend = h('div'), grade1 = h('p', { class: 'kr-grade1' }), note = h('p', { class: 'kr-note' }), movement = h('p', { class: 'kr-note' }), disc = h('div'), between = h('div'), betweenBox = h('section', { class: 'kr-box prx-light-panel' }, h('h4', { text: 'How reliable are comparisons between grades?' }), between);
    slot.classList.add('kr-box', 'prx-light-panel');
    const ruler = topAxis ? h('div', { class: 'kr-top-axis', 'aria-hidden': 'true' }) : null;
    slot.append(h('h4', { text: 'The card' }), h('p', { class: 'kr-note kr-axis-note' }), ...(ruler ? [ruler] : []), scroll, legend, grade1, note, movement, disc, betweenBox);
    const axesGuide = topAxis && detailsTarget ? h('p', { class: 'kr-note' }) : null;
    detailsTarget?.append(...(axesGuide ? [axesGuide] : []), note, disc);
    betweenTarget?.append(betweenBox);
    movementTarget?.append(movement);
    return { scroll, render(model, c, { sort = 'mean', reveal = 0, selected = null, flagged = [], sortInstruction = 'Switch the sort to see firms change places inside their grades; no firm ever leaves its grade.' } = {}) {
            const order = keyOrder(model, sort), narrow = (chart.clientWidth || ctx.width()) < 480, t = criterionSpec(model.criterion), card = { ids: order.map(i => model.ids[i]), names: order.map(i => narrow ? shortName(model.names[i]) : model.names[i]), fullNames: order.map(i => model.names[i]), mean: order.map(i => model.mean[i]), lower: order.map(i => model.lower[i]), upper: order.map(i => model.upper[i]), level: .9, intervalSource: 'supplied central posterior', storedOrder: 'input', axis: narrow ? t.short : t.axis, unit: 'firm', units: 'firms', title: typeof c.lambda==='number'?(model.criterion==='race'?'KRW’s race card':'KRW’s gender card'):(model.criterion==='absolute'?'Computed absolute-gap report':'Computed signed-gender report'), digits: 3 };
            const out = drawReportCard(chart, card, { grade: order.map(i => c.grade[i]), order: 'grade', reveal, rowPx, selected: Number.isInteger(selected) ? order.indexOf(selected) : undefined, title: card.title, keyboardLabel: 'All firms on the report card: use the arrow keys' }), rowsUnits = out.order.map(p => order[p]);
            const svg = chart.querySelector('figure svg');
            const shownUnits = rowsUnits.filter(i => c.grade[i] <= out.shown);
            if (flagged.length && svg) {
                const dots = [...svg.querySelectorAll('g[aria-label="dot"]')].at(-1);
                const flaggedSet = new Set(flagged);
                [...(dots?.querySelectorAll('circle') ?? [])].forEach((dot, j) => {
                    if (!flaggedSet.has(shownUnits[j])) return;
                    dot.setAttribute('data-kr-doubtful', String(shownUnits[j]));
                    dot.setAttribute('r', '3.5');
                });
            }
            if (ruler && svg) {
                const view = svg.viewBox.baseVal, bottom = view.height;
                const axes = [...svg.querySelectorAll('g[aria-label="x-axis tick"], g[aria-label="x-axis tick label"]')];
                const strip = ctx.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
                strip.setAttribute('viewBox', `0 ${bottom - 39} ${view.width} 22`);
                strip.setAttribute('width', String(view.width)); strip.setAttribute('height', '22');
                strip.setAttribute('style', svg.getAttribute('style') ?? '');
                strip.replaceChildren(...axes.map(n => n.cloneNode(true)));
                ruler.replaceChildren(strip);
            }
            if (onPick) chart.querySelectorAll('.prx-kbd-point').forEach((button, i) => {
                // Native button activation works with a pointer, touch, Enter, and Space.
                button.addEventListener('click', () => onPick(shownUnits[i]));
            });
            const hook = chart.querySelector(':scope > [data-prx-readout="order"]');
            if (hook) {
                hook.dataset.num = rowsUnits.join(',');
                hook.textContent = rowsUnits.map(formatCount).join(', ');
            }
            if (narrow) {
                const units = rowsUnits.filter(i => c.grade[i] <= out.shown);
                chart.querySelectorAll('.prx-data-table tbody tr').forEach((tr, r) => {
                    if (tr.firstElementChild && units[r] !== undefined)
                        tr.firstElementChild.textContent = model.names[units[r]];
                });
            }
            const axisExplanation = 'The axis sits at the bottom of the card: ' + t.axis + '; further right is a larger ' + t.target + '.';
            slot.querySelector('.kr-axis-note').textContent = topAxis ? t.short + ' · dot = posterior mean' : axisExplanation;
            if (axesGuide) axesGuide.textContent = axisExplanation;
            legend.replaceChildren(gradeLegend(ctx.doc, { grade: c.grade, colors: out.colors, unit: 'firm', units: 'firms', grade1: orientation(model), shown: out.shown }));
            const top = blockOrder(model, c.grade, 'mean').filter(i => c.grade[i] === 1);
            grade1.replaceChildren(...(c.d.G === 1 ? ['One grade: the card states no direction.'] : ['Grade 1: ', h('b', { text: top.map(i => model.names[i]).join(', ') }), '.']));
            note.replaceChildren(ro(ctx, 'level', .9, formatPercent), ' supplied central posterior intervals; dots are means. Sorted by ', ...(sort === 'krw' ? ['KRW’s figure order (the λ = ', ro(ctx, null, 1, formatCount), ' card)'] : [SORTS.find(s => s.value === sort).label.toLowerCase()]), ' within grades; a shared grade states no direction, so row order inside a grade claims nothing.');
            const ref = blockOrder(model, c.grade, 'mean'), positions = new Map(ref.map((i, p) => [i, p])), moves = rowsUnits.map((i, p) => ({ i, rows: Math.abs(positions.get(i) - p) })), moved = moves.filter(r => r.rows > 0), most = moves.reduce((a, b) => b.rows > a.rows ? b : a, moves[0]);
            movement.replaceChildren(...(moved.length ? [ro(ctx, 'moved', moved.length, formatCount), ' firms move within their grade compared with posterior-mean order. Largest move: ', model.names[most.i], ', ', ro(ctx, 'moved-most', most.rows, formatCount), ' rows; estimate ', ro(ctx, 'moved-estimate', model.estimate[most.i], v => formatDecimal(v, { digits: 3 })), ', SE ', ro(ctx, 'moved-se', model.se[most.i], v => formatDecimal(v, { digits: 3 })), ', posterior mean ', ro(ctx, 'moved-mean', model.mean[most.i], v => formatDecimal(v, { digits: 3 })), '. No firm leaves its grade.'] : [sortInstruction]));
            if (c.d.G > 8) {
                disc.replaceChildren(h('p', { class: 'kr-note' }, ro(ctx, 'disc-G', c.d.G, formatCount), ' grades: the per-grade disclosure and between-grade tables are not drawn. N = ', ro(ctx, 'disc-N', c.d.N, formatCount), '.'));
                betweenBox.hidden = true;
            }
            else {
                betweenBox.hidden = false;
                const bg = betweenGradeErrors(c.grade, model.E), rows = Array.from({ length: out.shown }, (_, k) => ({ g: k + 1, firms: c.d.sizes[k], stated: bg.filter(b => b.h === k + 1).reduce((s, b) => s + b.pairs, 0), inside: pairCount(c.d.sizes[k]) }));
                disc.replaceChildren(h('h4', { text: 'Disclosure by grade' }), h('table', { class: 'kr-table' }, h('caption', { text: 'Pairs against lower grades and pairs withheld within each shown grade' }), h('thead', {}, h('tr', {}, ...['Grade', 'Firms', 'Directions stated against lower grades', 'Pairs withheld inside'].map(text => h('th', { scope: 'col', text })))), h('tbody', {}, ...rows.map(r => h('tr', {}, h('th', { scope: 'row' }, ro(ctx, null, r.g, formatCount)), ...['firms', 'stated', 'inside'].map(key => h('td', {}, ro(ctx, `disc-${key}-${r.g}`, r[key], formatCount))))))), h('p', { class: 'kr-note' }, 'Whole card: ', ro(ctx, 'disc-N', c.d.N, formatCount), ' stated; ', ro(ctx, 'disc-W', c.d.withheld, formatCount), ' withheld; ', ro(ctx, 'disc-M', model.M, formatCount), ' total pairs.', out.shown < c.d.G ? ' Tables show only revealed grades.' : ''));
                drawBetweenGrades(between, { grade: c.grade, E: model.E, mean: model.mean, shown: out.shown, names: model.names, hookPrefix: 'bg-', caption: "Each cell below the diagonal is the expected share of wrong stated directions between two grades, over the pairs counted below it. Each pair adds the probability that stating the firm of the column’s grade above the firm of the row’s grade is wrong. Diagonal: the grade’s average posterior mean. Solid outline: adjacent grades; dashed outline: grade averages. This display follows KRW Figure 10A (§VI.B)." });
                between.querySelectorAll('[data-prx-readout^="bg-gmean-"]').forEach(node => { node.textContent = formatDecimal(Number(node.dataset.num), { digits: 3 }); });
            }
            return out;
        } };
}
export function archiveReadoutParts(ctx, model, c, extra = []) { const f = v => formatRisk(v, { digits: riskDigits(c) }); return ['At λ = ', ro(ctx, 'ro-lambda', c.lambda, formatSetting), ' (τ = ', ro(ctx, 'ro-tau', c.tau, f), '), the card has ', ro(ctx, 'ro-G', c.d.G, formatCount), c.d.G === 1 ? ' grade and states ' : ' grades and states ', ro(ctx, 'ro-N', c.d.N, formatCount), ' of ', ro(ctx, 'ro-M', model.M, formatCount), ' pairs. Its risk at τ is ', ro(ctx, 'ro-risk', c.ev.risk, f), '. ', ...(c.d.N > 0 ? ['E/N = ', ro(ctx, 'ro-EoverN', c.ev.EoverN[0], formatShare), '. '] : []), 'DR = ', ro(ctx, 'ro-DR', c.DR, formatShare), '. ', ...extra]; }
export function createArchiveReadout(ctx, model, c, extra = []) { ctx.readout.set(archiveReadoutParts(ctx, model, c, extra)); }
export function previousGridChange(model, c) { return c.index > 1 ? relationChange(model.grid.grade[c.index - 1], c.grade) : null; }
