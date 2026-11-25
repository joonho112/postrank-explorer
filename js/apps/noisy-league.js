// App entry point for noisy-league (1.3: "Ranking noisy estimates", Frame v2).
// Keeps all shared domain/model/view exports from ../shared/domain/noisy-league.js intact for downstream apps (1.4).
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatReadoutExpected,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  CONFIG,
  EXPECTED,
  GROUP,
  LEAGUE,
  PAIRS,
  TRUTH,
  cssFor,
  drawLineNodes,
  drawSelect,
  drawTallies,
  drawWrongChart,
  fill,
  isExtreme,
  leagueRows,
  parseFlag,
  replayAverages,
  replayRunner,
  sizeCard,
  summaryMemo,
  textKit,
  words,
} from "../shared/domain/noisy-league.js";

export * from "../shared/domain/noisy-league.js";

const T = CONFIG.text;
const C = CONFIG.chart;
const R = CONFIG.replays.max;
const K = CONFIG.k;
const EXT = 2 * K;
const N_UNITS = LEAGUE.ids.length;

const V2_CHART = Object.freeze({
  row: 16,
  marginTop: 30,
  marginBottom: 38,
  marginLeft: 44,
  marginRight: 44,
  nameDx: 6,
  headDy: 8,
  whiskerWidth: 1.75,
  diamond: 4,
  link: 1.25,
  radius: Object.freeze({ small: 6, medium: 4.5, large: 3.6 }),
  replayHeight: 204,
  replayMarginTop: 26,
  replayMarginBottom: 40,
  replayMarginLeft: 42,
  replayMarginRight: 78,
  avgLabelHeight: 30,
  avgLabelGap: 4,
  avgDotDx: 11,
  avgTextDx: 22,
});

const V2_CSS = `
.prx-nl > .prx-title {
  margin: 0 0 0.3rem;
  font-size: 1rem;
  line-height: 1.25;
}
@media (max-width: 30em) {
  .prx-nl.prx-widget[data-prx-frame="v2"] { padding: 0.5rem 0.6rem 0.45rem; }
  .prx-nl.prx-widget[data-prx-frame="v2"] > .prx-title { font-size: 0.9rem; margin-bottom: 0.15rem; }
  .prx-nl.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-nl.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-nl.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-nl.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-nl.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
}
.prx-nl .prx-controls .prx-nl-primary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.prx-nl .prx-nl-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: flex-end;
  width: 100%;
}
.prx-nl .prx-nl-settings-grid .prx-nl-draw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}
.prx-nl .prx-nl-settings-grid .prx-nl-draw > label { margin: 0; }
.prx-nl .prx-nl-settings-grid .prx-nl-draw select:disabled { opacity: 0.55; cursor: default; }
.prx-nl .prx-nl-swatch-avg {
  flex: none;
  display: inline-block;
  width: 1.25rem;
  height: 0;
  border-top: 1.5px solid var(--prx-est);
}
.prx-nl .prx-nl-swatch-v2 {
  flex: none;
  display: inline-block;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1px solid var(--prx-plot-bg);
}
.prx-nl .prx-nl-swatch-v2-small { width: 12px; height: 12px; background: var(--prx-est); }
.prx-nl .prx-nl-swatch-v2-medium { width: 9px; height: 9px; background: var(--prx-neutral-6, #525252); }
.prx-nl .prx-nl-swatch-v2-large { width: 7.5px; height: 7.5px; background: var(--prx-post); }
.prx-nl .prx-nl-swatch-se {
  flex: none;
  display: inline-block;
  width: 1.1rem;
  height: 0;
  border-top: 2px solid var(--prx-est);
}
.prx-nl .prx-stage { container-type: inline-size; }
.prx-nl .prx-stage .prx-nl-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.35rem 1rem;
  margin: 0 0 0.45rem;
  padding: 0 0 0.4rem;
  border-bottom: 1px solid var(--prx-border);
  font-size: 0.84375rem;
}
.prx-nl .prx-stage .prx-nl-drawline {
  margin: 0;
  font-weight: 600;
  color: var(--prx-fg);
}
.prx-nl .prx-stage .prx-nl-groups-key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.9rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--prx-fg);
}
.prx-nl .prx-stage .prx-nl-groups-key > li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
}
.prx-nl .prx-stage .prx-nl-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem 1.4rem;
  align-items: start;
}
@container (min-width: 52rem) {
  .prx-nl .prx-stage .prx-nl-grid[data-replays="1"] {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  }
}
.prx-nl .prx-nl-grid > .prx-nl-league,
.prx-nl .prx-nl-grid > .prx-nl-replays,
.prx-nl .prx-nl-data-stack > .prx-nl-tallies {
  grid-area: auto;
  margin-top: 0;
}
.prx-nl .prx-stage .prx-nl-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.3rem 1rem;
  margin: 0.4rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.84375rem;
  background: var(--prx-plot-bg);
  border-top: 1px solid var(--prx-border);
}
.prx-nl .prx-stage .prx-nl-strip-marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.85rem;
  color: var(--prx-fg-muted);
}
.prx-nl .prx-stage .prx-nl-strip-counts {
  font-weight: 600;
  color: var(--prx-fg);
}
.prx-nl .prx-nl-data-stack,
.prx-nl .prx-nl-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}
.prx-nl .prx-nl-data-stack .prx-nl-table-wrap { margin-top: 0; }
`;

