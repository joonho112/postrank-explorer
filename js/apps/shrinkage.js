export * from "../shared/domain/shrinkage.js";

// App entry point for shrinkage (1.5: "What a posterior adds", Frame v2).
// Leaves ../shared/domain/shrinkage.js 100% untouched for downstream apps (1.4, 1.6, 2.9).
import { league30, pairCount } from "../pr-core.js";
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatReadoutRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  CONFIG,
  compute,
  parseOnOff,
  valueDomain,
} from "../shared/domain/shrinkage.js";

const T = CONFIG.text;
const LEAGUE = league30();
const N_UNITS = LEAGUE.ids.length;
const M = pairCount(N_UNITS);

const RANK_TICKS = Object.freeze([1, 5, 10, 15, 20, 25, 30]);

const V2_UNITS = Object.freeze({
  rowPxDesktop: 16.5,
  rowPxMobile: 14.8,
  headRows: 1.26,
  gapRows: 0.7,
  headDy: 0.9,
  marginTop: 8,
  marginBottom: 40,
  marginLeft: 40,
  marginRight: 14,
  dot: 4.0,
  dotRim: 0.9,
  ring: 7.2,
  ringWidth: 1.45,
  truth: 4.3,
  truthWidth: 1.65,
  line: 1.4,
  headLength: 6.2,
  arrowMinPx: 11.5,
  band: 0.45,
  idDx: -6,
  idSizeDesktop: 12.5,
  idSizeMobile: 12.2,
  headInset: 4,
  headHalo: 4,
  rule: "4,3",
  labelOffset: 35,
  defaultWidth: 640,
});

const V2_ORDER = Object.freeze({
  rowPx: 16.5,
  marginTop: 32,
  marginBottom: 12,
  marginLeft: 76,
  marginRight: 44,
  dotDesktop: 3.3,
  dotMobile: 2.5,
  line: 1.4,
  idDx: 8,
  rankDx: -40,
  headDy: -17,
  fontSizeDesktop: 12.5,
  fontSizeMobile: 12.2,
  dashes: CONFIG.order.dashes,
  defaultWidth: 380,
});

const V2_TRUTH = Object.freeze({
  height: 152,
  marginTop: 8,
  marginBottom: 40,
  marginLeft: 114,
  marginRight: 52,
  fontSize: 12.3,
  labelOffset: 35,
  defaultWidth: 380,
});

