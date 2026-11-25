// noisy-estimate (app 1.2): one reported number is a true value plus noise, and the noise changes each time the data
// are collected again. Migrated to Frame v2.
//
// One unit has a true value and an SE. Each draw collects new data once, and its estimate is the true value plus noise:
// simulateEstimates(truth, se, draws, seed) = truth + se·z with z = normals(seed, draws), the engine's one seeded stream.
// The draws are the first values of that stream, so Draw adds the next one, Clear and then Draw 20 bring back the same
// twenty, and anyone who uses the same seed sees the same scene. Moving the true value or the SE keeps z, so every
// estimate moves with it: its noise in SEs stays the same.

import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatReadoutEst,
  formatReadoutExpected,
  formatReadoutProb,
  formatSci,
  formatSetting,
  formatSigned,
} from "../shared/format.js";
import { exposeResult } from "../shared/labels.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import { evidenceFlags, normalCdf, normals, simulateEstimates } from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "noisy-estimate",
  label: "One number, two parts: repeated estimates of one true value",
  className: "nse",
  truth: Object.freeze({ min: -1, max: 1, step: 0.01 }),
  se: Object.freeze({ min: 0.01, max: 0.5, step: 0.01 }),
  draws: Object.freeze({ min: 0, max: 200 }),
  seed: Object.freeze({ min: 0, max: 4294967295 }),
  // the defaults: the first preset of the catalog entry (se20)
  defaults: Object.freeze({ truth: 0.5, se: 0.2, draws: 20, seed: 1 }),
  many: 20,
  // "within one SE": evidenceFlags with crit 1 leaves the estimate unflagged (label 2)
  within: Object.freeze({ crit: 1, label: 2 }),
  // the axis: the true value ± max(half, reach·SE, the farthest estimate), widened to hold 0, padded by pad of its span
  view: Object.freeze({ half: 0.8, reach: 4, pad: 0.04 }),
  chart: Object.freeze({
    height: 236, minWidth: 200, marginTop: 6, marginBottom: 40, marginLeft: 16, marginRight: 16,
    // the band above the dots that holds the noise arrow and the true-value label (px, sized for 13px v2 chart font)
    header: 48, arrowY: 13, labelY: 36, lineAbove: 24, labelDx: 5, labelRoom: 48, minArrow: 6, head: 7,
    rMax: 6, rMin: 1.5, fitRounds: 6, touch: 0.94, dotStroke: 1.5, ring: 3, ringWidth: 2, line: 2,
    tickSpacing: 120, minTicks: 4, maxTicks: 7, bandDash: "4,3", zeroDash: "2,3", guideDash: "2,3",
    // 13 px SVG label width estimate and clearance from true-value label and plot edges
    noiseLabel: Object.freeze({ char: 7.8, gap: 8, edge: 4 }),
  }),
  digits: Object.freeze({ est: 3, noise: 3, z: 2, data: 4 }),
  text: Object.freeze({
    truthLabel: "True value",
    seLabel: "SE of each estimate",
    truthName: "True value of the unit",
    seName: "Standard error of each estimate",
    drawsGroup: "Collect estimates",
    draw: "Draw",
    drawMany: "Draw",
    clear: "Clear",
    drawsHint: "Each draw collects new data once and adds its estimate.",
    settings: "Settings",
    dataTitle: "Data and exact values",
    seed: "Seed",
    seedHint: "The same seed reproduces the same draws. To share these settings in a link, use the seed, truth, se and draws query keys.",
    full: "The app holds at most",
    fullEnd: "estimates; press Clear to start again.",
    legendIn: "estimate within one SE of the true value",
    legendOut: "estimate farther than one SE away",
    legendBand: "the band: one SE on each side of the true value",
    legendLatest: "the latest estimate; the arrow above the dots is its noise",
    legendZero: "the dotted line marks zero",
    legendGuide: "the dark dotted line leads from the latest estimate up to its arrow",
    xLabel: "Estimate (one dot per draw)",
    truthMark: "true value",
    noiseMark: "noise",
    alt: "Dot plot of the estimates drawn so far, one dot per draw on the estimate axis. The solid vertical line is the true value, and the shaded band reaches one SE on each side of it. Filled dots lie within one SE of the true value and open dots farther away. The ringed dot is the latest estimate; the arrow above the dots runs from the true value to it and is its noise. A dotted line marks zero.",
    pointsLabel: "Estimates drawn so far. Use the arrow keys to read each one, in draw order.",
    kbIn: "within one SE of the true value",
    kbOut: "farther than one SE from the true value",
    tableCaption: "The estimates drawn so far, in draw order",
    dataCaption: "All draws in draw order",
    colDraw: "Draw",
    colEst: "Estimate",
    colTruth: "True value",
    colNoise: "Noise",
    colZ: "Noise in SEs",
    colWithin: "Within one SE",
    yes: "yes",
    no: "no",
    partsHead: "The latest estimate, from draw",
    partsEmpty: "Press Draw to collect an estimate.",
    partEst: "estimate",
    partTruth: "true value",
    partNoise: "noise",
    partSes: "SEs",
    none: "No estimates yet. Press Draw for one estimate or Draw",
    noneEnd: "for twenty.",
    readWithin: "Within one SE: ",
    readOf: " of ",
    readOne: " estimate",
    readMany: " estimates",
    readAverage: ", vs. ",
    readShare: " expected (share ",
    readLatest: "). Draw ",
    readIs: " gives ",
    readTruth: ": true value ",
    readNoise: " plus noise ",
    readSes: " (",
    readEnd: " SEs).",
    note: "Each estimate adds the SE times a standard normal draw to the true value. The same seed reproduces the same draws.",
  }),
});

