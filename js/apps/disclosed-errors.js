// App entry point for 2.8 disclosed-errors ("How often are stated directions wrong?") — Frame v2 upgrade.
// Preserves 100% of ../shared/domain/disclosed-errors.js re-exports untouched for 2.9 reported-and-realized,
// while overriding mountWidget with frame: "v2": compact primary controls (Example segmented, Report select, τ slider)
// + wrapping presets + Settings disclosure, concise <= 35-word 3-sig-fig readout preserving the G2-F6 three-statement
// optimality distinction, clean zero-placeholder first-load stage pairing the [data-prx-primary] pair-error matrix with
// 3-sig-fig summary tiles, draw controls, and [data-prx-bound] badge row, and complete exact tables/formulas in Data and Method.
import { mobileControls } from "../shared/mobile-controls.js";
import {
  CONFIG,
  blocksText,
  countsOf,
  createDrawControls,
  drawTrueValueStrip,
  drawsOf,
  finiteCoupling,
  parseCap,
  parseGrades,
  reportOf,
} from "../shared/domain/disclosed-errors.js";
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatEoverN,
  formatGrades,
  formatProb,
  formatRational,
  formatReadoutExpected,
  formatReadoutProb,
  formatReadoutRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { captionNode, exposeResult, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  disclosure,
  evaluateReport,
  exactOptimum,
  familySize,
  finiteLawPairwise,
  realizedWrong,
  relations,
  runningMean,
  statedAbove,
  summaryStats,
  wrongCountDistribution,
} from "../pr-core.js";
import { THREE_UNIT_ERRORS, THREE_UNIT_LAW } from "../shared/three-unit-law.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export * from "../shared/domain/disclosed-errors.js";

const T = CONFIG.text;
const MX = CONFIG.matrix;
const SVGNS = "http://www.w3.org/2000/svg";
const L3 = THREE_UNIT_LAW;

function sixErrors() {
  const a = SIX.arrays[CONFIG.six.array];
  return {
    ids: a.ids.slice(),
    criteria: a.criteria.slice(),
    e: a.e.map((m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)))),
  };
}

const UNITS = SIX.tables.units;
const LAWS = Object.freeze({
  six: Object.freeze({
    key: "six",
    ids: Object.freeze(UNITS.id.slice()),
    E: sixErrors(),
    means: UNITS.mean_A.slice(),
    sds: UNITS.sd_A.slice(),
    unitWord: "site",
  }),
  finite: Object.freeze({
    key: "finite",
    ids: L3.ids,
    unitWord: "unit",
    E: THREE_UNIT_ERRORS,
  }),
});

const familyOf = (law, cap) => (law === "six" && cap !== CONFIG.cap.none ? { kind: "atMost", G: cap } : { kind: "all" });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const finiteErrors = new Map();
function finiteLawFor(u = 0) {
  const joint = finiteCoupling(u);
  if (u !== 0 && !finiteErrors.has(u)) {
    finiteErrors.set(u, finiteLawPairwise(joint.states, joint.probs, { ids: L3.ids, criteria: THREE_UNIT_ERRORS.criteria }));
  }
  return { ...LAWS.finite, joint, E: u === 0 ? THREE_UNIT_ERRORS : finiteErrors.get(u) };
}

const optCache = new Map();
function optimumOf(law, cap, tau, coupling = 0) {
  const key = `${law}|${cap}|${tau}|${law === "finite" ? coupling : 0}`;
  if (!optCache.has(key)) {
    if (optCache.size >= 128) optCache.delete(optCache.keys().next().value);
    optCache.set(
      key,
      exactOptimum(law === "finite" ? finiteLawFor(coupling).E : LAWS[law].E, { tau, family: familyOf(law, cap) }),
    );
  }
  return optCache.get(key);
}

function exact(v) {
  try {
    return formatRational(v);
  } catch {
    return formatReadoutRisk(v);
  }
}

const safeDec = (v, digits) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

const READOUT_CLAUSES = Object.freeze({
  applies: "; E ≤ τN guaranteed (optimum with all-withheld).",
  holds: Object.freeze({
    notInFamily: "; E ≤ τN holds here but is not guaranteed (outside family).",
    noAllWithheld: "; E ≤ τN holds here but is not guaranteed (no all-withheld).",
    notOptimum: "; E ≤ τN holds here but is not guaranteed (not family optimum).",
  }),
  fails: "; E > τN: worse than withholding every pair.",
});

