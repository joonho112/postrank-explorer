// overlap-in-the-league (app 1.12, Frame v2): "435 pairs: overlap against direction".
// Thirty central posterior intervals of the simulated league (league30, drawLeague(LEAGUE_SEED)), interactive pair
// selection on the chart (or via Settings dropdowns), and a 2x2 overlap-by-direction pair summary on stage, with
// exact pair card, 4-row tally table, and 30-unit posterior table preserved in Data and Method disclosures.
//
// Exports preserved: CONFIG, parsePair(v), leagueSummary(priorSd, levelPct), pairInfo(s, a, b), resolvePair(key, s),
// leagueDomain(s), drawLeagueFigure(el, s, pair, options), mountWidget(el, spec).
import { appLink, createWidget } from "../shared/base.js";
import { CONFIG as CHART, numText, palette, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatPercent,
  formatProb,
  formatReadoutEst,
  formatReadoutProb,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  LEAGUE_SEED,
  directionMatrix,
  drawLeague,
  intervalOverlapTally,
  league30,
  normalCdf,
  normalInterval,
  normalPosterior,
  pairCount,
  pairDirection,
  strictOrder,
} from "../pr-core.js";
import {
  CONFIG as IO,
  cssFor,
  fill,
  intervalMarks,
  keyItem,
  keyNode,
  overlapMarks,
  pairCard,
  textKit,
  words,
} from "../shared/domain/interval-overlap.js";

export const CONFIG = Object.freeze({
  name: "overlap-in-the-league",
  label: "Overlap against direction in the simulated league: thirty posterior intervals, a chosen pair, and every pair sorted by interval overlap and direction probability",
  className: "prx-iol",
  levels: IO.levels,
  percent: IO.percent,
  defaults: Object.freeze({ level: 90, pair: "overlap-high", priorSd: 0.15 }),
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01 }),
  priorMean: 0,
  pick: "overlap-high",
  threshold: 0.9,
  memo: 8,
  digits: Object.freeze({ value: 3, amount: 3, threshold: 2 }),
  leagueChart: Object.freeze({
    rowPx: 15.5,
    rowPxNarrow: 14.2,
    marginTop: 6,
    marginBottom: 36,
    marginLeft: 44,
    marginRight: 54,
    half: 0.5,
    nameDx: 6,
    line: 3.4,
    dot: 4.4,
    markDx: 6,
    step: 0.1,
    decimals: 12,
    pad: 0.02,
    xTicks: 6,
    xTicksNarrow: 4,
    narrowWidth: 420,
    halo: 3,
    rowBandHalf: 0.44,
    label: Object.freeze({ gap: 6, edge: 4, char: 7.2, charBold: 7.9 }),
  }),
  groupWord: Object.freeze({ small: "small", medium: "medium", large: "large" }),
  groupUnit: Object.freeze({
    small: "small unit (few observations)",
    medium: "medium unit",
    large: "large unit (many observations)",
  }),
  apps: Object.freeze({
    shrinkage: Object.freeze({ app: "shrinkage", title: "What a posterior adds" }),
    league: Object.freeze({ app: "noisy-league", title: "Ranking noisy estimates" }),
    twoUnits: IO.text.twoUnits,
  }),
  text: Object.freeze({
    levelLegend: IO.text.levelLegend,
    priorLabel: "Prior SD of the teaching posterior",
    priorHint: "The normal prior of {app}, centered at zero, the average of the league's true values.",
    firstLabel: "First unit",
    secondLabel: "Second unit",
    unitOption: "{id}, {group}",
    bestButton: "Overlapping pair with the highest probability",
    pickHint: "Click an interval, or press Enter on it in the figure, to choose a unit; clicks alternate between the first and the second unit. Next click: {next}.",
    nextFirst: "the first unit",
    nextSecond: "the second unit",
    leagueSection: "The simulated league",
    xLeague: "True value",
    altLeague: "Thirty posterior intervals of the simulated league, one row per unit, highest posterior mean at the top, each with a dot at its posterior mean. The two chosen units are drawn darker and marked first and second; {guides}",
    altGuides: Object.freeze({
      overlap: "dashed lines mark the lower end of the higher one and the upper end of the lower one, with a gray band where the two intervals overlap.",
      nested: "dashed lines mark the two ends of the shorter interval, which lies inside the other, with a gray band where the two intervals overlap.",
      apart: "dashed lines mark the lower end of the higher one and the upper end of the lower one; the two intervals do not overlap.",
    }),
    tableLeague: "Each unit of the league in the order of the posterior means: size, posterior mean, posterior SD and interval ends",
    kbdLeague: "League intervals: one point per unit, in the order of the posterior means; press Enter to choose a unit",
    kbdPoint: "{id}, a {group}: posterior mean {mean}, {level} interval from {lower} to {upper}.",
    kbdChosen: Object.freeze({ first: " The first unit of the pair.", second: " The second unit of the pair." }),
    colPosition: "Position",
    colUnit: IO.text.colUnit,
    colSize: "Size",
    colMean: IO.text.colMean,
    colSd: IO.text.colSd,
    colLower: IO.text.colLower,
    colUpper: IO.text.colUpper,
    markFirst: "first",
    markSecond: "second",
    markChance: "chance",
    markOverlap: "overlap",
    markGap: "gap",
    keyInterval: "light navy lines: each unit's {level} posterior interval, with a dot at its posterior mean",
    keyChosen: "darker lines: the two chosen units",
    keyGuides: Object.freeze({
      overlap: "dashed lines and gray band: the lower end of the higher unit, the upper end of the lower unit, and their overlap",
      nested: "dashed lines and gray band: the two ends of the shorter interval, which lies inside the other, and their overlap",
      apart: "dashed lines: the lower end of the higher unit and the upper end of the lower unit, with the gap between them",
    }),
    leagueEnds: "{a}: {aLower} to {aUpper}. {b}: {bLower} to {bUpper}.",
    leagueOverlap: "They overlap by {amount}.",
    leagueApart: "They do not overlap: {amount} lies between them.",
    leagueInside: "{inner}'s interval lies inside {outer}'s.",
    leagueMoments: "Posterior means {aMean} and {bMean}; posterior SDs {aSd} and {bSd}.",
    cardPi: IO.text.cardPi,
    cardNext: IO.text.cardNext,
    tallyLabel: "The pairs of league units, by interval overlap and direction probability",
    tallyCaption: "The {M} pairs of league units at prior SD {prior}, with {level} intervals",
    tallyKind: "Pairs",
    tallyCount: "Count",
    tallyRows: Object.freeze({
      apart: "Intervals do not overlap (in each such pair, one direction has a probability above {bound})",
      high: "Intervals overlap, and one direction has a probability above {thr}",
      low: "Intervals overlap, and neither direction has a probability above {thr}",
      all: "All pairs",
    }),
    chosenTag: "the chosen pair",
    tallyBest: "Highest probability among the {ov} overlapping pairs: {pi}, {a} above {b}.",
    tallyNoBest: "No two intervals overlap.",
    gloss: "The normal posterior gives both the marginal intervals and the direction probabilities for the league.",
    note: "The simulated league of {league}, built for this site: thirty units with independent normal posteriors, from the estimates drawn with seed {seed}, under the teaching posterior of {shrinkage} (prior mean {mean}, prior SD {prior}).",
  }),
});

