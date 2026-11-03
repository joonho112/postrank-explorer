// chain-draws (app 1.18): "Draws that remember". A new concept: the stationary two-state chain of the postrank theory
// book, ch. 15 ("Finite-sample coefficient error in a stationary two-state chain"), restated with π. Two units, one
// criterion, two equally likely joint states (A above B, A below B), so π_AB = Pr(θ_A > θ_B | Y) = 1/2. A Markov
// chain keeps the state of the draw before with the stay probability and switches otherwise (p01 = p10 = 1 − stay),
// started in its stationary law; the estimate of π after S draws is the share of the draws with A above B.
//
// Engine: twoStateChain({ p01, p10, S, chains, seed }) (the chains: chain c uses uniforms(seed, chains × S) from c·S
// on), chainMeanVariance({ p01, p10, S }) (the exact variance of the estimate, the iid variance, the equivalent number
// of independent draws, its long-run form S(1 − ρ)/(1 + ρ), the chance that a chain never switches), chainCountLaw
// ({ p01, p10, S, radius }: the exact chance that the estimate lands outside the iid error bound, shown beside the
// shares over the simulated chains), envelopeRadius (the iid error bound's radius: the theory book's form
// √(log(4MK/α)/(2S)) with M = K = 1 and α = .05, and postrank's √(log(2M/α)/(2S))), runningMean (the running
// estimate), mcse (the iid MCSE of a trace) and summaryStats (a chain's estimate; SD 0 = a constant trace). The
// independent reference is twoStateChain at stay .5 (p01 = p10 = 1/2: every draw is a fresh fair coin) with the same
// seed, chains and S. Counts over the chains (outside the bound, never switching, histogram bins) are counts over
// these simulated chains, and the app says so ("in these chains").
//
// postrank's own MCMC example, a panel under the views: the four chains of pr_toy_mcmc (512 draws each, released in
// data/released/toy-mcmc.json with vignette m6's postrank_diagnose() summary, postrank 1.1.0) as state strips with
// running means (runningMean) against the known value, for the pair (A not above B on criterion k1, chance .2) or the
// loss of the fixed report {A} > {B} > {C} (exact 4/15, key toy); the pooled estimates with ±2 MCMC MCSE against ±2 by
// the iid formula; R-hat and bulk ESS against postrank's guidelines, which flag problems and establish nothing.
//
// Words: "chains that stay .99" (live value) is the chain law; "chain 7" is only the chain shown in the trace. The
// interval π ± radius is "the iid error bound (radius .148)"; the gray band is π ± 2 SD.
//
// Views, all redrawn from one state { stay, draws, chains, chain, seed, mode }:
//   trace      the chain shown: each draw's state as a thin step line just outside [0, 1] (so a constant trace stays
//              visible beside an estimate of 0 or 1), the running estimate and a band of ±2 MCSE around it: pretend
//              iid, the iid MCSE of the draws so far (engine mcse of the prefix); chain-aware, the exact SD of the
//              estimate of that many draws (engine chainMeanVariance); π dashed. At most CONFIG.grid points. The
//              read-out sits under it.
//   histograms beside the trace (two columns from a 50rem container): the estimate after S draws of every chain
//              (vermillion) and, below, of every independent run (gray), on one x axis, each with its own count scale;
//              a gray band π ± 2 SD (iid formula; for the chains in chain-aware mode their exact SD), the iid error
//              bound π ± r as two solid lines, π dashed, ▼ at the chain shown; under them the chains and the seed
//   numbers    a table of independent draws against chains that stay .99 (correlation of successive draws, variance
//              and SD of the estimate, equivalent independent draws exact and long-run, chance of never switching,
//              runs that never switch, runs outside the bound in these runs) and three notes (postrank's radius in one
//              clause of the second)
//   variance   the exact variance of the estimate against S on log scales (the theory book's Fig. f15b restated):
//              chains that stay .99 and independent draws, with S marked
// Keys: stay (.5–.999, step .001), draws (S: 10, 20, 50, 100, 200, 500, 1000), chains (200, 500, 1000, 2000),
// chain (the chain shown: 1 to the chains run; a larger value is set back while drawing), seed, mode (iid | chain),
// toy (pair | loss: the trace of postrank's example).
// The preset row is moved to the top of the controls. A run of more than CONFIG.stageLimit draws in all that is not
// memoized is simulated in a second stage under aria-busy (never at mount); the update itself only marks the app busy.
//
// Exports: CONFIG, switchOf(stay), estimateBins(S, means), chainRun(p, S, chains, seed) (memoized simulation).
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  blocksText, decimalsNeeded, formatCount, formatDecimal, formatPercent, formatProb, formatRational, formatSetting, formatSig,
} from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { chainCountLaw, chainMeanVariance, envelopeRadius, mcse, runningMean, summaryStats, twoStateChain } from "../pr-core.js";
import TOY from "../../data/released/toy-mcmc.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "chain-draws",
  label: "Draws that remember: one two-state Markov chain, its draws and the running estimate of a pair probability, and the estimates of many chains against independent draws, with the iid band and the iid error bound",
  className: "prx-cd",
  stay: Object.freeze({ min: 0.5, max: 0.999, step: 0.001, value: 0.99 }),
  // the independent reference: at stay .5 every draw is a fresh fair coin, whatever the draw before
  independent: 0.5,
  draws: Object.freeze({ values: Object.freeze([10, 20, 50, 100, 200, 500, 1000]), value: 100 }),
  chains: Object.freeze({ values: Object.freeze([200, 500, 1000, 2000]), value: 2000 }),
  chain: Object.freeze({ min: 1, max: 2000, value: 1 }),
  seed: Object.freeze({ min: 1, max: 4294967295, value: 20261030 }),
  mode: Object.freeze({ values: Object.freeze(["iid", "chain"]), value: "iid" }),
  // postrank's example: the trace shown in its rows, the pair's 0/1 states or the fixed report's loss per draw
  toy: Object.freeze({ values: Object.freeze(["pair", "loss"]), value: "pair" }),
  // the iid error bound: failure chance α, M = 1 pair, K = 1 criterion (the theory book's example)
  alpha: 0.05,
  pairs: 1,
  criteria: 1,
  // a chance of never switching below this prints as "below .001" and sets no useful lower bound
  rareBelow: 0.001,
  // postrank's guidelines for MCMC output (vignette m6): R-hat above 1.01 and ESS below 100 per chain are flagged
  guide: Object.freeze({ rhat: 1.01, essPerChain: 100 }),
  // bands are ±z SD; under independent draws about this share of estimates lands inside π ± 2 SD
  z: 2,
  inside: 0.95,
  // the running estimate and its band: every draw up to this many, else this many points (draw 1 included)
  grid: 250,
  // chains × S above this, when not memoized, is simulated in a second stage (aria-busy)
  stageLimit: 250000,
  memo: 6,
  // about this many histogram bins over [0, 1]: an odd number m of neighboring estimates k/S per bin, centered on 1/2
  bins: 40,
  // the variance curve: log-spaced S from 1 to 1000 (and every S of the control); decade ticks only, so neighboring
  // labels never touch in a narrow column
  curve: Object.freeze({
    from: 1, to: 1000, points: 49,
    xTicks: Object.freeze([1, 10, 100, 1000]),
    yDomain: Object.freeze([1e-4, 0.5]),
    yTicks: Object.freeze([1e-3, 1e-2, 1e-1]),
  }),
  chart: Object.freeze({
    traceHeight: 230, histHeight: 140, curveHeight: 210,
    marginTop: 14, marginBottom: 40, marginLeft: 58, marginRight: 22, histTop: 20, curveTop: 26, curveRight: 28,
    xTicks: 6, yTicks: 4, stateWidth: 1, estWidth: 2, piWidth: 1.6, piDash: "6,4", radiusWidth: 1.6,
    bandOpacity: 0.18, histBandOpacity: 0.16, barRim: 0.5, marker: 4.5, markerDy: -9,
    curveWidth: 2, iidDash: "5,3", dot: 4,
    // the trace's y axis runs past 0 and 1; each draw's state is drawn this far outside [0, 1], so a constant trace
    // stays visible beside a running estimate of 0 or 1
    tracePad: 0.07,
    stateOffset: 0.035,
    // postrank's example: one row per chain (the running value from 0 to the row's top, a strip of state-1 draws above
    // it), in row units of laneUnit px; the keyboard reads every kbdStep-th draw; the pooled figure in units of rowPx
    toy: Object.freeze({
      laneUnit: 44, stripLo: 1.08, stripHi: 1.28, gap: 0.34, marginTop: 8, marginBottom: 38, marginLeft: 40, marginRight: 46,
      lineWidth: 1.6, knownWidth: 1.4, kbdStep: 32, topStep: 0.1, xTicks: Object.freeze([1, 128, 256, 384, 512]),
      rowPx: 25, pooledTop: 10, pooledBottom: 36, pooledLeft: 86, pooledRight: 14, pooledTicks: 4, capHalf: 0.22, dot: 4, barWidth: 2,
    }),
  }),
  digits: Object.freeze({ radius: 3, share: 3, shareSe: 3, rhat: 4, ess: 2 }),
  text: Object.freeze({
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
    // trace
    traceHead: "Chain {c}: its {S} draws and the running estimate",
    traceX: "Draw",
    traceY: "Share of draws with A above B",
    traceAlt: "Trace of one chain: each draw's state as a thin step line just above the top (A above B) or just below the bottom (A below B), the running estimate as a line with a band of two standard errors either side (by the error formula chosen), and a dashed line at the exact chance one half.",
    traceKbd: "Running estimate: one point per draw shown",
    traceKbdItem: "Draw {b}: running estimate {est}; band {lo} to {hi}.",
    traceKbdNoBand: "Draw {b}: running estimate {est}; no iid MCSE from one draw.",
    keyState: "each draw's state (up: A above B; down: A below B)",
    keyEst: "running estimate",
    keyBand: Object.freeze({
      iid: "band: ±{two} MCSE (Monte Carlo standard error), the iid estimate of the estimate's SD from the draws so far",
      chain: "band: ±{two} SD of the estimate, from the stay chance",
    }),
    keyPi: "{pi} = {half}, the exact chance",
    chainLine: "After {S} draws chain {c} estimates {est}; the iid MCSE of its draws is {mcse}",
    chainMiss: ", so its pretend-iid band, {lo} to {hi}, misses {pi} = {half}",
    stuckLine: "It never switches, so the pretend-iid band has no width, yet {pi} = {half}: a constant trace is not a probability of {zero} or {one}.",
    // histograms
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
    // numbers
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
    eqNote: "Both equivalent counts come from the stay chance, not from an effective sample size (ESS) estimated from a chain; they describe numerical precision but cannot be put in place of S in the iid error bound. Dependent draws need a bound of their own.",
    curveHead: "Exact variance of the estimate by the number of draws",
    curveX: "Draws per chain, S",
    curveY: "Variance of the estimate",
    curveAlt: "Exact variance of the estimate against the number of draws, both on log scales: one line for the chains that stay and a dashed line for independent draws, with dots at the S chosen.",
    curveKbd: "Variance by the number of draws: one point per S of the control",
    curveKbdItem: "S = {S}: variance {v} for the chains that stay, {vi} for independent draws.",
    keyCurveChain: "chains that stay {stay}",
    keyCurveIid: "independent draws",
    keyCurveDot: "dots: S = {S}",
    // read-out (two forms each: the second when the chains' SD and variance print as the independent ones)
    readout: Object.freeze({
      iid: "Treated as independent, the {S} draws give the estimate an SD of {sdIid} (its real SD is {sd}), and the iid error bound says it lands more than {r} from {pi} in at most {alpha} of runs. In these {C} chains it does in {share} ({count} chains), against an exact chance of {exact}.",
      iidSame: "The {S} draws are independent here, so the estimate's SD is {sdIid}, and the iid error bound says it lands more than {r} from {pi} in at most {alpha} of runs. In these {C} chains it does in {share} ({count} chains), against an exact chance of {exact}.",
      chain: "From the stay chance, the estimate's SD after {S} draws is {sd} (variance {variance}), against {sdIid} ({iidVariance}) for independent draws. That is the variance of {eq} independent draws (exact for these {S} draws; the long-run formula, {asym}, holds only for long chains).",
      chainSame: "From the stay chance, the estimate's SD after {S} draws is {sd} (variance {variance}), the same as for independent draws. That is the variance of {eq} independent draws.",
    }),
    // postrank's own MCMC example (released data: pr_toy_mcmc and vignette m6's postrank_diagnose() summary)
    toyHead: "postrank's own MCMC example: {C} chains of {S} draws (pr_toy_mcmc)",
    toyAbout: "A two-state chain: in one state A is above B on criterion k1, in the other it is not. The chain leaves the first state with chance {p01} and the second with chance {p10} per draw, so in the long run {pi} of its draws have A not above B. The fixed report {report} (weights {w1} and {w2} on the two criteria) loses {l0} in a draw with A above B and {l1} in one without: an exact expected loss of {loss}.",
    toyTrace: "Trace in the rows",
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
    toyNotice: "From postrank 1.1.0: pr_toy_mcmc and vignette m6's postrank_diagnose() call (R-hat, ESS and the MCMC MCSE from the posterior package). ",
    model: "Two units, one criterion, two equally likely states, after the postrank theory book, chapter 15; ",
    simulated: ". Every chain's first draw is A above B or A below B with chance one half each. ",
    runs: ": {C} chains of {S}; the independent runs use the same seed.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const HALF = CONFIG.independent;

// ---------------------------------------------------------------------------------------------- formats

const F = Object.freeze({
  setting: (v) => formatSetting(v),
  count: (v) => formatCount(v),
  prob: (v) => formatProb(v),
  share: (v) => formatProb(v, { digits: CONFIG.digits.share }),
  shareSe: (v) => formatDecimal(v, { digits: CONFIG.digits.shareSe }),
  variance: (v) => formatSig(v, { sig: 4 }),
  sd: (v) => formatSig(v, { sig: 3 }),
  eq: (v) => formatSig(v, { sig: 3 }),
  radius: (v) => formatDecimal(v, { digits: CONFIG.digits.radius }),
  est: (v) => formatProb(v),
  mcse: (v) => formatSig(v, { sig: 3 }),
  half: (v) => formatRational(v),
  percent: (v) => formatPercent(v),
  // postrank's example: its fixed facts as written (.012, .2, .6), R-hat and ESS as vignette m6 prints them
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

/** pr_toy_mcmc (released): each chain's 0/1 states, the fixed report's loss per draw, and the runs of state-1 draws. */
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
/** The fixed report as blocks, its ids in the report's unit order. */
const TOY_REPORT = blocksText(Object.values(TOYF.fixed_report.grade), Object.keys(TOYF.fixed_report.grade));

/** A row top for the running values: the smallest multiple of the step at or above the largest of them. */
const rowTop = (v) => Math.min(1, Math.ceil(v / CONFIG.chart.toy.topStep - 1e-9) * CONFIG.chart.toy.topStep);

/** The rows of one trace: running means (engine runningMean), each chain's mean, the known value and the row top. */
const toyTrace = memo(2, (mode) => {
  const traces = mode === "loss" ? TOY_LOSS : TOY_STATES;
  const running = traces.map((t) => runningMean(t));
  const means = traces.map((t) => summaryStats(t).mean);
  const known = mode === "loss" ? TOYF.known.fixed_report_loss : TOYF.known.pair_probability;
  const top = rowTop(Math.max(known, ...running.map((r) => Math.max(...r))));
  return { running, means, known, top };
});

/** The pooled estimates with their MCMC MCSE (postrank_diagnose(), released) and the iid formula (engine mcse). */
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

/** The variance of the estimate against S (exact): log-spaced S and every S of the control. */
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

/** Counts over the chains: outside the book's and postrank's radius, never switching; shares and the MCSE of the first. */
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

/** A nice top for a count axis (1, 2, 2.5 or 5 × 10^k) at least x. */
function niceTop(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const m = [1, 2, 2.5, 5, 10].find((v) => v * p >= x);
  return m * p;
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `
.prx-cd .prx-controls { row-gap: 0.4rem; }
.prx-cd .prx-cd-row { display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 0.4rem 1.4rem; align-items: flex-start; min-width: 0; }
.prx-cd .prx-cd-row > .prx-slider { flex: 1 1 15rem; max-width: 24rem; }
.prx-cd .prx-cd-chain { flex: 1 1 14rem; max-width: 22rem; min-width: 0; }
.prx-cd .prx-cd-chain > .prx-slider { max-width: none; }
.prx-cd .prx-cd-chain .prx-hint, .prx-cd .prx-cd-seed .prx-hint, .prx-cd .prx-cd-mode .prx-hint { margin: 0.15rem 0 0; }
/* segmented controls (the preset row included) carry their label on the line of their buttons */
.prx-cd .prx-segmented { flex-direction: row; flex-wrap: wrap; align-items: center; column-gap: 0.6rem; }
.prx-cd .prx-segmented > .prx-seg-label { margin: 0; }
.prx-cd .prx-segmented > .prx-hint { flex: 1 1 100%; }
.prx-cd .prx-controls > .prx-presets { flex: 1 1 100%; }
.prx-cd .prx-cd-mode { flex: 1 1 18rem; max-width: 34rem; }
.prx-cd .prx-cd-sym sub { font-size: 0.75em; }
.prx-cd .prx-cd-charts { container-type: inline-size; }
.prx-cd .prx-cd-views { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.5rem; align-items: start; }
/* two columns: the trace (with the read-out) beside the histograms; the table under the trace, the variance panel
   under the histograms, each starting where the panel above it ends */
@container (min-width: 50rem) {
  .prx-cd .prx-cd-views { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto auto 1fr auto;
    grid-template-areas: "trace dist" "numbers dist" "numbers curve" "toy toy"; }
  .prx-cd .prx-cd-trace { grid-area: trace; }
  .prx-cd .prx-cd-dist { grid-area: dist; }
  .prx-cd .prx-cd-numbers { grid-area: numbers; }
  .prx-cd .prx-cd-curve { grid-area: curve; }
  .prx-cd .prx-cd-toy { grid-area: toy; }
}
.prx-cd .prx-cd-trace, .prx-cd .prx-cd-dist, .prx-cd .prx-cd-numbers, .prx-cd .prx-cd-curve, .prx-cd .prx-cd-toy { min-width: 0; max-width: 100%; }
/* postrank's example: a panel of its own under the views */
.prx-cd .prx-cd-toy { margin-top: 0.3rem; padding-top: 0.8rem; border-top: 1px solid var(--prx-border); }
.prx-cd .prx-cd-toy-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.8rem 1.5rem; align-items: start; margin-top: 0.5rem; }
.prx-cd .prx-cd-toy-col { min-width: 0; }
@container (min-width: 50rem) {
  .prx-cd .prx-cd-toy-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-cd .prx-cd-toy-wide { grid-column: 1 / -1; }
}
.prx-cd .prx-cd-toy-seg { margin: 0 0 0.35rem; }
.prx-cd .prx-cd-notice { margin: 0.35rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); overflow-wrap: anywhere; }
.prx-cd .prx-cd-sw-strip { width: 1.4rem; height: 0.45rem; background: var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-iidline { width: 1.4rem; height: 0; border-top: 2px solid var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-mcmc { width: 1.6rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-mcmc::after { content: ""; position: absolute; left: 50%; top: -5px; width: 8px; height: 8px; margin-left: -4px;
  background: var(--prx-est); border-radius: 50%; }
.prx-cd .prx-cd-trace .prx-readout { margin-top: 0.6rem; }
.prx-cd .prx-cd-heading { margin: 0 0 0.25rem; font-size: 0.95em; font-weight: 600; line-height: 1.3; color: var(--prx-fg-heading); }
.prx-cd .prx-cd-sub { margin: 0.45rem 0 0.15rem; font-size: 0.875em; font-weight: 600; line-height: 1.3; color: var(--prx-fg); }
.prx-cd .prx-cd-note { margin: 0.35rem 0 0; font-size: 0.875em; color: var(--prx-fg-muted); }
.prx-cd .prx-cd-line { margin: 0.4rem 0 0; font-size: 0.9em; color: var(--prx-fg); }
.prx-cd .prx-cd-runs { display: flex; flex-wrap: wrap; gap: 0.4rem 1.4rem; align-items: flex-start; margin: 0.6rem 0 0; font-size: 0.875rem; }
.prx-cd .prx-cd-seed { flex: 0 1 auto; display: flex; flex-wrap: wrap; align-items: center; column-gap: 0.5rem; }
.prx-cd .prx-cd-seed > label { margin: 0; }
.prx-cd .prx-cd-seed input[type="number"] { width: 8rem; max-width: 100%; }
.prx-cd .prx-cd-seed .prx-hint { flex: 1 1 100%; }
.prx-cd .prx-cd-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.35rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.85em;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border-radius: var(--prx-radius); }
.prx-cd .prx-cd-key-item { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
.prx-cd .prx-cd-sw { flex: none; display: inline-block; box-sizing: border-box; position: relative; }
.prx-cd .prx-cd-sw-state { width: 1.4rem; height: 0.6rem; border-top: 1px solid var(--prx-plot-fg); border-right: 1px solid var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-est { width: 1.4rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-band { width: 0.95rem; height: 0.95rem; border: 1px solid var(--prx-est); }
.prx-cd .prx-cd-sw-band::before { content: ""; position: absolute; inset: 0; background: var(--prx-est); opacity: 0.22; }
.prx-cd .prx-cd-sw-pi { width: 1.4rem; height: 0; border-top: 2px dashed var(--prx-post); }
.prx-cd .prx-cd-sw-bar { width: 0.8rem; height: 0.8rem; border: 1px solid var(--prx-cell-border); }
.prx-cd .prx-cd-sw-chainbar { background: var(--prx-est); }
.prx-cd .prx-cd-sw-iidbar { background: var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-gray { width: 0.95rem; height: 0.95rem; border: 1px solid var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-gray::before { content: ""; position: absolute; inset: 0; background: var(--prx-plot-muted); opacity: 0.2; }
.prx-cd .prx-cd-sw-radius { width: 0.6rem; height: 0.95rem; border-left: 1.6px solid var(--prx-plot-fg); border-right: 1.6px solid var(--prx-plot-fg); }
.prx-cd .prx-cd-sw-pivert { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px dashed var(--prx-post); }
.prx-cd .prx-cd-sw-marker { width: 0; height: 0; margin: 0 0.15rem; border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; }
.prx-cd .prx-cd-sw-curve { width: 1.4rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-cd .prx-cd-sw-curveiid { width: 1.4rem; height: 0; border-top: 2px dashed var(--prx-plot-muted); }
.prx-cd .prx-cd-sw-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--prx-plot-fg); }
.prx-cd .prx-cd-table-wrap { max-width: 100%; margin: 0.25rem 0 0; overflow-x: auto; }
.prx-cd .prx-cd-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.875em; font-variant-numeric: tabular-nums; }
.prx-cd .prx-cd-table caption { caption-side: top; padding: 0 0 0.3rem; text-align: left; color: var(--prx-fg); font-weight: 600; }
.prx-cd .prx-cd-table th, .prx-cd .prx-cd-table td { padding: 0.2rem 0.4rem; text-align: right; vertical-align: top;
  border-bottom: 1px solid var(--prx-border); overflow-wrap: normal; word-break: normal; }
.prx-cd .prx-cd-table thead th { font-weight: 600; vertical-align: bottom; white-space: normal; }
.prx-cd .prx-cd-table thead .prx-cd-colstay { display: block; font-weight: 400; color: var(--prx-fg-muted); white-space: nowrap; }
.prx-cd .prx-cd-table tbody th { font-weight: 400; text-align: left; min-width: 6.5rem; }
.prx-cd .prx-cd-table td { white-space: nowrap; }
/* in a narrow column a value cell may break between a count (or SD) and its share (or variance) */
.prx-cd .prx-cd-numbers { container-type: inline-size; }
@container (max-width: 24rem) {
  .prx-cd .prx-cd-table td { white-space: normal; }
}
.prx-cd .prx-cd-table tr.prx-cd-indent th { padding-left: 1.1rem; }
.prx-cd[aria-busy="true"] .prx-cd-views { opacity: 0.55; }
`;

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
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
      const tag = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => tag(ctx.num(raw, display), name);
      const sym = () => h("span", { class: "prx-cd-sym" }, "π", h("sub", {}, "AB"));
      const halfNode = (name) => num(HALF, F.half(HALF), name);
      const two = () => num(CONFIG.z, F.count(CONFIG.z));
      const zero = () => num(0, F.count(0));
      const one = () => num(1, F.count(1));
      const inside = () => num(CONFIG.inside, F.percent(CONFIG.inside));
      const swatch = (cls) => h("span", { class: `prx-cd-sw ${cls}`, "aria-hidden": "true" });
      const item = (cls, ...content) => h("span", { class: "prx-cd-key-item" }, swatch(cls), h("span", {}, ...content));

      // --- controls at the top: the chain (stay, S), then the error formula and the chain shown; the preset row is
      // moved before them at the first render. The chains and the seed sit under the histograms.
      const stay = ctx.slider({
        label: T.stay, ...ctx.key("stay"), name: "stay", format: (v) => F.setting(v),
        hint: fill(T.stayHint, { independent: () => num(HALF, F.setting(HALF)) }),
        onInput: (v) => ctx.set({ stay: v }),
      });
      const draws = ctx.segmented({
        label: T.draws, name: "draws", value: ctx.state.draws,
        options: CONFIG.draws.values.map((v) => ({ value: v, label: F.count(v) })),
        onChange: (v) => ctx.set({ draws: v }),
      });
      const mode = ctx.segmented({
        label: T.mode, name: "mode", value: ctx.state.mode, className: "prx-cd-mode",
        options: CONFIG.mode.values.map((v) => ({ value: v, label: T.modeWords[v] })),
        onChange: (v) => ctx.set({ mode: v }),
      });
      const modeHint = h("p", { id: uid("prx-cd-mode-hint"), class: "prx-hint" });
      mode.root.append(modeHint);
      for (const b of mode.buttons) b.setAttribute("aria-describedby", modeHint.id);
      // the chain shown: a slider over 1 … chains, made again when the number of chains changes
      const chainSlot = h("div", { class: "prx-cd-chain" });
      const chainHint = h("p", { class: "prx-hint", id: uid("prx-cd-chain-hint") });
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
      ctx.controls.append(
        h("div", { class: "prx-cd-row" }, stay.root, draws.root),
        h("div", { class: "prx-cd-row" }, mode.root, chainSlot),
      );
      // the chains and the seed (under the histograms; the counts on the buttons are numbers, so they carry data-num)
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
      const runsRow = h("div", { class: "prx-cd-runs" }, chains.root, seed.root);

      // --- the trace of the chain shown, with the read-out under it
      const traceTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const traceSlot = h("div", { class: "prx-cd-trace-chart" });
      const traceKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const chainLine = h("p", { class: "prx-cd-line", "data-prx-part": "readout", "data-prx-note": "chain" });
      const traceBox = h("section", { class: "prx-cd-trace", "aria-label": T.traceY },
        traceTitle, traceSlot, traceKey, chainLine, ctx.readout.node);

      // --- the estimates of every chain and every independent run, beside the trace
      const distTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const chainSub = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-cd-sub" }));
      const chainSlotHist = h("div", { class: "prx-cd-hist-chart prx-cd-chain-hist" });
      const iidSub = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-cd-sub" }));
      const iidSlotHist = h("div", { class: "prx-cd-hist-chart prx-cd-iid-hist" });
      const distKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const distNote = h("p", { class: "prx-cd-line", "data-prx-part": "readout" });
      const distBox = h("section", { class: "prx-cd-dist", "aria-label": T.distX },
        distTitle, chainSub, chainSlotHist, iidSub, iidSlotHist, distKey, distNote, runsRow);

      // --- the numbers: the table and its notes; then the variance curve
      const numbersTitle = ctx.panelTitle("", { className: "prx-cd-heading" });
      const tableSlot = h("div", { class: "prx-cd-table-slot", "data-prx-part": "table" });
      const failNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes", "data-prx-note": "fail" });
      const radiusNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes" });
      const eqNote = h("p", { class: "prx-cd-note", "data-prx-part": "notes", "data-prx-note": "equivalent", text: T.eqNote });
      const numbersBox = h("section", { class: "prx-cd-numbers", "aria-label": T.tableLabel },
        numbersTitle, tableSlot, failNote, radiusNote, eqNote);
      const curveTitle = ctx.panelTitle(T.curveHead, { className: "prx-cd-heading" });
      const curveSlot = h("div", { class: "prx-cd-curve-chart" });
      const curveKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const curveBox = h("section", { class: "prx-cd-curve", "aria-label": T.curveHead }, curveTitle, curveSlot, curveKey);

      // --- postrank's own MCMC example (released data): its chains, pooled estimates and diagnostics, under the views
      const toySeg = ctx.segmented({
        label: T.toyTrace, name: "toy", value: ctx.state.toy, className: "prx-cd-toy-seg",
        options: CONFIG.toy.values.map((v) => ({ value: v, label: T.toyWords[v] })),
        onChange: (v) => ctx.set({ toy: v }),
      });
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
      const toyLanes = h("div", { class: "prx-cd-toy-chart" });
      const toyLanesKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const toyPooled = h("div", { class: "prx-cd-toy-chart" });
      const toyPooledKey = h("div", { class: "prx-cd-key prx-light-panel", "data-prx-part": "legend" });
      const toyTableSlot = h("div", { class: "prx-cd-table-slot", "data-prx-part": "table" });
      const toyReading = h("p", { class: "prx-cd-line", "data-prx-part": "readout", "data-prx-note": "toy-reading" });
      const toyBox = h("section", { class: "prx-cd-toy", "aria-label": words(T.toyHead, { C: TOYF.chains, S: TOYF.draws_per_chain }) },
        toyTitle, toyAbout,
        h("div", { class: "prx-cd-toy-grid" },
          h("div", { class: "prx-cd-toy-col prx-cd-toy-wide" }, toySeg.root, toyLanes, toyLanesKey),
          h("div", { class: "prx-cd-toy-col" }, toyPooled, toyPooledKey),
          h("div", { class: "prx-cd-toy-col" }, toyTableSlot, toyReading)));
      ctx.charts.classList.add("prx-cd-charts");
      ctx.charts.append(h("div", { class: "prx-cd-views" }, traceBox, distBox, numbersBox, curveBox, toyBox));
      // the example's data notice (author scope, from the released file), after the caption with the app's own notes;
      // outside the figure parts, so the package and licence versions are words, not shown numbers
      ctx.root.append(h("p", { class: "prx-cd-notice", "data-prx-note": "toy-notice" }, `${T.toyNotice}${TOY.notice}`));

      // ------------------------------------------------------------------------------------------- drawing

      function drawTrace(state, d) {
        const { S, trace, run, band } = d;
        // each draw's state just outside [0, 1]: above the top for A above B, below the bottom for A below B
        const at = (x) => (x ? 1 + C.stateOffset : -C.stateOffset);
        const steps = [];
        for (let b = 1; b <= S; b += 1) steps.push({ x: b - 0.5, y: at(trace[b - 1]) });
        steps.push({ x: S + 0.5, y: at(trace[S - 1]) });
        traceTitle.replaceChildren(...fill(T.traceHead, { c: () => num(d.c, F.count(d.c), "trace-chain"), S: () => num(S, F.count(S)) }));
        plot(traceSlot, {
          alt: T.traceAlt,
          height: C.traceHeight,
          marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [0.5, S + 0.5], label: T.traceX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.xTicks },
          y: { domain: [-C.tracePad, 1 + C.tracePad], label: T.traceY, labelAnchor: "center", labelArrow: "none", grid: true, ticks: [0, 0.25, 0.5, 0.75, 1] },
          marks: (c, P) => [
            P.areaY(band, { x: "b", y1: "lo", y2: "hi", fill: c.est, fillOpacity: C.bandOpacity }),
            P.ruleY([d.pi], { stroke: c.post, strokeWidth: C.piWidth, strokeDasharray: C.piDash }),
            P.line(run, { x: "b", y: "est", stroke: c.est, strokeWidth: C.estWidth }),
            // the states last, in the thin foreground ink (gray belongs to the independent reference)
            P.line(steps, { x: "x", y: "y", curve: "step-after", stroke: c.plotFg, strokeWidth: C.stateWidth }),
          ],
          keyboard: {
            data: run, x: "b", y: "est", key: (p) => `b${p.b}`, label: T.traceKbd,
            title: (p) => (p.lo === undefined
              ? words(T.traceKbdNoBand, { b: F.count(p.b), est: F.est(p.est) })
              : words(T.traceKbdItem, { b: F.count(p.b), est: F.est(p.est), lo: F.est(p.lo), hi: F.est(p.hi) })),
          },
        });
        traceKey.replaceChildren(
          item("prx-cd-sw-state", T.keyState),
          item("prx-cd-sw-est", T.keyEst),
          item("prx-cd-sw-band", ...fill(T.keyBand[state.mode], { two })),
          item("prx-cd-sw-pi", ...fill(T.keyPi, { pi: sym, half: () => halfNode() })),
        );
        const line = fill(T.chainLine, {
          S: () => num(S, F.count(S)), c: () => num(d.c, F.count(d.c)),
          est: () => num(d.est, F.est(d.est), "chain-est"), mcse: () => num(d.mcse, F.mcse(d.mcse), "chain-mcse"),
        });
        // the pretend-iid band after the last draw: the estimate ± 2 iid MCSE of the chain's own draws, cut at 0 and 1
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
        const sdVar = (v, name) => [num(Math.sqrt(v), F.sd(Math.sqrt(v)), `tbl-sd-${name}`), " (", num(v, F.variance(v), `tbl-var-${name}`), ")"];
        const table = h("table", { class: "prx-cd-table" },
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
        // a run that never switches misses π by a half: a lower bound on the failure chance, unless it is too rare to
        // matter; at stay .50 the draws are independent
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
            // the dashed line over the solid one, so both show where they coincide (stay .5)
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

      // --- postrank's example: the four chains as rows (state strips and running values against the known value)
      function drawToyLanes(mode) {
        const G = C.toy;
        const X = toyTrace(mode, mode);
        const n = TOY_STATES.length;
        const S = TOYF.draws_per_chain;
        const pitch = G.stripHi + G.gap;
        // chain 1 in the top row; a running value v sits at base + v/top, the strip of state-1 draws above the row
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
        const known = fmtKnown(mode, X.known);
        plot(toyLanes, {
          alt: T.toyLanesAlt[mode],
          table: {
            caption: T.toyLanesTable[mode],
            columns: [
              { label: T.tChain, value: "chain", format: F.count },
              { label: T.tOnes, value: "ones", format: F.count },
              { label: T.tToyMean[mode], value: "mean", format: F.prob },
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
            title: (p) => words(T.toyKbd[mode], { c: F.count(p.chain), b: F.count(p.b), m: F.prob(p.m), known }),
          },
        });
        toyLanesKey.replaceChildren(
          item("prx-cd-sw-strip", T.toyKeyStrip),
          item("prx-cd-sw-est", ...fill(T.toyKeyRun[mode], { zero, top: () => num(X.top, F.fact(X.top)) })),
          item("prx-cd-sw-pi", ...fill(T.toyKeyKnown[mode], { known: () => num(X.known, known) })),
          h("span", { class: "prx-cd-key-item" }, T.toyKeyMean),
        );
      }

      // --- postrank's example: the pooled estimates with ±2 MCMC MCSE and ±2 SDs by the iid formula, the diagnostics
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
        const inside = (r) => r.known >= r.lo && r.known <= r.hi;
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
              known: fmtKnown(r.g, r.known), where: inside(r) ? T.toyInside : T.toyOutside,
            }),
          },
        });
        toyPooledKey.replaceChildren(
          item("prx-cd-sw-mcmc", ...fill(T.toyKeyMcmc, { two })),
          item("prx-cd-sw-iidline", ...fill(T.toyKeyIid, { two })),
          item("prx-cd-sw-pivert", T.toyKeyKnownPooled),
        );
        // postrank_diagnose()'s numbers for both traces, the guidelines in the row labels
        const P2 = TOY_POOLED;
        const N = TOYF.draws;
        const essGuide = CONFIG.guide.essPerChain * TOYF.chains;
        const cell = (...content) => h("td", {}, ...content);
        const row = (label, a, b, note) => h("tr", note ? { "data-prx-note": note } : {}, h("th", { scope: "row" }, ...label), cell(...a), cell(...b));
        const sig = (v, name) => num(v, F.mcse(v), name);
        const table = h("table", { class: "prx-cd-table" },
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
        // "the same as for independent draws" when the chains' SD and variance print as the independent ones
        const same = F.sd(sd) === F.sd(sdIid) && F.variance(lawChain.variance) === F.variance(lawChain.iidVariance);
        const slots = {
          S: () => num(S, F.count(S), "read-draws"), C: () => num(C2, F.count(C2), "read-chains"), pi: sym,
          r: () => num(r, F.radius(r), "read-radius"), alpha: () => num(CONFIG.alpha, F.setting(CONFIG.alpha), "read-alpha"),
          share: () => num(tc.share, F.share(tc.share), "read-share"), count: () => num(tc.outside, F.count(tc.outside), "read-count"),
          exact: () => num(xc, F.share(xc), "read-exact"),
          sd: () => num(sd, F.sd(sd), "read-sd"), sdIid: () => num(sdIid, F.sd(sdIid), "read-sd-iid"),
          variance: () => num(lawChain.variance, F.variance(lawChain.variance), "read-variance"),
          iidVariance: () => num(lawChain.iidVariance, F.variance(lawChain.iidVariance), "read-iid-variance"),
          eq: () => num(lawChain.equivalentDraws, F.eq(lawChain.equivalentDraws), "read-eq"),
          asym: () => num(lawChain.asymptoticEquivalent, F.eq(lawChain.asymptoticEquivalent), "read-asym"),
        };
        const which = state.mode === "chain" ? (same ? "chainSame" : "chain") : (same ? "iidSame" : "iid");
        ctx.readout.set(fill(T.readout[which], slots));
      }

      function writeCaption(state, d) {
        const total = d.S * d.tc.n;
        ctx.caption.replaceChildren(
          T.model, captionNode(ctx, "teaching-posterior"), T.simulated,
          captionNode(ctx, "monte-carlo", { S: total, seed: state.seed }),
          ...fill(T.runs, { C: () => num(d.tc.n, F.count(d.tc.n), "caption-chains"), S: () => num(d.S, F.count(d.S), "caption-draws") }),
        );
      }

      // ------------------------------------------------------------------------------------------- stages

      let cancelStage = null;
      let stagedKey = null;
      let toyDrawn = false;
      const stopStage = () => { cancelStage?.(); cancelStage = null; stagedKey = null; };

      return {
        render(state, info = {}) {
          // the preset row first (base.js adds it after the app's controls)
          if (ctx.presets && ctx.controls.firstElementChild !== ctx.presets) ctx.controls.prepend(ctx.presets);
          const S = state.draws;
          const chainsRun = state.chains;
          // the chain shown is never beyond the chains run: a larger value is set back to the last chain
          const c = Math.max(CONFIG.chain.min, Math.min(state.chain, chainsRun));
          if (c !== state.chain) ctx.set({ chain: c });
          stay.set(state.stay);
          draws.set(state.draws);
          chains.set(state.chains);
          mode.set(state.mode);
          if (chainMax !== chainsRun) ctx.keepFocus(() => makeChainSlider(chainsRun, c));
          else chainSlider.set(c);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
          chainHint.replaceChildren(...fill(T.chainHint, { c: () => num(c, F.count(c)), C: () => num(chainsRun, F.count(chainsRun)) }));
          modeHint.replaceChildren(...fill(T.modeHint, { stay: () => num(state.stay, F.setting(state.stay)) }));
          toySeg.set(state.toy);
          // postrank's example depends on its own key only: drawn at mount, when its trace changes, and on resize or theme
          const changed = info.changed ?? [];
          if (info.initial || changed.includes("toy") || info.reason === "resize" || info.reason === "theme" || !toyDrawn) {
            drawToyLanes(state.toy);
            if (!toyDrawn || info.initial || info.reason === "resize" || info.reason === "theme") drawToyPooled();
            toyDrawn = true;
          }

          const p = switchOf(state.stay);
          const pIid = switchOf(HALF);
          const simKey = `${p}|${S}|${chainsRun}|${state.seed}`;
          const refKey = `${pIid}|${S}|${chainsRun}|${state.seed}`;
          const ready = simMemo.has(simKey) && simMemo.has(refKey);
          if (!ready && !info.initial && S * chainsRun > CONFIG.stageLimit) {
            // a large run that is not memoized: simulate it in a second stage, under aria-busy
            ctx.root.setAttribute("aria-busy", "true");
            const k = `${simKey}#${refKey}`;
            if (stagedKey !== k) {
              stopStage();
              stagedKey = k;
              cancelStage = ctx.timeout(() => {
                cancelStage = null;
                stagedKey = null;
                chainRun(p, S, chainsRun, state.seed);
                chainRun(pIid, S, chainsRun, state.seed);
                ctx.requestRender("staged");
              }, 0);
            }
            return;
          }
          stopStage();

          const run = chainRun(p, S, chainsRun, state.seed);
          const ref = chainRun(pIid, S, chainsRun, state.seed);
          const lawChain = law(p, S);
          const lawIid = law(pIid, S);
          const r = envelopeRadius(CONFIG.pairs, S, CONFIG.alpha, "book", { K: CONFIG.criteria });
          const rp = envelopeRadius(CONFIG.pairs, S, CONFIG.alpha, "package");
          const tc = tally(run, r, rp);
          const ti = tally(ref, r, rp);
          // the exact chances beside the shares over these chains: the book's bound for the chains and for independent
          // draws, postrank's for the chains
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
          drawTrace(state, d);
          drawDistribution(state, d);
          drawNumbers(state, d);
          drawCurve(state, d);
          writeReadout(state, d);
          writeCaption(state, d);
          ctx.root.removeAttribute("aria-busy");
        },
      };
    },
  });
}
