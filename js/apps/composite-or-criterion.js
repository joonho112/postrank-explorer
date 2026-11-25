export * from "../shared/domain/composite-or-criterion.js";

// Composite targets vs. criterion directions.
// Preserves 100% of ../shared/domain/composite-or-criterion.js re-exports (S1-02).
import { createWidget } from "../shared/base.js";
import { plot, svgScene } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatGrades,
  formatReadoutEst,
  formatReadoutProb,
  formatReadoutRisk,
  formatSci,
  formatSetting,
  tickLabel,
} from "../shared/format.js";
import { ro, tagNode } from "../shared/readout.js";
import { criteriaData } from "../shared/criteria-data.js";
import { CHAPTER19, KNOWN_COMPOSITE } from "../shared/criteria-laws.js";
import { PAIR_COST_CSS } from "../shared/domain/conflict-pairs.js";
import { CRITERIA_PROFILE_CSS, isCriterionPairKey } from "../shared/domain/several-criteria.js";
import {
  ESTIMAND_CSS,
  ESTIMAND_KEYS,
  createEstimandCostView,
  createEstimandLawView,
  createEstimandReportView,
  solveEstimands,
} from "../shared/domain/composite-or-criterion.js";

const COMPOSITE_TIE = { ...KNOWN_COMPOSITE, key: "tie", states: [[[1, -1], [0, 0]]] };
const LAWS = { known: KNOWN_COMPOSITE, tie: COMPOSITE_TIE, ch19: CHAPTER19 };
const TITLES = Object.freeze({
  known: "Known two-unit state",
  tie: "Known state, composite equality",
  ch19: "Four-unit two-state law",
  six: "Six independent Normal sites",
});

const COC_V2_CSS = `
.coc .coc-primary-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(11rem, 1fr));
  gap: 0.35rem 0.9rem;
  width: 100%;
  min-width: 0;
}
.coc .coc-primary-controls > .prx-control { min-width: 0; }
.coc .coc-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.85rem;
  align-items: flex-end;
  width: 100%;
  min-width: 0;
}
.coc .coc-settings > .prx-control,
.coc .coc-settings select {
  min-width: 0;
  max-width: 100%;
}
.coc .coc-pair-group { display: contents; }
.coc .coc-pair-group[hidden] { display: none; }
.coc.prx-widget[data-prx-frame="v2"] .prx-stage.coc-stage-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 0.45rem;
  padding: 0.65rem 0.8rem 0.55rem;
}
.coc .prx-stage.coc-stage-paper .coc-stage-note {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--prx-plot-muted);
}
.coc .coc-chart { min-width: 0; }
@media (min-width: 48.01em) {
  .coc.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.28rem 0.6rem;
    margin-bottom: 0.35rem;
  }
  .coc.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex: 1 1 28rem;
  }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    display: none;
  }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.24rem;
  }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    min-height: 1.92rem;
    padding: 0.14rem 0.48rem;
    font-size: 0.8125rem;
    line-height: 1.2;
  }
  .coc.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.92rem;
    padding: 0.14rem 0;
  }
}
@media (max-width: 48em) {
  .coc.prx-widget[data-prx-frame="v2"] { padding: 0.42rem 0.5rem; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.2rem 0.35rem; margin-bottom: 0.25rem; }
  .coc .coc-primary-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.2rem 0.45rem; }
  .coc .coc-primary-controls .prx-slider { font-size: 0.8125rem; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { display: none; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.18rem; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.16rem 0.38rem; font-size: 0.78rem; line-height: 1.15; }
  .coc.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.28rem; font-size: 0.88rem; line-height: 1.3; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-stage.coc-stage-paper { padding: 0.38rem 0.45rem 0.34rem; }
  .coc.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.34rem; gap: 0.28rem; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-caption { margin-top: 0.3rem; font-size: 0.78rem; line-height: 1.28; }
}
@media (max-width: 30em) {
  .coc.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 100%; width: 100%; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.16rem 0.18rem; }
  .coc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { font-size: 0.75rem; padding: 0.14rem 0.32rem; letter-spacing: -0.005em; }
}
`;