const T = CONFIG.text;
const LC = CONFIG.leagueChart;

// ---------------------------------------------------------------------------------------------- the league

const LEAGUE = league30();
const DRAW = drawLeague(LEAGUE_SEED);
const N_UNITS = LEAGUE.ids.length;
const M = pairCount(N_UNITS);
const INDEX = new Map(LEAGUE.ids.map((id, i) => [id, i]));
const PAIR_RE = /^\s*(U\d+)\s*-\s*(U\d+)\s*$/i;

export function parsePair(v) {
  if (typeof v !== "string") return undefined;
  if (v.trim().toLowerCase() === CONFIG.pick) return CONFIG.pick;
  const m = PAIR_RE.exec(v);
  if (!m) return undefined;
  const a = m[1].toUpperCase();
  const b = m[2].toUpperCase();
  return INDEX.has(a) && INDEX.has(b) && a !== b ? `${a}-${b}` : undefined;
}

const pairKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);

export function leagueSummary(priorSd, levelPct) {
  const level = levelPct / CONFIG.percent;
  const post = normalPosterior(DRAW.estimate, LEAGUE.se, { priorMean: CONFIG.priorMean, priorSd });
  const iv = normalInterval(post.mean, post.sd, level);
  const rank = strictOrder(post.mean);
  const tally = intervalOverlapTally(iv.lower, iv.upper, directionMatrix(post.mean, post.sd), { threshold: CONFIG.threshold });
  const counts = { apart: tally.apart, high: tally.high, low: tally.low, overlapping: tally.overlapping };
  const pairs = new Map(tally.pairs.map((p) => [pairKey(p.i, p.j), p]));
  const best = tally.best ? { first: tally.best.first, second: tally.best.second, pi: tally.best.pi } : null;
  const z = normalInterval(0, 1, level).upper;
  return { priorSd, levelPct, level, post, iv, rank, counts, pairs, best, M, bound: normalCdf(z) };
}

export function pairInfo(s, a, b) {
  const { lower, upper } = s.iv;
  const [hi, lo] = s.rank[a] < s.rank[b] ? [a, b] : [b, a];
  const row = s.pairs.get(pairKey(a, b));
  const from = Math.max(lower[a], lower[b]);
  const to = Math.min(upper[a], upper[b]);
  const inner = !row.nested ? null : lower[a] === from && upper[a] === to ? a : b;
  return {
    a,
    b,
    hi,
    lo,
    from,
    to,
    amount: row.amount,
    overlap: row.overlap,
    inner,
    outer: inner === null ? null : inner === a ? b : a,
    pi: pairDirection(s.post.mean[a], s.post.sd[a], s.post.mean[b], s.post.sd[b]),
    cls: row.class,
  };
}

export function resolvePair(key, s) {
  if (key === CONFIG.pick) return s.best ? [s.best.first, s.best.second] : [s.rank.indexOf(1), s.rank.indexOf(2)];
  const [a, b] = String(key).split("-");
  return [INDEX.get(a), INDEX.get(b)];
}

export function leagueDomain(s) {
  const { step, decimals, pad } = LC;
  const lo = Math.min(...s.iv.lower) - pad;
  const hi = Math.max(...s.iv.upper) + pad;
  const round = (x) => Number(x.toFixed(decimals));
  return [round(Math.floor(lo / step) * step), round(Math.ceil(hi / step) * step)];
}

const caseOf = (pair) => (!pair.overlap ? "apart" : pair.inner !== null ? "nested" : "overlap");

const safeDec = (v, digits = CONFIG.digits.value) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

const value3 = (v) => safeDec(v, CONFIG.digits.value);

const markProb = (v) => {
  if (v <= 0 || (v > 0 && v < 0.001)) return "<.001";
  if (v >= 1 || (v > 0.999 && v < 1)) return ">.999";
  return formatReadoutProb(v);
};

function textMeter(el) {
  const doc = el.ownerDocument;
  const canvas = typeof doc?.defaultView?.CanvasRenderingContext2D === "function" ? doc.createElement("canvas").getContext("2d") : null;
  const root = el.closest?.(".prx-widget");
  const isV2 = (root ?? el.closest?.("[data-prx-frame]"))?.getAttribute("data-prx-frame") === "v2";
  const baseFont = isV2 ? CHART.fontSizeV2 : CHART.fontSize;
  const scale = Number(root?.getAttribute("data-prx-font-scale")) || 1;
  const size = baseFont * scale;
  const family = palette(el).fontSans || "system-ui, sans-serif";
  return (text, bold = false) => {
    if (!canvas) return text.length * (bold ? LC.label.charBold : LC.label.char) * scale;
    canvas.font = `${bold ? "bold " : ""}${size}px ${family}`;
    return canvas.measureText(text).width;
  };
}

