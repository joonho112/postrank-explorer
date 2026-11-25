// Four nonexclusive diagnostics for a withheld comparison.
// Every optimum and signed changed-pair account comes from public engine calls.
import { createWidget } from '../shared/base.js';
import { canvasLayer, palette, plot, svgScene } from '../shared/chart.js';
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  formatSigned,
  formatTuple,
} from '../shared/format.js';
import { familySizeNode, tagNode } from '../shared/labels.js';
import {
  compareReports,
  evaluateReport,
  expectedRank,
  pairCertainty,
  pairConstrainedOptimum,
  pairCount,
  relations,
  scoreOrder,
} from '../pr-core.js';
import { criteriaData } from '../shared/criteria-data.js';
import { CHAPTER19, ORDER_THREE, finiteCriteria, uncertainDirectionLaw } from '../shared/criteria-laws.js';
import { PAIR_COST_CSS, createPairCostView, criterionPairCosts } from '../shared/domain/conflict-pairs.js';
import { CRITERIA_PROFILE_CSS, createCriterionPairView, criterionProfileModel } from '../shared/domain/several-criteria.js';
import { REPORT_CARD_CSS, cardRows, drawReportCard, gaussianCard } from '../shared/domain/report-card.js';
import CDE from '../../data/released/case-cde.json' with { type: 'json' };
import KRW from '../../data/released/case-krw.json' with { type: 'json' };

const TITLES = Object.freeze({
  six: 'Six sites · two scores',
  ch19: 'Four-unit law · certain criterion opposition',
  uncertain: 'Two units · uncertain agreeing criteria',
  order: 'Three units · declared order',
  cde: 'CDE teaching subset · twelve schools',
  krw: 'KRW · all firms, fixed expected-rank order',
});
const DEFAULTS = Object.freeze({
  six: { tau: 0.2, cap: 'all' },
  ch19: { tau: 0.2, cap: 'all' },
  uncertain: { tau: 0.2, cap: 'all' },
  order: { tau: 0.25, cap: 'all' },
  cde: { tau: 0.25, cap: '3' },
  krw: { tau: 0.25, cap: '4' },
});
const CAPS = Object.freeze({
  six: ['all', '1', '2', '3', '4', 'exact1'],
  ch19: ['all', '1', '2', '3', '4', 'exact1'],
  uncertain: ['all', '1', '2', 'exact1'],
  order: ['all', '1', '2', '3', 'exact1'],
  cde: ['1', '2', '3'],
  krw: ['all', '1', '2', '3', '4'],
});
const capWords = (v) => (v === 'all' ? 'No grade cap' : v === 'exact1' ? 'Exactly one grade' : `At most ${v} grades`);

export const WHY_WITHHELD_KEYS = {
  data: { type: 'choice', values: Object.keys(TITLES), value: 'six' },
  tau: { type: 'number', min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
  cap: { type: 'choice', values: ['all', '1', '2', '3', '4', 'exact1'], value: 'all' },
  restriction: { type: 'choice', values: ['source', 'blocked'], value: 'source' },
  pair: { type: 'string', value: 'auto' },
  report: { type: 'integer', min: 0, max: 100, value: 0 },
  forward: { type: 'integer', min: 0, max: 100, value: 0 },
  reverse: { type: 'integer', min: 0, max: 100, value: 0 },
};

export const WHY_WITHHELD_CSS = `
.why.prx-rc .prx-controls{align-items:flex-end}
.why.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls{flex:1 1 24rem}
.why .why-pair-compact{display:inline-grid;grid-template-columns:repeat(2,minmax(3.8rem,auto));gap:.35rem .5rem;align-items:end;min-width:0}
.why .why-pair-compact select{width:100%;min-width:3.8rem}
.why .why-settings{display:flex;flex-wrap:wrap;gap:.55rem .9rem;align-items:flex-end;min-width:0;width:100%}
.why .why-settings .prx-control,.why .why-settings select{max-width:100%;min-width:0}
.why .why-group{display:contents}
.why .why-group[hidden]{display:none}
.why .why-stage-grid{display:grid;grid-template-columns:minmax(15.5rem,1fr) minmax(18rem,1.35fr);align-items:start;gap:.75rem 1.2rem;min-width:0}
.why .why-stage-col{min-width:0}
.why .why-matrix-large{max-height:19rem;overflow:auto;overscroll-behavior:contain}
.why .why-legend{display:flex;flex-wrap:wrap;gap:.25rem .75rem;margin:.35rem 0 0;font-size:.8125rem;color:var(--prx-fg-muted)}
.why .why-key{display:inline-block;width:.85rem;height:.85rem;margin-right:.3rem;vertical-align:-.12em;border:1px solid var(--prx-cell-border);border-radius:2px}
.why .why-key-withheld{background:repeating-linear-gradient(-45deg,var(--prx-hatch) 0 1.4px,var(--prx-rel-withheld) 1.4px 5px)}
.why .prx-stage .why-stage-meta{margin:.4rem 0 0;font-size:.84375rem;line-height:1.4;color:var(--prx-plot-muted)}
.why .why-section{margin:.75rem 0;min-width:0}
.why .why-section:first-child{margin-top:0}
.why .why-paper{padding:.7rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border:1px solid var(--prx-border);border-radius:.45rem;min-width:0}
.why .why-paper .prx-panel-title,.why .why-paper .prx-result-tag,.why .why-paper label{color:var(--prx-plot-fg)}
.why .why-paper .why-note,.why .why-paper .sev-hint{color:var(--prx-plot-muted)}
.why .why-note{font-size:.875rem;line-height:1.45;color:var(--prx-fg-muted)}
.why .why-scroll{overflow-x:auto;max-width:100%;min-width:0}
.why .why-table{border-collapse:collapse;font-size:.84rem;min-width:42rem;width:100%}
.why .why-table th,.why .why-table td{padding:.38rem .55rem;text-align:right;white-space:nowrap;border-bottom:1px solid var(--prx-plot-grid)}
.why .why-table th:first-child,.why .why-table td:first-child{text-align:left}
.why .why-grade{overflow-wrap:anywhere;white-space:normal;display:inline-block;max-width:35rem}
.why .why-status{font-weight:600}
.why .why-section select{max-width:100%}
.why .why-order{overflow-wrap:anywhere}
.why .why-card{min-width:0;margin-top:.5rem}
.why .why-card svg{max-width:100%}
@media(max-width:48rem){
 .why .why-stage-grid{grid-template-columns:minmax(0,1fr);gap:.6rem}
 .why .why-pair-compact{display:none}
 .why.prx-widget[data-prx-frame="v2"]{padding:.45rem .55rem}
 .why.prx-widget[data-prx-frame="v2"] .prx-toolbar{gap:.25rem .45rem;margin-bottom:.3rem}
 .why.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls{flex:1 1 100%}
 .why.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label{display:none}
 .why.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.22rem}
 .why.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.18rem .48rem;font-size:.8125rem}
 .why.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary{padding:.18rem 0;font-size:.8125rem}
 .why.prx-widget[data-prx-frame="v2"] > .prx-readout{margin-bottom:.35rem;padding:.25rem .5rem;font-size:.875rem;line-height:1.32}
}
`;

const inputs = new Map();
const solves = new Map();
const errors = (a) => ({
  ids: a.ids.slice(),
  criteria: a.criteria.slice(),
  e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? NaN : v)))),
});

/** Released inputs and declared tiny laws, with the order computed once and never refitted to a counterfactual. */
export function whyWithheldInput(key = 'six') {
  if (inputs.has(key)) return inputs.get(key);
  let data, E, law, cards = [], order = null, w;
  if (key === 'six') {
    data = criteriaData('six');
    E = data.E;
    w = [0.5, 0.5];
    const rank = expectedRank(E, { w });
    cards = data.criteria.map((criterion, k) => gaussianCard({
      ids: E.ids,
      names: data.labels,
      mean: data.means.map((r) => r[k]),
      sd: data.sds.map((r) => r[k]),
      level: 0.9,
      expectedRank: rank,
      storedOrder: 'expected_rank',
      axis: data.criterionLabels[k],
      title: `Baseline report · ${data.criterionLabels[k]}`,
      grade1: 'Grade one states higher oriented scores; same grade withholds.',
      unit: 'site',
      units: 'sites',
      digits: 3,
    }));
  } else if (['ch19', 'uncertain', 'order'].includes(key)) {
    law = key === 'ch19' ? CHAPTER19 : key === 'order' ? ORDER_THREE : uncertainDirectionLaw(0.6);
    E = finiteCriteria(law);
    w = key === 'ch19' ? [0.6, 0.4] : [0.5, 0.5];
    data = {
      key,
      ids: law.ids,
      labels: law.ids,
      criteria: law.criteria,
      criterionLabels: ['first criterion', 'second criterion'],
      n: E.ids.length,
      K: E.criteria.length,
      M: pairCount(E.ids.length),
    };
    if (key === 'order') order = [0, 1, 2];
  } else {
    const source = key === 'cde' ? CDE : KRW;
    const u = source.tables.units;
    E = errors(source.arrays.error);
    w = key === 'cde' ? [1] : [0.5, 0.5];
    const rank = expectedRank(E, { w });
    if (key === 'krw') order = scoreOrder(rank, { direction: 'ascending', ids: E.ids }).order;
    data = {
      key,
      ids: key === 'cde' ? u.label : E.ids,
      labels: key === 'cde' ? u.label : u.firm_name,
      criteria: E.criteria,
      criterionLabels: key === 'cde'
        ? ['negative chronic-absence probability']
        : ['white-name contact advantage', 'male-name contact advantage'],
      n: E.ids.length,
      K: E.criteria.length,
      M: pairCount(E.ids.length),
      source,
    };
    cards = E.criteria.map((criterion, k) => {
      const stem = key === 'cde' ? '' : k === 0 ? '_race' : '_gender';
      return {
        ids: E.ids,
        names: data.ids,
        fullNames: data.labels,
        mean: u['mean' + stem],
        lower: u['lower' + stem],
        upper: u['upper' + stem],
        expectedRank: rank,
        storedOrder: 'expected_rank',
        level: source.facts.interval_level,
        intervalSource: 'supplied central',
        axis: data.criterionLabels[k],
        title: `Baseline report · ${data.criterionLabels[k]}`,
        grade1: key === 'cde'
          ? 'Grade one states lower chronic absence, as the posterior judges it.'
          : 'Grade one states larger oriented contact advantage, as the posterior judges it.',
        unit: key === 'cde' ? 'school' : 'firm',
        units: key === 'cde' ? 'schools' : 'firms',
        digits: 3,
      };
    });
  }
  const result = { key, data, E, law, cards, order, w };
  inputs.set(key, result);
  return result;
}

