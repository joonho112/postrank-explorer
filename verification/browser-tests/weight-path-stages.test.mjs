// Full risk views must remain complete and responsive while their endpoint tables are staged.
// CPU probes wrap the app's 20 ms timer callbacks and real control events, including a final
// widget geometry read. They measure callback + pending style/layout, not raster paint.
// The browser-regression runner is serial so CPU x4 does not measure other test files.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROOT,launchChrome,openTab,startServer} from '../browser.mjs';
const rows=name=>JSON.parse(readFileSync(new URL(`../golden/${name}.json`,import.meta.url),'utf8')).rows;
const r35=rows('oracle-v3p4'),r37=rows('oracle-v3p4-profiles');
const lattice=r35.find(r=>r.id==='settings-six-small-full').expect.rows;
const all=lattice.find(r=>r.tau===.35&&r.cap===6&&r.w[0]===.5);
const allCount=r35.find(r=>r.id==='constrained-six-coherence-all').expect.baseFamilySize;
const bOnly=r37.find(r=>r.id==='two-scores-w0-1').expect;
const balanced=r37.find(r=>r.id==='two-scores-w0.5-0.5').expect;
const settle=page=>page.waitForFunction(()=>window.__prxApp&&document.querySelector('.prx-widget').getAttribute('aria-busy')!=='true',{timeout:3500});
async function numericReport(page,app,expected,index=0){
 const prefix=app==='weight-path'?'':'weighted-';
 const actual=await page.evaluate(({prefix,index})=>{const raw=k=>document.querySelector(`[data-prx-readout="${prefix}${k}-${index}"]`).dataset.num;return{grade:raw('grade').split(',').map(Number),risk:Number(raw('risk')),N:Number(raw('N'))}},{prefix,index});
 assert.deepEqual(actual.grade,expected.grade);assert.ok(Math.abs(actual.risk-expected.evaluation.risk)<=1e-12);assert.equal(actual.N,expected.evaluation.N);
}
async function geometry(page,expectedRows){
 const g=await page.evaluate(()=>{
  const svg=[...document.querySelectorAll('svg')].find(s=>s.getAttribute('aria-label')?.startsWith('Every eligible report')&&!s.closest('[hidden]'));
  const owner=svg.closest('figure').parentElement.parentElement,chart=owner.__prxChart.handle;
  const table=[...document.querySelectorAll('.wpath-all-endpoints table')].find(t=>!t.closest('[hidden]'));
  const path=svg.querySelector('g[aria-label=line][clip-path] path'),d=path.getAttribute('d');
  const segments=[...d.matchAll(/M([^ML]+)L([^ML]+)/g)].map(m=>[...m[1].split(',').map(Number),...m[2].split(',').map(Number)]);
  const data=[...table.tBodies[0].rows],x=chart.scale('x'),y=chart.scale('y');let maxError=0;
  data.forEach((r,i)=>{const p=segments[i];if(!p){maxError=Infinity;return}const expected=[x.apply(0),y.apply(Number(r.cells[2].dataset.num)),x.apply(1),y.apply(Number(r.cells[1].dataset.num))];p.forEach((v,k)=>maxError=Math.max(maxError,Math.abs(v-expected[k])))});
  const exported=new DOMParser().parseFromString(chart.exportSVG(),'image/svg+xml'),exportPath=exported.querySelector('g[aria-label=line][clip-path] path');
  return{rows:data.length,uniqueRows:new Set(data.map(r=>r.cells[0].dataset.num)).size,segments:segments.length,maxError,invalid:/NaN|Infinity/.test(d),keyboard:owner.__prxChart.points.length,exportSegments:(exportPath.getAttribute('d').match(/M/g)||[]).length,exportClip:exportPath.parentElement.closest('[clip-path]').getAttribute('clip-path'),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert.equal(g.rows,expectedRows);assert.equal(g.uniqueRows,expectedRows);assert.equal(g.segments,expectedRows);assert.equal(g.keyboard,expectedRows);assert.equal(g.exportSegments,expectedRows);assert.ok(g.exportClip);assert.ok(g.maxError<=.00051,JSON.stringify(g));assert.equal(g.invalid,false);assert.equal(g.overflow,false);
}
async function cursorPositions(page){
 const positions=await page.evaluate(()=>[...document.querySelectorAll('svg')].filter(s=>s.getAttribute('aria-label')?.startsWith('Each criterion expected')||s.getAttribute('aria-label')?.startsWith('The number of stated')).map(s=>{const chart=s.closest('figure').parentElement.parentElement.__prxChart.handle,line=s.querySelector('g[aria-label=rule] line');return{actual:Number(line.getAttribute('x1')),expected:chart.scale('x').apply(window.__prxApp.state.w)}}));
 for(const p of positions)assert.ok(Math.abs(p.actual-p.expected)<1e-9);
}
async function accessibleRows(cdp,expected){
 await cdp.send('Accessibility.enable');
 try{
  const doc=await cdp.send('DOM.getDocument',{depth:0}),{nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.wpath-all-endpoints table'}),{node}=await cdp.send('DOM.describeNode',{nodeId});
  const partial=await cdp.send('Accessibility.getPartialAXTree',{backendNodeId:node.backendNodeId,fetchRelatives:true}),table=partial.nodes.find(n=>n.backendDOMNodeId===node.backendNodeId);
  assert.equal(table.ignored,false);assert.equal(table.role.value,'table');
  const queue=[table],seen=new Set(),found=new Set();
  while(queue.length){const parent=queue.shift();if(seen.has(parent.nodeId))continue;seen.add(parent.nodeId);const {nodes}=await cdp.send('Accessibility.getChildAXNodes',{id:parent.nodeId});for(const n of nodes){if(n.role?.value==='row')found.add(n.nodeId);else if(n.nodeId!==parent.nodeId&&n.childIds?.length&&['rowgroup','generic','none'].includes(n.role?.value))queue.push(n)}}
  assert.equal(found.size,expected+1,'Every body row and the header remain in the accessibility tree');
 }finally{await cdp.send('Accessibility.disable')}
}
test('Complete risk stages preserve all rows, exports, latest state and focus',{timeout:120000},async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close()});
 for(const config of[{app:'weight-path',width:1280,theme:'light',route:'embed/weight-path.html'},{app:'worst-criterion',width:375,theme:'dark',route:'docs/pages/criteria/worst-criterion.html'}])await t.test(config.app,async st=>{
  const {page,errors,failed}=await openTab(browser,{origin:server.origin,width:config.width,height:800,scheme:config.theme});st.after(()=>page.close());
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(()=>{
   const original=window.setTimeout.bind(window);globalThis.__stageProbe={active:false,tasks:[],events:[],original};
   window.setTimeout=(fn,delay=0,...args)=>typeof fn!=='function'?original(fn,delay,...args):original(()=>{const t=performance.now();try{fn(...args)}finally{if(__stageProbe.active&&delay===20){document.querySelector('.prx-widget')?.getBoundingClientRect();const ms=performance.now()-t,table=[...document.querySelectorAll('.wpath-all-endpoints table')].find(t=>!t.closest('[hidden]'));__stageProbe.tasks.push({ms,rows:table?.tBodies[0].rows.length,busy:document.querySelector('.prx-widget')?.getAttribute('aria-busy'),progress:document.querySelector('.wpath-status')?.textContent})}}},delay);
   const relevant=e=>e.type==='keydown'?e.target.name==='w':Boolean(e.target.closest('.prx-controls'));
   for(const type of ['click','change','keydown']){window.addEventListener(type,e=>{if(__stageProbe.active&&relevant(e)){__stageProbe.start=performance.now();__stageProbe.eventStart=__stageProbe.start}},true);window.addEventListener(type,e=>{if(__stageProbe.active&&relevant(e)){document.querySelector('.prx-widget').getBoundingClientRect();__stageProbe.events.push({type,ms:performance.now()-__stageProbe.start})}})}
  });
  await page.goto(`${server.origin}/${config.route}?theme=${config.theme}`);await settle(page);
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.__prxApp.update({theme,w:.5,tau:.35,cap:'3'})},config.theme);await settle(page);
  const cdp=await page.createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(app=>{const control=app==='weight-path'?[...document.querySelectorAll('.prx-controls button')].find(b=>b.textContent.trim()==='No cap'):[...document.querySelectorAll('.prx-controls select')].find(s=>[...s.options].some(o=>o.textContent==='No cap'));control.dataset.stageCapControl='true';control.focus();__stageProbe.active=true;__stageProbe.tasks=[];__stageProbe.events=[]},config.app);
  if(config.app==='weight-path')await page.keyboard.press('Space');else{const value=await page.$eval('[data-stage-cap-control]',s=>[...s.options].find(o=>o.textContent==='No cap').value);await page.select('[data-stage-cap-control]',value)}
  await settle(page);
  const timed=await page.evaluate(()=>({events:__stageProbe.events,tasks:__stageProbe.tasks,total:performance.now()-__stageProbe.eventStart,focus:document.activeElement.hasAttribute('data-stage-cap-control')}));
  assert.ok(timed.events.length);assert.ok(timed.tasks.length);assert.ok(timed.total<3000);assert.equal(timed.focus,true);
  for(const item of [...timed.events,...timed.tasks])assert.ok(item.ms<=150,JSON.stringify(timed));
  assert.ok(timed.tasks.some(s=>s.rows>0&&s.rows<4683));for(const s of timed.tasks)if(s.rows<allCount)assert.equal(s.busy,'true');for(const s of timed.tasks)if(s.busy==='true')assert.equal(s.progress,'Updating reports…');const progress=await page.$eval('.wpath-status',e=>({text:e.textContent,height:e.getBoundingClientRect().height,live:e.hasAttribute('aria-live')||e.getAttribute('role')==='status'}));assert.equal(progress.text,'');assert.ok(progress.height>0);assert.equal(progress.live,false);
  await numericReport(page,config.app,all);await page.focus('[name=w]');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  const keys=await page.evaluate(()=>__stageProbe.events.filter(e=>e.type==='keydown'));for(const k of keys)assert.ok(k.ms<=150,JSON.stringify(keys));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await page.evaluate(()=>{__stageProbe.active=false});
  await geometry(page,allCount);await accessibleRows(cdp,allCount);if(config.app==='weight-path')await cursorPositions(page);
  // Abort a partially attached uncapped model. The final values are independent R37 pins.
  await page.evaluate(()=>window.__prxApp.applyPreset('w0'));await settle(page);
  await page.evaluate(()=>window.__prxApp.update({cap:'all',tau:.217}));
  await page.waitForFunction(()=>{const t=[...document.querySelectorAll('.wpath-all-endpoints table')].find(t=>!t.closest('[hidden]'));return document.querySelector('.prx-widget').getAttribute('aria-busy')==='true'&&t?.tBodies[0].rows.length>0&&t.tBodies[0].rows.length<4683});
  await page.evaluate(()=>{window.__prxApp.update({tau:.283,cap:'3'});window.__prxApp.applyPreset('w0')});await settle(page);
  await page.evaluate(()=>new Promise(r=>__stageProbe.original(r,120)));await geometry(page,bOnly.optimum.familySize);
  for(let i=0;i<bOnly.profiles.length;i++)await numericReport(page,config.app,bOnly.profiles[i],i);
  await page.focus('[name=w]');await page.evaluate(()=>window.__prxApp.update({w:.5}));await settle(page);await numericReport(page,config.app,balanced.profiles[0]);if(config.app==='weight-path')await cursorPositions(page);
  await page.setViewport({width:config.width===1280?375:1280,height:800});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.__prxApp.update({theme})},config.theme==='light'?'dark':'light');await settle(page);
  await page.waitForFunction(()=>{const s=[...document.querySelectorAll('svg')].find(s=>s.getAttribute('aria-label')?.startsWith('Every eligible report')&&!s.closest('[hidden]'));return Number(s.getAttribute('width'))===s.closest('figure').parentElement.parentElement.clientWidth});
  assert.equal(await page.evaluate(()=>document.activeElement.name),'w');await geometry(page,bOnly.optimum.familySize);if(config.app==='weight-path')await cursorPositions(page);
  // Cached partial rows must also reassemble in full on the next request.
  await page.evaluate(()=>window.__prxApp.update({cap:'all',tau:.217}));await settle(page);await geometry(page,allCount);
  await page.evaluate(()=>window.__prxApp.applyPreset('w0'));await settle(page);await page.evaluate(()=>window.__prxApp.update({cap:'all',tau:.219}));
  await page.waitForFunction(()=>{const t=[...document.querySelectorAll('.wpath-all-endpoints table')].find(t=>!t.closest('[hidden]'));return document.querySelector('.prx-widget').getAttribute('aria-busy')==='true'&&t?.tBodies[0].rows.length>0&&t.tBodies[0].rows.length<4683});
  const destroyed=await page.evaluate(async()=>{const root=document.querySelector('.prx-widget');let mutations=0;const observer=new MutationObserver(()=>mutations++);observer.observe(root,{subtree:true,childList:true,attributes:true});window.__prxApp.destroy();const outside=document.createElement('button');outside.textContent='After the app';document.body.append(outside);outside.focus();await new Promise(r=>__stageProbe.original(r,0));mutations=0;await new Promise(r=>__stageProbe.original(r,550));observer.disconnect();return{mutations,focus:document.activeElement===outside}});
  assert.deepEqual(destroyed,{mutations:0,focus:true});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
