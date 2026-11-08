// The exact lower envelope of report risks; full family risks are painted on canvas behind its vertices.
// Layout (review 044 repair: X-01, X-14): base.js's result-first frame: the controls (τ, the family, the cost window;
// the preset row on its own line), the read-out directly under them, the envelope chart first among the charts
// (ctx.primaryGraphic) and its aligned band strip first, then the notes, family labels, ties and endpoint-only
// example; the complete interval table and the new directions at each bend are in a closed "Complete path" box.
// The τ control follows the cost window (G1-F5): one slider per window on the same tau key, the window's own range
// shown ([0, .5] in steps of .01; the low-cost zoom [0, .02] in steps of .0001); keyboard and pointer land on a grid
// anchored at 0, the minimum staying a clamp (X-13), while a preset or URL value off the grid stays exact. A tie at the
// smallest risk is named in the read-out (X-12, labels.js tieNode).
import { createWidget } from '../shared/base.js';
import { canvasLayer, plot } from '../shared/chart.js';
import { blocksText, formatCount, formatDecimal, formatExpectedCount, formatGrades, formatRisk, formatSci, formatSetting, formatProb, setNum } from '../shared/format.js';
import { captionNode, tagNode, tieNode } from '../shared/labels.js';
import { errorArray, evaluateReport, exactOptimum, pairCount, relations, reportCloud, statedAbove, tauPath } from '../pr-core.js';
import { drawTauStrip } from './price-of-silence.js';
import SIX from '../../data/released/six-sites.json' with { type:'json' };

export const CONFIG = Object.freeze({name:'tau-path',className:'prx-tp',tau:{min:0.000001,max:0.5,step:0.001,value:0.2},
 // the τ slider of each cost window (review 044 repair, G1-F5 and X-13): the window's range, a keyboard step on a grid
 // anchored at origin; the tau key above is unchanged
 sliders:Object.freeze({full:Object.freeze({max:0.5,step:0.01}),low:Object.freeze({max:0.02,step:0.0001}),origin:0})});
