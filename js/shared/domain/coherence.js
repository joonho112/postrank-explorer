// G-04: full linked views, exposed as two frame: "v2" apps (2.6 coherence and 2.7 coherence-finite).
import { createWidget } from "../base.js";
import { numText, placeDirectLabels, plot } from "../chart.js";
import {
  formatCount, formatDecimal, formatDistinguishing, formatGrades, formatProb,
  formatRational, formatReadoutEst, formatReadoutProb, formatReadoutRisk, formatRisk, formatSci, formatSetting,
} from "../format.js";
import { captionNode, familySizeNode, labelNode } from "../labels.js";
import { formulaNums, renderTex } from "../math.js";
import { renderDataTable } from "../table.js";
import {
  enumerateReports, errorArray, evaluateReport, exactOptimum, finiteLawPairwise, krwExample1Band, normalPdf, pairDecision,
  pairCount, pairDirection, relaxedPairRisk, relations, statedAbove,
} from "../../pr-core.js";

import { THREE_UNIT_LAW, THREE_UNIT_ERRORS } from "../three-unit-law.js";

export const COHERENCE_CSS = `
/*
 * postrank Explorer · coherence & coherence-finite (catalog 2.6 & 2.7; Frame v2)
 * Primary stage holds one full-width changing graphic + compact legend + 1-line summary strip.
 * Complete exact audit tables, extra-cost curve, unit posteriors, and derivations live in Data and Method disclosures.
 */

.prx-coh.prx-widget[data-prx-frame="v2"] .prx-stage {
  grid-area: auto;
  min-width: 0;
  display: grid;
  gap: 0.45rem;
}

.prx-coh.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  align-items: flex-end;
  flex: 1 1 25rem;
}

.prx-coh-mode-finite.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 0 1 15.5rem;
}

.prx-coh.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
  flex: 1 1 11.5rem;
  max-width: 16rem;
}

@media (max-width: 30em) {
  .prx-coh.prx-widget[data-prx-frame="v2"] {
    padding: 0.45rem 0.55rem 0.4rem;
  }
  .prx-coh.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.45rem;
    margin-bottom: 0.35rem;
  }
  .prx-coh-mode-krw.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.55rem;
    align-items: end;
    flex: 1 1 100%;
  }
  .prx-coh-mode-krw.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
    min-width: 0;
    max-width: none;
  }
  .prx-coh-mode-finite.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex: 1 1 100%;
  }
  .prx-coh-mode-finite.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
    max-width: none;
  }
  .prx-coh .prx-coh-formula {
    font-size: 0.86em;
  }
}

.prx-coh .prx-data-table th,
.prx-coh .prx-data-table td {
  white-space: nowrap;
}

.prx-coh .prx-coh-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-coh .prx-coh-panel {
  min-width: 0;
  margin: 0;
}

.prx-coh .prx-coh-disc-stack {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}

.prx-coh .prx-coh-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-coh .prx-coh-strip {
  margin: 0;
  padding: 0.35rem 0.6rem;
  font-size: 0.88em;
  line-height: 1.4;
  color: var(--prx-fg);
  background: var(--prx-bg-raised);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}

.prx-coh .prx-coh-note,
.prx-coh .prx-coh-hint-copy {
  margin: 0.3rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-coh .prx-coh-label {
  margin: 0.35rem 0 0;
  font-size: 0.92em;
}

.prx-coh .prx-coh-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

/* --- pair choices & transitivity notes --- */
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
  margin: 0;
  padding: 0.45rem 0.65rem;
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
  overflow-y: hidden;
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

/* --- legends (on the plot paper surface) --- */
.prx-coh .prx-coh-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0;
  padding: 0.35rem 0.55rem;
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

.prx-coh .prx-coh-swatch-solid {
  height: 0;
  border: 0;
  border-top: 2px solid var(--prx-plot-fg);
}

.prx-coh .prx-coh-swatch-extra {
  background: var(--prx-neutral-4);
}

.prx-coh .prx-coh-reports {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}
`;

