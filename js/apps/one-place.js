import{createWidget}from'../shared/base.js';
import{numText,palette,plot}from'../shared/chart.js';
import{formatCount,formatDecimal,formatGrades,formatTuple,formatSig,formatProb,formatRisk,formatSci,formatSetting,formatShare}from'../shared/format.js';
import{captionNode,familyNameNode,familySizeNode,labelNode}from'../shared/labels.js';
import{leagueModel}from'./fixed-tiers.js';
import{createRuleCardRenderer,CSS as CARD_CSS}from'./posterior-tiers.js';
import{LEAGUE_SEED,allocationValue,disclosure,evaluateReport,exactOptimum,finiteLawPairwise,fixedOrderDP,pairDirection,rankSummaries,rankSummariesMC,strictOrder,thresholdClassification}from'../pr-core.js';
const CSS=`${CARD_CSS}
.prx-op .op-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr));gap:.75rem;min-width:0}
.prx-op .op-box{border:1px solid var(--prx-border);padding:.55rem .65rem;border-radius:6px;min-width:0}
.prx-op [data-prx-readout="grade"],.prx-op [data-prx-readout="inclusion"]{white-space:normal;overflow-wrap:anywhere}
.prx-op .op-note{font-size:.9em;color:var(--prx-fg-muted);margin:.35rem 0}
.prx-op .op-box h4{font-size:1em;margin:.2rem 0 .5rem}
.prx-op .op-scroll{overflow:auto;max-width:100%}
.prx-op .op-table{border-collapse:collapse;width:100%;min-width:32rem}
.prx-op .op-table th,.prx-op .op-table td{text-align:right;padding:.3rem .4rem;border-bottom:1px solid var(--prx-border)}
.prx-op .op-table th:first-child{text-align:left;min-width:8rem}
.prx-op .op-table th{min-width:6rem;word-break:normal;overflow-wrap:normal}
.prx-op .op-table td{white-space:nowrap}
.prx-op .op-native-comparison{grid-column:1/-1}
@media(max-width:600px){
 .prx-op .op-native-controls{grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem .7rem}
 .prx-op .op-native-controls .prx-slider{min-width:0}
 .prx-op .op-table{table-layout:fixed}
 .prx-op .op-table thead th:first-child{width:8.25rem}
 .prx-op .op-table thead th:nth-child(2){width:7rem}
 .prx-op .op-table th,.prx-op .op-table td{min-width:0;overflow-wrap:anywhere}
 .prx-op .op-table tbody th .prx-num{white-space:normal}
}
`;
const LAWS={tb17:{ids:['A','B'],states:[[20,4],[0,4]],probs:[.3,.7]},tb19:{ids:['A','B','C'],states:[[20,4,3],[0,4,3]],probs:[.3,.7]}};
const populations=new Map(),caches=new Map();
function population(s){
 const key=s.law==='league'?[s.law,s.priorSd,s.S,s.seed].join(':'):s.law;
 if(populations.has(key))return populations.get(key);
 let model;
 if(s.law==='league'){
  const league=leagueModel(LEAGUE_SEED,s.priorSd),means=league.post.mean;
  model={ids:league.ids,n:league.ids.length,means,sd:league.post.sd,E:league.E,raw:league.estimate,ranks:rankSummariesMC(means,league.post.sd,s.S,s.seed)};
 }else{
  const law=LAWS[s.law],ranks=rankSummaries(law);
  if(!ranks.tieFree)throw new Error('Exact-budget membership requires a declared latent-tie convention');
  model={ids:law.ids,n:law.ids.length,means:ranks.means,E:finiteLawPairwise(law.states,law.probs,{ids:law.ids}),ranks,law};
 }
 populations.set(key,model);if(populations.size>16)populations.delete(populations.keys().next().value);return model;
}
export function nativeModel(s){
 const key=[s.law,s.budget,s.threshold,s.tau,s.priorSd,s.S,s.seed].join(':');
 if(caches.has(key))return caches.get(key);
 const p=population(s),{ids,n,means,E}=p;
 const pTop=s.budget===0?means.map(()=>0):s.budget===n?means.map(()=>1):p.ranks.pTop[s.budget-1];
 const pAbove=s.law==='league'?means.map((mu,i)=>pairDirection(mu,p.sd[i],s.threshold,0)):(()=>{const t=finiteLawPairwise(p.law.states.map(state=>[...state,s.threshold]),p.law.probs);return means.map((_,i)=>t.pi[0][i][n]);})();
 const opt=s.law==='league'?fixedOrderDP(E,{scores:means,direction:'descending',G:3,tau:s.tau}):exactOptimum(E,{tau:s.tau,family:{kind:'all'}});
 const grades={mean:Array.from(strictOrder(means)),top:Array.from(strictOrder(pTop)),optimal:Array.from(opt.grade),withheld:ids.map(()=>1)};
 if(p.raw)grades.raw=Array.from(strictOrder(p.raw));
 const reports=Object.fromEntries(Object.entries(grades).map(([key,grade])=>[key,{key,grade,ev:evaluateReport(grade,E,{tau:s.tau}),d:disclosure(grade),allocation:allocationValue(grade,{values:means,pTop,budget:s.budget})}]));
 const tied=(opt.grades??[opt.grade]).map(grade=>({grade:Array.from(grade),ev:evaluateReport(grade,E,{tau:s.tau}),allocation:allocationValue(grade,{values:means,pTop,budget:s.budget})}));
 const result={ids,n,means,pTop,pAbove,E,opt,reports,tied};caches.set(key,result);if(caches.size>64)caches.delete(caches.keys().next().value);return result;
}
const names={mean:'Posterior-mean order',top:'Top-set probability order',optimal:'Reporting objective',withheld:'Withhold every pair',raw:'Raw-estimate order'};
const shortNames={mean:'Posterior mean',top:'Top-set order',optimal:'Reporting objective',withheld:'All withheld',raw:'Raw estimates',bayes:'Native Bayes'};
const labelMargin=133;

