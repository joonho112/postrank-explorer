import { createWidget } from "../shared/base.js";
import { hiddenTable, labelOn, numText, plot } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatExpectedCount,
  formatGrades,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { familyNameNode, plural } from "../shared/labels.js";
import { ro } from "../shared/readout.js";
import { errorArray, protectionEnvelopes } from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import { bookBudgetInput } from "../shared/criteria-laws.js";
import { runRecord, envelopeFor, CONFIG as MC_CONFIG } from "../shared/domain/mc-error.js";
import { BUDGET_CSS, createBudgetFeasibilityView } from "../shared/domain/error-budgets.js";

export const CONFIG = Object.freeze({
  name: "estimated-budgets",
  kinds: ["inner", "nominal", "exact", "outer"],
  labels: { inner: "inner", nominal: "estimated", exact: "exact", outer: "outer" },
});

const keyOf = (g) => Array.from(g).join("/");
const cache = new Map();

/** Book inputs are deterministic declarations; the separate IID route uses the actual 1.17 run and bound. */
export function estimatedBudgetModel(state) {
  const key = JSON.stringify([state.mode, state.t, state.epsilon, state.exact, state.S, state.qb, state.soft]);
  if (cache.has(key)) return cache.get(key);
  let input, Ehat, Eexact, q, epsilon, w, tau, family;
  let iid = null;
  if (state.mode === "book") {
    input = bookBudgetInput(state.t);
    ({ Ehat, Eexact, q, tau } = input);
    epsilon = [state.epsilon];
    w = [1];
    family = state.exact ? { kind: "exactly", G: 2 } : { kind: "all" };
  } else {
    const data = criteriaData("six");
    const record = runRecord("AB", Number(state.S), 1);
    const bound = envelopeFor("AB", Number(state.S));
    Ehat = record.eHat;
    Eexact = errorArray(data.means, data.sds, { ids: data.ids, criteria: record.eHat.criteria });
    q = [null, state.qb];
    epsilon = bound.eps;
    w = [1, 0];
    tau = 0.25;
    family = state.exact ? { kind: "exactly", G: 2 } : { kind: "atMost", G: 2 };
    input = {
      ids: Ehat.ids,
      criteria: Ehat.criteria,
      source: "Six-site independent Normal law, actual mc-error producer and fixed-S conditional IID bound",
    };
    iid = { record, bound, alpha: MC_CONFIG.alpha };
  }
  const envelope = protectionEnvelopes(Ehat, Eexact, {
    q,
    epsilon,
    w,
    tau,
    family,
    coefficientTol: state.soft ? 1e-12 : 0,
  });
  const protectedCriterion = q.findIndex((value) => value!== null);
  const labels = envelope.rows.map((row) => blocksText(row.grade, input.ids));
  const model = { state, input, Ehat, Eexact, q, epsilon, w, tau, family, envelope, protectedCriterion, labels, iid };
  if (cache.size > 24) cache.clear();
  cache.set(key, model);
  return model;
}

export const ENVELOPE_CSS = `
.ebe.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.4rem 1rem;
  flex: 1 1 26rem;
  min-width: 0;
}
.ebe .ebe-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  gap: 0.7rem 1.1rem;
  align-items: start;
  min-width: 0;
}
.ebe .ebe-stage-cell {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.ebe .ebe-note,
.ebe .ebe-status {
  font-size: 0.88rem;
  margin: 0.4rem 0;
}
.ebe .prx-stage .ebe-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.85rem;
  margin: 0.3rem 0 0;
  padding-top: 0.3rem;
  border-top: 1px solid var(--prx-plot-grid);
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.ebe .ebe-table {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  margin: 0.55rem 0;
}
.ebe .ebe-table table {
  min-width: 36rem;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.ebe .ebe-table th,
.ebe .ebe-table td {
  white-space: nowrap;
  text-align: left;
  padding: 0.3rem 0.45rem;
  border-bottom: 1px solid var(--prx-border);
}
.ebe .prx-stage .ebe-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.75rem;
  margin: 0.3rem 0 0;
  padding: 0.3rem 0 0;
  border-top: 1px solid var(--prx-plot-grid);
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  font-size: 0.8125rem;
}
.ebe .prx-stage .ebe-key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.ebe .prx-stage .ebe-sq {
  display: inline-block;
  width: 0.62rem;
  height: 0.62rem;
  background: var(--prx-plot-bg);
  border: 1.75px solid var(--prx-plot-fg);
}
.ebe .prx-stage .ebe-dot {
  display: inline-block;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: var(--prx-post);
}
.ebe .prx-stage .ebe-rule-solid,
.ebe .prx-stage .ebe-rule-dash,
.ebe .prx-stage .ebe-rule-dot {
  display: inline-block;
  width: 0.95rem;
  height: 0;
}
.ebe .prx-stage .ebe-rule-solid {
  border-top: 2px solid var(--prx-plot-fg);
}
.ebe .prx-stage .ebe-rule-dash {
  border-top: 2px dashed var(--prx-crit-ink-1);
}
.ebe .prx-stage .ebe-rule-dot {
  border-top: 2px dotted var(--prx-crit-ink-2);
}
.ebe .ebe-select {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.ebe .ebe-select select {
  max-width: 100%;
  background: var(--prx-bg);
  color: var(--prx-fg);
  padding: 0.3rem;
  border: 1px solid var(--prx-border-strong);
  border-radius: 4px;
}
.ebe .ebe-scope {
  padding: 0.5rem;
  border-left: 3px solid var(--prx-border-strong);
  font-size: 0.86rem;
  margin: 0.45rem 0;
}
@media (min-width: 48.01em) and (pointer: fine) {
  .ebe.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.35rem 0.65rem;
    margin-bottom: 0.4rem;
  }
  .ebe.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.3rem;
  }
  .ebe.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    min-height: 1.9rem;
    padding: 0.14rem 0.5rem;
    font-size: 0.8125rem;
  }
  .ebe.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.9rem;
    padding: 0.14rem 0;
  }
}
@media (max-width: 48em) {
  .ebe .ebe-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.55rem;
  }
  .ebe.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.28rem;
  }
  .ebe.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.2rem 0.46rem;
    font-size: 0.8125rem;
  }
}
`;

