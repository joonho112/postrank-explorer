// two-denominators (app 2.14): KRW's DR divides the expected wrong count E by all M pairs, E/N by the N stated pairs,
// so DR = (N/M) × E/N = s × E/N. Two cards: the six sites' best report at the current τ (λ sets τ = λ/(1 + λ)), and
// KRW's archived race card, fixed as the controls change.
// Layout (review 044 repair, X-01 with G3-F8 and G3-F3): base.js's result-first frame, so the read-out sits directly
// under the controls and the preset row and follows the six-site state, beside the fixed card's values (the review's
// replacement copy; ties named with the shared tie words). Each card says whether it moves with the controls, and
// draws the identity on one bar: E/N is the whole bar, its s-share (DR = s × E/N) is shaded, and the identity with the
// card's own numbers is written under it ("=" when the rounded product reproduces the rounded DR, "≈" otherwise, as
// the identity line below says). The six-site card is the graphic τ and λ change (ctx.primaryGraphic); the τ slider
// is the control the read-out names first (ctx.primaryControl). Exports parseAxis, resolve and readRaceCard are
// unchanged (lambda-tau, app 5.1, imports them).
import { createWidget } from "../shared/base.js";
import { formatCount, formatDecimal, formatGrades, formatRisk, formatSci, formatSetting, formatShare, formatSizes, setNum } from "../shared/format.js";
import { captionNode, tagNode, tieNode } from "../shared/labels.js";
import { disclosure, evaluateReport, exactOptimum, krwRisk, lambdaToTau, pairCount, tauToLambda } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import KRW from "../../data/released/case-krw.json" with { type: "json" };

export const CONFIG = { name:"two-denominators", lambda:{min:.01,max:1,step:.01,value:1}, tau:{min:.01,max:.5,step:.01}, bars:{max:.15,percent:100}, text:{
    denHead: "Two denominators: DR over all M pairs, E/N over the N stated pairs",
    denCaption: "Expected wrong directions per pair (DR) and per stated pair (E/N); DR = s × E/N with s = N/M",
    colReport: "Report",
    colStated: "Stated pairs, N of M",
    colS: "s = N/M",
    colDR: "DR = E/M, over all M pairs",
    colEN: "E/N, over the N stated pairs",
    rowSix: Object.freeze(["Six sites, best report at τ = ", "{tau}", ": ", "{grades}"]),
    rowCard: Object.freeze(["KRW's race card, ", "{sizes}", ", chosen at λ = ", "{lambda}", ", which is τ = ", "{tau}"]),
    of: " of ",
    cardRisks: Object.freeze(["For the race card, KRW's risk at λ = ", "{lambda}", " is ", "{krw}", " and postrank's risk at τ = ", "{tau}", " is ", "{risk}",
      " = ", "{tau2}", " + (", "{one}", " − ", "{tau3}", ") × (", "{krw2}", "). Kendall's τ̄ (KRW) = s − ", "{two}", " × DR = ", "{taubar}", "."]),
    cardBelief: "The card's N, s, DR and E/N above are KRW's archived values; postrank's evaluation on the released probabilities agrees at these digits. postrank scores the card with the released pair probabilities, which differ slightly from KRW's archived ones, so the same-belief-law condition holds only approximately here: these are evaluations of KRW's card, not a claim that it is postrank's optimum.",
    noKrw: "The KRW files did not load, so the race card's row is not shown.",
    // review 044 repair (G3-F8): which card moves with the controls, said in the card
    tagMoving: "Moves with τ",
    tagFixed: "Fixed: does not move with λ or τ",
}};
const T = CONFIG.text;
const E6 = SIX.arrays.one;
const M6 = pairCount(E6.ids.length);
export function parseAxis(lo, hi) {
  return (v) => {
    if (v === null) return null;
    let n;
    if (typeof v === "number") n = v;
    else if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "auto" || s === "") return null;
      const m = /^(\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/.exec(s);
      n = m ? Number(m[1]) / Number(m[2]) : Number(s);
    } else return undefined;
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : undefined;
  };
}

