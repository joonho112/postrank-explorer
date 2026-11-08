// Author: JoonHo Lee (jlee296@ua.edu).
// All live dependence controls and all candidate cards, with no floating tolerance.
export default {
 group:'postrank-v35-pilot',
 functions:['mdomainInput','mdomainGrades','mdomainFamily','mdomainEvaluate','mdomainSolve','mdomainExample'],
 default:{abs:0,rel:0},
 run(args,core){
  const request=core.mdomainExample('dependence',{couplingIndex:args.couplingIndex});
  const input=core.mdomainInput(request.input),family=core.mdomainFamily(input,request.family),fit=core.mdomainSolve(input,family,request.decision);
  return {fit,selectedEvaluation:core.mdomainEvaluate(input,fit.selectedGrades,request.decision),canonicalGrades:core.mdomainGrades(input,fit.selectedGrades),fixedCards:fit.candidateTable.map(row=>({cardId:row.candidateId,evaluation:core.mdomainEvaluate(input,row.grades,request.decision)}))};
 }
};
