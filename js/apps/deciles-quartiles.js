import {createWidget} from '../shared/base.js';
import {palette,plot} from '../shared/chart.js';
import {formatCount,formatDecimal,formatRisk,formatSetting,formatShare,formatSizes} from '../shared/format.js';
import {captionNode} from '../shared/labels.js';
import {readKrwModel,cardAt,gridRows,drawKrwAxes,appendKrwNotice} from '../shared/krw-model.js';
import {createRuleCardRenderer,CSS as CARD_CSS} from './posterior-tiers.js';
import {disclosure,evaluateReport,reportInformation,tierGrades} from '../pr-core.js';

const CSS=`${CARD_CSS}
.prx-dq .dq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:.75rem;min-width:0}
.prx-dq .dq-box{border:1px solid var(--prx-border);border-radius:6px;padding:.5rem .65rem;min-width:0}
.prx-dq .dq-box h4{margin:0 0 .35rem;font-size:1em}
.prx-dq .dq-note{font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0}
.prx-dq .dq-box p{margin:.3rem 0}
.prx-dq .dq-table{width:100%;border-collapse:collapse}
.prx-dq .dq-table th,.prx-dq .dq-table td{padding:.35rem;text-align:right;border-bottom:1px solid var(--prx-border)}
.prx-dq .dq-table th:first-child{text-align:left}
.prx-dq .dq-scroll{overflow:auto;max-width:100%}
.prx-dq .dq-table{min-width:27rem}
.prx-dq [data-prx-readout$="-sizes"]{white-space:normal;overflow-wrap:anywhere}
.prx-dq .dq-chosen{outline:2px solid var(--prx-accent);outline-offset:-2px}
.prx-dq .dq-size-strip{display:flex;height:.65rem;margin:.35rem 0;gap:1px}
.prx-dq .dq-size-strip span{min-width:1px;background:var(--prx-post);flex-basis:0}
.prx-dq .dq-size-strip span:nth-child(even){opacity:.55}
`;
const tiers=new Map();
export function quantileReport(model,G) {
 const key=`${model.criterion}:${G}`;
 if(!tiers.has(key)) {const grade=Array.from(tierGrades(model.mean,G)),d=disclosure(grade),ev=evaluateReport(grade,model.E,{tau:.5});tiers.set(key,{G,grade,d,ev,DR:ev.EoverM[0],information:reportInformation(grade,model.E),label:G===4?'Quartiles':'Deciles'});}
 return tiers.get(key);
}

function labelArchivedCard(chart, card) {
 const {svg, palette: ink}=chart;
 const x=chart.scale('x').apply(card.DR),y=chart.scale('y').apply(card.information);
 const width=Number(svg.getAttribute('width')),height=Number(svg.getAttribute('height'));
 const label=svg.ownerDocument.createElementNS(svg.namespaceURI,'text');
 label.setAttribute('aria-hidden','true');
 label.setAttribute('font-size','11');
 label.setAttribute('font-weight','bold');
 label.setAttribute('fill',ink.plotFg);
 label.setAttribute('stroke',ink.plotBg);
 label.setAttribute('stroke-width','4');
 label.setAttribute('paint-order','stroke');
 label.setAttribute('pointer-events','none');
 for(const [name,word,value] of [['DR','DR',card.DR],['I','I',card.information]]) {
  const number=svg.ownerDocument.createElementNS(svg.namespaceURI,'tspan');
  number.dataset.prxReadout=`ring-${name}`;
  number.dataset.num=String(value);
  number.textContent=formatDecimal(value,{digits:4});
  label.append(name==='DR'?`${word} `:` · ${word} `,number);
 }
 const tierLabels=[...svg.querySelectorAll('g[aria-label="text"] text')];
 svg.append(label);
 // Work in plot coordinates. At the ends of the grid, use the inside of the axes.
 const left=x>width*.57;
 const positions=[-15,19,-33,37];
 for(const dy of positions) {
  label.setAttribute('x',String(x+(left?-11:11)));
  label.setAttribute('y',String(Math.max(13,Math.min(height-52,y+dy))));
  label.setAttribute('text-anchor',left?'end':'start');
  if(!label.getBBox) break;
  const a=label.getBBox();
  if(!tierLabels.some(t=>{
   const b=t.getBBox(),m=t.transform.baseVal.consolidate()?.matrix;
   const bx=b.x+(m?.e??0),by=b.y+(m?.f??0);
   return a.x<bx+b.width+4&&a.x+a.width>bx-4&&a.y<by+b.height+4&&a.y+a.height>by-4;
  })) break;
 }
}

const betterThan=(r,tier)=>r.DR<tier.DR&&r.information>tier.information;
function betterRuns(rows,tier){
 const runs=[];
 let run=[];
 for(const row of rows){
  if(betterThan(row,tier))run.push(row);
  else if(run.length){runs.push(run);run=[];}
 }
 if(run.length)runs.push(run);
 return runs;
}

