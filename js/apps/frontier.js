// frontier (app 2.10): "The frontier". Every report of the six sites' family at (N, E) on a canvas cloud, the lower
// boundary H(m) and the line of slope τ that touches it; linked mixture examples are supplied by app 2.11 through the
// exported renderer. The app uses the shared result-first frame (base.js layout "result-first"; review 044 repair:
// X-01, G2-F1, X-23), top to bottom:
//   controls   the τ slider with a τ ruler under its track: one band per vertex of H(m) that a τ on the slider touches,
//              as wide as the vertex's τ range on the slider, the touched vertex's band pressed; a band sets τ inside
//              its range. Family and View follow the slider (on phones, at most 37.5em, they follow the chart: X-16).
//              Then the preset row
//   read-out   v1's vertex sentence, now "of 15 pairs stated", and the τ range in which that report is best (the
//              review's copy; on the capped family "the same report for every τ on this slider")
//   chart      the primary graphic (ctx.primaryGraphic), with the result card beside it where the charts are wide:
//     main     the head line, the cloud, the label line, the key of the marks τ moves (the line with the slider's
//              hint, the ring, a vertex, H(m) with the mixture caption) and the vector positions. On a narrow plot
//              the touched vertex is labeled "N = 14" (the grade vector needs 24 px per N)
//     side     "Vertices and τ ranges": each vertex, its E and the τ range in which it is the best report, the
//              touched row marked; a vertex on the slider has a button that sets τ inside its range. Open by default
//              where the screen is wider than 37.5em, closed on phones (the read-out repeats the touched row)
//   boxes      "Key" (the cloud's own marks) and "Data: vertices of H(m)" (v1's vertex table with reports and slopes)
// A click or tap on a vertex of the chart (chart.js keyboard.pointer) sets τ to a slider value inside its range and
// moves focus to the slider; Enter on a vertex's keyboard point does the same and keeps focus on the point. A vertex
// column's reader text adds the τ range of the vertex and its risk at the current τ.
// Exports for 2.11 frontier-mixtures and 2.19 averaging-errors: CONFIG, CSS, errorArrayOf, familyOf, modelOf,
// optimumOf, tb19Model, createCloudRenderer (whose options are off by default, so an importer opts in).
import { createWidget, roundTo, stepDecimals, uid } from "../shared/base.js";
import { canvasLayer, numText, plot } from "../shared/chart.js";
import { blocksText, dataNum, formatCount, formatExpectedCount, formatGrades, formatProb, formatRational, formatRisk, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import {
  evaluateReport, exactOptimum, finiteLawPairwise, halfSlopeEligible, lowerHull, matchedDisclosure, orderHull, pairCount, reportCloud,
  supportingVertex, rankSummaries,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "frontier",
  label: "The frontier: every report at its disclosure and expected wrong directions, and the lower boundary H(m)",
  title: "Every report at (N, E), and the boundary H(m)",
  data: Object.freeze({ array: "one" }),
  tau: Object.freeze({ min: 0.01, max: 0.5, step: 0.01, value: 0.2 }),
  families: Object.freeze(["all", "cap3"]),
  family: "all",
  cap: 3,
  examples: Object.freeze(["six", "tb16"]),
  example: "six",
  views: Object.freeze(["near", "all"]),
  view: "near",
  m: Object.freeze({ min: 0, max: 15, value: 10 }),
  half: 0.5,
  // theory book ch. 16 (sec-matched-frontier-example): four units, two criteria, two states
  tb16: Object.freeze({
    states: Object.freeze([
      Object.freeze([Object.freeze([4, 4]), Object.freeze([3, 2]), Object.freeze([2, 3]), Object.freeze([1, 1])]),
      Object.freeze([Object.freeze([3, 1]), Object.freeze([4, 2]), Object.freeze([2, 3]), Object.freeze([1, 4])]),
    ]),
    probs: Object.freeze([0.75, 0.25]),
    w: Object.freeze([0.6, 0.4]),
    ids: Object.freeze(["A", "B", "C", "D"]),
    criteria: Object.freeze(["c1", "c2"]),
    m: 4,
  }),
  // theory book ch. 19: the three-unit law of Which ranking? (L-09), kept in its posterior-mean order A, B, C
  tb19: Object.freeze({
    states: Object.freeze([
      Object.freeze([Object.freeze([20]), Object.freeze([4]), Object.freeze([3])]),
      Object.freeze([Object.freeze([0]), Object.freeze([4]), Object.freeze([3])]),
    ]),
    probs: Object.freeze([0.3, 0.7]),
    ids: Object.freeze(["A", "B", "C"]),
    order: Object.freeze([0, 1, 2]),
  }),
  tieTol: 1e-12,
  // y domain of the view near the boundary: the largest per-N smallest E times nearHead, rounded up to a tenth
  nearHead: 1.15,
  yRound: 10,
  // review 044 repair: phones get the frame's narrow order (controls, read-out, chart, then secondary controls), and
  // the result card is open by default only where the screen is wider than that
  narrowQuery: "(max-width: 37.5em)",
  chart: Object.freeze({
    aspect: 0.6, minHeight: 250, maxHeight: 420, marginTop: 28, marginRight: 22, marginBottom: 42, marginLeft: 50,
    dash: 5, dashWidth: 1.5, dashAlpha: 0.45, column: 1, minDot: 3.5, vertexDot: 4.5, ring: 9, ringWidth: 2,
    hullWidth: 2, hullDash: "7 4", lineWidth: 1.5, mixDot: 6, bestSquare: 7, triangle: 3.5, tickRoom: 24, tickStep: 5,
    labelGap: 12, mixRule: "2 3", roomyPlot: 420, xPad: 0.5, thin: 1.25, halo: 3, hullLabelDy: 14,
    // renderer options (review 044 repair): the mixture's own hull edge, the gap bracket beside the mixture; the
    // "N = k" label of a narrow plot (an estimated glyph width, the room it needs under its ring and at the right edge)
    activeHullWidth: 3.25, bracketGap: 8, bracketLabelGap: 6, charWidth: 7.2, belowRoom: 30, belowDrop: 4, edgeRoom: 2,
  }),
  mini: Object.freeze({ width: 360, height: 190, marginTop: 14, marginRight: 22, marginBottom: 38, marginLeft: 44, pad: 0.2, yHead: 1.15, dot: 4.5, ref: "2 3", hullDash: "7 4" }),
  text: Object.freeze({
    slider: "Withholding cost τ (the slope of the line)",
    sliderHint: "Raise a line of this slope from below: the first report it touches is the best report at this τ.",
    familyLegend: "Family of reports",
    familyAll: "no cap",
    familyFixed: "(the four-unit example uses all reports)",
    notUsed: "(not used in the four-unit example)",
    reports: "reports",
    viewLegend: "View",
    viewNear: "Near the boundary",
    viewAll: "Every report (full height)",
    headSix: "Six sites, score A:",
    headTb16: "Four units, two criteria, weights",
    headIn: "every one of the",
    headInEnd: "reports in",
    tb16Note: "Showing the four-unit example of the Deeper layer.",
    xLabel: "pairs stated, N",
    yLabel: "expected wrong directions, E",
    yLabelWeighted: "expected weighted wrong directions, E",
    wrongWords: "expected wrong directions",
    wrongWordsWeighted: "expected weighted wrong directions",
    chartAlt: "Report cloud: for each number of pairs stated N, a gray column of reports from the smallest to the largest expected wrong directions E.",
    chartAltBoundary: " The lower boundary H(m) runs through its vertices, and a line of slope τ touches it.",
    tableCaption: "Reports by the number of pairs they state",
    keyboardLabel: "Columns of reports by the number of pairs stated. Use the arrow keys to read each column.",
    legendReport: "each gray dash is one report (reports with nearly equal E overlap); the column spans the reports that state N pairs",
    legendMin: "the report with the fewest ⟨E⟩ among those that state N pairs",
    legendAbove: "the column continues above the view",
    legendVertex: "vertex of H(m): a report",
    legendHull: "H(m) between vertices:",
    legendLine: "the line of slope τ =",
    legendRing: "the vertex the line touches",
    legendMix: "the mixture at m =",
    legendBest: "the best single report that states exactly m pairs",
    vertexHeading: "Vertices of H(m)",
    vertexNote: "N is the pairs stated and E the ⟨E⟩. Each slope is a τ at which the line stops touching one vertex and moves to the next: below it the line touches the vertex on this row, above it the next one.",
    touchedMark: "touched",
    noNext: "none (last vertex)",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    riskWords: "expected loss per pair (risk)",
    setBack: "Shown at the question's setting:",
    deeperTag: "Deeper",
    mixHeading: "Mixing two complete reports",
    mixIntro: "Between two vertices, H(m) is reached only by choosing one of two complete reports at random: the one that states more pairs with some chance, the other otherwise. Each draw prints a whole report; the average point lies on the dashed segment.",
    mSlider: "Mean disclosure m (pairs stated, on average)",
    orderHeading: "A fixed order",
    exampleHeading: "A second example: four units, two criteria",
    exampleLegend: "Example",
    exampleSix: "Six sites, score A",
    exampleTb16: "Four units, two criteria (theory book, chapter 16)",
    ebarLine: "Each pair's error is the weighted average of its two criterion errors, weights",
    ebarEnd: "; the page",
    ebarPage: "One grade for two scores",
    ebarTail: " defines it.",
    exampleNow: "The figure, the table of vertices and the sections above now show the four-unit example.",
    miniAlt: "The boundary of the three-unit law within its posterior-mean order A, B, C: vertices at N = 0, 2 and 3. Its last edge is steeper than the dotted reference line of slope one half.",
    miniTable: "Vertices of the boundary within the order A, B, C",
    note: "We use the normal posteriors for score A at six fictional sites from the postrank tutorial. The graph includes every report in the selected family.",
    noteTb16: "The four-unit example uses the two-state posterior from chapter 16 of the theory book. The calculation evaluates each report under that posterior.",
    // review 044 repair (2.10): the τ ruler, the result card, the boxes, the read-out's τ range and the column tips
    rulerLabel: "Vertex of H(m) the line touches, for each τ on this slider",
    rangeTitle: "Vertices and τ ranges",
    rangeCaption: "Each vertex of H(m) and the τ range in which it is the best report",
    rangeHead: Object.freeze(["N", "E", "Best for τ"]),
    rangeFrom: "from",
    rangeTo: "to",
    rangeUpTo: "up to",
    belowSlider: "below this slider",
    rangeHint: "A vertex's button sets τ to a value inside its range.",
    keyTitle: "Key",
    dataTitle: "Data: vertices of H(m)",
    bestFor: "This report is best for every τ from ",
    sameOnSlider: ": the same report for every τ on this slider.",
    ofPairs: "pairs stated",
    tipBest: "Best for τ",
    tipRisk: "risk at τ =",
    ringN: "N = ",
  }),
});

