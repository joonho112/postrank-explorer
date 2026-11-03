// Independent R37 display coverage: released input joins and public pr-core calls only.
import {readFileSync} from 'node:fs';
import base from './oracle-v3p4.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../../data/released/${name}.json`,import.meta.url),'utf8'));
const SIX=read('six-sites'),THIRTY=read('thirty-sites'),ARCHIVE=read('cache-30x3'),TUTORIAL=read('cache-tutorial');
const shape=x=>x===undefined?null:typeof x==='number'&&Number.isNaN(x)?null:ArrayBuffer.isView(x)?Array.from(x,shape):Array.isArray(x)?x.map(shape):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shape(v)])):x;
function input(key='six',orient){
 const raw=key==='six'?SIX:THIRTY,a=raw.arrays[key==='six'?'two':'gaussian'],table=raw.tables.units,stems=key==='six'?['A','B']:a.criteria;
 orient??=a.criteria.map(()=>1);
 const rows=a.ids.map(id=>table.id.indexOf(id));
 if(rows.some(i=>i<0))throw new Error('Released profile ID join failed');
 return {ids:a.ids,criteria:a.criteria,orient,means:rows.map(i=>stems.map((s,k)=>orient[k]*table['mean_'+s][i])),sds:rows.map(i=>stems.map(s=>table['sd_'+s][i])),E:{ids:a.ids,criteria:a.criteria,e:a.e.map((m,k)=>m.map((row,i)=>row.map((v,j)=>v===null?NaN:orient[k]===1?v:m[j][i])))}};
}
function optimal(r,withBase=false,baseSize){
 const out={empty:r.empty};
 for(const k of ['grade','grades','tieCount','risk','N','G','Ew','E','EoverN','evaluation'])if(k in r)out[k]=r[k];
 return {...out,familySize:r.family.size,...(withBase?{baseSize:r.family.baseSize??baseSize}:{}),containsAllWithheld:r.containsAllWithheld,tieTol:r.tieTol,label:r.label};
}
const archiveSource=s=>Object.fromEntries(['object','path','rds_sha256'].map(k=>[k,s[k]]));
function run(a,pc){switch(a.fn){
 case 'criterionProfilesPart4':{
  const d=input(a.data,a.orient),{ids,criteria,orient,means,sds,E}=d,[i,j]=a.pair;
  const profiles=criteria.map((criterion,k)=>{const mean=means.map(r=>r[k]),sd=sds.map(r=>r[k]);return {criterion,mean,sd,intervals:mean.map((m,u)=>pc.normalInterval(m,sd[u],a.level)),scoreOrder:pc.scoreOrder(mean,{ids}),expectedRank:pc.expectedRank({ids,criteria:[criterion],e:[E.e[k]]})};});
  return {ids,criteria,orient,means,sds,E,profiles,expectedRank:pc.expectedRank(E),conflicts:pc.conflictPairs(E),pair:{i,j,criteria:criteria.map((criterion,k)=>({criterion,iMean:means[i][k],iSd:sds[i][k],jMean:means[j][k],jSd:sds[j][k],iInterval:profiles[k].intervals[i],jInterval:profiles[k].intervals[j],eIJ:E.e[k][i][j],eJI:E.e[k][j][i],piIJ:pc.pairDirection(means[i][k],sds[i][k],means[j][k],sds[j][k]),piJI:pc.pairDirection(means[j][k],sds[j][k],means[i][k],sds[i][k]),equality:0}))}};
 }
 case 'archivedCriteriaPart4':{
  const suffix=a.tau===.35?'_tau35':'',analysis=ARCHIVE.analyses['analysis_30x3'+suffix],costs=ARCHIVE.analyses['commonality_30x3'+suffix];
  const keys=['tau','G_max','weights','n','M','N','G','sizes','disclosure_rate','risk','lower_bound','gap','status','bound_source'];
  return {analysis:{source:archiveSource(analysis.source),facts:Object.fromEntries(keys.map(k=>[k,analysis.facts[k]])),tables:{units:{id:analysis.tables.units.id,grade:analysis.tables.units.grade},profile:analysis.tables.profile}},costs:{source:archiveSource(costs.source),table:costs.tables.costs}};
 }
 case 'archivedPathPart4':{const s=ARCHIVE.analyses.frontier_30x3;return {source:archiveSource(s.source),facts:{G_max:s.facts.G_max,weights:s.facts.weights,objective:s.facts.objective},path:s.tables.path};}
 case 'tutorialSensitivityPart4':{const s=TUTORIAL.analyses.tutorial_sensitivity;return {referenceId:s.facts.reference_id,grid:s.tables.grid,results:s.tables.results,grades:s.tables.grades,changes:s.tables.changes};}
 case 'finiteCompositePart4':return base.run(a,pc);
 case 'twoScoresPart4':{
  const {E}=input(),r=pc.exactOptimum(E,{tau:a.tau,w:a.w,family:a.family}),matrix=pc.weightedError(E,a.w),weighted={ids:E.ids,criteria:['weighted'],e:[matrix]},all=E.ids.map(()=>1);
  return {optimum:optimal(r),profiles:r.grades.map(grade=>({grade,evaluation:pc.evaluateReport(grade,E,{tau:a.tau,w:a.w}),conditionalBounds:{weightedBudget:pc.budgetCheck(grade,weighted,[a.tau]),riskDifference:pc.compareReports(all,grade,E,{tau:a.tau,w:a.w}).deltaRisk}}))};
 }
 case 'budgetDisplayPart4':{
  const {E}=input(),r=pc.budgetFamily(E,{tau:a.tau,w:a.w,family:a.family,q:a.q}),g=r.optimum?.grade;
  return {empty:r.empty,size:r.size,baseSize:r.baseSize,containsAllWithheld:r.containsAllWithheld,optimum:r.optimum?optimal(r.optimum,true,r.baseSize):null,check:g?pc.budgetCheck(g,E,a.q):null,largest:g?pc.largestStatedError(g,E,{w:a.w}):null,largestByCriterion:E.criteria.map((_,k)=>g?pc.largestStatedError(g,E,{w:E.criteria.map((_,l)=>l===k?1:0)}):null)};
 }
 default:throw new Error(`Unknown R37 function ${a.fn}`);
}}
export default {group:'oracle-v3p4-profiles',default:{abs:1e-12,rel:1e-12},functions:['normalInterval','scoreOrder','expectedRank','conflictPairs','pairDirection','exactOptimum','budgetFamily','budgetCheck','largestStatedError'],run:(a,pc)=>shape(run(a,pc))};
