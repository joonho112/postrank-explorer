// R39 independently reproduces the fixed-S Gaussian experiment and settings comparisons.
import {readFileSync} from 'node:fs';
import {bookBudgetInput} from '../../js/shared/criteria-laws.js';
const SIX=JSON.parse(readFileSync(new URL('../../data/released/six-sites.json',import.meta.url),'utf8'));
const a=SIX.arrays.two,u=SIX.tables.units,ids=u.id,criteria=a.criteria;
const means=ids.map((_,i)=>[u.mean_A[i],u.mean_B[i]]),sds=ids.map((_,i)=>[u.sd_A[i],u.sd_B[i]]);
const E={ids:a.ids,criteria,e:a.e.map(m=>m.map(r=>r.map(v=>v===null?NaN:v)))};
const shape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,shape):Array.isArray(x)?x.map(shape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shape(v)])):x;
const projection=r=>({...r,family:{size:r.family.size}});
function run(a,pc){switch(a.fn){
 case 'iidProtectionPart4':{
  const raw=pc.drawErrors(pc.gaussianDraws(means,sds,a.S,a.seed),{ids,criteria}),Ehat={ids:raw.ids,criteria:raw.criteria,e:raw.e},Eexact=pc.errorArray(means,sds,{ids,criteria}),epsilon=criteria.map(()=>pc.envelopeRadius(pc.pairCount(ids.length),a.S,a.alpha/criteria.length,'package'));
  return {Ehat,Eexact,epsilon,S:a.S,seed:a.seed,alpha:a.alpha,envelopes:projection(pc.protectionEnvelopes(Ehat,Eexact,{q:a.q,epsilon,tau:a.tau,w:a.w,family:a.family,feasibilityTol:0,coefficientTol:1e-12}))};
 }
 case 'bookProtectionPart4':{const b=bookBudgetInput(a.t);return projection(pc.protectionEnvelopes(b.Ehat,b.Eexact,{q:b.q,epsilon:a.epsilon,tau:b.tau,w:[1],family:a.family,feasibilityTol:0,coefficientTol:1e-12}));}
 case 'settingsGridPart4':{
  const rows=[];
  a.taus.forEach((tau,ti)=>a.caps.forEach((cap,ci)=>a.weights.forEach((w,wi)=>{const r=pc.exactOptimum(E,{tau,w,family:{kind:'atMost',G:cap}});rows.push({id:`tau${ti+1}-cap${ci+1}-w${wi+1}`,tau,cap,w,grade:r.grade,grades:r.grades,tieCount:r.tieCount,evaluation:pc.evaluateReport(r.grade,E,{tau,w})});})));
  const ref=rows.find(r=>r.id===a.referenceId);if(!ref)throw new Error('Unknown declared grid reference');
  return {reference:{id:ref.id,grade:ref.grade,tau:ref.tau,cap:ref.cap,w:ref.w},rows:rows.map(r=>({...r,comparison:pc.compareReports(ref.grade,r.grade,E,{tau:r.tau,w:r.w})}))};
 }
 default:throw new Error(`Unknown R39 function ${a.fn}`);
}}
export default {group:'oracle-v3p4-settings-protections',default:{abs:1e-12,rel:1e-12},functions:['gaussianDraws','envelopeRadius','protectionEnvelopes'],run:(a,pc)=>shape(run(a,pc))};