/** Format continuous estimate/theta values without bare-zero collapse. */
const formatTableVal = (v, digits = 3) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

/** Axis domain covering true values and estimate ± 1 SE intervals on CONFIG.nice.step multiples. */
function intervalDomain(summary, withReplays = true) {
  const draws = [summary.first, ...(withReplays ? summary.replays : [])];
  const bounds = [...LEAGUE.theta];
  for (const d of draws) {
    for (let i = 0; i < N_UNITS; i += 1) {
      bounds.push(d.estimate[i] - LEAGUE.se[i], d.estimate[i] + LEAGUE.se[i]);
    }
  }
  const { step, decimals, pad } = CONFIG.nice;
  const lo = Math.min(...bounds) - pad;
  const hi = Math.max(...bounds) + pad;
  const round = (x) => Number(x.toFixed(decimals));
  return [round(Math.floor(lo / step) * step), round(Math.ceil(hi / step) * step)];
}

/** Group color from resolved chart palette: vermillion (small/noisy), slate (medium), navy (large/precise). */
function groupColor(c, group) {
  if (group === "small") return c.est;
  if (group === "large") return c.post;
  return c.neutral?.[5] ?? c.plotMuted;
}

/** Label placement for right-margin replay averages at 13 px v2 typography. */
function v2AverageLabels({ small, large }) {
  const unit = (V2_CHART.replayHeight - V2_CHART.replayMarginTop - V2_CHART.replayMarginBottom) / EXT;
  const apart = (V2_CHART.avgLabelHeight + V2_CHART.avgLabelGap) / unit;
  const half = V2_CHART.avgLabelHeight / 2 / unit;
  const rows = [
    { g: "small", v: small },
    { g: "large", v: large },
  ].map((d) => ({ ...d, r: V2_CHART.radius[d.g], x: R + C.half, at: d.v }));
  const [hi, lo] = rows[0].v >= rows[1].v ? rows : [rows[1], rows[0]];
  if (hi.at - lo.at < apart) {
    const mid = (hi.at + lo.at) / 2;
    hi.at = mid + apart / 2;
    lo.at = mid - apart / 2;
  }
  const over = hi.at - (EXT - half);
  if (over > 0) {
    hi.at -= over;
    lo.at -= over;
  }
  const under = half - lo.at;
  if (under > 0) {
    hi.at += under;
    lo.at += under;
  }
  return rows;
}

