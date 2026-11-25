// Two pair-action losses under a complete finite law — Frame v2 upgrade.
// Numeric risks and decisions are engine calls. Primary stage shows the three pair-action cost curves
// against equality mass t with an inline paper legend above the plot, upgraded switch/cheapest markers,
// and collision-free 3-sig-fig direct labels; exact cost/denominator tables and switch/baseline derivations
// live in Data and Method disclosures.
import { createWidget } from "../shared/base.js";
import { numText, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  formatCount,
  formatEoverN,
  formatExpectedCount,
  formatProb,
  formatReadoutRisk,
  formatRisk,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  equalityNeutralRisk,
  evaluateReport,
  exactOptimum,
  finiteLawPairwise,
  pairDecision,
  tieLawPairwise,
} from "../pr-core.js";
import LAW from "../../data/released/m4-tie-law.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "ties-and-withholding",
  tMax: 0.9,
  tolerance: 1e-12,
  actions: Object.freeze([
    Object.freeze({ id: "iAboveJ", label: "A above B", grade: Object.freeze([1, 2]) }),
    Object.freeze({ id: "jAboveI", label: "B above A", grade: Object.freeze([2, 1]) }),
    Object.freeze({ id: "withhold", label: "Withhold", grade: Object.freeze([1, 1]) }),
  ]),
});
const A = CONFIG.actions;
const BELOW = LAW.tables.states.probability[0];
const STATES = LAW.tables.states.A.map((v, i) => [[v], [LAW.tables.states.B[i]]]);
const clean = (v) => Number(v.toFixed(14));
const eArray = (tie, e) => ({ ids: tie.ids, criteria: tie.criteria, e });
const LOSS = { weak: "Weak-error loss", neutral: "Equality-neutral loss" };

/** Exact composition of engine evaluations: Q is distinct mass, not a count of raw stated pairs. */
export function compute({ t, tau, scenario = "m4" }) {
  const certain = scenario === "certain";
  const probs = certain ? [0, 1, 0] : [BELOW, t, clean(1 - BELOW - t)];
  const options = { ids: LAW.arrays.tie.ids, criteria: LAW.arrays.tie.criteria };
  const weak = finiteLawPairwise(STATES, probs, options);
  const tie = tieLawPairwise(STATES, probs, options);
  const riskOptions = { tau, w: [1] };
  const rows = A.map((a) => {
    const w = evaluateReport(a.grade, weak, riskOptions);
    const n = equalityNeutralRisk(a.grade, tie, riskOptions);
    // evaluateReport is a sum of supplied directional coefficients; here b and d deliberately supply
    // strict-error and distinctness coefficients. Only their counts are used, not its weak-loss risk.
    const strict = evaluateReport(a.grade, eArray(tie, tie.b), riskOptions).Ew;
    const Q = evaluateReport(a.grade, eArray(tie, tie.d), riskOptions).Ew;
    return {
      ...a,
      weak: w.risk,
      neutral: n.risk,
      N: w.N,
      strict,
      Q,
      EoverN: w.N > 0 ? strict / w.N : null,
      EoverQ: Q > 0 ? strict / Q : null,
      guard: !certain || a.id === "withhold",
    };
  });
  const T = evaluateReport(A[0].grade, eArray(tie, tie.d), riskOptions).Ew;
  const R0 = equalityNeutralRisk(A[2].grade, tie, riskOptions).R0;
  const weakResult = exactOptimum(weak, { tau, family: { kind: "all" } });
  const weakBest = pairDecision(rows[0].weak, rows[1].weak, tau).best;
  // For a pair the neutral costs are exactly (b_AB, b_BA, R0); this is the same closed-form
  // three-action decision. At certain equality all three costs are identically zero, while the guard
  // allows only the shared grade. No guarded multi-unit selector is implemented in this app.
  const neutralBest = R0 > 0 ? pairDecision(rows[0].neutral, rows[1].neutral, R0).best : A.map((a) => a.id);
  const neutralResult = {
    label: weakResult.label,
    family: weakResult.family,
    risk: rows.find((r) => r.id === neutralBest[0]).neutral,
    containsAllWithheld: true,
  };
  return {
    certain,
    t: tie.t[0][0][1],
    tau,
    probs,
    tie,
    rows,
    T,
    R0,
    weakBest,
    neutralBest,
    weakResult,
    neutralResult,
  };
}

