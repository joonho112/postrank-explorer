// 3.5 posterior-tiers ("Tiers from posterior summaries") — Frame v2 upgrade.
// Keep ../shared/domain/posterior-tiers.js untouched and re-exported for 3.9, 3.12, 3.13, and parity tests.
export * from "../shared/domain/posterior-tiers.js";

import { appLink, createWidget } from "../shared/base.js";
import { gradeColors, labelOn, palette, placeDirectLabels, svgScene } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatRational,
  formatReadoutEst,
  formatReadoutRisk,
  formatRisk,
  formatSetting,
  rationalApprox,
  tickLabel,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  CONFIG,
  CSS as DOMAIN_CSS,
  MODELS,
  compute,
  createRuleCardRenderer,
} from "../shared/domain/posterior-tiers.js";

const LEAGUE_SEED = 20261030;
const RULES = Object.freeze(["pm-tiers", "pm-cuts", "er-cuts", "optimum"]);
const LADDER_RULES = Object.freeze(["pm-tiers", "pm-cuts", "optimum", "er-cuts"]);

const STAGE_CSS = `
/* PR-01: reset any inherited container/grid placement inside Frame v2 stage */
.prx-pt[data-prx-frame="v2"] .prx-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  min-width: 0;
}
@media (min-width: 54rem) {
  .prx-pt[data-prx-frame="v2"] .prx-stage {
    grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
    align-items: start;
  }
}
.prx-pt[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  margin: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 0.45rem 0.75rem;
  flex: 0 0 auto;
}
.prx-pt[data-prx-frame="v2"] .prx-controls .prx-slider {
  flex: 0 1 10.75rem;
  max-width: 11.5rem;
}
.prx-pt[data-prx-frame="v2"] .prx-controls .prx-select {
  flex: 0 1 12.75rem;
  min-width: 10.5rem;
}
.prx-pt[data-prx-frame="v2"] .prx-controls .prx-select select {
  width: 100%;
  max-width: 100%;
}

/* Stage cards (plot-paper surfaces) */
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder,
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero {
  margin: 0;
  padding: 0.5rem 0.65rem 0.55rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  min-width: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-risk-axis,
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero-chart {
  min-width: 0;
  width: 100%;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-risk-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.7rem;
  margin: 0 0 0.32rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-leg-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-swatch {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-swatch-err {
  background: var(--prx-err);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-swatch-wh {
  background: var(--prx-wh);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-swatch-tau {
  display: inline-block;
  width: 0.8rem;
  height: 0;
  border-top: 1.5px dashed var(--prx-plot-axis);
}

/* Unified 4-row interactive risk-bar rule selector */
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-pt-rule {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.28rem;
  margin: 0 0 0.2rem;
  padding: 0;
  border: 0;
  min-width: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: 0.32rem 0.5rem 0.36rem;
  min-height: 2.35rem;
  min-width: 0;
  border: 1px solid var(--prx-border);
  border-inline-start: 3px solid var(--prx-border);
  border-radius: 5px;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  cursor: pointer;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio[data-nested] {
  border-inline-start-color: var(--prx-post);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio:has(input:checked) {
  background: var(--prx-bg-raised);
  border-color: var(--prx-post);
  border-inline-start-color: var(--prx-post);
  font-weight: 600;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio:has(input:disabled) {
  opacity: 0.72;
  cursor: not-allowed;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio input[type="radio"] {
  flex: none;
  margin: 0.16rem 0 0;
  accent-color: var(--prx-post);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio > span {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.2rem;
  flex: 1 1 auto;
  min-width: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-bar-slot {
  display: block;
  width: 100%;
  min-width: 0;
  line-height: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-bar-slot svg {
  display: block;
  width: 100%;
  height: 12px;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-risk-value {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 0.92em;
  color: var(--prx-plot-fg);
  white-space: nowrap;
}

/* Selected rule report-card header */
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.65rem;
  margin: 0 0 0.3rem;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero-title {
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero-meta {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-muted);
}

/* Settings disclosure pill radios (>= 44px on coarse/mobile) */
.prx-pt[data-prx-frame="v2"] .prx-pt-cap,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-cap > legend,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt > legend {
  flex: 1 1 100%;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--prx-fg);
  margin-bottom: 0.15rem;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-cap .prx-radio,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt .prx-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--prx-border-strong);
  border-radius: 5px;
  background: var(--prx-bg);
}

@media (pointer: coarse), (max-width: 48em) {
  .prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio,
  .prx-pt[data-prx-frame="v2"] .prx-pt-cap .prx-radio,
  .prx-pt[data-prx-frame="v2"] .prx-pt-opt .prx-radio {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}

@media (max-width: 30em) {
  .prx-pt[data-prx-frame="v2"] .prx-title {
    margin: 0 0 0.2rem;
    font-size: 0.95rem;
    line-height: 1.25;
  }
  .prx-pt[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex-wrap: wrap;
    flex: 1 1 100%;
  }
  .prx-pt[data-prx-frame="v2"] .prx-controls .prx-slider,
  .prx-pt[data-prx-frame="v2"] .prx-controls .prx-select {
    flex-basis: 100%;
    max-width: 100%;
  }
  .prx-pt[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.38rem;
    padding: 0.26rem 0.5rem;
    font-size: 0.9rem;
    line-height: 1.38;
  }
  .prx-pt[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.34rem;
    font-size: 0.78rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-stage {
    padding: 0.32rem 0.38rem;
    gap: 0.38rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder,
  .prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-hero {
    padding: 0.32rem 0.4rem 0.36rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-pt-rule {
    gap: 0.16rem;
    margin-top: 0.25rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-ladder .prx-radio {
    padding-inline: 0.38rem;
    font-size: 0.86rem;
  }
  .prx-pt[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.38rem;
    gap: 0.28rem;
  }
}
`;

