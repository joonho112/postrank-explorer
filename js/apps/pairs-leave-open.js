// Fixed within-criterion laws; editable cross-criterion coupling.
// Scientific outputs are public core calls.
import { createWidget } from "../shared/base.js";
import { labelOn, numText, plot, svgScene } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutExpected,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSetting,
  formatShare,
  tickLabel,
} from "../shared/format.js";
import { ro } from "../shared/readout.js";
import { evaluateReport, realizedWrong, weightedError, wrongCountDistribution } from "../pr-core.js";
import { CHAPTER19, couplingLaw } from "../shared/criteria-laws.js";
import {
  ESTIMAND_CSS,
  estimandComparison,
  createEstimandCostView,
  createEstimandLawView,
  createEstimandReportView,
} from "../shared/domain/composite-or-criterion.js";
import { PAIR_COST_CSS } from "../shared/domain/conflict-pairs.js";
import { CRITERIA_PROFILE_CSS } from "../shared/domain/several-criteria.js";

export const OPEN_PAIRS_KEYS = {
  law: { type: "choice", values: ["coupling", "ch19"], value: "coupling" },
  lambda: { type: "number", min: 0, max: 1, step: 0.01, value: 1 },
  w: { type: "number", min: 0, max: 1, step: 0.01, value: 0.5 },
  tau: { type: "number", min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
  report: { type: "string", value: "1/2" },
};

export const OPEN_PAIRS_CSS = `
.jnt .jnt-controls { display: flex; flex-wrap: wrap; gap: 0.65rem; min-width: 0; }
.jnt .jnt-controls .prx-control { max-width: 100%; min-width: 0; }
.jnt .jnt-controls select { max-width: 100%; min-width: 0; }
.jnt .jnt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr)); gap: 0.85rem; min-width: 0; }
.jnt .jnt-section { min-width: 0; margin: 0.9rem 0; }
.jnt .jnt-paper { padding: 0.7rem; background: var(--prx-plot-bg); color: var(--prx-plot-fg); border-radius: 0.35rem; min-width: 0; }
.jnt .jnt-paper .prx-panel-title, .jnt .jnt-paper .prx-result-tag { color: var(--prx-plot-fg); }
.jnt .jnt-note { font-size: 0.88rem; line-height: 1.45; }
.jnt .jnt-paper .jnt-note { color: var(--prx-plot-muted); }
.jnt.prx-widget .jnt-paper table, .jnt.prx-widget .jnt-paper th, .jnt.prx-widget .jnt-paper td { background: var(--prx-plot-bg); color: var(--prx-plot-fg); }
.jnt .jnt-scroll { overflow-x: auto; max-width: 100%; min-width: 0; }
.jnt .jnt-table { min-width: 39rem; width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.jnt .jnt-table th, .jnt .jnt-table td { padding: 0.4rem 0.5rem; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--prx-plot-grid); }
.jnt .jnt-table th:first-child, .jnt .jnt-table td:first-child { text-align: left; }
.jnt .jnt-table.jnt-compact { min-width: 18rem; }
.jnt .jnt-table.jnt-pairs { min-width: 25rem; }
.jnt .jnt-report-select select { background: var(--prx-bg); color: var(--prx-fg); padding: 0.35rem 0.45rem; border: 1px solid var(--prx-border-strong); border-radius: 0.25rem; min-height: 2.15rem; }
.jnt .jnt-report-select label { display: block; font-weight: 600; margin-bottom: 0.15rem; }
.jnt .jnt-selected { font-weight: 600; }
.jnt .jnt-context { margin-top: 1.2rem; }
`;

const JNT_V2_CSS = `
.jnt .jnt-primary-controls {
  display: grid;
  grid-template-columns: minmax(12rem, 1.55fr) minmax(9.5rem, 0.9fr);
  gap: 0.35rem 0.85rem;
  align-items: end;
  width: 100%;
  min-width: 0;
}
.jnt .jnt-primary-controls[data-single="true"] {
  grid-template-columns: minmax(10rem, 18rem);
}
.jnt .jnt-primary-controls > .prx-control { min-width: 0; }
.jnt .jnt-primary-controls > .prx-control[hidden] { display: none; }
.jnt .jnt-primary-controls select { width: 100%; }
.jnt .jnt-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  align-items: flex-end;
  width: 100%;
  min-width: 0;
}
.jnt .jnt-settings > .prx-control,
.jnt .jnt-settings select { min-width: 0; max-width: 100%; }
.jnt.prx-widget[data-prx-frame="v2"] .prx-stage.jnt-stage-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 0.45rem;
  padding: 0.55rem 0.75rem 0.5rem;
}
.jnt .prx-stage.jnt-stage-paper .jnt-stage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.65rem;
  margin: 0 0 0.35rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--prx-plot-grid);
  font-size: 0.875rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
}
.jnt .prx-stage.jnt-stage-paper .jnt-stage-sub {
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.jnt .jnt-stage-chart { min-width: 0; }
.jnt .jnt-overview { margin: 0; }
.jnt .jnt-overview p { margin: 0.3rem 0; }
.jnt .jnt-paper .cp-note,
.jnt .sev-paper .cp-note,
.jnt .sev-paper .estim-caption { color: var(--prx-plot-fg); }
@media (min-width: 48.01em) {
  .jnt.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.28rem 0.6rem;
    margin-bottom: 0.35rem;
  }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex: 1 1 26rem;
  }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    display: none;
  }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.24rem;
  }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    min-height: 1.92rem;
    padding: 0.14rem 0.48rem;
    font-size: 0.8125rem;
    line-height: 1.2;
  }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.92rem;
    padding: 0.14rem 0;
  }
}
@media (max-width: 48em) {
  .jnt.prx-widget[data-prx-frame="v2"] { padding: 0.42rem 0.5rem; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.22rem 0.35rem; margin-bottom: 0.25rem; }
  .jnt .jnt-primary-controls { grid-template-columns: minmax(0, 1.18fr) minmax(8.4rem, 0.92fr); gap: 0.22rem 0.45rem; }
  .jnt .jnt-primary-controls[data-single="true"] { grid-template-columns: minmax(0, 1fr); }
  .jnt .jnt-primary-controls .prx-slider { font-size: 0.8125rem; }
  .jnt .jnt-report-select label { font-size: 0.8125rem; }
  .jnt .jnt-report-select select { min-height: 2.75rem; font-size: 0.875rem; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { display: none; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.2rem; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.16rem 0.4rem; font-size: 0.79rem; line-height: 1.15; }
  .jnt.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.28rem; font-size: 0.88rem; line-height: 1.32; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-stage.jnt-stage-paper { padding: 0.38rem 0.45rem 0.36rem; }
  .jnt .prx-stage.jnt-stage-paper .jnt-stage-bar { font-size: 0.82rem; margin-bottom: 0.26rem; padding-bottom: 0.22rem; }
  .jnt.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.32rem; gap: 0.28rem; }
  .jnt.prx-widget[data-prx-frame="v2"] .prx-caption { margin-top: 0.28rem; font-size: 0.78rem; line-height: 1.28; }
}
`;

const keyOf = (g) => Array.from(g).join("/");
const cached = new Map();

/** Only approved display arithmetic: complement the engine's weighted wrong fraction for a fixed report. */
function fixedAccuracy(grade, E, w, tau) {
  const weighted = { ids: E.ids, criteria: ["weighted"], e: [weightedError(E, w)] };
  const evaluation = evaluateReport(grade, weighted, { tau, w: [1] });
  return { weightedEvaluation: evaluation, meanCorrectFraction: evaluation.N > 0 ? 1 - evaluation.EoverN[0] : null };
}

/** Complete fixed-report diagnostics, independent of which objective happens to choose that report. */
export function solveOpenPairs(state) {
  const cacheKey = JSON.stringify([state.law, state.law === "coupling" ? state.lambda : null, state.w, state.tau]);
  let base = cached.get(cacheKey);
  if (!base) {
    const law = state.law === "coupling" ? couplingLaw(state.lambda) : CHAPTER19;
    const w = [state.w, 1 - state.w];
    const a = state.law === "coupling" ? [0.5, 0.5] : [0.75, 0.25];
    const comparison = estimandComparison(law, {
      w,
      a,
      tau: state.tau,
      multiplier: [1, 1],
      family: { kind: "all" },
      pair: state.law === "coupling" ? [0, 1] : [1, 2],
    });
    const reports = comparison.allReports.map((report) => ({
      ...report,
      wrong: wrongCountDistribution(report.grade, law.states, law.probs, { w }),
      states: law.states.map((values, s) => ({ s, prob: law.probs[s], ...realizedWrong(report.grade, values, { w }) })),
      ...fixedAccuracy(report.grade, comparison.criterionE, w, state.tau),
    }));
    base = { law, w, a, tau: state.tau, comparison, reports };
    cached.set(cacheKey, base);
    if (cached.size > 40) cached.delete(cached.keys().next().value);
  }
  const fallback = state.law === "coupling" ? "1/2" : "1/2/2/3";
  const selected =
    base.reports.find((r) => keyOf(r.grade) === state.report) ?? base.reports.find((r) => keyOf(r.grade) === fallback);
  return { ...base, state, selected };
}

const name = (ctx, s) => ctx.h("span", { "data-prx-name": "", text: s });

function n(ctx, x, kind = "risk", hook) {
  const format =
    kind === "prob"
      ? formatProb
      : kind === "count"
        ? formatCount
        : kind === "expected"
          ? formatExpectedCount
          : kind === "share"
            ? formatShare
            : kind === "grade"
              ? formatGrades
              : kind === "setting"
                ? formatSetting
                : kind === "value"
                  ? (v) => formatDecimal(v, { digits: 3 })
                  : formatRisk;
  const node = ctx.num(x, format(x));
  if (hook) node.dataset.prxReadout = hook;
  return node;
}

function table(ctx, headers, rows, cls = "") {
  return ctx.h(
    "table",
    { class: `jnt-table ${cls}` },
    ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((h) => ctx.h("th", { scope: "col" }, h)))),
    ctx.h("tbody", {}, ...rows.map((row) => ctx.h("tr", {}, ...row.map((v) => ctx.h("td", {}, v))))),
  );
}

