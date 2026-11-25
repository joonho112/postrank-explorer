export * from "../shared/domain/which-ranking.js";

import { appLink, createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatPercent,
  formatProb,
  formatReadoutEst,
  formatReadoutExpected,
  formatReadoutProb,
  formatSetting,
} from "../shared/format.js";
import { exposeResult } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import { LEAGUE_SEED, scoreOrder } from "../pr-core.js";
import {
  CONFIG,
  LAW,
  LEAGUE,
  captionedTable,
  columns,
  cssFor,
  dataset,
  defaultUnit,
  drawRankDistributions,
  fill,
  fillText,
  kFor,
  markUnits,
  ordinal,
  placeText,
  rowUnitAt,
  scaledMeans,
  slopeUnitAt,
  tagUnits,
} from "../shared/domain/which-ranking.js";

const T = CONFIG.text;
const BUMP = CONFIG.bump;
const HALF = CONFIG.half;

const LEAGUE_IDS = Object.freeze(Array.from(LEAGUE.ids));
const UNIT_VALUES = Object.freeze(["", ...LAW.ids, ...LEAGUE_IDS]);
const STEP_DIGITS = 2;
const PRIOR_GRID = Object.freeze(
  Array.from(
    { length: Math.round((CONFIG.priorSd.max - CONFIG.priorSd.min) / CONFIG.priorSd.step) + 1 },
    (_, i) => Number((CONFIG.priorSd.min + i * CONFIG.priorSd.step).toFixed(STEP_DIGITS)),
  ),
);

const V2_BUMP = Object.freeze({
  puzzle: Object.freeze({
    rowH: 46,
    marginTop: 56,
    marginBottom: 12,
    marginLeft: 36,
    marginRight: 52,
    maxWidth: 640,
    dot: 6,
    font: 13,
    valueFont: 13,
    headerFont: 13,
    labelGap: 11,
    tieW: 0.16,
  }),
  league: Object.freeze({
    rowH: 16,
    marginTop: 56,
    marginBottom: 8,
    marginLeft: 44,
    marginRight: 44,
    maxWidth: 736,
    dot: 3.6,
    font: 13,
    valueFont: 13,
    headerFont: 13,
    labelGap: 8,
    tieW: 0.1,
  }),
  headerGap: 9,
});

const V2_RANKS = Object.freeze({
  puzzle: Object.freeze({
    rowH: 58,
    marginTop: 10,
    marginBottom: 44,
    marginLeft: 36,
    marginRight: 14,
    maxWidth: 560,
    bar: 0.28,
    base: 0.66,
    height: 0.48,
    ivY: 0.85,
    font: 13,
    valueFont: 13,
    diamond: 6,
    ivWidth: 1.5,
    ticks: null,
  }),
  league: Object.freeze({
    rowH: 28,
    marginTop: 10,
    marginBottom: 46,
    marginLeft: 44,
    marginRight: 14,
    maxWidth: 672,
    bar: 0.42,
    base: 0.72,
    height: 0.66,
    ivY: 0.88,
    font: 13,
    valueFont: 0,
    diamond: 3.6,
    ivWidth: 1.25,
    ticks: Object.freeze([1, 5, 10, 15, 20, 25, 30]),
  }),
});

const SVG_NS = "http://www.w3.org/2000/svg";

function labelBoxDefs(doc, id, color) {
  const { padX, padY } = BUMP.labelBox;
  const defs = doc.createElementNS(SVG_NS, "defs");
  const filter = doc.createElementNS(SVG_NS, "filter");
  for (const [k, v] of [
    ["id", id],
    ["x", -padX],
    ["y", -padY],
    ["width", 1 + 2 * padX],
    ["height", 1 + 2 * padY],
  ]) {
    filter.setAttribute(k, String(v));
  }
  const flood = doc.createElementNS(SVG_NS, "feFlood");
  flood.setAttribute("flood-color", color);
  const over = doc.createElementNS(SVG_NS, "feComposite");
  over.setAttribute("in", "SourceGraphic");
  over.setAttribute("operator", "over");
  filter.append(flood, over);
  defs.append(filter);
  return defs;
}

/**
 * Frame v2 slope chart: preserves 100% of domain/which-ranking.js mark roles, link contrast attributes,
 * keyboard focus keys (`${c}|${u}`), and pointer geometry (`slopeUnitAt`), while rendering all SVG text at >= 13px
 * with multi-line headers that never collide or shrink below 13px at 375px.
 */
