// Preserve every signed pair contribution from the independently produced R42 fixture.
// Read the large table once: repeated selectors obscure missing/duplicate rows and are quadratic.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOCS,launchChrome,openTab,startServer} from '../browser.mjs';

const rows=JSON.parse(readFileSync(new URL('../golden/oracle-v3p4-withholding.json',import.meta.url),'utf8')).rows;
test('The full KRW counterfactual retains every independently checked signed pair account',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();
 t.after(async()=>{await browser.close();await server.close();});
 for(const cap of ['4','all'])await t.test(`same expected-rank order, ${cap==='4'?'at most four grades':'no cap'}`,async st=>{
  const row=rows.find(r=>r.id===`withholding-compare-krw97-order-${cap==='4'?'cap4':'uncapped'}-to-forward-55-35-tie1`);
  assert.ok(row,'independent fixture row exists');
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width:375,height:812,scheme:'dark'});
  st.after(()=>page.close());
  const pair=encodeURIComponent([row.args.E.ids[55],row.args.E.ids[35]].join(','));
  await page.goto(`${server.origin}/embed/why-withheld.html?data=krw&tau=.25&cap=${cap}&pair=${pair}&theme=dark`,{waitUntil:'load'});
  await page.waitForSelector('.prx-widget[aria-busy=false]');
  const actual=await page.evaluate(()=>{
   const table=document.querySelector('table[aria-label^="Every ordered unit pair"]');
   return {
    values:[...document.querySelectorAll('[data-prx-readout^="forward-account-"]')].map(e=>[e.dataset.prxReadout,Number(e.dataset.num)]),
    overflow:document.documentElement.scrollWidth>innerWidth,
    matrix:table?{rows:table.tBodies[0].rows.length,columns:table.rows[0].cells.length,
     rowIDs:[...new Set([...table.tBodies[0].rows].map(r=>r.cells[0].textContent))],
     columnIDs:[...new Set([...table.tBodies[0].rows].map(r=>r.cells[1].textContent))]}:null,
   };
  });
  const values=new Map(actual.values);
  assert.equal(values.size,actual.values.length,'no duplicate scientific readout identifiers');
  assert.equal(actual.values.filter(([key])=>/^forward-account-before-\d+$/.test(key)).length,row.expect.pairs.length);
  assert.equal(row.expect.pairs.length,row.expect.change.changed);
  assert.equal(actual.matrix?.rows,row.args.E.ids.length**2,'the accessible matrix retains every ordered cell');
  assert.equal(actual.matrix.columns,3);
  assert.deepEqual(actual.matrix.rowIDs.sort(),row.args.E.ids.map(String).sort());
  assert.deepEqual(actual.matrix.columnIDs.sort(),row.args.E.ids.map(String).sort());
  for(let i=0;i<row.expect.pairs.length;i++)for(const [field,key] of [
   ['beforeCost','before'],['afterCost','after'],['costDifference','cost'],['normalizedDifference','normalized'],
  ]){
   const got=values.get(`forward-account-${key}-${i}`),expected=row.expect.pairs[i][field];
   assert.ok(Number.isFinite(got),`pair ${i} ${field} exists`);
   assert.ok(Math.abs(got-expected)<=1e-12,`pair ${i} ${field}: ${got} versus independent ${expected}`);
  }
  assert.equal(actual.overflow,false);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