const V2_CSS = `
.prx-shrink > .prx-title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  line-height: 1.25;
}
.prx-shrink .prx-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 1rem;
}
.prx-shrink .prx-controls > .prx-slider {
  flex: 1 1 15rem;
  max-width: 26rem;
}
.prx-shrink .prx-controls > .prx-toggle {
  flex: 0 0 auto;
}
@media (max-width: 30em) {
  .prx-shrink.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] > .prx-title { font-size: 0.9rem; margin-bottom: 0.15rem; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.4rem; margin-bottom: 0.25rem; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-shrink.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.12rem 0.42rem; font-size: 0.8125rem; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.35rem; padding: 0.22rem 0.45rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-shrink.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.5rem; }
}
.prx-shrink .prx-shrink-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.4rem;
  align-items: flex-end;
  width: 100%;
}
.prx-shrink .prx-shrink-views {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
}
.prx-shrink .prx-shrink-views > legend {
  flex: 1 1 100%;
}
.prx-shrink .prx-stage {
  container-type: inline-size;
}
.prx-shrink .prx-stage .prx-shrink-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.22rem 0.85rem;
  margin: 0 0 0.35rem;
  padding: 0 0 0.3rem;
  border-bottom: 1px solid var(--prx-border);
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-shrink .prx-stage .prx-shrink-key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.75rem;
  margin: 0;
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-shrink .prx-stage .prx-shrink-se-strip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.55rem;
  font-weight: 600;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-shrink .prx-shrink-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.prx-shrink .prx-shrink-swatch {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 1.4rem;
  height: 0.9rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border);
  border-radius: 3px;
}
.prx-shrink .prx-shrink-swatch::before,
.prx-shrink .prx-shrink-swatch::after {
  content: "";
  position: absolute;
}
.prx-shrink .prx-shrink-dot::before {
  left: 50%;
  top: 50%;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.prx-shrink .prx-shrink-dot-est::before { background: var(--prx-est); }
.prx-shrink .prx-shrink-dot-post::before { background: var(--prx-post); }
.prx-shrink .prx-shrink-arrow::before {
  left: 0.14rem;
  right: 0.38rem;
  top: calc(50% - 0.75px);
  border-top: 1.5px solid var(--prx-plot-muted);
}
.prx-shrink .prx-shrink-arrow::after {
  right: 0.14rem;
  top: calc(50% - 3.2px);
  border-left: 5.5px solid var(--prx-plot-muted);
  border-top: 3.2px solid transparent;
  border-bottom: 3.2px solid transparent;
}
.prx-shrink .prx-shrink-rule-line::before {
  left: calc(50% - 0.75px);
  top: 0.1rem;
  bottom: 0.1rem;
  border-left: 1.5px dashed var(--prx-plot-axis);
}
.prx-shrink .prx-stage .prx-shrink-cross::before {
  content: "×";
  inset: 0;
  font-weight: 700;
  line-height: 0.9rem;
  text-align: center;
  color: var(--prx-plot-fg);
}
.prx-shrink .prx-shrink-ring { background: var(--prx-plot-grid); }
.prx-shrink .prx-shrink-ring::before {
  left: 50%;
  top: 50%;
  width: 0.7rem;
  height: 0.7rem;
  border: 1.5px solid var(--prx-plot-fg);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.prx-shrink .prx-shrink-ring::after {
  left: 50%;
  top: 50%;
  width: 0.36rem;
  height: 0.36rem;
  border-radius: 50%;
  background: var(--prx-post);
  transform: translate(-50%, -50%);
}
.prx-shrink .prx-shrink-line::before {
  left: 0.14rem;
  right: 0.14rem;
  top: calc(50% - 0.8px);
  border-top: 1.6px solid var(--prx-est);
}
.prx-shrink .prx-shrink-line-medium::before {
  border-top-color: var(--prx-plot-muted);
  border-top-style: dashed;
}
.prx-shrink .prx-shrink-line-large::before {
  top: calc(50% - 1px);
  border-top: 2px dotted var(--prx-post);
}
.prx-shrink .prx-stage .prx-shrink-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem 1.25rem;
  align-items: start;
}
@container (min-width: 48rem) {
  .prx-shrink .prx-stage .prx-shrink-grid {
    grid-template-columns: minmax(0, 1.36fr) minmax(0, 1fr);
  }
}
.prx-shrink .prx-shrink-grid > .prx-shrink-units,
.prx-shrink .prx-shrink-grid > .prx-shrink-side {
  grid-area: auto;
  min-width: 0;
  margin-top: 0;
}
.prx-shrink .prx-shrink-side-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.2rem 0.75rem;
  margin: 0 0 0.2rem;
}
.prx-shrink .prx-shrink-heading {
  margin: 0;
}
.prx-shrink .prx-stage .prx-shrink-crossings {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.prx-shrink .prx-stage .prx-shrink-truth-strip {
  display: grid;
  gap: 0.18rem;
  margin: 0.35rem 0 0;
  padding: 0.3rem 0.45rem;
  font-size: 0.8125rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border-top: 1px solid var(--prx-border);
}
.prx-shrink .prx-stage .prx-shrink-truth-strip > p {
  margin: 0;
}
.prx-shrink .prx-shrink-data-stack,
.prx-shrink .prx-shrink-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}
.prx-shrink .prx-shrink-note,
.prx-shrink .prx-shrink-lead {
  margin: 0.25rem 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}
.prx-shrink .prx-shrink-lead {
  color: var(--prx-fg);
  font-weight: 600;
}
.prx-shrink .prx-shrink-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}
.prx-shrink .prx-shrink-table {
  border-collapse: collapse;
  margin: 0.25rem 0;
  font-size: 0.9em;
}
.prx-shrink .prx-shrink-table caption {
  caption-side: top;
  text-align: left;
  font-weight: 600;
  color: var(--prx-fg-muted);
}
.prx-shrink .prx-shrink-table th,
.prx-shrink .prx-shrink-table td {
  padding: 0.2rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: right;
  vertical-align: top;
  overflow-wrap: normal;
  word-break: normal;
}
.prx-shrink .prx-shrink-table thead th:first-child { text-align: left; }
.prx-shrink .prx-shrink-table th[scope="row"] { text-align: left; font-weight: 400; }
.prx-shrink .prx-shrink-table thead th { font-weight: 600; }
.prx-shrink .prx-shrink-sub {
  display: block;
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}
.prx-shrink .prx-shrink-price-body > p {
  margin: 0.4rem 0;
  font-size: 0.9em;
}
.prx-shrink .prx-shrink-rule {
  margin: 0;
  padding: 0.55rem 0.75rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius);
}
.prx-shrink .prx-shrink-formulas {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.prx-shrink .prx-shrink-tex { overflow-wrap: normal; }
.prx-shrink .prx-shrink-tex math { max-width: none; }
.prx-shrink .prx-shrink-gloss { display: inline; font-style: normal; }
`;

/** Format fixed-decimal continuous table values without bare-zero collapse. */
const formatTableVal = (v, digits = 3) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

const fmtShare2 = (x) => formatTableVal(x, CONFIG.digits.share);
const fmtValue3 = (x) => formatTableVal(x, CONFIG.digits.value);
const fmtSd3 = (x) => formatTableVal(x, CONFIG.digits.sd);
const sizeText = (u) => `${T.groupWord[u.group]} unit (${formatCount(u.size)}${T.obsEach}, SE ${fmtShare2(u.se)})`;

/** Fill "{slot}" placeholders in a template with strings or fresh DOM nodes. */
const fill = (template, slots) =>
  template
    .split(/(\{\w+\})/)
    .filter((p) => p !== "")
    .map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (!m || !(m[1] in slots)) return p;
      const v = slots[m[1]];
      return typeof v === "function" ? v() : v;
    });

/** Group stroke color for rank-change lines: vermillion (small/noisy), muted slate (medium), navy (large/precise). */
function groupStroke(c, group) {
  if (group === "small") return c.est;
  if (group === "large") return c.post;
  return c.plotMuted;
}

/** Row positions of the units figure (preserving exact group + estimate sort order of rowLayout). */
function v2RowLayout(units) {
  const U = V2_UNITS;
  const rows = [];
  const heads = [];
  let y = 0;
  CONFIG.groups.forEach((g, k) => {
    if (k) y += U.gapRows;
    y += U.headRows;
    heads.push({ group: g, y: y - U.headDy });
    const members = units.filter((u) => u.group === g).sort((a, b) => b.est - a.est || a.i - b.i);
    for (const u of members) {
      rows.push({ ...u, y });
      y += 1;
    }
  });
  return { rows, heads, top: heads[0].y - U.band, bottom: y - 1 + U.band };
}

