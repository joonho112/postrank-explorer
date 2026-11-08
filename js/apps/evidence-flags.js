// R-02 linked flag-rule views. Original widget is read-only.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatProb, formatRisk, formatSetting, formatShare } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, drawLeague, errorArray, evaluateReport, evidenceFlags, league30, normalPosterior, pairCount, relations,
  scoreOrder, statedAbove, statedAgainst, summaryStats,
} from "../pr-core.js";

export const FLAGS_CSS = `
/*
 * postrank Explorer · evidence-flags (catalog R-02; js/widgets/evidence-flags.js)
 *
 * Layout: the controls, the live result, then the view's panels and detailed evaluation.
 * Panels have two columns when space permits and stack in reading order on a phone. Legends sit on the plot panel (prx-light-panel) so data colors keep their meaning in
 * every theme. Tokens only; nothing here is wider than its container at 375 px.
 */

.prx-ef .prx-ef-inline {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
  margin: 0 0 0.25rem;
}

.prx-ef .prx-ef-inline > legend {
  flex: 1 1 100%;
}

.prx-ef .prx-ef-units {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  flex: 1 1 100%;
  min-width: 0;
}

.prx-ef .prx-ef-unit {
  flex: 1 1 14rem;
  min-width: 0;
  margin: 0;
  padding: 0.25rem 0.75rem 0.5rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}

.prx-ef .prx-ef-unit > legend {
  width: auto;
  margin: 0;
  padding: 0 0.25rem;
  font-size: 1em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

@media (max-width: 30em) {
  .prx-ef .prx-ef-unit {
    flex: 1 1 100%;
  }
}

/* --- panels --- */
.prx-ef .prx-ef-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  min-width: 0;
  margin: 0 0 1rem;
}

.prx-ef .prx-ef-panel {
  min-width: 0;
}

.prx-ef .prx-ef-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-ef .prx-ef-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-ef .prx-ef-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-ef .prx-ef-tex {
  margin: 0.5rem 0 0;
  max-width: 100%;
  overflow-x: auto;
}

.prx-ef .prx-ef-result {
  margin: 0 0 0.5rem;
}

.prx-ef .prx-ef-chip {
  display: inline-block;
  min-width: 1.4em;
  padding: 0 0.3em;
  border-radius: 3px;
  text-align: center;
  font-weight: 600;
}

/* --- read-outs --- */
.prx-ef .prx-ef-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.prx-ef .prx-ef-tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  min-width: 0;
}

.prx-ef .prx-ef-tile-name {
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}

.prx-ef .prx-ef-tile-value {
  font-weight: 600;
}

.prx-ef .prx-ef-lines > p {
  margin: 0.25rem 0;
}

.prx-ef .prx-ef-scope {
  margin: 0.5rem 0 0;
  font-style: italic;
}

/* --- legends (on the plot panel) --- */
.prx-ef .prx-ef-legend {
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

.prx-ef .prx-ef-legend-title {
  flex: 1 1 100%;
  font-weight: 600;
}

.prx-ef .prx-ef-key {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.prx-ef .prx-ef-swatch {
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}

.prx-ef .prx-ef-swatch-hatch {
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 4px);
}

.prx-ef .prx-ef-swatch-outline {
  background: var(--prx-plot-bg);
  border: 2px solid var(--prx-plot-fg);
}
`;

