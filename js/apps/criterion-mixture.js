// App entry point for 4.8 criterion-mixture.
// The criterion selector chooses one whole vector after one fixed report has been selected.
import { createWidget } from "../shared/base.js";
import {
  clampFocusPoint,
  gradeColors,
  labelOn,
  numText,
  palette,
  placeDirectLabels,
  plot,
  svgScene,
} from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatEoverN,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  tickLabel,
} from "../shared/format.js";
import { ro, tagNode } from "../shared/readout.js";
import {
  criterionMixtureRisk,
  evaluateReport,
  exactOptimum,
  pairCount,
  relations,
  weightedError,
} from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from "../shared/criteria-provenance.js";
import { CERTAIN_OPPOSITION, CRITERION_MAJORITY, finiteCriteria } from "../shared/criteria-laws.js";
import { PAIR_COST_CSS, createPairCostView, criterionPairCosts } from "../shared/domain/conflict-pairs.js";
import { CRITERIA_PROFILE_CSS, isCriterionPairKey, resolveCriterionPair } from "../shared/domain/several-criteria.js";
import {
  drawTwoScoreReport,
  shareText,
  solveTwoScores,
  twoScoreFamily,
} from "../shared/domain/two-scores.js";

const TITLES = {
  six: "Six sites · two scores",
  opposition: "Two certain opposing criteria",
  majority: "Three criteria · two against one",
};

const label = (d, k) => d.criterionLabels?.[k] ?? ["First criterion", "Second criterion", "Third criterion"][k];
const shortCriterionLabel = (d, k, narrow) => {
  if (d.key === "six") return label(d, k);
  return narrow ? `Crit. ${k + 1}` : label(d, k);
};
const name = (ctx, value) => ctx.h("span", { "data-prx-name": "", text: value });
const n = (ctx, value, kind = "risk", hook) => {
  const f = {
    risk: formatRisk,
    readoutRisk: formatReadoutRisk,
    readoutProb: formatReadoutProb,
    count: formatCount,
    grades: formatGrades,
    prob: formatProb,
    setting: formatSetting,
    expected: formatExpectedCount,
    share: formatShare,
    fraction: formatEoverN,
    sci: formatSci,
    value: (v) => formatDecimal(v, { digits: 3 }),
  }[kind];
  const node = ctx.num(value, f(value));
  if (hook) node.dataset.prxReadout = hook;
  return node;
};
const gradeKey = (g) => Array.from(g).join("-");

export const MIXTURE_CSS = `${PAIR_COST_CSS}${CRITERIA_PROFILE_CSS}
.mix .prx-stage,
.mix .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.mix.prx-widget[data-prx-frame="v2"] .prx-toolbar { align-items: flex-end; gap: 0.28rem 0.6rem; margin-bottom: 0.38rem; }
.mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.35rem 0.9rem;
  min-width: 0;
}
.mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider {
  flex: 1 1 11rem;
  max-width: 17.5rem;
}
.mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .mix-tau-control {
  flex: 1.45 1 17rem;
  max-width: 26rem;
  grid-template-columns: minmax(5.5rem, 1fr) auto;
  column-gap: 0.5rem;
}
.mix .mix-tau-exact { display: contents; }
.mix .mix-tau-exact input {
  width: 8.6rem;
  max-width: 100%;
  min-width: 0;
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 0; }
@media (min-width: 48.01em) {
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets { display: flex; align-items: flex-start; gap: 0.45rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { margin: 0.25rem 0 0; font-size: 0.78rem; line-height: 1.15; white-space: nowrap; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem 0.28rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { min-height: 1.75rem; padding: 0.14rem 0.44rem; font-size: 0.8125rem; line-height: 1.18; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { min-height: 1.75rem; padding: 0.12rem 0; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls input[type="text"] { min-height: 1.85rem; }
}
@media (max-width: 48em) {
  .mix.prx-widget[data-prx-frame="v2"] { padding: 0.4rem 0.5rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.2rem 0.4rem; margin-bottom: 0.25rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls { gap: 0.25rem 0.5rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider,
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .mix-tau-control { flex: 1 1 100%; max-width: 100%; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 100%; }
  .mix .mix-tau-exact input { width: 7.4rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { display: none; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.2rem; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.14rem 0.36rem; font-size: 0.78rem; line-height: 1.12; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { padding: 0.14rem 0; font-size: 0.8125rem; }
  .mix.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.3rem; padding: 0.22rem 0.45rem; font-size: 0.85rem; line-height: 1.28; }
  .mix.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.32rem 0.45rem; }
  .mix .prx-stage .mix-col-head { margin-bottom: 0.08rem; }
  .mix .prx-stage .mix-stage-cue { font-size: 0.76rem; }
  .mix .prx-stage .mix-stage-chips { margin: 0.06rem 0 0.14rem; }
  .mix .prx-stage .tws-chip { padding: 0.08rem 0.36rem 0.08rem 0.18rem; font-size: 0.8rem; }
  .mix.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.25rem; gap: 0.28rem; }
  .mix.prx-widget[data-prx-frame="v2"] > .prx-caption { margin-top: 0.18rem; font-size: 0.74rem; line-height: 1.24; }
}
.mix .mix-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
  align-items: start;
  min-width: 0;
}
@media (max-width: 52em) {
  .mix .mix-stage-grid { gap: 0.32rem; }
}
.mix .prx-stage .mix-vector-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.mix .mix-stage-col { min-width: 0; max-width: 100%; }
.mix .prx-stage .mix-col-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.6rem;
  margin: 0 0 0.22rem;
}
.mix .prx-stage .mix-col-head .prx-panel-title { margin: 0; color: var(--prx-plot-fg); }
.mix .prx-stage .mix-stage-cue {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--prx-plot-muted);
}
.mix .prx-stage .mix-stage-chips { margin: 0.15rem 0 0.35rem; }
.mix .mix-figure { min-width: 0; max-width: 100%; }
.mix .mix-figure [data-mix-criterion] { cursor: pointer; }
.mix .mix-settings-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  align-items: flex-end;
  width: 100%;
  min-width: 0;
}
.mix .mix-settings-fields .prx-control,
.mix .mix-settings-fields select { min-width: 0; max-width: 100%; }
.mix .mix-data-stack { display: grid; gap: 0.75rem; min-width: 0; }
.mix .mix-section { margin: 0; min-width: 0; }
.mix .sev-paper .prx-result-tag,
.mix .sev-paper [data-prx-label],
.mix .prx-light-panel .prx-result-tag,
.mix .prx-light-panel [data-prx-label] { color: var(--prx-plot-fg); }
.mix .mix-identities { display: flex; flex-wrap: wrap; gap: 0.45rem 1.8rem; font-weight: 600; }
.mix .mix-identities p { margin: 0.25rem 0; }
.mix .mix-table { min-width: 39rem; }
.mix .mix-vector { min-width: 27rem; }
.mix .mix-vector th, .mix .mix-vector td { text-align: left; white-space: nowrap; }
.mix .mix-vector th:first-child,
.mix .mix-vector td:first-child { position: sticky; left: 0; min-width: 3.5rem; width: 3.5rem; background: var(--prx-plot-bg); z-index: 1; }
.mix .mix-picked { outline: 2px solid var(--prx-plot-focus); outline-offset: -2px; font-weight: 600; }
.mix .mix-short { font-size: 0.875rem; line-height: 1.45; margin: 0.3rem 0; }
.mix .mix-grades { margin: 0.4rem 0; }
.mix .mix-coherence-table { min-width: 31rem; }
.mix .mix-contributions { display: flex; flex-wrap: wrap; gap: 0.2rem 0.85rem; margin: 0.3rem 0; font-size: 0.875rem; }
.mix .mix-contributions > span { white-space: nowrap; }
.mix .tws-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin: 0.15rem 0; }
.mix .tws-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.16rem 0.52rem 0.16rem 0.26rem;
  border-radius: 5px;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.mix .tws-g {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  font-size: 0.74rem;
  letter-spacing: 0;
}
.mix .prx-stage .tws-gt,
.mix .prx-light-panel .tws-gt,
.mix .sev-paper .tws-gt { font-weight: 700; color: var(--prx-plot-muted); }
.mix .tws-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 0.75rem 1rem;
  align-items: start;
  min-width: 0;
  margin-top: 0.65rem;
}
@media (max-width: 48em) {
  .mix .tws-detail-grid { grid-template-columns: minmax(0, 1fr); }
}
.mix .tws-scroll { overflow-x: auto; max-width: 100%; min-width: 0; }
.mix .tws-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 42rem; font-variant-numeric: tabular-nums; }
.mix .tws-table th, .mix .tws-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--prx-plot-grid); text-align: left; white-space: nowrap; }
.mix .prx-light-panel .tws-table caption { text-align: left; font-weight: 600; padding: 0.25rem 0 0.35rem; color: var(--prx-plot-fg); }
.mix .tws-report { padding: 0.4rem 0; border-bottom: 1px solid var(--prx-plot-grid); }
.mix .tws-report:last-child { border-bottom: 0; }
.mix .tws-legend { display: flex; flex-wrap: wrap; gap: 0.45rem 0.95rem; font-size: 0.84rem; margin: 0.35rem 0 0; }
.mix .tws-dot-key {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  margin-right: 0.32rem;
  vertical-align: -0.06em;
  box-sizing: border-box;
}
.mix .mix-source-readout { font-size: 0.875rem; margin: 0.35rem 0; }
.mix .mix-source-caption { font-size: 0.8125rem; margin: 0.35rem 0 0; }
`;

