import{createWidget}from'../shared/base.js';
import{plot}from'../shared/chart.js';
import{formatCount,formatDecimal,formatProb,formatSetting}from'../shared/format.js';
import{captionNode}from'../shared/labels.js';
import{readKrwModel,cardAt,drawKrwHeat,heatCounts,thresholdAt,appendKrwNotice}from'../shared/krw-model.js';
const CSS=`
.prx-nt .nt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem;min-width:0}
.prx-nt .nt-note{font-size:.9em;color:var(--prx-fg-muted);margin:.35rem 0}
.prx-nt .nt-heading{margin:.5rem 0;font-size:1em}
.prx-nt .nt-table{width:100%;min-width:36rem;border-collapse:collapse}
.prx-nt .nt-table th,.prx-nt .nt-table td{min-width:6rem;padding:.4rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--prx-border);overflow-wrap:normal;word-break:normal}
.prx-nt .nt-pair-scroll{overflow-x:auto;max-width:100%;min-width:0}
.prx-nt .nt-counts{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin:.5rem 0}
.prx-nt .nt-proof{border-left:3px solid var(--prx-accent);padding:.3rem .6rem;margin:.4rem 0}
.prx-nt .krw-map-key{display:inline-flex;align-items:center;gap:.25rem;margin-right:.5rem;font-size:.8em}
.prx-nt .krw-map-swatch{display:inline-block;width:1em;height:1em;border:1px solid var(--prx-cell-border)}
.prx-nt .nt-legend{display:flex;flex-wrap:wrap;gap:.25rem .5rem;font-size:.85em;padding:.4rem .5rem}
.prx-nt .nt-legend>span:first-child{flex-basis:100%}
`;
const curves=new Map();
const kindName={twoWithheld:'Two withheld pairs, one stated',statedChain:'A stated chain with its closing pair withheld',directedCycle:'A directed three-cycle'};
export function mountWidget(el,spec={}){return createWidget(el,spec,{name:'naive-thresholding',className:'prx-nt',css:CSS,label:'Inspect unprintable triples under naive pair thresholds',title:'Pair choices that no grade report can print',
keys:{criterion:{type:'choice',values:['race','gender'],value:'race'},lambda:{type:'number',min:.01,max:1,step:.01,value:.25},sort:{type:'choice',values:['mean','estimate','krw'],value:'mean'},blocks:{type:'boolean',value:false},triple:{type:'integer',min:0,max:147439,value:0}},
build(ctx){const{h}=ctx,ro=(name,v,f=formatCount)=>{const n=ctx.num(v,f(v));n.dataset.prxReadout=name;return n;};
 const criterion=ctx.radioGroup({legend:'Signed contact-gap target',name:'criterion',options:[{value:'race',label:'White-name contact advantage'},{value:'gender',label:'Male-name contact advantage'}],value:ctx.state.criterion,onChange:v=>ctx.set({criterion:v})});
 const lambda=ctx.slider({label:'Archived card and pair threshold at λ',name:'lambda',min:.01,max:1,step:.01,value:ctx.state.lambda,onInput:v=>ctx.set({lambda:v}),hint:['τ = λ/(',ctx.num(1,formatCount(1)),' + λ). This sets the pair threshold and which archived card is shown.']});
 const cutoffInfo=h('p',{class:'prx-hint'});lambda.root.append(cutoffInfo);
 const sort=ctx.radioGroup({legend:'Order within the map',name:'sort',options:[{value:'mean',label:'Posterior mean'},{value:'estimate',label:'Estimate'},{value:'krw',label:'KRW’s final grid order'}],value:ctx.state.sort,onChange:v=>ctx.set({sort:v})});
 const blocks=ctx.toggle({label:'Overlay the card’s grade blocks',name:'blocks',value:ctx.state.blocks,onChange:v=>ctx.set({blocks:v})});
 ctx.controls.append(criterion.root,lambda.root,sort.root,blocks.root);
 const heading=ctx.panelTitle('Isolated pair decisions',{className:'nt-heading'}),counts=h('div',{class:'nt-counts'}),map=h('div'),legend=h('div',{class:'nt-legend prx-light-panel'}),mapNote=h('p',{class:'nt-note'});
 const chooser=ctx.slider({label:'Inspect an unprintable triple (index starts at zero)',name:'triple',min:0,max:147439,step:1,value:ctx.state.triple,format:formatCount,onInput:v=>ctx.set({triple:v})});
 const proof=h('div',{class:'nt-proof'}),pairTable=ctx.scrollRegion(h('div',{class:'nt-pair-scroll'}),'The three pair choices and the selected card’s directions');
 const right=h('section',{},ctx.panelTitle('Why these three choices cannot print',{className:'nt-heading'}),chooser.root,proof,h('p',{class:'nt-note',text:'The table keeps all four columns. Swipe sideways, or focus the table region and use the arrow keys.'}),pairTable);
 const path=h('div'),pathLegend=h('p',{class:'nt-note',text:'Solid vermillion: two withheld pairs. Dashed blue: a stated chain. Dotted gray: a directed cycle.'}),status=h('p',{class:'nt-note'}),source=h('p',{class:'nt-note'});
 ctx.charts.append(heading,counts,h('div',{class:'nt-grid'},h('section',{},map,legend,mapNote),right),ctx.panelTitle('Failures along the released λ grid',{className:'nt-heading'}),status,path,pathLegend,source);appendKrwNotice(ctx);
 let job=null;
 const cancel=()=>{job?.cancel?.();job=null;ctx.root.removeAttribute('aria-busy');};ctx.onCleanup(cancel);
 function ensureCurve(model){if(curves.has(model.criterion)){if(job&&job.key!==model.criterion)cancel();return curves.get(model.criterion);}if(job?.key===model.criterion)return null;cancel();
  const work={key:model.criterion,index:1,rows:[],cancel:null};job=work;ctx.root.setAttribute('aria-busy','true');status.textContent='Counting every triple at the remaining grid settings…';
  const step=()=>{if(job!==work)return;const start=ctx.win.performance.now();do{const l=model.grid.lambda[work.index++],r=thresholdAt(model,l);work.rows.push({lambda:l,...r.counts,invalid:r.invalidCount});}while(work.index<model.grid.count&&ctx.win.performance.now()-start<8);
   if(work.index<model.grid.count)work.cancel=ctx.timeout(step,0);else{curves.set(model.criterion,work.rows);job=null;ctx.root.removeAttribute('aria-busy');ctx.requestRender('threshold-curve-ready');}};
  work.cancel=ctx.timeout(step,0);return null;
 }
 function render(s){criterion.set(s.criterion);lambda.set(s.lambda);sort.set(s.sort);blocks.set(s.blocks);
  const model=readKrwModel(s.criterion),card=cardAt(model,s.lambda),d=thresholdAt(model,s.lambda,{details:true}),overlap=heatCounts(model,card.grade,card.tau),rows=ensureCurve(model);
  cutoffInfo.replaceChildren('Current τ ',ro('control-tau',card.tau,v=>formatDecimal(v,{digits:4})),': state a direction only when its error is below τ, equivalently Pr(truly higher) > ',ro('control-prob-cutoff',1-card.tau,formatProb),'.');
  const max=Math.max(0,d.invalidCount-1);chooser.input.max=String(max);chooser.setDisabled(d.invalidCount===0);
  if(s.triple>max){ctx.set({triple:max});return;}chooser.set(s.triple);
  const t=d.violations[s.triple]??null,units=t?[t.i,t.j,t.k]:[];
  counts.replaceChildren(h('span',{},'Naive stated pairs ',ro('naive-N',d.statedCount)),h('span',{},'Unprintable triples ',ro('invalid',d.invalidCount),' of ',ro('triples',d.triples)),...Object.entries(d.counts).map(([kind,count])=>h('span',{},kindName[kind],': ',ro(kind,count))));
  drawKrwHeat(ctx,map,legend,model,{grade:card.grade,tau:card.tau,sort:s.sort,stage:s.blocks?3:2,highlight:units});
  mapNote.replaceChildren('Blue only when Pr(row truly higher) > ',ro('cutoff',1-card.tau,v=>formatDecimal(v,{digits:3})),'. ',s.blocks?'Rows follow the card’s grades, then the chosen order.':'Rows follow the chosen order.', ' Grade 1 = stated highest on ',s.criterion==='race'?'white-name':'male-name',' contact advantage, as the posterior judges it. Highlighted cells join the inspected firms.');
  if(!t){proof.textContent='Every triple is printable at this setting; no failing triple can be inspected.';pairTable.replaceChildren();}
  else{proof.replaceChildren(h('strong',{text:kindName[t.kind]}),h('p',{},...units.flatMap((i,k)=>[k?' · ':'',h('span',{'data-prx-name':'',text:model.names[i]})])),h('p',{},t.kind==='twoWithheld'?'Sharing a grade is transitive. The two withheld pairs would force all three units into one grade, contradicting the stated pair.':t.kind==='statedChain'?'The two stated directions form a chain; a printable report must state its closing direction too.':'Strict grade order cannot run around a directed cycle.'));
   const pairs=[[t.i,t.j],[t.i,t.k],[t.j,t.k]],direction=(i,j,r)=>r===0?'withhold':`${model.names[r>0?i:j]} above ${model.names[r>0?j:i]}`;
   pairTable.replaceChildren(h('table',{class:'nt-table'},h('thead',{},h('tr',{},...['Pair','Pr(first truly higher)','Naive choice','Current card'].map(text=>h('th',{scope:'col',text})))),h('tbody',{},...pairs.map(([i,j],k)=>h('tr',{},h('th',{scope:'row'},model.names[i],' / ',model.names[j]),h('td',{},ro(`pair-${k}-pi`,1-model.e[i][j],formatProb)),h('td',{'data-prx-choice':String(k),text:direction(i,j,d.relation[i][j])}),h('td',{text:direction(i,j,Math.sign(card.grade[j]-card.grade[i]))}))))));
  }
  if(rows){status.replaceChildren('All ',ro('grid-count',rows.length),' positive released grid settings are counted exactly; neither triples nor firms are sampled.');
   const lines=rows.flatMap(r=>Object.keys(d.counts).map(kind=>({lambda:r.lambda,count:r[kind],kind}))),tip=r=>`λ ${formatSetting(r.lambda)}: ${formatCount(r.twoWithheld)} two-withheld, ${formatCount(r.statedChain)} chains, ${formatCount(r.directedCycle)} cycles.`;
   plot(path,{width:Math.max(1,Math.round(path.clientWidth||ctx.width())),height:245,marginLeft:60,marginRight:20,marginTop:20,marginBottom:40,x:{domain:[0,1],label:'λ',labelArrow:'none'},y:{domain:[0,Math.max(1,...rows.map(r=>r.invalid))],label:'Invalid triples',grid:true,labelArrow:'none'},alt:'Exact counts of three kinds of unprintable triples at every positive released lambda setting.',table:{caption:'Invalid triple counts along the released grid',columns:[{label:'λ',value:'lambda',format:v=>formatSetting(v)},...Object.keys(d.counts).map(kind=>({label:kindName[kind],value:kind,format:v=>formatCount(v)}))],rows},keyboard:{data:rows,x:'lambda',y:'invalid',sort:false,label:'Read exact failure counts along lambda',title:tip},marks:(c,P)=>[P.ruleX([card.lambda],{stroke:c.plotAxis,strokeDasharray:'4,3'}),...Object.keys(d.counts).map((kind,k)=>P.line(lines.filter(r=>r.kind===kind),{x:'lambda',y:'count',stroke:[c.est,c.post,c.wh][k],strokeDasharray:[null,'5,3','2,3'][k],strokeWidth:2}))]});
  }else path.replaceChildren();
  source.replaceChildren('The card withholds ',ro('card-withheld',overlap.W),' of ',ro('card-confident',overlap.P),' confident pairs and states ',ro('card-doubtful',overlap.S),' directions with error above τ. KRW’s card has no cap on the number of grades, so these cells come from coherence, not from a cap. ',captionNode(ctx,'krw-card'),'; ',captionNode(ctx,'fixed-report'),'.');
  ctx.readout.set(['At λ ',ctx.num(card.lambda,formatSetting(card.lambda)),', τ ',ctx.num(card.tau,formatDecimal(card.tau,{digits:4})),', naive thresholding states ',ctx.num(d.statedCount,formatCount(d.statedCount)),' pairs. ',ctx.num(d.counts.twoWithheld,formatCount(d.counts.twoWithheld)),' triples have two withheld pairs and one stated pair; ',ctx.num(d.counts.directedCycle,formatCount(d.counts.directedCycle)),' have a directed cycle.']);
  ctx.caption.textContent='The naive rule states a direction only when its error is strictly below τ. A printable grade report must form an ordered partition; absence of directed cycles alone is insufficient. All probabilities and counts use the released signed-target law; archived cards are separately evaluated on that law.';
 }
 return{render};
}});}
