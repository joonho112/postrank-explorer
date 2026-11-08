// mc-error (app 1.17): "Probabilities from draws carry noise". A new concept after v1's storyboard P-09 (Monte Carlo
// error in the inputs), the postrank vignette m6 (pairwise MCSE, Monte Carlo fragility, the conditional IID bound) and
// the postrank theory book, ch. 15 (the coefficient envelope for independent whole-state draws). The six fictional
// sites of the postrank tutorial have exact error probabilities (their normal law, set by hand). What if they had to be
// estimated from S posterior draws? The draws are simulated in this browser (engine gaussianDraws, seeded), and each
// probability is a share of the draws.
//
// Views, all drawn from one state { S, seed, criteria, tau, pair, cap }:
//   this run  the 15 pairs, ordered by exact error (leastCertainPairs): the error of each pair's more likely direction
//             estimated from the draws, with its ±2 MCSE bar (fragilePairs with every pair traced: postrank's weighted
//             error and MCSE), its exact value (hollow diamond), a pale envelope band around the estimate (envelopeRadius,
//             postrank's form; weightedRadius over the scores), τ, and the pairs postrank_mc_fragility() flags,
//             outlined; the pair followed is marked and is chosen by click, by the select box or by the arrow keys
//   over S    the pair followed for S from 100 to 4,000: its exact value (flat), the exact value ± 2 MCSE with the exact e
//             (the exact-e approximation) and the envelope band as narrowing bands, τ, the current S and this run's
//             estimate (closed forms; no extra runs)
//   runs      100 runs of S draws, consecutive seeds wrapping from the supported maximum to minimum (run 1 is the
//             run shown): a histogram of the estimate of the
//             pair followed with its exact value, a pale ±2 MCSE band and τ, and a histogram of the largest error of any
//             pair in each run (maxCoefficientError) against postrank's radius and the theory book's form
//   reports   the report chosen from the estimates (exactOptimum on the estimated array, "for the estimated
//             probabilities") beside the one chosen from the exact values, in the family the cap key names (at most 3
//             grades, or all reports); beside them a table of counts over the 100 runs and a computed line on what
//             holds the pair followed in one grade (the cap, read from the same runs with any number of grades, or the
//             pair's own error)
//   ledger    what the MCSE and the envelope radius each cover, the radius formula with its numbers, and the notes
// Layout (review 044 repair, X-01; U3-F2's order): base.js's result-first frame, so the read-out sits directly under
// the controls and the preset row; "this run" (ctx.primaryGraphic), with the followed pair's estimate written next to
// its dot, and the 100 runs beside it; then the reports with the counts over the runs, which hold what the presets are
// about (the report from the estimates against the exact one); then the panel over S, then the ledger.
// The runs are computed in slices under aria-busy when they are not cached; while they are drawn the previous runs stay
// on screen, dimmed. Records are kept by score, S and seed, so Redraw (the next seed) reuses 99 of them, and τ, the pair
// and the cap only read them again (the reports of the runs are memoized by run, τ and cap).
// Ties over the runs, always said in words: a run whose estimate of the pair followed equals τ (pairDecision, equal-risk
// tolerance 1e−12) is a tie of stating and withholding, counted on its own and not as a flip; each run keeps all its
// tied optima (exactOptimum's grades), and a run keeps the exact report when the exact report is among them.
// Engine calls: the exact-e approximation √(e(1 − e)/S) is binomialMcse; the largest error of a run is
// maxCoefficientError (max |ê − e| over the ordered pairs, per score); each run's MCSE of every pair comes from
// fragilePairs on its draws (every pair traced; the MCSE does not depend on τ), so the runs flagged fragile at any τ
// are read from the stored weighted errors and MCSEs with fragilePairs' own rule |min(ē_ij, ē_ji) − τ| < 2 MCSE.
// Keys: S (100–4,000), seed, criteria (A, B, or AB: both scores with equal weights), tau (.02–.50), pair ("A,B" …),
// cap (3: at most 3 grades, or none: all reports).
//
// Exports: CONFIG, seedsOf(firstSeed) (the 100 distinct seeds, wrapping over CONFIG.seed.min..max),
// runRecord(criteria, S, seed) (one run: estimated array, weighted errors, largest errors, and each
// pair's weighted error and MCSE), envelopeFor(criteria, S) (radii by score, the weighted radius and the theory book's
// form).
import { appLink, createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatDecimal, formatProb, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  binomialMcse, disclosure, drawErrors, envelopeRadius, errorArray, exactOptimum, fragilePairs, gaussianDraws,
  leastCertainPairs, maxCoefficientError, pairCount, pairDecision, relationChange, summaryStats, weightedError, weightedRadius,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "mc-error",
  className: "prx-mce",
  label: "Probabilities from draws carry noise: the error probabilities of six fictional sites estimated from S posterior draws, against their exact values",
  S: Object.freeze({ min: 100, max: 4000, step: 100, value: 1000 }),
  seed: Object.freeze({ min: 1, max: 4294967295, value: 1 }),
  criteria: Object.freeze({ values: Object.freeze(["A", "B", "AB"]), value: "A" }),
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  pairDefault: "A,B",
  // the report family: at most 3 grades (603 reports on six units) or all reports (4,683)
  cap: Object.freeze({ values: Object.freeze([3, "none"]), value: 3 }),
  // the weights of each score choice: one score alone, or both with equal weights
  weights: Object.freeze({ A: Object.freeze([1]), B: Object.freeze([1]), AB: Object.freeze([0.5, 0.5]) }),
  criteriaOf: Object.freeze({ A: Object.freeze(["score_A"]), B: Object.freeze(["score_B"]), AB: Object.freeze(["score_A", "score_B"]) }),
  // 100 runs of S draws; consecutive seeds wrap from max to min, so run 1 is the run shown
  runs: 100,
  // postrank's MCSE multiplier for fragility, the failure chance of the envelope (split equally between the scores),
  // and the equal-risk tolerance named with ties
  z: 2,
  alpha: 0.05,
  tieTol: 1e-12,
  // the panel over S: S from 100 to 4,000 in steps of 100; the keyboard reads these values and the current S
  overS: Object.freeze({ from: 100, to: 4000, by: 100, read: Object.freeze([100, 200, 400, 1000, 2000, 4000]) }),
  // the exact-e approximation is written only for an exact error at least this large (below it, it reads as 0)
  seFrom: 0.001,
  // missing work at or below this many draw units (runs × S × scores, plus the reports below) is done at once; more is
  // done in slices of sliceMs
  syncBudget: 4000,
  // a report chosen from a run's estimates costs about this many draws: 603 reports with at most 3 grades, 4,683 in all
  optUnits: Object.freeze({ 3: 30, none: 400 }),
  sliceMs: 20,
  memo: Object.freeze({ main: 4, exact: 64, cache: 1500, opt: 6000, overS: 48 }),
  // an MCSE below this is written in scientific form, so a small positive value never reads as zero
  sciBelow: 5e-5,
  digits: Object.freeze({ se: 4, radius: 4, ratio: 1, bin: 4 }),
  chart: Object.freeze({
    row: 19, marginTop: 26, marginBottom: 38, marginLeft: 56, marginRight: 54, xTicks: 5, font: 11.5,
    dot: 4.5, diamond: 4.5, diamondWidth: 1.5, whisker: 2, capInset: 5, bandInset: 4, bandOpacity: 0.6, outline: 1.5,
    tauWidth: 1.25, tauDash: "5,3", labelGap: 8, tagGap: 6, tauLabelDy: -14, tauLabelGap: 3, narrow: 480,
    // the followed pair's estimate beside its dot (review 044 repair): this far past its bar and diamond, and about
    // this share of the font size per character when deciding whether it fits on the right; a halo keeps it legible.
    // With no room on the right it sits above the dot (the line's bottom anchored estAbove px above the dot's center),
    // or below it (the line's top anchored estBelow px below the center) when the τ label or the row above is in the way
    estGap: 4, estChar: 0.62, estHalo: 3, estAbove: 6.5, estBelow: 7.5,
    overS: Object.freeze({ height: 170, marginTop: 18, marginBottom: 38, marginLeft: 48, marginRight: 40, xTicks: 5, yTicks: 4,
      bandOpacity: 0.22, exactWidth: 1.75, shownWidth: 1.5, shownDash: "1.5,2.5", dot: 4, pad: 0.04, labelDy: -6 }),
    hist: Object.freeze({
      height: 150, marginTop: 20, marginBottom: 40, marginLeft: 44, marginRight: 16, xTicks: 5, yTicks: 4, target: 14,
      exactWidth: 1.75, bandOpacity: 0.22, tauWidth: 1.25, tauDash: "5,3", marker: 4.5, markerDy: -9, rim: 0.5,
      envWidth: 1.75, bookDash: "2,3", reach: 1, labelDy: 10, labelGap: 3, halo: 3, constantShare: 60, padShare: 0.06,
      nice: Object.freeze([0.0001, 0.0002, 0.00025, 0.0005, 0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2]),
      eps: 1e-9, decimals: 8,
    }),
  }),
  text: Object.freeze({
    // controls
    score: "Score",
    scoreWords: Object.freeze({ A: "Score A", B: "Score B", AB: "Both, equal weights" }),
    scoreNames: Object.freeze({ A: "score A", B: "score B", AB: "scores A and B with equal weights" }),
    S: "Draws S",
    SHint: "Each estimate is a share of the S draws.",
    tau: "Withholding cost τ",
    seed: "Seed",
    seedHint: "Same seed, same draws.",
    redraw: "Redraw",
    redrawTitle: "Draw again with the next seed",
    pair: "Pair followed",
    cap: "Grades",
    capWords: Object.freeze({ 3: "at most 3", none: "any number" }),
    // this run
    runHead: "This run: {S} draws, seed {seed}",
    xLabel: "Chance that the more likely direction is wrong",
    xLabelShort: "Posterior probability of a wrong direction",
    xLabelAB: "Weighted probability of a wrong direction",
    xLabelABShort: "Weighted probability of a wrong direction",
    keyEst: "estimate from the draws, with its ±{z} MCSE bar (Monte Carlo standard errors)",
    keyExact: "exact value",
    keyBand: "envelope band ±{r}: with chance at least {p}, every diamond lies in its band",
    keyTau: "τ {tau}",
    keyFragile: "fragile: τ lies within {z} MCSE of the estimate",
    fragileTag: "fragile",
    tauMark: "τ",
    selectedMark: "▸ ",
    runAlt: "Dot plot of the 15 pairs, one row each, ordered by exact error: the error estimated from the draws with its ±2 MCSE bar, the exact error as a hollow diamond, a pale envelope band around each estimate, a dashed line at τ and an outline around each fragile pair.",
    runTable: "This run: the error of each pair's more likely direction, ordered by exact error",
    runTableFragile: " ({n} of {M} pairs fragile)",
    runTableNone: " (no pair fragile of {M})",
    tPair: "Pair",
    tExact: "Exact",
    tEst: "Estimated",
    tMcse: "MCSE",
    tFragile: "Fragile",
    tRel: "In the report from the estimates",
    yes: "yes",
    no: "no",
    kbdLabel: "The 15 pairs. Use the arrow keys to read each pair; the pair read is followed in the runs.",
    kbdRow: "{name}: estimated {est} (MCSE {m}) against the exact {exact}; {frag}; in the report from the estimates, {rel}.",
    kbdFragile: "fragile, τ {tau} lies within 2 MCSE of the estimate",
    kbdNot: "not fragile",
    flip: " The draws favor {x} above {y}, the exact law {u} above {v}.",
    rel: Object.freeze({ above: "{i} above {j}", below: "{j} above {i}", withheld: "withheld" }),
    // over S
    overHead: "{name} as S grows: the exact value stays, the bands narrow",
    overX: "Draws S",
    overY: "Error of {i} above {j}",
    overYAB: "Weighted error of {i} above {j}",
    keyOverExact: "exact value {e}, the same at every S",
    keyOverSe: "exact value ± {z} MCSE, with the exact e (the exact-e approximation)",
    keyOverBand: "envelope band",
    keyOverNow: "this run's estimate, at S {S}",
    overNoteAB: "With both scores the {z} MCSE band is not drawn: the exact-e approximation is written for one score.",
    overAlt: "Bands over the number of draws S for the pair followed: the exact value as a flat line, the exact value plus and minus 2 MCSE with the exact e, the envelope band, a dashed line at τ, and a dot at the current S for this run's estimate.",
    overTable: "The pair followed over S",
    tS: "S",
    tSe2: "Two MCSE (exact e)",
    tRadius: "Envelope radius",
    kbdOver: "S {S}: exact {e}{se}; envelope radius {r}.",
    kbdOverSe: "; with the exact e, {z} MCSE ≈ {x}",
    kbdOverLabel: "The pair followed over S: one point per number of draws",
    // reports
    repHead: "The report chosen from the estimates beside the one chosen from the exact values",
    fromEst: "From the estimates (this run)",
    fromExact: "From the exact values",
    forEst: ", for the estimated probabilities",
    forExact: ", for the exact probabilities",
    states: "States {N} of {M} pairs.",
    statesTied: "States {N} of {M} pairs ({others} for the tied {reports}).",
    tiedReport: "report",
    tiedReports: "reports",
    and: " and ",
    ties: "{n} reports share the smallest risk (equal-risk tolerance {tol}); the card shows the first.",
    tiesDiffer: "{n} reports share the smallest risk (equal-risk tolerance {tol}); the card shows the first, and ",
    same: "The two reports are the same.",
    sameTied: "The report from the estimates is one of the exact optima.",
    sameTiedEst: "The exact report is one of the optima for the estimates.",
    differ: "They treat {n} {pairs} differently: {list}.",
    pairWord: "pair",
    pairsWord: "pairs",
    changeItem: "{name}, {from} from the exact values and {to} from the estimates",
    grade1: "The block on the left is grade 1, stated highest on {target} as each card's probabilities judge it; a shared grade means not compared, not equal.",
    targets: Object.freeze({ A: "score A", B: "score B", AB: "the two scores weighted equally" }),
    joint: "Grades are chosen jointly, so a fragile pair need not change them: the check is descriptive and looks at one pair at a time.",
    tallyCaption: "Over the {R} runs (seeds {from} to {to}{wrap})",
    tallyLabel: "Counts over the runs",
    tallyWithin: "{name}'s estimate within {z} MCSE (of the run shown) of its exact value",
    tallyFragile: "{name} flagged fragile",
    tallyChoice: "{name}'s own choice as with its exact value ({choice})",
    tallyTie: "{name}'s estimate equal to τ, a tie of stating and withholding",
    tallyReport: "The report from the estimates as the exact one",
    tallyReportTied: "The report from the estimates as one of the exact optima",
    tallyReportAmong: "The exact report among the optima for the estimates",
    tallyReportAmongTied: "An exact optimum among the optima for the estimates",
    tallyEnvelope: "Every pair within its envelope band",
    tallyOf: "{k} of {R}",
    tallyNone: "no spread",
    familyWords: Object.freeze({ 3: "With at most {G} grades", none: "With any number of grades" }),
    family: "{Family}, {i} and {j} share a grade in the report from the estimates in {k} of the {R} runs, and the report changed in {c} of the {f} runs where {name}'s own choice flips.",
    familyNoFlip: "{Family}, {i} and {j} share a grade in the report from the estimates in {k} of the {R} runs; {name}'s own choice never flips.",
    // what holds the pair in one grade: the same flipped runs with any number of grades, and the exact law
    familyCap: " The cap holds them together: with any number of grades the best report states {x} above {y}.",
    familyCapRuns: " The cap holds them together: with any number of grades the report changes in {cAll} of the {f} runs where the choice flips.",
    familyCapBoth: " The cap holds them together: with any number of grades the report changes in {cAll} of the {f} runs where the choice flips, and the exact best report states {x} above {y}.",
    // ties over the runs, said with the tolerance
    pairTies: "In {t} more runs {name}'s estimate equals τ (equal-risk tolerance {tol}), a tie of stating and withholding; the report changed in {ct} of them.",
    pairTiesOnly: "In {t} runs {name}'s estimate equals τ (equal-risk tolerance {tol}), a tie of stating and withholding; the report changed in {ct} of them.",
    reportTies: "In {u} runs {n} reports share the smallest risk for the estimates{tolPart}; a run keeps the exact report when it is among them.",
    reportTiesTol: " (equal-risk tolerance {tol})",
    tiedCount: "{lo} to {hi}",
    alone: "For an isolated pair, disclose only when the posterior probability of the direction exceeds {one} − τ (that is, when its error is below τ).",
    aloneAB: "For an isolated pair, disclose only when the posterior probability of the direction exceeds {one} − τ (with both scores, when its weighted error is below τ).",
    aloneWords: Object.freeze({ stated: "stated, {i} above {j}", reversed: "stated, {j} above {i}", withheld: "withheld", tie: "a tie of stating and withholding" }),
    // runs
    runsHead: "{R} runs of {S} draws, seeds {from} to {to}{wrap}",
    seedWrap: ", wrapping from {max} to {min}",
    runsLabel: "Repeated runs of S draws",
    busy: "Drawing the {R} runs of {S} draws…",
    hist1Head: "{name}: the estimated chance that {i} above {j} is wrong, one estimate per run",
    hist1HeadAB: "{name}: the estimated weighted error of {i} above {j}, one estimate per run",
    hist1X: "Estimated chance that {i} above {j} is wrong",
    hist1XAB: "Estimated weighted error of {i} above {j}",
    keyRuns: "runs",
    keyExactLine: "exact value {e}",
    keyBand2: "exact value ± {z} MCSE of the run shown",
    keyTauLine: "τ {tau}",
    keyShown: "the run shown",
    spread: "Spread of the {R} estimates (their SD): {sd}; the MCSE from the run shown is {m}.",
    constantZero: "All {R} runs estimate {v}: every draw puts {i} above {j}.",
    constantZeroAB: "All {R} runs estimate {v}: every draw puts {i} above {j} on both scores.",
    constantOne: "All {R} runs estimate {v}: every draw puts {j} above {i}.",
    constantOther: "All {R} runs give the same estimate, {v}.",
    constantCaution: "Agreement across runs is not proof that the probability equals their estimate.",
    offScale: "τ {tau} lies off this scale, to the {side}.",
    sides: Object.freeze({ left: "left", right: "right" }),
    hist1Alt: "Histogram of the runs: each run's estimate of the pair followed, in bins, over a pale band 2 MCSE either side of the exact value, with a solid line at the exact value, a dashed line at τ and a triangle above the run shown.",
    hist1Table: "Runs by the estimate of the pair followed",
    hist2Head: "The largest error of any pair, same runs",
    hist2X: "Largest gap between an estimated and an exact probability",
    hist2XShort: "Largest gap, estimate against exact value",
    keyMax: "runs",
    keyEnv: "envelope radius {r}",
    keyBook: "the theory book's form {b}",
    hist2Alt: "Histogram of the runs: the largest gap between an estimated and an exact probability in each run, in bins, with a solid line at the envelope radius and a dotted line at the theory book's form.",
    hist2Table: "Runs by their largest error",
    tFrom: "From",
    tTo: "To",
    tRuns: "Runs",
    kbdBin: "{n} of {R} runs from {lo} to {hi}.",
    kbdHist1: "Estimates: one point per bin of runs",
    kbdHist2: "Largest errors: one point per bin of runs",
    // ledger
    ledCaption: "What each number covers",
    ledLabel: "What the MCSE and the envelope radius each cover",
    ledMcse: "MCSE, one pair",
    ledEnv: "Envelope radius, all pairs",
    ledHere: "This run",
    ledHereMcse: "{name}: {m}",
    ledHereEnv: "{r} at failure chance {a}",
    ledHereEnvAB: "{r} (weighted), at failure chance {a} for each score",
    ledWhat: "Describes",
    ledWhatMcse: "the typical Monte Carlo error of one estimated probability",
    ledWhatEnv: "a bound on the error of every estimated probability at once",
    ledHolds: "Holds",
    ledHoldsMcse: "with no stated chance: a scale, not a guarantee",
    ledHoldsEnv: "with chance at least {p} over runs of S independent draws, with S and the failure chance fixed before sampling",
    ledChosen: "A report chosen from the same draws",
    ledChosenMcse: "not covered after a search over reports",
    ledChosenEnv: "covered: the envelope holds for all pairs at once, whichever report is chosen from them",
    ledDouble: "Doubling S",
    ledDoubleText: "divides the radius by √{two} and the MCSE by about √{two}",
    formulaLead: "postrank's radius, for a law with no ties:",
    formulaNote: "with M = {M} pairs and failure chance α = {a}.",
    formulaNoteAB: "for each score, with M = {M} pairs and failure chance α = {a} for each, the {total} split between the two scores. With equal weights the weighted radius is {dw}.",
    book: "The theory book's form also allows equal true values and counts both directions, {four}M in place of {two}M: {b}.",
    bookAB: "The theory book's form for both scores at once, {four}MK in place of {two}M with K = {K}, at failure chance {a} for both: {b}.",
    pairExact: "{name}: its exact value lies {gap} from τ.",
    pairExactSe: " With the exact error e in place of the estimate, √(e({one} − e)/S) = {x} (the exact-e approximation), so {z} MCSE ≈ {x2}.",
    rule: "postrank's rule: |min(ē{ij}, ē{ji}) − τ| < {z} × MCSE, where ē{ij} is the estimated chance that stating i above j is wrong (with both scores, its weighted average).",
    sameE: "Neither number measures how uncertain the direction itself is: that is the exact error, {e} for {name} at every S.",
    mcmc: "These draws are independent. With MCMC draws an effective sample size cannot replace S in the envelope, and postrank's fragility check needs whole-state draws.",
    others: "An error budget q (in {budgets}) and an optimizer's gap η (in {regret}) are separate guarantees; neither is shown here.",
    // read-out
    readout: "{name}, this run of {S} draws: estimated {est}{flip} (MCSE {m}), exact {exact} at every S. {frag}",
    readFlip: " for {x} above {y}",
    readFragile: "τ {tau} lies within {z} MCSE of the estimate: fragile.",
    readNot: "τ {tau} lies {ratio} MCSE from the estimate: not fragile.",
    readConstant: "Every draw agrees on this pair, so its MCSE is {zero} and it is not fragile.",
    // caption
    caption1: "Six fictional sites from the postrank tutorial, {score}; their normal law is ",
    caption2: ". We estimate the pairwise error probabilities from simulated posterior draws (",
    caption3: "); the {R} runs use seeds {from} to {to}{wrap}.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const H = C.hist;
const O = C.overS;

/** Advance a supported seed without ever emitting 0 or clamping distinct reruns to the maximum. */
const seedAt = (first, offset) => CONFIG.seed.min + (first - CONFIG.seed.min + offset) % (CONFIG.seed.max - CONFIG.seed.min + 1);

/** The state's 100 run seeds, in run order. The first run is the one shown; max is followed by min. */
export const seedsOf = (first) => Array.from({ length: CONFIG.runs }, (_, r) => seedAt(first, r));

// --------------------------------------------------------------------------------------------- data

const UNITS = SIX.tables.units;
const IDS = Object.freeze(UNITS.id.slice());
const N_UNITS = IDS.length;
const M = pairCount(N_UNITS);
const FAMILIES = Object.freeze({ 3: Object.freeze({ kind: "atMost", G: 3 }), none: Object.freeze({ kind: "all" }) });
const familyOf = (cap) => FAMILIES[cap] ?? FAMILIES[CONFIG.cap.value];

/** The six sites' normal law for a score choice: means and SDs, n × K. */
const LAW = Object.freeze(Object.fromEntries(CONFIG.criteria.values.map((c) => {
  const cols = CONFIG.criteriaOf[c].map((k) => (k === "score_A" ? ["mean_A", "sd_A"] : ["mean_B", "sd_B"]));
  return [c, Object.freeze({
    criteria: CONFIG.criteriaOf[c].slice(),
    w: CONFIG.weights[c].slice(),
    means: UNITS.id.map((_, i) => cols.map(([m]) => UNITS[m][i])),
    sds: UNITS.id.map((_, i) => cols.map(([, s]) => UNITS[s][i])),
  })];
})));

/** The 15 unordered pairs i < j: key "A,B", name "A–B". */
const PAIRS = Object.freeze((() => {
  const out = [];
  for (let i = 0; i < N_UNITS; i += 1) for (let j = i + 1; j < N_UNITS; j += 1) out.push(Object.freeze({ key: `${IDS[i]},${IDS[j]}`, name: `${IDS[i]}–${IDS[j]}`, i, j }));
  return out;
})());
const PAIR_BY_KEY = new Map(PAIRS.map((p) => [p.key, p]));
const pairKey = (i, j) => (i < j ? `${IDS[i]},${IDS[j]}` : `${IDS[j]},${IDS[i]}`);

/** A first-in first-out memo of `size` entries. */
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

/** The exact law's arrays for a score choice: E, the weighted errors and the pairs by exact error (largest first). */
const exactMemo = memo(CONFIG.criteria.values.length, (c) => {
  const L = LAW[c];
  const E = errorArray(L.means, L.sds, { ids: IDS, criteria: L.criteria });
  return { E, wE: weightedError(E, L.w), least: leastCertainPairs(E, { k: M, w: L.w }) };
});
const exactFor = (c) => exactMemo(c, c);

/** The exact optimum for a score choice, τ and family. */
const exactOptMemo = memo(CONFIG.memo.exact, (c, tau, cap) => exactOptimum(exactFor(c).E, { tau, w: LAW[c].w, family: familyOf(cap) }));
const exactOpt = (c, tau, cap) => exactOptMemo(`${c}|${tau}|${cap}`, c, tau, cap);

/**
 * One run of S draws at a seed: { eHat (estimated array), wHat (weighted errors), eps (largest error per score), pairs
 * (by pair key: d, the weighted error of the more likely direction, and its MCSE, from fragilePairs) }.
 */
const runCache = memo(CONFIG.memo.cache, (c, S, seed) => recordOf(c, S, seed, gaussianDraws(LAW[c].means, LAW[c].sds, S, seed)));
const recKey = (c, S, seed) => `${c}|${S}|${seed}`;

function recordOf(c, S, seed, draws) {
  const L = LAW[c];
  const eHat = drawErrors(draws, { ids: IDS, criteria: L.criteria });
  // the largest error of the run, per score (max |ê − e| over the ordered pairs); neither τ nor the family enters it
  const eps = maxCoefficientError(eHat, exactFor(c).E).epsilon;
  // every pair traced (postrank_mc_fragility()): its weighted error and its MCSE, neither of which depends on τ
  const fr = fragilePairs(draws, { tau: CONFIG.tau.value, w: L.w, z: CONFIG.z, screenMargin: Infinity, ids: IDS });
  const pairs = Object.freeze(Object.fromEntries(fr.pairs.map((p) => [pairKey(p.i, p.j), Object.freeze({ d: p.weightedError, mcse: p.mcse })])));
  return Object.freeze({ c, S, seed, eHat, wHat: weightedError(eHat, L.w), eps: Object.freeze(Array.from(eps)), pairs });
}

/** One run's record (memoized): the estimated array, its weighted errors, its largest errors by score and its pairs. */
export function runRecord(c, S, seed) {
  return runCache(recKey(c, S, seed), c, S, seed);
}

/** fragilePairs' flag for a stored pair at τ: |d − τ| < z·MCSE (the same expression, so the same flag at every τ). */
const flaggedAt = (p, tau) => p.mcse !== null && Math.abs(p.d - tau) < CONFIG.z * p.mcse;

/**
 * The reports chosen from one run's estimates at τ in the family of cap: every tied optimum (exactOptimum's grades,
 * lexicographic, the first the one shown), memoized by run, τ and cap.
 */
const optMemo = memo(CONFIG.memo.opt, (rec, tau, cap) => {
  const o = exactOptimum(rec.eHat, { tau, w: LAW[rec.c].w, family: familyOf(cap) });
  return Object.freeze((o.grades ?? [o.grade]).slice());
});
const optKey = (rec, tau, cap) => `${recKey(rec.c, rec.S, rec.seed)}|${tau}|${cap}`;
const runOpt = (rec, tau, cap) => optMemo(optKey(rec, tau, cap), rec, tau, cap);

/** The run shown: its draws (kept for the fragility check at any τ) and its record. */
const mainMemo = memo(CONFIG.memo.main, (c, S, seed) => {
  const draws = gaussianDraws(LAW[c].means, LAW[c].sds, S, seed);
  const key = recKey(c, S, seed);
  if (!runCache.has(key)) runCache.set(key, recordOf(c, S, seed, draws));
  return { draws, rec: runCache(key) };
});

/**
 * The envelope for a score choice and S: postrank's radius for each score at failure chance α/K (the allocation split
 * equally), the weighted radius over the scores, and the theory book's form over all K scores at once at α.
 */
export function envelopeFor(c, S) {
  const L = LAW[c];
  const K = L.w.length;
  const alphaK = CONFIG.alpha / K;
  const eps = L.criteria.map(() => envelopeRadius(M, S, alphaK, "package"));
  return { K, alphaK, eps, deltaW: weightedRadius(eps, L.w), book: envelopeRadius(M, S, CONFIG.alpha, "book", { K }) };
}

/** The exact-e approximation √(e(1 − e)/S) (engine binomialMcse); null when e is 0 or 1, where there is no band. */
const exactSe = (e, S) => (e > 0 && e < 1 ? binomialMcse(e, S) : null);

/** The pair followed over S (closed forms): [{ S, r (envelope radius, weighted), se (exact-e approximation or null) }]. */
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

/** The relation a grade vector gives a pair i < j: "above" (i above j), "below" or "withheld". */
const relationOf = (g, i, j) => (g[i] < g[j] ? "above" : g[i] > g[j] ? "below" : "withheld");

// --------------------------------------------------------------------------------------------- formats

const fmtP = (x) => formatProb(x);
const fmtSe = (x) => (x === 0 ? formatDecimal(0, { digits: 0 }) : x < CONFIG.sciBelow ? formatSci(x) : formatDecimal(x, { digits: CONFIG.digits.se }));
const fmtR = (x) => formatDecimal(x, { digits: CONFIG.digits.radius });
const fmtRatio = (x) => formatDecimal(x, { digits: CONFIG.digits.ratio });
const fmtBin = (x) => formatDecimal(x, { digits: CONFIG.digits.bin });
const fmtCount = (x) => formatCount(x);
const fmtSet = (x) => formatSetting(x);

/** A template with {name} slots: an array of strings and nodes (a slot value may be a function that makes the node). */
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

/** The same with plain strings (aria text, keyboard titles). */
const words = (template, slots = {}) => template.replace(/\{(\w+)\}/g, (_, k) => String(slots[k]));

// --------------------------------------------------------------------------------------------- histograms

const roundBin = (x) => Number(x.toFixed(H.decimals));

/** The smallest nice width at least x that is a whole number of grid steps (the estimates lie on a grid of 1/S). */
function niceWidth(x, grid) {
  const ok = (v) => !grid || (v >= grid - H.eps && Math.abs(v / grid - Math.round(v / grid)) < 1e-6);
  return H.nice.find((v) => v >= x && ok(v)) ?? H.nice.filter(ok).at(-1) ?? H.nice.at(-1);
}

/** Bins of `values` on edges at multiples of the width: { lo, hi, width, bins: [{ i, lo, hi, n }] (n > 0) }. */
function binsOf(values, { width, lo: lo0, hi: hi0 }) {
  const lo = roundBin(Math.floor(lo0 / width + H.eps) * width);
  let hi = roundBin(Math.ceil(hi0 / width - H.eps) * width);
  if (!(hi > lo)) hi = roundBin(lo + width);
  const count = Math.round((hi - lo) / width);
  const n = new Array(count).fill(0);
  for (const v of values) n[Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width + H.eps)))] += 1;
  return { lo, hi, width, bins: n.map((k, i) => ({ i, lo: roundBin(lo + i * width), hi: roundBin(lo + (i + 1) * width), n: k })).filter((b) => b.n > 0) };
}

