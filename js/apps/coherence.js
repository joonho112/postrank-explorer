// G-04: full linked views, exposed as two apps. Source originals are read-only.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatGrades, formatProb, formatRational, formatRisk, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familySizeNode, labelNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  enumerateReports, errorArray, evaluateReport, exactOptimum, finiteLawPairwise, krwExample1Band, normalPdf, pairDecision,
  pairCount, pairDirection, relaxedPairRisk, relations, statedAbove,
} from "../pr-core.js";

import { THREE_UNIT_LAW, THREE_UNIT_ERRORS } from "../shared/three-unit-law.js";

export const COHERENCE_CSS = `
/*
 * postrank Explorer · coherence (catalog G-04; js/widgets/coherence.js)
 *
 * Layout: the view switch and the sliders, the live read-out, then one view at a time. KRW view: the three posteriors,
 * then the direction probabilities and the pair choices side by side when the widget is wide enough (one column below
 * about 40rem). Finite view: the law and the pair choices side by side, the second prediction, then the reports.
 * Legends and figures sit on the plot panel (--prx-plot-bg) so data colors keep their meaning in every theme.
 * Tokens only; nothing here is wider than its container at 375 px.
 */

.prx-coh .prx-coh-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-coh .prx-coh-panel {
  min-width: 0;
  margin: 0 0 1rem;
}

.prx-coh .prx-coh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 0 1.25rem;
  align-items: start;
  min-width: 0;
}

.prx-coh .prx-coh-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-coh .prx-coh-view {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}

.prx-coh .prx-coh-view > legend {
  flex: 1 1 100%;
}

.prx-coh .prx-coh-note {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-coh .prx-coh-locked {
  padding: 0.5rem 0.75rem;
  background: var(--prx-bg-raised);
  border-left: 3px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}

.prx-coh .prx-coh-label {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.95em;
}

.prx-coh .prx-coh-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

/* --- pair choices --- */
.prx-coh .prx-coh-choices p {
  margin: 0.4rem 0 0;
  font-size: 0.95em;
}

.prx-coh .prx-coh-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.95em;
}

.prx-coh .prx-coh-list li {
  margin: 0.15rem 0;
}

.prx-coh .prx-coh-together {
  padding: 0.4rem 0.6rem;
  background: var(--prx-bg-raised);
  border-radius: var(--prx-radius, 6px);
}

.prx-coh .prx-coh-impossible {
  border-left: 3px solid var(--prx-err-text);
}

.prx-coh .prx-coh-sym {
  font-style: italic;
  white-space: nowrap;
}

/* --- formulas --- */
.prx-coh .prx-coh-formula {
  max-width: 100%;
  margin: 0.35rem 0 0;
  overflow-x: auto;
}

.prx-coh .prx-coh-formula math {
  margin: 0.15rem 0;
}

/* --- the law table --- */
.prx-coh .prx-coh-table {
  margin: 0 0 0.5rem;
  border-collapse: collapse;
  font-size: 0.95em;
  font-variant-numeric: tabular-nums;
}

.prx-coh .prx-coh-table caption {
  caption-side: top;
  padding: 0 0 0.25rem;
  text-align: left;
  color: var(--prx-fg-muted);
}

.prx-coh .prx-coh-table th,
.prx-coh .prx-coh-table td {
  padding: 0.2rem 0.75rem 0.2rem 0;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}

.prx-coh .prx-coh-table td {
  text-align: right;
}

.prx-coh .prx-coh-gate {
  min-width: 0;
}

/* --- legends (on the plot panel) --- */
.prx-coh .prx-coh-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius, 6px);
}

.prx-coh .prx-coh-key {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.prx-coh .prx-coh-swatch {
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}

.prx-coh .prx-coh-swatch-rule {
  height: 0;
  border: 0;
  border-top: 2px dashed var(--prx-plot-axis);
}

.prx-coh .prx-coh-swatch-dot {
  background: var(--prx-plot-fg);
  border-radius: 50%;
}

.prx-coh .prx-coh-swatch-band {
  background: var(--prx-plot-grid);
}

.prx-coh .prx-coh-swatch-outline {
  background: var(--prx-plot-bg);
  border: 2.5px solid var(--prx-plot-fg);
}


`;

