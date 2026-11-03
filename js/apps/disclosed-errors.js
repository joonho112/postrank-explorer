// Linked report evaluation and posterior draws, with six normal sites or the shared three-unit law.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatEoverN, formatExpectedCount, formatGrades, formatProb, formatRational, formatRisk, formatSci, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, exposeResult, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  canonicalGrade, disclosure, evaluateReport, exactOptimum, familySize, finiteLawDraws, finiteLawPairwise, gaussianDraws, runningMean, summaryStats, realizedWrong, relations,
  statedAbove, wrongCountDistribution,
} from "../pr-core.js";
import { THREE_UNIT_LAW, THREE_UNIT_ERRORS } from "../shared/three-unit-law.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "disclosed-errors",
  label: "How often are disclosed directions wrong: a report's expected wrong directions, their share among the stated pairs, and draws of possible true values",
  title: "Stated directions that turn out wrong",
  className: "prx-de",
  laws: Object.freeze(["six", "finite"]),
  law: "six",
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  draws: Object.freeze({ min: 0, max: 2000, value: 0, many: 100 }),
  seed: Object.freeze({ min: 0, max: 999999, value: 1 }),
  cap: Object.freeze({ capped: 3, none: "none", value: "none", split: 4.5, noneWords: Object.freeze(["none", "all", "off", "no", "false"]) }),
  grades: Object.freeze({ maxLabel: 99, maxUnits: 6, value: Object.freeze([1, 2, 3, 3, 4, 5]) }),
  six: Object.freeze({ array: "one", spread: 2 }),
  law3: THREE_UNIT_LAW,
  // the report each example starts from when the learner switches to it
  starts: Object.freeze({ six: Object.freeze([1, 2, 3, 3, 4, 5]), finite: Object.freeze([1, 1, 2]) }),
  // named reports in each example's menu (blocks are written from the grade vector)
  named: Object.freeze({
    six: Object.freeze([
      Object.freeze([1, 2, 3, 3, 4, 5]), Object.freeze([1, 1, 2, 2, 3, 3]), Object.freeze([1, 2, 3, 4, 5, 6]), Object.freeze([1, 1, 1, 1, 1, 1]),
    ]),
    finite: Object.freeze([Object.freeze([1, 1, 2]), Object.freeze([1, 2, 2]), Object.freeze([1, 2, 3]), Object.freeze([1, 1, 1])]),
  }),
  digits: Object.freeze({ mean: 3, theta: 2, tauN: 1, tauNFine: 2 }),
  tauNTolerance: 1e-9,
  // a risk within this of τ counts as equal to τ when the widget says whether E ≤ τN holds for a learner's report
  riskTolerance: 1e-12,
  matrix: Object.freeze({
    marginTop: 22, marginLeft: 22, marginRight: 4, marginBottom: 4,
    minCell: 34, maxCell: 56, inset: 0.5, dotShare: 0.3, hatchSpacing: 6, hatchWidth: 1.2, symbolShare: 0.42, labelWeight: 700,
    wrongWidth: 3, wrongInset: 2.5, crossShare: 0.26, crossDx: 0.27, crossDy: 0.25, labelHalo: 3,
  }),
  strip: Object.freeze({ row: 24, marginTop: 8, marginBottom: 40, marginLeft: 84, marginRight: 14, domain: Object.freeze([-2, 2.4]), r: 5, tick: 9, labelOffset: 34, link: 2 }),
  hist: Object.freeze({ height: 176, marginTop: 22, marginBottom: 42, marginLeft: 44, marginRight: 10, half: 0.38, minBins: 3, labelOffset: 36, labelDy: -6 }),
  run: Object.freeze({ height: 196, marginTop: 18, marginBottom: 42, marginLeft: 44, marginRight: 14, maxPoints: 400, minX: 10, rule: "5 3", labelOffset: 36, top: 1.15, minTop: 0.5 }),
  text: Object.freeze({
    lawLegend: "Example",
    lawSix: "Six sites, score A (independent normal posteriors)",
    lawFinite: "Three units, a finite law (theory book, chapter 10)",
    reportLabel: "Report",
    ownReport: "Your own (set the grades below)",
    gradesLegend: "Grade of each unit (grade 1 = highest priority; labels are tidied)",
    gradeOf: "Grade of",
    familyLegend: "Family shown",
    familyAll: "All reports",
    familyCap: "At most",
    familyCapEnd: "grades",
    reports: "reports",
    tauSlider: "Withholding cost τ",
    tauHint: "A wrong stated direction costs 1; staying silent on one pair costs τ. E and E/N do not depend on τ.",
    drawOne: "Draw once",
    drawMany: "Draw",
    drawReset: "Clear the draws",
    seedLabel: "Seed",
    drawsFull: "The widget keeps at most",
    drawsFullEnd: "draws; clear them to start again.",
    matrixHeading: "The report, and this draw",
    matrixAlt: "Relation matrix of the report: each cell says whether the report states the row unit above the column unit, withholds the pair, or states the row unit below; a stated direction that is wrong in the current draw is crossed and outlined.",
    matrixTable: "The pairs, what the report does with each, the error of each stated direction and whether it is wrong in this draw",
    relationTitle: "Row unit relative to column unit in this report",
    relAbove: "row stated above (the number: the error of that statement)",
    relWithheld: "withheld: same grade (not a claim of equality)",
    relBelow: "row stated below",
    gradeKey: "circle: the unit's grade",
    wrongKey: "cross and outline: a stated direction that is wrong in this draw",
    drawHeading: "Possible true values in this draw",
    stripAlt: "Each site's drawn true value as a dot, against a gray line from its posterior mean minus 2 SD to plus 2 SD.",
    stripTable: "The drawn true values of this draw",
    stripKey: Object.freeze(["dot: the value drawn for this site; gray line and tick: its posterior, mean ± ", " SD; black line: a stated pair that this draw puts the other way round"]),
    noDraw: "No draws yet. Press Draw once or Draw",
    noDrawShort: "No draw yet.",
    lawTableHeading: "The four possible orders",
    lawTableCaption: "Each order with its probability and the number of this report's stated directions it makes wrong",
    orderCol: "Order, highest first",
    probCol: "Probability",
    wrongCol: "Wrong stated directions",
    lastDrawCol: "Last draw",
    resultsHeading: "Expected and realized wrong directions",
    tileN: "Directions stated, N",
    tileE: "Expected wrong directions, E",
    tileEN: "Expected share wrong, E/N",
    tileTau: "Withholding cost τ",
    naNote: "none of the pairs is stated",
    histHeading: "Draws by the number of wrong stated directions",
    histAlt: "Bars: how many of the draws had zero, one, two or more wrong stated directions.",
    histTable: "Draws by the number of wrong stated directions",
    runHeading: "Average number wrong over the draws so far",
    runAlt: "Line: the average number of wrong stated directions over the first draws, as the draws accumulate; the dashed line is E.",
    runTable: "The running average of the wrong count",
    runKeyLine: "solid line: the average over the draws so far",
    runKeyE: "dashed line: E, the expected number wrong",
    drawsLead: "The average comes from these draws; E and E/N come from the error probabilities. Changing the report keeps the draws, so the same possible true values are scored against the new report.",
    note: "Six fictional sites from the postrank tutorial, score A, and a finite three-unit law from the postrank theory book, chapter 10. The six latent values are independent normals; both posteriors are taken as given",
    tolerance: "Equal-risk tolerance",
    toleranceGloss: "(risks closer than this count as equal).",
    useBest: "Use the best report",
    boundYes: "E ≤ τN applies:",
    boundYesEnd: ", a family that includes the all-withheld report.",
    boundAverage: "The bound concerns the average over the stated pairs; a single stated direction can still have an error above τ.",
    boundNo: "E/N and τ side by side (not a bound):",
    notInFamily: "This report is not in the family shown, so no bound is shown for it.",
    notOptimum: "The E ≤ τN optimality badge is shown only for the exact optimum of the family shown, when that family includes the all-withheld report; this report is not that optimum at this τ.",
    noAllWithheld: "The family shown does not include the all-withheld report, so no bound is shown.",
    holdsOwn: "E ≤ τN holds for this report (risk",
    holdsOwnEnd: "≤ τ), though it is not guaranteed by optimality: it holds exactly when the risk is at most τ.",
    failsOwn: "E > τN for this report (risk",
    failsOwnEnd: "> τ): it does worse than withholding every pair.",
  }),
});

