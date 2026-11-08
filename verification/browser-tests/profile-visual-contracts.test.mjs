// Author: JoonHo Lee (jlee296@ua.edu).
// Functional Chrome assertions; no CPU timing threshold or screenshot-only claims.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startServer,launchChrome,openTab,waitForWidgetIdle} from '../browser.mjs';
import {commonCases,separabilityCases,frozenFixture,resolutionFixture,dependenceFixture,fictionalReference,extractProfileVisualModel,commonVisualFindings,separabilityVisualFindings,resolutionVisualFindings,dependenceVisualFindings,fictionalVisualFindings,visualSurfaceFindings} from '../profile_visual_rules.mjs';

const report=(findings,label)=>assert.deepEqual(findings,[],label);
async function update(page,state){await page.evaluate(s=>window.__prxApp.update(s),state);await waitForWidgetIdle(page);}
async function model(page){return page.evaluate(extractProfileVisualModel);}
async function visit(tab,origin,name,theme,query=''){
 const path=theme==='dark'?`embed/${name}.html`:`pages/profiles/${name}.html`;
 await tab.page.goto(`${origin}/${path}?theme=${theme}${query?'&'+query:''}`,{waitUntil:'load'});await waitForWidgetIdle(tab.page);
}
async function check(page,findings,label,width){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));const m=await model(page);report(visualSurfaceFindings(m,{width}),`${label} surface`);report(findings(m),label);return m;}

test('P.1/P.2/P.4/P.5 real Chrome: all frozen finite settings at 375/1280, light/dark, actual primary geometry and closed native Data',async t=>{
 const server=await startServer(),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 for(const width of [375,1280])for(const theme of ['light','dark']){
  const tab=await openTab(browser,{origin:server.origin,width,height:width===375?812:800,scheme:theme});
  try{
   await visit(tab,server.origin,'profile-common-vs-domain',theme);
   for(const row of commonCases){await update(tab.page,row.args);const f=frozenFixture(row.id);await check(tab.page,m=>commonVisualFindings(m,f),`P1 ${row.id} ${width} ${theme}`,width);}
   await visit(tab,server.origin,'profile-separability',theme);
   assert.deepEqual(await tab.page.evaluate(()=>({couplingIndex:window.__prxApp.state.couplingIndex,protected:window.__prxApp.state.protected,zeroWeight:window.__prxApp.state.zeroWeight})),{couplingIndex:1,protected:true,zeroWeight:false});
   for(const row of separabilityCases){await update(tab.page,row.args);const f=frozenFixture(row.id);await check(tab.page,m=>separabilityVisualFindings(m,f,row),`P2 ${row.id} ${width} ${theme}`,width);}
   // Existing profile-dependence-visual.test.mjs owns all 44 overlap settings.
   // These three witnesses protect the new canonical labels and visible four-state masses.
   await visit(tab,server.origin,'profile-dependence',theme);
   for(const index of [0,5,10]){await update(tab.page,{couplingIndex:index});await check(tab.page,m=>dependenceVisualFindings(m,dependenceFixture(index)),`P3 labels/masses c${index} ${width} ${theme}`,width);}
   await visit(tab,server.origin,'profile-resolution',theme);
   for(let law=0;law<3;law++)for(let budget=0;budget<7;budget++){
    await update(tab.page,{noiseIndex:law,budgetIndex:budget,candidate:'canonical'});await check(tab.page,m=>resolutionVisualFindings(m,law,budget),`P4 law${law} budget${budget} ${width} ${theme}`,width);
    // Open the real native disclosure before reading its retained exact J.
    await tab.page.click('[data-mdv-details=data] > summary');
    const f=resolutionFixture(law,budget);assert.equal(await tab.page.$eval('[data-prx-readout=minimum-J]',n=>n.dataset.num),f.expected.fit.jointProbabilityExact);
    assert.equal(await tab.page.$eval('[data-prx-readout=minimum-J]',n=>n.checkVisibility({visibilityProperty:true})),true);
    await tab.page.click('[data-mdv-details=data] > summary');
   }
   await visit(tab,server.origin,'fictional-site-profiles',theme);
   for(const scenario of ['primary','wide']){
    const {reference}=fictionalReference(scenario),pairs=[...new Map(reference.pairs.map(p=>[p.classification,p])).values()];
    for(const p of pairs){const pair=`${p.unitA}|${p.unitB}`;await update(tab.page,{scenario,pair,site:'S11',cell:scenario==='wide'?'3,1':'site'});await check(tab.page,m=>fictionalVisualFindings(m,scenario,pair),`P5 ${scenario} ${p.classification} ${width} ${theme}`,width);}
   }
   assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
  }finally{await tab.page.close();}
 }
});

