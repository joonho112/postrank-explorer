// chain-draws (app 1.18): "Draws that remember". Stationary two-state Markov chain from the postrank theory book,
// ch. 15 ("Finite-sample coefficient error in a stationary two-state chain"), restated with π_AB = 1/2, paired with
// postrank's pr_toy_mcmc diagnostics (vignette m6) inside progressive disclosures.
//
// Exports preserved: CONFIG, switchOf(stay), estimateBins(S, means), chainRun(p, S, chains, seed), mountWidget(el, spec).
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  blocksText,
  decimalsNeeded,
  formatCount,
  formatDecimal,
  formatPercent,
  formatProb,
  formatRational,
  formatReadoutEst,
  formatReadoutProb,
  formatReadoutRisk,
  formatSci,
  formatSetting,
  formatSig,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { chainCountLaw, chainMeanVariance, envelopeRadius, mcse, runningMean, summaryStats, twoStateChain } from "../pr-core.js";
import TOY from "../../data/released/toy-mcmc.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "chain-draws",
  label: "Draws that remember: one two-state Markov chain, its draws and the running estimate of a pair probability, and the estimates of many chains against independent draws, with the iid band and the iid error bound",
  className: "prx-cd",
  stay: Object.freeze({ min: 0.5, max: 0.999, step: 0.001, value: 0.99 }),
  independent: 0.5,
  draws: Object.freeze({ values: Object.freeze([10, 20, 50, 100, 200, 500, 1000]), value: 100 }),
  chains: Object.freeze({ values: Object.freeze([200, 500, 1000, 2000]), value: 2000 }),
  chain: Object.freeze({ min: 1, max: 2000, value: 1 }),
  seed: Object.freeze({ min: 1, max: 4294967295, value: 20261030 }),
  mode: Object.freeze({ values: Object.freeze(["iid", "chain"]), value: "iid" }),
  toy: Object.freeze({ values: Object.freeze(["pair", "loss"]), value: "pair" }),
  alpha: 0.05,
  pairs: 1,
  criteria: 1,
  rareBelow: 0.001,
  guide: Object.freeze({ rhat: 1.01, essPerChain: 100 }),
  z: 2,
  inside: 0.95,
  grid: 250,
  stageLimit: 250000,
  memo: 6,
  bins: 40,
  curve: Object.freeze({
    from: 1, to: 1000, points: 49,
    xTicks: Object.freeze([1, 10, 100, 1000]),
    yDomain: Object.freeze([1e-4, 0.5]),
    yTicks: Object.freeze([1e-3, 1e-2, 1e-1]),
  }),
  chart: Object.freeze({
    traceHeight: 220, histHeight: 155, curveHeight: 215,
    marginTop: 14, marginBottom: 40, marginLeft: 56, marginRight: 20, histTop: 20, curveTop: 26, curveRight: 28,
    xTicks: 6, yTicks: 4, stateWidth: 1.1, estWidth: 2.2, piWidth: 1.6, piDash: "6,4", radiusWidth: 1.6,
    bandOpacity: 0.18, histBandOpacity: 0.16, barRim: 0.5, marker: 4.5, markerDy: -9,
    curveWidth: 2, iidDash: "5,3", dot: 4,
    tracePad: 0.07,
    stateOffset: 0.035,
    toy: Object.freeze({
      laneUnit: 46, stripLo: 1.08, stripHi: 1.28, gap: 0.34, marginTop: 8, marginBottom: 38, marginLeft: 42, marginRight: 50,
      lineWidth: 1.6, knownWidth: 1.4, kbdStep: 32, topStep: 0.1, xTicks: Object.freeze([1, 128, 256, 384, 512]),
      rowPx: 27, pooledTop: 12, pooledBottom: 38, pooledLeft: 96, pooledRight: 16, pooledTicks: 4, capHalf: 0.22, dot: 4, barWidth: 2,
    }),
  }),
  digits: Object.freeze({ radius: 3, share: 3, shareSe: 3, rhat: 4, ess: 2 }),
  text: Object.freeze({
    // disclosures
    settingsTitle: "Settings",
    dataTitle: "Data, secondary charts and MCMC traces",
    methodTitle: "Method and effective sample size",
    // controls
    stay: "Chance the chain stays in its state",
    stayHint: "At {independent} the draws are independent.",
    draws: "Draws per chain, S",
    chains: "Chains",
    chain: "Chain shown in the trace",
    chainHint: "Chain {c} of {C}, marked ▼ in the upper histogram.",
    seed: "Seed",
    seedHint: "Same seed, same chains.",
    mode: "Error formula",
    modeWords: Object.freeze({ iid: "Pretend iid", chain: "Chain-aware" }),
    modeHint: "Bands from the formula for independent (iid) draws, or from the chain's transition law (stay with chance {stay}, else switch).",
    // trace (primary stage)
    traceHead: "Chain {c}: its {S} draws and the running estimate",
    traceX: "Draw",
    traceY: "Share of draws with A above B",
    traceAlt: "Trace of one chain: each draw's state as a thin step line just above the top (A above B) or just below the bottom (A below B), the running estimate as a line with a band of two standard errors either side (by the error formula chosen), and a dashed line at the exact chance one half.",
    traceKbd: "Running estimate: one point per draw shown",
    traceKbdItem: "Draw {b}: running estimate {est}; band {lo} to {hi}.",
    traceKbdNoBand: "Draw {b}: running estimate {est}; no iid MCSE from one draw.",
    keyState: "draw state (top: A > B; bottom: A < B)",
    keyEst: "running estimate",
    keyBand: Object.freeze({
      iid: "±{two} iid MCSE",
      chain: "±{two} chain SD",
    }),
    keyPi: "{pi} = {half}",
    keyBoundLine: "iid bound ±{r}",
    chainLine: "After {S} draws chain {c} estimates {est}; the iid MCSE of its draws is {mcse}",
    chainMiss: ", so its pretend-iid band, {lo} to {hi}, misses {pi} = {half}",
    stuckLine: "It never switches, so the pretend-iid band has no width, yet {pi} = {half}: a constant trace is not a probability of {zero} or {one}.",
    stageLawLine: "Across {C} chains: effective independent draws {seffSym} = {eq}; never switching {noSwitch} exact ({stuck} chains).",
    // histograms (in Data)
    distHead: "The estimate after {S} draws",
    chainSub: "Chains that stay {stay}: {C} runs",
    iidSub: "Independent draws (stay {half}): {C} runs",
    distX: "Estimate after S draws",
    distYChain: "Chains",
    distYIid: "Runs",
    chainAlt: "Histogram of the chains' estimates after S draws, with a gray band of two SD either side of one half, the iid error bound as two solid lines, a dashed line at one half and a triangle at the chain shown.",
    iidAlt: "Histogram of the estimates of the independent runs after S draws, with a gray band of two SD either side of one half, the iid error bound as two solid lines and a dashed line at one half.",
    chainTable: "Chains by their estimate after S draws",
    iidTable: "Independent runs by their estimate after S draws",
    tFrom: "From",
    tTo: "To",
    tChains: "Chains",
    tRuns: "Runs",
    chainKbd: "Chains that stay: one point per bin of chains",
    iidKbd: "Independent draws: one point per bin of runs",
    kbdBin: "{n} of {C} {what} end with an estimate from {lo} to {hi}.",
    kbdBinOne: "{n} of {C} {what} end with an estimate of {v}.",
    kbdChains: "chains",
    kbdRuns: "runs",
    keyChainBar: "chains that stay {stay}",
    keyIidBar: "independent draws",
    keyHistBand: Object.freeze({
      iid: "gray band: {pi} ± {two} SD, where about {inside} of independent-draw estimates land",
      chain: "gray band: {pi} ± {two} SD; for the chains from the stay chance (cut off at the ends), for independent draws where about {inside} of their estimates land",
    }),
    keyRadius: "solid lines: iid error bound; independent draws land outside with chance at most {alpha}",
    keyPiHist: "dashed line: {pi} = {half}",
    keyMarker: "chain {c}",
    distNote: "Outside the bound (radius {r}): {count} chains ({share}, Monte Carlo SE {se}; exact chance {exact}) against {countIid} of the {C} independent runs ({shareIid}; exact chance {exactIid}); each histogram has its own count scale.",
    // numbers table & method notes
    numbersHead: "After {S} draws: independent draws against chains that stay {stay}",
    colIid: "Independent draws",
    colIidStay: "stay {stay}",
    colChain: "Chains that stay {stay}",
    rowRho: "Correlation of successive draws",
    rowSdVar: "SD (variance) of the estimate, exact",
    rowEq: "Independent draws with the same variance",
    rowAsym: "the same, by the long-run formula (long chains only)",
    rowNoSwitch: "Chance of never switching",
    rowStuck: "Runs that never switch, in these runs",
    rowOutside: "Outside the iid error bound (radius {r}), in these runs",
    rowOutsideExact: "the exact chance, from the stay chance",
    tableLabel: "Independent draws against chains that stay, after S draws",
    failNote: "A run that never switches sits a full half from {pi}, so for chains that stay {stay} the iid error bound fails with chance at least {noSwitch}.",
    failNoteRare: "A run that never switches would sit a full half from {pi}, but at this setting that has chance {noSwitch}, so it sets no useful lower bound.",
    failNoteIndependent: "At stay {stay} the draws are independent. ",
    failNoteWide: "At this S the radius of the iid error bound is at least one half, so no estimate can fall outside it.",
    radiusNote: "The bound is the theory book's (failure chance {alpha}, one pair); postrank's form, for pairs that cannot tie, has radius {rp} and fails in {sharePkg} of these chains (exact chance {exactPkg}).",
    eqNote: "We calculate both equivalent counts from the probability of staying in the same state. They summarize the precision of the estimate. The independence-based bound requires independent draws and cannot use these counts in place of S.",
    curveHead: "Exact variance of the estimate by the number of draws",
    curveX: "Draws per chain, S",
    curveY: "Variance of the estimate",
    curveAlt: "Exact variance of the estimate against the number of draws, both on log scales: one line for the chains that stay and a dashed line for independent draws, with dots at the S chosen.",
    curveKbd: "Variance by the number of draws: one point per S of the control",
    curveKbdItem: "S = {S}: variance {v} for the chains that stay, {vi} for independent draws.",
    keyCurveChain: "chains that stay {stay}",
    keyCurveIid: "independent draws",
    keyCurveDot: "dots: S = {S}",
    // concise 3-sig-fig read-out (<= 35 words across all states)
    readout: Object.freeze({
      iid: "For {S} draws, naive iid SD is {sdIid} vs. exact {sd}. Outside iid bound ±{r} (nominal {alpha}): {count} of the {C} chains ({share}; exact {exact}).",
      iidSame: "With independent draws ({S} draws, SD {sdIid}), outside iid bound ±{r} (nominal {alpha}): {count} of the {C} chains ({share}; exact {exact}).",
      chain: "After {S} draws, chain-aware SD is {sd} (variance {variance}) vs. iid {sdIid} ({iidVariance}), matching {eq} independent draws (exact at {S}; long-run {asym}).",
      chainSame: "After {S} draws, chain-aware SD is {sd} (variance {variance}), the same as for {eq} independent draws.",
      toyIid: "postrank's chains: loss {toyLoss} vs. {toyKnown} (MCSE {toyMcmc} vs. iid {toyIid}; R-hat {toyRhat}, ESS {toyEss}). Stage ({S} draws, SD {sdIid} vs. {sd}): {count}/{C} ({share}; exact {exact}) miss ±{r} (α = {alpha}).",
      toyIidSame: "postrank's chains: loss {toyLoss} vs. {toyKnown} (MCSE {toyMcmc} vs. iid {toyIid}; R-hat {toyRhat}, ESS {toyEss}). Independent stage ({S} draws, SD {sdIid}): {count}/{C} ({share}; exact {exact}) miss ±{r} (α = {alpha}).",
      toyChain: "postrank's chains: loss {toyLoss} vs. {toyKnown} (MCSE {toyMcmc}, R-hat {toyRhat}, ESS {toyEss}). Stage ({S} draws): SD {sd} ({variance}) vs. iid {sdIid} ({iidVariance}), matching {eq} draws (long-run {asym}).",
      toyChainSame: "postrank's chains: loss {toyLoss} vs. {toyKnown} (MCSE {toyMcmc}, R-hat {toyRhat}, ESS {toyEss}). Stage ({S} draws): chain-aware SD {sd} ({variance}), matching {eq} independent draws.",
    }),
    // postrank's own MCMC example (in Data)
    toyHead: "postrank's own MCMC example: {C} chains of {S} draws (pr_toy_mcmc)",
    toyAbout: "A two-state chain: in one state A is above B on criterion k1, in the other it is not. The chain leaves the first state with chance {p01} and the second with chance {p10} per draw, so in the long run {pi} of its draws have A not above B. The fixed report {report} (weights {w1} and {w2} on the two criteria) loses {l0} in a draw with A above B and {l1} in one without: an exact expected loss of {loss}.",
    toyTrace: "Trace in the rows",
    toyTraceActive: "Trace shown: {which}",
    toyWords: Object.freeze({ pair: "A not above B", loss: "Loss of the fixed report" }),
    toyLanesAlt: Object.freeze({
      pair: "Four rows, one per chain of postrank's example: a dark strip over each run of draws with A not above B, the running share of those draws as a line, a dashed line at the known chance and the chain's mean at the right end.",
      loss: "Four rows, one per chain of postrank's example: a dark strip over each run of draws with A not above B, the running mean of the fixed report's loss as a line, a dashed line at its exact expected loss and the chain's mean loss at the right end.",
    }),
    toyLanesTable: Object.freeze({ pair: "The chains of postrank's example: draws with A not above B, and their share", loss: "The chains of postrank's example: draws with A not above B, and the fixed report's mean loss" }),
    toyChainAxis: "Chain",
    toyDrawAxis: "Draw",
    tChain: "Chain",
    tOnes: "Draws with A not above B",
    tToyMean: Object.freeze({ pair: "Their share", loss: "Mean loss" }),
    toyKeyStrip: "dark strip: draws with A not above B",
    toyKeyRun: Object.freeze({ pair: "running share of those draws, from {zero} to {top} in each row", loss: "running mean loss, from {zero} to {top} in each row" }),
    toyKeyKnown: Object.freeze({ pair: "dashed line: the known chance {known}", loss: "dashed line: the exact expected loss {known}" }),
    toyKeyMean: "at the right: the chain's mean",
    toyKbdLabel: "The four chains of postrank's example: every 32nd draw",
    toyKbd: Object.freeze({
      pair: "Chain {c}, draw {b}: running share {m} with A not above B (known chance {known}).",
      loss: "Chain {c}, draw {b}: running mean loss {m} (exact expected loss {known}).",
    }),
    toyPooledAlt: "The pooled estimates of postrank's example, for the share of draws with A not above B and for the fixed report's loss, each with an interval of two MCMC MCSE either side and one of two SDs by the iid formula, and a dashed line at the known value.",
    toyPooledTable: "Pooled estimates of postrank's example with their intervals",
    toyPooledX: "Pooled estimate, with its interval",
    toyGroups: Object.freeze({ pair: "A not above B on k1", loss: "Loss of the fixed report" }),
    toyRows: Object.freeze({ mcmc: "MCMC MCSE", iid: "iid formula" }),
    tWhat: "Estimate",
    tInterval: "Interval",
    tKnown: "Known value",
    toyKeyMcmc: "pooled estimate ± {two} MCMC MCSE (postrank_diagnose())",
    toyKeyIid: "± {two} SDs by the iid formula",
    toyKeyKnownPooled: "dashed line: the known value",
    toyKbdPooled: "{group}, {row}: pooled {est}, from {lo} to {hi}; the known value {known} lies {where}.",
    toyInside: "inside",
    toyOutside: "outside",
    toyTableCaption: "postrank_diagnose() on the {N} draws",
    toyColPair: "A not above B on k1",
    toyColLoss: "Loss of the fixed report",
    toyRowEst: "Pooled estimate",
    toyRowKnown: "Known value",
    toyRowMcmc: "MCMC MCSE",
    toyRowIid: "iid formula, SD/√S",
    toyRowRhat: "R-hat (flagged above {g})",
    toyRowEss: "Bulk ESS (flagged below {g}, {per} per chain)",
    toyOnes: "{v} ({k} of {N} draws)",
    toyReading: "postrank flags R-hat above {rhat} and ESS below {per} per chain as possible problems in how the chains explore; passing those checks would not establish convergence.",
    toyNotice: "Synthetic pr_toy_mcmc data from postrank 1.1.0 (vignette m6; CC BY 4.0).",
    methodModel: "Two units, one criterion, two equally likely states, after the postrank theory book, chapter 15. Every chain's first draw is A above B or A below B with chance one half each; the independent runs use the same seed.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const HALF = CONFIG.independent;

// ---------------------------------------------------------------------------------------------- formats

const nonZeroDecimal = (v, digits) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

const F = Object.freeze({
  setting: (v) => formatSetting(v),
  count: (v) => formatCount(v),
  prob: (v) => formatProb(v),
  readoutProb: (v) => formatReadoutProb(v),
  readoutEst: (v) => formatReadoutEst(v),
  readoutRisk: (v) => formatReadoutRisk(v),
  share: (v) => formatProb(v, { digits: CONFIG.digits.share }),
  shareSe: (v) => nonZeroDecimal(v, CONFIG.digits.shareSe),
  variance: (v) => formatSig(v, { sig: 4 }),
  sd: (v) => formatSig(v, { sig: 3 }),
  eq: (v) => formatSig(v, { sig: 3 }),
  radius: (v) => nonZeroDecimal(v, CONFIG.digits.radius),
  est: (v) => formatProb(v),
  mcse: (v) => formatSig(v, { sig: 3 }),
  half: (v) => formatRational(v),
  percent: (v) => formatPercent(v),
  fact: (v) => formatDecimal(v, { digits: decimalsNeeded(v) }),
  rhat: (v) => formatDecimal(v, { digits: CONFIG.digits.rhat }),
  ess: (v) => formatDecimal(v, { digits: CONFIG.digits.ess }),
});

/** The known value of postrank's example: the chance as written (.2), the expected loss as a fraction (4/15). */
const fmtKnown = (mode, v) => (mode === "loss" ? F.half(v) : F.fact(v));

// ---------------------------------------------------------------------------------------------- text helpers

/** A template with {slots} as nodes: a slot is a node, a string or a function returning one. */
function fill(template, slots) {
  return String(template).split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (!m || !(m[1] in slots)) return p;
    const v = slots[m[1]];
    return typeof v === "function" ? v() : v;
  });
}