function drawNear(ctx,slot,rows,tier,selected){
 const x=[Math.max(0,tier.DR-.012),tier.DR+.012],y=[tier.information-.05,tier.information+.05];
 const inside=r=>r.DR>=x[0]&&r.DR<=x[1]&&r.information>=y[0]&&r.information<=y[1];
 const nearby=rows.filter(inside);
 plot(slot,{
  width:Math.round(slot.clientWidth||ctx.width()),height:235,marginLeft:56,marginRight:20,marginTop:12,marginBottom:42,
  alt:'Magnified view of the released reports near the selected quantile tiers. The diamond is the tier report and shading marks lower DR and higher I.',
  x:{domain:x,label:'DR = E/M',labelArrow:'none'},y:{domain:y,label:'I(g, θ)',labelArrow:'none',grid:true},
  marks:(c,P)=>[
   P.rect([tier],{x1:()=>x[0],x2:'DR',y1:'information',y2:()=>y[1],fill:c.est,fillOpacity:.12}),
   P.ruleX([tier],{x:'DR',y1:'information',y2:()=>y[1],stroke:c.est,strokeDasharray:'4,3'}),
   P.ruleY([tier],{y:'information',x1:()=>x[0],x2:'DR',stroke:c.est,strokeDasharray:'4,3'}),
   P.dot(nearby,{x:'DR',y:'information',fill:r=>betterThan(r,tier)?c.est:c.plotFg,r:3}),
   P.dot([tier],{x:'DR',y:'information',symbol:'diamond',fill:c.est,stroke:c.plotBg,r:6}),
   P.dot(inside(selected)?[selected]:[],{x:'DR',y:'information',fill:'none',stroke:c.plotFg,strokeWidth:2,r:7}),
  ],
 });
}

