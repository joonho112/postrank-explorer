// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mdomainInput } from '../src/mdomain/input.ts';
import { mdomainEvaluate } from '../src/mdomain/evaluate.ts';
import { MdomainError } from '../src/mdomain/error.ts';
const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = read('verification/golden/v35/manifest.json');
for (const entry of manifest.fixtures) {
  test(`public R fixed-card oracle: ${entry.fixtureId}`, () => {
    const f = read(entry.path);
    const input = mdomainInput(f.input);
    const before = JSON.stringify(f);
    for (const fixed of f.expected.fixedCards) {
      assert.deepEqual(mdomainEvaluate(input, fixed.evaluation.grades, f.decision), fixed.evaluation, fixed.cardId);
    }
    assert.equal(JSON.stringify(f), before, 'Evaluation must not mutate its arguments');
  });
}
test('policy negative ledger uses typed fields and codes', () => {
  const ledger = read('verification/golden/v35/negative-cases.json');
  for (const item of ledger.cases.filter((x: { expectedBrowserCode: string }) => x.expectedBrowserCode === 'mdomainPolicyInvalid')) {
    const f = item.payload;
    const grades = { unitIds: f.input.unitIds, domainIds: f.input.domainIds, values: [[1, 1], [2, 2]] };
    assert.throws(() => mdomainEvaluate(mdomainInput(f.input), grades, f.decision),
      (e: unknown) => e instanceof MdomainError && e.code === item.expectedBrowserCode && e.field.startsWith('decision.'));
  }
});
test('all policy fields are explicit, including disabled guards', () => {
  const f = read(manifest.fixtures[0].path);
  const grades = f.expected.selectedEvaluation.grades;
  for (const key of ['q', 't', 'alpha', 'weights', 'tau']) {
    const decision = structuredClone(f.decision); delete decision[key];
    assert.throws(() => mdomainEvaluate(mdomainInput(f.input), grades, decision), MdomainError);
  }
});
test('valid bounded inputs retain an exact result wider than the input text cap', () => {
  const fixture = read(manifest.fixtures[0].path);
  const input = structuredClone(fixture.input);
  const a = 10n ** 120n + 1n; const b = a + 2n;
  input.domainIds = ['S'];
  input.stateIds = ['error-a', 'correct-a', 'error-b', 'correct-b'];
  input.states = [[[-1], [0]], [[1], [0]], [[-1], [0]], [[1], [0]]];
  input.masses = [`1/${2n*a}`, `${(a-1n)/2n}/${a}`, `1/${2n*b}`, `${(b-1n)/2n}/${b}`];
  input.targets = [{ ...input.targets[0], domainId: 'S' }];
  const policy = { decisionId: 'wide-result', domainIds: ['S'], scope: 'all_pairs' as const,
    weights: ['1'], tau: ['1/4'], q: null, t: null, alpha: '0' };
  const result = mdomainEvaluate(mdomainInput(input),
    { unitIds: input.unitIds, domainIds: ['S'], values: [[1], [2]] }, policy);
  assert.equal(result.riskExact, `${a+1n}/${a*b}`);
  assert.ok(result.riskExact.length > 256);
  assert.doesNotThrow(() => JSON.stringify(result));
});
