// One pair: all linked cost, bridge and rule views; probabilities and choices from pairDecision.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatProb, formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { pairDecision } from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "one-pair",
  label: "One pair: the expected cost of stating each direction or withholding, at a direction probability and a withholding cost",
  className: "prx-one-pair",
  pi: Object.freeze({ min: 0, max: 1, step: 0.01, value: 0.85 }),
  tau: Object.freeze({ min: 0.01, max: 0.5, step: 0.01, value: 0.2 }),
  // e_AB = 1 − π_AB is rounded to this many decimals, so that a grid value reads back exactly (1 − .85 is
  // .15000000000000002 in floating point); the engine compares the costs with its own 1e-12 tolerance
  cleanDigits: 10,
  // a wrong stated direction costs one; the τ bound one half (CONTRACT 5.3)
  wrongCost: 1,
  half: 0.5,
  actions: Object.freeze(["iAboveJ", "jAboveI", "withhold"]),
  chart: Object.freeze({
    height: 270, marginTop: 46, marginRight: 14, marginBottom: 40, marginLeft: 52, ticks: 5,
    line: 2.25, dash: "7,4", envelopeOpacity: 0.85, rule: "3,3", dot: 4, ring: 7, ringWidth: 2, circle: 5,
    // direct labels, each lifted labelDy px above its line: the falling line near its top-left end (labelBA), the
    // rising line lower down (labelAB), so that the two never share a row at a narrow width; the withhold line at its
    // right end
    labelBA: 0.04, labelAB: 0.8, labelDx: 7, labelDy: -9, whLabelDx: -4, whLabelDy: -8, halo: 3,
    // the "equally good" labels sit under the flat line, beside each crossing on the side away from the lines
    // (sideDx, belowDy px); when the two would be closer than gapPx px they become one label in the middle, at half
    // the height of the flat line; a crossing lower than lowPx px gets no label (the legend names the circles); the
    // marker's formula sits markerDy px above the plot, anchored at its side within markerEdge of an end
    sideDx: 6, belowDy: 15, lowPx: 30, gapPx: 175, middle: 0.5, markerTop: 1, markerDy: -32, markerEdge: 0.08,
  }),
  text: Object.freeze({
    piLabel: "Direction probability π of A above B",
    piName: "Direction probability that A's true value is larger than B's",
    tauLabel: "Withholding cost τ",
    // the hint as parts: {one} is the cost of a wrong direction, a data-num node
    tauHint: Object.freeze(["A wrong stated direction costs ", "{one}", "; staying silent on the pair costs τ."]),
    bridgeHead: "From the direction probability to the error probability",
    bridgeNote: "The last line holds because the two true values have probability zero of being equal here; the two lines above it hold for every posterior.",
    // figure
    xLabel: "Error probability of stating A above B",
    yLabel: "Expected cost",
    lineAB: "state A above B",
    lineBA: "state B above A",
    lineWH: "withhold",
    equal: "equally good",
    // two lines, so that the label fits between the two direction lines at a narrow width
    equalAll: "all three\nequally good",
    alt: "Three expected-cost lines against the error probability of stating A above B, from zero to one along the bottom. The top scale shows the complementary direction probability, from one to zero. Stating A above B costs that error (solid line, rising). Stating B above A costs one minus it (dashed line, falling). Withholding costs τ (flat gray line). The area under the lowest line is shaded, and open circles mark where the flat line crosses the others. A vertical line marks the current pair, with a dot on each line and a ring around each best action's dot.",
    tableCaption: "Where the actions are equally good, and the current pair",
    colWhere: "Point on the figure",
    colError: "Error probability of A above B",
    colBest: "Best actions there",
    rowCrossAB: "Crossing of the rising line and the flat line",
    rowCrossBA: "Crossing of the falling line and the flat line",
    rowCrossAll: "Crossing of all three lines",
    rowCurrent: "The current pair",
    legendShade: "shaded: the smallest of the three costs",
    legendCircle: "open circle: two (or all three) actions equally good",
    legendRing: "ring: a best action at this pair",
    // cost table
    costCaption: "Expected cost of each action for this pair (withholding says nothing about the direction)",
    colAction: "Action",
    colCost: "Cost",
    colSmallest: "Lowest?",
    rowAB: "State A above B",
    rowBA: "State B above A",
    rowWH: "Withhold",
    smallest: "yes",
    smallestEqual: "yes, equal",
    // read-out
    readSetting: Object.freeze(["{piAB}", " = ", "{pi}", ", τ = ", "{tau}", ". Direction errors: ", "{eAB}", " = ", "{e}", ", ", "{eBA}", " = ", "{eRev}", ". "]),
    readBest: Object.freeze({
      iAboveJ: Object.freeze(["Stating A above B is the unique best action: its expected cost ", "{e}", " is below τ."]),
      jAboveI: Object.freeze(["Stating B above A is the unique best action: its expected cost ", "{eRev}", " is below τ."]),
      withhold: Object.freeze(["Both errors are above τ, so withholding is the unique best action, with expected cost ", "{tau}", "."]),
      iAboveJwithhold: Object.freeze(["The error of A above B equals τ, so stating A above B and withholding are equally good, each with expected cost ", "{tau}", "."]),
      jAboveIwithhold: Object.freeze(["The error of B above A equals τ, so stating B above A and withholding are equally good, each with expected cost ", "{tau}", "."]),
      all: Object.freeze(["Both errors equal τ, so all three actions are equally good, each with expected cost ", "{tau}", "."]),
      other: Object.freeze(["The best actions are: ", "{list}", "."]),
    }),
    actionWords: Object.freeze({ iAboveJ: "state A above B", jAboveI: "state B above A", withhold: "withhold" }),
    // rule box
    ruleHead: "The rule for one pair",
    rule: Object.freeze(["For an isolated pair, disclose only when the posterior probability of the direction exceeds ", "{one}", " − τ."]),
    ruleGloss: "To disclose a direction is to state it.",
    ruleHere: Object.freeze({
      iAboveJ: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ", and ", "{piAB}", " = ", "{pi}", " exceeds it: disclose A above B."]),
      jAboveI: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ", and ", "{piBA}", " = ", "{piRev}", " exceeds it: disclose B above A."]),
      withhold: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ". Neither ", "{piAB}", " = ", "{pi}", " nor ", "{piBA}", " = ", "{piRev}", " exceeds it: withhold."]),
      iAboveJwithhold: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ", and ", "{piAB}", " = ", "{pi}", " equals it: disclosing A above B and withholding are equally good."]),
      jAboveIwithhold: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ", and ", "{piBA}", " = ", "{piRev}", " equals it: disclosing B above A and withholding are equally good."]),
      all: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", ", and both ", "{piAB}", " and ", "{piBA}", " equal it: all three actions are equally good."]),
      other: Object.freeze(["Here ", "{one}", " − τ = ", "{cut}", "."]),
    }),
    caption: "The direction probability is set with the slider.",
  }),
  tex: Object.freeze({
    definition: "\\class{prx-err}{e_{AB}} = \\Pr(\\theta_A \\le \\theta_B \\mid Y)",
    eAB: "\\class{prx-err}{e_{AB}}",
    eBA: "\\class{prx-err}{e_{BA}}",
    piAB: "\\pi_{AB}",
    marker: "\\pi_{AB}",
  }),
});