const T = CONFIG.text;
const D = CONFIG.digits;

// Primary view formatters (CP-1.2: 3 significant figures)
const fmtEst = (x) => formatReadoutEst(x);
const fmtNoise = (x) => formatReadoutEst(x, { signed: true });
const fmtZ = (x) => formatReadoutEst(x, { signed: true });
const fmtExpected = (x) => formatReadoutExpected(x);
const fmtShare = (x) => formatReadoutProb(x);

// Screen-reader plot table formatters (retain exact baseline column precision with bare-zero guard)
const fmtTblEst = (v) => (v === 0 ? "0" : Math.abs(v) < 5e-4 ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits: D.est }));
const fmtTblNoise = (v) => (v === 0 ? "0" : Math.abs(v) < 5e-4 ? formatSci(v, { sig: 3 }) : formatSigned(v, { digits: D.noise }));
const fmtTblZ = (v) => (v === 0 ? "0" : Math.abs(v) < 5e-3 ? formatSci(v, { sig: 3 }) : formatSigned(v, { digits: D.z }));
const fmtDataSigned = (v) => (v === 0 ? "0" : Math.abs(v) < 5e-5 ? formatSci(v, { sig: 3 }) : formatSigned(v, { digits: D.data }));

/** Everything the app shows for one setting. Estimates, noise, flags and the normal share come from the engine. */
export function compute({ truth, se, draws, seed }) {
  const n = Math.max(0, Math.round(draws));
  const est = n > 0 ? simulateEstimates(truth, se, n, seed) : [];
  const z = n > 0 ? Array.from(normals(seed, n)) : [];
  const labels = n > 0 ? evidenceFlags(est, se, { ref: truth, crit: CONFIG.within.crit }).labels : [];
  const inside = labels.map((l) => l === CONFIG.within.label);
  const share = normalCdf(CONFIG.within.crit) - normalCdf(-CONFIG.within.crit);
  const latest = n > 0 ? { draw: n, est: est[n - 1], noise: est[n - 1] - truth, z: z[n - 1] } : null;
  return { truth, se, draws: n, seed, est, z, inside, within: inside.filter(Boolean).length, share, expected: n * share, latest };
}

/** The x domain: centered on the true value, at least CONFIG.view.half on each side, holding every estimate and 0. */
export function domainOf(r) {
  const { half, reach, pad } = CONFIG.view;
  const far = r.est.reduce((m, x) => Math.max(m, Math.abs(x - r.truth)), 0);
  const d = Math.max(half, reach * r.se, far);
  const lo = Math.min(0, r.truth - d);
  const hi = Math.max(0, r.truth + d);
  const span = hi - lo;
  return [lo - pad * span, hi + pad * span];
}

