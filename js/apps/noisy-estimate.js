// noisy-estimate (app 1.2): one reported number is a true value plus noise, and the noise changes each time the data
// are collected again. Starting point: postrank Explorer v1 L-02 (js/widgets/noisy-estimate.js and
// styles/widgets/noisy-estimate.css), without the prediction gate (its question, locks, wait note and verdict) and
// without present mode; everything the gate held back is shown at once.
//
// One unit has a true value and an SE. Each draw collects new data once, and its estimate is the true value plus noise:
// simulateEstimates(truth, se, draws, seed) = truth + se·z with z = normals(seed, draws), the engine's one seeded stream.
// The draws are the first values of that stream, so Draw adds the next one, Clear and then Draw 20 bring back the same
// twenty, and anyone who uses the same seed sees the same scene. Moving the true value or the SE keeps z, so every
// estimate moves with it: its noise in SEs stays the same.
//
//   figure    a dot plot of the estimates drawn so far, each dot at its exact value and stacked upward where it would
//             overlap an earlier one (greedy, in draw order; the radius shrinks until the stack fits). The true value
//             is a solid line and the band reaches one SE on each side. Filled dots lie within one SE (evidenceFlags
//             with ref = the true value and crit = 1: not flagged), open dots farther away. The latest estimate is
//             ringed, and an arrow from the true value to it, above the dots, is its noise. The arrow keys read every
//             dot in draw order, as the hidden table lists them.
//   legend    six keys, on the plot panel like the figure, so the swatches keep their plot colors in both themes; the
//             two dotted lines are both named (zero, muted; the guide from the latest estimate up to its arrow, ink)
//   parts     the latest estimate split into its two parts, estimate = true value + noise, with the noise in SEs (on
//             the plot panel too; aria-hidden, because the read-out says the same)
//   read-out  how many estimates lie within one SE beside the count expected on average, draws × (Φ(1) − Φ(−1))
//             with the engine's normalCdf (the share at four decimals, so that share × draws matches the count shown:
//             .6827 × 20 = 13.65), then the latest estimate as the true value plus its noise
//   caption   the note (the catalog caption) and the Monte Carlo caption with the number of draws and the seed
//             (labels.js); the draws are exposed as a Monte Carlo result, so the checks compare the caption slots with it
// The axis is centered on the true value and reaches max(.8, 4 SE, the farthest estimate) on each side, and always 0,
// so the three preset SEs share one axis and the dots visibly gather as the SE shrinks.
//
// Keys (all URL parameters): truth and se (numbers, clamped to the slider ranges), draws (an integer from 0 to 200) and
// seed (an integer from 0 to 2³² − 1). The defaults are the first preset (true value .50, SE .20, 20 draws, seed 1).
// The within count and the expected count are counted here from engine values (evidenceFlags labels, normalCdf).

import { createWidget } from "../shared/base.js";
import { plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatProb, formatSetting, formatSigned } from "../shared/format.js";
import { captionNode, exposeResult } from "../shared/labels.js";
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
    height: 240, minWidth: 200, marginTop: 6, marginBottom: 40, marginLeft: 16, marginRight: 16,
    // the band above the dots that holds the noise arrow and the true-value label (px)
    header: 42, arrowY: 12, labelY: 32, lineAbove: 22, labelDx: 5, labelRoom: 40, minArrow: 6, head: 7,
    rMax: 6, rMin: 1.5, fitRounds: 6, touch: 0.94, dotStroke: 1.5, ring: 3, ringWidth: 2, line: 2,
    tickSpacing: 72, minTicks: 3, bandDash: "4,3", zeroDash: "2,3", guideDash: "2,3",
  }),
  digits: Object.freeze({ est: 3, noise: 3, z: 2, expected: 2, share: 4 }),
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
    seed: "Seed",
    seedHint: "The same seed gives the same estimates, so a shared link shows the same scene.",
    full: "The app holds at most",
    fullEnd: "estimates; press Clear to start again.",
    legendIn: "estimate within one SE of the true value",
    legendOut: "estimate farther than one SE away",
    legendBand: "the band: one SE on each side of the true value",
    legendLatest: "the latest estimate; the arrow above the dots is its noise",
    legendZero: "the dotted line marks zero",
    // the second dotted line: the guide from the latest estimate up to its arrow (darker than the zero line)
    legendGuide: "the dark dotted line leads from the latest estimate up to its arrow",
    xLabel: "Estimate (one dot per draw)",
    truthMark: "true value",
    noiseMark: "noise",
    alt: "Dot plot of the estimates drawn so far, one dot per draw on the estimate axis. The solid vertical line is the true value, and the shaded band reaches one SE on each side of it. Filled dots lie within one SE of the true value and open dots farther away. The ringed dot is the latest estimate; the arrow above the dots runs from the true value to it and is its noise. A dotted line marks zero.",
    pointsLabel: "Estimates drawn so far. Use the arrow keys to read each one, in draw order.",
    kbIn: "within one SE of the true value",
    kbOut: "farther than one SE from the true value",
    tableCaption: "The estimates drawn so far, in draw order",
    colDraw: "Draw",
    colEst: "Estimate",
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
    readWithin: "Within one SE of the true value: ",
    readOf: " of ",
    readOne: " estimate",
    readMany: " estimates",
    readAverage: ", compared with ",
    readShare: " expected on average (a share of ",
    readLatest: "). The latest estimate, from draw ",
    readIs: ", is ",
    readTruth: ": the true value ",
    readNoise: " plus noise ",
    readSes: ", or ",
    readEnd: " SEs.",
    // the caption's note; the catalog caption (catalog/entries/1.2-noisy-estimate.json) is the same sentence
    note: "Simulated estimates: each is the true value plus the SE times a random draw from the bell-shaped normal curve, and the seed fixes the draws.",
  }),
});