function pairLabels(s, pair, [lo, hi], width, measure) {
  const G = LC.label;
  const plotW = Math.max(1, width - LC.marginLeft - LC.marginRight);
  const px = (x) => LC.marginLeft + ((x - lo) / (hi - lo)) * plotW;
  const amount = Math.abs(pair.amount);
  const guides = [px(pair.from), px(pair.to)];
  return [
    { i: pair.a, mark: T.markFirst, word: T.markChance, raw: pair.pi, format: markProb, hook: "mark-pi" },
    { i: pair.b, mark: T.markSecond, word: pair.overlap ? T.markOverlap : T.markGap, raw: amount, format: formatReadoutEst, hook: "mark-amount" },
  ].map((d) => {
    const display = d.format(d.raw);
    const upper = s.iv.upper[d.i];
    const lower = s.iv.lower[d.i];
    const xu = px(upper);
    const xl = px(lower);
    const full = measure(`${d.word} ${display}`);
    const num = measure(display);
    const startRight = (w) => {
      let x = xu + LC.markDx + measure(d.mark, true) + G.gap;
      for (const g of [...guides].sort((u, v) => u - v)) if (g > xu && g >= x - G.gap && g <= x + w) x = g + G.gap;
      return x;
    };
    const endLeft = (w) => {
      let x = xl - LC.markDx;
      for (const g of [...guides].sort((u, v) => v - u)) if (g < xl && g <= x + G.gap && g >= x - w) x = g - G.gap;
      return x;
    };
    const fitsRight = (w) => startRight(w) + w <= width - LC.marginRight - G.edge;
    const fitsLeft = (w) => endLeft(w) - w >= LC.marginLeft + G.edge;
    const [side, withWord] = fitsRight(full)
      ? ["right", true]
      : fitsLeft(full)
        ? ["left", true]
        : fitsRight(num)
          ? ["right", false]
          : fitsLeft(num)
            ? ["left", false]
            : ["right", false];
    const w = withWord ? full : num;
    const dx = side === "right" ? startRight(w) - xu : endLeft(w) - xl;
    return { ...d, y: s.rank[d.i], upper, lower, side, withWord, dx, num, wordRoom: measure(`${d.word} `), space: measure(" ") };
  });
}

function labelMarks(c, P, d) {
  const style = { fill: c.plotFg, stroke: c.plotBg, strokeWidth: LC.halo, paintOrder: "stroke" };
  const right = d.side === "right";
  const at = right ? d.upper : d.lower;
  const hooked = (index, scales, values, dims, context, next) => {
    const g = next(index, scales, values, dims, context);
    for (const t of g?.querySelectorAll?.("text") ?? []) t.setAttribute("data-prx-readout", d.hook);
    return g;
  };
  const marks = [
    numText([d], {
      x: () => at,
      y: "y",
      value: "raw",
      format: d.format,
      textAnchor: right ? "start" : "end",
      dx: right ? d.dx + (d.withWord ? d.wordRoom : 0) : d.dx,
      render: hooked,
      ...style,
    }),
  ];
  if (d.withWord) {
    marks.push(
      P.text([d], {
        x: () => at,
        y: "y",
        text: "word",
        textAnchor: right ? "start" : "end",
        dx: right ? d.dx : d.dx - d.num - d.space,
        ...style,
      }),
    );
  }
  return marks;
}

const nameRender = (list) => (index, scales, values, dims, context, next) => {
  const g = next(index, scales, values, dims, context);
  const nodes = g?.querySelectorAll ? g.querySelectorAll("text") : [];
  Array.from(index).forEach((k, j) => nodes[j]?.setAttribute("data-prx-name", list[k].name));
  return g;
};

