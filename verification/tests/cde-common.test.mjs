import { test } from 'node:test';
import assert from 'node:assert/strict';
import CDE from '../../data/released/case-cde.json' with { type: 'json' };
import { CDE_VIEWS, cutSet, mountCdeView, parseCuts, parsePair, readModel } from '../../js/apps/cde-common.js';

test('CDE model retains case-study letters, unit alignment and every released path report', () => {
  const model = readModel();
  assert.deepEqual(model.labels, CDE.tables.units.label);
  assert.deepEqual(model.order.map(i => model.labels[i]), ['A','C','B','F','E','D','H','G','I','K','L','J']);
  assert.deepEqual(model.cds, CDE.tables.units.cds_id);
  assert.deepEqual(model.mean, CDE.tables.units.mean);
  assert.equal(model.n, 12); assert.equal(model.M, 66);
  assert.equal(model.level, .9); assert.equal(model.statewide, 5834);
  assert.equal(new Set(model.cds).size, 12);
  for (let i = 0; i < model.n; ++i) {
    assert.equal(model.order[model.position[i]], i);
    assert.ok(Number.isNaN(model.E.e[0][i][i]));
    for (let j = 0; j < model.n; ++j) if (i !== j) assert.equal(model.E.e[0][i][j], CDE.arrays.error.e[0][i][j]);
  }
  assert.equal(model.path.grades.length, 13);
  assert.ok(model.path.grades.every(g => g.length === 12));
});

test('CDE cuts preserve input positions and source labels while split views stay bound to their app', () => {
  assert.deepEqual(parseCuts('9 | 3'), [9,3]);
  assert.deepEqual(parseCuts([-2, 15]), [1,11]);
  assert.deepEqual(cutSet(parseCuts('6,6')), [6]);
  assert.equal(parseCuts('3,bad'), undefined);
  assert.deepEqual(parsePair('f i'), ['F','I']);
  assert.deepEqual(parsePair(['f','f']), ['F','F']);
  assert.equal(parsePair('F,Z'), undefined);
  assert.equal(Object.keys(CDE_VIEWS).length, 4);
  assert.throws(() => mountCdeView(null, {}, { name:'cde-cuts', view:'pair' }), /matching CDE/);
});