/** Primary left-hand shrinkage-arrows chart at >= 12.3px typography with clear row pitch. */
function drawV2Units(el, r, { truth = false, equalSe = r.equalSe, width } = {}) {
  const U = V2_UNITS;
  const lay = v2RowLayout(r.units);
  const [lo, hi] = valueDomain(r.units);
  const w = Math.max(1, Math.round(width || el.clientWidth || U.defaultWidth));
  const mobile = w < 420;
  const rowPx = mobile ? U.rowPxMobile : U.rowPxDesktop;
  const idSize = mobile ? U.idSizeMobile : U.idSizeDesktop;
  const inner = Math.max(1, w - U.marginLeft - U.marginRight);
  const pxPerUnit = inner / (hi - lo || 1);
  const heads = equalSe ? T.groupHeadEqual : T.groupHead;
  const far = truth ? lay.rows.filter((d) => d.farther) : [];
  const px = (d) => Math.abs(d.pm - d.est) * pxPerUnit;
  const xTicks = mobile ? 5 : 7;

  const columns = [
    { label: T.colUnit, value: "id" },
    { label: T.colSize, value: "size", format: (v) => formatCount(v) },
    { label: T.colSe, value: "se", format: (v) => fmtShare2(v) },
    { label: T.colEstimate, value: "est", format: (v) => fmtValue3(v) },
    { label: T.colShare, value: "share", format: (v) => fmtShare2(v) },
    { label: T.colPostMean, value: "pm", format: (v) => fmtValue3(v) },
    { label: T.colPostSd, value: "psd", format: (v) => fmtSd3(v) },
  ];
  if (truth) {
    columns.push(
      { label: T.colTruth, value: "theta", format: (v) => fmtValue3(v) },
      { label: T.colFarther, value: (d) => (d.farther ? T.yes : T.no) },
    );
  }

  return plot(el, {
    alt: T.unitsAlt + (truth ? T.unitsAltTruth : ""),
    table: { caption: T.unitsTable, columns, rows: lay.rows },
    width: w,
    height: U.marginTop + U.marginBottom + Math.round((lay.bottom - lay.top) * rowPx),
    marginTop: U.marginTop,
    marginBottom: U.marginBottom,
    marginLeft: U.marginLeft,
    marginRight: U.marginRight,
    aspect: false,
    x: {
      domain: [lo, hi],
      nice: true,
      ticks: xTicks,
      grid: true,
      label: truth ? T.xLabel : T.xLabelPost,
      labelAnchor: "center",
      labelArrow: "none",
      labelOffset: U.labelOffset,
    },
    y: { domain: [lay.top, lay.bottom], reverse: true, axis: null },
    marks: (c, P) => [
      truth ? P.rect(far, { y1: (d) => d.y - U.band, y2: (d) => d.y + U.band, fill: c.plotGrid }) : null,
      P.ruleX([CONFIG.priorMean], { stroke: c.plotAxis, strokeDasharray: U.rule }),
      P.text(lay.heads, {
        frameAnchor: "left",
        y: "y",
        text: (d) => heads[d.group],
        dx: U.headInset,
        textAnchor: "start",
        fill: c.plotFg,
        fontWeight: "bold",
        fontSize: mobile ? 12.6 : 13,
        stroke: c.plotBg,
        strokeWidth: U.headHalo,
        paintOrder: "stroke",
      }),
      P.text(lay.rows, {
        frameAnchor: "left",
        y: "y",
        text: "id",
        dx: U.idDx,
        textAnchor: "end",
        fill: c.plotFg,
        fontSize: idSize,
      }),
      P.link(lay.rows.filter((d) => px(d) < U.arrowMinPx), {
        x1: "est",
        x2: "pm",
        y1: "y",
        y2: "y",
        stroke: c.plotMuted,
        strokeWidth: U.line,
      }),
      P.arrow(lay.rows.filter((d) => px(d) >= U.arrowMinPx), {
        x1: "est",
        x2: "pm",
        y1: "y",
        y2: "y",
        stroke: c.plotMuted,
        strokeWidth: U.line,
        headLength: U.headLength,
        insetEnd: U.dot,
        bend: 0,
      }),
      truth ? P.dot(lay.rows, { x: "theta", y: "y", symbol: "times", r: U.truth, stroke: c.plotFg, strokeWidth: U.truthWidth }) : null,
      P.dot(lay.rows, { x: "est", y: "y", r: U.dot, fill: c.est, stroke: c.plotBg, strokeWidth: U.dotRim }),
      P.dot(lay.rows, { x: "pm", y: "y", r: U.dot, fill: c.post, stroke: c.plotBg, strokeWidth: U.dotRim }),
      truth ? P.dot(far, { x: "pm", y: "y", r: U.ring, fill: "none", stroke: c.plotFg, strokeWidth: U.ringWidth }) : null,
    ],
    keyboard: {
      data: lay.rows,
      x: "pm",
      y: "y",
      key: "id",
      sort: false,
      pointer: true,
      label: T.unitsAlt,
      title: (d) => {
        let s = `${d.id}, ${sizeText(d)}: ${T.tipEstimate}${formatDecimal(d.est, { digits: CONFIG.digits.value })}, ${T.tipPosterior}${formatDecimal(d.pm, { digits: CONFIG.digits.value })} (${T.tipKeeps}${formatDecimal(d.share, { digits: CONFIG.digits.share })})`;
        if (truth) s += `; ${T.tipTruth}${formatDecimal(d.theta, { digits: CONFIG.digits.value })}, so ${d.farther ? T.tipFarther : T.tipCloser}`;
        return `${s}.`;
      },
    },
  });
}

