// App entry point for 4.1 several-criteria.
// Preserves all domain exports from ../shared/domain/several-criteria.js (S1-02).
export * from "../shared/domain/several-criteria.js";

import { createWidget } from "../shared/base.js";
import { placeDirectLabels, plot, svgEl, svgScene } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatPercent,
  formatReadoutEst,
  formatReadoutProb,
  formatSci,
} from "../shared/format.js";
import { ro } from "../shared/readout.js";
import { mobileControls } from "../shared/mobile-controls.js";
import { criteriaData } from "../shared/criteria-data.js";
import {
  CRITERIA_PROFILE_CSS,
  CRITERIA_PROFILE_KEYS,
  createCriterionConflictView,
  createCriterionPairView,
  criterionProfileModel,
  isCriterionPairKey,
  preferredCriterionDirection,
} from "../shared/domain/several-criteria.js";

const SEVERAL_V2_CSS = `${CRITERIA_PROFILE_CSS}
.sev .prx-stage,
.sev .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.sev.prx-widget[data-prx-frame="v2"] .prx-toolbar { align-items: flex-end; gap: 0.3rem 0.65rem; margin-bottom: 0.4rem; }
.sev.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls { flex: 1 1 100%; align-items: flex-end; gap: 0.4rem 0.85rem; }
.sev.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 auto; }
@media (min-width: 48.01em) {
  .sev.prx-widget[data-prx-frame="v2"] .prx-presets { display: flex; flex-direction: row; align-items: center; gap: 0.45rem; }
  .sev.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { margin: 0; font-size: 0.78rem; line-height: 1.15; white-space: nowrap; }
  .sev.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.28rem; }
  .sev.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { min-height: 1.85rem; padding: 0.16rem 0.48rem; font-size: 0.8125rem; line-height: 1.2; }
  .sev.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { min-height: 1.85rem; padding: 0.14rem 0; }
}
@media (max-width: 48em) {
  .sev.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.5rem 0.6rem; }
}
.sev .sev-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
  gap: 0.85rem 1rem;
  align-items: start;
  min-width: 0;
}
@media (max-width: 52em) {
  .sev .sev-stage-grid { grid-template-columns: minmax(0, 1fr); gap: 0.7rem; }
}
.sev .sev-stage-col { min-width: 0; max-width: 100%; }
.sev .prx-stage .sev-col-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.6rem;
  margin: 0 0 0.25rem;
}
.sev .prx-stage .sev-col-head .prx-panel-title { margin: 0; color: var(--prx-plot-fg); }
.sev .prx-stage .sev-stage-cue {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--prx-plot-muted);
}
.sev .sev-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.55rem 0.9rem;
  width: 100%;
  min-width: 0;
}
.sev .sev-settings-grid .prx-control,
.sev .sev-settings-grid select { max-width: 100%; min-width: 0; }
.sev .sev-data-stack { display: grid; gap: 0.75rem; min-width: 0; }
.sev .sev-data-stack .sev-section { margin: 0; }
.sev .sev-method-note { margin: 0.35rem 0; font-size: 0.875rem; line-height: 1.45; color: var(--prx-fg); }
`;

const asName = (ctx, value) => ctx.h("span", { "data-prx-name": "", text: value });
const pairKey = (d, i, j) => `${d.ids[i]},${d.ids[j]}`;

function numNode(ctx, value, kind = "decimal", hook) {
  const fmt = kind === "count"
    ? formatCount(value)
    : kind === "percent"
      ? formatPercent(value)
      : kind === "sci"
        ? formatSci(value)
        : formatDecimal(value, { digits: 3 });
  const n = ctx.num(value, fmt);
  if (hook) n.dataset.prxReadout = hook;
  return n;
}

function table(ctx, headers, rows, className = "") {
  return ctx.h(
    "table",
    { class: className },
    ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((s) => ctx.h("th", { scope: "col" }, s)))),
    ctx.h("tbody", {}, ...rows.map((row) => ctx.h("tr", {}, ...row.map((v) => ctx.h("td", {}, v)))))
  );
}

