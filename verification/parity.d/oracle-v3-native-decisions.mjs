// Independent R31: native action objectives using public engine compositions only.
export default{group:'oracle-v3-native-decisions',default:{abs:1e-12,rel:1e-12},run:(a,pc)=>{
 if(a.fn!=='nativeDecisionExperiment')throw new Error(`Unknown native experiment ${a.fn}`);
 let ids,n,E,means,pTop,pAbove,opt,raw;
 if(a.law==='league'){
  const L=pc.league30(),measurement=pc.drawLeague(a.measurementSeed),post=pc.normalPosterior(measurement.estimate,L.se,{priorMean:0,priorSd:a.priorSd});
  ids=L.ids;n=ids.length;means=post.mean;E=pc.errorArray(post.mean,post.sd,{ids,criteria:['theta']});raw=Array.from(measurement.estimate);
  const r=pc.rankSummariesMC(means,post.sd,a.S,a.seed);pTop=a.budget===0?means.map(()=>0):a.budget===n?means.map(()=>1):r.pTop[a.budget-1];pAbove=means.map((m,i)=>pc.pairDirection(m,post.sd[i],a.threshold,0));
  opt=pc.fixedOrderDP(E,{scores:means,direction:'descending',G:a.cap,tau:a.tau});
 }else{
  const states=a.law==='tb17'?[[20,4],[0,4]]:[[20,4,3],[0,4,3]],probs=[.3,.7];n=states[0].length;ids=Array.from({length:n},(_,i)=>String.fromCharCode(65+i));
  E=pc.finiteLawPairwise(states,probs,{ids});const r=pc.rankSummaries({states,probs});means=r.means;pTop=a.budget===0?means.map(()=>0):a.budget===n?means.map(()=>1):r.pTop[a.budget-1];
  const law=pc.finiteLawPairwise(states.map(s=>[...s,a.threshold]),probs);pAbove=means.map((_,i)=>law.pi[0][i][n]);opt=pc.exactOptimum(E,{tau:a.tau,family:{kind:'all'}});
 }
 const grades={mean:Array.from(pc.strictOrder(means)),top:Array.from(pc.strictOrder(pTop)),optimal:Array.from(opt.grade),withheld:ids.map(()=>1)};if(raw)grades.raw=Array.from(pc.strictOrder(raw));
 const costs={falsePositiveCost:a.falsePositiveCost,falseNegativeCost:a.falseNegativeCost};
 const reports=Object.fromEntries(Object.entries(grades).map(([key,grade])=>{const ev=pc.evaluateReport(grade,E,{tau:a.tau});return[key,{grade,evaluation:{M:ev.M,N:ev.N,Ew:ev.Ew,EoverN:ev.EoverN[0],risk:ev.risk,disclosure:ev.s},allocation:pc.allocationValue(grade,{values:means,pTop,budget:a.budget}),classification:pc.thresholdClassification(pAbove,{...costs,positive:grade.map(g=>g<=a.positiveGrade)})}];}));
 return{means,pTop,pAbove,n,M:pc.pairCount(n),reports,bayesClassification:pc.thresholdClassification(pAbove,costs),optimalFamilySize:Number(opt.family.size),optimalTieCount:opt.tieCount};
}};