export function drawLeagueFigure(el, s, pair) {
  const [lo, hi] = leagueDomain(s);
  const measured = Math.round(el.clientWidth || el.getBoundingClientRect?.().width || 0);
  const width = measured > 0 ? Math.max(CHART.minWidth, measured) : CHART.defaultWidth;
  const labels = pairLabels(s, pair, [lo, hi], width, textMeter(el));
  const rows = LEAGUE.ids
    .map((id, i) => ({
      i,
      id,
      name: id,
      group: LEAGUE.group[i],
      pos: s.rank[i],
      y: s.rank[i],
      mean: s.post.mean[i],
      sd: s.post.sd[i],
      lower: s.iv.lower[i],
      upper: s.iv.upper[i],
      strong: i === pair.a || i === pair.b,
      mark: i === pair.a ? T.markFirst : i === pair.b ? T.markSecond : "",
    }))
    .sort((p, q) => p.pos - q.pos);
  const marked = rows.filter((r) => r.strong);
  const span = [Math.min(s.rank[pair.a], s.rank[pair.b]), Math.max(s.rank[pair.a], s.rank[pair.b])];
  const levelWords = formatPercent(s.level);
  const xTicks = width < LC.narrowWidth ? LC.xTicksNarrow : LC.xTicks;
  const rowPitch = width < LC.narrowWidth ? LC.rowPxNarrow : LC.rowPx;
  const chart = plot(el, {
    alt: words(T.altLeague, { guides: T.altGuides[caseOf(pair)] }),
    table: {
      caption: T.tableLeague,
      columns: [
        { label: T.colPosition, value: "pos", format: (v) => formatCount(v) },
        { label: T.colUnit, value: "id" },
        { label: T.colSize, value: (d) => CONFIG.groupWord[d.group] },
        { label: T.colMean, value: "mean", format: (v) => value3(v) },
        { label: T.colSd, value: "sd", format: (v) => value3(v) },
        { label: T.colLower, value: "lower", format: (v) => value3(v) },
        { label: T.colUpper, value: "upper", format: (v) => value3(v) },
      ],
      rows,
    },
    width,
    height: LC.marginTop + LC.marginBottom + N_UNITS * rowPitch,
    marginTop: LC.marginTop,
    marginBottom: LC.marginBottom,
    marginLeft: LC.marginLeft,
    marginRight: LC.marginRight,
    x: { domain: [lo, hi], ticks: xTicks, label: T.xLeague, labelAnchor: "center", labelArrow: "none", grid: true },
    y: { domain: [N_UNITS + LC.half, LC.half], axis: null },
    marks: (c, P) => [
      P.rect(marked, {
        x1: () => lo,
        x2: () => hi,
        y1: (d) => d.y - LC.rowBandHalf,
        y2: (d) => d.y + LC.rowBandHalf,
        fill: c.blues[0],
        stroke: c.blues[3],
        strokeWidth: 0.85,
        rx: 2,
      }),
      ...overlapMarks(c, P, {
        from: pair.from,
        to: pair.to,
        y1: span[0],
        y2: span[1],
        band: pair.overlap,
        lines: [pair.from, pair.to],
      }),
      ...intervalMarks(c, P, rows, { line: LC.line, dot: LC.dot, nameDx: LC.nameDx, nameRender }),
      P.text(marked, {
        x: "upper",
        y: "y",
        text: "mark",
        textAnchor: "start",
        dx: LC.markDx,
        fill: c.plotFg,
        fontWeight: "bold",
        stroke: c.plotBg,
        strokeWidth: LC.halo,
        paintOrder: "stroke",
      }),
      ...labels.flatMap((d) => labelMarks(c, P, d)),
    ],
    keyboard: {
      data: rows,
      x: "mean",
      y: "pos",
      key: (d) => d.id,
      sort: false,
      label: T.kbdLeague,
      title: (d) =>
        words(T.kbdPoint, {
          id: d.id,
          group: CONFIG.groupUnit[d.group],
          mean: value3(d.mean),
          level: levelWords,
          lower: value3(d.lower),
          upper: value3(d.upper),
        }) + (d.i === pair.a ? T.kbdChosen.first : d.i === pair.b ? T.kbdChosen.second : ""),
    },
  });
  return { chart, rows };
}

// ---------------------------------------------------------------------------------------------- app

