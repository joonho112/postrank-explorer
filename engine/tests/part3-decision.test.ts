import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tierSizeDistribution,thresholdViolations,compareReportLosses,allocationValue,thresholdClassification,reportInformation,relationChange,enumerateReports,relations,drawErrors,evaluateReport,finiteLawPairwise} from '../src/index.ts';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-11,`${a} != ${b}`);

test('size distribution agrees with exhaustive small ordered compositions and balanced maximum',()=>{
 for(let n=2;n<=9;n++)for(let G=1;G<=n;G++){
  const counts=new Map<number,number>(),M=n*(n-1)/2;
  function visit(sizes:number[],left:number){if(sizes.length===G-1){if(left<1)return;const all=[...sizes,left];const N=M-all.reduce((s,v)=>s+v*(v-1)/2,0);counts.set(N,(counts.get(N)??0)+1);return;}for(let x=1;x<left;x++)visit([...sizes,x],left-x);}
  visit([],n);const r=tierSizeDistribution(n,G);assert.deepEqual(r.distribution.map(d=>[d.N,d.count]),Array.from(counts).sort((a,b)=>a[0]-b[0]));close(r.distribution.reduce((a,d)=>a+d.probability,0),1);
 }
 const r=tierSizeDistribution(30,4);assert.equal(r.maxN,337);assert.deepEqual(r.balancedSizes,[8,8,7,7]);assert.equal(tierSizeDistribution(30,3).distribution.find(d=>d.N===57)?.count,3);
 assert.throws(()=>tierSizeDistribution(31,2));assert.throws(()=>tierSizeDistribution(3,0));
});

test('all27 ternary threshold patterns match exactly the thirteen printable reports',()=>{
 const valid=new Set(Array.from(enumerateReports(3,{kind:'all'}),g=>{const r=relations(g);return [r[0][1],r[1][2],r[0][2]].join(',');}));
 assert.equal(valid.size,13);const category={twoWithheld:0,statedChain:0,directedCycle:0};let printable=0;
 for(const a of [-1,0,1])for(const b of [-1,0,1])for(const c of [-1,0,1]){
  const e=Array.from({length:3},()=>Array(3).fill(NaN));for(const[i,j,r]of [[0,1,a],[1,2,b],[0,2,c]]){e[i][j]=r===1?.1:r===-1?.9:.5;e[j][i]=1-e[i][j];}
  const E={ids:['A','B','C'],criteria:['x'],e:[e]},r=thresholdViolations(E,{tau:.2,details:true});
  assert.equal(r.printable,valid.has([a,b,c].join(',')));if(r.printable)printable++;else{assert.equal(r.invalidCount,1);category[r.violations![0].kind]++;assert.deepEqual(r.unitIncidence,[1,1,1]);}
  assert.equal(thresholdViolations(E,{tau:0}).statedCount,0);
 }
 assert.equal(printable,13);assert.deepEqual(category,{twoWithheld:6,statedChain:6,directedCycle:2});
 const E=finiteLawPairwise([[1,0]],[1]);assert.equal(thresholdViolations(E,{tau:.5}).statedCount,1);
});

test('paired total loss holds reports fixed and permits a finite mean opposite to its expected contrast',()=>{
 const draws=Array.from({length:10},(_,i)=>i<3?[20,4]:[0,4]);
 const r=compareReportLosses([1,1],[2,1],draws,{tau:.25});close(r.meanBest,.25);close(r.meanRule,.3);close(r.meanDelta,.05);close(r.ruleWinShare,.7);assert.equal(r.bestWins,3);assert.equal(r.ties,0);
 const one=compareReportLosses([1,1],[2,1],[[0,4]],{tau:.25});close(one.meanDelta,-.25);assert.equal(one.mcseDelta,null);
 for(let i=0;i<draws.length;i++)close(r.lossRule[i],evaluateReport([2,1],drawErrors([draws[i]]),{tau:.25}).risk);
 const same=compareReportLosses([1,1],[1,1],draws,{tau:.25});assert.equal(same.ties,10);close(same.mcseDelta!,0);
 assert.throws(()=>compareReportLosses([1,1],[1,2],[],{tau:.2}));
});

