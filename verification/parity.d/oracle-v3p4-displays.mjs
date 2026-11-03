// R38 independently counts whole states and enumerates risk profiles; thin public-API projection only.
import {readFileSync} from 'node:fs';
import {CHAPTER19,ROBUST_PAIR,CERTAIN_OPPOSITION,UNCERTAIN_AGREEMENT} from '../../js/shared/criteria-laws.js';
const read=name=>JSON.parse(readFileSync(new URL(`../../data/released/${name}.json`,import.meta.url),'utf8'));
const SIX=read('six-sites'),THIRTY=read('thirty-sites'),TOY=read('toy-joint-draws').arrays.joint;
const shape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,shape):Array.isArray(x)?x.map(shape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shape(v)])):x;
const finite={ch19:CHAPTER19,book:ROBUST_PAIR,opposition:CERTAIN_OPPOSITION,uncertain:UNCERTAIN_AGREEMENT,ties:{ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,-1],[0,0]],[[-1,1],[0,0]],[[0,0],[0,0]]],probs:[.4,.1,.5]}};
function input(data,pc){
 if(finite[data]){const law=finite[data];return {E:pc.finiteLawPairwise(law.states,law.probs,{ids:law.ids,criteria:law.criteria}),law};}
 const raw=data==='six'?SIX:THIRTY,a=raw.arrays[data==='six'?'two':'gaussian'];return {E:{ids:a.ids,criteria:a.criteria,e:a.e.map(m=>m.map(r=>r.map(v=>v===null?NaN:v)))},law:null};
}
function run(a,pc){switch(a.fn){
 case 'toyDisplayPart4':{
  const {values,ids,criteria}=TOY,S=values.length;
  const draws=values.map((st,s)=>st.map((row,i)=>a.allUnits||i===a.unit?values[(s+a.shift)%S][i]:row));
  const prefixes=draws.map((_,s)=>{const E=pc.drawErrors(draws.slice(0,s+1),{ids,criteria});return {prefix:s+1,E,counts:E.counts};});
  const state=draws[a.draw],E=pc.drawErrors([state],{ids,criteria});
  return {original:{ids,criteria,values},input:{draws:draws.slice(0,a.prefix),ids,criteria},prefixes,selected:{draw:a.draw,state,orders:criteria.map((_,k)=>pc.scoreOrder(state.map(row=>row[k]),{ids})),E,counts:E.counts}};
 }
 case 'guardedDisplayPart4':{
  const {E}=input(a.data,pc),r=pc.minimaxChoice(E,{tau:a.tau,w:a.w,family:a.family});
  return {weighted:r.weighted,minimax:r.minimax,included:r.included,familySize:r.family.size,containsAllWithheld:r.containsAllWithheld,tieTol:r.tieTol,weightedProfiles:r.weighted.grades.map(grade=>({grade,evaluation:pc.evaluateReport(grade,E,{tau:a.tau,w:a.w})})),guardedProfiles:r.minimax.grades.map(grade=>({grade,evaluation:pc.evaluateReport(grade,E,{tau:a.tau,w:a.w})})),comparisons:r.minimax.grades.map(grade=>pc.compareReports(r.weighted.grade,grade,E,{tau:a.tau,w:a.w}))};
 }
 case 'pairCostDisplayPart4':{
  const {E,law}=input(a.data,pc),[i,j]=a.pair,m=pc.weightedError(E,a.w),eIJ=m[i][j],eJI=m[j][i];
  return {E,criteria:E.criteria.map((_,k)=>({k,eIJ:E.e[k][i][j],eJI:E.e[k][j][i],decision:pc.pairDecision(E.e[k][i][j],E.e[k][j][i],a.tau)})),weighted:{eIJ,eJI,decision:pc.pairDecision(eIJ,eJI,a.tau)},conflicts:pc.conflictPairs(E),states:law?law.states.map((state,s)=>({prob:law.probs[s],decision:pc.estimandCosts(state,{a:E.criteria.map(()=>0),w:a.w,tau:a.tau,pair:a.pair}).criterionLoss})):null};
 }
 default:throw new Error(`Unknown R38 function ${a.fn}`);
}}
export default {group:'oracle-v3p4-displays',default:{abs:1e-12,rel:1e-12},functions:['drawErrors','minimaxChoice','pairDecision','compareReports'],run:(a,pc)=>shape(run(a,pc))};
