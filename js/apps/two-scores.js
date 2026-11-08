// Linked two-criterion report views. Scientific quantities are public engine outputs.
import { createWidget } from '../shared/base.js';
import { gradeColors, labelOn, numText, palette, plot } from '../shared/chart.js';
import { formatCount, formatDecimal, formatExpectedCount, formatGrades, formatProb, formatRisk, formatSci, formatSetting, formatShare } from '../shared/format.js';
import { tagNode } from '../shared/labels.js';
import { budgetCheck, compareReports, confidentPairs, evaluateReport, exactOptimum, relations, weightedError } from '../pr-core.js';
import { criteriaData } from '../shared/criteria-data.js';
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from '../shared/criteria-provenance.js';

export const TWO_SCORES_KEYS = Object.freeze({
 w:{type:'number',min:0,max:1,step:.01,value:.5},
 tau:{type:'number',min:.001,max:.5,step:.001,value:.2},
 cap:{type:'choice',values:['2','3','all'],value:'3'},
});
export const TWO_SCORES_CSS = `
.tws .tws-grid {display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:.7rem 1.3rem;align-items:start;min-width:0}
.tws .tws-grid>section {min-width:0}
.tws .tws-wide {grid-column:1/-1;min-width:0}
.tws .tws-chips {display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;margin:.15rem 0 .35rem}
.tws .tws-chip {display:inline-flex;align-items:center;gap:.4rem;padding:.2rem .6rem .2rem .3rem;border-radius:5px;font-size:1.1rem;font-weight:700;letter-spacing:.06em}
.tws .tws-g {display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:50%;font-size:.75rem;letter-spacing:0}
.tws .tws-gt {font-weight:700;color:var(--prx-fg-muted)}
.tws .prx-readout {background:var(--prx-plot-bg);color:var(--prx-plot-fg)}
.tws .tws-share-summary {display:block}
.tws .tws-facts,.tws .tws-note {font-size:.9rem;margin:.3rem 0 .55rem}
.tws .tws-scroll {overflow-x:auto;max-width:100%;min-width:0}
.tws .tws-table {width:100%;border-collapse:collapse;font-size:.86rem;min-width:43rem}
.tws .tws-table th,.tws .tws-table td {padding:.35rem .5rem;border-bottom:1px solid var(--prx-border-strong);text-align:left;white-space:nowrap}
.tws .tws-table caption {text-align:left;font-weight:600;padding:.3rem 0}
.tws .tws-report {padding:.4rem 0;border-bottom:1px solid var(--prx-border-strong)}
.tws .tws-legend {display:flex;flex-wrap:wrap;gap:.5rem 1rem;font-size:.85rem}
@media(max-width:40em){.tws .tws-grid{grid-template-columns:minmax(0,1fr)}}`;
const FIRST_VIEW_CSS = `
.tws-first-view .tws-phone-report{display:none}
@media(max-width:40em){.tws-first-view .tws-phone-report{display:flex;padding:.25rem .35rem}}
`;
const solveCache=new Map();
export const twoScoreFamily = cap => String(cap)==='all'||String(cap)==='none'?{kind:'all'}:{kind:'atMost',G:Number(cap)};
export const reportWords=(grade,ids=criteriaData('six').ids)=>Array.from({length:Math.max(...grade)},(_,h)=>`{${ids.filter((_,i)=>grade[i]===h+1).join(', ')}}`).join(' > ');
export const shareText=v=>v===null?'NA: no disclosure':v>0&&v<.001?'<.001':formatShare(v);
/** Actual common-report model used by both apps. cap is '2', '3', or 'all'. */
export function solveTwoScores(state={}) {
 const s={w:.5,tau:.2,cap:'3',...state},data=criteriaData('six'),w=[s.w,1-s.w],family=twoScoreFamily(s.cap);
 const key=JSON.stringify([s.w,s.tau,s.cap]); if(solveCache.has(key))return solveCache.get(key);
 const result=exactOptimum(data.E,{tau:s.tau,w,family});
 const profiles=result.grades.map(grade=>({grade,evaluation:evaluateReport(grade,data.E,{tau:s.tau,w})}));
 const weighted=weightedError(data.E,w),matrix=relations(result.grade),confident=confidentPairs(result.grade,data.E,{tau:s.tau,w});
 const pairs=[];for(let i=0;i<data.n;i++)for(let j=i+1;j<data.n;j++){
  const outlined=confident.pairs.some(p=>p.i===i&&p.j===j&&p.withheld);
  pairs.push({i,j,label:`${data.ids[i]}–${data.ids[j]}`,forward:weighted[i][j],reverse:weighted[j][i],relation:matrix[i][j],outlined});
 }
 const boundE={ids:data.E.ids,criteria:['weighted'],e:[weighted]};
 const bounds=profiles.map(p=>({budget:budgetCheck(p.grade,boundE,[s.tau]).rows[0],comparison:compareReports(Array(data.n).fill(1),p.grade,data.E,{tau:s.tau,w})}));
 const uncapped=s.cap==='all'?result:exactOptimum(data.E,{tau:s.tau,w,family:{kind:'all'}});
 const model={data,state:s,w,family,result,profiles,weighted,matrix,pairs,uncapped,bounds,conditionalBound:result.containsAllWithheld&&bounds.every(b=>b.comparison.deltaRisk<=result.tieTol)};
 solveCache.set(key,model);if(solveCache.size>150)solveCache.delete(solveCache.keys().next().value);return model;
}
export function createTwoScoreControls(ctx,{primary=false}={}){
 const w=ctx.slider({label:'Weight w on score A (score B gets 1 − w)',...ctx.key('w'),onInput:w=>ctx.set({w})});
 const tau=ctx.slider({label:'Cost τ per withheld pair',...ctx.key('tau'),onInput:tau=>ctx.set({tau})});
 const cap=ctx.segmented({label:'Allowed grades',options:[{value:'2',label:'At most two'},{value:'3',label:'At most three'},{value:'all',label:'No cap'}],value:'3',onChange:cap=>ctx.set({cap})});
 if(primary)ctx.primaryControl(w.root);
 ctx.controls.append(w.root,tau.root,cap.root);return {render:s=>{w.set(s.w);tau.set(s.tau);cap.set(s.cap)}};
}
function dodge(values,gap){const order=values.map((_,i)=>i).sort((a,b)=>values[a]-values[b]),out=values.slice();for(let k=1;k<order.length;k++)out[order[k]]=Math.max(values[order[k]],out[order[k-1]]+gap);const shift=order.reduce((s,i)=>s+out[i]-values[i],0)/order.length;return out.map(v=>v-shift)}
function number(ctx,value,fmt= formatCount,hook){const n=ctx.num(value,fmt(value));if(hook)n.dataset.prxReadout=hook;return n}
export function drawTwoScoreReport(ctx,slot,grade,ids=criteriaData('six').ids){
 slot.classList.add('prx-light-panel');
 const pal=palette(ctx.root),colors=gradeColors(Math.max(...grade),pal),parts=[];
 colors.forEach((color,k)=>{const units=ids.filter((_,i)=>grade[i]===k+1);if(k)parts.push(ctx.h('span',{class:'tws-gt','aria-hidden':'true',text:'>'}));const ink=labelOn(color,pal);parts.push(ctx.h('span',{class:'tws-chip',style:{background:color,color:ink}},ctx.h('span',{class:'tws-g',style:{background:ink,color}},number(ctx,k+1)),units.join(' ')))});
 slot.replaceChildren(...parts);slot.setAttribute('role','img');slot.setAttribute('aria-label',`Best report: ${reportWords(grade,ids)}; grade 1 first`);
}
/** Create explicit linked slots. No widget is mounted as a side effect. */
export function createTwoScoresSlots(ctx,parent=ctx.charts){
 const h=ctx.h,slots={};const panel=(key,title,wide=false)=>{const slot=h('div');slots[key]=slot;return h('section',{class:`prx-panel ${wide?'tws-wide':''}`,'aria-label':title},ctx.panelTitle(title),slot)};
 const grid=h('div',{class:'tws-grid'},panel('slope','Six sites on two scores (posterior means)'),panel('report','Best report for both scores'),panel('relation','Relations in the first best report'),panel('pairs','Weighted pair errors against the withholding cost'),panel('profile','Every best report: criterion profile',true),panel('bound','What the mean bound says',true));
 parent.append(grid);return slots;
}
/** Actual renderer shared with 4.4: slope, all reports, relation matrix, pair map, profiles and bound. */
export function createTwoScoresView(ctx,slots,{readout='classic'}={}){
 const h=ctx.h;slots.report.classList.add('prx-light-panel');
 return {render(model,state=model.state){
  const {data,result,profiles}=model,grade=result.grade,pal=palette(ctx.root),colors=gradeColors(Math.max(...grade),pal);
  const rows=data.ids.map((id,i)=>({i,id,a:data.means[i][0],b:data.means[i][1],grade:grade[i],fill:colors[grade[i]-1]}));
  const ends=rows.flatMap(d=>[{...d,x:0,y:d.a},{...d,x:1,y:d.b}]),unit=(318-42-10)/2.2,ya=dodge(rows.map(d=>d.a),19/unit),yb=dodge(rows.map(d=>d.b),19/unit);
  const tags=rows.flatMap((d,i)=>[{...d,x:0,y:ya[i],side:-1},{...d,x:1,y:yb[i],side:1}]),heads=[{x:0,title:'score A',weight:state.w},{x:1,title:'score B',weight:1-state.w}];
  const isFirst=readout==='result-first',margin=isFirst?58:40;
  plot(slots.slope,{alt:'Each site joins its posterior mean on score A to its mean on score B, colored by grade in the first best report.',height:318,marginTop:42,marginBottom:10,marginLeft:margin,marginRight:margin,x:{domain:[0,1],axis:null},y:{domain:[-.9,1.3],axis:null},
   table:{caption:'Posterior means and first best report',rows,columns:[{label:'Site',value:'id'},{label:'Score A mean',value:'a',format:v=>formatDecimal(v)},{label:'Score B mean',value:'b',format:v=>formatDecimal(v)},{label:'Grade',value:'grade',format:v=>formatCount(v)}]},
   marks:(c,P)=>[P.ruleX([0,1],{stroke:c.plotGrid,strokeWidth:1.5}),P.link(rows,{x1:()=>0,y1:'a',x2:()=>1,y2:'b',stroke:'fill',strokeWidth:3,strokeOpacity:.9}),P.dot(ends,{x:'x',y:'y',r:6.5,fill:'fill',stroke:c.plotBg}),P.text(tags.filter(d=>d.side<0),{x:'x',y:'y',text:'id',dx:-11,textAnchor:'end',fill:'fill',fontWeight:700,fontSize:15}),P.text(tags.filter(d=>d.side>0),{x:'x',y:'y',text:'id',dx:11,textAnchor:'start',fill:'fill',fontWeight:700,fontSize:15}),P.text(heads,{x:'x',y:()=>1.3,text:'title',dy:-27,fontWeight:700,fontSize:14,fill:d=>c.critInk[d.x]}),P.text(heads,{x:'x',y:()=>1.3,text:()=> 'weight',dx:-16,dy:-11,fontSize:12.5,fill:c.plotMuted}),numText(heads,{x:'x',y:()=>1.3,value:'weight',format:v=>formatSetting(v),dx:22,dy:-11,fontSize:12.5,fill:c.plotMuted}),
     ...(isFirst?[-1,1].map(side=>numText(tags.filter(d=>d.side===side),{x:'x',y:'y',value:'grade',format:formatCount,dx:side*31,fill:c.plotFg,fontWeight:600})):[])],
   keyboard:{data:rows,x:()=>0,y:'a',title:d=>`Site ${d.id}: posterior mean ${formatDecimal(d.a)} on score A and ${formatDecimal(d.b)} on score B; grade ${formatCount(d.grade)} of the best report.`}});
  const packageIndex=sixSitePackageRepresentativeIndex(state,profiles.map(p=>p.grade));
  const reportNodes=[];profiles.forEach((p,i)=>{const chips=h('div',{class:'tws-chips'});drawTwoScoreReport(ctx,chips,p.grade,data.ids);reportNodes.push(h('div',{class:'tws-report'},h('p',{},i?'Another best report':'Grade one is highest priority; a shared grade withholds its comparisons.'),chips,h('p',{class:'tws-facts'},number(ctx,p.evaluation.N,formatCount,`N-${i}`),' of ',number(ctx,data.M),' pairs stated; risk ',number(ctx,p.evaluation.risk,formatRisk,`risk-${i}`)),h('p',{class:'tws-facts'},'Grade vector ',number(ctx,p.grade,formatGrades,`grade-${i}`)),i===packageIndex?h('p',{class:'tws-note','data-prx-package-representative':''},'The recorded postrank ',...SIX_SITE_PACKAGE_VERSION.flatMap((v,j)=>[j?'.':'',number(ctx,v)]),' representative at this score-B-only setting is ',number(ctx,p.grade,formatGrades,'package-grade'),'. Its live expected wrong share on score A is ',number(ctx,p.evaluation.EoverN[0],shareText,'package-share-A'),'. All tied reports remain available.') : null))});
  const tie=h('p',{class:'tws-note','data-prx-ties':''},result.tieCount>1?[number(ctx,result.tieCount),' reports share the smallest risk, tied with another report; equal-risk tolerance ',number(ctx,result.tieTol,formatSci),'. All retained reports appear below.']:['One report has the smallest risk; equal-risk tolerance ',number(ctx,result.tieTol,formatSci),'.']);
  if(result.tieCount>profiles.length)tie.append(' Retained ',number(ctx,profiles.length),' of ',number(ctx,result.tieCount),' reports.');
  slots.report.replaceChildren(h('p',{},tagNode(ctx,result)),tie,...reportNodes,...(readout==='classic'?[ctx.readout.node]:[]));
  slots.relation.replaceChildren();
  const cells=[];for(let i=0;i<data.n;i++)for(let j=0;j<data.n;j++)cells.push({i,j,row:data.ids[i],column:data.ids[j],relation:model.matrix[i][j],text:i===j?'—':model.matrix[i][j]===1?'above':model.matrix[i][j]===-1?'below':'withheld'});
  plot(slots.relation,{alt:'Row site is above, below, or in the same grade as the column site. Diagonal is not a comparison.',height:290,marginLeft:35,marginBottom:35,x:{domain:data.ids,label:'column site'},y:{domain:data.ids,label:'row site'},color:{type:'identity'},
   table:{caption:'First best report pair relations',rows:cells,columns:[{label:'Row',value:'row'},{label:'Column',value:'column'},{label:'Relation',value:'text'}]},marks:(c,P)=>[P.cell(cells,{x:'column',y:'row',fill:d=>d.i===d.j?c.plotBg:d.relation===1?c.relAbove:d.relation===-1?c.relBelow:c.relWithheld,inset:1}),P.text(cells,{x:'column',y:'row',text:d=>d.i===d.j?'—':d.relation===1?'↑':d.relation===-1?'↓':'·',fill:c.plotFg})],keyboard:{data:cells,columns:data.n,x:'column',y:'row',title:d=>`${d.row} against ${d.column}: ${d.text}`}});
  const legend=h('p',{class:'tws-legend prx-light-panel'});[['relAbove','Row above column'],['relWithheld','Withheld'],['relBelow','Row below column']].forEach(([key,text])=>legend.append(h('span',{},h('i',{class:'prx-swatch',style:{background:pal[key]}}),text)));slots.relation.append(legend);
  slots.pairs.replaceChildren();
  const directions=model.pairs.flatMap(d=>[{...d,direction:`${data.ids[d.i]} above ${data.ids[d.j]}`,error:d.forward,side:'forward'},{...d,direction:`${data.ids[d.j]} above ${data.ids[d.i]}`,error:d.reverse,side:'reverse'}]);
  plot(slots.pairs,{alt:'Both directional weighted errors for each pair. The dashed vertical line is the withholding cost. Rings mark cheaper isolated directions withheld in the first report.',height:410,marginLeft:48,marginRight:15,x:{domain:[0,1],label:'weighted directional error →'},y:{domain:model.pairs.map(d=>d.label),label:null},
   table:{caption:'Both weighted pair errors',rows:directions,columns:[{label:'Direction',value:'direction'},{label:'Weighted error',value:'error',format:v=>formatProb(v)},{label:'Withheld although cheaper',value:d=>d.outlined&&d.error<state.tau?'yes':'no'}]},
   marks:(c,P)=>[P.ruleX([state.tau],{stroke:c.wh,strokeDasharray:'5,3'}),P.link(model.pairs,{x1:'forward',x2:'reverse',y1:'label',y2:'label',stroke:c.plotGrid}),P.dot(directions,{x:'error',y:'label',fill:d=>c.purples[d.side==='forward'?5:2],r:4}),P.dot(directions.filter(d=>d.outlined&&d.error<state.tau),{x:'error',y:'label',fill:'none',stroke:c.plotFg,r:7,strokeWidth:2}),P.tip(directions,P.pointer({x:'error',y:'label',title:d=>`${d.direction}: ${formatProb(d.error)}`}))],
   keyboard:{data:directions,x:'error',y:'label',title:d=>`${d.direction}: weighted error ${formatProb(d.error)}; cost of withholding ${formatSetting(state.tau)}; ${d.relation===0?'withheld':'stated'}${d.outlined&&d.error<state.tau?', cheaper isolated direction outlined':''}`}});
  slots.pairs.append(h('p',{class:'tws-note'},'Dark purple: earlier letter above later letter. Pale purple: reverse direction. Rings mark withheld directions cheaper than τ; the isolated-pair rule need not form a coherent report.'));
  const profileRows=profiles.flatMap((p,i)=>data.criterionLabels.map((criterion,k)=>({i,grade:p.grade,criterion,k,...p.evaluation})));
  const table=h('table',{class:'tws-table'},h('caption',{},'E = expected wrong directions; N = stated pairs; M = all unordered pairs.'),h('thead',{},h('tr',{},...['Report','Criterion','E','E/N','E/M','Criterion risk','N','M'].map(t=>h('th',{scope:'col',text:t})))),h('tbody',{},...profileRows.map(p=>h('tr',{},h('td',{},number(ctx,p.grade,formatGrades)),h('th',{scope:'row',text:p.criterion}),h('td',{},number(ctx,p.E[p.k],formatExpectedCount,`E-${p.i}-${p.k}`)),h('td',{},number(ctx,p.EoverN[p.k],shareText,`share-${p.i}-${p.k}`)),h('td',{},number(ctx,p.EoverM[p.k],formatShare,`perpair-${p.i}-${p.k}`)),h('td',{},number(ctx,p.Rk[p.k],formatRisk,`Rk-${p.i}-${p.k}`)),h('td',{},number(ctx,p.N)),h('td',{},number(ctx,p.M))))));
  slots.profile.replaceChildren(h('p',{class:'tws-note'},'Swipe or use the keyboard to scroll the profile table.'),ctx.scrollRegion(h('div',{class:'tws-scroll'},table),'Criterion profiles for every retained best report'));
  const shareLine=(p,i)=>[number(ctx,p.evaluation.EoverN[0],shareText,`live-share-${i}-0`),' on score A and ',number(ctx,p.evaluation.EoverN[1],shareText,`live-share-${i}-1`),' on score B.'];
  if(isFirst){
   ctx.readout.set(profiles.map((p,i)=>h('span',{class:'tws-share-summary'},i?'Tied report ':'Best common report ',reportWords(p.grade,data.ids),
     h('span',{class:'prx-sr-only','aria-hidden':'true'},number(ctx,p.grade,formatGrades,`live-grade-${i}`)),': ',
     ...(i?[]:[number(ctx,p.evaluation.N),' of ',number(ctx,data.M),' pairs stated, weighted risk ',number(ctx,p.evaluation.risk,formatRisk),'; expected wrong share ']),...shareLine(p,i))));
  }else{
   const content=['Expected wrong shares among each report’s stated directions: ',...profiles.map((p,i)=>h('span',{class:'tws-share-summary'},'Report ',number(ctx,p.grade,formatGrades,`live-grade-${i}`),': ',...shareLine(p,i)))];
   if(readout==='detail')slots.report.append(h('p',{'data-prx-part':'readout'},content));else ctx.readout.set(content);
  }
  const boundRows=profiles.map((p,i)=>h('p',{},'Report ',number(ctx,p.grade,formatGrades),': weighted expected wrong count ',number(ctx,p.evaluation.Ew,formatExpectedCount,`Ew-${i}`),model.conditionalBound?' ≤ τ × N = ':' versus τ × N = ',number(ctx,state.tau,formatSetting),' × ',number(ctx,p.evaluation.N),' = ',number(ctx,model.bounds[i].budget.qN,formatExpectedCount,`tauN-${i}`),'; count slack ',number(ctx,model.bounds[i].budget.slack,formatExpectedCount,`bound-slack-${i}`),'; risk minus τ ',number(ctx,model.bounds[i].comparison.deltaRisk,formatRisk,`bound-residual-${i}`),'.'));
  const same=model.uncapped.grades.some(g=>g.every((v,i)=>v===grade[i]));
  slots.bound.replaceChildren(h('p',{class:'tws-note'},'The weighted expected wrong count is w × E on score A plus the remaining weight × E on score B.'),...boundRows,h('p',{class:'tws-note'},'This mean bound applies to the exact best report at the displayed τ because its family contains all-withheld. It bounds an expected average over stated pairs, not each pair or the realized share.'),h('p',{class:'tws-note'},same?'Removing the cap leaves this report among the best reports.':'Removing the cap selects a different report; the cap can matter at this setting.'));
  if(state.w===.5&&state.tau===.2&&same)slots.bound.append(h('p',{class:'tws-note'},'A–C and B–C stay in one grade, so transitivity also withholds A–B. A–D is withheld too, although its weighted error is below τ. The uncapped comparison shows that the cap does not explain this equal-weight report.'));
  ctx.caption.replaceChildren('Six fictional sites; independent Normal posteriors set by hand for teaching; postrank does not fit them. τ = ',number(ctx,state.tau,formatSetting),'; ',tagNode(ctx,result),'. Withholding is charged once per pair.');
 }};
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'two-scores',className:'tws tws-first-view',layout:'result-first',css:TWO_SCORES_CSS+FIRST_VIEW_CSS,keys:TWO_SCORES_KEYS,build(ctx){
 const controls=createTwoScoreControls(ctx,{primary:true}),slots=createTwoScoresSlots(ctx);
 const phoneReport=ctx.h('div',{class:'tws-chips tws-phone-report','aria-hidden':'true'});
 ctx.charts.prepend(phoneReport);
 ctx.primaryGraphic(slots.slope);
 const view=createTwoScoresView(ctx,slots,{readout:'result-first'});
 return {render(state){
  controls.render(state);
  const model=solveTwoScores(state);
  drawTwoScoreReport(ctx,phoneReport,model.result.grade,model.data.ids);
  view.render(model,state);
 }};
}})}
