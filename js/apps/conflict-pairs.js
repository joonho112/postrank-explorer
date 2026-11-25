// App entry point for 4.2 conflict-pairs.
// Preserves all domain exports from ../shared/domain/conflict-pairs.js (S1-02).
export * from "../shared/domain/conflict-pairs.js";

import { createWidget } from "../shared/base.js";
import { plot, svgEl, svgScene } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { ro } from "../shared/readout.js";
import { pairCount } from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import {
  CERTAIN_OPPOSITION,
  CHAPTER19,
  UNCERTAIN_AGREEMENT,
  finiteCriteria,
} from "../shared/criteria-laws.js";
import {
  CRITERIA_PROFILE_CSS,
  createCriterionConflictView,
  createCriterionPairView,
  isCriterionPairKey,
  preferredCriterionDirection,
} from "../shared/domain/several-criteria.js";
import {
  CONFLICT_PAIR_KEYS,
  PAIR_COST_CSS,
  conflictPairModel,
} from "../shared/domain/conflict-pairs.js";

const TIES = {
  ids: ["A", "B"],
  criteria: ["criterion 1", "criterion 2"],
  states: [
    [[1, -1], [0, 0]],
    [[-1, 1], [0, 0]],
    [[0, 0], [0, 0]],
  ],
  probs: [0.4, 0.1, 0.5],
};
const LAWS = { ch19: CHAPTER19, opposition: CERTAIN_OPPOSITION, uncertain: UNCERTAIN_AGREEMENT, ties: TIES };
const TITLES = {
  six: "Six sites · two scores",
  thirty: "Thirty sites · three criteria",
  ch19: "Four-unit law: B–C conflict",
  opposition: "Two certain opposing criteria",
  uncertain: "Uncertain, criteria agree",
  ties: "Latent equality",
};

const CONFLICT_V2_CSS = `${PAIR_COST_CSS}${CRITERIA_PROFILE_CSS}
.cp .prx-stage,
.cp .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.cp.prx-widget[data-prx-frame="v2"] .prx-toolbar { align-items: flex-end; gap: 0.28rem 0.6rem; margin-bottom: 0.38rem; }
.cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls { flex: 1 1 100%; align-items: flex-end; gap: 0.35rem 0.85rem; }
.cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider { flex: 1 1 11rem; max-width: 18rem; }
.cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 0; }
@media (min-width: 48.01em) {
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets { display: flex; align-items: flex-start; gap: 0.45rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { margin: 0.25rem 0 0; font-size: 0.78rem; line-height: 1.15; white-space: nowrap; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem 0.28rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { min-height: 1.75rem; padding: 0.14rem 0.44rem; font-size: 0.8125rem; line-height: 1.18; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { min-height: 1.75rem; padding: 0.12rem 0; }
}
@media (max-width: 48em) {
  .cp.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { display: none; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.16rem 0.44rem; font-size: 0.8125rem; line-height: 1.15; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { padding: 0.16rem 0; font-size: 0.8125rem; }
  .cp.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.35rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.55rem; }
  .cp.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.4rem; }
}
@media (max-width: 30em) {
  .cp.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 100%; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.18rem 0.2rem; }
  .cp.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { font-size: 0.78rem; padding: 0.16rem 0.38rem; }
}
.cp .cp-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
  gap: 0.85rem 1rem;
  align-items: start;
  min-width: 0;
}
@media (max-width: 52em) {
  .cp .cp-stage-grid { grid-template-columns: minmax(0, 1fr); gap: 0.7rem; }
}
.cp .cp-stage-col { min-width: 0; max-width: 100%; }
.cp .prx-stage .cp-col-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.6rem;
  margin: 0 0 0.25rem;
}
.cp .prx-stage .cp-col-head .prx-panel-title { margin: 0; color: var(--prx-plot-fg); }
.cp .prx-stage .cp-stage-cue {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--prx-plot-muted);
}
.cp .cp-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.55rem 0.9rem;
  width: 100%;
  min-width: 0;
}
.cp .cp-settings-grid .prx-control,
.cp .cp-settings-grid select { max-width: 100%; min-width: 0; }
.cp .cp-data-stack { display: grid; gap: 0.75rem; min-width: 0; }
.cp .cp-data-stack .cp-section { margin: 0; }
.cp .cp-method-note { margin: 0.35rem 0; font-size: 0.875rem; line-height: 1.45; color: var(--prx-fg); }
`;