export const CONFIG = Object.freeze({
  name: "coherence",
  label: "Why a report must be coherent: each pair decided alone against the best grade report we can print",
  title: "Decide each pair alone, then print grades?",
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  omega2: Object.freeze({ min: 0, max: 2, step: 0.01, value: 1, digits: 2 }),
  krw: Object.freeze({ omega1: 2, omega3: 0, sd: 1, names: Object.freeze(["A", "B", "C"]), words: Object.freeze(["A", "B", "C"]) }),
  // the three pairs, adjacent ones first: (A, B), (B, C), (A, C)
  pairs: Object.freeze([Object.freeze([0, 1]), Object.freeze([1, 2]), Object.freeze([0, 2])]),
  family: Object.freeze({ kind: "all" }),
  maxProbDigits: 6,
  density: Object.freeze({
    lo: -3, hi: 5, points: 121, height: 152, marginTop: 24, marginBottom: 38, marginLeft: 16, marginRight: 16, labelDy: -6, labelOffset: 32,
    ticks: Object.freeze([-2, 0, 2, 4]), dash: Object.freeze(["5 3", null, "2 3"]),
    sideDx: 0.9, nameDx: 5,
  }),
  curve: Object.freeze({
    points: 101, height: 276, mobileHeight: 248, mobileBreak: 520,
    marginTop: 28, marginBottom: 40, marginLeft: 46, marginRight: 22,
    yDomain: Object.freeze([0.5, 1]), yTicks: Object.freeze([0.5, 0.6, 0.7, 0.8, 0.9, 1]), xTicks: Object.freeze([0, 0.5, 1, 1.5, 2]),
    dash: Object.freeze([null, "6 3", "2 3"]), strokeWidth: 2.25, rule: "4 3", dotR: 5,
    labelDx: 9, minDotGapPx: 16, thrDx: 8, thrDy: 7, bandLabelMinPx: 120,
    nameAt: Object.freeze([0.24, 1.76, 1.56]), nameDy: Object.freeze([15, 15, -11]),
  }),
  bars: Object.freeze({
    row: 25, marginTop: 28, marginBottom: 40, marginLeft: 118, mobileMarginLeft: 112, mobileBreak: 480,
    marginRight: 58, labelOffset: 34, padding: 0.24, rule: "4 3", optimumStroke: 2.5, labelDx: 6, nameDx: -8,
    xTicks: Object.freeze([0, 0.2, 0.4, 0.6, 0.8]),
  }),
  cost: Object.freeze({
    height: 112, marginTop: 8, marginBottom: 34, ticks: 2, labelPx: 20, lowPx: 5, minSpan: 0.008,
    rule: "4 3", dotR: 3.5, labelDx: 7, labelDy: 2, memo: 32,
  }),
  text: Object.freeze({
    viewLegend: "Example",
    viewKrw: "KRW's three firms (normal posteriors)",
    viewFinite: "Three units, a finite law (theory book, chapter 10)",
    omegaSlider: "Middle firm's posterior mean",
    omegaHint: Object.freeze(["{firm1}", " and ", "{firm3}", " stay at means ", "{omega1}", " and ", "{omega3}", "; every SD is ", "{sd}", "."]),
    tauSlider: "Withholding cost τ",
    tauHint: Object.freeze(["A wrong stated direction costs ", "{one}", "; staying silent on one pair costs τ."]),
    krwDataTitle: "Data, extra-cost curve and unit posteriors",
    krwMethodTitle: "Method and transitivity",
    finiteDataTitle: "Data, four-order law and 13 reports",
    finiteMethodTitle: "Method and coherence",
    densHeading: "The three posteriors",
    densAlt: "Three normal posterior densities with SD 1: firm A centered at 2, firm C at 0 and firm B at the slider value.",
    densTable: "The three firms' posteriors",
    probHeading: "Direction probabilities as the middle mean moves",
    probAlt: "Lines of the three direction probabilities against ω₂, the dashed line at 1 − τ, the shaded band of ω₂ where the pairwise choices cannot be printed, and the current ω₂ with three dots.",
    probTable: "The three pairs at the current middle mean",
    bandText: "cannot be printed",
    bandNone: "no incoherent ω₂ band at this τ",
    lineKey: "dashed: ",
    lineKeyEnd: " threshold",
    dotKey: "filled / open dot: stated / withheld alone",
    bandKey: "shaded: incoherent ω₂",
    choicesHeading: "Each pair on its own, then the best report we can print",
    lawHeading: "The law: four orders of A, B and C",
    lawTable: "The four orders with their probabilities",
    lawPairsHeading: "Each pair on its own",
    reportsHeading: "All reports of the family, with their risk",
    reportsAlt: "Bars of the risk of every report of the family, smallest first: the error term and the withholding term of each, the best reports outlined, and a dashed line at the cost of the pairwise choices.",
    reportsTable: "Every report of the family at this τ",
    visibleReportsTable: "All 13 coherent reports sorted by risk",
    errLegend: "E/M: wrong directions",
    whLegend: "τ(M − N)/M: withheld pairs",
    relaxedLegend: "dashed: pairwise choices",
    optimumLegend: "outlined: best reports",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    reports: "reports",
    pairwiseCost: "The pairwise choices, each pair decided alone, cost",
    pairwiseCostEnd: "per pair: no report costs less, since each pair costs at least the smallest of its three action costs.",
    bestPrefix: "Best report we can print",
    tie: "reports share the smallest risk",
    printable: "These choices print as the report",
    printableEnd: ", so the best report states exactly them and its risk equals their cost.",
    printableTied: "Among the equally good choices, one set prints as the report",
    printableTiedEnd: ", so the best report's risk equals the cost of the pairwise choices.",
    mustBreak: " The best report must state one more direction or withhold one more pair.",
    notPrintableBand: " ⟨0⟩ and ⟨1⟩ would share a grade, and so would ⟨1⟩ and ⟨2⟩, so ⟨0⟩ and ⟨2⟩ would share one too, yet we would state ⟨0⟩ above ⟨2⟩. The best report must state one more direction or withhold one more pair.",
    notPrintable: "No grade report prints these choices.",
    overNone: "No direction the best report states has an error above τ.",
    riskAxis: "expected loss per pair (risk)",
    costHeading: "Extra cost of coherence across middle means",
    costAlt: "Strip under the direction probabilities, on the same axis of the middle mean: the risk of the best report we can print (solid line), the cost of the pairwise choices (dashed line), the extra cost of printing shaded between them, and the current middle mean with the extra cost written above it.",
    costLabel: "Cost per pair as the middle mean moves",
    costMark: "extra cost",
    costKeyBest: "solid: best printable report risk",
    costKeyPair: "dashed: isolated pairwise cost",
    costKeyExtra: "shaded: extra cost of coherence",
    formulaHeading: "Direction-probability formulas",
    finiteFormulaHeading: "Pairwise lower-bound formula",
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
const krwBlocksText = (grade) => blocksOf(grade).map((b) => `{${b.map((i) => K.names[i]).join(", ")}}`).join(" > ");

/** A direction probability with enough digits to tell it from the line 1 − τ (".79995" against ".80", not ".800"). */
export function probDigits(p, thr) {
  let d = 3;
  while (d < CONFIG.maxProbDigits && Math.abs(p - thr) > 0 && formatProb(p, { digits: d }) === formatProb(thr, { digits: d })) d += 1;
  return d;
}

/** Exact rational display for Data/chart tables when available, else 4-decimal risk format. */
function exact(v) {
  try { return formatRational(v); } catch { return formatRisk(v); }
}

/** Exact rational display for v2 first-view readout when available, else 3-sig-fig formatReadoutRisk. */
function exactReadout(v) {
  try { return formatRational(v); } catch { return formatReadoutRisk(v); }
}

const costMemo = new Map();
export function costRows(tau) {
  const key = String(tau);
  if (costMemo.has(key)) return costMemo.get(key);
  const lo = CONFIG.omega2.min;
  const hi = CONFIG.omega2.max;
  const n = CONFIG.curve.points;
  const band = krwExample1Band(tau);
  const ws = Array.from({ length: n }, (_, k) => lo + ((hi - lo) * k) / (n - 1));
  if (!band.empty) for (const w of [band.lower, band.upper]) if (w > lo && w < hi) ws.push(w);
  ws.sort((a, b) => a - b);
  const rows = ws.map((w) => {
    const E = krwErrors(w);
    const opt = exactOptimum(E, { tau, family: CONFIG.family });
    const rel = relaxedPairRisk(E, { tau });
    const prints = printingReports(pairChoices(E, tau)).length > 0;
    return { w, opt: opt.risk, rel, extra: prints ? 0 : Math.max(0, opt.risk - rel) };
  });
  if (costMemo.size >= CONFIG.cost.memo) costMemo.delete(costMemo.keys().next().value);
  costMemo.set(key, rows);
  return rows;
}

/** Choose collision-free curve name coordinates in pixel space against dot, dot-label, and threshold-label boxes. */
function chooseCurveNamePositions({ lo, hi, innerW, innerH, marginLeft, marginTop, pAt, obstacles }) {
  const px = (w) => marginLeft + ((w - lo) / (hi - lo)) * innerW;
  const py = (p) => marginTop + ((1 - p) / 0.5) * innerH;
  const pFromPy = (yPx) => 1 - ((yPx - marginTop) / innerH) * 0.5;
  const boxOverlaps = (a, b, pad = 4) =>
    a.left - pad < b.right && a.right + pad > b.left && a.top - pad < b.bottom && a.bottom + pad > b.top;

  const candidatesByCurve = [
    // π_AB: prefer left side where curve is distinct, fallback right-mid
    [0.24, 0.36, 0.48, 0.62, 1.32, 1.48, 1.64],
    // π_BC: prefer right side where curve is distinct, fallback left-mid
    [1.76, 1.64, 1.52, 1.38, 0.68, 0.52, 0.36],
    // π_AC: flat at .921; prefer side farther from active dots
    [1.56, 0.44, 1.34, 0.66, 1.72, 0.28],
  ];
  const names = ["π_AB", "π_BC", "π_AC"];
  const dyPrefs = [
    [15, -13],
    [15, -13],
    [-11, 15],
  ];
  const placedBoxes = [...obstacles];
  return names.map((n, k) => {
    const halfW = 19;
    const halfH = 8;
    let best = null;
    let bestPenalty = Infinity;
    for (const [wIdx, w] of candidatesByCurve[k].entries()) {
      const baseP = pAt(k, w);
      const otherPs = [0, 1, 2].filter((j) => j !== k).map((j) => pAt(j, w));
      for (const [dIdx, dy] of dyPrefs[k].entries()) {
        const yPx = Math.min(marginTop + innerH - 9, Math.max(marginTop + 10, py(baseP) + dy));
        const xPx = px(w);
        const box = { left: xPx - halfW, right: xPx + halfW, top: yPx - halfH, bottom: yPx + halfH };
        const collides = placedBoxes.some((ob) => boxOverlaps(box, ob, 5));
        const curveCrowd = Math.min(...otherPs.map((op) => Math.abs(yPx - py(op))));
        const penalty = (collides ? 10000 : 0) + wIdx * 12 + dIdx * 20 + (curveCrowd < 14 ? (14 - curveCrowd) * 15 : 0);
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          best = { k, w, p: pFromPy(yPx), n, box };
        }
      }
    }
    placedBoxes.push(best.box);
    return { k: best.k, w: best.w, p: best.p, n: best.n };
  });
}

// ---------------------------------------------------------------------------------------------- widget

export function mountCoherence(el, spec = {}, mode = "krw") {
  const finite = mode === "finite";
  return createWidget(el, spec, {
    name: finite ? "coherence-finite" : CONFIG.name,
    label: finite ? "All thirteen reports of the three-unit finite law" : CONFIG.label,
    title: finite ? "Thirteen reports for three units" : CONFIG.title,
    className: `prx-coh ${finite ? "prx-coh-mode-finite" : "prx-coh-mode-krw"}`,
    frame: "v2",
    css: COHERENCE_CSS,
    keys: {
      ...(finite ? {} : { omega2: { type: "number", ...CONFIG.omega2 } }),
      tau: { type: "number", ...CONFIG.tau },
    },
    build(ctx) {
      const { h } = ctx;
      const fmtOmega = (v) => formatDecimal(v, { digits: CONFIG.omega2.digits });

      // --- node helpers: numbers with data-num, unit names with data-prx-name
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
      const fillParts = (parts, slots) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slots[m[1]]() : p; });

      // --- primary controls in ctx.controls (compact; hints relocated to Method keeping aria-describedby intact)
      const omega = finite ? null : ctx.slider({
        label: T.omegaSlider, min: CONFIG.omega2.min, max: CONFIG.omega2.max, step: CONFIG.omega2.step, value: ctx.state.omega2,
        name: "omega2", hint: T.omegaHint.join(""), format: fmtOmega, onInput: (v) => ctx.set({ omega2: v }),
      });
      const omegaHint = omega?.root.querySelector(".prx-hint") ?? null;
      omegaHint?.replaceChildren(...fillParts(T.omegaHint, {
        firm1: () => unit("krw", 0, true), firm3: () => firm(2),
        omega1: () => ctx.num(K.omega1, formatCount(K.omega1)), omega3: () => ctx.num(K.omega3, formatCount(K.omega3)),
        sd: () => ctx.num(K.sd, formatCount(K.sd)),
      }));
      omegaHint?.classList.add("prx-coh-hint-copy");

      const tau = ctx.slider({
        label: T.tauSlider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.tauHint.join(""), onInput: (v) => ctx.set({ tau: v }),
      });
      const tauHint = tau.root.querySelector(".prx-hint");
      tauHint?.replaceChildren(...fillParts(T.tauHint, { one }));
      tauHint?.classList.add("prx-coh-hint-copy");

      if (finite) {
        ctx.controls.append(ctx.primaryControl(tau.root));
      } else {
        ctx.controls.append(ctx.primaryControl(omega.root), tau.root);
      }

      // --- disclosures: Data & Method
      const dataBox = ctx.dataBox(finite ? T.finiteDataTitle : T.krwDataTitle);
      if (finite) {
        dataBox.summary.replaceChildren("Data, four-order law and ", ctx.num(REPORTS.length, formatCount(REPORTS.length)), " reports");
      }
      const methodBox = ctx.methodBox(finite ? T.finiteMethodTitle : T.krwMethodTitle);

      // --- KRW view slots (2.6)
      const curveSlot = h("div", { class: "prx-coh-chart" });
      const curveBox = h("section", { class: "prx-coh-panel", "aria-label": T.probHeading }, curveSlot);
      const curveLegend = h("div", { class: "prx-coh-legend", "data-prx-part": "legend" });
      const krwStrip = h("p", { class: "prx-coh-strip" });
      const krwWitness = h("div", { "data-prx-coherence-witness": "" });

      const costSlot = h("div", { class: "prx-coh-chart prx-coh-cost" });
      const costLegend = h("div", { class: "prx-coh-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-solid", "aria-hidden": "true" }), T.costKeyBest),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-rule", "aria-hidden": "true" }), T.costKeyPair),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-extra", "aria-hidden": "true" }), T.costKeyExtra));
      const costBox = h("section", { class: "prx-coh-panel", "aria-label": T.costHeading },
        h("h4", { class: "prx-coh-heading", text: T.costHeading }), costSlot, costLegend);

      const densSlot = h("div", { class: "prx-coh-chart" });
      const densBox = h("section", { class: "prx-coh-panel", "aria-label": T.densHeading },
        h("h4", { class: "prx-coh-heading", text: T.densHeading }), densSlot);

      const krwChoices = h("div", { class: "prx-coh-choices" });
      const krwChoicesBox = h("section", { class: "prx-coh-panel", "aria-label": T.choicesHeading },
        h("h4", { class: "prx-coh-heading", text: T.choicesHeading }), krwChoices);

      const krwVerdict = h("div", { class: "prx-coh-choices prx-coh-verdict" });
      const curveFormula = h("div", { class: "prx-coh-formula" });
      const fCurve = ["pi12", "pi23"].map((name) => h("div", { class: "prx-coh-formula-line", "data-prx-tex": name }));
      curveFormula.append(...fCurve);
      const krwFormulaBox = h("section", { class: "prx-coh-panel", "aria-label": T.formulaHeading },
        h("h4", { class: "prx-coh-heading", text: T.formulaHeading }),
        ctx.scrollRegion(curveFormula, T.formulaHeading));

      // --- Finite view slots (2.7)
      const barsSlot = h("div", { class: "prx-coh-chart" });
      const barsLegend = h("div", { class: "prx-coh-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch", style: { background: "var(--prx-err)" }, "aria-hidden": "true" }), T.errLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch", style: { background: "var(--prx-wh)" }, "aria-hidden": "true" }), T.whLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-rule", "aria-hidden": "true" }), T.relaxedLegend),
        h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-outline", "aria-hidden": "true" }), T.optimumLegend));
      const finiteStrip = h("p", { class: "prx-coh-strip" });
      const finiteWitness = h("div", { "data-prx-coherence-witness": "" });
      const reportsBox = h("section", { class: "prx-coh-panel prx-coh-reports", "aria-label": T.reportsHeading },
        barsSlot, barsLegend, finiteStrip);

      const lawTableSlot = h("div", { class: "prx-coh-law" });
      const lawBox = h("section", { class: "prx-coh-panel", "aria-label": T.lawTable },
        h("h4", { class: "prx-coh-heading", text: T.lawHeading }), lawTableSlot);
      const lawChoices = h("div", { class: "prx-coh-choices" });
      const lawBest = h("div", { class: "prx-coh-choices" });
      const lawOver = h("div", { class: "prx-coh-choices" });
      const lawLabel = h("p", { class: "prx-coh-label" });
      const lawChoicesBox = h("section", { class: "prx-coh-panel", "aria-label": T.lawPairsHeading },
        h("h4", { class: "prx-coh-heading", text: T.lawPairsHeading }),
        lawChoices, lawBest, lawOver, lawLabel);
      const finiteVisibleTableSlot = h("div", { class: "prx-coh-panel" });

      const lawVerdict = h("div", { class: "prx-coh-choices prx-coh-verdict" });
      const lawFormula = h("div", { class: "prx-coh-formula" });
      const fLaw = ["symbols", "numbers"].map((name) => h("div", { class: "prx-coh-formula-line", "data-prx-tex": `law-${name}` }));
      lawFormula.append(...fLaw);
      const countKey = h("p", { class: "prx-coh-note" },
        "M = ", ro("law-pair-count", M, formatCount(M)), " possible unordered pairs; N counts stated pairs in a report; E is its expected number of wrong directions.");
      const lawFormulaBox = h("section", { class: "prx-coh-panel", "aria-label": T.finiteFormulaHeading },
        h("h4", { class: "prx-coh-heading", text: T.finiteFormulaHeading }),
        ctx.scrollRegion(lawFormula, T.finiteFormulaHeading),
        countKey);

      if (finite) {
        ctx.stage.append(reportsBox, finiteWitness);
        ctx.primaryGraphic(barsSlot);
        dataBox.body.append(h("div", { class: "prx-coh-disc-stack" }, lawBox, lawChoicesBox, finiteVisibleTableSlot));
        const methodStack = h("div", { class: "prx-coh-disc-stack" }, lawVerdict, lawFormulaBox);
        if (tauHint) methodStack.append(tauHint);
        methodBox.body.append(methodStack);
      } else {
        ctx.stage.append(curveBox, curveLegend, krwStrip, krwWitness);
        ctx.primaryGraphic(curveSlot);
        dataBox.body.append(h("div", { class: "prx-coh-disc-stack" }, krwChoicesBox, costBox, densBox));
        const methodStack = h("div", { class: "prx-coh-disc-stack" }, krwVerdict, krwFormulaBox);
        if (omegaHint) methodStack.append(omegaHint);
        if (tauHint) methodStack.append(tauHint);
        methodBox.body.append(methodStack);
      }

      ctx.caption.replaceChildren(
        finite ? "Three-unit finite law from the postrank theory book, chapter 10. "
          : "Independent normal posteriors. A, B and C label KRW’s first, second and third firms; KRW write the middle mean ω₂. ",
        captionNode(ctx, "teaching-posterior"), ". Every report of the family is evaluated in this browser.");

      // ------------------------------------------------------------------------------------- drawing: KRW view

      function drawDensities(state) {
        const D = CONFIG.density;
        const width = Math.max(1, Math.round(densSlot.clientWidth || curveSlot.clientWidth || ctx.width()));
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
          width,
          keyboard: {
            data: peaks, x: "x", y: "y", sort: false, label: T.densHeading,
            title: (d) => `Firm ${K.names[d.i]}: posterior mean ${fmtOmega(d.x)}, posterior SD ${formatCount(K.sd)}.`,
          },
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
        const width = Math.max(1, Math.round(curveSlot.clientWidth || ctx.stage.clientWidth || ctx.width()));
        const height = width < C.mobileBreak ? C.mobileHeight : C.height;
        const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
        const innerH = Math.max(1, height - C.marginTop - C.marginBottom);
        const px = (w) => C.marginLeft + ((w - lo) / (hi - lo)) * innerW;
        const py = (p) => C.marginTop + ((C.yDomain[1] - p) / (C.yDomain[1] - C.yDomain[0])) * innerH;
        const pFromPy = (yPx) => C.yDomain[1] - ((yPx - C.marginTop) / innerH) * (C.yDomain[1] - C.yDomain[0]);

        const grid = Array.from({ length: C.points }, (_, k) => lo + ((hi - lo) * k) / (C.points - 1));
        const p13 = pairDirection(K.omega1, K.sd, K.omega3, K.sd);
        const pAt = (k, w) => (k === 0 ? pairDirection(K.omega1, K.sd, w, K.sd) : k === 1 ? pairDirection(w, K.sd, K.omega3, K.sd) : p13);
        const lines = [0, 1, 2].map((k) => grid.map((w) => ({ w, p: pAt(k, w) })));
        const names = ["π_AB", "π_BC", "π_AC"];
        const dots = choices.map((c, k) => ({ k, w: state.omega2, p: c.pi, stated: c.best.includes(ACTION.up), c }));

        // Separate the 3 dot labels vertically via placeDirectLabels (mapped strictly by item.id, WA-02)
        const placedDotItems = placeDirectLabels(
          dots.map((d) => ({ id: d.k, y: py(d.p) })),
          { minGapPx: C.minDotGapPx, bounds: [C.marginTop + 9, height - C.marginBottom - 9] },
        );
        const dotYById = new Map(placedDotItems.map((it) => [it.id, it.y]));
        const dotOnLeft = state.omega2 > (lo + hi) / 2;
        const dotLabels = dots.map((d) => {
          const yPx = dotYById.get(d.k) ?? py(d.p);
          const str = formatProb(d.p, { digits: probDigits(d.p, thr) });
          const textW = Math.max(30, str.length * 8.2);
          const xAnchor = px(d.w) + (dotOnLeft ? -C.labelDx : C.labelDx);
          const box = {
            left: dotOnLeft ? xAnchor - textW : xAnchor,
            right: dotOnLeft ? xAnchor : xAnchor + textW,
            top: yPx - 8,
            bottom: yPx + 8,
          };
          return { ...d, pLabel: pFromPy(yPx), str, box };
        });

        // Place 1 - tau threshold label on the side opposite state.omega2 so it never meets dot labels
        const thrAtLeft = state.omega2 >= (lo + hi) / 2;
        const thrX = thrAtLeft ? lo : hi;
        const thrDx = thrAtLeft ? C.thrDx : -C.thrDx;
        const thrAnchor = thrAtLeft ? "start" : "end";
        const thrDy = thr > 0.93 ? 13 : -C.thrDy;
        const thrStr = formatSetting(thr);
        const thrW = Math.max(26, thrStr.length * 8.2);
        const thrXpx = px(thrX) + thrDx;
        const thrYpx = py(thr) + thrDy;
        const thrBox = {
          left: thrAtLeft ? thrXpx : thrXpx - thrW,
          right: thrAtLeft ? thrXpx + thrW : thrXpx,
          top: thrYpx - 8,
          bottom: thrYpx + 8,
        };

        const obstacles = [
          thrBox,
          { left: C.marginLeft, right: C.marginLeft + innerW, top: py(thr) - 5, bottom: py(thr) + 5 },
          ...(band.empty ? [] : [
            { left: px(band.lower) - 5, right: px(band.lower) + 5, top: C.marginTop, bottom: C.marginTop + innerH },
            { left: px(band.upper) - 5, right: px(band.upper) + 5, top: C.marginTop, bottom: C.marginTop + innerH },
          ]),
          ...dots.map((d) => ({ left: px(d.w) - 7, right: px(d.w) + 7, top: py(d.p) - 7, bottom: py(d.p) + 7 })),
          ...dotLabels.map((d) => d.box),
        ];
        const nameRows = chooseCurveNamePositions({
          lo, hi, innerW, innerH, marginLeft: C.marginLeft, marginTop: C.marginTop, pAt, obstacles,
        });

        const bandRow = band.empty ? [] : [{ x1: Math.max(lo, band.lower), x2: Math.min(hi, band.upper) }].filter((b) => b.x2 > b.x1);
        const bandLabel = bandRow.filter((b) => ((b.x2 - b.x1) / (hi - lo)) * innerW >= C.bandLabelMinPx);
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
          height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [lo, hi], ticks: C.xTicks.slice(), label: "Middle posterior mean", labelAnchor: "center", labelArrow: "none" },
          y: { domain: C.yDomain.slice(), ticks: C.yTicks.slice(), label: null },
          color: { type: "identity" },
          marks: (c, P) => [
            P.rect(bandRow, { x1: "x1", x2: "x2", y1: C.yDomain[0], y2: C.yDomain[1], fill: c.plotGrid }),
            P.text(bandLabel, { x: (d) => (d.x1 + d.x2) / 2, y: C.yDomain[1], text: () => T.bandText, lineAnchor: "bottom", dy: -6, fill: c.plotFg }),
            P.ruleY([thr], { stroke: c.plotAxis, strokeDasharray: C.rule }),
            numText([thr], {
              x: thrX, y: (d) => d, value: (d) => d, format: (v) => formatSetting(v),
              dy: thrDy, textAnchor: thrAnchor, dx: thrDx, fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke",
            }),
            ...lines.map((rows, k) => P.line(rows, { x: "w", y: "p", stroke: c.blues[5], strokeWidth: C.strokeWidth, strokeDasharray: C.dash[k] ?? undefined })),
            P.text(nameRows, {
              x: "w", y: "p", text: "n", fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3.5, paintOrder: "stroke",
              render: (index, scales, values, dims, ctxPlot, next) => {
                const g = next(index, scales, values, dims, ctxPlot);
                const subs = ["AB", "BC", "AC"];
                g?.querySelectorAll?.("text").forEach((t, j) => {
                  const sub = subs[nameRows[index[j]]?.k] || "";
                  if (sub) {
                    t.textContent = "π";
                    const ts = t.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
                    ts.setAttribute("dy", "3");
                    ts.setAttribute("font-size", "10.5");
                    ts.textContent = sub;
                    t.appendChild(ts);
                  }
                });
                return g;
              },
            }),
            P.ruleX([state.omega2], { stroke: c.plotFg, strokeWidth: 1 }),
            P.dot(dots, { x: "w", y: "p", r: C.dotR, fill: (d) => (d.stated ? c.plotFg : c.plotBg), stroke: c.plotFg, strokeWidth: 2 }),
            numText(dotLabels, {
              x: "w", y: "pLabel", value: "p", format: (v) => formatProb(v, { digits: probDigits(v, thr) }),
              dx: dotOnLeft ? -C.labelDx : C.labelDx, textAnchor: dotOnLeft ? "end" : "start",
              fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke",
            }),
          ],
          keyboard: {
            data: dots, x: "w", y: "p", sort: false, label: T.probHeading,
            title: (d) => `${names[d.k]} = ${formatProb(d.p, { digits: probDigits(d.p, thr) })} at ω₂ = ${fmtOmega(d.w)}: ${d.p > thr ? "above" : "not above"} 1 − τ = ${formatSetting(thr)}, so on its own we ${decision(d.c)}.`,
          },
        });

        curveLegend.replaceChildren(
          h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-rule", "aria-hidden": "true" }), h("span", {}, T.lineKey, ...oneMinusTau(state.tau), T.lineKeyEnd)),
          h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-dot", "aria-hidden": "true" }), T.dotKey),
          band.empty
            ? h("span", { class: "prx-coh-key" }, T.bandNone)
            : h("span", { class: "prx-coh-key" }, h("span", { class: "prx-coh-swatch prx-coh-swatch-band", "aria-hidden": "true" }),
              h("span", {}, T.bandKey, " (", ro("bandLower", band.lower, formatReadoutEst(band.lower)), " to ",
                ro("bandUpper", band.upper, formatReadoutEst(band.upper)), ")")),
        );

        // Concise 1-line stage summary strip of the three isolated pair probabilities at ω₂
        const pairSummary = choices.flatMap((c, k) => [
          k ? ", " : "",
          piName(c.i, c.j), " = ", ctx.num(c.pi, formatReadoutProb(c.pi)),
        ]);
        krwStrip.replaceChildren("At ω₂ = ", ctx.num(state.omega2, fmtOmega(state.omega2)), ": ", ...pairSummary, ".");

        // Live direction-probability formulas in Method
        const tex = (k) => {
          const f = formulaNums();
          const [i, j] = CONFIG.pairs[k];
          const means = krwMeans(state.omega2);
          const show = (u) => (u === 1 ? fmtOmega(means[u]) : formatCount(means[u]));
          let s = `\\pi_{${K.names[i]}${K.names[j]}} = \\Phi\\!\\left(\\frac{\\omega_${K.names[i]}-\\omega_${K.names[j]}}{\\sqrt{${f.num(2, "2")}}}\\right)`;
          s += ` = \\Phi\\!\\left(\\frac{${f.num(means[i], show(i))}-${f.num(means[j], show(j))}}{\\sqrt{${f.num(2, "2")}}}\\right)`;
          s += ` = ${f.num(choices[k].pi, formatProb(choices[k].pi, { digits: probDigits(choices[k].pi, 1 - state.tau) }))}`;
          renderTex(fCurve[k], s, { display: true, nums: f.raws });
        };
        tex(0);
        tex(1);
      }

      function drawCost(state, band, current) {
        const C = CONFIG.cost;
        const V = CONFIG.curve;
        const lo = CONFIG.omega2.min;
        const hi = CONFIG.omega2.max;
        const rows = costRows(state.tau);
        const all = [...rows.flatMap((d) => [d.opt, d.rel]), current.opt, current.rel];
        const yLo = Math.min(...all);
        const yHi = Math.max(yLo + C.minSpan, Math.max(...all));
        const inner = C.height - C.marginTop - C.marginBottom;
        const perPx = (yHi - yLo) / Math.max(1, inner - C.labelPx - C.lowPx);
        const domain = [yLo - C.lowPx * perPx, yHi + C.labelPx * perPx];
        const width = Math.max(1, Math.round(costSlot.clientWidth || curveSlot.clientWidth || ctx.width()));
        const bandRow = band.empty ? [] : [{ x1: Math.max(lo, band.lower), x2: Math.min(hi, band.upper) }].filter((b) => b.x2 > b.x1);
        const here = [{ w: state.omega2, opt: current.opt, rel: current.rel, extra: current.extra }];
        const right = state.omega2 <= (lo + hi) / 2;
        const value = formatRisk(current.extra);
        const withNumber = (index, scales, values, dims, context, next) => {
          const g = next(index, scales, values, dims, context);
          for (const node of g?.querySelectorAll ? g.querySelectorAll("text") : []) {
            const tspan = node.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.setAttribute("data-num", ctx.dataNum(current.extra));
            tspan.setAttribute("data-prx-readout", "cost-extra");
            tspan.setAttribute("font-weight", "700");
            tspan.textContent = value;
            node.replaceChildren(`${T.costMark} `, tspan);
          }
          return g;
        };
        const fmtW = (w) => formatDecimal(w, { digits: 3 });
        plot(costSlot, {
          alt: T.costAlt,
          width,
          height: C.height, marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: V.marginLeft, marginRight: V.marginRight,
          x: { domain: [lo, hi], ticks: V.xTicks.slice(), label: "Middle posterior mean", labelAnchor: "center", labelArrow: "none" },
          y: { domain, ticks: C.ticks, label: null },
          color: { type: "identity" },
          marks: (c, P) => [
            P.rect(bandRow, { x1: "x1", x2: "x2", y1: domain[0], y2: domain[1], fill: c.plotGrid }),
            P.areaY(rows, { x: "w", y1: "rel", y2: "opt", fill: c.neutral[3], curve: "linear" }),
            P.line(rows, { x: "w", y: "rel", stroke: c.plotAxis, strokeWidth: 1.5, strokeDasharray: C.rule }),
            P.line(rows, { x: "w", y: "opt", stroke: c.plotFg, strokeWidth: 2 }),
            P.ruleX([state.omega2], { stroke: c.plotFg, strokeWidth: 1 }),
            P.dot(here, { x: "w", y: "rel", r: C.dotR, fill: c.plotBg, stroke: c.plotFg, strokeWidth: 1.5 }),
            P.dot(here, { x: "w", y: "opt", r: C.dotR, fill: c.plotFg }),
            P.text(here, {
              x: "w", frameAnchor: "top", dy: C.labelDy, dx: right ? C.labelDx : -C.labelDx, lineAnchor: "top", textAnchor: right ? "start" : "end",
              text: () => `${T.costMark} ${value}`, fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", render: withNumber,
            }),
          ],
          keyboard: {
            data: rows, x: "w", y: "opt", sort: false, label: T.costLabel,
            title: (d) => `ω₂ = ${fmtW(d.w)}: the best report we can print ${formatRisk(d.opt)}, the pairwise choices ${formatRisk(d.rel)}, extra cost ${formatRisk(d.extra)}.`,
          },
        });
      }

      function choiceLines(kind, choices, tauVal) {
        return choices.map((c) => {
          const tied = c.best.length > 1;
          const up = c.best.includes(ACTION.up);
          if (kind === "krw") {
            const shown = formatProb(c.pi, { digits: probDigits(c.pi, 1 - tauVal) });
            const head = [piName(c.i, c.j), " = ", ro(`pi${c.i + 1}${c.j + 1}`, c.pi, shown)];
            if (tied) return h("li", {}, ...head, " equals ", ...oneMinusTau(tauVal), c.best.length === 3 ? ": all three actions on this pair are equally good." : [": stating ", firm(c.i), " above ", firm(c.j), " and withholding the pair are equally good."]);
            return up
              ? h("li", {}, ...head, " is above ", ...oneMinusTau(tauVal), ": on its own we state ", firm(c.i), " above ", firm(c.j), ".")
              : h("li", {}, ...head, " is not above ", ...oneMinusTau(tauVal), ": on its own we withhold ", firm(c.i), " versus ", firm(c.j), ".");
          }
          const head = [eName(c.i, c.j), " = ", ctx.num(c.e, exact(c.e))];
          if (tied) return h("li", {}, ...head, " equals τ = ", tauNode(tauVal), c.best.length === 3 ? ": all three actions on this pair are equally good." : `: stating ${L.ids[c.i]} above ${L.ids[c.j]} and withholding the pair are equally good.`);
          return up
            ? h("li", {}, ...head, " is below τ = ", tauNode(tauVal), `: on its own we state ${L.ids[c.i]} above ${L.ids[c.j]}.`)
            : h("li", {}, ...head, " is not below τ = ", tauNode(tauVal), `: on its own we withhold ${L.ids[c.i]} versus ${L.ids[c.j]}.`);
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

      function bestLines(kind, opt, E, tauVal) {
        const optima = opt.grades.map((g) => Array.from(g));
        const lines = [];
        const first = [h("strong", {}, `${T.bestPrefix}: `), ...optima.flatMap((g, k) => [k ? " or " : "", ...blocksNodes(kind, g), " (", ro(`optimum${k}`, g, formatGrades(g)), ")"]),
          ", risk ", ro("optRisk", opt.risk, kind === "krw" ? formatRisk(opt.risk) : exact(opt.risk)), "."];
        lines.push(h("p", {}, ...first));
        const label = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) label.push("; ", ro("tieCount", opt.tieCount, formatCount(opt.tieCount)), ` ${T.tie}`);
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        lines.push(h("p", { class: "prx-coh-label" }, ...label));
        const over = optima.map((g) => ({ g, s: statedAbove(g, E, { tau: tauVal }) }));
        if (over.every((o) => o.s.count === 0)) lines.push(h("p", {}, T.overNone));
        else {
          for (const [k, o] of over.entries()) {
            if (!o.s.count) continue;
            const items = o.s.pairs.flatMap((p, m) => [m ? "; " : "", unit(kind, p.i), " above ", unit(kind, p.j), ", whose error ",
              ro(`over${k}.${m}`, p.error, kind === "krw" ? formatProb(p.error, { digits: probDigits(p.error, tauVal) }) : exact(p.error)), " is above τ = ", tauNode(tauVal)]);
            lines.push(h("p", {}, ...blocksNodes(kind, o.g), " states ", ...items, "."));
          }
        }
        return lines;
      }

      function drawWitness(slot, choices, grades, names) {
        const label = (i, j, action) => {
          if (action === ACTION.up) return names[i] + " above " + names[j];
          if (action === ACTION.down) return names[j] + " above " + names[i];
          return "Withhold";
        };
        const report = grades[0];
        const rows = choices.map(({ i, j, best }) => {
          const action = report[i] === report[j] ? ACTION.withhold : report[i] < report[j] ? ACTION.up : ACTION.down;
          const changed = !best.includes(action);
          const reportLabel = label(i, j, action);
          return h("tr", { "data-pair": names[i] + "-" + names[j], "data-changed": String(changed) },
            h("th", { scope: "row", text: names[i] + "–" + names[j] }),
            h("td", { text: best.map(a => label(i, j, a)).join(" or ") }),
            h("td", {}, changed ? h("strong", {}, reportLabel, " (changed)") : reportLabel));
        });
        slot.replaceChildren(h("table", { class: "prx-coh-table" },
          h("caption", { text: "Pairwise choices and a coherent report" }),
          h("thead", {}, h("tr", {},
            h("th", { scope: "col", text: "Pair" }), h("th", { scope: "col", text: "Pair alone" }),
            h("th", { scope: "col", text: grades.length > 1 ? "One optimal report" : "Optimal report" }))),
          h("tbody", {}, ...rows)));
      }

      function drawKrwChoices(state, E, choices, printing, opt, relaxed) {
        drawWitness(krwWitness, choices, opt.grades, K.names);
        const list = h("ul", { class: "prx-coh-list" }, ...choiceLines("krw", choices, state.tau));
        krwVerdict.replaceChildren(togetherLine("krw", choices, printing));
        krwChoices.replaceChildren(list,
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
        lawVerdict.replaceChildren(togetherLine("finite", choices, printing));
        lawChoices.replaceChildren(h("ul", { class: "prx-coh-list" }, ...choiceLines("finite", choices, state.tau)),
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
        const width = Math.max(1, Math.round(barsSlot.clientWidth || ctx.stage.clientWidth || ctx.width()));
        const marginLeft = width < B.mobileBreak ? B.mobileMarginLeft : B.marginLeft;
        const best = new Set(opt.grades.map((g) => Array.from(g).join("")));
        const rows = REPORTS.map((g, r) => {
          const ev = evaluateReport(g, LAW, { tau: state.tau });
          const over = statedAbove(g, LAW, { tau: state.tau });
          return { r, g, key: g.join(""), name: lawBlocksText(g), err: ev.errorTerm, wh: ev.withholdingTerm, risk: ev.risk, N: ev.N, E: ev.Ew, over, best: best.has(g.join("")) };
        });
        rows.sort((a, b) => (Math.abs(a.risk - b.risk) <= opt.tieTol ? a.r - b.r : a.risk - b.risk));
        const segs = rows.flatMap((d) => [
          { key: d.key, part: "err", x1: 0, x2: d.err },
          { key: d.key, part: "wh", x1: d.err, x2: d.err + d.wh },
        ]).filter((s) => s.x2 > s.x1);
        const top = Math.max(...rows.map((d) => d.risk));

        plot(barsSlot, {
          alt: T.reportsAlt,
          width,
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
          marginTop: B.marginTop, marginBottom: B.marginBottom, marginLeft, marginRight: B.marginRight,
          x: { domain: [0, top], ticks: B.xTicks.slice(), label: T.riskAxis, labelAnchor: "center", labelArrow: "none", labelOffset: B.labelOffset },
          y: { domain: rows.map((d) => d.key), axis: null, padding: B.padding },
          color: { type: "identity" },
          marks: (c, P) => [
            P.barX(segs, { x1: "x1", x2: "x2", y: "key", fill: (d) => (d.part === "err" ? c.err : c.wh) }),
            P.barX(rows.filter((d) => d.best), { x1: 0, x2: "risk", y: "key", fill: "none", stroke: c.plotFg, strokeWidth: B.optimumStroke }),
            P.text(rows, { x: 0, y: "key", text: "name", dx: B.nameDx, textAnchor: "end", fill: c.plotFg, fontWeight: (d) => (d.best ? "bold" : "normal") }),
            numText(rows, { x: "risk", y: "key", value: "risk", format: (v) => exact(v), dx: B.labelDx, textAnchor: "start", fill: c.plotFg, fontWeight: (d) => (d.best ? "bold" : "normal") }),
            P.ruleX([relaxed], { stroke: c.plotAxis, strokeDasharray: B.rule, strokeWidth: 2 }),
            numText([relaxed], { x: (d) => d, frameAnchor: "top", value: (d) => d, format: (v) => exact(v), dy: -10, lineAnchor: "bottom", fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
          ],
          keyboard: {
            data: rows, x: "risk", y: "key", sort: false, label: T.reportsHeading,
            title: (d) => `${d.name} (${formatGrades(d.g)}): risk ${exact(d.risk)}, ${formatCount(d.N)} pairs stated${d.over.count ? `, states ${d.over.pairs.map((p) => `${L.ids[p.i]} above ${L.ids[p.j]}`).join(" and ")} with an error above τ` : ""}${d.best ? "; a best report" : ""}.`,
          },
        });

        // Complete visible 13-report table in Data disclosure
        finiteVisibleTableSlot.replaceChildren(
          renderDataTable(ctx, {
            caption: ["All ", ctx.num(REPORTS.length, formatCount(REPORTS.length)), " coherent reports sorted by risk"],
            label: T.visibleReportsTable,
            columns: [
              { label: "Blocks", key: "name", rowHeader: true },
              { label: "Grades", value: (d) => d.g, format: (v) => formatGrades(v), numeric: true },
              { label: "N", key: "N", kind: "count" },
              { label: "E", key: "E", format: (v) => exact(v), numeric: true },
              { label: "Risk", key: "risk", format: (v) => exact(v), numeric: true },
              { label: "Stated > τ", value: (d) => (d.over.count ? d.over.pairs.map((p) => `${L.ids[p.i]} > ${L.ids[p.j]}`).join("; ") : "none") },
              { label: "Best", value: (d) => (d.best ? "yes" : "no") },
            ],
            rows,
          }),
        );

        const label = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) label.push("; ", ro("tieCount", opt.tieCount, formatCount(opt.tieCount)), ` ${T.tie}`);
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        lawLabel.replaceChildren(...label);

        const optima = opt.grades.map((g) => Array.from(g));
        lawBest.replaceChildren(h("p", {}, h("strong", {}, `${T.bestPrefix}: `), ...optima.flatMap((g, k) => [k ? " or " : "", ...blocksNodes("finite", g), " (", ro(`optimum${k}`, g, formatGrades(g)), ")"]),
          ", risk ", ro("optRisk", opt.risk, exact(opt.risk)), ", against ", ctx.num(relaxed, exact(relaxed)), " for the pairwise choices."));
        const lines = [];
        const over = optima.map((g) => ({ g, s: statedAbove(g, LAW, { tau: state.tau }) }));
        if (over.every((o) => o.s.count === 0)) lines.push(h("p", {}, T.overNone));
        for (const [k, o] of over.entries()) {
          if (!o.s.count) continue;
          const items = o.s.pairs.flatMap((p, m) => [m ? "; " : "", `${L.ids[p.i]} above ${L.ids[p.j]}, whose error `, ro(`over${k}.${m}`, p.error, exact(p.error)), " is above τ = ", tauNode(state.tau)]);
          lines.push(h("p", {}, ...blocksNodes("finite", o.g), " states ", ...items, "."));
        }
        lawOver.replaceChildren(...lines);

        // Concise 1-line stage summary strip on ctx.stage
        const errItems = CONFIG.pairs.flatMap(([i, j], k) => [k ? ", " : "", eName(i, j), " = ", ctx.num(e0[i][j], exact(e0[i][j]))]);
        const firstOver = over.find((o) => o.s.count > 0)?.s.pairs[0] ?? null;
        const overPhrase = firstOver
          ? ["; best report states an error of ", ctx.num(firstOver.error, exact(firstOver.error)), " above τ."]
          : ["; no best report states an error above τ."];
        finiteStrip.replaceChildren("Pair errors: ", ...errItems, ...overPhrase);
      }

      // ------------------------------------------------------------------------------------- the read-out line

      function krwHeadline(state, choices, printing, opt, relaxed, extra) {
        const joinOr = (items) => items.flatMap((it, k) => [k ? (k === items.length - 1 ? " or " : ", ") : "", ...it]);
        const joinComma = (items) => items.flatMap((it, k) => [k ? ", " : "", ...it]);
        const stated = choices.filter((c) => c.best.length === 1 && c.best[0] !== ACTION.withhold);
        const held = choices.filter((c) => c.best.length === 1 && c.best[0] === ACTION.withhold);
        const tied = choices.filter((c) => c.best.length > 1);
        const above = (c) => (c.best[0] === ACTION.up ? [firmName(c.i), " above ", firmName(c.j)] : [firmName(c.j), " above ", firmName(c.i)]);
        const pairOf = (c) => [firmName(c.i), "–", firmName(c.j)];

        let summary;
        if (stated.length === M) summary = ["state all ", ctx.num(M, formatCount(M)), " pairs"];
        else if (!stated.length && !tied.length) summary = ["withhold all ", ctx.num(M, formatCount(M)), " pairs"];
        else {
          summary = [];
          if (stated.length) summary.push("state ", ...joinComma(stated.map(above)));
          if (held.length) summary.push(summary.length ? "; withhold " : "withhold ", ...joinComma(held.map(pairOf)));
          if (tied.length) summary.push(summary.length ? "; tie on " : "tie on ", ...joinComma(tied.map(pairOf)));
        }

        const optima = opt.grades.map((g) => Array.from(g));
        const reports = joinOr(optima.map((g, k) => [krwBlocksText(g), " (", ro(`ro-optimum${k}`, g, formatGrades(g)), ")"]));
        const incoherent = !printing.length;
        const optFmt = incoherent ? formatDistinguishing(opt.risk, relaxed, { minSig: 3 }) : formatReadoutRisk(opt.risk);
        const relFmt = incoherent ? formatDistinguishing(relaxed, opt.risk, { minSig: 3 }) : formatReadoutRisk(relaxed);
        const riskNode = ro("ro-optRisk", opt.risk, optFmt);
        const relNode = ro("ro-relaxed", relaxed, relFmt);

        if (incoherent) {
          ctx.readout.set([
            "Pairwise choices (", ...summary, ") cannot print. Best report: ",
            ...reports, ", risk ", riskNode, " (", ro("ro-extra", extra, formatReadoutRisk(extra)), " above pairwise ", relNode, ").",
          ]);
        } else {
          ctx.readout.set([
            "Pairwise choices (", ...summary, ") print as ",
            ...reports, ", risk ", riskNode, " (matches pairwise ", relNode, ").",
          ]);
        }
      }

      function finiteHeadline(state, choices, printing, opt, relaxed) {
        const joinComma = (items) => items.flatMap((it, k) => [k ? ", " : "", ...it]);
        const joinOr = (items) => items.flatMap((it, k) => [k ? " or " : "", ...it]);
        const stated = choices.filter((c) => c.best.length === 1 && c.best[0] !== ACTION.withhold);
        const held = choices.filter((c) => c.best.length === 1 && c.best[0] === ACTION.withhold);
        const tied = choices.filter((c) => c.best.length > 1);
        const dirOf = (c) => (c.best[0] === ACTION.up ? [`${L.ids[c.i]} > ${L.ids[c.j]}`] : [`${L.ids[c.j]} > ${L.ids[c.i]}`]);
        const pairOf = (c) => [`${L.ids[c.i]}–${L.ids[c.j]}`];

        let summary;
        if (stated.length === M) summary = ["state all ", ctx.num(M, formatCount(M)), " pairs"];
        else if (!stated.length && !tied.length) summary = ["withhold all ", ctx.num(M, formatCount(M)), " pairs"];
        else {
          summary = [];
          if (stated.length) summary.push(stated.length === 1 && !tied.length ? "state only " : "state ", ...joinComma(stated.map(dirOf)));
          if (held.length && (!stated.length || tied.length)) summary.push(summary.length ? "; withhold " : "withhold ", ...joinComma(held.map(pairOf)));
          if (tied.length) summary.push(summary.length ? "; tie on " : "tie on ", ...joinComma(tied.map(pairOf)));
        }

        const optima = opt.grades.map((g) => Array.from(g));
        const relNode = ctx.num(relaxed, exactReadout(relaxed));
        const optNode = ctx.num(opt.risk, exactReadout(opt.risk));

        if (!printing.length) {
          const names = joinOr(optima.map((g) => [lawBlocksText(g)]));
          ctx.readout.set([
            "At τ = ", tauNode(state.tau), ", pairwise choices (", ...summary, ", cost ", relNode, ") cannot print. Best coherent: ",
            ...names, ", risk ", optNode, ".",
          ]);
        } else if (opt.tieCount > 2) {
          ctx.readout.set([
            "At τ = ", tauNode(state.tau), ", pairwise choices (", ...summary, ") print: ",
            ctx.num(opt.tieCount, formatCount(opt.tieCount)), " tied best reports at risk ", optNode, " (matches pairwise ", relNode, ").",
          ]);
        } else {
          const names = joinOr(optima.map((g) => [lawBlocksText(g)]));
          ctx.readout.set([
            "At τ = ", tauNode(state.tau), ", pairwise choices (", ...summary, ") print as ",
            ...names, ", risk ", optNode, " (matches pairwise ", relNode, ").",
          ]);
        }
      }

      // ------------------------------------------------------------------------------------- render

      let lastKrw = null;

      return {
        render(raw, info) {
          // PR-06 / PR-09: toggling disclosures never re-renders ctx.stage or re-fires ctx.readout.set;
          // opening Data in 2.6 resizes secondary SVG charts at their real open width.
          if (info?.reason === "disclosure") {
            if (!finite && info.disclosure === "data" && dataBox.open && lastKrw) {
              drawCost(lastKrw.state, lastKrw.band, lastKrw.current);
              drawDensities(lastKrw.state);
            }
            return;
          }

          const state = { ...raw, view: mode, omega2: raw.omega2 ?? CONFIG.omega2.value };
          ctx.root.setAttribute("aria-busy", "true");
          try {
            if (omega) omega.set(state.omega2);
            tau.set(state.tau);
            if (!finite) {
              const E = krwErrors(state.omega2);
              const choices = pairChoices(E, state.tau);
              const printing = printingReports(choices);
              const opt = exactOptimum(E, { tau: state.tau, family: CONFIG.family });
              const relaxed = relaxedPairRisk(E, { tau: state.tau });
              const extra = printing.length ? 0 : Math.max(0, opt.risk - relaxed);
              const band = krwExample1Band(state.tau);
              const current = { opt: opt.risk, rel: relaxed, extra };
              lastKrw = { state, band, current };
              drawCurves(state, band, choices);
              drawCost(state, band, current);
              drawDensities(state);
              drawKrwChoices(state, E, choices, printing, opt, relaxed);
              krwHeadline(state, choices, printing, opt, relaxed, extra);
            } else {
              const choices = pairChoices(LAW, state.tau);
              const printing = printingReports(choices);
              const relaxed = relaxedPairRisk(LAW, { tau: state.tau });
              const opt = exactOptimum(LAW, { tau: state.tau, family: CONFIG.family });
              drawLaw();
              drawLawChoices(state, choices, printing, relaxed);
              drawReports(state, opt, relaxed);
              drawWitness(finiteWitness, choices, opt.grades, L.ids);
              finiteHeadline(state, choices, printing, opt, relaxed);
            }
          } finally {
            ctx.root.setAttribute("aria-busy", "false");
          }
        },
      };
    },
  });
}

export function mountWidget(el, spec = {}) { return mountCoherence(el, spec, "krw"); }