const nameSpan = (ctx, s) => ctx.h("span", { "data-prx-name": "", text: s });

function numNode(ctx, x, kind = "risk", hook) {
  const f = {
    risk: (v) => formatReadoutRisk(v),
    count: formatCount,
    grades: formatGrades,
    setting: formatSetting,
    prob: (v) => formatReadoutProb(v),
    sci: formatSci,
    est: (v) => formatReadoutEst(v),
    value: (v) => formatDecimal(v, { digits: 3 }),
  }[kind];
  const node = ctx.num(x, f(x));
  if (hook) node.dataset.prxReadout = hook;
  return node;
}

function tieWords(ctx, result, prefix) {
  return ctx.h(
    "p",
    { class: "estim-caption" },
    numNode(ctx, result.tieCount, "count", `${prefix}-tie-count`),
    result.tieCount === 1 ? " report has" : " reports have",
    " the smallest risk within equal-risk tolerance ",
    numNode(ctx, result.tieTol, "sci", `${prefix}-tie-tol`),
    ". ",
    result.tieCount > result.grades.length ? ctx.h("span", {}, "The list retains ", numNode(ctx, result.grades.length, "count"), " of them.") : null,
  );
}

function invarianceView(ctx, slot, model) {
  slot.replaceChildren(
    ctx.panelTitle("Preserve criterion directions, hold the decision fixed"),
    ctx.h(
      "p",
      { class: "estim-caption" },
      "The entire criterion best-report set is listed before and after the displayed positive transformations. The supplied law is pushed forward without refitting, and error weights, τ and family stay fixed. Composite reports can change because their target uses magnitudes.",
    ),
  );
  for (const [key, result, title] of [
    ["before", model.baselineCriterionOptimum, "Before the transform"],
    ["after", model.criterionOptimum, "After the transform"],
  ]) {
    slot.append(ctx.panelTitle(title), ctx.h("p", {}, tagNode(ctx, result)), tieWords(ctx, result, `invariance-${key}`));
    result.grades.forEach((grade, i) =>
      slot.append(
        ctx.h(
          "p",
          {},
          "Report ",
          ctx.num(grade, formatGrades(grade), {}),
          ", minimum criterion risk ",
          ctx.num(result.risk, formatDecimal(result.risk, { digits: 4 })),
          ".",
        ),
      ),
    );
    const pNodes = [...slot.querySelectorAll("p")];
    result.grades.forEach((_, i) => {
      const p = pNodes[pNodes.length - result.grades.length + i];
      const spans = p?.querySelectorAll(".prx-num");
      if (spans?.[0]) spans[0].dataset.prxReadout = `invariance-${key}-${i}`;
      if (spans?.[1]) spans[1].dataset.prxReadout = `invariance-risk-${key}-${i}`;
    });
  }
}