function labelCandidateMarks(chart,rows,xOf,yOf,colors){
 const {svg}=chart,groups=new Map();
 const xScale=chart.scale('x'),yScale=chart.scale('y');
 for(const row of rows){
  const x=xOf(row),y=yOf(row),key=JSON.stringify([x,y]);
  if(!groups.has(key))groups.set(key,{x:xScale.apply(x),y:yScale.apply(y),names:[]});
  groups.get(key).names.push(shortNames[row.key]);
 }
 const make=(tag,attrs)=>{
  const node=svg.ownerDocument.createElementNS(svg.namespaceURI,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
 };
 const labels=[...groups.values()].sort((a,b)=>a.y-b.y);
 for(const label of labels)label.lines=label.names.join(' = ').match(/.{1,21}(?: |$)/g).map(line=>line.trim());
 const right=Number(svg.getAttribute('width'))-labelMargin;
 const bottom=Number(svg.getAttribute('height'))-50;
 const step=13,top=24;
 const occupied=labels.reduce((total,label)=>total+label.lines.length*step,0);
 const gap=Math.min(16,Math.max(4,(bottom-top-occupied)/Math.max(1,labels.length-1)));
 let y=top+(bottom-top-occupied-gap*(labels.length-1))/2;
 const layer=make('g',{'aria-hidden':'true','pointer-events':'none'});
 for(const label of labels){
  const center=y+step*(label.lines.length-1)/2-3;
  layer.append(make('path',{d:`M${label.x+5},${label.y}L${right+7},${center}`,stroke:colors.plotMuted,'stroke-width':.85,opacity:.8,fill:'none'}));
  const text=make('text',{'data-candidate-label':label.names.join(' = '),'font-size':11,fill:colors.plotFg});
  label.lines.forEach((line,i)=>{
   const span=make('tspan',{x:right+11,y:y+i*step});
   span.textContent=line;text.append(span);
  });
  layer.append(text);
  y+=label.lines.length*step+gap;
 }
 svg.append(layer);
}
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'one-place',className:'prx-op prx-pt',css:CSS,layout:'result-first',title:'Which objective chooses the action?',label:'A grade report compared with native allocation and threshold decisions',
 keys:{law:{type:'choice',values:['tb19','tb17','league'],value:'tb19'},mode:{type:'choice',values:['places','threshold'],value:'places'},tau:{type:'number',min:.02,max:.5,step:.01,value:.25},budget:{type:'integer',min:0,max:30,value:1},report:{type:'choice',values:['optimal','mean','top','withheld','raw'],value:'optimal'},threshold:{type:'number',min:-.5,max:20,step:.01,value:3.5},falsePositiveCost:{type:'number',min:0,max:5,step:.25,value:1},falseNegativeCost:{type:'number',min:0,max:5,step:.25,value:1},positiveGrade:{type:'integer',min:0,max:30,value:1},priorSd:{type:'number',min:.05,max:.5,step:.01,value:.15},S:{type:'integer',min:100,max:4000,step:100,value:2000},seed:{type:'integer',min:1,max:4294967295,value:1}},
 build(ctx){const{h}=ctx,ro=(name,v,f=formatDecimal)=>{const node=ctx.num(v,f(v));node.dataset.prxReadout=name;return node;};
 const law=ctx.radioGroup({legend:'Supplied conditional law',name:'law',options:[{value:'tb19',label:'Three-unit two-state law'},{value:'tb17',label:'Two-unit two-state law'},{value:'league',label:'Simulated league: normal posterior'}],value:ctx.state.law,onChange:v=>ctx.set({law:v})});
 const mode=ctx.radioGroup({legend:'Native decision',name:'mode',options:[{value:'places',label:'Fill a fixed number of places'},{value:'threshold',label:'Classify above a threshold'}],value:ctx.state.mode,onChange:v=>ctx.set({mode:v})});
 const tau=ctx.slider({label:'Reporting withholding cost τ',name:'tau',min:.02,max:.5,step:.01,value:ctx.state.tau,onInput:v=>ctx.set({tau:v}),hint:'Changes reporting loss and the chosen report; it is not the allocation budget or the classification cost ratio.'});
 const budget=ctx.slider({label:'Top-set budget b',name:'budget',min:0,max:30,step:1,value:ctx.state.budget,onInput:v=>ctx.set({budget:v}),hint:'Places mode fills b. Classification has no capacity limit; b only defines the top-set comparison order.'});
 const report=ctx.radioGroup({legend:'Report to inspect',name:'report',options:Object.entries(names).map(([value,label])=>({value,label})),value:ctx.state.report,onChange:v=>ctx.set({report:v})});
 const threshold=ctx.slider({label:'Substantive target threshold',name:'threshold',min:-.5,max:20,step:.01,value:ctx.state.threshold,onInput:v=>ctx.set({threshold:v})});
 const fp=ctx.slider({label:'False-positive cost',name:'falsePositiveCost',min:0,max:5,step:.25,value:ctx.state.falsePositiveCost,onInput:v=>ctx.set({falsePositiveCost:v})}),fn=ctx.slider({label:'False-negative cost',name:'falseNegativeCost',min:0,max:5,step:.25,value:ctx.state.falseNegativeCost,onInput:v=>ctx.set({falseNegativeCost:v})});
 const positiveGrade=ctx.slider({label:'Added grade-to-class rule: positive through grade h',name:'positiveGrade',min:0,max:30,step:1,value:ctx.state.positiveGrade,onInput:v=>ctx.set({positiveGrade:v}),hint:'Zero declares nobody positive; h at or above the last grade declares everybody positive.'});
 const prior=ctx.slider({label:'Stipulated normal prior SD',name:'priorSd',min:.05,max:.5,step:.01,value:ctx.state.priorSd,onInput:v=>ctx.set({priorSd:v})});
 const S=ctx.slider({label:'Posterior draws for top-set membership, S',name:'S',min:100,max:4000,step:100,value:ctx.state.S,onInput:v=>ctx.set({S:v})}),seed=ctx.numberInput({label:'Posterior integration seed',name:'seed',min:1,max:4294967295,step:1,value:ctx.state.seed,onInput:v=>ctx.set({seed:v})});
 const nativeControls=h('div',{class:'op-grid op-native-controls'},threshold.root,fp.root,fn.root,positiveGrade.root),normalControls=h('div',{class:'op-grid'},prior.root,S.root,seed.root);
 ctx.controls.append(law.root,tau.root,budget.root,report.root);
 ctx.afterPresets(mode.root,nativeControls,normalControls);ctx.primaryControl(mode.root);
 const statement=h('p',{class:'op-note'}),cards=h('div',{class:'op-grid'}),figures=h('div',{class:'op-grid'}),nativePlot=h('div',{class:'op-native-comparison'}),valuePlot=h('div'),overlapPlot=h('div'),classPlot=h('div'),unitsPlot=h('div',{class:'op-native-units'}),summary=ctx.scrollRegion(h('div',{class:'op-scroll'}),'Compare every reporting rule on its reporting and native objectives'),ties=ctx.scrollRegion(h('div',{class:'op-scroll'}),'Equal-risk reporting alternatives under the same added action rule');
 ctx.primaryGraphic(nativePlot);figures.append(h('div',{class:'op-native-comparison'},nativePlot,ties),valuePlot,overlapPlot,classPlot);ctx.charts.append(figures,statement,h('p',{class:'op-note',text:'Diamond: reporting objective. Ring: inspected report. Star in classification mode: native Bayes action. Larger value and overlap are preferred; smaller classification cost is preferred. Use arrows to read a point, or choose a report above.'}),cards,h('p',{class:'op-note',text:'Tables retain every column. On narrow screens, swipe sideways, or focus a table region and use the arrow keys.'}),unitsPlot,summary);
 const renderer=createRuleCardRenderer(ctx);
 function render(s){const n=s.law==='tb17'?2:s.law==='tb19'?3:30;
  budget.input.max=String(n);positiveGrade.input.max=String(n);
  if(s.budget>n||s.positiveGrade>n){ctx.set({budget:Math.min(s.budget,n),positiveGrade:Math.min(s.positiveGrade,n)});return;}
  if(s.law!=='league'&&s.report==='raw'){ctx.set({report:'optimal'});return;}
  law.set(s.law);mode.set(s.mode);tau.set(s.tau);budget.set(s.budget);report.set(s.report);threshold.set(s.threshold);fp.set(s.falsePositiveCost);fn.set(s.falseNegativeCost);positiveGrade.set(s.positiveGrade);prior.set(s.priorSd);S.set(s.S);seed.set(s.seed);
  budget.root.hidden=false;nativeControls.hidden=s.mode!=='threshold';normalControls.hidden=s.law!=='league';report.inputs[Object.keys(names).indexOf('raw')].disabled=s.law!=='league';
  if(s.mode==='threshold'&&s.falsePositiveCost+s.falseNegativeCost===0){statement.textContent='At least one classification cost must be positive.';cards.replaceChildren();for(const slot of [nativePlot,valuePlot,overlapPlot,classPlot,ties,unitsPlot,summary])slot.replaceChildren();ctx.readout.set('Both classification costs are zero; choose a positive cost before evaluating.');return;}
  const m=nativeModel(s),selected=m.reports[s.report],classificationOptions={falsePositiveCost:s.falsePositiveCost,falseNegativeCost:s.falseNegativeCost,values:m.means},bayes=s.falsePositiveCost+s.falseNegativeCost>0?thresholdClassification(m.pAbove,classificationOptions):null;
  const rows=Object.values(m.reports).map(r=>({...r,name:names[r.key],classification:bayes?thresholdClassification(m.pAbove,{...classificationOptions,positive:r.grade.map(g=>g<=s.positiveGrade)}):null}));
  const chosen=rows.find(r=>r.key===s.report),pal=palette(ctx.root),dec=v=>formatDecimal(v,{digits:3});
  statement.replaceChildren(...(s.law==='league'?['Frozen league measurement seed ',ctx.num(LEAGUE_SEED,formatCount(LEAGUE_SEED)),'. Independent normal posteriors with a stipulated prior; top-set probabilities use ',ctx.num(s.S,formatCount(s.S)),' draws and integration seed ',ctx.num(s.seed,formatCount(s.seed)),'.']:['State A high: ',ctx.num(.3,formatProb(.3)),' at A=',ctx.num(20,formatCount(20)),'; state A low: ',ctx.num(.7,formatProb(.7)),' at A=',ctx.num(0,formatCount(0)),'. B stays at ',ctx.num(4,formatCount(4)),...(s.law==='tb19'?[' and C at ',ctx.num(3,formatCount(3))]:[]),'. Larger target values have higher priority.']));
  const reportCard=h('section',{class:'op-box prx-light-panel'},h('h4',{},names[s.report]),renderer.chips(m,selected.grade,pal),h('p',{class:'op-note',text:'Grade 1 = stated highest on the target, as the posterior judges it.'}),h('p',{},'Report ',ro('grade',selected.grade,formatGrades),'. N ',ro('N',selected.ev.N,formatCount),' of ',ro('M',selected.ev.M,formatCount),'; E/N ',ro('EoverN',selected.ev.EoverN[0],formatShare),'; risk ',ro('risk',selected.ev.risk,formatRisk),'.'),h('p',{class:'op-note'},s.report==='optimal'?[labelNode(ctx,m.opt),...(m.opt.label==='optimal-within-order'?[' in ',familyNameNode(ctx,m.opt)]:[]),' (',familySizeNode(ctx,m.opt),' reports/cuts). ']:captionNode(ctx,'fixed-report')));
  const native=h('section',{class:'op-box'});
  if(s.mode==='places')native.append(h('h4',{text:'Allocation added to this report'}),h('p',{},'Fill exactly ',ro('budget',s.budget,formatCount),s.budget===1?' place. Expected selected value ':' places. Expected selected value ',ro('value',selected.allocation.expectedValue,dec),'; expected top-set overlap ',ro('overlap',selected.allocation.expectedOverlap,dec),'; overlap share ',ro('overlapShare',selected.allocation.overlapShare,v=>formatSig(v,{sig:3})),...(s.budget===0?[' (no places allocated)']:[]),'.'),h('p',{class:'op-note'},'Include higher grades first. If the boundary grade does not fit, choose a uniform subset of exactly the remaining size, independently of the true state. Expected inclusion is ',ro('inclusion',selected.allocation.inclusion,v=>formatTuple(v,dec)),'.'));
  else native.append(h('h4',{text:'Binary classification is an added action'}),h('p',{},'Native Bayes classifier: ',ro('bayes-positive',bayes.positiveCount,formatCount),' positive; total cost ',ro('bayes-cost',bayes.totalCost,dec),'; value of positives ',ro('bayes-value',bayes.selectedValue,dec),'. Positive when posterior Pr(target > threshold) ≥ ',ro('cutoff',bayes.cutoff,formatProb),'; choose positive at equality.'),h('p',{},'Grades through h=',ro('h',s.positiveGrade,formatCount),' declare ',ro('grade-positive',chosen.classification.positiveCount,formatCount),' positive; total cost ',ro('grade-cost',chosen.classification.totalCost,dec),'; value of positives ',ro('grade-value',chosen.classification.selectedValue,dec),'.'),h('p',{class:'op-note'},'The target event is strictly above its substantive threshold. The probability cutoff instead comes from the two costs. Neither the budget nor τ determines this classifier.'));
  if(s.report==='optimal')reportCard.append(h('p',{class:'op-note'},s.law==='league'?'Followed representative: fewer grades first, then earlier cuts in posterior-mean order. Exact score ties stay in the same block. ':'Followed representative: lexicographically first grade vector in unit order. ',ro('tieCount',m.opt.tieCount??1,formatCount),(m.opt.tieCount??1)===1?' best report within tolerance ':' equal-risk reports within tolerance ',ro('tieTol',m.opt.tieTol??1e-12,formatSci),'.'));
  cards.replaceChildren(reportCard,native);
  ties.hidden=(m.opt.tieCount??1)<=1;
  const nativeFirst=cells=>{const i=s.mode==='places'?2:cells.length-1;return[cells[i],...cells.filter((_,k)=>k!==i)];};
  if(!ties.hidden){
   const tied=m.tied.map(r=>({...r,classification:bayes?thresholdClassification(m.pAbove,{...classificationOptions,positive:r.grade.map(g=>g<=s.positiveGrade)}):null}));
   ties.replaceChildren(h('p',{class:'op-note'},'Equal reporting risk can hide different disclosures and added actions. Listed ',ro('ties-listed',tied.length,formatCount),' of ',ro('ties-total',Number(m.opt.tieCount),formatCount),' equal-risk reports; ',tied.length<Number(m.opt.tieCount)?'the list is truncated. ':'the list is complete. ','The table applies the same lottery and grade-to-class rule to each alternative.'),h('table',{class:'op-table prx-sticky-first'},h('thead',{},h('tr',{},h('th',{scope:'col',text:'Report'}),...nativeFirst(['Stated pairs N','Risk','Budget selected value','Top overlap',...(s.mode==='threshold'?['Positive declarations','Positive value','Classification cost']:[])]).map(text=>h('th',{scope:'col',text})))),h('tbody',{},...tied.map((r,i)=>h('tr',{},h('th',{scope:'row'},ro(`tie-${i}-grade`,r.grade,formatGrades)),...nativeFirst([['N',r.ev.N,formatCount],['risk',r.ev.risk,formatRisk],['value',r.allocation.expectedValue,dec],['overlap',r.allocation.expectedOverlap,dec],...(s.mode==='threshold'?[['positive',r.classification.positiveCount,formatCount],['positiveValue',r.classification.selectedValue,dec],['cost',r.classification.totalCost,dec]]:[])]).map(([key,v,f])=>h('td',{},ro(`tie-${i}-${key}`,v,f))))))));
  }else ties.replaceChildren();
  valuePlot.hidden=overlapPlot.hidden=s.mode!=='places';classPlot.hidden=s.mode!=='threshold';
  const width=slot=>Math.max(1,Math.round(slot.clientWidth||ctx.width()));
  const nativeRows=s.mode==='places'?rows:[...rows,{key:'bayes',name:'Native Bayes classifier (binary action)',classification:bayes,ev:{risk:null}}];
  const nativeX=s.mode==='places'?r=>r.allocation.expectedValue:r=>r.classification.selectedValue,nativeXLabel=s.mode==='places'?'Expected selected value':'Expected value of positives',nativeY=s.mode==='places'?r=>r.allocation.expectedOverlap:r=>r.classification.totalCost,nativeLabel=s.mode==='places'?'Expected top-set overlap':'Expected classification cost';
  const [loX,hiX]=[Math.min(...nativeRows.map(nativeX)),Math.max(...nativeRows.map(nativeX))];
  const labelLeft=nativeX(chosen)>(loX+hiX)/2;
  const yy=nativeRows.map(nativeY),labelNearTop=nativeY(chosen)>=(Math.min(...yy)+Math.max(...yy))/2;
  const nativeChart=plot(nativePlot,{width:width(nativePlot),height:290,marginLeft:62,marginRight:labelMargin,marginTop:26,marginBottom:47,x:{label:nativeXLabel,labelAnchor:'center',labelArrow:'none'},y:{label:nativeLabel,labelArrow:'none',grid:true},alt:'Candidate rules compared on native objectives. Reporting risk is separately listed for every rule.',table:{caption:'Native objectives and the separate reporting risk',columns:[{label:'Report',value:'name'},{label:nativeXLabel,value:nativeX,format:dec},{label:nativeLabel,value:nativeY,format:dec},{label:'Reporting risk',value:r=>r.key==='bayes'?'NA: binary action':r.ev.risk,format:v=>typeof v==='number'?formatRisk(v):v}],rows:nativeRows},keyboard:{data:nativeRows,x:nativeX,y:nativeY,sort:false,label:'Compare native objectives with reporting risk separately named',title:r=>`${r.name}: selected value ${dec(nativeX(r))}, ${nativeLabel} ${dec(nativeY(r))}; separate reporting risk ${r.key==='bayes'?'not defined for this binary action':formatRisk(r.ev.risk)}`},marks:(c,P)=>[...s.mode==='places'?[P.ruleX([m.reports.mean.allocation.expectedValue],{stroke:c.plotMuted,strokeDasharray:'4,3'})]:[],P.ruleY([s.mode==='places'?m.reports.top.allocation.expectedOverlap:bayes.totalCost],{stroke:c.plotMuted,strokeDasharray:'4,3'}),P.dot(rows,{x:nativeX,y:nativeY,symbol:r=>r.key==='optimal'?'diamond':'circle',r:6,fill:c.post,stroke:c.plotBg}),P.dot([chosen],{x:nativeX,y:nativeY,r:10,fill:'none',stroke:c.plotFg,strokeWidth:2}),numText([chosen],{x:nativeX,y:nativeY,value:nativeY,format:dec,dx:labelLeft?-13:13,dy:labelNearTop?18:-12,textAnchor:labelLeft?'end':'start',fill:c.plotFg,stroke:c.plotBg,strokeWidth:3,paintOrder:'stroke',fontWeight:600}),...s.mode==='threshold'?[P.dot([{value:bayes.selectedValue,cost:bayes.totalCost}],{x:'value',y:'cost',symbol:'star',r:7,fill:c.est,stroke:c.plotBg})]:[]]});
  labelCandidateMarks(nativeChart,nativeRows,nativeX,nativeY,pal);
  const scatter=(slot,y,axis,baseline)=>{
   const chart=plot(slot,{width:width(slot),height:240,marginLeft:52,marginRight:labelMargin,marginTop:24,marginBottom:44,x:{label:'Reporting risk (smaller is better)',labelArrow:'none',domain:[0,Math.max(.3,...rows.map(r=>r.ev.risk))*1.1]},y:{label:axis,labelArrow:'none',grid:true},alt:axis+' for the same candidate reports, plotted against their reporting risk. Native objective is a separate decision.',table:{caption:axis,columns:[{label:'Report',value:'name'},{label:'Reporting risk',value:r=>r.ev.risk,format:v=>formatRisk(v)},{label:axis,value:y,format:dec}],rows},keyboard:{data:rows,x:r=>r.ev.risk,y,sort:false,label:axis,title:r=>`${r.name}: risk ${formatRisk(r.ev.risk)}, ${axis} ${dec(y(r))}`},marks:(c,P)=>[P.ruleY([baseline],{stroke:c.plotMuted,strokeDasharray:'4,3'}),P.dot(rows,{x:r=>r.ev.risk,y,symbol:r=>r.key==='optimal'?'diamond':'circle',r:5,fill:c.post,stroke:c.plotBg}),P.dot([chosen],{x:r=>r.ev.risk,y,r:9,fill:'none',stroke:c.plotFg,strokeWidth:2})]});
   labelCandidateMarks(chart,rows,r=>r.ev.risk,y,pal);
  };
  if(s.mode==='places'){scatter(valuePlot,r=>r.allocation.expectedValue,'Expected selected value',m.reports.mean.allocation.expectedValue);scatter(overlapPlot,r=>r.allocation.expectedOverlap,'Expected top-set overlap',m.reports.top.allocation.expectedOverlap);}
  else scatter(classPlot,r=>r.classification.totalCost,'Expected classification cost',bayes.totalCost);
  const unitRows=m.ids.map((id,i)=>({id,mean:m.means[i],pTop:m.pTop[i],pAbove:m.pAbove[i],inclusion:selected.allocation.inclusion[i],bayes:bayes?.positive[i]??null,gradePositive:chosen.classification?.positive[i]??null}));
  plot(unitsPlot,{width:width(unitsPlot),height:Math.max(170,unitRows.length*18+50),marginLeft:45,marginRight:18,marginTop:20,marginBottom:36,x:{domain:[0,1],label:s.mode==='places'?'Inclusion probability from the selected report':'Posterior Pr(target > threshold)',labelArrow:'none'},y:{domain:m.ids,label:null,tickSize:0},alt:'Each eligible unit and its inclusion or threshold probability; explicit selection flags remain distinct from grades.',table:{caption:'Unit-level native decision inputs and actions',columns:[{label:'Unit',value:'id'},{label:'Posterior mean',value:'mean',format:dec},{label:'Pr(top budget)',value:'pTop',format:v=>formatProb(v)},{label:'Pr(above threshold)',value:'pAbove',format:v=>formatProb(v)},{label:'Budget inclusion probability',value:'inclusion',format:dec},{label:'Native classifier positive',value:r=>r.bayes===null?'NA: costs zero':r.bayes?'yes':'no'},{label:'Grade-derived positive',value:r=>r.gradePositive===null?'NA: costs zero':r.gradePositive?'yes':'no'}],rows:unitRows},keyboard:{data:unitRows,x:s.mode==='places'?'inclusion':'pAbove',y:'id',sort:false,label:'Inspect each unit’s native decision inputs',title:r=>`${r.id}: mean ${dec(r.mean)}, top probability ${formatProb(r.pTop)}, inclusion ${dec(r.inclusion)}, above-threshold probability ${formatProb(r.pAbove)}, native positive ${r.bayes}, grade-derived positive ${r.gradePositive}`},marks:(c,P)=>[P.ruleX(s.mode==='threshold'?[bayes.cutoff]:[],{stroke:c.plotMuted,strokeDasharray:'4,3'}),P.dot(unitRows,{x:s.mode==='places'?'inclusion':'pAbove',y:'id',fill:r=>s.mode==='threshold'&&r.bayes?c.est:c.post,r:4})]});
  const objectiveFirst=cells=>s.mode==='places'?[cells[1],cells[0],...cells.slice(2)]:[cells.at(-1),...cells.slice(0,-1)];
  summary.replaceChildren(h('table',{class:'op-table prx-sticky-first'},h('thead',{},h('tr',{},h('th',{scope:'col',text:'Candidate report'}),...objectiveFirst(['Risk','Budget selected value','Top overlap',...(s.mode==='threshold'?['Positive declarations','Positive value','Classification cost']:[])]).map(text=>h('th',{scope:'col',text})))),h('tbody',{},...rows.map(r=>h('tr',{},h('th',{scope:'row',text:r.name}),...objectiveFirst([[r.ev.risk,formatRisk],[r.allocation.expectedValue,dec],[r.allocation.expectedOverlap,dec],...(s.mode==='threshold'?[[r.classification.positiveCount,formatCount],[r.classification.selectedValue,dec],[r.classification.totalCost,dec]]:[])]).map(([v,f])=>h('td',{},ctx.num(v,f(v)))))))));
  ctx.readout.set(s.mode==='places'?['At τ ',ctx.num(s.tau,formatSetting(s.tau)),', ',names[s.report],' has reporting risk ',ctx.num(selected.ev.risk,formatRisk(selected.ev.risk)),', selected value ',ctx.num(selected.allocation.expectedValue,dec(selected.allocation.expectedValue)),', and expected top-set overlap ',ctx.num(selected.allocation.expectedOverlap,dec(selected.allocation.expectedOverlap)),'.',...(s.report==='mean'?[]:[' Posterior-mean order: value ',ctx.num(m.reports.mean.allocation.expectedValue,dec(m.reports.mean.allocation.expectedValue)),', overlap ',ctx.num(m.reports.mean.allocation.expectedOverlap,dec(m.reports.mean.allocation.expectedOverlap)),'.'])]:['The native classifier declares ',ctx.num(bayes.positiveCount,formatCount(bayes.positiveCount)),' positive at total cost ',ctx.num(bayes.totalCost,dec(bayes.totalCost)),'. The added grade rule declares ',ctx.num(chosen.classification.positiveCount,formatCount(chosen.classification.positiveCount)),' positive at cost ',ctx.num(chosen.classification.totalCost,dec(chosen.classification.totalCost)),'.']);
  ctx.caption.replaceChildren(s.mode==='places'?'Dashed benchmarks: mean-score selection maximizes expected selected value; exact top-set probabilities maximize expected top-set overlap. ':'Dashed line: the native Bayes classification cost. This binary action has no intrinsic grade-report risk. Other points evaluate the explicit grade-to-classification convention. ',s.law==='league'?'Here membership and overlap are Monte Carlo estimates on the same draws used to order the top-set scores; no exact overlap-optimality certificate is supplied. The posterior means and threshold probabilities are analytic. The reporting optimum is restricted to at most three grades along the posterior-mean order; strict-order comparison reports lie outside that family. ':'Finite-law membership and utility quantities are exact. ', 'Score ties in strict orders follow unit index; a grade boundary instead uses a uniform subset lottery. Value means the selected target value, not an intervention effect. ',captionNode(ctx,'teaching-posterior'));
 }
 return{render};
}});}