export function whyWithheldFamily(input, state) {
  const { key, order } = input;
  const cap = CAPS[key].includes(state.cap) ? state.cap : DEFAULTS[key].cap;
  if (order) {
    return {
      kind: 'order',
      order,
      ...(cap === 'exact1' ? { exact: 1 } : cap !== 'all' ? { G: Number(cap) } : {}),
      ...(key === 'order' && state.restriction === 'blocked' ? { blocks: [1, 2] } : {}),
    };
  }
  return cap === 'all' ? { kind: 'all' } : cap === 'exact1' ? { kind: 'exactly', G: 1 } : { kind: 'atMost', G: Number(cap) };
}

function pairIndices(input, key) {
  const d = input.data;
  const parts = String(key).split(',');
  const i = d.ids.indexOf(parts[0]);
  const j = d.ids.indexOf(parts[1]);
  return i >= 0 && j >= 0 && i !== j
    ? [i, j]
    : input.key === 'ch19' ? [1, 2] : input.key === 'cde' ? [5, 8] : input.key === 'krw' ? [55, 35] : input.key === 'order' ? [1, 2] : [0, 1];
}

function relaxation(input, family) {
  if (family.kind === 'all' || (input.key === 'krw' && family.G === undefined)) return null;
  if (input.key === 'cde') {
    return family.G < 3 ? { family: { kind: 'atMost', G: 3 }, words: 'Expand the cap to three, within the same teaching subset' } : null;
  }
  if (input.key === 'krw') {
    return { family: { kind: 'order', order: input.order }, words: 'Remove the cap and keep exactly the same expected-rank order' };
  }
  if (input.key === 'order') {
    return family.blocks
      ? { family: { ...family, blocks: undefined }, words: 'Remove the indivisible block and retain the declared A, B, C order' }
      : { family: { kind: 'all' }, words: 'Remove the order restriction; search every coherent report' };
  }
  return { family: { kind: 'all' }, words: 'Remove the grade-count restriction; search every coherent report' };
}

const retainedGrades = (r) => {
  if (!r || r.empty) return [];
  const grades = r.grades ?? [r.grade];
  const key = r.grade.join(',');
  return [r.grade, ...grades.filter((g) => g.join(',') !== key)];
};

function solveCached(input, tau, f, stating) {
  const key = JSON.stringify([input.key, tau, f, stating]);
  if (!solves.has(key)) {
    const result = pairConstrainedOptimum(input.E, { tau, w: input.w, family: f, stating, maxTies: 100 });
    solves.set(key, result);
    if (solves.size > 160) solves.delete(solves.keys().next().value);
  }
  return solves.get(key);
}

function isSolveHit(input, tau, f, stating) {
  return solves.has(JSON.stringify([input.key, tau, f, stating]));
}

function assembleModel(state, input, family, [i, j], { baseline, forward, reverse, relaxed, relaxedBaseline, relaxedForward, relaxedReverse }) {
  const { E, w } = input;
  const tau = state.tau;
  const reports = retainedGrades(baseline);
  const selected = Math.min(state.report, Math.max(0, reports.length - 1));
  const grade = reports[selected];
  const profile = (r) => retainedGrades(r).map((g) => ({
    grade: g,
    evaluation: evaluateReport(g, E, { tau, w }),
    comparison: compareReports(grade, g, E, { tau, w }),
  }));
  const criterionPair = input.key === 'six'
    ? criterionProfileModel({ data: 'six', pair: `${E.ids[i]},${E.ids[j]}` }).pair.criteria
    : E.criteria.map((criterion, k) => ({
        criterion,
        eIJ: E.e[k][i][j],
        eJI: E.e[k][j][i],
        piIJ: E.pi?.[k][i][j] ?? null,
        piJI: E.pi?.[k][j][i] ?? null,
        equality: E.t?.[k][i][j] ?? null,
      }));
  const cost = criterionPairCosts(E, [i, j], { tau, w, ...(input.law ? { states: input.law.states, probs: input.law.probs } : {}) });
  return {
    ...input,
    ...cost,
    input,
    state,
    family,
    tau,
    w,
    pair: { i, j, criteria: criterionPair },
    kind: 'posterior',
    baseline,
    grade,
    selected,
    baselineProfiles: profile(baseline),
    forward,
    reverse,
    forwardProfiles: profile(forward),
    reverseProfiles: profile(reverse),
    relaxed,
    relaxedBaseline,
    relaxedForward,
    relaxedReverse,
    relaxedBaselineProfiles: relaxed ? profile(relaxedBaseline) : [],
    relaxedForwardProfiles: relaxed ? profile(relaxedForward) : [],
    relaxedReverseProfiles: relaxed ? profile(relaxedReverse) : [],
  };
}

/** Staged public composition. A caller can abandon obsolete work between complete engine calls. */
export async function solveWhyWithheld(state, { stage = async () => {}, isCurrent = () => true } = {}) {
  const input = whyWithheldInput(state.data);
  const family = whyWithheldFamily(input, state);
  const pair = pairIndices(input, state.pair);
  const [i, j] = pair;
  const tau = state.tau;
  async function solve(f, stating, title) {
    if (!isSolveHit(input, tau, f, stating)) {
      await stage(title);
      if (!isCurrent()) return null;
    }
    return solveCached(input, tau, f, stating);
  }
  const baseline = await solve(family, [], 'Finding the baseline report');
  if (!baseline || !isCurrent()) return null;
  const forward = await solve(family, [[i, j]], 'Finding the cheapest forward report');
  if (!forward || !isCurrent()) return null;
  const reverse = await solve(family, [[j, i]], 'Finding the cheapest reverse report');
  if (!reverse || !isCurrent()) return null;
  const relaxed = relaxation(input, family);
  let relaxedBaseline = null, relaxedForward = null, relaxedReverse = null;
  if (relaxed) {
    relaxedBaseline = await solve(relaxed.family, [], 'Checking the relaxed baseline');
    if (!relaxedBaseline || !isCurrent()) return null;
    relaxedForward = await solve(relaxed.family, [[i, j]], 'Checking the relaxed forward direction');
    if (!relaxedForward || !isCurrent()) return null;
    relaxedReverse = await solve(relaxed.family, [[j, i]], 'Checking the relaxed reverse direction');
    if (!relaxedReverse || !isCurrent()) return null;
  }
  return assembleModel(state, input, family, pair, { baseline, forward, reverse, relaxed, relaxedBaseline, relaxedForward, relaxedReverse });
}

