// R33 independently enumerates the complete capped order family. Map the public API and sort membership only.
export default {group:'oracle-v3-ordered-tau-ties',default:{abs:1e-12,rel:1e-12},run:(a,pc)=>{
 if(a.fn!=='orderedTauTies')throw new Error(`Unknown R33 function ${a.fn}`);
 const L=pc.league30(),obs=pc.drawLeague(a.seed),post=pc.normalPosterior(obs.estimate,L.se,{priorMean:a.priorMean,priorSd:a.priorSd});
 const E=pc.errorArray(post.mean,post.sd,{ids:L.ids,criteria:['theta']}),best=pc.fixedOrderDP(E,{scores:post.mean,direction:'descending',G:a.G,tau:a.tau,tieTol:a.tieTol});
 const grades=best.grades.map(g=>Array.from(g)).sort((x,y)=>{for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;});
 return {grade:Array.from(best.grade),grades,tieCount:best.tieCount,tieTol:best.tieTol,order:Array.from(best.order),reports:grades.map(grade=>{const ev=pc.evaluateReport(grade,E,{tau:a.tau});return {grade,N:ev.N,Ew:ev.Ew,risk:ev.risk};})};
}};