/** The same template as plain text (keyboard titles). */
const words = (template, slots) => String(template).replace(/\{(\w+)\}/g, (all, k) => (k in slots ? String(slots[k]) : all));

// ---------------------------------------------------------------------------------------------- computing

/** A first-in first-out memo of `size` entries; get.has(key) tells whether a key is stored. */
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
  return get;
}

/** The switch probability of a stay probability (p01 = p10 = 1 − stay), on the stay grid's decimals. */
export function switchOf(stay) {
  return Number((1 - stay).toFixed(9));
}

const simMemo = memo(CONFIG.memo, (p, S, chains, seed) => {
  const run = twoStateChain({ p01: p, p10: p, S, chains, seed });
  const traces = run.chains.map((x) => Uint8Array.from(x));
  const means = new Float64Array(chains);
  const constant = new Uint8Array(chains);
  traces.forEach((x, c) => {
    const s = summaryStats(x);
    means[c] = s.mean;
    constant[c] = s.sd === 0 ? 1 : 0;
  });
  return { p, S, chains, seed, pi1: run.pi1, traces, means, constant };
});

/** The simulated chains (memoized): traces as Uint8Arrays, each chain's estimate (engine summaryStats) and whether it is constant. */
export function chainRun(p, S, chains, seed) {
  return simMemo(`${p}|${S}|${chains}|${seed}`, p, S, chains, seed);
}

const lawMemo = memo(32, (p, S) => chainMeanVariance({ p01: p, p10: p, S }));
const law = (p, S) => lawMemo(`${p}|${S}`, p, S);

/** The exact chance that the estimate of S draws lands more than r from π (engine chainCountLaw, outside). */
const outsideMemo = memo(32, (p, S, r) => chainCountLaw({ p01: p, p10: p, S, radius: r }).outside);
const exactOutside = (p, S, r) => outsideMemo(`${p}|${S}|${r}`, p, S, r);

