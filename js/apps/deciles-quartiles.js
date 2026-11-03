import {createWidget} from '../shared/base.js';
import {palette} from '../shared/chart.js';
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
`;
const tiers=new Map();
export function quantileReport(model,G) {
 const key=`${model.criterion}:${G}`;
 if(!tiers.has(key)) {const grade=Array.from(tierGrades(model.mean,G)),d=disclosure(grade),ev=evaluateReport(grade,model.E,{tau:.5});tiers.set(key,{G,grade,d,ev,DR:ev.EoverM[0],information:reportInformation(grade,model.E),label:G===4?'Quartiles':'Deciles'});}
 return tiers.get(key);
}
export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:'deciles-quartiles',className:'prx-dq prx-pt',css:CSS,label:'Deciles and quartiles on KRW’s reporting axes',title:'Fixed quantile tiers beside archived KRW cards',
  keys:{criterion:{type:'choice',values:['race','gender'],value:'race'},G:{type:'choice',values:[4,10],value:4},lambda:{type:'number',min:0,max:1,step:.01,value:.60}},
  build(ctx){const{h}=ctx,ro=(name,value,format=formatDecimal)=>{const node=ctx.num(value,format(value));node.dataset.prxReadout=name;return node;};
   const target=ctx.radioGroup({legend:'Signed contact-gap target',name:'criterion',options:[{value:'race',label:'White-name contact advantage'},{value:'gender',label:'Male-name contact advantage'}],value:ctx.state.criterion,onChange:v=>ctx.set({criterion:v})});
   const G=ctx.radioGroup({legend:'Quantile report to compare',name:'G',options:[{value:4,label:['Quartiles (',ctx.num(4,formatCount(4)),' tiers)']},{value:10,label:['Deciles (',ctx.num(10,formatCount(10)),' tiers)']}],value:ctx.state.G,onChange:v=>ctx.set({G:Number(v)})});
   const lambda=ctx.slider({label:'Archived card at λ',name:'lambda',min:0,max:1,step:.01,value:ctx.state.lambda,onInput:v=>ctx.set({lambda:v}),hint:'Move the ring along the released grid; fixed tiers stay in place.'});
   ctx.controls.append(target.root,G.root,lambda.root);
   const chart=h('div'),note=h('p',{class:'dq-note',text:'Diamonds: posterior-mean quantile tiers. Ring: the selected archived card. Smaller DR and larger I are preferred. KRW write τ̄ for I(g, θ). Lines join the released grid reports and do not certify a continuous frontier.'}),detail=h('div',{class:'dq-grid'}),table=ctx.scrollRegion(h('div',{class:'dq-scroll'}),'Compare both quantile rules and the selected archived card');
   ctx.charts.append(chart,note,detail,h('p',{class:'dq-note',text:'The table keeps all columns. On narrow screens, swipe sideways, or focus the table region and use the arrow keys.'}),table);appendKrwNotice(ctx);
   const renderer=createRuleCardRenderer(ctx);
   function numbers(r,prefix,ev=r.ev){return h('p',{},'N ',ro(`${prefix}-N`,r.d.N,formatCount),' of ',ro(`${prefix}-M`,r.d.M,formatCount),'; DR ',ro(`${prefix}-DR`,r.DR,v=>formatDecimal(v,{digits:4})),'; I ',ro(`${prefix}-I`,r.information,v=>formatDecimal(v,{digits:4})),'; E/N ',ro(`${prefix}-EoverN`,ev.EoverN[0],formatShare),'.');}
   function render(s){target.set(s.criterion);G.set(s.G);lambda.set(s.lambda);
    const model=readKrwModel(s.criterion),rows=gridRows(model),all=[quantileReport(model,4),quantileReport(model,10)],q=all.find(r=>r.G===s.G),card=cardAt(model,s.lambda),pal=palette(ctx.root);
    drawKrwAxes(ctx,chart,rows,{selected:card,overlays:all});
    const qev=evaluateReport(q.grade,model.E,{tau:card.tau===0?.5:card.tau});
    const orientation=`Grade 1 = stated highest on ${s.criterion==='race'?'white-name':'male-name'} contact advantage, as the posterior judges it.`;
    const quantileBox=h('section',{class:'dq-box prx-light-panel'},h('h4',{},q.label,' of posterior means'),renderer.chips(model,q.grade,pal),h('p',{class:'dq-note',text:orientation}),h('p',{},'Tier ',ro('tier-sizes',q.d.sizes,formatSizes),'.'),numbers(q,'tier'),h('p',{class:'dq-note'},captionNode(ctx,'fixed-tiers'),'; constructed comparison rule. Exact score ties stay together.'));
    const cardBox=h('section',{class:'dq-box prx-light-panel'},h('h4',{},'Archived card at λ ',ro('lambda',card.lambda,formatSetting)),renderer.chips(model,card.grade,pal),h('p',{class:'dq-note',text:orientation}),h('p',{},'Grade ',ro('card-sizes',card.d.sizes,formatSizes),'.'),numbers(card,'card'),h('p',{class:'dq-note'},captionNode(ctx,'krw-card'),'. ',captionNode(ctx,'fixed-report'),'.'));
    if(card.tau>0){quantileBox.append(h('p',{},'Risk at τ ',ro('tau',card.tau,v=>formatDecimal(v,{digits:4})),': ',ro('tier-risk',qev.risk,formatRisk),'.'));cardBox.append(h('p',{},'Risk at the same τ: ',ro('card-risk',card.ev.risk,formatRisk),'.'));}
    else cardBox.append(h('p',{class:'dq-note'},'λ zero is an axes endpoint. postrank risk is undefined at τ zero.'));
    detail.replaceChildren(quantileBox,cardBox);
    const tableRows=[...all.map(r=>({...r,name:r.label,selected:r.G===s.G})),{...card,name:'Selected archived card',selected:false}];
    table.replaceChildren(h('table',{class:'dq-table'},h('thead',{},h('tr',{},...['Report','Stated pairs N','DR','I(g, θ)','E/N'].map(t=>h('th',{scope:'col',text:t})))),h('tbody',{},...tableRows.map(r=>h('tr',{class:r.selected?'dq-chosen':null},h('th',{scope:'row',text:r.name}),...[[r.d.N,formatCount],[r.DR,v=>formatDecimal(v,{digits:4})],[r.information,v=>formatDecimal(v,{digits:4})],[r.ev.EoverN[0],formatShare]].map(([v,f])=>h('td',{},ctx.num(v,f(v)))))))));
    const dominates=card.DR<q.DR&&card.information>q.information;
    ctx.readout.set([q.label,': DR ',ctx.num(q.DR,formatDecimal(q.DR,{digits:4})),', I ',ctx.num(q.information,formatDecimal(q.information,{digits:4})),'. The selected card ',dominates?'has both lower DR and higher I.':'does not improve both coordinates; move λ or choose a preset.']);
    ctx.caption.replaceChildren('All reports are evaluated on the same released ',s.criterion==='race'?'white-name':'male-name',' contact-gap pair probabilities. Grid cards were selected under archived probabilities; these evaluations are not new optimality certificates. No change of sign or absolute-value transformation is applied.');
   }
   return{render};
  }});
}
