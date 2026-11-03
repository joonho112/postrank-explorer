// Historical attribution only, not a live grading rule or a source of displayed risks.
// CR-022/M2-F6 records this postrank 1.1.0 representative; the independent installed-package
// audit in part4-review-a-methods.md reproduces it. Both live engine optima remain visible.
export const SIX_SITE_PACKAGE_VERSION=Object.freeze([1,1,0]);
const recordedGrade=Object.freeze([2,2,1,2,3,3]);
export function sixSitePackageRepresentativeIndex({w,tau,cap},grades){
 if(w!==0||tau!==.2||String(cap)!=='3')return -1;
 return grades.findIndex(g=>g.length===recordedGrade.length&&recordedGrade.every((v,i)=>g[i]===v));
}
