// The selected replay must remain the same in state, live readout and native slider after an atomic range update.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountCase,settle} from '../widget_harness.mjs';
test('Replay endpoint follows an atomic increase or decrease of observation count',async()=>{
 const m=await mountCase({module:'js/apps/reported-and-realized.js',query:'?replays=3&replay=3&draws=0'});
 try{
  const input=m.root.querySelector('input[name="replay"]');
  for(const n of [20,5,100,3]){
   m.handle.update({replays:n,replay:n});await settle(m.win,m.el);
   assert.equal(m.handle.state.replay,n);
   assert.equal(Number(input.max),n);
   assert.equal(Number(input.value),n,'native thumb must match the selected replay');
   assert.equal(Number(input.getAttribute('aria-valuetext')),n);
   assert.equal(Number(m.root.querySelector('[data-prx-readout="selected-replay"]').getAttribute('data-num')),n);
  }
 }finally{m.close();}
});
