// Author: JoonHo Lee (jlee296@ua.edu).
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{exactCompare,exactDifference,selectEvaluatedSubset}from'../../js/shared/mdomain/compare.js';
import{mdomainExample,mdomainInput,mdomainFamily,mdomainSolve}from'../../js/pr-core.js';
test('Evaluated subsets retain distinctions lost in binary64 and preserve all exact ties',()=>{
 const lower='100000000000000000001/1000000000000000000000',higher='50000000000000000001/500000000000000000000';
 assert.equal(Number(lower.split('/')[0])/Number(lower.split('/')[1]),Number(higher.split('/')[0])/Number(higher.split('/')[1]));
 assert.equal(exactCompare(lower,higher),-1);assert.equal(exactDifference(higher,lower),'1/1000000000000000000000');
 const fit={candidateTable:[{candidateId:'first',riskExact:lower,feasible:true},{candidateId:'second',riskExact:higher,feasible:true},{candidateId:'third',riskExact:lower,feasible:true}]};
 const original=JSON.stringify(fit),result=selectEvaluatedSubset(fit,['third','second','first']);assert.deepEqual(result.optimizerIds,['first','third']);assert.equal(result.selectedId,'first');assert.equal(JSON.stringify(fit),original);
});
test('Subset scope cannot silently admit missing, repeated or policy-infeasible cards',()=>{
 const fit={candidateTable:[{candidateId:'yes',riskExact:'1/10',feasible:true},{candidateId:'no',riskExact:'1/20',feasible:false}]};
 for(const ids of [[],['yes','yes'],['unknown'],['no']])assert.throws(()=>selectEvaluatedSubset(fit,ids));
 assert.throws(()=>exactDifference('1/10','1/5'),RangeError);for(const bad of ['0/2','2/4','01','1/0','-1'])assert.throws(()=>exactCompare(bad,'0'));
});
const manifest=JSON.parse(readFileSync(new URL('../golden/v35/manifest.json',import.meta.url)));
for(const entry of manifest.fixtures.filter(f=>f.fixtureId.startsWith('common-')))test(`Common diagonal subset agrees with public R: ${entry.fixtureId}`,()=>{
 const f=JSON.parse(readFileSync(new URL(`../../${entry.path}`,import.meta.url)));const input=mdomainInput(f.input),fit=mdomainSolve(input,mdomainFamily(input,f.family),f.decision);
 const diagonal=fit.candidateTable.filter(row=>row.grades.values.every(v=>v.every(g=>g===v[0]))).map(row=>row.candidateId);
 const comparison=selectEvaluatedSubset(fit,diagonal,{comparisonId:f.expected.comparisons[0].comparisonId});assert.deepEqual(comparison,f.expected.comparisons[0]);assert.equal(exactCompare(fit.riskExact,comparison.riskExact)<=0,true);
});