export const CONFIG = Object.freeze({
  name: "evidence-flags",
  label: "Flags from standardized evidence, read as a three-grade report",
  title: "Flags from standardized evidence: which directions do they state?",
  className: "prx-ef",
  views: Object.freeze(["pair", "league"]),
  est: Object.freeze({ min: -0.5, max: 0.5, step: 0.01 }),
  se: Object.freeze({ min: 0.02, max: 0.3, step: 0.01 }),
  setting: Object.freeze({ estA: 0.2, seA: 0.05, estB: 0.3, seB: 0.2 }),
  pairRef: 0,
  crits: Object.freeze([1.645, 1.96, 2.576]),
  crit: 1.96,
  priors: Object.freeze(["flat", "teaching"]),
  prior: "flat",
  teaching: Object.freeze({ priorMean: 0, priorSd: 0.15 }),
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  // a stated direction with error above one half is more likely wrong than right (statedAbove at τ = 1/2)
  half: 0.5,
  digits: Object.freeze({ z: 2, mean: 3, est: 3, ref: 3 }),
  units: Object.freeze(["A", "B"]),
  pair: Object.freeze({
    rowHeight: 34, marginTop: 26, marginBottom: 34, marginLeft: 28, marginRight: 16, pad: 0.08, dot: 5, bar: 3,
    zPad: 1.15, zMin: 3, yPadding: 0.3, labelDy: -12, zoneDy: 12, refDash: "5 3", cutDash: "2 2",
  }),
  league: Object.freeze({
    rowHeight: 14, marginTop: 24, marginBottom: 34, marginLeft: 40, marginRight: 8, pad: 0.04, chip: 0.12, chipGap: 0.03, yPadding: 0.1, chipInset: 0.5,
    tick: 9, bar: 1.5, dash: "5 3", ticks: Object.freeze([-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]),
  }),
  matrix: Object.freeze({ marginTop: 6, marginLeft: 6, marginRight: 6, marginBottom: 6, minCell: 8, maxCell: 18, inset: 0.25, outline: 1.6, hatchSpacing: 4, hatchWidth: 1, labelCell: 14, labelMargin: 30, labelFont: 9, labelRotate: -90 }),
  text: Object.freeze({
    viewLegend: "View",
    // {slots} are data-num nodes
    viewWords: Object.freeze({ pair: Object.freeze(["Two units, reference ", "{zero}"]), league: Object.freeze(["The league, reference the mean of its estimates"]) }),
    critLegend: "Cutoff",
    priorLegend: "Posterior used to price the stated directions",
    priorWords: Object.freeze({ flat: Object.freeze(["Flat prior (no shrinkage)"]), teaching: Object.freeze(["Teaching posterior (prior mean ", "{priorMean}", ", prior SD ", "{priorSd}", ")"]) }),
    tauLabel: "Withholding cost τ",
    tauHint: "τ prices each withheld pair in the risk; it does not change the flags.",
    unit: Object.freeze({ A: "Unit A", B: "Unit B" }),
    estLabel: "Estimate",
    seLabel: "SE",
    flagWords: Object.freeze({ 1: "flagged above", 2: "not flagged", 3: "flagged below" }),
    flagTitle: Object.freeze({ 1: "Flagged above", 2: "Not flagged", 3: "Flagged below" }),
    // pair view
    estHeading: "On the estimate scale",
    estNote: "Dot: the estimate. Bar: estimate ± cutoff × SE. A unit is flagged above when its whole bar lies above the reference, and flagged below when it lies below.",
    zHeading: "In standard errors from the reference",
    zNote: "z = (estimate − reference)/SE. The shaded zones lie beyond the cutoffs; a unit in a zone is flagged.",
    resultHeading: "The flag report",
    errorHeading: "How often is the stated direction wrong?",
    reference: "reference",
    cutoff: "cutoff",
    zoneAbove: "flagged above",
    zoneBelow: "flagged below",
    estAxis: "estimate",
    zAxis: "z",
    estAlt: "The estimates of units A and B on one axis, with the reference marked.",
    estTable: "The two units: estimate, SE and the bar estimate ± cutoff × SE",
    zAlt: "The z values of units A and B on the z axis, with the two cutoffs and the zones beyond them.",
    zTable: "The two units: z and flag",
    statesWord: "The report states",
    aboveWord: "above",
    withholds: "The report withholds the pair: both units are in the same flag group, which is not a claim that they are equal.",
    noStatement: "The report states no direction, so no stated direction can be wrong; its risk is the price of the withheld pair.",
    // league view
    rowsHeading: "Thirty units, largest estimate first",
    rowsNote: "Vermillion tick: the estimate. Bar: estimate ± cutoff × SE. Dashed line: the reference, the mean of the thirty estimates, treated as fixed. The chip on the right carries the unit's grade. Gray band: a unit the report places below some unit with a smaller estimate.",
    rowsAlt: "Thirty league units sorted by estimate, each with its estimate, a bar of plus or minus the cutoff times its SE, the reference line and its flag grade.",
    rowsTable: "The thirty units: estimate, SE, z, flag and grade",
    matrixHeading: "What the report states for each pair",
    matrixNote: "Rows and columns follow the order in the estimate panel, largest estimate first (named on a wide screen), so above the diagonal the row unit has the larger estimate. A stated direction that runs against the estimates shows there as a stated-below cell; it and its mirror cell below the diagonal are outlined.",
    matrixAlt: "Thirty-by-thirty relation matrix of the flag report: each cell says whether the report states the row unit above, below or neither relative to the column unit.",
    matrixTable: "The stated directions that run against the estimates",
    relationTitle: "Row unit relative to column unit",
    relAbove: "stated above",
    relWithheld: "withheld (not a claim of equality)",
    relBelow: "stated below",
    outlineLegend: "outline: the stated direction runs against the estimates",
    gradeChip: "grade",
    note: "The two-unit example draws on chapter 2 of the postrank theory book. The league uses the shown simulation seed and independent normal posteriors specified for the example.",
    scope: "The loss uses the directions implied by the flags and the cost of withholding.",
    seedWords: "seed",
  }),
});

const SVGNS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------------------------- the league

const LEAGUE = league30();
const DRAW = drawLeague(LEAGUE_SEED);
const IDS = LEAGUE.ids;
const EST = Array.from(DRAW.estimate);
const SE = Array.from(LEAGUE.se);
const N_UNITS = IDS.length;
const M_LEAGUE = pairCount(N_UNITS);
const REF = summaryStats(EST).mean;
// largest estimate first (the estimates of the frozen draw are distinct)
const ORDER = scoreOrder(EST, { direction: "descending" }).order;
const POSITION = new Map(ORDER.map((i, k) => [i, k]));

const errorCache = new Map();
/** The league error array under a posterior ("flat" or "teaching"), computed once. */
function leagueErrors(prior) {
  if (!errorCache.has(prior)) {
    const post = posteriorOf(EST, SE, prior);
    errorCache.set(prior, errorArray(post.mean, post.sd, { ids: IDS.slice(), criteria: ["theta"] }));
  }
  return errorCache.get(prior);
}

/** Means and SDs of the chosen posterior: the estimates themselves under the flat prior. */
function posteriorOf(est, se, prior) {
  if (prior === "teaching") return normalPosterior(est, se, { priorMean: CONFIG.teaching.priorMean, priorSd: CONFIG.teaching.priorSd });
  return normalPosterior(est, se, { priorMean: 0, priorSd: Infinity });
}

/** The crit key: one of the three cutoffs (a number goes to the nearest). */
function parseCrit(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return CONFIG.crits.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best));
}

// ---------------------------------------------------------------------------------------------- the two units

