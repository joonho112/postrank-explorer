// A rounded preset-highlight comparison must not replace precise native/API state edits.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOT,launchChrome,openTab,startServer} from '../browser.mjs';
test('An exact cost field applies nearby edits and retains keyboard focus',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();
 t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])await t.test(`${width}px ${theme}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});
  st.after(()=>page.close());
  await page.goto(`${server.origin}/embed/criterion-mixture.html?preset=third-boundary&theme=${theme}`);
  await page.waitForSelector('[data-prx-readout="readout-mixture"]');
  await page.focus('[name="tau"]');
  for(const value of ['0.3333333338333333','0.3333333328333333','0.3333333333333333']){
   await page.$eval('[name="tau"]',(input,value)=>{
    input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
   },value);
   const actual=await page.evaluate(()=>({value:document.querySelector('[name="tau"]').value,tau:window.__prxApp.state.tau,focus:document.activeElement.name}));
   assert.equal(actual.tau,Number(value));assert.equal(actual.value,value);assert.equal(actual.focus,'tau');
  }
  const value=.3333333337333333;
  await page.evaluate(tau=>window.__prxApp.update({tau}),value);
  assert.equal(await page.evaluate(()=>window.__prxApp.state.tau),value);
  assert.equal(await page.$eval('[name="tau"]',input=>Number(input.value)),value);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // This app uses the shared range helper without a local step override.
  await page.goto(`${server.origin}/embed/two-scores.html?w=.07371610921734705&tau=.123456789012345&cap=3&theme=${theme}`);
  await page.waitForSelector('[data-prx-readout="grade-0"]');
  for(const name of ['w','tau']){
   const native=await page.$eval(`[name="${name}"]`,input=>({step:input.step,value:Number(input.value)}));
   const state=await page.evaluate(name=>window.__prxApp.state[name],name);
   assert.equal(native.step,'any');assert.ok(Math.abs(native.value-state)<=Number.EPSILON);
  }
  await page.focus('[name="w"]');await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>window.__prxApp.state.w),.08);
  assert.equal(await page.evaluate(()=>document.activeElement.name),'w');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
