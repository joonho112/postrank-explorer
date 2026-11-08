// Author: JoonHo Lee (jlee296@ua.edu).
// A fixed finite-law family and candidate bank, with exact joint budgets.
import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { formatCount } from "../shared/format.js";
import { mdomainExample, mdomainInput, mdomainFamily, mdomainSolve, mdomainEvaluate } from "../pr-core.js";
import { exactNum, gradeTable, profileGrid, pairTable, candidateTable, optimizerSummaryNode, resultScopeNode } from "../shared/mdomain/index.js";
import { VISUAL_CSS, createVisualFrame, scene, svgNode, svgText, svgExact, svgCount, setSliderFace, reportButton } from "../shared/mdomain/visual.js";

const ACTIONS = [{ name: "Withhold", vector: "1,1" }, { name: "A ahead", vector: "1,2" }, { name: "B ahead", vector: "2,1" }];
const CARDS = ACTIONS.flatMap((s) => ACTIONS.map((c) => ({ id: `p:${s.vector}|${c.vector}`, label: `S: ${s.name}; C: ${c.name}` })));
export const PROFILE_RESOLUTION_KEYS = {
  noiseIndex: { type: "integer", min: 0, max: 2, step: 1, value: 1 },
  budgetIndex: { type: "integer", min: 0, max: 6, step: 1, value: 3 },
  candidate: { type: "choice", values: ["canonical", ...CARDS.map((card) => card.id)], value: "canonical" },
};
const cache = new Map();

/** Every frontier row changes alpha only. Inspection cannot change its optimizers. */
export function solveProfileResolution(state = {}) {
  const noiseIndex = state.noiseIndex ?? 1, budgetIndex = state.budgetIndex ?? 3;
  mdomainExample("resolution", { noiseIndex, budgetIndex });
  let model = cache.get(noiseIndex);
  if (!model) {
    const rows = Array.from({ length: 7 }, (_, index) => {
      const request = mdomainExample("resolution", { noiseIndex, budgetIndex: index });
      const input = mdomainInput(request.input), family = mdomainFamily(input, request.family), fit = mdomainSolve(input, family, request.decision);
      const evaluations = new Map(fit.candidateTable.map((row) => [row.candidateId, mdomainEvaluate(input, row.grades, request.decision)]));
      const selected = fit.candidateTable.find((row) => row.selected);
      return { request, input, fit, evaluations, summary: {
        budgetIndex: index, alphaExact: request.decision.alpha, riskExact: fit.riskExact,
        jointProbabilityExact: fit.jointProbabilityExact, gradeCounts: [...selected.gradeCounts],
        disclosedCounts: [...selected.disclosedCounts], selectedId: fit.selectedId,
        optimizerIds: [...fit.optimizerIds], feasibleCount: fit.candidateTable.filter((row) => row.feasible).length,
      } };
    });
    model = { rows, path: rows.map((row) => row.summary) }; cache.set(noiseIndex, model);
  }
  const current = model.rows[budgetIndex], candidate = state.candidate ?? "canonical";
  const focusedId = candidate === "canonical" ? current.fit.selectedId : candidate;
  const focus = current.evaluations.get(focusedId);
  if (!focus) throw new RangeError("Choose a candidate in the declared profile bank.");
  return { ...current, path: model.path, focusedId, focus };
}

