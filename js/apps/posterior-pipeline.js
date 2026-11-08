// posterior-pipeline (app 1.7): of data, model, posterior and decision, postrank does only the last step: it reads a
// posterior and makes grades. Starting point: postrank Explorer v1 L-05 (posterior-pipeline.js and its CSS), without the
// prediction gate; everything v1 showed after Check or Skip is shown at once.
//
//   Data Y  →  Model  →  Posterior Pr(θ ∣ Y)  →  Decision (grades)
//
// Layout (review 044 repair: U2-F2, X-01, X-07, X-14, X-18): base.js's result-first frame, top to bottom:
//   presets  the preset row ("Worked settings (set every slider)", the catalog's presetLabel) and a line under it that
//            says that a preset sets the chain's sliders as well as the open box, while the box buttons only open a box
//   read-out the one live sentence (base.js), directly under the preset row: the estimates become posterior means and
//            π, then the likelier direction's chance of being wrong against τ and the decision; ties are said with the
//            equal-risk tolerance
//   chain    one linked chain whose box headers are its four stages (the primary graphic, ctx.primaryGraphic): four
//            stages joined by three glyph-only arrows, in one row when the app is at least CONFIG.chainRowMinWidth px
//            wide (the 990-px page column included) and stacked from top to bottom (arrows pointing down) when it is
//            narrower or not yet measured. Each stage is headed by its box button (number, a small decorative glyph,
//            name, line, and who makes it: "the analyst" and "the analyst's software", the words of the arrow that
//            leaves boxes 1 and 2, and the tags "read by postrank" and "made by postrank"); pressing a header opens the
//            box (key box) and the closed box of the four texts. Under each header, two units, A and B, with numbers:
//            estimates and SEs (stage 1) and a normal prior with mean 0 (stage 2) give each unit a normal posterior
//            (stage 3: engine normalPosterior; its curves with normalPdf; π = Pr(θ_A > θ_B ∣ Y) with pairDirection,
//            written right under the curves), and postrank's decision at τ (stage 4: the three reports of two units and
//            their costs with errorArray and pairDecision, the best one with exactOptimum, its grade chips and its short
//            tag, with the tie qualifier when several reports tie). The heavier third arrow and a dashed frame around
//            stage 3, the third arrow and stage 4 mark the part postrank touches; the arrows' who-words stay for screen
//            readers. A visually hidden paragraph describes the chain's boxes in words; the chain's own caption (the
//            teaching posterior and a gloss) sits under it.
//   boxes    a closed box "What each box holds and who makes it": the panel of the open box, its title, what it holds
//            and who makes it (the panel's own aria-live part), an example, "See also" (box 3) and its source
//   routes   a closed box "What postrank can do with each form of posterior": the forms a supplied posterior can take
//            and what postrank can do with each (static: postrank 1.1.0's problem constructor,
//            postrank_coefficient_capabilities() and postrank_tie_capabilities(), checked by running them), and that
//            validation checks the form of the input, not the model. Column heads in plain words, each linking the app
//            that shows its problem once that app is built, with the package's terms and the reading functions on
//            smaller lines. When the routes section is narrower than the table (CONFIG.routesListBelow, a container
//            query), each route is a short list of what it supports instead. Box 3's "See also" link opens this box.
//   caption  the catalog caption (base.js), last.
// Links: base.js says where links point (linkRoot: Quarto's quarto:offset root on a site page; "../" and a new tab in a
// standalone embed, embed/<name>.html; none elsewhere, as in an offline srcdoc frame, where the page names are plain
// text) and which apps are built (builtPage). A page whose app is not built yet is named in plain text too: an app title
// in quotes, a phrase as it is; a part of this app (the routes table) is an anchor in the page.
//
// Keys: box (integer 1–4, the open box); estA, seA, estB, seB (the two estimates and their SEs); priorSd (the prior
// SD); tau (the withholding cost). Everything else follows js/shared/base.js.
import { builtPage, createWidget, linkRoot, uid } from "../shared/base.js";
import { gradeColors, labelOn, palette, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatProb, formatSetting } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { renderTex } from "../shared/math.js";
import { errorArray, exactOptimum, normalPdf, normalPosterior, pairDecision, pairDirection } from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "posterior-pipeline",
  className: "prx-pp",
  box: Object.freeze({ type: "integer", min: 1, max: 4, value: 1 }),
  // the chain's settings: the app loads on the first preset, these defaults with box 1 open
  estA: Object.freeze({ type: "number", min: -0.6, max: 0.6, step: 0.01, value: 0.25 }),
  seA: Object.freeze({ type: "number", min: 0.02, max: 0.4, step: 0.01, value: 0.1 }),
  estB: Object.freeze({ type: "number", min: -0.6, max: 0.6, step: 0.01, value: 0.05 }),
  seB: Object.freeze({ type: "number", min: 0.02, max: 0.4, step: 0.01, value: 0.2 }),
  priorSd: Object.freeze({ type: "number", min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  tau: Object.freeze({ type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  priorMean: 0,
  ids: Object.freeze(["A", "B"]),
  // from this app width (px) the four stages of the chain, each headed by its box button, sit side by side in one row
  // (review 044, X-07: the site page's app is 990 px wide, the standalone page's 1,156 px); below it they stack, each
  // stage with its figure beside its numbers from splitMinWidth on
  chainRowMinWidth: 880,
  splitMinWidth: 520,
  // the viewport query the row also needs, in CSS (every rule of the row sits inside it) and in the row decision: a
  // hidden or background page may not run ResizeObserver callbacks after a resize, so CSS alone keeps a phone-width
  // page in one column, and JS asks the same query so the two never disagree (review 044 repair, Phase 3: B-F3)
  rowMedia: "(min-width: 57.5em)",
  // the width of an arrow's column between two stages in a row (the arrows are glyphs only), and the stages' shares of
  // the rest: the decision stage, with its costs, chips and rule, gets the most, the model stage the least
  arrowColumn: "2.5rem",
  stageShares: Object.freeze([0.88, 0.95, 0.95, 1.45]),
  svgNs: "http://www.w3.org/2000/svg",
  // the pages the panels and the routes table link to: an app of the catalog (linked once it is built) or a part of
  // this app. text is the app's title (in quotes while it is not a link) or, with phrase, a phrase of the sentence
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
  // below this width (rem, a container query on the routes section) the routes table becomes a list: a narrower
  // table squeezes its four answer columns until words break
  routesListBelow: 48,
  // decorative glyphs, one per box, in a 64 × 28 box: shapes with a class (prx-pp-g-<cls>, styled in CSS below)
  glyphViewBox: "0 0 64 28",
  arrowViewBox: "0 0 40 16",
  arrowShapes: Object.freeze([
    Object.freeze({ tag: "path", cls: "shaft", d: "M2 8H30" }),
    Object.freeze({ tag: "path", cls: "head", d: "M29 3L38 8L29 13Z" }),
  ]),
  // the arrow after box k (k = 1, 2, 3): its label; postrank marks the arrow postrank computes
  arrows: Object.freeze([
    Object.freeze({ label: "the analyst", postrank: false }),
    Object.freeze({ label: "the analyst's software", postrank: false }),
    Object.freeze({ label: "postrank", postrank: true }),
  ]),
  // Rich text: strings, { tex } (a formula), { page } (a link to CONFIG.pages), { box } ("box 3", a name), { code }
  // and { em }.
  boxes: Object.freeze([
    Object.freeze({
      id: "data",
      name: "Data",
      line: Object.freeze({ tex: "Y" }),
      tag: null,
      stage: "the estimates and their SEs",
      glyph: Object.freeze([
        Object.freeze({ tag: "path", cls: "est", d: "M9 7H27" }),
        Object.freeze({ tag: "path", cls: "est", d: "M28 14H52" }),
        Object.freeze({ tag: "path", cls: "est", d: "M24 21H36" }),
        Object.freeze({ tag: "circle", cls: "est-dot", cx: 18, cy: 7, r: 2.6 }),
        Object.freeze({ tag: "circle", cls: "est-dot", cx: 40, cy: 14, r: 2.6 }),
        Object.freeze({ tag: "circle", cls: "est-dot", cx: 30, cy: 21, r: 2.6 }),
      ]),
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
      line: "a prior for the true values",
      tag: null,
      stage: "a prior for the true values",
      glyph: Object.freeze([
        Object.freeze({ tag: "path", cls: "base", d: "M2 25H62" }),
        Object.freeze({ tag: "path", cls: "prior", d: "M2 24C14 24 22 5 32 5S50 24 62 24" }),
      ]),
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
      line: Object.freeze({ tex: "\\Pr(\\theta \\mid Y)" }),
      tag: "read by postrank",
      stage: "a normal posterior for each unit",
      glyph: Object.freeze([
        Object.freeze({ tag: "path", cls: "base", d: "M2 25H62" }),
        Object.freeze({ tag: "path", cls: "post", d: "M6 24C10 24 11 7 14 7S18 24 22 24" }),
        Object.freeze({ tag: "path", cls: "post", d: "M24 24C28 24 29 10 32 10S36 24 40 24" }),
        Object.freeze({ tag: "path", cls: "post", d: "M42 24C46 24 47 4 50 4S54 24 58 24" }),
      ]),
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
      line: "grades",
      tag: "made by postrank",
      stage: "the grades at τ",
      glyph: Object.freeze([
        Object.freeze({ tag: "rect", cls: "grade", x: 3, y: 7, width: 16, height: 14, rx: 2 }),
        Object.freeze({ tag: "rect", cls: "grade", x: 24, y: 7, width: 16, height: 14, rx: 2 }),
        Object.freeze({ tag: "rect", cls: "grade", x: 45, y: 7, width: 16, height: 14, rx: 2 }),
        Object.freeze({ tag: "path", cls: "gt", d: "M20.3 11L22.7 14L20.3 17" }),
        Object.freeze({ tag: "path", cls: "gt", d: "M41.3 11L43.7 14L41.3 17" }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 8, cy: 14, r: 2.2 }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 14, cy: 14, r: 2.2 }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 29, cy: 14, r: 2.2 }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 35, cy: 14, r: 2.2 }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 50, cy: 14, r: 2.2 }),
        Object.freeze({ tag: "circle", cls: "unit", cx: 56, cy: 14, r: 2.2 }),
      ]),
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
  // the chain's figures: one value axis for the estimates, the prior and the posteriors
  chain: Object.freeze({
    domain: Object.freeze([-1, 1]),
    ticks: Object.freeze([-1, -0.5, 0, 0.5, 1]),
    grid: 161,
    fine: 81,
    fineSds: 4,
    headroom: 1.32,
    margin: Object.freeze({ top: 12, bottom: 22, left: 20, right: 14 }),
    // figure heights when the stages sit in a row (narrow figures) and when they are stacked
    height: Object.freeze({ data: 92, prior: 88, posterior: 108 }),
    heightStacked: Object.freeze({ data: 104, prior: 100, posterior: 124 }),
    // y positions of the two units' bars in the data figure
    rowY: Object.freeze({ A: 1, B: 0 }),
    rowDomain: Object.freeze([-0.75, 1.75]),
  }),
  // the forms of a supplied posterior and what postrank can do with each (postrank 1.1.0, checked by running the
  // problem constructor, postrank_coefficient_capabilities() and postrank_tie_capabilities() on each route). A column
  // head is rich text in plain words (its { page } parts link the apps that show the problem), detail the package's
  // terms on a smaller line, and short its name in the narrow list.
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
    // the notes under the table (rich text)
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
    chainTitle: "Two units through the four boxes",
    chainLabel: "Two units, A and B, through the four boxes, with numbers",
    stageLabel: "Two units in box",
    estA: "Estimate of A",
    seA: "SE of A",
    estB: "Estimate of B",
    seB: "SE of B",
    priorSd: "Prior SD",
    tau: "Withholding cost τ",
    dataNote: Object.freeze(["each estimate ± ", Object.freeze({ num: "one" }), " SE"]),
    // a { num } part is a fixed number of the model, written as a data-num span
    priorNote: Object.freeze(["One prior for both units: normal, mean ", Object.freeze({ num: "priorMean" }), "."]),
    keepNote: "Each posterior mean keeps the share prior SD² ÷ (prior SD² + SE²) of its estimate.",
    dataAlt: "The two estimates as dots, each with a bar of plus and minus one SE, on one axis of values.",
    priorAlt: "The prior for the true values: a normal curve centered at 0, drawn dashed.",
    posteriorAlt: "The two posteriors: a normal curve for A's true value (solid) and one for B's (dashed), on the same axis.",
    piWords: "the probability that A is truly higher",
    reportsTitle: "The three reports of two units",
    costNote: "A stated direction costs its chance of being wrong; one grade, which states no direction, costs τ.",
    reportCol: "Report",
    costCol: "Cost",
    lowest: "lowest",
    rule: Object.freeze(["For an isolated pair, disclose only when the posterior probability of the direction exceeds ", Object.freeze({ num: "one" }), "\u00a0−\u00a0τ."]),
    chosen: "The best report",
    gradeOne: "Grade 1 = stated highest on the true value, as the posterior judges it.",
    scrollCue: "The table scrolls sideways.",
    routesTitle: "What postrank can do with each form of posterior",
    // the closed box that holds the panel of the open box (review 044, U2-F2)
    boxesTitle: "What each box holds and who makes it",
    // the group of the three boxes that are not open, after the open box's text in that closed box (review 044 repair,
    // Phase 3: A1-1)
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

// The app's own CSS (base.js adds it once per document); every selector starts with .prx-pp, the app's root class.
// Colors are tokens of styles/tokens.css. One color, one meaning: the accent marks the open box (its stage and its
// header); the arrow postrank computes is set apart by weight and ink, not by the accent; the glyphs and figures use the
// estimate and posterior colors in their Part 1 meanings on the plot panel color, which stays light in dark mode.
const CSS = `
.prx-pp .prx-controls:empty { display: none; }
.prx-pp .prx-pp-preset-note { flex: 1 1 100%; margin: -0.2rem 0 0; font-size: 0.92em; color: var(--prx-fg-muted); }

/* --- the chain: four stages headed by the four box buttons, joined by three arrows; one row from
   CONFIG.chainRowMinWidth px of app width (the 990-px page column included), stacked below that --- */
/* The row rules also need a viewport of at least 920 px (57.5em). A hidden or background page (a test harness's
   other tabs) may not run ResizeObserver callbacks, so data-prx-pp-chain can lag a resize; the media query is
   applied whenever the page is laid out, so a phone-width page never takes the four-column row
   (review 044 repair, Phase 3 integration). */
.prx-pp .prx-pp-chain { min-width: 0; margin: 0; }
.prx-pp .prx-pp-chain > .prx-panel-title { margin: 0 0 0.4rem; }
.prx-pp .prx-pp-flow { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; align-items: stretch; }
/* in a row the stages share the width by how much each holds (CONFIG.stageShares: the decision stage the most) and
   two grid rows, so the four headers have one height and the four bodies start on one line (subgrid) */
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow { grid-template-columns: ${CONFIG.stageShares.map((f) => `minmax(0, ${f}fr)`).join(` ${CONFIG.arrowColumn} `)}; grid-template-rows: auto 1fr; } }
/* every item has its cell, so the frame can share cells with stage 3, the third arrow and stage 4: in a column stage k
   is row 2k − 1 and the arrow after it row 2k; in a row they are columns */
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
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-box { align-content: start; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="1"] { grid-column: 1; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="1"] { grid-column: 2; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="2"] { grid-column: 3; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="2"] { grid-column: 4; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="3"] { grid-column: 5; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-arrow="3"] { grid-column: 6; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > [data-prx-stage="4"] { grid-column: 7; } }
/* the part postrank touches: a dashed frame just outside stage 3, the third arrow and stage 4 */
.prx-pp .prx-pp-flow > .prx-pp-band { grid-column: 1; grid-row: 5 / 8; margin: -0.3rem; border: 2px dashed var(--prx-fg-heading); border-radius: calc(var(--prx-radius) + 3px); pointer-events: none; }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > .prx-pp-band { grid-column: 5 / 8; grid-row: 1 / 3; } }

/* a stage: its box button as the header, then the two units' figure, sliders and numbers */
.prx-pp .prx-pp-stage { display: flex; flex-direction: column; min-width: 0; background: var(--prx-bg); border: 1px solid var(--prx-border-strong); border-radius: var(--prx-radius); }
/* the open box: the accent border and a ring just outside it (the size stays), a sunken header, a filled number */
.prx-pp .prx-pp-stage[data-open] { border-color: var(--prx-accent); box-shadow: 0 0 0 1px var(--prx-accent); }
.prx-pp .prx-pp-box { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.1rem; align-items: center; width: 100%; min-height: 2.75rem; margin: 0; padding: 0.35rem 0.5rem; font: inherit; line-height: 1.3; text-align: left; color: var(--prx-fg); background: transparent; border: 0; border-bottom: 1px solid var(--prx-border); border-radius: calc(var(--prx-radius) - 1px) calc(var(--prx-radius) - 1px) 0 0; cursor: pointer; transition: background-color 0.15s ease; }
.prx-pp .prx-pp-box:hover, .prx-pp .prx-pp-box[aria-pressed="true"] { background: var(--prx-bg-sunken); }
.prx-pp .prx-pp-num { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--prx-fg-heading); border: 1px solid var(--prx-border-strong); border-radius: 50%; }
.prx-pp .prx-pp-box[aria-pressed="true"] .prx-pp-num { color: var(--prx-on-accent); background: var(--prx-accent); border-color: var(--prx-accent); }
/* the header's first line: number, name and the decorative glyph, which gives way (down to 1.4rem) where a stage is narrow */
.prx-pp .prx-pp-head { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
.prx-pp .prx-pp-glyph { display: block; flex: 0 1 3.1rem; min-width: 1.4rem; margin-left: auto; padding: 0.1rem 0.15rem; background: var(--prx-plot-bg); border: 1px solid var(--prx-border); border-radius: 4px; }
.prx-pp .prx-pp-glyph-svg { display: block; width: 100%; height: auto; }
.prx-pp .prx-pp-name { flex: none; font-weight: 700; white-space: nowrap; color: var(--prx-fg-heading); }
.prx-pp .prx-pp-line { min-width: 0; font-size: 0.86em; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-line math { color: var(--prx-fg); }
.prx-pp .prx-pp-by, .prx-pp .prx-pp-tag { min-width: 0; font-size: 0.82em; }
.prx-pp .prx-pp-by { color: var(--prx-fg-muted); }
.prx-pp .prx-pp-tag { font-weight: 700; color: var(--prx-fg-heading); }
/* glyphs (decorative): drawn on the plot panel color, so the data colors keep their contrast */
.prx-pp .prx-pp-g-est { fill: none; stroke: var(--prx-est); stroke-width: 2; stroke-linecap: round; }
.prx-pp .prx-pp-g-est-dot { fill: var(--prx-est); }
.prx-pp .prx-pp-g-prior { fill: none; stroke: var(--prx-plot-muted); stroke-width: 2; stroke-dasharray: 4 2; }
.prx-pp .prx-pp-g-post { fill: none; stroke: var(--prx-post); stroke-width: 2; }
.prx-pp .prx-pp-g-base { fill: none; stroke: var(--prx-plot-axis); stroke-width: 1; }
.prx-pp .prx-pp-g-grade { fill: var(--prx-plot-grid); stroke: var(--prx-plot-axis); stroke-width: 1; }
.prx-pp .prx-pp-g-unit { fill: var(--prx-plot-fg); }
.prx-pp .prx-pp-g-gt { fill: none; stroke: var(--prx-plot-fg); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
/* arrows, glyph only: down between stacked stages (under the number circles), right between the headers of a row */
.prx-pp .prx-pp-arrow { display: flex; align-items: center; min-height: 1.6rem; padding: 0 0 0 0.6rem; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-arrow-svg { display: block; flex: none; width: 1.6rem; height: 0.65rem; overflow: visible; transform: rotate(90deg); }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-flow > .prx-pp-arrow { justify-content: center; align-self: start; min-height: 0; margin-top: 1.25rem; padding: 0; } }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-arrow-svg { width: 1.85rem; height: 0.75rem; transform: none; } }
.prx-pp .prx-pp-arrow-svg .prx-pp-g-shaft { fill: none; stroke: currentColor; stroke-width: 2; }
.prx-pp .prx-pp-arrow-svg .prx-pp-g-head { fill: currentColor; stroke: none; }
/* the arrow postrank computes is drawn heavier, in heading ink */
.prx-pp .prx-pp-arrow-postrank { color: var(--prx-fg-heading); }
.prx-pp .prx-pp-arrow-postrank .prx-pp-g-shaft { stroke-width: 4; }

/* the stage body: one column in a row of stages and on a phone; figure beside numbers in a wider single column */
.prx-pp .prx-pp-stage-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.3rem; align-content: start; min-width: 0; padding: 0.35rem 0.5rem 0.5rem; }
.prx-pp[data-prx-pp-split] .prx-pp-stage-body { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 0.35rem 1rem; align-items: start; }
.prx-pp .prx-pp-stage-line { margin: 0; font-size: 0.82em; color: var(--prx-fg-muted); }
.prx-pp[data-prx-pp-split] .prx-pp-stage-line { grid-column: 1 / -1; }
.prx-pp .prx-pp-fig { min-width: 0; }
.prx-pp .prx-pp-figcap { margin: 0.15rem 0 0; font-size: 0.8em; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-side { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.prx-pp .prx-pp-side .prx-slider { max-width: none; flex: none; }
/* stage 1's four sliders: two by two where a stage has the width (stacked stages, a phone included), one column in a row */
.prx-pp .prx-pp-side-data { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.35rem 0.9rem; align-content: start; }
@media ${CONFIG.rowMedia} { .prx-pp[data-prx-pp-chain="row"] .prx-pp-side-data { grid-template-columns: minmax(0, 1fr); } }
.prx-pp .prx-pp-lines { margin: 0; padding: 0; list-style: none; font-size: 0.88em; font-variant-numeric: tabular-nums; }
.prx-pp .prx-pp-lines li { margin: 0.1rem 0 0; }
.prx-pp .prx-pp-note { margin: 0.1rem 0 0; font-size: 0.8em; line-height: 1.32; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-pi { margin: 0.2rem 0 0; font-size: 0.95em; }
.prx-pp .prx-pp-pi math { margin: 0; }
.prx-pp .prx-pp-costs { width: 100%; border-collapse: collapse; font-size: 0.88em; font-variant-numeric: tabular-nums; }
.prx-pp .prx-pp-costs caption { caption-side: top; margin: 0 0 0.15rem; padding: 0; font-weight: 700; text-align: left; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-costs th, .prx-pp .prx-pp-costs td { padding: 0.15rem 0.3rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); }
.prx-pp .prx-pp-costs thead th { font-weight: 600; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-costs tr[data-best] th, .prx-pp .prx-pp-costs tr[data-best] td { font-weight: 700; }
.prx-pp .prx-pp-badge { display: inline-block; margin-left: 0.3rem; padding: 0 0.3rem; font-size: 0.85em; font-weight: 700; color: var(--prx-on-accent); background: var(--prx-accent); border-radius: 3px; }
.prx-pp .prx-pp-report-title { margin: 0; font-weight: 700; font-size: 0.88em; color: var(--prx-fg-muted); }
.prx-pp .prx-pp-best { display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; align-items: center; min-width: 0; }
.prx-pp .prx-pp-best > .prx-pp-note { flex: 1 1 5rem; min-width: 0; margin: 0; }
.prx-pp .prx-pp-report { display: flex; flex-wrap: wrap; flex: none; align-items: center; align-self: flex-start; gap: 0.3rem; margin: 0; padding: 0.3rem 0.4rem; border-radius: 4px; }
.prx-pp .prx-pp-chip { display: inline-flex; flex-direction: column; align-items: center; min-width: 2.6rem; padding: 0.1rem 0.45rem; border-radius: 5px; }
.prx-pp .prx-pp-chip-units { font-size: 1.05rem; font-weight: 700; letter-spacing: 0.06em; }
.prx-pp .prx-pp-chip-grade { font-size: 0.72rem; }
.prx-pp .prx-pp-gt { font-weight: 700; color: var(--prx-plot-muted); }
.prx-pp .prx-pp-blocks { font-weight: 700; }
.prx-pp .prx-pp-chain-caption { margin: 0.45rem 0 0; font-size: 0.78rem; line-height: 1.35; color: var(--prx-fg-muted); }

/* --- the closed box of the four texts: the open box first (the panel, its accent border marks it, as the accent marks
   the open stage), then the other three in box order with a neutral border --- */
.prx-pp .prx-pp-panel, .prx-pp .prx-pp-other { margin: 0; padding: 0.6rem 0.75rem; background: var(--prx-bg); border: 1px solid var(--prx-border); border-left: 4px solid var(--prx-accent); border-radius: var(--prx-radius); }
.prx-pp .prx-pp-other { border-left-color: var(--prx-border-strong); }
.prx-pp .prx-pp-others { display: grid; gap: 0.5rem; margin: 0.5rem 0 0; }
.prx-pp .prx-pp-panel p, .prx-pp .prx-pp-other p { margin: 0.4rem 0 0; }
.prx-pp .prx-pp-panel .prx-pp-title, .prx-pp .prx-pp-other .prx-pp-title { margin: 0; font-weight: 700; color: var(--prx-fg-heading); }
.prx-pp .prx-pp-example, .prx-pp .prx-pp-more, .prx-pp .prx-pp-source { font-size: 0.92em; }
.prx-pp .prx-pp-source { color: var(--prx-fg-muted); }
.prx-pp a { color: var(--prx-link); }
.prx-pp a:hover, .prx-pp a:focus-visible { color: var(--prx-link-hover); }
.prx-pp code { font-family: var(--prx-font-mono); font-size: 0.95em; color: inherit; background: var(--prx-bg-sunken); padding: 0 0.2em; border-radius: 3px; }

/* --- the closed box of the forms of a posterior: a table, or a list of the routes when the section is narrower
   than the table --- */
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
    // the shared result-first frame (review 044, X-01): the preset row and its line, the read-out directly under them,
    // then the chain (the graphic every control changes), the two closed boxes and the caption; base.js only moves
    // nodes, so keys, presets, hooks and the live region are kept
    layout: "result-first",
    keys: KEYS,
    build(ctx) {
      const { h, doc } = ctx;
      const links = linkRoot(doc);
      const routesId = uid("prx-pp-routes");
      const panelId = uid("prx-pp-panel");
      // the two closed boxes (review 044, U2-F2 and X-14), complete and in the DOM while closed; made first, so a box
      // header can open the first one and box 3's "See also" link the second
      const boxesBox = ctx.disclosure({ name: "boxes", title: T.boxesTitle });
      const routesBox = ctx.disclosure({ name: "routes", title: T.routesTitle });

      // --- rich text: strings, formulas, links, code and emphasis
      const math = (tex) => {
        const span = h("span", { class: "prx-pp-math" });
        renderTex(span, tex);
        return span;
      };
      const pageLink = (key) => {
        const p = CONFIG.pages[key];
        // a part of this app (the routes table): an anchor that first opens the closed box that holds it
        if (p.part) return h("a", { href: `#${routesId}`, class: "prx-pp-page", onClick: () => { routesBox.open = true; } }, p.text);
        const path = builtPage(p.app);
        // not a link here: an app's title in quotes, a phrase as it is
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
          return ctx.num(v, formatSetting(v));
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
      // an arrow between two stages: its glyph only on screen (review 044, U2-F2: the who-words moved into the stage
      // headers); "leads to" and its who-words stay for screen readers
      const arrowNode = (a, i) => h("span", {
        class: `prx-pp-arrow${a.postrank ? " prx-pp-arrow-postrank" : ""}`, "data-prx-arrow": String(i + 1),
      }, svg(CONFIG.arrowViewBox, CONFIG.arrowShapes, "prx-pp-arrow-svg"),
      h("span", { class: "prx-sr-only", text: T.leadsTo }), h("span", { class: "prx-pp-arrow-label prx-sr-only", text: a.label }));

      // --- the chain's description in words (visually hidden)
      const describeId = uid("prx-pp-desc");
      const description = h("p", { id: describeId, class: "prx-sr-only", text: T.describe });

      // --- the first closed box holds the texts of all four boxes (review 044 repair, Phase 3: A1-1): the open box first,
      // in the panel (aria-current; its live part, with the title, what it holds and who makes it, is rewritten only
      // when the open box changes; then its example, "See also" for box 3 and its source), then the other three boxes
      // in box order, each with its heading. Every text is in the box once.
      const live = h("div", { class: "prx-pp-live", "aria-live": "polite", "aria-atomic": "true", "data-prx-part": "readout" });
      const rest = h("div", { class: "prx-pp-rest" });
      const panel = ctx.part("notes", h("div", { class: "prx-pp-panel", id: panelId, role: "region", "aria-label": T.panel, "aria-current": "true" },
        live, rest));
      const others = h("div", { class: "prx-pp-others", role: "group", "aria-label": T.othersLabel });
      boxesBox.body.append(panel, others);

      // --- the chain: four stages, each headed by its box button, joined by three arrows
      const slider = (key, label, format = (v) => formatSetting(v)) => ctx.slider({ label, ...ctx.key(key), format, onInput: (v) => ctx.set({ [key]: v }) });
      const sl = {
        estA: slider("estA", T.estA), seA: slider("seA", T.seA), estB: slider("estB", T.estB), seB: slider("seB", T.seB),
        priorSd: slider("priorSd", T.priorSd), tau: slider("tau", T.tau),
      };
      const figs = { data: h("div", { class: "prx-pp-fig" }), prior: h("div", { class: "prx-pp-fig" }), posterior: h("div", { class: "prx-pp-fig" }) };
      const postLines = h("ul", { class: "prx-pp-lines" });
      const piLine = h("p", { class: "prx-pp-pi" });
      const costBody = h("tbody");
      const reportLine = h("div", { class: "prx-pp-report prx-light-panel", role: "group", "aria-label": T.chosen });
      const tagLine = h("p", { class: "prx-pp-note" });
      // a stage header pressed by the reader (review 044 repair, Phase 3: B-F4, A1-2): the closed box of the four texts
      // opens first, and only once it is drawn does the open box change, so the panel's live part changes while it is
      // in the accessibility tree and is announced; after a pointer click (never from the keyboard or a preset) the
      // open box's text is scrolled into view, by the least amount, when it is below the viewport. A later press wins.
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
      // a stage's header is its box button: number, glyph, name, line and who makes it (the who-words of the arrow
      // that leaves boxes 1 and 2; the tags of boxes 3 and 4). Pressing it opens the box (key box) and the closed box
      // of the four texts at that box.
      const header = (b, k) => h("button", {
        type: "button", class: `prx-pp-box prx-pp-box-${b.id}`, "aria-pressed": "false",
        "aria-label": `${T.box} ${k}: ${b.name}${b.tag ? `, ${b.tag}` : ""}`, "aria-controls": panelId,
        "data-prx-focus-key": `box:${k}`, "data-prx-box": String(k),
        // a click from the keyboard (Enter, Space) has detail 0, a pointer's click does not (as in chart.js)
        onClick: (e) => press(k, e.detail > 0),
      },
      h("span", { class: "prx-pp-head" }, numCircle(k), h("span", { class: "prx-pp-name", text: b.name }),
        h("span", { class: "prx-pp-glyph" }, svg(CONFIG.glyphViewBox, b.glyph, "prx-pp-glyph-svg"))),
      typeof b.line === "string" ? h("span", { class: "prx-pp-line", text: b.line }) : h("span", { class: "prx-pp-line" }, math(b.line.tex)),
      b.tag ? h("span", { class: "prx-pp-tag", text: b.tag }) : h("span", { class: "prx-pp-by", text: CONFIG.arrows[k - 1].label }));
      // a stage: the header, then what the two units show in this box (when it says more than the header's line)
      const stage = (k, ...body) => {
        const b = CONFIG.boxes[k - 1];
        const node = header(b, k);
        const sec = h("section", { class: "prx-pp-stage", "data-prx-stage": String(k), "aria-label": `${T.stageLabel} ${k}: ${b.name}` },
          node, h("div", { class: "prx-pp-stage-body" }, b.stage !== b.line ? h("p", { class: "prx-pp-stage-line", text: b.stage }) : null, ...body));
        return { b, k, node, sec };
      };
      const stages = [
        stage(1, h("div", {}, figs.data, h("p", { class: "prx-pp-figcap" }, ...rich(T.dataNote))),
          h("div", { class: "prx-pp-side prx-pp-side-data" }, sl.estA.root, sl.seA.root, sl.estB.root, sl.seB.root)),
        stage(2, h("div", {}, figs.prior, h("p", { class: "prx-pp-figcap" }, ...rich(T.priorNote))),
          h("div", { class: "prx-pp-side" }, sl.priorSd.root)),
        // π right under the two curves it compares (review 044, X-01: the decisive number next to the changed mark)
        stage(3, h("div", {}, figs.posterior, piLine),
          h("div", { class: "prx-pp-side" }, postLines, h("p", { class: "prx-pp-note", text: T.keepNote }))),
        stage(4, h("div", { class: "prx-pp-side" }, sl.tau.root,
          h("table", { class: "prx-pp-costs" }, h("caption", { text: T.reportsTitle }),
            h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.reportCol }), h("th", { scope: "col", text: T.costCol }))), costBody),
          h("p", { class: "prx-pp-note", text: T.costNote })),
        // the best report: its grade chips with its tag beside them (on one line where the stage has the width)
        h("div", { class: "prx-pp-side" }, h("p", { class: "prx-pp-report-title", text: T.chosen }), h("div", { class: "prx-pp-best" }, reportLine, tagLine),
          h("p", { class: "prx-pp-note", text: T.gradeOne }), h("p", { class: "prx-pp-note" }, ...rich(T.rule)))),
      ];
      const arrows = CONFIG.arrows.map((a, i) => arrowNode(a, i));
      // a dashed frame around stage 3, the third arrow and stage 4: the part of the chain postrank touches
      const band = h("span", { class: "prx-pp-band", "aria-hidden": "true" });
      // the graphic every control changes (base.js primaryGraphic), directly under the read-out
      const flow = ctx.primaryGraphic(h("div", { class: "prx-pp-flow", role: "group", "aria-label": T.diagram, "aria-describedby": describeId },
        band, ...stages.flatMap((s, i) => (i < arrows.length ? [s.sec, arrows[i]] : [s.sec]))));
      const chainCaption = h("p", { class: "prx-pp-chain-caption" }, captionNode(ctx, "teaching-posterior"), ". ", T.gloss);
      const chain = h("section", { class: "prx-pp-chain", "aria-label": T.chainLabel }, ctx.panelTitle(T.chainTitle), flow, chainCaption);
      ctx.charts.classList.add("prx-pp-charts");
      ctx.charts.append(description, chain);

      // --- the forms of a posterior (static), in the second closed box; its summary names the table on screen and
      // its caption names it for screen readers
      const R = CONFIG.routes;
      const routesTable = h("table", {},
        h("caption", { class: "prx-sr-only", text: T.routesCaption }),
        h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.formCol }),
          ...R.columns.map((c) => h("th", { scope: "col" }, ...rich(c.label), h("span", { class: "prx-pp-detail" }, ...rich(c.detail)))))),
        h("tbody", {}, ...R.rows.map((r) => h("tr", {},
          h("th", { scope: "row" }, r.form, ...rich({ fn: r.fn })),
          ...R.columns.map((c) => h("td", { "data-yes": r[c.key] ? "" : undefined, "data-no": r[c.key] ? undefined : "" }, r[c.key] ? T.yes : T.no))))));
      const routesScroll = ctx.scrollRegion(h("div", { class: "prx-pp-routes-box" }, routesTable), T.routesCaption);
      // a cue under the table while it is wider than its box
      const scrollCue = h("p", { class: "prx-pp-scroll-cue", text: T.scrollCue, hidden: true });
      // the same table as a list, shown instead of it when the section is narrower than the table (CSS)
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

      // a line under the preset row (placed at the first render, once base.js has added the row)
      const presetNote = h("p", { class: "prx-pp-preset-note", text: T.presetNote });

      // --- layout: the stages in one row when there is room, stacked otherwise (each stage with its figure beside its
      // numbers from CONFIG.splitMinWidth on)
      const rowMql = typeof ctx.win.matchMedia === "function" ? ctx.win.matchMedia(CONFIG.rowMedia) : null;
      const layout = (width) => {
        // a row needs the app width and the viewport query of the row's CSS rules, so JS never marks a row that CSS
        // keeps in one column (review 044 repair, Phase 3: B-F3)
        const row = width >= CONFIG.chainRowMinWidth && (rowMql?.matches ?? true);
        ctx.root.setAttribute("data-prx-pp-chain", row ? "row" : "column");
        ctx.root.toggleAttribute("data-prx-pp-split", !row && width >= CONFIG.splitMinWidth);
        scrollCue.hidden = !(routesScroll.scrollWidth > routesScroll.clientWidth + 1);
      };

      // a box's text: its heading, what it holds and who makes it, then its example, "See also" (box 3) and its source
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

      const set = (v) => formatSetting(v);
      const three = (v) => formatDecimal(v, { digits: 3 });
      const common = { marginTop: C.margin.top, marginBottom: C.margin.bottom, marginLeft: C.margin.left, marginRight: C.margin.right };
      const xAxis = { domain: C.domain.slice(), ticks: C.ticks.slice(), label: null };
      const heights = () => (ctx.root.getAttribute("data-prx-pp-chain") === "row" ? C.height : C.heightStacked);

      function drawData(state) {
        const rows = [
          { id: "A", est: state.estA, se: state.seA, y: C.rowY.A },
          { id: "B", est: state.estB, se: state.seB, y: C.rowY.B },
        ];
        plot(figs.data, {
          alt: T.dataAlt, ...common, height: heights().data, x: xAxis, y: { axis: null, domain: C.rowDomain.slice() },
          marks: (c, P) => [
            P.ruleX([0], { stroke: c.plotGrid }),
            P.link(rows, { x1: (d) => d.est - d.se, x2: (d) => d.est + d.se, y1: "y", y2: "y", stroke: c.est, strokeWidth: 2.5, strokeLinecap: "round", clip: true }),
            P.dot(rows, { x: "est", y: "y", r: 4.5, fill: c.est, clip: true }),
            P.text(rows, { x: C.domain[0], y: "y", text: "id", dx: -7, textAnchor: "end", fill: c.plotFg, fontWeight: 700, fontSize: 13 }),
          ],
          keyboard: { data: rows, x: "est", y: "y", label: T.dataAlt, title: (d) => `Estimate of ${d.id}: ${set(d.est)}, SE ${set(d.se)}` },
        });
      }

      function drawPrior(state) {
        const pts = curve(CONFIG.priorMean, state.priorSd);
        const top = peakOf(state.priorSd);
        plot(figs.prior, {
          alt: T.priorAlt, ...common, height: heights().prior, x: xAxis, y: { axis: null, domain: [0, top * C.headroom] },
          marks: (c, P) => [
            P.line(pts, { x: "x", y: "y", stroke: c.plotMuted, strokeWidth: 2, strokeDasharray: "4 2", clip: true }),
            P.ruleY([0], { stroke: c.plotAxis }),
          ],
          keyboard: { data: [{ x: CONFIG.priorMean, y: top }], x: "x", y: "y", label: T.priorAlt, title: () => `Prior: normal, mean 0, SD ${set(state.priorSd)}` },
        });
      }

      function drawPosterior(r) {
        const m = r.post.mean;
        const s = r.post.sd;
        const A = curve(m[0], s[0]);
        const B = curve(m[1], s[1]);
        const top = Math.max(peakOf(s[0]), peakOf(s[1]));
        const right = m[0] >= m[1] ? 1 : -1;
        const names = [{ x: m[0], y: peakOf(s[0]), t: "A", side: right }, { x: m[1], y: peakOf(s[1]), t: "B", side: -right }];
        plot(figs.posterior, {
          alt: T.posteriorAlt, ...common, height: heights().posterior, x: xAxis, y: { axis: null, domain: [0, top * C.headroom] },
          marks: (c, P) => [
            P.areaY(A, { x: "x", y: "y", fill: c.post, fillOpacity: 0.16, clip: true }),
            P.line(A, { x: "x", y: "y", stroke: c.post, strokeWidth: 2, clip: true }),
            P.line(B, { x: "x", y: "y", stroke: c.post, strokeWidth: 2, strokeDasharray: "6 4", clip: true }),
            ...[1, -1].map((side) => P.text(names.filter((d) => d.side === side), {
              x: "x", y: "y", text: "t", dx: 6 * side, dy: -6, textAnchor: side > 0 ? "start" : "end",
              fill: c.plotFg, stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke", fontWeight: 700, fontSize: 13,
            })),
            P.ruleY([0], { stroke: c.plotAxis }),
          ],
          keyboard: {
            data: [{ k: "A", x: m[0], y: peakOf(s[0]), sd: s[0] }, { k: "B", x: m[1], y: peakOf(s[1]), sd: s[1] }],
            x: "x", y: "y", label: T.posteriorAlt, title: (d) => `Posterior of ${d.k}: mean ${three(d.x)}, SD ${three(d.sd)}`,
          },
        });
      }

      /** "{A} > {B}" for a grade vector of the two units. */
      const blocksOf = (grade) => {
        const G = Math.max(...grade);
        return range(G, (g) => CONFIG.ids.filter((_, i) => grade[i] === g + 1));
      };
      const blocksText = (grade) => blocksOf(grade).map((b) => `{${b.join(", ")}}`).join(" > ");

      function drawDecision(state, r) {
        const { decision, best } = r;
        const num = (raw, f) => ctx.num(raw, f(raw));
        const rows = [
          { action: "iAboveJ", grade: [1, 2], cost: [num(decision.costs.iAboveJ, formatProb)], hook: "costAB" },
          { action: "jAboveI", grade: [2, 1], cost: [num(decision.costs.jAboveI, formatProb)], hook: "costBA" },
          { action: "withhold", grade: [1, 1], cost: ["τ = ", num(decision.costs.withhold, set)], hook: "costWithhold" },
        ];
        costBody.replaceChildren(...rows.map((row) => {
          const lowest = decision.best.includes(row.action);
          const cell = h("td", {}, ...row.cost, lowest ? h("span", { class: "prx-pp-badge", text: T.lowest }) : null);
          cell.querySelector(".prx-num")?.setAttribute("data-prx-readout", row.hook);
          return h("tr", { "data-best": lowest ? "" : undefined }, h("th", { scope: "row", class: "prx-pp-blocks" }, blocksText(row.grade)), cell);
        }));
        // the best report as grade chips (grade 1 first), each with its grade number
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
        // the short tag; with several equal-risk best reports it says so and that the chips show the first (review
        // 044, X-12: labels.js tagNode ties)
        const tag = tagNode(ctx, best, { ties: true });
        tagLine.replaceChildren(h("span", { class: "prx-pp-blocks", "data-prx-readout": "report" }, blocksText(grade)), ", ", tag);
      }

      function drawPosteriorLines(state, r) {
        const { post } = r;
        const line = (i, id) => {
          const mean = ctx.num(post.mean[i], three(post.mean[i]));
          const sd = ctx.num(post.sd[i], three(post.sd[i]));
          const keep = ctx.num(post.shrink[i], three(post.shrink[i]));
          mean.setAttribute("data-prx-readout", `mean${id}`);
          sd.setAttribute("data-prx-readout", `sd${id}`);
          keep.setAttribute("data-prx-readout", `keep${id}`);
          return h("li", {}, h("strong", { text: `${id}: ` }), "mean ", mean, ", SD ", sd, ", keeps ", keep, " of its estimate");
        };
        postLines.replaceChildren(line(0, "A"), line(1, "B"));
        const pi = ctx.num(r.pi, formatProb(r.pi));
        pi.setAttribute("data-prx-readout", "pi");
        piLine.replaceChildren(math("\\pi = \\Pr(\\theta_A > \\theta_B \\mid Y)"), " = ", pi, `, ${T.piWords}.`);
      }

      // Keep both estimates, posterior means, the probability of the direction
      // shown, and its decision cost in the one live result.
      function sentence(state, r) {
        const { decision, best } = r;
        const n = ctx.num.bind(ctx);
        const grade = Array.from(best.grade);
        const ties = best.tieCount ?? best.grades?.length ?? 1;
        const means = ["Estimates → posterior means: A ", n(state.estA, set(state.estA)), " → ",
          n(r.post.mean[0], three(r.post.mean[0])), "; B ", n(state.estB, set(state.estB)), " → ",
          n(r.post.mean[1], three(r.post.mean[1])), ". "];
        const aFirst = r.pi >= 0.5;
        const err = aFirst ? r.eAB : r.eBA;
        const probability = aFirst ? r.pi : 1 - r.pi;
        const evidence = r.pi === .5
          ? ["Both directions have posterior probability ", n(probability, formatProb(probability)), ". "]
          : [aFirst ? "A" : "B", " is higher with posterior probability ", n(probability, formatProb(probability)), ". "];
        const stating = aFirst ? "iAboveJ" : "jAboveI";
        const states = grade[0] !== grade[1];
        const tie = decision.best.includes(stating) && decision.best.includes("withhold");
        const cmp = tie ? (err === state.tau ? " = " : " ≈ ") : decision.best.includes(stating) ? " < " : " > ";
        const result = [states ? "Report " : "Withhold ", blocksText(grade), ": ", states ? "error " : "smallest directional error ",
          n(err, formatProb(err)), cmp, "τ ", n(state.tau, set(state.tau)), "."];
        if (ties > 1) result.push(" ", n(ties, formatCount(ties)), " reports share the smallest risk (equal-risk tolerance ",
          n(1e-12, "1e−12"), "); showing the first.");
        return [...means, ...evidence, ...result];
      }

      let lastBox = null;
      const memo = { data: null, prior: null, posterior: null };
      let last = null;
      const stamp = (...v) => v.join("|");

      function drawFigures(state, r, force = false) {
        const d = stamp(state.estA, state.seA, state.estB, state.seB);
        if (force || memo.data !== d) { drawData(state); memo.data = d; }
        const p = stamp(state.priorSd);
        if (force || memo.prior !== p) { drawPrior(state); memo.prior = p; }
        const q = stamp(state.estA, state.seA, state.estB, state.seB, state.priorSd);
        if (force || memo.posterior !== q) { drawPosterior(r); memo.posterior = q; }
      }

      // the viewport can cross the row's query while the app keeps its width: lay out again and redraw the figures
      if (rowMql) ctx.listen(rowMql, "change", () => { layout(ctx.width()); if (last) drawFigures(last.state, last.r, true); });

      // the layout attributes follow the width at once, so the page never scrolls sideways while base.js's debounced
      // resize redraws the figures (review 044 repair, Phase 3 integration: check_browser resizes 1280 → 375 under load)
      if (typeof ctx.win.ResizeObserver === "function") {
        const ro = new ctx.win.ResizeObserver((entries) => {
          const w = Math.round(entries[entries.length - 1]?.contentRect?.width ?? 0);
          if (w > 0) layout(w);
        });
        ro.observe(ctx.frame);
        ctx.onCleanup(() => ro.disconnect());
      }

      return {
        render(state, info = {}) {
          if (ctx.presets && presetNote.previousElementSibling !== ctx.presets) ctx.presets.after(presetNote);
          layout(ctx.width());
          // a closed box was opened: nothing in the state changed (the routes table's scroll cue is measured above)
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
          drawPosteriorLines(state, r);
          drawDecision(state, r);
          ctx.readout.set(sentence(state, r));
        },
        // a new width only switches the layout attributes and redraws the three small figures (their width and, with
        // the layout, their height changed); the headers, panel and numbers stay as they are
        resize(width) {
          layout(width);
          if (last) drawFigures(last.state, last.r, true);
        },
      };
    },
  });
}
