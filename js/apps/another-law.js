// One declared report family, two normal laws, and a frozen selected report evaluated under both —
// Frame v2 upgrade. Primary shift & scale sliders sit in toolbar with unit, τ,
// and family cap in Settings; concise 3-sig-fig readout states fixed-report risk change, evaluation
// optimum, regret, and bound informativeness; both stage SVGs render at >= 13px 1:1 width with
// collision-free placeDirectLabels; reports and bounds disclosures preserve all exact tables/rows.
import { createWidget } from "../shared/base.js";
import { placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatDecimal,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  formatSigned,
} from "../shared/format.js";
import { tagNode } from "../shared/labels.js";
import {
  errorArray,
  evaluateReport,
  exactOptimum,
  maxCoefficientError,
  normalInterval,
  pairCount,
  regretBound,
  relationChange,
  weightedRadius,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "another-law",
  className: "prx-al",
  tau: { min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
  shift: { min: -1, max: 1, step: 0.01, value: 0 },
  scale: { min: 0.5, max: 2, step: 0.05, value: 1 },
});
const IDS = SIX.tables.units.id;
const MEAN = SIX.tables.units.mean_A;
const SD = SIX.tables.units.sd_A;
const M = pairCount(IDS.length);
const selectionLaw = errorArray(MEAN, SD, { ids: IDS, criteria: ["reading"] });
const family = (cap) => (cap === "none" ? { kind: "all" } : { kind: "atMost", G: 3 });
const cache = new Map();

export function compareLaws({ tau = 0.2, shift = 0, scale = 1, unit = "C", cap = 3 } = {}) {
  const key = JSON.stringify([tau, shift, scale, unit, cap]);
  if (cache.has(key)) return cache.get(key);
  const means = MEAN.map((v, i) => v + (IDS[i] === unit ? shift : 0));
  const sds = SD.map((v) => v * scale);
  const evaluationLaw = errorArray(means, sds, { ids: IDS, criteria: ["reading"] });
  // Zero tolerance makes eta=0 for the minimum over the supplied floating-point risks.
  const selected = exactOptimum(selectionLaw, { tau, family: family(cap), tieTol: 0 });
  const evaluationBest = exactOptimum(evaluationLaw, { tau, family: family(cap), tieTol: 0 });
  const chosenSelection = evaluateReport(selected.grade, selectionLaw, { tau });
  const chosenEvaluation = evaluateReport(selected.grade, evaluationLaw, { tau });
  const bestSelection = evaluateReport(evaluationBest.grade, selectionLaw, { tau });
  const bestEvaluation = evaluateReport(evaluationBest.grade, evaluationLaw, { tau });
  const coefficient = maxCoefficientError(selectionLaw, evaluationLaw);
  const radius = weightedRadius(coefficient.epsilon, [1]);
  const bound = regretBound({ N: selected.N, Nstar: evaluationBest.N, M, deltaW: radius, eta: 0 });
  const changes = relationChange(selected.grade, evaluationBest.grade, evaluationLaw);
  const r = {
    means,
    sds,
    selectionLaw,
    evaluationLaw,
    selected,
    evaluationBest,
    chosenSelection,
    chosenEvaluation,
    bestSelection,
    bestEvaluation,
    coefficient,
    radius,
    bound,
    changes,
    regret: Math.max(0, chosenEvaluation.risk - bestEvaluation.risk),
    riskDifference: Math.abs(chosenEvaluation.risk - chosenSelection.risk),
  };
  cache.set(key, r);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return r;
}