function drawV2SlopeChart(ctx, slot, {
  ids, cols, headers, chosen = 0, geometry: G, labels = "all", valueText, title, alt, table, keyboardLabel, onFocus, width: wanted,
}) {
  const n = ids.length;
  const avail = Math.max(1, Math.round(wanted || slot.clientWidth || ctx.width()));
  const width = Math.min(avail, G.maxWidth);
  const mt = G.marginTop;
  const rowH = G.rowH;
  const height = mt + G.marginBottom + n * rowH;
  const last = cols.length - 1;
  const nodes = [];
  for (const col of cols) {
    for (let u = 0; u < n; u += 1) {
      nodes.push({ u, c: col.c, slot: col.slot[u], value: col.value[u], name: ids[u], role: "node" });
    }
  }
  const blocks = cols.flatMap((col) => col.blocks.map((b) => ({ ...b, c: col.c })));
  const colPx = Math.max(1, (width - G.marginLeft - G.marginRight) / Math.max(1, last));
  const tieW = Math.min(G.tieW, (G.labelGap - BUMP.tieClear) / colPx);
  const all = labels === "all";
  const estPx = (s, fs, bold = false) =>
    [...String(s)].reduce((acc, ch) => acc + fs * (ch === "." || ch === "," || ch === " " ? 0.32 : bold ? 0.72 : 0.62), 0);
  const rightInset = all
    ? cols.map((col, ci) => {
        const w = Math.max(0, ...col.value.map((v) => estPx(valueText(ci, v), G.valueFont, false)));
        return Math.min(0.38, Math.round(G.labelGap + w + 6) / colPx);
      })
    : null;
  const leftInset = all
    ? (() => {
        const w = Math.max(0, ...ids.map((nm) => estPx(nm, G.font, true)));
        return Math.min(0.38, Math.round(G.labelGap + w + 6) / colPx);
      })()
    : 0;
  const links = [];
  for (let u = 0; u < n; u += 1) {
    for (let c = 0; c < last; c += 1) {
      links.push({
        u,
        x1: all ? c + rightInset[c] : c,
        y1: cols[c].slot[u],
        x2: all ? c + 1 - leftInset : c + 1,
        y2: cols[c + 1].slot[u],
        role: "link",
      });
    }
  }
  const idLeft = (all ? nodes : nodes.filter((x) => x.c === 0)).map((x) => ({ ...x, role: "id" }));
  const idRight = all ? [] : nodes.filter((x) => x.c === last).map((x) => ({ ...x, role: "id" }));
  const valueRows = cols.map((col) => nodes.filter((x) => x.c === col.c).map((x) => ({ ...x, role: "value" })));
  const heads = headers.map((text, c) => ({ c, text, on: c === chosen }));
  const kbData = Array.from({ length: n }, (_, s) => cols.map((col) => nodes.find((x) => x.c === col.c && x.slot === s))).flat();
  const boxId = uid("prx-wr-labelbox");
  const boxed = (rows, defsColor = null) => (index, scales, values, dims, context, next) => {
    const g = tagUnits(rows)(index, scales, values, dims, context, next);
    if (!g?.querySelectorAll) return g;
    g.querySelectorAll("text").forEach((t) => t.setAttribute("filter", `url(#${boxId})`));
    if (defsColor) g.append(labelBoxDefs(context.document, boxId, defsColor));
    return g;
  };
  const header = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    g?.querySelectorAll?.("text").forEach((t) => t.setAttribute("data-prx-role", "header"));
    return g;
  };
  const handle = plot(slot, {
    alt,
    table,
    width,
    height,
    marginTop: mt,
    marginBottom: G.marginBottom,
    marginLeft: G.marginLeft,
    marginRight: G.marginRight,
    x: { domain: [0, last], axis: null },
    y: { domain: [n - HALF, -HALF], axis: null },
    marks: (c, P) => [
      P.rect([{ c: chosen }], {
        x1: (b) => b.c - (b.c === 0 ? Math.min(BUMP.bandEnd, Math.max(0, (G.marginLeft - 4) / colPx)) : BUMP.band),
        x2: (b) => b.c + (b.c === last ? Math.min(BUMP.bandEnd, Math.max(0, (G.marginRight - 4) / colPx)) : BUMP.band),
        y1: n - HALF,
        y2: -HALF - (BUMP.bandHead * mt) / rowH,
        fill: c.plotGrid,
      }),
      P.rect(blocks, {
        x1: (b) => b.c - tieW,
        x2: (b) => b.c + tieW,
        y1: (b) => b.first - BUMP.tiePad,
        y2: (b) => b.last + BUMP.tiePad,
        fill: "none",
        stroke: c.plotAxis,
        strokeDasharray: BUMP.dash,
        rx: G.dot,
      }),
      P.link(links, {
        x1: "x1",
        y1: "y1",
        x2: "x2",
        y2: "y2",
        stroke: c.plotMuted,
        strokeWidth: BUMP.line,
        strokeOpacity: BUMP.lineOpacity,
        render: tagUnits(links),
      }),
      P.dot(nodes, {
        x: "c",
        y: "slot",
        r: G.dot,
        fill: c.plotBg,
        stroke: c.plotFg,
        strokeWidth: BUMP.line,
        render: tagUnits(nodes),
      }),
      P.text(idLeft, {
        x: "c",
        y: "slot",
        text: "name",
        dx: -G.labelGap,
        textAnchor: "end",
        fill: c.plotFg,
        fontSize: G.font,
        fontWeight: "bold",
        stroke: c.plotBg,
        strokeWidth: BUMP.halo,
        paintOrder: "stroke",
        render: boxed(idLeft, c.plotBg),
      }),
      P.text(idRight, {
        x: "c",
        y: "slot",
        text: "name",
        dx: G.labelGap,
        textAnchor: "start",
        fill: c.plotFg,
        fontSize: G.font,
        fontWeight: "bold",
        render: boxed(idRight),
      }),
      ...valueRows.map((rows, ci) =>
        numText(rows, {
          x: "c",
          y: "slot",
          value: "value",
          format: (v) => valueText(ci, v),
          ...(!all && ci === last ? { dx: -G.labelGap, textAnchor: "end" } : { dx: G.labelGap, textAnchor: "start" }),
          fill: c.plotFg,
          fontSize: G.valueFont,
          stroke: c.plotBg,
          strokeWidth: BUMP.halo,
          paintOrder: "stroke",
          ...(all ? {} : { dy: -G.labelGap }),
          render: boxed(rows),
        }),
      ),
      ...heads.map((hd) =>
        P.text([hd], {
          x: "c",
          frameAnchor: "top",
          dy: -V2_BUMP.headerGap,
          lineAnchor: "bottom",
          text: "text",
          textAnchor: hd.c === 0 ? "start" : hd.c === last ? "end" : "middle",
          dx: hd.c === 0 ? -G.dot : hd.c === last ? G.dot : 0,
          fill: c.plotFg,
          fontSize: G.headerFont,
          fontWeight: hd.on ? "bold" : "normal",
          render: header,
        }),
      ),
    ],
    keyboard: {
      data: kbData,
      x: "c",
      y: "slot",
      key: (x) => `${x.c}|${x.u}`,
      sort: false,
      columns: cols.length,
      label: keyboardLabel,
      title,
      onFocus: (x) => onFocus?.(x.u),
    },
  });
  return {
    n,
    width,
    height,
    mt,
    ml: G.marginLeft,
    mr: G.marginRight,
    rowH,
    cols,
    svg: handle.svg,
    area: handle.area,
    blocks: blocks.length,
  };
}

