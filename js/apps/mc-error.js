export * from "../shared/domain/mc-error.js";

// App entry point for mc-error (1.17: "Probabilities from draws carry noise", Frame v2 Redesign).
// Preserves 100% of ../shared/domain/mc-error.js exports for downstream apps (2.18 chosen-and-judged) and tests.
import { appLink, createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatDecimal,
  formatProb,
  formatReadoutEst,
  formatReadoutProb,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro, tagNode } from "../shared/readout.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { renderDataTable } from "../shared/table.js";
import {
  binomialMcse,
  disclosure,
  errorArray,
  exactOptimum,
  fragilePairs,
  gaussianDraws,
  leastCertainPairs,
  pairCount,
  pairDecision,
  relationChange,
  summaryStats,
  weightedError,
} from "../pr-core.js";
import { CONFIG, envelopeFor, runRecord, seedsOf } from "../shared/domain/mc-error.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

const T = CONFIG.text;
const C = CONFIG.chart;
const H = C.hist;
const O = C.overS;

const V2_CHART = Object.freeze({
  font: 13,
  row: 19,
  marginTop: 28,
  marginBottom: 38,
  marginLeft: 62,
  marginRight: 64,
  xTicksWide: 5,
  xTicksNarrow: 4,
  narrow: 480,
  dot: 4.5,
  diamond: 4.5,
  diamondWidth: 1.6,
  whisker: 2,
  capInset: 5,
  bandInset: 3.5,
  bandOpacity: 0.6,
  outline: 1.5,
  tauWidth: 1.35,
  tauDash: "5,3",
  labelGap: 8,
  tagGap: 7,
  tauLabelDy: -11,
  tauLabelGap: 3.5,
  estGap: 5,
  estChar: 0.64,
  estHalo: 3.5,
  estAbove: 7,
  estBelow: 8,
  overS: Object.freeze({
    height: 192,
    marginTop: 24,
    marginBottom: 42,
    marginLeft: 54,
    marginRight: 48,
    xTicksWide: 5,
    xTicksNarrow: 4,
    yTicks: 4,
    bandOpacity: 0.22,
    exactWidth: 1.75,
    shownWidth: 1.5,
    shownDash: "1.5,2.5",
    dot: 4.5,
    pad: 0.04,
    labelDy: -7,
  }),
  hist: Object.freeze({
    height: 176,
    marginTop: 26,
    marginBottom: 42,
    marginLeft: 48,
    marginRight: 20,
    xTicksWide: 5,
    xTicksNarrow: 4,
    yTicks: 4,
    target: H.target,
    exactWidth: 1.75,
    bandOpacity: 0.22,
    tauWidth: 1.35,
    tauDash: "5,3",
    marker: 4.75,
    markerDy: -8,
    rim: 0.5,
    envWidth: 1.75,
    bookDash: "2,3",
    reach: H.reach,
    labelDy: -10,
    labelGap: 3.5,
    halo: 3.5,
    constantShare: H.constantShare,
    padShare: H.padShare,
    eps: H.eps,
    decimals: H.decimals,
  }),
  stageChunkSize: 10,
});

const V2_CSS = `
.prx-widget .prx-mce-stage-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: .75rem; align-items: start; }
.prx-mce-stage-comparison > * { min-width: 0; }
.prx-mce.prx-widget[data-prx-frame="v2"] .prx-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  align-items: flex-end;
  min-width: 0;
}
.prx-mce.prx-widget[data-prx-frame="v2"] .prx-controls > .prx-slider {
  flex: 1 1 13rem;
  max-width: 19rem;
}
.prx-mce .prx-mce-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: flex-end;
  width: 100%;
  min-width: 0;
}
.prx-mce .prx-mce-seed {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.35rem 0.6rem;
  min-width: 0;
}
.prx-mce .prx-mce-seed input[type="number"] {
  width: 8.5rem;
  max-width: 100%;
}
.prx-mce .prx-mce-seed .prx-hint {
  flex: 0 1 auto;
  align-self: center;
  margin: 0;
}
.prx-mce .prx-stage {
  container-type: inline-size;
}
.prx-mce .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.prx-mce .prx-stage .prx-mce-run-head {
  margin: 0 0 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
}
.prx-mce .prx-mce-chart {
  min-width: 0;
  max-width: 100%;
}
.prx-mce .prx-mce-run-chart svg {
  cursor: pointer;
}
.prx-mce .prx-mce-stale {
  opacity: 0.4;
}
.prx-mce .prx-mce-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.95rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.84375rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius);
}
.prx-mce .prx-mce-key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.prx-mce .prx-mce-sw {
  flex: none;
  display: inline-block;
  box-sizing: border-box;
}
.prx-mce .prx-mce-sw-est {
  position: relative;
  width: 1.5rem;
  height: 0;
  border-top: 2px solid var(--prx-est);
}
.prx-mce .prx-mce-sw-est::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -5.5px;
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  background: var(--prx-est);
  border-radius: 50%;
}
.prx-mce .prx-mce-sw-diamond {
  width: 8px;
  height: 8px;
  margin: 0 2px;
  background: transparent;
  border: 1.5px solid var(--prx-plot-fg);
  transform: rotate(45deg);
}
.prx-mce .prx-mce-sw-band {
  width: 1.35rem;
  height: 0.8rem;
  background: var(--prx-plot-grid);
  opacity: 0.75;
}
.prx-mce .prx-mce-sw-tau {
  width: 0;
  height: 0.95rem;
  margin: 0 0.25rem;
  border-left: 1.5px dashed var(--prx-plot-fg);
}
.prx-mce .prx-mce-sw-fragile {
  width: 1.35rem;
  height: 0.85rem;
  border: 1.5px solid var(--prx-plot-fg);
}
.prx-mce .prx-mce-sw-bar {
  width: 0.8rem;
  height: 0.8rem;
  border: 1px solid var(--prx-plot-bg);
}
.prx-mce .prx-mce-sw-bar-est {
  background: var(--prx-est);
}
.prx-mce .prx-mce-sw-bar-max {
  background: var(--prx-plot-muted);
}
.prx-mce .prx-mce-sw-exact {
  width: 0;
  height: 0.95rem;
  margin: 0 0.25rem;
  border-left: 2px solid var(--prx-plot-fg);
}
.prx-mce .prx-mce-sw-flat {
  width: 1.35rem;
  height: 0;
  border-top: 2px solid var(--prx-plot-fg);
}
.prx-mce .prx-mce-sw-seband {
  position: relative;
  width: 1.35rem;
  height: 0.8rem;
  overflow: hidden;
}
.prx-mce .prx-mce-sw-seband::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--prx-est);
  opacity: 0.22;
}
.prx-mce .prx-mce-sw-dot {
  width: 9px;
  height: 9px;
  margin: 0 2px;
  background: var(--prx-est);
  border-radius: 50%;
}
.prx-mce .prx-mce-sw-marker {
  width: 0;
  height: 0;
  margin: 0 0.15rem;
  border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent;
  border-right: 4.5px solid transparent;
}
.prx-mce .prx-mce-sw-env {
  width: 0;
  height: 0.95rem;
  margin: 0 0.25rem;
  border-left: 2px solid var(--prx-plot-fg);
}
.prx-mce .prx-mce-sw-book {
  width: 0;
  height: 0.95rem;
  margin: 0 0.25rem;
  border-left: 2px dotted var(--prx-plot-fg);
}
.prx-mce .prx-stage .prx-mce-strip {
  margin: 0.4rem 0 0;
  padding: 0.35rem 0.5rem 0.1rem;
  border-top: 1px solid var(--prx-border);
  font-size: 0.84375rem;
  line-height: 1.38;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  font-variant-numeric: tabular-nums;
}
.prx-mce .prx-mce-data-stack,
.prx-mce .prx-mce-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.1rem;
  min-width: 0;
}
.prx-mce .prx-mce-data-stack > section,
.prx-mce .prx-mce-method-stack > section {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.prx-mce .prx-mce-rep-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem 1.4rem;
  align-items: start;
  margin: 0.3rem 0 0;
}
.prx-mce .prx-mce-rep-cards,
.prx-mce .prx-mce-tally-box {
  min-width: 0;
}
.prx-mce .prx-mce-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: 0.6rem 1rem;
  align-items: start;
}
.prx-mce .prx-mce-ledger-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem 1.5rem;
  align-items: start;
}
@media (min-width: 56rem) {
  .prx-mce .prx-mce-rep-grid {
    grid-template-columns: minmax(0, 1.85fr) minmax(0, 1.3fr);
  }
  .prx-mce .prx-mce-ledger-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
}
.prx-mce .prx-mce-heading {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--prx-fg-heading);
}
.prx-mce .prx-mce-sub {
  margin: 0.7rem 0 0.2rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--prx-fg);
}
.prx-mce .prx-mce-note {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--prx-fg-muted);
}
.prx-mce .prx-mce-text {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--prx-fg);
}
.prx-mce .prx-mce-card {
  min-width: 0;
  padding: 0.45rem 0.65rem 0.5rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
}
.prx-mce .prx-mce-card > p {
  margin: 0.15rem 0 0;
  font-size: 0.875rem;
  line-height: 1.4;
}
.prx-mce .prx-mce-card-head {
  font-weight: 600;
  color: var(--prx-fg-muted);
}
.prx-mce .prx-mce-card > p.prx-mce-tagline {
  font-size: 0.8125rem;
  color: var(--prx-fg-muted);
}
.prx-mce .prx-mce-card .prx-mce-blocks {
  margin: 0.25rem 0 0.1rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--prx-fg);
}
.prx-mce .prx-mce-busy {
  margin: 0.4rem 0 0;
  font-size: 0.875rem;
  font-style: italic;
  color: var(--prx-fg-muted);
}
.prx-mce .prx-mce-table-wrap {
  max-width: 100%;
  margin: 0.35rem 0 0;
  overflow-x: auto;
}
.prx-mce .prx-mce-ledger,
.prx-mce .prx-mce-tally {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: 0.875rem;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}
.prx-mce .prx-mce-ledger caption,
.prx-mce .prx-mce-tally caption {
  caption-side: top;
  padding: 0 0 0.35rem;
  text-align: left;
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-mce .prx-mce-ledger th,
.prx-mce .prx-mce-ledger td,
.prx-mce .prx-mce-tally th,
.prx-mce .prx-mce-tally td {
  padding: 0.25rem 0.5rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
  overflow-wrap: normal;
  word-break: normal;
}
.prx-mce .prx-mce-ledger thead th {
  font-weight: 600;
  vertical-align: bottom;
}
.prx-mce .prx-mce-ledger tbody th {
  font-weight: 600;
  color: var(--prx-fg-muted);
}
.prx-mce .prx-mce-tally tbody th {
  font-weight: 400;
}
.prx-mce .prx-mce-tally td {
  text-align: right;
  white-space: nowrap;
}
.prx-mce .prx-mce-tally {
  margin-top: 0.1rem;
}
.prx-mce .prx-mce-formula {
  margin: 0.1rem 0 0;
  font-size: 0.9rem;
  line-height: 1.5;
  max-width: 100%;
}
.prx-mce .prx-mce-math {
  display: inline-block;
  max-width: 100%;
}
.prx-mce .prx-mce-formula math {
  font-size: 1.05em;
}
@media (max-width: 30em) {
  .prx-mce.prx-widget[data-prx-frame="v2"] { padding: 0.5rem 0.6rem 0.45rem; }
  .prx-mce.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-mce.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-mce.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-mce.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-mce.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.34; }
  .prx-mce .prx-mce-ledger th, .prx-mce .prx-mce-ledger td, .prx-mce .prx-mce-tally th, .prx-mce .prx-mce-tally td { padding: 0.2rem 0.3rem; }
}
`;

