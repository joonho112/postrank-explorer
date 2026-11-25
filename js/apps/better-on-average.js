// App3.11: fixed reports evaluated on paired whole-state posterior draws. Scientific traces/summaries are public-engine outputs.
import { createWidget } from "../shared/base.js";
import { placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  blocksText, formatCount, formatGrades, formatProb, formatReadoutRisk,
  formatRisk, formatSci, formatShare, formatSigned,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  compareReportLosses, disclosure, errorArray, evaluateReport, exactOptimum,
  expectedRank, finiteLawDraws, finiteLawPairwise, gaussianDraws, rankSummaries,
  realizedWrong, strictOrder, tierGrades,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({ seed: { min: 1, max: 4294967295, value: 1 }, tieTol: 1e-12 });
const FINITE = Object.freeze({ states: [[20, 4], [0, 4]], probs: [0.3, 0.7] });
const U = SIX.tables.units;
const LAWS = {
  six: { ids: U.id, means: U.mean_A, sds: U.sd_A, E: errorArray(U.mean_A, U.sd_A, { ids: U.id, criteria: ["score_A"] }) },
  finite: { ids: ["A", "B"], means: rankSummaries(FINITE).means, E: finiteLawPairwise(FINITE.states, FINITE.probs, { ids: ["A", "B"], criteria: ["value"] }) },
};

const CSS = `
.prx-boa .prx-stage,
.prx-boa .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar { align-items: flex-end; gap: 0.3rem 0.65rem; margin-bottom: 0.4rem; }
.prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar > .prx-controls { flex: 1 1 100%; align-items: flex-end; gap: 0.4rem 0.75rem; }
.prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider { flex: 1 1 10.5rem; max-width: 15.5rem; }
.prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-number input { width: 4.5rem; }
.prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 0 1 auto; }
@media (min-width: 48.01em) {
  .prx-widget.prx-boa[data-prx-frame="v2"] .prx-presets > .prx-seg-label { font-size: 0.78rem; line-height: 1.15; margin-bottom: 0.1rem; }
  .prx-widget.prx-boa[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.28rem; }
  .prx-widget.prx-boa[data-prx-frame="v2"] .prx-presets .prx-seg { min-height: 1.85rem; padding: 0.16rem 0.46rem; font-size: 0.8125rem; line-height: 1.2; }
  .prx-widget.prx-boa[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { min-height: 1.85rem; padding: 0.14rem 0; }
}
.prx-boa .boa-main { min-width: 0; max-width: 100%; }
.prx-boa .boa-scatter { min-width: 0; max-width: 100%; }
.prx-boa .prx-stage .boa-stage-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.85rem;
  margin: 0.35rem 0 0;
  font-size: 0.84375rem;
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.prx-boa .prx-stage .boa-stage-strip > span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.prx-boa .prx-stage .boa-line {
  width: 1.15rem;
  border-top: 2px dashed var(--prx-plot-muted);
  display: inline-block;
}
.prx-boa .prx-stage .boa-ring {
  border: 2px solid var(--prx-plot-fg);
  border-radius: 50%;
  width: 0.75rem;
  height: 0.75rem;
  display: inline-block;
}
.prx-boa .boa-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.55rem 1rem;
  width: 100%;
  min-width: 0;
}
.prx-boa .boa-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 0.7rem;
  margin: 0 0 0.75rem;
}
.prx-boa .boa-card {
  min-width: 0;
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.55rem 0.65rem;
}
.prx-boa .boa-card h3 { font-size: 0.95rem; margin: 0 0 0.25rem; }
.prx-boa .boa-card p { margin: 0.25rem 0; }
.prx-boa .boa-note { margin: 0.35rem 0; font-size: 0.875rem; color: var(--prx-fg-muted); }
.prx-boa .boa-warning { padding: 0.45rem 0.6rem; border-left: 3px solid var(--prx-accent); margin: 0.35rem 0 0.6rem; }
.prx-boa .boa-stat { font-variant-numeric: tabular-nums; margin: 0.5rem 0; }
.prx-boa .boa-detail { overflow-x: auto; max-width: 100%; min-width: 0; }
.prx-boa .boa-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.prx-boa .boa-table th,
.prx-boa .boa-table td { padding: 0.3rem 0.45rem; text-align: right; border-bottom: 1px solid var(--prx-border); }
.prx-boa .boa-table th:first-child { text-align: left; white-space: nowrap; }
.prx-boa .boa-tie-table { width: max-content; max-width: none; }
.prx-boa .boa-tie-table th,
.prx-boa .boa-tie-table td { white-space: nowrap; }
.prx-boa .boa-tie-table caption { text-align: left; }
@media (max-width: 48em) {
  .prx-boa .prx-btn,
  .prx-boa select,
  .prx-boa input[type="number"],
  .prx-boa .prx-toggle {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
`;

export function comparisonModel(s) {
  const L = LAWS[s.law];
  const cap = s.family === "cap3" ? 3 : 2;
  const family = s.law === "finite" ? { kind: "all" } : { kind: "atMost", G: cap };
  const optimum = exactOptimum(L.E, { tau: s.tau, family });
  const index = Math.min(s.optimum, optimum.grades.length - 1);
  const best = optimum.grades[index];
  let rule;
  let ruleName;
  if (s.rule === "withheld") { rule = L.ids.map(() => 1); ruleName = "All-withheld report"; }
  else if (s.rule === "self") { rule = best; ruleName = "The same report"; }
  else if (s.rule === "rank") { rule = strictOrder(expectedRank(L.E), { direction: "ascending" }); ruleName = "Strict expected-rank order"; }
  else { const G = Math.min(L.ids.length, cap + (s.outside && s.law === "six" ? 1 : 0)); rule = tierGrades(L.means, G, { direction: "descending" }); ruleName = "Fixed posterior-mean tiers"; }
  const bestEval = evaluateReport(best, L.E, { tau: s.tau });
  const ruleEval = evaluateReport(rule, L.E, { tau: s.tau });
  const admitted = s.law === "finite" || disclosure(rule).G <= cap;
  // Exact public-engine risk contrast. No empirical re-selection or alternate loss is introduced.
  const exactGap = ruleEval.risk - bestEval.risk;
  return { L, family, optimum, index, best, rule, ruleName, bestEval, ruleEval, admitted, exactGap };
}

export function comparisonDraws(s, m) {
  return s.law === "six" ? gaussianDraws(m.L.means, m.L.sds, s.S, s.seed)
    : Array.from(finiteLawDraws(FINITE.probs, s.S, s.seed), (i) => FINITE.states[i]);
}

function axisTicks(top, maxTicks) {
  const candidates = [0.02, 0.04, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.5];
  const step = candidates.find((c) => Math.floor(top / c) + 1 <= maxTicks) ?? 0.5;
  const out = [];
  for (let k = 0; k * step <= top + 1e-9; k += 1) out.push(Number((k * step).toFixed(4)));
  return out;
}

function appendSvgPill(doc, layer, { x, y, parts, bold = false, anchor = "start", maxWidth = 160, pal, dataNumFn }) {
  const fullText = parts.map((p) => (typeof p === "string" ? p : p.text)).join("");
  const estWidth = Math.min(maxWidth, Math.ceil(fullText.length * 7.2 + 11));
  const rx = anchor === "end" ? x - estWidth + 4 : x - 4;
  const tx = anchor === "end" ? x : x + 1;
  layer.append(
    svgEl(doc, "rect", {
      x: rx,
      y: y - 10,
      width: estWidth,
      height: 20,
      rx: 3,
      fill: pal.plotBg,
      fillOpacity: 0.94,
      stroke: pal.plotGrid,
      strokeWidth: 0.75,
    }),
  );
  const textNode = svgEl(doc, "text", {
    x: tx,
    y,
    textAnchor: anchor,
    dominantBaseline: "central",
    fontSize: 13,
    fontWeight: bold ? 600 : 500,
    fill: pal.plotFg,
  });
  for (const p of parts) {
    if (typeof p === "string") textNode.append(doc.createTextNode(p));
    else textNode.append(svgEl(doc, "tspan", { "data-num": dataNumFn(p.raw), text: p.text }));
  }
  layer.append(textNode);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "better-on-average",
    className: "prx-boa",
    css: CSS,
    frame: "v2",
    keys: {
      law: { type: "choice", values: ["six", "finite"], value: "six" },
      family: { type: "choice", values: ["cap2", "cap3"], value: "cap2" },
      rule: { type: "choice", values: ["tiers", "rank", "withheld", "self"], value: "tiers" },
      outside: { type: "boolean", value: false },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      S: { type: "integer", min: 1, max: 1000, value: 100 },
      seed: { type: "integer", ...CONFIG.seed },
      draw: { type: "integer", min: 1, max: 1000, value: 1 },
      optimum: { type: "integer", min: 0, max: 10000, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, fmt = formatCount) => {
        const n = ctx.num(raw, fmt(raw));
        n.dataset.prxReadout = name;
        return n;
      };
      const signedExact = (x) => formatSigned(x, { digits: 5 });
      const signedReadout = (x) => formatReadoutRisk(x, { signed: true });
      const probability = (x) => formatProb(x);
      const mcseFormat = (x) => (x === null ? "NA" : x === 0 ? "0" : x < 0.00005 ? formatSci(x) : formatRisk(x));

      // Primary controls (kept to 2 handles in ctx.controls)
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        name: "tau",
        onInput: (v) => ctx.set({ tau: v, optimum: 0 }),
      });
      const draw = ctx.numberInput({
        label: "Draw",
        min: 1,
        max: ctx.state.S,
        step: 1,
        value: ctx.state.draw,
        name: "draw",
        onInput: (v) => ctx.set({ draw: v }),
      });
      ctx.controls.append(ctx.primaryControl(tau.root), draw.root);

      // Secondary controls in Settings disclosure
      const law = ctx.select({
        label: "Conditional law",
        name: "law",
        options: [
          { value: "six", label: "Six sites: independent normals" },
          { value: "finite", label: "Two-unit law: two states" },
        ],
        value: ctx.state.law,
        onChange: (v) => ctx.set({
          law: v,
          rule: v === "finite" ? "rank" : "tiers",
          outside: false,
          family: "cap2",
          optimum: 0,
          draw: 1,
          tau: v === "finite" ? 0.25 : 0.2,
        }),
      });
      const rule = ctx.select({
        label: "Common rule",
        name: "rule",
        options: [
          { value: "tiers", label: "Posterior-mean tiers" },
          { value: "rank", label: "Strict expected-rank order" },
          { value: "withheld", label: "All withheld" },
          { value: "self", label: "Same report as the optimum" },
        ],
        value: ctx.state.rule,
        onChange: (v) => ctx.set({ rule: v, outside: false }),
      });
      const family = ctx.select({
        label: "Family optimized",
        name: "family",
        options: [
          { value: "cap2", label: "At most two grades" },
          { value: "cap3", label: "At most three grades" },
        ],
        value: ctx.state.family,
        onChange: (v) => ctx.set({ family: v, optimum: 0 }),
      });
      const outside = ctx.toggle({
        label: "Use one more posterior-mean tier, outside this cap",
        name: "outside",
        checked: ctx.state.outside,
        onChange: (v) => ctx.set({ outside: v }),
      });
      const S = ctx.numberInput({
        label: "Whole-state draws S",
        ...ctx.key("S"),
        name: "S",
        onInput: (v) => ctx.set({ S: v }),
      });
      const seed = ctx.numberInput({
        label: "Seed",
        ...ctx.key("seed"),
        name: "seed",
        onInput: (v) => ctx.set({ seed: v }),
      });
      const redraw = ctx.button({
        label: "Next seed",
        key: "next-seed",
        onClick: () => ctx.set({ seed: ctx.state.seed === CONFIG.seed.max ? CONFIG.seed.min : ctx.state.seed + 1 }),
      });
      const previous = ctx.button({
        label: "Previous draw",
        key: "previous-draw",
        onClick: () => ctx.set({ draw: Math.max(1, ctx.state.draw - 1) }),
      });
      const next = ctx.button({
        label: "Next draw",
        key: "next-draw",
        onClick: () => ctx.set({ draw: Math.min(ctx.state.S, ctx.state.draw + 1) }),
      });
      const choice = h("select", { "aria-label": "Equal-risk optimum followed", name: "optimum", "data-prx-focus-key": "select:optimum" });
      ctx.listen(choice, "change", () => ctx.set({ optimum: Number(choice.value) }));
      const tiedChoice = h("div", { class: "prx-control prx-select" }, h("label", {}, "Optimum followed", choice));

      const settings = ctx.settingsBox("Settings");
      settings.body.append(
        h("div", { class: "boa-settings-grid" }, law.root, rule.root, family.root, outside.root),
        h("div", { class: "boa-settings-grid" }, S.root, seed.root, redraw.root, previous.root, next.root, tiedChoice),
      );

      // Primary stage
      const scatter = h("div", { class: "boa-scatter" });
      const stageStrip = h("p", { class: "boa-stage-strip", "data-prx-part": "legend" });
      const stageMain = h("div", { class: "boa-main" }, scatter, stageStrip);
      ctx.primaryGraphic(scatter);
      ctx.stage.append(stageMain);

      // Disclosures: Data & Method
      const dataBox = ctx.dataBox("Data, draw table and rule cards");
      const cards = h("div", { class: "boa-cards" });
      const summary = h("div", { class: "boa-stat" });
      const chosen = h("div");
      const tieTableWrap = h("div");
      stageMain.append(cards);
      dataBox.body.append(summary, chosen, tieTableWrap);

      const methodBox = ctx.methodBox("Method and why expectation governs choice");
      const condition = h("p", { class: "boa-warning" });
      const lawNote = h("p", { class: "boa-note" });
      const methodNotes = h("div");
      methodBox.body.append(condition, lawNote, methodNotes);

      const cache = new Map();
      let rendered = "";

      const card = (title, g, ev, L, bestResult = null) => h(
        "section",
        { class: "boa-card", "data-report": bestResult ? "best" : "rule" },
        h("h3", { text: title }),
        h("p", {}, blocksText(g, L.ids)),
        h("p", { class: "boa-note" }, "Grade vector ", ro("grades", g, formatGrades)),
        h("p", {}, bestResult ? tagNode(ctx, bestResult) : captionNode(ctx, "fixed-report"), "."),
        h(
          "p",
          {},
          "Discloses ", ro("N", ev.N), " of ", ro("M", ev.M),
          " pairs; expected wrong share ", ro("EoverN", ev.EoverN[0], formatShare),
          "; conditional risk ", ro("risk", ev.risk, formatRisk), ".",
        ),
      );

      function show(s, m, sim) {
        const { L } = m;
        const q = s.draw - 1;

        cards.replaceChildren(
          card("Best report followed", m.best, m.bestEval, L, m.optimum),
          card(m.ruleName, m.rule, m.ruleEval, L),
        );
        if (m.bestEval.N !== m.ruleEval.N) {
          cards.append(h("p", { class: "boa-note" }, captionNode(ctx, "different-disclosure"), "."));
        }

        condition.replaceChildren(
          m.admitted
            ? "The common rule belongs to the searched family, so its expected reporting loss cannot beat the family optimum beyond numerical tolerance—yet it can still have lower realized loss on individual draws."
            : "The search excluded the common rule because it uses more grades than the family cap; the optimum minimizes expected loss only within the restricted family.",
        );

        ctx.readout.set([
          "Best risk ", ctx.num(m.bestEval.risk, formatReadoutRisk(m.bestEval.risk)),
          " vs. rule ", ctx.num(m.ruleEval.risk, formatReadoutRisk(m.ruleEval.risk)),
          " (exact gap ", ro("exactGap", m.exactGap, signedReadout), "). Across ",
          ro("S", s.S), s.S === 1 ? " paired draw, mean difference is " : " paired draws, mean difference is ",
          ro("meanDelta", sim.compare.meanDelta, signedReadout), "; the rule wins ",
          ro("ruleWins", sim.compare.ruleWins), " (", ro("ruleWinShare", sim.compare.ruleWinShare, formatShare), ").",
        ]);

        const rows = sim.draws.map((theta, i) => ({
          draw: i + 1,
          best: sim.compare.lossBest[i],
          rule: sim.compare.lossRule[i],
          delta: sim.compare.delta[i],
        }));
        const pointCounts = new Map();
        for (const row of rows) {
          const pKey = JSON.stringify([row.best, row.rule]);
          const point = pointCounts.get(pKey) ?? { ...row, count: 0 };
          point.count += 1;
          pointCounts.set(pKey, point);
        }
        const points = [...pointCounts.values()];
        const showCounts = points.length <= 6 && points.some((p) => p.count > 1);
        const dotRadius = (p) => Math.min(14, Math.max(4, 1.7 * Math.sqrt(p.count)));
        const countLabel = (p) => `${formatCount(p.count)} ${p.count === 1 ? "draw" : "draws"}: ${Math.abs(p.delta) <= CONFIG.tieTol
          ? "equal loss"
          : `${p.delta > 0 ? "best report" : "common rule"} better by ${formatRisk(Math.abs(p.delta))}`}`;
        const bestMean = sim.compare.lossBest.reduce((total, loss) => total + loss, 0) / rows.length;
        const average = { best: bestMean, rule: bestMean + sim.compare.meanDelta };
        const expectation = { best: m.bestEval.risk, rule: m.ruleEval.risk };
        const top = Math.min(
          1.05,
          Math.max(
            0.1,
            ...sim.compare.lossBest,
            ...sim.compare.lossRule,
            average.best,
            average.rule,
            expectation.best,
            expectation.rule,
          ) * 1.12,
        );

        const w = Math.max(250, Math.round(scatter.clientWidth || ctx.width()));
        const narrow = w < 520;
        const marginLeft = 52;
        const marginRight = narrow ? 126 : 168;
        const marginTop = 20;
        const marginBottom = 42;
        const height = narrow ? 270 : 360;
        const xyTicks = axisTicks(top, narrow ? 3 : 6);
        const selectedKey = JSON.stringify([rows[q].best, rows[q].rule]);
        const selectedPoint = { ...rows[q], count: pointCounts.get(selectedKey).count };

        const chart = plot(scatter, {
          width: w,
          height,
          marginTop,
          marginLeft,
          marginBottom,
          marginRight,
          alt: "One point per whole-state posterior draw: best report's realized total reporting loss horizontally, common rule's vertically. Below the dashed diagonal the common rule wins. A larger dot represents more draws at the same losses; arrow keys read every draw. The ring follows the selected draw. The cross marks the sample mean and the star marks the exact conditional expectation.",
          table: {
            caption: "Paired realized reporting losses, one row for every draw",
            columns: [
              { label: "Draw", value: "draw", format: (v) => formatCount(v) },
              { label: "Best report loss", value: "best", format: (v) => formatRisk(v) },
              { label: "Common rule loss", value: "rule", format: (v) => formatRisk(v) },
              { label: "Rule minus best", value: "delta", format: signedExact },
            ],
            rows,
          },
          r: { type: "identity" },
          x: { domain: [0, top], ticks: xyTicks, label: "Best report: realized loss", labelAnchor: "center", labelArrow: "none", grid: true },
          y: { domain: [0, top], ticks: xyTicks, label: "Common rule: realized loss", labelAnchor: "center", labelArrow: "none", grid: true },
          marks: (c, P) => [
            P.line([{ x: 0, y: 0 }, { x: top, y: top }], { x: "x", y: "y", stroke: c.plotMuted, strokeDasharray: "5,3", strokeWidth: 1.5 }),
            P.dot(points, {
              x: "best",
              y: "rule",
              r: dotRadius,
              fill: (p) => (p.delta < -CONFIG.tieTol ? c.est : p.delta > CONFIG.tieTol ? c.post : c.neutral[4]),
              fillOpacity: 0.78,
              stroke: c.plotBg,
              strokeWidth: 1,
              title: countLabel,
            }),
            P.dot([selectedPoint], { x: "best", y: "rule", r: (p) => dotRadius(p) + 4.5, fill: "none", stroke: c.plotFg, strokeWidth: 2.2 }),
            P.dot([expectation], {
              x: "best",
              y: "rule",
              symbol: "star",
              r: 9.5,
              fill: c.plotBg,
              stroke: c.plotFg,
              strokeWidth: 1.8,
              ariaLabel: "Exact expectation",
              title: (d) => `Exact conditional risks: ${formatRisk(d.best)}, ${formatRisk(d.rule)}`,
            }),
            P.dot([average], {
              x: "best",
              y: "rule",
              symbol: "cross",
              r: 6.5,
              fill: c.est,
              stroke: c.plotBg,
              strokeWidth: 1.4,
              ariaLabel: "Sample mean",
              title: (d) => `Paired mean losses: ${formatRisk(d.best)}, ${formatRisk(d.rule)}`,
            }),
          ],
          keyboard: {
            data: rows,
            x: "best",
            y: "rule",
            key: "draw",
            pointer: true,
            onSelect: (r) => ctx.set({ draw: r.draw }),
            title: (r) => `Draw ${formatCount(r.draw)}: best loss ${formatRisk(r.best)}, rule loss ${formatRisk(r.rule)}, difference ${signedExact(r.delta)}.`,
          },
        });

        // Direct non-colliding callouts & count badges via placeDirectLabels (WA-02 item.id Map + WB-03 plotBg pills)
        const sx = chart.scale("x");
        const sy = chart.scale("y");
        const pal = chart.palette;
        const plotRight = w - marginRight;
        const layer = svgEl(ctx.doc, "g", { "aria-hidden": "true", "pointer-events": "none" });

        if (showCounts) {
          const countItems = points.map((p, idx) => {
            const px = sx.apply(p.best);
            const py = sy.apply(p.rule);
            const onRightHalf = px > (marginLeft + plotRight) / 2;
            const r = dotRadius(p);
            return {
              id: `cnt-${idx}`,
              px,
              py,
              y: py - Math.max(12, r + 6),
              height: 20,
              count: p.count,
              onRightHalf,
              r,
            };
          });
          const placedCounts = placeDirectLabels(countItems, {
            minGapPx: 21,
            minY: marginTop + 12,
            maxY: height - marginBottom - 12,
          });
          const countById = new Map(placedCounts.map((item) => [item.id, item]));
          for (const item of countItems) {
            const pl = countById.get(item.id);
            if (!pl) continue;
            const anchor = item.onRightHalf ? "end" : "start";
            const rawLabelX = item.onRightHalf ? item.px - item.r - 6 : item.px + item.r + 6;
            const clampedX = Math.max(marginLeft + 10, Math.min(plotRight - 10, rawLabelX));
            appendSvgPill(ctx.doc, layer, {
              x: clampedX,
              y: pl.y,
              anchor,
              maxWidth: 64,
              bold: true,
              pal,
              dataNumFn: ctx.dataNum,
              parts: [{ raw: item.count, text: formatCount(item.count) }],
            });
          }
        }

        const railX = plotRight + 10;
        const railMaxW = marginRight - 14;
        const railItems = [
          {
            id: "expect",
            rawX: sx.apply(expectation.best),
            rawY: sy.apply(expectation.rule),
            y: sy.apply(expectation.rule),
            height: 20,
            bold: true,
            parts: narrow
              ? ["★ E[Δ] ", { raw: m.exactGap, text: signedReadout(m.exactGap) }]
              : ["★ Exact ", { raw: m.exactGap, text: signedReadout(m.exactGap) }],
          },
          {
            id: "mean",
            rawX: sx.apply(average.best),
            rawY: sy.apply(average.rule),
            y: sy.apply(average.rule),
            height: 20,
            bold: false,
            parts: ["+ Mean ", { raw: sim.compare.meanDelta, text: signedReadout(sim.compare.meanDelta) }],
          },
          {
            id: "draw",
            rawX: sx.apply(rows[q].best),
            rawY: sy.apply(rows[q].rule),
            y: sy.apply(rows[q].rule),
            height: 20,
            bold: false,
            parts: narrow
              ? ["○ #", { raw: s.draw, text: formatCount(s.draw) }, " ", { raw: rows[q].delta, text: signedReadout(rows[q].delta) }]
              : ["○ Draw ", { raw: s.draw, text: formatCount(s.draw) }, ": ", { raw: rows[q].delta, text: signedReadout(rows[q].delta) }],
          },
        ];
        const placedRail = placeDirectLabels(railItems, {
          minGapPx: 23,
          minY: marginTop + 12,
          maxY: height - marginBottom - 12,
        });
        const railById = new Map(placedRail.map((item) => [item.id, item]));
        for (const item of railItems) {
          const pl = railById.get(item.id);
          if (!pl) continue;
          const startX = Math.min(plotRight, item.rawX + 7);
          layer.append(
            svgEl(ctx.doc, "path", {
              d: `M${startX},${item.rawY}L${railX - 5},${pl.y}`,
              stroke: pal.plotMuted,
              strokeWidth: 0.9,
              opacity: 0.75,
              fill: "none",
            }),
          );
          appendSvgPill(ctx.doc, layer, {
            x: railX,
            y: pl.y,
            anchor: "start",
            maxWidth: railMaxW,
            bold: item.bold,
            pal,
            dataNumFn: ctx.dataNum,
            parts: item.parts,
          });
        }
        chart.svg.append(layer);

        stageStrip.replaceChildren(
          h("span", {}, h("i", { class: "boa-line", "aria-hidden": "true" }), "equal loss (below: rule wins)"),
          h("span", {}, "best wins ", ctx.num(sim.compare.bestWins, formatCount(sim.compare.bestWins))),
          h("span", {}, "rule wins ", ctx.num(sim.compare.ruleWins, formatCount(sim.compare.ruleWins))),
          h("span", {}, "ties ", ctx.num(sim.compare.ties, formatCount(sim.compare.ties))),
        );

        // Data disclosure: exact paired statistics, finite-state table, selected draw table, equal-risk optima
        summary.replaceChildren(
          h(
            "p",
            {},
            "Paired mean difference: ", ro("pairedMean", sim.compare.meanDelta, signedExact),
            "; paired Monte Carlo SE ", ro("pairedMcse", sim.compare.mcseDelta, mcseFormat),
            s.S === 1 ? " (undefined for one draw)." : ".",
          ),
          h(
            "p",
            {},
            "Common rule wins ", ro("wins", sim.compare.ruleWins),
            "; best report wins ", ro("bestWins", sim.compare.bestWins),
            "; ties ", ro("ties", sim.compare.ties),
            " of ", ro("sampleCount", s.S), ".",
          ),
        );
        if (s.law === "finite") {
          const perState = compareReportLosses(m.best, m.rule, FINITE.states, { tau: s.tau });
          const losses = FINITE.states.map((_, i) => [perState.lossBest[i], perState.lossRule[i]]);
          const winLaw = finiteLawPairwise(losses, FINITE.probs);
          summary.append(
            h(
              "p",
              {},
              "Under the exact two-state law, the rule wins with probability ",
              ro("exactRuleWin", winLaw.pi[0][0][1], probability),
              ". The table's state probabilities are exact; the scatter and paired SE describe the sampled draws.",
            ),
            ctx.scrollRegion(
              h(
                "div",
                { class: "boa-detail" },
                h(
                  "table",
                  { class: "boa-table prx-sticky-first" },
                  h("caption", { text: "Exact conditional law, not equally weighted states" }),
                  h("thead", {}, h("tr", {}, ...["State (A, B)", "Probability", "Best loss", "Rule loss"].map((text) => h("th", { scope: "col", text })))),
                  h(
                    "tbody",
                    {},
                    ...FINITE.states.map((theta, i) => h(
                      "tr",
                      {},
                      h("th", { scope: "row" }, ctx.num(theta, theta.join(", "))),
                      h("td", {}, ro(`state-prob-${i}`, FINITE.probs[i], probability)),
                      h("td", {}, ro(`state-bestLoss-${i}`, perState.lossBest[i], formatRisk)),
                      h("td", {}, ro(`state-ruleLoss-${i}`, perState.lossRule[i], formatRisk)),
                    )),
                  ),
                ),
              ),
              "Exact conditional law states and losses",
            ),
          );
        }

        const state = sim.draws[q];
        const bw = realizedWrong(m.best, state);
        const rw = realizedWrong(m.rule, state);
        chosen.replaceChildren(
          ctx.panelTitle("Selected draw"),
          h(
            "p",
            {},
            "Draw ", ro("selectedDraw", s.draw),
            ": best loss ", ro("selectedBestLoss", sim.compare.lossBest[q], formatRisk),
            "; rule loss ", ro("selectedRuleLoss", sim.compare.lossRule[q], formatRisk),
            "; rule minus best ", ro("selectedDelta", sim.compare.delta[q], signedExact), ".",
          ),
          ctx.scrollRegion(
            h(
              "div",
              { class: "boa-detail" },
              h(
                "table",
                { class: "boa-table prx-sticky-first" },
                h("thead", {}, h("tr", {}, ...["Unit", "Drawn value", "Best grade", "Rule grade"].map((text) => h("th", { scope: "col", text })))),
                h(
                  "tbody",
                  {},
                  ...L.ids.map((id, i) => h(
                    "tr",
                    {},
                    h("th", { scope: "row", text: id }),
                    h("td", {}, ro(`theta-${id}`, Array.isArray(state[i]) ? state[i][0] : state[i], signedExact)),
                    h("td", {}, ctx.num(m.best[i], formatCount(m.best[i]))),
                    h("td", {}, ctx.num(m.rule[i], formatCount(m.rule[i]))),
                  )),
                ),
              ),
            ),
            "Selected whole state and both fixed reports",
          ),
          h(
            "p",
            {},
            "Wrong directions in this state: best ", ro("selectedBestWrong", bw.D[0]),
            ", rule ", ro("selectedRuleWrong", rw.D[0]),
            ". Wrong fractions among stated directions: ", ro("selectedBestFraction", bw.DoverN[0], formatShare),
            " and ", ro("selectedRuleFraction", rw.DoverN[0], formatShare),
            " (denominators are stated pairs, distinct from total reporting loss).",
          ),
        );

        tiedChoice.hidden = m.optimum.grades.length < 2;
        choice.replaceChildren(...m.optimum.grades.map((g, i) => h("option", { value: String(i), text: formatGrades(g) })));
        choice.value = String(m.index);

        tieTableWrap.replaceChildren();
        if (m.optimum.tieCount > m.optimum.grades.length) {
          tieTableWrap.append(h("p", { class: "boa-note" }, "The table lists the first ", ctx.num(m.optimum.grades.length, formatCount(m.optimum.grades.length)), " equal-risk reports."));
        }
        if (m.optimum.grades.length > 1) {
          const headings = [
            "Best grade", "Rule grade", "Best stated pairs", "Rule stated pairs",
            "Best expected wrong share", "Rule expected wrong share", "Best risk", "Rule risk",
            "Exact rule − best", "Paired mean", "Paired Monte Carlo SE", "Rule wins", "Best wins",
            "Equal losses", "Selected best loss", "Selected rule loss", "Selected best wrong",
            "Selected rule wrong", "Selected best wrong fraction", "Selected rule wrong fraction",
          ];
          tieTableWrap.append(
            ctx.scrollRegion(
              h(
                "div",
                { class: "boa-detail" },
                h(
                  "table",
                  { class: "boa-table boa-tie-table prx-sticky-first" },
                  h("caption", { text: "Equal-risk optima and each report's own comparison" }),
                  h("thead", {}, h("tr", {}, ...headings.map((text) => h("th", { scope: "col", text })))),
                  h(
                    "tbody",
                    {},
                    ...m.optimum.grades.map((g) => {
                      const ruleGrade = s.rule === "self" ? g : m.rule;
                      const ev = evaluateReport(g, L.E, { tau: s.tau });
                      const re = evaluateReport(ruleGrade, L.E, { tau: s.tau });
                      const c = compareReportLosses(g, ruleGrade, sim.draws, { tau: s.tau });
                      const b = realizedWrong(g, state);
                      const r = realizedWrong(ruleGrade, state);
                      const cells = [
                        [g, formatGrades], [ruleGrade, formatGrades], [ev.N, formatCount], [re.N, formatCount],
                        [ev.EoverN[0], formatShare], [re.EoverN[0], formatShare], [ev.risk, formatRisk], [re.risk, formatRisk],
                        [re.risk - ev.risk, signedExact], [c.meanDelta, signedExact], [c.mcseDelta, mcseFormat],
                        [c.ruleWins, formatCount], [c.bestWins, formatCount], [c.ties, formatCount],
                        [c.lossBest[q], formatRisk], [c.lossRule[q], formatRisk], [b.D[0], formatCount], [r.D[0], formatCount],
                        [b.DoverN[0], formatShare], [r.DoverN[0], formatShare],
                      ];
                      return h("tr", {}, ...cells.map(([v, f], i) => h(i === 0 ? "th" : "td", i === 0 ? { scope: "row" } : {}, ctx.num(v, f(v)))));
                    }),
                  ),
                ),
              ),
              "Every equal-risk optimum on the same paired draws",
            ),
          );
        }

        // Method disclosure: loss decomposition and numerical tolerances
        methodNotes.replaceChildren(
          h(
            "p",
            { class: "boa-note" },
            "Reporting loss is (wrong stated directions + τ × withheld pairs) / all pairs M; positive differences favor the best report. No report is re-selected on individual draws. Paired draw ties use absolute loss tolerance ",
            ro("lossTieTol", sim.compare.tieTol, formatSci), ".",
          ),
          h(
            "p",
            { class: "boa-note" },
            ro("tieCount", m.optimum.tieCount),
            m.optimum.tieCount === 1
              ? " report reaches minimum conditional risk within equal-risk tolerance "
              : " reports share minimum conditional risk within equal-risk tolerance ",
            ro("riskTieTol", m.optimum.tieTol, formatSci),
            ". ",
            m.optimum.grades.length > 1 ? "Use Settings → Optimum followed to switch among equal-risk optima." : "",
          ),
        );

        ctx.caption.replaceChildren(
          captionNode(ctx, "monte-carlo", { S: s.S, seed: s.seed }),
          ". Both reports are selected once from the declared conditional law and held fixed across paired whole-state draws.",
        );
      }

      return {
        render(s, info = {}) {
          if (info?.reason === "disclosure") return;
          if (s.draw > s.S) { ctx.set({ draw: s.S }); return; }
          if (s.law === "finite" && s.outside) { ctx.set({ outside: false }); return; }

          law.set(s.law);
          family.set(s.family);
          family.root.hidden = s.law === "finite";
          rule.set(s.rule);
          outside.set(s.outside);
          outside.root.hidden = s.law === "finite" || s.rule !== "tiers";
          tau.set(s.tau);
          S.set(s.S);
          seed.set(s.seed);
          draw.input.max = String(s.S);
          draw.set(s.draw);

          const m = comparisonModel(s);
          if (m.index !== s.optimum) { ctx.set({ optimum: m.index }); return; }

          lawNote.replaceChildren(
            ...(s.law === "six"
              ? ["Six fictional sites, score A: independent normal posterior marginals supplied by the tutorial. "]
              : [
                "Two-unit conditional law: (",
                ctx.num(FINITE.states[0], FINITE.states[0].join(", ")),
                ") with probability ",
                ctx.num(FINITE.probs[0], formatProb(FINITE.probs[0])),
                " and (",
                ctx.num(FINITE.states[1], FINITE.states[1].join(", ")),
                ") with probability ",
                ctx.num(FINITE.probs[1], formatProb(FINITE.probs[1])),
                ". All reports of these two units form the optimized family. ",
              ]),
            "Changing τ, family or law can re-select the best report; changing S, seed or draw evaluates the fixed pair of reports.",
          );

          const simKey = [s.law, s.family, s.tau, s.rule, s.outside, s.optimum, s.S, s.seed].join("|");
          const renderKey = `${simKey}|${s.draw}`;
          if (renderKey === rendered && info.reason !== "resize" && info.reason !== "theme") return;

          const getSim = () => {
            if (!cache.has(simKey)) {
              const draws = comparisonDraws(s, m);
              cache.set(simKey, { draws, compare: compareReportLosses(m.best, m.rule, draws, { tau: s.tau }) });
              if (cache.size > 12) cache.delete(cache.keys().next().value);
            }
            return cache.get(simKey);
          };

          if (cache.has(simKey) || s.S <= 250) {
            ctx.scheduleStages([() => {
              show(s, m, getSim());
              rendered = renderKey;
            }]);
          } else {
            ctx.scheduleStages([
              () => {
                ctx.readout.set([
                  "Exact conditional risk gap: ",
                  ctx.num(m.exactGap, signedReadout(m.exactGap)),
                  ". Evaluating ",
                  ctx.num(s.S, formatCount(s.S)),
                  " paired draws…",
                ]);
              },
              () => {
                show(s, m, getSim());
                rendered = renderKey;
              },
            ], { yieldMs: 0 });
          }
        },
      };
    },
  });
}
