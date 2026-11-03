// Commonality costs: live six-site exact comparisons and two fixed draw-based archives.
// Scientific values come from commonalityCost/evaluateReport or the declared released archive.
import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatRisk, formatSetting, formatGrades, formatShare, formatSci, formatTuple, formatExpectedCount } from "../shared/format.js";
import { tagNode, labelNode, familySizeNode, captionNode } from "../shared/labels.js";
import { commonalityCost, evaluateReport } from "../pr-core.js";
import { commonalityArchive } from "../shared/criteria-archive.js";
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from "../shared/criteria-provenance.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "common-grade-cost",
  w: Object.freeze({ type: "number", min: 0, max: 1, step: 0.01, value: 0.5 }),
  tau: 0.2,
  family: Object.freeze({ kind: "atMost", G: 3 }),
  cost: Object.freeze({ height: 210, marginTop: 28, marginBottom: 36, marginLeft: 70, marginRight: 22, r: 8,
    xDomain: Object.freeze([0, 0.25]), xTicks: Object.freeze([0, 0.05, 0.1, 0.15, 0.2, 0.25]), dash: "5 3", tiedOpacity: 0.45 }),
  text: Object.freeze({
    w: "Weight w on score A (score B gets 1 − w)",
    costTitle: "Each score's risk: own best report → common report",
    reportsTitle: "The reports",
    common: "Common report",
    own: (k) => `Score ${k}'s own best`,
    tied: "tied with another report",
    scores: Object.freeze(["score A", "score B"]),
    allWithheld: (tau) => `all withheld (τ = ${formatSetting(tau)})`,
    xLabel: "risk on that score →",
    keyOwn: "its own best report",
    keyCommon: "the common report",
    keyDelta: "Δ: the cost of a common grade",
    costAlt: "Dumbbell chart: for score A and score B, the risk under that score's own best report (open dot) and under the common report (filled dot); the gap is the cost of the common grade.",
  }),
});

// --------------------------------------------------------------------------------------------- data

const A2 = SIX.arrays.two;
const ERRORS = { ids: A2.ids.slice(), criteria: A2.criteria.slice(), e: A2.e.map((m) => m.map((r) => r.map((v) => (v === null ? Number.NaN : v)))) };
const IDS = ERRORS.ids;
const LETTERS = ["A", "B"];

const blocksOf = (grade,ids=IDS) => Array.from({ length: Math.max(...grade) }, (_, h) => ids.filter((_, i) => grade[i] === h + 1));
const blocksText = (grade,ids=IDS) => blocksOf(grade,ids).map((b) => `{${b.join(", ")}}`).join(" > ");
const sameGrade = (g, h) => g.length === h.length && g.every((v, i) => v === h[i]);

/** Every tied common report with its risk and cost on each score (the first is cc.common.grade). */
function tiedCommons(cc) {
  return cc.commonReports;
}

const CSS = `
.cgc .cgc-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 0.4rem 1.3rem; align-items: start; }
.cgc .cgc-row { margin: 0 0 0.45rem; padding:.4rem; border-radius:.35rem; background:var(--prx-plot-bg); color:var(--prx-plot-fg); }
.cgc .cgc-name { margin: 0 0 0.1rem; font-size: 0.875rem; font-weight: 600; color: var(--prx-plot-muted); }
.cgc .cgc-name .cgc-note { font-weight: 400; color: var(--prx-plot-muted); }
.cgc .cgc-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.cgc .cgc-chip { display: inline-block; min-width: 1.9rem; padding: 0.1rem 0.5rem; border-radius: 5px; font-size: 1rem;
  font-weight: 700; letter-spacing: 0.06em; text-align: center; }
.cgc .cgc-common .cgc-chip { font-size: 1.1rem; padding: 0.15rem 0.55rem; }
.cgc .cgc-gt { font-weight: 700; color: var(--prx-plot-muted); }
.cgc .cgc-tag { margin: 0.1rem 0 0; font-size: 0.875rem; color: var(--prx-fg-muted); }
.cgc .cgc-tag .prx-result-tag { font-size: inherit; }
.cgc .cgc-sw-own { background: transparent; border: 2.5px solid var(--prx-plot-muted); border-radius: 50%; }
.cgc .cgc-sw-common { background: var(--prx-plot-muted); border-radius: 50%; }
.cgc .prx-legend { background:var(--prx-plot-bg); color:var(--prx-plot-fg); padding:.3rem; }
.cgc .cgc-left .prx-readout { margin-top: 0.4rem; }
.cgc .cgc-nowrap { white-space: nowrap; }
.cgc .cgc-scroll { max-width:100%; min-width:0; overflow-x:auto; }
.cgc .cgc-table { width:100%; border-collapse:collapse; font-size:.86rem; }
.cgc .cgc-table th,.cgc .cgc-table td { padding:.4rem .55rem; text-align:left; border-bottom:1px solid var(--prx-border); white-space:nowrap; }
.cgc .cgc-table caption { text-align:left; font-weight:600; margin:.45rem 0; }
.cgc .cgc-detail { margin:.7rem 0; }
.cgc .cgc-note { font-size:.86rem; color:var(--prx-fg-muted); }
.cgc .cgc-archive { min-width:0; }
.cgc .cgc-cost { min-width:0; }
.cgc .cgc-source { overflow-wrap:anywhere; }
.cgc [data-prx-readout="archive-grade"] { white-space:normal; overflow-wrap:anywhere; }
.cgc .cgc-chip { max-width:100%; box-sizing:border-box; overflow-wrap:anywhere; }
@media (max-width: 40em) { .cgc .cgc-grid { grid-template-columns: minmax(0, 1fr); } }
`;

