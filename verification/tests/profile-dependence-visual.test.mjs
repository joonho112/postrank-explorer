// Author: JoonHo Lee (jlee296@ua.edu).
// Graphic expectations come from the frozen independent public-R fixtures.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {mountWidget} from '../../js/apps/profile-dependence.js';

const require=createRequire(new URL('../../tools/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const STORY='p:1,2|1,2';
const reference=index=>JSON.parse(readFileSync(new URL(`../golden/v35-pilot/dependence-c${index}.json`,import.meta.url)));
const coordinate=raw=>{const[n,d='1']=raw.split('/');return Number(n)/Number(d);};

function mount(query='',width){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'https://example.test/',pretendToBeVisual:true});
 if(width!==undefined){
  // jsdom does not lay out CSS. Supply the stage's physical width to exercise
  // coordinate/font construction, without claiming a real responsive audit.
  dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return{x:0,y:0,left:0,top:0,right:width,bottom:0,width,height:0,toJSON(){return this;}};};
 }
 dom.window.__PRX_QUERY=query;
 const root=dom.window.document.getElementById('app'),handle=mountWidget(root);
 return{dom,root,handle,cleanup(){handle.destroy();dom.window.close();}};
}

function close(actual,expected,label){
 assert.ok(Number.isFinite(actual),`${label} is a finite SVG coordinate`);
 assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} should equal ${expected}`);
}
function numberAttribute(node,name){assert.ok(node,`Missing ${name} mark`);return Number(node.getAttribute(name));}
function mark(svg,name){const node=svg.querySelector(`[data-mdp-mark="${name}"]`);assert.ok(node,`Missing ${name} mark`);return node;}

function fixtureEvents(fixture){
 const dual=fixture.expected.fixedCards.find(card=>card.cardId===STORY).evaluation;
 const sOnly=dual.states.findIndex(row=>row.exceedances[0]&&!row.exceedances[1]);
 const both=dual.states.findIndex(row=>row.exceedances[0]&&row.exceedances[1]);
 assert.ok(sOnly>=0&&both>=0,'Complete fixture retains S-only and overlapping states, including zero masses');
 return{dual,sOnly:fixture.input.masses[sOnly],overlap:fixture.input.masses[both]};
}

for(let index=0;index<=10;index++)test(`P.3 visual coupling ${index}: fixture events determine strip geometry and all optimum glyphs`,()=>{
 const m=mount();try{
  m.handle.update({couplingIndex:index,candidate:STORY});
  const f=reference(index),events=fixtureEvents(f),stage=m.root.querySelector('[data-mdv-stage]'),svg=stage.querySelector('svg');
  assert.equal(stage.querySelector('[data-mdp-story-candidate]')?.dataset.mdpStoryCandidate,STORY);
  assert.equal(svg.dataset.mdpScaleMax,'1/5');
  const left=Number(svg.dataset.mdpScaleLeft),span=Number(svg.dataset.mdpScaleWidth),scale=coordinate(svg.dataset.mdpScaleMax);
  assert.ok(Number.isFinite(left)&&span>0,'The graphic declares its physical probability axis');
  const x=raw=>left+coordinate(raw)/scale*span,w=raw=>coordinate(raw)/scale*span;
  const s=mark(svg,'marginal-S'),c=mark(svg,'marginal-C'),overlap=mark(svg,'overlap'),union=mark(svg,'union'),cap=mark(svg,'cap');
  assert.equal(s.dataset.exact,events.dual.domains[0].eventProbabilityExact);
  assert.equal(c.dataset.exact,events.dual.domains[1].eventProbabilityExact);
  assert.equal(overlap.dataset.exact,events.overlap);
  assert.equal(union.dataset.exact,events.dual.jointProbabilityExact);
  assert.equal(cap.dataset.exact,f.decision.alpha);
  close(numberAttribute(s,'x'),left,'S starts at zero');
  close(numberAttribute(s,'width'),w(events.dual.domains[0].eventProbabilityExact),'S marginal length');
  close(numberAttribute(c,'x'),x(events.sOnly),'C offset comes from S-only state mass');
  close(numberAttribute(c,'width'),w(events.dual.domains[1].eventProbabilityExact),'C marginal length');
  close(numberAttribute(overlap,'x'),x(events.sOnly),'Overlap starts at C offset');
  close(numberAttribute(overlap,'width'),w(events.overlap),'Overlap length comes from joint state mass');
  close(numberAttribute(union,'x'),left,'Union starts at zero');
  close(numberAttribute(union,'width'),w(events.dual.jointProbabilityExact),'Union counts overlapping failure once');
  close(numberAttribute(cap,'x1'),x(f.decision.alpha),'Cap shares the probability axis');
  close(numberAttribute(cap,'x2'),x(f.decision.alpha),'Cap is vertical');
  assert.deepEqual([...stage.querySelectorAll('[data-mdp-optimizer]')].map(node=>node.dataset.mdpOptimizer).sort(),[...f.expected.fit.optimizerIds].sort());
  assert.equal(stage.querySelectorAll('table').length,0,'The main story is a graphic, not the old nine-card table');
 }finally{m.cleanup();}
});

test('P.3 cap boundary is inclusive: c4 excludes the double-positive report, c5 and c6 admit it',()=>{
 const m=mount();try{
  for(const[index,relation]of [[4,1],[5,0],[6,-1]]){
   m.handle.update({couplingIndex:index,candidate:STORY});
   const f=reference(index),svg=m.root.querySelector('[data-mdv-stage] svg'),union=mark(svg,'union'),cap=mark(svg,'cap');
   const end=numberAttribute(union,'x')+numberAttribute(union,'width'),capX=numberAttribute(cap,'x1');
   if(relation===0)close(end,capX,'Equality at c5');else assert.equal(Math.sign(end-capX),relation);
   const ids=[...m.root.querySelectorAll('[data-mdp-optimizer]')].map(node=>node.dataset.mdpOptimizer);
   assert.equal(ids.includes(STORY),f.expected.fit.optimizerIds.includes(STORY));
   assert.equal(ids.length,index===4?2:1);
  }
 }finally{m.cleanup();}
});

test('P.3 candidate inspection cannot change the fixed double-positive story',()=>{
 const m=mount('?preset=independent');try{
  const geometry=()=>{const svg=m.root.querySelector('[data-mdv-stage] svg');return ['marginal-S','marginal-C','overlap','union','cap'].map(name=>{const node=mark(svg,name);return[name,...['x','width','x1','x2','data-exact'].map(attr=>node.getAttribute(attr))];});};
  const before=geometry(),f=reference(1);
  for(const card of f.expected.fixedCards){
   m.handle.update({candidate:card.cardId});
   assert.deepEqual(geometry(),before);
   assert.equal(m.root.querySelector('[data-prx-readout="focused-J"]').dataset.num,card.evaluation.jointProbabilityExact);
  }
 }finally{m.cleanup();}
});

test('P.3 first view has one exact overlap slider and closed native settings/data alternatives',()=>{
 const m=mount();try{
  const controls=m.root.querySelector('[data-prx-part="controls"]'),range=controls.querySelector('input[type="range"]');
  assert.ok(range);assert.equal(range.min,'0');assert.equal(range.max,'10');assert.equal(range.step,'1');
  assert.equal(range.closest('.prx-slider').querySelector('label').textContent,'Error overlap');
  assert.equal(controls.querySelectorAll('input,select').length,1);
  const settings=m.root.querySelector('details[data-mdv-details="settings"]'),data=m.root.querySelector('details[data-mdv-details="data"]');
  assert.ok(settings&&data);assert.equal(settings.open,false);assert.equal(data.open,false);
  assert.equal(m.root.querySelector('.mdv-toolbar [data-prx-part="presets"]').nextElementSibling,settings);
  assert.ok(data.querySelector('select'),'Candidate inspection remains separate inside Data');
  for(const table of m.root.querySelectorAll('table'))assert.equal(table.closest('details'),data);
  for(let index=0;index<=10;index++){
   m.handle.update({couplingIndex:index});
   const face=range.closest('.prx-slider').querySelector('output [data-prx-format="mdomain-exact"]');
   assert.equal(face?.dataset.num,fixtureEvents(reference(index)).overlap);
   assert.equal(face?.textContent,`${index}%`);
   assert.equal(range.getAttribute('aria-valuetext'),`${index}%`);
  }
  m.handle.update({couplingIndex:0});
  const button=m.root.querySelector('[data-mdp-optimizer]');button.click();
  assert.equal(data.open,false,'An optimum glyph leaves Data closed');
  assert.ok(m.root.querySelector('[data-mdp-card-inspector] [data-num]'));
  assert.equal(m.handle.state.candidate,button.dataset.mdpOptimizer);
  assert.ok(data.querySelector('[data-prx-readout="focused-risk"]'));
  assert.ok(data.querySelector('[data-prx-readout="focused-J"]'));
  assert.equal(data.querySelectorAll('[data-prx-mdomain-candidate]').length,9);
 }finally{m.cleanup();}
});

test('P.3 uses the supplied narrow physical stage width and readable SVG text',()=>{
 const m=mount('',330);try{
  const svg=m.root.querySelector('[data-mdv-stage] svg');
  assert.equal(Number(svg.getAttribute('width')),330);
  assert.equal(Number(svg.getAttribute('viewBox').split(/\s+/)[2]),330);
  assert.ok(Number(svg.getAttribute('height'))>=260);
  for(const text of svg.querySelectorAll('text'))assert.ok(Number(text.getAttribute('font-size'))>=14,'Each mobile SVG label has at least 14px authored text');
 }finally{m.cleanup();}
});
