// Public engine composites compared with independently generated population-change fixtures.
// The expected values are never computed here. R27 uses package cuts for the league and
// base-R full enumeration for six sites; both compare pair relations on common IDs.
const subset = (E, ix) => ({ ids:ix.map(i=>E.ids[i]), criteria:E.criteria,
  e:E.e.map(m=>ix.map(i=>ix.map(j=>m[i][j]))) });
export function correctionPin(a,pc) {
  if(a.kind==="ties") {
    const means=a.means.slice();means[a.unit]=a.value;
    const E=pc.errorArray(a.means,a.sds,{ids:a.ids}),F=pc.errorArray(means,a.sds,{ids:a.ids});
    const b=pc.exactOptimum(E,{tau:a.tau,family:{kind:"all"}}),c=pc.exactOptimum(F,{tau:a.tau,family:{kind:"all"}});
    const ix=a.ids.map((_,i)=>i).filter(i=>i!==a.unit);
    return {beforeGrades:b.grades.map(g=>Array.from(g)),afterGrades:c.grades.map(g=>Array.from(g)),beforeTieCount:b.tieCount,afterTieCount:c.tieCount,
      comparisons:b.grades.flatMap(g=>c.grades.map(h=>{const r=pc.relationChange(g,h),q=pc.relationChange(ix.map(i=>g[i]),ix.map(i=>h[i]));
        return {beforeGrade:Array.from(g),afterGrade:Array.from(h),changed:r.M-r.nSame,untouchedChanged:q.M-q.nSame};}))};
  }
  let E,w;
  if(a.data==="league") {
    const L=pc.league30(),p=pc.normalPosterior(pc.drawLeague(a.seed).estimate,L.se,{priorSd:a.priorSd});
    E=pc.errorArray(p.mean,p.sd,{ids:L.ids,criteria:["priority"]});w=[1];
  } else {E=pc.errorArray(a.means,a.sds,{ids:a.ids,criteria:["A","B"]});w=a.w;}
  const keep=E.ids.map((id,i)=>id===a.unit?-1:i).filter(i=>i>=0),F=subset(E,keep);
  const solve=E=>{
    if(a.data!=="league")return pc.exactOptimum(E,{tau:a.tau,w,family:{kind:"all"}});
    const ranks=pc.expectedRank(E,{w});
    const order=E.ids.map((_,i)=>i).sort((i,j)=>ranks[i]-ranks[j]||(E.ids[i]<E.ids[j]?-1:1));
    return pc.fixedOrderDP(E,{tau:a.tau,w,order});
  };
  const b=solve(E),c=solve(F),rel=pc.relationChange(keep.map(i=>b.grade[i]),c.grade);
  const coefficientGap=Math.max(...pc.maxCoefficientError(subset(E,keep),F).epsilon);
  return {beforeGrade:Array.from(b.grade),afterGrade:Array.from(c.grade),
    beforeSizes:pc.disclosure(b.grade).sizes,afterSizes:pc.disclosure(c.grade).sizes,
    beforeN:b.N,afterN:c.N,beforeRisk:b.risk,afterRisk:c.risk,
    beforeFamilySize:b.family.size,afterFamilySize:c.family.size,
    commonPairs:rel.M,changed:rel.M-rel.nSame,nSame:rel.nSame,
    nNewWithheld:rel.nNewWithheld,nNewDisclosed:rel.nNewDisclosed,nReversed:rel.nReversed,
    untouchedChanged:rel.M-rel.nSame,untouchedPairs:rel.M,coefficientGap};
}
export default {group:"postrank-v3p2-correction",run:correctionPin,default:{abs:0,rel:0},
  tolerance:{beforeRisk:{abs:1e-10,rel:0},afterRisk:{abs:1e-10,rel:0}}};
