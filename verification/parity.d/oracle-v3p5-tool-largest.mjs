// R50 is frozen independently. Reuse the closed public-API selection adapter, then call the public largest-error helper.
import tools from './oracle-v3p5-tools.mjs';
import {caseInput} from '../../js/shared/case-inputs.js';
const unnull = x=>x===null?NaN:Array.isArray(x)?x.map(unnull):x;
export default {
 group:'oracle-v3p5-tool-largest', functions:['largestStatedError'], default:{abs:1e-12,rel:1e-12},
 run(a,pc){
  if(a.fn!=='toolDesignerLargest')throw new Error(`Unknown R50 function ${a.fn}`);
  const input=caseInput(a.case),E={...input.E,e:unnull(input.E.e)};
  const result=tools.run({...a,fn:'toolReportDesigner',q:E.criteria.map(()=>null)},pc);
  const grade=result.optimum.grade;
  return {grade,N:result.optimum.evaluation.N,largest:E.criteria.map((_,k)=>pc.largestStatedError(grade,E,{w:E.criteria.map((_,j)=>j===k?1:0)}))};
 }
};
