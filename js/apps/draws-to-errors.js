// A complete retained state moves as a unit. Numerical counts and shares are drawErrors output.
import { createWidget } from "../shared/base.js";
import { hiddenTable, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatShare } from "../shared/format.js";
import { drawErrors, scoreOrder } from "../pr-core.js";
import { toyInput, toyJointDraws } from "../shared/criteria-data.js";

export const CONFIG = Object.freeze({
  name: "draws-to-errors",
  pairs: [
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  symbols: ["circle", "square", "triangle"],
});

const SVG_NS = "http://www.w3.org/2000/svg";
const cache = new Map();

function prefixModels(input) {
  return input.draws.map((_, s) => {
    const E = drawErrors(input.draws.slice(0, s + 1), { ids: input.ids, criteria: input.criteria });
    return { prefix: E.S, E, counts: E.counts };
  });
}

/** Approved input reindexing followed only by public count/order calls; no regenerated source draws. */
export function toyDrawModel(state) {
  const source = toyJointDraws();
  const unit = source.ids.indexOf(state.unit);
  const allUnits = state.mode === "all";
  const shift = state.mode === "original" ? 0 : state.shift;
  const key = JSON.stringify([unit, allUnits, shift]);
  if (!cache.has(key)) {
    if (cache.size > 40) cache.clear();
    const input = toyInput({ prefix: source.S, shift, unit, allUnits });
    cache.set(key, { input, prefixes: prefixModels(input) });
  }
  const current = cache.get(key);
  const originalKey = JSON.stringify([unit, false, 0]);
  if (!cache.has(originalKey)) {
    const input = toyInput({ prefix: source.S, shift: 0, unit });
    cache.set(originalKey, { input, prefixes: prefixModels(input) });
  }
  const original = cache.get(originalKey);
  const draw = state.draw - 1;
  const selectedState = current.input.draws[draw];
  const E = drawErrors([selectedState], { ids: source.ids, criteria: source.criteria });
  const pair = CONFIG.pairs[Number(state.pair)];
  const direction = state.reverse ? [pair[1], pair[0]] : pair;
  const orders = source.criteria.map((_, k) => scoreOrder(selectedState.map((row) => row[k]), { ids: source.ids }));
  return {
    source,
    input: current.input,
    prefixes: current.prefixes,
    original: original.prefixes,
    retained: current.prefixes[state.prefix - 1],
    baseline: original.prefixes[state.prefix - 1],
    selected: { draw, state: selectedState, orders, E, counts: E.counts },
    direction,
    criterion: source.criteria.indexOf(state.criterion),
    unit,
    allUnits,
    state,
  };
}

export const DRAWS_CSS = `
.dte.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 0.85rem;
  flex: 0 1 auto;
  min-width: 0;
}
.dte.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls > .prx-slider {
  flex: 1 1 12.5rem;
  max-width: 14.5rem;
  min-width: 0;
}
@media (min-width: 52rem) {
  .dte.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    align-items: flex-start;
  }
  .dte.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex-wrap: nowrap;
  }
  .dte.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-presets {
    flex: 1 1 22rem;
  }
}
.dte .dte-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13.5rem), 1fr));
  gap: 0.45rem 1rem;
  align-items: end;
  width: 100%;
}
.dte .dte-settings-grid select {
  width: 100%;
  max-width: 100%;
}
.dte .prx-stage .dte-stage-wrap {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.dte .prx-stage figure {
  margin: 0;
}
.dte .prx-stage .dte-stage-foot {
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
.dte .prx-stage .dte-key {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.85rem;
}
.dte .prx-stage .dte-line {
  width: 1.3rem;
  border-top: 2.2px solid var(--prx-plot-fg);
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.28rem;
}
.dte .prx-stage .dte-dash {
  border-top-style: dashed;
  border-color: var(--prx-plot-muted);
}
.dte .dte-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  min-width: 0;
}
.dte .dte-paper + .dte-paper {
  margin-top: 0.65rem;
}
.dte .dte-orders {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  min-width: 0;
}
.dte .dte-orders > div {
  min-width: 0;
}
.dte .dte-note,
.dte .dte-order {
  font-size: 0.875rem;
  line-height: 1.45;
  margin: 0.35rem 0;
}
.dte .dte-formula {
  margin: 0.4rem 0 0.55rem;
  padding: 0.45rem 0.6rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 5px;
  overflow-x: auto;
}
.dte .dte-table {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.dte .dte-table table {
  border-collapse: collapse;
  font-size: 0.82rem;
  width: 100%;
  min-width: 30rem;
  font-variant-numeric: tabular-nums;
}
.dte .dte-table th,
.dte .dte-table td {
  padding: 0.3rem 0.45rem;
  white-space: nowrap;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}
.dte .dte-source table {
  min-width: 52rem;
}
.dte .dte-source tbody tr[data-selected] {
  outline: 2px solid var(--prx-focus);
  outline-offset: -2px;
}
@media (max-width: 48rem) {
  .dte .dte-orders {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

const decimal = (value) => formatDecimal(value, { digits: 4 });

function n(ctx, value, format, key) {
  const node = ctx.num(value, format(value));
  if (key) node.setAttribute("data-prx-readout", key);
  return node;
}

function name(ctx, value) {
  return ctx.h("span", { "data-prx-name": "" }, value);
}

function columns(cols) {
  return cols.map((c) => ({ ...c, ...(c.format ? { format: (v) => c.format(v) } : {}) }));
}

function table(ctx, caption, cols, rows) {
  const t = hiddenTable(ctx.doc, { caption, columns: columns(cols), rows, visible: true });
  t.classList.add("dte-table");
  ctx.scrollRegion(t, caption);
  rows.forEach((row, i) =>
    cols.forEach((c, j) => {
      const cell = t.querySelectorAll("tbody tr")[i].cells[j];
      if (c.name) cell.setAttribute("data-prx-name", "");
      if (c.hook) cell.setAttribute("data-prx-readout", c.hook(row));
    }),
  );
  return t;
}

function directionNodes(ctx, ids, [i, j]) {
  return [name(ctx, ids[i]), " above ", name(ctx, ids[j])];
}

function curveRowsFor(model, k) {
  const [i, j] = model.direction;
  return model.prefixes.map((r, s) => ({
    prefix: r.prefix,
    k,
    criterion: model.source.criteria[k],
    count: r.counts[k][i][j],
    share: r.E.e[k][i][j],
    baseline: model.original[s].E.e[k][i][j],
    originalCount: model.original[s].counts[k][i][j],
  }));
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "dte",
    frame: "v2",
    css: DRAWS_CSS,
    keys: {
      prefix: { type: "integer", min: 1, max: 32, value: 32 },
      draw: { type: "integer", min: 1, max: 32, value: 1 },
      mode: { type: "choice", values: ["original", "unit", "all"], value: "original" },
      unit: { type: "choice", values: ["001", "site-B", "site C"], value: "site-B" },
      shift: { type: "integer", min: 0, max: 32, value: 0 },
      pair: { type: "choice", values: ["0", "1", "2"], value: "0" },
      reverse: { type: "boolean", value: false },
      criterion: { type: "choice", values: ["need_A", "need_B"], value: "need_A" },
    },
    build(ctx) {
      const { h } = ctx;
      const source = toyJointDraws();

      const prefix = ctx.slider({
        label: "Retained states S",
        ...ctx.key("prefix"),
        format: formatCount,
        onInput: (val) => ctx.set({ prefix: val }),
      });
      const pair = ctx.select({
        label: "Pair",
        name: "pair",
        options: CONFIG.pairs.map(([i, j], p) => ({ value: String(p), label: `${source.ids[i]} / ${source.ids[j]}` })),
        value: ctx.state.pair,
        onChange: (val) => ctx.set({ pair: val }),
      });
      ctx.primaryControl(prefix.root);
      ctx.controls.append(prefix.root, pair.root);

      const criterion = ctx.select({
        label: "Focused criterion (table & keyboard)",
        name: "criterion",
        options: source.criteria.map((c) => ({ value: c, label: c })),
        value: ctx.state.criterion,
        onChange: (val) => ctx.set({ criterion: val }),
      });
      const mode = ctx.select({
        label: "Pairing of state rows",
        name: "mode",
        options: [
          { value: "original", label: "Original whole states" },
          { value: "unit", label: "One unit’s whole vector" },
          { value: "all", label: "All unit vectors together" },
        ],
        value: ctx.state.mode,
        onChange: (val) => ctx.set({ mode: val }),
      });
      const unit = ctx.select({
        label: "Unit to shift",
        name: "unit",
        options: source.ids.map((id) => ({ value: id, label: id })),
        value: ctx.state.unit,
        onChange: (val) => ctx.set({ unit: val }),
      });
      const shift = ctx.slider({
        label: "Cyclic shift of the full input",
        ...ctx.key("shift"),
        format: formatCount,
        onInput: (val) => ctx.set({ shift: val }),
      });
      const draw = ctx.slider({
        label: "Whole state to inspect",
        ...ctx.key("draw"),
        format: formatCount,
        onInput: (val) => ctx.set({ draw: val }),
      });
      const reverse = ctx.toggle({
        label: "Reverse the direction being counted",
        name: "reverse",
        checked: ctx.state.reverse,
        onChange: (val) => ctx.set({ reverse: val }),
      });
      for (const option of [...unit.input.options, ...pair.input.options]) {
        option.setAttribute("data-prx-name", "");
      }
      ctx.settingsBox("Settings").body.append(
        h("div", { class: "dte-settings-grid" }, criterion.root, mode.root, unit.root, shift.root, draw.root, reverse.root),
      );

      // Primary stage
      const curveSlot = h("div");
      const stageFoot = h("div", { class: "dte-stage-foot", "data-prx-part": "legend" });
      ctx.stage.append(
        h("section", { class: "dte-stage-wrap", "aria-label": "Count wrong directions through the retained states" }, curveSlot, stageFoot),
      );

      // Data disclosure: whole-state dot plots, state table, pair table, prefix table, complete source draws
      const wholeTitle = h("div");
      const stateNote = h("p", { class: "dte-note" });
      const orderSlots = [h("div"), h("div")];
      const stateTable = h("div");
      const pairSummary = h("p", { class: "dte-note" });
      const pairTable = h("div");
      const curveTable = h("div");
      const sourceTable = h("div");

      const dataBox = ctx.dataBox("Data, whole-state draws and pair table");
      dataBox.body.append(
        h(
          "section",
          { class: "dte-paper prx-light-panel" },
          ctx.panelTitle("One whole state, every unit and both criteria"),
          wholeTitle,
          stateNote,
          h("p", { class: "dte-note" }, "Filled marks: current input. Hollow marks: original row. Lines connect the two values."),
          h("div", { class: "dte-orders" }, ...orderSlots),
          h("p", { class: "dte-note" }, "Tables scroll horizontally. Focus a table and use the arrow keys, or swipe."),
          stateTable,
        ),
        h("section", { class: "dte-paper prx-light-panel" }, ctx.panelTitle("Both criteria, both directions"), pairSummary, pairTable),
        h("section", { class: "dte-paper prx-light-panel" }, ctx.panelTitle("Every prefix of the current input"), curveTable),
        h(
          "section",
          { class: "dte-paper prx-light-panel" },
          ctx.panelTitle("The complete original source sample"),
          h(
            "p",
            { class: "dte-note" },
            "Each row is one original joint state. The selected original row is outlined. Values are shown on their own criterion scales; larger means higher priority on both criteria.",
          ),
          sourceTable,
        ),
      );

      // Method disclosure: pair-error aggregation formula and dependence notes
      const formulaBox = h(
        "p",
        { class: "dte-formula prx-light-panel" },
        "Pair-error aggregation across S retained states: weak-error count C = number of retained states where the first unit’s criterion value is at most the second unit’s value (ties included); empirical wrong-direction share e = C / S.",
      );
      const provenanceLine = h("p", { class: "dte-note" });
      const methodBox = ctx.methodBox("Method and pair-error aggregation");
      methodBox.body.append(
        formulaBox,
        h(
          "p",
          { class: "dte-note" },
          "A shift moves a unit’s entire two-criterion vector before any prefix is selected. Across the full sample, every unit keeps exactly the same vectors and marginal values. Shifting one unit changes its pairing with the others; shifting all units together only reorders the complete states. A shorter prefix can change under either shift.",
        ),
        h(
          "p",
          { class: "dte-note" },
          "The error estimates come from a fixed set of independent posterior draws. A share of zero or one describes what happened in that sample. To state that one unit is above another is wrong when their values are equal.",
        ),
        provenanceLine,
      );

      let rawTable = null;
      function drawOriginal(model) {
        if (!rawTable) {
          const rows = source.draws.map((st, s) => ({
            s: s + 1,
            ...Object.fromEntries(st.flatMap((row, i) => row.map((v, k) => [`v${i}${k}`, v]))),
          }));
          const cols = [
            { label: "Original state", value: "s", format: formatCount, hook: (r) => `raw-draw-${r.s - 1}` },
            ...source.ids.flatMap((id, i) =>
              source.criteria.map((c, k) => ({
                label: `${id} · ${c}`,
                value: `v${i}${k}`,
                format: decimal,
                hook: (r) => `raw-source-${r.s - 1}-${i}-${k}`,
              })),
            ),
          ];
          rawTable = table(ctx, "All original unit-by-criterion values, kept together in each source state", cols, rows);
          rawTable.classList.add("dte-source");
          for (const th of rawTable.querySelectorAll("thead th")) {
            if (th.textContent.includes("001")) th.setAttribute("data-prx-name", "");
          }
          sourceTable.append(rawTable);
        }
        [...rawTable.querySelectorAll("tbody tr")].forEach((tr, s) => tr.toggleAttribute("data-selected", s === model.selected.draw));
      }

      function renderOrderPlots(model) {
        const { selected } = model;
        orderSlots.forEach((slot, k) => {
          const order = selected.orders[k].order;
          const data = order.map((u) => ({
            id: source.ids[u],
            unit: u,
            value: selected.state[u][k],
            original: source.draws[selected.draw][u][k],
          }));
          const fig = h("div");
          slot.replaceChildren(
            ctx.panelTitle(source.criteria[k]),
            h("p", { class: "dte-order" }, "Higher first: ", ...order.flatMap((u, p) => [...(p ? [" > "] : []), name(ctx, source.ids[u])])),
            fig,
          );
          const slotW = Math.round(slot.clientWidth || (ctx.width() >= 768 ? (ctx.width() - 80) / 2 : ctx.width() - 56));
          const width = Math.max(220, slotW);
          plot(fig, {
            width,
            height: 168,
            marginTop: 18,
            marginLeft: 62,
            marginRight: 18,
            marginBottom: 38,
            alt: `The complete selected state on ${source.criteria[k]}, with units ordered by their target values; filled marks show the current pairing and hollow marks the original row.`,
            x: {
              label: "Target value",
              labelAnchor: "center",
              labelArrow: "none",
              grid: true,
              inset: 14,
              ...(width < 340 ? { ticks: 4 } : {}),
            },
            y: { domain: order.map((u) => source.ids[u]), label: null },
            marks: (c, P) => [
              P.link(data, { x1: "original", x2: "value", y1: "id", y2: "id", stroke: c.plotMuted, strokeWidth: 1.6 }),
              P.dot(data, { x: "original", y: "id", r: 6, stroke: c.plotMuted, fill: "none", strokeWidth: 1.6 }),
              P.dot(data, { x: "value", y: "id", r: 4.8, fill: c.crit[k], symbol: (d) => CONFIG.symbols[d.unit] }),
            ],
            keyboard: {
              data,
              x: "value",
              y: "id",
              pointer: true,
              title: (d) => `${d.id}, ${source.criteria[k]}: current ${decimal(d.value)}, original row ${decimal(d.original)}.`,
            },
            table: {
              caption: "Values and order of the complete selected state",
              columns: columns([
                { label: "Unit", value: "id" },
                { label: "Current value", value: "value", format: decimal },
                { label: "Original-row value", value: "original", format: decimal },
              ]),
              rows: data,
            },
          });
          for (const label of fig.querySelectorAll("text,th")) {
            if (label.textContent === "001") label.setAttribute("data-prx-name", "");
          }
        });
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            if (info?.disclosure === "data" && dataBox.open) {
              renderOrderPlots(toyDrawModel(state));
            }
            return;
          }

          prefix.set(state.prefix);
          pair.set(state.pair);
          criterion.set(state.criterion);
          mode.set(state.mode);
          unit.set(state.unit);
          unit.setDisabled(state.mode !== "unit");
          shift.set(state.shift);
          shift.setDisabled(state.mode === "original");
          draw.set(state.draw);
          reverse.set(state.reverse);

          const model = toyDrawModel(state);
          const { direction, retained, baseline, selected } = model;
          const [i, j] = direction;
          const rowsByCrit = [0, 1].map((k) => curveRowsFor(model, k));
          const rows = rowsByCrit[model.criterion];

          // Stage plot: running wrong-direction share on both criteria with collision-free pills
          const measuredW = Math.round(curveSlot.clientWidth || ctx.stage.clientWidth || ctx.width());
          const width = Math.max(240, measuredW);
          const isNarrow = width < 480;
          const height = isNarrow ? 236 : 352;
          const marginTop = 28;
          const marginBottom = 42;
          const marginLeft = 48;
          const inset = 8;
          const tPrefix = (state.prefix - 1) / Math.max(1, source.S - 1);
          const neededRight = Math.ceil((114 - (1 - tPrefix) * (width - marginLeft - 2 * inset)) / Math.max(0.25, tPrefix));
          const marginRight = state.prefix <= 22 ? Math.max(24, Math.min(isNarrow ? 114 : 132, neededRight)) : isNarrow ? 114 : 132;
          const innerH = height - marginTop - marginBottom - inset * 2;
          const toPx = (s) => marginTop + inset + (1 - s) * innerH;
          const fromPx = (py) => 1 - (py - marginTop - inset) / innerH;

          const focusRaw = [0, 1].map((k) => ({
            id: `c${k}`,
            k,
            criterion: source.criteria[k],
            prefix: state.prefix,
            share: retained.E.e[k][i][j],
            focused: k === model.criterion,
          }));
          const placedFocus = placeDirectLabels(
            focusRaw.map((d) => ({ id: d.id, y: toPx(d.share), height: 19 })),
            { minGapPx: 22, minY: marginTop + 12, maxY: height - marginBottom - 12 },
          );
          const placedById = new Map(placedFocus.map((p) => [p.id, p]));
          const focusPills = focusRaw.map((d) => ({
            ...d,
            labelY: fromPx(placedById.get(d.id).y),
          }));

          const curveTitle = (d) =>
            `${formatCount(d.prefix)} ${d.prefix === 1 ? "state" : "states"}: ${formatCount(d.count)} weak ${d.count === 1 ? "error" : "errors"}, empirical share ${formatShare(d.share)}; original ${formatCount(d.originalCount)} ${d.originalCount === 1 ? "error" : "errors"}, share ${formatShare(d.baseline)}.`;

          plot(curveSlot, {
            width,
            height,
            marginTop,
            marginBottom,
            marginLeft,
            marginRight,
            alt: "Running empirical wrong-direction share for the selected pair and criterion, comparing current and original state pairing. The vertical line is the retained prefix.",
            x: {
              domain: [1, source.S],
              inset,
              ticks: [1, 8, 16, 24, 32],
              label: "Retained states S",
              labelAnchor: "center",
              labelArrow: "none",
              grid: true,
            },
            y: {
              domain: [0, 1],
              inset,
              ticks: [0, 0.25, 0.5, 0.75, 1],
              label: "Empirical wrong-direction share",
              labelArrow: "none",
              grid: true,
            },
            marks: (c, P) => [
              // Original-pairing dashed reference curves
              ...[0, 1].map((k) =>
                P.line(rowsByCrit[k], {
                  x: "prefix",
                  y: "baseline",
                  stroke: c.crit[k],
                  strokeDasharray: "5,3",
                  strokeWidth: k === model.criterion ? 1.8 : 1.4,
                  strokeOpacity: 0.45,
                }),
              ),
              // Current-pairing solid curves for both criteria
              ...[0, 1].map((k) =>
                P.line(rowsByCrit[k], {
                  x: "prefix",
                  y: "share",
                  stroke: c.crit[k],
                  strokeWidth: k === model.criterion ? 3 : 2.1,
                  strokeOpacity: k === model.criterion ? 1 : 0.85,
                }),
              ),
              P.ruleX([state.prefix], { stroke: c.plotMuted, strokeDasharray: "3,3", strokeWidth: 1.5 }),
              P.dot(focusRaw, {
                x: "prefix",
                y: "share",
                r: (d) => (d.focused ? 5.5 : 4.5),
                fill: (d) => c.crit[d.k],
                stroke: c.plotBg,
                strokeWidth: 1.8,
              }),
              // Criterion pill background + criterion name
              P.text(focusPills, {
                x: "prefix",
                y: "labelY",
                text: "criterion",
                dx: 12,
                textAnchor: "start",
                fontSize: 13,
                fontWeight: (d) => (d.focused ? 700 : 600),
                fill: (d) => c.critInk[d.k],
                render(index, scales, values, dims, context, next) {
                  const g = next(index, scales, values, dims, context);
                  const doc = g?.ownerDocument;
                  if (!doc) return g;
                  const texts = g.querySelectorAll("text");
                  Array.from(index).forEach((rowIdx, nodeIdx) => {
                    const tNode = texts[nodeIdx];
                    if (!tNode) return;
                    const px = values.x[rowIdx];
                    const py = values.y[rowIdx];
                    const d = focusPills[rowIdx];
                    const rect = doc.createElementNS(SVG_NS, "rect");
                    // g carries transform="translate(12, 0)", so x = px - 5 lands at sx(prefix) + 7..106
                    rect.setAttribute("x", (px - 5).toFixed(1));
                    rect.setAttribute("y", (py - 9.25).toFixed(1));
                    rect.setAttribute("width", "99");
                    rect.setAttribute("height", "18.5");
                    rect.setAttribute("rx", "3");
                    rect.setAttribute("ry", "3");
                    rect.setAttribute("fill", c.plotBg);
                    rect.setAttribute("stroke", c.crit[d.k]);
                    rect.setAttribute("stroke-width", d.focused ? "1.3" : "1");
                    rect.setAttribute("stroke-opacity", d.focused ? "0.7" : "0.45");
                    tNode.before(rect);
                  });
                  return g;
                },
              }),
              // Tabular 3-sig-fig empirical share aligned inside the right half of each pill
              numText(focusPills, {
                x: "prefix",
                y: "labelY",
                value: "share",
                format: formatShare,
                dx: 101,
                textAnchor: "end",
                fontSize: 13,
                fontWeight: 700,
                fill: (d) => c.critInk[d.k],
              }),
            ],
            keyboard: {
              data: rows,
              x: "prefix",
              y: "share",
              pointer: true,
              title: curveTitle,
            },
            table: {
              caption: "Running error counts and empirical shares",
              columns: columns([
                { label: "Prefix", value: "prefix", format: formatCount },
                { label: "Current count", value: "count", format: formatCount },
                { label: "Current share", value: "share", format: formatShare },
                { label: "Original count", value: "originalCount", format: formatCount },
                { label: "Original share", value: "baseline", format: formatShare },
              ]),
              rows,
            },
          });

          stageFoot.replaceChildren(
            h("span", {}, "Counting ", ...directionNodes(ctx, source.ids, direction), " (ties count as weak errors)"),
            h(
              "span",
              { class: "dte-key" },
              h("span", {}, h("span", { class: "dte-line" }), "current"),
              h("span", {}, h("span", { class: "dte-line dte-dash" }), state.mode === "original" ? "original pairing (matches current until shifted)" : "original pairing"),
            ),
          );

          // Live 3-sig-fig readout (20-21 words, preserving count-0, count-1, share-0, share-1)
          const countA = retained.counts[0][i][j];
          const countB = retained.counts[1][i][j];
          ctx.readout.set([
            "In ",
            n(ctx, retained.E.S, formatCount),
            retained.E.S === 1 ? " retained state, " : " retained states, ",
            ...directionNodes(ctx, source.ids, direction),
            " is wrong ",
            n(ctx, countA, formatCount, "count-0"),
            countA === 1 ? " time (" : " times (",
            n(ctx, retained.E.e[0][i][j], formatShare, "share-0"),
            ") on need_A and ",
            n(ctx, countB, formatCount, "count-1"),
            countB === 1 ? " time (" : " times (",
            n(ctx, retained.E.e[1][i][j], formatShare, "share-1"),
            ") on need_B.",
          ]);

          // Data & Method disclosures (complete audit material preserved)
          wholeTitle.replaceChildren(
            h(
              "p",
              { class: "dte-note" },
              "Input state ",
              n(ctx, state.draw, formatCount, "draw"),
              " of ",
              n(ctx, source.S, formatCount),
              "; retained prefix ",
              n(ctx, retained.E.S, formatCount, "prefix"),
              ".",
            ),
          );
          stateNote.replaceChildren(
            state.draw <= state.prefix ? "This state is included in the retained prefix. " : "This state is outside the retained prefix. ",
            state.mode === "original" ? "Original pairing. " : state.mode === "all" ? "All units move together. " : "Only the selected unit moves. ",
          );
          renderOrderPlots(model);

          const stateRows = source.ids.map((id, u) => {
            const sourceIndex =
              state.mode !== "original" && (state.mode === "all" || u === model.unit)
                ? (selected.draw + model.input.shift) % source.S
                : selected.draw;
            return {
              id,
              u,
              sourceDraw: source.drawIndex.draw[sourceIndex],
              a: selected.state[u][0],
              b: selected.state[u][1],
            };
          });
          stateTable.replaceChildren(
            table(
              ctx,
              "Current whole-state coordinates and the original source row of each unit",
              [
                { label: "Unit", value: "id", name: true },
                { label: "Source row", value: "sourceDraw", format: formatCount, hook: (r) => `input-source-${r.u}` },
                { label: "need_A", value: "a", format: decimal, hook: (r) => `input-state-${r.u}-0` },
                { label: "need_B", value: "b", format: decimal, hook: (r) => `input-state-${r.u}-1` },
              ],
              stateRows,
            ),
          );

          pairSummary.replaceChildren(
            "Current state’s wrong-direction indicators for ",
            ...directionNodes(ctx, source.ids, direction),
            ": ",
            ...source.criteria.flatMap((c, k) => [
              ...(k ? ["; "] : []),
              name(ctx, c),
              " = ",
              n(ctx, selected.counts[k][i][j], formatCount, `selected-error-${k}`),
            ]),
            ".",
          );

          const allPairs = source.criteria.flatMap((c, k) =>
            CONFIG.pairs.flatMap(([a, b]) =>
              [
                [a, b],
                [b, a],
              ].map(([u, v]) => ({
                criterion: c,
                k,
                i: u,
                j: v,
                direction: `${source.ids[u]} above ${source.ids[v]}`,
                count: retained.counts[k][u][v],
                share: retained.E.e[k][u][v],
                original: baseline.counts[k][u][v],
                originalShare: baseline.E.e[k][u][v],
              })),
            ),
          );
          pairTable.replaceChildren(
            table(
              ctx,
              "Both oriented directions for every pair, at the retained prefix",
              [
                { label: "Criterion", value: "criterion" },
                { label: "Direction", value: "direction", name: true },
                { label: "Wrong count", value: "count", format: formatCount, hook: (r) => `pair-${r.k}-${r.i}-${r.j}-count` },
                { label: "Empirical share", value: "share", format: formatShare, hook: (r) => `pair-${r.k}-${r.i}-${r.j}-share` },
                { label: "Original count", value: "original", format: formatCount },
                { label: "Original share", value: "originalShare", format: formatShare },
              ],
              allPairs,
            ),
          );

          const allPrefixes = model.prefixes.flatMap((p) =>
            source.criteria.flatMap((c, k) =>
              CONFIG.pairs.flatMap(([a, b]) =>
                [
                  [a, b],
                  [b, a],
                ].map(([u, v]) => ({
                  prefix: p.prefix,
                  criterion: c,
                  k,
                  i: u,
                  j: v,
                  direction: `${source.ids[u]} above ${source.ids[v]}`,
                  count: p.counts[k][u][v],
                  share: p.E.e[k][u][v],
                })),
              ),
            ),
          );
          curveTable.replaceChildren(
            table(
              ctx,
              "All retained-prefix counts for the selected pair and criterion",
              [
                { label: "States S", value: "prefix", format: formatCount },
                { label: "Current wrong count", value: "count", format: formatCount },
                { label: "Current share", value: "share", format: formatShare },
                { label: "Original wrong count", value: "originalCount", format: formatCount },
                { label: "Original share", value: "baseline", format: formatShare },
              ],
              rows,
            ),
          );
          const complete = hiddenTable(ctx.doc, {
            caption: "All prefix, criterion and oriented-pair counts",
            columns: columns([
              { label: "States", value: "prefix", format: formatCount },
              { label: "Criterion", value: "criterion" },
              { label: "Direction", value: "direction" },
              { label: "Wrong count", value: "count", format: formatCount },
              { label: "Empirical share", value: "share", format: formatShare },
            ]),
            rows: allPrefixes,
          });
          complete.querySelectorAll("tbody tr").forEach((tr, rIdx) => {
            const d = allPrefixes[rIdx];
            tr.cells[2].setAttribute("data-prx-name", "");
            tr.cells[3].setAttribute("data-prx-readout", `prefix-${d.prefix}-${d.k}-${d.i}-${d.j}-count`);
            tr.cells[4].setAttribute("data-prx-readout", `prefix-${d.prefix}-${d.k}-${d.i}-${d.j}-share`);
          });
          curveTable.append(complete);

          drawOriginal(model);

          ctx.caption.replaceChildren(
            "The package toy’s actual ",
            n(ctx, source.S, formatCount),
            " complete IID states. Synthetic: no real units, observations or fitted models. Data license CC BY ",
            n(ctx, 4, (v) => formatDecimal(v, { digits: 1 })),
            ".",
          );
          provenanceLine.replaceChildren(
            "Original source values and row labels retained. ",
            state.mode === "original" ? "Original pairing." : "Cyclic re-pairing is a dependence illustration, not a new posterior simulation.",
          );
        },
      };
    },
  });
}
