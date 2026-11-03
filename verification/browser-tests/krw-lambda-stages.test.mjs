// Full lambda-grid staging keeps the released rows and complete matrix through cancellation.
// Numerical expectations are frozen independent R46 rows; this test makes no CPU timing claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOCS,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';
const catalog=JSON.parse(readFileSync(new URL('../../catalog.json',import.meta.url),'utf8'));
const app=catalog.apps.find(a=>a.name==='krw-lambda');
const oracle=JSON.parse(readFileSync(new URL('../golden/oracle-v3p5-cases.json',import.meta.url),'utf8')).rows;
const ref=(criterion,index)=>oracle.find(r=>r.id===`krw-grid-${criterion}-${String(index).padStart(3,'0')}`).expect;
const near=(actual,expected)=>expected===null?assert.equal(actual,'NA'):assert.ok(Math.abs(Number(actual)-expected)<=1e-12,`${actual} versus independent ${expected}`);
async function complete(page){
 const actual=await page.evaluate(()=>{
  const raw=key=>document.querySelector(`[data-prx-readout="${key}"]`)?.dataset.num;
  const matrix=document.querySelector('.kr-map'),charts=[...document.querySelectorAll('.prx-chart')].map(e=>e.parentElement).filter(e=>e!==matrix&&e.__prxChart),table=document.querySelector('.kr-table-wrap table');
  return {state:__prxApp.state,rows:[...table.tBodies[0].rows].map(r=>[...r.cells].map(c=>c.querySelector('[data-num]').dataset.num)),selected:table.querySelector('[aria-current=true]')?.dataset.prxGridRow,
   chartRows:charts.map(c=>c.querySelectorAll('tbody tr').length),chartPoints:charts.map(c=>c.__prxChart.points.length),firms:matrix.querySelectorAll('tbody tr').length,matrixPoints:matrix.__prxChart.points.length,
   canvases:matrix.querySelectorAll('canvas').length,cells:matrix.querySelector('canvas').__matrixCells,
   lambda:raw('ro-lambda'),risk:raw('ro-risk'),N:raw('ro-N'),G:raw('ro-G'),doubtful:raw('matrix-doubtful-count'),probabilities:[...document.querySelectorAll('[data-prx-readout^=matrix-doubtful-error-]')].map(e=>Number(e.dataset.num)),
   first:raw('first-lambda'),other:raw('first-other-firms'),theme:document.documentElement.dataset.theme,progress:document.querySelector('.kr-progress').textContent,progressHeight:document.querySelector('.kr-progress').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 const index=Math.round(actual.state.lambda*100),expected=ref(actual.state.criterion,index);
 assert.equal(actual.rows.length,101);assert.equal(actual.selected,String(index));assert.deepEqual(actual.chartRows,[100,100,100,100]);assert.deepEqual(actual.chartPoints,[100,100,100,100]);assert.equal(actual.firms,97);assert.equal(actual.matrixPoints,97);assert.equal(actual.canvases,1);assert.equal(actual.cells,97*97);
 for(let i=0;i<101;i++){
  const r=ref(actual.state.criterion,i),e=r.evaluation,values=[r.lambda,e.G,e.N,e.s,r.DR,e.EoverN[0],e.risk,r.tau===0?null:r.tau];
  values.forEach((v,k)=>near(actual.rows[i][k],v));
 }
 near(actual.lambda,expected.lambda);near(actual.risk,expected.evaluation.risk);near(actual.N,expected.evaluation.N);near(actual.G,expected.evaluation.G);near(actual.doubtful,actual.probabilities.length);assert.ok(actual.probabilities.every(p=>p>.5));
 if(actual.state.criterion==='gender'&&index===25){const half=oracle.find(r=>r.id==='krw-gender-baseline-stated-half').expect;near(actual.doubtful,half.count);actual.probabilities.forEach((p,i)=>near(p,half.pairs[i].error));}
 if(index===100)near(actual.doubtful,expected.statedAbove.count);
 near(actual.first,oracle.find(r=>r.id.startsWith(`krw-grid-${actual.state.criterion}-`)&&r.expect.evaluation.G>1).expect.lambda);near(actual.other,96);assert.equal(actual.progress,'');assert.ok(actual.progressHeight>0);assert.equal(actual.overflow,false);
 return actual;
}

test('KRW lambda completes every chart, row and pair after native presets, rapid updates and destroy',{timeout:120000},async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close()});
 for(const surface of ['page','embed'])for(const width of [375,1280])for(const theme of ['light','dark'])await t.test(`${surface} ${width} ${theme}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812,scheme:theme});st.after(()=>page.close());
  await page.evaluateOnNewDocument(()=>{
   const fill=CanvasRenderingContext2D.prototype.fillRect,clear=CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){this.canvas.__matrixCells=0;return clear.apply(this,args)};
   CanvasRenderingContext2D.prototype.fillRect=function(...args){this.canvas.__matrixCells=(this.canvas.__matrixCells||0)+1;return fill.apply(this,args)};
  });
  const route=surface==='page'?'pages/cases/krw-lambda.html':'embed/krw-lambda.html';
  await page.goto(`${server.origin}/${route}?theme=${theme}`);await waitForWidgetIdle(page);
  await page.evaluate(theme=>__prxApp.update({theme}),theme);await waitForWidgetIdle(page);assert.equal((await complete(page)).theme,theme);
  for(const preset of app.presets){
   const buttons=await page.$$('[data-prx-part=presets] button');let target;
   for(const button of buttons)if(await button.evaluate((b,label)=>b.textContent===label,preset.label)){target=button;break;}
   assert.ok(target);await target.focus();await page.keyboard.press('Enter');await waitForWidgetIdle(page);await complete(page);assert.equal(await page.evaluate(()=>document.activeElement.textContent),preset.label);
  }
  await page.focus('input[name=lambda]');await page.keyboard.press('Home');await waitForWidgetIdle(page);near((await complete(page)).lambda,.01);
  await page.keyboard.press('End');await waitForWidgetIdle(page);near((await complete(page)).lambda,1);assert.equal(await page.evaluate(()=>document.activeElement.name),'lambda');
  for(const value of ['estimate','krw','mean']){await page.focus(`input[data-prx-focus-key="radio:sort:${['mean','estimate','krw'].indexOf(value)}"]`);await page.keyboard.press('Space');await waitForWidgetIdle(page);assert.equal((await complete(page)).state.sort,value);}
  await page.evaluate(()=>__prxApp.update({lambda:1/3}));await waitForWidgetIdle(page);assert.equal((await complete(page)).state.lambda,1/3);
  // Reused rows are the same complete table, while the selected row follows the latest state.
  await page.evaluate(()=>{window.__retainedGrid=document.querySelector('.kr-table-wrap table');__prxApp.update({lambda:.08});__prxApp.update({criterion:'race',lambda:.98,sort:'estimate'});const outside=document.createElement('button');outside.id='outside';outside.textContent='Outside';document.body.append(outside);outside.focus()});
  assert.equal(await page.$eval('.prx-widget',e=>e.getAttribute('aria-busy')),'true');await waitForWidgetIdle(page);await complete(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'outside');
  await page.evaluate(()=>{window.__raceGrid=document.querySelector('.kr-table-wrap table');__prxApp.update({lambda:.99})});await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>__raceGrid===document.querySelector('.kr-table-wrap table')),true);
  // A later target cancels in-progress paint and exposes only that target on completion.
  await page.evaluate(()=>{__prxApp.update({criterion:'gender',lambda:.25,sort:'krw'});setTimeout(()=>__prxApp.update({criterion:'race',lambda:.08,sort:'mean'}),45);setTimeout(()=>__prxApp.update({criterion:'gender',lambda:1,sort:'estimate'}),95)});await page.waitForFunction(()=>__prxApp.state.criterion==='gender'&&__prxApp.state.lambda===1);await waitForWidgetIdle(page);const latest=await complete(page);assert.equal(latest.state.sort,'estimate');
  const destroyed=await page.evaluate(async()=>{__prxApp.update({criterion:'race',lambda:.3});const root=document.querySelector('.prx-widget'),observer=new MutationObserver(()=>mutations++);let mutations=0;observer.observe(root,{subtree:true,attributes:true,childList:true});__prxApp.destroy();await new Promise(r=>setTimeout(r,0));mutations=0;await new Promise(r=>setTimeout(r,180));observer.disconnect();return{mutations,charts:root.querySelectorAll('.prx-chart').length}});assert.deepEqual(destroyed,{mutations:0,charts:0});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
