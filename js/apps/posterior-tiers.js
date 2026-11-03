// Full-fidelity R-03 compare renderer and reusable law/card machinery.
import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import {
  formatCount, formatDecimal, formatExpectedCount, formatGrades, formatProb, formatRational, formatRisk, formatSetting,
  formatSigned, formatSizes, rationalApprox,
} from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import {
  disclosure, enumerateReports, errorArray, evaluateReport, exactOptimum, expectedRank, finiteLawPairwise, fixedOrderDP, lowerHull,
  normalPosterior, orderHull, rankSummaries, reportCloud, scoreOrder, tierGrades, league30, drawLeague, tauPath,
} from "../pr-core.js";
const LEAGUE_SEED = 20261030;
const LEAGUE = { tables: { units: { id: league30().ids, estimate: drawLeague(LEAGUE_SEED).estimate, se: league30().se } }, facts: { seed: LEAGUE_SEED } };
import THIRTY from "../../data/released/thirty-sites.json" with { type: "json" };

export const CSS = "\n\n.prx-pt .prx-pt-heading {\n  margin: 0.6rem 0 0.35rem;\n  font-size: 0.95em;\n  font-weight: 600;\n  color: var(--prx-fg-heading);\n}\n\n.prx-pt .prx-pt-note {\n  margin: 0.35rem 0 0;\n  font-size: 0.9em;\n  color: var(--prx-fg-muted);\n}\n\n.prx-pt .prx-pt-label {\n  margin: 0.5rem 0 0.75rem;\n  font-size: 0.95em;\n}\n\n.prx-pt .prx-pt-label .prx-result-label {\n  font-weight: 600;\n  color: var(--prx-fg-heading);\n}\n\n.prx-pt .prx-pt-row-label .prx-result-label {\n  font-weight: 600;\n  color: inherit;\n}\n\n\n.prx-pt .prx-pt-data,\n.prx-pt .prx-pt-rule,\n.prx-pt .prx-pt-cap,\n.prx-pt .prx-pt-opt {\n  display: flex;\n  flex-wrap: wrap;\n  column-gap: 1rem;\n  row-gap: 0.15rem;\n}\n\n.prx-pt .prx-pt-data > legend,\n.prx-pt .prx-pt-rule > legend,\n.prx-pt .prx-pt-cap > legend,\n.prx-pt .prx-pt-opt > legend {\n  flex: 1 1 100%;\n}\n\n.prx-pt .prx-pt-cap {\n  column-gap: 0.75rem;\n}\n\n\n.prx-pt .prx-pt-compare,\n.prx-pt .prx-pt-law {\n  margin: 0.75rem 0 0;\n  min-width: 0;\n}\n\n.prx-pt .prx-pt-rows {\n  display: grid;\n  gap: 0.6rem;\n  margin: 0.5rem 0 0;\n  padding: 0;\n  list-style: none;\n}\n\n.prx-pt .prx-pt-row {\n  min-width: 0;\n  padding: 0.55rem 0.7rem 0.6rem;\n  border: 1px solid var(--prx-border);\n  border-radius: var(--prx-radius, 6px);\n}\n\n.prx-pt .prx-pt-row-chosen {\n  border: 2px solid var(--prx-accent);\n}\n\n.prx-pt .prx-pt-row-head {\n  margin: 0;\n  font-weight: 600;\n}\n\n.prx-pt .prx-pt-row-tag {\n  font-weight: 400;\n  color: var(--prx-plot-muted);\n}\n\n.prx-pt .prx-pt-row-order,\n.prx-pt .prx-pt-row-nums,\n.prx-pt .prx-pt-row-label,\n.prx-pt .prx-pt-row-gap {\n  margin: 0.2rem 0 0;\n  font-size: 0.92em;\n  overflow-wrap: anywhere;\n}\n\n.prx-pt .prx-pt-row-order {\n  color: var(--prx-plot-muted);\n}\n\n.prx-pt .prx-pt-blocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.25rem;\n  margin: 0.4rem 0 0.35rem;\n}\n\n.prx-pt .prx-pt-block {\n  display: inline-flex;\n  align-items: baseline;\n  gap: 0.35rem;\n  padding: 0.15rem 0.45rem;\n  border-radius: var(--prx-radius, 6px);\n  font-weight: 700;\n}\n\n.prx-pt .prx-pt-block-grade {\n  font-size: 0.75em;\n  font-weight: 600;\n  opacity: 0.9;\n}\n\n\n.prx-pt .prx-pt-table-scroll {\n  max-width: 100%;\n  overflow-x: auto;\n}\n\n.prx-pt .prx-pt-table {\n  margin: 0.4rem 0 0;\n  border-collapse: collapse;\n  font-size: 0.9em;\n}\n\n.prx-pt .prx-pt-table caption {\n  caption-side: top;\n  text-align: left;\n  color: var(--prx-fg-muted);\n  padding: 0 0 0.25rem;\n}\n\n.prx-pt .prx-pt-table th,\n.prx-pt .prx-pt-table td {\n  padding: 0.2rem 0.55rem;\n  border-bottom: 1px solid var(--prx-border);\n  text-align: right;\n  vertical-align: top;\n}\n\n.prx-pt .prx-pt-table thead th {\n  vertical-align: bottom;\n  overflow-wrap: normal;\n  word-break: normal;\n  hyphens: manual;\n}\n\n.prx-pt .prx-pt-table th[scope=\"row\"] {\n  text-align: left;\n  white-space: nowrap;\n}\n\n.prx-pt .prx-pt-table-law td:nth-last-child(-n+2),\n.prx-pt .prx-pt-table-law thead th:nth-last-child(-n+2) {\n  text-align: left;\n}\n\n.prx-pt .prx-pt-blocks-text {\n  font-weight: 400;\n  color: var(--prx-fg-muted);\n}\n\n.prx-pt .prx-pt-details {\n  margin: 0.6rem 0 0;\n}\n\n.prx-pt .prx-pt-details > summary {\n  cursor: pointer;\n  font-weight: 600;\n}\n\n.prx-pt .prx-pt-mini {\n  min-width: 0;\n  max-width: min(100%, 24rem);\n  margin: 0.3rem 0 0;\n}\n\n.prx-pt .prx-pt-table-law td,\n.prx-pt .prx-pt-table-law th {\n  white-space: nowrap;\n}\n\n.prx-pt .prx-pt-table thead th:first-child {\n  text-align: left;\n}\n\n.prx-pt .prx-pt-hero{padding:.5rem .75rem;border:1px solid var(--prx-border);border-radius:6px;margin:.3rem 0 .7rem}.prx-pt .prx-pt-hero .prx-pt-strips{grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))}.prx-pt .prx-pt-hero p{margin:.25rem 0}.prx-pt .prx-pt-controls {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:.4rem 1rem;width:100%}\n.prx-pt [hidden]{display:none!important}.prx-pt .prx-pt-table-scroll{overflow-x:auto;min-width:0;max-width:100%}\n.prx-pt .prx-pt-state .top{border:2px solid var(--prx-fg);border-radius:3px;padding:0 .2em}\n.prx-pt .prx-pt-state [data-on] {font-weight:700;background:var(--prx-bg-raised)}\n.prx-pt .prx-pt-strips{display:grid;gap:.5rem}.prx-pt .prx-pt-strip{border-left:3px solid var(--prx-accent);padding:.3rem .6rem}\n.prx-pt .prx-pt-guarantees td{text-align:left;min-width:10rem;white-space:normal}\n";

