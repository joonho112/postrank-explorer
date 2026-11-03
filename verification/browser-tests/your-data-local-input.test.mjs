// Production T.1 workflow; no calculation mock and no UI-generated scientific expectation.
// Native entry + atomic validation, public resets through native/API/iframe paths, local reload, Blob exports,
// and an actual bounded two-unit HiGHS solve. Expected reports use independent R44/R49 fixtures.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ROOT,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';
import {csvText,parseCsv} from '../../js/shared/your-data-input.js';
const row=(file,id)=>JSON.parse(readFileSync(join(ROOT,'verification/golden',file))).rows.find(r=>r.id===id).expect;
const league=row('oracle-v3p5-tools.json','tool-your-league8-posterior');
const tied=row('oracle-v3p5-krw.json','krw-correspondence-pair-e0.5');
const secret='LOCAL_ONLY 서울, "A"; system("unused")';
const localCsv=csvText([['id','theta_mean','theta_sd'],[secret,0,1],['001',0,1]]);
const grade=page=>page.$eval('[data-prx-readout="grade"]',n=>n.dataset.num.split(',').map(Number));
async function clickText(page,text){for(const button of await page.$$('button'))if(await button.evaluate(n=>n.textContent)===text){await button.click();return}throw new Error(`Missing button ${text}`)}
async function enter(page,text){await page.focus('[data-prx-input]');await page.$eval('[data-prx-input]',n=>n.select());await page.keyboard.sendCharacter(text);}
async function clearNativeNumber(page,selector){await page.focus(selector);await page.keyboard.press('a',{commands:['selectAll']});await page.keyboard.press('Backspace');assert.equal(await page.$eval(selector,n=>n.value),'','native SelectAll cleared the entire numeric field');}
async function nativeNumber(page,selector,value){await clearNativeNumber(page,selector);await page.keyboard.type(String(value));}
async function fileReady(path){for(let i=0;i<100;i++){if(existsSync(path))return;await new Promise(r=>setTimeout(r,20));}throw new Error(`Download did not complete: ${path}`)}

