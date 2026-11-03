// Immutable adapters for the three released case inputs. No posterior is reconstructed here.
import CDE from '../../data/released/case-cde.json' with { type: 'json' };
import KRW from '../../data/released/case-krw.json' with { type: 'json' };
import ALABAMA from '../../data/released/case-alabama.json' with { type: 'json' };
export const CASE_KEYS = Object.freeze(['cde', 'krw', 'alabama']);
const sources = { cde: CDE, krw: KRW, alabama: ALABAMA };
const cache = new Map();
const clone = value => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) : value;
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
} return value; };
const metadata = {
    cde: { title: 'Twelve California schools', unit: 'school', units: 'schools', analysis: 'case_cde_12', id: 'cds_id', name: 'label', stems: [''], criterionLabels: ['Negative chronic-absence probability'], axes: ['Negative chronic-absence probability (proportion)'], grade1: 'Grade 1 = stated lowest in chronic absence, as the posterior judges it. Shared grades withhold comparisons, not assert equality.' },
    krw: { title: 'KRW’s 97 firms', unit: 'firm', units: 'firms', analysis: 'case_krw_signed97', id: 'id', name: 'firm_name', stems: ['_race', '_gender'], criterionLabels: ['White-name contact advantage', 'Male-name contact advantage'], axes: ['Log contact gap, white-named minus Black-named', 'Log contact gap, male-named minus female-named'], grade1: 'Grade 1 = stated highest on the positively weighted oriented contact-gap targets, as the posterior judges it. Shared grades withhold comparisons, not assert equality.' },
    alabama: { title: 'Alabama’s 67 counties', unit: 'county', units: 'counties', analysis: 'case_alabama67', id: 'fips', name: 'name', stems: ['_income', '_incarceration'], criterionLabels: ['Income rank', 'Negative incarceration probability'], axes: ['Conditional mean income rank (percentile points)', 'Negative conditional incarceration probability (percentage points)'], grade1: 'Grade 1 = stated highest on the weighted outcomes, as the posterior judges it: the most favorable historical outcomes, not a measure of need. Shared grades withhold comparisons, not assert equality.' }
};
/** Criterion-major marginals retain their supplied levels. source is a private frozen copy of the complete asset. */
export function caseInput(key = 'cde') {
    if (!CASE_KEYS.includes(key))
        throw new RangeError('Unknown case; choose cde, krw or alabama');
    if (cache.has(key))
        return cache.get(key);
    const source = clone(sources[key]), m = metadata[key], u = source.tables.units, E = source.arrays.error, a = source.analyses[m.analysis], ids = E.ids.slice(), n = ids.length, K = E.criteria.length;
    const inputIds = u[m.id], archiveIds = a?.tables?.units?.id;
    if (!Array.isArray(inputIds) || !Array.isArray(archiveIds) || inputIds.length !== n || archiveIds.length !== n || ids.some((id, i) => id !== inputIds[i] || id !== archiveIds[i]))
        throw new Error(`Released ${key} entity IDs do not match across input, summaries and archived report`);
    if (new Set(ids).size !== n || !E.e || E.e.length !== K || E.e.some(matrix => matrix.length !== n || matrix.some(row => row.length !== n)))
        throw new Error(`Released ${key} error array has inconsistent dimensions`);
    const mean = m.stems.map(stem => u['mean' + stem]), lower = m.stems.map(stem => u['lower' + stem]), upper = m.stems.map(stem => u['upper' + stem]);
    if ([...mean, ...lower, ...upper].some(values => !Array.isArray(values) || values.length !== n || values.some(v => !Number.isFinite(v))))
        throw new Error(`Released ${key} supplied marginal summaries do not match its firms`);
    const grade = a.tables.units.grade.slice();
    if (grade.length !== n || grade.some(g => !Number.isInteger(g) || g < 1))
        throw new Error(`Released ${key} archived grades are missing`);
    const sourceReports = { common: grade.slice() };
    for (const [name, values] of Object.entries(source.tables.reports ?? {}))
        if (Array.isArray(values) && values.length === n && values.every(g => Number.isInteger(g) && g > 0))
            sourceReports[name] = values.slice();
    const facts = a.facts, weights = E.criteria.map(c => facts.weights[c]);
    const result = { key, title: m.title, unit: m.unit, units: m.units, n, M: source.facts.M, K, ids, labels: u[m.name].slice(), E, criteria: E.criteria.slice(), criterionLabels: m.criterionLabels.slice(), axes: m.axes.slice(), grade1: m.grade1,
        marginals: { mean, lower, upper, level: source.facts.interval_level, intervalSource: 'supplied central posterior intervals' },
        conditioning: source.facts.conditioning, dependenceScope: source.facts.dependence_scope ?? (key === 'krw' ? 'Cross-criterion dependence is not supplied; additive expected loss does not require a joint criterion posterior.' : null), orientation: source.facts.orientation, targets: source.facts.targets ?? { [E.criteria[0]]: source.facts.target },
        notice: { licenseScope: source.license_scope, attribution: source.attribution, changes: source.change_notice, text: source.notice },
        archive: { id: m.analysis, grade, settings: { tau: facts.tau, G_max: facts.G_max, exact_G: facts.exact_G, q: facts.q, w: weights, weights: facts.weights, objective: facts.objective }, status: facts.status, lowerBound: facts.lower_bound, gap: facts.gap, boundSource: facts.bound_source, facts, source: a.source }, sourceReports, source };
    if (!Number.isInteger(result.M) || result.M !== n * (n - 1) / 2 || result.K !== result.marginals.mean.length)
        throw new Error(`Released ${key} count or criterion metadata do not match its arrays`);
    cache.set(key, freeze(result));
    return cache.get(key);
}
/** Plain supplied-marginal card for the actual 2.13 renderer; no normalCard/SD fitting. */
export function caseCard(input, k = 0, { expectedRank, title, storedOrder } = {}) {
    if (!Number.isInteger(k) || k < 0 || k >= input.K)
        throw new RangeError('A supplied marginal criterion is required');
    return { ids: input.ids, names: input.labels, fullNames: input.labels, mean: input.marginals.mean[k], lower: input.marginals.lower[k], upper: input.marginals.upper[k], level: input.marginals.level, intervalSource: input.marginals.intervalSource, expectedRank: expectedRank ?? null, storedOrder: storedOrder ?? (expectedRank ? 'expected_rank' : 'input'), axis: input.axes[k], grade1: input.grade1, unit: input.unit, units: input.units, title: title ?? `${input.title}: ${input.criterionLabels[k]}`, digits: 3 };
}
