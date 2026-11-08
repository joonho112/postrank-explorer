// Two pair-action losses under a complete finite law. Numeric risks and decisions are engine calls.
// Layout (review 044 repair, X-01 and X-16 with G3-F11): base.js's result-first frame, so the read-out sits directly
// under the controls and the preset row, followed by its result tag and one line saying that a shared grade is not an
// equality claim. At 1280 the note on the supplied law, then the figure (ctx.primaryGraphic) beside the cost table, as
// before; below 48em the three-row cost table comes first, then the figure, then the note (CSS order; none of them
// holds a control, so Tab order is unchanged). Under certain equality the t slider keeps its slot (hidden and
// disabled) so the preset row never moves.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatEoverN, formatExpectedCount, formatProb, formatRisk, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { equalityNeutralRisk, evaluateReport, exactOptimum, finiteLawPairwise, pairDecision, tieLawPairwise } from "../pr-core.js";
import LAW from "../../data/released/m4-tie-law.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "ties-and-withholding", tMax: .9, tolerance: 1e-12,
  actions: Object.freeze([
    Object.freeze({ id: "iAboveJ", label: "A above B", grade: Object.freeze([1, 2]) }),
    Object.freeze({ id: "jAboveI", label: "B above A", grade: Object.freeze([2, 1]) }),
    Object.freeze({ id: "withhold", label: "Withhold", grade: Object.freeze([1, 1]) }),
  ]),
});
const A = CONFIG.actions;
const BELOW = LAW.tables.states.probability[0];
const STATES = LAW.tables.states.A.map((v, i) => [[v], [LAW.tables.states.B[i]]]);
const clean = (v) => Number(v.toFixed(14));
const eArray = (tie, e) => ({ ids: tie.ids, criteria: tie.criteria, e });
const LOSS = { weak: "Weak-error loss", neutral: "Equality-neutral loss" };

/** Exact composition of engine evaluations: Q is distinct mass, not a count of raw stated pairs. */
export function compute({ t, tau, scenario = "m4" }) {
  const certain = scenario === "certain";
  const probs = certain ? [0, 1, 0] : [BELOW, t, clean(1 - BELOW - t)];
  const options = { ids: LAW.arrays.tie.ids, criteria: LAW.arrays.tie.criteria };
  const weak = finiteLawPairwise(STATES, probs, options);
  const tie = tieLawPairwise(STATES, probs, options);
  const riskOptions = { tau, w: [1] };
  const rows = A.map((a) => {
    const w = evaluateReport(a.grade, weak, riskOptions);
    const n = equalityNeutralRisk(a.grade, tie, riskOptions);
    // evaluateReport is a sum of supplied directional coefficients; here b and d deliberately supply
    // strict-error and distinctness coefficients. Only their counts are used, not its weak-loss risk.
    const strict = evaluateReport(a.grade, eArray(tie, tie.b), riskOptions).Ew;
    const Q = evaluateReport(a.grade, eArray(tie, tie.d), riskOptions).Ew;
    return { ...a, weak: w.risk, neutral: n.risk, N: w.N, strict, Q,
      EoverN: w.N > 0 ? strict / w.N : null, EoverQ: Q > 0 ? strict / Q : null,
      guard: !certain || a.id === "withhold" };
  });
  const T = evaluateReport(A[0].grade, eArray(tie, tie.d), riskOptions).Ew;
  const R0 = equalityNeutralRisk(A[2].grade, tie, riskOptions).R0;
  const weakResult = exactOptimum(weak, { tau, family: { kind: "all" } });
  const weakBest = pairDecision(rows[0].weak, rows[1].weak, tau).best;
  // For a pair the neutral costs are exactly (b_AB, b_BA, R0); this is the same closed-form
  // three-action decision. At certain equality all three costs are identically zero, while the guard
  // allows only the shared grade. No guarded multi-unit selector is implemented in this app.
  const neutralBest = R0 > 0 ? pairDecision(rows[0].neutral, rows[1].neutral, R0).best : A.map(a => a.id);
  const neutralResult = { label: weakResult.label, family: weakResult.family,
    risk: rows.find(r => r.id === neutralBest[0]).neutral, containsAllWithheld: true };
  return { certain, t: tie.t[0][0][1], tau, probs, tie, rows, T, R0,
    weakBest, neutralBest, weakResult, neutralResult };
}

