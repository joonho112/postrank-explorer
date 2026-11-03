// Fixed-report joint diagnostics from independent R41, mapped to public core calls.
import {readFileSync} from 'node:fs';
import {CHAPTER19,couplingLaw} from '../../js/shared/criteria-laws.js';
const raw=JSON.parse(readFileSync(new URL('../../data/released/six-sites.json',import.meta.url),'utf8')).arrays.two;
const SIX={...raw,e:raw.e.map(m=>m.map(r=>r.map(v=>v===null?NaN:v)))};
const shape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,shape):Array.isArray(x)?x.map(shape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shape(v)])):x;
const brief=r=>({grade:r.grade,grades:r.grades,tieCount:r.tieCount,risk:r.risk});
const lex=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function stateRows(g,law,w,pc){return law.states.map((state,s)=>{const r=pc.realizedWrong(g,state,{w});return {prob:law.probs[s],N:r.N,D:r.D};});}
// Approved reporting estimand: complement the expected weighted wrong fraction of a FIXED report, N>0.
function correct(g,E,w,tau,pc){const weighted={ids:E.ids,criteria:['weighted'],e:[pc.weightedError(E,w)]},ev=pc.evaluateReport(g,weighted,{tau,w:[1]});return ev.N>0?1-ev.EoverN[0]:null;}
function run(a,pc){switch(a.fn){
 case 'couplingAllPart4':{
  const law=couplingLaw(a.lambda),criterionE=pc.finiteLawPairwise(law.states,law.probs,{ids:law.ids,criteria:law.criteria}),states=law.states.map(state=>pc.estimandCosts(state,{a:[.5,.5],w:a.w,tau:a.tau}).c.map(c=>[c])),compositeE=pc.finiteLawPairwise(states,law.probs,{ids:law.ids,criteria:['composite']}),family={kind:'all'};
  return {criterionE,compositeE,criterionOptimum:brief(pc.exactOptimum(criterionE,{tau:a.tau,w:a.w,family})),compositeOptimum:brief(pc.exactOptimum(compositeE,{tau:a.tau,family})),reports:Array.from(pc.enumerateReports(2,family),g=>Array.from(g)).sort(lex).map(grade=>({grade,criterion:pc.evaluateReport(grade,criterionE,{tau:a.tau,w:a.w}),composite:pc.evaluateReport(grade,compositeE,{tau:a.tau,w:[1]}),wrong:pc.wrongCountDistribution(grade,law.states,law.probs,{w:a.w}),states:stateRows(grade,law,a.w,pc),meanCorrectFraction:correct(grade,criterionE,a.w,a.tau,pc)}))};
 }
 case 'lawWrongDisplayPart4':{const law=CHAPTER19,criterionE=pc.finiteLawPairwise(law.states,law.probs,{ids:law.ids,criteria:law.criteria});return {criterionE,evaluation:pc.evaluateReport(a.grade,criterionE,{tau:a.tau,w:a.w}),wrong:pc.wrongCountDistribution(a.grade,law.states,law.probs,{w:a.w}),states:stateRows(a.grade,law,a.w,pc),meanCorrectFraction:correct(a.grade,criterionE,a.w,a.tau,pc)};}
 case 'settingsPointPart4':{const r=pc.exactOptimum(SIX,{tau:a.tau,w:a.w,family:a.family});return {optimum:brief(r),profiles:r.grades.map(grade=>({grade,evaluation:pc.evaluateReport(grade,SIX,{tau:a.tau,w:a.w})}))};}
 default:throw new Error(`Unknown R41 function ${a.fn}`);
}}
export default {group:'oracle-v3p4-joint-accuracy',default:{abs:1e-12,rel:1e-12},functions:['realizedWrong','wrongCountDistribution','weightedError'],run:(a,pc)=>shape(run(a,pc))};
