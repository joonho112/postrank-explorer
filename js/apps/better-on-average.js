// App3.11: fixed reports evaluated on paired whole-state posterior draws. Scientific traces/summaries are public-engine outputs.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatGrades, formatProb, formatRisk, formatSci, formatShare, formatSigned } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { compareReportLosses, disclosure, errorArray, evaluateReport, exactOptimum, expectedRank, finiteLawDraws, finiteLawPairwise, gaussianDraws, rankSummaries, realizedWrong, strictOrder, tierGrades } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({ seed: { min: 1, max: 4294967295, value: 1 }, tieTol: 1e-12 });
const FINITE = Object.freeze({ states: [[20, 4], [0, 4]], probs: [.3, .7] });
const U = SIX.tables.units;
const LAWS = {
  six: { ids: U.id, means: U.mean_A, sds: U.sd_A, E: errorArray(U.mean_A, U.sd_A, { ids: U.id, criteria: ["score_A"] }) },
  finite: { ids: ["A", "B"], means: rankSummaries(FINITE).means, E: finiteLawPairwise(FINITE.states, FINITE.probs, { ids: ["A", "B"], criteria: ["value"] }) },
};
const CSS = `
.prx-boa .boa-controls { display:flex; flex-wrap:wrap; align-items:flex-end; gap:.6rem 1rem; }
.prx-boa .boa-main { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:1rem; align-items:start; }
@media(max-width:55em){.prx-boa .boa-main{grid-template-columns:1fr}}
.prx-boa .boa-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr)); gap:.7rem; }
.prx-boa .boa-card { min-width:0; border:1px solid var(--prx-border); border-radius:6px; padding:.6rem; }
.prx-boa .boa-card p { margin:.3rem 0; }
.prx-boa .boa-note { margin:.4rem 0; font-size:.9rem; color:var(--prx-fg-muted); }
.prx-boa .boa-warning { padding:.5rem; border-left:3px solid var(--prx-accent); margin:.5rem 0; }
.prx-boa .boa-stat { font-variant-numeric:tabular-nums; }
.prx-boa .boa-tables { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr)); gap:1rem; }
.prx-boa .boa-table { width:100%; font-variant-numeric:tabular-nums; }
.prx-boa .boa-table th, .prx-boa .boa-table td { padding:.3rem .4rem; text-align:right; }
.prx-boa .boa-table th:first-child { text-align:left; }
.prx-boa .boa-detail { overflow:auto; }
.prx-boa .boa-detail th:first-child { white-space:nowrap; }
.prx-boa .boa-tie-table { width:max-content; max-width:none; }
.prx-boa .boa-tie-table th, .prx-boa .boa-tie-table td { white-space:nowrap; }
.prx-boa .boa-tie-table caption { text-align:left; }
.prx-boa .boa-key { display:flex; flex-wrap:wrap; gap:.3rem 1rem; font-size:.85rem; }
.prx-boa .boa-key span { display:inline-flex; align-items:center; gap:.3rem; }
.prx-boa .boa-line { width:1.3rem; border-top:2px dashed var(--prx-plot-fg); }
.prx-boa .boa-stale .boa-card, .prx-boa .boa-stale svg, .prx-boa .boa-stale .boa-stat, .prx-boa .boa-stale .boa-detail { opacity:.45; }
.prx-boa .boa-ring { border:2px solid var(--prx-plot-fg); border-radius:50%; width:.8rem; height:.8rem; display:inline-block; }
`;

