// Author: JoonHo Lee (jlee296@ua.edu).
// The common diagonal and full product are compared under one explicit P2 decision.
import { createWidget } from "../shared/base.js";
import { formatCount } from "../shared/format.js";
import { mdomainExample, mdomainInput, mdomainFamily, mdomainSolve, mdomainEvaluate } from "../pr-core.js";
import { exactNum, gradeTable, profileGrid, pairTable, candidateIdNode, optimizerSummaryNode, resultScopeNode } from "../shared/mdomain/index.js";
import { exactDifference, selectEvaluatedSubset } from "../shared/mdomain/compare.js";
import {VISUAL_CSS, createVisualFrame, scene, svgNode, svgText, svgExact, svgCount, reportButton} from "../shared/mdomain/visual.js";

const ACTIONS = [{ name: "Withhold", vector: "1,1" }, { name: "A ahead", vector: "1,2" }, { name: "B ahead", vector: "2,1" }];
const CARDS = ACTIONS.flatMap((s) => ACTIONS.map((c) => ({ id: `p:${s.vector}|${c.vector}`, label: `S: ${s.name}; C: ${c.name}` })));
export const PROFILE_COMMON_KEYS = {
  law: { type: "choice", values: ["aligned", "crossed"], value: "crossed" },
  tauIndex: { type: "integer", min: 0, max: 2, step: 1, value: 2 },
  weightIndex: { type: "integer", min: 0, max: 1, step: 1, value: 0 },
  unit: { type: "choice", values: ["A", "B"], value: "A" },
  report: { type: "choice", values: ["common", "profile"], value: "profile" },
  candidate: { type: "choice", values: ["canonical", ...CARDS.map((card) => card.id)], value: "canonical" },
};

const cache = new Map();

/** Complete candidate evaluation is cached by scientific settings, never by inspection. */
export function solveProfileCommon(state = {}) {
  const law = state.law ?? "crossed", tauIndex = state.tauIndex ?? 2, weightIndex = state.weightIndex ?? 0;
  const key = `${law}:${tauIndex}:${weightIndex}`;
  let solved = cache.get(key);
  if (!solved) {
    const request = mdomainExample("common", { law, tauIndex, weightIndex });
    const input = mdomainInput(request.input), family = mdomainFamily(input, request.family);
    const fit = mdomainSolve(input, family, request.decision);
    const diagonalIds = fit.candidateTable.filter((row) => row.grades.values.every((values) => values.every((value) => value === values[0]))).map((row) => row.candidateId);
    const common = selectEvaluatedSubset(fit, diagonalIds, { comparisonId: "common-diagonal" });
    const evaluations = new Map(fit.candidateTable.map((row) => [row.candidateId, mdomainEvaluate(input, row.grades, request.decision)]));
    solved = { request, input, fit, common, diagonalIds, evaluations, gapExact: exactDifference(common.riskExact, fit.riskExact) };
    cache.set(key, solved);
  }
  const report = state.report ?? "profile";
  if (report !== "common" && report !== "profile") throw new RangeError("Choose the common or profile report space.");
  const comparison = report === "common" ? solved.common : solved.fit;
  const candidate = state.candidate ?? "canonical";
  const focusedId = candidate === "canonical" ? comparison.selectedId : candidate;
  const inFamily = report === "common" ? solved.diagonalIds.includes(focusedId) : solved.evaluations.has(focusedId);
  return { ...solved, comparison, focusedId, focus: inFamily ? solved.evaluations.get(focusedId) : null, needsNormalization: !inFamily };
}

const CSS = `${VISUAL_CSS}
.pcd{min-width:0}.pcd select{min-height:44px}.pcd .pcd-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,23rem),1fr));gap:1rem;min-width:0}
.pcd .pcd-panel{min-width:0;margin:.8rem 0}.pcd .pcd-note{font-size:.88rem;line-height:1.45}
.pcd .pcd-optima{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0}.pcd .pcd-scroll{overflow-x:auto;max-width:100%;min-width:0}
.pcd .pcd-table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;font-size:.88rem}.pcd .pcd-table th,.pcd .pcd-table td{padding:.35rem;text-align:left;white-space:nowrap;border-bottom:1px solid var(--prx-border)}
.pcd .pcd-visual-optima{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.4rem;padding:0 .5rem .55rem;color:var(--prx-plot-fg)}
.pcd .pcd-visual-optima section{min-width:0}.pcd .pcd-visual-optima h4{margin:0;text-align:center;font-size:max(14px,.85rem);font-weight:600}.pcd .pcd-visual-optima .mdv-optima{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));justify-items:center;align-items:start;padding:.4rem 0 0;gap:.35rem}.pcd .pcd-visual-optima .mdv-report-button{width:100%;min-width:0;max-width:190px;padding:.3rem .4rem}.pcd .pcd-visual-optima .mdv-report-line{font-size:max(14px,.85rem)}.pcd .pcd-visual-optima .mdv-report-label{font-size:14px}
`;