function drawKnownPlaneV2(ctx, section, chart, explanation, model) {
  section.hidden = model.route !== "finite" || model.law.states.length !== 1;
  if (section.hidden) return;
  const { i, j } = model.pair;
  const state = model.law.states[0];
  const points = [i, j].map((k, idx) => ({ id: model.ids[k], x: state[k][0], y: state[k][1], chosen: idx === 0 }));
  const [u, v] = points;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = (values) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const gap = hi - lo || Math.max(1, Math.abs(lo) * 0.2);
    return [lo - gap * 0.28, hi + gap * 0.28];
  };
  const xd = pad(xs);
  const yd = pad(ys);
  const c1 = model.a[0];
  const c2 = model.a[1] * model.multiplier[1];
  const dx = c2;
  const dy = -c1;
  const limits = (base, d, [lo, hi]) => (d === 0 ? [-Infinity, Infinity] : [(lo - base) / d, (hi - base) / d].sort((a, b) => a - b));
  const [xl, xh] = limits(v.x, dx, xd);
  const [yl, yh] = limits(v.y, dy, yd);
  const line = [Math.max(xl, yl), Math.min(xh, yh)].map((t) => ({ x: v.x + t * dx, y: v.y + t * dy }));
  const delta = model.compositeStates[0][i][0] - model.compositeStates[0][j][0];
  explanation.replaceChildren(
    "Dashed line: same composite value as ",
    nameSpan(ctx, v.id),
    ". ",
    nameSpan(ctx, u.id),
    delta === 0
      ? " lies on the line: composite equality, so the composite decision withholds."
      : delta > 0
        ? " lies on the higher composite side."
        : " lies on the lower composite side.",
  );
  plot(chart, {
    height: 240,
    marginLeft: 54,
    marginRight: 24,
    marginTop: 26,
    marginBottom: 44,
    x: { domain: xd, ticks: 5, inset: 12, grid: true, label: "First criterion value", labelArrow: "none" },
    y: { domain: yd, ticks: 5, inset: 12, grid: true, label: "Second criterion value", labelArrow: "none" },
    alt: "The two units on their criterion scales, with a line through the second unit at equal composite value. Changing the composite weights rotates that line.",
    keyboard: {
      data: points,
      x: "x",
      y: "y",
      key: "id",
      title: (d) => `${d.id}: first criterion ${formatSetting(d.x)}, second criterion ${formatSetting(d.y)}.`,
    },
    marks: (c, P) => [
      P.line(line, {
        x: "x",
        y: "y",
        stroke: c.plotMuted,
        strokeWidth: 2,
        strokeDasharray: "6 3",
        render(index, scales, values, dims, context, next) {
          const group = next(index, scales, values, dims, context);
          group.setAttribute("data-prx-composite-zero", "");
          return group;
        },
      }),
      P.dot(points, { x: "x", y: "y", fill: (d) => (d.chosen ? c.post : c.est), stroke: c.plotBg, strokeWidth: 1.5, r: 6.5 }),
      P.text(points, {
        x: "x",
        y: "y",
        text: "id",
        dy: -14,
        fontSize: 13,
        fontWeight: "bold",
        fill: c.plotFg,
        stroke: c.plotBg,
        strokeWidth: 3,
        paintOrder: "stroke",
      }),
    ],
  });
}

function actionLabel(ids, pair, action) {
  if (action === "withhold") return "Withhold";
  return action === "iAboveJ" ? `${ids[pair.i]} above ${ids[pair.j]}` : `${ids[pair.j]} above ${ids[pair.i]}`;
}

function shortActionLabel(ids, pair, action) {
  if (action === "withhold") return "withhold";
  return action === "iAboveJ" ? `${ids[pair.i]} > ${ids[pair.j]}` : `${ids[pair.j]} > ${ids[pair.i]}`;
}

function divergenceBannerText(model, wide) {
  const { ids, pair, pairCosts } = model;
  const pairText = `${ids[pair.i]} vs. ${ids[pair.j]}`;
  const cBest = pairCosts.criterion.best;
  const mBest = pairCosts.composite.best;
  const fmtSet = (list) => list.map((act) => shortActionLabel(ids, pair, act)).join(" / ");
  const same = cBest.length === mBest.length && cBest.every((x) => mBest.includes(x));
  if (same) {
    return {
      diverges: false,
      text: wide ? `Pair ${pairText}: both objectives prefer ${fmtSet(cBest)}` : `${pairText}: both pick ${fmtSet(cBest)}`,
    };
  }
  const oppositeStrict =
    cBest.length === 1 &&
    mBest.length === 1 &&
    ((cBest[0] === "iAboveJ" && mBest[0] === "jAboveI") || (cBest[0] === "jAboveI" && mBest[0] === "iAboveJ"));
  if (oppositeStrict) {
    return {
      diverges: true,
      text: wide
        ? `Direction flip (${pairText}): criterion picks ${fmtSet(cBest)}; composite picks ${fmtSet(mBest)}`
        : `Flip (${pairText}): ${fmtSet(cBest)} vs. ${fmtSet(mBest)}`,
    };
  }
  return {
    diverges: true,
    text: wide
      ? `Pair ${pairText} diverges: criterion ${fmtSet(cBest)} vs. composite ${fmtSet(mBest)}`
      : `${pairText}: ${fmtSet(cBest)} vs. ${fmtSet(mBest)}`,
  };
}

