// alabama-map (5.12): full released67-county geometry, supplied marginal intervals and archived reports.
// One public state drives linked selection, exact fixed-report evaluation and live weighted expected-rank DP.
// The archived commonality table retains its original own-best solver bounds; it is not recomputed for a new loss.
import { createWidget } from "../shared/base.js";
import { gradeRamp, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatGrades, formatRisk, formatSci, formatSetting, formatShare, setNum } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { canonicalGrade, disclosure, evaluateReport, expectedRank, fixedOrderDP, relationChange, reportCardRows } from "../pr-core.js";
import {caseInput} from '../shared/case-inputs.js';
const INPUT=caseInput('alabama'),AL=INPUT.source;
import GEO from "../../data/released/census-geojson.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "alabama-map",
  w: Object.freeze({ type: "number", min: 0, max: 1, step: 0.01, value: 0.5 }),
  // a transverse Mercator centered on Alabama (the usual projection of a north–south state)
  rotate: Object.freeze([86.7, -32.6]),
  // a grade with at most this many counties is named in the key; grade 1 is outlined (map) and ringed (scatter) when it
  // has at most maxOutlined counties, so that a small grade 1 still catches the eye
  maxNamed: 1,
  maxOutlined: 2,
  map: Object.freeze({ height: 306, margin: 3, stroke: 0.4, outline: 1.8 }),
  // marginBottom leaves the x-axis label a line of its own under the tick labels
  scatter: Object.freeze({ height: 190, marginLeft: 50, marginRight: 14, marginTop: 22, marginBottom: 48, r: 3.4 }),
  bars: Object.freeze({ height: 72, marginLeft: 96, marginRight: 46, marginTop: 4, marginBottom: 20, top: 0.4, ticks: Object.freeze([0, 0.1, 0.2, 0.3, 0.4]) }),
  text: Object.freeze({
    w: "Weight on income (incarceration: the rest)",
    mapTitle: "The selected report",
    outcomesTitle: "Counties on the two outcomes",
    errorsTitle: "Share of stated directions expected wrong",
    axisIncome: "Income rank (percentile)",
    axisIncarceration: "Incarceration (%), lower is up",
    income: "Income",
    incarceration: "Incarceration",
    keyTitle: "Grade",
    grade1: "Grade 1 = stated highest on the weighted outcomes, as the posterior judges it: the most favorable historical outcomes, not need.",
    mapAlt: "Map of Alabama's 67 counties, each colored by its grade in the selected report. The selected county has a dashed halo. A small top grade has a solid outline.",
    outcomesAlt: "Scatter of the 67 counties: income rank across, incarceration rate down (lower is higher on the chart), each county colored by its grade.",
    barsAlt: "Two bars: the share of stated directions expected to be wrong on income and on incarceration.",
  }),
});

// --------------------------------------------------------------------------------------------- data

const U = AL.tables.units;
const N_UNITS = U.fips.length;
const M = INPUT.M;
const E=INPUT.E;
const SET = AL.facts.reference_settings;
const TAU = SET.tau;
const GMAX = SET.G_max;
// county features in the order of the units (joined by FIPS)
const FEATURES = U.fips.map((f) => GEO.features.find((x) => x.properties.fips === f));

/** The common grade at income weight w: the best report within the weighted expected-rank order. */
const memo=new Map();
function commonAt(w,tau=TAU,cap=GMAX) {
  const key=`${w}|${tau}|${cap}`;if(memo.has(key))return memo.get(key);
  const ww = [w, 1 - w];
  const result=fixedOrderDP(E,{scores:expectedRank(E,{w:ww}),direction:"ascending",tau,w:ww,G:cap});if(memo.size>=128)memo.delete(memo.keys().next().value);memo.set(key,result);return result;
}