function hint(ctx) {
  return ctx.h("p", { class: "jnt-note" }, "Wide tables scroll inside this panel. Focus the region and use the arrow keys.");
}

function wide(ctx, parent, label, node) {
  const region = ctx.h("div", { class: "jnt-scroll" }, node);
  ctx.scrollRegion(region, label);
  parent.append(region);
  return region;
}

function reportWords(grade, ids) {
  return grade[0] === grade[1] ? "Withhold" : grade[0] < grade[1] ? `${ids[0]} above ${ids[1]}` : `${ids[1]} above ${ids[0]}`;
}

function nudgeReportPlotTitle(reportsEl) {
  for (const svg of reportsEl.querySelectorAll("svg")) {
    const yLbl = svg.querySelector('g[aria-label="y-axis label"] text');
    if (!yLbl) continue;
    yLbl.setAttribute("dy", "-8");
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[1] === 0) {
      svg.setAttribute("viewBox", `${vb[0]} -10 ${vb[2]} ${vb[3] + 10}`);
    }
  }
}

export function createOpenPairsSlots(ctx, parent = ctx.charts, { data, optimization, inDisclosures = false } = {}) {
  const grid = ctx.h("div", { class: "jnt-grid jnt-section" });
  const fixed = ctx.h("section", { class: "jnt-paper prx-light-panel" });
  const moving = ctx.h("section", { class: "jnt-paper prx-light-panel" });
  grid.append(...(data ? [moving, fixed] : [fixed, moving]));
  const states = ctx.h("section", { class: "jnt-paper prx-light-panel jnt-section" });
  const all = ctx.h("section", { class: "jnt-paper prx-light-panel jnt-section" });
  const context = ctx.h("p", { class: "jnt-note jnt-context" });
  const costs = ctx.h("div", { class: "estim-grid jnt-section" });
  const costSlots = {
    criterion: ctx.h("section", { class: "estim-cost sev-paper prx-light-panel" }),
    composite: ctx.h("section", { class: "estim-cost sev-paper prx-light-panel" }),
  };
  costs.append(costSlots.criterion, costSlots.composite);
  const law = ctx.h("section", { class: "sev-paper prx-light-panel jnt-section" });
  const reports = ctx.h("section", { class: "sev-paper prx-light-panel jnt-section" });
  const scope = ctx.h("section", { class: "jnt-paper prx-light-panel jnt-section" });
  if (!data) {
    parent.append(grid, states, all, context, costs, law, reports, scope);
    return { fixed, moving, states, all, context, costSlots, law, reports, scope };
  }
  grid.classList.add("jnt-overview");
  const fixedData = ctx.h("section", { class: "jnt-paper prx-light-panel jnt-section" });
  const movingData = ctx.h("section", { class: "jnt-paper prx-light-panel jnt-section" });
  if (inDisclosures) {
    data.append(states, grid, fixedData, movingData, all);
    optimization.append(scope, context, costs, law, reports);
  } else {
    parent.append(grid, states, scope);
    data.append(fixedData, movingData, all);
    optimization.append(context, costs, law, reports);
  }
  return { fixed, moving, fixedData, movingData, states, all, context, costSlots, law, reports, scope };
}

