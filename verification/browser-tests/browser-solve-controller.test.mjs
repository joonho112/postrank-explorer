// Native control/lifecycle regression for the actual parent-used solver controller.
// The controlled solver promise tests transport/lifecycle only; it supplies no scientific expectations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, launchChrome, openTab, startServer } from '../browser.mjs';

test('the actual browser solve controller is click-only, retryable and suppresses invalidated/destroyed work', async t => {
  const server = await startServer(ROOT), browser = await launchChrome();
  const {page, errors, failed} = await openTab(browser, {origin:server.origin,width:375,height:800});
  t.after(async () => { await page.close(); await browser.close(); await server.close(); });
  await page.goto(`${server.origin}/embed/computing-grades.html?view=solver&solverN=3&tau=.25`);
  await page.evaluate(async () => {
    window.__prxApp.destroy();
    const {createWidget} = await import('/js/shared/base.js');
    const {createBrowserSolveController} = await import('/js/apps/computing-grades.js');
    window.__controllerEvents = []; window.__controllerCalls = [];
    window.PRX_SOLVER = {ready:Promise.resolve({highs:'controlled lifecycle test'}),mipSolve(E, options) {
      window.__controllerCalls.push({ids:E.ids,options});
      return new Promise((resolve,reject) => { window.__controllerRelease = resolve; window.__controllerReject = reject; });
    }};
    window.__prxApp = createWidget(document.getElementById('app'), {}, {
      name:'computing-grades', keys:{revision:{type:'string',value:'first'},available:{type:'boolean',value:true}},
      build(ctx) {
        const other = ctx.h('button',{type:'button',id:'reader-control',text:'Another control'});
        const controller = createBrowserSolveController(ctx, {
          getProblem:() => ({E:{ids:['A','B'],criteria:['score'],e:[[[NaN,.1],[.9,NaN]]]},options:{tau:.25},key:ctx.state.revision}),
          onResult:(r,key) => window.__controllerEvents.push(['result',key,r.marker]),
          onError:error => window.__controllerEvents.push(['error',error]),
          onBusy:busy => { window.__controllerEvents.push(['busy',busy]); if(busy)ctx.root.setAttribute('aria-busy','true');else ctx.root.removeAttribute('aria-busy');ctx.requestRender(); },
        });
        window.__controller = controller;
        ctx.controls.append(controller.root,other);
        return {render(state) {controller.refresh({available:state.available,hasResult:window.__controllerEvents.some(e=>e[0]==='result')});}};
      },
    });
  });
  const solve='[data-prx-solve]', calls=()=>page.evaluate(()=>__controllerCalls.length);
  const idle=()=>page.waitForFunction(()=>document.querySelector('.prx-widget').getAttribute('aria-busy')!=='true',{polling:'mutation'});
  assert.equal(await calls(),0,'mount does not request a solve');
  await page.evaluate(()=>__prxApp.update({available:false}));await page.focus(solve);await page.keyboard.press('Enter');assert.equal(await calls(),0,'unavailable action is guarded while focusable');
  await page.evaluate(()=>__prxApp.update({available:true}));await page.keyboard.press('Enter');await page.waitForFunction(()=>__controllerCalls.length===1);
  const node=await page.$(solve);await page.keyboard.press('Space');await page.keyboard.press('Enter');assert.equal(await calls(),1,'one outstanding worker job');
  assert.equal(await page.$eval(solve,n=>n.getAttribute('aria-disabled')),'true');
  await page.evaluate(()=>{__controller.invalidate();__prxApp.update({revision:'second'});__controllerRelease({marker:'obsolete'});});await idle();
  assert.equal(await page.evaluate(()=>__controllerEvents.some(e=>e[0]==='result')),false,'invalidated results do not reach the caller');
  assert.equal(await page.evaluate(n=>document.activeElement===n,node),true,'the persistent action keeps native focus');
  await page.keyboard.press('Space');await page.waitForFunction(()=>__controllerCalls.length===2);await page.evaluate(()=>__controllerReject(new Error('controlled failure')));await idle();
  assert.equal(await page.evaluate(()=>__controllerEvents.some(e=>e[0]==='error'&&e[1]==='controlled failure')),true);
  assert.equal(await page.$eval(solve,n=>n.getAttribute('aria-disabled')),'false','failure permits retry');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>__controllerCalls.length===3);await page.focus('#reader-control');await page.evaluate(()=>__controllerRelease({marker:'current'}));await idle();
  assert.deepEqual(await page.evaluate(()=>__controllerEvents.filter(e=>e[0]==='result')),[['result','second','current']]);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'reader-control','completion does not reclaim focus');
  assert.equal(await page.$eval(solve,n=>n.textContent),'Solve again');
  await page.focus(solve);await page.keyboard.press('Enter');await page.waitForFunction(()=>__controllerCalls.length===4);
  const atDestroy=await page.evaluate(()=>{__prxApp.destroy();return __controllerEvents.length;});
  await page.evaluate(()=>__controllerRelease({marker:'after destroy'}));await new Promise(r=>setTimeout(r,30));
  assert.equal(await page.evaluate(()=>__controllerEvents.length),atDestroy,'destroy suppresses all late caller notifications');
  assert.equal(await page.$('.prx-widget'),null);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
});