// --------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "cgc",
    css: CSS,
    keys: { w: CONFIG.w, data: {type:"choice",values:["six","thirty25","thirty35"],value:"six"} },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;

      const source = ctx.select({label:"Example",options:[{value:"six",label:"Six fictional sites — live weights"},{value:"thirty25",label:"Thirty sites — archived lower price"},{value:"thirty35",label:"Thirty sites — archived higher price"}],value:"six",onChange:data=>ctx.set({data})});

      const w = ctx.slider({ label: T.w, ...ctx.key("w"), onInput: (v) => ctx.set({ w: v }) });
      ctx.controls.append(source.root,w.root);

      const costSlot = h("div", { class: "cgc-cost" });
      const key = (cls, text) => h("span", { class: "prx-key" }, h("span", { class: `prx-swatch ${cls}`, "aria-hidden": "true" }), text);
      const legend = h("div", { class: "prx-legend", "data-prx-part": "legend" },
        key("cgc-sw-own", T.keyOwn), key("cgc-sw-common", T.keyCommon),
        h("span", {}, T.keyDelta));
      const rows = h("div", { class: "cgc-rows" });
      const tag = h("p", { class: "cgc-tag" });
      const liveGrid=h("div", { class: "cgc-grid" },
        h("section", { class: "prx-panel cgc-left", "aria-label": T.costTitle }, ctx.panelTitle(T.costTitle), costSlot, legend, ctx.readout.node),
        h("section", { class: "prx-panel cgc-right", "aria-label": T.reportsTitle }, ctx.panelTitle(T.reportsTitle), rows, tag));
      const archive=h("section",{class:"cgc-archive"}),details=h("section",{class:"cgc-detail"});
      ctx.charts.append(liveGrid,archive,details);
      const ro=(key,value,fn=formatRisk)=>{const node=ctx.num(value,fn(value));node.setAttribute("data-prx-readout",key);return node;};
      const table=(caption,heads,body)=>ctx.scrollRegion(h("div",{class:"cgc-scroll"},h("table",{class:"cgc-table"},h("caption",{text:caption}),h("thead",{},h("tr",{},...heads.map(text=>h("th",{scope:"col",text})))),h("tbody",{},...body.map(row=>h("tr",{},...row.map((cell,i)=>h(i===0?"th":"td",i===0?{scope:"row"}:{},cell))))))),caption);
      const scrollHint=()=>h("p",{class:"cgc-note",text:"Swipe wide tables horizontally; Tab into a table region and use the arrow keys to scroll."});
      const fullLabel=(result,key)=>h("p",{class:"cgc-tag"},labelNode(ctx,result,{key})," (",familySizeNode(ctx,result)," reports)");

      function chipRow(name, grade, pal, { cls = "", note = null, color = null, ids=IDS } = {}) {
        const gc = gradeColors(Math.max(...grade), pal);
        const parts = [];
        blocksOf(grade,ids).forEach((b, k) => {
          if (k) parts.push(h("span", { class: "cgc-gt", "aria-hidden": "true", text: ">" }));
          parts.push(h("span", { class: "cgc-chip", style: { background: gc[k], color: labelOn(gc[k], pal) } }, b.join(" ")));
        });
        return h("div", { class: `cgc-row ${cls}`.trim() },
          h("p", { class: "cgc-name", style: color ? { color } : undefined }, name, note ? h("span", { class: "cgc-note" }, " (", note, ")") : null),
          h("div", { class: "cgc-chips", role: "img", "aria-label": `${[name].flat().map((n) => (typeof n === "string" ? n : n.textContent)).join("")}: ${blocksText(grade,ids)}` }, ...parts));
      }

      function drawCost(cc, ties, pal) {
        const C = CONFIG.cost;
        // per score: the first common report's risk, and the other tied reports' risks where their cost prints differently
        const data = cc.criteria.map((r) => {
          const first = ties[0];
          const alts = ties.slice(1).filter((t) => formatRisk(t.delta[r.k]) !== formatRisk(first.delta[r.k]));
          return {
            k: r.k, score: T.scores[r.k], own: r.ownRk, common: first.Rk[r.k], delta: first.delta[r.k], color: pal.crit[r.k],
            alts: alts.map((t) => ({ common: t.Rk[r.k], delta: t.delta[r.k] })),
          };
        });
        const far = (d) => Math.max(d.common, ...d.alts.map((a) => a.common));
        const altDots = data.flatMap((d) => d.alts.map((a) => ({ ...d, common: a.common })));
        const deltaText = (d) => `Δ ${[d.delta, ...d.alts.map((a) => a.delta)].map((v) => formatRisk(v)).join(" or ")}`;
        plot(costSlot, {
          alt: T.costAlt,
          table: {
            caption: "Risk of each score under its own best report and under the common report",
            columns: [
              { label: "Score", value: "score" },
              { label: "Own best report", value: "own", format: (v) => formatRisk(v) },
              { label: "Common report", value: (d) => [d.common, ...d.alts.map((a) => a.common)], format:v=>formatTuple(v,x=>formatRisk(x)) },
              { label: "Cost Δ", value: (d) => [d.delta,...d.alts.map(a=>a.delta)], format:v=>formatTuple(v,x=>formatRisk(x)) },
            ],
            rows: data,
          },
          height: C.height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: C.xDomain, ticks: C.xTicks, label: T.xLabel, labelAnchor: "right", labelOffset: 32, grid: true },
          y: { domain: T.scores, label: null, padding: 0.45, tickSize: 0 },
          marks: (c, P) => [
            P.ruleX([CONFIG.tau], { stroke: c.plotMuted, strokeDasharray: C.dash }),
            P.text([CONFIG.tau],{x:d=>d,frameAnchor:"top",text:()=>"all withheld (τ)",textAnchor:"end",dx:7,dy:-16,fontSize:12,fill:c.plotMuted}),
            P.text(data,{x:d=>(d.own+far(d))/2,y:"score",text:()=>"Δ",dx:-65,dy:-17,fontWeight:700,fill:c.plotFg}),
            numText([CONFIG.tau], { x: (d) => d, frameAnchor: "top", value: (d) => d, format: (v) => formatSetting(v), dx:20, dy: -16, fontSize: 12, fill: c.plotMuted }),
            P.link(data, { x1: "own", x2: far, y1: "score", y2: "score", stroke: "color", strokeWidth: 3.5 }),
            P.dot(data, { x: "own", y: "score", r: C.r, fill: c.plotBg, stroke: "color", strokeWidth: 2.5 }),
            P.dot(altDots, { x: "common", y: "score", r: C.r, fill: "color", fillOpacity: C.tiedOpacity, stroke: "color", strokeWidth: 1.5 }),
            P.dot(data, { x: "common", y: "score", r: C.r, fill: "color", stroke: c.plotBg, strokeWidth: 1 }),
            // Δ above each bar; with tied common reports, every value ("Δ .1580 or .1697")
            ...data.map((d) => numText([d], { x: (e) => (e.own + far(e)) / 2, y: "score", value: e=>[e.delta,...e.alts.map(a=>a.delta)], format: v=>formatTuple(v,x=>formatRisk(x)), dy: -17, fontSize: 14, fontWeight: 700, fill: c.plotFg })),
            numText(data, { x: "own", y: "score", value: "own", format: (v) => formatRisk(v), dx: -13, textAnchor: "end", fontSize: 12, fill: c.plotMuted }),
            numText(data.filter((d) => d.delta > 0 && !d.alts.length), { x: "common", y: "score", value: "common", format: (v) => formatRisk(v), dx: 13, textAnchor: "start", fontSize: 12, fill: c.plotMuted }),
          ],
          keyboard: {
            data, x: "common", y: "score", label: T.costAlt,
            title: (d) => `Score ${LETTERS[d.k]}: risk ${formatRisk(d.own)} under its own best report and ${[d.common, ...d.alts.map((a) => a.common)].map((v) => formatRisk(v)).join(" or ")} under the common report; cost of the common grade ${deltaText(d).slice(2)}.`,
          },
        });
        return data;
      }

      function drawReports(state, cc, ties, tieMatters, pal) {
        const common = ties[0].grade;
        const items = ties.flatMap((t,i)=>[chipRow([T.common," ",ctx.num(i+1,formatCount(i+1)), " (w = ", ctx.num(state.w, formatSetting(state.w)), ")"],t.grade,pal,
          {cls:"cgc-common",note:ties.length>1?T.tied:null}),fullLabel(cc,`common-${i}`)]);
        const packageIndex=sixSitePackageRepresentativeIndex({w:state.w,tau:CONFIG.tau,cap:CONFIG.family.G},ties.map(t=>t.grade));
        if(packageIndex>=0){
          const chosen=ties[packageIndex],ev=evaluateReport(chosen.grade,ERRORS,{tau:CONFIG.tau,w:cc.w});
          items.push(h("p",{class:"cgc-note","data-prx-part":"package-representative"},"For this fixed score-B-only setting, the recorded postrank ",
            ...SIX_SITE_PACKAGE_VERSION.flatMap((v,i)=>[i?".":"",ctx.num(v,formatCount(v))]),
            " run returns common report ",ctx.num(packageIndex+1,formatCount(packageIndex+1)),": ",ro("package-grade",chosen.grade,formatGrades),
            "; score-A wrong share ",ro("package-share-A",ev.EoverN[0],formatShare)," and score-A cost ",ro("package-cost-A",chosen.delta[0]),
            ". Both reports share the smallest risk and remain shown."));
        }
        for (const r of cc.criteria) {
          // Put the common report first when it is an own optimum, while retaining every alternative.
          const same = r.ownGrades.some((g) => sameGrade(Array.from(g), common));
          const own=same?[common,...r.ownGrades.filter(g=>!sameGrade(g,common))]:r.ownGrades;
          for(const [i,g] of own.entries())items.push(chipRow([T.own(LETTERS[r.k])," ",ctx.num(i+1,formatCount(i+1))],g,pal,{color:pal.critInk[r.k],note:r.ownTieCount===2?"one of two optima":null}),
            h("p",{class:"cgc-note"},"Grade vector ",ro(`own-${r.k}-${i}-grade`,g,formatGrades),"; criterion risk ",ro(`own-${r.k}-${i}-risk`,r.ownRk),"; stated pairs ",ro(`own-${r.k}-${i}-N`,evaluateReport(g,ERRORS,{tau:CONFIG.tau,w:cc.w}).N,formatCount),"."));
          items.push(fullLabel(cc,`own-${r.k}`),h("p",{class:"cgc-note"},ro(`own-${r.k}-tieCount`,r.ownTieCount,formatCount)," report(s) share this criterion's minimum within equal-risk tolerance ",ro(`own-${r.k}-tieTol`,cc.common.tieTol,formatSci),"."));
        }
        rows.replaceChildren(...items);
        tag.replaceChildren(tagNode(ctx, cc), ", each for its own weights. ",ro("common-tieCount",cc.common.tieCount,formatCount)," common report(s) share the smallest risk within equal-risk tolerance ",ro("common-tieTol",cc.common.tieTol,formatSci),".");
        if(cc.common.tieCount>ties.length)tag.append(" Showing the first ",ctx.num(ties.length,formatCount(ties.length))," common reports.");
        const profileRows=ties.flatMap((t,i)=>{const ev=evaluateReport(t.grade,ERRORS,{tau:CONFIG.tau,w:cc.w});return cc.criteria.map(r=>[ro(`common-${i}-grade-${r.k}`,t.grade,formatGrades),T.scores[r.k],ro(`common-${i}-N-${r.k}`,ev.N,formatCount),ro(`common-${i}-E-${r.k}`,ev.E[r.k],formatExpectedCount),ro(`common-${i}-share-${r.k}`,ev.EoverN[r.k],formatShare),ro(`common-${i}-EoverM-${r.k}`,ev.EoverM[r.k],formatShare),ro(`common-${i}-Rk-${r.k}`,t.Rk[r.k]),ro(`common-${i}-delta-${r.k}`,t.delta[r.k])]);});
        details.replaceChildren(h("p",{class:"cgc-note"},"Grade ",ctx.num(1,formatCount(1))," is highest on the declared targets. A shared grade withholds a direction; it does not assert equal underlying scores. E is the expected number of wrong stated directions, N counts stated pairs, and M counts all pairs. Criterion risk Rₖ = (Eₖ + τ(M − N)) / M."),scrollHint(),
          table("Every tied common report's criterion profile",["Grade vector","Criterion","N","Eₖ","Eₖ/N","Eₖ/M","Rₖ","Cost Δₖ"],profileRows),
          h("p",{class:"cgc-note"},captionNode(ctx,"package-quantity"),": Δₖ is the extra criterion risk relative to its own minimum in this same family at this same price. It carries no welfare meaning, and a large cost does not by itself say that a weight is wrong."));
      }

      function drawArchive(state,pal){
        const m=commonalityArchive(state.data==="thirty35"?.35:.25),{facts}=m;
        const chart=h("div",{class:"cgc-cost"}),legendArchive=legend.cloneNode(true);
        // Measure the attached active panel before drawing; a detached plot falls back to desktop width.
        archive.replaceChildren(ctx.panelTitle("Three criteria in the recorded draw-based analysis"),chart,legendArchive);
        const data=m.costRows.map((r,k)=>({...r,k,score:r.criterion_id,own:r.own_best_risk,common:r.common_grade_risk,color:pal.crit[k]}));
        plot(chart,{alt:"Archived three-criterion dumbbell chart. Open dots show each criterion's own solved risk; filled dots show its risk under the fixed common report. The dashed line is all-withheld risk. Optimization bounds are recorded in the table.",height:270,marginTop:32,marginBottom:40,marginLeft:68,marginRight:38,
          x:{domain:[0,.75],ticks:[0,.15,.3,.45,.6,.75],label:"risk on that criterion →",grid:true},y:{domain:data.map(r=>r.score),label:null,padding:.45,tickSize:0},
          table:{caption:"Archived common and own criterion risks and optimization cost bounds",columns:[{label:"Criterion",value:"score"},{label:"Own risk",value:"own",format:v=>formatRisk(v)},{label:"Common risk",value:"common",format:v=>formatRisk(v)},{label:"Cost lower",value:"cost_lower",format:v=>formatRisk(v,{digits:17})},{label:"Cost upper",value:"cost_upper",format:v=>formatRisk(v,{digits:17})}],rows:data},
          marks:(c,P)=>[P.ruleX([m.tau],{stroke:c.plotMuted,strokeDasharray:"5 3"}),P.text([m.tau],{x:d=>d,frameAnchor:"top",text:()=>"all withheld (τ)",textAnchor:"end",dx:7,dy:-16,fontSize:12,fill:c.plotMuted}),P.text(data,{x:d=>(d.own+d.common)/2,y:"score",text:()=>"Δ",dx:-30,dy:-17,fontWeight:700,fill:c.plotFg}),numText([m.tau],{x:d=>d,frameAnchor:"top",value:d=>d,format:v=>formatSetting(v),dx:20,dy:-16,fontSize:12,fill:c.plotMuted}),P.link(data,{x1:"own",x2:"common",y1:"score",y2:"score",stroke:"color",strokeWidth:3.5}),P.dot(data,{x:"own",y:"score",r:8,fill:c.plotBg,stroke:"color",strokeWidth:2.5}),P.dot(data,{x:"common",y:"score",r:8,fill:"color",stroke:c.plotBg}),numText(data,{x:d=>(d.own+d.common)/2,y:"score",value:"cost_lower",format:v=>formatRisk(v),dy:-17,fontWeight:700,fill:c.plotFg}),numText(data,{x:"own",y:"score",value:"own",format:v=>formatRisk(v),dx:-12,textAnchor:"end",fontSize:11,fill:c.plotMuted}),numText(data,{x:"common",y:"score",value:"common",format:v=>formatRisk(v),dx:12,textAnchor:"start",fontSize:11,fill:c.plotMuted})],
          keyboard:{data,x:"common",y:"score",title:r=>`${r.score}: own risk ${formatRisk(r.own)}, common risk ${formatRisk(r.common)}, cost interval from optimization bounds ${formatRisk(r.cost_lower,{digits:17})} to ${formatRisk(r.cost_upper,{digits:17})}; own status ${r.own_status}.`}});
        const archivedResult={...facts,empty:false};
        const status=h("p",{class:"cgc-note"},labelNode(ctx,archivedResult,{key:"archived-common"}),"; status ",facts.status,"; lower bound ",ro("archive-lower",facts.lower_bound),"; absolute risk gap ",ro("archive-gap",facts.gap,formatSci),"; bound source ",h("span",{"data-prx-name":"",text:facts.bound_source}),".");
        archive.replaceChildren(ctx.panelTitle("Three criteria in the recorded draw-based analysis"),chart,legendArchive,
          h("p",{},"Common report: ",ro("archive-grade",m.grade,formatGrades),"; ",ro("archive-N",facts.N,formatCount)," of ",ro("archive-M",facts.M,formatCount)," pairs stated; weighted risk ",ro("archive-risk",facts.risk),"."),status,scrollHint(),
          table("Archived common criterion profiles",["Criterion","Weight","Eₖ","Eₖ/N","Eₖ/M","Rₖ"],m.profileRows.map((r,k)=>[r.criterion,ro(`archive-${k}-weight`,r.weight,formatSetting),ro(`archive-${k}-E`,r.E,formatExpectedCount),ro(`archive-${k}-share`,r.E_over_N,formatShare),ro(`archive-${k}-EoverM`,r.E_over_M,formatShare),ro(`archive-${k}-common`,r.risk)])),
          table("Criterion-specific costs: interval endpoints from optimization bounds",["Criterion","Own risk","Own lower bound","Δ lower","Δ upper","Own status","Own grades","Own N","Relation agreement"],data.map((r,k)=>[r.score,ro(`archive-${k}-own`,r.own),ro(`archive-${k}-ownLower`,r.own_lower_bound,v=>formatRisk(v,{digits:17})),ro(`archive-${k}-lower`,r.cost_lower),ro(`archive-${k}-upper`,r.cost_upper),h("span",{},labelNode(ctx,{status:r.own_status},{key:`archive-own-${k}`}),"; ",r.own_status),ro(`archive-${k}-G`,r.own_G,formatCount),ro(`archive-${k}-N`,r.own_disclosures,formatCount),ro(`archive-${k}-agreement`,r.relation_agreement,formatShare)])),
          table("Raw cost interval endpoints (rounding can hide the bound width)",["Criterion","Lower endpoint","Upper endpoint"],data.map((r,k)=>[r.score,ro(`archive-${k}-rawLower`,r.cost_lower,v=>formatRisk(v,{digits:17})),ro(`archive-${k}-rawUpper`,r.cost_upper,v=>formatRisk(v,{digits:17}))])),
          chipRow("The archived common report",m.grade,pal,{ids:m.ids}),h("p",{class:"cgc-note",text:"The archive supplies own risks, bounds, statuses and counts, but no own-report grade vectors or complete tied optimum sets. Own-solve absolute risk gaps were not separately archived; equal rounded endpoints do not establish a zero gap. A zero reported gap is a solver diagnostic, not a numerical certificate. The intervals describe optimization bounds, not posterior uncertainty."}));
        // Archived analysis contains the common grade, not independent Gaussian marginal errors.
        const nameNodes=archive.querySelectorAll('.cgc-chip');for(const node of nameNodes)node.setAttribute('data-prx-name','');
        details.replaceChildren(h("p",{class:"cgc-note"},"Fixed settings: τ = ",ro("archive-tau",m.tau,formatSetting),"; at most ",ro("archive-cap",m.cap,formatCount)," grades; weights ",...Object.entries(m.weights).flatMap(([name,value],i)=>[i?", ":"",name," ",ctx.num(value,formatSetting(value))]),". The saved pr_example_draws analysis uses whole-state draws. The separate thirty-site Gaussian marginal example has different inputs. Live six-site weights do not change this archive."),
          h("p",{class:"cgc-note"},"M counts all pairs; N counts stated pairs; Eₖ counts expected wrong stated directions. Eₖ/N has no denominator for an all-withheld report. Grade ",ctx.num(1,formatCount(1))," is the highest target; a shared grade withholds a direction."),
          h("p",{class:"cgc-note"},captionNode(ctx,"package-quantity"),": the cost carries no welfare meaning, and a large cost does not by itself say that a weight is wrong."));
        ctx.readout.set(["Archived common report: ",ctx.num(facts.N,formatCount(facts.N))," stated pairs. Criterion costs from optimization bounds: ",...data.flatMap((r,k)=>[k?"; ":"",r.score," ",ctx.num(r.cost_lower,formatRisk(r.cost_lower))," to ",ctx.num(r.cost_upper,formatRisk(r.cost_upper))]),"."]);
        // Keep the live region visible alongside the active archive figure.
        chart.after(ctx.readout.node);
        ctx.caption.replaceChildren("Archived pr_example_draws common and own solves, fixed weights/cap/price; recorded optimal status is optimal within solver tolerances. No new solve is run. ",h("span",{class:"cgc-source","data-prx-name":"",text:m.analysis.source.object}),"; ",h("span",{class:"cgc-source","data-prx-name":"",text:m.commonality.source.object}),". ",h("span",{},...m.notice.split(/(\d+(?:\.\d+)?)/).filter(Boolean).map(t=>/^\d/.test(t)?ctx.num(Number(t),t):t)));
      }

      return {
        render(state) {
          source.set(state.data);w.root.hidden=state.data!=="six";liveGrid.hidden=state.data!=="six";archive.hidden=state.data==="six";details.hidden=false;
          const pal = palette(ctx.root);
          if(state.data!=="six"){drawArchive(state,pal);return;}
          costSlot.after(legend,ctx.readout.node);
          ctx.caption.replaceChildren("Six fictional sites, independent Normal posteriors on scores A and B; τ = ",ctx.num(CONFIG.tau,formatSetting(CONFIG.tau)),", at most ",ctx.num(CONFIG.family.G,formatCount(CONFIG.family.G))," grades. All common and own comparisons use this same family and price.");
          w.set(state.w);
          const cc = commonalityCost(ERRORS, { tau: CONFIG.tau, w: [state.w, 1 - state.w], family: CONFIG.family });
          const ties = tiedCommons(cc);
          const data = drawCost(cc, ties, pal);
          const tieMatters = data.some((d) => d.alts.length > 0);
          drawReports(state, cc, ties, tieMatters, pal);
          const cost = (v) => (v > 0 ? ctx.num(v, formatRisk(v)) : "nothing");
          if (!tieMatters) {
            const [ra, rb] = cc.criteria;
            ctx.readout.set([
              "One common report costs score A ", cost(ra.delta), " and score B ", cost(rb.delta),
              " more risk than each would pick alone.",
            ]);
            return;
          }
          // tied common reports with different costs: each cost; two reports are "one" (the one the panel shows) and
          // "the other", more are named
          const n = ties.length;
          const parts = [n === 2 ? "Two" : ctx.num(n, formatCount(n)), " common reports tie: "];
          data.forEach((d, i) => {
            if (i) parts.push("; ");
            parts.push(`${d.score} pays `);
            if (!d.alts.length) { parts.push(cost(d.delta), n === 2 ? "" : " under each"); return; }
            if (n === 2) {
              parts.push(ctx.num(ties[0].delta[d.k], formatRisk(ties[0].delta[d.k])), " under one and ",
                ctx.num(ties[1].delta[d.k], formatRisk(ties[1].delta[d.k])), " under the other");
              return;
            }
            ties.forEach((t, j) => {
              if (j) parts.push(j === n - 1 ? " and " : ", ");
              parts.push(ctx.num(t.delta[d.k], formatRisk(t.delta[d.k])), " under ", h("span", { class: "cgc-nowrap" }, blocksText(t.grade)));
            });
          });
          parts.push(".");
          ctx.readout.set(parts);
        },
      };
    },
  });
}