export const CONFIG = Object.freeze({
  name: "coherence",
  label: "Why a report must be coherent: each pair decided alone against the best grade report we can print",
  title: "Decide each pair alone, then print grades?",
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  omega2: Object.freeze({ min: 0, max: 2, step: 0.01, value: 1, digits: 2 }),
  krw: Object.freeze({ omega1: 2, omega3: 0, sd: 1, names: Object.freeze(["A", "B", "C"]), words: Object.freeze(["A", "B", "C"]) }),
  // the three pairs, adjacent ones first: (1, 2), (2, 3), (1, 3) and (A, B), (B, C), (A, C)
  pairs: Object.freeze([Object.freeze([0, 1]), Object.freeze([1, 2]), Object.freeze([0, 2])]),
  family: Object.freeze({ kind: "all" }),
  maxProbDigits: 6,
  density: Object.freeze({
    lo: -3, hi: 5, points: 121, height: 140, marginTop: 18, marginBottom: 36, marginLeft: 12, marginRight: 12, labelDy: -6, labelOffset: 30,
    ticks: Object.freeze([-2, 0, 2, 4]), dash: Object.freeze(["5 3", null, "2 3"]),
    // firms 1 and 3 are named beside their curves, outward and lower, so firm 2's name above its peak never meets them
    sideDx: 0.9, nameDx: 4,
  }),
  curve: Object.freeze({
    points: 101, height: 230, marginTop: 22, marginBottom: 36, marginLeft: 40, marginRight: 14,
    yDomain: Object.freeze([0.5, 1]), yTicks: Object.freeze([0.5, 0.6, 0.7, 0.8, 0.9, 1]), xTicks: Object.freeze([0, 0.5, 1, 1.5, 2]),
    dash: Object.freeze([null, "6 3", "2 3"]), strokeWidth: 2, rule: "4 3", dotR: 5, labelDx: 8, thrDx: 26, thrDy: 7, bandLabelMinPx: 70,
    // where each curve's name sits, in ω₂ (x) and px above (−) or below (+) its curve; the flat π_AC is named mid-way
    nameAt: Object.freeze([0.15, 1.85, 1.62]), nameDy: Object.freeze([14, 14, -10]),
  }),
  bars: Object.freeze({ row: 26, marginTop: 22, marginBottom: 36, marginLeft: 92, marginRight: 46, labelOffset: 30, padding: 0.25, rule: "4 3", optimumStroke: 2.5, labelDx: 4, nameDx: -6 }),
  text: Object.freeze({
    viewLegend: "Example",
    viewKrw: "KRW's three firms (normal posteriors)",
    viewFinite: "Three units, a finite law (theory book, chapter 10)",
    omegaSlider: "Middle firm's posterior mean",
    // the hints as parts: each {slot} is a data-num node (firm names carry data-prx-name)
    omegaHint: Object.freeze(["{firm1}", " and ", "{firm3}", " stay at means ", "{omega1}", " and ", "{omega3}", "; every SD is ", "{sd}", "."]),
    tauSlider: "Withholding cost τ",
    tauHint: Object.freeze(["A wrong stated direction costs ", "{one}", "; staying silent on one pair costs τ."]),
    densHeading: "The three posteriors",
    densAlt: "Three normal posterior densities with SD 1: firm A centered at 2, firm C at 0 and firm B at the slider value.",
    densTable: "The three firms' posteriors",
    probHeading: "Direction probabilities as the middle mean moves",
    probAlt: "Lines of the three direction probabilities against ω₂, the dashed line at 1 − τ, the shaded band of ω₂ where the pairwise choices cannot be printed, and the current ω₂ with three dots.",
    probTable: "The three pairs at the current middle mean",
    bandText: "cannot be printed",
    bandNone: "At this τ there is no ω₂ where the pairwise choices fail to print.",
    lineKey: "thin gray dashed line: ",
    lineKeyEnd: "; a pair on its own is stated only above it",
    dotKey: "filled dot: stated on its own; open dot: withheld on its own",
    bandKey: "shaded: ω₂ where no grade report prints the pairwise choices",
    choicesHeading: "Each pair on its own, then the best report we can print",
    lawHeading: "The law: four orders of A, B and C",
    lawTable: "The four orders with their probabilities",
    lawPairsHeading: "Each pair on its own",
    reportsHeading: "All reports of the family, with their risk",
    reportsAlt: "Bars of the risk of every report of the family, smallest first: the error term and the withholding term of each, the best reports outlined, and a dashed line at the cost of the pairwise choices.",
    reportsTable: "Every report of the family at this τ",
    errLegend: "E/M: expected wrong directions per pair",
    whLegend: "τ(M − N)/M: the price of the withheld pairs, per pair",
    relaxedLegend: "dashed line: the pairwise choices, each pair decided alone (not a report)",
    optimumLegend: "outlined: the best reports",
    note: "KRW's Example 1 (three firms with independent normal posteriors) and a finite three-unit law from the postrank theory book, chapter 10. Both are taken as given",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    reports: "reports",
    pairwiseCost: "The pairwise choices, each pair decided alone, cost",
    pairwiseCostShort: "per pair.",
    pairwiseCostEnd: "per pair: no report costs less, since each pair costs at least the smallest of its three action costs.",
    bestPrefix: "Best report we can print",
    tie: "reports share the smallest risk",
    printable: "These choices print as the report",
    printableEnd: ", so the best report states exactly them and its risk equals their cost.",
    printableTied: "Among the equally good choices, one set prints as the report",
    printableTiedEnd: ", so the best report's risk equals the cost of the pairwise choices.",
    // the reason when both adjacent pairs are withheld and the outer one is stated: ⟨u⟩ marks a unit name
    mustBreak: " The best report must state one more direction or withhold one more pair.",
    notPrintableBand: " ⟨0⟩ and ⟨1⟩ would share a grade, and so would ⟨1⟩ and ⟨2⟩, so ⟨0⟩ and ⟨2⟩ would share one too, yet we would state ⟨0⟩ above ⟨2⟩. The best report must state one more direction or withhold one more pair.",
    notPrintable: "No grade report prints these choices.",
    overNone: "No direction the best report states has an error above τ.",
    riskAxis: "expected loss per pair (risk)",
  }),
});

const N_UNITS = 3;
const M = pairCount(N_UNITS);
const T = CONFIG.text;
const K = CONFIG.krw;
const L = THREE_UNIT_LAW;

// ---------------------------------------------------------------------------------------------- engine inputs

const REPORTS = Array.from(enumerateReports(N_UNITS, CONFIG.family), (g) => Array.from(g));
const REPORT_RELATIONS = REPORTS.map((g) => relations(g));
const LAW = THREE_UNIT_ERRORS;
const e0 = LAW.e[0];
export const krwMeans = (omega2) => [K.omega1, omega2, K.omega3];
const krwErrors = (omega2) => errorArray(krwMeans(omega2), [K.sd, K.sd, K.sd], { ids: K.names.slice() });
const ACTION = Object.freeze({ up: "iAboveJ", down: "jAboveI", withhold: "withhold" });

/** Each pair on its own: the best actions of pairDecision (all actions within its tolerance of the minimum). */
export function pairChoices(E, tau) {
  const e = E.e[0];
  return CONFIG.pairs.map(([i, j]) => {
    const d = pairDecision(e[i][j], e[j][i], tau);
    return { i, j, e: e[i][j], eRev: e[j][i], pi: 1 - e[i][j], best: d.best, costs: d.costs };
  });
}