/** Pattern 1 Dot & Interval League chart (v2): horizontal ± 1 SE bars + size/color-coded dots, >= 13px labels. */
function drawV2LeagueChart(ctx, { slot, key = null }, { draw, domain, reveal = false, highlight = false, inspect, select }) {
  const kit = textKit(ctx);
  const { h } = ctx;
  const rows = leagueRows(draw).map((d) => ({
    ...d,
    rV2: V2_CHART.radius[d.group],
    loSe: d.est - d.se,
    hiSe: d.est + d.se,
  }));
  const [lo, hi] = domain;
  const dim = (d) => (highlight && !isExtreme(d.pos, K) ? C.dimOpacity : 1);
  const height = V2_CHART.marginTop + V2_CHART.marginBottom + N_UNITS * V2_CHART.row;
  const seps = [K + C.half, N_UNITS - K + C.half];
  const bands = [
    { y1: C.half, y2: K + C.half },
    { y1: N_UNITS - K + C.half, y2: N_UNITS + C.half },
  ];
  const value3 = (v) => formatTableVal(v, CONFIG.digits.estimate);
  const slotWidth = slot.clientWidth || ctx.width();
  const xTicks = slotWidth < 440 ? 4 : 6;

  const tagNames = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
    Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-name", rows[i].id));
    return g;
  };

  const cols = [
    { label: T.tPosition, value: "pos", format: (v) => formatCount(v) },
    { label: T.tUnit, value: "id" },
    { label: T.tSize, value: (d) => T.groupWord[d.group] },
    { label: T.tObs, value: "obs", format: (v) => formatCount(v) },
    { label: T.tEstimate, value: "est", format: value3 },
  ];
  if (reveal) {
    cols.push({ label: T.tTheta, value: "theta", format: value3 });
    cols.push({ label: T.tTrueRank, value: "trueRank", format: (v) => formatCount(v) });
  }

  const chart = plot(slot, {
    alt: reveal ? T.leagueAlt + T.leagueAltReveal : T.leagueAlt,
    table: { caption: T.leagueTable, columns: cols, rows },
    height,
    marginTop: V2_CHART.marginTop,
    marginBottom: V2_CHART.marginBottom,
    marginLeft: V2_CHART.marginLeft,
    marginRight: V2_CHART.marginRight,
    x: {
      domain: [lo, hi],
      label: reveal ? "Estimate (dot, ± SE) and true value (diamond)" : "Estimate (dot, ± SE)",
      labelAnchor: "center",
      labelArrow: "none",
      grid: true,
      ticks: xTicks,
    },
    y: { domain: [N_UNITS + C.half, C.half], axis: null },
    r: { type: "identity" },
    marks: (c, P) => [
      highlight ? P.rect(bands, { x1: lo, x2: hi, y1: "y1", y2: "y2", fill: c.plotGrid }) : null,
      P.ruleY(seps, { stroke: c.plotAxis, strokeDasharray: C.dash }),
      P.link(rows, {
        x1: "loSe",
        x2: "hiSe",
        y1: "pos",
        y2: "pos",
        stroke: (d) => groupColor(c, d.group),
        strokeWidth: V2_CHART.whiskerWidth,
        strokeOpacity: (d) => 0.72 * dim(d),
      }),
      reveal
        ? P.link(rows, {
          x1: "est",
          x2: "theta",
          y1: "pos",
          y2: "pos",
          stroke: c.plotMuted,
          strokeWidth: V2_CHART.link,
          strokeDasharray: "2,2",
          strokeOpacity: dim,
        })
        : null,
      P.dot(rows, {
        x: "est",
        y: "pos",
        r: "rV2",
        fill: (d) => groupColor(c, d.group),
        stroke: c.plotBg,
        strokeWidth: C.halo,
        fillOpacity: dim,
      }),
      reveal
        ? P.dot(rows, {
          x: "theta",
          y: "pos",
          symbol: "diamond",
          r: V2_CHART.diamond,
          fill: c.plotFg,
          stroke: c.plotBg,
          strokeWidth: C.halo,
          fillOpacity: dim,
        })
        : null,
      P.text(rows, {
        y: "pos",
        text: "id",
        frameAnchor: "left",
        textAnchor: "end",
        dx: -V2_CHART.nameDx,
        fill: c.plotFg,
        render: tagNames,
      }),
      P.text([T.colUnit], {
        text: (d) => d,
        frameAnchor: "top-left",
        textAnchor: "end",
        lineAnchor: "bottom",
        dx: -V2_CHART.nameDx,
        dy: -V2_CHART.headDy,
        fill: c.plotMuted,
      }),
      reveal
        ? numText(rows, {
          y: "pos",
          value: "trueRank",
          format: (v) => formatCount(v),
          frameAnchor: "right",
          textAnchor: "middle",
          dx: V2_CHART.marginRight * C.half,
          fill: c.plotFg,
        })
        : null,
      reveal
        ? P.text(["Rank"], {
          text: (d) => d,
          frameAnchor: "top-right",
          textAnchor: "middle",
          lineAnchor: "bottom",
          dx: V2_CHART.marginRight * C.half,
          dy: -V2_CHART.headDy,
          fill: c.plotMuted,
        })
        : null,
    ],
    keyboard: {
      data: rows,
      x: "est",
      y: "pos",
      key: (d) => d.id,
      sort: false,
      pointer: true,
      label: T.leagueKbd,
      onFocus: inspect,
      onSelect: select,
      title: (d) => {
        let text = words(T.keyPoint, {
          pos: formatCount(d.pos),
          id: d.id,
          group: T.groupWord[d.group].toLowerCase(),
          obs: formatCount(d.obs),
          se: formatSetting(d.se),
          est: value3(d.est),
        });
        if (reveal) text += words(T.keyPointTruth, { theta: value3(d.theta), rank: formatCount(d.trueRank) });
        return text;
      },
    },
  });

  if (key) {
    const ends = { k: () => kit.count(K), ext: () => kit.count(EXT) };
    const item = (...children) => h("span", { class: "prx-nl-key-item" }, ...children);
    const items = [
      item(kit.swatch("medium"), T.keyDot),
      item(kit.mark("prx-nl-swatch-dash"), h("span", {}, ...fill(T.keySeparators, ends))),
    ];
    if (reveal) {
      items.push(item(kit.mark("prx-nl-swatch-diamond"), T.keyTick));
      items.push(item(kit.mark("prx-nl-swatch-link"), T.keyLink));
      items.push(item(h("span", {}, ...fill(T.keyRank, { one: () => kit.count(1) }))));
    }
    if (highlight) items.push(item(kit.mark("prx-nl-swatch-shade"), h("span", {}, ...fill(T.keyShade, ends))));
    key.replaceChildren(...items);
  }
  return chart;
}