/** Greedy stacking in draw order: each dot takes the lowest level where it overlaps no earlier dot (px positions). */
function stackLevels(pxs, rad) {
  const levels = [];
  const level = pxs.map((p) => {
    let k = 0;
    while (k < levels.length && levels[k].some((q) => Math.abs(q - p) < 2 * rad * CONFIG.chart.touch)) k += 1;
    if (k === levels.length) levels.push([]);
    levels[k].push(p);
    return k;
  });
  return { level, count: levels.length };
}

/** Radius and heights (px above the axis) of the dots so that the stack fits in `area` px, starting from the largest
 * radius times `scale` (1 on every page); levels overlap only when even the smallest radius does not fit. */
export function layout(pxs, area, scale = 1) {
  const C = CONFIG.chart;
  let rad = C.rMax * scale;
  let s = stackLevels(pxs, rad);
  for (let t = 0; t < C.fitRounds && s.count * 2 * rad > area && rad > C.rMin; t += 1) {
    rad = Math.max(C.rMin, area / (2 * s.count));
    s = stackLevels(pxs, rad);
  }
  const step = s.count > 1 ? Math.max(0, Math.min(2 * rad, (area - 2 * rad) / (s.count - 1))) : 2 * rad;
  return { r: rad, levels: s.count, y: s.level.map((k) => rad + k * step) };
}

const CSS = `
.nse .prx-toolbar > .prx-controls { align-items: flex-start; }
.nse .prx-controls > .prx-slider { flex: 1 1 9.5rem; max-width: 13.5rem; }
.nse .nse-draws { flex: 0 1 15.5rem; }
.nse .nse-buttons { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.nse .nse-seed { flex: 1 1 16rem; max-width: 24rem; }
.nse .nse-seed input[type="number"] { width: 9rem; max-width: 100%; }
.nse .nse-full { margin: 0.2rem 0 0; }
.nse .nse-chart { min-width: 0; }
.nse .prx-stage .nse-legend { display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; margin: 0.45rem 0 0; padding: 0.35rem 0.55rem;
  font-size: 0.84375rem; color: var(--prx-plot-muted); background: var(--prx-plot-bg); border: 1px solid var(--prx-border);
  border-radius: 6px; }
.nse .nse-key { display: inline-flex; gap: 0.4rem; align-items: center; min-width: 0; }
.nse .nse-swatch { flex: none; display: inline-block; width: 0.85rem; height: 0.85rem; border-radius: 50%; }
.nse .nse-swatch-in { background: var(--prx-est); border: 1.5px solid var(--prx-est); }
.nse .nse-swatch-out { background: var(--prx-plot-bg); border: 1.5px solid var(--prx-est); }
.nse .nse-swatch-band { width: 1.25rem; border-radius: 2px; background: var(--prx-plot-grid); border: 1px dashed var(--prx-plot-muted); }
.nse .nse-swatch-latest { background: transparent; border: 2px solid var(--prx-plot-fg); }
.nse .nse-swatch-zero { width: 0; height: 1rem; margin: 0 0.4rem; border-radius: 0; border-left: 1.5px dotted var(--prx-plot-muted); }
.nse .nse-swatch-guide { width: 0; height: 1rem; margin: 0 0.4rem; border-radius: 0; border-left: 1.5px dotted var(--prx-plot-fg); }
.nse .prx-stage .nse-parts { margin: 0.55rem 0 0; padding: 0.45rem 0.65rem; color: var(--prx-plot-fg); background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border); border-radius: 6px; }
.nse .nse-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1.4fr);
  gap: 0 0.5rem; align-items: baseline; text-align: center; }
.nse .prx-stage .nse-words { font-size: 0.85em; font-weight: 600; color: var(--prx-plot-muted); }
.nse .nse-values { font-size: 1.1em; font-variant-numeric: tabular-nums; }
.nse .nse-cell { min-width: 0; }
.nse .nse-est-text { color: var(--prx-est-text); }
.nse .prx-stage .nse-op { color: var(--prx-plot-muted); }
.nse .prx-stage .nse-ses { display: block; font-size: 0.8em; color: var(--prx-plot-muted); }
.nse .prx-stage .nse-parts-head, .nse .prx-stage .nse-parts-empty { margin: 0.2rem 0 0; font-size: 0.85em; text-align: center; color: var(--prx-plot-muted); }
/* the full note shows at the cap only (on a phone it shares the draws hint's cell, below) */
.nse .nse-full:not([data-nse-full]) { display: none; }
@media (max-width: 30em) {
  .nse.prx-widget[data-prx-frame="v2"] { padding: 0.5rem 0.6rem 0.45rem; }
  .nse.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .nse.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
  }
  .nse.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .nse.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .nse.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .nse .prx-controls > .prx-slider, .nse .nse-draws, .nse .nse-seed { flex: 1 1 100%; max-width: none; }
  .nse .prx-stage { padding: 0.45rem 0.5rem; display: flex; flex-direction: column; }
  .nse .prx-stage .nse-parts { margin-top: 0.35rem; padding: 0.35rem 0.35rem; }
  .nse .nse-row { column-gap: 0.25rem; }
  /* On both desktop and phone the parts box sits directly under the dot plot, with the legend after it; the draws hint
     and the full note share one grid cell on a phone so reaching 200 draws never shifts the preset chips or readout. */
  .nse .prx-stage .nse-legend { margin-top: 0.35rem; font-size: 0.78125rem; padding: 0.25rem 0.4rem; gap: 0.15rem 0.75rem; }
  .nse .nse-draws { display: grid; grid-template-columns: minmax(0, 1fr); }
  .nse .nse-draws > .nse-draws-hint, .nse .nse-draws > .nse-full { grid-row: 2; grid-column: 1; }
  .nse .nse-full:not([data-nse-full]) { display: block; visibility: hidden; }
  .nse .nse-draws[data-nse-full] > .nse-draws-hint { visibility: hidden; }
}
`;