const named = (ctx, text) => ctx.h("span", { "data-prx-name": true }, text);
function number(ctx, value, hook) { const node = ctx.num(value, formatCount(value)); if (hook) node.dataset.prxReadout = hook; return node; }
function exact(ctx, value, hook) { const node = exactNum(ctx, value); if (hook) node.dataset.prxReadout = hook; return node; }
function panel(ctx, title) { return ctx.h("section", { class: "pcd-panel" }, ctx.panelTitle(title)); }

function losses(ctx, evaluation, weights) {
  const rows = evaluation.domains.map((domain, d) => ctx.h("tr", {},
    ctx.h("th", { scope: "row" }, named(ctx, domain.domainId)),
    ctx.h("td", {}, number(ctx, evaluation.originalPairs, `inspected-M-${d}`)),
    ctx.h("td", {}, number(ctx, domain.disclosedPairs, `inspected-N-${d}`)),
    ctx.h("td", {}, exact(ctx, domain.expectedFalseCountExact, `inspected-EF-${d}`)),
    ctx.h("td", {}, exact(ctx, domain.expectedFalseProportionExact, `inspected-ratio-${d}`)),
    ctx.h("td", {}, exact(ctx, domain.lossExact, `inspected-loss-${d}`)),
    ctx.h("td", {}, exact(ctx, weights[d], `inspected-weight-${d}`)),
    ctx.h("td", {}, exact(ctx, domain.weightedLossExact, `inspected-weighted-loss-${d}`))));
  const table = ctx.h("table", { class: "pcd-table" }, ctx.h("caption", {}, "Domain losses of the inspected card"),
    ctx.h("thead", {}, ctx.h("tr", {}, ["Domain", "Original pairs", "Disclosed pairs", "Expected false", "Expected false / disclosed", "Domain loss", "Weight", "Weighted contribution"].map((text) => ctx.h("th", { scope: "col" }, text)))), ctx.h("tbody", {}, rows));
  return ctx.scrollRegion(ctx.h("div", { class: "pcd-scroll" }, table), "Inspected-card domain loss and disclosure table");
}

