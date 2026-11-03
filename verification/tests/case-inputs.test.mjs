import { test } from 'node:test';
import assert from 'node:assert/strict';
import CDE from '../../data/released/case-cde.json' with { type: 'json' };
import KRW from '../../data/released/case-krw.json' with { type: 'json' };
import AL from '../../data/released/case-alabama.json' with { type: 'json' };
import { CASE_KEYS, caseInput, caseCard } from '../../js/shared/case-inputs.js';
const sources = { cde: CDE, krw: KRW, alabama: AL };
test('case adapters preserve every released ID, coefficient, source marginal and archive qualification', () => {
    for (const key of CASE_KEYS) {
        const d = caseInput(key), s = sources[key], a = s.analyses[d.archive.id];
        assert.deepEqual(d.E, s.arrays.error);
        assert.deepEqual(d.ids, s.arrays.error.ids);
        assert.equal(d.labels.length, d.n);
        assert.deepEqual(d.archive.grade, a.tables.units.grade);
        assert.deepEqual(d.archive.facts, a.facts);
        assert.deepEqual(d.archive.source, a.source);
        assert.equal(d.marginals.level, s.facts.interval_level);
        assert.equal(d.conditioning, s.facts.conditioning);
        assert.equal(d.archive.lowerBound, a.facts.lower_bound);
        assert.equal(d.archive.gap, a.facts.gap);
        for (let k = 0; k < d.K; k++) {
            const card = caseCard(d, k);
            assert.equal(card.mean, d.marginals.mean[k]);
            assert.equal(card.lower, d.marginals.lower[k]);
            assert.equal(card.upper, d.marginals.upper[k]);
            assert.equal(card.level, s.facts.interval_level);
            assert.equal(card.sd, undefined);
        }
    }
    assert.deepEqual(Object.keys(caseInput('krw').sourceReports), ['common', 'race_card', 'gender_card']);
    for (const name of ['B0', 'B1', 'B2', 'B3', 'P', 'D1', 'D2'])
        assert.deepEqual(caseInput('alabama').sourceReports[name], AL.tables.reports[name]);
});
test('returned case objects are deeply immutable without freezing shared JSON imports or changing cached identity', () => {
    const d = caseInput('krw');
    assert.equal(caseInput('krw'), d);
    assert.ok(Object.isFrozen(d.E.e[0][0]));
    assert.ok(Object.isFrozen(d.archive.settings));
    const first = KRW.arrays.error.e[0][0][1];
    assert.throws(() => { d.E.e[0][0][1] = .5; }, TypeError);
    assert.equal(KRW.arrays.error.e[0][0][1], first);
    assert.equal(Object.isFrozen(KRW), false);
    assert.throws(() => { d.sourceReports.race_card.push(1); }, TypeError);
    assert.throws(() => caseInput('unknown'), RangeError);
    assert.throws(() => caseCard(d, 2), RangeError);
});
