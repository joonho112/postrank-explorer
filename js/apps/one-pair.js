// One pair: all linked cost, bridge and rule views; probabilities and choices from pairDecision.
import { createWidget } from "../shared/base.js";
import { numText, placeDirectLabels, plot } from "../shared/chart.js";
import { formatCount, formatProb, formatSetting } from "../shared/format.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
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
    height: 296, mobileHeight: 276, mobileBreak: 520,
    marginTop: 68, marginRight: 18, marginBottom: 42, marginLeft: 56, ticks: 5, yLabelOffset: 42, xLabelOffset: 36,
    line: 2.25, dash: "7,4", envelopeOpacity: 0.85, rule: "3,3", dot: 4.5, ring: 7.5, ringWidth: 2, circle: 5.5,
    // direct labels placed inside the plot region via placeDirectLabels, clear of y = e, y = 1.0, and top-left crossings
    labelBA: 0.17, labelAB: 0.72, mobileLabelABX: 0.98, mobileLabelABY: 0.40,
    labelDx: 8, labelDy: -6, abDesktopDx: 10, abDesktopDy: 5, abMobileDx: -4, abMobileDy: 0,
    whLabelDx: -6, whLabelDy: -8, minLabelGap: 18, halo: 3.5,
    // "equally good" labels under the flat line, beside each crossing on the side away from the lines
    sideDx: 6, belowDy: 15, lowPx: 30, gapPx: 175, middle: 0.5,
    // dedicated top headroom separating the live marker formula, complementary π scale, and 1.0 y-tick
    piDy: -17, piTitleDx: -20, markerTop: 1, markerDy: -45, markerEdge: 0.08,
  }),
  text: Object.freeze({
    piLabel: "Direction probability π of A above B",
    piName: "Direction probability that A's true value is larger than B's",
    tauLabel: "Withholding cost τ",
    // the hint as parts: {one} is the cost of a wrong direction, a data-num node
    tauHint: Object.freeze(["A wrong stated direction costs ", "{one}", "; staying silent on the pair costs τ."]),
    dataBoxTitle: "Data and action costs",
    methodBoxTitle: "Method and decision rule",
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
    // concise Frame v2 read-out (<= 30 words, preserving all 5 hooks and /equally good/ tie phrases)
    readSetting: Object.freeze(["At ", "{piAB}", " = ", "{pi}", " and τ = ", "{tau}", " (", "{eAB}", " = ", "{e}", ", ", "{eBA}", " = ", "{eRev}", "), "]),
    readBest: Object.freeze({
      iAboveJ: Object.freeze(["stating A above B is best (cost ", "{e}", " below τ)."]),
      jAboveI: Object.freeze(["stating B above A is best (cost ", "{eRev}", " below τ)."]),
      withhold: Object.freeze(["both errors exceed τ, so withholding is best (cost ", "{tau}", ")."]),
      iAboveJwithhold: Object.freeze(["stating A above B and withholding are equally good (cost ", "{tau}", ")."]),
      jAboveIwithhold: Object.freeze(["stating B above A and withholding are equally good (cost ", "{tau}", ")."]),
      all: Object.freeze(["all three actions are equally good (cost ", "{tau}", ")."]),
      other: Object.freeze(["best actions: ", "{list}", "."]),
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

const CSS = `.prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  align-items: flex-end;
  flex: 1 1 27rem;
}

.prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
  flex: 1 1 12rem;
  max-width: 16.5rem;
}

.prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-stage {
  grid-area: auto;
  min-width: 0;
}

@media (max-width: 30em) {
  .prx-one-pair.prx-widget[data-prx-frame="v2"] {
    padding: 0.45rem 0.55rem 0.4rem;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.45rem;
    margin-bottom: 0.35rem;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.55rem;
    align-items: end;
    flex: 1 1 100%;
    width: 100%;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
    max-width: none;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.18rem 0.48rem;
    font-size: 0.8125rem;
    line-height: 1.25;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.4rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.35;
  }
  .prx-one-pair.prx-widget[data-prx-frame="v2"] .prx-stage {
    padding: 0.4rem 0.45rem;
  }
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

.prx-one-pair .prx-one-pair-chart,
.prx-one-pair .prx-one-pair-costs {
  min-width: 0;
  max-width: 100%;
}

.prx-one-pair .prx-stage .prx-one-pair-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
  margin: 0.35rem 0.15rem 0;
  font-size: 0.8125rem;
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

.prx-one-pair .prx-stage .prx-one-pair-swatch-shade {
  background: var(--prx-neutral-2);
  border: 1px solid var(--prx-cell-border);
}

.prx-one-pair .prx-stage .prx-one-pair-swatch-circle {
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
  background: var(--prx-plot-bg);
}

.prx-one-pair .prx-stage .prx-one-pair-swatch-ring {
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
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--prx-accent);
  background: var(--prx-bg-raised);
  border-radius: var(--prx-radius);
}

.prx-one-pair .prx-one-pair-rule p {
  margin: 0 0 0.4rem;
}

.prx-one-pair .prx-one-pair-rule p:last-child {
  margin-bottom: 0;
}

.prx-one-pair .prx-one-pair-rule-text {
  font-weight: 600;
}

.prx-one-pair .prx-one-pair-rule-text .prx-one-pair-note {
  font-weight: 400;
}

.prx-one-pair .prx-one-pair-bridge {
  margin: 0;
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
    frame: "v2",
    keys: {
      pi: { type: "number", ...CONFIG.pi, snap: true },
      tau: { type: "number", ...CONFIG.tau, snap: true },
    },
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);
      const C = CONFIG.chart;
      const sym = (letter, pair) => h("span", { class: "prx-one-pair-sym" }, letter, h("sub", {}, pair));
      const num = (raw, display, hook) => writer.num(raw, display, hook ? { hook } : undefined);
      const prob = (raw, hook) => num(raw, formatProb(raw, { digits: 2 }), hook);
      const setting = (raw, hook) => writer.setting(raw, hook ? { hook } : undefined);
      const fill = (parts, slot) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slot[m[1]]() : p; });

      // --- primary controls in toolbar
      const piSlider = ctx.slider({ label: T.piLabel, ...CONFIG.pi, value: ctx.state.pi, name: "pi", onInput: (v) => ctx.set({ pi: v }) });
      piSlider.input.setAttribute("aria-label", T.piName);
      const tauSlider = ctx.slider({ label: T.tauLabel, ...CONFIG.tau, value: ctx.state.tau, name: "tau", hint: T.tauHint.join(""), onInput: (v) => ctx.set({ tau: v }) });
      const tauHint = tauSlider.root.querySelector(".prx-hint");
      tauHint?.replaceChildren(...fill(T.tauHint, { one: () => writer.count(CONFIG.wrongCost) }));
      ctx.controls.append(piSlider.root, tauSlider.root);
      ctx.primaryControl(piSlider.root);

      // --- primary stage: generous full-width expected-cost figure + compact inline symbol key
      const chartSlot = h("div", { class: "prx-one-pair-chart" });
      const legend = ctx.part("legend", h("div", { class: "prx-one-pair-legend" },
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-shade", "aria-hidden": "true" }), T.legendShade),
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-circle", "aria-hidden": "true" }), T.legendCircle),
        h("span", { class: "prx-one-pair-key" }, h("span", { class: "prx-one-pair-swatch prx-one-pair-swatch-ring", "aria-hidden": "true" }), T.legendRing)));
      const actionCosts = h("p", { class: "prx-one-pair-rule", "data-prx-action-costs": "" });
      ctx.stage.append(chartSlot, legend, actionCosts);

      // --- Data disclosure: complete action-cost table eagerly rendered
      const dataBox = ctx.dataBox(T.dataBoxTitle);
      const costTable = ctx.part("table", h("div", { class: "prx-one-pair-costs" }));
      dataBox.body.append(costTable);

      // --- Method disclosure: isolated-pair decision rule + posterior-to-error bridge formulas
      const methodBox = ctx.methodBox(T.methodBoxTitle);
      const ruleHere = h("p", { class: "prx-one-pair-rule-here" });
      const ruleBox = ctx.part("notes", h("section", { class: "prx-one-pair-rule", "aria-label": T.ruleHead },
        ctx.panelTitle(T.ruleHead, { className: "prx-one-pair-head" }),
        h("p", { class: "prx-one-pair-rule-text" }, ...fill(T.rule, { one: () => writer.count(CONFIG.wrongCost) }), " ",
          h("span", { class: "prx-one-pair-note", text: T.ruleGloss })),
        ruleHere));
      if (tauHint) ruleBox.append(tauHint);

      const definition = h("div", { class: "prx-one-pair-tex", "data-prx-tex": "definition" });
      const worked = h("div", { class: "prx-one-pair-tex", "data-prx-tex": "bridge" });
      const bridge = ctx.part("notes", h("section", { class: "prx-one-pair-bridge", "aria-label": T.bridgeHead },
        ctx.panelTitle(T.bridgeHead, { className: "prx-one-pair-head" }), definition, worked,
        h("p", { class: "prx-one-pair-note", text: T.bridgeNote })));
      ctx.scrollRegion(definition, "Definition of the error probability");
      ctx.scrollRegion(worked, "Direction probability and error probability");
      renderTex(definition, CONFIG.tex.definition, { display: true });
      methodBox.body.append(ruleBox, bridge);

      ctx.caption.replaceChildren(T.caption, " (", captionNode(ctx, "teaching-posterior"), ").");

      // --- drawing
      function drawChart(r) {
        const width = Math.max(1, Math.round(chartSlot.clientWidth || ctx.stage.clientWidth || ctx.width()));
        const height = width < C.mobileBreak ? C.mobileHeight : C.height;
        const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
        const innerH = Math.max(1, height - C.marginTop - C.marginBottom);
        const lineAB = [{ e: 0, c: 0 }, { e: 1, c: CONFIG.wrongCost }];
        const lineBA = [{ e: 0, c: CONFIG.wrongCost }, { e: 1, c: 0 }];
        const lineWH = [{ e: 0, c: r.tau }, { e: 1, c: r.tau }];
        const cross = crossings(r.tau);
        const envelope = [{ e: 0, c: 0 }, ...cross.map((x) => ({ e: x.e, c: x.y })), { e: 1, c: 0 }];
        const costAt = { iAboveJ: r.eAB, jAboveI: r.eBA, withhold: r.tau };
        const dots = CONFIG.actions.map((a) => ({ a, e: r.eAB, c: costAt[a], best: r.best.includes(a) }));
        // "equally good" labels under the flat line; none when crossings sit too close to c = 0
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
        const yAt = (c) => C.marginTop + (CONFIG.wrongCost - c) * innerH;
        const abItem = width < C.mobileBreak
          ? { id: "ab", e: C.mobileLabelABX, c: C.mobileLabelABY, text: T.lineAB, anchor: "end", dx: C.abMobileDx, y: yAt(C.mobileLabelABY) + C.abMobileDy }
          : { id: "ab", e: C.labelAB, c: C.labelAB, text: T.lineAB, anchor: "start", dx: C.abDesktopDx, y: yAt(C.labelAB) + C.abDesktopDy };
        const placed = placeDirectLabels([
          { id: "ba", e: C.labelBA, c: CONFIG.wrongCost - C.labelBA, text: T.lineBA, anchor: "start", dx: C.labelDx, y: yAt(CONFIG.wrongCost - C.labelBA) + C.labelDy },
          abItem,
          { id: "wh", e: 1, c: r.tau, text: T.lineWH, anchor: "end", dx: C.whLabelDx, y: yAt(r.tau) + C.whLabelDy },
        ], {
          minGapPx: C.minLabelGap,
          minY: C.marginTop + 18,
          maxY: C.marginTop + innerH - 10,
        });
        const lineLabels = placed.map((d) => ({ ...d, dy: d.y - yAt(d.c) }));
        const markerAnchor = r.eAB < C.markerEdge ? "start" : r.eAB > (width < 450 ? 0.74 : 0.86) ? "end" : "middle";
        const piTicks = [0, 0.25, 0.5, 0.75, 1].map((e) => ({ e, pi: 1 - e }));
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
          width, height,
          marginTop: C.marginTop, marginRight: C.marginRight, marginBottom: C.marginBottom, marginLeft: C.marginLeft,
          x: { domain: [0, 1], ticks: C.ticks, label: T.xLabel, labelAnchor: "center", labelArrow: "none", labelOffset: C.xLabelOffset },
          y: { domain: [0, CONFIG.wrongCost], ticks: C.ticks, label: T.yLabel, labelAnchor: "center", labelArrow: "none", labelOffset: C.yLabelOffset },
          color: { type: "identity" },
          marks: (k, P) => [
            P.ruleY([1], { x1: 0, x2: 1, stroke: k.plotAxis }),
            P.ruleX(piTicks, { x: "e", y1: 1, y2: 1.03, stroke: k.plotAxis }),
            numText(piTicks, {
              x: "e", y: 1, dy: C.piDy, value: "pi",
              format: formatSetting,
              render(index, scales, values, dims, context, next) {
                const group = next(index, scales, values, dims, context);
                group.setAttribute("data-prx-pi-scale", "");
                return group;
              },
            }),
            P.text([0], { x: (e) => e, y: 1, dy: C.piDy, dx: C.piTitleDx, text: () => "π", fill: k.plotFg }),
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
        const rowOf = (action, label, symbol, raw, cls, display, hook) => {
          const best = r.best.includes(action);
          return h("tr", { class: best ? "prx-one-pair-best" : null },
            h("th", { scope: "row" }, h("span", { class: `prx-one-pair-line prx-one-pair-line-${cls}`, "aria-hidden": "true" }), label),
            h("td", { class: `prx-one-pair-cost-${cls === "wh" ? "wh" : "err"}` }, symbol, " = ", num(raw, display, hook)),
            h("td", { text: best ? (r.best.length > 1 ? T.smallestEqual : T.smallest) : "" }));
        };
        actionCosts.replaceChildren("A above B ", ctx.num(r.costs.iAboveJ, formatProb(r.costs.iAboveJ)),
          " · B above A ", ctx.num(r.costs.jAboveI, formatProb(r.costs.jAboveI)),
          " · Withhold ", ctx.num(r.costs.withhold, formatSetting(r.costs.withhold)), ".");
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
          one: () => writer.count(CONFIG.wrongCost),
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
        const second = {
          ...slots,
          e: () => prob(r.eAB, "best-cost"), eRev: () => prob(r.eBA, "best-cost"), tau: () => setting(r.tau, "best-cost"),
        };
        writer.set([...fill(T.readSetting, slots), ...fill(T.readBest[key], second)]);
      }

      function drawBridge(r) {
        const b = bridgeTex(r);
        renderTex(worked, b.tex, { display: true, nums: b.raws });
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          piSlider.set(state.pi);
          tauSlider.set(state.tau);
          const r = compute(state);
          drawBridge(r);
          drawCostTable(r);
          drawRule(r);
          drawReadout(r);
          drawChart(r);
        },
      };
    },
  });
}
