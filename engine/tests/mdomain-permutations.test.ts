// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mdomainInput } from '../src/mdomain/input.ts';
import { candidateKey, mdomainFamily } from '../src/mdomain/family.ts';
import { mdomainSolve } from '../src/mdomain/solve.ts';
import { mdomainEvaluate } from '../src/mdomain/evaluate.ts';
const root = path.resolve(import.meta.dirname, '../..');
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const base = read('verification/golden/v35/dependence-disjoint.json');
for (const mode of ['units','domains','both','states']) {
 test(`complete R parity in reordered problem: ${mode}`, () => {
  const f=read(`verification/golden/v35-permutations/permutation-${mode}.json`);
  const input=mdomainInput(f.input);const fit=mdomainSolve(input,mdomainFamily(input,f.family),f.decision);
  assert.deepEqual(fit,f.expected.fit);
  for(const row of f.expected.fixedCards) assert.deepEqual(mdomainEvaluate(input,row.evaluation.grades,f.decision),row.evaluation);
  const mapped=fit.candidateTable.filter(c=>c.optimal).map(c=>candidateKey({unitIds:base.input.unitIds,domainIds:base.input.domainIds,
    values:base.input.unitIds.map((id:string)=>base.input.domainIds.map((d:string)=>c.grades.values[c.grades.unitIds.indexOf(id)][c.grades.domainIds.indexOf(d)]))}));
  assert.deepEqual(new Set(mapped),new Set(base.expected.fit.optimizerIds));
  if(mode==='domains') {
   const g=fit.selectedGrades;
   const mappedSelected=candidateKey({unitIds:base.input.unitIds,domainIds:base.input.domainIds,
    values:base.input.unitIds.map((id:string)=>base.input.domainIds.map((d:string)=>g.values[g.unitIds.indexOf(id)][g.domainIds.indexOf(d)]))});
   assert.notEqual(mappedSelected,base.expected.fit.selectedId,'A canonical representative need not be permutation-equivariant');
  }
 });
}
