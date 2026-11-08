import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCS,startServer,launchChrome,openTab,waitForWidgetIdle} from '../browser.mjs';
test('local validation is announced and native long-card focus remains in view',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])for(const surface of ['page','embed'])await t.test(`${width}px ${theme} ${surface}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800});st.after(()=>page.close());
  await page.goto(`${server.origin}/${surface==='page'?'pages/tools':'embed'}/your-data.html`);await waitForWidgetIdle(page);await page.evaluate(theme=>__prxApp.update({theme}),theme);await waitForWidgetIdle(page);
  const previous=await page.$eval('[data-prx-readout=grade]',e=>e.dataset.num);
  if(await page.$('details[data-prx-disclosure="input"]:not([open])'))await page.click('details[data-prx-disclosure="input"] summary');
  await page.focus('[data-prx-input]');await page.$eval('[data-prx-input]',e=>e.select());await page.keyboard.sendCharacter('id,theta_mean,theta_sd\n001,2,0\n1,0,0.2');
  const apply=await page.$('[data-prx-focus-key="input:apply"]');await apply.focus();await page.keyboard.press('Enter');
  const status=await page.$eval('[data-prx-input-status]',e=>({id:e.id,role:e.role,live:e.getAttribute('aria-live'),atomic:e.getAttribute('aria-atomic'),text:e.textContent}));
  assert.equal(status.role,'status');assert.equal(status.live,'polite');assert.equal(status.atomic,'true');assert.ok(await page.$$eval('input[name=tau],input[name=priorMean],input[name=priorSd],input[name^=weight]',(inputs,id)=>inputs.every(e=>e.getAttribute('aria-describedby')===id),status.id));assert.match(status.text,/Row 2.*SD must be above zero/);assert.doesNotMatch(status.text,/^null/);
  assert.equal(await page.$eval('[data-prx-input]',e=>e.getAttribute('aria-describedby')),status.id);assert.equal(await page.$eval('[data-prx-input]',e=>e.getAttribute('aria-invalid')),'true');assert.equal(await page.$eval('[data-prx-readout=grade]',e=>e.dataset.num),previous);assert.equal(await page.evaluate(()=>document.activeElement.dataset.prxFocusKey),'input:apply');
  // A full public restore clears stale invalid state; all thirty units remain in the real reused card.
  await page.evaluate(()=>__prxApp.applyPreset('league30-posterior'));await waitForWidgetIdle(page);assert.equal(await page.$eval('[data-prx-input]',e=>e.hasAttribute('aria-invalid')),false);
  const first=await page.$('.yd-output .prx-kbd-point[tabindex="0"]');await first.focus();
  for(const key of ['Home','End','ArrowLeft','Home','ArrowRight']){if(key==='ArrowRight')await page.evaluate(()=>window.scrollBy(0,-480));await page.keyboard.press(key);const bounds=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,text:e.getAttribute('aria-label'),tip:(()=>{const r=e.closest('.prx-kbd-layer').parentElement.querySelector('.prx-kbd-tip').getBoundingClientRect();return{top:r.top,bottom:r.bottom}})(),height:innerHeight,sw:document.documentElement.scrollWidth,width:innerWidth};});assert.ok(bounds.top>=-1&&bounds.bottom<=bounds.height+1,`${key} reveals focused row ${JSON.stringify(bounds)}`);assert.ok(bounds.tip.top>=-1&&bounds.tip.bottom<=bounds.height+1,`${key} reveals full tooltip ${JSON.stringify(bounds)}`);assert.ok(bounds.sw<=bounds.width+1);}
  assert.equal(await page.$$eval('.yd-output .prx-data-table tbody tr',a=>a.length),30);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
