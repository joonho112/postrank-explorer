// 2.12 families ("Families of reports") — Frame v2 upgrade.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, palette, parseColor } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatDecimal,
  formatGrades,
  formatProb,
  formatRational,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode, tieNode } from "../shared/labels.js";
import { evaluateReport, exactOptimum, finiteLawPairwise, fixedOrderDP, rationalApprox, statedAbove, weightedError } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const FAMILIES_CSS = `
/*
 * postrank Explorer · 2.12 families (Frame v2)
 * Primary controls: τ slider + compact G segmented buttons + wrapping presets + Settings disclosure.
 * Stage: 4 aligned family rows (clickable row header, high-contrast grade pills, aligned .prx-fam-bar risk tracks) + compact legend.
 * Disclosures: Data and family search details (exact family table, ties, search lines, law/input tables) + Method and scope.
 */

.prx-fam[data-prx-frame="v2"] .prx-slider {
  flex: 1 1 11.5rem;
  max-width: 14rem;
}

.prx-fam .prx-fam-g .prx-seg-buttons {
  gap: 0.22rem;
}

.prx-fam .prx-fam-g .prx-seg {
  min-width: 1.95rem;
  padding-inline: 0.38rem;
  justify-content: center;
  text-align: center;
}

@media (pointer: coarse), (max-width: 48em) {
  .prx-fam .prx-fam-g .prx-seg {
    min-width: var(--prx-touch-target, 2.75rem);
  }
}

@media (max-width: 30em) {
  .prx-fam .prx-title {
    margin: 0 0 0.25rem;
    font-size: 0.98rem;
  }
  .prx-fam[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.35rem 0.5rem;
    margin-bottom: 0.35rem;
  }
  .prx-fam[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.45rem;
    padding: 0.28rem 0.55rem;
  }
  .prx-fam[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.44rem;
    font-size: 0.8125rem;
  }
  .prx-fam .prx-stage {
    padding: 0.38rem 0.45rem;
  }
  .prx-fam .prx-stage .prx-fam-rows {
    gap: 0.26rem;
  }
  .prx-fam .prx-stage .prx-fam-row {
    padding: 0.28rem 0.45rem 0.3rem;
    gap: 0.14rem;
  }
  .prx-fam .prx-stage .prx-fam-block {
    padding: 0.06rem 0.32rem;
    gap: 0.2rem;
    font-size: 0.86em;
  }
  .prx-fam .prx-stage .prx-fam-legend {
    margin-top: 0.28rem;
    padding-top: 0.25rem;
  }
  .prx-fam[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.45rem;
    gap: 0.35rem;
  }
}

.prx-fam .prx-fam-example,
.prx-fam .prx-fam-family {
  flex: 1 1 100%;
}

.prx-fam .prx-fam-order {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  flex: 1 1 100%;
  min-width: 0;
}

.prx-fam .prx-fam-order-label {
  flex: 1 1 100%;
  font-weight: 600;
  color: var(--prx-fg-muted);
}

.prx-fam .prx-fam-order-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prx-fam .prx-fam-order-item {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.prx-fam .prx-fam-order-unit {
  display: inline-block;
  min-width: 1.7rem;
  padding: 0.2rem 0.35rem;
  font-weight: 700;
  text-align: center;
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
  background: var(--prx-bg);
}

.prx-fam .prx-fam-order-item .prx-btn {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 0.4rem;
}

.prx-fam .prx-readout .prx-fam-ro-blocks {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

/* --- stage & aligned family rows --- */
.prx-fam .prx-stage {
  container-type: inline-size;
  padding: 0.55rem 0.65rem;
}

.prx-fam .prx-stage .prx-fam-compare {
  margin: 0;
  min-width: 0;
}

.prx-fam .prx-stage .prx-fam-rows {
  display: grid;
  gap: 0.38rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prx-fam .prx-stage .prx-fam-row {
  grid-area: auto;
  min-width: 0;
  padding: 0.38rem 0.6rem 0.4rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  display: grid;
  gap: 0.22rem;
}

.prx-fam .prx-stage .prx-fam-row-chosen {
  border-color: var(--prx-post);
  box-shadow: inset 0 0 0 1.5px var(--prx-post);
}

.prx-fam .prx-stage .prx-fam-row-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.2rem 0.75rem;
  min-width: 0;
}

.prx-fam .prx-stage .prx-fam-row-pick {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.85rem;
  margin: 0;
  padding: 0.12rem 0.5rem;
  font: inherit;
  font-size: 0.92em;
  font-weight: 600;
  line-height: 1.25;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
}

.prx-fam .prx-stage .prx-fam-row-pick:hover {
  border-color: var(--prx-post);
}

.prx-fam .prx-stage .prx-fam-row-pick[aria-pressed="true"] {
  color: var(--prx-label-light);
  background: var(--prx-post);
  border-color: var(--prx-post);
}

@media (pointer: coarse), (max-width: 48em) {
  .prx-fam .prx-stage .prx-fam-row-pick {
    min-height: var(--prx-touch-target, 2.75rem);
    padding-inline: 0.6rem;
  }
}

.prx-fam .prx-stage .prx-fam-row-tagline {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.28;
  color: var(--prx-plot-muted);
}

.prx-fam .prx-stage .prx-fam-row-tagline .prx-result-label {
  font-weight: 400;
  color: inherit;
}

/* Shared two-column track grid on wide stages; single-column full-width track on narrow stages.
   Both columns use minmax(0, ...) so .prx-fam-bar shares exact x and width across all 4 rows. */
.prx-fam .prx-stage .prx-fam-row-mid {
  grid-area: auto;
  display: grid;
  grid-template-columns: minmax(0, 15.5rem) minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin: 0.05rem 0;
  min-width: 0;
}

@media (min-width: 48rem) {
  .prx-fam .prx-stage .prx-fam-row-mid {
    grid-template-columns: minmax(0, 17.75rem) minmax(0, 1fr);
  }
}

@container (max-width: 36rem) {
  .prx-fam .prx-stage .prx-fam-row-mid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.prx-fam .prx-stage .prx-fam-blocks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0;
  min-width: 0;
}

.prx-fam .prx-stage .prx-fam-block {
  display: inline-flex;
  align-items: baseline;
  gap: 0.26rem;
  padding: 0.1rem 0.42rem;
  border: 1px solid var(--prx-cell-border);
  border-left-width: 4px;
  border-radius: 5px;
  font-size: 0.92em;
  font-weight: 700;
  line-height: 1.25;
}

.prx-fam .prx-stage .prx-fam-block-grade {
  font-size: 0.8em;
  font-weight: 700;
}

.prx-fam .prx-stage .prx-fam-bar {
  position: relative;
  height: 1.1rem;
  margin: 0;
  min-width: 0;
  background: var(--prx-plot-grid);
  border-radius: 2px;
  overflow: hidden;
}

.prx-fam .prx-stage .prx-fam-seg {
  position: absolute;
  top: 0;
  bottom: 0;
}

.prx-fam .prx-stage .prx-fam-seg-err {
  left: 0;
  background: var(--prx-err);
}

.prx-fam .prx-stage .prx-fam-seg-wh {
  background: var(--prx-wh);
}

.prx-fam .prx-stage .prx-fam-mark {
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 0;
  margin-left: -1px;
}

.prx-fam .prx-stage .prx-fam-mark-tau {
  border-left: 2px dashed var(--prx-plot-axis);
}

.prx-fam .prx-stage .prx-fam-mark-all {
  border-left: 2px solid var(--prx-plot-fg);
}

.prx-fam .prx-stage .prx-fam-row-nums {
  margin: 0;
  font-size: 0.86em;
  color: var(--prx-plot-muted);
}

/* --- compact stage legend --- */
.prx-fam .prx-stage .prx-fam-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.85rem;
  margin: 0.42rem 0 0;
  padding: 0.35rem 0.1rem 0;
  font-size: 0.82em;
  border-top: 1px solid var(--prx-plot-grid);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}

.prx-fam .prx-stage .prx-fam-key {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  min-width: 0;
}

.prx-fam .prx-stage .prx-fam-swatch {
  display: inline-block;
  flex: none;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 2px;
}

.prx-fam .prx-stage .prx-fam-swatch-err { background: var(--prx-err); }
.prx-fam .prx-stage .prx-fam-swatch-wh { background: var(--prx-wh); }

.prx-fam .prx-stage .prx-fam-swatch-tau,
.prx-fam .prx-stage .prx-fam-swatch-all {
  width: 0;
  height: 0.95rem;
  margin: 0 0.25rem;
  border-radius: 0;
}

.prx-fam .prx-stage .prx-fam-swatch-tau { border-left: 2px dashed var(--prx-plot-axis); }
.prx-fam .prx-stage .prx-fam-swatch-all { border-left: 2px solid var(--prx-plot-fg); }

/* --- Data & Method disclosures --- */
.prx-fam .prx-fam-heading {
  margin: 0.65rem 0 0.3rem;
  font-size: 0.93em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fam .prx-fam-heading:first-child {
  margin-top: 0;
}

.prx-fam .prx-fam-note {
  margin: 0.3rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fam .prx-fam-label {
  margin: 0.15rem 0 0.5rem;
  font-size: 0.92em;
}

.prx-fam .prx-fam-label .prx-result-label,
.prx-fam .prx-fam-row-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fam .prx-fam-search {
  margin: 0.6rem 0 0;
}

.prx-fam .prx-fam-search-item {
  margin: 0 0 0.45rem;
}

.prx-fam .prx-fam-search-item > p {
  margin: 0;
}

.prx-fam .prx-fam-search-name {
  font-weight: 600;
  color: var(--prx-fg);
}

.prx-fam .prx-fam-row-label {
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fam .prx-fam-ties-box {
  margin: 0.45rem 0 0;
}

.prx-fam .prx-fam-ties-box > p {
  margin: 0.2rem 0 0;
}

.prx-fam .prx-fam-law {
  margin: 0.7rem 0 0;
  min-width: 0;
}

.prx-fam .prx-fam-table-wrap,
.prx-fam .prx-fam-law-scroll {
  max-width: 100%;
  overflow-x: auto;
}

.prx-fam .prx-fam-exact-table,
.prx-fam .prx-fam-law-table {
  width: 100%;
  margin: 0.25rem 0 0;
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}

.prx-fam .prx-fam-exact-table caption,
.prx-fam .prx-fam-law-table caption {
  caption-side: top;
  text-align: left;
  font-weight: 600;
  color: var(--prx-fg-muted);
  padding: 0 0 0.25rem;
}

.prx-fam .prx-fam-exact-table th,
.prx-fam .prx-fam-exact-table td,
.prx-fam .prx-fam-law-table th,
.prx-fam .prx-fam-law-table td {
  padding: 0.22rem 0.55rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: right;
}

.prx-fam .prx-fam-exact-table th[scope="row"],
.prx-fam .prx-fam-exact-table thead th:first-child,
.prx-fam .prx-fam-law-table th[scope="row"],
.prx-fam .prx-fam-law-table thead th:first-child {
  text-align: left;
  white-space: nowrap;
}

.prx-fam .prx-fam-exact-table td[data-align="left"] {
  text-align: left;
}

.prx-fam .prx-fam-method > p {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fam .prx-fam-method > p:first-child {
  margin-top: 0;
}

.prx-fam .prx-stage .prx-fam-seg,
.prx-fam .prx-stage .prx-fam-mark {
  transition: width 120ms ease-out, left 120ms ease-out;
}
`;