/** The reports of 𝒜₃ whose relations agree with one best action of every pair (several when actions tie). */
export function printingReports(choices) {
  const want = (c, rel) => (rel === 1 ? c.best.includes(ACTION.up) : rel === -1 ? c.best.includes(ACTION.down) : c.best.includes(ACTION.withhold));
  return REPORTS.filter((g, r) => choices.every((c) => want(c, REPORT_RELATIONS[r][c.i][c.j])));
}

/** The KRW-band pattern: both adjacent pairs withheld, the outer pair stated (the only one that fails on [0, 2]). */
const bandPattern = (choices) => choices[0].best.length === 1 && choices[0].best[0] === ACTION.withhold
  && choices[1].best.length === 1 && choices[1].best[0] === ACTION.withhold
  && choices[2].best.length === 1 && choices[2].best[0] === ACTION.up;

/** The units of each grade, grade 1 first. */
function blocksOf(grade) {
  const G = Math.max(...grade);
  const out = [];
  for (let k = 1; k <= G; k += 1) out.push(grade.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0));
  return out;
}

/** "{A, B} > {C}" (letters only, so it is plain text). */
const lawBlocksText = (grade) => blocksOf(grade).map((b) => `{${b.map((i) => L.ids[i]).join(", ")}}`).join(" > ");

/** A direction probability with enough digits to tell it from the line 1 − τ (".79996" against ".80", not ".800"). */
export function probDigits(p, thr) {
  let d = 3;
  while (d < CONFIG.maxProbDigits && Math.abs(p - thr) > 0 && formatProb(p, { digits: d }) === formatProb(thr, { digits: d })) d += 1;
  return d;
}

/** A rational display when the value is one (the finite law at τ on the slider grid), else the risk format. */
function exact(v) {
  try { return formatRational(v); } catch { return formatRisk(v); }
}

// ---------------------------------------------------------------------------------------------- widget

/** Whether a state is the first question's setting (view, ω₂ and τ). */


