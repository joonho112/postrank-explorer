// BR01: a trusted pointer move must reach integer normalization before an integer formatter.
import{test}from'node:test';import assert from'node:assert/strict';
import{ROOT,launchChrome,openTab,startServer}from'../browser.mjs';
test('Native pointer editing keeps whole-state counts integral and operable',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of[375,1280])for(const theme of['light','dark'])await t.test(`${width}px ${theme}`,async st=>{
  const{page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  await page.goto(`${server.origin}/embed/draws-to-errors.html?theme=${theme}`);await page.waitForSelector('.prx-widget svg');
  for(const name of['prefix','draw','shift']){
   const input=await page.$(`[name="${name}"]`);assert.ok(input);
   await input.evaluate(e=>e.scrollIntoView({block:'center'}));
   const box=await input.boundingBox();await page.mouse.click(box.x+box.width*.407,box.y+box.height/2);
   await page.waitForFunction(name=>Number(document.querySelector(`[name="${name}"]`).value)===window.__prxApp.state[name],{},name);
   const actual=await input.evaluate(e=>({value:Number(e.value),step:e.step,output:e.closest('.prx-control').querySelector('output').dataset.num}));
   assert.equal(actual.step,'1');assert.ok(Number.isInteger(actual.value));assert.equal(Number(actual.output),actual.value);
   assert.equal(await page.evaluate(name=>Number.isInteger(window.__prxApp.state[name]),name),true);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
