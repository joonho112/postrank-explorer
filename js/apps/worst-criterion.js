export * from "../shared/domain/worst-criterion.js";

import { createWidget } from "../shared/base.js";
import { numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDistinguishing,
  formatExpectedCount,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  setNum,
} from "../shared/format.js";
import { ro, tagNode } from "../shared/readout.js";
import { compareReports, evaluateReport, minimaxChoice, weightBreakpoints } from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import { CERTAIN_OPPOSITION, ROBUST_PAIR, finiteCriteria } from "../shared/criteria-laws.js";
import { drawTwoScoreReport, reportWords, twoScoreFamily } from "../shared/domain/two-scores.js";
import { weightText } from "../shared/domain/weight-path.js";

const WORST_CRITERION_V2_CSS = `
.wcr-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 1rem;
  flex: 0 1 15.5rem;
  min-width: 0;
}
.wcr-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
  flex: 1 1 14rem;
  max-width: 15.5rem;
  min-width: 0;
}
@media (min-width: 52rem) {
  .wcr-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    align-items: flex-start;
  }
  .wcr-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets {
    flex: 1 1 26rem;
  }
}
.wcr-v2 .wcr-linked { display: grid; gap: .75rem; align-items: start; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 55rem) {
  .wcr-v2 .wcr-linked { grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); }
  .wcr-v2 .wcr-linked .wcr-cards-grid { grid-template-columns: 1fr; }
}
.wcr-v2 .prx-stage .wcr-stage-wrap {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.wcr-v2 .prx-stage .wcr-chart-host {
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
}
.wcr-v2 .prx-stage figure {
  margin: 0;
}
.wcr-v2 .prx-stage .wcr-stage-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.9rem;
  margin-top: 0.25rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--prx-plot-grid);
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.wcr-v2 .prx-stage .wcr-key {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.85rem;
}
.wcr-v2 .prx-stage .wcr-key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.wcr-v2 .prx-stage .wcr-swatch-line {
  display: inline-block;
  width: 1.15rem;
  border-top: 2px solid;
}
.wcr-v2 .prx-stage .wcr-swatch-band {
  display: inline-block;
  width: 1.15rem;
  border-top: 5px solid;
  opacity: 0.55;
}
.wcr-v2 .prx-stage .wpath-status {
  min-height: 1.15rem;
  line-height: 1.2;
  margin: 0.1rem 0 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.wcr-v2 .wpath-all-endpoints table {
  table-layout: fixed;
  width: 100%;
}
.wcr-v2 .wcr-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  min-width: 0;
}
.wcr-v2 .wcr-paper + .wcr-paper {
  margin-top: 0.65rem;
}
.wcr-v2 .wcr-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem 1rem;
  min-width: 0;
}
.wcr-v2 .wcr-rule-col {
  min-width: 0;
}
.wcr-v2 .wcr-card {
  padding: 0.45rem 0.55rem;
  margin: 0.35rem 0;
  border: 1px solid var(--prx-plot-grid);
  border-radius: 5px;
}
.wcr-v2 .wcr-card p {
  margin: 0.28rem 0;
}
.wcr-v2 .wcr-note {
  font-size: 0.875rem;
  line-height: 1.45;
  margin: 0.3rem 0 0.55rem;
}
.wcr-v2 .wcr-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.wcr-v2 .wcr-table {
  width: 100%;
  min-width: 48rem;
  border-collapse: collapse;
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.wcr-v2 .wcr-table th,
.wcr-v2 .wcr-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: left;
  white-space: nowrap;
}
.wcr-v2 .wcr-table caption {
  text-align: left;
  font-weight: 600;
  padding: 0.25rem 0 0.35rem;
}
.wcr-v2 .tws-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin: 0.15rem 0 0.35rem;
}
.wcr-v2 .tws-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.18rem 0.55rem 0.18rem 0.28rem;
  border-radius: 5px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.wcr-v2 .tws-g {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  font-size: 0.75rem;
  letter-spacing: 0;
}
.wcr-v2 .prx-light-panel .tws-gt {
  font-weight: 700;
  color: var(--prx-plot-muted);
}
@media (max-width: 48rem) {
  .wcr-v2 .wcr-cards-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

const SVG_NS = "http://www.w3.org/2000/svg";
const keyOf = (g) => Array.from(g).join("/");
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const bookE = finiteCriteria(ROBUST_PAIR);
const oppositionE = finiteCriteria(CERTAIN_OPPOSITION);
const riskModelCache = new Map();
const fullModelCache = new Map();

function numNode(ctx, value, fmt = formatCount, hook) {
  const node = ctx.num(value, fmt(value));
  if (hook) node.dataset.prxReadout = hook;
  return node;
}

function fastRiskModel(dataKey, E, tau, family) {
  const cacheKey = JSON.stringify([dataKey, tau, family]);
  let cached = riskModelCache.get(cacheKey);
  if (!cached) {
    const path = weightBreakpoints(E, { tau, family });
    const choice = minimaxChoice(E, { tau, w: [0.5, 0.5], family });
    if (path.empty || choice.empty || !choice.reports) {
      throw new RangeError("Risk-line views require a nonempty two-criterion family with at most five thousand reports");
    }
    const lines = choice.reports.map((report) => ({
      key: keyOf(report.grade),
      grade: report.grade,
      R1: report.Rk[0],
      R2: report.Rk[1],
      max: report.max,
      N: report.N,
      riskHalf: 0.5 * (report.Rk[0] + report.Rk[1]),
    }));
    const envelope = path.intervals.flatMap((r, segment) => [
      { segment, w: r.wFrom, risk: r.riskFrom, grade: r.grade },
      { segment, w: r.wTo, risk: r.riskTo, grade: r.grade },
    ]);
    cached = {
      E,
      tau,
      family,
      path,
      lines,
      envelope,
      envelopeMaximum: path.envelopeMaximum,
      choice,
    };
    riskModelCache.set(cacheKey, cached);
    if (riskModelCache.size > 16) riskModelCache.delete(riskModelCache.keys().next().value);
  }
  return cached;
}

function fastSolveGuarded(state = {}) {
  const s = { data: "six", w: 0.9, tau: 0.2, cap: "3", objective: "weighted", ...state };
  const key = JSON.stringify(s);
  if (fullModelCache.has(key)) return fullModelCache.get(key);

  const data = s.data === "six" ? criteriaData("six") : s.data === "book" ? ROBUST_PAIR : CERTAIN_OPPOSITION;
  const E = s.data === "six" ? data.E : s.data === "book" ? bookE : oppositionE;
  const family = s.cap === "exact2" ? { kind: "exactly", G: 2 } : twoScoreFamily(s.cap);
  const riskModel = fastRiskModel(s.data, E, s.tau, family);
  const choice = minimaxChoice(E, { tau: s.tau, w: [s.w, 1 - s.w], family });

  const lineByKey = new Map(riskModel.lines.map((l) => [l.key, l]));
  const profile = (grade) => ({
    grade,
    evaluation: evaluateReport(grade, E, { tau: s.tau, w: [s.w, 1 - s.w] }),
    line: lineByKey.get(keyOf(grade)),
  });
  const weightedProfiles = choice.weighted.grades.map(profile);
  const guardedProfiles = choice.minimax.grades.map(profile);
  const comparisons = guardedProfiles.map((p) =>
    compareReports(choice.weighted.grade, p.grade, E, { tau: s.tau, w: [s.w, 1 - s.w] }),
  );
  const model = {
    data,
    E,
    state: s,
    family,
    riskModel,
    choice,
    weightedProfiles,
    guardedProfiles,
    comparisons,
    peak: riskModel.envelopeMaximum,
  };
  fullModelCache.set(key, model);
  if (fullModelCache.size > 120) fullModelCache.delete(fullModelCache.keys().next().value);
  return model;
}

function attachPills(
  g,
  values,
  index,
  rows,
  { anchor = "start", dx = 0, padX = 5, pillH = 17.5, charW = 7.5, fill, strokeOf },
) {
  const doc = g?.ownerDocument;
  if (!doc) return g;
  g.removeAttribute("transform");
  const texts = g.querySelectorAll("text");
  Array.from(index).forEach((rowIdx, nodeIdx) => {
    const tNode = texts[nodeIdx];
    if (!tNode) return;
    const str = (tNode.textContent || "").trim();
    if (!str) return;
    const px = values.x[rowIdx] + dx;
    const py = values.y[rowIdx];
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    tNode.removeAttribute("transform");
    tNode.removeAttribute("dx");
    tNode.removeAttribute("dy");
    tNode.setAttribute("x", px.toFixed(1));
    tNode.setAttribute("y", py.toFixed(1));
    tNode.setAttribute("dominant-baseline", "central");
    tNode.setAttribute("text-anchor", anchor);
    tNode.style.textAnchor = anchor;
    const estW = Math.max(22, Math.round(str.length * charW + padX * 2));
    const rx = anchor === "end" ? px - estW + padX : anchor === "middle" ? px - estW / 2 : px - padX;
    const rect = doc.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", rx.toFixed(1));
    rect.setAttribute("y", (py - pillH / 2).toFixed(1));
    rect.setAttribute("width", String(estW));
    rect.setAttribute("height", String(pillH));
    rect.setAttribute("rx", "3");
    rect.setAttribute("ry", "3");
    rect.setAttribute("fill", fill);
    rect.setAttribute("data-pill-anchor", anchor);
    rect.setAttribute("data-pill-px", String(px));
    rect.setAttribute("data-pill-padx", String(padX));
    const stroke = typeof strokeOf === "function" ? strokeOf(rows[rowIdx], rowIdx) : strokeOf;
    if (stroke) {
      rect.setAttribute("stroke", stroke);
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("stroke-opacity", "0.45");
    }
    tNode.before(rect);
  });
  return g;
}

function fitMountedPills(svg) {
  for (const rect of svg?.querySelectorAll?.("rect[data-pill-anchor]") ?? []) {
    const tNode = rect.nextElementSibling;
    const tw = tNode?.getComputedTextLength?.() || 0;
    if (!(tw > 0)) continue;
    const anchor = rect.getAttribute("data-pill-anchor") || "start";
    const px = Number(rect.getAttribute("data-pill-px")) || 0;
    const padX = Number(rect.getAttribute("data-pill-padx")) || 5;
    const w = Math.max(22, Math.ceil(tw + padX * 2));
    const rx = anchor === "end" ? px - w + padX : anchor === "middle" ? px - w / 2 : px - padX;
    rect.setAttribute("x", rx.toFixed(1));
    rect.setAttribute("width", String(w));
  }
}

function reportTrajectories(P, model, color) {
  const style = { z: null, stroke: color, strokeWidth: 0.95, strokeOpacity: 0.42, clip: true };
  return P.line([0, 1], {
    ...style,
    x: (w) => w,
    y: () => 0,
    render(index, scales, values, dimensions, context, next) {
      const group = next(index, scales, values, dimensions, context);
      const rounded = (v) => Math.round(v * 1000) / 1000;
      const x0 = rounded(scales.x(0));
      const x1 = rounded(scales.x(1));
      group
        .querySelector("path")
        .setAttribute("d", model.lines.map(({ R1, R2 }) => `M${x0},${rounded(scales.y(R2))}L${x1},${rounded(scales.y(R1))}`).join(""));
      return group;
    },
  });
}

function buildHighlights(model, state) {
  return [
    ...model.weightedProfiles.map((p, i) => ({
      grade: p.grade,
      kind: "weighted",
      rank: i,
      label: i ? "Another weighted best" : "Weighted best at current weight",
      shortLabel: i ? "Tied weighted" : "Weighted best",
      active: !i && state.objective === "weighted",
      stroke: (c) => c.critInk[0],
      dash: i ? "5,3" : undefined,
    })),
    ...model.guardedProfiles.map((p, i) => ({
      grade: p.grade,
      kind: "minimax",
      rank: i,
      label: i ? "Another guarded best" : "Guarding both criteria",
      shortLabel: i ? "Tied guard" : "Guard both",
      active: !i && state.objective === "minimax",
      stroke: (c) => c.critInk[1],
      dash: model.weightedProfiles.some((wp) => same(wp.grade, p.grade)) ? "6,4" : i ? "5,3" : undefined,
    })),
  ];
}

function createStageRiskView(ctx, host) {
  const { h, doc } = ctx;
  const chartSlot = h("div", { class: "wcr-chart-host" });
  const footSlot = h("div", { class: "wcr-stage-foot", "data-prx-part": "legend" });
  const progress = h("p", { class: "wpath-status", "aria-hidden": "true" });
  const allTableSlot = h("div", { class: "wpath-all-endpoints" });
  host.append(chartSlot, footSlot, progress, allTableSlot);

  const endpointTables = new WeakMap();
  let attachedModel = null;
  let prevModel = null;
  let prevLayout = null;
  let prevHiKey = null;
  let lastChart = null;
  let lastFeatured = [];

  const ensureShell = (model) => {
    let entry = endpointTables.get(model);
    if (!entry) {
      const wrap = doc.createElement("div");
      wrap.className = "prx-sr-only prx-data-table";
      wrap.setAttribute("data-prx-part", "table");
      const table = doc.createElement("table");
      const cap = doc.createElement("caption");
      cap.textContent = "All report-risk endpoints, including reports leaving the displayed risk range";
      const thead = doc.createElement("thead");
      const hr = doc.createElement("tr");
      for (const label of ["Grade vector", "Criterion one risk", "Criterion two risk", "Worst endpoint risk"]) {
        const th = doc.createElement("th");
        th.scope = "col";
        th.textContent = label;
        hr.append(th);
      }
      thead.append(hr);
      const tbody = doc.createElement("tbody");
      table.append(cap, thead, tbody);
      wrap.append(table);
      entry = { wrap, tbody, builtRows: [], total: model.lines.length };
      endpointTables.set(model, entry);
    }
    return entry;
  };

  const buildRowsUpTo = (entry, model, end) => {
    const limit = Math.min(end, entry.total);
    for (let idx = entry.builtRows.length; idx < limit; idx += 1) {
      const line = model.lines[idx];
      const tr = doc.createElement("tr");
      const th = doc.createElement("th");
      th.scope = "row";
      setNum(th, line.grade, formatGrades(line.grade));
      const td1 = doc.createElement("td");
      setNum(td1, line.R1, formatRisk(line.R1));
      const td2 = doc.createElement("td");
      setNum(td2, line.R2, formatRisk(line.R2));
      const tdMax = doc.createElement("td");
      setNum(tdMax, line.max, formatRisk(line.max));
      tr.append(th, td1, td2, tdMax);
      entry.builtRows.push(tr);
    }
  };

  const attachFull = (model) => {
    if (attachedModel === model) return;
    const entry = ensureShell(model);
    buildRowsUpTo(entry, model, entry.total);
    entry.tbody.replaceChildren(...entry.builtRows);
    allTableSlot.replaceChildren(entry.wrap);
    attachedModel = model;
  };

  const stagedAttach = (model, batchSize = 256) => {
    if (attachedModel === model) return { initFirstBatch: () => {}, moreBatches: [] };
    const initFirstBatch = () => {
      const entry = ensureShell(model);
      attachedModel = null;
      const end = Math.min(batchSize, entry.total);
      buildRowsUpTo(entry, model, end);
      entry.tbody.replaceChildren(...entry.builtRows.slice(0, end));
      allTableSlot.replaceChildren(entry.wrap);
      if (end >= entry.total) attachedModel = model;
    };
    const moreBatches = [];
    for (let start = batchSize; start < model.lines.length; start += batchSize) {
      const s0 = start;
      const s1 = Math.min(start + batchSize, model.lines.length);
      moreBatches.push(() => {
        const entry = ensureShell(model);
        buildRowsUpTo(entry, model, s1);
        entry.tbody.append(...entry.builtRows.slice(s0, s1));
        if (s1 >= entry.total) attachedModel = model;
      });
    }
    return { initFirstBatch, moreBatches };
  };

  const render = (model, state, highlights, { force = false } = {}) => {
    if (attachedModel !== model) attachFull(model);
    const widthMeas = Math.round(chartSlot.clientWidth || ctx.stage.clientWidth || ctx.width());
    const layoutKey = [
      widthMeas,
      state.data,
      doc.documentElement.getAttribute("data-theme") || "",
      ctx.root.getAttribute("data-prx-font-scale") || "",
    ].join("|");
    const hiKey = highlights.map((d) => `${d.kind}:${keyOf(d.grade)}:${d.active ? "1" : "0"}:${d.dash ?? ""}`).join("|");

    if (!force && prevModel === model && prevLayout === layoutKey && prevHiKey === hiKey && lastChart) {
      const sx = lastChart.scale("x");
      const sy = lastChart.scale("y");
      const xPx = sx.apply(state.w);
      const rule = lastChart.svg.querySelector('g[aria-label="rule"] line');
      if (rule) {
        rule.setAttribute("x1", String(xPx));
        rule.setAttribute("x2", String(xPx));
      }
      const dotGroups = lastChart.svg.querySelectorAll('g[aria-label="dot"]');
      const currentDots = dotGroups[0]?.querySelectorAll("circle") ?? [];
      lastFeatured.forEach((d, idx) => {
        const risk = state.w * d.R1 + (1 - state.w) * d.R2;
        const c = currentDots[idx];
        if (c) {
          c.setAttribute("cx", String(xPx));
          c.setAttribute("cy", String(sy.apply(risk)));
        }
      });
      return;
    }

    const yMax = state.data === "six" ? Math.max(0.25, model.tau) : 1;
    const isNarrow = widthMeas < 480;
    const height = isNarrow ? 250 : 356;
    const marginTop = 28;
    const marginBottom = 40;
    const marginLeft = 48;
    const marginRight = isNarrow ? 112 : 128;
    const innerH = height - marginTop - marginBottom;
    const toPx = (val) => marginTop + (1 - Math.min(yMax, Math.max(0, val)) / yMax) * innerH;
    const fromPx = (py) => (1 - (py - marginTop) / innerH) * yMax;

    const featured = highlights.map((highlight, i) => {
      const line = model.lines.find((d) => d.key === keyOf(highlight.grade));
      if (!line) throw new Error("Highlighted report is not in the line model family");
      return {
        ...line,
        ...highlight,
        index: i,
        currentRisk: state.w * line.R1 + (1 - state.w) * line.R2,
      };
    });

    // Build deduplicated right-edge series labels (placed outside x=1 in right margin)
    const seriesByGrade = new Map();
    for (const d of featured) {
      const gk = keyOf(d.grade);
      const prev = seriesByGrade.get(gk);
      if (!prev) {
        seriesByGrade.set(gk, { ...d, both: false });
      } else if (prev.kind !== d.kind) {
        prev.both = true;
        prev.shortLabel = prev.rank > 0 || d.rank > 0 ? "Tied optimum" : "Both rules";
        prev.stroke = (c) => (state.objective === "minimax" ? c.critInk[1] : c.critInk[0]);
      }
    }
    const seriesRaw = [...seriesByGrade.values()].map((d, idx) => ({
      ...d,
      id: `s${idx}`,
      x: 1,
      yRaw: Math.min(yMax, Math.max(0, d.R1)),
    }));
    const placedSeries = placeDirectLabels(
      seriesRaw.map((d) => ({ id: d.id, y: toPx(d.yRaw), height: 19 })),
      { minGapPx: 21, minY: marginTop + 11, maxY: height - marginBottom - 11 },
    );
    const seriesById = new Map(placedSeries.map((p) => [p.id, p]));
    const seriesLabels = seriesRaw.map((d) => ({
      ...d,
      labelY: fromPx(seriesById.get(d.id).y),
    }));

    // Build worst-endpoint dots and inside-plot numeric pills (placed inside [x(0), x(1)])
    const worstDots = featured.map((d) => ({
      ...d,
      x: d.R1 >= d.R2 ? 1 : 0,
      y: d.max,
    }));
    const seenWorst = new Set();
    const uniqueWorst = worstDots.filter((d) => {
      const k = `${d.x}:${d.max}`;
      if (seenWorst.has(k)) return false;
      seenWorst.add(k);
      return true;
    });
    const worstLabels = [0, 1].flatMap((side) => {
      const group = uniqueWorst.filter((d) => d.x === side);
      const placed = placeDirectLabels(
        group.map((d, idx) => ({ id: `w${side}-${idx}`, y: toPx(d.max), height: 18 })),
        { minGapPx: 20, minY: marginTop + 11, maxY: height - marginBottom - 11 },
      );
      const byId = new Map(placed.map((p) => [p.id, p]));
      return group.map((d, idx) => ({
        ...d,
        side,
        labelY: fromPx(byId.get(`w${side}-${idx}`).y),
      }));
    });
    const leftWorst = worstLabels.filter((d) => d.side === 0);
    const rightWorst = worstLabels.filter((d) => d.side === 1);

    lastChart = plot(chartSlot, {
      alt: "Every eligible report is a line from its criterion two risk at weight zero to its criterion one risk at weight one. The thick band is the exact lower envelope.",
      height,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      x: {
        domain: [0, 1],
        ticks: isNarrow ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1],
        label: state.data === "six" ? "Weight w on score A" : "Weight w on first criterion",
        labelAnchor: "center",
        labelArrow: "none",
      },
      y: {
        domain: [0, yMax],
        grid: true,
        label: "Expected risk",
        labelArrow: "none",
      },
      table: {
        caption: "Highlighted report-risk endpoints",
        rows: featured,
        columns: [
          { label: "Grade vector", value: "grade", format: (v) => formatGrades(v) },
          { label: "Criterion one risk", value: "R1", format: (v) => formatRisk(v) },
          { label: "Criterion two risk", value: "R2", format: (v) => formatRisk(v) },
          { label: "Worst endpoint risk", value: "max", format: (v) => formatRisk(v) },
        ],
      },
      marks: (c, P) => [
        reportTrajectories(P, model, c.neutral[3]),
        P.line(model.envelope, {
          x: "w",
          y: "risk",
          stroke: c.neutral[4],
          strokeWidth: 5.5,
          strokeOpacity: 0.42,
          clip: true,
        }),
        ...featured.map((d) =>
          P.line(
            [
              { x: 0, y: d.R2 },
              { x: 1, y: d.R1 },
            ],
            {
              x: "x",
              y: "y",
              stroke: d.stroke(c),
              strokeWidth: d.active ? 3.2 : d.dash ? 2.2 : 2.6,
              strokeDasharray: d.dash ?? null,
              clip: true,
            },
          ),
        ),
        P.ruleX([state.w], { stroke: c.plotMuted, strokeDasharray: "3,3", strokeWidth: 1.5 }),
        P.dot(featured, {
          x: () => state.w,
          y: "currentRisk",
          fill: (d) => d.stroke(c),
          stroke: c.plotBg,
          strokeWidth: 1.6,
          r: (d) => (d.active ? 5.5 : 4.5),
          clip: false,
        }),
        P.dot(
          worstDots.filter((d) => d.y <= yMax + 1e-9),
          {
            x: "x",
            y: "y",
            fill: (d) => (d.dash ? c.plotBg : d.stroke(c)),
            stroke: (d) => d.stroke(c),
            strokeWidth: 2,
            r: 4.8,
            clip: false,
          },
        ),
        ...(leftWorst.length
          ? [
              numText(leftWorst, {
                x: "x",
                y: "labelY",
                value: "max",
                format: (v) => formatReadoutRisk(v),
                dx: 12,
                textAnchor: "start",
                fontSize: 13,
                fontWeight: 700,
                fill: (d) => d.stroke(c),
                render(index, scales, values, dims, context, next) {
                  const g = next(index, scales, values, dims, context);
                  return attachPills(g, values, index, leftWorst, {
                    anchor: "start",
                    dx: 12,
                    charW: 7.4,
                    padX: 5,
                    fill: c.plotBg,
                    strokeOf: (d) => d.stroke(c),
                  });
                },
              }),
            ]
          : []),
        ...(rightWorst.length
          ? [
              numText(rightWorst, {
                x: "x",
                y: "labelY",
                value: "max",
                format: (v) => formatReadoutRisk(v),
                dx: -12,
                textAnchor: "end",
                fontSize: 13,
                fontWeight: 700,
                fill: (d) => d.stroke(c),
                render(index, scales, values, dims, context, next) {
                  const g = next(index, scales, values, dims, context);
                  return attachPills(g, values, index, rightWorst, {
                    anchor: "end",
                    dx: -12,
                    charW: 7.4,
                    padX: 5,
                    fill: c.plotBg,
                    strokeOf: (d) => d.stroke(c),
                  });
                },
              }),
            ]
          : []),
        P.text(seriesLabels, {
          x: "x",
          y: "labelY",
          text: "shortLabel",
          dx: 11,
          textAnchor: "start",
          fontSize: 13,
          fontWeight: 700,
          fill: (d) => d.stroke(c),
          render(index, scales, values, dims, context, next) {
            const g = next(index, scales, values, dims, context);
            return attachPills(g, values, index, seriesLabels, {
              anchor: "start",
              dx: 11,
              charW: 7.4,
              padX: 5,
              fill: c.plotBg,
              strokeOf: (d) => d.stroke(c),
            });
          },
        }),
      ],
      keyboard: {
        data: model.lines,
        virtual: true,
        x: () => 0.5,
        y: "riskHalf",
        title: (d) =>
          `Report ${formatGrades(d.grade)}: criterion one risk ${formatRisk(d.R1)}, criterion two risk ${formatRisk(d.R2)}, worst endpoint ${formatRisk(d.max)}${d.R1 > yMax && d.R2 > yMax ? "; trajectory wholly above the displayed risk range" : d.max > yMax ? "; trajectory partly clipped at the displayed risk maximum" : ""}`,
      },
    });
    fitMountedPills(lastChart.svg);

    const pal = palette(ctx.root);
    const leftAxisName = state.data === "six" ? "← score B risk" : "← criterion two risk";
    const rightAxisName = state.data === "six" ? "score A risk →" : "criterion one risk →";
    footSlot.replaceChildren(
      h("span", {}, leftAxisName, " · ", rightAxisName),
      h(
        "span",
        { class: "wcr-key" },
        h(
          "span",
          { class: "wcr-key-item" },
          h("i", { class: "wcr-swatch-band", style: { "border-color": pal.neutral[4] } }),
          "Lower envelope",
        ),
        h(
          "span",
          { class: "wcr-key-item" },
          h("i", { class: "wcr-swatch-line", style: { "border-color": pal.neutral[3] } }),
          "Other reports",
        ),
      ),
    );

    prevModel = model;
    prevLayout = layoutKey;
    prevHiKey = hiKey;
    lastFeatured = featured;
  };

  return { stagedAttach, attachFull, render, progress };
}

function renderLiveReadout(ctx, model, state) {
  const r = ro(ctx);
  const { choice, weightedProfiles, guardedProfiles } = model;
  const labels = state.data === "six" ? ["score A", "score B"] : ["criterion one", "criterion two"];
  const first = weightedProfiles[0];
  const guarded = guardedProfiles[0];
  const agree = same(first.grade, guarded.grade);
  const worstName = first.line.R1 >= first.line.R2 ? labels[0] : labels[1];
  const alts = weightedProfiles.slice(1);
  const selectedRule = state.objective === "weighted" ? "weighted risk" : "guard both";

  if (agree) {
    if (choice.weighted.tieCount > 1) {
      r.set([
        "At w ",
        r.setting(state.w),
        ", ",
        r.count(choice.weighted.tieCount),
        " reports tie: weighted risk ",
        r.risk(first.evaluation.risk),
        ", worse-criterion risk ",
        r.risk(choice.minimax.value),
        ` (${selectedRule}).`,
      ]);
      return;
    }
    r.set([
      "At w ",
      r.setting(state.w),
      " both rules choose ",
      reportWords(first.grade, model.E.ids),
      ": weighted risk ",
      r.risk(first.evaluation.risk),
      ", worse-criterion risk ",
      r.risk(guarded.line.max),
      ` (${selectedRule}).`,
    ]);
    return;
  }

  const maxSpan = (val, refVal) =>
    refVal !== undefined && val !== refVal && formatReadoutRisk(val) === formatReadoutRisk(refVal)
      ? r.distinguishing(val, refVal, { minSig: 3, maxSig: 5 })
      : r.risk(val);

  if (state.objective === "weighted") {
    r.set([
      "At w ",
      r.setting(state.w),
      alts.length ? [", ", r.count(weightedProfiles.length), " tied weighted-best reports average "] : " weighted best averages ",
      r.risk(first.evaluation.risk),
      alts.length ? " but reach " : " but reaches ",
      maxSpan(first.line.max, alts[0]?.line.max),
      ...alts.flatMap((p) => [" and ", maxSpan(p.line.max, first.line.max)]),
      ` on ${worstName}; guarding both caps risk at `,
      r.risk(choice.minimax.value),
      ".",
    ]);
    return;
  }

  r.set([
    "At w ",
    r.setting(state.w),
    " guarding both criteria caps risk at ",
    r.risk(choice.minimax.value),
    "; weighted best averages ",
    r.risk(first.evaluation.risk),
    " but reaches ",
    maxSpan(first.line.max, alts[0]?.line.max),
    ...alts.flatMap((p) => [" (", maxSpan(p.line.max, first.line.max), " tied)"]),
    ` on ${worstName}.`,
  ]);
}

function createDisclosuresRenderer(ctx, dataBody, methodBody, comparison) {
  const { h } = ctx;
  const reportsSlot = h("div");
  const profilesSlot = h("div");
  const summarySlot = h("div");

  comparison.append(ctx.panelTitle("Reports attaining each objective"), reportsSlot);
  dataBody.append(
    h(
      "section",
      { class: "wcr-paper prx-light-panel", "aria-label": "Every retained optimum: criterion profiles" },
      ctx.panelTitle("Every retained optimum: criterion profiles"),
      profilesSlot,
    ),
  );
  methodBody.append(
    h(
      "section",
      { class: "wcr-paper prx-light-panel", "aria-label": "The envelope peak and the price of guarding" },
      ctx.panelTitle("The envelope peak and the price of guarding"),
      summarySlot,
    ),
  );

  return (model, state = model.state) => {
    const { choice, weightedProfiles, guardedProfiles, peak } = model;
    const ids = model.E.ids;
    const labels = state.data === "six" ? ["score A", "score B"] : ["criterion one", "criterion two"];
    const ruleResult = (kind) => ({ ...choice, ...choice[kind] });
    const yMax = state.data === "six" ? Math.max(0.25, model.riskModel.tau) : 1;

    const cols = [
      ["weighted", "Weighted best at this weight", weightedProfiles],
      ["minimax", "Guarding both criteria", guardedProfiles],
    ].map(([kind, title, profiles]) => {
      const result = choice[kind];
      const items = [
        h("p", {}, title, " · ", tagNode(ctx, ruleResult(kind)), state.objective === kind ? " · selected objective" : ""),
        h(
          "p",
          { class: "wcr-note" },
          numNode(ctx, result.tieCount, formatCount, `${kind}-tie-count`),
          " report",
          result.tieCount === 1 ? " has" : "s share",
          " the smallest objective value",
          result.tieCount > 1 ? ", tied with another report" : "",
          "; equal-risk tolerance ",
          numNode(ctx, choice.tieTol, formatSci),
          ". Retained ",
          numNode(ctx, profiles.length),
          " report",
          profiles.length === 1 ? "" : "s",
          ".",
        ),
      ];
      profiles.forEach((p, i) => {
        const chips = h("div", { class: "tws-chips" });
        drawTwoScoreReport(ctx, chips, p.grade, ids);
        items.push(
          h(
            "div",
            { class: "wcr-card prx-light-panel" },
            chips,
            h("p", {}, ...p.evaluation.Rk.flatMap((risk, k) => [
              k ? " · " : "", labels[k], " ", numNode(ctx, risk, formatRisk),
              risk === Math.max(...p.evaluation.Rk) ? " (worst)" : "",
            ])),
            h(
              "p",
              {},
              "Grade vector ",
              numNode(ctx, p.grade, formatGrades, `${kind}-grade-${i}`),
              "; ",
              numNode(ctx, p.evaluation.N, formatCount, `${kind}-N-${i}`),
              " of ",
              numNode(ctx, p.evaluation.M),
              " pairs stated.",
            ),
            h(
              "p",
              {},
              "Weighted risk ",
              numNode(ctx, p.evaluation.risk, formatRisk, `${kind}-risk-${i}`),
              "; largest expected criterion risk ",
              numNode(ctx, p.line.max, formatRisk, `${kind}-max-${i}`),
              ".",
            ),
          ),
        );
      });
      return h("div", { class: "wcr-rule-col" }, ...items);
    });

    reportsSlot.replaceChildren(
      h("p", { class: "wcr-note" }, "Grade one is highest target priority. A shared grade withholds comparisons."),
      h("div", { class: "wcr-cards-grid" }, ...cols),
    );

    const rows = [
      ...weightedProfiles.map((p, i) => ({ ...p, kind: "weighted", i })),
      ...guardedProfiles.map((p, i) => ({ ...p, kind: "minimax", i })),
    ];
    const table = h(
      "table",
      { class: "wcr-table" },
      h("caption", {}, "E: expected wrong directions; N: stated pairs; M: all unordered pairs"),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["Rule", "Report", "Criterion", "E", "E/N", "E/M", "Expected criterion risk", "Worst endpoint"].map((text) =>
            h("th", { scope: "col", text }),
          ),
        ),
      ),
      h(
        "tbody",
        {},
        ...rows.flatMap((p) =>
          [0, 1].map((k) =>
            h(
              "tr",
              {},
              h("td", { text: p.kind }),
              h("td", {}, numNode(ctx, p.grade, formatGrades)),
              h("th", { scope: "row", text: labels[k] }),
              h("td", {}, numNode(ctx, p.evaluation.E[k], formatExpectedCount, `${p.kind}-E-${p.i}-${k}`)),
              h("td", {}, numNode(ctx, p.evaluation.EoverN[k], formatShare, `${p.kind}-share-${p.i}-${k}`)),
              h("td", {}, numNode(ctx, p.evaluation.EoverM[k], formatShare, `${p.kind}-perpair-${p.i}-${k}`)),
              h("td", {}, numNode(ctx, p.evaluation.Rk[k], formatRisk, `${p.kind}-Rk-${p.i}-${k}`)),
              h("td", {}, numNode(ctx, p.line.max, formatRisk)),
            ),
          ),
        ),
      ),
    );
    profilesSlot.replaceChildren(
      h("p", { class: "wcr-note" }, "Swipe or use the keyboard to scroll the tables."),
      ctx.scrollRegion(h("div", { class: "wcr-scroll" }, table), "Every retained weighted and guarded profile"),
    );

    if (state.data !== "six") {
      const law = h(
        "table",
        { class: "wcr-table" },
        h("caption", {}, "Every eligible report in the restated two-unit law"),
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ...["Report", "Criterion one risk", "Criterion two risk", "Maximum", "Weighted risk at current w"].map((text) =>
              h("th", { scope: "col", text }),
            ),
          ),
        ),
        h(
          "tbody",
          {},
          ...model.riskModel.lines.map((line, i) =>
            h(
              "tr",
              {},
              h("td", {}, numNode(ctx, line.grade, formatGrades, `law-grade-${i}`)),
              h("td", {}, numNode(ctx, line.R1, formatRisk, `law-R1-${i}`)),
              h("td", {}, numNode(ctx, line.R2, formatRisk, `law-R2-${i}`)),
              h("td", {}, numNode(ctx, line.max, formatRisk, `law-max-${i}`)),
              h(
                "td",
                {},
                numNode(
                  ctx,
                  evaluateReport(line.grade, model.E, { tau: state.tau, w: [state.w, 1 - state.w] }).risk,
                  formatRisk,
                  `law-risk-${i}`,
                ),
              ),
            ),
          ),
        ),
      );
      profilesSlot.append(ctx.scrollRegion(h("div", { class: "wcr-scroll" }, law), "All two-unit report risk endpoints"));
    }

    summarySlot.replaceChildren(
      h(
        "p",
        {},
        "Largest lower-envelope risk: ",
        numNode(ctx, peak.risk, formatRisk, "peak-risk"),
        ". Maximizing weight",
        peak.intervals.length === 1 ? "" : "s",
        ": ",
        ...peak.intervals.flatMap((r, i) => [
          i ? "; " : "",
          numNode(ctx, r.from, weightText, `peak-from-${i}`),
          r.from === r.to ? "" : [" to ", numNode(ctx, r.to, weightText, `peak-to-${i}`)],
        ]),
        ".",
      ),
      h(
        "p",
        {},
        "Deterministic minimax value: ",
        numNode(ctx, choice.minimax.value, formatRisk, "minimax-value"),
        ". The envelope peak is a lower bound; it can be strictly smaller.",
      ),
      ...model.comparisons.map((comparison, i) =>
        h(
          "p",
          {},
          "Guarded report ",
          numNode(ctx, guardedProfiles[i].grade, formatGrades),
          " costs ",
          numNode(ctx, comparison.deltaRisk, formatRisk, `price-${i}`),
          " more weighted risk at this weight than the weighted best.",
        ),
      ),
      h(
        "p",
        { class: "wcr-note" },
        "The guarded set is both criteria, even when one has zero error weight. A fixed report has its worst weight at an endpoint; this differs from the maximizing weight of the lower envelope. Minimax is a maximum of expected criterion risks, not an expected maximum of realized losses. Risks at different weights use different losses.",
      ),
      h(
        "p",
        { class: "wcr-note" },
        "Every gray report trajectory is drawn, clipped to risks from ",
        numNode(ctx, 0, formatSetting),
        " to ",
        numNode(ctx, yMax, formatSetting),
        ". The hidden table and keyboard retain all endpoints. Highlighted trajectories and the exact envelope use the same clipping.",
      ),
      h(
        "p",
        { class: "wcr-note" },
        state.data === "six"
          ? "Six fictional sites; independent Normal posteriors set by hand for teaching; postrank does not fit them. "
          : `${model.data.source}. `,
        "τ = ",
        numNode(ctx, state.tau, formatSetting),
        "; ",
        tagNode(ctx, choice),
        ". Guarding both expected criterion risks.",
      ),
    );
    if (state.data !== "six") {
      summarySlot.append(
        h(
          "p",
          { class: "wcr-note" },
          state.data === "book"
            ? "Criterion one certainly favors A above B; criterion two is an even chance."
            : "The criteria certainly favor opposite directions. Requiring exactly two grades excludes withholding; the lower-envelope peak can lie strictly below the deterministic minimax value.",
        ),
      );
    }
    if (state.data === "book") {
      summarySlot.append(
        h("p", { class: "wcr-note" }, "Weighted risks: A above B, (", numNode(ctx, 1), " − w) / ", numNode(ctx, 2), "; B above A, (", numNode(ctx, 1), " + w) / ", numNode(ctx, 2), "; withholding, τ."),
      );
    }
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "worst-criterion",
    className: "wcr wpath tws wcr-v2",
    frame: "v2",
    css: WORST_CRITERION_V2_CSS,
    keys: {
      data: { type: "choice", values: ["six", "book", "opposition"], value: "six" },
      w: { type: "number", min: 0, max: 1, step: 0.01, value: 0.9 },
      tau: { type: "number", min: 0.001, max: 0.5, step: 0.001, value: 0.2 },
      cap: { type: "choice", values: ["1", "2", "3", "all", "exact2"], value: "3" },
      objective: { type: "choice", values: ["weighted", "minimax"], value: "weighted" },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ctx.slider({
        label: "Weight w on first criterion",
        ...ctx.key("w"),
        onInput: (val) => ctx.set({ w: val }),
      });
      ctx.primaryControl(w.root);
      ctx.controls.append(w.root);

      const objective = ctx.segmented({
        label: "Selected objective",
        name: "objective",
        options: [
          { value: "weighted", label: "Weighted expected risk" },
          { value: "minimax", label: "Guard both criteria" },
        ],
        value: ctx.state.objective,
        onChange: (val) => ctx.set({ objective: val }),
      });
      const data = ctx.select({
        label: "Illustrative law",
        name: "data",
        options: [
          { value: "six", label: "Six sites, two scores" },
          { value: "book", label: "Two units: one certain, one uncertain criterion" },
          { value: "opposition", label: "Two units: certain opposition" },
        ],
        value: ctx.state.data,
        onChange: (nextData) =>
          ctx.set({
            data: nextData,
            tau: nextData === "six" ? 0.2 : 0.25,
            cap: nextData === "opposition" ? "exact2" : nextData === "six" ? "3" : "all",
          }),
      });
      const tau = ctx.slider({
        label: "Cost τ per withheld pair",
        ...ctx.key("tau"),
        onInput: (val) => ctx.set({ tau: val }),
      });
      const cap = ctx.select({
        label: "Allowed grades",
        name: "cap",
        options: [
          { value: "1", label: "At most one" },
          { value: "2", label: "At most two" },
          { value: "3", label: "At most three" },
          { value: "all", label: "No cap" },
          { value: "exact2", label: "Exactly two" },
        ],
        value: ctx.state.cap,
        onChange: (val) => ctx.set({ cap: val }),
      });
      ctx.settingsBox("Settings").body.append(objective.root, data.root, tau.root, cap.root);

      const stageWrap = h("section", { class: "wcr-stage-wrap", "aria-label": "Each report’s risk as the weight moves" });
      const comparison = h("section", { class: "wcr-comparison", "aria-label": "Weighted and guarded reports" });
      ctx.stage.append(h("div", { class: "wcr-linked" }, stageWrap, comparison));
      const riskView = createStageRiskView(ctx, stageWrap);

      const dataBox = ctx.dataBox("Data and criterion profiles");
      const methodBox = ctx.methodBox("Method and envelope price");
      const renderDetails = createDisclosuresRenderer(ctx, dataBox.body, methodBox.body, comparison);

      let readyRiskModel = null;
      let readyLarge = false;
      ctx.onCleanup(() => {
        riskView.progress.textContent = "";
      });

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;

          w.set(state.w);
          objective.set(state.objective);
          data.set(state.data);
          tau.set(state.tau);
          cap.set(state.cap);

          const model = fastSolveGuarded(state);
          const highlights = buildHighlights(model, state);

          if (model.riskModel === readyRiskModel || (!readyLarge && model.riskModel.lines.length <= 603)) {
            riskView.progress.textContent = "";
            ctx.scheduleStages([]);
            renderLiveReadout(ctx, model, state);
            riskView.render(model.riskModel, state, highlights);
            renderDetails(model, state);
            readyRiskModel = model.riskModel;
            readyLarge = model.riskModel.lines.length > 603;
            return;
          }

          riskView.progress.textContent = "Updating reports…";
          const { initFirstBatch, moreBatches } = riskView.stagedAttach(model.riskModel, 256);
          const stages = [
            () => {
              renderLiveReadout(ctx, model, state);
              initFirstBatch();
            },
            ...moreBatches,
            () => riskView.render(model.riskModel, state, highlights, { force: true }),
            () => {
              renderDetails(model, state);
              readyRiskModel = model.riskModel;
              readyLarge = model.riskModel.lines.length > 603;
              riskView.progress.textContent = "";
            },
          ];
          ctx.scheduleStages(stages, { yieldMs: 0 });
        },
      };
    },
  });
}
