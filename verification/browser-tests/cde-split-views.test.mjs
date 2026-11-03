// Native split-view regression, with science pinned to frozen independent R46.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOCS,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';
const rows=JSON.parse(readFileSync(new URL('../golden/oracle-v3p5-cases.json',import.meta.url),'utf8')).rows;
const oracle=id=>rows.find(r=>r.id===id).expect;
const catalog=JSON.parse(readFileSync(new URL('../../catalog.json',import.meta.url),'utf8'));
const names=['cde-cuts','cde-one-disclosure','cde-pair','cde-tau-path'];
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12,`${a} versus independent ${b}`);

test('CDE split views retain every school, complete distribution and boundary through native presets and controls',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();
 t.after(async()=>{await browser.close();await server.close();});
 let contexts=0,nativeEvents=0;
 for(const name of names)for(const width of [1280,375])for(const theme of ['light','dark'])for(const surface of ['page','embed']){
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:812,scheme:theme});
  try{
   const path=surface==='page'?`pages/cases/${name}.html`:`embed/${name}.html`;
   await page.goto(`${server.origin}/${path}?theme=${theme}`,{waitUntil:'load'});await waitForWidgetIdle(page);
   await page.evaluate(()=>{window.__cdeTrusted=0;document.querySelector('.prx-widget').addEventListener('keydown',e=>{if(e.isTrusted)__cdeTrusted++},true);document.querySelector('.prx-widget').addEventListener('click',e=>{if(e.isTrusted)__cdeTrusted++},true);});
   for(const preset of catalog.apps.find(a=>a.name===name).presets){
    // Segmented buttons use data-value in some parent controls. Find by the actual public label.
    const buttons=await page.$$('[data-prx-part=presets] button');let target=null;
    for(const b of buttons)if(await b.evaluate((n,label)=>n.textContent===label,preset.label)){target=b;break;}
    assert.ok(target,`native preset ${preset.id}`);await target.focus();await page.keyboard.press('Enter');await waitForWidgetIdle(page);
    const actual=await page.evaluate(()=>{const r=document.querySelector('.prx-widget'),x=r.__prxResults;return{
     schools:r.querySelectorAll('.prx-cd-card-chart table tbody tr').length,
     grade:[...r.querySelectorAll('[data-prx-readout^=school-grade-]')].map(e=>[e.dataset.prxReadout,+e.dataset.num]),
     count:x.distribution?.count,bins:x.histogram?.bins,
     boundaries:x.pathChanges?.boundaries,changes:x.pathChanges?.changes.map(c=>({stated:c.nNewDisclosed,withheld:c.nNewWithheld,reversed:c.nReversed,pairs:c.pairs.length})),
     evaluation:{N:x.evaluation.N,risk:x.evaluation.risk},overflow:document.documentElement.scrollWidth>innerWidth,
     focus:document.activeElement?.textContent,
    }});
    assert.equal(actual.schools,12);assert.equal(actual.grade.length,12);assert.equal(new Set(actual.grade.map(x=>x[0])).size,12);assert.equal(actual.overflow,false);assert.equal(actual.focus,preset.label,'staged completion preserves the pressed button focus');
    if(name==='cde-one-disclosure'){const ref=oracle('cde-complete-N48');assert.equal(actual.count,ref.count);assert.deepEqual(actual.bins,ref.bins);assert.equal(actual.bins.reduce((s,b)=>s+b.count,0),34650);}
    if(name==='cde-tau-path'){const ref=oracle('cde-complete-frontier');actual.boundaries.forEach((v,i)=>near(v,ref.endpointOptima[i].tau));assert.deepEqual(actual.changes,ref.pathChanges.map(c=>({stated:c.nNewDisclosed,withheld:c.nNewWithheld,reversed:c.nReversed,pairs:c.pairs.length})));}
    if(name==='cde-cuts'&&preset.id==='tertiles'){const ref=oracle('cde-cut-reports').reports[0];assert.equal(actual.evaluation.N,ref.evaluation.N);near(actual.evaluation.risk,ref.evaluation.risk);}
   }
   // The real native range reaches both exact endpoints and keeps focus after the full staged work.
   await page.focus('input[name=tau]');await page.keyboard.press('Home');await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>__prxApp.state.tau),.01);
   await page.keyboard.press('End');await waitForWidgetIdle(page);assert.equal(await page.evaluate(()=>__prxApp.state.tau),.5);
   assert.equal(await page.evaluate(()=>document.activeElement.name),'tau');
   nativeEvents+=await page.evaluate(()=>__cdeTrusted);contexts++;
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  }finally{await page.close();}
 }
 assert.equal(contexts,32);assert.ok(nativeEvents>=192,`${nativeEvents} trusted events`);
});
