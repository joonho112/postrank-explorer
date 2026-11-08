// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mdomainInput } from '../src/mdomain/input.ts';
import { mdomainFamily } from '../src/mdomain/family.ts';
import { mdomainSolve } from '../src/mdomain/solve.ts';
import { mdomainEvaluate } from '../src/mdomain/evaluate.ts';
const root=path.resolve(import.meta.dirname,'../..');
for(const name of ['tiny-cap-below','tiny-cap-above','tiny-weight-difference']) {
 test(`exact public R decision below floating tolerance: ${name}`,()=>{
  const f=JSON.parse(fs.readFileSync(path.join(root,`verification/golden/v35-precision/precision-${name}.json`),'utf8'));
  const input=mdomainInput(f.input);const fit=mdomainSolve(input,mdomainFamily(input,f.family),f.decision);
  assert.deepEqual(fit,f.expected.fit);
  for(const fixed of f.expected.fixedCards) assert.deepEqual(mdomainEvaluate(input,fixed.evaluation.grades,f.decision),fixed.evaluation);
  if(name==='tiny-cap-below') assert.equal(fit.optimizerIds.length,2);
  if(name==='tiny-cap-above') assert.deepEqual(fit.optimizerIds,['p:1,2|1,2']);
  if(name==='tiny-weight-difference') assert.deepEqual(fit.optimizerIds,['p:1,2|1,1']);
 });
}
