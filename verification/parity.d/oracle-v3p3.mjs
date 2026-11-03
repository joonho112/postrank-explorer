// Independent base-R Part3 supplement (R29). This adapter only maps the documented engine calls/shapes.
import{readFileSync}from'node:fs';
const KRW=JSON.parse(readFileSync(new URL('../../data/released/case-krw.json',import.meta.url),'utf8'));
const GRID=JSON.parse(readFileSync(new URL('../../data/released/krw-lambda-grid.json',import.meta.url),'utf8'));
const nan=x=>x===null?NaN:Array.isArray(x)?x.map(nan):x;
const err=E=>({...E,e:nan(E.e)});
const krwE=criterion=>{const k=KRW.arrays.error.criteria.indexOf(`${criterion}_signed`);return{ids:KRW.arrays.error.ids,criteria:[KRW.arrays.error.criteria[k]],e:[nan(KRW.arrays.error.e[k])]};};
function patternE(pattern){const e=Array.from({length:3},()=>Array(3).fill(NaN));for(const[i,j,r]of[[0,1,pattern[0]],[1,2,pattern[1]],[0,2,pattern[2]]]){e[i][j]=r===1?.1:r===-1?.9:.5;e[j][i]=1-e[i][j];}return{ids:['1','2','3'],criteria:['c1'],e:[e]};}
function call(a,pc){switch(a.fn){
 case'tierSizeDistribution':return pc.tierSizeDistribution(a.n,a.G);
 case'disclosure':return pc.disclosure(a.g);
 case'reportInformation':return{information:pc.reportInformation(a.g,a.criterion?krwE(a.criterion):err(a.E))};
 case'thresholdViolations':return pc.thresholdViolations(a.pattern?patternE(a.pattern):a.criterion?krwE(a.criterion):err(a.E),a.options);
 case'compareReportLosses':return pc.compareReportLosses(a.gBest,a.gRule,a.draws,a.options);
 case'relationChange':return pc.relationChange(a.g0,a.g1);
 case'allocationValue':return pc.allocationValue(a.g,a.options);
 case'thresholdClassification':return pc.thresholdClassification(a.probabilities,a.options);
 case'krwQuantile':case'krwCard':{
  const E=krwE(a.criterion),grade=a.fn==='krwQuantile'?Array.from(pc.tierGrades(KRW.tables.units[`mean_${a.criterion}`],a.G)):pc.canonicalGrade(GRID.arrays[a.criterion].grade[Math.round(a.lambda*100)]),d=pc.disclosure(grade),ev=pc.evaluateReport(grade,E,{tau:.5});
  return{grade,sizes:d.sizes,M:d.M,N:d.N,DR:ev.EoverM[0],information:pc.reportInformation(grade,E),Ew:ev.Ew,EoverN:ev.EoverN[0]};
 }
 case'lawPath':{
  const E=pc.finiteLawPairwise([[20,4,3],[0,4,3]],[.3,.7]),family=a.family==='order'?{kind:'order',order:a.order,G:a.G}:a.family==='cap'?{kind:'atMost',G:a.G}:{kind:'all'};
  return{intervals:pc.tauPath(E,{family}).intervals.map(r=>Object.fromEntries(['tauFrom','tauTo','grade','N','Ew','riskFrom','riskTo'].map(k=>[k,r[k]])))};
 }
 case'bookEvaluation':{
  const states=[[20,4,3],[0,4,3]],probs=[.3,.7],E=pc.finiteLawPairwise(states,probs),ev=pc.evaluateReport(a.g,E,{tau:a.tau}),r=pc.rankSummaries({states,probs}),means=r.means,pTop=a.budget===0?means.map(()=>0):r.pTop[a.budget-1];
  return{grade:pc.canonicalGrade(a.g),M:ev.M,N:ev.N,Ew:ev.Ew,risk:ev.risk,EoverN:ev.EoverN[0],means,pTop,allocation:pc.allocationValue(a.g,{values:means,pTop,budget:a.budget})};
 }
 default:throw new Error(`Unmapped R29 function ${a.fn}`);
}}
export default{group:'oracle-v3p3',run:(a,pc)=>{
 if(a.fn.endsWith('Throws')){try{call({...a,fn:a.fn.slice(0,-6)},pc);return{threw:false};}catch{return{threw:true};}}
 return call(a,pc);
},default:{abs:1e-12,rel:1e-12},functions:['tierSizeDistribution','reportInformation','thresholdViolations','compareReportLosses','allocationValue','thresholdClassification']};