/** Crossings of affine risk lines, retained only when the engine declares both actions cheapest there. */
export function switchPoints(tau, loss) {
  const left = compute({ t: 0, tau });
  const right = compute({ t: CONFIG.tMax, tau });
  const points = [];
  for (let i = 0; i < A.length; i++) {
    for (let j = i + 1; j < A.length; j++) {
      const slopeI = (right.rows[i][loss] - left.rows[i][loss]) / CONFIG.tMax;
      const slopeJ = (right.rows[j][loss] - left.rows[j][loss]) / CONFIG.tMax;
      if (Math.abs(slopeI - slopeJ) < CONFIG.tolerance) continue;
      const raw = (left.rows[j][loss] - left.rows[i][loss]) / (slopeI - slopeJ);
      if (raw < -CONFIG.tolerance || raw > CONFIG.tMax + CONFIG.tolerance) continue;
      const t = Math.min(CONFIG.tMax, Math.max(0, raw));
      const r = compute({ t, tau });
      const best = loss === "weak" ? r.weakBest : r.neutralBest;
      if (!best.includes(A[i].id) || !best.includes(A[j].id)) continue;
      if (points.some((p) => Math.abs(p.t - t) < CONFIG.tolerance)) continue;
      points.push({
        t,
        risk: r.rows[i][loss],
        best: best.map((id) => A.find((a) => a.id === id).label).join(" / "),
      });
    }
  }
  return points.sort((a, b) => a.t - b.t);
}

const CSS = `
.tw .prx-slider[data-tw-unused] { opacity: 0.5; }
.tw .prx-stage { display: flex; flex-direction: column; gap: 0.35rem; }
.tw .prx-stage .prx-panel-title { margin: 0; color: var(--prx-plot-fg); }
.tw .prx-stage .tw-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.8rem;
  align-items: center;
  padding: 0.2rem 0.35rem;
  margin: 0;
  font-size: 0.84375rem;
  line-height: 1.3;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border-bottom: 1px solid var(--prx-plot-grid);
}
@media (max-width: 30em) {
  .tw[data-prx-frame="v2"] .prx-presets .prx-seg { padding-inline: 0.5rem; }
}
.tw .prx-stage .tw-legend span { display: inline-flex; gap: 0.38rem; align-items: center; }
.tw .prx-stage .tw-key-svg { flex: none; display: inline-block; overflow: visible; }
.tw .tw-table { width: 100%; border-collapse: collapse; font-size: 0.9em; font-variant-numeric: tabular-nums; }
.tw .tw-table th, .tw .tw-table td { padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--prx-border); }
.tw .tw-cost-table { table-layout: fixed; }
.tw .tw-cost-table th:first-child { width: 44%; }
.tw .tw-cost-table th:nth-child(n+2) { width: 28%; }
.tw .tw-table caption { caption-side: top; color: var(--prx-fg-heading); font-weight: 600; text-align: left; padding-bottom: 0.35rem; }
.tw .tw-current { background: var(--prx-bg-sunken); font-weight: 600; }
.tw .tw-note { color: var(--prx-fg-muted); font-size: 0.9em; margin: 0.4rem 0; }
.tw .tw-block + .tw-block { margin-top: 0.85rem; }
.tw .tw-scroll { max-width: 100%; overflow-x: auto; }
.tw .tw-denominators th, .tw .tw-denominators td { white-space: nowrap; }
.tw .tw-admissibility { display: block; font-size: 0.84em; font-weight: 400; color: var(--prx-fg-muted); margin-top: 0.2rem; }
.tw .tw-baseline-fig { background: var(--prx-plot-bg); padding: 0.35rem 0.5rem; border: 1px solid var(--prx-border); border-radius: 6px; margin: 0.4rem 0; }
`;