/** The pair at one state: flags, the stated direction, its error, the evaluation at τ, the directions against the estimates. */
function pairModel(s) {
  const est = [s.estA, s.estB];
  const se = [s.seA, s.seB];
  const flags = evidenceFlags(est, se, { ref: CONFIG.pairRef, crit: s.crit });
  const post = posteriorOf(est, se, s.prior);
  const E = errorArray(post.mean, post.sd, { ids: CONFIG.units.slice(), criteria: ["theta"] });
  const grade = Array.from(flags.grade);
  const ev = evaluateReport(grade, E, { tau: s.tau });
  const against = statedAgainst(grade, est, { direction: "descending" });
  const stated = grade[0] !== grade[1];
  const above = grade[0] < grade[1] ? 0 : 1;
  const below = 1 - above;
  return {
    est, se, flags, grade, post, E, ev, against, stated, above, below,
    error: stated ? E.e[0][above][below] : null,
  };
}

/** The league at one state. */
function leagueModel(s) {
  const flags = evidenceFlags(EST, SE, { ref: REF, crit: s.crit });
  const grade = Array.from(flags.grade);
  const E = leagueErrors(s.prior);
  const ev = evaluateReport(grade, E, { tau: s.tau });
  const stated = statedAbove(grade, E, { tau: s.tau });
  const overHalf = statedAbove(grade, E, { tau: CONFIG.half });
  const against = statedAgainst(grade, EST, { direction: "descending" });
  const counts = [1, 2, 3].map((l) => flags.labels.filter((x) => x === l).length);
  const allW = evaluateReport(IDS.map(() => 1), E, { tau: s.tau });
  return { flags, grade, E, ev, allW, stated, overHalf, against, counts, rel: relations(grade) };
}

// ---------------------------------------------------------------------------------------------- widget

