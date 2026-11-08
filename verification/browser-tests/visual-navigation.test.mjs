// Author: JoonHo Lee (jlee296@ua.edu).
// Content-category menus and Multiple criteria's two report structures.
import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,symlinkSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{DOCS,builtApps,startServer,launchChrome,openTab}from'../browser.mjs';
const GROUPS=[
 ['Uncertainty',['1']],['Grade reports',['2']],['Reporting rules',['3']],
 ['Multiple criteria',['4','P']],['Cases',['5']],['Tools',['T']],
];
const LABELS=GROUPS.map(([label])=>label);
const apps=builtApps();
const route=app=>`/pages/${app.slug}/${app.name}.html`;
const menuApps=parts=>parts.flatMap(part=>apps.filter(app=>app.part===part).map(route));
test('six content menus, readable navbar, and one-level mobile navigation',async t=>{
 const server=await startServer(),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});
 const tab=await openTab(browser,{origin:server.origin});
 for(const width of[375,768,1024,1200,1280,1440]){
  await tab.page.setViewport({width,height:width>=1200?800:812});await tab.page.goto(server.origin+'/pages/profiles/profile-dependence.html',{waitUntil:'load'});
  const initial=await tab.page.evaluate(()=>{const nav=document.querySelector('.navbar'),brand=nav.querySelector('.navbar-title'),range=document.createRange();range.selectNodeContents(brand);return{overflow:document.documentElement.scrollWidth>innerWidth,brand:brand.getBoundingClientRect().width,brandText:range.getBoundingClientRect().width,toggleVisible:!!nav.querySelector('.navbar-toggler').getClientRects().length,active:nav.querySelector('.nav-link.active')?.textContent.trim(),menus:nav.querySelectorAll('.dropdown-menu').length,height:nav.getBoundingClientRect().height};});
  assert.equal(initial.overflow,false,`overflow${width}`);assert.ok(initial.brand+1>=initial.brandText,`brand${width}`);assert.equal(initial.active,'Multiple criteria');assert.equal(initial.menus,6);
  if(width>=1200){assert.equal(initial.toggleVisible,false);assert.ok(initial.height<=88,`navbar wrapped ${width}: ${initial.height}`);}
  if(initial.toggleVisible){assert.ok(await tab.page.$eval('.navbar-toggler',e=>e.getBoundingClientRect().height)>=44);await tab.page.click('.navbar-toggler');await tab.page.waitForFunction(()=>document.querySelector('.navbar-toggler').getAttribute('aria-expanded')==='true');}
  const labels=await tab.page.$$eval('.navbar .nav-link',nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.textContent.trim()).filter(Boolean));assert.deepEqual(labels,[...LABELS,'Catalog','Terminology']);
  assert.ok(await tab.page.$$eval('.navbar .nav-link',nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));
  const menus=await tab.page.$$eval('.navbar .dropdown-menu',nodes=>nodes.map(menu=>({
   overview:menu.querySelector('a.dropdown-item')?.textContent.trim(),
   routes:[...menu.querySelectorAll('a.dropdown-item[href]')].map(a=>new URL(a.href).pathname).filter(path=>path.endsWith('.html')&&!path.endsWith('/index.html')),
  })));
  assert.deepEqual(menus,GROUPS.map(([,parts])=>({overview:'Overview',routes:menuApps(parts)})));
  if(width>=1200){
   const triggers=await tab.page.$$('.navbar .nav-link.dropdown-toggle');
   for(const [i,trigger] of triggers.entries()){
    const label=LABELS[i];
    await trigger.focus();await tab.page.keyboard.press('Space');
    await tab.page.waitForSelector('.navbar .dropdown-menu.show',{visible:true});
    const bounds=await tab.page.$eval('.navbar .dropdown-menu.show',menu=>{
     const r=menu.getBoundingClientRect();
     return {left:r.left,right:r.right,viewport:innerWidth,content:menu.scrollHeight,visible:menu.clientHeight,targets:[...menu.querySelectorAll('.dropdown-item')].map(a=>a.getBoundingClientRect().height)};
    });
    assert.ok(bounds.left>=0&&bounds.right<=bounds.viewport,`${label} menu outside viewport at ${width}: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.content<=600&&bounds.content<=bounds.visible+1,`${label} menu needs scrolling at ${width}: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.targets.every(h=>h>=44),`${label} target below 44px`);
    await tab.page.keyboard.press('ArrowDown');
    assert.equal(await tab.page.evaluate(()=>document.activeElement.textContent.trim()),'Overview');
    await tab.page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(a=>a===document.activeElement&&a.getAttribute('aria-expanded')==='false'),true);
   }
  }
  if(initial.toggleVisible){await tab.page.click('.navbar-toggler');await tab.page.waitForFunction(()=>document.querySelector('.navbar-toggler').getAttribute('aria-expanded')==='false');}
 }
 assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});
