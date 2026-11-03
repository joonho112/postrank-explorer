import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCS,startServer,launchChrome,openTab,waitForWidgetIdle} from '../browser.mjs';

test('case recipe disclosures and precision source labels remain readable with native keyboard input',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])await t.test(`${width}px ${theme}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800});st.after(()=>page.close());
  const go=async app=>{await page.goto(`${server.origin}/pages/cases/${app}.html`);await waitForWidgetIdle(page);await page.evaluate(theme=>__prxApp.update({theme}),theme);await waitForWidgetIdle(page);};
  for(const app of ['krw-two','alabama-map']){await go(app);const summary=await page.$('details.prx-recipe summary');assert.ok(summary);await summary.focus();assert.equal(await page.$eval('details.prx-recipe',e=>e.open),false);await page.keyboard.press('Enter');assert.equal(await page.$eval('details.prx-recipe',e=>e.open),true);assert.equal(await page.$eval('details.prx-recipe pre',e=>e.textContent.trim().split('\n').length),3);await page.keyboard.press('Space');assert.equal(await page.$eval('details.prx-recipe',e=>e.open),false);}
  for(const app of ['krw-card','signed-or-absolute']){await go(app);const colors=await page.$$eval('.kr-precision-source code',codes=>codes.map(e=>{const c=getComputedStyle(e);let p=e.parentElement;while(p&&!p.classList.contains('prx-light-panel'))p=p.parentElement;return{fg:c.color,bg:c.backgroundColor,paper:getComputedStyle(p??e.parentElement).backgroundColor};}));assert.ok(colors.length);const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const lum=s=>rgb(s).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);for(const c of colors){const l=lum(c.fg),b=lum(c.paper);assert.ok((Math.max(l,b)+.05)/(Math.min(l,b)+.05)>=4.5,`source column contrast: ${JSON.stringify(c)}`);}}
  await go('krw-lambda');const words=await page.evaluate(()=>{const key=document.querySelector('.kr-purples').parentElement,walker=document.createTreeWalker(key,NodeFilter.SHOW_TEXT);const out=[];for(let n=walker.nextNode();n;n=walker.nextNode())for(const word of ['to','(saturated)']){const at=n.data.indexOf(word);if(at<0)continue;const r=document.createRange();r.setStart(n,at);r.setEnd(n,at+word.length);out.push({word,lines:r.getClientRects().length});}return out;});assert.equal(words.length,2);for(const w of words)assert.equal(w.lines,1,`${w.word} must not split within a word`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