export const MIXTURE_KEYS = {
  data: { type: "choice", values: Object.keys(TITLES), value: "six" },
  w: { type: "number", min: 0, max: 1, step: 0.01, value: 0.5 },
  tau: { type: "number", min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
  cap: { type: "choice", values: ["2", "3", "all"], value: "3" },
  criterion: { type: "choice", values: [0, 1, 2], value: 0 },
  report: { type: "integer", min: 1, max: 100, step: 1, value: 1 },
  pair: { type: "string", value: "A,C" },
};

const finiteCache = new Map();
const models = new Map();

function finiteInput(key) {
  if (finiteCache.has(key)) return finiteCache.get(key);
  const law = key === "majority" ? CRITERION_MAJORITY : CERTAIN_OPPOSITION;
  const E = finiteCriteria(law);
  const d = {
    key,
    ids: law.ids,
    criteria: law.criteria,
    criterionLabels: law.criteria.map((_, k) => ["First criterion", "Second criterion", "Third criterion"][k]),
    n: law.ids.length,
    K: law.criteria.length,
    M: pairCount(law.ids.length),
    law,
    E,
  };
  finiteCache.set(key, d);
  return d;
}

export function solveCriterionMixture(state) {
  const key = JSON.stringify([state.data, state.w, state.tau, state.cap]);
  let base = models.get(key);
  if (!base) {
    const data = state.data === "six" ? criteriaData("six") : finiteInput(state.data);
    const w = state.data === "majority" ? CRITERION_MAJORITY.w : [state.w, 1 - state.w];
    const family = state.data === "six" ? twoScoreFamily(state.cap) : { kind: "all" };
    const source = state.data === "six" ? solveTwoScores({ w: state.w, tau: state.tau, cap: state.cap }) : null;
    const optimum = source?.result ?? exactOptimum(data.E, { w, tau: state.tau, family });
    const profiles = optimum.grades.map((grade) => {
      const evaluation = evaluateReport(grade, data.E, { w, tau: state.tau });
      const mixture = criterionMixtureRisk(grade, data.E, { w, tau: state.tau });
      // Explicit Phase7 public composition: scalar w_k R_k only. The sum is engine mixture.risk.
      const contributions = mixture.w.map((weight, k) => weight * mixture.Rk[k]);
      return { grade, evaluation, mixture, contributions };
    });
    base = { data, w, family, source, optimum, profiles };
    models.set(key, base);
    if (models.size > 100) models.delete(models.keys().next().value);
  }
  const chosen = Math.max(0, Math.min(state.report - 1, base.profiles.length - 1));
  const selected = base.profiles[chosen];
  const criterion = Math.min(state.criterion, base.data.K - 1);
  const pair =
    state.pair === "auto"
      ? state.data === "six"
        ? [0, 2]
        : [0, 1]
      : resolveCriterionPair(base.data, state.pair);
  const costs = criterionPairCosts(base.data.E, pair, { w: base.w, tau: state.tau });
  const relation = relations(selected.grade);
  const weighted = weightedError(base.data.E, base.w);
  return {
    ...base,
    selected,
    chosen,
    criterion,
    pair: { i: pair[0], j: pair[1] },
    costs,
    relation,
    weighted,
    tau: state.tau,
    coherence:
      state.data === "six"
        ? [
            [0, 2],
            [1, 3],
          ].map(([i, j]) => ({
            i,
            j,
            error: weighted[i][j],
            relation: relation[i][j],
            decision: criterionPairCosts(base.data.E, [i, j], { w: base.w, tau: state.tau }).weighted.decision,
          }))
        : [],
  };
}

function table(ctx, headers, rows, cls = "mix-table") {
  return ctx.h(
    "table",
    { class: cls },
    ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((text) => ctx.h("th", { scope: "col" }, text)))),
    ctx.h("tbody", {}, ...rows.map((row) => ctx.h("tr", {}, ...row.map((value) => ctx.h("td", {}, value))))),
  );
}

function scroll(ctx, parent, labelText, content) {
  const region = ctx.h("div", { class: "sev-scroll" }, content);
  ctx.scrollRegion(region, labelText);
  parent.append(region);
  return region;
}

const hint = (ctx) =>
  ctx.h("p", { class: "sev-hint" }, "Wide tables scroll within this panel; focus the table region and use the arrow keys.");

export function createMixtureRiskView(ctx, slot) {
  return {
    render(model) {
      const { data, selected, optimum } = model;
      const rows = data.criteria.map((_, k) => ({
        k,
        criterion: label(data, k),
        w: selected.mixture.w[k],
        risk: selected.mixture.Rk[k],
        contribution: selected.contributions[k],
      }));
      const explanation = ctx.h(
        "p",
        { class: "mix-short" },
        "Select the report before the auxiliary criterion. Keep every stated and withheld comparison fixed while averaging the criterion-specific risks.",
      );
      const identities = ctx.h(
        "div",
        { class: "mix-identities" },
        ctx.h("p", {}, "Average of criterion risks: ", n(ctx, selected.mixture.risk, "risk", "mixture-risk")),
        ctx.h("p", {}, "Direct weighted reporting risk: ", n(ctx, selected.mixture.weightedRisk, "risk", "weighted-risk")),
      );
      const chips = ctx.h("div", { class: "tws-chips mix-grades" });
      drawTwoScoreReport(ctx, chips, selected.grade, data.ids);
      const reportLine = ctx.h(
        "p",
        { class: "mix-short" },
        "Report ",
        n(ctx, selected.grade, "grades", "selected-grade"),
        "; N ",
        n(ctx, selected.evaluation.N, "count", "selected-N"),
        " of M ",
        n(ctx, selected.evaluation.M, "count", "selected-M"),
        " pairs stated. Grade ",
        n(ctx, 1, "count"),
        " is stated highest priority. A shared grade means not compared, not equal.",
      );
      slot.replaceChildren(ctx.panelTitle("One fixed report, two risk calculations"));
      const fig = ctx.h("div");
      slot.append(fig);
      plot(fig, {
        height: 214,
        marginLeft: 108,
        marginRight: 64,
        marginBottom: 44,
        x: { domain: [0, 0.5], label: "Contribution to risk", labelOffset: 36, grid: true },
        y: { domain: rows.map((r) => r.criterion), label: null },
        alt: "Each bar is one criterion’s selection weight times the risk of the same complete report on that criterion. Their engine-computed sum equals the direct weighted risk.",
        table: rows,
        keyboard: {
          data: rows,
          x: "contribution",
          y: "criterion",
          title: (r) =>
            `${r.criterion}: weight ${formatProb(r.w)}, report risk ${formatRisk(r.risk)}, contribution ${formatRisk(r.contribution)}.`,
        },
        marks: (c, P) => [
          P.barX(rows, { x: "contribution", y: "criterion", fill: (r) => c.crit[r.k] }),
          numText(rows, {
            x: "contribution",
            y: "criterion",
            value: "contribution",
            format: (v) => formatRisk(v),
            dx: 6,
            textAnchor: "start",
            fill: c.plotFg,
            fontSize: 13,
          }),
          P.tip(
            rows,
            P.pointer({
              x: "contribution",
              y: "criterion",
              title: (r) => `${r.criterion}: ${formatProb(r.w)} × ${formatRisk(r.risk)} = ${formatRisk(r.contribution)}`,
            }),
          ),
        ],
      });
      slot.append(explanation, identities, reportLine, chips, hint(ctx));
      scroll(
        ctx,
        slot,
        "All criterion weights, risks and contributions",
        table(
          ctx,
          ["Criterion", "Selection chance w", "Risk of this report", "w × criterion risk"],
          rows.map((r) => [
            r.criterion,
            n(ctx, r.w, "prob", `weight-${r.k}`),
            n(ctx, r.risk, "risk", `criterion-risk-${r.k}`),
            n(ctx, r.contribution, "risk", `contribution-${r.k}`),
          ]),
        ),
      );
      slot.append(
        ctx.h("p", { class: "mix-short" }, tagNode(ctx, optimum)),
        ctx.h(
          "p",
          { class: "mix-short" },
          n(ctx, optimum.tieCount, "count", "tie-count"),
          optimum.tieCount === 1 ? " report has" : " reports have",
          " the smallest risk; equal-risk tolerance ",
          n(ctx, optimum.tieTol, "sci"),
          ". ",
          optimum.tieCount > model.profiles.length
            ? ctx.h("span", {}, n(ctx, model.profiles.length, "count"), " reports are retained.")
            : null,
        ),
      );
      const all = model.profiles.flatMap((p) =>
        data.criteria.map((_, k) => [
          n(ctx, p.grade, "grades"),
          label(data, k),
          n(ctx, p.evaluation.N, "count"),
          n(ctx, p.evaluation.E[k], "expected", `profile-${gradeKey(p.grade)}-${k}-E`),
          n(ctx, p.evaluation.EoverN[k], "fraction", `profile-${gradeKey(p.grade)}-${k}-fraction`),
          n(ctx, p.mixture.Rk[k], "risk", `profile-${gradeKey(p.grade)}-${k}-risk`),
          n(ctx, p.contributions[k], "risk", `profile-${gradeKey(p.grade)}-${k}-contribution`),
          n(ctx, p.mixture.risk, "risk", `profile-${gradeKey(p.grade)}-${k}-sum`),
        ]),
      );
      scroll(
        ctx,
        slot,
        "Every retained best report and criterion contribution",
        table(
          ctx,
          [
            "Report",
            "Criterion",
            "N",
            "Expected wrong count E",
            "E/N among stated",
            "Criterion risk",
            "Contribution",
            "Mixture sum",
          ],
          all,
        ),
      );
    },
  };
}