test('local input stays private and public presets restore complete examples through every production path',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome(),directory=mkdtempSync(join(tmpdir(),'your-data-workflow-'));
 t.after(async()=>{await browser.close();await server.close()});
 const findings=[];
 for(const{width,theme,kind}of[{width:375,theme:'light',kind:'embed'},{width:1280,theme:'dark',kind:'page'}])await t.test(`${width}px ${theme} ${kind}`,async tt=>{
  const{page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800,scheme:theme});tt.after(()=>page.close());
  const route=`${kind==='page'?'docs/pages/tools':'embed'}/your-data.html`,downloads=join(directory,`${width}-${theme}`);mkdirSync(downloads);
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const requested=[];page.on('request',request=>requested.push(request.url()));
  await page.goto(`${server.origin}/${route}?theme=${theme}`);await waitForWidgetIdle(page);
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.body.dataset.bsTheme=theme;__prxApp.update({theme})},theme);
  assert.deepEqual(await grade(page),league.optimum.grade);assert.equal(await page.evaluate(()=>typeof PRX_SOLVER),'undefined');
  await page.evaluate(()=>__prxApp.applyPreset('league8-normal'));await nativeNumber(page,'input[name="priorSd"]',.15);await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>__prxApp.state.priorSd),.15,'native fractional prior SD is not clamped during entry');assert.equal(await page.$('.yd-error'),null);
  await page.evaluate(()=>__prxApp.applyPreset('league8-posterior'));
  await nativeNumber(page,'input[name="tau"]',.5);
  await enter(page,localCsv);await page.keyboard.down('Control');await page.keyboard.press('Enter');await page.keyboard.up('Control');await waitForWidgetIdle(page);
  assert.deepEqual(await grade(page),tied.postrank.grade);assert.equal(await page.$eval('[data-prx-readout="risk"]',n=>Number(n.dataset.num)),tied.postrank.risk);assert.equal(await page.$eval('[data-prx-readout="tie-count"]',n=>Number(n.dataset.num)),tied.postrank.tieCount);
  assert.equal(await page.evaluate(()=>__prxApp.state.example),'local');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-prx-input')),true,'Ctrl+Enter applies without moving native focus');
  assert.ok(await page.evaluate(s=>document.querySelector('.yd-output').textContent.includes(s),secret));
  assert.equal(await page.evaluate(s=>JSON.stringify(__prxApp.state).includes(s)||location.href.includes(encodeURIComponent(s))||Object.values(localStorage).some(x=>x.includes(s))||Object.values(sessionStorage).some(x=>x.includes(s)),secret),false);
  assert.equal(await page.$eval('[data-prx-readout="EoverN-0"]',n=>n.dataset.num),'NA');
  // Invalid drafts remain editable and preserve the complete previous report.
  const before=await grade(page);await enter(page,'id,theta_mean,theta_sd\nA,0,0\nB,0,1');await clickText(page,'Apply this input');
  const error=await page.$eval('[data-prx-input-status]',n=>n.textContent);assert.ok(error.includes('Row 2, theta_sd: SD must be above zero.'));
  if(error.startsWith('null'))findings.push(`${width}/${kind}: validation prefix is literal null`);
  assert.deepEqual(await grade(page),before);assert.ok(await page.$eval('[data-prx-input]',n=>n.value.includes('A,0,0')));
  await enter(page,localCsv);await clickText(page,'Apply this input');await waitForWidgetIdle(page);
  // A blank setting and otherwise-valid new CSV cannot commit a partial analysis using the old numeric state.
  await clearNativeNumber(page,'input[name="tau"]');await enter(page,'id,theta_mean,theta_sd\nreplacement-A,0,1\nreplacement-B,0,1');await clickText(page,'Apply this input');
  assert.ok(await page.$eval('[data-prx-input-status]',n=>n.textContent.includes('missing')));assert.ok(await page.$eval('.yd-output',(n,s)=>n.textContent.includes(s),secret));assert.deepEqual(await grade(page),before);
  await nativeNumber(page,'input[name="tau"]',.5);await enter(page,localCsv);await clickText(page,'Apply this input');await waitForWidgetIdle(page);
  // Exact local Blob exports: input IDs survive quoting; no data go to a server.
  for(const label of['Download grades CSV','Download error probabilities CSV','Download complete analysis JSON','Download R code'])await clickText(page,label);
  for(const file of['postrank-grades.csv','postrank-errors.csv','postrank-analysis.json','postrank-analysis.R'])await fileReady(join(downloads,file));
  const exported=JSON.parse(readFileSync(join(downloads,'postrank-analysis.json')));assert.deepEqual(exported.input.ids,[secret,'001']);assert.deepEqual(exported.grade,tied.postrank.grade);assert.equal(exported.evaluation.EoverN[0],null);assert.equal(exported.settings.tau,.5);
  const csv=parseCsv(readFileSync(join(downloads,'postrank-grades.csv'),'utf8'));assert.deepEqual(csv.slice(1).map(row=>row[0]),[secret,'001']);assert.ok(readFileSync(join(downloads,'postrank-errors.csv'),'utf8').includes('0.5'));
  const r=readFileSync(join(downloads,'postrank-analysis.R'),'utf8');assert.ok(r.includes('postrank_probabilities'));assert.ok(r.includes('entered_input'));assert.ok(r.includes('browser_grade'));
  assert.ok(requested.every(url=>!url.includes(encodeURIComponent(secret))&&!url.includes('LOCAL_ONLY')));
  // A real tiny solve keeps the supplied scientific inputs and returns an independent member of the full set.
  await page.evaluate(()=>__prxApp.update({cap:'all',timeLimit:.2}));await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>typeof PRX_SOLVER),'undefined');
  await page.focus('[data-prx-solve]');await page.keyboard.press('Enter');await page.waitForSelector('[data-prx-solver-status]');await waitForWidgetIdle(page);
  assert.equal(await page.$eval('[data-prx-solver-status]',n=>n.textContent),'optimal');assert.ok(tied.postrank.grades.some(g=>JSON.stringify(g)===JSON.stringify(exported.grade)));
  const solvedGrade=await grade(page);assert.ok(tied.postrank.grades.some(g=>JSON.stringify(g)===JSON.stringify(solvedGrade)));assert.equal(await page.$eval('[data-prx-readout="risk"]',n=>Number(n.dataset.num)),tied.postrank.risk);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-prx-focus-key')),'solver:solve');
  // Complete API restore, then same-preset native restore even when public keys did not change.
  await page.evaluate(()=>__prxApp.applyPreset('league8-posterior'));await waitForWidgetIdle(page);assert.deepEqual(await grade(page),league.optimum.grade);assert.equal(await page.evaluate(()=>__prxApp.state.tau),.2);assert.equal(await page.evaluate(()=>__prxApp.state.cap),'3');
  await nativeNumber(page,'input[name="tau"]',.3);await enter(page,localCsv);await clickText(page,'Eight posterior summaries');assert.equal(await page.evaluate(()=>__prxApp.state.tau),.2,'same-preset native activation resets scientific settings');assert.equal(await page.$eval('[data-prx-input]',(n,s)=>n.value.includes(s),secret),false,'native same-preset activation restores the public CSV');
  // Reopening only the approved local marker contains no saved input and shows no fabricated public report.
  await page.goto(`${server.origin}/${route}?example=local&format=posterior&tau=.5&cap=all&weights=1&orient=1`);await waitForWidgetIdle(page);assert.equal(await page.$('[data-prx-readout="grade"]'),null);assert.ok(await page.$eval('.prx-readout',n=>n.textContent.includes('Pasted input was not stored')));
  assert.equal(await page.evaluate(s=>document.body.textContent.includes(s),secret),false);
  // Actual parent→iframe messages call the wrapped dynamic update method, including an unchanged preset.
  await page.evaluate(origin=>{window.__captured=[];addEventListener('message',e=>__captured.push(e.data));const f=document.createElement('iframe');f.id='tool-frame';f.src=origin+'/embed/your-data.html?preset=league8-posterior';document.body.append(f)},server.origin);
  const frameElement=await page.waitForSelector('#tool-frame'),frame=await frameElement.contentFrame();await frame.waitForSelector('[data-prx-input]');
  await frame.$eval('[data-prx-input]',(n,text)=>{n.value=text;n.dispatchEvent(new Event('input',{bubbles:true}))},localCsv);
  await page.evaluate(()=>document.getElementById('tool-frame').contentWindow.postMessage({prx:{preset:'league8-posterior',csv:'MUST_BE_IGNORED',input:'MUST_BE_IGNORED'}},'*'));
  await frame.waitForFunction(()=>!document.querySelector('[data-prx-input]').value.includes('LOCAL_ONLY'),{polling:'mutation'});
  assert.equal(await frame.evaluate(()=>Object.hasOwn(__prxApp.state,'csv')||Object.hasOwn(__prxApp.state,'input')),false);
  assert.equal(await page.evaluate(s=>JSON.stringify(__captured).includes(s),secret),false);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
 assert.deepEqual(findings,[],'initial-reader validation-prefix regression');
});