/** Actual diagnostic renderer; the parent invokes it alongside the actual predecessor cost/law/report views. */
export function createOpenJointView(ctx, slots, { stageHooks = false } = {}) {
  let fixedFigureHost = null;
  let distFigureHost = null;
  let statesGridHost = null;

  function drawPlots(model) {
    const { selected: r, law, state } = model;
    const coupling = state.law === "coupling";
    const ids = law.ids;
    const fixedRows = coupling
      ? model.reports.map((x) => ({ label: reportWords(x.grade, ids), risk: x.criterion.risk, grade: x.grade }))
      : [
          ...r.criterion.Rk.map((risk, k) => ({ label: k === 0 ? "First criterion risk" : "Second criterion risk", risk })),
          { label: "Weighted criterion risk", risk: r.criterion.risk },
        ];
    if (fixedFigureHost) {
      plot(fixedFigureHost, {
        height: 215,
        marginLeft: coupling ? 92 : 168,
        marginRight: 18,
        marginBottom: 46,
        x: { domain: [0, 1], label: "Expected loss per unordered pair (risk)", labelOffset: 36, grid: true, ticks: 3 },
        y: { domain: fixedRows.map((x) => x.label), label: null },
        alt: coupling
          ? "All three fixed two-unit reports retain their additive risk while only the cross-criterion coupling changes. This is a fixed-report comparison, not just the currently optimal action."
          : "The selected fixed report’s criterion-specific and weighted risks, derived from the within-criterion pair errors.",
        table: fixedRows,
        keyboard: {
          data: fixedRows,
          x: "risk",
          y: "label",
          title: (x) => `${x.label}: risk ${formatRisk(x.risk)}.`,
        },
        marks: (p, P) => [
          P.barX(fixedRows, { x: "risk", y: "label", fill: p.plotFg }),
          P.tip(fixedRows, P.pointer({ x: "risk", y: "label", title: (x) => `${x.label}: ${formatRisk(x.risk)}` })),
        ],
      });
    }

    const dist = r.wrong.values.map((value, i) => ({ value, prob: r.wrong.probs[i] }));
    if (distFigureHost) {
      const labeledDist = dist.filter((x, idx) =>
        dist.every((o, j) => j === idx || Math.abs(o.value - x.value) >= 0.12 * Math.max(1, r.criterion.N)),
      );
      plot(distFigureHost, {
        height: slots.movingData ? 205 : 235,
        marginLeft: 48,
        marginRight: 22,
        marginTop: 26,
        marginBottom: 48,
        x: {
          domain: [0, Math.max(1, r.criterion.N)],
          label: "Weighted wrong count in a complete state",
          labelOffset: 36,
          inset: 18,
          ticks: 3,
        },
        y: { domain: [0, 1], label: "State probability", grid: true, ticks: 3 },
        alt: "The full engine distribution of the weighted wrong count for the separately selected fixed report. Every returned value is retained, including a value with zero probability.",
        table: dist,
        keyboard: {
          data: dist,
          x: "value",
          y: "prob",
          title: (x) => `Weighted wrong count ${formatExpectedCount(x.value)} has probability ${formatProb(x.prob)}.`,
        },
        marks: (p, P) => [
          P.ruleX(dist, { x: "value", y1: 0, y2: "prob", stroke: p.plotFg, strokeWidth: 12 }),
          P.dot(dist, { x: "value", y: "prob", fill: p.plotFg, r: 4 }),
          ...(slots.movingData
            ? [
                numText(labeledDist.filter((x) => x.prob <= 0.88), {
                  x: "value",
                  y: "prob",
                  value: "prob",
                  format: formatProb,
                  dy: -8,
                  fill: p.plotFg,
                  stroke: p.plotBg,
                  strokeWidth: 4,
                  paintOrder: "stroke",
                  fontWeight: 700,
                }),
                numText(labeledDist.filter((x) => x.prob > 0.88), {
                  x: "value",
                  y: "prob",
                  value: "prob",
                  format: formatProb,
                  dy: 15,
                  fill: p.plotFg,
                  stroke: p.plotBg,
                  strokeWidth: 4,
                  paintOrder: "stroke",
                  fontWeight: 700,
                }),
              ]
            : []),
          P.tip(
            dist,
            P.pointer({
              x: "value",
              y: "prob",
              title: (x) => `${formatExpectedCount(x.value)} wrong, probability ${formatProb(x.prob)}`,
            }),
          ),
        ],
      });
    }

    const cells = r.states.flatMap((x) =>
      x.D.map((D, k) => ({ state: x.s + 1, criterion: k === 0 ? "First criterion" : "Second criterion", D })),
    );
    if (statesGridHost) {
      plot(statesGridHost, {
        height: Math.max(220, r.states.length * 44 + 78),
        marginLeft: 56,
        marginRight: 18,
        marginTop: 26,
        marginBottom: 40,
        x: { domain: ["First criterion", "Second criterion"], label: null },
        y: { domain: r.states.map((x) => x.s + 1), label: "Complete state", tickFormat: (v) => formatCount(v) },
        alt: "State by criterion grid of the number of wrong stated directions for the selected fixed report. The full finite-state table below includes each whole-state mass and weighted count.",
        table: cells,
        keyboard: {
          data: cells,
          x: "criterion",
          y: "state",
          columns: 2,
          sort: false,
          title: (x) => `State ${x.state}, ${x.criterion}: ${x.D} wrong stated directions.`,
        },
        marks: (p, P) => [
          P.cell(cells, { x: "criterion", y: "state", fill: (x) => p.purples[x.D], inset: 2 }),
          numText(cells, {
            x: "criterion",
            y: "state",
            value: "D",
            format: (v) => formatCount(v),
            fill: (x) => labelOn(p.purples[x.D], p),
            fontWeight: 700,
          }),
          P.tip(cells, P.pointer({ x: "criterion", y: "state", title: (x) => `State ${x.state}: ${x.D} wrong on ${x.criterion}` })),
        ],
      });
    }
  }

  return {
    renderPlots: drawPlots,
    render(model) {
      const { comparison: c, selected: r, law, state } = model;
      const coupling = state.law === "coupling";
      const ids = law.ids;
      const hk = (hookName) => (stageHooks ? undefined : hookName);
      const fixedData = slots.fixedData ?? slots.fixed;
      const movingData = slots.movingData ?? slots.moving;

      slots.fixed.replaceChildren(
        ctx.panelTitle(coupling ? "Fixed when only the coupling changes" : "Additive facts from the pair probabilities"),
        ctx.h(
          "p",
          { class: "jnt-note" },
          coupling
            ? "The editor changes complete-state masses while preserving both entire within-criterion two-unit laws. Hold the error weights and τ fixed: every report’s additive risk stays fixed."
            : "This finite law supplies the within-criterion pair errors. Those arrays determine the additive risk of every complete report, but do not record the full joint distribution.",
        ),
        ctx.h(
          "p",
          {},
          "Error weights: ",
          n(ctx, model.w[0], "setting", "weight-0"),
          ", ",
          n(ctx, model.w[1], "setting", "weight-1"),
          ". Composite coefficients are separately fixed at ",
          n(ctx, model.a[0], "setting", "coefficient-0"),
          ", ",
          n(ctx, model.a[1], "setting", "coefficient-1"),
          ".",
        ),
      );
      fixedFigureHost = ctx.h("div");
      slots.fixed.insertBefore(fixedFigureHost, slots.fixed.children[1]);
      slots.fixed.append(
        ctx.h(
          "p",
          { class: "jnt-note" },
          "Report vectors follow ",
          name(ctx, ids.join(", ")),
          " in that order. Grade one states higher oriented priority; a shared grade withholds.",
        ),
      );
      if (slots.fixedData) fixedData.replaceChildren(ctx.panelTitle("Fixed report and criterion probabilities"), hint(ctx));
      else slots.fixed.append(hint(ctx));

      const pairs = c.criterionE.e.flatMap((matrix, k) =>
        ids.flatMap((first, i) =>
          ids.flatMap((second, j) => (i === j ? [] : [{ k, first, second, i, j, error: matrix[i][j] }])),
        ),
      );
      wide(
        ctx,
        fixedData,
        "Every within-criterion directional error",
        table(
          ctx,
          ["Criterion", "Proposed direction", "Error probability"],
          pairs.map((x) => [
            x.k === 0 ? "First criterion" : "Second criterion",
            name(ctx, `${x.first} above ${x.second}`),
            n(ctx, x.error, "prob", `criterion-${x.k}-${x.i}-${x.j}`),
          ]),
          "jnt-pairs",
        ),
      );
      if (coupling) {
        wide(
          ctx,
          fixedData,
          "Every fixed two-unit additive risk",
          table(
            ctx,
            ["Fixed report", "N: stated pairs", "Weighted expected wrong count", "Weighted wrong share among stated pairs", "Additive risk"],
            model.reports.map((x, i) => [
              n(ctx, x.grade, "grade", `fixed-${i}-grade`),
              n(ctx, x.criterion.N, "count", `fixed-${i}-N`),
              n(ctx, x.criterion.Ew, "expected", `fixed-${i}-Ew`),
              n(ctx, x.weightedEvaluation.EoverN[0], "share", `fixed-${i}-share`),
              n(ctx, x.criterion.risk, "risk", `fixed-${i}-risk`),
            ]),
          ),
        );
      }

      slots.moving.replaceChildren(
        ctx.panelTitle("What the joint law adds"),
        ctx.h(
          "p",
          { class: "jnt-selected" },
          "Selected fixed report ",
          n(ctx, r.grade, "grade", hk("selected-grade")),
          "; N = ",
          n(ctx, r.criterion.N, "count", hk("selected-N")),
          r.criterion.N === 1 ? " stated pair; M = " : " stated pairs; M = ",
          n(ctx, r.criterion.M, "count", hk("selected-M")),
          r.criterion.M === 1 ? " possible pair. " : " possible pairs. ",
          "This choice need not minimize either loss.",
        ),
        ctx.h(
          "p",
          {},
          "Mean weighted fraction correct: ",
          n(ctx, r.meanCorrectFraction, "share", hk("mean-correct")),
          ". Probability all stated directions are right on every criterion: ",
          n(ctx, r.wrong.pAllCriteriaRight, "prob", hk("all-right")),
          ".",
        ),
      );
      distFigureHost = ctx.h("div");
      if (slots.movingData) {
        slots.moving.insertBefore(distFigureHost, slots.moving.children[1]);
        if (!stageHooks) ctx.primaryGraphic(distFigureHost);
      } else {
        slots.moving.append(distFigureHost);
      }
      if (slots.movingData) movingData.replaceChildren(ctx.panelTitle("Joint distribution and composite errors"), hint(ctx));
      else slots.moving.append(hint(ctx));

      const dist = r.wrong.values.map((value, i) => ({ value, prob: r.wrong.probs[i] }));
      wide(
        ctx,
        movingData,
        "Complete wrong-count distribution",
        table(
          ctx,
          ["Weighted wrong count", "Probability"],
          dist.map((x, i) => [n(ctx, x.value, "expected", `distribution-value-${i}`), n(ctx, x.prob, "prob", `distribution-prob-${i}`)]),
          "jnt-compact",
        ),
      );
      slots.moving.append(
        ctx.h(
          "p",
          {},
          "Probability of zero weighted wrong count: ",
          n(ctx, r.wrong.pNone, "prob", hk("none")),
          ". All criteria right: ",
          n(ctx, r.wrong.pAllCriteriaRight, "prob"),
          ". The first event ignores wrong directions on a zero-weight criterion; the second includes every criterion.",
        ),
        ctx.h(
          "p",
          {},
          "Expected weighted wrong count: ",
          n(ctx, r.wrong.expected, "expected", "joint-expected"),
          ". Unweighted union-bound lower bound on the all-criteria event: ",
          n(ctx, r.wrong.unionBound, "prob", hk("union-bound")),
          ". This lower bound need not be close to the actual probability.",
        ),
      );
      if (slots.movingData) {
        const { i, j } = c.pair;
        const bars = [
          [i, j, !stageHooks],
          [j, i, true],
        ].map(([first, second, keepHook]) => ({
          first,
          second,
          keepHook,
          value: c.compositeE.e[0][first][second],
        }));
        const panel = ctx.h(
          "div",
          { class: "estim-comparison jnt-composite-bars" },
          ctx.h(
            "section",
            {},
            ctx.panelTitle("Wrong direction on the composite"),
            ...bars.map(({ first, second, keepHook, value }) =>
              ctx.h(
                "div",
                { class: "estim-cost-row" },
                name(ctx, `${ids[first]} above ${ids[second]}`),
                ctx.h("span", { class: "estim-cost-track", "aria-hidden": "true" }, ctx.h("span", { class: "estim-cost-fill", style: `width:${100 * value}%` })),
                n(ctx, value, "prob", keepHook ? `overview-composite-error-${first}-${second}` : undefined),
              ),
            ),
          ),
        );
        panel.style.display = "block";
        distFigureHost.after(panel);
      }
      const compositeRows = ids.flatMap((first, i) =>
        ids.flatMap((second, j) =>
          i === j ? [] : [[name(ctx, `${first} above ${second}`), n(ctx, c.compositeE.e[0][i][j], "prob", `pair-composite-${i}-${j}`)]],
        ),
      );
      wide(
        ctx,
        movingData,
        "Composite directional error probabilities",
        table(ctx, ["Constructed composite direction", "Error probability"], compositeRows, "jnt-pairs"),
      );
      if (r.criterion.N === 0) {
        slots.moving.append(
          ctx.h(
            "p",
            { class: "jnt-note" },
            "No directions are stated, so a correct or wrong fraction is not defined. Both joint no-error events hold vacuously with probability one; silence supplies no accuracy claim.",
          ),
        );
      }

      slots.states.replaceChildren(
        ctx.panelTitle("The selected fixed report, state by state"),
        ctx.h(
          "p",
          {},
          "Each cell counts wrong stated directions on one criterion in one complete state. A strict statement is wrong when the oriented row value is less than or equal to the other’s. State probabilities refer to the entire array, not separately sampled unit rows or criteria.",
        ),
      );
      statesGridHost = ctx.h("div");
      slots.states.append(statesGridHost, hint(ctx));
      wide(
        ctx,
        slots.states,
        "Every complete-state realized wrong count",
        table(
          ctx,
          ["State", "Probability", "N", "First criterion D", "Second criterion D", "Weighted wrong count", "Weighted wrong fraction"],
          r.states.map((x) => [
            n(ctx, x.s + 1, "count"),
            n(ctx, x.prob, "prob", `state-${x.s}-prob`),
            n(ctx, x.N, "count", `state-${x.s}-N`),
            n(ctx, x.D[0], "count", `state-${x.s}-D-0`),
            n(ctx, x.D[1], "count", `state-${x.s}-D-1`),
            n(ctx, x.A, "expected", `state-${x.s}-A`),
            n(ctx, x.AoverN, "share", `state-${x.s}-fraction`),
          ]),
        ),
      );

      slots.all.replaceChildren(
        ctx.panelTitle("Every fixed report, not only an optimum"),
        ctx.h(
          "p",
          {},
          "E is the expected wrong count, N counts stated pairs, and M counts all unordered pairs. An expected wrong share E/N describes an average over statements. It is not the probability that every statement is right. Changing the selected report leaves the full supplied law and both objective definitions in place.",
        ),
        ctx.h(
          "p",
          { class: "jnt-note" },
          "A report with no statements has no defined correct fraction. Its joint no-error events hold vacuously with probability one, which supplies no accuracy claim.",
        ),
        hint(ctx),
      );
      wide(
        ctx,
        slots.all,
        "Fixed-report additive, composite and joint diagnostics",
        table(
          ctx,
          [
            "Fixed report",
            "N",
            "Additive risk",
            "Composite risk",
            "Mean weighted fraction correct",
            "Pr(zero weighted wrong count)",
            "Pr(all criteria right)",
            "Expected weighted wrong count",
            "Unweighted union lower bound",
          ],
          model.reports.map((x, i) => [
            n(ctx, x.grade, "grade", `joint-${i}-grade`),
            n(ctx, x.criterion.N, "count", `joint-${i}-N`),
            n(ctx, x.criterion.risk, "risk", `joint-${i}-criterion-risk`),
            n(ctx, x.composite.risk, "risk", `joint-${i}-composite-risk`),
            n(ctx, x.meanCorrectFraction, "share", `joint-${i}-mean-correct`),
            n(ctx, x.wrong.pNone, "prob", `joint-${i}-none`),
            n(ctx, x.wrong.pAllCriteriaRight, "prob", `joint-${i}-all-right`),
            n(ctx, x.wrong.expected, "expected", `joint-${i}-expected`),
            n(ctx, x.wrong.unionBound, "prob", `joint-${i}-union`),
          ]),
        ),
      );

      slots.context.textContent =
        "Below, we compare the costs for an isolated pair and find the best complete reports under each loss. Those searches use the same law and report family. The joint probabilities above refer to the fixed report you selected.";
      slots.scope.replaceChildren(
        ctx.panelTitle("What is and is not locked"),
        ctx.h(
          "p",
          {},
          coupling
            ? "Only the coupling slider changes dependence here. The displayed within-criterion laws, pair errors and every fixed report’s additive risk are unchanged when weights and τ stay fixed. Composite error and joint events require the whole state law. The state masses are linked by construction; they are not independent marginal edits."
            : "This view uses the complete stipulated chapter-law states. The selected report’s mean weighted accuracy and joint all-criteria correctness answer different questions, even when both summarize the same statements.",
        ),
        ctx.h(
          "p",
          {},
          "Pair probabilities determine the additive expected loss. To calculate the composite posterior, the distribution of the number of errors, or the chance of getting every direction right, we also need to know how the criteria vary together. The examples specify that joint distribution directly.",
        ),
      );

      drawPlots(model);
    },
  };
}