export const CSS = `.prx-fr .prx-fr-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-subheading {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-fr .prx-fr-head {
  margin: 0.25rem 0 0.35rem;
  font-weight: 600;
}

.prx-fr .prx-fr-vector-key {
  margin: .35rem 0;
  font-size: .9em;
  color: var(--prx-fg-muted);
}

.prx-fr .prx-fr-decoded {
  font-weight: normal;
}

.prx-fr .prx-fr-label {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.95em;
}

.prx-fr .prx-fr-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-fr .prx-fr-sym {
  white-space: nowrap;
}

.prx-fr .prx-fr-lock {
  margin-top: 0.15rem;
}

.prx-fr .prx-fr-family,
.prx-fr .prx-fr-view,
.prx-fr .prx-fr-example {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}

.prx-fr .prx-fr-family > legend,
.prx-fr .prx-fr-view > legend,
.prx-fr .prx-fr-example > legend,
.prx-fr .prx-fr-family > .prx-hint {
  flex: 1 1 100%;
}

.prx-fr .prx-fr-chart,
.prx-fr .prx-fr-mini {
  min-width: 0;
  max-width: 100%;
}

.prx-fr .prx-fr-mini {
  max-width: 24rem;
  margin-top: 0.5rem;
}


.prx-fr .prx-fr-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius);
}

.prx-fr .prx-fr-legend .prx-result-caption {
  color: var(--prx-plot-muted);
}

.prx-fr .prx-fr-key {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.prx-fr .prx-fr-swatch {
  flex: none;
  position: relative;
  display: inline-block;
  width: 1.6em;
  height: 1em;
}

.prx-fr .prx-fr-sw-dash::before,
.prx-fr .prx-fr-sw-line::before,
.prx-fr .prx-fr-sw-hull::before {
  content: "";
  position: absolute;
  left: 0.15em;
  right: 0.15em;
  top: calc(50% - 1px);
  border-top: 2px solid var(--prx-neutral-5);
}

.prx-fr .prx-fr-sw-dash::before {
  left: 0.45em;
  right: 0.45em;
}

.prx-fr .prx-fr-sw-line::before {
  border-top: 1.5px solid var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-hull::before {
  border-top: 2px dashed var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-min::before,
.prx-fr .prx-fr-sw-vertex::before,
.prx-fr .prx-fr-sw-ring::before,
.prx-fr .prx-fr-sw-best::before,
.prx-fr .prx-fr-sw-mix::before,
.prx-fr .prx-fr-sw-above::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.prx-fr .prx-fr-sw-min::before {
  width: 0.6em;
  height: 0.6em;
  border: 1.25px solid var(--prx-plot-fg);
  border-radius: 50%;
  background: var(--prx-plot-bg);
}

.prx-fr .prx-fr-sw-vertex::before {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-ring::before {
  width: 1.1em;
  height: 1.1em;
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
}

.prx-fr .prx-fr-sw-best::before {
  width: 0.9em;
  height: 0.9em;
  border: 1.25px solid var(--prx-plot-fg);
}

.prx-fr .prx-fr-sw-mix::before {
  width: 0.7em;
  height: 0.7em;
  border: 2px solid var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  transform: translate(-50%, -50%) rotate(45deg);
}

.prx-fr .prx-fr-sw-above::before {
  width: 0;
  height: 0;
  border-left: 0.35em solid transparent;
  border-right: 0.35em solid transparent;
  border-bottom: 0.6em solid var(--prx-neutral-5);
}


.prx-fr .prx-fr-vertices {
  margin: 1rem 0 0;
  min-width: 0;
}

.prx-fr .prx-fr-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.prx-fr .prx-fr-table {
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}

.prx-fr .prx-fr-table th,
.prx-fr .prx-fr-table td {
  padding: 0.2rem 0.6rem 0.2rem 0;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
}

.prx-fr .prx-fr-table thead th {
  font-weight: 600;
  border-bottom: 1px solid var(--prx-border-strong);
}

.prx-fr .prx-fr-row-touched th,
.prx-fr .prx-fr-row-touched td {
  font-weight: 600;
}

.prx-fr .prx-fr-touched {
  display: inline-block;
  padding: 0 0.35rem;
  font-size: 0.85em;
  font-weight: 600;
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius);
}


.prx-fr .prx-fr-deeper {
  margin: 1rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
  background: var(--prx-bg-raised);
}

.prx-fr .prx-fr-deeper > summary {
  cursor: pointer;
  font-weight: 600;
}

.prx-fr .prx-fr-tag {
  display: inline-block;
  padding: 0 0.4rem;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--prx-on-accent);
  background: var(--prx-accent);
  border-radius: var(--prx-radius);
}

.prx-fr .prx-fr-section {
  margin: 0.9rem 0 0;
  min-width: 0;
}

.prx-fr .prx-fr-section p {
  margin: 0.35rem 0 0;
}

.prx-fr .prx-fr-badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  font-weight: 600;
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius);
  background: var(--prx-bg);
}`;

