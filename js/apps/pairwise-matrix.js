export * from "../shared/domain/pairwise-matrix.js";

// App entry point for pairwise-matrix (1.13: "All pairs at once", Frame v2 Polish).
// Preserves 100% of ../shared/domain/pairwise-matrix.js exports untouched (S1-02, generic-probability-matrix.test.mjs).
import { appLink, createWidget } from "../shared/base.js";
import { labelOn, numText, plot } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatProb,
  formatSci,
  formatSetting,
  setNum,
} from "../shared/format.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
import { LEAGUE_SEED, league30, normalPdf, pairDifference } from "../pr-core.js";
import {
  CONFIG,
  blueStep,
  cellKey,
  cssFor,
  dataset,
  densityFrame,
  densityPoints,
  fill,
  fillText,
  leastInOrder,
  leastView,
  orderOf,
  parseCell,
  resolveCell,
  stepsApart,
} from "../shared/domain/pairwise-matrix.js";

const T = CONFIG.text;
const D = CONFIG.density;
const LEAGUE = league30();
const SVG_NS = "http://www.w3.org/2000/svg";
const PIN_SKIP = /^(?:width|height|viewBox|role|aria-[\w-]+|id|tabindex)$/;

const V2_MATRIX = Object.freeze({
  six: Object.freeze({
    minCell: 42,
    maxCell: 56,
    maxCellNarrow: 42,
    font: 13,
    labelFont: 13.5,
    digits: 3,
    marginTop: 24,
    marginLeft: 32,
    rotate: 0,
  }),
  league: Object.freeze({
    minCell: 32,
    maxCell: 36,
    font: 12,
    labelFont: 13,
    digits: 2,
    marginTop: 42,
    marginLeft: 44,
    rotate: -90,
  }),
  marginRight: 4,
  marginBottom: 4,
  labelGap: 6,
  inset: 0.5,
  halo: 2.5,
});

const V2_DENSITY = Object.freeze({
  minLabelPx: 32,
  labelDx: 4,
  height: 168,
  heightNarrow: 152,
  marginBottom: 42,
  labelOffset: 36,
});

const V2_CSS = `
.prx-pm .prx-pm-scroll-inner { width: max-content; }
.prx-pm .prx-pm-pin { position: sticky; left: 0; z-index: 2; height: 0; }
.prx-pm .prx-pm-pin > svg { position: absolute; top: 0; left: 0; display: block; max-width: none; pointer-events: auto; }
.prx-pm .prx-pm-scroll.prx-pm-sticky-rows[data-prx-overflow="start"] .prx-pm-pin > svg,
.prx-pm .prx-pm-scroll.prx-pm-sticky-rows[data-prx-overflow="both"] .prx-pm-pin > svg {
  box-shadow: 6px 0 6px -5px color-mix(in srgb, var(--prx-plot-fg) 40%, transparent);
}
/* PR-01: reset legacy @container grid-area rules from cssFor("prx-pm") inside Frame v2 */
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-matrix,
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-pair,
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-least {
  grid-area: auto;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-toolbar {
  gap: 0.35rem 0.65rem;
  margin-bottom: 0.4rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-data {
  column-gap: 0.65rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
  padding: 0.2rem 0.52rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.4rem;
  align-items: flex-end;
  width: 100%;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage {
  container-type: inline-size;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.25rem 0.9rem;
  margin: 0 0 0.5rem;
  padding: 0 0 0.35rem;
  border-bottom: 1px solid var(--prx-border);
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-stage-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-cue {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem 1.25rem;
  align-items: start;
  min-width: 0;
}
@container (min-width: 44rem) {
  .prx-pm.prx-widget[data-prx-frame="v2"][data-prx-data="six"] .prx-stage .prx-pm-stage-grid {
    grid-template-columns: minmax(0, auto) minmax(18rem, 1fr);
  }
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-legend {
  font-size: 0.8125rem;
  line-height: 1.35;
  gap: 0.22rem 0.6rem;
  margin: 0.35rem 0 0;
  padding: 0.28rem 0.45rem;
  border: 1px solid var(--prx-border);
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-legend-title {
  flex: 0 0 auto;
  margin-right: 0.2rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-tip {
  font-size: 0.8125rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-units p {
  font-size: 0.875rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.6rem;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-method-stack .prx-pm-detail {
  margin: 0;
}
.prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-method-stack .prx-pm-note {
  margin: 0;
  color: var(--prx-fg-muted);
}
  @media (max-width: 30em) {
  .prx-pm.prx-widget[data-prx-frame="v2"] { padding: 0.4rem 0.5rem 0.35rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.2rem 0.4rem; margin-bottom: 0.25rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-data { column-gap: 0.45rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-data > .prx-radio { font-size: 0.78rem; gap: 0.22rem; margin-right: 0; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.2rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.12rem 0.38rem; font-size: 0.79rem; line-height: 1.2; }
  .prx-pm.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.3rem; padding: 0.22rem 0.42rem; font-size: 0.85rem; line-height: 1.3; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.35rem 0.45rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-stage-head { margin-bottom: 0.35rem; padding-bottom: 0.25rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-stage .prx-pm-stage-grid { gap: 0.55rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-legend { gap: 0.15rem 0.45rem; margin-top: 0.25rem; padding: 0.22rem 0.35rem; line-height: 1.25; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-heading { margin-bottom: 0.2rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-units p { margin-top: 0.1rem; font-size: 0.84rem; line-height: 1.28; }
  .prx-pm.prx-widget[data-prx-frame="v2"] .prx-pm-density-chart { margin-top: 0.3rem; }
  .prx-pm.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.45rem; gap: 0.35rem; }
}
`;

const fmtPi = (p, options = {}) => formatProb(p, { ...options, open: true });
const groupOf = (i) => LEAGUE.group[i];
const unitLabel = (d, i) => (d.data === "league" ? `${d.ids[i]}${T.groupSuffix[groupOf(i)]}` : d.ids[i]);
const nameNodeOf = (ctx) => (id) => ctx.h("span", { "data-prx-name": id, text: id });