const V2_CSS = `
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-stage > .prx-wr-selected-comparison {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: .8rem; align-items: start;
}
.prx-wr .prx-wr-selected-comparison > * { min-width: 0; }
/* PR-01: reset legacy @container grid rules inside v2 containers */
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-stage > *,
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-wr-grid {
  grid-template-columns: minmax(0, 1fr);
  grid-area: auto;
  min-width: 0;
}
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.9rem;
}
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
.prx-wr.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding-inline: 0.42rem; font-size: 0.8125rem; }
@media (max-width: 30em) {
  .prx-wr.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-wr.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-wr.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-wr.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-wr.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-wr.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.35rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-wr.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.5rem; }
}
.prx-wr .prx-wr-settings-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 1.25rem;
  width: 100%;
}
.prx-wr .prx-wr-settings-grid > .prx-wr-data {
  flex: 1 1 100%;
}
.prx-wr .prx-wr-settings-note {
  flex: 1 1 100%;
  margin: 0;
}
.prx-wr .prx-wr-scale-hints {
  display: grid;
  flex: 1 1 14rem;
  min-width: 0;
  align-self: flex-start;
}
.prx-wr .prx-wr-scale-hints > .prx-hint {
  grid-area: 1 / 1;
  margin: 0;
}
.prx-wr .prx-wr-hint-spare {
  visibility: hidden;
}
.prx-wr .prx-wr-kslider,
.prx-wr .prx-wr-expk {
  flex: 1 1 14rem;
  max-width: 22rem;
}
.prx-wr .prx-wr-prior {
  flex: 1 1 100%;
  max-width: 28rem;
}
.prx-wr .prx-slider.prx-wr-off {
  opacity: 0.55;
}
/* 1:1 viewBox scaling (scale = 1.00 <= 1.35 across page & embed) */
.prx-wr .prx-wr-bump-chart {
  width: 100%;
  max-width: 736px;
  margin-inline: auto;
}
.prx-wr[data-prx-data="puzzle"] .prx-wr-bump-chart {
  max-width: 640px;
}
.prx-wr .prx-wr-ranks-chart {
  width: 100%;
  max-width: 672px;
}
.prx-wr[data-prx-data="puzzle"] .prx-wr-ranks-chart {
  max-width: 560px;
}
/* Concise 1-line selected-unit summary strip on plot-paper stage */
.prx-wr .prx-stage .prx-wr-card {
  margin: 0.35rem auto 0;
  padding: 0.35rem 0.6rem;
  max-width: 736px;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  font-size: 0.84375rem;
  line-height: 1.35;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.12rem 0.45rem;
}
.prx-wr[data-prx-data="puzzle"] .prx-stage .prx-wr-card {
  max-width: 640px;
}
.prx-wr .prx-stage .prx-wr-card p {
  margin: 0;
  display: inline;
}
.prx-wr .prx-stage .prx-wr-card-status {
  font-weight: 600;
  color: var(--prx-plot-fg);
}
.prx-wr .prx-wr-data-stack,
.prx-wr .prx-wr-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
  min-width: 0;
}
.prx-wr .prx-wr-law {
  margin: 0;
}
.prx-wr .prx-wr-method-stack > p {
  margin: 0;
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: `${cssFor(CONFIG.className)}${V2_CSS}`,
    keys: {
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      summary: { type: "choice", values: CONFIG.summary.values.slice(), value: CONFIG.summary.value },
      k: { type: "integer", min: CONFIG.k.min, max: CONFIG.k.max, step: CONFIG.k.step, value: CONFIG.k.value },
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      scale: { type: "choice", values: CONFIG.scale.values.slice(), value: CONFIG.scale.value },
      expK: { type: "integer", min: CONFIG.expK.min, max: CONFIG.expK.max, step: CONFIG.expK.step, value: CONFIG.expK.value },
      unit: { type: "choice", values: UNIT_VALUES.slice(), value: "" },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const hookNum = (name, raw, display) => w.num(raw, display, name ? { hook: name } : undefined);
      const nameNode = (id) => h("span", { "data-prx-name": id, text: id });
      const digitsOf = (d) => CONFIG.digits[d.data];

      // Exact finite 3-unit teaching law keeps exact 0/1/2-decimal strings; 30-unit league uses 3-sig-fig formatters (CP-1.2).
      const fmtMean = (d, v) => (d.data === "puzzle" ? formatDecimal(v, { digits: digitsOf(d).mean }) : formatReadoutEst(v));
      const fmtEr = (d, v) => (d.data === "puzzle" ? formatDecimal(v, { digits: digitsOf(d).er }) : formatReadoutExpected(v));
      const fmtProbV2 = (d, v) => (d.data === "puzzle" ? formatProb(v, { digits: digitsOf(d).prob }) : formatReadoutProb(v));
      const fmtSd = (v) => formatReadoutEst(v);
      const fmtLawSd = (v) => formatDecimal(v, { digits: CONFIG.digits.league.sd });
      const fmtRankProb = (d, v) => formatProb(v, { digits: digitsOf(d).prob });
      const fmtRankEr = (d, v) => formatDecimal(v, { digits: digitsOf(d).er });
      const fmtScaled = (d, v) => (d.data === "puzzle"
        ? formatDecimal(v, { digits: CONFIG.digits.puzzle.scaled })
        : formatReadoutEst(v));

      const kWord = (k) => T.numberWords[k - 1];
      const topWords = (k) => (k === 1 ? T.summaryWordsFirst : fillText(T.summaryWordsTopK, { k: kWord(k) }));
      const levelNode = () => ctx.num(CONFIG.level, formatPercent(CONFIG.level));
      const scaleSym = (sc) => (sc.transform === "sqrt" ? T.sqrtSym : T.expSym);
      const scaleParts = (sc) => (sc.transform === "sqrt"
        ? [T.sqrtSym]
        : sc.k === 1
          ? [T.expOneSym]
          : ["exp(", ctx.num(sc.k, formatCount(sc.k)), "θ)"]);

      const meanValue = (d, sc, v) => (sc ? fmtScaled(d, v) : fmtMean(d, v));
      const valueText = (d, key, v, sc) => (key === "mean" ? meanValue(d, sc, v) : key === "expected_rank" ? fmtEr(d, v) : fmtProbV2(d, v));
      const colHeaderV2 = (key, k, sc) => {
        if (key === "mean") {
          return sc ? `Posterior\nmean\nof ${scaleSym(sc)}` : T.colMean;
        }
        if (key === "expected_rank") return T.colEr;
        return k === 1 ? "First-place\nprobability" : `Top-${kWord(k)}\nprobability`;
      };
      const colTableHeader = (key, k, sc) => (key === "mean"
        ? (sc ? fillText(T.colMeanScale, { scale: scaleSym(sc) }) : T.colMean)
        : key === "expected_rank"
          ? T.colEr
          : k === 1
            ? T.colTopFirst
            : fillText(T.colTopK, { k: kWord(k) })).replace(/\n/g, " ");
      const byWords = (key, k, sc) => (key === "mean"
        ? (sc ? fillText(T.byMeanScale, { scale: scaleSym(sc) }) : T.byMean)
        : key === "expected_rank"
          ? T.byEr
          : fillText(T.byTop, { top: topWords(k) }));
      const meanWords = (sc) => (sc ? fillText(T.meanWordsScale, { scale: scaleSym(sc) }) : T.meanWords);
      const tid = (id) => (id.length > 1 ? id.replace(/^([A-Za-z]+)(\d+)$/, "\\mathrm{$1}$2") : id);

      // --- Primary control (ctx.controls): Rank by
      const summarySeg = ctx.segmented({
        label: "Rank by",
        name: "summary",
        className: "prx-wr-summary-seg",
        options: [
          { value: "mean", label: "Posterior mean" },
          { value: "expected_rank", label: "Expected rank" },
          { value: "top", label: "Top group" },
        ],
        value: ctx.state.summary,
        onChange: (v) => ctx.set({ summary: v }),
      });
      ctx.primaryControl(summarySeg.root);
      ctx.controls.append(summarySeg.root);

      // --- Secondary controls (ctx.settingsBox): Data, Top group k, Scale, Unit selector, expK, Prior SD
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend,
        name: "data",
        className: "prx-wr-data",
        options: [
          { value: "puzzle", label: T.dataPuzzle },
          { value: "league", label: T.dataLeague },
        ],
        value: ctx.state.data,
        onChange: (v) => ctx.set({ data: v, unit: "", scale: ctx.state.scale === "theta" ? "theta" : CONFIG.scale[v] }),
      });
      const kRadio = ctx.radioGroup({
        legend: T.kLegend,
        name: "k-puzzle",
        className: "prx-wr-k",
        options: [
          { value: 1, label: T.kFirst },
          { value: CONFIG.k.puzzleMax, label: T.kTopTwo },
        ],
        value: Math.min(ctx.state.k, CONFIG.k.puzzleMax),
        onChange: (v) => ctx.set({ k: v }),
      });
      const kSlider = ctx.slider({
        label: T.kLabel,
        ...ctx.key("k"),
        format: (v) => formatCount(v),
        onInput: (v) => ctx.set({ k: v }),
      });
      kSlider.root.classList.add("prx-wr-kslider");

      const hintPuzzle = h("p", { class: "prx-hint", id: uid("prx-wr-scale-hint"), text: T.scaleHintPuzzle });
      const hintLeague = h("p", { class: "prx-hint", id: uid("prx-wr-scale-hint"), text: T.scaleHintLeague });
      const scaleHints = h("div", { class: "prx-wr-scale-hints" }, hintPuzzle, hintLeague);
      const scaleRadio = (name, other, otherLabel, hint) => {
        const g = ctx.radioGroup({
          legend: T.scaleLegend,
          name,
          className: "prx-wr-scale",
          options: [
            { value: "theta", label: T.scaleTheta },
            { value: other, label: otherLabel },
          ],
          value: ctx.state.scale === "theta" ? "theta" : other,
          onChange: (v) => ctx.set({ scale: v }),
        });
        g.root.setAttribute("aria-describedby", hint.id);
        return g;
      };
      const scalePuzzle = scaleRadio("scale-puzzle", CONFIG.scale.puzzle, T.scaleSqrt, hintPuzzle);
      const scaleLeague = scaleRadio("scale-league", CONFIG.scale.league, T.scaleExp, hintLeague);

      const unitSelect = ctx.select({
        label: "Selected unit",
        name: "unit",
        options: UNIT_VALUES.map((v) => ({ value: v, label: v === "" ? "Default (follows summary)" : v })),
        value: ctx.state.unit,
        onChange: (v) => ctx.set({ unit: v }),
      });

      const prior = ctx.slider({
        label: T.priorLabel,
        ...ctx.key("priorSd"),
        hint: fill(T.priorHint, { app: () => appLink(ctx, T.shrinkageApp) }),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      prior.root.classList.add("prx-wr-prior");

      const expK = ctx.slider({
        label: T.expKLabel,
        ...ctx.key("expK"),
        format: (v) => formatCount(v),
        hint: T.expKHint,
        onInput: (v) => ctx.set({ expK: v }),
      });
      expK.root.classList.add("prx-wr-expk");

      const anchor = (name) => ctx.doc.createComment(name);
      const slots = [
        { node: kRadio.root, at: anchor("k") },
        { node: kSlider.root, at: anchor("k-league") },
        { node: scalePuzzle.root, at: anchor("scale") },
        { node: scaleLeague.root, at: anchor("scale-league") },
      ];
      const showControls = (shown) =>
        slots.forEach((s, i) => {
          if (shown[i] && !s.node.isConnected) s.at.before(s.node);
          else if (!shown[i] && s.node.isConnected) s.node.remove();
        });

      const settings = ctx.settingsBox(T.settings);
      settings.body.append(
        h(
          "div",
          { class: "prx-wr-settings-grid" },
          dataRadio.root,
          ...slots.map((s) => s.at),
          scaleHints,
          unitSelect.root,
          h("p", { class: "prx-hint prx-wr-settings-note", text: T.settingsNote }),
          expK.root,
          prior.root,
        ),
      );

      // --- Primary stage (ctx.stage): 3-summary bump chart + concise 1-line selected-unit summary strip
      const bumpSlot = ctx.primaryGraphic(h("div", { class: "prx-wr-bump-chart" }));
      const cardStatus = h("p", { class: "prx-wr-card-status" });
      const cardLine = h("p", { class: "prx-wr-card-line" });
      const cardExtra = h("p", { class: "prx-wr-card-extra" });
      const cardScale = h("p", { class: "prx-wr-card-scale" });
      const card = h(
        "section",
        { class: "prx-wr-card prx-light-panel", "data-prx-part": "readout", "aria-label": T.cardSelected },
        cardStatus,
        cardLine,
        cardExtra,
        cardScale,
      );
      const bumpBox = h("section", { class: "prx-wr-bump", "aria-label": T.bumpHeading }, bumpSlot, card);
      const rankStripTitle = h("p", { class: "prx-wr-heading" });
      const rankStripSlot = h("div", {});
      const rankStrip = h("section", { "data-prx-evidence": "unit-rank-distribution" }, rankStripTitle, rankStripSlot);
      ctx.stage.append(h("div", { class: "prx-wr-selected-comparison" }, bumpBox, rankStrip));

      // --- Data disclosure: state/draw posterior table, visible unit summary table, and >= 13px rank-distribution bars
      const lawBox = h("section", { class: "prx-wr-law", "aria-label": T.lawHeading });
      const unitTableSlot = h("div", { class: "prx-wr-unit-summary" });
      const ranksHeading = h("h4", { class: "prx-wr-heading", text: T.ranksHeading });
      const ranksNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes" });
      const ranksSlot = h("div", { class: "prx-wr-ranks-chart" });
      const ranksBox = h("section", { class: "prx-wr-ranks", "aria-label": T.ranksHeading }, ranksHeading, ranksNote, ranksSlot);
      const dataBox = ctx.dataBox("Data, state table and rank distributions");
      dataBox.body.append(h("div", { class: "prx-wr-data-stack" }, lawBox, unitTableSlot, ranksBox));

      // --- Method disclosure: worked expected-rank & scale-mean formulas, scale invariance, tie & setup notes
      const workedHeading = h("h4", { class: "prx-wr-heading", text: T.workedTitle });
      const texBox = ctx.scrollRegion(h("div", { class: "prx-wr-tex", "data-prx-tex": "expected-rank" }), T.cardWorked);
      const scaleTex = ctx.scrollRegion(h("div", { class: "prx-wr-tex", "data-prx-tex": "scale-mean" }), T.cardWorkedScale);
      const formulaNote = h("p", { class: "prx-wr-note" }, ...fill(T.formulaNote, { one: () => ctx.num(1, formatCount(1)) }));
      const scaleNote = h("p", { class: "prx-wr-note prx-wr-scale-note", "data-prx-part": "notes", hidden: true });
      const tieNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes", text: T.tieNote, hidden: true });
      const bumpNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes", text: T.bumpNote });
      const howTo = h("p", { class: "prx-hint prx-wr-howto", "data-prx-part": "notes", text: T.howTo });
      const sourceNote = ctx.part("notes", h("p", { class: "prx-wr-note prx-wr-source" }));
      const methodBox = ctx.methodBox("Method and definitions");
      methodBox.body.append(
        h("div", { class: "prx-wr-method-stack" }, workedHeading, texBox, scaleTex, formulaNote, scaleNote, tieNote, bumpNote, howTo, sourceNote),
      );

      const authoredCaption = ctx.info?.caption ?? "";

      let current = null;
      let bumpGeom = null;
      let ranksGeom = null;
      let selected = null;
      let hovered = null;
      let rendering = false;

      function syncUnitOptions(d, unitVal) {
        const allowed = new Set(["", ...d.ids]);
        Array.from(unitSelect.input.options).forEach((opt, i) => {
          const v = UNIT_VALUES[i] ?? "";
          opt.hidden = !allowed.has(v);
          opt.disabled = !allowed.has(v);
        });
        unitSelect.set(allowed.has(unitVal) ? unitVal : "");
      }

      function drawLaw(d, sc) {
        if (d.data === "league") {
          const groupSd = (g) => {
            const i = LEAGUE.group.indexOf(g);
            return hookNum(`law-sd-${g}`, d.sd[i], fmtLawSd(d.sd[i]));
          };
          lawBox.replaceChildren(
            h(
              "p",
              { class: "prx-wr-note" },
              ...fill(T.leagueLaw, { app: () => appLink(ctx, T.shrinkageApp) }),
              ...fill(T.leagueWidths, { small: () => groupSd("small"), medium: () => groupSd("medium"), large: () => groupSd("large") }),
              sc ? T.leagueLawExp : null,
            ),
          );
          return;
        }
        const dg = digitsOf(d);
        const orderOf = (vals) => scoreOrder(vals.slice(), { direction: "descending", ids: d.ids }).order.map((u) => d.ids[u]).join(", ");
        const rows = LAW.states.map((s, r) =>
          h(
            "tr",
            {},
            h("th", { scope: "row", text: r === 0 ? T.stateHigh : T.stateLow }),
            h("td", {}, hookNum(`law-p-${r === 0 ? "high" : "low"}`, LAW.probs[r], formatProb(LAW.probs[r], { digits: dg.prob }))),
            ...s.map((v, i) => h("td", {}, hookNum(`law-${r === 0 ? "high" : "low"}-${d.ids[i].toLowerCase()}`, v, formatCount(v)))),
            h("td", { text: orderOf(s) }),
          ),
        );
        const meanRow = (label, values, hook, fmt, plain) =>
          h(
            "tr",
            { class: plain ? "prx-wr-mean-row prx-wr-mean-plain" : "prx-wr-mean-row" },
            h("th", { scope: "row", text: label }),
            h("td", {}),
            ...values.map((m, i) => h("td", {}, hookNum(`${hook}-${d.ids[i].toLowerCase()}`, m, fmt(m)))),
            h("td", {}),
          );
        const meanRows = sc
          ? [
            meanRow(T.meanRowTheta, d.mean, "law-mean", (m) => fmtMean(d, m), true),
            meanRow(fillText(T.meanRowScale, { scale: scaleSym(sc) }), sc.means, "law-scale", (m) => fmtScaled(d, m), false),
          ]
          : [meanRow(T.meanRow, d.mean, "law-mean", (m) => fmtMean(d, m), false)];
        const table = h(
          "table",
          { class: "prx-wr-table prx-wr-states" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("th", { scope: "col", text: T.colState }),
              h("th", { scope: "col", text: T.colProb }),
              ...d.ids.map((id) => h("th", { scope: "col", text: id })),
              h("th", { scope: "col", text: T.colOrder }),
            ),
          ),
          h("tbody", {}, ...rows, ...meanRows),
        );
        const note = h(
          "p",
          { class: "prx-wr-note" },
          ...fill(T.meanNote, { mean: () => ctx.num(d.mean[0], fmtMean(d, d.mean[0])) }),
          ...(sc
            ? fill(T.meanNoteScale, {
              scale: () => scaleParts(sc),
              a: () => ctx.num(sc.means[0], fmtScaled(d, sc.means[0])),
              b: () => ctx.num(sc.means[1], fmtScaled(d, sc.means[1])),
              c: () => ctx.num(sc.means[2], fmtScaled(d, sc.means[2])),
            })
            : []),
        );
        lawBox.replaceChildren(h("h4", { class: "prx-wr-heading", text: T.lawHeading }), ...captionedTable(ctx, table, T.lawCaption, T.lawTable), note);
      }

      function drawUnitSummaryTable(state, d, k, cols, sc) {
        const chosen = Math.max(0, cols.findIndex((c) => c.key === state.summary));
        const activeCol = cols[chosen];
        const rows = activeCol.order.map((u) => ({ id: d.ids[u], u }));
        const hookFor = (colKey) => (_, rIdx) => (d.n > 3 && state.summary === colKey && (rIdx === 3 || rIdx === 4) ? `list-${rIdx + 1}` : null);
        const words = byWords(state.summary, k, sc).replace(/^By /, "by ");
        unitTableSlot.replaceChildren(
          renderDataTable(ctx, {
            caption: `Unit ranking summary (${words})`,
            label: "Unit ranking summary table",
            sticky: 1,
            rows,
            columns: [
              { key: "id", label: T.colUnit, rowHeader: true, name: true },
              {
                label: colTableHeader("mean", k, sc),
                value: (r) => cols[0].value[r.u],
                format: (v) => meanValue(d, sc, v),
                hook: hookFor("mean"),
              },
              {
                label: sc ? fillText(T.colPlaceMeanScale, { scale: scaleSym(sc) }) : T.colPlaceMean,
                value: (r) => placeText(cols[0], r.u),
              },
              {
                label: colTableHeader("expected_rank", k, sc),
                value: (r) => d.er[r.u],
                format: (v) => fmtEr(d, v),
                hook: hookFor("expected_rank"),
              },
              { label: T.colPlaceEr, value: (r) => placeText(cols[1], r.u) },
              {
                label: colTableHeader("top", k, sc),
                value: (r) => cols[2].value[r.u],
                format: (v) => fmtProbV2(d, v),
                hook: hookFor("top"),
              },
              { label: T.colPlaceTop, value: (r) => placeText(cols[2], r.u) },
              {
                label: [levelNode(), " rank interval"],
                render: (_, r) => [
                  ctx.num(d.interval[r.u].lo, formatCount(d.interval[r.u].lo)),
                  " to ",
                  ctx.num(d.interval[r.u].hi, formatCount(d.interval[r.u].hi)),
                ],
              },
            ],
          }),
        );
      }

      function drawBump(state, d, k, cols, sc) {
        const chosen = Math.max(0, cols.findIndex((c) => c.key === state.summary));
        const words = byWords(state.summary, k, sc).replace(/^By /, "by ");
        const table = {
          caption: fillText(T.bumpTable, { order: words }),
          columns: [
            { label: T.colUnit, value: "id" },
            { label: colTableHeader("mean", k, sc), value: (r) => cols[0].value[r.u], format: (v) => meanValue(d, sc, v) },
            { label: sc ? fillText(T.colPlaceMeanScale, { scale: scaleSym(sc) }) : T.colPlaceMean, value: (r) => placeText(cols[0], r.u) },
            { label: colTableHeader("expected_rank", k, sc), value: (r) => d.er[r.u], format: (v) => fmtEr(d, v) },
            { label: T.colPlaceEr, value: (r) => placeText(cols[1], r.u) },
            { label: colTableHeader("top", k, sc), value: (r) => cols[2].value[r.u], format: (v) => fmtProbV2(d, v) },
            { label: T.colPlaceTop, value: (r) => placeText(cols[2], r.u) },
          ],
          rows: cols[chosen].order.map((u) => ({ id: d.ids[u], u })),
        };
        const G = V2_BUMP[d.data];
        const avail = bumpSlot.clientWidth || Math.max(240, ctx.width() - 32);
        bumpGeom = drawV2SlopeChart(ctx, bumpSlot, {
          ids: d.ids,
          cols,
          chosen,
          geometry: G,
          labels: d.data === "puzzle" ? "all" : "ends",
          headers: cols.map((col) => colHeaderV2(col.key, k, sc)),
          valueText: (c, v) => valueText(d, cols[c].key, v, sc),
          alt: fillText(T.bumpAlt, { mean: meanWords(sc), top: topWords(k) }),
          table,
          keyboardLabel: T.bumpKeyboard,
          title: (x) => `${byWords(cols[x.c].key, k, sc)}, ${placeText(cols[x.c], x.u)}: ${d.ids[x.u]} (${valueText(d, cols[x.c].key, x.value, sc)})`,
          onFocus: (u) => select(u),
          width: Math.min(avail, G.maxWidth),
        });
        tieNote.hidden = !bumpGeom.blocks;
      }

      function drawRanks(state, d, k, col, sc) {
        const tail = (1 - CONFIG.level) / 2;
        ranksNote.replaceChildren(...fill(T.ranksNote, { level: levelNode, tail: () => ctx.num(tail, formatPercent(tail)) }));
        const words = byWords(col.key, k, sc).replace(/^By /, "by ");
        const lv = formatPercent(CONFIG.level);
        const rowTitle = (x) => {
          const u = x.u;
          const lo = ordinal(d.interval[u].lo);
          const hi = ordinal(d.interval[u].hi);
          if (d.data === "puzzle") {
            const probs = d.rankProbs.map((row, r) => fillText(T.rankWith, { place: ordinal(r + 1), p: fmtRankProb(d, row[u]) })).join(", ");
            return fillText(T.rowTitlePuzzle, { id: d.ids[u], probs, er: fmtRankEr(d, d.er[u]), level: lv, lo, hi });
          }
          let mode = 0;
          d.rankProbs.forEach((row, r) => {
            if (row[u] > d.rankProbs[mode][u]) mode = r;
          });
          return fillText(T.rowTitleLeague, {
            id: d.ids[u],
            er: fmtRankEr(d, d.er[u]),
            level: lv,
            lo,
            hi,
            mode: ordinal(mode + 1),
            pmode: fmtRankProb(d, d.rankProbs[mode][u]),
          });
        };
        const G = V2_RANKS[d.data];
        const fallbackW = Math.min(Math.max(240, ctx.width() - 48), G.maxWidth);
        const wantedW = ranksSlot.clientWidth > 0 ? Math.min(ranksSlot.clientWidth, G.maxWidth) : fallbackW;
        ranksGeom = drawRankDistributions(ctx, ranksSlot, {
          ids: d.ids,
          rankProbs: d.rankProbs,
          interval: d.interval,
          er: d.er,
          order: col.order,
          pmax: d.pmax,
          geometry: G,
          probText: (v) => fmtRankProb(d, v),
          alt: fillText(T.ranksAlt, { order: words, level: lv }),
          table: {
            caption: fill(T.ranksTable, { level: levelNode, order: words }),
            columns: [
              { label: T.colUnit, value: "id" },
              ...d.rankProbs.map((row, r) => ({
                label: fillText(T.colRankProb, { place: ordinal(r + 1) }),
                value: (x) => row[x.u],
                format: (v) => fmtRankProb(d, v),
              })),
              { label: T.colExpected, value: (x) => d.er[x.u], format: (v) => fmtRankEr(d, v) },
              { label: T.colLower, value: (x) => ordinal(d.interval[x.u].lo) },
              { label: T.colUpper, value: (x) => ordinal(d.interval[x.u].hi) },
            ],
            rows: col.order.map((u) => ({ id: d.ids[u], u })),
          },
          keyboardLabel: T.ranksKeyboard,
          title: rowTitle,
          onFocus: (u) => select(u),
          width: wantedW,
        });
      }

      let stripStamp = "";
      function drawUnitRanks(d, u) {
        const width = Math.round(rankStripSlot.clientWidth || Math.min(ctx.width(), 450));
        const stamp = [d.data, d.priorSd, u, width, ctx.root.getAttribute("data-theme"), ctx.doc.documentElement.getAttribute("data-theme")].join("|");
        if (stripStamp === stamp) return;
        stripStamp = stamp;
        const rows = d.rankProbs.map((row, i) => ({ rank: i + 1, probability: row[u] }));
        rankStripTitle.replaceChildren("Rank distribution of ", nameNode(d.ids[u]),
          ...(d.exact ? [" (exact)"] : [" (", ctx.num(CONFIG.mc.S, formatCount(CONFIG.mc.S)), " posterior draws)"]));
        plot(rankStripSlot, {
          width, height: 170, marginLeft: 38, marginRight: 12, marginTop: 10, marginBottom: 36,
          alt: `Probability that ${d.ids[u]} finishes at each rank, first to last.`,
          table: { caption: `Rank distribution of ${d.ids[u]}`, columns: [
            { label: "Rank", value: "rank", format: formatCount },
            { label: "Probability", value: "probability", format: v => fmtProbV2(d, v) }], rows },
          x: { domain: [.5, d.n + .5], ticks: d.n <= 3 ? [1, 2, 3] : [1, 5, 10, 15, 20, 25, 30], label: "Rank" },
          y: { domain: [0, 1], ticks: [0, .5, 1], label: null },
          marks: (c, P) => [P.rectY(rows, { x1: r => r.rank - .4, x2: r => r.rank + .4, y1: 0, y2: "probability", fill: c.post }), P.ruleY([0])],
          keyboard: { data: rows, x: "rank", y: "probability", title: r => `Rank ${r.rank}: ${fmtProbV2(d, r.probability)}` },
        });
      }

      function highlight() {
        markUnits([bumpGeom?.svg, ranksGeom?.svg], selected, hovered);
        drawCard();
      }

      function drawCard() {
        if (!current) return;
        const { d, k, cols, thetaCols, sc } = current;
        const u = hovered ?? selected;
        if (u === null || u === undefined || u >= d.n) return;
        drawUnitRanks(d, u);
        cardStatus.replaceChildren(`${hovered !== null ? "Pointer" : "Selected"}: `, nameNode(d.ids[u]), " — ");
        const iv = d.interval[u];
        const topShort = k === 1 ? "Pr(first)" : `Pr(top ${kWord(k)})`;
        cardLine.replaceChildren(
          "mean ",
          hookNum("card-mean", d.mean[u], fmtMean(d, d.mean[u])),
          ` (${placeText(thetaCols[0], u)}) · exp. rank `,
          hookNum("card-er", d.er[u], fmtEr(d, d.er[u])),
          ` (${placeText(cols[1], u)}) · ${topShort} `,
          hookNum("card-top", cols[2].value[u], fmtProbV2(d, cols[2].value[u])),
          ` (${placeText(cols[2], u)}) · `,
          levelNode(),
          " interval from rank ",
          hookNum("card-ri-lo", iv.lo, formatCount(iv.lo)),
          " to rank ",
          hookNum("card-ri-hi", iv.hi, formatCount(iv.hi)),
        );
        if (d.data === "league") {
          cardExtra.hidden = false;
          cardExtra.replaceChildren(
            ` · ${T.groupWords[LEAGUE.group[u]]} (SE `,
            ctx.num(LEAGUE.se[u], formatSetting(LEAGUE.se[u])),
            ", SD ",
            hookNum("card-sd", d.sd[u], fmtSd(d.sd[u])),
            ")",
          );
        } else {
          cardExtra.hidden = true;
          cardExtra.replaceChildren();
        }
        if (sc) {
          cardScale.hidden = false;
          cardScale.replaceChildren(
            " · ",
            ...scaleParts(sc),
            " mean ",
            hookNum("card-scale", sc.means[u], fmtScaled(d, sc.means[u])),
            ` (${placeText(cols[0], u)})`,
          );
        } else {
          cardScale.hidden = true;
          cardScale.replaceChildren();
        }
        drawFormula(d, u);
        drawScaleFormula(d, u, sc);
      }

      function drawFormula(d, u) {
        const f = formulaNums();
        const me = tid(d.ids[u]);
        if (d.data === "puzzle") {
          const avg = d.rankProbs.map((row, r) => `${f.num(r + 1, formatCount(r + 1))} \\times ${f.num(row[u], fmtProbV2(d, row[u]))}`).join(" + ");
          const others = d.ids.map((_, j) => j).filter((j) => j !== u);
          const pis = others.map((j) => `\\Pr(\\theta_{${tid(d.ids[j])}} > \\theta_{${me}} \\mid Y)`).join(" \\\\ &\\quad + ");
          const one = f.num(1, formatCount(1));
          const one2 = f.num(1, formatCount(1));
          const piNums = others.map((j) => f.num(d.pi[j][u], fmtProbV2(d, d.pi[j][u]))).join(" + ");
          const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
          const tex = `\\begin{aligned}\\prerank{${me}} &= \\;${avg} \\\\ &= \\;${one} + ${pis} \\\\ &= \\;${one2} + ${piNums} = \\;${result}\\end{aligned}`;
          renderTex(texBox, tex, { display: true, nums: f.raws });
          return;
        }
        const one = f.num(1, formatCount(1));
        const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
        const tex = `\\begin{aligned}\\prerank{${me}} &= \\;${one} + \\sum_{j \\neq ${me}} \\Pr(\\theta_j > \\theta_{${me}} \\mid Y) \\\\ &= \\;${result}\\end{aligned}`;
        renderTex(texBox, tex, { display: true, nums: f.raws });
      }

      function drawScaleFormula(d, u, sc) {
        if (!sc) {
          scaleTex.hidden = true;
          return;
        }
        scaleTex.hidden = false;
        const narrow = ctx.width() < CONFIG.narrowPx;
        const f = formulaNums();
        const me = tid(d.ids[u]);
        if (sc.transform === "sqrt") {
          const terms = LAW.probs.map((p, s) => `${f.num(p, fmtProbV2(d, p))} \\times \\sqrt{${f.num(LAW.states[s][u], formatCount(LAW.states[s][u]))}}`).join(" + ");
          const result = f.num(sc.means[u], fmtScaled(d, sc.means[u]), "prx-post");
          const head = `\\mathbb{E}\\big[\\sqrt{\\theta_{${me}}} \\mid Y\\big]`;
          const tex = narrow ? `\\begin{aligned}${head} &= \\;${terms} \\\\ &= \\;${result}\\end{aligned}` : `${head} = \\;${terms} = \\;${result}`;
          renderTex(scaleTex, tex, { display: true, nums: f.raws });
          return;
        }
        const two = f.num(2, formatCount(2));
        const k1 = f.num(sc.k, formatCount(sc.k));
        const m = f.num(d.mean[u], fmtMean(d, d.mean[u]));
        const k2 = f.num(sc.k, formatCount(sc.k));
        const s = f.num(d.sd[u], fmtSd(d.sd[u]));
        const two2 = f.num(2, formatCount(2));
        const result = f.num(sc.means[u], fmtScaled(d, sc.means[u]), "prx-post");
        const plus = narrow ? " \\\\ &\\quad + " : " + ";
        const tex =
          `\\begin{aligned}\\mathbb{E}\\big[e^{k\\theta_{${me}}} \\mid Y\\big] &= \\exp\\big(k \\cdot \\mathrm{mean}${plus}k^2 \\cdot \\mathrm{SD}^2 / ${two}\\big)` +
          ` \\\\ &= \\exp\\big(${k1} \\times ${m}${plus}${k2}^2 \\times ${s}^2 / ${two2}\\big) \\\\ &= \\;${result}\\end{aligned}`;
        renderTex(scaleTex, tex, { display: true, nums: f.raws });
      }

      const joinUnits = (units, part) =>
        units.flatMap((u, j) => [j === 0 ? "" : j === units.length - 1 ? T.listAnd : T.listComma, ...[part(u, j)].flat()]);

      function topLeadV2(d, k, top) {
        const leaders = top.order.filter((u) => top.place[u] === 1);
        const p = top.value[leaders[0]];
        const target = k === 1 ? "first place" : `top ${kWord(k)}`;
        const verb = leaders.length > 1 ? "lead" : "leads";
        const suffix = leaders.length > 1 ? " each" : "";
        return [
          "; ",
          ...joinUnits(leaders.slice(0, 3), (u) => nameNode(d.ids[u])),
          ` ${verb} ${target} (`,
          hookNum("top-lead", p, fmtProbV2(d, p)),
          `${suffix}).`,
        ];
      }

      function lawStoryV2(d, cols) {
        const [mean, er] = cols;
        const u = mean.order[0];
        if (mean.tied.has(u) || er.tied.has(u)) return null;
        const tol = CONFIG.storyTol;
        const pFirst = d.rankProbs[0][u];
        const pLast = d.rankProbs[d.n - 1][u];
        const firstOrLast = pFirst > 0 && pLast > 0 && Math.abs(pFirst + pLast - 1) <= tol;
        const placeWord = er.place[u] === d.n ? T.readLast : placeText(er, u);
        return [
          "Three-unit law: posterior mean ranks ",
          nameNode(d.ids[u]),
          " (",
          hookNum("list-1", d.mean[u], fmtMean(d, d.mean[u])),
          "), ",
          ...mean.order.slice(1).flatMap((v, j) => [
            j ? ", " : "",
            nameNode(d.ids[v]),
            " (",
            hookNum(`list-${j + 2}`, d.mean[v], fmtMean(d, d.mean[v])),
            ")",
          ]),
          ", yet ",
          nameNode(d.ids[u]),
          ` is ${placeWord} by expected rank (`,
          hookNum("lead-er", d.er[u], fmtEr(d, d.er[u])),
          ...(firstOrLast ? ["; first ", hookNum("lead-first", pFirst, fmtProbV2(d, pFirst))] : []),
          "), reversing ",
          hookNum("misordered", d.misordered, formatCount(d.misordered)),
          " of the ",
          hookNum("pairs", d.M, formatCount(d.M)),
          " pairs",
        ];
      }

      function placeMoveV2(d, candidates, mean, thetaMean) {
        let best = null;
        for (const u of candidates) {
          const shift = Math.abs(mean.place[u] - thetaMean.place[u]);
          if (shift > 0 && (!best || shift > best.shift)) best = { u, shift };
        }
        if (!best) return [];
        const { u } = best;
        const placeParts = (col, hook) => {
          const p = col.place[u];
          return [col.tied.has(u) ? T.tied : "", hookNum(hook, p, formatCount(p)), ordinal(p).slice(String(p).length)];
        };
        const dir = mean.place[u] < thetaMean.place[u] ? T.moveUp : T.moveDown;
        return ["; ", nameNode(d.ids[u]), ` ${dir} from `, ...placeParts(thetaMean, "place-theta"), " to ", ...placeParts(mean, "place-scale")];
      }

      function drawReadout(state, d, k, cols, sc, thetaCols) {
        const col = cols.find((c) => c.key === state.summary);
        if (d.data === "puzzle" && state.summary === "mean" && !sc) {
          const story = lawStoryV2(d, cols);
          if (story) {
            ctx.readout.set([...story, ...topLeadV2(d, k, cols[2])]);
            return;
          }
        }
        // Keep exact 22–25 word readout on three-unit law ranked by top group
        if (d.data === "puzzle" && state.summary === "top") {
          const list = col.order.flatMap((u, j) => [
            j ? ", " : "",
            nameNode(d.ids[u]),
            " (",
            hookNum(`list-${j + 1}`, col.value[u], valueText(d, col.key, col.value[u], sc)),
            ")",
          ]);
          const firstTop = col.order[0];
          const firstMean = cols[0].order[0];
          const subject = () => (sc ? fill(T.subjectMeanScale, { scale: () => scaleParts(sc) }) : T.subjectMean);
          const tail = firstTop === firstMean
            ? fill(T.readFirstSame, { subject, first: () => nameNode(d.ids[firstTop]) })
            : fill(T.readFirstDiff, { subject, mean: () => nameNode(d.ids[firstMean]) });
          ctx.readout.set([T.readPuzzle, ...fill(T.readRanked, { summary: () => [topWords(k)] }), ...list, ".", ...tail]);
          return;
        }

        const shownCount = Math.min(3, d.n);
        const listed = col.order.slice(0, shownCount);
        const list = listed.flatMap((u, j) => [
          j ? ", " : "",
          nameNode(d.ids[u]),
          " (",
          hookNum(`list-${j + 1}`, col.value[u], valueText(d, col.key, col.value[u], sc)),
          ")",
        ]);

        const head = d.data === "league"
          ? ["League (prior SD ", hookNum("prior-sd", d.priorSd, formatSetting(d.priorSd)), ")"]
          : [T.readPuzzle];
        const summaryLabel = state.summary === "mean"
          ? (sc ? [...scaleParts(sc), " mean"] : ["posterior mean"])
          : state.summary === "expected_rank"
            ? ["expected rank"]
            : [k === 1 ? "first-place probability" : `top-${kWord(k)} probability`];

        if (state.summary === "top") {
          const firstTop = col.order[0];
          const firstMean = cols[0].order[0];
          const meanDesc = sc ? [...scaleParts(sc), " mean"] : ["posterior mean"];
          const meanClause = firstTop === firstMean
            ? ["; ", ...meanDesc, " also ranks ", nameNode(d.ids[firstTop]), " first."]
            : ["; ", ...meanDesc, " ranks ", nameNode(d.ids[firstMean]), " first instead."];
          const zeros = col.order.filter((u) => col.value[u] === 0).length;
          const zeroClause = [];
          if (!d.exact && zeros > 1) {
            const word = T.numberWords[zeros - 1];
            const count = word ? word[0].toUpperCase() + word.slice(1) : hookNum("zeros", zeros, formatCount(zeros));
            zeroClause.push(" ", count, k === 1 ? " units are never first." : ` units are never in the top ${kWord(k)}.`);
          }
          ctx.readout.set([...head, " by ", ...summaryLabel, ": ", ...list, ...meanClause, ...zeroClause]);
          return;
        }

        const moveClause = state.summary === "mean" && sc
          ? placeMoveV2(d, col.order.slice(0, Math.min(CONFIG.listed, d.n)), cols[0], thetaCols[0])
          : [];
        const mis = sc ? sc.misordered : d.misordered;
        const otherName = state.summary === "expected_rank" ? "posterior mean" : "expected rank";
        const misClause = [
          "; ",
          hookNum("misordered", mis, formatCount(mis)),
          " of the ",
          hookNum("pairs", d.M, formatCount(d.M)),
          ` pairs differ from ${otherName}`,
        ];
        ctx.readout.set([...head, " by ", ...summaryLabel, ": ", ...list, ...moveClause, ...misClause, ...topLeadV2(d, k, cols[2])]);
      }

      function drawWorkedTitle(sc) {
        workedHeading.replaceChildren(...(sc ? fill(T.workedTitleScale, { scale: () => scaleParts(sc) }) : [T.workedTitle]));
      }

      function drawNotes(d) {
        if (d.data === "puzzle") {
          sourceNote.replaceChildren(T.notePuzzle);
          ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption] : []));
          exposeResult(ctx, null, "mc");
          return;
        }
        sourceNote.replaceChildren(
          ...fill(T.noteLeague, {
            n: () => ctx.num(d.n, formatCount(d.n)),
            seed: () => ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
            zero: () => ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })),
            prior: () => ctx.num(d.priorSd, formatSetting(d.priorSd)),
          }),
        );
        exposeResult(ctx, d.mc, "mc");
        ctx.caption.replaceChildren(
          ...(authoredCaption ? [authoredCaption, " "] : []),
          T.mcLead,
          captionNode(ctx, "monte-carlo", d.mc),
          ". ",
          T.postLead,
          captionNode(ctx, "teaching-posterior"),
          ".",
        );
      }

      function drawScaleNote(d, sc) {
        scaleNote.hidden = !sc;
        if (!sc) {
          scaleNote.replaceChildren();
          return;
        }
        scaleNote.replaceChildren(
          ...fill(T.scaleNote, {
            scale: () => scaleParts(sc),
            moved: () => hookNum("scale-moved", sc.moved, formatCount(sc.moved)),
            M: () => hookNum("scale-pairs", d.M, formatCount(d.M)),
          }),
        );
      }

      function select(u) {
        if (!current || u === null || u === undefined || u >= current.d.n) return;
        if (rendering) {
          ctx.timeout(() => select(u), 0);
          return;
        }
        const id = current.d.ids[u];
        const had = hovered;
        hovered = null;
        if (current.state.unit === id) {
          if (had !== null) highlight();
          return;
        }
        ctx.set({ unit: id });
      }

      function setHover(u) {
        const next = u ?? null;
        if (next === hovered) return;
        hovered = next;
        highlight();
      }

      ctx.listen(bumpSlot, "pointermove", (ev) => {
        if (ev.pointerType !== "touch") setHover(slopeUnitAt(bumpGeom, ev));
      });
      ctx.listen(bumpSlot, "pointerleave", () => setHover(null));
      ctx.listen(bumpSlot, "click", (ev) => {
        const u = slopeUnitAt(bumpGeom, ev);
        if (u !== null && u !== undefined) select(u);
      });
      ctx.listen(ranksSlot, "pointermove", (ev) => {
        if (ev.pointerType !== "touch") setHover(rowUnitAt(ranksGeom, ev));
      });
      ctx.listen(ranksSlot, "pointerleave", () => setHover(null));
      ctx.listen(ranksSlot, "click", (ev) => {
        const u = rowUnitAt(ranksGeom, ev);
        if (u !== null && u !== undefined) select(u);
      });

      // Idle precompute of league prior-SD grid (pure engine memoization, touches no DOM).
      const precompute = (() => {
        const win = ctx.win;
        const ric = typeof win.requestIdleCallback === "function" ? win.requestIdleCallback.bind(win) : null;
        const cancel = typeof win.cancelIdleCallback === "function" ? win.cancelIdleCallback.bind(win) : null;
        const done = new Set();
        let target = CONFIG.priorSd.value;
        let pending = null;
        const nextStep = () => {
          let best;
          for (const p of PRIOR_GRID) {
            if (done.has(p)) continue;
            if (best === undefined || Math.abs(p - target) < Math.abs(best - target)) best = p;
          }
          return best;
        };
        const run = () => {
          pending = null;
          const p = nextStep();
          if (p === undefined) return;
          done.add(p);
          dataset("league", p);
          schedule();
        };
        function schedule(around) {
          if (Number.isFinite(around)) target = around;
          if (pending !== null || nextStep() === undefined) return;
          if (ric) {
            const id = ric(run, { timeout: CONFIG.idle.timeout });
            pending = { cancel: () => cancel?.(id) };
          } else {
            pending = { cancel: ctx.timeout(run, CONFIG.idle.fallbackMs) };
          }
        }
        ctx.onCleanup(() => {
          pending?.cancel?.();
          pending = null;
        });
        return { markDone: (p) => done.add(p), schedule };
      })();

      return {
        render(state, info) {
          // PR-06 / PR-09: disclosure toggle never re-renders ctx.stage or ctx.readout; re-measure Data SVG at real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open && current) {
              const { d, k, cols, sc } = current;
              const col = cols.find((c) => c.key === state.summary);
              const openW = ranksSlot.clientWidth > 0 ? Math.min(ranksSlot.clientWidth, V2_RANKS[d.data].maxWidth) : 0;
              if (col && openW > 0 && (!ranksGeom || Math.abs(openW - ranksGeom.width) >= 2)) {
                drawRanks(state, d, k, col, sc);
                markUnits([ranksGeom?.svg], selected, hovered);
              }
            }
            return;
          }

          rendering = true;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const changed = info?.changed ?? [];
            const unitOnly = Boolean(current) && !info?.initial && current.state.data === state.data
              && info?.reason === "update" && changed.length === 1 && changed[0] === "unit";
            const league = state.data === "league";
            const scaled = state.scale !== "theta";

            dataRadio.set(state.data);
            summarySeg.set(state.summary);
            kRadio.set(Math.min(state.k, CONFIG.k.puzzleMax));
            kSlider.set(state.k);
            prior.set(state.priorSd);
            scalePuzzle.set(scaled ? CONFIG.scale.puzzle : "theta");
            scaleLeague.set(scaled ? CONFIG.scale.league : "theta");
            expK.set(state.expK);
            showControls([!league, league, !league, league]);
            for (const [p, mine] of [
              [hintPuzzle, !league],
              [hintLeague, league],
            ]) {
              p.classList.toggle("prx-wr-hint-spare", !mine);
              if (mine) p.removeAttribute("aria-hidden");
              else p.setAttribute("aria-hidden", "true");
            }
            prior.setDisabled(!league);
            expK.setDisabled(!(league && scaled));
            prior.root.classList.toggle("prx-wr-off", !league);
            expK.root.classList.toggle("prx-wr-off", !(league && scaled));
            ctx.root.setAttribute("data-prx-data", state.data);

            const d = dataset(state.data, state.priorSd);
            if (league) precompute.markDone(state.priorSd);
            syncUnitOptions(d, state.unit);
            const k = kFor(d, state.k);
            const sc = scaledMeans(d, state.scale, state.expK);
            const thetaCols = columns(d, k, null);
            const cols = sc ? columns(d, k, sc) : thetaCols;
            if (changed.includes("data") && !info?.initial) hovered = null;
            if (hovered !== null && hovered >= d.n) hovered = null;
            const ui = d.ids.indexOf(state.unit);
            selected = ui >= 0 ? ui : defaultUnit(thetaCols, state.summary);
            current = { state, d, k, sc, cols, thetaCols };

            if (!unitOnly) {
              drawLaw(d, sc);
              drawUnitSummaryTable(state, d, k, cols, sc);
              drawBump(state, d, k, cols, sc);
              drawRanks(state, d, k, cols.find((c) => c.key === state.summary), sc);
              drawReadout(state, d, k, cols, sc, thetaCols);
              drawNotes(d);
              drawScaleNote(d, sc);
              drawWorkedTitle(sc);
            }
            highlight();
          } finally {
            ctx.root.removeAttribute("aria-busy");
            rendering = false;
          }
          precompute.schedule(state.priorSd);
        },
      };
    },
  });
}
