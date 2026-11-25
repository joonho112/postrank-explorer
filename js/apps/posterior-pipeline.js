// posterior-pipeline (app 1.7): of data, model, posterior and decision, postrank does only the last step: it reads a
// supplied posterior and selects a grade report.
//
//   Data Y  →  Model  →  Posterior Pr(θ ∣ Y)  →  Decision (grades)
//
// Frame v2 layout:
//   toolbar      primary sliders (Prior SD, Withholding cost τ), wrapping preset chips, and Settings (unit A & B
//                estimates and SEs, plus preset/header note)
//   readout      concise 1-sentence 3-sig-fig summary naming the focused stage, posterior shrinkage, π, and decision
//   stage        the linked 4-stage chain (.prx-pp-flow, [data-prx-primary]), each stage headed by its clickable box
//                button (.prx-pp-box[data-prx-box="1".."4"]), followed by a crisp 1:1 width >= 13px SVG mini-chart and
//                one concise key-number / grade-chip line, with a dashed boundary around stages 3–4 (postrank's scope)
//   disclosures  Data and exact values (2-unit posterior table, 3-report cost table, and formulas/notes),
//                What each box holds and who makes it (all four box explanations, open box first with aria-live), and
//                What postrank can do with each form of posterior (input routes capability table / narrow list)
//   caption      catalog source caption
import { builtPage, createWidget, linkRoot, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { formatDecimal, formatReadoutEst, formatReadoutProb, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { renderTex } from "../shared/math.js";
import { ro } from "../shared/readout.js";
import { errorArray, exactOptimum, normalPdf, normalPosterior, pairDecision, pairDirection } from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "posterior-pipeline",
  className: "prx-pp",
  box: Object.freeze({ type: "integer", min: 1, max: 4, value: 1 }),
  estA: Object.freeze({ type: "number", min: -0.6, max: 0.6, step: 0.01, value: 0.25 }),
  seA: Object.freeze({ type: "number", min: 0.02, max: 0.4, step: 0.01, value: 0.1 }),
  estB: Object.freeze({ type: "number", min: -0.6, max: 0.6, step: 0.01, value: 0.05 }),
  seB: Object.freeze({ type: "number", min: 0.02, max: 0.4, step: 0.01, value: 0.2 }),
  priorSd: Object.freeze({ type: "number", min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  tau: Object.freeze({ type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  priorMean: 0,
  ids: Object.freeze(["A", "B"]),
  chainRowMinWidth: 880,
  splitMinWidth: 520,
  rowMedia: "(min-width: 57.5em)",
  arrowColumn: "1.35rem",
  stageShares: Object.freeze([1, 1, 1, 1.05]),
  svgNs: "http://www.w3.org/2000/svg",
  pages: Object.freeze({
    league: Object.freeze({ app: "noisy-league", text: "Ranking noisy estimates" }),
    shrinkage: Object.freeze({ app: "shrinkage", text: "What a posterior adds" }),
    caseZero: Object.freeze({ app: "case-zero", text: "A league table and a report card" }),
    routes: Object.freeze({ part: "routes", text: "the table below" }),
    evaluation: Object.freeze({ app: "another-law", text: "Judging a report under another law" }),
    silence: Object.freeze({ app: "price-of-silence", text: "The best grades at τ", phrase: true }),
    budgets: Object.freeze({ app: "error-budgets", text: "A budget for each criterion", phrase: true }),
    exactCount: Object.freeze({ app: "families", text: "an exact number of grades", phrase: true }),
    worse: Object.freeze({ app: "worst-criterion", text: "guarding the worse criterion", phrase: true }),
    fragility: Object.freeze({ app: "mc-error", text: "Decisions that Monte Carlo noise could flip", phrase: true }),
    crossfit: Object.freeze({ app: "chosen-and-judged", text: "grades judged on draws that did not choose them", phrase: true }),
    ties: Object.freeze({ app: "ties-and-withholding", text: "True values that can be equal", phrase: true }),
  }),
  routesListBelow: 48,
  arrowViewBox: "0 0 32 16",
  arrowShapes: Object.freeze([
    Object.freeze({ tag: "path", cls: "shaft", d: "M2 8H22" }),
    Object.freeze({ tag: "path", cls: "head", d: "M21 3L30 8L21 13Z" }),
  ]),
  arrows: Object.freeze([
    Object.freeze({ label: "the analyst", postrank: false }),
    Object.freeze({ label: "the analyst's software", postrank: false }),
    Object.freeze({ label: "postrank", postrank: true }),
  ]),
  ownerShort: Object.freeze(["Data stage (analyst)", "Model stage (analyst)", "Posterior stage (supplied)", "Decision stage (postrank)"]),
  boxes: Object.freeze([
    Object.freeze({
      id: "data",
      name: "Data",
      tag: null,
      what: Object.freeze([
        Object.freeze({ tex: "Y" }),
        " is everything the analyst has when grading: the estimates, their standard errors and any other recorded data. Besides these, it can hold each unit's sample size and background facts about the units (covariates), such as a school's share of students in poverty, that a model can use.",
      ]),
      who: Object.freeze(["whoever collected the data. postrank never reads ", Object.freeze({ tex: "Y" }), " itself, only a posterior computed from it."]),
      example: Object.freeze([
        "In the simulated league of ", Object.freeze({ page: "league" }), ", ", Object.freeze({ tex: "Y" }),
        " holds each unit's estimate, its SE and its size, the number of observations behind the estimate.",
      ]),
      source: Object.freeze(["Theory book, Chapter 9, “Information and supplied selection beliefs”."]),
    }),
    Object.freeze({
      id: "model",
      name: "Model",
      tag: null,
      what: Object.freeze([
        "A model says how each estimate arises from its true value, and a prior says where true values usually lie. Empirical Bayes estimates the prior from all the units; hierarchical Bayes treats the prior's center and spread as unknown and gives them a prior of their own. The next arrow computes the posterior from model and prior, by a formula or by MCMC, a way to draw random samples from the posterior when no formula gives it.",
      ]),
      who: Object.freeze(["the analyst, who chooses the model and fits it with other software; postrank fits no model."]),
      example: Object.freeze([
        "On ", Object.freeze({ page: "shrinkage" }), " we set the prior SD by hand. Empirical Bayes would estimate it from the data, from how much more the estimates spread out than their standard errors alone explain. Kline, Rose and Walters (2024) estimate their prior from all their firms, and it is not a normal curve: it depends on each firm's SE.",
      ]),
      source: Object.freeze([
        "Package vignette ", Object.freeze({ em: "Strict inputs, declarations and external producers" }),
        " (postrank does not fit the underlying models); theory book, Chapter 9, “Information and supplied selection beliefs”.",
      ]),
    }),
    Object.freeze({
      id: "posterior",
      name: "Posterior",
      tag: "read by postrank",
      what: Object.freeze([
        "The posterior says how probable each possible combination of true values for all the units is, given ", Object.freeze({ tex: "Y" }),
        "; every probability computed from it is written ", Object.freeze({ tex: "\\Pr({\\cdot} \\mid Y)" }),
        ". It can be handed on in several forms. Among them are random draws of the true values, a normal distribution (its means and SDs), a list of combinations with their probabilities, and, for each pair of units, the probability that the first is above the second.",
      ]),
      who: Object.freeze(["the analyst, with other software, from the first two boxes. postrank starts here: it takes the posterior as given and checks the form of its input, such as unit names and sizes; whether the model is right stays with the analysis that made it."]),
      example: Object.freeze([
        "The package's tutorial object ", Object.freeze({ code: "pr_tutorial" }),
        " holds a normal posterior for six fictional sites, written down by hand: no observations and no fitted model. postrank grades it exactly as it would grade a posterior fitted to real data.",
      ]),
      more: Object.freeze([
        "The six input routes, with the package functions that read them, are in ", Object.freeze({ page: "routes" }),
        ". How to judge grades under a second distribution, other than the posterior that chose them, is the subject of ",
        Object.freeze({ page: "evaluation" }), ".",
      ]),
      source: Object.freeze([
        "Theory book, Chapter 9, “Information and supplied selection beliefs”; package vignette ",
        Object.freeze({ em: "Analysis of supplied posterior results" }), " (what a producer supplies).",
      ]),
    }),
    Object.freeze({
      id: "decision",
      name: "Decision",
      tag: "made by postrank",
      what: Object.freeze([
        "A grade report places each unit in exactly one grade and orders the grades: for two units in different grades the report says which is higher, and for two units in the same grade it does not say. postrank chooses the grades from the posterior in ",
        Object.freeze({ box: 3 }), " and from settings the analyst picks, such as what staying silent on a pair costs and how many grades are allowed.",
      ]),
      who: Object.freeze(["postrank. This is the postrank step: it takes ", Object.freeze({ box: 3 }), " as given and makes ", Object.freeze({ box: 4 }), "."]),
      example: Object.freeze([
        "The report cards of Kline, Rose and Walters (2024) on the page ", Object.freeze({ page: "caseZero" }),
        " are decisions of this kind: the firms that share a grade are not ordered against each other.",
      ]),
      source: Object.freeze([
        "Theory book, Chapter 9, “Grade actions and disclosed comparisons”; package vignette ",
        Object.freeze({ em: "Posterior ranking, grades, and loss" }), ".",
      ]),
    }),
  ]),
  chain: Object.freeze({
    domain: Object.freeze([-1, 1]),
    ticks: Object.freeze([-1, -0.5, 0, 0.5, 1]),
    costDomain: Object.freeze([0, 1]),
    costTicks: Object.freeze([0, 0.5, 1]),
    grid: 161,
    fine: 81,
    fineSds: 4,
    headroom: 1.32,
    margin: Object.freeze({ top: 10, bottom: 22, left: 22, right: 14 }),
    costMargin: Object.freeze({ top: 8, bottom: 22, left: 62, right: 16 }),
    height: Object.freeze({ data: 94, prior: 94, posterior: 94, decision: 96 }),
    heightStacked: Object.freeze({ data: 78, prior: 74, posterior: 84, decision: 88 }),
    rowY: Object.freeze({ A: 1, B: 0 }),
    rowDomain: Object.freeze([-0.75, 1.75]),
  }),
  routes: Object.freeze({
    columns: Object.freeze([
      Object.freeze({
        key: "weighted", label: Object.freeze([Object.freeze({ page: "silence" }), ", with a cap on the number of grades"]),
        detail: Object.freeze(["weighted risk with a grade cap"]), short: "the best grades at τ, with a cap",
      }),
      Object.freeze({
        key: "modes",
        label: Object.freeze([Object.freeze({ page: "budgets" }), ", ", Object.freeze({ page: "exactCount" }), ", ", Object.freeze({ page: "worse" })]),
        detail: Object.freeze(["error budgets, exact grade count, minimax"]), short: "budgets, an exact grade count, the worse criterion",
      }),
      Object.freeze({
        key: "draws", label: Object.freeze([Object.freeze({ page: "fragility" }), "; ", Object.freeze({ page: "crossfit" })]),
        detail: Object.freeze(["Monte Carlo fragility, cross-fitting"]), short: "Monte Carlo fragility and cross-fitting",
      }),
      Object.freeze({
        key: "ties", label: Object.freeze([Object.freeze({ page: "ties" })]),
        detail: Object.freeze(["tie-aware route, read by ", Object.freeze({ code: "as_postrank_tie_draws()" })]), short: "true values that can be equal",
      }),
    ]),
    rows: Object.freeze([
      Object.freeze({ form: "Joint draws", fn: "postrank_draws()", weighted: true, modes: true, draws: true, ties: true }),
      Object.freeze({ form: "Criterion-wise draws, one fit per criterion", fn: "postrank_draws(list(…), metadata = …)", weighted: true, modes: true, draws: false, ties: false }),
      Object.freeze({ form: "An exact finite law", fn: "as_postrank_draws()", weighted: true, modes: true, draws: false, ties: true }),
      Object.freeze({ form: "A normal law, units independent (means; covariances across criteria within a unit)", fn: "postrank_gaussian_coefficients()", weighted: true, modes: false, draws: false, ties: false }),
      Object.freeze({ form: "A normal mixture over a shared state", fn: "postrank_mixture_coefficients()", weighted: true, modes: false, draws: false, ties: false }),
      Object.freeze({ form: "Pair probabilities computed elsewhere", fn: "postrank_probabilities()", weighted: true, modes: false, draws: false, ties: false }),
    ]),
    notes: Object.freeze([
      Object.freeze(["Every route checks the form of its input, such as unit names, sizes and declarations, not that the draws are joint or have converged. Whether the posterior is the intended joint law, and whether the model behind it is right, stays with the analysis that made it."]),
      Object.freeze(["Pair probabilities are all the first column needs, but in general they do not fix the probability of an order on a weighted sum of the criteria, the chance that every stated direction is right, or the spread of the realized loss. Criterion-wise draws do not say how the criteria move together."]),
      Object.freeze(["For normal laws and normal mixtures, the package can also give an exact number of grades along one score order.", Object.freeze({ fn: "postrank_cuts()" })]),
    ]),
  }),
  text: Object.freeze({
    diagram: "The four boxes, from data to a decision",
    box: "Box",
    boxWord: "box",
    leadsTo: "leads to",
    describe: "Four boxes joined by three arrows, in order: Data (Y), Model (a prior for the true values), Posterior (the posterior of the true values given Y) and Decision (grades). Press a box to open its explanation below the boxes. The first two arrows, choosing and fitting the model and computing the posterior, are the analyst's work, done outside postrank and before it; postrank computes only the third arrow: it reads the posterior and makes the grades. A dashed frame holds the two boxes postrank touches.",
    who: "Who makes this box: ",
    example: "Example. ",
    more: "See also. ",
    source: "Source: ",
    presetNote: "A preset sets the chain's sliders as well as the open box; the box buttons below open a box and leave the sliders as they are.",
    panel: "Explanation of the open box",
    stageLabel: "Two units in box",
    estA: "Estimate of A",
    seA: "SE of A",
    estB: "Estimate of B",
    seB: "SE of B",
    priorSd: "Prior SD",
    tau: "Withholding cost τ",
    dataNote: Object.freeze(["Estimates ± ", Object.freeze({ num: "one" }), " SE"]),
    priorNote: Object.freeze(["Shared normal prior, mean ", Object.freeze({ num: "priorMean" })]),
    keepNote: "Each posterior mean keeps the share prior SD² ÷ (prior SD² + SE²) of its estimate.",
    dataAlt: "The two estimates as dots, each with a bar of plus and minus one SE, on one axis of values.",
    priorAlt: "The prior for the true values: a normal curve centered at 0, drawn dashed.",
    posteriorAlt: "The two posteriors: a normal curve for A's true value (solid) and one for B's (dashed), on the same axis.",
    decisionAlt: "Expected costs of the three candidate reports for A and B against the withholding threshold tau.",
    unitsTitle: "Unit posteriors and exact values",
    reportsTitle: "The three reports of two units",
    costNote: "A stated direction costs its chance of being wrong; one grade, which states no direction, costs τ.",
    reportCol: "Report",
    costCol: "Cost",
    lowest: "lowest",
    rule: Object.freeze(["For an isolated pair, disclose only when the posterior probability of the direction exceeds ", Object.freeze({ num: "one" }), "\u00a0−\u00a0τ."]),
    chosen: "The best report",
    gradeOne: "Grade 1 = stated highest on the true value, as the posterior judges it.",
    scrollCue: "The table scrolls sideways.",
    dataTitle: "Data and exact values",
    routesTitle: "What postrank can do with each form of posterior",
    boxesTitle: "What each box holds and who makes it",
    othersLabel: "The other boxes",
    routesCaption: "Forms of a supplied posterior, the package function that reads each, and the problems postrank builds from it",
    formCol: "Form of the posterior",
    yes: "yes",
    no: "no",
    listYes: "Yes: ",
    listNo: "No: ",
    gloss: "The Data and Model boxes supply the estimates, standard errors, and prior used to calculate the posterior.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chain;
const KEYS = Object.freeze({
  box: CONFIG.box, estA: CONFIG.estA, seA: CONFIG.seA, estB: CONFIG.estB, seB: CONFIG.seB, priorSd: CONFIG.priorSd, tau: CONFIG.tau,
});

/** The box entry (1-based index, clamped). */
export const boxAt = (k) => CONFIG.boxes[Math.min(CONFIG.box.max, Math.max(CONFIG.box.min, Math.round(k))) - 1];

/**
 * The two-unit chain from its settings: the normal posterior of each unit (prior mean 0), the probability that A is
 * truly higher, the errors of the two directions, the costs of the three actions at τ, and the best report of the
 * three reports of two units. Every number comes from the engine.
 */
export function computeChain({ estA, seA, estB, seB, priorSd, tau }) {
  const post = normalPosterior([estA, estB], [seA, seB], { priorMean: CONFIG.priorMean, priorSd });
  const pi = pairDirection(post.mean[0], post.sd[0], post.mean[1], post.sd[1]);
  const E = errorArray(post.mean, post.sd, { ids: CONFIG.ids.slice() });
  const eAB = E.e[0][0][1];
  const eBA = E.e[0][1][0];
  const decision = pairDecision(eAB, eBA, tau);
  const best = exactOptimum(E, { tau, family: { kind: "all" } });
  return { post, pi, E, eAB, eBA, decision, best };
}

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** A normal density over the axis, sampled on a fixed grid plus a fine grid around its mean. */
function curve(mean, sd) {
  const [a, b] = C.domain;
  const xs = range(C.grid, (i) => a + ((b - a) * i) / (C.grid - 1));
  const lo = Math.max(a, mean - C.fineSds * sd);
  const hi = Math.min(b, mean + C.fineSds * sd);
  if (hi > lo) for (let i = 0; i < C.fine; i += 1) xs.push(lo + ((hi - lo) * i) / (C.fine - 1));
  xs.sort((p, q) => p - q);
  return xs.map((x) => ({ x, y: normalPdf((x - mean) / sd) / sd }));
}
const peakOf = (sd) => normalPdf(0) / sd;

const CSS = `
.prx-pp .prx-pp-preset-note { flex: 1 1 100%; margin: 0.1rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); }
@media (max-width: 30em) {
  .prx-pp .prx-toolbar > .prx-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.35rem 0.65rem; width: 100%; }
}

/* --- the chain: four stages headed by the four box buttons, joined by three arrows --- */
.prx-pp .prx-stage { padding: 0.55rem 0.6rem; }
.prx-pp .prx-pp-flow { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; align-items: stretch; }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow { grid-template-columns: ${CONFIG.stageShares.map((f) => `minmax(0, ${f}fr)`).join(` ${CONFIG.arrowColumn} `)}; grid-template-rows: auto 1fr; } }
.prx-pp .prx-pp-flow > * { grid-column: 1; }
.prx-pp .prx-pp-flow > [data-prx-stage="1"] { grid-row: 1; }
.prx-pp .prx-pp-flow > [data-prx-arrow="1"] { grid-row: 2; }
.prx-pp .prx-pp-flow > [data-prx-stage="2"] { grid-row: 3; }
.prx-pp .prx-pp-flow > [data-prx-arrow="2"] { grid-row: 4; }
.prx-pp .prx-pp-flow > [data-prx-stage="3"] { grid-row: 5; }
.prx-pp .prx-pp-flow > [data-prx-arrow="3"] { grid-row: 6; }
.prx-pp .prx-pp-flow > [data-prx-stage="4"] { grid-row: 7; }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > * { grid-row: 1; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > .prx-pp-stage { grid-row: 1 / 3; display: grid; grid-template-rows: subgrid; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-box { align-content: center; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="1"] { grid-column: 1; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="1"] { grid-column: 2; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="2"] { grid-column: 3; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="2"] { grid-column: 4; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="3"] { grid-column: 5; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="3"] { grid-column: 6; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="4"] { grid-column: 7; } }
/* the part postrank touches: a dashed frame around stage 3, the third arrow and stage 4 */
.prx-pp .prx-pp-flow > .prx-pp-band { grid-column: 1; grid-row: 5 / 8; margin: -0.25rem; border: 2px dashed var(--prx-fg-heading); border-radius: calc(var(--prx-radius, 6px) + 3px); pointer-events: none; }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > .prx-pp-band { grid-column: 5 / 8; grid-row: 1 / 3; } }

/* stage card & compact 1-line box header */
.prx-pp .prx-pp-stage { display: flex; flex-direction: column; min-width: 0; background: var(--prx-bg); border: 1px solid var(--prx-border-strong); border-radius: var(--prx-radius, 6px); }
.prx-pp .prx-pp-stage[data-open] { border-color: #17645E; box-shadow: 0 0 0 1px #17645E; }
.prx-pp .prx-pp-box { display: flex; flex-wrap: wrap; gap: 0.15rem 0.45rem; align-items: center; justify-content: space-between; width: 100%; min-height: 2.3rem; margin: 0; padding: 0.3rem 0.45rem; font: inherit; line-height: 1.25; text-align: left; color: var(--prx-fg); background: transparent; border: 0; border-bottom: 1px solid var(--prx-border); border-radius: calc(var(--prx-radius, 6px) - 1px) calc(var(--prx-radius, 6px) - 1px) 0 0; cursor: pointer; transition: background-color 0.15s ease; }
@media (pointer: coarse), (max-width: 48em) { .prx-pp .prx-pp-box { min-height: var(--prx-touch-target, 2.75rem); } }
.prx-pp .prx-pp-box:hover, .prx-pp .prx-pp-box[aria-pressed="true"] { background: var(--prx-bg-sunken); }
.prx-pp .prx-pp-num { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 1.4rem; height: 1.4rem; font-size: 0.85em; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--prx-fg-heading); border: 1px solid var(--prx-border-strong); border-radius: 50%; }
.prx-pp .prx-pp-box[aria-pressed="true"] .prx-pp-num { color: #ffffff; background: #17645E; border-color: #17645E; }
.prx-pp .prx-pp-head { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; }
.prx-pp .prx-pp-name { flex: none; font-weight: 700; white-space: nowrap; color: var(--prx-fg-heading); }
.prx-pp .prx-pp-by, .prx-pp .prx-pp-tag { min-width: 0; font-size: 0.8em; }
.prx-pp .prx-pp-by { color: var(--prx-fg-muted); }
.prx-pp .prx-pp-tag { font-weight: 700; color: var(--prx-fg-heading); }

/* arrows between stages */
.prx-pp .prx-pp-arrow { display: flex; align-items: center; min-height: 0.95rem; padding: 0 0 0 0.55rem; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-arrow-svg { display: block; flex: none; width: 1rem; height: 0.52rem; overflow: visible; transform: rotate(90deg); }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > .prx-pp-arrow { justify-content: center; align-self: start; min-height: 0; margin-top: 0.85rem; padding: 0; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-arrow-svg { width: 1.2rem; height: 0.6rem; transform: none; } }
.prx-pp .prx-pp-arrow-svg .prx-pp-g-shaft { fill: none; stroke: currentColor; stroke-width: 2; }
.prx-pp .prx-pp-arrow-svg .prx-pp-g-head { fill: currentColor; stroke: none; }
.prx-pp .prx-pp-arrow-postrank { color: var(--prx-fg-heading); }
.prx-pp .prx-pp-arrow-postrank .prx-pp-g-shaft { stroke-width: 3.6; }

/* concise stage body: mini-chart + 1 key-number / chip line */
.prx-pp .prx-pp-stage-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem; align-content: start; min-width: 0; padding: 0.3rem 0.38rem 0.4rem; }
.prx-pp[data-prx-pp-split] .prx-pp-stage-body { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 0.35rem 0.9rem; align-items: center; }
.prx-pp .prx-pp-fig { min-width: 0; }
.prx-pp .prx-pp-metric { margin: 0; font-size: 0.84em; line-height: 1.3; font-variant-numeric: tabular-nums; color: var(--prx-fg); }
.prx-pp .prx-pp-metric math { margin: 0; }
.prx-pp .prx-pp-best { display: flex; flex-wrap: wrap; gap: 0.2rem 0.45rem; align-items: center; min-width: 0; }
.prx-pp .prx-pp-best > .prx-pp-note { flex: 1 1 6rem; min-width: 0; margin: 0; font-size: 0.8125rem; line-height: 1.3; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-report { display: inline-flex; flex-wrap: wrap; flex: none; align-items: center; gap: 0.25rem; margin: 0; padding: 0.15rem 0.25rem; border-radius: 4px; }
.prx-pp .prx-pp-chip { display: inline-flex; flex-direction: column; align-items: center; min-width: 2.35rem; padding: 0.08rem 0.38rem; border-radius: 5px; }
.prx-pp .prx-pp-chip-units { font-size: 0.95rem; font-weight: 700; letter-spacing: 0.05em; line-height: 1.15; }
.prx-pp .prx-pp-chip-grade { font-size: 0.7rem; line-height: 1.15; }
.prx-pp .prx-stage .prx-pp-gt { font-weight: 700; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-blocks { font-weight: 700; color: var(--prx-fg-heading); }

/* Data disclosure tables & notes */
.prx-pp .prx-pp-data-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 0.75rem 1.25rem; align-items: start; }
.prx-pp .prx-pp-units, .prx-pp .prx-pp-costs { width: 100%; border-collapse: collapse; font-size: 0.88em; font-variant-numeric: tabular-nums; }
.prx-pp .prx-pp-units caption, .prx-pp .prx-pp-costs caption { caption-side: top; margin: 0 0 0.2rem; padding: 0; font-weight: 700; text-align: left; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-units th, .prx-pp .prx-pp-units td, .prx-pp .prx-pp-costs th, .prx-pp .prx-pp-costs td { padding: 0.2rem 0.35rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); }
.prx-pp .prx-pp-units thead th, .prx-pp .prx-pp-costs thead th { font-weight: 600; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-costs tr[data-best] th, .prx-pp .prx-pp-costs tr[data-best] td { font-weight: 700; }
.prx-pp .prx-pp-badge { display: inline-block; margin-left: 0.3rem; padding: 0 0.3rem; font-size: 0.85em; font-weight: 700; color: var(--prx-on-accent); background: var(--prx-accent); border-radius: 3px; }
.prx-pp .prx-pp-note { margin: 0.25rem 0 0; font-size: 0.84em; line-height: 1.35; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-chain-caption { margin: 0.45rem 0 0; font-size: 0.82em; line-height: 1.35; color: var(--prx-fg-muted); }

/* closed box of the four stage explanations */
.prx-pp .prx-pp-panel, .prx-pp .prx-pp-other { margin: 0; padding: 0.6rem 0.75rem; background: var(--prx-bg); border: 1px solid var(--prx-border); border-left: 4px solid var(--prx-accent); border-radius: var(--prx-radius, 6px); }
.prx-pp .prx-pp-other { border-left-color: var(--prx-border-strong); }
.prx-pp .prx-pp-others { display: grid; gap: 0.5rem; margin: 0.5rem 0 0; }
.prx-pp .prx-pp-panel p, .prx-pp .prx-pp-other p { margin: 0.4rem 0 0; }
.prx-pp .prx-pp-panel .prx-pp-title, .prx-pp .prx-pp-other .prx-pp-title { margin: 0; font-weight: 700; color: var(--prx-fg-heading); }
.prx-pp .prx-pp-example, .prx-pp .prx-pp-more, .prx-pp .prx-pp-source { font-size: 0.92em; }
.prx-pp .prx-pp-source { color: var(--prx-fg-muted); }
.prx-pp a { color: var(--prx-link); }
.prx-pp a:hover, .prx-pp a:focus-visible { color: var(--prx-link-hover); }
.prx-pp code { font-family: var(--prx-font-mono); font-size: 0.95em; color: inherit; background: var(--prx-bg-sunken); padding: 0 0.2em; border-radius: 3px; }

/* closed box of the forms of a posterior (table or narrow list) */
.prx-pp .prx-pp-routes { margin: 0; container-type: inline-size; }
.prx-pp .prx-pp-routes-box { overflow-x: auto; margin: 0.3rem 0 0; }
.prx-pp .prx-pp-routes table { min-width: ${CONFIG.routesListBelow}rem; width: 100%; border-collapse: collapse; font-size: 0.85em; }
.prx-pp .prx-pp-routes thead th:first-child { width: 30%; }
.prx-pp .prx-pp-routes .prx-pp-detail, .prx-pp .prx-pp-routes .prx-pp-fn { display: block; margin: 0.1rem 0 0; font-size: 0.88em; font-weight: 400; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-routes-list { display: none; margin: 0.3rem 0 0; padding: 0; list-style: none; font-size: 0.88em; }
.prx-pp .prx-pp-routes-list > li { margin: 0; padding: 0.35rem 0; border-bottom: 1px solid var(--prx-border); }
.prx-pp .prx-pp-routes-list > li > span { display: block; }
.prx-pp .prx-pp-routes-list .prx-pp-routes-no { color: var(--prx-fg-muted); }
@container (max-width: ${CONFIG.routesListBelow}rem) {
  .prx-pp .prx-pp-routes-box, .prx-pp .prx-pp-scroll-cue { display: none; }
  .prx-pp .prx-pp-routes-list { display: block; }
}
.prx-pp .prx-pp-routes caption { caption-side: top; margin: 0 0 0.2rem; padding: 0; text-align: left; font-size: 0.95em; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-routes th, .prx-pp .prx-pp-routes td { padding: 0.2rem 0.45rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); }
.prx-pp .prx-pp-routes thead th { font-weight: 600; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-routes td[data-yes] { font-weight: 700; }
.prx-pp .prx-pp-routes td[data-no] { color: var(--prx-fg-muted); }
.prx-pp .prx-pp-routes tbody th code, .prx-pp .prx-pp-routes thead code { white-space: nowrap; overflow-wrap: normal; }
.prx-pp .prx-pp-scroll-cue { margin: 0.2rem 0 0; font-size: 0.8em; font-style: italic; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-routes-notes { margin: 0.4rem 0 0; padding-left: 1.1rem; font-size: 0.88em; }
.prx-pp .prx-pp-routes-notes li { margin: 0.2rem 0 0; }
.prx-pp .prx-pp-routes-source { margin: 0.35rem 0 0; font-size: 0.82em; color: var(--prx-fg-muted); }
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: CONFIG.className,
    css: CSS,
    frame: "v2",
    keys: KEYS,
    build(ctx) {
      const { h, doc } = ctx;
      const w = ro(ctx);
      const links = linkRoot(doc);
      const routesId = uid("prx-pp-routes");
      const panelId = uid("prx-pp-panel");

      // Disclosures: Data (exact values & report costs), Boxes (all four stage explanations), Routes (input capability matrix)
      const dataBox = ctx.dataBox(T.dataTitle);
      const boxesBox = ctx.disclosure({ name: "boxes", title: T.boxesTitle });
      const routesBox = ctx.disclosure({ name: "routes", title: T.routesTitle });

      const math = (tex) => {
        const span = h("span", { class: "prx-pp-math" });
        renderTex(span, tex);
        return span;
      };
      const pageLink = (key) => {
        const p = CONFIG.pages[key];
        if (p.part) return h("a", { href: `#${routesId}`, class: "prx-pp-page", onClick: () => { routesBox.open = true; } }, p.text);
        const path = builtPage(p.app);
        if (!links || !path) return h("span", { class: "prx-pp-page" }, p.phrase ? p.text : `“${p.text}”`);
        return h("a", {
          href: `${links.root}${path}`, class: "prx-pp-page",
          target: links.newTab ? "_blank" : undefined, rel: links.newTab ? "noopener" : undefined,
        }, p.text);
      };
      const rich = (list) => [].concat(list).map((p) => {
        if (typeof p === "string") return p;
        if (p.tex !== undefined) return math(p.tex);
        if (p.page !== undefined) return pageLink(p.page);
        if (p.box !== undefined) return h("span", { "data-prx-name": "" }, `${T.boxWord} ${p.box}`);
        if (p.code !== undefined) return h("code", { text: p.code });
        if (p.fn !== undefined) return h("span", { class: "prx-pp-fn" }, h("code", { text: p.fn }));
        if (p.em !== undefined) return h("em", { text: p.em });
        if (p.num !== undefined) {
          const v = p.num === "priorMean" ? CONFIG.priorMean : 1;
          return w.setting(v);
        }
        return "";
      });
      const svg = (viewBox, shapes, cls) => {
        const s = doc.createElementNS(CONFIG.svgNs, "svg");
        s.setAttribute("viewBox", viewBox);
        s.setAttribute("class", cls);
        s.setAttribute("aria-hidden", "true");
        s.setAttribute("focusable", "false");
        for (const shape of shapes) {
          const n = doc.createElementNS(CONFIG.svgNs, shape.tag);
          for (const [k, v] of Object.entries(shape)) {
            if (k === "tag") continue;
            n.setAttribute(k === "cls" ? "class" : k, k === "cls" ? `prx-pp-g-${v}` : String(v));
          }
          s.append(n);
        }
        return s;
      };
      const boxName = (k) => h("span", { "data-prx-name": "" }, `${T.box} ${k}`);
      const numCircle = (k) => h("span", { class: "prx-pp-num", "aria-hidden": "true" }, h("span", { "data-prx-name": "" }, String(k)));
      const arrowNode = (a, i) => h("span", {
        class: `prx-pp-arrow${a.postrank ? " prx-pp-arrow-postrank" : ""}`, "data-prx-arrow": String(i + 1),
      }, svg(CONFIG.arrowViewBox, CONFIG.arrowShapes, "prx-pp-arrow-svg"),
      h("span", { class: "prx-sr-only", text: T.leadsTo }), h("span", { class: "prx-pp-arrow-label prx-sr-only", text: a.label }));

      // --- Toolbar controls: Prior SD + Withholding cost τ primary; unit A/B estimates & SEs in Settings
      const makeSlider = (key, label) => ctx.slider({ label, ...ctx.key(key), format: (v) => formatSetting(v), onInput: (v) => ctx.set({ [key]: v }) });
      const sl = {
        priorSd: makeSlider("priorSd", T.priorSd),
        tau: makeSlider("tau", T.tau),
        estA: makeSlider("estA", T.estA),
        seA: makeSlider("seA", T.seA),
        estB: makeSlider("estB", T.estB),
        seB: makeSlider("seB", T.seB),
      };
      ctx.primaryControl(sl.priorSd.root);
      ctx.controls.append(sl.priorSd.root, sl.tau.root);
      const presetNote = h("p", { class: "prx-pp-preset-note", text: T.presetNote });
      const settingsBox = ctx.settingsBox();
      settingsBox.body.append(sl.estA.root, sl.seA.root, sl.estB.root, sl.seB.root, presetNote);

      // --- Screen-reader description directly inside [data-prx-part="chart"]
      const describeId = uid("prx-pp-desc");
      const description = h("p", { id: describeId, class: "prx-sr-only", text: T.describe });

      // --- Boxes disclosure: open box first (with aria-live region), then the other three in box order
      const live = h("div", { class: "prx-pp-live", "aria-live": "polite", "aria-atomic": "true", "data-prx-part": "readout" });
      const rest = h("div", { class: "prx-pp-rest" });
      const panel = ctx.part("notes", h("div", { class: "prx-pp-panel", id: panelId, role: "region", "aria-label": T.panel, "aria-current": "true" },
        live, rest));
      const others = h("div", { class: "prx-pp-others", role: "group", "aria-label": T.othersLabel });
      boxesBox.body.append(panel, others);

      // --- Four linked stages on ctx.stage
      const figs = {
        data: h("div", { class: "prx-pp-fig" }),
        prior: h("div", { class: "prx-pp-fig" }),
        posterior: h("div", { class: "prx-pp-fig" }),
        decision: h("div", { class: "prx-pp-fig" }),
      };
      const transition = h("p", { class: "prx-pp-note", "data-prx-evidence": "pipeline-transition" });
      const dataMetric = h("p", { class: "prx-pp-metric" });
      const priorMetric = h("p", { class: "prx-pp-metric" });
      const postMetric = h("p", { class: "prx-pp-metric" });
      const reportLine = h("div", { class: "prx-pp-report prx-light-panel", role: "group", "aria-label": T.chosen });
      const tagLine = h("p", { class: "prx-pp-note" });

      let pressSeq = 0;
      let alive = true;
      ctx.onCleanup(() => { alive = false; });
      const afterPaint = (fn) => {
        const raf = typeof ctx.win.requestAnimationFrame === "function" ? ctx.win.requestAnimationFrame.bind(ctx.win) : null;
        if (raf) raf(() => raf(fn)); else ctx.timeout(fn, 0);
      };
      const reveal = () => {
        if (typeof panel.scrollIntoView !== "function") return;
        const bottom = panel.getBoundingClientRect().bottom;
        if (bottom > (ctx.win.innerHeight || ctx.doc.documentElement.clientHeight || Infinity)) {
          panel.scrollIntoView({ block: "nearest", behavior: ctx.reducedMotion ? "auto" : "smooth" });
        }
      };
      function press(k, pointer) {
        const seq = (pressSeq += 1);
        const show = () => {
          if (!alive || seq !== pressSeq) return;
          ctx.set({ box: k });
          if (pointer) reveal();
        };
        if (boxesBox.open) show();
        else { boxesBox.open = true; afterPaint(show); }
      }

      const header = (b, k) => h("button", {
        type: "button", class: `prx-pp-box prx-pp-box-${b.id}`, "aria-pressed": "false",
        "aria-label": `${T.box} ${k}: ${b.name}${b.tag ? `, ${b.tag}` : ""}`, "aria-controls": panelId,
        "data-prx-focus-key": `box:${k}`, "data-prx-box": String(k),
        onClick: (e) => press(k, e.detail > 0),
      },
      h("span", { class: "prx-pp-head" }, numCircle(k), h("span", { class: "prx-pp-name", text: b.name })),
      b.tag ? h("span", { class: "prx-pp-tag", text: b.tag }) : h("span", { class: "prx-pp-by", text: CONFIG.arrows[k - 1].label }));

      const makeStage = (k, ...body) => {
        const b = CONFIG.boxes[k - 1];
        const node = header(b, k);
        const sec = h("section", { class: "prx-pp-stage", "data-prx-stage": String(k), "aria-label": `${T.stageLabel} ${k}: ${b.name}` },
          node, h("div", { class: "prx-pp-stage-body" }, ...body));
        return { b, k, node, sec };
      };

      const stages = [
        makeStage(1, figs.data, dataMetric),
        makeStage(2, figs.prior, priorMetric),
        makeStage(3, figs.posterior, postMetric),
        makeStage(4, figs.decision, h("div", { class: "prx-pp-best" }, reportLine, tagLine)),
      ];
      const arrows = CONFIG.arrows.map((a, i) => arrowNode(a, i));
      const band = h("span", { class: "prx-pp-band", "aria-hidden": "true" });
      const flow = ctx.primaryGraphic(h("div", { class: "prx-pp-flow", role: "group", "aria-label": T.diagram, "aria-describedby": describeId },
        band, ...stages.flatMap((s, i) => (i < arrows.length ? [s.sec, arrows[i]] : [s.sec]))));
      ctx.stage.classList.add("prx-pp-charts");
      ctx.stage.append(description, flow);

      // --- Data disclosure: exact 2-unit posterior table, 3-report cost table, formulas and scope caption
      const unitBody = h("tbody");
      const costBody = h("tbody");
      const chainCaption = h("p", { class: "prx-pp-chain-caption" }, captionNode(ctx, "teaching-posterior"), ". ", T.gloss);
      dataBox.body.append(
        h("div", { class: "prx-pp-data-grid" },
          h("div", {},
            h("table", { class: "prx-pp-units" },
              h("caption", { text: T.unitsTitle }),
              h("thead", {}, h("tr", {},
                h("th", { scope: "col", text: "Unit" }),
                h("th", { scope: "col", text: "Estimate" }),
                h("th", { scope: "col", text: "SE" }),
                h("th", { scope: "col", text: "Kept share" }),
                h("th", { scope: "col", text: "Post. mean" }),
                h("th", { scope: "col", text: "Post. SD" }),
              )),
              unitBody,
            ),
            h("p", { class: "prx-pp-note", text: T.keepNote }),
          ),
          h("div", {},
            h("table", { class: "prx-pp-costs" },
              h("caption", { text: T.reportsTitle }),
              h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.reportCol }), h("th", { scope: "col", text: T.costCol }))),
              costBody,
            ),
            h("p", { class: "prx-pp-note", text: T.costNote }),
            h("p", { class: "prx-pp-note", text: T.gradeOne }),
            h("p", { class: "prx-pp-note" }, ...rich(T.rule)),
          ),
        ),
        chainCaption,
      );

      // --- Routes disclosure (static capability matrix & narrow list)
      const R = CONFIG.routes;
      const routesTable = h("table", {},
        h("caption", { class: "prx-sr-only", text: T.routesCaption }),
        h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.formCol }),
          ...R.columns.map((c) => h("th", { scope: "col" }, ...rich(c.label), h("span", { class: "prx-pp-detail" }, ...rich(c.detail)))))),
        h("tbody", {}, ...R.rows.map((r) => h("tr", {},
          h("th", { scope: "row" }, r.form, ...rich({ fn: r.fn })),
          ...R.columns.map((c) => h("td", { "data-yes": r[c.key] ? "" : undefined, "data-no": r[c.key] ? undefined : "" }, r[c.key] ? T.yes : T.no))))));
      const routesScroll = ctx.scrollRegion(h("div", { class: "prx-pp-routes-box" }, routesTable), T.routesCaption);
      const scrollCue = h("p", { class: "prx-pp-scroll-cue", text: T.scrollCue, hidden: true });
      const routesList = h("ul", { class: "prx-pp-routes-list", "aria-label": T.routesCaption },
        ...R.rows.map((r) => {
          const yes = R.columns.filter((c) => r[c.key]).map((c) => c.short);
          const no = R.columns.filter((c) => !r[c.key]).map((c) => c.short);
          return h("li", {}, h("strong", { text: r.form }), ...rich({ fn: r.fn }),
            h("span", { class: "prx-pp-routes-yes" }, `${T.listYes}${yes.join("; ")}.`),
            no.length ? h("span", { class: "prx-pp-routes-no" }, `${T.listNo}${no.join("; ")}.`) : null);
        }));
      routesBox.body.append(ctx.part("notes", h("section", { class: "prx-pp-routes", id: routesId, "aria-label": T.routesTitle },
        routesScroll, scrollCue, routesList,
        h("ul", { class: "prx-pp-routes-notes" }, ...R.notes.map((n) => h("li", {}, ...rich(n)))),
        h("p", { class: "prx-pp-routes-source" }, "Source: the postrank package, ", h("code", { text: "postrank_problem()" }), ", ",
          h("code", { text: "postrank_coefficient_capabilities()" }), " and ", h("code", { text: "postrank_tie_capabilities()" }),
          "; package vignettes ", h("em", { text: "Posterior inputs and pairwise probabilities" }), " and ",
          h("em", { text: "Strict inputs, declarations and external producers" }), "; theory book, Chapter 9, “Information and supplied selection beliefs”."))));

      // --- Responsive row vs column layout (B-F3)
      const rowMql = typeof ctx.win.matchMedia === "function" ? ctx.win.matchMedia(CONFIG.rowMedia) : null;
      const layout = (width) => {
        const row = width >= CONFIG.chainRowMinWidth && (rowMql?.matches ?? true);
        ctx.root.setAttribute("data-prx-pp-chain", row ? "row" : "column");
        ctx.root.toggleAttribute("data-prx-pp-split", !row && width >= CONFIG.splitMinWidth);
        scrollCue.hidden = !(routesScroll.scrollWidth > routesScroll.clientWidth + 1);
      };

      // --- Box explanation panel writer
      const heads = (x, k) => [
        h("p", { class: "prx-pp-title", role: "heading", "aria-level": "4" }, boxName(k), `: ${x.name}`),
        h("p", { class: "prx-pp-what" }, ...rich(x.what)),
        h("p", { class: "prx-pp-who" }, h("strong", { text: T.who }), ...rich(x.who)),
      ];
      const tail = (x) => [
        h("p", { class: "prx-pp-example" }, h("strong", { text: T.example }), ...rich(x.example)),
        x.more ? h("p", { class: "prx-pp-more" }, h("strong", { text: T.more }), ...rich(x.more)) : null,
        h("p", { class: "prx-pp-source" }, h("strong", { text: T.source }), ...rich(x.source)),
      ];
      function drawPanel(k) {
        const x = boxAt(k);
        const open = CONFIG.boxes.indexOf(x) + 1;
        panel.setAttribute("data-prx-box-text", String(open));
        live.replaceChildren(...heads(x, open));
        rest.replaceChildren(...tail(x).filter(Boolean));
        others.replaceChildren(...CONFIG.boxes.map((b, i) => i + 1).filter((j) => j !== open).map((j) => {
          const y = boxAt(j);
          return h("div", { class: "prx-pp-other", "data-prx-box-text": String(j) }, ...heads(y, j), ...tail(y).filter(Boolean));
        }));
      }

      const common = { marginTop: C.margin.top, marginBottom: C.margin.bottom, marginLeft: C.margin.left, marginRight: C.margin.right };
      const xAxis = { domain: C.domain.slice(), ticks: C.ticks.slice(), label: null };
      const heights = () => (ctx.root.getAttribute("data-prx-pp-chain") === "row" ? C.height : C.heightStacked);
      const figWidth = (node) => {
        const measured = Math.round(node.clientWidth || node.getBoundingClientRect?.().width || 0);
        return measured > 0 ? Math.max(150, measured) : 0;
      };
      const widthOpt = (node) => {
        const fw = figWidth(node);
        return fw > 0 ? { width: fw } : {};
      };

      function drawData(state) {
        const rows = [
          { id: "A", est: state.estA, se: state.seA, y: C.rowY.A },
          { id: "B", est: state.estB, se: state.seB, y: C.rowY.B },
        ];
        plot(figs.data, {
          alt: T.dataAlt, ...common, ...widthOpt(figs.data), height: heights().data, x: xAxis, y: { axis: null, domain: C.rowDomain.slice() },
          marks: (c, P) => [
            P.ruleX([0], { stroke: c.plotGrid }),
            P.link(rows, { x1: (d) => d.est - d.se, x2: (d) => d.est + d.se, y1: "y", y2: "y", stroke: c.est, strokeWidth: 2.5, strokeLinecap: "round", clip: true }),
            P.dot(rows, { x: "est", y: "y", r: 4.5, fill: c.est, clip: true }),
            P.text(rows, { x: C.domain[0], y: "y", text: "id", dx: -7, textAnchor: "end", fill: c.plotFg, fontWeight: 700, fontSize: 13 }),
          ],
        });
      }

      function drawPrior(state) {
        const pts = curve(CONFIG.priorMean, state.priorSd);
        const top = peakOf(state.priorSd);
        plot(figs.prior, {
          alt: T.priorAlt, ...common, ...widthOpt(figs.prior), height: heights().prior, x: xAxis, y: { axis: null, domain: [0, top * C.headroom] },
          marks: (c, P) => [
            P.areaY(pts, { x: "x", y: "y", fill: c.plotMuted, fillOpacity: 0.1, clip: true }),
            P.line(pts, { x: "x", y: "y", stroke: c.plotMuted, strokeWidth: 2, strokeDasharray: "4 2", clip: true }),
            P.ruleY([0], { stroke: c.plotAxis }),
          ],
        });
      }

      function drawPosterior(r) {
        const m = r.post.mean;
        const s = r.post.sd;
        const A = curve(m[0], s[0]);
        const B = curve(m[1], s[1]);
        const top = Math.max(peakOf(s[0]), peakOf(s[1]));
        const right = m[0] >= m[1] ? 1 : -1;
        const clampX = (x) => Math.min(0.84, Math.max(-0.84, x));
        const names = [
          { x: clampX(m[0]), y: peakOf(s[0]), t: "A", side: right },
          { x: clampX(m[1]), y: peakOf(s[1]), t: "B", side: -right },
        ];
        plot(figs.posterior, {
          alt: T.posteriorAlt, ...common, ...widthOpt(figs.posterior), height: heights().posterior, x: xAxis, y: { axis: null, domain: [0, top * C.headroom] },
          marks: (c, P) => [
            P.areaY(A, { x: "x", y: "y", fill: c.post, fillOpacity: 0.16, clip: true }),
            P.line(A, { x: "x", y: "y", stroke: c.post, strokeWidth: 2.2, clip: true }),
            P.line(B, { x: "x", y: "y", stroke: c.post, strokeWidth: 2, strokeDasharray: "6 4", clip: true }),
            ...[1, -1].map((side) => P.text(names.filter((d) => d.side === side), {
              x: "x", y: "y", text: "t", dx: 7 * side, dy: -5, textAnchor: side > 0 ? "start" : "end",
              fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", fontWeight: 700, fontSize: 13,
            })),
            P.ruleY([0], { stroke: c.plotAxis }),
          ],
        });
      }

      /** "{A} > {B}" for a grade vector of the two units. */
      const blocksOf = (grade) => {
        const G = Math.max(...grade);
        return range(G, (g) => CONFIG.ids.filter((_, i) => grade[i] === g + 1));
      };
      const blocksText = (grade) => blocksOf(grade).map((b) => `{${b.join(", ")}}`).join(" > ");

      function drawDecisionChart(state, r) {
        const { decision } = r;
        const domainLabels = ["{A} > {B}", "{B} > {A}", "{A, B}"];
        const fw = figWidth(figs.decision);
        const wPx = fw > 0 ? fw : 640;
        const plotW = Math.max(80, wPx - C.costMargin.left - C.costMargin.right);
        const perPx = 1 / plotW;
        const tauX = state.tau;
        const rawRows = [
          { label: domainLabels[0], cost: decision.costs.iAboveJ, best: decision.best.includes("iAboveJ"), isTau: false },
          { label: domainLabels[1], cost: decision.costs.jAboveI, best: decision.best.includes("jAboveI"), isTau: false },
          { label: domainLabels[2], cost: decision.costs.withhold, best: decision.best.includes("withhold"), isTau: true },
        ];
        const insideCutoff = 0.56;
        const rows = rawRows.map((d) => {
          const fmt = d.isTau ? formatSetting : formatReadoutProb;
          const textW = Math.max(26, fmt(d.cost).length * 7.8) * perPx;
          const pad = 5 * perPx;
          const tauClear = 6 * perPx;
          let inside = d.cost > insideCutoff;
          if (inside && !d.isTau && d.cost - pad - textW < tauX + 3 * perPx && d.cost + pad + textW <= 1 + 8 * perPx) {
            inside = false;
          }
          let labelX = d.cost;
          if (!inside && !d.isTau && d.cost < tauX + 2 * perPx && d.cost + pad + textW > tauX - 3 * perPx) {
            labelX = tauX + tauClear - pad;
          }
          return { ...d, inside, labelX };
        });
        plot(figs.decision, {
          alt: T.decisionAlt,
          marginTop: C.costMargin.top, marginBottom: C.costMargin.bottom, marginLeft: C.costMargin.left, marginRight: C.costMargin.right,
          ...(fw > 0 ? { width: fw } : {}),
          height: heights().decision,
          x: { domain: C.costDomain.slice(), ticks: C.costTicks.slice(), label: null },
          y: { domain: domainLabels, padding: 0.28, label: null, tickSize: 0 },
          marks: (c, P) => {
            const fillOf = (d) => (d.best ? c.post : c.neutral2 ?? "#d9d9d9");
            const outProb = rows.filter((d) => !d.isTau && !d.inside);
            const inProb = rows.filter((d) => !d.isTau && d.inside);
            const outTau = rows.filter((d) => d.isTau && !d.inside);
            const inTau = rows.filter((d) => d.isTau && d.inside);
            return [
              P.barX(rows, { x: "cost", y: "label", fill: fillOf, rx: 2, stroke: (d) => (d.best ? c.post : c.cellBorder), strokeWidth: 0.8 }),
              P.ruleX([state.tau], { stroke: c.est, strokeWidth: 1.6, strokeDasharray: "4 3" }),
              P.ruleX([0], { stroke: c.plotAxis }),
              outProb.length ? numText(outProb, { x: "labelX", y: "label", value: "cost", format: formatReadoutProb, dx: 5, textAnchor: "start", fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", fontWeight: (d) => (d.best ? 700 : 500), fontSize: 13 }) : null,
              inProb.length ? numText(inProb, { x: "labelX", y: "label", value: "cost", format: formatReadoutProb, dx: -5, textAnchor: "end", fill: (d) => labelOn(fillOf(d), c), fontWeight: 700, fontSize: 13 }) : null,
              outTau.length ? numText(outTau, { x: "labelX", y: "label", value: "cost", format: formatSetting, dx: 5, textAnchor: "start", fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", fontWeight: (d) => (d.best ? 700 : 500), fontSize: 13 }) : null,
              inTau.length ? numText(inTau, { x: "labelX", y: "label", value: "cost", format: formatSetting, dx: -5, textAnchor: "end", fill: (d) => labelOn(fillOf(d), c), fontWeight: 700, fontSize: 13 }) : null,
            ];
          },
        });
      }

      function drawSummariesAndTables(state, r) {
        const { post, decision, best } = r;
        // Stage 1 concise metric line
        dataMetric.replaceChildren(
          "A ", w.setting(state.estA), " ± ", w.setting(state.seA),
          " · B ", w.setting(state.estB), " ± ", w.setting(state.seB),
        );
        // Stage 2 concise metric line (carries keepA & keepB hooks)
        priorMetric.replaceChildren(
          "SD ", w.setting(state.priorSd),
          " · keeps A ", w.share(post.shrink[0], { hook: "keepA" }),
          ", B ", w.share(post.shrink[1], { hook: "keepB" }),
        );
        // Stage 3 concise metric line (carries meanA, meanB & pi hooks)
        postMetric.replaceChildren(
          "A ", w.est(post.mean[0], { hook: "meanA" }),
          ", B ", w.est(post.mean[1], { hook: "meanB" }),
          " · ", math("\\pi"), " = ", w.prob(r.pi, { hook: "pi" }),
        );
        // Stage 4 grade chips + best report tag line (carries report hook + tie qualifier)
        const grade = Array.from(best.grade);
        const groups = blocksOf(grade);
        const pal = palette(ctx.root);
        const fills = gradeColors(groups.length, pal);
        const chips = [];
        groups.forEach((units, g) => {
          if (g > 0) chips.push(h("span", { class: "prx-pp-gt", "aria-hidden": "true", text: ">" }));
          chips.push(h("span", { class: "prx-pp-chip", style: { background: fills[g], color: labelOn(fills[g], pal) } },
            h("span", { class: "prx-pp-chip-units", text: units.join(" ") }),
            h("span", { class: "prx-pp-chip-grade" }, `Grade ${g + 1}`)));
        });
        reportLine.replaceChildren(...chips, h("span", { class: "prx-sr-only", text: blocksText(grade) }));
        const tag = tagNode(ctx, best, { ties: true });
        tagLine.replaceChildren(h("span", { class: "prx-pp-blocks", "data-prx-readout": "report" }, blocksText(grade)), ", ", tag);

        // Data disclosure: exact 2-unit table (carries sdA & sdB hooks at 3 sig figs, plus 6-decimal exact columns)
        const ests = [state.estA, state.estB];
        const ses = [state.seA, state.seB];
        unitBody.replaceChildren(...CONFIG.ids.map((id, i) => h("tr", {},
          h("th", { scope: "row", "data-prx-name": "" }, id),
          h("td", {}, w.setting(ests[i])),
          h("td", {}, w.setting(ses[i])),
          h("td", {}, w.num(post.shrink[i], formatDecimal(post.shrink[i], { digits: 6 }))),
          h("td", {}, w.num(post.mean[i], formatDecimal(post.mean[i], { digits: 6 }))),
          h("td", {}, w.est(post.sd[i], { hook: `sd${id}` })),
        )));

        // Data disclosure: 3-report cost table (carries costAB, costBA, costWithhold hooks)
        const costRows = [
          { action: "iAboveJ", grade: [1, 2], cost: [w.prob(decision.costs.iAboveJ, { hook: "costAB" })] },
          { action: "jAboveI", grade: [2, 1], cost: [w.prob(decision.costs.jAboveI, { hook: "costBA" })] },
          { action: "withhold", grade: [1, 1], cost: ["τ = ", w.setting(decision.costs.withhold, { hook: "costWithhold" })] },
        ];
        costBody.replaceChildren(...costRows.map((row) => {
          const lowest = decision.best.includes(row.action);
          const cell = h("td", {}, ...row.cost, lowest ? h("span", { class: "prx-pp-badge", text: T.lowest }) : null);
          return h("tr", { "data-best": lowest ? "" : undefined }, h("th", { scope: "row", class: "prx-pp-blocks" }, blocksText(row.grade)), cell);
        }));
      }

      function sentence(state, r) {
        const { decision, best } = r;
        const x = boxAt(state.box);
        const k = CONFIG.boxes.indexOf(x) + 1;
        const grade = Array.from(best.grade);
        const ties = best.tieCount ?? best.grades?.length ?? 1;
        const aFirst = r.pi >= 0.5;
        const err = aFirst ? r.eAB : r.eBA;
        const probability = aFirst ? r.pi : 1 - r.pi;
        const dirLabel = r.pi === 0.5 ? "Pr(A > B) = " : aFirst ? "Pr(A > B) = " : "Pr(B > A) = ";
        const stating = aFirst ? "iAboveJ" : "jAboveI";
        const states = grade[0] !== grade[1];
        const tie = decision.best.includes(stating) && decision.best.includes("withhold");
        const cmp = tie ? (err === state.tau ? " = " : " ≈ ") : decision.best.includes(stating) ? " < " : " > ";
        const out = [
          `${CONFIG.ownerShort[k - 1]}: A `,
          w.setting(state.estA), " → ", w.est(r.post.mean[0]),
          ", B ", w.setting(state.estB), " → ", w.est(r.post.mean[1]),
          "; ", dirLabel, w.prob(probability),
          states ? `, so report ${blocksText(grade)} (error ` : `, so withhold ${blocksText(grade)} (error `,
          w.prob(err), cmp, "τ ", w.setting(state.tau), ").",
        ];
        if (ties > 1) {
          out.push(" ", w.count(ties), " reports share the smallest risk (equal-risk tolerance ",
            w.num(1e-12, "1e−12"), "); showing the first.");
        }
        return out;
      }

      let lastBox = null;
      const memo = { data: null, prior: null, posterior: null, decision: null };
      let last = null;
      const stamp = (...v) => v.join("|");

      function drawFigures(state, r, force = false) {
        const chainMode = ctx.root.getAttribute("data-prx-pp-chain") ?? "column";
        const d = stamp(chainMode, figWidth(figs.data), state.estA, state.seA, state.estB, state.seB);
        if (force || memo.data !== d) { drawData(state); memo.data = d; }
        const p = stamp(chainMode, figWidth(figs.prior), state.priorSd);
        if (force || memo.prior !== p) { drawPrior(state); memo.prior = p; }
        const q = stamp(chainMode, figWidth(figs.posterior), state.estA, state.seA, state.estB, state.seB, state.priorSd);
        if (force || memo.posterior !== q) { drawPosterior(r); memo.posterior = q; }
        const dc = stamp(chainMode, figWidth(figs.decision), state.estA, state.seA, state.estB, state.seB, state.priorSd, state.tau);
        if (force || memo.decision !== dc) { drawDecisionChart(state, r); memo.decision = dc; }
      }

      if (rowMql) ctx.listen(rowMql, "change", () => { layout(ctx.width()); if (last) drawFigures(last.state, last.r, true); });

      if (typeof ctx.win.ResizeObserver === "function") {
        const roObs = new ctx.win.ResizeObserver((entries) => {
          const width = Math.round(entries[entries.length - 1]?.contentRect?.width ?? 0);
          if (width > 0) layout(width);
        });
        roObs.observe(ctx.frame);
        ctx.onCleanup(() => roObs.disconnect());
      }

      return {
        render(state, info = {}) {
          layout(ctx.width());
          if (info.reason === "disclosure" && last) return;
          const open = boxAt(state.box);
          for (const s of stages) {
            s.node.setAttribute("aria-pressed", String(s.b === open));
            s.sec.toggleAttribute("data-open", s.b === open);
          }
          if (state.box !== lastBox) { drawPanel(state.box); lastBox = state.box; }
          for (const k of Object.keys(sl)) sl[k].set(state[k]);
          const r = computeChain(state);
          last = { state, r };
          drawFigures(state, r, info.reason === "theme" || info.reason === "resize" || info.initial);
          drawSummariesAndTables(state, r);
          const parts = [
            () => ["Data supplies estimates A ", w.setting(state.estA), " and B ", w.setting(state.estB),
              " with standard errors ", w.setting(state.seA), " and ", w.setting(state.seB), " to the model."],
            () => ["The model combines those estimates with prior SD ", w.setting(state.priorSd),
              " to produce posterior means ", w.est(r.post.mean[0]), " and ", w.est(r.post.mean[1]), "."],
            () => ["postrank starts with the supplied posterior. It gives probability ", w.prob(r.pi),
              " that A exceeds B for the decision step."],
            () => ["The decision compares directional errors ", w.prob(r.eAB), " and ", w.prob(r.eBA),
              " with the cost of withholding ", w.setting(state.tau), " to choose the grades above."],
          ];
          transition.replaceChildren(...parts[state.box - 1]());
          stages[state.box - 1].sec.append(transition);
          w.set(sentence(state, r));
        },
        resize(width) {
          layout(width);
          if (last) drawFigures(last.state, last.r, true);
        },
      };
    },
  });
}
