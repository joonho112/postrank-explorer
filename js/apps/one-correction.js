import { appLink, createWidget } from "../shared/base.js";
import { formatCount, formatDecimal, formatGrades, formatPercent, formatSci, formatSetting, formatSizes, formatRisk } from "../shared/format.js";
import { captionNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { canonicalGrade, disclosure, drawLeague, errorArray, exactOptimum, expectedRank, fixedOrderDP, league30, LEAGUE_SEED, maxCoefficientError, normalInterval, normalPosterior, relationChange } from "../pr-core.js";
import { gaussianCard, drawReportCard, gradeLegend, REPORT_CARD_CSS } from "./report-card.js";
import { drawRelationMatrix, REPORT_BUILDER_CSS } from "./report-builder.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

const U = SIX.tables.units;
const IDS = U.id;
const L = league30();
const LEAGUE_POSTERIOR = normalPosterior(drawLeague(LEAGUE_SEED).estimate,L.se,{priorMean:0,priorSd:.15});
const ALL_IDS = [...IDS,...L.ids];
const criterionName=k=>k==="score_A"?"Score A":k==="score_B"?"Score B":"League value";
const baseMemo = new Map();
const subset = (E, indices) => ({ ids: indices.map(i => E.ids[i]), criteria: E.criteria,
  e: E.e.map(ek => indices.map(i => indices.map(j => ek[i][j]))) });
export function correctionModel({data="six",score="A"}={}) {
  if(data==="league")return {ids:L.ids,mean:LEAGUE_POSTERIOR.mean.map(v=>[v]),sd:LEAGUE_POSTERIOR.sd.map(v=>[v]),criteria:["league value"],weights:[1],unit:"unit",units:"units",league:true};
  const scores=score==="AB"?["A","B"]:[score];
  return {ids:IDS,mean:IDS.map((_,i)=>scores.map(k=>U[`mean_${k}`][i])),sd:IDS.map((_,i)=>scores.map(k=>U[`sd_${k}`][i])),criteria:scores.map(k=>`score_${k}`),weights:scores.map(()=>1/scores.length),unit:"site",units:"sites",league:false};
}
const optimize=(E,model,state)=>model.league
  ? fixedOrderDP(E,{scores:expectedRank(E,{w:model.weights}),direction:"ascending",tau:state.tau,w:model.weights})
  : exactOptimum(E,{tau:state.tau,w:model.weights,family:state.cap==="all"?{kind:"all"}:{kind:"atMost",G:state.cap}});
const parseCap=v=>String(v).toLowerCase()==="all"?"all":Number.isFinite(Number(v))?Math.min(6,Math.max(2,Math.round(Number(v)))):undefined;

/** Each population keeps its marginals. The league recomputes expected ranks and cuts that new order. */
export function correctionResult(state) {
  const model=correctionModel(state), key=JSON.stringify([state.data??"six",state.score??"A",state.tau,state.cap]);
  let before=baseMemo.get(key);
  if(!before){const E=errorArray(model.mean,model.sd,{ids:model.ids,criteria:model.criteria});before={E,result:optimize(E,model,state)};if(baseMemo.size>=128)baseMemo.delete(baseMemo.keys().next().value);baseMemo.set(key,before);}
  const selected=model.ids.indexOf(state.unit),indices=model.ids.map((_,i)=>i).filter(i=>state.mode!=="drop"||i!==selected);
  const mean=model.mean.map((row,i)=>row.map(v=>state.mode==="mean"&&i===selected?state.mean:v));
  const sd=model.sd.map((row,i)=>row.map(v=>state.mode==="sd"&&i===selected?state.sd:v));
  const ids=indices.map(i=>model.ids[i]);
  const E=errorArray(indices.map(i=>mean[i]),indices.map(i=>sd[i]),{ids,criteria:model.criteria});
  const after=optimize(E,model,state),originalCommon=Array.from(canonicalGrade(indices.map(i=>before.result.grade[i])));
  const delta=relationChange(originalCommon,Array.from(after.grade),E,{w:model.weights});
  const untouched=indices.filter(i=>i!==selected),afterPositions=untouched.map(i=>indices.indexOf(i));
  const untouchedE0=subset(before.E,untouched),untouchedE1=subset(E,afterPositions);
  const other=relationChange(untouched.map(i=>before.result.grade[i]),afterPositions.map(i=>after.grade[i]),untouchedE1,{w:model.weights});
  const coefficientGaps=maxCoefficientError(untouchedE0,untouchedE1).epsilon;
  return {model,before,after,E,ids,indices,mean:indices.map(i=>mean[i]),sd:indices.map(i=>sd[i]),originalCommon,delta,other,coefficientGaps,coefficientGap:Math.max(...coefficientGaps)};
}

const CSS = `${REPORT_CARD_CSS}\n${REPORT_BUILDER_CSS}
.oc .oc-cards { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem; }
.oc .oc-panel { min-width:0;padding:.75rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border:1px solid var(--prx-border);border-radius:var(--prx-radius); }
.oc .oc-panel .prx-panel-title,.oc .oc-panel .prx-result-tag {color:var(--prx-plot-fg);}
.oc .oc-panel p {margin:.4rem 0;}
.oc .oc-matrix-area {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1rem;margin-top:1rem;}
.oc .oc-table {border-collapse:collapse;width:100%;}
.oc .oc-table th,.oc .oc-table td {padding:.35rem;text-align:left;border-bottom:1px solid var(--prx-cell-border);}
.oc .oc-legend {font-size:.88em;}
.oc .oc-note {font-size:.9em;}
.oc .oc-scroll {max-width:100%;overflow-x:auto;min-width:0;}
.oc .oc-ties-table {min-width:30rem;table-layout:fixed;}
/* review 044 repair, X-09: the league matrix (29 x 29) keeps its 30 px cells; its row labels have room (the shared renderer
   measures them), and it scrolls inside a box bounded on both axes, with aria-hidden copies of its row labels pinned at the
   left edge and of its column labels at the top (a blank corner over both), so a cell's row and column stay named (the
   matrix keeps its own labels, keyboard reader and table; 1.13 pins row labels the same way) */
.oc .oc-matrix-inner.oc-league {width:max-content;}
.oc .oc-scroll.oc-league-scroll {max-height:23rem;overflow:auto;overscroll-behavior:contain;}
.oc .oc-pin {position:sticky;left:0;z-index:2;height:0;}
.oc .oc-colpin {position:sticky;top:0;z-index:3;height:0;}
.oc .oc-corner {position:sticky;top:0;left:0;z-index:4;height:0;}
.oc .oc-pin > svg,.oc .oc-colpin > svg {position:absolute;top:0;left:0;display:block;max-width:none;pointer-events:none;background:var(--prx-plot-bg);}
.oc .oc-corner > span {position:absolute;top:0;left:0;display:block;background:var(--prx-plot-bg);}
.oc .oc-scroll[data-prx-overflow="start"] .oc-pin > svg,
.oc .oc-scroll[data-prx-overflow="both"] .oc-pin > svg {box-shadow:6px 0 6px -5px color-mix(in srgb, var(--prx-plot-fg) 40%, transparent);}
.oc .oc-scroll.oc-scrolled-y .oc-colpin > svg {box-shadow:0 6px 6px -5px color-mix(in srgb, var(--prx-plot-fg) 40%, transparent);}
/* a keyboard tip stays above the pinned labels */
.oc .oc-matrix-inner .prx-kbd-tip {z-index:5;}
/* review 044 repair, X-14: the list of changed pairs between untouched units is complete but bounded (about 20rem, with
   its count above it); its header row stays in view while it scrolls */
.oc .oc-list {max-height:20rem;overflow-y:auto;overscroll-behavior-y:contain;min-width:0;}
.oc .oc-list thead th {position:sticky;top:0;z-index:1;background:var(--prx-plot-bg);}
.oc .oc-list:focus-visible {outline:var(--prx-focus-width, 2px) solid var(--prx-focus, #17645E);outline-offset:2px;}
.oc .oc-policy-after {margin-top:1rem;}
.oc .prx-controls > .oc-input-line {flex:1 1 100%;margin:0;}
.oc .oc-ties-table th {overflow-wrap:normal;word-break:normal;}
.oc .oc-change-chips {display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;margin:.35rem 0}
.oc .oc-change-chip {border:1px solid var(--prx-border-strong);border-radius:.25rem;padding:.05rem .35rem}

.oc .oc-grade-vector {white-space:normal;overflow-wrap:anywhere;}
.oc .oc-order-note {border-left:3px solid var(--prx-accent);padding:.5rem .75rem;margin:.5rem 0;}
.oc .oc-ring {display:inline-block;width:.8em;height:.8em;border:2px solid var(--prx-plot-fg);border-radius:50%;vertical-align:-.1em;margin-right:.3em;}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "one-correction", title: "One correction moves other grades", className: "oc prx-rc prx-rb", css: CSS,
    // the shared result-first frame (review 044, X-01): population, unit and change, a closed Settings box (score, grade
    // cap), the preset row, the corrected mean or SD and the withholding cost after it (the sliders come and go with the
    // change, so the preset row never moves), the read-out, then the before and after cards (the graphic the correction
    // changes), the matrix beside the bounded list of changed pairs between untouched units, and the tie table when
    // there are ties
    layout: "result-first",
    keys: {
      data: {type:"choice",values:["six","league"],value:"six"},
      score: {type:"choice",values:["A","B","AB"],value:"A"},
      unit: {type:"choice", values:ALL_IDS, value:"C"},
      mode: {type:"choice", values:["mean","sd","drop"], value:"mean"},
      mean: {type:"number", min:-2, max:2, step:.05, value:-1},
      sd: {type:"number", min:.05, max:1.2, step:.05, value:1},
      tau: {type:"number", min:.02, max:.5, step:.01, value:.2},
      cap: {type:"custom",value:3,parse:parseCap},
    },
    build(ctx) {
      const {h} = ctx;
      let renderToken=0;ctx.onCleanup(()=>{renderToken+=1;});
      const ro = (name, raw, display) => {const n=ctx.num(raw,display);n.setAttribute("data-prx-readout",name);return n;};
      const data=ctx.segmented({label:"Population",name:"data",options:[{value:"six",label:"Six sites"},{value:"league",label:"Simulated league"}],value:ctx.state.data,onChange:v=>ctx.set(v==="league"?{data:v,score:"A",unit:"U15",mode:"drop",cap:"all",tau:.2}:{data:v,score:"A",unit:"C",mode:"mean",cap:3,mean:-1,sd:1})});
      const score=ctx.select({label:"Score used to choose grades",name:"score",options:[{value:"A",label:"Score A"},{value:"B",label:"Score B"},{value:"AB",label:"Scores A and B, equal weights"}],value:ctx.state.score,onChange:v=>{const m=correctionModel({data:"six",score:v}),i=m.ids.indexOf(ctx.state.unit);ctx.set({score:v,mode:v==="AB"?"drop":ctx.state.mode,cap:v==="AB"?"all":ctx.state.cap,mean:m.mean[i][0],sd:m.sd[i][0]});}});
      const unit = ctx.select({label:"Unit to correct or drop",name:"unit",options:ALL_IDS.map(id=>({value:id,label:id.length===1?`Site ${id}`:id})),value:ctx.state.unit,
        onChange:v=>{const m=correctionModel(ctx.state),i=m.ids.indexOf(v);ctx.set({unit:v,mean:m.mean[i][0],sd:m.sd[i][0]});}});
      const mode = ctx.segmented({label:"Change",name:"mode",options:[{value:"mean",label:"Posterior mean"},{value:"sd",label:"Posterior SD"},{value:"drop",label:"Drop unit"}],value:ctx.state.mode,onChange:v=>ctx.set({mode:v})});
      const mean = ctx.slider({label:"Corrected posterior mean",...ctx.key("mean"),onInput:v=>ctx.set({mean:v})});
      const sd = ctx.slider({label:"Corrected posterior SD",...ctx.key("sd"),onInput:v=>ctx.set({sd:v})});
      const tau = ctx.slider({label:"Withholding cost τ",...ctx.key("tau"),onInput:v=>ctx.set({tau:v})});
      const cap = ctx.select({label:"At most this many grades",name:"cap",options:[...[2,3,4,5,6].map(g=>({value:g,label:String(g)})),{value:"all",label:"All reports (no cap)"}],value:ctx.state.cap,onChange:v=>ctx.set({cap:v})});
      ctx.controls.append(data.root,unit.root,mode.root);
      // review 044 repair (X-01, frame step 4): score, grade cap and τ, which every preset sets, are in a closed
      // Settings box in the controls row, so the corrected value and the result come first on phones
      ctx.disclosure({name:"settings",title:"Settings",placement:"controls"}).body.append(score.root,cap.root,tau.root);
      const inputLine = h("p",{class:"oc-note oc-input-line"});
      // the corrected mean or SD, and the line that compares the correction with the
      // original: after the preset row (base.js afterPresets), since which slider shows depends on the change (X-18; 1.9)
      ctx.afterPresets(mean.root,sd.root,inputLine);
      ctx.primaryControl(mean.root);ctx.primaryControl(sd.root);
      const cards = ["Before correction","After correction"].map(title=>({
        root:h("section",{class:"oc-panel prx-light-panel","aria-label":title}),chart:h("div"),slots:[],header:h("p"),legend:h("div"),marker:h("p",{class:"oc-note"})
      }));
      cards.forEach((c,k)=>c.root.append(ctx.panelTitle(k===0?"Before correction":"After correction"),c.header,c.chart,c.marker,c.legend));
      const matrix = h("div",{class:"prx-rb-matrix-chart"}), matrixLegend=h("div",{class:"prx-rb-legend","data-prx-part":"legend"});
      const changedList=h("div"),counts=h("p"),tableWrap=h("div");
      // X-14: the list in a bounded box under its count (the box is a keyboard stop while it scrolls: syncListStop)
      const listBox=h("div",{class:"oc-list"},tableWrap);
      changedList.append(ctx.panelTitle("Pairs between untouched units"),counts,listBox);
      // X-09 (league): the pinned copies of the row and column labels and the corner sit before the matrix, in a wrapper
      // as wide as the matrix
      const pin=h("div",{class:"oc-pin","aria-hidden":"true",hidden:true});
      const colPin=h("div",{class:"oc-colpin","aria-hidden":"true",hidden:true});
      const corner=h("div",{class:"oc-corner","aria-hidden":"true",hidden:true},h("span"));
      const matrixInner=h("div",{class:"oc-matrix-inner"},corner,colPin,pin,matrix);
      const matrixWrap=ctx.scrollRegion(h("div",{class:"oc-scroll"},matrixInner),"All common-unit relations; scroll horizontally to inspect every unit",{stickyLabels:true});
      ctx.listen(matrixWrap,"scroll",()=>matrixWrap.classList.toggle("oc-scrolled-y",matrixWrap.scrollTop>1),{passive:true});
      const matrixPanel=h("section",{class:"oc-panel prx-light-panel"},ctx.panelTitle("After-report relations; outlines mark changes"),matrixWrap,matrixLegend,
        h("p",{class:"oc-note",text:"Each pair appears twice, once in each triangle. Only units present in both reports enter this comparison."}));
      const policy=h("p",{class:"oc-order-note"});
      const progress=h("p",{class:"oc-note",hidden:true},"Drawing the complete reports and common-unit relation matrix…");
      const tiedNote=h("p",{class:"oc-note"}),tieTable=ctx.scrollRegion(h("div",{class:"oc-scroll"}),"Every tied before and after report combination"),ties=h("section",{},ctx.panelTitle("All smallest-risk report combinations"),tiedNote,tieTable);
      const changesPanel=h("section",{class:"oc-panel prx-light-panel"},changedList);
      // X-01: the cards the correction changes come directly under the read-out (base.js primaryGraphic); the policy
      // line (score, cap, or the league's order) follows the matrix and the list, before the tie table
      const cardsRow=ctx.primaryGraphic(h("div",{class:"oc-cards"},...cards.map(c=>c.root)));
      policy.classList.add("oc-policy-after");
      ctx.charts.append(progress,cardsRow,h("div",{class:"oc-matrix-area"},matrixPanel,changesPanel),policy,ties);
      ctx.scrollRegion(tableWrap,"Changed relations between untouched units");
      /** The list box is a keyboard stop (with its name) only while it scrolls (the league's 107 rows). */
      const LIST_LABEL="Changed relations between untouched units; the list scrolls";
      function syncListStop(){
        if(!listBox.isConnected)return;
        const over=listBox.scrollHeight>listBox.clientHeight+1;
        if(over){listBox.setAttribute("tabindex","0");listBox.setAttribute("role","region");listBox.setAttribute("aria-label",LIST_LABEL);}
        else if(ctx.doc.activeElement!==listBox){for(const a of ["tabindex","role","aria-label"])listBox.removeAttribute(a);}
      }
      /** X-09 (league only): copies of the matrix's row labels (pinned at the box's left edge) and column labels (pinned
       *  at its top), aria-hidden: the matrix keeps its own labels, keyboard reader and table. */
      const PIN_SKIP=/^(?:width|height|viewBox|role|aria-[\w-]+|id|tabindex)$/;
      const SVG_NS="http://www.w3.org/2000/svg";
      const labelCopy=(figure,labels,w,hh)=>{
        const copy=ctx.doc.createElementNS(SVG_NS,"svg");
        for(const a of Array.from(figure.svg.attributes))if(!PIN_SKIP.test(a.name))copy.setAttribute(a.name,a.value);
        copy.setAttribute("width",String(w));copy.setAttribute("height",String(hh));
        copy.setAttribute("viewBox",`0 0 ${w} ${hh}`);copy.setAttribute("aria-hidden","true");
        // the copied inline style keeps the plot's own settings; the copy paints the plot panel's paper over what it covers
        copy.style.width=`${w}px`;copy.style.height=`${hh}px`;copy.style.background="var(--prx-plot-bg)";
        copy.append(labels.cloneNode(true));
        return copy;
      };
      function pinLabels(figure,on){
        const rows=on?figure?.figure?.querySelector('g[aria-label="y-axis tick label"]'):null;
        const cols=on?figure?.figure?.querySelector('g[aria-label="x-axis tick label"]'):null;
        const geo=figure?.relationGeometry;
        matrixWrap.classList.toggle("oc-league-scroll",Boolean(on));
        if(!rows||!cols||!figure?.svg||!geo){
          for(const n of [pin,colPin])n.replaceChildren();
          pin.hidden=colPin.hidden=corner.hidden=true;
          matrixWrap.style.removeProperty("scroll-padding-left");matrixWrap.style.removeProperty("scroll-padding-top");
          return;
        }
        pin.style.width=`${geo.marginLeft}px`;pin.replaceChildren(labelCopy(figure,rows,geo.marginLeft,geo.height));
        colPin.style.width=`${geo.width}px`;colPin.replaceChildren(labelCopy(figure,cols,geo.width,geo.marginTop));
        corner.style.width=`${geo.marginLeft}px`;
        Object.assign(corner.firstChild.style,{width:`${geo.marginLeft}px`,height:`${geo.marginTop}px`});
        pin.hidden=colPin.hidden=corner.hidden=false;
        matrixWrap.style.scrollPaddingLeft=`${geo.marginLeft}px`;matrixWrap.style.scrollPaddingTop=`${geo.marginTop}px`;
      }
      /** A keyboard move to a cell outside the bounded box scrolls it into view, clear of the pinned labels (the box's
       *  scroll padding). It runs before chart.js places the keyboard tip, so the tip is placed in the scrolled box. */
      const revealCell=(d)=>{
        if(!matrixWrap.classList.contains("oc-league-scroll"))return;
        matrix.querySelector(".prx-kbd-point:focus")?.scrollIntoView({block:"nearest",inline:"nearest"});
        if(d?.i===0)matrixWrap.scrollTop=0;
        if(d?.j===0)matrixWrap.scrollLeft=0;
      };
      const scope=h("p",{class:"oc-note"});
      const exclusion=h("p",{class:"oc-note"},"A removed unit is unassessed here, not placed in the lowest grade. ",appLink(ctx,"report-designer",{title:"Grade a case and report it"})," explains how to report excluded units (its excluded-unit note)." );
      ctx.caption.replaceChildren(scope,exclusion,captionNode(ctx,"teaching-posterior"));
      function drawCard(c,ids,means,sds,result,key,domain,state,model) {
        while(c.slots.length<model.criteria.length){const box=h("div"),slot=h("div");box.append(ctx.panelTitle(criterionName(model.criteria[c.slots.length])),slot);c.chart.append(box);c.slots.push({box,slot});}
        c.slots.forEach((x,k)=>{x.box.hidden=k>=model.criteria.length;if(k<model.criteria.length)x.box.firstChild.textContent=criterionName(model.criteria[k]);});
        const selected=ids.indexOf(state.unit);let out;
        for(let k=0;k<model.criteria.length;k++){
          const card=gaussianCard({ids,names:ids.map(id=>model.league?id:`Site ${id}`),mean:means.map(row=>row[k]),sd:sds.map(row=>row[k]),axis:`${criterionName(model.criteria[k])}, posterior value`,grade1:"Grade 1 = stated highest, as the posterior judges it. Same grade: not compared.",unit:model.unit,units:model.units,title:`${key==="before"?"Original":"Corrected"} report, ${criterionName(model.criteria[k])}`,storedOrder:"input"});
          out=drawReportCard(c.slots[k].slot,card,{grade:Array.from(result.grade),order:"grade",domain,selected:selected<0?undefined:selected});
        }
        c.marker.hidden=selected<0;c.marker.replaceChildren(h("span",{class:"oc-ring","aria-hidden":"true"}),state.mode==="drop"?`Ring: unit removed from the second report, ${state.unit}.`:`Ring: correction target, ${state.unit}.`);
        c.legend.replaceChildren(gradeLegend(ctx.doc,{grade:Array.from(result.grade),colors:out.colors,unit:model.unit,units:model.units,grade1:"Grade 1 = stated highest. Same grade: not compared."}));
        const vector=ro(`${key}Grade`,Array.from(result.grade),formatGrades(Array.from(result.grade)));vector.classList.add("oc-grade-vector");
        const tag=tagNode(ctx,result,{key,orderWords:model.league?"expected-rank order":undefined});tag.querySelector("[data-prx-family-size]")?.setAttribute("data-prx-readout",`${key}FamilySize`);
        c.header.replaceChildren(tag,model.league?"; grade ":"; report in input order "+ids.join(", ")+": ",model.league?ro(`${key}Sizes`,disclosure(result.grade).sizes,formatSizes(disclosure(result.grade).sizes)):vector,".");
        if(!model.league)c.header.append(" Grade ",ro(`${key}Sizes`,disclosure(result.grade).sizes,formatSizes(disclosure(result.grade).sizes)),".");
        if(model.league)c.header.append(h("span",{class:"prx-sr-only"}," Grade vector in input order ",ids.join(", "),": ",vector));
        if(model.league)c.header.append(" Expected-rank order is recomputed for this population.",
          h("span",{class:"prx-sr-only"}," ",labelNode(ctx,result,{key:`${key}-order`})," (",familySizeNode(ctx,result)," contiguous reports)."));
        c.header.append(" N = ",ro(`${key}N`,result.N,formatCount(result.N)),"; risk ",ro(`${key}Risk`,result.risk,formatRisk(result.risk)),".");
        if(result.tieCount>1)c.header.append(" ",ro(`${key}TieCount`,result.tieCount,formatCount(result.tieCount))," reports share the smallest risk; this card shows the first (equal-risk tolerance ",ctx.num(result.tieTol,formatSci(result.tieTol)),").");
      }
      return {render(state) {
        const token=++renderToken;
        const model=correctionModel(state),restricted=model.league||state.score==="AB";
        if(!model.ids.includes(state.unit)){ctx.set({unit:model.league?"U15":"C"});return;}
        if(restricted&&state.mode!=="drop"){ctx.set({mode:"drop"});return;}
        if(model.league&&(state.cap!=="all"||state.score!=="A")){ctx.set({cap:"all",score:"A"});return;}
        // score and cap keep their slots in the Settings box in league mode (shown disabled: the league uses score A
        // and no cap), so an open box keeps its height when a preset switches the population
        data.set(state.data);score.set(state.score);score.setDisabled(model.league);unit.set(state.unit);mode.set(state.mode);mode.setDisabled(restricted);mean.set(state.mean);sd.set(state.sd);tau.set(state.tau);cap.set(state.cap);cap.setDisabled(model.league);
        [...unit.input.options].forEach((option,i)=>{option.hidden=!model.ids.includes(ALL_IDS[i]);option.disabled=option.hidden;});
        mean.root.hidden=state.mode!=="mean";sd.root.hidden=state.mode!=="sd";
        const r=correctionResult(state),index=model.ids.indexOf(state.unit);
        inputLine.replaceChildren(state.mode==="drop"?`${state.unit} is removed from the second report.`:`Site ${state.unit}, ${criterionName(model.criteria[0])}: original posterior mean `,
          ...(state.mode==="drop"?[]:[ctx.num(model.mean[index][0],formatDecimal(model.mean[index][0],{digits:2})),", SD ",ctx.num(model.sd[index][0],formatDecimal(model.sd[index][0],{digits:2})),"; corrected ",state.mode==="mean"?"mean ":"SD ",ctx.num(state[state.mode],formatDecimal(state[state.mode],{digits:2})),"."]));
        if(model.league)policy.replaceChildren("Simulated league from seed ",ctx.num(LEAGUE_SEED,formatSetting(LEAGUE_SEED)),"; normal prior SD ",ctx.num(.15,formatDecimal(.15,{digits:2})),". We compute a new expected-rank order for each population and find its best contiguous cuts without a cap. Each optimum is specific to its own order.");
        else policy.replaceChildren(...[state.score==="AB"?["Scores A and B have equal weights ",ctx.num(.5,formatDecimal(.5,{digits:1}))," and ",ctx.num(.5,formatDecimal(.5,{digits:1})),". Both marginal-card views show this same joint report. "]:["Only ",criterionName(model.criteria[0])," determines the report and its corrected marginal. "],state.cap==="all"?"Every report in the full family is evaluated.":["Every report with at most ",ctx.num(state.cap,formatCount(state.cap))," grades is evaluated."],state.score==="AB"?" Choose one score to correct a marginal instead of dropping a unit.":""].flat(Infinity));
        const intervals=[...model.mean.flatMap((row,i)=>row.map((m,k)=>normalInterval(m,model.sd[i][k],.9))),...r.mean.flatMap((row,i)=>row.map((m,k)=>normalInterval(m,r.sd[i][k],.9)))];
        const lo=Math.min(...intervals.map(v=>v.lower)),hi=Math.max(...intervals.map(v=>v.upper)),pad=.04*(hi-lo),domain=[lo-pad,hi+pad];
        matrix.classList.toggle("oc-matrix-wide",model.league);
        scope.replaceChildren(state.mode==="drop"?"Removing a unit leaves the other marginal posteriors in place. It changes the comparison population, which can change the expected-rank order. We calculate risk using the pair count for each population. ":`Only the selected ${criterionName(model.criteria[0])} marginal changes. `,"Every criterion's pair-error probabilities among untouched units are unchanged. Grade numbers themselves are labels. Lines show ",ctx.num(.9,formatPercent(.9))," marginal posterior intervals; all cards share one axis domain.");
        const hasTies=r.before.result.tieCount>1||r.after.tieCount>1;
        ties.hidden=!hasTies;
        if(hasTies){
          const bs=r.before.result.grades??[r.before.result.grade],as=r.after.grades??[r.after.grade],untouched=r.indices.filter(i=>i!==index),positions=untouched.map(i=>r.indices.indexOf(i));
          tiedNote.replaceChildren("Cards, matrix and headline use the first report on each side. This table compares every listed tied combination. Vectors use the input-ID orders printed on their cards; equal-risk tolerance ",ro("tieTolerance",r.after.tieTol,formatSci(r.after.tieTol)),".");
          if(r.before.result.tieCount===1)tiedNote.append(h("span",{class:"prx-sr-only","aria-hidden":"true"},ro("beforeTieCount",1,formatCount(1))));
          if(r.after.tieCount===1)tiedNote.append(h("span",{class:"prx-sr-only","aria-hidden":"true"},ro("afterTieCount",1,formatCount(1))));
          const combinations=[];
          for(const bg of bs)for(const ag of as){const k=combinations.length,common=relationChange(r.indices.map(i=>bg[i]),ag),other=relationChange(untouched.map(i=>bg[i]),positions.map(i=>ag[i]));
            combinations.push(h("tr",{},h("td",{},ro(`tie-beforeGrade-${k}`,Array.from(bg),formatGrades(Array.from(bg)))),h("td",{},ro(`tie-afterGrade-${k}`,Array.from(ag),formatGrades(Array.from(ag)))),h("td",{},ro(`tie-commonChanged-${k}`,common.pairs.length,formatCount(common.pairs.length))),h("td",{},ro(`tie-untouchedChanged-${k}`,other.pairs.length,formatCount(other.pairs.length)))));
          }
          tieTable.replaceChildren(h("table",{class:"oc-table oc-ties-table prx-sticky-first"},h("thead",{},h("tr",{},...[
            "Before grade vector","After grade vector","Changed common relations","Changed untouched relations"].map(text=>h("th",{scope:"col",text})))),h("tbody",{},...combinations)));
          if(bs.length<r.before.result.tieCount||as.length<r.after.tieCount)tiedNote.append(" The engine's tied-report list is truncated; additional tied reports are not shown.");
        }
        const otherIds=r.ids.filter(id=>id!==state.unit);
        const pairLabel=p=>`${otherIds[p.i]}–${otherIds[p.j]}`;
        const firstPairs=r.other.pairs.slice(0,4), more=r.other.pairs.length-firstPairs.length;
        const chips=firstPairs.map(p=>h("span",{class:"oc-change-chip","data-prx-name":"",text:pairLabel(p)}));
        ctx.readout.set([hasTies?"First representatives: ":"",state.mode==="drop"?"Removing ":"Correcting ",state.unit,
          " changes ",ro("otherChanged",r.other.pairs.length,formatCount(r.other.pairs.length))," of ",ro("otherPairs",r.other.M,formatCount(r.other.M))," pairs between units whose inputs stayed fixed.",
          ...(chips.length?[h("span",{class:"oc-change-chips","aria-label":"Changed pairs between untouched units"},...chips,more?h("span",{},"and ",ctx.num(more,formatCount(more))," more"):null)]:[]),
          " Across all common units, ",ro("changed",r.delta.pairs.length,formatCount(r.delta.pairs.length))," of ",ro("commonPairs",r.delta.M,formatCount(r.delta.M))," relations change: ",
          ro("newWithheld",r.delta.nNewWithheld,formatCount(r.delta.nNewWithheld))," newly withheld, ",ro("newDisclosed",r.delta.nNewDisclosed,formatCount(r.delta.nNewDisclosed))," newly stated, ",ro("reversed",r.delta.nReversed,formatCount(r.delta.nReversed))," reversed."]);
        const finish=()=>{
        const cells=new Set();for(const p of r.delta.pairs){cells.add(`${p.i},${p.j}`);cells.add(`${p.j},${p.i}`);}
        // the renderer measures the room the box gives (G1-F4); the league wrapper grows to the matrix's width only after
        // the drawing, so a direct load and a switch from the six sites give the same 30 px cells
        matrixInner.classList.remove("oc-league");
        const figure=drawRelationMatrix(ctx,matrix,matrixLegend,{n:r.ids.length,ids:r.ids,g:Array.from(r.after.grade)},{changed:{after:Array.from(r.after.grade),cells},onFocus:revealCell});
        matrixInner.classList.toggle("oc-league",model.league);
        pinLabels(figure,model.league);
        const outline=matrixLegend.querySelector('.prx-rb-swatch-outline');if(outline)outline.parentNode.lastChild.textContent="outline: changed from the original report";
        const words=(v,a,b)=>v==="withheld"?"withheld":v==="above"?`${a} above ${b}`:`${b} above ${a}`;
        const rows=r.other.pairs.map(p=>h("tr",{},h("th",{scope:"row",text:pairLabel(p)}),h("td",{text:words(p.from,otherIds[p.i],otherIds[p.j])}),h("td",{text:words(p.to,otherIds[p.i],otherIds[p.j])})));
        tableWrap.hidden=!rows.length;
        tableWrap.replaceChildren(h("table",{class:"oc-table"},h("thead",{},h("tr",{},...["Pair","Before","After"].map(t=>h("th",{scope:"col",text:t})))),h("tbody",{},...rows)));
        counts.replaceChildren(ctx.num(r.other.pairs.length,formatCount(r.other.pairs.length))," of ",ctx.num(r.other.M,formatCount(r.other.M))," pairs between untouched units changed. Largest change in their pair-error probabilities: ",ro("coefficientGap",r.coefficientGap,formatDecimal(r.coefficientGap,{digits:0})),". By criterion: ",...r.coefficientGaps.flatMap((v,k)=>[k?"; ":"",criterionName(model.criteria[k])," ",ro(`coefficientGap-${k}`,v,formatDecimal(v,{digits:0}))]),".",rows.length?"":" None of their relations changed.");

          progress.hidden=true;ctx.root.removeAttribute("aria-busy");
          ctx.win.setTimeout(syncListStop,0);
        };
        if(model.league){
          ctx.root.setAttribute("aria-busy","true");progress.hidden=false;
          ctx.timeout(()=>{if(token!==renderToken)return;drawCard(cards[0],model.ids,model.mean,model.sd,r.before.result,"before",domain,state,model);
            ctx.timeout(()=>{if(token!==renderToken)return;drawCard(cards[1],r.ids,r.mean,r.sd,r.after,"after",domain,state,model);
              ctx.timeout(()=>{if(token===renderToken)finish();},0);
            },0);
          },0);
        }else{
          drawCard(cards[0],model.ids,model.mean,model.sd,r.before.result,"before",domain,state,model);
          drawCard(cards[1],r.ids,r.mean,r.sd,r.after,"after",domain,state,model);finish();
        }


      }};
    }
  });
}