export function mountFlags(el, spec = {}, mode = "pair") {
  const isPairView = mode === "pair";
  return createWidget(el, spec, {
    name: isPairView ? CONFIG.name : "flags-in-the-league",
    css: FLAGS_CSS,
    layout: "result-first",
    math: true,
    label: CONFIG.label,
    title: mode === "league" ? "Which directions do the flags state across the league?" : CONFIG.title,
    className: CONFIG.className,
    keys: {
      ...(isPairView ? {
      estA: { type: "number", ...CONFIG.est, value: CONFIG.setting.estA },
      seA: { type: "number", ...CONFIG.se, value: CONFIG.setting.seA },
      estB: { type: "number", ...CONFIG.est, value: CONFIG.setting.estB },
      seB: { type: "number", ...CONFIG.se, value: CONFIG.setting.seB },
      } : {}),
      crit: { type: "custom", value: CONFIG.crit, parse: (v) => parseCrit(v) },
      prior: { type: "choice", values: [...CONFIG.priors], value: isPairView ? CONFIG.prior : "teaching" },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;
      const hatchId = uid("prx-ef-hatch");
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const fill = (parts, slots) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slots[m[1]]() : p; });
      const wordSlots = {
        zero: () => ctx.num(0, formatCount(0)), one: () => ctx.num(1, formatCount(1)),
        priorMean: () => ctx.num(CONFIG.teaching.priorMean, formatCount(CONFIG.teaching.priorMean)),
        priorSd: () => ctx.num(CONFIG.teaching.priorSd, formatSetting(CONFIG.teaching.priorSd)),
      };
      const setting = (v, name) => (name ? ro(name, v, formatSetting(v)) : ctx.num(v, formatSetting(v)));
      const zText = (z) => formatDecimal(z, { digits: CONFIG.digits.z });
      const tile = (name, value) => h("div", { class: "prx-ef-tile" }, h("span", { class: "prx-ef-tile-name", text: name }), h("span", { class: "prx-ef-tile-value" }, ...value));
      const chip = (grade, G, c) => {
        const fillColor = gradeColors(G, c)[grade - 1];
        return h("span", { class: "prx-ef-chip", style: { background: fillColor, color: labelOn(fillColor, c) } }, ctx.num(grade, formatCount(grade)));
      };

      // --- controls: view, cutoff, the two units, posterior, τ
      const crit = ctx.radioGroup({
        legend: T.critLegend, name: "crit", className: "prx-ef-inline",
        options: CONFIG.crits.map((c) => ({ value: c, label: [ctx.num(c, formatDecimal(c, { digits: c === 1.96 ? 2 : 3 }))] })), value: ctx.state.crit,
        onChange: (v) => ctx.set({ crit: v }),
      });
      const sliders = [];
      const unitBoxes = (isPairView ? CONFIG.units : []).map((u) => {
        const ek = `est${u}`;
        const sk = `se${u}`;
        const e = ctx.slider({ label: T.estLabel, ...CONFIG.est, value: ctx.state[ek], name: ek, onInput: (v) => ctx.set({ [ek]: v }) });
        const s = ctx.slider({ label: T.seLabel, ...CONFIG.se, value: ctx.state[sk], name: sk, onInput: (v) => ctx.set({ [sk]: v }) });
        e.input.setAttribute("aria-label", `${T.estLabel} of unit ${u}`);
        s.input.setAttribute("aria-label", `${T.seLabel} of unit ${u}`);
        sliders.push([ek, e], [sk, s]);
        return h("fieldset", { class: "prx-control prx-ef-unit" }, h("legend", { text: T.unit[u] }), e.root, u === "B" ? ctx.primaryControl(s.root) : s.root);
      });
      const unitRow = h("div", { class: "prx-ef-units" }, ...unitBoxes);
      const prior = ctx.radioGroup({
        legend: T.priorLegend, name: "prior", className: "prx-ef-inline",
        options: CONFIG.priors.map((p) => ({ value: p, label: fill(T.priorWords[p], wordSlots) })), value: ctx.state.prior,
        onChange: (v) => ctx.set({ prior: v }),
      });
      const tau = ctx.slider({
        label: T.tauLabel, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.tauHint, onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.controls.append(isPairView ? crit.root : ctx.primaryControl(crit.root), ...(isPairView ? [unitRow] : []), prior.root, tau.root);

      // --- pair view
      const estSlot = h("div", { class: "prx-ef-chart" });
      const estNote = h("p", { class: "prx-ef-note", "data-prx-part": "notes" });
      const estBox = h("section", { class: "prx-ef-panel", "aria-label": T.estHeading }, ctx.panelTitle(T.estHeading, { className: "prx-ef-heading" }), estSlot, estNote);
      const zSlot = h("div", { class: "prx-ef-chart" });
      if (isPairView) ctx.primaryGraphic(zSlot);
      const zFormula = h("div", { class: "prx-ef-tex", "data-prx-tex": "z" });
      const zBox = h("section", { class: "prx-ef-panel", "aria-label": T.zHeading },
        ctx.panelTitle(T.zHeading, { className: "prx-ef-heading" }), zSlot, h("p", { class: "prx-ef-note", "data-prx-part": "notes", text: T.zNote }), zFormula);
      const resultLine = h("p", { class: "prx-ef-result", "data-prx-part": "readout" });
      const resultBox = h("section", { class: "prx-ef-panel", "aria-label": T.resultHeading }, ctx.panelTitle(T.resultHeading, { className: "prx-ef-heading" }), resultLine);
      const errorLine = h("p", { class: "prx-ef-result", "data-prx-part": "readout" });
      const pairTiles = h("div", { class: "prx-ef-tiles", "data-prx-part": "readout" });
      const pairReference = h("p", { class: "prx-ef-note", "data-prx-part": "readout" });
      const tauHint = tau.root.querySelector(".prx-hint");
      const errorBody = h("div", {}, errorLine, pairTiles, pairReference);
      const errorBox = h("section", { class: "prx-ef-panel", "aria-label": T.errorHeading }, ctx.panelTitle(T.errorHeading, { className: "prx-ef-heading" }), errorBody);
      const pairView = h("div", { class: "prx-ef-view prx-ef-pair" },
        h("div", { class: "prx-ef-grid" }, zBox, estBox), h("div", { class: "prx-ef-grid" }, resultBox, errorBox));

      // --- league view
      const rowsSlot = h("div", { class: "prx-ef-chart" });
      const rowsBox = h("section", { class: "prx-ef-panel", "aria-label": T.rowsHeading },
        ctx.panelTitle(T.rowsHeading, { className: "prx-ef-heading" }), rowsSlot, h("p", { class: "prx-ef-note", "data-prx-part": "notes", text: T.rowsNote }));
      const matrixSlot = h("div", { class: "prx-ef-chart prx-ef-matrix-chart" });
      if (!isPairView) ctx.primaryGraphic(matrixSlot);
      const matrixLegend = h("div", { class: "prx-ef-legend prx-light-panel", "data-prx-part": "legend" });
      const matrixBox = h("section", { class: "prx-ef-panel", "aria-label": T.matrixHeading },
        ctx.panelTitle(T.matrixHeading, { className: "prx-ef-heading" }), matrixSlot, matrixLegend, h("p", { class: "prx-ef-note", "data-prx-part": "notes", text: T.matrixNote }));
      const leagueTiles = h("div", { class: "prx-ef-tiles", "data-prx-part": "readout" });
      const leagueLines = h("div", { class: "prx-ef-lines", "data-prx-part": "readout" });
      const leagueView = h("div", { class: "prx-ef-view prx-ef-league" }, h("div", { class: "prx-ef-grid" }, matrixBox, rowsBox), leagueTiles, leagueLines);

      const scopeLine = h("p", { class: "prx-ef-scope", "data-prx-part": "notes", text: T.scope });
      const captionLine = h("p", { class: "prx-ef-note", "data-prx-part": "caption" });
      (isPairView ? errorBody : leagueView).append(tauHint);
      ctx.charts.append(isPairView ? pairView : leagueView);
      ctx.caption.textContent = isPairView ? "Two-unit example after the postrank theory book, chapter 2. The flags use estimates and SEs; the selected posterior evaluates their stated direction." : "A simulated league; the reference is the mean of its thirty estimates, treated as fixed. The flags use estimates and SEs; the selected posterior evaluates their stated directions.";
      ctx.caption.after(captionLine, scopeLine);

      // --------------------------------------------------------------------------------------- drawing: pair

      const P = CONFIG.pair;
      const widthOf = (slot) => Math.max(1, Math.round(slot.clientWidth || ctx.width()));

      function drawEst(state, m) {
        const rows = CONFIG.units.map((u, i) => ({
          u, est: m.est[i], se: m.se[i], lo: m.est[i] - state.crit * m.se[i], hi: m.est[i] + state.crit * m.se[i],
        }));
        const lo = Math.min(CONFIG.pairRef, ...rows.map((r) => r.lo));
        const hi = Math.max(CONFIG.pairRef, ...rows.map((r) => r.hi));
        const pad = Math.max(P.pad, (hi - lo) * P.pad);
        plot(estSlot, {
          table: {
            caption: T.estTable,
            columns: [
              { label: "Unit", value: "u" },
              { label: "Estimate", value: "est", format: (v) => formatSetting(v) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              ...[{ label: "Bar from", value: "lo", format: (v) => formatDecimal(v, { digits: CONFIG.digits.est }) }, { label: "Bar to", value: "hi", format: (v) => formatDecimal(v, { digits: CONFIG.digits.est }) }],
            ],
            rows,
          },
          keyboard: { data: rows, x: "est", y: "u", sort: false, label: T.estAlt, title: (d) => `${d.u}: estimate ${formatSetting(d.est)}, SE ${formatSetting(d.se)}, bar ${formatDecimal(d.lo, { digits: 3 })} to ${formatDecimal(d.hi, { digits: 3 })}.` },
          alt: T.estAlt,
          width: widthOf(estSlot),
          height: P.marginTop + P.marginBottom + rows.length * P.rowHeight,
          marginTop: P.marginTop, marginBottom: P.marginBottom, marginLeft: P.marginLeft, marginRight: P.marginRight,
          x: { domain: [lo - pad, hi + pad], label: T.estAxis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: CONFIG.units.slice(), label: null, tickSize: 0, padding: P.yPadding },
          marks: (c, Pl) => [
            Pl.ruleX([CONFIG.pairRef], { stroke: c.plotAxis, strokeDasharray: P.refDash }),
            Pl.text([CONFIG.pairRef], { x: (d) => d, frameAnchor: "top", dy: -P.marginTop + 4, lineAnchor: "top", text: () => T.reference, fill: c.plotFg }),
            Pl.ruleY(rows, { y: "u", x1: "lo", x2: "hi", stroke: c.plotFg, strokeWidth: P.bar }),
            Pl.dot(rows, { x: "est", y: "u", r: P.dot, fill: c.est, stroke: c.plotBg }),
          ],
        });
        estNote.textContent = T.estNote;
      }

      function drawZ(state, m) {
        const z = Array.from(m.flags.z);
        const zmax = Math.max(P.zMin, state.crit, ...z.map(Math.abs)) * P.zPad;
        const width = widthOf(zSlot);
        const unitsPerPixel = 2 * zmax / Math.max(1, width - P.marginLeft - P.marginRight);
        const guides = [-zmax, -state.crit, 0, state.crit, zmax];
        const rows = CONFIG.units.map((u, i) => {
          const value = z[i];
          const label = m.flags.labels[i];
          // Keep the number in its own band when it fits. A compressed central band can
          // be narrower than the number, so use the nearest guide-free position then.
          const clearance = (4 + 3.75 * zText(value).length) * unitsPerPixel;
          const preferred = label === 1 ? 3 : label === 3 ? 0 : value < 0 ? 1 : 2;
          const positions = guides.slice(0, -1).map((edge, j) => {
            const left = edge + clearance;
            const right = guides[j + 1] - clearance;
            return left <= right ? Math.min(right, Math.max(left, value)) : null;
          });
          const labelZ = positions[preferred] ?? positions.filter((x) => x !== null)
            .reduce((best, x) => best === null || Math.abs(x - value) < Math.abs(best - value) ? x : best, null) ?? value;
          return { u, z: value, labelZ, label, grade: m.grade[i] };
        });
        const zones = [{ x1: state.crit, x2: zmax, word: T.zoneAbove, at: (state.crit + zmax) / 2 }, { x1: -zmax, x2: -state.crit, word: T.zoneBelow, at: (-state.crit - zmax) / 2 }];
        plot(zSlot, {
          table: {
            caption: T.zTable,
            columns: [
              { label: "Unit", value: "u" },
              { label: "z", value: "z", format: (v) => zText(v) },
              { label: "Flag", value: (d) => T.flagWords[d.label] },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows,
          },
          keyboard: { data: rows, x: "z", y: "u", sort: false, label: T.zAlt, title: (d) => `${d.u}: z ${zText(d.z)}, ${T.flagWords[d.label]}, grade ${d.grade}.` },
          alt: T.zAlt,
          width,
          height: P.marginTop + P.marginBottom + rows.length * P.rowHeight,
          marginTop: P.marginTop, marginBottom: P.marginBottom, marginLeft: P.marginLeft, marginRight: P.marginRight,
          x: { domain: [-zmax, zmax], ticks: [-state.crit, 0, state.crit], label: T.zAxis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: CONFIG.units.slice(), label: null, tickSize: 0, padding: P.yPadding },
          marks: (c, Pl) => [
            Pl.rectX(zones, { x1: "x1", x2: "x2", fill: c.plotGrid }),
            Pl.text(zones, { x: "at", frameAnchor: "top", dy: -P.marginTop + 4, lineAnchor: "top", text: "word", fill: c.plotFg }),
            Pl.ruleX([state.crit, -state.crit], { stroke: c.plotAxis, strokeDasharray: P.cutDash }),
            Pl.ruleX([0], { stroke: c.plotAxis, strokeDasharray: P.refDash }),
            Pl.dot(rows, { x: "z", y: "u", r: P.dot, fill: c.plotFg, stroke: c.plotBg }),
            numText(rows, { x: "labelZ", y: "u", value: "z", format: (v) => zText(v), dy: P.labelDy, fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
          ],
        });
        // the z formula with the numbers put in, one line per unit
        const f = formulaNums();
        const line = (i) => {
          const u = CONFIG.units[i];
          const e = f.num(m.est[i], formatSetting(m.est[i]));
          const r = f.num(CONFIG.pairRef, formatCount(CONFIG.pairRef));
          const s = f.num(m.se[i], formatSetting(m.se[i]));
          const zz = f.num(z[i], zText(z[i]));
          return `z_{\\mathrm{${u}}} &= \\frac{${e} - ${r}}{${s}} = ${zz}`;
        };
        renderTex(zFormula, `\\begin{aligned}${line(0)} \\\\ ${line(1)}\\end{aligned}`, { display: true, nums: f.raws });
      }

      function flagNodes(m, i, c) {
        const label = m.flags.labels[i];
        const G = Math.max(...m.grade);
        return [`${T.unit[CONFIG.units[i]]} (z = `, ro(`z${CONFIG.units[i]}`, m.flags.z[i], zText(m.flags.z[i])), `): ${T.flagWords[label]}, grade `, chip(m.grade[i], G, c)];
      }

      function drawResult(m, c) {
        const parts = [...flagNodes(m, 0, c), "; ", ...flagNodes(m, 1, c), ". "];
        if (m.stated) {
          parts.push(`${T.statesWord} `, h("strong", { "data-prx-readout": "stated", text: `${CONFIG.units[m.above]} ${T.aboveWord} ${CONFIG.units[m.below]}` }), ".");
        } else parts.push(T.withholds);
        resultLine.replaceChildren(...parts);
      }

      function drawError(state, m) {
        const ev = m.ev;
        if (m.stated) {
          errorLine.replaceChildren(`Under the ${state.prior === "flat" ? "flat-prior posterior" : "teaching posterior"}, the stated direction ${CONFIG.units[m.above]} above ${CONFIG.units[m.below]} is wrong with probability `,
            ro("error", m.error, formatProb(m.error)), ".",
            ...(state.prior === "teaching" ? [" The posterior means are ", ro("meanA", m.post.mean[0], formatDecimal(m.post.mean[0], { digits: CONFIG.digits.mean })), " for A and ",
              ro("meanB", m.post.mean[1], formatDecimal(m.post.mean[1], { digits: CONFIG.digits.mean })), " for B; the flags do not change."] : []));
        } else errorLine.replaceChildren(T.noStatement);
        pairTiles.replaceChildren(
          tile("Pairs stated, N", [ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", ev.M, formatCount(ev.M))]),
          tile("Expected wrong directions, E", [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile("E/N", [ro("EoverN", ev.EoverN[0], formatShare(ev.EoverN[0]))]),
          tile("Expected loss per pair (risk)", [ro("risk", ev.risk, formatRisk(ev.risk))]),
          tile("Stated directions that run against the estimates", [ro("against", m.against.count, formatCount(m.against.count)), " of ", ctx.num(ev.N, formatCount(ev.N))]),
        );
        const allW = evaluateReport([1, 1], m.E, { tau: state.tau });
        pairReference.replaceChildren("At τ = ", ro("tau", state.tau, formatSetting(state.tau)), ", withholding the pair instead has risk ",
          ro("allWithheld", allW.risk, formatRisk(allW.risk)), ", which equals τ (", captionNode(ctx, "fixed-report"), ").");
      }

      // ------------------------------------------------------------------------------------- drawing: league

      const Lg = CONFIG.league;

      function drawRows(state, m, c) {
        const G = Math.max(...m.grade);
        const marked = new Set(m.against.units);
        const rows = ORDER.map((i) => ({
          i, id: IDS[i], est: EST[i], se: SE[i], z: m.flags.z[i], label: m.flags.labels[i], grade: m.grade[i],
          lo: EST[i] - state.crit * SE[i], hi: EST[i] + state.crit * SE[i], marked: marked.has(i),
        }));
        const lo = Math.min(REF, ...rows.map((r) => r.lo));
        const hi = Math.max(REF, ...rows.map((r) => r.hi));
        const span = hi - lo;
        const x0 = lo - span * Lg.pad;
        const x1 = hi + span * Lg.pad;
        const chipLo = x1 + span * Lg.chipGap;
        const chipHi = chipLo + span * Lg.chip;
        const grades = gradeColors(G, c);
        const chips = rows.map((r) => ({ ...r, fill: grades[r.grade - 1], ink: labelOn(grades[r.grade - 1], c) }));
        plot(rowsSlot, {
          table: {
            caption: T.rowsTable,
            columns: [
              { label: "Unit", value: "id" },
              { label: "Estimate", value: "est", format: (v) => formatDecimal(v, { digits: CONFIG.digits.est }) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              { label: "z", value: "z", format: (v) => zText(v) },
              { label: "Flag", value: (d) => T.flagWords[d.label] },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
              { label: "Placed below a unit with a smaller estimate", value: (d) => (d.marked ? "yes" : "no") },
            ],
            rows,
          },
          width: widthOf(rowsSlot),
          height: Lg.marginTop + Lg.marginBottom + rows.length * Lg.rowHeight,
          marginTop: Lg.marginTop, marginBottom: Lg.marginBottom, marginLeft: Lg.marginLeft, marginRight: Lg.marginRight,
          x: { domain: [x0, chipHi], ticks: Lg.ticks.filter((t) => t >= x0 && t <= x1), label: T.estAxis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: ORDER.map((i) => IDS[i]), label: null, tickSize: 0, padding: Lg.yPadding },
          marks: (cc, Pl) => [
            Pl.barX(rows.filter((r) => r.marked), { x1: x0, x2: x1, y: "id", fill: cc.neutral[1] }),
            Pl.ruleX([REF], { stroke: cc.plotAxis, strokeDasharray: Lg.dash }),
            Pl.text([REF], { x: (d) => d, frameAnchor: "top", dy: -Lg.marginTop + 4, lineAnchor: "top", text: () => T.reference, fill: cc.plotFg }),
            Pl.ruleY(rows, { y: "id", x1: "lo", x2: "hi", stroke: cc.plotFg, strokeWidth: Lg.bar }),
            Pl.tickX(rows, { x: "est", y: "id", stroke: cc.est, strokeWidth: 3, inset: 1 }),
            Pl.barX(chips, { x1: chipLo, x2: chipHi, y: "id", fill: "fill", inset: Lg.chipInset }),
            numText(chips, { x: (chipLo + chipHi) / 2, y: "id", value: "grade", format: (v) => formatCount(v), fill: "ink" }),
          ],
          keyboard: {
            data: rows, x: "est", y: "id", sort: false,
            label: T.rowsAlt,
            title: (d) => `${d.id}: estimate ${formatDecimal(d.est, { digits: CONFIG.digits.est })}, SE ${formatSetting(d.se)}, z ${zText(d.z)}, ${T.flagWords[d.label]}, grade ${d.grade}${d.marked ? "; placed below a unit with a smaller estimate" : ""}.`,
          },
        });
      }

      function drawMatrix(m) {
        const Mx = CONFIG.matrix;
        const avail = matrixSlot.clientWidth || ctx.width();
        // Unit names fit on both axes at larger cell sizes. The estimate panel shares this order.
        const roomy = Math.floor((avail - Mx.labelMargin - Mx.marginRight) / N_UNITS) >= Mx.labelCell;
        const left = roomy ? Mx.labelMargin : Mx.marginLeft;
        const top = roomy ? Mx.labelMargin : Mx.marginTop;
        const cell = Math.max(Mx.minCell, Math.min(Mx.maxCell, Math.floor((avail - left - Mx.marginRight) / N_UNITS)));
        const width = left + Mx.marginRight + N_UNITS * cell;
        const height = top + Mx.marginBottom + N_UNITS * cell;
        matrixSlot.style.maxWidth = `${width}px`;
        const ids = ORDER.map((i) => IDS[i]);
        const cells = [];
        for (const i of ORDER) {
          for (const j of ORDER) {
            if (i === j) continue;
            const r = m.rel[i][j];
            // above the diagonal the row unit has the larger estimate: stating it below runs against the estimates, and
            // so does the mirror cell, which states the unit with the smaller estimate above
            const against = (r === -1 && POSITION.get(i) < POSITION.get(j)) || (r === 1 && POSITION.get(i) > POSITION.get(j));
            cells.push({ row: IDS[i], col: IDS[j], rel: r, against });
          }
        }
        const rows = m.against.pairs.map((p) => ({
          above: IDS[p.above], below: IDS[p.below], estAbove: EST[p.above], estBelow: EST[p.below], error: m.E.e[0][p.above][p.below],
        }));
        plot(matrixSlot, {
          keyboard: { data: cells, x: "col", y: "row", sort: false, label: T.matrixAlt, title: (d) => `${d.row} relative to ${d.col}: ${d.rel === 1 ? T.relAbove : d.rel === -1 ? T.relBelow : T.relWithheld}${d.against ? "; runs against the estimates" : ""}.` },
          alt: T.matrixAlt,
          table: {
            caption: T.matrixTable,
            columns: [
              { label: "Stated above", value: "above" },
              { label: "Its estimate", value: "estAbove", format: (v) => formatDecimal(v, { digits: CONFIG.digits.est }) },
              { label: "Stated below", value: "below" },
              { label: "Its estimate", value: "estBelow", format: (v) => formatDecimal(v, { digits: CONFIG.digits.est }) },
              { label: "Error of the stated direction", value: "error", format: (v) => formatProb(v) },
            ],
            rows,
          },
          width, height,
          marginTop: top, marginLeft: left, marginRight: Mx.marginRight, marginBottom: Mx.marginBottom,
          x: roomy ? { domain: ids, padding: 0, axis: "top", tickRotate: Mx.labelRotate, tickSize: 0, label: null, fontSize: Mx.labelFont } : { domain: ids, padding: 0, axis: null },
          y: roomy ? { domain: ids, padding: 0, tickSize: 0, label: null, fontSize: Mx.labelFont } : { domain: ids, padding: 0, axis: null },
          color: { type: "identity" },
          marks: (c, Pl) => {
            const fillOf = (d) => (d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld);
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({ id: hatchId, patternUnits: "userSpaceOnUse", width: Mx.hatchSpacing, height: Mx.hatchSpacing, patternTransform: "rotate(45)" })) pat.setAttribute(k, String(v));
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: Mx.hatchSpacing, stroke: c.hatch, "stroke-width": Mx.hatchWidth })) line.setAttribute(k, String(v));
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            return [
              Pl.cell(ids.map((id) => ({ id })), { x: "id", y: "id", fill: c.plotGrid, inset: Mx.inset }),
              Pl.cell(cells, { x: "col", y: "row", fill: fillOf, inset: Mx.inset }),
              hatch,
              Pl.cell(cells.filter((d) => d.rel === 0), { x: "col", y: "row", fill: `url(#${hatchId})`, inset: Mx.inset }),
              Pl.cell(cells.filter((d) => d.against), { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: Mx.outline, inset: Mx.inset }),
            ];
          },
        });
        matrixLegend.replaceChildren(
          h("span", { class: "prx-ef-legend-title", text: T.relationTitle }),
          h("span", { class: "prx-ef-key" }, h("span", { class: "prx-ef-swatch", style: { background: "var(--prx-rel-above)" } }), T.relAbove),
          h("span", { class: "prx-ef-key" }, h("span", { class: "prx-ef-swatch prx-ef-swatch-hatch" }), T.relWithheld),
          h("span", { class: "prx-ef-key" }, h("span", { class: "prx-ef-swatch", style: { background: "var(--prx-rel-below)" } }), T.relBelow),
          h("span", { class: "prx-ef-key" }, h("span", { class: "prx-ef-swatch prx-ef-swatch-outline" }), T.outlineLegend),
        );
      }

      function drawLeagueReadouts(state, m) {
        const ev = m.ev;
        const [k1, k2, k3] = m.counts;
        leagueTiles.replaceChildren(
          tile("Flagged above · not flagged · flagged below", [ro("above", k1, formatCount(k1)), " · ", ro("none", k2, formatCount(k2)), " · ", ro("below", k3, formatCount(k3))]),
          tile("Pairs stated, N", [ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", M_LEAGUE, formatCount(M_LEAGUE))]),
          tile("Expected wrong directions, E", [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile("E/N", [ro("EoverN", ev.EoverN[0], formatShare(ev.EoverN[0]))]),
          tile("Expected loss per pair (risk)", [ro("risk", ev.risk, formatRisk(ev.risk))]),
        );
        const names = m.against.units.map((i) => IDS[i]);
        leagueLines.replaceChildren(
          h("p", {}, "At τ = ", ro("tau", state.tau, formatSetting(state.tau)), ", E/N = ", ctx.num(ev.EoverN[0], formatShare(ev.EoverN[0])),
            " beside τ; withholding every pair has risk ", ro("allWithheld", m.allW.risk, formatRisk(m.allW.risk)), " (", captionNode(ctx, "fixed-report"), ")."),
          h("p", {}, "Largest error of a stated direction: ", ro("maxstated", m.stated.max, m.stated.max === null ? "NA" : formatProb(m.stated.max)),
            ". Stated directions more likely wrong than right (error above one half): ", ro("overhalf", m.overHalf.count, formatCount(m.overHalf.count)), "."),
          h("p", {}, "Stated directions that run against the estimates: ", ro("against", m.against.count, formatCount(m.against.count)), " of ", ctx.num(ev.N, formatCount(ev.N)),
            ". Units placed below some unit with a smaller estimate: ", ro("againstUnits", names.length, formatCount(names.length)),
            ...(names.length ? [" (", ...names.flatMap((nm, k) => [k ? ", " : "", h("span", { "data-prx-name": "", text: nm })]), ")"] : []), "."),
          h("p", {}, "Reference: the mean of the ", ctx.num(N_UNITS, formatCount(N_UNITS)), " estimates, ", ro("ref", REF, formatDecimal(REF, { digits: CONFIG.digits.ref })), "; league ", T.seedWords, " ",
            ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)), "."),
        );
      }

      function drawReadout(state, pm, lm) {
        if (!isPairView) {
          const ev = lm.ev;
          ctx.readout.set([
            "Cutoff ", ctx.num(state.crit, formatDecimal(state.crit, { digits: state.crit === 1.96 ? 2 : 3 })), ": ", ctx.num(lm.counts[0], formatCount(lm.counts[0])), " units flagged above, ",
            ctx.num(lm.counts[1], formatCount(lm.counts[1])), " not flagged and ", ctx.num(lm.counts[2], formatCount(lm.counts[2])),
            " flagged below. The report states ", ctx.num(ev.N, formatCount(ev.N)), " of ", ctx.num(M_LEAGUE, formatCount(M_LEAGUE)),
            " pairs, E/N ", ctx.num(ev.EoverN[0], formatShare(ev.EoverN[0])), ", risk ", ctx.num(ev.risk, formatRisk(ev.risk)), " at τ = ",
            ctx.num(state.tau, formatSetting(state.tau)), "; ", ctx.num(lm.against.count, formatCount(lm.against.count)), " stated directions run against the estimates. All-withheld risk ", ro("result-allWithheld", lm.allW.risk, formatRisk(lm.allW.risk)), ".",
          ]);
          return;
        }
        const unitSummary = (i) => [
          "z = ", ctx.num(pm.flags.z[i], zText(pm.flags.z[i])), ", ", T.flagWords[pm.flags.labels[i]],
          " (grade ", ro(`result-grade-${CONFIG.units[i]}`, pm.grade[i], formatCount(pm.grade[i])), ")",
        ];
        const parts = ["Unit A: ", ...unitSummary(0), "; unit B: ", ...unitSummary(1), ". "];
        if (!pm.stated) parts.push("The report withholds the pair. Both units are in the same flag group; this makes no claim of equality.");
        else {
          const above = CONFIG.units[pm.above];
          const below = CONFIG.units[pm.below];
          parts.push(`The report states ${above} above ${below}`);
          if (pm.against.count) parts.push(`, although ${below}'s estimate is larger`);
          parts.push(". Under the ", state.prior === "flat" ? "flat-prior posterior" : "teaching posterior",
            " that direction is wrong with probability ", ctx.num(pm.error, formatProb(pm.error)), ".");
        }
        ctx.readout.set(parts);
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            crit.set(state.crit);
            prior.set(state.prior);
            tau.set(state.tau);
            for (const [k, s] of sliders) s.set(state[k]);
            const isPair = isPairView;
            pairView.hidden = !isPair;
            leagueView.hidden = isPair;
            unitRow.hidden = !isPair;
            ctx.root.setAttribute("data-prx-view", mode);
            const c = palette(ctx.root);
            let pm = null;
            let lm = null;
            if (isPair) {
              pm = pairModel(state);
              drawEst(state, pm);
              drawZ(state, pm);
              drawResult(pm, c);
              drawError(state, pm);
              leagueTiles.replaceChildren();
              leagueLines.replaceChildren();
            } else {
              // the hidden view keeps no read-out numbers, so every read-out hook names one element
              for (const n of [resultLine, errorLine, pairTiles, pairReference]) n.replaceChildren();
              lm = leagueModel(state);
              drawRows(state, lm, c);
              drawMatrix(lm);
              drawLeagueReadouts(state, lm);
            }
            drawReadout(state, pm, lm);
            const words = fill(T.priorWords[state.prior], wordSlots);
            if (typeof words[0] === "string") words[0] = words[0].charAt(0).toLowerCase() + words[0].slice(1);
            if (state.prior === "teaching") captionLine.replaceChildren("Posterior used for the errors: ", ...words, " (", captionNode(ctx, "teaching-posterior"), "). Independent units.");
            else captionLine.replaceChildren("Posterior used for the errors: ", captionNode(ctx, "flat-posterior"), ". Independent units.");
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}

export function mountWidget(el, spec = {}) { return mountFlags(el, spec, "pair"); }