function cellTitle(d, c) {
  return c.diagonal
    ? fillText(T.tipDiagonal, { row: unitLabel(d, c.i) })
    : fillText(T.tipCell, {
        rowLabel: unitLabel(d, c.i),
        colLabel: unitLabel(d, c.j),
        row: d.ids[c.i],
        col: d.ids[c.j],
        pi: fmtPi(c.pi),
      });
}

function v2SpreadLabels(labels, [lo, hi], innerWidth) {
  const out = labels.map((l) => ({ ...l, dx: 0, anchor: "middle" })).sort((a, b) => a.x - b.x);
  for (let k = 1; k < out.length; k += 1) {
    const gap = ((out[k].x - out[k - 1].x) / (hi - lo)) * innerWidth;
    if (gap < V2_DENSITY.minLabelPx) {
      out[k - 1].dx = -V2_DENSITY.labelDx;
      out[k - 1].anchor = "end";
      out[k].dx = V2_DENSITY.labelDx;
      out[k].anchor = "start";
    }
  }
  return out;
}

function formatTableVal(v, digits) {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
}

function compactLegendNodes(ctx) {
  const { h } = ctx;
  const cuts = CONFIG.blueCuts;
  const range = (k) => {
    if (k === 0) return [`${T.below} `, ctx.num(cuts[0], formatSetting(cuts[0]))];
    if (k === cuts.length) return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), ` ${T.andAbove}`];
    return [ctx.num(cuts[k - 1], formatSetting(cuts[k - 1])), "–", ctx.num(cuts[k], formatSetting(cuts[k]))];
  };
  const items = [h("span", { class: "prx-pm-legend-title", text: T.legendTitle })];
  for (let k = 0; k <= cuts.length; k += 1) {
    items.push(
      h(
        "span",
        { class: "prx-pm-key" },
        h("span", { class: "prx-pm-swatch", style: { background: `var(--prx-blues-${k + 1})` } }),
        h("span", {}, ...range(k)),
      ),
    );
  }
  items.push(
    h("span", { class: "prx-pm-key" }, h("span", { class: "prx-pm-swatch prx-pm-swatch-diagonal" }), "diagonal"),
    h("span", { class: "prx-pm-key" }, h("span", { class: "prx-pm-swatch prx-pm-swatch-sel" }), "selected"),
    h("span", { class: "prx-pm-key" }, h("span", { class: "prx-pm-swatch prx-pm-swatch-mirror" }), "mirror"),
  );
  return items;
}