// --------------------------------------------------------------------------------------------- CSS

const CSS = `
.prx-mce .prx-mce-row { display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 0.5rem 1.4rem; align-items: flex-start; min-width: 0; }
.prx-mce .prx-mce-row > .prx-slider { max-width: 21rem; }
.prx-mce .prx-mce-seed { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.3rem 0.6rem; min-width: 0; max-width: 28rem; }
.prx-mce .prx-mce-seed input[type="number"] { width: 8.5rem; max-width: 100%; }
.prx-mce .prx-mce-seed .prx-hint { flex: 0 1 auto; align-self: flex-end; margin: 0 0 0.45rem; }
.prx-mce .prx-mce-charts { container-type: inline-size; }
.prx-mce .prx-mce-views { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.1rem 1.6rem; align-items: start; }
.prx-mce .prx-mce-col { display: flex; flex-direction: column; gap: 1.1rem; min-width: 0; }
.prx-mce .prx-mce-col > section, .prx-mce .prx-mce-views > section { min-width: 0; max-width: 100%; }
.prx-mce .prx-mce-rep-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem 1.4rem; align-items: start; margin: 0.3rem 0 0; }
.prx-mce .prx-mce-rep-cards, .prx-mce .prx-mce-tally-box { min-width: 0; }
.prx-mce .prx-mce-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: 0.6rem 1rem; align-items: start; }
.prx-mce .prx-mce-ledger-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.4rem 1.6rem; align-items: start; }
@container (min-width: 56rem) {
  .prx-mce .prx-mce-views { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-mce .prx-mce-wide { grid-column: 1 / -1; }
  .prx-mce .prx-mce-rep-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1.25fr); }
  .prx-mce .prx-mce-ledger-grid { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
}
.prx-mce .prx-mce-heading { margin: 0 0 0.25rem; font-size: 0.95em; font-weight: 600; line-height: 1.3; color: var(--prx-fg-heading); }
.prx-mce .prx-mce-sub { margin: 0.7rem 0 0.2rem; font-size: 0.9em; font-weight: 600; line-height: 1.3; color: var(--prx-fg); }
.prx-mce .prx-mce-note { margin: 0.3rem 0 0; font-size: 0.875em; line-height: 1.4; color: var(--prx-fg-muted); }
.prx-mce .prx-mce-text { margin: 0.35rem 0 0; font-size: 0.9em; line-height: 1.4; color: var(--prx-fg); }
.prx-mce .prx-mce-chart { min-width: 0; max-width: 100%; }
.prx-mce .prx-mce-run-chart svg { cursor: pointer; }
.prx-mce .prx-mce-stale { opacity: 0.4; }
.prx-mce .prx-mce-key { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.35rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.85em;
  color: var(--prx-plot-fg); background: var(--prx-plot-bg); border-radius: var(--prx-radius); }
.prx-mce .prx-mce-key-item { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
.prx-mce .prx-mce-sw { flex: none; display: inline-block; box-sizing: border-box; }
.prx-mce .prx-mce-sw-est { position: relative; width: 1.6rem; height: 0; border-top: 2px solid var(--prx-est); }
.prx-mce .prx-mce-sw-est::after { content: ""; position: absolute; left: 50%; top: -5.5px; width: 9px; height: 9px; margin-left: -4.5px;
  background: var(--prx-est); border-radius: 50%; }
.prx-mce .prx-mce-sw-diamond { width: 8px; height: 8px; margin: 0 2px; background: transparent; border: 1.5px solid var(--prx-plot-fg); transform: rotate(45deg); }
.prx-mce .prx-mce-sw-band { width: 1.4rem; height: 0.8rem; background: var(--prx-plot-grid); opacity: 0.75; }
.prx-mce .prx-mce-sw-tau { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 1.5px dashed var(--prx-plot-fg); }
.prx-mce .prx-mce-sw-fragile { width: 1.4rem; height: 0.85rem; border: 1.5px solid var(--prx-plot-fg); }
.prx-mce .prx-mce-sw-bar { width: 0.8rem; height: 0.8rem; border: 1px solid var(--prx-plot-bg); }
.prx-mce .prx-mce-sw-bar-est { background: var(--prx-est); }
.prx-mce .prx-mce-sw-bar-max { background: var(--prx-plot-muted); }
.prx-mce .prx-mce-sw-exact { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px solid var(--prx-plot-fg); }
.prx-mce .prx-mce-sw-flat { width: 1.4rem; height: 0; border-top: 2px solid var(--prx-plot-fg); }
.prx-mce .prx-mce-sw-seband { position: relative; width: 1.4rem; height: 0.8rem; overflow: hidden; }
.prx-mce .prx-mce-sw-seband::before { content: ""; position: absolute; inset: 0; background: var(--prx-est); opacity: 0.22; }
.prx-mce .prx-mce-sw-dot { width: 9px; height: 9px; margin: 0 2px; background: var(--prx-est); border-radius: 50%; }
.prx-mce .prx-mce-sw-marker { width: 0; height: 0; margin: 0 0.15rem; border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; }
.prx-mce .prx-mce-sw-env { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px solid var(--prx-plot-fg); }
.prx-mce .prx-mce-sw-book { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px dotted var(--prx-plot-fg); }
.prx-mce .prx-mce-card { min-width: 0; padding: 0.45rem 0.65rem 0.5rem; background: var(--prx-bg); border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-mce .prx-mce-card > p { margin: 0.15rem 0 0; font-size: 0.9em; line-height: 1.4; }
.prx-mce .prx-mce-card-head { font-weight: 600; color: var(--prx-fg-muted); }
.prx-mce .prx-mce-card > p.prx-mce-tagline { font-size: 0.8125rem; color: var(--prx-fg-muted); }
.prx-mce .prx-mce-card .prx-mce-blocks { margin: 0.25rem 0 0.1rem; font-size: 1.02em; font-weight: 700; letter-spacing: 0.02em; color: var(--prx-fg); }
.prx-mce .prx-mce-busy { margin: 0.4rem 0 0; font-size: 0.9em; font-style: italic; color: var(--prx-fg-muted); }
.prx-mce .prx-mce-table-wrap { max-width: 100%; margin: 0.35rem 0 0; overflow-x: auto; }
.prx-mce .prx-mce-ledger, .prx-mce .prx-mce-tally { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.875em; line-height: 1.35;
  font-variant-numeric: tabular-nums; }
.prx-mce .prx-mce-ledger caption, .prx-mce .prx-mce-tally caption { caption-side: top; padding: 0 0 0.35rem; text-align: left; font-weight: 600;
  color: var(--prx-fg-heading); }
.prx-mce .prx-mce-ledger th, .prx-mce .prx-mce-ledger td, .prx-mce .prx-mce-tally th, .prx-mce .prx-mce-tally td { padding: 0.25rem 0.5rem;
  text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); overflow-wrap: normal; word-break: normal; }
.prx-mce .prx-mce-ledger thead th { font-weight: 600; vertical-align: bottom; }
.prx-mce .prx-mce-ledger tbody th { font-weight: 600; color: var(--prx-fg-muted); }
.prx-mce .prx-mce-tally tbody th { font-weight: 400; }
.prx-mce .prx-mce-tally td { text-align: right; white-space: nowrap; }
.prx-mce .prx-mce-tally { margin-top: 0.1rem; }
@container (min-width: 34rem) {
  .prx-mce .prx-mce-ledger tbody th { min-width: 6.5rem; }
  .prx-mce .prx-mce-ledger td { min-width: 8rem; }
}
.prx-mce .prx-mce-formula { margin: 0.1rem 0 0; font-size: 0.9em; line-height: 1.5; max-width: 100%; }
.prx-mce .prx-mce-math { display: inline-block; max-width: 100%; }
.prx-mce .prx-mce-formula math { font-size: 1.05em; }
.prx-mce .prx-mce-keep { white-space: nowrap; }
@media (max-width: 30em) {
  .prx-mce .prx-mce-ledger th, .prx-mce .prx-mce-ledger td, .prx-mce .prx-mce-tally th, .prx-mce .prx-mce-tally td { padding: 0.2rem 0.3rem; }
}
`;

