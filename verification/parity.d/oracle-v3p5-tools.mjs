// R49 was written independently before any Tools implementation was read.
// Actual values use the frozen public inputs and pre-existing pr-core calls.
import { readFileSync } from 'node:fs';
import { caseInput } from '../../js/shared/case-inputs.js';
const six = JSON.parse(readFileSync(new URL('../../data/released/six-sites.json', import.meta.url), 'utf8'));
const unnull = x => x === null ? NaN : Array.isArray(x) ? x.map(unnull) : x;
const shape = x => x === undefined || (typeof x === 'number' && Number.isNaN(x)) ? null
  : typeof x === 'bigint' ? String(x)
    : ArrayBuffer.isView(x) || Array.isArray(x) ? Array.from(x, shape)
      : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : x;
const caseErrors = new Map();
const sourceCase = key => {
  const input = caseInput(key);
  if (!caseErrors.has(key)) caseErrors.set(key, { ...input.E, e: unnull(input.E.e) });
  return { input, E: caseErrors.get(key) };
};
const rowMatrix = columns => Array.from({ length: columns[0].length }, (_, i) => columns.map(column => column[i]));
const family = cap => cap === 'all' ? { kind: 'all' } : { kind: 'atMost', G: cap };
function selected(E, args, method, order, pc) {
  const options = { tau: args.tau, w: args.w, tieTol: 1e-12, maxTies: args.maxTies ?? 100 };
  const result = method === 'enumeration' ? pc.exactOptimum(E, { ...options, family: family(args.cap) })
    : pc.fixedOrderDP(E, { ...options, ...order, G: args.cap === 'all' ? E.ids.length : args.cap });
  return { grade: result.grade, grades: result.grades, tieCount: result.tieCount, tieTol: result.tieTol,
    evaluation: pc.evaluateReport(result.grade, E, { tau: args.tau, w: args.w }), familySize: result.family.size,
    containsAllWithheld: result.containsAllWithheld, label: result.label };
}
function yourData(a, pc) {
  let E, posterior = null;
  if (a.example === 'six') {
    const source = six.arrays.two;
    // Declared probability-input decoding: supplied higher-priority entries
    // are pi=1-e, then explicitly decoded to e=1-pi. Keep the round trip.
    // Target reversal is matrix reindexing, as frozen in the input contract.
    const raw = unnull(source.e).map(matrix => matrix.map(row => row.map(value => a.event === 'higher_priority' ? 1 - (1 - value) : value)));
    E = { ids: source.ids, criteria: source.criteria, e: raw.map((matrix, k) => a.orient[k] < 0
      ? matrix.map((_, i) => matrix.map(row => row[i])) : matrix) };
  } else {
    let ids, criteria, mean, sd;
    if (a.example === 'equal5') {
      ids = ['A', 'B', 'C', 'D', 'E']; criteria = ['c1', 'c2', 'c3'];
      mean = Array.from({ length: 5 }, () => [0, 0, 0]); sd = Array.from({ length: 5 }, () => [1, 1, 1]);
    } else {
      if (!['league8', 'league30'].includes(a.example)) throw new Error('Unknown frozen T1 public example');
      const league = pc.league30(), draw = pc.drawLeague(20261030), n = a.example === 'league8' ? 8 : 30;
      ids = league.ids.slice(0, n); criteria = ['theta'];
      const p = pc.normalPosterior(draw.estimate.slice(0, n), league.se.slice(0, n), { priorMean: 0, priorSd: a.prior === 'flat' ? Infinity : .15 });
      mean = p.mean.map(value => [value]); sd = p.sd.map(value => [value]);
    }
    const intervalColumns = criteria.map((_, k) => pc.normalInterval(mean.map(row => row[k]), sd.map(row => row[k]), .9));
    posterior = { mean, sd, lower: rowMatrix(intervalColumns.map(x => x.lower)), upper: rowMatrix(intervalColumns.map(x => x.upper)) };
    E = pc.errorArray(mean, sd, { ids, criteria, orient: a.orient });
  }
  const size = pc.familySize(E.ids.length, family(a.cap));
  const preflight = { nAllowed: E.ids.length <= pc.ENUMERATION_BUDGET.maxUnits,
    countAllowed: size <= pc.ENUMERATION_BUDGET.maxReports, familySize: size };
  const method = preflight.nAllowed && preflight.countAllowed ? 'enumeration' : 'weighted-expected-rank-order';
  const expectedRank = pc.expectedRank(E, { w: a.w }), order = pc.scoreOrder(expectedRank, { direction: 'ascending', ids: E.ids });
  return { E, posterior, preflight, method, expectedRank, order: method === 'enumeration' ? null : order.order,
    blocks: method === 'enumeration' ? null : order.blocks, optimum: selected(E, a, method, order, pc) };
}
function reportDesigner(a, pc) {
  const { input, E } = sourceCase(a.case);
  const method = a.case === 'cde' ? a.cap <= 3 ? 'enumeration' : 'posterior-mean-order' : 'weighted-expected-rank-order';
  const order = a.case === 'cde' ? pc.scoreOrder(input.marginals.mean[0], { direction: 'descending', ids: E.ids })
    : pc.scoreOrder(pc.expectedRank(E, { w: a.w }), { direction: 'ascending', ids: E.ids });
  // Budgets assess this selected report; q is never passed to its producer.
  const optimum = selected(E, a, method, order, pc), grade = input.archive.grade;
  return { method, order: method === 'enumeration' ? null : order.order, blocks: method === 'enumeration' ? null : order.blocks,
    optimum, archive: { grade, evaluation: pc.evaluateReport(grade, E, { tau: a.tau, w: a.w }), sourceFacts: input.archive.facts },
    change: pc.relationChange(grade, optimum.grade, E, { w: a.w }), budget: pc.budgetCheck(optimum.grade, E, a.q).rows };
}
export default {
  group: 'oracle-v3p5-tools',
  functions: ['league30', 'drawLeague', 'normalPosterior', 'normalInterval', 'errorArray', 'familySize', 'expectedRank', 'scoreOrder',
    'exactOptimum', 'fixedOrderDP', 'evaluateReport', 'relationChange', 'budgetCheck'],
  default: { abs: 1e-12, rel: 1e-12 },
  // The large requested family count is exact, not a floating sum tolerance.
  tolerance: { preflight: { abs: 0, rel: 0 } },
  run(args, pc) {
    if (args.fn === 'toolYourData') return shape(yourData(args, pc));
    if (args.fn === 'toolReportDesigner') return shape(reportDesigner(args, pc));
    throw new Error(`Unknown R49 composition ${args.fn}`);
  },
};