const V2_CSS = `
.prx-de .prx-stage > *,
.prx-de .prx-stage .prx-de-main > * {
  grid-area: auto;
  min-width: 0;
}
.prx-widget.prx-de[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.9rem;
  align-items: flex-end;
}
.prx-de .prx-de-law {
  flex: 0 1 auto;
  min-width: 0;
}
.prx-de .prx-de-report {
  display: flex;
  flex: 0 1 15.5rem;
  min-width: 0;
}
.prx-de .prx-de-report > .prx-select {
  flex: 1 1 auto;
  min-width: 0;
}
.prx-de .prx-de-report select {
  width: 100%;
  max-width: 100%;
}
.prx-widget.prx-de[data-prx-frame="v2"] .prx-controls > .prx-slider {
  flex: 1 1 12.5rem;
  max-width: 16.5rem;
}
.prx-de .prx-de-settings > summary {
  min-width: 12.5em;
}
.prx-de .prx-de-grades {
  display: flex;
  flex: 1 1 24rem;
  flex-wrap: wrap;
  gap: 0.3rem 0.7rem;
  min-width: 0;
  padding: 0;
  border: 0;
}
.prx-de .prx-de-grades > legend {
  flex: 1 1 100%;
}
.prx-de .prx-de-grades .prx-select {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 0.3rem;
  align-items: center;
  width: auto;
  margin: 0;
}
.prx-de .prx-de-grades .prx-select > label {
  margin: 0;
}
.prx-de .prx-de-family {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}
.prx-de .prx-de-family > legend {
  flex: 1 1 100%;
}
.prx-de .prx-de-seed {
  flex: 0 0 auto;
  width: auto;
}
.prx-de .prx-de-seed input {
  width: 7em;
}

.prx-de .prx-stage .prx-de-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem 1.25rem;
  align-items: start;
  min-width: 0;
}
@media (min-width: 52rem) {
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-main {
    grid-template-columns: minmax(min(100%, 20rem), auto) minmax(min(100%, 19rem), 1fr);
  }
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-main[data-has-draws="false"] {
    align-items: center;
  }
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-area-matrix {
    grid-column: 1;
  }
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-area-result {
    grid-column: 2;
  }
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-area-draw,
  .prx-de[data-prx-frame="v2"] .prx-stage .prx-de-area-bound {
    grid-column: 1 / -1;
  }
}

.prx-de .prx-stage .prx-de-heading {
  margin: 0 0 0.3rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--prx-plot-fg);
}
.prx-de .prx-de-panel,
.prx-de .prx-de-side,
.prx-de .prx-de-sub,
.prx-de .prx-de-chart,
.prx-de .prx-de-matrix,
.prx-de .prx-de-thisdraw {
  min-width: 0;
  max-width: 100%;
  margin: 0;
}
.prx-de .prx-stage .prx-de-side {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.prx-de .prx-stage .prx-de-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 7.4rem), 1fr));
  gap: 0.45rem;
}
.prx-de .prx-stage .prx-de-tile {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.3rem 0.45rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-radius: 6px;
}
.prx-de .prx-stage .prx-de-tile-name {
  font-size: 0.78rem;
  line-height: 1.25;
  color: var(--prx-plot-muted);
}
.prx-de .prx-stage .prx-de-tile-value {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-fg);
  overflow-wrap: anywhere;
}
.prx-de .prx-stage .prx-de-tile-note,
.prx-de .prx-stage .prx-de-event-note {
  font-size: 0.76rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--prx-plot-muted);
}
.prx-de .prx-stage .prx-de-event-note {
  display: block;
  margin-top: 0.1rem;
}
.prx-de .prx-stage .prx-de-tile-pending {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--prx-plot-muted);
}
.prx-de .prx-stage .prx-de-mc-note {
  display: grid;
}
.prx-de .prx-stage .prx-de-mc-note > span,
.prx-de .prx-stage .prx-de-mc-note::after {
  grid-area: 1 / 1;
}
.prx-de .prx-stage .prx-de-mc-note::after {
  content: attr(data-prx-other);
  visibility: hidden;
}

.prx-de .prx-stage .prx-de-coupling {
  margin: 0.5rem 0 0;
}
.prx-de .prx-stage .prx-de-coupling .prx-slider {
  max-width: 24rem;
}
.prx-de .prx-stage .prx-de-coupling-result {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-fg);
}

.prx-de .prx-stage .prx-de-draws {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.prx-de .prx-de-draw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.65rem;
  align-items: center;
  margin: 0;
}
.prx-de .prx-de-draw-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.prx-de .prx-de-seedtag {
  font-size: 0.8125rem;
  color: var(--prx-fg-muted);
  font-variant-numeric: tabular-nums;
}

.prx-de .prx-stage .prx-de-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.65rem;
  margin: 0.3rem 0 0;
  padding: 0.28rem 0.45rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
  border-radius: 5px;
}
.prx-de .prx-stage .prx-de-key {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  min-width: 0;
}
.prx-de .prx-stage .prx-de-swatch {
  flex: none;
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border: 1px solid var(--prx-cell-border);
}
.prx-de .prx-stage .prx-de-swatch-hatch {
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 5px);
}
.prx-de .prx-stage .prx-de-swatch-dot {
  background: var(--prx-grade-1);
  border-radius: 50%;
}
.prx-de .prx-stage .prx-de-swatch-cross {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  line-height: 1;
  background: var(--prx-plot-bg);
  border: 2px solid var(--prx-plot-fg);
}
.prx-de .prx-stage .prx-de-swatch-line {
  height: 0;
  border: 0;
  border-top: 2px solid var(--prx-plot-fg);
}
.prx-de .prx-stage .prx-de-swatch-rule {
  height: 0;
  border: 0;
  border-top: 2px dashed var(--prx-err);
}

.prx-de .prx-stage .prx-de-drawline,
.prx-de .prx-stage .prx-de-summary {
  margin: 0.2rem 0 0;
  font-size: 0.875rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
  overflow-wrap: anywhere;
}
.prx-de .prx-stage .prx-de-thetas {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
  font-variant-numeric: tabular-nums;
}
.prx-de .prx-stage .prx-de-note,
.prx-de .prx-de-note {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  line-height: 1.35;
  color: var(--prx-fg-muted);
}
.prx-de .prx-stage .prx-de-caption {
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  font-style: italic;
  color: var(--prx-plot-muted);
}

.prx-de .prx-stage .prx-de-boundrow {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: flex-start;
  padding-top: 0.3rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.prx-de .prx-stage .prx-de-bound {
  width: 100%;
  min-width: 0;
}
.prx-de .prx-stage .prx-de-bound > p {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
}
.prx-de .prx-stage .prx-de-bound > .prx-de-badge {
  margin-top: 0;
  padding: 0.35rem 0.55rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
  border-left: 3px solid var(--prx-plot-fg);
  border-radius: 5px;
}
.prx-de .prx-stage .prx-de-bound > .prx-de-badge.prx-de-badge-no {
  border-left-color: var(--prx-cell-border);
}
.prx-de .prx-de-why {
  margin: 0.35rem 0;
  border-color: var(--prx-border);
}
.prx-de .prx-de-why > summary {
  min-height: 2.25rem;
  padding: 0.3rem 0;
  font-size: 0.875rem;
}
.prx-de .prx-de-why .prx-disclosure-body > p {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
}
.prx-de .prx-de-why .prx-disclosure-body > p:first-child {
  margin-top: 0;
}

.prx-de .prx-de-table {
  width: 100%;
  margin: 0.35rem 0 0.65rem;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
.prx-de .prx-de-table caption {
  caption-side: top;
  padding: 0 0 0.25rem;
  text-align: left;
  font-weight: 600;
  color: var(--prx-fg-muted);
}
.prx-de .prx-de-table th,
.prx-de .prx-de-table td {
  padding: 0.25rem 0.55rem 0.25rem 0;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}
.prx-de .prx-de-table td {
  text-align: right;
}
.prx-de .prx-de-table td.prx-de-textcell,
.prx-de .prx-de-table td.prx-de-lastcell {
  text-align: left;
}
.prx-de .prx-de-table td.prx-de-lastcell {
  font-style: italic;
  white-space: nowrap;
}
.prx-de .prx-de-table tr.prx-de-last th,
.prx-de .prx-de-table tr.prx-de-last td {
  font-weight: 600;
}
.prx-de .prx-de-formula {
  max-width: 100%;
  overflow-x: auto;
  margin: 0.4rem 0;
}
.prx-de .prx-de-best p {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
}
.prx-de .prx-de-label {
  color: var(--prx-fg-muted);
}

@media (pointer: coarse), (max-width: 48em) {
  .prx-de .prx-de-why > summary {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
@media (max-width: 48em) {
  .prx-widget.prx-de[data-prx-frame="v2"] {
    padding: 0.45rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-title {
    margin-bottom: 0.3rem;
    font-size: 1rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    width: 100%;
    gap: 0.3rem 0.55rem;
  }
  .prx-de .prx-de-law,
  .prx-de .prx-de-report,
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-controls > .prx-slider {
    flex: 1 1 100%;
    max-width: none;
  }
  .prx-de .prx-de-law .prx-seg-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-presets {
    width: 100%;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    display: none;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-presets .prx-seg,
  .prx-de .prx-de-law .prx-seg {
    padding: 0.15rem 0.35rem;
    font-size: 0.77rem;
    line-height: 1.15;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.3;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] .prx-stage {
    padding: 0.4rem 0.45rem;
  }
  .prx-de .prx-stage .prx-de-main {
    gap: 0.5rem;
  }
  .prx-de .prx-stage .prx-de-side {
    gap: 0.45rem;
  }
  .prx-de .prx-stage .prx-de-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
  }
  .prx-de .prx-stage .prx-de-tile {
    padding: 0.28rem 0.38rem;
  }
  .prx-de .prx-stage .prx-de-tile[data-na="true"] {
    grid-column: span 2;
  }
  .prx-de .prx-stage .prx-de-tile-name {
    font-size: 0.74rem;
  }
  .prx-de .prx-stage .prx-de-tile-value {
    font-size: 0.95rem;
  }
  .prx-de .prx-de-draw-row {
    flex: 1 1 100%;
  }
  .prx-de .prx-de-draw-buttons {
    gap: 0.3rem;
  }
  .prx-de .prx-de-draw-buttons .prx-btn {
    padding-inline: 0.42rem;
    font-size: 0.8rem;
  }
  .prx-de .prx-stage .prx-de-legend {
    padding: 0.2rem 0.35rem;
    font-size: 0.76rem;
    gap: 0.15rem 0.5rem;
  }
  .prx-widget.prx-de[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.45rem;
    gap: 0.35rem;
  }
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    frame: "v2",
    css: V2_CSS,
    keys: {
      law: { type: "choice", values: CONFIG.laws.slice(), value: CONFIG.law },
      grades: { type: "custom", parse: (v) => parseGrades(v), value: CONFIG.grades.value.slice() },
      cap: { type: "custom", parse: (v) => parseCap(v), value: CONFIG.cap.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      draws: { type: "integer", min: CONFIG.draws.min, max: CONFIG.draws.max, value: CONFIG.draws.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      coupling: { type: "number", min: 0, max: L3.probs[3], step: 0.005, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const hatchId = uid("prx-de-hatch");
      const tauHintId = uid("prx-de-tau-hint");

      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const tauNode = (tau) => ctx.num(tau, formatSetting(tau));
      const gradeNum = (g, name) => (name ? ro(name, g.slice(), formatGrades(g)) : ctx.num(g.slice(), formatGrades(g)));
      const tauNText = (v, law) => {
        if (law === "finite") return exact(v);
        if (v === 0) return "0";
        const d = CONFIG.digits;
        const one = Math.abs(v * 10 ** d.tauN - Math.round(v * 10 ** d.tauN)) < CONFIG.tauNTolerance;
        return formatDecimal(v, { digits: one ? d.tauN : d.tauNFine });
      };
      const eRoText = (v, law) => (law === "finite" ? exact(v) : formatReadoutExpected(v));
      const enText = (v, law) => (v === null || v === undefined ? formatEoverN(null) : law === "finite" ? exact(v) : formatShare(v));
      const probRoText = (v, law) => (law === "finite" ? exact(v) : formatReadoutProb(v));
      const riskRoText = (v, law) => (law === "finite" ? exact(v) : formatReadoutRisk(v));
      const matrixErrText = (v, law) => (law === "finite" ? exact(v) : formatProb(v));

      // --- Primary controls: Example segmented, Report select, τ slider
      let settings = null;
      const lawSeg = ctx.segmented({
        label: T.lawLegend,
        name: "law",
        className: "prx-de-law",
        options: [
          { value: "six", label: "Six sites (normal)" },
          { value: "finite", label: "Three-unit law" },
        ],
        value: ctx.state.law,
        onChange: (v) => ctx.set({ law: v, grades: Array.from(CONFIG.starts[v]), draws: 0 }),
      });

      const reportMenus = {};
      const gradeBoxes = {};
      for (const key of CONFIG.laws) {
        const law = LAWS[key];
        const options = CONFIG.named[key].map((g) => ({ value: g.join(","), label: `${blocksText(g, law.ids)}` }));
        options.push({ value: "custom", label: "Your own" });
        reportMenus[key] = ctx.select({
          label: T.reportLabel,
          name: `report-${key}`,
          options,
          value: CONFIG.starts[key].join(","),
          onChange: (v) => {
            if (v === "custom") {
              if (settings && !settings.open) settings.open = true;
              return;
            }
            if (v) ctx.set({ grades: v.split(",").map(Number) });
          },
        });
        ctx.primaryControl(reportMenus[key].input);
        const n = law.ids.length;
        const selects = law.ids.map((id, i) =>
          ctx.select({
            label: id,
            name: `grade-${key}-${id}`,
            options: Array.from({ length: n }, (_, k) => ({ value: k + 1, label: String(k + 1) })),
            value: CONFIG.starts[key][i],
            onChange: (v) => {
              const rep = reportOf(ctx.state);
              const raw = rep.g.slice();
              raw[i] = v;
              ctx.set({ grades: raw });
            },
          }),
        );
        for (const [i, s] of selects.entries()) s.input.setAttribute("aria-label", `${T.gradeOf} ${law.ids[i]}`);
        const box = h("fieldset", { class: "prx-control prx-de-grades" }, h("legend", {}, T.gradesLegend), ...selects.map((s) => s.root));
        gradeBoxes[key] = { box, selects };
      }

      const famSizes = {
        all: familySize(LAWS.six.ids.length, { kind: "all" }),
        cap: familySize(LAWS.six.ids.length, { kind: "atMost", G: CONFIG.cap.capped }),
      };
      const familyRadio = ctx.radioGroup({
        legend: T.familyLegend,
        name: "cap",
        className: "prx-de-family",
        options: [
          { value: CONFIG.cap.none, label: [`${T.familyAll}, `, ctx.num(famSizes.all, formatCount(famSizes.all)), ` ${T.reports}`] },
          {
            value: CONFIG.cap.capped,
            label: [
              `${T.familyCap} `,
              ctx.num(CONFIG.cap.capped, formatCount(CONFIG.cap.capped)),
              ` ${T.familyCapEnd}, `,
              ctx.num(famSizes.cap, formatCount(famSizes.cap)),
              ` ${T.reports}`,
            ],
          },
        ],
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });

      const tau = ctx.slider({
        label: T.tauSlider,
        ...ctx.key("tau"),
        format: formatSetting,
        onInput: (v) => ctx.set({ tau: v }),
      });
      tau.input.setAttribute("aria-describedby", tauHintId);

      const { row: drawRow, note: drawNote, one: btnOne, many: btnMany, clear: btnReset, seed } = createDrawControls(ctx);
      const seedTag = h("span", { class: "prx-de-seedtag" });
      (drawRow.querySelector(".prx-de-draw-buttons") ?? drawRow).append(seedTag);
      const reportBox = h("div", { class: "prx-de-report" }, reportMenus.six.root, reportMenus.finite.root);
      ctx.controls.append(lawSeg.root, reportBox, tau.root, drawRow, drawNote);

      settings = ctx.settingsBox(T.settingsSix, { className: "prx-de-settings" });
      seed.root.classList.add("prx-de-seed");
      settings.body.append(gradeBoxes.six.box, gradeBoxes.finite.box, familyRadio.root, seed.root);

      // --- Stage: [data-prx-primary] matrix, persistent 3-sig-fig tiles + coupling + draw charts, current draw (hidden at S=0), bound row
      ctx.stage.removeAttribute("data-prx-primary");
      const matrixSlot = ctx.primaryGraphic(h("div", { class: "prx-de-matrix" }));
      const matrixLegend = h("div", { class: "prx-de-legend", "data-prx-part": "legend" });
      const matrixPanel = h(
        "section",
        { class: "prx-de-panel prx-de-area-matrix", "aria-label": T.matrixHeading, "data-prx-part": "chart" },
        matrixSlot,
        matrixLegend,
      );

      const tiles = h("div", { class: "prx-de-tiles", "data-prx-part": "readout" });
      const tileEls = {};
      const tile = (key, name) => {
        const value = h("span", { class: "prx-de-tile-value" });
        const root = h("div", { class: "prx-de-tile" }, h("span", { class: "prx-de-tile-name", text: name }), value);
        tileEls[key] = { root, value };
        return root;
      };
      tiles.append(
        tile("N", "Stated pairs N"),
        tile("E", "Expected wrong E"),
        tile("EN", "Expected share E/N"),
        tile("allRight", "All stated right"),
        tile("union", "Union lower bound"),
        tile("tau", "Cost τ"),
      );

      const coupling = ctx.slider({
        label: "Coupling shift u",
        ...ctx.key("coupling"),
        format: (v) => formatDecimal(v, { digits: 3 }),
        onInput: (u) => ctx.set({ coupling: u }),
      });
      const couplingValue = h("strong");
      const couplingResult = h("p", { class: "prx-de-coupling-result" }, "Exact all-right probability: ", couplingValue);
      coupling.output.after(couplingResult);
      const couplingBox = h("div", { class: "prx-de-coupling" }, coupling.root);
      const resultsPanel = h("section", { class: "prx-de-panel", "aria-label": T.resultsHeading }, tiles, couplingBox);

      const histSlot = h("div", { class: "prx-de-chart" });
      const histEvent = h("p", { class: "prx-de-summary", "data-prx-part": "readout" });
      const histSub = h("div", { class: "prx-de-sub", hidden: true }, h("h4", { class: "prx-de-heading", text: T.histHeading }), histSlot, histEvent);

      const runSlot = h("div", { class: "prx-de-chart" });
      const runLegend = h(
        "div",
        { class: "prx-de-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-line" }), T.runKeyLine),
        h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-rule" }), T.runKeyE),
      );
      const drawsSummary = h("p", { class: "prx-de-summary", "data-prx-part": "readout", hidden: true });
      const mcCaption = h("p", { class: "prx-de-caption", "data-prx-part": "caption", hidden: true });
      const runSub = h("div", { class: "prx-de-sub", hidden: true }, h("h4", { class: "prx-de-heading", text: T.runHeading }), runSlot, runLegend);

      const drawsPanel = h(
        "section",
        { class: "prx-de-panel prx-de-draws", "aria-label": T.runHeading, "data-prx-part": "chart", hidden: true },
        histSub,
        runSub,
        drawsSummary,
        mcCaption,
      );
      const resultCol = h("div", { class: "prx-de-side prx-de-area-result" }, resultsPanel, drawsPanel);

      const drawLine = h("p", { class: "prx-de-drawline", "data-prx-part": "readout" });
      const stripSlot = h("div", { class: "prx-de-chart" });
      const stripKey = h(
        "div",
        { class: "prx-de-legend", "data-prx-part": "legend" },
        h("span", {}, T.stripKey[0], ctx.num(CONFIG.six.spread, formatCount(CONFIG.six.spread)), T.stripKey[1]),
      );
      const thisDraw = h(
        "div",
        { class: "prx-de-thisdraw prx-de-area-draw", hidden: true },
        h("h4", { class: "prx-de-heading", text: T.drawHeading }),
        drawLine,
        stripSlot,
        stripKey,
      );

      const boundBox = h("div", { class: "prx-de-bound", "data-prx-part": "readout" });
      const badgeLine = h("p", { class: "prx-de-badge" });
      const diagLine = h("p", {});
      const why = ctx.disclosure({ name: "why", title: T.whyTitle, placement: "none", className: "prx-de-why" });
      boundBox.append(badgeLine, diagLine);
      const bestBtn = ctx.button({
        label: T.useBest,
        key: "use-best",
        onClick: () => {
          const o = optimumOf(ctx.state.law, ctx.state.cap, ctx.state.tau, ctx.state.coupling);
          if (!o.empty) ctx.set({ grades: Array.from(o.grade) });
        },
      });
      const boundRow = h("div", { class: "prx-de-boundrow prx-de-area-bound" }, boundBox, bestBtn.root);

      const mainGrid = h("div", { class: "prx-de-main" }, matrixPanel, resultCol, thisDraw, boundRow);
      ctx.stage.append(mainGrid);

      // --- Data and exact values disclosure
      const dataBox = ctx.dataBox("Data and exact values");
      const sixUnitsTableSlot = h("div");
      const sixPairsTableSlot = h("div");
      const sixDataWrap = h("div", {}, sixUnitsTableSlot, sixPairsTableSlot);

      const lawHeading = ctx.panelTitle(T.lawTableHeading);
      const lawTableSlot = h("div", { class: "prx-de-law-table" });
      ctx.scrollRegion(lawTableSlot, "Finite-law order table");
      const pairErrors = h("p", { class: "prx-de-note" });
      const finiteDataWrap = h("div", {}, lawHeading, lawTableSlot, pairErrors);
      dataBox.body.append(sixDataWrap, finiteDataWrap);

      // --- Method and details disclosure
      const methodBox = ctx.methodBox("Method and details");
      const best = h("div", { class: "prx-de-best" });
      const tauHintEl = h(
        "p",
        { id: tauHintId, class: "prx-de-note", "data-prx-part": "notes" },
        "A wrong stated direction costs ",
        ctx.num(1, formatCount(1)),
        "; staying silent on one pair costs τ. E and E/N do not depend on τ.",
      );
      const eventNote = h("p", { class: "prx-de-note" });
      const lawFormula = h("div", { class: "prx-de-formula", "data-prx-tex": "law-E" });
      const drawsLeadNote = h("p", { class: "prx-de-note" }, T.drawsLead);
      const matrixDetailNote = h(
        "p",
        { class: "prx-de-note" },
        "Six fictional sites from the postrank tutorial, score A (independent normal posteriors), and the three-unit finite law from the postrank theory book, chapter 10. Withheld cells share a grade without claiming equality.",
      );
      methodBox.body.append(why.root, best, tauHintEl, eventNote, lawFormula, drawsLeadNote, matrixDetailNote);

      ctx.caption.replaceChildren(
        "Six fictional sites and a three-unit finite law (",
        captionNode(ctx, "teaching-posterior"),
        "; ",
        captionNode(ctx, "fixed-report"),
        ").",
      );

      // --- Render helpers

      function drawMatrix(rep, rel, wrong, hasDraws) {
        const { n, g, law } = rep;
        const ids = law.ids;
        const e0 = law.E.e[0];
        matrixSlot.style.maxWidth = "";
        const stageW = mainGrid.clientWidth || ctx.stage.clientWidth || ctx.width();
        const twoCol = Boolean(ctx.win?.matchMedia?.("(min-width: 52rem)")?.matches) && stageW > 640;
        const slotW = matrixSlot.clientWidth;
        const rawAvail = twoCol
          ? Math.max(slotW, stageW - 332)
          : slotW || Math.min(stageW, 86 * n + MX.marginLeft + MX.marginRight);
        const maxCell = n <= 3 ? 86 : 64;
        const avail = Math.min(rawAvail, maxCell * n + MX.marginLeft + MX.marginRight);
        const cell = Math.max(MX.minCell, Math.min(maxCell, Math.floor((avail - MX.marginLeft - MX.marginRight) / n)));
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
        const relWords = (d) =>
          d.rel === 1
            ? `the report states ${d.row} above ${d.col}, wrong with probability ${matrixErrText(d.e, law.key)}${d.wrong ? "; wrong in this draw" : ""}`
            : d.rel === -1
              ? `the report states ${d.col} above ${d.row}`
              : `the report withholds this pair (${d.row} and ${d.col} share grade ${g[d.i]})`;

        const columns = [
          { label: "Pair", value: (r) => (r.rel === 0 ? `${ids[r.a]} and ${ids[r.b]}` : `${ids[r.a]} above ${ids[r.b]}`) },
          { label: "The report", value: (r) => (r.rel === 0 ? "withholds the pair" : "states this direction") },
          { label: "Error of the stated direction", value: (r) => r.e, format: (v) => (v === null ? "none: withheld" : matrixErrText(v, law.key)) },
          { label: "Wrong in this draw", value: (r) => (r.rel === 0 ? "withheld" : r.wrong ? "yes" : "no") },
        ];

        plot(matrixSlot, {
          alt: T.matrixAlt,
          table: { caption: T.matrixTable, columns, rows: pairs },
          width,
          height,
          marginTop: MX.marginTop,
          marginLeft: MX.marginLeft,
          marginRight: MX.marginRight,
          marginBottom: MX.marginBottom,
          x: { domain: ids.slice(), padding: 0, axis: "top", label: null, tickSize: 0 },
          y: { domain: ids.slice(), padding: 0, label: null, tickSize: 0 },
          color: { type: "identity" },
          marks: (c, P) => {
            const fillOf = (d) => (d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld);
            const filled = cells.map((d) => ({ ...d, fill: fillOf(d), ink: labelOn(fillOf(d), c) }));
            const aboveAll = filled.filter((d) => d.rel === 1);
            const aboveClean = aboveAll.filter((d) => !d.wrong);
            const aboveWrong = aboveAll.filter((d) => d.wrong);
            const below = filled.filter((d) => d.rel === -1);
            const withheld = filled.filter((d) => d.rel === 0);
            const wrongCells = filled.filter((d) => d.wrong);
            const colors = gradeColors(G, c);
            const dots = diag.map((d) => ({ ...d, fill: colors[d.grade - 1], ink: labelOn(colors[d.grade - 1], c) }));
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({
                id: hatchId,
                patternUnits: "userSpaceOnUse",
                width: MX.hatchSpacing,
                height: MX.hatchSpacing,
                patternTransform: "rotate(45)",
              })) {
                pat.setAttribute(k, String(v));
              }
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: MX.hatchSpacing, stroke: c.hatch, "stroke-width": MX.hatchWidth })) {
                line.setAttribute(k, String(v));
              }
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            const symbolSize = Math.max(13, Math.round(cell * MX.symbolShare));
            const crossSize = Math.max(13, Math.round(cell * 0.25));
            const fmtCell = (v) => (law.key === "finite" ? exact(v) : formatProb(v, { bounds: "symbols" }));
            return [
              P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, inset: MX.inset }),
              P.cell(filled, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: MX.inset }),
              hatch,
              P.cell(withheld, { x: "col", y: "row", fill: `url(#${hatchId})`, inset: MX.inset }),
              P.text(below, { x: "col", y: "row", text: () => "<", fill: "ink", fontWeight: MX.labelWeight, fontSize: symbolSize }),
              aboveClean.length
                ? numText(aboveClean, {
                    x: "col",
                    y: "row",
                    value: "e",
                    format: fmtCell,
                    fill: "ink",
                    stroke: "fill",
                    strokeWidth: MX.labelHalo,
                    paintOrder: "stroke",
                    fontSize: 13,
                  })
                : null,
              aboveWrong.length
                ? numText(aboveWrong, {
                    x: "col",
                    y: "row",
                    value: "e",
                    format: fmtCell,
                    dy: 5,
                    fill: "ink",
                    stroke: "fill",
                    strokeWidth: MX.labelHalo,
                    paintOrder: "stroke",
                    fontSize: 13,
                  })
                : null,
              wrongCells.length ? P.cell(wrongCells, { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: MX.wrongWidth, inset: MX.wrongInset }) : null,
              wrongCells.length
                ? P.text(wrongCells, {
                    x: "col",
                    y: "row",
                    text: () => "✕",
                    dx: Math.round(cell * 0.29),
                    dy: -Math.round(cell * 0.29),
                    fill: c.plotFg,
                    stroke: c.plotBg,
                    strokeWidth: MX.labelHalo,
                    paintOrder: "stroke",
                    fontWeight: MX.labelWeight,
                    fontSize: crossSize,
                  })
                : null,
              P.dot(dots, { x: "col", y: "row", r: cell * MX.dotShare, fill: "fill", stroke: c.plotBg }),
              numText(dots, { x: "col", y: "row", value: "grade", format: (v) => formatCount(v), fill: "ink", fontSize: 13 }),
            ];
          },
          keyboard: {
            data: every,
            x: "col",
            y: "row",
            key: (d) => `${d.row}${d.col}`,
            sort: false,
            columns: n,
            label: T.matrixAlt,
            title: (d) => (d.diagonal ? `Row ${d.row}, column ${d.col}: the same ${law.unitWord}, in grade ${d.grade}.` : `Row ${d.row}, column ${d.col}: ${relWords(d)}.`),
          },
        });

        const keys = [
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch", style: { background: "var(--prx-rel-above)" } }), "row > col (error)"),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-hatch" }), "withheld"),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch", style: { background: "var(--prx-rel-below)" } }), "row < col"),
          h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-dot" }), "grade"),
        ];
        if (hasDraws) {
          keys.push(h("span", { class: "prx-de-key" }, h("span", { class: "prx-de-swatch prx-de-swatch-cross", text: "✕" }), "wrong in draw"));
        }
        matrixLegend.replaceChildren(...keys);
      }

      function renderCurrentDraw(rep, state, rw, last, theta) {
        const S = state.draws;
        thisDraw.hidden = S === 0;
        stripSlot.hidden = rep.law.key === "finite" || S === 0;
        stripKey.hidden = stripSlot.hidden;
        if (S === 0 || !rw) {
          drawLine.replaceChildren();
          return;
        }
        const appendValues = () => {
          if (rep.law.key === "finite") return;
          const rows = drawTrueValueStrip(ctx, stripSlot, rep, theta, rw.pairs[0]);
          const vals = rows.flatMap((r, i) => [
            i ? ", " : "",
            `${r.id} `,
            ro(`theta.${r.id}`, r.theta, safeDec(r.theta, CONFIG.digits.theta)),
          ]);
          drawLine.append(h("span", { class: "prx-de-thetas" }, " Drawn values: ", ...vals, "."));
        };
        const N = rw.N;
        const k = rw.D[0];
        const head = ["Draw ", ro("drawIndex", S, formatCount(S)), " of ", ctx.num(S, formatCount(S)), ": "];
        const joint = rep.law.joint ?? L3;
        if (rep.law.key === "finite") {
          head.push("the order ", joint.orders[last].split("").join(" > "), " (probability ", ctx.num(joint.probs[last], exact(joint.probs[last])), "). ");
        }
        if (N === 0) {
          drawLine.replaceChildren(
            ...head,
            rep.law.key === "finite" ? "Nothing" : "nothing",
            " is stated, so nothing can be wrong; the share is ",
            ro("lastShare", null, formatEoverN(null)),
            ".",
          );
          appendValues();
          return;
        }
        const wrongWords = rw.pairs[0].map((p) => `${rep.law.ids[p.i]} above ${rep.law.ids[p.j]}`);
        const shareV = rw.DoverN[0];
        drawLine.replaceChildren(
          ...head,
          ro("last", k, formatCount(k)),
          " of the ",
          ctx.num(N, formatCount(N)),
          ` stated directions ${k === 1 ? "is" : "are"} wrong (share in this draw `,
          ro("lastShare", shareV, rep.law.key === "finite" ? exact(shareV) : formatShare(shareV)),
          ")",
          wrongWords.length ? `: ${wrongWords.join(", ")}.` : ".",
        );
        appendValues();
      }

      const MC_NOTES = Object.freeze({ none: "Draw to estimate", some: "Monte Carlo estimate" });
      const mcNote = (S) =>
        h("span", { class: "prx-de-event-note prx-de-mc-note", "data-prx-other": S ? MC_NOTES.none : MC_NOTES.some }, h("span", {}, S ? MC_NOTES.some : MC_NOTES.none));

      function drawTiles(rep, ev, tauV, event, S) {
        const lawKey = rep.law.key;
        const EN = ev.EoverN[0];
        const enValue =
          EN === null
            ? [ro("EoverN", null, formatEoverN(null)), h("span", { class: "prx-de-tile-note" }, " (N/M = ", ctx.num(ev.s, formatCount(ev.s)), ": ", T.naNote, ")")]
            : [ro("EoverN", EN, enText(EN, lawKey))];
        tileEls.N.value.replaceChildren(ro("N", ev.N, formatCount(ev.N)), " of ", ro("M", ev.M, formatCount(ev.M)));
        tileEls.E.value.replaceChildren(ro("E", ev.Ew, eRoText(ev.Ew, lawKey)));
        tileEls.EN.root.setAttribute("data-na", EN === null ? "true" : "false");
        tileEls.EN.value.replaceChildren(...enValue);
        const six = lawKey === "six" && ev.N > 0;
        tileEls.allRight.root.hidden = !event;
        tileEls.allRight.value.replaceChildren(
          ...(event
            ? [
                ro("allRight", event.pNone, probRoText(event.pNone, lawKey)),
                six ? mcNote(S) : h("span", { class: "prx-de-event-note" }, ev.N === 0 ? "vacuous" : "exact"),
              ]
            : []),
        );
        tileEls.union.root.hidden = lawKey !== "finite";
        if (lawKey === "finite") {
          tileEls.union.value.replaceChildren(ro("unionLower", event.unionBound, exact(event.unionBound)));
          couplingValue.replaceChildren(ctx.num(event.pNone, exact(event.pNone)));
        } else {
          tileEls.union.value.replaceChildren();
          couplingValue.replaceChildren();
        }
        tileEls.tau.value.replaceChildren(ro("tau", tauV, formatSetting(tauV)));

        if (ev.N === 0) {
          eventNote.replaceChildren(
            "The all-right event has probability ",
            ctx.num(event.pNone, formatReadoutProb(event.pNone)),
            " because it makes no assertions. E/N remains ",
            ctx.num(null, formatEoverN(null)),
            ".",
          );
        } else if (lawKey === "finite") {
          eventNote.replaceChildren(
            "E/N averages errors across stated pairs. The all-right event requires every statement to hold together; its union lower bound is max(",
            ctx.num(0, formatCount(0)),
            ", ",
            ctx.num(1, formatCount(1)),
            " − E). The coupling control changes this joint event while keeping the pair probabilities fixed.",
          );
        } else {
          eventNote.replaceChildren(
            ...(S
              ? [
                  "All-right probability is estimated from ",
                  ctx.num(S, formatCount(S)),
                  " draws of independent normal latent values; it is not an exact normal-law calculation. The finite-law mode gives an exact event probability and union bound.",
                ]
              : ["Draw independent normal latent values to estimate the all-right event. The finite-law mode gives an exact event probability and union bound."]),
          );
        }
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
        const holds = ev.risk <= tauV + CONFIG.riskTolerance;
        const reason = !inFamily ? "notInFamily" : !opt.empty && !opt.containsAllWithheld ? "noAllWithheld" : "notOptimum";

        boundBox.setAttribute("data-prx-bound", applies ? "applies" : "not-shown");
        diagLine.setAttribute("data-prx-diagnostic", holds ? "holds" : "fails");
        diagLine.replaceChildren(
          "Risk R = ",
          ro("diagnosticRisk", ev.risk, riskRoText(ev.risk, lawKey)),
          holds ? " ≤ τ = " : " > τ = ",
          tauNode(tauV),
          "; E = ",
          ro("diagnosticE", ev.Ew, eRoText(ev.Ew, lawKey)),
          holds ? " ≤ τN = " : " > τN = ",
          ro("diagnosticTauN", tauN, tauNText(tauN, lawKey)),
          ".",
        );

        const lines = [];
        badgeLine.setAttribute("data-prx-badge", applies ? "applies" : holds ? "holds" : "fails");
        if (applies) {
          badgeLine.className = "prx-de-badge";
          badgeLine.replaceChildren(h("strong", {}, `${T.boundYes} `), tagNode(ctx, opt), " (includes all-withheld).");
          if (ev.N === 0) {
            lines.push(
              h(
                "p",
                {},
                "Here nothing is stated: E = ",
                ro("boundE", ev.Ew, eRoText(ev.Ew, lawKey)),
                " and τN = ",
                ro("tauN", tauN, tauNText(tauN, lawKey)),
                ", and the share E/N is ",
                ro("boundEN", null, formatEoverN(null)),
                ".",
              ),
            );
          } else {
            lines.push(
              h(
                "p",
                {},
                "Here E = ",
                ro("boundE", ev.Ew, eRoText(ev.Ew, lawKey)),
                " ≤ τN = ",
                tauNode(tauV),
                " × ",
                ctx.num(ev.N, formatCount(ev.N)),
                " = ",
                ro("tauN", tauN, tauNText(tauN, lawKey)),
                ", so E/N = ",
                ro("boundEN", EN, enText(EN, lawKey)),
                " ≤ τ = ",
                tauNode(tauV),
                ".",
              ),
            );
            const over =
              sa.count > 0
                ? [" The largest error among this report's stated directions is ", ro("maxStated", sa.max, probRoText(sa.max, lawKey)), ", above τ."]
                : [" The largest error among this report's stated directions is ", ro("maxStated", sa.max, probRoText(sa.max, lawKey)), "."];
            lines.push(h("p", { class: "prx-de-caution" }, T.boundAverage, ...over));
          }
        } else {
          badgeLine.className = "prx-de-badge prx-de-badge-no";
          badgeLine.replaceChildren(
            ...(holds
              ? [h("strong", {}, T.badgeHolds), ` ${T.badgeReason[reason].replace(/\.$/, "")} (not a bound).`]
              : [h("strong", {}, T.badgeFails), ` ${T.badgeFailsEnd.replace(/\.$/, "")} (not a bound).`]),
          );
          const whyText = reason === "notInFamily" ? T.notInFamily : reason === "noAllWithheld" ? T.noAllWithheld : T.notOptimum;
          lines.push(
            h(
              "p",
              { class: "prx-de-sidebyside" },
              h("strong", {}, `${T.boundNo} `),
              ...(EN === null
                ? ["E/N is ", ro("boundEN", null, formatEoverN(null)), " (nothing is stated); τ = ", tauNode(tauV), "."]
                : ["E/N = ", ro("boundEN", EN, enText(EN, lawKey)), " and τ = ", tauNode(tauV), "."]),
            ),
          );
          lines.push(h("p", {}, whyText));
          if (ev.N > 0) {
            const r = ro("ownRisk", ev.risk, riskRoText(ev.risk, lawKey));
            lines.push(
              h(
                "p",
                { class: "prx-de-own", "data-prx-own": holds ? "holds" : "fails" },
                ...(holds ? [`${T.holdsOwn} `, r, ` ${T.holdsOwnEnd}`] : [`${T.failsOwn} `, r, ` ${T.failsOwnEnd}`]),
              ),
            );
          }
        }
        why.body.replaceChildren(...lines);

        if (opt.empty) {
          best.replaceChildren(h("p", {}, "The family shown is empty."));
          bestBtn.root.hidden = true;
          return { applies, isOpt, holds, reason };
        }
        const optima = opt.grades.map((x) => Array.from(x));
        const items = optima.flatMap((x, k) => [k ? " or " : "", blocksText(x, rep.law.ids), " (", ro(`optimum${k}`, x, formatGrades(x)), ")"]);
        const label = ["This is the ", labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated)`];
        if (opt.tieCount > 1) {
          label.push("; ", ctx.num(opt.tieCount, formatCount(opt.tieCount)), " reports share the smallest risk; the read-outs list them");
        }
        label.push(`. ${T.tolerance} `, ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`);
        best.replaceChildren(
          h("p", {}, h("strong", {}, optima.length > 1 ? "Best reports in the family shown at this τ: " : "Best report in the family shown at this τ: "), ...items, "."),
          h("p", { class: "prx-de-label" }, ...label),
        );
        bestBtn.root.hidden = isOpt;
        return { applies, isOpt, holds, reason };
      }

      function renderCompactHistogram(counts, N) {
        const H = CONFIG.hist;
        const top = N < H.minBins ? N : Math.max(H.minBins - 1, Math.min(N, Math.max(0, ...counts)));
        const bins = Array.from({ length: top + 1 }, (_, k) => ({ k, draws: 0 }));
        for (const x of counts) bins[Math.min(top, x)].draws += 1;
        plot(histSlot, {
          alt: `${T.histAlt} The zero bin is the event that every stated direction is right.`,
          table: {
            caption: T.histTable,
            columns: [
              { label: "Wrong stated directions", value: "k", format: (v) => formatCount(v) },
              { label: "Draws", value: "draws", format: (v) => formatCount(v) },
              { label: "Event", value: (d) => (d.k === 0 ? "every stated direction right" : "some stated direction wrong"), num: false },
            ],
            rows: bins,
          },
          height: 196,
          marginTop: H.marginTop,
          marginBottom: 84,
          marginLeft: H.marginLeft,
          marginRight: 14,
          color: { type: "identity" },
          x: {
            domain: [-0.5, top + 0.5],
            ticks: bins.map((b) => b.k),
            label: "wrong stated directions in a draw",
            labelAnchor: "center",
            labelArrow: "none",
            labelOffset: 78,
          },
          y: {
            label: "draws",
            labelArrow: "none",
            grid: true,
            nice: true,
            ticks: (H.height - H.marginTop - H.marginBottom) / CONFIG.plotTickSpacing,
          },
          marks: (c, P) => [
            P.rectY(bins, { x1: (d) => d.k - H.half, x2: (d) => d.k + H.half, y: "draws", fill: (d) => (d.k === 0 ? c.post : c.plotGrid), stroke: c.plotFg }),
            P.ruleY([0], { stroke: c.plotAxis }),
            numText(bins, { x: "k", y: "draws", value: "draws", format: (v) => formatCount(v), dy: H.labelDy, lineAnchor: "bottom", fill: c.plotFg }),
            P.text([0], { x: (d) => d, y: () => 0, text: () => T.zeroBin, dy: 24, lineAnchor: "top", fill: c.post, fontWeight: 600 }),
          ],
          keyboard: {
            data: bins,
            x: "k",
            y: "draws",
            sort: false,
            label: T.histHeading,
            title: (d) =>
              `${formatCount(d.draws)} ${d.draws === 1 ? "draw" : "draws"} with ${formatCount(d.k)}${d.k === top && top < N ? " or more" : ""} wrong stated directions.${d.k === 0 ? " Every stated direction is right in this zero bin." : ""}`,
          },
        });
      }

      function renderCompactRunningAverage(counts, E) {
        const R = CONFIG.run;
        const S = counts.length;
        const means = runningMean(counts);
        const visible = Math.min(S, R.maxPoints);
        const pts = Array.from({ length: visible }, (_, k) => {
          const i = visible === 1 ? 0 : Math.round((k * (S - 1)) / (visible - 1));
          return { s: i + 1, avg: means[i] };
        });
        const top = Math.max(R.minTop, E * R.top, ...pts.map((p) => p.avg));
        plot(runSlot, {
          alt: T.runAlt,
          table: {
            caption: T.runTable,
            columns: [
              { label: "Draws so far", value: "s", format: (v) => formatCount(v) },
              { label: "Average wrong", value: "avg", format: (v) => safeDec(v, CONFIG.digits.mean) },
            ],
            rows: pts,
          },
          height: R.compact,
          marginTop: R.marginTop,
          marginBottom: 44,
          marginLeft: R.marginLeft,
          marginRight: R.marginRight,
          x: { domain: [1, Math.max(R.minX, S)], label: "draws so far", labelAnchor: "center", labelArrow: "none", labelOffset: 38 },
          y: {
            domain: [0, top],
            label: null,
            nice: true,
            grid: true,
            ticks: (R.height - R.marginTop - R.marginBottom) / CONFIG.plotTickSpacing,
          },
          marks: (c, P) => [
            P.ruleY([E], { stroke: c.err, strokeDasharray: R.rule, strokeWidth: 2 }),
            P.line(pts, { x: "s", y: "avg", stroke: c.plotFg, strokeWidth: 2 }),
            P.dot(pts.slice(-1), { x: "s", y: "avg", r: 3, fill: c.plotFg }),
          ],
          keyboard: {
            data: pts.slice(-1),
            x: "s",
            y: "avg",
            sort: false,
            label: T.runHeading,
            title: (d) => `After ${formatCount(d.s)} draws the average is ${safeDec(d.avg, CONFIG.digits.mean)} wrong stated directions; E is ${formatReadoutExpected(E)}.`,
          },
        });
      }

      function drawDraws(rep, ev, counts, state) {
        const S = counts.length;
        const N = ev.N;
        drawsPanel.hidden = S === 0;
        histSub.hidden = S === 0;
        runSub.hidden = S === 0;
        drawsSummary.hidden = S === 0;
        mcCaption.hidden = S === 0;
        if (S === 0) {
          drawsSummary.replaceChildren();
          mcCaption.replaceChildren();
          exposeResult(ctx, null, "mc");
          return null;
        }
        const mean = summaryStats(counts).mean;
        const share = N === 0 ? null : mean / N;
        renderCompactHistogram(counts, N);
        const zeroCount = counts.filter((x) => x === 0).length;
        const pZero = summaryStats(counts.map((x) => (x === 0 ? 1 : 0))).mean;
        histEvent.replaceChildren(
          "Zero bin (“every stated direction right”): ",
          ro("zeroDraws", zeroCount, formatCount(zeroCount)),
          " of ",
          ctx.num(S, formatCount(S)),
          " draws (",
          ro("zeroFrequency", pZero, formatReadoutProb(pZero)),
          ").",
          N === 0 ? " With no directions stated, this event is vacuous." : "",
        );
        renderCompactRunningAverage(counts, ev.Ew);
        const lawKey = rep.law.key;
        drawsSummary.replaceChildren(
          "Over ",
          ro("S", S, formatCount(S)),
          S === 1 ? " draw" : " draws",
          ": mean ",
          ro("mean", mean, formatReadoutExpected(mean)),
          " wrong per draw (share ",
          ro("meanShare", share, formatShare(share)),
          "), vs. E = ",
          ctx.num(ev.Ew, eRoText(ev.Ew, lawKey)),
          " (E/N = ",
          ctx.num(ev.EoverN[0], enText(ev.EoverN[0], lawKey)),
          ").",
        );
        const mc = { label: "monte-carlo", S, seed: state.seed, mean };
        exposeResult(ctx, mc, "mc");
        mcCaption.replaceChildren("(", captionNode(ctx, "monte-carlo", mc), ")");
        return { mean, share };
      }

      function drawDataTables(rep, rel, last, tauV) {
        const lawKey = rep.law.key;
        sixDataWrap.hidden = lawKey !== "six";
        finiteDataWrap.hidden = lawKey !== "finite";
        lawFormula.hidden = lawKey !== "finite";

        if (lawKey === "six") {
          const ids = rep.law.ids;
          const unitRows = ids.map((id, i) =>
            h(
              "tr",
              {},
              h("th", { scope: "row", text: id }),
              h("td", {}, ctx.num(rep.g[i], formatCount(rep.g[i]))),
              h("td", {}, ctx.num(rep.law.means[i], safeDec(rep.law.means[i], 4))),
              h("td", {}, ctx.num(rep.law.sds[i], safeDec(rep.law.sds[i], 4))),
            ),
          );
          sixUnitsTableSlot.replaceChildren(
            h(
              "table",
              { class: "prx-de-table" },
              h("caption", { text: "Six-site normal posteriors (score A) and current report grades" }),
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  h("th", { scope: "col", text: "Site" }),
                  h("th", { scope: "col", text: "Grade" }),
                  h("th", { scope: "col", text: "Posterior mean" }),
                  h("th", { scope: "col", text: "Posterior SD" }),
                ),
              ),
              h("tbody", {}, ...unitRows),
            ),
          );

          const e0 = rep.law.E.e[0];
          const pairRows = [];
          for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
              const r = rel[i][j];
              const [a, b] = r === -1 ? [j, i] : [i, j];
              const err = r === 0 ? null : e0[a][b];
              const loss = r === 0 ? tauV : e0[a][b];
              pairRows.push(
                h(
                  "tr",
                  {},
                  h("th", { scope: "row", text: r === 0 ? `${ids[i]} and ${ids[j]}` : `${ids[a]} above ${ids[b]}` }),
                  h("td", { class: "prx-de-textcell", text: r === 0 ? "withheld" : "stated" }),
                  h("td", {}, err === null ? "withheld" : ctx.num(err, safeDec(err, 6))),
                  h("td", {}, ctx.num(loss, r === 0 ? formatSetting(tauV) : safeDec(loss, 6))),
                ),
              );
            }
          }
          sixPairsTableSlot.replaceChildren(
            h(
              "table",
              { class: "prx-de-table" },
              h("caption", { text: "Exact pair decisions, wrong-direction probabilities, and loss contributions" }),
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  h("th", { scope: "col", text: "Pair" }),
                  h("th", { scope: "col", text: "Action" }),
                  h("th", { scope: "col", text: "Wrong probability" }),
                  h("th", { scope: "col", text: "Pair loss" }),
                ),
              ),
              h("tbody", {}, ...pairRows),
            ),
          );
          return;
        }

        const joint = rep.law.joint;
        const byOrder = joint.states.map((st) => realizedWrong(rep.g, st));
        lawHeading.textContent = joint === L3 ? T.lawTableHeading : "Orders and their coupling probabilities";
        const rows = joint.orders.map((o, s) => {
          const lastCell = last === s ? "this draw" : "";
          return h(
            "tr",
            { class: last === s ? "prx-de-last" : null },
            h("th", { scope: "row", text: o.split("").join(" > ") }),
            h("td", {}, ctx.num(joint.probs[s], exact(joint.probs[s]))),
            h("td", {}, ro(`order${s}.wrong`, byOrder[s].D[0], formatCount(byOrder[s].D[0]))),
            h("td", { class: "prx-de-lastcell", text: lastCell }),
          );
        });
        lawTableSlot.replaceChildren(
          h(
            "table",
            { class: "prx-de-table" },
            h("caption", { text: T.lawTableCaption }),
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", { scope: "col", text: T.orderCol }),
                h("th", { scope: "col", text: T.probCol }),
                h("th", { scope: "col", text: T.wrongCol }),
                h("th", { scope: "col", text: T.lastDrawCol }),
              ),
            ),
            h("tbody", {}, ...rows),
          ),
        );

        const ev = evaluateReport(rep.g, rep.law.E, { tau: tauV });
        const f = formulaNums();
        const terms = joint.probs.map((p, s) => `${f.num(p, exact(p))}\\cdot${f.num(byOrder[s].D[0], formatCount(byOrder[s].D[0]))}`);
        const lines = [];
        for (let i = 0; i < terms.length; i += 2) lines.push(`${i ? "&\\quad+ " : "E &= "}${terms.slice(i, i + 2).join(" + ")}`);
        lines.push(`&= \\;${f.num(ev.Ew, exact(ev.Ew))}`);
        renderTex(lawFormula, `\\begin{aligned}${lines.join(" \\\\ ")}\\end{aligned}`, { display: true, nums: f.raws });

        pairErrors.replaceChildren(
          "Wrong-direction probabilities stay fixed: ",
          ...[[0, 1], [0, 2], [1, 2]].flatMap(([i, j], k) => [
            k ? "; " : "",
            `${joint.ids[i]} above ${joint.ids[j]}: `,
            ro(`pairError.${joint.ids[i]}${joint.ids[j]}`, rep.law.E.e[0][i][j], exact(rep.law.E.e[0][i][j])),
          ]),
          ". The joint event can change even though these pair probabilities do not.",
        );
      }

      mobileControls(ctx, { primary: [reportBox, drawRow, drawNote] });
      return {
        render(state, info = {}) {
          // PR-06 / PR-09 disclosure guard: toggling <details> preserves "Your own" select state and avoids re-firing ctx.readout
          if (info?.reason === "disclosure") return;

          ctx.root.setAttribute("aria-busy", "true");
          try {
            const rep = reportOf(state);
            const lawKey = rep.law.key;

            lawSeg.set(lawKey);
            for (const key of CONFIG.laws) {
              const on = key === lawKey;
              reportMenus[key].root.hidden = !on;
              gradeBoxes[key].box.hidden = !on;
            }
            const named = CONFIG.named[lawKey].find((x) => same(Array.from(x), rep.g));
            reportMenus[lawKey].set(named ? named.join(",") : "custom");
            settings.summary.textContent = lawKey === "six" ? T.settingsSix : T.settingsFinite;
            gradeBoxes[lawKey].selects.forEach((s, i) => s.set(rep.g[i]));
            familyRadio.root.hidden = lawKey !== "six";
            familyRadio.set(state.cap);
            tau.set(state.tau);
            coupling.set(state.coupling);
            seed.set(state.seed);
            seedTag.replaceChildren(`${T.seedTag} `, ctx.num(state.seed, formatSetting(state.seed)));

            const full = state.draws >= CONFIG.draws.max;
            btnOne.setDisabled(full);
            btnMany.setDisabled(full);
            btnReset.setDisabled(state.draws === 0);
            seed.setDisabled(false);
            if (full) drawNote.replaceChildren(`${T.drawsFull} `, ctx.num(CONFIG.draws.max, formatCount(CONFIG.draws.max)), ` ${T.drawsFullEnd}`);
            drawNote.hidden = !full;

            const ev = evaluateReport(rep.g, rep.law.E, { tau: state.tau });
            exposeResult(ctx, ev, "evaluation");
            const opt = optimumOf(lawKey, state.cap, state.tau, state.coupling);
            const S = state.draws;
            mainGrid.setAttribute("data-has-draws", S > 0 ? "true" : "false");

            const counts = countsOf(lawKey, state.seed, S, rep.g, state.coupling);
            const event =
              lawKey === "finite"
                ? wrongCountDistribution(rep.g, rep.law.joint.states, rep.law.joint.probs)
                : ev.N === 0
                  ? wrongCountDistribution(rep.g, [rep.law.means.map((v) => [v])], [1])
                  : S > 0
                    ? { pNone: summaryStats(counts.map((x) => (x === 0 ? 1 : 0))).mean }
                    : null;

            let rw = null;
            let last = null;
            if (S > 0) {
              const draws = drawsOf(lawKey, state.seed, S, state.coupling);
              last = draws[S - 1];
              rw = realizedWrong(rep.g, lawKey === "six" ? last : rep.law.joint.states[last]);
            }
            const wrong = new Set((rw?.pairs[0] ?? []).map((p) => `${p.i},${p.j}`));
            const rel = relations(rep.g);

            drawMatrix(rep, rel, wrong, S > 0);
            renderCurrentDraw(rep, { ...state, draws: S }, rw, last, lawKey === "six" && S > 0 ? last : null);
            drawTiles(rep, ev, state.tau, event, S);
            const b = drawBound(rep, ev, opt, state.tau);
            couplingBox.hidden = lawKey !== "finite";
            drawDataTables(rep, rel, S > 0 ? last : null, state.tau);
            const d = drawDraws(rep, ev, counts, { ...state, draws: S });

            // Concise <= 35-word 3-sig-fig readout preserving G2-F6 three-statement distinction
            const parts = [
              "Report ",
              gradeNum(rep.g, "grades"),
              " at τ = ",
              tauNode(state.tau),
              " states ",
              ctx.num(ev.N, formatCount(ev.N)),
              " of ",
              ctx.num(ev.M, formatCount(ev.M)),
              " pairs: E = ",
              ctx.num(ev.Ew, eRoText(ev.Ew, lawKey)),
              ", E/N = ",
              ctx.num(ev.EoverN[0], enText(ev.EoverN[0], lawKey)),
            ];
            if (lawKey === "finite" && ev.N > 0 && event) {
              parts.push(", all-right ", ctx.num(event.pNone, exact(event.pNone)));
            }
            if (d) {
              parts.push(
                " (",
                ctx.num(d.mean, formatReadoutExpected(d.mean)),
                " mean over ",
                ctx.num(S, formatCount(S)),
                S === 1 ? " draw)" : " draws)",
              );
            }
            parts.push(b.applies ? READOUT_CLAUSES.applies : b.holds ? READOUT_CLAUSES.holds[b.reason] : READOUT_CLAUSES.fails);
            ctx.readout.set(parts);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
