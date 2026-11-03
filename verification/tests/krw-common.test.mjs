import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow } from '../dom-env.mjs';
import { createWidget } from '../../js/shared/base.js';
import { archiveSnapshot, readKrwModel, publishedCardMatches, riskDigits, createKrwCardView, createKrwRiskView, createKrwDenominatorView } from '../../js/apps/krw-common.js';
test('archived zero endpoint cannot expose the positive-tau surrogate as any risk term', () => {
    const model = readKrwModel('race'), zero = archiveSnapshot(model, 0);
    assert.equal(zero.ev.risk, null);
    assert.ok(zero.ev.Rk.every(v => v === null));
    assert.equal(zero.ev.errorTerm, null);
    assert.equal(zero.ev.withholdingTerm, null);
    assert.ok(Number.isFinite(zero.DR));
    assert.equal(zero.grade.length, model.ids.length);
    assert.equal(publishedCardMatches(model, archiveSnapshot(model, .25).grade), true);
    const one = archiveSnapshot(model, .01);
    assert.equal(riskDigits(one), 4);
    assert.ok(riskDigits(archiveSnapshot(model, .08)) > 4, 'near-baseline risk must not print as equal to all withheld');
});
test('full supplied card survives target, sort and reveal changes; one-grade view names no highest firms', () => {
    const m = makeWindow();
    let handle, cardSlot, riskSlot, denomSlot;
    try {
        handle = createWidget(m.el, {}, { name: 'krw-common-test', className: 'prx-kr prx-rc', keys: { criterion: { type: 'choice', values: ['race', 'gender'], value: 'race' }, lambda: { type: 'number', min: .01, max: 1, step: .01, value: .25 }, sort: { type: 'choice', values: ['mean', 'estimate', 'krw'], value: 'mean' }, reveal: { type: 'integer', min: 0, max: 97, value: 0 } }, build(ctx) { cardSlot = ctx.h('section'); riskSlot = ctx.h('section'); denomSlot = ctx.h('section'); ctx.charts.append(cardSlot, riskSlot, denomSlot); const card = createKrwCardView(ctx, cardSlot), risk = createKrwRiskView(ctx, riskSlot), denom = createKrwDenominatorView(ctx, denomSlot); return { render(s) { const model = readKrwModel(s.criterion), c = archiveSnapshot(model, s.lambda); card.render(model, c, s); risk.render(model, c); denom.render(model, c); } }; } });
        assert.equal(cardSlot.querySelectorAll('.prx-kbd-point').length > 0, true);
        assert.equal(cardSlot.querySelector('.prx-data-table tbody').children.length, 97);
        handle.update({ sort: 'estimate', reveal: 1 });
        assert.ok(cardSlot.querySelector('.prx-data-table tbody').children.length < 97);
        handle.update({ criterion: 'gender', reveal: 0, sort: 'krw' });
        assert.equal(cardSlot.querySelector('.prx-data-table tbody').children.length, 97);
        assert.match(cardSlot.textContent, /male-name contact advantage/);
        handle.update({ lambda: .01 });
        assert.match(cardSlot.querySelector('.kr-grade1').textContent, /One grade/);
        assert.doesNotMatch(cardSlot.querySelector('.kr-grade1').textContent, /AutoNation/);
        assert.match(denomSlot.textContent, /E\/N is NA: no disclosure/);
        assert.equal(denomSlot.querySelector('svg'), null);
    }
    finally {
        handle?.destroy();
        m.restore();
    }
});
