// Author: JoonHo Lee (jlee296@ua.edu).
import{test}from'node:test';import assert from'node:assert/strict';
import{makeWindow}from'../dom-env.mjs';import{createWidget}from'../../js/shared/base.js';import{profileGrid}from'../../js/shared/mdomain/index.js';
test('Profile-grid arrow inspection names both axes, retains empty cells and activates only on request',()=>{
 const env=makeWindow({plot:false});let selected=null;const grades={unitIds:['A','B'],domainIds:['S','C'],values:[[1,2],[2,1]]};
 const h=createWidget(env.el,{}, {name:'profile-grid-keyboard',keys:{},build(ctx){return{render(){ctx.charts.replaceChildren(profileGrid(ctx,grades,{selectedUnit:'A',onSelectCell:cell=>{selected=cell;}}));}};}});
 try{
  const buttons=[...env.el.querySelectorAll('[data-prx-profile-grid-cell]')];assert.equal(buttons.length,4);assert.equal(buttons.filter(b=>b.tabIndex===0).length,1);
  const a=buttons.find(b=>b.getAttribute('aria-pressed')==='true');assert.match(a.getAttribute('aria-label'),/C grade 2; S grade 1\. 1 unit: A/);a.focus();
  a.dispatchEvent(new env.win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));const empty=env.doc.activeElement;
  assert.match(empty.getAttribute('aria-label'),/C grade 2; S grade 2\. 0 units: No units/);assert.equal(selected,null);assert.equal(buttons.filter(b=>b.tabIndex===0).length,1);
  empty.dispatchEvent(new env.win.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));const b=env.doc.activeElement;assert.match(b.getAttribute('aria-label'),/C grade 1; S grade 2\. 1 unit: B/);b.click();assert.deepEqual(selected.members,['B']);
 }finally{h.destroy();env.restore();}
});