function markUnitNames(container, ids) {
  const idSet = new Set(ids);
  for (const t of container.querySelectorAll("text")) {
    const txt = (t.textContent || "").trim();
    if (idSet.has(txt) || /^(site\d+|[A-F])$/.test(txt)) t.setAttribute("data-prx-name", "");
  }
}

function scalePos(scale, v) {
  if (!scale || v === undefined || v === null) return null;
  const p = scale.apply(v);
  if (!Number.isFinite(p)) return null;
  return scale.bandwidth ? p + scale.bandwidth / 2 : p;
}

function plotSelection(ctx, figure, onSelect, onFocus) {
  if (!onSelect) return onFocus ? { onFocus } : {};
  let focused = null;
  ctx.listen(figure, "keydown", (event) => {
    if (!event.target.closest?.(".prx-kbd-point") || !["Enter", " "].includes(event.key) || !focused) return;
    event.preventDefault();
    onSelect(focused);
  });
  return {
    pointer: true,
    onSelect,
    onFocus(row) {
      focused = row;
      onFocus?.(row);
    },
  };
}

function buildControls(ctx) {
  const data = ctx.select({
    label: "Supplied data",
    name: "data",
    options: [
      { value: "thirty", label: "Thirty sites · three criteria" },
      { value: "six", label: "Six sites · two scores" },
    ],
    onChange: (v) => ctx.set({ data: v, pair: "auto", unit: "auto" }),
  });
  const level = ctx.segmented({
    label: "Marginal interval level",
    name: "level",
    options: [90, 95].map((v) => ({ value: v, label: [numNode(ctx, v / 100, "percent")] })),
    onChange: (v) => ctx.set({ level: v }),
  });
  ctx.controls.append(ctx.primaryControl(data.root), level.root);

  const settings = ctx.settingsBox("Settings");
  const order = ctx.select({
    label: "Align rows",
    name: "order",
    options: [
      { value: "criterion", label: "Each criterion’s mean order" },
      { value: "aligned", label: "Common unit labels" },
    ],
    onChange: (v) => ctx.set({ order: v }),
  });
  const orientation = ctx.select({
    label: "Score B priority",
    name: "orientB",
    options: [
      { value: "higher", label: "Higher score B → higher priority" },
      { value: "lower", label: "Lower score B → higher priority" },
    ],
    onChange: (v) => ctx.set({ orientB: v }),
  });

  const secondary = ctx.h("div", { class: "sev-settings-grid" }, order.root, orientation.root);
  const groups = {};
  for (const key of ["six", "thirty"]) {
    const d = criteriaData(key);
    const pairs = d.ids.flatMap((id, i) =>
      d.ids.flatMap((id2, j) => (i === j ? [] : [{ value: pairKey(d, i, j), label: `${id} above ${id2}` }]))
    );
    const pair = ctx.select({
      label: "Proposed pair direction",
      name: `pair-${key}`,
      options: [{ value: "auto", label: "Source example pair" }, ...pairs],
      onChange: (v) => ctx.set({ pair: v }),
    });
    const unit = ctx.select({
      label: "Follow one unit",
      name: `unit-${key}`,
      options: [{ value: "auto", label: "First unit of the pair" }, ...d.ids.map((id) => ({ value: id, label: id }))],
      onChange: (v) => ctx.set({ unit: v }),
    });
    const group = ctx.h("div", { class: "sev-control-group" }, pair.root, unit.root);
    secondary.append(group);
    groups[key] = { group, pair, unit };
  }
  settings.body.append(secondary);
  mobileControls(ctx, { primary: [data.root] });

  return {
    render(state) {
      data.set(state.data);
      level.set(state.level);
      order.set(state.order);
      orientation.set(state.orientB);
      orientation.root.hidden = state.data !== "six";
      for (const key of ["six", "thirty"]) {
        const active = key === state.data;
        groups[key].group.hidden = !active;
        groups[key].pair.set(state.pair);
        groups[key].unit.set(state.unit);
      }
    },
  };
}

