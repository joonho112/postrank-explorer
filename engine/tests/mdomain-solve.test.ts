// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mdomainInput } from '../src/mdomain/input.ts';
import { mdomainFamily } from '../src/mdomain/family.ts';
import { mdomainSolve } from '../src/mdomain/solve.ts';
import { mdomainExample } from '../src/mdomain/examples.ts';
import { cmp, parseExact } from '../src/mdomain/rational.ts';
const root = path.resolve(import.meta.dirname, '../..');
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const manifest = read('verification/golden/v35/manifest.json');
for (const entry of manifest.fixtures) {
  test(`complete public R product fit: ${entry.fixtureId}`, () => {
    const f = read(entry.path);
    const input = mdomainInput(f.input); const family = mdomainFamily(input, f.family);
    const before = JSON.stringify({ input, family, policy: f.decision });
    assert.deepEqual(mdomainSolve(input, family, f.decision), f.expected.fit);
    assert.equal(JSON.stringify({ input, family, policy: f.decision }), before);
  });
}
test('budget relaxation lowers minimum risk without imposing monotone domain grade counts', () => {
  let previous = parseExact('1');
  const counts: number[][] = [];
  for (let budgetIndex = 0; budgetIndex <= 6; budgetIndex += 1) {
    const f = mdomainExample('resolution', { noiseIndex: 1, budgetIndex });
    const input = mdomainInput(f.input);
    const fit = mdomainSolve(input, mdomainFamily(input, f.family), f.decision);
    const risk = parseExact(fit.riskExact);
    assert.ok(cmp(risk, previous) <= 0); previous = risk;
    counts.push(fit.candidateTable.find(row => row.selected)!.gradeCounts);
  }
  assert.deepEqual(counts[3], [2, 1]); assert.deepEqual(counts[5], [1, 2]);
});
test('solver compares full internal fractions when result text exceeds the input parser budget', () => {
  const template=read(manifest.fixtures[0].path).input;
  const a=10n**120n+1n;const b=a+2n;
  const input=mdomainInput({...template,domainIds:['S'],stateIds:['ea','ca','eb','cb'],
    states:[[[-1],[0]],[[1],[0]],[[-1],[0]],[[1],[0]]],
    masses:[`1/${2n*a}`,`${(a-1n)/2n}/${a}`,`1/${2n*b}`,`${(b-1n)/2n}/${b}`],
    targets:[{...template.targets[0],domainId:'S'}]});
  const family=mdomainFamily(input,{familyId:'wide-fraction-bank',unitIds:input.unitIds,domainIds:['S'],
    maxGrades:[2],maxActions:3,banks:[{domainId:'S',columns:[{columnId:'above',grades:[1,2]},{columnId:'below',grades:[2,1]}]}]});
  const fit=mdomainSolve(input,family,{decisionId:'wide-fraction',domainIds:['S'],scope:'all_pairs',
    weights:['1'],tau:['1/4'],q:null,t:null,alpha:'0'});
  assert.equal(fit.riskExact,`${a+1n}/${a*b}`);
  assert.ok(fit.riskExact.length>256);
  assert.deepEqual(fit.optimizerIds,['p:1,2']);
});