const T = CONFIG.text;
const MX = CONFIG.matrix;
const SVGNS = "http://www.w3.org/2000/svg";
const L3 = CONFIG.law3;

// ---------------------------------------------------------------------------------------------- the two examples

/** The released error array of score A (JSON null on the diagonal becomes NaN). */
function sixErrors() {
  const a = SIX.arrays[CONFIG.six.array];
  return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))) };
}

const UNITS = SIX.tables.units;
const LAWS = Object.freeze({
  six: Object.freeze({
    key: "six", ids: Object.freeze(UNITS.id.slice()), E: sixErrors(), means: UNITS.mean_A.slice(), sds: UNITS.sd_A.slice(), unitWord: "site",
  }),
  finite: Object.freeze({
    key: "finite", ids: L3.ids, unitWord: "unit",
    E: THREE_UNIT_ERRORS,
  }),
});

const familyOf = (law, cap) => (law === "six" && cap !== CONFIG.cap.none ? { kind: "atMost", G: cap } : { kind: "all" });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const couplingCache = new Map();
/** Same pair probabilities, another joint law. At zero, keep the original four-state draw-index API. */
export function finiteCoupling(u = 0) {
  if (typeof u !== "number" || !Number.isFinite(u) || u < 0 || u > L3.probs[3]) throw new RangeError("finiteCoupling: u must be between 0 and .1");
  if (u === 0) return L3;
  if (!couplingCache.has(u)) {
    const order = "BCA";
    const states = [...L3.states.slice(0, 3), L3.ids.map(id => [L3.ids.length - order.indexOf(id)]), L3.states[3]];
    couplingCache.set(u, { ids: L3.ids, orders: [...L3.orders.slice(0, 3), order, L3.orders[3]], states,
      probs: [L3.probs[0] - u, L3.probs[1] + u, L3.probs[2], u, L3.probs[3] - u] });
  }
  return couplingCache.get(u);
}
const finiteErrors = new Map();
function finiteLawFor(u = 0) {
  const joint = finiteCoupling(u);
  if (u !== 0 && !finiteErrors.has(u)) finiteErrors.set(u, finiteLawPairwise(joint.states, joint.probs, { ids: L3.ids, criteria: THREE_UNIT_ERRORS.criteria }));
  return { ...LAWS.finite, joint, E: u === 0 ? THREE_UNIT_ERRORS : finiteErrors.get(u) };
}

// ---------------------------------------------------------------------------------------------- keys

/** grades: an array or "1,2,3" / "1/2/3"; labels rounded and clamped to 1 … maxLabel; at most six entries. */
export function parseGrades(v) {
  const list = Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v)
    : typeof v === "string" ? v.split(/[\s,/]+/).filter((s) => s !== "").map(Number) : null;
  if (!list || list.length < 1) return undefined;
  const out = [];
  for (const x of list) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return undefined;
    out.push(Math.min(CONFIG.grades.maxLabel, Math.max(1, Math.round(n))));
  }
  return out.slice(0, CONFIG.grades.maxUnits);
}

/** cap: 3 or "none" (a number goes to the nearer of the two; words meaning "no cap" give "none"). */
export function parseCap(v) {
  if (typeof v === "string" && CONFIG.cap.noneWords.includes(v.trim().toLowerCase())) return CONFIG.cap.none;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return n < CONFIG.cap.split ? CONFIG.cap.capped : CONFIG.cap.none;
}

/** The report shown: the labels cut or filled to the law's units, in canonical form. */
export function reportOf(state) {
  const law = state.law === "finite" ? finiteLawFor(state.coupling ?? 0) : LAWS[state.law];
  const n = law.ids.length;
  let raw = Array.from(state.grades ?? []).slice(0, n);
  if (raw.length === 0) raw = Array.from(CONFIG.starts[state.law]);
  while (raw.length < n) raw.push(Math.max(...raw));
  return { law, n, raw, g: Array.from(canonicalGrade(raw)) };
}

/** The units of each grade, grade 1 first. */
function blocksOf(g, ids) {
  const G = Math.max(...g);
  const out = [];
  for (let k = 1; k <= G; k += 1) out.push(ids.filter((_, i) => g[i] === k));
  return out;
}

/** "{A, B} > {C}" (letters only, so it is plain text). */
export const blocksText = (g, ids) => blocksOf(g, ids).map((b) => `{${b.join(", ")}}`).join(" > ");

/** A value as an exact fraction when it is one (the finite law), else in the risk format. */
function exact(v) {
  try { return formatRational(v); } catch { return formatRisk(v); }
}

// ---------------------------------------------------------------------------------------------- draws (cached)

const drawCache = { key: null, theta: null };
/** The first S draws of one seed: six sites, theta[s][i] = [value]; finite law, the index of the order drawn. */
export function drawsOf(law, seed, S, coupling = 0) {
  if (S < 1) return [];
  const key = `${law}|${seed}|${S}|${law === "finite" ? coupling : 0}`;
  if (drawCache.key === key) return drawCache.theta;
  let out;
  if (law === "six") out = gaussianDraws(LAWS.six.means, LAWS.six.sds, S, seed);
  else {
    out = Array.from(finiteLawDraws(finiteCoupling(coupling).probs, S, seed));
  }
  drawCache.key = key;
  drawCache.theta = out;
  return out;
}

const countCache = { key: null, counts: null };
/** Wrong stated directions of report g in each of the first S draws (realizedWrong). */
export function countsOf(law, seed, S, g, coupling = 0) {
  if (S < 1) return [];
  const key = `${law}|${seed}|${S}|${g.join(",")}|${law === "finite" ? coupling : 0}`;
  if (countCache.key === key) return countCache.counts;
  const draws = drawsOf(law, seed, S, coupling);
  let counts;
  if (law === "six") counts = draws.map((theta) => realizedWrong(g, theta).D[0]);
  else {
    const byOrder = finiteCoupling(coupling).states.map((st) => realizedWrong(g, st).D[0]);
    counts = draws.map((k) => byOrder[k]);
  }
  countCache.key = key;
  countCache.counts = counts;
  return counts;
}

const optCache = new Map();
function optimumOf(law, cap, tau, coupling = 0) {
  const key = `${law}|${cap}|${tau}|${law === "finite" ? coupling : 0}`;
  if (!optCache.has(key)) {
    if (optCache.size >= 128) optCache.delete(optCache.keys().next().value);
    optCache.set(key, exactOptimum(law === "finite" ? finiteLawFor(coupling).E : LAWS[law].E, { tau, family: familyOf(law, cap) }));
  }
  return optCache.get(key);
}