export const CONFIG = Object.freeze({
  name: "families",
  label: "Limits on the number of grades: the best report within each family of reports",
  title: "Which reports do we allow, and what is the best one in each family?",
  six: Object.freeze({ array: "one", tau: 0.2, G: 6 }),
  // theory book ch. 14 (sec-fixed-order-dp-example): two states; each criterion orders the units from highest to
  // lowest, and values 4, 3, 2, 1 are assigned along each order
  tb14: Object.freeze({
    ids: Object.freeze(["A", "B", "C", "D"]),
    criteria: Object.freeze(["criterion 1", "criterion 2"]),
    orders: Object.freeze([Object.freeze(["ABCD", "ACBD"]), Object.freeze(["BACD", "DCBA"])]),
    probs: Object.freeze([0.75, 0.25]),
    w: Object.freeze([0.6, 0.4]),
    tau: 0.25,
    G: 4,
    // risks are shown as fractions when one with a denominator up to this exists (7/40, 3/20 at τ = 1/4)
    maxDenominator: 40,
  }),
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  G: Object.freeze({ min: 1, max: 6, value: 6 }),
  familyAliases: Object.freeze({
    all: Object.freeze(["all", "unrestricted"]),
    atmost: Object.freeze(["atmost", "at-most", "at_most", "cap", "le", "max", "gmax"]),
    exact: Object.freeze(["exact", "exactly", "eq", "g0"]),
    order: Object.freeze(["order", "fixed", "fixed-order", "contiguous", "cuts"]),
  }),
  percent: 100,
  // the bar scale runs a little past the largest value shown
  barHeadroom: 1.06,
  text: Object.freeze({
    exampleLegend: "Example",
    exampleSix: "Six sites, score A",
    exampleTb14: "Four units, two criteria (theory book, chapter 14)",
    familyLegend: "Family of reports (the read-out follows this one)",
    familyAtmost: "At most Gₘₐₓ grades",
    familyExact: "Exactly G₀ grades",
    familyOrder: "Contiguous cuts of the declared order",
    gLegend: "Number of grades: Gₘₐₓ for at most, G₀ for exactly",
    slider: "Withholding cost τ",
    sliderHint: "A wrong stated direction costs one; staying silent on one pair costs τ.",
    orderLabel: "Declared order, top first (used by the contiguous-cuts family)",
    orderEarlier: "Move ⟨u⟩ one place earlier",
    orderReset: "Reset the order",
    compareHeading: "The best report in each family, at the same τ",
    compareNote: "Each row is a different family, so each has its own best report. G sets the capped and exactly-G families; the contiguous cuts may use any number of grades. One scale for all bars.",
    anyGrades: "any number of grades",
    shown: "the family in the read-out",
    atMostWords: "At most",
    exactlyWords: "Exactly",
    gradesWord: "grades",
    gradeWord: "grade",
    everyReport: "every report",
    cutsOf: "Contiguous cuts of",
    reports: "reports",
    cutReports: "contiguous reports",
    everyOne: "every one evaluated",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    dpRule: "The dynamic program keeps the package's tie rules: at equal risk, fewer grades, then the earlier cut.",
    parityOk: "Enumerating all ⟨k⟩ of these reports gives the same report and risk.",
    parityOff: "Enumerating these reports gives a different result; please report this.",
    riskWords: "with expected loss per pair (risk)",
    riskShort: "risk",
    stated: "pairs stated",
    of: "of",
    statedOverOne: "It states ⟨pair⟩ although its error, ⟨e⟩, is above τ.",
    statedOverMany: "It states ⟨list⟩, although each error is above τ.",
    errorWord: "error",
    statedNone: "Every direction it states has an error of τ or less.",
    statedWeighted: "weighted error",
    ties: "reports share the smallest risk in this family; the row shows the first.",
    errLegend: "E/M: expected wrong directions per pair",
    errLegendWeighted: "E/M: expected weighted wrong directions per pair",
    whLegend: "τ(M − N)/M: the price of the withheld pairs, per pair",
    tauLegend: "dashed mark: τ, the risk of the all-withheld report",
    allLegend: "solid mark: the best of all reports,",
    barsWords: "Bar: error part ⟨e⟩, withholding part ⟨w⟩, risk ⟨r⟩; τ is ⟨t⟩ and the best of all reports ⟨a⟩.",
    gradeOneSix: "Grade 1 = highest priority on score A (the sites visited first).",
    gradeOneTb14: "Grade 1 = highest target value under the theory book's illustrative law.",
    noteSix: "The postrank tutorial supplies normal posteriors for score A at six fictional sites. We enumerate reports for the cap and exact grade count and use dynamic programming for the fixed order.",
    noteTb14: "An illustrative two-state law from the postrank theory book (chapter 14), with two criteria. The at-most and exactly families are searched report by report in this browser; the order family uses the fixed-order dynamic program.",
    lawHeading: "The four-unit law and its weighted pair errors",
    lawState: "State ⟨s⟩, probability ⟨p⟩: criterion 1 orders ⟨o1⟩, criterion 2 orders ⟨o2⟩ (top first).",
    lawExplain: "The weighted pair error of i above j is ⟨w1⟩ × its criterion 1 error + ⟨w2⟩ × its criterion 2 error: the chance that stating i above j is wrong, averaged over the two criteria with their weights. It takes the place of eᵢⱼ in the risk.",
    lawTable: "Errors of stating the earlier unit above the later one",
    lawStatement: "Statement",
    lawE1: "Criterion 1 error",
    lawE2: "Criterion 2 error",
    lawEbar: "Weighted error",
    blockAnd: " and ",
    blockThen: ", then ",
    above: "above",
    orderSettings: "Declared order",
    sharedTol: "Each family is searched exactly; equal-risk tolerance ⟨tol⟩ (risks closer than this count as equal).",
    sharedParity: " The contiguous cuts come from the dynamic program; enumerating all ⟨k⟩ of them gives the same report and risk.",
    sharedParityOff: " The contiguous cuts come from the dynamic program; enumerating them gives a different result; please report this.",
    searchTitle: "Search and tie rule of each family",
    searchChosen: "The family in the read-out",
  }),
});