function drawOpenPairsStage(ctx, host, model) {
  const { comparison: c, selected: r, law, state, tau } = model;
  const coupling = state.law === "coupling";
  const ids = law.ids;
  const { i: pi, j: pj } = c.pair;
  const compErr = c.compositeE.e[0][pi][pj];

  const measuredW = Math.round(host.clientWidth || host.getBoundingClientRect?.().width || 0);
  const W = Math.max(260, measuredW || 680);
  const isWide = W >= 640;
  const H = isWide ? 308 : 416;

  const dist = r.wrong.values.map((value, idx) => ({ value, prob: r.wrong.probs[idx] }));
  const stageRows = [
    { group: "Locked by pair probabilities", metric: "Additive risk", raw: r.criterion.risk, kind: "risk" },
    { group: "Locked by pair probabilities", metric: "Mean weighted accuracy", raw: r.meanCorrectFraction, kind: "share" },
    { group: "Opened by joint law", metric: "All criteria right", raw: r.wrong.pAllCriteriaRight, kind: "prob" },
    { group: "Opened by joint law", metric: "Zero weighted wrong count", raw: r.wrong.pNone, kind: "prob" },
    { group: "Opened by joint law", metric: `Composite error (${ids[pi]} above ${ids[pj]})`, raw: compErr, kind: "prob" },
    { group: "Opened by joint law", metric: "Unweighted union lower bound", raw: r.wrong.unionBound, kind: "prob" },
  ];

  svgScene(
    host,
    {
      width: W,
      height: H,
      alt: `Comparison for fixed report ${formatGrades(r.grade)}: additive risk and mean weighted accuracy stay locked by pair probabilities, while the wrong-count distribution, all-criteria correctness, and composite directional error vary with the joint whole-state law.`,
      table: {
        caption: "Stage summary: quantities locked by pair probabilities versus opened by the joint law",
        columns: [
          { label: "Scope", value: "group", name: true },
          { label: "Quantity", value: "metric", name: true },
          {
            label: "Value",
            value: "raw",
            num: true,
            format: (v, row) =>
              row.kind === "risk" ? formatReadoutRisk(v) : row.kind === "share" ? formatShare(v) : formatReadoutProb(v),
          },
        ],
        rows: stageRows,
      },
    },
    (scene) => {
      const { el, doc, palette: pal } = scene;
      const space = () => doc.createTextNode(" ");
      const ticks01 = [0, 0.5, 1];

      // -----------------------------------------------------------------------
      // BAND 1: Locked by pair probabilities (horizontal [0, 1] scale)
      // -----------------------------------------------------------------------
      const b1LabelW = isWide ? 128 : 100;
      const naShare = r.meanCorrectFraction === null;
      const b1ValW = naShare ? (isWide ? 138 : 136) : isWide ? 64 : 58;
      const b1TrackX0 = b1LabelW + 8;
      const b1TrackX1 = W - b1ValW - 8;
      const b1TrackW = Math.max(60, b1TrackX1 - b1TrackX0);
      const xB1 = (v) => b1TrackX0 + Math.max(0, Math.min(1, v)) * b1TrackW;

      scene.add(
        el("text", {
          x: 2,
          y: 16,
          fontSize: 13.5,
          fontWeight: 700,
          fill: pal.postText || pal.plotFg,
          text: "Locked by pair probabilities",
        }),
        space(),
      );
      if (W >= 430) {
        scene.add(
          el("text", {
            x: W - 2,
            y: 16,
            textAnchor: "end",
            fontSize: 13,
            fill: pal.plotMuted,
            text: coupling ? "Invariant across coupling λ" : "From within-criterion pair errors",
          }),
          space(),
        );
      }

      const b1Row1Y = isWide ? 50 : 49;
      const b1Row2Y = isWide ? 75 : 73;
      const b1AxisY = isWide ? 89 : 87;
      const b1TickY = isWide ? 104 : 102;

      const b1TicksG = el("g", { "aria-label": "x-axis tick label" });
      for (const tv of ticks01) {
        const tx = xB1(tv);
        scene.add(
          el("line", {
            x1: tx,
            y1: b1Row1Y - 12,
            x2: tx,
            y2: b1AxisY,
            stroke: pal.plotGrid,
            strokeWidth: 1,
          }),
        );
        b1TicksG.append(
          el("text", {
            x: tx,
            y: b1TickY,
            textAnchor: tv === 0 ? "start" : tv === 1 ? "end" : "middle",
            fontSize: 13,
            fill: pal.plotMuted,
            "data-num": dataNum(tv),
            text: tickLabel(tv, 0, ticks01),
          }),
          space(),
        );
      }
      scene.add(
        el("line", {
          x1: b1TrackX0,
          y1: b1AxisY,
          x2: b1TrackX1,
          y2: b1AxisY,
          stroke: pal.plotAxis,
          strokeWidth: 1,
        }),
        b1TicksG,
      );

      // Dashed tau line + rx:3 plotBg pill on locked band
      const tauX = xB1(tau);
      const tauStr = formatSetting(tau);
      const tauLabel = `τ = ${tauStr}`;
      const tauPillW = Math.round(tauLabel.length * 7.1 + 10);
      const tauClampedX = Math.max(b1TrackX0 + tauPillW / 2, Math.min(b1TrackX1 - tauPillW / 2, tauX));
      scene.add(
        el("line", {
          x1: tauX,
          y1: b1Row1Y - 13,
          x2: tauX,
          y2: b1AxisY,
          stroke: pal.plotAxis,
          strokeWidth: 1.3,
          strokeDasharray: "4 3",
        }),
        el("rect", {
          x: Math.round(tauClampedX - tauPillW / 2),
          y: isWide ? 21 : 20,
          width: tauPillW,
          height: 17,
          rx: 3,
          fill: pal.plotBg,
          stroke: pal.plotGrid,
          strokeWidth: 0.9,
        }),
        el(
          "text",
          {
            x: tauClampedX,
            y: isWide ? 34 : 33,
            textAnchor: "middle",
            fontSize: 13,
            fontWeight: 600,
            fill: pal.plotMuted,
          },
          "τ = ",
          el("tspan", { text: tauStr, "data-num": dataNum(tau) }),
        ),
        space(),
      );

      const b1Rows = [
        {
          label: "Additive risk",
          cy: b1Row1Y,
          val: r.criterion.risk,
          barVal: r.criterion.risk,
          fill: pal.post,
          ink: pal.postText || pal.plotFg,
          text: formatReadoutRisk(r.criterion.risk),
          hook: undefined,
        },
        {
          label: "Mean accuracy",
          cy: b1Row2Y,
          val: r.meanCorrectFraction,
          barVal: naShare ? 0 : r.meanCorrectFraction,
          fill: naShare ? scene.hatchDef("jnt-stage-na") : pal.blues[5],
          ink: pal.plotFg,
          text: formatShare(r.meanCorrectFraction),
          hook: "mean-correct",
        },
      ];

      for (const row of b1Rows) {
        const barH = isWide ? 15 : 14;
        const barW = naShare && row.val === null ? b1TrackW : Math.max(row.barVal > 0 ? 2.5 : 0, xB1(row.barVal) - b1TrackX0);
        const pillX = W - b1ValW;
        const pillW = b1ValW - 2;
        scene.add(
          el("text", {
            x: b1LabelW,
            y: row.cy + 4.5,
            textAnchor: "end",
            fontSize: 13,
            fontWeight: 600,
            fill: pal.plotFg,
            text: row.label,
          }),
          space(),
          el("rect", {
            x: b1TrackX0,
            y: row.cy - barH / 2,
            width: b1TrackW,
            height: barH,
            rx: 3,
            fill: pal.plotGrid,
            fillOpacity: 0.45,
          }),
          el("rect", {
            x: b1TrackX0,
            y: row.cy - barH / 2,
            width: barW,
            height: barH,
            rx: 3,
            fill: row.fill,
            fillOpacity: row.val === null ? 0.55 : 0.88,
          }),
          el("rect", {
            x: pillX,
            y: row.cy - 9.5,
            width: pillW,
            height: 19,
            rx: 3,
            fill: pal.plotBg,
            stroke: pal.plotGrid,
            strokeWidth: 0.9,
          }),
          el("text", {
            x: Math.round(pillX + pillW / 2),
            y: row.cy + 4.5,
            textAnchor: "middle",
            fontSize: 13,
            fontWeight: 700,
            fill: row.ink,
            "data-num": dataNum(row.val),
            ...(row.hook ? { "data-prx-readout": row.hook } : {}),
            text: row.text,
          }),
          space(),
        );
      }

      const divider1Y = isWide ? 115 : 112;
      scene.add(
        el("line", {
          x1: 0,
          y1: divider1Y,
          x2: W,
          y2: divider1Y,
          stroke: pal.plotGrid,
          strokeWidth: 1,
        }),
      );

      // -----------------------------------------------------------------------
      // BAND 2A: Wrong-count distribution Pr(A(g, theta) = v)
      // -----------------------------------------------------------------------
      const distColW = isWide ? Math.floor(W * 0.53) : W;
      const distTitleY = isWide ? 138 : 133;
      const pyTop = isWide ? 168 : 160;
      const pyBot = isWide ? 266 : 230;
      const plotH = pyBot - pyTop;
      const px0 = isWide ? 44 : 38;
      const px1 = distColW - (isWide ? 16 : 10);
      const xInset = 22;
      const xMax = Math.max(1, r.criterion.N);
      const xDist = (v) => px0 + xInset + (Math.max(0, Math.min(xMax, v)) / xMax) * Math.max(40, px1 - px0 - xInset * 2);
      const yDist = (p) => pyBot - Math.max(0, Math.min(1, p)) * plotH;

      const meanStr = formatReadoutExpected(r.wrong.expected);
      scene.add(
        el("text", {
          x: 2,
          y: distTitleY,
          fontSize: 13.5,
          fontWeight: 700,
          fill: pal.critInk[0],
          text: "Wrong-count distribution",
        }),
        space(),
        el(
          "text",
          {
            x: px1,
            y: distTitleY,
            textAnchor: "end",
            fontSize: 13,
            fill: pal.plotMuted,
          },
          "mean ",
          el("tspan", { text: meanStr, "data-num": dataNum(r.wrong.expected), fontWeight: 600, fill: pal.plotFg }),
        ),
        space(),
      );

      const yTicksG = el("g", { "aria-label": "y-axis tick label" });
      for (const tv of ticks01) {
        const ty = yDist(tv);
        scene.add(
          el("line", {
            x1: px0,
            y1: ty,
            x2: px1,
            y2: ty,
            stroke: tv === 0 ? pal.plotAxis : pal.plotGrid,
            strokeWidth: 1,
          }),
        );
        yTicksG.append(
          el("text", {
            x: px0 - 6,
            y: ty + 4.5,
            textAnchor: "end",
            fontSize: 13,
            fill: pal.plotMuted,
            "data-num": dataNum(tv),
            text: tickLabel(tv, 0, ticks01),
          }),
          space(),
        );
      }
      scene.add(yTicksG);

      // Locked expected wrong count dashed vertical reference line
      const meanX = xDist(r.wrong.expected);
      scene.add(
        el("line", {
          x1: meanX,
          y1: pyTop - 4,
          x2: meanX,
          y2: pyBot,
          stroke: pal.plotAxis,
          strokeWidth: 1.3,
          strokeDasharray: "4 3",
        }),
      );

      // X-axis ticks & title
      const xTickVals = xMax === 5 ? [0, 1, 2, 3, 4, 5] : [0, xMax / 2, xMax];
      const xTicksG = el("g", { "aria-label": "x-axis tick label" });
      for (const xv of xTickVals) {
        const xx = xDist(xv);
        scene.add(
          el("line", {
            x1: xx,
            y1: pyBot,
            x2: xx,
            y2: pyBot + 4,
            stroke: pal.plotAxis,
            strokeWidth: 1,
          }),
        );
        xTicksG.append(
          el("text", {
            x: xx,
            y: pyBot + 17,
            textAnchor: "middle",
            fontSize: 13,
            fill: pal.plotMuted,
            "data-num": dataNum(xv),
            text: tickLabel(xv, 0, xTickVals),
          }),
          space(),
        );
      }
      scene.add(
        xTicksG,
        el("text", {
          x: Math.round((px0 + px1) / 2),
          y: pyBot + (isWide ? 36 : 34),
          textAnchor: "middle",
          fontSize: 13,
          fill: pal.plotMuted,
          text: "Weighted wrong count in a state",
        }),
        space(),
      );

      // Lollipop bars & non-overlapping rx:3 plotBg probability pills
      const placedPills = [];
      const sortedByProb = dist
        .map((d, idx) => {
          const sx = xDist(d.value);
          const pStr = formatReadoutProb(d.prob);
          const pW = Math.max(34, Math.round(pStr.length * 7.2 + 10));
          const clampedX = Math.max(px0 + pW / 2, Math.min(px1 - pW / 2, sx));
          return { ...d, idx, sx, sy: yDist(d.prob), pStr, pW, clampedX };
        })
        .sort((a, b) => b.prob - a.prob || a.value - b.value);
      const pillByIdx = new Map();
      for (const item of sortedByProb) {
        if (placedPills.every((o) => Math.abs(o.x - item.clampedX) >= (o.w + item.pW) / 2 + 4)) {
          pillByIdx.set(item.idx, item);
          placedPills.push({ x: item.clampedX, w: item.pW });
        }
      }

      dist.forEach((d, idx) => {
        const sx = xDist(d.value);
        const sy = yDist(d.prob);
        const isZeroWrong = d.value === 0;
        const barColor = isZeroWrong ? pal.crit[0] : pal.est;
        const inkColor = isZeroWrong ? pal.critInk[0] : pal.estText || pal.plotFg;
        const barW = 14;
        const barTop = Math.min(pyBot, sy);
        const barH = Math.max(0, pyBot - barTop);

        if (barH > 0.5) {
          scene.add(
            el("rect", {
              x: sx - barW / 2,
              y: barTop,
              width: barW,
              height: barH,
              rx: 2,
              fill: barColor,
              fillOpacity: 0.28,
            }),
            el("line", {
              x1: sx,
              y1: pyBot,
              x2: sx,
              y2: sy,
              stroke: barColor,
              strokeWidth: 3.2,
            }),
          );
        }
        scene.add(
          el("circle", {
            cx: sx,
            cy: sy,
            r: 5,
            fill: d.prob > 0 ? barColor : pal.plotBg,
            stroke: barColor,
            strokeWidth: 2,
          }),
        );

        const pill = pillByIdx.get(idx);
        if (pill) {
          const { pStr, pW, clampedX } = pill;
          const pillCy = Math.max(pyTop - 10, sy - 13);
          scene.add(
            el("rect", {
              x: Math.round(clampedX - pW / 2),
              y: Math.round(pillCy - 9),
              width: pW,
              height: 18,
              rx: 3,
              fill: pal.plotBg,
              stroke: d.prob > 0 ? barColor : pal.plotGrid,
              strokeWidth: d.prob > 0 ? 1.1 : 0.85,
            }),
            el("text", {
              x: Math.round(clampedX),
              y: Math.round(pillCy + 4.5),
              textAnchor: "middle",
              fontSize: 13,
              fontWeight: d.prob > 0 ? 700 : 500,
              fill: d.prob > 0 ? inkColor : pal.plotMuted,
              "data-num": dataNum(d.prob),
              text: pStr,
            }),
            space(),
          );
        }
      });

      // -----------------------------------------------------------------------
      // BAND 2B: Joint & composite outcomes (side-by-side at wide, stacked at narrow)
      // -----------------------------------------------------------------------
      if (!isWide) {
        scene.add(
          el("line", {
            x1: 0,
            y1: 274,
            x2: W,
            y2: 274,
            stroke: pal.plotGrid,
            strokeWidth: 1,
          }),
        );
      }

      const rColX = isWide ? distColW + 20 : 0;
      const rColW = isWide ? W - rColX : W;
      const rTitleY = isWide ? 138 : 291;
      const rLabelW = isWide ? 126 : 116;
      const maxJointChars = Math.max(
        formatReadoutProb(r.wrong.pAllCriteriaRight).length,
        formatReadoutProb(r.wrong.pNone).length,
        formatReadoutProb(compErr).length,
      );
      const rValW = maxJointChars > 6 ? (isWide ? 90 : 86) : isWide ? 64 : 58;
      const rTrackX0 = rColX + rLabelW + 10;
      const rTrackX1 = rColX + rColW - rValW - 8;
      const rTrackW = Math.max(54, rTrackX1 - rTrackX0);
      const xR = (v) => rTrackX0 + Math.max(0, Math.min(1, v)) * rTrackW;

      scene.add(
        el("text", {
          x: rColX + 2,
          y: rTitleY,
          fontSize: 13.5,
          fontWeight: 700,
          fill: pal.critInk[1],
          text: "Opened: joint & composite",
        }),
        space(),
      );

      const rRow1Y = isWide ? 174 : 314;
      const rRow2Y = isWide ? 204 : 338;
      const rRow3Y = isWide ? 234 : 362;
      const rAxisY = isWide ? 253 : 377;
      const rTickY = isWide ? 269 : 392;
      const rNoteY = isWide ? 298 : 410;

      const rTicksG = el("g", { "aria-label": "x-axis tick label" });
      for (const tv of ticks01) {
        const tx = xR(tv);
        scene.add(
          el("line", {
            x1: tx,
            y1: rRow1Y - 11,
            x2: tx,
            y2: rAxisY,
            stroke: pal.plotGrid,
            strokeWidth: 1,
          }),
        );
        rTicksG.append(
          el("text", {
            x: tx,
            y: rTickY,
            textAnchor: tv === 0 ? "start" : tv === 1 ? "end" : "middle",
            fontSize: 13,
            fill: pal.plotMuted,
            "data-num": dataNum(tv),
            text: tickLabel(tv, 0, ticks01),
          }),
          space(),
        );
      }
      scene.add(
        el("line", {
          x1: rTrackX0,
          y1: rAxisY,
          x2: rTrackX1,
          y2: rAxisY,
          stroke: pal.plotAxis,
          strokeWidth: 1,
        }),
        rTicksG,
      );

      const jointRows = [
        {
          label: "All criteria right",
          cy: rRow1Y,
          val: r.wrong.pAllCriteriaRight,
          fill: pal.crit[0],
          ink: pal.critInk[0],
          hook: "all-right",
        },
        {
          label: "Zero wtd. wrong",
          cy: rRow2Y,
          val: r.wrong.pNone,
          fill: pal.crit[1],
          ink: pal.critInk[1],
          hook: "none",
        },
        {
          label: `Comp. err (${ids[pi]} > ${ids[pj]})`,
          cy: rRow3Y,
          val: compErr,
          fill: pal.est,
          ink: pal.estText || pal.plotFg,
          hook: `overview-composite-error-${pi}-${pj}`,
        },
      ];

      for (const row of jointRows) {
        const barH = isWide ? 15 : 14;
        const barW = Math.max(row.val > 0 ? 2.5 : 0, xR(row.val) - rTrackX0);
        const pillX = rColX + rColW - rValW;
        const pillW = rValW - 2;
        scene.add(
          el("text", {
            x: rColX + rLabelW,
            y: row.cy + 4.5,
            textAnchor: "end",
            fontSize: 13,
            fontWeight: 600,
            fill: pal.plotFg,
            dataset: { prxName: "" },
            text: row.label,
          }),
          space(),
          el("rect", {
            x: rTrackX0,
            y: row.cy - barH / 2,
            width: rTrackW,
            height: barH,
            rx: 3,
            fill: pal.plotGrid,
            fillOpacity: 0.45,
          }),
          el("rect", {
            x: rTrackX0,
            y: row.cy - barH / 2,
            width: barW,
            height: barH,
            rx: 3,
            fill: row.fill,
            fillOpacity: 0.88,
          }),
          el("rect", {
            x: pillX,
            y: row.cy - 9.5,
            width: pillW,
            height: 19,
            rx: 3,
            fill: pal.plotBg,
            stroke: pal.plotGrid,
            strokeWidth: 0.9,
          }),
          el("text", {
            x: Math.round(pillX + pillW / 2),
            y: row.cy + 4.5,
            textAnchor: "middle",
            fontSize: 13,
            fontWeight: 700,
            fill: row.ink,
            "data-num": dataNum(row.val),
            "data-prx-readout": row.hook,
            text: formatReadoutProb(row.val),
          }),
          space(),
        );
      }

      // Diamond marker on Row 1 ("All criteria right") showing the unweighted union lower bound
      const ubX = xR(r.wrong.unionBound);
      const dSize = 5.5;
      scene.add(
        el("polygon", {
          points: `${ubX},${rRow1Y - dSize} ${ubX + dSize},${rRow1Y} ${ubX},${rRow1Y + dSize} ${ubX - dSize},${rRow1Y}`,
          fill: pal.plotBg,
          stroke: pal.plotFocus,
          strokeWidth: 1.8,
        }),
        el(
          "text",
          {
            x: rColX + 2,
            y: rNoteY,
            fontSize: 13,
            fill: pal.plotMuted,
          },
          "◇ Union lower bound: ",
          el("tspan", {
            text: formatReadoutProb(r.wrong.unionBound),
            "data-num": dataNum(r.wrong.unionBound),
            "data-prx-readout": "union-bound",
            fontWeight: 700,
            fill: pal.plotFg,
          }),
        ),
        space(),
      );
    },
  );
}

