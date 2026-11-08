// frontier-mixtures (app 2.11): "Mixtures between frontier corners". At a mean number of stated pairs m, H(m) is reached
// by a lottery between the two whole reports at the vertices around m; the app sets it beside the best single report that
// states exactly m pairs, with family and fixed-order endpoint examples. The app uses the shared result-first frame
// (base.js layout "result-first"; review 044 repair: X-01, G3-F1, X-14 with owner decision D-1, X-23), top to bottom:
//   controls   the m slider (the primary control), then the preset row
//   read-out   the lottery in words (the review's copy): its expected wrong directions, the two reports and their
//              chances, that each draw is a printable report and the average is not, and the gap to the best single
//              report; at a vertex, that the vertex report itself reaches H(m)
//   stage      on wide screens (62em) two columns, the lottery strip and the choices on the left and the chart on the
//              right; on narrow screens lottery, chart, choices (the DOM order, so phones read control, result, chart):
//     lottery  the two whole reports as chips (grade vector and N), each with a bar of its chance, and the average
//              point the diamond marks (at a vertex: the vertex report itself, chance 1)
//     chart    the shared cloud renderer framed on the mixture: the near view's top is 1.25 × the largest E among the
//              vertices around m and the columns between them, rounded up (about 0–.20 for m = 8 to 12), the mixture's
//              own edge of H(m) heavier, the diamond, the square, a bracket labeled with the gap, the τ line and its
//              ring in muted ink (the touched report's vector then sits in the legend); the full-height view is v1's.
//              Under it the legend, one note on fixed τ, the vector positions, and a closed Settings box: τ with its
//              optimum sentence and label line, and View
//     choices  Example and Family, with the endpoint status of the family as a pill, so the capped family's "not
//              guaranteed for this family" is visible without opening anything (G3-F1, G3-F2)
//   boxes      owner decision D-1 (2026-11-07): "Data: vertices of H(m)" (the vertex table) and "Endpoint at τ = 1/2
//              and a fixed order" (the four sections: mixing two complete reports, the end at τ = 1/2, a fixed order
//              with its figure, how the criterion errors are combined), closed, their content unchanged
// The chart answers the mouse and touch as its keyboard reader does (chart.js keyboard.pointer; X-23).
import { createWidget, uid, appLink, roundTo } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatGrades, formatProb, formatRational, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import { matchedDisclosure, supportingVertex, fixedOrderDP, finiteLawPairwise } from "../pr-core.js";
import { CONFIG as FRONTIER, CSS, modelOf, optimumOf, tb19Model, createCloudRenderer } from "./frontier.js";

export const CONFIG = Object.freeze({ ...FRONTIER, name: "frontier-mixtures",
  title: "A mixture at a mean number of stated pairs",
  label: "Mixtures between frontier corners: matched disclosure, whole reports and the gap to a single report",
  // review 044 repair (G3-F1): the near view framed on the mixture: 1.25 × the largest E around m, rounded up to a
  // twentieth (to a tenth above one half), never above v1's near-view top; the frame's foot is inset by 10% of the plot's height, so marks at E = 0 sit off the axis
  frame: Object.freeze({ head: 1.25, step: 0.05, coarseStep: 0.1, coarseFrom: 0.5, digits: 2, insetBottom: 0.1 }),
  fm: Object.freeze({
    lotteryTitle: "Lottery between two whole reports",
    vertexTitle: "The vertex report itself",
    lotteryLabel: "The lottery: the two whole reports, their chances and the average point",
    chance: "chance",
    averageMix: "Average point: N = ",
    averageVertex: "Its point, on the vertex: N = ",
    fixedTau: "At any fixed τ a printable vertex report is already best; a lottery matters only when the average number of stated pairs is fixed between vertices.",
    settings: "Settings",
    dataBox: "Data: vertices of H(m)",
    endpointBox: Object.freeze(["Endpoint at τ = ", " and a fixed order"]),
    pillYes: ": guaranteed (all reports, no latent ties)",
    pillNo: ": not guaranteed for this family",
    touching: ", touching ",
    above: " above this view",
  }),
});
const EX = { tb16: { weights: Array.from(CONFIG.tb16.w) } };
const effectiveFamily = (state) => state.example === "tb16" ? "all" : state.family;
const niceTop = (v) => Math.ceil(v * CONFIG.yRound) / CONFIG.yRound;
const ORDER_E = finiteLawPairwise(CONFIG.tb19.states.map(s => s.map(x => Array.from(x))), Array.from(CONFIG.tb19.probs), {ids: Array.from(CONFIG.tb19.ids)});
const ORDER_OPT = fixedOrderDP(ORDER_E, { order: Array.from(CONFIG.tb19.order), tau: CONFIG.half });

