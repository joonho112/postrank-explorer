// Real rendered label placement, linked case navigation, and exact risk-boundary accessibility.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCS,startServer,launchChrome,openTab,waitForWidgetIdle} from '../browser.mjs';

test('case explanations retain complete data with readable labels and working split navigation',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])for(const surface of ['embed','page'])await t.test(`${width}px ${theme} ${surface}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800});st.after(()=>page.close());
  const go=async app=>{await page.goto(`${server.origin}/${surface==='embed'?'embed': 'pages/cases'}/${app}.html?theme=${theme}`);await waitForWidgetIdle(page);await page.evaluate(theme=>__prxApp.update({theme}),theme);await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')),theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
  await go('cde-one-disclosure');
  assert.match(await page.$eval('#app',e=>e.textContent),/mixture reaches this maximum only by using such maximum-disclosure reports/);
  assert.equal(await page.$eval('[data-prx-readout=hist-count]',e=>+e.dataset.num),34650);
  const hist=await page.evaluate(()=>{const a=document.querySelector('.prx-cd-hist-annotation').getBoundingClientRect(),r=document.querySelector('[aria-label="Complete distribution at the tertiles\' disclosure"] svg').getBoundingClientRect();const cells=[...document.querySelectorAll('[data-prx-readout^="hist-bin-"]')];return{top:a.top,bottom:a.bottom,chartBottom:r.bottom,bins:cells.length,total:cells.filter(e=>/-2$/.test(e.dataset.prxReadout)).reduce((s,e)=>s+ +e.dataset.num,0)};});
  assert.ok(hist.top>=hist.chartBottom,'full histogram annotation occupies its own line');assert.equal(hist.bins,46*3);assert.equal(hist.total,34650);
  await go('cde-tau-path');
  const axis=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return{title:rect(document.querySelector('.prx-cd-path-y-label')),ticks:[...document.querySelectorAll('.prx-cd-path-chart svg text')].filter(e=>e.textContent==='66').map(rect),rows:new Set([...document.querySelectorAll('[data-prx-readout^="archive-cell-"]')].map(e=>e.dataset.prxReadout.split("-").at(-2))).size};});
  assert.ok(axis.ticks.length);for(const r of axis.ticks)assert.ok(axis.title.bottom<=r.top||axis.title.right<=r.left||r.right<=axis.title.left,'title must not intersect 66 tick');assert.equal(axis.rows,13);
  await go('cde-pair');assert.match(await page.$eval('#app',e=>e.textContent),/after B \(the first three schools are A, C and B\)/);
  await go('cde-cuts');const link=await page.$('#app a.prx-app-link');assert.ok(link);await link.focus();if(await link.evaluate(e=>e.target==='_blank')){const target=browser.waitForTarget(t=>t.opener()===page.target());await page.keyboard.press('Enter');const opened=await(await target).page();await opened.waitForFunction(()=>window.__prxApp);assert.match(opened.url(),/cde-one-disclosure\.html/);await opened.close();}else{await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')]);await waitForWidgetIdle(page);assert.match(page.url(),/cde-one-disclosure\.html/);}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});

test('KRW risk keyboard descriptions distinguish equality from strictly higher and lower loss',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const theme of ['light','dark'])await t.test(theme,async st=>{const {page,errors,failed}=await openTab(browser,{origin:server.origin,width:375,height:800});st.after(()=>page.close());await page.goto(`${server.origin}/embed/krw-two.html?theme=${theme}`);await waitForWidgetIdle(page);
  const target=await page.$('.k2-risks .prx-kbd-point')??await page.$('.k2-risk-chart .prx-kbd-point');assert.ok(target);await target.focus();let texts=[];for(let i=0;i<60;i++){texts.push(await page.$eval('.k2-risks .prx-kbd-tip',e=>e.textContent));await page.keyboard.press('ArrowRight');}
  assert.ok(texts.some(s=>/withhold all.*equal to/.test(s)));assert.ok(texts.some(s=>/below/.test(s)));assert.ok(texts.some(s=>/above/.test(s)));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
