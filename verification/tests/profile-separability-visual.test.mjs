// Author: JoonHo Lee (jlee296@ua.edu).
// Independent public R fixture records define the displayed feasible set and exact optima.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWindow} from '../dom-env.mjs';
import {numberFindings,badTokenFindings,displayFindings} from '../dom_rules.mjs';
import {mountWidget,PROFILE_SEPARABILITY_KEYS} from '../../js/apps/profile-separability.js';
const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url)));
const reference=state=>read(`verification/golden/v35/separable-${{0:'disjoint',1:'independent',10:'coincident'}[state.couplingIndex]}-${state.zeroWeight?'one-zero':'equal'}-guard-${state.protected?'on':'off'}.json`);
const views=read('verification/golden/postrank-v35-profile-views.json');
const cases=[0,1,10].flatMap(couplingIndex=>[false,true].flatMap(zeroWeight=>[false,true].map(protectedMode=>({couplingIndex,zeroWeight,protected:protectedMode}))));
function mount(query='') {const m=makeWindow({plot:false,query}),handle=mountWidget(m.el);return{...m,handle,close(){handle.destroy();m.restore();}};}
for(const state of cases)test(`P.2 lattice uses independent feasible projections, weighted minima and all optima: ${JSON.stringify(state)}`,()=>{
 const m=mount();try{
  m.handle.update(state);const f=reference(state),root=m.el,svg=root.querySelector('[data-mdv-graphic]'),rows=f.expected.fit.candidateTable;
  assert.equal(svg.getAttribute('role'),'group');assert.equal(svg.getAttribute('height'),'364');
  const marks=[...svg.querySelectorAll('[data-mdv-role="candidate"]')];assert.equal(marks.length,9);
  assert.deepEqual(marks.filter(n=>n.dataset.mdvFeasible==='true').map(n=>n.dataset.mdvCandidate).sort(),rows.filter(r=>r.feasible).map(r=>r.candidateId).sort());
  assert.deepEqual(marks.filter(n=>n.dataset.mdvOptimal==='true').map(n=>n.dataset.mdvCandidate).sort(),[...f.expected.fit.optimizerIds].sort());
  assert.equal(marks.filter(n=>n.dataset.mdvCanonical==='true').length,1);assert.equal(marks.find(n=>n.dataset.mdvCanonical==='true').dataset.mdvCandidate,f.expected.fit.selectedId);
  const name=`separable-${{0:'disjoint',1:'independent',10:'coincident'}[state.couplingIndex]}-${state.zeroWeight?'one-zero':'equal'}-guard-${state.protected?'on':'off'}`,expected=views.rows.find(r=>r.id===name).expect;
  assert.deepEqual(marks.filter(n=>n.dataset.mdvProjected==='true').map(n=>n.dataset.mdvCandidate).sort(),[...expected.projectionProductIds].sort());
  assert.deepEqual(marks.filter(n=>n.dataset.mdvMissing==='true').map(n=>n.dataset.mdvCandidate).sort(),[...expected.missingIds].sort());
  for(const [d,domain] of ['S','C'].entries())assert.deepEqual([...svg.querySelectorAll(`[data-mdv-role="weighted-minimum-band"][data-mdv-domain="${domain}"]`)].map(n=>n.dataset.mdvColumn),expected.weightedArgminColumns[d]);
  assert.equal(svg.querySelector('[data-mdv-role="separate-bound"]').dataset.num,expected.boundExact);assert.equal(svg.querySelector('[data-mdv-role="feasible-minimum"]').dataset.num,expected.actualRiskExact);
  const summary=root.querySelector('.prx-readout').textContent;
  if(expected.factorizes)assert.match(summary,/recover every optimum/);else if(expected.lowerBoundAttained)assert.match(summary,/bound is attained/);else assert.match(summary,/changes the optimum/);
  assert.equal(root.querySelectorAll('[data-prx-part="controls"] input, [data-prx-part="controls"] button').length,1);
  assert.deepEqual([...root.querySelectorAll('[data-mdv-details]')].map(n=>n.open),[false,false]);assert.equal(root.querySelectorAll('[data-mdv-details="data"] table').length,7);
  assert.deepEqual(numberFindings(root),[]);assert.deepEqual(badTokenFindings(root),[]);assert.deepEqual(displayFindings(root),[]);
 }finally{m.close();}
});
test('P.2 queryless visual default is the existing independent guarded setting; explicit complete presets retain their laws',()=>{
 assert.equal(PROFILE_SEPARABILITY_KEYS.couplingIndex.value,1);assert.equal(PROFILE_SEPARABILITY_KEYS.protected.value,true);
 const m=mount();try{assert.deepEqual(m.handle.state,{couplingIndex:1,zeroWeight:false,protected:true,candidate:'p:1,2|1,2'});assert.equal(m.el.querySelector('[data-mdv-role="feasible-minimum"]').dataset.num,'7/40');
  const entry=read('catalog/entries/P.2-profile-separability.json');for(const preset of entry.presets){m.handle.applyPreset(preset.id);const q=new URLSearchParams(preset.query);assert.equal(m.handle.state.couplingIndex,Number(q.get('couplingIndex')));assert.equal(m.handle.state.protected,q.get('protected')==='true');assert.equal(m.handle.state.zeroWeight,q.get('zeroWeight')==='true');}
 }finally{m.close();}
});
test('P.2 plotted inspection and arrow keys change no fitted scientific quantity',()=>{
 const m=mount();try{const root=m.el,before=root.querySelector('[data-mdv-role="feasible-minimum"]').dataset.num,first=root.querySelector('[data-mdv-role="candidate"][tabindex="0"]');assert.equal(first.dataset.mdvCandidate,'p:1,2|1,2');first.dispatchEvent(new m.win.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.equal(m.handle.state.candidate,'p:1,1|1,2');assert.equal(root.querySelectorAll('[data-mdv-role="candidate"][tabindex="0"]').length,1);
  root.querySelector('[data-mdv-candidate="p:2,1|2,1"]').dispatchEvent(new m.win.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(m.handle.state.candidate,'p:2,1|2,1');assert.match(root.querySelector('[data-mds-visual-inspector]').textContent,/B ahead/);assert.equal(root.querySelector('[data-mdv-role="feasible-minimum"]').dataset.num,before);assert.equal(root.querySelector('[data-mdv-details="data"]').open,false);
  m.handle.update({zeroWeight:true});assert.match(root.querySelector('.prx-readout').textContent,/bound is attained/);assert.equal(root.querySelector('[data-mdv-role="candidate"][data-mdv-missing="true"]').dataset.mdvFeasible,'false');
 }finally{m.close();}
});
