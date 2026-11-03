// Thin public-call composition for the separately generated independent R40 oracle.
// The producer never calls this adapter or reads JavaScript numerical results.
import {readFileSync} from 'node:fs';
const SIX=JSON.parse(readFileSync(new URL('../../data/released/six-sites.json',import.meta.url),'utf8'));
const raw=SIX.arrays.two,u=SIX.tables.units;
const sixE={ids:raw.ids,criteria:raw.criteria,e:raw.e.map(matrix=>matrix.map(row=>row.map(value=>value===null?NaN:value)))};
const sourceRows=raw.ids.map(id=>u.id.indexOf(id));
if(sourceRows.some(i=>i<0))throw new Error('Missing declared six-site unit');
const means=sourceRows.map(i=>[u.mean_A[i],u.mean_B[i]]),sds=sourceRows.map(i=>[u.sd_A[i],u.sd_B[i]]);
const LAWS={
 ch19:{ids:['A','B','C','D'],criteria:['criterion 1','criterion 2'],states:[[[4,4],[3,2],[2,3],[1,1]],[[3,1],[4,2],[2,3],[1,4]]],probs:[.75,.25]},
 known:{ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,-2],[0,0]]],probs:[1]},
};
const plainE=E=>({ids:E.ids,criteria:E.criteria,e:E.e});
const brief=result=>({grade:result.grade,grades:result.grades,tieCount:result.tieCount,risk:result.risk});
const lex=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
const union=(a,b)=>Array.from(new Map([...a,...b].map(grade=>{const g=Array.from(grade);return [g.join(','),g];})).values()).sort(lex);
const shape=value=>value===undefined?null:typeof value==='number'&&Number.isNaN(value)?null:ArrayBuffer.isView(value)?Array.from(value,shape):Array.isArray(value)?value.map(shape):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,shape(v)])):value;
function run(a,pc){
 if(a.fn!=='estimandDisplayPart4')throw new Error(`Unknown R40 function ${a.fn}`);
 let criterionE,compositeE,baselineE,compositeSummary=null;
 if(a.data==='six'){
  if(a.transform!=='identity')throw new Error('The declared Normal rows use the identity input');
  criterionE=baselineE=sixE;
  const c=pc.normalComposite(means,sds,{a:a.a,multiplier:a.multiplier,ids:raw.ids});
  compositeE=c.E;compositeSummary={mean:c.mean,sd:c.sd};
 }else{
  const law=LAWS[a.data];if(!law)throw new Error('Unknown declared finite law');
  if(!['identity','exp'].includes(a.transform))throw new Error('Unknown whole-state transformation');
  const states=a.transform==='exp'?law.states.map(state=>state.map(unit=>unit.map(value=>Math.exp(value)))):law.states;
  const labels={ids:law.ids,criteria:law.criteria};
  baselineE=pc.finiteLawPairwise(law.states,law.probs,labels);
  criterionE=pc.finiteLawPairwise(states,law.probs,labels);
  // Each engine-produced scalar c is repackaged as one criterion. No local
  // composite/error/probability/risk arithmetic is introduced here.
  const compositeStates=states.map(state=>pc.estimandCosts(state,{a:a.a,w:a.w,tau:a.tau,multiplier:a.multiplier}).c.map(value=>[value]));
  compositeE=pc.finiteLawPairwise(compositeStates,law.probs,{ids:law.ids,criteria:['composite']});
 }
 const options={tau:a.tau,w:a.w,family:a.family},criterion=pc.exactOptimum(criterionE,options),composite=pc.exactOptimum(compositeE,{tau:a.tau,w:[1],family:a.family});
 const evaluate=grade=>({grade,criterion:pc.evaluateReport(grade,criterionE,{tau:a.tau,w:a.w}),composite:pc.evaluateReport(grade,compositeE,{tau:a.tau,w:[1]})});
 const reports=union(criterion.grades,composite.grades).map(evaluate);
 const allReports=a.data==='six'?null:Array.from(pc.enumerateReports(criterionE.ids.length,a.family),grade=>Array.from(grade)).sort(lex).map(evaluate);
 return {criterionE:plainE(criterionE),compositeE:plainE(compositeE),criterionOptimum:brief(criterion),compositeOptimum:brief(composite),baselineCriterionOptimum:brief(pc.exactOptimum(baselineE,options)),reports,allReports,compositeSummary};
}
export default {group:'oracle-v3p4-estimands',default:{abs:1e-12,rel:1e-12},functions:['normalComposite','estimandCosts','finiteLawPairwise','exactOptimum','evaluateReport','enumerateReports'],run:(a,pc)=>shape(run(a,pc))};