/** 2.10's own rules (review 044 repair): the τ ruler under the slider's track, Family and View beside the slider, the
 *  chart with its result card. Every rule starts with .prx-frt, a class only 2.10 carries, so app 2.11 (which imports
 *  CSS above) is not touched. */
const TAU_CSS = `
.prx-frt .prx-slider { max-width: 21rem; }
/* The full-height cloud packs neighboring columns closer than a touch target.
   These controls keep the same choices with independent 44-pixel targets. */
.prx-frt .prx-frt-vertex-select { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem; margin: .25rem 0; }
.prx-frt .prx-frt-vertex-select > span { margin-right: .2rem; font-size: .85em; }
.prx-frt .prx-frt-vertex-select > button { min-width: 2.75rem; min-height: 2.75rem; }
.prx-frt .prx-frt-vertex-select > button[aria-pressed="true"] { font-weight: 700; background: var(--prx-accent); color: var(--prx-on-accent); }
/* the ruler sits in the track's grid column; its ends are inset by half a thumb so a band edge lies under the thumb */
.prx-frt .prx-frt-ruler {
  grid-column: 1;
  display: flex;
  min-width: 0;
  margin: 0.25rem 0.5rem 0;
  border: 1px solid var(--prx-border-strong);
  border-radius: 4px;
  overflow: hidden;
  background: var(--prx-bg);
}
.prx-frt .prx-frt-band {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 1.6rem;
  margin: 0;
  padding: 0;
  font: inherit;
  font-size: 0.8125rem;
  line-height: 1.2;
  color: var(--prx-fg);
  background: transparent;
  border: 0;
  border-left: 1px solid var(--prx-border-strong);
  cursor: pointer;
}
.prx-frt .prx-frt-band:first-child { border-left: 0; }
.prx-frt .prx-frt-band:hover { background: var(--prx-bg-sunken); }
.prx-frt .prx-frt-band[aria-pressed="true"] { font-weight: 700; color: var(--prx-on-accent); background: var(--prx-accent); }
.prx-frt .prx-frt-band:focus-visible { outline-offset: -3px; }
/* Family and View: options stacked, so the slider, both choices and their legends share one row */
.prx-frt .prx-frt-toggles { display: flex; flex-wrap: wrap; gap: 0.5rem 1.4rem; align-items: flex-start; min-width: 0; }
.prx-frt .prx-frt-toggles .prx-fr-family,
.prx-frt .prx-frt-toggles .prx-fr-view { flex-direction: column; flex-wrap: nowrap; }
.prx-frt .prx-frt-toggles .prx-radio { margin-right: 0; }
.prx-frt .prx-frt-main > .prx-frt-toggles { margin: 0.6rem 0 0; font-size: 0.875rem; }
/* the chart and its result card */
.prx-frt .prx-frt-main > .prx-fr-head { margin-top: 0; }
.prx-frt .prx-frt-main > .prx-fr-label { margin: 0.35rem 0 0.25rem; }
.prx-frt .prx-frt-keymain { margin-top: 0.25rem; }
.prx-frt .prx-frt-keymain > .prx-hint { flex: 1 1 100%; margin: 0; }
.prx-frt .prx-frt-main > .prx-fr-vector-key { margin: 0.35rem 0 0; }
.prx-frt .prx-frt-card { margin: 0; }
.prx-frt .prx-frt-ranges { width: 100%; border-collapse: collapse; font-size: 0.9em; font-variant-numeric: tabular-nums; }
.prx-frt .prx-frt-ranges caption { caption-side: top; padding: 0 0 0.3rem; text-align: left; font-size: 0.95em; }
.prx-frt .prx-frt-ranges th,
.prx-frt .prx-frt-ranges td { padding: 0.2rem 0.55rem 0.2rem 0; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--prx-border); }
.prx-frt .prx-frt-ranges thead th { font-weight: 600; border-bottom: 1px solid var(--prx-border-strong); }
.prx-frt .prx-frt-ranges tbody th { font-weight: 400; }
.prx-frt .prx-frt-ranges tbody tr[data-prx-pick] { cursor: pointer; }
.prx-frt .prx-frt-ranges tbody tr[aria-current="true"] > * { font-weight: 700; background: var(--prx-bg-sunken); }
.prx-frt .prx-frt-ranges tbody tr[aria-current="true"] > :first-child { box-shadow: inset 3px 0 0 var(--prx-accent); }
.prx-frt .prx-frt-pick {
  min-width: 2.6rem;
  min-height: 1.9rem;
  margin: 0 0 0 0.35rem;
  padding: 0.1rem 0.5rem;
  font: inherit;
  font-weight: inherit;
  color: var(--prx-fg);
  background: var(--prx-bg);
  border: 1px solid var(--prx-border-strong);
  border-radius: 5px;
  cursor: pointer;
}
.prx-frt .prx-frt-pick:hover { border-color: var(--prx-accent); }
.prx-frt .prx-frt-static { display: inline-block; min-width: 2.6rem; margin: 0 0 0 0.35rem; padding: 0.1rem 0.5rem; }
.prx-frt .prx-frt-below { color: var(--prx-fg-muted); font-weight: 400; }
.prx-frt .prx-frt-card .prx-hint { margin: 0.35rem 0 0; }
.prx-frt .prx-disclosure .prx-fr-vertices { margin: 0.2rem 0 0; }
`;

// ---------------------------------------------------------------------------------------------- data

/** The released error array of score A (JSON null on the diagonal becomes NaN). */
export function errorArrayOf(six) {
  const a = six.arrays[CONFIG.data.array];
  return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))) };
}

const SIX_E = errorArrayOf(SIX);
const deep = (x) => (Array.isArray(x) ? x.map(deep) : x);
const TB16_E = finiteLawPairwise(deep(CONFIG.tb16.states), Array.from(CONFIG.tb16.probs), { ids: Array.from(CONFIG.tb16.ids), criteria: Array.from(CONFIG.tb16.criteria) });
const TB19_E = finiteLawPairwise(deep(CONFIG.tb19.states), Array.from(CONFIG.tb19.probs), { ids: Array.from(CONFIG.tb19.ids) });

const EX = Object.freeze({
  six: { E: SIX_E, w: undefined, weights: [1], exact: false },
  tb16: { E: TB16_E, w: Array.from(CONFIG.tb16.w), weights: Array.from(CONFIG.tb16.w), exact: true },
});

export const familyOf = (key) => (key === "cap3" ? { kind: "atMost", G: CONFIG.cap } : { kind: "all" });
const effectiveFamily = (state) => (state.example === "tb16" ? "all" : state.family);

/** The finite law's criterion-specific tie flags are engine summaries; six-site normals have positive variance. */
const tieFreeFlags = (example) => example === "six" ? [true] : CONFIG.tb16.criteria.map((_, k) =>
  rankSummaries({ states: CONFIG.tb16.states.map((state) => state.map((row) => row[k])), probs: Array.from(CONFIG.tb16.probs) }).tieFree);

/** Round up to the next tenth, for the top of an axis. */
const niceTop = (v) => Math.ceil(v * CONFIG.yRound) / CONFIG.yRound;