/** The setting the state stands for: { lambda, tau, from }. */
export function resolve(state) {
  if (typeof state.lambda === "number") return { lambda: state.lambda, tau: lambdaToTau(state.lambda), from: "lambda" };
  if (typeof state.tau === "number") return { lambda: tauToLambda(state.tau), tau: state.tau, from: "tau" };
  return { lambda: CONFIG.lambda.value, tau: lambdaToTau(CONFIG.lambda.value), from: "lambda" };
}


export function readRaceCard(data=KRW) {
  const arr=data?.arrays?.error, grade=data?.tables?.reports?.race_card, cm=data?.tables?.card_metrics;
  if(!arr||!grade||!cm)return null;
  const row=cm.criterion.indexOf("race");if(row<0)return null;
  const E={ids:arr.ids,criteria:[arr.criteria[0]],e:[arr.e[0]]};
  const lambda=data.facts.card_lambda,tau=data.facts.card_tau,ev=evaluateReport(grade,E,{tau});
  return {lambda,tau,card:grade,sizes:disclosure(grade).sizes,M:cm.M[row],N:cm.N[row],s:cm.s[row],DR:cm.DR[row],EoverN:cm.conditional_DR[row],taubar:cm.tau_bar[row],risk:ev.risk,krw:krwRisk(grade,E,{lambda})};
}
const CSS=`.prx-den .prx-krw-den{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 0.75rem 1rem;
  margin: 0.4rem 0 0;
}
.prx-den .prx-krw-dencard{
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  min-width: 0;
}
.prx-den .prx-krw-dentitle{
  margin: 0 0 0.4rem;
  font-weight: 600;
}
.prx-den .prx-krw-dencard dl{
  margin: 0;
}
.prx-den .prx-krw-dencard dt{
  font-weight: 400;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
  margin-top: 0.3rem;
}
.prx-den .prx-krw-dencard dd{
  margin: 0;
}
.prx-den .prx-krw-barcell{
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 4.5rem;
}
.prx-den .prx-krw-verdict{
  font-weight: 600;
}
/* review 044 repair (G3-F8): whether the card moves with the controls */
.prx-den .den-tag{
  display: inline-block;
  margin: 0 0 0.35rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.8em;
  font-weight: 600;
  line-height: 1.6;
}
.prx-den .den-tag-moving{ border: 1.5px solid var(--prx-plot-fg); color: var(--prx-plot-fg); }
.prx-den .den-tag-fixed{ border: 1.5px dashed var(--prx-cell-border); color: var(--prx-plot-muted); }
/* the identity on one bar: E/N is the whole bar (outlined, lightly filled), DR = s × E/N its shaded s-share; the
   keys in front of the DR and E/N labels repeat the two fills */
.prx-den .den-track{
  position: relative;
  display: block;
  height: 0.8rem;
  margin: 0.55rem 0 0.25rem;
  background: var(--prx-plot-grid);
  border-radius: 2px;
  overflow: hidden;
}
.prx-den .den-bar-en, .prx-den .den-bar-dr{ position: absolute; left: 0; top: 0; bottom: 0; box-sizing: border-box; }
.prx-den .den-bar-en, .prx-den .den-key-en{ border: 1.5px solid var(--prx-err); }
.prx-den .den-bar-en::before, .prx-den .den-key-en::before{ content: ""; position: absolute; inset: 0; background: var(--prx-err); opacity: 0.25; }
.prx-den .den-bar-dr, .prx-den .den-key-dr{ background: var(--prx-err); }
.prx-den .den-key{
  position: relative;
  display: inline-block;
  width: 0.9rem;
  height: 0.6rem;
  margin-right: 0.35rem;
  box-sizing: border-box;
  border-radius: 1px;
}
.prx-den .den-formula{ margin: 0.1rem 0 0; font-variant-numeric: tabular-nums; }


.prx-den .den-panel { background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.75rem;border-radius:var(--prx-radius); }
.prx-den .prx-krw-dencard dt,.prx-den .prx-result-tag { color:var(--prx-plot-fg); }
.prx-den .den-panel .prx-panel-title,.prx-den .den-panel .prx-result-caption {color:var(--prx-plot-muted);}
.prx-den .den-notice {font-size:.85em;overflow-wrap:anywhere;}
`;
export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:CONFIG.name,className:"prx-den",css:CSS,title:"Wrong among stated, wrong among all",
 // review 044 repair (X-01): the read-out directly under the controls and the preset row
 layout:"result-first",
 keys:{lambda:{type:"custom",value:null,parse:parseAxis(.01,1)},tau:{type:"custom",value:.25,parse:parseAxis(.01,.5)}},
 build(ctx){
 const {h}=ctx;
 const num=(raw,display,name)=>{const node=ctx.num(raw,display);if(name)node.setAttribute("data-prx-readout",name);return node;};
 const set=(raw,name)=>num(raw,formatSetting(raw),name);
 const grades=(g,name)=>num(Array.from(g),formatGrades(Array.from(g)),name);
 const base={one:()=>ctx.num(1,formatCount(1)),two:()=>ctx.num(2,formatCount(2))};
 const fill=(parts,slots={})=>parts.flatMap(p=>{const m=/^\{(\w+)\}$/.exec(p);return m?[].concat((slots[m[1]]??base[m[1]])()):[p];});
 const lambdaSlider=ctx.slider({label:"KRW's λ: reward for a correct stated direction (a wrong one costs 1)",...CONFIG.lambda,value:resolve(ctx.state).lambda,name:"lambda",hint:["λ = ",ctx.num(0,formatCount(0))," is an endpoint outside postrank, which needs τ above ",ctx.num(0,formatCount(0)),"; the slider starts at the first positive λ of KRW's grid."],onInput:v=>ctx.set({lambda:v,tau:null})});
 const tauSlider=ctx.slider({label:"postrank's τ: cost of staying silent on a pair (a wrong direction costs 1)",...CONFIG.tau,value:resolve(ctx.state).tau,name:"tau",onInput:v=>ctx.set({tau:v,lambda:null})});
 ctx.controls.append(lambdaSlider.root,tauSlider.root);
 // the τ slider is the control the read-out names first; both sliders move the six-site card (base.js primaryControl)
 ctx.primaryControl(tauSlider.root);
 const tieSlot=h("section",{"aria-label":"Equal-risk six-site reports"});
 const denSlot=h("div"),cardLine=h("p"),belief=h("p",{text:T.cardBelief});
 const identity=h("p"), zeroScope=h("p", {},
  "If N = ",ctx.num(0,formatCount(0)),", nothing is stated. DR is ",ctx.num(0,formatCount(0))," and E/N has no defined value (",ctx.num(null,formatShare(null)),").");
 const panel=h("section",{class:"den-panel","aria-label":T.denHead},ctx.panelTitle(T.denHead),denSlot,tieSlot,identity,zeroScope,cardLine,belief);
 ctx.charts.append(panel);
 ctx.scrollRegion(denSlot,T.denHead);
 const krw=readRaceCard();
 if(!ctx.doc.querySelector('meta[name="quarto:offset"]'))ctx.root.append(h("p",{class:"den-notice",text:"Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700; replication deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; as adapted in postrank 1.1.0 (pr_case_krw), changes noted. Risks recomputed on released pair probabilities; archived card statistics retained. No endorsement is implied. Provided as is, without warranty. The data describe KRW's correspondence experiment, not any firm's current conduct."}));
 ctx.caption.replaceChildren("Six fictional sites: ",captionNode(ctx,"teaching-posterior"),".");
      function drawDenominators(r, opt) {
        const ev = opt.evaluation;
        const width = (v) => `${Math.min(1, Math.max(0, v) / CONFIG.bars.max) * CONFIG.bars.percent}%`;
        // review 044 repair (G3-F8): the identity on one bar, both cards on the same 0 to CONFIG.bars.max track. E/N is
        // the whole bar and DR = s × E/N its shaded s-share. With nothing stated (N = 0) E/N is undefined: no bar.
        const identityBar = (dr, en) => {
          if (en === null || en === undefined) return h("span", { class: "den-formula" }, formatShare(en));
          const track = h("span", { class: "den-track", "aria-hidden": "true" });
          const whole = h("span", { class: "den-bar-en" }), part = h("span", { class: "den-bar-dr" });
          whole.style.width = width(en);
          part.style.width = width(dr);
          track.append(whole, part);
          return track;
        };
        // the identity with the card's numbers, written under its bar; "=" when the rounded s × E/N gives the rounded DR
        const identityLine = (s, dr, en, prefix) => {
          if (en === null || en === undefined) return h("p", { class: "den-formula" }, "E/N: ", num(en, formatShare(en), `${prefix}-bar-en`));
          const same = formatShare(Number(formatShare(s)) * Number(formatShare(en))) === formatShare(dr);
          return h("p", { class: "den-formula" }, "DR = s × E/N = ", num(s, formatShare(s), `${prefix}-bar-s`), " × ",
            num(en, formatShare(en), `${prefix}-bar-en`), same ? " = " : " ≈ ", num(dr, formatShare(dr), `${prefix}-bar-dr`));
        };
        const key = (cls) => h("span", { class: `den-key ${cls}`, "aria-hidden": "true" });
        const rate = (label, node, cls) => [h("dt", {}, key(cls), label), h("dd", {}, h("span", { class: "prx-krw-barcell" }, node))];
        const card = (tag, title, N, M, s, sNode, dr, drNode, en, enNode, prefix) => h("section", { class: "prx-krw-dencard" },
          h("p", { class: `den-tag ${tag.cls}` }, tag.text),
          h("p", { class: "prx-krw-dentitle" }, ...title),
          h("dl", {},
            h("dt", { text: T.colStated }), h("dd", {}, N, T.of, M, " (s = N/M = ", sNode, ")"),
            ...rate(T.colDR, drNode, "den-key-dr"),
            ...rate(T.colEN, enNode, "den-key-en")),
          identityBar(dr, en), identityLine(s, dr, en, prefix));
        tieSlot.hidden = opt.tieCount <= 1;
        tieSlot.replaceChildren();
        if (opt.tieCount > 1) {
          const tied = opt.grades.map(g => ({ grade:Array.from(g), ev:evaluateReport(g,E6,{tau:r.tau}) }));
          tieSlot.append(h("p",{},num(opt.tieCount,formatCount(opt.tieCount),"den-tie-count"),
            " reports share the minimum risk within equal-risk tolerance ",num(opt.tieTol,formatSci(opt.tieTol),"den-tie-tolerance"),
            ". The six-site bars show the first; the denominator-dependent values for every tied report are below."),
            ...tied.map((t,i)=>h("p",{},grades(t.grade,`den-tie-${i}-grades`)," · N = ",num(t.ev.N,formatCount(t.ev.N),`den-tie-${i}-N`),
              " · DR = ",num(t.ev.EoverM[0],formatShare(t.ev.EoverM[0]),`den-tie-${i}-dr`),
              " · E/N = ",num(t.ev.EoverN[0],formatShare(t.ev.EoverN[0]),`den-tie-${i}-en`))));
          if(new Set(tied.map(t=>t.ev.N)).size>1)tieSlot.append(captionNode(ctx,"different-disclosure"));
        }
        const sixEN = ev.EoverN[0];
        const cards = [card({ cls: "den-tag-moving", text: T.tagMoving },
          [...fill(T.rowSix, { tau: () => set(r.tau, "den-tau"), grades: () => grades(opt.grade, "den-grades") }), "; ", tagNode(ctx, opt)],
          num(ev.N, formatCount(ev.N), "den-six-N"), num(M6, formatCount(M6), "den-six-M"), ev.s, num(ev.s, formatShare(ev.s), "den-six-s"),
          ev.EoverM[0], num(ev.EoverM[0], formatShare(ev.EoverM[0]), "den-six-dr"),
          sixEN, num(sixEN, formatShare(sixEN), "den-six-en"), "den-six")];
        // the card the controls change (base.js primaryGraphic)
        ctx.primaryGraphic(cards[0]);
        if (krw) {
          cards.push(card({ cls: "den-tag-fixed", text: T.tagFixed },
            [...fill(T.rowCard, {
              sizes: () => num(krw.sizes, formatSizes(krw.sizes), "den-card-sizes"),
              lambda: () => set(krw.lambda, "den-card-lambda"), tau: () => set(krw.tau, "den-card-tau"),
            }), "; ", captionNode(ctx, "krw-card")],
            num(krw.N, formatCount(krw.N), "den-card-N"), num(krw.M, formatCount(krw.M), "den-card-M"), krw.s, num(krw.s, formatShare(krw.s), "den-card-s"),
            krw.DR, num(krw.DR, formatShare(krw.DR), "den-card-dr"),
            krw.EoverN, num(krw.EoverN, formatShare(krw.EoverN), "den-card-en"), "den-card"));
          cardLine.replaceChildren(...fill(T.cardRisks, {
            lambda: () => set(krw.lambda, "card-lambda"), krw: () => num(krw.krw, formatRisk(krw.krw), "card-krwrisk"),
            tau: () => set(krw.tau, "card-tau"), risk: () => num(krw.risk, formatRisk(krw.risk), "card-risk"),
            tau2: () => ctx.num(krw.tau, formatSetting(krw.tau)), tau3: () => ctx.num(krw.tau, formatSetting(krw.tau)),
            krw2: () => ctx.num(krw.krw, formatRisk(krw.krw)),
            taubar: () => num(krw.taubar, formatDecimal(krw.taubar, { digits: 4 }), "card-taubar"),
          }), " (", captionNode(ctx, "fixed-report"), ")");
        } else cardLine.replaceChildren();
        denSlot.replaceChildren(h("p", { class: "prx-krw-note", text: T.denCaption }), h("div", { class: "prx-krw-den" }, ...cards));
      }

 return {render(state){ctx.root.setAttribute("aria-busy","true");try{
 const r=resolve(state);lambdaSlider.set(r.lambda);tauSlider.set(r.tau);
 if(r.tau<CONFIG.tau.min){setNum(tauSlider.output,r.tau,formatSetting(r.tau));tauSlider.input.setAttribute("aria-valuetext",formatSetting(r.tau));}
 const opt=exactOptimum(E6,{tau:r.tau,family:{kind:"all"}});drawDenominators(r,opt);
 // review 044 repair (X-01; G3-F3's replacement copy): the read-out follows the six-site state the controls change,
 // then gives the fixed card's three values; a tie is named with the shared words (one of k equal-risk best reports)
 const ev=opt.evaluation,dr=ev.EoverM[0],en=ev.EoverN[0];
 const at=r.from==="lambda"?["At λ = ",num(r.lambda,formatSetting(r.lambda),"den-ro-lambda"),", which is τ = ",num(r.tau,formatSetting(r.tau),"den-ro-tau"),","]:["At τ = ",num(r.tau,formatSetting(r.tau),"den-ro-tau")];
 const six=[...at," the six-site best report",tieNode(ctx,opt)??""," states ",num(ev.N,formatCount(ev.N),"den-ro-N")," of ",ctx.num(M6,formatCount(M6))," pairs (share stated s = ",num(ev.s,formatShare(ev.s),"den-ro-s"),")",
  ...(en===null||en===undefined?[": nothing is stated, so E/N has no defined value."]:[": DR ",num(dr,formatShare(dr),"den-ro-dr")," = s × E/N ",num(en,formatShare(en),"den-ro-en"),"."])];
 belief.hidden=false;if(!krw){belief.replaceChildren(T.noKrw);identity.replaceChildren();ctx.readout.set([...six," ",T.noKrw]);return;}
 identity.replaceChildren("DR = (N/M) × E/N. For the race card, rounded values give DR ≈ s × E/N: ",ctx.num(krw.DR,formatShare(krw.DR))," ≈ ",ctx.num(krw.s,formatShare(krw.s))," × ",ctx.num(krw.EoverN,formatShare(krw.EoverN)),". Both bar tracks run from ",ctx.num(0,formatCount(0))," to ",ctx.num(CONFIG.bars.max,formatSetting(CONFIG.bars.max)),".");
 ctx.readout.set([...six," KRW's fixed race card: s = ",num(krw.s,formatShare(krw.s),"den-ro-card-s"),", DR ",num(krw.DR,formatShare(krw.DR),"den-ro-card-dr"),", E/N ",num(krw.EoverN,formatShare(krw.EoverN),"den-ro-card-en"),"."]);
 }finally{ctx.root.removeAttribute("aria-busy");}}};
 }});
}
