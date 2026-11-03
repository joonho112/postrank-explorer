import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,scrollRegion} from '../../js/shared/base.js';
import {makeWindow,sleep} from '../dom-env.mjs';

test('replaced scroll regions release observers, reused regions restart, and destroy disconnects renderer-owned regions',async()=>{
 const env=makeWindow({plot:false});const live=new Set(),all=[];const Native=env.win.MutationObserver;
 env.win.MutationObserver=class{
  constructor(callback){this.callback=callback;this.inner=new Native(callback);all.push(this);}
  observe(...args){live.add(this);this.inner.observe(...args);}
  disconnect(){live.delete(this);this.inner.disconnect();}
  takeRecords(){return this.inner.takeRecords();}
 };
 let reused,unused;
 const handle=createWidget(env.el,{}, {name:'overflow-lifecycle',bridge:false,keys:{version:{type:'integer',value:0},show:{type:'boolean',value:true}},build(ctx){
  reused=ctx.scrollRegion(ctx.h('div',{},ctx.h('div',{text:'Reusable table'})),'Reusable table');
  unused=ctx.scrollRegion(ctx.h('div',{},ctx.h('div',{text:'Not yet attached'})),'Future table');
  return {render(state){
   // chart.js and report-card.js call the exported primitive directly, not ctx.scrollRegion.
   const transient=scrollRegion(ctx.h('div',{},ctx.h('div',{text:`Current table ${state.version}`})),'Current renderer table');
   ctx.charts.replaceChildren(...(state.show?[reused]:[]),transient);
  }};
 }});
 try{
  await sleep(25);assert.equal(env.ro.live(),3,'widget resize plus two live regions');assert.equal(live.size,3,'root ownership observer plus two region observers');assert.equal(unused.__prxOverflow,undefined,'unattached ctx region does not keep an observer');
  for(let version=1;version<=8;version++){handle.update({version});await sleep(0);assert.equal(env.ro.live(),3,'replacement does not accumulate ResizeObservers');assert.equal(live.size,3,'replacement does not accumulate MutationObservers');}
  handle.update({show:false});await sleep(0);assert.equal(env.ro.live(),2);assert.equal(live.size,2);assert.equal(reused.__prxOverflow,undefined);
  handle.update({show:true});await sleep(0);assert.equal(env.ro.live(),3);assert.equal(live.size,3);assert.equal(typeof reused.__prxOverflow,'function','reattaching the same region restores its overflow cues');
  reused.replaceChildren(env.doc.createElement('table'));await sleep(0);assert.equal(env.ro.live(),3);assert.equal(live.size,3);
  handle.destroy();assert.equal(env.ro.live(),0);assert.equal(live.size,0);assert.equal(reused.__prxOverflow,undefined);
  for(const observer of all)observer.callback([]);env.ro.fire(700);await sleep(25);assert.equal(env.el.querySelector('.prx-widget'),null,'late observer work cannot recreate disposed DOM');assert.equal(live.size,0);
 }finally{handle.destroy();env.restore();}
});
