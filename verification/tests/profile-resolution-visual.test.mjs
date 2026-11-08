// Author: JoonHo Lee (jlee296@ua.edu).
// Frozen public-R fixtures determine the marks; coordinates never determine the decision.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWindow} from '../dom-env.mjs';
import {mountWidget} from '../../js/apps/profile-resolution.js';

const fixture=(k,a)=>JSON.parse(readFileSync(new URL(`../golden/v35/resolution-k${k}-a${a}.json`,import.meta.url)));
const value=raw=>{const[n,d='1']=raw.split('/');return Number(n)/Number(d);};
const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,`${label}: ${actual} should equal ${expected}`);
function mount(query='',width){
 const m=makeWindow({query,plot:true});
 if(width!==undefined)m.win.HTMLElement.prototype.getBoundingClientRect=function(){return{x:0,y:0,left:0,top:0,right:width,bottom:0,width,height:0,toJSON(){return this;}};};
 const handle=mountWidget(m.el);return{...m,handle,close(){handle.destroy();m.restore();}};
}
for(let k=0;k<=2;k++)for(let a=0;a<=6;a++)test(`P.4 visual k${k} budget${a}: independent R values determine all seven loss points, grade lanes and optima`,()=>{
 const m=mount(`?noiseIndex=${k}&budgetIndex=${a}`);try{
  const svg=m.el.querySelector('[data-mdv-graphic]'),left=Number(svg.dataset.prrAlphaLeft),span=Number(svg.dataset.prrAlphaWidth),top=Number(svg.dataset.prrRiskTop),bottom=Number(svg.dataset.prrRiskBottom);
  assert.equal(svg.dataset.prrAlphaMax,'3/20');assert.equal(svg.dataset.prrRiskMax,'1/4');
  const riskPoints=[...svg.querySelectorAll('[data-mdv-role=risk-point]')],gradePoints=[...svg.querySelectorAll('[data-mdv-role=grade-count-point]')];
  assert.equal(riskPoints.length,7);assert.equal(gradePoints.length,14);assert.equal(svg.querySelectorAll('polyline').length,0);
  for(let index=0;index<=6;index++){
   const f=fixture(k,index),fit=f.expected.fit,selected=fit.candidateTable.find(row=>row.selected),point=riskPoints.find(n=>n.dataset.mdvBudgetIndex===String(index));
   assert.equal(point.dataset.mdvAlpha,f.decision.alpha);assert.equal(point.dataset.mdvExact,fit.riskExact);assert.equal(point.dataset.mdvSelected,String(index===a));
   near(Number(point.getAttribute('cx')),left+value(f.decision.alpha)/value('3/20')*span,'Actual alpha coordinate');
   near(Number(point.getAttribute('cy')),bottom-value(fit.riskExact)/value('1/4')*(bottom-top),'Risk on zero-based shared axis');
   const counts=gradePoints.filter(n=>n.dataset.mdvBudgetIndex===String(index));
   for(let d=0;d<2;d++){
    const mark=counts.find(n=>n.dataset.mdvDomain===['S','C'][d]);assert.equal(mark.dataset.mdvExact,String(selected.gradeCounts[d]));assert.equal(mark.dataset.mdvCanonical,fit.selectedId);assert.equal(mark.dataset.mdvAlpha,f.decision.alpha);
    const expectedY=d===0?(selected.gradeCounts[d]===2?218:246):(selected.gradeCounts[d]===2?286:314);
    if(d===0){near(Number(mark.getAttribute('x'))+5,Number(point.getAttribute('cx')),'S shared budget');near(Number(mark.getAttribute('y'))+5,expectedY,'S grade rung');}
    else assert.equal(mark.getAttribute('d'),`M${Number(point.getAttribute('cx'))},${expectedY-6}l6,6l-6,6l-6,-6Z`);
   }
   const tick=svg.querySelector(`[data-mdv-role=budget-tick][data-mdv-budget-index="${index}"]`);assert.equal(tick.dataset.num,f.decision.alpha);assert.equal(tick.dataset.prxExactStyle,'percent');assert.equal(tick.dataset.prxExactDigits,['0','1/20','1/10','3/20'].includes(f.decision.alpha)?'0':'1');assert.equal(tick.textContent,{'0':'0%','1/40':'2.5%','1/20':'5%','3/40':'7.5%','1/10':'10%','1/8':'12.5%','3/20':'15%'}[f.decision.alpha]);
  }
  const current=fixture(k,a),fit=current.expected.fit,selection=svg.querySelector('[data-mdv-role=budget-selection]');assert.equal(selection.dataset.mdvAlpha,current.decision.alpha);near(Number(selection.getAttribute('x1')),Number(riskPoints[a].getAttribute('cx')),'Shared selection line');
  const glyphs=[...m.el.querySelectorAll('[data-prr-optimizer]')];assert.deepEqual(glyphs.map(n=>n.dataset.prrOptimizer),fit.optimizerIds);assert.deepEqual(glyphs.filter(n=>n.dataset.prrCanonical==='true').map(n=>n.dataset.prrOptimizer),[fit.selectedId]);
  assert.equal(svg.querySelector('[data-mdv-role=selected-risk]').dataset.num,fit.riskExact);
 }finally{m.close();}
});
test('P.4 native frame keeps one exact-alpha control and complete original alternatives',()=>{
 const m=mount();try{
  const controls=m.el.querySelector('[data-prx-part=controls]'),settings=m.el.querySelector('[data-mdv-details=settings]'),data=m.el.querySelector('[data-mdv-details=data]');
  assert.equal(controls.querySelectorAll('input,button,select').length,1);assert.equal(controls.querySelector('label').textContent,'Joint error cap');assert.equal(settings.open,false);assert.equal(data.open,false);
  assert.equal(settings.querySelectorAll('select').length,1);assert.equal(m.el.querySelector('.mdv-toolbar .prx-presets').nextElementSibling,settings);assert.equal(data.querySelectorAll('select').length,1);
  for(const table of m.el.querySelectorAll('table'))assert.equal(table.closest('details'),data);
  assert.equal(m.el.querySelector('.prx-value [data-num]').dataset.num,'3/40');assert.equal(m.el.querySelector('.prx-value [data-num]').textContent,'7.5%');
  assert.equal(controls.querySelector('input').getAttribute('aria-valuetext'),'7.5%');assert.equal(controls.querySelector('.prx-value').hasAttribute('data-num'),false);
  for(let i=0;i<7;i++)assert.ok(data.querySelector(`[data-prx-readout="path-${i}-risk"]`));
  assert.ok(data.querySelector('[data-prx-readout=focused-ratio-0]'));assert.ok(data.querySelector('[data-prx-readout=focused-ratio-1]'));
 }finally{m.close();}
});
test('P.4 grade tracks show actual S loss of detail as the larger budget lowers expected loss',()=>{
 const m=mount('?noiseIndex=1&budgetIndex=3');try{
  const raw=(index,d)=>m.el.querySelector(`[data-mdv-role=grade-count-point][data-mdv-budget-index="${index}"][data-mdv-domain="${d}"]`).dataset.mdvExact;
  assert.deepEqual([raw(3,'S'),raw(3,'C')],['2','1']);assert.deepEqual([raw(5,'S'),raw(5,'C')],['1','2']);assert.deepEqual([raw(6,'S'),raw(6,'C')],['2','2']);
  const svg=m.el.querySelector('[data-mdv-graphic]');assert.ok(svg.textContent.includes('Canonical occupied grades'));assert.ok(svg.textContent.includes('Joint error cap'));
 }finally{m.close();}
});
test('P.4 point keyboard updates the snapped grid and inspection cannot replace the canonical path',()=>{
 const m=mount();try{
  let point=m.el.querySelector('[data-prx-focus-key="budget-track:3"]');point.dispatchEvent(new m.win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(m.handle.state.budgetIndex,4);assert.equal(m.handle.state.candidate,'canonical');
  point=m.el.querySelector('[data-prx-focus-key="budget-track:4"]');point.dispatchEvent(new m.win.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(m.handle.state.budgetIndex,6);
  const before=[...m.el.querySelectorAll('[data-mdv-role=risk-point]')].map(n=>[n.dataset.mdvAlpha,n.dataset.mdvExact,n.getAttribute('cy')]);m.handle.update({candidate:'p:1,1|1,1'});assert.deepEqual([...m.el.querySelectorAll('[data-mdv-role=risk-point]')].map(n=>[n.dataset.mdvAlpha,n.dataset.mdvExact,n.getAttribute('cy')]),before);
  m.el.querySelector('[data-prr-optimizer]').click();assert.equal(m.el.querySelector('[data-mdv-details=data]').open,false);assert.equal(m.el.querySelector('[data-prr-visual-inspector] [data-num]').dataset.num,fixture(1,6).expected.fit.riskExact);assert.equal(m.handle.state.candidate,fixture(1,6).expected.fit.selectedId);
 }finally{m.close();}
});
test('P.4 narrow zero-risk scene keeps actual physical width and the zero baseline',()=>{
 const m=mount('?noiseIndex=0&budgetIndex=0',330);try{
  const svg=m.el.querySelector('[data-mdv-graphic]');assert.equal(svg.getAttribute('width'),'330');assert.equal(svg.getAttribute('height'),'384');assert.ok([...svg.querySelectorAll('text')].every(n=>Number(n.getAttribute('font-size'))>=15));
  for(const point of svg.querySelectorAll('[data-mdv-role=risk-point]')){assert.equal(point.dataset.mdvExact,'0');assert.equal(point.getAttribute('cy'),svg.dataset.prrRiskBottom);}
  assert.ok(svg.querySelector('[data-num="1/4"]'));assert.ok(svg.querySelector('[data-num="0"]'));
 }finally{m.close();}
});
