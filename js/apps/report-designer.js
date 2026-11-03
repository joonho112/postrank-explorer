// Public case inputs -> a named report family -> fixed-report checks and a reproducible account.
import { createWidget } from '../shared/base.js';
import { caseInput, caseCard, CASE_KEYS } from '../shared/case-inputs.js';
import { drawReportCard, gradeLegend, REPORT_CARD_CSS } from './report-card.js';
import { drawRelationMatrix, REPORT_BUILDER_CSS } from './report-builder.js';
import { createBudgetFeasibilityView, createBudgetProfileView, BUDGET_CSS, parseBudgetQ } from './error-budgets.js';
import { budgetCheck, compareReports, disclosure, evaluateReport, exactOptimum, expectedRank, familySize, fixedOrderDP, largestStatedError, relations, scoreOrder } from '../pr-core.js';
import { captionNode, labelId, labelNode, labelText, tagNode } from '../shared/labels.js';
import { formatCount, formatDecimal, formatExpectedCount, formatGrades, formatPercent, formatRisk, formatSci, formatSetting, formatShare, formatSizes, formatSigned, formatTuple } from '../shared/format.js';
export const DEFAULTS = Object.freeze({ cde: { tau: .2, cap: 3, w: 1 }, krw: { tau: .25, cap: 4, w: .5 }, alabama: { tau: .2, cap: 5, w: .5 } });
export const KEYS = { case: { type: 'choice', values: CASE_KEYS, value: 'cde' }, tau: { type: 'number', min: .01, max: .5, step: .01, value: .2 }, cap: { type: 'integer', min: 1, max: 97, value: 3 }, w: { type: 'number', min: 0, max: 1, step: .01, value: 1 }, qa: { type: 'custom', value: null, parse: parseBudgetQ }, qb: { type: 'custom', value: null, parse: parseBudgetQ }, view: { type: 'choice', values: ['card', 'relations', 'report'], value: 'card' }, criterion: { type: 'integer', min: 0, max: 1, value: 0 }, focus: { type: 'string', value: 'auto' } };
const cache = new Map();
export function designerModel(s) {
    const input = caseInput(s.case), cap = Math.min(input.n, s.cap), w = input.K === 1 ? [1] : [s.w, 1 - s.w], key = JSON.stringify([s.case, s.tau, cap, w]);
    let base = cache.get(key);
    if (!base) {
        const requestedFamily = { kind: 'atMost', G: cap }, requestedSize = familySize(input.n, requestedFamily), enumerate = input.n <= 20 && requestedSize <= 600000n && s.case === 'cde' && cap <= 3;
        const er = expectedRank(input.E, { w }), orderScores = enumerate ? null : s.case === 'cde' ? input.marginals.mean[0] : er, direction = s.case === 'cde' ? 'descending' : 'ascending';
        const optimum = enumerate ? exactOptimum(input.E, { tau: s.tau, w, family: requestedFamily, tieTol: 1e-12, maxTies: 100 }) : fixedOrderDP(input.E, { tau: s.tau, w, G: cap, scores: orderScores, direction, tieTol: 1e-12, maxTies: 100 });
        const grade = optimum.grade, evaluation = evaluateReport(grade, input.E, { tau: s.tau, w }), comparison = compareReports(input.archive.grade, grade, input.E, { tau: s.tau, w });
        const largest = input.criteria.map((_, k) => largestStatedError(grade, input.E, { w: input.criteria.map((__, j) => Number(j === k)) }));
        base = { input, cap, w, tau: s.tau, requestedSize, optimum, grade, evaluation, comparison, largest, expectedRank: er, order: enumerate ? null : scoreOrder(orderScores, { direction, ids: input.ids }).order, method: enumerate ? 'enumeration' : s.case === 'cde' ? 'posterior-mean order' : 'weighted expected-rank order' };
        if (cache.size > 40)
            cache.clear();
        cache.set(key, base);
    }
    const q = input.K === 1 ? [s.qa] : [s.qa, s.qb], check = budgetCheck(base.grade, input.E, q);
    return { ...base, q, budget: check, profileModel: { profiles: [{ grade: base.grade, evaluation: base.evaluation, largest: base.largest }], data: { criteria: input.criteria, criterionLabels: input.criterionLabels, ids: input.labels }, w: base.w } };
}
export const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
export function csvText(rows) { return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
const rString = value => JSON.stringify(String(value));
// R and JS decimal parsers can differ by one ULP. Hexadecimal R literals preserve every supplied binary double exactly.
const rNumber = value => value === null ? 'NA_real_' : Number.isInteger(value) ? String(value) : (value < 0 ? '-' : '') + '0x' + Math.abs(value).toString(16) + 'p0';
const rVector = values => 'c(' + values.map(value => typeof value === 'string' ? rString(value) : rNumber(value)).join(', ') + ')';
// One account feeds the visible model and standalone TXT; numerical tokens retain their readout hooks.
function reportSentenceParts(m) {
    const d = m.input, e = m.evaluation, n = (key, value, format) => ({ key, value, format });
    return [`${d.title}. Targets: ${d.criteria.map(c => d.targets[c]).join('; ')}. ${d.grade1} Posterior conditioning: ${d.conditioning} `,
        d.dependenceScope ? d.dependenceScope + ' ' : '',
        'With withholding cost tau=', n('sentence-tau', m.tau, formatSetting), ', at most ', n('sentence-cap', m.cap, formatCount),
        ' grades, and criterion error weights ', n('sentence-weights', m.w, v => formatTuple(v, formatSetting)), ', this report states ', n('sentence-N', e.N, formatCount), ' of ', n('sentence-M', e.M, formatCount),
        ' pair directions. Expected wrong shares among stated directions: ', ...d.criterionLabels.flatMap((label, k) => [k ? '; ' : '', label + ' ', n('sentence-share-' + k, e.EoverN[k], formatShare)]),
        '. ', { result: m.optimum }, m.method === 'enumeration' ? '' : ' (the ' + m.method + ')', '; ', n('familySize', m.optimum.family.size, formatCount), ' reports in this family; tie tolerance ', n('sentence-tieTol', m.optimum.tieTol, formatSci),
        '. A shared grade withholds comparisons and does not assert equality. These are posterior-expected shares, not the probability that every direction is correct; allocation requires a separate rule. The scope is the supplied case frame, with unassessed units suppressed rather than graded last.',
        d.key === 'krw' ? ' These data describe the historical experiment, not any firm’s current conduct.' : ''];
}
export function reportSentence(m) { return reportSentenceParts(m).map(part => typeof part === 'string' ? part : part.result ? labelText(labelId(part.result), part.result.family) : part.format(part.value)).join(''); }
/** Export exact supplied coefficients in R's column-major array order; no fitting and no budget reoptimization. */
export function exportR(m) {
    const d = m.input, values = [];
    for (let k = 0; k < d.K; k++)
        for (let j = 0; j < d.n; j++)
            for (let i = 0; i < d.n; i++)
                values.push(d.E.e[k][i][j]);
    const dims = `c(${d.n}L, ${d.n}L, ${d.K}L)`, targets = d.criteria.map(c => d.targets[c] ?? d.conditioning), marginal = name => `matrix(${rVector(d.marginals[name].flat())},nrow=${d.n}L,ncol=${d.K}L,dimnames=list(ids,criteria))`;
    let code = `# Exact released inputs and displayed fixed report from postrank Explorer v3\n# ${d.notice.attribution}\n# ${d.notice.changes}\n# ${d.notice.text}\n# This script does not reconstruct a Gaussian or a joint cross-criterion posterior.\nlibrary(postrank)\nids <- ${rVector(d.ids)}\ncriteria <- ${rVector(d.criteria)}\ne <- array(${rVector(values)},dim=${dims},dimnames=list(ids,ids,criteria))\nsummaries <- list(means=${marginal('mean')},lower=${marginal('lower')},upper=${marginal('upper')},level=${rNumber(d.marginals.level)},same_targets=TRUE,description=${rString(d.marginals.intervalSource)})\nx <- postrank_probabilities(e,event="directional_error",zero_ties=TRUE,margin=0,correction="none",source=list(kind="published_reference",description=${rString(d.notice.attribution)},conditioning=${rString(d.conditioning)}),targets=setNames(${rVector(targets)},criteria),summaries=summaries)\nweights <- setNames(${rVector(m.w)},criteria)\nsettings <- postrank_settings(weights=weights,tau=${rNumber(m.tau)},G_max=${m.cap}L)\ngrade <- setNames(${rVector(m.grade)},ids)\nevaluation <- postrank_evaluate(grade,x,settings=settings)\nprint(evaluation[c("N","M","E","E_over_N","primary_risk")])\nq <- setNames(${rVector(m.q)},criteria)\nactive <- !is.na(q)\nbudget_rows <- data.frame(criterion=criteria[active],q=q[active],N=rep(evaluation$N,sum(active)),E=evaluation$E[active],E_over_N=evaluation$E_over_N[active],qN=q[active]*evaluation$N,slack=q[active]*evaluation$N-evaluation$E[active])\nbudget_rows$meets <- budget_rows$slack >= -1e-12*evaluation$M\nprint(budget_rows)\n# Homogeneous count-form check uses the browser risk-scale tolerance of 1e-12.\n# Budgets check this displayed grade only; they do not choose a different report.\n`;
    if (m.method !== 'enumeration') {
        const ordinal = Array(d.n);
        let at = 0;
        for (let b = 0; b < m.optimum.blocks.length; b++)
            for (let j = 0; j < m.optimum.blocks[b]; j++)
                ordinal[m.optimum.order[at++]] = b + 1;
        code += `# Ordinal scores encode the browser's exact order and whole score blocks.\n# Decimal/library rounding of recomputed ER must not silently change this family.\nscores <- setNames(${rVector(ordinal)},ids)\nrecomputed_expected_rank <- postrank_expected_rank(x,weights)\ncuts <- postrank_cuts(scores,x,settings,direction="ascending",rule="optimal")\nprint(cuts$evaluation[c("N","E_over_N","primary_risk")])\n# This is optimal within the declared frozen score order, not over every report.\n# R uses exact objective ties; the browser uses its displayed equal-risk tolerance.\n`;
    }
    else
        code += '# Optional same capped-family analysis in R (not run here):\n# analysis <- postrank(x,weights=weights,tau=' + m.tau + ',G_max=' + m.cap + 'L,backend="highs")\n# Inspect analysis status, bound and gap; do not transfer the archived certificate.\n';
    code += '# Stored archive metadata belongs only to its original setting:\narchive_record <- list(id=' + rString(d.archive.id) + ',tau=' + rNumber(d.archive.settings.tau) + ',G_max=' + d.archive.settings.G_max + 'L,weights=' + rVector(d.archive.settings.w) + ',status=' + rString(d.archive.status) + ',lower_bound=' + rNumber(d.archive.lowerBound) + ',gap=' + rNumber(d.archive.gap) + ')\n';
    return code;
}
export function exportTables(m) { const d = m.input, e = m.evaluation; const tables = { units: [['entity_id', 'label', 'grade', ...d.criteria.flatMap(c => ['mean_' + c, 'lower_' + c, 'upper_' + c])], ...d.ids.map((id, i) => [id, d.labels[i], m.grade[i], ...d.criteria.flatMap((_, k) => [d.marginals.mean[k][i], d.marginals.lower[k][i], d.marginals.upper[k][i]])])], profile: [['criterion', 'weight', 'E', 'N', 'M', 'E_over_N', 'E_over_M', 'risk', 'tau', 'cap', 'family', 'q', 'qN', 'slack', 'budget_meets'], ...d.criteria.map((c, k) => [c, m.w[k], e.E[k], e.N, e.M, e.EoverN[k], e.EoverM[k], e.Rk[k], m.tau, m.cap, m.optimum.family.words, ...['q','qN','slack','meets'].map(key=>m.budget.rows.find(row=>row.k===k)?.[key]??null)])], relations: [['first_id', 'second_id', 'relation'], ...relations(m.grade).flatMap((row, i) => row.map((value, j) => [d.ids[i], d.ids[j], value]))] }; const metadata = ['source_attribution', 'change_notice', 'rights', 'conditioning']; for (const rows of Object.values(tables)) {
    rows[0].push(...metadata);
    for (let i = 1; i < rows.length; i++)
        rows[i].push(...(i === 1 ? [d.notice.attribution, d.notice.changes, d.notice.text, d.conditioning] : metadata.map(() => '')));
} return tables; }
export function sentenceHints(text, model = null) {
    const hits = [];
    const withoutNegations = text.replace(/\b(?:not|never|does\s+not|do\s+not|is\s+not|are\s+not)\b[^.!?;]{0,65}\b(?:equal|equality|same\s+score|certified|guaranteed|confidence\s+level|significance\s+level)\b/gi, '').replace(/\b(?:no|not\s+a)\s+(?:claim|assertion|guarantee)\s+of\s+(?:equality|equal\s+scores)\b/gi, '');
    for (const [pattern, repair] of [[/\b(?:(?:same|shared)\s+grade[^.!?;]{0,40}(?:equal|equality|same\s+(?:score|value|outcome))|grade\s*\d+[^.!?;]{0,40}equal|equal\s+scores)\b/i, 'A shared grade withholds comparisons; it does not establish equality.'], [/\b(?:certified\s+optimal|guaranteed\s+correct)\b/i, 'Use the actual family and result label; a numerical solver gap is not posterior certainty.'], [/\b(?:confidence\s+level|significance\s+level)\b/i, 'tau is the cost of withholding a pair, not a confidence level.']]) {
        const found = withoutNegations.match(pattern);
        if (found)
            hits.push({ phrase: found[0], repair });
    }
    if (/(?:\blambda|λ)\s*(?:=|is|equals)\s*(?:tau\b|τ)/i.test(withoutNegations))
        hits.push({ phrase: withoutNegations.match(/(?:\blambda|λ)\s*(?:=|is|equals)\s*(?:tau\b|τ)/i)[0], repair: 'lambda and tau are different loss parameters; name the actual withholding cost tau.' });
    if (/\berror\s+rate\b/i.test(text) && !/(?:stated|disclosed|all\s+pairs|E\s*\/\s*N|E\s*\/\s*M|denominator)/i.test(text))
        hits.push({ phrase: text.match(/\berror\s+rate\b/i)[0], repair: 'Name the denominator: stated directions or every pair.' });
    for (const [pattern, repair] of [[/(?:tau|τ|withholding)/i, 'State the withholding cost and why it was chosen.'], [/(?:cap|at\s+most|grades)/i, 'Name the grade cap.'], [/(?:weight|criterion)/i, 'Name the criterion weights and their provenance.'], [/(?:family|within|order)/i, 'Name the optimization family and scope.']])
        if (text.trim() && !pattern.test(text))
            hits.push({ phrase: 'Missing scope', repair });
    const gradeTerms = withoutNegations.replace(/(?:weighted\s+)?expected[- ]rank\s+order|income\s+rank/gi, '').replace(/\bnot\s+(?:a\s+)?(?:tier|rank)s?(?:\s+or\s+(?:a\s+)?(?:tier|rank)s?)?/gi, '');
    const gradeTerm = gradeTerms.match(/\b(?:tiers?|ranks?)\b/i);
    if (gradeTerm)
        hits.push({ phrase: gradeTerm[0], repair: 'Call the reported categories grades. A grade is not a tier or a rank; a shared grade withholds directions.' });
    if (model?.evaluation.N === 0) {
        const zeroShare = text.match(/(?:E(?:_k)?\s*\/\s*N|expected\s+wrong\s+share|error\s+(?:rate|share))\s*(?:=|is|of|:)\s*0(?:\.0+)?(?!\d|\.\d)\s*%?/i);
        if (zeroShare)
            hits.push({ phrase: zeroShare[0], repair: 'At N = 0, write E/N = NA: no disclosure. A passing homogeneous budget does not establish an informative or error-free ranking.' });
    }
    return hits;
}
const CSS = `${REPORT_CARD_CSS}${REPORT_BUILDER_CSS}${BUDGET_CSS}
.des .des-box{border:1px solid var(--prx-border);border-radius:6px;padding:.65rem .8rem;margin:.65rem 0;min-width:0}.des .des-box h4{margin:0 0 .45rem;font-size:1rem}.des .des-note{font-size:.86rem;line-height:1.5;color:var(--prx-fg-muted)}.des .des-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr));gap:.75rem}.des .des-card-scroll{max-height:32rem;overflow:auto}.des .des-scroll{max-width:100%;overflow:auto}.des .des-matrix-scroll{max-height:30rem;overflow:auto;max-width:100%}.des table.des-table{width:100%;border-collapse:collapse;font-size:.84rem}.des .des-table th,.des .des-table td{padding:.35rem .45rem;border-bottom:1px solid var(--prx-border);text-align:left;vertical-align:top}.des .des-wide{min-width:46rem}.des .des-export-buttons{display:flex;flex-wrap:wrap;gap:.4rem}.des textarea{width:100%;min-height:8rem;box-sizing:border-box;background:var(--prx-bg);color:var(--prx-fg);border:1px solid var(--prx-border);border-radius:4px;padding:.5rem;font:inherit}.des .des-status{font-size:.9rem;font-weight:600}.des .des-grade{overflow-wrap:anywhere}.des .ebu-table-wrap{color:var(--prx-plot-fg)}.des .des-pair{font-size:.9rem}.des .des-controls-help{font-size:.85rem;margin:.25rem 0}.des .des-setting-table{min-width:26rem}.des .des-checklist table{min-width:44rem}.des .des-checklist th:first-child{min-width:9rem}.des .des-checklist td:last-child{min-width:12rem;overflow-wrap:anywhere}.des .des-checklist code{font-size:.8rem}.des [data-prx-readout="grades"],.des .des-grade .prx-num{white-space:normal;overflow-wrap:anywhere}
@media(max-width:40em){.des .des-box{padding:.5rem}.des .des-card-scroll{max-height:26rem}}
`;
function focusPair(input, key) { const ids = String(key).split(','), i = input.ids.indexOf(ids[0]), j = input.ids.indexOf(ids[1]); return i >= 0 && j >= 0 ? { i, j } : { i: 0, j: Math.min(1, input.n - 1) }; }
function num(ctx, key, value, format = formatDecimal) { const n = ctx.num(value, format(value)); if (key)
    n.dataset.prxReadout = key; return n; }
// Preserve source wording verbatim while annotating its literal counts, dates, versions and DOI components.
// These are supplied metadata, not computed statistics or numeric-audit exemptions.
function sourceFragments(ctx, text) { const out = []; let at = 0; for (const m of String(text).matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    out.push(String(text).slice(at, m.index), ctx.num(Number(m[0].replaceAll(',', '')), m[0]));
    at = m.index + m[0].length;
} out.push(String(text).slice(at)); return out; }
function smallTable(ctx, caption, heads, rows, { wide = false } = {}) { const { h } = ctx; const table = h('table', { class: `des-table${wide ? ' des-wide' : ''}` }, h('caption', { text: caption }), h('thead', {}, h('tr', {}, ...heads.map(text => h('th', { scope: 'col', text })))), h('tbody', {}, ...rows.map(row => h('tr', {}, ...row.map((cell, j) => h(j ? 'td' : 'th', j ? {} : { scope: 'row' }, cell)))))); return ctx.scrollRegion(h('div', { class: 'des-scroll' }, table), caption); }
export function mountWidget(el, spec = {}) {
    return createWidget(el, spec, { name: 'report-designer', className: 'des prx-rc prx-rb ebu', css: CSS, label: 'Grade a public case, inspect its scope, and export an honest report', keys: KEYS, build(ctx) {
            const { h } = ctx;
            let current = null, generation = 0, closed = false, timer = null;
            const note = h('p', { class: 'des-status', role: 'status' }), quick = h('p', { class: 'des-note' }), membership = h('details', {}, h('summary', { text: 'Every unit and its displayed grade' })), summary = h('section', { class: 'des-box prx-light-panel' }), cardBox = h('section', { class: 'des-box prx-light-panel' }), cardChart = h('div'), axisNote = h('p', { class: 'des-note' }), cardLegend = h('div'), matrixSlot = h('div'), matrixLegend = h('div'), matrixRegion = ctx.scrollRegion(h('div', { class: 'des-matrix-scroll' }, matrixSlot), 'Complete relation matrix; scroll both axes'), relationBox = h('section', { class: 'des-box prx-light-panel' }, h('h4', { text: 'Every relation in the displayed report' }), h('p', { class: 'des-note', text: 'The matrix retains every row and column. Arrow keys read every cell; Home and End move to the corners. The complete pair table is below the matrix.' }), matrixRegion, matrixLegend), pairNote = h('p', { class: 'des-pair' }), changesBox = h('section', { class: 'des-box prx-light-panel' }), profileBox = h('section', { class: 'des-box prx-light-panel' }), budgetBox = h('section', { class: 'des-box prx-light-panel' }), archiveBox = h('section', { class: 'des-box prx-light-panel' }), reportBox = h('section', { class: 'des-box' }), provenance = h('details', {}, h('summary', { text: 'Targets, settings provenance, source and archived computation' })), provenanceBody = h('div'), rights = h('div', { class: 'des-note' }), modelSentence = h('p', { 'data-prx-readout': 'model-sentence' }), checklist = h('section', { class: 'des-checklist', 'data-prx-readout': 'reporting-checklist' }), draft = h('textarea', { 'aria-label': 'Your reporting draft', placeholder: 'Draft a sentence for this report. It stays in this component and is not put in the URL, iframe state or storage.' }), feedback = h('div'), downloads = h('div', { class: 'des-export-buttons' });
            // The reused chart places its tip in the target-phase focus handler. Reveal the focused
            // native point first, within this card's own bounded scroller, without moving the outer page.
            const revealCardPoint = event => {
                const point = event.target.closest?.('.prx-kbd-point'), scroller = point?.closest('.des-card-scroll');
                if (!scroller || !scroller.clientHeight) return;
                const row = point.getBoundingClientRect(), box = scroller.getBoundingClientRect();
                scroller.scrollTop += row.top + row.height / 2 - (box.top + scroller.clientTop + scroller.clientHeight / 2);
            };
            ctx.listen(cardChart, 'focus', revealCardPoint, { capture: true });
            ctx.listen(cardChart, 'keydown', event => { if (/^(?:Arrow(?:Up|Down|Left|Right)|Home|End)$/.test(event.key)) revealCardPoint(event); }, { capture: true });
            provenance.append(provenanceBody);
            cardBox.append(h('h4', { text: 'The displayed report: supplied marginal intervals' }), axisNote, ctx.scrollRegion(h('div', { class: 'des-card-scroll' }, cardChart), 'All units on the report card'), cardLegend, pairNote);
            reportBox.append(h('h4', { text: 'A model reporting sentence' }), modelSentence, membership, checklist, h('h4', { text: 'Your draft: local wording hints' }), h('p', { class: 'des-note', text: 'These are vocabulary hints, not statistical validation or a writing score. Draft text never leaves this component except when you explicitly download it.' }), draft, feedback);
            ctx.charts.append(note, quick, cardBox, relationBox, reportBox, summary, profileBox, budgetBox, changesBox, archiveBox, provenance, h('section', { class: 'des-box' }, h('h4', { text: 'Download the exact inputs and report' }), downloads, h('p', { class: 'des-note', text: 'CSV files keep every row; the R script embeds the exact released arrays, supplied summaries, declared settings and displayed grade. Budgets remain a check. All downloads are made locally.' })), rights);
            const profile = createBudgetProfileView(ctx, profileBox);
            const choose = ctx.select({ label: 'Public case', name: 'case', options: [{ value: 'cde', label: 'CDE: twelve schools' }, { value: 'krw', label: 'KRW: all 97 firms' }, { value: 'alabama', label: 'Alabama: all 67 counties' }], value: ctx.state.case, onChange: key => ctx.set({ case: key, ...DEFAULTS[key], qa: null, qb: null, criterion: 0, focus: 'auto' }) }), tau = ctx.slider({ label: 'Cost per withheld pair, τ', ...ctx.key('tau'), onInput: tau => ctx.set({ tau }) }), cap = ctx.numberInput({ label: 'At most this many grades', min: 1, max: 97, step: 1, value: ctx.state.cap, name: 'cap', onInput: cap => ctx.set({ cap: Math.min(caseInput(ctx.state.case).n, Math.round(cap)) }) }), weight = ctx.slider({ label: 'Error weight on the first criterion (the second gets the remainder)', ...ctx.key('w'), onInput: w => ctx.set({ w }) }), view = ctx.radioGroup({ legend: 'Inspect', name: 'view', options: [{ value: 'card', label: 'Report card' }, { value: 'relations', label: 'All relations and changes' }, { value: 'report', label: 'Reporting sentence' }], value: ctx.state.view, onChange: view => ctx.set({ view }) }), criterion = ctx.radioGroup({ legend: 'Supplied marginal shown on the card', name: 'criterion', options: [{ value: 0, label: 'First criterion' }, { value: 1, label: 'Second criterion' }], value: ctx.state.criterion, onChange: v => ctx.set({ criterion: Number(v) }) });
            ctx.controls.append(choose.root, tau.root, cap.root, weight.root, view.root, criterion.root);
            const budgets = ['qa', 'qb'].map((key, k) => { let value = .1; const enabled = ctx.toggle({ label: `Check a budget on criterion ${k + 1}`, name: key + '-enabled', checked: false, onChange: yes => ctx.set({ [key]: yes ? value : null }) }), slider = ctx.slider({ label: 'Maximum expected wrong share among stated pairs', name: key, valueType: 'number', min: 0, max: 1, step: .01, value: .1, onInput: v => { value = v; ctx.set({ [key]: v }); } }), root = h('div', { class: 'prx-control' }, enabled.root, slider.root); ctx.controls.append(root); return { root, enabled, slider, set(v) { enabled.set(v !== null); slider.root.hidden = v === null; if (v !== null) {
                    value = v;
                    slider.set(v);
                } } }; });
            function updateHints() { const hits = sentenceHints(draft.value, current); feedback.replaceChildren(h('p', { class: 'des-note' }, draft.value.trim() ? (hits.length ? 'Check these phrases and scope items:' : 'No listed wording issue found. Check the numbers, target, family and scope against the model sentence.') : 'Begin with the target, settings and family; then state N of M and each E/N.'), ...hits.map(hit => h('p', { class: 'des-note' }, h('q', { text: hit.phrase }), ' — ', hit.repair))); }
            ctx.listen(draft, 'input', updateHints);
            updateHints();
            function download(filename, text, type) { const blob = new ctx.win.Blob([text], { type }), url = ctx.win.URL.createObjectURL(blob), a = h('a', { href: url, download: filename }); ctx.root.append(a); a.click(); a.remove(); ctx.win.setTimeout(() => ctx.win.URL.revokeObjectURL(url), 0); }
            for (const [key, label] of [['units', 'Grade and marginal CSV'], ['profile', 'Criterion profile CSV'], ['relations', 'Complete relations CSV'], ['sentence', 'Model sentence TXT'], ['draft', 'My draft TXT'], ['r', 'Reproduce in R']]) {
                const button = ctx.button({ label, key: 'download-' + key, onClick: () => { if (!current || closed)
                        return; const m = current, stem = 'postrank-' + m.input.key; if (key === 'r')
                        download(stem + '.R', exportR(m), 'text/plain;charset=utf-8');
                    else if (key === 'sentence' || key === 'draft')
                        download(stem + '-' + key + '.txt', (key === 'draft' ? draft.value : reportSentence(m)) + '\n\n' + m.input.notice.attribution + '\n' + m.input.notice.changes + '\n' + m.input.notice.text, 'text/plain;charset=utf-8');
                    else
                        download(stem + '-' + key + '.csv', csvText(exportTables(m)[key]), 'text/csv;charset=utf-8'); } });
                downloads.append(button.root);
            }
            function draw(m, s) {
                const d = m.input, e = m.evaluation, pair = focusPair(d, s.focus), chosen = caseCard(d, s.criterion, { expectedRank: m.expectedRank, title: 'Displayed report: ' + d.criterionLabels[s.criterion] });
                const narrow = (cardChart.clientWidth || ctx.width()) < 480;
                if (narrow) {
                    chosen.axis = d.key === 'cde' ? 'Negative absence probability' : d.key === 'krw' ? (s.criterion === 0 ? 'Log gap, white − Black' : 'Log gap, male − female') : (s.criterion === 0 ? 'Income rank (percentile)' : 'Negative incarceration (%)');
                }
                axisNote.textContent = d.axes[s.criterion] + '. Further right is a larger oriented target.';
                if (narrow)
                    chosen.names = d.labels.map(name => { const clean = name.replace(/\s*\([^)]*\)\s*$/, ''); return clean.length > 17 ? clean.slice(0, 16) + '…' : clean; });
                cardBox.hidden = s.view !== 'card';
                relationBox.hidden = s.view !== 'relations';
                changesBox.hidden = s.view !== 'relations';
                reportBox.hidden = s.view !== 'report';
                if (s.view === 'card') {
                const out = drawReportCard(cardChart, chosen, { grade: m.grade, order: 'expected_rank', rowPx: d.n > 40 ? 13 : 23, selected: pair.i, keyboardLabel: 'Read all supplied case marginals and their report grades' });
                for (const [r, i] of Array.from(cardChart.querySelectorAll('tbody tr')).map((r, j) => [r, out.order[j]])) {
                    const cell = r.querySelector('th,td');
                    if (cell)
                        cell.textContent = d.labels[i];
                }
                cardLegend.replaceChildren(gradeLegend(ctx.doc, { grade: m.grade, colors: out.colors, unit: d.unit, units: d.units, grade1: d.grade1 }));
                }
                quick.replaceChildren(labelNode(ctx, m.optimum), '. ', tagNode(ctx, m.optimum, {orderWords:m.method==='enumeration'?undefined:'the '+m.method}), '. N ', num(ctx, null, e.N, formatCount), ' of ', num(ctx, null, e.M, formatCount), ' pairs stated.');
                membership.replaceChildren(h('summary', { text: 'Every unit and its displayed grade' }), smallTable(ctx, 'Complete displayed grade membership', ['ID', 'Unit', 'Grade'], d.ids.map((id, i) => [h('span', { 'data-prx-name': '', text: id }), h('span', { 'data-prx-name': '', text: d.labels[i] }), num(ctx, null, m.grade[i], formatCount)])));
                summary.replaceChildren(h('h4', {}, d.key === 'cde' ? 'California teaching subset' : d.key === 'krw' ? 'KRW correspondence experiment' : 'Alabama historical outcomes', ': ', num(ctx, 'n', d.n, formatCount), ' assessed ', d.units), h('p', {}, labelNode(ctx, m.optimum), '. ', tagNode(ctx, m.optimum, {orderWords:m.method==='enumeration'?undefined:'the '+m.method}), '. ', num(ctx, 'tieCount', m.optimum.tieCount, formatCount), m.optimum.tieCount === 1 ? ' equal-risk optimum' : ' equal-risk optima', '; tolerance ', num(ctx, 'tieTol', m.optimum.tieTol, formatSci), '.'), h('p', {}, 'N = ', num(ctx, 'N', e.N, formatCount), ' of M = ', num(ctx, 'M', e.M, formatCount), ' pairs stated; ', num(ctx, 'sizes', disclosure(m.grade).sizes, formatSizes), '. Risk ', num(ctx, 'risk', e.risk, formatRisk), ' ≈ ', h('span', { class: 'prx-err' }, num(ctx, 'errorTerm', e.errorTerm, formatRisk)), ' + ', h('span', { class: 'prx-wh' }, num(ctx, 'withholdingTerm', e.withholdingTerm, formatRisk)), '.'), h('p', { class: 'des-note' }, 'E is expected wrong directions; risk divides the weighted count by all pairs and adds the cost of withholding. ', d.grade1, ' The row order within a grade makes no additional comparison.'), h('p', { class: 'des-note', 'data-prx-readout':'scope-method' }, m.method === 'enumeration' ? 'The browser enumerates every report in this capped family.' : 'Cuts are optimal only within the declared ' + m.method + '. Equal order scores stay in one grade; no cut splits an exact-score block. Equal-risk cuts prefer fewer grades, then the earlier cut. ' + (d.key==='cde'?'The supplied posterior means define this order; the single criterion has weight one.':'Changing weights recomputes the weighted expected-rank order; no joint cross-criterion posterior is constructed.')), h('p', { class: 'des-note', text: 'Expected wrong shares do not give the probability that every stated direction is correct. These grades are neither causal effects nor an allocation rule. Units outside the declared assessment frame are suppressed, not assigned a bottom grade.' }));
                if (m.optimum.tieCount > 1) {
                    const details = h('details', {}, h('summary', { text: 'Returned equal-risk reports and their disclosure' }));
                    for (const g of m.optimum.grades) {
                        const ev = evaluateReport(g, d.E, { tau: m.tau, w: m.w });
                        details.append(h('p', { class: 'des-grade' }, num(ctx, null, g, formatGrades), ': N ', num(ctx, null, ev.N, formatCount), ', risk ', num(ctx, null, ev.risk, formatRisk), ', E/N ', num(ctx, null, ev.EoverN, v => formatTuple(v, formatShare)), '.'));
                    }
                    if (m.optimum.tieCount > m.optimum.grades.length)
                        details.append(h('p', { class: 'des-note' }, 'Showing ', num(ctx, null, m.optimum.grades.length, formatCount), ' returned vectors of ', num(ctx, null, m.optimum.tieCount, formatCount), ' optima. The complete count is retained.'));
                    summary.append(details);
                }
                if (s.view === 'relations') {
                    const changed = new Set(m.comparison.change.pairs.flatMap(p => [`${p.i},${p.j}`, `${p.j},${p.i}`]));
                    drawRelationMatrix(ctx, matrixSlot, matrixLegend, { n: d.n, ids: d.key === 'cde' ? d.labels : d.ids, names: d.labels, g: m.grade, unit: d.unit, units: d.units }, { large: d.n > 20, selected: pair, changed: { after: m.grade, cells: changed }, onPick: p => ctx.set({ focus: d.ids[p.i] + ',' + d.ids[p.j] }) });
                    const word = (r, i, j) => r === 'withheld' ? 'withheld' : r === 'above' ? d.labels[i] + ' above ' + d.labels[j] : d.labels[j] + ' above ' + d.labels[i];
                    changesBox.replaceChildren(h('h4', { text: 'Every change from the fixed archive to the displayed report' }), smallTable(ctx, 'Complete changed-pair list', ['First', 'Second', 'Archived relation', 'Displayed relation'], m.comparison.change.pairs.map(p => [h('span', { 'data-prx-name': '', text: d.labels[p.i] }), h('span', { 'data-prx-name': '', text: d.labels[p.j] }), h('span', { 'data-prx-name': '', text: word(p.from, p.i, p.j) }), h('span', { 'data-prx-name': '', text: word(p.to, p.i, p.j) })]), { wide: true }));
                }
                const rel = relations(m.grade)[pair.i][pair.j];
                pairNote.replaceChildren('Selected: ', h('span', { 'data-prx-name': '', text: d.labels[pair.i] }), ' / ', h('span', { 'data-prx-name': '', text: d.labels[pair.j] }), '. ', pair.i === pair.j ? 'Self-comparison: no direction.' : rel === 0 ? 'The report withholds this pair.' : rel > 0 ? 'The row unit is stated above the column unit.' : 'The column unit is stated above the row unit.');
                profile.render(m.profileModel);
                budgetBox.replaceChildren(h('h4', { text: 'Budgets check this displayed report; they do not choose it' }));
                const budgetSlot = h('div');
                budgetBox.append(budgetSlot);
                createBudgetFeasibilityView(ctx, budgetSlot).render({ rows: m.budget.rows.map(row => ({ ...row, criterion: d.criterionLabels[row.k] })), hookPrefix: 'budget' });
                if (e.N === 0)
                    budgetBox.append(h('p', { class: 'des-note' }, 'At N = ', num(ctx, null, 0, formatCount), ', the homogeneous count-form checks pass without disclosure. E/N stays NA: no disclosure; this does not make an informative or error-free ranking.'));
                const c = m.comparison.change, a = d.archive, originalSetting = m.tau === a.settings.tau && m.cap === a.settings.G_max && m.w.every((v, k) => v === a.settings.w[k]);
                archiveBox.replaceChildren(h('h4', { text: 'The fixed archived report, evaluated at the current loss' }), smallTable(ctx, 'Current settings beside the original archived solve', ['Setting', 'Current report', 'Original archived solve'], [
                    ['Withholding cost τ', num(ctx, 'current-tau', m.tau, formatSetting), num(ctx, 'archive-tau', a.settings.tau, formatSetting)],
                    ['Grade cap', num(ctx, 'current-cap', m.cap, formatCount), num(ctx, 'archive-cap', a.settings.G_max, formatCount)],
                    ['Criterion error weights', num(ctx, 'current-weights', m.w, v => formatTuple(v, formatSetting)), num(ctx, 'archive-weights', a.settings.w, v => formatTuple(v, formatSetting))]
                ]), h('p', {}, 'Archived N ', num(ctx, 'archive-N', m.comparison.before.N, formatCount), ', risk now ', num(ctx, 'archive-risk', m.comparison.before.risk, formatRisk), '. New minus archive risk: ', num(ctx, 'delta-risk', m.comparison.deltaRisk, v => formatSigned(v, { digits: 4 })), '. ', num(ctx, 'changed', c.changed, formatCount), ' changed pairs: ', num(ctx, 'new-stated', c.nNewDisclosed, formatCount), ' newly stated, ', num(ctx, 'new-withheld', c.nNewWithheld, formatCount), ' newly withheld, ', num(ctx, 'reversed', c.nReversed, formatCount), ' reversed.'), h('p', { class: 'des-note' }, captionNode(ctx, 'fixed-report'), '. Both risk values use the current posterior, τ and weights; caps name different families. This difference is not a global regret certificate.'), h('p', { class: 'des-note' }, m.comparison.before.N !== e.N ? captionNode(ctx, 'different-disclosure') : 'Both reports state the same number of pairs.'), h('p', { class: 'des-note' }, 'Recorded archive solve: status ', a.status, ', lower bound ', num(ctx, 'archive-bound', a.lowerBound, formatRisk), ', gap ', num(ctx, 'archive-gap', a.gap, formatSci), '. ', originalSetting ? 'Its settings match the current controls, but this old solver record still does not certify the new browser computation.' : 'Its original settings differ from the current controls. Its bound and gap do not apply to this new computation.'), h('p', { class: 'des-note' }, disclosure(a.grade).G > m.cap ? 'The archived report has more grades than the current cap; it is still a valid fixed-report evaluation outside that capped family.' : 'The archived report is a fixed comparison; its stored solver certificate is separate from the declared current family.'));
                if (d.key === 'krw') {
                    const facts = d.source.facts;
                    archiveBox.append(h('p', { class: 'des-note', 'data-prx-readout': 'krw-settings' }, 'Separate source settings: common analysis τ = ', num(ctx, 'krw-common-tau', facts.common_settings.tau, formatSetting), '; KRW’s published single-criterion cards λ = ', num(ctx, 'krw-card-lambda', facts.card_lambda, formatSetting), ', corresponding to τ = ', num(ctx, 'krw-card-tau', facts.card_tau, formatSetting), '. The published-card parameter and certificate do not describe the common archive or this new browser computation.'));
                }
                const reasons = [['Withholding cost τ', num(ctx, null, m.tau, formatSetting), m.tau === a.settings.tau ? 'recorded reference setting' : 'sensitivity scenario'], ['Grade cap', num(ctx, null, m.cap, formatCount), m.cap === a.settings.G_max ? 'recorded reference setting' : 'sensitivity scenario'], ['Error weights', num(ctx, null, m.w, v => formatTuple(v, formatSetting)), m.w.every((v, k) => v === a.settings.w[k]) ? 'recorded reference setting' : 'sensitivity scenario']];
                provenanceBody.replaceChildren(h('p', { class: 'des-note' }, ...sourceFragments(ctx, d.conditioning)), h('p', { class: 'des-note' }, ...sourceFragments(ctx, d.dependenceScope ?? d.source.facts.scientific_scope ?? 'Targets and conditioning are supplied by the released case, not refitted in this browser.')), smallTable(ctx, 'Provenance of each setting', ['Setting', 'Value', 'Source'], reasons), h('p', { class: 'des-note', text: 'Equal weights are a judgment, not neutrality. Optimization does not authorize these preferences. The marginal interval level is fixed by the source; it is not an error budget or a simultaneous guarantee.' }), h('p', { class: 'des-note' }, 'Supplied intervals: ', num(ctx, 'interval-level', d.marginals.level, formatPercent), '. Monte Carlo error and joint correctness diagnostics are unavailable from these released pair probabilities; no zero value is substituted.'));
                modelSentence.replaceChildren(...reportSentenceParts(m).flatMap(part => typeof part === 'string' ? sourceFragments(ctx, part) : part.result ? [labelNode(ctx, part.result)] : [num(ctx, part.key, part.value, part.format)]));
                const appLink = (name, text) => h('a', { href: (ctx.win.location.pathname.includes('/embed/') ? '' : '../../embed/') + name + '.html', text });
                const mapping = text => h('code', { text });
                const guidance = [
                    ['Target and orientation', 'Name every oriented target and its Grade 1 meaning, as in the model above.', 'input$targets; provenance$orientation'],
                    ['Posterior and conditioning', 'State its source, what is conditioned on, and what is left out; retain the case provenance above.', 'input$provenance; input$context'],
                    ['Assessment frame and units', 'Name the assessed units and all-pair denominator M; unassessed units remain outside the report.', 'evaluation$M'],
                    ['Loss preferences', 'Give τ and its reason and the criterion error weights. These weight criterion directions, not a composite outcome.', 'settings$tau; settings$weights'],
                    ['Family, cap and budgets', 'Name the actual family, its size and cap. Here budgets check the selected report rather than defining a budget-constrained search.', 'settings$G_max; settings$exact_G; settings$q'],
                    ['Result label and solve metadata', 'Use the actual family label and tie tolerance. Status, bound and gap belong only to the archived solve shown above.', 'get_risk(); fit$objective$bound_source'],
                    ['Monte Carlo checks', 'For posterior draws report draw count, Monte Carlo standard errors and fragile pairs. These diagnostics are unavailable here from released pair probabilities; no zero is substituted.', 'postrank_mc_fragility()'],
                    ['Disclosure and withheld pairs', 'Report N of M; the relations view and complete relations CSV retain every stated and withheld pair.', 'evaluation$N; get_relations()'],
                    ['Expected wrong shares', 'Name stated directions as the E_k/N denominator. At N = 0 write NA: no disclosure, even when a homogeneous budget passes.', 'get_profile()$E_over_N'],
                    ['Criterion cost of common grading', h('span', {}, 'Not computed here. Criterion risk R_k and new-minus-archive risk are not the criterion’s commonality cost Δ_k relative to its own optimal report. See ', appLink('common-grade-cost', 'Cost of a common grade'), '.'), 'postrank_commonality_cost()$table'],
                    ['Common-rule comparisons', h('span', {}, 'Not computed here. Compare rules at matched disclosure N, or use a ψ mixture between complete reports; a mixture is not a printable grade report. See ', appLink('rule-comparison', 'Common rules'), ' and ', appLink('frontier-mixtures', 'Frontier mixtures'), '.'), 'postrank_compare()'],
                    ['Limits and wording', 'Shared grades assert no equality. Use grade rather than tier or rank; expected shares do not establish joint correctness, causality, need or an allocation rule.', 'postrank_report() carries reporting items']
                ];
                checklist.replaceChildren(h('h4', { text: 'Unscored reporting checklist' }), h('p', { class: 'des-note', text: 'Advisory prompts for an editable account, not statistical validation or a writing score. Follow-up views explain quantities this tool does not compute.' }), smallTable(ctx, 'Reporting items and their package fields or functions', ['Report item', 'What to declare or inspect', 'In postrank'], guidance.map(([item, advice, field]) => [item, typeof advice === 'string' ? h('span', {}, ...sourceFragments(ctx, advice)) : advice, mapping(field)])), h('p', { class: 'des-note', 'data-prx-readout': 'selection-evaluation-scope' }, 'The posterior that chooses a report and the law used to judge it are separate declarations. A self-reported error share is computed under the selection posterior and is not an external calibration claim. Averaging realized wrong fractions over datasets is a different statistic from the ratio of expected wrong to expected stated directions. This tool evaluates under the supplied case posterior; it does not compute an external calibration study or either across-dataset average. See ', appLink('chosen-and-judged', 'Chosen and judged'), ' and ', appLink('averaging-errors', 'Averaging errors'), '.'));
                rights.replaceChildren(h('p', {}, ...sourceFragments(ctx, d.notice.attribution)), h('p', {}, ...sourceFragments(ctx, d.notice.changes)), h('p', {}, ...sourceFragments(ctx, d.notice.text), d.key === 'krw' ? h('strong', { text: ' These data describe the historical experiment, not any firm’s current conduct.' }) : ''));
                ctx.readout.set(['The displayed report states ', num(ctx, 'ro-N', e.N, formatCount), ' of ', num(ctx, 'ro-M', e.M, formatCount), ' pairs. Expected wrong shares: ', num(ctx, 'ro-shares', e.EoverN, v => formatTuple(v, formatShare)), '. Budgets evaluate this report and do not reselect it.']);
                updateHints();
            }
            function render(s) { const d = caseInput(s.case), patch = {}; if (s.cap > d.n)
                patch.cap = d.n; if (s.criterion >= d.K)
                patch.criterion = 0; if (d.K === 1 && s.w !== 1)
                patch.w = 1; const parts = s.focus.split(','); if (s.focus !== 'auto' && (parts.length !== 2 || parts.some(id => !d.ids.includes(id))))
                patch.focus = 'auto'; if (Object.keys(patch).length) {
                ctx.set(patch);
                return;
            } choose.set(s.case); tau.set(s.tau); cap.input.max = String(d.n); cap.set(s.cap); weight.root.hidden = d.K === 1; weight.set(s.w); view.set(s.view); criterion.root.hidden = d.K === 1; criterion.set(s.criterion); criterion.inputs.forEach((input, k) => { input.parentElement.querySelector('span').textContent = d.criterionLabels[k] ?? 'Inactive criterion'; }); budgets.forEach((b, k) => { b.root.hidden = k >= d.K; b.set(k === 0 ? s.qa : s.qb); }); const mine = ++generation; current = null; ctx.root.setAttribute('aria-busy', 'true'); note.textContent = 'Computing the declared family. Any results still visible are from the previous completed setting; budget settings do not reselect the report…'; downloads.querySelectorAll('button').forEach(button => button.setAttribute('aria-disabled', 'true')); if (timer !== null)
                ctx.win.clearTimeout(timer); timer = ctx.win.setTimeout(() => { timer = null; if (closed || mine !== generation)
                return; try {
                const m = designerModel(s);
                if (closed || mine !== generation)
                    return;
                current = m;
                draw(m, s);
                note.textContent = 'Report ready. Check its family and source before exporting.';
            }
            catch (error) {
                note.textContent = 'This setting could not be computed: ' + error.message;
                current = null;
            }
            finally {
                if (!closed && mine === generation) {
                    ctx.root.removeAttribute('aria-busy');
                    downloads.querySelectorAll('button').forEach(button => button.removeAttribute('aria-disabled'));
                }
            } }, 0); }
            ctx.onCleanup(() => { closed = true; generation++; if (timer !== null)
                ctx.win.clearTimeout(timer); });
            return { render };
        } });
}