export function mountWidget(el, spec = {}) {
  const q = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: CSS,
    keys: {
      truth: { type: "number", ...CONFIG.truth, value: q.truth },
      se: { type: "number", ...CONFIG.se, value: q.se },
      draws: { type: "integer", ...CONFIG.draws, value: q.draws },
      seed: { type: "integer", ...CONFIG.seed, value: q.seed },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);

      // --- Primary controls (ctx.controls): truth & SE sliders in exact [truth, se] order + Draw / Draw 20 / Clear
      const truth = ctx.slider({
        label: T.truthLabel,
        ...ctx.key("truth"),
        onInput: (v) => ctx.set({ truth: v }),
      });
      const se = ctx.slider({
        label: T.seLabel,
        ...ctx.key("se"),
        onInput: (v) => ctx.set({ se: v }),
      });
      truth.input.setAttribute("aria-label", T.truthName);
      se.input.setAttribute("aria-label", T.seName);

      const add = (k) => ctx.set({ draws: Math.min(CONFIG.draws.max, ctx.state.draws + k) });
      const drawOne = ctx.button({ label: T.draw, primary: true, key: "draw:one", onClick: () => add(1) });
      ctx.primaryControl(drawOne.root);
      ctx.onPrimary(() => { if (ctx.state.draws < CONFIG.draws.max) add(1); });
      const drawMany = ctx.button({ label: `${T.drawMany} ${CONFIG.many}`, key: "draw:many", onClick: () => add(CONFIG.many) });
      const clear = ctx.button({ label: T.clear, key: "draw:clear", onClick: () => ctx.set({ draws: CONFIG.draws.min }) });

      const fullNote = h("p", { class: "prx-hint nse-full" });
      const drawsBox = h(
        "div",
        { class: "prx-control nse-draws", role: "group", "aria-label": T.drawsGroup },
        h("div", { class: "nse-buttons" }, drawOne.root, drawMany.root, clear.root),
        h("p", { class: "prx-hint nse-draws-hint", text: T.drawsHint }),
        fullNote,
      );
      ctx.controls.append(drawsBox, truth.root, se.root);

      // --- Secondary controls (ctx.settingsBox): Seed + 2-line seed hint
      const seed = ctx.numberInput({
        label: T.seed,
        ...CONFIG.seed,
        step: 1,
        value: ctx.state.seed,
        name: "seed",
        onInput: (v) => { if (Number.isInteger(v)) ctx.set({ seed: v }); },
      });
      const seedHintId = `${seed.input.id}-hint`;
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.classList.add("nse-seed");
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      ctx.settingsBox(T.settings).body.append(seed.root);

      // --- Primary stage (ctx.stage): dot plot (.nse-chart), compact legend (.nse-legend), and visual breakdown (.nse-parts)
      const chartSlot = h("div", { class: "nse-chart" });
      const swatch = (kind) => h("span", { class: `nse-swatch nse-swatch-${kind}`, "aria-hidden": "true" });
      const key = (kind, text) => h("span", { class: "nse-key" }, swatch(kind), h("span", { text }));
      const legend = ctx.part(
        "legend",
        h(
          "div",
          { class: "prx-light-panel nse-legend" },
          key("in", T.legendIn),
          key("out", T.legendOut),
          key("band", T.legendBand),
          key("latest", T.legendLatest),
          key("zero", T.legendZero),
          key("guide", T.legendGuide),
        ),
      );
      const cell = (cls, ...kids) => h("span", { class: `nse-cell ${cls}`.trim() }, ...kids);
      const words = h(
        "div",
        { class: "nse-row nse-words" },
        cell("nse-est-text", T.partEst),
        cell("nse-op", "="),
        cell("", T.partTruth),
        cell("nse-op", "+"),
        cell("", T.partNoise),
      );
      const partsHead = h("p", { class: "nse-parts-head" });
      const values = h("div", { class: "nse-row nse-values" });
      const partsEmpty = h("p", { class: "nse-parts-empty", text: T.partsEmpty, hidden: true });
      const latestBox = h("div", { class: "nse-latest" }, values, partsHead);
      const parts = ctx.part("readout", h("div", { class: "prx-light-panel nse-parts", "data-prx-evidence": "estimate-truth-noise" }, words, latestBox, partsEmpty));
      ctx.stage.append(chartSlot, parts, legend);

      // --- Data disclosure ("Data and exact values"): complete 4-decimal draw table
      const dataSlot = h("div", { class: "nse-data-table" });
      ctx.dataBox(T.dataTitle).body.append(dataSlot);

      // --- Drawing
      function noiseMarks(c, P, { latest, arrowY, side, outward, arrowPx, head, innerW }) {
        const C = CONFIG.chart;
        const N = C.noiseLabel;
        const value = fmtNoise(latest.noise);
        const fullW = N.char * (T.noiseMark.length + 1 + value.length);
        const plainW = N.char * T.noiseMark.length;
        const roomOut = side > 0 ? innerW - head + C.marginRight - N.edge : head + C.marginLeft - N.edge;
        const clearIn = Math.abs(arrowPx) - (N.char * T.truthMark.length) / 2 - N.gap;
        const place = roomOut >= C.labelDx + fullW ? "out" : clearIn >= fullW ? "in" : null;
        const out = place ? place === "out" : (outward || roomOut >= C.labelDx + plainW);
        const anchor = (side > 0) === out ? "start" : "end";
        const mark = { x: "est", y: () => arrowY, fill: c.plotFg, dx: out ? side * C.labelDx : 0, dy: out ? 0 : -C.arrowY, textAnchor: anchor };
        if (!place) {
          if (!out && clearIn < plainW) return [];
          return [P.text([latest], { ...mark, text: () => T.noiseMark })];
        }
        const withNumber = (index, scales, values, dims, context, next) => {
          const g = next(index, scales, values, dims, context);
          for (const node of g?.querySelectorAll ? g.querySelectorAll("text") : []) {
            const tspan = node.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.setAttribute("data-num", dataNum(latest.noise));
            tspan.setAttribute("data-prx-readout", "chart-noise");
            tspan.setAttribute("font-weight", "600");
            tspan.textContent = value;
            node.replaceChildren(`${T.noiseMark} `, tspan);
          }
          return g;
        };
        return [P.text([latest], { ...mark, text: () => `${T.noiseMark} ${value}`, render: withNumber })];
      }

      function drawChart(r) {
        const C = CONFIG.chart;
        const width = Math.max(C.minWidth, Math.round(chartSlot.clientWidth || ctx.width()));
        const height = C.height;
        const inner = Math.max(1, height - C.marginTop - C.marginBottom);
        const dotTop = Math.max(1, inner - C.header);
        const [lo, hi] = domainOf(r);
        const innerW = Math.max(1, width - C.marginLeft - C.marginRight);
        const px = (x) => ((x - lo) / (hi - lo)) * innerW;
        const lay = layout(r.est.map(px), dotTop);
        const dots = r.est.map((x, i) => ({ draw: i + 1, est: x, noise: x - r.truth, z: r.z[i], inside: r.inside[i], y: lay.y[i] }));
        const latest = dots.at(-1) ?? null;
        const arrowY = dotTop + C.arrowY;
        const arrowPx = latest ? px(latest.est) - px(r.truth) : 0;
        const arrow = latest && Math.abs(arrowPx) >= C.minArrow;
        const side = arrowPx >= 0 ? 1 : -1;
        const room = side > 0 ? innerW - px(latest?.est ?? r.truth) : px(latest?.est ?? r.truth);
        const outward = room >= C.labelRoom;
        const zero = lo < 0 && hi > 0 && Math.abs(px(0) - px(r.truth)) >= C.minArrow;
        const xTicks = Math.min(C.maxTicks, Math.max(C.minTicks, Math.round(innerW / C.tickSpacing)));

        plot(chartSlot, {
          alt: T.alt,
          table: {
            caption: T.tableCaption,
            columns: [
              { label: T.colDraw, value: "draw", format: (v) => formatCount(v) },
              { label: T.colEst, value: "est", format: fmtTblEst },
              { label: T.colNoise, value: "noise", format: fmtTblNoise },
              { label: T.colZ, value: "z", format: fmtTblZ },
              { label: T.colWithin, value: (d) => (d.inside ? T.yes : T.no) },
            ],
            rows: dots,
          },
          width,
          height,
          marginTop: C.marginTop,
          marginBottom: C.marginBottom,
          marginLeft: C.marginLeft,
          marginRight: C.marginRight,
          x: { domain: [lo, hi], label: T.xLabel, labelAnchor: "center", labelArrow: "none", ticks: xTicks },
          y: { domain: [0, inner], axis: null },
          color: { type: "identity" },
          marks: (c, P) => [
            P.rect([{ x1: r.truth - r.se, x2: r.truth + r.se }], { x1: "x1", x2: "x2", y1: 0, y2: dotTop, fill: c.plotGrid }),
            P.ruleX([r.truth - r.se, r.truth + r.se], { y1: 0, y2: dotTop, stroke: c.plotMuted, strokeDasharray: C.bandDash }),
            zero ? P.ruleX([0], { y1: 0, y2: dotTop, stroke: c.plotMuted, strokeDasharray: C.zeroDash }) : null,
            P.ruleY([0], { stroke: c.plotAxis }),
            P.ruleX([r.truth], { y1: 0, y2: dotTop + C.lineAbove, stroke: c.plotFg, strokeWidth: C.line }),
            P.text([r.truth], { x: (d) => d, y: dotTop + C.labelY, text: () => T.truthMark, textAnchor: "middle", fill: c.plotFg, fontWeight: "bold" }),
            arrow ? P.ruleX([latest.est], { y1: latest.y + lay.r + C.ring, y2: arrowY, stroke: c.plotFg, strokeDasharray: C.guideDash }) : null,
            P.dot(dots, { x: "est", y: "y", r: lay.r, fill: (d) => (d.inside ? c.est : c.plotBg), stroke: c.est, strokeWidth: C.dotStroke }),
            latest ? P.dot([latest], { x: "est", y: "y", r: lay.r + C.ring, fill: "none", stroke: c.plotFg, strokeWidth: C.ringWidth }) : null,
            arrow ? P.arrow([{ x1: r.truth, x2: latest.est, y: arrowY }], { x1: "x1", x2: "x2", y1: "y", y2: "y", stroke: c.plotFg, strokeWidth: C.line, headLength: C.head }) : null,
            ...(arrow ? noiseMarks(c, P, { latest, arrowY, side, outward, arrowPx, head: px(latest.est), innerW }) : []),
          ],
          keyboard: dots.length ? {
            data: dots, x: "est", y: "y", key: (d) => String(d.draw), sort: false,
            label: T.pointsLabel,
            title: (d) => `Draw ${formatCount(d.draw)}: estimate ${fmtEst(d.est)}, the true value ${formatSetting(r.truth)} plus noise ${fmtNoise(d.noise)} (${fmtZ(d.z)} SEs), ${d.inside ? T.kbIn : T.kbOut}.`,
          } : undefined,
        });

        dataSlot.replaceChildren(
          renderDataTable(ctx, {
            caption: [T.dataCaption, " (seed ", w.setting(r.seed), ")."],
            label: T.dataCaption,
            sticky: 1,
            emptyText: T.partsEmpty,
            columns: [
              { key: "draw", label: T.colDraw, rowHeader: true, kind: "count" },
              { key: "est", label: T.colEst, kind: "decimal", digits: D.data },
              { label: T.colTruth, value: () => r.truth, kind: "setting" },
              { key: "noise", label: T.colNoise, numeric: true, format: fmtDataSigned },
              { key: "z", label: T.colZ, numeric: true, format: fmtDataSigned },
              { label: T.colWithin, value: (d) => (d.inside ? T.yes : T.no) },
            ],
            rows: dots,
          }),
        );
      }

      function drawParts(r) {
        const L = r.latest;
        partsEmpty.hidden = Boolean(L);
        values.hidden = !L;
        partsHead.hidden = !L;
        if (!L) { values.replaceChildren(); partsHead.replaceChildren(); return; }
        partsHead.replaceChildren(`${T.partsHead} `, w.count(L.draw, { hook: "parts-draw" }));
        const noiseCell = cell(
          "nse-noise",
          "(",
          w.num(L.noise, fmtNoise(L.noise), { hook: "parts-noise" }),
          ")",
          h("span", { class: "nse-ses" }, w.num(L.z, fmtZ(L.z), { hook: "parts-noise-se" }), ` ${T.partSes}`),
        );
        values.replaceChildren(
          cell("nse-est-text", w.num(L.est, fmtEst(L.est), { hook: "parts-estimate" })),
          cell("nse-op", "="),
          cell("", w.setting(r.truth, { hook: "parts-truth" })),
          cell("nse-op", "+"),
          noiseCell,
        );
      }

      function drawReadout(r) {
        const L = r.latest;
        if (!L) { w.set([`${T.none} `, w.count(CONFIG.many), ` ${T.noneEnd}`]); return; }
        w.set([
          T.readWithin,
          w.count(r.within, { hook: "within" }),
          T.readOf,
          w.count(r.draws, { hook: "draws" }),
          r.draws === 1 ? T.readOne : T.readMany,
          T.readAverage,
          w.num(r.expected, fmtExpected(r.expected), { hook: "expected" }),
          T.readOf,
          w.count(r.draws, { hook: "draws-expected" }),
          T.readShare,
          w.num(r.share, fmtShare(r.share), { hook: "share" }),
          T.readLatest,
          w.count(L.draw, { hook: "latest-draw" }),
          T.readIs,
          w.num(L.est, fmtEst(L.est), { hook: "latest" }),
          T.readTruth,
          w.setting(r.truth, { hook: "truth" }),
          T.readNoise,
          w.num(L.noise, fmtNoise(L.noise), { hook: "noise" }),
          T.readSes,
          w.num(L.z, fmtZ(L.z), { hook: "noise-se" }),
          T.readEnd,
        ]);
      }

      function drawCaption(r) {
        const result = r.draws > 0 ? { label: "monte-carlo", S: r.draws, seed: r.seed, truth: r.truth, se: r.se, estimates: r.est } : null;
        exposeResult(ctx, result, "draws");
        ctx.caption.replaceChildren(ctx.info?.caption || T.note, ...(result ? [" ", captionNode(ctx, "monte-carlo", result), "."] : []));
      }

      function syncButtons(state) {
        const active = ctx.doc.activeElement;
        const full = state.draws >= CONFIG.draws.max;
        const empty = state.draws <= CONFIG.draws.min;
        drawOne.setDisabled(full);
        drawMany.setDisabled(full);
        clear.setDisabled(empty);
        fullNote.toggleAttribute("data-nse-full", full);
        drawsBox.toggleAttribute("data-nse-full", full);
        fullNote.replaceChildren(`${T.full} `, w.count(CONFIG.draws.max), ` ${T.fullEnd}`);
        const wasHere = [drawOne, drawMany, clear].some((b) => b.root === active);
        if (wasHere && active.disabled) (full ? clear : drawOne).root.focus({ preventScroll: true });
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            truth.set(state.truth);
            se.set(state.se);
            if (seed.get() !== state.seed) seed.set(state.seed);
            const r = compute(state);
            drawChart(r);
            drawParts(r);
            drawReadout(r);
            drawCaption(r);
            syncButtons(state);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
