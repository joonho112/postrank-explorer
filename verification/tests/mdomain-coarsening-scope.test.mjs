// Author: JoonHo Lee (jlee296@ua.edu).
// A scope counterexample: positive disclosed-error thresholds need not survive coarsening.
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{mdomainInput,mdomainEvaluate}from'../../js/pr-core.js';
test('Coarsening can increase a positive-threshold joint event while the original-pair denominator stays fixed',()=>{
 const f=JSON.parse(readFileSync(new URL('../golden/v35/boundary-positive-coarsening.json',import.meta.url))),input=mdomainInput(f.input);
 const evaluate=id=>{const card=f.expected.fixedCards.find(c=>c.cardId===id);const result=mdomainEvaluate(input,card.evaluation.grades,f.decision);assert.deepEqual(result,card.evaluation);return result;};
 const fine=evaluate('p:1,2,3'),coarse=evaluate('p:1,1,2');
 assert.equal(fine.originalPairs,3);assert.equal(coarse.originalPairs,3);assert.equal(fine.domains[0].disclosedPairs,3);assert.equal(coarse.domains[0].disclosedPairs,2);
 assert.equal(fine.domains[0].expectedFalseProportionExact,'1/3');assert.equal(coarse.domains[0].expectedFalseProportionExact,'1/2');assert.equal(fine.jointProbabilityExact,'0');assert.equal(coarse.jointProbabilityExact,'1');assert.equal(fine.feasible,true);assert.equal(coarse.feasible,false);
});