const CSS = `.prx-de .prx-de-heading{
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-de .prx-de-panel{
  min-width: 0;
  margin: 0 0 1rem;
}
.prx-de .prx-de-grid{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 0 1.25rem;
  align-items: start;
  min-width: 0;
}
.prx-de .prx-de-side, .prx-de .prx-de-sub, .prx-de .prx-de-chart, .prx-de .prx-de-matrix, .prx-de .prx-de-thisdraw{
  min-width: 0;
  max-width: 100%;
}
.prx-de .prx-de-thisdraw{
  margin-top: 0.75rem;
}
.prx-de .prx-de-law{
  display: flex;
  flex: 0 0 auto;
  width: 100%;
  flex-wrap: wrap;
  column-gap: 1rem;
}
.prx-de .prx-de-law > legend, .prx-de .prx-de-family > legend{
  flex: 1 1 100%;
}
.prx-de .prx-de-family{
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}
.prx-de .prx-de-report{
  display: flex;
  flex: 0 0 auto;
  width: 100%;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  align-items: flex-end;
  min-width: 0;
}
.prx-de .prx-de-report > .prx-select{
  flex: 0 1 18rem;
}
.prx-de .prx-de-report select{
  max-width: 100%;
}
.prx-de .prx-de-grades{
  display: flex;
  flex: 1 1 18rem;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
  padding: 0;
  border: 0;
}
.prx-de .prx-de-grades > legend{
  flex: 1 1 100%;
}
.prx-de .prx-de-grades .prx-select{
  display: inline-flex;
  flex: 0 0 auto;
  gap: 0.3rem;
  align-items: center;
  width: auto;
  margin: 0;
}
.prx-de .prx-de-grades .prx-select > label{
  margin: 0;
}
.prx-de .prx-de-draw-row{
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}
.prx-de .prx-de-draw-buttons{
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.prx-de .prx-de-draw-row .prx-number{
  flex: 0 0 auto;
  width: auto;
}
.prx-de .prx-de-draw-row .prx-number input{
  width: 7em;
}
.prx-de .prx-de-note{
  margin: 0.35rem 0 0.5rem;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-tiles{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  gap: 0.5rem;
}
.prx-de .prx-de-tile{
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.prx-de .prx-de-tile-name{
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-tile-value{
  font-size: 1.15em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.prx-de .prx-de-tile-note, .prx-de .prx-de-event-note{
  font-size: 0.8em;
  font-weight: 400;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-event-note{
  display: block;
  margin-top: 0.15rem;
}
.prx-de .prx-de-caption{
  margin: 0.35rem 0 0.5rem;
  font-size: 0.85em;
  font-style: italic;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-bound p, .prx-de .prx-de-best p{
  margin: 0.4rem 0 0;
  font-size: 0.95em;
}
.prx-de .prx-de-badge{
  padding: 0.45rem 0.6rem;
  background: var(--prx-bg-raised);
  border-left: 3px solid var(--prx-accent);
  border-radius: var(--prx-radius, 6px);
}
.prx-de .prx-de-badge-no{
  border-left-color: var(--prx-border-strong);
}
.prx-de .prx-de-badge .prx-result-label, .prx-de .prx-de-label .prx-result-label{
  font-weight: 600;
}
.prx-de .prx-de-caution{
  font-size: 0.9em;
}
.prx-de .prx-de-best{
  margin-top: 0.5rem;
}
.prx-de .prx-de-panel > .prx-btn{
  margin-top: 0.5rem;
}
.prx-de .prx-de-label{
  font-size: 0.9em;
}
.prx-de .prx-de-drawline, .prx-de .prx-de-summary{
  margin: 0.25rem 0 0.5rem;
  font-size: 0.95em;
  overflow-wrap: anywhere;
}
.prx-de .prx-de-thetas{
  display: block;
  margin-top: 0.15rem;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
  font-variant-numeric: tabular-nums;
}
.prx-de .prx-de-lawbox{
  min-width: 0;
  margin: 0 0 1rem;
}
.prx-de .prx-de-table{
  margin: 0 0 0.5rem;
  border-collapse: collapse;
  font-size: 0.95em;
  font-variant-numeric: tabular-nums;
}
.prx-de .prx-de-table caption{
  caption-side: top;
  padding: 0 0 0.25rem;
  text-align: left;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-table th, .prx-de .prx-de-table td{
  padding: 0.2rem 0.75rem 0.2rem 0;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}
.prx-de .prx-de-table td{
  text-align: right;
}
.prx-de .prx-de-table td.prx-de-lastcell{
  text-align: left;
  font-style: italic;
}
.prx-de .prx-de-table tr.prx-de-last th, .prx-de .prx-de-table tr.prx-de-last td{
  font-weight: 600;
}
.prx-de .prx-de-formula{
  max-width: 100%;
  overflow-x: auto;
}
.prx-de .prx-de-legend{
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
.prx-de .prx-de-legend-title{
  flex: 1 1 100%;
  font-weight: 600;
}
.prx-de .prx-de-key{
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}
.prx-de .prx-de-swatch{
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}
.prx-de .prx-de-swatch-hatch{
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 5px);
}
.prx-de .prx-de-swatch-dot{
  background: var(--prx-grade-1);
  border-radius: 50%;
}
.prx-de .prx-de-swatch-cross{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  font-weight: 700;
  line-height: 1;
  background: var(--prx-plot-bg);
  border: 2.5px solid var(--prx-plot-fg);
}
.prx-de .prx-de-swatch-line{
  height: 0;
  border: 0;
  border-top: 2px solid var(--prx-plot-fg);
}
.prx-de .prx-de-swatch-rule{
  height: 0;
  border: 0;
  border-top: 2px dashed var(--prx-err);
}
`;

/** Shared draw buttons and seed field; caller renders disabled states from its draws key. */
export function createDrawControls(ctx) {
  const { h } = ctx;
  const btnOne = ctx.button({ label: T.drawOne, key: "draw-one", onClick: () => ctx.set({ draws: ctx.state.draws + 1 }) });
  const btnMany = ctx.button({ label: [`${T.drawMany} `, ctx.num(CONFIG.draws.many, formatCount(CONFIG.draws.many))], key: "draw-many", onClick: () => ctx.set({ draws: ctx.state.draws + CONFIG.draws.many }) });
  const btnReset = ctx.button({ label: T.drawReset, key: "draw-reset", onClick: () => ctx.set({ draws: 0 }) });
  const seed = ctx.numberInput({
    label: T.seedLabel, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
    onInput: (v) => { if (Number.isFinite(v)) ctx.set({ seed: Math.round(v) }); },
  });
  const drawNote = h("p", { class: "prx-de-note", "data-prx-part": "notes", hidden: true });
  const drawRow = h("div", { class: "prx-de-draw-row" }, h("div", { class: "prx-de-draw-buttons" }, btnOne.root, btnMany.root, btnReset.root), seed.root);

  return { row: drawRow, note: drawNote, one: btnOne, many: btnMany, clear: btnReset, seed };
}


/** Empirical wrong-count histogram with the original top-bin rule and keyboard table. */
export function drawHistogram(ctx, histSlot, counts, N, { zeroEvent = false } = {}) {
  const H = CONFIG.hist;
  const top = N < H.minBins ? N : Math.max(H.minBins - 1, Math.min(N, Math.max(0, ...counts)));
  const bins = Array.from({ length: top + 1 }, (_, k) => ({ k, draws: 0 }));
  for (const x of counts) bins[Math.min(top, x)].draws += 1;
  plot(histSlot, {
    alt: T.histAlt + (zeroEvent ? " The zero bin is the event that every stated direction is right." : ""),
    table: {
      caption: T.histTable,
      columns: [
        { label: "Wrong stated directions", value: "k", format: (v) => formatCount(v) },
        { label: "Draws", value: "draws", format: (v) => formatCount(v) },
        ...(zeroEvent ? [{ label: "Event", value: d => d.k === 0 ? "every stated direction right" : "some stated direction wrong", num: false }] : []),
      ],
      rows: bins,
    },
    height: H.height, marginTop: H.marginTop, marginBottom: H.marginBottom, marginLeft: H.marginLeft, marginRight: H.marginRight,
    color: { type: "identity" },
    x: { domain: [-1 / 2, top + 1 / 2], ticks: bins.map((b) => b.k), label: "wrong stated directions in a draw", labelAnchor: "center", labelArrow: "none", labelOffset: H.labelOffset },
    y: { label: "draws", labelArrow: "none", grid: true, nice: true },
    marks: (c, P) => [
      P.rectY(bins, { x1: (d) => d.k - H.half, x2: (d) => d.k + H.half, y: "draws", fill: d => zeroEvent && d.k === 0 ? c.post : c.plotGrid, stroke: c.plotFg }),
      P.ruleY([0], { stroke: c.plotAxis }),
      numText(bins, { x: "k", y: "draws", value: "draws", format: (v) => formatCount(v), dy: H.labelDy, lineAnchor: "bottom", fill: c.plotFg }),
    ],
    keyboard: { data: bins, x: "k", y: "draws", sort: false, label: T.histHeading, title: (d) => `${formatCount(d.draws)} ${d.draws === 1 ? "draw" : "draws"} with ${formatCount(d.k)}${d.k === top && top < N ? " or more" : ""} wrong stated directions.${zeroEvent && d.k === 0 ? " Every stated direction is right in this zero bin." : ""}` },
  });
}

