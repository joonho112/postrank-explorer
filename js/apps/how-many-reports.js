// Count whole reports through engine familySize; no reports are enumerated beyond the small example.
import { createWidget } from '../shared/base.js';
import { plot } from '../shared/chart.js';
import { blocksText, formatCount, formatSci } from '../shared/format.js';
import { enumerateReports, familySize } from '../pr-core.js';
import { drawGradeBoxes, reportCountRows, REPORT_BUILDER_CSS } from './report-builder.js';

export const CONFIG = Object.freeze({ name:'how-many-reports', className:'prx-hmr', n:{min:2,max:12,step:1,value:3}, G:{min:1,max:6,step:1,value:3} });
const FAMILIES = [
  {id:'all', label:'All reports', dash:null},
  {id:'cap', label:'At most G grades', dash:'8,3'},
  {id:'exact', label:'Exactly G grades', dash:'2,3'},
  {id:'order', label:'Cuts of one order', dash:'8,3,2,3'},
  {id:'rank', label:'Strict rankings', dash:'1,2'},
];
export function countFamilies(n, G) {
  return { all:familySize(n,{kind:'all'}), cap:familySize(n,{kind:'atMost',G}), exact:familySize(n,{kind:'exactly',G}), order:familySize(n,{kind:'order',order:Array.from({length:n},(_,i)=>i)}), rank:familySize(n,{kind:'exactly',G:n}) };
}
export function countSeries(G) {
  return reportCountRows(2,12).flatMap(({n,count})=>{const r=countFamilies(n,G);r.all=count;return FAMILIES.map(f=>({n,kind:f.id,label:f.label,count:r[f.id]}));});
}
const exampleFamily=(kind,n,G)=>kind==='cap'?{kind:'atMost',G}:kind==='exact'?{kind:'exactly',G}:kind==='order'?{kind:'order',order:Array.from({length:n},(_,i)=>i)}:kind==='rank'?{kind:'exactly',G:n}:{kind:'all'};
const CSS=`
.prx-hmr .prx-hmr-legend {display:flex;flex-wrap:wrap;gap:.3rem 1rem;padding:.5rem;color:var(--prx-plot-fg);background:var(--prx-plot-bg)}
.prx-hmr .prx-hmr-legend span {display:inline-flex;gap:.35rem;align-items:center}
.prx-hmr .prx-hmr-dash {width:2.1rem;height:.7rem;flex:none}
.prx-hmr .prx-hmr-note {font-size:.9em;color:var(--prx-fg-muted);margin:.45rem 0}
.prx-hmr .prx-hmr-table-scroll {max-width:100%;overflow-x:auto}
.prx-hmr .prx-hmr-table {border-collapse:collapse;font-size:.9em;font-variant-numeric:tabular-nums;min-width:42rem;width:100%}
.prx-hmr .prx-hmr-table th,.prx-hmr .prx-hmr-table td {padding:.3rem .5rem;border-bottom:1px solid var(--prx-border);text-align:right;white-space:nowrap}
.prx-hmr .prx-hmr-table th:first-child {text-align:left}
.prx-hmr .prx-hmr-table .prx-hmr-current {font-weight:700;background:var(--prx-bg-raised)}
.prx-hmr .prx-hmr-table caption {text-align:left;color:var(--prx-fg-muted);padding:.3rem 0}
.prx-hmr .prx-hmr-example {margin-top:1rem;max-width:38rem}
.prx-hmr .prx-hmr-example .prx-rb-site {cursor:default;display:inline-flex;align-items:center;justify-content:center}
.prx-hmr .prx-hmr-example .prx-rb-new {display:none}
.prx-hmr .prx-hmr-sites {margin:.75rem 0;font-size:.9em}
.prx-hmr .prx-hmr-example-controls {display:flex;flex-wrap:wrap;gap:.75rem}
.prx-hmr .prx-hmr-example-controls > * {flex:1 1 15rem}
`;
export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:CONFIG.name,className:CONFIG.className,label:'How many grade reports are there? Compare exact family sizes as the number of units and grade restriction change.',css:REPORT_BUILDER_CSS+CSS,
 keys:{n:{type:'integer',...CONFIG.n},G:{type:'integer',...CONFIG.G},family:{type:'choice',values:FAMILIES.map(f=>f.id),value:'all'},report:{type:'integer',min:1,max:75,step:1,value:1}},
 build(ctx) {
  const {h}=ctx;const ro=(name,value)=>{const e=ctx.num(value,formatCount(value));e.dataset.prxReadout=name;return e;};
  const n=ctx.slider({label:'Units n',...ctx.key('n'),onInput:v=>ctx.set({n:v,report:1})});
  const G=ctx.slider({label:'Grade limit or exact count G',...ctx.key('G'),onInput:v=>ctx.set({G:v,report:1})});
  ctx.controls.append(n.root,G.root);
  const fig=h('div');const legend=h('div',{class:'prx-hmr-legend','data-prx-part':'legend'});
  for(const f of FAMILIES){const svg=ctx.doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 35 10');svg.setAttribute('class','prx-hmr-dash');svg.setAttribute('aria-hidden','true');const line=ctx.doc.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:0,y1:5,x2:35,y2:5,stroke:'currentColor','stroke-width':2,...(f.dash?{'stroke-dasharray':f.dash}:{})}))line.setAttribute(k,String(v));svg.append(line);legend.append(h('span',{},svg,f.label));}
  const note=h('p',{class:'prx-hmr-note'},'Equal vertical steps multiply the count by the same factor. Empty families appear as zero in the table and are omitted from the logarithmic plot. Hollow squares mark sizes used elsewhere on this site.');
  const sites=h('p',{class:'prx-hmr-sites'});
  const tableSlot=ctx.scrollRegion(h('div',{class:'prx-hmr-table-scroll'}),'Exact report counts by number of units and family');
  const example=h('section',{class:'prx-hmr-example prx-rb','aria-label':'Small reports, drawn as grade boxes'});
  const family=ctx.select({label:'Small example family',options:FAMILIES.map(f=>({value:f.id,label:f.label})),value:ctx.state.family,onChange:v=>ctx.set({family:v,report:1})});
  const next=ctx.slider({label:'Example report',...ctx.key('report'),onInput:v=>ctx.set({report:v})});
  const exampleControls=h('div',{class:'prx-hmr-example-controls'},family.root,next.root);
  const exampleText=h('p');const boxes=h('ol',{class:'prx-rb-boxes','aria-label':'A small report in grade order'});
  example.append(ctx.panelTitle('What is being counted?'),h('p',{class:'prx-hmr-note'},'Each occupied box is a grade. A report changes when its pairwise decisions change. Renumbering occupied grades without changing their order does not create a new report.'),exampleControls,exampleText,boxes);
  ctx.charts.append(fig,legend,note,sites,tableSlot,example);ctx.charts.before(ctx.readout.node);
  return {render(state) {
   n.set(state.n);G.set(state.G);family.set(state.family);
   const current=countFamilies(state.n,state.G);const series=countSeries(state.G);const positive=series.filter(d=>d.count>0);
   const landmarks=positive.filter(d=>(d.kind==='all'&&[3,6,8].includes(d.n))||(state.G===3&&d.kind==='cap'&&[6,12].includes(d.n)));
   const width=Math.max(250,ctx.width());
   plot(fig,{width,height:340,marginLeft:width<450?59:94,marginRight:18,marginTop:24,marginBottom:45,
    x:{domain:[2,12],ticks:[2,4,6,8,10,12],label:'Number of units n'},y:{type:'log',domain:[1,1e11],label:'Reports (log scale)',ticks:[1,1e2,1e4,1e6,1e8,1e10],grid:true,tickFormat:v=>formatSci(v,{sig:1})},
    alt:'Exact report counts on a logarithmic vertical axis, for all reports, at most G grades, exactly G grades, contiguous cuts of a declared order, and strict rankings.',
    table:{caption:'Counts by units and report family',columns:[{label:'Units',value:'n'},{label:'Family',value:'label',num:false},{label:'Reports',value:'count',format:v=>formatCount(v)}],rows:series},
    marks:(c,P)=>[...FAMILIES.map(f=>P.line(positive.filter(d=>d.kind===f.id),{x:'n',y:d=>Number(d.count),stroke:c.plotFg,strokeWidth:f.id==='all'?2:1.6,strokeDasharray:f.dash})),P.ruleX([state.n],{stroke:c.plotMuted,strokeDasharray:'3,4'}),P.dot(positive.filter(d=>d.n===state.n),{x:'n',y:d=>Number(d.count),fill:c.plotBg,stroke:c.plotFg,r:4}),P.dot(landmarks,{x:'n',y:d=>Number(d.count),symbol:'square',fill:c.plotBg,stroke:c.plotFg,r:4})],
    keyboard:{data:series,x:'n',y:d=>d.count>0?Number(d.count):null,key:d=>`${d.kind}-${d.n}`,sort:false,title:d=>`${d.n} units, ${d.label.replace('G',state.G)}: ${formatCount(d.count)} reports${d.count===0?'; empty family, omitted from the log plot':''}.`},
   });
   ctx.readout.set(['With ',ro('n',state.n),' units, there are ',ro('all',current.all),' grade reports and ',ro('rank',current.rank),' strict rankings. At most ',ro('G',state.G),' grades permits ',ro('cap',current.cap),', exactly that many permits ',ro('exact',current.exact),', and cuts of one order permit ',ro('order',current.order),'.']);
   const siteCounts=[{n:3,kind:'all'},{n:6,kind:'cap'},{n:6,kind:'all'},{n:12,kind:'cap'},{n:8,kind:'all'}];
   sites.replaceChildren('Sizes used elsewhere: ',...siteCounts.flatMap((d,i)=>[i?'; ':'',ro(`site-${d.n}-${d.kind}`,countFamilies(d.n,3)[d.kind]),' (',ctx.num(d.n,formatCount(d.n)),` units, ${d.kind==='all'?'all reports':'at most three grades'})`]),'.');
   const table=h('table',{class:'prx-hmr-table'},h('caption',{},'Exact counts; G = ',ctx.num(state.G,formatCount(state.G))),h('thead',{},h('tr',{},h('th',{scope:'col'},'Units'),...FAMILIES.map(f=>h('th',{scope:'col'},...f.label.split('G').flatMap((v,i)=>i?[ctx.num(state.G,formatCount(state.G)),v]:[v]))))));
   table.append(h('tbody',{},...reportCountRows(2,12).map(({n})=>{const r=countFamilies(n,state.G);return h('tr',{class:n===state.n?'prx-hmr-current':null},h('th',{scope:'row'},ctx.num(n,formatCount(n))),...FAMILIES.map(f=>h('td',{},ro(`table-${n}-${f.id}`,r[f.id]))));})));tableSlot.replaceChildren(table);
   const small=Math.min(state.n,4);const ids=Array.from({length:small},(_,i)=>String.fromCharCode(65+i));const reports=Array.from(enumerateReports(small,exampleFamily(state.family,small,state.G)));
   next.input.max=String(Math.max(1,reports.length));next.set(Math.min(state.report,Math.max(1,reports.length)));next.input.disabled=reports.length<2;
   if(reports.length){const index=Math.min(state.report,reports.length)-1;if(state.report!==index+1)ctx.set({report:index+1});const g=reports[index];drawGradeBoxes(ctx,boxes,{g,ids});exampleText.replaceChildren('Small example: ',ro('example-n',small),' units; report ',ro('example-index',index+1),' of ',ro('example-count',reports.length),': ',h('span',{'data-prx-readout':'example-blocks'},blocksText(g,ids)),'.');}
   else {boxes.replaceChildren();exampleText.replaceChildren('Small example: ',ro('example-n',small),' units; ',ro('example-count',0),' reports, because an exact count of ',ctx.num(state.G,formatCount(state.G)),' nonempty grades cannot fit.');}
  }};
 }});
}