function drawCrossingStage(ctx, figHost, model, selection) {
  const { data: d, profiles, pair, unit } = model;
  const selected = new Set([unit, pair.i, pair.j]);
  const rows = profiles.flatMap((p, k) =>
    p.scoreOrder.order.map((i, position) => ({
      id: d.ids[i],
      i,
      k,
      criterion: d.criterionLabels[k],
      position: position + 1,
      mean: p.mean[i],
    }))
  );
  const manySites = d.n > 6;
  // Leave space around the selected dots (12px including their outline), and
  // more room for choosing adjacent ranks on a narrow, single-column display.
  const rowPitch = ctx.width() < 560 ? 24 : 16;
  const marginTop = manySites ? 36 : 18;
  const marginBottom = manySites ? 18 : 34;
  const rankInset = 10;
  const height = Math.max(236, marginTop + marginBottom + 2 * rankInset + (d.n - 1) * rowPitch);
  const marginRight = d.key === "six" ? 52 : 82;
  const chart = plot(figHost, {
    height,
    marginTop,
    marginLeft: 46,
    marginRight,
    marginBottom,
    x: { domain: d.criterionLabels, axis: manySites ? "top" : "bottom", label: null, padding: 0.24 },
    y: {
      reverse: true,
      domain: [1, d.n],
      inset: rankInset,
      label: "Position in mean order",
      ...(manySites ? { labelAnchor: "center" } : {}),
      ticks: d.key === "six" ? [1, 2, 3, 4, 5, 6] : [1, 5, 10, 15, 20, 25, 30],
      tickFormat: (v) => formatCount(v),
    },
    alt: "Lines connect each unit across criterion-specific posterior-mean orders. Highlighted lines follow the selected pair and unit.",
    table: rows,
    keyboard: {
      data: rows,
      x: "criterion",
      y: "position",
      title: (r) => `${r.id} on ${r.criterion}: position ${r.position}; posterior mean ${formatDecimal(r.mean, { digits: 3 })}.`,
      ...selection,
    },
    marks: (c, P) => [
      P.line(
        rows.filter((r) => !selected.has(r.i)),
        {
          x: "criterion",
          y: "position",
          z: "id",
          stroke: c.plotMuted,
          strokeWidth: 1,
          strokeOpacity: d.n > 6 ? 0.28 : 0.45,
        }
      ),
      P.line(
        rows.filter((r) => selected.has(r.i)),
        {
          x: "criterion",
          y: "position",
          z: "id",
          stroke: (r) => (r.i === pair.i ? c.plotFocus : r.i === pair.j ? c.est : c.post),
          strokeWidth: (r) => (r.i === unit ? 2.8 : 2.3),
          strokeDasharray: (r) => (r.i === pair.j && pair.j !== unit ? "5,3" : null),
        }
      ),
      P.dot(rows, {
        x: "criterion",
        y: "position",
        fill: (r) => c.crit[r.k],
        r: (r) => (selected.has(r.i) ? 5 : 2.6),
        stroke: (r) => (selected.has(r.i) ? (r.i === pair.i ? c.plotFocus : r.i === pair.j ? c.est : c.post) : c.plotBg),
        strokeWidth: (r) => (selected.has(r.i) ? 2 : 1),
      }),
      P.tip(rows, P.pointer({ x: "criterion", y: "position", title: (r) => `${r.id} (#${r.position})` })),
    ],
  });

  const { svg, palette: pal } = chart;
  const doc = svg.ownerDocument;

  // Color criterion tick labels on light paper using --prx-crit-ink-1..3 (>= 4.5:1 contrast).
  const critIdx = new Map(d.criterionLabels.map((lbl, idx) => [lbl, idx]));
  for (const t of svg.querySelectorAll('g[aria-label="x-axis tick label"] text')) {
    const idx = critIdx.get((t.textContent || "").trim());
    if (idx !== undefined && pal.critInk[idx]) {
      t.setAttribute("fill", pal.critInk[idx]);
      t.setAttribute("font-weight", "600");
    }
  }

  // Right-rail collision-free direct unit labels via placeDirectLabels mapped by item.id (WA-02) + rx:3 pills (WB-03).
  const sx = chart.scale("x");
  const sy = chart.scale("y");
  const lastCrit = d.criterionLabels[d.K - 1];
  const xDot = scalePos(sx, lastCrit);
  const svgW = svg.viewBox?.baseVal?.width || Number(svg.getAttribute("width")) || 320;
  if (xDot !== null) {
    const rawItems = [...selected].map((uIdx) => {
      const lastOrder = profiles[d.K - 1].scoreOrder.order;
      const pos = lastOrder.indexOf(uIdx) + 1;
      const py = scalePos(sy, pos);
      const color = uIdx === pair.i ? pal.plotFocus : uIdx === pair.j ? pal.estText : pal.postText;
      return { id: d.ids[uIdx], uIdx, y: py ?? 24, rawY: py ?? 24, color };
    });
    const placed = placeDirectLabels(rawItems, { minGapPx: 18, minY: marginTop, maxY: height - marginBottom });
    const placedById = new Map(placed.map((p) => [p.id, p]));
    const layer = svgEl(doc, "g", { "aria-hidden": "true", "text-anchor": "start", style: { pointerEvents: "none", textAnchor: "start" } });
    const pillPairs = [];
    for (const item of rawItems) {
      const p = placedById.get(item.id);
      if (!p) continue;
      const labelText = item.id;
      const pillW = Math.min(marginRight - 10, Math.max(22, Math.ceil(labelText.length * 7.6 + 9)));
      const pillX = Math.min(svgW - pillW - 3, xDot + 9);
      const pillH = 17;
      const rectEl = svgEl(doc, "rect", {
        x: pillX,
        y: p.y - pillH / 2,
        width: pillW,
        height: pillH,
        rx: 3,
        fill: pal.plotBg,
        stroke: pal.plotBg,
        strokeWidth: 1.5,
      });
      const textEl = svgEl(doc, "text", {
        x: pillX + 3.5,
        y: p.y,
        "text-anchor": "start",
        "dominant-baseline": "central",
        fill: item.color,
        fontWeight: 700,
        style: { textAnchor: "start" },
        dataset: { prxName: "" },
        text: labelText,
      });
      layer.append(
        svgEl(doc, "line", {
          x1: xDot + 5.5,
          y1: item.rawY,
          x2: pillX - 1,
          y2: p.y,
          stroke: item.color,
          strokeWidth: 1.15,
          strokeOpacity: 0.75,
        }),
        rectEl,
        textEl
      );
      pillPairs.push([rectEl, textEl, pillX]);
    }
    svg.append(layer);
    for (const [rectEl, textEl, pillX] of pillPairs) {
      const tw = textEl.getComputedTextLength?.() || 0;
      if (tw > 0) {
        const w = Math.min(svgW - pillX - 2, Math.ceil(tw + 7));
        rectEl.setAttribute("width", String(w));
      }
    }
  }
  markUnitNames(figHost, d.ids);
}