/** Linked replay ends chart with 3-sig-fig right-margin averages and matching group colors/sizes. */
function drawV2EndsChart(ctx, { head, slot, key }, { run, reveal = false, shown = 0, averages = null }) {
  const k = textKit(ctx);
  const { h } = ctx;
  const truthValues = [...new Set([TRUTH.total.small, TRUTH.total.large])];
  const avg = averages ? v2AverageLabels(averages) : [];
  const avgHooks = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
    Array.from(index).forEach((i, j) => nodes[j]?.setAttribute("data-prx-readout", `chart-avg-${avg[i].g}`));
    return g;
  };

  head.replaceChildren("Small and large units among the ", k.count(EXT), " extreme positions, replay by replay");
  const columns = [
    { label: T.tReplay, value: "r", format: (v) => formatCount(v) },
    { label: T.tSeed, value: "seed", format: (v) => formatSetting(v) },
    { label: T.tSmall, value: (d) => d.ext.total.small, format: (v) => formatCount(v) },
    { label: T.tMedium, value: (d) => d.ext.total.medium, format: (v) => formatCount(v) },
    { label: T.tLarge, value: (d) => d.ext.total.large, format: (v) => formatCount(v) },
  ];
  if (reveal) {
    columns.push({ label: T.tTop, value: "top", format: (v) => formatCount(v) });
    columns.push({ label: T.tWrong, value: "wrong", format: (v) => formatCount(v) });
  }

  plot(slot, {
    alt: T.endsAlt,
    table: { caption: T.endsTable, columns, rows: run },
    height: V2_CHART.replayHeight,
    marginTop: V2_CHART.replayMarginTop,
    marginBottom: V2_CHART.replayMarginBottom,
    marginLeft: V2_CHART.replayMarginLeft,
    marginRight: V2_CHART.replayMarginRight,
    x: {
      domain: [C.half, R + C.half],
      ticks: C.replayTicks.filter((t) => t <= R),
      label: T.replayX,
      labelAnchor: "center",
      labelArrow: "none",
    },
    y: { domain: [0, EXT], ticks: C.yTicks, label: T.endsY, labelArrow: "none", grid: true },
    r: { type: "identity" },
    marks: (c, P) => [
      P.ruleY(truthValues, { stroke: c.plotAxis, strokeDasharray: C.dash }),
      P.ruleX(shown > 0 ? [shown] : [], { stroke: c.plotMuted }),
      avg.length
        ? P.ruleY(avg, {
          y: "v",
          stroke: (d) => groupColor(c, d.g),
          strokeWidth: C.avgLine,
        })
        : null,
      P.dot(run, {
        x: "r",
        y: (d) => d.ext.total.small,
        r: V2_CHART.radius.small,
        fill: c.est,
        stroke: c.plotBg,
        strokeWidth: C.halo,
      }),
      P.dot(run, {
        x: "r",
        y: (d) => d.ext.total.large,
        r: V2_CHART.radius.large,
        fill: c.post,
        stroke: c.plotBg,
        strokeWidth: C.halo,
      }),
      ...(avg.length
        ? [
          P.dot(avg, {
            x: "x",
            y: "at",
            r: "r",
            dx: V2_CHART.avgDotDx,
            fill: (d) => groupColor(c, d.g),
            stroke: c.plotBg,
            strokeWidth: C.halo,
          }),
          P.text(avg, {
            x: "x",
            y: "at",
            text: () => T.average,
            dx: V2_CHART.avgTextDx,
            dy: -2,
            textAnchor: "start",
            lineAnchor: "bottom",
            fill: c.plotFg,
          }),
          numText(avg, {
            x: "x",
            y: "at",
            value: "v",
            format: (v) => formatReadoutExpected(v),
            dx: V2_CHART.avgTextDx,
            dy: 2,
            textAnchor: "start",
            lineAnchor: "top",
            fill: c.plotFg,
            fontWeight: 600,
            render: avgHooks,
          }),
        ]
        : []),
    ],
    keyboard: {
      data: run,
      x: "r",
      y: (d) => d.ext.total.small,
      key: (d) => `r${d.r}`,
      sort: false,
      pointer: true,
      label: T.endsKbd,
      title: (d) => {
        const base = words(T.keyReplay, {
          r: formatCount(d.r),
          seed: formatSetting(d.seed),
          small: formatCount(d.ext.total.small),
          large: formatCount(d.ext.total.large),
        });
        return reveal
          ? base + words(T.keyReplayTruth, { top: formatCount(d.top), topK: formatCount(CONFIG.topK), wrong: formatCount(d.wrong) })
          : base;
      },
    },
  });

  key.replaceChildren(
    h("span", { class: "prx-nl-key-item" }, h("span", { class: "prx-nl-swatch-v2 prx-nl-swatch-v2-small", "aria-hidden": "true" }), T.keySmall),
    h("span", { class: "prx-nl-key-item" }, h("span", { class: "prx-nl-swatch-v2 prx-nl-swatch-v2-large", "aria-hidden": "true" }), T.keyLarge),
    ...(avg.length ? [h("span", { class: "prx-nl-key-item prx-nl-key-avg" }, k.mark("prx-nl-swatch-avg"), T.keyAverage)] : []),
    h(
      "span",
      { class: "prx-nl-key-item" },
      k.mark("prx-nl-swatch-dash"),
      h("span", {}, "dashed line: the truth, ", k.count(TRUTH.total.small), " small and ", k.count(TRUTH.total.large), " large units"),
    ),
  );
}