export const CONFIG = Object.freeze({
  name: "posterior-tiers",
  label: "Tiers from posterior means and expected ranks: fixed tiers, optimal cuts of an order, and the exact optimum",
  title: "Order by a posterior summary, then cut: how close to the best report?",
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01 }),
  cap: Object.freeze({ min: 1, max: 5 }),
  priorSd: 0.15,
  league8: 8,
  // the theory book's ch. 19 three-unit law (the law of Which ranking?, L-09)
  tb19: Object.freeze({
    ids: Object.freeze(["A", "B", "C"]),
    values: Object.freeze([Object.freeze([20, 4, 3]), Object.freeze([0, 4, 3])]),
    probs: Object.freeze([0.3, 0.7]),
  }),
  thirty: Object.freeze({ array: "gaussian", mean: "mean_poverty", sd: "sd_poverty", criterion: "poverty" }),
  defaults: Object.freeze({
    league: Object.freeze({ tau: 0.2, cap: 3 }),
    league8: Object.freeze({ tau: 0.2, cap: 3 }),
    tb19: Object.freeze({ tau: 0.25, cap: 3 }),
    thirty: Object.freeze({ tau: 0.25, cap: 4 }),
  }),
  data: "league8",
  rule: "pm-cuts",
  opt: "cap",
  comparisonN: 2,
  // risks of the three-unit law are written as fractions when every risk shown has a denominator up to this
  maxDenominator: 60,
  // memo of exact optima (keyed by data, family and τ): a τ slider revisits the same few dozen values
  memoSize: 120,
  // equal-value tolerance for comparing two boundaries of the three-unit law
  tieTol: 1e-12,
  mini: Object.freeze({ width: 360, height: 250, marginTop: 16, marginRight: 24, marginBottom: 40, marginLeft: 46, pad: 0.4, yHead: 1.12, dot: 4, vertex: 4.5, ring: 8.5, dash: "7 4", labelDx: -12, labelDy: 8, labelDyBelow: 15 }),
  text: Object.freeze({
    dataLegend: "Data",
    dataLeague: "League, 30 units",
    dataLeague8: "Eight units, U01 to U08",
    dataTb19: "Three-unit law (theory book, chapter 19)",
    dataThirty: "Thirty sites, poverty (package example)",
    ruleLegend: "Rule (the read-out follows this one)",
    rulePmTiers: "Posterior-mean tiers",
    rulePmCuts: "Optimal cuts of the posterior-mean order",
    ruleErCuts: "Optimal cuts of the expected-rank order",
    ruleOptimum: "Exact optimum (every report evaluated)",
    capLegend: "Number of grades G: tiers use G; cuts use at most G. The exact optimum uses its separate family control.",
    optLegend: "Family of the exact optimum",
    optCap: "At most G grades",
    optAll: "Every report",
    slider: "Withholding cost τ",
    sliderHint: "A wrong stated direction costs 1; staying silent on one pair costs τ.",
    compareHeading: "Each rule at the same τ, on the same posterior",
    compareNote: "Tiers are fixed in advance. Each set of cuts is optimal only within its declared order; other orders are not searched.",
    scoreTiePolicy: "Exactly equal summary scores stay in one grade.",
    gapNote: "The cuts lie inside the family of the exact optimum, so their risk gap is zero or positive.",
    noOptimum: "The exact optimum is not searched here: ⟨n⟩ units have far too many reports for this browser. The eight-unit view shows it.",
    orderPm: "posterior-mean order",
    orderEr: "expected-rank order",
    orderPmLong: "posterior means, largest first",
    orderErLong: "expected ranks, smallest first",
    orderWord: "Order",
    cutsIn: "in",
    contiguous: "contiguous reports",
    withAtMost: "with at most",
    atMost: "at most",
    gradesWord: "grades",
    gradeWord: "grade",
    reports: "reports",
    everyOne: "every one evaluated",
    unitsWord: "units",
    unitWord: "unit",
    riskShort: "risk",
    stated: "pairs stated",
    of: "of",
    eWords: "expected wrong directions",
    riskWords: "expected loss per pair (risk)",
    gapWords: "Risk gap to the exact optimum at this τ:",
    sameReport: "the same report as the exact optimum.",
    sameRisk: "the same risk as the exact optimum (another report).",
    shown: "the rule in the read-out",
    lawHeading: "The three-unit law",
    lawStates: "With probability ⟨p1⟩ the true values of A, B and C are ⟨s1⟩; with probability ⟨p2⟩ they are ⟨s2⟩.",
    lawSummaries: "Posterior means ⟨m⟩ give the order A, B, C. Expected ranks ⟨r⟩ (smaller is higher) give the order B, C, A.",
    erDefinition: "A unit's expected rank is its average position under the posterior, ⟨one⟩ at the top.",
    tableHeading: "All thirteen reports at this τ",
    tableCaption: "Every report of the three units: pairs stated, expected wrong directions and risk",
    colReport: "Report",
    colN: "Pairs stated, N",
    colE: "Expected wrong directions, E",
    colRisk: "Risk at τ",
    colOrder: "Keeps the order",
    both: "both",
    colBest: "Best of",
    bestPm: "cuts of A, B, C",
    bestEr: "cuts of B, C, A",
    bestAll: "exact optimum",
    andWord: " and ",
    miniHeading: "Each report at (N, E)",
    miniAlt: "The thirteen reports of the three-unit law as points: pairs stated N across, expected wrong directions E up. The dashed boundary keeps the order A, B, C; the solid boundary runs below every report.",
    miniTable: "Boundary vertices: within the order A, B, C and within all thirteen reports",
    miniNote: "Solid: the frontier, the lowest E at each N among all thirteen reports. Dashed: the same within the order A, B, C. No report of three units states exactly one pair. The ring marks the report of the rule in the read-out.",
    lawLink: "At N = ⟨n⟩ the figure compares expected wrong counts at matched disclosure; the cards and table compare full risk at the current τ.",
    miniErSame: "The cuts of B, C, A reach the solid boundary at every vertex here.",
    miniErDiffers: "The cuts of B, C, A do not reach every vertex of the solid boundary here.",
    xLabel: "pairs stated, N",
    yLabel: "E",
    boundaryPm: "within A, B, C",
    boundaryAll: "all reports",
    ordersSummary: "The two orders, unit by unit",
    ordersCaption: "Units by place in each order",
    ordersRegion: "The two orders, unit by unit (scrolls sideways)",
    colPlace: "Place",
    colPmUnit: "Posterior-mean order",
    colMean: "Posterior mean",
    colSd: "Posterior SD",
    colErUnit: "Expected-rank order",
    colEr2: "Expected rank",
    gradeOne: "Grade 1 = highest priority: the largest true value as the posterior judges it.",
    noteLeague: "The simulated league, frozen draw with seed ⟨seed⟩; prior SD ⟨sd⟩",
    noteLeague8: "Units U01 to U08 of the simulated league, frozen draw with seed ⟨seed⟩; prior SD ⟨sd⟩",
    noteTb19: "An illustrative two-state law from the postrank theory book, chapter 19; its probabilities are exact; expected wrong counts are fractions, and risks are fractions when their denominators are small.",
    noteThirty: "Thirty fictional sites from the postrank package (synthetic), poverty criterion. The Gaussian posterior and its error probabilities are the package's and are taken as given.",
    blockThen: " > ",
  }),
});

