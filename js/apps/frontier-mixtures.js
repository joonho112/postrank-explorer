// App entry point for 2.11 frontier-mixtures ("Mixtures between frontier corners") — Frame v2 upgrade.
// Preserves 100% of exports (CONFIG, mixtureFrame, mountWidget), URL keys, presets, and D-1 disclosure/readout contracts,
// while upgrading the stage to 2.10's crisp 13px lower convex boundary H(m) grammar (prominent mixture diamond,
// collision-free direct labels via placeDirectLabels, compact lottery strip, 3-item inline key, and visible endpoint pill)
// and a concise <= 35-word 3-sig-fig readout.
import { createWidget, uid, appLink, roundTo } from "../shared/base.js";
import { canvasLayer, numText, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatDistinguishing,
  formatGrades,
  formatProb,
  formatRational,
  formatReadoutExpected,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import { matchedDisclosure, supportingVertex, fixedOrderDP, finiteLawPairwise } from "../pr-core.js";
import { CONFIG as FRONTIER, CSS, modelOf, optimumOf, tb19Model } from "../shared/domain/frontier.js";

export * from "../shared/domain/frontier.js";

export const CONFIG = Object.freeze({
  ...FRONTIER,
  name: "frontier-mixtures",
  title: "A mixture at a mean number of stated pairs",
  label: "Mixtures between frontier corners: matched disclosure, whole reports and the gap to a single report",
  frame: Object.freeze({ head: 1.25, step: 0.05, coarseStep: 0.1, coarseFrom: 0.5, digits: 2, insetBottom: 0.1 }),
  fm: Object.freeze({
    mLabel: "Mean disclosure m",
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
  }),
});

const EX = { tb16: { weights: Array.from(CONFIG.tb16.w) } };
const effectiveFamily = (state) => (state.example === "tb16" ? "all" : state.family);
const niceTop = (v) => Math.ceil(v * CONFIG.yRound) / CONFIG.yRound;
const ORDER_E = finiteLawPairwise(
  CONFIG.tb19.states.map((s) => s.map((x) => Array.from(x))),
  Array.from(CONFIG.tb19.probs),
  { ids: Array.from(CONFIG.tb19.ids) },
);
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
.prx-fm[data-prx-frame="v2"] .prx-slider { max-width: 19rem; }
.prx-fm[data-prx-frame="v2"] .prx-app-link { color: var(--prx-link); }
.prx-fm[data-prx-frame="v2"] .prx-app-link:hover,
.prx-fm[data-prx-frame="v2"] .prx-app-link:focus { color: var(--prx-link-hover); }

/* Reset any legacy grid-area rules inside the unified v2 stage (PR-01) */
.prx-fm[data-prx-frame="v2"] .prx-stage {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.prx-fm[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fr-chart {
  min-width: 0;
  max-width: 100%;
}

/* Compact lottery strip on the plot-paper stage */
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lottery {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--prx-plot-grid);
  border-radius: 6px;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  font-size: 0.84375rem;
  font-variant-numeric: tabular-nums;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.15rem 0.75rem;
  margin: 0 0 0.3rem;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-title {
  margin: 0;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-avg {
  margin: 0;
  color: var(--prx-plot-muted);
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-rows {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-row {
  display: grid;
  grid-template-columns: minmax(8.4rem, auto) minmax(2.5rem, 1fr) 2.5rem;
  gap: 0.5rem;
  align-items: center;
  margin: 0;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-chip {
  justify-self: start;
  padding: 0.05rem 0.45rem;
  white-space: nowrap;
  font-size: 0.8125rem;
  border: 1px solid var(--prx-cell-border);
  border-radius: 999px;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-track {
  display: block;
  height: 0.75rem;
  overflow: hidden;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-radius: 3px;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-fill {
  display: block;
  height: 100%;
  background: var(--prx-post, #1f3a5f);
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-share {
  text-align: right;
  font-weight: 700;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-diamond {
  display: inline-block;
  width: 0.62em;
  height: 0.62em;
  margin: 0 0.45em 0 0.1em;
  vertical-align: 0.05em;
  border: 1.75px solid #17645E;
  background: #17645E;
  transform: rotate(45deg);
}

/* Compact 3-item inline key + family endpoint status pill */
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-keymain {
  margin: 0;
  padding: 0.28rem 0.1rem 0;
  font-size: 0.8125rem;
  border-top: 1px solid var(--prx-plot-grid);
  border-radius: 0;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fr-sw-hull::before {
  border-top: 2.5px dashed var(--prx-post, #1f3a5f);
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fr-sw-mix::before {
  width: 0.72em;
  height: 0.72em;
  border: 1.75px solid #17645E;
  background: #17645E;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fr-sw-best::before {
  width: 0.82em;
  height: 0.82em;
  border: 2px solid #D55E00;
  background: var(--prx-plot-bg);
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-pill {
  align-self: flex-start;
  margin: 0;
  padding: 0.15rem 0.55rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-cell-border);
  border-radius: 999px;
}
.prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-pill[data-prx-endpoint="not-guaranteed"] {
  border-style: dashed;
  color: #b04800;
  border-color: #b04800;
}

/* Settings & end disclosures */
.prx-fm[data-prx-frame="v2"] .prx-fm-settings-notes {
  flex: 1 1 100%;
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.prx-fm[data-prx-frame="v2"] .prx-fr-optimum {
  margin: 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}
.prx-fm[data-prx-frame="v2"] .prx-fr-label { margin: 0; }
.prx-fm[data-prx-frame="v2"] .prx-fr-vector-key { margin: 0; }
.prx-fm[data-prx-frame="v2"] .prx-disclosure .prx-fr-deeper {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.prx-fm[data-prx-frame="v2"] .prx-disclosure .prx-fr-vertices { margin: 0.15rem 0 0; }
.prx-fm[data-prx-frame="v2"] .prx-fr-table { width: 100%; }

@media (pointer: coarse), (max-width: 48em) {
  .prx-fm[data-prx-frame="v2"] .prx-radio {
    min-height: var(--prx-touch-target, 2.75rem);
    align-items: center;
  }
}
@media (max-width: 30em) {
  .prx-fm[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.48rem;
    font-size: 0.8125rem;
  }
  .prx-fm[data-prx-frame="v2"] .prx-stage .prx-fm-lot-row {
    grid-template-columns: minmax(7.4rem, auto) minmax(1.75rem, 1fr) 2.35rem;
    gap: 0.35rem;
  }
}
`;

const STAGE_CHART = Object.freeze({
  aspect: 0.44,
  minHeight: 226,
  maxHeight: 330,
  marginTop: 30,
  marginRight: 26,
  marginBottom: 42,
  marginLeft: 52,
  xPad: 0.5,
  tickRoom: 24,
  tickStep: 5,
  dash: 5,
  dashWidth: 1.5,
  dashAlpha: 0.34,
  columnWidth: 1.25,
  minDot: 4,
  vertexDot: 5.2,
  activeVertexDot: 6,
  ring: 8.5,
  ringWidth: 1.8,
  hullWidth: 2.4,
  activeHullWidth: 3.6,
  hullDash: "7 4",
  lineWidth: 1.5,
  lineDash: "4 3",
  mixDiamond: 8,
  bestSquare: 7,
  triangle: 3.4,
  thin: 1.4,
  halo: 3.5,
  bracketOffset: 10,
  bracketTick: 4,
  labelGapPx: 20,
});

function fmtRoExpected(model, v, ref) {
  if (model.ex.exact) return model.fmt.E(v);
  if (typeof ref === "number" && Number.isFinite(ref) && v !== ref) {
    return formatDistinguishing(v, ref);
  }
  return formatReadoutExpected(v);
}

function createMixtureStageRenderer(ctx, chartSlot) {
  const T = CONFIG.text;
  let cloudLayer = null;
  let paint = { points: [], yTop: 1 };
  ctx.onCleanup(() => cloudLayer?.remove());

  return function drawStageChart(state, model, sv, mix) {
    const C = STAGE_CHART;
    const M = model.M;
    const near = state.view !== "all";
    const frameTop = near ? mixtureFrame(model, mix) : null;
    const framed = Number.isFinite(frameTop) && frameTop > 0;
    const yTop = !near ? model.yAll : framed ? frameTop : model.yNear;

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
    const fmtTableE = model.fmt.E;
    const fmtRoE = (v, ref) => fmtRoExpected(model, v, ref);

    const titleOf = (d) => {
      let s = `N = ${formatCount(d.N)}: ${formatCount(d.count)} ${d.count === 1 ? "report states" : "reports state"} ${formatCount(d.N)} pairs. `;
      s += d.count === 1
        ? `Its ${model.wrong}: ${fmtRoE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}).`
        : `Their ${model.wrong} run from ${fmtRoE(d.minEw)} (${formatGrades(Array.from(d.minGrade))}) to ${fmtRoE(d.maxEw)}.`;
      if (d.vertex) {
        s += " The smallest is a vertex of H(m).";
      } else {
        const hVal = Hat(d.N);
        s += ` The smallest lies above H(${formatCount(d.N)}) = ${fmtRoE(hVal, d.minEw)}, which a mixture of two reports reaches.`;
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

    const footInset = framed ? Math.round(CONFIG.frame.insetBottom * (height - C.marginTop - C.marginBottom)) : 0;
    const mixEndpoints = mix && mix.psi > 0 ? [mix.lower, mix.upper].filter((v) => v.Ew <= yTop) : [];
    const showBest = Boolean(mix && mix.psi > 0 && mix.best && mix.best.Ew <= yTop);
    const showGap = Boolean(framed && showBest && mix.gap > 0);

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
        ...(footInset > 0 ? { insetBottom: footInset } : {}),
      },
      color: { type: "identity" },
      marks: (c, P) => [
        P.ruleX(inView, { x: "N", y1: "minEw", y2: "top", stroke: c.neutral[3], strokeWidth: C.columnWidth }),
        P.dot(rows.filter((d) => d.above), { x: "N", y: () => yTop, symbol: "triangle", r: C.triangle, fill: c.neutral[4] }),
        P.dot(inView, { x: "N", y: "minEw", r: C.minDot, fill: c.plotBg, stroke: c.plotMuted, strokeWidth: C.thin }),
        P.line(line, { x: "N", y: "y", stroke: c.plotMuted, strokeWidth: C.lineWidth, strokeDasharray: C.lineDash, clip: true }),
        P.dot(touched, { x: "N", y: "Ew", r: C.ring, fill: "none", stroke: c.plotMuted, strokeWidth: C.ringWidth }),
        P.line(hull, { x: "N", y: "Ew", stroke: c.post, strokeWidth: C.hullWidth, strokeDasharray: C.hullDash, clip: true }),
        mix && mix.psi > 0
          ? P.line([mix.lower, mix.upper], { x: "N", y: "Ew", stroke: c.post, strokeWidth: C.activeHullWidth, strokeDasharray: C.hullDash, clip: true })
          : null,
        P.dot(hull.filter((v) => v.Ew <= yTop), { x: "N", y: "Ew", r: C.vertexDot, fill: c.post, stroke: c.plotBg, strokeWidth: C.thin }),
        mixEndpoints.length
          ? P.dot(mixEndpoints, { x: "N", y: "Ew", r: C.activeVertexDot, fill: c.post, stroke: c.plotBg, strokeWidth: 1.6 })
          : null,
        mix
          ? P.ruleX([mix], {
              x: "N",
              y1: 0,
              y2: (d) => (showBest ? Math.max(d.H, d.best.Ew) : Math.min(yTop, d.H)),
              stroke: c.plotMuted,
              strokeDasharray: "2 3",
            })
          : null,
        showBest
          ? P.dot([mix], {
              x: "N",
              y: (d) => d.best.Ew,
              symbol: "square",
              r: C.bestSquare,
              fill: c.plotBg,
              stroke: c.err,
              strokeWidth: 2.2,
              clip: true,
              render(index, scales, values, dims, context, next) {
                const mark = next(index, scales, values, dims, context);
                mark.setAttribute("data-prx-cloud-best", "");
                return mark;
              },
            })
          : null,
        mix && mix.H <= yTop
          ? P.dot([mix], {
              x: "N",
              y: "H",
              symbol: "diamond",
              r: C.mixDiamond,
              fill: c.accent,
              stroke: c.plotBg,
              strokeWidth: 2,
              clip: true,
              render(index, scales, values, dims, context, next) {
                const mark = next(index, scales, values, dims, context);
                mark.setAttribute("data-prx-cloud-mix", "");
                return mark;
              },
            })
          : null,
      ].filter(Boolean),
      keyboard: {
        data: rows,
        x: "N",
        y: (d) => Math.min(d.minEw, yTop),
        key: (d) => `N${d.N}`,
        label: T.keyboardLabel,
        title: titleOf,
        pointer: true,
      },
    });

    // Collision-free direct labels & gap bracket via placeDirectLabels (mapped by item.id per WA-02, clamped per WA-13).
    const doc = fig.svg.ownerDocument;
    const sx = fig.scale("x");
    const sy = fig.scale("y");
    const pal = fig.palette;
    const safeTop = C.marginTop + 12;
    const safeBottom = height - C.marginBottom - footInset - 10;
    const safeLeft = C.marginLeft + 6;
    const safeRight = width - C.marginRight - 6;
    const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
    const haloAttrs = {
      stroke: pal.plotBg,
      strokeWidth: C.halo,
      strokeLinejoin: "round",
      paintOrder: "stroke",
      dominantBaseline: "central",
    };

    const hullMaxN = hull.at(-1)?.N ?? M;
    const hullRefN = mix && mix.N <= hullMaxN * 0.45
      ? Math.min(hullMaxN - 0.5, Math.max(mix.N + 1.8, hullMaxN * 0.68))
      : Math.min(3.5, hullMaxN * 0.25);
    const hullRefY = Math.min(yTop, Hat(Math.max(0, Math.min(hullMaxN, hullRefN))));
    const hullW = 36;
    const hullX = Math.max(safeLeft + hullW / 2, Math.min(safeRight - hullW / 2, sx.apply(hullRefN)));
    const hullTargetY = Math.max(safeTop, Math.min(safeBottom, sy.apply(hullRefY) - 15));

    const labelCandidates = [
      {
        id: "hull",
        x: hullX,
        anchor: "middle",
        x0: hullX - hullW / 2,
        x1: hullX + hullW / 2,
        y: hullTargetY,
      },
    ];

    let bracketSpec = null;
    if (showGap) {
      const mx = sx.apply(mix.N);
      const yMix = sy.apply(mix.H);
      const yBest = sy.apply(mix.best.Ew);
      const midY = (yMix + yBest) / 2;
      const gapDisplay = fmtRoE(mix.gap, 0);
      const estLabelW = Math.ceil(7.8 * (`gap ${gapDisplay}`).length) + 4;

      const scoreSide = (side) => {
        const bx = mx + side * C.bracketOffset;
        const lx = bx + side * 6;
        const x0 = side > 0 ? lx : lx - estLabelW;
        const x1 = side > 0 ? lx + estLabelW : lx;
        if (x0 < safeLeft || x1 > safeRight) return -1e6;
        let penalty = 0;
        for (const r of inView) {
          if (r.N === mix.N) continue;
          const rx = sx.apply(r.N);
          const ry = sy.apply(r.minEw);
          if (rx >= x0 - 6 && rx <= x1 + 6 && ry <= midY + 14) penalty += 25;
        }
        return Math.min(x0 - safeLeft, safeRight - x1) * 0.1 - penalty;
      };
      const side = scoreSide(1) >= scoreSide(-1) ? 1 : -1;
      const bx = mx + side * C.bracketOffset;
      let lx = bx + side * 6;
      if (side > 0 && lx + estLabelW > safeRight) lx = Math.max(safeLeft, safeRight - estLabelW);
      if (side < 0 && lx - estLabelW < safeLeft) lx = Math.min(safeRight, safeLeft + estLabelW);
      const x0 = side > 0 ? lx : lx - estLabelW;
      const x1 = side > 0 ? lx + estLabelW : lx;

      bracketSpec = { bx, side, yMix, yBest, midY, gapDisplay };
      labelCandidates.push({
        id: "gap",
        x: lx,
        anchor: side > 0 ? "start" : "end",
        x0,
        x1,
        y: Math.max(safeTop, Math.min(safeBottom, midY)),
      });
    }

    // Separate vertically via placeDirectLabels whenever two labels' horizontal spans overlap (or pass single items for clamping).
    let placed;
    if (
      labelCandidates.length === 2 &&
      Math.max(labelCandidates[0].x0, labelCandidates[1].x0) < Math.min(labelCandidates[0].x1, labelCandidates[1].x1) + 10
    ) {
      placed = placeDirectLabels(labelCandidates, { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] });
    } else {
      placed = labelCandidates.flatMap((item) =>
        placeDirectLabels([item], { minGapPx: C.labelGapPx, bounds: [safeTop, safeBottom] }),
      );
    }
    const byId = new Map(placed.map((item) => [item.id, item]));

    const hullItem = byId.get("hull");
    if (hullItem) {
      layer.append(
        svgEl(doc, "text", {
          ...haloAttrs,
          x: hullItem.x,
          y: hullItem.y,
          textAnchor: hullItem.anchor,
          fill: pal.postText,
          fontWeight: 600,
          text: "H(m)",
        }),
      );
    }

    if (bracketSpec) {
      const { bx, side, yMix, yBest, gapDisplay } = bracketSpec;
      const tickX = bx - side * C.bracketTick;
      layer.append(
        svgEl(doc, "path", {
          d: `M${tickX},${yMix}L${bx},${yMix}L${bx},${yBest}L${tickX},${yBest}`,
          fill: "none",
          stroke: pal.err,
          strokeWidth: 1.6,
        }),
      );
      const gapItem = byId.get("gap");
      if (gapItem) {
        const span = svgEl(doc, "tspan", {
          num: mix.gap,
          "data-prx-readout": "chart-gap",
          text: gapDisplay,
        });
        layer.append(
          svgEl(
            doc,
            "text",
            {
              ...haloAttrs,
              x: gapItem.x,
              y: gapItem.y,
              textAnchor: gapItem.anchor,
              fill: pal.errText,
              fontWeight: 700,
              "data-prx-gap-label": "",
            },
            "gap ",
            span,
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
    className: "prx-fr prx-fm",
    css: `${CSS}${FM_CSS}`,
    frame: "v2",
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

      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      let reportIds = modelOf("six", "all").E.ids;
      const gradeNum = (name, g) => h(
        "span",
        { class: "prx-fr-report" },
        ro(name, Array.from(g), formatGrades(Array.from(g))),
        h("span", { class: "prx-fr-decoded" }, ` = ${blocksText(g, reportIds.slice(0, g.length))}`),
      );
      const famNode = (fam) => {
        const node = familyNameNode(ctx, { family: fam });
        node.classList.add("prx-fr-sym");
        return node;
      };
      const half = () => ctx.num(CONFIG.half, formatRational(CONFIG.half));
      const point = (model, v, prefix) => [
        "(",
        ro(`${prefix}N`, v.N, formatCount(v.N)),
        ", ",
        ro(`${prefix}E`, v.Ew, model.fmt.E(v.Ew)),
        ")",
      ];

      // --- Primary control in ctx.controls: Mean disclosure m
      const mSliders = new Map();
      const mSlot = h("div", { class: "prx-fr-mslot" });
      const mSliderFor = (max) => {
        if (!mSliders.has(max)) {
          mSliders.set(
            max,
            ctx.slider({
              label: TF.mLabel,
              min: CONFIG.m.min,
              max,
              step: 1,
              value: Math.min(ctx.state.m, max),
              name: "m",
              format: (v) => formatCount(v),
              onInput: (v) => ctx.set({ m: v }),
            }),
          );
        }
        return mSliders.get(max);
      };
      ctx.controls.append(mSlot);
      ctx.primaryControl(mSlot);

      // --- Secondary controls & τ optimum details inside Settings disclosure (closed by default)
      const exampleSwitch = ctx.radioGroup({
        legend: T.exampleLegend,
        name: "example",
        className: "prx-fr-example",
        options: [
          { value: "six", label: T.exampleSix },
          { value: "tb16", label: T.exampleTb16 },
        ],
        value: ctx.state.example,
        onChange: (v) => ctx.set({ example: v }),
      });

      const famLabel = (f, example = "six") => {
        const words = f === "all" ? [T.familyAll] : ["at most ", ctx.num(CONFIG.cap, formatCount(CONFIG.cap)), " grades"];
        if (example === "tb16" && f !== "all") return [...words, ` ${T.notUsed}`];
        const fam = modelOf(example, f).cloud.family;
        return [famNode(fam), " · ", ctx.num(fam.size, formatCount(fam.size)), ` ${T.reports} (`, ...words, ")"];
      };
      let labelledFor = "six";
      const familySwitch = ctx.radioGroup({
        legend: T.familyLegend,
        name: "family",
        className: "prx-fr-family",
        options: CONFIG.families.map((f) => ({ value: f, label: famLabel(f) })),
        value: ctx.state.family,
        onChange: (v) => ctx.set({ family: v }),
      });
      const familyFixed = h("p", { class: "prx-hint", hidden: true, text: T.familyFixed });
      familySwitch.root.append(familyFixed);

      const tau = ctx.slider({
        label: T.slider,
        min: CONFIG.tau.min,
        max: CONFIG.tau.max,
        step: CONFIG.tau.step,
        value: ctx.state.tau,
        name: "tau",
        hint: T.sliderHint,
        onInput: (v) => ctx.set({ tau: v }),
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

      const optimumLine = h("p", { class: "prx-fr-optimum" });
      const labelLine = h("p", { class: "prx-fr-label" });
      const fixedNote = h("p", { class: "prx-fr-note", "data-prx-part": "notes", text: TF.fixedTau });
      const vectorKey = h("p", { class: "prx-fr-vector-key", "data-prx-part": "notes" });
      const settingsNotes = h("div", { class: "prx-fm-settings-notes" }, optimumLine, labelLine, fixedNote, vectorKey);

      const settings = ctx.settingsBox(TF.settings);
      settings.body.append(exampleSwitch.root, familySwitch.root, tau.root, viewSwitch.root, settingsNotes);

      // --- Unified Stage: [data-prx-primary] H(m) chart first, then compact lottery strip, 3-item key, and endpoint pill
      const chartSlot = ctx.primaryGraphic(h("div", { class: "prx-fr-chart" }));
      const drawChart = createMixtureStageRenderer(ctx, chartSlot);

      const lotteryTitle = h("p", { class: "prx-fm-lot-title" });
      const lotteryAverage = h("p", { class: "prx-fm-lot-avg" });
      const lotteryRows = h("ul", { class: "prx-fm-lot-rows" });
      const lottery = h(
        "section",
        { class: "prx-fm-lottery prx-light-panel", "aria-label": TF.lotteryLabel },
        h("div", { class: "prx-fm-lot-head" }, lotteryTitle, lotteryAverage),
        lotteryRows,
      );

      const legend = h("div", { class: "prx-fr-legend prx-fm-keymain", "data-prx-part": "legend" });
      const pill = h("p", { class: "prx-fm-pill" });
      ctx.stage.append(chartSlot, lottery, legend, pill);

      // --- Closed D-1 disclosures: Data ("Data: vertices of H(m)") and Endpoint ("Endpoint at τ = 1/2 and a fixed order")
      const vertexBox = h("section", { class: "prx-fr-vertices", "aria-label": T.vertexHeading, "data-prx-part": "table" });
      const vertexHeadingId = uid("prx-fr-vertices");
      const dataBox = ctx.disclosure({ name: "data", title: TF.dataBox });
      dataBox.body.append(vertexBox);

      const mixBody = h("div", { class: "prx-fr-mix-out" });
      const halfBody = h("div", { class: "prx-fr-half" });
      const orderBody = h("div", { class: "prx-fr-order" });
      const miniSlot = h("div", { class: "prx-fr-mini" });
      const ebarLine = h("p", { class: "prx-fr-note" });
      const section = (title, ...children) => h(
        "section",
        { class: "prx-fr-section" },
        h("h4", { class: "prx-fr-heading" }, ...[].concat(title)),
        ...children,
      );
      const mixIntro = h("p", {
        class: "prx-fr-note",
        text: "A point between two corners can be reached by choosing one of two complete reports at random: the one that states more pairs with some chance, the other otherwise. Each draw prints a whole report; the average point lies on the dashed segment.",
      });
      const criterionSection = section("How the criterion errors are combined", ebarLine);
      const details = ctx.part(
        "notes",
        h(
          "section",
          { class: "prx-fr-deeper", "aria-label": "Mixtures and the half-cost endpoint" },
          section(T.mixHeading, mixIntro, mixBody),
          section(["The end at τ = ", half()], halfBody, h("h5", { class: "prx-fr-subheading", text: T.orderHeading }), orderBody, miniSlot),
          criterionSection,
        ),
      );
      const endpointBox = ctx.disclosure({ name: "endpoint", title: [TF.endpointBox[0], half(), TF.endpointBox[1]] });
      endpointBox.body.append(details);

      // --- Drawing helpers
      function drawKey() {
        const key = (cls, ...text) => h(
          "span",
          { class: "prx-fr-key" },
          h("span", { class: `prx-fr-swatch ${cls}` }),
          h("span", {}, ...text),
        );
        legend.replaceChildren(
          key("prx-fr-sw-mix", "mixture at m"),
          key("prx-fr-sw-best", "best single report at m"),
          key("prx-fr-sw-hull", "H(m): ", captionNode(ctx, "mixture-not-report")),
        );
      }
      drawKey();

      function drawHeadline(state, model, opt, sv) {
        const fmt = model.fmt;
        const fam = opt.family;
        const tauNode = ctx.num(state.tau, formatSetting(state.tau));
        const sym = famNode(fam);
        if (sv.vertices.length > 1) {
          const a = sv.vertices[0];
          const b = sv.vertices.at(-1);
          optimumLine.replaceChildren(
            "τ = ", tauNode, " in ", sym, ": the line of slope τ lies along the edge from ",
            ...point(model, a, "edgeA"), " to ", ...point(model, b, "edgeB"),
            "; the reports at both ends, ",
            ...opt.grades.flatMap((g, k) => [k ? " and " : "", gradeNum(`tiedGrade${k}`, g)]),
            `, share the smallest ${T.riskWords}, `, ro("risk", opt.risk, fmt.risk(opt.risk)), ".",
          );
        } else {
          const v = sv.vertex;
          optimumLine.replaceChildren(
            "τ = ", tauNode, " in ", sym, ": the line of slope τ touches H(m) at the vertex N = ",
            ro("N", v.N, formatCount(v.N)), ", E = ", ro("E", v.Ew, fmt.E(v.Ew)),
            ", the report ", gradeNum("grades", v.grade), `, with ${T.riskWords} `,
            ro("risk", opt.risk, fmt.risk(opt.risk)), ".",
          );
        }
        labelLine.replaceChildren(
          labelNode(ctx, opt),
          " (",
          familySizeNode(ctx, opt),
          ` ${T.reports}, every one evaluated). ${T.tolerance} `,
          ctx.num(opt.tieTol, formatSci(opt.tieTol, { trim: true })),
          ` ${T.toleranceGloss}`,
        );
      }

      function drawVertices(state, model, sv) {
        const fmt = model.fmt;
        const hull = model.hull;
        const touched = new Set(sv.vertices.map((v) => v.N));
        const th = (t) => h("th", { scope: "col", text: t });
        const rows = hull.map((v, q2) => {
          const s = model.slopes[q2];
          const mark = touched.has(v.N)
            ? h("span", { class: "prx-fr-touched" }, `${T.touchedMark} at τ = `, ctx.num(state.tau, formatSetting(state.tau)))
            : "";
          return h(
            "tr",
            { class: touched.has(v.N) ? "prx-fr-row-touched" : "" },
            h("th", { scope: "row" }, ro(`vN-${q2}`, v.N, formatCount(v.N))),
            h("td", {}, ro(`vE-${q2}`, v.Ew, fmt.E(v.Ew))),
            h("td", {}, gradeNum(`vGrade-${q2}`, v.grade), " ", mark),
            h("td", {}, s === undefined ? T.noNext : ro(`slope-${q2 + 1}`, s, fmt.slope(s))),
          );
        });
        vertexBox.replaceChildren(
          h("h4", { class: "prx-fr-heading", id: vertexHeadingId, text: T.vertexHeading }),
          h(
            "div",
            { class: "prx-fr-table-wrap" },
            h(
              "table",
              { class: "prx-fr-table", "aria-labelledby": vertexHeadingId },
              h("thead", {}, h("tr", {}, th("N"), th("E"), th("Report"), th("Slope of the next edge"))),
              h("tbody", {}, ...rows),
            ),
          ),
          h("p", { class: "prx-fr-note", text: T.vertexNote.replace("⟨E⟩", model.wrong) }),
        );
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
          lines.push(
            h(
              "p",
              {},
              "m = ", mNode(), " is a vertex: the report ", gradeNum("vertexGrade", mix.lower.grade),
              " itself reaches H(", mNode(), "); no mixture is needed.",
            ),
          );
        } else {
          lines.push(
            h(
              "p",
              {},
              "To reach it, print ", gradeNum("upperGrade", mix.upper.grade),
              " (N = ", ro("upperN", mix.upper.N, formatCount(mix.upper.N)),
              ") with chance ", ro("psi", mix.psi, fmt.psi(mix.psi)),
              " and ", gradeNum("lowerGrade", mix.lower.grade),
              " (N = ", ro("lowerN", mix.lower.N, formatCount(mix.lower.N)),
              ") otherwise. Each draw is a report we can print; their average point is ",
              captionNode(ctx, "mixture-not-report"), ".",
            ),
          );
          if (mix.best) {
            lines.push(
              h(
                "p",
                {},
                "The best single report that states exactly ", mNode(), " pairs is ",
                gradeNum("bestGrade", mix.best.grade),
                ", with E = ", ro("bestE", mix.best.Ew, fmt.E(mix.best.Ew)),
                ", which is ", ro("gap", mix.gap, fmt.E(mix.gap)), " above H(", mNode(), ").",
              ),
            );
          } else {
            lines.push(h("p", {}, "No report in ", famNode(fam), " states exactly ", mNode(), " pairs."));
          }
        }
        mixBody.replaceChildren(...lines);
      }

      function drawLottery(model, mix) {
        const fmt = model.fmt;
        const fmtRoE = (v, ref) => fmtRoExpected(model, v, ref);
        const n = (name, v) => ro(name, v, formatCount(v));
        const diamond = () => h("span", { class: "prx-fm-diamond", "aria-hidden": "true" });
        const row = (grade, N, chance, prefix) => h(
          "li",
          { class: "prx-fm-lot-row" },
          h(
            "span",
            { class: "prx-fm-chip" },
            ro(`lottery-${prefix}Grade`, Array.from(grade), formatGrades(Array.from(grade))),
            " · N ",
            n(`lottery-${prefix}N`, N),
          ),
          h("span", { class: "prx-fm-track", "aria-hidden": "true" }, h("span", { class: "prx-fm-fill", style: { width: `${100 * chance}%` } })),
          h("span", { class: "prx-fm-share" }, ro(`lottery-${prefix}Chance`, chance, fmt.psi(chance))),
        );
        if (mix.psi === 0) {
          lotteryTitle.textContent = TF.vertexTitle;
          lotteryRows.replaceChildren(row(mix.lower.grade, mix.lower.N, 1, "vertex"));
          lotteryAverage.replaceChildren(
            diamond(),
            TF.averageVertex,
            ro("lottery-m", mix.N, formatCount(mix.N)),
            ", E = ",
            ro("lottery-H", mix.H, fmtRoE(mix.H)),
          );
        } else {
          lotteryTitle.textContent = TF.lotteryTitle;
          lotteryRows.replaceChildren(
            row(mix.lower.grade, mix.lower.N, 1 - mix.psi, "lower"),
            row(mix.upper.grade, mix.upper.N, mix.psi, "upper"),
          );
          lotteryAverage.replaceChildren(
            diamond(),
            TF.averageMix,
            ro("lottery-m", mix.N, formatCount(mix.N)),
            ", E = ",
            ro("lottery-H", mix.H, fmtRoE(mix.H, mix.best?.Ew)),
          );
        }
      }

      function drawPill(model) {
        const lastV = model.hull.at(-1);
        if (model.eligible) {
          pill.setAttribute("data-prx-endpoint", "guaranteed");
          pill.replaceChildren("Endpoint at τ = ", half(), TF.pillYes);
        } else {
          pill.setAttribute("data-prx-endpoint", "not-guaranteed");
          pill.replaceChildren(
            "Endpoint at τ = ",
            half(),
            TF.pillNo,
            " (H(m) ends at N = ",
            ctx.num(lastV.N, formatCount(lastV.N)),
            " of ",
            ctx.num(model.M, formatCount(model.M)),
            ")",
          );
        }
      }

      // Concise <= 35-word 3-sig-fig readout (CP-1.2)
      function writeMixtureSummary(model, mix, state, sv) {
        const n = (v) => ctx.num(v, formatCount(v));
        const fmtRoE = (v, ref) => ctx.num(v, fmtRoExpected(model, v, ref));
        const psi = (v) => ctx.num(v, model.fmt.psi(v));
        const famCount = ro("familySize", model.cloud.family.size, formatCount(model.cloud.family.size));
        const support = [
          " (τ = ",
          ctx.num(state.tau, formatSetting(state.tau)),
          " touches N = ",
          n(sv.vertices[0].N),
          ...(sv.vertices.length === 1 ? [] : ["–", n(sv.vertices.at(-1).N)]),
          ").",
        ];
        if (mix.psi === 0) {
          const g = Array.from(mix.lower.grade);
          ctx.readout.set([
            "At m = ", n(mix.N), " pairs (", famCount, " reports), vertex report ",
            ctx.num(g, formatGrades(g)), " reaches H(", n(mix.N), ") = ", fmtRoE(mix.H),
            ": no mixture is needed",
            ...support,
          ]);
          return;
        }
        const parts = [
          "For mean m = ", n(mix.N), " pairs (", famCount, " reports), mixing N = ",
          n(mix.upper.N), " (chance ", psi(mix.psi), ") and N = ", n(mix.lower.N),
          " reaches E = ", fmtRoE(mix.H, mix.best?.Ew),
        ];
        if (mix.best) {
          parts.push(
            " vs. best single report ", fmtRoE(mix.best.Ew, mix.H),
            ", gap ", fmtRoE(mix.gap, 0),
          );
        } else {
          parts.push("; no single report states ", n(mix.N), " pairs");
        }
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
          halfBody.replaceChildren(
            h(
              "p",
              {},
              "In ", sym(), ", with no latent equality in this posterior (each pair's two error probabilities add to one), every edge of H(m) has a slope between ",
              ctx.num(0, formatCount(0)), " and ", half(), ". ",
              "Here the steepest is the last, ", ro("lastSlope", last, fmt.slope(last)),
              ", so a line of slope ", half(), " touches the last vertex, ",
              gradeNum("endGrade", end.grade), ", which states ", ro("endN", end.N, formatCount(end.N)),
              strict ? " pairs, all of them: a strict order." : " pairs.",
            ),
          );
        } else {
          const lastV = model.hull.at(-1);
          halfBody.replaceChildren(
            h("p", { class: "prx-fr-badge" }, "Endpoint at τ = ", half(), ": not guaranteed for this family"),
            h(
              "p",
              {},
              "With ", sym(), " the boundary ends at N = ", ro("capEndN", lastV.N, formatCount(lastV.N)),
              ", short of the ", ctx.num(model.M, formatCount(model.M)),
              " pairs a strict order states. The argument for the end at τ = ", half(),
              " refines every grade into a strict order, and this family does not allow that.",
            ),
          );
        }
        const o = tb19Model();
        const [v0, v1, v2] = o.hull;
        const lastO = o.slopes.at(-1);
        const law = CONFIG.tb19;
        const stateWords = (s) => s.map((row, i) => [i ? ", " : "", ctx.num(row[0], formatCount(row[0]))]).flat();
        orderBody.replaceChildren(
          h(
            "p",
            {},
            "The three-unit law of the page ", appLink(ctx, "which-ranking"),
            " (with probability ", ctx.num(law.probs[0], formatProb(law.probs[0], { digits: 1 })),
            " the true values of A, B and C are ", ...stateWords(law.states[0]),
            "; with probability ", ctx.num(law.probs[1], formatProb(law.probs[1], { digits: 1 })),
            " they are ", ...stateWords(law.states[1]),
            "). Keep its posterior-mean order A, B, C and allow only reports that cut that order into grades: the boundary has vertices (",
            ro("orderV0N", v0.N, formatCount(v0.N)), ", ", ro("orderV0E", v0.Ew, formatRational(v0.Ew)), "), (",
            ro("orderV1N", v1.N, formatCount(v1.N)), ", ", ro("orderV1E", v1.Ew, formatRational(v1.Ew)), ") and (",
            ro("orderV2N", v2.N, formatCount(v2.N)), ", ", ro("orderV2E", v2.Ew, formatRational(v2.Ew)),
            "). Its last edge has slope ", ro("orderLastSlope", lastO, formatRational(lastO)),
            ", steeper than ", half(), ", so a line of slope ", half(), " touches it at the report ",
            gradeNum("orderTouchGrade", o.sv.vertex.grade),
            ", not at the full order. A slope of at least ", ro("orderLastSlope2", lastO, formatRational(lastO)),
            " can touch the full order: at that slope the last two vertices touch together; above it the full order is the sole touched vertex. Such slopes lie outside the allowed range τ ≤ ",
            half(), ". For reports that keep one fixed order, the endpoint at τ = ", half(), " is not guaranteed for this family.",
          ),
          h(
            "p",
            { class: "prx-fr-note" },
            "In the small figure: dashed, the boundary within the order; dotted, a line of slope ", half(),
            " from (", ctx.num(v1.N, formatCount(v1.N)), ", ", ctx.num(v1.Ew, formatRational(v1.Ew)), ").",
          ),
        );
        drawMini(o);
        orderBody.prepend(
          h(
            "p",
            {},
            labelNode(ctx, ORDER_OPT, { key: "order" }),
            " (not H(m)); ",
            familySizeNode(ctx, ORDER_OPT),
            " reports along the posterior-mean order.",
          ),
        );
        const w = EX.tb16.weights;
        ebarLine.replaceChildren(
          `${T.ebarLine} `,
          ctx.num(w[0], formatRational(w[0])),
          " and ",
          ctx.num(w[1], formatRational(w[1])),
          T.ebarEnd,
          " ",
          appLink(ctx, "two-scores", { title: "One grade for two scores" }),
          T.ebarTail,
          " ",
          T.exampleNow,
        );
        criterionSection.hidden = state.example !== "tb16";
      }

      function drawMini(o) {
        const Mi = CONFIG.mini;
        const measured = Math.round(miniSlot.clientWidth || 0);
        const fallback = Math.max(240, Math.round(ctx.width()) - 56);
        const width = Math.min(Mi.width, measured > 0 ? Math.max(240, measured) : fallback);
        const hull = o.hull;
        const last = hull.at(-1);
        const prev = hull.at(-2);
        const ref = [
          { N: prev.N, y: prev.Ew },
          { N: last.N, y: prev.Ew + CONFIG.half * (last.N - prev.N) },
        ];
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
          keyboard: {
            data: hull,
            x: "N",
            y: "Ew",
            label: "The fixed-order frontier vertices",
            title: (v) => `${formatCount(v.N)} stated pairs, ${formatRational(v.Ew)} expected wrong directions, report ${formatGrades(v.grade)}`,
          },
          width,
          height: Mi.height,
          aspect: false,
          marginTop: 18,
          marginRight: 32,
          marginBottom: 40,
          marginLeft: 46,
          x: {
            domain: [-Mi.pad, o.M + Mi.pad],
            ticks: hull.map((v) => v.N),
            tickFormat: (d) => formatCount(d),
            label: T.xLabel,
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { domain: [0, yTop], label: "E", labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => [
            P.line(ref, { x: "N", y: "y", stroke: c.plotMuted, strokeDasharray: Mi.ref }),
            P.line(hull, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2, strokeDasharray: Mi.hullDash }),
            P.dot(hull, { x: "N", y: "Ew", r: Mi.dot, fill: c.plotFg, stroke: c.plotBg }),
            numText([{ N: (prev.N + last.N) / 2, y: (prev.Ew + last.Ew) / 2, s: o.slopes.at(-1) }], {
              x: "N",
              y: "y",
              value: "s",
              format: (v) => formatRational(v),
              dx: -8,
              textAnchor: "end",
              fill: c.plotFg,
            }),
            numText([{ N: last.N, y: ref[1].y, s: CONFIG.half }], {
              x: "N",
              y: "y",
              value: "s",
              format: (v) => formatRational(v),
              dx: 6,
              dy: 2,
              textAnchor: "start",
              fill: c.plotMuted,
            }),
          ],
        });
      }

      return {
        render(state, info = {}) {
          // Guard disclosure toggles (PR-06 / PR-09): only redraw the width-dependent mini SVG when endpoint opens.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "endpoint" || endpointBox.open) drawMini(tb19Model());
            return;
          }
          ctx.root.setAttribute("aria-busy", "true");
          try {
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
            const lo = model.hull[0].N;
            const hi = model.hull.at(-1).N;
            const m = Math.min(hi, Math.max(lo, state.m));
            const mSlider = mSliderFor(hi);
            if (mSlot.firstChild !== mSlider.root) mSlot.replaceChildren(mSlider.root);
            mSlider.set(m);
            const mix = matchedDisclosure(model.cloud, model.hull, m);
            if (m !== state.m) ctx.set({ m });

            reportIds = model.E.ids;
            vectorKey.textContent = `Vector positions: ${reportIds.join(" / ")}. Smaller grades mean higher priority; equal grades withhold. > means “stated above”.`;

            drawHeadline(state, model, opt, sv);
            drawChart(state, model, sv, mix);
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
