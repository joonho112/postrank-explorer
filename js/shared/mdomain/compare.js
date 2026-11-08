// Author: JoonHo Lee (jlee296@ua.edu).
// Exact comparisons of already evaluated losses. No posterior probabilities are computed here.
import {isCanonicalExact} from './format.js';

function fraction(value){
 if(!isCanonicalExact(value))throw new TypeError('A canonical nonnegative exact loss is required.');
 const [numerator,denominator='1']=value.split('/');return {n:BigInt(numerator),d:BigInt(denominator)};
}
export function exactCompare(first,second){
 const a=fraction(first),b=fraction(second),difference=a.n*b.d-b.n*a.d;
 return difference<0n?-1:difference>0n?1:0;
}
/** An exact nonnegative difference of two evaluated losses, including outputs wider than input caps. */
export function exactDifference(first,second){
 const a=fraction(first),b=fraction(second);let n=a.n*b.d-b.n*a.d,d=a.d*b.d;
 if(n<0n)throw new RangeError('This comparison requires a nonnegative loss difference.');
 if(n===0n)return '0';let x=n,y=d;while(y){const t=x%y;x=y;y=t;}n/=x;d/=x;
 return d===1n?String(n):`${n}/${d}`;
}
/**
 * Compare a declared nonempty subset of feasible, already evaluated product cards.
 * The full engine row order determines the canonical representative. All exact minima are retained.
 * This is a listed-subset comparison, never a new product solve or an unrestricted optimum.
 */
export function selectEvaluatedSubset(fit,candidateIds,{comparisonId='evaluated-subset'}={}){
 if(!Array.isArray(fit?.candidateTable)||!Array.isArray(candidateIds)||!candidateIds.length||new Set(candidateIds).size!==candidateIds.length)throw new TypeError('A nonempty unique evaluated-card subset is required.');
 if(typeof comparisonId!=='string'||!comparisonId.trim())throw new TypeError('A comparison ID is required.');
 const wanted=new Set(candidateIds),rows=fit.candidateTable.filter(row=>wanted.has(row.candidateId));
 if(rows.length!==wanted.size)throw new RangeError('The subset contains an unknown evaluated card.');
 if(rows.some(row=>row.feasible!==true))throw new RangeError('Listed comparison cards must satisfy the same bound policy.');
 let best=rows[0].riskExact;for(const row of rows)if(exactCompare(row.riskExact,best)<0)best=row.riskExact;
 const optimizerIds=rows.filter(row=>exactCompare(row.riskExact,best)===0).map(row=>row.candidateId);
 return {comparisonId,scope:'listed_subset',candidateIds:rows.map(row=>row.candidateId),optimizerIds,selectedId:optimizerIds[0],riskExact:best};
}
