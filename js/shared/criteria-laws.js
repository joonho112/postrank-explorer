// Tiny restated pedagogical laws, not empirical data. Their scientific outputs use public engine compositions.
import {estimandCosts,finiteLawPairwise} from '../pr-core.js';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
export const CHAPTER19=freeze({key:'chapter19',ids:['A','B','C','D'],criteria:['criterion 1','criterion 2'],states:[[[4,4],[3,2],[2,3],[1,1]],[[3,1],[4,2],[2,3],[1,4]]],probs:[.75,.25],w:[.6,.4],a:[.75,.25],tau:.2,source:'Postrank theory book, chapter 19: restated four-unit two-state law'});
export const KNOWN_COMPOSITE=freeze({key:'known',ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,-2],[0,0]]],probs:[1],w:[.75,.25],a:[.5,.5],tau:.3,source:'P-04 and theory book chapter 12: known-state composite example'});
export const ROBUST_PAIR=freeze({key:'robust-pair',ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,1],[0,0]],[[1,-1],[0,0]]],probs:[.5,.5],tau:.25,source:'P-07/chapter 13: one certain criterion and one equally likely direction'});
export const CERTAIN_OPPOSITION=freeze({key:'certain-opposition',ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,0],[0,1]]],probs:[1],tau:.25,source:'Chapter 13: certain opposing criterion directions'});
export const CRITERION_MAJORITY=freeze({key:'criterion-majority',ids:['A','B'],criteria:['criterion 1','criterion 2','criterion 3'],states:[[[1,1,0],[0,0,1]]],probs:[1],w:[1/3,1/3,1/3],tau:.3,source:'Chapter 12: restated known-state example with two agreeing criteria and one opposing criterion'});
export const UNCERTAIN_AGREEMENT=freeze({key:'uncertain-agreement',ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[1,1],[0,0]],[[-1,-1],[0,0]]],probs:[.5,.5],tau:.2,source:'Constructed two-state law: criteria agree within every state, posterior directions uncertain'});
/** Explicit whole-state probabilities; agreeing criteria need not identify a certain direction. */
export function uncertainDirectionLaw(p=.6){
 if(!Number.isFinite(p)||p<0||p>1)throw new RangeError('State probability must lie between zero and one');
 return {...UNCERTAIN_AGREEMENT,key:'uncertain-direction',probs:[p,1-p],source:'Constructed two-state law: criteria agree within every state, while the posterior direction remains uncertain'};
}
export const ORDER_THREE=freeze({key:'order-three',ids:['A','B','C'],criteria:['criterion 1','criterion 2'],states:[[[20,20],[4,4],[3,3]],[[0,0],[4,4],[3,3]]],probs:[.3,.7],tau:.25,source:'Chapters 17/19: three-unit ordering-family example'});
export function couplingLaw(lambda=1){
 if(!Number.isFinite(lambda)||lambda<0||lambda>1)throw new RangeError('Coupling must lie in [0,1]');
 return {key:'coupling',ids:['A','B'],criteria:['criterion 1','criterion 2'],states:[[[2,2],[0,0]],[[-1,-1],[0,0]],[[2,-1],[0,0]],[[-1,2],[0,0]]],probs:[lambda/2,lambda/2,(1-lambda)/2,(1-lambda)/2],source:'Restated fixed-margin two-unit coupling editor after chapters 11/19'};
}
/** Declared deterministic ch15 coefficient-input example; t is NOT a random estimate or a certificate. */
export function bookBudgetInput(t=.2){
 if(!Number.isFinite(t)||t<0||t>.9)throw new RangeError('Book coefficient input t must lie between zero and .9');
 const ids=['A','B'],criteria=['c1'];
 return {key:'book-budget',ids,criteria,Ehat:{ids,criteria,e:[[[NaN,t],[1-t,NaN]]]},Eexact:{ids,criteria,e:[[[NaN,t+.1],[.9-t,NaN]]]},q:[t+.05],tau:.25,
  source:'Postrank theory book, chapter 15: deterministic estimated-protection coefficient example with declared gap .1'};
}
export function finiteCriteria(law){return finiteLawPairwise(law.states,law.probs,{ids:law.ids,criteria:law.criteria});}
/** Approved finite composite composition; do not derive joint information from marginal pair arrays. */
export function finiteComposite(law,{a=law.a,w=law.w,tau=law.tau,multiplier}={}){
 const compositeStates=law.states.map(state=>estimandCosts(state,{a,w,tau,...(multiplier?{multiplier}:{})}).c.map(c=>[c]));
 return {criterionE:finiteCriteria(law),compositeE:finiteLawPairwise(compositeStates,law.probs,{ids:law.ids,criteria:['composite']}),compositeStates};
}