const CSS = `.prx-one-pair .prx-controls {
  align-items: flex-start;
}

@media (max-width: 30em) {
  .prx-one-pair .prx-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 0.7rem;
    align-items: end;
  }
  .prx-one-pair .prx-controls > .prx-presets { grid-column: 1 / -1; }
}

.prx-one-pair .prx-one-pair-sym sub {
  font-size: 0.75em;
}

.prx-one-pair .prx-one-pair-head {
  margin: 0 0 0.25rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-one-pair .prx-one-pair-note {
  margin: 0.25rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}


.prx-one-pair .prx-one-pair-bridge {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
  min-width: 0;
}

.prx-one-pair .prx-one-pair-tex {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.prx-one-pair .prx-one-pair-tex math[display="block"] {
  margin: 0.25rem 0;
}


.prx-one-pair .prx-one-pair-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  min-width: 0;
}

.prx-one-pair .prx-one-pair-figure,
.prx-one-pair .prx-one-pair-costs,
.prx-one-pair .prx-one-pair-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-one-pair .prx-one-pair-figure {
  padding: 0.25rem 0.25rem 0.5rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border-radius: var(--prx-radius);
}


.prx-one-pair .prx-one-pair-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.25rem 0.25rem 0;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
}

.prx-one-pair .prx-one-pair-key {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.prx-one-pair .prx-one-pair-swatch {
  flex: 0 0 auto;
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
}

.prx-one-pair .prx-one-pair-swatch-shade {
  background: var(--prx-neutral-2);
  border: 1px solid var(--prx-cell-border);
}

.prx-one-pair .prx-one-pair-swatch-circle {
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
  background: var(--prx-plot-bg);
}

.prx-one-pair .prx-one-pair-swatch-ring {
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
  background: radial-gradient(circle, var(--prx-err) 0 32%, transparent 34%);
}

.prx-one-pair .prx-one-pair-costs table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
}

.prx-one-pair .prx-one-pair-costs caption {
  caption-side: top;
  padding: 0 0 0.35rem;
  text-align: left;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-one-pair .prx-one-pair-costs th,
.prx-one-pair .prx-one-pair-costs td {
  overflow-wrap: normal;
  word-break: normal;
  hyphens: manual;
  padding: 0.3rem 0.4rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
}

.prx-one-pair .prx-one-pair-costs thead th {
  font-weight: 600;
  border-bottom: 2px solid var(--prx-border-strong);
}

.prx-one-pair .prx-one-pair-costs tbody th {
  font-weight: 400;
}

.prx-one-pair .prx-one-pair-best th,
.prx-one-pair .prx-one-pair-best td {
  font-weight: 700;
  background: var(--prx-bg-sunken);
}

.prx-one-pair .prx-one-pair-best th {
  box-shadow: inset 3px 0 0 var(--prx-fg);
}

.prx-one-pair .prx-one-pair-costs td:nth-child(2) {
  white-space: nowrap;
}

.prx-one-pair .prx-one-pair-cost-err {
  color: var(--prx-err-text);
}

.prx-one-pair .prx-one-pair-cost-wh {
  color: var(--prx-wh-text);
}


.prx-one-pair .prx-one-pair-line {
  display: inline-block;
  width: 1.4rem;
  height: 0;
  margin: 0 0.4rem 0.2rem 0;
  vertical-align: middle;
  border-top: 3px solid var(--prx-err);
}

.prx-one-pair .prx-one-pair-line-ba {
  border-top-style: dashed;
}

.prx-one-pair .prx-one-pair-line-wh {
  border-top-color: var(--prx-wh);
}


.prx-one-pair .prx-one-pair-rule {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--prx-accent);
  background: var(--prx-bg-raised);
  border-radius: var(--prx-radius);
}

.prx-one-pair .prx-one-pair-rule p {
  margin: 0 0 0.4rem;
}

.prx-one-pair .prx-one-pair-rule-text {
  font-weight: 600;
}

.prx-one-pair .prx-one-pair-rule-text .prx-one-pair-note {
  font-weight: 400;
}`;