async function tap(page,selector){
 const position=await page.$eval(selector,n=>{n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};});
 await page.touchscreen.tap(position.x,position.y);await waitForWidgetIdle(page);
}
const state=page=>page.evaluate(()=>window.__prxApp.state);
test('P.2/P.4/P.5 native keyboard, touch and public inspection keys preserve scientific marks',async t=>{
 const server=await startServer(),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 const tab=await openTab(browser,{origin:server.origin,width:375,height:812});
 await tab.page.setViewport({width:375,height:812,isMobile:true,hasTouch:true});
 await tab.page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await visit(tab,server.origin,'profile-separability','dark');
 let before=await model(tab.page);await tab.page.$eval('[data-prx-focus-key="feasible-lattice:p:1,2|1,2"]',n=>n.focus());await tab.page.keyboard.press('ArrowLeft');await waitForWidgetIdle(tab.page);
 assert.equal((await state(tab.page)).candidate,'p:1,1|1,2');assert.equal(await tab.page.evaluate(()=>document.activeElement.dataset.prxFocusKey),'feasible-lattice:p:1,1|1,2');
 await tap(tab.page,'[data-prx-focus-key="feasible-lattice:p:2,1|2,1"] .mds-focus-hit');assert.equal((await state(tab.page)).candidate,'p:2,1|2,1');
 const p2=separabilityCases.find(r=>r.args.couplingIndex===1&&r.args.protected&&!r.args.zeroWeight);report(separabilityVisualFindings(await model(tab.page),frozenFixture(p2.id),p2),'P2 native inspection');
 assert.equal(await tab.page.$eval('[data-mdv-details=data]',n=>n.open),false);
 await tab.page.click('[data-mdv-details=settings]>summary');
 const checkbox='[data-mdv-details=settings] input[type=checkbox]';await tab.page.focus(checkbox);await tab.page.keyboard.press('Space');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).zeroWeight,true);
 await tab.page.click('[data-mdv-details=settings]>summary');await tab.page.focus('[data-prx-part=controls] input');await tab.page.keyboard.press('Space');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).protected,false);

 await visit(tab,server.origin,'profile-resolution','dark');
 await tab.page.$eval('[data-prx-focus-key="budget-track:3"]',n=>n.focus());await tab.page.keyboard.press('ArrowRight');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).budgetIndex,4);
 await tab.page.keyboard.press('End');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).budgetIndex,6);assert.equal(await tab.page.evaluate(()=>document.activeElement.dataset.prxFocusKey),'budget-track:6');
 await tap(tab.page,'[data-prx-focus-key="budget-track:5"] .prr-track-hit');assert.equal((await state(tab.page)).budgetIndex,5);report(resolutionVisualFindings(await model(tab.page),1,5),'P4 native budget');
 before=await model(tab.page);await tab.page.focus('[data-prr-optimizer]');const beforeCardPress=await tab.page.evaluate(()=>({y:scrollY,key:document.activeElement.dataset.prxFocusKey}));
 await tab.page.keyboard.press('Enter');await waitForWidgetIdle(tab.page);assert.equal(await tab.page.$eval('[data-mdv-details=data]',n=>n.open),false);
 assert.deepEqual(await tab.page.evaluate(()=>({y:scrollY,key:document.activeElement.dataset.prxFocusKey})),beforeCardPress);
 assert.equal(await tab.page.$eval('[data-prr-visual-inspector] [data-num]',n=>n.dataset.num),resolutionFixture(1,5).expected.fit.riskExact);
 const canonical=resolutionFixture(1,5).expected.fit.selectedId;assert.equal((await state(tab.page)).candidate,canonical);assert.equal(await tab.page.$eval('[data-prx-readout=minimum-J]',n=>n.dataset.num),resolutionFixture(1,5).expected.fit.jointProbabilityExact);
 assert.deepEqual((await model(tab.page)).svgs[0].marks.filter(n=>n.d.mdvRole==='risk-point').map(n=>[n.d.mdvExact,n.a.cy]),before.svgs[0].marks.filter(n=>n.d.mdvRole==='risk-point').map(n=>[n.d.mdvExact,n.a.cy]));

 await visit(tab,server.origin,'fictional-site-profiles','dark','scenario=wide&cell=3%2C1&site=S11&pair=S11%7CS18');
 await tab.page.$eval('[data-prx-focus-key="profile-map-cell:3,1"]',n=>n.focus());await tab.page.keyboard.press('ArrowRight');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).cell,'3,2');assert.equal((await state(tab.page)).site,'S11');
 await tab.page.$eval('[data-prx-focus-key="profile-map-site:S11"]',n=>n.focus());await tab.page.keyboard.press('End');await waitForWidgetIdle(tab.page);assert.equal((await state(tab.page)).site,'S40');assert.equal((await state(tab.page)).cell,'site');
 await tap(tab.page,'[data-prx-focus-key="profile-map-site:S18"] .fsp-map-hit');assert.equal((await state(tab.page)).site,'S18');assert.equal((await state(tab.page)).pair,'S11|S18');
 await tap(tab.page,'[data-prx-focus-key="profile-map-cell:3,1"]');assert.equal((await state(tab.page)).cell,'3,1');assert.equal((await state(tab.page)).site,'S18');report(fictionalVisualFindings(await model(tab.page),'wide'),'P5 native inspection');
 assert.equal(await tab.page.$eval('[data-mdv-details=data]',n=>n.open),false);await tab.page.click('[data-mdv-details=data]>summary');
 assert.equal(await tab.page.$eval('[data-prx-readout=cell-count]',n=>n.dataset.num),'0');assert.equal(await tab.page.$eval('[data-prx-readout=cell-count]',n=>n.checkVisibility({visibilityProperty:true})),true);
 assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});

test('real Chrome planted style faults reject SVG/HTML font 13.6 and whole-card shrinkage',async t=>{
 const server=await startServer(),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 const tab=await openTab(browser,{origin:server.origin,width:375,height:812});
 await visit(tab,server.origin,'profile-common-vs-domain','light','law=crossed&tauIndex=1&weightIndex=0');
 report(visualSurfaceFindings(await model(tab.page),{width:375}),'unmodified four-tie surface');
 await tab.page.evaluate(()=>{
  document.querySelector('[data-mdv-stage] svg text').style.fontSize='13.6px';
  document.querySelector('[data-mdv-role=profile-loss]').style.display='none';
  document.querySelector('[data-mdv-stage] .mdv-report-label').style.fontSize='13.6px';
  const card=document.querySelector('[data-pcd-family=profile]');Object.assign(card.style,{minWidth:'111px',maxWidth:'111px',width:'111px'});
 });
 const findings=visualSurfaceFindings(await model(tab.page),{width:375});
 for(const code of ['svg-font-floor','html-font-floor','whole-tie-card-width','primary-mark-visible'])assert.ok(findings.some(f=>f.code===code),`${code}: ${JSON.stringify(findings)}`);
 assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});