/** The draws at which the running estimate is drawn: every draw up to CONFIG.grid, else CONFIG.grid points and draw 1. */
function gridOf(S) {
  if (S <= CONFIG.grid) return Array.from({ length: S }, (_, i) => i + 1);
  const out = new Set([1]);
  for (let k = 1; k <= CONFIG.grid; k += 1) out.add(Math.round((k * S) / CONFIG.grid));
  return [...out].sort((a, b) => a - b);
}

/** The exact SD of the estimate of b draws at the grid points (engine chainMeanVariance for every b). */
const sdGridMemo = memo(8, (p, S) => gridOf(S).map((b) => Math.sqrt(law(p, b).variance)));

/** The running estimate and the iid MCSE of the draws so far at the grid points (engine runningMean and mcse). */
const runningMemo = memo(8, (trace, S) => {
  const run = runningMean(trace);
  return gridOf(S).map((b) => ({ b, est: run[b - 1], mcse: mcse(trace.subarray(0, b)) }));
});

// ---------------------------------------------------------------------------------------------- postrank's example

const TOYF = TOY.facts;
const TOY_STATES = Object.freeze(TOY.arrays.trace.states.map((x) => Uint8Array.from(x)));
const TOY_LOSS = Object.freeze(TOY_STATES.map((x) => Float64Array.from(x, (v) => (v ? TOYF.fixed_report.loss_state1 : TOYF.fixed_report.loss_state0))));
const TOY_RUNS = Object.freeze(TOY_STATES.map((x) => {
  const out = [];
  for (let b = 0; b < x.length; b += 1) {
    if (!x[b]) continue;
    if (out.length && out[out.length - 1].to === b) out[out.length - 1].to = b + 1;
    else out.push({ from: b + 1, to: b + 1 });
  }
  return out;
}));
const TOY_REPORT = blocksText(Object.values(TOYF.fixed_report.grade), Object.keys(TOYF.fixed_report.grade));

const rowTop = (v) => Math.min(1, Math.ceil(v / CONFIG.chart.toy.topStep - 1e-9) * CONFIG.chart.toy.topStep);

const toyTrace = memo(2, (mode) => {
  const traces = mode === "loss" ? TOY_LOSS : TOY_STATES;
  const running = traces.map((t) => runningMean(t));
  const means = traces.map((t) => summaryStats(t).mean);
  const known = mode === "loss" ? TOYF.known.fixed_report_loss : TOYF.known.pair_probability;
  const top = rowTop(Math.max(known, ...running.map((r) => Math.max(...r))));
  return { running, means, known, top };
});

const TOY_POOLED = Object.freeze({
  pair: Object.freeze({
    est: TOY.summary.pair.mean, mcmc: TOY.summary.pair.mcse_mean, iid: TOY.summary.pair.iid_sd_over_sqrt_draws,
    known: TOYF.known.pair_probability, rhat: TOY.summary.pair.rhat, ess: TOY.summary.pair.ess_bulk,
  }),
  loss: Object.freeze({
    est: TOY.summary.loss.mean, mcmc: TOY.summary.loss.mcse_mean, iid: mcse(TOY_LOSS.flatMap((t) => Array.from(t))),
    known: TOYF.known.fixed_report_loss, rhat: TOY.summary.loss.rhat, ess: TOY.summary.loss.ess_bulk,
  }),
});

const curveMemo = memo(8, (p) => {
  const { from, to, points } = CONFIG.curve;
  const set = new Set(CONFIG.draws.values);
  for (let i = 0; i < points; i += 1) set.add(Math.round(from * (to / from) ** (i / (points - 1))));
  return [...set].sort((a, b) => a - b).map((S) => {
    const v = law(p, S);
    return { S, chain: v.variance, iid: v.iidVariance };
  });
});

/**
 * Histogram bins of the estimates k/S (S even): m neighboring values per bin, m odd (about CONFIG.bins bins), the
 * middle bin centered on 1/2, the end bins cut at 0 and S. Each bin spans its values ± 1/(2S).
 * Returns { lo, hi, bins: [{ i, kLo, kHi, lo, hi, n }] } with every bin (n may be 0).
 */
export function estimateBins(S, means) {
  let m = Math.max(1, Math.round(S / CONFIG.bins));
  if (m % 2 === 0) m += 1;
  const half = (m - 1) / 2;
  const mid = S / 2;
  const tMin = Math.round((0 - mid) / m);
  const tMax = Math.round((S - mid) / m);
  const bins = [];
  for (let t = tMin; t <= tMax; t += 1) {
    const kLo = Math.max(0, mid + t * m - half);
    const kHi = Math.min(S, mid + t * m + half);
    bins.push({ i: t - tMin, kLo, kHi, lo: (kLo - 0.5) / S, hi: (kHi + 0.5) / S, n: 0 });
  }
  for (const x of means) {
    const k = Math.round(x * S);
    bins[Math.round((k - mid) / m) - tMin].n += 1;
  }
  return { lo: -0.5 / S, hi: 1 + 0.5 / S, bins };
}

function tally(run, r, rp) {
  const n = run.means.length;
  const out = new Float64Array(n);
  let outside = 0;
  let outsidePkg = 0;
  let stuck = 0;
  for (let c = 0; c < n; c += 1) {
    const gap = Math.abs(run.means[c] - run.pi1);
    if (gap > r) { out[c] = 1; outside += 1; }
    if (gap > rp) outsidePkg += 1;
    stuck += run.constant[c];
  }
  return { n, outside, outsidePkg, stuck, share: outside / n, sharePkg: outsidePkg / n, se: mcse(out) };
}