const models = new Map();
/** The cloud, the hull and what follows from them for one example and family (cached: they do not depend on τ). */
export function modelOf(example, familyKey) {
  const id = `${example}:${familyKey}`;
  if (models.has(id)) return models.get(id);
  const ex = EX[example];
  const family = familyOf(familyKey);
  const opts = ex.w ? { w: ex.w, family } : { family };
  const cloud = reportCloud(ex.E, opts);
  const hull = lowerHull(cloud);
  const M = cloud.M;
  const slopes = hull.slice(1).map((v, q) => (v.Ew - hull[q].Ew) / (v.N - hull[q].N));
  // the near view keeps the same height for both families of one example (taken from the full family)
  const full = familyKey === "all" ? cloud : modelOf(example, "all").cloud;
  const yNear = niceTop(Math.max(...full.byN.map((r) => r.minEw)) * CONFIG.nearHead);
  const yAll = niceTop(Math.max(...full.byN.map((r) => r.maxEw)));
  const flags = tieFreeFlags(example);
  const eligible = halfSlopeEligible({ family, tieFree: flags, positiveWeights: ex.weights });
  const fmt = ex.exact
    ? { E: (v) => formatRational(v), slope: (v) => formatRational(v), psi: (v) => formatRational(v), risk: (v) => formatRational(v) }
    : { E: (v) => formatExpectedCount(v), slope: (v) => formatRisk(v), psi: (v) => formatProb(v, { digits: 2 }), risk: (v) => formatRisk(v) };
  // the two-criterion law weighs its pair errors, so its E counts expected weighted wrong directions
  const weighted = Boolean(ex.w);
  const wrong = weighted ? CONFIG.text.wrongWordsWeighted : CONFIG.text.wrongWords;
  const m = { example, familyKey, family, opts, E: ex.E, ex, cloud, hull, M, n: cloud.n, slopes, yNear, yAll, eligible, fmt, weighted, wrong };
  models.set(id, m);
  return m;
}

const optima = new Map();
export function optimumOf(model, tau) {
  const id = `${model.example}:${model.familyKey}:${tau}`;
  if (!optima.has(id)) {
    if (optima.size > CONFIG.tau.max / CONFIG.tau.step * 4) optima.clear();
    optima.set(id, exactOptimum(model.E, { ...model.opts, tau }));
  }
  return optima.get(id);
}

let tb19Cache = null;
export function tb19Model() {
  if (!tb19Cache) {
    const hull = orderHull(TB19_E, { order: Array.from(CONFIG.tb19.order) });
    const slopes = hull.slice(1).map((v, q) => (v.Ew - hull[q].Ew) / (v.N - hull[q].N));
    const sv = supportingVertex(hull, CONFIG.half);
    tb19Cache = { hull, slopes, sv, M: pairCount(CONFIG.tb19.ids.length) };
  }
  return tb19Cache;
}


const SVG_NS = "http://www.w3.org/2000/svg";

/** A Plot text mark that writes `prefix` and then a number. The number sits in a <tspan> with data-num (and an optional
 *  read-out hook), so the words carry no digit and the number reads back as its raw value. */
function prefixedNumber(P, data, { prefix, value, format, hook = null, attr = null, ...options }) {
  const rows = Array.from(data ?? []);
  return P.text(rows, {
    ...options,
    text: (d) => `${prefix}${format(value(d))}`,
    render(index, scales, values, dims, context, next) {
      const g = next(index, scales, values, dims, context);
      const nodes = g?.querySelectorAll ? [...g.querySelectorAll("text")] : [];
      Array.from(index).forEach((i, j) => {
        const t = nodes[j];
        if (!t) return;
        const raw = value(rows[i]);
        const span = t.ownerDocument.createElementNS(SVG_NS, "tspan");
        span.setAttribute("data-num", dataNum(raw));
        if (hook) span.setAttribute("data-prx-readout", hook);
        span.textContent = format(raw);
        t.replaceChildren(t.ownerDocument.createTextNode(prefix), span);
        if (attr) t.setAttribute(attr, "");
      });
      return g;
    },
  });
}

/**
 * Shared canvas cloud, min/max columns, hull, supporting line and optional mixture marks.
 *   createCloudRenderer(ctx, chartSlot, options) -> drawChart(state, model, opt, sv, mix = null, show = true)
 * options (review 044 repair; every one is off by default, so a caller that passes none draws exactly as before):
 *   pointer     true: hovering, clicking or tapping a column reads it as the keyboard does (chart.js keyboard.pointer;
 *               X-23); onSelect(row) after a click or tap selects a column, onFocus(row) when a column is shown
 *   vertexTip   (row, state, model) => words added to a vertex column's reader text
 *   ringLabel   true: on a plot with less than 24 px per N (no room for the grade vector), label the touched vertex
 *               "N = k"
 *   frame       (state, model, mix) => the top of the near view, or null for the usual top: the near view framed on
 *               one part of the plot (2.11's mixture). In a framed view the τ line, its ring and its "τ" are drawn in
 *               muted ink, the touched report's vector and "H(m)" are left to the caller's key, a column whose smallest
 *               E lies above the frame shows only its triangle, the mixture's own edge of H(m) is drawn heavier, the
 *               bottom of the frame is inset by insetBottom (px, or below 1 a share of the plot's height), and with gapBracket a labeled bracket joins the
 *               mixture's diamond to the best single report's square ("gap .1464"; hook "chart-gap")
 */