export function createCriterionBranchView(ctx, slot) {
  return {
    render(model) {
      const { data, criterion: k, selected } = model;
      slot.replaceChildren(
        ctx.panelTitle("One criterion selects one whole unit vector"),
        ctx.h(
          "p",
          { class: "mix-short" },
          "Inspecting ",
          name(ctx, label(data, k)),
          ": selection chance ",
          n(ctx, model.w[k], "prob", "branch-chance"),
          "; risk of the already chosen report on this criterion ",
          n(ctx, selected.mixture.Rk[k], "risk", "branch-risk"),
          ".",
        ),
        ctx.h(
          "p",
          { class: "mix-short" },
          "The outlined column gives the selected criterion for every unit. Switching criteria reevaluates the same report. The draw represents the weights in the loss.",
        ),
        ctx.h(
          "p",
          { class: "mix-short" },
          model.w[k] === 0
            ? "This branch has zero selection chance at these weights. Its criterion-specific risk can be inspected, but this mixture never selects it."
            : "The selected index would be used for the entire report, independently of the target law conditional on the supplied information.",
        ),
      );
      slot.append(
        ctx.h(
          "p",
          { class: "mix-short" },
          data.key === "six"
            ? "The six-site example treats the units as independent and normally distributed. The table gives the mean and SD on each criterion. The same risk identity also applies when units are dependent."
            : "These stipulated true values form one complete known state. The same selected criterion applies to both units, not separately to each row or pair.",
        ),
        hint(ctx),
      );
      const rows = data.ids.map((id, i) => [
        name(ctx, id),
        ...data.criteria.map((_, j) =>
          data.key === "six"
            ? ctx.h("span", {}, "Normal(", n(ctx, data.means[i][j], "value"), ", SD ", n(ctx, data.sds[i][j], "value"), ")")
            : n(ctx, data.law.states[0][i][j], "value"),
        ),
      ]);
      const t = table(ctx, ["Unit", ...data.criteria.map((_, j) => label(data, j))], rows, "mix-vector");
      for (const row of t.rows) row.cells[k + 1]?.classList.add("mix-picked");
      const vectorRegion = scroll(ctx, slot, "Whole selected criterion vector across every unit", t);
      const header = t.rows[0]?.cells[k + 1];
      if (header) vectorRegion.scrollLeft = Math.max(0, header.offsetLeft + header.offsetWidth - vectorRegion.clientWidth + 8);
    },
  };
}

function coherenceView(ctx, slot, model) {
  slot.replaceChildren();
  slot.hidden = model.data.key !== "six";
  if (slot.hidden) return;
  const r0 = model.coherence[0];
  const r1 = model.coherence[1];
  slot.append(
    ctx.panelTitle("An isolated-pair choice can disagree with the coherent report"),
    ctx.h(
      "p",
      { class: "mix-short" },
      "The table compares the same selected report with each pair’s own three-action choice. In this report, ",
      name(ctx, `${model.data.ids[r0.i]} above ${model.data.ids[r0.j]}`),
      " has weighted error ",
      n(ctx, r0.error, "readoutRisk"),
      " and ",
      name(ctx, `${model.data.ids[r1.i]} above ${model.data.ids[r1.j]}`),
      " has ",
      n(ctx, r1.error, "readoutRisk"),
      " against τ = ",
      n(ctx, model.tau, "setting"),
      ".",
    ),
    hint(ctx),
  );
  scroll(
    ctx,
    slot,
    "Coherent report and isolated comparisons",
    table(
      ctx,
      ["Direction", "Weighted error", "Withholding cost τ", "In the full report", "Cheapest isolated actions"],
      model.coherence.map((r) => [
        name(ctx, `${model.data.ids[r.i]} above ${model.data.ids[r.j]}`),
        n(ctx, r.error, "risk", `coherence-${r.i}-${r.j}-error`),
        n(ctx, model.tau, "setting"),
        r.relation === 1 ? "Stated above" : r.relation === -1 ? "Reverse direction stated" : "Withheld",
        r.decision.best.map((a) => (a === "withhold" ? "Withhold" : a === "iAboveJ" ? "Forward" : "Reverse")).join("; "),
      ]),
      "mix-coherence-table",
    ),
  );
}

// Keep a typed decimal as a draft. A redraw must never replace an active editing buffer or move its caret.
function createTauDraft(ctx, range) {
  const { min, max, value } = ctx.key("tau");
  const id = `${range.input.id}-exact`;
  const hintId = `${id}-hint`;
  let applied = value;
  let dirty = false;
  const input = ctx.h("input", {
    id,
    type: "text",
    inputmode: "decimal",
    name: "tau",
    role: "spinbutton",
    title: "Exact cost τ (.01 to .50): press Enter or leave field to apply; Esc cancels",
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-valuenow": value,
    "aria-invalid": "false",
    "aria-describedby": hintId,
    "data-prx-focus-key": "number:tau",
    value: String(value),
  });
  const root = ctx.h(
    "div",
    { class: "mix-tau-exact" },
    ctx.h("label", { for: id, class: "prx-sr-only" }, "Exact cost of withholding a pair, τ"),
    input,
  );
  const srHint = ctx.h("p", { id: hintId, class: "prx-sr-only", role: "status", "aria-live": "polite" });
  const instruction = () => srHint.replaceChildren("Enter or leave this field to apply; Esc cancels.");
  const reset = (v) => {
    applied = v;
    dirty = false;
    input.value = String(v);
    input.setAttribute("aria-valuenow", String(v));
    input.setAttribute("aria-valuetext", `Applied cost ${v}.`);
    input.setAttribute("aria-invalid", "false");
    instruction();
  };
  const read = () => {
    const raw = input.value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
  };
  const invalid = () => {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-valuetext", `Invalid draft; applied cost ${applied}.`);
    srHint.replaceChildren(
      "Enter a value from ",
      n(ctx, min, "setting"),
      " to ",
      n(ctx, max, "setting"),
      ". The applied cost is unchanged; Esc restores it.",
    );
  };
  const commit = () => {
    if (!dirty) return;
    const parsed = read();
    if (parsed === undefined) {
      invalid();
      return;
    }
    reset(parsed);
    ctx.set({ tau: parsed });
  };
  ctx.listen(input, "input", () => {
    dirty = true;
    input.setAttribute("aria-invalid", "false");
    input.setAttribute("aria-valuetext", `Draft not applied; applied cost ${applied}.`);
    srHint.replaceChildren("Not applied. Enter or leave this field to apply; Esc cancels.");
  });
  ctx.listen(input, "change", commit);
  ctx.listen(input, "blur", commit);
  ctx.listen(input, "keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      reset(applied);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const base = read() ?? applied;
    const direction = e.key === "ArrowUp" ? 1 : -1;
    const next = Math.min(max, Math.max(min, Number((base + direction * 0.01).toPrecision(15))));
    reset(next);
    ctx.set({ tau: next });
  });
  range.output.hidden = true;
  range.root.classList.add("mix-tau-control");
  range.root.append(root, srHint);
  reset(value);
  return {
    reset,
    sync(v) {
      if (!Object.is(v, applied)) reset(v);
    },
  };
}

function niceRiskScale(high) {
  const target = Math.max(0.08, high * 1.24);
  const steps = [0.02, 0.05, 0.1, 0.2, 0.25, 0.5];
  let step = 0.25;
  for (const s of steps) {
    if (target / s <= 4.6) {
      step = s;
      break;
    }
  }
  const topTick = Math.ceil((high * 1.08) / step) * step;
  const yMax = Math.max(target, topTick * 1.06);
  const ticks = [];
  for (let k = 0; k * step <= yMax + 1e-9 && k <= 6; k += 1) {
    ticks.push(Number((k * step).toFixed(6)));
  }
  return { yMax, ticks };
}