export function comparisonModel(s) {
  const L = LAWS[s.law];
  const cap = s.family === "cap3" ? 3 : 2;
  const family = s.law === "finite" ? { kind: "all" } : { kind: "atMost", G: cap };
  const optimum = exactOptimum(L.E, { tau: s.tau, family });
  const index = Math.min(s.optimum, optimum.grades.length - 1);
  const best = optimum.grades[index];
  let rule;
  let ruleName;
  if (s.rule === "withheld") { rule = L.ids.map(() => 1); ruleName = "All-withheld report"; }
  else if (s.rule === "self") { rule = best; ruleName = "The same report"; }
  else if (s.rule === "rank") { rule = strictOrder(expectedRank(L.E), { direction: "ascending" }); ruleName = "Strict expected-rank order"; }
  else { const G = Math.min(L.ids.length, cap + (s.outside && s.law === "six" ? 1 : 0)); rule = tierGrades(L.means, G, { direction: "descending" }); ruleName = "Fixed posterior-mean tiers"; }
  const bestEval = evaluateReport(best, L.E, { tau: s.tau });
  const ruleEval = evaluateReport(rule, L.E, { tau: s.tau });
  const admitted = s.law === "finite" || disclosure(rule).G <= cap;
  // Exact public-engine risk contrast. No empirical re-selection or alternate loss is introduced.
  const exactGap = ruleEval.risk - bestEval.risk;
  return { L, family, optimum, index, best, rule, ruleName, bestEval, ruleEval, admitted, exactGap };
}