const nameNode = (ctx, id) => ctx.h("span", { "data-prx-name": "", text: id });
const words = (ids, pair, action) =>
  action === "withhold" ? "Withhold" : action === "iAboveJ" ? `${ids[pair.i]} above ${ids[pair.j]}` : `${ids[pair.j]} above ${ids[pair.i]}`;

function numberNode(ctx, x, kind = "cost", hook) {
  const display = kind === "count"
    ? formatCount(x)
    : kind === "prob"
      ? formatProb(x)
      : kind === "setting"
        ? formatSetting(x)
        : kind === "sci"
          ? formatSci(x)
          : kind === "value"
            ? formatDecimal(x, { digits: 3 })
            : formatRisk(x);
  const n = ctx.num(x, display);
  if (hook) n.dataset.prxReadout = hook;
  return n;
}

function visibleTable(ctx, headers, rows, cls) {
  return ctx.h(
    "table",
    { class: cls },
    ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((h) => ctx.h("th", { scope: "col" }, h)))),
    ctx.h("tbody", {}, ...rows.map((row) => ctx.h("tr", {}, ...row.map((v) => ctx.h("td", {}, v)))))
  );
}

function scrollWrap(ctx, parent, label, node) {
  const root = ctx.h("div", { class: "sev-scroll" }, node);
  ctx.scrollRegion(root, label);
  parent.append(root);
}

const finiteMetaCache = new Map();
function finiteMeta(key) {
  if (finiteMetaCache.has(key)) return finiteMetaCache.get(key);
  const law = LAWS[key];
  const E = finiteCriteria(law);
  const data = {
    key,
    ids: law.ids,
    criteria: law.criteria,
    criterionLabels: ["first criterion", "second criterion"],
    n: law.ids.length,
    K: law.criteria.length,
    M: pairCount(law.ids.length),
  };
  finiteMetaCache.set(key, data);
  return data;
}

function scalePos(scale, v) {
  if (!scale || v === undefined || v === null) return null;
  const p = scale.apply(v);
  if (!Number.isFinite(p)) return null;
  return scale.bandwidth ? p + scale.bandwidth / 2 : p;
}

function buildControls(ctx) {
  const tau = ctx.slider({
    label: "Cost of withholding this pair, τ",
    ...ctx.key("tau"),
    onInput: (v) => ctx.set({ tau: v }),
  });
  const w = ctx.slider({
    label: "Error weight on the first criterion",
    ...ctx.key("w"),
    onInput: (v) => ctx.set({ w: v }),
  });
  ctx.controls.append(ctx.primaryControl(tau.root), w.root);

  const settings = ctx.settingsBox("Settings");
  const data = ctx.select({
    label: "Supplied law",
    name: "data",
    options: Object.entries(TITLES).map(([value, label]) => ({ value, label })),
    onChange: (v) => ctx.set({ data: v, pair: "auto" }),
  });
  const secondary = ctx.h("div", { class: "cp-settings-grid" }, data.root);
  const pairs = {};
  for (const key of Object.keys(TITLES)) {
    const d = key === "six" || key === "thirty" ? criteriaData(key) : finiteMeta(key);
    const options = d.ids.flatMap((id, i) =>
      d.ids.flatMap((other, j) => (i === j ? [] : [{ value: `${id},${other}`, label: `${id} above ${other}` }]))
    );
    const pair = ctx.select({
      label: "Proposed pair direction",
      name: `pair-${key}`,
      options: [{ value: "auto", label: "Source example pair" }, ...options],
      onChange: (v) => ctx.set({ pair: v }),
    });
    const group = ctx.h("div", { class: "cp-source-group" }, pair.root);
    secondary.append(group);
    pairs[key] = { pair, group };
  }
  settings.body.append(secondary);

  return {
    render(state) {
      data.set(state.data);
      w.set(state.w);
      tau.set(state.tau);
      const isThirty = state.data === "thirty";
      w.setDisabled(isThirty);
      w.root.hidden = isThirty;
      for (const key of Object.keys(TITLES)) {
        pairs[key].group.hidden = key !== state.data;
        pairs[key].pair.set(state.pair);
      }
    },
  };
}