export function createCloudRenderer(ctx, chartSlot, options = {}) {
  const T = CONFIG.text;
  const O = { pointer: false, onSelect: null, onFocus: null, vertexTip: null, ringLabel: false, frame: null, gapBracket: false, insetBottom: 0, ...options };
  let cloudLayer = null;
  let paint = { points: [], yTop: 1 };
  ctx.onCleanup(() => cloudLayer?.remove());
  return function drawChart(state, model, opt, sv, mix = null, show = true) {
    const C = CONFIG.chart;
    const M = model.M;
    const near = state.view !== "all";
    const frameTop = near && typeof O.frame === "function" ? O.frame(state, model, mix) : null;
    const framed = Number.isFinite(frameTop) && frameTop > 0;
    const yTop = !near ? model.yAll : framed ? frameTop : model.yNear;
    const rows = model.cloud.byN.map((r) => ({ ...r, top: Math.min(r.maxEw, yTop), above: r.maxEw > yTop, out: r.minEw > yTop, vertex: model.hull.some((v) => v.N === r.N) }));
    // the near view of v1 holds every column's smallest E; only a framed view can leave one above it
    const inView = rows.filter((d) => !d.out);
    const width = Math.max(1, Math.round(chartSlot.clientWidth || ctx.width()));
    const height = Math.max(C.minHeight, Math.min(C.maxHeight, Math.round(width * C.aspect)));
    const inner = width - C.marginLeft - C.marginRight;
    // every N when there is room; otherwise every fifth N (0, 5, 10, 15 for the six sites), so labels never run together
    const roomy = inner / (M + 1) >= C.tickRoom;
    const xticks = [];
    for (let t = 0; t <= M; t += 1) if (roomy || t % C.tickStep === 0) xticks.push(t);
    const hull = model.hull;
    const touched = (show ? sv.vertices : []).filter((v) => v.Ew <= yTop);
    const lineEnd = (state.tau > 0) ? Math.min(M, (yTop - sv.value) / state.tau) : M;
    const line = [{ N: Math.max(0, -sv.value / state.tau), y: 0 }, { N: lineEnd, y: sv.value + state.tau * lineEnd }];
    const fmtE = model.fmt.E;
    const Hat = (N) => matchedDisclosure(null, hull, N).H;
    const titleOf = (d) => {
      let s = `N = ${formatCount(d.N)}: ${formatCount(d.count)} ${d.count === 1 ? "report states" : "reports state"} ${formatCount(d.N)} pairs. `;
      s += d.count === 1
        ? `Its ${model.wrong}: ${fmtE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}).`
        : `Their ${model.wrong} run from ${fmtE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}) to ${fmtE(d.maxEw)}.`;
      if (show) {
        if (d.vertex) s += ` The smallest is a vertex of H(m).${typeof O.vertexTip === "function" ? O.vertexTip(d, state, model) : ""}`;
        else s += ` The smallest lies above H(${formatCount(d.N)}) = ${fmtE(Hat(d.N))}, which a mixture of two reports reaches.`;
      }
      return s;
    };
    paint = { points: model.cloud.points ?? [], yTop };
    const columns = [
      { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
      { label: "Reports", value: "count", format: (v) => formatCount(v) },
      { label: "Smallest E", value: "minEw", format: (v) => fmtE(v) },
      { label: "Report with the smallest E", value: (d) => Array.from(d.minGrade), format: (v) => formatGrades(v) },
      { label: "Largest E", value: "maxEw", format: (v) => fmtE(v) },
    ];
    if (show) columns.push({ label: "H at this N", value: (d) => Hat(d.N), format: (v) => fmtE(v) });
    // the gap bracket and its words sit on the side of the mixture where the words cross the fewest marks (columns
    // that reach that height, the τ line) and stay inside the plot
    const bracket = framed && O.gapBracket && mix && mix.best && mix.psi > 0 && mix.gap > 0 ? (() => {
      const mid = (mix.H + mix.best.Ew) / 2;
      // the label's reach in N and its half height in E (estimated glyph width, as for "N = k")
      const perN = inner / (M + 2 * C.xPad);
      const near = (C.bracketGap + C.bracketLabelGap) / perN;
      const span = (C.charWidth * `gap ${fmtE(mix.gap)}`.length) / perN;
      const halfE = ((C.labelGap / 2) * yTop) / Math.max(1, (height - C.marginTop - C.marginBottom) * (O.insetBottom > 0 && O.insetBottom < 1 ? 1 - O.insetBottom : 1) - (O.insetBottom >= 1 ? O.insetBottom : 0));
      // what the words would cross on one side: a column whose reports reach the label's height, the τ line, the edge
      const crossings = (side) => {
        const [a, b] = side > 0 ? [mix.N + near, mix.N + near + span] : [mix.N - near - span, mix.N - near];
        let n = model.cloud.byN.filter((r) => r.N !== mix.N && r.N >= a && r.N <= b && r.minEw <= mid + halfE).length;
        if (state.tau > 0) {
          const lo = (mid - halfE - sv.value) / state.tau;
          const hi = (mid + halfE - sv.value) / state.tau;
          if (hi >= a && lo <= b) n += 2;
        }
        if (a < -C.xPad || b > M + C.xPad) n += 10;
        return n;
      };
      return { N: mix.N, y1: mix.H, y2: mix.best.Ew, mid, gap: mix.gap, side: crossings(1) <= crossings(-1) ? 1 : -1 };
    })() : null;
    // the foot inset of a framed view: px, or below 1 a share of the plot's height (so it scales with the chart)
    const footInset = O.insetBottom > 0 && O.insetBottom < 1 ? Math.round(O.insetBottom * (height - C.marginTop - C.marginBottom)) : O.insetBottom;
    const keyboard = { data: rows, x: "N", y: (d) => Math.min(d.minEw, yTop), key: (d) => `N${d.N}`, label: T.keyboardLabel, title: titleOf };
    if (O.pointer) keyboard.pointer = true;
    if (typeof O.onSelect === "function") keyboard.onSelect = O.onSelect;
    if (typeof O.onFocus === "function") keyboard.onFocus = O.onFocus;
    const fig = plot(chartSlot, {
      alt: T.chartAlt + (show ? T.chartAltBoundary : ""),
      table: { caption: T.tableCaption, columns, rows },
      width, height,
      marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
      x: { domain: [-C.xPad, M + C.xPad], ticks: xticks, tickFormat: (d) => formatCount(d), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
      y: { domain: [0, yTop], label: model.weighted ? T.yLabelWeighted : T.yLabel, labelArrow: "none", grid: true, ...(framed && O.insetBottom > 0 ? { insetBottom: footInset } : {}) },
      color: { type: "identity" },
      marks: (c, P) => {
        // a framed view draws the τ line and its ring as secondary marks
        const ink = framed ? c.plotMuted : c.plotFg;
        const marks = [
          P.ruleX(inView, { x: "N", y1: "minEw", y2: "top", stroke: c.neutral[4], strokeWidth: C.column }),
          P.dot(rows.filter((d) => d.above), { x: "N", y: () => yTop, symbol: "triangle", r: C.triangle, fill: c.neutral[4] }),
          P.dot(inView, { x: "N", y: "minEw", r: C.minDot, fill: c.plotBg, stroke: c.plotFg, strokeWidth: C.thin }),
        ];
        if (show) {
          const vectorLabel = framed || !roomy ? [] : touched.slice(0, 1);
          const nLabel = !framed && !roomy && O.ringLabel ? touched.slice(0, 1) : [];
          const toLeft = touched[0]?.N > M / 2;
          // "N = k" goes below and right of its ring, where the τ line and H(m) leave room, when it fits there (the
          // vertex is not the last, sits well above the axis, and the words end inside the figure); else up and left
          const plotH = height - C.marginTop - C.marginBottom;
          const nAt = nLabel[0];
          const nRight = nAt ? C.marginLeft + ((nAt.N + C.xPad) / (M + 2 * C.xPad)) * inner + C.labelGap + C.charWidth * `${T.ringN}${formatCount(nAt.N)}`.length : 0;
          const nBelow = Boolean(nAt) && nAt.N < M && nAt.Ew > (yTop * C.belowRoom) / plotH && nRight <= width - C.edgeRoom;
          marks.push(
            P.line(hull, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
            framed && mix && mix.psi > 0
              ? P.line([mix.lower, mix.upper], { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: C.activeHullWidth, strokeDasharray: C.hullDash, clip: true })
              : null,
            P.line(line, { x: "N", y: "y", stroke: ink, strokeWidth: C.lineWidth, clip: true }),
            P.dot(hull.filter((v) => v.Ew <= yTop), { x: "N", y: "Ew", r: C.vertexDot, fill: c.plotFg, stroke: c.plotBg }),
            P.dot(touched, { x: "N", y: "Ew", r: C.ring, fill: "none", stroke: ink, strokeWidth: C.ringWidth }),
            P.text([line[1]], { x: "N", y: "y", text: () => "τ", dx: C.labelGap / 2, dy: C.labelGap, textAnchor: "start", fill: ink, fontStyle: "italic" }),
            P.text([hull.at(-1)].filter((v) => !framed && v.Ew <= yTop && inner >= C.roomyPlot), { x: "N", y: "Ew", text: () => "H(m)", dx: -C.labelGap, dy: C.hullLabelDy, textAnchor: "end", fill: c.plotFg }),
            numText(vectorLabel, {
              render(index, scales, values, dims, context, next) {
                const mark = next(index, scales, values, dims, context);
                mark.setAttribute("data-prx-cloud-report-label", "");
                return mark;
              },
              x: "N", y: "Ew", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v),
              dx: toLeft ? -C.labelGap : C.labelGap, dy: -C.labelGap,
              textAnchor: toLeft ? "end" : "start", fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke",
            }),
            // a narrow plot names the touched vertex by its N (review 044 repair, G2-F1: "ring labeled N = 14")
            prefixedNumber(P, nLabel, {
              prefix: T.ringN, value: (d) => d.N, format: (v) => formatCount(v), attr: "data-prx-ring-label",
              x: "N", y: "Ew", dx: nBelow || !toLeft ? C.labelGap : -C.labelGap, dy: nBelow ? C.labelGap + C.belowDrop : -C.labelGap,
              textAnchor: nBelow || !toLeft ? "start" : "end", fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke",
            }),
          );
          if (mix) {
            marks.push(
              P.ruleX([mix], { x: "N", y1: 0, y2: "H", stroke: c.plotMuted, strokeDasharray: C.mixRule }),
              mix.best ? P.dot([mix], { x: "N", y: (d) => d.best.Ew, symbol: "square", r: C.bestSquare,
                render(index, scales, values, dims, context, next) {
                  const mark = next(index, scales, values, dims, context);
                  mark.setAttribute("data-prx-cloud-best", "");
                  return mark;
                }, fill: "none", stroke: c.plotFg, strokeWidth: C.thin, clip: true }) : null,
            );
            if (bracket) {
              marks.push(
                P.link([bracket], { x1: "N", x2: "N", y1: "y1", y2: "y2", dx: bracket.side * C.bracketGap, stroke: c.plotFg, strokeWidth: C.thin, markerStart: "tick-x", markerEnd: "tick-x" }),
                prefixedNumber(P, [bracket], {
                  prefix: "gap ", value: (d) => d.gap, format: (v) => fmtE(v), hook: "chart-gap", attr: "data-prx-gap-label",
                  x: "N", y: "mid", dx: bracket.side * (C.bracketGap + C.bracketLabelGap), textAnchor: bracket.side < 0 ? "end" : "start",
                  fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke",
                }),
              );
            }
            marks.push(P.dot([mix], { x: "N", y: "H", symbol: "diamond", r: C.mixDot,
              render(index, scales, values, dims, context, next) {
                const mark = next(index, scales, values, dims, context);
                mark.setAttribute("data-prx-cloud-mix", "");
                return mark;
              }, fill: c.plotBg, stroke: c.plotFg, strokeWidth: 2 }));
          }
        }
        return marks.filter(Boolean);
      },
      keyboard,
    });
    // Preserve the usual direct-label offset unless a mixture's best-report square intersects it.
    // Measure actual SVG glyphs so this works for both viewport sizes and grade-vector lengths.
    const reportLabel = fig.svg.querySelector('[data-prx-cloud-report-label] text');
    const bestSquare = fig.svg.querySelector('[data-prx-cloud-best] path');
    if (reportLabel && bestSquare) {
      const labelBox = reportLabel.getBoundingClientRect();
      const squareBox = bestSquare.getBoundingClientRect();
      const pad = C.halo + C.thin;
      const intersects = labelBox.width > 0 && labelBox.left < squareBox.right + pad && labelBox.right > squareBox.left - pad
        && labelBox.top < squareBox.bottom + pad && labelBox.bottom > squareBox.top - pad;
      if (intersects) {
        const svgBox = fig.svg.getBoundingClientRect();
        const ratio = width / svgBox.width;
        let shift = squareBox.top - pad - labelBox.bottom;
        if (labelBox.top + shift < svgBox.top + C.marginTop / ratio) shift = squareBox.bottom + pad - labelBox.top;
        reportLabel.setAttribute("transform", `${reportLabel.getAttribute("transform") ?? ""} translate(0,${shift * ratio})`);
        reportLabel.setAttribute("data-prx-label-placement", "avoids-best-square");
        const shifted = reportLabel.getBoundingClientRect();
        const leader = fig.svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
        leader.setAttribute("x1", fig.scale("x").apply(touched[0].N));
        leader.setAttribute("y1", fig.scale("y").apply(touched[0].Ew));
        leader.setAttribute("x2", (Math.min(shifted.right, Math.max(shifted.left, squareBox.right)) - svgBox.left) * ratio);
        leader.setAttribute("y2", ((shift < 0 ? shifted.bottom : shifted.top) - svgBox.top) * ratio);
        leader.setAttribute("stroke", fig.palette.plotMuted);
        leader.setAttribute("stroke-width", C.thin);
        leader.setAttribute("aria-hidden", "true");
        leader.setAttribute("data-prx-report-leader", "");
        reportLabel.parentNode.before(leader);
      }
    }
    if (!cloudLayer) {
      cloudLayer = canvasLayer(fig, (g, { x, y, palette }) => {
        g.save?.();
        g.globalAlpha = C.dashAlpha;
        g.strokeStyle = palette.neutral[4];
        g.lineWidth = C.dashWidth;
        g.beginPath();
        for (const p of paint.points) {
          if (p.Ew > paint.yTop) continue;
          const px = x(p.N);
          const py = y(p.Ew);
          g.moveTo(px - C.dash, py);
          g.lineTo(px + C.dash, py);
        }
        g.stroke();
        g.restore?.();
      });
    }
  };
}

// ---------------------------------------------------------------------------------------------- the τ range of a vertex

/** The τ range in which vertex q of H(m) is the best report: from the slope of the edge before it (0 for the first
 *  vertex) to the slope of the edge after it (½, the largest τ, for the last). onSlider: a τ of the slider lies in it;
 *  whole: every τ of the slider lies in it. */
export function rangeOf(model, q) {
  const from = q > 0 ? model.slopes[q - 1] : 0;
  const last = q === model.hull.length - 1;
  const to = last ? CONFIG.half : model.slopes[q];
  const { min, max } = CONFIG.tau;
  return { from, to, last, onSlider: to > min && from < max, whole: from <= min && to >= max };
}

/** The slider value that picking vertex q sets: the current τ when it already lies in the vertex's range, else the
 *  slider step nearest the middle of the range's part on the slider, strictly inside the range (the last vertex keeps
 *  τ = ½); null when no step lies inside (a vertex below the slider). */
export function tauFor(model, q, current) {
  const r = rangeOf(model, q);
  const { min, max, step } = CONFIG.tau;
  const digits = stepDecimals(step);
  const inside = (t) => t >= min && t <= max && t > r.from && (r.last ? t <= r.to : t < r.to);
  if (inside(current)) return current;
  const lo = Math.max(r.from, min);
  const hi = Math.min(r.to, max);
  if (!(hi > lo)) return null;
  const mid = roundTo(min + Math.round(((lo + hi) / 2 - min) / step) * step, digits);
  for (let k = 0; k <= Math.ceil((max - min) / step); k += 1) {
    for (const t of [roundTo(mid + k * step, digits), roundTo(mid - k * step, digits)]) if (inside(t)) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fr prx-frt",
    css: CSS + TAU_CSS,
    // the shared result-first frame (review 044, X-01): controls and preset row, the read-out, the chart first; base.js
    // only moves nodes, so keys, presets, hooks and the one live region stay as they were
    layout: "result-first",
    keys: {
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
      view: { type: "choice", values: CONFIG.views.slice(), value: CONFIG.view },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;

      // helpers: a read-out number with its hook; nodes for a grade vector
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const gradeNum = (name, g) => h("span", { class: "prx-fr-report" }, ro(name, Array.from(g), formatGrades(Array.from(g))),
        h("span", { class: "prx-fr-decoded" }, ` = ${blocksText(g, SIX_E.ids)}`));
      const famNode = (fam) => { const node = familyNameNode(ctx, { family: fam }); node.classList.add("prx-fr-sym"); return node; };
      const point = (model, v, prefix) => ["(", ro(`${prefix}N`, v.N, formatCount(v.N)), ", ", ro(`${prefix}E`, v.Ew, model.fmt.E(v.Ew)), ")"];
      // the upper end of a τ range: an edge slope, or ½ (the largest τ, written as the slider writes τ)
      const upperText = (m, r) => (r.last ? formatSetting(r.to) : m.fmt.slope(r.to));
      const rangeText = (m, r) => (r.from > 0 ? `${T.rangeFrom} ${m.fmt.slope(r.from)} ${T.rangeTo} ${upperText(m, r)}` : `${T.rangeUpTo} ${upperText(m, r)}`);
      // the model last drawn: a band, a row or a point picks one of its vertices
      let model = modelOf("six", ctx.state.family);

      // --- controls: τ with its ruler, then Family and View
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderHint, onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.primaryControl(tau.root);
      // the slider's hint moves under the chart, beside the key of the line it describes, so the read-out stays within
      // 150 px of the slider (review 044, X-01); the slider still names it as its description (aria-describedby)
      const sliderHint = tau.root.querySelector(".prx-hint");
      // the τ ruler: one band per vertex that a τ of the slider touches, in the track's column of the slider's grid
      const ruler = h("div", { class: "prx-frt-ruler", role: "group", "aria-label": T.rulerLabel });
      tau.root.append(ruler);
      // the family labels name the current example's families (the four-unit example offers all reports only)
      const famLabel = (f, example = "six") => {
        const words = f === "all" ? [T.familyAll] : ["at most ", ctx.num(CONFIG.cap, formatCount(CONFIG.cap)), " grades"];
        if (example === "tb16" && f !== "all") return [...words, ` ${T.notUsed}`];
        const fam = modelOf(example, f).cloud.family;
        return [famNode(fam), " · ", ctx.num(fam.size, formatCount(fam.size)), ` ${T.reports} (`, ...words, ")"];
      };
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend, name: "family", className: "prx-fr-family",
        options: CONFIG.families.map((f) => ({ value: f, label: famLabel(f) })),
        value: ctx.state.family, onChange: (v) => ctx.set({ family: v }),
      });
      const familyFixed = h("p", { class: "prx-hint", hidden: true, text: T.familyFixed });
      familySwitch.root.append(familyFixed);
      const viewSwitch = ctx.radioGroup({
        legend: T.viewLegend, name: "view", className: "prx-fr-view",
        options: [{ value: "near", label: T.viewNear }, { value: "all", label: T.viewAll }],
        value: ctx.state.view, onChange: (v) => ctx.set({ view: v }),
      });
      const toggles = h("div", { class: "prx-frt-toggles" }, familySwitch.root, viewSwitch.root);
      ctx.controls.append(tau.root, toggles);

      // --- the chart (with its label line, the key of the marks τ moves and the vector positions) and its result card
      const head = h("p", { class: "prx-fr-head" });
      const chartSlot = ctx.primaryGraphic(h("div", { class: "prx-fr-chart" }));
      const labelLine = h("p", { class: "prx-fr-label", "data-prx-part": "readout" });
      const keyMain = h("div", { class: "prx-fr-legend prx-frt-keymain", "data-prx-part": "legend" });
      const vectorKey = h("p", { class: "prx-fr-vector-key", "data-prx-part": "notes" },
        `Vector positions: ${SIX_E.ids.join(" / ")}. Smaller grades mean higher priority; equal grades withhold. > means “stated above”.`);
      const available = [...new Set(CONFIG.families.flatMap(f => {
        const m = modelOf("six", f);
        return m.hull.filter((_, q) => tauFor(m, q, CONFIG.tau.min) !== null).map(v => v.N);
      }))].sort((a, b) => a - b);
      const vertexButtons = available.map(N => {
        const button = h("button", { type: "button", class: "prx-seg", "data-prx-frontier-vertex": String(N),
          "data-prx-focus-key": `frontier-vertex:${N}`, "aria-label": `Frontier vertex: ${formatCount(N)} pairs stated` },
          ctx.num(N, formatCount(N)));
        ctx.listen(button, "click", () => pick(N, { pointer: false }));
        return button;
      });
      const vertexPicker = h("div", { class: "prx-frt-vertex-select", role: "group", "aria-label": "Choose a frontier vertex by pairs stated" },
        h("span", { "aria-hidden": "true", text: "Choose N" }), ...vertexButtons);
      const main = h("div", { class: "prx-split-main prx-frt-main" }, head, chartSlot, vertexPicker, labelLine, keyMain, vectorKey);
      const card = ctx.disclosure({ name: "vertices-tau", title: T.rangeTitle, placement: "none", className: "prx-frt-card" });
      const rangeTable = h("table", { class: "prx-frt-ranges" });
      card.body.append(rangeTable, h("p", { class: "prx-hint", text: T.rangeHint }));
      ctx.charts.append(h("div", { class: "prx-split prx-frt-split" }, main, h("div", { class: "prx-split-side prx-frt-side" }, card.root)));

      // --- closed boxes: the key of the cloud's own marks; v1's vertex table with reports and slopes (X-14)
      const keyBox = ctx.disclosure({ name: "key", title: T.keyTitle });
      const keyRest = h("div", { class: "prx-fr-legend", "data-prx-part": "legend" });
      keyBox.body.append(keyRest);
      const dataBox = ctx.disclosure({ name: "data", title: T.dataTitle });
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexHeadingId = uid("prx-fr-vertices");
      dataBox.body.append(vertexBox);

      // phones (the frame's narrow order, X-16): Family and View follow the chart, and the result card starts closed
      // (the read-out names the touched vertex's τ range); the nodes move, so keys, labels and focus stay
      const narrow = ctx.win.matchMedia?.(CONFIG.narrowQuery) ?? null;
      const placeToggles = () => {
        const below = Boolean(narrow?.matches);
        if (below === (toggles.parentNode === main)) return;
        const had = toggles.contains(ctx.doc.activeElement) ? ctx.doc.activeElement : null;
        if (below) main.append(toggles); else tau.root.after(toggles);
        had?.focus({ preventScroll: true });
      };
      placeToggles();
      card.open = !narrow?.matches;
      if (narrow) ctx.listen(narrow, "change", () => { placeToggles(); card.open = !narrow.matches; });

      // --- picking a vertex: a band of the ruler, a row of the card or a point of the chart sets τ inside its range;
      // a click or tap moves focus to the slider (arrow keys go on from there), Enter or Space keeps focus where it is
      function pick(N, { pointer }) {
        const q = model.hull.findIndex((v) => v.N === N);
        if (q < 0) return;
        const target = tauFor(model, q, ctx.state.tau);
        if (target === null) return;
        if (target !== ctx.state.tau) ctx.set({ tau: target });
        if (pointer) tau.input.focus({ preventScroll: true });
      }
      ctx.listen(ruler, "click", (e) => {
        const band = e.target?.closest?.("[data-prx-band]");
        if (band) pick(Number(band.getAttribute("data-prx-band")), { pointer: e.detail !== 0 });
      });
      ctx.listen(rangeTable, "click", (e) => {
        const row = e.target?.closest?.("tr[data-prx-pick]");
        if (row) pick(Number(row.getAttribute("data-prx-vertex")), { pointer: e.detail !== 0 });
      });
      // a vertex column's reader text: the τ range in which the vertex is best and its risk at the current τ
      const vertexTip = (d, state, m) => {
        const q = m.hull.findIndex((v) => v.N === d.N);
        if (q < 0) return "";
        const r = rangeOf(m, q);
        const risk = evaluateReport(Array.from(m.hull[q].grade), m.E, m.opts.w ? { tau: state.tau, w: m.opts.w } : { tau: state.tau }).risk;
        return ` ${T.tipBest} ${rangeText(m, r)}${r.onSlider ? "" : ` (${T.belowSlider})`}; ${T.tipRisk} ${formatSetting(state.tau)}: ${m.fmt.risk(risk)}.`;
      };
      let focusedColumn = null;
      const drawChart = createCloudRenderer(ctx, chartSlot, {
        pointer: true, ringLabel: true, vertexTip,
        onFocus: (d) => { focusedColumn = d; },
        onSelect: (d) => pick(d.N, { pointer: true }),
      });
      // Enter or Space on a column's keyboard point clicks it with no pointer position (chart.js leaves that click)
      ctx.listen(chartSlot, "click", (e) => {
        if (e.detail !== 0 || !focusedColumn || !e.target?.closest?.(".prx-kbd-point")) return;
        pick(focusedColumn.N, { pointer: false });
      });

      // --------------------------------------------------------------------------------------- drawing

      function drawRuler(state, m, sv) {
        const { min, max } = CONFIG.tau;
        const on = new Set(sv.vertices.map((v) => v.N));
        const bands = m.hull.map((v, q) => ({ v, q, r: rangeOf(m, q) })).filter((b) => b.r.onSlider);
        ruler.replaceChildren(...bands.map(({ v, q, r }) => {
          const target = tauFor(m, q, state.tau);
          const sets = target !== null && target !== state.tau ? ` Sets τ to ${formatSetting(target)}.` : "";
          const label = `N = ${formatCount(v.N)}: the best report for τ ${rangeText(m, r)}.${sets}`;
          const width = (100 * (Math.min(r.to, max) - Math.max(r.from, min))) / (max - min);
          return h("button", {
            type: "button", class: "prx-frt-band", "aria-pressed": String(on.has(v.N)), "aria-label": label,
            "data-prx-band": String(v.N), "data-prx-focus-key": `ruler:N${v.N}`, style: { "flex-basis": `${width}%` },
          }, ctx.num(v.N, formatCount(v.N)));
        }));
      }

      function drawHead(state, m) {
        const fam = m.cloud.family;
        head.replaceChildren(`${T.headSix} `, `${T.headIn} `, ro("familySize", fam.size, formatCount(fam.size)), ` ${T.headInEnd} `,
          famNode(fam), ".");
      }

      // the key of the marks τ moves, under the chart (with the slider's hint), and the cloud's own marks in "Key"
      function drawKeys(state, m) {
        const key = (cls, ...text) => h("span", { class: "prx-fr-key" }, h("span", { class: `prx-fr-swatch ${cls}` }), h("span", {}, ...text));
        const rest = [key("prx-fr-sw-dash", T.legendReport), key("prx-fr-sw-min", T.legendMin.replace("⟨E⟩", m.wrong))];
        const yTop = state.view === "all" ? m.yAll : m.yNear;
        if (m.cloud.byN.some((r) => r.maxEw > yTop)) rest.push(key("prx-fr-sw-above", T.legendAbove));
        keyRest.replaceChildren(...rest);
        keyMain.replaceChildren(
          key("prx-fr-sw-line", `${T.legendLine} `, ctx.num(state.tau, formatSetting(state.tau))),
          key("prx-fr-sw-ring", T.legendRing),
          key("prx-fr-sw-vertex", T.legendVertex),
          key("prx-fr-sw-hull", `${T.legendHull} `, captionNode(ctx, "mixture-not-report")),
          sliderHint,
        );
      }

      function drawHeadline(state, m, opt, sv) {
        const fmt = m.fmt;
        const fam = opt.family;
        const tauNode = ctx.num(state.tau, formatSetting(state.tau));
        const sym = famNode(fam);
        if (sv.vertices.length > 1) {
          const a = sv.vertices[0];
          const b = sv.vertices.at(-1);
          ctx.readout.set(["τ = ", tauNode, " in ", sym, ": the line of slope τ lies along the edge from ", ...point(m, a, "edgeA"), " to ",
            ...point(m, b, "edgeB"), "; the reports at both ends, ",
            ...opt.grades.flatMap((g, k) => [k ? " and " : "", gradeNum(`tiedGrade${k}`, g)]),
            `, share the smallest ${T.riskWords}, `, ro("risk", opt.risk, fmt.risk(opt.risk)), "."]);
        } else {
          // review 044 copy (G2-F1, G2-F9): how many of the M pairs the report states, and the τ range in which it is best
          const v = sv.vertex;
          const q = m.hull.findIndex((x) => x.N === v.N);
          const r = rangeOf(m, q);
          const upper = r.last ? ro("bestTo", r.to, formatSetting(r.to)) : ro("bestTo", r.to, fmt.slope(r.to));
          const range = r.from > 0 ? [T.bestFor, ro("bestFrom", r.from, fmt.slope(r.from)), ` ${T.rangeTo} `, upper]
            : [T.bestFor.replace(/from $/, `${T.rangeUpTo} `), upper];
          ctx.readout.set(["τ = ", tauNode, " in ", sym, ": the line of slope τ touches H(m) at the vertex N = ", ro("N", v.N, formatCount(v.N)),
            " of ", ctx.num(m.M, formatCount(m.M)), ` ${T.ofPairs}, E = `, ro("E", v.Ew, fmt.E(v.Ew)), ", the report ", gradeNum("grades", v.grade),
            `, with ${T.riskWords} `, ro("risk", opt.risk, fmt.risk(opt.risk)), ". ", ...range, r.whole ? T.sameOnSlider : "."]);
        }
        const parts = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated). ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`];
        labelLine.replaceChildren(...parts);
      }

      // the result card: every vertex, its E and its τ range; the touched row marked; a vertex on the slider has a button
      function drawRanges(state, m, sv) {
        const on = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = m.hull.map((v, q) => {
          const r = rangeOf(m, q);
          const target = r.onSlider ? tauFor(m, q, state.tau) : null;
          const n = ctx.num(v.N, formatCount(v.N));
          const what = `N = ${formatCount(v.N)}, the best report for τ ${rangeText(m, r)}`;
          const cell = r.onSlider
            ? h("button", {
              type: "button", class: "prx-frt-pick", "data-prx-focus-key": `range:N${v.N}`,
              "aria-label": target !== null && target !== state.tau ? `${what}: set τ to ${formatSetting(target)}` : `${what}: touched at τ = ${formatSetting(state.tau)}`,
            }, n)
            : h("span", { class: "prx-frt-static" }, n);
          const upper = ctx.num(r.to, upperText(m, r));
          const span = r.from > 0 ? [`${T.rangeFrom} `, ctx.num(r.from, m.fmt.slope(r.from)), ` ${T.rangeTo} `, upper] : [`${T.rangeUpTo} `, upper];
          return h("tr", { "data-prx-vertex": String(v.N), "data-prx-pick": r.onSlider, "aria-current": on.has(v.N) ? "true" : undefined },
            h("th", { scope: "row" }, cell),
            h("td", {}, ctx.num(v.Ew, m.fmt.E(v.Ew))),
            h("td", {}, ...span, r.onSlider ? null : h("span", { class: "prx-frt-below" }, ` (${T.belowSlider})`)));
        });
        rangeTable.replaceChildren(h("caption", { text: T.rangeCaption }), h("thead", {}, h("tr", {}, ...T.rangeHead.map(th))), h("tbody", {}, ...rows));
      }

      function drawVertices(state, m, sv) {
        const fmt = m.fmt;
        const hull = m.hull;
        const touched = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = hull.map((v, q2) => {
          const s = m.slopes[q2];
          const mark = touched.has(v.N) ? h("span", { class: "prx-fr-touched" }, `${T.touchedMark} at τ = `, ctx.num(state.tau, formatSetting(state.tau))) : "";
          return h("tr", { class: touched.has(v.N) ? "prx-fr-row-touched" : "" },
            h("th", { scope: "row" }, ro(`vN-${q2}`, v.N, formatCount(v.N))),
            h("td", {}, ro(`vE-${q2}`, v.Ew, fmt.E(v.Ew))),
            h("td", {}, gradeNum(`vGrade-${q2}`, v.grade), " ", mark),
            h("td", {}, s === undefined ? T.noNext : ro(`slope-${q2 + 1}`, s, fmt.slope(s))));
        });
        vertexBox.replaceChildren(
          h("h4", { class: "prx-fr-heading", id: vertexHeadingId, text: T.vertexHeading }),
          h("div", { class: "prx-fr-table-wrap" }, h("table", { class: "prx-fr-table", "aria-labelledby": vertexHeadingId },
            h("thead", {}, h("tr", {}, th("N"), th("E"), th("Report"), th("Slope of the next edge"))),
            h("tbody", {}, ...rows))),
          h("p", { class: "prx-fr-note", text: T.vertexNote.replace("⟨E⟩", m.wrong) }));
        ctx.scrollRegion(vertexBox.querySelector(".prx-fr-table-wrap"), T.vertexHeading);
      }

      return {
        render(state, info = {}) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            model = modelOf("six", state.family);
            tau.set(state.tau);
            familySwitch.set(state.family);
            viewSwitch.set(state.view);
            const opt = optimumOf(model, state.tau);
            const sv = supportingVertex(model.hull, state.tau, { M: model.M });
            const selectable = new Set(model.hull.filter((_, q) => tauFor(model, q, state.tau) !== null).map(v => v.N));
            available.forEach((N, i) => {
              vertexButtons[i].hidden = !selectable.has(N);
              vertexButtons[i].setAttribute("aria-pressed", String(sv.vertices.some(v => v.N === N)));
            });
            drawRuler(state, model, sv);
            drawHead(state, model);
            drawHeadline(state, model, opt, sv);
            // opening a box changes nothing the chart shows: keep it (and a pinned tip) as it is
            if (info.reason !== "disclosure") drawChart(state, model, opt, sv);
            drawKeys(state, model);
            drawRanges(state, model, sv);
            drawVertices(state, model, sv);
            ctx.caption.textContent = T.note;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
