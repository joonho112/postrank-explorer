// winners-curse (app 1.4): "Too good to be true at the top". Migrated to Frame v2.
// Follows the k units at one end of the simulated 30-unit league by estimate across replays, comparing raw estimate
// minus true value (vermillion) against shrunken posterior mean minus true value (navy).
import { createWidget, uid } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatReadoutEst,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro as createRo } from "../shared/readout.js";
import { LEAGUE_SEED, drawLeague, leagueOvershoot, mcse, summaryStats } from "../pr-core.js";
import {
  CONFIG as LEAGUE_APP,
  GROUP,
  LEAGUE,
  cssFor,
  drawLeagueTable,
  drawLineNodes,
  drawSummary,
  fill,
  textKit,
  valueDomain,
  words,
} from "../shared/domain/noisy-league.js";
import { CONFIG as SHRINK, compute } from "../shared/domain/shrinkage.js";

export const CONFIG = Object.freeze({
  name: "winners-curse",
  label: "Too good to be true at the top: the units with the largest (or smallest) estimates of the simulated league, their estimates and posterior means against their true values, replay by replay",
  title: "The ends of the league table against the true values",
  className: "prx-wc",
  // replay r uses seed + r, so the default seed puts the draw that 1.3 and 1.5 show first (LEAGUE_SEED) at replay 1
  seed: Object.freeze({ min: 1, max: 4294967295, value: LEAGUE_SEED - 1 }),
  replays: Object.freeze({ values: Object.freeze([20, 200, 2000]), value: 2000 }),
  // the units followed at one end; at most half the league, so the top k and the bottom k never share a unit
  k: Object.freeze({ min: 1, max: 15, value: 3 }),
  side: Object.freeze({ values: Object.freeze(["top", "bottom"]), value: "top" }),
  // the replay shown in the league table (1 = the first replay)
  draw: Object.freeze({ min: 1, max: 2000, value: 1 }),
  memo: 16,
  band: Object.freeze({ near: 0.1, most: 0.5 }),
  digits: Object.freeze({ table: 3 }),
  // histogram bins: about this many over the span of the estimates' averages, on a nice width
  bins: Object.freeze({ target: Object.freeze({ 20: 12, 200: 24, 2000: 36 }), fallback: 30, widths: Object.freeze([0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.5]), eps: 1e-9, decimals: 6 }),
  chart: Object.freeze({
    // Top margin holds two rows at 13px v2 chart typography: "mean" + value on top (dy = -34 -> y = 8) at the top end of
    // the dashed line (lineTop = 15), one full row above the replay triangle (markerDy = -8 -> y = 34).
    height: 158, marginTop: 42, marginBottom: 38, marginLeft: 54, marginRight: 14, xTicks: 6, yTicks: 4,
    zeroWidth: 1.25, meanWidth: 1.75, meanDash: "5,3", shownWidth: 1.5, shownDash: "1.5,2.5", marker: 4.5, markerDy: -8, barRim: 0.5,
    meanLabel: Object.freeze({ dy: -34, lineTop: 15, gap: 4, char: 7.8, edge: 4, minWidth: 200, defaultWidth: 640 }),
    ringPad: 3, ringWidth: 1.5, arrowWidth: 1.4,
    postDot: SHRINK.chart.dot, postRim: SHRINK.chart.dotRim, headLength: SHRINK.chart.headLength,
    insetStart: LEAGUE_APP.radius.small, diamond: LEAGUE_APP.chart.diamond, halo: LEAGUE_APP.chart.halo,
    arrowMinPx: LEAGUE_APP.radius.small + SHRINK.chart.dot + SHRINK.chart.headLength + 2,
  }),
  text: Object.freeze({
    settings: "Settings",
    dataTitle: "Data, replay league and summary",
    methodTitle: "Method and setup",
    k: "Units at the end, k",
    kHint: "The k units with the largest estimates (top) or the smallest (bottom), picked again in every replay.",
    side: "End",
    sideWords: Object.freeze({ top: "Top", bottom: "Bottom" }),
    sideLower: Object.freeze({ top: "top", bottom: "bottom" }),
    priorHint: "The posterior means use one normal prior centered at {zero}, the average of the league's true values (set by hand), shared by all units. The true values have a spread (SD) of {spread}.",
    replays: "Replays",
    draw: "Replay shown in the league table",
    drawHint: "Replay {r} of {R} (seed {seed} + {r2}).",
    seed: "Seed of the replays",
    // league table (Data disclosure)
    leagueHead: "League table of the replay shown, ranked by estimate (highest at the top)",
    keyRing: "ring: the {end} {k} by estimate in this replay, the units the histograms follow",
    keyPost: "posterior mean of a unit followed",
    keyArrow: "the move from its estimate to its posterior mean",
    tPostMean: "Posterior mean",
    tFollowed: "Followed",
    yes: "yes",
    no: "no",
    keyFollowed: " Followed here: posterior mean {pm}; estimate minus true value {gap}; posterior mean minus true value {pgap}.",
    keyOther: " Posterior mean {pm}.",
    // histograms (Primary stage)
    distNote: "Each replay keeps the true values fixed, draws new estimates, and selects its {end} {k} units by estimate. The bars count how many replays fall in each range of the average error.",
    estHead: "Estimate minus true value ({end} {k}, {R} replays): mean {mean}",
    postHead: "Posterior mean minus true value (prior SD {sd}, true SD {spread}): mean {mean}",
    estX: "Average of estimate minus true value",
    postX: "Average of posterior mean minus true value",
    yLabel: "Replays",
    estAlt: "Histogram of the replays: for each replay, the average of estimate minus true value over the units followed, in bins; a solid line at 0, a dashed line at the mean over the replays and a triangle at the replay shown in the league table.",
    postAlt: "Histogram of the replays: for each replay, the average of posterior mean minus true value over the same units, in bins; a solid line at 0, a dashed line at the mean over the replays and a triangle at the replay shown in the league table.",
    estTable: "Replays by the average of estimate minus true value",
    postTable: "Replays by the average of posterior mean minus true value",
    tFrom: "From",
    tTo: "To",
    tReplays: "Replays",
    estKbd: "Estimates: one point per bin of replays",
    postKbd: "Posterior means: one point per bin of replays",
    meanWord: "mean",
    kbdBin: "{which}: {n} of {R} replays average from {lo} to {hi}.",
    kbdEst: "Estimates",
    kbdPost: "Posterior means",
    keyEstBar: "estimates",
    keyPostBar: "posterior means",
    keyZero: "solid line at {zero}: on target",
    keyMean: "dashed line: replay mean",
    keyShown: "triangle: replay {r}",
    // summary (Data disclosure)
    tableCaption: "The {end} {k} by estimate",
    colShown: "Replay {r}",
    colAverage: "Average, {R} replays",
    rowGap: "Estimate minus true value",
    rowPostGap: "Posterior mean minus true value",
    tableLabel: "The replay shown and the average over the replays",
    lead: Object.freeze({
      pastSlight: "At this prior SD the posterior means take back about the whole gap, and slightly more: on average over these replays, the gap of {e} between estimate and true value becomes {p}.",
      past: "At this prior SD the posterior means take back more than the gap: on average over these replays, the gap of {e} between estimate and true value becomes {p}, on the other side of the true values.",
      nearly: "At this prior SD the posterior means take back nearly the whole gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      most: "At this prior SD the posterior means take back most of the gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      part: "At this prior SD the posterior means take back part of the gap: on average over these replays, the gap of {e} between estimate and true value shrinks to {p}.",
      all: "At this prior SD the posterior means are on target to three sig figs, on average over these replays: they take back the whole gap of {e} between estimate and true value.",
      none: "At this prior SD the posterior means are no closer to the true values than the estimates, on average over these replays: the gap of {e} between estimate and true value becomes {p}.",
      level: "On average over these replays the estimates of these units are on target, so there is no gap to take back.",
    }),
    mcseNote: "Monte Carlo SE of the two averages (their SD across the replays over the square root of {R}): {a} and {b}.",
    // concise 24-word 3-sig-fig read-out and provenance caption
    readout: "{End} {k} across {R} replays: estimates average {e} from truth; posterior means average {p} (prior SD {sd}). Replay {r} (seed {seed}): {er} and {pr}.",
    league: "A simulated league built for this site: thirty fictional units with fixed true values; every replay adds noise of the unit's SE to each true value, computed in this browser.",
    postFrom: "Posterior means from ",
    replayNote: "; replay r uses seed {seed} + r.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;
const NL = LEAGUE_APP.text;
/** The spread (SD, divisor n − 1) of the league's true values (engine summaryStats). */
const SPREAD = summaryStats(LEAGUE.theta).sd;
const ZERO = 0;

// 3-sig-fig formatters (CP-1.2) + bare-zero guards on data tables
const fmtValue = (x) => formatReadoutEst(x);
const fmtGap = (x) => formatReadoutEst(x);
const fmtMcse = (x) => formatReadoutEst(x);
const fmtBinEdge = (x) => (x !== 0 && Math.abs(x) < 5e-4 ? formatSci(x, { sig: 3 }) : formatDecimal(x, { digits: CONFIG.digits.table }));
const fmtLeagueCol = (x) => (x === 0 ? "0" : Math.abs(x) < 5e-4 ? formatSci(x, { sig: 3 }) : formatDecimal(x, { digits: CONFIG.digits.table }));

// ---------------------------------------------------------------------------------------------- computing

/** A first-in first-out memo of `size` entries. */
function memo(size, make) {
  const store = new Map();
  return (key, ...args) => {
    if (!store.has(key)) {
      if (store.size >= size) store.delete(store.keys().next().value);
      store.set(key, make(...args));
    }
    return store.get(key);
  };
}

const runMemo = memo(CONFIG.memo, (seed, replays, k, side, priorSd) => leagueOvershoot(seed, { replays, k, side, priorSd }));

/** leagueOvershoot for a state (memoized): the replays seed + 1 … seed + R, the k units at one end, the averages. */
export function overshootRun({ seed, replays, k, side, priorSd }) {
  return runMemo(`${seed}|${replays}|${k}|${side}|${priorSd}`, seed, replays, k, side, priorSd);
}

const domainMemo = memo(CONFIG.memo, (seed, R) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 1; r <= R; r += 1) {
    for (const x of drawLeague(seed + r).estimate) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return valueDomain({ first: { estimate: [lo, hi] }, replays: [] }, false);
});

/** The league table's x domain for a state (memoized per seed and replays). */
export const runDomain = ({ seed, replays }) => domainMemo(`${seed}|${replays}`, seed, replays);

/** The smallest nice bin width at least x. */
function niceWidth(x) {
  const w = CONFIG.bins.widths;
  return w.find((v) => v >= x) ?? w[w.length - 1];
}

const round = (x) => Number(x.toFixed(CONFIG.bins.decimals));

/**
 * The histograms' bins: one width for both (about CONFIG.bins.target[R] bins over the span of the estimates' averages
 * and 0), edges on multiples of the width, a domain that holds both sets of averages and 0.
 */
export function replayBins(R, est, post) {
  const B = CONFIG.bins;
  const span = Math.max(ZERO, ...est) - Math.min(ZERO, ...est);
  const width = niceWidth(span / (B.target[R] ?? B.fallback));
  const lo = round(Math.floor(Math.min(ZERO, ...est, ...post) / width + B.eps) * width);
  let hi = round(Math.ceil(Math.max(ZERO, ...est, ...post) / width - B.eps) * width);
  if (!(hi > lo)) hi = round(lo + width);
  const count = Math.round((hi - lo) / width);
  const binsOf = (values) => {
    const n = new Array(count).fill(0);
    for (const v of values) n[Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width + B.eps)))] += 1;
    return n.map((c, i) => ({ i, lo: round(lo + i * width), hi: round(lo + (i + 1) * width), n: c })).filter((b) => b.n > 0);
  };
  return { lo, hi, width, est: binsOf(est), post: binsOf(post) };
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `${cssFor(CONFIG.className)}
.prx-wc .prx-stage > .prx-wc-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: .8rem; align-items: start; }
.prx-wc .prx-wc-comparison > * { min-width: 0; }
.prx-wc .prx-wc-unit-scroll { max-height: 17rem; overflow: auto; }
.prx-wc .prx-wc-unit-table { width: 100%; font-size: .875rem; }
.prx-wc .prx-wc-unit-table caption { caption-side: top; text-align: left; color: inherit; font-weight: 600; }
.prx-wc .prx-wc-unit-table th, .prx-wc .prx-wc-unit-table td { padding: .3rem; text-align: right; }
.prx-wc .prx-wc-unit-table th:first-child { text-align: left; }

.prx-wc > .prx-title { margin: 0 0 0.3rem; font-size: 1rem; line-height: 1.25; }
.prx-wc .prx-controls > .prx-slider { flex: 1 1 11rem; max-width: 15rem; }
.prx-wc .prx-wc-settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: flex-start;
  width: 100%;
}
.prx-wc .prx-wc-settings-grid > .prx-slider { flex: 1 1 13rem; max-width: 20rem; }
.prx-wc .prx-wc-seed { flex: 1 1 14rem; max-width: 22rem; }
.prx-wc .prx-wc-seed input[type="number"] { width: 9rem; max-width: 100%; }
.prx-wc .prx-wc-seed .prx-hint, .prx-wc .prx-wc-draw .prx-hint { margin: 0.15rem 0 0; }
.prx-wc .prx-wc-draw { flex: 1 1 15rem; max-width: 22rem; min-width: 0; }
.prx-wc .prx-wc-draw > .prx-slider { max-width: none; }
/* PR-01 guard: neutralize legacy named grid areas from cssFor("prx-wc") at >= 56rem container widths */
.prx-wc .prx-wc-league,
.prx-wc .prx-nl-league,
.prx-wc .prx-nl-tallies,
.prx-wc .prx-nl-replays {
  grid-area: auto;
  margin-top: 0;
}
.prx-wc .prx-stage { container-type: inline-size; }
.prx-wc .prx-wc-league, .prx-wc .prx-wc-dist, .prx-wc .prx-wc-sum, .prx-wc .prx-wc-hists, .prx-wc .prx-wc-hist { min-width: 0; max-width: 100%; }
.prx-wc .prx-wc-hist + .prx-wc-hist { margin-top: 0.5rem; }
.prx-wc .prx-stage .prx-wc-hist-head { margin: 0 0 0.15rem; font-size: 0.875rem; font-weight: 600; line-height: 1.3; color: var(--prx-plot-fg); }
.prx-wc .prx-wc-data-stack,
.prx-wc .prx-wc-method-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
  container-type: inline-size;
}
.prx-wc .prx-wc-method-stack > p { margin: 0; font-size: 0.875rem; color: var(--prx-fg); }
.prx-wc .prx-wc-league-key { display: block; column-gap: 1.25rem; }
.prx-wc .prx-wc-league-key > .prx-nl-key-item { display: flex; break-inside: avoid; margin: 0 0 0.25rem; }
.prx-wc .prx-wc-key-wide { display: block; column-span: all; margin: 0.3rem 0 0; }
.prx-wc .prx-wc-size-row { display: flex; flex-wrap: wrap; gap: 0.15rem 1.1rem; }
@container (min-width: 30rem) {
  .prx-wc .prx-wc-league-key { column-count: 2; }
}
.prx-wc .prx-wc-lead { margin: 0 0 0.35rem; font-size: 0.9em; font-weight: 600; color: var(--prx-fg); }
.prx-wc .prx-wc-sum .prx-nl-table-wrap { margin-top: 0.25rem; }
.prx-wc .prx-wc-mcse { margin: 0.35rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); }
.prx-wc .prx-wc-sw { flex: none; display: inline-block; box-sizing: border-box; }
.prx-wc .prx-wc-sw-ring { width: 13px; height: 13px; border: 1.5px solid var(--prx-plot-fg); border-radius: 50%; }
.prx-wc .prx-wc-sw-post { width: 8px; height: 8px; margin: 0 2px; background: var(--prx-post); border-radius: 50%; }
.prx-wc .prx-wc-sw-arrow { position: relative; width: 1.4rem; height: 0; border-top: 1.5px solid var(--prx-post); }
.prx-wc .prx-wc-sw-arrow::after { content: ""; position: absolute; right: -1px; top: -4.25px; border-left: 6px solid var(--prx-post);
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; }
.prx-wc .prx-wc-sw-bar { width: 0.8rem; height: 0.8rem; border: 1px solid var(--prx-plot-bg); }
.prx-wc .prx-wc-sw-est { background: var(--prx-est); }
.prx-wc .prx-wc-sw-postbar { background: var(--prx-post); }
.prx-wc .prx-wc-sw-zero { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 1.5px solid var(--prx-plot-axis); }
.prx-wc .prx-wc-sw-mean { width: 0; height: 0.95rem; margin: 0 0.3rem; border-left: 2px dashed var(--prx-plot-fg); }
.prx-wc .prx-wc-sw-marker { width: 0; height: 0; margin: 0 0.15rem; border-top: 7px solid var(--prx-plot-fg);
  border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; }
.prx-wc .prx-wc-table { width: auto; max-width: 100%; }
.prx-wc .prx-wc-table thead th:first-child { text-align: left; }
.prx-wc .prx-wc-table th, .prx-wc .prx-wc-table td { overflow-wrap: normal; word-break: normal; }
.prx-wc .prx-wc-table tbody th { white-space: normal; min-width: 7.5rem; }
.prx-wc .prx-wc-keep { white-space: nowrap; }
@media (max-width: 30em) {
  .prx-wc.prx-widget[data-prx-frame="v2"] { padding: 0.5rem 0.6rem 0.45rem; }
  .prx-wc.prx-widget[data-prx-frame="v2"] > .prx-title { font-size: 0.9rem; margin-bottom: 0.15rem; }
  .prx-wc.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-wc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
  }
  .prx-wc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-wc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-wc.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-wc .prx-controls > .prx-slider,
  .prx-wc .prx-wc-settings-grid > .prx-slider,
  .prx-wc .prx-wc-settings-grid > .prx-wc-draw,
  .prx-wc .prx-wc-settings-grid > .prx-wc-seed { flex-basis: 100%; max-width: none; }
  .prx-wc .prx-stage { padding: 0.45rem 0.5rem; }
  .prx-wc .prx-stage .prx-wc-hist-head { font-size: 0.8125rem; }
  .prx-wc .prx-stage .prx-nl-key { padding: 0.25rem 0.4rem; gap: 0.15rem 0.75rem; font-size: 0.78125rem; }
}
`;

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      seed: { type: "integer", min: CONFIG.seed.min, max: CONFIG.seed.max, value: CONFIG.seed.value },
      replays: { type: "choice", values: CONFIG.replays.values, value: CONFIG.replays.value },
      k: { type: "integer", min: CONFIG.k.min, max: CONFIG.k.max, value: CONFIG.k.value },
      side: { type: "choice", values: CONFIG.side.values, value: CONFIG.side.value },
      priorSd: { type: "number", min: SHRINK.priorSd.min, max: SHRINK.priorSd.max, step: SHRINK.priorSd.step, value: SHRINK.priorSd.value },
      draw: { type: "integer", min: CONFIG.draw.min, max: CONFIG.draw.max, value: CONFIG.draw.value },
    },
    build(ctx) {
      const { h } = ctx;
      const kit = textKit(ctx);
      const w = createRo(ctx);
      const ro = (name, raw, display) => kit.tagged(ctx.num(raw, display), name);
      const zero = () => ctx.num(ZERO, formatDecimal(ZERO, { digits: 0 }));

      // --- Primary controls (ctx.controls): Prior SD slider (primaryControl) + End segmented (Top / Bottom)
      const prior = ctx.slider({
        label: SHRINK.text.sliderLabel,
        ...ctx.key("priorSd"),
        name: "priorSd",
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      ctx.primaryControl(prior.input);

      const side = ctx.segmented({
        label: T.side,
        name: "side",
        value: ctx.state.side,
        options: CONFIG.side.values.map((v) => ({ value: v, label: T.sideWords[v] })),
        onChange: (v) => ctx.set({ side: v }),
      });
      ctx.controls.append(prior.root, side.root);

      // --- Secondary controls (ctx.settingsBox): Units at the end k, Replays, Replay shown (.prx-wc-draw), Seed
      const kSlider = ctx.slider({
        label: T.k,
        ...ctx.key("k"),
        name: "k",
        format: (v) => formatCount(v),
        onInput: (v) => ctx.set({ k: Math.round(v) }),
      });
      const kHint = h("p", { class: "prx-hint", id: uid("prx-wc-k-hint"), text: T.kHint });
      kSlider.input.setAttribute("aria-describedby", kHint.id);
      kSlider.root.append(kHint);

      const replays = ctx.segmented({
        label: T.replays,
        name: "replays",
        value: ctx.state.replays,
        options: CONFIG.replays.values.map((v) => ({ value: v, label: formatCount(v) })),
        onChange: (v) => ctx.set({ replays: v }),
      });

      const drawSlot = h("div", { class: "prx-wc-draw" });
      const drawHint = h("p", { class: "prx-hint", id: uid("prx-wc-draw-hint") });
      let drawSlider = null;
      let drawMax = 0;
      const makeDrawSlider = (R, value) => {
        drawMax = R;
        drawSlider = ctx.slider({
          label: T.draw,
          min: CONFIG.draw.min,
          max: R,
          step: 1,
          value,
          name: "draw",
          key: "slider:draw",
          format: (v) => formatCount(v),
          onInput: (v) => ctx.set({ draw: Math.round(v) }),
        });
        drawSlider.input.setAttribute("aria-describedby", drawHint.id);
        drawSlot.replaceChildren(drawSlider.root, drawHint);
      };
      makeDrawSlider(ctx.state.replays, Math.min(ctx.state.draw, ctx.state.replays));

      const seedHintId = uid("prx-wc-seed-hint");
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
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: NL.seedHint }));
      seed.root.classList.add("prx-wc-seed");

      ctx.settingsBox(T.settings).body.append(
        h("div", { class: "prx-wc-settings-grid" }, kSlider.root, replays.root, drawSlot, seed.root),
      );

      // --- Primary stage (ctx.stage): paired histograms (.prx-wc-hists) + compact key (.prx-nl-key)
      const estHead = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-wc-hist-head" }));
      const estSlot = h("div", { class: "prx-wc-hist-chart prx-wc-est-chart" });
      const postHead = ctx.part("notes", ctx.panelTitle("", { level: 5, className: "prx-wc-hist-head" }));
      const postSlot = h("div", { class: "prx-wc-hist-chart prx-wc-post-chart" });
      const distKey = h("div", { class: "prx-nl-key", "data-prx-part": "legend" });
      const hists = h(
        "div",
        { class: "prx-wc-hists" },
        h("div", { class: "prx-wc-hist" }, estHead, estSlot),
        h("div", { class: "prx-wc-hist" }, postHead, postSlot),
      );
      const distBox = h("section", { class: "prx-wc-dist", "aria-label": T.replays }, hists, distKey);
      const selectedReplay = h("section", { "data-prx-evidence": "selected-replay" });
      ctx.stage.append(h("div", { class: "prx-wc-comparison" }, selectedReplay, distBox));

      // --- Data disclosure ("Data, replay league and summary"): Monte Carlo summary/MCSE table + single-replay 30-unit league
      const lead = h("p", { class: "prx-wc-lead", "data-prx-part": "readout" });
      const summary = h("div", { class: "prx-wc-summary" });
      const mcseNote = h("p", { class: "prx-wc-mcse", "data-prx-part": "notes" });
      const sumBox = h("div", { class: "prx-wc-sum" }, lead, summary, mcseNote);

      const drawLine = h("p", { class: "prx-nl-drawline", "data-prx-part": "notes" });
      const leagueSlot = h("div", { class: "prx-nl-league-chart" });
      const leagueKey = h("div", { class: "prx-nl-key prx-wc-league-key", "data-prx-part": "legend" });
      const leagueBox = h(
        "section",
        { class: "prx-wc-league", "aria-label": T.leagueHead },
        ctx.panelTitle(T.leagueHead, { className: "prx-nl-heading" }),
        drawLine,
        leagueSlot,
        leagueKey,
      );
      ctx.dataBox(T.dataTitle).body.append(h("div", { class: "prx-wc-data-stack" }, sumBox, leagueBox));

      // --- Method disclosure ("Method and setup"): replay selection definition, shared normal prior, and model gloss
      const distNote = h("p", { class: "prx-wc-note", "data-prx-part": "notes" });
      const priorHint = h(
        "p",
        { id: uid("prx-wc-prior-hint") },
        ...fill(T.priorHint, { zero, spread: () => ctx.num(SPREAD, fmtValue(SPREAD)) }),
      );
      prior.input.setAttribute("aria-describedby", priorHint.id);
      const modelNote = h("p", {}, T.league, " ", T.postFrom, captionNode(ctx, "teaching-posterior"), ". ", SHRINK.text.gloss);
      ctx.methodBox(T.methodTitle).body.append(h("div", { class: "prx-wc-method-stack" }, distNote, priorHint, modelNote));

      // ------------------------------------------------------------------------------------------- drawing

      function drawTable(state, shown, d, post) {
        const followed = new Set(d.units);
        const pm = post.units.map((u) => u.pm);
        const domain = runDomain(state);
        const end = T.sideLower[state.side];
        drawLeagueTable(ctx, { slot: leagueSlot, key: leagueKey }, {
          draw: shown,
          domain,
          reveal: true,
          k: state.k,
          marks: (c, P, rows) => {
            const units = rows.filter((row) => followed.has(row.i)).map((row) => ({ ...row, pm: pm[row.i] }));
            const [lo, hi] = domain;
            const inner = Math.max(1, (leagueSlot.clientWidth || ctx.width()) - LEAGUE_APP.chart.marginLeft - LEAGUE_APP.chart.marginRight);
            const px = (u) => (Math.abs(u.pm - u.est) * inner) / (hi - lo);
            return [
              P.dot(units, { x: "est", y: "pos", r: (u) => u.r + C.ringPad, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }),
              P.link(units.filter((u) => px(u) < C.arrowMinPx), { x1: "est", x2: "pm", y1: "pos", y2: "pos", stroke: c.post, strokeWidth: C.arrowWidth }),
              P.arrow(units.filter((u) => px(u) >= C.arrowMinPx), {
                x1: "est", x2: "pm", y1: "pos", y2: "pos", stroke: c.post, strokeWidth: C.arrowWidth, headLength: C.headLength,
                insetStart: C.insetStart, insetEnd: C.postDot, bend: 0,
              }),
              P.dot(units, { x: "pm", y: "pos", r: C.postDot, fill: c.post, stroke: c.plotBg, strokeWidth: C.postRim }),
              P.dot(units, { x: "theta", y: "pos", symbol: "diamond", r: C.diamond, fill: c.plotFg, stroke: c.plotBg, strokeWidth: C.halo }),
            ];
          },
          keyItems: (kk) => {
            const item = (...children) => h("span", { class: "prx-nl-key-item" }, ...children);
            return [
              item(
                h("span", { class: "prx-wc-sw prx-wc-sw-ring", "aria-hidden": "true" }),
                h("span", {}, ...fill(T.keyRing, { end, k: () => kk.count(state.k) })),
              ),
              item(h("span", { class: "prx-wc-sw prx-wc-sw-post", "aria-hidden": "true" }), T.keyPost),
              item(h("span", { class: "prx-wc-sw prx-wc-sw-arrow", "aria-hidden": "true" }), T.keyArrow),
              h("span", { class: "prx-wc-key-wide prx-wc-size-lead" }, NL.cardLead),
              h(
                "span",
                { class: "prx-wc-key-wide prx-wc-size-row" },
                ...LEAGUE_APP.groups.map((g) =>
                  item(
                    kk.swatch(g),
                    h("span", {}, ...fill(NL.cardGroup, {
                      group: NL.groupWord[g],
                      g: () => kk.count(GROUP[g].count),
                      obs: () => kk.count(GROUP[g].obs, `obs-${g}`),
                      se: () => kk.setting(GROUP[g].se, `se-${g}`),
                    })),
                  ),
                ),
              ),
            ];
          },
          columns: [
            { label: T.tPostMean, value: (row) => pm[row.i], format: fmtLeagueCol },
            { label: T.tFollowed, value: (row) => (followed.has(row.i) ? T.yes : T.no) },
          ],
          title: (row) => (followed.has(row.i)
            ? words(T.keyFollowed, { pm: fmtValue(pm[row.i]), gap: fmtGap(row.est - row.theta), pgap: fmtGap(pm[row.i] - row.theta) })
            : words(T.keyOther, { pm: fmtValue(pm[row.i]) })),
        });
      }

      function meanMarks(c, P, { which, mean, lo, hi, width }) {
        const L = C.meanLabel;
        const inner = Math.max(1, width - C.marginLeft - C.marginRight);
        const x = C.marginLeft + ((mean - lo) / (hi - lo)) * inner;
        const text = fmtGap(mean);
        const left = x - L.gap - L.char * T.meanWord.length;
        const right = x + L.gap + L.char * text.length;
        const dx = left < L.edge ? L.edge - left : right > width - L.edge ? width - L.edge - right : 0;
        const hook = (index, scales, values, dims, context, next) => {
          const g = next(index, scales, values, dims, context);
          for (const node of g?.querySelectorAll ? g.querySelectorAll("text") : []) node.setAttribute("data-prx-readout", `chart-mean-${which}`);
          return g;
        };
        const at = { x: (v) => v, frameAnchor: "top", dy: L.dy, lineAnchor: "middle", fill: c.plotFg };
        return [
          P.text([mean], { ...at, text: () => T.meanWord, dx: dx - L.gap, textAnchor: "end" }),
          numText([mean], { ...at, value: (v) => v, format: fmtGap, dx: dx + L.gap, textAnchor: "start", fontWeight: 600, render: hook }),
        ];
      }

      function drawHistogram(slot, { which, bins, lo, hi, yMax, mean, shown, R }) {
        const est = which === "est";
        const L = C.meanLabel;
        const measured = Math.round(slot.clientWidth || 0);
        const width = measured > 0 ? Math.max(L.minWidth, measured) : L.defaultWidth;
        const narrow = width < 440;
        const xTicks = narrow ? 4 : C.xTicks;
        const xLabel = est
          ? (narrow ? "Mean error: estimate − truth" : T.estX)
          : (narrow ? "Mean error: posterior mean − truth" : T.postX);
        plot(slot, {
          alt: est ? T.estAlt : T.postAlt,
          table: {
            caption: est ? T.estTable : T.postTable,
            columns: [
              { label: T.tFrom, value: "lo", format: fmtBinEdge },
              { label: T.tTo, value: "hi", format: fmtBinEdge },
              { label: T.tReplays, value: "n", format: (v) => formatCount(v) },
            ],
            rows: bins,
          },
          width,
          height: C.height,
          marginTop: C.marginTop,
          marginBottom: C.marginBottom,
          marginLeft: C.marginLeft,
          marginRight: C.marginRight,
          x: { domain: [lo, hi], label: xLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: xTicks },
          y: { domain: [0, yMax], nice: true, label: T.yLabel, labelAnchor: "center", labelArrow: "none", grid: true, ticks: C.yTicks },
          marks: (c, P) => [
            P.rect(bins, { x1: "lo", x2: "hi", y1: 0, y2: "n", fill: est ? c.est : c.post, stroke: c.plotBg, strokeWidth: C.barRim }),
            P.ruleY([0], { stroke: c.plotAxis }),
            P.ruleX([ZERO], { stroke: c.plotAxis, strokeWidth: C.zeroWidth }),
            P.ruleX([mean], { stroke: c.plotFg, strokeWidth: C.meanWidth, strokeDasharray: C.meanDash, insetTop: C.meanLabel.lineTop - C.marginTop }),
            P.ruleX([shown], { stroke: c.plotMuted, strokeWidth: C.shownWidth, strokeDasharray: C.shownDash }),
            P.dot([shown], { x: (v) => v, frameAnchor: "top", dy: C.markerDy, symbol: "triangle", rotate: 180, r: C.marker, fill: c.plotFg }),
            ...meanMarks(c, P, { which, mean, lo, hi, width }),
          ],
          keyboard: {
            data: bins,
            x: (b) => (b.lo + b.hi) / 2,
            y: "n",
            key: (b) => `${which}${b.i}`,
            label: est ? T.estKbd : T.postKbd,
            title: (b) => words(T.kbdBin, {
              which: est ? T.kbdEst : T.kbdPost,
              n: formatCount(b.n),
              R: formatCount(R),
              lo: fmtBinEdge(b.lo),
              hi: fmtBinEdge(b.hi),
            }),
          },
        });
      }

      function drawReplays(state, run, d, r) {
        const R = run.replays;
        const end = T.sideLower[state.side];
        const est = run.draws.map((x) => x.overshoot);
        const post = run.draws.map((x) => x.posteriorOvershoot);
        const b = replayBins(R, est, post);
        const yMax = Math.max(...b.est.map((x) => x.n), ...b.post.map((x) => x.n));
        const slots = { R: () => kit.count(R), end, k: () => kit.count(state.k) };
        distNote.replaceChildren(...fill(T.distNote, slots));
        estHead.replaceChildren(...fill(T.estHead, {
          ...slots,
          mean: () => ro("mean-est", run.mean.overshoot, fmtGap(run.mean.overshoot)),
        }));
        postHead.replaceChildren(...fill(T.postHead, {
          ...slots,
          sd: () => ro("prior-sd", state.priorSd, formatSetting(state.priorSd)),
          spread: () => ro("spread", SPREAD, fmtValue(SPREAD)),
          mean: () => ro("mean-post", run.mean.posteriorOvershoot, fmtGap(run.mean.posteriorOvershoot)),
        }));
        drawHistogram(estSlot, { which: "est", bins: b.est, lo: b.lo, hi: b.hi, yMax, mean: run.mean.overshoot, shown: d.overshoot, R });
        drawHistogram(postSlot, { which: "post", bins: b.post, lo: b.lo, hi: b.hi, yMax, mean: run.mean.posteriorOvershoot, shown: d.posteriorOvershoot, R });
        const item = (cls, ...itemWords) => h("span", { class: "prx-nl-key-item" }, h("span", { class: `prx-wc-sw ${cls}`, "aria-hidden": "true" }), ...itemWords);
        distKey.replaceChildren(
          item("prx-wc-sw-bar prx-wc-sw-est", T.keyEstBar),
          item("prx-wc-sw-bar prx-wc-sw-postbar", T.keyPostBar),
          item("prx-wc-sw-zero", h("span", {}, ...fill(T.keyZero, { zero }))),
          item("prx-wc-sw-mean", T.keyMean),
          item("prx-wc-sw-marker", h("span", {}, ...fill(T.keyShown, { r: () => kit.count(r) }))),
        );

        const e = run.mean.overshoot;
        const p = run.mean.posteriorOvershoot;
        const L = T.lead;
        const B = CONFIG.band;
        const shows = (x) => /[1-9]/.test(fmtGap(x));
        const left = p / e;
        const which = !shows(e) ? "level" : !shows(p) ? "all"
          : left < 0 ? (-left <= B.near ? "pastSlight" : "past")
            : left < 1 ? (left <= B.near ? "nearly" : left <= B.most ? "most" : "part") : "none";
        lead.replaceChildren(...fill(L[which], {
          e: () => ro("lead-est", e, fmtGap(e)),
          p: () => ro("lead-post", p, fmtGap(p)),
        }));

        const cell = (name, raw) => h("td", {}, ro(name, raw, fmtGap(raw)));
        const table = h(
          "table",
          { class: "prx-nl-table prx-wc-table" },
          h("caption", {}, ...fill(T.tableCaption, { end, k: () => kit.count(state.k) })),
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("td", {}),
              h("th", { scope: "col" }, h("span", { class: "prx-wc-keep" }, ...fill(T.colShown, { r: () => kit.count(r) }))),
              h("th", { scope: "col" }, ...fill(T.colAverage, { R: () => kit.count(R) })),
            ),
          ),
          h(
            "tbody",
            {},
            h("tr", {}, h("th", { scope: "row", text: T.rowGap }), cell("shown-est", d.overshoot), cell("avg-est", e)),
            h("tr", {}, h("th", { scope: "row", text: T.rowPostGap }), cell("shown-post", d.posteriorOvershoot), cell("avg-post", p)),
          ),
        );
        summary.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-nl-table-wrap" }, table), T.tableLabel));
        const se = (values, name) => () => {
          const m = mcse(values);
          return ro(name, m, fmtMcse(m));
        };
        mcseNote.replaceChildren(...fill(T.mcseNote, { R: () => kit.count(R), a: se(est, "mcse-est"), b: se(post, "mcse-post") }));
      }

      function writeReadout(state, run, d, r) {
        w.set(fill(T.readout, {
          End: T.sideWords[state.side],
          k: () => ro("read-k", state.k, formatCount(state.k)),
          R: () => ro("read-replays", run.replays, formatCount(run.replays)),
          e: () => ro("read-est", run.mean.overshoot, fmtGap(run.mean.overshoot)),
          p: () => ro("read-post", run.mean.posteriorOvershoot, fmtGap(run.mean.posteriorOvershoot)),
          sd: () => ro("read-prior-sd", state.priorSd, formatSetting(state.priorSd)),
          r: () => ro("read-replay", r, formatCount(r)),
          seed: () => ro("read-seed", d.seed, formatSetting(d.seed)),
          er: () => ro("read-shown-est", d.overshoot, fmtGap(d.overshoot)),
          pr: () => ro("read-shown-post", d.posteriorOvershoot, fmtGap(d.posteriorOvershoot)),
        }));
      }

      function writeCaption(state, run) {
        ctx.caption.replaceChildren(
          ...(ctx.info?.caption ? [ctx.info.caption, " "] : []),
          captionNode(ctx, "monte-carlo", { S: run.replays, seed: state.seed }),
          ...fill(T.replayNote, { seed: () => ro("caption-seed", state.seed, formatSetting(state.seed)) }),
        );
      }

      return {
        render(state, info) {
          const R = state.replays;
          const r = Math.max(CONFIG.draw.min, Math.min(state.draw, R));
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data") {
              const run = overshootRun(state);
              const d = run.draws[r - 1];
              const shown = drawSummary(d.seed);
              const post = compute({ priorSd: state.priorSd, equalSe: false, seed: d.seed });
              drawTable(state, shown, d, post);
            }
            return;
          }
          if (r !== state.draw) ctx.set({ draw: r });
          side.set(state.side);
          kSlider.set(state.k);
          prior.set(state.priorSd);
          replays.set(state.replays);
          if (drawMax !== R) ctx.keepFocus(() => makeDrawSlider(R, r));
          else drawSlider.set(r);
          if (Number(seed.input.value) !== state.seed) seed.set(state.seed);

          const run = overshootRun(state);
          const d = run.draws[r - 1];
          const shown = drawSummary(d.seed);
          const post = compute({ priorSd: state.priorSd, equalSe: false, seed: d.seed });

          drawHint.replaceChildren(...fill(T.drawHint, {
            r: () => ro("draw-replay", r, formatCount(r)),
            R: () => kit.count(R),
            seed: () => ro("draw-seed", state.seed, formatSetting(state.seed)),
            r2: () => kit.count(r),
          }));
          drawLine.replaceChildren(...drawLineNodes(ctx, r, d.seed, { prefix: "line" }));
          const table = h("table", { class: "prx-wc-unit-table" },
            h("caption", {}, "Selected by the ", T.sideLower[state.side], " estimates in replay ", kit.count(r)),
            h("thead", {}, h("tr", {}, ...["Unit", "Estimate", "Truth", "Posterior mean", "Estimate − truth"].map(label => h("th", { scope: "col", text: label })))),
            h("tbody", {}, ...d.units.map(i => h("tr", { "data-unit": LEAGUE.ids[i] },
              h("th", { scope: "row", "data-prx-name": "", text: LEAGUE.ids[i] }),
              ...[shown.estimate[i], LEAGUE.theta[i], post.units[i].pm, shown.estimate[i] - LEAGUE.theta[i]]
                .map(v => h("td", {}, ctx.num(v, fmtValue(v))))))));
          selectedReplay.replaceChildren(ctx.scrollRegion(h("div", { class: "prx-wc-unit-scroll" }, table), "Selected units in this replay"));
          drawTable(state, shown, d, post);
          drawReplays(state, run, d, r);
          writeReadout(state, run, d, r);
          writeCaption(state, run);
        },
      };
    },
  });
}