function v2MatrixView(ctx, { onFocus } = {}) {
  const { h } = ctx;
  const nameNode = nameNodeOf(ctx);
  const orderNote = h("p", { class: "prx-pm-note prx-pm-order-note", "data-prx-part": "notes" });
  const slot = h("div", { class: "prx-pm-matrix-chart" });
  const pin = h("div", { class: "prx-pm-pin", "aria-hidden": "true", hidden: true });
  const scrollBox = h("div", { class: "prx-pm-scroll prx-pm-sticky-rows" }, h("div", { class: "prx-pm-scroll-inner" }, pin, slot));
  const scrollNote = h("p", { class: "prx-hint prx-pm-scroll-note", "data-prx-part": "notes", text: T.scrollNote, hidden: true });
  const legend = h("div", { class: "prx-pm-legend", "data-prx-part": "legend" }, ...compactLegendNodes(ctx));
  const root = h("section", { class: "prx-pm-matrix", "aria-label": CONFIG.title }, scrollBox, scrollNote, legend);

  const overlay = {
    sel: h("div", { class: "prx-pm-mark prx-pm-mark-sel", "aria-hidden": "true", hidden: true }),
    mirror: h("div", { class: "prx-pm-mark prx-pm-mark-mirror", "aria-hidden": "true", hidden: true }),
    hover: h("div", { class: "prx-pm-mark prx-pm-mark-hover", "aria-hidden": "true", hidden: true }),
    tip: h("div", { class: "prx-pm-tip", "aria-hidden": "true", hidden: true }),
  };

  let geom = null;
  let drawnData = null;
  const pct = (v, total) => `${(v / total) * CONFIG.percent}%`;
  const keyboardKey = (c) => `${c.row}|${c.col}`;
  const valueText = (spec, pi) => fmtPi(pi, { digits: spec.digits, bounds: "symbols" });
  const orderWordsOf = (state) => (state.sort === "label" ? T.tableOrderLabel : T.tableOrderMean);
  const captionOf = (state) => fillText(T.tableCaption, { order: orderWordsOf(state) });

  function place(node, ri, ci) {
    const g = geom;
    node.style.left = pct(g.marginLeft + ci * g.cell, g.width);
    node.style.top = pct(g.mt + ri * g.cell, g.height);
    node.style.width = pct(g.cell, g.width);
    node.style.height = pct(g.cell, g.height);
  }

  function overlays(selection, hovered) {
    const g = geom;
    if (!g || !g.area) {
      for (const n of Object.values(overlay)) n.hidden = true;
      return;
    }
    if (overlay.sel.parentNode !== g.area) g.area.append(overlay.mirror, overlay.sel, overlay.hover, overlay.tip);
    const at = (i, j) => [g.pos[i], g.pos[j]];
    if (selection) {
      place(overlay.sel, ...at(selection.i, selection.j));
      overlay.sel.hidden = false;
      if (selection.i !== selection.j) {
        place(overlay.mirror, ...at(selection.j, selection.i));
        overlay.mirror.hidden = false;
      } else {
        overlay.mirror.hidden = true;
      }
    } else {
      overlay.sel.hidden = true;
      overlay.mirror.hidden = true;
    }
    const hov = hovered && !(selection && hovered.i === selection.i && hovered.j === selection.j) ? hovered : null;
    if (hov) {
      place(overlay.hover, ...at(hov.i, hov.j));
      overlay.hover.hidden = false;
    } else {
      overlay.hover.hidden = true;
    }
    if (hovered) {
      const d = g.d;
      const [ri, ci] = at(hovered.i, hovered.j);
      const c = g.cells[ri * g.n + ci];
      overlay.tip.replaceChildren(
        ...(c.diagonal
          ? [fillText(T.tipDiagonal, { row: d.ids[c.i] })]
          : [nameNode(d.ids[c.i]), " above ", nameNode(d.ids[c.j]), ": ", ctx.num(c.pi, fmtPi(c.pi))]),
      );
      const right = ci > g.n / 2;
      const low = ri > g.n / 2;
      overlay.tip.style.left = pct(g.marginLeft + (right ? ci : ci + 1) * g.cell, g.width);
      overlay.tip.style.top = pct(g.mt + (low ? ri : ri + 1) * g.cell, g.height);
      overlay.tip.style.transform = `translate(${right ? "-100%" : "0"}, ${low ? "-100%" : "0"})`;
      overlay.tip.hidden = false;
    } else {
      overlay.tip.hidden = true;
    }
  }

  const cellsOf = (d, order) => {
    const cells = [];
    for (const r of order) {
      for (const c of order) {
        cells.push({ i: r, j: c, row: d.ids[r], col: d.ids[c], diagonal: r === c, pi: r === c ? null : d.pi[r][c] });
      }
    }
    return cells;
  };

  function shapeOf(d, avail) {
    const spec = V2_MATRIX[d.data];
    const n = d.n;
    const marginLeft = spec.marginLeft;
    const mt = spec.marginTop;
    const fitted = Math.floor((avail - marginLeft - V2_MATRIX.marginRight) / n);
    const maxCell = avail < 380 && spec.maxCellNarrow ? spec.maxCellNarrow : spec.maxCell;
    const cell = Math.max(spec.minCell, Math.min(maxCell, fitted));
    const width = marginLeft + V2_MATRIX.marginRight + n * cell;
    const height = mt + V2_MATRIX.marginBottom + n * cell;
    return { spec, n, cell, width, mt, height, marginLeft, overflow: width > avail + 1 };
  }

  function setScrolls(on) {
    scrollBox.classList.toggle("prx-pm-scrolls", on);
    scrollNote.hidden = !on;
    if (on && !scrollBox.hasAttribute("tabindex")) {
      ctx.scrollRegion(scrollBox, T.scrollLabel, { stickyLabels: true });
    }
    if (!on && scrollBox.hasAttribute("tabindex")) {
      for (const a of ["tabindex", "role", "aria-label"]) scrollBox.removeAttribute(a);
      scrollBox.classList.remove("prx-scroll-region");
    }
  }

  function pinRows() {
    const g = geom;
    const labels = g?.parts?.rowLabels?.g ?? null;
    if (!g?.svg || !labels || !scrollBox.classList.contains("prx-pm-scrolls")) {
      if (pin.firstChild) pin.replaceChildren();
      pin.hidden = true;
      scrollBox.style.removeProperty("scroll-padding-left");
      return;
    }
    const copy = ctx.doc.createElementNS(SVG_NS, "svg");
    for (const a of Array.from(g.svg.attributes)) if (!PIN_SKIP.test(a.name)) copy.setAttribute(a.name, a.value);
    copy.setAttribute("width", String(g.marginLeft));
    copy.setAttribute("height", String(g.height));
    copy.setAttribute("viewBox", `0 0 ${g.marginLeft} ${g.height}`);
    copy.setAttribute("aria-hidden", "true");
    copy.style.width = `${g.marginLeft}px`;
    copy.style.height = `${g.height}px`;
    copy.style.background = "var(--prx-plot-bg)";
    copy.append(labels.cloneNode(true));
    pin.style.width = `${g.marginLeft}px`;
    pin.replaceChildren(copy);
    pin.hidden = false;
    scrollBox.style.scrollPaddingLeft = `${g.marginLeft}px`;
  }

  function clampTip() {
    const col = !pin.hidden ? pin.firstElementChild : null;
    const tip = slot.querySelector(".prx-kbd-tip");
    if (!col || !tip || tip.hidden) return;
    const edge = col.getBoundingClientRect().right;
    const r = tip.getBoundingClientRect();
    if (!(r.width > 0) || r.left >= edge - 0.5) return;
    tip.style.maxWidth = `${Math.max(1, Math.floor(r.right - edge))}px`;
  }
  const afterTip = (fn) => (typeof ctx.win.queueMicrotask === "function" ? ctx.win.queueMicrotask(fn) : Promise.resolve().then(fn));

  function syncStop(selection) {
    const g = geom;
    if (!g || !g.buttons?.length || !selection) return;
    const active = ctx.doc.activeElement;
    if (active && g.buttons.includes(active)) return;
    const k = g.pos[selection.i] * g.n + g.pos[selection.j];
    if (!g.buttons[k]) return;
    for (const b of g.buttons) if (b.tabIndex !== -1) b.tabIndex = -1;
    g.buttons[k].tabIndex = 0;
  }

  function updateInPlace(state, d, order) {
    const g = geom;
    const { n, pal, parts, spec } = g;
    const pos = [];
    order.forEach((u, k) => { pos[u] = k; });
    const ids = order.map((u) => d.ids[u]);
    for (let ri = 0; ri < n; ri += 1) {
      for (let ci = 0; ci < n; ci += 1) {
        const c = g.cells[ri * n + ci];
        c.i = order[ri];
        c.j = order[ci];
        c.row = ids[ri];
        c.col = ids[ci];
        c.pi = c.diagonal ? null : d.pi[c.i][c.j];
      }
    }
    const rects = parts.off.g.children;
    const texts = parts.text.g.children;
    parts.off.index.forEach((m, k) => {
      const c = g.cells[g.offPos[m]];
      const f = pal.blues[blueStep(c.pi) - 1];
      if (rects[k] && rects[k].getAttribute("fill") !== f) rects[k].setAttribute("fill", f);
    });
    parts.text.index.forEach((m, k) => {
      const c = g.cells[g.offPos[m]];
      const t = texts[k];
      if (!t) return;
      const f = pal.blues[blueStep(c.pi) - 1];
      const shown = valueText(spec, c.pi);
      if (t.textContent !== shown) t.textContent = shown;
      t.setAttribute("data-num", dataNum(c.pi));
      if (t.getAttribute("stroke") !== f) {
        t.setAttribute("stroke", f);
        t.setAttribute("fill", labelOn(f, pal));
      }
    });
    for (const lab of [parts.colLabels, parts.rowLabels]) {
      const nodes = lab.g.querySelectorAll("text");
      lab.index.forEach((m, k) => {
        const t = nodes[k];
        if (!t || t.textContent === ids[m]) return;
        t.textContent = ids[m];
        t.setAttribute("data-prx-name", ids[m]);
      });
    }
    g.buttons.forEach((b, k) => {
      const c = g.cells[k];
      b.setAttribute("aria-label", cellTitle(d, c).replace(/\s*\n\s*/g, ", "));
      b.setAttribute("data-prx-focus-key", `${g.focusPrefix}${keyboardKey(c)}`);
    });
    const tbl = g.table;
    if (tbl) {
      const cap = tbl.querySelector("caption");
      if (cap) cap.textContent = captionOf(state);
      const head = tbl.querySelectorAll("thead th");
      ids.forEach((id, k) => { if (head[k + 1]) head[k + 1].textContent = id; });
      tbl.querySelectorAll("tbody tr").forEach((tr, ri) => {
        const cellsRow = tr.children;
        if (cellsRow[0]) cellsRow[0].textContent = ids[ri];
        for (let ci = 0; ci < n; ci += 1) {
          const td = cellsRow[ci + 1];
          if (!td || ri === ci) continue;
          const pi = d.pi[order[ri]][order[ci]];
          setNum(td, pi, fmtPi(pi));
        }
      });
    }
    g.d = d;
    g.pos = pos;
  }

  function draw(state, d, order, { avail, inPlace = false, selection = null, hovered = null } = {}) {
    drawnData = d;
    const sh = shapeOf(d, avail);
    const { spec, n, cell, width, mt, height, marginLeft } = sh;
    const key = [d.data, n, cell, width, height].join("|");
    if (inPlace && geom && geom.key === key && geom.parts) {
      updateInPlace(state, d, order);
      pinRows();
      overlays(selection, hovered);
      syncStop(selection);
      return;
    }
    slot.style.width = `${width}px`;
    setScrolls(sh.overflow);
    const ids = order.map((u) => d.ids[u]);
    const pos = [];
    order.forEach((u, k) => { pos[u] = k; });
    const cells = cellsOf(d, order);
    const offPos = [];
    cells.forEach((x, k) => { if (!x.diagonal) offPos.push(k); });
    const parts = {};
    const keep = (name, inner) => (index, scales, values, dims, context, next) => {
      const g = inner ? inner(index, scales, values, dims, context, next) : next(index, scales, values, dims, context);
      parts[name] = { g, index: Array.from(index) };
      return g;
    };
    const tagNames = (rows) => (index, scales, values, dims, context, next) => {
      const g = next(index, scales, values, dims, context);
      const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
      Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-name", rows[i]));
      return g;
    };
    const handle = plot(slot, {
      alt: fillText(T.matrixAlt, { size: T.sizeWords[d.data] }),
      table: {
        caption: captionOf(state),
        columns: [
          { label: T.colRow, value: "id" },
          ...order.map((c) => ({
            label: d.ids[c],
            value: (row) => (row.u === c ? null : d.pi[row.u][c]),
            format: (v) => (v === null ? T.sameUnit : fmtPi(v)),
          })),
        ],
        rows: order.map((u) => ({ id: d.ids[u], u })),
      },
      width,
      height,
      aspect: false,
      marginTop: mt,
      marginLeft,
      marginRight: V2_MATRIX.marginRight,
      marginBottom: V2_MATRIX.marginBottom,
      x: { domain: ids, padding: 0, axis: null },
      y: { domain: ids, padding: 0, axis: null },
      color: { type: "identity" },
      marks: (c, P) => {
        const inks = new Map(c.blues.map((f) => [f, labelOn(f, c)]));
        const off = offPos.map((k) => {
          const x = cells[k];
          const f = c.blues[blueStep(x.pi) - 1];
          return { ...x, fill: f, ink: inks.get(f) };
        });
        const diag = cells.filter((x) => x.diagonal);
        return [
          P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, stroke: c.cellBorder, strokeWidth: 1, inset: V2_MATRIX.inset }),
          P.cell(off, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: V2_MATRIX.inset, render: keep("off") }),
          numText(off, {
            x: "col",
            y: "row",
            value: "pi",
            format: (v) => valueText(spec, v),
            fill: "ink",
            stroke: "fill",
            strokeWidth: V2_MATRIX.halo,
            paintOrder: "stroke",
            fontSize: spec.font,
            render: keep("text"),
          }),
          P.text(ids, {
            x: (v) => v,
            frameAnchor: "top",
            dy: -V2_MATRIX.labelGap,
            fill: c.plotFg,
            rotate: spec.rotate,
            ...(spec.rotate ? { textAnchor: "start", lineAnchor: "middle" } : { lineAnchor: "bottom" }),
            fontSize: spec.labelFont,
            fontWeight: "bold",
            render: keep("colLabels", tagNames(ids)),
          }),
          P.text(ids, {
            y: (v) => v,
            frameAnchor: "left",
            dx: -V2_MATRIX.labelGap,
            textAnchor: "end",
            fill: c.plotFg,
            fontSize: spec.labelFont,
            fontWeight: "bold",
            render: keep("rowLabels", tagNames(ids)),
          }),
        ];
      },
      keyboard: {
        data: cells,
        x: "col",
        y: "row",
        key: keyboardKey,
        sort: false,
        columns: n,
        label: T.keyboardLabel,
        title: (x) => cellTitle(drawnData ?? d, x),
        onFocus: (x) => {
          onFocus?.(x);
          afterTip(clampTip);
        },
      },
    });
    const buttons = [...handle.area.querySelectorAll(".prx-kbd-point")];
    const first = buttons[0]?.getAttribute("data-prx-focus-key") ?? "";
    const focusPrefix = first.slice(0, first.length - keyboardKey(cells[0]).length);
    const complete = parts.off && parts.text && parts.colLabels && parts.rowLabels && buttons.length === cells.length;
    geom = {
      d,
      n,
      cell,
      mt,
      width,
      height,
      marginLeft,
      cells,
      offPos,
      pos,
      area: handle.area,
      svg: handle.svg,
      key,
      spec,
      pal: handle.palette,
      parts: complete ? parts : null,
      buttons,
      focusPrefix,
      table: handle.table?.querySelector?.("table") ?? null,
    };
    pinRows();
    overlays(selection, hovered);
    syncStop(selection);
  }

  function cellAt(ev) {
    const g = geom;
    if (!g || !g.svg?.getBoundingClientRect) return null;
    const r = g.svg.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    const x = (ev.clientX - r.left) * (g.width / r.width);
    const y = (ev.clientY - r.top) * (g.height / r.height);
    const ci = Math.floor((x - g.marginLeft) / g.cell);
    const ri = Math.floor((y - g.mt) / g.cell);
    if (ci < 0 || ri < 0 || ci >= g.n || ri >= g.n) return null;
    return g.cells[ri * g.n + ci];
  }

  function note(state, d) {
    orderNote.replaceChildren(
      state.sort === "label" ? T.orderLabel : T.orderMean,
      ...(d.data === "six" && state.sort === "label" ? [" ", T.sameOrder] : []),
    );
  }

  function reveal(selection) {
    const g = geom;
    if (!g || !selection || !scrollBox.classList.contains("prx-pm-scrolls")) return;
    const x0 = g.marginLeft + g.pos[selection.j] * g.cell;
    const left = scrollBox.scrollLeft;
    const w = scrollBox.clientWidth;
    if (!(w > 0)) return;
    const pad = !pin.hidden ? g.marginLeft : 0;
    if (x0 < left + pad || x0 + g.cell > left + w) scrollBox.scrollLeft = Math.max(0, x0 - pad - (w - pad - g.cell) / 2);
  }

  const scrollToSelected = () => {
    if (!overlay.sel.hidden) overlay.sel.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  return { root, slot, scrollBox, orderNote, draw, overlays, syncStop, cellAt, note, reveal, scrollToSelected };
}

