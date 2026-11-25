export * from "../shared/domain/error-budgets.js";

import { createWidget } from "../shared/base.js";
import {
  canvasLayer,
  gradeColors,
  hiddenTable,
  labelOn,
  numText,
  palette,
  placeDirectLabels,
  plot,
} from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatExpectedCount,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { familyNameNode, plural, tagNode, tieNode } from "../shared/labels.js";
import { ro } from "../shared/readout.js";
import { evaluateReport } from "../pr-core.js";
import {
  BUDGET_CSS,
  CONFIG,
  budgetModel,
  createBudgetFeasibilityView,
  createBudgetProfileView,
  parseBudgetQ,
} from "../shared/domain/error-budgets.js";

const ERROR_BUDGETS_V2_CSS = `
.ebu-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 1rem;
  flex: 1 1 100%;
  min-width: 0;
}
.ebu-v2 .ebu-primary-budget {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem 0.85rem;
  width: min(100%, 35rem);
  min-width: 0;
}
.ebu-v2 .ebu-primary-budget .prx-slider {
  max-width: 24rem;
}
.ebu-v2 .ebu-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 1.15rem;
  width: 100%;
  min-width: 0;
}
.ebu-v2 .ebu-stage-cloud {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.ebu-v2 .prx-stage .ebu-stage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.85rem;
  margin-top: 0.3rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.ebu-v2 .prx-stage .ebu-legend {
  margin: 0;
  padding: 0;
  gap: 0.2rem 0.8rem;
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.ebu-v2 .prx-stage .ebu-chips {
  margin: 0;
  padding: 0;
  background: var(--prx-plot-bg);
}
.ebu-v2 .ebu-data-section + .ebu-data-section {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--prx-border);
}
@media (min-width: 48.01em) and (pointer: fine) {
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.35rem 0.65rem;
    margin-bottom: 0.4rem;
  }
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-presets {
    flex: 1 1 36rem;
  }
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.28rem;
  }
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    min-height: 1.9rem;
    padding: 0.14rem 0.48rem;
    font-size: 0.8125rem;
  }
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.9rem;
    padding: 0.14rem 0;
  }
}
@media (max-width: 48em) {
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.28rem;
  }
  .ebu-v2.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.2rem 0.46rem;
    font-size: 0.8125rem;
  }
}
@media (max-width: 34em) {
  .ebu-v2 .ebu-primary-budget {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }
}
`;

function num(ctx, value, format, key) {
  const n = ctx.num(value, format(value));
  if (key) n.setAttribute("data-prx-readout", key);
  return n;
}

function formatted(columns) {
  return columns.map((c) => ({ ...c, ...(c.format ? { format: (value) => c.format(value) } : {}) }));
}

function table(ctx, caption, columns, rows) {
  const n = hiddenTable(ctx.doc, { caption, columns: formatted(columns), rows, visible: true });
  n.classList.add("ebu-table-wrap");
  ctx.scrollRegion(n, caption);
  return n;
}

function chips(ctx, grade, ids) {
  const pal = palette(ctx.root);
  const colors = gradeColors(Math.max(...grade), pal);
  const nodes = [];
  colors.forEach((color, k) => {
    if (k) nodes.push(ctx.h("span", { "aria-hidden": "true" }, ">"));
    nodes.push(
      ctx.h(
        "span",
        { class: "ebu-chip", style: { background: color, color: labelOn(color, pal) } },
        ids.filter((_, i) => grade[i] === k + 1).join(" "),
      ),
    );
  });
  return ctx.h(
    "div",
    {
      class: "ebu-chips prx-light-panel",
      role: "img",
      "aria-label": `Best report: ${blocksText(grade, ids)}; grade one is highest priority`,
    },
    ...nodes,
  );
}

function localTextPos(tNode, values, idx, dims) {
  const tr = tNode.getAttribute("transform") || "";
  const m = /translate\(\s*([-\d.eE+]+)(?:[,\s]+([-\d.eE+]+))?\s*\)/.exec(tr);
  const x = m
    ? Number(m[1])
    : tNode.hasAttribute("x")
      ? Number(tNode.getAttribute("x"))
      : values.x
        ? values.x[idx]
        : dims.width / 2;
  const rawY = tNode.getAttribute("y") || "";
  const y = m
    ? Number(m[2] ?? 0)
    : rawY && !rawY.endsWith("em")
      ? Number(rawY)
      : values.y
        ? values.y[idx]
        : dims.marginTop;
  return { x, y };
}