/** Engine running means, at most 400 displayed points, and the expected-count reference. */
export function drawRunningAverage(ctx, runSlot, counts, E) {
  const R = CONFIG.run;
  const S = counts.length;
  const means = runningMean(counts);
  const visible = Math.min(S, R.maxPoints);
  const pts = Array.from({ length: visible }, (_, k) => {
    const i = visible === 1 ? 0 : Math.round(k * (S - 1) / (visible - 1));
    return { s: i + 1, avg: means[i] };
  });
  const top = Math.max(R.minTop, E * R.top, ...pts.map((p) => p.avg));
  plot(runSlot, {
    alt: T.runAlt,
    table: {
      caption: T.runTable,
      columns: [
        { label: "Draws so far", value: "s", format: (v) => formatCount(v) },
        { label: "Average wrong", value: "avg", format: (v) => formatDecimal(v, { digits: CONFIG.digits.mean }) },
      ],
      rows: pts,
    },
    height: R.height, marginTop: R.marginTop, marginBottom: R.marginBottom, marginLeft: R.marginLeft, marginRight: R.marginRight,
    x: { domain: [1, Math.max(R.minX, S)], label: "draws so far", labelAnchor: "center", labelArrow: "none", labelOffset: R.labelOffset },
    y: { domain: [0, top], label: null, nice: true, grid: true },
    marks: (c, P) => [
      P.ruleY([E], { stroke: c.err, strokeDasharray: R.rule, strokeWidth: 2 }),
      P.line(pts, { x: "s", y: "avg", stroke: c.plotFg, strokeWidth: 2 }),
      P.dot(pts.slice(-1), { x: "s", y: "avg", r: 3, fill: c.plotFg }),
    ],
    keyboard: { data: pts.slice(-1), x: "s", y: "avg", sort: false, label: T.runHeading, title: (d) => `After ${formatCount(d.s)} draws the average is ${formatDecimal(d.avg, { digits: CONFIG.digits.mean })} wrong stated directions; E is ${formatExpectedCount(E)}.` },
  });
}

/** Normal-law draw panel; rep.law supplies ids, means, sds and rep.g supplies grades. */
export function drawTrueValueStrip(ctx, stripSlot, rep, theta, wrongPairs, { domain = CONFIG.strip.domain } = {}) {
  const S = CONFIG.strip;
  const ids = rep.law.ids;
  const rows = ids.map((id, i) => ({
    id, i, grade: rep.g[i], label: `${id} (grade ${rep.g[i]})`, theta: theta[i][0], mean: rep.law.means[i],
    lo: rep.law.means[i] - CONFIG.six.spread * rep.law.sds[i], hi: rep.law.means[i] + CONFIG.six.spread * rep.law.sds[i],
  }));
  const labels = rows.map((r) => r.label);
  const links = wrongPairs.map((p) => ({ x1: rows[p.i].theta, y1: rows[p.i].label, x2: rows[p.j].theta, y2: rows[p.j].label }));
  plot(stripSlot, {
    alt: T.stripAlt,
    table: {
      caption: T.stripTable,
      columns: [
        { label: "Site", value: "id" },
        { label: "Grade in the report", value: "grade", format: (v) => formatCount(v) },
        { label: "Drawn value", value: "theta", format: (v) => formatDecimal(v, { digits: CONFIG.digits.theta }) },
        { label: "Posterior mean", value: "mean", format: (v) => formatDecimal(v, { digits: CONFIG.digits.theta }) },
      ],
      rows,
    },
    height: S.marginTop + S.marginBottom + rows.length * S.row,
    marginTop: S.marginTop, marginBottom: S.marginBottom, marginLeft: S.marginLeft, marginRight: S.marginRight,
    x: { domain: Array.from(domain), label: "true value θ in this draw", labelAnchor: "center", labelArrow: "none", labelOffset: S.labelOffset },
    y: { domain: labels, label: null, tickSize: 0 },
    marks: (c, P) => [
      P.ruleY(rows, { y: "label", x1: "lo", x2: "hi", stroke: c.plotGrid, strokeWidth: S.r }),
      P.tickX(rows, { y: "label", x: "mean", stroke: c.plotMuted, strokeWidth: 2, inset: S.row / 2 - S.tick / 2 }),
      P.link(links, { x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: c.plotFg, strokeWidth: S.link }),
      P.dot(rows, { y: "label", x: "theta", r: S.r, fill: c.plotFg, stroke: c.plotBg }),
    ],
    keyboard: {
      data: rows, x: "theta", y: "label", sort: false, label: T.drawHeading,
      title: (d) => `${d.id}, grade ${d.grade}: drawn value ${formatDecimal(d.theta, { digits: CONFIG.digits.theta })}, posterior mean ${formatDecimal(d.mean, { digits: CONFIG.digits.theta })}.`,
    },
  });
  return rows;
}