export function comparisonDraws(s, m) {
  return s.law === "six" ? gaussianDraws(m.L.means, m.L.sds, s.S, s.seed)
    : Array.from(finiteLawDraws(FINITE.probs, s.S, s.seed), (i) => FINITE.states[i]);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "better-on-average", className: "prx-boa", css: CSS, layout: "result-first",
    keys: {
      law: { type: "choice", values: ["six", "finite"], value: "six" },
      family: { type: "choice", values: ["cap2", "cap3"], value: "cap2" },
      rule: { type: "choice", values: ["tiers", "rank", "withheld", "self"], value: "tiers" },
      outside: { type: "boolean", value: false }, tau: { type: "number", min: .02, max: .5, step: .01, value: .2 },
      S: { type: "integer", min: 1, max: 1000, value: 100 }, seed: { type: "integer", ...CONFIG.seed },
      draw: { type: "integer", min: 1, max: 1000, value: 1 }, optimum: { type: "integer", min: 0, max: 10000, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, fmt = formatCount) => { const n = ctx.num(raw, fmt(raw)); n.dataset.prxReadout = name; return n; };
      const signed = (x) => formatSigned(x, { digits: 5 });
      const probability = (x) => formatProb(x);
      const mcseFormat = (x) => x === null ? "NA" : x === 0 ? "0" : x < .00005 ? formatSci(x) : formatRisk(x);
      const law = ctx.select({ label: "Conditional law", options: [{ value: "six", label: "Six sites: independent normals" }, { value: "finite", label: "Two-unit law: two states" }], value: ctx.state.law,
        onChange: (v) => ctx.set({ law: v, rule: v === "finite" ? "rank" : "tiers", outside: false, family: "cap2", optimum: 0, draw: 1, tau: v === "finite" ? .25 : .2 }) });
      const family = ctx.select({ label: "Family optimized", options: [{ value: "cap2", label: "At most two grades" }, { value: "cap3", label: "At most three grades" }], value: ctx.state.family, onChange: (v) => ctx.set({ family: v, optimum: 0 }) });
      const rule = ctx.select({ label: "Common rule", options: [{ value: "tiers", label: "Posterior-mean tiers" }, { value: "rank", label: "Strict expected-rank order" }, { value: "withheld", label: "All withheld" }, { value: "self", label: "Same report as the optimum" }], value: ctx.state.rule, onChange: (v) => ctx.set({ rule: v, outside: false }) });
      const outside = ctx.toggle({ label: "Use one more posterior-mean tier, outside this cap", name: "outside", checked: ctx.state.outside, onChange: (v) => ctx.set({ outside: v }) });
      const tau = ctx.slider({ label: "Withholding cost τ", ...ctx.key("tau"), name: "tau", onInput: (v) => ctx.set({ tau: v, optimum: 0 }) });
      const S = ctx.numberInput({ label: "Whole-state draws S", ...ctx.key("S"), name: "S", onInput: (v) => ctx.set({ S: v }) });
      const seed = ctx.numberInput({ label: "Seed", ...ctx.key("seed"), name: "seed", onInput: (v) => ctx.set({ seed: v }) });
      const redraw = ctx.button({ label: "Next seed", key: "next-seed", onClick: () => ctx.set({ seed: ctx.state.seed === CONFIG.seed.max ? CONFIG.seed.min : ctx.state.seed + 1 }) });
      ctx.controls.append(h("div", { class: "boa-controls" }, law.root, rule.root, tau.root));
      const optionalControls = h("div", { class: "boa-controls" }, family.root, outside.root);
      ctx.afterPresets(optionalControls);
      const lawNote = h("p", { class: "boa-note" });
      const status = h("p", { class: "boa-note", role: "status", hidden: true });
      const cards = h("div", { class: "boa-cards" });
      const condition = h("p", { class: "boa-warning" });
      const scatter = h("div");
      const key = h("p", { class: "boa-key prx-light-panel" }, h("span", {}, h("i", { class: "boa-line", "aria-hidden": "true" }), "equal realized loss"), h("span", {}, h("i", { class: "boa-ring", "aria-hidden": "true" }), "selected draw"), h("span", {}, h("b", { "aria-hidden": "true" }, "+ "), "sample mean"),
        h("span", {}, h("b", { "aria-hidden": "true" }, "★ "), "exact expectation"),
        h("span", {}, "Below the line: common rule wins."));
      const summary = h("div", { class: "boa-stat" });
      const draw = ctx.numberInput({ label: "Draw followed", min: 1, max: ctx.state.S, step: 1, value: 1, name: "draw", onInput: (v) => ctx.set({ draw: v }) });
      const previous = ctx.button({ label: "Previous draw", key: "previous-draw", onClick: () => ctx.set({ draw: Math.max(1, ctx.state.draw - 1) }) });
      const next = ctx.button({ label: "Next draw", key: "next-draw", onClick: () => ctx.set({ draw: Math.min(ctx.state.S, ctx.state.draw + 1) }) });
      const chosen = h("div");
      const tieRows = h("div");
      const choice = h("select", { "aria-label": "Equal-risk optimum followed", name: "optimum" });
      ctx.listen(choice, "change", () => ctx.set({ optimum: Number(choice.value) }));
      const tiedChoice = h("label", {}, "Optimum followed ", choice);
      const drawControls = h("div", { class: "boa-controls boa-draw-controls" }, draw.root, previous.root, next.root);
      const result = h("div", {}, h("div", { class: "boa-main" }, h("section", {}, ctx.panelTitle("Two fixed reports on the same whole-state draws"), scatter, key, drawControls,
        h("p", { class: "boa-note", text: "Dot size and labels show how many paired draws share those losses. Tab into the plot and use arrow keys to read every draw." })), cards), condition, lawNote,
        h("div", { class: "boa-controls" }, S.root, seed.root, redraw.root), summary, chosen, tiedChoice, tieRows);
      ctx.primaryControl(tau.root);
      ctx.primaryGraphic(scatter);
      ctx.charts.append(status, result);
      let cancel = null, epoch = 0, rendered = "";
      const cache = new Map();
      ctx.onCleanup(() => { epoch += 1; cancel?.(); });
      const card = (title, g, ev, L, bestResult = null) => h("section", { class: "boa-card", "data-report": bestResult ? "best" : "rule" }, h("h3", { text: title }),
        h("p", {}, blocksText(g, L.ids)), h("p", { class: "boa-note" }, "Grade vector ", ro("grades", g, formatGrades)), h("p", {}, bestResult ? tagNode(ctx, bestResult) : captionNode(ctx, "fixed-report")),
        h("p", {}, "Discloses ", ro("N", ev.N), " of ", ro("M", ev.M), " pairs; expected wrong share ", ro("EoverN", ev.EoverN[0], formatShare), "; conditional risk ", ro("risk", ev.risk, formatRisk), "."));
      function show(s, m, sim) {
        const { L } = m;
        const q = s.draw - 1;
        cards.replaceChildren(card("Best report followed", m.best, m.bestEval, L, m.optimum), card(m.ruleName, m.rule, m.ruleEval, L));
        if (m.bestEval.N !== m.ruleEval.N) cards.append(captionNode(ctx, "different-disclosure"));
        condition.replaceChildren(m.admitted ? "The common rule was among the reports in the search, so its expected loss cannot be lower beyond numerical tolerance. It can still have lower loss on individual draws."
          : "The search excluded the common rule. The minimum applies to reports that meet the family restriction under the same law.");
        ctx.readout.set(["Exact conditional risk difference (rule − best; positive favors best): ", ro("exactGap", m.exactGap, signed), ". The mean over ", ro("S", s.S), s.S === 1 ? " paired draw is " : " paired draws is ", ro("meanDelta", sim.compare.meanDelta, signed), "; the common rule wins ", ro("ruleWins", sim.compare.ruleWins), sim.compare.ruleWins === 1 ? " draw (" : " draws (", ro("ruleWinShare", sim.compare.ruleWinShare, formatShare), ")."]);
        const rows = sim.draws.map((theta, i) => ({ draw: i + 1, best: sim.compare.lossBest[i], rule: sim.compare.lossRule[i], delta: sim.compare.delta[i] }));
        const pointCounts = new Map();
        for (const row of rows) {
          const key = JSON.stringify([row.best, row.rule]);
          const point = pointCounts.get(key) ?? { ...row, count: 0 };
          point.count += 1;
          pointCounts.set(key, point);
        }
        const points = [...pointCounts.values()];
        const showCounts = points.length <= 6 && points.some(p => p.count > 1);
        const dotRadius = p => Math.min(14, Math.max(3.5, 1.6 * Math.sqrt(p.count)));
        const countLabel = p => `${formatCount(p.count)} ${p.count === 1 ? "draw" : "draws"}: ${p.delta === 0
          ? "equal loss" : `${p.delta > 0 ? "best report" : "common rule"} better by ${formatRisk(Math.abs(p.delta))}`}`;
        const bestMean = sim.compare.lossBest.reduce((total, loss) => total + loss, 0) / rows.length;
        const average = { best: bestMean, rule: bestMean + sim.compare.meanDelta };
        const expectation = { best: m.bestEval.risk, rule: m.ruleEval.risk };
        const top = Math.min(1.05, Math.max(.1, ...sim.compare.lossBest, ...sim.compare.lossRule,
          average.best, average.rule, expectation.best, expectation.rule) * 1.12);
        plot(scatter, { alt: "One point per whole-state posterior draw: best report's realized total reporting loss horizontally, common rule's vertically. Below the dashed diagonal the common rule wins. A larger dot represents more draws at the same losses; arrow keys read every draw. The ring follows the selected draw. The cross marks the sample mean and the star marks the exact conditional expectation.",
          table: { caption: "Paired realized reporting losses, one row for every draw", columns: [{ label: "Draw", value: "draw", format: (v) => formatCount(v) }, { label: "Best report loss", value: "best", format: (v) => formatRisk(v) }, { label: "Common rule loss", value: "rule", format: (v) => formatRisk(v) }, { label: "Rule minus best", value: "delta", format: signed }], rows },
          height: 330, marginTop: 18, marginLeft: 60, marginBottom: 47, marginRight: 24,
          r: { type: "identity" },
          x: { domain: [0, top], label: "Best report: realized loss", labelAnchor: "center", labelArrow: "none", grid: true },
          y: { domain: [0, top], label: "Common rule: realized loss", labelAnchor: "center", labelArrow: "none", grid: true },
          marks: (c, P) => [P.line([{ x: 0, y: 0 }, { x: top, y: top }], { x: "x", y: "y", stroke: c.plotFg, strokeDasharray: "5,3" }), P.dot(points, { x: "best", y: "rule", r: dotRadius, fill: c.purples[4], fillOpacity: .7, title: countLabel }),
            P.dot([{ ...rows[q], count: pointCounts.get(JSON.stringify([rows[q].best, rows[q].rule])).count }], { x: "best", y: "rule", r: p => dotRadius(p) + 4, fill: "none", stroke: c.plotFg, strokeWidth: 2 }),
            P.dot([expectation], { x: "best", y: "rule", symbol: "star", r: 10, fill: c.plotBg, stroke: c.plotFg, strokeWidth: 1.7, ariaLabel: "Exact expectation",
              title: d => `Exact conditional risks: ${formatRisk(d.best)}, ${formatRisk(d.rule)}` }),
            P.dot([average], { x: "best", y: "rule", symbol: "cross", r: 6, fill: c.est, stroke: c.plotBg, strokeWidth: 1.4, ariaLabel: "Sample mean",
              title: d => `Paired mean losses: ${formatRisk(d.best)}, ${formatRisk(d.rule)}` }),
            ...showCounts ? [numText(points.filter(p => p.best <= top / 2), { x:"best", y:"rule", value:"count", format:formatCount, dx:19, dy:-11, textAnchor:"start", fontWeight:600, fill:c.plotFg, stroke:c.plotBg, strokeWidth:3, paintOrder:"stroke" }),
              numText(points.filter(p => p.best > top / 2), { x:"best", y:"rule", value:"count", format:formatCount, dx:-19, dy:-11, textAnchor:"end", fontWeight:600, fill:c.plotFg, stroke:c.plotBg, strokeWidth:3, paintOrder:"stroke" })] : []],
          keyboard: { data: rows, x: "best", y: "rule", key: "draw", title: (r) => `Draw ${formatCount(r.draw)}: best loss ${formatRisk(r.best)}, rule loss ${formatRisk(r.rule)}, difference ${signed(r.delta)}.` },
        });
        summary.replaceChildren(h("p", {}, "Paired mean difference: ", ro("pairedMean", sim.compare.meanDelta, signed), "; paired Monte Carlo SE ", ro("pairedMcse", sim.compare.mcseDelta, mcseFormat), s.S === 1 ? " (undefined for one draw)." : "."),
          h("p", {}, "Common rule wins ", ro("wins", sim.compare.ruleWins), "; best report wins ", ro("bestWins", sim.compare.bestWins), "; ties ", ro("ties", sim.compare.ties), " of ", ro("sampleCount", s.S), ". Ties use absolute loss tolerance ", ro("lossTieTol", sim.compare.tieTol, formatSci), "."),
          h("p", { class: "boa-note", text: "Loss is (wrong directions + τ × withheld pairs) / all pairs M. A positive difference favors the best report. The finite paired mean can have either sign; its Monte Carlo SE comes from the difference trace, with the same state used for both reports. No report is reselected on a draw. An estimated SE of zero from a constant observed trace does not validate the law." }));
        if (s.law === "finite") {
          const perState = compareReportLosses(m.best, m.rule, FINITE.states, { tau: s.tau });
          const losses = FINITE.states.map((_, i) => [perState.lossBest[i], perState.lossRule[i]]);
          const winLaw = finiteLawPairwise(losses, FINITE.probs);
          summary.append(h("p", {}, "Under the exact two-state law, the rule wins with probability ", ro("exactRuleWin", winLaw.pi[0][0][1], probability), ". The table's state probabilities are exact; the scatter and paired SE describe the sampled draws."));
          summary.append(h("table", { class: "boa-table" }, h("caption", { text: "Exact conditional law, not equally weighted states" }), h("thead", {}, h("tr", {}, ...["State (A, B)", "Probability", "Best loss", "Rule loss"].map((text) => h("th", { scope: "col", text })))),
            h("tbody", {}, ...FINITE.states.map((theta, i) => h("tr", {}, h("th", { scope: "row" }, ctx.num(theta, theta.join(", "))), h("td", {}, ro(`state-prob-${i}`, FINITE.probs[i], probability)), h("td", {}, ro(`state-bestLoss-${i}`, perState.lossBest[i], formatRisk)), h("td", {}, ro(`state-ruleLoss-${i}`, perState.lossRule[i], formatRisk)))))));
        }
        const state = sim.draws[q];
        const bw = realizedWrong(m.best, state), rw = realizedWrong(m.rule, state);
        chosen.replaceChildren(ctx.panelTitle("The draw followed"), h("p", {}, "Draw ", ro("selectedDraw", s.draw), ": best loss ", ro("selectedBestLoss", sim.compare.lossBest[q], formatRisk), "; rule loss ", ro("selectedRuleLoss", sim.compare.lossRule[q], formatRisk), "; rule minus best ", ro("selectedDelta", sim.compare.delta[q], signed), "."),
          ctx.scrollRegion(h("div", { class: "boa-detail" }, h("table", { class: "boa-table" }, h("thead", {}, h("tr", {}, ...["Unit", "Drawn value", "Best grade", "Rule grade"].map((text) => h("th", { scope: "col", text })))), h("tbody", {}, ...L.ids.map((id, i) => h("tr", {}, h("th", { scope: "row", text: id }), h("td", {}, ro(`theta-${id}`, Array.isArray(state[i]) ? state[i][0] : state[i], signed)), h("td", {}, ctx.num(m.best[i], formatCount(m.best[i]))), h("td", {}, ctx.num(m.rule[i], formatCount(m.rule[i])))))))), "Selected whole state and both fixed reports"),
          h("p", {}, "Wrong directions in this state: best ", ro("selectedBestWrong", bw.D[0]), ", rule ", ro("selectedRuleWrong", rw.D[0]), ". Their wrong fractions among stated directions are ", ro("selectedBestFraction", bw.DoverN[0], formatShare), " and ", ro("selectedRuleFraction", rw.DoverN[0], formatShare), "; those fractions are different from total reporting loss."));
        tiedChoice.hidden = m.optimum.grades.length < 2;
        choice.replaceChildren(...m.optimum.grades.map((g, i) => h("option", { value: String(i), text: formatGrades(g) }))); choice.value = String(m.index);
        tieRows.replaceChildren(h("p", { class: "boa-note" }, ro("tieCount", m.optimum.tieCount), m.optimum.tieCount===1?" report reaches the smallest conditional risk within equal-risk tolerance ":" reports share the smallest conditional risk within equal-risk tolerance ", ro("riskTieTol", m.optimum.tieTol, formatSci), ". The followed report is fixed for the entire draw comparison. ", m.optimum.grades.length > 1 ? "Use the choice above to follow another equal-risk optimum; the table gives each one's own comparison on these same draws. For the identical-report rule, each row compares its report with itself." : ""));
        if (m.optimum.tieCount > m.optimum.grades.length) tieRows.append(h("p", {}, "The table lists the first ", ctx.num(m.optimum.grades.length, formatCount(m.optimum.grades.length)), " of those reports."));
        if (m.optimum.grades.length > 1) {
          const headings = ["Best grade", "Rule grade", "Best stated pairs", "Rule stated pairs", "Best expected wrong share", "Rule expected wrong share", "Best risk", "Rule risk", "Exact rule − best", "Paired mean", "Paired Monte Carlo SE", "Rule wins", "Best wins", "Equal losses", "Selected best loss", "Selected rule loss", "Selected best wrong", "Selected rule wrong", "Selected best wrong fraction", "Selected rule wrong fraction"];
          tieRows.append(h("p", { class: "boa-note", text: "The expected wrong share averages over posterior states. The selected wrong fraction comes from one draw. Both divide by the number of stated pairs. The paired Monte Carlo SE measures the precision of the mean loss difference over these draws." }));
          tieRows.append(ctx.scrollRegion(h("div", { class: "boa-detail" }, h("table", { class: "boa-table boa-tie-table" }, h("caption", { text: "Equal-risk optima and each report's own comparison" }),
            h("thead", {}, h("tr", {}, ...headings.map((text) => h("th", { scope: "col", text })))),
            h("tbody", {}, ...m.optimum.grades.map((g) => {
              const ruleGrade = s.rule === "self" ? g : m.rule;
              const ev = evaluateReport(g, L.E, { tau: s.tau }), re = evaluateReport(ruleGrade, L.E, { tau: s.tau });
              const c = compareReportLosses(g, ruleGrade, sim.draws, { tau: s.tau });
              const b = realizedWrong(g, state), r = realizedWrong(ruleGrade, state);
              const cells = [[g, formatGrades], [ruleGrade, formatGrades], [ev.N, formatCount], [re.N, formatCount], [ev.EoverN[0], formatShare], [re.EoverN[0], formatShare], [ev.risk, formatRisk], [re.risk, formatRisk], [re.risk - ev.risk, signed], [c.meanDelta, signed], [c.mcseDelta, mcseFormat], [c.ruleWins, formatCount], [c.bestWins, formatCount], [c.ties, formatCount], [c.lossBest[q], formatRisk], [c.lossRule[q], formatRisk], [b.D[0], formatCount], [r.D[0], formatCount], [b.DoverN[0], formatShare], [r.DoverN[0], formatShare]];
              return h("tr", {}, ...cells.map(([v, f], i) => h(i === 0 ? "th" : "td", i === 0 ? { scope: "row" } : {}, ctx.num(v, f(v)))));
            })))), "Every equal-risk optimum on the same paired draws"));
        }
        ctx.caption.replaceChildren(captionNode(ctx, "monte-carlo", { S: s.S, seed: s.seed }), ". Independent whole-state draws from the declared conditional law. Reports are selected once from that law at the displayed τ and family. This is not remeasurement, a model check, or fixed-parameter frequentist dominance.");
      }
      return { render(s, info = {}) {
        // A canceled intermediate render may already have replaced the readout. A return to the
        // last completed state must restore it from the cache instead of keeping that pending text.
        const hadPending = ctx.root.getAttribute("aria-busy") === "true";
        cancel?.(); cancel = null; epoch += 1;
        if (s.draw > s.S) { ctx.set({ draw: s.S }); return; }
        if (s.law === "finite" && s.outside) { ctx.set({ outside: false }); return; }
        law.set(s.law); family.set(s.family); family.root.hidden = s.law === "finite"; rule.set(s.rule); outside.set(s.outside);
        outside.root.hidden = s.law === "finite" || s.rule !== "tiers";
        optionalControls.hidden = family.root.hidden && outside.root.hidden;
        tau.set(s.tau); S.set(s.S); seed.set(s.seed); draw.input.max = String(s.S); draw.set(s.draw);
        const m = comparisonModel(s);
        if (m.index !== s.optimum) { ctx.set({ optimum: m.index }); return; }
        lawNote.replaceChildren(...(s.law === "six" ? ["Six fictional sites, score A: independent normal posterior marginals supplied by the tutorial. "] : ["Two-unit conditional law: (", ctx.num(FINITE.states[0], FINITE.states[0].join(", ")), ") with probability ", ctx.num(FINITE.probs[0], formatProb(FINITE.probs[0])), " and (", ctx.num(FINITE.states[1], FINITE.states[1].join(", ")), ") with probability ", ctx.num(FINITE.probs[1], formatProb(FINITE.probs[1])), ". All reports of these two units form the optimized family. "]), "Changing τ, family or law can reselect the best report; changing S, seed or draw only evaluates the fixed pair of reports.");
        const simKey = [s.law, s.family, s.tau, s.rule, s.outside, s.optimum, s.S, s.seed].join("|");
        const renderKey = `${simKey}|${s.draw}`;
        if (renderKey === rendered && info.reason !== "resize" && !hadPending) { ctx.root.removeAttribute("aria-busy"); status.hidden = true; result.classList.remove("boa-stale"); return; }
        const token = epoch;
        ctx.root.setAttribute("aria-busy", "true"); status.hidden = false; result.classList.add("boa-stale");
        ctx.readout.set(["Exact conditional risk difference (rule minus best): ", ctx.num(m.exactGap, signed(m.exactGap)), ". Evaluating the paired draws…"]);
        status.replaceChildren("Evaluating both fixed reports on ", ctx.num(s.S, formatCount(s.S)), " whole-state draws. Previous results remain dimmed until this update finishes.");
        cancel = ctx.timeout(() => {
          if (token !== epoch) return;
          if (!cache.has(simKey)) { const draws = comparisonDraws(s, m); cache.set(simKey, { draws, compare: compareReportLosses(m.best, m.rule, draws, { tau: s.tau }) }); if (cache.size > 12) cache.delete(cache.keys().next().value); }
          show(s, m, cache.get(simKey));
          rendered = renderKey; status.hidden = true; result.classList.remove("boa-stale"); ctx.root.removeAttribute("aria-busy"); cancel = null;
        }, 0);
      } };
    },
  });
}