const CSS = `
.prx-al .prx-stage { display: flex; flex-direction: column; gap: 0.35rem; }
.prx-al .prx-stage .prx-panel-title {
  margin: 0.2rem 0 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--prx-plot-grid);
  color: var(--prx-plot-fg);
}
.prx-al .prx-stage .prx-al-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1rem;
  padding: 0.2rem 0.35rem 0.3rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  font-size: 0.84375rem;
  line-height: 1.35;
  border-bottom: 1px solid var(--prx-plot-grid);
}
.prx-al .prx-stage .prx-al-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.prx-al .prx-stage .prx-al-key-svg { flex: none; display: inline-block; overflow: visible; }
@media (max-width: 30em) {
  .prx-al[data-prx-frame="v2"] .prx-presets .prx-seg { padding-inline: 0.5rem; }
}
.prx-al .prx-al-note { font-size: 0.9em; color: var(--prx-fg-muted); margin: 0.4rem 0; }
.prx-al .prx-al-scroll { max-width: 100%; overflow-x: auto; margin: 0.65rem 0; }
.prx-al .prx-al-table { width: 100%; min-width: 38rem; border-collapse: collapse; font-size: 0.9em; font-variant-numeric: tabular-nums; }
.prx-al .prx-al-table th, .prx-al .prx-al-table td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--prx-border); }
.prx-al .prx-al-table th:first-child { min-width: 8.5rem; white-space: nowrap; }
.prx-al .prx-al-table caption { text-align: left; color: var(--prx-fg-muted); padding: 0.25rem 0; }
.prx-al .prx-al-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 0.7rem; margin: 0.4rem 0 0.65rem; }
.prx-al .prx-al-card { padding: 0.65rem; border: 1px solid var(--prx-border); border-radius: 6px; background: var(--prx-bg); }
.prx-al .prx-al-card p { margin: 0.25rem 0; }
.prx-al .prx-al-bound-row { padding: 0.45rem 0; border-top: 1px solid var(--prx-border); }
.prx-al .prx-al-bound-row p { margin: 0.25rem 0; }
.prx-al .prx-al-bound { margin: 0.4rem 0 0.65rem; padding: 0.65rem; border-left: 3px solid var(--prx-accent); background: var(--prx-bg); }
.prx-al .prx-al-rowname { display: inline-block; margin: 0 0 0.15rem; font-size: 0.82em; font-weight: 600; color: var(--prx-fg-muted); }
`;

