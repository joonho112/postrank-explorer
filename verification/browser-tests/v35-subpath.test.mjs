// Author: JoonHo Lee (jlee296@ua.edu).
// Repository-subpath deployment checks use only a local server and public artifacts.
import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,symlinkSync,rmSync,readFileSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{DOCS,ROOT,startServer,launchChrome,openTab,builtApps}from'../browser.mjs';
test('v3.5 navigation, profiles, catalog and R downloads work under the repository subpath',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'prx-subpath-'));symlinkSync(DOCS,join(dir,'postrank-explorer'),'dir');
 const server=await startServer(dir),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();rmSync(dir,{recursive:true,force:true});});
 const tab=await openTab(browser,{origin:server.origin,width:1280,height:800});const {page}=tab,base=server.origin+'/postrank-explorer/';
 for(const width of[375,1280,1440]){
  await page.setViewport({width,height:800});await page.goto(base+'index.html',{waitUntil:'load'});
  const m=await page.evaluate(()=>{const el=document.querySelector('.navbar-title'),r=document.createRange();r.selectNodeContents(el);return{text:el.textContent,width:el.getBoundingClientRect().width,full:r.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(m.text,'postrank Explorer');assert.ok(m.width+1>=m.full,`brand clipped at${width}px`);assert.equal(m.overflow,false);
 }
 await page.setViewport({width:1280,height:800});await page.goto(base+'catalog.html',{waitUntil:'load'});await page.select('select[name=part]','P');
 const visible=()=>page.$$eval('[data-catalog] article:not([hidden])',nodes=>nodes.map(n=>n.querySelector('.prx-card-id').textContent));assert.deepEqual(await visible(),['P.1','P.2','P.3','P.4','P.5']);
 await page.select('select[name=data]','profiles');assert.deepEqual(await visible(),['P.5']);await page.reload({waitUntil:'load'});assert.deepEqual(await visible(),['P.5']);assert.ok(page.url().startsWith(base));
 const profiles=builtApps().filter(a=>a.part==='P');assert.equal(profiles.length,5);
 for(const app of profiles){
  for(const path of[`pages/profiles/${app.name}.html`,`embed/${app.name}.html`]){
   await page.goto(base+path+'?preset='+app.presets[0].id,{waitUntil:'load'});await page.waitForFunction(()=>window.__prxApp&&document.querySelector('.prx-readout')?.textContent.trim());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const relative=`data/recipes/${app.name}.R`,response=await fetch(base+relative);assert.equal(response.status,200);assert.equal(await response.text(),readFileSync(join(ROOT,relative),'utf8'));
 }
 assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});