const SOURCE_REPORTS=AL.tables.reports;
const REPORTS=[['common','Live common grade'],['P','Archived common P'],['D1','Archived income D1'],['D2','Archived incarceration D2'],['B0','B0: withhold every pair'],['B1','B1: observed-rank quantile cuts'],['B2','B2: posterior-mean rank quantile cuts'],['B3','B3: expected-rank order search'],['withheld','Withhold every pair'],['edited','Edited fixed report']];
function editedGrade(v){if(typeof v!=='string')return undefined;const g=v.trim().split(/[\s,;]+/).map(Number);if(g.length!==N_UNITS||g.some(x=>!Number.isInteger(x)))return undefined;try{return Array.from(canonicalGrade(g)).join(',');}catch{return undefined;}}
const CSS = `
.al .prx-panel{min-width:0;max-width:100%}.al .al-vector .prx-num{white-space:normal;overflow-wrap:anywhere}
.al .al-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); grid-template-areas: 'map bars' 'map scatter'; gap: 0.4rem 1.4rem; align-items: start; }
.al .al-mapbox { display: flex; flex-wrap: wrap; gap: 0; align-items: flex-end; }
.al .al-map { flex: none; }
.al .al-key { flex-direction: column; flex-wrap: nowrap; gap: 0.3rem; margin: 0; padding: 0.4rem 0.7rem 0.6rem 0.2rem;
  align-self: stretch; justify-content: flex-end; font-size: 0.875rem; white-space: nowrap; }
.al .al-key .al-key-title { font-weight: 700; }
.al .al-key .prx-swatch { width: 1.05rem; height: 1.05rem; }
.al .al-key .al-note { margin: 0 0 auto; font-size: 0.75rem; line-height: 1.3; white-space: normal; width: 0; min-width: 100%; }
.al .al-tag { margin: 0.2rem 0 0; font-size: 0.8125rem; color: var(--prx-fg-muted); }
.al .al-right .prx-panel-title + * { margin-top: 0; }
.al .al-bars-title { margin-top: 0.45rem; }
.al .al-left{grid-area:map}.al .al-outcome-bars{grid-area:bars}.al .al-right{grid-area:scatter}
.al .al-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem 1rem;width:100%}.al .al-controls>*{min-width:0}.al .al-detail{margin-top:1rem}.al .al-box{overflow:auto;max-height:34rem}.al table{width:100%;border-collapse:collapse;font-size:.82rem}.al th,.al td{padding:.35rem .4rem;border-bottom:1px solid var(--prx-border);text-align:right;white-space:nowrap}.al th:first-child,.al td:first-child{text-align:left}.al .al-box button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;text-align:left}.al .al-selected{outline:2px solid var(--prx-fg);outline-offset:-2px}.al .al-vector{overflow-wrap:anywhere;font-size:.8rem}.al .al-stack p{margin:.35rem 0}.al textarea{width:100%;min-height:5rem;box-sizing:border-box}.al .al-error{color:var(--prx-err-text)}.al .al-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.al .al-cardbox{overflow:auto}.al .al-cardplot{min-width:510px}
@media(max-width:50em){.al .al-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:30em){.al .al-controls{grid-template-columns:minmax(0,1fr)}}
@media (max-width: 40em) { .al .al-grid,.al .al-cards { grid-template-columns: minmax(0, 1fr); }
  .al .al-grid { grid-template-areas: 'bars' 'map' 'scatter'; }
  .al .al-key { align-self: auto; } }
`;