export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:'deciles-quartiles',className:'prx-dq prx-pt',css:CSS,layout:'result-first',label:'Deciles and quartiles on KRW’s reporting axes',title:'Fixed quantile tiers beside archived KRW cards',
  keys:{criterion:{type:'choice',values:['race','gender'],value:'race'},G:{type:'choice',values:[4,10],value:4},lambda:{type:'number',min:0,max:1,step:.01,value:.60}},
  build(ctx){const{h}=ctx,ro=(name,value,format=formatDecimal)=>{const node=ctx.num(value,format(value));node.dataset.prxReadout=name;return node;};
   const target=ctx.radioGroup({legend:'Signed contact-gap target',name:'criterion',options:[{value:'race',label:'White-name contact advantage'},{value:'gender',label:'Male-name contact advantage'}],value:ctx.state.criterion,onChange:v=>ctx.set({criterion:v})});
   const G=ctx.radioGroup({legend:'Quantile report to compare',name:'G',options:[{value:4,label:['Quartiles (',ctx.num(4,formatCount(4)),' tiers)']},{value:10,label:['Deciles (',ctx.num(10,formatCount(10)),' tiers)']}],value:ctx.state.G,onChange:v=>ctx.set({G:Number(v)})});
   const lambda=ctx.slider({label:'Archived card at λ',name:'lambda',min:0,max:1,step:.01,value:ctx.state.lambda,onInput:v=>ctx.set({lambda:v}),hint:'Move the ring along the released grid; fixed tiers stay in place.'});
   ctx.controls.append(target.root,G.root,lambda.root);
   const chart=h('div'),note=h('p',{class:'dq-note',text:'Diamonds: posterior-mean quantile tiers. Ring: the selected archived card. Smaller DR and larger I are preferred. Shading shows where both improve on the selected tier. KRW write τ̄ for I(g, θ). Lines join the released grid reports and do not certify a continuous frontier.'}),detail=h('div',{class:'dq-grid'}),table=ctx.scrollRegion(h('div',{class:'dq-scroll'}),'Compare both quantile rules and the selected archived card');
   const near=ctx.disclosure({name:'near',title:'Zoom near the selected tier',placement:'none'}),nearPlot=h('div');
   near.body.append(nearPlot,h('p',{class:'dq-note',text:'Each dot is a released grid report. The selected ring appears here when it falls in this window.'}));
   ctx.primaryControl(lambda.root);ctx.primaryGraphic(chart);
   ctx.charts.append(chart,note,near.root,detail,h('p',{class:'dq-note',text:'The table keeps all columns. On narrow screens, swipe sideways, or focus the table region and use the arrow keys.'}),table);appendKrwNotice(ctx);
   const renderer=createRuleCardRenderer(ctx);
   function numbers(r,prefix,ev=r.ev){return h('p',{},'N ',ro(`${prefix}-N`,r.d.N,formatCount),' of ',ro(`${prefix}-M`,r.d.M,formatCount),'; DR ',ro(`${prefix}-DR`,r.DR,v=>formatDecimal(v,{digits:4})),'; I ',ro(`${prefix}-I`,r.information,v=>formatDecimal(v,{digits:4})),'; E/N ',ro(`${prefix}-EoverN`,ev.EoverN[0],formatShare),'.');}
   function render(s){target.set(s.criterion);G.set(s.G);lambda.set(s.lambda);
    const model=readKrwModel(s.criterion),rows=gridRows(model),all=[quantileReport(model,4),quantileReport(model,10)],q=all.find(r=>r.G===s.G),card=cardAt(model,s.lambda),pal=palette(ctx.root);
    const runs=betterRuns(rows,q);
    labelArchivedCard(drawKrwAxes(ctx,chart,rows,{selected:card,overlays:all,dominance:{benchmark:q,runs}}),card);
    if(near.open)drawNear(ctx,nearPlot,rows,q,card);
    const qev=evaluateReport(q.grade,model.E,{tau:card.tau===0?.5:card.tau});
    const orientation=`Grade 1 = stated highest on ${s.criterion==='race'?'white-name':'male-name'} contact advantage, as the posterior judges it.`;
    const quantileBox=h('section',{class:'dq-box prx-light-panel'},h('h4',{},q.label,' of posterior means'),renderer.chips(model,q.grade,pal),h('p',{class:'dq-note',text:orientation}),h('p',{},'Tier ',ro('tier-sizes',q.d.sizes,formatSizes),'.'),numbers(q,'tier'),h('p',{class:'dq-note'},captionNode(ctx,'fixed-tiers'),'; constructed comparison rule. Exact score ties stay together.'));
    const chips=renderer.chips(model,card.grade,pal);
    const gradeDetail=card.d.G>12?h('div',{},
     h('div',{class:'dq-size-strip','aria-hidden':'true'},...card.d.sizes.map(size=>h('span',{style:`flex-grow:${size}` }))),
     h('details',{open:detail.querySelector('details')?.open??false},h('summary',{},'All grade groups'),chips)):chips;
    const cardBox=h('section',{class:'dq-box prx-light-panel'},h('h4',{},'Archived card at λ ',ro('lambda',card.lambda,formatSetting)),gradeDetail,h('p',{class:'dq-note',text:orientation}),h('p',{},'Grade ',ro('card-sizes',card.d.sizes,formatSizes),'.'),numbers(card,'card'),h('p',{class:'dq-note'},captionNode(ctx,'krw-card'),'. ',captionNode(ctx,'fixed-report'),'.'));
    if(card.tau>0){quantileBox.append(h('p',{},'Risk at τ ',ro('tau',card.tau,v=>formatDecimal(v,{digits:4})),': ',ro('tier-risk',qev.risk,formatRisk),'.'));cardBox.append(h('p',{},'Risk at the same τ: ',ro('card-risk',card.ev.risk,formatRisk),'.'));}
    else cardBox.append(h('p',{class:'dq-note'},'λ zero is an axes endpoint. postrank risk is undefined at τ zero.'));
    detail.replaceChildren(quantileBox,cardBox);
    const tableRows=[...all.map(r=>({...r,name:r.label,selected:r.G===s.G})),{...card,name:'Selected archived card',selected:false}];
    table.replaceChildren(h('table',{class:'dq-table'},h('thead',{},h('tr',{},...['Report','Stated pairs N','DR','I(g, θ)','E/N'].map(t=>h('th',{scope:'col',text:t})))),h('tbody',{},...tableRows.map(r=>h('tr',{class:r.selected?'dq-chosen':null},h('th',{scope:'row',text:r.name}),...[[r.d.N,formatCount],[r.DR,v=>formatDecimal(v,{digits:4})],[r.information,v=>formatDecimal(v,{digits:4})],[r.ev.EoverN[0],formatShare]].map(([v,f])=>h('td',{},ctx.num(v,f(v)))))))));
    const axisValue=v=>ctx.num(v,formatDecimal(v,{digits:4}));
    const gridValue=v=>ctx.num(v,formatSetting(v));
    const window=runs.flatMap((run,i)=>[...(i?[', ']:[]),gridValue(run[0].lambda),...(run.length>1?['–',gridValue(run.at(-1).lambda)]:[])]);
    ctx.readout.set([q.label,': DR ',axisValue(q.DR),', I ',axisValue(q.information),'. Selected card λ ',gridValue(card.lambda),
     ': DR ',axisValue(card.DR),', I ',axisValue(card.information),'. It ',
     betterThan(card,q)?'has both lower DR and higher I.':'does not improve both coordinates.',
     ...(runs.length?[' Both improve at released λ ',...window,'.']:[' No released λ improves both.'])]);
    ctx.caption.replaceChildren('All reports are evaluated on the same released ',s.criterion==='race'?'white-name':'male-name',' contact-gap pair probabilities. Grid cards were selected under archived probabilities; these evaluations are not new optimality certificates. No change of sign or absolute-value transformation is applied.');
   }
   return{render};
  }});
}