const CSS = `${cssFor(CONFIG.className)}
@media (max-width: 30em) {
  .prx-iol.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls { gap: 0.25rem 0.75rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.38rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-iol.prx-widget[data-prx-frame="v2"] > .prx-stage { padding: 0.45rem 0.5rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-stage-head { margin-bottom: 0.3rem; padding-bottom: 0.25rem; font-size: 0.78125rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-layout { gap: 0.45rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-side { gap: 0.42rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-pair-strip { padding: 0.3rem 0.48rem; font-size: 0.78125rem; line-height: 1.3; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-matrix-card { padding: 0.38rem 0.48rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-matrix-title { margin-bottom: 0.25rem; font-size: 0.8125rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-mcell { padding: 0.26rem 0.38rem; gap: 0.15rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] .prx-stage .prx-iol-top-pair { margin-top: 0.3rem; padding-top: 0.25rem; }
  .prx-iol.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.42rem; gap: 0.32rem; }
}
.prx-iol .prx-stage {
  container-type: inline-size;
}
.prx-iol .prx-stage .prx-io-view,
.prx-iol .prx-stage .prx-io-panel,
.prx-iol .prx-stage .prx-iol-side {
  grid-area: auto;
}
.prx-iol .prx-iol-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.1rem;
  align-items: flex-end;
  width: 100%;
}
.prx-iol .prx-iol-pick-hint {
  flex: 1 1 100%;
  margin: 0;
}
.prx-iol .prx-stage .prx-iol-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.25rem 0.85rem;
  margin: 0 0 0.45rem;
  padding: 0 0 0.38rem;
  border-bottom: 1px solid var(--prx-plot-grid);
  font-size: 0.84375rem;
  line-height: 1.35;
  color: var(--prx-fg);
  font-variant-numeric: tabular-nums;
}
.prx-iol .prx-stage .prx-iol-stage-pick {
  margin: 0;
  font-weight: 600;
  color: var(--prx-fg);
}
.prx-iol .prx-stage .prx-iol-stage-cue {
  margin: 0;
  color: var(--prx-fg-muted);
}
.prx-iol .prx-stage .prx-iol-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem 1.25rem;
  align-items: start;
}
@container (min-width: 46rem) {
  .prx-iol .prx-stage .prx-iol-layout {
    grid-template-columns: minmax(0, 1.35fr) minmax(15.5rem, 1fr);
  }
}
.prx-iol .prx-stage .prx-iol-league-chart svg {
  cursor: pointer;
}
.prx-iol .prx-stage .prx-iol-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
  min-width: 0;
}
.prx-iol .prx-stage .prx-iol-pair-strip {
  padding: 0.45rem 0.65rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
  border-radius: 6px;
  font-size: 0.84375rem;
  line-height: 1.4;
  color: var(--prx-plot-fg);
  font-variant-numeric: tabular-nums;
}
.prx-iol .prx-stage .prx-iol-pair-line {
  margin: 0;
}
.prx-iol .prx-stage .prx-iol-pair-line + .prx-iol-pair-line {
  margin-top: 0.2rem;
}
.prx-iol .prx-stage .prx-iol-matrix-card {
  padding: 0.55rem 0.65rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
  border-radius: 6px;
  color: var(--prx-plot-fg);
  font-variant-numeric: tabular-nums;
}
.prx-iol .prx-stage .prx-iol-matrix-title {
  margin: 0 0 0.4rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-iol .prx-stage .prx-iol-matrix {
  display: grid;
  grid-template-columns: minmax(6.2rem, auto) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.35rem;
  align-items: stretch;
  font-size: 0.8125rem;
}
.prx-iol .prx-stage .prx-iol-mcol {
  padding: 0.15rem 0.35rem;
  font-weight: 600;
  color: var(--prx-plot-muted);
  text-align: left;
}
.prx-iol .prx-stage .prx-iol-mrow {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.3rem 0.35rem;
  font-weight: 600;
  color: var(--prx-plot-fg);
}
.prx-iol .prx-stage .prx-iol-mrow-sub {
  font-size: 0.92em;
  font-weight: 400;
  color: var(--prx-plot-muted);
}
.prx-iol .prx-stage .prx-iol-mcell {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.22rem;
  padding: 0.38rem 0.48rem;
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-grid);
  border-radius: 5px;
  min-width: 0;
}
.prx-iol .prx-stage .prx-iol-mcell[data-active="true"] {
  border: 2px solid var(--prx-plot-fg);
  background: #EFF3FF;
}
.prx-iol .prx-stage .prx-iol-mcell-empty {
  background: #f7f7f7;
  color: var(--prx-plot-muted);
}
.prx-iol .prx-stage .prx-iol-mcell-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.35rem;
}
.prx-iol .prx-stage .prx-iol-mcount {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-iol .prx-stage .prx-iol-mcell-empty .prx-iol-mcount {
  color: var(--prx-plot-muted);
}
.prx-iol .prx-stage .prx-iol-mbadge {
  display: inline-block;
  padding: 0 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-axis);
  border-radius: 3px;
}
.prx-iol .prx-stage .prx-iol-msub {
  font-size: 0.75rem;
  color: var(--prx-plot-muted);
}
.prx-iol .prx-stage .prx-iol-mbar-track {
  display: block;
  width: 100%;
  height: 0.42rem;
  background: var(--prx-plot-grid);
  border-radius: 2px;
  overflow: hidden;
}
.prx-iol .prx-stage .prx-iol-mbar {
  display: block;
  height: 100%;
  min-width: 2px;
  background: var(--prx-post);
}
.prx-iol .prx-stage .prx-iol-mbar-low {
  background: var(--prx-plot-muted);
}
.prx-iol .prx-stage .prx-iol-mbar-apart {
  background: var(--prx-rel-above);
}
.prx-iol .prx-stage .prx-iol-top-pair {
  margin: 0.45rem 0 0;
  padding: 0.35rem 0 0;
  border-top: 1px solid var(--prx-plot-grid);
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
}
.prx-iol .prx-iol-disclosure-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
.prx-iol .prx-iol-disclosure-stack > .prx-io-pair {
  margin-top: 0;
}
.prx-iol .prx-iol-tally { margin: 0; }
.prx-iol .prx-light-panel.prx-iol-table-wrap { max-width: 100%; overflow-x: auto; color: var(--prx-plot-fg); background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border); border-radius: var(--prx-radius); }
.prx-iol .prx-light-panel .prx-iol-table { width: 100%; margin: 0; border-collapse: collapse; font-size: 0.9em; color: var(--prx-plot-fg);
  font-variant-numeric: tabular-nums; }
.prx-iol .prx-light-panel .prx-iol-table caption { caption-side: top; padding: 0.35rem 0.6rem; text-align: left; color: var(--prx-plot-fg); font-weight: 600; }
.prx-iol .prx-iol-table th, .prx-iol .prx-iol-table td { padding: 0.3rem 0.6rem; text-align: left; vertical-align: top;
  border-top: 1px solid var(--prx-plot-grid); }
.prx-iol .prx-iol-table thead th { font-weight: 600; }
.prx-iol .prx-iol-table tbody th { font-weight: 400; }
.prx-iol .prx-iol-table th:nth-child(2), .prx-iol .prx-iol-table td:nth-child(2) { width: 1%; text-align: right; white-space: nowrap;
  overflow-wrap: normal; }
.prx-iol .prx-iol-bar-track { display: block; max-width: 24rem; margin-top: 0.3rem; }
.prx-iol .prx-iol-bar { display: block; min-width: 2px; height: 0.7rem; background: var(--prx-plot-muted); border: 1px solid var(--prx-plot-axis); }
.prx-iol .prx-iol-chosen-row > th, .prx-iol .prx-iol-chosen-row > td { background: var(--prx-plot-grid); }
.prx-iol .prx-iol-tag { display: inline-block; margin-left: 0.4rem; padding: 0 0.35rem; font-size: 0.85em; font-weight: 600;
  border: 1px solid var(--prx-plot-axis); border-radius: var(--prx-radius); }
.prx-iol .prx-iol-total-row > th, .prx-iol .prx-iol-total-row > td { font-weight: 600; }
.prx-iol .prx-iol-best { margin: 0; padding: 0.35rem 0.6rem; font-size: 0.9em; border-bottom: 1px solid var(--prx-plot-grid); }
.prx-iol .prx-iol-note { margin: 0; font-size: 0.84375rem; line-height: 1.4; color: var(--prx-fg-muted); }
`;

