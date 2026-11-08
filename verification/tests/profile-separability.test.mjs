// Author: JoonHo Lee (jlee296@ua.edu).
// Public R records determine the scientific expectations; no widget result is its own oracle.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWindow} from '../dom-env.mjs';
import {numberFindings,badTokenFindings,displayFindings} from '../dom_rules.mjs';
import {solveProfileSeparability,mountWidget,PROFILE_SEPARABILITY_KEYS} from '../../js/apps/profile-separability.js';
const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url)));
const VIEWS=read('verification/golden/postrank-v35-profile-views.json');
const couplingName={0:'disjoint',1:'independent',10:'coincident'};
const cases=[0,1,10].flatMap(couplingIndex=>[false,true].flatMap(zeroWeight=>[false,true].map(protectedMode=>({couplingIndex,zeroWeight,protected:protectedMode}))));
const idOf=s=>`separable-${couplingName[s.couplingIndex]}-${s.zeroWeight?'one-zero':'equal'}-guard-${s.protected?'on':'off'}`;
const reference=s=>read(`verification/golden/v35/${idOf(s)}.json`);
function normalize(value){
 const x=structuredClone(value);for(const k of ['inputId','lawId','decisionId','familyId'])delete x[k];
 const grades=g=>{g.domainIds=['S','C'];};
 if(x.grades)grades(x.grades);if(x.selectedGrades)grades(x.selectedGrades);if(x.candidateTable)for(const r of x.candidateTable)grades(r.grades);if(x.domains)for(let d=0;d<x.domains.length;d++)x.domains[d].domainId=['S','C'][d];return x;
}
function view(r){const s=r.summary;return{feasibleIds:r.feasibleIds,projectionColumns:r.projectionIds.map(xs=>xs.map(x=>x.slice(2))),projectionProductIds:r.projectionProductIds,missingIds:r.missingIds,factorizes:s.isProduct,projectionSizes:s.projectionCounts,domainMinExact:r.columns.map(rows=>rows.find(row=>row.isWeightedMinimum).weightedLossExact),weightedArgminColumns:r.argminColumnIds.map(xs=>xs.map(x=>x.slice(2))),preferredIds:r.preferredIds,preferredFeasibleIds:r.preferredFeasibleIds,boundExact:s.lowerBoundExact,actualRiskExact:s.riskExact,gapExact:s.riskGapExact,lowerBoundAttained:s.lowerBoundAttained,preferredProductEqualsOptimizerSet:s.argminProductEqualsOptimizers,optimizerIds:r.fit.optimizerIds,selectedId:r.fit.selectedId,feasibleCount:s.feasibleCount,projectionProductCount:s.projectionProductCount,preferredCount:s.preferredProductCount,preferredFeasibleCount:s.preferredFeasibleCount,optimizerCount:s.optimizerCount};}
for(const state of cases){
 test(`P.2 ${idOf(state)}: complete fit and all fixed cards match public R`,()=>{
  const expected=reference(state),r=solveProfileSeparability(state);
  assert.deepEqual(r.input.states,expected.input.states);assert.deepEqual(r.input.masses,expected.input.masses);
  for(const k of ['weights','tau','q','t','alpha','scope'])assert.deepEqual(r.request.decision[k],expected.decision[k]);
  assert.deepEqual(normalize(r.fit),normalize(expected.expected.fit));
  for(const fixed of expected.expected.fixedCards)assert.deepEqual(normalize(solveProfileSeparability({...state,candidate:fixed.cardId}).focus),normalize(fixed.evaluation));
 });
 test(`P.2 ${idOf(state)}: projections and complete weighted minima match independent R view oracle`,()=>{
  const r=solveProfileSeparability(state),row=VIEWS.rows.find(row=>row.id===idOf(state));assert.ok(row);assert.deepEqual(view(r),row.expect);
  if(r.summary.isProduct)assert.deepEqual(r.preferredIds,r.fit.optimizerIds);
 });
}
test('zero-weight guard remains active and an attained partial product is not labeled unattainable',()=>{
 const guarded=solveProfileSeparability({couplingIndex:1,zeroWeight:true,protected:true});assert.equal(guarded.summary.lowerBoundAttained,true);assert.equal(guarded.summary.isProduct,false);assert.equal(guarded.summary.riskGapExact,'0');assert.ok(guarded.missingPreferredIds.length>0);assert.ok(guarded.preferredFeasibleIds.length>0);
 const ordinary=solveProfileSeparability({couplingIndex:1,zeroWeight:false,protected:true});assert.deepEqual(guarded.feasibleIds,ordinary.feasibleIds);
 const unguarded=solveProfileSeparability({couplingIndex:1,zeroWeight:true,protected:false});assert.equal(unguarded.fit.optimizerIds.length,3);assert.ok(unguarded.columns[0].every(row=>row.isWeightedMinimum));
});
test('the actual guarded coincident family still factors',()=>{const r=solveProfileSeparability({couplingIndex:10,zeroWeight:false,protected:true});assert.equal(r.summary.isProduct,true);assert.deepEqual(r.missingIds,[]);assert.deepEqual(r.preferredIds,r.fit.optimizerIds);});
test('candidate inspection never changes the fit, feasible set or projected minimum',()=>{const first=solveProfileSeparability();for(const row of first.fit.candidateTable){const r=solveProfileSeparability({candidate:row.candidateId});assert.equal(r.fit,first.fit);assert.equal(r.summary,first.summary);assert.equal(r.focus,r.evaluations.get(row.candidateId));}assert.throws(()=>solveProfileSeparability({candidate:'not-a-card'}),RangeError);});
function mount(query=''){const m=makeWindow({plot:false,query});const handle=mountWidget(m.el);return{...m,handle,close(){handle.destroy();m.restore();}};}
test('all reachable settings and candidate focus remain complete, exact and numerically annotated',()=>{
 const m=mount();try{
  for(const state of cases){const expected=reference(state);for(const card of expected.expected.fixedCards){m.handle.update({...state,candidate:card.cardId});assert.equal(m.el.querySelector('[data-prx-readout="focused-risk"]').dataset.num,card.evaluation.riskExact);assert.equal(m.el.querySelector('[data-prx-readout="focused-status"]').textContent,card.evaluation.feasible?'Feasible':'Infeasible');assert.equal(m.el.querySelectorAll('.mds-card').length,9);assert.equal(m.el.querySelectorAll('.mds-card[aria-pressed="true"]').length,1);assert.equal(m.el.querySelectorAll('.mds-card.mds-optimal').length,expected.expected.fit.optimizerIds.length);}
   assert.deepEqual(numberFindings(m.el),[]);assert.deepEqual(badTokenFindings(m.el),[]);assert.deepEqual(displayFindings(m.el),[]);
  }
 }finally{m.close();}
});
test('public keys, arrow focus, full preset reset and URL replay preserve the teaching law',()=>{
 assert.deepEqual(PROFILE_SEPARABILITY_KEYS.couplingIndex.values,[0,1,10]);const m=mount('?couplingIndex=1&zeroWeight=true&protected=true&candidate=p%3A1%2C1%7C1%2C2');
 try{
  assert.deepEqual(m.handle.state,{couplingIndex:1,zeroWeight:true,protected:true,candidate:'p:1,1|1,2'});
  const current=m.el.querySelector('[data-card="p:1,1|1,2"]');current.focus();current.dispatchEvent(new m.win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(m.handle.state.candidate,'p:1,2|1,2');assert.equal(m.doc.activeElement.dataset.card,m.handle.state.candidate);
  m.handle.applyPreset('dependent-coincident');assert.deepEqual(m.handle.state,{couplingIndex:10,zeroWeight:false,protected:false,candidate:'p:1,2|1,2'});assert.match(m.el.querySelector('[data-prx-readout="factorisation-status"]').textContent,/is a product/);
  m.handle.applyPreset('independent-joint');assert.equal(m.handle.state.protected,true);assert.equal(m.handle.state.zeroWeight,false);assert.match(m.el.querySelector('[data-prx-readout="factorisation-status"]').textContent,/unattainable/);
  m.handle.update({zeroWeight:true});assert.doesNotMatch(m.el.querySelector('[data-prx-readout="factorisation-status"]').textContent,/unattainable/);assert.match(m.el.querySelector('[data-prx-readout="factorisation-status"]').textContent,/is attained/);
  m.handle.applyPreset('guarded-coincident');assert.equal(m.handle.state.couplingIndex,10);assert.equal(m.handle.state.protected,true);assert.equal(m.handle.state.zeroWeight,false);
  const inspection=m.el.querySelector('[data-prx-mdomain-candidate="p:1,1|1,1"] button');inspection.click();assert.equal(m.handle.state.candidate,'p:1,1|1,1');
 }finally{m.close();}
});
test('all five complete presets reset every public key and retain the corresponding R optimum',()=>{
 const entry=read('catalog/entries/P.2-profile-separability.json');assert.equal(entry.presets.length,5);const m=mount();
 try{for(const preset of entry.presets){m.handle.update({couplingIndex:1,zeroWeight:true,protected:true,candidate:'p:2,1|2,1'});m.handle.applyPreset(preset.id);const q=new URLSearchParams(preset.query),state={couplingIndex:Number(q.get('couplingIndex')),zeroWeight:q.get('zeroWeight')==='true',protected:q.get('protected')==='true',candidate:q.get('candidate')};assert.deepEqual(m.handle.state,state);assert.equal(m.el.querySelector('[data-prx-readout="minimum-risk"]').dataset.num,reference(state).expected.fit.riskExact);}}
 finally{m.close();}
});