const nm = (ctx, s) => ctx.h('span', { 'data-prx-name': '', text: s });
function sourceProse(ctx, text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)) {
    out.push(text.slice(last, m.index), ctx.num(Number(m[0].replaceAll(',', '')), m[0]));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function n(ctx, x, kind = 'risk', hook) {
  const f = kind === 'count' ? formatCount
    : kind === 'expected' ? formatExpectedCount
    : kind === 'share' ? formatShare
    : kind === 'prob' ? formatProb
    : kind === 'grade' ? formatGrades
    : kind === 'sci' ? formatSci
    : kind === 'setting' ? formatSetting
    : kind === 'value' ? (v) => formatDecimal(v, { digits: 3 })
    : kind === 'signed' ? (v) => formatSigned(v, { digits: 6 })
    : kind === 'roRisk' ? (v) => formatReadoutRisk(v)
    : kind === 'roSigned' ? (v) => formatReadoutRisk(v, { signed: true })
    : formatRisk;
  const node = ctx.num(x, f(x));
  if (hook) node.dataset.prxReadout = hook;
  return node;
}

const gradeNode = (ctx, g, hook) => {
  const node = n(ctx, g, 'grade', hook);
  node.classList.add('why-grade');
  return node;
};

function table(ctx, headers, rows) {
  return ctx.h(
    'table',
    { class: 'why-table' },
    ctx.h('thead', {}, ctx.h('tr', {}, ...headers.map((h) => ctx.h('th', { scope: 'col' }, h)))),
    ctx.h('tbody', {}, ...rows.map((row) => ctx.h('tr', {}, ...row.map((v) => ctx.h('td', {}, v))))),
  );
}

const hint = (ctx) => ctx.h('p', { class: 'why-note' }, 'Wide tables scroll inside their panel. Focus the region and use the arrow keys.');

function tieLine(ctx, r, hook) {
  if (r.empty) {
    return ctx.h(
      'p',
      { class: 'why-status' },
      'No admissible report states this direction. Candidate count ',
      n(ctx, r.family.size, 'count', `${hook}-family`),
      '. This is infeasible in the declared family, rather than a feasible report with a high cost.',
    );
  }
  return ctx.h(
    'p',
    {},
    tagNode(ctx, r, {
      key: hook,
      orderWords: ctx.state.data === 'krw' ? 'the fixed weighted expected-rank order' : 'the declared A, B, C order',
    }),
    '. ',
    n(ctx, r.tieCount, 'count', `${hook}-ties`),
    r.tieCount === 1 ? ' report has the smallest risk; ' : ' reports share the smallest risk; ',
    n(ctx, retainedGrades(r).length, 'count'),
    ' retained below. Equal-risk tolerance ',
    n(ctx, r.tieTol, 'sci'),
    '. ',
    r.tieCount > retainedGrades(r).length
      ? 'The retained list is truncated; the total count includes the omitted reports.'
      : 'The retained list is complete.',
  );
}

function profilesTable(ctx, model, profiles, prefix) {
  const { data: d } = model;
  return table(
    ctx,
    [
      'Report (source unit order)',
      'Risk',
      'N: stated pairs',
      'Extra risk vs selected baseline',
      ...d.criterionLabels.flatMap((k) => [`${k}: E`, `${k}: E/N`, `${k}: E/M`, `${k}: criterion risk`]),
    ],
    profiles.map((r, index) => [
      gradeNode(ctx, r.grade, `${prefix}-grade-${index}`),
      n(ctx, r.evaluation.risk, 'risk', `${prefix}-risk-${index}`),
      n(ctx, r.evaluation.N, 'count', `${prefix}-N-${index}`),
      n(ctx, r.comparison.deltaRisk, 'signed', `${prefix}-delta-${index}`),
      ...d.criterionLabels.flatMap((_, k) => [
        n(ctx, r.evaluation.E[k], 'expected', `${prefix}-E-${index}-${k}`),
        n(ctx, r.evaluation.EoverN[k], 'share', `${prefix}-share-${index}-${k}`),
        n(ctx, r.evaluation.EoverM[k], 'share', `${prefix}-perpair-${index}-${k}`),
        n(ctx, r.evaluation.Rk[k], 'risk', `${prefix}-Rk-${index}-${k}`),
      ]),
    ]),
  );
}

function relationWords(model, r, i, j) {
  return r === 0 ? 'Withheld' : r === 1 ? `${model.data.ids[i]} above ${model.data.ids[j]}` : `${model.data.ids[j]} above ${model.data.ids[i]}`;
}

function accounting(ctx, slot, scrollSlot, model, profile, prefix, { rows = true } = {}) {
  const c = profile.comparison;
  slot.append(
    ctx.h(
      'p',
      {},
      'Signed risk change ',
      n(ctx, c.deltaRisk, 'signed', `${prefix}-delta`),
      ' = error-term change ',
      n(ctx, c.errorTermDelta, 'signed', `${prefix}-error`),
      ' + withholding-term change ',
      n(ctx, c.withholdingTermDelta, 'signed', `${prefix}-withhold`),
      '. All ',
      n(ctx, c.pairs.length, 'count', `${prefix}-changed`),
      ' changed unordered pairs appear below. The normalized signed differences sum to the risk change; negative entries offset positive entries.',
    ),
  );
  if (!rows) {
    scrollSlot.replaceChildren();
    scrollSlot.hidden = true;
    return;
  }
  scrollSlot.hidden = false;
  scrollSlot.replaceChildren(
    table(
      ctx,
      ['Pair', 'Baseline relation', 'Counterfactual relation', 'Before cost', 'After cost', 'Signed cost change', 'Signed risk change (cost / M)'],
      c.pairs.map((r, index) => [
        nm(ctx, `${model.data.ids[r.i]} / ${model.data.ids[r.j]}`),
        nm(ctx, relationWords(model, r.beforeRelation, r.i, r.j)),
        nm(ctx, relationWords(model, r.afterRelation, r.i, r.j)),
        n(ctx, r.beforeCost, 'risk', `${prefix}-before-${index}`),
        n(ctx, r.afterCost, 'risk', `${prefix}-after-${index}`),
        n(ctx, r.costDifference, 'signed', `${prefix}-cost-${index}`),
        n(ctx, r.normalizedDifference, 'signed', `${prefix}-normalized-${index}`),
      ]),
    ),
  );
  slot.append(scrollSlot);
}

export function createWhyWithheldSlots(ctx, parent = ctx.charts) {
  const result = {};
  for (const key of ['matrix', 'baseline', 'cost', 'criterion', 'coherent', 'family', 'cards', 'source']) {
    result[key] = ctx.h('section', { class: key === 'matrix' ? 'why-stage-col' : 'why-section why-paper prx-light-panel' });
    parent.append(result[key]);
  }
  return result;
}

function criterionChecks(model) {
  const { E, pair, data } = model;
  const thresholds = [0.9, 0.99];
  return model.criteria.map((row, k) => {
    const e = [[NaN, E.e[k][pair.i][pair.j]], [E.e[k][pair.j][pair.i], NaN]];
    const check = pairCertainty({ ids: [E.ids[pair.i], E.ids[pair.j]], criteria: [E.criteria[k]], e: [e] }, { thresholds });
    return { ...row, label: data.criterionLabels[k], direction: row.eIJ < row.eJI ? 1 : row.eJI < row.eIJ ? -1 : 0, counts: check.counts };
  });
}

/** Concise 1-2 sentence live readout at 3 significant figures (<= 24 words, CP-1.2 & B12 fix). */
function selectedPairSummary(ctx, model) {
  const { data, grade, pair, forwardProfiles, baselineProfiles } = model;
  const r = relations(grade)[pair.i][pair.j];
  const a = data.ids[pair.i];
  const b = data.ids[pair.j];
  const baseline = baselineProfiles[model.selected].evaluation;
  if (r !== 0) {
    const fwd = forwardProfiles[0];
    return [
      nm(ctx, a), ' / ', nm(ctx, b), ' stated as ', nm(ctx, relationWords(model, r, pair.i, pair.j)),
      ' (baseline ', n(ctx, baseline.risk, 'roRisk', 'selected-risk'), '). ',
      ...(fwd ? ['Requiring ', nm(ctx, `${a} above ${b}`), ': risk ', n(ctx, fwd.evaluation.risk, 'roRisk', 'readout-forward-risk'), ' (', n(ctx, fwd.comparison.deltaRisk, 'roSigned', 'readout-delta'), '). '] : []),
      baseline.N < data.M ? 'Pick a hatched withheld cell.' : 'Every pair stated.',
    ];
  }
  const standaloneFwd = model.weighted.decision.costs.iAboveJ;
  const out = [
    nm(ctx, a), ' / ', nm(ctx, b), ' withheld (baseline ', n(ctx, baseline.risk, 'roRisk', 'selected-risk'), '): ',
    'alone ', n(ctx, standaloneFwd, 'roRisk'), ' vs. τ = ', n(ctx, model.tau, 'setting'), '; ',
  ];
  if (!forwardProfiles.length) {
    out.push('infeasible in family.');
  } else {
    const p = forwardProfiles[0];
    out.push(
      'coherent ',
      nm(ctx, `${a} > ${b}`),
      ' risk ',
      n(ctx, p.evaluation.risk, 'roRisk', 'readout-forward-risk'),
      ' (',
      n(ctx, p.comparison.deltaRisk, 'roSigned', 'readout-delta'),
      ').',
    );
  }
  return out;
}

function krwAccountOverviewNode(ctx, model) {
  const { h } = ctx;
  const rows = [];
  for (const key of ['forward', 'reverse']) {
    const profiles = model[`${key}Profiles`];
    if (!profiles.length) continue;
    const profile = profiles[Math.min(model.state[key], profiles.length - 1)];
    const c = profile.comparison;
    const transitions = { stated: 0, withheld: 0, reversed: 0 };
    for (const row of c.pairs) {
      if (row.beforeRelation === 0) transitions.stated++;
      else if (row.afterRelation === 0) transitions.withheld++;
      else transitions.reversed++;
    }
    const { i, j } = model.pair;
    const dir = key === 'forward' ? [i, j] : [j, i];
    const contributors = c.pairs.slice().sort((x, y) => Math.abs(y.costDifference) - Math.abs(x.costDifference)).slice(0, 2);
    rows.push(
      h(
        'p',
        {},
        nm(ctx, `${model.data.ids[dir[0]]} above ${model.data.ids[dir[1]]}`),
        ' · ',
        n(ctx, c.pairs.length, 'count'),
        ' changes (',
        n(ctx, transitions.stated, 'count'),
        ' newly stated, ',
        n(ctx, transitions.withheld, 'count'),
        ' newly withheld, ',
        n(ctx, transitions.reversed, 'count'),
        ' reversed). Error term ',
        n(ctx, c.errorTermDelta, 'signed'),
        ' · withholding term ',
        n(ctx, c.withholdingTermDelta, 'signed'),
        ...(contributors.length
          ? ['. Largest signed contributions ', ...contributors.flatMap((r, idx) => [idx ? ' · ' : '', nm(ctx, `${model.data.ids[r.i]} / ${model.data.ids[r.j]}`), ' ', n(ctx, r.costDifference, 'signed')])]
          : []),
        '.',
      ),
    );
  }
  return rows.length ? h('section', { class: 'why-section why-paper prx-light-panel' }, ctx.panelTitle('Changed-pair account overview'), ...rows) : null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let hatchSeq = 0;

function decorateMatrixSvg(svg, pal, ids, cells, selectedPair) {
  const idSet = new Set(ids);
  for (const t of svg.querySelectorAll('text')) {
    if (idSet.has(t.textContent)) t.setAttribute('data-prx-name', '');
  }
  const hatchId = `why-hatch-${(hatchSeq += 1)}`;
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = svg.ownerDocument.createElementNS(SVG_NS, 'defs');
    defs.setAttribute('aria-hidden', 'true');
    svg.prepend(defs);
  }
  const pat = svg.ownerDocument.createElementNS(SVG_NS, 'pattern');
  pat.setAttribute('id', hatchId);
  pat.setAttribute('width', '6');
  pat.setAttribute('height', '6');
  pat.setAttribute('patternUnits', 'userSpaceOnUse');
  pat.setAttribute('patternTransform', 'rotate(45)');
  const bg = svg.ownerDocument.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', '6');
  bg.setAttribute('height', '6');
  bg.setAttribute('fill', pal.relWithheld);
  const ln = svg.ownerDocument.createElementNS(SVG_NS, 'line');
  ln.setAttribute('x1', '0');
  ln.setAttribute('y1', '0');
  ln.setAttribute('x2', '0');
  ln.setAttribute('y2', '6');
  ln.setAttribute('stroke', pal.hatch);
  ln.setAttribute('stroke-width', '1.35');
  pat.append(bg, ln);
  defs.append(pat);

  const cellGroup = svg.querySelector('g[aria-label="cell"]');
  if (!cellGroup) return;
  const rects = [...cellGroup.querySelectorAll('rect')];
  let selRect = null;
  rects.forEach((rect, idx) => {
    const c = cells[idx];
    if (!c) return;
    if (c.i !== c.j && c.relation === 0) rect.setAttribute('fill', `url(#${hatchId})`);
    if (c.i === selectedPair.i && c.j === selectedPair.j) selRect = rect;
  });
  if (selRect) {
    const x = Number(selRect.getAttribute('x'));
    const y = Number(selRect.getAttribute('y'));
    const w = Number(selRect.getAttribute('width'));
    const h = Number(selRect.getAttribute('height'));
    if (Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0) {
      const overlay = svg.ownerDocument.createElementNS(SVG_NS, 'g');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('pointer-events', 'none');
      const halo = svg.ownerDocument.createElementNS(SVG_NS, 'rect');
      halo.setAttribute('x', String(x - 0.5));
      halo.setAttribute('y', String(y - 0.5));
      halo.setAttribute('width', String(w + 1));
      halo.setAttribute('height', String(h + 1));
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', pal.plotFocusHalo);
      halo.setAttribute('stroke-width', '4.2');
      const ring = svg.ownerDocument.createElementNS(SVG_NS, 'rect');
      ring.setAttribute('x', String(x - 0.5));
      ring.setAttribute('y', String(y - 0.5));
      ring.setAttribute('width', String(w + 1));
      ring.setAttribute('height', String(h + 1));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', pal.plotFocus);
      ring.setAttribute('stroke-width', '2.4');
      overlay.append(halo, ring);
      svg.append(overlay);
    }
  }
}

function drawIncrementPanel(ctx, slot, chartHost, metaHost, model, checks, widthHint) {
  const { data: d, pair, weighted, baselineProfiles, forwardProfiles, reverseProfiles } = model;
  const a = d.ids[pair.i];
  const b = d.ids[pair.j];
  const standaloneFwd = weighted.decision.costs.iAboveJ;
  const standaloneRev = weighted.decision.costs.jAboveI;
  const baseRisk = baselineProfiles[model.selected].evaluation.risk;
  const fwdProf = forwardProfiles[0] ?? null;
  const revProf = reverseProfiles[0] ?? null;
  const fwdRisk = fwdProf ? fwdProf.evaluation.risk : null;
  const revRisk = revProf ? revProf.evaluation.risk : null;
  const fwdDelta = fwdProf ? fwdProf.comparison.deltaRisk : null;
  const revDelta = revProf ? revProf.comparison.deltaRisk : null;

  const finiteVals = [model.tau, standaloneFwd, standaloneRev, baseRisk, fwdRisk, revRisk].filter((v) => typeof v === 'number' && Number.isFinite(v));
  const peak = Math.max(0.28, ...finiteVals);
  const xMax = peak > 0.85 ? 1 : Math.min(1, peak * 1.1);

  const w = Math.max(280, Math.round(widthHint || 420));
  const margin = { top: 28, right: 126, bottom: 10, left: Math.max(a.length, b.length) >= 3 ? 116 : 106 };
  const rows = [
    { key: 'alone-fwd', section: 'alone', label: `Alone ${a} > ${b}`, value: standaloneFwd, delta: null, feasible: true },
    { key: 'alone-rev', section: 'alone', label: `Alone ${b} > ${a}`, value: standaloneRev, delta: null, feasible: true },
    { key: 'base', section: 'report', label: 'Baseline', value: baseRisk, delta: null, feasible: true },
    { key: 'rep-fwd', section: 'report', label: `Report ${a} > ${b}`, value: fwdRisk, delta: fwdDelta, feasible: Boolean(fwdProf) },
    { key: 'rep-rev', section: 'report', label: `Report ${b} > ${a}`, value: revRisk, delta: revDelta, feasible: Boolean(revProf) },
  ];
  const yPositions = [42, 74, 122, 154, 186];

  svgScene(
    chartHost,
    {
      width: w,
      height: 210,
      margin,
      alt: `Horizontal bar comparison for ${a} versus ${b}: standalone pair costs against withholding threshold tau, and full coherent report risks with signed risk changes.`,
      table: {
        caption: ['Standalone pair costs and coherent report risks for ', nm(ctx, a), ' and ', nm(ctx, b)],
        columns: [
          { label: 'Comparison', value: 'label', name: true },
          { label: 'Cost or risk', value: 'value', format: (v) => (v === null ? 'NA' : formatReadoutRisk(v)) },
          { label: 'Signed change vs baseline', value: 'delta', format: (v) => (v === null ? '' : formatReadoutRisk(v, { signed: true })) },
        ],
        rows,
      },
    },
    (scene) => {
      const { el, palette: pal, innerWidth } = scene;
      const x0 = margin.left;
      const x1 = margin.left + innerWidth;
      const xAt = (v) => x0 + Math.max(0, Math.min(1, v / xMax)) * innerWidth;
      const barH = 15;
      const hatch = scene.hatchDef();

      const tauX = xAt(model.tau);
      const tauLabelX = Math.max(x0 + 26, Math.min(x1 - 26, tauX));
      scene.add(
        el('line', { x1: tauX, y1: 23, x2: tauX, y2: 88, stroke: pal.plotAxis, strokeWidth: 1.5, strokeDasharray: '4 3' }),
        el(
          'text',
          { x: tauLabelX, y: 15, textAnchor: 'middle', fill: pal.plotFg, fontWeight: 600 },
          'τ = ',
          el('tspan', { text: formatSetting(model.tau), 'data-num': String(model.tau) }),
        ),
        el('line', { x1: 4, y1: 99, x2: w - 4, y2: 99, stroke: pal.plotGrid, strokeWidth: 1 }),
      );

      const baseX = xAt(baseRisk);
      scene.add(el('line', { x1: baseX, y1: 108, x2: baseX, y2: 198, stroke: pal.plotMuted, strokeWidth: 1.25, strokeDasharray: '3 3' }));

      rows.forEach((row, idx) => {
        const cy = yPositions[idx];
        const barTop = cy - barH / 2;
        scene.add(
          el('text', {
            x: x0 - 8,
            y: cy + 4.5,
            textAnchor: 'end',
            fill: pal.plotFg,
            fontWeight: row.key === 'rep-fwd' ? 700 : 500,
            dataset: { prxName: '' },
            text: row.label,
          }),
          el('rect', { x: x0, y: barTop, width: innerWidth, height: barH, rx: 2.5, fill: pal.plotGrid, fillOpacity: 0.55 }),
        );

        if (!row.feasible || row.value === null) {
          scene.add(
            el('rect', { x: x0, y: barTop, width: innerWidth, height: barH, rx: 2.5, fill: hatch, stroke: pal.cellBorder, strokeDasharray: '3 2' }),
            el('text', { x: w - 4, y: cy + 4.5, textAnchor: 'end', fill: pal.plotMuted, fontStyle: 'italic', text: 'Infeasible' }),
          );
          return;
        }

        const valX = xAt(row.value);
        const barW = Math.max(row.value > 0 ? 2.5 : 0, valX - x0);
        if (row.section === 'alone') {
          const fill = row.value <= model.tau ? (row.key === 'alone-fwd' ? pal.relAbove : pal.relBelow) : pal.wh;
          scene.add(
            el('rect', { x: x0, y: barTop, width: barW, height: barH, rx: 2.5, fill }),
            scene.numText({ x: w - 4, y: cy + 4.5, textAnchor: 'end', fill: pal.plotFg, fontWeight: 600 }, row.value, formatReadoutRisk(row.value)),
          );
        } else if (row.key === 'base') {
          scene.add(
            el('rect', { x: x0, y: barTop, width: barW, height: barH, rx: 2.5, fill: pal.post }),
            scene.numText({ x: w - 4, y: cy + 4.5, textAnchor: 'end', fill: pal.plotFg, fontWeight: 600 }, row.value, formatReadoutRisk(row.value)),
          );
        } else {
          const basePartW = Math.max(0, Math.min(valX, baseX) - x0);
          const extraStart = Math.min(valX, baseX);
          const extraW = Math.max(0, Math.abs(valX - baseX));
          scene.add(el('rect', { x: x0, y: barTop, width: basePartW, height: barH, rx: 2.5, fill: pal.post }));
          if (extraW > 0.5) {
            scene.add(el('rect', { x: extraStart, y: barTop, width: Math.max(2, extraW), height: barH, rx: 1.5, fill: row.delta >= 0 ? pal.est : pal.relAbove }));
          }
          scene.add(
            scene.numText({ x: w - 72, y: cy + 4.5, textAnchor: 'end', fill: pal.plotFg, fontWeight: 600 }, row.value, formatReadoutRisk(row.value)),
            scene.numText(
              { x: w - 4, y: cy + 4.5, textAnchor: 'end', fill: row.delta > 0 ? pal.errText : pal.plotMuted, fontWeight: 700 },
              row.delta,
              formatReadoutRisk(row.delta, { signed: true }),
            ),
          );
        }
      });
    },
  );

  const signs = new Set(checks.map((c) => c.direction).filter(Boolean));
  const agreeText = checks.length === 1
    ? '1 criterion'
    : signs.size > 1
      ? 'Criteria oppose'
      : checks.every((c) => c.direction !== 0)
        ? `Criteria agree (${checks[0].direction === 1 ? `${a} > ${b}` : `${b} > ${a}`})`
        : 'Equal criterion errors';
  const familySize = familySizeNode(ctx, { family: model.baseline.baseFamily });
  metaHost.replaceChildren(
    'Standalone: ',
    nm(ctx, `${a} > ${b}`), ' ', n(ctx, standaloneFwd, 'roRisk'), ', ',
    nm(ctx, `${b} > ${a}`), ' ', n(ctx, standaloneRev, 'roRisk'),
    ' · ',
    nm(ctx, agreeText),
    ' · ',
    familySize,
    ' candidates',
    ...(model.relaxed && model.relaxedForwardProfiles[0]
      ? [' · Relaxed ', nm(ctx, `${a} > ${b}`), ' ', n(ctx, model.relaxedForwardProfiles[0].evaluation.risk, 'roRisk')]
      : []),
    '.',
  );
}

/** Linked diagnostic view; reuses scroll regions and controls across updates to prevent layout/listener churn. */
export function createWhyWithheldView(ctx, slots, { onPair = () => {} } = {}) {
  const costView = createPairCostView(ctx, slots.cost, { title: 'Test one · the isolated pair', descriptionPosition: 'after' });
  const pairView = createCriterionPairView(ctx, slots.criterion);
  const matrixHeading = ctx.panelTitle('Baseline pair relations');
  const matrixFigure = ctx.h('div');
  const matrixScroll = ctx.h('div', { class: 'why-scroll' }, matrixFigure);
  ctx.scrollRegion(matrixScroll, 'Complete unit relation matrix');
  const matrixLegend = ctx.part('legend', ctx.h('p', { class: 'why-legend' }));
  slots.matrix.append(matrixHeading, matrixScroll, matrixLegend);

  const incHeading = ctx.panelTitle('Pair cost vs. coherent report');
  const incChartHost = ctx.h('div');
  const incMetaHost = ctx.h('p', { class: 'why-stage-meta' });
  if (slots.tests) slots.tests.append(incHeading, incChartHost, incMetaHost);

  // Persistent scroll wrappers inside disclosures (allocated once, never re-registered per tau step).
  const scrollBoxes = new Map();
  const getScrollBox = (key, label) => {
    if (!scrollBoxes.has(key)) {
      const box = ctx.h('div', { class: 'why-scroll' });
      ctx.scrollRegion(box, label);
      scrollBoxes.set(key, box);
    }
    return scrollBoxes.get(key);
  };

  // Persistent account report selectors (avoids leaking scope.listen handlers on every render).
  const accountSelects = {};
  const accountOptionsKey = { forward: null, reverse: null };
  for (const key of ['forward', 'reverse']) {
    accountSelects[key] = ctx.select({
      label: 'Report for the complete changed-pair account',
      name: `account-${key}`,
      options: [{ value: 0, label: '1' }],
      onChange: (v) => ctx.set({ [key]: Number(v) }),
    });
  }

  let focusedPair = null;
  let krwCanvas = null;
  let krwCellsRef = null;
  let krwPairRef = null;
  let cachedMatrixKey = null;
  let cachedMatrixTable = null;
  let cardsRenderedKey = null;

  ctx.listen(slots.matrix, 'keydown', (e) => {
    if (!e.target.closest('.prx-kbd-point')) return;
    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      ctx.timeout(() => e.target.isConnected && e.target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }), 0);
    }
    if ((e.key === 'Enter' || e.key === ' ') && focusedPair) {
      e.preventDefault();
      onPair(focusedPair);
    }
  });

  function renderDirectionBlock(parentSlot, model, result, profiles, prefix, key, title) {
    const titleNode = ctx.panelTitle(title);
    titleNode.setAttribute('data-prx-name', '');
    parentSlot.append(titleNode, tieLine(ctx, result, prefix));
    if (result.empty) return;
    const sBox = getScrollBox(`coherent-${key}`, title);
    sBox.replaceChildren(profilesTable(ctx, model, profiles, prefix));
    parentSlot.append(sBox);
    const chosen = Math.min(model.state[key], profiles.length - 1);
    const ctl = accountSelects[key];
    const optKey = String(profiles.length);
    if (accountOptionsKey[key] !== optKey) {
      ctl.input.replaceChildren(...profiles.map((_, i) => ctx.h('option', { value: String(i) }, n(ctx, i + 1, 'count'))));
      accountOptionsKey[key] = optKey;
    }
    ctl.input.value = String(chosen);
    ctl.root.hidden = profiles.length <= 1;
    parentSlot.append(ctl.root);
    if (!slots.accounts) {
      const accScroll = getScrollBox(`inline-acc-${key}`, 'Complete signed changed-pair account');
      accounting(ctx, parentSlot, accScroll, model, profiles[chosen], `${prefix}-account`);
    }
  }

  function renderAccounts(model) {
    if (!slots.accounts || !model) return;
    const { h } = ctx;
    const { data, pair } = model;
    const overview = model.key === 'krw' ? krwAccountOverviewNode(ctx, model) : null;
    const sections = ['forward', 'reverse'].flatMap((key) => {
      const profiles = model[`${key}Profiles`];
      if (!profiles.length) return [];
      const chosen = Math.min(model.state[key], profiles.length - 1);
      const orientation = key === 'forward' ? [pair.i, pair.j] : [pair.j, pair.i];
      const slot = h(
        'section',
        { class: 'why-section why-paper prx-light-panel' },
        ctx.panelTitle(nm(ctx, `${data.ids[orientation[0]]} above ${data.ids[orientation[1]]}`)),
      );
      const accScroll = getScrollBox(`accounts-${key}`, 'Complete signed changed-pair account');
      accounting(ctx, slot, accScroll, model, profiles[chosen], `${key}-account`, {
        rows: model.key !== 'krw' || slots.accounts.open,
      });
      return [slot];
    });
    slots.accounts.root.hidden = !sections.length;
    slots.accounts.body.replaceChildren(...(overview ? [overview] : []), ...sections);
  }

  function prepareCardsHeader(model, { force = false } = {}) {
    if (!model) return false;
    if (!model.cards.length) {
      slots.cards.hidden = true;
      slots.cards.replaceChildren();
      cardsRenderedKey = null;
      return false;
    }
    slots.cards.hidden = false;
    const { grade, pair } = model;
    const wPx = Math.round(slots.cards.clientWidth || 0);
    const targetKey = `${model.key}|${grade.join(',')}|${pair.i}|${wPx}`;
    if (!force && cardsRenderedKey === targetKey && slots.cards.querySelectorAll('svg').length === model.cards.length) return false;
    cardsRenderedKey = null;
    slots.cards.replaceChildren(
      ctx.panelTitle('The selected baseline on the supplied marginal scales'),
      ctx.h('p', { class: 'why-note' }, 'Dots are posterior means and lines are marginal intervals. Intervals do not choose the grades and are not intervals for grade membership. Each criterion keeps its own scale.'),
    );
    if (model.E.criteria.length > 1) {
      slots.cards.append(
        ctx.h(
          'p',
          { class: 'why-note' },
          'Average of criterion ranks is the average of each criterion’s own expected position, with highest priority first, using weights ',
          ...model.w.flatMap((v, k) => [k ? ', ' : '', n(ctx, v, 'setting')]),
          '. The same weights are used here for a common ordering within grades. Both marginal cards share that ordering; this is not an expected rank of a composite target.',
        ),
      );
    } else {
      slots.cards.append(
        ctx.h('p', { class: 'why-note' }, 'Expected rank is this criterion’s average posterior position, with highest priority first; it orders rows within each grade.'),
      );
    }
    return true;
  }

  function renderOneCard(model, cardIndex) {
    const card = model?.cards?.[cardIndex];
    if (!card) return;
    const { grade, pair } = model;
    const fig = ctx.h('div', { class: 'why-card' });
    slots.cards.append(fig);
    const cardNameSet = new Set(card.names);
    drawReportCard(fig, card, {
      grade,
      order: 'grade',
      selected: pair.i,
      ...(model.E.criteria.length > 1 ? { rankLabel: 'Average of criterion ranks' } : {}),
    });
    for (const t of fig.querySelectorAll('svg text, table tbody th')) {
      if (cardNameSet.has(t.textContent)) t.setAttribute('data-prx-name', '');
    }
    if (cardIndex === model.cards.length - 1) {
      cardsRenderedKey = `${model.key}|${grade.join(',')}|${pair.i}|${Math.round(slots.cards.clientWidth || 0)}`;
    }
  }

  function renderCards(model, opts = {}) {
    if (!prepareCardsHeader(model, opts)) return;
    for (let k = 0; k < model.cards.length; k += 1) renderOneCard(model, k);
  }

  function renderPrimary(model, checks, widths = {}) {
    const { data: d, grade, pair } = model;
    const a = d.ids[pair.i];
    const b = d.ids[pair.j];
    const order = cardRows(model.cards[0] ?? { ids: model.E.ids, storedOrder: 'input' }, grade, 'grade');
    const ids = order.map((i) => d.ids[i]);
    const rel = relations(grade);
    const cells = order.flatMap((i) => order.map((j) => ({ i, j, row: d.ids[i], column: d.ids[j], relation: rel[i][j] })));

    const isLarge = d.n > 20;
    matrixScroll.classList.toggle('why-matrix-large', d.n > 12);
    const availMatW = Math.max(250, Math.round((widths.matrix || 360) - 4));
    const cellSize = isLarge ? 22 : d.n > 8 ? 24 : 36;
    const matrixWidth = isLarge
      ? d.n * cellSize + 80
      : Math.min(availMatW, Math.max(252, d.n * cellSize + 72));
    const marginBottom = isLarge ? 60 : 42;
    const marginLeft = isLarge ? 50 : 42;
    const marginTop = 10;
    const marginRight = 10;
    const matrixHeight = isLarge
      ? d.n * cellSize + 80
      : Math.max(210, Math.min(340, matrixWidth - 4));

    if (isLarge) {
      matrixFigure.style.width = `${matrixWidth}px`;
      matrixFigure.style.minWidth = `${matrixWidth}px`;
    } else {
      matrixFigure.style.width = `${matrixWidth}px`;
      matrixFigure.style.minWidth = '';
    }

    const matrixTableKey = `${model.key}|${grade.join(',')}`;
    const reuseTable = cachedMatrixKey === matrixTableKey && cachedMatrixTable !== null;
    const selectedCell = cells.filter((r) => r.i === pair.i && r.j === pair.j);
    const showGlyphs = d.n <= 8;

    if (!isLarge && krwCanvas) {
      krwCanvas.remove();
      krwCanvas = null;
    }

    const chart = plot(matrixFigure, {
      width: matrixWidth,
      height: matrixHeight,
      marginLeft,
      marginBottom,
      marginTop,
      marginRight,
      x: { domain: ids, label: 'Column unit', tickRotate: d.n > 12 ? -60 : 0 },
      y: { domain: ids, label: 'Row unit' },
      color: { type: 'identity' },
      alt: 'Every ordered unit pair is colored by the selected baseline report: row above column, row below column, or withheld. The outlined cell is the selected pair. A same-grade off-diagonal cell withholds; it does not assert equality.',
      table: reuseTable ? undefined : cells.map((r) => ({ row: r.row, column: r.column, relation: relationWords(model, r.relation, r.i, r.j) })),
      keyboard: {
        data: cells,
        x: 'column',
        y: 'row',
        columns: d.n,
        sort: false,
        virtual: true,
        key: (r) => `${r.i}:${r.j}`,
        title: (r) => (r.i === r.j ? `${r.row}: diagonal` : `${r.row} / ${r.column}: ${relationWords(model, r.relation, r.i, r.j)}. Press Enter to inspect.`),
        onFocus: (r) => {
          focusedPair = r.i === r.j ? null : `${r.row},${r.column}`;
        },
      },
      marks: (c, P) => [
        ...(isLarge
          ? [
              P.cell(selectedCell, {
                x: 'column',
                y: 'row',
                fill: 'none',
                stroke: c.plotFocus,
                strokeWidth: 2.4,
                inset: 0.5,
              }),
            ]
          : [
              P.cell(cells, {
                x: 'column',
                y: 'row',
                fill: (r) => (r.i === r.j ? c.neutral[0] : r.relation === 1 ? c.relAbove : r.relation === -1 ? c.relBelow : c.relWithheld),
                inset: 1,
                stroke: c.cellBorder,
                strokeWidth: 0.75,
              }),
              ...(showGlyphs
                ? [
                    P.text(cells, {
                      x: 'column',
                      y: 'row',
                      text: (r) => (r.i === r.j ? '—' : r.relation === 1 ? '>' : r.relation === -1 ? '<' : ''),
                      fill: (r) => (r.relation === 1 ? c.labelLight : r.relation === -1 ? c.labelDark : c.plotMuted),
                      fontWeight: 700,
                    }),
                  ]
                : []),
            ]),
        P.tip(cells, P.pointer({ x: 'column', y: 'row', title: (r) => `${r.row} / ${r.column}: ${relationWords(model, r.relation, r.i, r.j)}` })),
      ],
    });

    if (reuseTable && cachedMatrixTable) {
      const container = matrixFigure.firstElementChild;
      if (container && !container.contains(cachedMatrixTable)) container.append(cachedMatrixTable);
    } else if (chart.table) {
      cachedMatrixKey = matrixTableKey;
      cachedMatrixTable = chart.table;
    }

    const pal = chart.palette;
    if (isLarge) {
      const idSet = new Set(ids);
      for (const t of chart.svg.querySelectorAll('text')) {
        if (idSet.has(t.textContent)) t.setAttribute('data-prx-name', '');
      }
      krwCellsRef = cells;
      krwPairRef = pair;
      if (krwCanvas) krwCanvas.remove();
      const sx = chart.scale('x');
      const sy = chart.scale('y');
      const bwX = sx.bandwidth ? sx.bandwidth : cellSize - 1;
      const bwY = sy.bandwidth ? sy.bandwidth : cellSize - 1;
      krwCanvas = canvasLayer(chart, (g, { palette: cp }) => {
        for (const r of krwCellsRef) {
          const cx = sx.apply(r.column);
          const cy = sy.apply(r.row);
          if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
          g.fillStyle = r.i === r.j ? cp.neutral[0] : r.relation === 1 ? cp.relAbove : r.relation === -1 ? cp.relBelow : cp.relWithheld;
          g.fillRect(cx + 0.5, cy + 0.5, bwX - 1, bwY - 1);
          if (r.i !== r.j && r.relation === 0 && typeof g.beginPath === 'function') {
            g.strokeStyle = cp.hatch;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(cx + 2, cy + bwY - 2);
            g.lineTo(cx + bwX - 2, cy + 2);
            g.stroke();
          }
        }
        const sel = krwCellsRef.find((r) => r.i === krwPairRef.i && r.j === krwPairRef.j);
        if (sel && typeof g.strokeRect === 'function') {
          const cx = sx.apply(sel.column);
          const cy = sy.apply(sel.row);
          g.strokeStyle = cp.plotFocusHalo;
          g.lineWidth = 4;
          g.strokeRect(cx, cy, bwX, bwY);
          g.strokeStyle = cp.plotFocus;
          g.lineWidth = 2.2;
          g.strokeRect(cx, cy, bwX, bwY);
        }
      });
    } else {
      decorateMatrixSvg(chart.svg, pal, ids, cells, pair);
    }

    matrixLegend.replaceChildren(
      ctx.h('span', {}, ctx.h('i', { class: 'why-key', style: { background: pal.relAbove }, 'aria-hidden': 'true' }), 'Row above'),
      ctx.h('span', {}, ctx.h('i', { class: 'why-key', style: { background: pal.relBelow }, 'aria-hidden': 'true' }), 'Row below'),
      ctx.h('span', {}, ctx.h('i', { class: 'why-key why-key-withheld', 'aria-hidden': 'true' }), 'Withheld'),
    );

    chart.svg.onclick = (e) => {
      const box = chart.svg.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0)) return;
      const x = ((e.clientX - box.left) * Number(chart.svg.getAttribute('width'))) / box.width;
      const y = ((e.clientY - box.top) * Number(chart.svg.getAttribute('height'))) / box.height;
      if (x < marginLeft || x > matrixWidth - marginRight || y < marginTop || y > matrixHeight - marginBottom) return;
      const sx = chart.scale('x');
      const sy = chart.scale('y');
      const nearest = (domain, s, p) => domain.reduce((acc, v) => (Math.abs(s.apply(v) + (s.bandwidth || 0) / 2 - p) < Math.abs(s.apply(acc) + (s.bandwidth || 0) / 2 - p) ? v : acc), domain[0]);
      const col = nearest(ids, sx, x);
      const row = nearest(ids, sy, y);
      if (row !== col) onPair(`${row},${col}`);
    };

    if (slots.tests) {
      incHeading.replaceChildren(nm(ctx, a), ' vs. ', nm(ctx, b), ' · pair cost & coherent report');
      drawIncrementPanel(ctx, slots.tests, incChartHost, incMetaHost, model, checks, widths.tests || 430);
    }
  }

  function renderDataTablesStage1(model, checks) {
    const { data: d, baseline, grade, pair, law } = model;
    const baseScroll = getScrollBox('baseline-optima', 'Every retained baseline optimum');
    baseScroll.replaceChildren(profilesTable(ctx, model, model.baselineProfiles, 'baseline'));
    slots.baseline.replaceChildren(
      ctx.panelTitle('Selected baseline report'),
      ctx.h(
        'p',
        {},
        'Grade one states higher oriented priority. A shared grade means “not compared”, not equality. ',
        nm(ctx, d.ids[pair.i]),
        ' / ',
        nm(ctx, d.ids[pair.j]),
        ': ',
        nm(ctx, relationWords(model, relations(grade)[pair.i][pair.j], pair.i, pair.j)),
        '.',
      ),
      tieLine(ctx, baseline, 'baseline'),
      ctx.h(
        'p',
        {},
        'M = ',
        n(ctx, d.M, 'count', 'M'),
        ' unordered pairs; N counts pairs in different grades. E is the expected wrong-direction count for one criterion; E/N is its expected wrong share among statements. Risk charges withholding once at τ = ',
        n(ctx, model.tau, 'setting', 'tau'),
        '.',
      ),
      ctx.h('p', {}, 'Fixed error weights: ', ...model.w.flatMap((v, k) => [k ? '; ' : '', d.criterionLabels[k], ' ', n(ctx, v, 'setting', `weight-${k}`)])),
      hint(ctx),
      baseScroll,
    );

    costView.render(model);
    pairView.render(model);
    slots.criterion.prepend(ctx.panelTitle('Test two · directions and certainty by criterion'));
    const thresholds = [0.9, 0.99];
    const critScroll = getScrollBox('criterion-thresholds', 'Preferred directions and supplied-error certainty thresholds');
    critScroll.replaceChildren(
      table(
        ctx,
        [
          'Criterion',
          'Preferred strict direction',
          'Forward cost',
          'Reverse cost',
          ...thresholds.map((t) => ctx.h('span', {}, 'Smaller directional error below one minus ', n(ctx, t, 'prob'))),
        ],
        checks.map((r) => [
          r.label,
          nm(ctx, r.direction === 1 ? `${d.ids[pair.i]} above ${d.ids[pair.j]}` : r.direction === -1 ? `${d.ids[pair.j]} above ${d.ids[pair.i]}` : 'Neither: equal directional errors'),
          n(ctx, r.eIJ, 'prob'),
          n(ctx, r.eJI, 'prob'),
          ...r.counts.map((v) => (v ? 'Yes' : 'No')),
        ]),
      ),
    );
    slots.criterion.append(
      critScroll,
      ctx.h('p', { class: 'why-note' }, 'The threshold columns check the supplied weak-error coefficients with a strict inequality; an empirical or rounded zero alone does not establish certainty outside the supplied law.'),
    );
    if (!law && model.key !== 'six') {
      slots.criterion.append(ctx.h('p', { class: 'why-note' }, 'Strict-direction and equality probabilities are not separately supplied here, so those columns read NA.'));
    }
    if (law) {
      const stateScroll = getScrollBox('criterion-states', 'Every finite state and its directional costs');
      stateScroll.replaceChildren(
        table(
          ctx,
          ['State probability', 'All oriented unit values', 'Forward cost at state', 'Reverse cost at state', 'Statewise γ'],
          law.states.map((st, s) => [
            n(ctx, law.probs[s], 'prob', `state-${s}-prob`),
            ctx.h('span', {}, ...st.flatMap((row, i) => [i ? '; ' : '', nm(ctx, d.ids[i]), ': ', ...row.flatMap((v, k) => [k ? ', ' : '', n(ctx, v, 'value')])])),
            n(ctx, model.states[s].decision.costs.iAboveJ, 'risk', `state-${s}-forward`),
            n(ctx, model.states[s].decision.costs.jAboveI, 'risk', `state-${s}-reverse`),
            n(ctx, model.states[s].decision.directionalMinimum, 'risk', `state-${s}-gamma`),
          ]),
        ),
      );
      slots.criterion.append(
        ctx.panelTitle('The complete stipulated states'),
        ctx.h('p', { class: 'why-note' }, 'Criteria may agree within every state while the direction remains uncertain across states. Statewise γ is the smaller directional cost at that known state, excluding withholding.'),
        stateScroll,
      );
    }
  }

  function renderDataTablesStage2(model) {
    const { data: d, baseline, pair, forward, reverse, law } = model;
    slots.coherent.replaceChildren(
      ctx.panelTitle('Test three · require a coherent report to state the pair'),
      ctx.h('p', {}, 'Each search keeps the baseline’s supplied law, weights, τ and base family. Requiring a direction may change other pair statements.'),
      hint(ctx),
    );
    renderDirectionBlock(slots.coherent, model, forward, model.forwardProfiles, 'forward', 'forward', `${d.ids[pair.i]} above ${d.ids[pair.j]}`);
    renderDirectionBlock(slots.coherent, model, reverse, model.reverseProfiles, 'reverse', 'reverse', `${d.ids[pair.j]} above ${d.ids[pair.i]}`);

    slots.family.replaceChildren(
      ctx.panelTitle('Test four · change a declared family restriction'),
      ctx.h('p', { class: 'why-note' }, 'This test changes the feasible reports while holding the loss and supplied law fixed. A positive same-family extra risk means feasible but costly; an empty constrained family means infeasible.'),
      hint(ctx),
    );
    if (model.family.kind === 'order') {
      slots.family.append(
        ctx.h(
          'p',
          { class: 'why-order' },
          'Declared fixed order: ',
          nm(ctx, model.family.order.map((i) => d.ids[i]).join(' → ')),
          '. ',
          model.family.blocks ? 'The final two units are an indivisible block.' : 'No indivisible multi-unit block.',
        ),
      );
    }
    if (model.relaxed) {
      const relBaseScroll = getScrollBox('relaxed-baseline', 'Relaxed baseline optima');
      relBaseScroll.replaceChildren(profilesTable(ctx, model, model.relaxedBaselineProfiles, 'relaxed-baseline'));
      slots.family.append(ctx.h('p', {}, model.relaxed.words, '.'), tieLine(ctx, model.relaxedBaseline, 'relaxed-baseline'), relBaseScroll);
      for (const [title, result, profiles, prefix] of [
        [`${d.ids[pair.i]} above ${d.ids[pair.j]}`, model.relaxedForward, model.relaxedForwardProfiles, 'relaxed-forward'],
        [`${d.ids[pair.j]} above ${d.ids[pair.i]}`, model.relaxedReverse, model.relaxedReverseProfiles, 'relaxed-reverse'],
      ]) {
        const titleNode = ctx.panelTitle(title);
        titleNode.setAttribute('data-prx-name', '');
        slots.family.append(titleNode, tieLine(ctx, result, prefix));
        if (!result.empty) {
          const rScroll = getScrollBox(prefix, title);
          rScroll.replaceChildren(profilesTable(ctx, model, profiles, prefix));
          slots.family.append(rScroll);
        }
      }
    } else if (model.key === 'cde') {
      slots.family.append(
        ctx.h(
          'p',
          {},
          'The largest family searched here is the released teaching subset with at most three grades (',
          n(ctx, baseline.baseFamily.size, 'count'),
          ' candidates). Choose a smaller cap in Settings to compare against this family.',
        ),
      );
    } else {
      slots.family.append(
        ctx.h(
          'p',
          {},
          model.key === 'krw'
            ? 'The baseline already has no cap within the fixed expected-rank order.'
            : 'The baseline already searches all coherent reports. There is no family restriction to relax.',
        ),
      );
      const metadata = ctx.h('div', { hidden: true, 'aria-hidden': 'true', 'data-prx-relaxed-aliases': '' });
      for (const panel of [slots.baseline, slots.coherent]) {
        for (const original of panel.querySelectorAll('[data-prx-readout]')) {
          const key = original.dataset.prxReadout;
          if (!/^(baseline|forward|reverse)-(ties$|family$|grade-|risk-|N-|delta-|E-|share-|perpair-|Rk-)/.test(key)) continue;
          const alias = original.cloneNode(true);
          alias.dataset.prxReadout = `relaxed-${key}`;
          metadata.append(alias);
        }
      }
      slots.family.append(metadata);
    }
    if (model.key === 'krw') {
      slots.family.append(
        ctx.h(
          'p',
          { class: 'why-note' },
          'Both baseline and pair-stating counterfactual are postrank contiguous cuts of this fixed expected-rank order, distinct from KRW’s archived cards; no unrestricted all-firm optimum is implied.',
        ),
      );
    }

    renderAccounts(model);

    slots.source.replaceChildren(
      ctx.panelTitle('What these tests establish'),
      ctx.h('p', {}, 'These are nonexclusive comparisons under a supplied law; they do not identify a unique cause of a shared grade. Other equal-risk optima can withhold different pairs.'),
      ctx.h('p', {}, 'Click a matrix cell (or focus the matrix, move with arrow keys, and press Enter) to inspect any pair. Report vectors follow source unit order: ', nm(ctx, d.ids.join(', ')), '.'),
    );
    if (model.key === 'cde') {
      slots.source.append(
        ctx.h('p', {}, 'A deliberately spread teaching subset, not a representative statewide sample. School binomial posteriors condition on a fixed statewide prior without propagating prior estimation uncertainty.'),
        ctx.h(
          'p',
          {},
          'Related pair view: ',
          ctx.h(
            { href: ctx.doc.location.pathname.includes('/embed/') ? '../pages/cases/cde-pair.html' : '../cases/cde-pair.html' }.href
              ? 'a'
              : 'span',
            { href: ctx.doc.location.pathname.includes('/embed/') ? '../pages/cases/cde-pair.html' : '../cases/cde-pair.html' },
            'A sure pair left unsaid (',
            n(ctx, 5, 'count'),
            '.',
            n(ctx, 10, 'count'),
            ')',
          ),
          '.',
        ),
        ctx.h('p', { class: 'why-note' }, ...sourceProse(ctx, `${CDE.attribution} ${CDE.change_notice} ${CDE.notice}`)),
      );
    } else if (model.key === 'krw') {
      slots.source.append(
        ctx.h('p', {}, KRW.facts.conditioning),
        ctx.h('p', { class: 'why-note' }, ...sourceProse(ctx, `${KRW.attribution} ${KRW.change_notice} ${KRW.notice} Provided as is, without warranty.`)),
      );
    } else {
      slots.source.append(
        ctx.h('p', {}, ...sourceProse(ctx, law ? `Restated finite law (${law.source}).` : 'Six fictional sites from the postrank tutorial; independent Normal sites and criteria (CC BY 4.0).')),
      );
    }
  }

  return {
    renderAccounts,
    renderCards,
    prepareCardsHeader,
    renderOneCard,
    renderPrimary,
    renderDataTablesStage1,
    renderDataTablesStage2,
    render(model, widths = {}) {
      const checks = criterionChecks(model);
      renderPrimary(model, checks, widths);
      renderDataTablesStage1(model, checks);
      renderDataTablesStage2(model);
      renderCards(model);
    },
  };
}