// ---------------------------------------------------------------------------------------------- data

const nanDiag = (m) => m.map((row) => row.map((v) => (v === null ? Number.NaN : v)));

/** A data model: ids, error array, the two summaries and their orders. */
export function posteriorModel(key, { ids, E, means, sds, er, hasOptimum, fraction }) {
  const pm = scoreOrder(means, { direction: "descending" });
  const eo = scoreOrder(er, { direction: "ascending" });
  return { key, ids, n: ids.length, E, means, sds, er, pmOrder: pm.order, erOrder: eo.order, hasOptimum, fraction, ...CONFIG.defaults[key] };
}

function leagueModel(key, count) {
  const u = LEAGUE.tables.units;
  const ids = u.id.slice(0, count);
  const post = normalPosterior(u.estimate.slice(0, count), u.se.slice(0, count), { priorSd: CONFIG.priorSd });
  const E = errorArray(post.mean, post.sd, { ids, criteria: ["theta"] });
  return posteriorModel(key, { ids, E, means: post.mean, sds: post.sd, er: expectedRank(E, {}), hasOptimum: count <= CONFIG.league8, fraction: false });
}

export function tb19Model() {
  const T = CONFIG.tb19;
  const ids = Array.from(T.ids);
  const states = T.values.map((s) => s.map((v) => [v]));
  const E = finiteLawPairwise(states, Array.from(T.probs), { ids });
  const means = rankSummaries({ states: T.values.map((s) => Array.from(s)), probs: Array.from(T.probs) }).means;
  return posteriorModel("tb19", { ids, E, means, sds: null, er: expectedRank(E, {}), hasOptimum: true, fraction: true });
}

function thirtyModel() {
  const C = CONFIG.thirty;
  const a = THIRTY.arrays[C.array];
  const E = { ids: a.ids.slice(), criteria: [C.criterion], e: [nanDiag(a.e[0])] };
  const u = THIRTY.tables.units;
  return posteriorModel("thirty", { ids: u.id.slice(), E, means: u[C.mean].slice(), sds: u[C.sd].slice(), er: expectedRank(E, {}), hasOptimum: false, fraction: false });
}

export const MODELS = Object.freeze({
  league: leagueModel("league", LEAGUE.tables.units.id.length),
  league8: leagueModel("league8", CONFIG.league8),
  tb19: tb19Model(),
  thirty: thirtyModel(),
});

const RULES = Object.freeze(["pm-tiers", "pm-cuts", "er-cuts", "optimum"]);

/** The three-unit law's fixed views: every report, the members of each order family, the boundaries. */
const TB19 = (() => {
  const m = MODELS.tb19;
  const key = (g) => Array.from(g).join("/");
  const members = (order) => new Set(Array.from(enumerateReports(m.n, { kind: "order", order }), key));
  const cloud = reportCloud(m.E, { family: { kind: "all" } });
  return {
    reports: Array.from(enumerateReports(m.n, { kind: "all" }), (g) => Array.from(g)),
    inPm: members(m.pmOrder),
    inEr: members(m.erOrder),
    points: cloud.points,
    hullAll: lowerHull(cloud),
    hullPm: orderHull(m.E, { order: m.pmOrder }),
    hullEr: orderHull(m.E, { order: m.erOrder }),
    key,
  };
})();

/** The rule results of one state. Exact optima are kept in a small memo (key: data, family, τ). */
const memo = new Map();
function optimumOf(mdl, family, tau) {
  const k = `${mdl.key}|${JSON.stringify(family)}|${tau}`;
  if (memo.has(k)) return memo.get(k);
  const r = exactOptimum(mdl.E, { tau, family });
  if (memo.size >= CONFIG.memoSize) memo.delete(memo.keys().next().value);
  memo.set(k, r);
  return r;
}