function niceTop(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const m = [1, 2, 2.5, 5, 10].find((v) => v * p >= x);
  return m * p;
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `
.prx-widget .prx-cd-stage-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: .8rem; align-items: start; }
.prx-cd-stage-comparison > * { min-width: 0; }
.prx-cd .prx-stage,
.prx-cd .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.prx-cd .prx-toolbar > .prx-controls { flex: 1 1 100%; }
.prx-cd .prx-controls > .prx-slider { flex: 1 1 14rem; max-width: 20rem; }
.prx-cd .prx-toolbar > .prx-presets { flex: 0 1 auto; }
.prx-cd [data-prx-disclosure="settings"] > .prx-disclosure-body { align-items: flex-start; gap: 0.65rem 1.25rem; }
.prx-cd .prx-cd-chain { flex: 1 1 14rem; max-width: 22rem; min-width: 0; }
.prx-cd .prx-cd-chain > .prx-slider { max-width: none; }
.prx-cd .prx-cd-chain .prx-hint, .prx-cd .prx-cd-seed .prx-hint, .prx-cd .prx-cd-mode .prx-hint { margin: 0.15rem 0 0; }
.prx-cd .prx-cd-mode { flex: 1 1 16rem; max-width: 30rem; }
.prx-cd .prx-cd-seed { flex: 0 1 auto; display: flex; flex-wrap: wrap; align-items: center; column-gap: 0.5rem; }
.prx-cd .prx-cd-seed > label { margin: 0; }
.prx-cd .prx-cd-seed input[type="number"] { width: 8rem; max-width: 100%; }
.prx-cd .prx-cd-seed .prx-hint { flex: 1 1 100%; }
.prx-cd .prx-cd-toy-seg { flex: 1 1 15rem; max-width: 28rem; }
.prx-cd .prx-cd-sym sub { font-size: 0.75em; }

/* stage & disclosures layout (PR-01 safe: no cross-panel grid-area assignments) */
.prx-cd .prx-cd-trace,
.prx-cd .prx-cd-dist,
.prx-cd .prx-cd-numbers,
.prx-cd .prx-cd-curve,
.prx-cd .prx-cd-toy { grid-area: auto; min-width: 0; max-width: 100%; }
.prx-cd .prx-cd-data-stack { container-type: inline-size; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.15rem; min-width: 0; }
.prx-cd .prx-cd-hist-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 1.25rem; align-items: start; min-width: 0; }
@container (min-width: 48rem) {
  .prx-cd .prx-cd-hist-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.prx-cd .prx-cd-hist-col { min-width: 0; }
.prx-cd .prx-cd-toy { padding-top: 0.9rem; border-top: 1px solid var(--prx-border); }
.prx-cd .prx-cd-toy-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.85rem 1.4rem; align-items: start; margin-top: 0.5rem; }
.prx-cd .prx-cd-toy-col { min-width: 0; }
@container (min-width: 48rem) {
  .prx-cd .prx-cd-toy-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-cd .prx-cd-toy-wide { grid-column: 1 / -1; }
}
.prx-cd .prx-cd-method-stack { display: grid; gap: 0.45rem; min-width: 0; }
.prx-cd .prx-cd-method-stack > p { margin: 0; }

.prx-cd .prx-cd-heading { margin: 0 0 0.25rem; font-size: 0.9375rem; font-weight: 700; line-height: 1.3; color: var(--prx-fg-heading); }
.prx-cd .prx-cd-sub { margin: 0.35rem 0 0.15rem; font-size: 0.875rem; font-weight: 600; line-height: 1.3; color: var(--prx-fg); }
.prx-cd .prx-cd-note { margin: 0.35rem 0 0; font-size: 0.875rem; color: var(--prx-fg-muted); }
.prx-cd .prx-cd-line { margin: 0.4rem 0 0; font-size: 0.875rem; color: var(--prx-fg); }
.prx-cd .prx-cd-summary { margin: 0.25rem 0 0; font-size: 0.84375rem; color: var(--prx-fg-muted); font-variant-numeric: tabular-nums; }
.prx-cd .prx-cd-notice { margin: 0.45rem 0 0; font-size: 0.8125rem; color: var(--prx-fg-muted); overflow-wrap: anywhere; }

/* legend swatches on paper surface */
.prx-cd .prx-cd-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.35rem 0 0; padding: 0.3rem 0.5rem; font-size: 0.8125rem;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: 5px; }
.prx-cd .prx-stage .prx-cd-key { padding: 0.25rem 0; border: 0; border-radius: 0; }
.prx-cd .prx-cd-key-item { display: inline-flex; align-items: center; gap: 0.38rem; min-width: 0; }
.prx-cd .prx-cd-sw { flex: none; display: inline-block; box-sizing: border-box; position: relative; }
.prx-cd .prx-cd-sw-state { width: 1.35rem; height: 0.55rem; border-top: 1.2px solid var(--prx-plot-fg); border-right: 1.2px solid var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-est { width: 1.35rem; height: 0; border-top: 2.2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-band { width: 0.9rem; height: 0.9rem; border: 1px solid var(--prx-est); }
.prx-cd .prx-cd-sw-band::before { content: ""; position: absolute; inset: 0; background: var(--prx-est); opacity: 0.22; }
.prx-cd .prx-cd-sw-pi { width: 1.35rem; height: 0; border-top: 2px dashed var(--prx-post); }
.prx-cd .prx-cd-sw-bound { width: 1.35rem; height: 0; border-top: 1.5px dotted var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-strip { width: 1.35rem; height: 0.45rem; background: var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-iidline { width: 1.35rem; height: 0; border-top: 2px solid var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-mcmc { width: 1.55rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-mcmc::after { content: ""; position: absolute; left: 50%; top: -4px; width: 8px; height: 8px; margin-left: -4px;
  background: var(--prx-est); border-radius: 50%; }
.prx-cd .prx-cd-sw-bar { width: 0.8rem; height: 0.8rem; border: 1px solid var(--prx-cell-border); }
.prx-cd .prx-cd-sw-chainbar { background: var(--prx-est); }
.prx-cd .prx-cd-sw-iidbar { background: var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-gray { width: 0.9rem; height: 0.9rem; border: 1px solid var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-gray::before { content: ""; position: absolute; inset: 0; background: var(--prx-plot-muted); opacity: 0.2; }
.prx-cd .prx-cd-sw-radius { width: 0.6rem; height: 0.9rem; border-left: 1.6px solid var(--prx-plot-fg); border-right: 1.6px solid var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-pivert { width: 0; height: 0.9rem; margin: 0 0.3rem; border-left: 2px dashed var(--prx-post); }
.prx-cd .prx-cd-sw-marker { width: 0; height: 0; margin: 0 0.15rem; border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; }
.prx-cd .prx-cd-sw-curve { width: 1.35rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-curveiid { width: 1.35rem; height: 0; border-top: 2px dashed var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--prx-plot-fg); }

/* tables inside Data disclosure */
.prx-cd .prx-cd-table-wrap { max-width: 100%; margin: 0.25rem 0 0; overflow-x: auto; }
.prx-cd .prx-cd-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.prx-cd .prx-cd-table caption { caption-side: top; padding: 0 0 0.3rem; text-align: left; color: var(--prx-fg); font-weight: 600; }
.prx-cd .prx-cd-table th, .prx-cd .prx-cd-table td { padding: 0.22rem 0.45rem; text-align: right; vertical-align: top;
  border-bottom: 1px solid var(--prx-border); overflow-wrap: normal; word-break: normal; }
.prx-cd .prx-cd-table thead th { font-weight: 600; vertical-align: bottom; white-space: normal; }
.prx-cd .prx-cd-table thead .prx-cd-colstay { display: block; font-weight: 400; color: var(--prx-fg-muted); white-space: nowrap; }
.prx-cd .prx-cd-table tbody th { font-weight: 400; text-align: left; min-width: 6.5rem; }
.prx-cd .prx-cd-table td { white-space: nowrap; }
.prx-cd .prx-cd-numbers { container-type: inline-size; }
@container (max-width: 24rem) {
  .prx-cd .prx-cd-table td { white-space: normal; }
}
.prx-cd .prx-cd-table tr.prx-cd-indent th { padding-left: 1.1rem; }
.prx-cd[aria-busy="true"] .prx-stage,
.prx-cd[aria-busy="true"] .prx-cd-data-stack { opacity: 0.55; }
`;

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      stay: { type: "number", min: CONFIG.stay.min, max: CONFIG.stay.max, step: CONFIG.stay.step, value: CONFIG.stay.value },
      draws: { type: "choice", values: CONFIG.draws.values, value: CONFIG.draws.value },
      chains: { type: "choice", values: CONFIG.chains.values, value: CONFIG.chains.value },
      chain: { type: "integer", min: CONFIG.chain.min, max: CONFIG.chain.max, value: CONFIG.chain.value },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      mode: { type: "choice", values: CONFIG.mode.values, value: CONFIG.mode.value },
      toy: { type: "choice", values: CONFIG.toy.values, value: CONFIG.toy.value },
    },
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);
      const tag = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => tag(ctx.num(raw, display), name);
      const sym = () => h("span", { class: "prx-cd-sym" }, "π", h("sub", {}, "AB"));
      const seffSym = () => h("span", { class: "prx-cd-sym" }, "S", h("sub", {}, "eff"));
      const halfNode = (name) => num(HALF, F.half(HALF), name);
      const two = () => num(CONFIG.z, F.count(CONFIG.z));
      const zero = () => num(0, F.count(0));
      const one = () => num(1, F.count(1));
      const inside = () => num(CONFIG.inside, F.percent(CONFIG.inside));
      const swatch = (cls) => h("span", { class: `prx-cd-sw ${cls}`, "aria-hidden": "true" });
      const item = (cls, ...content) => h("span", { class: "prx-cd-key-item" }, swatch(cls), h("span", {}, ...content));

      // --- Primary toolbar controls (2 primary controls: stay probability + chain length S)
      const stay = ctx.slider({
        label: T.stay, ...ctx.key("stay"), name: "stay", format: (v) => F.setting(v),
        onInput: (v) => ctx.set({ stay: v }),
      });
      ctx.primaryControl(stay.root);
      const draws = ctx.select({
        label: T.draws, name: "draws", value: ctx.state.draws,
        options: CONFIG.draws.values.map((v) => ({ value: v, label: F.count(v) })),
        onChange: (v) => ctx.set({ draws: v }),
      });
      ctx.controls.append(stay.root, draws.root);

      // --- Secondary controls inside Settings disclosure
      const settings = ctx.settingsBox(T.settingsTitle);
      const mode = ctx.segmented({
        label: T.mode, name: "mode", value: ctx.state.mode, className: "prx-cd-mode",
        options: CONFIG.mode.values.map((v) => ({ value: v, label: T.modeWords[v] })),
        onChange: (v) => ctx.set({ mode: v }),
      });
      const modeHint = h("p", { id: uid("prx-cd-mode-hint"), class: "prx-hint" });
      mode.root.append(modeHint);
      for (const b of mode.buttons) b.setAttribute("aria-describedby", modeHint.id);

      const chainSlot = h("div", { class: "prx-cd-chain" });
      const chainHint = h("p", { class: "prx-hint", id: uid("prx-cd-chain-hint") });
      let chainLimit = null;
      let chainSlider = null;
      let chainMax = 0;
      const makeChainSlider = (max, value) => {
        chainMax = max;
        chainSlider = ctx.slider({
          label: T.chain, min: CONFIG.chain.min, max, step: 1, value, name: "chain", key: "slider:chain",
          format: (v) => F.count(v), onInput: (v) => ctx.set({ chain: Math.round(v) }),
        });
        chainSlider.input.setAttribute("aria-describedby", chainHint.id);
        chainSlot.replaceChildren(chainSlider.root, chainHint);
      };
      makeChainSlider(ctx.state.chains, Math.min(ctx.state.chain, ctx.state.chains));

      const chains = ctx.segmented({
        label: T.chains, name: "chains", value: ctx.state.chains,
        options: CONFIG.chains.values.map((v) => ({ value: v, label: ctx.num(v, F.count(v)) })),
        onChange: (v) => ctx.set({ chains: v }),
      });
      const seedHintId = uid("prx-cd-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
        describedBy: seedHintId, onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      seed.root.classList.add("prx-cd-seed");

      const toySeg = ctx.segmented({
        label: T.toyTrace, name: "toy", value: ctx.state.toy, className: "prx-cd-toy-seg",
        options: CONFIG.toy.values.map((v) => ({ value: v, label: T.toyWords[v] })),
        onChange: (v) => ctx.set({ toy: v }),
      });
      settings.body.append(mode.root, chainSlot, chains.root, seed.root, toySeg.root);

      // --- Primary stage (ctx.stage): single-chain running-estimate trace + concise summary strip
      const traceTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const traceSlot = h("div", { class: "prx-cd-trace-chart" });
      const traceKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const chainLine = h("p", { class: "prx-cd-line", "data-prx-note": "chain" });
      const stageLawLine = h("p", { class: "prx-cd-summary" });
      const stageToyLine = h("p", { class: "prx-cd-summary", "data-prx-note": "toy-stage", hidden: true });
      const traceBox = h("section", { class: "prx-cd-trace", "aria-label": T.traceY },
        traceTitle, traceSlot, traceKey, chainLine, stageLawLine, stageToyLine);
      const seComparison = h("section", { "data-prx-evidence": "chain-standard-errors" });
      ctx.stage.append(h("div", { class: "prx-cd-stage-comparison" }, traceBox, seComparison));

      // --- Data disclosure: histograms, exact statistics table, variance curve, and postrank's MCMC traces
      const dataBox = ctx.dataBox(T.dataTitle);

      const distTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const chainSub = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-cd-sub" }));
      const chainSlotHist = h("div", { class: "prx-cd-hist-chart prx-cd-chain-hist" });
      const iidSub = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-cd-sub" }));
      const iidSlotHist = h("div", { class: "prx-cd-hist-chart prx-cd-iid-hist" });
      const distKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const distNote = h("p", { class: "prx-cd-line", "data-prx-part": "notes" });
      const distBox = h("section", { class: "prx-cd-dist", "aria-label": T.distX },
        distTitle,
        h("div", { class: "prx-cd-hist-grid" },
          h("div", { class: "prx-cd-hist-col" }, chainSub, chainSlotHist),
          h("div", { class: "prx-cd-hist-col" }, iidSub, iidSlotHist)),
        distKey, distNote);

      const numbersTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const tableSlot = h("div", { class: "prx-cd-table-slot", "data-prx-part": "table" });
      const numbersBox = h("section", { class: "prx-cd-numbers", "aria-label": T.tableLabel },
        numbersTitle, tableSlot);

      const curveTitle = ctx.panelTitle(T.curveHead, { className: "prx-cd-heading" });
      const curveSlot = h("div", { class: "prx-cd-curve-chart" });
      const curveKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const curveBox = h("section", { class: "prx-cd-curve", "aria-label": T.curveHead }, curveTitle, curveSlot, curveKey);

      const fixed = TOYF.fixed_report;
      const toyTitle = ctx.panelTitle(fill(T.toyHead, {
        C: () => num(TOYF.chains, F.count(TOYF.chains)), S: () => num(TOYF.draws_per_chain, F.count(TOYF.draws_per_chain)),
      }), { className: "prx-cd-heading" });
      const toyAbout = h("p", { class: "prx-cd-note", "data-prx-part": "notes" }, ...fill(T.toyAbout, {
        p01: () => num(TOYF.transitions.p01, F.fact(TOYF.transitions.p01)), p10: () => num(TOYF.transitions.p10, F.fact(TOYF.transitions.p10)),
        pi: () => num(TOYF.stationary_p1, F.fact(TOYF.stationary_p1)), report: TOY_REPORT,
        w1: () => num(fixed.weights.k1, F.fact(fixed.weights.k1)), w2: () => num(fixed.weights.k2, F.fact(fixed.weights.k2)),
        l0: () => num(fixed.loss_state0, F.half(fixed.loss_state0)), l1: () => num(fixed.loss_state1, F.half(fixed.loss_state1)),
        loss: () => num(TOYF.known.fixed_report_loss, F.half(TOYF.known.fixed_report_loss)),
      }));
      const toyTraceSub = ctx.panelTitle("", { level: 5, className: "prx-cd-sub" });
      const toyLanes = h("div", { class: "prx-cd-toy-chart" });
      const toyLanesKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const toyPooled = h("div", { class: "prx-cd-toy-chart" });
      const toyPooledKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const toyTableSlot = h("div", { class: "prx-cd-table-slot", "data-prx-part": "table" });
      const toyReading = h("p", { class: "prx-cd-line", "data-prx-part": "notes", "data-prx-note": "toy-reading" });
      const toyNotice = h("p", { class: "prx-cd-notice", "data-prx-note": "toy-notice", text: T.toyNotice });
      const toyBox = h("section", { class: "prx-cd-toy", "aria-label": words(T.toyHead, { C: TOYF.chains, S: TOYF.draws_per_chain }) },
        toyTitle, toyAbout,
        h("div", { class: "prx-cd-toy-grid" },
          h("div", { class: "prx-cd-toy-col prx-cd-toy-wide" }, toyTraceSub, toyLanes, toyLanesKey),
          h("div", { class: "prx-cd-toy-col" }, toyPooled, toyPooledKey),
          h("div", { class: "prx-cd-toy-col" }, toyTableSlot, toyReading)));

      const dataStack = h("div", { class: "prx-cd-data-stack" }, distBox, numbersBox, curveBox, toyBox);
      dataBox.body.append(dataStack);
      // Author-scope data notice outside numberScope (so "1.1.0" and "4.0" version strings are not scanned as data-num)
      ctx.root.append(toyNotice);

      // --- Method disclosure: stationary chain law, effective sample size, and error-bound notes
      const methodBox = ctx.methodBox(T.methodTitle);
      const stayNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes" },
        ...fill(T.stayHint, { independent: () => num(HALF, F.setting(HALF)) }));
      const modelNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes", text: T.methodModel });
      const eqNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes", "data-prx-note": "equivalent", text: T.eqNote });
      const failNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes", "data-prx-note": "fail" });
      const radiusNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes" });
      methodBox.body.append(h("div", { class: "prx-cd-method-stack" }, modelNote, stayNote, eqNote, failNote, radiusNote));

      // ------------------------------------------------------------------------------------------- drawing

      function drawTrace(state, d) {
        const { S, trace, run, band, r } = d;
        const at = (x) => (x ? 1 + C.stateOffset : -C.stateOffset);
        const steps = [];
        for (let b = 1; b <= S; b += 1) steps.push({ x: b - 0.5, y: at(trace[b - 1]) });
        steps.push({ x: S + 0.5, y: at(trace[S - 1]) });
        const hasBound = r < HALF;
        traceTitle.replaceChildren(...fill(T.traceHead, { c: () => num(d.c, F.count(d.c), "trace-chain"), S: () => num(S, F.count(S)) }));
        plot(traceSlot, {
          alt: T.traceAlt,
          height: C.traceHeight,
          marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [0.5, S + 0.5], label: T.traceX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.xTicks },
          y: { domain: [-C.tracePad, 1 + C.tracePad], label: T.traceY, labelAnchor: "center", labelArrow: "none", grid: true, ticks: [0, 0.25, 0.5, 0.75, 1] },
          marks: (c, P) => [
            P.areaY(band, { x: "b", y1: "lo", y2: "hi", fill: c.est, fillOpacity: C.bandOpacity }),
            hasBound ? P.ruleY([d.pi - r, d.pi + r], { stroke: c.plotMuted, strokeWidth: 1.2, strokeDasharray: "2,3" }) : null,
            P.ruleY([d.pi], { stroke: c.post, strokeWidth: C.piWidth, strokeDasharray: C.piDash }),
            P.line(run, { x: "b", y: "est", stroke: c.est, strokeWidth: C.estWidth }),
            P.line(steps, { x: "x", y: "y", curve: "step-after", stroke: c.plotFg, strokeWidth: C.stateWidth }),
          ],
          keyboard: {
            data: run, x: "b", y: "est", key: (p) => `b${p.b}`, label: T.traceKbd,
            title: (p) => (p.lo === undefined
              ? words(T.traceKbdNoBand, { b: F.count(p.b), est: F.est(p.est) })
              : words(T.traceKbdItem, { b: F.count(p.b), est: F.est(p.est), lo: F.est(p.lo), hi: F.est(p.hi) })),
          },
        });
        const keyItems = [
          item("prx-cd-sw-state", T.keyState),
          item("prx-cd-sw-est", T.keyEst),
          item("prx-cd-sw-band", ...fill(T.keyBand[state.mode], { two })),
          item("prx-cd-sw-pi", ...fill(T.keyPi, { pi: sym, half: () => halfNode() })),
        ];
        if (hasBound) keyItems.push(item("prx-cd-sw-bound", ...fill(T.keyBoundLine, { r: () => writer.est(r) })));
        traceKey.replaceChildren(...keyItems);

        const line = fill(T.chainLine, {
          S: () => num(S, F.count(S)), c: () => num(d.c, F.count(d.c)),
          est: () => num(d.est, F.est(d.est), "chain-est"), mcse: () => num(d.mcse, F.mcse(d.mcse), "chain-mcse"),
        });
        const lo = Math.max(0, d.est - CONFIG.z * d.mcse);
        const hi = Math.min(1, d.est + CONFIG.z * d.mcse);
        if (!d.stuck && (hi < d.pi || lo > d.pi)) {
          line.push(...fill(T.chainMiss, {
            lo: () => num(lo, F.est(lo), "chain-band-lo"), hi: () => num(hi, F.est(hi), "chain-band-hi"), pi: sym, half: () => halfNode(),
          }));
        }
        line.push(".");
        if (d.stuck) line.push(" ", ...fill(T.stuckLine, { zero, one, pi: sym, half: () => halfNode() }));
        chainLine.replaceChildren(...line);

        stageLawLine.replaceChildren(...fill(T.stageLawLine, {
          C: () => writer.count(d.tc.n),
          seffSym,
          eq: () => writer.est(d.lawChain.equivalentDraws),
          noSwitch: () => writer.prob(d.lawChain.noSwitch),
          stuck: () => writer.count(d.tc.stuck),
        }));
        stageToyLine.hidden = state.toy !== "loss";
        if (state.toy === "loss") {
          const tl = TOY_POOLED.loss;
          stageToyLine.replaceChildren(
            "postrank's chains (",
            writer.count(TOYF.chains),
            " × ",
            writer.count(TOYF.draws_per_chain),
            " draws in Data): fixed-report loss ",
            writer.prob(tl.est),
            " vs. exact ",
            num(tl.known, F.half(tl.known)),
            " (MCMC MCSE ",
            writer.est(tl.mcmc),
            " vs. iid ",
            writer.est(tl.iid),
            "; R-hat ",
            writer.est(tl.rhat),
            ", ESS ",
            writer.est(tl.ess),
            ").",
          );
        } else {
          stageToyLine.replaceChildren();
        }
      }

      function drawHistogram(slot, { which, S, bins, lo, hi, top, pi, sd, r, marker, C: count }) {
        const isChain = which === "chain";
        const filled = bins.filter((b) => b.n > 0);
        const bandLo = Math.max(lo, pi - CONFIG.z * sd);
        const bandHi = Math.min(hi, pi + CONFIG.z * sd);
        plot(slot, {
          alt: isChain ? T.chainAlt : T.iidAlt,
          table: {
            caption: isChain ? T.chainTable : T.iidTable,
            columns: [
              { label: T.tFrom, value: (b) => b.kLo / S, format: F.est },
              { label: T.tTo, value: (b) => b.kHi / S, format: F.est },
              { label: isChain ? T.tChains : T.tRuns, value: "n", format: F.count },
            ],
            rows: filled,
          },
          height: C.histHeight,
          marginTop: C.histTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [lo, hi], label: T.distX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: [0, 0.25, 0.5, 0.75, 1] },
          y: { domain: [0, top], label: isChain ? T.distYChain : T.distYIid, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.yTicks },
          marks: (c, P) => [
            P.rect([{ x1: bandLo, x2: bandHi }], { x1: "x1", x2: "x2", y1: 0, y2: top, fill: c.plotMuted, fillOpacity: C.histBandOpacity }),
            P.rect(filled, { x1: "lo", x2: "hi", y1: 0, y2: "n", fill: isChain ? c.est : c.plotMuted, stroke: c.plotBg, strokeWidth: C.barRim }),
            P.ruleY([0], { stroke: c.plotAxis }),
            P.ruleX([pi - r, pi + r], { stroke: c.plotFg, strokeWidth: C.radiusWidth }),
            P.ruleX([pi], { stroke: c.post, strokeWidth: C.piWidth, strokeDasharray: C.piDash }),
            marker === null ? null : P.dot([marker], { x: (v) => v, frameAnchor: "top", dy: C.markerDy, symbol: "triangle", rotate: 180, r: C.marker, fill: c.plotFg }),
          ],
          keyboard: {
            data: filled, x: (b) => (b.lo + b.hi) / 2, y: "n", key: (b) => `${which}${b.i}`, label: isChain ? T.chainKbd : T.iidKbd,
            title: (b) => (b.kLo === b.kHi
              ? words(T.kbdBinOne, { n: F.count(b.n), C: F.count(count), what: isChain ? T.kbdChains : T.kbdRuns, v: F.est(b.kLo / S) })
              : words(T.kbdBin, {
                n: F.count(b.n), C: F.count(count), what: isChain ? T.kbdChains : T.kbdRuns,
                lo: F.est(b.kLo / S), hi: F.est(b.kHi / S),
              })),
          },
        });
      }

      function drawDistribution(state, d) {
        const { S, chainsRun, ref, lawChain, lawIid, r, tc, ti, xc, xi } = d;
        const C2 = chainsRun.means.length;
        const bc = estimateBins(S, chainsRun.means);
        const bi = estimateBins(S, ref.means);
        const sdChain = state.mode === "chain" ? Math.sqrt(lawChain.variance) : Math.sqrt(lawChain.iidVariance);
        const sdIid = Math.sqrt(lawIid.variance);
        const stayNode = () => num(state.stay, F.setting(state.stay));
        distTitle.replaceChildren(...fill(T.distHead, { S: () => num(S, F.count(S)) }));
        chainSub.replaceChildren(...fill(T.chainSub, { stay: stayNode, C: () => num(C2, F.count(C2)), S: () => num(S, F.count(S)) }));
        iidSub.replaceChildren(...fill(T.iidSub, { half: () => num(HALF, F.setting(HALF)), C: () => num(C2, F.count(C2)), S: () => num(S, F.count(S)) }));
        const topChain = niceTop(Math.max(...bc.bins.map((b) => b.n)));
        const topIid = niceTop(Math.max(...bi.bins.map((b) => b.n)));
        drawHistogram(chainSlotHist, { which: "chain", S, bins: bc.bins, lo: bc.lo, hi: bc.hi, top: topChain, pi: chainsRun.pi1, sd: sdChain, r, marker: d.est, C: C2 });
        drawHistogram(iidSlotHist, { which: "iid", S, bins: bi.bins, lo: bi.lo, hi: bi.hi, top: topIid, pi: ref.pi1, sd: sdIid, r, marker: null, C: C2 });
        const alpha = () => num(CONFIG.alpha, F.setting(CONFIG.alpha));
        distKey.replaceChildren(
          item("prx-cd-sw-bar prx-cd-sw-chainbar", ...fill(T.keyChainBar, { stay: stayNode })),
          item("prx-cd-sw-bar prx-cd-sw-iidbar", T.keyIidBar),
          item("prx-cd-sw-gray", ...fill(T.keyHistBand[state.mode], { pi: sym, two, inside })),
          item("prx-cd-sw-radius", ...fill(T.keyRadius, { alpha })),
          item("prx-cd-sw-pivert", ...fill(T.keyPiHist, { pi: sym, half: () => halfNode() })),
          item("prx-cd-sw-marker", ...fill(T.keyMarker, { c: () => num(d.c, F.count(d.c)) })),
        );
        distNote.replaceChildren(...fill(T.distNote, {
          count: () => num(tc.outside, F.count(tc.outside), "dist-outside"), C: () => num(C2, F.count(C2)),
          r: () => num(r, F.radius(r), "dist-radius"),
          share: () => num(tc.share, F.share(tc.share), "dist-share"), se: () => num(tc.se, F.shareSe(tc.se), "dist-share-se"),
          countIid: () => num(ti.outside, F.count(ti.outside), "dist-outside-iid"),
          shareIid: () => num(ti.share, F.share(ti.share), "dist-share-iid"),
          exact: () => num(xc, F.share(xc), "dist-exact"), exactIid: () => num(xi, F.share(xi), "dist-exact-iid"),
        }));
      }

      function drawNumbers(state, d) {
        const { S, lawChain, lawIid, r, rp, tc, ti, xc, xi, xp } = d;
        const stayNode = (name) => num(state.stay, F.setting(state.stay), name);
        const cell = (...content) => h("td", {}, ...content);
        const pair = (count, share, name) => [num(count, F.count(count), `${name}-count`), " (", num(share, F.share(share), `${name}-share`), ")"];
        const row = (label, iid, chain, cls) => h("tr", cls ? { class: cls } : {}, h("th", { scope: "row" }, ...label), cell(...iid), cell(...chain));
        numbersTitle.replaceChildren(...fill(T.numbersHead, { S: () => num(S, F.count(S), "tbl-draws"), stay: () => stayNode("tbl-head-stay") }));
        const iidSD = Math.sqrt(lawChain.iidVariance);
        const chainSD = Math.sqrt(lawChain.variance);
        const seRow = (label, value, key) => h("tr", {},
          h("th", { scope: "row", text: label }), h("td", {}, num(value, F.sd(value), key)));
        seComparison.replaceChildren(ctx.panelTitle("SE of the estimated probability"),
          h("p", {}, "For ", num(S, F.count(S)), " draws at stay probability ", stayNode(), ", the model gives"),
          h("table", { class: "prx-cd-table" }, h("tbody", {},
            seRow("Ignoring dependence", iidSD, "stage-se-iid"), seRow("Accounting for persistence", chainSD, "stage-se-chain"))),
          h("p", {}, state.mode === "chain" ? "Trace band uses the chain model." : "Trace band uses the iid estimate from the observed chain."));
        const sdVar = (v, name) => [num(Math.sqrt(v), F.sd(Math.sqrt(v)), `tbl-sd-${name}`), " (", num(v, F.variance(v), `tbl-var-${name}`), ")"];
        const table = h("table", { class: "prx-cd-table prx-sticky-first" },
          h("thead", {}, h("tr", {},
            h("td", {}),
            h("th", { scope: "col" }, T.colIid, h("span", { class: "prx-cd-colstay" }, ...fill(T.colIidStay, { stay: () => num(HALF, F.setting(HALF)) }))),
            h("th", { scope: "col" }, ...fill(T.colChain, { stay: () => stayNode("tbl-stay") })))),
          h("tbody", {},
            row([T.rowRho], [num(lawIid.rho, F.setting(lawIid.rho), "tbl-rho-iid")], [num(lawChain.rho, F.setting(lawChain.rho), "tbl-rho-chain")]),
            row([T.rowSdVar], sdVar(lawIid.variance, "iid"), sdVar(lawChain.variance, "chain")),
            row([T.rowEq], [num(lawIid.equivalentDraws, F.eq(lawIid.equivalentDraws), "tbl-eq-iid")], [num(lawChain.equivalentDraws, F.eq(lawChain.equivalentDraws), "tbl-eq-chain")]),
            row([T.rowAsym], [num(lawIid.asymptoticEquivalent, F.eq(lawIid.asymptoticEquivalent), "tbl-asym-iid")],
              [num(lawChain.asymptoticEquivalent, F.eq(lawChain.asymptoticEquivalent), "tbl-asym-chain")], "prx-cd-indent"),
            row([T.rowNoSwitch], [num(lawIid.noSwitch, F.prob(lawIid.noSwitch), "tbl-noswitch-iid")], [num(lawChain.noSwitch, F.prob(lawChain.noSwitch), "tbl-noswitch-chain")]),
            row([T.rowStuck], [num(ti.stuck, F.count(ti.stuck), "tbl-stuck-iid")], [num(tc.stuck, F.count(tc.stuck), "tbl-stuck-chain")]),
            row(fill(T.rowOutside, { r: () => num(r, F.radius(r), "tbl-radius") }), pair(ti.outside, ti.share, "tbl-out-iid"), pair(tc.outside, tc.share, "tbl-out-chain")),
            row([T.rowOutsideExact], [num(xi, F.share(xi), "tbl-exact-iid")], [num(xc, F.share(xc), "tbl-exact-chain")], "prx-cd-indent")));
        tableSlot.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-cd-table-wrap" }, table), T.tableLabel));
        const alpha = () => num(CONFIG.alpha, F.setting(CONFIG.alpha));
        const noSwitch = () => num(lawChain.noSwitch, F.prob(lawChain.noSwitch), "note-noswitch");
        const fail = r >= HALF ? fill(T.failNoteWide, {})
          : lawChain.noSwitch < CONFIG.rareBelow ? fill(T.failNoteRare, { pi: sym, noSwitch })
            : fill(T.failNote, { pi: sym, stay: () => stayNode(), noSwitch });
        const independent = state.stay === HALF ? fill(T.failNoteIndependent, { stay: () => stayNode() }) : [];
        failNote.replaceChildren(...independent, ...fail);
        radiusNote.replaceChildren(...fill(T.radiusNote, {
          alpha, rp: () => num(rp, F.radius(rp), "note-radius-pkg"), sharePkg: () => num(tc.sharePkg, F.share(tc.sharePkg), "note-share-pkg"),
          exactPkg: () => num(xp, F.share(xp), "note-exact-pkg"),
        }));
      }

      function drawCurve(state, d) {
        const curve = curveMemo(String(d.p), d.p);
        const S = d.S;
        const at = { S, chain: d.lawChain.variance, iid: d.lawChain.iidVariance };
        const marks = CONFIG.draws.values.map((s) => curve.find((x) => x.S === s));
        plot(curveSlot, {
          alt: T.curveAlt,
          height: C.curveHeight,
          marginTop: C.curveTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.curveRight,
          x: { type: "log", domain: [CONFIG.curve.from, CONFIG.curve.to], ticks: CONFIG.curve.xTicks, label: T.curveX, labelAnchor: "center", labelArrow: "none" },
          y: { type: "log", domain: CONFIG.curve.yDomain, ticks: CONFIG.curve.yTicks, label: T.curveY, labelAnchor: "center", labelArrow: "none" },
          marks: (c, P) => [
            P.ruleX([S], { stroke: c.plotMuted, strokeWidth: 1, strokeDasharray: "2,3" }),
            P.line(curve, { x: "S", y: "chain", stroke: c.est, strokeWidth: C.curveWidth }),
            P.line(curve, { x: "S", y: "iid", stroke: c.plotMuted, strokeWidth: C.curveWidth, strokeDasharray: C.iidDash }),
            P.dot([at], { x: "S", y: "iid", r: C.dot, fill: c.plotFg, stroke: c.plotBg }),
            P.dot([at], { x: "S", y: "chain", r: C.dot, fill: c.plotFg, stroke: c.plotBg }),
          ],
          keyboard: {
            data: marks, x: "S", y: "chain", key: (p) => `s${p.S}`, label: T.curveKbd,
            title: (p) => words(T.curveKbdItem, { S: F.count(p.S), v: F.variance(p.chain), vi: F.variance(p.iid) }),
          },
        });
        curveKey.replaceChildren(
          item("prx-cd-sw-curve", ...fill(T.keyCurveChain, { stay: () => num(state.stay, F.setting(state.stay)) })),
          item("prx-cd-sw-curveiid", T.keyCurveIid),
          item("prx-cd-sw-dot", ...fill(T.keyCurveDot, { S: () => num(S, F.count(S)) })),
        );
      }

      function drawToyLanes(toyMode) {
        const G = C.toy;
        const X = toyTrace(toyMode, toyMode);
        const n = TOY_STATES.length;
        const S = TOYF.draws_per_chain;
        const pitch = G.stripHi + G.gap;
        const base = (c) => (n - 1 - c) * pitch;
        const yOf = (c, v) => base(c) + v / X.top;
        const line = [];
        X.running.forEach((run, c) => { for (let b = 1; b <= S; b += 1) line.push({ c, b, y: yOf(c, run[b - 1]) }); });
        const strips = TOY_RUNS.flatMap((runs, c) => runs.map((r) => ({ x1: r.from - 0.5, x2: r.to + 0.5, y1: base(c) + G.stripLo, y2: base(c) + G.stripHi })));
        const lanes = X.means.map((m, c) => ({
          c, chain: TOY.tables.chains.chain[c], ones: TOY.tables.chains.ones[c], mean: m,
          y0: base(c), y1: base(c) + 1, yKnown: yOf(c, X.known), yMid: base(c) + 0.5, yMean: yOf(c, m),
        }));
        const reads = [1, ...Array.from({ length: Math.floor(S / G.kbdStep) }, (_, i) => (i + 1) * G.kbdStep)];
        const kbd = lanes.flatMap((l) => reads.map((b) => ({ c: l.c, chain: l.chain, b, m: X.running[l.c][b - 1], y: yOf(l.c, X.running[l.c][b - 1]) })));
        const known = fmtKnown(toyMode, X.known);
        toyTraceSub.replaceChildren(...fill(T.toyTraceActive, { which: T.toyWords[toyMode] }));
        plot(toyLanes, {
          alt: T.toyLanesAlt[toyMode],
          table: {
            caption: T.toyLanesTable[toyMode],
            columns: [
              { label: T.tChain, value: "chain", format: F.count },
              { label: T.tOnes, value: "ones", format: F.count },
              { label: T.tToyMean[toyMode], value: "mean", format: F.prob },
            ],
            rows: lanes,
          },
          height: G.marginTop + G.marginBottom + Math.round((n * pitch - G.gap) * G.laneUnit),
          marginTop: G.marginTop, marginBottom: G.marginBottom, marginLeft: G.marginLeft, marginRight: G.marginRight,
          x: { domain: [0.5, S + 0.5], label: T.toyDrawAxis, labelAnchor: "center", labelArrow: "none", ticks: G.xTicks },
          y: { domain: [-0.04, n * pitch - G.gap + 0.02], axis: null },
          marks: (c, P) => [
            P.ruleY(lanes, { y: "y0", stroke: c.plotGrid }),
            P.ruleY(lanes, { y: "y1", stroke: c.plotGrid }),
            P.rect(strips, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.plotFg }),
            P.ruleY(lanes, { y: "yKnown", stroke: c.post, strokeWidth: G.knownWidth, strokeDasharray: C.piDash }),
            P.line(line, { x: "b", y: "y", z: "c", stroke: c.est, strokeWidth: G.lineWidth }),
            numText(lanes, { x: 0.5, y: "yMid", value: "chain", format: F.count, textAnchor: "end", dx: -8, fill: c.plotFg }),
            numText(lanes, { x: S + 0.5, y: "yMean", value: "mean", format: F.prob, textAnchor: "start", dx: 5, fill: c.plotFg }),
            P.text([T.toyChainAxis], { frameAnchor: "left", rotate: -90, dx: -28, text: (d) => d, fill: c.plotFg }),
          ],
          keyboard: {
            data: kbd, x: "b", y: "y", key: (p) => `t${p.c}-${p.b}`, sort: false, label: T.toyKbdLabel,
            title: (p) => words(T.toyKbd[toyMode], { c: F.count(p.chain), b: F.count(p.b), m: F.prob(p.m), known }),
          },
        });
        toyLanesKey.replaceChildren(
          item("prx-cd-sw-strip", T.toyKeyStrip),
          item("prx-cd-sw-est", ...fill(T.toyKeyRun[toyMode], { zero, top: () => num(X.top, F.fact(X.top)) })),
          item("prx-cd-sw-pi", ...fill(T.toyKeyKnown[toyMode], { known: () => num(X.known, known) })),
          h("span", { class: "prx-cd-key-item" }, T.toyKeyMean),
        );
      }

      function drawToyPooled() {
        const G = C.toy;
        const rows = [];
        const groups = [];
        let y = 0;
        for (const g of CONFIG.toy.values) {
          const q = TOY_POOLED[g];
          groups.push({ g, y: y - 0.85, known: q.known, y1: y - 0.45, y2: y + 1.45 });
          for (const kind of ["mcmc", "iid"]) {
            rows.push({ g, kind, y, est: q.est, lo: Math.max(0, q.est - CONFIG.z * q[kind]), hi: Math.min(1, q.est + CONFIG.z * q[kind]), known: q.known });
            y += 1;
          }
          y += 1.7;
        }
        const yLo = groups[0].y - 0.45;
        const yHi = rows[rows.length - 1].y + 0.5;
        const xMax = rowTop(Math.max(...rows.map((r) => Math.max(r.hi, r.known))));
        const insideKnown = (r) => r.known >= r.lo && r.known <= r.hi;
        plot(toyPooled, {
          alt: T.toyPooledAlt,
          table: {
            caption: T.toyPooledTable,
            columns: [
              { label: T.tWhat, value: (r) => `${T.toyGroups[r.g]}, ${T.toyRows[r.kind]}` },
              { label: T.toyRowEst, value: "est", format: F.prob },
              { label: T.tFrom, value: "lo", format: F.prob },
              { label: T.tTo, value: "hi", format: F.prob },
              { label: T.tKnown, value: "known", format: (v, r) => fmtKnown(r.g, v) },
            ],
            rows,
          },
          height: G.pooledTop + G.pooledBottom + Math.round((yHi - yLo) * G.rowPx),
          marginTop: G.pooledTop, marginBottom: G.pooledBottom, marginLeft: G.pooledLeft, marginRight: G.pooledRight,
          x: { domain: [0, xMax], label: T.toyPooledX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: G.pooledTicks },
          y: { domain: [yLo, yHi], axis: null, reverse: true },
          marks: (c, P) => [
            P.ruleX(groups, { x: "known", y1: "y1", y2: "y2", stroke: c.post, strokeWidth: G.knownWidth, strokeDasharray: C.piDash }),
            P.ruleY(rows, { y: "y", x1: "lo", x2: "hi", stroke: (r) => (r.kind === "mcmc" ? c.est : c.plotMuted), strokeWidth: G.barWidth }),
            P.ruleX(rows, { x: "lo", y1: (r) => r.y - G.capHalf, y2: (r) => r.y + G.capHalf, stroke: (r) => (r.kind === "mcmc" ? c.est : c.plotMuted), strokeWidth: G.barWidth }),
            P.ruleX(rows, { x: "hi", y1: (r) => r.y - G.capHalf, y2: (r) => r.y + G.capHalf, stroke: (r) => (r.kind === "mcmc" ? c.est : c.plotMuted), strokeWidth: G.barWidth }),
            P.dot(rows, { x: "est", y: "y", r: G.dot, fill: c.est, stroke: c.plotBg, strokeWidth: 1 }),
            P.text(rows, { x: 0, y: "y", text: (r) => T.toyRows[r.kind], textAnchor: "end", dx: -8, fill: c.plotFg }),
            P.text(groups, { x: 0, y: "y", text: (gr) => T.toyGroups[gr.g], textAnchor: "start", fill: c.plotFg, fontWeight: "bold" }),
          ],
          keyboard: {
            data: rows, x: "est", y: "y", key: (r) => `${r.g}-${r.kind}`, sort: false, label: T.toyPooledTable,
            title: (r) => words(T.toyKbdPooled, {
              group: T.toyGroups[r.g], row: T.toyRows[r.kind], est: F.prob(r.est), lo: F.prob(r.lo), hi: F.prob(r.hi),
              known: fmtKnown(r.g, r.known), where: insideKnown(r) ? T.toyInside : T.toyOutside,
            }),
          },
        });
        toyPooledKey.replaceChildren(
          item("prx-cd-sw-mcmc", ...fill(T.toyKeyMcmc, { two })),
          item("prx-cd-sw-iidline", ...fill(T.toyKeyIid, { two })),
          item("prx-cd-sw-pivert", T.toyKeyKnownPooled),
        );
        const P2 = TOY_POOLED;
        const N = TOYF.draws;
        const essGuide = CONFIG.guide.essPerChain * TOYF.chains;
        const cell = (...content) => h("td", {}, ...content);
        const row = (label, a, b, note) => h("tr", note ? { "data-prx-note": note } : {}, h("th", { scope: "row" }, ...label), cell(...a), cell(...b));
        const sig = (v, name) => num(v, F.mcse(v), name);
        const table = h("table", { class: "prx-cd-table prx-sticky-first" },
          h("caption", {}, ...fill(T.toyTableCaption, { N: () => num(N, F.count(N)) })),
          h("thead", {}, h("tr", {}, h("td", {}), h("th", { scope: "col", text: T.toyColPair }), h("th", { scope: "col", text: T.toyColLoss }))),
          h("tbody", {},
            row([T.toyRowEst],
              fill(T.toyOnes, { v: () => num(P2.pair.est, F.prob(P2.pair.est), "toy-est"), k: () => num(TOYF.known.pooled_ones, F.count(TOYF.known.pooled_ones), "toy-ones"), N: () => num(N, F.count(N)) }),
              [num(P2.loss.est, F.prob(P2.loss.est), "toy-loss-est")]),
            row([T.toyRowKnown], [num(P2.pair.known, fmtKnown("pair", P2.pair.known), "toy-known")], [num(P2.loss.known, fmtKnown("loss", P2.loss.known), "toy-loss-known")]),
            row([T.toyRowMcmc], [sig(P2.pair.mcmc, "toy-mcmc")], [sig(P2.loss.mcmc, "toy-loss-mcmc")]),
            row([T.toyRowIid], [sig(P2.pair.iid, "toy-iid")], [sig(P2.loss.iid, "toy-loss-iid")]),
            row(fill(T.toyRowRhat, { g: () => num(CONFIG.guide.rhat, F.fact(CONFIG.guide.rhat)) }),
              [num(P2.pair.rhat, F.rhat(P2.pair.rhat), "toy-rhat")], [num(P2.loss.rhat, F.rhat(P2.loss.rhat), "toy-loss-rhat")]),
            row(fill(T.toyRowEss, { g: () => num(essGuide, F.count(essGuide)), per: () => num(CONFIG.guide.essPerChain, F.count(CONFIG.guide.essPerChain)) }),
              [num(P2.pair.ess, F.ess(P2.pair.ess), "toy-ess")], [num(P2.loss.ess, F.ess(P2.loss.ess), "toy-loss-ess")])));
        toyTableSlot.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-cd-table-wrap" }, table), words(T.toyTableCaption, { N: F.count(N) })));
        toyReading.replaceChildren(...fill(T.toyReading, {
          rhat: () => num(CONFIG.guide.rhat, F.fact(CONFIG.guide.rhat)), per: () => num(CONFIG.guide.essPerChain, F.count(CONFIG.guide.essPerChain)),
        }));
      }

      function writeReadout(state, d) {
        const { S, lawChain, r, tc, xc } = d;
        const C2 = tc.n;
        const sd = Math.sqrt(lawChain.variance);
        const sdIid = Math.sqrt(lawChain.iidVariance);
        const same = F.readoutEst(sd) === F.readoutEst(sdIid) && F.readoutRisk(lawChain.variance) === F.readoutRisk(lawChain.iidVariance);
        const tl = TOY_POOLED.loss;
        const slots = {
          S: () => writer.count(S, { hook: "read-draws" }),
          C: () => writer.count(C2, { hook: "read-chains" }),
          r: () => writer.est(r, { hook: "read-radius" }),
          alpha: () => writer.setting(CONFIG.alpha, { hook: "read-alpha" }),
          share: () => writer.prob(tc.share, { hook: "read-share" }),
          count: () => writer.count(tc.outside, { hook: "read-count" }),
          exact: () => writer.prob(xc, { hook: "read-exact" }),
          sd: () => writer.est(sd, { hook: "read-sd" }),
          sdIid: () => writer.est(sdIid, { hook: "read-sd-iid" }),
          variance: () => writer.risk(lawChain.variance, { hook: "read-variance" }),
          iidVariance: () => writer.risk(lawChain.iidVariance, { hook: "read-iid-variance" }),
          eq: () => writer.est(lawChain.equivalentDraws, { hook: "read-eq" }),
          asym: () => writer.est(lawChain.asymptoticEquivalent, { hook: "read-asym" }),
          toyLoss: () => writer.prob(tl.est, { hook: "read-toy-loss" }),
          toyKnown: () => num(tl.known, F.half(tl.known), "read-toy-known"),
          toyMcmc: () => writer.est(tl.mcmc, { hook: "read-toy-mcmc" }),
          toyIid: () => writer.est(tl.iid, { hook: "read-toy-iid" }),
          toyRhat: () => writer.est(tl.rhat, { hook: "read-toy-rhat" }),
          toyEss: () => writer.est(tl.ess, { hook: "read-toy-ess" }),
        };
        const which = state.toy === "loss"
          ? (state.mode === "chain" ? (same ? "toyChainSame" : "toyChain") : (same ? "toyIidSame" : "toyIid"))
          : (state.mode === "chain" ? (same ? "chainSame" : "chain") : (same ? "iidSame" : "iid"));
        writer.set(fill(T.readout[which], slots));
      }

      function writeCaption(state, d) {
        const total = d.S * d.tc.n;
        ctx.caption.replaceChildren(
          captionNode(ctx, "teaching-posterior"),
          " · ",
          captionNode(ctx, "monte-carlo", { S: total, seed: state.seed }),
          " (",
          writer.count(d.tc.n, { hook: "caption-chains" }),
          " chains × ",
          writer.count(d.S, { hook: "caption-draws" }),
          ").",
        );
      }

      // ------------------------------------------------------------------------------------------- stages & render

      let stagedKey = null;
      let toyDrawn = false;
      let pendingToyOpen = false;
      let lastData = null;

      return {
        render(state, info = {}) {
          // PR-06 / PR-09: toggling a disclosure never re-renders ctx.stage or re-fires ctx.readout.set;
          // opening Data re-measures and redraws its width-dependent SVGs at their real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open && lastData) {
              drawDistribution(state, lastData);
              drawCurve(state, lastData);
              drawToyLanes(state.toy);
              drawToyPooled();
            }
            return;
          }

          const S = state.draws;
          const chainsRun = state.chains;
          const c = Math.max(CONFIG.chain.min, Math.min(state.chain, chainsRun));
          if (c !== state.chain) {
            chainLimit = { from: state.chain, to: c, chains: chainsRun };
            ctx.set({ chain: c });
          } else if (chainLimit && (c !== chainLimit.to || chainsRun !== chainLimit.chains)) chainLimit = null;

          stay.set(state.stay);
          draws.set(state.draws);
          chains.set(state.chains);
          mode.set(state.mode);
          if (chainMax !== chainsRun) ctx.keepFocus(() => makeChainSlider(chainsRun, c));
          else chainSlider.set(c);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
          chainHint.replaceChildren(...fill(T.chainHint, { c: () => num(c, F.count(c)), C: () => num(chainsRun, F.count(chainsRun)) }),
            ...(chainLimit ? [" Chain ", num(chainLimit.from, F.count(chainLimit.from)),
              " is no longer in this run; showing the last available chain."] : []));
          modeHint.replaceChildren(...fill(T.modeHint, { stay: () => num(state.stay, F.setting(state.stay)) }));
          toySeg.set(state.toy);
          if (state.toy === "loss") {
            if (dataStack.firstElementChild !== toyBox) dataStack.prepend(toyBox);
          } else if (dataStack.lastElementChild !== toyBox) {
            dataStack.append(toyBox);
          }

          const changed = info.changed ?? [];
          const autoOpenedToy = !info.initial && changed.includes("toy") && !dataBox.open;
          if (autoOpenedToy) {
            dataBox.open = true;
            pendingToyOpen = true;
          }
          if (info.initial || changed.includes("toy") || info.reason === "resize" || info.reason === "theme" || !toyDrawn) {
            drawToyLanes(state.toy);
            if (!toyDrawn || autoOpenedToy || info.initial || info.reason === "resize" || info.reason === "theme") drawToyPooled();
            toyDrawn = true;
          }

          const p = switchOf(state.stay);
          const pIid = switchOf(HALF);
          const simKey = `${p}|${S}|${chainsRun}|${state.seed}`;
          const refKey = `${pIid}|${S}|${chainsRun}|${state.seed}`;
          const ready = simMemo.has(simKey) && simMemo.has(refKey);
          if (!ready && !info.initial && S * chainsRun > CONFIG.stageLimit) {
            const k = `${simKey}#${refKey}`;
            if (stagedKey !== k) {
              stagedKey = k;
              ctx.scheduleStages([
                () => {},
                () => {
                  stagedKey = null;
                  chainRun(p, S, chainsRun, state.seed);
                  chainRun(pIid, S, chainsRun, state.seed);
                  ctx.requestRender("staged");
                },
              ], { yieldMs: 0 });
            } else {
              ctx.root.setAttribute("aria-busy", "true");
            }
            return;
          }
          stagedKey = null;
          ctx.scheduleStages([]);

          const run = chainRun(p, S, chainsRun, state.seed);
          const ref = chainRun(pIid, S, chainsRun, state.seed);
          const lawChain = law(p, S);
          const lawIid = law(pIid, S);
          const r = envelopeRadius(CONFIG.pairs, S, CONFIG.alpha, "book", { K: CONFIG.criteria });
          const rp = envelopeRadius(CONFIG.pairs, S, CONFIG.alpha, "package");
          const tc = tally(run, r, rp);
          const ti = tally(ref, r, rp);
          const xc = exactOutside(p, S, r);
          const xi = exactOutside(pIid, S, r);
          const xp = exactOutside(p, S, rp);
          const trace = run.traces[c - 1];
          const stats = runningMemo(`${simKey}|${c}`, trace, S);
          const sds = sdGridMemo(`${p}|${S}`, p, S);
          const band = state.mode === "chain"
            ? stats.map((x, i) => ({ b: x.b, lo: Math.max(0, x.est - CONFIG.z * sds[i]), hi: Math.min(1, x.est + CONFIG.z * sds[i]) }))
            : stats.filter((x) => x.mcse !== null).map((x) => ({ b: x.b, lo: Math.max(0, x.est - CONFIG.z * x.mcse), hi: Math.min(1, x.est + CONFIG.z * x.mcse) }));
          const bandAt = new Map(band.map((x) => [x.b, x]));
          const runPoints = stats.map((x) => ({ b: x.b, est: x.est, lo: bandAt.get(x.b)?.lo, hi: bandAt.get(x.b)?.hi }));
          const whole = summaryStats(trace);
          const d = {
            S, c, p, trace, run: runPoints, band, pi: run.pi1, chainsRun: run, ref, lawChain, lawIid, r, rp, tc, ti, xc, xi, xp,
            est: run.means[c - 1], mcse: mcse(trace), stuck: whole.sd === 0,
          };
          lastData = d;
          drawTrace(state, d);
          drawDistribution(state, d);
          drawNumbers(state, d);
          drawCurve(state, d);
          if (pendingToyOpen) {
            if (!autoOpenedToy) {
              drawToyLanes(state.toy);
              drawToyPooled();
            }
            pendingToyOpen = false;
          }
          writeReadout(state, d);
          writeCaption(state, d);
        },
      };
    },
  });
}
