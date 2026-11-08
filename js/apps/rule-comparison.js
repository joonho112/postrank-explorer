import { createWidget, uid } from "../shared/base.js";
import { canvasLayer, numText, plot } from "../shared/chart.js";
import { formatCount, formatExpectedCount, formatGrades, formatProb, formatRisk, formatSci, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import {
  LEAGUE_SEED, drawLeague, league30, disclosure, errorArray, evaluateReport, evidenceFlags, expectedRank, fixedOrderDP, lowerHull, matchedDisclosure,
  normalPosterior, orderHull, reportCloud, ruleGap, statedAgainst, strictOrder, summaryStats, supportingVertex, tierGrades,
} from "../pr-core.js";


export const CONFIG = Object.freeze({
  name: "rule-comparison",
  label: "Comparing rules at the same disclosure: common rules as points beside the frontier H(m), with each rule's gap at its own N",
  title: "Common rules beside the frontier, compared at their own N",
  className: "prx-rcmp",
  datas: Object.freeze(["league8", "league30"]),
  data: "league8",
  families: Object.freeze(["all", "cap3"]),
  family: "all",
  matches: Object.freeze(["n", "tau"]),
  match: "n",
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  rules: Object.freeze(["tiers2", "tiers3", "tiers4", "flags", "pmtiers", "pmcuts", "ercuts", "strict", "best", "withheld"]),
  rule: "pmtiers",
  n8: 8,
  cap: 3,
  tierCounts: Object.freeze({ tiers2: 2, tiers3: 3, tiers4: 4 }),
  prior: Object.freeze({ mean: 0, sd: 0.15 }),
  crit: 1.96,
  // two rule points closer than this (in E, with the same N) are one labeled point
  sameTol: 1e-9,
  // equal-risk tolerance: a risk this close to τ counts as equal to the all-withheld risk
  tieTol: 1e-12,
  memoSize: 200,
  yHead: 1.12,
  yRound: 10,
  yRound30: 0.1,
  chart: Object.freeze({
    aspect: 0.62, minHeight: 260, maxHeight: 440, marginTop: 24, marginRight: 24, marginBottom: 42, marginLeft: 50,
    column: 1.5, minDot: 2.5, triangle: 3.5, hullWidth: 2, hullDash: "7 4", vertexDot: 3.5, ruleDot: 5, ring: 10,
    ringWidth: 2, gapWidth: 3.5, mixDot: 6, bestSquare: 7, cross: 7, lineWidth: 1.5, parallelDash: "3 3", tagGap: 8,
    halo: 3, roomyTags: 420, ticks8: 4, xPad: 0.6, xPad30: 6, tagFlip: 0.8, thin: 1.25, vertexRing: 7.5, crossWidth: 1.5, dotStroke: 1, tagWeight: 600,
  }),
  text: Object.freeze({
    dataLegend: "Units",
    data8: "Eight units, U01 to U08 (every report evaluated)",
    data30: "All thirty units (the boundary within one order)",
    familyLegend: "Family of reports",
    familyAll8: "all reports",
    familyCap8: "at most three grades",
    familyAll30: "contiguous cuts of the posterior-mean order",
    familyCap30: "the same cuts, at most three grades",
    reports: "reports",
    matchLegend: "Compare",
    matchN: "at the same N (each rule against H at its own N)",
    matchTau: "at the same τ (risks of reports that disclose different amounts)",
    slider: "Withholding cost τ",
    sliderHint: "The cuts (PC, RC), the best report (B) and every risk use this τ; the rules that do not use τ (T2 to T4, F, PT, S, W) stay where they are.",
    ruleLabel: "Rule (the read-out and the marks follow this one)",
    conditionsTitle: "Comparison conditions",
    xLabel: "pairs stated, N",
    yLabel: "expected wrong directions, E",
    tableTitle: "Each rule under the same posterior",
    tableCaption: "Rules by the pairs they state and their expected wrong directions",
    keyboardLabel: "Rule points. Use the arrow keys to read each rule.",
    chartAlt: "Each common rule as a point at the pairs it states, N, and its expected wrong directions, E.",
    chartAltCloud: " Gray columns span the reports of the family at each N, and the dashed lower boundary H(m) runs through its vertices.",
    chartAltOrder: " The dashed line is the boundary of the contiguous cuts of the posterior-mean order.",
    onFrontier: "on the frontier",
    onBoundary: "on the boundary within this order",
    outside: "outside this family",
    above: "risk above all-withheld at this τ",
    scope: "The gap compares the rule with the lowest expected error count at its own disclosure.",
    scopeTau: "Risk combines expected errors and withholding costs at the chosen τ.",
    tauLines: "Points on one line of slope τ have equal risk, and a lower line means a lower risk. The gap between the two lines mixes errors with disclosure.",
    legendTags: "tags as in the table; tags joined by = mark rules at the same (N, E) point",
    legendVertices: "the two vertices it mixes",
    legendCloud: "reports of the family at each N, from the smallest to the largest E",
    legendAboveView: "the column continues above the view",
    legendHull: "the lower boundary H(m) and its vertices",
    legendHull30: "the boundary within the posterior-mean order and its vertices",
    legendRule: "a rule inside the family",
    legendOutside: "a rule outside the family (no benchmark here)",
    legendRing: "the chosen rule",
    legendGap: "its gap at its own N",
    legendMix: "H at that N:",
    legendBest: "the best single report with exactly that N",
    legendCross: "risk above all-withheld at this τ",
    legendLine: "the line of slope τ touching the boundary",
    legendParallel: "a line of the same slope through the chosen rule",
    note8: "The simulated league (frozen draw), units U01 to U08, under its teaching posterior. Every report of the family is evaluated in this browser.",
    note30: "The simulated league (frozen draw), all thirty units, under its teaching posterior. The boundary within the posterior-mean order is computed exactly in this browser; the reports outside that order are not searched.",
  }),
  names: Object.freeze({
    tiers2: "Estimate tiers, two tiers",
    tiers3: "Estimate tiers, three tiers",
    tiers4: "Estimate tiers, four tiers",
    flags: "Flags from standardized evidence",
    pmtiers: "Posterior-mean tiers, three tiers",
    pmcuts: "Optimal cuts of the posterior-mean order, at most three grades",
    ercuts: "Optimal cuts of the expected-rank order, at most three grades",
    strict: "Strict estimate order",
    best: "Best report of the family at τ",
    withheld: "All-withheld",
  }),
  tags: Object.freeze({
    tiers2: "T2", tiers3: "T3", tiers4: "T4", flags: "F", pmtiers: "PT", pmcuts: "PC", ercuts: "RC", strict: "S", best: "B", withheld: "W",
  }),
});

// ---------------------------------------------------------------------------------------------- data and models

const LEAGUE = league30();
const UNITS = { id: LEAGUE.ids, se: LEAGUE.se, estimate: drawLeague(LEAGUE_SEED).estimate };
const REF = summaryStats(UNITS.estimate).mean;
const familyOf = (data, key, scores) => {
  if (data === "league8") return key === "cap3" ? { kind: "atMost", G: CONFIG.cap } : { kind: "all" };
  return key === "cap3" ? { scores, direction: "descending", G: CONFIG.cap } : { scores, direction: "descending" };
};

const dataModels = new Map();
/** The units, their posterior and its error array (cached; nothing here depends on τ or the family). */
export function dataModel(data) {
  if (dataModels.has(data)) return dataModels.get(data);
  const n = data === "league8" ? CONFIG.n8 : UNITS.id.length;
  const ids = UNITS.id.slice(0, n);
  const est = UNITS.estimate.slice(0, n);
  const se = UNITS.se.slice(0, n);
  const post = normalPosterior(est, se, { priorMean: CONFIG.prior.mean, priorSd: CONFIG.prior.sd });
  const E = errorArray(post.mean.map((v) => [v]), post.sd.map((v) => [v]), { ids, criteria: ["theta"] });
  const er = expectedRank(E, {});
  const fixed = {
    tiers2: tierGrades(est, CONFIG.tierCounts.tiers2, { direction: "descending" }),
    tiers3: tierGrades(est, CONFIG.tierCounts.tiers3, { direction: "descending" }),
    tiers4: tierGrades(est, CONFIG.tierCounts.tiers4, { direction: "descending" }),
    flags: evidenceFlags(est, se, { ref: REF, crit: CONFIG.crit }).grade,
    pmtiers: tierGrades(post.mean, CONFIG.cap, { direction: "descending" }),
    strict: strictOrder(est, { direction: "descending" }),
    withheld: new Array(n).fill(1),
  };
  const m = { data, n, ids, est, se, post, E, er, fixed };
  dataModels.set(data, m);
  return m;
}

const famModels = new Map();
/** The family's boundary (and, on the eight units, the cloud): cached, they do not depend on τ. */
export function famModel(data, key) {
  const id = `${data}:${key}`;
  if (famModels.has(id)) return famModels.get(id);
  const d = dataModel(data);
  const family = familyOf(data, key, d.post.mean);
  let m;
  if (data === "league8") {
    const cloud = reportCloud(d.E, { family });
    const hull = lowerHull(cloud);
    m = { data, key, family, cloud, hull, M: cloud.M, famResult: cloud };
  } else {
    const hull = orderHull(d.E, family);
    // the family's name and size (and its label) come from the DP over the same family
    const probe = fixedOrderDP(d.E, { ...family, tau: CONFIG.tau.value });
    m = { data, key, family, cloud: null, hull, M: probe.evaluation?.M ?? evaluateReport(probe.grade, d.E, { tau: CONFIG.tau.value }).M, famResult: probe };
  }
  famModels.set(id, m);
  return m;
}

/** Why a report is outside the family, or null when it is inside. */
function outsideReason(data, key, g, d) {
  const G = disclosure(g).G;
  if (key === "cap3" && G > CONFIG.cap) return { kind: "grades", G };
  if (data === "league30") {
    const against = statedAgainst(g, d.post.mean, { direction: "descending" }).count;
    if (against > 0) return { kind: "order", against };
  }
  return null;
}

const memo = new Map();
/** Every rule at one setting: grade, evaluation, membership, gap and the mixture at its N. */
export function rulesAt(data, key, tau) {
  const id = `${data}:${key}:${tau}`;
  if (memo.has(id)) return memo.get(id);
  if (memo.size > CONFIG.memoSize) memo.clear();
  const d = dataModel(data);
  const f = famModel(data, key);
  const pmcuts = fixedOrderDP(d.E, { scores: d.post.mean, direction: "descending", G: CONFIG.cap, tau });
  const ercuts = fixedOrderDP(d.E, { scores: d.er, direction: "ascending", G: CONFIG.cap, tau });
  let best;
  let bestSource;
  let bestTies = [];
  if (data === "league8") {
    const sv = supportingVertex(f.hull, tau, { M: f.M });
    best = sv.vertex.grade;
    bestTies = sv.vertices.slice(1).map((v) => v.grade);
    bestSource = f.cloud;
  } else {
    const dp = fixedOrderDP(d.E, { ...f.family, tau });
    best = dp.grade;
    // DP grades may be lexicographic; keep its package representative first, then every other returned tie.
    bestTies = dp.grades.filter(g => !g.every((v, i) => v === best[i])).map(g => Array.from(g));
    bestSource = dp;
  }
  const grades = { ...d.fixed, pmcuts: pmcuts.grade, ercuts: ercuts.grade, best };
  const allWithheld = evaluateReport(d.fixed.withheld, d.E, { tau });
  const rows = CONFIG.rules.map((r) => {
    const g = Array.from(grades[r]);
    const ev = evaluateReport(g, d.E, { tau });
    const outside = outsideReason(data, key, g, d) ?? (ev.N < f.hull[0].N || ev.N > f.hull.at(-1).N ? { kind: "range" } : null);
    const gap = outside ? null : ruleGap(g, d.E, { hull: f.hull, tieTol: CONFIG.tieTol });
    const mix = outside ? null : matchedDisclosure(f.cloud, f.hull, ev.N);
    const above = ev.risk - allWithheld.risk > CONFIG.tieTol;
    return { rule: r, g, ev, outside, gap, mix, above, G: disclosure(g).G };
  });
  const out = { rows, byRule: Object.fromEntries(rows.map((x) => [x.rule, x])), bestSource, bestTies, allWithheld, pmcuts, ercuts };
  memo.set(id, out);
  return out;
}

const niceTop8 = (v) => Math.ceil(v * CONFIG.yHead * CONFIG.yRound) / CONFIG.yRound;
const niceTop30 = (v) => Math.ceil(v * CONFIG.yHead * CONFIG.yRound30) / CONFIG.yRound30;

// ---------------------------------------------------------------------------------------------- widget

export function comparisonKeys({ fullModes = false, match = "n" } = {}) {
  return {
    data: { type: "choice", values: fullModes ? CONFIG.datas.slice() : ["league8"], value: "league8" },
    family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
    match: { type: "choice", values: fullModes ? CONFIG.matches.slice() : ["n"], value: match },
    tau: { type: "number", ...CONFIG.tau },
    rule: { type: "choice", values: CONFIG.rules.slice(), value: CONFIG.rule },
  };
}

/** Full R-04 presentation. Returned builders share the same model and current controls. */
export function createComparisonView(ctx, { fullModes = false } = {}) {
      const { h } = ctx;
      const T = CONFIG.text;
      let cloudLayer = null;
      ctx.onCleanup(() => cloudLayer?.remove());

      const ro = (name, raw, display) => {
        const node = ctx.num(raw, display);
        node.setAttribute("data-prx-readout", name);
        return node;
      };
      const E4 = (v) => formatExpectedCount(v);
      const gradeNode = (name, g) => { const node = name ? ro(name, Array.from(g), formatGrades(Array.from(g))) : ctx.num(Array.from(g), formatGrades(Array.from(g))); node.classList.add("prx-rcmp-grade"); return node; };
      const famNode = (result) => { const node = familyNameNode(ctx, result); node.classList.add("prx-rcmp-sym"); return node; };
      const tauNode = (tau) => ctx.num(tau, formatSetting(tau));
      const nameOf = (r) => CONFIG.names[r];
      const tagNode = (r) => h("span", { class: "prx-rcmp-tag", "data-prx-name": "" }, CONFIG.tags[r]);

      // --- controls
      const dataSwitch = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-rcmp-row",
        options: [{ value: "league8", label: T.data8 }, { value: "league30", label: T.data30 }],
        value: ctx.state.data, onChange: (v) => ctx.set({ data: v }),
      });
      const famLabel = (data, key) => {
        const f = famModel(data, key);
        const words = data === "league8" ? (key === "all" ? T.familyAll8 : T.familyCap8) : (key === "all" ? T.familyAll30 : T.familyCap30);
        return [famNode(f.famResult), " · ", ctx.num(f.famResult.family.size, formatCount(f.famResult.family.size)), ` ${T.reports} (${words})`];
      };
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend, name: "family", className: "prx-rcmp-row",
        options: CONFIG.families.map((k) => ({ value: k, label: famLabel(CONFIG.data, k) })),
        value: ctx.state.family, onChange: (v) => ctx.set({ family: v }),
      });
      let labelledFor = CONFIG.data;
      const matchSwitch = ctx.radioGroup({
        legend: T.matchLegend, name: "match", className: "prx-rcmp-row",
        options: [{ value: "n", label: T.matchN }, { value: "tau", label: T.matchTau }],
        value: ctx.state.match, onChange: (v) => ctx.set({ match: v }),
      });
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderHint, onInput: (v) => ctx.set({ tau: v }),
      });
      const ruleSelect = ctx.select({
        label: T.ruleLabel, name: "rule", value: ctx.state.rule, onChange: (v) => ctx.set({ rule: v }),
        options: CONFIG.rules.map((r) => ({ value: r, label: `${CONFIG.tags[r]}: ${nameOf(r)}` })),
      });
      if (fullModes) {
        ctx.controls.append(dataSwitch.root, tau.root, ruleSelect.root);
        ctx.afterPresets(familySwitch.root, matchSwitch.root);
      } else ctx.controls.append(familySwitch.root, tau.root, ruleSelect.root);

      // --- the comparison conditions (always shown), the live read-out and the label
      const conditions = h("section", { class: "prx-rcmp-conditions", "data-prx-part": "notes" });
      const conditionsDetail = fullModes ? ctx.disclosure({ name: "conditions", title: "What is held fixed", placement: "none" }) : null;
      const mixture = fullModes ? null : ctx.disclosure({ name: "mixture", title: "How the boundary is reached", placement: "none" });
      const labelLine = h("p", { class: "prx-rcmp-label", "data-prx-part": "readout" });

      // --- the figure, its legend, the table
      const chartSlot = h("div", { class: "prx-rcmp-chart" });
      const legend = h("div", { class: "prx-rcmp-legend prx-light-panel", "data-prx-part": "legend" });
      const tableBox = h("section", { class: "prx-rcmp-table-box", "data-prx-part": "table" });
      const rankSlot = fullModes ? h("div", { class: "prx-rcmp-ranks" }) : null;
      const rankHeading = rankSlot ? h("p", { class: "prx-rcmp-rank-headings" }) : null;
      const rankChart = rankSlot ? h("div") : null;
      const rankNote = rankSlot ? h("p", { class: "prx-rcmp-note", text: "Rules outside the family have no gap rank." }) : null;
      if (rankSlot) rankSlot.append(rankHeading, rankChart, rankNote);
      ctx.primaryControl(fullModes ? matchSwitch.root : ruleSelect.root);
      ctx.primaryGraphic(rankSlot ?? chartSlot);
      if (rankSlot) ctx.charts.append(rankSlot);
      ctx.charts.append(chartSlot, legend, labelLine);
      if (mixture) ctx.charts.append(mixture.root);
      ctx.charts.append(conditions, tableBox);

      // ------------------------------------------------------------------------------------- drawing

      function drawConditions(state, d, f) {
        const units = state.data === "league8"
          ? [h("span", { "data-prx-name": "" }, "U01"), " to ", h("span", { "data-prx-name": "" }, "U08")]
          : ["all ", ctx.num(d.n, formatCount(d.n)), " league units"];
        const items = [
          h("li", {}, h("strong", {}, "Same posterior. "), "Every rule is evaluated under one posterior for ", ...units,
            ": the teaching posterior (normal prior, mean ", ctx.num(CONFIG.prior.mean, formatCount(CONFIG.prior.mean)),
            ", SD ", ctx.num(CONFIG.prior.sd, formatSetting(CONFIG.prior.sd)), "), ", captionNode(ctx, "teaching-posterior"), "."),
        ];
        if (state.match === "n") {
          items.push(h("li", {}, h("strong", {}, "Same N. "), state.data === "league8"
            ? "Each rule is compared with H at its own N: the fewest expected wrong directions that a report of the family, or a mixture of two, has while stating as many pairs on average."
            : "Each rule is compared with the boundary within the posterior-mean order at its own N: the fewest expected wrong directions among those cuts, or a mixture of two, at that N."));
        } else {
          items.push(h("li", {}, h("strong", {}, "Same τ. "), "Every risk is at τ = ", tauNode(state.tau), ", but N differs: ",
            captionNode(ctx, "different-disclosure"), "; ", captionNode(ctx, "tau-not-compared"), ". ", T.tauLines));
        }
        const fam = f.famResult;
        items.push(h("li", {}, h("strong", {}, "Family. "), famNode(fam), ", ", familySizeNode(ctx, fam), ` ${T.reports}`,
          state.data === "league8" ? ", every one evaluated." : " (contiguous cuts of the posterior-mean order; the other reports are not searched). The rules outside it have no benchmark here."));
        items.push(h("li", { class: "prx-rcmp-scope" }, state.match === "n" ? T.scope : T.scopeTau));
        const flags = h("p", { class: "prx-rcmp-note" }, "The flags use the cutoff ", ctx.num(CONFIG.crit, formatSetting(CONFIG.crit)),
          " and the mean of the ", ctx.num(UNITS.id.length, formatCount(UNITS.id.length)), " league estimates as the reference.");
        if (conditionsDetail) {
          const [first, ...more] = items;
          conditionsDetail.body.replaceChildren(h("ul", { class: "prx-rcmp-list" }, ...more), flags);
          conditions.replaceChildren(ctx.panelTitle(T.conditionsTitle, { className: "prx-rcmp-heading" }),
            h("ul", { class: "prx-rcmp-list" }, first), conditionsDetail.root);
        } else {
          conditions.replaceChildren(ctx.panelTitle(T.conditionsTitle, { className: "prx-rcmp-heading" }), h("ul", { class: "prx-rcmp-list" }, ...items), flags);
        }
      }

      function drawReadout(state, d, f, at) {
        const x = at.byRule[state.rule];
        if (mixture) {
          mixture.root.hidden = true;
          mixture.body.replaceChildren();
        }
        const name = h("strong", {}, nameOf(state.rule));
        const Nn = (name2) => (name2 ? ro(name2, x.ev.N, formatCount(x.ev.N)) : ctx.num(x.ev.N, formatCount(x.ev.N)));
        const parts = [name, " (", tagNode(state.rule), ") states N = ", Nn("N"), " of ", ctx.num(x.ev.M, formatCount(x.ev.M)), " pairs with E = ", ro("E", x.ev.Ew, E4(x.ev.Ew)), ". "];
        const boundary = state.data === "league8" ? ["H(", Nn(), ")"] : ["the boundary within this order"];
        const onIt = state.data === "league8" ? T.onFrontier : T.onBoundary;
        if (state.match === "n") {
          if (x.outside) {
            parts.push(x.outside.kind === "grades"
              ? ["It uses ", ro("G", x.G, formatCount(x.G)), " grades, so it is ", T.outside, " (", famNode(f.famResult), "): no benchmark here. Switch the family to compare it."]
              : x.outside.kind === "range" ? ["Its N is outside the boundary range of this family: no benchmark here."] : ["It states ", ro("against", x.outside.against, formatCount(x.outside.against)), " directions against the posterior-mean order, so it is ", T.outside,
                " (", famNode(f.famResult), "): no benchmark here."], " ");
          } else if (x.gap.gap === 0) {
            parts.push(["Its gap to ", ...boundary, " at N = ", Nn(), " is ", ro("gap", x.gap.gap, E4(x.gap.gap)), ": the rule's report is a vertex, ", onIt, ". "]);
          } else {
            parts.push(["At N = ", Nn(), ", ", ...boundary, " = ", ro("H", x.gap.H, E4(x.gap.H)), ", so its gap is ", ro("gap", x.gap.gap, E4(x.gap.gap)), " expected wrong directions. "]);
            if (x.mix.psi > 0) {
              const steps = [["No vertex sits at this N: ", ...boundary, " is reached by printing ", gradeNode("upperGrade", x.mix.upper.grade), " (N = ", ro("upperN", x.mix.upper.N, formatCount(x.mix.upper.N)),
                ") with chance ψ = ", ro("psi", x.mix.psi, formatProb(x.mix.psi)), " and ", gradeNode("lowerGrade", x.mix.lower.grade), " (N = ", ro("lowerN", x.mix.lower.N, formatCount(x.mix.lower.N)),
                ") otherwise, ", captionNode(ctx, "mixture-not-report"), ". "]];
              if (x.mix.best) steps.push(["The best single report that states exactly ", Nn(), " pairs, ", gradeNode("bestGrade", x.mix.best.grade), ", has E = ", ro("bestE", x.mix.best.Ew, E4(x.mix.best.Ew)), ". "]);
              if (mixture) {
                mixture.root.hidden = false;
                mixture.body.append(...steps.map(line => h("p", {}, ...line)));
              } else parts.push(...steps);
            } else {
              parts.push(["The vertex at this N is the report ", gradeNode("vertexGrade", x.mix.lower.grade), ", one we can print. "]);
            }
          }
        } else {
          const b = at.byRule.best;
          parts.push(["At τ = ", tauNode(state.tau), " its risk is ", ro("risk", x.ev.risk, formatRisk(x.ev.risk)), ". "]);
          if (state.rule !== "best") {
            parts.push(["The best report of the family at this τ, ", gradeNode("bestTauGrade", b.g), ", has risk ", ro("bestRisk", b.ev.risk, formatRisk(b.ev.risk)), " and states N = ",
              ro("bestN", b.ev.N, formatCount(b.ev.N)), b.ev.N === x.ev.N ? ", the same N. " : [": ", captionNode(ctx, "different-disclosure"), ". Compare at the same N to compare the errors. "]]);
          }
        }
        if (x.above) {
          parts.push(["Its risk is above the all-withheld risk at this τ: E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " is above τ = ", tauNode(state.tau), "."]);
        }
        ctx.readout.set(parts.flat(Infinity));
      }

      function drawLabel(state, f, at) {
        if (state.data === "league8") {
          const src = f.cloud;
          const parts = [labelNode(ctx, src), " (", familySizeNode(ctx, src), ` ${T.reports}, every one evaluated): the boundary H(m), its vertices and the best report at τ = `, tauNode(state.tau), ", ",
            gradeNode("bestTau", at.byRule.best.g)];
          if (at.bestTies.length) parts.push(" (tied with ", ...at.bestTies.flatMap((g, k) => [k ? ", " : "", gradeNode(null, g)]), ")");
          parts.push(". ",h("span",{"data-prx-tolerance-label":""},"Equal-risk tolerance")," ",ctx.num(CONFIG.tieTol, formatSci(CONFIG.tieTol, { trim: true })), ".");
          labelLine.replaceChildren(...parts);
        } else {
          const dp = at.bestSource;
          const parts = [labelNode(ctx, dp), " (not H(m)) in ", famNode(dp), " (", familySizeNode(ctx, dp), ` ${T.reports}): the boundary and the best report at τ = `,
            tauNode(state.tau), ", ", gradeNode("bestTau", at.byRule.best.g), " (N = ", ro("bestTauN", at.byRule.best.ev.N, formatCount(at.byRule.best.ev.N)), "). ",h("span",{"data-prx-tolerance-label":""},"Equal-risk tolerance")," ",
            ro("bestTieTol", dp.tieTol, formatSci(dp.tieTol, { trim: true })), "."];
          if (Number(dp.tieCount) > 1) {
            const tied = [at.byRule.best.g, ...at.bestTies].map(g => ({g, ev:evaluateReport(g, dataModel(state.data).E, {tau:state.tau})}));
            parts.push(" ", ro("bestTieCount", dp.tieCount, formatCount(dp.tieCount)), " reports share the smallest risk within this order. ",
              h("span", {"data-prx-best-tie-policy":""}, "The read-out and B point use the first representative below: fewer grades, then earlier cuts."), " Tied reports: ",
              ...tied.flatMap(({g,ev},i) => [i ? "; " : "", h("span", {"data-prx-best-tie":i}, gradeNode(`bestTieGrades.${i}`,g),
                " (N = ", ro(`bestTieN.${i}`,ev.N,formatCount(ev.N)), ", E = ", ro(`bestTieE.${i}`,ev.Ew,E4(ev.Ew)), ", risk ", ro(`bestTieRisk.${i}`,ev.risk,formatRisk(ev.risk)), ")")]), ".");
            if (tied.some(t => t.ev.N !== tied[0].ev.N)) parts.push(" ",captionNode(ctx,"different-disclosure"),".");
            if (Number(dp.tieCount) > tied.length) parts.push(" ",ctx.num(Number(dp.tieCount)-tied.length,formatCount(Number(dp.tieCount)-tied.length))," further equal-risk reports are not listed.");
          }
          labelLine.replaceChildren(...parts);
        }

      }

      function groupsOf(rows) {
        const groups = [];
        for (const x of rows) {
          const g = groups.find((y) => y.N === x.ev.N && Math.abs(y.Ew - x.ev.Ew) <= CONFIG.sameTol);
          if (g) g.rules.push(x);
          else groups.push({ N: x.ev.N, Ew: x.ev.Ew, rules: [x] });
        }
        for (const g of groups) {
          g.tag = g.rules.map((x) => CONFIG.tags[x.rule]).join("=");
          g.inside = g.rules.some((x) => !x.outside);
          g.above = g.rules.some((x) => x.above);
        }
        return groups;
      }

      function drawChart(state, d, f, at, show) {
        const C = CONFIG.chart;
        const M = f.M;
        const sel = at.byRule[state.rule];
        const groups = groupsOf(at.rows);
        const ruleMax = Math.max(...at.rows.map((x) => x.ev.Ew));
        const yTop = state.data === "league8" ? niceTop8(Math.max(ruleMax, f.hull.at(-1).Ew)) : niceTop30(Math.max(ruleMax, f.hull.at(-1).Ew));
        const width = Math.max(1, Math.round(chartSlot.clientWidth || ctx.width()));
        const height = Math.max(C.minHeight, Math.min(C.maxHeight, Math.round(width * C.aspect)));
        const inner = width - C.marginLeft - C.marginRight;
        const roomy = inner >= C.roomyTags;
        const cols = show && f.cloud ? f.cloud.byN.map((r) => ({ ...r, top: Math.min(r.maxEw, yTop), above: r.maxEw > yTop })) : [];
        const hull = show ? f.hull.filter((v) => v.Ew <= yTop) : [];
        const gapOn = show && state.match === "n" && !sel.outside && sel.gap.gap !== 0;
        const mixOn = gapOn && sel.mix.psi > 0;
        const tauOn = show && state.match === "tau";
        let lines = [];
        if (tauOn) {
          const sv = supportingVertex(f.hull, state.tau, { M });
          const through = (N0, E0) => {
            const c = E0 - state.tau * N0;
            const x0 = Math.max(0, -c / state.tau);
            const x1 = Math.min(M, (yTop - c) / state.tau);
            return x1 > x0 ? [{ N: x0, y: c + state.tau * x0 }, { N: x1, y: c + state.tau * x1 }] : [];
          };
          lines = [{ kind: "support", pts: through(sv.vertex.N, sv.vertex.Ew) }];
          if (state.rule !== "best") lines.push({ kind: "parallel", pts: through(sel.ev.N, sel.ev.Ew) });
        }
        const xticks = state.data === "league8" ? Array.from({ length: Math.floor(M / C.ticks8) + 1 }, (_, k) => k * C.ticks8) : undefined;
        const xPad = state.data === "league8" ? C.xPad : C.xPad30;
        const titleOf = (g) => {
          const names = g.rules.map((x) => `${CONFIG.tags[x.rule]} (${nameOf(x.rule)})`).join(", ");
          let s = `${names}: N = ${formatCount(g.N)}, E = ${E4(g.Ew)}.`;
          if (!g.inside) s += ` ${T.outside}.`;
          if (show && g.inside && state.match === "n") {
            const x = g.rules.find((y) => !y.outside);
            s += x.gap.gap === 0 ? ` ${state.data === "league8" ? T.onFrontier : T.onBoundary}.` : ` Gap at its own N: ${E4(x.gap.gap)}.`;
          }
          if (g.above) s += ` ${T.above}.`;
          return s;
        };
        cloudLayer?.remove(); cloudLayer = null;
        const figure = plot(chartSlot, {
          alt: T.chartAlt + (show ? (f.cloud ? T.chartAltCloud : T.chartAltOrder) : ""),
          table: {
            caption: T.tableCaption,
            columns: [
              { label: "Rule", value: (g) => g.tag, header: true },
              { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v) },
              { label: "Expected wrong directions, E", value: "Ew", format: (v) => E4(v) },
            ],
            rows: groups,
          },
          width, height,
          marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
          x: { domain: [-xPad, M + xPad], ticks: xticks, tickFormat: (v) => formatCount(v), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, yTop], label: T.yLabel, labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => {
            const marks = [];
            if (cols.length) {
              marks.push(
                ...(fullModes ? [P.dot(cols.filter((r) => r.above), { x: "N", y: () => yTop, symbol: "triangle", r: C.triangle, fill: c.neutral[3] })] : []),
                P.dot(cols, { x: "N", y: "minEw", r: C.minDot, fill: c.neutral[4] }),
              );
            }
            if (show) {
              marks.push(
                P.line(f.hull, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
                P.dot(hull, { x: "N", y: "Ew", r: C.vertexDot, fill: c.plotFg, stroke: c.plotBg }),
              );
            }
            for (const ln of lines) {
              if (ln.pts.length) {
                marks.push(P.line(ln.pts, { x: "N", y: "y", stroke: ln.kind === "support" ? c.plotFg : c.plotMuted, strokeWidth: C.lineWidth, strokeDasharray: ln.kind === "support" ? null : C.parallelDash, clip: true }));
              }
            }
            if (gapOn) {
              marks.push(P.ruleX([{ N: sel.ev.N, y1: sel.gap.H, y2: sel.ev.Ew }], { x: "N", y1: "y1", y2: "y2", stroke: c.err, strokeWidth: C.gapWidth }));
            }
            if (mixOn) {
              if (sel.mix.best) marks.push(P.dot([sel.mix.best], { x: () => sel.ev.N, y: "Ew", symbol: "square", r: C.bestSquare, fill: "none", stroke: c.plotFg, strokeWidth: C.thin }));
              marks.push(
                P.dot([sel.mix.lower, sel.mix.upper], { x: "N", y: "Ew", symbol: "hexagon", r: C.vertexRing, fill: "none", stroke: c.plotFg, strokeWidth: C.thin }),
                P.dot([{ N: sel.ev.N, H: sel.gap.H }], { x: "N", y: "H", symbol: "diamond", r: C.mixDot, fill: c.plotBg, stroke: c.plotFg, strokeWidth: 2 }),
              );
            }
            marks.push(
              P.dot(groups.filter((g) => g.inside), { title: titleOf, x: "N", y: "Ew", r: C.ruleDot, fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.dotStroke }),
              P.dot(groups.filter((g) => !g.inside), { title: titleOf, x: "N", y: "Ew", r: C.ruleDot, fill: c.plotBg, stroke: c.neutral[5], strokeWidth: 2 }),
              P.dot(groups.filter((g) => g.above), { x: "N", y: "Ew", symbol: "times", r: C.cross, stroke: c.plotMuted, strokeWidth: C.crossWidth }),
              P.dot([sel.ev], { x: "N", y: "Ew", r: C.ring, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }),
            );
            // tags: to the right of a point, or to its left near the right edge (Plot's dx is a constant, so two marks)
            const selectedGroup = groups.find(g => g.rules.some(x => x.rule === state.rule));
            const tagged = groups.filter(g => !fullModes || roomy || g === selectedGroup);
            const answer = state.match === "tau" ? { value: sel.ev.risk, display: formatRisk }
              : sel.outside ? null : show ? { value: sel.gap.gap, display: E4 }
              : { value: sel.ev.Ew, display: E4 };
            const tagOpts = { x: "N", y: "Ew", text: "tag", fontSize: !fullModes && !roomy ? 10 : undefined, dy: -C.tagGap, fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo, paintOrder: "stroke", fontWeight: C.tagWeight };
            const tagY = g => {
              // Alternate labels of nearby groups around the middle cluster in the compact matched-N view.
              if (fullModes || roomy || g === selectedGroup || Math.abs(g.N - selectedGroup.N) > 3
                  || Math.abs(g.Ew - selectedGroup.Ew) > yTop / 7) return g.Ew;
              const span = height - C.marginTop - C.marginBottom;
              return g.Ew + (g.Ew < selectedGroup.Ew ? -12 : 13) * yTop / span;
            };
            marks.push(
              P.text(tagged.filter((g) => g.N <= M * C.tagFlip), { ...tagOpts, y: tagY, dx: C.tagGap, textAnchor: "start" }),
              P.text(tagged.filter((g) => g.N > M * C.tagFlip), { ...tagOpts, y: tagY, dx: -C.tagGap, textAnchor: "end" }),
            );
            const left = selectedGroup.N > M * C.tagFlip;
            const label = { ...tagOpts, dy: C.tagGap + 4, dx: left ? -C.tagGap : C.tagGap, textAnchor: left ? "end" : "start" };
            if (answer) {
              marks.push(numText([selectedGroup], { ...label, value: () => answer.value, format: answer.display }));
            } else marks.push(P.text([selectedGroup], { ...label, text: () => "no benchmark" }));
            if (!fullModes && gapOn) {
              const boundary = [{ N: sel.ev.N, H: sel.gap.H }];
              const near = { ...tagOpts, y: "H", dy: -10, textAnchor: left ? "start" : "end" };
              marks.push(P.text(boundary, { ...near, text: () => "H", dx: left ? 10 : -47 }),
                numText(boundary, { ...near, value: "H", format: E4, dx: left ? 23 : -10 }));
            }
            return marks;
          },
          keyboard: { data: groups, x: "N", y: "Ew", key: (g) => g.tag, label: T.keyboardLabel, title: titleOf },
        });
        if(cols.length) cloudLayer = canvasLayer(figure, (g, {x,y,palette}) => {
          g.save(); g.beginPath(); g.rect(x(0),y(yTop),x(M)-x(0),y(0)-y(yTop)); g.clip();
          g.strokeStyle=palette.neutral[3]; g.lineWidth=C.column; g.beginPath();
          for(const r of cols){g.moveTo(x(r.N),y(r.minEw));g.lineTo(x(r.N),y(r.top));}
          g.stroke();g.restore();
        });
        return { yTop, cols };
      }

      function drawLegend(state, f, at, show, info) {
        const key = (cls, ...text) => h("span", { class: "prx-rcmp-key" }, h("span", { class: `prx-rcmp-swatch ${cls}`, "aria-hidden": "true" }), h("span", {}, ...text));
        const items = [key("prx-rcmp-sw-rule", T.legendRule), key("prx-rcmp-sw-tag", T.legendTags)];
        if (at.rows.some((x) => x.outside)) items.push(key("prx-rcmp-sw-outside", T.legendOutside));
        items.push(key("prx-rcmp-sw-ring", T.legendRing));
        if (at.rows.some((x) => x.above)) items.push(key("prx-rcmp-sw-cross", T.legendCross, " (τ = ", tauNode(state.tau), ")"));
        if (show) {
          if (f.cloud) {
            items.push(key("prx-rcmp-sw-cloud", T.legendCloud));
            if (fullModes && info.cols.some((r) => r.above)) items.push(key("prx-rcmp-sw-above", T.legendAboveView));
          }
          items.push(key("prx-rcmp-sw-hull", f.cloud ? T.legendHull : T.legendHull30));
          const sel = at.byRule[state.rule];
          if (state.match === "n" && !sel.outside && sel.gap.gap !== 0) {
            items.push(key("prx-rcmp-sw-gap", T.legendGap));
            if (sel.mix.psi > 0) {
              items.push(key("prx-rcmp-sw-mix", state.data === "league8" ? T.legendMix : "the order boundary at that N:", " ", captionNode(ctx, "mixture-not-report")), key("prx-rcmp-sw-vertices", T.legendVertices));
              if (sel.mix.best) items.push(key("prx-rcmp-sw-best", T.legendBest));
            }
          }
          if (state.match === "tau") { items.push(key("prx-rcmp-sw-line", T.legendLine)); if(state.rule !== "best")items.push(key("prx-rcmp-sw-parallel", T.legendParallel)); }
        }
        legend.replaceChildren(...items);
      }

      function drawTable(state, d, f, at, show) {
        const th = (...t) => h("th", { scope: "col" }, ...t);
        const notes = (x) => {
          const out = [];
          if (x.outside) {
            out.push(x.outside.kind === "grades"
              ? [`${T.outside}: `, ctx.num(x.G, formatCount(x.G)), " grades"]
              : x.outside.kind === "range" ? ["outside this family’s boundary range"] : [`${T.outside}: `, ctx.num(x.outside.against, formatCount(x.outside.against)), " directions against the order"]);
          } else if (show && state.match === "n" && x.gap.gap === 0) out.push([state.data === "league8" ? T.onFrontier : T.onBoundary]);
          if (x.above) out.push([T.above]);
          return out.flatMap((part, k) => (k ? ["; ", ...part] : part));
        };
        const headN = [th("Rule"), th("N"), th("E")];
        if (show) headN.push(th(state.data === "league8" ? "H at its N" : "Boundary at its N"), th("Gap"));
        headN.push(th("Note"));
        const headT = [th("Rule"), th("N"), th("E/N"), th(["Risk at τ = ", tauNode(state.tau)]), th("Note")];
        const combined = [th("Rule"), th("N"), th("E"), th("E/N"), th(state.data === "league8" ? "H at its N" : "Boundary at its N"), th("Gap"), th(["Risk at τ = ", tauNode(state.tau)]), th("Note")];
        const answerColumn = fullModes ? (state.match === "tau" ? 6 : 5) : state.match === "tau" ? 3 : show ? 4 : 2;
        const answerFirst = cells => [cells[0], cells[answerColumn], ...cells.slice(1).filter((_, i) => i + 1 !== answerColumn)];
        const rows = at.rows.map((x) => {
          const cells = [h("th", { scope: "row" }, tagNode(x.rule), " ", nameOf(x.rule)), h("td", {}, ro(`tN-${x.rule}`, x.ev.N, formatCount(x.ev.N)))];
          if (fullModes) {
            cells.push(h("td", {}, ro(`tE-${x.rule}`, x.ev.Ew, E4(x.ev.Ew))),
              h("td", {}, ro(`tEN-${x.rule}`, x.ev.EoverN[0], formatShare(x.ev.EoverN[0]))),
              h("td", {}, x.outside ? "none" : ro(`tH-${x.rule}`, x.gap.H, E4(x.gap.H))),
              h("td", {}, x.outside ? "none" : ro(`tGap-${x.rule}`, x.gap.gap, E4(x.gap.gap))),
              h("td", {}, ro(`tRisk-${x.rule}`, x.ev.risk, formatRisk(x.ev.risk))));
          } else if (state.match === "n") {
            cells.push(h("td", {}, ro(`tE-${x.rule}`, x.ev.Ew, E4(x.ev.Ew))));
            if (show) {
              cells.push(h("td", {}, x.outside ? "none" : ro(`tH-${x.rule}`, x.gap.H, E4(x.gap.H))),
                h("td", {}, x.outside ? "none" : ro(`tGap-${x.rule}`, x.gap.gap, E4(x.gap.gap))));
            }
          } else {
            const en = x.ev.EoverN[0];
            cells.push(h("td", {}, ro(`tEN-${x.rule}`, en, formatShare(en))),
              h("td", {}, ro(`tRisk-${x.rule}`, x.ev.risk, formatRisk(x.ev.risk))));
          }
          cells.push(h("td", { class: "prx-rcmp-notecell" }, ...notes(x)));
          return h("tr", { class: x.rule === state.rule ? "prx-rcmp-row-sel" : "" }, ...answerFirst(cells));
        });
        const caption = state.match === "tau"
          ? h("p", { class: "prx-rcmp-note" }, "All risks at τ = ", tauNode(state.tau), "; ", captionNode(ctx, "different-disclosure"), ". The all-withheld risk is τ itself.")
          : h("p", { class: "prx-rcmp-note" }, state.data === "league8" ? "The gap is E minus H at the rule’s own N, only for rules inside the family; between vertices H may require a mixture." : "The gap uses the boundary within the posterior-mean order, only for rules inside that order family; it is not H(m).");
        const id = uid("prx-rcmp-table");
        const wrap = ctx.scrollRegion(h("div", { class: "prx-rcmp-table-wrap" },
          h("table", { class: "prx-rcmp-table prx-sticky-first", "aria-labelledby": id },
            h("thead", {}, h("tr", {}, ...answerFirst(fullModes ? combined : state.match === "n" ? headN : headT))), h("tbody", {}, ...rows))), T.tableTitle);
        tableBox.replaceChildren(ctx.panelTitle(T.tableTitle, { className: "prx-rcmp-heading", id }), h("p", { class: "prx-rcmp-note", text: "The table keeps all columns. On narrow screens, swipe sideways, or focus the table region and use the arrow keys." }), wrap, caption);
      }

      function drawRankStrip(at, selected, tau) {
        const rankBy = (rows, metric) => {
          const groups = [];
          for (const row of [...rows].sort((a, b) => metric(a) - metric(b))) {
            const value = metric(row);
            const last = groups.at(-1);
            if (last && Math.abs(value - last.value) <= CONFIG.tieTol) last.rules.push(row.rule);
            else groups.push({ value, rank: groups.length + 1, rules: [row.rule] });
          }
          return groups.map(g => ({ ...g, tag: g.rules.map(rule => CONFIG.tags[rule]).join("=") }));
        };
        const risk = rankBy(at.rows, row => row.ev.risk);
        const gap = rankBy(at.rows.filter(row => !row.outside), row => row.gap.gap);
        const ranks = new Map(gap.flatMap(g => g.rules.map(rule => [rule, g.rank])));
        const links = risk.flatMap(g => g.rules.filter(rule => ranks.has(rule)).map(rule => ({ rule, risk: g.rank, gap: ranks.get(rule) })));
        const maximum = Math.max(risk.length, gap.length);
        rankHeading.replaceChildren(h("span", {}, "Risk at τ ", tauNode(tau)), h("span", {}, "Gap at own N"));
        rankNote.hidden = !at.rows.some(row => row.outside);
        plot(rankChart, {
          alt: "Rules ranked side by side by their risk at the common withholding cost and by their gap at their own disclosure. Ties share a rank. Outside-family rules have no gap rank.",
          width: Math.round(rankSlot.clientWidth || ctx.width()), height: 62 + maximum * 21,
          marginLeft: 83, marginRight: 111, marginTop: 9, marginBottom: 12,
          x: { domain: [0, 1], axis: null },
          y: { domain: [maximum + .5, .5], axis: null },
          table: { caption: "The two rank orders", rows: at.rows, columns: [
            { label: "Rule", value: row => nameOf(row.rule) },
            { label: "Risk rank", value: row => risk.find(g => g.rules.includes(row.rule)).rank },
            { label: "Gap rank", value: row => ranks.get(row.rule) ?? "Outside family" },
          ] },
          marks: (c, P) => [
            P.link(links, { x1: () => 0, x2: () => 1, y1: "risk", y2: "gap", stroke: d => d.rule === selected ? c.plotFg : c.plotMuted, strokeWidth: d => d.rule === selected ? 2.8 : 1, strokeOpacity: d => d.rule === selected ? 1 : .5 }),
            P.dot(risk, { x: () => 0, y: "rank", r: 3, fill: c.plotFg }),
            P.dot(gap, { x: () => 1, y: "rank", r: 3, fill: c.plotFg }),
            P.text(risk, { x: () => 0, y: "rank", text: "tag", dx: -7, textAnchor: "end", fill: c.plotFg }),
            P.text(gap, { x: () => 1, y: "rank", text: "tag", dx: 7, textAnchor: "start", fill: c.plotFg }),
          ],
        });
      }

      return { drawConditions, drawReadout, drawLabel, drawChart, drawLegend, drawTable,
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const show = true;
            dataSwitch.set(state.data);
            if (labelledFor !== state.data) {
              labelledFor = state.data;
              familySwitch.inputs.forEach((inp, k) => inp.nextElementSibling?.replaceChildren(...famLabel(state.data, CONFIG.families[k])));
            }
            familySwitch.set(state.family);
            matchSwitch.inputs[0].nextElementSibling?.replaceChildren(state.data === "league8" ? T.matchN : "at the same N (each rule against the boundary within this order)");
            matchSwitch.set(state.match);
            tau.set(state.tau);
            ruleSelect.set(state.rule);
            const d = dataModel(state.data);
            const f = famModel(state.data, state.family);
            const at = rulesAt(state.data, state.family, state.tau);
            drawConditions(state, d, f);
            drawReadout(state, d, f, at);
            if (rankSlot) drawRankStrip(at, state.rule, state.tau);
            drawLabel(state, f, at);
            const info = drawChart(state, d, f, at, show);
            drawLegend(state, f, at, show, info);
            drawTable(state, d, f, at, show);
            ctx.caption.textContent = state.data === "league8" ? T.note8 : T.note30;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
}

export function mountComparison(el, spec = {}, { name = CONFIG.name, fullModes = false, match = "n", preset = "same-n", title = CONFIG.title } = {}) {
  return createWidget(el, {preset, ...spec}, {name, label:fullModes ? "Common rules at one withholding cost or matched disclosure, within a named family" : CONFIG.label, title, className:CONFIG.className,
    css: COMPARISON_CSS, layout: "result-first", keys:comparisonKeys({fullModes,match}), build:ctx=>createComparisonView(ctx,{fullModes})});
}
export function mountWidget(el, spec = {}) { return mountComparison(el,spec); }

export const COMPARISON_CSS = `/*
 * postrank Explorer · rule-comparison (catalog R-04; js/widgets/rule-comparison.js)
 *
 * Layout: the controls (units, family, match, τ, rule), the comparison conditions, the live read-out and the result
 * label, then the figure (rules as points beside the cloud and the boundary) with its legend on the plot panel, then
 * the table of rules (a keyboard-reachable scroll box). Tokens only; nothing is wider than its container at 375 px.
 */

/* Keep the picture near its controls; complete conditions and results follow it. */
.prx-rcmp .prx-controls > * { min-width: 0; }
.prx-rcmp .prx-rcmp-grade { white-space: normal; overflow-wrap: anywhere; }
@media (min-width: 48rem) {
  .prx-rcmp .prx-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .45rem 1rem; align-items: start; }
  .prx-rcmp .prx-controls .prx-presets { grid-column: 1 / -1; }
}
.prx-rcmp .prx-rcmp-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-rcmp .prx-rcmp-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-rcmp .prx-rcmp-row {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}

.prx-rcmp .prx-rcmp-row > legend {
  flex: 1 1 100%;
}

.prx-rcmp .prx-rcmp-sym {
  white-space: nowrap;
}

.prx-rcmp .prx-rcmp-tag {
  font-weight: 600;
  white-space: nowrap;
}

.prx-rcmp .prx-rcmp-label {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.95em;
  overflow-wrap: anywhere;
}

.prx-rcmp .prx-rcmp-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-rcmp {
  overflow-wrap: break-word;
}

/* --- comparison conditions --- */
.prx-rcmp .prx-rcmp-conditions {
  margin: 0.75rem 0 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--prx-border);
  border-left: 4px solid var(--prx-accent);
  border-radius: var(--prx-radius);
  background: var(--prx-bg-raised);
  min-width: 0;
}

.prx-rcmp .prx-rcmp-list {
  margin: 0;
  padding-left: 1.1rem;
}

.prx-rcmp .prx-rcmp-list li {
  margin: 0.15rem 0;
}

.prx-rcmp .prx-rcmp-ranks {
  max-width: 34rem;
  margin: 0 auto .75rem;
}
.prx-rcmp .prx-rcmp-rank-headings {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
  padding: 0 .45rem;
  margin: 0;
  font-weight: 600;
}
.prx-rcmp .prx-rcmp-scope {
  color: var(--prx-fg-muted);
}

.prx-rcmp .prx-rcmp-pending {
  font-style: italic;
}

.prx-rcmp .prx-rcmp-chart {
  min-width: 0;
  max-width: 100%;
}

/* --- legend (on the plot panel) --- */
.prx-rcmp .prx-rcmp-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius);
}

.prx-rcmp .prx-rcmp-legend .prx-result-caption {
  color: var(--prx-plot-muted);
}

.prx-rcmp .prx-rcmp-key {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.prx-rcmp .prx-rcmp-swatch {
  flex: none;
  position: relative;
  display: inline-block;
  width: 1.6em;
  height: 1em;
}

.prx-rcmp .prx-rcmp-swatch::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.prx-rcmp .prx-rcmp-sw-rule::before {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--prx-plot-fg);
}

.prx-rcmp .prx-rcmp-sw-outside::before {
  width: 0.7em;
  height: 0.7em;
  border: 2px solid var(--prx-neutral-6);
  border-radius: 50%;
  background: var(--prx-plot-bg);
}

.prx-rcmp .prx-rcmp-sw-ring::before {
  width: 1.1em;
  height: 1.1em;
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
}

.prx-rcmp .prx-rcmp-sw-cross::before {
  content: "×";
  font-size: 1.3em;
  line-height: 1;
  color: var(--prx-plot-muted);
}

.prx-rcmp .prx-rcmp-sw-cloud::before {
  width: 2px;
  height: 1em;
  background: var(--prx-neutral-4);
}

.prx-rcmp .prx-rcmp-sw-above::before {
  width: 0;
  height: 0;
  border-left: 0.35em solid transparent;
  border-right: 0.35em solid transparent;
  border-bottom: 0.6em solid var(--prx-neutral-4);
}

.prx-rcmp .prx-rcmp-sw-hull::before,
.prx-rcmp .prx-rcmp-sw-line::before,
.prx-rcmp .prx-rcmp-sw-parallel::before {
  left: 0.15em;
  right: 0.15em;
  width: auto;
  transform: translateY(-50%);
  border-top: 2px dashed var(--prx-plot-fg);
}

.prx-rcmp .prx-rcmp-sw-line::before {
  border-top: 1.5px solid var(--prx-plot-fg);
}

.prx-rcmp .prx-rcmp-sw-parallel::before {
  border-top: 1.5px dashed var(--prx-plot-muted);
}

.prx-rcmp .prx-rcmp-sw-gap::before {
  width: 4px;
  height: 1em;
  background: var(--prx-err);
}

.prx-rcmp .prx-rcmp-sw-mix::before {
  width: 0.7em;
  height: 0.7em;
  border: 2px solid var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  transform: translate(-50%, -50%) rotate(45deg);
}

.prx-rcmp .prx-rcmp-sw-tag::before {
  content: "PT";
  font-size: 0.8em;
  font-weight: 600;
}

.prx-rcmp .prx-rcmp-sw-vertices::before {
  content: "⬡";
  font-size: 1.2em;
  line-height: 1;
}

.prx-rcmp .prx-rcmp-sw-best::before {
  width: 0.9em;
  height: 0.9em;
  border: 1.25px solid var(--prx-plot-fg);
}

/* --- table of rules --- */
.prx-rcmp .prx-rcmp-table-box {
  margin: 1rem 0 0;
  min-width: 0;
}

.prx-rcmp .prx-rcmp-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.prx-rcmp .prx-rcmp-table {
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}

.prx-rcmp .prx-rcmp-table th,
.prx-rcmp .prx-rcmp-table td {
  padding: 0.2rem 0.6rem 0.2rem 0;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
}

.prx-rcmp .prx-rcmp-table thead th {
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--prx-border-strong);
}

.prx-rcmp .prx-rcmp-table tbody th {
  font-weight: 400;
  min-width: 12em;
}

@media (max-width: 30rem) {
  .prx-rcmp .prx-rcmp-table tbody th {
    min-width: 8em;
  }

  .prx-rcmp .prx-rcmp-notecell {
    min-width: 7em;
  }
}

.prx-rcmp .prx-rcmp-notecell {
  min-width: 10em;
  color: var(--prx-fg-muted);
}

.prx-rcmp .prx-rcmp-row-sel th,
.prx-rcmp .prx-rcmp-row-sel td {
  font-weight: 600;
  background: var(--prx-bg-raised);
}`;