const T = CONFIG.text;
const D = CONFIG.digits;

const fmtEst = (x) => formatDecimal(x, { digits: D.est });
const fmtNoise = (x) => formatSigned(x, { digits: D.noise });
const fmtZ = (x) => formatSigned(x, { digits: D.z });
const fmtExpected = (x) => formatDecimal(x, { digits: D.expected });
const fmtShare = (x) => formatProb(x, { digits: D.share });

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

// The app's own CSS (base.js adds it once per document); every selector starts with .nse, the app's root class. The
// legend and the parts box carry the shared .prx-light-panel class, so they stay on light paper in both themes and the
// text tokens inside them resolve to the panel inks. The two sliders, the draw buttons and the seed share the first
// row of the controls on a page (bases 12 + 12 + 14 + 13 rem and three gaps fit in 56 rem); at 375 px every control
// takes its own row.
const CSS = `
.nse .prx-slider { flex-basis: 12rem; }
.nse .nse-draws { flex: 1 1 14rem; }
.nse .nse-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.nse .nse-seed { flex: 0 1 13rem; }
.nse .nse-seed input[type="number"] { width: 100%; }
.nse .nse-full { margin: 0.25rem 0 0; }
.nse .nse-chart { min-width: 0; }
.nse .nse-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0.5rem 0 0; padding: 0.35rem 0.6rem;
  font-size: 0.9em; color: var(--prx-plot-muted); background: var(--prx-plot-bg); border: 1px solid var(--prx-border);
  border-radius: 6px; }
.nse .nse-key { display: inline-flex; gap: 0.4rem; align-items: center; min-width: 0; }
.nse .nse-swatch { flex: none; display: inline-block; width: 0.85rem; height: 0.85rem; border-radius: 50%; }
.nse .nse-swatch-in { background: var(--prx-est); border: 1.5px solid var(--prx-est); }
.nse .nse-swatch-out { background: var(--prx-plot-bg); border: 1.5px solid var(--prx-est); }
.nse .nse-swatch-band { width: 1.25rem; border-radius: 2px; background: var(--prx-plot-grid); border: 1px dashed var(--prx-plot-muted); }
.nse .nse-swatch-latest { background: transparent; border: 2px solid var(--prx-plot-fg); }
.nse .nse-swatch-zero { width: 0; height: 1rem; margin: 0 0.4rem; border-radius: 0; border-left: 1.5px dotted var(--prx-plot-muted); }
.nse .nse-swatch-guide { width: 0; height: 1rem; margin: 0 0.4rem; border-radius: 0; border-left: 1.5px dotted var(--prx-plot-fg); }
.nse .nse-parts { margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; color: var(--prx-plot-fg); background: var(--prx-plot-bg);
  border: 1px solid var(--prx-border); border-radius: 6px; }
.nse .nse-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1.4fr);
  gap: 0 0.5rem; align-items: baseline; text-align: center; }
.nse .nse-words { font-size: 0.9em; font-weight: 600; color: var(--prx-plot-muted); }
.nse .nse-values { font-size: 1.15em; font-variant-numeric: tabular-nums; }
.nse .nse-cell { min-width: 0; }
.nse .nse-est-text { color: var(--prx-est-text); }
.nse .nse-op { color: var(--prx-plot-muted); }
.nse .nse-ses { display: block; font-size: 0.8em; color: var(--prx-plot-muted); }
.nse .nse-parts-head, .nse .nse-parts-empty { margin: 0.25rem 0 0; font-size: 0.9em; text-align: center; color: var(--prx-plot-muted); }
@media (max-width: 30em) {
  .nse .prx-slider, .nse .nse-draws, .nse .nse-seed { flex: 1 1 100%; }
  .nse .nse-parts { padding: 0.5rem 0.4rem; }
  .nse .nse-row { column-gap: 0.25rem; }
}
`;

