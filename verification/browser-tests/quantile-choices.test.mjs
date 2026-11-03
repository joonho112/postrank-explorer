// The quantile renderer has exactly two reports. Unsupported URL/API/bridge values must never reach it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOT,startServer,launchChrome,openTab} from '../browser.mjs';

test('Quantile choices reject unsupported integers and fractions on every public input path',async t=>{
 const server=await startServer(ROOT,{virtual:{'/__quantile-frame.html':'<!doctype html><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><iframe id="f" title="Quantile choices" src="/embed/deciles-quartiles.html?G=10" style="width:100%;height:700px;border:0"></iframe>'}});
 let browser;t.after(async()=>{await browser?.close();await server.close();});browser=await launchChrome();
 for(const width of [375,1280])for(const theme of ['light','dark'])await t.test(`${width}px ${theme}`,async st=>{
  const{page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  const ready=frame=>frame.waitForSelector('[data-prx-readout="tier-N"]');
  const state=frame=>frame.evaluate(()=>({G:window.__prxApp.state.G,detail:!!document.querySelector('[data-prx-readout="tier-risk"]'),overflow:document.documentElement.scrollWidth>innerWidth}));
  for(const G of [5,7.25]){await page.goto(`${server.origin}/embed/deciles-quartiles.html?theme=${theme}&G=${G}`,{waitUntil:'load'});await ready(page);assert.deepEqual(await state(page),{G:4,detail:true,overflow:false});}
  for(const preset of ['race-four','race-ten','gender-four','gender-ten']){
   await page.evaluate(p=>window.__prxApp.applyPreset(p),preset);
   await page.waitForFunction(G=>window.__prxApp.state.G===G,{},preset.endsWith('ten')?10:4);
   const before=await state(page);
   for(const G of [5,7.25]){await page.evaluate(G=>window.__prxApp.update({G}),G);assert.deepEqual(await state(page),before);}
  }
  await page.goto(server.origin+'/__quantile-frame.html',{waitUntil:'load'});
  const frame=await(await page.waitForSelector('#f')).contentFrame();await ready(frame);
  for(const G of [5,7.25]){await page.evaluate(G=>document.querySelector('#f').contentWindow.postMessage({prx:{G}},'*'),G);await frame.waitForFunction(()=>window.__prxApp.state.G===10);assert.equal((await state(frame)).detail,true);}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
