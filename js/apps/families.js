// Full G-08 families widget, with course prediction apparatus removed.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, palette } from "../shared/chart.js";
import { formatCount, formatGrades, formatProb, formatRational, formatRisk, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode, tieNode } from "../shared/labels.js";
import { evaluateReport, exactOptimum, finiteLawPairwise, fixedOrderDP, rationalApprox, statedAbove, weightedError } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const FAMILIES_CSS = `
/*
 * postrank Explorer · families (catalog G-08; js/widgets/families.js)
 *
 * Layout (review 044 repair, X-01, G3-F4): base.js's result-first frame. The controls (example, family, number of
 * grades, a closed "Declared order" box with the order editor, then τ, the primary control), the preset row, the live
 * read-out, then the rows directly: one compact row per family (its name and its short label, the best report as
 * grade blocks beside a risk bar on a scale shared by every row, the numbers and the tie note), the chosen family's
 * row outlined in place. Under the rows one shared line (the equal-risk tolerance once, the dynamic program's check
 * against enumeration), the legend and the note, then a closed box with each family's complete search line (the
 * family in the read-out first), then the law panel of the four-unit and dominating-set examples. The bars and blocks
 * sit on the plot panel (--prx-plot-bg) so that data colors keep their meaning in every theme. Tokens only; nothing
 * here is wider than its container at 375 px.
 */

.prx-fam .prx-fam-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fam .prx-fam-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fam .prx-fam-label {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.95em;
}

.prx-fam .prx-fam-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

/* rows and the legend sit on the plot panel, so their text uses the panel's ink in every theme */
.prx-fam .prx-fam-row-label .prx-result-label,
.prx-fam .prx-fam-legend .prx-result-label {
  font-weight: 600;
  color: inherit;
}

.prx-fam .prx-fam-row .prx-fam-note,
.prx-fam .prx-fam-row .prx-result-caption { color: var(--prx-plot-fg); }

/* --- controls: radio groups in a row where they fit; the number of grades as a compact row of choices --- */
.prx-fam .prx-fam-example,
.prx-fam .prx-fam-family,
.prx-fam .prx-fam-g {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
  row-gap: 0.15rem;
}

.prx-fam .prx-fam-example > legend,
.prx-fam .prx-fam-family > legend,
.prx-fam .prx-fam-g > legend {
  flex: 1 1 100%;
}

.prx-fam .prx-fam-g {
  column-gap: 0.75rem;
}

.prx-fam .prx-fam-order {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  min-width: 0;
}

.prx-fam .prx-fam-order-label {
  flex: 1 1 100%;
  font-weight: 600;
}

.prx-fam .prx-fam-order-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
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
  min-width: 1.6rem;
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

/* --- the family rows --- */
.prx-fam .prx-fam-compare {
  margin: 0.75rem 0 0;
  min-width: 0;
}

.prx-fam .prx-fam-rows {
  display: grid;
  gap: 0.6rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.prx-fam .prx-fam-row {
  min-width: 0;
  padding: 0.55rem 0.7rem 0.6rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}

.prx-fam .prx-fam-row-chosen {
  border-color: var(--prx-accent);
  box-shadow: inset 0 0 0 1px var(--prx-accent);
}

.prx-fam .prx-fam-row-head {
  font-weight: 600;
}

.prx-fam .prx-fam-row-tag {
  font-weight: 400;
  color: var(--prx-plot-muted);
}

.prx-fam .prx-fam-blocks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.4rem 0 0.35rem;
}

.prx-fam .prx-fam-block {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--prx-radius, 6px);
  font-weight: 700;
}

.prx-fam .prx-fam-block-grade {
  font-size: 0.75em;
  font-weight: 600;
  opacity: 0.9;
}

/* the risk bar: one scale for every row; the dashed mark is τ, the solid mark the best of all reports */
.prx-fam .prx-fam-bar {
  position: relative;
  height: 1.1rem;
  margin: 0.2rem 0 0.25rem;
  background: var(--prx-plot-grid);
  border-radius: 2px;
  overflow: hidden;
}

.prx-fam .prx-fam-seg {
  position: absolute;
  top: 0;
  bottom: 0;
}

.prx-fam .prx-fam-seg-err {
  left: 0;
  background: var(--prx-err);
}

.prx-fam .prx-fam-seg-wh {
  background: var(--prx-wh);
}

.prx-fam .prx-fam-mark {
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 0;
  margin-left: -1px;
}

.prx-fam .prx-fam-mark-tau {
  border-left: 2px dashed var(--prx-plot-axis);
}

.prx-fam .prx-fam-mark-all {
  border-left: 2px solid var(--prx-plot-fg);
}

.prx-fam .prx-fam-row-nums,
.prx-fam .prx-fam-row-label {
  margin: 0.2rem 0 0;
  font-size: 0.92em;
}

/* --- legend --- */
.prx-fam .prx-fam-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0.5rem 0 0;
  padding: 0.4rem 0.6rem;
  font-size: 0.88em;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border-radius: var(--prx-radius, 6px);
}

.prx-fam .prx-fam-key {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.prx-fam .prx-fam-key-text {
  flex: 1 1 100%;
}

.prx-fam .prx-fam-swatch {
  display: inline-block;
  flex: none;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 2px;
}

.prx-fam .prx-fam-swatch-err { background: var(--prx-err); }
.prx-fam .prx-fam-swatch-wh { background: var(--prx-wh); }

.prx-fam .prx-fam-swatch-tau,
.prx-fam .prx-fam-swatch-all {
  width: 0;
  height: 1rem;
  margin: 0 0.35rem;
  border-radius: 0;
}

.prx-fam .prx-fam-swatch-tau { border-left: 2px dashed var(--prx-plot-axis); }
.prx-fam .prx-fam-swatch-all { border-left: 2px solid var(--prx-plot-fg); }

/* --- the four-unit law --- */
.prx-fam .prx-fam-law {
  margin: 0.9rem 0 0;
  min-width: 0;
}

.prx-fam .prx-fam-law-scroll {
  max-width: 100%;
  overflow-x: auto;
}

.prx-fam .prx-fam-law-table {
  margin: 0.4rem 0 0;
  border-collapse: collapse;
  font-size: 0.92em;
}

.prx-fam .prx-fam-law-table caption {
  caption-side: top;
  text-align: left;
  color: var(--prx-fg-muted);
  padding: 0 0 0.25rem;
}

.prx-fam .prx-fam-law-table th,
.prx-fam .prx-fam-law-table td {
  padding: 0.2rem 0.6rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: right;
}

.prx-fam .prx-fam-law-table th[scope="row"] {
  white-space: nowrap;
}

.prx-fam .prx-fam-law-table thead th {
  overflow-wrap: normal;
  word-break: normal;
  hyphens: manual;
  vertical-align: bottom;
}

.prx-fam .prx-fam-law-table th[scope="row"],
.prx-fam .prx-fam-law-table thead th:first-child {
  text-align: left;
}

/* --- review 044 repair (X-01, G3-F4): compact rows; the order editor in a closed box of the controls --- */
.prx-fam .prx-fam-rows { gap: 0.3rem; }
.prx-fam .prx-fam-row {
  display: grid;
  grid-template-columns: minmax(min-content, max-content) minmax(0, 1fr);
  grid-template-areas: "head tag" "mid mid" "low low";
  align-items: baseline;
  column-gap: 1rem;
  padding: 0.3rem 0.6rem 0.3rem;
}
.prx-fam .prx-fam-row > .prx-fam-row-head { grid-area: head; }
.prx-fam .prx-fam-row > .prx-fam-row-tagline { grid-area: tag; justify-self: end; text-align: right; }
.prx-fam .prx-fam-row > .prx-fam-row-mid { grid-area: mid; }
.prx-fam .prx-fam-row > .prx-fam-row-low { grid-area: low; }
.prx-fam .prx-fam-row-tagline {
  margin: 0;
  font-size: 0.85em;
  color: var(--prx-plot-muted);
}
.prx-fam .prx-fam-row-tagline .prx-result-label { font-weight: 400; color: inherit; }
.prx-fam .prx-fam-row-mid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin: 0.2rem 0 0.1rem;
}
.prx-fam .prx-fam-row-mid > .prx-fam-blocks,
.prx-fam .prx-fam-row-mid > .prx-fam-bar { min-width: 0; margin: 0; }
/* the numbers and the tie count run on as one line of text; the tied reports (ties only) follow as lines */
.prx-fam .prx-fam-row-low > .prx-fam-row-nums,
.prx-fam .prx-fam-row-low > .prx-fam-note { display: inline; margin: 0; }
.prx-fam .prx-fam-row-low > .prx-fam-note > p { margin: 0; }
.prx-fam .prx-fam-row-low > .prx-fam-note > p:first-child { display: inline; margin-left: 0.6em; }
.prx-fam .prx-fam-charts { container-type: inline-size; }
/* a phone's column: the heading a little smaller (one line), the rows a little tighter */
/* a narrow column: the short label under the name */
@container (max-width: 34rem) {
  .prx-fam .prx-fam-row { grid-template-columns: minmax(0, 1fr); grid-template-areas: "head" "tag" "mid" "low"; }
  .prx-fam .prx-fam-row > .prx-fam-row-tagline { justify-self: start; text-align: left; }
  .prx-fam .prx-fam-row-mid { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 24rem) {
  .prx-fam .prx-fam-compare > .prx-fam-heading { font-size: 0.8em; }
  .prx-fam .prx-fam-rows { gap: 0.3rem; }
  .prx-fam .prx-fam-row { padding: 0.3rem 0.5rem 0.35rem; }
  .prx-fam .prx-fam-row-head { font-size: 0.88em; }
  .prx-fam .prx-fam-row-head > .prx-fam-row-tag { font-size: 0.9em; }
  .prx-fam .prx-fam-row-mid { margin: 0.2rem 0 0.1rem; gap: 0.2rem 0.75rem; }
  .prx-fam .prx-fam-block { padding: 0.08rem 0.4rem; font-size: 0.92em; }
  .prx-fam .prx-fam-row-low { font-size: 0.95em; }
}
.prx-fam .prx-fam-shared { margin: 0.45rem 0 0; font-size: 0.9em; color: var(--prx-fg-muted); }
.prx-fam .prx-fam-compare > .prx-fam-note { margin: 0.4rem 0 0; }
.prx-fam .prx-fam-search { margin: 0.5rem 0 0; }
.prx-fam .prx-fam-search-item { margin: 0 0 0.5rem; }
.prx-fam .prx-fam-search-item > p { margin: 0; }
.prx-fam .prx-fam-search-name { font-weight: 600; }
.prx-fam .prx-fam-search .prx-fam-label { margin: 0; }
.prx-fam .prx-controls > .prx-disclosure .prx-fam-order { flex: 1 1 100%; }

/* base.css turns transitions off under reduced motion */
.prx-fam .prx-fam-seg,
.prx-fam .prx-fam-mark {
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
    // review 044 repair (X-01, G3-F4): the order editor's box, the shared line under the rows and the box of search lines
    orderSettings: "Declared order",
    sharedTol: "Each family is searched exactly; equal-risk tolerance ⟨tol⟩ (risks closer than this count as equal).",
    sharedParity: " The contiguous cuts come from the dynamic program; enumerating all ⟨k⟩ of them gives the same report and risk.",
    sharedParityOff: " The contiguous cuts come from the dynamic program; enumerating them gives a different result; please report this.",
    searchTitle: "Search and tie rule of each family",
    searchChosen: "The family in the read-out",
  }),
});

// ---------------------------------------------------------------------------------------------- data

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
function parseFamily(v) {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  for (const [key, list] of Object.entries(CONFIG.familyAliases)) if (list.includes(s)) return key;
  return undefined;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** An order: letters (or 0-based indices) top first, distinct; checked against the example at render time. */
function parseOrder(v) {
  if (v === null) return null;
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/).filter(Boolean) : null;
  if (!list || list.length === 0) return undefined;
  const ids = list.map((x) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x < LETTERS.length ? LETTERS[x] : String(x).trim().toUpperCase()));
  if (ids.some((x) => !/^[A-Z]$/.test(x)) || new Set(ids).size !== ids.length) return undefined;
  return ids;
}

/** Unit indices of the declared order for this example: the state's order when it is a permutation, else 0, 1, …. */
function orderIndices(order, ex) {
  const n = ex.ids.length;
  if (Array.isArray(order) && order.length === n) {
    const idx = order.map((id) => ex.ids.indexOf(id));
    if (idx.every((i) => i >= 0) && new Set(idx).size === n) return idx;
  }
  return ex.ids.map((_, i) => i);
}

/** The engine family of a family key at G (at most n grades is every report, 𝒜ₙ). */
function familyOf(key, G, n, order) {
  if (key === "all") return { kind: "all" };
  if (key === "atmost") return G >= n ? { kind: "all" } : { kind: "atMost", G };
  if (key === "exact") return { kind: "exactly", G };
  return { kind: "order", order };
}

/** The units of each grade, grade 1 first. */
function blocksOf(grade, ids) {
  const G = Math.max(...grade);
  const out = [];
  for (let h = 1; h <= G; h += 1) out.push(ids.filter((_, i) => grade[i] === h));
  return out;
}

const blocksText = (grade, ids) => blocksOf(grade, ids).map((b) => `{${b.join(", ")}}`).join(" > ");

function blocksWords(grade, ids) {
  const T = CONFIG.text;
  const list = (b) => (b.length < 2 ? b.join("") : `${b.slice(0, -1).join(", ")}${T.blockAnd}${b.at(-1)}`);
  return blocksOf(grade, ids).map(list).join(T.blockThen);
}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fam",
    // review 044 repair (X-01): the read-out directly under the controls and the preset row, the rows right after it
    layout: "result-first",
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

      // helpers: a read-out number with its hook; text with ⟨slot⟩ marks filled by nodes
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
      const fmtRisk = (ex, x) => {
        if (ex.fraction && rationalApprox(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator })) return formatRational(x, { maxDenominator: ex.maxDenominator ?? CONFIG.tb14.maxDenominator });
        return formatRisk(x);
      };
      const fmtErr = (ex, x) => (ex.fraction ? formatRational(x) : formatProb(x));
      const gNum = (G) => ctx.num(G, formatCount(G));
      const blocksNodes = (grade, ids) => [
        h("span", { "aria-hidden": "true", text: blocksText(grade, ids) }),
        h("span", { class: "prx-sr-only", text: blocksWords(grade, ids) }),
      ];

      // --- controls
      const exampleRadio = ctx.radioGroup({
        legend: T.exampleLegend, name: "example", className: "prx-fam-example",
        options: [{ value: "six", label: T.exampleSix }, { value: "tb14", label: T.exampleTb14 }, { value: "dominance", label: "Dominating set and a grade cap" }],
        value: ctx.state.example,
        onChange: (v) => {
          const ex = EXAMPLES[v];
          ctx.set({ example: v, tau: ex.tau, G: ex.G, order: ex.ids.slice() });
        },
      });
      const familyRadio = ctx.radioGroup({
        legend: T.familyLegend, name: "family", className: "prx-fam-family",
        options: [
          { value: "all", label: "All reports (unrestricted)" },
          { value: "atmost", label: T.familyAtmost },
          { value: "exact", label: T.familyExact },
          { value: "order", label: T.familyOrder },
        ],
        value: ctx.state.family, onChange: (v) => ctx.set({ family: v }),
      });
      const gValues = [];
      for (let g = CONFIG.G.min; g <= CONFIG.G.max; g += 1) gValues.push(g);
      const gRadio = ctx.radioGroup({
        legend: T.gLegend, name: "G", className: "prx-fam-g",
        options: gValues.map((g) => ({ value: g, label: String(g) })),
        value: ctx.state.G, onChange: (v) => ctx.set({ G: v }),
      });
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: ["A wrong stated direction costs ", ctx.num(1, formatCount(1)), "; staying silent on one pair costs τ."], onInput: (v) => ctx.set({ tau: v }),
      });
      const orderId = uid("prx-fam-order");
      const orderList = h("ol", { class: "prx-fam-order-list", "aria-labelledby": orderId });
      const orderReset = ctx.button({ label: T.orderReset, key: "order-reset", onClick: () => ctx.set({ order: EXAMPLES[ctx.state.example].ids.slice() }) });
      const orderBox = h("div", { class: "prx-control prx-fam-order", role: "group", "aria-labelledby": orderId },
        h("span", { id: orderId, class: "prx-fam-order-label", text: T.orderLabel }), orderList, orderReset.root);
      // review 044 repair (X-01, G3-F4): the order editor, used only by the contiguous-cuts row (whose head names the
      // order), in a closed box of the controls row; τ, the control the rows answer to, last before the preset row
      ctx.controls.append(exampleRadio.root, familyRadio.root, gRadio.root);
      ctx.disclosure({ name: "order", title: T.orderSettings, placement: "controls" }).body.append(orderBox);
      ctx.controls.append(ctx.primaryControl(tau.root));

      // --- the chosen family's complete label line (with the order family's tie rule), kept in the box of search lines
      const labelLine = h("p", { class: "prx-fam-label", "data-prx-part": "readout", "data-prx-result-scope": "" });

      // --- the comparison: the rows directly under the read-out (the primary graphic), then one shared line, the legend,
      // the note and the closed box of each family's complete search line
      const rows = ctx.primaryGraphic(h("ol", { class: "prx-fam-rows" }));
      const legend = h("div", { class: "prx-fam-legend", "data-prx-part": "legend" });
      const shared = h("p", { class: "prx-fam-shared", "data-prx-part": "notes" });
      const search = ctx.disclosure({ name: "search", title: T.searchTitle, placement: "none", className: "prx-fam-search" });
      const searchChosen = h("div", { class: "prx-fam-search-item" }, h("p", { class: "prx-fam-search-name", text: T.searchChosen }), labelLine);
      const searchRows = h("div", { class: "prx-fam-search-rows", "data-prx-part": "notes" });
      search.body.append(searchChosen, searchRows);
      const compareBox = h("section", { class: "prx-fam-compare", "aria-label": T.compareHeading, "data-prx-part": "chart" },
        h("h4", { class: "prx-fam-heading", text: T.compareHeading }),
        rows, shared, legend, h("p", { class: "prx-fam-note", text: T.compareNote }), search.root);

      // --- the four-unit law (theory book ch. 14)
      const lawBox = h("section", { class: "prx-fam-law", "aria-label": T.lawHeading, "data-prx-part": "notes", hidden: true });
      ctx.charts.classList.add("prx-fam-charts");
      ctx.charts.append(compareBox, lawBox);

      // ------------------------------------------------------------------------------------- drawing

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

      // the order family is named in words (its symbol arrives on R-03); the node keeps the family name as its
      // data-prx-family attribute, which the checks compare with the engine's return value
      function orderFamilyNode(result, ex, order) {
        const node = familyNameNode(ctx, result);
        if (node) node.append(`: ${T.cutsOf.toLowerCase()} ${order.map((i) => ex.ids[i]).join(", ")}`);
        return node;
      }

      // a label with the family name and size; on a row the order family adds the enumeration check, on the chosen
      // line it adds the tie rules (exact labels add the equal-risk tolerance there)
      function toleranceParts(r) {
        return [` ${T.tolerance} `, ctx.num(r.tieTol, formatSci(r.tieTol, { trim: true })), ` ${T.toleranceGloss}`];
      }
      // whether enumerating the order family gives the dynamic program's report and risk
      const sameAsEnumeration = (r, enumR) => Boolean(enumR && !enumR.empty && Math.abs(enumR.risk - r.risk) <= enumR.tieTol
        && Array.from(enumR.grade).every((g, i) => g === r.grade[i]));
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

      // a row's short label (review 044 repair, G3-F4): the result label and the family's size, as on the row's search
      // line, without the tolerance (said once under the rows) and the enumeration check (in the shared line)
      function shortLabel(key, r, ex, order) {
        if (r.empty) return [];
        if (key === "order") return [labelNode(ctx, r, { key }), " in ", orderFamilyNode(r, ex, order), " (", familySizeNode(ctx, r), ` ${T.cutReports})`];
        return [labelNode(ctx, r, { key }), " (", familySizeNode(ctx, r), ` ${T.reports})`];
      }

      function chip(members, grade, color, pal) {
        return h("span", { class: "prx-fam-block", style: { background: color, color: labelOn(color, pal) } },
          h("span", { class: "prx-fam-block-grade" }, ctx.num(grade, formatCount(grade))),
          h("span", { class: "prx-fam-block-units", text: members.join(" ") }));
      }

      function blocksRow(grade, ids, pal) {
        const blocks = blocksOf(grade, ids);
        const colors = gradeColors(blocks.length, pal);
        return h("span", { class: "prx-fam-blocks", "aria-hidden": "true" }, ...blocks.map((b, k) => chip(b, k + 1, colors[k], pal)));
      }

      function drawRow(key, r, ev, ex, order, all, top, state, enumR, pal, chosen) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        const pct = (x) => `${(Math.max(0, x) / top) * CONFIG.percent}%`;
        const head = h("div", { class: "prx-fam-row-head" },
          h("span", { class: "prx-fam-row-name" }, ...familyWords(key, G, n, ex, order)),
          chosen ? h("span", { class: "prx-fam-row-tag", text: ` · ${T.shown}` }) : null);
        if (r.empty) return h("li", { class: "prx-fam-row", "data-prx-row": key }, head);
        const grade = Array.from(r.grade);
        const bar = h("div", { class: "prx-fam-bar", "aria-hidden": "true" },
          h("span", { class: "prx-fam-seg prx-fam-seg-err", style: { width: pct(ev.errorTerm) } }),
          h("span", { class: "prx-fam-seg prx-fam-seg-wh", style: { left: pct(ev.errorTerm), width: pct(ev.withholdingTerm) } }),
          h("span", { class: "prx-fam-mark prx-fam-mark-tau", style: { left: pct(state.tau) } }),
          h("span", { class: "prx-fam-mark prx-fam-mark-all", style: { left: pct(all.risk) } }));
        const barWords = h("span", { class: "prx-sr-only" }, ...fill(T.barsWords, {
          e: ctx.num(ev.errorTerm, fmtRisk(ex, ev.errorTerm)), w: ctx.num(ev.withholdingTerm, fmtRisk(ex, ev.withholdingTerm)),
          r: ctx.num(r.risk, fmtRisk(ex, r.risk)), t: ctx.num(state.tau, formatSetting(state.tau)), a: ctx.num(all.risk, fmtRisk(ex, all.risk)),
        }));
        const nums = h("p", { class: "prx-fam-row-nums" },
          `${T.riskShort} `, ro(`${key}.risk`, r.risk, fmtRisk(ex, r.risk)), " · ",
          ro(`${key}.grades`, grade, formatGrades(grade)), " · ",
          ro(`${key}.N`, ev.N, formatCount(ev.N)), ` ${T.of} `, ctx.num(ev.M, formatCount(ev.M)), ` ${T.stated}`);
        const tied = (r.grades ?? [r.grade]).map((g) => ({ grade: Array.from(g), ev: evaluateReport(Array.from(g), ex.E, { tau: state.tau, w: ex.w }) }));
        const tie = h("div", { class: "prx-fam-note" },
          h("p", {}, ro(`${key}.tieCount`, r.tieCount, formatCount(r.tieCount)), r.tieCount === 1 ? " minimizing report." : " reports share the minimum risk; every tied report is listed below."),
          ...(r.tieCount > 1 ? tied.map((t, i) => h("p", {},
            ro(`${key}.tie.${i}.grades`, t.grade, formatGrades(t.grade)), " · N = ", ro(`${key}.tie.${i}.N`, t.ev.N, formatCount(t.ev.N)),
            " · E = ", ctx.num(t.ev.Ew, fmtRisk(ex, t.ev.Ew)))) : []),
          ...(new Set(tied.map(t => t.ev.N)).size > 1 ? [captionNode(ctx, "different-disclosure")] : []));
        // review 044 repair (G3-F4): one compact row: the name (with its short label beside it where the row is wide),
        // the blocks beside the bar, the numbers with the tie note; the complete search line goes to the box of search
        // lines (searchLine). The short label comes last in the DOM, so the row's text keeps its former order up to the
        // label; the grid of FAMILIES_CSS draws it beside the name (under it in a phone's column).
        const tagLine = h("p", { class: "prx-fam-row-tagline" }, ...shortLabel(key, r, ex, order));
        return h("li", { class: `prx-fam-row${chosen ? " prx-fam-row-chosen" : ""}`, "data-prx-row": key, "data-prx-result-scope": "" },
          head, h("div", { class: "prx-fam-row-mid" }, blocksRow(grade, ex.ids, pal), bar), barWords,
          h("div", { class: "prx-fam-row-low" }, nums, tie), tagLine);
      }

      /** A family's complete search line in the box (its row's former label line, unchanged), after the family's name. */
      function searchLine(key, r, ex, order, state, enumR) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        return h("div", { class: "prx-fam-search-item" },
          h("p", { class: "prx-fam-search-name" }, ...familyWords(key, G, n, ex, order)),
          h("p", { class: "prx-fam-row-label" }, ...labelParts(key, r, ex, order, { resultKey: key, enumR })));
      }

      /** The shared line under the rows: the equal-risk tolerance once, then the dynamic program's enumeration check. */
      function drawShared(results, enumOrder) {
        const o = results.order;
        const parity = o.empty ? [] : sameAsEnumeration(o, enumOrder)
          ? fill(T.sharedParity, { k: ctx.num(o.family.size, formatCount(o.family.size)) }) : [T.sharedParityOff];
        shared.replaceChildren(...fill(T.sharedTol, { tol: ctx.num(results.all.tieTol, formatSci(results.all.tieTol, { trim: true })) }), ...parity);
      }

      function drawLegend(ex, all, state) {
        // a swatch and its text; the text sits in one span so the flex gap stays between the swatch and the words
        const key = (cls, text) => h("span", { class: "prx-fam-key" }, h("span", { class: `prx-fam-swatch ${cls}`, "aria-hidden": "true" }), h("span", {}, ...[].concat(text)));
        legend.replaceChildren(
          key("prx-fam-swatch-err", ex.key === "tb14" ? T.errLegendWeighted : T.errLegend),
          key("prx-fam-swatch-wh", T.whLegend),
          key("prx-fam-swatch-tau", [`${T.tauLegend} (`, ctx.num(state.tau, formatSetting(state.tau)), ")"]),
          h("span", { class: "prx-fam-key", "data-prx-result-scope": "" },
            h("span", { class: "prx-fam-swatch prx-fam-swatch-all", "aria-hidden": "true" }),
            h("span", {}, `${T.allLegend} `, ro("all.referenceRisk", all.risk, fmtRisk(ex, all.risk)), ", ", labelNode(ctx, all, { key: "all" }),
              " (", familySizeNode(ctx, all), ` ${T.reports})`)),
          h("span", { class: "prx-fam-key prx-fam-key-text", text: ex.key === "six" ? T.gradeOneSix : T.gradeOneTb14 }),
        );
      }

      function drawLaw(ex, state) {
        if (ex.key === "dominance") {
          const tau = state.tau;
          const cross = 1 - ex.E.e[0][0][2];
          const threshold = 1 - tau;
          lawBox.replaceChildren(
            h("h4", { class: "prx-fam-heading", text: "A dominating set and a restricted family" }),
            h("p", { class: "prx-fam-note" }, "The law puts probability ", ctx.num(.6, formatRational(.6)),
              " on A > B > X > Y, and ", ctx.num(.4, formatRational(.4)), " on X > Y > A > B. Every direction from {A, B} to {X, Y} has probability ", ctx.num(cross, formatRational(cross)), "."),
            h("p", { class: "prx-fam-note" }, "Current τ = ", ro("dominance.tau", tau, formatRational(tau)),
              "; the cross-set threshold is ", ro("dominance.threshold", threshold, formatRational(threshold)), ". ",
              cross > threshold ? "The cross-set probabilities strictly exceed that threshold: every unrestricted optimum separates {A, B} above the outsiders."
                : "The strict cross-set premise is not met at this price; the separation conclusion is not asserted."),
            h("p", { class: "prx-fam-note" }, "A cap can block the rearrangement used in the separation argument. Compare each capped row with the unrestricted reference mark; the fixed-order row remains limited to its declared order."));
          lawBox.hidden = false;
          return;
        }
        if (ex.key !== "tb14") { lawBox.hidden = true; lawBox.replaceChildren(); return; }
        const Tb = CONFIG.tb14;
        const frac = (x) => ctx.num(x, formatRational(x));
        const cell = (name, i, j, x) => ro(`law.${name}.${ex.ids[i]}${ex.ids[j]}`, x, formatRational(x));
        const states = Tb.orders.map((pair, s) => h("p", { class: "prx-fam-note" }, ...fill(T.lawState, {
          s: ctx.num(s + 1, formatCount(s + 1)), p: ro(`law.prob.${s + 1}`, Tb.probs[s], formatRational(Tb.probs[s])),
          o1: pair[0].split("").join(", "), o2: pair[1].split("").join(", "),
        })));
        const n = ex.ids.length;
        const body = [];
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            body.push(h("tr", {},
              h("th", { scope: "row", text: `${ex.ids[i]} ${T.above} ${ex.ids[j]}` }),
              h("td", {}, cell("e1", i, j, ex.E.e[0][i][j])), h("td", {}, cell("e2", i, j, ex.E.e[1][i][j])), h("td", {}, cell("ebar", i, j, ex.ebar[i][j]))));
          }
        }
        const table = h("table", { class: "prx-fam-law-table" },
          h("caption", { text: T.lawTable }),
          h("thead", {}, h("tr", {}, ...[T.lawStatement, T.lawE1, T.lawE2, T.lawEbar].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...body));
        // the weighted pair error in words, with the weights as numbers
        lawBox.replaceChildren(
          h("h4", { class: "prx-fam-heading", text: T.lawHeading }),
          ...states,
          h("p", { class: "prx-fam-note prx-fam-law-explain" }, ...fill(T.lawExplain, { w1: frac(Tb.w[0]), w2: frac(Tb.w[1]) })),
          h("div", { class: "prx-fam-law-scroll" }, table));
        lawBox.hidden = false;
      }

      function drawOrder(ex, order) {
        const items = order.map((i, pos) => {
          const id = ex.ids[i];
          const up = ctx.button({
            label: "←", key: `order-earlier-${id}`,
            onClick: () => {
              const next = order.map((k) => ex.ids[k]);
              const displaced = next[pos - 1];
              [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
              ctx.set({ order: next });
              // a unit moved to the top has no button any more: focus goes to the unit it passed
              if (pos === 1) ctx.root.querySelector(`[data-prx-focus-key="order-earlier-${displaced}"]`)?.focus({ preventScroll: true });
            },
          });
          up.root.setAttribute("aria-label", T.orderEarlier.replace("⟨u⟩", id));
          up.setDisabled(pos === 0);
          // the button sits before its unit: "← B" moves B one place earlier
          return h("li", { class: "prx-fam-order-item" }, pos === 0 ? null : up.root, h("span", { class: "prx-fam-order-unit", text: id }));
        });
        orderList.replaceChildren(...items);
      }

      function drawHeadline(state, key, r, ev, ex, order) {
        const n = ex.ids.length;
        const G = Math.min(state.G, n);
        if (r.empty) {
          ctx.readout.set(["τ = ", ctx.num(state.tau, formatSetting(state.tau)), ", ", ...familyWords(key, G, n, ex, order, { lower: true }), ": no report in this family."]);
          labelLine.replaceChildren();
          return;
        }
        const over = statedAbove(Array.from(r.grade), ex.E, { tau: state.tau, w: ex.w });
        const pairWords = (p) => `${ex.ids[p.i]} ${T.above} ${ex.ids[p.j]}`;
        const errNum = (p) => ro(`over.${ex.ids[p.i]}${ex.ids[p.j]}`, p.error, fmtErr(ex, p.error));
        const multipleCriteria = ex.E.e.length > 1;
        const errName = multipleCriteria ? T.statedWeighted : T.errorWord;
        let overNodes;
        if (ev.N === 0) overNodes = ["This report states no pair directions."];
        else if (over.pairs.length === 0) overNodes = [T.statedNone];
        else if (over.pairs.length === 1) {
          const p = over.pairs[0];
          overNodes = fill(T.statedOverOne, { pair: pairWords(p), e: errNum(p) });
          if (multipleCriteria) overNodes = overNodes.map((x) => (typeof x === "string" ? x.replace("its error", `its ${errName}`) : x));
        } else {
          const items = over.pairs.map((p) => [`${pairWords(p)} (${errName} `, errNum(p), ")"]);
          const list = items.flatMap((it, k) => (k === 0 ? it : [k === items.length - 1 ? T.blockAnd : ", ", ...it]));
          overNodes = fill(T.statedOverMany, { list });
        }
        // review 044 repair (X-12): at an optimizer tie the sentence names the shown report as one of the tied ones
        // (labels.js tieNode: " (one of 2 equal-risk best reports; showing the first)"); the rows list every tied report
        ctx.readout.set([
          "τ = ", ctx.num(state.tau, formatSetting(state.tau)), ", ", ...familyWords(key, G, n, ex, order, { lower: true }),
          ": the best report is ", ...blocksNodes(Array.from(r.grade), ex.ids), tieNode(ctx, r), `, ${T.riskWords} `, ro("risk", r.risk, fmtRisk(ex, r.risk)),
          ". ", ...overNodes,
        ]);
        labelLine.replaceChildren(...labelParts(key, r, ex, order, { resultKey: "chosen", chosen: true }));

      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const ex = EXAMPLES[state.example] ?? EXAMPLES.six;
            const n = ex.ids.length;
            const G = Math.min(state.G, n);
            const order = orderIndices(state.order, ex);
            exampleRadio.set(ex.key);
            familyRadio.set(state.family);
            gRadio.set(G);
            gRadio.inputs.forEach((input, k) => { input.disabled = gValues[k] > n; });
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
            const pal = palette(ctx.root);

            const key = state.family;
            drawHeadline(state, key, results[key], evals[key], ex, order);
            rows.replaceChildren(...["all", "atmost", "exact", "order"].map((k) => drawRow(k, results[k], evals[k], ex, order, all, top, state,
              k === "order" ? enumOrder : null, pal, k === key)));
            drawShared(results, enumOrder);
            searchRows.replaceChildren(...["all", "atmost", "exact", "order"].filter((k) => !results[k].empty)
              .map((k) => searchLine(k, results[k], ex, order, state, k === "order" ? enumOrder : null)));
            drawLegend(ex, all, state);
            drawLaw(ex, state);
            ctx.caption.textContent = ex.key === "six" ? T.noteSix : ex.key === "dominance" ? "An illustrative two-state law from the postrank theory book, chapter 10. The best report is computed separately within each declared family; the separation theorem concerns unrestricted reports." : T.noteTb14;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