const T = CONFIG.text;

/** e_AB = 1 − π_AB on the slider grid (rounded so that grid values read back exactly). */
export const errorOf = (pi) => Number((CONFIG.wrongCost - pi).toFixed(CONFIG.cleanDigits));

/**
 * Everything the widget shows for one setting. The costs and the best actions come from the engine's closed form
 * (pairDecision); e_BA = 1 − e_AB = π_AB because the pair's posterior gives latent equality probability zero.
 */
export function compute({ pi, tau }) {
  const eAB = errorOf(pi);
  const eBA = pi;
  const d = pairDecision(eAB, eBA, tau);
  return { pi, tau, eAB, eBA, piBA: eAB, cut: errorOf(tau), costs: d.costs, best: d.best };
}

/** The key of a set of best actions: iAboveJ, jAboveI, withhold, iAboveJwithhold, jAboveIwithhold, all, other. */
export function bestKey(best) {
  const has = (a) => best.includes(a);
  if (best.length === CONFIG.actions.length) return "all";
  if (best.length === 1) return best[0];
  if (best.length === 2 && has("withhold") && has("iAboveJ")) return "iAboveJwithhold";
  if (best.length === 2 && has("withhold") && has("jAboveI")) return "jAboveIwithhold";
  return "other";
}

/** The bridge formula at one setting, and the raw values of its numbers in order. */
export function bridgeTex(r) {
  const f = formulaNums();
  const X = CONFIG.tex;
  const one = () => f.num(CONFIG.wrongCost, formatCount(CONFIG.wrongCost));
  const tex = `\\begin{aligned}${X.eAB} &= ${one()} - ${X.piAB} = ${one()} - ${f.num(r.pi, formatSetting(r.pi))} = ${f.num(r.eAB, formatProb(r.eAB, { digits: 2 }))} \\\\ `
    + `${X.eBA} &= ${one()} - ${X.eAB} = ${f.num(r.eBA, formatProb(r.eBA, { digits: 2 }))}\\end{aligned}`;
  return { tex, raws: f.raws };
}

