// Full v1 S-01 shared model and drawing implementation, split into four v3 case apps.
// Source views, cut controls, tables and keyboard figures are retained; course gates are removed.
import { appLink, createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, plot } from "../shared/chart.js";
import { formatCount, formatExpectedCount, formatGrades, formatPercent, formatProb, formatRisk, formatSci, formatSetting, formatShare, formatSig, formatSizes } from "../shared/format.js";
import { captionNode, exposeResult, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import {
  bestReports, cutGrade, disclosure, evaluateReport, exactOptimum, fixedOrderDP, lowerHull, matchedDisclosure, pairCount,
  relationChange, reportCloud, reportsAtN, ruleGap, scoreOrder, tauPath,
} from "../pr-core.js";
import { fill } from "./report-card.js";
import CDE from "../../data/released/case-cde.json" with { type: "json" };
import TAUPATH from "../../data/released/cde-taupath.json" with { type: "json" };

export const CDE_COMMON_CSS = '.prx-cd .prx-predict legend,\n.prx-cd .prx-radio-group legend {\n  font-size: 1em;\n  line-height: inherit;\n}\n\n.prx-cd .prx-predict .prx-radio {\n  display: flex;\n  font-weight: 400;\n}\n\n.prx-cd .prx-controls {\n  align-items: flex-start;\n}\n\n.prx-cd .prx-cd-inline .prx-radio {\n  display: inline-flex;\n  margin-right: 1rem;\n  font-weight: 400;\n}\n\n.prx-cd .prx-cd-pairpick {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.5rem 1rem;\n}\n\n/* --- the setting --- */\n.prx-cd .prx-cd-settings {\n  margin: 0 0 0.75rem;\n  padding: 0.5rem 0.75rem;\n  background: var(--prx-bg);\n  border-left: 4px solid var(--prx-border-strong);\n  border-radius: var(--prx-radius, 6px);\n}\n\n.prx-cd .prx-cd-settings p {\n  margin: 0 0 0.25rem;\n}\n\n.prx-cd .prx-cd-settings .prx-cd-heading {\n  color: var(--prx-fg-heading);\n}\n\n.prx-cd .prx-cd-settings .prx-cd-note {\n  color: var(--prx-fg-muted);\n}\n\n/* --- boxes --- */\n.prx-cd .prx-cd-heading {\n  margin: 0 0 0.25rem;\n  font-size: 1em;\n  font-weight: 600;\n  color: var(--prx-plot-fg);\n}\n\n.prx-cd .prx-cd-box {\n  margin: 0.75rem 0 0;\n  padding: 0.5rem 0.75rem 0.75rem;\n  background: var(--prx-plot-bg);\n  color: var(--prx-plot-fg);\n  border: 1px solid var(--prx-border);\n  border-radius: var(--prx-radius, 6px);\n  min-width: 0;\n}\n\n.prx-cd .prx-cd-box p {\n  margin: 0 0 0.3rem;\n}\n\n.prx-cd .prx-cd-box .prx-cd-heading:not(:first-child) {\n  margin-top: 0.75rem;\n}\n\n.prx-cd .prx-cd-note {\n  margin: 0.4rem 0 0;\n  font-size: 0.9em;\n  color: var(--prx-plot-muted);\n}\n\n.prx-cd .prx-cd-cuts {\n  font-weight: 600;\n}\n\n.prx-cd .prx-cd-school {\n  font-weight: 600;\n}\n\n.prx-cd .prx-cd-groups {\n  font-weight: 400;\n  overflow-wrap: anywhere;\n}\n\n/* stands in the place of a box while its question waits */\n.prx-cd .prx-cd-wait {\n  margin: 0.75rem 0 0;\n  padding: 0.6rem 0.75rem;\n  text-align: center;\n  color: var(--prx-fg-muted);\n  border: 1px dashed var(--prx-border-strong);\n  border-radius: var(--prx-radius, 6px);\n}\n\n.prx-cd .prx-cd-card-chart,\n.prx-cd .prx-cd-cloud-chart,\n.prx-cd .prx-cd-path-chart {\n  min-width: 0;\n  max-width: 100%;\n}\n\n/* --- legends --- */\n.prx-cd .prx-cd-legend {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.25rem 0.8rem;\n  margin: 0.3rem 0 0;\n  font-size: 0.88em;\n}\n\n.prx-cd .prx-cd-key {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.3rem;\n}\n\n.prx-cd .prx-cd-swatch {\n  display: inline-block;\n  width: 0.9rem;\n  height: 0.9rem;\n  background: var(--prx-cd-swatch, var(--prx-grade-1));\n  border: 1px solid var(--prx-cell-border);\n  border-radius: 2px;\n  flex: 0 0 auto;\n}\n\n.prx-cd .prx-cd-orient {\n  margin: 0.3rem 0 0;\n  font-weight: 600;\n}\n\n.prx-cd .prx-cd-mark {\n  display: inline-block;\n  width: 0.8rem;\n  height: 0.8rem;\n  flex: 0 0 auto;\n}\n\n.prx-cd .prx-cd-mark-hull,\n.prx-cd .prx-cd-mark-steps {\n  height: 0;\n  width: 1.2rem;\n  border-top: 2px solid var(--prx-plot-fg);\n}\n\n.prx-cd .prx-cd-mark-steps {\n  border-top-color: var(--prx-plot-muted);\n}\n\n.prx-cd .prx-cd-mark-you {\n  background: var(--prx-plot-fg);\n  transform: rotate(45deg) scale(0.75);\n}\n\n.prx-cd .prx-cd-mark-tert {\n  width: 0;\n  height: 0;\n  border-left: 0.45rem solid transparent;\n  border-right: 0.45rem solid transparent;\n  border-bottom: 0.8rem solid var(--prx-plot-fg);\n}\n\n.prx-cd .prx-cd-mark-opt {\n  border: 2px solid var(--prx-plot-fg);\n}\n\n.prx-cd .prx-cd-mark-solve {\n  border-radius: 50%;\n  background: var(--prx-plot-fg);\n}\n\n/* --- tables --- */\n.prx-cd .prx-cd-scroll {\n  max-width: 100%;\n  overflow-x: auto;\n}\n\n.prx-cd .prx-cd-table {\n  border-collapse: collapse;\n  font-size: 0.92em;\n}\n\n.prx-cd .prx-cd-table caption {\n  caption-side: top;\n  padding: 0 0 0.3rem;\n  color: var(--prx-plot-muted);\n  font-size: 0.95em;\n  text-align: left;\n}\n\n.prx-cd .prx-cd-table th,\n.prx-cd .prx-cd-table td {\n  padding: 0.2rem 0.6rem;\n  border-bottom: 1px solid var(--prx-plot-grid);\n  text-align: left;\n}\n\n.prx-cd .prx-cd-table thead th {\n  font-weight: 600;\n  vertical-align: bottom;\n  white-space: nowrap;\n}\n\n.prx-cd .prx-cd-notice {\n  margin: 0.75rem 0 0;\n  font-size: 0.85em;\n  color: var(--prx-fg-muted);\n}\n\n@media (max-width: 30rem) {\n  .prx-cd .prx-cd-inline .prx-radio {\n    display: flex;\n    margin-right: 0;\n  }\n\n  .prx-cd .prx-cd-table th,\n  .prx-cd .prx-cd-table td {\n    padding: 0.2rem 0.3rem;\n  }\n}\n.prx-cd .prx-cd-scroll { min-width:0; }\n.prx-cd .prx-cd-table { min-width:30rem; }\n';

export const CONFIG = Object.freeze({
  name: "case-cde",
  label: "Twelve California schools: cut the posterior-mean order into at most three grades, compare the tertiles and the archived grades at one τ and at one disclosure, a nearly certain direction that is withheld, and the τ path",
  className: "prx-cd",
  assets: Object.freeze({ main: "case-cde", path: "cde-taupath" }),
  tau: Object.freeze({ min: 0.01, max: 0.5, step: 0.01, value: 0.2 }),
  cap: 3,
  // the twelve schools of the case (the cut sliders run over positions 1 ... units - 1)
  units: 12,
  half: 0.5,
  dpCap: 4,
  cuts: Object.freeze({ min: 1, value: Object.freeze([4, 8]), tertiles: Object.freeze([4, 8]), archived: Object.freeze([3, 9]) }),
  n: Object.freeze({ min: 0, max: 48, value: 48 }),
  pair: Object.freeze(["F", "I"]),
  views: Object.freeze(["cuts", "matched", "pair", "path"]),
  defaults: Object.freeze({ view: "cuts", full: false }),
  best: 3,
  // enumerations of the family per render (each about 25 ms in Node; CONFIG.heavyPerRender = 1 keeps an update fast)
  heavyPerRender: 1,
  tolerance: 1e-9,
  digits: Object.freeze({ p: 3, risk: 6, pi: 4, error: 4, sig: 3, tauSig: 2 }),
  card: Object.freeze({ rowPx: 24, marginTop: 8, marginBottom: 40, marginLeft: 70, marginRight: 14, stripePx: 20, nameDx: 6, dot: 4, line: 3, ticks: 5, narrowPx: 420, narrowTicks: 4, pad: 0.06, bandOpacity: 0.55, dash: "5,3" }),
  cloud: Object.freeze({ height: 240, marginLeft: 48, marginRight: 16, marginTop: 14, marginBottom: 38, zoom: 2.1, dot: 3, mark: 6, ticks: 5 }),
  path: Object.freeze({ height: 200, marginLeft: 44, marginRight: 16, marginTop: 14, marginBottom: 38, dot: 4, current: 6, ticks: 5, nTicks: Object.freeze([0, 27, 45, 66]) }),
  text: Object.freeze({
    missing: "The California data did not load, so this widget cannot show the schools.",
    viewLegend: "Show",
    viewWords: Object.freeze({ cuts: "Your cuts", matched: "Same disclosure", pair: "A pair", path: "The τ path" }),
    tauLabel: "Withholding cost τ",
    cut1Label: "Cut 1: after this many schools of the posterior-mean order",
    cut2Label: "Cut 2: after this many schools (equal cuts give two grades)",
    nLabel: "Compare reports that state this many directions (N)",
    fullLabel: "Show the largest E at each N too",
    pairLabel1: "School",
    pairLabel2: "against school",
    // settings box
    settingsHeading: "The setting",
    settingsLine: Object.freeze(["Twelve schools, M = ", "{M}", " pairs, one criterion with weight ", "{one}", ", at most ", "{cap}", " grades, τ = ", "{tau}", "."]),
    settingsPosterior: Object.freeze(["The posterior is supplied by the case study: it is conditional on a statewide prior fitted to ", "{schools}", " eligible schools, and the uncertainty in that prior is not propagated. Intervals: central ", "{level}", " marginal posterior intervals."]),
    // card
    cardHeading: "Chronic absence of the twelve schools",
    cardAxis: "Chronic-absence probability p (reversed: lower absence to the right)",
    cardAxisShort: "Chronic absence p (lower to the right)",
    cardAlt: "The twelve schools in the posterior-mean order, one row each. Each row shows the posterior mean of the chronic-absence probability (a dot) and its central marginal interval (a line) in the color of the school's grade, on a reversed axis. The cuts are dashed lines; a grade column sits at the left.",
    cardTable: "The twelve schools in the posterior-mean order",
    cardKeys: "Schools of the card. Use the arrow keys to read each school.",
    cardTip: "School {name}, CDS {cds}\nGrade {g} of {G}\nObserved: {y} of {m} students ({rate})\nPosterior mean of p {p}\n{level} interval {lo} to {hi}",
    cardTipWait: "School {name}, CDS {cds}\nObserved: {y} of {m} students ({rate})\nPosterior mean of p {p}\n{level} interval {lo} to {hi}",
    colPos: "Position",
    colSchool: "School",
    colGrade: "Grade",
    colRate: "Observed rate",
    colP: "Posterior mean of p",
    colLo: "Interval, lower p",
    colHi: "Interval, upper p",
    grade1: "Grade 1 = stated lowest in chronic absence, as the posterior judges it (θ = −p).",
    gradeKey: Object.freeze(["Grade ", "{g}", ": ", "{names}"]),
    cardNote: Object.freeze(["Dots: posterior means of p. Lines: central ", "{level}", " posterior intervals. Rows follow the posterior-mean order, which is also the observed-rate order here; a shared grade states no direction, so the row order inside a grade claims nothing."]),
    // result
    resultHeading: "Your report",
    cutsLine: Object.freeze(["Cuts after positions ", "{c1}", " and ", "{c2}", ": ", "{G}", " grades, ", "{sizes}", "."]),
    cutsLineOne: Object.freeze(["One cut, after position ", "{c1}", ": ", "{G}", " grades, ", "{sizes}", "."]),
    isTertiles: "These are the tertiles: three fixed tiers of four schools along the posterior-mean order (the observed-rate tertiles of the case are the same report).",
    isArchived: "These are the archived grades of the case study.",
    countsLine: Object.freeze(["It states N = ", "{N}", " of M = ", "{M}", " pairs (s = N/M = ", "{s}", ")."]),
    eLine: Object.freeze(["Expected wrong directions among them: E = ", "{E}", "; E/N = ", "{EoN}", "."]),
    eLineNone: "It states no direction, so E/N is NA: no disclosure.",
    riskLine: Object.freeze(["Risk at τ = ", "{tau}", ": ", "{risk}", " = E/M ", "{err}", " + τ(M − N)/M ", "{wh}", "."]),
    riskLead: "This is an ",
    riskGloss: ": the browser scores the report you built.",
    // compare
    compareHeading: "At the same τ: the best report with at most three grades",
    optLine: Object.freeze([": ", "{sizes}", ", ", "{groups}", ". N = ", "{N}", ", E = ", "{E}", ", risk ", "{risk}", "."]),
    optFamily: Object.freeze(["Every one of the ", "{size}", " reports with at most ", "{cap}", " grades was evaluated; the family contains the all-withheld report, so the optimum's E/N, ", "{EoN}", ", is at most τ = ", "{tau}", " (E ≤ τN)."]),
    archHeading: "The archived solve",
    archLine: Object.freeze(["The case study's postrank solve with the HiGHS backend at τ = ", "{tau}", ": ", "{label}", " (", "{family}", ", ", "{size}", " reports): status ", "{status}", ", risk ", "{risk}", ", lower bound ", "{bound}", ", gap ", "{gap}", ", ", "{sizes}", "."]),
    archSame: "The browser enumeration above returns the same report.",
    archDiffer: "The browser enumeration above returns another report; compare their risks.",
    archOther: Object.freeze(["The archived solve was run at τ = ", "{tau}", " only; set τ to ", "{tau2}", " to compare it."]),
    youOpt: "Your cuts give this optimum.",
    youOther: Object.freeze(["Your report states N = ", "{N}", "; the optimum states ", "{Nopt}", ": ", "{caption}", ". A lower risk at one τ does not say which report has fewer expected wrong directions at the same disclosure; the ", "{sameDisclosure}", " compares reports that state the same number."]),
    youSameN: Object.freeze(["Your report and the optimum both state N = ", "{N}", ", so their risks at this τ differ only by E: yours ", "{E}", ", the optimum's ", "{Eopt}", "."]),
    relHeading: "From the optimum to your report",
    relLine: Object.freeze(["Against the optimum, your report newly states ", "{nd}", " pairs, newly withholds ", "{nw}", ", reverses ", "{nr}", " and keeps ", "{ns}", " of the ", "{M}", " relations."]),
    relNone: "Your report states and withholds exactly the pairs the optimum does.",
    relTable: "Pairs whose relation changes from the optimum to your report",
    colPair: "Pair",
    colOpt: "Optimum",
    colYou: "Your report",
    colError: "Error of the direction you state",
    rel: Object.freeze({ above: "{a} above {b}", below: "{b} above {a}", withheld: "withheld" }),
    // matched
    matchedHeading: "Reports that state the same number of directions",
    cloudAlt: "For each disclosure N, the smallest expected wrong count E among the reports with at most three grades that state N directions (a dot) and a line up to the largest; the lower hull H joins the lowest points; your report, the tertiles and the optimum at τ are marked, and a vertical line marks the chosen N.",
    cloudTable: "Reports with at most three grades by the number of directions they state",
    colN: "N",
    colCount: "Reports",
    colMin: "Smallest E",
    colMax: "Largest E",
    cloudAxisX: "Directions stated, N",
    cloudAxisY: "Expected wrong directions, E",
    cloudZoom: Object.freeze(["The vertical axis stops at E = ", "{z}", "; the lines run on to the largest E at each N, which reaches ", "{max}", "."]),
    keyYou: "your report",
    keyTert: "tertiles",
    keyOpt: "optimum at τ",
    keyHull: "lower hull H",
    atLine: Object.freeze(["Reports with at most ", "{cap}", " grades that state exactly N = ", "{n}", " directions: ", "{count}", "."]),
    atBest: Object.freeze([": the smallest E is ", "{E1}", " (", "{groups}", ")"]),
    atNext: Object.freeze(["; the next is ", "{E2}"]),
    atNone: Object.freeze(["No report with at most ", "{cap}", " grades states exactly N = ", "{n}", " directions."]),
    atMax: Object.freeze(["N = ", "{n}", " is the largest disclosure that at most ", "{cap}", " grades allow for twelve schools: only balanced reports, four schools in each grade, state it. A mixture reaches this maximum only by using such maximum-disclosure reports, so it cannot improve on their least-error member, H(", "{n2}", ")."]),
    hVertex: Object.freeze(["H(", "{n}", ") = ", "{H}", ": a vertex of the lower hull, so a single report attains it."]),
    hMix: Object.freeze(["H(", "{n}", ") = ", "{H}", ": between the vertices at N = ", "{lo}", " and ", "{hi}", ", reached by using the report at N = ", "{hi2}", " with probability ψ = ", "{psi}", " and the one at N = ", "{lo2}", " otherwise: "]),
    youGap: Object.freeze(["Your report: N = ", "{N}", ", E = ", "{E}", "; H(", "{N2}", ") = ", "{H}", ", so it lies ", "{gap}", " above the lower hull."]),
    youOn: Object.freeze(["Your report: N = ", "{N}", ", E = ", "{E}", "; H(", "{N2}", ") = ", "{H}", ", so it lies on the lower hull (gap ", "{gap}", ")."]),
    // pair
    pairHeading: "One pair of schools",
    pairPi: Object.freeze(["Pr(θ", "{a}", " > θ", "{b}", " ∣ Y) = ", "{pi}", ": the posterior puts school ", "{a2}", " below school ", "{b2}", " in chronic absence with this probability."]),
    pairStated: Object.freeze(["Your report states ", "{x}", " above ", "{y}", "."]),
    pairWithheld: "Your report withholds this pair: both schools share a grade.",
    pairSame: "Choose two different schools.",
    pairBestLine: Object.freeze([" among the ", "{matched}", " reports that state ", "{a}", " above ", "{b}", ": ", "{sizes}", ", ", "{groups}", ", N = ", "{N}", ", risk ", "{risk}", " at τ = ", "{tau}", "."]),
    pairBestNone: Object.freeze(["No report with at most ", "{cap}", " grades states this direction."]),
    pairBestIsOpt: "It is the optimum itself.",
    bestHeading: "The three lowest risks at this τ",
    bestTable: "The reports with at most three grades with the lowest risks at this τ",
    colRank: "Rank",
    colReport: "Report",
    colRisk: "Risk",
    colStates: "States the pair?",
    yes: "yes",
    no: "no",
    boundaries: "Along the posterior-mean order the clear boundaries, where the intervals of neighboring schools barely overlap, fall after B (the first three schools are A, C and B), after the group F, E, D and after the group H, G, I. Three grades allow two cuts, and the optimum puts them at the first and the third boundary. Stating F above I needs a cut between F and I, which must replace one of them. The second-lowest risk moves the first cut down to after D (A to F share the top grade); the third-lowest moves the second cut up to after D (G to L share the last grade).",
    dpLine: Object.freeze(["With a fourth grade allowed, the best cuts of the posterior-mean order are ", "{sizes}", " (N = ", "{N}", "), which ", "{state}", ": "]),
    dpState: "state this direction",
    dpNot: "do not state this direction",
    dpTail: Object.freeze([" (", "{family}", ", ", "{size}", " cut sets). Its risk is ", "{risk}", " under the same loss at this τ. The families differ and are not nested; this order result is not a global optimum over all reports with four grades."]),
    // path
    computing: "Computing over every report with at most three grades …",
    pathHeading: "The τ path with at most three grades",
    pathAlt: "The number of stated directions N of the optimum with at most three grades at each τ: the released postrank solves as dots and the browser's exact path as steps, the current τ marked.",
    pathTable: "The released postrank solves along τ",
    pathAxisX: "Withholding cost τ",
    pathAxisY: "Directions stated, N",
    colTau: "τ",
    colSizes: "Sizes",
    colStatus: "Status",
    colE: "E",
    colGap: "Gap",
    pathSolves: Object.freeze(["Dots: ", "{count}", " postrank solves released with the case (HiGHS backend), each ", "{label}", " (", "{family}", ") with status optimal."]),
    pathExact: Object.freeze(["Steps: the browser's ", "{label}", " (", "{size}", " reports) on each interval of τ, with breakpoints at τ = ", "{bp}", "."]),
    pathNow: Object.freeze(["At τ = ", "{tau}", " the optimum is ", "{sizes}", ", N = ", "{N}", "."]),
    stepsKey: "browser path",
    dotsKey: "postrank solves",
    // read-out
    readA: Object.freeze(["τ = ", "{tau}", "; cuts after positions ", "{c1}", " and ", "{c2}", ": ", "{sizes}", ". "]),
    readAOne: Object.freeze(["τ = ", "{tau}", "; one cut, after position ", "{c1}", ": ", "{sizes}", ". "]),
    readResult: Object.freeze(["N = ", "{N}", " of ", "{M}", ", risk ", "{risk}", ". "]),
    readView: Object.freeze({ cuts: "Showing your cuts and the optimum at this τ.", matched: Object.freeze(["Showing the reports that state N = ", "{n}", " directions."]), pair: Object.freeze(["Showing the pair ", "{a}", ", ", "{b}", "."]), path: "Showing the τ path." }),
    // the data notice of a standalone embed
    notice: "Data: California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26, as adapted in postrank 1.1.0 (pr_case_cde): a 12-school teaching subset with the oriented target θ = −p. CDE source conditions apply; the data are not relicensed; provided as is, without warranty; no CDE endorsement is implied.",
  }),
});

const T = CONFIG.text;
// the keys under which the widget exposes engine results (labels.exposeResult); every render clears them first
const EXPOSED = Object.freeze(["evaluation", "optimum", "archived", "atN", "stating", "best", "dp", "path", "solves", "distribution", "histogram", "pathChanges"]);
const close = (a, b) => Math.abs(a - b) <= CONFIG.tolerance;

// ---------------------------------------------------------------------------------------------- data

/** Everything the widget needs from the two released assets, or null when the case is missing. */
export function readModel() {
  const d = CDE;
  const u = d?.tables?.units;
  const raw = d?.arrays?.error;
  const E = raw && { ...raw, e: raw.e.map(m => m.map(r => r.map(v => v === null ? NaN : v))) };
  const arch = d?.analyses?.case_cde_12;
  if (!u || !Array.isArray(u.label) || u.label.length !== CONFIG.units || !Array.isArray(E?.e) || !arch?.facts || !Array.isArray(arch?.tables?.units?.grade)) return null;
  const n = u.label.length;
  const so = scoreOrder(u.mean, { direction: "descending" });
  const tp = TAUPATH;
  const path = tp?.tables?.path && Array.isArray(tp?.arrays?.grades?.grade) ? { rows: tp.tables.path, grades: tp.arrays.grades.grade } : null;
  return {
    n, M: pairCount(n), E, labels: u.label.slice(), cds: u.cds_id.slice(), y: u.chronic_absent_count.slice(), m: u.eligible_count.slice(),
    rate: u.observed_rate.slice(), mean: u.mean.slice(), lower: u.lower.slice(), upper: u.upper.slice(),
    level: d.facts?.interval_level, statewide: d.facts?.statewide_schools, order: so.order, position: inversePosition(so.order),
    tertiles: d.tables.reports.observed_rate_tertiles.slice(), archived: { facts: arch.facts, grade: arch.tables.units.grade.slice() }, path,
  };
}

function inversePosition(order) {
  const pos = new Array(order.length);
  order.forEach((i, p) => { pos[i] = p; });
  return pos;
}

/** The two cut positions as given, clamped to 1 ... n - 1 integers (n = 12 here). */
export function parseCuts(v, prev, n = CONFIG.units) {
  const list = typeof v === "string" ? v.split(/[,\s|]+/).filter(Boolean) : Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v) : null;
  if (!list || list.length !== 2) return undefined;
  const out = list.map((x) => (typeof x === "number" ? x : Number(x)));
  if (out.some((x) => !Number.isFinite(x))) return undefined;
  return out.map((x) => Math.min(n - 1, Math.max(CONFIG.cuts.min, Math.round(x))));
}

