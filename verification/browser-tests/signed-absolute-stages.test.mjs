// The exact R46 reports and R51 observation precision must survive deferred full-view work.
// This is a native Chrome correctness regression; quiet performance budgets are checked separately.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROOT,launchChrome,openTab,startServer,waitForWidgetIdle} from '../browser.mjs';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const target=json('../golden/oracle-v3p5-cases.json').rows.find(r=>r.id==='krw-gender-targets').expect;
const precision=json('../golden/oracle-v3p5-precision.json').rows.find(r=>r.id==='krw-original-sampling-se').expect;
const signed=json('../../data/released/case-krw.json'),absolute=json('../../data/released/krw-absolute-gender.json');
const settle=page=>waitForWidgetIdle(page,{timeout:10000});
const closeTo=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-12,`${actual} != ${expected}`);
const relation=(kind,i,j)=>{switch(kind){case 'withheld':return 'withheld';case 'above':return `${precision.names[i]} above ${precision.names[j]}`;case 'below':return `${precision.names[j]} above ${precision.names[i]}`;default:throw new Error(`Unknown R46 relation ${kind}`)}};
const error=(E,kind,i,j)=>{switch(kind){case 'withheld':return null;case 'above':return E[i][j];case 'below':return E[j][i];default:throw new Error(`Unknown R46 relation ${kind}`)}};
async function fullCards(page){
 const cards=await page.evaluate(()=>{
  const raw=key=>document.querySelector(`[data-prx-readout="${key}"]`).dataset.num;
  return ['signed','absolute'].map((prefix,k)=>{
   const card=document.querySelectorAll('.kr-card-scroll')[k],panel=document.querySelector(`[data-prx-precision="${prefix}"]`),source=panel.querySelector('.kr-precision-source code'),cs=getComputedStyle(source),paper=getComputedStyle(panel);
   return {rows:[...card.querySelectorAll('.prx-data-table tbody tr')].map(r=>r.cells[0].textContent),points:card.querySelectorAll('.prx-kbd-point').length,grade:raw(`${prefix}-grade`).split(',').map(Number),tieCount:Number(raw(`${prefix}-tieCount`)),tieTol:Number(raw(`${prefix}-tieTol`)),family:Number(raw(`${prefix}-familySize`)),precision:[...panel.querySelectorAll('tbody tr')].map(r=>({name:r.cells[0].textContent,id:r.cells[1].textContent,se:Number(r.cells[2].dataset.num),grade:Number(r.cells[3].dataset.num)})),precisionPoints:panel.querySelectorAll('.prx-kbd-point').length,source:source.textContent,fg:cs.color,paper:paper.backgroundColor,folded:panel.textContent.includes('not an SE of the absolute target')};
  });
 });
 for(const[k,c]of cards.entries()){
  const expected=k?target.folded:target.signed;assert.equal(c.rows.length,97);assert.deepEqual([...c.rows].sort(),[...precision.names].sort());assert.equal(c.points,97);assert.deepEqual(c.grade,expected.optimum.grade);assert.equal(c.tieCount,expected.optimum.tieCount);assert.equal(c.tieTol,expected.optimum.tieTol);assert.equal(c.family,expected.optimum.family.size);assert.equal(c.precisionPoints,97);assert.equal(c.source,'gender_se');assert.equal(c.folded,k===1);
  assert.deepEqual(c.precision,precision.ids.map((id,i)=>({id,name:precision.names[i],se:precision.SE[1][i],grade:expected.optimum.grade[i]})));
  const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0),a=lum(c.fg),b=lum(c.paper);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
 }
}
async function fullPairs(page,inspectHooks=true){
 const rows=await page.evaluate(()=>{const t=[...document.querySelectorAll('.kr-scroll table')].find(t=>t.caption?.textContent.startsWith('Complete list of changed'));return [...t.tBodies[0].rows].map(r=>({text:[...r.cells].slice(0,4).map(c=>c.textContent),enums:[r.cells[2].dataset.prxRelation,r.cells[3].dataset.prxRelation],hooks:[...r.cells].slice(4).map(c=>c.querySelector('[data-num]').dataset.prxReadout),error:[...r.cells].slice(4).map(c=>{const raw=c.querySelector('[data-num]').dataset.num;return raw==='null'?null:Number(raw)})}))});
 assert.equal(rows.length,890);
 const expected=target.change.pairs.map(p=>({text:[precision.names[p.i],precision.names[p.j],relation(p.from,p.i,p.j),relation(p.to,p.i,p.j)],enums:[p.from,p.to],hooks:[`signed-pair-error-${p.i}-${p.j}`,`absolute-pair-error-${p.i}-${p.j}`],error:[error(signed.arrays.error.e[1],p.from,p.i,p.j),error(absolute.arrays.error.e[0],p.to,p.i,p.j)]}));
 // Check rendered content before instrumentation, so this same test proves the original numeric/string bug.
 rows.forEach((r,i)=>assert.deepEqual({text:r.text,error:r.error},{text:expected[i].text,error:expected[i].error},`changed pair ${i}: ${target.change.pairs[i].i},${target.change.pairs[i].j}`));
 assert.equal(rows.filter(r=>r.text[2]==='withheld').length,349);assert.equal(rows.filter(r=>r.text[3]==='withheld').length,268);assert.equal(rows.filter(r=>r.text[2]!=='withheld'&&r.text[3]!=='withheld').length,273);
 if(inspectHooks)assert.deepEqual(rows,expected);
}
async function fullFirms(page){
 const rows=await page.$$eval('[data-prx-firm-row]',rs=>rs.map(r=>({name:r.cells[0].textContent,values:[...r.querySelectorAll('[data-num]')].map(n=>Number(n.dataset.num))})));
 assert.equal(rows.length,97);for(const[i,r]of rows.entries()){assert.equal(r.name,precision.names[i]);const expected=[...['mean_gender','lower_gender','upper_gender'].map(key=>signed.tables.units[key][i]),...['mean','lower','upper'].map(key=>absolute.tables.units[key][i]),target.signed.expectedRank[i],target.folded.expectedRank[i],target.signed.optimum.grade[i],target.folded.optimum.grade[i]];r.values.forEach((v,k)=>closeTo(v,expected[k]));}
}
async function preset(page,name){const button=await page.$(`.prx-presets button[data-value="${name}"]`);await button.focus();await page.keyboard.press('Enter');await settle(page);assert.equal(await page.evaluate(()=>document.activeElement.closest('.prx-presets')!==null),true);}

