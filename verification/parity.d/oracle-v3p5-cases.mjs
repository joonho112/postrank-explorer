// Frozen independent R46 case fixtures. Actual scientific values come only
// from public pr-core calls; this file decodes, projects and groups displays.
import { readFileSync } from 'node:fs';

const released = key => JSON.parse(readFileSync(new URL(`../../data/released/${key}.json`, import.meta.url), 'utf8'));
const krw = released('case-krw'), grid = released('krw-lambda-grid'), folded = released('krw-absolute-gender');
const cde = released('case-cde'), archivePath = released('cde-taupath'), alabama = released('case-alabama');
const unnull = x => x === null ? NaN : Array.isArray(x) ? x.map(unnull) : x;
const error = source => ({ ...source, e: unnull(source.e) });
const EK = error(krw.arrays.error), EF = error(folded.arrays.error), EC = error(cde.arrays.error), EA = error(alabama.arrays.error);
const one = (E, k) => ({ ids: E.ids, criteria: [E.criteria[k]], e: [E.e[k]] });
const shape = x => x === undefined || (typeof x === 'number' && Number.isNaN(x)) ? null
  : typeof x === 'bigint' ? String(x)
    : ArrayBuffer.isView(x) || Array.isArray(x) ? Array.from(x, shape)
      : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : x;
const lex = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
const sameGrade = (a, b) => a.length === b.length && a.every((g, i) => g === b[i]);
const pick = (x, keys) => Object.fromEntries(keys.map(k => [k, x[k]]));
const evalKeys = ['tau', 'G_max', 'weights', 'risk', 'lower_bound', 'gap', 'status', 'bound_source'];
const cap3 = { kind: 'atMost', G: 3 };
const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

function krwRow(a, pc) {
  const k = a.criterion === 'race' ? 0 : a.criterion === 'gender' ? 1 : -1;
  if (k < 0 || !Number.isInteger(a.index) || a.index < 0 || a.index > 100) throw new Error('Invalid KRW source row');
  const E = one(EK, k), grade = grid.arrays[a.criterion].grade[a.index], lambda = grid.facts.lambda[a.index];
  const tau = lambda === 0 ? grid.facts.tau[a.index] : pc.lambdaToTau(lambda);
  return { E, grade, lambda, tau, k };
}
function orderDP(E, w, tau, cap, pc) {
  const expectedRank = pc.expectedRank(E, { w });
  const order = pc.scoreOrder(expectedRank, { direction: 'ascending', ids: E.ids });
  return { expectedRank, optimum: pc.fixedOrderDP(E, { ...order, tau, w, G: cap, tieTol: 1e-12, maxTies: 100 }) };
}
const cdeContext = pc => memo('cde-frontier', () => {
  const cloud = pc.reportCloud(EC, { family: cap3 });
  return { cloud, hull: pc.lowerHull(cloud), path: pc.tauPath(EC, { family: cap3 }) };
});
const cdeOrder = pc => memo('cde-mean-order', () => pc.scoreOrder(cde.tables.units.mean, { direction: 'descending', ids: EC.ids }));
const cdeOpt = (tau, pc) => pc.exactOptimum(EC, { tau, family: cap3 });
const gradeVertex = x => pick(x, ['N', 'Ew', 'grade']);

