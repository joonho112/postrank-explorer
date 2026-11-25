// App 3.1: Fixed quantile tiers on the simulated league.
// Preserves 100% of ../shared/domain/fixed-tiers.js re-exports for dependent apps (3.2, 3.12, 3.13) per S1-02.
export * from "../shared/domain/fixed-tiers.js";

import { createWidget, uid } from "../shared/base.js";
import { gradeColors, hiddenTable, labelOn, numText, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatSetting,
  formatShare,
  formatSizes,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { LEAGUE_SEED, evaluateReport, pairCount, relations, statedAbove } from "../pr-core.js";
import { CONFIG, CSS as DOMAIN_CSS, LEAGUE_MODEL, createTierDisclosure, tiersOf } from "../shared/domain/fixed-tiers.js";

const SVGNS = "http://www.w3.org/2000/svg";
const IDS = Array.from(LEAGUE_MODEL.ids);
const N_UNITS = IDS.length;
const EST = Array.from(LEAGUE_MODEL.estimate);
const SE = Array.from(LEAGUE_MODEL.se);
const POST_MEAN = Array.from(LEAGUE_MODEL.post.mean);
const POST_SD = Array.from(LEAGUE_MODEL.post.sd);
const ERRORS = LEAGUE_MODEL.E;
const E0 = ERRORS.e[0];
const ORDER = Array.from(LEAGUE_MODEL.order);
const ALL_WITHHELD = Object.freeze(IDS.map(() => 1));

const APP_CSS = `${DOMAIN_CSS}
/* PR-01: reset any legacy container/grid-area assumptions inside frame v2 stage */
.prx-ft[data-prx-frame="v2"] .prx-stage {
  grid-area: unset;
}
.prx-ft[data-prx-frame="v2"] .prx-ft-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem 1.25rem;
  align-items: start;
  min-width: 0;
}
@media (min-width: 52rem) {
  .prx-ft[data-prx-frame="v2"] .prx-ft-stage-grid {
    grid-template-columns: minmax(0, 1.48fr) minmax(15.5rem, 1fr);
  }
}
.prx-ft[data-prx-frame="v2"] .prx-stage .prx-ft-league,
.prx-ft[data-prx-frame="v2"] .prx-stage .prx-ft-map {
  padding: 0;
  min-width: 0;
}
.prx-ft[data-prx-frame="v2"] .prx-stage .prx-ft-heading {
  margin: 0 0 0.3rem;
  color: var(--prx-plot-fg);
}
.prx-ft[data-prx-frame="v2"] .prx-stage .prx-ft-legend {
  margin: 0.35rem 0 0;
  font-size: var(--prx-text-sm, 0.84375rem);
  color: var(--prx-plot-fg);
  gap: 0.25rem 0.75rem;
}
.prx-ft[data-prx-frame="v2"] .prx-ft-data-summary {
  margin: 0 0 0.55rem;
  font-size: var(--prx-text-sm, 0.84375rem);
  color: var(--prx-fg);
}
.prx-ft[data-prx-frame="v2"] .prx-ft-data-stack,
.prx-ft[data-prx-frame="v2"] .prx-ft-method-stack {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
.prx-ft[data-prx-frame="v2"] .prx-ft-table-scroll {
  max-height: 22rem;
  overflow: auto;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.prx-ft[data-prx-frame="v2"] .prx-ft-table-scroll table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--prx-text-sm, 0.84375rem);
  font-variant-numeric: tabular-nums;
}
.prx-ft[data-prx-frame="v2"] .prx-ft-table-scroll caption {
  padding: 0.35rem 0.5rem;
  font-weight: 600;
  text-align: left;
  color: var(--prx-fg);
}
`;

const fill = (parts, slots) => parts.map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  if (!m) return p;
  const v = slots[m[1]];
  return typeof v === "function" ? v() : v;
});