/** 3-sig-fig replay summary and Monte Carlo provenance caption. */
function drawV2Averages(ctx, { lines, caption }, { summary, reveal = false, done = false }) {
  lines.hidden = !done;
  caption.hidden = !done;
  if (!done) return;
  const w = ro(ctx);
  const { h } = ctx;
  const s = summary;
  const out = [
    h(
      "p",
      {},
      "Average over the ",
      w.count(R),
      " replays: small units hold ",
      w.expected(s.avg.small, { hook: "avg-ends-small" }),
      " of the ",
      w.count(EXT),
      " extreme positions, medium units ",
      w.expected(s.avg.medium, { hook: "avg-ends-medium" }),
      " and large units ",
      w.expected(s.avg.large, { hook: "avg-ends-large" }),
      " (truly ",
      w.count(TRUTH.total.small),
      ", ",
      w.count(TRUTH.total.medium),
      " and ",
      w.count(TRUTH.total.large),
      ").",
    ),
  ];
  if (reveal) {
    out.push(
      h(
        "p",
        {},
        "Of the top ",
        w.count(CONFIG.topK),
        " by estimate, ",
        w.expected(s.avg.top, { hook: "avg-top" }),
        " are in the true top ",
        w.count(CONFIG.topK),
        " on average; the estimates order ",
        w.expected(s.avg.wrong, { hook: "avg-wrong" }),
        " of the ",
        w.count(PAIRS),
        " pairs the wrong way on average (expected over many draws: ",
        w.expected(EXPECTED, { hook: "expected-wrong" }),
        ").",
      ),
    );
  }
  lines.replaceChildren(...out);
  caption.replaceChildren(
    captionNode(ctx, "monte-carlo", { S: R, seed: s.seed }),
    "; replay r uses seed ",
    w.setting(s.seed),
    " + r.",
  );
}