function createExpectationView(ctx, slot) {
  let activeKey = "0";
  const select = (k) => ctx.set({ criterion: k });

  ctx.listen(slot, "click", (e) => {
    const criterion =
      e.detail === 0
        ? e.target.closest(".prx-kbd-point")?.dataset.prxFocusKey?.split(":").at(-1)
        : e.target.closest("[data-mix-criterion]")?.dataset.mixCriterion;
    if (criterion !== undefined) select(Number(criterion));
  });

  return {
    render(model, isCompact = false) {
      const { data, selected, criterion } = model;
      const risk = selected.mixture.weightedRisk;
      let edge = 0;
      const rows = data.criteria.map((_, k) => {
        const w = selected.mixture.w[k];
        const left = edge;
        edge += w;
        return {
          k,
          criterion: label(data, k),
          w,
          left,
          right: edge,
          center: (left + edge) / 2,
          risk: selected.mixture.Rk[k],
          contribution: selected.contributions[k],
        };
      });
      const high = Math.max(0.05, ...rows.map((row) => row.risk), risk);
      const { yMax, ticks: yTicks } = niceRiskScale(high);
      const xTicks = [0, 0.25, 0.5, 0.75, 1];
      const height = isCompact ? 164 : 228;
      const margin = { top: 26, right: 64, bottom: 44, left: 48 };
      const xInset = 6;

      let pointCoords = [];
      const handle = svgScene(
        slot,
        {
          height,
          margin,
          alt: "Column width is the chance of drawing a criterion, height is the risk of the fixed report on that criterion, and area is its contribution. The dashed line gives the direct weighted risk.",
          table: {
            caption: "Selection chances and risks of the fixed report",
            rows,
            columns: [
              { label: "Criterion", value: "criterion" },
              { label: "Selection chance", value: "w", format: (v) => formatProb(v) },
              { label: "Criterion risk", value: "risk", format: (v) => formatRisk(v) },
              { label: "Weighted contribution", value: "contribution", format: (v) => formatRisk(v) },
            ],
          },
        },
        (scene) => {
          const { el, palette: pal, width } = scene;
          const x0 = margin.left + xInset;
          const x1 = Math.max(x0 + 40, width - margin.right - xInset);
          const plotW = x1 - x0;
          const yTop = margin.top;
          const yBottom = height - margin.bottom;
          const plotH = Math.max(40, yBottom - yTop);
          const xScale = (u) => x0 + u * plotW;
          const yScale = (v) => yBottom - (v / yMax) * plotH;

          // Y grid and ticks
          for (let i = 0; i < yTicks.length; i += 1) {
            const tv = yTicks[i];
            const py = yScale(tv);
            scene.add(
              el("line", {
                x1: x0,
                y1: py,
                x2: x1,
                y2: py,
                stroke: tv === 0 ? pal.plotAxis : pal.plotGrid,
                strokeWidth: tv === 0 ? 1.2 : 1,
              }),
              el("line", { x1: x0 - 4, y1: py, x2: x0, y2: py, stroke: pal.plotAxis, strokeWidth: 1 }),
              scene.numText(
                { x: x0 - 7, y: py + 4.2, textAnchor: "end", fill: pal.plotMuted },
                tv,
                tickLabel(tv, i, yTicks),
              ),
            );
          }

          // Rotated Y-axis label (keeps top header band 100% clear for criterion column names)
          const midY = (yTop + yBottom) / 2;
          scene.add(
            el("text", {
              x: 13,
              y: midY,
              textAnchor: "middle",
              fill: pal.plotMuted,
              fontWeight: 600,
              transform: `rotate(-90 13 ${midY.toFixed(1)})`,
              text: "Criterion risk",
            }),
          );

          // X ticks and centered X-axis label
          for (let i = 0; i < xTicks.length; i += 1) {
            const tx = xTicks[i];
            const px = xScale(tx);
            scene.add(
              el("line", { x1: px, y1: yBottom, x2: px, y2: yBottom + 4, stroke: pal.plotAxis, strokeWidth: 1 }),
              scene.numText(
                { x: px, y: yBottom + 16, textAnchor: "middle", fill: pal.plotMuted },
                tx,
                tickLabel(tx, i, xTicks),
              ),
            );
          }
          scene.add(
            el("text", {
              x: (x0 + x1) / 2,
              y: yBottom + 37,
              textAnchor: "middle",
              fill: pal.plotMuted,
              fontWeight: 600,
              text: "Selection chance w",
            }),
          );

          // Columns for positive-weight criteria
          const riskPillCandidates = [];
          const contribPills = [];

          for (const row of rows) {
            const isSel = row.k === criterion;
            const rx1 = xScale(row.left);
            const rx2 = xScale(row.right);
            const colW = rx2 - rx1;
            const ry = yScale(row.risk);
            const rh = Math.max(0, yBottom - ry);
            const ink = pal.critInk[row.k] || pal.plotFg;
            const fill = pal.crit[row.k] || pal.post;

            if (row.w > 0) {
              scene.add(
                el("rect", {
                  x: rx1,
                  y: ry,
                  width: Math.max(1.5, colW),
                  height: rh,
                  fill,
                  fillOpacity: isSel ? 0.34 : 0.2,
                  stroke: isSel ? pal.plotFocus : ink,
                  strokeWidth: isSel ? 2.4 : 1.25,
                  dataset: { mixCriterion: String(row.k) },
                }),
              );
            } else if (isSel) {
              // Zero-weight inspected branch stem and dot
              const zx = xScale(row.center);
              scene.add(
                el("line", {
                  x1: zx,
                  y1: yBottom,
                  x2: zx,
                  y2: ry,
                  stroke: ink,
                  strokeWidth: 2,
                  strokeDasharray: "3,3",
                  dataset: { mixCriterion: String(row.k) },
                }),
                el("circle", {
                  cx: zx,
                  cy: ry,
                  r: 4.5,
                  fill: pal.plotBg,
                  stroke: pal.plotFocus,
                  strokeWidth: 2,
                  dataset: { mixCriterion: String(row.k) },
                }),
              );
            }

            // Column header in top band when column is wide enough
            if (colW >= 54) {
              const cx = (rx1 + rx2) / 2;
              const hdrText = shortCriterionLabel(data, row.k, colW < 98);
              scene.add(
                el("text", {
                  x: cx,
                  y: yTop - 11,
                  textAnchor: "middle",
                  fill: ink,
                  fontWeight: isSel ? 700 : 600,
                  dataset: { mixCriterion: String(row.k) },
                  text: hdrText,
                }),
              );
            }

            // Risk pill candidate (shown when column is wide enough or branch is actively inspected)
            if (colW >= 52 || isSel) {
              const rTxt = formatReadoutRisk(row.risk);
              const pillW = Math.max(26, rTxt.length * 7.8 + 10);
              const rawCx = row.w > 0 ? (rx1 + rx2) / 2 : xScale(row.center);
              const clampedCx = Math.max(x0 + pillW / 2 + 2, Math.min(x1 - pillW / 2 - 2, rawCx));
              riskPillCandidates.push({
                id: `risk-${row.k}`,
                k: row.k,
                x: clampedCx,
                pillW,
                y: Math.min(yBottom - 11, Math.max(yTop + 10, ry - 11)),
                height: 18,
                risk: row.risk,
                rTxt,
                ink,
                isSel,
              });
            }

            // Contribution pill inside bar when tall and wide enough
            if (colW >= 54 && rh >= 38) {
              const cTxt = formatReadoutRisk(row.contribution);
              const showPrefix = colW >= 96;
              const pillW = Math.max(30, (showPrefix ? cTxt.length + 4 : cTxt.length) * 7.6 + 10);
              contribPills.push({
                k: row.k,
                x: (rx1 + rx2) / 2,
                y: ry + rh / 2,
                pillW,
                contribution: row.contribution,
                cTxt,
                showPrefix,
                ink,
              });
            }

            pointCoords.push({
              row,
              x: xScale(row.center),
              y: yScale(row.risk),
            });
          }

          // Direct weighted risk dashed reference line + right-margin pill
          const wLineY = yScale(risk);
          scene.add(
            el("line", {
              x1: x0,
              y1: wLineY,
              x2: x1 + 4,
              y2: wLineY,
              stroke: pal.plotFg,
              strokeWidth: 1.7,
              strokeDasharray: "5,3",
            }),
          );

          const wPlaced = placeDirectLabels([{ id: "weighted", y: wLineY, height: 18 }], {
            minGapPx: 18,
            minY: yTop + 9,
            maxY: yBottom - 9,
          });
          const wById = new Map(wPlaced.map((p) => [p.id, p]));
          const wy = wById.get("weighted")?.y ?? wLineY;
          const wTxt = formatReadoutRisk(risk);
          const wPillW = Math.min(margin.right - 8, Math.max(30, wTxt.length * 7.8 + 10));
          const wPillX = x1 + 6;
          scene.add(
            el("rect", {
              x: wPillX,
              y: wy - 8.5,
              width: wPillW,
              height: 17,
              rx: 3,
              fill: pal.plotBg,
              stroke: pal.plotFg,
              strokeWidth: 1.2,
              style: { pointerEvents: "none" },
            }),
            el("text", {
              x: wPillX + wPillW / 2,
              y: wy + 4.4,
              textAnchor: "middle",
              fill: pal.plotFg,
              fontWeight: 700,
              "data-num": dataNum(risk),
              "data-prx-readout": "plot-weighted-risk",
              style: { pointerEvents: "none" },
              text: wTxt,
            }),
          );

          // Resolve any horizontally overlapping risk pills via placeDirectLabels mapped by item.id
          const finalRiskY = new Map(riskPillCandidates.map((c) => [c.id, c.y]));
          for (let i = 0; i < riskPillCandidates.length; i += 1) {
            for (let j = i + 1; j < riskPillCandidates.length; j += 1) {
              const a = riskPillCandidates[i];
              const b = riskPillCandidates[j];
              if (Math.abs(a.x - b.x) < (a.pillW + b.pillW) / 2 + 6) {
                const relaxed = placeDirectLabels([a, b], {
                  minGapPx: 19,
                  minY: yTop + 10,
                  maxY: yBottom - 11,
                });
                for (const p of relaxed) finalRiskY.set(p.id, p.y);
              }
            }
          }

          for (const c of contribPills) {
            const pillH = 17;
            const textEl = c.showPrefix
              ? el(
                  "text",
                  {
                    x: c.x,
                    y: c.y + 4.4,
                    textAnchor: "middle",
                    fill: pal.plotFg,
                    fontWeight: 600,
                    style: { pointerEvents: "none" },
                  },
                  "w·R ",
                  el("tspan", { "data-num": dataNum(c.contribution), fontWeight: 700, text: c.cTxt }),
                )
              : el("text", {
                  x: c.x,
                  y: c.y + 4.4,
                  textAnchor: "middle",
                  fill: pal.plotFg,
                  fontWeight: 700,
                  "data-num": dataNum(c.contribution),
                  style: { pointerEvents: "none" },
                  text: c.cTxt,
                });
            scene.add(
              el("rect", {
                x: c.x - c.pillW / 2,
                y: c.y - pillH / 2,
                width: c.pillW,
                height: pillH,
                rx: 3,
                fill: pal.plotBg,
                fillOpacity: 0.94,
                stroke: c.ink,
                strokeWidth: 0.9,
                style: { pointerEvents: "none" },
              }),
              textEl,
            );
          }

          for (const rp of riskPillCandidates) {
            const py = finalRiskY.get(rp.id) ?? rp.y;
            const pillH = 17;
            scene.add(
              el("rect", {
                x: rp.x - rp.pillW / 2,
                y: py - pillH / 2,
                width: rp.pillW,
                height: pillH,
                rx: 3,
                fill: pal.plotBg,
                stroke: rp.isSel ? pal.plotFocus : rp.ink,
                strokeWidth: rp.isSel ? 1.4 : 1,
                style: { pointerEvents: "none" },
              }),
              el("text", {
                x: rp.x,
                y: py + 4.4,
                textAnchor: "middle",
                fill: pal.plotFg,
                fontWeight: 700,
                "data-num": dataNum(rp.risk),
                style: { pointerEvents: "none" },
                text: rp.rTxt,
              }),
            );
          }
        },
      );

      // Attach roving keyboard layer inside handle.area (matching baseline kbd & aria contracts)
      const doc = handle.doc;
      const size = { width: handle.width, height: handle.height };
      const layer = doc.createElement("div");
      layer.className = "prx-kbd-layer";
      layer.setAttribute("role", "group");
      layer.setAttribute("aria-label", "Inspect the criterion for the whole vector");
      const tip = doc.createElement("div");
      tip.className = "prx-kbd-tip";
      tip.setAttribute("aria-hidden", "true");
      tip.hidden = true;
      layer.addEventListener("focusout", (e) => {
        if (!layer.contains(e.relatedTarget)) tip.hidden = true;
      });

      const clampedPts = pointCoords.map((pt) => {
        const c = clampFocusPoint(pt.x, pt.y, size);
        const title = `${pt.row.criterion}: selection chance ${formatProb(pt.row.w)}, risk ${formatRisk(pt.row.risk)}, contribution ${formatRisk(pt.row.contribution)}.`;
        return { ...pt, ...c, key: String(pt.row.k), title };
      });
      let activeIdx = Math.max(
        0,
        clampedPts.findIndex((p) => p.key === String(criterion)),
      );
      if (clampedPts.some((p) => p.key === activeKey)) {
        activeIdx = clampedPts.findIndex((p) => p.key === activeKey);
      }

      const showTip = (idx) => {
        const p = clampedPts[idx];
        if (!p) return;
        tip.textContent = p.title;
        tip.hidden = false;
        const rightHalf = p.leftPct > 55;
        const bottomHalf = p.topPct > 55;
        tip.style.left = `${p.leftPct}%`;
        tip.style.top = `${p.topPct}%`;
        tip.style.transform = `translate(${rightHalf ? "-100%" : "0"}, ${bottomHalf ? "-100%" : "0"})`;
      };

      const buttons = clampedPts.map((p, idx) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "prx-kbd-point";
        b.setAttribute("aria-label", p.title);
        b.setAttribute("data-prx-focus-key", `kbd:mix-exp:${p.key}`);
        b.tabIndex = idx === activeIdx ? 0 : -1;
        b.style.left = `${p.leftPct}%`;
        b.style.top = `${p.topPct}%`;
        b.style.transform = "translate(-50%, -50%)";
        if (p.clamped) b.setAttribute("data-clamped", "true");
        layer.append(b);
        return b;
      });

      const moveFocus = (idx) => {
        activeIdx = Math.max(0, Math.min(clampedPts.length - 1, idx));
        activeKey = clampedPts[activeIdx].key;
        buttons.forEach((b, k) => {
          b.tabIndex = k === activeIdx ? 0 : -1;
        });
        buttons[activeIdx].focus({ preventScroll: true });
        showTip(activeIdx);
      };

      buttons.forEach((b, idx) => {
        b.addEventListener("focus", () => {
          activeIdx = idx;
          activeKey = clampedPts[idx].key;
          showTip(idx);
        });
        b.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            tip.hidden = true;
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(clampedPts[idx].row.k);
            return;
          }
          const map = {
            ArrowRight: activeIdx + 1,
            ArrowDown: activeIdx + 1,
            ArrowLeft: activeIdx - 1,
            ArrowUp: activeIdx - 1,
            Home: 0,
            End: clampedPts.length - 1,
          };
          if (!(e.key in map)) return;
          e.preventDefault();
          moveFocus(map[e.key]);
        });
      });

      handle.area.append(layer, tip);
    },
  };
}