const measureSlotWidth = (el, fallbackEl, fallback) => {
  const w = Math.round(
    el?.clientWidth ||
      el?.getBoundingClientRect?.().width ||
      fallbackEl?.clientWidth ||
      fallbackEl?.getBoundingClientRect?.().width ||
      0,
  );
  return Math.max(240, w || fallback);
};

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: CONFIG.className,
    frame: "v2",
    label: "Judging a report under another law: the same report under selection and evaluation laws, regret within one family, and discrepancy bounds.",
    css: CSS,
    keys: {
      tau: { type: "number", ...CONFIG.tau },
      shift: { type: "number", ...CONFIG.shift },
      scale: { type: "number", ...CONFIG.scale },
      unit: { type: "choice", values: IDS, value: "C" },
      cap: { type: "choice", values: [3, "none"], value: 3 },
    },
    build(ctx) {
      const { h, doc } = ctx;
      const ro = (name, value, format = formatCount) => {
        const e = ctx.num(value, format(value));
        e.dataset.prxReadout = name;
        return e;
      };

      // Primary controls in toolbar: evaluation mean shift and SD multiplier
      const shift = ctx.slider({
        label: "Selected unit’s evaluation mean shift",
        ...ctx.key("shift"),
        format: (v) => formatSigned(v, { digits: 2 }),
        onInput: (v) => ctx.set({ shift: v }),
      });
      const scale = ctx.slider({
        label: "Multiplier for every evaluation SD",
        ...ctx.key("scale"),
        onInput: (v) => ctx.set({ scale: v }),
      });
      ctx.controls.append(shift.root, scale.root);
      ctx.primaryControl(shift.root);

      // Secondary controls in Settings disclosure (>= 44px mobile touch targets via frame v2)
      const unit = ctx.select({
        label: "Unit whose evaluation mean changes",
        name: "unit",
        options: IDS.map((id) => ({ value: id, label: `Site ${id}` })),
        value: ctx.state.unit,
        onChange: (v) => ctx.set({ unit: v }),
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      const cap = ctx.segmented({
        label: "Same family for both laws",
        name: "cap",
        options: [
          { value: 3, label: "At most three grades" },
          { value: "none", label: "All reports" },
        ],
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const settings = ctx.settingsBox("Settings");
      settings.body.append(unit.root, tau.root, cap.root);

      // Stage: compact 1-line inline key + unit interval comparison + paired risk/regret bar chart
      const lawKeyIcon = (evalLaw) =>
        svgEl(
          doc,
          "svg",
          { class: "prx-al-key-svg", width: 28, height: 14, viewBox: "0 0 28 14", "aria-hidden": "true" },
          svgEl(doc, "line", {
            x1: 1,
            y1: 7,
            x2: 27,
            y2: 7,
            stroke: evalLaw ? "var(--prx-plot-muted)" : "var(--prx-plot-fg)",
            strokeWidth: 2,
            strokeDasharray: evalLaw ? "5 3" : null,
          }),
          svgEl(doc, "circle", {
            cx: 14,
            cy: 7,
            r: 3.6,
            fill: evalLaw ? "var(--prx-plot-bg)" : "var(--prx-plot-fg)",
            stroke: evalLaw ? "var(--prx-plot-muted)" : "var(--prx-plot-fg)",
            strokeWidth: 1.6,
          }),
        );
      const legend = h(
        "div",
        { class: "prx-al-legend", "data-prx-part": "legend" },
        h("span", {}, lawKeyIcon(false), "selection law: filled mean, solid interval"),
        h("span", {}, lawKeyIcon(true), "evaluation law: open mean, dashed interval"),
      );
      const laws = h("div", { class: "prx-al-laws" });
      const risks = h("div", { class: "prx-al-risks" });
      ctx.primaryGraphic(risks);
      ctx.stage.append(legend, laws, ctx.panelTitle("Hold the report fixed when changing the law"), risks);

      // Native disclosures preserved for grade-report-details.test.mjs & try[].open contracts
      const cards = h("div", { class: "prx-al-cards" });
      const tableSlot = ctx.scrollRegion(h("div", { class: "prx-al-scroll" }), "Both reports evaluated under both laws");
      const tieNote = h("p", { class: "prx-al-note", hidden: true });
      const reportDetails = ctx.disclosure({ name: "reports", title: "Reports and exact risks" });
      reportDetails.body.append(
        cards,
        h("p", { class: "prx-al-note" }, "Read across a row to change only the law. Compare the evaluation-risk column to find regret."),
        tableSlot,
        tieNote,
      );

      const boundBox = h("section", { class: "prx-al-bound" });
      const gapPair = h("p", { class: "prx-al-note" });
      const lawNote = h("p", { class: "prx-al-note" });
      const boundDetails = ctx.disclosure({ name: "bounds", title: "How the bounds are calculated" });
      boundDetails.body.append(boundBox, gapPair, lawNote);

      return {
        render(state, info) {
          // PR-06 / PR-09: opening disclosures never re-renders stage or re-fires readout.set
          if (info?.reason === "disclosure") return;

          tau.set(state.tau);
          shift.set(state.shift);
          scale.set(state.scale);
          unit.set(state.unit);
          cap.set(state.cap);

          const r = compareLaws(state);
          const rows = IDS.flatMap((id, i) => [
            { id, law: "selection", mean: MEAN[i], ...normalInterval(MEAN[i], SD[i], 0.95) },
            { id, law: "evaluation", mean: r.means[i], ...normalInterval(r.means[i], r.sds[i], 0.95) },
          ]);

          // 1. Unit interval comparison chart (1:1 container width -> >= 13px text)
          const wLaws = measureSlotWidth(laws, ctx.stage, ctx.width() - 32);
          const dyLaw = wLaws < 420 ? 3 : 3.5;
          plot(laws, {
            width: wLaws,
            height: wLaws < 420 ? 152 : 170,
            marginLeft: 34,
            marginRight: 20,
            marginTop: 8,
            marginBottom: 36,
            x: {
              label: "Reading target (higher = higher priority)",
              labelAnchor: "center",
              labelArrow: "none",
              ticks: wLaws < 420 ? 4 : 6,
            },
            y: { domain: IDS, label: null, tickSize: 0 },
            alt: "The selection and evaluation normal laws for each site, with their means and marginal 95 percent intervals. Only the chosen site mean shifts; the evaluation standard deviation multiplier applies to every site.",
            table: {
              caption: "Normal means and marginal intervals under the two declared laws",
              columns: [
                { label: "Site", value: "id", num: false },
                { label: "Law", value: "law", num: false },
                { label: "Mean", value: "mean", format: (v) => formatDecimal(v, { digits: 2 }) },
                { label: "Lower", value: "lower", format: (v) => formatDecimal(v, { digits: 3 }) },
                { label: "Upper", value: "upper", format: (v) => formatDecimal(v, { digits: 3 }) },
              ],
              rows,
            },
            marks: (c, P) => [
              P.ruleY(rows.filter((d) => d.law === "selection"), {
                y: "id",
                x1: "lower",
                x2: "upper",
                stroke: c.plotFg,
                dy: -dyLaw,
                strokeWidth: 2,
              }),
              P.ruleY(rows.filter((d) => d.law === "evaluation"), {
                y: "id",
                x1: "lower",
                x2: "upper",
                stroke: c.plotMuted,
                dy: dyLaw,
                strokeDasharray: "5,3",
                strokeWidth: 2,
              }),
              P.dot(rows.filter((d) => d.law === "selection"), {
                x: "mean",
                y: "id",
                dy: -dyLaw,
                fill: c.plotFg,
                r: 3.6,
              }),
              P.dot(rows.filter((d) => d.law === "evaluation"), {
                x: "mean",
                y: "id",
                dy: dyLaw,
                fill: c.plotBg,
                stroke: c.plotMuted,
                strokeWidth: 1.6,
                r: 3.6,
              }),
            ],
            keyboard: {
              data: rows,
              x: "mean",
              y: "id",
              key: (d) => `${d.law}-${d.id}`,
              sort: false,
              title: (d) =>
                `${d.id}, ${d.law} law: mean ${formatDecimal(d.mean, { digits: 2 })}, 95 percent interval ${formatDecimal(d.lower, { digits: 3 })} to ${formatDecimal(d.upper, { digits: 3 })}.`,
            },
          });

          // 2. Concise 3-sig-fig readout (17–23 words, preserving all hooks and /both bounds.*at least 1/ contract)
          const sharp = r.bound.regret;
          const uniform = r.bound.uniform;
          const bounds =
            r.radius === 0
              ? ["With δ = ", ro("ro-delta", r.radius, formatReadoutProb), ", both bounds equal ", ro("uniform-bound", uniform, formatReadoutRisk), "."]
              : sharp >= 1
                ? [
                    "At δ = ",
                    ro("ro-delta", r.radius, formatReadoutProb),
                    ", both bounds (",
                    ro("ro-sharp-bound", sharp, formatReadoutRisk),
                    " and ",
                    ro("uniform-bound", uniform, formatReadoutRisk),
                    ") are at least ",
                    ctx.num(1, formatCount(1)),
                    " (uninformative).",
                  ]
                : uniform >= 1
                  ? [
                      "Sharper bound ",
                      ro("ro-sharp-bound", sharp, formatReadoutRisk),
                      "; uniform bound ",
                      ro("uniform-bound", uniform, formatReadoutRisk),
                      " is at least ",
                      ctx.num(1, formatCount(1)),
                      ".",
                    ]
                  : [
                      "Bounds: sharper ",
                      ro("ro-sharp-bound", sharp, formatReadoutRisk),
                      ", uniform ",
                      ctx.num(2, formatCount(2)),
                      "δ + η = ",
                      ro("uniform-bound", uniform, formatReadoutRisk),
                      ".",
                    ];

          ctx.readout.set([
            "Fixed report risk: ",
            ro("selection-risk", r.chosenSelection.risk, formatReadoutRisk),
            " → ",
            ro("evaluation-risk", r.chosenEvaluation.risk, formatReadoutRisk),
            "; evaluation best ",
            ro("ro-best-evaluation", r.bestEvaluation.risk, formatReadoutRisk),
            ", regret ",
            ro("regret", r.regret, formatReadoutRisk),
            ". ",
            ...bounds,
          ]);

          // 3. Paired risk & regret bar chart (1:1 container width -> >= 13px text, placeDirectLabels mapped by item.id)
          const riskRows = [
            { report: "Selected report", law: "selection", risk: r.chosenSelection.risk, row: "sel:selection" },
            { report: "Selected report", law: "evaluation", risk: r.chosenEvaluation.risk, row: "sel:evaluation" },
            { report: "Evaluation best", law: "selection", risk: r.bestSelection.risk, row: "best:selection" },
            { report: "Evaluation best", law: "evaluation", risk: r.bestEvaluation.risk, row: "best:evaluation" },
          ];
          const wRisks = measureSlotWidth(risks, ctx.stage, wLaws);
          const wideRisks = wRisks >= 480;
          const LINES = [
            ["sel:title", ""],
            ["sel:selection", "selection law"],
            ["sel:change", "law shift"],
            ["sel:evaluation", "evaluation law"],
            ["best:title", ""],
            ["best:selection", "selection law"],
            ["best:evaluation", "evaluation law"],
            ["best:regret", "regret"],
          ];
          const lineLabel = Object.fromEntries(LINES);
          const titles = [
            { row: "sel:title", name: "Selected report", short: "Selected", grade: r.selected.grade },
            { row: "best:title", name: "Evaluation best", short: "Eval. best", grade: r.evaluationBest.grade },
          ].map((d) => ({ ...d, blocks: blocksText(d.grade, IDS) }));
          const change = {
            row: "sel:change",
            from: r.chosenSelection.risk,
            to: r.chosenEvaluation.risk,
            delta: r.chosenEvaluation.risk - r.chosenSelection.risk,
          };
          const gap = {
            row: "best:regret",
            lo: Math.min(r.bestEvaluation.risk, r.chosenEvaluation.risk),
            hi: Math.max(r.bestEvaluation.risk, r.chosenEvaluation.risk),
            regret: r.regret,
          };
          const signedRisk = (v) => (v === 0 ? "0" : formatReadoutRisk(v, { signed: true }));
          const marginLeft = 112;
          const marginRight = 66;
          const marginTop = 6;
          const marginBottom = 36;
          const bandPitch = wRisks < 420 ? 21 : 23;
          const heightRisks = LINES.length * bandPitch + marginTop + marginBottom;
          const xMax = Math.max(0.05, Math.max(...riskRows.map((d) => d.risk)) * 1.08);

          const figRisks = plot(risks, {
            width: wRisks,
            height: heightRisks,
            marginLeft,
            marginRight,
            marginTop,
            marginBottom,
            x: {
              domain: [0, xMax],
              label: "Risk (same cost and family)",
              labelAnchor: "center",
              labelArrow: "none",
              ticks: wRisks < 420 ? 3 : 5,
            },
            y: {
              domain: LINES.map(([k]) => k),
              label: null,
              tickSize: 0,
              tickFormat: (k) => lineLabel[k],
            },
            alt: "Each report is evaluated under both laws. Evaluation regret is the difference between the selected report’s evaluation risk and the evaluation-law minimum.",
            table: {
              caption: "Risk of each report under each law",
              columns: [
                { label: "Report", value: "report", num: false },
                { label: "Law", value: "law", num: false },
                { label: "Risk", value: "risk", format: (v) => formatRisk(v) },
              ],
              rows: riskRows,
            },
            marks: (c, P) => [
              P.barX(riskRows.filter((d) => d.law === "selection"), {
                x: "risk",
                y: "row",
                fill: c.plotFg,
                insetTop: 3,
                insetBottom: 3,
              }),
              P.barX(riskRows.filter((d) => d.law === "evaluation"), {
                x: "risk",
                y: "row",
                fill: c.plotMuted,
                insetTop: 3,
                insetBottom: 3,
              }),
              Math.abs(change.delta) > 1e-12
                ? P.arrow([change], {
                    x1: "from",
                    x2: "to",
                    y1: "row",
                    y2: "row",
                    stroke: c.plotFg,
                    strokeWidth: 1.6,
                    headLength: 7,
                  })
                : P.dot([change], { x: "to", y: "row", fill: c.plotFg, r: 3 }),
              P.ruleY([gap], { y: "row", x1: "lo", x2: "hi", stroke: c.plotFg, strokeWidth: 1.6 }),
              P.tickX([gap.lo, gap.hi], {
                x: (d) => d,
                y: () => gap.row,
                stroke: c.plotFg,
                strokeWidth: 1.6,
                insetTop: 5,
                insetBottom: 5,
              }),
            ],
            keyboard: {
              data: riskRows,
              x: "risk",
              y: "row",
              key: (d) => `${d.report}-${d.law}`,
              sort: false,
              title: (d) => `${d.report}, ${d.law} law: risk ${formatRisk(d.risk)}.`,
            },
          });

          // Direct group headers and collision-free value labels (mapped by item.id, WA-02; clamped within stage, WA-13)
          const sx = figRisks.scale("x");
          const sy = figRisks.scale("y");
          const pal = figRisks.palette;
          const bandCenter = (rowKey) => {
            const p = sy.apply(rowKey);
            return sy.bandwidth ? p + sy.bandwidth / 2 : p;
          };

          const labelLayer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
          for (const t of titles) {
            const ty = bandCenter(t.row);
            if (wideRisks) {
              labelLayer.append(
                svgEl(doc, "text", {
                  x: marginLeft - 9,
                  y: ty,
                  textAnchor: "end",
                  dominantBaseline: "central",
                  fill: pal.plotFg,
                  fontWeight: 700,
                  text: t.name,
                }),
                svgEl(doc, "text", {
                  x: marginLeft,
                  y: ty,
                  textAnchor: "start",
                  dominantBaseline: "central",
                  fill: pal.plotFg,
                  fontWeight: 600,
                  text: t.blocks,
                }),
              );
            } else {
              labelLayer.append(
                svgEl(doc, "text", {
                  x: 8,
                  y: ty,
                  textAnchor: "start",
                  dominantBaseline: "central",
                  fill: pal.plotFg,
                  fontWeight: 700,
                  text: `${t.short}: ${t.blocks}`,
                }),
              );
            }
          }

          const rawValueItems = [
            ...riskRows.map((d) => ({
              id: d.row,
              rawX: d.risk,
              y: bandCenter(d.row),
              raw: d.risk,
              display: formatReadoutRisk(d.risk),
            })),
            {
              id: change.row,
              rawX: Math.max(change.from, change.to),
              y: bandCenter(change.row),
              raw: change.delta,
              display: signedRisk(change.delta),
            },
            {
              id: gap.row,
              rawX: gap.hi,
              y: bandCenter(gap.row),
              raw: gap.regret,
              display: formatReadoutRisk(gap.regret),
            },
          ];
          const placed = placeDirectLabels(rawValueItems, {
            minGapPx: 18,
            bounds: [marginTop + 8, heightRisks - marginBottom - 8],
          });
          const byId = new Map();
          for (const item of placed) byId.set(item.id, item);

          for (const src of rawValueItems) {
            const item = byId.get(src.id);
            if (!item) continue;
            const estW = Math.ceil(src.display.length * 7.6) + 2;
            const dx = src.id === change.row && Math.abs(change.delta) <= 1e-12 ? 10 : 6;
            const x = Math.min(wRisks - estW - 6, Math.max(marginLeft + 4, sx.apply(src.rawX) + dx));
            labelLayer.append(
              svgEl(doc, "text", {
                x,
                y: item.y,
                textAnchor: "start",
                dominantBaseline: "central",
                fill: pal.plotFg,
                fontWeight: src.id === "best:regret" ? 700 : 500,
                num: src.raw,
                text: src.display,
              }),
            );
          }
          figRisks.svg.append(labelLayer);

          // 4. Concise 1-line scope summary under stage
          ctx.setScope([
            "Comparing the two chosen reports changes ",
            ro("changed-pairs", M - r.changes.nSame, formatCount),
            " of ",
            ctx.num(M, formatCount(M)),
            " pair decisions (newly stated, newly withheld, or reversed).",
          ]);

          // 5. Reports and exact risks disclosure (2 cards + 1 table with 2 tbody tr rows)
          const card = (row, title, opt, grade, key) =>
            h(
              "section",
              { class: "prx-al-card" },
              h("span", { class: "prx-al-rowname" }, row),
              ctx.panelTitle(title),
              h("p", { "data-prx-readout": key }, blocksText(grade, IDS)),
              tagNode(ctx, opt),
              h("p", { class: "prx-al-note" }, ro(`${key}-N`, opt.N), " of ", ctx.num(M, formatCount(M)), " pair directions stated."),
            );
          cards.replaceChildren(
            card("Selected report", "Chosen under the selection law", r.selected, r.selected.grade, "selection-report"),
            card("Evaluation best", "Best under the evaluation law", r.evaluationBest, r.evaluationBest.grade, "evaluation-report"),
          );

          const table = h(
            "table",
            { class: "prx-al-table prx-sticky-first" },
            h("caption", {}, "Evaluation of each fixed report; the law changes across columns"),
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ...[
                  "Fixed report",
                  "Selection-law risk",
                  "Evaluation-law risk",
                  "Expected wrong share among stated pairs (evaluation law)",
                ].map((t) => h("th", { scope: "col" }, t)),
              ),
            ),
            h(
              "tbody",
              {},
              h(
                "tr",
                {},
                h("th", { scope: "row" }, "Selected report"),
                h("td", {}, ro("table-selected-selection", r.chosenSelection.risk, formatRisk)),
                h("td", {}, ro("table-selected-evaluation", r.chosenEvaluation.risk, formatRisk)),
                h("td", {}, ro("selected-share", r.chosenEvaluation.EoverN[0], formatShare)),
              ),
              h(
                "tr",
                {},
                h("th", { scope: "row" }, "Evaluation best"),
                h("td", {}, ro("table-best-selection", r.bestSelection.risk, formatRisk)),
                h("td", {}, ro("table-best-evaluation", r.bestEvaluation.risk, formatRisk)),
                h("td", {}, ro("best-share", r.bestEvaluation.EoverN[0], formatShare)),
              ),
            ),
          );
          tableSlot.replaceChildren(table);

          const tieParts = [];
          for (const [name, opt] of [
            ["selection", r.selected],
            ["evaluation", r.evaluationBest],
          ]) {
            if (opt.tieCount > 1) {
              tieParts.push(
                tieParts.length ? " " : "",
                "Under the ",
                name,
                " law, ",
                ctx.num(opt.tieCount, formatCount(opt.tieCount)),
                " reports share exactly equal computed risk; the first is shown. Equal-risk tolerance ",
                ctx.num(opt.tieTol, formatSci(opt.tieTol)),
                ".",
              );
            }
          }
          tieNote.replaceChildren(...tieParts);
          tieNote.hidden = tieParts.length === 0;

          // 6. Bounds disclosure (exact 3 .prx-al-bound-row elements + radius pair + law specification note)
          const boundRow = (title, formula, observed, upper) =>
            h(
              "div",
              { class: "prx-al-bound-row" },
              h("strong", {}, title),
              h("p", { class: "prx-al-note" }, ...formula),
              h("p", {}, "Observed ", observed, " ≤ upper bound ", upper, "."),
            );
          boundBox.replaceChildren(
            ctx.panelTitle("What each bound compares"),
            h("p", {}, "Largest pair-error gap δ = ", ro("delta", r.radius, (v) => formatProb(v, { digits: 4 })), "."),
            h(
              "p",
              { class: "prx-al-note" },
              "The optimization gap η measures how far the selected report is above the selection-law minimum in this family. Exact enumeration gives η = ",
              ro("eta", 0),
              ". Evaluation regret instead compares that report with the evaluation-law minimum; it can be positive when η is zero.",
            ),
            boundRow(
              "Absolute risk change of the fixed selected report",
              ["Same report, different laws: bound (N/M)δ."],
              ro("risk-difference", r.riskDifference, formatRisk),
              ro("evaluation-bound", r.bound.evaluation, formatRisk),
            ),
            boundRow(
              "Evaluation regret using disclosure counts",
              ["Both reports judged under the evaluation law: bound ((N + N*)/M)δ + η."],
              ro("regret-copy", r.regret, formatRisk),
              ro("sharp-bound", r.bound.regret, formatRisk),
            ),
            boundRow(
              "Uniform evaluation-regret comparison",
              ["Bound ", ctx.num(2, formatCount(2)), "δ + η; it does not need either disclosure count."],
              ro("uniform-observed", r.regret, formatRisk),
              ro("uniform-copy", r.bound.uniform, formatRisk),
            ),
            h(
              "p",
              { class: "prx-al-note" },
              "Here N = ",
              ctx.num(r.selected.N, formatCount(r.selected.N)),
              " is the selected report’s stated-pair count; N* = ",
              ctx.num(r.evaluationBest.N, formatCount(r.evaluationBest.N)),
              " belongs to the evaluation-best report; M = ",
              ctx.num(M, formatCount(M)),
              " counts all pairs.",
            ),
            h(
              "p",
              { class: "prx-al-note" },
              "The general comparison is regret ≤ ",
              ctx.num(2, formatCount(2)),
              "d + η, where d bounds risk disagreement over the entire common family. Pair errors give d ≤ δ here. These bounds concern risk, not agreement of grade vectors.",
            ),
            h(
              "p",
              { class: "prx-al-note" },
              "Both laws use the same targets, withholding cost and family. These bounds can be loose. More posterior draws alone do not establish agreement between the laws.",
            ),
          );

          const pair = r.coefficient.at[0];
          gapPair.replaceChildren(
            "One pair attaining the radius: ",
            h("span", { "data-prx-name": "" }, `${IDS[pair.i]} above ${IDS[pair.j]}`),
            ", with error ",
            ro("pair-selection-error", selectionLaw.e[0][pair.i][pair.j], formatProb),
            " under selection and ",
            ro("pair-evaluation-error", r.evaluationLaw.e[0][pair.i][pair.j], formatProb),
            " under evaluation.",
          );

          lawNote.replaceChildren(
            "Both are independent normal laws declared for these fictional sites, with ",
            ctx.num(0.95, "95%"),
            " marginal intervals. The evaluation mean of ",
            h("span", { "data-prx-name": "" }, state.unit),
            " shifts by ",
            ro("shift", state.shift, (v) => formatSigned(v, { digits: 2 })),
            ", and every evaluation SD is multiplied by ",
            ro("scale", state.scale, formatSetting),
            ". Neither law is identified as an empirically verified truth.",
          );
        },
      };
    },
  });
}
