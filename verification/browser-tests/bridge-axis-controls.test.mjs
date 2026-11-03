// Exact linked axes: a converted minimum must not move the regular decimal keyboard grid or the pointer maximum.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCS,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';

test('both KRW bridge apps preserve native values, decimal increments and exact endpoints',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const app of ['lambda-tau','krw-axes'])for(const [width,theme,surface]of [[375,'dark','embed'],[1280,'light','page']])await t.test(`${app} ${width}px ${surface}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  const path=surface==='embed'?`embed/${app}.html`:`pages/cases/${app}.html`;
  await page.goto(`${server.origin}/${path}?preset=lambda25&theme=${theme}`);await waitForWidgetIdle(page);
  const read=()=>page.evaluate(()=>{const input=document.querySelector('input[name=tau]'),output=input.closest('.prx-slider').querySelector('output');return{native:+input.value,raw:+output.dataset.num,aria:input.getAttribute('aria-valuetext'),shown:output.textContent,step:input.step,min:+input.min,tau:__prxApp.state.tau,lambda:+document.querySelector('input[name=lambda]').value};});
  const minimum=.01/(1+.01);
  const verify=async value=>{const got=await read();if(value===minimum)assert.ok(Math.abs(got.native-value)<=2*Number.EPSILON*value,'native converted minimum within two double roundoff units');else assert.equal(got.native,value);assert.equal(got.raw,value);assert.equal(got.aria,got.shown);assert.equal(got.step,'any');return got;};
  assert.equal((await verify(.2)).lambda,.25);
  await page.focus('input[name=tau]');await page.keyboard.press('ArrowRight');await waitForWidgetIdle(page);assert.equal((await verify(.21)).tau,.21);
  await page.keyboard.press('PageUp');await waitForWidgetIdle(page);await verify(.31);
  await page.keyboard.down('Shift');await page.keyboard.press('ArrowLeft');await page.keyboard.up('Shift');await waitForWidgetIdle(page);await verify(.21);
  await page.keyboard.press('Home');await waitForWidgetIdle(page);const home=await verify(minimum);assert.equal(home.min,minimum);assert.ok(Math.abs(home.lambda-.01)<1e-15);
  await page.keyboard.press('End');await waitForWidgetIdle(page);assert.equal((await verify(.5)).lambda,1);
  const range=await page.$('input[name=tau]');await range.evaluate(n=>n.scrollIntoView({block:'center'}));let box=await range.boundingBox();
  await page.mouse.click(box.x+1,box.y+box.height/2);await waitForWidgetIdle(page);await verify(minimum);
  box=await range.boundingBox();await page.mouse.click(box.x+box.width-1,box.y+box.height/2);await waitForWidgetIdle(page);const end=await verify(.5);assert.equal(end.tau,.5);assert.equal(end.lambda,1);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