/** Linked right-hand rank-change slope chart with explicit Rank 1..30 scale, >= 12.3px text, and 0 collisions. */
function drawV2Order(el, r, { width } = {}) {
  const O = V2_ORDER;
  const w = Math.max(1, Math.round(width || el.clientWidth || O.defaultWidth));
  const compact = w < 360;
  const fontSize = compact ? O.fontSizeMobile : O.fontSizeDesktop;
  const dotR = compact ? O.dotMobile : O.dotDesktop;
  const byRank = r.units.slice().sort((a, b) => a.rankEst - b.rankEst);
  const height = O.marginTop + O.marginBottom + Math.round((r.units.length - 1) * O.rowPx);
  return plot(el, {
    alt: T.orderAlt,
    table: {
      caption: T.orderTable,
      columns: [
        { label: T.colUnit, value: "id" },
        { label: T.colSize, value: "size", format: (v) => formatCount(v) },
        { label: T.colRankEst, value: "rankEst", format: (v) => formatCount(v) },
        { label: T.colRankPost, value: "rankPost", format: (v) => formatCount(v) },
        { label: T.colChanges, value: "changes", format: (v) => formatCount(v) },
      ],
      rows: byRank,
    },
    width: w,
    height,
    marginTop: O.marginTop,
    marginBottom: O.marginBottom,
    marginLeft: O.marginLeft,
    marginRight: O.marginRight,
    aspect: false,
    x: { domain: [0, 1], axis: null },
    y: { domain: [1, r.units.length], reverse: true, axis: null },
    marks: (c, P) => [
      P.ruleY(RANK_TICKS, { x1: 0, x2: 1, stroke: c.plotGrid, strokeDasharray: "2,3" }),
      ...CONFIG.groups.map((g) =>
        P.link(
          r.units.filter((u) => u.group === g),
          {
            x1: 0,
            x2: 1,
            y1: "rankEst",
            y2: "rankPost",
            stroke: groupStroke(c, g),
            strokeWidth: O.line,
            strokeOpacity: (d) => (d.changes > 0 ? 0.85 : 0.42),
            strokeDasharray: O.dashes[g] ?? undefined,
          },
        ),
      ),
      P.dot(r.units, { x: 0, y: "rankEst", r: dotR, fill: c.est }),
      P.dot(r.units, { x: 1, y: "rankPost", r: dotR, fill: c.post }),
      numText(RANK_TICKS, {
        x: () => 0,
        y: (v) => v,
        value: (v) => v,
        format: (v) => formatCount(v),
        dx: O.rankDx,
        textAnchor: "end",
        fill: c.plotMuted,
        fontSize,
      }),
      P.text(["Rank"], {
        x: () => 0,
        y: () => 1,
        text: (d) => d,
        dx: O.rankDx,
        dy: O.headDy,
        textAnchor: "end",
        fill: c.plotMuted,
        fontWeight: 600,
        fontSize,
      }),
      P.text([T.orderLeft], {
        x: () => 0,
        y: () => 1,
        text: (d) => d,
        dx: -O.idDx,
        dy: O.headDy,
        textAnchor: "start",
        fill: c.estText,
        fontWeight: 600,
        fontSize,
      }),
      P.text([T.orderRight], {
        x: () => 1,
        y: () => 1,
        text: (d) => d,
        dx: O.idDx,
        dy: O.headDy,
        textAnchor: "end",
        fill: c.postText,
        fontWeight: 600,
        fontSize,
      }),
      P.text(r.units, {
        x: 0,
        y: "rankEst",
        text: "id",
        dx: -O.idDx,
        textAnchor: "end",
        fill: c.plotFg,
        fontSize,
      }),
      P.text(r.units, {
        x: 1,
        y: "rankPost",
        text: "id",
        dx: O.idDx,
        textAnchor: "start",
        fill: c.plotFg,
        fontSize,
      }),
    ],
    keyboard: {
      data: byRank,
      x: () => 0,
      y: "rankEst",
      key: "id",
      sort: false,
      pointer: true,
      label: T.orderAlt,
      title: (d) =>
        `${d.id}, ${sizeText(d)}: ${T.tipRank}${formatCount(d.rankEst)}${T.tipByEstimate}${formatCount(d.rankPost)}${T.tipByPosterior}; ${T.tipOrder}${formatCount(d.changes)} ${d.changes === 1 ? T.tipOrderOne : T.tipOrderMany}.`,
    },
  });
}

/** Right-hand truth-comparison bar chart in view 2 (3-sig-fig MSE in this draw and expected over draws). */
function drawV2TruthSummary(el, r, { width } = {}) {
  const V = V2_TRUTH;
  const w = Math.max(1, Math.round(width || el.clientWidth || V.defaultWidth));
  const rows = [
    { id: "draw-est", row: "This draw (est.)", val: r.mseEst, kind: "est", expected: false },
    { id: "draw-post", row: "This draw (post.)", val: r.msePost, kind: "post", expected: false },
    { id: "exp-est", row: "Expected (est.)", val: r.expectedMseEst, kind: "est", expected: true },
    { id: "exp-post", row: "Expected (post.)", val: r.expectedMsePost, kind: "post", expected: true },
  ];
  const maxVal = Math.max(0.005, ...rows.map((d) => d.val));
  const xTicks = w < 420 ? 3 : 4;

  return plot(el, {
    alt: "Horizontal bars comparing average squared distance to the true values for estimates and posterior means in this draw and expected over many draws.",
    width: w,
    height: V.height,
    marginTop: V.marginTop,
    marginBottom: V.marginBottom,
    marginLeft: V.marginLeft,
    marginRight: V.marginRight,
    aspect: false,
    x: {
      domain: [0, maxVal * 1.24],
      ticks: xTicks,
      grid: true,
      label: T.rowMse,
      labelAnchor: "center",
      labelArrow: "none",
      labelOffset: V.labelOffset,
    },
    y: { domain: rows.map((d) => d.row), padding: 0.34, axis: null },
    marks: (c, P) => [
      P.barX(rows, {
        x1: 0,
        x2: "val",
        y: "row",
        fill: (d) => (d.kind === "est" ? c.est : c.post),
        fillOpacity: (d) => (d.expected ? 0.68 : 0.92),
        rx: 2,
      }),
      P.ruleX([0], { stroke: c.plotAxis }),
      P.text(rows, {
        y: "row",
        frameAnchor: "left",
        dx: -8,
        textAnchor: "end",
        text: "row",
        fill: c.plotFg,
        fontSize: V.fontSize,
      }),
      numText(rows, {
        x: "val",
        y: "row",
        value: "val",
        format: (v) => formatReadoutRisk(v),
        dx: 6,
        textAnchor: "start",
        fill: c.plotFg,
        fontWeight: 600,
        fontSize: V.fontSize,
      }),
    ],
    keyboard: {
      data: rows,
      x: "val",
      y: "row",
      key: "id",
      sort: false,
      pointer: true,
      label: T.rowMse,
      title: (d) => `${d.row}: ${formatReadoutRisk(d.val)}.`,
    },
  });
}

