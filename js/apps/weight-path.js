export * from "../shared/domain/weight-path.js";

import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatDistinguishing,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  setNum,
} from "../shared/format.js";
import { tagNode } from "../shared/labels.js";
import { evaluateReport, exactOptimum, minimaxChoice, weightBreakpoints } from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from "../shared/criteria-provenance.js";
import {
  TWO_SCORES_KEYS,
  drawTwoScoreReport,
  reportWords,
  shareText,
  solveTwoScores,
  twoScoreFamily,
} from "../shared/domain/two-scores.js";
import { weightText } from "../shared/domain/weight-path.js";

const WEIGHT_PATH_V2_CSS = `
.wpath-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 1rem;
  flex: 1 1 28rem;
  min-width: 0;
}
.wpath-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
  flex: 1 1 15rem;
  min-width: 0;
}
.wpath-v2.prx-widget[data-prx-frame="v2"] .prx-stage .wpath-overview {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.wpath-v2 .wpath-overview figure {
  margin: 0;
}
.wpath-v2 .prx-stage .wpath-summary {
  margin: 0 0 0.25rem;
  font-size: 0.84375rem;
  color: var(--prx-plot-muted);
}
.wpath-v2 .wpath-overview .wpath-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.9rem;
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.wpath-v2 .wpath-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  margin: 0;
  padding: 0.2rem 0;
}
.wpath-v2 .wpath-keyline {
  display: inline-block;
  width: 1.3rem;
  border-top: 3px solid;
  margin-right: 0.32rem;
  vertical-align: middle;
}
.wpath-v2 .wpath-tiedot {
  display: inline-block;
  width: 0.56rem;
  height: 0.56rem;
  border-radius: 50%;
  background: var(--prx-plot-fg);
  margin: 0 0.28rem 0 0.05rem;
  vertical-align: 0.04em;
}
.wpath-v2 .wpath-interval-key {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: 0.15rem 0.65rem;
  padding: 0.3rem 0 0;
  margin: 0;
  font-size: 0.84rem;
  list-style: none;
}
.wpath-v2 .wpath-interval-key [aria-current] {
  font-weight: 700;
}
.wpath-v2 .prx-stage .wpath-status {
  min-height: 1.25rem;
  line-height: 1.25;
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.wpath-v2 .wpath-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem 1.1rem;
  min-width: 0;
}
.wpath-v2 .wpath-grid > section {
  min-width: 0;
}
.wpath-v2 .wpath-wide {
  grid-column: 1 / -1;
  min-width: 0;
}
.wpath-v2 .wpath-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  min-width: 0;
}
.wpath-v2 .wpath-paper + .wpath-paper {
  margin-top: 0.65rem;
}
.wpath-v2 .wpath-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.wpath-v2 .wpath-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 52rem;
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.wpath-v2 .wpath-table th,
.wpath-v2 .wpath-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: left;
  white-space: nowrap;
}
.wpath-v2 .wpath-table caption {
  text-align: left;
  font-weight: 600;
  padding: 0.25rem 0 0.35rem;
}
.wpath-v2 .wpath-note {
  font-size: 0.875rem;
  line-height: 1.45;
  margin: 0.3rem 0 0.55rem;
  color: var(--prx-fg);
}
.wpath-v2 .wpath-paper .wpath-note {
  color: var(--prx-plot-fg);
}
.wpath-v2 .wpath-all-endpoints table {
  table-layout: fixed;
  width: 100%;
}
.wpath-v2 .wpath-endlabels {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  font-size: 0.8125rem;
  padding: 0.15rem 0.2rem;
}
.wpath-v2 .tws-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin: 0.15rem 0 0.35rem;
}
.wpath-v2 .tws-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.18rem 0.55rem 0.18rem 0.28rem;
  border-radius: 5px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.wpath-v2 .tws-g {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  font-size: 0.75rem;
  letter-spacing: 0;
}
.wpath-v2 .prx-light-panel .tws-gt {
  font-weight: 700;
  color: var(--prx-plot-muted);
}
.wpath-v2 .tws-facts,
.wpath-v2 .tws-note {
  font-size: 0.875rem;
  line-height: 1.45;
  margin: 0.3rem 0 0.5rem;
}
.wpath-v2 .tws-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.wpath-v2 .tws-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  min-width: 42rem;
  font-variant-numeric: tabular-nums;
}
.wpath-v2 .tws-table th,
.wpath-v2 .tws-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: left;
  white-space: nowrap;
}
.wpath-v2 .tws-table caption {
  text-align: left;
  font-weight: 600;
  padding: 0.25rem 0 0.35rem;
}
.wpath-v2 .tws-report {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--prx-border);
}
.wpath-v2 .tws-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.95rem;
  font-size: 0.84rem;
  margin: 0.35rem 0 0;
}
.wpath-v2 .tws-dot-key {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  margin-right: 0.32rem;
  vertical-align: -0.06em;
  box-sizing: border-box;
}
.wpath-v2 .tws-share-summary {
  display: block;
}
@media (max-width: 48rem) {
  .wpath-v2 .wpath-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

const keyOf = (g) => Array.from(g).join("/");
const localPathCache = new Map();

function numNode(ctx, value, fmt = formatCount, hook) {
  const n = ctx.num(value, fmt(value));
  if (hook) n.dataset.prxReadout = hook;
  return n;
}

function readoutWeight(w, otherW) {
  if (w === 0) return "0";
  if (w === 1) return "1";
  if (w > 0 && w < 0.001) return "below .001";
  if (w > 0.999 && w < 1) return "above .999";
  const base = formatReadoutProb(w);
  if (typeof otherW === "number" && otherW >= 0.001 && otherW <= 0.999 && base === formatReadoutProb(otherW)) {
    return formatDistinguishing(w, otherW, { minSig: 3, maxSig: 5 });
  }
  return base;
}

function fastSolveWeightPath(state = {}) {
  const s = { w: 0.5, tau: 0.2, cap: "3", ...state };
  const data = criteriaData("six");
  const cacheKey = JSON.stringify([s.tau, s.cap]);
  let fixed = localPathCache.get(cacheKey);
  if (!fixed) {
    const family = twoScoreFamily(s.cap);
    const path = weightBreakpoints(data.E, { tau: s.tau, family });
    const choice = minimaxChoice(data.E, { tau: s.tau, w: [0.5, 0.5], family });
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
    const riskModel = {
      E: data.E,
      tau: s.tau,
      family,
      path,
      lines,
      envelope,
      envelopeMaximum: path.envelopeMaximum,
      choice,
    };
    const intervals = path.intervals.map((row, index) => ({
      ...row,
      index,
      evaluation: evaluateReport(row.grade, data.E, { tau: s.tau, w: [0.5, 0.5] }),
    }));
    const boundaryWeights = Array.from(new Set([0, ...path.intervals.flatMap((r) => [r.wFrom, r.wTo]), 1])).sort((a, b) => a - b);
    const endpointTies = boundaryWeights.map((w) => {
      const result = exactOptimum(data.E, { tau: s.tau, w: [w, 1 - w], family });
      return {
        w,
        result,
        profiles: result.grades.map((grade) => ({
          grade,
          evaluation: evaluateReport(grade, data.E, { tau: s.tau, w: [w, 1 - w] }),
        })),
      };
    });
    fixed = { data, path, intervals, endpointTies, riskModel };
    localPathCache.set(cacheKey, fixed);
    if (localPathCache.size > 12) localPathCache.delete(localPathCache.keys().next().value);
  }
  return { ...fixed, state: s, base: solveTwoScores(s) };
}

function displayPath(model) {
  const { intervals, endpointTies, path } = model;
  const [first, second] = intervals;
  const atZero = new Set(endpointTies[0].profiles.map((p) => keyOf(p.grade)));
  const snap =
    first.wFrom === 0 &&
    first.wTo > 0 &&
    first.wTo <= path.tieTol &&
    second?.wFrom === first.wTo &&
    atZero.has(keyOf(first.grade)) &&
    atZero.has(keyOf(second.grade));
  if (!snap) return { intervals, breakpoints: path.breakpoints };
  return {
    intervals: [{ ...first, wTo: 0 }, { ...second, wFrom: 0 }, ...intervals.slice(2)],
    breakpoints: path.breakpoints.filter((w) => w !== first.wTo),
    rawIntervals: intervals,
  };
}

function reportTrajectories(P, model, color) {
  const style = { z: null, stroke: color, strokeWidth: 1.1, strokeOpacity: 0.9, clip: true };
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

function createFastWeightedRiskView(ctx, slot) {
  const { h, doc } = ctx;
  const chartSlot = h("div");
  const notesSlot = h("div");
  const allTableSlot = h("div", { class: "wpath-all-endpoints" });
  slot.append(chartSlot, notesSlot, allTableSlot);

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

  const render = (model, state = { w: 0.5 }, highlights = [], { force = false } = {}) => {
    if (attachedModel !== model) attachFull(model);
    const layoutKey = [
      Math.round(chartSlot.clientWidth || 0),
      doc.documentElement.getAttribute("data-theme") || "",
      ctx.root.getAttribute("data-prx-font-scale") || "",
    ].join("|");
    const hiKey = highlights.map((d) => `${keyOf(d.grade)}:${d.dash ?? ""}`).join("|");

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

    const yMax = Math.max(0.25, model.tau);
    const pal = palette(ctx.root);
    const featured = highlights.map((highlight, i) => {
      const line = model.lines.find((d) => d.key === keyOf(highlight.grade));
      if (!line) throw new Error("Highlighted report is not in the line model family");
      return {
        ...line,
        ...highlight,
        index: i,
        currentRisk: state.w * line.R1 + (1 - state.w) * line.R2,
        stroke: highlight.stroke ?? ((c) => c.plotFg),
      };
    });
    const worst = featured.map((d) => ({ ...d, x: d.R1 >= d.R2 ? 1 : 0, y: d.max }));
    const labelledEndpoints = new Set();
    const worstLabels = worst.filter((d) => {
      const key = `${d.x}:${d.max}`;
      if (labelledEndpoints.has(key)) return false;
      labelledEndpoints.add(key);
      return true;
    });

    lastChart = plot(chartSlot, {
      alt: "Every eligible report is a line from its criterion two risk at weight zero to its criterion one risk at weight one. The thick band is the exact lower envelope.",
      height: 300,
      marginTop: 24,
      marginBottom: 40,
      marginLeft: 50,
      marginRight: 56,
      x: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], label: "Weight on the first criterion", labelAnchor: "center", labelArrow: "none" },
      y: { domain: [0, yMax], grid: true, label: "Expected risk", labelArrow: "none" },
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
        reportTrajectories(P, model, c.plotGrid),
        P.line(model.envelope, { x: "w", y: "risk", stroke: c.plotMuted, strokeWidth: 7, strokeOpacity: 0.75, clip: true }),
        ...featured.map((d) =>
          P.line(
            [
              { x: 0, y: d.R2 },
              { x: 1, y: d.R1 },
            ],
            { x: "x", y: "y", stroke: d.stroke(c), strokeWidth: d.dash ? 2 : 3, strokeDasharray: d.dash ?? null, clip: true },
          ),
        ),
        P.ruleX([state.w], { stroke: c.plotFg, strokeDasharray: "2,2" }),
        P.dot(featured, { x: () => state.w, y: "currentRisk", fill: (d) => d.stroke(c), stroke: c.plotBg, r: 5.5, clip: true }),
        P.dot(worst, { x: "x", y: "y", fill: (d) => (d.dash ? c.plotBg : d.stroke(c)), stroke: (d) => d.stroke(c), strokeWidth: 2, r: 5, clip: true }),
        ...worstLabels.map((d) =>
          numText([d], {
            x: "x",
            y: "y",
            value: "max",
            format: (v) => formatRisk(v),
            dx: d.x ? 9 : d.y >= yMax ? -8 : 8,
            dy: d.y >= yMax ? 16 : d.index % 2 ? 14 : -14,
            textAnchor: d.x === 0 && d.y >= yMax ? "end" : "start",
            fontSize: 13,
            fill: c.plotFg,
          }),
        ),
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

    const legend = h("div", { class: "wpath-legend prx-light-panel", "data-prx-part": "legend" });
    [
      [pal.plotGrid, "Other reports"],
      [pal.plotMuted, "Exact lowest risk at each weight"],
      ...featured.map((d) => [d.stroke(pal), d.label, d.dash]),
    ].forEach(([color, label, dash]) =>
      legend.append(h("span", {}, h("i", { class: "wpath-keyline", style: { "border-color": color, "border-top-style": dash ? "dashed" : "solid" } }), label)),
    );
    notesSlot.replaceChildren(
      h("div", { class: "wpath-endlabels prx-light-panel" }, h("span", {}, "← criterion two risk"), h("span", {}, "criterion one risk →")),
      legend,
      h(
        "p",
        { class: "wpath-note" },
        "Every gray report trajectory is drawn, clipped to risks from ",
        numNode(ctx, 0, formatSetting),
        " to ",
        numNode(ctx, yMax, formatSetting),
        ". The hidden table and keyboard retain all endpoints. Highlighted trajectories and the exact envelope use the same clipping.",
      ),
    );

    prevModel = model;
    prevLayout = layoutKey;
    prevHiKey = hiKey;
    lastFeatured = featured;
  };

  return { stagedAttach, attachFull, render };
}

function createOverviewRenderer(ctx, slot) {
  const { h } = ctx;
  const summary = h("p", { class: "wpath-summary" });
  const strip = h("div");
  const shares = h("div");
  const legend = h("p", { class: "wpath-legend prx-light-panel", "data-prx-part": "legend" });
  const key = h("ul", { class: "wpath-interval-key" });
  slot.append(summary, strip, shares, h("div", { class: "wpath-meta-row" }, legend), key);

  const margins = { marginLeft: 58, marginRight: 24 };
  const compactWeight = (w) => formatDecimal(w, { digits: 5 });

  return (model, state) => {
    const shown = displayPath(model);
    const regular = shown.intervals.filter((r) => r.wTo > r.wFrom);
    const M = model.data.M;
    const active = regular.find(
      (r) => keyOf(r.grade) === keyOf(model.base.result.grade) && r.wFrom - model.path.tieTol <= state.w && state.w <= r.wTo + model.path.tieTol,
    );
    const labelRows = regular.map((r, i) => ({
      ...r,
      code: i + 1,
      mid: (r.wFrom + r.wTo) / 2,
      report: reportWords(r.grade, model.data.ids),
    }));

    const measured = Math.round(slot.getBoundingClientRect?.().width || slot.clientWidth || ctx.stage.clientWidth || 0);
    const width = Math.max(240, measured > 0 ? measured : ctx.width());
    const stripH = width < 480 ? 82 : 92;
    const sharesH = width < 480 ? 228 : 292;
    const innerWidth = Math.max(1, width - margins.marginLeft - margins.marginRight);
    const visibleCodes = labelRows.filter((r) => (r.wTo - r.wFrom) * innerWidth >= (r.code < 10 ? 14 : 20));
    const ends = model.endpointTies.filter((r) => (r.w === 0 || r.w === 1) && r.result.tieCount > 1);

    summary.replaceChildren(
      numNode(ctx, shown.breakpoints.length),
      " interior boundaries",
      ...ends.flatMap((r) => [
        " · ",
        h("i", { class: "wpath-tiedot", "aria-hidden": "true" }),
        "At w = ",
        numNode(ctx, r.w, formatSetting),
        ", ",
        numNode(ctx, r.result.tieCount),
        " reports tie.",
      ]),
    );

    const stripFig = plot(strip, {
      ...margins,
      width,
      height: stripH,
      marginTop: 10,
      marginBottom: 4,
      x: { domain: [0, 1], axis: null },
      y: { domain: [0, 1], axis: null },
      alt: "The selected weight crosses adjacent intervals of constant best report. Endpoint dots mark ties.",
      keyboard: {
        data: labelRows,
        x: "mid",
        y: () => 0.42,
        sort: false,
        pointer: true,
        title: (r) => `${r.report}; ${formatCount(r.N)} stated pairs; from ${compactWeight(r.wFrom)} to ${compactWeight(r.wTo)}.`,
      },
      table: {
        caption: "Displayed weight intervals of positive width",
        rows: labelRows,
        columns: [
          { label: "Report", value: "report" },
          { label: "Pairs stated", value: "N", format: formatCount },
          { label: "From weight", value: "wFrom", format: compactWeight },
          { label: "To weight", value: "wTo", format: compactWeight },
        ],
      },
      marks: (c, P) => [
        P.rect(labelRows, {
          x1: "wFrom",
          x2: "wTo",
          y1: 0.14,
          y2: 0.68,
          rx: 3,
          insetLeft: 0.7,
          insetRight: 0.7,
          fill: (r) => (r.index === active?.index ? c.post : c.plotGrid),
        }),
        P.ruleX([state.w], { stroke: c.est, strokeWidth: 2 }),
        numText(visibleCodes, {
          x: "mid",
          y: () => 0.41,
          value: "code",
          format: formatCount,
          fill: (r) => (r.index === active?.index ? labelOn(c.post, c) : c.plotFg),
          fontWeight: 700,
          fontSize: 13,
        }),
        P.dot(ends, { x: "w", y: () => 0.85, r: 4.5, fill: c.plotFg }),
        ...(ends.length
          ? [
              P.text(ends, {
                x: "w",
                y: () => 0.85,
                text: () => "tie",
                fill: c.plotMuted,
                fontWeight: 600,
                fontSize: 13,
                render(index, scales, values, dims, context, next) {
                  const g = next(index, scales, values, dims, context);
                  g.removeAttribute("transform");
                  const texts = [...g.querySelectorAll("text")];
                  Array.from(index).forEach((i, j) => {
                    const tNode = texts[j];
                    if (!tNode) return;
                    const r = ends[i];
                    const anchor = r.w < 0.5 ? "start" : "end";
                    const px = values.x[i] + (r.w < 0.5 ? 8 : -8);
                    const py = values.y[i];
                    tNode.removeAttribute("transform");
                    tNode.setAttribute("x", px.toFixed(1));
                    tNode.setAttribute("y", py.toFixed(1));
                    tNode.setAttribute("dominant-baseline", "central");
                    tNode.setAttribute("text-anchor", anchor);
                    tNode.style.textAnchor = anchor;
                    const rect = context.document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    const pw = 24;
                    const rx = anchor === "end" ? px - pw + 3.5 : px - 3.5;
                    rect.setAttribute("x", rx.toFixed(1));
                    rect.setAttribute("y", (py - 8).toFixed(1));
                    rect.setAttribute("width", String(pw));
                    rect.setAttribute("height", "16");
                    rect.setAttribute("rx", "3");
                    rect.setAttribute("fill", c.plotBg);
                    rect.setAttribute("data-wpath-pill", anchor);
                    rect.setAttribute("data-wpath-px", String(px));
                    tNode.before(rect);
                  });
                  return g;
                },
              }),
            ]
          : []),
      ],
    });

    const points = shown.intervals.flatMap((r) => [0, 1].flatMap((k) => [r.wFrom, r.wTo].map((w) => ({ w, k, share: r.EoverN[k], report: keyOf(r.grade) }))));
    const yTop = Math.max(0.26, ...points.map((p) => p.share ?? 0) ) * 1.06;
    const focusRaw = model.base.profiles[0].evaluation.EoverN.flatMap((share, k) => (share === null ? [] : [{ id: String(k), w: state.w, k, share }]));
    const mt = 24;
    const mb = 40;
    const innerH = sharesH - mt - mb;
    const toPx = (s) => mt + (1 - s / yTop) * innerH;
    const fromPx = (py) => (1 - (py - mt) / innerH) * yTop;
    const placedFocus = placeDirectLabels(
      focusRaw.map((p) => ({ id: p.id, y: toPx(p.share), height: 18 })),
      { minGapPx: 19, minY: mt + 11, maxY: sharesH - mb - 12 },
    );
    const focusById = new Map(placedFocus.map((p) => [p.id, p]));
    const placeLeft = state.w > 0.76;

    const sharesFig = plot(shares, {
      ...margins,
      width,
      height: sharesH,
      marginTop: mt,
      marginBottom: mb,
      x: {
        domain: [0, 1],
        ticks: width < 480 ? [0, 0.2, 0.4, 0.6, 0.8, 1] : undefined,
        label: "Weight on score A",
        labelAnchor: "center",
        labelArrow: "none",
      },
      y: { domain: [0, yTop], grid: true, label: "Expected wrong share", labelArrow: "none" },
      alt: "The expected wrong share for each score changes when the best report changes. The line marks the selected weight.",
      keyboard: {
        data: points.filter((p) => p.share !== null),
        x: "w",
        y: "share",
        pointer: true,
        title: (p) => `Score ${p.k ? "B" : "A"}: ${shareText(p.share)}, report ${p.report}, at weight ${compactWeight(p.w)}.`,
      },
      marks: (c, P) => [
        P.line(points, { x: "w", y: "share", z: "k", stroke: (p) => c.crit[p.k], strokeWidth: 2.4 }),
        P.ruleX([state.w], { stroke: c.est, strokeWidth: 2 }),
        P.dot(focusRaw, { x: "w", y: "share", fill: (p) => c.crit[p.k], stroke: c.plotBg, strokeWidth: 1.5, r: 4.2 }),
        ...focusRaw.map((p) => {
          const placed = focusById.get(p.id);
          const dx = placeLeft ? -9 : 9;
          const anchor = placeLeft ? "end" : "start";
          return numText([{ ...p, labelY: fromPx(placed.y) }], {
            x: "w",
            y: "labelY",
            value: "share",
            format: shareText,
            dx,
            textAnchor: anchor,
            fill: c.critInk[p.k],
            fontWeight: 600,
            fontSize: 13,
            render(index, scales, values, dims, context, next) {
              const g = next(index, scales, values, dims, context);
              g.removeAttribute("transform");
              const tNode = g.querySelector("text");
              if (tNode) {
                const px = values.x[0] + dx;
                const py = values.y[0];
                tNode.removeAttribute("transform");
                tNode.removeAttribute("dx");
                tNode.removeAttribute("dy");
                tNode.setAttribute("x", px.toFixed(1));
                tNode.setAttribute("y", py.toFixed(1));
                tNode.setAttribute("dominant-baseline", "central");
                tNode.setAttribute("text-anchor", anchor);
                tNode.style.textAnchor = anchor;
                const str = (tNode.textContent || "").trim();
                const pw = Math.max(24, Math.ceil(str.length * 7.4 + 8));
                const rx = anchor === "end" ? px - pw + 4 : px - 4;
                const rect = context.document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", rx.toFixed(1));
                rect.setAttribute("y", (py - 8.5).toFixed(1));
                rect.setAttribute("width", String(pw));
                rect.setAttribute("height", "17");
                rect.setAttribute("rx", "3");
                rect.setAttribute("fill", c.plotBg);
                rect.setAttribute("stroke", c.crit[p.k]);
                rect.setAttribute("stroke-width", "1");
                rect.setAttribute("stroke-opacity", "0.38");
                rect.setAttribute("data-wpath-pill", anchor);
                rect.setAttribute("data-wpath-px", String(px));
                tNode.before(rect);
              }
              return g;
            },
          });
        }),
      ],
    });

    for (const svg of [stripFig.svg, sharesFig.svg]) {
      for (const rect of svg?.querySelectorAll?.("rect[data-wpath-pill]") ?? []) {
        const tNode = rect.nextElementSibling;
        const tw = tNode?.getComputedTextLength?.() || 0;
        if (!(tw > 0)) continue;
        const anchor = rect.getAttribute("data-wpath-pill") || "start";
        const px = Number(rect.getAttribute("data-wpath-px")) || 0;
        const pw = Math.ceil(tw + 8);
        const rx = anchor === "end" ? px - pw + 4 : px - 4;
        rect.setAttribute("x", rx.toFixed(1));
        rect.setAttribute("width", String(pw));
      }
    }

    const pal = palette(ctx.root);
    legend.replaceChildren(
      ...["Score A", "Score B"].map((name, k) => h("span", {}, h("i", { class: "wpath-keyline", style: { "border-color": pal.crit[k] } }), name)),
    );
    key.replaceChildren(
      ...labelRows.map((r) => h("li", { "aria-current": r.index === active?.index ? "true" : null }, numNode(ctx, r.code), ". ", r.report, " · ", numNode(ctx, r.N), " pairs")),
    );

    // 3-sig-fig live readout (<= 34 words across all states)
    const profile = model.base.profiles[0];
    const ties = model.base.result.tieCount;
    const profileShares = (p) => [numNode(ctx, p.evaluation.EoverN[0], shareText), " on score A and ", numNode(ctx, p.evaluation.EoverN[1], shareText), " on score B"];
    ctx.readout.set(
      ties > 1
        ? [
            "At w ",
            numNode(ctx, state.w, formatSetting),
            ", ",
            numNode(ctx, ties),
            " reports tie (risk ",
            numNode(ctx, profile.evaluation.risk, formatReadoutRisk),
            ", ",
            numNode(ctx, profile.evaluation.N),
            "/",
            numNode(ctx, M),
            "): ",
            reportWords(profile.grade, model.data.ids),
            " (",
            numNode(ctx, profile.evaluation.EoverN[0], shareText),
            " on score A, ",
            numNode(ctx, profile.evaluation.EoverN[1], shareText),
            " B)",
            ...model.base.profiles.slice(1).flatMap((p) => [
              "; ",
              reportWords(p.grade, model.data.ids),
              " (",
              numNode(ctx, p.evaluation.EoverN[0], shareText),
              " on score A, ",
              numNode(ctx, p.evaluation.EoverN[1], shareText),
              " B)",
            ]),
            ".",
            ...(state.cap === "all" ? [" All ", numNode(ctx, model.base.result.family.sizeExact), " reports searched."] : []),
          ]
        : [
            "At w ",
            numNode(ctx, state.w, formatSetting),
            ", ",
            reportWords(profile.grade, model.data.ids),
            ": ",
            numNode(ctx, profile.evaluation.N),
            " of ",
            numNode(ctx, M),
            " pairs",
            ...(active
              ? [
                  ", optimal from ",
                  numNode(ctx, active.wFrom, (v) => readoutWeight(v, active.wTo)),
                  " to ",
                  numNode(ctx, active.wTo, (v) => readoutWeight(v, active.wFrom)),
                ]
              : []),
            "; wrong share ",
            ...profileShares(profile),
            "; weighted risk ",
            numNode(ctx, profile.evaluation.risk, formatReadoutRisk),
            ".",
            ...(state.cap === "all" ? [" All ", numNode(ctx, model.base.result.family.sizeExact), " reports searched."] : []),
          ],
    );
  };
}

function createReportDetailRenderer(ctx, parent) {
  const { h } = ctx;
  const slots = {};
  const panel = (key, title, wide = false) => {
    const slot = h("div");
    slots[key] = slot;
    return h("section", { class: `wpath-paper prx-light-panel ${wide ? "wpath-wide" : ""}`.trim(), "aria-label": title }, ctx.panelTitle(title), slot);
  };
  parent.append(
    h(
      "div",
      { class: "wpath-grid" },
      panel("slope", "Six sites on two scores (posterior means)"),
      panel("report", "Best report for both scores"),
      panel("relation", "Relations in the first best report"),
      panel("pairs", "Weighted pair errors against the withholding cost"),
      panel("profile", "Every best report: criterion profile", true),
      panel("bound", "What the mean bound says", true),
    ),
  );

  const renderDom = (model, state = model.state) => {
    const { data, result, profiles } = model;
    const grade = result.grade;
    const packageIndex = sixSitePackageRepresentativeIndex(
      state,
      profiles.map((p) => p.grade),
    );
    const reportNodes = [];
    profiles.forEach((p, i) => {
      const chips = h("div", { class: "tws-chips" });
      drawTwoScoreReport(ctx, chips, p.grade, data.ids);
      reportNodes.push(
        h(
          "div",
          { class: "tws-report" },
          h("p", { class: "tws-facts" }, i ? "Another best report" : "Grade one is highest priority; a shared grade withholds its comparisons."),
          chips,
          h(
            "p",
            { class: "tws-facts" },
            numNode(ctx, p.evaluation.N, formatCount, `N-${i}`),
            " of ",
            numNode(ctx, data.M),
            " pairs stated; risk ",
            numNode(ctx, p.evaluation.risk, formatRisk, `risk-${i}`),
          ),
          h("p", { class: "tws-facts" }, "Grade vector ", numNode(ctx, p.grade, formatGrades, `grade-${i}`)),
          i === packageIndex
            ? h(
                "p",
                { class: "tws-note", "data-prx-package-representative": "" },
                "The recorded postrank ",
                ...SIX_SITE_PACKAGE_VERSION.flatMap((v, j) => [j ? "." : "", numNode(ctx, v)]),
                " representative at this score-B-only setting is ",
                numNode(ctx, p.grade, formatGrades, "package-grade"),
                ". Its live expected wrong share on score A is ",
                numNode(ctx, p.evaluation.EoverN[0], shareText, "package-share-A"),
                ". All tied reports remain available.",
              )
            : null,
        ),
      );
    });
    const tie = h(
      "p",
      { class: "tws-note", "data-prx-ties": "" },
      result.tieCount > 1
        ? [
            numNode(ctx, result.tieCount),
            " reports share the smallest risk, tied with another report; equal-risk tolerance ",
            numNode(ctx, result.tieTol, formatSci),
            ". All retained reports appear below.",
          ]
        : ["One report has the smallest risk; equal-risk tolerance ", numNode(ctx, result.tieTol, formatSci), "."],
    );
    if (result.tieCount > profiles.length) tie.append(" Retained ", numNode(ctx, profiles.length), " of ", numNode(ctx, result.tieCount), " reports.");
    const shareLine = (p, i) => [
      numNode(ctx, p.evaluation.EoverN[0], shareText, `live-share-${i}-0`),
      " on score A and ",
      numNode(ctx, p.evaluation.EoverN[1], shareText, `live-share-${i}-1`),
      " on score B.",
    ];
    const detailReadout = h(
      "p",
      { "data-prx-part": "readout" },
      "Expected wrong shares among each report’s stated directions: ",
      ...profiles.map((p, i) => h("span", { class: "tws-share-summary" }, "Report ", numNode(ctx, p.grade, formatGrades, `live-grade-${i}`), ": ", ...shareLine(p, i))),
    );
    slots.report.replaceChildren(h("p", { class: "tws-facts" }, tagNode(ctx, result)), tie, ...reportNodes, detailReadout);

    const profileRows = profiles.flatMap((p, i) =>
      data.criterionLabels.map((criterion, k) => ({ i, grade: p.grade, criterion, k, ...p.evaluation })),
    );
    const profileTable = h(
      "table",
      { class: "tws-table" },
      h("caption", {}, "E = expected wrong directions; N = stated pairs; M = all unordered pairs."),
      h("thead", {}, h("tr", {}, ...["Report", "Criterion", "E", "E/N", "E/M", "Criterion risk", "N", "M"].map((t) => h("th", { scope: "col", text: t })))),
      h(
        "tbody",
        {},
        ...profileRows.map((p) =>
          h(
            "tr",
            {},
            h("td", {}, numNode(ctx, p.grade, formatGrades)),
            h("th", { scope: "row", text: p.criterion }),
            h("td", {}, numNode(ctx, p.E[p.k], formatExpectedCount, `E-${p.i}-${p.k}`)),
            h("td", {}, numNode(ctx, p.EoverN[p.k], shareText, `share-${p.i}-${p.k}`)),
            h("td", {}, numNode(ctx, p.EoverM[p.k], formatShare, `perpair-${p.i}-${p.k}`)),
            h("td", {}, numNode(ctx, p.Rk[p.k], formatRisk, `Rk-${p.i}-${p.k}`)),
            h("td", {}, numNode(ctx, p.N)),
            h("td", {}, numNode(ctx, p.M)),
          ),
        ),
      ),
    );
    slots.profile.replaceChildren(
      h("p", { class: "tws-note" }, "Swipe or use the keyboard to scroll the profile table."),
      ctx.scrollRegion(h("div", { class: "tws-scroll" }, profileTable), "Criterion profiles for every retained best report"),
    );

    const boundRows = profiles.map((p, i) =>
      h(
        "p",
        { class: "tws-facts" },
        "Report ",
        numNode(ctx, p.grade, formatGrades),
        ": weighted expected wrong count ",
        numNode(ctx, p.evaluation.Ew, formatExpectedCount, `Ew-${i}`),
        model.conditionalBound ? " ≤ τ × N = " : " versus τ × N = ",
        numNode(ctx, state.tau, formatSetting),
        " × ",
        numNode(ctx, p.evaluation.N),
        " = ",
        numNode(ctx, model.bounds[i].budget.qN, formatExpectedCount, `tauN-${i}`),
        "; count slack ",
        numNode(ctx, model.bounds[i].budget.slack, formatExpectedCount, `bound-slack-${i}`),
        "; risk minus τ ",
        numNode(ctx, model.bounds[i].comparison.deltaRisk, formatRisk, `bound-residual-${i}`),
        ".",
      ),
    );
    const same = model.uncapped.grades.some((g) => g.every((v, idx) => v === grade[idx]));
    slots.bound.replaceChildren(
      h("p", { class: "tws-note" }, "The weighted expected wrong count is w × E on score A plus the remaining weight × E on score B."),
      ...boundRows,
      h(
        "p",
        { class: "tws-note" },
        "This mean bound applies to the exact best report at the displayed τ because its family contains all-withheld. It bounds an expected average over stated pairs, not each pair or the realized share.",
      ),
      h(
        "p",
        { class: "tws-note" },
        same ? "Removing the cap leaves this report among the best reports." : "Removing the cap selects a different report; the cap can matter at this setting.",
      ),
    );
    if (state.w === 0.5 && state.tau === 0.2 && same) {
      slots.bound.append(
        h(
          "p",
          { class: "tws-note" },
          "A–C and B–C stay in one grade, so transitivity also withholds A–B. A–D is withheld too, although its weighted error is below τ. The uncapped comparison shows that the cap does not explain this equal-weight report.",
        ),
      );
    }
  };

  const renderPlots = (model, state = model.state) => {
    const { data, result } = model;
    const grade = result.grade;
    const pal = palette(ctx.root);
    const colors = gradeColors(Math.max(...grade), pal);
    const rows = data.ids.map((id, i) => ({
      i,
      id,
      a: data.means[i][0],
      b: data.means[i][1],
      grade: grade[i],
      fill: colors[grade[i] - 1],
    }));
    const height = 318;
    const marginTop = 46;
    const marginBottom = 14;
    const yLo = -0.95;
    const yHi = 1.35;
    const innerH = height - marginTop - marginBottom;
    const toPx = (v) => marginTop + ((yHi - v) / (yHi - yLo)) * innerH;
    const fromPx = (py) => yHi - ((py - marginTop) / innerH) * (yHi - yLo);
    const placedLeft = placeDirectLabels(rows.map((d) => ({ id: d.id, y: toPx(d.a) })), { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 });
    const placedRight = placeDirectLabels(rows.map((d) => ({ id: d.id, y: toPx(d.b) })), { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 });
    const leftById = new Map(placedLeft.map((p) => [p.id, p]));
    const rightById = new Map(placedRight.map((p) => [p.id, p]));
    const ends = rows.flatMap((d) => [
      { ...d, x: 0, y: d.a },
      { ...d, x: 1, y: d.b },
    ]);
    const leftTags = rows.map((d) => ({ ...d, x: 0, y: fromPx(leftById.get(d.id).y) }));
    const rightTags = rows.map((d) => ({ ...d, x: 1, y: fromPx(rightById.get(d.id).y) }));
    const heads = [
      { x: 0, title: "score A", weight: state.w },
      { x: 1, title: "score B", weight: 1 - state.w },
    ];

    plot(slots.slope, {
      alt: "Each site joins its posterior mean on score A to its mean on score B, colored by grade in the first best report.",
      height,
      marginTop,
      marginBottom,
      marginLeft: 56,
      marginRight: 56,
      x: { domain: [0, 1], axis: null },
      y: { domain: [yLo, yHi], axis: null },
      table: {
        caption: "Posterior means and first best report",
        rows,
        columns: [
          { label: "Site", value: "id" },
          { label: "Score A mean", value: "a", format: (v) => formatDecimal(v) },
          { label: "Score B mean", value: "b", format: (v) => formatDecimal(v) },
          { label: "Grade", value: "grade", format: (v) => formatCount(v) },
        ],
      },
      marks: (c, P) => [
        P.ruleX([0, 1], { stroke: c.plotGrid, strokeWidth: 1.5 }),
        P.link(rows, { x1: () => 0, y1: "a", x2: () => 1, y2: "b", stroke: "fill", strokeWidth: 3, strokeOpacity: 0.9 }),
        P.dot(ends, { x: "x", y: "y", r: 6.5, fill: "fill", stroke: c.plotBg }),
        P.text(leftTags, { x: "x", y: "y", text: "id", dx: -11, textAnchor: "end", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
        P.text(rightTags, { x: "x", y: "y", text: "id", dx: 11, textAnchor: "start", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
        P.text(heads, { x: "x", y: () => yHi, text: "title", dy: -28, fontWeight: 700, fontSize: 14, fill: (d) => c.critInk[d.x] }),
        P.text(heads, { x: "x", y: () => yHi, text: () => "weight", dx: -3, dy: -11, textAnchor: "end", fontSize: 13, fill: c.plotMuted }),
        numText(heads, { x: "x", y: () => yHi, value: "weight", format: (v) => formatSetting(v), dx: 3, dy: -11, textAnchor: "start", fontSize: 13, fill: c.plotMuted }),
      ],
      keyboard: {
        data: rows,
        x: () => 0,
        y: "a",
        title: (d) =>
          `Site ${d.id}: posterior mean ${formatDecimal(d.a)} on score A and ${formatDecimal(d.b)} on score B; grade ${formatCount(d.grade)} of the best report.`,
      },
    });

    slots.relation.replaceChildren();
    const cells = [];
    for (let i = 0; i < data.n; i += 1) {
      for (let j = 0; j < data.n; j += 1) {
        cells.push({
          i,
          j,
          row: data.ids[i],
          column: data.ids[j],
          relation: model.matrix[i][j],
          text: i === j ? "—" : model.matrix[i][j] === 1 ? "above" : model.matrix[i][j] === -1 ? "below" : "withheld",
        });
      }
    }
    const cellFill = (d, c) => (d.i === d.j ? c.plotBg : d.relation === 1 ? c.relAbove : d.relation === -1 ? c.relBelow : c.relWithheld);
    plot(slots.relation, {
      alt: "Row site is above, below, or in the same grade as the column site. Diagonal is not a comparison.",
      height: 295,
      marginLeft: 40,
      marginBottom: 40,
      x: { domain: data.ids, label: "Column site", labelAnchor: "center" },
      y: { domain: data.ids, label: "Row site", labelAnchor: "center" },
      color: { type: "identity" },
      table: {
        caption: "First best report pair relations",
        rows: cells,
        columns: [
          { label: "Row", value: "row" },
          { label: "Column", value: "column" },
          { label: "Relation", value: "text" },
        ],
      },
      marks: (c, P) => [
        P.cell(cells, { x: "column", y: "row", fill: (d) => cellFill(d, c), inset: 1 }),
        P.text(cells, {
          x: "column",
          y: "row",
          text: (d) => (d.i === d.j ? "—" : d.relation === 1 ? "↑" : d.relation === -1 ? "↓" : "·"),
          fill: (d) => (d.i === d.j ? c.plotFg : labelOn(cellFill(d, c), c)),
          fontWeight: 700,
        }),
      ],
      keyboard: { data: cells, columns: data.n, x: "column", y: "row", title: (d) => `${d.row} against ${d.column}: ${d.text}` },
    });
    const legend = h("p", { class: "tws-legend prx-light-panel", "data-prx-part": "legend" });
    [
      ["relAbove", "Row above column"],
      ["relWithheld", "Withheld"],
      ["relBelow", "Row below column"],
    ].forEach(([k, text]) => legend.append(h("span", {}, h("i", { class: "prx-swatch", style: { background: pal[k] } }), text)));
    slots.relation.append(legend);

    slots.pairs.replaceChildren();
    const directions = model.pairs.flatMap((d) => [
      { ...d, direction: `${data.ids[d.i]} above ${data.ids[d.j]}`, error: d.forward, side: "forward" },
      { ...d, direction: `${data.ids[d.j]} above ${data.ids[d.i]}`, error: d.reverse, side: "reverse" },
    ]);
    plot(slots.pairs, {
      alt: "Both directional weighted errors for each pair. The dashed vertical line is the withholding cost. Rings mark cheaper isolated directions withheld in the first report.",
      height: 430,
      marginLeft: 54,
      marginRight: 20,
      marginBottom: 42,
      x: { domain: [0, 1], inset: 8, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: "Weighted directional error", labelAnchor: "center", labelArrow: "none" },
      y: { domain: model.pairs.map((d) => d.label), label: null },
      table: {
        caption: "Both weighted pair errors",
        rows: directions,
        columns: [
          { label: "Direction", value: "direction" },
          { label: "Weighted error", value: "error", format: (v) => formatProb(v) },
          { label: "Withheld although cheaper", value: (d) => (d.outlined && d.error < state.tau ? "yes" : "no") },
        ],
      },
      marks: (c, P) => [
        P.ruleX([state.tau], { stroke: c.wh, strokeDasharray: "5,3" }),
        P.link(model.pairs, { x1: "forward", x2: "reverse", y1: "label", y2: "label", stroke: c.plotGrid }),
        P.dot(directions, {
          x: "error",
          y: "label",
          fill: (d) => (d.side === "forward" ? c.purples[6] : c.plotBg),
          stroke: c.purples[6],
          strokeWidth: 1.8,
          r: 4.5,
        }),
        P.dot(
          directions.filter((d) => d.outlined && d.error < state.tau),
          { x: "error", y: "label", fill: "none", stroke: c.err, r: 8, strokeWidth: 2 },
        ),
      ],
      keyboard: {
        data: directions,
        x: "error",
        y: "label",
        title: (d) =>
          `${d.direction}: weighted error ${formatProb(d.error)}; cost of withholding ${formatSetting(state.tau)}; ${d.relation === 0 ? "withheld" : "stated"}${d.outlined && d.error < state.tau ? ", cheaper isolated direction outlined" : ""}`,
      },
    });
    slots.pairs.append(
      h(
        "p",
        { class: "tws-note" },
        "Filled purple: earlier letter above later letter. Open purple: reverse direction. Rings mark withheld directions cheaper than τ; the isolated-pair rule need not form a coherent report.",
      ),
    );
  };

  return { renderDom, renderPlots };
}

function createV2WeightStepView(ctx, slots) {
  const { h } = ctx;
  const shareChart = h("div");
  const shareLegend = h("div");
  slots.shares.append(shareChart, shareLegend);
  let previousPath = null;
  let previousLayout = null;
  let shareHandle = null;
  let countHandle = null;

  const moveWeight = (chart, w) => {
    const line = chart?.svg?.querySelector('g[aria-label="rule"] line');
    const x = chart?.scale("x")?.apply(w);
    if (line && Number.isFinite(x)) {
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
    }
  };

  return {
    render(model, state = model.state) {
      const layout = [
        ctx.width(),
        shareChart.clientWidth,
        slots.counts.clientWidth,
        ctx.doc.documentElement.getAttribute("data-theme"),
        ctx.root.getAttribute("data-prx-font-scale"),
      ].join("|");
      if (model.path !== previousPath || layout !== previousLayout) {
        const { intervals, endpointTies } = model;
        const shown = displayPath(model);
        const steps = intervals.flatMap((r) => [
          { ...r, w: r.wFrom },
          { ...r, w: r.wTo },
        ]);
        const shares = steps.flatMap((r) => [
          { ...r, k: 0, share: r.EoverN[0] },
          { ...r, k: 1, share: r.EoverN[1] },
        ]);
        const x = {
          domain: [0, 1],
          label: "Weight on score A",
          labelAnchor: "center",
          labelArrow: "none",
          ...(ctx.width() < 640 ? { ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] } : {}),
        };

        shareHandle = plot(shareChart, {
          alt: "Each criterion expected wrong share is constant inside an exact weight interval; boundary dots retain intervals of zero or tiny width.",
          height: 225,
          marginTop: 28,
          marginLeft: 52,
          marginRight: 20,
          marginBottom: 40,
          x,
          y: { domain: [0, 1], grid: true, label: "Expected wrong share among stated pairs", labelArrow: "none" },
          table: {
            caption: "Exact weight intervals and expected wrong shares",
            rows: intervals,
            columns: [
              { label: "From weight", value: "wFrom", format: (v) => weightText(v) },
              { label: "To weight", value: "wTo", format: (v) => weightText(v) },
              { label: "Grade vector", value: "grade", format: (v) => formatGrades(v) },
              { label: "Score A share", value: (d) => d.EoverN[0], format: (v) => formatShare(v) },
              { label: "Score B share", value: (d) => d.EoverN[1], format: (v) => formatShare(v) },
            ],
          },
          marks: (c, P) => [
            P.ruleX([state.w], { stroke: c.plotFg, strokeDasharray: "3,3" }),
            ...intervals.flatMap((r) =>
              [0, 1].map((k) =>
                P.line(
                  [
                    { w: r.wFrom, share: r.EoverN[k] },
                    { w: r.wTo, share: r.EoverN[k] },
                  ],
                  { x: "w", y: "share", stroke: c.crit[k], strokeWidth: 2.5 },
                ),
              ),
            ),
            P.dot(
              shares.filter((d) => d.share !== null),
              { x: "w", y: "share", fill: (d) => c.crit[d.k], r: 3 },
            ),
          ],
          keyboard: {
            data: shares.filter((d) => d.share !== null),
            x: "w",
            y: "share",
            title: (d) =>
              `Score ${d.k ? "B" : "A"}, weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: expected wrong share ${formatShare(d.share)}, report ${formatGrades(d.grade)}`,
          },
        });
        const pal = palette(ctx.root);
        shareLegend.replaceChildren(
          h(
            "p",
            { class: "wpath-legend prx-light-panel", "data-prx-part": "legend" },
            ...["score A", "score B"].map((label, k) => h("span", {}, h("i", { class: "wpath-keyline", style: { "border-color": pal.crit[k] } }), label)),
          ),
        );

        countHandle = plot(slots.counts, {
          alt: "The number of stated pairs and grades changes only at exact weight boundaries.",
          height: 215,
          marginTop: 28,
          marginLeft: 52,
          marginRight: 20,
          marginBottom: 40,
          x,
          y: { domain: [0, model.data.M], grid: true, label: "Pairs stated", labelArrow: "none" },
          table: {
            caption: "Exact weight intervals and disclosure counts",
            rows: intervals,
            columns: [
              { label: "From weight", value: "wFrom", format: (v) => weightText(v) },
              { label: "To weight", value: "wTo", format: (v) => weightText(v) },
              { label: "Pairs stated", value: "N", format: (v) => formatCount(v) },
              { label: "Grades used", value: "G", format: (v) => formatCount(v) },
            ],
          },
          marks: (c, P) => [
            P.ruleX([state.w], { stroke: c.plotFg, strokeDasharray: "3,3" }),
            ...intervals.map((r) =>
              P.line(
                [
                  { w: r.wFrom, N: r.N },
                  { w: r.wTo, N: r.N },
                ],
                { x: "w", y: "N", stroke: c.plotFg, strokeWidth: 2.5 },
              ),
            ),
            P.dot(steps, { x: "w", y: "N", fill: c.plotFg, r: 3.2 }),
          ],
          keyboard: {
            data: steps,
            x: "w",
            y: "N",
            title: (d) =>
              `Weight interval ${weightText(d.wFrom)} to ${weightText(d.wTo)}: ${formatCount(d.N)} pairs stated, ${formatCount(d.G)} grades; report ${formatGrades(d.grade)}`,
          },
        });

        const header = ["From w", "To w", "Report", "N", "Grades", "A: E/N", "B: E/N", "Risk at left", "Risk at right"];
        const rawCaption = "Every exact interval, including tiny and zero-length endpoint entries";
        const intervalTable = (rows, caption, tagged) =>
          h(
            "table",
            { class: "wpath-table" },
            h("caption", {}, caption),
            h("thead", {}, h("tr", {}, ...header.map((text) => h("th", { scope: "col", text })))),
            h(
              "tbody",
              {},
              ...rows.map((r) =>
                h(
                  "tr",
                  {},
                  ...[
                    [r.wFrom, weightText, `from-${r.index}`],
                    [r.wTo, weightText, `to-${r.index}`],
                    [r.grade, formatGrades, `path-grade-${r.index}`],
                    [r.N, formatCount, `path-N-${r.index}`],
                    [r.G, formatCount, `path-G-${r.index}`],
                    ...r.EoverN.map((v, k) => [v, formatShare, `path-share-${r.index}-${k}`]),
                    [r.riskFrom, formatRisk, `path-riskFrom-${r.index}`],
                    [r.riskTo, formatRisk, `path-riskTo-${r.index}`],
                  ].map(([v, f, hook]) => h("td", {}, numNode(ctx, v, f, tagged ? hook : undefined))),
                ),
              ),
            ),
          );
        const rawNote = h(
          "p",
          { class: "wpath-note" },
          "Swipe or use the keyboard to scroll the interval and boundary tables. Tiny positive weights use scientific notation; every interval is retained. At a boundary, adjacent reports can both minimize risk.",
        );
        const intervalRegion = (table) => ctx.scrollRegion(h("div", { class: "wpath-scroll" }, table), "All exact weight intervals");
        const rawOpen = slots.table.querySelector("details")?.open ?? false;
        slots.table.replaceChildren(
          ...(shown.rawIntervals
            ? [
                h("p", { class: "wpath-note" }, "The first row records a tie at weight zero."),
                intervalRegion(intervalTable(shown.intervals, "Displayed intervals with the endpoint tie at zero width", true)),
              ]
            : [rawNote, intervalRegion(intervalTable(intervals, rawCaption, true))]),
        );
        const tieRows = endpointTies.flatMap((row, boundary) =>
          row.profiles.map((p, index) => ({ boundary, index, w: row.w, tieCount: row.result.tieCount, tieTol: row.result.tieTol, ...p })),
        );
        const tieTable = h(
          "table",
          { class: "wpath-table" },
          h("caption", {}, "Exact optimization at every boundary: all retained tied reports"),
          h("thead", {}, h("tr", {}, ...["Boundary w", "Number best", "Report", "N", "A: E/N", "B: E/N", "Weighted risk"].map((text) => h("th", { scope: "col", text })))),
          h(
            "tbody",
            {},
            ...tieRows.map((r) =>
              h(
                "tr",
                {},
                h("td", {}, numNode(ctx, r.w, weightText)),
                h("td", {}, numNode(ctx, r.tieCount)),
                h("td", {}, numNode(ctx, r.grade, formatGrades, `boundary-grade-${r.boundary}-${r.index}`)),
                h("td", {}, numNode(ctx, r.evaluation.N, formatCount, `boundary-N-${r.boundary}-${r.index}`)),
                h("td", {}, numNode(ctx, r.evaluation.EoverN[0], formatShare, `boundary-share-${r.boundary}-${r.index}-0`)),
                h("td", {}, numNode(ctx, r.evaluation.EoverN[1], formatShare, `boundary-share-${r.boundary}-${r.index}-1`)),
                h("td", {}, numNode(ctx, r.evaluation.risk, formatRisk, `boundary-risk-${r.boundary}-${r.index}`)),
              ),
            ),
          ),
        );
        const ties = [
          ctx.scrollRegion(h("div", { class: "wpath-scroll" }, tieTable), "All exact boundary reports"),
          h("p", { class: "wpath-note" }, "Boundary optima use equal-risk tolerance ", numNode(ctx, model.path.tieTol, formatSci), ". Full tie counts are shown alongside every retained report."),
        ];
        if (shown.rawIntervals) {
          const raw = h("details", {}, h("summary", {}, "Raw engine intervals and boundary solves"), rawNote, intervalRegion(intervalTable(intervals, rawCaption, false)), ...ties);
          raw.open = rawOpen;
          slots.table.append(raw);
        } else {
          slots.table.append(...ties);
        }
        previousPath = model.path;
        previousLayout = layout;
      } else {
        moveWeight(shareHandle, state.w);
        moveWeight(countHandle, state.w);
      }

      const peak = model.path.envelopeMaximum;
      const shown = displayPath(model);
      const zero = model.endpointTies[0];
      slots.summary.replaceChildren(
        h(
          "p",
          {},
          "Current weight on score A: ",
          numNode(ctx, state.w, weightText, "current-weight"),
          ". Exact report changes at ",
          numNode(ctx, shown.breakpoints.length),
          " interior boundaries.",
          ...(zero.result.tieCount > 1 ? [" At w = ", numNode(ctx, zero.w, formatSetting), ", ", numNode(ctx, zero.result.tieCount), " reports tie."] : []),
        ),
        h(
          "p",
          {},
          "The lower envelope reaches its largest risk ",
          numNode(ctx, peak.risk, formatRisk, "envelope-peak-risk"),
          " at weight ",
          ...peak.intervals.flatMap((r, i) => [i ? "; " : "", numNode(ctx, r.from, weightText, `peak-from-${i}`), r.from === r.to ? "" : [" to ", numNode(ctx, r.to, weightText)]]),
          ".",
        ),
        h(
          "p",
          { class: "wpath-note" },
          "Risks at different weights use different losses. This envelope peak is not the worst risk of a fixed report and need not equal the deterministic minimax risk.",
        ),
      );
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "weight-path",
    className: "wpath tws wpath-first wpath-v2",
    frame: "v2",
    css: WEIGHT_PATH_V2_CSS,
    keys: TWO_SCORES_KEYS,
    build(ctx) {
      const { h } = ctx;
      const wSlider = ctx.slider({
        label: "Weight w on score A (score B gets 1 − w)",
        ...ctx.key("w"),
        onInput: (w) => ctx.set({ w }),
      });
      const capSeg = ctx.segmented({
        label: "Allowed grades",
        name: "cap",
        options: [
          { value: "2", label: "At most two" },
          { value: "3", label: "At most three" },
          { value: "all", label: "No cap" },
        ],
        value: ctx.state.cap,
        onChange: (cap) => ctx.set({ cap }),
      });
      ctx.primaryControl(wSlider.root);
      ctx.controls.append(wSlider.root, capSeg.root);

      const tauSlider = ctx.slider({
        label: "Cost τ per withheld pair",
        ...ctx.key("tau"),
        onInput: (tau) => ctx.set({ tau }),
      });
      ctx.settingsBox("Settings").body.append(tauSlider.root);

      // Primary stage: enlarged aligned interval strip + step chart, followed by non-live status line
      const overview = h("section", { class: "wpath-overview", "aria-label": "Exact report intervals and expected wrong shares" });
      const progress = h("p", { class: "wpath-status", "aria-hidden": "true" });
      ctx.stage.append(overview, progress);

      const slots = {};
      const panel = (key, title, wide = false) => {
        slots[key] = h("div");
        return h("section", { class: `wpath-paper prx-light-panel ${wide ? "wpath-wide" : ""}`.trim(), "aria-label": title }, ctx.panelTitle(title), slots[key]);
      };

      const riskBox = ctx.disclosure({ name: "risk", title: "Risk lines and the lower envelope" });
      riskBox.body.append(panel("risk", "Every report’s risk line and the exact lower envelope", true), panel("summary", "The exact path", true));

      const dataBox = ctx.disclosure({ name: "data", title: "Exact interval and boundary tables" });
      dataBox.body.append(
        panel("shares", "Error shares on each criterion", true),
        panel("counts", "How many pairs the report states", true),
        panel("table", "Reports on the exact intervals and boundaries", true),
      );

      const reportBox = ctx.disclosure({ name: "report", title: "This report in detail" });

      const drawOverview = createOverviewRenderer(ctx, overview);
      const steps = createV2WeightStepView(ctx, slots);
      const risk = createFastWeightedRiskView(ctx, slots.risk);
      const linked = createReportDetailRenderer(ctx, reportBox.body);

      let readyPath = null;
      let readyCap = null;
      let reportPlotsDirty = false;
      ctx.onCleanup(() => {
        progress.textContent = "";
      });

      const makeHighlights = (model) =>
        model.base.profiles.map((p, i) => ({
          grade: p.grade,
          label: i ? "Another weighted best" : "Weighted best at current weight",
          dash: i ? "5,3" : undefined,
        }));

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            const model = fastSolveWeightPath(state);
            if (model.path !== readyPath) return;
            if (info?.disclosure === "risk" && riskBox.open) {
              risk.render(model.riskModel, state, makeHighlights(model), { force: true });
            } else if (info?.disclosure === "data" && dataBox.open) {
              steps.render(model, state);
            } else if (info?.disclosure === "report" && reportBox.open) {
              linked.renderPlots(model.base, state);
              reportPlotsDirty = false;
            }
            return;
          }

          wSlider.set(state.w);
          capSeg.set(state.cap);
          tauSlider.set(state.tau);

          const model = fastSolveWeightPath(state);
          const highlights = makeHighlights(model);

          // Fast synchronous path when path is already attached or family is capped (<= 603 reports)
          if (model.path === readyPath || (state.cap !== "all" && readyCap !== "all")) {
            progress.textContent = "";
            // Cancel any pending uncapped stage run by scheduling a 0-stage clear
            ctx.scheduleStages([]);
            drawOverview(model, state);
            steps.render(model, state);
            risk.render(model.riskModel, state, highlights);
            linked.renderDom(model.base, state);
            if (info?.initial || model.path !== readyPath || reportBox.open || info?.reason === "resize" || info?.reason === "theme") {
              linked.renderPlots(model.base, state);
              reportPlotsDirty = false;
            } else {
              reportPlotsDirty = true;
            }
            readyPath = model.path;
            readyCap = state.cap;
            return;
          }

          // Uncapped 4,683-report family: stage endpoint rows with yieldMs: 0 so UI stays responsive & stageProbe passes
          progress.textContent = "Updating reports…";
          const { initFirstBatch, moreBatches } = risk.stagedAttach(model.riskModel, 256);
          const stages = [
            () => {
              drawOverview(model, state);
              initFirstBatch();
            },
            ...moreBatches,
            () => steps.render(model, state),
            () => risk.render(model.riskModel, state, highlights, { force: true }),
            () => {
              linked.renderDom(model.base, state);
              linked.renderPlots(model.base, state);
              reportPlotsDirty = false;
              readyPath = model.path;
              readyCap = state.cap;
              progress.textContent = "";
            },
          ];
          ctx.scheduleStages(stages, { yieldMs: 0 });
        },
      };
    },
  });
}
