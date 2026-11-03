// Actual optional 1.13 renderer: arbitrary IDs and supplied probabilities, with no marginal-law invention.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOT,launchChrome,openTab,startServer} from '../browser.mjs';

test('generic probability matrices retain every cell, declared wording, Unicode IDs, pointer and native keyboard reading',async t=>{
 const server=await startServer(ROOT),browser=await launchChrome();
 t.after(async()=>{await browser.close();await server.close()});
 for(const width of[1280,375])for(const theme of['light','dark'])await t.test(`${width}px ${theme}`,async tt=>{
  const{page,errors,failed}=await openTab(browser,{origin:server.origin,width,height:800,scheme:theme});tt.after(()=>page.close());
  await page.goto(`${server.origin}/embed/pairwise-matrix.html?theme=${theme}`);
  await page.evaluate(async theme=>{
   __prxApp.destroy();document.documentElement.dataset.theme=theme;
   const{createWidget}=await import('/js/shared/base.js');const{matrixView,cssFor}=await import('/js/apps/pairwise-matrix.js');
   const small=['서울, "A"','A|B','C','A','B|C'];
   window.__matrixInput=(large=false)=>{const ids=large?Array.from({length:30},(_,i)=>`Unit ${String(i+1).padStart(2,'0')} 東京`):small;return{data:'caller input',n:ids.length,ids,pi:ids.map((_,i)=>ids.map((_,j)=>i===j?NaN:i<j?1:0))}};
   window.__matrixEvents=[];
   window.__prxApp=createWidget(document.getElementById('app'),{},{name:'generic-probability-matrix-regression',className:'input-probability',css:cssFor('input-probability'),keys:{large:{type:'boolean',value:false},reverse:{type:'boolean',value:false}},build(ctx){
    let selected={i:0,j:1},hovered=null;
    const view=matrixView(ctx,{label:'Supplied direction probabilities',generic:{alt:'Caller supplied direction probabilities; no marginal law is inferred.',orderNote:'Both axes follow the declared input order.',tableCaption:'Every supplied ordered-pair probability; no unit is compared with itself.',probabilityOpen:false},onFocus:c=>{selected={i:c.i,j:c.j};__matrixEvents.push([c.i,c.j])}});
    window.__matrixView=view;ctx.charts.append(view.root);
    ctx.listen(view.slot,'pointermove',event=>{hovered=view.cellAt(event);view.overlays(selected,hovered)});
    ctx.listen(view.slot,'pointerleave',()=>{hovered=null;view.overlays(selected,hovered)});
    ctx.listen(view.slot,'click',event=>{const c=view.cellAt(event);if(c){selected={i:c.i,j:c.j};view.overlays(selected,hovered);__matrixEvents.push(['pick',c.i,c.j])}});
    return{render(state){const d=__matrixInput(state.large),order=d.ids.map((_,i)=>i);if(state.reverse)order.reverse();view.draw(state,d,order,{avail:ctx.width(),inPlace:true,selection:selected,hovered});view.note(state,d)}};
   }});
  },theme);
  for(const large of[false,true]){
   await page.evaluate(large=>__prxApp.update({large,reverse:false}),large);
   const n=large?30:5;
   const state=await page.evaluate(()=>{const root=document.querySelector('.prx-widget'),view=__matrixView,table=view.geom.table;return{n:view.geom.n,cells:view.geom.cells.length,buttons:root.querySelectorAll('.prx-kbd-point').length,keys:[...root.querySelectorAll('.prx-kbd-point')].map(b=>b.getAttribute('data-prx-focus-key')),rows:table.tBodies[0].rows.length,columns:table.tHead.rows[0].cells.length,text:root.textContent,alt:view.geom.svg.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth+1,scroll:view.scrollBox.scrollWidth>view.scrollBox.clientWidth,ids:__matrixInput(__prxApp.state.large).ids,shown:[...table.tBodies[0].rows].map(row=>row.cells[0].textContent),names:[...root.querySelectorAll('svg text[data-prx-name]')].map(n=>n.textContent)}});
   assert.equal(state.n,n);assert.equal(state.cells,n*n);assert.equal(state.buttons,n*n);assert.equal(new Set(state.keys).size,n*n,'delimiter-containing IDs keep unique keyboard keys');assert.equal(state.rows,n);assert.equal(state.columns,n+1);assert.deepEqual(state.shown,state.ids);assert.equal(state.overflow,false,JSON.stringify({width,large,overflow:state.overflow,scroll:state.scroll}));if(width===375&&large)assert.equal(state.scroll,true);
   assert.ok(state.text.includes('Both axes follow the declared input order.'));assert.ok(!state.text.includes('two posteriors'));assert.ok(!state.text.includes('small unit'));assert.ok(!state.text.includes('Six-by-six'));for(const id of state.ids)assert.ok(state.names.includes(id));
   await page.focus('.prx-kbd-point[tabindex="0"]');const first=await page.evaluate(()=>document.activeElement.getAttribute('aria-label'));await page.keyboard.press('ArrowRight');const right=await page.evaluate(()=>document.activeElement.getAttribute('aria-label'));assert.notEqual(first,right);assert.ok(right.includes('higher priority')||right.includes('same unit'));
   if(large){await page.keyboard.press('End');const visible=await page.evaluate(()=>{const view=__matrixView,cell=document.activeElement.getBoundingClientRect(),box=view.scrollBox.getBoundingClientRect(),outline=view.root.querySelector('.prx-pm-mark-sel');return{left:cell.left,right:cell.right,viewportLeft:box.left,viewportRight:box.right,scroll:view.scrollBox.scrollLeft,outline:!outline.hidden}});assert.ok(visible.left>=visible.viewportLeft-1&&visible.right<=visible.viewportRight+1,JSON.stringify(visible));assert.equal(visible.outline,true);await page.keyboard.press('Home');}

   const point=await page.evaluate(()=>{const g=__matrixView.geom,b=g.svg.getBoundingClientRect();return{x:b.left+(g.marginLeft+1.5*g.cell)*b.width/g.width,y:b.top+(g.mt+.5*g.cell)*b.height/g.height}});await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
   assert.deepEqual(await page.evaluate(()=>__matrixEvents.at(-1)),['pick',0,1]);
   const cells=await page.evaluate(()=>{const g=__matrixView.geom;return{upper:g.table.tBodies[0].rows[0].cells[2].textContent,lower:g.table.tBodies[0].rows[1].cells[1].textContent}});assert.equal(cells.upper,'1');assert.equal(cells.lower,'0');
   await page.evaluate(()=>__prxApp.update({reverse:true}));assert.equal(await page.evaluate(()=>__matrixView.geom.table.tBodies[0].rows[0].cells[0].textContent),state.ids.at(-1));
  }
  await page.evaluate(()=>__prxApp.destroy());assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 });
});
