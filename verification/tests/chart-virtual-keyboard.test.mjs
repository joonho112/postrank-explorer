import{test}from'node:test';
import assert from'node:assert/strict';
import{makeWindow,key}from'../dom-env.mjs';
import{plot}from'../../js/shared/chart.js';
test('Dense matrix keyboard reads every cell with one target and preserves focus across redraw',()=>{
 const m=makeWindow();try{
  const data=Array.from({length:97*97},(_,i)=>({row:Math.floor(i/97),col:i%97}));
  const draw=()=>plot(m.el,{width:500,height:500,x:{domain:[0,96]},y:{domain:[0,96]},alt:'Dense matrix',marks:(c,P)=>[P.dot([data[0]],{x:'col',y:'row',r:0})],keyboard:{data,x:'col',y:'row',columns:97,virtual:true,title:d=>`Row ${d.row}, column ${d.col}`}});
  draw();let b=m.el.querySelector('.prx-kbd-point');assert.equal(m.el.querySelectorAll('.prx-kbd-point').length,1);b.focus();
  key(b,'ArrowRight');key(b,'ArrowDown');assert.equal(b.getAttribute('aria-label'),'Row 1, column 1');
  draw();b=m.el.querySelector('.prx-kbd-point');assert.equal(m.doc.activeElement,b);assert.equal(b.getAttribute('aria-label'),'Row 1, column 1');
  key(b,'End');assert.equal(b.getAttribute('aria-label'),'Row 96, column 96');key(b,'ArrowDown');assert.equal(b.getAttribute('aria-label'),'Row 96, column 96');
  key(b,'Home');assert.equal(b.getAttribute('aria-label'),'Row 0, column 0');key(b,'Escape');assert.equal(m.el.querySelector('.prx-kbd-tip').hidden,true);
  const outside=m.doc.getElementById('outside');outside.tabIndex=0;outside.focus();draw();assert.equal(m.doc.activeElement,outside);
 }finally{m.restore();}
});
