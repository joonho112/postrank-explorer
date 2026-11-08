// Author: JoonHo Lee (jlee296@ua.edu).
// Independent public-R view consequences versus live application adapters; exact comparison.
import{solveProfileCommon}from'../../js/apps/profile-common-vs-domain.js';
import{solveProfileSeparability}from'../../js/apps/profile-separability.js';
const raw=columns=>columns.map(list=>list.map(id=>id.replace(/^g:/,'')));
export default{
 group:'postrank-v35-profile-views',functions:[],default:{abs:0,rel:0},
 run(args){
  if(args.kind==='common'){
   const r=solveProfileCommon(args);
   return{commonRiskExact:r.common.riskExact,profileRiskExact:r.fit.riskExact,gapExact:r.gapExact,commonOptimizerIds:r.common.optimizerIds,profileOptimizerIds:r.fit.optimizerIds,commonSelectedId:r.common.selectedId,profileSelectedId:r.fit.selectedId,commonOptimizerCount:r.common.optimizerIds.length,profileOptimizerCount:r.fit.optimizerIds.length};
  }
  const r=solveProfileSeparability(args),s=r.summary;
  return{feasibleIds:r.feasibleIds,projectionColumns:raw(r.projectionIds),projectionProductIds:r.projectionProductIds,missingIds:r.missingIds,factorizes:s.isProduct,projectionSizes:s.projectionCounts,domainMinExact:r.columns.map(cols=>cols.find(c=>c.isWeightedMinimum).weightedLossExact),weightedArgminColumns:raw(r.argminColumnIds),preferredIds:r.preferredIds,preferredFeasibleIds:r.preferredFeasibleIds,boundExact:s.lowerBoundExact,actualRiskExact:r.fit.riskExact,gapExact:s.riskGapExact,lowerBoundAttained:s.lowerBoundAttained,preferredProductEqualsOptimizerSet:s.argminProductEqualsOptimizers,optimizerIds:r.fit.optimizerIds,selectedId:r.fit.selectedId,feasibleCount:s.feasibleCount,projectionProductCount:s.projectionProductCount,preferredCount:s.preferredProductCount,preferredFeasibleCount:s.preferredFeasibleCount,optimizerCount:s.optimizerCount};
 }
};
