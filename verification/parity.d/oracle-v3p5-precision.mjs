// Exact raw-source projection for the independent R51 input pins; no fitted or posterior statistic.
import {caseInput} from '../../js/shared/case-inputs.js';
export default {group:'oracle-v3p5-precision',functions:[],default:{abs:0,rel:0},run(a){
 if(a.fn!=='caseKrwPrecisionInputs'||a.data!=='case-krw')throw new Error('Unknown R51 source projection');
 const input=caseInput('krw'),u=input.source.tables.units,columns=['race_se','gender_se'];
 return {n:input.n,ids:input.ids,names:input.labels,criteria:input.criteria,columns,SE:columns.map(column=>u[column])};
}};