// ---------------------------------------------------------------------------------------------- data & helpers

/** The released error array of score A (JSON null on the diagonal becomes NaN). */
function sixErrors() {
  const a = SIX.arrays[CONFIG.six.array];
  return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))) };
}

/** The theory book's four-unit law: values n, n − 1, … along each criterion's order, as states[s][i][k]. */
function tb14Errors() {
  const T = CONFIG.tb14;
  const n = T.ids.length;
  const value = (order, i) => n - order.indexOf(T.ids[i]);
  const states = T.orders.map((pair) => T.ids.map((_, i) => pair.map((order) => value(order, i))));
  return finiteLawPairwise(states, Array.from(T.probs), { ids: Array.from(T.ids), criteria: Array.from(T.criteria) });
}

const EXAMPLES = Object.freeze({
  six: (() => {
    const E = sixErrors();
    return { key: "six", E, ids: E.ids, w: [1], tau: CONFIG.six.tau, G: CONFIG.six.G, ebar: E.e[0], fraction: false };
  })(),
  dominance: (() => {
    const E = finiteLawPairwise([[[4], [3], [2], [1]], [[2], [1], [4], [3]]], [.6, .4], { ids: ["A", "B", "X", "Y"] });
    return { key: "dominance", E, ids: E.ids, w: [1], tau: 4 / 9, G: 2, ebar: E.e[0], fraction: true, maxDenominator: 1000 };
  })(),
  tb14: (() => {
    const E = tb14Errors();
    const w = Array.from(CONFIG.tb14.w);
    return { key: "tb14", E, ids: E.ids, w, tau: CONFIG.tb14.tau, G: CONFIG.tb14.G, ebar: weightedError(E, w), fraction: true };
  })(),
});