/** The distinct cuts in increasing order (two equal cuts are one boundary). */
export const cutSet = (cuts) => [...new Set(cuts)].sort((a, b) => a - b);

/** A pair of school labels ("F,I" or ["F", "I"]) as two labels; unknown labels keep the previous pair. */
export function parsePair(v, prev, labels = "ABCDEFGHIJKL".split("")) {
  const list = typeof v === "string" ? v.split(/[,\s|]+/).filter(Boolean) : Array.isArray(v) ? v.map(String) : null;
  if (!list || list.length !== 2) return undefined;
  const up = list.map((s) => s.trim().toUpperCase());
  return up.every((s) => labels.includes(s)) ? up : undefined;
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------------------------------------- widget

export const CDE_VIEWS = Object.freeze({ 'cde-cuts': 'cuts', 'cde-one-disclosure': 'matched', 'cde-pair': 'pair', 'cde-tau-path': 'path' });

export function mountCdeView(el, spec = {}, { name, view, label = CONFIG.label } = {}) {
  if (CDE_VIEWS[name] !== view || !CONFIG.views.includes(view)) throw new TypeError("A matching CDE app name and fixed view are required");
  const handle = createWidget(el, spec, {
    name,
    label,
    css: CDE_COMMON_CSS + "\n.prx-cd .prx-controls { row-gap:.2rem; }\n.prx-cd .prx-cd-card { padding-top:.15rem; }\n",
    className: CONFIG.className,
    keys: {
      tau: { type: "number", ...CONFIG.tau, snap: true },
      cuts: { type: "custom", value: [...(view === "pair" || view === "path" ? CONFIG.cuts.archived : CONFIG.cuts.value)], parse: (v, prev) => parseCuts(v, prev) },
      n: { type: "integer", ...CONFIG.n },
      pair: { type: "custom", value: [...CONFIG.pair], parse: (v, prev) => parsePair(v, prev) },
      full: { type: "boolean", value: CONFIG.defaults.full },
    },
    build(ctx) {
      const { h } = ctx;
      const model = readModel(ctx.win);
      if (!model) {
        ctx.charts.append(h("p", { class: "prx-cd-missing", text: T.missing }));
        return { render() {} };
      }
      const { n, M, E, labels } = model;
      const family = { kind: "atMost", G: CONFIG.cap };
      const hooked = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => hooked(ctx.num(raw, display), name);
      const count = (raw, name) => num(raw, formatCount(raw), name);
      const setting = (raw, name) => num(raw, formatSetting(raw), name);
      const share = (raw, name) => num(raw, formatShare(raw), name);
      const expected = (raw, name) => num(raw, formatExpectedCount(raw), name);
      const risk = (raw, name) => num(raw, formatRisk(raw, { digits: CONFIG.digits.risk }), name);
      const prob = (raw, name, digits = CONFIG.digits.error) => num(raw, formatRisk(raw, { digits }), name);
      const sizesNode = (sizes, name) => num(sizes, formatSizes(sizes), name);
      const pinTable = (slot, prefix) => slot.querySelectorAll("table tbody tr").forEach((row, i) => [...row.children].forEach((cell, j) => {
        const numeric = cell.matches("[data-num]") ? cell : cell.querySelector("[data-num]");
        if (numeric) hooked(numeric, `${prefix}-${i}-${j}`);
      }));
      const gradeVector = (grade, i) => h("span", {}, "[", ...model.order.flatMap((j, p) => [p ? ", " : "", count(grade[j], `hist-grade-${i}-${p}`)]), "]");
      const one = () => count(1);
      const school = (i) => h("span", { class: "prx-cd-school", "data-prx-name": "", text: labels[i] });
      const title = (text) => ctx.panelTitle(text, { className: "prx-cd-heading" });
      const filled = (parts, slots) => fill(parts.join(""), slots);
      const listNodes = (idx) => {
        const out = [];
        idx.forEach((i, k) => { if (k) out.push(k === idx.length - 1 ? " and " : ", "); out.push(school(i)); });
        return out;
      };
      // a report's schools by grade, in the posterior-mean order: {A, C, B} / {F, E, D, H, G} / {I, K, L, J}
      const groupsText = (grade) => {
        const G = Math.max(...grade);
        return Array.from({ length: G }, (_, k) => `{${model.order.filter((i) => grade[i] === k + 1).map((i) => labels[i]).join(", ")}}`).join(" > ");
      };
      const groups = (grade) => h("span", { class: "prx-cd-groups", "data-prx-name": "" , text: groupsText(grade) });
      const tertGrade = cutGrade(n, [...CONFIG.cuts.tertiles], { order: model.order });
      const archGrade = model.archived.grade;
      const gradeOf = (cuts) => cutGrade(n, cutSet(cuts), { order: model.order });

      // --- cached engine calls. Each call that enumerates the family (about 25 ms in Node) is cached by its arguments.
      // A render makes at most CONFIG.heavyPerRender of them (call); the rest wait, the widget stays aria-busy, and the
      // next render (one event-loop turn later) makes the next one. force() computes the inexpensive order DP immediately.
      const store = new Map();
      let budget = Infinity;
      let waiting = false;
      const call = (key, fn) => {
        if (store.has(key)) return store.get(key);
        if (budget <= 0) { waiting = true; return null; }
        budget -= 1;
        const v = fn();
        store.set(key, v);
        return v;
      };
      const force = (key, fn) => { if (!store.has(key)) store.set(key, fn()); return store.get(key); };
      const tauKey = (tau) => Math.round(tau / CONFIG.tau.step);
      const optAt = (tau, how = call) => how(`opt|${tauKey(tau)}`, () => exactOptimum(E, { tau, family }));
      const bestAt = (tau) => call(`best|${tauKey(tau)}`, () => bestReports(E, { tau, family, k: CONFIG.best }));
      const statingAt = (tau, a, b, how = call) => how(`stating|${tauKey(tau)}|${a}|${b}`, () => bestReports(E, { tau, family, k: 1, stating: [[a, b]] }));
      const atN = (N, how = call) => how(`atN|${N}`, () => reportsAtN(E, { family, N, k: 2 }));
      const dpAt = (tau) => force(`dp|${tauKey(tau)}`, () => fixedOrderDP(E, { scores: model.mean, direction: "descending", G: CONFIG.dpCap, tau }));
      const cloudOf = () => call("cloud", () => { const c = reportCloud(E, { family }); return { cloud: c, hull: lowerHull(c) }; });
      const pathOf = () => call("path", () => tauPath(E, { family }));
      let again = null;
      const busyNote = () => h("p", { class: "prx-cd-note prx-cd-busy", text: T.computing });

      // --- controls
      const tauSlider = ctx.slider({ label: T.tauLabel, ...CONFIG.tau, value: ctx.state.tau, name: "tau", format: (v) => formatSetting(v), onInput: (v) => ctx.set({ tau: v }) });
      const cutFormat = (v) => formatCount(v);
      const cutSlider = (k, label) => ctx.slider({
        label, min: CONFIG.cuts.min, max: n - 1, step: 1, value: ctx.state.cuts[k], name: `cut${k + 1}`, format: cutFormat,
        onInput: (v) => { const c = [...ctx.state.cuts]; c[k] = v; ctx.set({ cuts: c }); },
      });
      const cut1 = cutSlider(0, T.cut1Label);
      const cut2 = cutSlider(1, T.cut2Label);
      const nSlider = ctx.slider({ label: T.nLabel, ...CONFIG.n, step: 1, value: ctx.state.n, name: "n", format: (v) => formatCount(v), onInput: (v) => ctx.set({ n: v }) });
      const fullToggle = ctx.toggle({ label: T.fullLabel, checked: ctx.state.full, name: "full", onChange: (v) => ctx.set({ full: v }) });
      const schoolOptions = labels.map((l) => ({ value: l, label: l }));
      const pairA = ctx.select({ label: T.pairLabel1, options: schoolOptions, value: ctx.state.pair[0], name: "pair-a", onChange: (v) => ctx.set({ pair: [v, ctx.state.pair[1]] }) });
      const pairB = ctx.select({ label: T.pairLabel2, options: schoolOptions, value: ctx.state.pair[1], name: "pair-b", onChange: (v) => ctx.set({ pair: [ctx.state.pair[0], v] }) });
      const pairBox = h("div", { class: "prx-control prx-cd-pairpick" }, pairA.root, pairB.root);
      ctx.controls.append(tauSlider.root, cut1.root, cut2.root, nSlider.root, fullToggle.root, pairBox);

      // --- settings, card, result, compare, views
      const settingsBox = h("section", { class: "prx-cd-settings", "aria-label": T.settingsHeading });
      // The complete setting follows the primary card; the chart enters the first screen.
      const cardChart = h("div", { class: "prx-cd-card-chart" });
      const legendSlot = ctx.part("legend", h("div", { class: "prx-cd-legend-slot" }));
      const cardNote = h("p", { class: "prx-cd-note" });
      const cardBox = h("section", { class: "prx-cd-box prx-light-panel prx-cd-card", "aria-label": T.cardHeading }, title(T.cardHeading), cardChart, legendSlot, cardNote);
      const resultBody = h("div", { class: "prx-cd-result-body" });
      const resultBox = h("section", { class: "prx-cd-box prx-light-panel prx-cd-result", "aria-label": T.resultHeading }, title(T.resultHeading), resultBody);
      const compareBody = h("div", { class: "prx-cd-compare-body" });
      const compareBox = h("section", { class: "prx-cd-box prx-light-panel prx-cd-compare", "aria-label": T.compareHeading }, title(T.compareHeading), compareBody);
      const relBody = h("div", { class: "prx-cd-rel-body" });
      const relBox = h("section", { class: "prx-cd-box prx-light-panel prx-cd-rel", "aria-label": T.relHeading }, title(T.relHeading), relBody);
      const cutsWrap = h("div", { class: "prx-cd-view-cuts" }, compareBox, relBox);
      const cloudChart = h("div", { class: "prx-cd-cloud-chart" });
      const cloudKey = ctx.part("legend", h("p", { class: "prx-cd-legend" }));
      const matchedBody = h("div", { class: "prx-cd-matched-body" });
      const matchedBox = h("section", { class: "prx-cd-box prx-light-panel prx-cd-matched", "aria-label": T.matchedHeading }, title(T.matchedHeading), cloudChart, cloudKey, matchedBody);
      const histogramChart = h("div", { class: "prx-cd-cloud-chart" });
      const histogramBody = h("div");
      const histogramBox = h("section", { class: "prx-cd-box prx-light-panel", "aria-label": "Complete distribution at the tertiles' disclosure" }, title("All reports at the tertiles’ disclosure"), histogramChart, histogramBody);
      const matchedWrap = h("div", { class: "prx-cd-view-matched" }, matchedBox, histogramBox);
      const pairBody = h("div", { class: "prx-cd-pair-body" });
      const pairMore = h("div", { class: "prx-cd-pair-more" });
      const pairPanel = h("section", { class: "prx-cd-box prx-light-panel prx-cd-pair", "aria-label": T.pairHeading }, title(T.pairHeading), pairBody, pairMore);
      const pathChart = h("div", { class: "prx-cd-path-chart" });
      const pathKey = ctx.part("legend", h("p", { class: "prx-cd-legend" }));
      const pathBody = h("div", { class: "prx-cd-path-body" });
      const pathChanges = h("div");
      const pathPanel = h("section", { class: "prx-cd-box prx-light-panel prx-cd-path", "aria-label": T.pathHeading }, title(T.pathHeading), h("p", {class:"prx-cd-note prx-cd-path-y-label"}, T.pathAxisY), pathChart, pathKey, pathBody, pathChanges);
      const viewSlot = h("div", { class: "prx-cd-view" });
      if (view === "cuts") ctx.charts.append(cardBox, settingsBox, resultBox, viewSlot);
      else ctx.charts.append(viewSlot, cardBox, settingsBox, resultBox);
      if (!ctx.doc.querySelector?.('meta[name="quarto:offset"]')) ctx.root.append(h("p", { class: "prx-cd-notice", text: T.notice }));

      // --- drawing
      function drawSettings(tau) {
        settingsBox.replaceChildren(
          title(T.settingsHeading),
          h("p", {}, ...filled(T.settingsLine, { M: () => count(M), one, cap: () => count(CONFIG.cap), tau: () => setting(tau) })),
          h("p", { class: "prx-cd-note" }, ...filled(T.settingsPosterior, { schools: () => count(model.statewide), level: () => num(model.level, formatPercent(model.level)) })),
        );
      }

      function drawCard(grade, cuts, t1) {
        const C = CONFIG.card;
        const G = Math.max(...grade);
        const p = (i) => -model.mean[i];
        const rows = model.order.map((i, pos) => ({
          i, pos, name: labels[i], cds: model.cds[i], grade: grade[i], rate: model.rate[i], y: model.y[i], m: model.m[i],
          p: p(i), lo: -model.upper[i], hi: -model.lower[i],
        }));
        const bands = [];
        for (const r of rows) {
          const b = bands[r.grade - 1] ?? (bands[r.grade - 1] = { grade: r.grade, first: r.pos, last: r.pos });
          b.last = r.pos;
        }
        for (const b of bands) b.mid = (b.first + b.last) / 2;
        const lo = Math.min(...rows.map((r) => r.lo));
        const hi = Math.max(...rows.map((r) => r.hi));
        const pad = (hi - lo) * C.pad;
        const width = Math.round(cardChart.clientWidth || 0) || ctx.width();
        const narrow = width < C.narrowPx;
        const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
        // the axis is reversed: the left edge is the largest p
        const domain = [hi + pad, lo - pad];
        const perPx = (domain[0] - domain[1]) / innerW;
        const leftOf = (px) => domain[0] + px * perPx;
        const sx1 = leftOf(C.marginLeft - 1);
        const sx2 = leftOf(C.marginLeft - 1 - C.stripePx);
        const smid = (sx1 + sx2) / 2;
        const level = formatPercent(model.level);
        const pf = (v) => formatProb(v, { digits: CONFIG.digits.p });
        const tip = (d) => fill(T.cardTip, {
          name: d.name, cds: d.cds, g: formatCount(d.grade), G: formatCount(G), y: formatCount(d.y), m: formatCount(d.m), rate: pf(d.rate),
          p: pf(d.p), level, lo: pf(d.lo), hi: pf(d.hi),
        }).join("");
        const half = CONFIG.half;
        const cutRows = cutSet(cuts).map((c) => ({ y: c - half }));
        let colors = null;
        plot(cardChart, {
          alt: T.cardAlt,
          table: {
            caption: T.cardTable,
            columns: [
              { label: T.colPos, value: (d) => d.pos + 1, format: (v) => formatCount(v) },
              { label: T.colSchool, value: "name" },
              { label: T.colGrade, value: "grade", format: (v) => formatCount(v) },
              { label: T.colRate, value: "rate", format: pf },
              { label: T.colP, value: "p", format: pf },
              { label: T.colLo, value: "lo", format: pf },
              { label: T.colHi, value: "hi", format: pf },
            ],
            rows,
          },
          width, height: Math.round(C.marginTop + C.marginBottom + n * C.rowPx), aspect: false,
          marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain, ticks: narrow ? C.narrowTicks : C.ticks, label: narrow ? T.cardAxisShort : T.cardAxis, labelAnchor: "center", labelArrow: "none", grid: true },
          y: { domain: [n - half, -half], axis: null },
          marks: (k, P) => {
            colors = gradeColors(G, k);
            // Every grade is visible in the split app.
            const ink = (d) => colors[d.grade - 1];
            const shown = bands;
            return [
              P.rect(bands.filter((b) => b.grade % 2 === 1), { x1: () => domain[0], x2: () => domain[1], y1: (b) => b.first - half, y2: (b) => b.last + half, fill: k.plotGrid, fillOpacity: C.bandOpacity }),
              P.rect(shown, { x1: () => sx1, x2: () => sx2, y1: (b) => b.first - half, y2: (b) => b.last + half, fill: (b) => colors[b.grade - 1], inset: 1 }),
              numText(shown, { x: () => smid, y: "mid", value: "grade", format: (v) => formatCount(v), fill: (b) => labelOn(colors[b.grade - 1], k), fontWeight: "bold", textAnchor: "middle" }),
              P.ruleY(cutRows, { y: "y", x1: () => sx1, x2: () => domain[1], stroke: k.plotFg, strokeWidth: 2, strokeDasharray: C.dash }),
              P.text(rows, { x: () => domain[0], y: "pos", text: "name", dx: -C.nameDx, textAnchor: "end", fill: k.plotFg, fontWeight: "bold" }),
              P.ruleY(rows, { y: "pos", x1: "lo", x2: "hi", stroke: ink, strokeWidth: C.line }),
              P.dot(rows, { x: "p", y: "pos", r: C.dot, fill: ink, stroke: k.plotBg }),
              P.tip(rows, P.pointerY({ x: "p", y: "pos", title: tip })),
            ];
          },
          keyboard: { data: rows, x: "p", y: "pos", key: (d) => d.name, sort: false, label: T.cardKeys, title: tip },
        });
        cardChart.querySelectorAll('table tbody tr').forEach((row, p) => {
          const cell = row.children[2];
          if (cell) (cell.querySelector('[data-num]') ?? cell).setAttribute('data-prx-readout', `school-grade-${model.order[p]}`);
        });
        // Each grade's schools and the target orientation remain beside the card.
        const legend = h("p", { class: "prx-cd-legend" });
        bands.forEach((b) => {
          const sw = h("span", { class: "prx-cd-swatch", "aria-hidden": "true" });
          sw.style.setProperty("--prx-cd-swatch", (colors ?? [])[b.grade - 1] ?? "");
          legend.append(h("span", { class: "prx-cd-key" }, sw, h("span", {}, ...filled(T.gradeKey, { g: () => count(b.grade), names: () => h("span", {}, ...listNodes(rows.filter((r) => r.grade === b.grade).map((r) => r.i))) }))));
        });
        legendSlot.replaceChildren(legend, h("p", { class: "prx-cd-orient" }, T.grade1));
        cardNote.replaceChildren(...filled(T.cardNote, { level: () => num(model.level, level) }));
      }

      function drawResult(grade, ev, cuts, tau) {
        const d = disclosure(grade);
        const cs = cutSet(cuts);
        exposeResult(ctx, ev, "evaluation");
        const lines = [
          h("p", { class: "prx-cd-cuts" }, ...filled(cs.length === 1 ? T.cutsLineOne : T.cutsLine, {
            c1: () => count(cs[0], "cut1"), c2: () => count(cs[1], "cut2"), G: () => count(d.G, "G"), sizes: () => sizesNode(d.sizes, "sizes"),
          }), " ", groups(grade)),
        ];
        if (sameList(Array.from(grade), Array.from(tertGrade))) lines.push(h("p", { class: "prx-cd-note" }, T.isTertiles));
        else if (sameList(Array.from(grade), archGrade)) lines.push(h("p", { class: "prx-cd-note" }, T.isArchived));
        resultBody.replaceChildren(...lines);
        resultBox.replaceChildren(title(T.resultHeading), resultBody,
          h("p", {}, ...filled(T.countsLine, { N: () => count(ev.N, "N"), M: () => count(M, "M"), s: () => share(ev.s, "s") })),
          ev.N > 0
            ? h("p", {}, ...filled(T.eLine, { E: () => expected(ev.Ew, "E"), EoN: () => share(ev.EoverN[0], "EoverN") }))
            : h("p", {}, T.eLineNone),
          h("p", {}, ...filled(T.riskLine, {
            tau: () => setting(tau), risk: () => risk(ev.risk, "risk"),
            err: () => h("span", { class: "prx-err" }, risk(ev.errorTerm, "err")), wh: () => h("span", { class: "prx-wh" }, risk(ev.withholdingTerm, "wh")),
          })),
          h("p", { class: "prx-cd-note" }, T.riskLead, captionNode(ctx, "fixed-report"), T.riskGloss),
        );
      }

      function drawCompare(grade, ev, tau, opt) {
        if (!opt) { compareBody.replaceChildren(busyNote()); return; }
        const parts = [];
        const od = disclosure(opt.grade);
        parts.push(h("p", {}, labelNode(ctx, opt, { key: "optimum" }), ...filled(T.optLine, {
          sizes: () => sizesNode(od.sizes, "opt-sizes"), groups: () => groups(opt.grade), N: () => count(opt.N, "opt-N"), E: () => expected(opt.Ew, "opt-E"), risk: () => risk(opt.risk, "opt-risk"),
        })));
        parts.push(h("p", { class: "prx-cd-note" }, ...filled(T.optFamily, {
          size: () => familySizeNode(ctx, opt), cap: () => count(CONFIG.cap), EoN: () => share(opt.EoverN[0], "opt-EoverN"), tau: () => setting(tau),
        })));
        parts.push(h("p", { class: "prx-cd-note" }, count(opt.tieCount, "opt-ties"), " reports are tied within risk tolerance ", num(opt.tieTol, formatSci(opt.tieTol), "opt-tolerance"), ". Listed ", count(opt.grades.length, "opt-listed"), " of ", count(opt.tieCount), ": ", ...opt.grades.flatMap((g, i) => [i ? "; " : "", groups(g)]), ". Numerical tolerance describes this enumeration; a solver status is not a numerical certificate."));
        // the archived solve (released summary; run at tau = .20 only)
        const F = model.archived.facts;
        const arch = { status: F.status, risk: F.risk, lower_bound: F.lower_bound, gap: F.gap, N: F.N, family: opt.family };
        if (close(tau, F.tau)) {
          parts.push(h("p", { class: "prx-cd-arch" }, ...filled(T.archLine, {
            tau: () => setting(F.tau), label: () => labelNode(ctx, arch, { key: "archived" }), family: () => familyNameNode(ctx, arch), size: () => familySizeNode(ctx, arch),
            status: () => h("span", { "data-prx-readout": "arch-status", text: F.status }), risk: () => risk(F.risk, "arch-risk"), bound: () => risk(F.lower_bound, "arch-bound"),
            gap: () => num(F.gap, formatSci(F.gap, { sig: CONFIG.digits.sig }), "arch-gap"), sizes: () => sizesNode(F.sizes, "arch-sizes"),
          }), " ", sameList(Array.from(opt.grade), archGrade) ? T.archSame : T.archDiffer));
        } else {
          exposeResult(ctx, null, "archived");
          parts.push(h("p", { class: "prx-cd-note" }, ...filled(T.archOther, { tau: () => setting(F.tau), tau2: () => setting(F.tau) })));
        }
        if (sameList(Array.from(grade), Array.from(opt.grade))) parts.push(h("p", {}, T.youOpt));
        else if (ev.N !== opt.N) {
          parts.push(h("p", {}, ...filled(T.youOther, { N: () => count(ev.N), Nopt: () => count(opt.N), caption: () => captionNode(ctx, "different-disclosure"), sameDisclosure: () => appLink(ctx,"cde-one-disclosure") })));
        } else parts.push(h("p", {}, ...filled(T.youSameN, { N: () => count(ev.N), E: () => expected(ev.Ew), Eopt: () => expected(opt.Ew) })));
        compareBody.replaceChildren(...parts);
      }

      function relationText(rel, a, b) {
        return fill(T.rel[rel], { a: labels[a], b: labels[b] }).join("");
      }

      function drawRelations(grade, opt) {
        if (!opt) { relBody.replaceChildren(busyNote()); return; }
        const rc = relationChange(opt.grade, grade, E);
        if (!rc.pairs.length) {
          relBody.replaceChildren(h("p", {}, T.relNone));
          return;
        }
        const rows = rc.pairs.map((q, k) => h("tr", {},
          h("th", { scope: "row" }, h("span", { "data-prx-name": "", text: `${labels[q.i]}, ${labels[q.j]}` })),
          h("td", { text: relationText(q.from, q.i, q.j) }),
          h("td", { text: relationText(q.to, q.i, q.j) }),
          h("td", {}, q.error === null ? "—" : prob(q.error, `rel-error-${k}`))));
        const table = h("table", { class: "prx-cd-table", "data-prx-part": "table" },
          h("caption", { text: T.relTable }),
          h("thead", {}, h("tr", {}, ...[T.colPair, T.colOpt, T.colYou, T.colError].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...rows));
        relBody.replaceChildren(
          h("p", {}, ...filled(T.relLine, {
            nd: () => count(rc.nNewDisclosed, "rel-new-stated"), nw: () => count(rc.nNewWithheld, "rel-new-withheld"), nr: () => count(rc.nReversed, "rel-reversed"),
            ns: () => count(rc.nSame, "rel-same"), M: () => count(M),
          })),
          ctx.scrollRegion(h("div", { class: "prx-cd-scroll" }, table), T.relTable),
        );
      }

      function drawMatched(state, grade, ev, optOf, width) {
        const Cc = CONFIG.cloud;
        const ch = cloudOf();
        if (!ch) {
          cloudChart.replaceChildren();
          pinTable(cloudChart, "cloud-cell");
        cloudKey.replaceChildren();
          matchedBody.replaceChildren(busyNote());
          return;
        }
        const { cloud: cl, hull } = ch;
        const r = atN(state.n);
        const opt = optOf();
        const rows = cl.byN.map((r) => ({ N: r.N, minEw: r.minEw, maxEw: r.maxEw, count: r.count }));
        const top = Math.max(...rows.map((r) => r.maxEw));
        const zoom = state.full ? top : Cc.zoom;
        const clip = (v) => Math.min(v, zoom);
        const tertEv = evaluateReport(tertGrade, E, { tau: state.tau });
        const marks = [
          { N: ev.N, Ew: ev.Ew, kind: "you" },
          { N: tertEv.N, Ew: tertEv.Ew, kind: "tert" },
          ...(opt ? [{ N: opt.N, Ew: opt.Ew, kind: "opt" }] : []),
        ];
        const inView = marks.filter((m) => m.Ew <= zoom);
        plot(cloudChart, {
          alt: T.cloudAlt,
          table: {
            caption: T.cloudTable,
            columns: [
              { label: T.colN, value: "N", format: (v) => formatCount(v) },
              { label: T.colCount, value: "count", format: (v) => formatCount(v) },
              { label: T.colMin, value: "minEw", format: (v) => formatExpectedCount(v) },
              { label: T.colMax, value: "maxEw", format: (v) => formatExpectedCount(v) },
            ],
            rows,
          },
          width, height: Cc.height, aspect: false, marginLeft: Cc.marginLeft, marginRight: Cc.marginRight, marginTop: Cc.marginTop, marginBottom: Cc.marginBottom,
          x: { domain: [0, M], ticks: Cc.ticks, label: T.cloudAxisX, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, zoom], ticks: Cc.ticks, label: T.cloudAxisY, labelArrow: "none", grid: true },
          marks: (k, P) => [
            P.ruleX([state.n], { stroke: k.plotMuted, strokeDasharray: "4,3" }),
            P.ruleX(rows, { x: "N", y1: (d) => clip(d.minEw), y2: (d) => clip(d.maxEw), stroke: k.neutral[3], strokeWidth: 2 }),
            P.line(hull, { x: "N", y: (d) => clip(d.Ew), stroke: k.plotFg, strokeWidth: 2 }),
            P.dot(rows, { x: "N", y: (d) => clip(d.minEw), r: Cc.dot, fill: k.plotFg }),
            P.dot(inView.filter((m) => m.kind === "opt"), { x: "N", y: "Ew", r: Cc.mark, symbol: "square", fill: "none", stroke: k.plotFg, strokeWidth: 2 }),
            P.dot(inView.filter((m) => m.kind === "tert"), { x: "N", y: "Ew", r: Cc.mark, symbol: "triangle", fill: "none", stroke: k.plotFg, strokeWidth: 2 }),
            P.dot(inView.filter((m) => m.kind === "you"), { x: "N", y: "Ew", r: Cc.mark - 2, symbol: "diamond", fill: k.plotFg, stroke: k.plotBg }),
            P.tip(rows, P.pointerX({ x: "N", y: (d) => clip(d.minEw), title: (d) => `N ${formatCount(d.N)}: ${formatCount(d.count)} reports, E from ${formatExpectedCount(d.minEw)} to ${formatExpectedCount(d.maxEw)}` })),
          ],
          keyboard: { data: rows, x: "N", y: (d) => clip(d.minEw), key: (d) => `n${d.N}`, sort: false, label: T.cloudTable, title: (d) => `N ${formatCount(d.N)}: ${formatCount(d.count)} reports, E from ${formatExpectedCount(d.minEw)} to ${formatExpectedCount(d.maxEw)}` },
        });
        const key = (cls, text) => h("span", { class: "prx-cd-key" }, h("span", { class: `prx-cd-mark ${cls}`, "aria-hidden": "true" }), text);
        pinTable(cloudChart, "cloud-cell");
        cloudKey.replaceChildren(key("prx-cd-mark-hull", T.keyHull), key("prx-cd-mark-you", T.keyYou), key("prx-cd-mark-tert", T.keyTert), key("prx-cd-mark-opt", T.keyOpt));
        const parts = [];
        if (!state.full) parts.push(h("p", { class: "prx-cd-note" }, ...filled(T.cloudZoom, { z: () => num(Cc.zoom, formatSetting(Cc.zoom)), max: () => expected(top) })));
        // at the chosen N
        const at = !r ? [busyNote()] : r.count > 0 ? [...filled(T.atLine, { cap: () => count(CONFIG.cap), n: () => count(state.n, "at-n"), count: () => count(r.count, "at-count") })]
          : [...filled(T.atNone, { cap: () => count(CONFIG.cap), n: () => count(state.n, "at-n") })];
        if (r && r.count > 0) {
          at.pop();
          at.push(...filled(T.atBest, { E1: () => expected(r.reports[0].Ew, "at-E1"), groups: () => groups(r.reports[0].grade) }));
          if (r.reports[1]) at.push(...filled(T.atNext, { E2: () => expected(r.reports[1].Ew, "at-E2") }));
          at.push(". ", labelNode(ctx, r, { key: "atN" }), " (", familySizeNode(ctx, r), " reports).");
        }
        parts.push(h("p", {}, ...at));
        if (state.n === cl.byN.at(-1).N) parts.push(h("p", {}, ...filled(T.atMax, { n: () => count(state.n), cap: () => count(CONFIG.cap), n2: () => count(state.n) })));
        const md = matchedDisclosure(cl, hull, state.n);
        if (md.psi === null || md.psi === undefined || md.lower?.N === md.upper?.N) {
          parts.push(h("p", {}, ...filled(T.hVertex, { n: () => count(state.n), H: () => expected(md.H, "H") })));
        } else {
          parts.push(h("p", {}, ...filled(T.hMix, {
            n: () => count(state.n), H: () => expected(md.H, "H"), lo: () => count(md.lower.N), hi: () => count(md.upper.N), hi2: () => count(md.upper.N), lo2: () => count(md.lower.N),
            psi: () => share(md.psi, "psi"),
          }), captionNode(ctx, "mixture-not-report"), "."));
        }
        const gap = ruleGap(grade, E, { hull });
        parts.push(h("p", {}, ...filled(gap.onFrontier ? T.youOn : T.youGap, {
          N: () => count(gap.N, "gap-N"), N2: () => count(gap.N), E: () => expected(gap.Ew, "gap-E"), H: () => expected(gap.H, "gap-H"), gap: () => expected(gap.gap, "gap"),
        })));
        matchedBody.replaceChildren(...parts);
      }

      function drawPair(state, grade) {
        const [a, b] = state.pair.map((l) => labels.indexOf(l));
        if (a === b) {
          pairBody.replaceChildren(h("p", {}, T.pairSame));
          pairMore.replaceChildren();
          return { a, b };
        }
        const pi = 1 - E.e[0][a][b];
        const lines = [h("p", {}, ...filled(T.pairPi, {
          a: () => h("sub", { "data-prx-name": "", text: labels[a] }), b: () => h("sub", { "data-prx-name": "", text: labels[b] }),
          pi: () => prob(pi, "pair-pi", CONFIG.digits.pi), a2: () => school(a), b2: () => school(b),
        }))];
        if (grade[a] === grade[b]) lines.push(h("p", {}, T.pairWithheld));
        else {
          const [x, y] = grade[a] < grade[b] ? [a, b] : [b, a];
          lines.push(h("p", {}, ...filled(T.pairStated, { x: () => school(x), y: () => school(y) })));
        }
        pairBody.replaceChildren(...lines);
        return { a, b };
      }

      function drawPairMore(state, tau, a, b) {
        if (a === b) { pairMore.replaceChildren(); return; }
        const parts = [];
        const best = bestAt(tau);
        const sb = statingAt(tau, a, b);
        const first = best?.reports[0]?.grade;
        if (!sb) parts.push(busyNote());
        else if (sb.reports.length) {
          const r = sb.reports[0];
          parts.push(h("p", {}, labelNode(ctx, sb, { key: "stating" }), " (", familySizeNode(ctx, sb), " reports)", ...filled(T.pairBestLine, {
            matched: () => count(sb.matched, "stating-matched"), a: () => school(a), b: () => school(b), sizes: () => sizesNode(disclosure(r.grade).sizes, "stating-sizes"),
            groups: () => groups(r.grade), N: () => count(r.N, "stating-N"), risk: () => risk(r.risk, "stating-risk"), tau: () => setting(tau),
          }), first && sameList(Array.from(r.grade), Array.from(first)) ? ` ${T.pairBestIsOpt}` : ""));
        } else {
          exposeResult(ctx, null, "stating");
          parts.push(h("p", {}, ...filled(T.pairBestNone, { cap: () => count(CONFIG.cap) })));
        }
        // the three lowest risks
        const rows = (best?.reports ?? []).map((r, k) => h("tr", {},
          h("th", { scope: "row" }, count(k + 1)),
          h("td", {}, sizesNode(disclosure(r.grade).sizes, `best-sizes-${k + 1}`), " ", groups(r.grade)),
          h("td", {}, count(r.N, `best-N-${k + 1}`)),
          h("td", {}, risk(r.risk, `best-risk-${k + 1}`)),
          h("td", { text: r.grade[a] < r.grade[b] ? T.yes : T.no })));
        const table = h("table", { class: "prx-cd-table", "data-prx-part": "table" },
          h("caption", { text: T.bestTable }),
          h("thead", {}, h("tr", {}, ...[T.colRank, T.colReport, T.colN, T.colRisk, T.colStates].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...rows));
        if (best) {
          parts.push(title(T.bestHeading), h("p", {}, labelNode(ctx, best, { key: "best" }), " (", familySizeNode(ctx, best), " reports)."),
            ctx.scrollRegion(h("div", { class: "prx-cd-scroll" }, table), T.bestTable));
        } else parts.push(title(T.bestHeading), busyNote());
        if (labels[a] === CONFIG.pair[0] && labels[b] === CONFIG.pair[1] && close(tau, model.archived.facts.tau)) parts.push(h("p", { class: "prx-cd-note" }, T.boundaries));
        // a fourth grade along the posterior-mean order
        const dp = dpAt(tau);
        const dd = disclosure(dp.grade);
        parts.push(h("p", {}, ...filled(T.dpLine, {
          sizes: () => sizesNode(dd.sizes, "dp-sizes"), N: () => count(dp.N, "dp-N"), state: dp.grade[a] < dp.grade[b] ? T.dpState : T.dpNot,
        }), labelNode(ctx, dp, { key: "dp" }), ...filled(T.dpTail, {
          family: () => familyNameNode(ctx, dp), size: () => familySizeNode(ctx, dp), risk: () => risk(dp.risk, "dp-risk"),
        })));
        pairMore.replaceChildren(...parts);
      }

      function drawPath(state, width) {
        const Pc = CONFIG.path;
        const tp = pathOf();
        if (!tp) {
          pathChart.replaceChildren();
          pinTable(pathChart, "archive-cell");
        pathKey.replaceChildren();
          pathBody.replaceChildren(busyNote());
          return;
        }
        exposeResult(ctx, tp, "path");
        const steps = [];
        for (const iv of tp.intervals) steps.push({ tau: iv.tauFrom, N: iv.N }, { tau: iv.tauTo, N: iv.N });
        const rel = model.path;
        const solves = rel ? rel.rows.tau.map((t, k) => ({ tau: t, N: rel.rows.N[k], sizes: disclosure(rel.grades[k]).sizes, E: rel.rows.E[k], risk: rel.rows.risk[k], status: rel.rows.status[k], gap: rel.rows.gap[k] })) : [];
        // tau values below the .01 grid (the two named breakpoint values) keep two significant digits
        const tauText = (v) => (v < CONFIG.tau.step ? formatSig(v, { sig: CONFIG.digits.tauSig }) : formatSetting(v));
        const cur = tp.intervals.find((iv) => state.tau > iv.tauFrom && state.tau <= iv.tauTo) ?? tp.intervals.at(-1);
        plot(pathChart, {
          alt: T.pathAlt,
          table: {
            caption: T.pathTable,
            columns: [
              { label: T.colTau, value: "tau", format: tauText },
              { label: T.colSizes, value: "sizes", format: (v) => formatSizes(v) },
              { label: T.colN, value: "N", format: (v) => formatCount(v) },
              { label: T.colE, value: "E", format: (v) => formatExpectedCount(v) },
              { label: T.colRisk, value: "risk", format: (v) => formatRisk(v, { digits: CONFIG.digits.risk }) },
              { label: T.colStatus, value: "status" },
              { label: T.colGap, value: "gap", format: (v) => (v === 0 ? formatCount(0) : formatSci(v, { sig: CONFIG.digits.sig })) },
            ],
            rows: solves,
          },
          width, height: Pc.height, aspect: false, marginLeft: Pc.marginLeft, marginRight: Pc.marginRight, marginTop: Pc.marginTop, marginBottom: Pc.marginBottom,
          x: { domain: [0, CONFIG.tau.max], ticks: Pc.ticks, label: T.pathAxisX, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, M], ticks: Pc.nTicks.slice(), label: null, labelArrow: "none", grid: true },
          marks: (k, P) => [
            P.ruleX([state.tau], { stroke: k.plotMuted, strokeDasharray: "4,3" }),
            P.line(steps, { x: "tau", y: "N", stroke: k.plotMuted, strokeWidth: 2 }),
            P.dot(solves, { x: "tau", y: "N", r: Pc.dot, fill: k.plotFg, stroke: k.plotBg }),
            P.dot(cur ? [{ tau: state.tau, N: cur.N }] : [], { x: "tau", y: "N", r: Pc.current, fill: "none", stroke: k.plotFg, strokeWidth: 2 }),
            P.tip(solves, P.pointerX({ x: "tau", y: "N", title: (d) => `τ ${tauText(d.tau)}: ${formatSizes(d.sizes)}, N ${formatCount(d.N)}, risk ${formatRisk(d.risk, { digits: CONFIG.digits.risk })}, ${d.status}` })),
          ],
          keyboard: { data: solves, x: "tau", y: "N", key: (d, i) => `s${i}`, sort: false, label: T.pathTable, title: (d) => `τ ${tauText(d.tau)}: ${formatSizes(d.sizes)}, N ${formatCount(d.N)}, risk ${formatRisk(d.risk, { digits: CONFIG.digits.risk })}, ${d.status}` },
        });
        const key = (cls, text) => h("span", { class: "prx-cd-key" }, h("span", { class: `prx-cd-mark ${cls}`, "aria-hidden": "true" }), text);
        pinTable(pathChart, "archive-cell");
        pathKey.replaceChildren(key("prx-cd-mark-steps", T.stepsKey), key("prx-cd-mark-solve", T.dotsKey));
        const solveRec = { status: "optimal", family: tp.family };
        const bp = tp.intervals.slice(0, -1).map((iv) => iv.tauTo);
        pathBody.replaceChildren(
          h("p", {}, ...filled(T.pathSolves, { count: () => count(solves.length, "path-solves"), label: () => labelNode(ctx, solveRec, { key: "solves" }), family: () => familyNameNode(ctx, tp) })),
          h("p", {}, ...filled(T.pathExact, {
            label: () => labelNode(ctx, tp, { key: "path" }), size: () => familySizeNode(ctx, tp),
            bp: () => h("span", {}, ...bp.flatMap((v, k) => [k ? (k === bp.length - 1 ? " and " : ", ") : "", num(v, formatSig(v, { sig: CONFIG.digits.sig }), `bp-${k + 1}`)])),
          })),
          h("p", {}, ...filled(T.pathNow, { tau: () => setting(state.tau), sizes: () => sizesNode(disclosure(cur.grade).sizes, "path-sizes"), N: () => count(cur.N, "path-N") })),
        );
      }

      // The complete distribution added in v2 remains beside the full v1 matched-disclosure view.
      const histogramCache = new WeakMap();
      function drawDistribution(state) {
        const N = disclosure(tertGrade).N;
        const first = atN(N);
        if (!first) { histogramBody.replaceChildren(busyNote()); return; }
        const all = call(`distribution|${N}`, () => reportsAtN(E, { family, N, k: first.count }));
        if (!all) { histogramBody.replaceChildren(busyNote()); return; }
        let bins = histogramCache.get(all);
        if (!bins) {
          // Width-one display grouping; every input is an engine-returned report.
          const bucket = new Map();
          for (const report of all.reports) { const from = Math.floor(report.Ew); bucket.set(from, (bucket.get(from) ?? 0) + 1); }
          const from = Math.min(...bucket.keys()), to = Math.max(...bucket.keys());
          bins = Array.from({ length: to - from + 1 }, (_, i) => ({ from: from + i, to: from + i + 1, count: bucket.get(from + i) ?? 0 }));
          histogramCache.set(all, bins);
        }
        exposeResult(ctx, all, "distribution");
        exposeResult(ctx, { bins }, "histogram");
        const ter = evaluateReport(tertGrade, E, { tau: state.tau });
        const mark = [{ E: ter.Ew }];
        plot(histogramChart, {
          alt: "The complete distribution of expected wrong directions over every three-grade report at the tertiles' disclosure; the tertiles mark the smallest expected error.",
          table: { caption: "Every width-one expected-error bin", columns: [{ label: "From E", value: "from", format: formatCount }, { label: "To E (exclusive)", value: "to", format: formatCount }, { label: "Reports", value: "count", format: formatCount }], rows: bins },
          width: Math.round(histogramChart.clientWidth || 0) || ctx.width(), height: 190, aspect: false,
          marginLeft: 58, marginRight: 16, marginTop: 26, marginBottom: 40,
          x: { domain: [0, bins.at(-1).to], label: "Expected wrong directions E", labelArrow: "none" },
          y: { label: "Reports", grid: true, labelArrow: "none" },
          marks: (c, P) => [P.rectY(bins, { x1: "from", x2: "to", y: "count", fill: c.plotMuted, inset: .5 }), P.ruleY([0], { stroke: c.plotAxis }), P.ruleX(mark, { x: "E", stroke: c.post, strokeWidth: 3 })],
          keyboard: { data: bins, x: d => (d.from + d.to) / 2, y: "count", sort: false, title: d => `E from ${formatCount(d.from)} to ${formatCount(d.to)} (exclusive): ${formatCount(d.count)} reports.` },
        });
        pinTable(histogramChart, "hist-bin");
        const table = h("table", { class: "prx-cd-table" }, h("caption", {}, "The five least-error reports; grade vectors follow the displayed posterior-mean order"), h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Grades"), h("th", { scope: "col" }, "Expected wrong directions E"))), h("tbody", {}, ...all.reports.slice(0, 5).map((r, i) => h("tr", {}, h("th", { scope: "row" }, gradeVector(r.grade, i)), h("td", {}, expected(r.Ew, `hist-E-${i}`))))));
        histogramBody.replaceChildren(h("p", {class:"prx-cd-hist-annotation"}, h("span", {class:"prx-cd-mark prx-cd-mark-steps", style:"border-top-color:var(--prx-post)"}), " Tertiles: smallest E = ", expected(ter.Ew, "hist-tertile-E"), "; the vertical rule marks this value."), h("p", {}, count(all.count, "hist-count"), " reports state ", count(N, "hist-N"), " directions. The entire distribution is shown; bin width is ", count(1), "."), ctx.scrollRegion(h("div", { class: "prx-cd-scroll" }, table), "Five least-error reports at the tertiles' disclosure"));
      }

      function drawPathChanges() {
        const path = pathOf();
        if (!path) { pathChanges.replaceChildren(busyNote()); return; }
        const boundaries = path.intervals.slice(0, -1).map(iv => iv.tauTo);
        const optima = boundaries.map(tau => call(`endpoint|${tau.toPrecision(17)}`, () => exactOptimum(E, { tau, family })));
        const changes = path.intervals.slice(1).map((iv, i) => relationChange(path.intervals[i].grade, iv.grade, E));
        exposeResult(ctx, { boundaries, optima, changes }, "pathChanges");
        const sections = boundaries.map((tau, i) => {
          const before = path.intervals[i], after = path.intervals[i + 1], change = changes[i], optimum = optima[i];
          const table = h("table", { class: "prx-cd-table" }, h("caption", {}, "Every newly stated, newly withheld or reversed pair"), h("thead", {}, h("tr", {}, ...["Pair", "Before", "After", "Error of the new stated direction"].map(text => h("th", { scope: "col" }, text)))), h("tbody", {}, ...change.pairs.map((p, j) => h("tr", {}, h("th", { scope: "row" }, `${labels[p.i]}, ${labels[p.j]}`), h("td", {}, relationText(p.from, p.i, p.j)), h("td", {}, relationText(p.to, p.i, p.j)), h("td", {}, p.error === null ? "—" : prob(p.error, `path-change-${i}-error-${j}`))))));
          return h("section", {}, h("p", {}, "At τ = ", num(tau, formatSig(tau, { sig: 6 }), `path-boundary-${i}`), ": ", groups(before.grade), " becomes ", groups(after.grade), ". Newly stated ", count(change.nNewDisclosed, `path-change-${i}-stated`), ", newly withheld ", count(change.nNewWithheld, `path-change-${i}-withheld`), ", reversed ", count(change.nReversed, `path-change-${i}-reversed`), "."), optimum ? h("p", {}, count(optimum.tieCount, `path-boundary-${i}-ties`), " reports share the smallest risk at this boundary (equal-risk tolerance ", num(optimum.tieTol, formatSci(optimum.tieTol)), "): ", ...optimum.grades.flatMap((g, j) => [j ? "; " : "", groups(g)]), ".") : busyNote(), ctx.scrollRegion(h("div", { class: "prx-cd-scroll" }, table), "All pair changes at this τ boundary"));
        });
        pathChanges.replaceChildren(title("What every step changes"), h("p", { class: "prx-cd-note" }, "The first two exact boundaries lie below the slider minimum. They remain listed here. These changes use one fixed law and family. The archived dots and exact browser path use the same at-most-three-grade family; solver and enumeration labels distinguish how they were obtained."), ...sections);
      }

      function drawReadout(state, ev, grade, cs, t2, a, b) {
        const parts = [...filled(cs.length === 1 ? T.readAOne : T.readA, {
          tau: () => setting(state.tau, "ro-tau"), c1: () => count(cs[0], "ro-c1"), c2: () => count(cs[1], "ro-c2"), sizes: () => sizesNode(disclosure(grade).sizes, "ro-sizes"),
        })];
        if (!t2) parts.push(...filled(T.readResult, { N: () => count(ev.N, "ro-N"), M: () => count(M), risk: () => risk(ev.risk, "ro-risk") }));
        const v = T.readView[state.view];
        if (state.view === "matched") parts.push(...filled(v, { n: () => count(state.n, "ro-n") }));
        else if (state.view === "pair") parts.push(...filled(v, { a: () => school(a), b: () => school(b) }));
        else parts.push(v);
        ctx.readout.set(parts);
      }

      return {
        render(raw) {
          const state = { ...raw, view };
          // Keep the entire twelve-row card in the first desktop screen. Presets remain immediately below it.
          if (view === "cuts" && ctx.presets && ctx.controls.contains(ctx.presets)) cardBox.after(ctx.presets);
          ctx.root.setAttribute("aria-busy", "true");
          budget = CONFIG.heavyPerRender;
          waiting = false;
          try {
            tauSlider.set(state.tau);
            cut1.set(state.cuts[0]); cut2.set(state.cuts[1]);
            nSlider.set(state.n); fullToggle.set(state.full);
            pairA.set(state.pair[0]); pairB.set(state.pair[1]);
            nSlider.root.hidden = view !== "matched";
            fullToggle.root.hidden = view !== "matched";
            pairBox.hidden = view !== "pair";
            const cs = cutSet(state.cuts), grade = gradeOf(state.cuts);
            const ev = evaluateReport(grade, E, { tau: state.tau });
            for (const key of EXPOSED) exposeResult(ctx, null, key);
            const widthOf = node => Math.round(node.clientWidth || 0) || ctx.width();
            drawSettings(state.tau); drawCard(grade, state.cuts, false);
            drawResult(grade, ev, state.cuts, state.tau);
            let a = -1, b = -1;
            if (view === "cuts") {
              if (viewSlot.firstChild !== cutsWrap) viewSlot.replaceChildren(cutsWrap);
              const opt = optAt(state.tau);
              drawCompare(grade, ev, state.tau, opt); drawRelations(grade, opt);
            } else if (view === "matched") {
              if (viewSlot.firstChild !== matchedWrap) viewSlot.replaceChildren(matchedWrap);
              drawMatched(state, grade, ev, () => optAt(state.tau), widthOf(cloudChart));
              drawDistribution(state);
            } else if (view === "pair") {
              if (viewSlot.firstChild !== pairPanel) viewSlot.replaceChildren(pairPanel);
              ({ a, b } = drawPair(state, grade));
              drawPairMore(state, state.tau, a, b);
            } else {
              if (viewSlot.firstChild !== pathPanel) viewSlot.replaceChildren(pathPanel);
              drawPath(state, widthOf(pathChart));
              drawPathChanges();
            }
            drawReadout(state, ev, grade, cs, false, a, b);
          } finally {
            budget = Infinity;
            if (waiting) {
              if (!again) again = ctx.timeout(() => { again = null; ctx.requestRender("compute"); }, 0);
            } else ctx.root.removeAttribute("aria-busy");
          }

        },
      };
    },
  });
  return handle;
}