test('Multiple criteria exposes two readable grade drawings and all14+5stableappcards',async t=>{
 const server=await startServer(),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();});const tab=await openTab(browser,{origin:server.origin});
 for(const width of[375,768,1280,1440]){
  await tab.page.setViewport({width,height:812});await tab.page.goto(server.origin+'/pages/criteria/index.html',{waitUntil:'load'});
  const report=await tab.page.evaluate(()=>{const entries=[...document.querySelectorAll('.prx-report-types__entry')];return{overflow:document.documentElement.scrollWidth>innerWidth,entries:entries.map(a=>{const svg=a.querySelector('svg'),rect=svg.getBoundingClientRect();return{target:a.hash,height:rect.height,width:rect.width,labeled:svg.getAttribute('aria-labelledby').split(' ').every(id=>!!document.getElementById(id)),offscreen:rect.right>innerWidth+1||rect.left<0}}),cards:document.querySelectorAll('main .prx-card').length,profileCards:[...document.querySelectorAll('main .prx-card-id')].filter(e=>/^P\.[1-5]$/.test(e.textContent.trim())).length};});
  assert.equal(report.overflow,false);assert.equal(report.entries.length,2);assert.equal(report.cards,19);assert.equal(report.profileCards,5);assert.deepEqual(report.entries.map(e=>e.target),['#common-grades','#domain-profiles']);for(const e of report.entries){assert.ok(e.height>=199);assert.equal(e.labeled,true);assert.equal(e.offscreen,false);}
 }
 await tab.page.goto(server.origin+'/catalog.html?part=4',{waitUntil:'load'});await tab.page.waitForSelector('.prx-catalog-filters:not([hidden])');assert.equal(await tab.page.$$eval('[data-catalog] article:not([hidden])',n=>n.length),14);
 await tab.page.goto(server.origin+'/catalog.html?part=P',{waitUntil:'load'});assert.equal(await tab.page.$$eval('[data-catalog] article:not([hidden])',n=>n.length),5);
 const filter=await tab.page.$eval('select[name=part]',node=>({
  keys:[...node.options].map(o=>o.value),active:node.value,group:node.querySelector('optgroup')?.label,
  nested:[...node.querySelectorAll('optgroup option')].map(o=>o.textContent.trim()),
 }));
 assert.deepEqual(filter,{keys:['','1','2','3','4','P','5','T'],active:'P',group:'Multiple criteria',nested:['Common grades','Domain profiles']});
 await tab.page.goto(server.origin+'/index.html',{waitUntil:'load'});
 assert.deepEqual(await tab.page.$$eval('#organisation .prx-story > ul > li > strong a',nodes=>nodes.map(a=>a.textContent.trim())),LABELS);
 assert.deepEqual(await tab.page.$$eval('#organisation .prx-story > ul > li > ul strong a',nodes=>nodes.map(a=>[a.textContent.trim(),a.hash])),[['Common grades','#common-grades'],['Domain profiles','#domain-profiles']]);
 await tab.page.goto(server.origin+'/pages/words.html#multidomain-profiles-and-joint-protection',{waitUntil:'load'});
 assert.equal(await tab.page.$eval('#multidomain-profiles-and-joint-protection h2',n=>n.textContent.trim()),'Domain profiles and joint protection');
 assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});
test('subpath child highlights parent; static mobile navigation and SVG entries work withoutJavaScript',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'prx-visual-nav-'));symlinkSync(DOCS,join(dir,'postrank-explorer'),'dir');const server=await startServer(dir),browser=await launchChrome();t.after(async()=>{await browser.close();await server.close();rmSync(dir,{recursive:true,force:true});});const tab=await openTab(browser,{origin:server.origin,width:375,height:812}),base=server.origin+'/postrank-explorer/';
 for(const path of['pages/profiles/index.html','pages/profiles/profile-resolution.html?preset=larger-budget']){await tab.page.goto(base+path,{waitUntil:'load'});assert.equal(await tab.page.$eval('.navbar .nav-link.active',e=>e.textContent.trim()),'Multiple criteria');assert.equal(await tab.page.$eval('.navbar .nav-link.active',e=>e.getAttribute('aria-current')),'location');}
 await tab.page.setJavaScriptEnabled(false);await tab.page.goto(base+'pages/criteria/index.html',{waitUntil:'load'});
 assert.equal(await tab.page.$$eval('.navbar .nav-link',n=>n.filter(e=>e.getClientRects().length).length),8);assert.equal(await tab.page.$$eval('.prx-report-types svg',n=>n.length),2);assert.equal(await tab.page.$eval('.navbar-toggler',e=>e.getClientRects().length),0);
 const routes=await tab.page.$$eval('.navbar .dropdown-item[href]',nodes=>nodes.filter(a=>a.getClientRects().length).map(a=>new URL(a.href).pathname.replace(/^\/postrank-explorer/,'')).filter(path=>path.endsWith('.html')&&!path.endsWith('/index.html')));
 assert.deepEqual(routes,GROUPS.flatMap(([,parts])=>menuApps(parts)));
 await tab.page.goto(base+'pages/profiles/profile-common-vs-domain.html',{waitUntil:'load'});
 const sequence=await tab.page.$$eval('.prx-app-sequence a',nodes=>nodes.map(a=>[a.rel,new URL(a.href).pathname]));
 assert.deepEqual(sequence,[['prev','/postrank-explorer/pages/criteria/estimated-budgets.html'],['next','/postrank-explorer/pages/profiles/profile-separability.html']]);
 assert.equal(await tab.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(tab.errors,[]);assert.deepEqual(tab.failed,[]);
});