/** Render complete 30-unit audit table in Data disclosure. */
function renderFullUnitDataTable(ctx, slot, r, { truth = false } = {}) {
  const lay = v2RowLayout(r.units);
  const val4 = (v) => formatTableVal(v, 4);
  const columns = [
    { key: "id", label: T.colUnit, rowHeader: true, name: true },
    { label: T.colUnits, value: (d) => T.groupName[d.group] },
    { key: "size", label: T.colSize, kind: "count" },
    { key: "se", label: T.colSe, kind: "setting" },
    { key: "est", label: T.colEstimate, format: val4 },
    { key: "share", label: T.colShare, kind: "share" },
    { key: "pm", label: T.colPostMean, format: val4 },
    { key: "psd", label: T.colPostSd, format: val4 },
    { key: "rankEst", label: T.colRankEst, kind: "count" },
    { key: "rankPost", label: T.colRankPost, kind: "count" },
    { key: "changes", label: T.colChanges, kind: "count" },
  ];
  if (truth) {
    columns.push(
      { key: "theta", label: T.colTruth, format: val4 },
      { label: T.colFarther, value: (d) => (d.farther ? T.yes : T.no) },
    );
  }
  const caption = [
    "All ",
    ctx.num(N_UNITS, formatCount(N_UNITS)),
    " units of the simulated league (prior SD ",
    ctx.num(r.priorSd, formatSetting(r.priorSd)),
    ", seed ",
    ctx.num(r.seed, formatSetting(r.seed)),
    ")",
  ];
  slot.replaceChildren(
    renderDataTable(ctx, {
      columns,
      rows: lay.rows,
      caption,
      label: "All thirty simulated league units: estimate, posterior and rank",
      sticky: 1,
    }),
  );
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    frame: "v2",
    css: V2_CSS,
    keys: {
      priorSd: {
        type: "number",
        min: CONFIG.priorSd.min,
        max: CONFIG.priorSd.max,
        step: CONFIG.priorSd.step,
        value: CONFIG.priorSd.value,
      },
      equalSe: { type: "custom", value: false, parse: (v) => parseOnOff(v) },
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      view: { type: "integer", min: CONFIG.view.min, max: CONFIG.view.max, value: CONFIG.view.value },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const hookNum = (name, raw, display) => w.num(raw, display, { hook: name });
      const zero = () => w.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 }));

      // --- Primary controls (ctx.controls): Prior SD slider + Equal SEs toggle
      const prior = ctx.slider({
        label: T.sliderLabel,
        ...ctx.key("priorSd"),
        name: "priorSd",
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      ctx.primaryControl(prior.root);

      const equal = ctx.toggle({
        label: T.toggleLabel,
        checked: ctx.state.equalSe,
        name: "equalSe",
        onChange: (b) => ctx.set({ equalSe: b }),
      });
      ctx.controls.append(prior.root, equal.root);

      // --- Secondary controls (ctx.settingsBox): View switch + Seed input
      const views = ctx.radioGroup({
        legend: T.viewLegend,
        name: "view",
        className: "prx-shrink-views",
        options: CONFIG.views.map((v) => ({ value: v.value, label: v.label })),
        value: ctx.state.view,
        onChange: (v) => ctx.set({ view: v }),
      });
      const syncViewStops = () =>
        views.inputs.forEach((r) => (r.checked ? r.removeAttribute("tabindex") : r.setAttribute("tabindex", "-1")));

      const seedHintId = uid("prx-shrink-seed");
      const seedInput = ctx.numberInput({
        label: "Seed",
        min: CONFIG.seed.min,
        max: CONFIG.seed.max,
        step: 1,
        value: ctx.state.seed,
        name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seedInput.input.setAttribute("aria-describedby", seedHintId);

      ctx.settingsBox("Settings").body.append(
        h("div", { class: "prx-shrink-settings-grid" }, views.root, seedInput.root),
      );

      // --- Primary stage (ctx.stage): 1-line mark & SE header + 2-panel linked graphic
      const unitsKey = h("div", { class: "prx-shrink-key" });
      const seStrip = h("div", { class: "prx-shrink-se-strip" });
      const stageHead = h("div", { class: "prx-shrink-stage-head", "data-prx-part": "legend" }, unitsKey, seStrip);

      const unitsSlot = ctx.primaryGraphic(h("div", { class: "prx-shrink-units-chart" }));
      const unitsBox = h("section", { class: "prx-shrink-units", "aria-label": CONFIG.title }, unitsSlot);

      const crossingsLine = h("p", { class: "prx-shrink-crossings" });
      const orderSlot = h("div", { class: "prx-shrink-order-chart" });
      const orderKey = h(
        "div",
        { class: "prx-shrink-key", "data-prx-part": "legend" },
        ...[["small", T.keyOrderSmall], ["medium", T.keyOrderMedium], ["large", T.keyOrderLarge]].map(([g, words]) =>
          h(
            "span",
            { class: "prx-shrink-item" },
            h("span", { class: `prx-shrink-swatch prx-shrink-line prx-shrink-line-${g}`, "aria-hidden": "true" }),
            words,
          ),
        ),
      );
      const orderBox = h(
        "section",
        { class: "prx-shrink-order", "aria-label": T.orderHeading },
        h("div", { class: "prx-shrink-side-head" }, ctx.panelTitle(T.orderHeading, { className: "prx-shrink-heading" }), crossingsLine),
        orderSlot,
        orderKey,
      );

      const truthChartSlot = h("div", { class: "prx-shrink-truth-chart" });
      const truthStrip = h("div", { class: "prx-shrink-truth-strip" });
      const truthStageBox = h(
        "section",
        { class: "prx-shrink-truth-stage", "aria-label": T.priceHeading, hidden: true },
        h("div", { class: "prx-shrink-side-head" }, ctx.panelTitle(T.priceHeading, { className: "prx-shrink-heading" })),
        truthChartSlot,
        truthStrip,
      );

      const side = h("div", { class: "prx-shrink-side" }, orderBox, truthStageBox);
      ctx.stage.append(stageHead, h("div", { class: "prx-shrink-grid" }, unitsBox, side));

      // --- Data disclosure ("Data and unit values"): complete 30-unit table + exact truth-comparison table (view 2)
      const dataUnitsSlot = h("div", { class: "prx-shrink-data-units" });
      const priceBody = h("div", { class: "prx-shrink-price-body" });
      const priceLead = h("p", { class: "prx-shrink-lead" });
      const priceBox = h(
        "section",
        { class: "prx-shrink-price", "aria-label": T.priceHeading, hidden: true },
        ctx.panelTitle(T.priceHeading, { className: "prx-shrink-heading" }),
        priceLead,
        priceBody,
      );
      ctx.dataBox("Data and unit values").body.append(
        h("div", { class: "prx-shrink-data-stack" }, priceBox, dataUnitsSlot),
      );

      // --- Method disclosure ("Method and formula"): posterior formulas, 3-size weight table, scope note & draw provenance
      const ruleHead = ctx.panelTitle("", { className: "prx-shrink-heading" });
      const texMean = h("div", { class: "prx-shrink-tex", "data-prx-tex": "mean" });
      const texSd = h("div", { class: "prx-shrink-tex", "data-prx-tex": "sd" });
      const formulas = ctx.scrollRegion(h("div", { class: "prx-shrink-formulas" }, texMean, texSd), T.formulas);
      const symEstimate = h("span");
      const symSe = h("span");
      const symbols = h(
        "p",
        { class: "prx-shrink-note" },
        T.symbolsA,
        symEstimate,
        T.symbolsB,
        h("i", { text: T.symbolsUnit }),
        T.symbolsC,
        symSe,
        T.symbolsD,
      );
      const ruleTable = h("div");
      const ruleScope = h("p", { class: "prx-shrink-note" });
      const rule = h(
        "section",
        { class: "prx-shrink-rule", "aria-label": T.ruleTable },
        ruleHead,
        formulas,
        symbols,
        ruleTable,
        ruleScope,
      );
      renderTex(texMean, CONFIG.tex.mean, { display: true });
      renderTex(texSd, CONFIG.tex.sd, { display: true });
      renderTex(symEstimate, CONFIG.tex.estimate, { display: false });
      renderTex(symSe, CONFIG.tex.se, { display: false });

      const sizesKey = h("p", { class: "prx-shrink-note", "data-prx-part": "notes" });
      const note = h("p", { id: seedHintId, class: "prx-shrink-note prx-shrink-source", "data-prx-part": "notes" });
      ctx.methodBox("Method and formula").body.append(
        h("div", { class: "prx-shrink-method-stack" }, rule, sizesKey, note),
      );

      ctx.caption.replaceChildren(
        captionNode(ctx, "teaching-posterior"),
        ". ",
        h("span", { class: "prx-shrink-gloss", text: T.gloss }),
      );

      const wrapTable = (table, label) => ctx.scrollRegion(h("div", { class: "prx-shrink-table-wrap" }, table), label);

      function drawStageHeader(state) {
        const truth = state.view === 2 && !state.equalSe;
        const item = (cls, ...words) =>
          h("span", { class: "prx-shrink-item" }, h("span", { class: `prx-shrink-swatch ${cls}`, "aria-hidden": "true" }), ...words);
        unitsKey.replaceChildren(
          ...[
            item("prx-shrink-dot prx-shrink-dot-est", T.keyEstimate),
            item("prx-shrink-arrow", "shrinkage move"),
            item("prx-shrink-dot prx-shrink-dot-post", T.keyPosterior),
            item("prx-shrink-rule-line", T.keyPrior, zero()),
            truth ? item("prx-shrink-cross", T.keyTruth) : null,
            truth ? item("prx-shrink-ring", "ends farther") : null,
          ].filter(Boolean),
        );

        const [s, m, l] = CONFIG.groups.map((g) => LEAGUE.ids.findIndex((_, i) => LEAGUE.group[i] === g));
        if (state.equalSe) {
          seStrip.replaceChildren("Every unit SE ", w.setting(CONFIG.equalSe));
        } else {
          seStrip.replaceChildren(
            h("span", {}, "Small SE ", w.setting(LEAGUE.se[s])),
            " · ",
            h("span", {}, "Medium SE ", w.setting(LEAGUE.se[m])),
            " · ",
            h("span", {}, "Large SE ", w.setting(LEAGUE.se[l])),
          );
        }

        const n = (i) => w.count(LEAGUE.size[i]);
        const se = (i) => w.num(LEAGUE.se[i], fmtShare2(LEAGUE.se[i]));
        sizesKey.replaceChildren(
          ...(state.equalSe
            ? [T.sizesEqualA, w.setting(CONFIG.equalSe), T.sizesEqualB]
            : [
              T.sizesA,
              n(s),
              T.sizesB,
              se(s),
              T.sizesMedium,
              n(m),
              T.sizesComma,
              se(m),
              T.sizesLarge,
              n(l),
              T.sizesComma,
              se(l),
              ".",
            ]),
        );
      }

      function drawOrderPanel(r) {
        drawV2Order(orderSlot, r, { width: orderSlot.clientWidth || V2_ORDER.defaultWidth });
        crossingsLine.replaceChildren(
          hookNum("crossings", r.reordered, formatCount(r.reordered)),
          " of ",
          w.count(M),
          " pairs cross",
        );
      }

      function drawTruthStage(state, r) {
        if (state.equalSe) {
          truthChartSlot.replaceChildren();
          truthStrip.replaceChildren(
            h(
              "p",
              {},
              "Every SE is set to ",
              w.setting(CONFIG.equalSe),
              ", keeping the estimate order (",
              w.count(r.truthEst),
              " of ",
              w.count(M),
              " pairs against the true order).",
            ),
          );
          return;
        }
        drawV2TruthSummary(truthChartSlot, r, { width: truthChartSlot.clientWidth || V2_TRUTH.defaultWidth });
        truthStrip.replaceChildren(
          h(
            "p",
            {},
            "Expected over draws: ",
            w.risk(r.expectedMseEst),
            " (estimates) vs. ",
            w.risk(r.expectedMsePost),
            " (posterior).",
          ),
          h(
            "p",
            {},
            "Spread (SD): ",
            w.est(r.spreadEst),
            " → ",
            w.est(r.spreadPost),
            " (truth ",
            w.est(r.spreadTruth),
            ") · Wrong pairs: ",
            w.count(r.truthEst),
            " → ",
            w.count(r.truthPost),
            ".",
          ),
        );
      }

      function drawPrice(state, r) {
        priceLead.hidden = state.equalSe;
        if (state.equalSe) {
          priceLead.textContent = "";
          priceBody.replaceChildren(
            h(
              "p",
              {},
              T.equalNoteA,
              w.setting(CONFIG.equalSe),
              T.equalNoteB,
              hookNum("truth-est", r.truthEst, formatCount(r.truthEst)),
              T.equalNoteC,
            ),
          );
          return;
        }
        const D = CONFIG.digits;
        const mse = (x) => formatTableVal(x, D.mse);
        const sd = (x) => formatTableVal(x, D.spread);
        const row = (head, a, b) => h("tr", {}, h("th", { scope: "row" }, ...head), h("td", {}, a), h("td", {}, b));
        const table = h(
          "table",
          { class: "prx-shrink-table" },
          h("caption", {}, T.priceTable, ", prior SD ", w.setting(state.priorSd)),
          h("thead", {}, h("tr", {}, h("td", {}), h("th", { scope: "col", text: T.colEstimates }), h("th", { scope: "col", text: T.colPosterior }))),
          h(
            "tbody",
            {},
            row([T.rowMse], hookNum("mse-est", r.mseEst, mse(r.mseEst)), hookNum("mse-post", r.msePost, mse(r.msePost))),
            row(
              [T.rowTruth, w.count(M)],
              hookNum("truth-est", r.truthEst, formatCount(r.truthEst)),
              hookNum("truth-post", r.truthPost, formatCount(r.truthPost)),
            ),
            row([T.rowSpread], hookNum("spread-est", r.spreadEst, sd(r.spreadEst)), hookNum("spread-post", r.spreadPost, sd(r.spreadPost))),
          ),
        );
        const L = T.priceLead;
        priceLead.textContent =
          r.msePost < r.mseEst
            ? r.farther > 0
              ? L.closerSome
              : L.closer
            : r.expectedMsePost < r.expectedMseEst
              ? L.fartherDraw
              : L.farther;
        const ex = (x) => formatExpectedCount(x);
        priceBody.replaceChildren(
          wrapTable(table, `${T.priceTable}, prior SD ${formatSetting(state.priorSd)}`),
          h("p", {}, T.spreadTruthA, hookNum("spread-truth", r.spreadTruth, sd(r.spreadTruth)), T.spreadTruthB),
          h("p", {}, T.farther, hookNum("farther", r.farther, formatCount(r.farther)), " of ", w.count(N_UNITS), T.fartherEnd),
          h(
            "p",
            {},
            T.expectedA,
            hookNum("expected-est", r.expectedEst, ex(r.expectedEst)),
            T.expectedB,
            hookNum("expected-post", r.expectedPost, ex(r.expectedPost)),
            T.expectedC,
            w.count(M),
            T.expectedD,
          ),
          h(
            "p",
            {},
            T.expectedMseA,
            hookNum("expected-mse-est", r.expectedMseEst, mse(r.expectedMseEst)),
            T.expectedMseB,
            hookNum("expected-mse-post", r.expectedMsePost, mse(r.expectedMsePost)),
            T.expectedMseC,
          ),
        );
      }

      function drawRule(state, r) {
        ruleHead.replaceChildren(T.ruleHead, zero());
        const rows = state.equalSe ? [r.bySize[0]] : r.bySize;
        const cell = (name, raw, display) => h("td", {}, hookNum(name, raw, display));
        const table = h(
          "table",
          { class: "prx-shrink-table" },
          h("caption", {}, T.ruleTable),
          h("thead", {}, h("tr", {}, ...[T.colUnits, T.colSe, T.colShare, T.colMoved, T.colPostSd].map((t) => h("th", { scope: "col", text: t })))),
          h(
            "tbody",
            {},
            ...rows.map((u) => {
              const g = state.equalSe ? "all" : u.group;
              const head = state.equalSe
                ? [T.groupName.small, ", ", T.groupWord.medium, " and ", T.groupWord.large]
                : [T.groupName[u.group], h("span", { class: "prx-shrink-sub" }, w.count(u.size), T.obsEach)];
              return h(
                "tr",
                {},
                h("th", { scope: "row" }, ...head),
                cell(`se-${g}`, u.se, fmtShare2(u.se)),
                cell(`share-${g}`, u.share, fmtShare2(u.share)),
                cell(`step-${g}`, u.moved, fmtShare2(u.moved)),
                cell(`postsd-${g}`, u.psd, fmtSd3(u.psd)),
              );
            }),
          ),
        );
        ruleTable.replaceChildren(wrapTable(table, T.ruleTable), h("p", { class: "prx-shrink-note", text: T.ruleNote }));
        ruleScope.replaceChildren(...fill(T.ruleScope, { zero }));
      }

      function writeReadout(state, r) {
        const ps = w.setting(state.priorSd, { hook: "prior-sd" });
        const reordered = w.count(r.reordered, { hook: "reordered" });
        const pairs = w.count(M, { hook: "pairs" });

        if (state.view === 1 && state.equalSe) {
          const u = r.bySize[0];
          w.set([
            "Prior SD ",
            ps,
            ", every SE ",
            w.setting(CONFIG.equalSe, { hook: "equal-se" }),
            ": every unit keeps ",
            w.num(u.share, formatShare(u.share)),
            " (moves ",
            w.num(u.moved, formatShare(u.moved), { hook: "moved-all" }),
            " toward ",
            zero(),
            "), reordering ",
            reordered,
            " of the ",
            pairs,
            " pairs.",
          ]);
          return;
        }

        if (state.view === 1) {
          const [s, m, l] = r.bySize;
          w.set([
            "Prior SD ",
            ps,
            ": small units move ",
            w.num(s.moved, formatShare(s.moved), { hook: "moved-small" }),
            " toward ",
            zero(),
            ", medium ",
            w.num(m.moved, formatShare(m.moved), { hook: "moved-medium" }),
            " and large ",
            w.num(l.moved, formatShare(l.moved), { hook: "moved-large" }),
            ", reordering ",
            reordered,
            " of the ",
            pairs,
            " pairs.",
          ]);
          return;
        }

        if (state.equalSe) {
          const u = r.bySize[0];
          w.set([
            "Prior SD ",
            ps,
            ", every SE ",
            w.setting(CONFIG.equalSe, { hook: "equal-se" }),
            " (moves ",
            w.num(u.moved, formatShare(u.moved), { hook: "moved-all" }),
            " toward ",
            zero(),
            "; ",
            reordered,
            " of ",
            pairs,
            " pairs reordered): equal SEs preserve the estimate order against truth.",
          ]);
          return;
        }

        const [s, m, l] = r.bySize;
        const verb = r.msePost < r.mseEst ? "falls from " : "rises from ";
        w.set([
          "Prior SD ",
          ps,
          " (moves ",
          w.num(s.moved, formatShare(s.moved), { hook: "moved-small" }),
          ", ",
          w.num(m.moved, formatShare(m.moved), { hook: "moved-medium" }),
          ", ",
          w.num(l.moved, formatShare(l.moved), { hook: "moved-large" }),
          " toward ",
          zero(),
          "; ",
          reordered,
          " of ",
          pairs,
          " pairs reordered): mean squared error ",
          verb,
          w.risk(r.mseEst),
          " to ",
          w.risk(r.msePost),
          " (",
          w.count(r.farther),
          " of ",
          w.count(N_UNITS),
          " units end farther).",
        ]);
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;

          prior.set(state.priorSd);
          equal.set(state.equalSe);
          views.set(state.view);
          syncViewStops();
          if (Number(seedInput.input.value) !== state.seed) seedInput.set(state.seed);

          const r = compute(state);
          const truth = state.view === 2 && !state.equalSe;

          drawStageHeader(state);
          drawV2Units(unitsSlot, r, { truth, equalSe: state.equalSe, width: unitsSlot.clientWidth || ctx.width() });

          orderBox.hidden = state.view !== 1;
          truthStageBox.hidden = state.view !== 2;
          priceBox.hidden = state.view !== 2;

          if (state.view === 1) {
            truthChartSlot.replaceChildren();
            truthStrip.replaceChildren();
            priceLead.textContent = "";
            priceBody.replaceChildren();
            drawOrderPanel(r);
          } else {
            orderSlot.replaceChildren();
            crossingsLine.replaceChildren();
            drawTruthStage(state, r);
            drawPrice(state, r);
          }

          renderFullUnitDataTable(ctx, dataUnitsSlot, r, { truth });
          drawRule(state, r);
          writeReadout(state, r);

          note.replaceChildren(
            ...fill(T.note, {
              n: w.count(N_UNITS),
              seed: hookNum("seed", state.seed, formatSetting(state.seed)),
            }),
          );
        },
      };
    },
  });
}
