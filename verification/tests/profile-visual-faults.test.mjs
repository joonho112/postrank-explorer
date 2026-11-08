// Author: JoonHo Lee (jlee296@ua.edu).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeWindow} from '../dom-env.mjs';
import {mountWidget as commonMount} from '../../js/apps/profile-common-vs-domain.js';
import {mountWidget as separabilityMount} from '../../js/apps/profile-separability.js';
import {mountWidget as resolutionMount} from '../../js/apps/profile-resolution.js';
import {mountWidget as dependenceMount} from '../../js/apps/profile-dependence.js';
import {mountWidget as fictionalMount} from '../../js/apps/fictional-site-profiles.js';
import {commonCases,separabilityCases,frozenFixture,resolutionFixture,dependenceFixture,fictionalReference,savedPayloadPairs,extractProfileVisualModel,commonVisualFindings,separabilityVisualFindings,resolutionVisualFindings,dependenceVisualFindings,fictionalVisualFindings,visualSurfaceFindings} from '../profile_visual_rules.mjs';

function mount(fn,query=''){const env=makeWindow({plot:fn===resolutionMount,query}),handle=fn(env.el);return {...env,handle,model:()=>extractProfileVisualModel(env.el),close(){handle.destroy();env.restore();}};}
const expectFault=(findings,code)=>assert.ok(findings.some(f=>f.code===code),`Expected ${code}; got ${JSON.stringify(findings)}`);

test('independent visual contract validates every P.1 law, threshold, weight and complete optimum set',()=>{
 const m=mount(commonMount);try{for(const row of commonCases){m.handle.update(row.args);assert.deepEqual(commonVisualFindings(m.model(),frozenFixture(row.id)),[],row.id);}}finally{m.close();}
});
test('independent visual contract validates all P.2 protection and zero-weight cases and all three conclusions',()=>{
 const m=mount(separabilityMount),conclusions=new Set();try{for(const row of separabilityCases){m.handle.update(row.args);assert.deepEqual(separabilityVisualFindings(m.model(),frozenFixture(row.id),row),[],row.id);conclusions.add(row.expect.factorizes?'factorized':row.expect.lowerBoundAttained?'attained':'changed');}assert.deepEqual([...conclusions].sort(),['attained','changed','factorized']);}finally{m.close();}
});
test('independent visual contract validates all three P.4 laws and seven actual budget coordinates',()=>{
 const m=mount(resolutionMount);try{for(let law=0;law<3;law++)for(let budget=0;budget<7;budget++){m.handle.update({noiseIndex:law,budgetIndex:budget});assert.deepEqual(resolutionVisualFindings(m.model(),law,budget),[],`law ${law}, budget ${budget}`);}}finally{m.close();}
});
test('P.3 frozen union/cap validator covers all eleven overlap states and rejects planted raw/geometry faults',()=>{
 const m=mount(dependenceMount);try{for(let index=0;index<=10;index++){m.handle.update({couplingIndex:index});assert.deepEqual(dependenceVisualFindings(m.model(),dependenceFixture(index)),[]);}
  for(const[selector,attribute,value,code]of [
   ['[data-mdv-role=union]','data-mdv-exact','1/2','dependence-raw'],
   ['[data-mdv-role=union]','width','2','dependence-geometry'],
   ['[data-mdv-role=cap]','data-mdv-exact','1/10','dependence-cap-raw'],
   ['[data-mdv-role=cap]','x1','2','dependence-cap-geometry']
  ]){m.handle.update({couplingIndex:0});m.el.querySelector(selector).setAttribute(attribute,value);expectFault(dependenceVisualFindings(m.model(),dependenceFixture(0)),code);}
 }finally{m.close();}
});
for(const scenario of ['primary','wide'])test(`P.5 ${scenario}: original 40 tuples, exact cells and all 780 frozen pair directions`,()=>{
 const {reference,payload}=fictionalReference(scenario),pairs=savedPayloadPairs(payload);
 assert.equal(pairs.length,780);assert.deepEqual(pairs,reference.pairs.map(({unitA,unitB,directions,classification})=>({unitA,unitB,directions,classification})));
 const m=mount(fictionalMount,`?scenario=${scenario}`);try{
  assert.deepEqual(fictionalVisualFindings(m.model(),scenario),[]);
  // Exercise the real renderer for each pair; expected directions come only from saved tuples.
  for(const pair of pairs){const key=`${pair.unitA}|${pair.unitB}`;m.handle.update({pair:key});const model=m.model();assert.deepEqual(fictionalVisualFindings(model,scenario,key),[],key);}
 }finally{m.close();}
});