export function mountWidget(el, spec = {}) {
  const D = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      level: { type: "choice", values: CONFIG.levels, value: D.level },
      pair: { type: "custom", value: D.pair, parse: (v) => parsePair(v) },
      priorSd: { type: "number", ...CONFIG.priorSd, value: D.priorSd },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const k = textKit(ctx);
      const memo = new Map();
      const summaryOf = (prior, levelPct) => {
        const key = `${prior}|${levelPct}`;
        if (!memo.has(key)) {
          if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
          memo.set(key, leagueSummary(prior, levelPct));
        }
        return memo.get(key);
      };
      let nextSlot = "first";

      // --- Primary control (ctx.controls): Interval level
      const levelGroup = ctx.radioGroup({
        legend: T.levelLegend,
        name: "level",
        value: ctx.state.level,
        className: "prx-io-level",
        options: CONFIG.levels.map((l) => ({ value: l, label: formatPercent(l / CONFIG.percent) })),
        onChange: (v) => ctx.set({ level: v }),
      });
      ctx.primaryControl(levelGroup.inputs[0]);
      ctx.controls.append(levelGroup.root);

      // --- Secondary controls (ctx.settingsBox): Prior SD + First/Second unit dropdowns + Top-overlap button
      const link = (key) => () => appLink(ctx, CONFIG.apps[key].app, { title: CONFIG.apps[key].title, className: IO.linkClass });
      const priorSlider = ctx.slider({
        label: T.priorLabel,
        ...CONFIG.priorSd,
        name: "priorSd",
        hint: fill(T.priorHint, { app: link("shrinkage") }),
        value: ctx.state.priorSd,
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      const unitOptions = LEAGUE.ids.map((id, i) => ({
        value: id,
        label: words(T.unitOption, { id, group: CONFIG.groupUnit[LEAGUE.group[i]] }),
      }));
      const choose = (slot, id) => {
        const s = summaryOf(ctx.state.priorSd, ctx.state.level);
        const [a, b] = resolvePair(ctx.state.pair, s);
        let first = LEAGUE.ids[a];
        let second = LEAGUE.ids[b];
        if (slot === "first") {
          if (id === second) second = first;
          first = id;
        } else {
          if (id === first) first = second;
          second = id;
        }
        ctx.set({ pair: `${first}-${second}` });
      };
      const firstSelect = ctx.select({
        label: T.firstLabel,
        name: "first",
        options: unitOptions,
        onChange: (v) => {
          nextSlot = "second";
          choose("first", v);
        },
      });
      const secondSelect = ctx.select({
        label: T.secondLabel,
        name: "second",
        options: unitOptions,
        onChange: (v) => {
          nextSlot = "first";
          choose("second", v);
        },
      });
      const bestBtn = ctx.button({
        label: T.bestButton,
        key: "best",
        onClick: () => {
          nextSlot = "first";
          const before = ctx.state.pair;
          ctx.set({ pair: CONFIG.pick });
          if (before === CONFIG.pick) ctx.requestRender("pick");
        },
      });
      const pickHint = h("p", { class: "prx-hint prx-iol-pick-hint" });
      ctx.settingsBox("Settings").body.append(
        h(
          "div",
          { class: "prx-iol-settings-grid" },
          priorSlider.root,
          firstSelect.root,
          secondSelect.root,
          h("div", { class: "prx-io-buttons" }, bestBtn.root),
          pickHint,
        ),
      );

      // --- Primary stage (ctx.stage): 1-line pair header + 30-unit interval plot + 2x2 pair-count summary
      const stagePick = h("p", { class: "prx-iol-stage-pick" });
      const stageCue = h("p", { class: "prx-iol-stage-cue" });
      const stageHead = h("div", { class: "prx-iol-stage-head" }, stagePick, stageCue);

      const leagueSlot = h("div", { class: "prx-io-panel prx-iol-league-chart" });
      const leaguePanel = h("section", { class: "prx-io-view prx-iol-league", "aria-label": T.leagueSection }, leagueSlot);

      const pairStrip = h("div", { class: "prx-iol-pair-strip", "data-prx-evidence": "intervals-and-direction" });
      const matrixCard = h("div", { class: "prx-iol-matrix-card" });
      const side = h("div", { class: "prx-iol-side" }, pairStrip, matrixCard);
      ctx.stage.append(stageHead, h("div", { class: "prx-iol-layout" }, leaguePanel, side));

      // --- Disclosures: Data (exact pair card + 4-row tally table + 30-unit table) & Method (key + provenance note)
      const card = pairCard(ctx);
      card.root.removeAttribute("data-prx-part");
      const tallyWrap = ctx.scrollRegion(h("div", { class: "prx-iol-table-wrap prx-light-panel" }), T.tallyLabel);
      const tally = h("div", { class: "prx-iol-tally" }, tallyWrap);
      const unitsTableSlot = h("div", { class: "prx-iol-units-table" });
      ctx.dataBox("Data and exact values").body.append(
        h("div", { class: "prx-iol-disclosure-stack" }, card.root, tally, unitsTableSlot),
      );

      const leagueKey = keyNode(ctx);
      const note = ctx.part("notes", h("p", { class: "prx-iol-note" }));
      ctx.methodBox("Method and details").body.append(
        h("div", { class: "prx-iol-disclosure-stack" }, leagueKey, note),
      );

      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), ". ", T.gloss);

      // --- Interactive unit picking on the 30-row interval plot
      let figure = null;
      function pickUnit(i) {
        if (i === undefined || i === null) return;
        const slot = nextSlot;
        nextSlot = slot === "first" ? "second" : "first";
        const before = ctx.state.pair;
        choose(slot, LEAGUE.ids[i]);
        if (ctx.state.pair === before) ctx.requestRender("pick");
      }
      function rowAt(e) {
        if (!figure) return null;
        const sy = figure.chart.scale("y");
        const svg = figure.chart.svg;
        const rect = svg.getBoundingClientRect();
        const H = Number(svg.getAttribute("height")) || rect.height;
        if (!(rect.height > 0) || !sy?.domain || !sy?.range) return null;
        const yv = ((e.clientY - rect.top) * H) / rect.height;
        const [d0, d1] = sy.domain;
        const [r0, r1] = sy.range;
        const pos = Math.round(d0 + ((yv - r0) * (d1 - d0)) / (r1 - r0));
        const row = figure.rows.find((r) => r.pos === pos);
        return row ? row.i : null;
      }
      ctx.listen(leagueSlot, "click", (e) => {
        const point = e.target?.closest?.(".prx-kbd-point");
        if (point) {
          const id = String(point.getAttribute("data-prx-focus-key") ?? "").split(":").pop();
          if (INDEX.has(id)) pickUnit(INDEX.get(id));
          return;
        }
        if (e.target?.closest?.("svg")) {
          const i = rowAt(e);
          if (i !== null) pickUnit(i);
        }
      });

      const id = (i) => () => k.unitName(LEAGUE.ids[i]);

      function writeStageHeader(s, pair) {
        stagePick.replaceChildren(
          "Pair: ",
          id(pair.a)(),
          " (pos. ",
          w.count(s.rank[pair.a]),
          ") vs ",
          id(pair.b)(),
          " (pos. ",
          w.count(s.rank[pair.b]),
          ")",
        );
        stageCue.replaceChildren("Click row to pick ", nextSlot === "first" ? "first" : "second");
      }

      function writeStageSummary(s, pair) {
        const unitLine = (u) =>
          h(
            "p",
            { class: "prx-iol-pair-line" },
            id(u)(),
            ": mean ",
            w.est(s.post.mean[u]),
            " [",
            w.est(s.iv.lower[u]),
            ", ",
            w.est(s.iv.upper[u]),
            "]",
          );
        pairStrip.replaceChildren(unitLine(pair.a), unitLine(pair.b),
          h("p", {}, "Probability ", id(pair.a)(), " exceeds ", id(pair.b)(), ": ", w.prob(pair.pi, { hook: "stage-pair-direction" }), "."));

        const pct = (n) => `${(CONFIG.percent * n) / s.M}%`;
        const cell = (cls, countVal, barClass, subNodes = null) => {
          const active = pair.cls === cls;
          return h(
            "div",
            { class: "prx-iol-mcell", "data-active": active ? "true" : undefined },
            h(
              "div",
              { class: "prx-iol-mcell-top" },
              h("span", { class: "prx-iol-mcount" }, w.count(countVal)),
              active ? h("span", { class: "prx-iol-mbadge", text: "chosen" }) : null,
            ),
            subNodes ? h("span", { class: "prx-iol-msub" }, ...subNodes) : null,
            h(
              "span",
              { class: "prx-iol-mbar-track", "aria-hidden": "true" },
              h("span", { class: `prx-iol-mbar ${barClass}`, style: { width: pct(countVal) } }),
            ),
          );
        };

        const emptyCell = h(
          "div",
          { class: "prx-iol-mcell prx-iol-mcell-empty" },
          h("div", { class: "prx-iol-mcell-top" }, h("span", { class: "prx-iol-mcount" }, w.count(0))),
          h("span", { class: "prx-iol-msub", text: "none" }),
        );

        const topPair = s.best
          ? h(
            "p",
            { class: "prx-iol-top-pair" },
            "Top overlap: ",
            id(s.best.first)(),
            " above ",
            id(s.best.second)(),
            " (",
            w.prob(s.best.pi),
            ")",
          )
          : h("p", { class: "prx-iol-top-pair", text: T.tallyNoBest });

        matrixCard.replaceChildren(
          h("p", { class: "prx-iol-matrix-title" }, "All ", w.count(s.M), " pairs: overlap × direction"),
          h(
            "div",
            { class: "prx-iol-matrix", role: "group", "aria-label": "Pair counts by overlap and direction probability" },
            h("span", {}),
            h("div", { class: "prx-iol-mcol" }, "Dir. > ", w.setting(CONFIG.threshold)),
            h("div", { class: "prx-iol-mcol" }, "Dir. ≤ ", w.setting(CONFIG.threshold)),
            h(
              "div",
              { class: "prx-iol-mrow" },
              "Overlap",
              h("span", { class: "prx-iol-mrow-sub" }, w.count(s.counts.overlapping)),
            ),
            cell("high", s.counts.high, "prx-iol-mbar-high"),
            cell("low", s.counts.low, "prx-iol-mbar-low"),
            h(
              "div",
              { class: "prx-iol-mrow" },
              "Apart",
              h("span", { class: "prx-iol-mrow-sub" }, w.count(s.counts.apart)),
            ),
            cell("apart", s.counts.apart, "prx-iol-mbar-apart", ["all > ", w.prob(s.bound)]),
            emptyCell,
          ),
          topPair,
        );
      }

      function writeKey(s, pair) {
        const kind = caseOf(pair);
        leagueKey.replaceChildren(
          keyItem(ctx, "line-dim", fill(T.keyInterval, { level: () => k.pct(s.levelPct) })),
          keyItem(ctx, "line", T.keyChosen),
          keyItem(ctx, kind === "apart" ? "dash" : "band", T.keyGuides[kind]),
        );
      }

      function writeCard(s, pair) {
        const amount = () => k.dec(Math.abs(pair.amount), CONFIG.digits.amount, "card-amount");
        const dec = (raw, name) => () => k.dec(raw, CONFIG.digits.value, name);
        card.set({
          intervals: [
            fill(T.leagueEnds, {
              a: id(pair.a),
              b: id(pair.b),
              aLower: dec(s.iv.lower[pair.a], "card-a-lower"),
              aUpper: dec(s.iv.upper[pair.a], "card-a-upper"),
              bLower: dec(s.iv.lower[pair.b], "card-b-lower"),
              bUpper: dec(s.iv.upper[pair.b], "card-b-upper"),
            }),
            { status: pair.overlap ? "overlap" : "apart", content: fill(pair.overlap ? T.leagueOverlap : T.leagueApart, { amount }) },
            pair.inner === null ? null : fill(T.leagueInside, { inner: id(pair.inner), outer: id(pair.outer) }),
            fill(T.leagueMoments, {
              aMean: dec(s.post.mean[pair.a], "card-a-mean"),
              bMean: dec(s.post.mean[pair.b], "card-b-mean"),
              aSd: dec(s.post.sd[pair.a], "card-a-sd"),
              bSd: dec(s.post.sd[pair.b], "card-b-sd"),
            }),
          ],
          direction: [
            { pi: true, content: fill(T.cardPi, { a: id(pair.a), b: id(pair.b), pi: () => k.prob(pair.pi, "card-pi") }) },
            { hint: true, content: fill(T.cardNext, { app: link("twoUnits") }) },
          ],
        });
      }

      function writeTally(s, pair, state) {
        const thr = () => k.dec(CONFIG.threshold, CONFIG.digits.threshold);
        const classes = [
          { c: "apart", n: s.counts.apart, slots: { bound: () => k.prob(s.bound, "bound") } },
          { c: "high", n: s.counts.high, slots: { thr } },
          { c: "low", n: s.counts.low, slots: { thr } },
        ];
        const body = classes.map((r) => {
          const mine = pair.cls === r.c;
          return h(
            "tr",
            { class: mine ? "prx-iol-chosen-row" : null },
            h(
              "th",
              { scope: "row" },
              h("span", {}, fill(T.tallyRows[r.c], r.slots)),
              mine ? h("span", { class: "prx-iol-tag" }, T.chosenTag) : null,
              h(
                "span",
                { class: "prx-iol-bar-track", "aria-hidden": "true" },
                h("span", { class: `prx-iol-bar prx-iol-bar-${r.c}`, style: { width: `${(CONFIG.percent * r.n) / s.M}%` } }),
              ),
            ),
            h("td", {}, k.count(r.n, `tally-${r.c}`)),
          );
        });
        body.push(
          h(
            "tr",
            { class: "prx-iol-total-row" },
            h("th", { scope: "row" }, T.tallyRows.all),
            h("td", {}, k.count(s.M, "tally-all")),
          ),
        );
        const best = s.best
          ? fill(T.tallyBest, {
            ov: () => k.count(s.counts.overlapping),
            pi: () => k.prob(s.best.pi, "tally-best"),
            a: id(s.best.first),
            b: id(s.best.second),
          })
          : T.tallyNoBest;
        tallyWrap.replaceChildren(
          h("p", { class: "prx-iol-best" }, best),
          h(
            "table",
            { class: "prx-iol-table" },
            h(
              "caption",
              {},
              fill(T.tallyCaption, {
                M: () => k.count(s.M),
                prior: () => k.setting(state.priorSd),
                level: () => k.pct(state.level),
              }),
            ),
            h("thead", {}, h("tr", {}, h("th", { scope: "col" }, T.tallyKind), h("th", { scope: "col" }, T.tallyCount))),
            h("tbody", {}, body),
          ),
        );
      }

      function writeUnitsTable(s) {
        const rows = LEAGUE.ids
          .map((unitId, i) => ({
            id: unitId,
            pos: s.rank[i],
            group: CONFIG.groupWord[LEAGUE.group[i]],
            est: DRAW.estimate[i],
            se: LEAGUE.se[i],
            mean: s.post.mean[i],
            sd: s.post.sd[i],
            lower: s.iv.lower[i],
            upper: s.iv.upper[i],
          }))
          .sort((p, q) => p.pos - q.pos);
        const val4 = (v) => safeDec(v, 4);
        unitsTableSlot.replaceChildren(
          renderDataTable(ctx, {
            caption: [
              "All ",
              w.count(N_UNITS),
              " units ranked by posterior mean (",
              w.num(s.level, formatPercent(s.level)),
              " intervals, prior SD ",
              w.setting(s.priorSd),
              ")",
            ],
            label: "All thirty league units ranked by posterior mean",
            sticky: 1,
            columns: [
              { key: "id", label: T.colUnit, rowHeader: true, name: true },
              { key: "pos", label: T.colPosition, kind: "count" },
              { key: "mean", label: T.colMean, format: val4 },
              { key: "sd", label: T.colSd, format: val4 },
              { key: "lower", label: T.colLower, format: val4 },
              { key: "upper", label: T.colUpper, format: val4 },
              { key: "est", label: "Estimate", format: val4 },
              { key: "se", label: "SE", kind: "setting" },
              { key: "group", label: T.colSize },
            ],
            rows,
          }),
        );
      }

      function writeReadout(s, pair) {
        const piStr = formatReadoutProb(pair.pi);
        const piVerb = /^(?:above|below)/.test(piStr) ? ") is " : ") = ";
        w.set([
          id(pair.a)(),
          " and ",
          id(pair.b)(),
          pair.overlap ? " overlap at " : " do not overlap at ",
          w.num(s.level, formatPercent(s.level), { hook: "level" }),
          pair.overlap ? ", yet Pr(" : ", and Pr(",
          id(pair.a)(),
          " > ",
          id(pair.b)(),
          piVerb,
          w.prob(pair.pi, { hook: "pi" }),
          ". Across ",
          w.count(s.M, { hook: "pairs" }),
          " pairs, ",
          w.count(s.counts.overlapping, { hook: "overlap" }),
          " overlap (",
          w.count(s.counts.high, { hook: "high" }),
          " with direction > ",
          w.setting(CONFIG.threshold),
          ", ",
          w.count(s.counts.low, { hook: "low" }),
          " ≤ ",
          w.setting(CONFIG.threshold),
          ") and ",
          w.count(s.counts.apart, { hook: "apart" }),
          " do not.",
        ]);
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          levelGroup.set(state.level);
          priorSlider.set(state.priorSd);
          const s = summaryOf(state.priorSd, state.level);
          const [a, b] = resolvePair(state.pair, s);
          const pair = pairInfo(s, a, b);
          firstSelect.set(LEAGUE.ids[a]);
          secondSelect.set(LEAGUE.ids[b]);
          pickHint.replaceChildren(words(T.pickHint, { next: nextSlot === "first" ? T.nextFirst : T.nextSecond }));
          writeStageHeader(s, pair);
          figure = drawLeagueFigure(leagueSlot, s, pair);
          writeStageSummary(s, pair);
          writeKey(s, pair);
          writeCard(s, pair);
          writeTally(s, pair, state);
          writeUnitsTable(s);
          writeReadout(s, pair);
          note.replaceChildren(
            ...fill(T.note, {
              league: link("league"),
              shrinkage: link("shrinkage"),
              seed: () => k.setting(LEAGUE_SEED, "note-seed"),
              mean: () => k.setting(CONFIG.priorMean, "note-mean"),
              prior: () => k.setting(state.priorSd, "note-prior"),
            }),
          );
        },
      };
    },
  });
}
