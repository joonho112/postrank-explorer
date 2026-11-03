// R43 expected values are independent base-R enumeration; this adapter calls the public engine.
import {readFileSync} from 'node:fs';
import {CERTAIN_OPPOSITION,CRITERION_MAJORITY} from '../../js/shared/criteria-laws.js';
const a=JSON.parse(readFileSync(new URL('../../data/released/six-sites.json',import.meta.url),'utf8')).arrays.two;
const SIX={...a,e:a.e.map(m=>m.map(r=>r.map(v=>v===null?NaN:v)))};
const shape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,shape):Array.isArray(x)?x.map(shape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shape(v)])):x;
const brief=r=>({grade:r.grade,grades:r.grades,tieCount:r.tieCount,risk:r.risk});
const lex=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
export default {group:'oracle-v3p4-mixture',default:{abs:1e-12,rel:1e-12},functions:['criterionMixtureRisk'],run:(a,pc)=>{
 const law=a.data==='opposition'?CERTAIN_OPPOSITION:CRITERION_MAJORITY,E=a.data==='six'?SIX:pc.finiteLawPairwise(law.states,law.probs,{ids:law.ids,criteria:law.criteria}),r=pc.exactOptimum(E,{tau:a.tau,w:a.w,family:a.family}),grades=a.data==='six'?r.grades:Array.from(pc.enumerateReports(2,a.family),g=>Array.from(g)).sort(lex);
 return shape({optimum:brief(r),reports:grades.map(grade=>{const mixture=pc.criterionMixtureRisk(grade,E,{tau:a.tau,w:a.w});return {grade,evaluation:pc.evaluateReport(grade,E,{tau:a.tau,w:a.w}),mixture,contributions:mixture.w.map((w,k)=>w*mixture.Rk[k])};})});
}};