function nudgeReportPlotTitle(reportsEl) {
  for (const svg of reportsEl.querySelectorAll("svg")) {
    const yLbl = svg.querySelector('g[aria-label="y-axis label"] text');
    if (!yLbl) continue;
    yLbl.setAttribute("dy", "-8");
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[1] === 0) {
      svg.setAttribute("viewBox", `${vb[0]} -10 ${vb[2]} ${vb[3] + 10}`);
    }
  }
}

function drawStageComparison(ctx, host, model) {
  const { ids, pair, pairCosts, tau } = model;
  const measuredW = Math.round(host.clientWidth || host.getBoundingClientRect?.().width || 0);
  const W = Math.max(200, measuredW || 680);
  const wide = W >= 620;
  const bannerH = wide ? 32 : 25;
  const panelH = wide ? 244 : 138;
  const panelGap = wide ? 26 : 10;
  const H = wide ? bannerH + panelH + 8 : bannerH + panelH * 2 + panelGap + 4;
  const actions = ["iAboveJ", "jAboveI", "withhold"];
  const banner = divergenceBannerText(model, wide);

  const tableRows = [];
  for (const [key, objLabel] of [
    ["criterion", "Criterion directions"],
    ["composite", "Composite direction"],
  ]) {
    const dec = pairCosts[key];
    for (const act of actions) {
      tableRows.push({
        objective: objLabel,
        action: actionLabel(ids, pair, act),
        cost: dec.costs[act],
        smallest: dec.best.includes(act) ? "Yes" : "No",
      });
    }
  }

  svgScene(
    host,
    {
      width: W,
      height: H,
      alt: `Isolated-pair cost comparison for ${ids[pair.i]} versus ${ids[pair.j]} under criterion-direction loss and composite-direction loss, with withholding threshold tau.`,
      table: {
        caption: `Isolated-pair action costs for ${ids[pair.i]} and ${ids[pair.j]}`,
        columns: [
          { label: "Objective", value: "objective", name: true },
          { label: "Action", value: "action", name: true },
          { label: "Cost", value: "cost", format: (v) => formatReadoutRisk(v) },
          { label: "Smallest cost", value: "smallest", name: true },
        ],
        rows: tableRows,
      },
    },
    (scene) => {
      const { el, doc, palette: pal } = scene;
      const space = () => doc.createTextNode(" ");

      // Top divergence summary pill (rx: 3, fill: plotBg per WB-03)
      const bannerW = Math.min(W - 8, Math.max(160, Math.round(banner.text.length * 6.9 + 20)));
      const bannerX = Math.round((W - bannerW) / 2);
      scene.add(
        el("rect", {
          x: bannerX,
          y: 2,
          width: bannerW,
          height: 21,
          rx: 3,
          fill: pal.plotBg,
          stroke: banner.diverges ? pal.est : pal.plotGrid,
          strokeWidth: banner.diverges ? 1.4 : 1,
        }),
        el("text", {
          x: Math.round(W / 2),
          y: 17,
          textAnchor: "middle",
          fontSize: 13,
          fontWeight: 600,
          fill: banner.diverges ? pal.estText : pal.plotFg,
          dataset: { prxName: "" },
          text: banner.text,
        }),
        space(),
      );

      const specs = [
        {
          key: "criterion",
          title: "Criterion directions",
          barFill: pal.crit[0],
          ink: pal.critInk[0],
          pX: 2,
          pY: bannerH + 2,
          pW: wide ? Math.floor((W - panelGap - 4) / 2) : W - 4,
        },
        {
          key: "composite",
          title: "Composite direction",
          barFill: pal.crit[1],
          ink: pal.critInk[1],
          pX: wide ? 2 + Math.floor((W - panelGap - 4) / 2) + panelGap : 2,
          pY: wide ? bannerH + 2 : bannerH + 2 + panelH + panelGap,
          pW: wide ? W - 4 - Math.floor((W - panelGap - 4) / 2) - panelGap : W - 4,
        },
      ];

      const ticks = [0, 0.5, 1];
      for (const s of specs) {
        const dec = pairCosts[s.key];
        const maxIdLen = Math.max(ids[pair.i].length, ids[pair.j].length);
        const labelW = maxIdLen >= 4 ? 100 : wide ? 84 : 78;
        const valW = wide ? 54 : 50;
        const insetL = 6;
        const insetR = 8;
        const trackX0 = s.pX + labelW + insetL;
        const trackX1 = s.pX + s.pW - valW - insetR;
        const trackW = Math.max(52, trackX1 - trackX0);
        const xAt = (v) => trackX0 + Math.max(0, Math.min(1, v)) * trackW;

        const rowPitch = wide ? 45 : 24;
        const firstRowY = s.pY + (wide ? 72 : 48);
        const lastRowY = firstRowY + rowPitch * 2;
        const axisY = lastRowY + (wide ? 26 : 15);

        // Panel title in --prx-crit-ink-1..2 (>= 4.5:1 contrast)
        scene.add(
          el("text", {
            x: s.pX + 2,
            y: s.pY + (wide ? 16 : 14),
            fontSize: 13.5,
            fontWeight: 700,
            fill: s.ink,
            text: s.title,
          }),
          space(),
        );

        // Subtle gridlines and x-axis ticks
        const tickGroup = el("g", { "aria-label": "x-axis tick label" });
        for (const tv of ticks) {
          const tx = xAt(tv);
          scene.add(
            el("line", {
              x1: tx,
              y1: firstRowY - 12,
              x2: tx,
              y2: axisY - 4,
              stroke: pal.plotGrid,
              strokeWidth: 1,
            }),
          );
          const lbl = tickLabel(tv, 0, ticks);
          tickGroup.append(
            el("text", {
              x: tx,
              y: axisY + 10,
              textAnchor: tv === 0 ? "start" : tv === 1 ? "end" : "middle",
              fontSize: 13,
              fill: pal.plotMuted,
              "data-num": dataNum(tv),
              text: lbl,
            }),
            space(),
          );
        }
        scene.add(
          el("line", {
            x1: trackX0,
            y1: axisY - 4,
            x2: trackX1,
            y2: axisY - 4,
            stroke: pal.plotAxis,
            strokeWidth: 1,
          }),
          tickGroup,
        );

        // Vertical dashed tau threshold line + rx: 3 plotBg pill (WB-03)
        const tauX = xAt(tau);
        const tauStr = formatSetting(tau);
        const tauFull = `τ = ${tauStr}`;
        const tauPillW = Math.round(tauFull.length * 7 + 10);
        const tauClampedX = Math.max(trackX0 + tauPillW / 2, Math.min(trackX1 - tauPillW / 2, tauX));
        const tauText = el(
          "text",
          {
            x: tauClampedX,
            y: s.pY + (wide ? 39 : 34),
            textAnchor: "middle",
            fontSize: 13,
            fontWeight: 600,
            fill: pal.plotMuted,
          },
          "τ = ",
          el("tspan", { text: tauStr, "data-num": dataNum(tau) }),
        );
        scene.add(
          el("line", {
            x1: tauX,
            y1: firstRowY - 13,
            x2: tauX,
            y2: axisY - 4,
            stroke: pal.plotAxis,
            strokeWidth: 1.4,
            strokeDasharray: "4 3",
          }),
          el("rect", {
            x: Math.round(tauClampedX - tauPillW / 2),
            y: s.pY + (wide ? 26 : 21),
            width: tauPillW,
            height: 17,
            rx: 3,
            fill: pal.plotBg,
            stroke: pal.plotGrid,
            strokeWidth: 0.9,
          }),
          tauText,
          space(),
        );

        // Three horizontal action bars + right-column rx: 3 plotBg value pills
        actions.forEach((act, idx) => {
          const cy = firstRowY + idx * rowPitch;
          const cost = dec.costs[act];
          const best = dec.best.includes(act);
          const lbl = actionLabel(ids, pair, act);
          const barH = wide ? 16 : 14;
          const barW = Math.max(cost > 0 ? 2.5 : 0, xAt(cost) - trackX0);
          const pillX = s.pX + s.pW - valW;
          const pillW = valW - 2;

          scene.add(
            el("text", {
              x: s.pX + labelW,
              y: cy + 4.5,
              textAnchor: "end",
              fontSize: 13,
              fontWeight: best ? 700 : 500,
              fill: best ? pal.plotFg : pal.plotMuted,
              dataset: { prxName: "" },
              text: lbl,
            }),
            space(),
            el("rect", {
              x: trackX0,
              y: cy - barH / 2,
              width: trackW,
              height: barH,
              rx: 3,
              fill: pal.plotGrid,
              fillOpacity: 0.45,
            }),
            el("rect", {
              x: trackX0,
              y: cy - barH / 2,
              width: barW,
              height: barH,
              rx: 3,
              fill: act === "withhold" ? pal.wh : s.barFill,
              fillOpacity: best ? 0.92 : 0.44,
              stroke: best ? pal.plotFocus : "none",
              strokeWidth: best ? 2 : 0,
            }),
            el("rect", {
              x: pillX,
              y: cy - (wide ? 9.5 : 8.5),
              width: pillW,
              height: wide ? 19 : 17,
              rx: 3,
              fill: pal.plotBg,
              stroke: best ? pal.plotFocus : pal.plotGrid,
              strokeWidth: best ? 1.5 : 0.85,
            }),
            el("text", {
              x: Math.round(pillX + pillW / 2),
              y: cy + 4.5,
              textAnchor: "middle",
              fontSize: 13,
              fontWeight: best ? 700 : 500,
              fill: best ? s.ink : pal.plotFg,
              "data-num": dataNum(cost),
              "data-prx-readout": `overview-${s.key}-${act}`,
              text: formatReadoutRisk(cost),
            }),
            space(),
          );
        });
      }
    },
  );
}

