// Independent R32 row counts; map documented data and API shapes only.
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../../data/released/case-krw.json',import.meta.url),'utf8'));
export default {group:'oracle-v3-threshold-units',default:{abs:0,rel:0},run:(a,pc)=>{
 if(a.fn!=='thresholdUnitCounts')throw new Error(`Unknown R32 function ${a.fn}`);
 let E,tau;
 if(a.pattern){
  const e=Array.from({length:3},()=>Array(3).fill(NaN));
  for(const[i,j,r]of[[0,1,a.pattern[0]],[1,2,a.pattern[1]],[0,2,a.pattern[2]]]){e[i][j]=r===1?.1:r===-1?.9:.5;e[j][i]=1-e[i][j];}
  E={ids:['1','2','3'],criteria:['c1'],e:[e]};tau=a.tau;
 }else{
  const k=data.arrays.error.criteria.indexOf(`${a.criterion}_signed`);
  E={ids:data.arrays.error.ids,criteria:[data.arrays.error.criteria[k]],e:[data.arrays.error.e[k].map(row=>row.map(v=>v===null?NaN:v))]};
  tau=a.lambda===0?0:pc.lambdaToTau(a.lambda);
 }
 const result=pc.thresholdViolations(E,{tau});
 return {aboveCounts:result.aboveCounts,statedCount:result.statedCount};
}};