/** The family key from a value or an alias. */
export function parseFamily(v) {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  for (const [key, list] of Object.entries(CONFIG.familyAliases)) if (list.includes(s)) return key;
  return undefined;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** An order: letters (or 0-based indices) top first, distinct; checked against the example at render time. */
export function parseOrder(v) {
  if (v === null) return null;
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/).filter(Boolean) : null;
  if (!list || list.length === 0) return undefined;
  const ids = list.map((x) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x < LETTERS.length ? LETTERS[x] : String(x).trim().toUpperCase()));
  if (ids.some((x) => !/^[A-Z]$/.test(x)) || new Set(ids).size !== ids.length) return undefined;
  return ids;
}

/** Unit indices of the declared order for this example: the state's order when it is a permutation, else 0, 1, …. */
export function orderIndices(order, ex) {
  const n = ex.ids.length;
  if (Array.isArray(order) && order.length === n) {
    const idx = order.map((id) => ex.ids.indexOf(id));
    if (idx.every((i) => i >= 0) && new Set(idx).size === n) return idx;
  }
  return ex.ids.map((_, i) => i);
}

/** The engine family of a family key at G (at most n grades is every report, 𝒜ₙ). */
export function familyOf(key, G, n, order) {
  if (key === "all") return { kind: "all" };
  if (key === "atmost") return G >= n ? { kind: "all" } : { kind: "atMost", G };
  if (key === "exact") return { kind: "exactly", G };
  return { kind: "order", order };
}

/** The units of each grade, grade 1 first. */
export function blocksOf(grade, ids) {
  const G = Math.max(...grade);
  const out = [];
  for (let h = 1; h <= G; h += 1) out.push(ids.filter((_, i) => grade[i] === h));
  return out;
}

export { blocksText };

export function blocksWords(grade, ids) {
  const T = CONFIG.text;
  const list = (b) => (b.length < 2 ? b.join("") : `${b.slice(0, -1).join(", ")}${T.blockAnd}${b.at(-1)}`);
  return blocksOf(grade, ids).map(list).join(T.blockThen);
}