function buildControls(ctx) {
  const { h } = ctx;
  const primary = h("div", { class: "coc-primary-controls" });
  const w = ctx.slider({
    label: "Error weight w",
    ...ctx.key("w"),
    onInput: (v) => ctx.set({ w: v }),
  });
  const a = ctx.slider({
    label: "Composite weight a",
    ...ctx.key("a"),
    onInput: (v) => ctx.set({ a: v }),
  });
  primary.append(w.root, a.root);
  ctx.controls.append(primary);
  ctx.primaryControl(a.root);

  const data = ctx.select({
    label: "Supplied law",
    name: "data",
    options: Object.entries(TITLES).map(([value, label]) => ({ value, label })),
    onChange: (v) => ctx.set({ data: v, pair: "auto", ...(v === "six" ? { transform: "identity" } : {}) }),
  });
  const tau = ctx.slider({
    label: "Withholding cost τ",
    ...ctx.key("tau"),
    onInput: (v) => ctx.set({ tau: v }),
  });
  const multiplier = ctx.slider({
    label: "Positive multiplier for the second criterion",
    ...ctx.key("multiplier"),
    onInput: (v) => ctx.set({ multiplier: v }),
  });
  const cap = ctx.select({
    label: "Same report family for both losses",
    name: "cap",
    options: [
      { value: "all", label: "All grade reports" },
      { value: "2", label: "At most two grades" },
      { value: "3", label: "At most three grades" },
    ],
    onChange: (v) => ctx.set({ cap: v }),
  });
  const transform = ctx.select({
    label: "Whole finite-law transformation",
    name: "transform",
    options: [
      { value: "identity", label: "Original values" },
      { value: "exp", label: "Exponentiate every finite input value" },
    ],
    onChange: (v) => ctx.set({ transform: v }),
  });

  const advanced = h("div", { class: "coc-settings" }, data.root, tau.root, multiplier.root, cap.root, transform.root);
  const pairs = {};
  for (const key of Object.keys(TITLES)) {
    const ids = key === "six" ? criteriaData("six").ids : LAWS[key].ids;
    const pair = ctx.select({
      label: "Inspect this isolated pair",
      name: `pair-${key}`,
      options: [
        { value: "auto", label: "Source example pair" },
        ...ids.flatMap((id, i) => ids.flatMap((other, j) => (i === j ? [] : [{ value: `${id},${other}`, label: `${id} above ${other}` }]))),
      ],
      onChange: (v) => ctx.set({ pair: v }),
    });
    const group = h("div", { class: "coc-pair-group" }, pair.root);
    advanced.append(group);
    pairs[key] = { pair, group };
  }

  return {
    advanced,
    render(state) {
      data.set(state.data);
      w.set(state.w);
      a.set(state.a);
      tau.set(state.tau);
      multiplier.set(state.multiplier);
      cap.set(state.cap);
      transform.set(state.transform);
      transform.root.hidden = state.data === "six";
      for (const key of Object.keys(TITLES)) {
        pairs[key].group.hidden = key !== state.data;
        pairs[key].pair.set(state.pair);
      }
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "composite-or-criterion",
    className: "estim coc",
    css: ESTIMAND_CSS + PAIR_COST_CSS + CRITERIA_PROFILE_CSS + COC_V2_CSS,
    frame: "v2",
    keys: ESTIMAND_KEYS,
    build(ctx) {
      ctx.root.classList.add("cp", "sev");
      const { h } = ctx;
      const R = ro(ctx);

      const control = buildControls(ctx);
      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(control.advanced);

      ctx.stage.classList.add("coc-stage-paper");
      const stageChart = h("div", { class: "coc-chart" });
      const normalSummary = h("p", { class: "coc-stage-note", hidden: true });
      const selectedReports = h("section", { class: "estim-caption", "aria-label": "Reports and selected pair" });
      ctx.stage.append(stageChart, selectedReports, normalSummary);

      const costRoot = h("div", { class: "estim-grid estim-section" });
      const costSlots = {
        criterion: h("div", { class: "estim-cost sev-paper" }),
        composite: h("div", { class: "estim-cost sev-paper" }),
      };
      costRoot.append(costSlots.criterion, costSlots.composite);
      const law = h("div", { class: "sev-paper estim-section" });
      const reports = h("div", { class: "sev-paper estim-section" });
      const dataBox = ctx.dataBox("Data and exact values");
      dataBox.body.append(costRoot, law, reports);

      const planeChart = h("div");
      const planeNote = h("p", { class: "estim-caption", "data-prx-composite-side": "" });
      const plane = h("section", { class: "sev-paper estim-section" }, ctx.panelTitle("Why the composite direction changes"), planeChart, planeNote);
      const weights = h("div", { class: "estim-weights sev-paper estim-section" });
      const invariance = h("div", { class: "sev-paper estim-section" });
      const methodBox = ctx.methodBox("Method, weights and invariance");
      methodBox.body.append(plane, weights, invariance);

      const costView = createEstimandCostView(ctx, costSlots);
      const lawView = createEstimandLawView(ctx, law);
      const reportView = createEstimandReportView(ctx, reports);

      let currentModel = null;

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            const m = currentModel ?? solveEstimands(state);
            if (info.disclosure === "data") {
              costView.render(m);
              reportView.render(m);
              nudgeReportPlotTitle(reports);
            } else if (info.disclosure === "method") {
              drawKnownPlaneV2(ctx, plane, planeChart, planeNote, m);
            }
            return;
          }

          const model = solveEstimands(state);
          currentModel = model;
          const correction = {};
          if (model.ids.length === 2 && state.cap === "3") correction.cap = "2";
          if (state.data === "six" && state.transform !== "identity") correction.transform = "identity";
          if (!isCriterionPairKey({ ids: model.ids }, state.pair)) correction.pair = "auto";
          if (Object.keys(correction).length) ctx.set(correction);

          control.render(state);
          drawStageComparison(ctx, stageChart, model);

          normalSummary.hidden = model.route !== "normal";
          if (!normalSummary.hidden) {
            normalSummary.replaceChildren(
              "First unit ",
              nameSpan(ctx, model.ids[0]),
              " has composite mean ",
              numNode(ctx, model.composite.mean[0], "value"),
              ".",
            );
          }

          costView.render(model);
          lawView.render(model);
          reportView.render(model);
          nudgeReportPlotTitle(reports);
          drawKnownPlaneV2(ctx, plane, planeChart, planeNote, model);
          invarianceView(ctx, invariance, model);

          weights.replaceChildren(
            ctx.panelTitle("Three roles for weights"),
            h(
              "p",
              {},
              "Error weights w = ",
              numNode(ctx, model.w[0], "setting", "w-first"),
              ", ",
              numNode(ctx, model.w[1], "setting", "w-second"),
              " price criterion-specific wrong directions. Composite coefficients a = ",
              numNode(ctx, model.a[0], "setting", "a-first"),
              ", ",
              numNode(ctx, model.a[1], "setting", "a-second"),
              " build a new target from magnitudes.",
            ),
            h(
              "p",
              {},
              "The second criterion is multiplied by ",
              numNode(ctx, model.multiplier[1], "setting", "multiplier"),
              " for every unit in every finite state, or in the declared independent Normal composite. Both a and w stay nonnegative and sum to ",
              numNode(ctx, 1, "setting"),
              ".",
            ),
            h(
              "p",
              {},
              "Expected-rank averaging weights have a third role: they average criterion-specific positions. They do not turn the weighted criterion loss into a composite target. The composite objective here has one constructed target with error weight ",
              numNode(ctx, 1, "setting"),
              ".",
            ),
            h("p", {}, "Even numerically equal w and a need not give the same loss or the same report."),
          );

          const critG = model.criterionOptimum.grade;
          const compG = model.compositeOptimum.grade;
          const { i, j } = model.pair;
          selectedReports.replaceChildren(h("p", {}, "Criterion report ", numNode(ctx, critG, "grades"),
            " · composite report ", numNode(ctx, compG, "grades"), " in site order ", model.ids.join(", "), "."));
          if (model.route === "finite") {
            const value = model.law.states[0], composite = model.compositeStates[0];
            selectedReports.append(h("p", {}, "In the first whole state (mass ", numNode(ctx, model.law.probs[0], "prob"), "), ",
              ...[i, j].flatMap((unit, index) => [index ? "; " : "", model.ids[unit], " has criterion values ",
                numNode(ctx, value[unit][0], "value"), ", ", numNode(ctx, value[unit][1], "value"),
                " and composite ", numNode(ctx, composite[unit][0], "value")]), "."));
          }
          const sameOpt = critG.length === compG.length && critG.every((v, idx) => v === compG[idx]);
          R.set([
            "Criterion directions pick ",
            numNode(ctx, critG, "grades", "criterion-grade"),
            " (risk ",
            R.risk(model.criterionOptimum.risk, { hook: "criterion-risk" }),
            sameOpt ? ") and the composite also picks " : "), whereas the composite picks ",
            numNode(ctx, compG, "grades", "composite-grade"),
            " (risk ",
            R.risk(model.compositeOptimum.risk, { hook: "composite-risk" }),
            ") under the same family and τ.",
          ]);

          ctx.caption.replaceChildren(
            "Synthetic supplied laws after the postrank theory book and vignette m2. Grade ",
            R.count(1),
            " is stated highest; a shared grade withholds. Synthetic data license CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            ".",
          );
        },
      };
    },
  });
}