function drawBranchStrip(ctx, slot, model, isCompact = false) {
  const { data, criterion: k } = model;
  const six = data.key === "six";
  const rows = data.ids.map((id, i) => ({
    id,
    value: six ? data.means[i][k] : data.law.states[0][i][k],
  }));
  const values = rows.map((row) => row.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.12, (hi - lo) * 0.18);
  const chart = plot(slot, {
    height: (isCompact ? 50 : 54) + rows.length * (isCompact ? 16 : 18),
    marginTop: isCompact ? 5 : 8,
    marginLeft: 36,
    marginRight: 16,
    marginBottom: 42,
    x: {
      domain: [lo - pad, hi + pad],
      inset: 6,
      label: six ? "Posterior mean" : "Known value",
      labelAnchor: "center",
      labelArrow: "none",
      labelOffset: 36,
      grid: true,
      ticks: 5,
    },
    y: { domain: data.ids, label: null },
    alt: six
      ? "Posterior means for every unit on the selected score. These are summaries of one vector law."
      : "The known values of both units on the same selected criterion.",
    table: {
      caption: "All unit values shown on the selected criterion",
      rows,
      columns: [
        { label: "Unit", value: "id" },
        { label: six ? "Posterior mean" : "Known value", value: "value", format: (v) => formatSetting(v) },
      ],
    },
    keyboard: {
      data: rows,
      x: "value",
      y: "id",
      key: "id",
      sort: false,
      title: (row) => `${row.id}: ${six ? "posterior mean" : "known value"} ${formatSetting(row.value)}.`,
    },
    marks: (c, P) => [
      P.dot(rows, { x: "value", y: "id", r: 5, fill: c.crit[k], stroke: c.plotFg, strokeWidth: 0.9 }),
    ],
  });
  for (const t of chart.svg.querySelectorAll("text")) {
    if (data.ids.includes((t.textContent || "").trim())) t.setAttribute("data-prx-name", "");
  }
}

