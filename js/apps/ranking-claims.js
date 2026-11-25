// ranking-claims (app 1.16): "A ranking makes many claims" (Frame v2 Polish migration).
// A strict ranking of n units states one direction for every pair of units, M = n(n − 1)/2 of them, and the posterior
// gives each stated direction "i above j" the probability 1 − π_ij of being wrong. Added over all M stated directions,
// those probabilities are the number of wrong directions the posterior expects.
// Three data sets:
//   six      the six sites of the postrank tutorial, the reading score (data/released/six-sites.json): normal
//            posteriors taken as given, with the package's pair array (pr_tutorial$one); no estimates of their own
//   league   the simulated league (engine league30 and drawLeague at LEAGUE_SEED) with the teaching normal–normal
//            posterior (engine normalPosterior, prior mean 0, prior SD .15) and its pair array (errorArray)
//   krw      Kline, Rose and Walters' 97 firms, race contact gap (data/released/case-krw.json, license cc-by-nc-krw):
//            the released race pair array, posterior means and estimates
// The California schools count comes from data/released/case-cde.json (facts.statewide_schools; M from pairCount).
// Exported for compatibility: CONFIG, onePath, rankingView, datasets, mountWidget.

import { appLink, createWidget } from "../shared/base.js";
import { logLabel, plot } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatProb,
  formatReadoutExpected,
  formatSetting,
  setNum,
} from "../shared/format.js";
import { captionNode, captionNodes, exposeResult, exposedResults } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { ro } from "../shared/readout.js";
import {
  LEAGUE_SEED,
  claimsByDistance,
  drawLeague,
  errorArray,
  evaluateReport,
  expectedMisorderedPairs,
  largestStatedError,
  league30,
  misorderedPairs,
  normalPosterior,
  pairCount,
  statedAbove,
  strictOrder,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import KRW from "../../data/released/case-krw.json" with { type: "json" };
import CDE from "../../data/released/case-cde.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "ranking-claims",
  label: "A ranking makes many claims: the directions a strict ranking states, and how many of them the posterior expects to be wrong",
  className: "prx-rc",
  data: Object.freeze({ values: Object.freeze(["six", "league", "krw"]), value: "krw" }),
  // n: the key's upper bound is the largest data set (KRW's 97 firms); each data set sets it back to its own size
  n: Object.freeze({ min: 2, max: 97, value: 97 }),
  krwCriterion: "race_signed",
  priorMean: 0,
  priorSd: 0.15,
  // evaluateReport needs a τ; the expected wrong count E it returns does not depend on it
  evalTau: 0.2,
  half: 0.5,
  memo: 24,
  // onePath writes coordinates to a hundredth of a pixel
  pathScale: 100,
  // with at most this many units each claim can be read (pointer tip, keyboard, hidden table)
  readMax: 30,
  triangle: Object.freeze({
    maxPx: 356,
    maxPxNarrow: 236,
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 36,
    marginRight: 8,
    outlineMin: 7,
    inset: 0.14,
    outlineInset: 0.5,
    labelGap: 6,
    font: 13,
    allTicks: 12,
    steps: Object.freeze([
      Object.freeze({ upTo: 30, step: 5 }),
      Object.freeze({ upTo: 60, step: 10 }),
      Object.freeze({ upTo: Infinity, step: 20 }),
    ]),
  }),
  scatter: Object.freeze({
    height: 254,
    heightNarrow: 202,
    marginTop: 32,
    marginBottom: 46,
    marginLeft: 48,
    marginRight: 16,
    labelOffset: 36,
    yMax: 0.6,
    yTicks: Object.freeze([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
    dash: "5,4",
    halfDy: 14,
    aboveDy: -10,
    font: 13,
    radius: Object.freeze([
      Object.freeze({ upTo: 12, r: 5 }),
      Object.freeze({ upTo: 30, r: 3.2 }),
      Object.freeze({ upTo: Infinity, r: 1.75 }),
    ]),
    xTicks: 5,
    ring: 0.6,
    aboveRing: 1.2,
    aboveGrow: 1.0,
    aboveDx: 8,
  }),
  strip: Object.freeze({ decades: 8, tickEvery: 2, base: 10 }),
  percent: 100,
  barHeadroom: 1.08,
  digits: Object.freeze({ sd: 2 }),
  text: Object.freeze({
    missing: "The KRW data did not load, so the firms cannot be shown. The six sites and the simulated league still work.",
    dataLegend: "Data",
    dataSix: "Six sites (reading score)",
    dataLeague: "Simulated league ({n} units)",
    dataKrw: "KRW's {n} firms (race)",
    dataKrwMissing: "KRW's firms (did not load)",
    nLabel: "Units ranked, n",
    names: Object.freeze({ six: "Six sites", league: "Simulated league", krw: "KRW's firms" }),
    units: Object.freeze({ six: "sites", league: "units", krw: "firms" }),
    claimsHeading: "How many claims?",
    triCue: "Each square is one stated pair: row rank above column rank.",
    triangleNote: "Each square is one claim: the unit of its row is ranked above the unit of its column. Rows and columns follow the ranking, {first} at the top left. This is the upper half of the matrix on {app}, without the diagonal: a unit makes no claim about itself, and each pair is counted once.",
    apps: Object.freeze({ matrix: "pairwise-matrix", rankings: "which-ranking", majority: "majority-wins" }),
    firstRank: "rank {one}",
    triangleAlt: "A triangle of {M} squares, one for each claim of a strict ranking of {n} {units}: the square in row a and column b states that the unit ranked a is above the unit ranked b.",
    stripHeading: "From six sites to California's schools",
    stripCaption: "Number of claims of a strict ranking, from the six sites to the California schools",
    colData: "Data",
    colN: "Units, n",
    colM: "Claims, M",
    colScale: "Scale",
    stripRows: Object.freeze({ six: "Six sites", league: "Simulated league", krw: "KRW's firms", cde: "California schools", this: "This ranking" }),
    stripNote: "The scale is logarithmic: equal steps to the right multiply the number of claims, from one at the left end to a hundred million at the right. On an ordinary scale every dot but California's would sit at the left end.",
    cdeNote: "California schools: the {n} eligible schools of the California School Dashboard chronic absenteeism data (source below); only their count is used here.",
    errorsHeading: "How many are expected to be wrong?",
    formulaNote: Object.freeze(["Each claim \"i above j\" is wrong with probability ", "{one}", " − π", "{sub}", ". Adding these probabilities over all the claims gives the expected number of wrong claims ("]),
    formulaNoteEnd: "; the report is the ranking we publish: it is taken as given, and nothing here is chosen to lower this count).",
    xLabel: "Places apart in the ranking (neighbors: one)",
    yLabel: "Probability the claim is wrong",
    halfLabel: "one half: a coin flip",
    aboveLabel: " claims above",
    scatterAlt: "Dot plot of the {M} claims of the ranking: across, how many places apart the two units are; up, the probability that the claim is wrong. The highest dots, the least certain claims, are between units close in the ranking.",
    scatterKeys: "Claims of the ranking. Use the arrow keys to read each claim.",
    scatterTable: "Claims of the ranking: the unit ranked higher, the unit ranked lower, how many places apart they are and the probability that the claim is wrong",
    colHigher: "Ranked higher",
    colLower: "Ranked lower",
    colGap: "Places apart",
    colWrong: "Probability wrong",
    gapTable: "Claims of the ranking by how many places apart their two units are: the number of claims, their expected number of wrong claims and the largest probability that one of them is wrong",
    colClaims: "Claims",
    colGapE: "Expected wrong",
    colMaxP: "Largest probability wrong",
    readHint: "Hover, focus or tap a dot to read its claim; with the keyboard, Tab to the plot and use the arrow keys.",
    readHintMany: "With {max} units or fewer, each dot can be read by pointer or keyboard.",
    tipNext: "next to each other",
    tipApart: "{gap} places apart",
    tip: "{hi} above {lo}, {apart}: probability {p} that this claim is wrong",
    least: "The least certain claim, the highest dot: {hi} above {lo}, {apart}: probability {p} that this claim is wrong.",
    aboveHalf: "{count} of these claims sit above one half. For independent normal posteriors, whatever their SDs, the larger posterior mean is always the more likely direction. The firms' race posteriors are not normal (KRW's prior for the race gap allows only positive values), so here it is not always ({rankings} and {majority} show how such summaries part ways). The second sets this order beside majority wins: they differ on exactly these {count2} pairs.",
    compareHeading: "Expected wrong claims, two rankings of the same units",
    barPm: "Ranked by posterior mean",
    barEst: "Ranked by estimate",
    compareNote: "Both rankings make all {M} claims. They disagree on {D} pairs, and the whole difference between the two counts comes from those pairs.",
    compareSame: "Both rankings make all {M} claims and agree on every pair here, so they expect the same number of wrong claims.",
    noEstimates: "The six sites come with posteriors only, without estimates of their own, so there is no estimate order to compare.",
    truth: "The league is simulated, so its true values are known. Against them, {mis} of these {M} claims are wrong in this draw, and {exp} on average over new draws of the estimates. The posterior, which does not know the true values, expects {E}. The two averages answer different questions (over new estimates for these true values; over true values, given these estimates), so they need not agree. Only this second count can be given for real units.",
    readAll: "{name}: ranking all {n} {units} makes {M} pairwise {claims}, with {E} expected wrong by posterior mean",
    readTop: "{name}: ranking the top {n} of {N} {units} makes {M} pairwise {claims}, with {E} expected wrong by posterior mean",
    readEst: " ({Eest} by estimate).",
    readNoEst: ".",
    dataBoxTitle: "Data and dataset comparison",
    methodBoxTitle: "Method and details",
    noteSix: "The reading scores are for six fictional sites in the postrank tutorial data. The calculation uses independent normal posteriors, each with SD {sd}.",
    noteLeague: "Simulated league of {n} units (ten small, ten medium, ten large), one fixed draw of the estimates (seed {seed}); teaching posterior with a normal prior of mean {zero} and SD {prior}.",
    noteKrw: "KRW's firms: the log contact gap of white-named minus Black-named applications, with a smoothed version of KRW's posteriors. Rank {one} is the largest posterior-mean race gap (white over Black names).",
    noticeKrw: "Data: Kline, Rose and Walters (2024), A Discrimination Report Card, American Economic Review, doi:10.1257/aer.20230700; replication deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only. The data shown here are provided as is and without warranty. No endorsement by the authors is implied.",
    noticeKrwChanges: "Changes: the race pair probabilities as adapted in postrank 1.1.0 (pr_case_krw), a smoothed version of KRW's posteriors; firms ranked here by posterior mean, top-n blocks and expected counts computed in this browser.",
    noticeKrwConduct: "The data describe KRW's correspondence experiment, not any firm's current conduct.",
    noticeCde: "School count: California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26, via postrank 1.1.0 (pr_case_cde), used under the CDE's source conditions (https://www.cde.ca.gov/re/di/cr/index.asp). Changes: only the count of the schools in the case study's frame is shown (elementary-type schools with at least 30 students counted). No CDE endorsement is implied.",
  }),
  tex: Object.freeze({ above: "\\mathrm{above}" }),
});

const T = CONFIG.text;
const TRI = CONFIG.triangle;
const SC = CONFIG.scatter;

// ---------------------------------------------------------------------------------------------- helpers

/** Split a "{slot}" template into strings and slot values (a function slot makes a fresh node at each use). */
const fill = (template, slots) => [].concat(template).flatMap((t) => String(t).split(/(\{\w+\})/)).filter((p) => p !== "").map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  if (!m || !(m[1] in slots)) return p;
  const v = slots[m[1]];
  return typeof v === "function" ? v() : v;
});
const fillText = (template, slots) => fill(template, slots).map((p) => (typeof p === "string" ? p : p?.textContent ?? String(p))).join("");

