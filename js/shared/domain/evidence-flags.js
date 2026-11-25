// R-02 linked flag-rule views (3.3 evidence-flags & 3.4 flags-in-the-league · Frame v2).
import { createWidget, uid } from "../base.js";
import { gradeColors, labelOn, palette, placeDirectLabels, plot, svgEl } from "../chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatProb,
  formatReadoutEst,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../format.js";
import { captionNode } from "../labels.js";
import { formulaNums, renderTex } from "../math.js";
import { renderDataTable } from "../table.js";
import {
  LEAGUE_SEED,
  drawLeague,
  errorArray,
  evaluateReport,
  evidenceFlags,
  league30,
  normalPosterior,
  pairCount,
  relations,
  scoreOrder,
  statedAbove,
  statedAgainst,
  summaryStats,
} from "../../pr-core.js";

export const FLAGS_CSS = `
/*
 * postrank Explorer · evidence-flags & flags-in-the-league (catalog 3.3 & 3.4; Frame v2)
 */

.prx-ef.prx-widget[data-prx-frame="v2"] .prx-toolbar {
  align-items: flex-end;
}

.prx-ef.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  align-items: flex-start;
  gap: 0.5rem 1rem;
}

.prx-ef[data-prx-view="pair"].prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 100%;
}

.prx-ef.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider {
  flex: 1 1 13rem;
  max-width: 21rem;
}

.prx-ef.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > .prx-disclosure-body {
  align-items: flex-start;
  gap: 0.65rem 1.25rem;
}

.prx-ef .prx-ef-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.65rem 1.25rem;
  width: 100%;
  min-width: 0;
}

.prx-ef .prx-ef-settings-grid > .prx-slider {
  flex: 1 1 12.5rem;
  max-width: 17rem;
}

@media (max-width: 30em) {
  .prx-ef.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider,
  .prx-ef .prx-ef-settings-grid > .prx-slider {
    flex: 1 1 100%;
    max-width: none;
  }
  .prx-ef.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.45rem;
    font-size: 0.8rem;
  }
  .prx-ef.prx-widget[data-prx-frame="v2"] > .prx-stage {
    padding: 0.45rem 0.5rem;
  }
  .prx-ef.prx-widget[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.5rem;
    padding: 0.3rem 0.55rem;
  }
  .prx-ef.prx-widget[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.5rem;
    gap: 0.35rem;
  }
  .prx-ef .prx-ef-grid {
    gap: 0.65rem 1rem;
  }
  .prx-ef .prx-ef-legend {
    padding: 0.22rem 0.4rem;
    gap: 0.14rem 0.5rem;
    font-size: 0.78rem;
  }
}

/* --- stage --- */
.prx-ef .prx-ef-view {
  min-width: 0;
}

.prx-ef .prx-ef-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  gap: 0.85rem 1.25rem;
  align-items: start;
  min-width: 0;
}

.prx-ef .prx-ef-panel {
  min-width: 0;
}

.prx-ef .prx-ef-heading {
  margin: 0 0 0.3rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--prx-fg-heading);
}

.prx-ef .prx-stage .prx-ef-heading {
  color: var(--prx-plot-fg);
}

.prx-ef .prx-ef-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-ef .prx-stage .prx-ef-callout {
  margin: 0.55rem 0 0;
  padding: 0.38rem 0.65rem;
  font-size: 0.84375rem;
  line-height: 1.38;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-left: 3px solid var(--prx-est);
  border-radius: 5px;
}

.prx-ef .prx-stage .prx-ef-callout[data-tone="neutral"] {
  border-left-color: var(--prx-cell-border);
}

/* --- legends (on the plot panel) --- */
.prx-ef .prx-ef-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.7rem;
  margin: 0.35rem 0 0;
  padding: 0.32rem 0.5rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
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
  width: 0.95em;
  height: 0.95em;
  border: 1px solid var(--prx-cell-border);
}

.prx-ef .prx-ef-swatch-hatch {
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 4px);
}

.prx-ef .prx-ef-swatch-outline {
  background: var(--prx-plot-bg);
  border: 2px solid var(--prx-plot-fg);
}

/* --- disclosure sections --- */
.prx-ef .prx-ef-disc-stack {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}

.prx-ef .prx-ef-result {
  margin: 0;
}

.prx-ef .prx-ef-note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--prx-fg-muted);
}

.prx-ef .prx-ef-scope {
  margin: 0;
  font-size: 0.875rem;
  font-style: italic;
  color: var(--prx-fg-muted);
}

.prx-ef .prx-ef-tex {
  margin: 0.25rem 0;
  max-width: 100%;
  overflow-x: auto;
}

.prx-ef .prx-ef-chip {
  display: inline-block;
  min-width: 1.4em;
  padding: 0 0.3em;
  border-radius: 3px;
  text-align: center;
  font-weight: 600;
}

.prx-ef .prx-ef-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.45rem;
  margin: 0.2rem 0;
}

.prx-ef .prx-ef-tile {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  min-width: 0;
}

.prx-ef .prx-ef-tile-name {
  font-size: 0.8125rem;
  color: var(--prx-fg-muted);
}

.prx-ef .prx-ef-tile-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.prx-ef .prx-ef-lines {
  display: grid;
  gap: 0.25rem;
}

.prx-ef .prx-ef-lines > p {
  margin: 0;
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
    rowHeight: 78, marginTop: 34, marginBottom: 38, marginLeft: 40, marginRight: 52, pad: 0.09, dot: 6, bar: 3,
    zPad: 1.15, zMin: 3, yPadding: 0.34, labelDy: -18, zoneDy: 12, refDash: "5 3", cutDash: "2 2",
  }),
  league: Object.freeze({
    rowHeight: 18.5, narrowRowHeight: 24.5, marginTop: 26, marginBottom: 34, marginLeft: 42, marginRight: 16, pad: 0.04, chip: 0.13, chipGap: 0.035, yPadding: 0.1, chipInset: 0.5,
    tick: 9, bar: 1.5, dash: "5 3", ticks: Object.freeze([-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]),
    sparseRanks: Object.freeze([0, 9, 19, 29]),
  }),
  matrix: Object.freeze({
    marginTop: 26, marginLeft: 40, marginRight: 16, marginBottom: 8, minCell: 8, maxCell: 13,
    inset: 0.25, outline: 1.6, hatchSpacing: 4, hatchWidth: 1, labelCell: 14, labelMargin: 30, labelFont: 13, labelRotate: 0,
  }),
  text: Object.freeze({
    viewLegend: "View",
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
    matrixNote: "Rows and columns follow the order in the estimate panel, largest estimate first, so above the diagonal the row unit has the larger estimate. A stated direction that runs against the estimates shows there as a stated-below cell; it and its mirror cell below the diagonal are outlined.",
    matrixAlt: "Thirty-by-thirty relation matrix of the flag report: each cell says whether the report states the row unit above, below or neither relative to the column unit.",
    matrixTable: "The stated directions that run against the estimates",
    relationTitle: "Row unit relative to column unit",
    relAbove: "stated above",
    relWithheld: "withheld (not a claim of equality)",
    relBelow: "stated below",
    outlineLegend: "outline: runs against the estimates",
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

function safeDecimal(v, digits) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "NA";
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
}

/** Widest contiguous run [startIndex, endIndex] (in sorted row order) for each distinct grade 1..G. */
function gradeBadgeAnchors(rows, G) {
  const anchors = [];
  for (let g = 1; g <= G; g += 1) {
    let bestStart = -1;
    let bestLen = 0;
    let i = 0;
    while (i < rows.length) {
      if (rows[i].grade !== g) { i += 1; continue; }
      let j = i;
      while (j < rows.length && rows[j].grade === g) j += 1;
      const len = j - i;
      if (len > bestLen) { bestLen = len; bestStart = i; }
      i = j;
    }
    if (bestStart >= 0) {
      const endIdx = bestStart + bestLen - 1;
      const midIdx = bestStart + Math.floor((bestLen - 1) / 2);
      anchors.push({
        id: `grade-${g}`,
        grade: g,
        startId: rows[bestStart].id,
        endId: rows[endIdx].id,
        unitId: rows[midIdx].id,
      });
    }
  }
  return anchors;
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
    frame: "v2",
    css: FLAGS_CSS,
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
        zero: () => ctx.num(0, formatCount(0)),
        one: () => ctx.num(1, formatCount(1)),
        priorMean: () => ctx.num(CONFIG.teaching.priorMean, formatCount(CONFIG.teaching.priorMean)),
        priorSd: () => ctx.num(CONFIG.teaching.priorSd, formatSetting(CONFIG.teaching.priorSd)),
      };
      const zText = (z) => safeDecimal(z, CONFIG.digits.z);
      const tile = (name, value) => h("div", { class: "prx-ef-tile" },
        h("span", { class: "prx-ef-tile-name", text: name }),
        h("span", { class: "prx-ef-tile-value" }, ...value));
      const chip = (grade, G, c) => {
        const fillColor = gradeColors(G, c)[grade - 1];
        return h("span", { class: "prx-ef-chip", style: { background: fillColor, color: labelOn(fillColor, c) } }, ctx.num(grade, formatCount(grade)));
      };

      // --- controls & settings (Frame v2: primary controls in ctx.controls, secondary in ctx.settingsBox)
      const crit = ctx.segmented({
        label: T.critLegend,
        name: "crit",
        options: CONFIG.crits.map((c) => ({ value: c, label: [ctx.num(c, formatSetting(c))] })),
        value: ctx.state.crit,
        onChange: (v) => ctx.set({ crit: v }),
      });

      const prior = ctx.segmented({
        label: T.priorLegend,
        name: "prior",
        options: CONFIG.priors.map((p) => ({ value: p, label: fill(T.priorWords[p], wordSlots) })),
        value: ctx.state.prior,
        onChange: (v) => ctx.set({ prior: v }),
      });

      const tau = ctx.slider({
        label: T.tauLabel,
        min: CONFIG.tau.min,
        max: CONFIG.tau.max,
        step: CONFIG.tau.step,
        value: ctx.state.tau,
        name: "tau",
        onInput: (v) => ctx.set({ tau: v }),
      });

      const sliders = [];
      const settingsBox = ctx.settingsBox("Settings");
      const settingsGrid = h("div", { class: "prx-ef-settings-grid" });
      settingsBox.body.append(settingsGrid);

      if (isPairView) {
        const estB = ctx.slider({
          label: "Unit B estimate",
          ...CONFIG.est,
          value: ctx.state.estB,
          name: "estB",
          onInput: (v) => ctx.set({ estB: v }),
        });
        const seB = ctx.slider({
          label: "Unit B SE",
          ...CONFIG.se,
          value: ctx.state.seB,
          name: "seB",
          onInput: (v) => ctx.set({ seB: v }),
        });
        const estA = ctx.slider({
          label: "Unit A estimate",
          ...CONFIG.est,
          value: ctx.state.estA,
          name: "estA",
          onInput: (v) => ctx.set({ estA: v }),
        });
        const seA = ctx.slider({
          label: "Unit A SE",
          ...CONFIG.se,
          value: ctx.state.seA,
          name: "seA",
          onInput: (v) => ctx.set({ seA: v }),
        });
        estA.input.setAttribute("aria-label", `${T.estLabel} of unit A`);
        seA.input.setAttribute("aria-label", `${T.seLabel} of unit A`);
        estB.input.setAttribute("aria-label", `${T.estLabel} of unit B`);
        seB.input.setAttribute("aria-label", `${T.seLabel} of unit B`);
        sliders.push(["estA", estA], ["seA", seA], ["estB", estB], ["seB", seB]);

        ctx.controls.append(estB.root, ctx.primaryControl(seB.root));
        settingsGrid.append(crit.root, prior.root, estA.root, seA.root, tau.root);
      } else {
        ctx.controls.append(ctx.primaryControl(crit.root));
        settingsGrid.append(prior.root, tau.root);
      }

      // --- stage & disclosures
      const dataBox = ctx.dataBox(isPairView ? "Data and exact values" : "Data, reversed pairs and unit table");
      const methodBox = ctx.methodBox(isPairView ? "Method and z-threshold formulas" : "Method and flag rule");
      const dataStack = h("div", { class: "prx-ef-disc-stack" });
      const methodStack = h("div", { class: "prx-ef-disc-stack" });
      dataBox.body.append(dataStack);
      methodBox.body.append(methodStack);

      // --- pair view stage & disclosure nodes
      const zSlot = h("div", { class: "prx-ef-chart" });
      const zBox = h("section", { class: "prx-ef-panel", "aria-label": T.zHeading },
        ctx.panelTitle(T.zHeading, { className: "prx-ef-heading" }), zSlot);
      const estSlot = h("div", { class: "prx-ef-chart" });
      const estBox = h("section", { class: "prx-ef-panel", "aria-label": T.estHeading },
        ctx.panelTitle(T.estHeading, { className: "prx-ef-heading" }), estSlot);
      const pairCallout = h("p", { class: "prx-ef-callout" });
      const pairView = h("div", { class: "prx-ef-view prx-ef-pair" },
        h("div", { class: "prx-ef-grid" }, zBox, estBox), pairCallout);

      const resultLine = h("p", { class: "prx-ef-result" });
      const resultBox = h("section", { class: "prx-ef-panel", "aria-label": T.resultHeading },
        ctx.panelTitle(T.resultHeading, { className: "prx-ef-heading" }), resultLine);
      const errorLine = h("p", { class: "prx-ef-result" });
      const pairTiles = h("div", { class: "prx-ef-tiles" });
      const pairReference = h("p", { class: "prx-ef-note" });
      const pairExactTableHost = h("div", {});
      const errorBox = h("section", { class: "prx-ef-panel", "aria-label": T.errorHeading },
        ctx.panelTitle(T.errorHeading, { className: "prx-ef-heading" }),
        errorLine, pairTiles, pairReference, pairExactTableHost);

      const zFormula = h("div", { class: "prx-ef-tex", "data-prx-tex": "z" });

      // --- league view stage & disclosure nodes
      const matrixSlot = h("div", { class: "prx-ef-chart prx-ef-matrix-chart" });
      const matrixLegend = h("div", { class: "prx-ef-legend prx-light-panel", "data-prx-part": "legend" });
      const matrixBox = h("section", { class: "prx-ef-panel", "aria-label": T.matrixHeading },
        ctx.panelTitle(T.matrixHeading, { className: "prx-ef-heading" }), matrixSlot, matrixLegend);
      const rowsSlot = h("div", { class: "prx-ef-chart" });
      const rowsBox = h("section", { class: "prx-ef-panel", "aria-label": T.rowsHeading },
        ctx.panelTitle(T.rowsHeading, { className: "prx-ef-heading" }), rowsSlot);
      const leagueView = h("div", { class: "prx-ef-view prx-ef-league" },
        h("div", { class: "prx-ef-grid" }, matrixBox, rowsBox));

      const leagueWitness = h("p", { class: "prx-ef-note", "data-prx-flag-witness": "" });
      leagueView.append(leagueWitness);
      const leagueTiles = h("div", { class: "prx-ef-tiles" });
      const leagueLines = h("div", { class: "prx-ef-lines" });
      const leagueAgainstTableHost = h("div", {});
      const leagueUnitsTableHost = h("div", {});

      // --- shared method notes
      const tauHintLine = h("p", { class: "prx-ef-note", text: T.tauHint });
      const captionLine = h("p", { class: "prx-ef-note" });
      const scopeLine = h("p", { class: "prx-ef-scope", "data-prx-part": "notes", text: T.scope });

      if (isPairView) {
        ctx.stage.append(pairView);
        dataStack.append(resultBox, errorBox);
        methodStack.append(
          h("p", { class: "prx-ef-note", "data-prx-part": "notes", text: T.zNote }),
          zFormula,
          h("p", { class: "prx-ef-note", text: T.estNote }),
          tauHintLine,
          captionLine,
          scopeLine,
        );
      } else {
        ctx.stage.append(leagueView);
        dataStack.append(leagueTiles, leagueLines, leagueAgainstTableHost, leagueUnitsTableHost);
        methodStack.append(
          h("p", { class: "prx-ef-note", "data-prx-part": "notes", text: T.matrixNote }),
          h("p", { class: "prx-ef-note", text: T.rowsNote }),
          tauHintLine,
          captionLine,
          scopeLine,
        );
      }

      // --------------------------------------------------------------------------------------- drawing: pair

      const P = CONFIG.pair;
      const slotWidth = (slot) => {
        const direct = Math.round(slot.clientWidth || slot.getBoundingClientRect?.().width || 0);
        if (direct > 0) return Math.max(200, direct);
        const w = ctx.width();
        return Math.max(200, Math.round(w > 740 ? (w - 48) / 2 : w - 42));
      };

      function drawGradePill(doc, g, { cx, cy, grade, fillColor, inkColor, strokeColor, withNum = false }) {
        const pw = 28;
        const ph = 18;
        g.append(
          svgEl(doc, "rect", {
            x: cx - pw / 2,
            y: cy - ph / 2,
            width: pw,
            height: ph,
            rx: 3.5,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 1.5,
          }),
          svgEl(doc, "text", {
            x: cx,
            y: cy,
            textAnchor: "middle",
            dominantBaseline: "central",
            fontWeight: "700",
            fill: inkColor,
            ...(withNum ? { text: formatCount(grade), "data-num": dataNum(grade) } : { text: `G${grade}` }),
          }),
        );
      }

      function drawValuePill(doc, g, { cx, cy, minX, maxX, children, approxChars, bg, border, fg }) {
        const pw = Math.max(38, Math.round(approxChars * 7.4 + 12));
        const ph = 19;
        const x = Math.min(maxX - pw / 2, Math.max(minX + pw / 2, cx));
        g.append(
          svgEl(doc, "rect", {
            x: x - pw / 2,
            y: cy - ph / 2,
            width: pw,
            height: ph,
            rx: 3.5,
            fill: bg,
            stroke: border,
            strokeWidth: 1,
          }),
          svgEl(doc, "text", {
            x,
            y: cy,
            textAnchor: "middle",
            dominantBaseline: "central",
            fontWeight: "600",
            fill: fg,
          }, ...children),
        );
      }

      function drawZ(state, m) {
        const z = Array.from(m.flags.z);
        const G = Math.max(...m.grade);
        const zmax = Math.max(P.zMin, state.crit * 1.35, ...z.map(Math.abs)) * P.zPad;
        const width = slotWidth(zSlot);
        const rowH = width < 360 ? 64 : 84;
        const height = P.marginTop + P.marginBottom + CONFIG.units.length * rowH;
        const innerW = Math.max(1, width - P.marginLeft - P.marginRight);
        const critPx = (state.crit / (2 * zmax)) * innerW;
        const xTicks = critPx >= 36
          ? [-state.crit, 0, state.crit]
          : [-Math.round(zmax * 0.65), 0, Math.round(zmax * 0.65)];
        const rows = CONFIG.units.map((u, i) => ({
          u,
          z: z[i],
          label: m.flags.labels[i],
          grade: m.grade[i],
        }));
        const zones = [
          { x1: state.crit, x2: zmax, word: T.zoneAbove },
          { x1: -zmax, x2: -state.crit, word: T.zoneBelow },
        ];

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
          keyboard: {
            data: rows,
            x: "z",
            y: "u",
            sort: false,
            pointer: true,
            label: T.zAlt,
            title: (d) => `${d.u}: z ${zText(d.z)}, ${T.flagWords[d.label]}, grade ${d.grade}.`,
          },
          alt: T.zAlt,
          width,
          height,
          marginTop: P.marginTop,
          marginBottom: P.marginBottom,
          marginLeft: P.marginLeft,
          marginRight: P.marginRight,
          x: { domain: [-zmax, zmax], ticks: xTicks, label: T.zAxis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: CONFIG.units.slice(), label: null, tickSize: 0, padding: P.yPadding },
          marks: (c, Pl) => {
            const gCols = gradeColors(G, c);
            return [
              Pl.rectX(zones, { x1: "x1", x2: "x2", fill: c.plotGrid }),
              Pl.ruleX([state.crit, -state.crit], { stroke: c.plotAxis, strokeDasharray: P.cutDash }),
              Pl.ruleX([0], { stroke: c.plotAxis, strokeDasharray: P.refDash }),
              Pl.dot(rows, {
                x: "z",
                y: "u",
                r: 0,
                render(index, scales, values, dims) {
                  const g = svgEl(ctx.doc, "g");
                  const x0 = scales.x(0);
                  const minX = dims.marginLeft + 2;
                  const maxX = dims.width - dims.marginRight - 2;
                  // Top zone headers clamped safely within SVG bounds
                  const belowMid = (scales.x(-zmax) + scales.x(-state.crit)) / 2;
                  const aboveMid = (scales.x(state.crit) + scales.x(zmax)) / 2;
                  g.append(
                    svgEl(ctx.doc, "text", {
                      x: Math.max(46, Math.min(x0 - 48, belowMid)),
                      y: 12,
                      textAnchor: "middle",
                      dominantBaseline: "central",
                      fill: c.plotMuted,
                      text: T.zoneBelow,
                    }),
                    svgEl(ctx.doc, "text", {
                      x: Math.min(dims.width - 46, Math.max(x0 + 48, aboveMid)),
                      y: 12,
                      textAnchor: "middle",
                      dominantBaseline: "central",
                      fill: c.plotMuted,
                      text: T.zoneAbove,
                    }),
                  );

                  const pts = Array.from(index, (idx) => ({
                    idx,
                    row: rows[idx],
                    px: Math.min(maxX, Math.max(minX, values.x[idx])),
                    py: values.y[idx],
                  }));

                  if (m.against.count > 0 && pts.length === 2) {
                    g.append(svgEl(ctx.doc, "line", {
                      x1: pts[0].px,
                      y1: pts[0].py,
                      x2: pts[1].px,
                      y2: pts[1].py,
                      stroke: c.err,
                      strokeWidth: 2,
                      strokeDasharray: "4 3",
                    }));
                  }

                  for (const pt of pts) {
                    const gFill = gCols[pt.row.grade - 1];
                    g.append(
                      svgEl(ctx.doc, "line", {
                        x1: x0,
                        y1: pt.py,
                        x2: pt.px,
                        y2: pt.py,
                        stroke: gFill,
                        strokeWidth: 2.5,
                        strokeOpacity: 0.55,
                      }),
                      svgEl(ctx.doc, "circle", {
                        cx: pt.px,
                        cy: pt.py,
                        r: P.dot,
                        fill: gFill,
                        stroke: c.plotBg,
                        strokeWidth: 1.5,
                      }),
                    );
                    const zStr = zText(pt.row.z);
                    drawValuePill(ctx.doc, g, {
                      cx: pt.px,
                      cy: pt.py + P.labelDy,
                      minX,
                      maxX,
                      approxChars: 4 + zStr.length,
                      bg: c.plotBg,
                      border: c.plotGrid,
                      fg: c.plotFg,
                      children: [
                        "z",
                        svgEl(ctx.doc, "tspan", { dy: 3, fontSize: "9.5px", text: pt.row.u }),
                        svgEl(ctx.doc, "tspan", { dy: -3, text: " = " }),
                        svgEl(ctx.doc, "tspan", { text: zStr, "data-num": dataNum(pt.row.z) }),
                      ],
                    });
                    drawGradePill(ctx.doc, g, {
                      cx: dims.width - dims.marginRight / 2 + 4,
                      cy: pt.py,
                      grade: pt.row.grade,
                      fillColor: gFill,
                      inkColor: labelOn(gFill, c),
                      strokeColor: c.plotBg,
                    });
                  }
                  return g;
                },
              }),
            ];
          },
        });

        // Method disclosure formula with current numbers
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

      function drawEst(state, m) {
        const G = Math.max(...m.grade);
        const rows = CONFIG.units.map((u, i) => ({
          u,
          est: m.est[i],
          se: m.se[i],
          lo: m.est[i] - state.crit * m.se[i],
          hi: m.est[i] + state.crit * m.se[i],
          grade: m.grade[i],
        }));
        const lo = Math.min(CONFIG.pairRef, ...rows.map((r) => r.lo));
        const hi = Math.max(CONFIG.pairRef, ...rows.map((r) => r.hi));
        const pad = Math.max(P.pad, (hi - lo) * P.pad);
        const width = slotWidth(estSlot);
        const rowH = width < 360 ? 64 : 84;
        const height = P.marginTop + P.marginBottom + rows.length * rowH;

        plot(estSlot, {
          table: {
            caption: T.estTable,
            columns: [
              { label: "Unit", value: "u" },
              { label: "Estimate", value: "est", format: (v) => formatSetting(v) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              { label: "Bar from", value: "lo", format: (v) => safeDecimal(v, CONFIG.digits.est) },
              { label: "Bar to", value: "hi", format: (v) => safeDecimal(v, CONFIG.digits.est) },
            ],
            rows,
          },
          keyboard: {
            data: rows,
            x: "est",
            y: "u",
            sort: false,
            pointer: true,
            label: T.estAlt,
            title: (d) => `${d.u}: estimate ${formatSetting(d.est)}, SE ${formatSetting(d.se)}, bar ${safeDecimal(d.lo, 3)} to ${safeDecimal(d.hi, 3)}.`,
          },
          alt: T.estAlt,
          width,
          height,
          marginTop: P.marginTop,
          marginBottom: P.marginBottom,
          marginLeft: P.marginLeft,
          marginRight: P.marginRight,
          x: { domain: [lo - pad, hi + pad], label: T.estAxis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: CONFIG.units.slice(), label: null, tickSize: 0, padding: P.yPadding },
          marks: (c, Pl) => {
            const gCols = gradeColors(G, c);
            return [
              Pl.ruleX([CONFIG.pairRef], { stroke: c.plotAxis, strokeDasharray: P.refDash }),
              Pl.ruleY(rows, { y: "u", x1: "lo", x2: "hi", stroke: c.plotFg, strokeWidth: P.bar }),
              Pl.dot(rows, {
                x: "est",
                y: "u",
                r: 0,
                render(index, scales, values, dims) {
                  const g = svgEl(ctx.doc, "g");
                  const minX = dims.marginLeft + 2;
                  const maxX = dims.width - dims.marginRight - 2;
                  const refX = Math.min(maxX - 28, Math.max(minX + 28, scales.x(CONFIG.pairRef)));
                  g.append(svgEl(ctx.doc, "text", {
                    x: refX,
                    y: 12,
                    textAnchor: "middle",
                    dominantBaseline: "central",
                    fill: c.plotMuted,
                    text: T.reference,
                  }));

                  const pts = Array.from(index, (idx) => ({
                    idx,
                    row: rows[idx],
                    px: values.x[idx],
                    py: values.y[idx],
                    xLo: scales.x(rows[idx].lo),
                    xHi: scales.x(rows[idx].hi),
                  }));

                  if (m.against.count > 0 && pts.length === 2) {
                    g.append(svgEl(ctx.doc, "line", {
                      x1: pts[0].px,
                      y1: pts[0].py,
                      x2: pts[1].px,
                      y2: pts[1].py,
                      stroke: c.err,
                      strokeWidth: 2,
                      strokeDasharray: "4 3",
                    }));
                  }

                  for (const pt of pts) {
                    const gFill = gCols[pt.row.grade - 1];
                    for (const capX of [pt.xLo, pt.xHi]) {
                      g.append(svgEl(ctx.doc, "line", {
                        x1: capX,
                        y1: pt.py - 4.5,
                        x2: capX,
                        y2: pt.py + 4.5,
                        stroke: c.plotFg,
                        strokeWidth: 2,
                      }));
                    }
                    g.append(svgEl(ctx.doc, "circle", {
                      cx: pt.px,
                      cy: pt.py,
                      r: P.dot,
                      fill: c.est,
                      stroke: c.plotBg,
                      strokeWidth: 1.5,
                    }));
                    const estStr = formatSetting(pt.row.est);
                    const seStr = formatSetting(pt.row.se);
                    drawValuePill(ctx.doc, g, {
                      cx: pt.px,
                      cy: pt.py + P.labelDy,
                      minX,
                      maxX,
                      approxChars: 7 + estStr.length + seStr.length,
                      bg: c.plotBg,
                      border: c.plotGrid,
                      fg: c.plotFg,
                      children: [
                        `${pt.row.u}: `,
                        svgEl(ctx.doc, "tspan", { text: estStr, "data-num": dataNum(pt.row.est) }),
                        " (SE ",
                        svgEl(ctx.doc, "tspan", { text: seStr, "data-num": dataNum(pt.row.se) }),
                        ")",
                      ],
                    });
                    drawGradePill(ctx.doc, g, {
                      cx: dims.width - dims.marginRight / 2 + 4,
                      cy: pt.py,
                      grade: pt.row.grade,
                      fillColor: gFill,
                      inkColor: labelOn(gFill, c),
                      strokeColor: c.plotBg,
                    });
                  }
                  return g;
                },
              }),
            ];
          },
        });
      }

      function drawPairCallout(m) {
        if (m.against.count > 0) {
          const aboveU = CONFIG.units[m.above];
          const belowU = CONFIG.units[m.below];
          pairCallout.setAttribute("data-tone", "reversal");
          pairCallout.replaceChildren(
            `Dashed connector: wider SE ranks ${aboveU} above ${belowU}’s larger estimate.`,
          );
        } else if (m.stated) {
          const aboveU = CONFIG.units[m.above];
          const belowU = CONFIG.units[m.below];
          pairCallout.setAttribute("data-tone", "neutral");
          pairCallout.replaceChildren(
            `Aligned scales: Unit ${aboveU} leads ${belowU} on both z and estimate.`,
          );
        } else {
          pairCallout.setAttribute("data-tone", "neutral");
          pairCallout.replaceChildren(
            "Shared flag zone: both units receive the same grade (pair withheld).",
          );
        }
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
          errorLine.replaceChildren(
            `Under the ${state.prior === "flat" ? "flat-prior posterior" : "teaching posterior"}, the stated direction ${CONFIG.units[m.above]} above ${CONFIG.units[m.below]} is wrong with probability `,
            ro("error", m.error, formatReadoutProb(m.error)),
            ".",
            ...(state.prior === "teaching" ? [
              " The posterior means are ",
              ro("meanA", m.post.mean[0], formatReadoutEst(m.post.mean[0])),
              " for A and ",
              ro("meanB", m.post.mean[1], formatReadoutEst(m.post.mean[1])),
              " for B; the flags do not change.",
            ] : []),
          );
        } else {
          errorLine.replaceChildren(T.noStatement);
        }

        pairTiles.replaceChildren(
          tile("Pairs stated, N", [ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", ev.M, formatCount(ev.M))]),
          tile("Expected wrong directions, E", [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile("E/N", [ro("EoverN", ev.EoverN[0], formatShare(ev.EoverN[0]))]),
          tile("Expected loss per pair (risk)", [ro("risk", ev.risk, formatReadoutRisk(ev.risk)), " (exact ", ctx.num(ev.risk, formatRisk(ev.risk)), ")"]),
          tile("Stated directions that run against the estimates", [ro("against", m.against.count, formatCount(m.against.count)), " of ", ctx.num(ev.N, formatCount(ev.N))]),
        );

        const allW = evaluateReport([1, 1], m.E, { tau: state.tau });
        pairReference.replaceChildren(
          "At τ = ",
          ro("tau", state.tau, formatSetting(state.tau)),
          ", withholding the pair instead has risk ",
          ro("allWithheld", allW.risk, formatReadoutRisk(allW.risk)),
          " (exact ",
          ctx.num(allW.risk, formatRisk(allW.risk)),
          "), which equals τ (",
          captionNode(ctx, "fixed-report"),
          ").",
        );

        const unitAuditRows = CONFIG.units.map((u, i) => ({
          unit: u,
          est: m.est[i],
          se: m.se[i],
          lo: m.est[i] - state.crit * m.se[i],
          hi: m.est[i] + state.crit * m.se[i],
          z: m.flags.z[i],
          flag: T.flagWords[m.flags.labels[i]],
          grade: m.grade[i],
          postMean: m.post.mean[i],
          postSd: m.post.sd[i],
        }));
        pairExactTableHost.replaceChildren(renderDataTable(ctx, {
          caption: "Exact unit estimates, intervals, z-scores, flags, and posterior summaries",
          columns: [
            { key: "unit", label: "Unit", rowHeader: true, name: true },
            { key: "est", label: "Estimate", kind: "setting" },
            { key: "se", label: "SE", kind: "setting" },
            { key: "lo", label: "Bar low", kind: "decimal", digits: 4 },
            { key: "hi", label: "Bar high", kind: "decimal", digits: 4 },
            { key: "z", label: "z", kind: "decimal", digits: 2 },
            { key: "flag", label: "Flag" },
            { key: "grade", label: "Grade", kind: "count" },
            { key: "postMean", label: "Post. mean", kind: "decimal", digits: 4 },
            { key: "postSd", label: "Post. SD", kind: "decimal", digits: 4 },
          ],
          rows: unitAuditRows,
        }));
      }

      // ------------------------------------------------------------------------------------- drawing: league

      const Lg = CONFIG.league;

      function drawRows(state, m, c) {
        const G = Math.max(...m.grade);
        const marked = new Set(m.against.units);
        const rows = ORDER.map((i) => ({
          i,
          id: IDS[i],
          est: EST[i],
          se: SE[i],
          z: m.flags.z[i],
          label: m.flags.labels[i],
          grade: m.grade[i],
          lo: EST[i] - state.crit * SE[i],
          hi: EST[i] + state.crit * SE[i],
          marked: marked.has(i),
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
        const orderedIds = ORDER.map((i) => IDS[i]);
        const badgeAnchors = gradeBadgeAnchors(rows, G);

        const width = slotWidth(rowsSlot);
        const narrow = width < 360;
        // Each interval is an individually inspectable unit, including on touchscreens.
        const rowH = narrow ? Lg.narrowRowHeight : Lg.rowHeight;
        const mTop = narrow ? 22 : Lg.marginTop;
        const mBottom = narrow ? 42 : Lg.marginBottom;
        const xTicks = (narrow ? [-0.5, 0, 0.5] : Lg.ticks).filter((t) => t >= x0 && t <= x1);

        plot(rowsSlot, {
          table: {
            caption: T.rowsTable,
            columns: [
              { label: "Unit", value: "id" },
              { label: "Estimate", value: "est", format: (v) => safeDecimal(v, CONFIG.digits.est) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              { label: "z", value: "z", format: (v) => zText(v) },
              { label: "Flag", value: (d) => T.flagWords[d.label] },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
              { label: "Placed below a unit with a smaller estimate", value: (d) => (d.marked ? "yes" : "no") },
            ],
            rows,
          },
          width,
          height: mTop + mBottom + rows.length * rowH,
          marginTop: mTop,
          marginBottom: mBottom,
          marginLeft: Lg.marginLeft,
          marginRight: Lg.marginRight,
          x: {
            domain: [x0, chipHi],
            ticks: xTicks,
            label: T.estAxis,
            labelAnchor: "center",
            labelArrow: "none",
            ...(narrow ? { labelOffset: 34 } : {}),
          },
          y: { domain: orderedIds, ticks: orderedIds, label: null, tickSize: 3, padding: Lg.yPadding },
          marks: (cc, Pl) => [
            Pl.barX(rows.filter((r) => r.marked), { x1: x0, x2: x1, y: "id", fill: cc.neutral[1] }),
            Pl.ruleX([REF], { stroke: cc.plotAxis, strokeDasharray: Lg.dash }),
            Pl.text([REF], { x: (d) => d, frameAnchor: "top", dy: -mTop + 4, lineAnchor: "top", text: () => T.reference, fill: cc.plotFg }),
            Pl.ruleY(rows, { y: "id", x1: "lo", x2: "hi", stroke: cc.plotFg, strokeWidth: Lg.bar }),
            Pl.tickX(rows, { x: "est", y: "id", stroke: cc.est, strokeWidth: 3, inset: 1 }),
            Pl.barX(chips, { x1: chipLo, x2: chipHi, y: "id", fill: "fill", inset: Lg.chipInset }),
            // PR-03: 17px-tall rounded badge pills placed via placeDirectLabels (mapped by item.id per WA-02)
            Pl.dot(badgeAnchors, {
              x: () => (chipLo + chipHi) / 2,
              y: "unitId",
              r: 0,
              render(index, scales, values, dims) {
                const g = svgEl(ctx.doc, "g");
                const bw = typeof scales.y?.bandwidth === "function" ? scales.y.bandwidth() : (scales.y?.bandwidth ?? 0);
                const rawItems = Array.from(index, (idx) => {
                  const anch = badgeAnchors[idx];
                  const yStart = scales.y ? scales.y(anch.startId) : values.y[idx];
                  const yEnd = scales.y ? scales.y(anch.endId) : values.y[idx];
                  const centerRunY = Number.isFinite(yStart) && Number.isFinite(yEnd) ? (yStart + yEnd + bw) / 2 : values.y[idx];
                  return {
                    id: anch.id,
                    grade: anch.grade,
                    x: values.x[idx],
                    y: centerRunY,
                    height: 17,
                  };
                });
                const placed = placeDirectLabels(rawItems, {
                  minGapPx: 18,
                  minY: dims.marginTop + 9,
                  maxY: dims.height - dims.marginBottom - 9,
                });
                const byId = new Map(placed.map((p) => [p.id, p]));
                for (const item of rawItems) {
                  const p = byId.get(item.id) ?? item;
                  const fillCol = grades[item.grade - 1];
                  const inkCol = labelOn(fillCol, cc);
                  const pw = 22;
                  const ph = 17;
                  const cx = Math.min(dims.width - pw / 2 - 1, p.x);
                  g.append(
                    svgEl(ctx.doc, "rect", {
                      x: cx - pw / 2,
                      y: p.y - ph / 2,
                      width: pw,
                      height: ph,
                      rx: 3,
                      fill: fillCol,
                      stroke: cc.plotBg,
                      strokeWidth: 1.5,
                    }),
                    svgEl(ctx.doc, "text", {
                      x: cx,
                      y: p.y,
                      textAnchor: "middle",
                      dominantBaseline: "central",
                      fontWeight: "700",
                      fill: inkCol,
                      text: formatCount(item.grade),
                      "data-num": dataNum(item.grade),
                    }),
                  );
                }
                return g;
              },
            }),
          ],
          keyboard: {
            data: rows,
            x: "est",
            y: "id",
            sort: false,
            pointer: true,
            label: T.rowsAlt,
            title: (d) => `${d.id}: estimate ${safeDecimal(d.est, CONFIG.digits.est)}, SE ${formatSetting(d.se)}, z ${zText(d.z)}, ${T.flagWords[d.label]}, grade ${d.grade}${d.marked ? "; placed below a unit with a smaller estimate" : ""}.`,
          },
        });
      }

      function drawMatrix(m) {
        const Mx = CONFIG.matrix;
        const avail = slotWidth(matrixSlot);
        const compact = avail < 360;
        const left = compact ? 36 : Mx.marginLeft;
        const right = compact ? 14 : Mx.marginRight;
        const top = compact ? 22 : Mx.marginTop;
        const bottom = compact ? 4 : Mx.marginBottom;
        const minC = compact ? 7 : Mx.minCell;
        const cell = Math.max(minC, Math.min(Mx.maxCell, Math.floor((avail - left - right) / N_UNITS)));
        const width = left + right + N_UNITS * cell;
        const height = top + bottom + N_UNITS * cell;
        matrixSlot.style.maxWidth = `${width}px`;
        const ids = ORDER.map((i) => IDS[i]);
        const sparseIds = Lg.sparseRanks.map((k) => ids[k]).filter(Boolean);
        const cells = [];
        for (const i of ORDER) {
          for (const j of ORDER) {
            if (i === j) continue;
            const r = m.rel[i][j];
            const against = (r === -1 && POSITION.get(i) < POSITION.get(j)) || (r === 1 && POSITION.get(i) > POSITION.get(j));
            cells.push({ row: IDS[i], col: IDS[j], rel: r, against });
          }
        }
        const rows = m.against.pairs.map((p) => ({
          above: IDS[p.above],
          below: IDS[p.below],
          estAbove: EST[p.above],
          estBelow: EST[p.below],
          error: m.E.e[0][p.above][p.below],
        }));

        plot(matrixSlot, {
          keyboard: {
            data: cells,
            x: "col",
            y: "row",
            sort: false,
            pointer: true,
            label: T.matrixAlt,
            title: (d) => `${d.row} relative to ${d.col}: ${d.rel === 1 ? T.relAbove : d.rel === -1 ? T.relBelow : T.relWithheld}${d.against ? "; runs against the estimates" : ""}.`,
          },
          alt: T.matrixAlt,
          table: {
            caption: T.matrixTable,
            columns: [
              { label: "Stated above", value: "above" },
              { label: "Its estimate", value: "estAbove", format: (v) => safeDecimal(v, CONFIG.digits.est) },
              { label: "Stated below", value: "below" },
              { label: "Its estimate", value: "estBelow", format: (v) => safeDecimal(v, CONFIG.digits.est) },
              { label: "Error of the stated direction", value: "error", format: (v) => formatProb(v) },
            ],
            rows,
          },
          width,
          height,
          marginTop: top,
          marginLeft: left,
          marginRight: right,
          marginBottom: bottom,
          x: { domain: ids, ticks: sparseIds, padding: 0, axis: "top", tickSize: 3, label: null },
          y: { domain: ids, ticks: sparseIds, padding: 0, tickSize: 3, label: null },
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
          tile("Flagged above · not flagged · flagged below", [
            ro("above", k1, formatCount(k1)),
            " · ",
            ro("none", k2, formatCount(k2)),
            " · ",
            ro("below", k3, formatCount(k3)),
          ]),
          tile("Pairs stated, N", [ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", M_LEAGUE, formatCount(M_LEAGUE))]),
          tile("Expected wrong directions, E", [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile("E/N", [ro("EoverN", ev.EoverN[0], formatShare(ev.EoverN[0]))]),
          tile("Expected loss per pair (risk)", [
            ro("risk", ev.risk, formatReadoutRisk(ev.risk)),
            " (exact ",
            ctx.num(ev.risk, formatRisk(ev.risk)),
            ")",
          ]),
        );

        const example = m.against.pairs[0];
        if (example) {
          const { above, below } = example;
          leagueWitness.replaceChildren(h("strong", {}, IDS[above] + " above " + IDS[below]), " by the flags. Their estimates are ",
            ctx.num(EST[above], formatReadoutEst(EST[above])), " and ", ctx.num(EST[below], formatReadoutEst(EST[below])),
            "; the flat-prior error is ", ctx.num(m.E.e[0][above][below], formatReadoutProb(m.E.e[0][above][below])), ".");
        } else {
          leagueWitness.textContent = "Every direction the flags state follows the order of the estimates.";
        }
        const names = m.against.units.map((i) => IDS[i]);
        leagueLines.replaceChildren(
          h("p", {},
            "At τ = ",
            ro("tau", state.tau, formatSetting(state.tau)),
            ", E/N = ",
            ctx.num(ev.EoverN[0], formatShare(ev.EoverN[0])),
            " beside τ; withholding every pair has risk ",
            ro("allWithheld", m.allW.risk, formatReadoutRisk(m.allW.risk)),
            " (exact ",
            ctx.num(m.allW.risk, formatRisk(m.allW.risk)),
            "; ",
            captionNode(ctx, "fixed-report"),
            ")."),
          h("p", {},
            "Largest error of a stated direction: ",
            ro("maxstated", m.stated.max, m.stated.max === null ? "NA" : formatReadoutProb(m.stated.max)),
            ". Stated directions more likely wrong than right (error above one half): ",
            ro("overhalf", m.overHalf.count, formatCount(m.overHalf.count)),
            "."),
          h("p", {},
            "Stated directions that run against the estimates: ",
            ro("against", m.against.count, formatCount(m.against.count)),
            " of ",
            ctx.num(ev.N, formatCount(ev.N)),
            ". Units placed below some unit with a smaller estimate: ",
            ro("againstUnits", names.length, formatCount(names.length)),
            ...(names.length ? [" (", ...names.flatMap((nm, k) => [k ? ", " : "", h("span", { "data-prx-name": "", text: nm })]), ")"] : []),
            "."),
          h("p", {},
            "Reference: the mean of the ",
            ctx.num(N_UNITS, formatCount(N_UNITS)),
            " estimates, ",
            ro("ref", REF, safeDecimal(REF, CONFIG.digits.ref)),
            "; league ",
            T.seedWords,
            " ",
            ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
            "."),
        );

        const revRows = m.against.pairs.map((p) => ({
          above: IDS[p.above],
          estAbove: EST[p.above],
          below: IDS[p.below],
          estBelow: EST[p.below],
          error: m.E.e[0][p.above][p.below],
        }));
        leagueAgainstTableHost.replaceChildren(renderDataTable(ctx, {
          caption: "Reversed pairs: stated directions that run against the estimates",
          emptyText: "No stated direction runs against the estimates at this cutoff.",
          columns: [
            { key: "above", label: "Stated above", rowHeader: true, name: true },
            { key: "estAbove", label: "Above est.", kind: "decimal", digits: 4 },
            { key: "below", label: "Stated below", name: true },
            { key: "estBelow", label: "Below est.", kind: "decimal", digits: 4 },
            { key: "error", label: "Error prob.", kind: "decimal", digits: 4 },
          ],
          rows: revRows,
        }));

        const markedSet = new Set(m.against.units);
        const unitRows = ORDER.map((i, rankIdx) => ({
          rank: rankIdx + 1,
          id: IDS[i],
          est: EST[i],
          se: SE[i],
          z: m.flags.z[i],
          flag: T.flagWords[m.flags.labels[i]],
          grade: m.grade[i],
          reversed: markedSet.has(i) ? "yes" : "no",
        }));
        leagueUnitsTableHost.replaceChildren(renderDataTable(ctx, {
          caption: "All thirty league units sorted by estimate",
          columns: [
            { key: "id", label: "Unit", rowHeader: true, name: true },
            { key: "rank", label: "Est. rank", kind: "count" },
            { key: "est", label: "Estimate", kind: "decimal", digits: 4 },
            { key: "se", label: "SE", kind: "setting" },
            { key: "z", label: "z", kind: "decimal", digits: 2 },
            { key: "flag", label: "Flag" },
            { key: "grade", label: "Grade", kind: "count" },
            { key: "reversed", label: "Reversed?" },
          ],
          rows: unitRows,
        }));
      }

      function drawReadout(state, pm, lm) {
        if (!isPairView) {
          const ev = lm.ev;
          ctx.readout.set([
            "Cutoff ",
            ctx.num(state.crit, formatSetting(state.crit)),
            " (groups ",
            ctx.num(lm.counts[0], formatCount(lm.counts[0])),
            ", ",
            ctx.num(lm.counts[1], formatCount(lm.counts[1])),
            ", ",
            ctx.num(lm.counts[2], formatCount(lm.counts[2])),
            "): states ",
            ctx.num(ev.N, formatCount(ev.N)),
            " of ",
            ctx.num(M_LEAGUE, formatCount(M_LEAGUE)),
            " pairs (E/N = ",
            ctx.num(ev.EoverN[0], formatShare(ev.EoverN[0])),
            ", risk ",
            ctx.num(ev.risk, formatReadoutRisk(ev.risk)),
            " at τ = ",
            ctx.num(state.tau, formatSetting(state.tau)),
            ", all-withheld ",
            ro("result-allWithheld", lm.allW.risk, formatReadoutRisk(lm.allW.risk)),
            "); ",
            ctx.num(lm.against.count, formatCount(lm.against.count)),
            " reverse estimates",
            ...(lm.stated.max !== null ? [", max error ", ctx.num(lm.stated.max, formatReadoutProb(lm.stated.max))] : []),
            ".",
          ]);
          return;
        }

        const zSpan = (i) => ctx.num(pm.flags.z[i], formatReadoutEst(pm.flags.z[i]));
        const gSpan = (i) => ro(`result-grade-${CONFIG.units[i]}`, pm.grade[i], formatCount(pm.grade[i]));
        if (!pm.stated) {
          ctx.readout.set([
            "Cutoff ",
            ctx.num(state.crit, formatSetting(state.crit)),
            ": A (z = ",
            zSpan(0),
            ", grade ",
            gSpan(0),
            ") and B (z = ",
            zSpan(1),
            ", grade ",
            gSpan(1),
            ") share a flag; ",
            ctx.num(pm.ev.N, formatCount(pm.ev.N)),
            " pairs stated, risk ",
            ctx.num(pm.ev.risk, formatReadoutRisk(pm.ev.risk)),
            " at τ = ",
            ctx.num(state.tau, formatSetting(state.tau)),
            ".",
          ]);
          return;
        }

        const above = CONFIG.units[pm.above];
        const below = CONFIG.units[pm.below];
        const aboveIdx = pm.above;
        const belowIdx = pm.below;
        if (state.prior === "teaching") {
          ctx.readout.set([
            "Cutoff ",
            ctx.num(state.crit, formatSetting(state.crit)),
            `: ${above} (z = `,
            zSpan(aboveIdx),
            ", grade ",
            gSpan(aboveIdx),
            `) ranks above ${below} (z = `,
            zSpan(belowIdx),
            ", grade ",
            gSpan(belowIdx),
            "); teaching means ",
            ctx.num(pm.post.mean[0], formatReadoutEst(pm.post.mean[0])),
            " and ",
            ctx.num(pm.post.mean[1], formatReadoutEst(pm.post.mean[1])),
            " give error ",
            ctx.num(pm.error, formatReadoutProb(pm.error)),
            ", risk ",
            ctx.num(pm.ev.risk, formatReadoutRisk(pm.ev.risk)),
            ".",
          ]);
          return;
        }

        ctx.readout.set([
          "Cutoff ",
          ctx.num(state.crit, formatSetting(state.crit)),
          `: ${above} (z = `,
          zSpan(aboveIdx),
          ", grade ",
          gSpan(aboveIdx),
          `) ranks above ${below} (z = `,
          zSpan(belowIdx),
          ", grade ",
          gSpan(belowIdx),
          pm.against.count ? `) despite ${below}’s larger estimate; flat-prior error ` : "); flat-prior error ",
          ctx.num(pm.error, formatReadoutProb(pm.error)),
          ", risk ",
          ctx.num(pm.ev.risk, formatReadoutRisk(pm.ev.risk)),
          ".",
        ]);
      }

      return {
        render(state, info) {
          // PR-06 / PR-09: disclosures contain eager HTML tables/math only; toggling <details> must not re-render stage or readout.
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            crit.set(state.crit);
            prior.set(state.prior);
            tau.set(state.tau);
            for (const [k, s] of sliders) s.set(state[k]);
            ctx.root.setAttribute("data-prx-view", mode);
            const c = palette(ctx.root);
            let pm = null;
            let lm = null;
            if (isPairView) {
              pm = pairModel(state);
              drawZ(state, pm);
              drawEst(state, pm);
              drawPairCallout(pm);
              drawResult(pm, c);
              drawError(state, pm);
              leagueTiles.replaceChildren();
              leagueLines.replaceChildren();
            } else {
              for (const n of [resultLine, errorLine, pairTiles, pairReference]) n.replaceChildren();
              lm = leagueModel(state);
              drawMatrix(lm);
              drawRows(state, lm, c);
              drawLeagueReadouts(state, lm);
            }
            drawReadout(state, pm, lm);
            const words = fill(T.priorWords[state.prior], wordSlots);
            if (typeof words[0] === "string") words[0] = words[0].charAt(0).toLowerCase() + words[0].slice(1);
            if (state.prior === "teaching") {
              captionLine.replaceChildren("Posterior used for the errors: ", ...words, " (", captionNode(ctx, "teaching-posterior"), "). Independent units.");
            } else {
              captionLine.replaceChildren("Posterior used for the errors: ", captionNode(ctx, "flat-posterior"), ". Independent units.");
            }
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}

export function mountWidget(el, spec = {}) { return mountFlags(el, spec, "pair"); }