/** Crossings of affine risk lines, retained only when the engine declares both actions cheapest there. */
export function switchPoints(tau, loss) {
  const left = compute({ t: 0, tau });
  const right = compute({ t: CONFIG.tMax, tau });
  const points = [];
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const slopeI = (right.rows[i][loss] - left.rows[i][loss]) / CONFIG.tMax;
    const slopeJ = (right.rows[j][loss] - left.rows[j][loss]) / CONFIG.tMax;
    if (Math.abs(slopeI - slopeJ) < CONFIG.tolerance) continue;
    const raw = (left.rows[j][loss] - left.rows[i][loss]) / (slopeI - slopeJ);
    if (raw < -CONFIG.tolerance || raw > CONFIG.tMax + CONFIG.tolerance) continue;
    const t = Math.min(CONFIG.tMax, Math.max(0, raw));
    const r = compute({ t, tau });
    const best = loss === "weak" ? r.weakBest : r.neutralBest;
    if (!best.includes(A[i].id) || !best.includes(A[j].id)) continue;
    if (points.some(p => Math.abs(p.t - t) < CONFIG.tolerance)) continue;
    points.push({ t, risk: r.rows[i][loss], best: best.map(id => A.find(a => a.id === id).label).join(" / ") });
  }
  return points.sort((a, b) => a.t - b.t);
}