function pickSpacedBands(bands, yPxOf, minGapPx = 18.5) {
  if (bands.length <= 1) return bands.slice();
  const out = [bands[0]];
  for (let i = 1; i < bands.length; i += 1) {
    if (yPxOf(bands[i].mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) {
      out.push(bands[i]);
    }
  }
  const last = bands[bands.length - 1];
  if (out[out.length - 1] !== last) {
    if (out.length > 1 && yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) < minGapPx) {
      out[out.length - 1] = last;
    } else if (yPxOf(last.mid) - yPxOf(out[out.length - 1].mid) >= minGapPx) {
      out.push(last);
    }
  }
  return out;
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: APP_CSS,
    frame: "v2",
    keys: {
      G: { type: "integer", min: CONFIG.G.min, max: CONFIG.G.max, step: CONFIG.G.step, value: CONFIG.G.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      outline: { type: "boolean", value: CONFIG.outline.value },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const T = CONFIG.text;
      const hatchId = uid("prx-ft-hatch");
      const cache = new Map();
      const tiers = (G) => {
        if (!cache.has(G)) cache.set(G, tiersOf(G));
        return cache.get(G);
      };

      const count = (v) => ctx.num(v, formatCount(v));
      const setting = (v) => ctx.num(v, formatSetting(v));

      // --- Primary controls (G and tau in toolbar; outline switch in Settings)
      const sliderG = ctx.slider({
        label: T.sliderG,
        min: CONFIG.G.min,
        max: CONFIG.G.max,
        step: CONFIG.G.step,
        value: ctx.state.G,
        name: "G",
        format: (v) => formatCount(v),
        onInput: (v) => ctx.set({ G: v }),
      });
      const sliderTau = ctx.slider({
        label: T.sliderTau,
        min: CONFIG.tau.min,
        max: CONFIG.tau.max,
        step: CONFIG.tau.step,
        value: ctx.state.tau,
        name: "tau",
        onInput: (v) => ctx.set({ tau: v }),
      });
      const outline = ctx.toggle({
        label: T.outline,
        checked: ctx.state.outline,
        name: "outline",
        onChange: (b) => ctx.set({ outline: b }),
      });
      ctx.controls.append(ctx.primaryControl(sliderG.root), sliderTau.root);
      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(outline.root);

      // --- Primary stage: league tier-cut chart (primary visual weight) + linked pair-relation map
      const leagueSlot = ctx.primaryGraphic(h("div", { class: "prx-ft-league-chart" }));
      const leagueBox = h(
        "section",
        { class: "prx-ft-box prx-ft-league", "aria-label": T.leagueHeading },
        ctx.panelTitle(T.leagueHeading, { className: "prx-ft-heading" }),
        leagueSlot,
      );

      const mapSlot = h("div", { class: "prx-ft-map-chart" });
      const mapLegend = h("div", { class: "prx-ft-legend", "data-prx-part": "legend" });
      const mapBox = h(
        "section",
        { class: "prx-ft-box prx-ft-map", "aria-label": T.mapHeading },
        ctx.panelTitle(T.mapHeading, { className: "prx-ft-heading" }),
        mapSlot,
        mapLegend,
      );

      ctx.stage.append(h("div", { class: "prx-ft-stage-grid" }, leagueBox, mapBox));

      // --- Disclosures: Data (exact unit/pair tables) & Method (formulas + baseline comparison)
      const dataBox = ctx.dataBox("Data and exact values");
      const dataSummary = h("p", { class: "prx-ft-data-summary" });
      const unitTableSlot = h("div", { class: "prx-ft-table-scroll" });
      const pairTableSlot = h("div", { class: "prx-ft-table-scroll" });
      dataBox.body.append(
        h("div", { class: "prx-ft-data-stack" }, dataSummary, unitTableSlot, pairTableSlot),
      );

      const methodBox = ctx.methodBox("Method and formulas");
      const disclosureView = createTierDisclosure(ctx);
      const enLine = h("p", { class: "prx-ft-line" });
      const overLine = h("p", { class: "prx-ft-line" });
      const captionLine = h("p", { class: "prx-ft-note" });
      const gHintNodes = T.sliderGHint.split(/\b(1)\b/).map((part) => (part === "1" ? count(1) : part));
      const gHintLine = h("p", { class: "prx-ft-note", "data-prx-part": "notes" }, ...gHintNodes);
      const tauHintLine = h("p", { class: "prx-ft-note", "data-prx-part": "notes", text: T.sliderTauHint });
      const leagueNote = h("p", { class: "prx-ft-note", "data-prx-part": "notes" });
      leagueNote.replaceChildren(...fill(T.leagueNote, { one: () => count(1), se: () => setting(CONFIG.seWidth) }));
      const errorsBox = h(
        "section",
        { class: "prx-ft-box prx-ft-errors", "aria-label": T.errorsHeading },
        ctx.panelTitle(T.errorsHeading, { className: "prx-ft-heading" }),
        enLine,
        overLine,
        captionLine,
        leagueNote,
        gHintLine,
        tauHintLine,
      );
      methodBox.body.append(h("div", { class: "prx-ft-method-stack" }, disclosureView.root, errorsBox));

      // --- Concise 1-line caption (retaining teaching-posterior captionNode per fixed-tiers.json, WB-05)
      ctx.caption.replaceChildren(
        "Simulated league of ",
        count(N_UNITS),
        " units (seed ",
        ctx.num(LEAGUE_SEED, String(LEAGUE_SEED)),
        "); tiers: ",
        captionNode(ctx, "fixed-tiers"),
        ". Posterior: ",
        captionNode(ctx, "teaching-posterior"),
        " (normal prior, mean ",
        setting(CONFIG.prior.mean),
        ", SD ",
        setting(CONFIG.prior.sd),
        ").",
      );

      function drawLeagueChart(t) {
        const C = CONFIG.league;
        const rows = ORDER.map((i, p) => ({
          i,
          id: IDS[i],
          pos: p,
          est: EST[i],
          se: SE[i],
          tier: t.grade[i],
          lo: EST[i] - CONFIG.seWidth * SE[i],
          hi: EST[i] + CONFIG.seWidth * SE[i],
        }));
        let first = 0;
        const bands = t.disc.sizes.map((size, k) => {
          const b = { tier: k + 1, size, first, last: first + size - 1, mid: first + (size - 1) / 2 };
          first += size;
          return b;
        });

        const width = Math.max(240, Math.round(leagueSlot.clientWidth || ctx.width() || 560));
        const rowPx = width < 440 ? 11.5 : 12.5;
        const marginTop = 10;
        const marginBottom = 38;
        const marginLeft = 34;
        const marginRight = 14;
        const height = Math.round(marginTop + marginBottom + N_UNITS * rowPx);
        const innerW = Math.max(1, width - marginLeft - marginRight);
        const innerH = Math.max(1, height - marginTop - marginBottom);

        const [lo, hi] = C.domain;
        const perPx = (hi - lo) / innerW;
        const leftOf = (px) => lo - px * perPx;
        const stripePx = 22;
        const stripeX1 = leftOf(3);
        const stripeX2 = leftOf(3 + stripePx);
        const stripeMid = (stripeX1 + stripeX2) / 2;

        const yPxOf = (pos) => marginTop + ((pos + C.half) / N_UNITS) * innerH;
        const posOf = (yPx) => ((yPx - marginTop) / innerH) * N_UNITS - C.half;
        const halfPillUnits = (8.5 / innerH) * N_UNITS;

        // PR-03 & WA-02: 17px-tall rounded badge pills placed via placeDirectLabels and mapped by item.id
        const spaced = pickSpacedBands(bands, yPxOf, 18.5);
        const placed = placeDirectLabels(
          spaced.map((b) => ({ id: String(b.tier), y: yPxOf(b.mid), height: 17 })),
          { minGapPx: 18, minY: marginTop + 9, maxY: height - marginBottom - 9 },
        );
        const placedById = new Map(placed.map((p) => [p.id, p]));
        const labeledBands = spaced.map((b) => ({
          ...b,
          labelPos: posOf(placedById.get(String(b.tier))?.y ?? yPxOf(b.mid)),
        }));

        const tint = (tier) => C.tints[(tier - 1) % C.tints.length];
        const tipText = (d) =>
          `${d.id}: position ${formatCount(d.pos + 1)} of ${formatCount(N_UNITS)} by estimate, tier ${formatCount(d.tier)} of ${formatCount(t.G)}; estimate ${formatDecimal(d.est, { digits: 3 })}, SE ${formatSetting(d.se)}`;

        plot(leagueSlot, {
          alt: T.leagueAlt,
          table: {
            caption: T.leagueTable,
            columns: [
              { label: "Position", value: (d) => d.pos + 1, format: (v) => formatCount(v), header: false },
              { label: "Unit", value: "id" },
              { label: "Estimate", value: "est", format: (v) => formatDecimal(v, { digits: 3 }) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              { label: "Tier", value: "tier", format: (v) => formatCount(v) },
            ],
            rows,
          },
          width,
          height,
          marginTop,
          marginBottom,
          marginLeft,
          marginRight,
          x: {
            domain: [lo, hi],
            ticks: Array.from(C.ticks),
            label: T.leagueAxis,
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { domain: [N_UNITS - C.half, -C.half], axis: null },
          color: { type: "identity" },
          marks: (c, P) => {
            const fills = gradeColors(t.G, c);
            return [
              P.rect(bands, {
                x1: () => lo,
                x2: () => hi,
                y1: (d) => d.first - C.half,
                y2: (d) => d.last + C.half,
                fill: (d) => fills[d.tier - 1],
                fillOpacity: (d) => tint(d.tier),
              }),
              P.ruleY(bands.slice(1), {
                y: (d) => d.first - C.half,
                x1: () => stripeX2,
                x2: () => hi,
                stroke: c.plotAxis,
                strokeDasharray: C.dash,
              }),
              P.rect(bands, {
                x1: () => stripeX1,
                x2: () => stripeX2,
                y1: (d) => d.first - C.half,
                y2: (d) => d.last + C.half,
                fill: (d) => fills[d.tier - 1],
                inset: 0.5,
              }),
              P.ruleX([0], { stroke: c.plotGrid }),
              P.ruleY(rows, { y: "pos", x1: "lo", x2: "hi", stroke: c.plotMuted, strokeWidth: 1.35 }),
              P.ruleX(rows, {
                x: "est",
                y1: (d) => d.pos - C.tickHalf,
                y2: (d) => d.pos + C.tickHalf,
                stroke: c.est,
                strokeWidth: 2.35,
              }),
              P.rect(labeledBands, {
                x1: () => stripeX1,
                x2: () => stripeX2,
                y1: (b) => b.labelPos - halfPillUnits,
                y2: (b) => b.labelPos + halfPillUnits,
                fill: (b) => fills[b.tier - 1],
                stroke: c.plotBg,
                strokeWidth: 1,
                rx: 3,
              }),
              numText(labeledBands, {
                x: () => stripeMid,
                y: "labelPos",
                value: "tier",
                format: (v) => formatCount(v),
                fill: (b) => labelOn(fills[b.tier - 1], c),
                fontWeight: "bold",
                textAnchor: "middle",
              }),
              P.tip(rows, P.pointerY({ x: "est", y: "pos", title: (d) => tipText(d) })),
            ];
          },
          keyboard: {
            data: rows,
            x: "est",
            y: "pos",
            key: (d) => d.id,
            sort: false,
            label: T.leagueKeys,
            title: (d) => tipText(d),
          },
        });
      }

      function buildBaseCells(t) {
        const relation = relations(t.grade);
        const cells = [];
        for (let p = 0; p < N_UNITS; p += 1) {
          for (let r = p + 1; r < N_UNITS; r += 1) {
            const i = ORDER[p];
            const j = ORDER[r];
            const stated = relation[i][j] !== 0;
            cells.push({
              row: p + 1,
              col: r + 1,
              i,
              j,
              a: IDS[i],
              b: IDS[j],
              ta: t.grade[i],
              tb: t.grade[j],
              stated,
              error: stated ? E0[i][j] : null,
            });
          }
        }
        return cells;
      }

      function drawMap(state, t, baseCells, over) {
        const Mx = CONFIG.matrix;
        const cols = N_UNITS - 1;
        const marginTop = 10;
        const marginLeft = 32;
        const marginRight = 10;
        const marginBottom = 38;
        const avail = Math.max(240, Math.min(390, Math.round(mapSlot.clientWidth || ctx.width() || 340)));
        const maxCell = avail < 360 ? 9 : 11;
        const cell = Math.max(7, Math.min(maxCell, Math.floor((avail - marginLeft - marginRight) / cols)));
        const width = marginLeft + marginRight + cols * cell;
        const height = marginTop + marginBottom + cols * cell;
        mapSlot.style.maxWidth = `${width}px`;

        const cells = baseCells.map((d) => ({
          ...d,
          over: state.outline && d.stated && over.has(`${d.i},${d.j}`),
        }));

        const statement = (d) =>
          d.stated
            ? `${d.a} (tier ${formatCount(d.ta)}) stated above ${d.b} (tier ${formatCount(d.tb)}); the stated direction is wrong with probability ${formatProb(d.error)}${d.over ? ", above τ" : ""}`
            : `${d.a} and ${d.b} share tier ${formatCount(d.ta)}: the pair is withheld`;

        let tri = [];
        const mapFig = plot(mapSlot, {
          alt: T.mapAlt,
          width,
          height,
          marginTop,
          marginLeft,
          marginRight,
          marginBottom,
          x: {
            domain: Array.from({ length: cols }, (_, k) => k + 2),
            padding: 0,
            ticks: [2, 10, 20, 30],
            tickFormat: (v) => formatCount(v),
            label: "Lower unit (estimate order)",
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: {
            domain: Array.from({ length: cols }, (_, k) => k + 1),
            padding: 0,
            ticks: [1, 10, 20, 29],
            tickFormat: (v) => formatCount(v),
            label: null,
          },
          color: { type: "identity" },
          marks: (c, P) => {
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({
                id: hatchId,
                patternUnits: "userSpaceOnUse",
                width: Mx.hatchSpacing,
                height: Mx.hatchSpacing,
                patternTransform: "rotate(45)",
              })) {
                pat.setAttribute(k, String(v));
              }
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({
                x1: 0,
                y1: 0,
                x2: 0,
                y2: Mx.hatchSpacing,
                stroke: c.hatch,
                "stroke-width": Mx.hatchWidth,
              })) {
                line.setAttribute(k, String(v));
              }
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            const withheld = cells.filter((d) => !d.stated);
            tri = [];
            if (t.G <= 5) {
              let first = 0;
              t.disc.sizes.forEach((size) => {
                if (size >= 5) {
                  tri.push({
                    col: Math.min(N_UNITS, first + Math.max(3, Math.ceil(size * 0.68))),
                    row: Math.min(cols, first + Math.max(2, Math.floor(size * 0.32))),
                    pairs: pairCount(size),
                  });
                }
                first += size;
              });
            }
            return [
              P.cell(cells, { x: "col", y: "row", fill: (d) => (d.stated ? c.relAbove : c.relWithheld), inset: Mx.inset }),
              hatch,
              P.cell(withheld, {
                x: "col",
                y: "row",
                fill: `url(#${hatchId})`,
                stroke: c.cellBorder,
                strokeWidth: Mx.border,
                inset: Mx.inset,
              }),
              P.dot(
                cells.filter((d) => d.over),
                { x: "col", y: "row", r: Math.max(1.2, cell * Mx.dotShare), fill: labelOn(c.relAbove, c) },
              ),
              tri.length
                ? numText(tri, {
                    x: "col",
                    y: "row",
                    value: "pairs",
                    format: (v) => formatCount(v),
                    textAnchor: "middle",
                    fontWeight: "600",
                    fill: c.plotFg,
                  })
                : null,
              P.tip(cells, P.pointer({ x: "col", y: "row", title: (d) => statement(d) })),
            ];
          },
          keyboard: {
            data: cells,
            x: "col",
            y: "row",
            key: (d) => `${d.a}-${d.b}`,
            sort: false,
            label: T.mapKeys,
            title: (d) => `Row ${d.a}, column ${d.b}: ${statement(d)}.`,
          },
        });

        if (tri.length && mapFig?.svg) {
          const sx = mapFig.scale("x");
          const sy = mapFig.scale("y");
          const pal = mapFig.palette;
          const textGroup = mapFig.svg.querySelector('g[aria-label="text"]');
          if (textGroup && sx && sy) {
            const pillGroup = ctx.doc.createElementNS(SVGNS, "g");
            pillGroup.setAttribute("aria-hidden", "true");
            pillGroup.setAttribute("pointer-events", "none");
            const bwX = sx.bandwidth ? sx.bandwidth : cell;
            const bwY = sy.bandwidth ? sy.bandwidth : cell;
            for (const item of tri) {
              const cx = sx.apply(item.col) + bwX / 2;
              const cy = sy.apply(item.row) + bwY / 2;
              const str = formatCount(item.pairs);
              const pw = Math.max(22, Math.ceil(str.length * 7.8 + 8));
              const ph = 16;
              const rect = ctx.doc.createElementNS(SVGNS, "rect");
              rect.setAttribute("x", (cx - pw / 2).toFixed(1));
              rect.setAttribute("y", (cy - ph / 2).toFixed(1));
              rect.setAttribute("width", String(pw));
              rect.setAttribute("height", String(ph));
              rect.setAttribute("rx", "3");
              rect.setAttribute("fill", pal.plotBg);
              rect.setAttribute("fill-opacity", "0.9");
              rect.setAttribute("stroke", pal.cellBorder);
              rect.setAttribute("stroke-width", "0.7");
              pillGroup.append(rect);
            }
            mapFig.svg.insertBefore(pillGroup, textGroup);
          }
        }

        const keyChip = (swatch, content) =>
          h("span", { class: "prx-ft-key" }, h("span", { class: `prx-ft-swatch ${swatch}` }), h("span", {}, ...[].concat(content)));
        const items = [
          keyChip("prx-ft-swatch-stated", "stated (higher tier)"),
          keyChip("prx-ft-swatch-hatch", "withheld (same tier; pair count shown)"),
        ];
        if (state.outline) items.push(keyChip("prx-ft-swatch-outline", ["error > τ = ", setting(state.tau)]));
        mapLegend.replaceChildren(...items);
      }

      function drawDataTables(t, baseCells) {
        const unitRows = ORDER.map((i, p) => ({
          pos: p + 1,
          id: IDS[i],
          est: EST[i],
          se: SE[i],
          mean: POST_MEAN[i],
          sd: POST_SD[i],
          tier: t.grade[i],
        }));
        const uWrap = hiddenTable(ctx.doc, {
          visible: true,
          caption: "Units in estimate order with posterior summaries and assigned tier",
          columns: [
            { label: "Position", value: "pos", format: (v) => formatCount(v), header: false },
            { label: "Unit", value: "id" },
            { label: "Estimate", value: "est", format: (v) => formatDecimal(v, { digits: 4 }) },
            { label: "SE", value: "se", format: (v) => formatSetting(v) },
            { label: "Post. mean", value: "mean", format: (v) => formatDecimal(v, { digits: 4 }) },
            { label: "Post. SD", value: "sd", format: (v) => formatDecimal(v, { digits: 4 }) },
            { label: "Tier", value: "tier", format: (v) => formatCount(v) },
          ],
          rows: unitRows,
        });
        const pWrap = hiddenTable(ctx.doc, {
          visible: true,
          caption: T.mapTable,
          columns: [
            { label: "Higher unit", value: "a" },
            { label: "Its tier", value: "ta", format: (v) => formatCount(v) },
            { label: "Lower unit", value: "b" },
            { label: "Its tier", value: "tb", format: (v) => formatCount(v) },
            { label: "Tier report", value: (d) => (d.stated ? "stated" : "withheld") },
            {
              label: "Error of the stated direction",
              value: (d) => (d.stated ? d.error : null),
              format: (v) => (v === null ? "none (withheld)" : formatProb(v)),
            },
          ],
          rows: baseCells,
        });
        unitTableSlot.replaceChildren(uWrap);
        pairTableSlot.replaceChildren(pWrap);
      }

      function drawMethodErrors(state, ev, sa) {
        const en = ev.EoverN[0];
        const allW = evaluateReport(ALL_WITHHELD, ERRORS, { tau: state.tau });
        const ref = [" The all-withheld report has risk ", w.risk(allW.risk, { hook: "allWithheld" }), "."];
        if (en === null) enLine.replaceChildren(T.enNone, ...ref);
        else {
          // CR-026: compare on the risk scale at the shared equal-risk tolerance.
          const diff = (ev.Ew - state.tau * ev.N) / ev.M;
          enLine.replaceChildren(diff > 1e-12 ? T.enAbove : diff < -1e-12 ? T.enBelow : T.enEqual, ...ref);
        }
        if (!state.outline) overLine.replaceChildren(T.overOff);
        else if (ev.N === 0) overLine.replaceChildren(T.overNone);
        else {
          overLine.replaceChildren(
            ...fill(T.overLine, {
              over: () => w.count(sa.count, { hook: "over" }),
              N: () => count(ev.N),
              max: () => w.prob(sa.max, { hook: "maxStated" }),
            }),
          );
        }
        captionLine.replaceChildren(
          "Tier report: ",
          captionNode(ctx, "fixed-tiers"),
          ". Risks are compared with the all-withheld report at this τ only.",
        );
      }

      function drawReadoutAndDataSummary(state, t, ev, sa) {
        const d = t.disc;
        const en = ev.EoverN[0];
        const showInlineSizes = t.G <= 6;

        if (t.G === 1) {
          w.set([
            w.count(1),
            " tier (",
            w.num(d.sizes, formatSizes(d.sizes, { label: false }), { hook: "readout-sizes" }),
            ") withholds all ",
            w.count(d.M),
            " pairs (E/N ",
            w.share(en, { hook: "EoverN" }),
            "); at τ = ",
            w.setting(state.tau, { hook: "tau" }),
            ", E = ",
            w.expected(ev.Ew, { hook: "E" }),
            ", risk ",
            w.risk(ev.risk, { hook: "risk" }),
            ".",
          ]);
        } else {
          const sizeClause = showInlineSizes
            ? [" (", w.num(d.sizes, formatSizes(d.sizes, { label: false }), { hook: "readout-sizes" }), ")"]
            : [];
          const overClause = state.outline
            ? [
                "; ",
                w.count(sa.count, { hook: "readout-over" }),
                " stated above τ (max ",
                w.prob(sa.max, { hook: "readout-maxStated" }),
                ").",
              ]
            : ["."];
          w.set([
            w.count(t.G),
            " tiers",
            ...sizeClause,
            " state ",
            w.count(d.N),
            " of ",
            w.count(d.M),
            " pairs (",
            w.share(d.s),
            "). At τ = ",
            w.setting(state.tau, { hook: "tau" }),
            ": E = ",
            w.expected(ev.Ew, { hook: "E" }),
            ", E/N = ",
            w.share(en, { hook: "EoverN" }),
            ", risk ",
            w.risk(ev.risk, { hook: "risk" }),
            ...overClause,
          ]);
        }

        const dataSizesNode = showInlineSizes
          ? ctx.num(d.sizes, formatSizes(d.sizes, { label: false }))
          : w.num(d.sizes, formatSizes(d.sizes, { label: false }), { hook: "readout-sizes" });
        dataSummary.replaceChildren(
          "Exact evaluation — sizes: ",
          dataSizesNode,
          "; E = ",
          ctx.num(ev.Ew, formatExpectedCount(ev.Ew)),
          "; E/N = ",
          en === null ? w.share(null) : ctx.num(en, formatDecimal(en, { digits: 5 })),
          "; risk = ",
          ctx.num(ev.risk, formatDecimal(ev.risk, { digits: 6 })),
          " at τ = ",
          setting(state.tau),
          ".",
        );
      }

      let lastG = null;
      let cachedCells = [];

      return {
        render(state, info = {}) {
          // PR-06 / PR-09: disclosures contain no width-dependent SVGs; never re-render stage or readout on toggle.
          if (info?.reason === "disclosure") return;
          sliderG.set(state.G);
          sliderTau.set(state.tau);
          outline.set(state.outline);

          const t = tiers(state.G);
          const ev = evaluateReport(t.grade, ERRORS, { tau: state.tau });
          const sa = statedAbove(t.grade, ERRORS, { tau: state.tau });
          const over = new Set(sa.pairs.map((p) => `${p.i},${p.j}`));

          drawReadoutAndDataSummary(state, t, ev, sa);

          const gChanged = lastG !== state.G;
          const needLeagueDraw = gChanged || info.initial || info.reason === "resize" || info.reason === "theme";
          if (gChanged) {
            lastG = state.G;
            cachedCells = buildBaseCells(t);
            disclosureView.draw(t);
            drawDataTables(t, cachedCells);
          }
          if (needLeagueDraw) {
            drawLeagueChart(t);
          }
          drawMap(state, t, cachedCells, over);
          drawMethodErrors(state, ev, sa);
        },
      };
    },
  });
}