function n(ctx, value, format, key) {
  const node = ctx.num(value, format(value));
  if (key) node.setAttribute("data-prx-readout", key);
  return node;
}

function columns(cols) {
  return cols.map((c) => ({ ...c, ...(c.format ? { format: (v) => c.format(v) } : {}) }));
}

function table(ctx, caption, cols, rows) {
  const t = hiddenTable(ctx.doc, { caption, columns: columns(cols), rows, visible: true });
  t.classList.add("ebe-table");
  ctx.scrollRegion(t, caption);
  rows.forEach((row, i) =>
    cols.forEach((c, j) => {
      if (c.hook) t.querySelectorAll("tbody tr")[i].cells[j].setAttribute("data-prx-readout", c.hook(row));
    }),
  );
  return t;
}

const flag = (value) => (value ? "yes" : "no");

function threshold(envelope, kind, k) {
  return kind === "inner" ? envelope.innerThreshold[k] : kind === "outer" ? envelope.outerThreshold[k] : envelope.q[k];
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
        : dims.marginLeft;
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

function withBackingPill(data, { value, format, text, P, textAnchor = "middle", dx = 0, dy = 0, getPill, ...textOpts }) {
  if (!data.length) return null;
  const render = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    const doc = context.document;
    const texts = [...(g?.querySelectorAll("text") ?? [])];
    Array.from(index).forEach((idx, j) => {
      const tNode = texts[j];
      const d = data[idx];
      if (!tNode) return;
      const cfg = getPill(d, idx);
      const anchor = typeof textAnchor === "function" ? textAnchor(d, idx) : textAnchor;
      const pos = localTextPos(tNode, values, idx, dims);
      const rawY = tNode.getAttribute("y") || "";
      if (rawY.endsWith("em")) {
        tNode.setAttribute("y", "0");
        tNode.setAttribute("dominant-baseline", "central");
      }
      tNode.setAttribute("text-anchor", anchor);
      tNode.style.textAnchor = anchor;
      const str = tNode.textContent || "";
      const pw = Math.ceil(str.length * 7.4 + 8);
      const ph = 17;
      const rx = anchor === "end" ? pos.x - pw + 3 : anchor === "start" ? pos.x - 3 : pos.x - pw / 2;
      const ry = pos.y - ph / 2;
      const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(rx));
      rect.setAttribute("y", String(ry));
      rect.setAttribute("width", String(pw));
      rect.setAttribute("height", String(ph));
      rect.setAttribute("rx", "3");
      rect.setAttribute("ry", "3");
      rect.setAttribute("fill", cfg.bg);
      rect.setAttribute("fill-opacity", String(cfg.fillOpacity ?? "0.94"));
      rect.setAttribute("data-pill-anchor", anchor);
      rect.setAttribute("data-pill-px", String(pos.x));
      if (cfg.stroke) {
        rect.setAttribute("stroke", cfg.stroke);
        rect.setAttribute("stroke-width", cfg.strokeWidth ?? "1");
        if (cfg.dash) rect.setAttribute("stroke-dasharray", cfg.dash);
      }
      tNode.before(rect);
    });
    return g;
  };
  return value !== undefined
    ? numText(data, { ...textOpts, value, format, textAnchor, dx, dy, render })
    : P.text(data, { ...textOpts, text, textAnchor, dx, dy, render });
}

function fitBudgetPills(svg) {
  for (const rect of svg?.querySelectorAll?.("rect[data-pill-anchor]") ?? []) {
    const tNode = rect.nextElementSibling;
    const tw = tNode?.getComputedTextLength?.() || 0;
    if (!(tw > 0)) continue;
    const anchor = rect.getAttribute("data-pill-anchor") || "middle";
    const px = Number(rect.getAttribute("data-pill-px")) || 0;
    const pw = Math.ceil(tw + 7);
    const rx = anchor === "end" ? px - pw + 3.5 : anchor === "start" ? px - 3.5 : px - pw / 2;
    rect.setAttribute("x", String(rx));
    rect.setAttribute("width", String(pw));
  }
}

function panelHeight(rowsCount, slotWidth, isMembership = false) {
  if (rowsCount <= 3) {
    if (slotWidth < 400) return isMembership ? 152 : 186;
    return 222;
  }
  return Math.max(220, rowsCount * 21 + 66);
}