function buildScopeParts(ctx, model) {
  if (model.key === 'cde') {
    return [
      ...sourceProse(
        ctx,
        'Data: California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26; CDE source conditions apply (',
      ),
      ctx.h('a', { href: 'https://www.cde.ca.gov/re/di/cr/index.asp', target: '_blank', rel: 'noopener' }, 'https://www.cde.ca.gov/re/di/cr/index.asp'),
      '); fixed statewide prior; no CDE endorsement is implied.',
    ];
  }
  if (model.key === 'krw') {
    return sourceProse(
      ctx,
      'Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700, deposit doi:10.3886/E198284V1. Noncommercial use only (CC-BY-NC); no endorsement implied; fixed empirical-Bayes prior without refit.',
    );
  }
  return null;
}

function controls(ctx) {
  const tau = ctx.slider({
    label: 'Withholding cost τ',
    ...ctx.key('tau'),
    onInput: (v) => ctx.set({ tau: v }),
  });

  const data = ctx.select({
    label: 'Supplied law',
    name: 'data',
    options: Object.entries(TITLES).map(([value, label]) => ({ value, label })),
    onChange: (value) => ctx.set({ data: value, ...DEFAULTS[value], pair: 'auto', restriction: 'source', report: 0, forward: 0, reverse: 0 }),
  });
  const restriction = ctx.select({
    label: 'Declared order blocks',
    name: 'restriction',
    options: [
      { value: 'source', label: 'Separate units may be cut' },
      { value: 'blocked', label: 'B and C must stay in one grade' },
    ],
    onChange: (v) => ctx.set({ restriction: v }),
  });
  const first = ctx.select({
    label: 'Baseline optimum to inspect',
    name: 'report',
    options: Array.from({ length: 101 }, (_, i) => ({ value: i, label: `Retained report ${i + 1}` })),
    onChange: (v) => ctx.set({ report: v }),
  });

  const flipKrw = ctx.button({
    label: 'Flip pair',
    key: 'flip-pair',
    onClick: () => {
      const input = whyWithheldInput('krw');
      const [i, j] = pairIndices(input, ctx.state.pair);
      ctx.set({ pair: `${input.data.ids[j]},${input.data.ids[i]}`, forward: 0, reverse: 0 });
    },
  });

  const compactPairGroups = {};
  const settingsGroups = {};
  const capsWrap = ctx.h('div', { class: 'why-group' });
  const settings = ctx.settingsBox('Settings');
  const secondary = ctx.h('div', { class: 'why-settings' }, data.root, capsWrap, restriction.root, first.root);
  settings.body.append(secondary);

  ctx.controls.append(ctx.primaryControl(tau.root));
  for (const key of Object.keys(TITLES)) {
    const input = whyWithheldInput(key);
    const d = input.data;
    const cap = ctx.select({
      label: 'Grade-count family',
      name: `cap-${key}`,
      options: CAPS[key].map((value) => ({ value, label: capWords(value) })),
      onChange: (v) => ctx.set({ cap: v, report: 0, forward: 0, reverse: 0 }),
    });
    capsWrap.append(cap.root);

    let pair, firstUnit, secondUnit;
    if (key === 'krw') {
      const choose = (side, v) => {
        const old = pairIndices(input, ctx.state.pair);
        const next = old.slice();
        const selected = d.ids.indexOf(v);
        next[side] = selected;
        if (next[0] === next[1]) next[1 - side] = old[side];
        ctx.set({ pair: `${d.ids[next[0]]},${d.ids[next[1]]}`, forward: 0, reverse: 0 });
      };
      const options = d.ids.map((value, i) => ({ value, label: `${value} · ${d.labels[i]}` }));
      firstUnit = ctx.select({ label: 'First firm', name: 'pair-krw-first', options, onChange: (v) => choose(0, v) });
      secondUnit = ctx.select({ label: 'Second firm', name: 'pair-krw-second', options, onChange: (v) => choose(1, v) });
      for (const sel of [firstUnit.input, secondUnit.input]) {
        for (const option of sel.options) option.dataset.prxName = '';
      }
    } else {
      pair = ctx.select({
        label: 'Proposed pair direction',
        name: `pair-${key}`,
        options: [
          { value: 'auto', label: 'Source example pair' },
          ...d.ids.flatMap((id, i) => d.ids.flatMap((other, j) => (i === j ? [] : [{ value: `${id},${other}`, label: `${id} above ${other}` }]))),
        ],
        onChange: (v) => ctx.set({ pair: v, forward: 0, reverse: 0 }),
      });
      const chooseShort = (side, v) => {
        const old = pairIndices(input, ctx.state.pair);
        const next = old.slice();
        const selected = d.ids.indexOf(v);
        next[side] = selected;
        if (next[0] === next[1]) next[1 - side] = old[side];
        ctx.set({ pair: `${d.ids[next[0]]},${d.ids[next[1]]}`, forward: 0, reverse: 0 });
      };
      const unitOpts = d.ids.map((value) => ({ value, label: value }));
      const u1 = ctx.select({ label: 'Row', name: `unit1-${key}`, options: unitOpts, onChange: (v) => chooseShort(0, v) });
      const u2 = ctx.select({ label: 'Col', name: `unit2-${key}`, options: unitOpts, onChange: (v) => chooseShort(1, v) });
      for (const sel of [u1.input, u2.input]) {
        for (const option of sel.options) option.dataset.prxName = '';
      }
      const cWrap = ctx.h('div', { class: 'why-pair-compact' }, u1.root, u2.root);
      compactPairGroups[key] = { wrap: cWrap, u1, u2, input };
      ctx.controls.append(cWrap);
    }
    const sGroup = ctx.h('div', { class: 'why-group' }, ...(pair ? [pair.root] : [firstUnit.root, secondUnit.root]));
    settingsGroups[key] = { group: sGroup, pair, firstUnit, secondUnit, cap, input };
    secondary.append(sGroup);
  }
  ctx.controls.append(flipKrw.root);

  let reportOptionsKey = null;
  return {
    render(state, model) {
      data.set(state.data);
      tau.set(state.tau);
      restriction.set(state.restriction);
      restriction.root.hidden = state.data !== 'order';
      first.root.hidden = !model || model.baseline.tieCount <= 1;
      flipKrw.root.hidden = state.data !== 'krw';
      if (state.data === 'krw') {
        const input = whyWithheldInput('krw');
        const [i, j] = pairIndices(input, state.pair);
        flipKrw.setLabel(`Flip ${input.data.ids[i]} / ${input.data.ids[j]}`);
      }
      if (model) {
        const grades = retainedGrades(model.baseline);
        const key = grades.map((g) => g.join('/')).join('|');
        if (key !== reportOptionsKey) {
          first.input.replaceChildren(...grades.map((g, i) => ctx.h('option', { value: String(i) }, `Retained report ${i + 1}: ${formatGrades(g)}`)));
          reportOptionsKey = key;
        }
        first.set(Math.min(state.report, Math.max(0, grades.length - 1)));
      }
      for (const [key, c] of Object.entries(settingsGroups)) {
        const active = key === state.data;
        c.group.hidden = !active;
        c.cap.root.hidden = !active;
        if (c.pair) c.pair.set(state.pair);
        else {
          const [i, j] = pairIndices(c.input, state.pair);
          c.firstUnit.set(c.input.data.ids[i]);
          c.secondUnit.set(c.input.data.ids[j]);
        }
        c.cap.set(state.cap);
      }
      for (const [key, cp] of Object.entries(compactPairGroups)) {
        const active = key === state.data;
        cp.wrap.hidden = !active;
        if (active) {
          const [i, j] = pairIndices(cp.input, state.pair);
          cp.u1.set(cp.input.data.ids[i]);
          cp.u2.set(cp.input.data.ids[j]);
        }
      }
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: 'why-withheld',
    className: 'why',
    frame: 'v2',
    css: WHY_WITHHELD_CSS + PAIR_COST_CSS + CRITERIA_PROFILE_CSS + REPORT_CARD_CSS,
    keys: WHY_WITHHELD_KEYS,
    build(ctx) {
      const { h } = ctx;
      ctx.root.classList.add('cp', 'sev', 'prx-rc');
      const control = controls(ctx);
      const slots = createWhyWithheldSlots(ctx, h('div'));
      slots.tests = h('section', { class: 'why-stage-col' });
      ctx.stage.append(h('div', { class: 'why-stage-grid' }, slots.matrix, slots.tests));

      const dataBox = ctx.dataBox('Data and exact values');
      dataBox.body.append(slots.baseline, slots.cost, slots.criterion, slots.coherent, slots.family);

      slots.accounts = ctx.disclosure({ name: 'accounts', title: 'Complete changed-pair accounts' });

      const methodBox = ctx.methodBox('Method and details');
      slots.method = methodBox;
      methodBox.body.append(slots.cards, slots.source);

      const view = createWhyWithheldView(ctx, slots, {
        onPair: (pair) => ctx.set({ pair, forward: 0, reverse: 0 }),
      });

      let last = null;
      let cachedWidths = { matrix: 360, tests: 430 };
      const sampleWidths = () => {
        const mw = slots.matrix.clientWidth;
        const tw = slots.tests.clientWidth;
        if (mw > 40) cachedWidths.matrix = mw;
        if (tw > 40) cachedWidths.tests = tw;
      };

      return {
        renderDisclosure(name) {
          if (!last) return false;
          if (name === 'accounts') {
            view.renderAccounts(last);
            return true;
          }
          if (name === 'method') {
            if (slots.method?.open) view.renderCards(last);
            return true;
          }
          if (name === 'data') {
            if (slots.data?.open) view.renderDataTablesStage1(last, criterionChecks(last));
            return true;
          }
          if (name === 'settings') return true;
          return false;
        },
        render(state, info = {}) {
          if (info.reason === 'disclosure') return;
          control.render(state, last?.key === state.data ? last : null);
          const cap = CAPS[state.data].includes(state.cap) ? state.cap : DEFAULTS[state.data].cap;
          if (cap !== state.cap) {
            ctx.set({ cap });
            return;
          }
          const input = whyWithheldInput(state.data);
          const valid = state.pair === 'auto' || (() => {
            const p = state.pair.split(',');
            return p.length === 2 && p[0] !== p[1] && p.every((v) => input.data.ids.includes(v));
          })();
          if (!valid) {
            ctx.set({ pair: 'auto' });
            return;
          }

          // Read layout widths once before any DOM writes to avoid forced synchronous layout.
          sampleWidths();

          const family = whyWithheldFamily(input, state);
          const pair = pairIndices(input, state.pair);
          const [i, j] = pair;
          const tau = state.tau;
          const relaxed = relaxation(input, family);

          let baseline, forward, reverse, relaxedBaseline = null, relaxedForward = null, relaxedReverse = null;
          let model = null;
          let checks = null;
          let redirected = false;

          const allCached =
            isSolveHit(input, tau, family, []) &&
            isSolveHit(input, tau, family, [[i, j]]) &&
            isSolveHit(input, tau, family, [[j, i]]) &&
            (!relaxed || (
              isSolveHit(input, tau, relaxed.family, []) &&
              isSolveHit(input, tau, relaxed.family, [[i, j]]) &&
              isSolveHit(input, tau, relaxed.family, [[j, i]])
            ));

          const solveSteps = allCached
            ? [
                () => {
                  baseline = solveCached(input, tau, family, []);
                  forward = solveCached(input, tau, family, [[i, j]]);
                  reverse = solveCached(input, tau, family, [[j, i]]);
                  if (relaxed) {
                    relaxedBaseline = solveCached(input, tau, relaxed.family, []);
                    relaxedForward = solveCached(input, tau, relaxed.family, [[i, j]]);
                    relaxedReverse = solveCached(input, tau, relaxed.family, [[j, i]]);
                  }
                },
              ]
            : [
                () => {
                  ctx.readout.set(['Solving baseline and pair-constrained reports…']);
                  baseline = solveCached(input, tau, family, []);
                },
                () => { forward = solveCached(input, tau, family, [[i, j]]); },
                () => { reverse = solveCached(input, tau, family, [[j, i]]); },
                ...(relaxed
                  ? [
                      () => { relaxedBaseline = solveCached(input, tau, relaxed.family, []); },
                      () => { relaxedForward = solveCached(input, tau, relaxed.family, [[i, j]]); },
                      () => { relaxedReverse = solveCached(input, tau, relaxed.family, [[j, i]]); },
                    ]
                  : []),
              ];

          let needCards = false;
          ctx.scheduleStages([
            ...solveSteps,
            () => {
              model = assembleModel(state, input, family, pair, {
                baseline,
                forward,
                reverse,
                relaxed,
                relaxedBaseline,
                relaxedForward,
                relaxedReverse,
              });
              const correction = {};
              if (state.report !== model.selected) correction.report = model.selected;
              for (const k of ['forward', 'reverse']) {
                const len = retainedGrades(model[k]).length;
                const sel = len ? Math.min(state[k], len - 1) : 0;
                if (state[k] !== sel) correction[k] = sel;
              }
              if (Object.keys(correction).length) {
                redirected = true;
                ctx.set(correction);
                return;
              }
              last = model;
              checks = criterionChecks(model);
              ctx.keepFocus(() => {
                control.render(state, model);
                ctx.readout.set(selectedPairSummary(ctx, model));
                ctx.setScope(buildScopeParts(ctx, model));
                view.renderPrimary(model, checks, cachedWidths);
              });
            },
            () => {
              if (redirected || !model || !checks) return;
              view.renderDataTablesStage1(model, checks);
            },
            () => {
              if (redirected || !model) return;
              view.renderDataTablesStage2(model);
              needCards = view.prepareCardsHeader(model);
            },
            ...input.cards.map((_, cardIdx) => () => {
              if (redirected || !model || !needCards) return;
              view.renderOneCard(model, cardIdx);
            }),
          ], { yieldMs: 0 });
        },
      };
    },
  });
}