/** Advance a supported seed without ever emitting 0 or clamping distinct reruns to the maximum. */
const seedAt = (first, offset) => CONFIG.seed.min + (first - CONFIG.seed.min + offset) % (CONFIG.seed.max - CONFIG.seed.min + 1);

const UNITS = SIX.tables.units;
const IDS = Object.freeze(UNITS.id.slice());
const N_UNITS = IDS.length;
const M = pairCount(N_UNITS);
const FAMILIES = Object.freeze({ 3: Object.freeze({ kind: "atMost", G: 3 }), none: Object.freeze({ kind: "all" }) });
const familyOf = (cap) => FAMILIES[cap] ?? FAMILIES[CONFIG.cap.value];

const LAW = Object.freeze(Object.fromEntries(CONFIG.criteria.values.map((c) => {
  const cols = CONFIG.criteriaOf[c].map((k) => (k === "score_A" ? ["mean_A", "sd_A"] : ["mean_B", "sd_B"]));
  return [c, Object.freeze({
    criteria: CONFIG.criteriaOf[c].slice(),
    w: CONFIG.weights[c].slice(),
    means: UNITS.id.map((_, i) => cols.map(([m]) => UNITS[m][i])),
    sds: UNITS.id.map((_, i) => cols.map(([, s]) => UNITS[s][i])),
  })];
})));

const PAIRS = Object.freeze((() => {
  const out = [];
  for (let i = 0; i < N_UNITS; i += 1) {
    for (let j = i + 1; j < N_UNITS; j += 1) {
      out.push(Object.freeze({ key: `${IDS[i]},${IDS[j]}`, name: `${IDS[i]}–${IDS[j]}`, i, j }));
    }
  }
  return out;
})());
const PAIR_BY_KEY = new Map(PAIRS.map((p) => [p.key, p]));
const pairKey = (i, j) => (i < j ? `${IDS[i]},${IDS[j]}` : `${IDS[j]},${IDS[i]}`);

function memo(size, make) {
  const store = new Map();
  const get = (key, ...args) => {
    if (!store.has(key)) {
      if (store.size >= size) store.delete(store.keys().next().value);
      store.set(key, make(...args));
    }
    return store.get(key);
  };
  get.has = (key) => store.has(key);
  get.set = (key, value) => {
    if (!store.has(key) && store.size >= size) store.delete(store.keys().next().value);
    store.set(key, value);
  };
  return get;
}

const exactMemo = memo(CONFIG.criteria.values.length, (c) => {
  const L = LAW[c];
  const E = errorArray(L.means, L.sds, { ids: IDS, criteria: L.criteria });
  return { E, wE: weightedError(E, L.w), least: leastCertainPairs(E, { k: M, w: L.w }) };
});
const exactFor = (c) => exactMemo(c, c);

const exactOptMemo = memo(CONFIG.memo.exact, (c, tau, cap) => exactOptimum(exactFor(c).E, { tau, w: LAW[c].w, family: familyOf(cap) }));
const exactOpt = (c, tau, cap) => exactOptMemo(`${c}|${tau}|${cap}`, c, tau, cap);

const recKey = (c, S, seed) => `${c}|${S}|${seed}`;
const cachedRecord = memo(CONFIG.memo.cache, (c, S, seed) => runRecord(c, S, seed));

const flaggedAt = (p, tau) => p.mcse !== null && Math.abs(p.d - tau) < CONFIG.z * p.mcse;

const optMemo = memo(CONFIG.memo.opt, (rec, tau, cap) => {
  const o = exactOptimum(rec.eHat, { tau, w: LAW[rec.c].w, family: familyOf(cap) });
  return Object.freeze((o.grades ?? [o.grade]).slice());
});
const optKey = (rec, tau, cap) => `${recKey(rec.c, rec.S, rec.seed)}|${tau}|${cap}`;
const runOpt = (rec, tau, cap) => optMemo(optKey(rec, tau, cap), rec, tau, cap);

const mainMemo = memo(CONFIG.memo.main, (c, S, seed) => {
  const draws = gaussianDraws(LAW[c].means, LAW[c].sds, S, seed);
  const rec = cachedRecord(recKey(c, S, seed), c, S, seed);
  return { draws, rec };
});

const exactSe = (e, S) => (e > 0 && e < 1 ? binomialMcse(e, S) : null);

const overSMemo = memo(CONFIG.memo.overS, (c, e) => {
  const one = LAW[c].w.length === 1;
  const out = [];
  for (let S = CONFIG.overS.from; S <= CONFIG.overS.to; S += CONFIG.overS.by) {
    out.push({ S, r: envelopeFor(c, S).deltaW, se: one ? exactSe(e, S) : null });
  }
  return out;
});

const sameGrade = (a, b) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);
const optimaOf = (opt) => opt.grades ?? [opt.grade];
const inSet = (grades, g) => grades.some((x) => sameGrade(x, g));
const inExact = (opt, g) => inSet(optimaOf(opt), g);
const relationOf = (g, i, j) => (g[i] < g[j] ? "above" : g[i] > g[j] ? "below" : "withheld");

const fmtP = (x) => formatProb(x);
const fmtRoP = (x) => formatReadoutProb(x);
const fmtRoEst = (x) => formatReadoutEst(x);
const fmtSe = (x) => (x === 0 ? formatDecimal(0, { digits: 0 }) : Math.abs(x) < CONFIG.sciBelow ? formatSci(x) : formatDecimal(x, { digits: CONFIG.digits.se }));
const fmtR = (x) => (x === 0 ? "0" : Math.abs(x) < CONFIG.sciBelow ? formatSci(x) : formatDecimal(x, { digits: CONFIG.digits.radius }));
const fmtBin = (x) => (x === 0 ? formatDecimal(0, { digits: CONFIG.digits.bin }) : Math.abs(x) < CONFIG.sciBelow ? formatSci(x, { sig: 3 }) : formatDecimal(x, { digits: CONFIG.digits.bin }));
const fmtCount = (x) => formatCount(x);
const fmtSet = (x) => formatSetting(x);

function fill(template, slots = {}) {
  const out = [];
  let at = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > at) out.push(template.slice(at, m.index));
    const v = slots[m[1]];
    const node = typeof v === "function" ? v() : v;
    if (node === undefined || node === null) throw new RangeError(`mc-error: no value for {${m[1]}}`);
    out.push(node);
    at = m.index + m[0].length;
  }
  if (at < template.length) out.push(template.slice(at));
  return out;
}

const words = (template, slots = {}) => template.replace(/\{(\w+)\}/g, (_, k) => String(slots[k]));

const roundBin = (x) => Number(x.toFixed(V2_CHART.hist.decimals));

function niceWidth(x, grid) {
  const ok = (v) => !grid || (v >= grid - H.eps && Math.abs(v / grid - Math.round(v / grid)) < 1e-6);
  return H.nice.find((v) => v >= x && ok(v)) ?? H.nice.filter(ok).at(-1) ?? H.nice.at(-1);
}

