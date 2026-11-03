// Compare public-engine compositions with independent base-R fixed-report evaluations.
// The grade vector is an INPUT frozen from oracle-v3's independently enumerated reports.
// No app module or expected-value generation is used here.
export default {
  group: 'oracle-v3p2-league',
  run(a, pc) {
    const league=pc.league30(),g=a.grade;
    const estimate=pc.drawLeague(a.baseSeed+a.replay).estimate;
    const assumed=pc.normalPosterior(estimate,league.se,{priorSd:a.priorSd});
    const reference=pc.normalPosterior(estimate,league.se,{priorSd:a.referenceSd});
    const E0=pc.errorArray(assumed.mean,assumed.sd),E1=pc.errorArray(reference.mean,reference.sd);
    const claimed=pc.evaluateReport(g,E0,{tau:a.tau}),evaluated=pc.evaluateReport(g,E1,{tau:a.tau});
    const realized=pc.realizedWrong(g,league.theta.map(v=>[v]));
    const delta=pc.weightedRadius(pc.maxCoefficientError(E0,E1).epsilon,[1]);
    const law=a.drawLaw==='reference'?reference:assumed;
    const drawCounts=a.draws?pc.gaussianDraws(law.mean,law.sd,a.draws,a.seed).map(t=>pc.realizedWrong(g,t).D[0]):[];
    return {N:claimed.N,claimedE:claimed.E[0],referenceE:evaluated.E[0],
      claimedShare:claimed.EoverN[0],referenceShare:evaluated.EoverN[0],delta,
      shareGap:claimed.N?Math.abs(claimed.EoverN[0]-evaluated.EoverN[0]):null,
      D:realized.D[0],realizedShare:realized.DoverN[0],
      drawExpected:a.drawLaw==='reference'?evaluated.E[0]:claimed.E[0],
      drawAverage:a.draws?pc.runningMean(drawCounts).at(-1):null,drawCounts};
  },
  default:{abs:0,rel:0},
  tolerance:Object.fromEntries(['claimedE','referenceE','claimedShare','referenceShare','delta','shareGap','realizedShare','drawExpected','drawAverage'].map(k=>[k,{abs:1e-12,rel:1e-12}])),
};