/** Blend a foreground hex color at `alpha` over `bgHex` for >= 10:1 AA/AAA grade-pill text contrast in both themes. */
function tintHex(fgColor, bgColor, alpha = 0.12) {
  const fg = parseColor(fgColor);
  const bg = parseColor(bgColor) ?? [255, 255, 255];
  if (!fg) return bgColor || "#ffffff";
  return `#${fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: "Best report in each family",
    className: "prx-fam",
    frame: "v2",
    css: FAMILIES_CSS,
    keys: {
      example: { type: "choice", values: ["six", "tb14", "dominance"], value: "six" },
      family: { type: "custom", value: "exact", parse: (v) => parseFamily(v) },
      G: { type: "integer", min: CONFIG.G.min, max: CONFIG.G.max, value: CONFIG.G.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      order: { type: "custom", value: ["A", "B", "C", "D", "E", "F"], parse: (v) => parseOrder(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;

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
          const v = slots[m[1]];
          out.push(...[].concat(v));
          at = m.index + m[0].length;
        }
        if (at < template.length) out.push(template.slice(at));
        return out;
      };
      const fmtRoRisk = (ex, x) => {
        if (ex.fraction && rationalApprox(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator })) {
          return formatRational(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator });
        }
        return formatReadoutRisk(x);
      };
      const fmtExactRisk = (ex, x) => {
        if (ex.fraction && rationalApprox(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator })) {
          return formatRational(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator });
        }
        return formatRisk(x);
      };
      const fmtRoErr = (ex, x) => (ex.fraction ? formatRational(x) : formatReadoutProb(x));
      const gNum = (G) => ctx.num(G, formatCount(G));

      // --- Primary controls in ctx.controls: Withholding cost τ + compact Grades G segmented buttons
      const hintId = uid("prx-fam-hint");
      const tau = ctx.slider({
        label: T.slider,
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      tau.input.setAttribute("aria-describedby", hintId);
      ctx.primaryControl(tau.root);

      const gValues = [];
      for (let g = CONFIG.G.min; g <= CONFIG.G.max; g += 1) gValues.push(g);
      const gSeg = ctx.segmented({
        label: "Grades G",
        name: "G",
        className: "prx-fam-g",
        options: gValues.map((g) => ({ value: g, label: String(g) })),
        value: ctx.state.G,
        onChange: (v) => ctx.set({ G: v }),
      });
      ctx.controls.append(tau.root, gSeg.root);

      // --- Secondary controls in Settings disclosure (zero bare <24px radio inputs)
      const exampleSeg = ctx.segmented({
        label: T.exampleLegend,
        name: "example",
        className: "prx-fam-example",
        options: [
          { value: "six", label: T.exampleSix },
          { value: "tb14", label: T.exampleTb14 },
          { value: "dominance", label: "Dominating set and a grade cap" },
        ],
        value: ctx.state.example,
        onChange: (v) => {
          const ex = EXAMPLES[v];
          ctx.set({ example: v, tau: ex.tau, G: ex.G, order: ex.ids.slice() });
        },
      });
      const familySeg = ctx.segmented({
        label: T.familyLegend,
        name: "family",
        className: "prx-fam-family",
        options: [
          { value: "all", label: "All reports (unrestricted)" },
          { value: "atmost", label: T.familyAtmost },
          { value: "exact", label: T.familyExact },
          { value: "order", label: T.familyOrder },
        ],
        value: ctx.state.family,
        onChange: (v) => ctx.set({ family: v }),
      });
      const orderId = uid("prx-fam-order");
      const orderList = h("ol", { class: "prx-fam-order-list", "aria-labelledby": orderId });
      const orderReset = ctx.button({
        label: T.orderReset,
        key: "order-reset",
        onClick: () => ctx.set({ order: EXAMPLES[ctx.state.example].ids.slice() }),
      });
      const orderBox = h(
        "div",
        { class: "prx-control prx-fam-order", role: "group", "aria-labelledby": orderId },
        h("span", { id: orderId, class: "prx-fam-order-label", text: T.orderLabel }),
        orderList,
        orderReset.root,
      );
      const settings = ctx.settingsBox("Settings");
      settings.body.append(exampleSeg.root, familySeg.root, orderBox);

      // --- Stage: 4 aligned family rows + compact 1-line legend
      const rows = h("ol", { class: "prx-fam-rows" });
      const legend = h("div", { class: "prx-fam-legend", "data-prx-part": "legend" });
      const compareBox = h(
        "section",
        { class: "prx-fam-compare", "aria-label": T.compareHeading },
        rows,
        legend,
      );
      ctx.stage.append(compareBox);

      ctx.listen(rows, "click", (e) => {
        const pickBtn = e.target?.closest?.("[data-prx-pick-family]");
        if (!pickBtn) return;
        const nextFam = parseFamily(pickBtn.getAttribute("data-prx-pick-family"));
        if (nextFam && nextFam !== ctx.state.family) ctx.set({ family: nextFam });
      });

      // --- Data disclosure: exact family table, tie lists, complete search lines, and law/input tables
      const dataBox = ctx.dataBox("Data and family search details");
      const exactTableWrap = ctx.scrollRegion(h("div", { class: "prx-fam-table-wrap", "data-prx-part": "table" }), "Exact optimum in each report family");
      const exactTable = h("table", { class: "prx-fam-exact-table prx-sticky-first" });
      exactTableWrap.append(exactTable);
      const tiesBox = h("div", { class: "prx-fam-ties-box", "data-prx-part": "notes" });

      const labelLine = h("p", { class: "prx-fam-label", "data-prx-result-scope": "" });
      const searchChosen = h(
        "div",
        { class: "prx-fam-search-item" },
        h("p", { class: "prx-fam-search-name", text: T.searchChosen }),
        labelLine,
      );
      const searchRows = h("div", { class: "prx-fam-search-rows", "data-prx-part": "notes" });
      const searchSection = h(
        "section",
        { class: "prx-fam-search", "aria-label": T.searchTitle },
        h("h4", { class: "prx-fam-heading", text: T.searchTitle }),
        searchChosen,
        searchRows,
      );

      const lawBox = h("section", { class: "prx-fam-law", "aria-label": T.lawHeading, "data-prx-part": "notes" });
      dataBox.body.append(exactTableWrap, tiesBox, searchSection, lawBox);

      // --- Method disclosure: equal-risk tolerance, DP enumeration check, slider cost gloss, and scope notes
      const methodBox = ctx.methodBox("Method and scope");
      const shared = h("p", { class: "prx-fam-shared" });
      const compareNote = h("p", { class: "prx-fam-note", text: T.compareNote });
      const sliderHint = h("p", { id: hintId, class: "prx-fam-note" }, "A wrong stated direction costs ", ctx.num(1, formatCount(1)), "; staying silent on one pair costs τ.");
      const scopeNote = h("p", { class: "prx-fam-note" });
      const methodBody = h("div", { class: "prx-fam-method", "data-prx-part": "notes" }, shared, compareNote, sliderHint, scopeNote);
      methodBox.body.append(methodBody);

      // ------------------------------------------------------------------------------------- drawing helpers

      function familyWords(key, G, n, ex, order, { lower = false } = {}) {
        const cap = (t) => (lower ? t.charAt(0).toLowerCase() + t.slice(1) : t);
        const grades = G === 1 ? T.gradeWord : T.gradesWord;
        if (key === "all") return [cap("All reports (unrestricted)")];
        if (key === "atmost") {
          return G >= n
            ? [`${cap(T.atMostWords)} `, gNum(G), ` ${T.gradesWord} (${T.everyReport})`]
            : [`${cap(T.atMostWords)} `, gNum(G), ` ${grades}`];
        }
        if (key === "exact") return [`${cap(T.exactlyWords)} `, gNum(G), ` ${grades}`];
        return [`${cap(T.cutsOf)} ${order.map((i) => ex.ids[i]).join(", ")} (${T.anyGrades})`];
      }

      function familyShortWords(key, G, n, ex, order) {
        const grades = G === 1 ? T.gradeWord : T.gradesWord;
        if (key === "all") return ["all reports"];
        if (key === "atmost") return G >= n ? ["at most ", gNum(G), " grades (all)"] : ["at most ", gNum(G), ` ${grades}`];
        if (key === "exact") return ["exactly ", gNum(G), ` ${grades}`];
        return ["cuts of ", order.map((i) => ex.ids[i]).join(", ")];
      }

      function rowPickWords(key, G) {
        if (key === "all") return ["All reports"];
        if (key === "atmost") return ["At most ", gNum(G)];
        if (key === "exact") return ["Exactly ", gNum(G)];
        return ["Fixed order"];
      }

      function orderFamilyNode(result, ex, order) {
        const node = familyNameNode(ctx, result);
        if (node) node.append(`: ${T.cutsOf.toLowerCase()} ${order.map((i) => ex.ids[i]).join(", ")}`);
        return node;
      }

      function toleranceParts(r) {
        return [` ${T.tolerance} `, ctx.num(r.tieTol, formatSci(r.tieTol, { trim: true })), ` ${T.toleranceGloss}`];
      }

      const sameAsEnumeration = (r, enumR) => Boolean(
        enumR && !enumR.empty && Math.abs(enumR.risk - r.risk) <= enumR.tieTol
          && Array.from(enumR.grade).every((g, i) => g === r.grade[i]),
      );

      function labelParts(key, r, ex, order, { resultKey, enumR = null, chosen = false }) {
        if (r.empty) return [];
        if (key === "order") {
          const head = [labelNode(ctx, r, { key: resultKey }), " in ", orderFamilyNode(r, ex, order), " (", familySizeNode(ctx, r), ` ${T.cutReports}). `];
          if (chosen) return [...head, T.dpRule, ...toleranceParts(r)];
          const same = sameAsEnumeration(r, enumR);
          return [...head, ...(same ? fill(T.parityOk, { k: ctx.num(r.family.size, formatCount(r.family.size)) }) : [T.parityOff]), ...toleranceParts(r)];
        }
        const head = [labelNode(ctx, r, { key: resultKey }), " (", familySizeNode(ctx, r), ` ${T.reports}, ${T.everyOne}).`];
        return [...head, ...toleranceParts(r)];
      }

      function shortLabel(key, r, ex, order) {
        if (r.empty) return [];
        if (key === "order") return [labelNode(ctx, r, { key }), " in ", orderFamilyNode(r, ex, order), " (", familySizeNode(ctx, r), ")"];
        return [labelNode(ctx, r, { key }), " (", familySizeNode(ctx, r), ")"];
      }

      function chip(members, grade, color, pal) {
        const bg = tintHex(color, pal.plotBg, 0.12);
        return h(
          "span",
          {
            class: "prx-fam-block",
            style: { background: bg, color: labelOn(bg, pal), "border-color": color, "border-left-color": color },
          },
          h("span", { class: "prx-fam-block-grade" }, ctx.num(grade, formatCount(grade))),
          h("span", { class: "prx-fam-block-units", text: members.join(" ") }),
        );
      }

      function blocksRow(grade, ids, pal) {
        const blocks = blocksOf(grade, ids);
        const colors = gradeColors(blocks.length, pal);
        return h("span", { class: "prx-fam-blocks", "aria-hidden": "true" }, ...blocks.map((b, k) => chip(b, k + 1, colors[k], pal)));
      }

      function drawRow(key, r, ev, ex, order, all, top, state, pal, chosen) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        const pct = (x) => `${(Math.max(0, x) / top) * CONFIG.percent}%`;
        const pickBtn = h(
          "button",
          {
            type: "button",
            class: "prx-fam-row-pick",
            "aria-pressed": String(chosen),
            "data-prx-pick-family": key,
            "data-prx-focus-key": `family-row:${key}`,
          },
          ...rowPickWords(key, G),
        );
        const tagLine = h("p", { class: "prx-fam-row-tagline" }, ...shortLabel(key, r, ex, order));
        if (r.empty) return h("li", { class: "prx-fam-row", "data-prx-row": key }, h("div", { class: "prx-fam-row-top" }, pickBtn));

        const grade = Array.from(r.grade);
        const bar = h(
          "div",
          { class: "prx-fam-bar", "aria-hidden": "true" },
          h("span", { class: "prx-fam-seg prx-fam-seg-err", style: { width: pct(ev.errorTerm) } }),
          h("span", { class: "prx-fam-seg prx-fam-seg-wh", style: { left: pct(ev.errorTerm), width: pct(ev.withholdingTerm) } }),
          h("span", { class: "prx-fam-mark prx-fam-mark-tau", style: { left: pct(state.tau) } }),
          h("span", { class: "prx-fam-mark prx-fam-mark-all", style: { left: pct(all.risk) } }),
        );
        const barWords = h("span", { class: "prx-sr-only" }, ...fill(T.barsWords, {
          e: ctx.num(ev.errorTerm, fmtExactRisk(ex, ev.errorTerm)),
          w: ctx.num(ev.withholdingTerm, fmtExactRisk(ex, ev.withholdingTerm)),
          r: ctx.num(r.risk, fmtExactRisk(ex, r.risk)),
          t: ctx.num(state.tau, formatSetting(state.tau)),
          a: ctx.num(all.risk, fmtExactRisk(ex, all.risk)),
        }));
        const nums = h(
          "span",
          { class: "prx-fam-row-nums" },
          `${T.riskShort} `,
          ro(`${key}.risk`, r.risk, fmtRoRisk(ex, r.risk)),
          " · ",
          ro(`${key}.N`, ev.N, formatCount(ev.N)),
          ` ${T.of} `,
          ctx.num(ev.M, formatCount(ev.M)),
          " stated",
          r.tieCount > 1 ? [" · ", ctx.num(r.tieCount, formatCount(r.tieCount)), " tied"] : null,
        );
        const topRow = h("div", { class: "prx-fam-row-top" }, pickBtn, nums);
        return h(
          "li",
          { class: `prx-fam-row${chosen ? " prx-fam-row-chosen" : ""}`, "data-prx-row": key, "data-prx-result-scope": "" },
          topRow,
          h("div", { class: "prx-fam-row-mid" }, blocksRow(grade, ex.ids, pal), bar),
          barWords,
          tagLine,
        );
      }

      function drawExactData(results, evals, ex, order, state) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        const fmtCellRisk = (x) => (
          ex.fraction && rationalApprox(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator })
            ? formatRational(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator })
            : formatDecimal(x, { digits: 6 })
        );
        const headers = ["Family", "Size", "Best report", "Risk", "Error E/M", "Withheld τ(M−N)/M", "Stated N", "Ties"];
        const bodyRows = [];
        const tieItems = [];

        for (const key of ["all", "atmost", "exact", "order"]) {
          const r = results[key];
          if (r.empty) continue;
          const ev = evals[key];
          const grade = Array.from(r.grade);
          bodyRows.push(
            h(
              "tr",
              {},
              h("th", { scope: "row" }, ...familyWords(key, G, n, ex, order)),
              h("td", {}, ctx.num(r.family.size, formatCount(r.family.size))),
              h("td", { "data-align": "left" }, ro(`${key}.grades`, grade, formatGrades(grade)), ` = ${blocksText(grade, ex.ids)}`),
              h("td", {}, ctx.num(r.risk, fmtCellRisk(r.risk))),
              h("td", {}, ctx.num(ev.errorTerm, fmtCellRisk(ev.errorTerm))),
              h("td", {}, ctx.num(ev.withholdingTerm, fmtCellRisk(ev.withholdingTerm))),
              h("td", {}, ctx.num(ev.N, formatCount(ev.N)), " / ", ctx.num(ev.M, formatCount(ev.M))),
              h("td", {}, ro(`${key}.tieCount`, r.tieCount, formatCount(r.tieCount))),
            ),
          );

          if (r.tieCount > 1) {
            const tied = (r.grades ?? [r.grade]).map((g) => ({
              grade: Array.from(g),
              ev: evaluateReport(Array.from(g), ex.E, { tau: state.tau, w: ex.w }),
            }));
            tieItems.push(
              h(
                "div",
                { class: "prx-fam-note" },
                h("p", {}, h("strong", {}, ...familyWords(key, G, n, ex, order)), ": ", ctx.num(r.tieCount, formatCount(r.tieCount)), " reports share the minimum risk:"),
                ...tied.map((t, i) => h(
                  "p",
                  {},
                  ro(`${key}.tie.${i}.grades`, t.grade, formatGrades(t.grade)),
                  " · N = ",
                  ro(`${key}.tie.${i}.N`, t.ev.N, formatCount(t.ev.N)),
                  " · E = ",
                  ctx.num(t.ev.Ew, fmtExactRisk(ex, t.ev.Ew)),
                )),
                ...(new Set(tied.map((t) => t.ev.N)).size > 1 ? [h("p", {}, captionNode(ctx, "different-disclosure"))] : []),
              ),
            );
          }
        }

        exactTable.replaceChildren(
          h("caption", { text: "Exact optimum in each report family" }),
          h("thead", {}, h("tr", {}, ...headers.map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...bodyRows),
        );
        tiesBox.replaceChildren(...tieItems);
      }

      function searchLine(key, r, ex, order, state, enumR) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        return h(
          "div",
          { class: "prx-fam-search-item" },
          h("p", { class: "prx-fam-search-name" }, ...familyWords(key, G, n, ex, order)),
          h("p", { class: "prx-fam-row-label" }, ...labelParts(key, r, ex, order, { resultKey: key, enumR })),
        );
      }

      function drawShared(results, enumOrder) {
        const o = results.order;
        const parity = o.empty ? [] : sameAsEnumeration(o, enumOrder)
          ? fill(T.sharedParity, { k: ctx.num(o.family.size, formatCount(o.family.size)) })
          : [T.sharedParityOff];
        shared.replaceChildren(...fill(T.sharedTol, { tol: ctx.num(results.all.tieTol, formatSci(results.all.tieTol, { trim: true })) }), ...parity);
      }

      function drawLegend(ex, all, state) {
        const item = (cls, ...text) => h(
          "span",
          { class: "prx-fam-key" },
          h("span", { class: `prx-fam-swatch ${cls}`, "aria-hidden": "true" }),
          h("span", {}, ...text),
        );
        legend.replaceChildren(
          item("prx-fam-swatch-err", ex.key === "tb14" ? "weighted E/M" : "E/M error"),
          item("prx-fam-swatch-wh", "τ(M − N)/M withheld"),
          item("prx-fam-swatch-tau", "τ (", ctx.num(state.tau, formatSetting(state.tau)), ")"),
          h(
            "span",
            { class: "prx-fam-key", "data-prx-result-scope": "" },
            h("span", { class: "prx-fam-swatch prx-fam-swatch-all", "aria-hidden": "true" }),
            h("span", {}, "best (", ro("all.referenceRisk", all.risk, fmtRoRisk(ex, all.risk)), ")"),
          ),
          h("span", { class: "prx-fam-key", text: "Grade 1 = top priority." }),
        );
      }

      function drawLaw(ex, state) {
        if (ex.key === "dominance") {
          const tauVal = state.tau;
          const cross = 1 - ex.E.e[0][0][2];
          const threshold = 1 - tauVal;
          lawBox.replaceChildren(
            h("h4", { class: "prx-fam-heading", text: "A dominating set and a restricted family" }),
            h(
              "p",
              { class: "prx-fam-note" },
              "The law puts probability ",
              ctx.num(.6, formatRational(.6)),
              " on A > B > X > Y, and ",
              ctx.num(.4, formatRational(.4)),
              " on X > Y > A > B. Every direction from {A, B} to {X, Y} has probability ",
              ctx.num(cross, formatRational(cross)),
              ".",
            ),
            h(
              "p",
              { class: "prx-fam-note" },
              "Current τ = ",
              ro("dominance.tau", tauVal, formatRational(tauVal)),
              "; the cross-set threshold is ",
              ro("dominance.threshold", threshold, formatRational(threshold)),
              ". ",
              cross > threshold
                ? "The cross-set probabilities strictly exceed that threshold: every unrestricted optimum separates {A, B} above the outsiders."
                : "The strict cross-set premise is not met at this price; the separation conclusion is not asserted.",
            ),
            h("p", { class: "prx-fam-note", text: "A cap can block the rearrangement used in the separation argument. Compare each capped row with the unrestricted reference mark; the fixed-order row remains limited to its declared order." }),
          );
          lawBox.hidden = false;
          return;
        }

        if (ex.key === "six") {
          const n = ex.ids.length;
          const pairRows = [];
          for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
              const eij = ex.E.e[0][i][j];
              const eji = ex.E.e[0][j][i];
              pairRows.push(
                h(
                  "tr",
                  {},
                  h("th", { scope: "row", text: `${ex.ids[i]} vs. ${ex.ids[j]}` }),
                  h("td", {}, ctx.num(eij, formatProb(eij, { digits: 4 }))),
                  h("td", {}, ctx.num(eji, formatProb(eji, { digits: 4 }))),
                ),
              );
            }
          }
          const table = h(
            "table",
            { class: "prx-fam-law-table" },
            h("caption", { text: "Six-site score A pairwise error probabilities" }),
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", { scope: "col", text: "Pair" }),
                h("th", { scope: "col", text: "Error of earlier above later" }),
                h("th", { scope: "col", text: "Error of later above earlier" }),
              ),
            ),
            h("tbody", {}, ...pairRows),
          );
          const scroll = ctx.scrollRegion(h("div", { class: "prx-fam-law-scroll" }), "Six-site score A pairwise error probabilities");
          scroll.append(table);
          lawBox.replaceChildren(
            h("h4", { class: "prx-fam-heading", text: "Six-site score A pairwise errors" }),
            h("p", { class: "prx-fam-note", text: T.gradeOneSix }),
            scroll,
          );
          lawBox.hidden = false;
          return;
        }

        const Tb = CONFIG.tb14;
        const frac = (x) => ctx.num(x, formatRational(x));
        const cell = (name, i, j, x) => ro(`law.${name}.${ex.ids[i]}${ex.ids[j]}`, x, formatRational(x));
        const states = Tb.orders.map((pair, s) => h("p", { class: "prx-fam-note" }, ...fill(T.lawState, {
          s: ctx.num(s + 1, formatCount(s + 1)),
          p: ro(`law.prob.${s + 1}`, Tb.probs[s], formatRational(Tb.probs[s])),
          o1: pair[0].split("").join(", "),
          o2: pair[1].split("").join(", "),
        })));
        const n = ex.ids.length;
        const body = [];
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            body.push(
              h(
                "tr",
                {},
                h("th", { scope: "row", text: `${ex.ids[i]} ${T.above} ${ex.ids[j]}` }),
                h("td", {}, cell("e1", i, j, ex.E.e[0][i][j])),
                h("td", {}, cell("e2", i, j, ex.E.e[1][i][j])),
                h("td", {}, cell("ebar", i, j, ex.ebar[i][j])),
              ),
            );
          }
        }
        const table = h(
          "table",
          { class: "prx-fam-law-table" },
          h("caption", { text: T.lawTable }),
          h("thead", {}, h("tr", {}, ...[T.lawStatement, T.lawE1, T.lawE2, T.lawEbar].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...body),
        );
        const scroll = ctx.scrollRegion(h("div", { class: "prx-fam-law-scroll" }), T.lawTable);
        scroll.append(table);
        lawBox.replaceChildren(
          h("h4", { class: "prx-fam-heading", text: T.lawHeading }),
          ...states,
          h("p", { class: "prx-fam-note prx-fam-law-explain" }, ...fill(T.lawExplain, { w1: frac(Tb.w[0]), w2: frac(Tb.w[1]) })),
          scroll,
        );
        lawBox.hidden = false;
      }

      function drawOrder(ex, order) {
        const items = order.map((i, pos) => {
          const id = ex.ids[i];
          const up = ctx.button({
            label: "←",
            key: `order-earlier-${id}`,
            onClick: () => {
              const next = order.map((k) => ex.ids[k]);
              const displaced = next[pos - 1];
              [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
              ctx.set({ order: next });
              if (pos === 1) ctx.root.querySelector(`[data-prx-focus-key="order-earlier-${displaced}"]`)?.focus({ preventScroll: true });
            },
          });
          up.root.setAttribute("aria-label", T.orderEarlier.replace("⟨u⟩", id));
          up.setDisabled(pos === 0);
          return h("li", { class: "prx-fam-order-item" }, pos === 0 ? null : up.root, h("span", { class: "prx-fam-order-unit", text: id }));
        });
        orderList.replaceChildren(...items);
      }

      function drawHeadline(state, key, r, ev, ex, order) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        if (r.empty) {
          ctx.readout.set(["At τ = ", ctx.num(state.tau, formatSetting(state.tau)), ", ", ...familyShortWords(key, G, n, ex, order), ": no report in this family."]);
          labelLine.replaceChildren();
          return;
        }
        const over = statedAbove(Array.from(r.grade), ex.E, { tau: state.tau, w: ex.w });
        const pairWords = (p) => `${ex.ids[p.i]} ${T.above} ${ex.ids[p.j]}`;
        const errNum = (p) => ro(`over.${ex.ids[p.i]}${ex.ids[p.j]}`, p.error, fmtRoErr(ex, p.error));
        const multipleCriteria = ex.E.e.length > 1;
        const errName = multipleCriteria ? T.statedWeighted : T.errorWord;
        let overNodes;
        if (ev.N === 0) {
          overNodes = ["It states no pair directions."];
        } else if (over.pairs.length === 0) {
          overNodes = [`Every stated direction has ${errName} ≤ τ.`];
        } else if (over.pairs.length === 1) {
          const p = over.pairs[0];
          overNodes = ["It states ", `${pairWords(p)} (${errName} `, errNum(p), " > τ)."];
        } else {
          const items = over.pairs.map((p) => [`${pairWords(p)} (${errName} `, errNum(p), ")"]);
          const list = items.flatMap((it, k) => (k === 0 ? it : [k === items.length - 1 ? T.blockAnd : ", ", ...it]));
          overNodes = ["It states ", ...list, ", each above τ."];
        }
        ctx.readout.set([
          "At τ = ",
          ctx.num(state.tau, formatSetting(state.tau)),
          ", ",
          ...familyShortWords(key, G, n, ex, order),
          ": ",
          h("strong", { class: "prx-fam-ro-blocks" }, blocksText(Array.from(r.grade), ex.ids)),
          tieNode(ctx, r),
          " has risk ",
          ro("risk", r.risk, fmtRoRisk(ex, r.risk)),
          ". ",
          ...overNodes,
        ]);
        labelLine.replaceChildren(...labelParts(key, r, ex, order, { resultKey: "chosen", chosen: true }));
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const ex = EXAMPLES[state.example] ?? EXAMPLES.six;
            const n = ex.ids.length;
            const G = Math.min(state.G, n);
            const order = orderIndices(state.order, ex);
            exampleSeg.set(ex.key);
            familySeg.set(state.family);
            gSeg.set(G);
            gSeg.buttons.forEach((btn, k) => { btn.disabled = gValues[k] > n; });
            tau.set(state.tau);
            drawOrder(ex, order);

            const opts = { tau: state.tau, w: ex.w };
            const all = exactOptimum(ex.E, { ...opts, family: { kind: "all" } });
            const results = {
              all,
              atmost: exactOptimum(ex.E, { ...opts, family: familyOf("atmost", G, n, order) }),
              exact: exactOptimum(ex.E, { ...opts, family: familyOf("exact", G, n, order) }),
              order: fixedOrderDP(ex.E, { ...opts, family: familyOf("order", G, n, order) }),
            };
            const enumOrder = exactOptimum(ex.E, { ...opts, family: familyOf("order", G, n, order) });
            const evals = {};
            for (const [k, r] of Object.entries(results)) evals[k] = r.empty ? null : evaluateReport(Array.from(r.grade), ex.E, opts);
            const top = Math.max(state.tau, ...Object.values(evals).filter(Boolean).map((v) => v.risk)) * CONFIG.barHeadroom;
            const pal = palette(ctx.stage);

            const key = state.family;
            drawHeadline(state, key, results[key], evals[key], ex, order);
            rows.replaceChildren(
              ...["all", "atmost", "exact", "order"].map((k) => drawRow(k, results[k], evals[k], ex, order, all, top, state, pal, k === key)),
            );
            drawLegend(ex, all, state);
            drawExactData(results, evals, ex, order, state);
            searchRows.replaceChildren(
              ...["all", "atmost", "exact", "order"]
                .filter((k) => !results[k].empty)
                .map((k) => searchLine(k, results[k], ex, order, state, k === "order" ? enumOrder : null)),
            );
            drawLaw(ex, state);
            drawShared(results, enumOrder);
            scopeNote.textContent = ex.key === "six"
              ? T.noteSix
              : ex.key === "dominance"
                ? "An illustrative two-state law from the postrank theory book, chapter 10. The best report is computed separately within each declared family; the separation theorem concerns unrestricted reports."
                : T.noteTb14;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