function drawPairStageScene(ctx, host, model) {
  const { data: d, pair, profiles } = model;
  const aId = d.ids[pair.i];
  const bId = d.ids[pair.j];
  const K = d.K;
  const bandH0 = 112;
  const bandHRest = K === 3 ? 96 : 102;
  const height = 8 + bandH0 + (K - 1) * bandHRest + 6;
  const leftPad = Math.max(aId.length, bId.length) > 2 ? 58 : 30;

  svgScene(
    host,
    {
      height,
      margin: { top: 8, right: 8, bottom: 10, left: leftPad },
      alt: `Selected-pair directional error probabilities and ${model.level}% marginal posterior intervals for ${aId} and ${bId} across each criterion.`,
    },
    (scene) => {
      const { el, numText, palette: pal, width, innerWidth } = scene;
      const x0 = leftPad;
      const x1 = x0 + innerWidth;

      pair.criteria.forEach((c, k) => {
        const top = 8 + (k === 0 ? 0 : bandH0 + (k - 1) * bandHRest);
        const bandH = k === 0 ? bandH0 : bandHRest;
        const critLabel = d.key === "six" && k === 1 && model.orient[k] < 0 ? "−score B (reversed)" : d.criterionLabels[k];
        const prefDir = preferredCriterionDirection(c);
        const favored = prefDir === "forward" ? aId : prefDir === "reverse" ? bId : null;
        const ink = pal.critInk[k] || pal.plotFg;
        const fill = pal.crit[k] || pal.post;

        // Criterion header + directional error value
        scene.add(
          el("text", { x: 4, y: top + 13, fill: ink, fontWeight: 700, text: critLabel }),
          el(
            "text",
            { x: width - 4, y: top + 13, textAnchor: "end", fill: pal.plotFg, fontWeight: 600 },
            "error ",
            el("tspan", { text: formatReadoutProb(c.eIJ), "data-num": String(c.eIJ) }),
            favored ? " · " : " · tie",
            ...(favored ? [el("tspan", { text: favored, dataset: { prxName: "" } })] : [])
          )
        );

        // Directional error bar in [0, 1] with .5 midline (+ 0 / .5 / 1 ticks on top criterion)
        const barY = top + 20;
        const barH = 9;
        const midX = x0 + 0.5 * innerWidth;
        const errW = Math.max(c.eIJ > 0 ? 2 : 0, Math.min(1, Math.max(0, c.eIJ)) * innerWidth);
        scene.add(
          el("rect", { x: x0, y: barY, width: innerWidth, height: barH, rx: 2, fill: pal.plotGrid, fillOpacity: 0.7 }),
          el("rect", { x: x0, y: barY, width: errW, height: barH, rx: 2, fill, fillOpacity: 0.88 }),
          el("line", { x1: midX, y1: barY - 2.5, x2: midX, y2: barY + barH + 2.5, stroke: pal.plotAxis, strokeWidth: 1.2, strokeDasharray: "2,2" })
        );
        if (k === 0) {
          const errTickY = barY + barH + 14;
          scene.add(
            numText({ x: x0, y: errTickY, textAnchor: "start", fill: pal.plotMuted }, 0, "0"),
            numText({ x: midX, y: errTickY, textAnchor: "middle", fill: pal.plotMuted }, 0.5, ".5"),
            numText({ x: x1, y: errTickY, textAnchor: "end", fill: pal.plotMuted }, 1, "1")
          );
        }

        // Two-unit marginal intervals on criterion k's own scale (inset so dots/caps never hit edges)
        const p = profiles[k];
        const unitPairOrder = model.order === "criterion" && p.mean[pair.j] > p.mean[pair.i] ? [pair.j, pair.i] : [pair.i, pair.j];
        const lo = Math.min(c.iInterval.lower, c.jInterval.lower);
        const hi = Math.max(c.iInterval.upper, c.jInterval.upper);
        const span = Math.max(1e-6, hi - lo);
        const domLo = lo - 0.08 * span;
        const domHi = hi + 0.08 * span;
        const sx = (v) => x0 + ((v - domLo) / (domHi - domLo)) * innerWidth;
        const ivBaseY = top + (k === 0 ? 60 : 44);

        unitPairOrder.forEach((uIdx, rIdx) => {
          const uy = ivBaseY + rIdx * 19;
          const iv = p.intervals[uIdx];
          const mean = p.mean[uIdx];
          const isFirst = uIdx === pair.i;
          const dotStroke = isFirst ? pal.plotFocus : pal.est;
          scene.add(
            el("text", {
              x: x0 - 6,
              y: uy + 4.5,
              textAnchor: "end",
              fill: isFirst ? pal.plotFg : pal.plotMuted,
              fontWeight: isFirst ? 700 : 600,
              dataset: { prxName: "" },
              text: d.ids[uIdx],
            }),
            el("line", { x1: sx(iv.lower), y1: uy, x2: sx(iv.upper), y2: uy, stroke: fill, strokeWidth: 2.4 }),
            el("circle", { cx: sx(mean), cy: uy, r: 4.2, fill: isFirst ? fill : pal.plotBg, stroke: dotStroke, strokeWidth: 2 })
          );
        });

        // Criterion-scale min/max endpoint ruler & 3-sig-fig labels below the interval pair
        const xLo = sx(lo);
        const xHi = sx(hi);
        const axisY = ivBaseY + 19 + 8;
        const scaleLabelY = axisY + 14;
        const wideEnough = xHi - xLo >= 96;
        scene.add(
          el("line", { x1: xLo, y1: axisY, x2: xHi, y2: axisY, stroke: pal.plotGrid, strokeWidth: 1 }),
          el("line", { x1: xLo, y1: axisY - 3, x2: xLo, y2: axisY + 1.5, stroke: pal.plotAxis, strokeWidth: 1 }),
          el("line", { x1: xHi, y1: axisY - 3, x2: xHi, y2: axisY + 1.5, stroke: pal.plotAxis, strokeWidth: 1 }),
          numText({ x: wideEnough ? xLo : x0, y: scaleLabelY, textAnchor: "start", fill: pal.plotMuted }, lo, formatReadoutEst(lo)),
          numText({ x: wideEnough ? xHi : x1, y: scaleLabelY, textAnchor: "end", fill: pal.plotMuted }, hi, formatReadoutEst(hi))
        );

        if (k < K - 1) {
          scene.add(el("line", { x1: 4, y1: top + bandH - 4, x2: width - 4, y2: top + bandH - 4, stroke: pal.plotGrid, strokeWidth: 1 }));
        }
      });
    }
  );
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "several-criteria",
    frame: "v2",
    className: "sev",
    css: SEVERAL_V2_CSS,
    keys: CRITERIA_PROFILE_KEYS,
    build(ctx) {
      const { h } = ctx;
      const r = ro(ctx);
      const controls = buildControls(ctx);

      // Primary stage: two tightly linked panels (order crossings + selected-pair intervals & error bars)
      const crossingCue = h("p", { class: "sev-stage-cue", "data-sev-crossing-guide": "" }, "Click two dots to compare.");
      const crossingFig = h("div");
      const crossingCol = h(
        "div",
        { class: "sev-stage-col" },
        h("div", { class: "sev-col-head" }, ctx.panelTitle("Posterior-mean orders"), crossingCue),
        crossingFig
      );

      const pairTitle = ctx.panelTitle("Selected pair");
      const pairSubtitle = h("p", { class: "sev-stage-cue" });
      const pairFig = h("div");
      const pairCol = h(
        "div",
        { class: "sev-stage-col" },
        h("div", { class: "sev-col-head" }, pairTitle, pairSubtitle),
        pairFig
      );

      const stageGrid = h("div", { class: "sev-stage-grid" }, crossingCol, pairCol);
      ctx.stage.append(stageGrid);
      ctx.primaryGraphic(stageGrid);

      // Data disclosure: summary counts, selected-pair table, full marginal interval plots, unit table, and complete opposing-pair map & list
      const dataBox = ctx.dataBox("Data, unit summaries and pair table");
      const summarySlot = h("div", { class: "sev-summary" });
      const pairSlot = h("div", { class: "sev-section sev-paper prx-light-panel" });
      const profilesSlot = h("div", { class: "sev-grid sev-section sev-paper prx-light-panel" });
      const unitSlot = h("div", { class: "sev-section sev-paper prx-light-panel" });
      const unitHeader = h("div");
      const unitScroll = h("div", { class: "sev-scroll" });
      ctx.scrollRegion(unitScroll, "All marginal distributions");
      unitSlot.append(unitHeader, unitScroll);
      const conflictsSlot = h("div", { class: "sev-section sev-paper prx-light-panel" });
      const conflictListSlot = h("div", { class: "sev-section sev-paper prx-light-panel" });
      dataBox.body.append(h("div", { class: "sev-data-stack" }, summarySlot, pairSlot, profilesSlot, unitSlot, conflictsSlot, conflictListSlot));

      // Method disclosure: multi-criterion orientation, opposing-pair tie tolerance, and marginal-law scope
      const methodBox = ctx.methodBox("Method and multi-criterion structure");
      const methodSlot = h("div");
      methodBox.body.append(methodSlot);

      let firstUnit = null;
      const resetCrossing = () => {
        firstUnit = null;
        crossingCue.textContent = "Click two dots to compare.";
      };
      const selectPair = (pair) => {
        resetCrossing();
        ctx.set({ pair });
      };

      const crossingSelection = plotSelection(ctx, crossingFig, (row) => {
        const id = row.id;
        if (firstUnit && firstUnit !== id) {
          selectPair(`${firstUnit},${id}`);
          return;
        }
        firstUnit = id;
        crossingCue.replaceChildren("First: ", asName(ctx, id), " — pick second.");
      });

      const pairView = createCriterionPairView(ctx, pairSlot);
      const conflictView = createCriterionConflictView(ctx, conflictsSlot, {
        onSelectPair: selectPair,
        listSlot: conflictListSlot,
      });

      function renderDataPlots(model) {
        const { data: d, profiles, pair, unit } = model;
        const selected = new Set([unit, pair.i, pair.j]);
        profilesSlot.replaceChildren();
        profiles.forEach((p, k) => {
          const panel = h("div");
          const fig = h("div");
          profilesSlot.append(panel);
          const rows = d.ids.map((id, i) => ({
            id,
            i,
            mean: p.mean[i],
            sd: p.sd[i],
            ...p.intervals[i],
            expectedRank: p.expectedRank[i],
          }));
          const order = model.order === "aligned" ? d.ids : p.scoreOrder.order.map((i) => d.ids[i]);
          panel.append(
            ctx.panelTitle(d.criterionLabels[k]),
            h("p", { class: "sev-hint" }, numNode(ctx, model.level / 100, "percent"), " marginal posterior intervals; dots are means."),
            fig
          );
          plot(fig, {
            height: Math.max(220, d.n * 19 + 65),
            marginLeft: d.key === "six" ? 35 : 72,
            marginRight: 20,
            marginBottom: 42,
            x: {
              label: d.key === "six" && k === 1 && model.orient[k] < 0 ? "Negative score B (reversed target)" : d.criterionLabels[k],
              grid: true,
            },
            y: { domain: order, label: null },
            alt: `Marginal ${d.criterionLabels[k]} posterior intervals, ordered ${model.order === "aligned" ? "by the common unit labels" : "by this criterion’s posterior mean"}. Every criterion uses its own score scale.`,
            table: rows,
            keyboard: {
              data: rows,
              x: "mean",
              y: "id",
              title: (row) =>
                `${row.id}: mean ${formatDecimal(row.mean, { digits: 3 })}, SD ${formatDecimal(row.sd, { digits: 3 })}, interval ${formatDecimal(row.lower, { digits: 3 })} to ${formatDecimal(row.upper, { digits: 3 })}, expected rank ${formatDecimal(row.expectedRank, { digits: 3 })}.`,
            },
            marks: (c, P) => [
              P.ruleY(rows, { y: "id", x1: "lower", x2: "upper", stroke: c.crit[k], strokeWidth: 2 }),
              P.dot(rows, {
                x: "mean",
                y: "id",
                fill: c.crit[k],
                r: (row) => (selected.has(row.i) ? 5 : 3),
                stroke: (row) => (row.i === unit ? c.plotFocus : c.plotBg),
                strokeWidth: 2,
              }),
              P.tip(rows, P.pointer({ x: "mean", y: "id", title: (row) => `${row.id}: mean ${formatDecimal(row.mean, { digits: 3 })}, SD ${formatDecimal(row.sd, { digits: 3 })}` })),
            ],
          });
          markUnitNames(fig, d.ids);
        });
        conflictView.render(model);
      }

      return {
        render(state, info = {}) {
          const model = criterionProfileModel(state);

          // PR-06 / PR-09: Toggling a disclosure never re-renders ctx.stage or re-fires ctx.readout.set;
          // only width-dependent SVGs inside Data redraw at their real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data") renderDataPlots(model);
            return;
          }

          const correction = {};
          if (!isCriterionPairKey(model.data, state.pair)) correction.pair = "auto";
          if (state.unit !== "auto" && !model.data.ids.includes(state.unit)) correction.unit = "auto";
          if (Object.keys(correction).length) ctx.set(correction);
          if (info.changed?.some((key) => key === "data" || key === "pair") || info.reason === "preset") resetCrossing();

          controls.render(state);
          const { data: d, profiles, pair, unit, conflicts } = model;

          // Stage render
          drawCrossingStage(ctx, crossingFig, model, crossingSelection);
          pairTitle.replaceChildren(asName(ctx, d.ids[pair.i]), " vs. ", asName(ctx, d.ids[pair.j]));
          pairSubtitle.replaceChildren(numNode(ctx, model.level / 100, "percent"), " intervals · dashed ", ctx.num(0.5, ".5"));
          drawPairStageScene(ctx, pairFig, model);
          pairSubtitle.append(" · Error if ", asName(ctx, d.ids[pair.i]), " is reported above ", asName(ctx, d.ids[pair.j]), ": ",
            ...pair.criteria.flatMap((c, k) => [k ? ", " : "", d.criterionLabels[k], " ", r.prob(c.eIJ)]));

          // Live readout (3 sig figs, 22-25 words)
          const opposing = conflicts.pairs.some(
            (row) => (row.i === pair.i && row.j === pair.j) || (row.i === pair.j && row.j === pair.i)
          );
          r.set([
            asName(ctx, d.ids[pair.i]),
            " above ",
            asName(ctx, d.ids[pair.j]),
            " is wrong with probability ",
            ...pair.criteria.flatMap((c, k) => [
              k === 0 ? "" : pair.criteria.length === 2 ? " and " : k === pair.criteria.length - 1 ? ", and " : ", ",
              r.prob(c.eIJ, { hook: `readout-e-${k}` }),
              " on ",
              d.criterionLabels[k],
            ]),
            " (",
            r.count(conflicts.count, { hook: "readout-conflicts" }),
            " of ",
            r.count(d.M),
            opposing ? " pairs oppose, including this pair)." : " pairs oppose across criteria).",
          ]);

          // Data disclosure (eagerly rendered for audit & readout parity)
          summarySlot.replaceChildren(
            numNode(ctx, d.n, "count", "units"),
            " units · ",
            numNode(ctx, d.K, "count", "criteria"),
            " criteria · ",
            numNode(ctx, conflicts.count, "count", "conflicts"),
            " of ",
            numNode(ctx, d.M, "count", "pairs"),
            " pairs prefer opposite directions."
          );
          pairView.render(model);
          renderDataPlots(model);

          unitHeader.replaceChildren(
            ctx.panelTitle("Supplied marginal distributions"),
            h("p", { class: "sev-hint" }, "Followed unit: ", asName(ctx, d.ids[unit]), ". Each row is one Normal marginal on its criterion’s own scale.")
          );
          const unitRows = profiles.flatMap((p, k) =>
            d.ids.map((id, i) => [
              asName(ctx, id),
              d.criterionLabels[k],
              numNode(ctx, p.mean[i], "decimal", `mean-${k}-${i}`),
              numNode(ctx, p.sd[i], "decimal", `sd-${k}-${i}`),
              numNode(ctx, p.intervals[i].lower, "decimal", `lower-${k}-${i}`),
              numNode(ctx, p.intervals[i].upper, "decimal", `upper-${k}-${i}`),
              numNode(ctx, p.expectedRank[i], "decimal", `rank-${k}-${i}`),
            ])
          );
          const full = table(ctx, ["Unit", "Criterion", "Mean", "SD", "Interval lower", "Interval upper", "Expected rank"], unitRows, "sev-wide");
          [...full.tBodies[0].rows].forEach((tr, idx) => {
            if (idx % d.n === unit) tr.classList.add("sev-selected");
          });
          unitScroll.replaceChildren(full);

          // Method disclosure
          methodSlot.replaceChildren(
            h(
              "p",
              { class: "sev-method-note" },
              d.key === "thirty"
                ? "Illustrative thirty-site criteria represent poverty, free or reduced-price lunch (frl), and food assistance (snap), where synthetic snap runs against the first two."
                : "Six-site scores represent standardized reading growth (score A) and family engagement (score B); reversing score B negates its target so smaller raw scores receive higher priority."
            ),
            h(
              "p",
              { class: "sev-method-note" },
              "A criterion prefers the strict direction whose error probability is smaller than its reverse beyond tie tolerance ",
              numNode(ctx, 1e-12, "sci"),
              ". Marginal Normal summaries determine criterion-specific intervals and pair directions without specifying cross-criterion joint draws for the thirty-site Gaussian marginals."
            )
          );

          ctx.caption.replaceChildren(
            "Synthetic Normal laws (CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            "); larger oriented values mean higher priority. Mean orders are not optimized grades."
          );
        },
      };
    },
  });
}
