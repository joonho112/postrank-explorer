// App entry point for 2.10 frontier ("The frontier") — Frame v2 upgrade.
// Re-exports ../shared/domain/frontier.js untouched for 2.11 frontier-mixtures and 2.19 averaging-errors,
// while providing 2.10's Frame v2 widget: primary τ slider + wrapping presets + Settings disclosure,
// concise 3-sig-fig readout, unified (N, E) frontier stage with collision-free direct labels and
// interactive τ-interval ruler, and full exact tables/tolerances in Data and Method disclosures.
import {
  CONFIG,
  CSS,
  errorArrayOf,
  modelOf,
  optimumOf,
  rangeOf,
  tauFor,
} from "../shared/domain/frontier.js";
import { createWidget, uid } from "../shared/base.js";
import { canvasLayer, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatGrades,
  formatReadoutExpected,
  formatReadoutRisk,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import { evaluateReport, matchedDisclosure, supportingVertex } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export * from "../shared/domain/frontier.js";

const SIX_E = errorArrayOf(SIX);

const V2_CSS = `
.prx-frt[data-prx-frame="v2"] .prx-slider { max-width: 20rem; }
.prx-frt[data-prx-frame="v2"] .prx-readout .prx-frt-blocks { font-weight: 600; color: var(--prx-fg-heading); }

.prx-frt[data-prx-frame="v2"] .prx-stage {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-fr-chart {
  min-width: 0;
  max-width: 100%;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-ruler-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.1rem;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-ruler-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.2rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-ruler-title {
  font-weight: 600;
  color: var(--prx-plot-fg);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-ruler-track {
  position: relative;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-ruler {
  display: flex;
  min-width: 0;
  border: 1px solid var(--prx-cell-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--prx-plot-bg);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 2.25rem;
  margin: 0;
  padding: 0 0.15rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--prx-plot-fg);
  background: transparent;
  border: 0;
  border-left: 1px solid var(--prx-cell-border);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band:first-child { border-left: 0; }
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band:hover { background: var(--prx-plot-grid); }
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band[aria-pressed="true"] {
  font-weight: 700;
  color: #ffffff;
  background: var(--prx-post, #1f3a5f);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band:focus-visible { outline-offset: -3px; }
@media (pointer: coarse), (max-width: 48em) {
  .prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-band {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
@media (max-width: 30em) {
  .prx-frt[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.48rem;
    font-size: 0.8125rem;
  }
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-tau-marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2.5px;
  background: var(--prx-est, #D55E00);
  border-radius: 1px;
  transform: translateX(-50%);
  pointer-events: none;
}

.prx-frt[data-prx-frame="v2"] .prx-stage .prx-frt-keymain {
  margin: 0;
  padding: 0.3rem 0.1rem 0;
  font-size: 0.8125rem;
  border-top: 1px solid var(--prx-plot-grid);
  border-radius: 0;
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-fr-sw-hull::before {
  border-top: 2.5px dashed var(--prx-post, #1f3a5f);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-fr-sw-line::before {
  border-top: 2px dashed var(--prx-est, #D55E00);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-fr-sw-vertex::before {
  background: var(--prx-post, #1f3a5f);
}
.prx-frt[data-prx-frame="v2"] .prx-stage .prx-fr-sw-ring::before {
  border-color: #17645E;
}

.prx-frt[data-prx-frame="v2"] .prx-fr-vertices { margin: 0.15rem 0 0; }
.prx-frt[data-prx-frame="v2"] .prx-fr-table { width: 100%; }
.prx-frt[data-prx-frame="v2"] .prx-fr-table caption {
  caption-side: top;
  padding: 0 0 0.3rem;
  text-align: left;
  font-size: 0.92em;
  font-weight: 600;
}
.prx-frt[data-prx-frame="v2"] .prx-fr-table tbody tr[data-prx-pick] { cursor: pointer; }
.prx-frt[data-prx-frame="v2"] .prx-fr-table tbody tr[aria-current="true"] > * {
  font-weight: 700;
  background: var(--prx-bg-sunken);
}
.prx-frt[data-prx-frame="v2"] .prx-fr-table tbody tr[aria-current="true"] > :first-child {
  box-shadow: inset 3px 0 0 var(--prx-accent);
}
.prx-frt[data-prx-frame="v2"] .prx-frt-pick {
  min-width: 2.6rem;
  min-height: 2.1rem;
  margin: 0;
  padding: 0.1rem 0.5rem;
  font: inherit;
  font-weight: inherit;
  color: var(--prx-fg);
  background: var(--prx-bg);
  border: 1px solid var(--prx-border-strong);
  border-radius: 5px;
  cursor: pointer;
}
.prx-frt[data-prx-frame="v2"] .prx-frt-pick:hover { border-color: var(--prx-accent); }
.prx-frt[data-prx-frame="v2"] .prx-frt-static {
  display: inline-block;
  min-width: 2.6rem;
  padding: 0.1rem 0.5rem;
}
.prx-frt[data-prx-frame="v2"] .prx-frt-below {
  color: var(--prx-fg-muted);
  font-weight: 400;
}
.prx-frt[data-prx-frame="v2"] .prx-frt-method-body > p {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
}
.prx-frt[data-prx-frame="v2"] .prx-frt-method-body > p:first-child {
  margin-top: 0;
}
`;

const STAGE_CHART = Object.freeze({
  aspect: 0.44,
  minHeight: 230,
  maxHeight: 340,
  marginTop: 34,
  marginRight: 24,
  marginBottom: 42,
  marginLeft: 50,
  xPad: 0.5,
  tickRoom: 24,
  tickStep: 5,
  roomyInner: 420,
  dash: 5,
  dashWidth: 1.5,
  dashAlpha: 0.36,
  columnWidth: 1.25,
  minDot: 4,
  vertexDot: 5.2,
  activeDot: 5.8,
  ring: 9.5,
  ringWidth: 2.4,
  hullWidth: 2.5,
  hullDash: "7 4",
  lineWidth: 2,
  lineDash: "5 3",
  triangle: 3.5,
  thin: 1.4,
  halo: 3.5,
  labelGapPx: 20,
});

function createFrontierStageRenderer(ctx, chartSlot, { onFocus, onSelect, vertexTip }) {
  const T = CONFIG.text;
  let cloudLayer = null;
  let paint = { points: [], yTop: 1 };
  ctx.onCleanup(() => cloudLayer?.remove());

  return function drawStageChart(state, model, sv) {
    const C = STAGE_CHART;
    const M = model.M;
    const near = state.view !== "all";
    const yTop = near ? model.yNear : model.yAll;
    const rows = model.cloud.byN.map((r) => ({
      ...r,
      top: Math.min(r.maxEw, yTop),
      above: r.maxEw > yTop,
      out: r.minEw > yTop,
      vertex: model.hull.some((v) => v.N === r.N),
    }));
    const inView = rows.filter((d) => !d.out);
    const width = Math.max(240, Math.round(chartSlot.clientWidth || ctx.width()));
    const height = Math.max(C.minHeight, Math.min(C.maxHeight, Math.round(width * C.aspect)));
    const inner = Math.max(1, width - C.marginLeft - C.marginRight);
    const roomy = inner / (M + 1) >= C.tickRoom;
    const xticks = [];
    for (let t = 0; t <= M; t += 1) {
      if (roomy || t % C.tickStep === 0) xticks.push(t);
    }

    const hull = model.hull;
    const touched = sv.vertices.filter((v) => v.Ew <= yTop);
    const lineStartN = state.tau > 0 ? Math.max(0, -sv.value / state.tau) : 0;
    const lineEndN = state.tau > 0 ? Math.min(M, (yTop - sv.value) / state.tau) : M;
    const line = [
      { N: lineStartN, y: Math.max(0, sv.value + state.tau * lineStartN) },
      { N: lineEndN, y: Math.min(yTop, sv.value + state.tau * lineEndN) },
    ];

    const Hat = (N) => matchedDisclosure(null, hull, N).H;
    const fmtRoE = (v) => formatReadoutExpected(v);
    const fmtTableE = model.fmt.E;

    const titleOf = (d) => {
      let s = `N = ${formatCount(d.N)}: ${formatCount(d.count)} ${d.count === 1 ? "report states" : "reports state"} ${formatCount(d.N)} pairs. `;
      s += d.count === 1
        ? `Its ${model.wrong}: ${fmtRoE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}).`
        : `Their ${model.wrong} run from ${fmtRoE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}) to ${fmtRoE(d.maxEw)}.`;
      if (d.vertex) {
        s += ` The smallest is a vertex of H(m).${typeof vertexTip === "function" ? vertexTip(d, state, model) : ""}`;
      } else {
        s += ` The smallest lies above H(${formatCount(d.N)}) = ${fmtRoE(Hat(d.N))}, which a mixture of two reports reaches.`;
      }
      return s;
    };

    paint = { points: model.cloud.points ?? [], yTop };
    const columns = [
      { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
      { label: "Reports", value: "count", format: (v) => formatCount(v) },
      { label: "Smallest E", value: "minEw", format: (v) => fmtTableE(v) },
      { label: "Report with the smallest E", value: (d) => Array.from(d.minGrade), format: (v) => formatGrades(v) },
      { label: "Largest E", value: "maxEw", format: (v) => fmtTableE(v) },
      { label: "H at this N", value: (d) => Hat(d.N), format: (v) => fmtTableE(v) },
    ];

    const keyboard = {
      data: rows,
      x: "N",
      y: (d) => Math.min(d.minEw, yTop),
      key: (d) => `N${d.N}`,
      label: T.keyboardLabel,
      title: titleOf,
      pointer: true,
      onFocus,
      onSelect,
    };

    const fig = plot(chartSlot, {
      alt: T.chartAlt + T.chartAltBoundary,
      table: { caption: T.tableCaption, columns, rows },
      width,
      height,
      marginTop: C.marginTop,
      marginRight: C.marginRight,
      marginBottom: C.marginBottom,
      marginLeft: C.marginLeft,
      x: {
        domain: [-C.xPad, M + C.xPad],
        ticks: xticks,
        tickFormat: (d) => formatCount(d),
        label: T.xLabel,
        labelAnchor: "center",
        labelArrow: "none",
      },
      y: {
        domain: [0, yTop],
        ticks: 5,
        label: model.weighted ? T.yLabelWeighted : T.yLabel,
        labelArrow: "none",
        grid: true,
      },
      color: { type: "identity" },
      marks: (c, P) => [
        P.ruleX(inView, { x: "N", y1: "minEw", y2: "top", stroke: c.neutral[3], strokeWidth: C.columnWidth }),
        P.dot(rows.filter((d) => d.above), { x: "N", y: () => yTop, symbol: "triangle", r: C.triangle, fill: c.neutral[4] }),
        P.dot(inView, { x: "N", y: "minEw", r: C.minDot, fill: c.plotBg, stroke: c.plotMuted, strokeWidth: C.thin }),
        P.line(hull, { x: "N", y: "Ew", stroke: c.post, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
        P.line(line, { x: "N", y: "y", stroke: c.est, strokeWidth: C.lineWidth, strokeDasharray: C.lineDash, clip: true }),
        P.dot(hull.filter((v) => v.Ew <= yTop), { x: "N", y: "Ew", r: C.vertexDot, fill: c.post, stroke: c.plotBg, strokeWidth: C.thin }),
        P.dot(touched, { x: "N", y: "Ew", r: C.ring, fill: "none", stroke: c.accent, strokeWidth: C.ringWidth }),
        P.dot(touched, { x: "N", y: "Ew", r: C.activeDot, fill: c.accent, stroke: c.plotBg, strokeWidth: C.thin }),
      ],
      keyboard,
    });

    // Collision-free direct labels on the SVG (13px base font, >= 12px floor, separated via placeDirectLabels).
    const doc = fig.svg.ownerDocument;
    const sx = fig.scale("x");
    const sy = fig.scale("y");
    const pal = fig.palette;
    const safeTop = C.marginTop + 12;
    const safeBottom = height - C.marginBottom - 12;
    const wideLabels = inner >= C.roomyInner;
    const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });

    const makeSpan = (raw, display) => svgEl(doc, "tspan", { num: raw, text: display });
    const haloAttrs = {
      stroke: pal.plotBg,
      strokeWidth: C.halo,
      strokeLinejoin: "round",
      paintOrder: "stroke",
      dominantBaseline: "central",
    };

    // 1. Lower hull H(m) label in the empty N in [1, 4] span on the left half of the chart.
    const hullRefN = Math.min(3.5, M * 0.25);
    const hullRefY = Math.min(yTop, Hat(hullRefN));
    const hullX = sx.apply(hullRefN);
    const hullY = Math.max(safeTop, Math.min(safeBottom, sy.apply(hullRefY) - 14));
    layer.append(
      svgEl(doc, "text", {
        ...haloAttrs,
        x: hullX,
        y: hullY,
        textAnchor: "middle",
        fill: pal.postText,
        fontWeight: 600,
        text: "H(m)",
      }),
    );

    // 2. Active vertex label + supporting slope-τ line label, separated vertically by placeDirectLabels.
    const rightItems = [];
    const v0 = touched[0] ?? null;
    if (v0) {
      const vx = sx.apply(v0.N);
      const vy = sy.apply(v0.Ew);
      const toLeft = v0.N >= M * 0.45;
      rightItems.push({
        id: "vertex",
        vx,
        vy,
        x: toLeft ? vx - 14 : vx + 14,
        anchor: toLeft ? "end" : "start",
        y: vy - 16,
      });
    }

    // Choose supporting-line slope label anchor with maximum bbox clearance from all visible hull vertices and H(m).
    const hullPts = hull.filter((v) => v.Ew <= yTop).map((v) => ({ x: sx.apply(v.N), y: sy.apply(v.Ew), r: touched.includes(v) ? 14 : 8 }));
    const hullMinN = hull[0]?.N ?? 0;
    const hullMaxN = hull[hull.length - 1]?.N ?? M;
    const nLo = line[0].N + 0.5;
    const nHi = line[1].N - 0.35;
    const estW = wideLabels ? 86 : 56;
    let bestCand = null;
    if (nHi > nLo) {
      const steps = 28;
      for (let s = 0; s <= steps; s += 1) {
        const candN = nLo + ((nHi - nLo) * s) / steps;
        const candE = Math.max(0, Math.min(yTop, sv.value + state.tau * candN));
        const cx = sx.apply(candN);
        const cy = sy.apply(candE);
        for (const anchorEnd of [false, true]) {
          const x = anchorEnd ? cx - 10 : cx + 10;
          const x0 = anchorEnd ? x - estW : x;
          const x1 = anchorEnd ? x : x + estW;
          if (x0 < C.marginLeft + 4 || x1 > width - C.marginRight - 4) continue;
          const labelY = Math.max(safeTop, Math.min(safeBottom, cy + 16));
          let minDist = Infinity;
          for (const hp of hullPts) {
            const dx = hp.x < x0 ? x0 - hp.x : hp.x > x1 ? hp.x - x1 : 0;
            const dy = Math.abs(labelY - hp.y);
            const d = Math.hypot(dx, dy) - hp.r;
            if (d < minDist) minDist = d;
          }
          const clampedHullN = Math.max(hullMinN, Math.min(hullMaxN, candN));
          const hullGapPx = Math.abs(labelY - sy.apply(Math.min(yTop, Hat(clampedHullN))));
          const score = Math.min(minDist, hullGapPx);
          if (!bestCand || score > bestCand.score) {
            bestCand = { score, sxPx: cx, syPx: cy, x, labelY, anchorEnd };
          }
        }
      }
    }
    const sxPx = bestCand ? bestCand.sxPx : sx.apply((line[0].N + line[1].N) / 2);
    const syPx = bestCand ? bestCand.syPx : sy.apply(Math.max(0, Math.min(yTop, sv.value + (state.tau * (line[0].N + line[1].N)) / 2)));
    const slopeLeft = bestCand ? bestCand.anchorEnd : sxPx > C.marginLeft + inner * 0.42;
    rightItems.push({
      id: "slope",
      vx: sxPx,
      vy: syPx,
      x: bestCand ? bestCand.x : (slopeLeft ? Math.min(width - C.marginRight - 6, sxPx - 6) : Math.max(C.marginLeft + 8, sxPx + 6)),
      anchor: slopeLeft ? "end" : "start",
      y: bestCand ? bestCand.labelY : syPx + 18,
    });

    const placed = placeDirectLabels(rightItems, {
      minGapPx: C.labelGapPx,
      bounds: [safeTop, safeBottom],
    });

    for (const item of placed) {
      if (item.id === "vertex" && v0) {
        if (Math.abs(item.y - item.vy) > 22) {
          layer.append(
            svgEl(doc, "line", {
              x1: item.vx,
              y1: item.vy,
              x2: item.x + (item.anchor === "end" ? 4 : -4),
              y2: item.y,
              stroke: pal.plotMuted,
              strokeWidth: 1,
            }),
          );
        }
        const children = wideLabels
          ? ["N = ", makeSpan(v0.N, formatCount(v0.N)), ", E = ", makeSpan(v0.Ew, fmtRoE(v0.Ew))]
          : ["N = ", makeSpan(v0.N, formatCount(v0.N))];
        layer.append(
          svgEl(
            doc,
            "text",
            {
              ...haloAttrs,
              x: item.x,
              y: item.y,
              textAnchor: item.anchor,
              fill: pal.plotFg,
              fontWeight: 700,
              ...(wideLabels ? { "data-prx-cloud-report-label": "" } : { "data-prx-ring-label": "" }),
            },
            ...children,
          ),
        );
      } else if (item.id === "slope") {
        const prefix = wideLabels ? "slope τ = " : "τ = ";
        layer.append(
          svgEl(
            doc,
            "text",
            {
              ...haloAttrs,
              x: item.x,
              y: item.y,
              textAnchor: item.anchor,
              fill: pal.errText,
              fontWeight: 600,
              "data-prx-slope-label": "",
            },
            prefix,
            makeSpan(state.tau, formatSetting(state.tau)),
          ),
        );
      }
    }

    fig.svg.append(layer);

    if (!cloudLayer) {
      cloudLayer = canvasLayer(fig, (g, { x, y, palette }) => {
        g.save?.();
        g.globalAlpha = C.dashAlpha;
        g.strokeStyle = palette.neutral[4];
        g.lineWidth = C.dashWidth;
        g.beginPath();
        for (const p of paint.points) {
          if (p.Ew > paint.yTop) continue;
          const px = x(p.N);
          const py = y(p.Ew);
          g.moveTo(px - C.dash, py);
          g.lineTo(px + C.dash, py);
        }
        g.stroke();
        g.restore?.();
      });
    }
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: "prx-fr prx-frt",
    css: CSS + V2_CSS,
    frame: "v2",
    keys: {
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      family: { type: "choice", values: CONFIG.families.slice(), value: CONFIG.family },
      view: { type: "choice", values: CONFIG.views.slice(), value: CONFIG.view },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;

      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const gradeNum = (name, g) => h(
        "span",
        { class: "prx-fr-report" },
        ro(name, Array.from(g), formatGrades(Array.from(g))),
        h("span", { class: "prx-fr-decoded" }, ` = ${blocksText(g, SIX_E.ids)}`),
      );
      const famNode = (fam) => {
        const node = familyNameNode(ctx, { family: fam });
        node.classList.add("prx-fr-sym");
        return node;
      };

      const fmtRoE = (v) => formatReadoutExpected(v);
      const fmtRoRisk = (v) => formatReadoutRisk(v);
      const upperRoText = (r) => (r.last ? formatSetting(r.to) : fmtRoRisk(r.to));
      const rangeRoText = (r) => (
        r.from > 0
          ? `${T.rangeFrom} ${fmtRoRisk(r.from)} ${T.rangeTo} ${upperRoText(r)}`
          : `${T.rangeUpTo} ${upperRoText(r)}`
      );
      const upperExactText = (m, r) => (r.last ? formatSetting(r.to) : m.fmt.slope(r.to));
      const rangeExactText = (m, r) => (
        r.from > 0
          ? `${T.rangeFrom} ${m.fmt.slope(r.from)} ${T.rangeTo} ${upperExactText(m, r)}`
          : `${T.rangeUpTo} ${upperExactText(m, r)}`
      );

      let model = modelOf("six", ctx.state.family);

      // --- Primary control in ctx.controls: Withholding cost τ (snaps pointer to .01 grid per CP-1.4)
      const hintId = uid("prx-frt-hint");
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      tau.input.setAttribute("aria-describedby", hintId);
      ctx.primaryControl(tau.root);
      ctx.controls.append(tau.root);

      // --- Secondary controls in Settings disclosure (closed by default)
      const famLabel = (f) => {
        const words = f === "all" ? [T.familyAll] : ["at most ", ctx.num(CONFIG.cap, formatCount(CONFIG.cap)), " grades"];
        const fam = modelOf("six", f).cloud.family;
        return [famNode(fam), " · ", ctx.num(fam.size, formatCount(fam.size)), ` ${T.reports} (`, ...words, ")"];
      };
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend,
        name: "family",
        className: "prx-fr-family",
        options: CONFIG.families.map((f) => ({ value: f, label: famLabel(f) })),
        value: ctx.state.family,
        onChange: (v) => ctx.set({ family: v }),
      });
      const viewSwitch = ctx.radioGroup({
        legend: T.viewLegend,
        name: "view",
        className: "prx-fr-view",
        options: [
          { value: "near", label: T.viewNear },
          { value: "all", label: T.viewAll },
        ],
        value: ctx.state.view,
        onChange: (v) => ctx.set({ view: v }),
      });
      const settings = ctx.settingsBox();
      settings.body.append(familySwitch.root, viewSwitch.root);

      // --- Unified Stage: (N, E) frontier chart + interactive τ-interval ruler + compact 1-line key
      const chartSlot = h("div", { class: "prx-fr-chart" });
      const rulerRangeNote = h(
        "span",
        {},
        "τ from ",
        ctx.num(CONFIG.tau.min, formatSetting(CONFIG.tau.min)),
        " to ",
        ctx.num(CONFIG.tau.max, formatSetting(CONFIG.tau.max)),
      );
      const ruler = h("div", { class: "prx-frt-ruler", role: "group", "aria-label": T.rulerLabel });
      const tauMarker = h("span", { class: "prx-frt-tau-marker", "aria-hidden": "true" });
      const rulerWrap = h(
        "div",
        { class: "prx-frt-ruler-wrap" },
        h(
          "div",
          { class: "prx-frt-ruler-head" },
          h("span", { class: "prx-frt-ruler-title", text: "Best vertex N along τ" }),
          rulerRangeNote,
        ),
        h("div", { class: "prx-frt-ruler-track" }, ruler, tauMarker),
      );
      const keyMain = h("div", { class: "prx-fr-legend prx-frt-keymain", "data-prx-part": "legend" });
      const vertexSelection = h("p", { class: "prx-fr-note", "data-prx-frontier-selection": "" });
      ctx.stage.append(chartSlot, rulerWrap, vertexSelection, keyMain);

      // --- Disclosures: Data (vertices, exact values & interactive τ intervals) and Method (labels, tolerances & notes)
      const dataBox = ctx.dataBox("Frontier vertices and exact values");
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexTableWrap = ctx.scrollRegion(h("div", { class: "prx-fr-table-wrap" }), T.vertexHeading);
      const vertexTable = h("table", { class: "prx-fr-table prx-frt-ranges prx-sticky-first" });
      vertexTableWrap.append(vertexTable);
      const vertexNote = h("p", { class: "prx-fr-note" });
      vertexBox.append(vertexTableWrap, vertexNote);
      dataBox.body.append(vertexBox);

      const methodBox = ctx.methodBox("Method and details");
      const methodBody = h("div", { class: "prx-frt-method-body" });
      const labelLine = h("p", { class: "prx-fr-label" });
      const sliderHint = h("p", { id: hintId, class: "prx-fr-note", text: T.sliderHint });
      const vectorKey = h(
        "p",
        { class: "prx-fr-vector-key", "data-prx-part": "notes" },
        `Vector positions: ${SIX_E.ids.join(" / ")}. Smaller grades mean higher priority; equal grades withhold. > means “stated above”.`,
      );
      methodBody.append(labelLine, sliderHint, vectorKey);
      methodBox.body.append(methodBody);

      // --- Interactive vertex selection: ruler band, Data row button, or chart column point
      function pick(N, { pointer }) {
        const q = model.hull.findIndex((v) => v.N === N);
        if (q < 0) return;
        const target = tauFor(model, q, ctx.state.tau);
        if (target === null) return;
        if (target !== ctx.state.tau) ctx.set({ tau: target });
        if (pointer) tau.input.focus({ preventScroll: true });
      }
      ctx.listen(ruler, "click", (e) => {
        const band = e.target?.closest?.("[data-prx-band]");
        if (band) pick(Number(band.getAttribute("data-prx-band")), { pointer: e.detail !== 0 });
      });
      ctx.listen(vertexTable, "click", (e) => {
        const row = e.target?.closest?.("tr[data-prx-pick]");
        if (row) pick(Number(row.getAttribute("data-prx-vertex")), { pointer: e.detail !== 0 });
      });

      const vertexTip = (d, state, m) => {
        const q = m.hull.findIndex((v) => v.N === d.N);
        if (q < 0) return "";
        const r = rangeOf(m, q);
        const evalOpts = m.opts.w ? { tau: state.tau, w: m.opts.w } : { tau: state.tau };
        const risk = evaluateReport(Array.from(m.hull[q].grade), m.E, evalOpts).risk;
        return ` ${T.tipBest} ${rangeRoText(r)}${r.onSlider ? "" : ` (${T.belowSlider})`}; ${T.tipRisk} ${formatSetting(state.tau)}: ${fmtRoRisk(risk)}.`;
      };

      let focusedColumn = null;
      const drawChart = createFrontierStageRenderer(ctx, chartSlot, {
        vertexTip,
        onFocus: (d) => { focusedColumn = d; },
        onSelect: (d) => pick(d.N, { pointer: true }),
      });
      ctx.listen(chartSlot, "click", (e) => {
        if (e.detail !== 0 || !focusedColumn || !e.target?.closest?.(".prx-kbd-point")) return;
        pick(focusedColumn.N, { pointer: false });
      });

      // --- Render helpers
      function drawRuler(state, m, sv) {
        const { min, max } = CONFIG.tau;
        const on = new Set(sv.vertices.map((v) => v.N));
        const activeBands = m.hull.map((v, q) => ({ v, q, r: rangeOf(m, q) })).filter((b) => b.r.onSlider);
        ruler.replaceChildren(
          ...activeBands.map(({ v, q, r }) => {
            const target = tauFor(m, q, state.tau);
            const sets = target !== null && target !== state.tau ? ` Sets τ to ${formatSetting(target)}.` : "";
            const label = `N = ${formatCount(v.N)}: the best report for τ ${rangeRoText(r)}.${sets}`;
            const width = (100 * (Math.min(r.to, max) - Math.max(r.from, min))) / (max - min);
            return h(
              "button",
              {
                type: "button",
                class: "prx-frt-band",
                "aria-pressed": String(on.has(v.N)),
                "aria-label": label,
                "data-prx-band": String(v.N),
                "data-prx-focus-key": `ruler:N${v.N}`,
                style: { "flex-basis": `${width}%` },
              },
              ctx.num(v.N, formatCount(v.N)),
            );
          }),
        );
        const clampedTau = Math.min(max, Math.max(min, state.tau));
        const pct = (100 * (clampedTau - min)) / (max - min);
        tauMarker.style.left = `${pct}%`;
      }

      function drawKey() {
        const item = (cls, ...children) => h(
          "span",
          { class: "prx-fr-key" },
          h("span", { class: `prx-fr-swatch ${cls}` }),
          h("span", {}, ...children),
        );
        keyMain.replaceChildren(
          item("prx-fr-sw-dash", "report at (N, E)"),
          item("prx-fr-sw-min", "smallest E at N"),
          item("prx-fr-sw-hull", "H(m): ", captionNode(ctx, "mixture-not-report")),
        );
      }

      function drawHeadline(state, m, opt, sv) {
        vertexSelection.replaceChildren(...sv.vertices.flatMap((v, i) => [
          i ? " · " : "", h("strong", {}, blocksText(v.grade, SIX_E.ids)),
          " — N = ", ctx.num(v.N, formatCount(v.N)), ", E = ", ctx.num(v.Ew, fmtRoE(v.Ew)),
        ]));
        const tauNode = ctx.num(state.tau, formatSetting(state.tau));
        const famCount = ro("familySize", m.cloud.family.size, formatCount(m.cloud.family.size));
        if (sv.vertices.length > 1) {
          const a = sv.vertices[0];
          const b = sv.vertices.at(-1);
          ctx.readout.set([
            "At τ = ", tauNode, " (", famCount, " reports), the line lies along edge (",
            ro("edgeAN", a.N, formatCount(a.N)), ", ", ro("edgeAE", a.Ew, fmtRoE(a.Ew)), ") to (",
            ro("edgeBN", b.N, formatCount(b.N)), ", ", ro("edgeBE", b.Ew, fmtRoE(b.Ew)), "); ",
            ...opt.grades.flatMap((g, k) => [k ? " and " : "", h("strong", { class: "prx-frt-blocks" }, blocksText(g, SIX_E.ids))]),
            " share risk ", ro("risk", opt.risk, fmtRoRisk(opt.risk)), ".",
          ]);
        } else {
          const v = sv.vertex;
          const q = m.hull.findIndex((x) => x.N === v.N);
          const r = rangeOf(m, q);
          const upper = r.last ? ro("bestTo", r.to, formatSetting(r.to)) : ro("bestTo", r.to, fmtRoRisk(r.to));
          const rangeNodes = r.from > 0
            ? ["best for τ from ", ro("bestFrom", r.from, fmtRoRisk(r.from)), " to ", upper]
            : ["best for τ up to ", upper];
          ctx.readout.set([
            "At τ = ", tauNode, " (", famCount, " reports), ",
            h("strong", { class: "prx-frt-blocks" }, blocksText(v.grade, SIX_E.ids)),
            " states N = ", ro("N", v.N, formatCount(v.N)), " of ", ctx.num(m.M, formatCount(m.M)),
            " pairs (E = ", ro("E", v.Ew, fmtRoE(v.Ew)), ", risk ", ro("risk", opt.risk, fmtRoRisk(opt.risk)), "); ",
            ...rangeNodes,
            r.whole ? ": the same report across this slider." : ".",
          ]);
        }

        const tiedParts = sv.vertices.length > 1
          ? ["; tied grade vectors: ", ...opt.grades.flatMap((g, k) => [k ? " and " : "", ro(`tiedGrade${k}`, Array.from(g), formatGrades(Array.from(g)))])]
          : [];
        labelLine.replaceChildren(
          labelNode(ctx, opt),
          " (",
          familySizeNode(ctx, opt),
          ` ${T.reports}, every one evaluated). Canonical grade vector: `,
          ro("grades", Array.from(opt.grade), formatGrades(Array.from(opt.grade))),
          ...tiedParts,
          `. ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })),
          ` ${T.toleranceGloss}`,
        );
      }

      function drawVertices(state, m, sv) {
        const fmt = m.fmt;
        const hull = m.hull;
        const touched = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = hull.map((v, q) => {
          const r = rangeOf(m, q);
          const s = m.slopes[q];
          const isTouched = touched.has(v.N);
          const target = r.onSlider ? tauFor(m, q, state.tau) : null;
          const nSpan = ro(`vN-${q}`, v.N, formatCount(v.N));
          const what = `N = ${formatCount(v.N)}, the best report for τ ${rangeExactText(m, r)}`;
          const nCell = r.onSlider
            ? h(
                "button",
                {
                  type: "button",
                  class: "prx-frt-pick",
                  "data-prx-focus-key": `range:N${v.N}`,
                  "aria-label": target !== null && target !== state.tau
                    ? `${what}: set τ to ${formatSetting(target)}`
                    : `${what}: touched at τ = ${formatSetting(state.tau)}`,
                },
                nSpan,
              )
            : h("span", { class: "prx-frt-static" }, nSpan);
          const mark = isTouched
            ? h("span", { class: "prx-fr-touched" }, `${T.touchedMark} at τ = `, ctx.num(state.tau, formatSetting(state.tau)))
            : "";
          const upper = ctx.num(r.to, upperExactText(m, r));
          const spanNodes = r.from > 0
            ? [`${T.rangeFrom} `, ctx.num(r.from, fmt.slope(r.from)), ` ${T.rangeTo} `, upper]
            : [`${T.rangeUpTo} `, upper];
          return h(
            "tr",
            {
              class: isTouched ? "prx-fr-row-touched" : "",
              "data-prx-vertex": String(v.N),
              "data-prx-pick": r.onSlider,
              "aria-current": isTouched ? "true" : undefined,
            },
            h("th", { scope: "row" }, nCell),
            h("td", {}, ro(`vE-${q}`, v.Ew, fmt.E(v.Ew))),
            h("td", {}, gradeNum(`vGrade-${q}`, v.grade), " ", mark),
            h("td", {}, s === undefined ? T.noNext : ro(`slope-${q + 1}`, s, fmt.slope(s))),
            h("td", {}, ...spanNodes, r.onSlider ? null : h("span", { class: "prx-frt-below" }, ` (${T.belowSlider})`)),
          );
        });
        vertexTable.replaceChildren(
          h("caption", { text: "Vertices of H(m) and exact τ intervals" }),
          h("thead", {}, h("tr", {}, th("N"), th("E"), th("Report"), th("Slope of the next edge"), th("Best for τ"))),
          h("tbody", {}, ...rows),
        );
        vertexNote.textContent = `${T.vertexNote.replace("⟨E⟩", m.wrong)} ${T.rangeHint}`;
      }

      drawKey();

      return {
        render(state, info = {}) {
          if (info.reason === "disclosure") return;
          model = modelOf("six", state.family);
          tau.set(state.tau);
          familySwitch.set(state.family);
          viewSwitch.set(state.view);
          const opt = optimumOf(model, state.tau);
          const sv = supportingVertex(model.hull, state.tau, { M: model.M });
          drawRuler(state, model, sv);
          drawHeadline(state, model, opt, sv);
          drawChart(state, model, sv);
          drawVertices(state, model, sv);
          ctx.caption.textContent = T.note;
        },
      };
    },
  });
}