function createLinkedTwoScoresSection(ctx, parent) {
  const { h } = ctx;
  const slopeSlot = h("div");
  const reportSlot = h("div", { class: "prx-light-panel" });
  const relationSlot = h("div");
  const pairsSlot = h("div");
  const profileSlot = h("div");
  const boundSlot = h("div");
  const sourceCaption = h("p", { class: "mix-source-caption" });

  parent.append(
    ctx.panelTitle("The full linked six-site report"),
    h(
      "p",
      { class: "mix-short" },
      "These linked views use the first retained best report for the matrices and slope chart, and list every retained optimum and its differing profiles. The mixture branch above uses the selected retained report.",
    ),
    h(
      "div",
      { class: "tws-detail-grid" },
      h("section", { class: "sev-paper prx-light-panel", "aria-label": "Six sites on two scores (posterior means)" }, ctx.panelTitle("Six sites on two scores (posterior means)"), slopeSlot),
      h("section", { class: "sev-paper prx-light-panel", "aria-label": "Best report for both scores" }, ctx.panelTitle("Best report for both scores"), reportSlot),
    ),
    h(
      "div",
      { class: "tws-detail-grid" },
      h("section", { class: "sev-paper prx-light-panel", "aria-label": "Relations in the first best report" }, ctx.panelTitle("Relations in the first best report"), relationSlot),
      h("section", { class: "sev-paper prx-light-panel", "aria-label": "Weighted pair errors against the withholding cost" }, ctx.panelTitle("Weighted pair errors against the withholding cost"), pairsSlot),
    ),
    h("section", { class: "sev-paper prx-light-panel mix-section", "aria-label": "Every best report: criterion profile", style: { marginTop: "0.65rem" } }, ctx.panelTitle("Every best report: criterion profile"), profileSlot),
    h("section", { class: "sev-paper prx-light-panel mix-section", "aria-label": "What the mean bound says", style: { marginTop: "0.65rem" } }, ctx.panelTitle("What the mean bound says"), boundSlot),
    sourceCaption,
  );

  const renderCharts = (model, state) => {
    const { data, result } = model;
    const grade = result.grade;
    const pal = palette(ctx.root);
    const colors = gradeColors(Math.max(...grade), pal);
    const measured = Math.round(slopeSlot.getBoundingClientRect?.().width || slopeSlot.clientWidth || 0);
    const width = Math.max(240, measured > 0 ? measured : 360);
    const height = width < 420 ? 304 : 336;
    const marginTop = 48;
    const marginBottom = 16;
    const marginSide = width < 420 ? 52 : 62;
    const yLo = -0.95;
    const yHi = 1.35;
    const innerH = height - marginTop - marginBottom;
    const toPx = (v) => marginTop + ((yHi - v) / (yHi - yLo)) * innerH;
    const fromPx = (py) => yHi - ((py - marginTop) / innerH) * (yHi - yLo);

    const rows = data.ids.map((id, i) => ({
      i,
      id,
      a: data.means[i][0],
      b: data.means[i][1],
      grade: grade[i],
      fill: colors[grade[i] - 1],
    }));
    const placedLeft = placeDirectLabels(
      rows.map((d) => ({ id: d.id, y: toPx(d.a) })),
      { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 },
    );
    const placedRight = placeDirectLabels(
      rows.map((d) => ({ id: d.id, y: toPx(d.b) })),
      { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 },
    );
    const leftById = new Map(placedLeft.map((p) => [p.id, p]));
    const rightById = new Map(placedRight.map((p) => [p.id, p]));
    const ends = rows.flatMap((d) => [
      { ...d, x: 0, y: d.a },
      { ...d, x: 1, y: d.b },
    ]);
    const leftTags = rows.map((d) => ({ ...d, x: 0, y: fromPx(leftById.get(d.id).y) }));
    const rightTags = rows.map((d) => ({ ...d, x: 1, y: fromPx(rightById.get(d.id).y) }));
    const heads = [
      { x: 0, title: "score A", weight: state.w },
      { x: 1, title: "score B", weight: 1 - state.w },
    ];

    plot(slopeSlot, {
      width,
      height,
      marginTop,
      marginBottom,
      marginLeft: marginSide,
      marginRight: marginSide,
      x: { domain: [0, 1], axis: null },
      y: { domain: [yLo, yHi], axis: null },
      alt: "Each site joins its posterior mean on score A to its mean on score B, colored by grade in the first best report.",
      table: {
        caption: "Posterior means and first best report",
        rows,
        columns: [
          { label: "Site", value: "id" },
          { label: "Score A mean", value: "a", format: (v) => formatDecimal(v) },
          { label: "Score B mean", value: "b", format: (v) => formatDecimal(v) },
          { label: "Grade", value: "grade", format: (v) => formatCount(v) },
        ],
      },
      marks: (c, P) => [
        P.ruleX([0, 1], { stroke: c.plotGrid, strokeWidth: 1.5 }),
        P.link(rows, { x1: () => 0, y1: "a", x2: () => 1, y2: "b", stroke: "fill", strokeWidth: 3, strokeOpacity: 0.9 }),
        P.dot(ends, { x: "x", y: "y", r: 6, fill: "fill", stroke: c.plotBg }),
        P.text(leftTags, { x: "x", y: "y", text: "id", dx: -12, textAnchor: "end", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
        P.text(rightTags, { x: "x", y: "y", text: "id", dx: 12, textAnchor: "start", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
        P.text(heads, { x: "x", y: () => yHi, text: "title", dy: -30, fontWeight: 700, fontSize: 14, fill: (d) => c.critInk[d.x] }),
        P.text(heads, { x: "x", y: () => yHi, text: () => "weight", dx: -3, dy: -12, textAnchor: "end", fontSize: 13, fill: c.plotMuted }),
        numText(heads, { x: "x", y: () => yHi, value: "weight", format: (v) => formatSetting(v), dx: 3, dy: -12, textAnchor: "start", fontSize: 13, fill: c.plotMuted }),
      ],
      keyboard: {
        data: rows,
        x: () => 0,
        y: "a",
        title: (d) =>
          `Site ${d.id}: posterior mean ${formatDecimal(d.a)} on score A and ${formatDecimal(d.b)} on score B; grade ${formatCount(d.grade)} of the best report.`,
      },
    });

    relationSlot.replaceChildren();
    const cells = [];
    for (let i = 0; i < data.n; i += 1) {
      for (let j = 0; j < data.n; j += 1) {
        cells.push({
          i,
          j,
          row: data.ids[i],
          column: data.ids[j],
          relation: model.matrix[i][j],
          text: i === j ? "—" : model.matrix[i][j] === 1 ? "above" : model.matrix[i][j] === -1 ? "below" : "withheld",
        });
      }
    }
    const cellFill = (d, c) =>
      d.i === d.j ? c.plotBg : d.relation === 1 ? c.relAbove : d.relation === -1 ? c.relBelow : c.relWithheld;
    plot(relationSlot, {
      alt: "Row site is above, below, or in the same grade as the column site. Diagonal is not a comparison.",
      height: 296,
      marginLeft: 38,
      marginRight: 14,
      marginTop: 14,
      marginBottom: 42,
      x: { domain: data.ids, label: "column site", labelOffset: 36 },
      y: { domain: data.ids, label: "row site" },
      color: { type: "identity" },
      table: {
        caption: "First best report pair relations",
        rows: cells,
        columns: [
          { label: "Row", value: "row" },
          { label: "Column", value: "column" },
          { label: "Relation", value: "text" },
        ],
      },
      marks: (c, P) => [
        P.cell(cells, { x: "column", y: "row", fill: (d) => cellFill(d, c), inset: 1 }),
        P.text(cells, {
          x: "column",
          y: "row",
          text: (d) => (d.i === d.j ? "—" : d.relation === 1 ? "↑" : d.relation === -1 ? "↓" : "·"),
          fill: (d) => (d.i === d.j ? c.plotFg : labelOn(cellFill(d, c), c)),
          fontWeight: 700,
        }),
      ],
      keyboard: {
        data: cells,
        columns: data.n,
        x: "column",
        y: "row",
        title: (d) => `${d.row} against ${d.column}: ${d.text}`,
      },
    });
    const legend = h("p", { class: "tws-legend prx-light-panel" });
    [
      ["relAbove", "Row above column"],
      ["relWithheld", "Withheld"],
      ["relBelow", "Row below column"],
    ].forEach(([key, text]) =>
      legend.append(h("span", {}, h("i", { class: "prx-swatch", style: { background: pal[key] } }), text)),
    );
    relationSlot.append(legend);

    pairsSlot.replaceChildren();
    const directions = model.pairs.flatMap((d) => [
      { ...d, direction: `${data.ids[d.i]} above ${data.ids[d.j]}`, error: d.forward, side: "forward" },
      { ...d, direction: `${data.ids[d.j]} above ${data.ids[d.i]}`, error: d.reverse, side: "reverse" },
    ]);
    plot(pairsSlot, {
      alt: "Both directional weighted errors for each pair. The dashed vertical line is the withholding cost. Rings mark cheaper isolated directions withheld in the first report.",
      height: 426,
      marginLeft: 52,
      marginRight: 18,
      marginTop: 14,
      marginBottom: 44,
      x: { domain: [0, 1], inset: 6, label: "weighted directional error →", labelOffset: 36 },
      y: { domain: model.pairs.map((d) => d.label), label: null },
      table: {
        caption: "Both weighted pair errors",
        rows: directions,
        columns: [
          { label: "Direction", value: "direction" },
          { label: "Weighted error", value: "error", format: (v) => formatProb(v) },
          { label: "Withheld although cheaper", value: (d) => (d.outlined && d.error < state.tau ? "yes" : "no") },
        ],
      },
      marks: (c, P) => [
        P.ruleX([state.tau], { stroke: c.wh, strokeDasharray: "5,3" }),
        P.link(model.pairs, { x1: "forward", x2: "reverse", y1: "label", y2: "label", stroke: c.plotGrid }),
        P.dot(directions, {
          x: "error",
          y: "label",
          fill: (d) => (d.side === "forward" ? c.purples[6] : c.plotBg),
          stroke: c.purples[6],
          strokeWidth: 1.6,
          r: 4,
        }),
        P.dot(
          directions.filter((d) => d.outlined && d.error < state.tau),
          { x: "error", y: "label", fill: "none", stroke: c.err, r: 7.5, strokeWidth: 2 },
        ),
        P.tip(directions, P.pointer({ x: "error", y: "label", title: (d) => `${d.direction}: ${formatProb(d.error)}` })),
      ],
      keyboard: {
        data: directions,
        x: "error",
        y: "label",
        title: (d) =>
          `${d.direction}: weighted error ${formatProb(d.error)}; cost of withholding ${formatSetting(state.tau)}; ${d.relation === 0 ? "withheld" : "stated"}${d.outlined && d.error < state.tau ? ", cheaper isolated direction outlined" : ""}`,
      },
    });
    pairsSlot.append(
      h(
        "p",
        { class: "mix-short" },
        "Dark purple: earlier letter above later letter. Pale purple: reverse direction. Rings mark withheld directions cheaper than τ; the isolated-pair rule need not form a coherent report.",
      ),
    );
  };

  return {
    renderCharts,
    render(model, state) {
      const { data, result, profiles } = model;
      const grade = result.grade;
      renderCharts(model, state);

      const numNode = (val, fmt = formatCount, hook) => {
        const node = ctx.num(val, fmt(val));
        if (hook) node.dataset.prxReadout = hook;
        return node;
      };

      const packageIndex = sixSitePackageRepresentativeIndex(
        state,
        profiles.map((p) => p.grade),
      );
      const reportNodes = [];
      profiles.forEach((p, i) => {
        const chips = h("div", { class: "tws-chips" });
        drawTwoScoreReport(ctx, chips, p.grade, data.ids);
        reportNodes.push(
          h(
            "div",
            { class: "tws-report" },
            h("p", { class: "mix-short" }, i ? "Another best report" : "Grade one is highest priority; a shared grade withholds its comparisons."),
            chips,
            h(
              "p",
              { class: "mix-short" },
              numNode(p.evaluation.N, formatCount, `N-${i}`),
              " of ",
              numNode(data.M),
              " pairs stated; risk ",
              numNode(p.evaluation.risk, formatRisk, `risk-${i}`),
            ),
            h("p", { class: "mix-short" }, "Grade vector ", numNode(p.grade, formatGrades, `grade-${i}`)),
            i === packageIndex
              ? h(
                  "p",
                  { class: "mix-short", "data-prx-package-representative": "" },
                  "The recorded postrank ",
                  ...SIX_SITE_PACKAGE_VERSION.flatMap((v, j) => [j ? "." : "", numNode(v)]),
                  " representative at this score-B-only setting is ",
                  numNode(p.grade, formatGrades, "package-grade"),
                  ". Its live expected wrong share on score A is ",
                  numNode(p.evaluation.EoverN[0], shareText, "package-share-A"),
                  ". All tied reports remain available.",
                )
              : null,
          ),
        );
      });
      const tie = h(
        "p",
        { class: "mix-short", "data-prx-ties": "" },
        result.tieCount > 1
          ? [
              numNode(result.tieCount),
              " reports share the smallest risk, tied with another report; equal-risk tolerance ",
              numNode(result.tieTol, formatSci),
              ". All retained reports appear below.",
            ]
          : ["One report has the smallest risk; equal-risk tolerance ", numNode(result.tieTol, formatSci), "."],
      );
      if (result.tieCount > profiles.length) {
        tie.append(" Retained ", numNode(profiles.length), " of ", numNode(result.tieCount), " reports.");
      }
      const shareLine = (p, i) => [
        numNode(p.evaluation.EoverN[0], shareText, `live-share-${i}-0`),
        " on score A and ",
        numNode(p.evaluation.EoverN[1], shareText, `live-share-${i}-1`),
        " on score B.",
      ];
      const sourceReadout = h(
        "p",
        { class: "mix-source-readout" },
        "Expected wrong shares among each report’s stated directions: ",
        ...profiles.map((p, i) =>
          h("span", {}, "Report ", numNode(p.grade, formatGrades, `live-grade-${i}`), ": ", ...shareLine(p, i)),
        ),
      );
      reportSlot.replaceChildren(h("p", { class: "mix-short" }, tagNode(ctx, result)), tie, ...reportNodes, sourceReadout);

      const profileRows = profiles.flatMap((p, i) =>
        data.criterionLabels.map((crit, k) => ({ i, grade: p.grade, criterion: crit, k, ...p.evaluation })),
      );
      const profileTable = h(
        "table",
        { class: "tws-table" },
        h("caption", {}, "E = expected wrong directions; N = stated pairs; M = all unordered pairs."),
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ...["Report", "Criterion", "E", "E/N", "E/M", "Criterion risk", "N", "M"].map((t) => h("th", { scope: "col", text: t })),
          ),
        ),
        h(
          "tbody",
          {},
          ...profileRows.map((p) =>
            h(
              "tr",
              {},
              h("td", {}, numNode(p.grade, formatGrades)),
              h("th", { scope: "row", text: p.criterion }),
              h("td", {}, numNode(p.E[p.k], formatExpectedCount, `E-${p.i}-${p.k}`)),
              h("td", {}, numNode(p.EoverN[p.k], shareText, `share-${p.i}-${p.k}`)),
              h("td", {}, numNode(p.EoverM[p.k], formatShare, `perpair-${p.i}-${p.k}`)),
              h("td", {}, numNode(p.Rk[p.k], formatRisk, `Rk-${p.i}-${p.k}`)),
              h("td", {}, numNode(p.N)),
              h("td", {}, numNode(p.M)),
            ),
          ),
        ),
      );
      profileSlot.replaceChildren(
        h("p", { class: "mix-short" }, "Swipe or use the keyboard to scroll the profile table."),
        ctx.scrollRegion(h("div", { class: "tws-scroll" }, profileTable), "Criterion profiles for every retained best report"),
      );

      const boundRows = profiles.map((p, i) =>
        h(
          "p",
          { class: "mix-short" },
          "Report ",
          numNode(p.grade, formatGrades),
          ": weighted expected wrong count ",
          numNode(p.evaluation.Ew, formatExpectedCount, `Ew-${i}`),
          model.conditionalBound ? " ≤ τ × N = " : " versus τ × N = ",
          numNode(state.tau, formatSetting),
          " × ",
          numNode(p.evaluation.N),
          " = ",
          numNode(model.bounds[i].budget.qN, formatExpectedCount, `tauN-${i}`),
          "; count slack ",
          numNode(model.bounds[i].budget.slack, formatExpectedCount, `bound-slack-${i}`),
          "; risk minus τ ",
          numNode(model.bounds[i].comparison.deltaRisk, formatRisk, `bound-residual-${i}`),
          ".",
        ),
      );
      const same = model.uncapped.grades.some((g) => g.every((v, idx) => v === grade[idx]));
      boundSlot.replaceChildren(
        h("p", { class: "mix-short" }, "The weighted expected wrong count is w × E on score A plus the remaining weight × E on score B."),
        ...boundRows,
        h(
          "p",
          { class: "mix-short" },
          "This mean bound applies to the exact best report at the displayed τ because its family contains all-withheld. It bounds an expected average over stated pairs, not each pair or the realized share.",
        ),
        h(
          "p",
          { class: "mix-short" },
          same
            ? "Removing the cap leaves this report among the best reports."
            : "Removing the cap selects a different report; the cap can matter at this setting.",
        ),
      );
      if (state.w === 0.5 && state.tau === 0.2 && same) {
        boundSlot.append(
          h(
            "p",
            { class: "mix-short" },
            "A–C and B–C stay in one grade, so transitivity also withholds A–B. A–D is withheld too, although its weighted error is below τ. The uncapped comparison shows that the cap does not explain this equal-weight report.",
          ),
        );
      }
      sourceCaption.replaceChildren(
        "Six fictional sites; independent Normal posteriors set by hand for teaching; postrank does not fit them. τ = ",
        numNode(state.tau, formatSetting),
        "; ",
        tagNode(ctx, result),
        ". Withholding is charged once per pair.",
      );
    },
  };
}

function createControls(ctx) {
  const w = ctx.slider({
    label: "First-criterion weight w",
    ...ctx.key("w"),
    onInput: (v) => ctx.set({ w: v }),
  });
  const tau = ctx.slider({
    label: "Withholding cost τ",
    ...ctx.key("tau"),
    name: "tau-slider",
    onInput: (v) => ctx.set({ tau: v === Number((1 / 3).toPrecision(15)) ? 1 / 3 : v }),
  });
  // Chrome range values serialize to 15 digits. The native text spinbutton preserves exact boundaries;
  // the range is a synchronized pointer control and maps its representation of one third back to that value.
  w.input.step = "any";
  tau.input.step = "any";
  const tauEditor = createTauDraft(ctx, tau);
  w.root.dataset.mixWeight = "";
  ctx.primaryControl(tau.root);
  ctx.controls.append(w.root, tau.root);

  const settings = ctx.settingsBox("Settings");
  const data = ctx.select({
    label: "Supplied law",
    name: "data",
    options: Object.entries(TITLES).map(([value, lbl]) => ({ value, label: lbl })),
    onChange: (v) => ctx.set({ data: v, criterion: 0, report: 1, pair: "auto" }),
  });
  const cap = ctx.select({
    label: "Allowed six-site reports",
    name: "cap",
    options: [
      { value: "2", label: "At most two grades" },
      { value: "3", label: "At most three grades" },
      { value: "all", label: "No grade cap" },
    ],
    onChange: (v) => ctx.set({ cap: v }),
  });
  const report = ctx.slider({
    label: "Inspect retained best report",
    ...ctx.key("report"),
    format: formatCount,
    onInput: (v) => ctx.set({ report: v }),
  });
  const branches = {};
  for (const K of [2, 3]) {
    branches[K] = ctx.segmented({
      label: "Auxiliary criterion for the whole vector",
      name: `criterion-${K}`,
      options: Array.from({ length: K }, (_, k) => ({
        value: k,
        label: ["First criterion", "Second criterion", "Third criterion"][k],
      })),
      onChange: (v) => ctx.set({ criterion: v }),
    });
  }
  const six = criteriaData("six");
  const pair = ctx.select({
    label: "Inspect this isolated six-site pair",
    name: "pair",
    options: [
      { value: "auto", label: "A above C" },
      ...six.ids.flatMap((id, i) =>
        six.ids.flatMap((other, j) => (i === j ? [] : [{ value: `${id},${other}`, label: `${id} above ${other}` }])),
      ),
    ],
    onChange: (v) => ctx.set({ pair: v }),
  });
  settings.body.append(
    ctx.h("div", { class: "mix-settings-fields" }, data.root, cap.root, report.root, branches[2].root, branches[3].root, pair.root),
  );

  return {
    tauEditor,
    render(state, model) {
      data.set(state.data);
      w.set(state.w);
      tau.set(state.tau);
      tauEditor.sync(state.tau);
      cap.set(state.cap);
      w.root.hidden = state.data === "majority";
      cap.root.hidden = state.data !== "six";
      pair.root.hidden = state.data !== "six";
      pair.set(state.pair);
      for (const K of [2, 3]) {
        branches[K].root.hidden = model.data.K !== K;
        branches[K].set(model.criterion);
      }
      report.input.max = String(model.profiles.length);
      report.set(model.chosen + 1);
      report.root.hidden = model.profiles.length === 1;
    },
  };
}

export function mountWidget(el, spec = {}) {
  let tauEditor;
  const handle = createWidget(el, spec, {
    name: "criterion-mixture",
    frame: "v2",
    firstPreset: "mixture",
    className: "mix",
    css: MIXTURE_CSS,
    keys: MIXTURE_KEYS,
    build(ctx) {
      const { h } = ctx;
      const r = ro(ctx);
      ctx.root.classList.add("cp", "sev");
      const control = createControls(ctx);
      tauEditor = control.tauEditor;

      // Primary stage: (1) Random-criterion expectation-area draw + (2) Fixed report & selected unit vector
      const expectationSlot = h("div", { class: "mix-figure" });
      const drawCol = h(
        "div",
        { class: "mix-stage-col" },
        h(
          "div",
          { class: "mix-col-head" },
          ctx.panelTitle("Random-criterion draw"),
          h("p", { class: "mix-stage-cue" }, "Width = w · height = R · area = w × R"),
        ),
        expectationSlot,
      );

      const stageBranchCue = h("p", { class: "mix-stage-cue" });
      const stageChips = h("div", { class: "tws-chips mix-stage-chips", "aria-hidden": "true" });
      const branchStripSlot = h("div", { class: "mix-figure" });
      const vectorCol = h(
        "div",
        { class: "mix-stage-col" },
        h(
          "div",
          { class: "mix-vector-bar" },
          h("div", { class: "mix-col-head", style: { margin: "0" } }, ctx.panelTitle("Fixed report & drawn vector"), stageBranchCue),
          stageChips,
        ),
        branchStripSlot,
      );

      const stageGrid = h("div", { class: "mix-stage-grid" }, drawCol, vectorCol);
      ctx.stage.append(stageGrid);

      // Data disclosure: branch summary hooks, exact mixture & retained-report tables, unit vector table, isolated-pair check, coherence, and linked six-site report
      const dataBox = ctx.dataBox("Data, isolated-pair check and branch tables");
      const branchSummarySlot = h("div", { class: "sev-paper prx-light-panel mix-section" });
      const riskSlot = h("div", { class: "sev-paper prx-light-panel mix-section" });
      const branchSlot = h("div", { class: "sev-paper prx-light-panel mix-section" });
      const pairWrap = h("div", { class: "sev-paper prx-light-panel mix-section" });
      const pairCostsLine = h("p", { class: "mix-contributions" });
      const pairSlot = h("div");
      pairWrap.append(pairCostsLine, pairSlot);
      const coherenceSlot = h("div", { class: "sev-paper prx-light-panel mix-section" });
      const sourceSlot = h("div", { class: "prx-light-panel mix-section" });
      dataBox.body.append(
        h("div", { class: "mix-data-stack" }, riskSlot, branchSlot, pairWrap, coherenceSlot, sourceSlot),
      );

      // Method disclosure: mixture identity, weak-error loss, KRW correspondence, and isolated-vs-coherent rules
      const methodBox = ctx.methodBox("Method and mixture identity");
      const conditionsSlot = h("div", { class: "sev-paper prx-light-panel mix-section" });
      methodBox.body.append(conditionsSlot);

      const expectationView = createExpectationView(ctx, expectationSlot);
      stageGrid.append(branchSummarySlot);
      const riskView = createMixtureRiskView(ctx, riskSlot);
      const branchView = createCriterionBranchView(ctx, branchSlot);
      const pairView = createPairCostView(ctx, pairSlot, { descriptionPosition: "after" });
      const linkedTwoScores = createLinkedTwoScoresSection(ctx, sourceSlot);

      conditionsSlot.replaceChildren(
        ctx.panelTitle("What the mixture means, and when KRW corresponds"),
        h(
          "p",
          { class: "mix-short" },
          "The mixture identity uses postrank’s weak-error loss: a strict direction is wrong at equality. It holds with latent equalities and arbitrary dependence. It averages losses of one fixed report, not target magnitudes.",
        ),
        h(
          "p",
          { class: "mix-short" },
          "The correspondence to KRW’s strict-count objective additionally needs the same law, targets, orientation, labeled units, pair normalization and nonempty family. The usual affine formula assumes zero latent equality probability on positive-weight criteria; otherwise an explicit equality correction is required.",
        ),
        h(
          "p",
          { class: "mix-short" },
          "For an isolated known conflict, positive cost from strict opposition needs positive weight on both sides. The smaller directional cost excludes withholding. Posterior directional minima can also reflect uncertainty. A full coherent report need not print every isolated action choice.",
        ),
      );

      return {
        render(state, info = {}) {
          const model = solveCriterionMixture(state);

          // PR-06 / PR-09: Toggling a disclosure redraws only width-dependent SVGs inside Data at their open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open) {
              riskView.render(model);
              pairView.render({
                data: model.data,
                pair: model.pair,
                weighted: model.costs.weighted,
                kind: state.data === "six" ? "posterior" : "known state",
              });
              if (state.data === "six" && model.source) {
                linkedTwoScores.renderCharts(model.source, { w: state.w, tau: state.tau, cap: state.cap });
              }
            }
            return;
          }

          const correction = {};
          if (state.report !== model.chosen + 1) correction.report = model.chosen + 1;
          if (state.criterion !== model.criterion) correction.criterion = model.criterion;
          if (!isCriterionPairKey(model.data, state.pair)) correction.pair = "auto";
          if (Object.keys(correction).length) ctx.set(correction);
          control.render(state, model);

          const { selected, criterion: k } = model;
          const mixture = selected.mixture;
          const isCompact = (ctx.width() || 640) < 560;

          // 1. Primary stage
          expectationView.render(model, isCompact);
          drawTwoScoreReport(ctx, stageChips, selected.grade, model.data.ids);
          stageChips.removeAttribute("role");
          stageChips.removeAttribute("aria-label");
          stageBranchCue.replaceChildren(
            h(
              "span",
              { style: { color: `var(--prx-crit-ink-${k + 1})`, fontWeight: "700" }, "data-prx-name": "" },
              label(model.data, k),
            ),
            ...(mixture.w[k] === 0 ? [" (w = ", r.prob(0), ")"] : []),
          );
          drawBranchStrip(ctx, branchStripSlot, model, isCompact);

          // 2. Concise 1-sentence 3-sig-fig live readout (19-22 words across all states)
          r.set([
            "Fixed report ",
            r.num(selected.grade, formatGrades(selected.grade), { hook: "readout-grade" }),
            model.optimum.tieCount > 1
              ? [" (", r.count(model.optimum.tieCount), " reports tie)"]
              : [" (", r.count(selected.evaluation.N), " stated)"],
            " averages ",
            r.risk(mixture.risk, { hook: "readout-mixture" }),
            " over criterion draws, equaling direct weighted risk ",
            r.risk(mixture.weightedRisk, { hook: "readout-weighted" }),
            mixture.w[k] === 0
              ? ["; ", name(ctx, label(model.data, k)), " has ", r.prob(0), " draw chance."]
              : ["; ", name(ctx, label(model.data, k)), " adds ", r.risk(selected.contributions[k]), "."],
          ]);

          // 3. Data disclosure contents (eagerly rendered for check_readouts, check_displayed_numbers, draft test, and preserve)
          branchSummarySlot.replaceChildren(
            h(
              "p",
              { class: "mix-short" },
              "Selected branch: ",
              name(ctx, label(model.data, k)),
              " · selection chance ",
              n(ctx, mixture.w[k], "prob", "selected-branch-chance"),
              " · exact branch risk ",
              n(ctx, mixture.Rk[k], "risk", "selected-branch-risk"),
              " · contribution to weighted risk ", n(ctx, selected.contributions[k], "risk"), ".",
            ),
          );
          riskView.render(model);
          branchView.render(model);

          const { i, j } = model.pair;
          const aId = model.data.ids[i];
          const bId = model.data.ids[j];
          const pCosts = model.costs.weighted.decision.costs;
          pairCostsLine.replaceChildren(
            h("span", {}, "Standalone pair costs: "),
            h("span", {}, name(ctx, `${aId} above ${bId}`), " ", n(ctx, pCosts.iAboveJ, "readoutRisk")),
            h("span", {}, name(ctx, `${bId} above ${aId}`), " ", n(ctx, pCosts.jAboveI, "readoutRisk")),
            h("span", {}, "Withhold ", n(ctx, pCosts.withhold, "readoutRisk")),
          );
          pairView.render({
            data: model.data,
            pair: model.pair,
            weighted: model.costs.weighted,
            kind: state.data === "six" ? "posterior" : "known state",
          });
          coherenceView(ctx, coherenceSlot, model);

          sourceSlot.hidden = state.data !== "six";
          if (!sourceSlot.hidden && model.source) {
            linkedTwoScores.render(model.source, { w: state.w, tau: state.tau, cap: state.cap });
          }

          // 4. Concise caption retaining CC BY 4.0 notice and family tagNode (e.g. 4,683 on coherence)
          ctx.caption.replaceChildren(
            "Synthetic laws (CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            "); ",
            tagNode(ctx, model.optimum),
            ". Each draw picks one whole criterion vector.",
          );
        },
      };
    },
  });

  // A same-value API/preset/range command is still authoritative over an uncommitted draft.
  const update = handle.update;
  handle.update = (partial) => {
    const result = update(partial);
    if (partial && typeof partial === "object" && (Object.hasOwn(partial, "tau") || Object.hasOwn(partial, "preset"))) {
      tauEditor.reset(handle.state.tau);
    }
    return result;
  };
  return handle;
}