// --------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    // review 044 repair (X-01): the read-out directly under the controls and the preset row
    layout: "result-first",
    css: CSS,
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
      const num = (raw, display, hook) => {
        const n = ctx.num(raw, display);
        if (hook) n.setAttribute("data-prx-readout", hook);
        return n;
      };
      const count = (x, hook) => num(x, fmtCount(x), hook);
      const seedWrap = (from, to) => from > to ? h("span", { "data-prx-note": "seed-wrap" }, ...fill(T.seedWrap, {
        max: () => num(CONFIG.seed.max, fmtSet(CONFIG.seed.max)), min: () => num(CONFIG.seed.min, fmtSet(CONFIG.seed.min)),
      })) : "";
      // the MCSE multiplier (postrank's z = 2) wherever "2 MCSE" is written
      const zNum = () => num(CONFIG.z, fmtCount(CONFIG.z));
      const pNum = () => num(1 - CONFIG.alpha, fmtSet(1 - CONFIG.alpha));
      const item = (cls, ...content) => h("span", { class: "prx-mce-key-item" }, h("span", { class: `prx-mce-sw ${cls}`, "aria-hidden": "true" }), h("span", {}, ...content));

      // ------------------------------------------------------------------------------------------- controls
      const score = ctx.segmented({
        label: T.score, name: "criteria", value: ctx.state.criteria,
        options: CONFIG.criteria.values.map((v) => ({ value: v, label: T.scoreWords[v] })),
        onChange: (v) => ctx.set({ criteria: v }),
      });
      const sSlider = ctx.slider({
        label: T.S, min: CONFIG.S.min, max: CONFIG.S.max, step: CONFIG.S.step, value: ctx.state.S, name: "S",
        format: (v) => fmtCount(v), hint: T.SHint, onInput: (v) => ctx.set({ S: Math.round(v) }),
      });
      const tau = ctx.slider({ label: T.tau, ...ctx.key("tau"), name: "tau", format: (v) => fmtSet(v), onInput: (v) => ctx.set({ tau: v }) });
      const seedHintId = uid("prx-mce-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed, min: CONFIG.seed.min, max: CONFIG.seed.max, step: 1, value: ctx.state.seed, name: "seed",
        describedBy: seedHintId, onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      const redraw = ctx.button({
        label: T.redraw, title: T.redrawTitle, key: "redraw",
        onClick: () => ctx.set({ seed: seedAt(ctx.state.seed, 1) }),
      });
      const pairSelect = ctx.select({
        label: T.pair, name: "pair", value: ctx.state.pair,
        options: PAIRS.map((p) => ({ value: p.key, label: p.name })), onChange: (v) => ctx.set({ pair: v }),
      });
      const capSeg = ctx.segmented({
        label: T.cap, name: "cap", value: ctx.state.cap,
        options: CONFIG.cap.values.map((v) => ({ value: v, label: T.capWords[v] })), onChange: (v) => ctx.set({ cap: v }),
      });
      const seedBox = h("div", { class: "prx-mce-seed" }, seed.root, redraw.root, h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      ctx.controls.append(
        h("div", { class: "prx-mce-row" }, score.root, sSlider.root, tau.root),
        h("div", { class: "prx-mce-row" }, seedBox, pairSelect.root, capSeg.root),
      );

      // ------------------------------------------------------------------------------------------- panels
      const panelHead = (cls = "prx-mce-heading", level = 4) => ctx.part("notes", ctx.panelTitle("", { className: cls, level }));
      // this run: the graphic S, Redraw, the seed and τ change, directly under the read-out (base.js primaryGraphic)
      const runTitle = panelHead();
      const runSlot = ctx.primaryGraphic(h("div", { class: "prx-mce-chart prx-mce-run-chart" }));
      const runKey = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const runBox = h("section", { class: "prx-mce-run", "aria-label": T.runTable }, runTitle, runSlot, runKey);
      // over S
      const overTitle = panelHead();
      const overSlot = h("div", { class: "prx-mce-chart" });
      const overKey = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const overNote = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      // across the whole width, after the reports (review 044 repair, U3-F2's order)
      const overBox = h("section", { class: "prx-mce-over prx-mce-wide", "aria-label": T.overTable }, overTitle, overSlot, overKey, overNote);
      // the runs
      const runsTitle = panelHead();
      const busyNote = h("p", { class: "prx-mce-busy", "data-prx-part": "notes", hidden: true });
      const h1Head = panelHead("prx-mce-sub", 5);
      const h1Slot = h("div", { class: "prx-mce-chart" });
      const h1Key = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const h1Spread = h("p", { class: "prx-mce-text", "data-prx-part": "readout" });
      const h2Head = panelHead("prx-mce-sub", 5);
      h2Head.textContent = T.hist2Head;
      const h2Slot = h("div", { class: "prx-mce-chart" });
      const h2Key = h("div", { class: "prx-mce-key", "data-prx-part": "legend" });
      const runsBody = h("div", { class: "prx-mce-runs-body" }, h1Head, h1Slot, h1Key, h1Spread, h2Head, h2Slot, h2Key);
      const runsBox = h("section", { class: "prx-mce-runs", "aria-label": T.runsLabel }, runsTitle, busyNote, runsBody);
      // the reports, with the counts over the runs beside them
      const repTitle = panelHead();
      repTitle.textContent = T.repHead;
      const cardEst = h("div", { class: "prx-mce-card-slot" });
      const cardExact = h("div", { class: "prx-mce-card-slot" });
      const tallyWrap = ctx.scrollRegion(h("div", { class: "prx-mce-table-wrap" }), T.tallyLabel);
      const familyLine = h("p", { class: "prx-mce-text", "data-prx-part": "readout", "data-prx-note": "family" });
      const tieLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "ties", hidden: true });
      const aloneLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const tallyBox = h("div", { class: "prx-mce-tally-box" }, tallyWrap, familyLine, tieLine, aloneLine);
      const repCompare = h("p", { class: "prx-mce-text", "data-prx-part": "readout", "data-prx-note": "compare" });
      const repNote = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const repBox = h("section", { class: "prx-mce-reports prx-mce-wide", "aria-label": T.repHead },
        repTitle, h("div", { class: "prx-mce-rep-grid" },
          h("div", { class: "prx-mce-rep-cards" }, h("div", { class: "prx-mce-cards" }, cardEst, cardExact), repCompare, repNote), tallyBox));
      // the ledger
      const ledgerWrap = ctx.scrollRegion(h("div", { class: "prx-mce-table-wrap" }), T.ledLabel);
      const formula = h("p", { class: "prx-mce-formula", "data-prx-part": "notes" });
      const bookLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "book" });
      const pairLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const ruleLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const sameELine = h("p", { class: "prx-mce-note", "data-prx-part": "notes" });
      const mcmcLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", text: T.mcmc });
      // two guarantees the ledger leaves to other apps: an error budget (4.14) and an optimizer's gap (2.18)
      const othersLine = h("p", { class: "prx-mce-note", "data-prx-part": "notes", "data-prx-note": "others" },
        ...fill(T.others, { budgets: () => appLink(ctx, "estimated-budgets"), regret: () => appLink(ctx, "chosen-and-judged") }));
      const ledgerBox = h("section", { class: "prx-mce-ledger-box prx-mce-wide", "aria-label": T.ledLabel },
        h("div", { class: "prx-mce-ledger-grid" }, ledgerWrap, h("div", {}, formula, bookLine, pairLine, ruleLine, sameELine, mcmcLine, othersLine)));

      ctx.charts.classList.add("prx-mce-charts");
      // review 044 repair (X-01; U3-F2's order): this run beside the 100 runs, then the reports and the counts over
      // the runs (the decision the presets are about), then the panel over S, then the ledger; one column below 56rem
      ctx.charts.append(h("div", { class: "prx-mce-views" },
        h("div", { class: "prx-mce-col" }, runBox),
        h("div", { class: "prx-mce-col" }, runsBox),
        repBox, overBox, ledgerBox));

      // the pair followed: a click on a row of the run figure (the keyboard points select by focus)
      let runRows = [];
      let runFigure = null;
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

      // ------------------------------------------------------------------------------------------- the runs, in slices
      let job = null;
      const busy = (on) => (on ? ctx.root.setAttribute("aria-busy", "true") : ctx.root.removeAttribute("aria-busy"));
      function cancelJob() {
        if (!job) return;
        job.cancel?.();
        job = null;
        busy(false);
      }
      ctx.onCleanup(cancelJob);
      /** Run `tasks` in slices under aria-busy (one job at a time, by key), then render again. */
      function stage(key, tasks) {
        if (job && job.key === key) return;
        cancelJob();
        const j = { key, tasks, cancel: null };
        job = j;
        busy(true);
        const now = () => ctx.win.performance?.now?.() ?? Date.now();
        const step = () => {
          if (job !== j) return;
          const t0 = now();
          while (j.tasks.length && now() - t0 < CONFIG.sliceMs) j.tasks.shift()();
          if (j.tasks.length) { j.cancel = ctx.timeout(step, 0); return; }
          job = null;
          busy(false);
          ctx.requestRender("runs");
        };
        j.cancel = ctx.timeout(step, 0);
      }
      /**
       * Work that is missing is done now when it is small (`units` in units of draws: S × scores per run,
       * CONFIG.optUnits per report chosen, summed over the tasks) and in slices otherwise. Returns true when it is all
       * done; key names the job.
       */
      function ensure(key, tasks, units) {
        if (!tasks.length) return true;
        if (units <= CONFIG.syncBudget) { for (const t of tasks) t(); return true; }
        stage(key, tasks);
        return false;
      }
      const recJob = (st) => `rec|${st.criteria}|${st.S}|${st.seed}`;
      const optJob = (st) => `opt|${st.criteria}|${st.S}|${st.seed}|${st.tau}|${st.cap}`;
      /** The 100 runs of the state (records). */
      function recordsReady(state) {
        const { criteria: c, S } = state;
        const tasks = seedsOf(state.seed).filter((s) => !runCache.has(recKey(c, S, s))).map((s) => () => runRecord(c, S, s));
        return ensure(recJob(state), tasks, tasks.length * S * LAW[c].w.length);
      }
      /**
       * The reports chosen from each run's estimates at the state's τ and cap and, with the cap, the same flipped
       * runs' reports with any number of grades (what holds the pair followed in one grade).
       */
      function reportsReady(state, base) {
        const { tau, cap } = state;
        const want = base.recs.map((r) => [r, cap]);
        if (cap !== "none") base.kinds.forEach((kind, i) => { if (kind === "flip") want.push([base.recs[i], "none"]); });
        const missing = want.filter(([r, f]) => !optMemo.has(optKey(r, tau, f)));
        const units = missing.reduce((sum, [, f]) => sum + (CONFIG.optUnits[f] ?? CONFIG.optUnits[3]), 0);
        return ensure(optJob(state), missing.map(([r, f]) => () => runOpt(r, tau, f)), units);
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

      /**
       * The runs' numbers at this τ and pair that need no report (the records are read again; nothing is drawn). Each
       * run's own choice for the pair is "same" (as with its exact value), "tie" (its estimate equals τ within the
       * equal-risk tolerance, so stating and withholding tie) or "flip" (another single choice).
       */
      function runsBase(state, k) {
        const recs = seedsOf(state.seed).map((s) => runRecord(k.c, state.S, s));
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
        const count = (kind) => kinds.filter((x) => x === kind).length;
        return {
          recs, R: recs.length, from: recs[0].seed, to: recs[recs.length - 1].seed, e, est, m1, sd: summaryStats(est).sd,
          within: m1 > 0 ? tally(est.map((v) => Math.abs(v - e) <= CONFIG.z * m1)) : null,
          fragile: tally(recs.map((r) => flaggedAt(r.pairs[k.sel.key], state.tau))),
          kinds, same: count("same"), flips: count("flip"), ties: count("tie"), exactChoice: pairDecision(e, k.X.wE[b][a], state.tau).best,
          maxErr: recs.map((r) => Math.max(...r.eps)), held: tally(recs.map((r) => r.eps.every((x, q) => x <= k.env.eps[q]))),
          constant: est.every((v) => v === est[0]) ? est[0] : null,
        };
      }

      /**
       * The runs' numbers that need each run's reports (memoized optima; reportsReady has made them). A run keeps the
       * exact report when an exact optimum is among its tied optima; the pair shares a grade when every optimum keeps it
       * in one grade. With the cap, the flipped runs' reports with any number of grades say what holds the pair.
       */
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
          sameReport: tally(kept), together: tally(optima.map((gs) => gs.every((g) => g[k.a] === g[k.b]))),
          flipChanged: changedIn("flip"), tieChanged: changedIn("tie"), flipChangedAll,
          tiedRuns: tiedSizes.length, tiedLo: tiedSizes.length ? Math.min(...tiedSizes) : 0, tiedHi: tiedSizes.length ? Math.max(...tiedSizes) : 0,
        };
      }

      // ------------------------------------------------------------------------------------------- drawing: this run
      function choiceWords(best, i, j) {
        const has = (x) => best.includes(x);
        if (best.length > 1) return T.aloneWords.tie;
        if (has("withhold")) return T.aloneWords.withheld;
        return words(has("iAboveJ") ? T.aloneWords.stated : T.aloneWords.reversed, { i, j });
      }

      function drawRun(state, k) {
        const xMax = Math.min(1, Math.max(0.5, ...k.fr.pairs.map((p) => p.weightedError + CONFIG.z * (p.mcse ?? 0))));
        const delta = k.env.deltaW;
        const gHat = k.optHat.grade;
        runRows = k.X.least.map((p) => {
          const f = k.frBy.get(pairKey(p.i, p.j));
          const m = f.mcse ?? 0;
          const key = pairKey(p.i, p.j);
          return {
            key, name: PAIR_BY_KEY.get(key).name, i: p.i, j: p.j, exact: p.e, above: p.above,
            est: f.weightedError, estAbove: f.betterDirection === "i_ahead" ? f.i : f.j, mcse: m,
            lo2: Math.max(0, f.weightedError - CONFIG.z * m), hi2: Math.min(xMax, f.weightedError + CONFIG.z * m),
            envLo: Math.max(0, f.weightedError - delta), envHi: Math.min(xMax, f.weightedError + delta),
            fragile: f.fragile === true, selected: key === k.sel.key,
            rel: words(T.rel[relationOf(gHat, p.i, p.j)], { i: IDS[p.i], j: IDS[p.j] }),
          };
        });
        const rows = runRows;
        const width = runSlot.clientWidth || ctx.width();
        const fragile = rows.filter((r) => r.fragile);
        // the followed pair's estimate, written next to its dot (review 044 repair, X-01: the number on the mark that
        // S, Redraw and the seed move): past its ±2 MCSE bar and its exact diamond on the right. When the plot has no
        // room there, above the dot, inside the plot's width (not before the bar, where it could read as the bar's
        // lower end: Phase 3 review A2); below the dot when the τ label (top row) or the row above has a mark in its
        // way; before the bar, as before, only when the row below is in the way too
        const sel = rows.find((r) => r.selected);
        const inner = Math.max(1, width - C.marginLeft - C.marginRight);
        const xPx = (v) => (v / xMax) * inner;
        const estMark = sel ? (() => {
          const textPx = fmtP(sel.est).length * C.font * C.estChar;
          const right = Math.max(sel.hi2, sel.exact);
          if (xPx(right) + C.diamond + C.estGap + textPx <= inner) {
            return { key: sel.key, x: right, v: sel.est, dx: C.diamond + C.estGap, dy: 0, anchor: "start", line: "middle" };
          }
          const at = xPx(sel.est);
          const anchor = at + textPx / 2 > inner ? "end" : at - textPx / 2 < 0 ? "start" : "middle";
          const dx = anchor === "end" ? C.dot : anchor === "start" ? -C.dot : 0;
          const x0 = anchor === "end" ? at + dx - textPx : anchor === "start" ? at + dx : at - textPx / 2;
          const span = [x0 - C.estHalo, x0 + textPx + C.estHalo];
          const hits = (spans) => spans.some(([a, b]) => a < span[1] && b > span[0]);
          // the marks of a neighboring row that reach into the gap between two rows: its dot, its diamond, its caps
          const marksOf = (r) => [
            [xPx(r.est) - C.dot - 1, xPx(r.est) + C.dot + 1], [xPx(r.exact) - C.diamond - 1, xPx(r.exact) + C.diamond + 1],
            ...(r.mcse > 0 ? [r.lo2, r.hi2].map((v) => [xPx(v) - C.whisker, xPx(v) + C.whisker]) : []),
          ];
          // the τ label at the top of the frame: "τ" before τ's line, its value after it
          const tx = xPx(state.tau);
          const tauSpans = [[tx - C.tauLabelGap - C.font * C.estChar, tx], [tx, tx + C.tauLabelGap + fmtSet(state.tau).length * C.font * C.estChar]];
          const k = rows.indexOf(sel);
          const aboveFree = k === 0 ? !hits(tauSpans) : !hits(marksOf(rows[k - 1]));
          if (aboveFree) return { key: sel.key, x: sel.est, v: sel.est, dx, dy: -C.estAbove, anchor, line: "bottom" };
          if (k < rows.length - 1 && !hits(marksOf(rows[k + 1]))) return { key: sel.key, x: sel.est, v: sel.est, dx, dy: C.estBelow, anchor, line: "top" };
          return { key: sel.key, x: Math.min(sel.lo2, sel.exact), v: sel.est, dx: -(C.diamond + C.estGap), dy: 0, anchor: "end", line: "middle" };
        })() : null;
        const rowTitle = (r) => {
          const flip = r.estAbove !== r.above
            ? words(T.flip, { x: IDS[r.estAbove], y: IDS[r.estAbove === r.i ? r.j : r.i], u: IDS[r.above], v: IDS[r.above === r.i ? r.j : r.i] }) : "";
          return words(T.kbdRow, {
            name: r.name, est: fmtP(r.est), m: fmtSe(r.mcse), exact: fmtP(r.exact),
            frag: r.fragile ? words(T.kbdFragile, { tau: fmtSet(state.tau) }) : T.kbdNot, rel: r.rel,
          }) + flip;
        };
        // the hidden table keeps what the figure shows by marks: the fragile count, each pair's relation in the report
        const caption = [T.runTable, ...(fragile.length
          ? fill(T.runTableFragile, { n: () => count(fragile.length, "frag-count"), M: () => count(M, "frag-M") })
          : fill(T.runTableNone, { M: () => count(M) }))];
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
          height: C.marginTop + C.marginBottom + rows.length * C.row,
          marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
          x: { domain: [0, xMax], label: k.L.w.length > 1 ? (width < C.narrow ? T.xLabelABShort : T.xLabelAB) : width < C.narrow ? T.xLabelShort : T.xLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.xTicks },
          y: { type: "band", domain: rows.map((r) => r.key), axis: null, paddingInner: 0, paddingOuter: 0 },
          marks: (c, P) => {
            const withSe = rows.filter((r) => r.mcse > 0);
            return [
              // the envelope band: pale, no border, so the ±2 MCSE bar leads
              P.barX(rows, { x1: "envLo", x2: "envHi", y: "key", fill: c.plotGrid, fillOpacity: C.bandOpacity, insetTop: C.bandInset, insetBottom: C.bandInset }),
              P.ruleX([state.tau], { stroke: c.plotFg, strokeWidth: C.tauWidth, strokeDasharray: C.tauDash }),
              P.ruleY(withSe, { y: "key", x1: "lo2", x2: "hi2", stroke: c.est, strokeWidth: C.whisker }),
              P.tickX(withSe, { x: "lo2", y: "key", stroke: c.est, strokeWidth: C.whisker, insetTop: C.capInset, insetBottom: C.capInset }),
              P.tickX(withSe, { x: "hi2", y: "key", stroke: c.est, strokeWidth: C.whisker, insetTop: C.capInset, insetBottom: C.capInset }),
              P.dot(rows, { x: "est", y: "key", r: C.dot, fill: c.est, stroke: c.plotBg, strokeWidth: 1 }),
              // the exact value as a hollow diamond on top, so a close estimate shows through it
              P.dot(rows, { x: "exact", y: "key", symbol: "diamond", r: C.diamond, fill: "none", stroke: c.plotFg, strokeWidth: C.diamondWidth }),
              P.barX(fragile, { x1: 0, x2: xMax, y: "key", fill: "none", stroke: c.plotFg, strokeWidth: C.outline }),
              P.text(fragile, { x: xMax, y: "key", text: () => T.fragileTag, dx: C.tagGap, textAnchor: "start", fill: c.plotFg, fontSize: C.font }),
              P.text(rows.filter((r) => !r.selected), { x: 0, y: "key", text: "name", dx: -C.labelGap, textAnchor: "end", fill: c.plotFg, fontSize: C.font }),
              P.text(rows.filter((r) => r.selected), { x: 0, y: "key", text: (r) => `${T.selectedMark}${r.name}`, dx: -C.labelGap, textAnchor: "end", fill: c.plotFg, fontSize: C.font, fontWeight: "bold" }),
              P.text([state.tau], { x: (v) => v, frameAnchor: "top", dy: C.tauLabelDy, dx: -C.tauLabelGap, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: C.font }),
              numText([state.tau], { x: (v) => v, frameAnchor: "top", dy: C.tauLabelDy, dx: C.tauLabelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: C.font }),
              ...(estMark ? [numText([estMark], {
                x: "x", y: "key", value: "v", format: fmtP, dx: estMark.dx, dy: estMark.dy, textAnchor: estMark.anchor,
                lineAnchor: estMark.line, fill: c.plotFg, fontSize: C.font, fontWeight: "bold", stroke: c.plotBg,
                strokeWidth: C.estHalo, paintOrder: "stroke",
              })] : []),
            ];
          },
          keyboard: {
            data: rows, x: "est", y: "key", key: "key", sort: false, label: T.kbdLabel, title: rowTitle,
            onFocus: (r) => { if (r.key !== ctx.state.pair) ctx.set({ pair: r.key }); },
          },
        });
        // the first keyboard stop is the pair followed, so Tab into the figure keeps the selection
        const buttons = [...runFigure.area.querySelectorAll(".prx-kbd-point")];
        const at = rows.findIndex((r) => r.selected);
        if (at >= 0 && buttons.length === rows.length && ctx.doc.activeElement?.parentNode !== buttons[0]?.parentNode) {
          buttons.forEach((bt, i) => { bt.tabIndex = i === at ? 0 : -1; });
        }

        runTitle.replaceChildren(...fill(T.runHead, { S: () => count(state.S, "run-S"), seed: () => num(state.seed, fmtSet(state.seed), "run-seed") }));
        runKey.replaceChildren(
          item("prx-mce-sw-est", ...fill(T.keyEst, { z: zNum })),
          item("prx-mce-sw-diamond", T.keyExact),
          item("prx-mce-sw-band", ...fill(T.keyBand, { r: () => num(delta, fmtR(delta), "key-radius"), p: pNum })),
          item("prx-mce-sw-tau", ...fill(T.keyTau, { tau: () => num(state.tau, fmtSet(state.tau)) })),
          item("prx-mce-sw-fragile", ...fill(T.keyFragile, { z: zNum })),
        );
      }

      // ------------------------------------------------------------------------------------------- drawing: over S
      function drawOverS(state, k) {
        const e = k.X.wE[k.a][k.b];
        const series = overSMemo(`${k.c}|${k.a}|${k.b}`, k.c, e);
        const one = k.L.w.length === 1;
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const first = series[0];
        const lo = Math.max(0, Math.min(e - first.r, state.tau) - O.pad);
        const hi = Math.min(1, Math.max(e + first.r, state.tau) + O.pad);
        const est = k.main.rec.wHat[k.a][k.b];
        const now = { S: state.S, r: k.env.deltaW, se: one ? exactSe(e, state.S) : null };
        const reads = [...new Set([...CONFIG.overS.read, state.S])].sort((x, y) => x - y)
          .map((S) => (S === state.S ? now : series.find((d) => d.S === S) ?? { S, r: envelopeFor(k.c, S).deltaW, se: one ? exactSe(e, S) : null }));
        overTitle.replaceChildren(...fill(T.overHead, { name: k.sel.name }));
        plot(overSlot, {
          alt: T.overAlt,
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
          height: O.height,
          marginTop: O.marginTop, marginBottom: O.marginBottom, marginLeft: O.marginLeft, marginRight: O.marginRight,
          x: { domain: [CONFIG.overS.from, CONFIG.overS.to], label: T.overX, labelAnchor: "center", labelArrow: "none", grid: true, ticks: O.xTicks },
          y: { domain: [lo, hi], label: words(one ? T.overY : T.overYAB, { i: iName, j: jName }), labelAnchor: "center", labelArrow: "none", grid: true, ticks: O.yTicks },
          marks: (c, P) => [
            P.areaY(series, { x: "S", y1: (d) => Math.max(lo, e - d.r), y2: (d) => Math.min(hi, e + d.r), fill: c.plotGrid, fillOpacity: C.bandOpacity, curve: "linear" }),
            ...(one ? [P.areaY(series.filter((d) => d.se !== null), {
              x: "S", y1: (d) => Math.max(lo, e - CONFIG.z * d.se), y2: (d) => Math.min(hi, e + CONFIG.z * d.se), fill: c.est, fillOpacity: O.bandOpacity, curve: "linear",
            })] : []),
            P.ruleY([state.tau], { stroke: c.plotFg, strokeWidth: C.tauWidth, strokeDasharray: C.tauDash }),
            P.text([state.tau], { y: (v) => v, frameAnchor: "right", dy: O.labelDy, dx: -C.tauLabelGap - 26, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: C.font }),
            numText([state.tau], { y: (v) => v, frameAnchor: "right", dy: O.labelDy, dx: -26 + C.tauLabelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: C.font }),
            P.ruleY([e], { stroke: c.plotFg, strokeWidth: O.exactWidth }),
            P.ruleX([state.S], { stroke: c.plotMuted, strokeWidth: O.shownWidth, strokeDasharray: O.shownDash }),
            P.dot([{ S: state.S, v: est }], { x: "S", y: "v", r: O.dot, fill: c.est, stroke: c.plotBg, strokeWidth: 1 }),
          ],
          keyboard: {
            data: reads, x: "S", y: () => e, key: (d) => `S${d.S}`, label: T.kbdOverLabel,
            title: (d) => words(T.kbdOver, {
              S: fmtCount(d.S), e: fmtP(e), r: fmtR(d.r), se: d.se === null || e < CONFIG.seFrom ? "" : words(T.kbdOverSe, { z: fmtCount(CONFIG.z), x: fmtSe(CONFIG.z * d.se) }),
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

      // ------------------------------------------------------------------------------------------- drawing: reports
      function card(title, opt, which) {
        const tag = tagNode(ctx, opt, { key: which });
        // tied reports that state different numbers of pairs: the number for each one
        const sizes = (opt.grades ?? []).map((g) => disclosure(g).N);
        const differ = sizes.some((x) => x !== sizes[0]);
        const others = () => h("span", {}, ...sizes.slice(1).flatMap((x, i, all) => [
          ...(i ? [i === all.length - 1 ? T.and : ", "] : []), count(x, `${which}-N-tied`)]));
        const states = differ
          ? fill(T.statesTied, { N: () => count(opt.N, `${which}-N`), M: () => count(M), others, reports: sizes.length > 2 ? T.tiedReports : T.tiedReport })
          : fill(T.states, { N: () => count(opt.N, `${which}-N`), M: () => count(M) });
        const out = h("div", { class: "prx-mce-card" },
          h("p", { class: "prx-mce-card-head", text: title }),
          h("p", { class: "prx-mce-blocks" }, blocksText(opt.grade, IDS)),
          h("p", { class: "prx-mce-tagline" }, tag, which === "est" ? T.forEst : T.forExact),
          h("p", { "data-prx-note": `${which}-states` }, ...states));
        const ties = opt.tieCount ?? opt.grades?.length ?? 1;
        if (ties > 1) {
          // ties in words with the tolerance; tied reports that state different numbers of pairs also get the caption
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
            n: () => count(changed.length, "rep-changed"), pairs: changed.length === 1 ? T.pairWord : T.pairsWord, list: () => h("span", {}, ...list),
          }));
        }
        aloneLine.replaceChildren(...fill(k.L.w.length > 1 ? T.aloneAB : T.alone, { one: () => num(1, fmtCount(1)) }));
      }

      /** The counts over the runs (beside the cards) and the line on what holds the pair followed in one grade. */
      function drawTally(state, k, base, rep) {
        const run = { ...base, ...rep };
        const R = () => count(run.R);
        const of = (n, hook) => fill(T.tallyOf, { k: () => count(n, hook), R });
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const tiedExact = optimaOf(k.optExact).length > 1;
        const reportLabel = run.tiedRuns ? (tiedExact ? T.tallyReportAmongTied : T.tallyReportAmong) : (tiedExact ? T.tallyReportTied : T.tallyReport);
        const row = (label, value, note) => h("tr", note ? { "data-prx-note": note } : {}, h("th", { scope: "row" }, ...label), h("td", {}, ...value));
        const table = h("table", { class: "prx-mce-tally" },
          h("caption", {}, ...fill(T.tallyCaption, { R, from: () => num(run.from, fmtSet(run.from)), to: () => num(run.to, fmtSet(run.to)), wrap: () => seedWrap(run.from, run.to) })),
          h("tbody", {},
            row(fill(T.tallyWithin, { name: k.sel.name, z: zNum }), run.within === null ? [T.tallyNone] : of(run.within, "runs-within")),
            row(fill(T.tallyFragile, { name: k.sel.name }), of(run.fragile, "runs-fragile")),
            row(fill(T.tallyChoice, { name: k.sel.name, choice: choiceWords(run.exactChoice, iName, jName) }), of(run.same, "runs-choice")),
            ...(run.ties ? [row(fill(T.tallyTie, { name: k.sel.name }), of(run.ties, "runs-ties"), "tally-ties")] : []),
            row([reportLabel], of(run.sameReport, "runs-same"), "tally-report"),
            row([T.tallyEnvelope], of(run.held, "runs-held"))));
        tallyWrap.replaceChildren(table);
        // what holds the pair in one grade: the cap, when with any number of grades the same flipped runs' report
        // changes more often or the exact best report states the pair
        const capWords = () => h("span", {}, ...fill(T.familyWords[state.cap], { G: () => count(FAMILIES[3].G) }));
        const slots = {
          Family: capWords, i: iName, j: jName, name: k.sel.name, R,
          k: () => count(run.together, "runs-together"), c: () => count(run.flipChanged, "runs-changed"), f: () => count(run.flips, "runs-flips"),
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
        // ties over the runs, in words with the equal-risk tolerance
        const tol = () => num(CONFIG.tieTol, formatSci(CONFIG.tieTol, { trim: true }));
        const ties = [];
        if (run.ties) {
          ties.push(...fill(run.flips ? T.pairTies : T.pairTiesOnly, {
            t: () => count(run.ties, "runs-ties-n"), name: k.sel.name, tol, ct: () => count(run.tieChanged, "runs-ties-changed"),
          }));
        }
        if (run.tiedRuns) {
          const n = () => (run.tiedLo === run.tiedHi ? count(run.tiedLo, "runs-tied-reports")
            : h("span", {}, ...fill(T.tiedCount, { lo: () => count(run.tiedLo), hi: () => count(run.tiedHi) })));
          if (ties.length) ties.push(" ");
          ties.push(...fill(T.reportTies, {
            u: () => count(run.tiedRuns, "runs-tied"), n, tolPart: () => h("span", {}, ...(run.ties ? [] : fill(T.reportTiesTol, { tol }))),
          }));
        }
        tieLine.hidden = !ties.length;
        tieLine.replaceChildren(...ties);
      }

      // ------------------------------------------------------------------------------------------- drawing: the runs
      function histogram(slot, { which, values, grid, lines, alt, caption, xLabel, kbdLabel, fill: fillColor, extend = [], bins: given, padRight = false }) {
        const all = [...values, ...extend];
        const lo0 = Math.max(0, Math.min(...all));
        const hi0 = Math.max(...all);
        const b = given ?? binsOf(values, { width: niceWidth((hi0 - lo0) / H.target, grid), lo: lo0, hi: hi0 });
        const lo = Math.max(0, Math.min(b.lo, lo0));
        const hi = Math.max(b.hi, hi0 + (padRight ? (hi0 - lo) * H.padShare : 0));
        const yMax = Math.max(1, ...b.bins.map((x) => x.n));
        const R = values.length;
        plot(slot, {
          alt,
          table: {
            caption,
            columns: [
              { label: T.tFrom, value: (x) => x.from ?? x.lo, format: fmtBin },
              { label: T.tTo, value: (x) => x.to ?? x.hi, format: fmtBin },
              { label: T.tRuns, value: "n", format: (v) => fmtCount(v) },
            ],
            rows: b.bins,
          },
          height: H.height,
          marginTop: H.marginTop, marginBottom: H.marginBottom, marginLeft: H.marginLeft, marginRight: H.marginRight,
          x: { domain: [lo, hi], label: xLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: H.xTicks },
          y: { domain: [0, yMax], nice: true, label: T.tRuns, labelAnchor: "center", labelArrow: "none", grid: true, ticks: H.yTicks },
          marks: (c, P) => [
            ...lines.under(c, P),
            P.rect(b.bins, { x1: "lo", x2: "hi", y1: 0, y2: "n", fill: c[fillColor], stroke: c.plotBg, strokeWidth: H.rim }),
            P.ruleY([0], { stroke: c.plotAxis }),
            ...lines.over(c, P),
          ],
          keyboard: {
            data: b.bins, x: (x) => (x.lo + x.hi) / 2, y: "n", key: (x) => `${which}${x.i}`, label: kbdLabel,
            title: (x) => words(T.kbdBin, { n: fmtCount(x.n), R: fmtCount(R), lo: fmtBin(x.from ?? x.lo), hi: fmtBin(x.to ?? x.hi) }),
          },
        });
      }

      function drawRuns(state, k, run) {
        const pairName = k.sel.name;
        const iName = IDS[k.a];
        const jName = IDS[k.b];
        const ab = k.L.w.length > 1;
        const m2 = CONFIG.z * run.m1;
        const grid = Math.min(...k.L.w.filter((x) => x > 0)) / state.S;
        const lowEnd = Math.min(...run.est, run.e - m2);
        const highEnd = Math.max(...run.est, run.e + m2);
        // τ is drawn when it lies near the estimates (always when every run gives the same estimate); otherwise a note
        // says where it is
        const reach = Math.max(highEnd - lowEnd, grid) * H.reach;
        const tauNear = run.constant !== null || (state.tau >= lowEnd - reach && state.tau <= highEnd + reach);
        h1Head.replaceChildren(...fill(ab ? T.hist1HeadAB : T.hist1Head, { name: pairName, i: iName, j: jName }));
        // every run with the same estimate: one narrow bar at that value on an axis that reaches τ
        const constantBins = run.constant === null ? null : (() => {
          const v = run.constant;
          const span = Math.max(v, state.tau, run.e) - Math.min(v, state.tau, run.e);
          const w = Math.max(grid, span / H.constantShare);
          const x1 = Math.max(0, v - w / 2);
          return { lo: x1, hi: x1 + w, bins: [{ i: 0, lo: x1, hi: x1 + w, from: v, to: v, n: run.R }] };
        })();
        histogram(h1Slot, {
          which: "est", values: run.est, grid, fill: "est", bins: constantBins, padRight: tauNear,
          extend: [run.e, ...(m2 > 0 ? [run.e - m2, run.e + m2] : []), ...(tauNear ? [state.tau] : [])],
          alt: T.hist1Alt, caption: T.hist1Table, kbdLabel: T.kbdHist1, xLabel: words(ab ? T.hist1XAB : T.hist1X, { i: iName, j: jName }),
          lines: {
            // the ±2 MCSE band behind the bars, pale vermillion as the bar of the run figure
            under: (c, P) => (m2 > 0 ? [P.rect([0], { x1: run.e - m2, x2: run.e + m2, fill: c.est, fillOpacity: H.bandOpacity })] : []),
            over: (c, P) => [
              ...(tauNear ? [
                P.ruleX([state.tau], { stroke: c.plotFg, strokeWidth: H.tauWidth, strokeDasharray: H.tauDash }),
                P.text([state.tau], { x: (v) => v, frameAnchor: "top", dy: H.labelDy, dx: -H.labelGap, text: () => T.tauMark, textAnchor: "end", fill: c.plotFg, fontSize: C.font, stroke: c.plotBg, strokeWidth: H.halo, paintOrder: "stroke" }),
                numText([state.tau], { x: (v) => v, frameAnchor: "top", dy: H.labelDy, dx: H.labelGap, value: (v) => v, format: fmtSet, textAnchor: "start", fill: c.plotFg, fontSize: C.font, stroke: c.plotBg, strokeWidth: H.halo, paintOrder: "stroke" }),
              ] : []),
              P.ruleX([run.e], { stroke: c.plotFg, strokeWidth: H.exactWidth }),
              P.dot([run.est[0]], { x: (v) => v, frameAnchor: "top", dy: H.markerDy, symbol: "triangle", rotate: 180, r: H.marker, fill: c.plotFg }),
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
          R: () => count(run.R), sd: () => num(run.sd, fmtSe(run.sd), "runs-sd"), m: () => num(run.m1, fmtSe(run.m1), "runs-mcse"),
        });
        if (run.constant !== null) {
          const v = run.constant;
          const t = v === 0 ? (ab ? T.constantZeroAB : T.constantZero) : v === 1 ? T.constantOne : T.constantOther;
          h1Spread.replaceChildren(
            ...fill(t, { R: () => count(run.R), v: () => num(v, fmtP(v), "runs-constant"), i: iName, j: jName }),
            " ", ...spread, " ", T.constantCaution,
          );
        } else {
          if (!tauNear) {
            spread.push(" ", ...fill(T.offScale, { tau: () => num(state.tau, fmtSet(state.tau)), side: state.tau > highEnd ? T.sides.right : T.sides.left }));
          }
          h1Spread.replaceChildren(...spread);
        }

        // the largest error of each run against the envelope
        histogram(h2Slot, {
          which: "max", values: run.maxErr, grid: 0, fill: "plotMuted", extend: [0, k.env.eps[0], k.env.book],
          alt: T.hist2Alt, caption: T.hist2Table, kbdLabel: T.kbdHist2,
          xLabel: (h2Slot.clientWidth || ctx.width()) < C.narrow ? T.hist2XShort : T.hist2X,
          lines: {
            under: () => [],
            over: (c, P) => [
              P.ruleX([k.env.eps[0]], { stroke: c.plotFg, strokeWidth: H.envWidth }),
              P.ruleX([k.env.book], { stroke: c.plotFg, strokeWidth: H.envWidth, strokeDasharray: H.bookDash }),
            ],
          },
        });
        h2Key.replaceChildren(
          item("prx-mce-sw-bar prx-mce-sw-bar-max", T.keyMax),
          item("prx-mce-sw-env", ...fill(T.keyEnv, { r: () => num(k.env.eps[0], fmtR(k.env.eps[0])) })),
          item("prx-mce-sw-book", ...fill(T.keyBook, { b: () => num(k.env.book, fmtR(k.env.book)) })),
        );
        runsTitle.replaceChildren(...fill(T.runsHead, {
          R: () => count(run.R, "runs-R"), S: () => count(state.S, "runs-S"),
          from: () => num(run.from, fmtSet(run.from), "runs-from"), to: () => num(run.to, fmtSet(run.to), "runs-to"),
          wrap: () => seedWrap(run.from, run.to),
        }));
      }

      // ------------------------------------------------------------------------------------------- drawing: ledger
      function drawLedger(state, k) {
        const env = k.env;
        const ab = env.K > 1;
        const cell = (note, content) => h("td", note ? { "data-prx-note": note } : {}, ...content);
        const row = (label, a, b, note) => h("tr", {}, h("th", { scope: "row", text: label }), cell(null, a), cell(note, b));
        const m = k.frSel.mcse ?? 0;
        const table = h("table", { class: "prx-mce-ledger" },
          h("caption", { text: T.ledCaption }),
          h("thead", {}, h("tr", {}, h("td", {}), h("th", { scope: "col", text: T.ledMcse }), h("th", { scope: "col", text: T.ledEnv }))),
          h("tbody", {},
            row(T.ledHere,
              fill(T.ledHereMcse, { name: k.sel.name, m: () => num(m, fmtSe(m), "led-mcse") }),
              fill(ab ? T.ledHereEnvAB : T.ledHereEnv, {
                r: () => num(env.deltaW, fmtR(env.deltaW), "led-radius"),
                a: () => num(ab ? env.alphaK : CONFIG.alpha, fmtSet(ab ? env.alphaK : CONFIG.alpha)),
              })),
            row(T.ledWhat, [T.ledWhatMcse], [T.ledWhatEnv]),
            row(T.ledHolds, [T.ledHoldsMcse], fill(T.ledHoldsEnv, { p: pNum }), "holds-env"),
            row(T.ledChosen, [T.ledChosenMcse], [T.ledChosenEnv]),
            h("tr", {}, h("th", { scope: "row", text: T.ledDouble }), h("td", { colspan: 2, "data-prx-note": "doubling" }, ...fill(T.ledDoubleText, { two: () => num(2, fmtCount(2)) })))));
        ledgerWrap.replaceChildren(table);

        // the radius with its numbers, in two pieces so a narrow screen breaks the line between them
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
          M: () => count(M), a: () => num(env.alphaK, fmtSet(env.alphaK)), total: () => num(CONFIG.alpha, fmtSet(CONFIG.alpha)),
          dw: () => num(env.deltaW, fmtR(env.deltaW)),
        }));
        bookLine.replaceChildren(...fill(ab ? T.bookAB : T.book, {
          four: () => num(4, fmtCount(4)), two: () => num(2, fmtCount(2)), K: () => count(env.K), b: () => num(env.book, fmtR(env.book), "book-radius"),
          a: () => num(CONFIG.alpha, fmtSet(CONFIG.alpha)),
        }));
        // the pair followed with its exact value: its distance from τ and (one score, e at least .001) the exact-e
        // approximation
        const eSel = k.X.wE[k.a][k.b];
        const gap = Math.abs(eSel - state.tau);
        const pair = fill(T.pairExact, { name: k.sel.name, gap: () => num(gap, fmtSe(gap), "exact-gap") });
        const x = k.L.w.length === 1 && eSel >= CONFIG.seFrom ? exactSe(eSel, state.S) : null;
        if (x !== null) {
          pair.push(...fill(T.pairExactSe, {
            one: () => num(1, fmtCount(1)), z: zNum, x: () => num(x, fmtSe(x), "exact-se"), x2: () => num(CONFIG.z * x, fmtSe(CONFIG.z * x), "exact-2se"),
          }));
        }
        pairLine.replaceChildren(...pair);
        ruleLine.replaceChildren(...fill(T.rule, { ij: () => h("sub", {}, "ij"), ji: () => h("sub", {}, "ji"), z: zNum }));
        sameELine.replaceChildren(...fill(T.sameE, { name: k.sel.name, e: () => num(k.exactRow.e, fmtP(k.exactRow.e), "same-e") }));
      }

      // ------------------------------------------------------------------------------------------- read-out, caption
      function writeReadout(state, k, reruns) {
        const f = k.frSel;
        const m = f.mcse ?? 0;
        let frag;
        if (m === 0) frag = fill(T.readConstant, { zero: () => num(0, fmtSe(0)) });
        else if (f.fragile) frag = fill(T.readFragile, { tau: () => num(state.tau, fmtSet(state.tau)), z: zNum });
        else frag = fill(T.readNot, { tau: () => num(state.tau, fmtSet(state.tau)), ratio: () => num(f.ratio, fmtRatio(f.ratio), "read-ratio") });
        const estAbove = f.betterDirection === "i_ahead" ? f.i : f.j;
        const flip = estAbove !== k.a ? words(T.readFlip, { x: IDS[estAbove], y: IDS[estAbove === f.i ? f.j : f.i] }) : "";
        const changed = k.change.changed;
        const report = !changed ? [" The estimated and exact reports agree."]
          : inExact(k.optExact, k.optHat.grade) ? [" The estimated report is one of the exact optima."]
          : inExact(k.optHat, k.optExact.grade) ? [" The exact report is one of the estimated optima."]
          : [" The reports differ on ", count(changed), changed === 1 ? " pair." : " pairs."];
        const replay = !reruns ? [] : reruns.flips
          ? [" The isolated choice flipped in ", count(reruns.flips), " of ", count(reruns.R),
            " reruns; the full report changed in ", count(reruns.flipChanged), " of those ", count(reruns.flips), "."]
          : [" The isolated choice never flipped in ", count(reruns.R), " reruns."];
        ctx.readout.set([...fill(T.readout, {
          name: k.sel.name, S: () => count(state.S, "read-S"), flip,
          est: () => num(f.weightedError, fmtP(f.weightedError), "read-est"),
          exact: () => num(k.exactRow.e, fmtP(k.exactRow.e), "read-exact"),
          m: () => num(m, fmtSe(m), "read-mcse"),
          frag: () => h("span", {}, ...frag),
        }), ...report, ...replay]);
      }

      function writeCaption(state) {
        const seeds = seedsOf(state.seed);
        ctx.caption.replaceChildren(
          ...fill(T.caption1, { score: T.scoreNames[state.criteria] }), captionNode(ctx, "teaching-posterior"), T.caption2,
          captionNode(ctx, "monte-carlo", { S: state.S, seed: state.seed }),
          ...fill(T.caption3, {
            R: () => count(CONFIG.runs), from: () => num(seeds[0], fmtSet(seeds[0])), to: () => num(seeds.at(-1), fmtSet(seeds.at(-1))),
            wrap: () => seedWrap(seeds[0], seeds.at(-1)),
          }),
        );
      }

      // ------------------------------------------------------------------------------------------- render
      return {
        render(state) {
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

          // a job for another setting is no longer wanted
          if (job && job.key !== recJob(state) && job.key !== optJob(state)) cancelJob();
          if (recordsReady(state)) {
            busyNote.hidden = true;
            runsBody.classList.remove("prx-mce-stale");
            const base = runsBase(state, k);
            drawRuns(state, k, base);
            if (reportsReady(state, base)) {
              tallyBox.classList.remove("prx-mce-stale");
              const reports = runsReports(state, k, base);
              reruns = { ...base, ...reports };
              drawTally(state, k, base, reports);
            } else {
              // the reports of the runs are chosen in slices; the counts beside the cards stay, dimmed, meanwhile
              tallyBox.classList.add("prx-mce-stale");
            }
            if (!job) busy(false);
          } else {
            // the previous runs stay on screen, dimmed, under the note until the new ones are drawn
            busyNote.replaceChildren(...fill(T.busy, { R: () => count(CONFIG.runs), S: () => count(state.S) }));
            busyNote.hidden = false;
            runsBody.classList.add("prx-mce-stale");
            tallyBox.classList.add("prx-mce-stale");
          }
          writeReadout(state, k, reruns);
        },
      };
    },
  });
}