function drawActionBarsStage(figHost, model, isCompact = false) {
  const { data: d, pair, kind } = model;
  const decision = model.decision ?? model.weighted.decision;
  const actions = ["iAboveJ", "jAboveI", "withhold"];
  const rows = actions.map((action) => ({
    action,
    label: words(d.ids, pair, action),
    cost: decision.costs[action],
    best: decision.best.includes(action),
  }));
  const height = isCompact ? 196 : 258;
  const marginLeft = d.ids.some((id) => id.length > 2) ? 148 : 98;
  const marginRight = 48;

  const chart = plot(figHost, {
    height,
    marginTop: 14,
    marginLeft,
    marginRight,
    marginBottom: 40,
    x: {
      domain: [0, 1],
      insetRight: 4,
      label: kind === "known state" ? "Cost at known state" : "Expected standalone cost",
      grid: true,
    },
    y: { domain: rows.map((r) => r.label), label: null, padding: 0.3 },
    alt: "Three horizontal bars compare the forward direction, reverse direction and withholding cost. An outline marks every action sharing the smallest cost.",
    table: rows,
    keyboard: {
      data: rows,
      x: "cost",
      y: "label",
      title: (r) => `${r.label}: ${formatRisk(r.cost)}${r.best ? "; among the smallest costs" : ""}.`,
    },
    marks: (c, P) => [
      P.barX(rows, {
        x: "cost",
        y: "label",
        fill: (r) => (r.action === "withhold" ? c.wh : c.err),
        stroke: (r) => (r.best ? c.plotFocus : c.plotBg),
        strokeWidth: (r) => (r.best ? 2.2 : 0),
        rx: 2.5,
      }),
      P.tip(rows, P.pointer({ x: "cost", y: "label", title: (r) => `${r.label}: ${formatReadoutRisk(r.cost)}` })),
    ],
  });

  const { svg, palette: pal } = chart;
  const doc = svg.ownerDocument;
  for (const t of svg.querySelectorAll("text")) {
    if (d.ids.some((id) => (t.textContent || "").includes(id))) t.setAttribute("data-prx-name", "");
  }

  // Add crisp 3-sig-fig direct value pills (rx: 3, fill: plotBg) so labels never collide or protrude.
  const sx = chart.scale("x");
  const sy = chart.scale("y");
  const svgW = Number(svg.getAttribute("width")) || 320;
  const layer = svgEl(doc, "g", { "aria-hidden": "true", style: { pointerEvents: "none" } });
  for (const r of rows) {
    const px = scalePos(sx, r.cost);
    const py = scalePos(sy, r.label);
    if (px === null || py === null) continue;
    const txt = formatReadoutRisk(r.cost);
    const pillW = Math.max(24, txt.length * 7.8 + 8);
    const pillH = 16.5;
    const placeInside = px + 6 + pillW > svgW - 4;
    const pillX = placeInside ? Math.max(marginLeft + 4, px - pillW - 6) : px + 5;
    layer.append(
      svgEl(doc, "rect", {
        x: pillX,
        y: py - pillH / 2,
        width: pillW,
        height: pillH,
        rx: 3,
        fill: pal.plotBg,
        stroke: r.best ? pal.plotFocus : pal.plotBg,
        strokeWidth: r.best ? 1.2 : 1,
      }),
      svgEl(doc, "text", {
        x: pillX + pillW / 2,
        y: py + 4.5,
        textAnchor: "middle",
        fill: pal.plotFg,
        fontWeight: 700,
        "data-num": String(r.cost),
        text: txt,
      })
    );
  }
  svg.append(layer);
}

