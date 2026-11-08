// Author: JoonHo Lee (jlee296@ua.edu).
// The frozen independent public-R results determine every displayed report and loss.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {mountWidget} from '../../js/apps/profile-common-vs-domain.js';
const require=createRequire(new URL('../../tools/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const references=JSON.parse(readFileSync(new URL('../golden/postrank-v35-profile-views.json',import.meta.url))).rows.filter(row=>row.args.kind==='common');
const fixture=id=>JSON.parse(readFileSync(new URL(`../golden/v35/${id}.json`,import.meta.url)));
const coordinate=raw=>{const[n,d='1']=raw.split('/');return Number(n)/Number(d);};
function mount(query='',width){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'https://example.test/',pretendToBeVisual:true});dom.window.__PRX_QUERY=query;
 if(width!==undefined)dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return{x:0,y:0,left:0,top:0,right:width,bottom:0,width,height:0,toJSON(){return this;}};};
 const root=dom.window.document.getElementById('app'),handle=mountWidget(root);return{dom,root,handle,close(){handle.destroy();dom.window.close();}};
}
function close(actual,expected,label){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,`${label}: ${actual} should equal ${expected}`);}
for(const reference of references)test(`P.1 ${reference.id}: independent R minima determine the shared loss axis, canonical grade rungs and all optima`,()=>{
 const m=mount();try{
  m.handle.update({...reference.args,report:'profile',candidate:'canonical',unit:'A'});
  const f=fixture(reference.id),svg=m.root.querySelector('[data-mdv-graphic]'),stage=m.root.querySelector('[data-mdv-stage]'),common=f.expected.comparisons[0],profile=f.expected.fit;
  const left=Number(svg.dataset.pcdLossLeft),span=Number(svg.dataset.pcdLossWidth),max=coordinate(svg.dataset.pcdLossMax);
  assert.equal(svg.dataset.pcdLossMax,'1/4');
  for(const[family,comparison]of [['common',common],['profile',profile]]){
   const mark=svg.querySelector(`[data-mdv-role="${family}-loss"]`);assert.ok(mark);assert.equal(mark.dataset.mdvExact,comparison.riskExact);
   close(Number(mark.getAttribute('x')),left,'Shared zero baseline');close(Number(mark.getAttribute('width')),coordinate(comparison.riskExact)/max*span,'Loss width');
   const expected=f.expected.fit.candidateTable.find(row=>row.candidateId===comparison.selectedId).grades;
   const grades=[...svg.querySelectorAll(`[data-mdv-role="${family}-grade"]`)];assert.equal(grades.length,4);
   for(const mark of grades){
    const u=['A','B'].indexOf(mark.dataset.mdvUnit),d=['S','C'].indexOf(mark.dataset.mdvDomain),grade=expected.values[u][d];assert.equal(mark.dataset.mdvExact,String(grade));assert.equal(mark.dataset.pcdCanonical,comparison.selectedId);
    const actualY=mark.tagName==='circle'?Number(mark.getAttribute('cy')):Number(mark.getAttribute('y'))+11.5;close(actualY,grade===1?105:167,'Grade coordinate');
   }
   const glyphs=[...stage.querySelectorAll(`[data-pcd-family="${family}"]`)];assert.deepEqual(glyphs.map(n=>n.dataset.pcdOptimizer),comparison.optimizerIds);
   assert.deepEqual(glyphs.filter(n=>n.dataset.pcdCanonical==='true').map(n=>n.dataset.pcdOptimizer),[comparison.selectedId]);
  }
  assert.equal(stage.querySelectorAll('table').length,0);
 }finally{m.close();}
});
test('P.1 boundary retains all four profile ties and clicking a glyph inspects in place',()=>{
 const m=mount('?law=crossed&tauIndex=1&weightIndex=0');try{
  const ref=fixture('common-crossed-boundary-equal'),ids=ref.expected.fit.optimizerIds;
  assert.equal(ids.length,4);assert.equal(m.root.querySelectorAll('[data-pcd-family=profile]').length,4);
  const canonicalGrades=()=>[...m.root.querySelectorAll('[data-mdv-role=profile-grade]')].map(n=>[n.dataset.mdvUnit,n.dataset.mdvDomain,n.dataset.mdvExact]);
  const before=canonicalGrades();
  for(const id of ids){m.root.querySelector(`[data-pcd-family=profile][data-mdv-report-id="${id}"]`).click();assert.equal(m.handle.state.candidate,id);assert.equal(m.handle.state.report,'profile');assert.equal(m.root.querySelector('[data-mdv-details=data]').open,false);assert.equal(m.root.querySelector('[data-pcd-visual-inspector] [data-num]').dataset.num,'1/10');assert.equal(m.root.querySelector('[data-prx-readout=inspected-risk]').dataset.num,'1/10');assert.deepEqual(canonicalGrades(),before);}
  const keys=[...m.root.querySelectorAll('[data-pcd-family]')].map(n=>n.dataset.prxFocusKey);assert.equal(new Set(keys).size,keys.length,'Common and profile IDs have separate focus namespaces');
 }finally{m.close();}
});
test('P.1 native disclosures preserve old numerical alternatives and only the pattern selector stays primary',()=>{
 const m=mount();try{
  const controls=m.root.querySelector('[data-prx-part=controls]');assert.equal(controls.querySelectorAll('input,select,button').length,1);assert.equal(controls.querySelector('label').textContent,'Priority pattern');
  const settings=m.root.querySelector('[data-mdv-details=settings]'),data=m.root.querySelector('[data-mdv-details=data]');assert.equal(settings.open,false);assert.equal(data.open,false);assert.equal(settings.querySelectorAll('select').length,2);assert.equal(m.root.querySelector('.mdv-toolbar .prx-presets').nextElementSibling,settings);assert.equal(data.querySelectorAll('select').length,3);
  for(const table of m.root.querySelectorAll('table'))assert.equal(table.closest('details'),data);
  assert.ok(data.querySelector('[data-prx-readout=common-risk]'));assert.ok(data.querySelector('[data-prx-readout=profile-risk]'));assert.ok(data.querySelector('[data-prx-readout=risk-gap]'));assert.match(m.root.querySelector('.prx-readout').textContent,/expected loss/);
  const visible=()=>[...m.root.querySelectorAll('[data-mdv-role$="-loss"]')].map(n=>[n.dataset.mdvRole,n.dataset.mdvExact,n.getAttribute('width')]);const before=visible();
  m.handle.update({report:'common',candidate:'p:1,2|1,2',unit:'B'});assert.deepEqual(visible(),before,'Inspecting a non-optimal candidate cannot replace the main canonical comparison');
 }finally{m.close();}
});
test('P.1 narrow stage uses physical width and readable exact grade/loss labels',()=>{
 const m=mount('',330);try{
  const svg=m.root.querySelector('[data-mdv-graphic]');assert.equal(svg.getAttribute('width'),'330');assert.equal(svg.getAttribute('height'),'340');assert.ok([...svg.querySelectorAll('text')].every(n=>Number(n.getAttribute('font-size'))>=15));
  assert.ok(svg.textContent.includes('Expected loss'));assert.ok(svg.querySelector('[data-num="1/4"]'));assert.ok(svg.querySelector('[data-num="0"]'));
 }finally{m.close();}
});