/** Full signed membership model/view; no ordinary budget parser touches adjusted thresholds. */
export function createProtectionMembershipView(ctx, slot) {
  return {
    render(model) {
      const { envelope: env, input } = model;
      const rows = env.rows;
      const measured = Math.round(slot.getBoundingClientRect?.().width || slot.clientWidth || 0);
      const width = Math.max(220, measured > 0 ? measured : Math.round(ctx.width() * 0.44));
      const height = panelHeight(rows.length, width, true);
      const cells = rows.flatMap((row, r) =>
        CONFIG.kinds.map((kind) => ({
          report: model.labels[r],
          kind: CONFIG.labels[kind],
          meets: row.membership[kind],
          grade: row.grade,
          N: row.N,
        })),
      );
      plot(slot, {
        width,
        height,
        marginLeft: model.state.mode === "book" ? 76 : width < 380 ? 124 : 132,
        marginRight: 10,
        marginTop: width < 380 ? 42 : 34,
        marginBottom: width < 380 ? 12 : 24,
        alt: "Every report in the declared base family, against inner, estimated, exact and outer feasibility. Filled cells pass; open cells fail. Counts are count-form inequalities and include all-withheld when allowed.",
        x: {
          domain: ["inner", "estimated", "exact", "outer"],
          axis: "top",
          label: null,
          tickRotate: width < 380 ? -28 : 0,
        },
        y: { domain: model.labels, inset: rows.length <= 3 ? 8 : 4, label: null },
        marks: (c, P) => [
          P.cell(cells, {
            x: "kind",
            y: "report",
            fill: (d) => (d.meets ? c.accent : c.plotBg),
            stroke: (d) => (d.meets ? c.accent : c.cellBorder),
            inset: rows.length <= 3 ? 4 : 3,
            rx: 3,
          }),
          P.text(cells, {
            x: "kind",
            y: "report",
            text: (d) => (d.meets ? "✓" : "–"),
            fill: (d) => (d.meets ? labelOn(c.accent, c) : c.plotMuted),
            fontWeight: 700,
            fontSize: 13,
          }),
        ],
        keyboard: {
          data: cells,
          x: "kind",
          y: "report",
          columns: 4,
          pointer: true,
          title: (d) =>
            `${blocksText(d.grade, input.ids)}: ${d.kind} ${d.meets ? "passes" : "fails"}; ${formatCount(d.N)} stated pairs.`,
        },
        table: {
          caption: "Every report and four membership tests",
          columns: columns([
            { label: "Grade vector", value: "grade", format: formatGrades },
            { label: "Test", value: "kind" },
            { label: "Stated pairs", value: "N", format: formatCount },
            { label: "Meets", value: (d) => flag(d.meets) },
          ]),
          rows: cells,
        },
      });
    },
  };
}

