import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, key } from '../dom-env.mjs';
import { createWidget } from '../../js/shared/base.js';
import { drawRelationMatrix } from '../../js/apps/report-builder.js';
test('large mode preserves all97x97 cells, full paired table and one complete virtual keyboard reader', () => {
    const env = makeWindow(), n = 97, ids = Array.from({ length: n }, (_, i) => String(i + 1)), names = ids.map(id => 'Full firm ' + id), focus = [], picked = [];
    let handle, slot, legend, fig;
    // The recording fixture lacks glyph text; record that browser primitive locally for this visual regression.
    const get = env.win.HTMLCanvasElement.prototype.getContext;
    env.win.HTMLCanvasElement.prototype.getContext = function (...args) { const g = get.apply(this, args); g.fillText = (...a) => g.calls.push(['fillText', ...a]); return g; };
    try {
        handle = createWidget(env.el, {}, { name: 'large-relation-test', keys: { flip: { type: 'boolean', value: false } }, build(ctx) { slot = ctx.h('div'); legend = ctx.h('div'); ctx.charts.append(ctx.scrollRegion(ctx.h('div', { style: { overflow: 'auto', 'max-height': '26rem' } }, slot), 'Complete relation matrix'), legend); return { render(s) { const grade = ids.map((_, i) => i === 0 ? 1 : i === n - 1 ? 3 : 2); if (s.flip)
                    grade.reverse(); fig = drawRelationMatrix(ctx, slot, legend, { n, ids, names, g: grade, unit: 'firm', units: 'firms' }, { large: true, selected: { i: 0, j: 1 }, onFocus: d => focus.push([d.i, d.j]), onPick: d => picked.push([d.i, d.j]) }); } }; } });
        assert.equal(slot.dataset.prxMatrixCells, String(n * n));
        assert.equal(slot.querySelectorAll('g[aria-label$="tick label"] text').length,n*2,'every source row and column keeps its ID label');
        assert.equal(slot.__prxChart.points.length, n * n);
        assert.equal(slot.querySelectorAll('.prx-kbd-point').length, 1);
        assert.equal(slot.querySelectorAll('tbody tr').length, n * (n - 1) / 2);
        assert.ok(slot.querySelectorAll('svg rect').length < n * 2, 'dense decision cells are painted, not thousands of SVG marks');
        const canvas = slot.querySelector('canvas');
        assert.equal(canvas.__ctx.calls.filter(c => c[0] === 'fillRect').length, n * n);
        assert.ok(canvas.__ctx.calls.some(c => c[0] === 'fillText'));
        let button = slot.querySelector('.prx-kbd-point');
        button.focus();
        key(button, 'Home');
        key(button, 'ArrowRight');
        assert.match(button.getAttribute('aria-label'), /Full firm 1, column Full firm 2/);
        assert.deepEqual(focus.at(-1), [0, 1]);
        key(button, 'End');
        key(button, ' ');
        assert.deepEqual(picked.at(-1), [96, 96]);
        assert.match(button.getAttribute('aria-label'), /Full firm 97/);
        fig.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 2936, height: 2940 });
        fig.area.dispatchEvent(new env.win.MouseEvent('pointermove', { clientX: 67, clientY: 37, bubbles: true }));
        assert.match(env.el.querySelector('.prx-rb-pointer-tip').textContent, /Full firm 1 \/ Full firm 2/);
        fig.area.dispatchEvent(new env.win.MouseEvent('click', { clientX: 67, clientY: 37, bubbles: true }));
        assert.deepEqual(picked.at(-1), [0, 1]);
        canvas.__ctx.calls.length = 0;
        handle.update({ flip: true });
        assert.equal(slot.querySelectorAll('canvas').length, 1);
        assert.equal(slot.__prxChart.canvases.length, 1);
        assert.equal(canvas.__ctx.calls.filter(c => c[0] === 'fillRect').length, n * n);
        assert.equal(slot.querySelectorAll('tbody tr').length, n * (n - 1) / 2);
        assert.match(legend.textContent, /firm/);
        assert.match(legend.textContent, /same grade/);
    }
    finally {
        handle?.destroy();
        env.restore();
    }
});
test('the existing small relation factory remains SVG, with all default per-cell keyboard points', () => {
    const env = makeWindow();
    let h, slot,legend;
    try {
        h = createWidget(env.el, {}, { name: 'ordinary-relation-test', keys: {generic:{type:'boolean',value:false}}, build(ctx) { slot = ctx.h('div'); legend = ctx.h('div'); ctx.charts.append(slot, legend); return { render(s) { drawRelationMatrix(ctx, slot, legend, { n: 3, ids: ['A', 'B', 'C'], g: [1, 2, 2],...(s.generic?{unit:'unit',units:'units'}:{}) }); } }; } });
        assert.equal(slot.querySelector('canvas'), null);
        assert.equal(slot.querySelectorAll('.prx-kbd-point').length, 9);
        assert.equal(slot.querySelectorAll('tbody tr').length, 3);
        assert.match(slot.querySelector('svg').getAttribute('aria-label'), /row site/);h.update({generic:true});assert.match(slot.querySelector('svg').getAttribute('aria-label'),/row unit/);assert.match(legend.textContent,/unit’s grade|unit's grade/);assert.equal(slot.querySelector('canvas'),null);
    }
    finally {
        h?.destroy();
        env.restore();
    }
});

test('optional small-SVG picking delegates all native keyboard points and current pointer geometry once across redraws',()=>{
 const env=makeWindow(),picks=[];let handle,slot,fig;
 try{handle=createWidget(env.el,{}, {name:'svg-pick-test',keys:{flip:{type:'boolean',value:false}},build(ctx){slot=ctx.h('div');ctx.charts.append(slot);const legend=ctx.h('div');return{render(s){fig=drawRelationMatrix(ctx,slot,legend,{n:3,ids:['A','B','C'],g:s.flip?[2,1,1]:[1,2,2],unit:'unit',units:'units'},{onPick:d=>picks.push([d.i,d.j])});}};}});
  const active=()=>slot.querySelector('.prx-kbd-point[tabindex="0"]');active().focus();key(active(),'Home');key(active(),'ArrowRight');key(active(),'Enter');assert.deepEqual(picks,[[0,1]]);key(active(),'End');key(active(),' ');assert.deepEqual(picks.at(-1),[2,2]);
  handle.update({flip:true});key(active(),'Home');key(active(),'Enter');assert.equal(picks.length,3);assert.deepEqual(picks.at(-1),[0,0]);
  const point=slot.__prxChart.points[1];fig.area.getBoundingClientRect=()=>({left:0,top:0,width:Number(fig.svg.getAttribute('width')),height:Number(fig.svg.getAttribute('height'))});fig.area.dispatchEvent(new env.win.MouseEvent('click',{clientX:point.x,clientY:point.y,bubbles:true}));assert.equal(picks.length,4);assert.deepEqual(picks.at(-1),[0,1]);assert.equal(slot.querySelector('canvas'),null);assert.equal(slot.querySelectorAll('.prx-kbd-point').length,9);
 }finally{handle?.destroy();env.restore();}
});

test('switching a shared slot from canvas back to SVG removes the obsolete canvas layer',()=>{const env=makeWindow();let handle,slot;try{handle=createWidget(env.el,{}, {name:'relation-mode-test',keys:{large:{type:'boolean',value:true}},build(ctx){slot=ctx.h('div');ctx.charts.append(slot);return{render(s){drawRelationMatrix(ctx,slot,ctx.h('div'),{n:3,ids:['A','B','C'],g:[1,2,2]},{large:s.large,onPick:()=>{}});}};}});assert.equal(slot.querySelectorAll('canvas').length,1);handle.update({large:false});assert.equal(slot.querySelectorAll('canvas').length,0);assert.equal(slot.__prxChart.canvases.length,0);assert.equal(slot.querySelectorAll('.prx-kbd-point').length,9);}finally{handle?.destroy();env.restore();}});