const source=SIX.arrays.one;
const E={ids:source.ids.slice(),criteria:source.criteria.slice(),e:source.e.map(m=>m.map(r=>r.map(v=>v===null?NaN:v)))};
const IDS=E.ids,M=pairCount(IDS.length);
const familyOf=cap=>cap==='none'?{kind:'all'}:{kind:'atMost',G:3};
const otherOf=cap=>cap==='none'?3:'none';
const familyWords=cap=>cap==='none'?'all reports':'at most three grades';
const tauFormat=v=>formatDecimal(v,{digits:Math.min(8,Math.max(2,(String(v).split('.')[1]??'').length))});
// a pointer position on a slider's grid: the nearest multiple of the step from 0, the minimum staying a clamp
const snapTo=step=>{const d=Math.max(0,Math.round(-Math.log10(step)));return v=>Math.max(CONFIG.tau.min,Number((Math.round(v/step)*step).toFixed(d)));};
const paths=new Map(),clouds=new Map(),lines=new Map();
export function pathFor(cap='none'){if(!paths.has(cap))paths.set(cap,tauPath(E,{family:familyOf(cap)}));return paths.get(cap);}
export function changesFor(cap='none') {
 return pathFor(cap).intervals.slice(1).map((iv,k)=>{
  const before=relations(pathFor(cap).intervals[k].grade),after=relations(iv.grade),pairs=[];
  for(let i=0;i<IDS.length;i++)for(let j=0;j<IDS.length;j++)if(after[i][j]===1&&before[i][j]!==1)pairs.push({above:IDS[i],below:IDS[j],error:E.e[0][i][j]});
  return {...iv,pairs};
 });
}
function lineData(cap,hi){
 const key=`${cap}-${hi}`;if(lines.has(key))return lines.get(key);
 if(!clouds.has(cap))clouds.set(cap,reportCloud(E,{family:familyOf(cap)}));
 const rows=clouds.get(cap).points.map(p=>({grade:p.grade,left:evaluateReport(p.grade,E,{tau:CONFIG.tau.min}).risk,right:evaluateReport(p.grade,E,{tau:hi}).risk}));
 lines.set(key,rows);return rows;
}
function envelope(cap,hi){return pathFor(cap).intervals.filter(iv=>iv.tauFrom<=hi).flatMap(iv=>[{tau:Math.max(CONFIG.tau.min,iv.tauFrom),risk:evaluateReport(iv.grade,E,{tau:Math.max(CONFIG.tau.min,iv.tauFrom)}).risk},{tau:Math.min(hi,iv.tauTo),risk:evaluateReport(iv.grade,E,{tau:Math.min(hi,iv.tauTo)}).risk}]);}
const endpointExample=tauPath(errorArray([0,0,0],[1,1,1]),{family:{kind:'all'}});
const CSS=`
.prx-tp .prx-tp-note {font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0}
.prx-tp .prx-tp-label {margin:.45rem 0;font-size:.9em}
.prx-tp .prx-tp-strip {margin-top:.8rem;min-width:0}
.prx-tp .prx-tp-strip svg {overflow:hidden}
.prx-tp .prx-tp-table-scroll {max-width:100%;overflow-x:auto}
.prx-tp .prx-tp-table {border-collapse:collapse;min-width:48rem;width:100%;font-variant-numeric:tabular-nums;font-size:.85em}
.prx-tp .prx-tp-table td,.prx-tp .prx-tp-table th {text-align:left;border-bottom:1px solid var(--prx-border);padding:.35rem .45rem;white-space:nowrap}
.prx-tp .prx-tp-table .prx-tp-current {background:var(--prx-bg-raised);font-weight:700}
.prx-tp .prx-tp-legend {display:flex;flex-wrap:wrap;gap:.3rem 1rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.4rem;font-size:.85em}
.prx-tp .prx-tp-legend span {display:inline-flex;align-items:center;gap:.35rem}
.prx-tp .prx-tp-swatch {width:1.8rem;height:0;border-top:3px solid var(--prx-plot-fg)}
.prx-tp .prx-tp-dashed {border-top:2px dashed var(--prx-plot-muted)}
.prx-tp .prx-tp-faint {border-top:1px solid var(--prx-plot-muted);opacity:.4}
.prx-tp .prx-tp-changes {padding-left:1.3rem;font-size:.9em}
.prx-tp .prx-tp-changes li {margin:.4rem 0}
.prx-tp .prx-tp-endpoint {margin-top:1rem;padding:.6rem;border:1px solid var(--prx-border);border-radius:6px}
.prx-tp .prx-disclosure-body > .prx-panel-title:first-child {margin-top:0}
`;
export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:CONFIG.name,className:CONFIG.className,label:'The best report along tau: report risk lines, their lower envelope, and the comparisons that change at each bend.',css:CSS,
 // review 044 repair (X-01): the shared result-first frame; base.js only moves nodes, so keys, presets, hooks and the
 // one live region are kept
 layout:'result-first',
 keys:{tau:{type:'number',...CONFIG.tau},cap:{type:'choice',values:['none',3],value:'none'},zoom:{type:'choice',values:['full','low'],value:'full'}},
 build(ctx){
  const {h}=ctx;const ro=(key,value,format=formatCount)=>{const e=ctx.num(value,format(value));e.dataset.prxReadout=key;return e;};
  // τ: one slider per cost window, both on the tau key, only the window's own slider shown (G1-F5). Its value text is
  // the exact τ of the state (a preset or URL value off the grid stays exact); a pointer position on its way to the
  // grid shows as that grid value (X-13); in the low window a τ above it (from a URL) shows as that τ, the thumb at the
  // window's end, beside the existing out-of-window note
  let exactTau=ctx.state.tau;
  const tauSlider=which=>{
   const S=CONFIG.sliders[which],snap=snapTo(S.step);
   const shown=v=>(exactTau>S.max&&v>=S.max?exactTau:v===exactTau?v:snap(v));
   return ctx.slider({label:'Withholding cost τ',name:'tau',key:which==='full'?'slider:tau':'slider:tau-low',min:CONFIG.tau.min,max:S.max,step:S.step,stepOrigin:CONFIG.sliders.origin,value:ctx.state.tau,valueType:'number',format:v=>tauFormat(shown(v)),onInput:v=>ctx.set({tau:snap(v)})});
  };
  const tau=tauSlider('full'),tauLow=tauSlider('low');
  ctx.primaryControl(tau.root);ctx.primaryControl(tauLow.root);
  const cap=ctx.segmented({label:'Family of reports',options:[{value:'none',label:'All reports'},{value:3,label:'At most three grades'}],value:ctx.state.cap,onChange:v=>ctx.set({cap:v})});
  const zoom=ctx.segmented({label:'Cost window',options:[{value:'full',label:'Overview'},{value:'low',label:'Low-cost zoom'}],value:ctx.state.zoom,onChange:v=>ctx.set({zoom:v,...(v==='low'&&ctx.state.tau>.02?{tau:.005}:{})})});
  ctx.controls.append(tau.root,tauLow.root,cap.root,zoom.root);
  // the chart the controls move, directly under the read-out (base.js primaryGraphic)
  const figure=ctx.primaryGraphic(h('div')),legend=h('div',{class:'prx-tp-legend','data-prx-part':'legend'});
  const labels=h('div',{class:'prx-tp-label'}),ties=h('div',{class:'prx-tp-note'}),coherence=h('p',{class:'prx-tp-note'});
  const stripSlot=h('div'),stripNote=h('p',{class:'prx-tp-note'}),stripScope=h('p',{class:'prx-tp-note'});
  const strip=h('section',{class:'prx-tp-strip'},ctx.panelTitle('The report stays fixed between bends'),stripSlot,stripNote,stripScope);
  const tableSlot=ctx.scrollRegion(h('div',{class:'prx-tp-table-scroll'}),'Every interval of the exact tau path');
  const changes=h('ol',{class:'prx-tp-changes'});
  const endpoints=h('section',{class:'prx-tp-endpoint'});
  ctx.charts.append(figure,strip,legend,h('p',{class:'prx-tp-note'},'Faint lines are the risks of every report in the selected family; only their lowest edge is optimal. The visible vertical window follows this edge, so high-risk portions lie above the figure. Arrow keys read the reports on the lower envelope.'),labels,ties,coherence,endpoints);
  // the complete path, one click away (review 044, X-14): every interval and every bend, closed by default
  const pathBox=ctx.disclosure({name:'path',title:'Complete path'});
  pathBox.body.append(ctx.panelTitle('The complete path'),tableSlot,ctx.panelTitle('New directions at each bend'),changes);
  let layer=null;
  ctx.onCleanup(()=>layer?.remove());
  return {render(state){
   exactTau=state.tau;
   tau.set(state.tau);tauLow.set(state.tau);cap.set(state.cap);zoom.set(state.zoom);
   // a τ above the low window: that slider's thumb rests at the window's end and its value text is the exact τ, so
   // the value's data-num is that τ too (the slider itself keeps the clamped position)
   if(state.tau>CONFIG.sliders.low.max)setNum(tauLow.output,state.tau,tauFormat(state.tau));
   tau.root.hidden=state.zoom==='low';tauLow.root.hidden=state.zoom!=='low';
   const path=pathFor(state.cap),other=pathFor(otherOf(state.cap)),hi=state.zoom==='low'?.02:.5;
   const optimum=exactOptimum(E,{tau:state.tau,family:familyOf(state.cap)}),comparison=exactOptimum(E,{tau:state.tau,family:familyOf(otherOf(state.cap))});
   const active=envelope(state.cap,hi),contrast=envelope(otherOf(state.cap),hi),ys=Math.max(...active.map(d=>d.risk),...contrast.map(d=>d.risk))*1.12;
   const vertices=path.intervals.filter(iv=>iv.tauFrom<=hi);
   const vertexLines=vertices.flatMap((iv,k)=>[CONFIG.tau.min,hi].map(t=>({k,tau:t,risk:evaluateReport(iv.grade,E,{tau:t}).risk})));
   const width=Math.max(250,ctx.width()),ml=54,mr=18,mt=20,mb=44,height=300;
   layer?.remove();layer=null;
   const chart=plot(figure,{width,height,marginLeft:ml,marginRight:mr,marginTop:mt,marginBottom:mb,
    x:{domain:[0,hi],label:'Withholding cost τ',ticks:state.zoom==='low'?[0,.005,.01,.015,.02]:[0,.1,.2,.3,.4,.5]},y:{domain:[0,ys],label:'Risk',ticks:5},
    alt:'Risk is a straight line in tau for every fixed report. The heavy lower envelope changes slope when the best report changes. A dashed envelope compares the other report family.',
    table:{caption:'Reports on the selected family’s lower envelope',columns:[{label:'From tau',value:'tauFrom',format:tauFormat},{label:'To tau',value:'tauTo',format:tauFormat},{label:'Grade vector',value:d=>Array.from(d.grade),format:formatGrades},{label:'Pairs stated',value:'N',format:formatCount}],rows:path.intervals},
    marks:(c,P)=>[P.line(vertexLines,{x:'tau',y:'risk',z:'k',stroke:c.plotMuted,strokeOpacity:.5,strokeWidth:1,clip:true}),P.line(contrast,{x:'tau',y:'risk',stroke:c.plotMuted,strokeDasharray:'5,4',strokeWidth:2.2}),P.line(active,{x:'tau',y:'risk',stroke:c.plotFg,strokeWidth:3}),...(state.tau<=hi?[P.ruleX([state.tau],{stroke:c.plotMuted,strokeDasharray:'3,4'}),P.dot([{tau:state.tau,risk:optimum.risk}],{x:'tau',y:'risk',stroke:c.plotFg,fill:c.plotBg,r:5})]:[])],
    keyboard:{data:vertices,x:d=>Math.min(hi,(d.tauFrom+d.tauTo)/2),y:d=>evaluateReport(d.grade,E,{tau:Math.max(CONFIG.tau.min,Math.min(hi,(d.tauFrom+d.tauTo)/2))}).risk,sort:false,key:d=>formatGrades(d.grade),title:d=>`${blocksText(d.grade,IDS)}: best from tau ${tauFormat(d.tauFrom)} to ${tauFormat(d.tauTo)}, ${d.N} pairs stated.`},
   });
   const background=lineData(state.cap,hi);
   layer=canvasLayer(chart,(c,{x,y,palette})=>{c.save();c.beginPath();c.rect(ml,mt,width-ml-mr,height-mt-mb);c.clip();c.globalAlpha=.055;c.strokeStyle=palette.plotMuted;c.lineWidth=.7;c.beginPath();for(const r of background){c.moveTo(x(CONFIG.tau.min),y(r.left));c.lineTo(x(hi),y(r.right));}c.stroke();c.restore();});
   legend.replaceChildren(h('span',{},h('i',{class:'prx-tp-swatch'}),`${familyWords(state.cap)}: minimum risk (selected)`),h('span',{},h('i',{class:'prx-tp-swatch prx-tp-dashed'}),`${familyWords(otherOf(state.cap))}: minimum risk (comparison)`),h('span',{},h('i',{class:'prx-tp-swatch prx-tp-faint'}),`individual reports in ${familyWords(state.cap)}`));
   // a tie at the smallest risk is named where the report is (review 044, X-12): "(one of 2 equal-risk best reports;
   // showing the first)"; the other family's report is already called its first best report
   ctx.readout.set(['At τ = ',ro('tau',state.tau,tauFormat),', ',h('span',{'data-prx-readout':'blocks'},blocksText(optimum.grade,IDS)),tieNode(ctx,optimum),' states ',ro('N',optimum.N),' of ',ro('M',M),' pairs, with risk ',ro('risk',optimum.risk,formatRisk),'. The other family’s first best report',tieNode(ctx,comparison,{showing:''}),' states ',ro('otherN',comparison.N),' of ',ctx.num(M,formatCount(M)),' pairs, with risk ',ro('otherRisk',comparison.risk,formatRisk),'.']);
   labels.replaceChildren(h('p',{'data-prx-comparison':'selected'},'Selected family: ',tagNode(ctx,optimum,{key:'selected'})),h('p',{'data-prx-comparison':'other'},'Comparison family: ',tagNode(ctx,comparison,{key:'comparison'}),'; first best report ',ro('otherGrade',Array.from(comparison.grade),formatGrades),'.'));
   ties.replaceChildren();
   const allNs=[];
   for(const [name,opt,key]of [['Selected family',optimum,'selected'],['Comparison family',comparison,'other']]){
    const grades=opt.grades??[opt.grade],evaluations=grades.map(g=>evaluateReport(g,E,{tau:state.tau}));allNs.push(...evaluations.map(e=>e.N));
    if(opt.tieCount<=1)continue;
    ties.append(h('p',{},`${name}: `,ro(key==='selected'?'tieCount':'otherTieCount',opt.tieCount),' reports share the smallest risk; the read-outs show the first. Equal-risk tolerance ',ro(`${key}-tieTolerance`,opt.tieTol,formatSci),'.'),h('ul',{},...grades.map((g,i)=>h('li',{},ro(`${key}-tie-grade-${i}`,Array.from(g),formatGrades),' · ',h('span',{},blocksText(g,IDS)),'; ',ro(`${key}-tie-N-${i}`,evaluations[i].N),' pairs stated.'))));
    if(opt.tieCount>grades.length)ties.append(h('p',{},'First ',ctx.num(grades.length,formatCount(grades.length)),' representatives listed; ',ctx.num(opt.tieCount-grades.length,formatCount(opt.tieCount-grades.length)),' more share this minimum.'));
   }
   const different=optimum.N!==comparison.N?labels:new Set(allNs).size>1?ties:null;
   if(different){
    const caption=captionNode(ctx,'different-disclosure');
    caption.textContent='These reports disclose different amounts';
    different.append(h('p',{},caption,'.'));
   }
   ties.hidden=ties.childNodes.length===0;
   const over=statedAbove(optimum.grade,E,{tau:state.tau});
   coherence.replaceChildren('Stated directions with error above the current τ: ',ro('above',over.count),'. The report is chosen jointly; its path is not an isolated-pair threshold rule.',state.tau>hi?' The selected τ is outside this zoom; switch to Overview to see its marker.':'');
   drawTauStrip(ctx,{slot:stripSlot,note:stripNote},state,path,{lo:state.zoom==='low'?0:.02,hi,axisFrom:0,width,marginLeft:ml,marginRight:mr});
   stripScope.replaceChildren(...(state.zoom==='low'?['This strip expands the path near zero. The left endpoint is a limit; the withholding cost is positive.']:['The overview bands start at τ ',ctx.num(.02,formatSetting(.02)),'. The two plots share a scale. Low-cost zoom and the complete table show the earliest bends.']));
   const table=h('table',{class:'prx-tp-table'},h('thead',{},h('tr',{},...['From τ','To τ','Best report','N','Expected wrong','Endpoint only'].map(text=>h('th',{scope:'col'},text)))));
   table.append(h('tbody',{},...path.intervals.map((iv,i)=>h('tr',{class:state.tau>=iv.tauFrom&&state.tau<=iv.tauTo?'prx-tp-current':null},h('td',{},ro(`from-${i}`,iv.tauFrom,tauFormat)),h('td',{},ro(`to-${i}`,iv.tauTo,tauFormat)),h('td',{},ro(`grade-${i}`,Array.from(iv.grade),formatGrades)),h('td',{},ro(`N-${i}`,iv.N)),h('td',{},ro(`E-${i}`,iv.Ew,formatExpectedCount)),h('td',{},iv.tauFrom===iv.tauTo?'yes':'no')))));tableSlot.replaceChildren(table);
   changes.replaceChildren(...changesFor(state.cap).map((iv,i)=>h('li',{},'At τ ',ro(`bend-${i}`,iv.tauFrom,tauFormat),': ',h('span',{},blocksText(iv.grade,IDS)),'. Newly stated: ',...iv.pairs.flatMap((p,k)=>[k?'; ':'',`${p.above} above ${p.below} (error `,ctx.num(p.error,formatProb(p.error,{digits:4})),')']),'. Both neighboring reports are optimal at the bend.')));
   const end=endpointExample.intervals.at(-1);
   endpoints.replaceChildren(ctx.panelTitle('A report can be best only at the endpoint'),h('p',{class:'prx-tp-note'},'For three independent normal targets with equal means, the path keeps ',h('span',{},blocksText(end.grade,['A','B','C'])),' at [',ro('endpoint-from',end.tauFrom,tauFormat),', ',ro('endpoint-to',end.tauTo,tauFormat),']. It is optimal only there, alongside ',ro('endpoint-ties',endpointExample.endpointTieCount),' tied reports in total. The all-withheld report is optimal below that endpoint.'));
  }};
 }});
}
