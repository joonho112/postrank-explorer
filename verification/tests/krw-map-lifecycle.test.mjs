import{test}from'node:test';
import assert from'node:assert/strict';
import{makeWindow,key}from'../dom-env.mjs';
import{createWidget}from'../../js/shared/base.js';
import{readKrwModel,cardAt,drawKrwHeat}from'../../js/shared/krw-model.js';
test('Linked KRW map retains one canvas and reads all cells after repeated state changes',()=>{
 const m=makeWindow();let slot,handle,renders=0;
 try{
  handle=createWidget(m.el,{}, {name:'krw-map-test',keys:{lambda:{type:'number',min:.01,max:1,step:.01,value:.25},stage:{type:'integer',min:1,max:3,value:2}},build(ctx){slot=ctx.h('div');ctx.charts.append(slot);return{render(s){renders++;const model=readKrwModel('race'),card=cardAt(model,s.lambda);drawKrwHeat(ctx,slot,null,model,{grade:card.grade,tau:card.tau,stage:s.stage,highlight:[0,1,2]});}};}});
  assert.equal(slot.querySelectorAll('canvas').length,1);assert.equal(slot.querySelectorAll('.prx-kbd-point').length,1);
  let b=slot.querySelector('.prx-kbd-point');b.focus();key(b,'ArrowRight');key(b,'ArrowDown');const label=b.getAttribute('aria-label');
  for(const patch of [{lambda:.5},{stage:3},{lambda:.75},{stage:2}]){handle.update(patch);assert.equal(slot.querySelectorAll('canvas').length,1);assert.equal(slot.__prxChart.canvases.length,1);assert.equal(slot.querySelectorAll('.prx-kbd-point').length,1);}
  assert.equal(renders,5,'all linked updates rendered before assertions');
  b=slot.querySelector('.prx-kbd-point');assert.equal(m.doc.activeElement,b);assert.ok(b.getAttribute('aria-label').length>0);assert.ok(label.length>0);
  key(b,'End');assert.match(b.getAttribute('aria-label'),/diagonal/);
 }finally{handle?.destroy();m.restore();}
});