export function mountWidget(el, spec = {}) {
  const q = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    keys: {
      truth: { type: "number", ...CONFIG.truth, value: q.truth },
      se: { type: "number", ...CONFIG.se, value: q.se },
      draws: { type: "integer", ...CONFIG.draws, value: q.draws },
      seed: { type: "integer", ...CONFIG.seed, value: q.seed },
    },
    build(ctx) {
      const { h } = ctx;
      const tagged = (node, name) => { node.setAttribute("data-prx-readout", name); return node; };
      const ro = (name, raw, display) => tagged(ctx.num(raw, display), name);

      // --- controls: the true value, the SE, the draw buttons and the seed
      const truth = ctx.slider({ label: T.truthLabel, ...CONFIG.truth, value: ctx.state.truth, name: "truth", onInput: (v) => ctx.set({ truth: v }) });
      const se = ctx.slider({ label: T.seLabel, ...CONFIG.se, value: ctx.state.se, name: "se", onInput: (v) => ctx.set({ se: v }) });
      truth.input.setAttribute("aria-label", T.truthName);
      se.input.setAttribute("aria-label", T.seName);
      const add = (k) => ctx.set({ draws: Math.min(CONFIG.draws.max, ctx.state.draws + k) });
      const drawOne = ctx.button({ label: T.draw, primary: true, key: "draw:one", onClick: () => add(1) });
      const drawMany = ctx.button({ label: `${T.drawMany} ${CONFIG.many}`, key: "draw:many", onClick: () => add(CONFIG.many) });
      const clear = ctx.button({ label: T.clear, key: "draw:clear", onClick: () => ctx.set({ draws: CONFIG.draws.min }) });
      const fullNote = h("p", { class: "prx-hint nse-full", hidden: true });
      const drawsBox = h("div", { class: "prx-control nse-draws", role: "group", "aria-label": T.drawsGroup },
        h("div", { class: "nse-buttons" }, drawOne.root, drawMany.root, clear.root),
        h("p", { class: "prx-hint", text: T.drawsHint }), fullNote);
      const seed = ctx.numberInput({
        label: T.seed, ...CONFIG.seed, step: 1, value: ctx.state.seed, name: "seed",
        // only whole numbers are read; anything else is ignored, not rounded
        onInput: (v) => { if (Number.isInteger(v)) ctx.set({ seed: v }); },
      });
      const seedHintId = `${seed.input.id}-hint`;
      seed.input.setAttribute("aria-describedby", seedHintId);
      seed.root.classList.add("nse-seed");
      seed.root.append(h("p", { id: seedHintId, class: "prx-hint", text: T.seedHint }));
      ctx.controls.append(truth.root, se.root, drawsBox, seed.root);

      // --- figure, legend and the two parts of the latest estimate
      const chartSlot = h("div", { class: "nse-chart" });
      const swatch = (kind) => h("span", { class: `nse-swatch nse-swatch-${kind}`, "aria-hidden": "true" });
      const key = (kind, text) => h("span", { class: "nse-key" }, swatch(kind), h("span", { text }));
      const legend = ctx.part("legend", h("div", { class: "prx-light-panel nse-legend" },
        key("in", T.legendIn), key("out", T.legendOut), key("band", T.legendBand), key("latest", T.legendLatest), key("zero", T.legendZero),
        key("guide", T.legendGuide)));
      const cell = (cls, ...kids) => h("span", { class: `nse-cell ${cls}`.trim() }, ...kids);
      const words = h("div", { class: "nse-row nse-words" },
        cell("nse-est-text", T.partEst), cell("nse-op", "="), cell("", T.partTruth), cell("nse-op", "+"), cell("", T.partNoise));
      const partsHead = h("p", { class: "nse-parts-head" });
      const values = h("div", { class: "nse-row nse-values" });
      const partsEmpty = h("p", { class: "nse-parts-empty", text: T.partsEmpty, hidden: true });
      const latestBox = h("div", { class: "nse-latest" }, values, partsHead);
      // the parts repeat the read-out's second sentence for the eye; screen readers hear it once, in the read-out
      const parts = ctx.part("readout", h("div", { class: "prx-light-panel nse-parts", "aria-hidden": "true" }, words, latestBox, partsEmpty));
      ctx.charts.append(chartSlot, legend, parts);

      // --- drawing
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
        // the noise label sits beyond the arrowhead; near the plot's edge it moves above the arrowhead, inside
        const room = side > 0 ? innerW - px(latest?.est ?? r.truth) : px(latest?.est ?? r.truth);
        const outward = room >= C.labelRoom;
        const zero = lo < 0 && hi > 0 && Math.abs(px(0) - px(r.truth)) >= C.minArrow;
        plot(chartSlot, {
          alt: T.alt,
          table: {
            caption: T.tableCaption,
            columns: [
              { label: T.colDraw, value: "draw", format: (v) => formatCount(v) },
              { label: T.colEst, value: "est", format: (v) => fmtEst(v) },
              { label: T.colNoise, value: "noise", format: (v) => fmtNoise(v) },
              { label: T.colZ, value: "z", format: (v) => fmtZ(v) },
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
          x: { domain: [lo, hi], label: T.xLabel, labelAnchor: "center", labelArrow: "none", ticks: Math.max(C.minTicks, Math.round(innerW / C.tickSpacing)) },
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
            arrow ? P.text([latest], {
              x: "est", y: () => arrowY, text: () => T.noiseMark, fill: c.plotFg,
              dx: outward ? side * C.labelDx : 0, dy: outward ? 0 : -C.arrowY,
              textAnchor: outward ? (side > 0 ? "start" : "end") : (side > 0 ? "end" : "start"),
            }) : null,
          ],
          keyboard: dots.length ? {
            data: dots, x: "est", y: "y", key: (d) => String(d.draw), sort: false,
            label: T.pointsLabel,
            title: (d) => `Draw ${formatCount(d.draw)}: estimate ${fmtEst(d.est)}, the true value ${formatSetting(r.truth)} plus noise ${fmtNoise(d.noise)} (${fmtZ(d.z)} SEs), ${d.inside ? T.kbIn : T.kbOut}.`,
          } : undefined,
        });
      }

      function drawParts(r) {
        const L = r.latest;
        partsEmpty.hidden = Boolean(L);
        values.hidden = !L;
        partsHead.hidden = !L;
        if (!L) { values.replaceChildren(); partsHead.replaceChildren(); return; }
        partsHead.replaceChildren(`${T.partsHead} `, ro("parts-draw", L.draw, formatCount(L.draw)));
        const noiseCell = cell("nse-noise", "(", ro("parts-noise", L.noise, fmtNoise(L.noise)), ")",
          h("span", { class: "nse-ses" }, ro("parts-noise-se", L.z, fmtZ(L.z)), ` ${T.partSes}`));
        values.replaceChildren(
          cell("nse-est-text", ro("parts-estimate", L.est, fmtEst(L.est))), cell("nse-op", "="),
          cell("", ro("parts-truth", r.truth, formatSetting(r.truth))), cell("nse-op", "+"), noiseCell);
      }

      function drawReadout(r) {
        const L = r.latest;
        if (!L) { ctx.readout.set([`${T.none} `, ctx.num(CONFIG.many, formatCount(CONFIG.many)), ` ${T.noneEnd}`]); return; }
        ctx.readout.set([
          T.readWithin, ro("within", r.within, formatCount(r.within)), T.readOf, ro("draws", r.draws, formatCount(r.draws)),
          r.draws === 1 ? T.readOne : T.readMany, T.readAverage, ro("expected", r.expected, fmtExpected(r.expected)), T.readOf,
          ro("draws-expected", r.draws, formatCount(r.draws)), T.readShare, ro("share", r.share, fmtShare(r.share)),
          T.readLatest, ro("latest-draw", L.draw, formatCount(L.draw)), T.readIs, ro("latest", L.est, fmtEst(L.est)),
          T.readTruth, ro("truth", r.truth, formatSetting(r.truth)), T.readNoise, ro("noise", L.noise, fmtNoise(L.noise)),
          T.readSes, ro("noise-se", L.z, fmtZ(L.z)), T.readEnd,
        ]);
      }

      function drawCaption(r) {
        // the draws are a Monte Carlo result: the caption's slots are its number of draws and its seed
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
        fullNote.hidden = !full;
        if (full) fullNote.replaceChildren(`${T.full} `, ctx.num(CONFIG.draws.max, formatCount(CONFIG.draws.max)), ` ${T.fullEnd}`);
        else fullNote.replaceChildren();
        // a button that has just been disabled under the keyboard hands focus to the one that still works
        const wasHere = [drawOne, drawMany, clear].some((b) => b.root === active);
        if (wasHere && active.disabled) (full ? clear : drawOne).root.focus({ preventScroll: true });
      }

      return {
        render(state) {
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
