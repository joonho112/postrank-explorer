import{test}from'node:test';
import assert from'node:assert/strict';
import{makeWindow}from'../dom-env.mjs';
import{hiddenTable}from'../../js/shared/chart.js';
import{numberFindings,displayFindings,badTokenFindings}from'../dom_rules.mjs';
test('Record-array figure tables retain categorical IDs, every row and nullable numeric vectors',()=>{
 const m=makeWindow({plot:false});try{
  const rows=[{unit:'001',grade:[1,2],risk:.0123,share:null,shares:[null,.25]},{unit:'site-B',grade:[2,1],risk:.2,share:.3,shares:[.3,.4]}],before=structuredClone(rows);
  m.el.append(hiddenTable(m.doc,rows,'Complete figure data'));
  const table=m.el.querySelector('table');
  assert.equal(table.tBodies[0].rows.length,2);
  assert.equal(table.rows[0].cells.length,5);
  assert.equal(table.caption.textContent,'Complete figure data');
  assert.equal(table.tBodies[0].rows[0].cells[0].textContent,'001');
  assert.ok(table.tBodies[0].rows[0].cells[0].hasAttribute('data-prx-name'));
  assert.equal(table.tBodies[0].rows[0].cells[1].dataset.num,'1,2');
  assert.equal(table.tBodies[0].rows[0].cells[3].textContent,'NA');
  assert.deepEqual(numberFindings(m.el),[]);assert.deepEqual(displayFindings(m.el),[]);assert.deepEqual(badTokenFindings(m.el),[]);
  assert.deepEqual(rows,before,'a text alternative never changes its source records');
 }finally{m.restore();}
});
