// G-09 converter/payoff port; the model and real view factories are also used by app 5.2.
import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { blocksText, formatCount, formatGrades, formatRisk, formatSci, formatSetting, formatSig, setNum } from "../shared/format.js";
import { captionNode, familySizeNode, labelNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { familySize, krwCorrespondence, krwRisk, lambdaToTau, pairDecision } from "../pr-core.js";
import { parseAxis, resolve, readRaceCard } from "./two-denominators.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const E6 = (() => { const a = SIX.arrays.one; return { ids: a.ids.slice(), criteria: a.criteria.slice(), e: a.e.map(m => m.map(row => row.map(x => x === null ? NaN : x))) }; })();
export const FAMILY = Object.freeze({ kind: "all" });
export const IDS = E6.ids;
export const FAMILY_COUNT = Number(familySize(IDS.length, FAMILY));
export const CONFIG = Object.freeze({ lambda: Object.freeze({ min: .01, max: 1, step: .01, value: .25 }), tau: Object.freeze({ min: lambdaToTau(.01), max: .5, step: .01 }), family: FAMILY });
export const BRIDGE_TEXT = Object.freeze({
    lambdaLabel: "KRW's λ: reward for a correct stated direction (a wrong one costs 1)",
    tauLabel: "postrank's τ: cost of staying silent on a pair (a wrong direction costs 1)",
    // converter
    convHead: "The conversion",
    convRows: Object.freeze(["postrank's withholding cost", "KRW's pair cut-off on the direction probability", "Informed share φ of KRW's audience"]),
    convNote: Object.freeze(["KRW state a direction when its probability exceeds ", "{one}", "/(", "{one}", " + λ); postrank states it when its error is below τ: for a pair on its own, the same cut (fitting all pairs into grades can move some pairs across it). The informed share is KRW's audience model: readers who already know the order of a pair the report leaves in one grade (KRW write q)."]),
    // payoff view
    payoffHead: "One pair: KRW's expected payoff and postrank's expected cost",
    payoffX: "Direction probability that i is above j",
    payoffY: "KRW's expected payoff",
    costY: "postrank's expected cost",
    lineIJ: "state i above j",
    lineJI: "state j above i",
    lineWH: "withhold",
    payoffAlt: "Left: KRW's expected payoff of one pair against the direction probability π that i is above j. Stating i above j pays (1 + λ)π − 1 (solid line), stating j above i pays λ − (1 + λ)π (dashed line), withholding pays 0 (flat gray line); the upper envelope is shaded. ",
    costAlt: "Right: postrank's expected cost of the same pair. Stating i above j costs 1 − π (solid line), stating j above i costs π (dashed line), withholding costs τ (flat gray line); the lower envelope is shaded. ",
    cutAlt: "Two dashed vertical lines mark where stating j above i stops being best and where stating i above j becomes best: ",
    outcomeCaption: "The three outcomes of one pair, and the identity that links the two scales",
    colOutcome: "Outcome",
    colPayoff: "KRW's payoff",
    colCost: "postrank's cost",
    colMap: Object.freeze(["τ + (", "{one}", " − τ) × (− KRW's payoff)"]),
    rowCorrect: "Correct stated direction",
    rowWrong: "Wrong stated direction",
    rowWithheld: "Withheld (same grade)",
    identityWords: Object.freeze(["Averaged over all pairs and over the posterior, the last column says: postrank's risk at τ is τ plus (", "{one}", " − τ) times KRW's risk at λ. The factor ", "{one}", " − τ is positive, so both rank every report in the same order."]),
    // axes view
    axesHead: "The six sites' reports on KRW's axes",
    axesX: "DR = E/M: expected wrong directions per pair",
    axesY: "I(g, θ) = (C − D<)/M",
    axesNote: "KRW write τ̄ (Kendall's τ̄) for the vertical axis; the theory book writes I(g, θ) and averages it over the posterior. Both axes are linear in N and E, so this is the same report cloud with a change of axes.",
    axesAlt: "Every one of the 4,683 six-site reports as a small gray dot at its discordance rate (horizontal) and its expected correct minus wrong directions per pair (vertical). The reports with one value of N lie on one line of slope −2. The best report is ringed, and a solid line through it joins the points of equal KRW risk at this λ; no report lies above it. The all-withheld report sits at the origin.",
    axesTable: "The six sites' reports by the number of stated pairs N",
    colN: "Pairs stated, N",
    colReports: "Reports",
    colMinDR: "Smallest DR",
    colTopI: "Correct minus wrong per pair, at that report",
    lineLabel: "equal KRW risk",
    allWithheld: "all withheld",
    axesBest: Object.freeze(["The best report at λ = ", "{lambda}", ", ", "{grades}", ", sits at DR = ", "{dr}", " and (N − ", "{two}", "E)/M = ", "{inf}",
      "; the line through it has slope (", "{one}", " − λ)/λ = ", "{slope}", "."]),
    axesFlat: Object.freeze([" At λ = ", "{one}", " the line is flat: KRW's loss is then minus the vertical coordinate, so the best report is the one with the largest expected correct minus wrong directions."]),
    // identity panel
    idHead: "The same best reports, checked over every six-site report",
    idPostrank: Object.freeze(["postrank at τ = ", "{tau}", ": ", "{label}", " (", "{size}", " reports): ", "{grades}", ", risk ", "{risk}", "."]),
    idKrw: Object.freeze(["KRW at λ = ", "{lambda}", ": the reports with the smallest KRW risk among the same ", "{size}", ": ", "{grades}", ", KRW risk ", "{krw}", "."]),
    idSame: "The two sets of best reports are the same.",
    idDiffer: "The two sets of best reports differ.",
    idDiff: Object.freeze(["For every report, postrank's risk minus (τ + (", "{one}", " − τ) × KRW's risk) is at most ", "{diff}", " in size (floating-point rounding; the identity says zero). Equal-risk tolerance ", "{tol}", " on postrank's scale."]),
    condorcet: Object.freeze(["At λ = ", "{lambda}", " KRW's objective is, up to a positive scale and a constant, the expected Kemeny distance from the true order; KRW call its best grades Condorcet ranks. For the six sites the best report is ", "{grades}", "."]),
    condorcetCard: Object.freeze([" KRW's λ = ", "{lambda}", " grid card gives each of the ", "{n}", " firms its own grade, ", "{G}", " grades in all; source: ", "{cap}", ". Its DR under the released pair probabilities is ", "{dr}", ": ", "{fixed}", "."]),
    gridHead: "The check at every τ of the grid",
    gridCaption: "postrank's best reports at τ and KRW's at the matching λ, each over all six-site reports",
    colTau: "τ",
    colLambda: "λ",
    colPr: "postrank's best",
    colKrw: "KRW's best",
    colSameSet: "Same?",
    yes: "yes",
    no: "no",
    gridBusy: "Computing the grid …",
    gridSummary: Object.freeze(["The two sets are the same at ", "{same}", " of the ", "{count}", " grid values; the largest difference between the two risks over every report and every grid value is ", "{diff}", "."]),
    // read-out
    readout: Object.freeze(["λ = ", "{lambda}", " is τ = ", "{tau}", "; KRW's pair cut-off ", "{one}", "/(", "{one}", " + λ) = ", "{one}", " − τ is ", "{cut}", ". "]),
    readSame: Object.freeze(["postrank at τ and KRW at λ choose the same best report over all six-site reports: ", "{grades}", "."]),
    readDiffer: Object.freeze(["postrank at τ and KRW at λ choose different best reports here: ", "{grades}", "."]),
    readGrid: Object.freeze([" The τ grid check is done: the two sets of best reports are the same at ", "{same}", " of the ", "{count}", " grid values."]),
    readGridBusy: " The τ grid check is running.",
    caption: "Six fictional sites: ",
});
const T = BRIDGE_TEXT;
const memo = new Map();
export function identityAt(state) {
  const r = resolve(state);
  const axis = r.from === "tau" ? { tau: r.tau } : { lambda: r.lambda };
  const key = `${r.from}|${axis.tau ?? axis.lambda}`;
  if (!memo.has(key)) {
    if (memo.size >= 64) memo.delete(memo.keys().next().value);
    memo.set(key, krwCorrespondence(E6, { ...axis, family: FAMILY, tieFree: true, maxTies: FAMILY_COUNT }));
  }
  return memo.get(key);
}
export const gridTaus = () => Array.from({ length: 49 }, (_, i) => (i + 2) / 100);
export const raceCardReference = () => readRaceCard();
export const bridgeKeys = (lambda = .25) => ({
  lambda: { type: "custom", value: lambda, parse: parseAxis(CONFIG.lambda.min, CONFIG.lambda.max) },
  tau: { type: "custom", value: null, parse: parseAxis(CONFIG.tau.min, CONFIG.tau.max) },
});
const num = (ctx, raw, display, hook) => { const n = ctx.num(raw, display); if (hook) n.setAttribute("data-prx-readout", hook); return n; };
const setting = (ctx, raw, hook) => num(ctx, raw, formatSetting(raw), hook);
const grade = (ctx, g, hook) => num(ctx, Array.from(g), formatGrades(g), hook);
const gradeList = (ctx, gs, hook) => gs.flatMap((g, i) => [i ? i === gs.length - 1 ? " and " : ", " : "", grade(ctx, g, `${hook}-${i}`)]);
const fill = (ctx, parts, slots = {}) => [].concat(parts).flatMap(p => { const m = /^\{(\w+)\}$/.exec(p); return m ? [].concat((slots[m[1]] ?? (() => ctx.num(m[1] === "two" ? 2 : 1, formatCount(m[1] === "two" ? 2 : 1))))()) : [p]; });

export function createAxisControls(ctx) {
  const lambda = ctx.slider({ label: T.lambdaLabel, ...CONFIG.lambda, valueType: "number", stepOrigin: 0, name: "lambda", hint: ["λ = ", ctx.num(0, formatCount(0)), " is an endpoint outside postrank, which needs τ above ", ctx.num(0, formatCount(0)), "; the slider starts at the first positive λ of KRW's grid."], onInput: value => ctx.set({ lambda: value, tau: null }) });
  const tau = ctx.slider({ label: T.tauLabel, ...CONFIG.tau, valueType: "number", stepOrigin: 0, name: "tau", onInput: value => ctx.set({ tau: value, lambda: null }) });
  ctx.controls.append(lambda.root, tau.root);
  return { lambda, tau, render(model) { lambda.set(model.parameters.lambda); tau.set(model.parameters.tau); } };
}

export const BRIDGE_CSS = `
.prx-kbridge .prx-controls{align-items:flex-start;column-gap:1rem}
.prx-kbridge .prx-controls>.prx-slider{flex-basis:calc(50% - .5rem);max-width:none}
.prx-kbridge .prx-presets{flex-basis:100%}
.prx-kbridge .kb-box{margin:.7rem 0 0;padding:.55rem .75rem;border:1px solid var(--prx-border);border-radius:var(--prx-radius);min-width:0}
.prx-kbridge .kb-head{margin:0 0 .35rem;font-size:.95em;font-weight:600}
.prx-kbridge .kb-note{margin:.35rem 0 0;font-size:.9em;color:var(--prx-fg-muted)}
.prx-kbridge .kb-line{margin:.35rem 0 0;overflow-wrap:anywhere}
.prx-kbridge .kb-conv{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:.2rem .75rem;align-items:center;margin:0}
.prx-kbridge .kb-conv dt{font-weight:400;font-size:.92em;color:var(--prx-fg-muted)}
.prx-kbridge .kb-conv dd{margin:0;min-width:0}.prx-kbridge .kb-tex{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden}
.prx-kbridge .kb-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:.75rem 1rem;align-items:start}
.prx-kbridge .kb-figure{padding:.25rem .25rem .5rem;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border-radius:var(--prx-radius);min-width:0;max-width:100%}
.prx-kbridge .kb-figure .prx-panel-title{color:var(--prx-plot-fg)}
.prx-kbridge .kb-chart{min-width:0;max-width:100%}.prx-kbridge .kb-table{max-width:100%;overflow-x:auto;margin:.5rem 0 0}
.prx-kbridge .kb-table table{border-collapse:collapse;font-size:.92em;min-width:min(100%,26rem)}
.prx-kbridge .kb-table caption{caption-side:top;max-width:calc(100vw - 5rem);white-space:normal;text-align:left;padding:0 0 .3rem;color:var(--prx-fg-muted)}
.prx-kbridge .kb-table th,.prx-kbridge .kb-table td{overflow-wrap:normal;word-break:normal;hyphens:manual;padding:.25rem .5rem;border-bottom:1px solid var(--prx-border);text-align:left;vertical-align:top}
.prx-kbridge .kb-table thead th{border-bottom-width:2px}.prx-kbridge .kb-table tbody th{font-weight:400}
.prx-kbridge .kb-payoff .kb-table table{min-width:34rem}
.prx-kbridge .kb-cost{color:var(--prx-err-text)}.prx-kbridge .kb-verdict{font-weight:600}
.prx-kbridge .kb-blocks{font-weight:600;line-height:1.5}.prx-kbridge .kb-best .prx-result-tag{margin-top:.3rem}
@media(max-width:34rem){.prx-kbridge .prx-controls>.prx-slider{flex-basis:100%}.prx-kbridge .kb-conv{grid-template-columns:minmax(0,1fr)}.prx-kbridge .kb-conv dd{margin-bottom:.3rem}}
`;

export function createConverterView(ctx, slot) {
  const { h } = ctx;
  const cells = T.convRows.map(() => h("span", { class: "kb-tex" }));
  const root = h("section", { class: "kb-box", "aria-label": T.convHead }, ctx.panelTitle(T.convHead),
    h("dl", { class: "kb-conv" }, ...T.convRows.flatMap((label, i) => [h("dt", { text: label }), h("dd", {}, cells[i])])), h("p", { class: "kb-note" }, ...fill(ctx, T.convNote)), h("p", { class: "kb-note" }, "Under that audience model, φ reconstructs both parameters: ", h("span", { class: "kb-tex", "data-prx-audience-inverse": "" })));
  slot.append(root);
  return { root, render(model) {
    const r = model.parameters;
    const lines = [
      (f, n, o) => `\\tau=\\frac{\\lambda}{${o()}+\\lambda}=\\frac{${n(r.lambda)}}{${o()}+${n(r.lambda)}}=${n(r.tau)}`,
      (f, n, o) => `\\frac{${o()}}{${o()}+\\lambda}=${o()}-\\tau=${n(r.cut)}`,
      (f, n, o) => `\\phi=${o()}-${f.num(2, formatCount(2))}\\tau=${n(r.informedShare)}`,
    ];
    const inverse = formulaNums(), n = x => inverse.num(x, formatSetting(x)), one = () => inverse.num(1, formatCount(1));
    renderTex(root.querySelector("[data-prx-audience-inverse]"), `\\tau=\\frac{${one()}-\\phi}{${inverse.num(2,formatCount(2))}}=${n(r.tau)},\\quad\\lambda=\\frac{${one()}-\\phi}{${one()}+\\phi}=${n(r.lambda)}`, {nums:inverse.raws});
    lines.forEach((line, i) => {
      const f = formulaNums(); renderTex(cells[i], line(f, x => f.num(x, formatSetting(x)), () => f.num(1, formatCount(1))), { nums: f.raws });
      const m = cells[i].querySelectorAll("mtext"); m[m.length - 1]?.setAttribute("data-prx-readout", ["conv-tau", "conv-cut", "conv-share"][i]);
    });
  } };
}

const pairErrors = pi => ({ ids: ["i", "j"], criteria: ["score"], e: [[[NaN, 1 - pi], [pi, NaN]]] });
export function pairValues(pi, parameters) {
  const E = pairErrors(pi), costs = pairDecision(E.e[0][0][1], E.e[0][1][0], parameters.tau).costs;
  const positive = x => x === 0 ? 0 : x;
  return { pi, payoff: { above: positive(-krwRisk([1, 2], E, { lambda: parameters.lambda })), below: positive(-krwRisk([2, 1], E, { lambda: parameters.lambda })), withhold: positive(-krwRisk([1, 1], E, { lambda: parameters.lambda })) }, cost: { above: costs.iAboveJ, below: costs.jAboveI, withhold: costs.withhold } };
}

export function createPayoffView(ctx, slot, { compact = false } = {}) {
  const { h } = ctx;
  const slots = [h("div", { class: "kb-chart" }), h("div", { class: "kb-chart" })];
  const outcomes = ctx.scrollRegion(h("div", { class: "kb-table", "data-prx-part": "table" }), T.outcomeCaption);
  const root = h("section", { class: "kb-payoff", "aria-label": T.payoffHead }, ctx.panelTitle(T.payoffHead), h("div", { class: "kb-pair" }, ...slots.map(s => h("div", { class: "kb-figure" }, s))), outcomes, h("p", { class: "kb-note" }, ...fill(ctx, T.identityWords)));
  slot.append(root);
  return { root, render(model) {
    const r = model.parameters, C = { height: 230, marginTop: 36, marginRight: 14, marginBottom: 42, marginLeft: 48 };
    ["payoff", "cost"].forEach((kind, index) => {
      const target = slots[index], isPay = kind === "payoff", domain = isPay ? [-1, 1] : [0, 1];
      const values = [0, r.tau, r.cut, 1].map(pi => pairValues(pi, r));
      const lines = name => values.filter((_, i) => i === 0 || i === values.length - 1).map(v => ({ x: v.pi, y: v[kind][name] }));
      const env = isPay ? [{ x: 0, y: values[0].payoff.below }, { x: r.tau, y: 0 }, { x: r.cut, y: 0 }, { x: 1, y: values[3].payoff.above }] : [{ x: 0, y: 0 }, { x: r.tau, y: r.tau }, { x: r.cut, y: r.tau }, { x: 1, y: 0 }];
      const whX = !isPay || r.lambda > .3 ? .02 : .5;
      const stagger = compact && (target.clientWidth || ctx.width()) < 380 && r.lambda <= .10;
      const labels = [{ x: isPay ? .88 : .12, key: "above", text: T.lineIJ }, { x: isPay ? .12 : .88, key: "below", text: T.lineJI }, { x: whX, key: "withhold", text: T.lineWH }].map(d => ({ ...d, y: pairValues(d.x, r)[kind][d.key], anchor: d.x > .5 ? "end" : d.x === .5 ? "middle" : "start", dy: d.key === "withhold" && whX === .5 ? 14 : stagger && d.key === "above" ? -22 : -8 }));
      const cutTex = isPay ? `\\frac{1}{1+\\lambda}=\\text{${formatSetting(r.cut)}}` : `1-\\tau=\\text{${formatSetting(r.cut)}}`;
      const lowTex = isPay ? `\\frac{\\lambda}{1+\\lambda}=\\text{${formatSetting(r.tau)}}` : `\\tau=\\text{${formatSetting(r.tau)}}`;
      plot(target, {
        alt: (isPay ? T.payoffAlt : T.costAlt) + `${T.cutAlt}${formatSetting(r.tau)} and ${formatSetting(r.cut)}.`, ...C,
        x: { domain: [0, 1], ticks: 5, label: T.payoffX, labelAnchor: "center", labelArrow: "none" }, y: { domain, ticks: 5, label: isPay ? T.payoffY : T.costY, labelAnchor: "center", labelArrow: "none" }, color: { type: "identity" },
        marks: (c, P) => [P.areaY(env, { x: "x", y1: domain[0], y2: "y", fill: c.neutral[1], fillOpacity: .85 }), P.ruleY([0], { stroke: c.plotAxis }), P.line(lines("withhold"), { x: "x", y: "y", stroke: c.wh, strokeWidth: 2.25 }), P.line(lines("below"), { x: "x", y: "y", stroke: c.err, strokeWidth: 2.25, strokeDasharray: "7,4" }), P.line(lines("above"), { x: "x", y: "y", stroke: c.err, strokeWidth: 2.25 }), P.ruleX([r.tau, r.cut], { stroke: c.plotFg, strokeDasharray: "4,3" }), ...labels.map(d => P.text([d], { x: "x", y: "y", text: "text", dy: d.dy, textAnchor: d.anchor, fill: c.plotFg, fontWeight: "bold", stroke: c.plotBg, strokeWidth: 3, paintOrder: "stroke" }))],
        formulas: [{ key: "cut", tex: cutTex, num: r.cut, x: r.cut, y: domain[1], dy: -18, anchor: r.cut > .88 ? "end" : "middle" }, ...(r.cut - r.tau >= .45 ? [{ key: "low", tex: lowTex, num: r.tau, x: r.tau, y: domain[1], dy: -18, anchor: r.tau < .12 ? "start" : "middle" }] : [])],
        keyboard: { data: values, x: "pi", y: d => d[kind].withhold, sort: false, label: `${isPay ? "KRW payoff" : "postrank cost"} at the endpoints and cuts`, title: d => `Direction probability ${formatSetting(d.pi)}: state i above j ${formatSetting(d[kind].above)}; state j above i ${formatSetting(d[kind].below)}; withhold ${formatSetting(d[kind].withhold)}.` },
      });
      for (const formula of target.querySelectorAll('[data-prx-formula]')) {
        const value = formula.dataset.prxFormula === "cut" ? r.cut : r.tau;
        formula.removeAttribute("data-num");
        for (const constant of formula.querySelectorAll("mn")) setNum(constant, Number(constant.textContent), constant.textContent);
        const result = [...formula.querySelectorAll("mtext")].at(-1);
        if (result) { setNum(result, value, formatSetting(value)); if (formula.dataset.prxFormula === "cut") result.setAttribute("data-prx-readout", `${kind}-cut`); }
      }
    });
    const correct = pairValues(1, r), wrong = pairValues(0, r), withheld = pairValues(.5, r);
    const row = (label, payoff, cost, key) => h("tr", {}, h("th", { scope: "row", text: label }), h("td", {}, setting(ctx, payoff, `${key}-payoff`)), h("td", { class: "kb-cost" }, setting(ctx, cost, `${key}-cost`)), h("td", { class: "kb-cost" }, setting(ctx, cost, `${key}-map`)));
    outcomes.replaceChildren(h("table", {}, h("caption", { text: T.outcomeCaption }), h("thead", {}, h("tr", {}, ...[T.colOutcome, T.colPayoff, T.colCost, T.colMap].map(text => h("th", { scope: "col" }, ...fill(ctx, text))))), h("tbody", {}, row(T.rowCorrect, correct.payoff.above, correct.cost.above, "correct"), row(T.rowWrong, wrong.payoff.above, wrong.cost.above, "wrong"), row(T.rowWithheld, withheld.payoff.withhold, withheld.cost.withhold, "withheld"))));
  } };
}

export function createIdentityView(ctx, slot, { detailed = false } = {}) {
  const root = ctx.h("section", { class: "kb-box kb-best", "aria-label": detailed ? T.idHead : "Six sites: the same best reports" }); slot.append(root);
  return { root, render(model, context = null) {
    const { parameters: r, postrank: opt, krw } = model, { h } = ctx;
    const verdict = h("p", { class: "kb-line kb-verdict", "data-prx-same": String(model.sameFullSet), text: model.sameFullSet ? T.idSame : T.idDiffer });
    const tied = opt.tieCount > 1 || krw.tieCount > 1;
    const tieNote = tied ? h("p", { class: "kb-note" }, num(ctx, opt.tieCount, formatCount(opt.tieCount), "pr-tie-count"), " postrank reports and ", num(ctx, krw.tieCount, formatCount(krw.tieCount), "krw-tie-count"), " KRW reports share the minimum within postrank tolerance ", num(ctx, opt.tieTol, formatSci(opt.tieTol), "tie-tol"), "; all tied reports are listed.") : null;
    if (!detailed) {
      root.replaceChildren(ctx.panelTitle("Six sites: the same best reports"), h("p", { class: "kb-line kb-blocks", text: opt.grades.map(g => blocksText(g, IDS)).join("; ") }), tagNode(ctx, opt), verdict, ...(tieNote ? [tieNote] : []));
      if (!model.sameFullSet) root.append(h("p", {}, "KRW's best: ", ...gradeList(ctx, krw.grades, "summary-krw")));
      return;
    }
    const pr = h("p", { class: "kb-line" }, ...fill(ctx, T.idPostrank, { tau: () => setting(ctx, r.tau, "id-tau"), label: () => labelNode(ctx, opt), size: () => familySizeNode(ctx, opt), grades: () => gradeList(ctx, opt.grades, "id-pr"), risk: () => num(ctx, opt.risk, formatRisk(opt.risk), "id-risk") }));
    const kr = h("p", { class: "kb-line" }, ...fill(ctx, T.idKrw, { lambda: () => setting(ctx, r.lambda, "id-lambda"), size: () => num(ctx, model.reportsEnumerated, formatCount(model.reportsEnumerated), "id-count"), grades: () => gradeList(ctx, krw.grades, "id-krw"), krw: () => num(ctx, krw.minRisk, formatRisk(krw.minRisk), "id-krwrisk") }));
    const diff = h("p", { class: "kb-note" }, ...fill(ctx, T.idDiff, { diff: () => num(ctx, model.maxAffineResidual, model.maxAffineResidual === 0 ? formatCount(0) : formatSci(model.maxAffineResidual, { sig: 2 }), "id-diff"), tol: () => num(ctx, opt.tieTol, formatSci(opt.tieTol, { trim: true }), "id-tol") }));
    root.replaceChildren(ctx.panelTitle(T.idHead), pr, kr, verdict, diff, ...(tieNote ? [tieNote] : []));
    if (r.lambda === 1) {
      const p = h("p", { class: "kb-line" }, ...fill(ctx, T.condorcet, { lambda: () => setting(ctx, r.lambda, "condorcet-lambda"), grades: () => grade(ctx, opt.grade, "condorcet-grades") }));
      if (context) p.append(...fill(ctx, T.condorcetCard, { lambda: () => setting(ctx, r.lambda), n: () => num(ctx, context.n, formatCount(context.n), "condorcet-n"), G: () => num(ctx, context.G, formatCount(context.G), "condorcet-G"), cap: () => captionNode(ctx, "krw-card"), dr: () => num(ctx, context.DR, formatSig(context.DR, { sig: 3 }), "condorcet-dr"), fixed: () => captionNode(ctx, "fixed-report") }));
      root.append(p);
    }
  } };
}

export function writeBridgeReadout(ctx, model, { grid = null, running = false, blocks = false, residual = false } = {}) {
  const p = model.parameters;
  const same = model.sameFullSet;
  if (blocks) {
    const grades = same ? model.postrank.grades : [...model.postrank.grades, ...model.krw.grades];
    const one = () => num(ctx, 1, formatCount(1));
    ctx.readout.set([
      "λ ", setting(ctx, p.lambda, "lambda"), " ↔ τ ", setting(ctx, p.tau, "tau"), " · For one pair, state a direction above ",
      setting(ctx, p.cut, "cut"), " = ", one(), " − τ = ", one(), "/(", one(), " + λ). ",
      ctx.h("strong", { text: same ? "Both rules choose: " : "The best-report sets differ: " }),
      grades.map(g => blocksText(g, IDS)).join(" and "), " among ", num(ctx, model.reportsEnumerated, formatCount(model.reportsEnumerated)), " six-site reports. ",
      "KRW's informed share φ = ", setting(ctx, p.informedShare, "readout-informed-share"), ".",
      ctx.h("span", { class: "prx-sr-only", "aria-hidden": "true" }, ...gradeList(ctx, grades, "best")),
    ]);
    return;
  }
  ctx.readout.set([...fill(ctx, T.readout, { lambda: () => setting(ctx, p.lambda, "lambda"), tau: () => setting(ctx, p.tau, "tau"), cut: () => setting(ctx, p.cut, "cut") }), ...fill(ctx, same ? T.readSame : T.readDiffer, { grades: () => gradeList(ctx, same ? model.postrank.grades : [...model.postrank.grades, ...model.krw.grades], "best") }), ...(grid ? fill(ctx, T.readGrid, { same: () => num(ctx, grid.same, formatCount(grid.same), "ro-grid-same"), count: () => num(ctx, grid.count, formatCount(grid.count), "ro-grid-count") }) : running ? [T.readGridBusy] : []), ...(grid && residual ? [' Largest numerical residual ', num(ctx, grid.diff, formatSci(grid.diff, { sig: 2 }), 'ro-grid-diff'), '.'] : [])]);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, { name: "lambda-tau", className: "prx-kbridge", css: BRIDGE_CSS, layout: "result-first", keys: bridgeKeys(), build(ctx) {
    const controls = createAxisControls(ctx), converterSlot = ctx.h("div"), payoffSlot = ctx.h("div"), summarySlot = ctx.h("div");
    ctx.primaryControl(controls.lambda.input);
    ctx.afterPresets(controls.lambda.root, controls.tau.root);
    ctx.charts.append(payoffSlot, converterSlot, summarySlot);
    const converter = createConverterView(ctx, converterSlot), payoff = createPayoffView(ctx, payoffSlot, { compact: true }), summary = createIdentityView(ctx, summarySlot);
    ctx.primaryGraphic(payoff.root.querySelector(".kb-pair"));
    ctx.caption.replaceChildren("Six fictional sites: ", captionNode(ctx, "teaching-posterior"), ".");
    return { render(state) { ctx.root.setAttribute("aria-busy", "true"); try { const model = identityAt(state); controls.render(model); converter.render(model); payoff.render(model); summary.render(model); writeBridgeReadout(ctx, model, { blocks: true }); } finally { ctx.root.removeAttribute("aria-busy"); } } };
  } });
}