/** Expected count in Data/Method tables and formulas (4 significant digits). */
const fmtE = (E) => formatExpectedCount(E);
/** Expected count in primary readout (3 significant digits below 1,000; exact rounded whole claims at >= 1,000). */
const fmtReadoutE = (E) => (Math.abs(E) >= 999.5 ? formatExpectedCount(E) : formatReadoutExpected(E));
const pickBy = (list, n, field) => (list.find((r) => n <= r.upTo) ?? list.at(-1))[field];

const SVG_NS = "http://www.w3.org/2000/svg";
const px = (v) => Math.round(v * CONFIG.pathScale) / CONFIG.pathScale;

/**
 * A Plot render hook that draws a whole rect or dot mark as one <path> (two elements instead of 2 × 4,656 when the
 * 97 firms are drawn).
 */
export function onePath(shape, { inset = 0, r = 1, attrs = {} } = {}) {
  return (index, scales, values, dimensions, context) => {
    const doc = context.document;
    const g = doc.createElementNS(SVG_NS, "g");
    const path = doc.createElementNS(SVG_NS, "path");
    const parts = [];
    if (shape === "rect") {
      const { x1, x2, y1, y2 } = values;
      for (const i of index) {
        const xa = Math.min(x1[i], x2[i]) + inset;
        const ya = Math.min(y1[i], y2[i]) + inset;
        const w = Math.abs(x2[i] - x1[i]) - 2 * inset;
        const hh = Math.abs(y2[i] - y1[i]) - 2 * inset;
        if (w > 0 && hh > 0) parts.push(`M${px(xa)},${px(ya)}h${px(w)}v${px(hh)}h${px(-w)}z`);
      }
    } else {
      const { x, y } = values;
      const d = px(2 * r);
      for (const i of index) parts.push(`M${px(x[i] - r)},${px(y[i])}a${r},${r} 0 1,0 ${d},0a${r},${r} 0 1,0 ${-d},0`);
    }
    path.setAttribute("d", parts.join(""));
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) path.setAttribute(k, String(v));
    g.append(path);
    return g;
  };
}