test('signed and absolute changed pairs match all 890 R46 directions and target-law errors',{timeout:30000},async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close()});
 const {page,errors,failed}=await openTab(browser,{origin:server.origin,width:1280,height:800});
 await page.goto(`${server.origin}/embed/signed-or-absolute.html?preset=pairs&theme=light`);await settle(page);await fullPairs(page,false);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
});

test('signed and absolute staged views retain every exact row, latest view and native focus',{timeout:120000},async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close()});
 for(const route of ['embed/signed-or-absolute.html','docs/pages/cases/signed-or-absolute.html'])for(const width of [375,1280])for(const theme of ['light','dark'])await t.test(`${route} ${width}px ${theme}`,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800,scheme:theme});st.after(()=>page.close());
  await page.goto(`${server.origin}/${route}?theme=${theme}`);await settle(page);await page.evaluate(theme=>window.__prxApp.update({theme}),theme);await settle(page);await fullCards(page);
  // Interrupt a genuinely partial table, then rapidly supersede its generation with the latest preset.
  await page.focus('input[data-prx-focus-key="radio:view:1"]');await page.keyboard.press('Space');
  await page.waitForFunction(()=>{const t=[...document.querySelectorAll('.kr-scroll table')].find(t=>t.caption?.textContent.startsWith('Complete list of changed'));return document.querySelector('.prx-widget').getAttribute('aria-busy')==='true'&&t?.tBodies[0].rows.length>0&&t.tBodies[0].rows.length<890});
  await page.evaluate(()=>{const t=[...document.querySelectorAll('.kr-scroll table')].find(t=>t.caption?.textContent.startsWith('Complete list of changed'));window.__firstPairRow=t.tBodies[0].rows[0];window.__prxApp.update({view:'firms'});window.__prxApp.applyPreset('pairs');window.__prxApp.applyPreset('firms')});await settle(page);await fullFirms(page);assert.equal(await page.evaluate(()=>window.__prxApp.state.view),'firms');
  for(const[name,verify]of [['pairs',fullPairs],['cards',fullCards],['firms',fullFirms]]){await preset(page,name);await verify(page);assert.equal(await page.evaluate(()=>window.__prxApp.state.view),name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert.equal(await page.evaluate(()=>window.__firstPairRow.isConnected),true,'Completed cached pair rows stay attached when switching views');
  // A cached view returns the same complete rows rather than reconstructing or truncating it.
  await preset(page,'pairs');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.kr-scroll table')].find(t=>t.caption?.textContent.startsWith('Complete list of changed')).tBodies[0].rows[0]===window.__firstPairRow),true);await fullPairs(page);
  // Theme and width invalidation repaints the full cards while preserving the native preset focus.
  await page.evaluate(theme=>{window.__prxApp.applyPreset('cards');window.__prxApp.update({theme})},theme==='light'?'dark':'light');await page.setViewport({width:width===375?1280:375,height:800});await settle(page);await page.waitForFunction(()=>[...document.querySelectorAll('.kr-card-scroll svg,.kr-precision-chart svg')].every(s=>Number(s.getAttribute('width'))===s.closest('figure').parentElement.clientWidth));await settle(page);await fullCards(page);assert.equal(await page.evaluate(()=>document.activeElement.closest('.prx-presets')!==null),true);
  // Teardown during a new figure generation must cancel every pending stage and leave outside focus alone.
  const destroyed=await page.evaluate(async()=>{window.__prxApp.update({theme:document.querySelector('.prx-widget').dataset.theme==='dark'?'light':'dark'});const root=document.querySelector('.prx-widget');const busy=root.getAttribute('aria-busy');let mutations=0;const observer=new MutationObserver(()=>mutations++);observer.observe(root,{subtree:true,childList:true,attributes:true});window.__prxApp.destroy();const outside=document.createElement('button');outside.textContent='After the app';document.body.append(outside);outside.focus();await new Promise(r=>setTimeout(r,0));mutations=0;await new Promise(r=>setTimeout(r,400));observer.disconnect();return{busy,mutations,focus:document.activeElement===outside}});assert.deepEqual(destroyed,{busy:'true',mutations:0,focus:true});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
