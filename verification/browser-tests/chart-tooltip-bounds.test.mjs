// Real Chrome regression for P3-BOA-R01: keyboard tooltips must fit narrow viewports.
import{test}from'node:test';
import assert from'node:assert/strict';
import{ROOT,launchChrome,openTab,startServer}from'../browser.mjs';
test('Long keyboard point descriptions stay inside the viewport',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of[375,1280])for(const theme of['light','dark'])await t.test(`${width}px ${theme}`,async st=>{
  const{page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  await page.goto(`${server.origin}/embed/better-on-average.html?theme=${theme}`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('.prx-widget')?.getAttribute('aria-busy')!=='true');
  const groups=await page.$$('.prx-kbd-layer');assert.ok(groups.length>0);
  let checked=0;
  for(let i=0;i<groups.length;i++){
   const active=await groups[i].$('.prx-kbd-point[tabindex="0"]');if(!active)continue;await active.focus();
   for(const key of['Home','ArrowRight','End']){
    await page.keyboard.press(key);
    const bounds=await page.evaluate(()=>{const b=document.activeElement,layer=b?.closest('.prx-kbd-layer'),tip=layer?.parentElement.querySelector('.prx-kbd-tip');if(!tip||tip.hidden)return null;const r=tip.getBoundingClientRect();return{left:r.left,right:r.right,sw:document.documentElement.scrollWidth,width:innerWidth,text:tip.textContent};});
    assert.ok(bounds?.text,`keyboard description appears after ${key}`);assert.ok(bounds.left>=-1&&bounds.right<=width+1,`${width}px ${key} tooltip bounds ${JSON.stringify(bounds)}`);assert.ok(bounds.sw<=width+1,`no page overflow after ${key}`);checked++;
   }
  }
  assert.ok(checked>=3);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