const naturalJoin = (items) =>
  items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const measureWidth = (el, fallbackEl, fallback) => {
  const w = Math.round(
    el?.clientWidth ||
      el?.getBoundingClientRect?.().width ||
      fallbackEl?.clientWidth ||
      fallbackEl?.getBoundingClientRect?.().width ||
      0,
  );
  return Math.max(240, w || fallback);
};

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "tw",
    css: CSS,
    frame: "v2",
    label: "True equality and withholding: the costs of three pair actions under two loss conventions",
    keys: {
      t: { type: "number", min: 0, max: CONFIG.tMax, step: 0.01, value: 0.4 },
      tau: { type: "number", min: 0.01, max: 0.5, step: 0.01, value: 0.25 },
      loss: { type: "choice", values: ["weak", "neutral"], value: "weak" },
      scenario: { type: "choice", values: ["m4", "certain"], value: "m4" },
    },
    build(ctx) {
      const { h, doc } = ctx;
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        if (name) n.setAttribute("data-prx-readout", name);
        return n;
      };
      const risk = (name, v) => ro(name, v, formatRisk(v));
      const roRisk = (name, v) => ro(name, v, formatReadoutRisk(v));
      const prob = (name, v) => ro(name, v, formatProb(v));
      const count = (name, v) => ro(name, v, formatCount(v));
      const share = (name, v) => ro(name, v, formatShare(v));

      // Primary controls in toolbar: equality probability t and withholding cost τ
      const t = ctx.slider({
        label: "Probability of equal true values, t",
        ...ctx.key("t"),
        onInput: (v) => ctx.set({ t: v }),
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.controls.append(t.root, tau.root);
      ctx.primaryControl(t.root);

      // Secondary toggles in Settings disclosure (>= 44px mobile touch targets via frame v2)
      const loss = ctx.segmented({
        label: "Loss shown in the figure",
        name: "loss",
        value: ctx.state.loss,
        options: [
          { value: "weak", label: LOSS.weak },
          { value: "neutral", label: LOSS.neutral },
        ],
        onChange: (v) => ctx.set({ loss: v }),
      });
      const scenario = ctx.segmented({
        label: "Supplied law",
        name: "scenario",
        value: ctx.state.scenario,
        options: [
          { value: "m4", label: "Vignette law" },
          { value: "certain", label: "Certain equality" },
        ],
        onChange: (v) => ctx.set({ scenario: v }),
      });
      const settings = ctx.settingsBox("Settings");
      settings.body.append(loss.root, scenario.root);

      // Primary stage: panel title + inline legend ABOVE figure (zero x-axis collision) + main SVG
      const figureTitle = ctx.panelTitle(LOSS.weak);
      const lineSwatch = (stroke, dash = null) =>
        svgEl(
          doc,
          "svg",
          { class: "tw-key-svg", width: 26, height: 14, viewBox: "0 0 26 14", "aria-hidden": "true" },
          svgEl(doc, "line", {
            x1: 1,
            y1: 7,
            x2: 25,
            y2: 7,
            stroke,
            strokeWidth: 2.5,
            strokeDasharray: dash,
          }),
        );
      const switchIcon = () =>
        svgEl(
          doc,
          "svg",
          { class: "tw-key-svg", width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": "true" },
          svgEl(doc, "circle", {
            cx: 9,
            cy: 9,
            r: 5.5,
            fill: "var(--prx-plot-bg)",
            stroke: "var(--prx-plot-fg)",
            strokeWidth: 2,
          }),
        );
      const cheapestIcon = () =>
        svgEl(
          doc,
          "svg",
          { class: "tw-key-svg", width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": "true" },
          svgEl(doc, "circle", {
            cx: 9,
            cy: 9,
            r: 7.2,
            fill: "none",
            stroke: "var(--prx-plot-fg)",
            strokeWidth: 2,
          }),
          svgEl(doc, "circle", {
            cx: 9,
            cy: 9,
            r: 3.4,
            fill: "var(--prx-plot-fg)",
          }),
        );

      const legend = ctx.part(
        "legend",
        h(
          "div",
          { class: "tw-legend" },
          h("span", {}, lineSwatch("var(--prx-err)"), "A above B"),
          h("span", {}, lineSwatch("var(--prx-err)", "6 3.5"), "B above A"),
          h("span", {}, lineSwatch("var(--prx-wh)"), "Withhold"),
          h("span", {}, switchIcon(), "Equal-cost switch point"),
          h("span", {}, cheapestIcon(), "Cheapest at the current t"),
        ),
      );
      const figure = h("div", { class: "tw-figure" });
      ctx.stage.append(figureTitle, legend, figure);

      // 1-line scope note keeping the shared-grade vs. equality distinction visible
      ctx.setScope("A shared grade withholds a direction; it is not a claim that A = B.");

      // Data disclosure: supplied law, exact 3-row cost table, and raw-pair vs. distinct-mass table
      const dataBox = ctx.dataBox("Data, action costs and supplied law");
      const law = ctx.part("notes", h("p", { class: "tw-note tw-block" }));
      const massHint = h(
        "p",
        { class: "tw-note" },
        "Pr(A < B) stays ",
        ctx.num(BELOW, formatProb(BELOW)),
        "; the remaining mass moves between equality and A above B.",
      );
      const costs = ctx.part("table", h("div", { class: "tw-costs tw-block" }));
      const denominator = ctx.part("table", h("section", { class: "tw-denominators tw-block" }));
      ctx.stage.append(law, costs);
      dataBox.body.append(massHint, denominator);

      // Method disclosure: optimality tag, switch points, all-withheld R0 bar/formula, and conceptual note
      const methodBox = ctx.methodBox("Method and switch points");
      const label = h("p", { class: "tw-note tw-block" });
      const switches = ctx.part("notes", h("section", { class: "tw-summary tw-block" }));
      const baselineSection = h("section", { class: "tw-block" });
      const baselineDefinition = h("p", { class: "tw-note" });
      const baseline = h("div", { class: "tw-baseline-fig" });
      const formula = ctx.part("notes", h("div", { class: "tw-formula tw-scroll" }));
      const scope = h("p", {
        class: "tw-note",
        text: "The superscript s identifies the posterior used for both calculations. The equality-neutral loss charges only in states where the targets differ.",
      });
      ctx.scrollRegion(formula, "All-withheld risk under the supplied law");
      baselineSection.append(ctx.panelTitle("All-withheld baseline risk"), baselineDefinition, baseline, formula, scope);
      const meaning = ctx.part("notes", h("section", { class: "tw-meaning tw-block" }));
      meaning.append(
        ctx.panelTitle("A shared grade makes no equality claim"),
        h("p", {
          class: "tw-note",
          text: "A shared grade withholds a direction. Equal posterior means, rounded measurements, practical closeness and equal-cost actions are different statements from exact equality of the true values. The weak and neutral losses agree only when every positive-weight criterion is tie-free and the same action family is compared.",
        }),
      );
      methodBox.body.append(label, switches, baselineSection, meaning);

      ctx.caption.textContent =
        "Synthetic law after postrank vignette m4; probabilities and risks are computed in this browser. The certain-equality case is a separate stipulated law.";

      function drawFigure(state, r) {
        const lossKey = state.loss;
        legend.hidden = r.certain;
        figureTitle.textContent = r.certain
          ? `${LOSS[lossKey]} at certain equality`
          : `${LOSS[lossKey]} as equality becomes more likely`;
        const best = lossKey === "weak" ? r.weakBest : r.neutralBest;
        const width = measureWidth(figure, ctx.stage, ctx.width() - 32);

        if (r.certain) {
          const bars = r.rows.map((a) => ({ action: a.label, risk: a[lossKey], guard: a.guard }));
          plot(figure, {
            width,
            height: 220,
            marginLeft: 96,
            marginRight: 52,
            marginTop: 18,
            marginBottom: 42,
            alt: "At certain equality, each neutral risk is zero, while weak loss charges each stated direction one and withholding τ. The same-grade guard permits only withholding in the neutral problem.",
            x: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], label: "Expected cost", labelAnchor: "center", labelArrow: "none" },
            y: { label: null, domain: A.map((a) => a.label), tickSize: 0 },
            color: { type: "identity" },
            marks: (c, P) => [
              P.barX(bars, { x: "risk", y: "action", fill: (d) => (d.action === "Withhold" ? c.wh : c.err), insetTop: 4, insetBottom: 4 }),
              P.dot(bars, { x: "risk", y: "action", r: 4.5, fill: c.plotFg }),
              numText(bars, {
                x: "risk",
                y: "action",
                value: "risk",
                format: (v) => formatReadoutRisk(v),
                dx: 8,
                textAnchor: "start",
                fill: c.plotFg,
                fontWeight: 600,
              }),
            ],
            keyboard: {
              data: bars,
              x: "risk",
              y: "action",
              title: (d) =>
                `${d.action}: cost ${formatRisk(d.risk)}${state.loss === "neutral" && !d.guard ? "; not admitted by the same-grade guard" : ""}`,
            },
          });
          return;
        }

        const height = Math.max(width < 420 ? 228 : 250, Math.min(300, Math.round(width * 0.42)));
        const marginTop = 24;
        const marginRight = 18;
        const marginBottom = 42;
        const marginLeft = 48;
        const grid = Array.from({ length: 91 }, (_, i) => i / 100);
        const lines = grid.flatMap((x) => {
          const q = compute({ t: x, tau: state.tau });
          return q.rows.map((a) => ({ id: a.id, t: x, risk: a[lossKey] }));
        });
        const dots = r.rows.map((a) => ({ ...a, t: r.t, risk: a[lossKey], best: best.includes(a.id) }));
        const crossings = switchPoints(state.tau, lossKey);

        const fig = plot(figure, {
          width,
          height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
          alt: "Three action-risk lines against the probability of exact equality. The two stated directions use solid and dashed error-color lines; withholding is gray. Circles mark switch points of the cheapest action, and rings mark cheapest actions at the selected equality probability.",
          x: {
            domain: [0, CONFIG.tMax],
            ticks: [0, 0.3, 0.6, 0.9],
            label: "Probability of equal true values, t",
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: "Expected cost", labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => [
            ...A.map((a) =>
              P.line(lines.filter((d) => d.id === a.id), {
                x: "t",
                y: "risk",
                stroke: a.id === "withhold" ? c.wh : c.err,
                strokeWidth: 2.4,
                strokeDasharray: a.id === "jAboveI" ? "7 4" : null,
              }),
            ),
            P.ruleX([r.t], { stroke: c.plotMuted, strokeDasharray: "3 3" }),
            P.dot(crossings, { x: "t", y: "risk", fill: c.plotBg, stroke: c.plotFg, strokeWidth: 2, r: 6 }),
            P.dot(dots.filter((d) => d.best), { x: "t", y: "risk", r: 9.5, fill: "none", stroke: c.plotFg, strokeWidth: 2.3 }),
            P.dot(dots, {
              x: "t",
              y: "risk",
              r: 4.5,
              fill: (d) => (d.id === "withhold" ? c.wh : c.err),
              stroke: c.plotBg,
              strokeWidth: 1.4,
            }),
          ],
          keyboard: {
            data: dots,
            x: "t",
            y: "risk",
            sort: false,
            label: "The three actions at the selected equality probability",
            title: (d) => `${d.label}: risk ${formatRisk(d.risk)}${d.best ? "; lowest" : ""}`,
          },
        });

        // Direct 3-sig-fig action cost labels at current t, separated via placeDirectLabels (mapped by item.id, WA-02)
        // and clamped strictly within stage horizontal bounds (WA-13).
        const sx = fig.scale("x");
        const sy = fig.scale("y");
        const pal = fig.palette;
        const vx = sx.apply(r.t);
        const placeRight = r.t <= 0.52;
        const anchor = placeRight ? "start" : "end";
        const safeTop = marginTop + 10;
        const safeBottom = height - marginBottom - 10;
        const rawItems = dots.map((d) => {
          const textStr = `${d.label}: ${formatReadoutRisk(d.risk)}`;
          const estW = Math.ceil(textStr.length * 7.4) + 6;
          const x = placeRight
            ? Math.min(width - marginRight - 4 - estW, Math.max(marginLeft + 8, vx + 12))
            : Math.max(marginLeft + 8 + estW, Math.min(width - marginRight - 6, vx - 12));
          const vy = sy.apply(d.risk);
          const y = Math.max(safeTop, Math.min(safeBottom, vy - 9));
          return {
            id: d.id,
            vx,
            vy,
            x,
            y,
            estW,
            anchor,
            d,
          };
        });
        const placed = placeDirectLabels(rawItems, { minGapPx: 19, bounds: [safeTop, safeBottom] });
        const byId = new Map();
        for (const item of placed) byId.set(item.id, item);

        const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
        const halo = {
          stroke: pal.plotBg,
          strokeWidth: 3.5,
          strokeLinejoin: "round",
          paintOrder: "stroke",
          dominantBaseline: "central",
        };
        for (const d of dots) {
          const item = byId.get(d.id);
          if (!item) continue;
          const edgeX = item.anchor === "end" ? item.x + 4 : item.x - 4;
          if (Math.hypot(edgeX - item.vx, item.y - item.vy) > 16) {
            layer.append(
              svgEl(doc, "line", {
                x1: item.vx,
                y1: item.vy,
                x2: edgeX,
                y2: item.y,
                stroke: pal.plotMuted,
                strokeWidth: 1,
              }),
            );
          }
          const bgX = item.anchor === "end" ? item.x - item.estW + 3 : item.x - 3;
          layer.append(
            svgEl(doc, "rect", {
              x: bgX,
              y: item.y - 8,
              width: item.estW,
              height: 16,
              rx: 3,
              fill: pal.plotBg,
              fillOpacity: 0.96,
            }),
            svgEl(
              doc,
              "text",
              {
                ...halo,
                x: item.x,
                y: item.y,
                textAnchor: item.anchor,
                fill: d.id === "withhold" ? pal.plotMuted : pal.errText,
                fontWeight: d.best ? 700 : 600,
              },
              `${d.label}: `,
              svgEl(doc, "tspan", { num: d.risk, text: formatReadoutRisk(d.risk) }),
            ),
          );
        }
        fig.svg.append(layer);
      }

      function drawCosts(state, r) {
        const best = state.loss === "weak" ? r.weakBest : r.neutralBest;
        const th = (text) => h("th", { scope: "col", text });
        costs.replaceChildren(
          h(
            "table",
            { class: "tw-table tw-cost-table" },
            h("caption", { text: "Same law, different costs" }),
            h("thead", {}, h("tr", {}, th("Action"), th("Weak error"), th("Equality neutral"))),
            h(
              "tbody",
              {},
              ...r.rows.map((a) =>
                h(
                  "tr",
                  { class: best.includes(a.id) && (state.loss === "weak" || a.guard) ? "tw-current" : null },
                  h(
                    "th",
                    { scope: "row" },
                    a.label,
                    !a.guard
                      ? h(
                          "small",
                          { class: "tw-admissibility", "data-prx-not-admitted": "" },
                          "Not admitted under the neutral guard: identical targets stay together.",
                        )
                      : null,
                  ),
                  h("td", {}, risk(`weak-${a.id}`, a.weak)),
                  h("td", {}, risk(`neutral-${a.id}`, a.neutral)),
                ),
              ),
            ),
          ),
        );
        if (r.certain) {
          costs.append(
            h(
              "p",
              { class: "tw-note" },
              "All neutral costs are ",
              count("zero-neutral", r.R0),
              ". The guard permits only the shared grade: withholding.",
            ),
          );
        }
      }

      function drawSwitches(state, r) {
        if (r.certain) {
          switches.replaceChildren(
            ctx.panelTitle("Certain equality is different from uncertainty"),
            h(
              "p",
              { class: "tw-note" },
              "Both targets are exactly equal in every possible state. Zero neutral risk supplies no evidence of strict superiority. The same-grade guard keeps identical profiles together; scoring a direction does not make it admissible.",
            ),
          );
          return;
        }
        const row = (lossKey) => {
          const xs = switchPoints(state.tau, lossKey);
          return h(
            "p",
            {},
            `${LOSS[lossKey]}: `,
            ...(xs.length
              ? xs.flatMap((p, i) => [i ? "; " : "", "t = ", prob(`${lossKey}-switch-${i}`, p.t), ` (${p.best})`])
              : ["no change of cheapest action over this equality range."]),
          );
        };
        switches.replaceChildren(
          ctx.panelTitle("Where the cheapest action changes"),
          row("weak"),
          row("neutral"),
          h(
            "p",
            { class: "tw-note" },
            "At a listed switch point the named actions have equal cost within the risk tolerance ",
            ro("tolerance", CONFIG.tolerance, "1e−12"),
            ".",
          ),
        );
      }

      function drawBaseline(r) {
        baselineDefinition.replaceChildren(
          "For this pair, total distinct mass T is the probability that A and B differ: ",
          share("baseline-T", r.T),
          ". The equality-neutral all-withheld risk R₀ charges τ only on that mass; the original pair count M is ",
          count("baseline-M", 1),
          ".",
        );
        const bars = [
          { loss: "Weak all-withheld", risk: r.tau },
          { loss: "Neutral all-withheld", risk: r.R0 },
        ];
        const bWidth = measureWidth(baseline, ctx.stage, ctx.width() - 48);
        plot(baseline, {
          width: bWidth,
          height: 136,
          marginTop: 12,
          marginLeft: 138,
          marginRight: 56,
          marginBottom: 38,
          alt: "All-withheld risk is τ for weak error and R0 = τ times total distinct mass divided by the original pair count for equality-neutral loss.",
          x: { domain: [0, 0.5], ticks: [0, 0.25, 0.5], label: "All-withheld risk", labelAnchor: "center", labelArrow: "none" },
          y: { label: null, domain: bars.map((x) => x.loss), tickSize: 0 },
          color: { type: "identity" },
          marks: (c, P) => [
            P.barX(bars, { x: "risk", y: "loss", fill: c.wh, insetTop: 3, insetBottom: 3 }),
            numText(bars, {
              x: "risk",
              y: "loss",
              value: "risk",
              format: (v) => formatReadoutRisk(v),
              dx: 7,
              textAnchor: "start",
              fill: c.plotFg,
              fontWeight: 600,
            }),
          ],
          keyboard: {
            data: bars,
            x: "risk",
            y: "loss",
            title: (d) => `${d.loss}: ${formatRisk(d.risk)}`,
          },
        });
        const f = formulaNums();
        renderTex(
          formula,
          `R^s_0 = \\tau T^s_w/M = ${f.num(r.tau, formatSetting(r.tau))}\\times ${f.num(r.T, formatShare(r.T))}/${f.num(1, formatCount(1))} = ${f.num(r.R0, formatRisk(r.R0))}`,
          { display: true, nums: f.raws },
        );
      }

      function drawDenominators(r) {
        const wrap = h("div", { class: "tw-scroll" });
        const th = (text) => h("th", { scope: "col", text });
        const ratio = (name, v, distinct = false, N = 0) =>
          v === null && distinct && N > 0
            ? h("span", { "data-prx-undefined-ratio": name }, ro(name, null, formatProb(null)), ": no distinct mass")
            : ro(name, v, v === null ? formatEoverN(v) : formatShare(v));
        wrap.append(
          h(
            "table",
            { class: "tw-table prx-sticky-first" },
            h("caption", { text: "Neutral counts" }),
            h(
              "thead",
              {},
              h("tr", {}, th("Action"), th("Raw stated pairs, N"), th("Strict errors"), th("Distinct mass, Q"), th("Errors / N"), th("Errors / Q")),
            ),
            h(
              "tbody",
              {},
              ...r.rows.map((a) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row", text: a.label }),
                  h("td", {}, count(`N-${a.id}`, a.N)),
                  h("td", {}, ro(`strict-${a.id}`, a.strict, formatExpectedCount(a.strict))),
                  h("td", {}, share(`Q-${a.id}`, a.Q)),
                  h("td", {}, ratio(`EoverN-${a.id}`, a.EoverN)),
                  h("td", {}, ratio(`EoverQ-${a.id}`, a.EoverQ, true, a.N)),
                ),
              ),
            ),
          ),
        );
        denominator.replaceChildren(
          ctx.panelTitle("Raw pairs and distinct mass"),
          wrap,
          h(
            "p",
            { class: "tw-note" },
            "Total distinct mass T = ",
            share("T", r.T),
            "; original pair count M = ",
            count("M", 1),
            ". Raw disclosure counts a stated pair even when the targets may be equal; distinct mass discounts that possibility.",
          ),
        );
        ctx.scrollRegion(wrap, "Raw pair counts and distinct-comparison denominators");
      }

      return {
        render(state, info) {
          // PR-06 / PR-09: opening a disclosure never re-renders stage or re-fires readout; redraw Method's SVG at open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "method" && methodBox.open) drawBaseline(compute(state));
            return;
          }
          const r = compute(state);
          t.set(state.t);
          t.setDisabled(r.certain);
          t.root.toggleAttribute("data-tw-unused", r.certain);
          tau.set(state.tau);
          loss.set(state.loss);
          scenario.set(state.scenario);

          drawFigure(state, r);
          drawCosts(state, r);
          drawSwitches(state, r);
          drawBaseline(r);
          drawDenominators(r);

          law.replaceChildren(
            "B is ",
            count(null, LAW.tables.states.B[0]),
            "; A is ",
            count(null, LAW.tables.states.A[0]),
            ", ",
            count(null, LAW.tables.states.A[1]),
            " or ",
            count(null, LAW.tables.states.A[2]),
            " with probabilities ",
            ...r.probs.flatMap((p, i) => [i ? ", " : "", prob(`mass-${i}`, p)]),
            ". This is a complete finite law, not a sample.",
          );
          massHint.hidden = r.certain;

          if (r.certain && state.loss === "neutral") {
            label.replaceChildren(captionNode(ctx, "fixed-report"), "; the identical-profile guard admits only withholding.");
            ctx.readout.set([
              "At certain equality, every neutral action cost is ",
              count("R0", r.R0),
              "; the identical-profile guard admits only withholding (a shared grade asserts no equality in general).",
            ]);
          } else {
            const neutral = state.loss === "neutral";
            const best = neutral ? r.neutralBest : r.weakBest;
            const cost = r.rows.find((a) => a.id === best[0])[state.loss];
            const bestNames = best.map((id) => A.find((a) => a.id === id).label);
            label.replaceChildren(tagNode(ctx, neutral ? r.neutralResult : r.weakResult), ` under ${LOSS[state.loss].toLowerCase()}.`);
            ctx.readout.set([
              `${LOSS[state.loss]}: `,
              naturalJoin(bestNames),
              best.length > 1 ? " share lowest cost " : " has lowest cost ",
              roRisk(null, cost),
              " (neutral all-withheld R₀ = ",
              roRisk("R0", r.R0),
              " vs. weak τ = ",
              ro("weak-baseline", r.tau, formatSetting(r.tau)),
              ").",
            ]);
          }
        },
      };
    },
  });
}