const CSS = `${VISUAL_CSS}
.prr{min-width:0}.prr .prr-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:1rem;min-width:0}
.prr .prr-panel{min-width:0;margin:.8rem 0}.prr .prr-note{font-size:.88rem;line-height:1.45}.prr .prr-scroll{overflow-x:auto;max-width:100%;min-width:0}
.prr .prr-table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;font-size:.88rem}.prr .prr-table th,.prr .prr-table td{padding:.35rem;text-align:left;white-space:nowrap;border-bottom:1px solid var(--prx-border)}
.prr .prr-current{background:var(--prx-bg-raised)}.prr .prr-budget[aria-pressed=true]{outline:2px solid var(--prx-accent);outline-offset:1px}.prr .prr-budget:focus-visible{outline:3px solid var(--prx-focus)}
.prr select{min-height:44px}.prr .prr-track-point{cursor:pointer;outline:none}.prr .prr-track-point:focus .prr-track-hit{stroke:var(--prx-plot-focus);stroke-width:3}
.prr .prr-visual-optima-title{margin:.1rem .8rem;text-align:center;font-size:max(14px,.85rem);color:var(--prx-plot-fg)}
`;
const named = (ctx, text) => ctx.h("span", { "data-prx-name": true }, text);
function number(ctx, value, hook) { const node = ctx.num(value, formatCount(value)); if (hook) node.dataset.prxReadout = hook; return node; }
function exact(ctx, value, hook) { const node = exactNum(ctx, value); if (hook) node.dataset.prxReadout = hook; return node; }
const panel = (ctx, title) => ctx.h("section", { class: "prr-panel" }, ctx.panelTitle(title));
// Coordinates are display projections only; exact fractions determine all scientific results.
function coordinate(raw) { const [n, d = "1"] = raw.split("/"); return Number(n) / Number(d); }
function capDigits(raw) { const [n, d = "1"] = raw.split("/"); return (100n * BigInt(n)) % BigInt(d) === 0n ? 0 : 1; }
function region(ctx, node, caption) { return ctx.scrollRegion(ctx.h("div", { class: "prr-scroll" }, node), caption); }
function table(ctx, caption, headers, rows) { return ctx.h("table", { class: "prr-table" }, ctx.h("caption", {}, caption), ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((header) => ctx.h("th", { scope: "col" }, header)))), ctx.h("tbody", {}, ...rows)); }