/** The crossings of the figure for a τ: the rising and the flat line meet at e = τ, the falling and the flat at 1 − τ. */
export function crossings(tau) {
  const hi = errorOf(tau);
  if (Math.abs(hi - tau) <= Number.EPSILON) return [{ e: tau, y: tau, kind: "all" }];
  return [{ e: tau, y: tau, kind: "ab" }, { e: hi, y: tau, kind: "ba" }];
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, { preset: "pi85-tau10", ...spec }, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    // the shared result-first frame (review 044, X-01): sliders and the preset row, the read-out, then the cost chart
    // beside the cost table (the panel the sliders change), then the rule and the bridge; base.js only moves nodes
    layout: "result-first",
    keys: {
      pi: { type: "number", ...CONFIG.pi, snap: true },
      tau: { type: "number", ...CONFIG.tau, snap: true },
    },
    build(ctx) {
      const { h } = ctx;
      const C = CONFIG.chart;
      const sym = (letter, pair) => h("span", { class: "prx-one-pair-sym" }, letter, h("sub", {}, pair));
      const tagged = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => tagged(ctx.num(raw, display), name);
      const prob = (raw, name) => num(raw, formatProb(raw, { digits: 2 }), name);
      const setting = (raw, name) => num(raw, formatSetting(raw), name);
      const fill = (parts, slot) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slot[m[1]]() : p; });

      // --- controls
      const piSlider = ctx.slider({ label: T.piLabel, ...CONFIG.pi, value: ctx.state.pi, name: "pi", onInput: (v) => ctx.set({ pi: v }) });
      piSlider.input.setAttribute("aria-label", T.piName);
      const tauSlider = ctx.slider({ label: T.tauLabel, ...CONFIG.tau, value: ctx.state.tau, name: "tau", hint: T.tauHint.join(""), onInput: (v) => ctx.set({ tau: v }) });
      const tauHint = tauSlider.root.querySelector(".prx-hint");
      tauHint?.replaceChildren(...fill(T.tauHint, { one: () => ctx.num(CONFIG.wrongCost, formatCount(CONFIG.wrongCost)) }));
      ctx.controls.append(piSlider.root, tauSlider.root);
      ctx.primaryControl(piSlider.root);

      // --- bridge: the definition (static) and the numbers (live); review 044 repair (X-01): after the chart and the
      // rule box, no longer between the sliders and the read-out
      const definition = h("div", { class: "prx-one-pair-tex", "data-prx-tex": "definition" });
      const worked = h("div", { class: "prx-one-pair-tex", "data-prx-tex": "bridge" });
      const bridge = ctx.part("notes", h("section", { class: "prx-one-pair-bridge", "aria-label": T.bridgeHead },
        ctx.panelTitle(T.bridgeHead, { className: "prx-one-pair-head" }), definition, worked,
        h("p", { class: "prx-one-pair-note", text: T.bridgeNote })));
      ctx.scrollRegion(definition, "Definition of the error probability");
      ctx.scrollRegion(worked, "Direction probability and error probability");
      renderTex(definition, CONFIG.tex.definition, { display: true });

      // --- figure, legend and the cost table
      const chartSlot = h("div", { class: "prx-one-pair-chart" });
      const legend = ctx.part("legend", h("div", { class: "prx-one-pair-legend" },
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-shade", "aria-hidden": "true" }), T.legendShade),
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-circle", "aria-hidden": "true" }), T.legendCircle),
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-ring", "aria-hidden": "true" }), T.legendRing)));
      const figureBox = h("div", { class: "prx-one-pair-figure" }, chartSlot, legend);
      // the graphic the sliders move (base.js primaryGraphic): the marker, its dots and rings
      ctx.primaryGraphic(figureBox);
      const costTable = ctx.part("table", h("div", { class: "prx-one-pair-costs" }));
      const grid = h("div", { class: "prx-one-pair-grid" }, figureBox, costTable);

      // --- rule box: review 044 repair (X-01), directly after the chart and the cost table (it was after the read-out,
      // which now sits under the sliders), then the bridge
      const ruleHere = h("p", { class: "prx-one-pair-rule-here" });
      const ruleBox = ctx.part("notes", h("section", { class: "prx-one-pair-rule", "aria-label": T.ruleHead },
        ctx.panelTitle(T.ruleHead, { className: "prx-one-pair-head" }),
        h("p", { class: "prx-one-pair-rule-text" }, ...fill(T.rule, { one: () => num(CONFIG.wrongCost, formatCount(CONFIG.wrongCost)) }), " ",
          h("span", { class: "prx-one-pair-note", text: T.ruleGloss })),
        ruleHere));
      // Keep the exact cost explanation with the worked rule, outside the short control-to-figure path.
      if (tauHint) ruleBox.append(tauHint);
      ctx.charts.append(grid, ruleBox, bridge);
      // base.css puts the parentheses around a caption that is the only element in the caption line
      ctx.caption.replaceChildren(T.caption, " (", captionNode(ctx, "teaching-posterior"), ")");

      // --- drawing
      function drawChart(r) {
        const width = Math.max(1, Math.round(chartSlot.clientWidth || ctx.width()));
        const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
        const innerH = Math.max(1, C.height - C.marginTop - C.marginBottom);
        const lineAB = [{ e: 0, c: 0 }, { e: 1, c: CONFIG.wrongCost }];
        const lineBA = [{ e: 0, c: CONFIG.wrongCost }, { e: 1, c: 0 }];
        const lineWH = [{ e: 0, c: r.tau }, { e: 1, c: r.tau }];
        const cross = crossings(r.tau);
        const envelope = [{ e: 0, c: 0 }, ...cross.map((x) => ({ e: x.e, c: x.y })), { e: 1, c: 0 }];
        const costAt = { iAboveJ: r.eAB, jAboveI: r.eBA, withhold: r.tau };
        const dots = CONFIG.actions.map((a) => ({ a, e: r.eAB, c: costAt[a], best: r.best.includes(a) }));
        // "equally good" labels under the flat line (see CONFIG.chart); none when the crossings are too low
        let eqLabels = [];
        const mid = (text) => [{ e: CONFIG.half, c: C.middle * r.tau, text, anchor: "middle", dx: 0, dy: 0 }];
        if (cross.length === 1) eqLabels = mid(T.equalAll);
        else if (r.tau * innerH < C.lowPx) eqLabels = [];
        else if ((cross[1].e - cross[0].e) * innerW < C.gapPx) eqLabels = mid(T.equal);
        else {
          eqLabels = [
            { e: cross[0].e, c: cross[0].y, text: T.equal, anchor: "start", dx: C.sideDx, dy: C.belowDy },
            { e: cross[1].e, c: cross[1].y, text: T.equal, anchor: "end", dx: -C.sideDx, dy: C.belowDy },
          ];
        }
        const lineLabels = [
          { e: C.labelAB, c: C.labelAB, text: T.lineAB, anchor: "end", dx: -C.labelDx, dy: C.labelDy },
          { e: C.labelBA, c: 1 - C.labelBA, text: T.lineBA, anchor: "start", dx: C.labelDx, dy: C.labelDy },
          { e: 1, c: r.tau, text: T.lineWH, anchor: "end", dx: C.whLabelDx, dy: C.whLabelDy },
        ];
        const markerAnchor = r.eAB < C.markerEdge ? "start" : r.eAB > (width < 450 ? .76 : .87) ? "end" : "middle";
        const piTicks = [0, .25, .5, .75, 1].map(e => ({ e, pi: 1 - e }));
        const rows = [
          ...cross.map((x) => ({
            where: x.kind === "all" ? T.rowCrossAll : x.kind === "ab" ? T.rowCrossAB : T.rowCrossBA,
            e: x.e,
            best: x.kind === "all" ? [T.actionWords.iAboveJ, T.actionWords.jAboveI, T.actionWords.withhold].join(", ")
              : x.kind === "ab" ? `${T.actionWords.iAboveJ}, ${T.actionWords.withhold}` : `${T.actionWords.jAboveI}, ${T.actionWords.withhold}`,
          })),
          { where: T.rowCurrent, e: r.eAB, best: r.best.map((a) => T.actionWords[a]).join(", ") },
        ];
        const halo = (k) => ({ stroke: k.plotBg, strokeWidth: C.halo, paintOrder: "stroke" });
        plot(chartSlot, {
          alt: T.alt,
          table: {
            caption: T.tableCaption,
            columns: [
              { label: T.colWhere, value: "where" },
              { label: T.colError, value: "e", format: (v) => formatProb(v, { digits: 2 }) },
              { label: T.colBest, value: "best" },
            ],
            rows,
          },
          keyboard: {
            data: [
              ...dots.map((d) => ({ ...d, text: `${T.actionWords[d.a]}: expected cost ${formatSetting(d.c)}${d.best ? " (lowest)" : ""}` })),
              ...rows.slice(0, -1).map((d) => ({ e: d.e, c: r.tau, text: `${d.where}: error ${formatProb(d.e, { digits: 2 })}; ${d.best} equally good` })),
            ], x: "e", y: "c", sort: false, label: "Actions at the current pair and equal-cost crossings", title: (d) => d.text,
          },
          width, height: C.height,
          marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
          x: { domain: [0, 1], ticks: C.ticks, label: T.xLabel, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [0, CONFIG.wrongCost], ticks: C.ticks, label: T.yLabel, labelAnchor: "center", labelArrow: "none" },
          color: { type: "identity" },
          marks: (k, P) => [
            P.ruleY([1], { x1: 0, x2: 1, stroke: k.plotAxis }),
            P.ruleX(piTicks, { x: "e", y1: 1, y2: 1.025, stroke: k.plotAxis }),
            numText(piTicks, {
              x: "e", y: 1, dy: -11, value: "pi",
              format: formatSetting,
              render(index, scales, values, dims, context, next) {
                const group = next(index, scales, values, dims, context);
                group.setAttribute("data-prx-pi-scale", "");
                return group;
              },
            }),
            P.text([0], { x: e => e, y: 1, dy: -11, dx: -14, text: () => "π", fill: k.plotFg }),
            P.areaY(envelope, { x: "e", y: "c", fill: k.neutral[1], fillOpacity: C.envelopeOpacity }),
            P.ruleY([0], { stroke: k.plotAxis }),
            P.lineY(lineWH, { x: "e", y: "c", stroke: k.wh, strokeWidth: C.line }),
            P.lineY(lineBA, { x: "e", y: "c", stroke: k.err, strokeWidth: C.line, strokeDasharray: C.dash }),
            P.lineY(lineAB, { x: "e", y: "c", stroke: k.err, strokeWidth: C.line }),
            P.ruleX([r.eAB], { y1: 0, y2: CONFIG.wrongCost, stroke: k.plotFg, strokeDasharray: C.rule }),
            P.dot(cross, { x: "e", y: "y", r: C.circle, fill: k.plotBg, stroke: k.plotFg, strokeWidth: C.ringWidth }),
            P.dot(dots.filter((d) => d.best), { x: "e", y: "c", r: C.ring, fill: "none", stroke: k.plotFg, strokeWidth: C.ringWidth }),
            P.dot(dots, { x: "e", y: "c", r: C.dot, fill: (d) => (d.a === "withhold" ? k.wh : k.err), stroke: k.plotBg }),
            ...lineLabels.map((d) => P.text([d], { x: "e", y: "c", text: "text", dx: d.dx, dy: d.dy, textAnchor: d.anchor, fill: k.plotFg, fontWeight: "bold", ...halo(k) })),
            ...eqLabels.map((d) => P.text([d], { x: "e", y: "c", text: "text", dx: d.dx, dy: d.dy, textAnchor: d.anchor, fill: k.plotFg, ...halo(k) })),
          ],
          formulas: [{
            key: "marker", tex: `${CONFIG.tex.marker} = \\text{${formatProb(r.pi, { digits: 2 })}} \\;\\to\\; e_{AB} = \\text{${formatProb(r.eAB, { digits: 2 })}}`, num: r.eAB,
            x: r.eAB, y: C.markerTop, dy: C.markerDy, anchor: markerAnchor,
          }],
        });
        const marker = chartSlot.querySelector('[data-prx-formula="marker"]');
        if (marker) marker.setAttribute("data-prx-readout", "marker");
      }

      function drawCostTable(r) {
        const rowOf = (action, label, symbol, raw, cls, display, name) => {
          const best = r.best.includes(action);
          return h("tr", { class: best ? "prx-one-pair-best" : null },
            h("th", { scope: "row" }, h("span", { class: `prx-one-pair-line prx-one-pair-line-${cls}`, "aria-hidden": "true" }), label),
            h("td", { class: `prx-one-pair-cost-${cls === "wh" ? "wh" : "err"}` }, symbol, " = ", num(raw, display, name)),
            h("td", { text: best ? (r.best.length > 1 ? T.smallestEqual : T.smallest) : "" }));
        };
        costTable.replaceChildren(h("table", {},
          h("caption", { text: T.costCaption }),
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.colAction }), h("th", { scope: "col", text: T.colCost }), h("th", { scope: "col", text: T.colSmallest }))),
          h("tbody", {},
            rowOf("iAboveJ", T.rowAB, sym("e", "AB"), r.costs.iAboveJ, "ab", formatProb(r.costs.iAboveJ, { digits: 2 }), "cost-ab"),
            rowOf("jAboveI", T.rowBA, sym("e", "BA"), r.costs.jAboveI, "ba", formatProb(r.costs.jAboveI, { digits: 2 }), "cost-ba"),
            rowOf("withhold", T.rowWH, "τ", r.costs.withhold, "wh", formatSetting(r.costs.withhold), "cost-wh"))));
      }

      function drawRule(r) {
        const key = bestKey(r.best);
        ruleHere.replaceChildren(...fill(T.ruleHere[key], {
          one: () => ctx.num(CONFIG.wrongCost, formatCount(CONFIG.wrongCost)),
          cut: () => setting(r.cut, "cut"),
          piAB: () => sym("π", "AB"), piBA: () => sym("π", "BA"),
          pi: () => setting(r.pi, "rule-pi"), piRev: () => prob(r.piBA, "rule-pi-ba"),
        }));
      }

      function drawReadout(r) {
        const key = bestKey(r.best);
        const slots = {
          piAB: () => sym("π", "AB"), eAB: () => sym("e", "AB"), eBA: () => sym("e", "BA"),
          pi: () => setting(r.pi, "pi"), tau: () => setting(r.tau, "tau"),
          e: () => prob(r.eAB, "e-ab"), eRev: () => prob(r.eBA, "e-ba"),
          list: () => r.best.map((a) => T.actionWords[a]).join(", "),
        };
        // each number appears once in the read-out: the best sentence names the cost by a second node without a hook
        const second = {
          ...slots,
          e: () => prob(r.eAB, "best-cost"), eRev: () => prob(r.eBA, "best-cost"), tau: () => setting(r.tau, "best-cost"),
        };
        ctx.readout.set([...fill(T.readSetting, slots), ...fill(T.readBest[key], second)]);
      }

      function drawBridge(r) {
        const b = bridgeTex(r);
        renderTex(worked, b.tex, { display: true, nums: b.raws });
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            piSlider.set(state.pi);
            tauSlider.set(state.tau);
            const r = compute(state);
            drawBridge(r);
            drawCostTable(r);
            drawRule(r);
            drawReadout(r);
            drawChart(r);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