function pillCalloutGroup(items, { x, y, value, format, dx, anchor, getStyle }) {
  if (!items.length) return null;
  return numText(items, {
    x,
    y,
    value,
    format,
    dx,
    textAnchor: anchor,
    fontWeight: (d) => (d.isBest ? 700 : 600),
    fontSize: 13,
    fill: (d) => getStyle(d).fg,
    render(index, scales, values, dims, context, next) {
      const g = next(index, scales, values, dims, context);
      const doc = context.document;
      const texts = [...(g?.querySelectorAll("text") ?? [])];
      Array.from(index).forEach((idx, j) => {
        const tNode = texts[j];
        const d = items[idx];
        if (!tNode || !d) return;
        const st = getStyle(d);
        const pos = localTextPos(tNode, values, idx, dims);
        const str = tNode.textContent || "";
        const pw = Math.ceil(str.length * 7.8 + 10);
        const ph = 18;
        const rx = anchor === "end" ? pos.x - pw + 4 : pos.x - 4;
        const ry = pos.y - ph / 2;
        if (Math.abs(d.dyPx) > 3 && Number.isFinite(d.rawPy)) {
          const dotLocalX = pos.x - dx;
          const line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(dotLocalX + (anchor === "end" ? -6 : 6)));
          line.setAttribute("y1", String(d.rawPy));
          line.setAttribute("x2", String(anchor === "end" ? rx + pw : rx));
          line.setAttribute("y2", String(pos.y));
          line.setAttribute("stroke", st.stroke);
          line.setAttribute("stroke-width", "1");
          tNode.before(line);
        }
        const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(rx));
        rect.setAttribute("y", String(ry));
        rect.setAttribute("width", String(pw));
        rect.setAttribute("height", String(ph));
        rect.setAttribute("rx", "3");
        rect.setAttribute("ry", "3");
        rect.setAttribute("fill", st.bg);
        rect.setAttribute("fill-opacity", "0.94");
        rect.setAttribute("stroke", st.stroke);
        rect.setAttribute("stroke-width", d.isBest ? "1.25" : "1");
        if (!d.isBest) rect.setAttribute("stroke-dasharray", "3 2");
        tNode.before(rect);
      });
      return g;
    },
  });
}