// ---------------------------------------------------------------------------------------------- data

const nanDiagonal = (m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)));

function sixData() {
  const u = SIX.tables.units;
  const a = SIX.arrays.one;
  return {
    key: "six", n: u.id.length, ids: u.id.slice(), names: u.id.slice(), mean: u.mean_A.slice(), sd: u.sd_A.slice(), est: null,
    E: { ids: a.ids.map(String), criteria: a.criteria.slice(0, 1), e: [nanDiagonal(a.e[0])] },
  };
}

function leagueData() {
  const L = league30();
  const est = Array.from(drawLeague(LEAGUE_SEED).estimate);
  const se = Array.from(L.se);
  const post = normalPosterior(est, se, { priorMean: CONFIG.priorMean, priorSd: CONFIG.priorSd });
  const ids = Array.from(L.ids);
  const mean = Array.from(post.mean);
  return {
    key: "league", n: ids.length, ids, names: ids, mean, est, se, theta: Array.from(L.theta),
    E: errorArray(mean, Array.from(post.sd), { ids, criteria: ["theta"] }),
  };
}

/** KRW's firms (race) from the released case, or null when its tables are missing. */
function krwData(d = KRW) {
  const u = d?.tables?.units;
  const a = d?.arrays?.error;
  const k = a?.criteria?.indexOf(CONFIG.krwCriterion) ?? -1;
  if (!u || !Array.isArray(u.mean_race) || !Array.isArray(u.race_estimate) || !a || k < 0 || !Array.isArray(a.e?.[k])) return null;
  return {
    key: "krw", n: u.id.length, ids: a.ids.map(String), names: u.firm_name.slice(),
    mean: u.mean_race.slice(), est: u.race_estimate.slice(),
    E: { ids: a.ids.map(String), criteria: [a.criteria[k]], e: [nanDiagonal(a.e[k])] },
  };
}

/** The California schools: the statewide count of eligible schools in case-cde.json, { n, M }. */
function cdeCount(d = CDE) {
  const n = d?.facts?.statewide_schools;
  return Number.isInteger(n) && n > 1 ? { n, M: pairCount(n) } : null;
}

/** The three data sets (built once per page) and the California count. */
export const datasets = (() => {
  let cache = null;
  return () => (cache ??= { six: sixData(), league: leagueData(), krw: krwData(), cde: cdeCount() });
})();

/**
 * One ranking: the top n units of a data set by posterior mean.
 */
export function rankingView(d, nWanted) {
  const n = Math.max(CONFIG.n.min, Math.min(d.n, Math.round(nWanted)));
  const rank = strictOrder(d.mean);
  const top = d.mean.map((_, i) => i).filter((i) => rank[i] <= n).sort((x, y) => rank[x] - rank[y]);
  const rows = d.E.e[0];
  const e = top.map((i) => top.map((j) => (i === j ? Number.NaN : rows[i][j])));
  const sub = { ids: top.map((i) => d.ids[i]), criteria: d.E.criteria.slice(0, 1), e: [e] };
  const meanTop = top.map((i) => d.mean[i]);
  const gPm = strictOrder(meanTop);
  const evalPm = evaluateReport(gPm, sub, { tau: CONFIG.evalTau });
  const estTop = d.est ? top.map((i) => d.est[i]) : null;
  const evalEst = estTop ? evaluateReport(strictOrder(estTop), sub, { tau: CONFIG.evalTau }) : null;
  const disagree = estTop ? misorderedPairs(estTop, meanTop).count : null;
  const above = statedAbove(gPm, sub, { tau: CONFIG.half });
  const aboveHalf = above.count;
  const abovePairs = new Set(above.pairs.map((q) => `${top[q.i]}|${top[q.j]}`));
  const least = largestStatedError(gPm, sub);
  const pos = top.map((_, k) => k).sort((x, y) => gPm[x] - gPm[y]);
  const claims = [];
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const hi = top[pos[a]];
      const lo = top[pos[b]];
      claims.push({ a: a + 1, b: b + 1, gap: b - a, hi, lo, p: e[pos[a]][pos[b]], above: abovePairs.has(`${hi}|${lo}`) });
    }
  }
  const truth = d.theta ? {
    wrong: misorderedPairs(meanTop, top.map((i) => d.theta[i])).count,
    expected: expectedMisorderedPairs(top.map((i) => d.theta[i]), top.map((i) => d.se[i]), { priorSd: CONFIG.priorSd, priorMean: CONFIG.priorMean }),
  } : null;
  return {
    d, n, top, gPm, sub, M: pairCount(n), evalPm, evalEst, E: evalPm.E[0], Eest: evalEst ? evalEst.E[0] : null,
    disagree, aboveHalf, claims, order: pos.map((k) => top[k]),
    least: least ? { p: least.e, hi: top[least.i], lo: top[least.j], gap: Math.abs(gPm[least.j] - gPm[least.i]) } : null,
    truth,
  };
}

