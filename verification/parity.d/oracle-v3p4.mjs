// R35 independently computes Part4 outputs. This adapter maps public engine calls and declared input layouts.
import {readFileSync} from 'node:fs';
const krw=JSON.parse(readFileSync(new URL('../../data/released/case-krw.json',import.meta.url),'utf8'));
const toy=JSON.parse(readFileSync(new URL('../../data/released/toy-joint-draws.json',import.meta.url),'utf8'));
const unnull=x=>Array.isArray(x)?x.map(unnull):x===null?NaN:x;
// Undefined probability diagonals are JSON null in R fixtures, as in the legacy pairwise adapter.
const jsonShape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,jsonShape):Array.isArray(x)?x.map(jsonShape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,jsonShape(v)])):x;
const error=E=>({...E,e:unnull(E.e)});
const sourceE=a=>{
 if(a.data!=='krw')return error(a.E);
 const names=a.criterion==='both'?['race_signed','gender_signed']:[`${a.criterion}_signed`],all=krw.arrays.error;
 return {ids:all.ids,criteria:names,e:names.map(name=>unnull(all.e[all.criteria.indexOf(name)]))};
};
const optimum=r=>({grade:r.grade,grades:r.grades,tieCount:r.tieCount,risk:r.risk});
function run(a,pc){switch(a.fn){
 case 'normalComposite':return pc.normalComposite(a.means,a.sds,a.options);
 case 'compareReports':return pc.compareReports(a.g0,a.g1,error(a.E),a.options);
 case 'pairDecisionPart4':return pc.pairDecision(a.eIJ,a.eJI,a.tau);
 case 'commonalityPart4':{
  const r=pc.commonalityCost(error(a.E),a.options);
  return {common:optimum(r.common),criteria:r.criteria.map(({ownGrade,ownGrades,ownTieCount,ownRk,delta,relationAgreement})=>({ownGrade,ownGrades,ownTieCount,ownRk,delta,relationAgreement})),commonReports:r.commonReports};
 }
 case 'weightMaximumPart4':{const r=pc.weightBreakpoints(error(a.E),a.options);return r.empty?{empty:true}:{empty:false,envelopeMaximum:r.envelopeMaximum};}
 case 'pairConstrainedOptimum':{
  const r=pc.pairConstrainedOptimum(sourceE(a),a.options),out={empty:r.empty};
  for(const k of ['grade','grades','gradesOrder','tieCount','risk','N','G','Ew','E','EoverN','evaluation','order','blocks','cuts','blockCuts','saving'])if(k in r)out[k]=r[k];
  return {...out,familySize:r.family.size,baseSize:r.family.baseSize,baseFamilySize:r.baseFamily.size,stating:r.stating,containsAllWithheld:r.containsAllWithheld,...(!r.empty?{tieTol:r.tieTol}:{}),label:r.label,
   familyNamePreserved:r.family.name===(r.stating.length?`𝒜_S (${r.baseFamily.name})`:r.baseFamily.name),familyWordsPreserved:r.family.words===(r.stating.length?r.baseFamily.words+' satisfying the stated pair directions':r.baseFamily.words)};
 }
 case 'protectionEnvelopes':{const r=pc.protectionEnvelopes(error(a.Ehat),error(a.Eexact),a.options);return {...r,family:{size:r.family.size}};}
 case 'finiteCompositePart4':{
  const compositeStates=a.states.map(state=>pc.estimandCosts(state,{a:a.a,w:a.w,tau:a.tau,...(a.multiplier?{multiplier:a.multiplier}:{})}).c.map(v=>[v]));
  const criterionE=pc.finiteLawPairwise(a.states,a.probs,{criteria:a.states[0][0].map((_,k)=>`c${k+1}`)}),compositeE=pc.finiteLawPairwise(compositeStates,a.probs,{criteria:['composite']}),c=pc.exactOptimum(criterionE,{tau:a.tau,w:a.w,family:a.family}),m=pc.exactOptimum(compositeE,{tau:a.tau,family:a.family});
  return {compositeStates,criterionE,compositeE,criterionOptimum:optimum(c),compositeOptimum:optimum(m),reports:[c.grade,m.grade].map(grade=>({grade,criterion:pc.evaluateReport(grade,criterionE,{tau:a.tau,w:a.w}),composite:pc.evaluateReport(grade,compositeE,{tau:a.tau,w:[1]}),wrong:pc.wrongCountDistribution(grade,a.states,a.probs,{w:a.w})}))};
 }
 case 'toyDrawsPart4':{
  const {values,ids,criteria}=toy.arrays.joint,S=values.length;
  // Declared whole-unit K-vector reindexing; no numerical statistic is computed here.
  const draws=values.map((state,s)=>state.map((row,i)=>a.allUnits||i===a.unit?values[(s+a.shift)%S][i]:row)).slice(0,a.prefix),E=pc.drawErrors(draws,{ids,criteria});
  return {E,counts:E.counts};
 }
 case 'settingsLatticePart4':{
  const E=error(a.E),rows=[];let previous=null;
  a.taus.forEach((tau,ti)=>a.caps.forEach((cap,ci)=>a.weights.forEach((w,wi)=>{
   const o=pc.exactOptimum(E,{tau,w,family:{kind:'atMost',G:cap}}),grade=o.grade;
   rows.push({id:`tau${ti+1}-cap${ci+1}-w${wi+1}`,tau,cap,w,grade,grades:o.grades,tieCount:o.tieCount,evaluation:pc.evaluateReport(grade,E,{tau,w}),change:previous?pc.relationChange(previous,grade,E,{w}):null});previous=grade;
  })));return {rows};
 }
 case 'jointWrongCountsPart4':return {rows:Array.from(pc.enumerateReports(a.states[0].length,a.family),g=>Array.from(g)).sort((x,y)=>{for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;}).map(grade=>({grade,distribution:pc.wrongCountDistribution(grade,a.states,a.probs,{w:a.w})}))};
 default:throw new Error(`Unknown R35 function ${a.fn}`);
}}
export default {group:'oracle-v3p4',default:{abs:1e-12,rel:1e-12},functions:['normalComposite','compareReports','pairConstrainedOptimum','protectionEnvelopes'],run:(a,pc)=>{
 if(a.fn.endsWith('Throws')){try{run({...a,fn:a.fn.slice(0,-6)},pc);return {threw:false};}catch{return {threw:true};}}
 return jsonShape(run(a,pc));
}};
