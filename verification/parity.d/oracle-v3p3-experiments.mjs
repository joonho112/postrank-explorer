// Independent R30 experiment contracts. Engine compositions only; no application imports.
import{readFileSync}from'node:fs';
const SIX=JSON.parse(readFileSync(new URL('../../data/released/six-sites.json',import.meta.url),'utf8')).tables.units;
const evaluation=ev=>({M:ev.M,N:ev.N,Ew:ev.Ew,EoverN:ev.EoverN[0],disclosure:ev.s,risk:ev.risk});
const changeFields=['M','nSame','nNewDisclosed','nNewWithheld','nReversed','agreement','changed','changeShare'];
const seedAt=(seed,offset)=>1+((seed-1+offset)%4294967295);
function conditional(a,pc){
 const finite=a.law==='tb17',states=[[20,4],[0,4]],probs=[.3,.7],family=finite?{kind:'all'}:{kind:'atMost',G:a.cap};
 const E=finite?pc.finiteLawPairwise(states,probs):pc.errorArray(SIX.mean_A,SIX.sd_A),opt=pc.exactOptimum(E,{tau:a.tau,family});
 const gradeBest=Array.from(opt.grade),gradeRule=a.comparator==='self'?gradeBest.slice():a.comparator==='withheld'?gradeBest.map(()=>1):a.comparator==='BAboveA'?[2,1]:Array.from(pc.tierGrades(SIX.mean_A,a.comparator==='pmtiers3'?3:2));
 const bestEvaluation=evaluation(pc.evaluateReport(gradeBest,E,{tau:a.tau})),ruleEvaluation=evaluation(pc.evaluateReport(gradeRule,E,{tau:a.tau}));
 const stateIndices=finite?Array.from(pc.finiteLawDraws(probs,a.S,a.seed)):null;
 const draws=finite?stateIndices.map(s=>states[s].map(v=>[v])):pc.gaussianDraws(SIX.mean_A,SIX.sd_A,a.S,a.seed);
 const out={gradeBest,gradeRule,familySize:Number(opt.family.size),tieCount:opt.tieCount,inFamily:finite||Math.max(...gradeRule)<=a.cap,bestEvaluation,ruleEvaluation,exactDelta:ruleEvaluation.risk-bestEvaluation.risk,draws,comparison:pc.compareReportLosses(gradeBest,gradeRule,draws,{tau:a.tau})};
 if(finite){const losses=pc.compareReportLosses(gradeBest,gradeRule,states,{tau:a.tau}),law=pc.finiteLawPairwise(losses.lossBest.map((v,i)=>[v,losses.lossRule[i]]),probs);Object.assign(out,{stateIndices,exactRuleWinShare:law.pi[0][0][1],exactBestWinShare:law.pi[0][1][0],exactTieShare:law.t[0][0][1],exactLossBest:losses.lossBest,exactLossRule:losses.lossRule,exactStateDelta:losses.delta});}
 return out;
}
function stability(a,pc){
 const league=pc.league30(),ids=league.ids,n=ids.length,M=pc.pairCount(n),keys=['raw','posterior','cuts','withheld'],pairs=[],seeds=[];
 function observation(seed){const estimate=Array.from(pc.drawLeague(seed).estimate),posterior=pc.normalPosterior(estimate,league.se,{priorMean:0,priorSd:a.priorSd}),E=pc.errorArray(posterior.mean,posterior.sd,{ids,criteria:['theta']});
  const grades={raw:Array.from(pc.tierGrades(estimate,a.G)),posterior:Array.from(pc.tierGrades(posterior.mean,a.G)),cuts:Array.from(pc.fixedOrderDP(E,{scores:posterior.mean,direction:'descending',G:a.G,tau:a.tau}).grade),withheld:ids.map(()=>1)};
  return{estimate,posterior,grades,E};}
 for(let r=0;r<a.replays;r++){
  const seed1=seedAt(a.seed,2*r),seed2=seedAt(a.seed,2*r+1),one=observation(seed1),two=observation(seed2),rules={};seeds.push(seed1,seed2);
  for(const k of keys){const grade1=one.grades[k],grade2=two.grades[k],c=pc.relationChange(grade1,grade2);rules[k]={grade1,grade2,evaluation1:evaluation(pc.evaluateReport(grade1,one.E,{tau:a.tau})),evaluation2:evaluation(pc.evaluateReport(grade2,two.E,{tau:a.tau})),change:Object.fromEntries(changeFields.map(k=>[k,c[k]]))};}
  pairs.push({r:r+1,seed1,seed2,estimate1:one.estimate,estimate2:two.estimate,posterior1:one.posterior,posterior2:two.posterior,rules});
 }
 const summary={};for(const k of keys){const evaluations=pairs.flatMap(p=>[p.rules[k].evaluation1,p.rules[k].evaluation2]),cases=evaluations.map(e=>({A:e.Ew,N:e.N})),m=pc.disclosedErrorEstimands(cases,{M});summary[k]={meanChangeShare:pc.summaryStats(pairs.map(p=>p.rules[k].change.changeShare)).mean,meanDisclosure:m.meanDisclosure,pooledEoverN:m.ERR,totalE:evaluations.reduce((s,e)=>s+e.Ew,0),totalN:evaluations.reduce((s,e)=>s+e.N,0)};}
 return{seeds,pairs,summary};
}
export default{group:'oracle-v3p3-experiments',run:(a,pc)=>a.fn==='conditionalLossExperiment'?conditional(a,pc):a.fn==='stabilityExperiment'?stability(a,pc):(()=>{throw new Error(`Unmapped R30 experiment ${a.fn}`)})(),default:{abs:1e-12,rel:1e-12}};