function linearTicks(lo, hi, targetCount = 5) {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return [lo];
  const raw = span / Math.max(2, targetCount);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag;
  const start = Math.ceil((lo - step * 1e-9) / step) * step;
  const out = [];
  for (let v = start; v <= hi + step * 1e-9 && out.length < 16; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out.length >= 2 ? out : [lo, hi];
}

export function mountWidget(el, spec = {}) {
  const T = CONFIG.text;
  return createWidget(el, spec, {
    name: "posterior-tiers",
    frame: "v2",
    css: DOMAIN_CSS + STAGE_CSS,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-pt",
    keys: {
      data: { type: "choice", values: ["league", "league8", "thirty"], value: CONFIG.data },
      rule: { type: "choice", values: Array.from(RULES), value: CONFIG.rule },
      cap: { type: "integer", min: CONFIG.cap.min, max: CONFIG.cap.max, value: CONFIG.defaults[CONFIG.data].cap },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.defaults[CONFIG.data].tau },
      opt: { type: "choice", values: ["cap", "all"], value: CONFIG.opt },
    },
    build(ctx) {
      const { h } = ctx;

      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const fill = (template, slots) => {
        const out = [];
        let at = 0;
        for (const m of template.matchAll(/⟨([^⟩]+)⟩/g)) {
          if (m.index > at) out.push(template.slice(at, m.index));
          out.push(...[].concat(slots[m[1]]));
          at = m.index + m[0].length;
        }
        if (at < template.length) out.push(template.slice(at));
        return out;
      };
      const count = (x) => ctx.num(x, formatCount(x));
      const risk3 = (x) => ctx.num(x, formatReadoutRisk(x));
      const setting = (x) => ctx.num(x, formatSetting(x));
      const unit = (id) => h("span", { "data-prx-name": "", text: id });
      const fracOK = (xs) => xs.every((x) => rationalApprox(x, { maxDenominator: CONFIG.maxDenominator }));
      const fmtE = (mdl, x) => (mdl.fraction ? formatRational(x) : formatExpectedCount(x));

      const ruleNames = {
        "pm-tiers": T.rulePmTiers,
        "pm-cuts": T.rulePmCuts,
        "er-cuts": T.ruleErCuts,
        optimum: T.ruleOptimum,
      };
      const ruleName = (r) => ruleNames[r];
      const ladderNames = {
        "pm-tiers": T.rulePmTiers,
        "pm-cuts": "Mean-order cuts",
        optimum: "Exact optimum",
        "er-cuts": "Expected-rank cuts",
      };

      // --- Primary controls in ctx.controls: Withholding cost τ + Data select
      const tau = ctx.slider({
        label: T.slider,
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.primaryControl(tau.root);

      const dataSelect = ctx.select({
        label: T.dataLegend,
        name: "data",
        options: [
          { value: "league", label: T.dataLeague },
          { value: "league8", label: T.dataLeague8 },
          { value: "thirty", label: T.dataThirty },
        ],
        value: ctx.state.data,
        onChange: (v) => {
          const m = MODELS[v];
          const s = ctx.state;
          ctx.set({
            data: v,
            tau: m.tau,
            cap: m.cap,
            rule: s.rule === "optimum" && !m.hasOptimum ? CONFIG.rule : s.rule,
          });
        },
      });
      ctx.controls.append(tau.root, dataSelect.root);

      // --- Secondary controls in Settings disclosure (preserving .prx-pt-cap legend 11.4 literal)
      const capValues = [];
      for (let g = CONFIG.cap.min; g <= CONFIG.cap.max; g += 1) capValues.push(g);
      const capRadio = ctx.radioGroup({
        legend: T.capLegend,
        name: "cap",
        className: "prx-pt-cap",
        options: capValues.map((g) => ({ value: g, label: count(g) })),
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const optRadio = ctx.radioGroup({
        legend: T.optLegend,
        name: "opt",
        className: "prx-pt-opt",
        options: [
          { value: "cap", label: T.optCap },
          { value: "all", label: T.optAll },
        ],
        value: ctx.state.opt,
        onChange: (v) => ctx.set({ opt: v }),
      });
      const settings = ctx.settingsBox("Settings");
      settings.body.append(capRadio.root, optRadio.root);

      // --- Stage: (1) Unified 4-row interactive [data-prx-risk-rule] risk-decomposition selector + 13px axis SVG;
      //            (2) .prx-pt-hero Selected Rule Grade Report Card SVG (PR-03 badge pills)
      const riskLegendTau = h("span");
      const riskLegend = h(
        "div",
        { class: "prx-pt-risk-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-pt-leg-item" }, h("span", { class: "prx-pt-swatch prx-pt-swatch-err", "aria-hidden": "true" }), "Wrong E/M"),
        h("span", { class: "prx-pt-leg-item" }, h("span", { class: "prx-pt-swatch prx-pt-swatch-wh", "aria-hidden": "true" }), "Withheld cost"),
        h("span", { class: "prx-pt-leg-item" }, h("span", { class: "prx-pt-swatch-tau", "aria-hidden": "true" }), riskLegendTau),
      );
      const riskAxisSlot = h("div", { class: "prx-pt-risk-axis" });
      const ladderRows = new Map();
      const ruleRadio = ctx.radioGroup({
        legend: "Risk by rule · select a row",
        name: "rule",
        className: "prx-pt-rule",
        options: LADDER_RULES.map((value) => {
          const numbers = h("span", { class: "prx-pt-risk-value" });
          const barSlot = h("span", { class: "prx-pt-bar-slot", "aria-hidden": "true" });
          ladderRows.set(value, { numbers, barSlot });
          return {
            value,
            label: [
              h(
                "span",
                { class: "prx-pt-row-head" },
                h("span", { class: "prx-pt-ladder-name", text: ladderNames[value] }),
                numbers,
              ),
              barSlot,
            ],
          };
        }),
        value: ctx.state.rule,
        onChange: (v) => ctx.set({ rule: v }),
      });
      ruleRadio.root.querySelector("legend")?.classList.add("prx-sr-only");
      ruleRadio.inputs.forEach((input, i) => {
        const row = input.parentElement;
        row.dataset.prxRiskRule = LADDER_RULES[i];
        if (i < 3) row.dataset.nested = "";
      });

      const ladder = h(
        "section",
        { class: "prx-pt-ladder prx-light-panel", "aria-label": "Risk at the current withholding cost" },
        riskLegend,
        ruleRadio.root,
        riskAxisSlot,
      );

      const heroHead = h("div", { class: "prx-pt-hero-head" });
      const heroChartSlot = h("div", { class: "prx-pt-hero-chart" });
      const hero = h(
        "section",
        { class: "prx-pt-hero prx-light-panel", "aria-label": "Current report preview" },
        heroHead,
        heroChartSlot,
      );
      ctx.stage.append(ladder, hero);

      // --- Disclosures: Data and rule comparison table + Method and search scope
      const selectedReadout = h("p", { class: "prx-pt-note", "data-prx-selected-report": "" });
      const labelLine = h("p", { class: "prx-pt-label", "data-prx-result-scope": "" });
      const compareRows = h("ol", { class: "prx-pt-rows" });
      const ordersSlot = h("div", { class: "prx-pt-orders" });
      const compareBox = h(
        "section",
        { class: "prx-pt-compare" },
        ctx.panelTitle(T.compareHeading, { className: "prx-pt-heading" }),
        compareRows,
        ordersSlot,
      );
      const dataBox = ctx.dataBox("Data and rule comparison table");
      dataBox.body.append(selectedReadout, labelLine, compareBox);

      const methodNotes = h("div", { class: "prx-pt-notes" });
      const guarantee = h("section", { class: "prx-pt-guarantees" });
      const methodBox = ctx.methodBox("Method and search scope");
      methodBox.body.append(methodNotes, guarantee);

      const { scopeParts, drawRow } = createRuleCardRenderer(ctx);

      function drawGuarantees() {
        const rows = [
          ["Observed score, fixed tiers", "No general guarantee", "No general guarantee", "Same declared report under either target"],
          ["Standardized evidence or threshold-pattern grades", "No general guarantee", "No general guarantee", "Preserve reference, threshold and combination"],
          ["Posterior mean composite, fixed tiers", "No general guarantee", "No general guarantee", "Same tiers and equal-score policy as observed-score baseline"],
          ["Posterior mean order, composite-loss cuts", "Exact within its family", "No general guarantee", "Reports preserving the declared score order"],
          ["Posterior mean order, directional-loss cuts", "No general guarantee", "Exact within its family", "Reports preserving the declared score order"],
          ["Expected-rank order, directional-loss cuts", "No general guarantee", "Exact within its family", "Reports preserving the declared rank-score order"],
          ["Unrestricted composite-loss grades", "Exact within its family", "No general guarantee", "All reports satisfying the declared restrictions"],
          ["Unrestricted weighted-directional grades", "No general guarantee", "Exact within its family", "All reports satisfying the declared restrictions"],
        ];
        const table = h(
          "table",
          { class: "prx-pt-table prx-sticky-first", "data-prx-guarantees": "" },
          h("caption", {}, "Selection guarantees under the supplied law, common cost and stated feasible family"),
          h("thead", {}, h("tr", {}, ...["Rule", "Directional loss", "Composite loss", "Eligible comparison"].map((x) => h("th", { scope: "col" }, x)))),
          h(
            "tbody",
            {},
            ...rows.map(([r, composite, directional, comparison]) =>
              h("tr", {}, h("th", { scope: "row" }, r), h("td", {}, directional), h("td", {}, composite), h("td", {}, comparison)),
            ),
          ),
        );
        guarantee.replaceChildren(
          ctx.panelTitle("Which objective does each rule optimize?", { className: "prx-pt-heading" }),
          h(
            "p",
            { class: "prx-pt-note" },
            "The cards use one directional criterion. The table separates guarantees for a scalar composite target from guarantees for weighted criterion directions. It does not claim that a method is best under both.",
          ),
          ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, table), "Rule guarantees under both reporting targets"),
          h(
            "p",
            { class: "prx-pt-note" },
            "The comparisons apply to the supplied probabilities, the same loss and all reports in the stated family. A report outside that family can have lower risk. Changing the loss changes the comparison.",
          ),
        );
      }
      drawGuarantees();

      function drawMethodNotes(mdl) {
        methodNotes.replaceChildren(
          h("p", { class: "prx-pt-note" }, "A wrong stated direction costs ", count(1), "; staying silent on one pair costs τ."),
          h("p", { class: "prx-pt-note", text: "Each bracketed family contains the one above it, so risk cannot rise from fixed tiers to mean-order cuts to the exact optimum." }),
          h("p", { class: "prx-pt-note", text: T.compareNote }),
          h("p", { class: "prx-pt-note" }, ...(mdl.hasOptimum ? [T.gapNote] : fill(T.noOptimum, { n: count(mdl.n) }))),
          h("p", { class: "prx-pt-note", text: "Grade one is highest priority: the largest true value as the posterior judges it." }),
          h("p", { class: "prx-pt-note" }, "See ", appLink(ctx, "order-misses"), " for a three-unit law where posterior-mean cuts miss the unrestricted optimum."),
        );
      }

      function drawOrders(mdl) {
        const rows = mdl.pmOrder.map((i, p) => {
          const j = mdl.erOrder[p];
          return h(
            "tr",
            {},
            h("th", { scope: "row" }, count(p + 1)),
            h("td", {}, unit(mdl.ids[i])),
            h("td", {}, unit(mdl.ids[j])),
            h("td", {}, ctx.num(mdl.means[i], formatDecimal(mdl.means[i], { digits: 3 }))),
            h("td", {}, ctx.num(mdl.sds[i], formatDecimal(mdl.sds[i], { digits: 3 }))),
            h("td", {}, ctx.num(mdl.er[j], formatDecimal(mdl.er[j], { digits: 2 }))),
          );
        });
        const table = h(
          "table",
          { class: "prx-pt-table prx-sticky-first" },
          h("caption", { text: T.ordersCaption }),
          h("thead", {}, h("tr", {}, ...[T.colPlace, T.colPmUnit, T.colErUnit, T.colMean, T.colSd, T.colEr2].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...rows),
        );
        ordersSlot.replaceChildren(
          ctx.panelTitle(T.ordersSummary, { className: "prx-pt-heading" }),
          ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, table), T.ordersRegion),
        );
      }

      function drawDataSelectedReadout(mdl, state, rule, res, G, opt, fracMode) {
        const ev = res.ev;
        const capWords = G < mdl.n ? [`, ${T.atMost} `, count(G), ` ${G === 1 ? T.gradeWord : T.gradesWord}`] : [];
        const head =
          rule === "optimum"
            ? [", ", tagNode(ctx, res, { key: "readout-optimum" })]
            : rule === "pm-tiers"
              ? [", ", count(G), ` ${T.rulePmTiers.toLowerCase()}`]
              : [...capWords, `, ${ruleName(rule).charAt(0).toLowerCase()}${ruleName(rule).slice(1)}`];
        const gap =
          opt && rule !== "optimum"
            ? (() => {
                const same = Array.from(res.grade ?? res).every((g, i) => g === opt.grade[i]);
                if (same) return [` It is ${T.sameReport}`];
                const d = ev.risk - opt.risk;
                if (Math.abs(d) <= opt.tieTol) return [` It has ${T.sameRisk}`];
                return [` The exact optimum has risk `, ro("opt.risk", opt.risk, fracMode ? formatRational(opt.risk) : formatRisk(opt.risk)), "."];
              })()
            : [];
        selectedReadout.replaceChildren(
          "τ = ",
          setting(state.tau),
          ...head,
          ": ",
          ro("N", ev.N, formatCount(ev.N)),
          ` ${T.of} `,
          count(ev.M),
          ` ${T.stated}, ${T.eWords} `,
          ro("E", ev.Ew, fmtE(mdl, ev.Ew)),
          `, ${T.riskWords} `,
          ro("risk", ev.risk, fracMode ? formatRational(ev.risk) : formatRisk(ev.risk)),
          ".",
          ...gap,
        );
        labelLine.replaceChildren(...scopeParts(mdl, rule, res, G, "chosen"));
      }

      function drawLiveReadout(mdl, state, rule, results, G) {
        const tiers = results["pm-tiers"];
        const cuts = results["pm-cuts"];
        const exact = results.optimum;
        const selected = results[rule];
        const capClause = G < mdl.n ? [" (at most ", count(G), G === 1 ? " grade)" : " grades)"] : [];
        const shortName = rule === "er-cuts" ? "expected-rank cuts" : "mean-order cuts";

        if (mdl.hasOptimum && exact) {
          if (rule === "optimum") {
            const scopePhrase =
              state.opt === "all" || G >= mdl.n
                ? ["the exact optimum across all ", count(exact.family.size), " reports"]
                : ["the exact optimum across ", count(exact.family.size), " reports"];
            ctx.readout.set([
              "At τ = ",
              setting(state.tau),
              ", ",
              ...scopePhrase,
              " states ",
              count(exact.ev.N),
              " pairs at risk ",
              risk3(exact.ev.risk),
              "; fixed tiers state ",
              count(tiers.ev.N),
              " pairs at ",
              risk3(tiers.ev.risk),
              ".",
            ]);
            return;
          }
          if (rule === "pm-tiers") {
            ctx.readout.set([
              "At τ = ",
              setting(state.tau),
              " (",
              count(G),
              G === 1 ? " grade), " : " grades), ",
              "fixed tiers state ",
              count(tiers.ev.N),
              " pairs at risk ",
              risk3(tiers.ev.risk),
              "; mean-order cuts state ",
              count(cuts.ev.N),
              " at ",
              risk3(cuts.ev.risk),
              " (exact ",
              risk3(exact.ev.risk),
              ").",
            ]);
            return;
          }
          const tied = Math.abs(selected.ev.risk - exact.ev.risk) <= CONFIG.tieTol;
          if (tied) {
            ctx.readout.set([
              "At τ = ",
              setting(state.tau),
              ...capClause,
              ", ",
              shortName,
              " state ",
              count(selected.ev.N),
              " pairs at risk ",
              risk3(selected.ev.risk),
              ", matching the exact optimum (",
              count(exact.family.size),
              " reports); fixed tiers state ",
              count(tiers.ev.N),
              " at ",
              risk3(tiers.ev.risk),
              ".",
            ]);
          } else {
            ctx.readout.set([
              "At τ = ",
              setting(state.tau),
              ...capClause,
              ", ",
              shortName,
              " state ",
              count(selected.ev.N),
              " pairs at risk ",
              risk3(selected.ev.risk),
              " vs ",
              risk3(exact.ev.risk),
              " for the exact optimum (",
              count(exact.family.size),
              " reports); fixed tiers get ",
              risk3(tiers.ev.risk),
              ".",
            ]);
          }
          return;
        }

        if (rule === "pm-tiers") {
          ctx.readout.set([
            "At τ = ",
            setting(state.tau),
            " (",
            count(G),
            G === 1 ? " grade), " : " grades), ",
            "fixed tiers state ",
            count(tiers.ev.N),
            " pairs at risk ",
            risk3(tiers.ev.risk),
            "; optimizing mean-order boundaries states ",
            count(cuts.ev.N),
            " pairs at ",
            risk3(cuts.ev.risk),
            ".",
          ]);
        } else {
          ctx.readout.set([
            "At τ = ",
            setting(state.tau),
            ...capClause,
            ", ",
            shortName,
            " (",
            count(selected.family.size),
            " contiguous reports) state ",
            count(selected.ev.N),
            " pairs at risk ",
            risk3(selected.ev.risk),
            "; fixed tiers state ",
            count(tiers.ev.N),
            " at ",
            risk3(tiers.ev.risk),
            ".",
          ]);
        }
      }

      function drawRiskLadder(mdl, state, rule, results, pal) {
        riskLegendTau.replaceChildren("τ = ", setting(state.tau));

        for (const [key, { numbers }] of ladderRows) {
          const result = results[key];
          if (result) {
            numbers.replaceChildren(
              "N ",
              ro(`ladder-${key}-N`, result.ev.N, formatCount(result.ev.N)),
              " · ",
              ro(`ladder-${key}-risk`, result.ev.risk, formatReadoutRisk(result.ev.risk)),
            );
          } else {
            numbers.replaceChildren("Not searched: ", count(mdl.n), " units");
          }
        }

        const firstBarSlot = ladderRows.get(LADDER_RULES[0])?.barSlot;
        const axisRect = riskAxisSlot.getBoundingClientRect?.() ?? { left: 0, width: 0 };
        const barRect = firstBarSlot?.getBoundingClientRect?.() ?? { left: 0, width: 0 };
        const axisWidth = Math.round(riskAxisSlot.clientWidth || axisRect.width || 0);
        const width = axisWidth > 0 ? Math.max(220, axisWidth) : 420;
        const narrow = width < 340;
        const trackLeft =
          barRect.width > 0 && axisRect.width > 0
            ? Math.max(0, Math.round(barRect.left - axisRect.left))
            : 28;
        const barW =
          barRect.width > 0
            ? Math.max(60, Math.round(barRect.width))
            : Math.max(60, width - trackLeft - 10);

        const activeRisks = LADDER_RULES.flatMap((k) => (results[k] ? [results[k].ev.risk] : []));
        const xMax = Math.max(0.05, Math.max(state.tau, ...activeRisks) * 1.06);
        const barX = (v) => (Math.max(0, v) / xMax) * barW;
        const ticks = linearTicks(0, xMax, narrow ? 4 : 5);
        const svgNs = "http://www.w3.org/2000/svg";
        const mkSvg = (tag, attrs = {}) => {
          const node = ctx.doc.createElementNS(svgNs, tag);
          for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
          return node;
        };

        for (const [key, { barSlot }] of ladderRows) {
          const res = results[key];
          const chosen = key === rule;
          const barSvg = mkSvg("svg", {
            viewBox: `0 0 ${barW} 12`,
            width: barW,
            height: 12,
            "aria-hidden": "true",
          });
          if (!res) {
            barSvg.append(
              mkSvg("rect", {
                x: 0.5,
                y: 1.5,
                width: Math.max(1, barW - 1),
                height: 9,
                rx: 2,
                fill: "none",
                stroke: pal.cellBorder,
                "stroke-dasharray": "3 3",
              }),
            );
          } else {
            const ev = res.ev;
            const errW = barX(ev.Ew / ev.M);
            const totW = barX(ev.risk);
            barSvg.append(
              mkSvg("rect", {
                x: 0,
                y: 1,
                width: barW,
                height: 10,
                rx: 2,
                fill: pal.plotGrid,
                "fill-opacity": 0.35,
              }),
              mkSvg("rect", {
                x: 0,
                y: 1,
                width: Math.max(0, errW).toFixed(2),
                height: 10,
                fill: pal.err,
              }),
              mkSvg("rect", {
                x: errW.toFixed(2),
                y: 1,
                width: Math.max(0, totW - errW).toFixed(2),
                height: 10,
                fill: pal.wh,
              }),
            );
            if (chosen) {
              barSvg.append(
                mkSvg("rect", {
                  x: 0.5,
                  y: 1,
                  width: Math.max(1, totW - 0.5).toFixed(2),
                  height: 10,
                  fill: "none",
                  stroke: pal.plotFg,
                  "stroke-width": 1.4,
                }),
              );
            }
          }
          const tauPx = barX(state.tau);
          barSvg.append(
            mkSvg("line", {
              x1: tauPx.toFixed(2),
              x2: tauPx.toFixed(2),
              y1: 0,
              y2: 12,
              stroke: pal.plotAxis,
              "stroke-width": 1.5,
              "stroke-dasharray": "3 2",
            }),
          );
          barSlot.replaceChildren(barSvg);
        }

        const tableRows = LADDER_RULES.filter((k) => Boolean(results[k])).map((k) => {
          const ev = results[k].ev;
          return {
            rule: ladderNames[k],
            N: ev.N,
            errShare: ev.Ew / ev.M,
            whShare: (state.tau * (ev.M - ev.N)) / ev.M,
            risk: ev.risk,
          };
        });

        svgScene(
          riskAxisSlot,
          {
            width,
            height: 38,
            fontSize: 13,
            alt: "Horizontal risk scale decomposing each rule's risk into expected wrong directions per pair and withholding cost per pair, compared against the all-withheld line at tau.",
            table: {
              caption: "Risk decomposition by rule",
              columns: [
                { label: "Rule", value: "rule" },
                { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v) },
                { label: "Wrong share, E/M", value: "errShare", format: (v) => formatReadoutRisk(v) },
                { label: "Withheld cost, τ(M − N)/M", value: "whShare", format: (v) => formatReadoutRisk(v) },
                { label: "Risk", value: "risk", format: (v) => formatReadoutRisk(v) },
              ],
              rows: tableRows,
            },
          },
          (scene) => {
            const { h: s, palette: scPal } = scene;
            scene.add(
              s("line", {
                x1: trackLeft,
                x2: trackLeft + barW,
                y1: 2,
                y2: 2,
                stroke: scPal.plotAxis,
                strokeWidth: 1,
              }),
            );
            for (const tk of ticks) {
              const tx = trackLeft + barX(tk);
              const anchor = tk === 0 ? "start" : tx > width - 16 ? "end" : "middle";
              scene.add(
                s("line", { x1: tx, x2: tx, y1: 2, y2: 6, stroke: scPal.plotAxis, strokeWidth: 1 }),
                scene.numText(
                  { x: tx, y: 18, textAnchor: anchor, fontSize: 13, fill: scPal.plotFg },
                  tk,
                  tickLabel(tk, 0, ticks),
                ),
              );
            }
            scene.add(
              s("text", {
                x: trackLeft + barW / 2,
                y: 34,
                textAnchor: "middle",
                fontSize: 13,
                fill: scPal.plotFg,
                text: "Expected loss per pair (risk)",
              }),
            );
          },
        );
      }

      function drawHeroCard(mdl, rule, res) {
        const grade = Array.from(res.grade);
        const ev = res.ev;
        heroHead.replaceChildren(
          h("strong", { class: "prx-pt-hero-title", text: ladderNames[rule] }),
          h(
            "span",
            { class: "prx-pt-hero-meta" },
            count(ev.N),
            " pairs stated · risk ",
            risk3(ev.risk),
          ),
        );

        const measured = Math.round(heroChartSlot.clientWidth || heroChartSlot.getBoundingClientRect?.().width || 0);
        const width = measured > 0 ? Math.max(240, measured) : 420;
        const narrow = width < 380;
        const n = mdl.n;
        const dense = n > CONFIG.league8;
        const rowH = dense ? (narrow ? 4.8 : 8.0) : narrow ? 15.0 : 24;
        const marginTop = narrow ? 6 : 10;
        const marginBottom = 40;
        const stripeW = 24;
        const marginLeft = dense ? 36 : 68;
        const marginRight = 16;
        const innerH = Math.round(n * rowH);
        const height = marginTop + innerH + marginBottom;
        const innerW = Math.max(40, width - marginLeft - marginRight);

        const orderIdx = Array.from({ length: n }, (_, i) => i).sort(
          (a, b) =>
            grade[a] - grade[b] ||
            (rule === "er-cuts" ? mdl.er[a] - mdl.er[b] : mdl.means[b] - mdl.means[a]),
        );

        const bands = [];
        orderIdx.forEach((unitIdx, pos) => {
          const g = grade[unitIdx];
          const prev = bands.at(-1);
          if (prev && prev.grade === g) {
            prev.last = pos;
            prev.size += 1;
          } else {
            bands.push({ grade: g, first: pos, last: pos, size: 1 });
          }
        });

        const loRaw = Math.min(...mdl.means.map((m, i) => m - mdl.sds[i]));
        const hiRaw = Math.max(...mdl.means.map((m, i) => m + mdl.sds[i]));
        const pad = (hiRaw - loRaw) * 0.06 || 0.1;
        const lo = loRaw - pad;
        const hi = hiRaw + pad;
        const xOf = (v) => marginLeft + ((v - lo) / (hi - lo)) * innerW;
        const yOfPos = (pos) => marginTop + ((pos + 0.5) / n) * innerH;
        const ticks = linearTicks(lo, hi, narrow ? 4 : 5);

        // PR-03 & WA-02: 17px rounded grade badge pills placed via placeDirectLabels and mapped strictly by item.id
        const placed = placeDirectLabels(
          bands.map((b) => ({
            id: String(b.grade),
            y: (yOfPos(b.first) + yOfPos(b.last)) / 2,
            height: 17,
          })),
          { minGapPx: 18, minY: marginTop + 9, maxY: marginTop + innerH - 9 },
        );
        const placedById = new Map(placed.map((p) => [p.id, p]));

        const G_used = Math.max(...grade);
        const tableRows = orderIdx.map((i) => ({
          id: mdl.ids[i],
          grade: grade[i],
          mean: mdl.means[i],
          sd: mdl.sds[i],
          er: mdl.er[i],
        }));

        svgScene(
          heroChartSlot,
          {
            width,
            height,
            fontSize: 13,
            alt: `Grade report card for ${ruleName(rule)}: ${n} units grouped into ${G_used} ${G_used === 1 ? "grade" : "grades"} by posterior mean ± 1 SD.`,
            table: {
              caption: "Selected rule unit grades and posterior summaries",
              columns: [
                { label: "Unit", value: "id" },
                { label: "Grade", value: "grade", format: (v) => formatCount(v) },
                { label: "Posterior mean", value: "mean", format: (v) => formatReadoutEst(v) },
                { label: "Posterior SD", value: "sd", format: (v) => formatReadoutEst(v) },
                { label: "Expected rank", value: "er", format: (v) => formatReadoutEst(v) },
              ],
              rows: tableRows,
            },
          },
          (scene) => {
            const { h: s, palette: pal } = scene;
            const colors = gradeColors(G_used, pal);
            const yAxisBottom = marginTop + innerH;

            // Alternating grade-band backdrop + cut boundary lines
            for (const b of bands) {
              const y1 = marginTop + (b.first / n) * innerH;
              const y2 = marginTop + ((b.last + 1) / n) * innerH;
              if (b.grade % 2 === 1) {
                scene.add(
                  s("rect", {
                    x: marginLeft,
                    y: y1,
                    width: innerW,
                    height: Math.max(1, y2 - y1),
                    fill: pal.plotGrid,
                    fillOpacity: 0.35,
                  }),
                );
              }
              if (b.first > 0) {
                scene.add(
                  s("line", {
                    x1: marginLeft,
                    x2: marginLeft + innerW,
                    y1,
                    y2: y1,
                    stroke: pal.plotMuted,
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  }),
                );
              }
              scene.add(
                s("rect", {
                  x: 4,
                  y: y1 + 0.5,
                  width: stripeW,
                  height: Math.max(2, y2 - y1 - 1),
                  rx: 2,
                  fill: colors[b.grade - 1],
                }),
              );
            }

            // Vertical x-grid & ticks
            for (const tk of ticks) {
              const tx = xOf(tk);
              scene.add(
                s("line", { x1: tx, x2: tx, y1: marginTop, y2: yAxisBottom, stroke: pal.plotGrid, strokeWidth: 1 }),
                s("line", { x1: tx, x2: tx, y1: yAxisBottom, y2: yAxisBottom + 4, stroke: pal.plotAxis, strokeWidth: 1 }),
                scene.numText(
                  { x: tx, y: yAxisBottom + 16, textAnchor: "middle", fontSize: 13, fill: pal.plotFg },
                  tk,
                  tickLabel(tk, 0, ticks),
                ),
              );
            }
            scene.add(
              s("line", { x1: marginLeft, x2: marginLeft + innerW, y1: yAxisBottom, y2: yAxisBottom, stroke: pal.plotAxis, strokeWidth: 1 }),
              s("text", {
                x: marginLeft + innerW / 2,
                y: yAxisBottom + 35,
                textAnchor: "middle",
                fontSize: 13,
                fill: pal.plotFg,
                text: "Posterior mean (± one SD)",
              }),
            );

            // Unit intervals & dots (+ unit labels when n <= 8)
            orderIdx.forEach((unitIdx, pos) => {
              const g = grade[unitIdx];
              const col = colors[g - 1];
              const ym = yOfPos(pos);
              const x1 = xOf(mdl.means[unitIdx] - mdl.sds[unitIdx]);
              const x2 = xOf(mdl.means[unitIdx] + mdl.sds[unitIdx]);
              const xm = xOf(mdl.means[unitIdx]);

              scene.add(
                s("line", {
                  x1,
                  x2,
                  y1: ym,
                  y2: ym,
                  stroke: col,
                  strokeWidth: dense ? 1.6 : 2.1,
                  strokeOpacity: 0.8,
                }),
                s("circle", {
                  cx: xm,
                  cy: ym,
                  r: dense ? 2.6 : 4,
                  fill: col,
                  stroke: pal.plotBg,
                  strokeWidth: 0.9,
                }),
              );

              if (!dense) {
                scene.add(
                  s("text", {
                    x: marginLeft - 6,
                    y: ym + 4.5,
                    textAnchor: "end",
                    fontSize: 13,
                    fill: pal.plotFg,
                    text: mdl.ids[unitIdx],
                  }),
                );
              }
            });

            // PR-03 rounded badge pills on top of thin stripes
            for (const b of bands) {
              const py = placedById.get(String(b.grade))?.y ?? (yOfPos(b.first) + yOfPos(b.last)) / 2;
              const fillCol = colors[b.grade - 1];
              scene.add(
                s("rect", {
                  x: 4,
                  y: py - 8.5,
                  width: stripeW,
                  height: 17,
                  rx: 3,
                  fill: fillCol,
                  stroke: pal.plotBg,
                  strokeWidth: 1,
                }),
                scene.numText(
                  {
                    x: 4 + stripeW / 2,
                    y: py + 4.5,
                    textAnchor: "middle",
                    fontSize: 13,
                    fontWeight: "700",
                    fill: labelOn(fillCol, pal),
                  },
                  b.grade,
                  formatCount(b.grade),
                ),
              );
            }
          },
        );
      }

      function captionFor(mdl) {
        const seed = () => ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED));
        const sd = () => ctx.num(CONFIG.priorSd, formatSetting(CONFIG.priorSd));
        if (mdl.key === "league" || mdl.key === "league8") {
          return [...fill(mdl.key === "league" ? T.noteLeague : T.noteLeague8, { seed: seed(), sd: sd() }), " (", captionNode(ctx, "teaching-posterior"), ")."];
        }
        return [T.noteThirty];
      }

      return {
        render(state, info = {}) {
          // PR-06 / PR-09: disclosure toggle never re-renders stage or re-fires aria-live readout
          if (info?.reason === "disclosure") return;

          ctx.root.setAttribute("aria-busy", "true");
          try {
            const mdl = MODELS[state.data] ?? MODELS.league8;
            const rule = state.rule === "optimum" && !mdl.hasOptimum ? CONFIG.rule : state.rule;
            const results = compute(mdl, state);
            const G = results.G;

            dataSelect.set(mdl.key);
            ruleRadio.set(rule);
            ruleRadio.inputs[LADDER_RULES.indexOf("optimum")].disabled = !mdl.hasOptimum;
            capRadio.set(G);
            capRadio.inputs.forEach((input, k) => {
              input.disabled = capValues[k] > mdl.n;
            });
            optRadio.set(state.opt);
            optRadio.setDisabled(!mdl.hasOptimum || G >= mdl.n);
            tau.set(state.tau);

            const shownRules = RULES.filter((r) => r !== "optimum" || mdl.hasOptimum);
            const fracMode = mdl.fraction && fracOK(shownRules.map((r) => results[r].ev.risk));
            const pal = palette(ctx.root);
            const opt = results.optimum;

            drawLiveReadout(mdl, state, rule, results, G);
            drawRiskLadder(mdl, state, rule, results, pal);
            drawHeroCard(mdl, rule, results[rule]);

            const rows = shownRules.map((r) => drawRow(mdl, r, results[r], opt, G, r === rule, pal, fracMode));
            compareRows.replaceChildren(...rows);
            drawOrders(mdl);
            drawDataSelectedReadout(mdl, state, rule, results[rule], G, opt, fracMode);
            drawMethodNotes(mdl);
            ctx.caption.replaceChildren(...captionFor(mdl));
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
