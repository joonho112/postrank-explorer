import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {startServer,launchChrome,openTab,ROOT} from '../browser.mjs';
test('generic SVG/canvas matrices retain full ASCII, FIPS and Unicode IDs at both viewport widths',async()=>{
 const {build}=await import(pathToFileURL(ROOT+'/engine/node_modules/esbuild/lib/main.js'));
 const source=`import{createWidget}from'./js/shared/base.js';import{drawRelationMatrix,REPORT_BUILDER_CSS}from'./js/apps/report-builder.js';window.fixture=createWidget(document.querySelector('#w'),{}, {name:'id-fixture',className:'prx-rb',css:REPORT_BUILDER_CSS,keys:{kind:{type:'choice',values:['ascii','fips','unicode','default'],value:'ascii'},large:{type:'boolean',value:false}},build(ctx){const slot=ctx.h('div'),legend=ctx.h('div');window.slot=slot;ctx.charts.append(ctx.scrollRegion(ctx.h('div',{style:{overflow:'auto','max-height':'28rem'}},slot),'Every ID and cell'),legend);return{render(s){const ordinary=s.kind==='default',n=ordinary?6:s.large?30:8,ids=Array.from({length:n},(_,i)=>ordinary?String.fromCharCode(65+i):s.kind==='ascii'?'U'+String(i+1).padStart(2,'0'):s.kind==='fips'?'01'+String(i+1).padStart(3,'0'):'학교'+String(i+1).padStart(2,'0'));window.figure=drawRelationMatrix(ctx,slot,legend,{n,ids,g:ids.map((_,i)=>i<2?1:2),...(ordinary?{}:{unit:'unit',units:'units'})},{large:s.large,onPick:d=>window.picked=[d.i,d.j]});}};}});`;
 const bundled=await build({stdin:{contents:source,resolveDir:ROOT,loader:'js'},bundle:true,write:false,format:'iife'});
 const html='<!doctype html><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles/tokens.css"><link rel="stylesheet" href="/styles/app.css"><main style="max-width:1100px;margin:1rem auto;padding:.5rem"><div id="w"></div></main><script src="/js/vendor/d3.min.js"></script><script src="/js/vendor/plot.min.js"></script><script src="/fixture.js"></script>';
 const server=await startServer(ROOT,{virtual:{'/fixture.html':html,'/fixture.js':bundled.outputFiles[0].text}}),browser=await launchChrome();
 try{for(const width of[375,1280]){const{page:p,errors}=await openTab(browser,{origin:server.origin,width,height:800,scheme:'dark'});await p.goto(server.origin+'/fixture.html');await p.waitForSelector('svg');
 for(const kind of['ascii','fips','unicode','default'])for(const large of kind==='default'?[false]:[false,true]){await p.evaluate(s=>fixture.update(s),{kind,large});
 const boxes=await p.evaluate(()=>{const svg=figure.svg.getBoundingClientRect();return{svg:{left:svg.left,right:svg.right,top:svg.top,bottom:svg.bottom},labels:[...figure.figure.querySelectorAll('g[aria-label$="tick label"] text')].map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),n:slot.__prxChart.points.length,logicalWidth:Number(figure.svg.getAttribute('width')),first:{x:slot.__prxChart.points[0].x,y:slot.__prxChart.points[0].y}};});
 const n=kind==='default'?6:large?30:8;assert.equal(boxes.labels.length,n*2);assert.equal(boxes.n,n*n);
 for(const label of boxes.labels){assert.ok(label.left>=boxes.svg.left-1&&label.right<=boxes.svg.right+1,JSON.stringify({width,kind,large,label,svg:boxes.svg}));assert.ok(label.top>=boxes.svg.top-1&&label.bottom<=boxes.svg.bottom+1,JSON.stringify({width,kind,large,label,svg:boxes.svg}));}
 if(kind==='default'){const cell=(boxes.logicalWidth-22-4)/6;assert.equal(boxes.first.x,22+cell/2,'original left margin is unchanged');assert.equal(boxes.first.y,22+cell/2,'original top margin is unchanged');}
 await p.focus('.prx-kbd-point[tabindex="0"]');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');assert.deepEqual(await p.evaluate(()=>picked),[0,1]);
 const point=await p.evaluate(()=>{const q=slot.__prxChart.points[1],r=figure.area.getBoundingClientRect();return{x:r.left+q.x*r.width/Number(figure.svg.getAttribute('width')),y:r.top+q.y*r.height/Number(figure.svg.getAttribute('height'))};});await p.mouse.click(point.x,point.y);assert.deepEqual(await p.evaluate(()=>picked),[0,1]);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);await p.close();}
 }finally{await browser.close();await server.close();}
});