// Only evaluated budgets are marked. No interpolation asserts results between them.
function drawBudgetTrack(ctx, visual, result, state) {
  const {svg,figure,width,colors}=scene(ctx,visual.stage,{height:384,label:'Seven evaluated joint caps: minimum expected loss and occupied grade counts of canonical reports in S and C.'});
  svg.setAttribute('role','group');
  const tighter=result.path[3],larger=result.path[5];
  const gradeCounts=row=>[number(ctx,row.gradeCounts[0]),'/',number(ctx,row.gradeCounts[1])];
  figure.insertBefore(ctx.h('figcaption',{},'S composition · C community. ',number(ctx,2),' grades state the direction. Same law and loss.',
    ...(state.noiseIndex===1?[ctx.h('div',{},'S/C detail moves from ',...gradeCounts(tighter),' at ',exactNum(ctx,tighter.alphaExact),' to ',...gradeCounts(larger),' at ',exactNum(ctx,larger.alphaExact),'.')]:[])),svg);
  const left=40,span=width-left-23,maxAlpha='3/20',maxRisk='1/4',riskTop=49,riskBottom=153;
  const x=alpha=>left+coordinate(alpha)/coordinate(maxAlpha)*span;
  const riskY=risk=>riskBottom-coordinate(risk)/coordinate(maxRisk)*(riskBottom-riskTop);
  const gradeY=(domain,count)=>domain===0?(count===2?218:246):(count===2?286:314);
  svg.setAttribute('data-prr-alpha-left',left);svg.setAttribute('data-prr-alpha-width',span);svg.setAttribute('data-prr-alpha-max',maxAlpha);
  svg.setAttribute('data-prr-risk-top',riskTop);svg.setAttribute('data-prr-risk-bottom',riskBottom);svg.setAttribute('data-prr-risk-max',maxRisk);
  const selectedX=x(result.summary.alphaExact);
  const selectionLine={x1:selectedX,x2:selectedX,stroke:colors.plotMuted,'stroke-width':1.5,'stroke-dasharray':'4 3'};
  svg.append(svgNode(ctx,'line',{...selectionLine,y1:38,y2:157,'data-mdv-role':'budget-selection','data-mdv-alpha':result.summary.alphaExact}),
    svgNode(ctx,'line',{...selectionLine,y1:200,y2:328}));
  svg.append(svgText(ctx,16,23,'Minimum expected loss',{'font-size':15,'font-weight':600}),svgExact(ctx,width-15,23,result.fit.riskExact,{}, {'font-size':16,'text-anchor':'end','font-weight':600,'data-mdv-role':'selected-risk'}));
  for(const raw of['0','1/8','1/4']){
    const yy=riskY(raw);svg.append(svgNode(ctx,'line',{x1:left,x2:left+span,y1:yy,y2:yy,stroke:colors.plotGrid,'stroke-width':1}),svgExact(ctx,left-8,yy+5,raw,{}, {'font-size':15,'text-anchor':'end'}));
  }
  svg.append(svgText(ctx,16,187,'Canonical occupied grades',{'font-size':15,'font-weight':600}));
  for(let d=0;d<2;d++){
    svg.append(svgText(ctx,7,d===0?238:306,result.input.domainIds[d],{'font-size':17,'font-weight':600}));
    for(const count of[1,2])svg.append(svgNode(ctx,'line',{x1:left,x2:left+span,y1:gradeY(d,count),y2:gradeY(d,count),stroke:colors.plotGrid,'stroke-width':1}),svgCount(ctx,left-8,gradeY(d,count)+5,count,{dx:-4,'font-size':15,'text-anchor':'end'}));
  }
  for(const row of result.path){
    const xx=x(row.alphaExact),selected=row.budgetIndex===state.budgetIndex;
    svg.append(svgNode(ctx,'line',{x1:xx,x2:xx,y1:riskBottom,y2:riskY(row.riskExact),stroke:colors.plotFg,'stroke-width':selected?2.5:1.5}));
    const point=svgNode(ctx,'g',{class:'prr-track-point',role:'button',tabindex:selected?0:-1,'aria-pressed':String(selected),'aria-label':`Select joint cap ${row.alphaExact}; minimum loss ${row.riskExact}; canonical grade counts S ${row.gradeCounts[0]}, C ${row.gradeCounts[1]}.`,'data-prx-focus-key':`budget-track:${row.budgetIndex}`,'data-mdv-budget-index':row.budgetIndex});
    point.append(svgNode(ctx,'rect',{class:'prr-track-hit','data-prx-focus-ring':'',x:xx-22,y:riskY(row.riskExact)-22,width:44,height:44,rx:5,fill:'transparent',stroke:'transparent'}));
    point.append(svgNode(ctx,'circle',{cx:xx,cy:riskY(row.riskExact),r:selected?6:4,fill:selected?colors.accent:colors.plotFg,stroke:colors.plotFg,'stroke-width':1.2,'data-mdv-role':'risk-point','data-mdv-alpha':row.alphaExact,'data-mdv-exact':row.riskExact,'data-mdv-budget-index':row.budgetIndex,'data-mdv-selected':String(selected)}));
    point.addEventListener('click',()=>ctx.set({budgetIndex:row.budgetIndex,candidate:'canonical'}));
    point.addEventListener('keydown',event=>{
      const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      if(event.key==='Enter'||event.key===' '){event.preventDefault();ctx.set({budgetIndex:row.budgetIndex,candidate:'canonical'});return;}
      if(direction===undefined&&event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?6:Math.max(0,Math.min(6,row.budgetIndex+direction));ctx.set({budgetIndex:next,candidate:'canonical'});visual.stage.querySelector(`[data-prx-focus-key="budget-track:${next}"]`)?.focus?.();
    });svg.append(point);
    row.gradeCounts.forEach((count,d)=>{
      const yy=gradeY(d,count),attributes={fill:selected?colors.crit[d]:colors.plotBg,stroke:colors.plotFg,'stroke-width':selected?2:1.5,'data-mdv-role':'grade-count-point','data-mdv-alpha':row.alphaExact,'data-mdv-budget-index':row.budgetIndex,'data-mdv-domain':result.input.domainIds[d],'data-mdv-exact':String(count),'data-mdv-canonical':row.selectedId};
      svg.append(d===0?svgNode(ctx,'rect',{x:xx-5,y:yy-5,width:10,height:10,...attributes}):svgNode(ctx,'path',{d:`M${xx},${yy-6}l6,6l-6,6l-6,-6Z`,...attributes}));
    });
    svg.append(svgNode(ctx,'line',{x1:xx,x2:xx,y1:338,y2:344,stroke:colors.plotAxis}),svgExact(ctx,xx,362,row.alphaExact,{style:'percent',digits:capDigits(row.alphaExact)},{'font-size':15,'text-anchor':'middle','data-mdv-role':'budget-tick','data-mdv-budget-index':row.budgetIndex}));
  }
  svg.append(svgNode(ctx,'line',{x1:left,x2:left+span,y1:338,y2:338,stroke:colors.plotAxis,'stroke-width':1.5}),svgText(ctx,(left+width-23)/2,382,'Joint error cap',{'font-size':15,'text-anchor':'middle'}));
  const heading=ctx.h('p',{class:'prr-visual-optima-title'},'Exact optima · ',number(ctx,result.fit.optimizerIds.length));
  const optima=ctx.h('div',{class:'mdv-optima'});
  for(const id of result.fit.optimizerIds){const button=reportButton(ctx,result.evaluations.get(id).grades,{id,key:`resolution-visual:${id}`,label:id===result.fit.selectedId?'Canonical optimum':'Also optimal',selected:result.focusedId===id,onSelect:()=>ctx.set({candidate:id})});button.dataset.prrOptimizer=id;button.dataset.prrCanonical=String(id===result.fit.selectedId);optima.append(button);}
  const card=CARDS.find(row=>row.id===result.focusedId);
  figure.append(heading,optima,ctx.h('p',{class:'mdv-inspector','data-prr-visual-inspector':''},'Inspecting ',named(ctx,card.label),' · loss ',exactNum(ctx,result.focus.riskExact),' · joint error ',exactNum(ctx,result.focus.jointProbabilityExact),'. Equal grades withhold.'));
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, { name: "profile-resolution", className: "prr", css: CSS, keys: PROFILE_RESOLUTION_KEYS,
    build(ctx) {
      const noise = ctx.select({ label: "Posterior reversal scenario", options: [{ value: 0, label: "No posterior reversals" }, { value: 1, label: "Baseline posterior reversals" }, { value: 2, label: "More posterior reversals" }], value: ctx.state.noiseIndex, onChange: (value) => ctx.set({ noiseIndex: value, candidate: "canonical" }) });
      const budget = ctx.slider({ label: "Joint error cap", ...ctx.key("budgetIndex"), onInput: (value) => ctx.set({ budgetIndex: value, candidate: "canonical" }) });
      const candidate = ctx.select({ label: "Inspect a card (S; C)", options: [{ value: "canonical", label: "Canonical minimum-risk representative" }, ...CARDS.map((card) => ({ value: card.id, label: card.label }))], value: ctx.state.candidate, onChange: (value) => ctx.set({ candidate: value }) });
      ctx.controls.append(noise.root, budget.root, candidate.root); ctx.charts.before(ctx.readout.node);
      const policy = ctx.h("p", { class: "prr-note" }); ctx.charts.append(policy);
      const graphs = ctx.h("div", { class: "prr-layout" }), riskPanel = panel(ctx, "Minimum risk across the budget grid"), gradesPanel = panel(ctx, "Occupied grades in each domain");
      const riskSlot = ctx.h("div"), gradeSlot = ctx.h("div"); riskPanel.append(riskSlot); gradesPanel.append(gradeSlot, ctx.h("p", { class: "prr-note" }, "Each marked budget shows the number of grades used in each domain by the lowest-risk report displayed first.")); graphs.append(riskPanel, gradesPanel); ctx.charts.append(graphs);
      const frontier = panel(ctx, "All budgets under the current law"), law = panel(ctx, "The complete reversal law"), selected = panel(ctx, "All minimum-risk feasible profiles"), inspected = panel(ctx, "The inspected fixed card");
      ctx.charts.append(frontier, law, selected, inspected);
      const visual=createVisualFrame(ctx,{mainControl:budget.root});
      visual.dataBody.insertBefore(ctx.h('div',{class:'prx-controls'},candidate.root),policy);
      let riskChart, gradeChart, budgetButtons = [];
      function focusBudget(index) { budgetButtons.find((button) => Number(button.dataset.budgetIndex) === index)?.focus(); }
      return { render(state) {
        noise.set(state.noiseIndex); budget.set(state.budgetIndex); candidate.set(state.candidate);visual.sync();
        const r = solveProfileResolution(state), { request, input, fit, path, focus } = r, summary = r.summary;
        const canonical = r.evaluations.get(fit.selectedId), dual = r.evaluations.get("p:1,2|1,2");
        policy.replaceChildren("Across this budget path the law, weights ", exact(ctx, request.decision.weights[0], "weight-0"), " and ", exact(ctx, request.decision.weights[1], "weight-1"), ", withholding costs ", exact(ctx, request.decision.tau[0], "tau-0"), " and ", exact(ctx, request.decision.tau[1], "tau-1"), ", and declared bank remain fixed. Expected-error guards are disabled; direct joint protection uses strict thresholds ", exact(ctx, request.decision.t[0], "threshold-0"), " and ", exact(ctx, request.decision.t[1], "threshold-1"), ".");
        visual.auditReadout.set(["Posterior reversal scenario ", number(ctx, state.noiseIndex, "noise-index"), " has marginal reversal probabilities ", exact(ctx, dual.domains[0].expectedFalseCountExact, "marginal-error-0"), " in S and ", exact(ctx, dual.domains[1].expectedFalseCountExact, "marginal-error-1"), " in C. At joint cap ", exact(ctx, request.decision.alpha, "alpha"), ", minimum risk is ", exact(ctx, fit.riskExact, "minimum-risk"), " and the canonical card's joint-event probability is ", exact(ctx, fit.jointProbabilityExact, "minimum-J"), ". Its occupied-grade counts are S ", number(ctx, summary.gradeCounts[0], "grade-count-0"), ", C ", number(ctx, summary.gradeCounts[1], "grade-count-1"), "; disclosed-pair counts are S ", number(ctx, summary.disclosedCounts[0], "N-0"), ", C ", number(ctx, summary.disclosedCounts[1], "N-1"), (fit.optimizerIds.length === 1 ? ". There is " : ". There are "), number(ctx, fit.optimizerIds.length, "optimizer-count"), (fit.optimizerIds.length === 1 ? " exact optimizer, with " : " exact optimizers, with "), number(ctx, summary.feasibleCount, "feasible-count"), (summary.feasibleCount === 1 ? " feasible card among " : " feasible cards among "), number(ctx, fit.searchScope.candidateCount, "candidate-count"), " declared candidates."]);

        const points = path.map((row) => ({ ...row, alpha: coordinate(row.alphaExact), risk: coordinate(row.riskExact) }));
        const current = points[state.budgetIndex];
        riskChart = plot(riskSlot, { height: 230, marginLeft: 48, marginBottom: 40, alt: "Minimum expected loss on the seven stated budgets, under the current fixed law and candidate bank. The marker identifies the selected budget.", x: { label: "Joint probability cap", ticks: points.map((row) => row.alpha) }, y: { label: "Minimum expected loss", domain: [0, Math.max(...points.map((row) => row.risk), .01)], grid: true }, marks: (c, P) => [P.dot(points, { x: "alpha", y: "risk", fill: c.plotFg, r: 2.5 }), P.ruleX([current.alpha], { stroke: c.plotMuted, strokeDasharray: "4,3" }), P.dot([current], { x: "alpha", y: "risk", fill: c.accent, r: 5 })], keyboard: { data: points, x: "alpha", y: "risk", title: (row) => `Budget ${row.alphaExact}: minimum expected loss ${row.riskExact}.` } });
        const gradePoints = points.flatMap((row) => row.gradeCounts.map((grades, d) => ({ ...row, grades, domain: input.domainIds[d], d })));
        gradeChart = plot(gradeSlot, { height: 230, marginLeft: 48, marginBottom: 40, alt: "Occupied grades of the canonical representatives in S and C at every stated joint budget. The separate paths can move in different directions.", x: { label: "Joint probability cap", ticks: points.map((row) => row.alpha) }, y: { label: "Occupied grades", domain: [1, 2], ticks: [1, 2] }, marks: (c, P) => [P.dot(gradePoints, { x: "alpha", y: "grades", fill: (row) => c.crit[row.d], r: 2.5 }), P.ruleX([current.alpha], { stroke: c.plotMuted, strokeDasharray: "4,3" })], keyboard: { data: gradePoints, x: "alpha", y: "grades", title: (row) => `Budget ${row.alphaExact}, domain ${row.domain}: ${row.grades} occupied grades in the canonical representative.` } });

        budgetButtons = [];
        const rows = path.map((row) => {
          const button = ctx.h("button", { type: "button", class: "prx-btn prr-budget", "data-budget-index": row.budgetIndex, "data-prx-focus-key": `resolution-budget:${row.budgetIndex}`, "aria-pressed": row.budgetIndex === state.budgetIndex ? "true" : "false", "aria-label": `Select joint budget ${row.alphaExact}`, tabindex: row.budgetIndex === state.budgetIndex ? 0 : -1, onclick: () => ctx.set({ budgetIndex: row.budgetIndex, candidate: "canonical" }), onkeydown: (event) => {
            const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
            if (direction === undefined && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 6 : Math.max(0, Math.min(6, row.budgetIndex + direction));
            ctx.set({ budgetIndex: next, candidate: "canonical" }); focusBudget(next);
          } }, exact(ctx, row.alphaExact, `path-${row.budgetIndex}-alpha`));
          budgetButtons.push(button);
          return ctx.h("tr", { class: row.budgetIndex === state.budgetIndex ? "prr-current" : "", "data-path-index": row.budgetIndex }, ctx.h("th", { scope: "row" }, button), ctx.h("td", {}, exact(ctx, row.riskExact, `path-${row.budgetIndex}-risk`)), ctx.h("td", {}, exact(ctx, row.jointProbabilityExact, `path-${row.budgetIndex}-J`)), ...row.gradeCounts.map((value, d) => ctx.h("td", {}, number(ctx, value, `path-${row.budgetIndex}-K-${d}`))), ...row.disclosedCounts.map((value, d) => ctx.h("td", {}, number(ctx, value, `path-${row.budgetIndex}-N-${d}`))), ctx.h("td", {}, number(ctx, row.optimizerIds.length, `path-${row.budgetIndex}-optimizer-count`)), ctx.h("td", {}, row.budgetIndex === state.budgetIndex ? "Current budget" : ""));
        });
        frontier.replaceChildren(ctx.panelTitle("All budgets under the current law"), ctx.h("p", { class: "prr-note" }, "Select a budget in the table or use its arrow keys. The distribution, loss, and candidates are the same at every budget. The table gives the counts for the report shown first, and the list below includes all reports tied at the lowest risk."), region(ctx, table(ctx, "Exact risk, joint probability, occupied grades and disclosures", ["Joint cap", "Minimum risk", "Joint probability", "Grades in S", "Grades in C", "S disclosures", "C disclosures", "Optimizers", "Selection"], rows), "Complete exact budget path"), ctx.h("p", { class: "prr-note" }, "With the same distribution, loss, and candidates, a higher cap can only lower or leave unchanged the minimum risk. The best report can use fewer grades in one domain and more in the other."));
        const lawRows = input.states.map((row, s) => ctx.h("tr", {}, ctx.h("th", { scope: "row" }, named(ctx, input.stateIds[s])), ctx.h("td", {}, number(ctx, row[0][0])), ctx.h("td", {}, number(ctx, row[0][1])), ctx.h("td", {}, exact(ctx, input.masses[s], `mass-${s}`))));
        law.replaceChildren(ctx.panelTitle("The complete reversal law"), region(ctx, table(ctx, "A's targets and exact state masses; B is zero in both domains", ["State", "S target", "C target", "Mass"], lawRows), "Complete reversal-law states"), ctx.h("p", { class: "prr-note" }, "The scenario changes the probability of each joint state. The probabilities are set directly for this example, without a sampling model."));
        selected.replaceChildren(ctx.panelTitle("All minimum-risk feasible profiles"), optimizerSummaryNode(ctx, fit), gradeTable(ctx, fit.selectedGrades, { caption: "Canonical minimum-risk grades", part: "canonical-grades" }), profileGrid(ctx, fit.selectedGrades, { part: "canonical-profile-cells" }), pairTable(ctx, fit.selectedGrades), resultScopeNode(ctx, fit));
        const domainRows = focus.domains.map((domain, d) => ctx.h("tr", {}, ctx.h("th", { scope: "row" }, named(ctx, domain.domainId)), ctx.h("td", {}, number(ctx, focus.originalPairs, `focused-M-${d}`)), ctx.h("td", {}, number(ctx, domain.disclosedPairs, `focused-N-${d}`)), ctx.h("td", {}, exact(ctx, domain.expectedFalseProportionExact, `focused-ratio-${d}`))));
        inspected.replaceChildren(ctx.panelTitle("The inspected fixed card"), ctx.h("p", {}, "Expected loss ", exact(ctx, focus.riskExact, "focused-risk"), "; direct joint-event probability ", exact(ctx, focus.jointProbabilityExact, "focused-J"), ". ", ctx.h("strong", { "data-prx-readout": "focused-status" }, focus.feasible ? "Feasible" : "Infeasible"), ". Inspection does not change the frontier or its optimizer set."), gradeTable(ctx, focus.grades, { caption: "Inspected-card grades", part: "focused-grades" }), region(ctx, table(ctx, "Original-pair and disclosure denominators", ["Domain", "Original pairs", "Disclosed pairs", "Expected false / disclosed"], domainRows), "Inspected-card disclosure denominators"), candidateTable(ctx, fit, { focusedId: r.focusedId, onSelectCandidate: (id) => ctx.set({ candidate: id }) }), ctx.h("p", { class: "prr-note" }, "A domain with no stated comparisons has no error share and cannot exceed its threshold. Reporting the same pair in two domains still concerns one unordered pair. The results apply to the specified distribution and candidates at a threshold of zero. Merging grades at a positive threshold would require a separate check."));
        setSliderFace(ctx,budget,summary.alphaExact,{digits:capDigits(summary.alphaExact)});
        drawBudgetTrack(ctx,visual,r,state);
        ctx.readout.set(['Minimum loss ',exactNum(ctx,fit.riskExact),'; canonical grade counts S ',number(ctx,summary.gradeCounts[0]),', C ',number(ctx,summary.gradeCounts[1]),'.']);
        visual.setScope([['No reversals','Baseline reversal law','More reversals'][state.noiseIndex],' · ',number(ctx,fit.searchScope.candidateCount),' candidate profiles · canonical joint event ',exactNum(ctx,fit.jointProbabilityExact),'.']);
      }, destroy() { riskChart?.destroy(); gradeChart?.destroy(); } };
    },
  });
}
