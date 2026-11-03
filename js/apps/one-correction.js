import { appLink, createWidget } from "../shared/base.js";
import { formatCount, formatDecimal, formatGrades, formatPercent, formatSci, formatSizes, formatRisk } from "../shared/format.js";
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
.oc .oc-matrix-wide {min-width:56rem;margin-left:.5rem;}
.oc .oc-matrix-wide svg {overflow:visible;}
.oc .oc-ties-table {min-width:30rem;table-layout:fixed;}
.oc .oc-ties-table th {overflow-wrap:normal;word-break:normal;}
.oc .oc-grade-vector {white-space:normal;overflow-wrap:anywhere;}
.oc .oc-order-note {border-left:3px solid var(--prx-accent);padding:.5rem .75rem;margin:.5rem 0;}
.oc .oc-ring {display:inline-block;width:.8em;height:.8em;border:2px solid var(--prx-plot-fg);border-radius:50%;vertical-align:-.1em;margin-right:.3em;}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "one-correction", title: "One correction moves other grades", className: "oc prx-rc prx-rb", css: CSS,
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
      ctx.controls.append(data.root,score.root,unit.root,mode.root,mean.root,sd.root,tau.root,cap.root);
      const inputLine = h("p",{class:"oc-note"});
      const cards = ["Before correction","After correction"].map(title=>({
        root:h("section",{class:"oc-panel prx-light-panel","aria-label":title}),chart:h("div"),slots:[],header:h("p"),legend:h("div"),marker:h("p",{class:"oc-note"})
      }));
      cards.forEach((c,k)=>c.root.append(ctx.panelTitle(k===0?"Before correction":"After correction"),c.header,c.chart,c.marker,c.legend));
      const matrix = h("div",{class:"prx-rb-matrix-chart"}), matrixLegend=h("div",{class:"prx-rb-legend","data-prx-part":"legend"});
      const changedList=h("div"),counts=h("p"),tableWrap=h("div");
      changedList.append(ctx.panelTitle("Pairs between untouched units"),counts,tableWrap);
      const matrixWrap=ctx.scrollRegion(h("div",{class:"oc-scroll"},matrix),"All common-unit relations; scroll horizontally to inspect every unit");
      const matrixPanel=h("section",{class:"oc-panel prx-light-panel"},ctx.panelTitle("After-report relations; outlines mark changes"),matrixWrap,matrixLegend,
        h("p",{class:"oc-note",text:"Each pair appears twice, once in each triangle. Only units present in both reports enter this comparison."}));
      const policy=h("p",{class:"oc-order-note"});
      const progress=h("p",{class:"oc-note",hidden:true},"Drawing the complete reports and common-unit relation matrix…");
      const tiedNote=h("p",{class:"oc-note"}),tieTable=ctx.scrollRegion(h("div",{class:"oc-scroll"}),"Every tied before and after report combination"),ties=h("section",{},ctx.panelTitle("All smallest-risk report combinations"),tiedNote,tieTable);
      const changesPanel=h("section",{class:"oc-panel prx-light-panel"},changedList);
      ctx.charts.append(inputLine,policy,ctx.readout.node,progress,h("div",{class:"oc-cards"},...cards.map(c=>c.root)),h("div",{class:"oc-matrix-area"},matrixPanel,changesPanel),ties);
      ctx.scrollRegion(tableWrap,"Changed relations between untouched units");
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
        if(model.league)c.header.append(" ",labelNode(ctx,result,{key:`${key}-order`})," (",familySizeNode(ctx,result)," contiguous reports; expected-rank order recomputed for this population).");
        c.header.append(" N = ",ro(`${key}N`,result.N,formatCount(result.N)),"; risk ",ro(`${key}Risk`,result.risk,formatRisk(result.risk)),".");
        if(result.tieCount>1)c.header.append(" ",ro(`${key}TieCount`,result.tieCount,formatCount(result.tieCount))," reports share the smallest risk; this card shows the first (equal-risk tolerance ",ctx.num(result.tieTol,formatSci(result.tieTol)),").");
      }
      return {render(state) {
        const token=++renderToken;
        const model=correctionModel(state),restricted=model.league||state.score==="AB";
        if(!model.ids.includes(state.unit)){ctx.set({unit:model.league?"U15":"C"});return;}
        if(restricted&&state.mode!=="drop"){ctx.set({mode:"drop"});return;}
        if(model.league&&(state.cap!=="all"||state.score!=="A")){ctx.set({cap:"all",score:"A"});return;}
        data.set(state.data);score.set(state.score);score.root.hidden=model.league;unit.set(state.unit);mode.set(state.mode);mode.setDisabled(restricted);mean.set(state.mean);sd.set(state.sd);tau.set(state.tau);cap.set(state.cap);cap.root.hidden=model.league;
        [...unit.input.options].forEach((option,i)=>{option.hidden=!model.ids.includes(ALL_IDS[i]);option.disabled=option.hidden;});
        mean.root.hidden=state.mode!=="mean";sd.root.hidden=state.mode!=="sd";
        const r=correctionResult(state),index=model.ids.indexOf(state.unit);
        inputLine.replaceChildren(state.mode==="drop"?`${state.unit} is removed from the second report.`:`Site ${state.unit}, ${criterionName(model.criteria[0])}: original posterior mean `,
          ...(state.mode==="drop"?[]:[ctx.num(model.mean[index][0],formatDecimal(model.mean[index][0],{digits:2})),", SD ",ctx.num(model.sd[index][0],formatDecimal(model.sd[index][0],{digits:2})),"; corrected ",state.mode==="mean"?"mean ":"SD ",ctx.num(state[state.mode],formatDecimal(state[state.mode],{digits:2})),"."]));
        if(model.league)policy.replaceChildren("Frozen simulated league, seed ",ctx.num(LEAGUE_SEED,formatCount(LEAGUE_SEED)),"; normal prior SD ",ctx.num(.15,formatDecimal(.15,{digits:2})),". Each population gets its own expected-rank order and best contiguous cuts, with no grade cap. This is optimal within the declared order, not an unrestricted optimum.");
        else policy.replaceChildren(...[state.score==="AB"?["Scores A and B have equal weights ",ctx.num(.5,formatDecimal(.5,{digits:1}))," and ",ctx.num(.5,formatDecimal(.5,{digits:1})),". Both marginal-card views show this same joint report. "]:["Only ",criterionName(model.criteria[0])," determines the report and its corrected marginal. "],state.cap==="all"?"Every report in the full family is evaluated.":["Every report with at most ",ctx.num(state.cap,formatCount(state.cap))," grades is evaluated."],state.score==="AB"?" Choose one score to correct a marginal instead of dropping a unit.":""].flat(Infinity));
        const intervals=[...model.mean.flatMap((row,i)=>row.map((m,k)=>normalInterval(m,model.sd[i][k],.9))),...r.mean.flatMap((row,i)=>row.map((m,k)=>normalInterval(m,r.sd[i][k],.9)))];
        const lo=Math.min(...intervals.map(v=>v.lower)),hi=Math.max(...intervals.map(v=>v.upper)),pad=.04*(hi-lo),domain=[lo-pad,hi+pad];
        matrix.classList.toggle("oc-matrix-wide",model.league);
        scope.replaceChildren(state.mode==="drop"?"Removing a unit retains every remaining marginal, but changes the comparison population and may change its expected-rank order. Each risk uses its own population’s pair count. ":`Only the selected ${criterionName(model.criteria[0])} marginal changes. `,"Every criterion's pair-error probabilities among untouched units are unchanged. Grade numbers themselves are labels. Lines show ",ctx.num(.9,formatPercent(.9))," marginal posterior intervals; all cards share one axis domain.");
        const hasTies=r.before.result.tieCount>1||r.after.tieCount>1;
        ties.hidden=!hasTies;
        if(hasTies){
          const bs=r.before.result.grades??[r.before.result.grade],as=r.after.grades??[r.after.grade],untouched=r.indices.filter(i=>i!==index),positions=untouched.map(i=>r.indices.indexOf(i));
          tiedNote.replaceChildren("Cards, matrix and headline use the first report on each side. This table compares every listed tied combination. Vectors use the input-ID orders printed on their cards; equal-risk tolerance ",ro("tieTolerance",r.after.tieTol,formatSci(r.after.tieTol)),".");
          if(r.before.result.tieCount===1)tiedNote.append(h("span",{class:"prx-sr-only"},ro("beforeTieCount",1,formatCount(1))));
          if(r.after.tieCount===1)tiedNote.append(h("span",{class:"prx-sr-only"},ro("afterTieCount",1,formatCount(1))));
          const combinations=[];
          for(const bg of bs)for(const ag of as){const k=combinations.length,common=relationChange(r.indices.map(i=>bg[i]),ag),other=relationChange(untouched.map(i=>bg[i]),positions.map(i=>ag[i]));
            combinations.push(h("tr",{},h("td",{},ro(`tie-beforeGrade-${k}`,Array.from(bg),formatGrades(Array.from(bg)))),h("td",{},ro(`tie-afterGrade-${k}`,Array.from(ag),formatGrades(Array.from(ag)))),h("td",{},ro(`tie-commonChanged-${k}`,common.pairs.length,formatCount(common.pairs.length))),h("td",{},ro(`tie-untouchedChanged-${k}`,other.pairs.length,formatCount(other.pairs.length)))));
          }
          tieTable.replaceChildren(h("table",{class:"oc-table oc-ties-table"},h("thead",{},h("tr",{},...[
            "Before grade vector","After grade vector","Changed common relations","Changed untouched relations"].map(text=>h("th",{scope:"col",text})))),h("tbody",{},...combinations)));
          if(bs.length<r.before.result.tieCount||as.length<r.after.tieCount)tiedNote.append(" The engine's tied-report list is truncated; additional tied reports are not shown.");
        }
        ctx.readout.set([hasTies?"First representatives: ":"",state.mode==="drop"?"Removing ":"Correcting ",state.unit," changes ",ro("changed",r.delta.pairs.length,formatCount(r.delta.pairs.length))," of ",ro("commonPairs",r.delta.M,formatCount(r.delta.M))," relations among common units: ",ro("newWithheld",r.delta.nNewWithheld,formatCount(r.delta.nNewWithheld))," newly withheld, ",ro("newDisclosed",r.delta.nNewDisclosed,formatCount(r.delta.nNewDisclosed))," newly stated, ",ro("reversed",r.delta.nReversed,formatCount(r.delta.nReversed))," reversed. ",ctx.num(r.other.pairs.length,formatCount(r.other.pairs.length))," changes are between units whose inputs stayed fixed."]);
        const finish=()=>{
        const cells=new Set();for(const p of r.delta.pairs){cells.add(`${p.i},${p.j}`);cells.add(`${p.j},${p.i}`);}
        drawRelationMatrix(ctx,matrix,matrixLegend,{n:r.ids.length,ids:r.ids,g:Array.from(r.after.grade)},{changed:{after:Array.from(r.after.grade),cells}});
        const outline=matrixLegend.querySelector('.prx-rb-swatch-outline');if(outline)outline.parentNode.lastChild.textContent="outline: changed from the original report";
        const otherIds=r.ids.filter(id=>id!==state.unit);
        const words=(v,a,b)=>v==="withheld"?"withheld":v==="above"?`${a} above ${b}`:`${b} above ${a}`;
        const rows=r.other.pairs.map(p=>h("tr",{},h("th",{scope:"row",text:`${otherIds[p.i]}–${otherIds[p.j]}`}),h("td",{text:words(p.from,otherIds[p.i],otherIds[p.j])}),h("td",{text:words(p.to,otherIds[p.i],otherIds[p.j])})));
        tableWrap.hidden=!rows.length;
        tableWrap.replaceChildren(h("table",{class:"oc-table"},h("thead",{},h("tr",{},...["Pair","Before","After"].map(t=>h("th",{scope:"col",text:t})))),h("tbody",{},...rows)));
        counts.replaceChildren(ro("otherChanged",r.other.pairs.length,formatCount(r.other.pairs.length))," of ",ro("otherPairs",r.other.M,formatCount(r.other.M))," pairs between untouched units changed. Largest change in their pair-error probabilities: ",ro("coefficientGap",r.coefficientGap,formatDecimal(r.coefficientGap,{digits:0})),". By criterion: ",...r.coefficientGaps.flatMap((v,k)=>[k?"; ":"",criterionName(model.criteria[k])," ",ro(`coefficientGap-${k}`,v,formatDecimal(v,{digits:0}))]),".",rows.length?"":" None of their relations changed.");

          progress.hidden=true;ctx.root.removeAttribute("aria-busy");
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
