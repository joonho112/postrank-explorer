// Trusted keyboard regression for the exact τ draft, including the independent R43 boundary.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DOCS,ROOT,launchChrome,openTab,sleep,startServer} from '../browser.mjs';

const selector='input[name="tau"]';
const third=JSON.parse(readFileSync(join(ROOT,'verification/golden/oracle-v3p4-mixture.json'),'utf8')).rows.find(r=>r.id==='mixture-majority-tauone-third');
const texts=['0.3333333333333333','.3333333333333333','.123456789012345','0.3333333338333333','0.3333333328333333'];

test('Criterion mixture keeps decimal drafts intact until explicit commit',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome(),evidence=mkdtempSync(join(tmpdir(),'criterion-mixture-draft-')),records=[];
 t.after(async()=>{writeFileSync(join(evidence,'observations.json'),JSON.stringify(records,null,2));await browser.close();await server.close();console.log(`Draft evidence: ${evidence}`);});
 for(const width of [375,1280])for(const theme of ['light','dark'])for(const surface of ['page','embed'])await t.test(`${width}px ${theme} ${surface}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812});st.after(()=>page.close());
  const path=surface==='page'?'pages/criteria/criterion-mixture.html':'embed/criterion-mixture.html';
  await page.goto(`${server.origin}/${path}?preset=third-boundary&theme=${theme}`,{waitUntil:'load'});
  await page.waitForSelector('[data-prx-readout="tie-count"]');
  await page.evaluate(()=>{window.__draftEvents=[];document.querySelector('input[name="tau"]').addEventListener('input',e=>window.__draftEvents.push({trusted:e.isTrusted,text:e.target.value,start:e.target.selectionStart,end:e.target.selectionEnd,tau:window.__prxApp.state.tau}));});
  const snapshot=()=>page.evaluate(()=>{const input=document.querySelector('input[name="tau"]');return{text:input.value,start:input.selectionStart,end:input.selectionEnd,tau:window.__prxApp.state.tau,focus:document.activeElement.name,invalid:input.getAttribute('aria-invalid'),spoken:input.getAttribute('aria-valuetext'),ties:document.querySelector('[data-prx-readout="tie-count"]').dataset.num,width:innerWidth,scroll:document.documentElement.scrollWidth};});
  const clear=async()=>{await page.focus(selector);await page.keyboard.press('End');await page.keyboard.down('Shift');await page.keyboard.press('Home');await page.keyboard.up('Shift');const selected=await snapshot();assert.equal(selected.start,0);assert.equal(selected.end,selected.text.length);await page.keyboard.press('Backspace');assert.equal((await snapshot()).text,'');};
  const trustedDraft=async text=>{await clear();await page.evaluate(()=>window.__draftEvents=[]);await page.keyboard.type(text,{delay:70});return page.evaluate(()=>window.__draftEvents);};
  for(const [index,text] of texts.entries()){
   await page.evaluate(()=>window.__prxApp.applyPreset('third-boundary'));
   const events=await trustedDraft(text),draft=await snapshot();
   assert.equal(events.length,text.length);for(const [i,event] of events.entries()){assert.equal(event.trusted,true);assert.equal(event.text,text.slice(0,i+1));assert.equal(event.start,i+1);assert.equal(event.end,i+1);assert.equal(event.tau,third.args.tau);}
   assert.equal(draft.text,text);assert.equal(draft.start,text.length);assert.equal(draft.end,text.length);assert.equal(draft.tau,third.args.tau);assert.equal(draft.focus,'tau');assert.equal(draft.ties,String(third.expect.optimum.tieCount));assert.match(draft.spoken,/Draft not applied/);
   const commitKey=index===1?'Tab':'Enter';await page.keyboard.press(commitKey);await sleep(50);const committed=await snapshot();
   assert.equal(committed.tau,Number(text));assert.equal(Number(committed.text),Number(text));assert.equal(committed.invalid,'false');if(commitKey==='Enter')assert.equal(committed.focus,'tau');else assert.notEqual(committed.focus,'tau');
   if(Number(text)===third.args.tau)assert.equal(committed.ties,String(third.expect.optimum.tieCount));
   records.push({width,theme,surface,text,commitKey,events,draft,committed});
  }
  // The buffer and selection survive actual theme and resize redraws while the applied cost stays fixed.
  await page.evaluate(()=>window.__prxApp.applyPreset('third-boundary'));await trustedDraft('.1234');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');const before=await snapshot();
  await page.evaluate(theme=>window.__prxApp.update({theme}),theme==='dark'?'light':'dark');await page.setViewport({width:width===375?1280:375,height:812});await sleep(200);const redrawn=await snapshot();
  for(const key of ['text','start','end','tau','focus'])assert.equal(redrawn[key],before[key]);
  await page.keyboard.press('Escape');let actual=await snapshot();assert.equal(actual.text,String(third.args.tau));assert.equal(actual.tau,third.args.tau);assert.equal(actual.focus,'tau');assert.equal(actual.invalid,'false');
  await page.evaluate(theme=>window.__prxApp.update({theme}),theme);await page.setViewport({width,height:812});await sleep(150);
  // Same-value authoritative commands also discard a pending draft, without relying on a redraw.
  await trustedDraft('.1234');await page.evaluate(tau=>window.__prxApp.update({tau}),third.args.tau);actual=await snapshot();assert.equal(actual.text,String(third.args.tau));assert.equal(actual.focus,'tau');
  await trustedDraft('.1234');await page.evaluate(()=>window.__prxApp.update({tau:.2}));actual=await snapshot();assert.equal(actual.tau,.2);assert.equal(actual.text,'0.2');assert.equal(actual.focus,'tau');
  await page.evaluate(()=>window.__prxApp.applyPreset('third-boundary'));await trustedDraft('.1234');await page.evaluate(()=>window.__prxApp.applyPreset('third-boundary'));actual=await snapshot();assert.equal(actual.text,String(third.args.tau));assert.equal(actual.tau,third.args.tau);
  // Invalid/incomplete text remains unapplied, with an accessible explanation and cancellable buffer.
  await trustedDraft('.');await page.keyboard.press('Enter');actual=await snapshot();assert.equal(actual.tau,third.args.tau);assert.equal(actual.text,'.');assert.equal(actual.invalid,'true');assert.match(actual.spoken,/Invalid draft; applied cost/);await page.keyboard.press('Escape');
  // Existing explicit numeric steps and range bounds remain operational.
  await page.evaluate(()=>window.__prxApp.update({tau:.2}));await page.focus(selector);await page.keyboard.press('ArrowUp');actual=await snapshot();assert.equal(actual.tau,.21);assert.equal(actual.focus,'tau');await page.keyboard.press('ArrowDown');assert.equal((await snapshot()).tau,.2);
  await page.focus('input[name="tau-slider"]');await page.keyboard.press('End');assert.equal((await snapshot()).tau,.5);await page.keyboard.press('Home');assert.equal((await snapshot()).tau,.01);
  actual=await snapshot();assert.ok(actual.scroll<=actual.width+1);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);records.push({width,theme,surface,before,redrawn,final:actual});
  if(width===375&&theme==='dark')await page.screenshot({path:join(evidence,`${surface}-375-dark.png`)});
 });
});
