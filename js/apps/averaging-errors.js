// Chapter 16: averaging disclosed-error fractions over a report kernel or replicated datasets.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatEoverN, formatExpectedCount, formatRational, formatSetting, formatShare } from "../shared/format.js";
import { disclosedErrorEstimands, evaluateReport, leagueGradingReplays, pairCount, familySize } from "../pr-core.js";

import { modelOf } from "./frontier.js";

const NAMES = ["Pooled pairs", "Disclosing outcomes", "Zero-imputed mean"];
const finiteShare = v => { if(v===null)return formatEoverN(null);try{return formatRational(v,{maxDenominator:10000});}catch{return formatShare(v);} };
const FIELDS = ["ERR", "meanFraction", "zeroImputed"];
const CSS = `.avgerr .avgerr-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr)); gap:.75rem; }
.avgerr .avgerr-card { min-width:0; padding:.6rem; border:1px solid var(--prx-border); border-radius:6px; }
.avgerr .avgerr-card legend { font-size:1rem; margin:0 0 .4rem; }
.avgerr .avgerr-note { font-size:.9rem; color:var(--prx-fg-muted); margin:.5rem 0; }
.avgerr .avgerr-table { width:100%; min-width:30rem; border-collapse:collapse; font-variant-numeric:tabular-nums; }
.avgerr .avgerr-table th { white-space:nowrap; }
.avgerr .avgerr-table th,.avgerr .avgerr-table td { padding:.3rem .45rem; text-align:left; border-bottom:1px solid var(--prx-border); }
.avgerr .avgerr-scroll { max-height:22rem; overflow:auto; }
.avgerr .avgerr-result { margin:.5rem 0; }
.avgerr .avgerr-figure { min-width:0; }
`;
const replayCache = new Map();
let mixtureModel;
function mixedReports() {
  if (!mixtureModel) { const m=modelOf("tb16","all"); mixtureModel={ m, vertices:[m.hull.find(v=>v.N===3),m.hull.find(v=>v.N===5)] }; }
  return mixtureModel;
}

export function averagingResult(s) {
  if (s.mode === "mixture") {
    const {m,vertices}=mixedReports();
    const weights=[s.psi,1-s.psi];
    const counts=vertices.map(v=>evaluateReport(v.grade,m.E,{tau:.25,w:m.opts.w}));
    const cases=counts.map((v,i)=>({A:v.Ew,N:v.N,probability:weights[i],share:v.EwOverN,grade:vertices[i].grade}));
    for(const d of cases)d.share=disclosedErrorEstimands([{A:d.A,N:d.N}],{M:m.M}).ERR;
    return {cases,M:m.M,ids:m.E.ids,result:disclosedErrorEstimands(cases.map(({A,N})=>({A,N})),{M:m.M,weights})};
  }
  if (s.mode === "replays") {
    const key = [s.seed,s.replays,s.priorSd,s.tau,s.cap].join("|");
    if (!replayCache.has(key)) {
      if (replayCache.size >= 32) replayCache.delete(replayCache.keys().next().value);
      replayCache.set(key, leagueGradingReplays(s.seed, { replays:s.replays, priorSd:s.priorSd, tau:s.tau, cap:s.cap }));
    }
    const r = replayCache.get(key);
    return { cases:r.draws.map(d => ({ A:d.D, N:d.N, probability:1/r.replays, share:d.DoverN })), M:pairCount(30), result:r.estimands };
  }
  const raw = [s.w1,s.w2,s.w3];
  const total = raw.reduce((a,b) => a+b,0);
  const weights = raw.map(w => w/total);
  const cases = [1,2,3].map((i,k) => ({ A:Math.min(s[`a${i}`],s[`n${i}`]), N:s[`n${i}`], probability:weights[k] }));
  for (const d of cases) d.share = disclosedErrorEstimands([{A:d.A,N:d.N}], { M:pairCount(3) }).ERR;
  return { cases, M:pairCount(3), result:disclosedErrorEstimands(cases.map(({A,N})=>({A,N})), { M:pairCount(3), weights }) };
}