export function compute(mdl, state) {
  const G = Math.min(state.cap, mdl.n);
  const capped = G < mdl.n;
  const tau = state.tau;
  const tiers = Array.from(tierGrades(mdl.means, G, { direction: "descending" }));
  const out = {
    G,
    "pm-tiers": { grade: tiers, ev: evaluateReport(tiers, mdl.E, { tau }) },
    "pm-cuts": fixedOrderDP(mdl.E, { scores: mdl.means, direction: "descending", tau, ...(capped ? { G } : {}) }),
    "er-cuts": fixedOrderDP(mdl.E, { scores: mdl.er, direction: "ascending", tau, ...(capped ? { G } : {}) }),
    optimum: null,
  };
  for (const r of ["pm-cuts", "er-cuts"]) out[r].ev = evaluateReport(Array.from(out[r].grade), mdl.E, { tau });
  if (mdl.hasOptimum) {
    const family = state.opt === "all" || !capped ? { kind: "all" } : { kind: "atMost", G };
    const o = optimumOf(mdl, family, tau);
    out.optimum = o;
    o.ev = evaluateReport(Array.from(o.grade), mdl.E, { tau });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) { return mountPosteriorSummary(el, spec); }

/** Full R-03 renderer shared by compare and law apps; no source view is reduced in the wrapper. */
export function mountPosteriorSummary(el, spec = {}, { lawView = false } = {}) {
  const appName = lawView ? "order-misses" : "posterior-tiers";
  const defaultData = lawView ? "tb19" : "league8";
  return createWidget(el, spec, {
    name: appName,
    css: CSS,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-pt",
    keys: {
      data: { type: "choice", values: lawView ? ["tb19"] : ["league", "league8", "thirty"], value: defaultData },
      ...(lawView ? { order: { type: "choice", values: ["mean", "rank"], value: "mean" } } : {}),
      rule: { type: "choice", values: Array.from(RULES), value: CONFIG.rule },
      cap: { type: "integer", min: CONFIG.cap.min, max: CONFIG.cap.max, value: CONFIG.defaults[defaultData].cap },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.defaults[defaultData].tau },
      opt: { type: "choice", values: ["cap", "all"], value: CONFIG.opt },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;



      // --- helpers: read-out numbers with their hook; ⟨slot⟩ templates filled with nodes; unit names
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const fill = (template, slots) => {
        const out = [];
        let at = 0;
        for (const m of template.matchAll(/⟨([^⟩]+)⟩/g)) {
          if (m.index > at) out.push(template.slice(at, m.index));
          out.push(...[].concat(slots[m[1]]));
          at = m.index + m[0].length;
        }
        if (at < template.length) out.push(template.slice(at));
        return out;
      };
      const count = (x) => ctx.num(x, formatCount(x));
      const unit = (id) => h("span", { "data-prx-name": "", text: id });
      const listUnits = (ids) => ids.flatMap((id, k) => (k === 0 ? [unit(id)] : [", ", unit(id)]));
      const fracOK = (xs) => xs.every((x) => rationalApprox(x, { maxDenominator: CONFIG.maxDenominator }));
      const fmtE = (mdl, x) => (mdl.fraction ? formatRational(x) : formatExpectedCount(x));
      const blocksText = (grade, ids) => {
        const G = Math.max(...grade);
        const out = [];
        for (let g = 1; g <= G; g += 1) out.push(`{${ids.filter((_, i) => grade[i] === g).join(", ")}}`);
        return out.join(T.blockThen);
      };

      // --- controls
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-pt-data",
        options: [
          { value: "league", label: T.dataLeague }, { value: "league8", label: T.dataLeague8 },
          { value: "thirty", label: T.dataThirty },
        ],
        value: ctx.state.data,
        onChange: (v) => {
          const m = MODELS[v];
          const s = ctx.state;
          ctx.set({ data: v, tau: m.tau, cap: m.cap, rule: s.rule === "optimum" && !m.hasOptimum ? CONFIG.rule : s.rule });
        },
      });
      const ruleRadio = ctx.radioGroup({
        legend: T.ruleLegend, name: "rule", className: "prx-pt-rule",
        options: [
          { value: "pm-tiers", label: T.rulePmTiers }, { value: "pm-cuts", label: T.rulePmCuts },
          { value: "er-cuts", label: T.ruleErCuts }, { value: "optimum", label: T.ruleOptimum },
        ],
        value: ctx.state.rule, onChange: (v) => ctx.set({ rule: v, ...(lawView && ["pm-cuts","er-cuts"].includes(v) ? { order: v === "er-cuts" ? "rank" : "mean" } : {}) }),
      });
      const capValues = [];
      for (let g = CONFIG.cap.min; g <= CONFIG.cap.max; g += 1) capValues.push(g);
      const capRadio = ctx.radioGroup({
        legend: T.capLegend, name: "cap", className: "prx-pt-cap",
        options: capValues.map((g) => ({ value: g, label: count(g) })),
        value: ctx.state.cap, onChange: (v) => ctx.set({ cap: v }),
      });
      const optRadio = ctx.radioGroup({
        legend: T.optLegend, name: "opt", className: "prx-pt-opt",
        options: [{ value: "cap", label: T.optCap }, { value: "all", label: T.optAll }],
        value: ctx.state.opt, onChange: (v) => ctx.set({ opt: v }),
      });
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: ["A wrong stated direction costs ", count(1), "; staying silent on one pair costs τ."], onInput: (v) => ctx.set({ tau: v }),
      });
      const orderControl = lawView ? ctx.segmented({ label: "Order by", name: "order", value: ctx.state.order,
        options: [{ value: "mean", label: "Posterior mean: A, B, C" }, { value: "rank", label: "Expected rank: B, C, A" }],
        onChange: v => ctx.set({ order: v, rule: v === "rank" ? "er-cuts" : "pm-cuts" }) }) : null;
      const controls = h("div", { class: "prx-pt-controls" }, ...(lawView ? [orderControl.root] : [dataRadio.root]), ruleRadio.root, capRadio.root, optRadio.root, tau.root);
      ctx.controls.append(controls);
      const hero = h("section", { class: "prx-pt-hero prx-light-panel", "aria-label": lawView ? "Inspected order cuts and joint benchmark" : "Current report preview" });
      ctx.controls.before(hero);

      // --- read-out, the chosen rule's label, the set-back line
      const labelLine = h("p", { class: "prx-pt-label", "data-prx-part": "readout", "data-prx-result-scope": "" });

      ctx.controls.after(ctx.readout.node);
      ctx.readout.node.after(labelLine);

      // --- the rule rows (league, eight units, 30 sites)
      const compareRows = h("ol", { class: "prx-pt-rows" });
      const compareNotes = h("div", { class: "prx-pt-notes" });
      const ordersSlot = h("div", { class: "prx-pt-orders" });
      const compareBox = h("section", { class: "prx-pt-compare", "data-prx-part": "chart" },
        ctx.panelTitle(T.compareHeading, { className: "prx-pt-heading" }), compareRows, compareNotes, ordersSlot);

      // --- the three-unit law: its own rows, every report, the small figure (all source content is visible)
      const lawRows = h("ol", { class: "prx-pt-rows" });
      const lawText = h("div", { class: "prx-pt-law-text" });
      const lawNotes = h("div", { class: "prx-pt-notes" });
      const tableSlot = h("div", { class: "prx-pt-table-scroll" });
      const miniSlot = h("div", { class: "prx-pt-mini" });
      const miniNote = h("p", { class: "prx-pt-note" });
      const lawInner = h("section", { class: "prx-pt-law" },
        ctx.panelTitle(T.lawHeading, { className: "prx-pt-heading" }), lawText,
        ctx.panelTitle(T.compareHeading, { className: "prx-pt-heading" }), lawRows, lawNotes,
        ctx.panelTitle(T.tableHeading, { className: "prx-pt-heading" }), ctx.scrollRegion(tableSlot, T.tableHeading),
        ctx.panelTitle(T.miniHeading, { className: "prx-pt-heading" }), miniSlot, miniNote);
      const lawBox = h("div", { class: "prx-pt-law-wrap", "data-prx-part": "chart" }, lawInner);
      ctx.charts.append(compareBox, lawBox);

      const tb = MODELS.tb19, law = CONFIG.tb19;
      const lawNum = x => ctx.num(x, formatProb(x, { digits: 1 }));
      const stateNum = values => ctx.num(Array.from(values), `(${values.map(formatCount).join(", ")})`);
      const lawExtras = h("div", { class: "prx-pt-law-extras" });
      const pathSlot = h("div"), pathLegend = h("div", { class: "prx-legend", "data-prx-part": "legend" }), pathTableSlot = h("div", { class: "prx-pt-table-scroll" });
      if (lawView) lawText.after(h("p", { class: "prx-pt-note", text: "Tables keep every column. On narrow screens, swipe sideways, or focus a table region and use the arrow keys." }), lawExtras);
      if (lawView) lawInner.append(ctx.panelTitle("Both orders as the withholding price changes"), pathSlot, pathLegend, ctx.scrollRegion(pathTableSlot, "Complete exact risk-curve intervals"),
        h("p", { class: "prx-pt-note" }, "Each curve gives the best risk at its own price, not a comparison of risks across prices. In the default unrestricted example, the posterior-mean order misses above ", ctx.num(.15, formatSetting(.15)), "; the expected-rank cuts recover the best report here. One law, not a general failing of posterior-mean orders."));
      const guarantee = h("section", { class: "prx-pt-guarantees" });
      if (!lawView) compareBox.append(guarantee);
      // ------------------------------------------------------------------------------------- drawing

      const ruleName = (r) => ({ "pm-tiers": T.rulePmTiers, "pm-cuts": T.rulePmCuts, "er-cuts": T.ruleErCuts, optimum: T.ruleOptimum })[r];
      const orderOf = (mdl, r) => (r === "er-cuts" ? mdl.erOrder : mdl.pmOrder);

      const { scopeParts, drawRow } = createRuleCardRenderer(ctx);

      function drawReadout(mdl, state, rule, res, G, opt, fracMode, results) {
        const ev = res.ev;
        const capWords = G < mdl.n ? [`, ${T.atMost} `, count(G), ` ${G === 1 ? T.gradeWord : T.gradesWord}`] : [];
        const head = rule === "optimum" ? [", ", tagNode(ctx, res, { key: "readout-optimum" })]
          : rule === "pm-tiers" ? [", ", count(G), ` ${T.rulePmTiers.toLowerCase()}`] : [...capWords, `, ${ruleName(rule).charAt(0).toLowerCase()}${ruleName(rule).slice(1)}`];
        const gap = opt && rule !== "optimum" ? (() => {
          const same = Array.from(res.grade ?? res).every((g, i) => g === opt.grade[i]);
          if (same) return [` It is ${T.sameReport}`];
          const d = ev.risk - opt.risk;
          if (Math.abs(d) <= opt.tieTol) return [` It has ${T.sameRisk}`];
          return [` The exact optimum has risk `, ro("opt.risk", opt.risk, fracMode ? formatRational(opt.risk) : formatRisk(opt.risk)), "."];
        })() : [];
        ctx.readout.set([
          "τ = ", ctx.num(state.tau, formatSetting(state.tau)), ...head, ": ",
          ro("N", ev.N, formatCount(ev.N)), ` ${T.of} `, count(ev.M), ` ${T.stated}, ${T.eWords} `, ro("E", ev.Ew, fmtE(mdl, ev.Ew)),
          `, ${T.riskWords} `, ro("risk", ev.risk, fracMode ? formatRational(ev.risk) : formatRisk(ev.risk)), ".", ...gap, ...(mdl.key === "league8" ? [Math.abs(results["pm-cuts"].risk - opt.risk) <= CONFIG.tieTol && Math.abs(results["er-cuts"].risk - opt.risk) <= CONFIG.tieTol ? " At these settings, both orders’ best cuts match the best report of the declared family: a property of these units. " : " These orders need not contain the best report; compare the card gaps at these settings. ", h("a", { href: ctx.win.location.pathname.includes("/embed/") ? "../pages/rules/order-misses.html" : "order-misses.html", target: "_parent" }, "See a law where the order misses.")] : []),
        ]);
        labelLine.replaceChildren(...scopeParts(mdl, rule, res, G, "chosen"));

      }

      function drawNotes(mdl, target) {
        const notes = [h("p", { class: "prx-pt-note", text: T.compareNote })];
        notes.push(h("p", { class: "prx-pt-note" }, ...(mdl.hasOptimum ? [T.gapNote] : fill(T.noOptimum, { n: count(mdl.n) }))));
        notes.push(h("p", { class: "prx-pt-note", text: "Grade one is highest priority: the largest true value as the posterior judges it." }));
        target.replaceChildren(...notes);
      }

      function drawOrders(mdl) {
        if (mdl.key === "tb19") { ordersSlot.replaceChildren(); return; }
        const rows = mdl.pmOrder.map((i, p) => {
          const j = mdl.erOrder[p];
          return h("tr", {},
            h("th", { scope: "row" }, count(p + 1)),
            h("td", {}, unit(mdl.ids[i])), h("td", {}, ctx.num(mdl.means[i], formatDecimal(mdl.means[i], { digits: 3 }))),
            h("td", {}, ctx.num(mdl.sds[i], formatDecimal(mdl.sds[i], { digits: 3 }))),
            h("td", {}, unit(mdl.ids[j])), h("td", {}, ctx.num(mdl.er[j], formatDecimal(mdl.er[j], { digits: 2 }))));
        });
        const table = h("table", { class: "prx-pt-table" },
          h("caption", { text: T.ordersCaption }),
          h("thead", {}, h("tr", {}, ...[T.colPlace, T.colPmUnit, T.colMean, T.colSd, T.colErUnit, T.colEr2].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...rows));
        const open = ordersSlot.querySelector("details")?.open ?? false;
        const details = h("details", { class: "prx-pt-details" }, h("summary", { text: T.ordersSummary }),
          ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, table), T.ordersRegion));
        details.open = open;
        ordersSlot.replaceChildren(details);
      }

      function drawLaw(state, results, fracMode) {
        const m = tb;
        lawText.replaceChildren(
          h("p", {}, ...fill(T.lawStates, { p1: lawNum(law.probs[0]), s1: stateNum(law.values[0]), p2: lawNum(law.probs[1]), s2: stateNum(law.values[1]) })),
          h("p", {}, ...fill(T.lawSummaries, {
            m: ctx.num(Array.from(m.means), `(${m.means.map((x) => formatDecimal(x, { digits: 0 })).join(", ")})`),
            r: ctx.num(Array.from(m.er), `(${m.er.map((x) => formatDecimal(x, { digits: 1 })).join(", ")})`),
          }), " ", ...fill(T.erDefinition, { one: count(1) })),
          h("p", {}, ...fill(T.lawLink, { n: count(CONFIG.comparisonN) })));
        // every report: N, E, risk at τ, membership of each order family, and which rule's best it is
        const evs = TB19.reports.map((g) => ({ g, ev: evaluateReport(g, m.E, { tau: state.tau }) }));
        const best = r => new Set(results[r] ? (results[r].grades ?? [results[r].grade]).map(g => TB19.key(g)) : []);
        const bestOf = { pm: best("pm-cuts"), er: best("er-cuts"), all: best("optimum") };
        evs.sort((a, b) => a.ev.N - b.ev.N || a.ev.Ew - b.ev.Ew);
        const body = evs.map(({ g, ev }) => {
          const k = TB19.key(g);
          const tags = [bestOf.pm.has(k) ? T.bestPm : null, bestOf.er.has(k) ? T.bestEr : null, bestOf.all.has(k) ? T.bestAll : null].filter(Boolean);
          return h("tr", { "data-prx-report": k },
            h("th", { scope: "row" }, ctx.num(g, formatGrades(g)), h("span", { class: "prx-pt-blocks-text", text: ` ${blocksText(g, m.ids)}` })),
            h("td", {}, ctx.num(ev.N, formatCount(ev.N))), h("td", {}, ctx.num(ev.Ew, formatRational(ev.Ew))),
            h("td", {}, ctx.num(ev.risk, fracMode ? formatRational(ev.risk) : formatRisk(ev.risk))),
            h("td", { text: TB19.inPm.has(k) && TB19.inEr.has(k) ? T.both : TB19.inPm.has(k) ? m.pmOrder.map(i => m.ids[i]).join(", ") : TB19.inEr.has(k) ? m.erOrder.map(i => m.ids[i]).join(", ") : "" }),
            h("td", { text: tags.join(T.andWord) }));
        });
        tableSlot.replaceChildren(h("table", { class: "prx-pt-table prx-pt-table-law" },
          h("caption", { text: T.tableCaption }),
          h("thead", {}, h("tr", {}, ...[T.colReport, T.colN, T.colE, T.colRisk, T.colOrder, T.colBest].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {}, ...body)));
      }

      function drawMini(chosenGrade, tieTol) {
        const Mi = CONFIG.mini;
        const width = Math.min(Mi.width, Math.max(1, Math.round(miniSlot.clientWidth || ctx.width())));
        const { hullAll, hullPm, hullEr, points } = TB19;
        const M = disclosure([1,2,3]).M;
        const yTop = Math.max(...points.map((p) => p.Ew)) * Mi.yHead;
        const chosen = points.filter((p) => TB19.key(p.grade) === TB19.key(chosenGrade));
                const midPm = hullPm[1];
        const midAll = hullAll[1];
        plot(miniSlot, {
          alt: T.miniAlt + " The expected-rank boundary is dotted and recovers the solid frontier.",
          keyboard: { data: points, x: "N", y: "Ew", title: p => `${formatGrades(Array.from(p.grade))}: N ${formatCount(p.N)}, E ${formatRational(p.Ew)}.` },
          table: {
            caption: T.miniTable,
            columns: [
              { label: "Boundary", value: "b" },
              { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
              { label: "Expected wrong directions, E", value: "Ew", format: (v) => formatRational(v) },
              { label: "Report", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v) },
            ],
            rows: [...hullPm.map((v) => ({ ...v, b: T.boundaryPm })), ...hullAll.map((v) => ({ ...v, b: T.boundaryAll }))],
          },
          width, height: Mi.height, aspect: false,
          marginTop: Mi.marginTop, marginRight: Mi.marginRight, marginBottom: Mi.marginBottom, marginLeft: Mi.marginLeft,
          x: { domain: [-Mi.pad, M + Mi.pad], ticks: Array.from({ length: M + 1 }, (_, i) => i), tickFormat: (d) => formatCount(d), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, yTop], label: T.yLabel, labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => [
            P.dot(points, { x: "N", y: "Ew", r: Mi.dot, stroke: c.plotMuted, fill: c.plotBg }),
            P.line(hullPm, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2, strokeDasharray: Mi.dash }),
            P.line(hullAll, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2 }),
            P.line(hullEr, { x: "N", y: "Ew", stroke: c.plotMuted, strokeWidth: 2, strokeDasharray: "2 3" }),
            P.dot([...hullPm, ...hullAll], { x: "N", y: "Ew", r: Mi.vertex, fill: c.plotFg, stroke: c.plotBg }),
            P.dot(chosen, { x: "N", y: "Ew", r: Mi.ring, stroke: c.plotFg, strokeWidth: 2, fill: "none" }),
            numText([midPm], { x: "N", y: "Ew", value: "Ew", format: (v) => formatRational(v), dx: Mi.labelDx, dy: -Mi.labelDy, textAnchor: "end", fill: c.plotFg }),
            numText([midAll], { x: "N", y: "Ew", value: "Ew", format: (v) => formatRational(v), dx: Mi.labelDx, dy: Mi.labelDyBelow, textAnchor: "end", fill: c.plotFg }),
          ],
        });
        const erSame = hullEr.length === hullAll.length && hullEr.every((v, i) => v.N === hullAll[i].N && Math.abs(v.Ew - hullAll[i].Ew) <= tieTol);
        miniNote.replaceChildren(`${T.miniNote} Dotted: the expected-rank order B, C, A. ${erSame ? T.miniErSame : T.miniErDiffers}`);
      }

      function drawGuarantees() {
        const rows = [
          ["Observed score, fixed tiers", "No general guarantee", "No general guarantee", "Same declared report under either target"],
          ["Standardized evidence or threshold-pattern grades", "No general guarantee", "No general guarantee", "Preserve reference, threshold and combination"],
          ["Posterior mean composite, fixed tiers", "No general guarantee", "No general guarantee", "Same tiers and equal-score policy as observed-score baseline"],
          ["Posterior mean order, composite-loss cuts", "Exact within its family", "No general guarantee", "Reports preserving the declared score order"],
          ["Posterior mean order, directional-loss cuts", "No general guarantee", "Exact within its family", "Reports preserving the declared score order"],
          ["Expected-rank order, directional-loss cuts", "No general guarantee", "Exact within its family", "Reports preserving the declared rank-score order"],
          ["Unrestricted composite-loss grades", "Exact within its family", "No general guarantee", "All reports satisfying the declared restrictions"],
          ["Unrestricted weighted-directional grades", "No general guarantee", "Exact within its family", "All reports satisfying the declared restrictions"],
        ];
        const table = h("table", { class: "prx-pt-table", "data-prx-guarantees": "" }, h("caption", {}, "Selection guarantees under the supplied law, common cost and stated feasible family"),
          h("thead", {}, h("tr", {}, ...["Rule", "Composite loss", "Directional loss", "Eligible comparison"].map(x => h("th", { scope: "col" }, x)))),
          h("tbody", {}, ...rows.map(row => h("tr", {}, ...row.map((v,i) => h(i ? "td" : "th", i ? {} : { scope: "row" }, v))))));
        guarantee.replaceChildren(ctx.panelTitle("Which objective does each rule optimize?"),
          h("p", { class: "prx-pt-note" }, "The cards above use one directional criterion. The table separates guarantees for a scalar composite target from guarantees for weighted criterion directions. It does not claim that a method is best under both."),
          ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, table), "Rule guarantees under both reporting targets"),
          h("p", { class: "prx-pt-note" }, "Exact claims need exact supplied probabilities, feasible reports and optimization over the whole declared family. A different loss or an out-of-family comparator has no sign guarantee. These are conditional mathematical guarantees, not claims of institutional adoption."));
      }

      function drawLawExtras(state, results) {
        const summary = rankSummaries({ states: law.values.map(s => Array.from(s)), probs: Array.from(law.probs) });
        const chosenOrder = state.order === "rank" ? tb.erOrder : tb.pmOrder;
        const selectedCut = results[state.order === "rank" ? "er-cuts" : "pm-cuts"];
        const table = h("table", { class: "prx-pt-table prx-pt-state" }, h("caption", {}, "Two possible states of the true values"),
          h("thead", {}, h("tr", {}, h("th", {}, "State or summary"), ...tb.ids.map(id => h("th", { scope: "col" }, id)), h("th", {}, "Chance"))),
          h("tbody", {}, ...law.values.map((values,k) => h("tr", {}, h("th", { scope: "row" }, "State ", count(k+1)),
            ...values.map(v => h("td", {}, v === Math.max(...values) ? h("span", { class: "top" }, count(v)) : count(v))), h("td", {}, ctx.num(law.probs[k], formatRational(law.probs[k]))))),
            h("tr", { "data-on": state.order === "mean" ? "" : null }, h("th", { scope: "row" }, "Posterior mean"), ...tb.means.map((v,i) => h("td", {}, ro(`state-mean-${tb.ids[i]}`, v, formatDecimal(v, { digits: 0 })))), h("td")),
            h("tr", { "data-on": state.order === "rank" ? "" : null }, h("th", { scope: "row" }, "Expected rank (", count(1), " = top)"), ...tb.er.map((v,i) => h("td", {}, ro(`state-rank-${tb.ids[i]}`, v, formatDecimal(v, { digits: 1 })))), h("td")),
            h("tr", {}, h("th", { scope: "row" }, "Chance of truly being highest"), ...summary.pTop[0].map((v,i) => h("td", {}, ro(`state-top-${tb.ids[i]}`, v, formatRational(v)))), h("td"))));
        const strip = (name,result,key) => h("div", { class: "prx-pt-strip" }, h("strong", {}, name), chipsForLaw(result.grade),
          h("p", {}, "Risk ", ro(`${key}.risk`, result.ev.risk, formatRisk(result.ev.risk)), "; N = ", count(result.ev.N), ". ", tagNode(ctx, result, { key: `strip-${key}`, orderWords: state.order === "rank" ? "expected-rank order" : "posterior-mean order" })));
        const pTop = summary.pTop[0][chosenOrder[0]];
        const ratio = formatRational(pTop).split("/").map(Number);
        const chance = ratio.length === 2 ? [count(ratio[0]), " times in ", count(ratio[1])] : [ctx.num(pTop, formatProb(pTop))];
        lawExtras.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, table), "States and posterior summaries"),
          h("p", { class: "prx-pt-note" }, "The top true value is boxed in each state; the highlighted summary chooses the inspected order. Sorting by ", state.order === "rank" ? "expected rank" : "posterior mean", " puts ", tb.ids[chosenOrder[0]], " first; that unit is truly on top ", ...chance, ". The best report puts ", tb.ids.filter((id,i) => results.optimum.grade[i] === 1).join(" and "), " in the highest grade (risk ", ctx.num(results.optimum.ev.risk, formatRisk(results.optimum.ev.risk)), " against ", ctx.num(selectedCut.ev.risk, formatRisk(selectedCut.ev.risk)), " for the inspected order)."),
          );
        hero.replaceChildren(h("div", { class: "prx-pt-strips" }, strip(`Cuts of ${chosenOrder.map(i => tb.ids[i]).join(", ")}`, selectedCut, "cut"), strip("Any report in the declared family", results.optimum, "any")));
        if (selectedCut.ev.N !== results.optimum.ev.N) hero.append(h("p", { class: "prx-pt-note" }, captionNode(ctx, "different-disclosure")));
      }
      function chipsForLaw(grade) { return createRuleCardRenderer(ctx).chips(tb, Array.from(grade), palette(ctx.root)); }

      function drawTauComparison(state, G) {
        const family = state.opt === "all" || G === tb.n ? { kind: "all" } : { kind: "atMost", G };
        const defs = [
          { name: "Posterior-mean cuts", key: "mean", dash: "7 4", family: { kind: "order", order: tb.pmOrder, G } },
          { name: "Expected-rank cuts", key: "rank", dash: "2 3", family: { kind: "order", order: tb.erOrder, G } },
          { name: "Best of the declared family", key: "best", dash: null, family },
        ];
        const segments = defs.flatMap(d => tauPath(tb.E, { family: d.family }).intervals.map((segment,k) => ({ ...segment, name: d.name, key: d.key, index: k, segment: `${d.name}-${k}` })));
        pathTableSlot.replaceChildren(h("table", { class: "prx-pt-table" }, h("caption", {}, "Every exact interval, including zero-length endpoint intervals"),
          h("thead", {}, h("tr", {}, ...["Family", "From τ", "To τ", "Report", "N", "E", "Risk from", "Risk to"].map(x => h("th", { scope: "col" }, x)))),
          h("tbody", {}, ...segments.map(s => h("tr", { "data-prx-path": s.key, "data-prx-interval": s.index },
            h("th", { scope: "row" }, s.name),
            ...[["from",s.tauFrom,formatSetting],["to",s.tauTo,formatSetting],["grades",Array.from(s.grade),formatGrades],["N",s.N,formatCount],["E",s.Ew,formatRational],["riskFrom",s.riskFrom,formatRisk],["riskTo",s.riskTo,formatRisk]].map(([key,v,f]) => h("td", {}, ro(`path-${key}`, v, f(v)))))))));
        const points = segments.flatMap(s => [s.tauFrom,s.tauTo].map(tau => ({ ...s, tau, risk: tau === s.tauFrom ? s.riskFrom : s.riskTo })));
        plot(pathSlot, { height: 260, marginLeft: 60, marginBottom: 40,
          x: { domain: [0,.5], label: "Withholding cost τ" }, y: { label: "Best risk at this τ", grid: true },
          color: { domain: defs.map(d => d.name), range: ["var(--prx-plot-fg)","var(--prx-plot-muted)","var(--prx-plot-fg)"], legend: false },
          marks: (c,P) => [...defs.slice().reverse().map(d => P.line(points.filter(p => p.key === d.key), { x: "tau", y: "risk", z: "segment", stroke: "name", strokeDasharray: d.dash, strokeWidth: 2 })), P.ruleX([state.tau], { stroke: c.plotMuted, strokeDasharray: "3 3" })],
          alt: "The best risk along each declared order and over the declared family at the same withholding price. Exact segment endpoints come from the engine cost paths.",
          keyboard: { data: points, x: "tau", y: "risk", title: p => `${p.name}, tau ${formatSetting(p.tau)}, risk ${formatRisk(p.risk)}, report ${formatGrades(Array.from(p.grade))}.` },
          table: { caption: "Exact risk-curve endpoints", columns: [{ label: "Family", value: "name" }, { label: "τ", value: "tau", format: v => formatSetting(v) }, { label: "Risk", value: "risk", format: v => formatRisk(v) }], rows: points },
        });
        pathLegend.replaceChildren();
        for(const d of defs){
          const svg=ctx.doc.createElementNS("http://www.w3.org/2000/svg","svg"),line=ctx.doc.createElementNS(svg.namespaceURI,"line");
          svg.setAttribute("viewBox","0 0 35 10");svg.setAttribute("width","35");svg.setAttribute("height","10");svg.setAttribute("aria-hidden","true");
          for(const [key,value]of Object.entries({x1:0,y1:5,x2:35,y2:5,stroke:d.key==="rank"?"var(--prx-plot-muted)":"var(--prx-plot-fg)","stroke-width":2,...(d.dash?{"stroke-dasharray":d.dash}:{})}))line.setAttribute(key,String(value));
          svg.append(line);pathLegend.append(h("span",{class:"prx-key"},svg,d.name));
        }
      }

      return {
        render(state, info = {}) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const mdl = MODELS[state.data] ?? MODELS[defaultData];
            if (lawView && ["pm-cuts", "er-cuts"].includes(state.rule)) {
              const ruleChanged = info.changed?.includes("rule") && !info.changed?.includes("order");
              const wantedOrder = ruleChanged ? (state.rule === "er-cuts" ? "rank" : "mean") : state.order;
              const wantedRule = wantedOrder === "rank" ? "er-cuts" : "pm-cuts";
              if (state.order !== wantedOrder || state.rule !== wantedRule) { ctx.set({ order: wantedOrder, rule: wantedRule }); return; }
            }
            orderControl?.set(state.order);
            const rule = state.rule === "optimum" && !mdl.hasOptimum ? CONFIG.rule : state.rule;
            const results = compute(mdl, state);
            const G = results.G;
            dataRadio.set(mdl.key);
            ruleRadio.set(rule);
            ruleRadio.inputs[RULES.indexOf("optimum")].disabled = !mdl.hasOptimum;
            capRadio.set(G);
            capRadio.inputs.forEach((input, k) => { input.disabled = capValues[k] > mdl.n; });
            optRadio.set(state.opt);
            optRadio.setDisabled(!mdl.hasOptimum || G >= mdl.n);
            tau.set(state.tau);

            const shownRules = RULES.filter((r) => r !== "optimum" || mdl.hasOptimum);
            const fracMode = mdl.fraction && fracOK([...shownRules.map((r) => results[r].ev.risk), ...TB19.reports.map((g) => evaluateReport(g, mdl.E, { tau: state.tau }).risk)]);
            const pal = palette(ctx.root);
            const opt = results.optimum;
            const rows = shownRules.map((r) => drawRow(mdl, r, results[r], opt, G, r === rule, pal, fracMode));
            const isLaw = mdl.key === "tb19";
            compareBox.hidden = isLaw;
            lawInner.hidden = !isLaw;
            if (isLaw) {
              compareRows.replaceChildren();
              lawRows.replaceChildren(...rows);
              drawNotes(mdl, lawNotes);
              drawLaw(state, results, fracMode);
              drawLawExtras(state, results);
              drawTauComparison(state, G);
              drawMini(Array.from(results[rule].grade), CONFIG.tieTol);
            } else {
              lawRows.replaceChildren();
              compareRows.replaceChildren(...rows);
              drawNotes(mdl, compareNotes);
              drawOrders(mdl);
              drawGuarantees();
              hero.replaceChildren(h("strong", {}, ruleName(rule)), createRuleCardRenderer(ctx).chips(mdl, Array.from(results[rule].grade), pal),
                h("p", { class: "prx-pt-note" }, "Current report: ", count(results[rule].ev.N), " pairs stated; risk ", ctx.num(results[rule].ev.risk, formatRisk(results[rule].ev.risk)), ". ", ...scopeParts(mdl, rule, results[rule], G, "preview")));
            }
            drawReadout(mdl, state, rule, results[rule], G, opt, fracMode, results);
            ctx.caption.replaceChildren(...captionFor(mdl));
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };

      function captionFor(mdl) {
        const seed = () => ctx.num(LEAGUE.facts.seed, formatSetting(LEAGUE.facts.seed));
        const sd = () => ctx.num(CONFIG.priorSd, formatSetting(CONFIG.priorSd));
        if (mdl.key === "league" || mdl.key === "league8") {
          return [...fill(mdl.key === "league" ? T.noteLeague : T.noteLeague8, { seed: seed(), sd: sd() }), " (", captionNode(ctx, "teaching-posterior"), ")."];
        }
        return [mdl.key === "tb19" ? T.noteTb19 : T.noteThirty];
      }
    },
  });
}


