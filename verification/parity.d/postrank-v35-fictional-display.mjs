// Author: JoonHo Lee (jlee296@ua.edu).
// A display audit against independent R extraction/counts, not posterior recomputation.
import{inspectFictionalSiteProfiles}from'../../js/apps/fictional-site-profiles.js';
export default{
 group:'postrank-v35-fictional-display',functions:[],default:{abs:0,rel:0},
 run(args){const r=inspectFictionalSiteProfiles(args);return{grades:r.grades,cells:r.cells,pairs:r.pairs,counts:r.counts,derived:r.derived,denominators:r.denominators,roleRows:r.roleRows};}
};