function byDistance(v) {
  if (!v.gaps) v.gaps = claimsByDistance(v.gPm, v.sub).map((r) => ({ gap: r.distance, count: r.count, E: r.expected, max: r.max }));
  return v.gaps;
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `
/* Frame v2 toolbar & Settings disclosure */
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-n {
  flex: 1 1 13rem;
  min-width: 11rem;
  max-width: 19rem;
}
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-n > .prx-control {
  width: 100%;
  max-width: none;
}
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-data {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
}
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-data > legend {
  flex: 1 1 100%;
}
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-data > .prx-radio {
  font-weight: 400;
}

/* Primary stage: two linked figures (triangle + error probability by rank gap) */
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-stage {
  container-type: inline-size;
}
.prx-rc.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rc-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem 1.4rem;
  align-items: start;
  min-width: 0;
}
@container (min-width: 46rem) {
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rc-stage-grid {
    grid-template-columns: minmax(0, ${CONFIG.triangle.maxPx}px) minmax(0, 1fr);
  }
}
.prx-rc .prx-rc-panel {
  min-width: 0;
  grid-area: auto;
  container-type: inline-size;
}
.prx-rc .prx-rc-heading {
  margin: 0 0 0.3rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-rc .prx-stage .prx-rc-cue {
  margin: 0.3rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.prx-rc .prx-rc-note {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--prx-fg-muted);
}
.prx-rc .prx-stage .prx-rc-least {
  margin: 0.35rem 0 0;
  font-size: 0.84375rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
}
.prx-rc .prx-rc-tex {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overflow-wrap: normal;
}
.prx-rc .prx-rc-tex math {
  max-width: none;
}
.prx-rc .prx-rc-triangle,
.prx-rc .prx-rc-scatter {
  min-width: 0;
  margin: 0.25rem 0 0;
}
.prx-rc .prx-rc-triangle {
  max-width: ${CONFIG.triangle.maxPx}px;
}
.prx-rc .prx-rc-triangle .prx-chart-area,
.prx-rc .prx-rc-scatter .prx-chart-area {
  border-radius: var(--prx-radius, 6px);
}
.prx-rc .prx-rc-missing {
  margin: 0 0 0.75rem;
  padding: 0.75rem;
  border: 1px dashed var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}

/* Data & Method disclosures */
.prx-rc .prx-rc-data-stack,
.prx-rc .prx-rc-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
  min-width: 0;
}
.prx-rc .prx-rc-compare {
  margin: 0;
}
.prx-rc .prx-rc-bars {
  display: grid;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.prx-rc .prx-light-panel .prx-rc-bar-row {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
  color: var(--prx-plot-fg);
  font-size: 0.875rem;
}
.prx-rc .prx-light-panel .prx-rc-bar-row > .prx-num {
  min-width: 3.6em;
  font-family: var(--prx-font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.prx-rc .prx-rc-bar-track {
  display: block;
  height: 0.9rem;
  min-width: 0;
}
.prx-rc .prx-rc-bar {
  display: block;
  height: 100%;
  border-radius: 2px;
}
.prx-rc .prx-rc-bar-post {
  background: var(--prx-post);
}
.prx-rc .prx-rc-bar-est {
  background: var(--prx-est);
}

/* 5-dataset log-scale comparison table (>= 13px axis & cells) */
.prx-rc .prx-rc-strip-box {
  max-width: 100%;
  overflow-x: auto;
}
.prx-rc table.prx-rc-strip {
  display: table;
  width: 100%;
  min-width: 0;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: normal;
}
.prx-rc .prx-rc-strip th,
.prx-rc .prx-rc-strip td {
  min-width: 0;
  padding: 0.3rem 0.45rem;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--prx-border);
}
.prx-rc .prx-rc-strip thead th {
  font-weight: 600;
  color: var(--prx-fg-heading);
  vertical-align: bottom;
}
.prx-rc .prx-rc-strip tbody th {
  font-weight: 400;
}
.prx-rc .prx-rc-strip .prx-rc-num {
  text-align: right;
  white-space: nowrap;
}
.prx-rc .prx-rc-strip-current th,
.prx-rc .prx-rc-strip-current td,
.prx-rc .prx-rc-strip-this th,
.prx-rc .prx-rc-strip-this td {
  font-weight: 600;
}
.prx-rc .prx-rc-strip-this th,
.prx-rc .prx-rc-strip-this td {
  border-top: 2px solid var(--prx-border-strong);
}
.prx-rc .prx-rc-strip .prx-rc-scale-head,
.prx-rc .prx-rc-strip .prx-rc-scale-cell {
  width: 34%;
  min-width: 7rem;
}
.prx-rc .prx-rc-scale-axis {
  position: relative;
  display: block;
  height: 1.35em;
  margin: 0 0.6em;
  font-weight: 400;
  font-size: 0.8125rem;
  color: var(--prx-fg-muted);
}
.prx-rc .prx-rc-scale-tick {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
  white-space: nowrap;
}
.prx-rc .prx-rc-tick-first {
  transform: none;
}
.prx-rc .prx-rc-scale-track {
  position: relative;
  display: block;
  height: 0.9rem;
  margin: 0 0.6em;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-radius: 999px;
}
.prx-rc .prx-rc-scale-dot {
  position: absolute;
  top: 50%;
  width: 0.72rem;
  height: 0.72rem;
  transform: translate(-50%, -50%);
  background: var(--prx-plot-fg);
  border-radius: 50%;
}
.prx-rc .prx-rc-scale-this {
  background: var(--prx-plot-bg);
  border: 2px solid var(--prx-plot-fg);
  box-sizing: border-box;
}

.prx-rc .prx-rc-source {
  margin: 0.25rem 0 0;
  font-size: 0.84375rem;
  color: var(--prx-fg-muted);
}
.prx-rc .prx-rc-notice {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--prx-fg-muted);
  overflow-wrap: anywhere;
}
.prx-rc .prx-rc-notice strong {
  font-weight: 600;
  color: var(--prx-fg);
}

@container (max-width: 28rem) {
  .prx-rc table.prx-rc-strip {
    font-size: 0.8125rem;
  }
  .prx-rc .prx-rc-strip th,
  .prx-rc .prx-rc-strip td {
    padding: 0.24rem 0.28rem;
  }
  .prx-rc .prx-rc-strip .prx-rc-scale-head,
  .prx-rc .prx-rc-strip .prx-rc-scale-cell {
    width: auto;
    min-width: 4.2rem;
  }
  .prx-rc .prx-rc-scale-axis,
  .prx-rc .prx-rc-scale-track {
    margin: 0 0.45em;
  }
  .prx-rc .prx-rc-scale-tick:not(.prx-rc-tick-first):not(.prx-rc-tick-last) {
    display: none;
  }
  .prx-rc .prx-rc-tick-last {
    transform: translateX(-100%);
  }
}

@media (max-width: 30em) {
  .prx-rc.prx-widget[data-prx-frame="v2"] {
    padding: 0.45rem 0.55rem 0.4rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.25rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-rc-n {
    flex: 1 1 100%;
    max-width: none;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-presets {
    flex: 0 1 auto;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.2rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.12rem 0.36rem;
    font-size: 0.785rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.35rem;
    padding: 0.25rem 0.45rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-stage {
    padding: 0.45rem 0.55rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rc-stage-grid {
    gap: 0.65rem;
  }
  .prx-rc.prx-widget[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.45rem;
    gap: 0.35rem;
  }
  .prx-rc .prx-light-panel .prx-rc-bar-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .prx-rc .prx-light-panel .prx-rc-bar-name {
    grid-column: 1 / -1;
  }
}
`;

// ---------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      n: { type: "integer", min: CONFIG.n.min, max: CONFIG.n.max, step: 1, value: CONFIG.n.value },
    },
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);
      const num = (raw, display) => ctx.num(raw, display);
      const hook = (name, raw, display) => writer.num(raw, display, { hook: name });
      const count = (x) => writer.count(x);
      const nameNode = (text) => h("span", { "data-prx-name": "", text });

      // --- data sets (built once per page) and memoized views
      const sets = datasets();
      const cde = sets.cde;
      const memo = new Map();
      const viewOf = (key, n) => {
        const d = sets[key];
        if (!d) return null;
        const k = `${key}:${Math.max(CONFIG.n.min, Math.min(d.n, n))}`;
        if (!memo.has(k)) {
          if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
          memo.set(k, rankingView(d, n));
        }
        return memo.get(k);
      };

      // --- primary control (ctx.controls): Units ranked, n slider; secondary dataset radio in Settings
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend,
        name: "data",
        className: "prx-rc-data",
        options: [
          { value: "six", label: T.dataSix },
          { value: "league", label: fillText(T.dataLeague, { n: formatCount(sets.league.n) }) },
          { value: "krw", label: sets.krw ? fillText(T.dataKrw, { n: formatCount(sets.krw.n) }) : T.dataKrwMissing },
        ],
        value: ctx.state.data,
        onChange: (v) => ctx.set({ data: v, n: sets[v]?.n ?? CONFIG.n.value }),
      });
      if (!sets.krw) dataRadio.inputs[CONFIG.data.values.indexOf("krw")].disabled = true;

      const sliderSlot = h("div", { class: "prx-rc-n" });
      let nSlider = null;
      let sliderFor = null;
      function makeSlider(d, n) {
        nSlider = ctx.slider({
          label: T.nLabel,
          min: CONFIG.n.min,
          max: d.n,
          step: 1,
          value: n,
          name: "n",
          format: (x) => formatCount(x),
          onInput: (x) => ctx.set({ n: x }),
        });
        sliderSlot.replaceChildren(nSlider.root);
        sliderFor = d.key;
      }
      ctx.controls.append(sliderSlot);
      ctx.primaryControl(sliderSlot);
      ctx.settingsBox().body.append(dataRadio.root);

      // --- Primary stage (ctx.stage): claims triangle + error-probability dot plot
      const triSlot = ctx.primaryGraphic(h("div", { class: "prx-rc-triangle" }));
      const triCue = h("p", { class: "prx-rc-cue", "data-prx-part": "legend", text: T.triCue });
      const claimsPanel = h(
        "section",
        { class: "prx-rc-panel prx-rc-stage-claims", "aria-label": T.claimsHeading },
        ctx.panelTitle(T.claimsHeading, { className: "prx-rc-heading" }),
        triSlot,
        triCue,
      );

      const scSlot = h("div", { class: "prx-rc-scatter" });
      const leastLine = h("p", { class: "prx-rc-note prx-rc-least", "data-prx-part": "notes" });
      const errorsPanel = h(
        "section",
        { class: "prx-rc-panel prx-rc-stage-errors", "aria-label": T.errorsHeading },
        ctx.panelTitle(T.errorsHeading, { className: "prx-rc-heading" }),
        scSlot,
        leastLine,
      );

      const stageGrid = h("div", { class: "prx-rc-stage-grid" }, claimsPanel, errorsPanel);
      const missing = h("p", { class: "prx-rc-missing", text: T.missing, hidden: true });
      ctx.stage.append(missing, stageGrid);

      // --- Data disclosure: two-order comparison + league truth + 5-dataset log-scale table
      const bars = h("div", { class: "prx-rc-bars prx-light-panel" });
      const compareNote = h("p", { class: "prx-rc-note", "data-prx-part": "notes" });
      const comparePanel = h(
        "section",
        { class: "prx-rc-compare", "data-prx-box": "compare", "aria-label": T.compareHeading },
        ctx.panelTitle(T.compareHeading, { className: "prx-rc-heading" }),
        bars,
        compareNote,
      );
      const noEst = h("p", { class: "prx-rc-note prx-rc-noest", "data-prx-part": "notes", text: T.noEstimates, hidden: true });
      const truthNote = h("p", { class: "prx-rc-note prx-rc-truth", "data-prx-part": "notes", hidden: true });

      const stripBody = h("tbody", {});
      const stripScale = h("span", { class: "prx-rc-scale-axis", "aria-hidden": "true" });
      const stripTable = h(
        "table",
        { class: "prx-rc-strip" },
        h("caption", { class: "prx-sr-only", text: T.stripCaption }),
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { scope: "col", text: T.colData }),
            h("th", { scope: "col", class: "prx-rc-num", text: T.colN }),
            h("th", { scope: "col", class: "prx-rc-num", text: T.colM }),
            h("th", { scope: "col", class: "prx-rc-scale-head" }, h("span", { class: "prx-sr-only", text: T.colScale }), stripScale),
          ),
        ),
        stripBody,
      );
      const stripBox = ctx.scrollRegion(h("div", { class: "prx-rc-strip-box", "data-prx-part": "table" }, stripTable), T.stripCaption);
      const stripNote = h("p", { class: "prx-rc-note", "data-prx-part": "notes", text: T.stripNote });
      const cdeLine = h("p", { class: "prx-rc-note", "data-prx-part": "notes", hidden: !cde });
      const stripPanel = h(
        "section",
        { class: "prx-rc-panel prx-rc-strip-panel", "data-prx-box": "strip", "aria-label": T.stripHeading },
        ctx.panelTitle(T.stripHeading, { className: "prx-rc-heading" }),
        stripBox,
        stripNote,
        cdeLine,
      );

      const dataBox = ctx.dataBox(T.dataBoxTitle);
      dataBox.body.append(h("div", { class: "prx-rc-data-stack" }, comparePanel, noEst, truthNote, stripPanel));

      // --- Method disclosure: pair-count & expected-error formulas, above-half note, interaction & source notes
      const texPairs = h("div", { class: "prx-rc-tex", "data-prx-tex": "pairs" });
      const triNote = h("p", { class: "prx-rc-note", "data-prx-part": "notes" });
      const claimsMethod = h("div", { class: "prx-rc-claims" }, texPairs, triNote);

      const texExpected = h("div", { class: "prx-rc-tex", "data-prx-tex": "expected" });
      const formulaNote = h("p", { class: "prx-rc-note prx-rc-sum-note", "data-prx-part": "notes" });
      const halfNote = h("p", { class: "prx-rc-note prx-rc-half", "data-prx-part": "notes", hidden: true });
      const readHint = h("p", { class: "prx-rc-note prx-rc-read", "data-prx-part": "notes" });
      const sourceNote = ctx.part("notes", h("p", { class: "prx-rc-source" }));
      const errorsMethod = h("div", { class: "prx-rc-errors-method" }, texExpected, formulaNote, halfNote, readHint, sourceNote);

      const methodBox = ctx.methodBox(T.methodBoxTitle);
      methodBox.body.append(h("div", { class: "prx-rc-method-stack" }, claimsMethod, errorsMethod));

      // --- Standalone data license notices (outside data-num-checked parts; site pages carry their own callout)
      const standalone = !ctx.doc.querySelector?.('meta[name="quarto:offset"]');
      const krwNotice = standalone
        ? h("p", { class: "prx-rc-notice", hidden: true }, `${T.noticeKrw} ${T.noticeKrwChanges} `, h("strong", { text: T.noticeKrwConduct }))
        : null;
      const cdeNotice = standalone && cde ? h("p", { class: "prx-rc-notice", text: T.noticeCde }) : null;
      if (krwNotice) ctx.root.append(krwNotice);
      if (cdeNotice) ctx.root.append(cdeNotice);

      // ------------------------------------------------------------------------------------------- claims & scale

      function drawPairsFormula(v) {
        const f = formulaNums();
        const one = f.num(1, "1");
        const two = f.num(2, "2");
        const nT = f.num(v.n, formatCount(v.n));
        const n1T = f.num(v.n - 1, formatCount(v.n - 1));
        const two2 = f.num(2, "2");
        const mT = f.num(v.M, formatCount(v.M));
        const tex = `M = \\frac{n(n - ${one})}{${two}} = \\frac{${nT} \\cdot ${n1T}}{${two2}} =\\; ${mT}`;
        renderTex(texPairs, tex, { display: true, nums: f.raws });
        const nodes = texPairs.querySelectorAll("mtext");
        nodes[nodes.length - 1]?.setAttribute("data-prx-readout", "formula-M");
      }

      function triangleTicks(n) {
        if (n <= TRI.allTicks) return Array.from({ length: n }, (_, k) => k + 1);
        const step = pickBy(TRI.steps, n, "step");
        const out = [1];
        for (let t = step; t <= n; t += step) out.push(t);
        return out;
      }

      function drawTriangle(v) {
        const avail = Math.max(220, Math.floor(claimsPanel.clientWidth || ctx.stage.clientWidth || ctx.width()));
        const W = Math.min(avail < 400 ? TRI.maxPxNarrow : TRI.maxPx, avail);
        const inner = Math.max(1, W - TRI.marginLeft - TRI.marginRight);
        const H = TRI.marginTop + TRI.marginBottom + inner;
        const cell = inner / v.n;
        const light = cell >= TRI.outlineMin;
        const ticks = triangleTicks(v.n);
        const isSix = v.d.key === "six";
        const labelsOf = ticks.map((t) => (isSix ? v.d.ids[v.order[t - 1]] : t));
        triSlot.style.width = `${W}px`;
        plot(triSlot, {
          alt: fillText(T.triangleAlt, { M: formatCount(v.M), n: formatCount(v.n), units: T.units[v.d.key] }),
          width: W,
          height: H,
          aspect: false,
          marginTop: TRI.marginTop,
          marginBottom: TRI.marginBottom,
          marginLeft: TRI.marginLeft,
          marginRight: TRI.marginRight,
          x: { domain: [CONFIG.half, v.n + CONFIG.half], axis: null },
          y: { domain: [CONFIG.half, v.n + CONFIG.half], reverse: true, axis: null },
          marks: (c, P) => {
            const inset = light ? TRI.outlineInset : Math.max(0.32, cell * TRI.inset);
            const at = ticks.map((t, k) => ({ t, k }));
            const tagged = (attr, value) => (index, scales, values, dims, context, next) => {
              const g = next(index, scales, values, dims, context);
              const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
              Array.from(index).forEach((i, j) => nodes[j]?.setAttribute(attr, value(at[i])));
              return g;
            };
            const text = (axis) => {
              const common = { fill: c.plotMuted, fontSize: TRI.font };
              const pos = axis === "x"
                ? { x: "t", frameAnchor: "top", dy: -TRI.labelGap, lineAnchor: "bottom" }
                : { y: "t", frameAnchor: "left", dx: -TRI.labelGap, textAnchor: "end" };
              return isSix
                ? P.text(at, { ...pos, ...common, text: (d) => labelsOf[d.k], fontWeight: "bold", render: tagged("data-prx-name", (d) => labelsOf[d.k]) })
                : P.text(at, { ...pos, ...common, text: (d) => formatCount(d.t), render: tagged("data-num", (d) => String(d.t)) });
            };
            const paint = light
              ? { fill: c.blues[1], stroke: c.post, strokeWidth: 1 }
              : { fill: c.post, fillOpacity: 0.82 };
            const many = v.n > CONFIG.readMax;
            return [
              P.rect(v.claims, {
                x1: (d) => d.b - CONFIG.half,
                x2: (d) => d.b + CONFIG.half,
                y1: (d) => d.a - CONFIG.half,
                y2: (d) => d.a + CONFIG.half,
                ...(many
                  ? {
                      render: onePath("rect", {
                        inset,
                        attrs: {
                          fill: paint.fill,
                          "fill-opacity": paint.fillOpacity,
                          stroke: paint.stroke,
                          "stroke-width": paint.strokeWidth,
                        },
                      }),
                    }
                  : { inset, ...paint }),
              }),
              text("x"),
              text("y"),
            ];
          },
        });
        triNote.replaceChildren(...fill(T.triangleNote, {
          first: () => (isSix ? nameNode(v.d.ids[v.order[0]]) : h("span", {}, ...fill(T.firstRank, { one: () => num(1, "1") }))),
          app: () => appLink(ctx, T.apps.matrix),
        }));
      }

      const logPos = (M) => `${(Math.log(M) / Math.log(CONFIG.strip.base) / CONFIG.strip.decades) * CONFIG.percent}%`;
      (function drawScaleHead() {
        const ticks = [];
        for (let k = 0; k <= CONFIG.strip.decades; k += CONFIG.strip.tickEvery) {
          const v = CONFIG.strip.base ** k;
          const last = k + CONFIG.strip.tickEvery > CONFIG.strip.decades;
          const cls = `prx-rc-scale-tick${k === 0 ? " prx-rc-tick-first" : last ? " prx-rc-tick-last" : ""}`;
          const s = h("span", { class: cls });
          setNum(s, v, logLabel(v));
          s.style.left = logPos(v);
          ticks.push(s);
        }
        stripScale.replaceChildren(...ticks);
      })();

      function drawStrip(v) {
        const rows = [
          { key: "six", n: sets.six.n },
          { key: "league", n: sets.league.n },
          ...(sets.krw ? [{ key: "krw", n: sets.krw.n }] : []),
          ...(cde ? [{ key: "cde", n: cde.n }] : []),
          { key: "this", n: v.n },
        ].map((r) => ({ ...r, M: r.key === "cde" ? cde.M : pairCount(r.n) }));
        stripBody.replaceChildren(...rows.map((r) => {
          const dot = h("span", { class: `prx-rc-scale-dot${r.key === "this" ? " prx-rc-scale-this" : ""}` });
          dot.style.left = logPos(r.M);
          const nCell = h("td", { class: "prx-rc-num" });
          const mCell = h("td", { class: "prx-rc-num" });
          setNum(nCell, r.n, formatCount(r.n));
          setNum(mCell, r.M, formatCount(r.M));
          nCell.setAttribute("data-prx-readout", `strip-${r.key}-n`);
          mCell.setAttribute("data-prx-readout", `strip-${r.key}-M`);
          return h(
            "tr",
            { class: r.key === "this" ? "prx-rc-strip-this" : r.key === v.d.key ? "prx-rc-strip-current" : null },
            h("th", { scope: "row", text: T.stripRows[r.key] }),
            nCell,
            mCell,
            h("td", { class: "prx-rc-scale-cell", "aria-hidden": "true" }, h("span", { class: "prx-rc-scale-track" }, dot)),
          );
        }));
        if (cde) cdeLine.replaceChildren(...fill(T.cdeNote, { n: () => hook("cde-n", cde.n, formatCount(cde.n)) }));
      }

      // ------------------------------------------------------------------------------------------- errors

      function drawExpectedFormula(v) {
        const f = formulaNums();
        const one = f.num(1, "1");
        const eT = f.num(v.E, fmtE(v.E));
        const tex = `\\sum_{i \\; ${CONFIG.tex.above} \\; j} (${one} - \\pi_{ij}) =\\; ${eT}`;
        renderTex(texExpected, tex, { display: true, nums: f.raws });
        const nodes = texExpected.querySelectorAll("mtext");
        nodes[nodes.length - 1]?.setAttribute("data-prx-readout", "formula-expected-wrong");
        formulaNote.replaceChildren(
          ...fill(T.formulaNote, {
            one: () => num(1, "1"),
            sub: () => h("sub", { text: "ij" }),
          }),
          ...captionNodes(ctx, v.evalPm),
          T.formulaNoteEnd,
        );
      }

      const unitName = (v, i) => v.d.names[i];
      const apart = (gap) => (gap === 1 ? T.tipNext : fillText(T.tipApart, { gap: formatCount(gap) }));
      const tipOf = (v, c) => fillText(T.tip, { hi: unitName(v, c.hi), lo: unitName(v, c.lo), apart: apart(c.gap), p: formatProb(c.p) });

      function xTicks(n) {
        const top = Math.max(1, n - 1);
        if (top <= TRI.allTicks) return Array.from({ length: top }, (_, k) => k + 1);
        const raw = top / SC.xTicks;
        const p = CONFIG.strip.base ** Math.floor(Math.log10(raw));
        const step = [1, 2, 5, CONFIG.strip.base].map((m) => m * p).find((s) => s >= raw) ?? raw;
        const out = [];
        for (let t = step; t <= top; t += step) out.push(t);
        return [1, ...out.filter((t) => t > 1)];
      }

      function drawScatter(v) {
        const readable = v.n <= CONFIG.readMax;
        const r = pickBy(SC.radius, v.n, "r");
        const ringed = r > SC.radius.at(-1).r;
        const scW = Math.max(220, Math.floor(errorsPanel.clientWidth || ctx.stage.clientWidth || ctx.width()));
        const scH = scW < 420 ? SC.heightNarrow : SC.height;
        plot(scSlot, {
          alt: fillText(T.scatterAlt, { M: formatCount(v.M) }),
          table: readable
            ? {
                caption: T.scatterTable,
                columns: [
                  { label: T.colHigher, value: (c) => unitName(v, c.hi) },
                  { label: T.colLower, value: (c) => unitName(v, c.lo) },
                  { label: T.colGap, value: "gap", format: (x) => formatCount(x) },
                  { label: T.colWrong, value: "p", format: (x) => formatProb(x) },
                ],
                rows: v.claims,
              }
            : {
                caption: T.gapTable,
                columns: [
                  { label: T.colGap, value: "gap", format: (x) => formatCount(x) },
                  { label: T.colClaims, value: "count", format: (x) => formatCount(x) },
                  { label: T.colGapE, value: "E", format: (x) => fmtE(x) },
                  { label: T.colMaxP, value: "max", format: (x) => formatProb(x) },
                ],
                rows: byDistance(v),
              },
          width: scW,
          height: scH,
          aspect: false,
          marginTop: SC.marginTop,
          marginBottom: SC.marginBottom,
          marginLeft: SC.marginLeft,
          marginRight: SC.marginRight,
          x: {
            domain: [0, Math.max(2, v.n)],
            ticks: xTicks(v.n),
            label: T.xLabel,
            labelAnchor: "center",
            labelArrow: "none",
            labelOffset: SC.labelOffset,
          },
          y: {
            domain: [0, SC.yMax],
            ticks: SC.yTicks.slice(),
            grid: true,
            label: T.yLabel,
            labelArrow: "none",
          },
          marks: (c, P) => {
            const above = v.claims.filter((x) => x.above);
            const ra = r + SC.aboveGrow;
            const ringAttrs = { fill: c.post, stroke: c.plotFg, "stroke-width": SC.aboveRing };
            const farthest = above.length ? Math.max(...above.map((x) => x.gap)) : null;
            return [
              P.ruleY([0], { stroke: c.plotAxis }),
              readable
                ? P.dot(v.claims, { x: "gap", y: "p", r, fill: c.post, stroke: c.plotBg, strokeWidth: ringed ? SC.ring : 0 })
                : P.dot(v.claims, {
                    x: "gap",
                    y: "p",
                    r,
                    render: onePath("dot", {
                      r,
                      attrs: {
                        fill: c.post,
                        "fill-opacity": 0.78,
                        stroke: ringed ? c.plotBg : null,
                        "stroke-width": ringed ? SC.ring : null,
                      },
                    }),
                  }),
              above.length
                ? readable
                  ? P.dot(above, { x: "gap", y: "p", r: ra, fill: c.post, stroke: c.plotFg, strokeWidth: SC.aboveRing })
                  : P.dot(above, { x: "gap", y: "p", r: ra, render: onePath("dot", { r: ra, attrs: ringAttrs }) })
                : null,
              P.ruleY([CONFIG.half], { stroke: c.plotMuted, strokeDasharray: SC.dash }),
              P.text([CONFIG.half], {
                y: (d) => d,
                frameAnchor: "right",
                text: () => T.halfLabel,
                dx: -2,
                dy: SC.halfDy,
                textAnchor: "end",
                fill: c.plotMuted,
                fontSize: SC.font,
              }),
              above.length
                ? P.text([{ x: farthest, y: CONFIG.half }], {
                    x: "x",
                    y: "y",
                    text: () => `${formatCount(v.aboveHalf)}${v.aboveHalf === 1 ? " claim above" : T.aboveLabel}`,
                    dx: SC.aboveDx,
                    dy: SC.aboveDy,
                    textAnchor: "start",
                    fill: c.plotFg,
                    fontSize: SC.font,
                    fontWeight: "bold",
                    render: (index, scales, values, dims, context, next) => {
                      const g = next(index, scales, values, dims, context);
                      const t = g?.querySelector?.("text");
                      if (t) {
                        const doc = context.document;
                        const numSpanNode = doc.createElementNS(SVG_NS, "tspan");
                        numSpanNode.setAttribute("data-num", dataNum(v.aboveHalf));
                        numSpanNode.textContent = formatCount(v.aboveHalf);
                        const rest = doc.createElementNS(SVG_NS, "tspan");
                        rest.textContent = v.aboveHalf === 1 ? " claim above" : T.aboveLabel;
                        t.replaceChildren(numSpanNode, rest);
                      }
                      return g;
                    },
                  })
                : null,
              readable ? P.tip(v.claims, P.pointer({ x: "gap", y: "p", title: (d) => tipOf(v, d) })) : null,
            ];
          },
          keyboard: readable
            ? {
                data: v.claims,
                x: "gap",
                y: "p",
                key: (d) => `${d.a}-${d.b}`,
                label: T.scatterKeys,
                title: (d) => tipOf(v, d),
              }
            : undefined,
        });
        leastLine.hidden = !v.least;
        if (v.least) {
          leastLine.replaceChildren(
            ...fill(T.least, {
              hi: () => nameNode(unitName(v, v.least.hi)),
              lo: () => nameNode(unitName(v, v.least.lo)),
              apart: () => (v.least.gap === 1 ? T.tipNext : fill(T.tipApart, { gap: () => count(v.least.gap) })),
              p: () => hook("least-certain", v.least.p, formatProb(v.least.p)),
            }).flat(),
          );
        }
        readHint.replaceChildren(...(readable ? [T.readHint] : fill(T.readHintMany, { max: () => count(CONFIG.readMax) })));
        halfNote.hidden = !(v.aboveHalf > 0);
        if (v.aboveHalf > 0) {
          halfNote.replaceChildren(
            ...fill(T.aboveHalf, {
              count: () => hook("above-half", v.aboveHalf, formatCount(v.aboveHalf)),
              count2: () => count(v.aboveHalf),
              rankings: () => appLink(ctx, T.apps.rankings),
              majority: () => appLink(ctx, T.apps.majority),
            }),
          );
        }
      }

      function drawCompare(v) {
        const has = v.evalEst !== null;
        comparePanel.hidden = !has;
        noEst.hidden = has;
        if (!has) return;
        const top = Math.max(v.E, v.Eest) * CONFIG.barHeadroom || 1;
        const row = (cls, name, value, hookName) => {
          const bar = h("span", { class: `prx-rc-bar ${cls}` });
          bar.style.width = `${(value / top) * CONFIG.percent}%`;
          return h(
            "div",
            { class: "prx-rc-bar-row" },
            h("span", { class: "prx-rc-bar-name", text: name }),
            h("span", { class: "prx-rc-bar-track", "aria-hidden": "true" }, bar),
            hook(hookName, value, fmtE(value)),
          );
        };
        bars.replaceChildren(
          row("prx-rc-bar-post", T.barPm, v.E, "bar-posterior-mean"),
          row("prx-rc-bar-est", T.barEst, v.Eest, "bar-estimate"),
        );
        compareNote.replaceChildren(
          ...fill(v.disagree > 0 ? T.compareNote : T.compareSame, {
            M: () => count(v.M),
            D: () => hook("disagree", v.disagree, formatCount(v.disagree)),
          }),
        );
      }

      function drawTruth(v) {
        truthNote.hidden = !v.truth;
        if (!v.truth) return;
        truthNote.replaceChildren(
          ...fill(T.truth, {
            mis: () => hook("truth-wrong", v.truth.wrong, formatCount(v.truth.wrong)),
            M: () => count(v.M),
            exp: () => hook("truth-expected", v.truth.expected, fmtE(v.truth.expected)),
            E: () => num(v.E, fmtE(v.E)),
          }),
        );
      }

      // ------------------------------------------------------------------------------------------- read-out and notes

      function drawReadout(v) {
        const d = v.d;
        const slots = {
          name: T.names[d.key],
          units: T.units[d.key],
          claims: v.M === 1 ? "claim" : "claims",
          n: () => hook("n", v.n, formatCount(v.n)),
          N: () => hook("N", d.n, formatCount(d.n)),
          M: () => hook("M", v.M, formatCount(v.M)),
          E: () => hook("expected-wrong", v.E, fmtReadoutE(v.E)),
        };
        writer.set([
          ...fill(v.n === d.n ? T.readAll : T.readTop, slots),
          ...(v.evalEst
            ? fill(T.readEst, { Eest: () => hook("expected-wrong-estimate", v.Eest, fmtReadoutE(v.Eest)) })
            : [T.readNoEst]),
        ]);
      }

      function drawNotes(d) {
        if (d.key === "league") ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));
        else ctx.caption.replaceChildren();
        if (d.key === "six") {
          sourceNote.replaceChildren(...fill(T.noteSix, { sd: () => num(d.sd[0], formatDecimal(d.sd[0], { digits: CONFIG.digits.sd })) }));
        } else if (d.key === "league") {
          sourceNote.replaceChildren(
            ...fill(T.noteLeague, {
              n: () => count(d.n),
              seed: () => num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
              zero: () => num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })),
              prior: () => num(CONFIG.priorSd, formatSetting(CONFIG.priorSd)),
            }),
          );
        } else {
          sourceNote.replaceChildren(...fill(T.noteKrw, { one: () => num(1, "1") }));
        }
        if (krwNotice) krwNotice.hidden = d.key !== "krw";
      }

      return {
        render(state, info) {
          // PR-06 / PR-09: Data & Method hold CSS-layout tables/formulas rendered eagerly; toggling disclosures never redraws stage
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            dataRadio.set(state.data);
            ctx.root.setAttribute("data-prx-data", state.data);
            const d = sets[state.data];
            missing.hidden = Boolean(d);
            stageGrid.hidden = !d;
            dataBox.root.hidden = !d;
            methodBox.root.hidden = !d;
            if (!d) {
              sliderSlot.replaceChildren();
              nSlider = null;
              sliderFor = null;
              ctx.caption.replaceChildren();
              if (krwNotice) krwNotice.hidden = true;
              delete exposedResults(ctx.root)["posterior-mean"];
              delete exposedResults(ctx.root).estimate;
              writer.set(T.missing);
              return;
            }
            if (state.n > d.n) ctx.set({ n: d.n });
            const v = viewOf(state.data, state.n);
            if (sliderFor !== d.key) makeSlider(d, v.n);
            else nSlider.set(v.n);
            exposeResult(ctx, v.evalPm, "posterior-mean");
            if (v.evalEst) exposeResult(ctx, v.evalEst, "estimate");
            else delete exposedResults(ctx.root).estimate;
            drawPairsFormula(v);
            drawTriangle(v);
            drawStrip(v);
            drawExpectedFormula(v);
            drawScatter(v);
            drawCompare(v);
            drawTruth(v);
            drawReadout(v);
            drawNotes(d);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
