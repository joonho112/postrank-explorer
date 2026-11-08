// Author: JoonHo Lee (jlee296@ua.edu).
// Public R references, not the app's own expected constants, determine the result checks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {solveProfileDependence,mountWidget} from '../../js/apps/profile-dependence.js';
const require=createRequire(new URL('../../tools/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const reference=i=>JSON.parse(readFileSync(new URL(`../golden/v35-pilot/dependence-c${i}.json`,import.meta.url)));
for(let i=0;i<=10;i++)test(`P.3 coupling index ${i}: every fit and fixed card agrees with independent public R`,()=>{
 const f=reference(i),r=solveProfileDependence({couplingIndex:i,candidate:'p:1,2|1,2'});
 assert.deepEqual(r.input,f.input);assert.deepEqual(r.fit,f.expected.fit);
 for(const card of f.expected.fixedCards){const focused=solveProfileDependence({couplingIndex:i,candidate:card.cardId});assert.deepEqual(focused.focus,card.evaluation);assert.equal(focused.fit,r.fit);}
});
function mount(query=''){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'https://example.test/',pretendToBeVisual:true});
 dom.window.__PRX_QUERY=query;const root=dom.window.document.getElementById('app');const handle=mountWidget(root);return {dom,root,handle};
}
test('P.3 focus, grid arrows and preset replay retain all exact optimizers',()=>{
 const {dom,root,handle}=mount('?preset=disjoint');
 assert.equal(handle.state.couplingIndex,0);assert.equal(root.querySelector('[data-prx-readout="minimum-risk"]').dataset.num,'7/40');
 const dual=root.querySelector('[data-card="p:1,2|1,2"]');dual.focus();
 dual.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
 assert.equal(handle.state.candidate,'p:1,1|1,2');assert.equal(dom.window.document.activeElement.dataset.card,handle.state.candidate);
 assert.equal(root.querySelector('[data-prx-readout="ratio-0"]').dataset.num,'NA');
 assert.equal(root.querySelectorAll('.mdp-card.mdp-optimal').length,reference(0).expected.fit.optimizerIds.length);
 handle.applyPreset('boundary');assert.deepEqual(handle.state,{couplingIndex:5,candidate:'p:1,2|1,2'});
 assert.equal(root.querySelector('[data-prx-readout="dual-J"]').dataset.num,'3/20');
 assert.equal(root.querySelector('[data-prx-readout="focused-status"]').textContent,'Feasible');
 handle.destroy();dom.window.close();
});
test('P.3 all candidate controls show the corresponding reference rows and scope',()=>{
 const {dom,root,handle}=mount();
 for(const i of [0,1,4,5,6,10]){
  const f=reference(i);
  for(const card of f.expected.fixedCards){
   handle.update({couplingIndex:i,candidate:card.cardId});
   assert.equal(root.querySelector('[data-prx-readout="focused-risk"]').dataset.num,card.evaluation.riskExact);
   assert.equal(root.querySelector('[data-prx-readout="focused-J"]').dataset.num,card.evaluation.jointProbabilityExact);
   assert.equal(root.querySelector('[data-prx-readout="focused-status"]').textContent,card.evaluation.feasible?'Feasible':'Infeasible');
   assert.equal(root.querySelector('[data-prx-readout="feasible-count"]').dataset.num,String(f.expected.fit.candidateTable.filter(r=>r.feasible).length));
   assert.equal(root.querySelectorAll('.mdp-card[aria-pressed="true"]').length,1);
   for(const id of f.expected.fit.optimizerIds)assert.ok(root.textContent.includes(id));
  }
 }
 handle.destroy();dom.window.close();
});