test('boundary allocation agrees with enumeration of complete size-budget subsets',()=>{
 const values=[6,4,3,-2],pTop=[.3,.8,.7,.2],g=[1,1,1,2],r=allocationValue(g,{values,pTop,budget:2});
 const sets=[[0,1],[0,2],[1,2]];close(r.expectedValue,sets.reduce((s,ix)=>s+ix.reduce((a,i)=>a+values[i],0),0)/3);close(r.expectedOverlap,sets.reduce((s,ix)=>s+ix.reduce((a,i)=>a+pTop[i],0),0)/3);close(r.selectedCount,2);assert.deepEqual(r.inclusion,[2/3,2/3,2/3,0]);
 const b0=allocationValue(g,{values,pTop:[0,0,0,0],budget:0});assert.equal(b0.overlapShare,null);assert.equal(b0.expectedValue,0);assert.equal(b0.boundaryGrade,null);
 const bn=allocationValue(g,{values,pTop:[1,1,1,1],budget:4});assert.equal(bn.expectedOverlap,4);assert.equal(bn.expectedValue,11);assert.deepEqual(bn.inclusion,[1,1,1,1]);
 assert.throws(()=>allocationValue([1,1,2],{values:[5,5,0],pTop:[1,1,0],budget:1}),/sum to budget/);
 const book=allocationValue([1,1],{values:[6,4],pTop:[.3,.7],budget:1});assert.equal(book.expectedValue,5);assert.equal(book.expectedOverlap,.5);
});

test('asymmetric classification reaches exhaustive action minimum, retaining none/all and cost ties',()=>{
 for(const probabilities of [[.3,1,0],[.5,.5],[0,1]])for(const[fp,fn]of [[1,1],[1,3],[0,2],[2,0]]){
  const r=thresholdClassification(probabilities,{falsePositiveCost:fp,falseNegativeCost:fn});let min=Infinity;
  for(let code=0;code<2**probabilities.length;code++){const pos=probabilities.map((_,i)=>Boolean(code&(1<<i)));const v=probabilities.reduce((s,p,i)=>s+(pos[i]?fp*(1-p):fn*p),0);min=Math.min(min,v);}
  close(r.totalCost,min);
 }
 const tied=thresholdClassification([.5],{falsePositiveCost:1,falseNegativeCost:1});assert.deepEqual(tied.positive,[true]);
 const all=thresholdClassification([.3,.7],{falsePositiveCost:1,falseNegativeCost:1,positive:[true,true]}),none=thresholdClassification([.3,.7],{falsePositiveCost:1,falseNegativeCost:1,positive:[false,false]});assert.equal(all.positiveCount,2);assert.equal(none.positiveCount,0);
 assert.equal(tied.selectedValue,null);
 for(const values of [[],[1,2],[NaN]])assert.throws(()=>thresholdClassification([.2],{falsePositiveCost:1,falseNegativeCost:1,values}));
 assert.throws(()=>thresholdClassification([.2],{falsePositiveCost:0,falseNegativeCost:0}));assert.throws(()=>thresholdClassification([.2],{falsePositiveCost:1,falseNegativeCost:1,positive:[2]}));
});

test('changed relation denominator is all pairs; KRW information uses the same report coefficients',()=>{
 const r=relationChange([1,1,2],[1,2,2]);assert.equal(r.changed,2);assert.equal(r.changeShare,2/3);assert.equal(relationChange([1,2,3],[3,2,1]).changeShare,1);assert.equal(relationChange([1,1],[1,1]).changeShare,0);
 const E=drawErrors([[1,0]]);assert.equal(reportInformation([1,2],E),1);assert.equal(reportInformation([2,1],E),-1);assert.equal(reportInformation([1,1],E),0);
});