function binsOf(values, { width, lo: lo0, hi: hi0 }) {
  const lo = roundBin(Math.floor(lo0 / width + H.eps) * width);
  let hi = roundBin(Math.ceil(hi0 / width - H.eps) * width);
  if (!(hi > lo)) hi = roundBin(lo + width);
  const count = Math.round((hi - lo) / width);
  const n = new Array(count).fill(0);
  for (const v of values) n[Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width + H.eps)))] += 1;
  return {
    lo,
    hi,
    width,
    bins: n.map((k, i) => ({ i, lo: roundBin(lo + i * width), hi: roundBin(lo + (i + 1) * width), n: k })).filter((b) => b.n > 0),
  };
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function mountWidget(el, spec = {}) {
  // name: "mc-error"
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: V2_CSS,
    keys: {
      S: { type: "integer", min: CONFIG.S.min, max: CONFIG.S.max, value: CONFIG.S.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      criteria: { type: "choice", values: CONFIG.criteria.values, value: CONFIG.criteria.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      pair: { type: "choice", values: PAIRS.map((p) => p.key), value: CONFIG.pairDefault },
      cap: { type: "choice", values: CONFIG.cap.values, value: CONFIG.cap.value },
    },
    build(ctx) {
      const { h } = ctx;
      const rWriter = ro(ctx);
      const num = (raw, display, hook) => {
        const n = ctx.num(raw, display);
        if (hook) n.setAttribute("data-prx-readout", hook);
        return n;
      };
      const count = (x, hook) => num(x, fmtCount(x), hook);
      const seedWrap = (from, to) => (from > to ? h("span", { "data-prx-note": "seed-wrap" }, ...fill(T.seedWrap, {
        max: () => num(CONFIG.seed.max, fmtSet(CONFIG.seed.max)),
        min: () => num(CONFIG.seed.min, fmtSet(CONFIG.seed.min)),
      })) : "");
      const zNum = () => num(CONFIG.z, fmtCount(CONFIG.z));
      const pNum = () => num(1 - CONFIG.alpha, fmtSet(1 - CONFIG.alpha));
      const item = (cls, ...content) => h(
        "span",
        { class: "prx-mce-key-item" },
        h("span", { class: `prx-mce-sw ${cls}`, "aria-hidden": "true" }),
        h("span", {}, ...content),
      );

      // ------------------------------------------------------------------------------------------- toolbar & settings
      const sSlider = ctx.slider({
        label: T.S,
        min: CONFIG.S.min,
        max: CONFIG.S.max,
        step: CONFIG.S.step,
        value: ctx.state.S,
        name: "S",
        format: (v) => fmtCount(v),
        onInput: (v) => ctx.set({ S: Math.round(v) }),
      });
      ctx.primaryControl(sSlider.root);
      const tau = ctx.slider({
        label: T.tau,
        ...ctx.key("tau"),
        name: "tau",
        format: (v) => fmtSet(v),
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.controls.append(sSlider.root, tau.root);

      const score = ctx.segmented({
        label: T.score,
        name: "criteria",
        value: ctx.state.criteria,
        options: CONFIG.criteria.values.map((v) => ({ value: v, label: T.scoreWords[v] })),
        onChange: (v) => ctx.set({ criteria: v }),
      });
      const pairSelect = ctx.select({
        label: T.pair,
        name: "pair",
        value: ctx.state.pair,
        options: PAIRS.map((p) => ({ value: p.key, label: p.name })),
        onChange: (v) => ctx.set({ pair: v }),
      });
      const capSeg = ctx.segmented({
        label: T.cap,
        name: "cap",
        value: ctx.state.cap,
        options: CONFIG.cap.values.map((v) => ({ value: v, label: T.capWords[v] })),
        onChange: (v) => ctx.set({ cap: v }),
      });
      const seedHintId = uid("prx-mce-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed,
        min: CONFIG.seed.min,
        max: CONFIG.seed.max,
        step: 1,
        value: ctx.state.seed,
        name: "seed",
        describedBy: seedHintId,
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      const redraw = ctx.button({
        label: T.redraw,
        title: T.redrawTitle,
        key: "redraw",
        onClick: () => ctx.set({ seed: seedAt(ctx.state.seed, 1) }),
      });
      ctx.onPrimary(() => ctx.set({ seed: seedAt(ctx.state.seed, 1) }));
      const seedBox = h("div", { class: "prx-mce-seed" }, seed.root, redraw.root, h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));

      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(h("div", { class: "prx-mce-settings-grid" }, score.root, pairSelect.root, capSeg.root, seedBox));

      // ------------------------------------------------------------------------------------------- primary stage
      const panelHead = (cls = "prx-mce-heading", level = 4) => ctx.part("notes", ctx.panelTitle("", { className: cls, level }));
      const runTitle = panelHead("prx-mce-run-head", 4);
      const runSlot = h("div", { class: "prx-mce-chart prx-mce-run-chart" });
      const runKey = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const stageStrip = h("p", { class: "prx-mce-strip", "data-prx-part": "notes" });
      const runBox = h("section", { class: "prx-mce-run", "aria-label": T.runTable }, runTitle, runSlot, runKey, stageStrip);


      // ------------------------------------------------------------------------------------------- Data disclosure
      const dataBox = ctx.dataBox(["Data, ", count(CONFIG.runs), "-run tables and convergence"]);

      // Reports comparison + 100-run tally
      const repTitle = panelHead();
      repTitle.textContent = T.repHead;
      const cardEst = h("div", { class: "prx-mce-card-slot" });
      const cardExact = h("div", { class: "prx-mce-card-slot" });
      const tallyWrap = ctx.scrollRegion(h("div", { class: "prx-mce-table-wrap" }), T.tallyLabel);
      const familyLine = h("p", { class: "prx-mce-text", "data-prx-part": "notes", "data-prx-note": "family" });
      const tieLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "ties", hidden: true });
      const aloneLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const tallyBox = h("div", { class: "prx-mce-tally-box" }, tallyWrap, familyLine, tieLine, aloneLine);
      const repCompare = h("p", { class: "prx-mce-text", "data-prx-part": "notes", "data-prx-note": "compare" });
      const repNote = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const repBox = h(
        "section",
        { class: "prx-mce-reports", "aria-label": T.repHead },
        repTitle,
        h(
          "div",
          { class: "prx-mce-rep-grid" },
          h("div", { class: "prx-mce-rep-cards" }, h("div", { class: "prx-mce-cards" }, cardEst, cardExact), repCompare, repNote),
          tallyBox,
        ),
      );

      // 100-run histograms (.prx-mce-runs MUST hold only the 2 histogram [100, 100] tables for widget-idle-background.test.mjs)
      const runsTitle = panelHead();
      const busyNote = h("p", { class: "prx-mce-busy", "data-prx-part": "notes", hidden: true });
      const h1Head = panelHead("prx-mce-sub", 5);
      const h1Slot = h("div", { class: "prx-mce-chart" });
      const h1Key = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const h1Spread = h("p", { class: "prx-mce-text", "data-prx-part": "notes" });
      const h2Head = panelHead("prx-mce-sub", 5);
      h2Head.textContent = T.hist2Head;
      const h2Slot = h("div", { class: "prx-mce-chart" });
      const h2Key = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const runsBody = h("div", { class: "prx-mce-runs-body" }, h1Head, h1Slot, h1Key, h1Spread, h2Head, h2Slot, h2Key);
      const runsBox = h("section", { class: "prx-mce-runs", "aria-label": T.runsLabel }, runsTitle, busyNote, runsBody);

      // Convergence over S
      const overTitle = panelHead();
      const overSlot = h("div", { class: "prx-mce-chart" });
      const overKey = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const overNote = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const overBox = h("section", { class: "prx-mce-over", "aria-label": T.overTable }, overTitle, overSlot, overKey, overNote);

      // Visible sticky 15-pair exact audit table (outside .prx-mce-runs)
      const pairAuditWrap = ctx.scrollRegion(h("div", { class: "prx-mce-table-wrap" }), "All pairs in this run");
      const pairAuditBox = h("section", { class: "prx-mce-pair-audit", "aria-label": "All pairs in this run" }, pairAuditWrap);

      overBox.setAttribute("data-prx-evidence", "pair-convergence");
      ctx.stage.append(h("div", { class: "prx-mce-stage-comparison" }, runBox, overBox));
      dataBox.body.append(h("div", { class: "prx-mce-data-stack" }, repBox, runsBox, pairAuditBox));

      // ------------------------------------------------------------------------------------------- Method disclosure
      const methodBox = ctx.methodBox("Method and envelope formula");
      const ledgerWrap = ctx.scrollRegion(h("div", { class: "prx-mce-table-wrap" }), T.ledLabel);
      const formula = h("p", { class: "prx-mce-formula", "data-prx-part": "notes" });
      const bookLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "book" });
      const pairLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const ruleLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const sameELine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const mcmcLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", text: T.mcmc });
      const othersLine = h(
        "p",
        { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "others" },
        ...fill(T.others, { budgets: () => appLink(ctx, "estimated-budgets"), regret: () => appLink(ctx, "chosen-and-judged") }),
      );
      const ledgerBox = h(
        "section",
        { class: "prx-mce-ledger-box", "aria-label": T.ledLabel },
        h("div", { class: "prx-mce-ledger-grid" }, ledgerWrap, h("div", {}, formula, bookLine, pairLine, ruleLine, sameELine, mcmcLine, othersLine)),
      );
      methodBox.body.append(h("div", { class: "prx-mce-method-stack" }, ledgerBox));

      // ------------------------------------------------------------------------------------------- stage row click
      let runRows = [];
      let runFigure = null;
      let lastRunsBase = null;
      ctx.listen(runSlot, "click", (ev) => {
        const svg = runFigure?.svg;
        if (!svg || !svg.contains(ev.target)) return;
        const rect = svg.getBoundingClientRect();
        const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
        const height = vb[3] || Number(svg.getAttribute("height")) || rect.height;
        const y = ((ev.clientY - rect.top) * height) / (rect.height || 1);
        const sy = runFigure.scale("y");
        const row = runRows.find((r) => {
          const y0 = sy.apply(r.key);
          return Number.isFinite(y0) && y >= y0 && y < y0 + sy.bandwidth;
        });
        if (row && row.key !== ctx.state.pair) ctx.set({ pair: row.key });
      });

      // ------------------------------------------------------------------------------------------- staged 100-run scheduler
      let activeJobKey = null;
      function cancelActiveJob() {
        if (!activeJobKey) return;
        activeJobKey = null;
        ctx.scheduleStages([]);
        ctx.root.removeAttribute("aria-busy");
      }
      ctx.onCleanup(() => { activeJobKey = null; });

      function stageWork(key, tasks) {
        if (activeJobKey === key) return;
        activeJobKey = key;
        ctx.win.requestAnimationFrame?.(() => {});
        const chunks = chunkArray(tasks, V2_CHART.stageChunkSize).map((batch) => () => {
          for (const fn of batch) fn();
        });
        chunks.push(() => {
          if (activeJobKey !== key) return;
          activeJobKey = null;
          ctx.requestRender("runs");
        });
        ctx.scheduleStages(chunks, { yieldMs: 0 });
      }

      function ensureWork(key, tasks, units) {
        if (!tasks.length) return true;
        if (units <= CONFIG.syncBudget) {
          for (const fn of tasks) fn();
          return true;
        }
        stageWork(key, tasks);
        return false;
      }

      const recJob = (st) => `rec|${st.criteria}|${st.S}|${st.seed}`;
      const optJob = (st) => `opt|${st.criteria}|${st.S}|${st.seed}|${st.tau}|${st.cap}`;

      function recordsReady(state) {
        const { criteria: c, S } = state;
        const tasks = seedsOf(state.seed)
          .filter((s) => !cachedRecord.has(recKey(c, S, s)))
          .map((s) => () => cachedRecord(recKey(c, S, s), c, S, s));
        return ensureWork(recJob(state), tasks, tasks.length * S * LAW[c].w.length);
      }

      function reportsReady(state, base) {
        const { tau: tauVal, cap } = state;
        const want = base.recs.map((r) => [r, cap]);
        if (cap !== "none") {
          base.kinds.forEach((kind, i) => {
            if (kind === "flip") want.push([base.recs[i], "none"]);
          });
        }
        const missing = want.filter(([r, f]) => !optMemo.has(optKey(r, tauVal, f)));
        const units = missing.reduce((sum, [, f]) => sum + (CONFIG.optUnits[f] ?? CONFIG.optUnits[3]), 0);
        return ensureWork(optJob(state), missing.map(([r, f]) => () => runOpt(r, tauVal, f)), units);
      }

      // ------------------------------------------------------------------------------------------- computing
      function compute(state) {
        const c = state.criteria;
        const L = LAW[c];
        const X = exactFor(c);
        const family = familyOf(state.cap);
        const main = mainMemo(`${c}|${state.S}|${state.seed}`, c, state.S, state.seed);
        const optExact = exactOpt(c, state.tau, state.cap);
        const optHat = exactOptimum(main.rec.eHat, { tau: state.tau, w: L.w, family });
        const fr = fragilePairs(main.draws, { tau: state.tau, w: L.w, z: CONFIG.z, screenMargin: Infinity, ids: IDS, grade: optHat.grade });
        const change = relationChange(optExact.grade, optHat.grade, X.E, { w: L.w });
        const env = envelopeFor(c, state.S);
        const frBy = new Map(fr.pairs.map((p) => [pairKey(p.i, p.j), p]));
        const sel = PAIR_BY_KEY.get(state.pair) ?? PAIR_BY_KEY.get(CONFIG.pairDefault);
        const exactRow = X.least.find((p) => p.i === sel.i && p.j === sel.j);
        const a = exactRow.above;
        const b = a === sel.i ? sel.j : sel.i;
        const frSel = frBy.get(sel.key);
        return { c, L, X, main, optExact, optHat, fr, frBy, change, env, sel, a, b, exactRow, frSel };
      }

      function runsBase(state, k) {
        const recs = seedsOf(state.seed).map((s) => cachedRecord(recKey(k.c, state.S, s), k.c, state.S, s));
        const { a, b } = k;
        const e = k.X.wE[a][b];
        const est = recs.map((r) => r.wHat[a][b]);
        const m1 = k.frSel.mcse ?? 0;
        const decide = (eab, eba) => pairDecision(eab, eba, state.tau).best.slice().sort();
        const exactChoice = decide(e, k.X.wE[b][a]).join("|");
        const kinds = recs.map((r) => {
          const best = decide(r.wHat[a][b], r.wHat[b][a]);
          return best.join("|") === exactChoice ? "same" : best.length > 1 ? "tie" : "flip";
        });
        const tally = (list) => list.filter(Boolean).length;
        const kindCount = (kind) => kinds.filter((x) => x === kind).length;
        return {
          recs,
          R: recs.length,
          from: recs[0].seed,
          to: recs[recs.length - 1].seed,
          e,
          est,
          m1,
          sd: summaryStats(est).sd,
          within: m1 > 0 ? tally(est.map((v) => Math.abs(v - e) <= CONFIG.z * m1)) : null,
          fragile: tally(recs.map((r) => flaggedAt(r.pairs[k.sel.key], state.tau))),
          kinds,
          same: kindCount("same"),
          flips: kindCount("flip"),
          ties: kindCount("tie"),
          exactChoice: pairDecision(e, k.X.wE[b][a], state.tau).best,
          maxErr: recs.map((r) => Math.max(...r.eps)),
          held: tally(recs.map((r) => r.eps.every((x, q) => x <= k.env.eps[q]))),
          constant: est.every((v) => v === est[0]) ? est[0] : null,
        };
      }

      function runsReports(state, k, base) {
        const exact = optimaOf(k.optExact);
        const optima = base.recs.map((r) => runOpt(r, state.tau, state.cap));
        const kept = optima.map((gs) => gs.some((g) => inSet(exact, g)));
        const tally = (list) => list.filter(Boolean).length;
        const changedIn = (kind) => tally(base.kinds.map((x, r) => x === kind && !kept[r]));
        const tiedSizes = optima.filter((gs) => gs.length > 1).map((gs) => gs.length);
        let flipChangedAll = null;
        if (state.cap !== "none" && base.flips) {
          const exactAll = optimaOf(exactOpt(k.c, state.tau, "none"));
          flipChangedAll = tally(base.kinds.map((x, r) => x === "flip" && !runOpt(base.recs[r], state.tau, "none").some((g) => inSet(exactAll, g))));
        }
        return {
          sameReport: tally(kept),
          together: tally(optima.map((gs) => gs.every((g) => g[k.a] === g[k.b]))),
          flipChanged: changedIn("flip"),
          tieChanged: changedIn("tie"),
          flipChangedAll,
          tiedRuns: tiedSizes.length,
          tiedLo: tiedSizes.length ? Math.min(...tiedSizes) : 0,
          tiedHi: tiedSizes.length ? Math.max(...tiedSizes) : 0,
        };
      }

      // ------------------------------------------------------------------------------------------- drawing: stage
      function choiceWords(best, i, j) {
        const has = (x) => best.includes(x);
        if (best.length > 1) return T.aloneWords.tie;
        if (has("withhold")) return T.aloneWords.withheld;
        return words(has("iAboveJ") ? T.aloneWords.stated : T.aloneWords.reversed, { i, j });
      }

      function disclosurePlotWidth(slot) {
        return slot.clientWidth || Math.max(240, ctx.width() - 32);
      }

      function drawRun(state, k) {
        const VC = V2_CHART;
        const xMax = Math.min(1, Math.max(0.5, ...k.fr.pairs.map((p) => p.weightedError + CONFIG.z * (p.mcse ?? 0))));
        const delta = k.env.deltaW;
        const gHat = k.optHat.grade;
        runRows = k.X.least.map((p) => {
          const f = k.frBy.get(pairKey(p.i, p.j));
          const m = f.mcse ?? 0;
          const key = pairKey(p.i, p.j);
          return {
            key,
            name: PAIR_BY_KEY.get(key).name,
            i: p.i,
            j: p.j,
            exact: p.e,
            above: p.above,
            est: f.weightedError,
            estAbove: f.betterDirection === "i_ahead" ? f.i : f.j,
            mcse: m,
            lo2: Math.max(0, f.weightedError - CONFIG.z * m),
            hi2: Math.min(xMax, f.weightedError + CONFIG.z * m),
            envLo: Math.max(0, f.weightedError - delta),
            envHi: Math.min(xMax, f.weightedError + delta),
            fragile: f.fragile === true,
            selected: key === k.sel.key,
            rel: words(T.rel[relationOf(gHat, p.i, p.j)], { i: IDS[p.i], j: IDS[p.j] }),
          };
        });
        const rows = runRows;
        const width = runSlot.clientWidth || ctx.width();
        const narrow = width < VC.narrow;
        const fragile = rows.filter((r) => r.fragile);
        const sel = rows.find((r) => r.selected);
        const inner = Math.max(1, width - VC.marginLeft - VC.marginRight);
        const xPx = (v) => (v / xMax) * inner;
        const estMark = sel ? (() => {
          const textPx = fmtRoP(sel.est).length * VC.font * VC.estChar;
          const right = Math.max(sel.hi2, sel.exact);
          if (xPx(right) + VC.diamond + VC.estGap + textPx <= inner - 2) {
            return { key: sel.key, x: right, v: sel.est, dx: VC.diamond + VC.estGap, dy: 0, anchor: "start", line: "middle" };
          }
          const at = xPx(sel.est);
          const anchor = at + textPx / 2 > inner ? "end" : at - textPx / 2 < 0 ? "start" : "middle";
          const dx = anchor === "end" ? VC.dot : anchor === "start" ? -VC.dot : 0;
          const x0 = anchor === "end" ? at + dx - textPx : anchor === "start" ? at + dx : at - textPx / 2;
          const span = [x0 - VC.estHalo, x0 + textPx + VC.estHalo];
          const hits = (spans) => spans.some(([a, b]) => a < span[1] && b > span[0]);
          const marksOf = (r) => [
            [xPx(r.est) - VC.dot - 1, xPx(r.est) + VC.dot + 1],
            [xPx(r.exact) - VC.diamond - 1, xPx(r.exact) + VC.diamond + 1],
            ...(r.mcse > 0 ? [r.lo2, r.hi2].map((v) => [xPx(v) - VC.whisker, xPx(v) + VC.whisker]) : []),
          ];
          const tx = xPx(state.tau);
          const tauSpans = [
            [tx - VC.tauLabelGap - VC.font * VC.estChar, tx],
            [tx, tx + VC.tauLabelGap + fmtSet(state.tau).length * VC.font * VC.estChar],
          ];
          const rowIdx = rows.indexOf(sel);
          const aboveFree = rowIdx === 0 ? !hits(tauSpans) : !hits(marksOf(rows[rowIdx - 1]));
          if (aboveFree) return { key: sel.key, x: sel.est, v: sel.est, dx, dy: -VC.estAbove, anchor, line: "bottom" };
          if (rowIdx < rows.length - 1 && !hits(marksOf(rows[rowIdx + 1]))) return { key: sel.key, x: sel.est, v: sel.est, dx, dy: VC.estBelow, anchor, line: "top" };
          return { key: sel.key, x: Math.min(sel.lo2, sel.exact), v: sel.est, dx: -(VC.diamond + VC.estGap), dy: 0, anchor: "end", line: "middle" };
        })() : null;

        const rowTitle = (r) => {
          const flip = r.estAbove !== r.above
            ? words(T.flip, { x: IDS[r.estAbove], y: IDS[r.estAbove === r.i ? r.j : r.i], u: IDS[r.above], v: IDS[r.above === r.i ? r.j : r.i] })
            : "";
          return words(T.kbdRow, {
            name: r.name,
            est: fmtP(r.est),
            m: fmtSe(r.mcse),
            exact: fmtP(r.exact),
            frag: r.fragile ? words(T.kbdFragile, { tau: fmtSet(state.tau) }) : T.kbdNot,
            rel: r.rel,
          }) + flip;
        };

        const caption = [
          T.runTable,
          ...(fragile.length
            ? fill(T.runTableFragile, { n: () => count(fragile.length, "frag-count"), M: () => count(M, "frag-M") })
            : fill(T.runTableNone, { M: () => count(M) })),
        ];

        runFigure = plot(runSlot, {
          alt: T.runAlt,
          table: {
            caption,
            columns: [
              { label: T.tPair, value: "name" },
              { label: T.tExact, value: "exact", format: fmtP },
              { label: T.tEst, value: "est", format: fmtP },
              { label: T.tMcse, value: "mcse", format: fmtSe },
              { label: T.tFragile, value: (r) => (r.fragile ? T.yes : T.no) },
              { label: T.tRel, value: "rel" },
            ],
            rows,
          },
          height: VC.marginTop + VC.marginBottom + rows.length * VC.row,
          marginTop: VC.marginTop,
          marginBottom: VC.marginBottom,
          marginLeft: VC.marginLeft,
          marginRight: VC.marginRight,
          x: {
            domain: [0, xMax],
            label: k.L.w.length > 1 ? (narrow ? T.xLabelABShort : T.xLabelAB) : narrow ? T.xLabelShort : T.xLabel,
            labelAnchor: "center",
            labelArrow: "none",
            grid: true,
            ticks: narrow ? VC.xTicksNarrow : VC.xTicksWide,
          },
          y: { type: "band", domain: rows.map((r) => r.key), axis: null, paddingInner: 0, paddingOuter: 0 },
          marks: (c, P) => {
            const withSe = rows.filter((r) => r.mcse > 0);
            return [
              P.barX(rows, { x1: "envLo", x2: "envHi", y: "key", fill: c.plotGrid, fillOpacity: VC.bandOpacity, insetTop: VC.bandInset, insetBottom: VC.bandInset }),
              P.ruleX([state.tau], { stroke: c.plotFg, strokeWidth: VC.tauWidth, strokeDasharray: VC.tauDash }),
              P.ruleY(withSe, { y: "key", x1: "lo2", x2: "hi2", stroke: c.est, strokeWidth: VC.whisker }),
              P.tickX(withSe, { x: "lo2", y: "key", stroke: c.est, strokeWidth: VC.whisker, insetTop: VC.capInset, insetBottom: VC.capInset }),
              P.tickX(withSe, { x: "hi2", y: "key", stroke: c.est, strokeWidth: VC.whisker, insetTop: VC.capInset, insetBottom: VC.capInset }),
              P.dot(rows, { x: "est", y: "key", r: VC.dot, fill: c.est, stroke: c.plotBg, strokeWidth: 1 }),
              P.dot(rows, { x: "exact", y: "key", symbol: "diamond", r: VC.diamond, fill: "none", stroke: c.plotFg, strokeWidth: VC.diamondWidth }),
              P.barX(fragile, { x1: 0, x2: xMax, y: "key", fill: "none", stroke: c.plotFg, strokeWidth: VC.outline }),
              P.text(fragile, { x: xMax, y: "key", text: () => T.fragileTag, dx: VC.tagGap, textAnchor: "start", fill: c.plotFg, fontSize: VC.font }),
              P.text(rows.filter((r) => !r.selected), { x: 0, y: "key", text: "name", dx: -VC.labelGap, textAnchor: "end", fill: c.plotFg, fontSize: VC.font }),
              P.text(rows.filter((r) => r.selected), { x: 0, y: "key", text: (r) => `${T.selectedMark}${r.name}`, dx: -VC.labelGap, textAnchor: "end", fill: c.plotFg, fontSize: VC.font, fontWeight: "bold" }),
              P.text([state.tau], { x: (v) => v, frameAnchor: "top", dy: VC.tauLabelDy, dx: -VC.tauLabelGap, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: VC.font }),
              numText([state.tau], { x: (v) => v, frameAnchor: "top", dy: VC.tauLabelDy, dx: VC.tauLabelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: VC.font }),
              ...(estMark ? [numText([estMark], {
                x: "x",
                y: "key",
                value: "v",
                format: fmtRoP,
                dx: estMark.dx,
                dy: estMark.dy,
                textAnchor: estMark.anchor,
                lineAnchor: estMark.line,
                fill: c.plotFg,
                fontSize: VC.font,
                fontWeight: "bold",
                stroke: c.plotBg,
                strokeWidth: VC.estHalo,
                paintOrder: "stroke",
              })] : []),
            ];
          },
          keyboard: {
            data: rows,
            x: "est",
            y: "key",
            key: "key",
            sort: false,
            label: T.kbdLabel,
            title: rowTitle,
            onFocus: (r) => { if (r.key !== ctx.state.pair) ctx.set({ pair: r.key }); },
          },
        });

        const buttons = [...runFigure.area.querySelectorAll(".prx-kbd-point")];
        const at = rows.findIndex((r) => r.selected);
        if (at >= 0 && buttons.length === rows.length && ctx.doc.activeElement?.parentNode !== buttons[0]?.parentNode) {
          buttons.forEach((bt, i) => { bt.tabIndex = i === at ? 0 : -1; });
        }

        runTitle.replaceChildren(...fill(T.runHead, { S: () => count(state.S, "run-S"), seed: () => num(state.seed, fmtSet(state.seed), "run-seed") }));
        runKey.replaceChildren(
          item("prx-mce-sw-est", "Estimate ±", zNum(), " MCSE"),
          item("prx-mce-sw-diamond", "Exact"),
          item("prx-mce-sw-band", "Envelope ±", num(delta, fmtRoEst(delta), "key-radius"), " (≥", pNum(), ")"),
          item("prx-mce-sw-tau", "τ ", num(state.tau, fmtSet(state.tau))),
          item("prx-mce-sw-fragile", "Fragile"),
        );

        pairAuditWrap.replaceChildren(renderDataTable(ctx, {
          caption: ["All ", count(M), " pairs in this run (ordered by exact error)"],
          sticky: 1,
          scroll: false,
          rows,
          columns: [
            { key: "name", label: T.tPair, rowHeader: true, name: true },
            { key: "exact", label: T.tExact, kind: "decimal", digits: 4 },
            { key: "est", label: T.tEst, kind: "decimal", digits: 4 },
            { key: "mcse", label: T.tMcse, kind: "decimal", digits: 4 },
            { label: T.tFragile, value: (r) => (r.fragile ? T.yes : T.no) },
            { key: "rel", label: T.tRel },
          ],
        }));
      }

      function writeStageStrip(state, k, base) {
        const eSel = k.X.wE[k.a][k.b];
        const gap = Math.abs(eSel - state.tau);
        const seExact = k.L.w.length === 1 && eSel >= CONFIG.seFrom ? exactSe(eSel, state.S) : null;
        const parts = [
          k.sel.name,
          ": |exact − τ| = ",
          num(gap, fmtRoEst(gap)),
        ];
        if (seExact !== null) {
          parts.push(" (exact-e ", zNum(), " MCSE ≈ ", num(CONFIG.z * seExact, fmtRoEst(CONFIG.z * seExact)), ")");
        }
        if (base) {
          parts.push(" · flagged fragile in ", count(base.fragile), " of ", count(base.R), " runs.");
        } else {
          parts.push(" · computing ", count(CONFIG.runs), " runs…");
        }
        stageStrip.replaceChildren(...parts);
      }

      // ------------------------------------------------------------------------------------------- drawing: over S (Data)
      function drawOverS(state, k) {
        const VO = V2_CHART.overS;
        const e = k.X.wE[k.a][k.b];
        const series = overSMemo(`${k.c}|${k.a}|${k.b}`, k.c, e);
        const one = k.L.w.length === 1;
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const first = series[0];
        const lo = Math.max(0, Math.min(e - first.r, state.tau) - VO.pad);
        const hi = Math.min(1, Math.max(e + first.r, state.tau) + VO.pad);
        const est = k.main.rec.wHat[k.a][k.b];
        const now = { S: state.S, r: k.env.deltaW, se: one ? exactSe(e, state.S) : null };
        const reads = [...new Set([...CONFIG.overS.read, state.S])].sort((x, y) => x - y)
          .map((S) => (S === state.S ? now : series.find((d) => d.S === S) ?? { S, r: envelopeFor(k.c, S).deltaW, se: one ? exactSe(e, S) : null }));
        const width = disclosurePlotWidth(overSlot);
        const narrow = width < V2_CHART.narrow;
        overTitle.replaceChildren(...fill(T.overHead, { name: k.sel.name }));
        plot(overSlot, {
          alt: T.overAlt,
          width,
          table: {
            caption: T.overTable,
            columns: [
              { label: T.tS, value: "S", format: (v) => fmtCount(v) },
              { label: T.tExact, value: () => e, format: fmtP },
              ...(one ? [{ label: T.tSe2, value: (d) => (d.se === null || e < CONFIG.seFrom ? null : CONFIG.z * d.se), format: (v) => (v === null ? "" : fmtSe(v)) }] : []),
              { label: T.tRadius, value: "r", format: fmtR },
            ],
            rows: reads,
          },
          height: VO.height,
          marginTop: VO.marginTop,
          marginBottom: VO.marginBottom,
          marginLeft: VO.marginLeft,
          marginRight: VO.marginRight,
          x: { domain: [CONFIG.overS.from, CONFIG.overS.to], label: T.overX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: narrow ? VO.xTicksNarrow : VO.xTicksWide },
          y: { domain: [lo, hi], label: words(one ? T.overY : T.overYAB, { i: iName, j: jName }), labelAnchor: "center", labelArrow: "none", grid: true, ticks: VO.yTicks },
          marks: (c, P) => [
            P.areaY(series, { x: "S", y1: (d) => Math.max(lo, e - d.r), y2: (d) => Math.min(hi, e + d.r), fill: c.plotGrid, fillOpacity: V2_CHART.bandOpacity, curve: "linear" }),
            ...(one ? [P.areaY(series.filter((d) => d.se !== null), {
              x: "S", y1: (d) => Math.max(lo, e - CONFIG.z * d.se), y2: (d) => Math.min(hi, e + CONFIG.z * d.se), fill: c.est, fillOpacity: VO.bandOpacity, curve: "linear",
            })] : []),
            P.ruleY([state.tau], { stroke: c.plotFg, strokeWidth: V2_CHART.tauWidth, strokeDasharray: V2_CHART.tauDash }),
            P.text([state.tau], { y: (v) => v, frameAnchor: "right", dy: VO.labelDy, dx: -V2_CHART.tauLabelGap - 30, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: V2_CHART.font, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
            numText([state.tau], { y: (v) => v, frameAnchor: "right", dy: VO.labelDy, dx: -30 + V2_CHART.tauLabelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: V2_CHART.font, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }),
            P.ruleY([e], { stroke: c.plotFg, strokeWidth: VO.exactWidth }),
            P.ruleX([state.S], { stroke: c.plotMuted, strokeWidth: VO.shownWidth, strokeDasharray: VO.shownDash }),
            P.dot([{ S: state.S, v: est }], { x: "S", y: "v", r: VO.dot, fill: c.est, stroke: c.plotBg, strokeWidth: 1 }),
          ],
          keyboard: {
            data: reads,
            x: "S",
            y: () => e,
            key: (d) => `S${d.S}`,
            label: T.kbdOverLabel,
            title: (d) => words(T.kbdOver, {
              S: fmtCount(d.S),
              e: fmtP(e),
              r: fmtR(d.r),
              se: d.se === null || e < CONFIG.seFrom ? "" : words(T.kbdOverSe, { z: fmtCount(CONFIG.z), x: fmtSe(CONFIG.z * d.se) }),
            }),
          },
        });
        overKey.replaceChildren(
          item("prx-mce-sw-flat", ...fill(T.keyOverExact, { e: () => num(e, fmtP(e)) })),
          ...(one ? [item("prx-mce-sw-seband", ...fill(T.keyOverSe, { z: zNum }))] : []),
          item("prx-mce-sw-band", T.keyOverBand),
          item("prx-mce-sw-tau", ...fill(T.keyTau, { tau: () => num(state.tau, fmtSet(state.tau)) })),
          item("prx-mce-sw-dot", ...fill(T.keyOverNow, { S: () => count(state.S) })),
        );
        overNote.hidden = one;
        overNote.replaceChildren(...(one ? [] : fill(T.overNoteAB, { z: zNum })));
      }

      // ------------------------------------------------------------------------------------------- drawing: reports & tally (Data)
      function card(title, opt, which) {
        const tag = tagNode(ctx, opt, { key: which });
        const sizes = (opt.grades ?? []).map((g) => disclosure(g).N);
        const differ = sizes.some((x) => x !== sizes[0]);
        const others = () => h("span", {}, ...sizes.slice(1).flatMap((x, i, all) => [
          ...(i ? [i === all.length - 1 ? T.and : ", "] : []),
          count(x, `${which}-N-tied`),
        ]));
        const states = differ
          ? fill(T.statesTied, { N: () => count(opt.N, `${which}-N`), M: () => count(M), others, reports: sizes.length > 2 ? T.tiedReports : T.tiedReport })
          : fill(T.states, { N: () => count(opt.N, `${which}-N`), M: () => count(M) });
        const out = h(
          "div",
          { class: "prx-mce-card" },
          h("p", { class: "prx-mce-card-head", text: title }),
          h("p", { class: "prx-mce-blocks" }, blocksText(opt.grade, IDS)),
          h("p", { class: "prx-mce-tagline" }, tag, which === "est" ? T.forEst : T.forExact),
          h("p", { "data-prx-note": `${which}-states` }, ...states),
        );
        const ties = opt.tieCount ?? opt.grades?.length ?? 1;
        if (ties > 1) {
          const slots = { n: () => count(ties, `${which}-ties`), tol: () => num(CONFIG.tieTol, formatSci(CONFIG.tieTol, { trim: true })) };
          out.append(differ
            ? h("p", {}, ...fill(T.tiesDiffer, slots), captionNode(ctx, "different-disclosure"), ".")
            : h("p", {}, ...fill(T.ties, slots)));
        }
        return out;
      }

      function relWords(rel, i, j) {
        return words(T.rel[rel] ?? T.rel.withheld, { i: IDS[i], j: IDS[j] });
      }

      function drawReports(state, k) {
        cardEst.replaceChildren(card(T.fromEst, k.optHat, "est"));
        cardExact.replaceChildren(card(T.fromExact, k.optExact, "exact"));
        repNote.replaceChildren(...fill(T.grade1, { target: T.targets[k.c] }), " ", T.joint);
        const changed = k.change.pairs.filter((p) => p.from !== p.to);
        const tiedExact = optimaOf(k.optExact).length > 1;
        const tiedHat = optimaOf(k.optHat).length > 1;
        if (!changed.length) repCompare.replaceChildren(T.same);
        else if (tiedExact && inExact(k.optExact, k.optHat.grade)) repCompare.replaceChildren(T.sameTied);
        else if (tiedHat && inExact(k.optHat, k.optExact.grade)) repCompare.replaceChildren(T.sameTiedEst);
        else {
          const list = [];
          changed.forEach((p, idx) => {
            if (idx) list.push("; ");
            list.push(words(T.changeItem, { name: PAIR_BY_KEY.get(pairKey(p.i, p.j)).name, from: relWords(p.from, p.i, p.j), to: relWords(p.to, p.i, p.j) }));
          });
          repCompare.replaceChildren(...fill(T.differ, {
            n: () => count(changed.length, "rep-changed"),
            pairs: changed.length === 1 ? T.pairWord : T.pairsWord,
            list: () => h("span", {}, ...list),
          }));
        }
        aloneLine.replaceChildren(...fill(k.L.w.length > 1 ? T.aloneAB : T.alone, { one: () => num(1, fmtCount(1)) }));
      }

      function drawTally(state, k, base, rep) {
        const run = { ...base, ...rep };
        const R = () => count(run.R);
        const of = (n, hook) => fill(T.tallyOf, { k: () => count(n, hook), R });
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const tiedExact = optimaOf(k.optExact).length > 1;
        const reportLabel = run.tiedRuns ? (tiedExact ? T.tallyReportAmongTied : T.tallyReportAmong) : (tiedExact ? T.tallyReportTied : T.tallyReport);
        const row = (label, value, note) => h("tr", note ? { "data-prx-note": note } : {}, h("th", { scope: "row" }, ...label), h("td", {}, ...value));
        const table = h(
          "table",
          { class: "prx-mce-tally" },
          h("caption", {}, ...fill(T.tallyCaption, {
            R,
            from: () => num(run.from, fmtSet(run.from)),
            to: () => num(run.to, fmtSet(run.to)),
            wrap: () => seedWrap(run.from, run.to),
          })),
          h(
            "tbody",
            {},
            row(fill(T.tallyWithin, { name: k.sel.name, z: zNum }), run.within === null ? [T.tallyNone] : of(run.within, "runs-within")),
            row(fill(T.tallyFragile, { name: k.sel.name }), of(run.fragile, "runs-fragile")),
            row(fill(T.tallyChoice, { name: k.sel.name, choice: choiceWords(run.exactChoice, iName, jName) }), of(run.same, "runs-choice")),
            ...(run.ties ? [row(fill(T.tallyTie, { name: k.sel.name }), of(run.ties, "runs-ties"), "tally-ties")] : []),
            row([reportLabel], of(run.sameReport, "runs-same"), "tally-report"),
            row([T.tallyEnvelope], of(run.held, "runs-held")),
          ),
        );
        tallyWrap.replaceChildren(table);

        const capWords = () => h("span", {}, ...fill(T.familyWords[state.cap], { G: () => count(FAMILIES[3].G) }));
        const slots = {
          Family: capWords,
          i: iName,
          j: jName,
          name: k.sel.name,
          R,
          k: () => count(run.together, "runs-together"),
          c: () => count(run.flipChanged, "runs-changed"),
          f: () => count(run.flips, "runs-flips"),
        };
        const line = fill(run.flips ? T.family : T.familyNoFlip, slots);
        if (state.cap !== "none") {
          const gAll = exactOpt(k.c, state.tau, "none").grade;
          const allRel = relationOf(gAll, k.sel.i, k.sel.j);
          const byLaw = relationOf(k.optExact.grade, k.sel.i, k.sel.j) === "withheld" && allRel !== "withheld";
          const byRuns = run.flipChangedAll !== null && run.flipChangedAll > run.flipChanged;
          const [x, y] = allRel === "above" ? [k.sel.i, k.sel.j] : [k.sel.j, k.sel.i];
          const capSlots = { x: IDS[x], y: IDS[y], f: () => count(run.flips), cAll: () => count(run.flipChangedAll, "runs-changed-all") };
          if (byRuns) line.push(...fill(byLaw ? T.familyCapBoth : T.familyCapRuns, capSlots));
          else if (byLaw) line.push(...fill(T.familyCap, capSlots));
        }
        familyLine.replaceChildren(...line);

        const tol = () => num(CONFIG.tieTol, formatSci(CONFIG.tieTol, { trim: true }));
        const ties = [];
        if (run.ties) {
          ties.push(...fill(run.flips ? T.pairTies : T.pairTiesOnly, {
            t: () => count(run.ties, "runs-ties-n"),
            name: k.sel.name,
            tol,
            ct: () => count(run.tieChanged, "runs-ties-changed"),
          }));
        }
        if (run.tiedRuns) {
          const n = () => (run.tiedLo === run.tiedHi
            ? count(run.tiedLo, "runs-tied-reports")
            : h("span", {}, ...fill(T.tiedCount, { lo: () => count(run.tiedLo), hi: () => count(run.tiedHi) })));
          if (ties.length) ties.push(" ");
          ties.push(...fill(T.reportTies, {
            u: () => count(run.tiedRuns, "runs-tied"),
            n,
            tolPart: () => h("span", {}, ...(run.ties ? [] : fill(T.reportTiesTol, { tol }))),
          }));
        }
        tieLine.hidden = !ties.length;
        tieLine.replaceChildren(...ties);
      }

      // ------------------------------------------------------------------------------------------- drawing: 100 runs (Data)
      function histogram(slot, { which, values, grid, lines, alt, caption, xLabel, kbdLabel, fill: fillColor, extend = [], bins: given, padRight = false }) {
        const VH = V2_CHART.hist;
        const width = disclosurePlotWidth(slot);
        const narrow = width < V2_CHART.narrow;
        const all = [...values, ...extend];
        const lo0 = Math.max(0, Math.min(...all));
        const hi0 = Math.max(...all);
        const b = given ?? binsOf(values, { width: niceWidth((hi0 - lo0) / VH.target, grid), lo: lo0, hi: hi0 });
        const lo = Math.max(0, Math.min(b.lo, lo0));
        const hi = Math.max(b.hi, hi0 + (padRight ? (hi0 - lo) * VH.padShare : 0));
        const yMax = Math.max(1, ...b.bins.map((x) => x.n));
        const R = values.length;
        plot(slot, {
          alt,
          width,
          table: {
            caption,
            columns: [
              { label: T.tFrom, value: (x) => x.from ?? x.lo, format: fmtBin },
              { label: T.tTo, value: (x) => x.to ?? x.hi, format: fmtBin },
              { label: T.tRuns, value: "n", format: (v) => fmtCount(v) },
            ],
            rows: b.bins,
          },
          height: VH.height,
          marginTop: VH.marginTop,
          marginBottom: VH.marginBottom,
          marginLeft: VH.marginLeft,
          marginRight: VH.marginRight,
          x: { domain: [lo, hi], label: xLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: narrow ? VH.xTicksNarrow : VH.xTicksWide },
          y: { domain: [0, yMax], nice: true, label: T.tRuns, labelAnchor: "center", labelArrow: "none", grid: true, ticks: VH.yTicks },
          marks: (c, P) => [
            ...lines.under(c, P),
            P.rect(b.bins, { x1: "lo", x2: "hi", y1: 0, y2: "n", fill: c[fillColor], stroke: c.plotBg, strokeWidth: VH.rim }),
            P.ruleY([0], { stroke: c.plotAxis }),
            ...lines.over(c, P),
          ],
          keyboard: {
            data: b.bins,
            x: (x) => (x.lo + x.hi) / 2,
            y: "n",
            key: (x) => `${which}${x.i}`,
            label: kbdLabel,
            title: (x) => words(T.kbdBin, { n: fmtCount(x.n), R: fmtCount(R), lo: fmtBin(x.from ?? x.lo), hi: fmtBin(x.to ?? x.hi) }),
          },
        });
      }

      function drawRuns(state, k, run) {
        const VH = V2_CHART.hist;
        const pairName = k.sel.name;
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const ab = k.L.w.length > 1;
        const m2 = CONFIG.z * run.m1;
        const grid = Math.min(...k.L.w.filter((x) => x > 0)) / state.S;
        const lowEnd = Math.min(...run.est, run.e - m2);
        const highEnd = Math.max(...run.est, run.e + m2);
        const reach = Math.max(highEnd - lowEnd, grid) * VH.reach;
        const tauNear = run.constant !== null || (state.tau >= lowEnd - reach && state.tau <= highEnd + reach);
        h1Head.replaceChildren(...fill(ab ? T.hist1HeadAB : T.hist1Head, { name: pairName, i: iName, j: jName }));
        const constantBins = run.constant === null ? null : (() => {
          const v = run.constant;
          const span = Math.max(v, state.tau, run.e) - Math.min(v, state.tau, run.e);
          const w = Math.max(grid, span / VH.constantShare);
          const x1 = Math.max(0, v - w / 2);
          return { lo: x1, hi: x1 + w, bins: [{ i: 0, lo: x1, hi: x1 + w, from: v, to: v, n: run.R }] };
        })();
        histogram(h1Slot, {
          which: "est",
          values: run.est,
          grid,
          fill: "est",
          bins: constantBins,
          padRight: tauNear,
          extend: [run.e, ...(m2 > 0 ? [run.e - m2, run.e + m2] : []), ...(tauNear ? [state.tau] : [])],
          alt: T.hist1Alt,
          caption: T.hist1Table,
          kbdLabel: T.kbdHist1,
          xLabel: words(ab ? T.hist1XAB : T.hist1X, { i: iName, j: jName }),
          lines: {
            under: (c, P) => (m2 > 0 ? [P.rect([0], { x1: run.e - m2, x2: run.e + m2, fill: c.est, fillOpacity: VH.bandOpacity })] : []),
            over: (c, P) => [
              ...(tauNear ? [
                P.ruleX([state.tau], { stroke: c.plotFg, strokeWidth: VH.tauWidth, strokeDasharray: VH.tauDash }),
                P.text([state.tau], { x: (v) => v, frameAnchor: "top", dy: VH.labelDy, dx: -VH.labelGap, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: V2_CHART.font, stroke: c.plotBg, strokeWidth: VH.halo, paintOrder: "stroke" }),
                numText([state.tau], { x: (v) => v, frameAnchor: "top", dy: VH.labelDy, dx: VH.labelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: V2_CHART.font, stroke: c.plotBg, strokeWidth: VH.halo, paintOrder: "stroke" }),
              ] : []),
              P.ruleX([run.e], { stroke: c.plotFg, strokeWidth: VH.exactWidth }),
              P.dot([run.est[0]], { x: (v) => v, frameAnchor: "top", dy: VH.markerDy, symbol: "triangle", rotate: 180, r: VH.marker, fill: c.plotFg }),
            ],
          },
        });
        h1Key.replaceChildren(
          item("prx-mce-sw-bar prx-mce-sw-bar-est", T.keyRuns),
          item("prx-mce-sw-exact", ...fill(T.keyExactLine, { e: () => num(run.e, fmtP(run.e)) })),
          ...(m2 > 0 ? [item("prx-mce-sw-seband", ...fill(T.keyBand2, { z: zNum }))] : []),
          ...(tauNear ? [item("prx-mce-sw-tau", ...fill(T.keyTauLine, { tau: () => num(state.tau, fmtSet(state.tau)) }))] : []),
          item("prx-mce-sw-marker", T.keyShown),
        );
        const spread = fill(T.spread, {
          R: () => count(run.R),
          sd: () => num(run.sd, fmtSe(run.sd), "runs-sd"),
          m: () => num(run.m1, fmtSe(run.m1), "runs-mcse"),
        });
        if (run.constant !== null) {
          const v = run.constant;
          const t = v === 0 ? (ab ? T.constantZeroAB : T.constantZero) : v === 1 ? T.constantOne : T.constantOther;
          h1Spread.replaceChildren(
            ...fill(t, { R: () => count(run.R), v: () => num(v, fmtP(v), "runs-constant"), i: iName, j: jName }),
            " ",
            ...spread,
            " ",
            T.constantCaution,
          );
        } else {
          if (!tauNear) {
            spread.push(" ", ...fill(T.offScale, { tau: () => num(state.tau, fmtSet(state.tau)), side: state.tau > highEnd ? T.sides.right : T.sides.left }));
          }
          h1Spread.replaceChildren(...spread);
        }

        const h2Width = disclosurePlotWidth(h2Slot);
        histogram(h2Slot, {
          which: "max",
          values: run.maxErr,
          grid: 0,
          fill: "plotMuted",
          extend: [0, k.env.eps[0], k.env.book],
          alt: T.hist2Alt,
          caption: T.hist2Table,
          kbdLabel: T.kbdHist2,
          xLabel: h2Width < V2_CHART.narrow ? T.hist2XShort : T.hist2X,
          lines: {
            under: () => [],
            over: (c, P) => [
              P.ruleX([k.env.eps[0]], { stroke: c.plotFg, strokeWidth: VH.envWidth }),
              P.ruleX([k.env.book], { stroke: c.plotFg, strokeWidth: VH.envWidth, strokeDasharray: VH.bookDash }),
            ],
          },
        });
        h2Key.replaceChildren(
          item("prx-mce-sw-bar prx-mce-sw-bar-max", T.keyMax),
          item("prx-mce-sw-env", ...fill(T.keyEnv, { r: () => num(k.env.eps[0], fmtR(k.env.eps[0])) })),
          item("prx-mce-sw-book", ...fill(T.keyBook, { b: () => num(k.env.book, fmtR(k.env.book)) })),
        );
        runsTitle.replaceChildren(...fill(T.runsHead, {
          R: () => count(run.R, "runs-R"),
          S: () => count(state.S, "runs-S"),
          from: () => num(run.from, fmtSet(run.from), "runs-from"),
          to: () => num(run.to, fmtSet(run.to), "runs-to"),
          wrap: () => seedWrap(run.from, run.to),
        }));
      }

      // ------------------------------------------------------------------------------------------- drawing: ledger (Method)
      function drawLedger(state, k) {
        const env = k.env;
        const ab = env.K > 1;
        const cell = (note, content) => h("td", note ? { "data-prx-note": note } : {}, ...content);
        const row = (label, a, b, note) => h("tr", {}, h("th", { scope: "row", text: label }), cell(null, a), cell(note, b));
        const m = k.frSel.mcse ?? 0;
        const table = h(
          "table",
          { class: "prx-mce-ledger" },
          h("caption", { text: T.ledCaption }),
          h("thead", {}, h("tr", {}, h("td", {}), h("th", { scope: "col", text: T.ledMcse }), h("th", { scope: "col", text: T.ledEnv }))),
          h(
            "tbody",
            {},
            row(
              T.ledHere,
              fill(T.ledHereMcse, { name: k.sel.name, m: () => num(m, fmtSe(m), "led-mcse") }),
              fill(ab ? T.ledHereEnvAB : T.ledHereEnv, {
                r: () => num(env.deltaW, fmtR(env.deltaW), "led-radius"),
                a: () => num(ab ? env.alphaK : CONFIG.alpha, fmtSet(ab ? env.alphaK : CONFIG.alpha)),
              }),
            ),
            row(T.ledWhat, [T.ledWhatMcse], [T.ledWhatEnv]),
            row(T.ledHolds, [T.ledHoldsMcse], fill(T.ledHoldsEnv, { p: pNum }), "holds-env"),
            row(T.ledChosen, [T.ledChosenMcse], [T.ledChosenEnv]),
            h("tr", {}, h("th", { scope: "row", text: T.ledDouble }), h("td", { colspan: 2, "data-prx-note": "doubling" }, ...fill(T.ledDoubleText, { two: () => num(2, fmtCount(2)) }))),
          ),
        );
        ledgerWrap.replaceChildren(table);

        const f1 = formulaNums();
        const math1 = h("span", { class: "prx-mce-math" });
        renderTex(math1, `\\varepsilon = \\sqrt{\\log(${f1.num(2, fmtCount(2))}M/\\alpha)/(${f1.num(2, fmtCount(2))}S)}`, { nums: f1.raws });
        const f2 = formulaNums();
        const two = () => f2.num(2, fmtCount(2));
        const tex2 = `= \\sqrt{\\log(${two()} \\cdot ${f2.num(M, fmtCount(M))}/${f2.num(env.alphaK, fmtSet(env.alphaK))})/(${two()} \\cdot ${f2.num(state.S, fmtCount(state.S))})} =\\; ${f2.num(env.eps[0], fmtR(env.eps[0]))}`;
        const math2 = h("span", { class: "prx-mce-math" });
        renderTex(math2, tex2, { nums: f2.raws });
        const last = math2.querySelectorAll("mtext");
        last[last.length - 1]?.setAttribute("data-prx-readout", "formula-radius");
        formula.replaceChildren(T.formulaLead, " ", math1, " ", math2, " ", ...fill(ab ? T.formulaNoteAB : T.formulaNote, {
          M: () => count(M),
          a: () => num(env.alphaK, fmtSet(env.alphaK)),
          total: () => num(CONFIG.alpha, fmtSet(CONFIG.alpha)),
          dw: () => num(env.deltaW, fmtR(env.deltaW)),
        }));
        bookLine.replaceChildren(...fill(ab ? T.bookAB : T.book, {
          four: () => num(4, fmtCount(4)),
          two: () => num(2, fmtCount(2)),
          K: () => count(env.K),
          b: () => num(env.book, fmtR(env.book), "book-radius"),
          a: () => num(CONFIG.alpha, fmtSet(CONFIG.alpha)),
        }));
        const eSel = k.X.wE[k.a][k.b];
        const gap = Math.abs(eSel - state.tau);
        const pair = fill(T.pairExact, { name: k.sel.name, gap: () => num(gap, fmtSe(gap), "exact-gap") });
        const x = k.L.w.length === 1 && eSel >= CONFIG.seFrom ? exactSe(eSel, state.S) : null;
        if (x !== null) {
          pair.push(...fill(T.pairExactSe, {
            one: () => num(1, fmtCount(1)),
            z: zNum,
            x: () => num(x, fmtSe(x), "exact-se"),
            x2: () => num(CONFIG.z * x, fmtSe(CONFIG.z * x), "exact-2se"),
          }));
        }
        pairLine.replaceChildren(...pair);
        ruleLine.replaceChildren(...fill(T.rule, { ij: () => h("sub", {}, "ij"), ji: () => h("sub", {}, "ji"), z: zNum }));
        sameELine.replaceChildren(...fill(T.sameE, { name: k.sel.name, e: () => num(k.exactRow.e, fmtP(k.exactRow.e), "same-e") }));
      }

      // ------------------------------------------------------------------------------------------- readout & caption
      function writeReadout(state, k, reruns) {
        const f = k.frSel;
        const m = f.mcse ?? 0;
        const estAbove = f.betterDirection === "i_ahead" ? f.i : f.j;
        const flip = estAbove !== k.a ? ` (${IDS[estAbove]}>${IDS[estAbove === f.i ? f.j : f.i]})` : "";

        let fragClause;
        if (m === 0) {
          fragClause = ["; every draw agrees."];
        } else if (f.fragile) {
          fragClause = ["; fragile at τ ", rWriter.setting(state.tau), "."];
        } else {
          fragClause = ["; not fragile (τ ", rWriter.setting(state.tau), " is ", rWriter.est(f.ratio, { hook: "read-ratio" }), " MCSE away)."];
        }

        const changed = k.change.changed;
        let reportHead;
        if (!changed) reportHead = [" Reports agree"];
        else if (inExact(k.optExact, k.optHat.grade)) reportHead = [" Estimated report ties exact best"];
        else if (inExact(k.optHat, k.optExact.grade)) reportHead = [" Exact report ties estimated best"];
        else reportHead = [" Reports differ on ", rWriter.count(changed), changed === 1 ? " pair" : " pairs"];

        let replayTail;
        if (!reruns) {
          replayTail = ["."];
        } else if (reruns.flips) {
          replayTail = [
            "; flips in ",
            rWriter.count(reruns.flips),
            " of ",
            rWriter.count(reruns.R),
            " runs, changing report in ",
            rWriter.count(reruns.flipChanged),
            " of ",
            rWriter.count(reruns.flips),
            ".",
          ];
        } else {
          replayTail = ["; never flips in ", rWriter.count(reruns.R), " runs."];
        }

        rWriter.set([
          k.sel.name,
          " (",
          rWriter.count(state.S, { hook: "read-S" }),
          " draws): estimated ",
          rWriter.prob(f.weightedError, { hook: "read-est" }),
          flip,
          " (MCSE ",
          rWriter.est(m, { hook: "read-mcse" }),
          ") vs. exact ",
          rWriter.prob(k.exactRow.e, { hook: "read-exact" }),
          ...fragClause,
          ...reportHead,
          ...replayTail,
        ]);
      }

      function writeCaption(state) {
        const seeds = seedsOf(state.seed);
        ctx.caption.replaceChildren(
          ...fill(T.caption1, { score: T.scoreNames[state.criteria] }),
          captionNode(ctx, "teaching-posterior"),
          T.caption2,
          captionNode(ctx, "monte-carlo", { S: state.S, seed: state.seed }),
          ...fill(T.caption3, {
            R: () => count(CONFIG.runs),
            from: () => num(seeds[0], fmtSet(seeds[0])),
            to: () => num(seeds.at(-1), fmtSet(seeds.at(-1))),
            wrap: () => seedWrap(seeds[0], seeds.at(-1)),
          }),
        );
      }

      // ------------------------------------------------------------------------------------------- render
      return {
        render(state, info) {
          // PR-06 / PR-09 guard: opening a disclosure re-renders width-dependent figures inside Data at real open width
          // without re-rendering ctx.stage or re-firing ctx.readout.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open) {
              const k = compute(state);
              if (lastRunsBase) drawRuns(state, k, lastRunsBase);
            }
            return;
          }

          score.set(state.criteria);
          sSlider.set(state.S);
          tau.set(state.tau);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
          pairSelect.set(state.pair);
          capSeg.set(state.cap);

          const k = compute(state);
          drawRun(state, k);
          drawOverS(state, k);
          drawReports(state, k);
          drawLedger(state, k);
          writeCaption(state);

          let reruns = null;
          let readyBase = null;

          if (activeJobKey && activeJobKey !== recJob(state) && activeJobKey !== optJob(state)) {
            cancelActiveJob();
          }

          if (recordsReady(state)) {
            busyNote.hidden = true;
            runsBody.classList.remove("prx-mce-stale");
            const base = runsBase(state, k);
            readyBase = base;
            lastRunsBase = base;
            drawRuns(state, k, base);
            if (reportsReady(state, base)) {
              tallyBox.classList.remove("prx-mce-stale");
              const reports = runsReports(state, k, base);
              reruns = { ...base, ...reports };
              drawTally(state, k, base, reports);
              if (!activeJobKey) {
                ctx.root.removeAttribute("aria-busy");
                ctx.timeout(() => {
                  if (!activeJobKey && ctx.root.getAttribute("aria-busy") === "false") {
                    ctx.root.removeAttribute("aria-busy");
                  }
                }, 0);
              }
            } else {
              tallyBox.classList.add("prx-mce-stale");
            }
          } else {
            lastRunsBase = null;
            busyNote.replaceChildren(...fill(T.busy, { R: () => count(CONFIG.runs), S: () => count(state.S) }));
            busyNote.hidden = false;
            runsBody.classList.add("prx-mce-stale");
            tallyBox.classList.add("prx-mce-stale");
          }

          writeStageStrip(state, k, readyBase);
          writeReadout(state, k, reruns);
        },
      };
    },
  });
}