const RUN = {
  caseKrwGrid(a, pc) {
    const { E, grade, lambda, tau } = krwRow(a, pc), d = pc.disclosure(grade);
    // At the archived zero endpoint only invariant counts/shares are kept.
    const evaluation = pc.evaluateReport(grade, E, { tau: lambda === 0 ? krw.facts.card_tau : tau });
    if (lambda === 0) Object.assign(evaluation, { risk: null, errorTerm: null, withholdingTerm: null, Rk: null });
    return { lambda, tau, grade, sizes: d.sizes, evaluation, DR: pc.krwRisk(grade, E, { lambda: 0 }),
      information: pc.reportInformation(grade, E), thresholdCount: pc.thresholdViolations(E, { tau }).statedCount,
      confident: lambda === 0 ? null : pc.confidentPairs(grade, E, { tau }),
      statedAbove: lambda === 0 ? null : pc.statedAbove(grade, E, { tau }) };
  },
  caseKrwGridDetails(a, pc) {
    const { E, grade, tau, k } = krwRow(a, pc), counts = pc.unitRelationCounts(grade), between = pc.betweenGradeErrors(grade, E);
    const expectedRank = pc.expectedRank(E), mean = krw.tables.units[k === 0 ? 'mean_race' : 'mean_gender'];
    const summaries = { ids: E.ids, expectedRank, mean };
    const expectedRankRows = pc.reportCardRows(grade, summaries, 'expected_rank'), meanRows = pc.reportCardRows(grade, summaries, 'mean');
    // Row displacement is display-order infrastructure, not a posterior statistic.
    const shift = grade.map((_, i) => expectedRankRows.indexOf(i) - meanRows.indexOf(i)), maxAbsShift = Math.max(...shift.map(Math.abs));
    const gradeUnits = pc.disclosure(grade).sizes.map((size, j) => {
      const h = j + 1, units = grade.flatMap((g, i) => g === h ? [i] : []);
      return { grade: h, units, size, withinPairs: pc.pairCount(size),
        abovePairs: between.filter(b => b.h === h).reduce((sum, b) => sum + b.pairs, 0),
        belowPairs: between.filter(b => b.hp === h).reduce((sum, b) => sum + b.pairs, 0) };
    });
    return { aboveCounts: pc.thresholdViolations(E, { tau }).aboveCounts, unitCounts: counts, gradeUnits, between,
      expectedRank, expectedRankRows, meanRows, shift, maxAbsShift, movedCount: shift.filter(x => x !== 0).length,
      mostMoved: maxAbsShift === 0 ? [] : shift.flatMap((x, i) => Math.abs(x) === maxAbsShift ? [i] : []),
      previous: pc.relationChange(grid.arrays[a.criterion].grade[a.index - 1], grade, E) };
  },
  caseKrwFirstSplits(a, pc) {
    return Object.fromEntries(['race', 'gender'].map(criterion => {
      const index = grid.arrays[criterion].grade.findIndex(g => pc.disclosure(g).G > 1), grade = grid.arrays[criterion].grade[index];
      return [criterion, { index, lambda: grid.facts.lambda[index], grade, sizes: pc.disclosure(grade).sizes }];
    }));
  },
  caseKrwStatedHalf(a, pc) {
    const { E, grade } = krwRow(a, pc);
    return pc.statedAbove(grade, E, { tau: a.tauThreshold });
  },
  caseGenderTargets(a, pc) {
    const signed = orderDP(one(EK, 1), [1], a.tau, a.cap, pc), folded = orderDP(EF, [1], a.tau, a.cap, pc);
    return { signed, folded, change: pc.relationChange(signed.optimum.grade, folded.optimum.grade) };
  },
  caseKrwTwoTarget(a, pc) {
    const live = orderDP(EK, a.w, a.tau, a.cap, pc), archiveGrade = krw.analyses.case_krw_signed97.tables.units.grade;
    return { expectedRank: live.expectedRank, live: live.optimum, archiveGrade,
      archiveEvaluation: pc.evaluateReport(archiveGrade, EK, { tau: a.tau, w: a.w }), archiveAgreement: sameGrade(live.optimum.grade, archiveGrade),
      cards: Object.fromEntries(['race', 'gender'].map(criterion => {
        const grade = krw.tables.reports[`${criterion}_card`];
        return [criterion, { grade, evaluation: pc.evaluateReport(grade, EK, { tau: a.tau, w: a.w }) }];
      })), cardSelection: { lambda: krw.facts.card_lambda, tau: krw.facts.card_tau },
      archiveSource: pick(krw.analyses.case_krw_signed97.facts, evalKeys) };
  },
  caseKrwCrossings(a, pc) {
    return Object.fromEntries([['race', krw.tables.reports.race_card], ['gender', krw.tables.reports.gender_card],
      ['common', krw.analyses.case_krw_signed97.tables.units.grade]].map(([key, grade]) => [key, pc.weightCrossing(grade, EK, { tau: a.tau })]));
  },
  caseBridgePresets(a, pc) {
    if (a.data !== 'six-sites' || a.array !== 'one') throw new Error('Unknown R46 bridge input');
    return pc.krwCorrespondence(error(released(a.data).arrays[a.array]), { ...a.axis, tieFree: true });
  },
  caseCdeFrontier(a, pc) {
    const { cloud, hull, path } = cdeContext(pc), intervals = path.intervals;
    const endpointTaus = [...new Set(intervals.map(s => s.tauTo))].sort((x, y) => x - y);
    const endpoints = endpointTaus.map(tau => ({ tau, ...cdeOpt(tau, pc) }));
    const boundaryTaus = endpointTaus.filter(tau => tau > 0 && tau < .5);
    return { family: cloud.family, inputLabels: cde.tables.units.label, posteriorMeanOrder: cdeOrder(pc).order,
      cloud: cloud.byN.map(p => pick(p, ['N', 'minEw', 'maxEw', 'count'])), hull: hull.map(gradeVertex),
      matched: Array.from({ length: 49 }, (_, N) => {
        const m = pc.matchedDisclosure(cloud, hull, N);
        return { ...pick(m, ['N', 'H', 'best', 'psi']), lower: gradeVertex(m.lower), upper: gradeVertex(m.upper) };
      }), intervals, endpointOptima: endpoints,
      pathChanges: intervals.slice(1).map((s, i) => pc.relationChange(intervals[i].grade, s.grade, EC)),
      breakpointNeighbors: boundaryTaus.map(tau => [tau - 1e-10, tau, tau + 1e-10].map(t => ({ tau: t, ...cdeOpt(t, pc) }))) };
  },
  caseCdeN48(a, pc) {
    const count = cdeContext(pc).cloud.byN.find(row => row.N === a.N)?.count;
    if (!count) throw new Error('R46 complete-N row must be attained');
    const complete = pc.reportsAtN(EC, { N: a.N, family: a.family, k: count });
    const ranked = complete.reports, reports = ranked.slice().sort((x, y) => lex(x.grade, y.grade));
    // Explicit width-one display grouping of the complete public output.
    const from = Math.floor(ranked[0].Ew), to = Math.floor(ranked[ranked.length - 1].Ew), buckets = new Map();
    for (const report of ranked) { const key = Math.floor(report.Ew); buckets.set(key, (buckets.get(key) ?? 0) + 1); }
    const bins = Array.from({ length: to - from + 1 }, (_, i) => ({ from: from + i, to: from + i + 1, count: buckets.get(from + i) ?? 0 }));
    return { N: complete.N, count: complete.count, reports, bins, minEw: ranked[0].Ew, nextMinEw: ranked[1].Ew };
  },
  caseCdeChoice(a, pc) {
    const best = pc.bestReports(EC, { tau: a.tau, family: a.family, k: a.k });
    return { optimum: cdeOpt(a.tau, pc), matched: best.matched, reports: best.reports };
  },
  caseCdeConstraints(a, pc) {
    return Array.from({ length: EC.ids.length }, (_, i) => i).flatMap(i => EC.ids.flatMap((_, j) => {
      if (i === j) return [];
      const result = pc.pairConstrainedOptimum(EC, { tau: a.tau, family: a.family, stating: [[i, j]], maxTies: 600000 });
      return [{ stating: result.stating, matched: result.family.size, minimum: result.risk, ...result }];
    }));
  },
  caseCdeCutReports(a, pc) {
    const { order } = cdeOrder(pc), baseline = cdeOpt(a.tau, pc);
    return { order, reports: [[4, 8], [3, 9], [1, 2], [6], [11]].map(cuts => {
      const grade = pc.cutGrade(12, cuts, { order });
      return { cuts, grade, sizes: pc.disclosure(grade).sizes, evaluation: pc.evaluateReport(grade, EC, { tau: a.tau }),
        change: pc.relationChange(baseline.grade, grade, EC) };
    }) };
  },
  caseCdeOrderComparison(a, pc) {
    const orderOptimum = pc.fixedOrderDP(EC, { ...cdeOrder(pc), tau: a.tau, G: a.orderCap });
    const enumerableOptimum = cdeOpt(a.tau, pc);
    const comparison = pc.compareReports(enumerableOptimum.grade, orderOptimum.grade, EC, { tau: a.tau });
    // Frozen R46 AsIs grade inputs retain one-element wrappers on these two
    // relation-code fields. This is fixture projection only: the public API
    // still returns scalar codes. Preserve every public pair and value.
    return { orderOptimum, enumerableOptimum, comparison: { ...comparison, pairs: comparison.pairs.map(p => ({ ...p,
      beforeRelation: [p.beforeRelation], afterRelation: [p.afterRelation] })) } };
  },
  caseCdeArchivedPath(a, pc) {
    return archivePath.tables.path.tau.map((tau, index) => {
      const grade = archivePath.arrays.grades.grade[index];
      return { index, tau, grade, evaluation: pc.evaluateReport(grade, EC, { tau }),
        source: Object.fromEntries(['tau_source', 'lower_bound', 'gap', 'status', 'bound_source', 'result_label'].map(k => [k, archivePath.tables.path[k][index]])) };
    });
  },
  caseAlabamaLive(a, pc) {
    const live = orderDP(EA, a.w, a.tau, a.cap, pc), source = Object.entries(alabama.tables.reports).filter(([k]) => k !== 'fips');
    return { expectedRank: live.expectedRank, optimum: live.optimum,
      archiveAgreement: Object.fromEntries(source.map(([k, grade]) => [k, sameGrade(live.optimum.grade, grade)])),
      archiveEvaluations: Object.fromEntries(source.map(([k, grade]) => [k, { grade, evaluation: pc.evaluateReport(grade, EA, { tau: a.tau, w: a.w }) }])),
      changeFromP: pc.relationChange(alabama.tables.reports.P, live.optimum.grade, EA, { w: a.w }) };
  },
  caseAlabamaArchive(a, pc) {
    return { evaluations: Object.fromEntries(Object.entries(alabama.tables.reports).filter(([k]) => k !== 'fips')
      .map(([k, grade]) => [k, { grade, evaluation: pc.evaluateReport(grade, EA, { tau: a.tau, w: a.w }) }])),
    sourceCommonality: alabama.tables.commonality, sourceSingleCriterion: alabama.tables.single_criterion,
    sourceReferenceMetrics: alabama.tables.reference_metrics, intervalLevel: alabama.facts.interval_level,
    intervals: Object.fromEntries(Object.entries(alabama.tables.units).filter(([k]) => /^(mean|lower|upper)_/.test(k))) };
  },
};

export default {
  group: 'oracle-v3p5-cases',
  // Same tight sum/DP tolerance as the approved independent R35 case calls.
  default: { abs: 1e-12, rel: 1e-12 },
  functions: ['evaluateReport', 'fixedOrderDP', 'expectedRank', 'scoreOrder', 'reportCardRows', 'disclosure', 'unitRelationCounts',
    'betweenGradeErrors', 'thresholdViolations', 'confidentPairs', 'statedAbove', 'relationChange', 'krwCorrespondence', 'krwRisk',
    'reportInformation', 'weightCrossing', 'reportCloud', 'lowerHull', 'matchedDisclosure', 'tauPath', 'reportsAtN', 'bestReports',
    'exactOptimum', 'pairConstrainedOptimum', 'cutGrade', 'compareReports'],
  run(args, pc) {
    const fn = RUN[args.fn];
    if (!fn) throw new Error(`Unknown R46 composition ${args.fn}`);
    return shape(fn(args, pc));
  },
};
