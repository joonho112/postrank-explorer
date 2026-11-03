import { createWidget } from "../shared/base.js";
import { formatCount, formatDecimal, formatGrades, formatRisk, formatSci, formatSetting, formatShare, formatSizes, setNum } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
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
.prx-den .prx-krw-track{
  display: block;
  height: 0.5rem;
  background: var(--prx-plot-grid);
  border-radius: 2px;
  overflow: hidden;
}
.prx-den .prx-krw-bar{
  display: block;
  height: 100%;
}
.prx-den .prx-krw-bar-dr{
  background: var(--prx-err);
  opacity: 0.55;
}
.prx-den .prx-krw-bar-en{
  background: var(--prx-err);
}
.prx-den .prx-krw-verdict{
  font-weight: 600;
}


.prx-den .den-panel { background:var(--prx-plot-bg);color:var(--prx-plot-fg);padding:.75rem;border-radius:var(--prx-radius); }
.prx-den .prx-krw-dencard dt,.prx-den .prx-result-tag { color:var(--prx-plot-fg); }
.prx-den .den-panel .prx-panel-title,.prx-den .den-panel .prx-result-caption {color:var(--prx-plot-muted);}
.prx-den .den-notice {font-size:.85em;overflow-wrap:anywhere;}
`;
export function mountWidget(el,spec={}) {
 return createWidget(el,spec,{name:CONFIG.name,className:"prx-den",css:CSS,title:"Wrong among stated, wrong among all",
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
 const tieSlot=h("section",{"aria-label":"Equal-risk six-site reports"});
 const denSlot=h("div"),cardLine=h("p"),belief=h("p",{text:T.cardBelief});
 const identity=h("p");
 const panel=h("section",{class:"den-panel","aria-label":T.denHead},ctx.panelTitle(T.denHead),denSlot,tieSlot,identity,cardLine,belief);
 ctx.charts.append(panel);
 ctx.scrollRegion(denSlot,T.denHead);
 const krw=readRaceCard();
 if(!ctx.doc.querySelector('meta[name="quarto:offset"]'))ctx.root.append(h("p",{class:"den-notice",text:"Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700; replication deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; as adapted in postrank 1.1.0 (pr_case_krw), changes noted. Risks recomputed on released pair probabilities; archived card statistics retained. No endorsement is implied. Provided as is, without warranty. The data describe KRW's correspondence experiment, not any firm's current conduct."}));
 ctx.caption.replaceChildren("Six fictional sites: ",captionNode(ctx,"teaching-posterior"),".");
      function drawDenominators(r, opt) {
        const ev = opt.evaluation;
        const bar = (v, cls) => {
          const b = h("span", { class: `prx-krw-bar ${cls}`, "aria-hidden": "true" });
          b.style.width = `${Math.min(1, v / CONFIG.bars.max) * CONFIG.bars.percent}%`;
          return b;
        };
        const rate = (label, node, v, cls) => [h("dt", { text: label }),
          h("dd", {}, h("span", { class: "prx-krw-barcell" }, node, h("span", { class: "prx-krw-track" }, bar(v, cls))))];
        const card = (title, N, M, sNode, drNode, dr, enNode, en, name) => h("section", { class: "prx-krw-dencard" },
          h("p", { class: "prx-krw-dentitle" }, ...title),
          h("dl", {},
            h("dt", { text: T.colStated }), h("dd", {}, N, T.of, M, " (s = N/M = ", sNode, ")"),
            ...rate(T.colDR, drNode, dr, "prx-krw-bar-dr"),
            ...rate(T.colEN, enNode, en, "prx-krw-bar-en")));
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
        const cards = [card(
          [...fill(T.rowSix, { tau: () => set(r.tau, "den-tau"), grades: () => grades(opt.grade, "den-grades") }), "; ", tagNode(ctx, opt)],
          num(ev.N, formatCount(ev.N), "den-six-N"), num(M6, formatCount(M6), "den-six-M"), num(ev.s, formatShare(ev.s), "den-six-s"),
          num(ev.EoverM[0], formatShare(ev.EoverM[0]), "den-six-dr"), ev.EoverM[0],
          num(sixEN, formatShare(sixEN), "den-six-en"), sixEN ?? 0)];
        if (krw) {
          cards.push(card(
            [...fill(T.rowCard, {
              sizes: () => num(krw.sizes, formatSizes(krw.sizes), "den-card-sizes"),
              lambda: () => set(krw.lambda, "den-card-lambda"), tau: () => set(krw.tau, "den-card-tau"),
            }), "; ", captionNode(ctx, "krw-card")],
            num(krw.N, formatCount(krw.N), "den-card-N"), num(krw.M, formatCount(krw.M), "den-card-M"), num(krw.s, formatShare(krw.s), "den-card-s"),
            num(krw.DR, formatShare(krw.DR), "den-card-dr"), krw.DR,
            num(krw.EoverN, formatShare(krw.EoverN), "den-card-en"), krw.EoverN));
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
 belief.hidden=false;if(!krw){belief.replaceChildren(T.noKrw);identity.replaceChildren();ctx.readout.set([T.noKrw]);return;}
 identity.replaceChildren("DR = (N/M) × E/N. For the race card, rounded values give DR ≈ s × E/N: ",ctx.num(krw.DR,formatShare(krw.DR))," ≈ ",ctx.num(krw.s,formatShare(krw.s))," × ",ctx.num(krw.EoverN,formatShare(krw.EoverN)),". Both bar tracks run from ",ctx.num(0,formatCount(0))," to ",ctx.num(CONFIG.bars.max,formatSetting(CONFIG.bars.max)),".");
 ctx.readout.set(["KRW's race card: DR ",ctx.num(krw.DR,formatShare(krw.DR))," expected wrong directions per all pairs, versus E/N ",ctx.num(krw.EoverN,formatShare(krw.EoverN))," per stated pair, with share stated s = ",ctx.num(krw.s,formatShare(krw.s)),"."]);
 }finally{ctx.root.removeAttribute("aria-busy");}}};
 }});
}
