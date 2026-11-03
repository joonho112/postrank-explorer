// R34 independently enumerates finite-law ties and their added actions; map public engine compositions only.
export default {group:'oracle-v3-native-tie-actions',default:{abs:1e-12,rel:1e-12},run:(a,pc)=>{
 if(a.fn!=='nativeTieActions')throw new Error(`Unknown R34 function ${a.fn}`);
 const E=pc.finiteLawPairwise(a.states,a.probs),ranks=pc.rankSummaries({states:a.states,probs:a.probs}),means=ranks.means,pTop=ranks.pTop[a.budget-1];
 const event=pc.finiteLawPairwise(a.states.map(s=>[...s,a.threshold]),a.probs),probabilities=means.map((_,i)=>event.pi[0][i][means.length]);
 const opt=pc.exactOptimum(E,{tau:a.tau,tieTol:a.tieTol,family:{kind:'all'}}),grades=opt.grades.map(g=>Array.from(g));
 const evaluation=grade=>{const ev=pc.evaluateReport(grade,E,{tau:a.tau});return {grade,N:ev.N,Ew:ev.Ew,risk:ev.risk};};
 const costs={falsePositiveCost:a.falsePositiveCost,falseNegativeCost:a.falseNegativeCost,values:means};
 return {means,pTop,probabilities,grades,tieCount:opt.tieCount,tieTol:opt.tieTol,
 allReports:Array.from(pc.enumerateReports(means.length,{kind:'all'}),g=>evaluation(Array.from(g))),
 reports:grades.map(grade=>({...evaluation(grade),allocation:pc.allocationValue(grade,{values:means,pTop,budget:a.budget}),classification:pc.thresholdClassification(probabilities,{...costs,positive:grade.map(g=>g<=a.positiveGrade)})})),
 bayesClassification:pc.thresholdClassification(probabilities,costs)};
}};