function drawCriterionDirectionsStage(host, model, isCompact = false) {
  const { data: d, pair, criteria, w, states, weighted, conflicts } = model;
  const aId = d.ids[pair.i];
  const bId = d.ids[pair.j];
  const K = d.K;
  const bandH = isCompact ? (K === 3 ? 58 : 68) : (K === 3 ? 70 : 90);
  const footerH = isCompact ? 46 : 58;
  const height = 10 + K * bandH + footerH;
  const leftPad = Math.max(aId.length, bId.length) > 2 ? 124 : 64;
  const rightPad = 54;

  svgScene(
    host,
    {
      height,
      margin: { top: 8, right: rightPad, bottom: 8, left: leftPad },
      alt: `Criterion-by-criterion forward and reverse directional error probabilities for ${aId} versus ${bId}, paired with conflict summary.`,
    },
    (scene) => {
      const { el, palette: pal, width, innerWidth } = scene;
      const x0 = leftPad;

      criteria.forEach((c, k) => {
        const top = 6 + k * bandH;
        const ink = pal.critInk[k] || pal.plotFg;
        const fill = pal.crit[k] || pal.post;
        const pref = preferredCriterionDirection(c);
        const weightStr = d.key === "thirty" ? formatReadoutProb(w[k]) : formatSetting(w[k]);
        const prefText = pref === "forward" ? `favors ${aId}` : pref === "reverse" ? `favors ${bId}` : "equal error";

        // Criterion header with weight and favored direction
        scene.add(
          el("text", { x: 4, y: top + 13, fill: ink, fontWeight: 700, text: d.criterionLabels[k] }),
          el(
            "text",
            { x: width - 4, y: top + 13, textAnchor: "end", fill: pal.plotMuted, fontWeight: 600 },
            "w = ",
            el("tspan", { text: weightStr, "data-num": String(w[k]) }),
            " · ",
            el("tspan", { fill: ink, dataset: { prxName: "" }, text: prefText })
          )
        );

        const rowGap = isCompact ? (K === 3 ? 16 : 19) : (K === 3 ? 19 : 24);
        const barH = isCompact ? 9.5 : (K === 3 ? 10.5 : 12.5);
        const midX = x0 + 0.5 * innerWidth;
        const dirs = [
          { short: `${aId} > ${bId}`, err: c.eIJ, favored: pref === "forward" },
          { short: `${bId} > ${aId}`, err: c.eJI, favored: pref === "reverse" },
        ];

        dirs.forEach((dr, rIdx) => {
          const cy = top + (isCompact ? 26 : 30) + rIdx * rowGap;
          const barTop = cy - barH / 2;
          const bw = Math.max(dr.err > 0 ? 2 : 0, Math.min(1, Math.max(0, dr.err)) * innerWidth);
          scene.add(
            el("text", {
              x: x0 - 6,
              y: cy + 4.2,
              textAnchor: "end",
              fill: dr.favored ? ink : pal.plotMuted,
              fontWeight: dr.favored ? 700 : 500,
              dataset: { prxName: "" },
              text: dr.short,
            }),
            el("rect", { x: x0, y: barTop, width: innerWidth, height: barH, rx: 2, fill: pal.plotGrid, fillOpacity: 0.65 }),
            el("rect", {
              x: x0,
              y: barTop,
              width: bw,
              height: barH,
              rx: 2,
              fill: dr.favored ? fill : pal.plotMuted,
              fillOpacity: dr.favored ? 0.9 : 0.42,
            }),
            scene.numText(
              {
                x: width - 4,
                y: cy + 4.2,
                textAnchor: "end",
                fill: dr.favored ? pal.plotFg : pal.plotMuted,
                fontWeight: dr.favored ? 700 : 500,
              },
              dr.err,
              formatReadoutProb(dr.err)
            )
          );
        });

        scene.add(
          el("line", {
            x1: midX,
            y1: top + (isCompact ? 19 : 21),
            x2: midX,
            y2: top + (isCompact ? 26 : 30) + rowGap + barH / 2 + 2,
            stroke: pal.plotAxis,
            strokeWidth: 1.15,
            strokeDasharray: "2,2",
          })
        );
      });

      // Bottom summary section: statewise conflict E[gamma] vs posterior min (finite laws), or opposing-pair share (Gaussian)
      const footTop = 8 + K * bandH;
      scene.add(el("line", { x1: 4, y1: footTop, x2: width - 4, y2: footTop, stroke: pal.plotGrid, strokeWidth: 1 }));

      if (states && states.length) {
        const meanGamma = states.reduce((acc, s) => acc + s.prob * s.decision.directionalMinimum, 0);
        const postMin = weighted.decision.directionalMinimum;
        const barY1 = footTop + (isCompact ? 15 : 18);
        const barY2 = footTop + (isCompact ? 33 : 39);
        const barH = isCompact ? 9 : 10.5;
        const summaryRows = [
          { label: "E[γ]", val: meanGamma, fill: pal.est },
          { label: "min cost", val: postMin, fill: pal.post },
        ];
        summaryRows.forEach((sr, idx) => {
          const cy = idx === 0 ? barY1 : barY2;
          const bw = Math.max(sr.val > 0 ? 2 : 0, Math.min(1, Math.max(0, sr.val)) * innerWidth);
          scene.add(
            el("text", { x: x0 - 6, y: cy + 4, textAnchor: "end", fill: pal.plotFg, fontWeight: 600, text: sr.label }),
            el("rect", { x: x0, y: cy - barH / 2, width: innerWidth, height: barH, rx: 2, fill: pal.plotGrid, fillOpacity: 0.65 }),
            el("rect", { x: x0, y: cy - barH / 2, width: bw, height: barH, rx: 2, fill: sr.fill, fillOpacity: 0.88 }),
            scene.numText({ x: width - 4, y: cy + 4, textAnchor: "end", fill: pal.plotFg, fontWeight: 700 }, sr.val, formatReadoutRisk(sr.val))
          );
        });
      } else {
        const share = d.M > 0 ? conflicts.count / d.M : 0;
        const cy = footTop + (isCompact ? 24 : 29);
        const barH = isCompact ? 10 : 11.5;
        const bw = Math.max(share > 0 ? 2 : 0, Math.min(1, share) * innerWidth);
        scene.add(
          el("text", { x: x0 - 6, y: cy + 4.2, textAnchor: "end", fill: pal.plotFg, fontWeight: 600, text: "Oppose" }),
          el("rect", { x: x0, y: cy - barH / 2, width: innerWidth, height: barH, rx: 2.5, fill: pal.plotGrid, fillOpacity: 0.65 }),
          el("rect", { x: x0, y: cy - barH / 2, width: bw, height: barH, rx: 2.5, fill: pal.est, fillOpacity: 0.85 }),
          el(
            "text",
            { x: width - 4, y: cy + 4.2, textAnchor: "end", fill: pal.plotFg, fontWeight: 700 },
            el("tspan", { text: formatCount(conflicts.count), "data-num": String(conflicts.count) }),
            "/",
            el("tspan", { text: formatCount(d.M), "data-num": String(d.M) })
          )
        );
      }
    }
  );
}