function renderStageCloud(ctx, figureSlot, model) {
  const { rows, q, data, freeRow, bestRow } = model;
  const dots = rows.filter((row) => row.N > 0);
  const C = CONFIG.cloud;
  const measured = Math.round(
    figureSlot.getBoundingClientRect?.().width || figureSlot.clientWidth || ctx.stage.clientWidth || 0,
  );
  const width = Math.max(240, measured > 0 ? measured : ctx.width());
  const height = width < 520 ? 270 : 406;
  const marginTop = 26;
  const marginBottom = 44;
  const marginLeft = 50;
  const marginRight = width < 520 ? 16 : 24;
  const inset = 12;
  const ih = Math.max(1, height - marginTop - marginBottom - 2 * inset);
  const yBot = height - marginBottom - inset;
  const toPy = (v) => yBot - Math.sqrt(Math.max(0, Math.min(1, v))) * ih;
  const fromPy = (py) => {
    const u = Math.max(0, Math.min(1, (yBot - py) / ih));
    return u * u;
  };

  const rawCallouts = [];
  if (bestRow?.N > 0) {
    const rawPy = toPy(bestRow.eb);
    rawCallouts.push({
      id: "best",
      ea: bestRow.ea,
      eb: bestRow.eb,
      rawPy,
      y: rawPy - 12,
      risk: model.result.optimum.risk,
      isBest: true,
    });
  }
  if (freeRow?.N > 0 && freeRow.key !== bestRow?.key) {
    const rawPy = toPy(freeRow.eb);
    rawCallouts.push({
      id: "free",
      ea: freeRow.ea,
      eb: freeRow.eb,
      rawPy,
      y: rawPy + (bestRow && freeRow.eb >= bestRow.eb ? -14 : 14),
      risk: model.free.risk,
      isBest: false,
    });
  }
  const placed = placeDirectLabels(rawCallouts, {
    minGapPx: 22,
    minY: marginTop + 12,
    maxY: height - marginBottom - 12,
  });
  const placedById = new Map(placed.map((p) => [p.id, p]));
  const callouts = rawCallouts.map((item) => {
    const p = placedById.get(item.id) ?? item;
    const anchor = item.ea > 0.36 ? "end" : "start";
    return {
      ...item,
      yData: fromPy(p.y),
      dyPx: p.y - item.rawPy,
      anchor,
    };
  });

  const title = (row) =>
    `${blocksText(row.grade, data.ids)}: ${formatCount(row.N)} pairs stated; wrong share ${formatShare(row.ea)} on score A and ${formatShare(row.eb)} on score B; ${row.meets ? "meets every budget" : "fails a budget"}; risk ${formatRisk(evaluateReport(row.grade, data.E, { tau: model.state.tau, w: model.w }).risk)}.`;

  const useCanvas = dots.length > 800;
  const radiusOf = (N) => 1.5 + 3.5 * Math.sqrt(Math.max(0, N) / Math.max(1, data.M));

  const chart = plot(figureSlot, {
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    alt: "Every report with stated pairs, at its expected wrong share on each score. Both axes use square-root scales. Dot size is the number of stated pairs; the budget region, best-member ring and free-best cross follow the controls.",
    x: {
      type: "sqrt",
      domain: C.domain,
      ticks: C.ticks,
      inset,
      label: "Wrong on score A (sqrt scale) →",
      labelOffset: 37,
      grid: true,
    },
    y: {
      type: "sqrt",
      domain: C.domain,
      ticks: C.ticks,
      inset,
      label: "↑ Wrong on score B (sqrt scale)",
      grid: true,
    },
    r: { domain: [0, data.M], range: [1.6, 5.2] },
    marks: (c, P) =>
      [
        P.rect([{ x1: 0, y1: 0, x2: q[0] ?? 1, y2: q[1] ?? 1 }], {
          x1: "x1",
          y1: "y1",
          x2: "x2",
          y2: "y2",
          fill: c.accent,
          fillOpacity: 0.08,
        }),
        q[0] === null ? null : P.ruleX([q[0]], { stroke: c.critInk[0], strokeWidth: 1.75, strokeDasharray: "5 3" }),
        q[1] === null ? null : P.ruleY([q[1]], { stroke: c.critInk[1], strokeWidth: 1.75, strokeDasharray: "5 3" }),
        useCanvas
          ? null
          : P.dot(
              dots.filter((row) => !row.meets),
              {
                x: "ea",
                y: "eb",
                r: "N",
                fill: "none",
                stroke: c.plotMuted,
                strokeOpacity: 0.52,
                strokeWidth: 0.8,
                title,
              },
            ),
        useCanvas
          ? null
          : P.dot(
              dots.filter((row) => row.meets),
              {
                x: "ea",
                y: "eb",
                r: "N",
                fill: c.plotFocus,
                stroke: c.plotBg,
                strokeWidth: 0.7,
                title,
              },
            ),
        freeRow?.N > 0
          ? P.dot([freeRow], { x: "ea", y: "eb", r: 8.5, symbol: "times", stroke: c.plotFg, strokeWidth: 2.4 })
          : null,
        bestRow?.N > 0
          ? P.dot([bestRow], { x: "ea", y: "eb", r: 10, fill: "none", stroke: c.plotFg, strokeWidth: 2.5 })
          : null,
        pillCalloutGroup(
          callouts.filter((d) => d.anchor === "start"),
          {
            x: "ea",
            y: "yData",
            value: "risk",
            format: formatReadoutRisk,
            dx: 14,
            anchor: "start",
            getStyle: (d) => ({
              fg: d.isBest ? c.plotFg : c.plotMuted,
              bg: c.plotBg,
              stroke: d.isBest ? c.plotFg : c.plotMuted,
            }),
          },
        ),
        pillCalloutGroup(
          callouts.filter((d) => d.anchor === "end"),
          {
            x: "ea",
            y: "yData",
            value: "risk",
            format: formatReadoutRisk,
            dx: -14,
            anchor: "end",
            getStyle: (d) => ({
              fg: d.isBest ? c.plotFg : c.plotMuted,
              bg: c.plotBg,
              stroke: d.isBest ? c.plotFg : c.plotMuted,
            }),
          },
        ),
      ].filter(Boolean),
    keyboard: { data: dots, x: "ea", y: "eb", virtual: useCanvas, pointer: true, title },
    table: {
      caption: "All reports with stated pairs",
      columns: formatted([
        { label: "Grade vector", value: "grade", format: formatGrades },
        { label: "Stated pairs N", value: "N", format: formatCount },
        { label: "E/N on score A", value: "ea", num: true, format: formatShare },
        { label: "E/N on score B", value: "eb", num: true, format: formatShare },
        { label: "Budget status", value: (row) => (row.meets ? "meets every budget" : "fails a budget") },
      ]),
      rows: dots,
    },
  });

  if (useCanvas) {
    canvasLayer(chart, (g, { x, y, palette: pal }) => {
      g.lineWidth = 0.8;
      g.strokeStyle = pal.plotMuted;
      g.globalAlpha = 0.45;
      for (const row of dots) {
        if (row.meets) continue;
        const cx = x(row.ea);
        const cy = y(row.eb);
        if (cx === undefined || cy === undefined) continue;
        g.beginPath();
        g.arc(cx, cy, radiusOf(row.N), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = pal.plotFocus;
      g.strokeStyle = pal.plotBg;
      g.lineWidth = 0.7;
      for (const row of dots) {
        if (!row.meets) continue;
        const cx = x(row.ea);
        const cy = y(row.eb);
        if (cx === undefined || cy === undefined) continue;
        g.beginPath();
        g.arc(cx, cy, radiusOf(row.N), 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    });
  }

  const xAxisText = chart.svg.querySelector('g[aria-label="x-axis label"] text');
  if (xAxisText) {
    xAxisText.setAttribute("fill", chart.palette.critInk[0]);
    xAxisText.setAttribute("font-weight", "600");
  }
  const yAxisText = chart.svg.querySelector('g[aria-label="y-axis label"] text');
  if (yAxisText) {
    yAxisText.setAttribute("fill", chart.palette.critInk[1]);
    yAxisText.setAttribute("font-weight", "600");
  }
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "ebu ebu-v2",
    frame: "v2",
    css: BUDGET_CSS + ERROR_BUDGETS_V2_CSS,
    keys: {
      qa: { type: "custom", value: null, parse: parseBudgetQ },
      qb: { type: "custom", value: 0.03, parse: parseBudgetQ },
      w: { type: "number", min: 0, max: 1, step: 0.01, value: 0.5 },
      tau: { type: "number", min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
      cap: { type: "choice", values: ["2", "3", "all", "exact3"], value: "3" },
      fa: { type: "integer", min: 0, max: 400, value: 0 },
      fb: { type: "integer", min: 0, max: 400, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const r = ro(ctx);

      const budgets = ["qa", "qb"].map((name, k) => {
        const score = k ? "B" : "A";
        const enabled = ctx.toggle({
          label: `Budget on score ${score}`,
          name: `${name}-enabled`,
          onChange: (yes) => ctx.set({ [name]: yes ? 0.1 : null, fa: 0, fb: 0 }),
        });
        const slider = ctx.slider({
          label: `Max wrong share on score ${score}`,
          name,
          min: 0,
          max: 1,
          step: 0.001,
          value: 0.03,
          valueType: "number",
          format: formatSetting,
          onInput: (value) => ctx.set({ [name]: value, fa: 0, fb: 0 }),
        });
        const exact = ctx.numberInput({
          label: `Exact budget for score ${score}`,
          name: `${name}-exact`,
          min: 0,
          max: 1,
          step: "any",
          onInput: (value) => ctx.set({ [name]: value, fa: 0, fb: 0 }),
        });
        return { enabled, slider, exact };
      });

      const weight = ctx.slider({
        label: "Error weight on score A (score B gets the remainder)",
        ...ctx.key("w"),
        onInput: (w) => ctx.set({ w }),
      });
      const tau = ctx.slider({
        label: "Cost τ per withheld pair",
        ...ctx.key("tau"),
        onInput: (tau) => ctx.set({ tau }),
      });
      const cap = ctx.select({
        label: "Allowed grade reports",
        name: "cap",
        options: [
          { value: "2", label: "At most two grades" },
          { value: "3", label: "At most three grades" },
          { value: "all", label: "Any number of grades" },
          { value: "exact3", label: "Exactly three grades" },
        ],
        onChange: (cap) => ctx.set({ cap, fa: 0, fb: 0 }),
      });

      ctx.controls.append(h("div", { class: "ebu-primary-budget" }, budgets[1].enabled.root, budgets[1].slider.root));
      ctx.primaryControl(budgets[1].slider.root);

      ctx.settingsBox("Settings").body.append(
        h(
          "div",
          { class: "ebu-settings-grid" },
          h("div", { class: "ebu-budget-controls" }, budgets[0].enabled.root, budgets[0].slider.root),
          weight.root,
          tau.root,
          cap.root,
          h("div", { class: "ebu-exact-budgets" }, ...budgets.map((b) => b.exact.root)),
        ),
      );

      // Stage: primary 603-report scatter + compact 1-line key + active optimal grade chips
      const cloudSlot = h("div", { class: "ebu-stage-cloud" });
      const stageChipsSlot = h("div");
      const keyItem = (cls, text) =>
        h("span", { class: "prx-key" }, h("span", { class: `prx-swatch ${cls}`, "aria-hidden": "true" }), text);
      const legendBar = h(
        "div",
        { class: "prx-legend ebu-legend", "data-prx-part": "legend" },
        keyItem("ebu-sw-in", "Feasible"),
        keyItem("ebu-sw-out", "Infeasible"),
        keyItem("ebu-sw-best", "Best feasible"),
        keyItem("ebu-sw-free", "Best without budget"),
      );
      const boundaryWitness = h("p", { class: "ebu-note", "aria-label": "Unconstrained report and active budget" });
      ctx.stage.append(cloudSlot, boundaryWitness, h("div", { class: "ebu-stage-bar" }, stageChipsSlot, legendBar));

      // Data disclosure: family counts, feasibility table, criterion profile table, failing-report pagers
      const familySlot = h("p", { class: "ebu-facts" });
      const reportSlot = h("div");
      const slackSlot = h("div");
      const profileSlot = h("div");
      const failSlots = [h("div"), h("div")];
      const feasibility = createBudgetFeasibilityView(ctx, slackSlot);
      const profiles = createBudgetProfileView(ctx, profileSlot);

      const pagers = failSlots.map((slot, k) => {
        const content = h("div");
        const label = h("span");
        const previous = ctx.button({
          label: "Previous reports",
          onClick: () => ctx.set({ [k ? "fb" : "fa"]: Math.max(0, ctx.state[k ? "fb" : "fa"] - 1) }),
        });
        const next = ctx.button({
          label: "Next reports",
          onClick: () => ctx.set({ [k ? "fb" : "fa"]: ctx.state[k ? "fb" : "fa"] + 1 }),
        });
        slot.append(
          ctx.panelTitle(`Fails score ${k ? "B" : "A"}'s budget`),
          content,
          h("div", { class: "ebu-pager" }, previous.root, label, next.root),
        );
        return { content, label, previous, next };
      });

      const dataBox = ctx.dataBox("Data, feasibility check and report tables");
      dataBox.body.append(
        h("p", { class: "ebu-swipe" }, "Tables scroll horizontally. Focus a table and use the arrow keys, or swipe."),
        h("section", { class: "ebu-data-section" }, ctx.panelTitle("Best report that meets the budgets"), familySlot, reportSlot),
        h(
          "section",
          { class: "ebu-data-section" },
          ctx.panelTitle("Budget checks and criterion profiles"),
          h(
            "p",
            { class: "ebu-note" },
            "E is the expected number of wrong stated directions on a criterion; N is the number stated; M is the number of all pairs. Grade one has highest priority on both scores; a shared grade leaves a pair unreported.",
          ),
          slackSlot,
          profileSlot,
        ),
        h(
          "section",
          { class: "ebu-data-section" },
          ctx.panelTitle("Reports failing each budget"),
          h("p", { class: "ebu-note" }, "A report can fail both budgets. Each list is in grade-vector order."),
          h("div", { class: "ebu-failures" }, ...failSlots),
        ),
      );

      // Method disclosure: N = 0 homogeneous count-form check + posterior average vs minimax notes
      const withheldSlot = h("p", { class: "ebu-note" });
      const cloudNote = h("p", { class: "ebu-note" });
      const methodBox = ctx.methodBox("Method and homogeneous budget checks");
      methodBox.body.append(
        withheldSlot,
        cloudNote,
        h(
          "p",
          { class: "ebu-note" },
          "A budget limits the posterior expected average over stated pairs, not each pair or the realized share. It only removes reports, so the minimum risk at the same weights, τ and base family stays the same or rises. A criterion with zero error weight can still carry a budget.",
        ),
        h(
          "p",
          { class: "ebu-note" },
          "Another rule, minimax, chooses the report with the smallest largest expected criterion risk. It can keep withholding where a weighted rule discloses. That is a maximum of expectations, not an expected maximum.",
        ),
      );

      let modelKey = "";
      let stageKey = "";
      let model = null;

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;

          budgets.forEach(({ enabled, slider, exact }, k) => {
            const value = state[k ? "qb" : "qa"];
            enabled.set(value !== null);
            slider.set(value ?? 0);
            slider.setDisabled(value === null);
            if (ctx.doc.activeElement !== exact.input || Number(exact.input.value) !== value) exact.set(value);
            exact.setDisabled(value === null);
          });
          weight.set(state.w);
          tau.set(state.tau);
          cap.set(state.cap);

          const nextModelKey = JSON.stringify([state.qa, state.qb, state.w, state.tau, state.cap]);
          if (nextModelKey !== modelKey || !model) {
            model = budgetModel(state);
            modelKey = nextModelKey;
          }

          const nextStageKey = JSON.stringify([
            nextModelKey,
            Math.round(ctx.width()),
            ctx.root.dataset.theme ?? "",
            ctx.doc.documentElement.dataset.theme ?? "",
          ]);
          if (nextStageKey !== stageKey) {
            renderStageCloud(ctx, cloudSlot, model);
            stageKey = nextStageKey;
          }

          const { result, free, data } = model;
          const violation = model.failures.findIndex(rows => rows.some(row => row.key === model.freeRow?.key));
          boundaryWitness.replaceChildren("Without budgets: ", blocksText(free.grade, data.ids), ". ",
            ...(violation < 0 ? ["This report meets every active budget."] :
              ["First violated budget: ", data.criterionLabels[violation], " (wrong share ",
                num(ctx, violation ? model.freeRow.eb : model.freeRow.ea, formatShare), ", cap ",
                num(ctx, model.q[violation], formatSetting), ")."]),
            result.empty ? " No feasible report." : " Best feasible: " + blocksText(result.optimum.grade, data.ids) + ".");
          cloudNote.replaceChildren(
            "Larger dots state more pairs. Reports with N = ",
            num(ctx, 0, formatCount),
            " are omitted from this fraction cloud; their E/N reads NA: no disclosure.",
          );

          familySlot.replaceChildren(
            num(ctx, result.size, formatCount, "size"),
            result.size === 1 ? " report meets every budget, within " : " reports meet every budget, within ",
            num(ctx, result.baseSize, formatCount, "baseSize"),
            " allowed reports · ",
            familyNameNode(ctx, result),
          );

          if (result.empty) {
            stageChipsSlot.replaceChildren();
            reportSlot.replaceChildren(
              h(
                "p",
                { class: "ebu-empty", "data-prx-readout": "empty" },
                state.cap === "exact3"
                  ? "No report meets these budgets with exactly three grades."
                  : "No report meets these budgets.",
              ),
            );
            slackSlot.replaceChildren();
            profiles.render(model);
            r.set([
              r.count(result.size),
              " ",
              plural(result.size, "report"),
              " of ",
              r.count(result.baseSize),
              " meet the budgets: no report is feasible in this grade family.",
            ]);
          } else {
            const opt = result.optimum;
            stageChipsSlot.replaceChildren(chips(ctx, opt.grade, data.ids));
            reportSlot.replaceChildren(
              h(
                "p",
                { class: "ebu-facts" },
                num(ctx, opt.N, formatCount, "N"),
                " of ",
                num(ctx, data.M, formatCount),
                " pairs stated · ",
                tagNode(ctx, model.q.every((qVal) => qVal === null) ? free : opt),
              ),
            );
            if (opt.tieCount > 1) {
              reportSlot.append(
                h(
                  "p",
                  { class: "ebu-ties" },
                  num(ctx, opt.tieCount, formatCount),
                  " reports share the smallest risk; all retained profiles are shown. Equal-risk tolerance ",
                  num(ctx, opt.tieTol, (v) => formatSci(v, { trim: true })),
                  ". Retained reports: ",
                  num(ctx, opt.grades.length, formatCount),
                  opt.tieCount > opt.grades.length ? ". The retained list is truncated." : ".",
                ),
              );
            }
            feasibility.render({
              rows: model.profiles.flatMap((profile, reportIndex) =>
                profile.check.rows.map((row) => ({
                  ...row,
                  criterion: data.criterionLabels[row.k],
                  ...(model.profiles.length > 1 ? { report: profile.grade, reportIndex } : {}),
                })),
              ),
            });
            profiles.render(model);

            if (model.q.every((qVal) => qVal === null)) {
              if (opt.N === 0) {
                r.set([
                  "With no budget (",
                  r.count(result.size),
                  " ",
                  plural(result.size, "report"),
                  "), the best report withholds all ",
                  r.count(data.M),
                  " pairs at risk ",
                  r.risk(free.risk),
                  " (",
                  r.share(null),
                  ").",
                ]);
              } else {
                r.set([
                  "With no budget (",
                  r.count(result.size),
                  " ",
                  plural(result.size, "report"),
                  "), best ",
                  blocksText(opt.grade, data.ids),
                  " states ",
                  r.count(opt.N),
                  " of ",
                  r.count(data.M),
                  " pairs at risk ",
                  r.risk(free.risk),
                  ", with wrong share ",
                  r.share(free.EoverN[1]),
                  " on score B",
                  tieNode(ctx, opt),
                  ".",
                ]);
              }
            } else {
              const nearTie =
                Math.abs(opt.risk - free.risk) > 1e-12 &&
                formatReadoutRisk(opt.risk) === formatReadoutRisk(free.risk);
              const optRiskNode = nearTie ? r.distinguishing(opt.risk, free.risk) : r.risk(opt.risk);
              const freeRiskNode = nearTie
                ? r.distinguishing(free.risk, opt.risk, { hook: "freeRisk" })
                : r.risk(free.risk, { hook: "freeRisk" });
              r.set([
                r.count(result.size),
                " ",
                plural(result.size, "report"),
                " of ",
                r.count(result.baseSize),
                result.size === 1 ? " meets" : " meet",
                " the budgets: best ",
                opt.N === 0 ? "all-withheld" : blocksText(opt.grade, data.ids),
                " states ",
                r.count(opt.N),
                " of ",
                r.count(data.M),
                " pairs at risk ",
                optRiskNode,
                " (vs. ",
                freeRiskNode,
                " unconstrained)",
                tieNode(ctx, opt),
                ".",
              ]);
            }
          }

          withheldSlot.replaceChildren(
            result.containsAllWithheld
              ? "All-withheld belongs to this family and meets every count-form budget: "
              : "The exact grade count excludes all-withheld. Its count-form budget check would be ",
            num(ctx, 0, formatCount),
            " ≤ ",
            num(ctx, 0, formatCount),
            "; its expected wrong share is ",
            num(ctx, null, formatShare),
            ".",
          );

          pagers.forEach((pager, k) => {
            const failed = model.failures[k];
            const page = state[k ? "fb" : "fa"];
            const begin = page * CONFIG.pageSize;
            if (begin >= failed.length && page > 0) ctx.set({ [k ? "fb" : "fa"]: 0 });
            pager.content.replaceChildren(
              state[k ? "qb" : "qa"] === null
                ? h("p", { class: "ebu-note" }, "No budget on this score.")
                : failed.length
                  ? table(
                      ctx,
                      `Reports failing score ${k ? "B" : "A"}'s budget`,
                      [
                        { label: "Grade vector", value: "grade", format: formatGrades },
                        { label: "N", value: "N", format: formatCount },
                        { label: "E/N", value: "EoverN", num: true, format: formatShare },
                        { label: "Slack qN − E", value: "slack", format: formatExpectedCount },
                      ],
                      failed.slice(begin, begin + CONFIG.pageSize),
                    )
                  : h("p", { class: "ebu-note" }, "Every allowed report meets this budget."),
            );
            pager.label.replaceChildren(...(failed.length ? ["List page ", num(ctx, page + 1, formatCount)] : []));
            pager.previous.setDisabled(page === 0);
            pager.next.setDisabled(begin + CONFIG.pageSize >= failed.length);
          });

          ctx.caption.replaceChildren(
            "Six fictional sites with independent normal posteriors for scores A and B. τ = ",
            num(ctx, state.tau, formatSetting),
            "; error weights ",
            num(ctx, model.w, (v) => v.map((x) => formatSetting(x)).join(", ")),
            ".",
          );
        },
      };
    },
  });
}
