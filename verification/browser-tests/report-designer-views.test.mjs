// Run after the focused source build. No CPU throttling or performance assertions.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startServer,launchChrome,openTab,ROOT} from '../browser.mjs';
test('public-case view changes keep valid SVG geometry and native small-matrix Enter/Space selection',async()=>{
 const server=await startServer(ROOT),browser=await launchChrome();
 try{const tab=await openTab(browser,{origin:server.origin,width:375,height:800,scheme:'dark'}),p=tab.page;
  await p.goto(server.origin+'/embed/report-designer.html?theme=dark',{waitUntil:'load'});
  const ready=()=>p.waitForFunction(()=>window.__prxApp&&!document.querySelector('.prx-widget').hasAttribute('aria-busy'));
  await ready();
  for(const key of ['cde','krw','alabama','cde'])for(const view of ['card','relations','report','card']){
   await p.evaluate(({key,view})=>{__prxApp.applyPreset(key);__prxApp.update({view});},{key,view});await ready();
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(key!=='cde')assert.match(await p.$eval('.prx-result-tag',e=>e.textContent),/the weighted expected-rank order/);
   assert.equal(await p.$$eval('svg rect[width]',rects=>rects.filter(r=>Number(r.getAttribute('width'))<0).length),0);
  }
  await p.evaluate(()=>{__prxApp.applyPreset('cde-cap4');__prxApp.update({view:'relations'});});await ready();
  assert.match(await p.$eval('.prx-result-tag',e=>e.textContent),/the posterior-mean order/);assert.doesNotMatch(await p.$eval('[data-prx-readout=scope-method]',e=>e.textContent),/expected-rank|Changing weights/);
  await p.focus('.des-matrix-scroll .prx-kbd-point');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');await ready();
  const first=await p.evaluate(()=>__prxApp.state.focus);assert.notEqual(first,'auto');assert.notEqual(first.split(',')[0],first.split(',')[1]);
  await p.focus('.des-matrix-scroll .prx-kbd-point[tabindex="0"]');await p.keyboard.press('End');await p.keyboard.press('Space');await ready();
  const last=await p.evaluate(()=>__prxApp.state.focus);assert.equal(last.split(',')[0],last.split(',')[1]);assert.notEqual(last,first);
  await p.focus('.des-matrix-scroll .prx-kbd-point[tabindex="0"]');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');
  const tip=await p.$eval('.des-matrix-scroll .prx-kbd-tip',e=>{const r=e.getBoundingClientRect(),c=e.closest('.des-matrix-scroll').getBoundingClientRect();return{text:e.textContent,left:r.left,right:r.right,clipLeft:c.left,clipRight:c.right};});assert.match(tip.text,/Row A, column C.*withholds/);assert.ok(tip.left>=tip.clipLeft-1&&tip.right<=tip.clipRight+1);
  assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);await p.close();
 }finally{await browser.close();await server.close();}
});