// --------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "al",
    css: CSS,
    layout: 'result-first',
    keys:{w:CONFIG.w,tau:{type:'number',min:.02,max:.5,step:.01,value:TAU},cap:{type:'integer',min:1,max:6,value:GMAX},report:{type:'choice',values:REPORTS.map(r=>r[0]),value:'common'},county:{type:'integer',min:0,max:N_UNITS-1,value:SOURCE_REPORTS.P.indexOf(1)},overlay:{type:'choice',values:['none','income','incarceration'],value:'none'},edited:{type:'custom',parse:editedGrade,value:SOURCE_REPORTS.P.join(',')}},
    build(ctx) {
      const { h } = ctx;
      const syncStop=(slot,i)=>{for(const b of slot.querySelectorAll('.prx-kbd-point')){const key=b.dataset.prxFocusKey??'';b.tabIndex=key.slice(key.lastIndexOf(':')+1)===String(i)?0:-1;}};
      const N=(v,fmt=formatCount,key)=>{const n=ctx.num(v,fmt(v));if(key)n.dataset.prxReadout=key;return n;};
      function table(headers,rows){return h('table',{},h('thead',{},h('tr',{},...headers.map(text=>h('th',{scope:'col',text})))),h('tbody',{},...rows.map(c=>h('tr',{},...c.map(v=>h('td',{},v))))));}
      const panel=(title,node)=>h('section',{class:'prx-panel al-detail'},ctx.panelTitle(title),node);
      const T = CONFIG.text;
      const w = ctx.slider({ label: T.w, ...ctx.key("w"), onInput: (v) => ctx.set({ w: v }) });

      const tau=ctx.slider({label:'Withholding cost τ (a wrong direction costs one)',...ctx.key('tau'),onInput:v=>ctx.set({tau:v})});
      const cap=ctx.slider({label:'Most grades allowed in the live order search',...ctx.key('cap'),onInput:v=>ctx.set({cap:v})});
      const report=ctx.select({label:'Color counties by this report',options:REPORTS.map(([value,label])=>({value,label})),value:ctx.state.report,onChange:v=>ctx.set({report:v})});
      const county=ctx.select({label:'County to read',options:U.name.map((label,value)=>({value,label})),value:ctx.state.county,onChange:v=>ctx.set({county:v})});
      const overlay=ctx.select({label:'Show the outcome’s own archived map',options:[{value:'none',label:'No own-report map'},{value:'income',label:'Income: D1'},{value:'incarceration',label:'Incarceration: D2'}],value:ctx.state.overlay,onChange:v=>ctx.set({overlay:v})});
      const controls = ctx.disclosure({ name: 'settings', title: 'Settings', placement: 'controls' });
      controls.body.append(h('div', { class: 'al-controls' }, tau.root, cap.root, report.root, county.root, overlay.root));
      ctx.primaryControl(w.input);
      ctx.afterPresets(w.root);

      const mapSlot = h("div", { class: "al-map" });
      const scatterSlot = h("div", { class: "al-scatter" });
      const barSlot = ctx.primaryGraphic(h("div", { class: "al-bars" }));
      // the grade key sits on the light plot paper beside the map in every theme, like the colors it explains
      const gradeKey = h("div", { class: "prx-legend prx-light-panel al-key", "data-prx-part": "legend" });
      const tag = h("p", { class: "al-tag" });
      const fixedRisk = h('p', { class:'al-tag' });
      const barsTitle = ctx.panelTitle(T.errorsTitle);
      barsTitle.classList.add("al-bars-title");
      const countyMap = h("section", { class: "prx-panel al-left", "aria-label": T.mapTitle },
        ctx.panelTitle(T.mapTitle), h("div", { class: "al-mapbox" }, mapSlot, gradeKey));
      ctx.charts.append(h("div", { class: "al-grid", role: "group", "aria-label": `${T.outcomesTitle}; ${T.errorsTitle}` },
        h("section", { class: "prx-panel al-outcome-bars" }, barsTitle, barSlot, fixedRisk, tag),
        countyMap, h("section", { class: "prx-panel al-right" }, ctx.panelTitle(T.outcomesTitle), scatterSlot)));

      const ownSlot=h('div'),ownKey=h('div',{class:'prx-legend prx-light-panel al-key'}),ownTitle=ctx.panelTitle('Archived outcome-specific grade'),ownPanel=h('section',{class:'prx-panel al-detail'},ownTitle,h('div',{class:'al-mapbox'},ownSlot,ownKey));
      const ownFold=ctx.disclosure({name:'same-own-map',title:'Archived own map (same grades)',placement:'none'});
      const ownHolder=h('div',{'data-prx-own-map':''},ownPanel,ownFold.root);
      const summary=h('div',{class:'al-stack'}),settings=h('div',{class:'al-stack'}),details=h('div',{class:'al-stack al-box'}),profiles=h('div',{class:'al-box'}),archive=h('div',{class:'al-box'}),changes=h('div',{class:'al-box'}),card=h('div',{class:'al-box'}),ties=h('div',{class:'al-stack'}),intervalSlots=[h('div',{class:'al-cardplot'}),h('div',{class:'al-cardplot'})];
      const editor=h('textarea',{'aria-label':'Edited county grade vector in original FIPS order'}),error=h('p',{class:'al-error',role:'alert'});let dirty=false,lastEdited=ctx.state.edited;editor.value=lastEdited;
      const applyEdit=()=>{const value=editedGrade(editor.value);if(value===undefined){error.textContent='Use one integer per county, in original FIPS order.';return;}editor.value=value;dirty=false;error.textContent='';ctx.set({edited:value,report:'edited'});};
      ctx.listen(editor,'input',()=>{dirty=true;});ctx.listen(editor,'keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();applyEdit();}if(e.key==='Escape'){editor.value=ctx.state.edited;dirty=false;error.textContent='';}});
      const editorPanel=panel('Edit a fixed report',h('div',{},h('p',{},'Enter one integer grade per county in original FIPS order. Smaller numbers indicate higher priority. Apply saves the grades. Escape restores the previous grades.'),editor,ctx.button({label:'Apply edited report',onClick:applyEdit}).root,error));
      countyMap.append(panel('Selected county: supplied marginal intervals', ctx.scrollRegion(details, 'Selected county marginal intervals')));
      ctx.charts.append(ownHolder);
      ctx.disclosure({name:'report-details',title:'Current reports, settings and exact risks'}).body.append(
        panel('The selected report and county',summary), panel('Selection settings and scope',settings),
        panel('All reports under the same current loss',profiles), panel('Returned minimizing live reports',ties));
      ctx.disclosure({name:'county-details',title:'County grades, changes and marginal intervals'}).body.append(
        panel('County grades and relation changes from P',changes),
        h('section',{class:'prx-panel al-detail'},ctx.panelTitle('Complete report card with supplied marginal intervals'),
          h('div',{class:'al-cards'},...intervalSlots.map((slot,k)=>h('div',{class:'al-cardbox'},ctx.panelTitle(k===0?'Income rank':'Incarceration: lower is favorable'),slot))),
          h('p',{},'The cards list grade one first, with counties ordered by posterior mean within each grade. Each equal-tail interval describes a single county’s outcome.')),
        panel('Every county and its marginal intervals',card));
      ctx.disclosure({name:'archive-editor',title:'Archived commonality and report editor'}).body.append(
        panel('Archived cost of one common grade',archive),editorPanel);
      [profiles,archive,changes,card,...intervalSlots.map(n=>n.parentElement)].forEach((n,k)=>ctx.scrollRegion(n,['Every fixed-report evaluation','Complete archived commonality and solver facts','Complete county grade changes','All county marginal intervals','Income interval card','Incarceration interval card'][k]));
      if(!ctx.doc.querySelector('meta[name="quarto:offset"]'))ctx.root.append(panel('Data and scope',h('div',{},h('p',{},INPUT.notice.attribution),h('p',{},INPUT.notice.changes),h('p',{},INPUT.notice.text),h('p',{},'County boundaries: U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20m), via usmapdata 1.1.0; public domain. No endorsement implied.'))));
      const rows=[],gradeCells=[],ownCells=[],rowBody=h('tbody');U.name.forEach((name,i)=>{const button=h('button',{type:'button',text:name,'data-prx-focus-key':`county-row:${i}`});ctx.listen(button,'click',()=>ctx.set({county:i}));const g=N(1),o=N(1);gradeCells.push(g);ownCells.push(o);const row=h('tr',{},h('th',{scope:'row'},button),h('td',{},h('span',{'data-prx-name':'',text:U.fips[i]})),h('td',{},g),h('td',{},o),...['mean_income','lower_income','upper_income','mean_incarceration','lower_incarceration','upper_incarceration'].map(key=>h('td',{},N(U[key][i],v=>formatDecimal(v,{digits:2})))));ctx.listen(button,'keydown',e=>{const order=Array.from(rowBody.children),at=order.indexOf(row),steps={ArrowDown:at+1,ArrowUp:at-1,Home:0,End:order.length-1};if(!(e.key in steps))return;e.preventDefault();const next=order[Math.max(0,Math.min(order.length-1,steps[e.key]))],j=rows.indexOf(next);ctx.set({county:j});next.querySelector('button').focus({preventScroll:true});next.scrollIntoView({block:'nearest'});});rows.push(row);rowBody.append(row);});
      card.append(h('table',{},h('caption',{},'All counties in selected report order. Incarceration values are negative percentage points: larger is more favorable.'),h('thead',{},h('tr',{},...['County','FIPS','Selected grade','Own grade (or P)','Income mean','Income lower','Income upper','Negative incarceration mean','Negative incarceration lower','Negative incarceration upper'].map(text=>h('th',{scope:'col',text})))),rowBody));

      // the projection and the county paths are fixed: made once, at the first draw (d3 is a page global)
      let geo = null;
      function geometry() {
        if (geo) return geo;
        const d3 = ctx.win.d3 ?? globalThis.d3;
        const Mp = CONFIG.map;
        const fc = { type: "FeatureCollection", features: FEATURES };
        const innerH = Mp.height - 2 * Mp.margin;
        const projection = d3.geoTransverseMercator().rotate(CONFIG.rotate).fitHeight(innerH, fc);
        const path = d3.geoPath(projection);
        const [[x0], [x1]] = path.bounds(fc);
        geo = {
          d: FEATURES.map((f) => path(f)),
          centroid: FEATURES.map((f) => path.centroid(f)),
          inner: [Math.ceil(x1 - x0) + 1, innerH],
          dx: -x0,
        };
        return geo;
      }

      function drawMap(grade,gc,pal,state,slot=mapSlot,keySlot=gradeKey) {
        const Mp = CONFIG.map;
        const g = geometry();
        const G = Math.max(...grade);
        const counties = U.name.map((name, i) => ({ i, name, grade: grade[i], cx: g.centroid[i][0] + g.dx, cy: g.centroid[i][1] }));
        const ns = "http://www.w3.org/2000/svg";
        const shapes = () => {
          const group = ctx.doc.createElementNS(ns, "g");
          group.setAttribute("transform", `translate(${Mp.margin + g.dx},${Mp.margin})`);
          const path = (d, fill, stroke, width, kind, dash) => {
            const p = ctx.doc.createElementNS(ns, "path");
            p.setAttribute("d", g.d[d.i]);
            p.setAttribute("fill", fill);
            p.setAttribute("stroke", stroke);
            p.setAttribute("stroke-width", String(width));
            p.setAttribute("stroke-linejoin", "round");
            if(kind)p.dataset.alabamaOutline=kind;
            if(dash)p.setAttribute('stroke-dasharray',dash);
            p.dataset.county=String(d.i);p.addEventListener('click',()=>ctx.set({county:d.i}));group.append(p);
          };
          counties.forEach((d) => path(d, gc[d.grade - 1], pal.plotMuted, Mp.stroke));
          // a small grade 1 outlined on top, so that one or two counties still catch the eye
          const top = counties.filter((d) => d.grade === 1);
          if (G > 1 && top.length <= CONFIG.maxOutlined) top.forEach((d) => path(d, "none", pal.plotFg, Mp.outline,'top-grade'));
          counties.filter(d=>d.i===state.county).forEach(d=>{
            path(d,'none',pal.plotBg,4.5,'selected-underlay');
            path(d,'none',pal.plotFocus,2.8,'selected','4 2');
          });
          return group;
        };
        plot(slot, {
          alt: T.mapAlt,
          table: {
            caption: [N(N_UNITS)," counties and their grade in the selected report"],
            columns: [
              { label: "County", value: "name" },
              { label: "FIPS", value: (d) => U.fips[d.i],name:true },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: counties.slice().sort((a, b) => a.grade - b.grade || a.i - b.i),
          },
          width: g.inner[0] + 2 * Mp.margin, height: Mp.height, marginTop: Mp.margin, marginBottom: Mp.margin, marginLeft: Mp.margin, marginRight: Mp.margin,
          x: { domain: [0, g.inner[0]], axis: null },
          y: { domain: [g.inner[1], 0], axis: null },
          marks: () => [shapes],
          keyboard: {
            data: counties.slice().sort((a, b) => a.cy - b.cy || a.cx - b.cx), x: "cx", y: "cy", sort: false, key: (d) => String(d.i),
            label: "The 67 counties, north to south. Use the arrow keys to read each county.",
            onFocus:d=>{if(ctx.state.county!==d.i)ctx.set({county:d.i});},
            title: (d) => `${d.name}: grade ${formatCount(d.grade)} of ${formatCount(G)}; income rank ${formatDecimal(U.mean_income[d.i], { digits: 1 })}, incarceration ${formatDecimal(-U.mean_incarceration[d.i], { digits: 2 })}% (posterior means).`,
          },
        });
        syncStop(slot,state.county);
        const sizes = disclosure(grade).sizes;
        // what grade 1 means heads the key (in the space above the entries), then the entries at the bottom
        const outlineKey=(text,style)=>h('span',{class:'prx-key'},h('span',{class:'prx-swatch',style:{background:pal.plotBg,border:style},'aria-hidden':'true'}),text);
        keySlot.replaceChildren(h("span", { class: "al-note", text: slot===ownSlot?(state.overlay==='income'?'Grade one = stated highest historical income rank in archived D1, not a measure of need.':'Grade one = stated lowest historical incarceration in archived D2, not a measure of need.'):state.report==='common'?T.grade1:'Grade one is the high-priority end of this fixed report. A shared grade withholds comparisons. Historical outcomes, not a measure of need.' }), outlineKey('Selected county',`2px dashed ${pal.plotFocus}`),
          ...(G>1&&sizes[0]<=CONFIG.maxOutlined?[outlineKey('Top grade',`2px solid ${pal.plotFg}`)]:[]),
          h("span", { class: "al-key-title" }, T.keyTitle), ...sizes.map((n, k) => {
          const names = n <= CONFIG.maxNamed ? U.name.filter((_, i) => grade[i] === k + 1).join(", ") : null;
          return h("span", { class: "prx-key" },
            h("span", { class: "prx-swatch", style: { background: gc[k] }, "aria-hidden": "true" }),
            h("span", {}, ctx.num(k + 1, formatCount(k + 1)), ": ", names ?? [ctx.num(n, formatCount(n)), " counties"]));
        }));
      }

      function drawScatter(grade,gc,state) {
        const S = CONFIG.scatter;
        const G = Math.max(...grade);
        const pts = U.name.map((name, i) => ({ i, name, grade: grade[i], x: U.mean_income[i], y: -U.mean_incarceration[i], fill: gc[grade[i] - 1] }))
          .sort((a, b) => b.grade - a.grade || a.i - b.i);
        const fig=plot(scatterSlot, {
          alt: T.outcomesAlt,
          table: {
            caption: [N(N_UNITS)," counties on the outcomes (posterior means) and their grade"],
            columns: [
              { label: "County", value: "name" },
              { label: "Income rank", value: "x", format: (v) => formatDecimal(v, { digits: 1 }) },
              { label: "Incarceration (%)", value: "y", format: (v) => formatDecimal(v, { digits: 2 }) },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: pts.slice().sort((a, b) => a.grade - b.grade || a.i - b.i),
          },
          height: S.height, marginLeft: S.marginLeft, marginRight: S.marginRight, marginTop: S.marginTop, marginBottom: S.marginBottom,
          x: { label: T.axisIncome, labelAnchor: "right", nice: true },
          y: { label: T.axisIncarceration, labelAnchor: "top", reverse: true, nice: true, ticks: 4 },
          color: { type: "identity" },
          marks: (c, P) => [
            P.dot(pts, { x: "x", y: "y", r: S.r, fill: "fill", stroke: c.plotMuted, strokeWidth: 0.6, strokeOpacity: 0.7 }),
            P.dot(pts.filter(d=>d.i===state.county),{x:'x',y:'y',r:9,stroke:c.plotFg,strokeWidth:2.5}),
            P.dot(G > 1 && pts.filter((d) => d.grade === 1).length <= CONFIG.maxOutlined ? pts.filter((d) => d.grade === 1) : [], { x: "x", y: "y", r: S.r + 2.2, stroke: c.plotFg, strokeWidth: 1.2 }),
          ],
          keyboard: {
            data: pts.slice().sort((a, b) => a.grade - b.grade || b.x - a.x), x: "x", y: "y", sort: false, key: (d) => String(d.i),
            onFocus:d=>{if(ctx.state.county!==d.i)ctx.set({county:d.i});},
            title: (d) => `${d.name}: grade ${formatCount(d.grade)} of ${formatCount(G)}; income rank ${formatDecimal(d.x, { digits: 1 })}, incarceration ${formatDecimal(d.y, { digits: 2 })}% (posterior means).`,
          },
        });
        syncStop(scatterSlot,state.county);
        fig.svg.addEventListener('click',event=>{const rect=fig.svg.getBoundingClientRect(),W=Number(fig.svg.getAttribute('width'))||rect.width,H=Number(fig.svg.getAttribute('height'))||rect.height,px=(event.clientX-rect.left)*W/rect.width,py=(event.clientY-rect.top)*H/rect.height,sx=fig.scale('x'),sy=fig.scale('y');const at=(v,scale)=>scale.range[0]+(v-scale.domain[0])*(scale.range[1]-scale.range[0])/(scale.domain[1]-scale.domain[0]);const close=pts.map(d=>({i:d.i,dist:(at(d.x,sx)-px)**2+(at(d.y,sy)-py)**2})).sort((a,b)=>a.dist-b.dist)[0];if(close&&close.dist<400)ctx.set({county:close.i});});
      }

      function drawIntervals(grade,state,pal){
        const order=reportCardRows(grade,{ids:E.ids,mean:U.mean_income},'mean');
        ['income','incarceration'].forEach((target,k)=>{const data=order.map(i=>({i,name:U.name[i],grade:grade[i],mean:U[`mean_${target}`][i],lo:U[`lower_${target}`][i],hi:U[`upper_${target}`][i]}));
          plot(intervalSlots[k],{alt:`Every county's supplied marginal ${target} interval, ordered by grade and income posterior mean.`,height:N_UNITS*15+70,marginLeft:142,marginRight:20,marginTop:25,marginBottom:40,
            table:{caption:`Complete ${target} marginal interval card`,columns:[{label:'County',value:'name'},{label:'Grade',value:'grade',format:formatCount},{label:'Mean',value:'mean',format:v=>formatDecimal(v,{digits:2})},{label:'Lower',value:'lo',format:v=>formatDecimal(v,{digits:2})},{label:'Upper',value:'hi',format:v=>formatDecimal(v,{digits:2})}],rows:data},
            x:{label:target==='income'?'Income rank (percentile)':'Negative incarceration (percentage points)',nice:true},y:{domain:data.map(d=>d.name),label:null,tickSize:0},
            marks:(c,P)=>[P.ruleX([0],{stroke:c.plotGrid}),P.ruleY(data,{x1:'lo',x2:'hi',y:'name',stroke:c.post,strokeWidth:1.5}),P.dot(data,{x:'mean',y:'name',fill:c.post,r:2.5}),P.dot(data.filter(d=>d.i===state.county),{x:'mean',y:'name',stroke:c.plotFg,r:6,strokeWidth:2})],
            keyboard:{data,x:'mean',y:'name',sort:false,key:d=>String(d.i),onFocus:d=>{if(ctx.state.county!==d.i)ctx.set({county:d.i});},title:d=>`${d.name}, grade ${formatCount(d.grade)}: mean ${formatDecimal(d.mean,{digits:2})}, marginal interval ${formatDecimal(d.lo,{digits:2})} to ${formatDecimal(d.hi,{digits:2})}.`}});
          syncStop(intervalSlots[k],state.county);
        });
      }
      function drawBars(dp) {
        const B = CONFIG.bars;
        const rows = [T.income, T.incarceration];
        const data = rows.map((row, k) => ({ row, v: dp.EoverN[k] })).filter((d) => d.v !== null);
        plot(barSlot, {
          alt: T.barsAlt,
          table: {
            caption: "Share of stated directions expected to be wrong, by outcome",
            columns: [
              { label: "Outcome", value: "row" },
              { label: "Share expected wrong", value: "v", format: (v) => formatShare(v) },
            ],
            rows: rows.map((row,k)=>({row,v:dp.EoverN[k]})),
          },
          height: B.height, marginLeft: B.marginLeft, marginRight: B.marginRight, marginTop: B.marginTop, marginBottom: B.marginBottom,
          x: { domain: [0, Math.max(B.top,...data.map(d=>d.v))], label: null },
          y: { domain: rows, label: null, tickSize: 0, padding: 0.28 },
          color: { type: "identity" },
          marks: (c, P) => [
            P.barX(data, { x: "v", y: "row", fill: c.err }),
            P.ruleX([0], { stroke: c.plotAxis }),
            numText(data, { x: "v", y: "row", value: "v", format: (v) => formatShare(v), dx: 5, textAnchor: "start", fill: c.plotFg, fontWeight: 700 }),
          ],
          keyboard: {
            data, x: "v", y: "row", sort: false,
            title: (d) => `${d.row}: ${formatShare(d.v)} of the stated directions are expected to be wrong.`,
          },
        });
      }

      return {
        render(state,meta={}) {
          w.set(state.w);tau.set(state.tau);cap.set(state.cap);report.set(state.report);county.set(state.county);overlay.set(state.overlay);
          if(state.edited!==lastEdited||meta.changed?.includes('report')){editor.value=state.edited;lastEdited=state.edited;dirty=false;}else if(!dirty)editor.value=state.edited;editorPanel.hidden=state.report!=='edited';
          const pal = palette(ctx.root);
          const dp=commonAt(state.w,state.tau,state.cap);
          const grade=Array.from(state.report==='common'?dp.grade:state.report==='withheld'?Array(N_UNITS).fill(1):state.report==='edited'?state.edited.split(',').map(Number):SOURCE_REPORTS[state.report]);
          const ev=evaluateReport(grade,E,{tau:state.tau,w:[state.w,1-state.w]});
          const gc = gradeRamp(Math.max(...grade), pal);
          drawMap(grade,gc,pal,state);drawScatter(grade,gc,state);drawBars(ev);drawIntervals(grade,state,pal);
          ownHolder.hidden=state.overlay==='none';
          const own=state.overlay==='income'?'D1':state.overlay==='incarceration'?'D2':'P';
          if(state.overlay!=='none'){
            const archiveGrade=SOURCE_REPORTS[own];
            const same=grade.every((g,j)=>g===archiveGrade[j]);
            ownFold.root.hidden=!same;
            const destination=same?ownFold.body:ownHolder;
            if(ownPanel.parentNode!==destination){
              if(same)ownFold.open=false;
              ctx.keepFocus(()=>destination.prepend(ownPanel));
            }
            ownTitle.textContent=`Archived own report: ${own}`;
            drawMap(archiveGrade,gradeRamp(disclosure(archiveGrade).G,pal),pal,state,ownSlot,ownKey);
          }
          // the short tag of the order search (that it meets postrank's archived reports at w = 0, 1/2 and 1 is said
          // on the page, which has the room)
          tag.replaceChildren("Live search reference: ", tagNode(ctx, dp, { key: "order",orderWords:"weighted expected-rank order" }), ".");
          const set = (v) => ctx.num(v, formatSetting(v));
          const name = Math.abs(state.w - SET.weights.income) < 1e-9 ? ["Equal weights"]
            : state.w >= 1 ? ["Income only"] : state.w <= 0 ? ["Incarceration only"]
              : state.w > SET.weights.income ? ["Income ", set(state.w)] : ["Incarceration ", set(1 - state.w)];
          const share = (k) => ctx.num(ev.EoverN[k], formatShare(ev.EoverN[k]));
          ctx.readout.set([
            ...name, ": ", ctx.num(ev.N, formatCount(ev.N)), " of ", ctx.num(M, formatCount(M)), " pairs stated",
            ...(ev.N === 0 ? [". Neither outcome has an error share among stated pairs."]
              : ["; share of stated directions expected wrong ", share(0), " on income, ", share(1), " on incarceration."]),
          ]);
          const label=REPORTS.find(r=>r[0]===state.report)[1],d=disclosure(grade),change=relationChange(SOURCE_REPORTS.P,grade);
          fixedRisk.hidden=state.report==='common';
          fixedRisk.replaceChildren(label,' · weighted risk ',N(ev.risk,formatRisk),'.');
          summary.replaceChildren(h('p',{},label,': ',N(ev.N,formatCount,'selected-N'),' of ',N(M),' pairs stated (',N(d.s,formatShare,'selected-share'),'); weighted risk ',N(ev.risk,formatRisk,'selected-risk'),'.'),h('p',{class:'al-vector'},'Selected grade vector ',N(grade,formatGrades,'selected-grade')),state.report==='common'?tagNode(ctx,dp,{orderWords:'weighted expected-rank order'}):captionNode(ctx,'fixed-report'));
          settings.replaceChildren(h('p',{},'Current live search: τ = ',N(state.tau,formatSetting),', at most ',N(state.cap),' grades; income weight ',N(state.w,formatSetting),', incarceration weight ',N(1-state.w,formatSetting),'. The weighted expected-rank order is recomputed from posterior average positions. Equal scores stay together.'),h('p',{},'Original archive: τ = ',N(TAU,formatSetting),', at most ',N(GMAX),' grades, equal weights; postrank v0.9.0 with HiGHS v1.12.0.3. Supplied intervals have level ',N(AL.facts.interval_level,formatShare),' and are equal-tail marginal intervals as stored. Current risks at different weights or costs belong to different losses.'),h('p',{},'Live order family ',N(dp.family.size,formatCount,'live-family'),'; ',N(dp.tieCount,formatCount,'live-ties'),dp.tieCount===1?' minimizing report at tolerance ':' minimizing reports at tolerance ',N(dp.tieTol,formatSci,'live-tolerance'),'.'));
          const i=state.county;details.replaceChildren(h('p',{},U.name[i],'; selected grade ',N(grade[i]),', archived P grade ',N(SOURCE_REPORTS.P[i]),', income D1 grade ',N(SOURCE_REPORTS.D1[i]),', incarceration D2 grade ',N(SOURCE_REPORTS.D2[i]),'.'),table(['Outcome','Mean','Lower','Upper'],['income','incarceration'].map(k=>[k,...['mean','lower','upper'].map(prefix=>N(U[`${prefix}_${k}`][i],v=>formatDecimal(v,{digits:2})))])),h('p',{},'Incarceration is expressed in negative percentage points, so larger values correspond to lower incarceration. The income and incarceration models were fit separately and give expected loss for each outcome.'));
          const list=[['live',dp.grade],...Object.keys(SOURCE_REPORTS).filter(k=>k!=='fips').map(k=>[k,SOURCE_REPORTS[k]]),['withheld',Array(N_UNITS).fill(1)]];if(state.report==='edited')list.push(['edited',grade]);
          profiles.replaceChildren(table(['Report','Outcome','Expected wrong E','E/N','E/M','Criterion risk','Weighted risk','N','Weighted expected errors','Error contribution','Withholding contribution'],list.flatMap(([id,g])=>{const e=evaluateReport(g,E,{tau:state.tau,w:[state.w,1-state.w]});return ['Income','Incarceration'].map((name,k)=>[id,name,N(e.E[k],formatExpectedCount,`${id}-E-${k}`),N(e.EoverN[k],formatShare,`${id}-share-${k}`),N(e.EoverM[k],formatShare),N(e.Rk[k],formatRisk,`${id}-Rk-${k}`),N(e.risk,formatRisk,`${id}-risk-${k}`),N(e.N,formatCount,`${id}-N-${k}`),N(e.Ew,formatExpectedCount),N(e.errorTerm,formatRisk),N(e.withholdingTerm,formatRisk)]);})),h('p',{},'Criterion risk adds expected wrong directions and the withholding cost for silent pairs, divided by all pairs. Weighted risk averages those criterion risks using the current weights. All fixed reports are evaluated under the same current loss. With no statements, E/N is NA and E/M is zero. P and B3 happen to have identical vectors in this example.'));
          const cm=AL.tables.commonality,af=AL.analyses.case_alabama67.facts,rm=AL.tables.reference_metrics;
          archive.replaceChildren(h('p',{},'Stored common selection: ',tagNode(ctx,af),'; status ',af.status,'; risk ',N(af.risk,formatRisk,'archive-risk'),'; lower bound ',N(af.lower_bound,formatRisk,'archive-bound'),'; absolute gap ',N(af.gap,formatSci,'archive-gap'),'; bound source ',af.bound_source,'.'),h('p',{},'The interval bounds the extra risk of using the common grades instead of grades chosen for one outcome. It uses the original loss and full set of reports allowed by the grade cap. The bounds come from the best report the original solver found for that outcome and its lower bound.'),table(['Criterion','Common risk','Own incumbent risk','Own lower bound','Cost lower','Cost upper','Own status','Common status','Common gap'],cm.criterion.map((name,k)=>[name,N(cm.common_criterion_risk_A[k],formatRisk,`commonality-common-${k}`),N(cm.single_incumbent_risk_A[k],formatRisk,`commonality-own-${k}`),N(cm.single_lower_bound_A[k],formatRisk),N(cm.cost_lower_A[k],formatRisk,`commonality-lower-${k}`),N(cm.cost_upper_A[k],formatRisk,`commonality-upper-${k}`),cm.single_solver_status[k],cm.common_solver_status[k],N(cm.common_solver_gap_A[k],formatSci)])),table(['Own-criterion solve','Criterion','Original risk','Original lower bound','Original gap','Original status'],AL.tables.single_criterion.method.map((id,k)=>[id,AL.tables.single_criterion.criterion[k],N(AL.tables.single_criterion.risk[k],formatRisk),N(AL.tables.single_criterion.lower_bound[k],formatRisk),N(AL.tables.single_criterion.gap[k],formatSci,`own-archive-gap-${k}`),AL.tables.single_criterion.normalized_status[k]])), h('p',{},AL.facts.archive_note.replace('postrank ','postrank v').replace('HiGHS ','HiGHS v')));
          const columns=[['description','Description',null],['N','Pairs stated',formatCount],['Goccupied','Grades occupied',formatCount],['tau','Original cost τ',formatSetting],['G_max','Original grade cap',formatCount],['A_E_income','Income expected wrong',formatExpectedCount],['A_E_incarceration','Incarceration expected wrong',formatExpectedCount],['A_Ew','Weighted expected wrong',formatExpectedCount],['A_Ew_over_N','Weighted wrong / stated',formatShare],['A_Ew_over_M','Weighted wrong / all pairs',formatShare],['A_Rtau','Original weighted risk',formatRisk],['A_R_income','Income risk',formatRisk],['A_R_incarceration','Incarceration risk',formatRisk],['A_solver_status','Stored status',null],['A_solver_lower_bound','Stored lower bound',formatRisk],['A_solver_gap','Stored gap',formatSci]];
          archive.append(table(['Stored report',...columns.map(c=>c[1])],rm.method.map((method,j)=>[method,...columns.map(([key,,fmt])=>fmt?N(rm[key][j],fmt):String(rm[key][j]??'NA'))])));
          const agreements=['P','D1','D2'].map(id=>{const ae=evaluateReport(SOURCE_REPORTS[id],E,{tau:state.tau,w:[state.w,1-state.w]});const same=Array.from(dp.grade).every((g,j)=>g===SOURCE_REPORTS[id][j]);return h('p',{},id,': complete live grade vector ',same?'agrees':'differs','; stored report has ',N(ae.N),' pairs and current risk ',N(ae.risk,formatRisk),'.');});
          changes.replaceChildren(...agreements,h('p',{},'Compared with archived P: ',N(change.changed,formatCount,'changed'),' pair relations changed; ',N(change.nNewDisclosed,formatCount,'newly-stated'),' newly stated, ',N(change.nNewWithheld,formatCount,'newly-withheld'),' newly withheld, ',N(change.nReversed,formatCount,'reversed'),' reversed.'),table(['County','P grade','Selected grade','D1 grade','D2 grade'],U.name.map((name,j)=>[name,N(SOURCE_REPORTS.P[j]),N(grade[j]),N(SOURCE_REPORTS.D1[j]),N(SOURCE_REPORTS.D2[j])])));
          ties.replaceChildren(h('p',{},N(dp.grades.length),' of ',N(dp.tieCount),' minimizing reports returned in ',dp.gradesOrder,' order. The first is used in the linked views.'),...dp.grades.map((g,j)=>h('p',{class:'al-vector'},'Report ',N(j+1),': ',N(Array.from(g),formatGrades))),h('p',{class:'al-vector'},'Live grade vector ',N(Array.from(dp.grade),formatGrades,'live-grade')));
          gradeCells.forEach((n,j)=>setNum(n,grade[j],formatCount(grade[j])));ownCells.forEach((n,j)=>setNum(n,SOURCE_REPORTS[own][j],formatCount(SOURCE_REPORTS[own][j])));rows.forEach((r,j)=>{r.classList.toggle('al-selected',j===i);r.querySelector('button').tabIndex=j===i?0:-1;if(j===i)r.setAttribute('aria-current','true');else r.removeAttribute('aria-current');});reportCardRows(grade,{ids:E.ids,mean:U.mean_income},'mean').forEach(j=>rowBody.append(rows[j]));

        },
      };
    },
  });
}