export function mountWidget(el,spec={}) {
  return createWidget(el,spec,{
    name:"averaging-errors",title:"Three ways to average an error share",className:"avgerr",css:CSS,
    keys:{
      mode:{type:"choice",values:["kernel","mixture","replays"],value:"kernel"},
      ...Object.fromEntries([1,2,3].flatMap((i,k) => [
        [`a${i}`,{type:"integer",min:0,max:3,value:[2,0,0][k]}],
        [`n${i}`,{type:"choice",values:[0,2,3],value:[2,3,0][k]}],
        [`w${i}`,{type:"number",min:0,max:10,step:.25,value:1}],
      ])),
      psi:{type:"number",min:0,max:1,step:.05,value:.25},
      seed:{type:"integer",min:0,max:99999999,value:20261030},
      replays:{type:"choice",values:[3,5,20,100],value:20},
      priorSd:{type:"number",min:.02,max:.5,step:.01,value:.15},
      tau:{type:"number",min:.02,max:.5,step:.01,value:.2},
      cap:{type:"integer",min:1,max:5,value:3},
    },
    build(ctx) {
      const {h}=ctx;
      const ro=(name,value,fmt=formatShare)=>{const n=ctx.num(value,fmt(value));n.dataset.prxReadout=name;return n;};
      const mode=ctx.segmented({label:"Average over",options:[{value:"kernel",label:"Three outcomes"},{value:"mixture",label:"Randomized reports"},{value:"replays",label:"Replicated datasets"}],value:ctx.state.mode,onChange:v=>ctx.set({mode:v})});
      ctx.controls.append(mode.root);
      const manual=h("section",{"aria-label":"Three possible outcomes",class:"avgerr-cards"});
      const editors=[1,2,3].map(i=>{
        const a=ctx.numberInput({label:"Wrong stated directions",...ctx.key(`a${i}`),onInput:v=>ctx.set({[`a${i}`]:Math.min(v,ctx.state[`n${i}`])})});
        const n=ctx.select({label:"Stated pairs",options:[{value:0,label:"None"},{value:2,label:"Two"},{value:3,label:"Three"}],value:ctx.state[`n${i}`],onChange:v=>ctx.set({[`n${i}`]:Number(v),[`a${i}`]:Math.min(ctx.state[`a${i}`],Number(v))})});
        const w=ctx.numberInput({label:"Relative probability weight",...ctx.key(`w${i}`),onInput:v=>ctx.set({[`w${i}`]:v})});
        const note=h("p",{class:"avgerr-note"});
        manual.append(h("fieldset",{class:"avgerr-card"},h("legend",{},"Outcome ",ctx.num(i,formatCount(i))),a.root,n.root,w.root,note));
        return {a,n,w,note};
      });
      const mixture=h("section",{"aria-label":"A lottery over two complete four-unit reports"});
      const psi=ctx.slider({label:"Chance of the first complete report",...ctx.key("psi"),format:finiteShare,onInput:v=>ctx.set({psi:v})});
      const mixtureText=h("div",{class:"avgerr-note"});
      mixture.append(psi.root,mixtureText);
      const replayControls=h("div",{class:"prx-controls"});
      const controlSpecs=[
        ["seed",ctx.numberInput({label:"Seed",...ctx.key("seed"),onInput:v=>ctx.set({seed:v})})],
        ["replays",ctx.select({label:"Datasets",options:[3,5,20,100].map(v=>({value:v,label:String(v)})),value:ctx.state.replays,onChange:v=>ctx.set({replays:Number(v)})})],
        ["priorSd",ctx.slider({label:"Assumed prior SD",...ctx.key("priorSd"),onInput:v=>ctx.set({priorSd:v})})],
        ["tau",ctx.slider({label:"Withholding cost τ",...ctx.key("tau"),onInput:v=>ctx.set({tau:v})})],
        ["cap",ctx.slider({label:"Maximum grades in each ordered cut",...ctx.key("cap"),onInput:v=>ctx.set({cap:v})})],
      ];
      for(const [,c] of controlSpecs) replayControls.append(c.root);
      ctx.controls.append(replayControls,mixture);
      const inputFeedback=h("p",{class:"avgerr-note",role:"status","data-prx-part":"input-feedback"});
      const fig=h("div",{class:"avgerr-figure"});
      const summary=h("div",{class:"avgerr-result"});
      const running=h("div",{class:"avgerr-figure"});
      const runningKey=h("p",{class:"avgerr-note"},"Solid: Pooled pairs; dashed: Disclosing outcomes; dotted: Zero-imputed mean.");
      const smallR=h("p",{class:"avgerr-note"});
      const explanation=h("p",{class:"avgerr-note"});
      const table=h("table",{class:"avgerr-table"});
      const scroll=h("div",{class:"avgerr-scroll"},table);
      ctx.scrollRegion(scroll,"Outcomes and their probabilities");
      ctx.controls.after(ctx.readout.node);
      ctx.charts.append(fig,inputFeedback,manual,summary,smallR,running,runningKey,explanation,scroll);
      return {render(s){
        const fix={}; for(const i of [1,2,3])if(s[`a${i}`]>s[`n${i}`])fix[`a${i}`]=s[`n${i}`];
        if(Object.keys(fix).length)ctx.set(fix);
        inputFeedback.hidden=true;
        if(s.mode==="kernel" && s.w1+s.w2+s.w3===0){
          mode.set(s.mode);manual.hidden=false;replayControls.hidden=true;mixture.hidden=true;
          editors.forEach((c,k)=>{const i=k+1;c.a.set(Math.min(s[`a${i}`],s[`n${i}`]));c.n.set(s[`n${i}`]);c.w.set(s[`w${i}`]);c.note.textContent="Probability is undefined until at least one outcome has positive weight.";});
          inputFeedback.hidden=false;inputFeedback.textContent="The total probability weight must be positive. Increase any outcome's weight above zero to compute the averages; your inputs are preserved.";
          ctx.readout.set("A probability distribution needs positive total weight. No averages are computed for these inputs.");
          fig.replaceChildren();summary.replaceChildren();running.replaceChildren();table.replaceChildren();
          smallR.textContent="";explanation.textContent="";running.hidden=true;runningKey.hidden=true;
          ctx.caption.textContent="Three illustrative outcomes. Relative probability weights must have a positive total before normalization.";
          return;
        }
        const model=averagingResult(s), r=model.result;
        const share = s.mode === "replays" ? formatShare : finiteShare;
        mode.set(s.mode); manual.hidden=s.mode!=="kernel"; replayControls.hidden=s.mode!=="replays"; mixture.hidden=s.mode!=="mixture"; running.hidden=s.mode!=="replays"; runningKey.hidden=s.mode!=="replays"; psi.set(s.psi);
        if(s.mode==="mixture") mixtureText.replaceChildren("The theory book’s four-unit, two-criterion law. A lottery chooses one WHOLE fixed report; the expected weighted wrong count is averaged over that law within each report. ",...model.cases.flatMap((d,i)=>[i?"; ":"",blocksText(d.grade,model.ids),", probability ",ctx.num(d.probability,share(d.probability)),", expected weighted wrong ",ctx.num(d.A,share(d.A)),", stated pairs ",ctx.num(d.N,formatCount(d.N))]),". Evaluation of fixed reports; the lottery is not a single printable report.");
        for(const [key,c]of controlSpecs)c.set(s[key]);
        editors.forEach((c,k)=>{const i=k+1;c.a.set(Math.min(s[`a${i}`],s[`n${i}`]));c.n.set(s[`n${i}`]);c.w.set(s[`w${i}`]);const d=model.cases[k]; if(s.mode==="kernel")c.note.replaceChildren("Probability ",ctx.num(d.probability,share(d.probability)),"; this outcome's error share ",ctx.num(d.share,share(d.share)),". Wrong directions cannot exceed stated pairs.");});
        const rows=FIELDS.map((field,i)=>({label:NAMES[i],value:r[field]}));
        plot(fig,{alt:"Three averages of the same error counts; pooling pairs, conditioning on positive disclosure, and imputing zero give different answers.",height:185,marginLeft:143,marginRight:26,x:{domain:[0,1],label:"Error share",ticks:[0,.25,.5,.75,1]},y:{domain:NAMES,label:null},
          table:{caption:"Three averaging conventions",columns:[{label:"Average",value:"label"},{label:"Share",value:"value",format:v=>share(v)}],rows},
          marks:(c,P)=>[P.barX(rows.filter(d=>d.value!==null),{x:"value",y:"label",fill:c.post}),numText(rows.filter(d=>d.value!==null),{x:"value",y:"label",value:"value",format:v=>share(v),dx:5,textAnchor:"start",fill:c.plotFg})],
          keyboard:{data:rows.filter(d=>d.value!==null),x:"value",y:"label",sort:false,label:"Compare the three averages",title:d=>`${d.label}: ${share(d.value)}`}});
        summary.replaceChildren(...rows.map((d,i)=>h("p",{},h("strong",{},`${d.label}: `),ro(FIELDS[i],d.value,share))),
          h("p",{},"Chance of any disclosure: ",ro("positiveFrequency",r.positiveFrequency,share),"; average fraction of all possible pairs stated: ",ro("meanDisclosure",r.meanDisclosure,share),". All possible pairs per outcome, M = ",ro("M",model.M,formatCount),"; this is E[N]/M."));
        if(s.mode!=="replays" && r.positiveFrequency===0) smallR.textContent="No outcome discloses, so neither the pooled ratio nor the conditional mean is defined. The zero-imputed mean remains a reporting convention.";
        else if(s.mode!=="replays") smallR.replaceChildren("With one observed outcome, the expected observed fraction conditional on disclosure is ",ctx.num(r.meanFraction,share(r.meanFraction)),", while the ratio of expected counts is ",ctx.num(r.ERR,share(r.ERR)),". They need not agree: a ratio estimated from very few outcomes can be biased for the pooled-pair target.");
        else {
          smallR.textContent="A small set of datasets gives a random ratio estimate. This running curve shows its variability; one run cannot measure its repeated-sample bias. The Three outcomes mode supplies an exact one-outcome counterexample.";
          const history=model.cases.flatMap((_,i)=>{const a=disclosedErrorEstimands(model.cases.slice(0,i+1).map(({A,N})=>({A,N})),{M:model.M});return FIELDS.map((f,k)=>({dataset:i+1,value:a[f],label:NAMES[k],k}));}).filter(d=>d.value!==null);
          plot(running,{alt:"Running values of the three averaging conventions as simulated datasets accumulate.",height:210,x:{label:"Datasets",domain:[1,Math.max(2,s.replays)],ticks:Math.min(5,s.replays)},y:{label:"Estimated error share",domain:[0,Math.min(1,Math.max(.1,...history.map(d=>d.value))*1.1)]},color:{type:"identity"},marks:(c,P)=>NAMES.map((name,k)=>P.line(history.filter(d=>d.k===k),{x:"dataset",y:"value",stroke:[c.post,c.err,c.wh][k],strokeDasharray:[null,"6 3","2 3"][k]})),keyboard:{data:history,x:"dataset",y:"value",sort:false,label:"Running averages by dataset",title:d=>`${d.label}, dataset ${formatCount(d.dataset)}: ${share(d.value)}`},table:{caption:"Running averages",columns:[{label:"Datasets",value:"dataset",format:v=>formatCount(v)},{label:"Average",value:"label"},{label:"Share",value:"value",format:v=>share(v)}],rows:history}});
        }
        explanation.textContent="Pooled pairs divide total weighted errors by total weighted stated pairs. Disclosing outcomes average each error share only where disclosure is positive. Zero-imputation assigns zero to silent outcomes. Undefined ratios remain NA: no disclosure; a zero-imputed mean is a different estimand.";
        table.replaceChildren(h("caption",{},s.mode!=="replays"?"The distribution over complete report outcomes":"Replicated datasets: realized counts against the league's fixed true values"),
          h("thead",{},h("tr",{},...["Outcome","Probability","Wrong","Stated","Error share"].map(t=>h("th",{scope:"col"},t)))),
          h("tbody",{},...model.cases.map((d,i)=>h("tr",{},h("th",{scope:"row"},ctx.num(i+1,formatCount(i+1))),h("td",{},ctx.num(d.probability,share(d.probability))),h("td",{},ctx.num(d.A,s.mode==="mixture"?share(d.A):formatCount(d.A))),h("td",{},ctx.num(d.N,formatCount(d.N))),h("td",{},ctx.num(d.share,share(d.share)))))));
        ctx.readout.set(["Pooled pairs ",ctx.num(r.ERR,share(r.ERR)),", disclosing outcomes ",ctx.num(r.meanFraction,share(r.meanFraction)),", zero-imputed ",ctx.num(r.zeroImputed,share(r.zeroImputed)),". The chance of any disclosure is ",ctx.num(r.positiveFrequency,share(r.positiveFrequency)),"."]);
        ctx.caption.replaceChildren(...(s.mode==="kernel"?["A hand-set distribution over report outcomes on three units; relative weights are normalized to probabilities. These are illustrative counts."]:s.mode==="mixture"?["A lottery over two complete fixed reports under the theory book’s four-unit law. Expected weighted wrong counts are posterior expectations; reporting randomness chooses a whole report."]:
          ["Monte Carlo, ",ctx.num(s.replays,formatCount(s.replays))," datasets, seed ",ctx.num(s.seed,formatCount(s.seed)),". Reports are optimal cuts of each posterior-mean order with at most ",ctx.num(s.cap,formatCount(s.cap))," grades (",ctx.num(familySize(30,{kind:"order",order:Array.from({length:30},(_,i)=>i),G:s.cap}),formatCount(familySize(30,{kind:"order",order:Array.from({length:30},(_,i)=>i),G:s.cap})))," cut reports per dataset). True values stay fixed across datasets; assumed prior SD ",ctx.num(s.priorSd,formatSetting(s.priorSd)),", τ ",ctx.num(s.tau,formatSetting(s.tau)),"."]));
      }};
    },
  });
}