const CSS = `
.tw .tw-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(15rem, 1fr); gap: 1rem; align-items: start; }
.tw .tw-table { width: 100%; border-collapse: collapse; font-size: .9em; font-variant-numeric: tabular-nums; }
.tw .tw-table th, .tw .tw-table td { padding: .3rem .45rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); }
.tw .tw-cost-table { table-layout:fixed; }
.tw .tw-cost-table th:first-child { width:45%; }
.tw .tw-cost-table th:nth-child(n+2) { width:27.5%; }
.tw .tw-table caption { caption-side: top; color: var(--prx-fg-heading); font-weight: 600; text-align: left; padding-bottom: .4rem; }
.tw .tw-current { background: var(--prx-bg-sunken); font-weight: 600; }
.tw .tw-note { color: var(--prx-fg-muted); font-size: .9em; margin: .4rem 0; }
.tw .tw-summary, .tw .tw-formula, .tw .tw-denominators, .tw .tw-meaning { margin-top: .8rem; }
.tw .tw-scroll { max-width: 100%; overflow-x: auto; }
.tw .tw-denominators th, .tw .tw-denominators td { white-space: nowrap; }
.tw .tw-legend { display: flex; flex-wrap: wrap; gap: .3rem 1rem; padding: .3rem .5rem; font-size: .85em; background: var(--prx-plot-bg); color: var(--prx-plot-fg); }
.tw .tw-legend span { display: inline-flex; gap: .4rem; align-items: center; }
.tw .tw-line { display: inline-block; width: 1.4rem; border-top: 2px solid var(--prx-err); }
.tw .tw-line-reverse { border-top-style: dashed; }
.tw .tw-line-hold { border-top-color: var(--prx-wh); }
.tw .tw-switch-mark, .tw .tw-cheapest-mark { display:inline-block; flex:none; width:10px; height:10px; border:1px solid var(--prx-plot-fg); border-radius:50%; background:var(--prx-plot-bg); }
.tw .tw-cheapest-mark { width:16px; height:16px; border-width:2px; position:relative; }
.tw .tw-cheapest-mark::after { content:""; position:absolute; width:6px; height:6px; left:3px; top:3px; border-radius:50%; background:var(--prx-plot-fg); }
.tw .tw-admissibility { display:block; font-size:.82em; font-weight:400; color:var(--prx-fg-muted); margin-top:.2rem; }
.tw .tw-claim { font-size: .9em; margin: .4rem 0; }
.tw .prx-slider[data-tw-unused] { visibility: hidden; }
/* below 48em (review 044 repair, X-16 with G3-F11): the cost table first, then the figure, then the note on the supplied
   law; the rest follows in DOM order. CSS order only: the moved boxes hold no control, so Tab order is unchanged */
@media (max-width: 48em) {
  .tw .tw-grid { grid-template-columns: minmax(0, 1fr); }
  .tw .tw-grid > .tw-costs { order: -1; }
  .tw .prx-charts { display: flex; flex-direction: column; }
  .tw .prx-charts > * { order: 2; }
  .tw .prx-charts > .tw-grid { order: 0; }
  .tw .prx-charts > .tw-law { order: 1; }
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name, className: "tw", css: CSS,
    label: "True equality and withholding: the costs of three pair actions under two loss conventions",
    // review 044 repair (X-01): the read-out directly under the controls and the preset row
    layout: "result-first",
    keys: {
      t: { type: "number", min: 0, max: CONFIG.tMax, step: .01, value: .4 },
      tau: { type: "number", min: .01, max: .5, step: .01, value: .25 },
      loss: { type: "choice", values: ["weak", "neutral"], value: "weak" },
      scenario: { type: "choice", values: ["m4", "certain"], value: "m4" },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const n = ctx.num(raw, display); if (name) n.setAttribute("data-prx-readout", name); return n; };
      const risk = (name, v) => ro(name, v, formatRisk(v));
      const prob = (name, v) => ro(name, v, formatProb(v));
      const count = (name, v) => ro(name, v, formatCount(v));
      const share = (name, v) => ro(name, v, formatShare(v));
      const t = ctx.slider({ label: "Probability of equal true values, t", ...ctx.key("t"), hint: ["Pr(A < B) stays ", ctx.num(BELOW, formatProb(BELOW)), "; the remaining mass moves between equality and A above B."], onInput: v => ctx.set({ t: v }) });
      const tau = ctx.slider({ label: "Withholding cost τ", ...ctx.key("tau"), onInput: v => ctx.set({ tau: v }) });
      const loss = ctx.segmented({ label: "Loss shown in the figure", value: ctx.state.loss,
        options: [{ value: "weak", label: LOSS.weak }, { value: "neutral", label: LOSS.neutral }], onChange: v => ctx.set({ loss: v }) });
      const scenario = ctx.segmented({ label: "Supplied law", value: ctx.state.scenario,
        options: [{ value: "m4", label: "Vignette law" }, { value: "certain", label: "Certain equality" }], onChange: v => ctx.set({ scenario: v }) });
      ctx.controls.append(t.root, tau.root, loss.root, scenario.root);
      // the t slider moves the figure's dots and the cost table (base.js primaryControl)
      ctx.primaryControl(t.root);
      const law = ctx.part("notes", h("p", { class: "tw-note tw-law" }));
      const label = h("p", { class: "tw-note" });
      // review 044 repair (G3-F11): the no-equality-claim line next to the result; the full paragraph stays below
      const claim = h("p", { class: "tw-claim" }, "A shared grade withholds a direction; it is not a claim that A = B.");
      ctx.readout.node.after(label, claim);
      const figure = h("div");
      const figureTitle = ctx.panelTitle(LOSS.weak);
      const key = (cls, text) => h("span", {}, h("i", { class: `tw-line ${cls}`, "aria-hidden": "true" }), text);
      const legend = ctx.part("legend", h("div", { class: "tw-legend" }, key("", "A above B"), key("tw-line-reverse", "B above A"), key("tw-line-hold", "Withhold"), h("span", {}, h("i", { class:"tw-switch-mark", "aria-hidden":"true" }), "Equal-cost switch point"), h("span", {}, h("i", { class:"tw-cheapest-mark", "aria-hidden":"true" }), "Cheapest at the current t")));
      const costs = ctx.part("table", h("div", { class: "tw-costs" }));
      // the figure t moves (base.js primaryGraphic); below 48em the cost table is shown above it (CSS order)
      const panel = ctx.primaryGraphic(h("section", { class: "prx-panel" }, figureTitle, figure, legend));
      // the note on the supplied law leads the charts (directly above the figure at 1280; after it below 48em)
      ctx.charts.append(law, h("div", { class: "tw-grid" }, panel, costs));
      const switches = ctx.part("notes", h("section", { class: "tw-summary" }));
      const baselineDefinition = h("p", { class:"tw-note" });
      const baseline = h("div");
      const formula = ctx.part("notes", h("div", { class: "tw-formula tw-scroll" }));
      const scope = h("p", { class: "tw-note", text: "The superscript s identifies the posterior used for both calculations. The equality-neutral loss charges only in states where the targets differ." });
      const denominator = ctx.part("table", h("section", { class: "tw-denominators" }));
      const meaning = ctx.part("notes", h("section", { class: "tw-meaning" }));
      ctx.charts.append(switches, baselineDefinition, baseline, formula, scope, denominator, meaning);
      ctx.scrollRegion(formula, "All-withheld risk under the supplied law");

      function drawFigure(state, r) {
        const lossKey = state.loss;
        legend.hidden = r.certain;
        figureTitle.textContent = r.certain ? `${LOSS[lossKey]} at certain equality` : `${LOSS[lossKey]} as equality becomes more likely`;
        const best = lossKey === "weak" ? r.weakBest : r.neutralBest;
        if (r.certain) {
          const bars = r.rows.map(a => ({ action: a.label, risk: a[lossKey], guard: a.guard }));
          plot(figure, { height: 280, marginLeft: 95, marginRight: 20, marginTop: 20, marginBottom: 38,
            alt: "At certain equality, each neutral risk is zero, while weak loss charges each stated direction one and withholding τ. The same-grade guard permits only withholding in the neutral problem.",
            x: { domain: [0, 1], label: "Expected cost", labelArrow: "none" }, y: { label: null, domain: A.map(a => a.label) },
            color: { type: "identity" }, marks: (c, P) => [
              P.barX(bars, { x: "risk", y: "action", fill: d => d.action === "Withhold" ? c.wh : c.err }),
              P.dot(bars, { x: "risk", y: "action", r: 4, fill: c.plotFg }),
              numText(bars.filter(d => d.risk <= .8), { x: "risk", y: "action", value: "risk", format: v => formatRisk(v), dx: 6, textAnchor: "start", fill: c.plotFg }),
              numText(bars.filter(d => d.risk > .8), { x: "risk", y: "action", value: "risk", format: v => formatRisk(v), dx: -6, textAnchor: "end", fill: c.plotFg }),
            ], keyboard: { data: bars, x: "risk", y: "action", title: d => `${d.action}: cost ${formatRisk(d.risk)}${state.loss === "neutral" && !d.guard ? "; not admitted by the same-grade guard" : ""}` },
          });
          return;
        }
        const grid = Array.from({ length: 91 }, (_, i) => i / 100);
        const lines = grid.flatMap(x => { const q = compute({ t: x, tau: state.tau }); return q.rows.map(a => ({ id: a.id, t: x, risk: a[lossKey] })); });
        const dots = r.rows.map(a => ({ ...a, t: r.t, risk: a[lossKey], best: best.includes(a.id) }));
        const crossings = switchPoints(state.tau, lossKey);
        plot(figure, { height: 300, marginTop: 25, marginRight: 20, marginBottom: 40, marginLeft: 48,
          alt: "Three action-risk lines against the probability of exact equality. The two stated directions use solid and dashed error-color lines; withholding is gray. Circles mark switch points of the cheapest action, and rings mark cheapest actions at the selected equality probability.",
          x: { domain: [0, CONFIG.tMax], ticks: [0, .3, .6, .9], label: "Probability of equal true values, t", labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, 1], label: "Expected cost", labelArrow: "none", grid: true }, color: { type: "identity" },
          marks: (c, P) => [
            ...A.map(a => P.line(lines.filter(d => d.id === a.id), { x: "t", y: "risk", stroke: a.id === "withhold" ? c.wh : c.err, strokeWidth: 2.2, strokeDasharray: a.id === "jAboveI" ? "7 4" : null })),
            P.ruleX([r.t], { stroke: c.plotMuted, strokeDasharray: "3 3" }),
            P.dot(crossings, { x: "t", y: "risk", fill: c.plotBg, stroke: c.plotFg, r: 5 }),
            P.dot(dots.filter(d => d.best), { x: "t", y: "risk", r: 8, fill: "none", stroke: c.plotFg, strokeWidth: 2 }),
            P.dot(dots, { x: "t", y: "risk", r: 4, fill: d => d.id === "withhold" ? c.wh : c.err, stroke: c.plotBg }),
          ], keyboard: { data: dots, x: "t", y: "risk", sort: false, label: "The three actions at the selected equality probability", title: d => `${d.label}: risk ${formatRisk(d.risk)}${d.best ? "; lowest" : ""}` },
        });
      }

      function drawCosts(state, r) {
        const best = state.loss === "weak" ? r.weakBest : r.neutralBest;
        const th = text => h("th", { scope: "col", text });
        costs.replaceChildren(h("table", { class: "tw-table tw-cost-table" },
          h("caption", { text: "Same law, different costs" }),
          h("thead", {}, h("tr", {}, th("Action"), th("Weak error"), th("Equality neutral"))),
          h("tbody", {}, ...r.rows.map(a => h("tr", { class: best.includes(a.id) && (state.loss === "weak" || a.guard) ? "tw-current" : null },
            h("th", { scope: "row" }, a.label, !a.guard ? h("small", { class:"tw-admissibility", "data-prx-not-admitted":"" }, "Not admitted under the neutral guard: identical targets stay together.") : null), h("td", {}, risk(`weak-${a.id}`, a.weak)), h("td", {}, risk(`neutral-${a.id}`, a.neutral)))))));
        if (r.certain) costs.append(h("p", { class: "tw-note" }, "All neutral costs are ", count("zero-neutral", r.R0), ". The guard permits only the shared grade: withholding."));
      }

      function drawSwitches(state, r) {
        if (r.certain) {
          switches.replaceChildren(ctx.panelTitle("Certain equality is different from uncertainty"),
            h("p", { class: "tw-note" }, "Both targets are exactly equal in every possible state. Zero neutral risk supplies no evidence of strict superiority. The same-grade guard keeps identical profiles together; scoring a direction does not make it admissible."));
          return;
        }
        const row = loss => {
          const xs = switchPoints(state.tau, loss);
          return h("p", {}, `${LOSS[loss]}: `, ...(xs.length ? xs.flatMap((p, i) => [i ? "; " : "", "t = ", prob(`${loss}-switch-${i}`, p.t), ` (${p.best})`]) : ["no change of cheapest action over this equality range."]));
        };
        switches.replaceChildren(ctx.panelTitle("Where the cheapest action changes"), row("weak"), row("neutral"),
          h("p", { class: "tw-note" }, "At a listed switch point the named actions have equal cost within the risk tolerance ", ro("tolerance", CONFIG.tolerance, "1e−12"), "."));
      }

      function drawBaseline(r) {
        baselineDefinition.replaceChildren("For this pair, total distinct mass T is the probability that A and B differ: ", share("baseline-T", r.T), ". The equality-neutral all-withheld risk R₀ charges τ only on that mass; the original pair count M is ", count("baseline-M", 1), ".");
        const bars = [{ loss: "Weak all-withheld", risk: r.tau }, { loss: "Neutral all-withheld", risk: r.R0 }];
        plot(baseline, { height: 130, marginTop: 12, marginLeft: 145, marginRight: 65, marginBottom: 30,
          alt: "All-withheld risk is τ for weak error and R0 = τ times total distinct mass divided by the original pair count for equality-neutral loss.",
          x: { domain: [0, .5], label: "All-withheld risk", labelArrow: "none" }, y: { label: null, domain: bars.map(x => x.loss) }, color: { type: "identity" },
          marks: (c, P) => [P.barX(bars, { x: "risk", y: "loss", fill: c.wh }), numText(bars, { x: "risk", y: "loss", value: "risk", format: v => formatRisk(v), dx: 7, textAnchor: "start", fill: c.plotFg })],
          keyboard: { data: bars, x: "risk", y: "loss", title: d => `${d.loss}: ${formatRisk(d.risk)}` },
        });
        const f = formulaNums();
        renderTex(formula, `R^s_0 = \\tau T^s_w/M = ${f.num(r.tau, formatSetting(r.tau))}\\times ${f.num(r.T, formatShare(r.T))}/${f.num(1, formatCount(1))} = ${f.num(r.R0, formatRisk(r.R0))}`, { display: true, nums: f.raws });
      }

      function drawDenominators(r) {
        const wrap = h("div", { class: "tw-scroll" });
        const th = text => h("th", { scope: "col", text });
        const ratio = (name, v, distinct = false, N = 0) => v === null && distinct && N > 0
          ? h("span", { "data-prx-undefined-ratio":name }, ro(name, null, formatProb(null)), ": no distinct mass")
          : ro(name, v, v === null ? formatEoverN(v) : formatShare(v));
        wrap.append(h("table", { class: "tw-table" }, h("caption", { text: "Neutral counts" }),
          h("thead", {}, h("tr", {}, th("Action"), th("Raw stated pairs, N"), th("Strict errors"), th("Distinct mass, Q"), th("Errors / N"), th("Errors / Q"))),
          h("tbody", {}, ...r.rows.map(a => h("tr", {}, h("th", { scope: "row", text: a.label }), h("td", {}, count(`N-${a.id}`, a.N)),
            h("td", {}, ro(`strict-${a.id}`, a.strict, formatExpectedCount(a.strict))), h("td", {}, share(`Q-${a.id}`, a.Q)),
            h("td", {}, ratio(`EoverN-${a.id}`, a.EoverN)), h("td", {}, ratio(`EoverQ-${a.id}`, a.EoverQ, true, a.N)))))));
        denominator.replaceChildren(ctx.panelTitle("Raw pairs and distinct mass"), wrap, h("p", { class: "tw-note" }, "Total distinct mass T = ", share("T", r.T), "; original pair count M = ", count("M", 1), ". Raw disclosure counts a stated pair even when the targets may be equal; distinct mass discounts that possibility."));
        ctx.scrollRegion(wrap, "Raw pair counts and distinct-comparison denominators");
      }

      return { render(state) {
        const r = compute(state);
        // under certain equality t has no role: disabled and not shown, but it keeps its slot, so the controls and the
        // preset row stay where they are (review 044 repair, frame rule "the preset row stays put")
        t.set(state.t); t.setDisabled(r.certain); t.root.toggleAttribute("data-tw-unused", r.certain); tau.set(state.tau); loss.set(state.loss); scenario.set(state.scenario);
        drawFigure(state, r); drawCosts(state, r); drawSwitches(state, r); drawBaseline(r); drawDenominators(r);
        law.replaceChildren("B is ", count(null, LAW.tables.states.B[0]), "; A is ", count(null, LAW.tables.states.A[0]), ", ", count(null, LAW.tables.states.A[1]), " or ", count(null, LAW.tables.states.A[2]), " with probabilities ", ...r.probs.flatMap((p, i) => [i ? ", " : "", prob(`mass-${i}`, p)]), ". This is a complete finite law, not a sample.");
        if (r.certain && state.loss === "neutral") {
          label.replaceChildren(captionNode(ctx, "fixed-report"), "; the identical-profile guard admits only withholding.");
          ctx.readout.set(["The true values are certainly equal: every neutral action cost is ", count("R0", r.R0), ". The same-grade guard keeps A and B together; a shared grade asserts no equality in general."]);
        } else {
          const neutral = state.loss === "neutral";
          const best = neutral ? r.neutralBest : r.weakBest;
          const cost = r.rows.find(a => a.id === best[0])[state.loss];
          label.replaceChildren(tagNode(ctx, neutral ? r.neutralResult : r.weakResult), ` under ${LOSS[state.loss].toLowerCase()}.`);
          ctx.readout.set([`${LOSS[state.loss]}: `, best.map(id => A.find(a => a.id === id).label).join(" and "), best.length > 1 ? " share the lowest cost, " : " has the lowest cost, ", risk(null, cost), ". Neutral all-withheld risk R₀ is ", risk("R0", r.R0), ", beside the weak baseline τ = ", risk("weak-baseline", r.tau), "."]);
        }
        meaning.replaceChildren(ctx.panelTitle("A shared grade makes no equality claim"), h("p", { class: "tw-note", text: "A shared grade withholds a direction. Equal posterior means, rounded measurements, practical closeness and equal-cost actions are different statements from exact equality of the true values. The weak and neutral losses agree only when every positive-weight criterion is tie-free and the same action family is compared." }));
        ctx.caption.textContent = "Synthetic law after postrank vignette m4; probabilities and risks are computed in this browser. The certain-equality case is a separate stipulated law.";
      } };
    },
  });
}