/** Parameterized retained v1 cards, including complete equal-risk scope. */
export function createRuleCardRenderer(ctx) {
  const { h } = ctx, T = CONFIG.text;
  const count = x => ctx.num(x, formatCount(x));
  const ro = (name, raw, display) => { const node = ctx.num(raw, display); node.setAttribute("data-prx-readout", name); return node; };
  const listUnits = ids => ids.flatMap((id,k) => [k ? ", " : "", h("span", { "data-prx-name": "" }, id)]);
  const fmtE = (m,x) => m.fraction ? formatRational(x) : formatExpectedCount(x);
  const ruleName = r => ({ "pm-tiers": T.rulePmTiers, "pm-cuts": T.rulePmCuts, "er-cuts": T.ruleErCuts, optimum: T.ruleOptimum })[r];
  const orderOf = (m,r) => r === "er-cuts" ? m.erOrder : m.pmOrder;
      // the scope of a result: tiers carry the caption, cuts the order label, the optimum the exact label
      function scopeParts(mdl, r, res, G, resultKey) {
        if (r === "pm-tiers") return [captionNode(ctx, "fixed-tiers")];
        if (r === "optimum") return [labelNode(ctx, res, { key: resultKey }), " (", familySizeNode(ctx, res), ` ${T.reports}, ${T.everyOne})`];
        const words = r === "er-cuts" ? T.orderEr : T.orderPm;
        const cap = G < mdl.n ? [` ${T.withAtMost} `, count(G), ` ${G === 1 ? T.gradeWord : T.gradesWord}`] : [];
        return [labelNode(ctx, res, { key: resultKey }), ` ${T.cutsIn} `, familyNameNode(ctx, res), ` (${words}; `, familySizeNode(ctx, res), ` ${T.contiguous}`, ...cap, "). ",
          h("span", { "data-prx-score-ties": "" }, T.scoreTiePolicy)];
      }

      function chips(mdl, grade, pal) {
        const G = Math.max(...grade);
        const colors = gradeColors(G, pal);
        const out = [];
        for (let g = 1; g <= G; g += 1) {
          const members = mdl.ids.filter((_, i) => grade[i] === g);
          const body = mdl.n <= CONFIG.league8
            ? listUnits(members)
            : [count(members.length), ` ${members.length === 1 ? T.unitWord : T.unitsWord}`];
          out.push(h("span", { class: "prx-pt-block", style: { background: colors[g - 1], color: labelOn(colors[g - 1], pal) } },
            h("span", { class: "prx-pt-block-grade" }, count(g)), h("span", { class: "prx-pt-block-units" }, ...body)));
        }
        return h("span", { class: "prx-pt-blocks", "aria-hidden": mdl.n <= CONFIG.league8 ? null : "true" }, ...out);
      }

      function orderLine(mdl, r) {
        if (r === "optimum") return null;
        const long = r === "er-cuts" ? T.orderErLong : T.orderPmLong;
        const body = mdl.n <= CONFIG.league8 ? [": ", ...listUnits(orderOf(mdl, r).map((i) => mdl.ids[i]))] : [];
        return h("p", { class: "prx-pt-row-order" }, `${T.orderWord} (${long})`, ...body);
      }

      function gapLine(mdl, r, res, opt, fracMode) {
        if (!opt || r === "optimum") return null;
        const same = Array.from(res.grade).every((g, i) => g === opt.grade[i]);
        const gap = same ? 0 : res.ev.risk - opt.risk;
        const tie = !same && Math.abs(gap) <= opt.tieTol;
        const shown = same || tie ? 0 : gap;
        const display = shown === 0 ? formatCount(0) : fracMode && rationalApprox(shown, { maxDenominator: CONFIG.maxDenominator }) ? `+${formatRational(shown)}` : formatSigned(shown, { digits: 4 });
        const parts = [`${T.gapWords} `, ro(`${r}.gap`, shown, display)];
        if (same) parts.push(`, ${T.sameReport}`);
        else if (tie) parts.push(`, ${T.sameRisk}`);
        else parts.push(".");
        if (res.ev.N !== opt.ev.N) parts.push(" ", captionNode(ctx, "different-disclosure"), ".");
        return h("p", { class: "prx-pt-row-gap" }, ...parts);
      }

      function tieLine(mdl, res) {
        if (!res.label) return null;
        const total = Number(res.tieCount ?? 1), grades = res.grades ?? [res.grade];
        if (total <= 1) return null;
        return h("p", { class: "prx-pt-note", "data-prx-ties": "" }, count(total), " reports share the smallest risk; the read-outs show the first. Equal-risk tolerance ",
          ctx.num(res.tieTol ?? CONFIG.tieTol, "1e−12"), " (", ctx.num(res.tieTol ?? CONFIG.tieTol, "10⁻¹²"), "). ",
          ...grades.flatMap((g, i) => [i ? "; " : "", ctx.num(Array.from(g), formatGrades(Array.from(g))), ": N = ", count(disclosure(Array.from(g)).N)]),
          grades.length < total ? ["; ", count(total - grades.length), " more equal-risk reports"] : []);
      }
      function drawRow(mdl, r, res, opt, G, chosen, pal, fracMode) {
        const ev = res.ev;
        const grade = Array.from(res.grade ?? res);
        const riskText = fracMode ? formatRational(ev.risk) : formatRisk(ev.risk);
        const nums = h("p", { class: "prx-pt-row-nums" },
          `${T.riskShort} `, ro(`${r}.risk`, ev.risk, riskText), " · ",
          ro(`${r}.N`, ev.N, formatCount(ev.N)), ` ${T.of} `, count(ev.M), ` ${T.stated} · E `, ro(`${r}.E`, ev.Ew, fmtE(mdl, ev.Ew)), " · ",
          ro(`${r}.sizes`, disclosure(grade).sizes, formatSizes(disclosure(grade).sizes)),
          mdl.n <= CONFIG.league8 ? [" · ", ro(`${r}.grades`, grade, formatGrades(grade))] : []);
        const head = h("p", { class: "prx-pt-row-head" }, ruleName(r), chosen ? h("span", { class: "prx-pt-row-tag", text: ` · ${T.shown}` }) : null);
        return h("li", { class: `prx-pt-row prx-light-panel${chosen ? " prx-pt-row-chosen" : ""}`, "data-prx-row": r, "data-prx-result-scope": "" },
          head, orderLine(mdl, r), chips(mdl, grade, pal), nums,
          h("p", { class: "prx-pt-row-label" }, ...scopeParts(mdl, r, res, G, r)), tieLine(mdl, res), gapLine(mdl, r, res, opt, fracMode));
      }


  return { scopeParts, drawRow, chips, gapLine };
}