/** The top of the near view framed on the mixture (review 044, G3-F1): 1.25 × the largest E among the vertices around m
 *  (the two a lottery mixes, or a vertex's two neighbors), H(m) and the smallest E of every column between them,
 *  rounded up, never above v1's near-view top. */
export function mixtureFrame(model, mix) {
  if (!mix) return null;
  const F = CONFIG.frame;
  const hull = model.hull;
  let lo = mix.lower;
  let hi = mix.upper;
  if (!(mix.psi > 0)) {
    const q = hull.findIndex((v) => v.N === mix.N);
    lo = hull[Math.max(0, q - 1)];
    hi = hull[Math.min(hull.length - 1, q + 1)];
  }
  const between = model.cloud.byN.filter((r) => r.N > lo.N && r.N < hi.N).map((r) => r.minEw);
  const top = F.head * Math.max(lo.Ew, hi.Ew, mix.H, ...between);
  if (!(top > 0)) return null;
  const step = top > F.coarseFrom ? F.coarseStep : F.step;
  return Math.min(model.yNear, roundTo(Math.ceil(roundTo(top / step, 9)) * step, F.digits));
}

const FM_CSS = `
.prx-fm .prx-app-link { color: var(--prx-link); }
.prx-fm .prx-app-link:hover, .prx-fm .prx-app-link:focus { color: var(--prx-link-hover); }
.prx-fm .prx-fr-vector-key { margin: .35rem 0 0; }
.prx-fm .prx-fr-label { margin: .3rem 0 .35rem; }
.prx-fm .prx-fr-optimum { margin: .25rem 0; font-size: .9em; color: var(--prx-fg-muted); }
/* the stage: one column on narrow screens (lottery, chart, choices); two on wide ones, the chart on the right */
.prx-fm .prx-fm-stage { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 1.2rem; align-items: start; min-width: 0; }
.prx-fm .prx-fm-stage > * { min-width: 0; }
@media (min-width: 62em) {
  .prx-fm .prx-fm-stage { grid-template-columns: minmax(15rem, 2fr) minmax(0, 3fr); grid-template-rows: auto 1fr; grid-template-areas: "lottery chart" "choices chart"; }
  .prx-fm .prx-fm-lottery { grid-area: lottery; }
  .prx-fm .prx-fm-chartpanel { grid-area: chart; }
  .prx-fm .prx-fm-choices { grid-area: choices; }
}
.prx-fm .prx-fm-chartpanel > .prx-fr-head { margin-top: 0; }
/* the lottery strip, on the plot's paper like the chart */
.prx-fm .prx-fm-lottery { padding: 0.45rem 0.65rem 0.5rem; border-radius: 6px; font-variant-numeric: tabular-nums; }
.prx-fm .prx-fm-lot-title { margin: 0 0 0.35rem; font-weight: 600; }
.prx-fm .prx-fm-lot-rows { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.prx-fm .prx-fm-lot-row { display: grid; grid-template-columns: 9.6rem minmax(2.5rem, 1fr) 2.6rem; gap: 0.6rem; align-items: center; margin: 0; }
.prx-fm .prx-fm-chip { justify-self: start; padding: 0.05rem 0.5rem; white-space: nowrap; border: 1px solid var(--prx-border-strong); border-radius: 999px; }
.prx-fm .prx-fm-track { display: block; height: 0.85rem; overflow: hidden; background: var(--prx-plot-bg); border: 1px solid var(--prx-cell-border); border-radius: 3px; }
.prx-fm .prx-fm-fill { display: block; height: 100%; background: var(--prx-grade-5); }
.prx-fm .prx-fm-share { text-align: right; font-weight: 600; }
.prx-fm .prx-fm-lot-avg { margin: 0.4rem 0 0; }
.prx-fm .prx-fm-diamond { display: inline-block; width: 0.6em; height: 0.6em; margin: 0 0.5em 0 0.2em; vertical-align: 0.05em; border: 2px solid var(--prx-plot-fg); background: var(--prx-plot-bg); transform: rotate(45deg); }
/* Example and Family, with the endpoint status of the family */
.prx-fm .prx-fm-choices { display: grid; gap: 0.5rem; font-size: 0.875rem; }
.prx-fm .prx-fm-choices .prx-fr-family > .prx-hint { margin: 0; }
.prx-fm .prx-fm-pill { justify-self: start; margin: 0; padding: 0.15rem 0.6rem; font-weight: 600; border: 1px solid var(--prx-border-strong); border-radius: 999px; background: var(--prx-bg); }
.prx-fm .prx-fm-pill[data-prx-endpoint="not-guaranteed"] { border-style: dashed; }
/* the boxes hold v1's sections unchanged; the box gives the frame */
.prx-fm .prx-disclosure .prx-fr-deeper { margin: 0; padding: 0; border: 0; background: transparent; }
.prx-fm .prx-disclosure .prx-fr-vertices { margin: 0.2rem 0 0; }
.prx-fm .prx-fm-chartpanel > .prx-disclosure { margin-top: 0.6rem; }
.prx-fm .prx-fm-chartpanel > .prx-disclosure .prx-disclosure-body > * + * { margin-top: 0.4rem; }
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fr prx-fm",
    css: `${CSS}${FM_CSS}`,
    // the shared result-first frame (review 044, X-01): the m slider and the preset row, the read-out, the stage
    layout: "result-first",
    keys: {
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
      example: { type: "choice", values: CONFIG.examples.slice(), value: CONFIG.example },
      view: { type: "choice", values: CONFIG.views.slice(), value: CONFIG.view },
      m: { type: "integer", min: CONFIG.m.min, max: CONFIG.m.max, value: CONFIG.m.value },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;
      const TF = CONFIG.fm;

      // helpers: a read-out number with its hook; nodes for a grade vector
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      let reportIds = modelOf("six", "all").E.ids;
      const gradeNum = (name, g) => h("span", { class: "prx-fr-report" }, ro(name, Array.from(g), formatGrades(Array.from(g))),
        h("span", { class: "prx-fr-decoded" }, ` = ${blocksText(g, reportIds.slice(0, g.length))}`));
      const famNode = (fam) => { const node = familyNameNode(ctx, { family: fam }); node.classList.add("prx-fr-sym"); return node; };
      const half = () => ctx.num(CONFIG.half, formatRational(CONFIG.half));
      const point = (model, v, prefix) => ["(", ro(`${prefix}N`, v.N, formatCount(v.N)), ", ", ro(`${prefix}E`, v.Ew, model.fmt.E(v.Ew)), ")"];

      // --- settings: τ, the family, the view (τ and View go into the Settings box under the chart)
      const tau = ctx.slider({
        label: T.slider, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderHint, onInput: (v) => ctx.set({ tau: v }),
      });
      // the family labels name the current example's families (the four-unit example offers all reports only)
      const famLabel = (f, example = "six") => {
        const words = f === "all" ? [T.familyAll] : ["at most ", ctx.num(CONFIG.cap, formatCount(CONFIG.cap)), " grades"];
        if (example === "tb16" && f !== "all") return [...words, ` ${T.notUsed}`];
        const fam = modelOf(example, f).cloud.family;
        return [famNode(fam), " · ", ctx.num(fam.size, formatCount(fam.size)), ` ${T.reports} (`, ...words, ")"];
      };
      let labelledFor = "six";
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend, name: "family", className: "prx-fr-family",
        options: CONFIG.families.map((f) => ({ value: f, label: famLabel(f) })),
        value: ctx.state.family, onChange: (v) => ctx.set({ family: v }),
      });
      const familyFixed = h("p", { class: "prx-hint", hidden: true, text: T.familyFixed });
      familySwitch.root.append(familyFixed);
      const viewSwitch = ctx.radioGroup({
        legend: T.viewLegend, name: "view", className: "prx-fr-view",
        options: [{ value: "near", label: T.viewNear }, { value: "all", label: T.viewAll }],
        value: ctx.state.view, onChange: (v) => ctx.set({ view: v }),
      });

      // --- the τ optimum and the label with the family and its size (in the Settings box, beside τ)
      const labelLine = h("p", { class: "prx-fr-label", "data-prx-part": "readout" });
      const vectorKey = h("p", { class: "prx-fr-vector-key", "data-prx-part": "notes" });
      const optimumLine = ctx.part("readout", h("p", { class: "prx-fr-optimum" }));

      // --- the figure: its head, the chart, the legend, a note on fixed τ and the vector positions
      const head = h("p", { class: "prx-fr-head" });
      const chartSlot = ctx.primaryGraphic(h("div", { class: "prx-fr-chart" }));
      const legend = h("div", { class: "prx-fr-legend", "data-prx-part": "legend" });
      const fixedNote = h("p", { class: "prx-fr-note", "data-prx-part": "notes", text: TF.fixedTau });
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexHeadingId = uid("prx-fr-vertices");
      const drawChart = createCloudRenderer(ctx, chartSlot, {
        pointer: true, frame: (state, model, mix) => mixtureFrame(model, mix), gapBracket: true, insetBottom: CONFIG.frame.insetBottom,
      });

      // --- the mixture and endpoint panels (owner decision D-1: unchanged, in a closed box)
      const mixBody = h("div", { class: "prx-fr-mix-out", "data-prx-part": "readout" });
      const mSliders = new Map();
      const mSlot = h("div", { class: "prx-fr-mslot", "data-prx-part": "controls" });
      const mSliderFor = (max) => {
        if (!mSliders.has(max)) {
          mSliders.set(max, ctx.slider({
            label: T.mSlider, min: CONFIG.m.min, max, step: 1, value: Math.min(ctx.state.m, max), name: "m",
            format: (v) => formatCount(v), onInput: (v) => ctx.set({ m: v }),
          }));
        }
        return mSliders.get(max);
      };
      const halfBody = h("div", { class: "prx-fr-half", "data-prx-part": "readout" });
      const orderBody = h("div", { class: "prx-fr-order", "data-prx-part": "readout" });
      const miniSlot = h("div", { class: "prx-fr-mini" });
      const exampleSwitch = ctx.radioGroup({
        legend: T.exampleLegend, name: "example", className: "prx-fr-example",
        options: [{ value: "six", label: T.exampleSix }, { value: "tb16", label: T.exampleTb16 }],
        value: ctx.state.example, onChange: (v) => ctx.set({ example: v }),
      });
      exampleSwitch.root.setAttribute("data-prx-part", "controls");
      const ebarLine = h("p", { class: "prx-fr-note" });
      const section = (title, ...children) => h("section", { class: "prx-fr-section" }, h("h4", { class: "prx-fr-heading" }, ...[].concat(title)), ...children);
      const mixIntro = h("p", { class: "prx-fr-note", text: "A point between two corners can be reached by choosing one of two complete reports at random: the one that states more pairs with some chance, the other otherwise. Each draw prints a whole report; the average point lies on the dashed segment." });
      const criterionSection = section("How the criterion errors are combined", ebarLine);
      const details = ctx.part("notes", h("section", { class: "prx-fr-deeper", "aria-label": "Mixtures and the half-cost endpoint" },
        section(T.mixHeading, mixIntro, mixBody),
        section(["The end at τ = ", half()], halfBody, h("h5", { class: "prx-fr-subheading", text: T.orderHeading }), orderBody, miniSlot),
        criterionSection));

      // --- the lottery strip, the choices with the endpoint pill, and the stage that holds them with the chart
      const lotteryTitle = h("p", { class: "prx-fm-lot-title" });
      const lotteryRows = h("ul", { class: "prx-fm-lot-rows" });
      const lotteryAverage = h("p", { class: "prx-fm-lot-avg" });
      const lottery = h("section", { class: "prx-fm-lottery prx-light-panel", "aria-label": TF.lotteryLabel }, lotteryTitle, lotteryRows, lotteryAverage);
      const pill = h("p", { class: "prx-fm-pill" });
      const choices = h("div", { class: "prx-fm-choices" }, exampleSwitch.root, familySwitch.root, pill);
      const chartPanel = h("div", { class: "prx-fm-chartpanel" }, head, chartSlot, legend, fixedNote, vectorKey);
      ctx.controls.append(mSlot);
      ctx.primaryControl(mSlot);
      ctx.charts.append(h("div", { class: "prx-fm-stage" }, lottery, chartPanel, choices));
      // Settings under the chart (τ, its optimum and label, View); the two D-1 boxes at the end
      const settings = ctx.disclosure({ name: "settings", title: TF.settings, placement: { after: vectorKey } });
      settings.body.append(tau.root, optimumLine, labelLine, viewSwitch.root);
      const dataBox = ctx.disclosure({ name: "data", title: TF.dataBox });
      dataBox.body.append(vertexBox);
      // its summary writes ½ as a number with data-num, as the sections inside it do
      const endpointBox = ctx.disclosure({ name: "endpoint", title: [TF.endpointBox[0], half(), TF.endpointBox[1]] });
      endpointBox.body.append(details);

      // --------------------------------------------------------------------------------------- drawing

      function drawHead(state, model) {
        const fam = model.cloud.family;
        const pre = state.example === "tb16"
          ? [`${T.headTb16} (`, ...model.ex.weights.flatMap((w, k) => [k ? ", " : "", ctx.num(w, formatRational(w))]), "): "]
          : [`${T.headSix} `];
        head.replaceChildren(...pre, `${T.headIn} `, ro("familySize", fam.size, formatCount(fam.size)), ` ${T.headInEnd} `,
          famNode(fam), ".");
      }

      // framed (the near view on the mixture): the touched report's vector sits in the line's entry, not on the chart
      function drawLegend(state, model, mix, show, sv, framed) {
        const key = (cls, ...text) => h("span", { class: "prx-fr-key" }, h("span", { class: `prx-fr-swatch ${cls}` }), h("span", {}, ...text));
        const items = [
          key("prx-fr-sw-dash", T.legendReport),
          key("prx-fr-sw-min", T.legendMin.replace("⟨E⟩", model.wrong)),
        ];
        const yTop = state.view === "all" ? model.yAll : (mixtureFrame(model, mix) ?? model.yNear);
        if (model.cloud.byN.some((r) => r.maxEw > yTop)) items.push(key("prx-fr-sw-above", T.legendAbove));
        if (show) {
          // the line's words keep their own span (so its τ keeps its context); a framed view adds the touched report
          const v = sv.vertices[0];
          const line = key("prx-fr-sw-line", h("span", {}, `${T.legendLine} `, ctx.num(state.tau, formatSetting(state.tau))),
            framed ? h("span", {}, TF.touching, ctx.num(Array.from(v.grade), formatGrades(Array.from(v.grade))), v.Ew > yTop ? TF.above : "") : null);
          items.push(
            key("prx-fr-sw-vertex", T.legendVertex),
            key("prx-fr-sw-hull", `${T.legendHull} `, captionNode(ctx, "mixture-not-report")),
            line,
            key("prx-fr-sw-ring", T.legendRing),
          );
          if (mix) {
            items.push(key("prx-fr-sw-mix", `${T.legendMix} `, ctx.num(mix.N, formatCount(mix.N))));
            if (mix.best) items.push(key("prx-fr-sw-best", T.legendBest));
          }
        }
        legend.replaceChildren(...items);
      }

      function drawHeadline(state, model, opt, sv) {
        const fmt = model.fmt;
        const fam = opt.family;
        const tauNode = ctx.num(state.tau, formatSetting(state.tau));
        const sym = famNode(fam);
        if (sv.vertices.length > 1) {
          const a = sv.vertices[0];
          const b = sv.vertices.at(-1);
          optimumLine.replaceChildren("τ = ", tauNode, " in ", sym, ": the line of slope τ lies along the edge from ", ...point(model, a, "edgeA"), " to ",
            ...point(model, b, "edgeB"), "; the reports at both ends, ",
            ...opt.grades.flatMap((g, k) => [k ? " and " : "", gradeNum(`tiedGrade${k}`, g)]),
            `, share the smallest ${T.riskWords}, `, ro("risk", opt.risk, fmt.risk(opt.risk)), ".");
        } else {
          const v = sv.vertex;
          optimumLine.replaceChildren("τ = ", tauNode, " in ", sym, ": the line of slope τ touches H(m) at the vertex N = ", ro("N", v.N, formatCount(v.N)),
            ", E = ", ro("E", v.Ew, fmt.E(v.Ew)), ", the report ", gradeNum("grades", v.grade), `, with ${T.riskWords} `,
            ro("risk", opt.risk, fmt.risk(opt.risk)), ".");
        }
        const parts = [labelNode(ctx, opt), " (", familySizeNode(ctx, opt), ` ${T.reports}, every one evaluated). ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })), ` ${T.toleranceGloss}`];
        labelLine.replaceChildren(...parts);
      }

      function drawVertices(state, model, sv) {
        const fmt = model.fmt;
        const hull = model.hull;
        const touched = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = hull.map((v, q2) => {
          const s = model.slopes[q2];
          const mark = touched.has(v.N) ? h("span", { class: "prx-fr-touched" }, `${T.touchedMark} at τ = `, ctx.num(state.tau, formatSetting(state.tau))) : "";
          return h("tr", { class: touched.has(v.N) ? "prx-fr-row-touched" : "" },
            h("th", { scope: "row" }, ro(`vN-${q2}`, v.N, formatCount(v.N))),
            h("td", {}, ro(`vE-${q2}`, v.Ew, fmt.E(v.Ew))),
            h("td", {}, gradeNum(`vGrade-${q2}`, v.grade), " ", mark),
            h("td", {}, s === undefined ? T.noNext : ro(`slope-${q2 + 1}`, s, fmt.slope(s))));
        });
        vertexBox.replaceChildren(
          h("h4", { class: "prx-fr-heading", id: vertexHeadingId, text: T.vertexHeading }),
          h("div", { class: "prx-fr-table-wrap" }, h("table", { class: "prx-fr-table", "aria-labelledby": vertexHeadingId },
            h("thead", {}, h("tr", {}, th("N"), th("E"), th("Report"), th("Slope of the next edge"))),
            h("tbody", {}, ...rows))),
          h("p", { class: "prx-fr-note", text: T.vertexNote.replace("⟨E⟩", model.wrong) }));
        ctx.scrollRegion(vertexBox.querySelector(".prx-fr-table-wrap"), T.vertexHeading);
      }

      function drawMix(state, model, mix) {
        const fmt = model.fmt;
        const fam = model.cloud.family;
        const m = mix.N;
        const mNode = () => ctx.num(m, formatCount(m));
        const lines = [];
        lines.push(h("p", {}, "H(", mNode(), ") = ", ro("H", mix.H, fmt.E(mix.H)), ` ${model.wrong}.`));
        if (mix.psi === 0) {
          lines.push(h("p", {}, "m = ", mNode(), " is a vertex: the report ", gradeNum("vertexGrade", mix.lower.grade),
            " itself reaches H(", mNode(), "); no mixture is needed."));
        } else {
          lines.push(h("p", {}, "To reach it, print ", gradeNum("upperGrade", mix.upper.grade), " (N = ", ro("upperN", mix.upper.N, formatCount(mix.upper.N)),
            ") with chance ", ro("psi", mix.psi, fmt.psi(mix.psi)), " and ", gradeNum("lowerGrade", mix.lower.grade), " (N = ",
            ro("lowerN", mix.lower.N, formatCount(mix.lower.N)), ") otherwise. Each draw is a report we can print; their average point is ",
            captionNode(ctx, "mixture-not-report"), "."));
          if (mix.best) {
            lines.push(h("p", {}, "The best single report that states exactly ", mNode(), " pairs is ", gradeNum("bestGrade", mix.best.grade),
              ", with E = ", ro("bestE", mix.best.Ew, fmt.E(mix.best.Ew)), ", which is ", ro("gap", mix.gap, fmt.E(mix.gap)), " above H(", mNode(), ")."));
          } else {
            lines.push(h("p", {}, "No report in ", famNode(fam), " states exactly ", mNode(), " pairs."));
          }
        }
        mixBody.replaceChildren(...lines);
      }

      // the lottery as a picture: the two whole reports (chips), their chances (bars) and the average point
      function drawLottery(model, mix) {
        const fmt = model.fmt;
        const n = (name, v) => ro(name, v, formatCount(v));
        // the chart's diamond, as a swatch before the average point it marks
        const diamond = () => h("span", { class: "prx-fm-diamond", "aria-hidden": "true" });
        const row = (grade, N, chance, prefix) => h("li", { class: "prx-fm-lot-row" },
          h("span", { class: "prx-fm-chip" }, ro(`lottery-${prefix}Grade`, Array.from(grade), formatGrades(Array.from(grade))), " · N ", n(`lottery-${prefix}N`, N)),
          h("span", { class: "prx-fm-track", "aria-hidden": "true" }, h("span", { class: "prx-fm-fill", style: { width: `${100 * chance}%` } })),
          h("span", { class: "prx-fm-share" }, ro(`lottery-${prefix}Chance`, chance, fmt.psi(chance))));
        if (mix.psi === 0) {
          lotteryTitle.textContent = TF.vertexTitle;
          lotteryRows.replaceChildren(row(mix.lower.grade, mix.lower.N, 1, "vertex"));
          lotteryAverage.replaceChildren(diamond(), TF.averageVertex, ro("lottery-m", mix.N, formatCount(mix.N)), ", E = ", ro("lottery-H", mix.H, fmt.E(mix.H)));
        } else {
          lotteryTitle.textContent = TF.lotteryTitle;
          lotteryRows.replaceChildren(row(mix.lower.grade, mix.lower.N, 1 - mix.psi, "lower"), row(mix.upper.grade, mix.upper.N, mix.psi, "upper"));
          lotteryAverage.replaceChildren(diamond(), TF.averageMix, ro("lottery-m", mix.N, formatCount(mix.N)), ", E = ", ro("lottery-H", mix.H, fmt.E(mix.H)));
        }
      }

      // the endpoint status of the family, beside the family (G3-F1, G3-F2: the capped family's status stays visible)
      function drawPill(model) {
        const lastV = model.hull.at(-1);
        if (model.eligible) {
          pill.setAttribute("data-prx-endpoint", "guaranteed");
          pill.replaceChildren("Endpoint at τ = ", half(), TF.pillYes);
        } else {
          pill.setAttribute("data-prx-endpoint", "not-guaranteed");
          pill.replaceChildren("Endpoint at τ = ", half(), TF.pillNo, " (H(m) ends at N = ", ctx.num(lastV.N, formatCount(lastV.N)), " of ",
            ctx.num(model.M, formatCount(model.M)), ")");
        }
      }

      // the review's read-out copy (G3-F1): the lottery, that each draw is printable and the average is not, the gap
      function writeMixtureSummary(model, mix, state, sv) {
        const n = (v) => ctx.num(v, formatCount(v));
        const e = (v) => ctx.num(v, model.fmt.E(v));
        const psi = (v) => ctx.num(v, model.fmt.psi(v));
        const support = [" At τ ", ctx.num(state.tau, formatSetting(state.tau)),
          sv.vertices.length === 1 ? ", the supporting vertex states " : ", the supporting edge runs from ",
          n(sv.vertices[0].N), ...(sv.vertices.length === 1 ? [] : [" to ", n(sv.vertices.at(-1).N)]),
          " pairs."];
        if (mix.psi === 0) {
          const g = Array.from(mix.lower.grade);
          ctx.readout.set(["At ", n(mix.N), " stated pairs the vertex report ", ctx.num(g, formatGrades(g)), " itself reaches ", e(mix.H), ` ${model.wrong}: no mixture is needed.`, ...support]);
          return;
        }
        const parts = ["At an average of ", n(mix.N), " stated pairs, a lottery between two whole reports reaches ", e(mix.H), ` ${model.wrong}: the `,
          n(mix.upper.N), "-pair report with chance ", psi(mix.psi), ", otherwise the ", n(mix.lower.N), "-pair report. Each draw is a printable report; the average is not. "];
        if (mix.best) parts.push("The best single report with exactly ", n(mix.N), " pairs has ", e(mix.best.Ew), ", ", e(mix.gap), " higher.");
        else parts.push("No single report states exactly ", n(mix.N), " pairs.");
        ctx.readout.set([...parts, ...support]);
      }

      function drawHalf(state, model) {
        const fmt = model.fmt;
        const fam = model.cloud.family;
        const sym = () => famNode(fam);
        if (model.eligible) {
          const last = model.slopes.at(-1);
          const end = supportingVertex(model.hull, CONFIG.half).vertex;
          const strict = end.N === model.M;
          halfBody.replaceChildren(h("p", {},
            "In ", sym(), ", with no latent equality in this posterior (each pair's two error probabilities add to one), every edge of H(m) has a slope between ", ctx.num(0, formatCount(0)), " and ", half(), ". ",
            "Here the steepest is the last, ", ro("lastSlope", last, fmt.slope(last)), ", so a line of slope ", half(), " touches the last vertex, ",
            gradeNum("endGrade", end.grade), ", which states ", ro("endN", end.N, formatCount(end.N)), strict ? " pairs, all of them: a strict order." : " pairs."));
        } else {
          const lastV = model.hull.at(-1);
          halfBody.replaceChildren(
            h("p", { class: "prx-fr-badge" }, "Endpoint at τ = ", half(), ": not guaranteed for this family"),
            h("p", {}, "With ", sym(), " the boundary ends at N = ", ro("capEndN", lastV.N, formatCount(lastV.N)), ", short of the ",
              ctx.num(model.M, formatCount(model.M)), " pairs a strict order states. The argument for the end at τ = ", half(), " refines every grade into a strict order, and this family does not allow that."));
        }
        // the theory book's ch. 19 law within its posterior-mean order
        const o = tb19Model();
        const [v0, v1, v2] = o.hull;
        const lastO = o.slopes.at(-1);
        const law = CONFIG.tb19;
        const stateWords = (s) => s.map((row, i) => [i ? ", " : "", ctx.num(row[0], formatCount(row[0]))]).flat();
        orderBody.replaceChildren(h("p", {},
          "The three-unit law of the page ", appLink(ctx, "which-ranking"), " (with probability ", ctx.num(law.probs[0], formatProb(law.probs[0], { digits: 1 })), " the true values of A, B and C are ",
          ...stateWords(law.states[0]), "; with probability ", ctx.num(law.probs[1], formatProb(law.probs[1], { digits: 1 })), " they are ", ...stateWords(law.states[1]),
          "). Keep its posterior-mean order A, B, C and allow only reports that cut that order into grades: the boundary has vertices (",
          ro("orderV0N", v0.N, formatCount(v0.N)), ", ", ro("orderV0E", v0.Ew, formatRational(v0.Ew)), "), (", ro("orderV1N", v1.N, formatCount(v1.N)), ", ",
          ro("orderV1E", v1.Ew, formatRational(v1.Ew)), ") and (", ro("orderV2N", v2.N, formatCount(v2.N)), ", ", ro("orderV2E", v2.Ew, formatRational(v2.Ew)),
          "). Its last edge has slope ", ro("orderLastSlope", lastO, formatRational(lastO)), ", steeper than ", half(), ", so a line of slope ", half(), " touches it at the report ",
          gradeNum("orderTouchGrade", o.sv.vertex.grade), ", not at the full order. A slope of at least ", ro("orderLastSlope2", lastO, formatRational(lastO)),
          " can touch the full order: at that slope the last two vertices touch together; above it the full order is the sole touched vertex. Such slopes lie outside the allowed range τ ≤ ", half(), ". For reports that keep one fixed order, the endpoint at τ = ", half(), " is not guaranteed for this family."),
          h("p", { class: "prx-fr-note" }, "In the small figure: dashed, the boundary within the order; dotted, a line of slope ", half(), " from (",
            ctx.num(v1.N, formatCount(v1.N)), ", ", ctx.num(v1.Ew, formatRational(v1.Ew)), ")."));
        drawMini(o);
        // the four-unit example's weighted pair error, in words
        orderBody.prepend(h("p", {}, labelNode(ctx, ORDER_OPT, { key: "order" }), " (not H(m)); ", familySizeNode(ctx, ORDER_OPT), " reports along the posterior-mean order."));
        const w = EX.tb16.weights;
        ebarLine.replaceChildren(`${T.ebarLine} `, ctx.num(w[0], formatRational(w[0])), " and ", ctx.num(w[1], formatRational(w[1])), T.ebarEnd, " ", appLink(ctx, "two-scores", {title: "One grade for two scores"}), T.ebarTail, " ", T.exampleNow);
        criterionSection.hidden = state.example !== "tb16";
      }

      function drawMini(o) {
        const Mi = CONFIG.mini;
        const width = Math.min(Mi.width, Math.max(1, Math.round(miniSlot.clientWidth || ctx.width())));
        const hull = o.hull;
        const last = hull.at(-1);
        const prev = hull.at(-2);
        const ref = [{ N: prev.N, y: prev.Ew }, { N: last.N, y: prev.Ew + CONFIG.half * (last.N - prev.N) }];
        const yTop = niceTop(last.Ew * Mi.yHead);
        plot(miniSlot, {
          alt: T.miniAlt,
          table: {
            caption: T.miniTable,
            columns: [
              { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
              { label: "Expected wrong directions, E", value: "Ew", format: (v) => formatRational(v) },
              { label: "Report", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v) },
            ],
            rows: hull,
          },
          keyboard: { data: hull, x: "N", y: "Ew", label: "The fixed-order frontier vertices", title: v => `${formatCount(v.N)} stated pairs, ${formatRational(v.Ew)} expected wrong directions, report ${formatGrades(v.grade)}` },
          width, height: Mi.height, aspect: false,
          marginTop: Mi.marginTop, marginRight: Mi.marginRight, marginBottom: Mi.marginBottom, marginLeft: Mi.marginLeft,
          x: { domain: [-Mi.pad, o.M + Mi.pad], ticks: hull.map((v) => v.N), tickFormat: (d) => formatCount(d), label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, yTop], label: "E", labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => [
            P.line(ref, { x: "N", y: "y", stroke: c.plotMuted, strokeDasharray: Mi.ref }),
            P.line(hull, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2, strokeDasharray: Mi.hullDash }),
            P.dot(hull, { x: "N", y: "Ew", r: Mi.dot, fill: c.plotFg, stroke: c.plotBg }),
            numText([{ N: (prev.N + last.N) / 2, y: (prev.Ew + last.Ew) / 2, s: o.slopes.at(-1) }], { x: "N", y: "y", value: "s", format: (v) => formatRational(v), dx: -8, textAnchor: "end", fill: c.plotFg }),
            numText([{ N: last.N, y: ref[1].y, s: CONFIG.half }], { x: "N", y: "y", value: "s", format: (v) => formatRational(v), dx: 6, dy: 2, textAnchor: "start", fill: c.plotMuted }),
          ],
        });
      }

      return {
        render(state, info = {}) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const show = true;
            const famKey = effectiveFamily(state);
            const model = modelOf(state.example, famKey);
            tau.set(state.tau);
            familySwitch.set(famKey);
            familySwitch.inputs[1].disabled = state.example === "tb16";
            if (labelledFor !== state.example) {
              labelledFor = state.example;
              familySwitch.inputs.forEach((inp, k) => inp.nextElementSibling?.replaceChildren(...famLabel(CONFIG.families[k], state.example)));
            }
            familyFixed.hidden = state.example !== "tb16";
            viewSwitch.set(state.view);
            exampleSwitch.set(state.example);

            const opt = optimumOf(model, state.tau);
            const sv = supportingVertex(model.hull, state.tau, { M: model.M });
            // the mean disclosure m, clamped to the family's range of N
            const lo = model.hull[0].N;
            const hi = model.hull.at(-1).N;
            const m = Math.min(hi, Math.max(lo, state.m));
            const mSlider = mSliderFor(hi);
            if (mSlot.firstChild !== mSlider.root) mSlot.replaceChildren(mSlider.root);
            mSlider.set(m);
            const mix = matchedDisclosure(model.cloud, model.hull, m);
            const mixShown = mix;
            if (m !== state.m) ctx.set({ m });

            reportIds = model.E.ids;
            vectorKey.textContent = `Vector positions: ${reportIds.join(" / ")}. Smaller grades mean higher priority; equal grades withhold. > means “stated above”.`;
            const framed = state.view !== "all" && mixtureFrame(model, mixShown) !== null;
            drawHead(state, model);
            drawHeadline(state, model, opt, sv);
            // opening a box changes nothing the chart shows: keep it (and a pinned tip) as it is
            if (info.reason !== "disclosure") drawChart(state, model, opt, sv, mixShown, show);
            drawLegend(state, model, mixShown, show, sv, framed);
            drawLottery(model, mix);
            drawPill(model);
            drawVertices(state, model, sv);
            drawMix(state, model, mix);
            writeMixtureSummary(model, mix, state, sv);
            drawHalf(state, model);
            ctx.caption.textContent = state.example === "tb16" ? T.noteTb16 : T.note;
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