test('planted actual P.1 faults: raw loss, width, common zero baseline, missing and extra optimizer',()=>{
 const f=frozenFixture('common-crossed-boundary-equal');
 for(const[selector,mutate,code]of [
  ['[data-mdv-role=profile-loss]',n=>n.dataset.mdvExact='1/5','loss-raw'],
  ['[data-mdv-role=profile-loss]',n=>n.setAttribute('width','1'),'loss-width'],
  ['[data-mdv-role=common-loss]',n=>n.setAttribute('x','24'),'loss-baseline'],
  ['[data-pcd-family=profile]',n=>n.remove(),'optimizer-set'],
  ['[data-pcd-family=profile]',n=>n.parentElement.append(n.cloneNode(true)),'optimizer-set'],
  ['[data-mdv-role=profile-grade]',n=>n.setAttribute('cy','140'),'grade-rung']
  ,['[data-mdv-role=profile-grade]',n=>n.setAttribute('r','0'),'grade-glyph-size']
 ]){const m=mount(commonMount,'?law=crossed&tauIndex=1&weightIndex=0');try{assert.deepEqual(commonVisualFindings(m.model(),f),[]);mutate(m.el.querySelector(selector));expectFault(commonVisualFindings(m.model(),f),code);}finally{m.close();}}
});
test('planted actual P.2 faults: wrong feasible projection hole and absent optimal ring',()=>{
 const row=separabilityCases.find(r=>r.args.couplingIndex===1&&r.args.protected&&!r.args.zeroWeight),m=mount(separabilityMount);
 try{m.handle.update(row.args);const f=frozenFixture(row.id);assert.deepEqual(separabilityVisualFindings(m.model(),f,row),[]);m.el.querySelector('[data-mdv-missing=true]').dataset.mdvMissing='false';expectFault(separabilityVisualFindings(m.model(),f,row),'lattice-missing');
  m.handle.update({zeroWeight:true});const zero=separabilityCases.find(r=>r.args.couplingIndex===1&&r.args.protected&&r.args.zeroWeight);m.el.querySelector('[data-mds-optimum]').remove();expectFault(separabilityVisualFindings(m.model(),frozenFixture(zero.id),zero),'lattice-optimum-rings');
 }finally{m.close();}
});
test('planted actual P.4 faults: grade axis, risk point, raw grade count and canonical representative',()=>{
 for(const[selector,mutate,code]of [
  ['[data-mdv-graphic]',n=>n.dataset.prrRiskBottom='154','budget-risk-axis'],
  ['[data-mdv-role=risk-point]',n=>n.setAttribute('cy','100'),'risk-point-coordinate'],
  ['[data-mdv-role=grade-count-point]',n=>n.dataset.mdvExact='3','grade-count-raw'],
  ['line[y1="218"][y2="218"]',n=>n.setAttribute('y1','219'),'grade-axis-geometry'],
  ['[data-mdv-role=risk-point]',n=>n.setAttribute('r','0'),'risk-glyph-size'],
  ['[data-prr-optimizer]',n=>n.dataset.prrCanonical='false','canonical']
 ]){const m=mount(resolutionMount);try{assert.deepEqual(resolutionVisualFindings(m.model(),1,3),[]);mutate(m.el.querySelector(selector));expectFault(resolutionVisualFindings(m.model(),1,3),code);}finally{m.close();}}
});
test('planted actual P.5 faults: missing original ID, invented grade cell, empty cell and reversed arrow',()=>{
 for(const[query,selector,mutate,code]of [
  ['?scenario=wide','[data-mdv-role=site]',n=>n.remove(),'forty-site-ids'],
  ['?scenario=primary','[data-mdv-role=profile-cell]',n=>{const fake=n.cloneNode();fake.dataset.mdvCell='1,2';n.parentNode.append(fake);},'profile-cell-set'],
  ['?scenario=wide','[data-fsp-empty-cell]',n=>n.remove(),'true-empty-cell'],
  ['?scenario=wide','[data-mdv-cell="3,1"]',n=>n.setAttribute('width','0'),'cell-glyph-geometry'],
  ['?scenario=wide','[data-mdv-role=pair-direction][data-mdv-domain=C]',n=>n.dataset.mdvDomain='S','pair-domain-identity'],
  ['?scenario=wide','[data-mdv-role=pair-direction][data-mdv-domain=S]',n=>n.nextElementSibling.setAttribute('d','M0,0L1,1L2,0'),'pair-arrow-geometry']
 ]){const scenario=query.includes('wide')?'wide':'primary',m=mount(fictionalMount,query);try{assert.deepEqual(fictionalVisualFindings(m.model(),scenario),[]);mutate(m.el.querySelector(selector));expectFault(fictionalVisualFindings(m.model(),scenario),code);}finally{m.close();}}
});
test('font 13.6 and shrunken whole tie cards are rejected by the shared actual-model surface validator',()=>{
 const m=mount(commonMount,'?law=crossed&tauIndex=1&weightIndex=0');try{
  assert.deepEqual(visualSurfaceFindings(m.model()),[]);m.el.querySelector('svg text').setAttribute('font-size','13.6');expectFault(visualSurfaceFindings(m.model()),'svg-font-floor');
  const model=m.model();model.hasLayout=true;model.cards[0].box.width=111;model.cards[0].scrollWidth=150;model.cards[0].clientWidth=111;expectFault(visualSurfaceFindings(model),'whole-tie-card-width');expectFault(visualSurfaceFindings(model),'whole-tie-card-overflow');
 }finally{m.close();}
});

test('P.4 actual-label rectangle collisions are rejected independently of font size',()=>{
 const m=mount(resolutionMount);try{const model=m.model();model.hasLayout=true;const ticks=model.svgs.flatMap(s=>s.marks).filter(n=>n.d.mdvRole==='budget-tick').sort((a,b)=>Number(a.d.mdvBudgetIndex)-Number(b.d.mdvBudgetIndex));ticks.forEach((n,i)=>n.box={...n.box,x:100+i*60,width:40});assert.deepEqual(resolutionVisualFindings(model,1,3),[]);ticks[2].box.x=ticks[1].box.x+39;expectFault(resolutionVisualFindings(model,1,3),'budget-tick-overlap');}finally{m.close();}
});
