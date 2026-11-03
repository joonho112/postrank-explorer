// Source-backed full-row contract check: relationChange enums differ from the numeric relations() matrix API.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {DOCS,ROOT,startServer,launchChrome,openTab,waitForWidgetIdle} from '../browser.mjs';
import {caseInput} from '../../js/shared/case-inputs.js';
const entry=JSON.parse(readFileSync(join(ROOT,'catalog/entries/T.2-report-designer.json')));
const r49=JSON.parse(readFileSync(join(ROOT,'verification/golden/oracle-v3p5-tools.json'))).rows;
const r46=JSON.parse(readFileSync(join(ROOT,'verification/golden/oracle-v3p5-cases.json'))).rows;
const relation=(grade,i,j)=>grade[i]===grade[j]?'withheld':grade[i]<grade[j]?'above':'below';
function expected(before,after,labels){const out=[];for(let i=0;i<before.length;i++)for(let j=i+1;j<before.length;j++){const a=relation(before,i,j),b=relation(after,i,j);if(a!==b){const words=g=>g[i]===g[j]?'withheld':g[i]<g[j]?`${labels[i]} above ${labels[j]}`:`${labels[j]} above ${labels[i]}`;out.push({i,j,from:a,to:b,text:[labels[i],labels[j],words(before),words(after)]});}}return out;}
async function rows(page){return page.evaluate(()=>{const caption=[...document.querySelectorAll('table caption')].find(e=>e.textContent==='Complete changed-pair list');if(!caption)throw new Error('Complete changed-pair table absent');return [...caption.closest('table').querySelectorAll('tbody tr')].map(r=>[...r.cells].map(e=>e.textContent));});}
test('designer changed-pair directions match complete frozen grades at every public preset and criterion weight endpoint',async t=>{
 const server=await startServer(DOCS),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark'])for(const surface of ['embed','pages/tools'])await t.test(`${width}px ${theme} ${surface}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800});st.after(()=>page.close());await page.goto(`${server.origin}/${surface}/report-designer.html`);await waitForWidgetIdle(page);await page.evaluate(theme=>__prxApp.update({theme}),theme);await waitForWidgetIdle(page);
  for(const preset of entry.presets){await page.click(`.prx-presets button[data-value="${preset.id}"]`);await waitForWidgetIdle(page);await page.click('[data-prx-focus-key="radio:view:1"]');await waitForWidgetIdle(page);const frozen=r49.find(r=>r.id==='tool-designer-'+preset.id),input=caseInput(frozen.args.case),want=expected(frozen.expect.archive.grade,frozen.expect.optimum.grade,input.labels);assert.deepEqual(want.map(({i,j,from,to})=>({i,j,from,to})),frozen.expect.change.pairs.map(({i,j,from,to})=>({i,j,from,to})),'independent numeric-grade derivation agrees with R49 enums');assert.deepEqual(await rows(page),want.map(r=>r.text),`${preset.id} complete changed-pair direction rows`);}
  for(const key of ['krw','alabama'])for(const w of [0,1]){await page.click(`.prx-presets button[data-value="${key}"]`);await waitForWidgetIdle(page);await page.click('[data-prx-focus-key="radio:view:1"]');await waitForWidgetIdle(page);await page.focus('input[name=w]');await page.keyboard.press(w===0?'Home':'End');await waitForWidgetIdle(page);const fixture=r46.find(r=>r.id===(key==='krw'?'krw-two-w':'alabama-live-w')+w),input=caseInput(key),grade=key==='krw'?fixture.expect.live.grade:fixture.expect.optimum.grade;assert.deepEqual(await rows(page),expected(input.archive.grade,grade,input.labels).map(r=>r.text),`${key} weight${w} complete changed-pair rows`);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