function v2PairView(ctx) {
  const { h } = ctx;
  const nameNode = nameNodeOf(ctx);
  const hookNum = (name, raw, display) => {
    const n = ctx.num(raw, display);
    n.setAttribute("data-prx-readout", name);
    return n;
  };
  const heading = h("h4", { class: "prx-pm-heading", text: T.pairHeading });
  const status = h("p", { class: "prx-pm-status", "data-prx-part": "readout" });
  const units = h("div", { class: "prx-pm-units", "data-prx-part": "readout" });
  const densSlot = h("div", { class: "prx-pm-density-chart" });
  const sameNote = h("p", { class: "prx-pm-note", text: T.diagonalNote, hidden: true });
  const root = h("section", { class: "prx-pm-pair", "aria-label": T.pairHeading }, heading, status, units, densSlot, sameNote);

  // Method disclosure formula & explanatory blocks (rendered eagerly so readout/preserve checks inspect them closed)
  const ticksNote = h("p", { class: "prx-pm-note", "data-prx-part": "notes", text: T.ticksNote });
  const texWorked = h("div", { class: "prx-pm-tex", "data-prx-tex": "worked" });
  const zName = () => h("i", { text: "z" });
  const workedNote = h(
    "p",
    { class: "prx-pm-note prx-pm-worked-note" },
    T.workedScope,
    " Φ(",
    zName(),
    T.glossPhiA,
    ctx.num(0, formatSetting(0)),
    T.glossPhiB,
    ctx.num(1, formatSetting(1)),
    T.glossPhiC,
    zName(),
    ".",
  );
  const texMirror = h("div", { class: "prx-pm-tex", "data-prx-tex": "mirror" });
  const mirrorHead = h("p", { class: "prx-pm-mirror-head" });
  const mirrorNote = h("p", { class: "prx-pm-note", text: T.mirrorNote });
  const mirrorBox = h("div", { class: "prx-pm-mirror" }, mirrorHead, texMirror, mirrorNote);
  const detail = h("div", { class: "prx-pm-detail" }, texWorked, workedNote, mirrorBox);

  let stamp = null;
  let timer = 0;
  const cancel = () => {
    if (timer) ctx.win.clearTimeout(timer);
    timer = 0;
    root.removeAttribute("aria-busy");
  };
  const defer = (redraw) => {
    cancel();
    root.setAttribute("aria-busy", "true");
    timer = ctx.win.setTimeout(() => {
      timer = 0;
      root.removeAttribute("aria-busy");
      redraw();
    }, CONFIG.pairDeferMs);
  };
  ctx.onCleanup(() => {
    if (timer) ctx.win.clearTimeout(timer);
    timer = 0;
  });

  function draw(d, order, cell, { hovered = false, measured } = {}) {
    if (!cell) return;
    const densW = measured ?? densSlot.clientWidth;
    const { i, j } = cell;
    const s = `${d.data}|${d.priorSd ?? ""}|${i},${j}|${hovered ? "h" : "s"}|${order.join(",")}|${densW}`;
    if (s === stamp) return;
    stamp = s;
    const frame = densityFrame(d);
    const [lo, hi] = frame.x;
    const width = Math.max(1, Math.round(densW || root.clientWidth || ctx.width()));
    const inner = Math.max(1, width - D.marginLeft - D.marginRight);
    const digits = CONFIG.digits[d.data];
    const mean = (x) => formatDecimal(x, { digits: digits.mean });
    const sd = (x) => formatDecimal(x, { digits: digits.sd });
    const tblMean = (x) => formatTableVal(x, digits.mean);
    const tblSd = (x) => formatTableVal(x, digits.sd);
    const same = i === j;
    const steps = same ? null : stepsApart(order, cell);

    status.replaceChildren(
      `${hovered ? T.hovered : T.selected}: ${T.rowWord} `,
      nameNode(d.ids[i]),
      `, ${T.colWord} `,
      nameNode(d.ids[j]),
      ...(steps === null ? [] : steps === 1 ? [T.statusNext] : [", ", ctx.num(steps, formatCount(steps)), T.statusFar]),
      ".",
    );

    const unitLine = (role, u, hook) => {
      const slots = {
        id: nameNode(d.ids[u]),
        mean: hookNum(`${hook}-mean`, d.mean[u], mean(d.mean[u])),
        sd: hookNum(`${hook}-sd`, d.sd[u], sd(d.sd[u])),
      };
      if (d.data === "league") {
        slots.group = T.groupWord[groupOf(u)];
        slots.obs = ctx.num(LEAGUE.size[u], formatCount(LEAGUE.size[u]));
        slots.se = ctx.num(LEAGUE.se[u], formatDecimal(LEAGUE.se[u], { digits: CONFIG.digits.league.se }));
      }
      return h(
        "p",
        { class: "prx-pm-unit" },
        h("span", { class: "prx-pm-role", text: `${role}. ` }),
        ...fill(d.data === "league" ? T.leagueLine : T.unitLine, slots),
      );
    };
    units.replaceChildren(unitLine(T.rowRole, i, "row"), ...(same ? [] : [unitLine(T.colRole, j, "col")]));

    const show = same ? [i] : [i, j];
    const curves = show.map((u, k) => ({ k, pts: densityPoints(d.mean[u], d.sd[u], lo, hi) }));
    const labels = v2SpreadLabels(
      show.map((u) => ({ x: d.mean[u], y: normalPdf(0) / d.sd[u], text: d.ids[u] })),
      frame.x,
      inner,
    );
    const rug = d.ids.map((_, u) => ({ x: d.mean[u], on: show.includes(u) }));
    const peaks = show.map((u, k) => ({
      id: d.ids[u],
      m: d.mean[u],
      s: d.sd[u],
      y: normalPdf(0) / d.sd[u],
      role: k === 0 ? T.rowRole : T.colRole,
      line: same ? "" : k === 0 ? T.densityLine.row : T.densityLine.col,
    }));

    plot(densSlot, {
      alt: same ? fillText(T.densityAltSame, { row: d.ids[i] }) : fillText(T.densityAlt, { row: d.ids[i], col: d.ids[j] }),
      table: {
        caption: T.densityTable,
        columns: [
          { label: T.colUnit, value: "id" },
          { label: T.colMean, value: "m", format: tblMean },
          { label: T.colSd, value: "s", format: tblSd },
        ],
        rows: show.map((u) => ({ id: d.ids[u], m: d.mean[u], s: d.sd[u] })),
      },
      width,
      height: width < 380 ? V2_DENSITY.heightNarrow : V2_DENSITY.height,
      aspect: false,
      marginTop: D.marginTop,
      marginBottom: V2_DENSITY.marginBottom,
      marginLeft: D.marginLeft,
      marginRight: D.marginRight,
      x: { domain: frame.x, label: T.xLabel, labelAnchor: "center", labelArrow: "none", labelOffset: V2_DENSITY.labelOffset },
      y: { domain: [0, frame.ymax], label: T.yLabel, ticks: D.yTicks },
      color: { type: "identity" },
      marks: (c, P) => [
        P.ruleY([0], { stroke: c.plotAxis }),
        P.ruleX(rug.filter((r) => !r.on), { x: "x", y1: 0, y2: D.rug * frame.ymax, stroke: c.plotMuted, strokeWidth: D.rugWidth }),
        P.ruleX(rug.filter((r) => r.on), { x: "x", y1: 0, y2: D.rug * frame.ymax, stroke: c.post, strokeWidth: D.rugOn }),
        ...curves.map((cv) =>
          P.lineY(cv.pts, { x: "x", y: "y", stroke: c.post, strokeWidth: D.line, strokeDasharray: cv.k === 1 ? D.dash : undefined }),
        ),
        ...labels.map((l) =>
          P.text([l], {
            x: "x",
            y: "y",
            text: "text",
            dx: l.dx,
            dy: D.labelDy,
            textAnchor: l.anchor,
            fill: c.plotFg,
            fontWeight: "bold",
            stroke: c.plotBg,
            strokeWidth: V2_MATRIX.halo,
            paintOrder: "stroke",
            render: (index, scales, values, dims, context, next) => {
              const g = next(index, scales, values, dims, context);
              g?.querySelector?.("text")?.setAttribute("data-prx-name", l.text);
              return g;
            },
          }),
        ),
      ],
      keyboard: {
        data: peaks,
        x: "m",
        y: "y",
        sort: false,
        label: T.densityKeyboard,
        title: (p) => fillText(T.densityPoint, { role: p.role, id: p.id, line: p.line, mean: mean(p.m), sd: sd(p.s) }),
      },
    });

    sameNote.hidden = !same;
    detail.hidden = same;
    if (same) return;

    const tid = (id) => (id.length > 1 ? id.replace(/^([A-Za-z]+)(\d+)$/, "\\mathrm{$1}$2") : id);
    const sub = (a, b) => (a.length > 1 ? `${tid(a)}\\,${tid(b)}` : `${a}${b}`);
    const f = formulaNums();
    const P = CONFIG.tex.post;
    const signed = (raw) => {
      const t = f.num(raw, mean(raw), P);
      return raw < 0 ? `\\left(${t}\\right)` : t;
    };
    const mA = signed(d.mean[i]);
    const mB = signed(d.mean[j]);
    const sA = f.num(d.sd[i], sd(d.sd[i]), P);
    const sB = f.num(d.sd[j], sd(d.sd[j]), P);
    const diff = pairDifference(d.mean[i], d.sd[i], d.mean[j], d.sd[j]);
    const zT = f.num(diff.z, formatDecimal(diff.z, { digits: CONFIG.digits.z }));
    const p = diff.pi;
    const ps = fmtPi(p, { bounds: "symbols" });
    const pT = f.num(p, ps);
    const rel = /^[<>]/.test(ps) ? `\\;${pT}` : `= ${pT}`;
    const [a, b] = [d.ids[i], d.ids[j]];
    const tex =
      `\\begin{aligned}\\pi_{${sub(a, b)}} &= \\Pr(\\theta_{${tid(a)}} > \\theta_{${tid(b)}} \\mid Y) \\\\ `
      + `&= \\Phi\\left(\\frac{${mA} ${CONFIG.tex.minus} ${mB}}{\\sqrt{${sA}^{2} + ${sB}^{2}}}\\right) \\\\ `
      + `&= \\Phi(${zT}) ${rel}\\end{aligned}`;
    renderTex(texWorked, tex, { display: true, nums: f.raws });

    const g = formulaNums();
    const q = d.pi[j][i];
    const qs = fmtPi(q, { bounds: "symbols" });
    const oneT = g.num(1, "1");
    const qT = g.num(q, qs);
    const mirrorTex = `\\pi_{${sub(b, a)}} = ${oneT} - \\pi_{${sub(a, b)}} ${/^[<>]/.test(qs) ? `\\;${qT}` : `= ${qT}`}`;
    renderTex(texMirror, mirrorTex, { display: true, nums: g.raws });
    mirrorHead.replaceChildren(...fill(T.mirrorHead, { row: nameNode(a), col: nameNode(b) }));
    texWorked.querySelectorAll("mtext").forEach((n, k) => {
      if (k === f.raws.length - 1) n.setAttribute("data-prx-readout", "sel-pi");
    });
    texMirror.querySelectorAll("mtext").forEach((n, k) => {
      if (k === g.raws.length - 1) n.setAttribute("data-prx-readout", "sel-pi-mirror");
    });
  }

  return {
    root,
    detail,
    ticksNote,
    draw,
    defer,
    cancel,
    reset: () => { stamp = null; },
    width: () => densSlot.clientWidth,
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: cssFor(CONFIG.className) + V2_CSS,
    keys: {
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      sort: { type: "choice", values: CONFIG.sort.values.slice(), value: CONFIG.sort.value },
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      cell: { type: "custom", value: CONFIG.cell.auto, parse: (v) => parseCell(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const nameNode = nameNodeOf(ctx);
      const piName = (a, b) =>
        h(
          "span",
          { class: "prx-pm-sym" },
          "π",
          h("sub", {}, h("span", { "data-prx-name": `${a}${b}`, text: a.length > 1 ? `${a},${b}` : `${a}${b}` })),
        );
      const code = (text) => h("code", { text });

      // --- Primary control (ctx.controls): Data selector only
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend,
        name: "data",
        className: "prx-pm-data",
        options: [
          { value: "six", label: T.dataSix },
          { value: "league", label: T.dataLeague },
        ],
        value: ctx.state.data,
        onChange: (v) => ctx.set({ data: v, cell: CONFIG.cell.auto }),
      });
      ctx.controls.append(dataRadio.root);

      // --- Secondary controls (ctx.settingsBox): Order + league Prior SD
      const sortRadio = ctx.radioGroup({
        legend: T.sortLegend,
        name: "sort",
        className: "prx-pm-sort",
        options: [
          { value: "mean", label: T.sortMean },
          { value: "label", label: T.sortLabel },
        ],
        value: ctx.state.sort,
        onChange: (v) => ctx.set({ sort: v }),
      });
      const prior = ctx.slider({
        label: T.priorLabel,
        ...ctx.key("priorSd"),
        hint: fill(T.priorHint, { app: appLink(ctx, T.priorApp) }),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      prior.root.classList.add("prx-pm-prior");
      const priorRow = h("div", { class: "prx-pm-prior-row" }, prior.root);
      const settingsGrid = h("div", { class: "prx-pm-settings-grid" }, sortRadio.root);
      ctx.settingsBox("Settings").body.append(settingsGrid);

      // --- Primary stage (ctx.stage): 1-line header + matrix & selected-pair posterior density
      let current = null;
      let selection = null;
      let hovered = null;
      let rendering = false;
      const NONE = Object.freeze({ defer: false, scroll: false, reveal: false });
      let pending = NONE;

      const matrix = v2MatrixView(ctx, {
        onFocus: (x) => select({ i: x.i, j: x.j }, { scroll: true, defer: true }),
      });
      const pair = v2PairView(ctx);
      const least = leastView(ctx, {
        onPick: (c) => {
          hovered = null;
          select(c, { reveal: true });
        },
      });

      const leastButton = h("button", { type: "button", class: "prx-button", "data-prx-evidence": "inspect-least-certain" });
      ctx.listen(leastButton, "click", () => {
        if (!current) return;
        setHover(null);
        select(leastInOrder(current.d, current.order)[0], { reveal: true });
      });
      const stageHead = h(
        "div",
        { class: "prx-pm-stage-head" },
        ctx.part("title", h("p", { class: "prx-pm-stage-title", text: "Row above column" })),
        ctx.part("notes", h("p", { class: "prx-pm-cue", text: "Click any cell or use arrow keys" })),
      );
      ctx.stage.classList.add("prx-pm-charts");
      ctx.stage.append(stageHead, leastButton, h("div", { class: "prx-pm-stage-grid" }, matrix.root, pair.root));

      // --- Data disclosure: ordered least-certain pairs table
      const dataBox = ctx.dataBox("Data and least-certain pairs");
      dataBox.body.append(least.root);

      // --- Method disclosure: worked formula, mirror cell, order/ticks/source/package notes
      const sourceNote = ctx.part("notes", h("p", { class: "prx-pm-note prx-pm-source" }));
      const packageNote = ctx.part("notes", h("p", { class: "prx-pm-note prx-pm-package" }));
      packageNote.replaceChildren(...fill(T.notePackage, { fn: code(T.rPlot), one: ctx.num(1, "1") }));
      const methodBox = ctx.methodBox("Method and details");
      methodBox.body.append(
        h("div", { class: "prx-pm-method-stack" }, pair.detail, pair.ticksNote, matrix.orderNote, sourceNote, packageNote),
      );

      const shownCell = () => hovered ?? selection;
      const drawPair = (measured) => {
        if (current) pair.draw(current.d, current.order, shownCell(), { hovered: Boolean(hovered), measured });
      };
      const deferPair = () => pair.defer(() => drawPair());

      function select(cell, { scroll = false, defer = false, reveal = false } = {}) {
        if (!current || rendering) return;
        if (selection && selection.i === cell.i && selection.j === cell.j) {
          if (scroll) matrix.scrollToSelected();
          if (reveal) matrix.reveal(selection);
          return;
        }
        pending = { defer, scroll, reveal };
        ctx.set({ cell: cellKey(current.d, cell) });
        pending = NONE;
      }

      function setHover(c) {
        const next = c ? { i: c.i, j: c.j } : null;
        if ((next && hovered && next.i === hovered.i && next.j === hovered.j) || (!next && !hovered)) return;
        const width = pair.width();
        hovered = next;
        matrix.overlays(selection, hovered);
        pair.cancel();
        drawPair(width);
      }

      ctx.listen(matrix.slot, "pointermove", (ev) => {
        if (ev.pointerType !== "touch") setHover(matrix.cellAt(ev));
      });
      ctx.listen(matrix.slot, "pointerleave", () => setHover(null));
      ctx.listen(matrix.slot, "click", (ev) => {
        const c = matrix.cellAt(ev);
        if (!c) return;
        const had = hovered;
        hovered = null;
        if (selection && c.i === selection.i && c.j === selection.j) {
          if (had) {
            const width = pair.width();
            matrix.overlays(selection, null);
            pair.cancel();
            drawPair(width);
          }
          return;
        }
        select(c);
      });

      function drawReadout(state, d, order) {
        const leastPairs = leastInOrder(d, order);
        const lc = leastPairs[0];
        const steps = lc.apart;
        const p = d.pi[lc.i][lc.j];
        leastButton.replaceChildren("Inspect least-certain pair: ", nameNode(d.ids[lc.i]), " and ", nameNode(d.ids[lc.j]));
        const where = h(
          "span",
          { "data-prx-readout": "least-where" },
          ...(steps === 1 ? [T.readNext] : fill(T.readFar, { steps: w.count(steps, { hook: "least-steps" }) })),
        );
        const scope =
          d.data === "league"
            ? ["Across ", w.count(d.M, { hook: "pairs" }), " pairs (prior SD ", w.setting(d.priorSd, { hook: "prior-sd" }), "), least certain is "]
            : ["Across ", w.count(d.M, { hook: "pairs" }), " pairs, least certain is "];
        const followed =
          state.cell !== CONFIG.cell.auto && selection && selection.i !== selection.j
            ? [" Selected ", nameNode(d.ids[selection.i]), T.readAbove, nameNode(d.ids[selection.j]), ": ", w.prob(d.pi[selection.i][selection.j]), "."]
            : [];
        w.set([
          ...scope,
          nameNode(d.ids[lc.i]),
          T.readAbove,
          nameNode(d.ids[lc.j]),
          ", ",
          piName(d.ids[lc.i], d.ids[lc.j]),
          " = ",
          w.prob(p, { hook: "least-pi" }),
          "; ",
          where,
          ".",
          ...followed,
        ]);
      }

      function drawNotes(d) {
        if (d.data === "league") ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));
        else ctx.caption.replaceChildren();
        if (d.data === "six") {
          sourceNote.replaceChildren(
            ...fill(T.noteSix, {
              data: code(T.rData),
              score: code(T.rScore),
              sd: ctx.num(d.sd[0], formatDecimal(d.sd[0], { digits: CONFIG.digits.six.sd })),
            }),
          );
        } else {
          sourceNote.replaceChildren(
            ...fill(T.noteLeague, {
              n: ctx.num(d.n, formatCount(d.n)),
              seed: ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
              zero: ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })),
              prior: ctx.num(d.priorSd, formatSetting(d.priorSd)),
            }),
          );
        }
      }

      return {
        render(state, info) {
          // PR-06 / PR-09: disclosure toggle never re-renders ctx.stage or re-fires ctx.readout.set
          if (info?.reason === "disclosure") return;

          ctx.root.setAttribute("aria-busy", "true");
          rendering = true;
          const how = pending;
          pending = NONE;
          try {
            const changed = info?.changed ?? [];
            dataRadio.set(state.data);
            sortRadio.set(state.sort);
            prior.set(state.priorSd);
            if (state.data === "league" && priorRow.parentNode !== settingsGrid) settingsGrid.append(priorRow);
            if (state.data !== "league" && priorRow.parentNode) priorRow.remove();
            ctx.root.setAttribute("data-prx-data", state.data);
            const d = dataset(state.data, state.priorSd);
            if (changed.includes("data") && !info?.initial) hovered = null;
            selection = resolveCell(d, state.cell);
            if (hovered && (hovered.i >= d.n || hovered.j >= d.n)) hovered = null;
            const order = orderOf(d, state.sort);
            const later = Boolean(current && current.d.data === d.data && !info?.initial && changed.length);
            if (later && changed.every((k) => k === "cell")) {
              const width = how.defer ? undefined : pair.width();
              current = { state, d, order };
              matrix.overlays(selection, hovered);
              matrix.syncStop(selection);
              least.mark(selection);
              drawReadout(state, d, order);
              if (how.defer) deferPair();
              else {
                pair.cancel();
                drawPair(width);
              }
              if (how.scroll) matrix.scrollToSelected();
              if (how.reveal) matrix.reveal(selection);
              return;
            }
            const inPlace = later && changed.every((k) => CONFIG.inPlaceKeys.includes(k));
            const avail = Math.max(1, Math.round(matrix.root.clientWidth || ctx.width()));
            const densW = pair.width();
            current = { state, d, order };
            pair.cancel();
            pair.reset();
            drawPair(densW);
            matrix.draw(state, d, order, { avail, inPlace, selection, hovered });
            drawReadout(state, d, order);
            least.draw(d, order, selection);
            matrix.note(state, d);
            drawNotes(d);
            if (how.reveal) matrix.reveal(selection);
            else if (!inPlace) ctx.timeout(() => matrix.reveal(selection), 0);
          } finally {
            rendering = false;
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
