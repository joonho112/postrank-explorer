// Mixtures of complete reports at matched disclosure, with family and fixed-order endpoint examples.
import { createWidget, uid, appLink } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { blocksText, formatCount, formatGrades, formatProb, formatRational, formatSci, formatSetting } from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import { matchedDisclosure, supportingVertex, fixedOrderDP, finiteLawPairwise } from "../pr-core.js";
import { CONFIG as FRONTIER, CSS, modelOf, optimumOf, tb19Model, createCloudRenderer } from "./frontier.js";

export const CONFIG = Object.freeze({ ...FRONTIER, name: "frontier-mixtures",
  title: "A mixture at a mean number of stated pairs",
  label: "Mixtures between frontier corners: matched disclosure, whole reports and the gap to a single report",
});
const EX = { tb16: { weights: Array.from(CONFIG.tb16.w) } };
const effectiveFamily = (state) => state.example === "tb16" ? "all" : state.family;
const niceTop = (v) => Math.ceil(v * CONFIG.yRound) / CONFIG.yRound;
const ORDER_E = finiteLawPairwise(CONFIG.tb19.states.map(s => s.map(x => Array.from(x))), Array.from(CONFIG.tb19.probs), {ids: Array.from(CONFIG.tb19.ids)});
const ORDER_OPT = fixedOrderDP(ORDER_E, { order: Array.from(CONFIG.tb19.order), tau: CONFIG.half });

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fr prx-fm",
    css: `${CSS}
.prx-fm .prx-app-link { color: var(--prx-link); }
.prx-fm .prx-app-link:hover, .prx-fm .prx-app-link:focus { color: var(--prx-link-hover); }
.prx-fm .prx-fr-vector-key { margin: .15rem 0; }
.prx-fm .prx-fr-label { margin: .3rem 0 .35rem; }
.prx-fm .prx-fr-optimum { margin: .25rem 0; font-size: .9em; color: var(--prx-fg-muted); }
`,
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

      // --- controls: τ, the family, the view
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
      ctx.controls.append(tau.root, familySwitch.root, viewSwitch.root);

      // --- result headline: the live read-out, then the label with the family and its size
      const labelLine = h("p", { class: "prx-fr-label", "data-prx-part": "readout" });
      const vectorKey = h("p", { class: "prx-fr-vector-key", "data-prx-part": "notes" });
      ctx.controls.after(vectorKey, ctx.readout.node);
      const optimumLine = ctx.part("readout", h("p", { class: "prx-fr-optimum" }));
      ctx.readout.node.after(optimumLine, labelLine);

      // --- the figure
      const head = h("p", { class: "prx-fr-head" });
      const chartSlot = h("div", { class: "prx-fr-chart" });
      const legend = h("div", { class: "prx-fr-legend", "data-prx-part": "legend" });
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexHeadingId = uid("prx-fr-vertices");
      ctx.charts.append(head, chartSlot, legend, vertexBox);
      const drawChart = createCloudRenderer(ctx, chartSlot);

      // --- The mixture and endpoint panels are always visible.
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
      ctx.controls.prepend(mSlot, exampleSwitch.root);
      ctx.charts.after(details);

      // --------------------------------------------------------------------------------------- drawing

      function drawHead(state, model) {
        const fam = model.cloud.family;
        const pre = state.example === "tb16"
          ? [`${T.headTb16} (`, ...model.ex.weights.flatMap((w, k) => [k ? ", " : "", ctx.num(w, formatRational(w))]), "): "]
          : [`${T.headSix} `];
        head.replaceChildren(...pre, `${T.headIn} `, ro("familySize", fam.size, formatCount(fam.size)), ` ${T.headInEnd} `,
          famNode(fam), ".");
      }

      function drawLegend(state, model, mix, show) {
        const key = (cls, ...text) => h("span", { class: "prx-fr-key" }, h("span", { class: `prx-fr-swatch ${cls}` }), h("span", {}, ...text));
        const items = [
          key("prx-fr-sw-dash", T.legendReport),
          key("prx-fr-sw-min", T.legendMin.replace("⟨E⟩", model.wrong)),
        ];
        const yTop = state.view === "all" ? model.yAll : model.yNear;
        if (model.cloud.byN.some((r) => r.maxEw > yTop)) items.push(key("prx-fr-sw-above", T.legendAbove));
        if (show) {
          items.push(
            key("prx-fr-sw-vertex", T.legendVertex),
            key("prx-fr-sw-hull", `${T.legendHull} `, captionNode(ctx, "mixture-not-report")),
            key("prx-fr-sw-line", `${T.legendLine} `, ctx.num(state.tau, formatSetting(state.tau))),
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

      function writeMixtureSummary(model, mix) {
        const n = (v) => ctx.num(v, formatCount(v));
        const e = (v) => ctx.num(v, model.fmt.E(v));
        const psi = (v) => ctx.num(v, model.fmt.psi(v));
        const parts = ["At mean disclosure ", n(mix.N), ", the boundary has ", e(mix.H), ` ${model.wrong}. `];
        if (mix.psi === 0) parts.push("This is a vertex report; no mixture is needed.");
        else if (mix.best) parts.push("Print the report stating ", n(mix.upper.N), " pairs with chance ", psi(mix.psi), "; otherwise print the report stating ", n(mix.lower.N), " pairs; the best single report at this disclosure lies ", e(mix.gap), " higher.");
        else parts.push("Print the report stating ", n(mix.upper.N), " pairs with chance ", psi(mix.psi), "; otherwise print the report stating ", n(mix.lower.N), " pairs; no single report states exactly this many pairs.");
        ctx.readout.set(parts);
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
        render(state) {
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
            drawHead(state, model);
            drawHeadline(state, model, opt, sv);
            drawChart(state, model, opt, sv, mixShown, show);
            drawLegend(state, model, mixShown, show);
            drawVertices(state, model, sv);
            drawMix(state, model, mix);
            writeMixtureSummary(model, mix);
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