// Coordinates are a display projection only; exact engine results determine the reports and losses.
const coordinate = raw => {const [n,d='1']=raw.split('/');return Number(n)/Number(d);};
function drawReportComparison(ctx, visual, result, onInspect) {
  const {svg,figure,width,colors}=scene(ctx,visual.stage,{height:340,label:'Canonical common and profile grade rungs, with minimum expected losses on the same zero-based scale.'});
  figure.insertBefore(ctx.h('figcaption',{},'Sites A and B · S composition · C community. Grade ',number(ctx,1),' is higher. A → B puts A first. Equal grades withhold the direction.'),svg);
  const half=width/2, gradeY=g=>g===1?105:167;
  const families=[{key:'common',label:'Common',comparison:result.common},{key:'profile',label:'Profiles',comparison:result.fit}];
  families.forEach((family,k)=>{
    const origin=k*half, grades=result.evaluations.get(family.comparison.selectedId).grades;
    svg.append(svgText(ctx,origin+half/2,26,family.label,{'text-anchor':'middle','font-size':18,'font-weight':600}));
    const centers=[origin+half*.38,origin+half*.78];
    for(const g of [1,2])svg.append(svgCount(ctx,origin+13,gradeY(g)+5,g,{'font-size':15,'aria-label':`Grade ${g}`}));
    grades.domainIds.forEach((domain,d)=>{
      const x=centers[d];svg.append(svgText(ctx,x,64,domain,{'text-anchor':'middle','font-size':16,'font-weight':600}),svgNode(ctx,'line',{x1:x,x2:x,y1:gradeY(1),y2:gradeY(2),stroke:colors.plotGrid,'stroke-width':2}));
      for(const g of [1,2])svg.append(svgNode(ctx,'line',{x1:x-23,x2:x+23,y1:gradeY(g),y2:gradeY(g),stroke:colors.plotAxis,'stroke-width':1.4}));
      const tied=grades.values[0][d]===grades.values[1][d];
      grades.unitIds.forEach((id,u)=>{
        const g=grades.values[u][d],px=x+(tied?(u===0?-12:12):0),py=gradeY(g);
        const attributes={'data-mdv-role':`${family.key}-grade`,'data-mdv-exact':String(g),'data-mdv-unit':id,'data-mdv-domain':domain,'data-pcd-canonical':family.comparison.selectedId,stroke:colors.plotFg,'stroke-width':1.6,fill:u===0?colors.plotFg:colors.plotBg};
        const mark=u===0?svgNode(ctx,'circle',{cx:px,cy:py,r:11.5,...attributes}):svgNode(ctx,'rect',{x:px-11.5,y:py-11.5,width:23,height:23,...attributes});
        mark.append(svgNode(ctx,'title',{},`${family.label}, ${domain}: ${id}, grade ${g}.`));
        svg.append(mark,svgText(ctx,px,py+5,id,{'font-size':15,'font-weight':600,'text-anchor':'middle',fill:u===0?colors.plotBg:colors.plotFg,'data-prx-name':''}));
      });
    });
  });
  svg.append(svgNode(ctx,'line',{x1:half,x2:half,y1:12,y2:190,stroke:colors.plotGrid,'stroke-width':1.5}));
  const left=23,span=width-46,max='1/4';
  svg.setAttribute('data-pcd-loss-left',String(left));svg.setAttribute('data-pcd-loss-width',String(span));svg.setAttribute('data-pcd-loss-max',max);
  for(const[family,k]of families.map((f,i)=>[f,i])){
    const y=222+k*49,raw=family.comparison.riskExact;
    svg.append(svgText(ctx,left,y,family.label+' loss',{'font-size':15}),svgExact(ctx,width-left,y,raw,{}, {'font-size':16,'font-weight':600,'text-anchor':'end'}));
    svg.append(svgNode(ctx,'rect',{x:left,y:y+8,width:span,height:17,rx:2,fill:colors.plotBg,stroke:colors.plotGrid}),svgNode(ctx,'rect',{x:left,y:y+8,width:coordinate(raw)/coordinate(max)*span,height:17,rx:2,fill:k===0?colors.wh:colors.accent,stroke:colors.plotFg,'data-mdv-role':`${family.key}-loss`,'data-mdv-exact':raw}));
  }
  svg.append(svgNode(ctx,'line',{x1:left,x2:width-left,y1:311,y2:311,stroke:colors.plotAxis}),svgExact(ctx,left,334,'0',{}, {'font-size':15}),svgText(ctx,width/2,334,'Expected loss',{'font-size':15,'text-anchor':'middle'}),svgExact(ctx,width-left,334,max,{}, {'font-size':15,'text-anchor':'end'}));
  const optima=ctx.h('div',{class:'pcd-visual-optima'});
  for(const family of families){
    const group=ctx.h('section',{'aria-label':family.label+' exact optima'},ctx.h('h4',{},family.label+' optima · ',number(ctx,family.comparison.optimizerIds.length))),buttons=ctx.h('div',{class:'mdv-optima'});
    for(const id of family.comparison.optimizerIds){
      const button=reportButton(ctx,result.evaluations.get(id).grades,{id,key:`visual-${family.key}:${id}`,label:family.comparison.selectedId===id?'Canonical optimum':'Also optimal',selected:ctx.state.report===family.key&&result.focusedId===id,onSelect:()=>onInspect(family.key,id)});
      button.dataset.pcdFamily=family.key;button.dataset.pcdOptimizer=id;button.dataset.pcdCanonical=String(id===family.comparison.selectedId);buttons.append(button);
    }
    group.append(buttons);optima.append(group);
  }
  const family=families.find(entry=>entry.key===ctx.state.report);
  const directions=result.focus.grades.domainIds.map((domain,d)=>{
    const [a,b]=result.focus.grades.values.map(grades=>grades[d]);
    return `${domain} ${a===b?'withheld':a<b?'A above B':'B above A'}`;
  });
  figure.append(optima,ctx.h('p',{class:'mdv-inspector','data-pcd-visual-inspector':''},'Inspecting ',family.label.toLowerCase(),' · ',directions.join(' · '),' · loss ',exactNum(ctx,result.focus.riskExact),'.'));
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, { name: "profile-common-vs-domain", className: "pcd", css: CSS, keys: PROFILE_COMMON_KEYS,
    build(ctx) {
      const law = ctx.select({ label: "Priority pattern", options: [{ value: "aligned", label: "Aligned priorities" }, { value: "crossed", label: "Crossed priorities" }], value: ctx.state.law, onChange: (value) => ctx.set({ law: value, candidate: "canonical" }) });
      const tau = ctx.select({ label: "Withholding cost", options: [{ value: 0, label: "1/20" }, { value: 1, label: "1/10" }, { value: 2, label: "1/4" }], value: ctx.state.tauIndex, onChange: (value) => ctx.set({ tauIndex: value, candidate: "canonical" }) });
      const weight = ctx.select({ label: "Domain weights (S; C)", options: [{ value: 0, label: "Equal weights" }, { value: 1, label: "Greater weight on S" }], value: ctx.state.weightIndex, onChange: (value) => ctx.set({ weightIndex: value, candidate: "canonical" }) });
      // Native option faces carry the exact setting when audited inside the disclosure.
      ['1/20','1/10','1/4'].forEach((raw,i)=>{const label=exactNum(ctx,raw);for(const a of label.attributes)tau.input.options[i].setAttribute(a.name,a.value);});
      ctx.controls.append(law.root, tau.root, weight.root);
      ctx.charts.before(ctx.readout.node);
      const policy = ctx.h("p", { class: "pcd-note" }); ctx.charts.append(policy);
      const comparisons = ctx.h("div", { class: "pcd-layout" }), commonPanel = panel(ctx, "One common grade column"), profilePanel = panel(ctx, "Separate domain grade columns");
      comparisons.append(commonPanel, profilePanel); ctx.charts.append(comparisons);
      const detail = panel(ctx, "Inspect a report card"); ctx.charts.append(detail);
      const report = ctx.select({ label: "Report space to inspect", options: [{ value: "common", label: "Common cards" }, { value: "profile", label: "Domain profiles" }], value: ctx.state.report, onChange: (value) => ctx.set({ report: value, candidate: "canonical" }) });
      const candidate = ctx.select({ label: "Card to inspect", options: [{ value: "canonical", label: "Canonical minimum-risk representative" }, ...CARDS.map((card) => ({ value: card.id, label: card.label }))], value: ctx.state.candidate, onChange: (value) => ctx.set({ candidate: value }) });
      const unit = ctx.select({ label: "Highlight unit", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }], value: ctx.state.unit, onChange: (value) => ctx.set({ unit: value }) });
      const inspectionControls = ctx.h("div", { class: "prx-controls" }, report.root, candidate.root, unit.root);
      const inspectionBody = ctx.h("div"), optimalButtons = ctx.h("div", { class: "pcd-optima" });
      detail.append(inspectionControls, optimalButtons, inspectionBody);
      const visual=createVisualFrame(ctx,{mainControl:law.root});
      return { render(state) {
        const result = solveProfileCommon(state);
        if (result.needsNormalization) { ctx.set({ candidate: "canonical" }); return; }
        visual.sync();
        law.set(state.law); tau.set(state.tauIndex); weight.set(state.weightIndex); report.set(state.report); candidate.set(state.candidate); unit.set(state.unit);
        for (let i = 1; i < candidate.input.options.length; i += 1) candidate.input.options[i].disabled = state.report === "common" && !result.diagonalIds.includes(CARDS[i - 1].id);
        const { request, fit, common, focus } = result;
        policy.replaceChildren("Both report spaces use the same complete finite teaching law, original pairs and policy. S and C weights are ", exact(ctx, request.decision.weights[0], "weight-S"), " and ", exact(ctx, request.decision.weights[1], "weight-C"), "; both withholding costs are ", exact(ctx, request.decision.tau[0], "tau"), ". Expected-error guards and joint protection are disabled.");
        visual.auditReadout.set(["Among ", number(ctx, common.candidateIds.length, "common-count"), " common cards, the minimum risk is ", exact(ctx, common.riskExact, "common-risk"), " with ", number(ctx, common.optimizerIds.length, "common-optimizer-count"), (common.optimizerIds.length === 1 ? " exact optimizer. Among " : " exact optimizers. Among "), number(ctx, fit.searchScope.candidateCount, "profile-count"), " domain profiles, minimum risk is ", exact(ctx, fit.riskExact, "profile-risk"), " with ", number(ctx, fit.optimizerIds.length, "profile-optimizer-count"), (fit.optimizerIds.length === 1 ? " exact optimizer. The common-minus-profile risk difference is " : " exact optimizers. The common-minus-profile risk difference is "), exact(ctx, result.gapExact, "risk-gap"), "."]);
        const commonEvaluation = result.evaluations.get(common.selectedId), profileEvaluation = result.evaluations.get(fit.selectedId);
        commonPanel.replaceChildren(ctx.panelTitle("One common grade column"), resultScopeNode(ctx, common, { kind: "subset", part: "common-scope" }), optimizerSummaryNode(ctx, common, { part: "common-optimizers" }), gradeTable(ctx, commonEvaluation.grades, { caption: "Canonical common-card grades", part: "common-grades" }));
        profilePanel.replaceChildren(ctx.panelTitle("Separate domain grade columns"), resultScopeNode(ctx, fit), optimizerSummaryNode(ctx, fit), gradeTable(ctx, profileEvaluation.grades, { caption: "Canonical profile grades", part: "canonical-profile-grades" }));
        optimalButtons.replaceChildren(...result.comparison.optimizerIds.map((id) => ctx.h("button", { type: "button", class: "prx-btn", "data-prx-focus-key": `common-optimum:${id}`, "aria-pressed": result.focusedId === id ? "true" : "false", onclick: () => ctx.set({ candidate: id }) }, "Inspect ", candidateIdNode(ctx, id))));
        const isOptimal = result.comparison.optimizerIds.includes(result.focusedId);
        inspectionBody.replaceChildren(ctx.h("p", {}, "Inspected card ", candidateIdNode(ctx, result.focusedId), "; risk ", exact(ctx, focus.riskExact, "inspected-risk"), ". ", ctx.h("strong", { "data-prx-readout": "inspected-status" }, isOptimal ? "An exact optimizer in this report space." : "A fixed candidate outside the minimum-risk set."), " Highlighted unit: ", named(ctx, state.unit), "."), resultScopeNode(ctx, focus, { kind: "fixed", part: "inspected-scope" }),
          gradeTable(ctx, focus.grades, { selectedUnit: state.unit, onSelectUnit: (id) => ctx.set({ unit: id }), part: "inspected-grades" }),
          profileGrid(ctx, focus.grades, { selectedUnit: state.unit, onSelectCell: (cell) => { if (cell.members.length) ctx.set({ unit: cell.members[0] }); }, part: "inspected-profile-cells" }),
          pairTable(ctx, focus.grades), losses(ctx, focus, request.decision.weights),
          ctx.h("p", { class: "pcd-note" }, "Grade one ranks highest in each domain. A shared grade leaves a comparison unstated. Each grade describes its own domain. The loss divides by all original pairs. The expected error share divides by stated pairs, so there is no error share when the report withholds every pair. This example evaluates loss with the joint cap disabled."));
        drawReportComparison(ctx,visual,result,(family,id)=>ctx.set({report:family,candidate:id}));
        ctx.readout.set(result.gapExact==='0'?'Same minimum expected loss in both spaces.':['Profiles reduce expected loss by ',exactNum(ctx,result.gapExact),'.']);
        visual.setScope(['Same law and loss · cost ',exactNum(ctx,request.decision.tau[0]),' · S/C weights ',exactNum(ctx,request.decision.weights[0]),' / ',exactNum(ctx,request.decision.weights[1]),' · guards off. ',number(ctx,common.candidateIds.length),' common cards / ',number(ctx,fit.searchScope.candidateCount),' profiles. No overall profile order.']);
      } };
    },
  });
}
