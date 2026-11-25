import { createWidget, uid } from "../base.js";
import { placeDirectLabels, plot, svgEl } from "../chart.js";
import {
  formatCount,
  formatDistinguishing,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutExpected,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../labels.js";
import {
  LEAGUE_SEED,
  disclosure,
  drawLeague,
  errorArray,
  evaluateReport,
  evidenceFlags,
  expectedRank,
  fixedOrderDP,
  league30,
  lowerHull,
  matchedDisclosure,
  normalPosterior,
  orderHull,
  reportCloud,
  ruleGap,
  statedAgainst,
  strictOrder,
  summaryStats,
  supportingVertex,
  tierGrades,
} from "../../pr-core.js";

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
    aspect: 0.5,
    minHeight: 252,
    maxHeight: 372,
    marginTop: 32,
    marginRight: 24,
    marginBottom: 42,
    marginLeft: 52,
    column: 1.25,
    minDot: 3.2,
    triangle: 3.2,
    hullWidth: 2.5,
    activeHullWidth: 3.5,
    hullDash: "7 4",
    vertexDot: 4.2,
    ruleDot: 5,
    activeDot: 6,
    ring: 9.5,
    ringWidth: 2.4,
    gapWidth: 3,
    mixDot: 6.5,
    lineWidth: 1.8,
    parallelDash: "4 3",
    xPad: 0.8,
    xPad30: 10,
    thin: 1.25,
    dotStroke: 1.3,
    bracketOffset: 10,
    bracketTick: 4,
    labelGapPx: 20,
  }),
  tauChart: Object.freeze({
    rowPitch: 29,
    mobileRowPitch: 22,
    marginTop: 30,
    mobileMarginTop: 26,
    marginBottom: 40,
    mobileMarginBottom: 36,
    marginLeftWide: 162,
    marginLeftCompact: 102,
    marginRightWide: 112,
    marginRightCompact: 62,
    compactBreakpoint: 470,
  }),
  text: Object.freeze({
    dataLegend: "Units",
    data8: "Eight units (U01–U08)",
    data30: "All thirty units",
    familyLegend: "Family",
    familyAll8: "all reports",
    familyCap8: "at most three grades",
    familyAll30: "posterior-mean cuts",
    familyCap30: "cuts, at most three grades",
    reports: "reports",
    matchLegend: "Comparison",
    matchN: "Same disclosure N",
    matchTau: "Same price τ",
    slider: "Withholding cost τ",
    sliderHint:
      "The cuts (PC, RC), the best report (B) and every risk use this τ; the rules that do not use τ (T2 to T4, F, PT, S, W) stay where they are.",
    ruleLabel: "Rule",
    conditionsTitle: "Comparison conditions",
    xLabel: "Pairs stated, N",
    yLabel: "Expected wrong directions, E",
    tauXLabel: "Reporting risk at τ",
    tableTitle: "Each rule under the same posterior",
    tableCaption: "Rules by the pairs they state and their expected wrong directions",
    keyboardLabel: "Rule points. Use arrow keys or click a point to select that rule.",
    tauKeyboardLabel: "Rules ranked by risk at τ. Use arrow keys or click a bar to select that rule.",
    chartAlt: "Each common rule as a point at the pairs it states, N, and its expected wrong directions, E.",
    chartAltCloud: " Gray columns span the reports of the family at each N, and the dashed lower boundary H(m) runs through its vertices.",
    chartAltOrder: " The dashed line is the boundary of the contiguous cuts of the posterior-mean order.",
    tauChartAlt: "Horizontal stacked bars decomposing each rule's reporting risk at τ into expected wrong-direction share E/M and withholding charge τ(M − N)/M, compared against the all-withheld line at τ.",
    onFrontier: "on the frontier",
    onBoundary: "on the boundary within this order",
    outside: "outside this family",
    above: "risk above all-withheld at this τ",
    scope: "The gap compares the rule with the lowest expected error count at its own disclosure.",
    scopeTau: "Risk combines expected errors and withholding costs at the chosen τ.",
    tauLines: "Points on one line of slope τ have equal risk, and a lower line means a lower risk. The gap between the two lines mixes errors with disclosure.",
    note8: "The simulated league (frozen draw), units U01 to U08, under its teaching posterior. Every report of the family is evaluated in this browser.",
    note30:
      "The simulated league (frozen draw), all thirty units, under its teaching posterior. The boundary within the posterior-mean order is computed exactly in this browser; the reports outside that order are not searched.",
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
  shortNames: Object.freeze({
    tiers2: "Two estimate tiers",
    tiers3: "Three estimate tiers",
    tiers4: "Four estimate tiers",
    flags: "Evidence flags",
    pmtiers: "Posterior-mean tiers",
    pmcuts: "Posterior-mean cuts",
    ercuts: "Expected-rank cuts",
    strict: "Strict estimate order",
    best: "Best report at τ",
    withheld: "All-withheld",
  }),
  selectNames: Object.freeze({
    tiers2: "T2 · Two estimate tiers",
    tiers3: "T3 · Three estimate tiers",
    tiers4: "T4 · Four estimate tiers",
    flags: "F · Evidence flags",
    pmtiers: "PT · Posterior-mean tiers",
    pmcuts: "PC · Posterior-mean cuts",
    ercuts: "RC · Expected-rank cuts",
    strict: "S · Strict order",
    best: "B · Best at τ",
    withheld: "W · All-withheld",
  }),
  barNamesWide: Object.freeze({
    tiers2: "Two est. tiers (T2)",
    tiers3: "Three est. tiers (T3)",
    tiers4: "Four est. tiers (T4)",
    flags: "Evidence flags (F)",
    pmtiers: "Post.-mean tiers (PT)",
    pmcuts: "Post.-mean cuts (PC)",
    ercuts: "Exp.-rank cuts (RC)",
    strict: "Strict order (S)",
    best: "Best at τ (B)",
    withheld: "All-withheld (W)",
  }),
  barNamesCompact: Object.freeze({
    tiers2: "Two tiers",
    tiers3: "Three tiers",
    tiers4: "Four tiers",
    flags: "Flags",
    pmtiers: "PM tiers",
    pmcuts: "PM cuts",
    ercuts: "ER cuts",
    strict: "Strict",
    best: "Best at τ",
    withheld: "Withheld",
  }),
  tags: Object.freeze({
    tiers2: "T2",
    tiers3: "T3",
    tiers4: "T4",
    flags: "F",
    pmtiers: "PT",
    pmcuts: "PC",
    ercuts: "RC",
    strict: "S",
    best: "B",
    withheld: "W",
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
    m = {
      data,
      key,
      family,
      cloud: null,
      hull,
      M: probe.evaluation?.M ?? evaluateReport(probe.grade, d.E, { tau: CONFIG.tau.value }).M,
      famResult: probe,
    };
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
    bestTies = dp.grades.filter((g) => !g.every((v, i) => v === best[i])).map((g) => Array.from(g));
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

// ---------------------------------------------------------------------------------------------- widget helpers

export function comparisonKeys({ fullModes = false, match = "n" } = {}) {
  return {
    data: { type: "choice", values: fullModes ? CONFIG.datas.slice() : ["league8"], value: "league8" },
    family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
    match: { type: "choice", values: fullModes ? CONFIG.matches.slice() : ["n"], value: match },
    tau: { type: "number", ...CONFIG.tau },
    rule: { type: "choice", values: CONFIG.rules.slice(), value: CONFIG.rule },
  };
}

function fmtExpectedPair(v, ref) {
  if (typeof ref === "number" && Number.isFinite(ref) && Math.abs(v - ref) > CONFIG.tieTol) {
    return formatDistinguishing(v, ref);
  }
  return formatReadoutExpected(v);
}

function fmtRiskPair(v, ref) {
  if (typeof ref === "number" && Number.isFinite(ref) && Math.abs(v - ref) > CONFIG.tieTol) {
    return formatDistinguishing(v, ref);
  }
  return formatReadoutRisk(v);
}

function appendBackedLabel(layer, doc, pal, { x, y, anchor = "start", fill, fontWeight = 600, estWidth = 60, height = 19, fillOpacity = 1, safeLeft, safeRight, attrs = {} }, ...children) {
  let clampedX = x;
  if (anchor === "start") {
    clampedX = Math.max(safeLeft, Math.min(safeRight - estWidth, clampedX));
  } else if (anchor === "end") {
    clampedX = Math.min(safeRight, Math.max(safeLeft + estWidth, clampedX));
  } else {
    clampedX = Math.max(safeLeft + estWidth / 2, Math.min(safeRight - estWidth / 2, clampedX));
  }
  const rx0 = anchor === "start" ? clampedX - 3.5 : anchor === "end" ? clampedX - estWidth - 3.5 : clampedX - estWidth / 2 - 3.5;
  const rectW = estWidth + 7;
  layer.append(
    svgEl(doc, "rect", {
      x: Math.max(4, rx0),
      y: y - height / 2,
      width: Math.max(12, rectW),
      height,
      rx: 3,
      fill: pal.plotBg,
      fillOpacity,
    }),
    svgEl(
      doc,
      "text",
      {
        x: clampedX,
        y,
        textAnchor: anchor,
        dominantBaseline: "central",
        fill,
        fontWeight,
        ...attrs,
      },
      ...children,
    ),
  );
  return clampedX;
}

/** Frame v2 presentation shared by 3.7 (same-N frontier focus) and 3.8 (same-τ vs same-N comparison). */
export function createComparisonView(ctx, { fullModes = false } = {}) {
  const { h } = ctx;
  const T = CONFIG.text;

  const ro = (name, raw, display) => {
    const node = ctx.num(raw, display);
    node.setAttribute("data-prx-readout", name);
    return node;
  };
  const E4 = (v) => formatExpectedCount(v);
  const gradeNode = (name, g) => {
    const node = name ? ro(name, Array.from(g), formatGrades(Array.from(g))) : ctx.num(Array.from(g), formatGrades(Array.from(g)));
    node.classList.add("prx-rcmp-grade");
    return node;
  };
  const famNode = (result) => {
    const node = familyNameNode(ctx, result);
    node.classList.add("prx-rcmp-sym");
    return node;
  };
  const tauNode = (tau) => ctx.num(tau, formatSetting(tau));
  const nameOf = (r) => CONFIG.names[r];
  const shortNameOf = (r) => CONFIG.shortNames[r];
  const tagNode = (r) => h("span", { class: "prx-rcmp-tag", "data-prx-name": "" }, CONFIG.tags[r]);

  // --- Primary controls in ctx.controls + Secondary controls in ctx.settingsBox("Settings")
  const hintId = uid("prx-rcmp-tau-hint");
  const tau = ctx.slider({
    label: T.slider,
    ...ctx.key("tau"),
    onInput: (v) => ctx.set({ tau: v }),
  });
  tau.input.setAttribute("aria-describedby", hintId);

  const ruleSelect = ctx.select({
    label: T.ruleLabel,
    name: "rule",
    value: ctx.state.rule,
    onChange: (v) => ctx.set({ rule: v }),
    options: CONFIG.rules.map((r) => ({ value: r, label: CONFIG.selectNames[r] })),
  });

  const matchSwitch = fullModes
    ? ctx.segmented({
        label: T.matchLegend,
        name: "match",
        className: "prx-rcmp-match",
        options: [
          { value: "tau", label: T.matchTau },
          { value: "n", label: T.matchN },
        ],
        value: ctx.state.match,
        onChange: (v) => ctx.set({ match: v }),
      })
    : null;

  if (fullModes) {
    ctx.controls.append(matchSwitch.root, ruleSelect.root, tau.root);
    ctx.primaryControl(tau.root);
  } else {
    ctx.controls.append(ruleSelect.root, tau.root);
    ctx.primaryControl(tau.root);
  }

  const dataSwitch = fullModes
    ? ctx.segmented({
        label: T.dataLegend,
        name: "data",
        className: "prx-rcmp-data",
        options: [
          { value: "league8", label: [ctx.num(CONFIG.n8, formatCount(CONFIG.n8)), " units (", h("span", { "data-prx-name": "" }, "U01"), "–", h("span", { "data-prx-name": "" }, "U08"), ")"] },
          { value: "league30", label: ["All ", ctx.num(UNITS.id.length, formatCount(UNITS.id.length)), " units"] },
        ],
        value: ctx.state.data,
        onChange: (v) => ctx.set({ data: v }),
      })
    : null;

  const famLabelNodes = (data, key) => {
    const f = famModel(data, key);
    const words = data === "league8" ? (key === "all" ? T.familyAll8 : T.familyCap8) : (key === "all" ? T.familyAll30 : T.familyCap30);
    return [famNode(f.famResult), " · ", ctx.num(f.famResult.family.size, formatCount(f.famResult.family.size)), ` (${words})`];
  };
  let labelledFor = ctx.state.data;
  const familySwitch = ctx.segmented({
    label: T.familyLegend,
    name: "family",
    className: "prx-rcmp-family",
    options: CONFIG.families.map((k) => ({ value: k, label: famLabelNodes(ctx.state.data, k) })),
    value: ctx.state.family,
    onChange: (v) => ctx.set({ family: v }),
  });

  const settingsBox = ctx.settingsBox("Settings");
  if (dataSwitch) settingsBox.body.append(dataSwitch.root);
  settingsBox.body.append(familySwitch.root);

  // --- Stage: single focused primary graphic + compact 3-item inline key (ctx.stage carries [data-prx-primary] from frame v2)
  const chartSlot = h("div", { class: "prx-rcmp-chart" });
  const legend = h("div", { class: "prx-rcmp-legend prx-rcmp-keymain", "data-prx-part": "legend" });
  ctx.stage.append(chartSlot, legend);

  // --- Data disclosure: complete 10-rule table (+ complementary view in 3.8)
  const dataBox = ctx.dataBox(fullModes ? "Data, rule table and complementary view" : "Data and all rules compared");
  const tableBox = h("section", { class: "prx-rcmp-table-box", "data-prx-part": "table" });
  const compWrap = fullModes ? h("section", { class: "prx-rcmp-comp" }) : null;
  const compTitle = fullModes ? h("p", { class: "prx-rcmp-heading" }) : null;
  const compChartSlot = fullModes ? h("div", { class: "prx-rcmp-chart prx-rcmp-comp-chart" }) : null;
  const rankSlot = fullModes ? h("div", { class: "prx-rcmp-ranks" }) : null;
  const rankHeading = rankSlot ? h("p", { class: "prx-rcmp-rank-headings" }) : null;
  const rankChart = rankSlot ? h("div", { class: "prx-rcmp-rank-chart" }) : null;
  const rankNote = rankSlot ? h("p", { class: "prx-rcmp-note", text: "Rules outside the family have no gap rank." }) : null;
  if (rankSlot) rankSlot.append(rankHeading, rankChart, rankNote);
  if (compWrap) {
    compWrap.append(compTitle, compChartSlot);
    ctx.stage.append(rankSlot);
    dataBox.body.append(tableBox, compWrap);
  } else {
    dataBox.body.append(tableBox);
  }

  const comparison = !fullModes ? h("div", { class: "prx-rcmp-note", "data-prx-comparison": "matched-disclosure" }) : null;
  if (comparison) ctx.stage.append(comparison);

  // --- Method disclosure: benchmark/mixture details, exact family/tie label, comparison conditions, and slider hint
  const methodBox = ctx.methodBox(fullModes ? "Method and comparison details" : "Method and matched-disclosure benchmark");
  const benchmarkDetail = h("div", { class: "prx-rcmp-benchmark" });
  const labelLine = h("p", { class: "prx-rcmp-label" });
  const conditions = h("section", { class: "prx-rcmp-conditions", "data-prx-part": "notes" });
  const sliderHint = h("p", { id: hintId, class: "prx-rcmp-note", text: T.sliderHint });
  const simNote = h("p", { class: "prx-rcmp-note" });
  methodBox.body.append(benchmarkDetail, labelLine, conditions, sliderHint, simNote);

  // --- Direct selection helpers (clicking a chart point, risk bar, or table row selects that rule)
  function pickRule(ruleKey) {
    if (!CONFIG.rules.includes(ruleKey) || ruleKey === ctx.state.rule) return;
    ctx.set({ rule: ruleKey });
  }
  function pickGroup(group) {
    if (!group || !Array.isArray(group.rules) || !group.rules.length) return;
    const idx = group.rules.findIndex((r) => r.rule === ctx.state.rule);
    const next = idx >= 0 ? group.rules[(idx + 1) % group.rules.length] : group.rules[0];
    if (next && next.rule !== ctx.state.rule) ctx.set({ rule: next.rule });
  }

  let focusedFrontierGroup = null;
  let focusedTauRow = null;
  function handleKbdPointActivate(slot, e, isTauChart) {
    const btn = e.target?.closest?.(".prx-kbd-point");
    if (!btn || e.detail !== 0) return;
    const fk = btn.getAttribute("data-prx-focus-key") || "";
    const keyPart = fk.split(":").slice(2).join(":");
    if (isTauChart) {
      if (CONFIG.rules.includes(keyPart)) pickRule(keyPart);
      else if (focusedTauRow) pickRule(focusedTauRow.rule);
    } else {
      const at = rulesAt(ctx.state.data, ctx.state.family, ctx.state.tau);
      const grp = groupsOf(at.rows).find((g) => g.tag === keyPart) ?? focusedFrontierGroup;
      if (grp) pickGroup(grp);
    }
  }
  ctx.listen(chartSlot, "click", (e) => {
    handleKbdPointActivate(chartSlot, e, Boolean(fullModes && ctx.state.match === "tau"));
  });
  if (compChartSlot) {
    ctx.listen(compChartSlot, "click", (e) => {
      handleKbdPointActivate(compChartSlot, e, ctx.state.match !== "tau");
    });
  }
  ctx.listen(tableBox, "click", (e) => {
    const tr = e.target?.closest?.("tr[data-prx-rule]");
    if (tr) pickRule(tr.getAttribute("data-prx-rule"));
  });

  // ------------------------------------------------------------------------------------- drawing

  function drawScope(f) {
    const fam = f.famResult;
    const kindWord = f.data === "league30" ? "cuts" : T.reports;
    ctx.setScope([
      "Benchmark family: ",
      famNode(fam),
      " · ",
      ctx.num(fam.family.size, formatCount(fam.family.size)),
      ` ${kindWord}.`,
    ]);
  }

  function drawConditions(state, d, f) {
    const units =
      state.data === "league8"
        ? [h("span", { "data-prx-name": "" }, "U01"), " to ", h("span", { "data-prx-name": "" }, "U08")]
        : ["all ", ctx.num(d.n, formatCount(d.n)), " league units"];
    const items = [
      h(
        "li",
        {},
        h("strong", {}, "Same posterior. "),
        "Every rule is evaluated under one posterior for ",
        ...units,
        ": the teaching posterior (normal prior, mean ",
        ctx.num(CONFIG.prior.mean, formatCount(CONFIG.prior.mean)),
        ", SD ",
        ctx.num(CONFIG.prior.sd, formatSetting(CONFIG.prior.sd)),
        "), ",
        captionNode(ctx, "teaching-posterior"),
        ".",
      ),
    ];
    if (state.match === "n") {
      items.push(
        h(
          "li",
          {},
          h("strong", {}, "Same N. "),
          state.data === "league8"
            ? "Each rule is compared with H at its own N: the fewest expected wrong directions that a report of the family, or a mixture of two, has while stating as many pairs on average."
            : "Each rule is compared with the boundary within the posterior-mean order at its own N: the fewest expected wrong directions among those cuts, or a mixture of two, at that N.",
        ),
      );
    } else {
      items.push(
        h(
          "li",
          {},
          h("strong", {}, "Same τ. "),
          "Every risk is at τ = ",
          tauNode(state.tau),
          ", while N differs: ",
          captionNode(ctx, "different-disclosure"),
          "; ",
          captionNode(ctx, "tau-not-compared"),
          ". ",
          T.tauLines,
        ),
      );
    }
    const fam = f.famResult;
    items.push(
      h(
        "li",
        {},
        h("strong", {}, "Family. "),
        famNode(fam),
        ", ",
        familySizeNode(ctx, fam),
        ` ${T.reports}`,
        state.data === "league8"
          ? ", every one evaluated."
          : " (contiguous cuts of the posterior-mean order; the other reports are not searched). The rules outside it have no benchmark here.",
      ),
    );
    items.push(h("li", { class: "prx-rcmp-scope" }, state.match === "n" ? T.scope : T.scopeTau));
    const flags = h(
      "p",
      { class: "prx-rcmp-note" },
      "The flags use the cutoff ",
      ctx.num(CONFIG.crit, formatSetting(CONFIG.crit)),
      " and the mean of the ",
      ctx.num(UNITS.id.length, formatCount(UNITS.id.length)),
      " league estimates as the reference.",
    );
    conditions.replaceChildren(ctx.panelTitle(T.conditionsTitle, { className: "prx-rcmp-heading" }), h("ul", { class: "prx-rcmp-list" }, ...items), flags);
    simNote.textContent = state.data === "league8" ? T.note8 : T.note30;
  }

  function drawReadout(state, d, f, at) {
    const x = at.byRule[state.rule];
    const detailLines = [];
    const ruleTitle = h("strong", {}, shortNameOf(state.rule));
    if (comparison) {
      const selector = h("p", {}, h("strong", {}, shortNameOf(state.rule)), " at N = ", ctx.num(x.ev.N, formatCount(x.ev.N)),
        " of ", ctx.num(x.ev.M, formatCount(x.ev.M)), ": expected wrong directions ", ctx.num(x.ev.Ew, formatReadoutExpected(x.ev.Ew)), ".");
      const boundary = x.outside
        ? h("p", {}, "This report lies outside the selected family. A within-family gap rank does not apply.")
        : h("p", {}, h("strong", {}, "Frontier at the same disclosure"), ": expected wrong directions ",
          ctx.num(x.gap.H, formatReadoutExpected(x.gap.H)), " (gap ", ctx.num(x.gap.gap, formatReadoutExpected(x.gap.gap)), ").");
      comparison.replaceChildren(selector, boundary);
    }
    const Nn = (hook) => (hook ? ro(hook, x.ev.N, formatCount(x.ev.N)) : ctx.num(x.ev.N, formatCount(x.ev.N)));
    const Mn = () => ctx.num(x.ev.M, formatCount(x.ev.M));
    const tauValNode = () => tauNode(state.tau);

    if (state.match === "n") {
      const refH = !x.outside && x.gap.gap > 0 ? x.gap.H : null;
      const eDisp = refH !== null ? fmtExpectedPair(x.ev.Ew, refH) : formatReadoutExpected(x.ev.Ew);
      const riskAtTau = ctx.num(x.ev.risk, formatReadoutRisk(x.ev.risk));

      if (x.outside) {
        const whyNodes =
          x.outside.kind === "grades"
            ? ["uses ", ro("G", x.G, formatCount(x.G)), " grades — ", T.outside, " (", famNode(f.famResult), ")"]
            : x.outside.kind === "range"
              ? ["lies outside the boundary range — ", T.outside]
              : ["states ", ro("against", x.outside.against, formatCount(x.outside.against)), " pairs against the order — ", T.outside, " (", famNode(f.famResult), ")"];
        const parts = [
          ruleTitle,
          " (N = ",
          Nn("N"),
          " of ",
          Mn(),
          ", E = ",
          ro("E", x.ev.Ew, eDisp),
          ") ",
          ...whyNodes,
        ];
        if (x.above) {
          parts.push("; E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " > τ = ", tauValNode(), " (", T.above, ", ", riskAtTau, ").");
        } else {
          parts.push(" (risk ", riskAtTau, " at τ = ", tauValNode(), ").");
        }
        ctx.readout.set(parts);
      } else if (x.gap.gap === 0) {
        const onWhat = state.data === "league8" ? ["H(", Nn(), ")"] : ["the order boundary"];
        const parts = [
          ruleTitle,
          " (N = ",
          Nn("N"),
          " of ",
          Mn(),
          ") has E = ",
          ro("E", x.ev.Ew, eDisp),
          " and gap ",
          ro("gap", x.gap.gap, formatReadoutExpected(x.gap.gap)),
          ": on ",
          ...onWhat,
        ];
        if (x.above) {
          parts.push("; E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " > τ = ", tauValNode(), " (", T.above, ", ", riskAtTau, ").");
        } else {
          parts.push(" (risk ", riskAtTau, " at τ = ", tauValNode(), ").");
        }
        ctx.readout.set(parts);
      } else {
        const hDisp = fmtExpectedPair(x.gap.H, x.ev.Ew);
        const gapDisp = formatReadoutExpected(x.gap.gap);
        const hLabel = state.data === "league8" ? ["H(", Nn(), ") = "] : ["boundary = "];
        const parts = [
          ruleTitle,
          " (N = ",
          Nn("N"),
          " of ",
          Mn(),
          "): E = ",
          ro("E", x.ev.Ew, eDisp),
          " vs. ",
          ...hLabel,
          ro("H", x.gap.H, hDisp),
          ", gap ",
          ro("gap", x.gap.gap, gapDisp),
        ];
        if (x.above) {
          parts.push("; E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " > τ = ", tauValNode(), " (", T.above, ", ", riskAtTau, ").");
        } else {
          parts.push(" (risk ", riskAtTau, " at τ = ", tauValNode(), ").");
        }
        ctx.readout.set(parts);

        // Preserve complete matched-disclosure mixture / vertex details & hooks in methodBox
        const boundaryText = state.data === "league8" ? ["H(", Nn(), ")"] : ["the boundary within this order"];
        if (x.mix.psi > 0) {
          detailLines.push([
            "No vertex sits at this N: ",
            ...boundaryText,
            " is reached by printing ",
            gradeNode("upperGrade", x.mix.upper.grade),
            " (N = ",
            ro("upperN", x.mix.upper.N, formatCount(x.mix.upper.N)),
            ") with chance ψ = ",
            ro("psi", x.mix.psi, formatProb(x.mix.psi)),
            " and ",
            gradeNode("lowerGrade", x.mix.lower.grade),
            " (N = ",
            ro("lowerN", x.mix.lower.N, formatCount(x.mix.lower.N)),
            ") otherwise, ",
            captionNode(ctx, "mixture-not-report"),
            ".",
          ]);
          if (x.mix.best) {
            detailLines.push([
              "The best single report that states exactly ",
              Nn(),
              " pairs, ",
              gradeNode("bestGrade", x.mix.best.grade),
              ", has E = ",
              ro("bestE", x.mix.best.Ew, E4(x.mix.best.Ew)),
              ".",
            ]);
          }
        } else {
          detailLines.push([
            "The vertex at N = ",
            Nn(),
            " is the printable report ",
            gradeNode("vertexGrade", x.mix.lower.grade),
            ".",
          ]);
        }
      }
    } else {
      // match === "tau"
      const b = at.byRule.best;
      const eDisp = formatReadoutExpected(x.ev.Ew);
      if (state.rule === "best") {
        const parts = [
          "At τ = ",
          tauValNode(),
          ", ",
          ruleTitle,
          " (N = ",
          Nn("N"),
          ", E = ",
          ro("E", x.ev.Ew, eDisp),
          ") attains the lowest risk in this family, ",
          ro("risk", x.ev.risk, formatReadoutRisk(x.ev.risk)),
        ];
        if (x.above) {
          parts.push("; E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " > τ (", T.above, ").");
        } else {
          parts.push(".");
        }
        ctx.readout.set(parts);
      } else {
        const rDisp = fmtRiskPair(x.ev.risk, b.ev.risk);
        const bDisp = fmtRiskPair(b.ev.risk, x.ev.risk);
        const discTail = b.ev.N === x.ev.N ? " (same N)" : " (different N)";
        const parts = [
          "At τ = ",
          tauValNode(),
          ", ",
          ruleTitle,
          " (N = ",
          Nn("N"),
          ", E = ",
          ro("E", x.ev.Ew, eDisp),
          ") has risk ",
          ro("risk", x.ev.risk, rDisp),
          " vs. best ",
          ro("bestRisk", b.ev.risk, bDisp),
          " at N = ",
          ro("bestN", b.ev.N, formatCount(b.ev.N)),
          discTail,
        ];
        if (x.above) {
          parts.push("; E/N = ", ro("EoverN", x.ev.EoverN[0], formatShare(x.ev.EoverN[0])), " > τ.");
        } else {
          parts.push(".");
        }
        ctx.readout.set(parts);

        detailLines.push([
          "Best report of the family at τ = ",
          tauValNode(),
          ": ",
          gradeNode("bestTauGrade", b.g),
          " (N = ",
          ctx.num(b.ev.N, formatCount(b.ev.N)),
          ", risk ",
          ctx.num(b.ev.risk, formatRisk(b.ev.risk)),
          ")",
          b.ev.N === x.ev.N ? "." : ["; ", captionNode(ctx, "different-disclosure"), "."],
        ]);
      }
    }

    benchmarkDetail.replaceChildren(...detailLines.map((line) => h("p", { class: "prx-rcmp-note" }, ...line)));
    benchmarkDetail.hidden = detailLines.length === 0;
  }

  function drawLabel(state, f, at) {
    if (state.data === "league8") {
      const src = f.cloud;
      const parts = [
        labelNode(ctx, src),
        " (",
        familySizeNode(ctx, src),
        ` ${T.reports}, every one evaluated): the boundary H(m), its vertices and the best report at τ = `,
        tauNode(state.tau),
        ", ",
        gradeNode("bestTau", at.byRule.best.g),
      ];
      if (at.bestTies.length) parts.push(" (tied with ", ...at.bestTies.flatMap((g, k) => [k ? ", " : "", gradeNode(null, g)]), ")");
      parts.push(". ", h("span", { "data-prx-tolerance-label": "" }, "Equal-risk tolerance"), " ", ctx.num(CONFIG.tieTol, formatSci(CONFIG.tieTol, { trim: true })), ".");
      labelLine.replaceChildren(...parts);
    } else {
      const dp = at.bestSource;
      const parts = [
        labelNode(ctx, dp),
        " (not H(m)) in ",
        famNode(dp),
        " (",
        familySizeNode(ctx, dp),
        ` ${T.reports}): the boundary and the best report at τ = `,
        tauNode(state.tau),
        ", ",
        gradeNode("bestTau", at.byRule.best.g),
        " (N = ",
        ro("bestTauN", at.byRule.best.ev.N, formatCount(at.byRule.best.ev.N)),
        "). ",
        h("span", { "data-prx-tolerance-label": "" }, "Equal-risk tolerance"),
        " ",
        ro("bestTieTol", dp.tieTol, formatSci(dp.tieTol, { trim: true })),
        ".",
      ];
      if (Number(dp.tieCount) > 1) {
        const tied = [at.byRule.best.g, ...at.bestTies].map((g) => ({ g, ev: evaluateReport(g, dataModel(state.data).E, { tau: state.tau }) }));
        parts.push(
          " ",
          ro("bestTieCount", dp.tieCount, formatCount(dp.tieCount)),
          " reports share the smallest risk within this order. ",
          h("span", { "data-prx-best-tie-policy": "" }, "The read-out and B point use the first representative below: fewer grades, then earlier cuts."),
          " Tied reports: ",
          ...tied.flatMap(({ g, ev }, i) => [
            i ? "; " : "",
            h(
              "span",
              { "data-prx-best-tie": i },
              gradeNode(`bestTieGrades.${i}`, g),
              " (N = ",
              ro(`bestTieN.${i}`, ev.N, formatCount(ev.N)),
              ", E = ",
              ro(`bestTieE.${i}`, ev.Ew, E4(ev.Ew)),
              ", risk ",
              ro(`bestTieRisk.${i}`, ev.risk, formatRisk(ev.risk)),
              ")",
            ),
          ]),
          ".",
        );
        if (tied.some((t) => t.ev.N !== tied[0].ev.N)) parts.push(" ", captionNode(ctx, "different-disclosure"), ".");
        if (Number(dp.tieCount) > tied.length) {
          parts.push(" ", ctx.num(Number(dp.tieCount) - tied.length, formatCount(Number(dp.tieCount) - tied.length)), " further equal-risk reports are not listed.");
        }
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

  function drawChart(state, d, f, at, show = true, targetSlot = chartSlot, widthOverride = 0) {
    const C = CONFIG.chart;
    const M = f.M;
    const sel = at.byRule[state.rule];
    const groups = groupsOf(at.rows);
    const selectedGroup = groups.find((g) => g.rules.some((x) => x.rule === state.rule)) ?? groups[0];
    const otherInside = groups.filter((g) => g !== selectedGroup && g.inside);
    const otherOutside = groups.filter((g) => g !== selectedGroup && !g.inside);

    const ruleMax = Math.max(...at.rows.map((x) => x.ev.Ew));
    const yTop = state.data === "league8" ? niceTop8(Math.max(ruleMax, f.hull.at(-1).Ew)) : niceTop30(Math.max(ruleMax, f.hull.at(-1).Ew));
    const measuredW = targetSlot.clientWidth || (widthOverride > 0 ? widthOverride : ctx.width());
    const width = Math.max(230, Math.round(measuredW));
    const height = Math.max(C.minHeight, Math.min(C.maxHeight, Math.round(width * C.aspect)));
    const inner = Math.max(1, width - C.marginLeft - C.marginRight);
    const roomy = inner >= 360;

    const cols = show && f.cloud ? f.cloud.byN.map((r) => ({ ...r, top: Math.min(r.maxEw, yTop), above: r.maxEw > yTop })) : [];
    const hull = show ? f.hull.filter((v) => v.Ew <= yTop) : [];
    const gapOn = show && !sel.outside && sel.gap.gap !== 0;
    const mixOn = gapOn && sel.mix.psi > 0;
    const tauOn = show && state.match === "tau" && targetSlot !== chartSlot;

    let lines = [];
    if (tauOn) {
      const sv = supportingVertex(f.hull, state.tau, { M });
      const through = (N0, E0) => {
        const c0 = E0 - state.tau * N0;
        const x0 = Math.max(0, -c0 / state.tau);
        const x1 = Math.min(M, (yTop - c0) / state.tau);
        return x1 > x0
          ? [
              { N: x0, y: c0 + state.tau * x0 },
              { N: x1, y: c0 + state.tau * x1 },
            ]
          : [];
      };
      lines = [{ kind: "support", pts: through(sv.vertex.N, sv.vertex.Ew) }];
      if (state.rule !== "best") lines.push({ kind: "parallel", pts: through(sel.ev.N, sel.ev.Ew) });
    }

    const xticks =
      state.data === "league8"
        ? roomy
          ? [0, 4, 8, 12, 16, 20, 24, 28]
          : [0, 7, 14, 21, 28]
        : roomy
          ? [0, 100, 200, 300, 400]
          : [0, 150, 300, 435];
    const xPad = state.data === "league8" ? C.xPad : C.xPad30;

    const titleOf = (g) => {
      const names = g.rules.map((x) => `${CONFIG.tags[x.rule]} (${nameOf(x.rule)})`).join(", ");
      let s = `${names}: N = ${formatCount(g.N)}, E = ${formatReadoutExpected(g.Ew)}.`;
      if (!g.inside) {
        s += ` ${T.outside}.`;
      } else if (show) {
        const x = g.rules.find((y) => !y.outside);
        s += x.gap.gap === 0 ? ` ${state.data === "league8" ? T.onFrontier : T.onBoundary} (gap 0).` : ` Gap at its own N: ${formatReadoutExpected(x.gap.gap)}.`;
      }
      if (g.above) s += ` ${T.above}.`;
      return s;
    };

    const fig = plot(targetSlot, {
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
      width,
      height,
      marginTop: C.marginTop,
      marginRight: C.marginRight,
      marginBottom: C.marginBottom,
      marginLeft: C.marginLeft,
      x: { domain: [-xPad, M + xPad], ticks: xticks, tickFormat: (v) => formatCount(v), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
      y: { domain: [0, yTop], ticks: 5, label: T.yLabel, labelArrow: "none", grid: true },
      color: { type: "identity" },
      marks: (c, P) => {
        const marks = [];
        if (cols.length) {
          const cappedCols = cols.filter((r) => !r.above);
          const openCols = cols.filter((r) => r.above);
          const fadeStart = yTop * 0.91;
          marks.push(
            P.ruleX(cappedCols, { x: "N", y1: "minEw", y2: "top", stroke: c.neutral[3], strokeWidth: C.column, strokeOpacity: 0.72 }),
            P.ruleX(openCols, { x: "N", y1: "minEw", y2: (r) => Math.max(r.minEw, fadeStart), stroke: c.neutral[3], strokeWidth: C.column, strokeOpacity: 0.72 }),
            P.ruleX(openCols, { x: "N", y1: (r) => Math.max(r.minEw, fadeStart), y2: () => yTop, stroke: c.neutral[4], strokeWidth: C.column, strokeDasharray: "2 2.5", strokeOpacity: 0.6 }),
            P.dot(cols, { x: "N", y: "minEw", r: C.minDot, fill: c.plotBg, stroke: c.neutral[4], strokeWidth: 1.1 }),
          );
        }
        if (show) {
          marks.push(
            P.line(f.hull, { x: "N", y: "Ew", stroke: c.post, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
            ...(mixOn ? [P.line([sel.mix.lower, sel.mix.upper], { x: "N", y: "Ew", stroke: c.post, strokeWidth: C.activeHullWidth, strokeDasharray: C.hullDash, clip: true })] : []),
            P.dot(hull, { x: "N", y: "Ew", r: C.vertexDot, fill: c.post, stroke: c.plotBg, strokeWidth: C.thin }),
          );
        }
        for (const ln of lines) {
          if (ln.pts.length) {
            marks.push(
              P.line(ln.pts, {
                x: "N",
                y: "y",
                stroke: ln.kind === "support" ? c.post : c.err,
                strokeWidth: C.lineWidth,
                strokeDasharray: ln.kind === "support" ? null : C.parallelDash,
                clip: true,
              }),
            );
          }
        }
        marks.push(
          P.dot(otherInside, { x: "N", y: "Ew", r: C.ruleDot, fill: c.neutral[4], stroke: c.plotBg, strokeWidth: C.dotStroke }),
          P.dot(otherOutside, { x: "N", y: "Ew", r: C.ruleDot, fill: c.plotBg, stroke: c.neutral[5], strokeWidth: 1.8 }),
        );
        if (gapOn) {
          marks.push(
            P.ruleX([{ N: sel.ev.N, y1: sel.gap.H, y2: sel.ev.Ew }], { x: "N", y1: "y1", y2: "y2", stroke: c.err, strokeWidth: C.gapWidth }),
            P.dot([{ N: sel.ev.N, H: sel.gap.H }], {
              x: "N",
              y: "H",
              symbol: mixOn ? "diamond" : "circle",
              r: mixOn ? C.mixDot : 5,
              fill: c.post,
              stroke: c.plotBg,
              strokeWidth: 1.6,
            }),
          );
        }
        marks.push(
          P.dot([sel.ev], {
            x: "N",
            y: "Ew",
            r: C.ring,
            fill: "none",
            stroke: sel.outside ? c.neutral[6] : c.accent,
            strokeWidth: C.ringWidth,
          }),
          P.dot([sel.ev], {
            x: "N",
            y: "Ew",
            r: C.activeDot,
            fill: sel.outside ? c.plotBg : c.accent,
            stroke: sel.outside ? c.neutral[6] : c.plotBg,
            strokeWidth: sel.outside ? 2.2 : 1.5,
          }),
        );
        return marks;
      },
      keyboard: {
        data: groups,
        x: "N",
        y: "Ew",
        key: (g) => g.tag,
        label: T.keyboardLabel,
        title: titleOf,
        pointer: true,
        onFocus: (g) => {
          focusedFrontierGroup = g;
        },
        onSelect: (g) => pickGroup(g),
      },
    });

    // --- At most 2–3 direct labels separated by placeDirectLabels (WA-02 item.id mapping, WB-03 backing rect, WA-13 bounds)
    const doc = fig.svg.ownerDocument;
    const sx = fig.scale("x");
    const sy = fig.scale("y");
    const pal = fig.palette;
    const safeTop = C.marginTop + 12;
    const safeBottom = height - C.marginBottom - 12;
    const safeLeft = C.marginLeft + 6;
    const safeRight = width - C.marginRight - 6;
    const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
    const makeSpan = (raw, display) => svgEl(doc, "tspan", { num: raw, text: display });

    const vx = sx.apply(sel.ev.N);
    const vyE = sy.apply(sel.ev.Ew);
    const refH = !sel.outside && sel.gap.gap > 0 ? sel.gap.H : null;
    const eDisp = refH !== null ? fmtExpectedPair(sel.ev.Ew, refH) : formatReadoutExpected(sel.ev.Ew);
    const rulePrefix = roomy ? `${shortNameOf(state.rule)}: E = ` : `${CONFIG.tags[state.rule]}: E = `;
    const ruleEstW = Math.ceil(7.1 * (rulePrefix.length + eDisp.length));

    let gapNodes = null;
    let gapFill = pal.errText;
    let gapEstW = 0;
    if (sel.outside) {
      gapNodes = ["outside family"];
      gapFill = pal.plotMuted;
      gapEstW = Math.ceil(7.1 * "outside family".length);
    } else if (sel.gap.gap > 0) {
      const gDisp = formatReadoutExpected(sel.gap.gap);
      gapNodes = ["gap +", makeSpan(sel.gap.gap, gDisp)];
      gapFill = pal.errText;
      gapEstW = Math.ceil(7.3 * (`gap +${gDisp}`).length);
    } else {
      gapNodes = ["gap ", makeSpan(0, "0"), roomy ? " (on boundary)" : ""];
      gapFill = pal.postText;
      gapEstW = Math.ceil(7.1 * (roomy ? "gap 0 (on boundary)" : "gap 0").length);
    }

    let hullAtRule = false;
    let hullNodes = null;
    let hullEstW = 0;
    let hullVx = vx;
    let hullVy = vyE;
    if (!sel.outside && sel.gap.gap > 0) {
      hullAtRule = true;
      hullVy = sy.apply(sel.gap.H);
      const hDisp = fmtExpectedPair(sel.gap.H, sel.ev.Ew);
      if (state.data === "league8" && roomy) {
        hullNodes = ["H(", makeSpan(sel.ev.N, formatCount(sel.ev.N)), ") = ", makeSpan(sel.gap.H, hDisp)];
        hullEstW = Math.ceil(7.1 * (`H(${formatCount(sel.ev.N)}) = ${hDisp}`).length);
      } else if (state.data === "league8") {
        hullNodes = ["H = ", makeSpan(sel.gap.H, hDisp)];
        hullEstW = Math.ceil(7.1 * (`H = ${hDisp}`).length);
      } else {
        hullNodes = [roomy ? "Boundary = " : "Bnd = ", makeSpan(sel.gap.H, hDisp)];
        hullEstW = Math.ceil(7.1 * (`${roomy ? "Boundary = " : "Bnd = "}${hDisp}`).length);
      }
    } else {
      const hullMinN = f.hull[0]?.N ?? 0;
      const hullMaxN = f.hull.at(-1)?.N ?? M;
      const refN = sel.ev.N <= M * 0.48
        ? Math.min(hullMaxN, Math.max(hullMinN, Math.round(M * 0.72)))
        : Math.max(hullMinN, Math.min(hullMaxN, Math.round(M * 0.28)));
      const refY = Math.min(yTop, matchedDisclosure(null, f.hull, refN).H);
      hullVx = sx.apply(refN);
      hullVy = sy.apply(refY);
      const txt = state.data === "league8" ? "H(m)" : "Order boundary";
      hullNodes = [txt];
      hullEstW = Math.ceil(7.1 * txt.length);
    }

    const stackMaxW = Math.max(ruleEstW, gapEstW, hullAtRule ? hullEstW : 0);
    const fitsRight = vx + 15 + stackMaxW <= safeRight;
    const fitsLeft = vx - 15 - stackMaxW >= safeLeft;
    const preferLeft = sel.ev.N > M * 0.54;
    const useLeft = preferLeft ? (fitsLeft || !fitsRight) : (!fitsRight && fitsLeft);
    const side = useLeft ? -1 : 1;
    const anchor = side > 0 ? "start" : "end";
    const lx = vx + side * 15;

    // Draw excess-error side bracket when gap > 0
    if (!sel.outside && sel.gap.gap > 0) {
      const yH = sy.apply(sel.gap.H);
      const bx = vx + side * C.bracketOffset;
      const tickX = bx - side * C.bracketTick;
      if (Math.abs(yH - vyE) >= 5 && bx >= safeLeft - 2 && bx <= safeRight + 2) {
        layer.append(
          svgEl(doc, "path", {
            d: `M${tickX},${yH}L${bx},${yH}L${bx},${vyE}L${tickX},${vyE}`,
            fill: "none",
            stroke: pal.err,
            strokeWidth: 1.5,
          }),
        );
      }
    }

    const colItems = [
      { id: "rule", vx, vy: vyE, x: lx, anchor, estW: ruleEstW, y: vyE - 12 },
      { id: "gap", vx, vy: hullAtRule ? (vyE + hullVy) / 2 : vyE, x: lx, anchor, estW: gapEstW, y: hullAtRule ? (vyE + hullVy) / 2 : vyE + 12 },
    ];
    if (hullAtRule) {
      colItems.push({ id: "hull", vx, vy: hullVy, x: lx, anchor, estW: hullEstW, y: hullVy + 12 });
    }

    const hullStandalone = !hullAtRule
      ? {
          id: "hull",
          vx: hullVx,
          vy: hullVy,
          x: Math.max(safeLeft + hullEstW / 2, Math.min(safeRight - hullEstW / 2, hullVx)),
          anchor: "middle",
          estW: hullEstW,
          y: hullVy - 15,
        }
      : null;

    // Check horizontal overlap if hullStandalone is near colItems
    let placedAll;
    if (hullStandalone) {
      const colX0 = anchor === "start" ? lx : lx - stackMaxW;
      const colX1 = anchor === "start" ? lx + stackMaxW : lx;
      const hX0 = hullStandalone.x - hullEstW / 2;
      const hX1 = hullStandalone.x + hullEstW / 2;
      if (Math.max(colX0, hX0) < Math.min(colX1, hX1) + 12) {
        placedAll = placeDirectLabels([...colItems, hullStandalone], { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] });
      } else {
        placedAll = [
          ...placeDirectLabels(colItems, { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] }),
          ...placeDirectLabels([hullStandalone], { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] }),
        ];
      }
    } else {
      placedAll = placeDirectLabels(colItems, { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] });
    }

    // Strictly map by item.id (WA-02)
    const byId = new Map(placedAll.map((p) => [p.id, p]));

    const hullP = byId.get("hull");
    if (hullP && hullNodes) {
      appendBackedLabel(
        layer,
        doc,
        pal,
        {
          x: hullP.x,
          y: hullP.y,
          anchor: hullP.anchor,
          fill: pal.postText,
          fontWeight: 600,
          estWidth: hullP.estW,
          safeLeft,
          safeRight,
        },
        ...hullNodes,
      );
    }

    const gapP = byId.get("gap");
    if (gapP && gapNodes) {
      appendBackedLabel(
        layer,
        doc,
        pal,
        {
          x: gapP.x,
          y: gapP.y,
          anchor: gapP.anchor,
          fill: gapFill,
          fontWeight: 700,
          estWidth: gapP.estW,
          safeLeft,
          safeRight,
        },
        ...gapNodes,
      );
    }

    const ruleP = byId.get("rule");
    if (ruleP) {
      const drawnX = appendBackedLabel(
        layer,
        doc,
        pal,
        {
          x: ruleP.x,
          y: ruleP.y,
          anchor: ruleP.anchor,
          fill: pal.plotFg,
          fontWeight: 700,
          estWidth: ruleP.estW,
          safeLeft,
          safeRight,
        },
        rulePrefix,
        makeSpan(sel.ev.Ew, eDisp),
      );
      if (Math.abs(ruleP.y - ruleP.vy) > 20) {
        layer.prepend(
          svgEl(doc, "line", {
            x1: ruleP.vx,
            y1: ruleP.vy,
            x2: drawnX + (ruleP.anchor === "end" ? 3 : -3),
            y2: ruleP.y,
            stroke: pal.plotMuted,
            strokeWidth: 1,
          }),
        );
      }
    }

    fig.svg.append(layer);
    return { yTop, cols };
  }

  function drawTauRiskChart(state, d, f, at, targetSlot = chartSlot, widthOverride = 0) {
    const TC = CONFIG.tauChart;
    const M = f.M;
    const measuredW = targetSlot.clientWidth || (widthOverride > 0 ? widthOverride : ctx.width());
    const width = Math.max(230, Math.round(measuredW));
    const compact = width < TC.compactBreakpoint;
    const marginTop = compact ? TC.mobileMarginTop : TC.marginTop;
    const marginBottom = compact ? TC.mobileMarginBottom : TC.marginBottom;
    const marginLeft = compact ? TC.marginLeftCompact : TC.marginLeftWide;
    const marginRight = compact ? TC.marginRightCompact : TC.marginRightWide;
    const pitch = compact ? TC.mobileRowPitch : TC.rowPitch;
    const barInset = compact ? 3.5 : 5;
    const height = marginTop + at.rows.length * pitch + marginBottom;

    const sorted = [...at.rows]
      .sort((a, b) => a.ev.risk - b.ev.risk || b.ev.N - a.ev.N)
      .map((x) => {
        const errPart = x.ev.Ew / M;
        const totalRisk = x.ev.risk;
        const selected = x.rule === state.rule;
        const rowLabel = compact ? CONFIG.barNamesCompact[x.rule] : CONFIG.barNamesWide[x.rule];
        return {
          ...x,
          errPart,
          totalRisk,
          selected,
          rowLabel,
        };
      });

    const domainOrder = sorted.map((x) => x.rowLabel);
    const maxVal = Math.max(state.tau, ...sorted.map((x) => x.totalRisk));
    const xMax = Math.max(0.05, Math.ceil(maxVal * 1.08 * 20) / 20);
    const selRow = sorted.find((x) => x.selected);
    const bestRisk = at.byRule.best.ev.risk;
    const selRisk = at.byRule[state.rule].ev.risk;

    const fmtBarRisk = (row) => {
      if (state.rule !== "best") {
        if (row.rule === state.rule) return fmtRiskPair(row.ev.risk, bestRisk);
        if (row.rule === "best") return fmtRiskPair(row.ev.risk, selRisk);
      }
      return formatReadoutRisk(row.ev.risk);
    };

    const barTitleOf = (row) => {
      const whShare = (state.tau * (M - row.ev.N)) / M;
      let s = `${CONFIG.tags[row.rule]} (${nameOf(row.rule)}): risk ${fmtBarRisk(row)} at τ = ${formatSetting(state.tau)} `;
      s += `(error share ${formatReadoutRisk(row.errPart)} + withholding charge ${formatReadoutRisk(whShare)}; N = ${formatCount(row.ev.N)} of ${formatCount(M)}).`;
      if (row.above) s += ` ${T.above}.`;
      return s;
    };

    const fig = plot(targetSlot, {
      alt: T.tauChartAlt,
      width,
      height,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      x: {
        domain: [0, xMax],
        ticks: 4,
        label: T.tauXLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
      },
      y: {
        domain: domainOrder,
        label: null,
        tickSize: 0,
      },
      color: { type: "identity" },
      marks: (c, P) => [
        selRow
          ? P.barX([selRow], {
              x1: 0,
              x2: xMax,
              y: "rowLabel",
              fill: c.neutral[1],
              insetTop: 1,
              insetBottom: 1,
            })
          : null,
        P.barX(sorted, {
          x1: 0,
          x2: "errPart",
          y: "rowLabel",
          fill: c.err,
          fillOpacity: (r) => (r.selected ? 0.94 : 0.62),
          stroke: (r) => (r.selected ? c.plotFg : "none"),
          strokeWidth: (r) => (r.selected ? 1.4 : 0),
          insetTop: barInset,
          insetBottom: barInset,
        }),
        P.barX(sorted, {
          x1: "errPart",
          x2: "totalRisk",
          y: "rowLabel",
          fill: c.relWithheld,
          fillOpacity: (r) => (r.selected ? 0.94 : 0.7),
          stroke: (r) => (r.selected ? c.plotFg : c.cellBorder),
          strokeWidth: (r) => (r.selected ? 1.4 : 0.8),
          insetTop: barInset,
          insetBottom: barInset,
        }),
        P.ruleX([state.tau], {
          stroke: c.plotFg,
          strokeWidth: 1.6,
          strokeDasharray: "5 3",
        }),
        P.ruleX([0], { stroke: c.plotAxis, strokeWidth: 1 }),
      ].filter(Boolean),
      keyboard: {
        data: sorted,
        x: "totalRisk",
        y: "rowLabel",
        key: (r) => r.rule,
        label: T.tauKeyboardLabel,
        title: barTitleOf,
        pointer: true,
        onFocus: (r) => {
          focusedTauRow = r;
        },
        onSelect: (r) => pickRule(r.rule),
      },
    });

    // End-of-bar 13px value pills + top τ benchmark pill (WB-03 backing rect, WA-13 bounds)
    const doc = fig.svg.ownerDocument;
    const sx = fig.scale("x");
    const sy = fig.scale("y");
    const pal = fig.palette;
    const bw = sy.bandwidth ?? pitch;
    const safeLeft = marginLeft + 4;
    const safeRight = width - 6;
    const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
    const makeSpan = (raw, display) => svgEl(doc, "tspan", { num: raw, text: display });

    // Bold selected y-axis tick label
    for (const t of fig.svg.querySelectorAll('[aria-label="y-axis tick label"] text')) {
      if (selRow && (t.textContent ?? "").trim() === selRow.rowLabel) {
        t.setAttribute("font-weight", "700");
        t.setAttribute("fill", pal.plotFg);
      }
    }

    // Top τ benchmark pill
    const tauX = sx.apply(state.tau);
    const tauDisp = formatSetting(state.tau);
    const tauPillText = compact ? `τ = ${tauDisp}` : `all-withheld τ = ${tauDisp}`;
    const tauEstW = Math.ceil(7.0 * tauPillText.length);
    appendBackedLabel(
      layer,
      doc,
      pal,
      {
        x: tauX,
        y: Math.max(11, marginTop - 11),
        anchor: "middle",
        fill: pal.plotFg,
        fontWeight: 600,
        estWidth: tauEstW,
        height: compact ? 18 : 19,
        fillOpacity: 1,
        safeLeft: 8,
        safeRight,
      },
      compact ? "τ = " : "all-withheld τ = ",
      makeSpan(state.tau, tauDisp),
    );

    // Per-row end-of-bar value labels offset cleanly past x = τ so the dashed line never bleeds through pills
    const tauClearOffset = compact ? 8 : 10;
    const pillH = compact ? 18 : 19.5;
    for (const row of sorted) {
      const yMid = sy.apply(row.rowLabel) + bw / 2;
      const barX = sx.apply(row.totalRisk);
      const rawX = barX + 6;
      const rDisp = fmtBarRisk(row);
      const nDisp = formatCount(row.ev.N);
      const children = compact
        ? [makeSpan(row.ev.risk, rDisp)]
        : [makeSpan(row.ev.risk, rDisp), " (N=", makeSpan(row.ev.N, nDisp), ")"];
      const estW = Math.ceil(7.0 * (compact ? rDisp.length : `${rDisp} (N=${nDisp})`.length));
      const crossesTau = rawX - 3.5 <= tauX + 4 && rawX + estW + 3.5 >= tauX - 3;
      const labelX = crossesTau ? Math.max(rawX, tauX + tauClearOffset) : rawX;
      if (labelX - barX > 12 && tauX - barX > 7) {
        layer.append(
          svgEl(doc, "line", {
            x1: barX + 2,
            y1: yMid,
            x2: tauX - 4,
            y2: yMid,
            stroke: pal.plotGrid,
            strokeWidth: 1,
          }),
        );
      }
      appendBackedLabel(
        layer,
        doc,
        pal,
        {
          x: labelX,
          y: yMid,
          anchor: "start",
          fill: row.selected ? pal.plotFg : pal.plotMuted,
          fontWeight: row.selected ? 700 : 500,
          estWidth: estW,
          height: pillH,
          fillOpacity: 1,
          safeLeft,
          safeRight,
        },
        ...children,
      );
    }

    fig.svg.append(layer);
    ctx.renderScope.listen(fig.svg, "click", (e) => {
      if (e.detail === 0) return;
      const rect = fig.svg.getBoundingClientRect?.();
      if (!(rect?.height > 0)) return;
      const svgY = ((e.clientY - rect.top) * height) / rect.height;
      const rowHit = sorted.find((r) => {
        const y0 = sy.apply(r.rowLabel);
        return Number.isFinite(y0) && svgY >= y0 && svgY <= y0 + bw;
      });
      if (rowHit) pickRule(rowHit.rule);
    });
  }

  function drawLegend(state, f) {
    const key = (cls, ...text) =>
      h(
        "span",
        { class: "prx-rcmp-key" },
        h("span", { class: `prx-rcmp-swatch ${cls}`, "aria-hidden": "true" }),
        h("span", {}, ...text),
      );
    if (fullModes && state.match === "tau") {
      legend.replaceChildren(
        key("prx-rcmp-sw-errbar", "expected error E/M"),
        key("prx-rcmp-sw-whbar", "withholding charge τ(M − N)/M"),
        key("prx-rcmp-sw-tauline", "all-withheld τ = ", tauNode(state.tau)),
      );
    } else {
      const hullDesc =
        state.data === "league8"
          ? ["H(m): ", captionNode(ctx, "mixture-not-report")]
          : ["order boundary (posterior-mean cuts)"];
      legend.replaceChildren(
        key("prx-rcmp-sw-hull", ...hullDesc),
        ...(f.cloud ? [key("prx-rcmp-sw-col", "gray bars: family E range (dashed top extends above axis)")] : []),
        key("prx-rcmp-sw-other", "other rules (click to select)"),
        key("prx-rcmp-sw-gap", "selected rule & excess-error gap"),
      );
    }
  }

  function drawTable(state, d, f, at, show = true) {
    const th = (...t) => h("th", { scope: "col" }, ...t);
    const notes = (x) => {
      const out = [];
      if (x.outside) {
        out.push(
          x.outside.kind === "grades"
            ? [`${T.outside}: `, ctx.num(x.G, formatCount(x.G)), " grades"]
            : x.outside.kind === "range"
              ? ["outside this family’s boundary range"]
              : [`${T.outside}: `, ctx.num(x.outside.against, formatCount(x.outside.against)), " directions against the order"],
        );
      } else if (show && state.match === "n" && x.gap.gap === 0) out.push([state.data === "league8" ? T.onFrontier : T.onBoundary]);
      if (x.above) out.push([T.above]);
      return out.flatMap((part, k) => (k ? ["; ", ...part] : part));
    };
    const headN = [th("Rule"), th("N"), th("E")];
    if (show) headN.push(th(state.data === "league8" ? "H at its N" : "Boundary at its N"), th("Gap"));
    headN.push(th("Note"));
    const headT = [th("Rule"), th("N"), th("E/N"), th(["Risk at τ = ", tauNode(state.tau)]), th("Note")];
    const combined = [
      th("Rule"),
      th("N"),
      th("E"),
      th("E/N"),
      th(state.data === "league8" ? "H at its N" : "Boundary at its N"),
      th("Gap"),
      th(["Risk at τ = ", tauNode(state.tau)]),
      th("Note"),
    ];
    const answerColumn = fullModes ? (state.match === "tau" ? 6 : 5) : state.match === "tau" ? 3 : show ? 4 : 2;
    const answerFirst = (cells) => [cells[0], cells[answerColumn], ...cells.slice(1).filter((_, i) => i + 1 !== answerColumn)];
    const rows = at.rows.map((x) => {
      const cells = [h("th", { scope: "row" }, tagNode(x.rule), " ", nameOf(x.rule)), h("td", {}, ro(`tN-${x.rule}`, x.ev.N, formatCount(x.ev.N)))];
      if (fullModes) {
        cells.push(
          h("td", {}, ro(`tE-${x.rule}`, x.ev.Ew, E4(x.ev.Ew))),
          h("td", {}, ro(`tEN-${x.rule}`, x.ev.EoverN[0], formatShare(x.ev.EoverN[0]))),
          h("td", {}, x.outside ? "none" : ro(`tH-${x.rule}`, x.gap.H, E4(x.gap.H))),
          h("td", {}, x.outside ? "none" : ro(`tGap-${x.rule}`, x.gap.gap, E4(x.gap.gap))),
          h("td", {}, ro(`tRisk-${x.rule}`, x.ev.risk, formatRisk(x.ev.risk))),
        );
      } else if (state.match === "n") {
        cells.push(h("td", {}, ro(`tE-${x.rule}`, x.ev.Ew, E4(x.ev.Ew))));
        if (show) {
          cells.push(
            h("td", {}, x.outside ? "none" : ro(`tH-${x.rule}`, x.gap.H, E4(x.gap.H))),
            h("td", {}, x.outside ? "none" : ro(`tGap-${x.rule}`, x.gap.gap, E4(x.gap.gap))),
          );
        }
      } else {
        const en = x.ev.EoverN[0];
        cells.push(h("td", {}, ro(`tEN-${x.rule}`, en, formatShare(en))), h("td", {}, ro(`tRisk-${x.rule}`, x.ev.risk, formatRisk(x.ev.risk))));
      }
      cells.push(h("td", { class: "prx-rcmp-notecell" }, ...notes(x)));
      return h(
        "tr",
        {
          class: x.rule === state.rule ? "prx-rcmp-row-sel" : "",
          "data-prx-rule": x.rule,
          "aria-current": x.rule === state.rule ? "true" : undefined,
        },
        ...answerFirst(cells),
      );
    });
    const caption =
      state.match === "tau"
        ? h("p", { class: "prx-rcmp-note" }, "All risks at τ = ", tauNode(state.tau), "; ", captionNode(ctx, "different-disclosure"), ". The all-withheld risk is τ itself.")
        : h(
            "p",
            { class: "prx-rcmp-note" },
            state.data === "league8"
              ? "The gap is E minus H at the rule’s own N, only for rules inside the family; between vertices H may require a mixture."
              : "The gap uses the boundary within the posterior-mean order, only for rules inside that order family; it is not H(m).",
          );
    const id = uid("prx-rcmp-table");
    const wrap = ctx.scrollRegion(
      h(
        "div",
        { class: "prx-rcmp-table-wrap" },
        h(
          "table",
          { class: "prx-rcmp-table prx-sticky-first", "aria-labelledby": id },
          h("thead", {}, h("tr", {}, ...answerFirst(fullModes ? combined : state.match === "n" ? headN : headT))),
          h("tbody", {}, ...rows),
        ),
      ),
      T.tableTitle,
    );
    tableBox.replaceChildren(ctx.panelTitle(T.tableTitle, { className: "prx-rcmp-heading", id }), wrap, caption);
  }

  function drawRankStrip(at, selected, tauVal, widthOverride = 0) {
    if (!rankSlot || !rankChart || !rankHeading || !rankNote) return;
    const available = rankSlot.clientWidth || widthOverride || (ctx.width() - 32);
    const width = Math.max(220, Math.round(available));
    const fontScale = Number(rankChart.closest(".prx-widget")?.dataset.prxFontScale) || 1;
    const maxGlyphWidth = Math.ceil(13 * fontScale);
    // Leave room for the links and wrap a tied group only between rule abbreviations.
    const maxChars = Math.max(3, Math.floor((width - 88) / (2 * maxGlyphWidth)));
    const rankBy = (rows, metric) => {
      const groups = [];
      for (const row of [...rows].sort((a, b) => metric(a) - metric(b))) {
        const value = metric(row);
        const last = groups.at(-1);
        if (last && Math.abs(value - last.value) <= CONFIG.tieTol) last.rules.push(row.rule);
        else groups.push({ value, rank: groups.length + 1, rules: [row.rule] });
      }
      return groups.map(group => {
        const lines = [CONFIG.tags[group.rules[0]]];
        for (const rule of group.rules.slice(1)) {
          const tag = "=" + CONFIG.tags[rule];
          if (lines.at(-1).length + tag.length > maxChars) lines.push(tag);
          else lines[lines.length - 1] += tag;
        }
        return { ...group, lines, tag: lines.join("\n") };
      });
    };
    const risk = rankBy(at.rows, (row) => row.ev.risk);
    const gap = rankBy(
      at.rows.filter((row) => !row.outside),
      (row) => row.gap.gap,
    );
    const ranks = new Map(gap.flatMap((g) => g.rules.map((rule) => [rule, g.rank])));
    const links = risk.flatMap((g) => g.rules.filter((rule) => ranks.has(rule)).map((rule) => ({ rule, risk: g.rank, gap: ranks.get(rule) })));
    const maximum = Math.max(risk.length, gap.length);
    const marginFor = groups => 12 + maxGlyphWidth * Math.max(1, ...groups.flatMap(group => group.lines.map(line => line.length)));
    const maxLines = Math.max(1, ...[...risk, ...gap].map(group => group.lines.length));
    const rowHeight = Math.max(24, maxLines * 17 * fontScale + 7);

    rankHeading.replaceChildren(h("span", {}, "Risk rank at τ = ", tauNode(tauVal)), h("span", {}, "Gap rank at own N"));
    rankNote.hidden = !at.rows.some((row) => row.outside);
    plot(rankChart, {
      alt: "Rules ranked side by side by their risk at the common withholding cost and by their gap at their own disclosure. Ties share a rank. Outside-family rules have no gap rank.",
      width,
      height: 54 + maximum * rowHeight,
      marginLeft: marginFor(risk),
      marginRight: marginFor(gap),
      marginTop: 12,
      marginBottom: 14,
      x: { domain: [0, 1], axis: null },
      y: { domain: [maximum + 0.5, 0.5], axis: null },
      table: {
        caption: "The two rank orders",
        rows: at.rows,
        columns: [
          { label: "Rule", value: (row) => nameOf(row.rule) },
          { label: "Risk rank", value: (row) => risk.find((g) => g.rules.includes(row.rule)).rank },
          { label: "Gap rank", value: (row) => ranks.get(row.rule) ?? "Outside family" },
        ],
      },
      marks: (c, P) => [
        P.link(links, {
          x1: () => 0,
          x2: () => 1,
          y1: "risk",
          y2: "gap",
          stroke: (lnk) => (lnk.rule === selected ? c.accent : c.plotMuted),
          strokeWidth: (lnk) => (lnk.rule === selected ? 2.6 : 1.1),
          strokeOpacity: (lnk) => (lnk.rule === selected ? 1 : 0.5),
        }),
        P.dot(risk, { x: () => 0, y: "rank", r: 3.5, fill: c.plotFg }),
        P.dot(gap, { x: () => 1, y: "rank", r: 3.5, fill: c.plotFg }),
        P.text(risk, { x: () => 0, y: "rank", text: "tag", dx: -8, textAnchor: "end", fill: c.plotFg }),
        P.text(gap, { x: () => 1, y: "rank", text: "tag", dx: 8, textAnchor: "start", fill: c.plotFg }),
      ],
    });
  }

  function drawComplementary(state, d, f, at) {
    if (!fullModes || !compWrap || !compTitle || !compChartSlot) return;
    const fallbackW = Math.max(220, ctx.width() - 32);
    if (state.match === "tau") {
      compTitle.textContent = "Complementary view: matched-disclosure boundary and equal-risk lines";
      drawChart(state, d, f, at, true, compChartSlot, fallbackW);
    } else {
      compTitle.replaceChildren("Complementary view: risk decomposition at τ = ", tauNode(state.tau));
      drawTauRiskChart(state, d, f, at, compChartSlot, fallbackW);
    }
  }

  return {
    drawConditions,
    drawReadout,
    drawLabel,
    drawChart,
    drawLegend,
    drawTable,
    render(state, info) {
      // PR-06 / PR-09: never re-render stage or re-fire aria-live readout when toggling disclosures;
      // only redraw width-dependent secondary SVGs inside dataBox at their true open width.
      if (info?.reason === "disclosure") {
        if (fullModes && info.disclosure === "data" && dataBox.open) {
          const d = dataModel(state.data);
          const f = famModel(state.data, state.family);
          const at = rulesAt(state.data, state.family, state.tau);
          drawComplementary(state, d, f, at);
        }
        return;
      }

      ctx.root.setAttribute("aria-busy", "true");
      try {
        if (dataSwitch) dataSwitch.set(state.data);
        if (labelledFor !== state.data) {
          labelledFor = state.data;
          familySwitch.buttons.forEach((btn, k) => {
            btn.replaceChildren(...famLabelNodes(state.data, CONFIG.families[k]));
          });
        }
        familySwitch.set(state.family);
        if (matchSwitch) matchSwitch.set(state.match);
        tau.set(state.tau);
        ruleSelect.set(state.rule);

        const d = dataModel(state.data);
        const f = famModel(state.data, state.family);
        const at = rulesAt(state.data, state.family, state.tau);

        drawScope(f);
        drawConditions(state, d, f);
        drawReadout(state, d, f, at);
        drawLabel(state, f, at);

        if (fullModes && state.match === "tau") {
          drawTauRiskChart(state, d, f, at, chartSlot);
        } else {
          drawChart(state, d, f, at, true, chartSlot);
        }
        drawLegend(state, f);
        drawTable(state, d, f, at, true);
        if (fullModes) {
          drawRankStrip(at, state.rule, state.tau);
          drawComplementary(state, d, f, at);
        }
      } finally {
        ctx.root.removeAttribute("aria-busy");
      }
    },
  };
}

export function mountComparison(
  el,
  spec = {},
  { name = CONFIG.name, frame = "v2", fullModes = false, match = "n", preset = "same-n", title = CONFIG.title } = {},
) {
  return createWidget(
    el,
    { preset, ...spec },
    {
      name,
      label: fullModes ? "Common rules at one withholding cost or matched disclosure, within a named family" : CONFIG.label,
      title,
      className: CONFIG.className,
      css: COMPARISON_CSS,
      frame,
      keys: comparisonKeys({ fullModes, match }),
      build: (ctx) => createComparisonView(ctx, { fullModes }),
    },
  );
}

export function mountWidget(el, spec = {}) {
  return mountComparison(el, spec, { frame: "v2" });
}

export const COMPARISON_CSS = `/*
 * postrank Explorer · rule-comparison & same-tau-or-same-n (Frame v2)
 */

.prx-rcmp {
  overflow-wrap: break-word;
}

.prx-rcmp .prx-controls > * {
  min-width: 0;
}

.prx-rcmp[data-prx-frame="v2"] .prx-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
  align-items: flex-end;
}

.prx-rcmp[data-prx-frame="v2"] .prx-slider {
  flex: 1 1 11.5rem;
  max-width: 17.5rem;
}

.prx-rcmp[data-prx-frame="v2"] .prx-select {
  flex: 1 1 11.5rem;
  max-width: 16.5rem;
}

.prx-rcmp[data-prx-frame="v2"] .prx-rcmp-match {
  flex: 0 1 auto;
}

/* PR-01: reset any grid-area assumptions inside the unified v2 stage */
.prx-rcmp[data-prx-frame="v2"] .prx-stage {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.prx-rcmp[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}

.prx-rcmp .prx-rcmp-chart {
  min-width: 0;
  max-width: 100%;
}

/* Compact 3-item inline key on the plot-paper stage */
.prx-rcmp[data-prx-frame="v2"] .prx-stage .prx-rcmp-keymain {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0;
  padding: 0.3rem 0.1rem 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
  background: transparent;
  border-top: 1px solid var(--prx-plot-grid);
  border-radius: 0;
}

.prx-rcmp[data-prx-frame="v2"] .prx-stage .prx-rcmp-legend .prx-result-caption {
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
  width: 1.5em;
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

.prx-rcmp .prx-rcmp-sw-hull::before {
  left: 0.1em;
  right: 0.1em;
  width: auto;
  transform: translateY(-50%);
  border-top: 2.5px dashed var(--prx-post, #1f3a5f);
}

.prx-rcmp .prx-rcmp-sw-col::before {
  width: 2px;
  height: 0.88em;
  background: linear-gradient(to top, var(--prx-neutral-4, #969696) 58%, transparent 58%, transparent 76%, var(--prx-neutral-4, #969696) 76%);
}

.prx-rcmp .prx-rcmp-sw-other::before {
  width: 0.68em;
  height: 0.68em;
  border-radius: 50%;
  background: var(--prx-neutral-4, #969696);
}

.prx-rcmp .prx-rcmp-sw-gap::before {
  width: 0.78em;
  height: 0.78em;
  border-radius: 50%;
  background: var(--prx-accent, #17645E);
  box-shadow: 0 0 0 2px var(--prx-err, #D55E00);
}

.prx-rcmp .prx-rcmp-sw-errbar::before {
  width: 1.1em;
  height: 0.68em;
  border-radius: 2px;
  background: var(--prx-err, #D55E00);
}

.prx-rcmp .prx-rcmp-sw-whbar::before {
  width: 1.1em;
  height: 0.68em;
  border-radius: 2px;
  background: var(--prx-rel-withheld, #cccccc);
  border: 1px solid var(--prx-cell-border, #767676);
}

.prx-rcmp .prx-rcmp-sw-tauline::before {
  left: 0.1em;
  right: 0.1em;
  width: auto;
  transform: translateY(-50%);
  border-top: 2px dashed var(--prx-plot-fg, #1f2421);
}

/* Settings & Disclosures */
.prx-rcmp[data-prx-frame="v2"] .prx-disclosure .prx-segmented .prx-seg-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.prx-rcmp .prx-rcmp-sym {
  white-space: nowrap;
}

.prx-rcmp .prx-rcmp-tag {
  font-weight: 600;
  white-space: nowrap;
}

.prx-rcmp .prx-rcmp-grade {
  white-space: normal;
  overflow-wrap: anywhere;
}

.prx-rcmp .prx-rcmp-heading {
  margin: 0 0 0.35rem;
  font-size: 0.94em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-rcmp .prx-rcmp-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-rcmp .prx-rcmp-benchmark > p:first-child {
  margin-top: 0;
}

.prx-rcmp .prx-rcmp-label {
  margin: 0.5rem 0;
  font-size: 0.92em;
  overflow-wrap: anywhere;
}

.prx-rcmp .prx-rcmp-label .prx-result-label {
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-rcmp .prx-rcmp-conditions {
  margin: 0.5rem 0;
  padding: 0.45rem 0.7rem;
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

.prx-rcmp .prx-rcmp-scope {
  color: var(--prx-fg-muted);
}

/* Complementary section in Data and the on-stage rank strip */
.prx-rcmp .prx-rcmp-comp {
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--prx-border);
  min-width: 0;
}

.prx-rcmp .prx-rcmp-ranks {
  max-width: 34rem;
  margin: 0.75rem auto 0;
  min-width: 0;
}

.prx-rcmp .prx-rcmp-rank-headings {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.35rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

/* Table of all rules */
.prx-rcmp .prx-rcmp-table-box {
  margin: 0;
  min-width: 0;
}

.prx-rcmp .prx-rcmp-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.prx-rcmp .prx-rcmp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.prx-rcmp .prx-rcmp-table th,
.prx-rcmp .prx-rcmp-table td {
  padding: 0.25rem 0.55rem 0.25rem 0;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
}

.prx-rcmp .prx-rcmp-table thead th {
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--prx-border-strong);
}

.prx-rcmp .prx-rcmp-table tbody tr[data-prx-rule] {
  cursor: pointer;
}

.prx-rcmp .prx-rcmp-table tbody tr[data-prx-rule]:hover > * {
  background: var(--prx-bg-raised);
}

.prx-rcmp .prx-rcmp-table tbody th {
  font-weight: 400;
  min-width: 11em;
}

.prx-rcmp .prx-rcmp-notecell {
  min-width: 9em;
  color: var(--prx-fg-muted);
}

.prx-rcmp .prx-rcmp-row-sel th,
.prx-rcmp .prx-rcmp-row-sel td {
  font-weight: 600;
  background: var(--prx-bg-sunken, var(--prx-bg-raised));
}

@media (min-width: 48.01em) {
  .prx-rcmp[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.25rem 0.6rem;
    margin-bottom: 0.35rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex: 1 1 100%;
    gap: 0.35rem 0.75rem;
    align-items: flex-end;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-slider {
    flex: 1 1 10.5rem;
    max-width: 15rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-select {
    flex: 0 1 14rem;
    max-width: 15rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    font-size: 0.78rem;
    line-height: 1.15;
    margin-bottom: 0.1rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.22rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.14rem 0.36rem;
    min-height: 1.82rem;
    font-size: 0.79rem;
    line-height: 1.18;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.85rem;
    padding: 0.14rem 0;
  }
}

/* PR-05: >= 44px touch targets & clean preset wrapping on mobile */
@media (pointer: coarse), (max-width: 48em) {
  .prx-rcmp[data-prx-frame="v2"] .prx-segmented .prx-seg,
  .prx-rcmp[data-prx-frame="v2"] .prx-select select {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}

@media (max-width: 30em) {
  .prx-rcmp[data-prx-frame="v2"] {
    padding: 0.45rem 0.5rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-title {
    margin: 0 0 0.3rem;
    font-size: 0.98rem;
    line-height: 1.25;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.28rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-controls {
    gap: 0.28rem 0.45rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    font-size: 0.76rem;
    margin-bottom: 0.08rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.24rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.16rem 0.38rem;
    font-size: 0.78rem;
    line-height: 1.15;
  }
  .prx-rcmp[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.35rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.9rem;
    line-height: 1.32;
  }
  .prx-rcmp[data-prx-frame="v2"] > .prx-stage {
    padding: 0.4rem 0.45rem;
    gap: 0.3rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-stage .prx-rcmp-keymain {
    gap: 0.14rem 0.55rem;
    padding-top: 0.2rem;
    font-size: 0.76rem;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-scope {
    margin-top: 0.2rem;
    font-size: 0.78rem;
  }
  .prx-rcmp[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.35rem;
    gap: 0.3rem;
  }
  .prx-rcmp[data-prx-frame="v2"] > .prx-disclosures > .prx-disclosure > summary {
    padding: 0.32rem 0;
  }
  .prx-rcmp[data-prx-frame="v2"] .prx-caption {
    margin-top: 0.2rem;
    line-height: 1.28;
  }
  .prx-rcmp .prx-rcmp-table tbody th {
    min-width: 7.5em;
  }
  .prx-rcmp .prx-rcmp-notecell {
    min-width: 6.5em;
  }
}
`;