export function createProtectionNumberLines(ctx, slot, { labelThresholds = false } = {}) {
  return {
    render(model) {
      const { envelope: env, protectedCriterion: k } = model;
      const rows = env.rows.map((row, r) => ({
        ...row,
        label: model.labels[r],
        estimate: row.estimated.EoverN[k],
        truth: row.exact.EoverN[k],
      }));
      const positive = rows.filter((row) => row.N > 0);
      const inner = env.innerThreshold[k];
      const outer = env.outerThreshold[k];
      const q = env.q[k];
      const measured = Math.round(slot.getBoundingClientRect?.().width || slot.clientWidth || 0);
      const width = Math.max(220, measured > 0 ? measured : Math.round(ctx.width() * 0.52));
      const height = panelHeight(rows.length, width, false);
      const domain = [Math.min(-0.06, inner - 0.08), Math.max(1.06, outer + 0.08)];
      const forwardRows =
        model.state.mode === "book"
          ? positive.filter((r) => r.grade.length === 2 && r.grade[0] < r.grade[1])
          : [];

      const fig = plot(slot, {
        width,
        height,
        marginLeft: model.state.mode === "book" ? 76 : width < 380 ? 124 : 132,
        marginTop: labelThresholds ? 42 : 26,
        marginRight: labelThresholds ? (width < 380 ? 22 : 34) : 16,
        marginBottom: 38,
        alt: "A number line for every report. Hollow squares are estimated wrong shares and filled circles are exact supplied-law shares. Signed inner and outer thresholds remain unmodified, including values below zero or above one. All-withheld has no share points.",
        x: {
          domain,
          inset: 12,
          label: "Expected wrong share →",
          labelOffset: 34,
          grid: true,
          ticks: width < 420 ? [0, 0.5, 1] : 5,
        },
        y: { domain: model.labels, inset: rows.length <= 3 ? 8 : 4, label: null },
        marks: (c, P) =>
          [
            P.ruleX([inner], { stroke: c.critInk[0], strokeWidth: 1.75, strokeDasharray: "5 3" }),
            P.ruleX([q], { stroke: c.plotFg, strokeWidth: 2 }),
            P.ruleX([outer], { stroke: c.critInk[1], strokeWidth: 1.75, strokeDasharray: "2 3" }),
            ...(labelThresholds
              ? [
                  withBackingPill([q], {
                    x: (v) => v,
                    frameAnchor: "top",
                    value: (v) => v,
                    format: formatSetting,
                    dy: -26,
                    fill: c.plotFg,
                    fontWeight: 700,
                    fontSize: 13,
                    getPill: () => ({ bg: c.plotBg, stroke: c.plotFg, strokeWidth: "1.2" }),
                  }),
                  inner === q
                    ? null
                    : withBackingPill([inner], {
                        x: (v) => v,
                        frameAnchor: "top",
                        value: (v) => v,
                        format: formatSetting,
                        dx: -5,
                        dy: -8,
                        textAnchor: "end",
                        fill: c.critInk[0],
                        fontWeight: 600,
                        fontSize: 13,
                        getPill: () => ({ bg: c.plotBg, stroke: c.critInk[0], dash: "3 2" }),
                      }),
                  outer === q
                    ? null
                    : withBackingPill([outer], {
                        x: (v) => v,
                        frameAnchor: "top",
                        value: (v) => v,
                        format: formatSetting,
                        dx: 5,
                        dy: -8,
                        textAnchor: "start",
                        fill: c.critInk[1],
                        fontWeight: 600,
                        fontSize: 13,
                        getPill: () => ({ bg: c.plotBg, stroke: c.critInk[1], dash: "2 2" }),
                      }),
                ]
              : []),
            P.link(positive, {
              x1: "estimate",
              x2: "truth",
              y1: "label",
              y2: "label",
              stroke: c.plotMuted,
              strokeWidth: 1.6,
            }),
            P.dot(positive, {
              x: "estimate",
              y: "label",
              symbol: "square",
              r: 5.5,
              fill: c.plotBg,
              stroke: c.plotFg,
              strokeWidth: 1.8,
            }),
            P.dot(positive, {
              x: "truth",
              y: "label",
              r: 4.5,
              fill: c.post,
              stroke: c.plotBg,
              strokeWidth: 1,
            }),
            withBackingPill(forwardRows, {
              x: "estimate",
              y: "label",
              value: "estimate",
              format: formatShare,
              dx: 0,
              dy: -15,
              textAnchor: "middle",
              fill: c.plotFg,
              fontWeight: 600,
              fontSize: 13,
              getPill: () => ({ bg: c.plotBg, stroke: c.cellBorder }),
            }),
            withBackingPill(forwardRows, {
              x: "truth",
              y: "label",
              value: "truth",
              format: formatShare,
              dx: 0,
              dy: 16,
              textAnchor: "middle",
              fill: c.post,
              fontWeight: 700,
              fontSize: 13,
              getPill: () => ({ bg: c.plotBg, stroke: c.post }),
            }),
            withBackingPill(
              rows.filter((row) => row.N === 0),
              {
                P,
                x: domain[1],
                y: "label",
                text: () => "NA: no disclosure",
                textAnchor: "end",
                fill: c.plotMuted,
                dx: -2,
                fontSize: 13,
                getPill: () => ({ bg: c.plotBg, stroke: null, fillOpacity: 1 }),
              },
            ),
          ].filter(Boolean),
        keyboard: {
          data: positive,
          x: "truth",
          y: "label",
          sort: false,
          pointer: true,
          title: (row) =>
            `${row.label}: estimated ${formatShare(row.estimate)}, exact ${formatShare(row.truth)}, signed inner ${formatSetting(inner)}, q ${formatSetting(q)}, outer ${formatSetting(outer)}.`,
        },
        table: {
          caption: "Every report expected wrong share and signed thresholds",
          columns: columns([
            { label: "Grades", value: "grade", format: formatGrades },
            { label: "N", value: "N", format: formatCount },
            { label: "Estimated E/N", value: "estimate", num: true, format: formatShare },
            { label: "Exact E/N", value: "truth", num: true, format: formatShare },
          ]),
          rows,
        },
      });
      fitBudgetPills(fig.svg);
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "ebe ebu",
    frame: "v2",
    css: BUDGET_CSS + ENVELOPE_CSS,
    keys: {
      mode: { type: "choice", values: ["book", "iid"], value: "book" },
      t: { type: "number", min: 0, max: 0.9, step: 0.01, value: 0.2 },
      epsilon: { type: "number", min: 0, max: 0.4, step: 0.01, value: 0.1 },
      exact: { type: "boolean", value: false },
      soft: { type: "boolean", value: true },
      S: { type: "choice", values: ["100", "1000", "4000"], value: "1000" },
      qb: { type: "number", min: 0, max: 1, step: 0.01, value: 0.03 },
      report: { type: "string", value: "1/2", maxLength: 40 },
    },
    build(ctx) {
      const { h } = ctx;
      const r = ro(ctx);

      const mode = ctx.select({
        label: "Supplied probability experiment",
        name: "mode",
        options: [
          { value: "book", label: "Deterministic two-unit example" },
          { value: "iid", label: "Fixed-S IID six-site illustration" },
        ],
        onChange: (mode) => ctx.set({ mode }),
      });
      const t = ctx.slider({
        label: "Estimated error (A > B)",
        ...ctx.key("t"),
        onInput: (t) => ctx.set({ t }),
      });
      const epsilon = ctx.slider({
        label: "Error margin ε",
        ...ctx.key("epsilon"),
        onInput: (epsilon) => ctx.set({ epsilon }),
      });
      const exact = ctx.toggle({
        label: "Require exactly two grades",
        name: "exact",
        onChange: (exact) => ctx.set({ exact }),
      });
      const soft = ctx.toggle({
        label: "Use tolerance for the advisory coefficient check",
        name: "soft",
        onChange: (soft) => ctx.set({ soft }),
      });
      const S = ctx.select({
        label: "Sample size S",
        name: "S",
        options: ["100", "1000", "4000"].map((v) => ({
          value: v,
          label: h("span", {}, n(ctx, Number(v), formatCount)),
        })),
        onChange: (S) => ctx.set({ S }),
      });
      const qb = ctx.slider({
        label: "Score B budget",
        ...ctx.key("qb"),
        onInput: (qb) => ctx.set({ qb }),
      });

      ctx.controls.append(t.root, epsilon.root, S.root, qb.root);
      ctx.primaryControl(epsilon.root);
      ctx.settingsBox("Settings").body.append(mode.root, exact.root, soft.root);

      const exactBound = h("p", { class: "ebe-note" });
      const scope = h("p", { class: "ebe-scope" });
      const definitions = h("p", { class: "ebe-note", "data-prx-part": "probability-definitions" });
      const facts = h("p", { class: "ebe-note" });
      const counts = h("div", { class: "ebe-counts" });
      const status = h("div", { class: "ebe-status" });
      const grid = h("div", { class: "ebe-stage-cell" });
      const lines = h("div", { class: "ebe-stage-cell" });
      const slack = h("div");
      const reportSelect = h("select", {
        id: "ebe-report",
        name: "report",
        "aria-label": "Report for the count-form checks",
        "data-prx-focus-key": "select:report",
      });
      const selectedTitle = h("p", { class: "ebe-note" });
      const detail = h("div");
      const allRows = h("div");

      ctx.listen(reportSelect, "change", () => ctx.set({ report: reportSelect.value }));

      const swatchBar = h(
        "div",
        { class: "ebe-legend", "data-prx-part": "legend" },
        h("span", { class: "ebe-key-item" }, h("span", { class: "ebe-sq", "aria-hidden": "true" }), "Estimated"),
        h("span", { class: "ebe-key-item" }, h("span", { class: "ebe-dot", "aria-hidden": "true" }), "Exact"),
        h("span", { class: "ebe-key-item" }, h("span", { class: "ebe-rule-solid", "aria-hidden": "true" }), "q"),
        h("span", { class: "ebe-key-item" }, h("span", { class: "ebe-rule-dash", "aria-hidden": "true" }), "Inner"),
        h("span", { class: "ebe-key-item" }, h("span", { class: "ebe-rule-dot", "aria-hidden": "true" }), "Outer"),
      );

      const budgetWitness = h("p", { class: "ebe-note", "aria-label": "Selected report at the protected budget" });
      ctx.stage.append(
        h(
          "div",
          { class: "ebe-grid" },
          h("section", { class: "prx-panel" }, ctx.panelTitle("Wrong shares and thresholds"), lines, swatchBar),
          h("section", { class: "prx-panel" }, ctx.panelTitle("Family membership"), grid, counts),
        ),
      );

      ctx.stage.append(budgetWitness);
      ctx.dataBox("Data and count checks").body.append(
        h("p", { class: "ebe-note" }, "Tables scroll horizontally. Focus a table and use the arrow keys, or swipe."),
        h(
          "section",
          { class: "prx-panel" },
          ctx.panelTitle("Count-form checks with their actual signed slack"),
          h("div", { class: "ebe-select" }, h("label", { for: "ebe-report" }, "Report"), reportSelect),
          selectedTitle,
          slack,
          detail,
        ),
        h("section", { class: "prx-panel" }, ctx.panelTitle("Every report and raw membership result"), allRows),
      );

      ctx.methodBox("Method and scope").body.append(
        exactBound,
        scope,
        definitions,
        h("p", { class: "ebe-note" }, "E counts expected wrong stated directions; N counts stated pairs. E/N is defined only for positive N."),
        facts,
        status,
        h(
          "p",
          { class: "ebe-note" },
          "The inner condition is sufficient for exact budget compliance when the simultaneous coefficient bound holds. An empty inner family means no report was established as compliant by this construction; it does not establish that the exact family is empty. Estimated and exact families need not contain each other.",
        ),
        h(
          "p",
          { class: "ebe-note" },
          "A negative inner threshold must stay negative. Replacing it with zero can admit a positive-disclosure report with zero estimated errors that violates the intended budget. All-withheld instead has zero expected wrong counts and zero stated pairs, so every homogeneous count row holds while its expected wrong share remains NA: no disclosure.",
        ),
      );

      const membership = createProtectionMembershipView(ctx, grid);
      const numberLines = createProtectionNumberLines(ctx, lines, { labelThresholds: true });
      const feasibility = createBudgetFeasibilityView(ctx, slack);

      let geometryKey = "";
      let optionsKey = "";

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;

          mode.set(state.mode);
          t.set(state.t);
          epsilon.set(state.epsilon);
          exact.set(state.exact);
          soft.set(state.soft);
          S.set(state.S);
          qb.set(state.qb);

          const isBook = state.mode === "book";
          t.setDisabled(!isBook);
          epsilon.setDisabled(!isBook);
          S.setDisabled(isBook);
          qb.setDisabled(isBook);
          t.root.hidden = !isBook;
          epsilon.root.hidden = !isBook;
          S.root.hidden = isBook;
          qb.root.hidden = isBook;
          if (isBook) {
            epsilon.root.setAttribute("data-prx-primary-control", "");
            qb.root.removeAttribute("data-prx-primary-control");
          } else {
            qb.root.setAttribute("data-prx-primary-control", "");
            epsilon.root.removeAttribute("data-prx-primary-control");
          }

          const model = estimatedBudgetModel(state);
          const { envelope: env, input, iid, protectedCriterion: k } = model;
          const currentKey = JSON.stringify([
            state.mode,
            state.t,
            state.epsilon,
            state.exact,
            state.S,
            state.qb,
            state.soft,
            Math.round(ctx.width()),
            ctx.root.dataset.theme ?? "",
            ctx.doc.documentElement.dataset.theme ?? "",
          ]);

          exactBound.hidden = Boolean(iid);
          let gap = 0;
          let radius = env.epsilon[k];
          if (!iid) {
            gap = Math.round(env.coefficientCheck.maxAbs[k] * 100) / 100;
            exactBound.replaceChildren(
              "Declared coefficient bound: ",
              h("strong", { "data-prx-readout": "declared-strict" }, flag(radius >= gap)),
              ". Declared gap ",
              n(ctx, gap, formatSetting, "declared-gap"),
              "; radius ",
              n(ctx, radius, formatSetting),
              ". A above B: ",
              n(ctx, model.Ehat.e[k][0][1], formatShare),
              " estimated, ",
              n(ctx, model.Eexact.e[k][0][1], formatShare),
              " exact.",
            );
          } else {
            exactBound.replaceChildren();
          }

          if (currentKey !== geometryKey) {
            numberLines.render(model);
            membership.render(model);
            geometryKey = currentKey;
          }

          const optionKey = env.rows.map((row) => keyOf(row.grade)).join("|");
          if (optionKey !== optionsKey) {
            reportSelect.replaceChildren(
              ...env.rows.map((row) => h("option", { value: keyOf(row.grade) }, blocksText(row.grade, input.ids))),
            );
            optionsKey = optionKey;
          }
          const selected =
            env.rows.find((row) => keyOf(row.grade) === state.report) ??
            env.rows.find((row) => row.N > 0) ??
            env.rows[0];
          if (selected && state.report !== keyOf(selected.grade)) ctx.set({ report: keyOf(selected.grade) });
          reportSelect.value = selected ? keyOf(selected.grade) : "";
          budgetWitness.replaceChildren();
          if (selected) {
            budgetWitness.append(blocksText(selected.grade, input.ids), " · protected budget q = ", n(ctx, env.q[k], formatSetting),
              " · estimated family: ", selected.membership.nominal ? "in" : "out");
            if (selected.exact) budgetWitness.append(" · exact family: ", selected.membership.exact ? "in" : "out");
            budgetWitness.append(". Equality at the budget is feasible.");
          }

          scope.replaceChildren(
            ...(iid
              ? [
                  "Fixed-S IID illustration: independent Normal units and criteria, ",
                  n(ctx, env.rows[0]?.estimated.M, formatCount, "M"),
                  " unordered pairs, ",
                  n(ctx, iid.record.S, formatCount, "iid-S"),
                  " draws and seed ",
                  n(ctx, iid.record.seed, formatCount, "iid-seed"),
                  ". The original Monte Carlo producer and coefficient bound are reused. α = ",
                  n(ctx, iid.alpha, formatSetting, "alpha"),
                  ", split as α/K = ",
                  n(ctx, iid.bound.alphaK, formatSetting, "alphaK"),
                  ".",
                ]
              : [
                  "Deterministic supplied coefficients after the theory book. Both the exact forward coefficient and the budget move with t; changing the proposed radius does not alter that law. This is not a sampling experiment.",
                ]),
          );

          facts.replaceChildren(
            "Base family: ",
            familyNameNode(ctx, env),
            " · ",
            n(ctx, env.family.size, formatCount, "baseSize"),
            " reports. Protected criterion: ",
            isBook ? "criterion" : input.criteria[k],
            "; its error weight is ",
            n(ctx, model.w[k], formatSetting, "protected-weight"),
            ". The grade nearer one has higher priority; sharing a grade withholds its comparison.",
          );

          definitions.replaceChildren(
            "A coefficient is one strict direction’s wrong probability. ",
            ...(isBook
              ? [
                  "For A above B: estimated ",
                  n(ctx, model.Ehat.e[k][0][1], formatShare, "definition-estimated-forward"),
                  ", stipulated exact ",
                  n(ctx, model.Eexact.e[k][0][1], formatShare, "definition-exact-forward"),
                  ". ",
                ]
              : ["Here each direction has its own estimate from the draws and exact probability from the supplied Normal law. "]),
            "The budget q = ",
            n(ctx, env.q[k], formatSetting, "definition-q"),
            " limits a report’s expected wrong share. Proposed maximum probability error ε = ",
            n(ctx, env.epsilon[k], formatSetting, "definition-epsilon"),
            ". Inner uses the estimated share at q − ε = ",
            n(ctx, env.innerThreshold[k], formatSetting, "definition-inner"),
            "; estimated uses q; exact uses the exact-law share at the same q; outer uses the estimated share at q + ε = ",
            n(ctx, env.outerThreshold[k], formatSetting, "definition-outer"),
            ". For a report with no statements, the count-form rows hold without a defined share.",
          );

          counts.replaceChildren(
            ...CONFIG.kinds.map((kind) =>
              h("span", {}, CONFIG.labels[kind], " ", n(ctx, env.counts[kind], formatCount, `count-${kind}`)),
            ),
          );

          status.replaceChildren(
            h(
              "p",
              {},
              "Strict raw coefficient bound: ",
              h("strong", { "data-prx-readout": "strict" }, flag(env.coefficientCheck.strictEnvelopeHolds)),
              ". Advisory comparison: ",
              h("strong", { "data-prx-readout": "advisory" }, flag(env.coefficientCheck.withinCoefficientTolerance)),
              ", with coefficient tolerance ",
              n(ctx, env.coefficientCheck.coefficientTol, (v) => formatSci(v, { trim: true }), "coefficient-tolerance"),
              ". Neither comparison is a guarantee inferred from a soft tolerance.",
            ),
            h(
              "p",
              {},
              "Actual inner ⊆ exact: ",
              h("strong", { "data-prx-readout": "inner-in-exact" }, flag(env.actualBracketInclusions.innerSubsetExact)),
              ". Actual exact ⊆ outer: ",
              h("strong", { "data-prx-readout": "exact-in-outer" }, flag(env.actualBracketInclusions.exactSubsetOuter)),
              ". The actual inclusions are checked separately over every report.",
            ),
          );
          status.append(
            table(
              ctx,
              "Coefficient discrepancies, radii and raw excesses",
              [
                { label: "Criterion", value: "criterion" },
                { label: "Largest absolute coefficient error", value: "maxAbs", format: formatShare, hook: (row) => `maxAbs-${row.k}` },
                { label: "Proposed radius", value: "radius", format: formatSetting, hook: (row) => `radius-${row.k}` },
                { label: "Raw excess above radius", value: "excess", format: (v) => formatSci(v, { trim: true }), hook: (row) => `excess-${row.k}` },
              ],
              input.criteria.map((_, c) => ({
                criterion: isBook ? "criterion" : input.criteria[c],
                k: c,
                maxAbs: env.coefficientCheck.maxAbs[c],
                radius: env.epsilon[c],
                excess: env.coefficientCheck.excess[c],
              })),
            ),
          );
          for (const [field, label] of [
            ["counterexampleInnerExact", "An inner report that fails the exact budget"],
            ["counterexampleExactOuter", "An exact-feasible report outside the outer family"],
          ]) {
            if (env.actualBracketInclusions[field]) {
              status.append(h("p", {}, label, ": ", n(ctx, env.actualBracketInclusions[field], formatGrades, field), "."));
            }
          }
          if (iid) {
            status.append(
              h(
                "p",
                { class: "ebe-note" },
                "For a fixed sample size, the simultaneous coefficient event has probability at least one minus α across repeated IID numerical samples from this supplied law. It controls both criteria’s pair coefficients, uniformly over reports in this base family. Each sample-size choice is a separate fixed experiment; the statement is not simultaneous over explored sample sizes or seeds. It is numerical uncertainty, not a posterior probability of compliance or a model-calibration claim.",
              ),
            );
          }

          if (selected) {
            selectedTitle.replaceChildren(
              "Report ",
              n(ctx, selected.grade, formatGrades, "selected-grades"),
              ": ",
              n(ctx, selected.N, formatCount, "selected-N"),
              selected.N === 1 ? " stated pair." : " stated pairs.",
            );
            const checks = CONFIG.kinds.map((kind) => {
              const ev = kind === "exact" ? selected.exact : selected.estimated;
              return {
                k: kind,
                criterion: `${CONFIG.labels[kind]} · ${isBook ? "criterion" : input.criteria[k]}`,
                q: threshold(env, kind, k),
                E: ev.E[k],
                N: selected.N,
                EoverN: ev.EoverN[k],
                slack: selected.slack[kind][k],
                meets: selected.membership[kind],
              };
            });
            feasibility.render({
              rows: checks,
              hookPrefix: "signed",
              caption: "Each test uses its shown signed threshold: E ≤ threshold × N",
            });
            detail.replaceChildren(
              table(
                ctx,
                "Selected report raw expected shares and signed thresholds",
                [
                  { label: "Estimated E/N", value: "estimate", num: true, format: formatShare, hook: () => "selected-estimate" },
                  { label: "Exact E/N", value: "truth", num: true, format: formatShare, hook: () => "selected-exact" },
                  { label: "Inner threshold", value: "inner", format: formatSetting, hook: () => "inner-threshold" },
                  { label: "Budget q", value: "q", format: formatSetting, hook: () => "q" },
                  { label: "Outer threshold", value: "outer", format: formatSetting, hook: () => "outer-threshold" },
                ],
                [
                  {
                    estimate: selected.estimated.EoverN[k],
                    truth: selected.exact.EoverN[k],
                    inner: env.innerThreshold[k],
                    q: env.q[k],
                    outer: env.outerThreshold[k],
                  },
                ],
              ),
            );
          }

          const reportRows = env.rows.map((row, rowIdx) => ({
            r: rowIdx,
            grade: row.grade,
            N: row.N,
            estimate: row.estimated.EoverN[k],
            truth: row.exact.EoverN[k],
            ...row.membership,
          }));
          allRows.replaceChildren(
            table(
              ctx,
              "Complete count-form membership, including reports with no disclosure",
              [
                { label: "Grade vector", value: "grade", format: formatGrades, hook: (row) => `report-${row.r}-grades` },
                { label: "Stated N", value: "N", format: formatCount, hook: (row) => `report-${row.r}-N` },
                { label: "Estimated E/N", value: "estimate", num: true, format: formatShare, hook: (row) => `report-${row.r}-estimate` },
                { label: "Exact E/N", value: "truth", num: true, format: formatShare, hook: (row) => `report-${row.r}-exact` },
                ...CONFIG.kinds.map((kind) => ({
                  label: CONFIG.labels[kind],
                  value: (row) => flag(row[kind]),
                  hook: (row) => `report-${row.r}-member-${kind}`,
                })),
              ],
              reportRows,
            ),
          );
          const rawRows = env.rows.flatMap((row, rowIdx) =>
            CONFIG.kinds.map((kind) => {
              const ev = kind === "exact" ? row.exact : row.estimated;
              return {
                r: rowIdx,
                kind,
                grade: row.grade,
                N: row.N,
                E: ev.E[k],
                share: ev.EoverN[k],
                q: threshold(env, kind, k),
                slack: row.slack[kind][k],
              };
            }),
          );
          const raw = hiddenTable(ctx.doc, {
            caption: "Every report and signed count-form row",
            columns: columns([
              { label: "Grades", value: "grade", format: formatGrades },
              { label: "Test", value: "kind" },
              { label: "N", value: "N", format: formatCount },
              { label: "Expected wrong count", value: "E", format: formatExpectedCount },
              { label: "E/N", value: "share", num: true, format: formatShare },
              { label: "Signed threshold", value: "q", format: formatSetting },
              { label: "Raw count slack", value: "slack", format: formatExpectedCount },
            ]),
            rows: rawRows,
          });
          raw.querySelectorAll("tbody tr").forEach((tr, i) => {
            const row = rawRows[i];
            ["grade", "kind", "N", "E", "share", "q", "slack"].forEach((field, j) => {
              if (j !== 1) tr.cells[j].setAttribute("data-prx-readout", `all-${row.r}-${row.kind}-${field}`);
            });
          });
          allRows.append(raw);

          // Plain-English live readout explaining how the ±ε margin narrows/widens feasibility relative to the exact posterior
          const boundFails = !iid ? radius < gap : !env.coefficientCheck.withinCoefficientTolerance;
          if (boundFails) {
            r.set([
              "Margin ε = ",
              r.setting(radius),
              " misses the ",
              r.share(env.coefficientCheck.maxAbs[k]),
              " error gap (bound holds: ",
              h("strong", {}, "no"),
              "): ",
              r.count(env.counts.inner),
              " ",
              plural(env.counts.inner, "report"),
              env.counts.inner === 1 ? " passes" : " pass",
              " q − ε while ",
              r.count(env.counts.exact),
              env.counts.exact === 1 ? " meets" : " meet",
              " the exact budget (outer ",
              r.count(env.counts.outer),
              ").",
            ]);
          } else if (!state.soft && !env.coefficientCheck.strictEnvelopeHolds) {
            r.set([
              "Without float tolerance, the strict bound check reads ",
              h("strong", {}, "no"),
              ": naive estimates pass ",
              r.count(env.counts.nominal),
              " ",
              plural(env.counts.nominal, "report"),
              " vs. ",
              r.count(env.counts.exact),
              " exact; ±ε gives ",
              r.count(env.counts.inner),
              " inner and ",
              r.count(env.counts.outer),
              " outer.",
            ]);
          } else if (env.empty.inner) {
            r.set([
              "Naive estimates pass ",
              r.count(env.counts.nominal),
              " ",
              plural(env.counts.nominal, "report"),
              " vs. ",
              r.count(env.counts.exact),
              " exact; tightening by ε leaves ",
              r.count(0),
              " reports in the inner set while widening to q + ε keeps ",
              r.count(env.counts.outer),
              ".",
            ]);
          } else {
            r.set([
              "Naive estimates pass ",
              r.count(env.counts.nominal),
              " ",
              plural(env.counts.nominal, "report"),
              " vs. ",
              r.count(env.counts.exact),
              " under the exact posterior; ±ε narrows the safe inner set to ",
              r.count(env.counts.inner),
              " and widens the outer bracket to ",
              r.count(env.counts.outer),
              ".",
            ]);
          }

          ctx.caption.replaceChildren(
            "After the postrank theory book, ch. ",
            n(ctx, 15, formatCount),
            ". ",
            iid ? "Six-site fixed-S IID posterior experiment." : "Two-unit supplied exact and estimated probabilities.",
          );
        },
      };
    },
  });
}