/** Render the current draw and its NA-safe share; theta is supplied for normal laws. */
export function drawCurrentDraw(ctx, { line: drawLine, strip: stripSlot, key: stripKey }, rep, state, rw, last, { theta = null, domain = CONFIG.strip.domain } = {}) {
  const { h } = ctx;
  const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
  const S = state.draws;
  const appendValues = () => {
    if (rep.law.key === "finite") return;
    const rows = drawTrueValueStrip(ctx, stripSlot, rep, theta, rw.pairs[0], { domain });
    const vals = rows.flatMap((r, i) => [i ? ", " : "", `${r.id} `, ro(`theta.${r.id}`, r.theta, formatDecimal(r.theta, { digits: CONFIG.digits.theta }))]);
    drawLine.append(h("span", { class: "prx-de-thetas" }, " Drawn values: ", ...vals, "."));
  };
  stripSlot.hidden = rep.law.key === "finite" || S === 0;
  stripKey.hidden = stripSlot.hidden;
  if (S === 0 || !rw) {
    drawLine.replaceChildren(T.noDrawShort);
    return;
  }
  const N = rw.N;
  const k = rw.D[0];
  const head = ["Draw ", ro("drawIndex", S, formatCount(S)), " of ", ctx.num(S, formatCount(S)), ": "];
  const joint = rep.law.joint ?? L3;
  if (rep.law.key === "finite") head.push("the order ", joint.orders[last].split("").join(" > "), " (probability ", ctx.num(joint.probs[last], exact(joint.probs[last])), "). ");
  if (N === 0) {
    drawLine.replaceChildren(...head, rep.law.key === "finite" ? "Nothing" : "nothing", " is stated, so nothing can be wrong; the share is ", ro("lastShare", null, formatEoverN(null)), ".");
    appendValues();
    return;
  }
  const wrongWords = rw.pairs[0].map((p) => `${rep.law.ids[p.i]} above ${rep.law.ids[p.j]}`);
  const shareV = rw.DoverN[0];
  drawLine.replaceChildren(...head, ro("last", k, formatCount(k)), ` of the `, ctx.num(N, formatCount(N)), ` stated directions ${k === 1 ? "is" : "are"} wrong (share in this draw `,
    ro("lastShare", shareV, rep.law.key === "finite" ? exact(shareV) : formatShare(shareV)), ")",
    wrongWords.length ? `: ${wrongWords.join(", ")}.` : ".");
  appendValues();

}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    css: CSS,
    keys: {
      law: { type: "choice", values: CONFIG.laws.slice(), value: CONFIG.law },
      grades: { type: "custom", parse: (v) => parseGrades(v), value: CONFIG.grades.value.slice() },
      cap: { type: "custom", parse: (v) => parseCap(v), value: CONFIG.cap.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      draws: { type: "integer", min: CONFIG.draws.min, max: CONFIG.draws.max, value: CONFIG.draws.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      coupling: { type: "number", min: 0, max: L3.probs[3], step: .005, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const hatchId = uid("prx-de-hatch");

      // --- node helpers: numbers carry data-num; read-out numbers also a data-prx-readout name
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const tauNode = (tau) => ctx.num(tau, formatSetting(tau));
      const gradeNum = (g, name) => (name ? ro(name, g.slice(), formatGrades(g)) : ctx.num(g.slice(), formatGrades(g)));
      const tauNText = (v, law) => {
        if (law === "finite") return exact(v);
        const d = CONFIG.digits;
        const one = Math.abs(v * (10 ** d.tauN) - Math.round(v * (10 ** d.tauN))) < CONFIG.tauNTolerance;
        return formatDecimal(v, { digits: one ? d.tauN : d.tauNFine });
      };
      const eText = (v, law) => (law === "finite" ? exact(v) : formatExpectedCount(v));
      const enText = (v, law) => (v === null || v === undefined ? formatEoverN(null) : law === "finite" ? exact(v) : formatShare(v));
      const errText = (v, law) => (law === "finite" ? exact(v) : formatProb(v));

      // --- controls
      const lawRadio = ctx.radioGroup({
        legend: T.lawLegend, name: "law", className: "prx-de-law",
        options: [{ value: "six", label: T.lawSix }, { value: "finite", label: T.lawFinite }],
        value: ctx.state.law,
        onChange: (v) => ctx.set({ law: v, grades: Array.from(CONFIG.starts[v]), draws: 0 }),
      });
      const reportMenus = {};
      const gradeBoxes = {};
      for (const key of CONFIG.laws) {
        const law = LAWS[key];
        const options = CONFIG.named[key].map((g) => ({ value: g.join(","), label: `${blocksText(g, law.ids)}` }));
        options.push({ value: "custom", label: T.ownReport });
        reportMenus[key] = ctx.select({
          label: T.reportLabel, name: `report-${key}`, options, value: CONFIG.starts[key].join(","),
          onChange: (v) => { if (v && v !== "custom") ctx.set({ grades: v.split(",").map(Number) }); },
        });
        const n = law.ids.length;
        const selects = law.ids.map((id, i) => ctx.select({
          label: id, name: `grade-${key}-${id}`,
          options: Array.from({ length: n }, (_, k) => ({ value: k + 1, label: String(k + 1) })),
          value: CONFIG.starts[key][i],
          onChange: (v) => {
            const rep = reportOf(ctx.state);
            const raw = rep.g.slice();
            raw[i] = v;
            ctx.set({ grades: raw });
          },
        }));
        for (const [i, s] of selects.entries()) s.input.setAttribute("aria-label", `${T.gradeOf} ${law.ids[i]}`);
        const box = h("fieldset", { class: "prx-control prx-de-grades" }, h("legend", {}, T.gradesLegend), ...selects.map((s) => s.root));
        gradeBoxes[key] = { box, selects };
      }
      const famSizes = { all: familySize(LAWS.six.ids.length, { kind: "all" }), cap: familySize(LAWS.six.ids.length, { kind: "atMost", G: CONFIG.cap.capped }) };
      const familyRadio = ctx.radioGroup({
        legend: T.familyLegend, name: "cap", className: "prx-de-family",
        options: [
          { value: CONFIG.cap.none, label: [`${T.familyAll}, `, ctx.num(famSizes.all, formatCount(famSizes.all)), ` ${T.reports}`] },
          { value: CONFIG.cap.capped, label: [`${T.familyCap} `, ctx.num(CONFIG.cap.capped, formatCount(CONFIG.cap.capped)), ` ${T.familyCapEnd}, `, ctx.num(famSizes.cap, formatCount(famSizes.cap)), ` ${T.reports}`] },
        ],
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const tau = ctx.slider({
        label: T.tauSlider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: ["A wrong stated direction costs ", ctx.num(1, formatCount(1)), "; staying silent on one pair costs τ. E and E/N do not depend on τ."], onInput: (v) => ctx.set({ tau: v }),
      });
      const { row: drawRow, note: drawNote, one: btnOne, many: btnMany, clear: btnReset, seed } = createDrawControls(ctx);
      const reportBox = h("div", { class: "prx-de-report" }, reportMenus.six.root, reportMenus.finite.root, gradeBoxes.six.box, gradeBoxes.finite.box);
      ctx.controls.append(lawRadio.root, reportBox, familyRadio.root, tau.root, drawRow, drawNote);

      ctx.controls.after(ctx.readout.node);

      // --- panels
      const matrixSlot = h("div", { class: "prx-de-matrix" });
      const matrixLegend = h("div", { class: "prx-de-legend", "data-prx-part": "legend" });
      const stripSlot = h("div", { class: "prx-de-chart" });
      const drawLine = h("p", { class: "prx-de-drawline", "data-prx-part": "readout" });
      const stripKey = h("div", { class: "prx-de-legend", "data-prx-part": "legend" }, h("span", {}, T.stripKey[0], ctx.num(CONFIG.six.spread, formatCount(CONFIG.six.spread)), T.stripKey[1]));
      const lawTableSlot = h("div", { class: "prx-de-law-table", "data-prx-part": "readout" });
      const lawFormula = h("div", { class: "prx-de-formula", "data-prx-part": "readout", "data-prx-tex": "law-E" });
      const lawHeading = h("h4", { class: "prx-de-heading", text: T.lawTableHeading });
      const coupling = ctx.slider({ label: "Coupling shift u", ...ctx.key("coupling"), format: v => formatDecimal(v, { digits: 3 }), onInput: u => ctx.set({ coupling: u }),
        hint: "Moves probability among whole orders while keeping every pair's wrong-direction probability unchanged." });
      const pairErrors = h("p", { class: "prx-de-note" });
      ctx.scrollRegion(lawTableSlot, "Finite-law order table");
      const lawBox = h("div", { class: "prx-de-lawbox" }, lawHeading, coupling.root, lawTableSlot, lawFormula, pairErrors);
      const thisDraw = h("div", { class: "prx-de-thisdraw" }, h("h4", { class: "prx-de-heading", text: T.drawHeading }), drawLine, stripSlot, stripKey);
      const matrixPanel = h("section", { class: "prx-de-panel", "aria-label": T.matrixHeading, "data-prx-part": "chart" },
        h("h4", { class: "prx-de-heading", text: T.matrixHeading }), matrixSlot, matrixLegend, thisDraw);

      const tiles = h("div", { class: "prx-de-tiles", "data-prx-part": "readout" });
      const evalCaption = h("p", { class: "prx-de-caption", "data-prx-part": "caption" });
      const eventNote = h("p", { class: "prx-de-note" });
      const bound = h("div", { class: "prx-de-bound", "data-prx-part": "readout" });
      const best = h("div", { class: "prx-de-best", "data-prx-part": "readout" });
      const bestBtn = ctx.button({ label: T.useBest, key: "use-best", onClick: () => { const o = optimumOf(ctx.state.law, ctx.state.cap, ctx.state.tau, ctx.state.coupling); if (!o.empty) ctx.set({ grades: Array.from(o.grade) }); } });
      const resultsPanel = h("section", { class: "prx-de-panel", "aria-label": T.resultsHeading },
        h("h4", { class: "prx-de-heading", text: T.resultsHeading }), tiles, eventNote, evalCaption, bound, best, bestBtn.root);

      const histSlot = h("div", { class: "prx-de-chart" });
      const histEvent = h("p", { class: "prx-de-note", "data-prx-part": "readout" });
      const runSlot = h("div", { class: "prx-de-chart" });
      const runLegend = h("div", { class: "prx-de-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-line" }), T.runKeyLine),
        h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-rule" }), T.runKeyE));
      const drawsSummary = h("p", { class: "prx-de-summary", "data-prx-part": "readout" });
      const mcCaption = h("p", { class: "prx-de-caption", "data-prx-part": "caption" });
      const drawsCharts = h("div", { class: "prx-de-grid" },
        h("div", { class: "prx-de-sub" }, h("h4", { class: "prx-de-heading", text: T.histHeading }), histSlot, histEvent),
        h("div", { class: "prx-de-sub" }, h("h4", { class: "prx-de-heading", text: T.runHeading }), runSlot, runLegend));
      const noDraws = h("p", { class: "prx-de-note", "data-prx-part": "notes" }, `${T.noDraw} `, ctx.num(CONFIG.draws.many, formatCount(CONFIG.draws.many)), ".");
      const drawsPanel = h("section", { class: "prx-de-panel prx-de-draws", "aria-label": T.runHeading, "data-prx-part": "chart" },
        drawsSummary, noDraws, drawsCharts, mcCaption);

      ctx.charts.append(h("div", { class: "prx-de-grid prx-de-top" }, matrixPanel, h("div", { class: "prx-de-side" }, resultsPanel, lawBox)), drawsPanel);
      ctx.caption.replaceChildren(h("span", {}, `${T.note} (`), captionNode(ctx, "teaching-posterior"), ").");

      // Linked figures

      function drawMatrix(rep, rel, wrong) {
        const { n, g, law } = rep;
        const ids = law.ids;
        const e0 = law.E.e[0];
        const avail = matrixSlot.clientWidth || Math.min(ctx.width(), MX.maxCell * n + MX.marginLeft + MX.marginRight);
        const cell = Math.max(MX.minCell, Math.min(MX.maxCell, Math.floor((avail - MX.marginLeft - MX.marginRight) / n)));
        const width = MX.marginLeft + MX.marginRight + n * cell;
        const height = MX.marginTop + MX.marginBottom + n * cell;
        matrixSlot.style.maxWidth = `${width}px`;
        const cells = [];
        const diag = [];
        const every = [];
        for (let i = 0; i < n; i += 1) {
          for (let j = 0; j < n; j += 1) {
            const d = { i, j, row: ids[i], col: ids[j] };
            if (i === j) Object.assign(d, { diagonal: true, grade: g[i] });
            else Object.assign(d, { rel: rel[i][j], e: e0[i][j], wrong: wrong.has(`${i},${j}`) });
            (i === j ? diag : cells).push(d);
            every.push(d);
          }
        }
        const pairs = [];
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            const [a, b] = rel[i][j] === -1 ? [j, i] : [i, j];
            pairs.push({ a, b, rel: rel[i][j], e: rel[i][j] === 0 ? null : e0[a][b], wrong: wrong.has(`${a},${b}`) });
          }
        }
        const G = Math.max(...g);
        const relWords = (d) => (d.rel === 1 ? `the report states ${d.row} above ${d.col}, wrong with probability ${errText(d.e, law.key)}${d.wrong ? "; wrong in this draw" : ""}`
          : d.rel === -1 ? `the report states ${d.col} above ${d.row}`
            : `the report withholds this pair (${d.row} and ${d.col} share grade ${g[d.i]})`);
        const columns = [
          { label: "Pair", value: (r) => (r.rel === 0 ? `${ids[r.a]} and ${ids[r.b]}` : `${ids[r.a]} above ${ids[r.b]}`) },
          { label: "The report", value: (r) => (r.rel === 0 ? "withholds the pair" : "states this direction") },
        ];
        columns.push({ label: "Error of the stated direction", value: (r) => r.e, format: (v) => (v === null ? "none: withheld" : errText(v, law.key)) });
        columns.push({ label: "Wrong in this draw", value: (r) => (r.rel === 0 ? "withheld" : r.wrong ? "yes" : "no") });
        plot(matrixSlot, {
          alt: T.matrixAlt,
          table: { caption: T.matrixTable, columns, rows: pairs },
          width, height,
          marginTop: MX.marginTop, marginLeft: MX.marginLeft, marginRight: MX.marginRight, marginBottom: MX.marginBottom,
          x: { domain: ids.slice(), padding: 0, axis: "top", label: null, tickSize: 0 },
          y: { domain: ids.slice(), padding: 0, label: null, tickSize: 0 },
          color: { type: "identity" },
          marks: (c, P) => {
            const fillOf = (d) => (d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld);
            const filled = cells.map((d) => ({ ...d, fill: fillOf(d), ink: labelOn(fillOf(d), c) }));
            const above = filled.filter((d) => d.rel === 1);
            const below = filled.filter((d) => d.rel === -1);
            const withheld = filled.filter((d) => d.rel === 0);
            const wrongCells = filled.filter((d) => d.wrong);
            const colors = gradeColors(G, c);
            const dots = diag.map((d) => ({ ...d, fill: colors[d.grade - 1], ink: labelOn(colors[d.grade - 1], c) }));
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({ id: hatchId, patternUnits: "userSpaceOnUse", width: MX.hatchSpacing, height: MX.hatchSpacing, patternTransform: "rotate(45)" })) pat.setAttribute(k, String(v));
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: MX.hatchSpacing, stroke: c.hatch, "stroke-width": MX.hatchWidth })) line.setAttribute(k, String(v));
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            const symbolSize = Math.round(cell * MX.symbolShare);
            return [
              P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, inset: MX.inset }),
              P.cell(filled, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: MX.inset }),
              hatch,
              P.cell(withheld, { x: "col", y: "row", fill: `url(#${hatchId})`, inset: MX.inset }),
              P.text(below, { x: "col", y: "row", text: () => "<", fill: "ink", fontWeight: MX.labelWeight, fontSize: symbolSize }),
              numText(above, { x: "col", y: "row", value: "e", format: (v) => (law.key === "finite" ? exact(v) : formatProb(v, { bounds: "symbols" })), fill: "ink", stroke: "fill", strokeWidth: MX.labelHalo, paintOrder: "stroke" }),
              wrongCells.length ? P.cell(wrongCells, { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: MX.wrongWidth, inset: MX.wrongInset }) : null,
              wrongCells.length ? P.text(wrongCells, { x: "col", y: "row", text: () => "✕", dx: cell * MX.crossDx, dy: -cell * MX.crossDy, fill: c.plotFg, stroke: c.plotBg, strokeWidth: MX.labelHalo, paintOrder: "stroke", fontWeight: MX.labelWeight, fontSize: Math.round(cell * MX.crossShare) }) : null,
              P.dot(dots, { x: "col", y: "row", r: cell * MX.dotShare, fill: "fill", stroke: c.plotBg }),
              numText(dots, { x: "col", y: "row", value: "grade", format: (v) => formatCount(v), fill: "ink" }),
            ];
          },
          keyboard: {
            data: every, x: "col", y: "row", key: (d) => `${d.row}${d.col}`, sort: false, columns: n,
            label: T.matrixAlt,
            title: (d) => (d.diagonal ? `Row ${d.row}, column ${d.col}: the same ${law.unitWord}, in grade ${d.grade}.` : `Row ${d.row}, column ${d.col}: ${relWords(d)}.`),
          },
        });
        const keys = [
          h("span", { class: "prx-de-legend-title", text: T.relationTitle }),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch", style: { background: "var(--prx-rel-above)" } }), T.relAbove),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-hatch" }), T.relWithheld),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch", style: { background: "var(--prx-rel-below)" } }), T.relBelow),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-dot" }), T.gradeKey),
        ];
        keys.push(h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-cross", text: "✕" }), T.wrongKey));
        matrixLegend.replaceChildren(...keys);
      }

      // ------------------------------------------------------------------------------------- this draw


      function drawLawTable(rep, last, tauV) {
        const joint = rep.law.joint;
        const byOrder = joint.states.map((st) => realizedWrong(rep.g, st));
        lawHeading.textContent = joint === L3 ? T.lawTableHeading : "Orders and their coupling probabilities";
        const rows = joint.orders.map((o, s) => {
          const lastCell = last === s ? "this draw" : "";
          return h("tr", { class: last === s ? "prx-de-last" : null },
            h("th", { scope: "row", text: o.split("").join(" > ") }),
            h("td", {}, ctx.num(joint.probs[s], exact(joint.probs[s]))),
            h("td", {}, ro(`order${s}.wrong`, byOrder[s].D[0], formatCount(byOrder[s].D[0]))),
            h("td", { class: "prx-de-lastcell", text: lastCell }));
        });
        lawTableSlot.replaceChildren(h("table", { class: "prx-de-table" },
          h("caption", { text: T.lawTableCaption }),
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.orderCol }), h("th", { scope: "col", text: T.probCol }), h("th", { scope: "col", text: T.wrongCol }), h("th", { scope: "col", text: T.lastDrawCol }))),
          h("tbody", {}, ...rows)));
        // E = Σ (probability of the order) × (wrong stated directions in it)
        const ev = evaluateReport(rep.g, rep.law.E, { tau: tauV });
        const f = formulaNums();
        const terms = joint.probs.map((p, s) => `${f.num(p, exact(p))}\\cdot${f.num(byOrder[s].D[0], formatCount(byOrder[s].D[0]))}`);
        // Two probability-times-count terms per line keep every term and the result visible on a phone.
        const lines = [];
        for (let i = 0; i < terms.length; i += 2) lines.push(`${i ? "&\\quad+ " : "E &= "}${terms.slice(i, i + 2).join(" + ")}`);
        lines.push(`&= \\;${f.num(ev.Ew, exact(ev.Ew))}`);
        renderTex(lawFormula, `\\begin{aligned}${lines.join(" \\\\ ")}\\end{aligned}`, { display: true, nums: f.raws });
        pairErrors.replaceChildren("Wrong-direction probabilities stay fixed: ", ...[[0, 1], [0, 2], [1, 2]].flatMap(([i, j], k) => [k ? "; " : "", `${joint.ids[i]} above ${joint.ids[j]}: `, ro(`pairError.${joint.ids[i]}${joint.ids[j]}`, rep.law.E.e[0][i][j], exact(rep.law.E.e[0][i][j]))]), ". The joint event can change even though these pair probabilities do not.");
      }

      // ------------------------------------------------------------------------------------- draws



      // ------------------------------------------------------------------------------------- read-outs and bound

      function tile(name, ...value) {
        return h("div", { class: "prx-de-tile" }, h("span", { class: "prx-de-tile-name", text: name }), h("span", { class: "prx-de-tile-value" }, ...value));
      }

      function drawTiles(rep, ev, tauV, event, S) {
        const lawKey = rep.law.key;
        const EN = ev.EoverN[0];
        const enValue = EN === null
          ? [ro("EoverN", null, formatEoverN(null)), h("span", { class: "prx-de-tile-note" }, " (N/M = ", ctx.num(ev.s, formatCount(ev.s)), ": ", T.naNote, ")")]
          : [ro("EoverN", EN, enText(EN, lawKey))];
        tiles.replaceChildren(
          tile(T.tileN, ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", ev.M, formatCount(ev.M))),
          tile(T.tileE, ro("E", ev.Ew, eText(ev.Ew, lawKey))),
          tile(T.tileEN, ...enValue),
          tile("Every stated direction right", ...(event ? [ro("allRight", event.pNone, lawKey === "finite" ? exact(event.pNone) : formatProb(event.pNone)), h("span", { class: "prx-de-event-note" }, ev.N === 0 ? "vacuous: no directions stated" : lawKey === "finite" ? "exact finite-law probability" : "Monte Carlo estimate; independent normal latent values")] : [h("span", { class: "prx-de-event-note" }, "Draw to estimate; independent normal latent values")])),
          ...(lawKey === "finite" ? [tile("Union lower bound", ro("unionLower", event.unionBound, exact(event.unionBound)))] : []),
          tile(T.tileTau, ro("tau", tauV, formatSetting(tauV))),
        );
        if (ev.N === 0) eventNote.replaceChildren("The all-right event has probability ", ctx.num(event.pNone, formatProb(event.pNone)), " because it makes no assertions. E/N remains ", ctx.num(null, formatEoverN(null)), ".");
        else if (lawKey === "finite") eventNote.replaceChildren("E/N averages errors across stated pairs. The all-right event requires every statement to hold together; its union lower bound is max(", ctx.num(0, formatCount(0)), ", ", ctx.num(1, formatCount(1)), " − E). The coupling control changes this joint event while keeping the pair probabilities fixed.");
        else eventNote.replaceChildren(...(S ? ["All-right probability is estimated from ", ctx.num(S, formatCount(S)), " draws of independent normal latent values; it is not an exact normal-law calculation. The finite-law mode gives an exact event probability and union bound."] : ["Draw independent normal latent values to estimate the all-right event. The finite-law mode gives an exact event probability and union bound."]));
        evalCaption.replaceChildren("(", captionNode(ctx, "fixed-report"), ")");
      }

      function drawBound(rep, ev, opt, tauV) {
        const lawKey = rep.law.key;
        const fam = familyOf(lawKey, ctx.state.cap);
        const inFamily = fam.kind === "all" || disclosure(rep.g).G <= fam.G;
        const isOpt = inFamily && !opt.empty && opt.grades.some((x) => same(Array.from(x), rep.g));
        const applies = isOpt && opt.containsAllWithheld === true;
        const sa = statedAbove(rep.g, rep.law.E, { tau: tauV });
        const tauN = tauV * ev.N;
        const EN = ev.EoverN[0];
        const lines = [];
        const holds = ev.risk <= tauV + CONFIG.riskTolerance;
        lines.push(h("p", { "data-prx-diagnostic": holds ? "holds" : "fails" }, "Risk R = ", ro("diagnosticRisk", ev.risk, lawKey === "finite" ? exact(ev.risk) : formatRisk(ev.risk)), holds ? " ≤ τ = " : " > τ = ", tauNode(tauV), "; equivalently E = ", ro("diagnosticE", ev.Ew, eText(ev.Ew, lawKey)), holds ? " ≤ τN = " : " > τN = ", ro("diagnosticTauN", tauN, tauNText(tauN, lawKey)), "."));
        if (applies) {
          lines.push(h("p", { class: "prx-de-badge", "data-prx-bound": "applies" }, h("strong", {}, `${T.boundYes} `), tagNode(ctx, opt), T.boundYesEnd));
          if (ev.N === 0) {
            lines.push(h("p", {}, "Here nothing is stated: E = ", ro("boundE", ev.Ew, eText(ev.Ew, lawKey)), " and τN = ", ro("tauN", tauN, tauNText(tauN, lawKey)), ", and the share E/N is ", ro("boundEN", null, formatEoverN(null)), "."));
          } else {
            lines.push(h("p", {}, "Here E = ", ro("boundE", ev.Ew, eText(ev.Ew, lawKey)), " ≤ τN = ", tauNode(tauV), " × ", ctx.num(ev.N, formatCount(ev.N)), " = ", ro("tauN", tauN, tauNText(tauN, lawKey)),
              ", so E/N = ", ro("boundEN", EN, enText(EN, lawKey)), " ≤ τ = ", tauNode(tauV), "."));
            const over = sa.count > 0
              ? [" The largest error among this report's stated directions is ", ro("maxStated", sa.max, errText(sa.max, lawKey)), ", above τ."]
              : [" The largest error among this report's stated directions is ", ro("maxStated", sa.max, errText(sa.max, lawKey)), "."];
            lines.push(h("p", { class: "prx-de-caution" }, T.boundAverage, ...over));
          }
        } else {
          const why = !inFamily ? T.notInFamily : !opt.empty && !opt.containsAllWithheld ? T.noAllWithheld : T.notOptimum;
          lines.push(h("p", { class: "prx-de-badge prx-de-badge-no", "data-prx-bound": "not-shown" }, h("strong", {}, `${T.boundNo} `),
            ...(EN === null ? ["E/N is ", ro("boundEN", null, formatEoverN(null)), " (nothing is stated); τ = ", tauNode(tauV), "."]
              : ["E/N = ", ro("boundEN", EN, enText(EN, lawKey)), " and τ = ", tauNode(tauV), "."])));
          lines.push(h("p", {}, why));
          if (ev.N > 0) {
            const holds = ev.risk <= tauV + CONFIG.riskTolerance;
            const r = ro("ownRisk", ev.risk, lawKey === "finite" ? exact(ev.risk) : formatRisk(ev.risk));
            lines.push(h("p", { class: "prx-de-own", "data-prx-own": holds ? "holds" : "fails" },
              ...(holds ? [`${T.holdsOwn} `, r, ` ${T.holdsOwnEnd}`] : [`${T.failsOwn} `, r, ` ${T.failsOwnEnd}`])));
          }
        }
        bound.replaceChildren(...lines);
        // the best report of the family shown, with its label (exactOptimum)
        if (opt.empty) {
          best.replaceChildren(h("p", {}, "The family shown is empty."));
          bestBtn.root.hidden = true;
          return { applies, isOpt };
        }
        const optima = opt.grades.map((x) => Array.from(x));
        const items = optima.flatMap((x, k) => [k ? " or " : "", blocksText(x, rep.law.ids), " (", ro(`optimum${k}`, x, formatGrades(x)), ")"]);
        const label = ["This is the ", labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) label.push("; ", ctx.num(opt.tieCount, formatCount(opt.tieCount)), " reports share the smallest risk; the read-outs list them");
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        best.replaceChildren(
          h("p", {}, h("strong", {}, optima.length > 1 ? "Best reports in the family shown at this τ: " : "Best report in the family shown at this τ: "), ...items, "."),
          h("p", { class: "prx-de-label" }, ...label));
        bestBtn.root.hidden = isOpt;
        return { applies, isOpt };
      }

      function drawDraws(rep, ev, counts, state) {
        const S = counts.length;
        const N = ev.N;
        noDraws.hidden = S > 0;
        drawsCharts.hidden = S === 0;
        if (S === 0) {
          drawsSummary.replaceChildren();
          mcCaption.replaceChildren();
          exposeResult(ctx, null, "mc");
          return null;
        }
        const mean = summaryStats(counts).mean;
        const share = N === 0 ? null : mean / N;
        drawHistogram(ctx, histSlot, counts, N, { zeroEvent: true });
        const zeroCount = counts.filter(x => x === 0).length;
        const pZero = summaryStats(counts.map(x => x === 0 ? 1 : 0)).mean;
        histEvent.replaceChildren("The zero bin is the event “every stated direction right”: ", ro("zeroDraws", zeroCount, formatCount(zeroCount)), " of ", ctx.num(S, formatCount(S)), " draws. Its Monte Carlo frequency is ", ro("zeroFrequency", pZero, formatProb(pZero)), ".", N === 0 ? " With no directions stated, this event is vacuous." : "");
        drawRunningAverage(ctx, runSlot, counts, ev.Ew);
        const lawKey = rep.law.key;
        drawsSummary.replaceChildren(
          "Over ", ro("S", S, formatCount(S)), S === 1 ? " draw" : " draws", ": on average ", ro("mean", mean, formatDecimal(mean, { digits: CONFIG.digits.mean })),
          " wrong stated directions per draw (share of the stated directions ", ro("meanShare", share, formatShare(share)),
          "), against E = ", ctx.num(ev.Ew, eText(ev.Ew, lawKey)), " (E/N = ", ctx.num(ev.EoverN[0], enText(ev.EoverN[0], lawKey)), ").");
        const mc = { label: "monte-carlo", S, seed: state.seed, mean };
        exposeResult(ctx, mc, "mc");
        mcCaption.replaceChildren("(", captionNode(ctx, "monte-carlo", mc), ". ", T.drawsLead, ")");
        return { mean, share };
      }


      // ------------------------------------------------------------------------------------- render

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const rep = reportOf(state);
            const lawKey = rep.law.key;
            // controls
            lawRadio.set(lawKey);
            for (const key of CONFIG.laws) {
              const on = key === lawKey;
              reportMenus[key].root.hidden = !on;
              gradeBoxes[key].box.hidden = !on;
            }
            const named = CONFIG.named[lawKey].find((x) => same(Array.from(x), rep.g));
            reportMenus[lawKey].set(named ? named.join(",") : "custom");
            gradeBoxes[lawKey].selects.forEach((s, i) => s.set(rep.g[i]));
            familyRadio.root.hidden = lawKey !== "six";
            familyRadio.set(state.cap);
            tau.set(state.tau);
            coupling.set(state.coupling);
            seed.set(state.seed);
            const full = state.draws >= CONFIG.draws.max;
            btnOne.setDisabled(full);
            btnMany.setDisabled(full);
            btnReset.setDisabled(state.draws === 0);
            seed.setDisabled(false);
            if (full) drawNote.replaceChildren(`${T.drawsFull} `, ctx.num(CONFIG.draws.max, formatCount(CONFIG.draws.max)), ` ${T.drawsFullEnd}`);
            drawNote.hidden = !full;

            // engine
            const ev = evaluateReport(rep.g, rep.law.E, { tau: state.tau });
            exposeResult(ctx, ev, "evaluation");
            const opt = optimumOf(lawKey, state.cap, state.tau, state.coupling);
            const S = state.draws;
            const counts = countsOf(lawKey, state.seed, S, rep.g, state.coupling);
            // With N=0 the event is law-independent; one state suffices for that structural identity.
            const event = lawKey === "finite" ? wrongCountDistribution(rep.g, rep.law.joint.states, rep.law.joint.probs)
              : ev.N === 0 ? wrongCountDistribution(rep.g, [rep.law.means.map(v => [v])], [1])
                : S > 0 ? { pNone: summaryStats(counts.map(x => x === 0 ? 1 : 0)).mean } : null;
            let rw = null;
            let last = null;
            if (S > 0) {
              const draws = drawsOf(lawKey, state.seed, S, state.coupling);
              last = draws[S - 1];
              rw = realizedWrong(rep.g, lawKey === "six" ? last : rep.law.joint.states[last]);
            }
            const wrong = new Set((rw?.pairs[0] ?? []).map((p) => `${p.i},${p.j}`));

            drawMatrix(rep, relations(rep.g), wrong);
            drawCurrentDraw(ctx, { line: drawLine, strip: stripSlot, key: stripKey }, rep, { ...state, draws: S }, rw, last, { theta: lawKey === "six" && S > 0 ? last : null });
            drawTiles(rep, ev, state.tau, event, S);
            const b = drawBound(rep, ev, opt, state.tau);
            lawBox.hidden = lawKey !== "finite";
            if (lawKey === "finite") drawLawTable(rep, S > 0 ? last : null, state.tau);
            const d = drawDraws(rep, ev, counts, { ...state, draws: S });

            // the read-out line
            const at = lawKey === "six" ? "Six sites" : "Three-unit law";
            const parts = [`${at}, report ${blocksText(rep.g, rep.law.ids)} (`, gradeNum(rep.g, "grades"), "), τ = ", tauNode(state.tau), ": states ",
              ...(ev.N === 0 ? ["no direction"] : [ctx.num(ev.N, formatCount(ev.N)), ev.N === 1 ? " direction" : " directions"]), "; E = ", ctx.num(ev.Ew, eText(ev.Ew, lawKey)),
              ", E/N = ", ctx.num(ev.EoverN[0], enText(ev.EoverN[0], lawKey))];
            if (event) parts.push(lawKey === "finite" ? "; exact all-right probability " : ev.N === 0 ? "; vacuous all-right probability " : "; Monte Carlo all-right estimate ", ctx.num(event.pNone, lawKey === "finite" ? exact(event.pNone) : formatProb(event.pNone)));
            parts.push(b.applies ? "; E ≤ τN applies." : "; E/N and τ side by side, not a bound.");
            if (d) parts.push(" After ", ctx.num(S, formatCount(S)), S === 1 ? " draw" : " draws", ", the average is ", ctx.num(d.mean, formatDecimal(d.mean, { digits: CONFIG.digits.mean })), " wrong per draw.");
            ctx.readout.set(parts);

          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