function renderStateTable(ctx, slot, model) {
  slot.replaceChildren();
  if (!model.law) {
    slot.append(
      ctx.panelTitle("States and directional costs"),
      ctx.h(
        "p",
        { class: "cp-note" },
        "Gaussian pairwise releases provide directional error probabilities directly without specifying a finite table of complete states."
      )
    );
    return;
  }
  slot.append(
    ctx.panelTitle("Known states and their directional costs"),
    ctx.h(
      "p",
      { class: "cp-note" },
      "Each row lists all unit criterion values in one state; statewise γ is the smaller weighted directional cost in that state."
    )
  );
  const rows = model.law.states.map((state, s) => [
    numberNode(ctx, s + 1, "count"),
    numberNode(ctx, model.states[s].prob, "prob", `state-${s}-prob`),
    ctx.h(
      "span",
      {},
      ...state.flatMap((values, i) => [
        i ? "; " : "",
        nameNode(ctx, model.data.ids[i]),
        ": ",
        ...values.flatMap((v, k) => [k ? ", " : "", numberNode(ctx, v, "value")]),
      ])
    ),
    numberNode(ctx, model.states[s].decision.costs.iAboveJ, "cost", `state-${s}-forward`),
    numberNode(ctx, model.states[s].decision.costs.jAboveI, "cost", `state-${s}-reverse`),
    numberNode(ctx, model.states[s].decision.directionalMinimum, "cost", `state-${s}-gamma`),
  ]);
  scrollWrap(
    ctx,
    slot,
    "Complete finite states and statewise directional minima",
    visibleTable(
      ctx,
      ["State", "Probability", "All unit criterion values", "First above second cost", "Second above first cost", "Statewise γ"],
      rows,
      "cp-state-table"
    )
  );
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "conflict-pairs",
    frame: "v2",
    className: "cp",
    css: CONFLICT_V2_CSS,
    keys: CONFLICT_PAIR_KEYS,
    build(ctx) {
      ctx.root.classList.add("sev");
      const { h } = ctx;
      const r = ro(ctx);
      const control = buildControls(ctx);

      // Primary stage: isolated-pair 3-action bars + criterion-by-criterion direction & conflict visual
      const costTitle = ctx.panelTitle("Standalone pair actions");
      const costCue = h("p", { class: "cp-stage-cue" }, "Outline marks best");
      const costFig = h("div");
      const costCol = h("div", { class: "cp-stage-col" }, h("div", { class: "cp-col-head" }, costTitle, costCue), costFig);

      const critTitle = ctx.panelTitle("Criterion error directions");
      const critCue = h("p", { class: "cp-stage-cue" }, "Smaller error preferred");
      const critFig = h("div");
      const critCol = h("div", { class: "cp-stage-col" }, h("div", { class: "cp-col-head" }, critTitle, critCue), critFig);

      const stageGrid = h("div", { class: "cp-stage-grid" }, costCol, critCol);
      ctx.stage.append(stageGrid);
      ctx.primaryGraphic(stageGrid);

      // Data disclosure: weights, 3-action cost table & directional-min, finite state table, per-criterion tables, opposing-pair map & list
      const dataBox = ctx.dataBox("Data, state table and opposing-pair map");
      const weightsSlot = h("div", { class: "cp-weights cp-section" });
      const costDetailsSlot = h("div", { class: "cp-section sev-paper prx-light-panel" });
      const stateSlot = h("div", { class: "cp-section sev-paper prx-light-panel" });
      const pairSlot = h("div", { class: "cp-section sev-paper prx-light-panel" });
      const conflictSlot = h("div", { class: "cp-section sev-paper prx-light-panel" });
      const listSlot = h("div", { class: "cp-section sev-paper prx-light-panel" });
      ctx.stage.append(conflictSlot);
      dataBox.body.append(h("div", { class: "cp-data-stack" }, weightsSlot, costDetailsSlot, stateSlot, pairSlot, listSlot));

      // Method disclosure: equal-cost tolerance 1.00e-12, zero-weight opposition, latent equality, and statewise conflict gamma
      const methodBox = ctx.methodBox("Method, isolated-pair rule and tolerances");
      const methodSlot = h("div");
      methodBox.body.append(methodSlot);

      const pairView = createCriterionPairView(ctx, pairSlot);
      const conflictView = createCriterionConflictView(ctx, conflictSlot, {
        listSlot,
        onSelectPair: (pair) => ctx.set({ pair }),
      });

      return {
        render(state, info = {}) {
          const model = conflictPairModel(state);

          // PR-06 / PR-09: Toggling a disclosure only redraws width-dependent SVGs inside Data at their open width.
          if (info?.reason === "disclosure") {
            return;
          }

          if (!isCriterionPairKey(model.data, state.pair)) ctx.set({ pair: "auto" });
          control.render(state);

          const { data: d, pair, weighted, conflicts, tau, kind } = model;
          const decision = weighted.decision;
          const aId = d.ids[pair.i];
          const bId = d.ids[pair.j];

          // Stage render
          const isCompact = (ctx.width() || 640) < 560;
          drawActionBarsStage(costFig, model, isCompact);
          drawCriterionDirectionsStage(critFig, model, isCompact);

          // Live readout (3 sig figs, 20-26 words)
          const bestWords = decision.best.map((act) => words(d.ids, pair, act)).join("; ");
          r.set([
            "For ",
            nameNode(ctx, aId),
            " above ",
            nameNode(ctx, bId),
            ", standalone cost is ",
            r.risk(weighted.eIJ, { hook: "readout-forward" }),
            " vs. reverse ",
            r.risk(weighted.eJI, { hook: "readout-reverse" }),
            " and withhold ",
            r.risk(tau, { hook: "readout-withhold" }),
            " (best alone: ",
            nameNode(ctx, bestWords),
            "; ",
            r.count(conflicts.count, { hook: "readout-conflicts" }),
            conflicts.count === 1 ? " opposing pair)." : " opposing pairs).",
          ]);

          // Data disclosure: weights, exact 4-decimal action costs, statewise gamma, criterion tables, and opposing-pair map
          weightsSlot.replaceChildren(
            ...model.w.flatMap((v, k) => [ctx.h("span", {}, d.criterionLabels[k], ": weight ", numberNode(ctx, v, "setting", `weight-${k}`))])
          );

          const actionRows = ["iAboveJ", "jAboveI", "withhold"].map((action) => ({
            action,
            label: words(d.ids, pair, action),
            cost: decision.costs[action],
            best: decision.best.includes(action),
          }));
          costDetailsSlot.replaceChildren(
            ctx.panelTitle("Three isolated-pair costs"),
            h(
              "p",
              { class: "cp-best" },
              numberNode(ctx, decision.best.length, "count", "best-count"),
              decision.best.length === 1 ? " smallest-cost action: " : " smallest-cost actions: ",
              ...decision.best.flatMap((action, idx) => [idx ? "; " : "", nameNode(ctx, words(d.ids, pair, action))]),
              ". ",
              kind === "known state" ? "Statewise γ: " : "Smaller expected directional cost: ",
              numberNode(ctx, decision.directionalMinimum, "cost", "directional-min"),
              " (excluding withholding)."
            )
          );
          scrollWrap(
            ctx,
            costDetailsSlot,
            "Three isolated-pair costs",
            visibleTable(
              ctx,
              ["Action", "Cost", "Shares the smallest cost"],
              actionRows.map((row) => [nameNode(ctx, row.label), numberNode(ctx, row.cost, "cost", `cost-${row.action}`), row.best ? "Yes" : "No"]),
              "cp-cost-table"
            )
          );

          renderStateTable(ctx, stateSlot, model);

          pairView.render(model);
          pairSlot.append(ctx.panelTitle("Each criterion on its own"));
          scrollWrap(
            ctx,
            pairSlot,
            "Criterion-specific isolated decisions",
            visibleTable(
              ctx,
              ["Criterion", "Forward cost", "Reverse cost", "Withhold cost", "Smaller directional cost", "Smallest-cost actions"],
              model.criteria.map((row) => [
                d.criterionLabels[row.k],
                numberNode(ctx, row.eIJ, "cost", `criterion-${row.k}-forward`),
                numberNode(ctx, row.eJI, "cost", `criterion-${row.k}-reverse`),
                numberNode(ctx, row.decision.costs.withhold, "cost", `criterion-${row.k}-withhold`),
                numberNode(ctx, row.decision.directionalMinimum, "cost", `criterion-${row.k}-min`),
                nameNode(ctx, row.decision.best.map((action) => words(d.ids, pair, action)).join("; ")),
              ]),
              "cp-state-table"
            )
          );

          conflictView.render(model);

          // Method disclosure
          methodSlot.replaceChildren(
            h(
              "p",
              { class: "cp-method-note" },
              "Actions share the smallest isolated-pair cost within equal-cost tolerance ",
              numberNode(ctx, 1e-12, "sci"),
              ". Strict statements count latent equality as wrong, so forward and reverse errors sum to one plus equality probability; comparing the two errors identifies each criterion’s preferred direction even when both exceed one half."
            ),
            h(
              "p",
              { class: "cp-method-note" },
              "The opposing-pair count compares unweighted criterion directions, including criteria with zero error weight. Within each state, γ is the smaller weighted directional cost; averaging over uncertain states before minimizing mixes within-state conflict with cross-state uncertainty, and isolated-pair actions need not form a coherent multi-unit grade report."
            )
          );

          ctx.caption.replaceChildren(
            "Synthetic supplied laws and restated teaching examples (CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            "). Strict statements count equality as wrong; isolated-pair costs are not a coherent grade report."
          );
        },
      };
    },
  });
}