function buildControls(ctx) {
  const { h } = ctx;
  const primary = h("div", { class: "jnt-primary-controls" });
  const lambda = ctx.slider({
    label: "Chance the criteria point the same way, λ",
    ...ctx.key("lambda"),
    onInput: (v) => ctx.set({ lambda: v }),
  });
  const select = h("select", {
    id: "jnt-fixed-report",
    name: "report",
    "data-prx-focus-key": "select:report",
  });
  const reportRoot = h(
    "div",
    { class: "prx-control jnt-report-select" },
    h("label", { for: "jnt-fixed-report" }, "Fixed report"),
    select,
  );
  ctx.listen(select, "change", () => ctx.set({ report: select.value }));
  primary.append(lambda.root, reportRoot);
  ctx.controls.append(primary);
  ctx.primaryControl(lambda.root);

  const law = ctx.select({
    label: "Supplied whole-state law",
    name: "law",
    options: [
      { value: "coupling", label: "Two units · agreeing or opposing states" },
      { value: "ch19", label: "Chapter law · four units" },
    ],
    onChange: (v) => ctx.set({ law: v, report: v === "coupling" ? "1/2" : "1/2/2/3", w: v === "coupling" ? 0.5 : 0.6 }),
  });
  const w = ctx.slider({
    label: "Error weight on the first criterion",
    ...ctx.key("w"),
    onInput: (v) => ctx.set({ w: v }),
  });
  const tau = ctx.slider({
    label: "Cost of withholding a pair, τ",
    ...ctx.key("tau"),
    onInput: (v) => ctx.set({ tau: v }),
  });

  const settingsBox = ctx.settingsBox("Settings");
  settingsBox.body.append(h("div", { class: "jnt-settings" }, law.root, w.root, tau.root));

  let optionLaw = null;
  return {
    render(state, model) {
      const isCoupling = state.law === "coupling";
      law.set(state.law);
      lambda.set(state.lambda);
      lambda.setDisabled(!isCoupling);
      lambda.root.hidden = !isCoupling;
      primary.dataset.single = isCoupling ? "false" : "true";
      if (isCoupling) {
        lambda.root.setAttribute("data-prx-primary-control", "");
        reportRoot.removeAttribute("data-prx-primary-control");
      } else {
        lambda.root.removeAttribute("data-prx-primary-control");
        reportRoot.setAttribute("data-prx-primary-control", "");
      }
      w.set(state.w);
      tau.set(state.tau);
      if (optionLaw !== state.law) {
        select.replaceChildren(
          ...model.reports.map((r) =>
            h(
              "option",
              { value: keyOf(r.grade) },
              isCoupling ? `${formatGrades(r.grade)} (${reportWords(r.grade, model.law.ids)})` : formatGrades(r.grade),
            ),
          ),
        );
        optionLaw = state.law;
      }
      select.value = keyOf(model.selected.grade);
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "pairs-leave-open",
    className: "jnt",
    css: OPEN_PAIRS_CSS + ESTIMAND_CSS + PAIR_COST_CSS + CRITERIA_PROFILE_CSS + JNT_V2_CSS,
    frame: "v2",
    keys: OPEN_PAIRS_KEYS,
    build(ctx) {
      ctx.root.classList.add("estim", "cp", "sev");
      const { h } = ctx;
      const R = ro(ctx);

      const control = buildControls(ctx);

      ctx.stage.classList.add("jnt-stage-paper", "prx-light-panel");
      const stageBar = h("div", { class: "jnt-stage-bar" });
      const stageChart = h("div", { class: "jnt-stage-chart" });
      ctx.stage.append(stageBar, stageChart);

      const dataBox = ctx.dataBox("Data, state-by-state grid and report tables");
      const methodBox = ctx.methodBox("Method, optimization context and scope");

      const slots = createOpenPairsSlots(ctx, ctx.stage, {
        data: dataBox.body,
        optimization: methodBox.body,
        inDisclosures: true,
      });
      const view = createOpenJointView(ctx, slots, { stageHooks: true });
      const costView = createEstimandCostView(ctx, slots.costSlots);
      const lawView = createEstimandLawView(ctx, slots.law);
      const reportView = createEstimandReportView(ctx, slots.reports);

      const scopeHint = h(
        "p",
        { class: "jnt-note" },
        "Moves probability between agreeing and opposing whole states while each criterion’s two-unit law stays fixed. This changes dependence, not error weights.",
      );
      slots.scope.before(scopeHint);

      let currentModel = null;

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            const m = currentModel ?? solveOpenPairs(state);
            if (info.disclosure === "data" && dataBox.open) {
              view.renderPlots(m);
            } else if (info.disclosure === "method" && methodBox.open) {
              costView.render(m.comparison);
              reportView.render(m.comparison);
              nudgeReportPlotTitle(slots.reports);
            }
            return;
          }

          const model = solveOpenPairs(state);
          currentModel = model;
          if (state.report !== keyOf(model.selected.grade)) {
            ctx.set({ report: keyOf(model.selected.grade) });
          }

          control.render(state, model);
          scopeHint.hidden = state.law !== "coupling";

          const r = model.selected;
          stageBar.replaceChildren(
            h(
              "span",
              { class: "jnt-selected" },
              "Report ",
              n(ctx, r.grade, "grade", "selected-grade"),
              ...(state.law === "coupling"
                ? [" (", r.grade[0] === r.grade[1] ? "Withhold" : name(ctx, reportWords(r.grade, model.law.ids)), ")"]
                : []),
              " · ",
              n(ctx, r.criterion.N, "count", "selected-N"),
              " of ",
              n(ctx, r.criterion.M, "count", "selected-M"),
              r.criterion.M === 1 ? " pair stated" : " pairs stated",
            ),
            h(
              "span",
              { class: "jnt-stage-sub" },
              "w = ",
              n(ctx, model.w[0], "setting"),
              " / ",
              n(ctx, model.w[1], "setting"),
            ),
          );

          drawOpenPairsStage(ctx, stageChart, model);

          view.render(model);
          costView.render(model.comparison);
          lawView.render(model.comparison);
          reportView.render(model.comparison);
          nudgeReportPlotTitle(slots.reports);

          if (r.criterion.N === 0) {
            R.set([
              "Report ",
              R.num(r.grade, formatGrades(r.grade)),
              " withholds every pair (mean accuracy ",
              R.share(r.meanCorrectFraction),
              "): additive risk is ",
              R.risk(r.criterion.risk),
              ", and all-criteria probability ",
              R.prob(r.wrong.pAllCriteriaRight),
              " holds vacuously.",
            ]);
          } else if (r.wrong.pNone !== r.wrong.pAllCriteriaRight) {
            R.set([
              "Report ",
              R.num(r.grade, formatGrades(r.grade)),
              " keeps additive risk ",
              R.risk(r.criterion.risk),
              ": zero weighted wrong has probability ",
              R.prob(r.wrong.pNone),
              ", while all criteria are right with probability ",
              R.prob(r.wrong.pAllCriteriaRight),
              ".",
            ]);
          } else {
            R.set([
              "Report ",
              R.num(r.grade, formatGrades(r.grade)),
              " (",
              R.count(r.criterion.N),
              r.criterion.N === 1 ? " stated pair" : " stated pairs",
              ") has additive risk ",
              R.risk(r.criterion.risk),
              " and mean accuracy ",
              R.share(r.meanCorrectFraction),
              ", while all criteria are right with probability ",
              R.prob(r.wrong.pAllCriteriaRight),
              ".",
            ]);
          }

          ctx.caption.replaceChildren(
            "Restated synthetic whole-state laws after chapters ",
            n(ctx, 11, "count"),
            " and ",
            n(ctx, 19, "count"),
            " and vignettes m2/m3 (CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            ").",
          );
        },
      };
    },
  });
}
