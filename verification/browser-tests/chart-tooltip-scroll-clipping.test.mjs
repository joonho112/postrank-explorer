// Real shared-renderer regression: the matrix viewport, not the full offscreen canvas, bounds a keyboard tip.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOT,launchChrome,openTab,startServer} from '../browser.mjs';

test('complete keyboard descriptions fit the actual inner matrix viewport after native moves and scrolling',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])for(const large of [false,true])await t.test(`${width}px ${theme} ${large?'canvas':'SVG'}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  await page.goto(`${server.origin}/embed/report-builder.html?theme=${theme}`,{waitUntil:'load'});
  await page.evaluate(async(large,theme)=>{
   __prxApp.destroy();
   const {createWidget}=await import('/js/shared/base.js');
   const {drawRelationMatrix,REPORT_BUILDER_CSS}=await import('/js/apps/report-builder.js');
   const {relations}=await import('/js/pr-core.js');
   const n=large?30:12,ids=Array.from({length:n},(_,i)=>`U${String(i+1).padStart(2,'0')}`),names=ids.map(id=>`${id}: 서울, a complete long unit name`),g=ids.map((_,i)=>1+Math.floor(i/(n/3)));
   window.__prxApp=createWidget(document.getElementById('app'),{theme},{name:'tooltip-clip-fixture',className:'prx-rb',css:REPORT_BUILDER_CSS,bridge:false,keys:{},build(ctx){
    const slot=ctx.h('div'),legend=ctx.h('div'),region=ctx.scrollRegion(ctx.h('div',{id:'clip-region',style:'max-width:640px;max-height:420px;overflow:auto'},slot),'Every original matrix cell');ctx.charts.append(region,legend);
    return {render(){drawRelationMatrix(ctx,slot,legend,{n,ids,names,g,unit:'school',units:'schools'},{rel:relations(g),large,onFocus:()=>{slot.querySelector('.prx-kbd-point:focus')?.scrollIntoView({block:'nearest',inline:'nearest'});}});}};
   }});
  },large,theme);
  await page.focus('.prx-kbd-point[tabindex="0"]');
  for(const key of ['Home','ArrowRight','End','Home']){
   await page.keyboard.press(key);
   const bounds=await page.evaluate(()=>{
    const button=document.activeElement,tip=button.closest('.prx-chart-area').querySelector('.prx-kbd-tip'),region=document.getElementById('clip-region'),r=region.getBoundingClientRect(),b=tip.getBoundingClientRect();
    return {left:b.left,right:b.right,clipLeft:r.left+region.clientLeft,clipRight:r.left+region.clientLeft+region.clientWidth,text:tip.textContent,aria:button.getAttribute('aria-label'),hidden:tip.hidden,scrollLeft:region.scrollLeft};
   });
   assert.equal(bounds.hidden,false);assert.ok(bounds.text.includes('서울'));assert.equal(bounds.text.replace(/\s*\n\s*/g,', '),bounds.aria,'no source description is shortened');
   assert.ok(bounds.left>=bounds.clipLeft-1&&bounds.right<=bounds.clipRight+1,`${key}: ${JSON.stringify(bounds)}`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