export function mountCoherence(el, spec = {}, mode = "krw") {
  const finite = mode === "finite";
  return createWidget(el, spec, {
    name: finite ? "coherence-finite" : CONFIG.name,
    label: finite ? "All thirteen reports of the three-unit finite law" : CONFIG.label,
    title: finite ? "Thirteen reports for three units" : CONFIG.title,
    className: "prx-coh",
    css: COHERENCE_CSS,
    keys: {
      ...(finite ? {} : { omega2: { type: "number", ...CONFIG.omega2 } }),
      tau: { type: "number", ...CONFIG.tau },
    },
    build(ctx) {
      const { h } = ctx;
      const fmtOmega = (v) => formatDecimal(v, { digits: CONFIG.omega2.digits });

      // --- small node helpers: numbers with data-num, unit names with data-prx-name
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const one = () => ctx.num(1, formatCount(1));
      const firm = (i) => h("span", { "data-prx-name": "", text: `firm ${K.names[i]}` });
      const firmName = (i) => h("span", { "data-prx-name": "", text: K.names[i] });
      const unit = (kind, i, cap = false) => (kind === "krw" ? (cap ? h("span", { "data-prx-name": "", text: `Firm ${K.names[i]}` }) : firm(i)) : L.ids[i]);
      const piName = (i, j) => h("span", { class: "prx-coh-sym" }, "π", h("sub", {}, h("span", { "data-prx-name": "", text: `${K.names[i]}${K.names[j]}` })));
      const eName = (i, j) => h("span", { class: "prx-coh-sym" }, "e", h("sub", {}, `${L.ids[i]}${L.ids[j]}`));
      const tauNode = (tau) => ctx.num(tau, formatSetting(tau));
      const oneMinusTau = (tau) => [one(), " − τ = ", ctx.num(1 - tau, formatSetting(1 - tau))];
      // blocks with braces for the eye, words for screen readers ("firms 1 and 2, then firm 3")
      const blocksNodes = (kind, grade) => {
        const bl = blocksOf(grade);
        const eye = h("span", { "aria-hidden": "true" });
        bl.forEach((b, k) => {
          if (k) eye.append(" > ");
          eye.append("{");
          b.forEach((i, m) => { if (m) eye.append(", "); eye.append(kind === "krw" ? firmName(i) : L.ids[i]); });
          eye.append("}");
        });
        const ear = h("span", { class: "prx-sr-only" });
        bl.forEach((b, k) => {
          if (k) ear.append(", then ");
          if (kind === "krw") ear.append(b.length > 1 ? "firms " : "firm ");
          b.forEach((i, m) => { if (m) ear.append(m === b.length - 1 ? " and " : ", "); ear.append(kind === "krw" ? firmName(i) : L.ids[i]); });
        });
        return [eye, ear];
      };
      const gradeNum = (g) => ctx.num(Array.from(g), formatGrades(Array.from(g)));

      // --- controls: the view, ω₂ (KRW view only) and τ
      const omega = ctx.slider({
        label: T.omegaSlider, min: CONFIG.omega2.min, max: CONFIG.omega2.max, step: CONFIG.omega2.step, value: ctx.state.omega2,
        name: "omega2", hint: T.omegaHint.join(""), format: fmtOmega, onInput: (v) => ctx.set({ omega2: v }),
      });
      const fillParts = (parts, slots) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slots[m[1]]() : p; });
      omega.root.querySelector(".prx-hint")?.replaceChildren(...fillParts(T.omegaHint, {
        firm1: () => unit("krw", 0, true), firm3: () => firm(2),
        omega1: () => ctx.num(K.omega1, formatCount(K.omega1)), omega3: () => ctx.num(K.omega3, formatCount(K.omega3)),
        sd: () => ctx.num(K.sd, formatCount(K.sd)),
      }));
      const tau = ctx.slider({
        label: T.tauSlider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.tauHint.join(""), onInput: (v) => ctx.set({ tau: v }),
      });
      tau.root.querySelector(".prx-hint")?.replaceChildren(...fillParts(T.tauHint, { one }));
      ctx.controls.append(...(finite ? [] : [omega.root]), tau.root);

      ctx.controls.after(ctx.readout.node);

      // --- KRW view
      const densSlot = h("div", { class: "prx-coh-chart" });
      const densBox = h("section", { class: "prx-coh-panel", "aria-label": T.densHeading, "data-prx-part": "chart" },
        h("h4", { class: "prx-coh-heading", text: T.densHeading }), densSlot);
      const curveSlot = h("div", { class: "prx-coh-chart" });
      const curveLegend = h("div", { class: "prx-coh-legend", "data-prx-part": "legend" });
      const curveFormula = h("div", { class: "prx-coh-formula", "data-prx-part": "readout" });
      const fCurve = ["pi12", "pi23"].map((name) => h("div", { class: "prx-coh-formula-line", "data-prx-tex": name }));
      curveFormula.append(...fCurve);
      const curveBox = h("section", { class: "prx-coh-panel", "aria-label": T.probHeading, "data-prx-part": "chart" },
        h("h4", { class: "prx-coh-heading", text: T.probHeading }), curveSlot, curveLegend, curveFormula);
      const krwChoices = h("div", { class: "prx-coh-choices", "data-prx-part": "readout" });
      const krwChoicesBox = h("section", { class: "prx-coh-panel", "aria-label": T.choicesHeading },
        h("h4", { class: "prx-coh-heading", text: T.choicesHeading }), krwChoices);
      const krwAnswer = h("div", { class: "prx-coh-grid" }, curveBox, krwChoicesBox);
      const krwView = h("div", { class: "prx-coh-view-krw" }, densBox, krwAnswer);

      // --- finite view
      const lawTableSlot = h("div", { class: "prx-coh-law", "data-prx-part": "readout" });
      const lawBox = h("section", { class: "prx-coh-panel", "aria-label": T.lawHeading },
        h("h4", { class: "prx-coh-heading", text: T.lawHeading }), lawTableSlot);
      const lawChoices = h("div", { class: "prx-coh-choices", "data-prx-part": "readout" });
      const lawFormula = h("div", { class: "prx-coh-formula", "data-prx-part": "readout" });
      const fLaw = ["symbols", "numbers"].map((name) => h("div", { class: "prx-coh-formula-line", "data-prx-tex": `law-${name}` }));
      lawFormula.append(h("p", { class: "prx-coh-note" }, "M = ", ro("law-pair-count", M, formatCount(M)), " possible unordered pairs; N counts stated pairs in a report; E is its expected number of wrong directions."), ...fLaw);
      const lawChoicesBox = h("section", { class: "prx-coh-panel", "aria-label": T.lawPairsHeading },
        h("h4", { class: "prx-coh-heading", text: T.lawPairsHeading }), lawChoices, lawFormula);
      const lawLabel = h("p", { class: "prx-coh-label", "data-prx-part": "readout" });
      const barsSlot = h("div", { class: "prx-coh-chart" });
      const barsLegend = h("div", { class: "prx-coh-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch", style: { background: "var(--prx-err)" } }), T.errLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch", style: { background: "var(--prx-wh)" } }), T.whLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-rule" }), T.relaxedLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-outline" }), T.optimumLegend));
      const lawOver = h("div", { class: "prx-coh-choices", "data-prx-part": "readout" });
      const reportsBox = h("section", { class: "prx-coh-panel prx-coh-reports", "aria-label": T.reportsHeading },
        h("h4", { class: "prx-coh-heading", text: T.reportsHeading }), lawLabel, barsSlot, barsLegend, lawOver);
      const finiteView = h("div", { class: "prx-coh-view-finite" },
        h("div", { class: "prx-coh-grid" }, lawBox, lawChoicesBox), reportsBox);

      ctx.charts.append(finite ? finiteView : krwView);
      ctx.caption.replaceChildren(
        finite ? "Three-unit finite law from the postrank theory book, chapter 10. "
          : "Independent normal posteriors. A, B and C label KRW’s first, second and third firms; KRW write the middle mean ω₂. ",
        captionNode(ctx, "teaching-posterior"), ". Every report of the family is evaluated in this browser.");

      // ------------------------------------------------------------------------------------- drawing: KRW view

      function drawDensities(state) {
        const D = CONFIG.density;
        const means = krwMeans(state.omega2);
        const xs = Array.from({ length: D.points }, (_, k) => D.lo + ((D.hi - D.lo) * k) / (D.points - 1));
        const rows = [];
        means.forEach((m, i) => { for (const x of xs) rows.push({ i, x, y: normalPdf((x - m) / K.sd) / K.sd }); });
        const peaks = means.map((m, i) => ({ i, x: m, y: normalPdf(0) / K.sd }));
        const top = normalPdf(0) / K.sd;
        const nameRow = (i) => (i === 1
          ? { x: means[i], y: top, anchor: "middle", dy: D.labelDy, dx: 0 }
          : { x: means[i] + (i === 0 ? D.sideDx : -D.sideDx), y: normalPdf(D.sideDx) / K.sd, anchor: i === 0 ? "start" : "end", dy: 0, dx: i === 0 ? D.nameDx : -D.nameDx });
        plot(densSlot, {
          alt: T.densAlt,
          keyboard: { data: peaks, x: "x", y: "y", sort: false, label: T.densHeading,
            title: d => `Firm ${K.names[d.i]}: posterior mean ${fmtOmega(d.x)}, posterior SD ${formatCount(K.sd)}.` },
          table: {
            caption: T.densTable,
            columns: [
              { label: "Firm", value: (d) => `firm ${K.words[d.i]}` },
              { label: "Posterior mean", value: "x", format: (v) => fmtOmega(v) },
              { label: "Posterior SD", value: () => K.sd, format: (v) => formatCount(v) },
            ],
            rows: peaks,
          },
          height: D.height, marginTop: D.marginTop, marginBottom: D.marginBottom, marginLeft: D.marginLeft, marginRight: D.marginRight,
          x: { domain: [D.lo, D.hi], ticks: D.ticks.slice(), label: "true value θ", labelAnchor: "center", labelArrow: "none", labelOffset: D.labelOffset },
          y: { axis: null, domain: [0, top] },
          marks: (c, P) => [
            ...[0, 1, 2].map((i) => P.line(rows.filter((d) => d.i === i), { x: "x", y: "y", stroke: c.post, strokeWidth: 2, strokeDasharray: D.dash[i] ?? undefined })),
            // one mark per name (anchor and offsets are constants in Plot); names with digits carry data-prx-name
            ...[0, 1, 2].map((i) => {
              const d = nameRow(i);
              return P.text([d], {
                x: "x", y: "y", dy: d.dy, dx: d.dx, textAnchor: d.anchor, lineAnchor: "bottom", text: () => `firm ${K.names[i]}`,
                fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke",
                render(index, scales, values, dims, context, next) {
                  const g = next(index, scales, values, dims, context);
                  for (const t of g?.querySelectorAll ? g.querySelectorAll("text") : []) t.setAttribute("data-prx-name", "");
                  return g;
                },
              });
            }),
          ],
        });
      }

      function drawCurves(state, band, choices) {
        const C = CONFIG.curve;
        const lo = CONFIG.omega2.min;
        const hi = CONFIG.omega2.max;
        const thr = 1 - state.tau;
        const grid = Array.from({ length: C.points }, (_, k) => lo + ((hi - lo) * k) / (C.points - 1));
        const p13 = pairDirection(K.omega1, K.sd, K.omega3, K.sd);
        const lines = [
          grid.map((w) => ({ w, p: pairDirection(K.omega1, K.sd, w, K.sd) })),
          grid.map((w) => ({ w, p: pairDirection(w, K.sd, K.omega3, K.sd) })),
          grid.map((w) => ({ w, p: p13 })),
        ];
        const names = ["π_AB", "π_BC", "π_AC"];
        const nameRows = names.map((n, k) => {
          const w = C.nameAt[k];
          const p = k === 0 ? pairDirection(K.omega1, K.sd, w, K.sd) : k === 1 ? pairDirection(w, K.sd, K.omega3, K.sd) : p13;
          return { k, w, p, n };
        });
        const dots = choices.map((c, k) => ({ k, w: state.omega2, p: c.pi, stated: c.best.includes(ACTION.up), c }));
        const width = Math.max(1, Math.round(curveSlot.clientWidth || ctx.width()));
        const inner = Math.max(1, width - C.marginLeft - C.marginRight);
        const bandRow = band.empty ? [] : [{ x1: Math.max(lo, band.lower), x2: Math.min(hi, band.upper) }].filter((b) => b.x2 > b.x1);
        const bandLabel = bandRow.filter((b) => ((b.x2 - b.x1) / (hi - lo)) * inner >= C.bandLabelMinPx);
        const rowWords = (c) => `firms ${K.words[c.i]} and ${K.words[c.j]}`;
        const decision = (c) => (c.best.length > 1 ? "two or more actions equally good" : c.best[0] === ACTION.up ? `state firm ${K.words[c.i]} above firm ${K.words[c.j]}` : c.best[0] === ACTION.down ? `state firm ${K.words[c.j]} above firm ${K.words[c.i]}` : "withhold");
        plot(curveSlot, {
          alt: T.probAlt,
          table: {
            caption: T.probTable,
            columns: [
              { label: "Pair", value: (d) => rowWords(d.c) },
              { label: "Direction probability", value: "p", format: (v) => formatProb(v, { digits: probDigits(v, thr) }) },
              { label: "On its own", value: (d) => decision(d.c) },
            ],
            rows: dots,
          },
          width,
          height: C.height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [lo, hi], ticks: C.xTicks.slice(), label: "Middle posterior mean", labelAnchor: "center", labelArrow: "none" },
          y: { domain: C.yDomain.slice(), ticks: C.yTicks.slice(), label: null },
          color: { type: "identity" },
          marks: (c, P) => [
            P.rect(bandRow, { x1: "x1", x2: "x2", y1: C.yDomain[0], y2: C.yDomain[1], fill: c.plotGrid }),
            P.text(bandLabel, { x: (d) => (d.x1 + d.x2) / 2, y: C.yDomain[1], text: () => T.bandText, lineAnchor: "bottom", dy: -4, fill: c.plotFg }),
            P.ruleY([thr], { stroke: c.plotAxis, strokeDasharray: C.rule }),
            numText([thr], { x: lo, y: (d) => d, value: (d) => d, format: (v) => formatSetting(v), dy: -C.thrDy, textAnchor: "start", dx: C.thrDx, fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
            ...lines.map((rows, k) => P.line(rows, { x: "w", y: "p", stroke: c.blues[5], strokeWidth: C.strokeWidth, strokeDasharray: C.dash[k] ?? undefined })),
            // one mark per name: Plot's dy is a constant, not a channel
            ...nameRows.map((d) => P.text([d], { x: "w", y: "p", text: "n", dy: C.nameDy[d.k], fill: c.plotFg })),
            P.ruleX([state.omega2], { stroke: c.plotFg, strokeWidth: 1 }),
            P.dot(dots, { x: "w", y: "p", r: C.dotR, fill: (d) => (d.stated ? c.plotFg : c.plotBg), stroke: c.plotFg, strokeWidth: 2 }),
            numText(dots, { x: "w", y: "p", value: "p", format: (v) => formatProb(v, { digits: probDigits(v, thr) }), dx: state.omega2 > (lo + hi) / 2 ? -C.labelDx : C.labelDx, textAnchor: state.omega2 > (lo + hi) / 2 ? "end" : "start", fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
          ],
          keyboard: {
            data: dots, x: "w", y: "p", sort: false, label: T.probHeading,
            title: (d) => `${names[d.k]} = ${formatProb(d.p, { digits: probDigits(d.p, thr) })} at ω₂ = ${fmtOmega(d.w)}: ${d.p > thr ? "above" : "not above"} 1 − τ = ${formatSetting(thr)}, so on its own we ${decision(d.c)}.`,
          },
        });
        curveLegend.replaceChildren(
          h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-rule" }), h("span", {}, T.lineKey, ...oneMinusTau(state.tau), T.lineKeyEnd)),
          h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-dot" }), T.dotKey),
          band.empty
            ? h("span", { class: "prx-coh-key" }, T.bandNone)
            : h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-band" }),
              h("span", {}, T.bandKey, ", ω₂ from ", ro("bandLower", band.lower, formatDecimal(band.lower, { digits: 3 })), " to ",
                ro("bandUpper", band.upper, formatDecimal(band.upper, { digits: 3 })))),
        );
        // the live formulas π_AB = Φ((ω₁ − ω₂)/√2) and π_BC = Φ((ω₂ − ω₃)/√2), numbers put in
        const tex = (k) => {
          const f = formulaNums();
          const [i, j] = CONFIG.pairs[k];
          const means = krwMeans(state.omega2);
          const show = (u) => (u === 1 ? fmtOmega(means[u]) : formatCount(means[u]));
          // the numbers are made in the order they appear, so each <mtext> gets its own raw value
          let s = `\\pi_{${K.names[i]}${K.names[j]}} = \\Phi\\!\\left(\\frac{\\omega_${K.names[i]}-\\omega_${K.names[j]}}{\\sqrt{${f.num(2, "2")}}}\\right)`;
          s += ` = \\Phi\\!\\left(\\frac{${f.num(means[i], show(i))}-${f.num(means[j], show(j))}}{\\sqrt{${f.num(2, "2")}}}\\right)`;
          s += ` = ${f.num(choices[k].pi, formatProb(choices[k].pi, { digits: probDigits(choices[k].pi, 1 - state.tau) }))}`;
          renderTex(fCurve[k], s, { display: true, nums: f.raws });
        };
        tex(0);
        tex(1);
      }

      function choiceLines(kind, choices, tau) {
        return choices.map((c) => {
          const tied = c.best.length > 1;
          const up = c.best.includes(ACTION.up);
          if (kind === "krw") {
            const shown = formatProb(c.pi, { digits: probDigits(c.pi, 1 - tau) });
            const head = [piName(c.i, c.j), " = ", ro(`pi${c.i + 1}${c.j + 1}`, c.pi, shown)];
            if (tied) return h("li", {}, ...head, " equals ", ...oneMinusTau(tau), c.best.length === 3 ? ": all three actions on this pair are equally good." : [": stating ", firm(c.i), " above ", firm(c.j), " and withholding the pair are equally good."]);
            return up
              ? h("li", {}, ...head, " is above ", ...oneMinusTau(tau), ": on its own we state ", firm(c.i), " above ", firm(c.j), ".")
              : h("li", {}, ...head, " is not above ", ...oneMinusTau(tau), ": on its own we withhold ", firm(c.i), " versus ", firm(c.j), ".");
          }
          const head = [eName(c.i, c.j), " = ", ctx.num(c.e, exact(c.e))];
          if (tied) return h("li", {}, ...head, " equals τ = ", tauNode(tau), c.best.length === 3 ? ": all three actions on this pair are equally good." : `: stating ${L.ids[c.i]} above ${L.ids[c.j]} and withholding the pair are equally good.`);
          return up
            ? h("li", {}, ...head, " is below τ = ", tauNode(tau), `: on its own we state ${L.ids[c.i]} above ${L.ids[c.j]}.`)
            : h("li", {}, ...head, " is not below τ = ", tauNode(tau), `: on its own we withhold ${L.ids[c.i]} versus ${L.ids[c.j]}.`);
        });
      }

      function togetherLine(kind, choices, printing, brief = false) {
        if (printing.length) {
          const g = printing[0];
          const tied = choices.some((c) => c.best.length > 1);
          return h("p", { class: "prx-coh-together", "data-prx-coh": "printable" }, tied ? `${T.printableTied} ` : `${T.printable} `, ...blocksNodes(kind, g), " (", gradeNum(g), ")", tied ? T.printableTiedEnd : T.printableEnd);
        }
        const content = bandPattern(choices)
          ? T.notPrintableBand.split(/⟨(\d)⟩/).map((part, k) => (k % 2 ? unit(kind, Number(part), k === 1) : part))
          : [];
        if (brief && content.length) content.splice(-1, 1, content.at(-1).replace(T.mustBreak, ""));
        return h("p", { class: "prx-coh-together prx-coh-impossible", "data-prx-coh": "printable" }, h("strong", {}, T.notPrintable), ...content);
      }

      function bestLines(kind, opt, E, tau) {
        const optima = opt.grades.map((g) => Array.from(g));
        const lines = [];
        const first = [h("strong", {}, `${T.bestPrefix}: `), ...optima.flatMap((g, k) => [k ? " or " : "", ...blocksNodes(kind, g), " (", ro(`optimum${k}`, g, formatGrades(g)), ")"]),
          ", risk ", ro("optRisk", opt.risk, kind === "krw" ? formatRisk(opt.risk) : exact(opt.risk)), "."];
        lines.push(h("p", {}, ...first));
        const label = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) label.push("; ", ro("tieCount", opt.tieCount, formatCount(opt.tieCount)), ` ${T.tie}`);
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        lines.push(h("p", { class: "prx-coh-label" }, ...label));
        const over = optima.map((g) => ({ g, s: statedAbove(g, E, { tau }) }));
        if (over.every((o) => o.s.count === 0)) lines.push(h("p", {}, T.overNone));
        else {
          for (const [k, o] of over.entries()) {
            if (!o.s.count) continue;
            const items = o.s.pairs.flatMap((p, m) => [m ? "; " : "", unit(kind, p.i), " above ", unit(kind, p.j), ", whose error ",
              ro(`over${k}.${m}`, p.error, kind === "krw" ? formatProb(p.error, { digits: probDigits(p.error, tau) }) : exact(p.error)), " is above τ = ", tauNode(tau)]);
            lines.push(h("p", {}, ...blocksNodes(kind, o.g), " states ", ...items, "."));
          }
        }
        return lines;
      }

      function drawKrwChoices(state, E, choices, printing, opt, relaxed) {
        const list = h("ul", { class: "prx-coh-list" }, ...choiceLines("krw", choices, state.tau));
        krwChoices.replaceChildren(list, togetherLine("krw", choices, printing),
          h("p", {}, `${T.pairwiseCost} `, ro("relaxed", relaxed, formatRisk(relaxed)), ` ${T.pairwiseCostEnd}`),
          ...bestLines("krw", opt, E, state.tau));
      }

      // ------------------------------------------------------------------------------------- drawing: finite view

      function drawLaw() {
        const rows = L.orders.map((o, s) => h("tr", {}, h("th", { scope: "row", text: o.split("").join(" > ") }), h("td", {}, ctx.num(L.probs[s], exact(L.probs[s])))));
        const table = h("table", { class: "prx-coh-table" },
          h("caption", { text: T.lawTable }),
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Order, highest first" }), h("th", { scope: "col", text: "Probability" }))),
          h("tbody", {}, ...rows));
        const theta = (k) => h("span", { class: "prx-coh-sym" }, "θ", h("sub", {}, L.ids[k]));
        const pis = CONFIG.pairs.map(([i, j]) => h("li", {}, "Pr(", theta(i), " > ", theta(j), " ∣ Y) = ", ctx.num(LAW.pi[0][i][j], exact(LAW.pi[0][i][j])),
          ", so ", eName(i, j), " = ", ctx.num(e0[i][j], exact(e0[i][j]))));
        lawTableSlot.replaceChildren(table, h("ul", { class: "prx-coh-list" }, ...pis));
      }

      function drawLawChoices(state, choices, printing, relaxed) {
        lawChoices.replaceChildren(h("ul", { class: "prx-coh-list" }, ...choiceLines("finite", choices, state.tau)), togetherLine("finite", choices, printing),
          h("p", {}, `${T.pairwiseCost} `, ro("relaxed", relaxed, exact(relaxed)), ` ${T.pairwiseCostEnd}`));
        const f = formulaNums();
        renderTex(fLaw[0], `\\frac{${f.num(1, "1")}}{M}\\sum_{i<j}\\min(e_{ij},\\,e_{ji},\\,\\tau)`, { display: true, nums: f.raws });
        const g = formulaNums();
        const parts = choices.map((c) => {
          const m = Math.min(c.e, c.eRev, state.tau);
          return g.num(m, exact(m));
        });
        renderTex(fLaw[1], `= \\frac{${parts.join(" + ")}}{${g.num(M, formatCount(M))}} = ${g.num(relaxed, exact(relaxed))}`, { display: true, nums: g.raws });
      }

      function drawReports(state, opt, relaxed) {
        const B = CONFIG.bars;
        const best = new Set(opt.grades.map((g) => Array.from(g).join("")));
        const rows = REPORTS.map((g, r) => {
          const ev = evaluateReport(g, LAW, { tau: state.tau });
          const over = statedAbove(g, LAW, { tau: state.tau });
          return { r, g, key: g.join(""), name: lawBlocksText(g), err: ev.errorTerm, wh: ev.withholdingTerm, risk: ev.risk, N: ev.N, E: ev.Ew, over, best: best.has(g.join("")) };
        });
        // smallest risk first; risks within the equal-risk tolerance keep the family's order
        rows.sort((a, b) => (Math.abs(a.risk - b.risk) <= opt.tieTol ? a.r - b.r : a.risk - b.risk));
        const segs = rows.flatMap((d) => [
          { key: d.key, part: "err", x1: 0, x2: d.err },
          { key: d.key, part: "wh", x1: d.err, x2: d.err + d.wh },
        ]).filter((s) => s.x2 > s.x1);
        const top = Math.max(...rows.map((d) => d.risk));
        plot(barsSlot, {
          alt: T.reportsAlt,
          table: {
            caption: T.reportsTable,
            columns: [
              { label: "Report", value: (d) => d.g, format: (v) => formatGrades(v) },
              { label: "Blocks", value: "name" },
              { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v) },
              { label: "Expected wrong directions, E", value: "E", format: (v) => exact(v) },
              { label: "Risk", value: "risk", format: (v) => exact(v) },
              { label: "Stated with an error above τ", value: (d) => (d.over.count ? d.over.pairs.map((p) => `${L.ids[p.i]} above ${L.ids[p.j]}`).join("; ") : "none") },
              { label: "Best report", value: (d) => (d.best ? "yes" : "no") },
            ],
            rows,
          },
          height: B.marginTop + B.marginBottom + rows.length * B.row,
          marginTop: B.marginTop, marginBottom: B.marginBottom, marginLeft: B.marginLeft, marginRight: B.marginRight,
          x: { domain: [0, top], label: T.riskAxis, labelAnchor: "center", labelArrow: "none", labelOffset: B.labelOffset },
          y: { domain: rows.map((d) => d.key), axis: null, padding: B.padding },
          color: { type: "identity" },
          marks: (c, P) => [
            P.barX(segs, { x1: "x1", x2: "x2", y: "key", fill: (d) => (d.part === "err" ? c.err : c.wh) }),
            P.barX(rows.filter((d) => d.best), { x1: 0, x2: "risk", y: "key", fill: "none", stroke: c.plotFg, strokeWidth: B.optimumStroke }),
            P.text(rows, { x: 0, y: "key", text: "name", dx: B.nameDx, textAnchor: "end", fill: c.plotFg, fontWeight: (d) => (d.best ? "bold" : "normal") }),
            numText(rows, { x: "risk", y: "key", value: "risk", format: (v) => exact(v), dx: B.labelDx, textAnchor: "start", fill: c.plotFg, fontWeight: (d) => (d.best ? "bold" : "normal") }),
            P.ruleX([relaxed], { stroke: c.plotAxis, strokeDasharray: B.rule, strokeWidth: 2 }),
            numText([relaxed], { x: (d) => d, frameAnchor: "top", value: (d) => d, format: (v) => exact(v), dy: -B.marginTop / 2, fill: c.plotFg }),
          ],
          keyboard: {
            data: rows, x: "risk", y: "key", sort: false, label: T.reportsHeading,
            title: (d) => `${d.name} (${formatGrades(d.g)}): risk ${exact(d.risk)}, ${formatCount(d.N)} pairs stated${d.over.count ? `, states ${d.over.pairs.map((p) => `${L.ids[p.i]} above ${L.ids[p.j]}`).join(" and ")} with an error above τ` : ""}${d.best ? "; a best report" : ""}.`,
          },
        });
        const label = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) label.push("; ", ro("tieCount", opt.tieCount, formatCount(opt.tieCount)), ` ${T.tie}`);
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        lawLabel.replaceChildren(...label);
        const optima = opt.grades.map((g) => Array.from(g));
        const lines = [h("p", {}, h("strong", {}, `${T.bestPrefix}: `), ...optima.flatMap((g, k) => [k ? " or " : "", ...blocksNodes("finite", g), " (", ro(`optimum${k}`, g, formatGrades(g)), ")"]),
          ", risk ", ro("optRisk", opt.risk, exact(opt.risk)), ", against ", ctx.num(relaxed, exact(relaxed)), " for the pairwise choices.")];
        const over = optima.map((g) => ({ g, s: statedAbove(g, LAW, { tau: state.tau }) }));
        if (over.every((o) => o.s.count === 0)) lines.push(h("p", {}, T.overNone));
        for (const [k, o] of over.entries()) {
          if (!o.s.count) continue;
          const items = o.s.pairs.flatMap((p, m) => [m ? "; " : "", `${L.ids[p.i]} above ${L.ids[p.j]}, whose error `, ro(`over${k}.${m}`, p.error, exact(p.error)), " is above τ = ", tauNode(state.tau)]);
          lines.push(h("p", {}, ...blocksNodes("finite", o.g), " states ", ...items, "."));
        }
        lawOver.replaceChildren(...lines);
      }

      // ------------------------------------------------------------------------------------- the read-out line

      function headline(state, parts) {
        const at = state.view === "krw"
          ? ["Middle mean = ", ctx.num(state.omega2, fmtOmega(state.omega2)), ", τ = ", tauNode(state.tau)]
          : ["Three-unit law, τ = ", tauNode(state.tau)];
        ctx.readout.set([...at, ": ", ...parts]);
      }

      function statedWords(kind, choices) {
        const stated = choices.filter((c) => c.best.length === 1 && c.best[0] !== ACTION.withhold);
        const tied = choices.filter((c) => c.best.length > 1).length;
        const rest = M - stated.length - tied;
        if (!stated.length) return [tied ? "deciding each pair on its own, no pair has one best action that states a direction" : "deciding each pair on its own, we withhold every pair"];
        const words = stated.flatMap((c, k) => {
          const [a, b] = c.best[0] === ACTION.up ? [c.i, c.j] : [c.j, c.i];
          return [k ? (k === stated.length - 1 ? " and " : ", ") : "", unit(kind, a), " above ", unit(kind, b)];
        });
        if (stated.length === M) return ["deciding each pair on its own, we state every pair: ", ...words];
        const tail = [];
        if (rest) tail.push(rest > 1 ? ", and withhold the other pairs" : ", and withhold the other pair");
        if (tied) tail.push(tied > 1 ? "; on the other pairs two or more actions are equally good" : "; on the other pair two or more actions are equally good");
        return [stated.length === 1 ? "deciding each pair on its own, we state only " : "deciding each pair on its own, we state ", ...words, ...tail];
      }

      // ------------------------------------------------------------------------------------- render

      return {
        render(raw) {
          const state = { ...raw, view: mode, omega2: raw.omega2 ?? CONFIG.omega2.value };
          ctx.root.setAttribute("aria-busy", "true");
          try {
            omega.set(state.omega2);
            tau.set(state.tau);
            if (!finite) {
              const E = krwErrors(state.omega2);
              const choices = pairChoices(E, state.tau);
              const printing = printingReports(choices);
              const opt = exactOptimum(E, { tau: state.tau, family: CONFIG.family });
              const relaxed = relaxedPairRisk(E, { tau: state.tau });
              drawDensities(state);
              drawCurves(state, krwExample1Band(state.tau), choices);
              drawKrwChoices(state, E, choices, printing, opt, relaxed, false);
              headline(state, [...statedWords("krw", choices), printing.length ? "; a grade report prints these choices" : "; no grade report prints these choices",
                ". Best report we can print: risk ", ctx.num(opt.risk, formatRisk(opt.risk)), " (the pairwise choices cost ", ctx.num(relaxed, formatRisk(relaxed)), ")."]);
            } else {
              const choices = pairChoices(LAW, state.tau);
              const printing = printingReports(choices);
              const relaxed = relaxedPairRisk(LAW, { tau: state.tau });
              const opt = exactOptimum(LAW, { tau: state.tau, family: CONFIG.family });
              drawLaw();
              drawLawChoices(state, choices, printing, relaxed, false);
              drawReports(state, opt, relaxed);
              headline(state, [...statedWords("finite", choices), printing.length ? "; a grade report prints these choices, at a cost of " : "; no grade report prints these choices, which cost ",
                ctx.num(relaxed, exact(relaxed)), " per pair. Best report we can print: risk ", ctx.num(opt.risk, exact(opt.risk)), "."]);
            }
          } finally { ctx.root.removeAttribute("aria-busy"); }
        },
      };
    },
  });
}

export function mountWidget(el, spec = {}) { return mountCoherence(el, spec, "krw"); }
