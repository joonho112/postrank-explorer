// Actual public-engine composites for independent base-R seed-boundary UI pins. No app is
// imported and no expected numerical value is calculated in JavaScript. The R generator's
// stated wrap contract supplies firstSeed/maxSeed; all probability/statistical/optimization
// outputs below are composed from the engine's public operations.
export default {
  group: 'oracle-v3-review-a',
  run(a,pc) {
    if(a.kind !== 'mc-seed-boundary')throw new Error(`unknown Review A oracle kind: ${a.kind}`);
    const seeds=Array.from({length:a.runs},(_,i)=>1+(a.firstSeed-1+i)%a.maxSeed);
    const exact=pc.errorArray(a.means,a.sds,{ids:a.ids,criteria:['score_A']}),[i,j]=a.pair;
    const settings={tau:a.tau,tieTol:a.tieTol};
    const exactCap=pc.exactOptimum(exact,{...settings,family:{kind:'atMost',G:a.cap}});
    const exactAll=pc.exactOptimum(exact,{...settings,family:{kind:'all'}});
    const member=(xs,ys)=>xs.some(g=>ys.some(h=>g.every((v,i)=>v===h[i])));
    const action=(eab,eba)=>pc.pairDecision(eab,eba,a.tau).best.slice().sort();
    const exactAction=action(exact.e[0][i][j],exact.e[0][j][i]).join('|');
    const radius=pc.envelopeRadius(pc.pairCount(a.ids.length),a.S,a.alpha,'package');
    const rows=seeds.map(seed=>{
      const draws=pc.gaussianDraws(a.means,a.sds,a.S,seed),E=pc.drawErrors(draws,{ids:a.ids,criteria:['score_A']});
      const choice=action(E.e[0][i][j],E.e[0][j][i]);
      const kind=choice.join('|')===exactAction?'same':choice.length>1?'tie':'flip';
      const pair=pc.fragilePairs(draws,{tau:a.tau,z:2,screenMargin:Infinity,ids:a.ids}).pairs.find(p=>p.i===i&&p.j===j);
      const cap=pc.exactOptimum(E,{...settings,family:{kind:'atMost',G:a.cap}}),capGrades=cap.grades??[cap.grade];
      const kept=member(capGrades,exactCap.grades??[exactCap.grade]);
      let allKept=false;
      if(kind==='flip') {const all=pc.exactOptimum(E,{...settings,family:{kind:'all'}});allKept=member(all.grades??[all.grade],exactAll.grades??[exactAll.grade]);}
      return {e:E.e[0][i][j],mcse:pair.mcse,fragile:pair.fragile,kind,
        held:pc.maxCoefficientError(E,exact).epsilon.every(v=>v<=radius),kept,
        together:capGrades.every(g=>g[i]===g[j]),ties:cap.tieCount,allKept};
    });
    const eHatAB=rows.map(r=>r.e),shownMcse=rows[0].mcse,tied=rows.filter(r=>r.ties>1),count=p=>rows.filter(p).length;
    return {seeds,eHatAB,acrossRunSd:pc.summaryStats(eHatAB).sd,shownMcse,
      withinCount:shownMcse>0?count(r=>Math.abs(r.e-exact.e[0][i][j])<=2*shownMcse):null,
      fragileCount:count(r=>r.fragile),sameCount:count(r=>r.kind==='same'),flipCount:count(r=>r.kind==='flip'),
      tieCount:count(r=>r.kind==='tie'),envelopeHeldCount:count(r=>r.held),reportKept:count(r=>r.kept),
      together:count(r=>r.together),flipChanged:count(r=>r.kind==='flip'&&!r.kept),
      tieChanged:count(r=>r.kind==='tie'&&!r.kept),tiedRuns:tied.length,
      tiedLo:tied.length?Math.min(...tied.map(r=>r.ties)):0,tiedHi:tied.length?Math.max(...tied.map(r=>r.ties)):0,
      flipChangedAll:count(r=>r.kind==='flip'&&!r.allKept),distinctSeeds:new Set(seeds).size,
      seedFirst:seeds[0],seedLast:seeds.at(-1),exactEAB:exact.e[0][i][j],radius};
  },
  default:{abs:0,rel:0},
  tolerance:Object.fromEntries(['eHatAB','acrossRunSd','shownMcse','exactEAB','radius'].map(k=>[k,{abs:1e-12,rel:1e-12}])),
};