/** Render full 30-unit audit table in Data disclosure. */
function renderFullUnitTable(ctx, slot, { draw, shown, reveal }) {
  const rows = leagueRows(draw);
  const value4 = (v) => formatTableVal(v, 4);
  const columns = [
    { key: "id", label: T.tUnit, rowHeader: true, name: true },
    { key: "pos", label: T.tPosition, kind: "count" },
    { key: "est", label: T.tEstimate, format: value4 },
    { key: "se", label: "SE", kind: "setting" },
    { label: T.tSize, value: (d) => T.groupWord[d.group] },
    { key: "obs", label: T.tObs, kind: "count" },
  ];
  if (reveal) {
    columns.push({ key: "theta", label: T.tTheta, format: value4 });
    columns.push({ key: "trueRank", label: T.tTrueRank, kind: "count" });
  }
  const caption = [
    "All ",
    ctx.num(N_UNITS, formatCount(N_UNITS)),
    " units ranked by estimate (",
    ...drawLineNodes(ctx, shown, draw.seed, { lower: true }),
    ").",
  ];
  slot.replaceChildren(
    renderDataTable(ctx, {
      columns,
      rows,
      caption,
      label: "All thirty units ranked by estimate",
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
    css: cssFor(CONFIG.className) + V2_CSS,
    keys: {
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      unit: { type: "choice", values: ["", ...LEAGUE.ids], value: "" },
      reveal: { type: "custom", value: false, parse: (v) => parseFlag(v) },
      replays: { type: "integer", min: CONFIG.replays.min, max: CONFIG.replays.max, value: CONFIG.replays.value },
      highlight: { type: "choice", values: CONFIG.highlight.values, value: CONFIG.highlight.value },
      draw: { type: "integer", min: CONFIG.draw.min, max: CONFIG.draw.max, value: CONFIG.draw.value },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const summaryOf = summaryMemo(CONFIG.memo);
      let own = false;
      const setOwn = (partial) => {
        own = true;
        try {
          ctx.set(partial);
        } finally {
          own = false;
        }
      };

      const drawNext = () => {
        if (runner.running) runner.stop();
        const cur = ctx.state.seed;
        const nextSeed = cur >= CONFIG.seed.max ? CONFIG.seed.min : cur + 1;
        ctx.set({ seed: nextSeed, draw: 0 });
      };

      // --- Primary controls (ctx.controls): Draw again + Reveal true values
      const drawAgainBtn = ctx.button({
        label: "Draw again",
        key: "draw-again",
        primary: true,
        onClick: drawNext,
      });
      ctx.primaryControl(drawAgainBtn.root);
      ctx.onPrimary(drawNext);

      const revealBtn = ctx.button({
        label: T.reveal,
        key: "reveal",
        onClick: () => ctx.set({ reveal: !ctx.state.reveal }),
      });
      revealBtn.root.classList.add("prx-nl-toggle");
      ctx.controls.append(h("div", { class: "prx-nl-primary-actions" }, drawAgainBtn.root, revealBtn.root));

      // --- Secondary controls (ctx.settingsBox): Replay ×20, Draw shown selector, Highlight, Seed
      const replayBtn = ctx.button({
        label: words(T.replay, { R: formatCount(R) }),
        key: "replay",
        onClick: () => runner.run(),
      });
      const select = drawSelect(ctx, { onChange: (r) => ctx.set({ draw: r }), keep: true });
      const highlight = ctx.toggle({
        label: words(T.highlight, { k: formatCount(K) }),
        name: "highlight",
        checked: ctx.state.highlight === CONFIG.highlight.on,
        onChange: (b) => ctx.set({ highlight: b ? CONFIG.highlight.on : CONFIG.highlight.off }),
      });
      const seedHintId = uid("prx-nl-seed-hint");
      const seed = ctx.numberInput({
        label: T.seed,
        min: CONFIG.seed.min,
        max: CONFIG.seed.max,
        step: 1,
        value: ctx.state.seed,
        name: "seed",
        onInput: (v) => ctx.set({ seed: Math.round(v) }),
      });
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      seed.root.classList.add("prx-nl-seed");

      ctx.settingsBox(T.settings).body.append(
        h("div", { class: "prx-nl-settings-grid" }, replayBtn.root, select.root, highlight.root, seed.root),
      );

      // --- Primary stage (ctx.stage): crisp header/legend + full-width Dot & Interval League + 1-line strip (+ linked replays when active)
      const drawLine = h("p", { class: "prx-nl-drawline", "data-prx-part": "notes" });
      const groupLegend = h(
        "ul",
        { class: "prx-nl-groups-key" },
        ...CONFIG.groups.map((g) =>
          h(
            "li",
            {},
            h("span", { class: `prx-nl-swatch-v2 prx-nl-swatch-v2-${g}`, "aria-hidden": "true" }),
            T.groupWord[g],
            ": SE ",
            w.setting(GROUP[g].se),
          ),
        ),
      );
      const stageHead = h("div", { class: "prx-nl-stage-head", "data-prx-part": "legend" }, drawLine, groupLegend);

      const leagueSlot = h("div", { class: "prx-nl-league-chart" });
      const stageStrip = h("div", { class: "prx-nl-strip" });
      const unitSelect = ctx.select({
        label: "Inspect unit", name: "unit", value: ctx.state.unit, onChange: id => ctx.set({ unit: id }),
        options: [{ value: "", label: "Highest observed estimate" }, ...LEAGUE.ids.map(id => ({ value: id, label: id }))],
      });
      const rankPair = h("p", { "data-prx-evidence": "observed-and-true-rank" });
      const leagueCol = h("section", { class: "prx-nl-league", "aria-label": T.leagueHead }, unitSelect.root, rankPair, leagueSlot, stageStrip);

      const endsHead = h("h5", { class: "prx-nl-subheading", "data-prx-part": "notes" });
      const endsSlot = h("div", { class: "prx-nl-replay-chart prx-nl-ends-chart" });
      const endsKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const summaryLines = h("div", { class: "prx-nl-summary", "data-prx-part": "readout", hidden: true });
      const replayCaption = h("p", { class: "prx-nl-caption", "data-prx-part": "caption", hidden: true });
      const averagesBox = h("div", { class: "prx-nl-averages", hidden: true }, summaryLines, replayCaption);
      const replayCol = h(
        "section",
        { class: "prx-nl-replays", "aria-label": T.replaysHead, hidden: true },
        h("h4", { class: "prx-nl-heading", text: T.replaysHead }),
        endsHead,
        endsSlot,
        endsKey,
        averagesBox,
      );

      const stageGrid = h("div", { class: "prx-nl-grid", "data-replays": "0" }, leagueCol, replayCol);
      ctx.stage.append(stageHead, stageGrid);

      // --- Data disclosure ("Data and exact counts"): tallies breakdown + complete 30-unit league table
      const talliesSlot = h("div", { class: "prx-nl-tallies" });
      const unitsTableSlot = h("div", { class: "prx-nl-units-table" });
      ctx.dataBox("Data and exact counts").body.append(
        h("div", { class: "prx-nl-data-stack" }, talliesSlot, unitsTableSlot),
      );

      // --- Method disclosure ("Method and setup"): size group specification + misordered-pairs trace + symbol glossary
      const card = sizeCard(ctx);
      const leagueKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const wrongHead = h("h5", { class: "prx-nl-subheading", "data-prx-part": "notes" });
      const wrongSlot = h("div", { class: "prx-nl-replay-chart prx-nl-wrong-chart" });
      const wrongKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const wrongPart = h("div", { class: "prx-nl-wrong", hidden: true }, wrongHead, wrongSlot, wrongKey);
      ctx.methodBox("Method and setup").body.append(
        h("div", { class: "prx-nl-method-stack" }, card, leagueKey, wrongPart),
      );

      const replayParts = [replayCol, wrongPart, averagesBox];
      const replayRegion = {
        setAttribute: (name, value) => {
          for (const part of replayParts) part.setAttribute(name, value);
        },
        removeAttribute: (name) => {
          for (const part of replayParts) part.removeAttribute(name);
        },
      };
      const runner = replayRunner(ctx, {
        count: R,
        region: replayRegion,
        onStep: (r) => {
          const now = ctx.state;
          if (now.replays === r && now.draw === r) ctx.requestRender("replay-step");
          else setOwn({ replays: r, draw: r });
        },
        onDone: () => ctx.requestRender("replays-done"),
      });

      function drawBadgeNodes(shown, seedVal) {
        return shown === 0
          ? ["Seed ", w.setting(seedVal, { hook: "read-seed" })]
          : ["Replay ", w.count(shown, { hook: "read-replay" }), " (", w.setting(seedVal, { hook: "read-seed" }), ")"];
      }

      function writeReadout(state, draw, s, shown) {
        const badge = drawBadgeNodes(shown, draw.seed);
        const holdCounts = [
          "small units hold ",
          w.count(draw.ext.total.small, { hook: "read-small" }),
          ", medium units ",
          w.count(draw.ext.total.medium, { hook: "read-medium" }),
          " and large units ",
          w.count(draw.ext.total.large, { hook: "read-large" }),
        ];

        if (!state.reveal && state.replays < R) {
          w.set([
            ...badge,
            ", ",
            w.count(EXT),
            " extreme positions: ",
            ...holdCounts,
            " (truly ",
            w.count(TRUTH.total.small, { hook: "read-true-small" }),
            " small, ",
            w.count(TRUTH.total.medium, { hook: "read-true-medium" }),
            " medium and ",
            w.count(TRUTH.total.large, { hook: "read-true-large" }),
            " large units).",
          ]);
          return;
        }

        if (state.reveal && state.replays < R) {
          w.set([
            ...badge,
            ": ",
            ...holdCounts,
            ". Of the top ",
            w.count(CONFIG.topK),
            " by estimate, ",
            w.count(draw.top, { hook: "read-top" }),
            " are in the true top ",
            w.count(CONFIG.topK),
            "; ",
            w.count(draw.wrong, { hook: "read-wrong" }),
            " wrong pairs (",
            w.expected(EXPECTED, { hook: "read-expected" }),
            " expected).",
          ]);
          return;
        }

        if (!state.reveal) {
          w.set([
            ...badge,
            ": ",
            ...holdCounts,
            " of ",
            w.count(EXT),
            " extremes. Over ",
            w.count(R),
            " replays, small average ",
            w.expected(s.avg.small, { hook: "read-avg-small" }),
            " and large ",
            w.expected(s.avg.large, { hook: "read-avg-large" }),
            " (truly ",
            w.count(TRUTH.total.small, { hook: "read-true-small" }),
            ", ",
            w.count(TRUTH.total.medium, { hook: "read-true-medium" }),
            ", ",
            w.count(TRUTH.total.large, { hook: "read-true-large" }),
            ").",
          ]);
          return;
        }

        w.set([
          ...badge,
          ": ",
          ...holdCounts,
          " (",
          w.count(draw.top, { hook: "read-top" }),
          " in true top ",
          w.count(CONFIG.topK),
          "; ",
          w.count(draw.wrong, { hook: "read-wrong" }),
          " wrong pairs vs ",
          w.expected(EXPECTED, { hook: "read-expected" }),
          " expected). Over ",
          w.count(R),
          " replays: ",
          w.expected(s.avg.small, { hook: "read-avg-small" }),
          " small, ",
          w.expected(s.avg.large, { hook: "read-avg-large" }),
          " large.",
        ]);
      }

      function writeStageStrip(state, draw) {
        const markItems = [
          h("span", { class: "prx-nl-key-item" }, h("span", { class: "prx-nl-swatch-se", "aria-hidden": "true" }), "± ", w.count(1), " SE"),
          h("span", { class: "prx-nl-key-item" }, h("span", { class: "prx-nl-swatch-dash", "aria-hidden": "true" }), "top ", w.count(K), " & bottom ", w.count(K)),
        ];
        if (state.reveal) {
          markItems.push(
            h("span", { class: "prx-nl-key-item" }, h("span", { class: "prx-nl-swatch-diamond", "aria-hidden": "true" }), "true value"),
          );
        }
        const countNode = state.reveal
          ? h(
            "span",
            { class: "prx-nl-strip-counts" },
            "True extremes: ",
            w.count(TRUTH.total.small, { hook: "read-true-small" }),
            " small · ",
            w.count(TRUTH.total.medium, { hook: "read-true-medium" }),
            " medium · ",
            w.count(TRUTH.total.large, { hook: "read-true-large" }),
          )
          : h(
            "span",
            { class: "prx-nl-strip-counts" },
            "Top ",
            w.count(K),
            ": ",
            w.count(draw.ext.top.small),
            "S, ",
            w.count(draw.ext.top.medium),
            "M, ",
            w.count(draw.ext.top.large),
            "L · Bottom ",
            w.count(K),
            ": ",
            w.count(draw.ext.bottom.small),
            "S, ",
            w.count(draw.ext.bottom.medium),
            "M, ",
            w.count(draw.ext.bottom.large),
            "L",
          );
        stageStrip.replaceChildren(h("span", { class: "prx-nl-strip-marks" }, ...markItems), countNode);
      }

      return {
        render(state, info) {
          if (info.reason === "disclosure" && info.disclosure !== "method") return;

          const changed = new Set(info.changed);
          const outside = changed.has("replays") && !own && info.reason !== "mount";
          if (outside && runner.running) runner.stop();
          const shown = outside && !changed.has("draw") ? 0 : Math.max(0, Math.min(state.draw, state.replays));
          if (shown !== state.draw) {
            const from = { draw: state.draw, replays: state.replays };
            ctx.timeout(() => {
              const now = ctx.state;
              if (now.draw === from.draw && now.replays === from.replays) ctx.set({ draw: shown });
            }, 0);
          }

          revealBtn.root.setAttribute("aria-pressed", String(state.reveal));
          highlight.set(state.highlight === CONFIG.highlight.on);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);
          select.sync(state.replays, shown);

          const hasReplays = state.replays > 0;
          stageGrid.setAttribute("data-replays", hasReplays ? "1" : "0");
          replayCol.hidden = !hasReplays;
          averagesBox.hidden = !hasReplays;
          if (!hasReplays) wrongPart.hidden = true;

          const s = summaryOf(state.seed);
          const draw = shown === 0 ? s.first : s.replays[shown - 1];
          if (!runner.running) writeReadout(state, draw, s, shown);

          drawLine.replaceChildren(...drawLineNodes(ctx, shown, draw.seed, { prefix: "draw" }));
          unitSelect.set(state.unit);
          const rows = leagueRows(draw);
          const inspected = rows.find(row => row.id === state.unit) ?? rows[0];
          const inspectRank = row => rankPair.replaceChildren(h("strong", { "data-prx-name": "", text: row.id }),
            " ranks ", w.count(row.pos, { hook: "inspected-observed-rank" }), " by its estimate",
            ...(state.reveal ? [" and ", w.count(row.trueRank, { hook: "inspected-true-rank" }), " by its true value."] : [". Reveal truth to compare ranks."]));
          inspectRank(inspected);
          drawV2LeagueChart(
            ctx,
            { slot: leagueSlot, key: leagueKey },
            {
              draw,
              domain: intervalDomain(s, hasReplays),
              inspect: inspectRank, select: row => ctx.set({ unit: row.id }),
              reveal: state.reveal,
              highlight: state.highlight === CONFIG.highlight.on,
            },
          );
          writeStageStrip(state, draw);

          drawTallies(ctx, talliesSlot, { draw, shown, seed: s.seed, replays: state.replays });
          talliesSlot.querySelector("table")?.classList.add("prx-sticky-first");
          renderFullUnitTable(ctx, unitsTableSlot, { draw, shown, reveal: state.reveal });

          if (hasReplays) {
            const run = s.replays.slice(0, state.replays);
            drawV2EndsChart(
              ctx,
              { head: endsHead, slot: endsSlot, key: endsKey },
              {
                run,
                reveal: state.reveal,
                shown,
                averages: replayAverages(s.seed, state.replays),
              },
            );
            drawWrongChart(
              ctx,
              { part: wrongPart, head: wrongHead, slot: wrongSlot, key: wrongKey },
              { run, reveal: state.reveal, shown },
            );
            drawV2Averages(
              ctx,
              { lines: summaryLines, caption: replayCaption },
              {
                summary: s,
                reveal: state.reveal,
                done: state.replays === R && !runner.running,
              },
            );
          }
        },
        destroy() {
          runner.stop();
        },
      };
    },
  });
}
