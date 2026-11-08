// Production staged rendering: obsolete turns cannot publish results, downloads, or work after destroy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ROOT,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';
const fixture=id=>JSON.parse(readFileSync(join(ROOT,'verification/golden/oracle-v3p5-tools.json'))).rows.find(row=>row.id===id).expect;
const league30=fixture('tool-your-league30-posterior');
const localCsv='id,theta_mean,theta_sd\nlocal-stage-A,0,1\nlocal-stage-B,0,1';
async function enter(page,text){await page.focus('[data-prx-input]');await page.$eval('[data-prx-input]',e=>e.select());await page.keyboard.sendCharacter(text);}
async function apply(page){await page.focus('[data-prx-focus-key="input:apply"]');await page.keyboard.press('Enter');}
async function exportState(page){return page.$$eval('button',buttons=>buttons.filter(b=>b.textContent.startsWith('Download ')).map(b=>b.disabled));}

test('latest input and preset win every pending stage; downloads wait for one complete analysis',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome(),directory=mkdtempSync(join(tmpdir(),'your-data-staging-'));
 t.after(async()=>{await browser.close();await server.close();rmSync(directory,{recursive:true,force:true});});
 const {page,errors,failed}=await openTab(browser,{origin:server.origin,width:375,height:800});
 const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
 await page.goto(`${server.origin}/embed/your-data.html`);await waitForWidgetIdle(page);
 if(await page.$('details[data-prx-disclosure="input"]:not([open])'))await page.click('details[data-prx-disclosure="input"] summary');await waitForWidgetIdle(page);
 await page.evaluate(()=>{window.__createdBlobs=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{__createdBlobs.push(blob);return create(blob);};__prxApp.applyPreset('league30-posterior');});
 assert.deepEqual(await exportState(page),[true,true,true,true]);
 assert.equal(await page.$eval('.prx-widget',e=>e.getAttribute('aria-busy')),'true');
 // Disabled native buttons cannot export a previous model with the new public settings.
 await page.evaluate(()=>{for(const b of document.querySelectorAll('button'))if(b.textContent.startsWith('Download '))b.click();});
 assert.equal(await page.evaluate(()=>__createdBlobs.length),0);
 // Interrupt after real analysis/card work has begun, then apply a new local input before it finishes.
 await page.waitForFunction(()=>document.querySelector('[data-prx-readout="units"]')?.dataset.num!=='30'&&document.querySelector('.yd-output .prx-data-table tbody')?.rows.length===30,{polling:'mutation'});
 await page.evaluate(()=>{__prxApp.applyPreset('six-probabilities');__prxApp.applyPreset('equal5');__prxApp.applyPreset('league8-posterior');__prxApp.update({tau:.5});});
 await enter(page,localCsv);await apply(page);
 // The reader can edit an invalid draft while the complete last-applied local analysis is staged.
 await enter(page,'id,theta_mean,theta_sd\ninvalid-A,0,0\ninvalid-B,0,1');await apply(page);await waitForWidgetIdle(page);
 assert.equal(await page.evaluate(()=>__prxApp.state.example),'local');
 assert.equal(await page.$eval('[data-prx-readout="units"]',e=>Number(e.dataset.num)),2);
 assert.match(await page.$eval('[data-prx-input-status]',e=>e.textContent),/SD must be above zero/);
 assert.equal(await page.$eval('[data-prx-input]',e=>e.getAttribute('aria-invalid')),'true');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.prxFocusKey),'input:apply');
 assert.equal(await page.$eval('.yd-output',e=>e.textContent.includes('local-stage-A')),true);
 assert.deepEqual(await exportState(page),[false,false,false,false]);
 await page.evaluate(()=>{__prxApp.applyPreset('equal5');__prxApp.applyPreset('league30-posterior');});await waitForWidgetIdle(page);
 assert.deepEqual(await page.$eval('[data-prx-readout="grade"]',e=>e.dataset.num.split(',').map(Number)),league30.optimum.grade);
 assert.equal(await page.$eval('[data-prx-readout="risk"]',e=>Number(e.dataset.num)),league30.optimum.evaluation.risk);
 assert.equal(await page.$$eval('.prx-pm-matrix-chart .prx-kbd-point',rows=>rows.length),900,'complete probability keyboard grid remains available');
 assert.equal(await page.$$eval('.yd-output .prx-data-table tbody tr',rows=>rows.length),30);
 assert.equal(await page.$$eval('[data-prx-readout^="e-"]',cells=>cells.length),870);
 assert.equal(await page.evaluate(()=>typeof PRX_SOLVER),'undefined','no stage starts the optional solver');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.prxFocusKey),'input:apply');
 // Each native download uses the final thirty-unit model and its matching settings/R text.
 await page.click('[role=tab]:last-child');
 for(const button of await page.$$('button'))if((await button.evaluate(b=>b.textContent)).startsWith('Download '))await button.click();
 const blobs=await page.evaluate(()=>Promise.all(__createdBlobs.map(blob=>blob.text())));assert.equal(blobs.length,4);
 const json=JSON.parse(blobs[2]);assert.deepEqual(json.grade,league30.optimum.grade);assert.equal(json.input.ids.length,30);assert.equal(json.settings.example,'league30-posterior');assert.equal(json.settings.tau,.2);assert.equal(json.settings.cap,'3');assert.ok(!blobs.some(text=>text.includes('local-stage-')));assert.equal(blobs[3],await page.$eval('textarea[readonly]',e=>e.value));
 // Destroy during a later stage: detached output must receive no obsolete continuation.
 await page.evaluate(()=>{__prxApp.applyPreset('equal5');window.__detached=__prxApp.root;__prxApp.destroy();window.__destroyedText=__detached.innerHTML;window.__afterDestroy=0;window.__destroyObserver=new MutationObserver(records=>__afterDestroy+=records.length);__destroyObserver.observe(__detached,{subtree:true,childList:true,attributes:true,characterData:true});});
 await new Promise(resolve=>setTimeout(resolve,350));
 assert.equal(await page.evaluate(()=>__afterDestroy),0);assert.equal(await page.evaluate(()=>__detached.innerHTML===__destroyedText),true);assert.equal(await page.evaluate(()=>__detached.getAttribute('aria-busy')),null);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await page.close();
});
