export * from "../shared/domain/two-scores.js";

import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { tagNode } from "../shared/labels.js";
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from "../shared/criteria-provenance.js";
import {
  TWO_SCORES_KEYS,
  drawTwoScoreReport,
  reportWords,
  shareText,
  solveTwoScores,
} from "../shared/domain/two-scores.js";

const TWO_SCORES_V2_CSS = `
.tws-v2.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: 0.45rem 1rem;
  flex: 1 1 26rem;
  min-width: 0;
}
.tws-v2.prx-widget[data-prx-frame="v2"] .prx-stage .tws-stage-slope {
  grid-area: auto;
  min-width: 0;
  max-width: 100%;
}
.tws-v2 .prx-stage .tws-stage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.9rem;
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.tws-v2 .prx-stage .tws-stage-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.tws-v2 .tws-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin: 0.15rem 0;
}
.tws-v2 .tws-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.18rem 0.55rem 0.18rem 0.28rem;
  border-radius: 5px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.tws-v2 .tws-g {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  font-size: 0.75rem;
  letter-spacing: 0;
}
.tws-v2 .prx-light-panel .tws-gt,
.tws-v2 .prx-stage .tws-gt {
  font-weight: 700;
  color: var(--prx-plot-muted);
}
.tws-v2 .tws-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  min-width: 0;
}
.tws-v2 .tws-paper + .tws-paper,
.tws-v2 .tws-detail-grid {
  margin-top: 0.65rem;
}
.tws-v2 .tws-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 0.75rem 1rem;
  align-items: start;
  min-width: 0;
}
.tws-v2 .tws-facts,
.tws-v2 .tws-note {
  font-size: 0.875rem;
  line-height: 1.45;
  margin: 0.3rem 0 0.5rem;
  color: var(--prx-fg);
}
.tws-v2 .tws-paper .tws-facts,
.tws-v2 .tws-paper .tws-note {
  color: var(--prx-plot-fg);
}
.tws-v2 .tws-paper .tws-muted {
  color: var(--prx-plot-muted);
}
.tws-v2 .tws-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.tws-v2 .tws-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: 42rem;
  font-variant-numeric: tabular-nums;
}
.tws-v2 .tws-table th,
.tws-v2 .tws-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--prx-border);
  text-align: left;
  white-space: nowrap;
}
.tws-v2 .tws-table caption {
  text-align: left;
  font-weight: 600;
  padding: 0.25rem 0 0.35rem;
}
.tws-v2 .tws-report {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--prx-border);
}
.tws-v2 .tws-report:last-child {
  border-bottom: 0;
}
.tws-v2 .tws-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.95rem;
  font-size: 0.84rem;
  margin: 0.35rem 0 0;
}
.tws-v2 .tws-dot-key {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  margin-right: 0.32rem;
  vertical-align: -0.06em;
  box-sizing: border-box;
}
.tws-v2 .tws-share-summary {
  display: inline;
}
@media (max-width: 48rem) {
  .tws-v2 .tws-detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

function numNode(ctx, value, fmt = formatCount, hook) {
  const n = ctx.num(value, fmt(value));
  if (hook) n.dataset.prxReadout = hook;
  return n;
}

function drawSlopeFigure(ctx, slot, model, state) {
  const { data, result } = model;
  const grade = result.grade;
  const pal = palette(ctx.root);
  const colors = gradeColors(Math.max(...grade), pal);
  const measured = Math.round(slot.getBoundingClientRect?.().width || slot.clientWidth || ctx.stage.clientWidth || 0);
  const width = Math.max(240, measured > 0 ? measured : ctx.width());
  const height = width < 480 ? 304 : 374;
  const marginTop = 48;
  const marginBottom = 18;
  const marginSide = width < 480 ? 64 : 76;
  const yLo = -0.95;
  const yHi = 1.35;
  const innerH = height - marginTop - marginBottom;
  const toPx = (v) => marginTop + ((yHi - v) / (yHi - yLo)) * innerH;
  const fromPx = (py) => yHi - ((py - marginTop) / innerH) * (yHi - yLo);

  const rows = data.ids.map((id, i) => ({
    i,
    id,
    a: data.means[i][0],
    b: data.means[i][1],
    grade: grade[i],
    fill: colors[grade[i] - 1],
  }));

  const placedLeft = placeDirectLabels(
    rows.map((d) => ({ id: d.id, y: toPx(d.a) })),
    { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 },
  );
  const placedRight = placeDirectLabels(
    rows.map((d) => ({ id: d.id, y: toPx(d.b) })),
    { minGapPx: 20, minY: marginTop + 10, maxY: height - marginBottom - 10 },
  );
  const leftById = new Map(placedLeft.map((p) => [p.id, p]));
  const rightById = new Map(placedRight.map((p) => [p.id, p]));

  const ends = rows.flatMap((d) => [
    { ...d, x: 0, y: d.a },
    { ...d, x: 1, y: d.b },
  ]);
  const leftTags = rows.map((d) => {
    const p = leftById.get(d.id);
    return { ...d, x: 0, y: fromPx(p.y), rawY: d.a, shifted: Math.abs(p.dy) > 2.5 };
  });
  const rightTags = rows.map((d) => {
    const p = rightById.get(d.id);
    return { ...d, x: 1, y: fromPx(p.y), rawY: d.b, shifted: Math.abs(p.dy) > 2.5 };
  });
  const heads = [
    { x: 0, title: "score A", weight: state.w },
    { x: 1, title: "score B", weight: 1 - state.w },
  ];

  plot(slot, {
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft: marginSide,
    marginRight: marginSide,
    x: { domain: [0, 1], axis: null },
    y: { domain: [yLo, yHi], axis: null },
    alt: "Each site joins its posterior mean on score A to its mean on score B, colored by grade in the first best report.",
    table: {
      caption: "Posterior means and first best report",
      rows,
      columns: [
        { label: "Site", value: "id" },
        { label: "Score A mean", value: "a", format: (v) => formatDecimal(v) },
        { label: "Score B mean", value: "b", format: (v) => formatDecimal(v) },
        { label: "Grade", value: "grade", format: (v) => formatCount(v) },
      ],
    },
    marks: (c, P) => [
      P.ruleX([0, 1], { stroke: c.plotGrid, strokeWidth: 1.5 }),
      P.link(rows, { x1: () => 0, y1: "a", x2: () => 1, y2: "b", stroke: "fill", strokeWidth: 3.2, strokeOpacity: 0.92 }),
      P.dot(ends, { x: "x", y: "y", r: 6.5, fill: "fill", stroke: c.plotBg, strokeWidth: 1.5 }),
      P.link(leftTags.filter((d) => d.shifted), { x1: () => 0, y1: "rawY", x2: () => 0, y2: "y", stroke: c.plotMuted, strokeWidth: 1, dx: -7 }),
      P.link(rightTags.filter((d) => d.shifted), { x1: () => 1, y1: "rawY", x2: () => 1, y2: "y", stroke: c.plotMuted, strokeWidth: 1, dx: 7 }),
      P.text(leftTags, { x: "x", y: "y", text: "id", dx: -12, textAnchor: "end", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
      P.text(rightTags, { x: "x", y: "y", text: "id", dx: 12, textAnchor: "start", fill: c.plotFg, fontWeight: 700, fontSize: 14 }),
      numText(leftTags, { x: "x", y: "y", value: "grade", format: formatCount, dx: -33, textAnchor: "end", fill: c.plotMuted, fontWeight: 600, fontSize: 13 }),
      numText(rightTags, { x: "x", y: "y", value: "grade", format: formatCount, dx: 33, textAnchor: "start", fill: c.plotMuted, fontWeight: 600, fontSize: 13 }),
      P.text(heads, { x: "x", y: () => yHi, text: "title", dy: -30, fontWeight: 700, fontSize: 14, fill: (d) => c.critInk[d.x] }),
      P.text(heads, { x: "x", y: () => yHi, text: () => "weight", dx: -3, dy: -12, textAnchor: "end", fontSize: 13, fill: c.plotMuted }),
      numText(heads, { x: "x", y: () => yHi, value: "weight", format: (v) => formatSetting(v), dx: 3, dy: -12, textAnchor: "start", fontSize: 13, fill: c.plotMuted }),
    ],
    keyboard: {
      data: rows,
      x: () => 0,
      y: "a",
      pointer: true,
      title: (d) =>
        `Site ${d.id}: posterior mean ${formatDecimal(d.a)} on score A and ${formatDecimal(d.b)} on score B; grade ${formatCount(d.grade)} of the best report.`,
    },
  });
}

function drawRelations(ctx, relationSlot, model) {
  const { h } = ctx;
  const { data } = model;
  const pal = palette(ctx.root);

  relationSlot.replaceChildren();
  const cells = [];
  for (let i = 0; i < data.n; i += 1) {
    for (let j = 0; j < data.n; j += 1) {
      cells.push({
        i,
        j,
        row: data.ids[i],
        column: data.ids[j],
        relation: model.matrix[i][j],
        text: i === j ? "—" : model.matrix[i][j] === 1 ? "above" : model.matrix[i][j] === -1 ? "below" : "withheld",
      });
    }
  }
  const cellFill = (d, c) => (d.i === d.j ? c.plotBg : d.relation === 1 ? c.relAbove : d.relation === -1 ? c.relBelow : c.relWithheld);
  plot(relationSlot, {
    alt: "Row site is above, below, or in the same grade as the column site. Diagonal is not a comparison.",
    height: 300,
    marginLeft: 40,
    marginRight: 14,
    marginTop: 18,
    marginBottom: 40,
    x: { domain: data.ids, label: "Column site", labelAnchor: "center" },
    y: { domain: data.ids, label: "Row site", labelAnchor: "center" },
    color: { type: "identity" },
    table: {
      caption: "First best report pair relations",
      rows: cells,
      columns: [
        { label: "Row", value: "row" },
        { label: "Column", value: "column" },
        { label: "Relation", value: "text" },
      ],
    },
    marks: (c, P) => [
      P.cell(cells, { x: "column", y: "row", fill: (d) => cellFill(d, c), inset: 1 }),
      P.text(cells, {
        x: "column",
        y: "row",
        text: (d) => (d.i === d.j ? "—" : d.relation === 1 ? "↑" : d.relation === -1 ? "↓" : "·"),
        fill: (d) => (d.i === d.j ? c.plotFg : labelOn(cellFill(d, c), c)),
        fontWeight: 700,
      }),
    ],
    keyboard: {
      data: cells,
      columns: data.n,
      x: "column",
      y: "row",
      pointer: true,
      title: (d) => `${d.row} against ${d.column}: ${d.text}`,
    },
  });
  const legend = h("p", { class: "tws-legend prx-light-panel", "data-prx-part": "legend" });
  [
    ["relAbove", "Row above column"],
    ["relWithheld", "Withheld"],
    ["relBelow", "Row below column"],
  ].forEach(([key, text]) => legend.append(h("span", {}, h("i", { class: "prx-swatch", style: { background: pal[key] } }), text)));
  relationSlot.append(legend);

}

function drawPairAudit(ctx, pairsSlot, model, state) {
  const { h } = ctx;
  const { data } = model;
  const pal = palette(ctx.root);
  pairsSlot.replaceChildren();
  const directions = model.pairs.flatMap((d) => [
    { ...d, direction: `${data.ids[d.i]} above ${data.ids[d.j]}`, error: d.forward, side: "forward" },
    { ...d, direction: `${data.ids[d.j]} above ${data.ids[d.i]}`, error: d.reverse, side: "reverse" },
  ]);
  plot(pairsSlot, {
    alt: "Both directional weighted errors for each pair. The dashed vertical line is the withholding cost. Rings mark cheaper isolated directions withheld in the first report.",
    height: 440,
    marginLeft: 54,
    marginRight: 20,
    marginTop: 18,
    marginBottom: 42,
    x: { domain: [0, 1], inset: 8, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: "Weighted directional error", labelAnchor: "center", labelArrow: "none" },
    y: { domain: model.pairs.map((d) => d.label), label: null },
    table: {
      caption: "Both weighted pair errors",
      rows: directions,
      columns: [
        { label: "Direction", value: "direction" },
        { label: "Weighted error", value: "error", format: (v) => formatProb(v) },
        { label: "Withheld although cheaper", value: (d) => (d.outlined && d.error < state.tau ? "yes" : "no") },
      ],
    },
    marks: (c, P) => [
      P.ruleX([state.tau], { stroke: c.wh, strokeDasharray: "5,3", strokeWidth: 1.5 }),
      P.link(model.pairs, { x1: "forward", x2: "reverse", y1: "label", y2: "label", stroke: c.plotGrid, strokeWidth: 1.4 }),
      P.dot(directions, {
        x: "error",
        y: "label",
        fill: (d) => (d.side === "forward" ? c.purples[6] : c.plotBg),
        stroke: c.purples[6],
        strokeWidth: 1.8,
        r: 4.5,
      }),
      P.dot(
        directions.filter((d) => d.outlined && d.error < state.tau),
        { x: "error", y: "label", fill: "none", stroke: c.err, r: 8, strokeWidth: 2 },
      ),
    ],
    keyboard: {
      data: directions,
      x: "error",
      y: "label",
      pointer: true,
      title: (d) =>
        `${d.direction}: weighted error ${formatProb(d.error)}; cost of withholding ${formatSetting(state.tau)}; ${d.relation === 0 ? "withheld" : "stated"}${d.outlined && d.error < state.tau ? ", cheaper isolated direction outlined" : ""}`,
    },
  });
  pairsSlot.append(
    h(
      "p",
      { class: "tws-legend prx-light-panel", "data-prx-part": "legend" },
      h("span", {}, h("i", { class: "tws-dot-key", style: { background: pal.purples[6], border: `2px solid ${pal.purples[6]}` } }), "Earlier letter above later"),
      h("span", {}, h("i", { class: "tws-dot-key", style: { background: pal.plotBg, border: `2px solid ${pal.purples[6]}` } }), "Reverse direction"),
      h("span", {}, h("i", { class: "tws-dot-key", style: { background: "transparent", border: `2px solid ${pal.err}` } }), "Withheld below τ"),
    ),
    h(
      "p",
      { class: "tws-note tws-muted" },
      "Rings mark withheld directions cheaper than τ; the isolated-pair rule need not form a coherent report.",
    ),
  );
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "two-scores",
    className: "tws tws-v2",
    frame: "v2",
    css: TWO_SCORES_V2_CSS,
    keys: TWO_SCORES_KEYS,
    build(ctx) {
      const { h } = ctx;
      const wSlider = ctx.slider({
        label: "Weight w on score A (score B gets 1 − w)",
        ...ctx.key("w"),
        onInput: (w) => ctx.set({ w }),
      });
      const tauSlider = ctx.slider({
        label: "Cost τ per withheld pair",
        ...ctx.key("tau"),
        onInput: (tau) => ctx.set({ tau }),
      });
      ctx.primaryControl(wSlider.root);
      ctx.controls.append(wSlider.root, tauSlider.root);

      const capSeg = ctx.segmented({
        label: "Allowed grades",
        name: "cap",
        options: [
          { value: "2", label: "At most two" },
          { value: "3", label: "At most three" },
          { value: "all", label: "No cap" },
        ],
        value: ctx.state.cap,
        onChange: (cap) => ctx.set({ cap }),
      });
      ctx.settingsBox("Settings").body.append(capSeg.root);

      // Primary stage: two-score slope comparison + compact visual grade report bar
      const slopeSlot = h("div", { class: "tws-stage-slope" });
      const stageChips = h("div", { class: "tws-chips", "aria-hidden": "true" });
      const stageBar = h(
        "div",
        { class: "tws-stage-bar" },
        stageChips,
        h("p", { class: "tws-stage-hint", text: "Grade 1 is highest priority; shared grades withhold comparisons." }),
      );
      const slopePanel = h("div", {}, slopeSlot, stageBar);
      const witness = h("p", { class: "tws-note", "aria-label": "Weighted errors for a pair" });

      // Data and exact values disclosure: retained best reports, criterion profile table, relation matrix, pair errors
      const reportBody = h("div");
      const profileBody = h("div");
      const relationBody = h("div");
      const pairsBody = h("div");
      const dataBox = ctx.dataBox("Data and exact values");
      dataBox.body.append(
        h("section", { class: "tws-paper prx-light-panel", "aria-label": "Best report for both scores" }, ctx.panelTitle("Best report for both scores"), reportBody),
        h("section", { class: "tws-paper prx-light-panel", "aria-label": "Every best report: criterion profile" }, ctx.panelTitle("Every best report: criterion profile"), profileBody),
        h("section", { class: "tws-paper prx-light-panel", "aria-label": "Weighted pair errors against the withholding cost" }, ctx.panelTitle("Weighted pair errors against the withholding cost"), pairsBody),
      );
      ctx.stage.append(h("div", { class: "tws-detail-grid", "aria-label": "Pair evidence for the common grades" },
        slopePanel, h("section", { class: "tws-paper prx-light-panel", "aria-label": "Relations in the first best report" },
          ctx.panelTitle("Relations in the first best report"), relationBody, witness)));

      // Method and mean bound disclosure
      const boundBody = h("div");
      const methodBox = ctx.methodBox("Method and details");
      methodBox.body.append(
        h("section", { class: "tws-paper prx-light-panel", "aria-label": "What the mean bound says" }, ctx.panelTitle("What the mean bound says"), boundBody),
      );

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open) drawPairAudit(ctx, pairsBody, solveTwoScores(state), state);
            return;
          }

          wSlider.set(state.w);
          tauSlider.set(state.tau);
          capSeg.set(state.cap);

          const model = solveTwoScores(state);
          const { data, result, profiles } = model;
          const grade = result.grade;

          // 1. Primary slope chart + stage grade chips
          drawSlopeFigure(ctx, slopeSlot, model, state);
          drawTwoScoreReport(ctx, stageChips, grade, data.ids);
          stageChips.removeAttribute("role");
          stageChips.removeAttribute("aria-label");

          // 2. Concise 3-sig-fig live readout (preserving live-grade-i and live-share-i-k hooks + w0 tie phrase)
          if (profiles.length === 1) {
            const p = profiles[0];
            ctx.readout.set([
              "Best common report ",
              reportWords(p.grade, data.ids),
              h("span", { class: "prx-sr-only", "aria-hidden": "true" }, " ", numNode(ctx, p.grade, formatGrades, "live-grade-0")),
              ": ",
              numNode(ctx, p.evaluation.N),
              " of ",
              numNode(ctx, data.M),
              " pairs stated, weighted risk ",
              numNode(ctx, p.evaluation.risk, formatReadoutRisk),
              "; expected wrong share ",
              numNode(ctx, p.evaluation.EoverN[0], shareText, "live-share-0-0"),
              " on score A and ",
              numNode(ctx, p.evaluation.EoverN[1], shareText, "live-share-0-1"),
              " on score B.",
            ]);
          } else {
            ctx.readout.set(
              profiles.map((p, i) =>
                h(
                  "span",
                  { class: "tws-share-summary" },
                  i ? " Other " : "Best common report ",
                  reportWords(p.grade, data.ids),
                  h("span", { class: "prx-sr-only", "aria-hidden": "true" }, " ", numNode(ctx, p.grade, formatGrades, `live-grade-${i}`)),
                  ...(i
                    ? [
                        ": ",
                        numNode(ctx, p.evaluation.EoverN[0], shareText, `live-share-${i}-0`),
                        " (A), ",
                        numNode(ctx, p.evaluation.EoverN[1], shareText, `live-share-${i}-1`),
                        " (B).",
                      ]
                    : [
                        ", tied with another report: ",
                        numNode(ctx, p.evaluation.N),
                        " of ",
                        numNode(ctx, data.M),
                        " pairs, risk ",
                        numNode(ctx, p.evaluation.risk, formatReadoutRisk),
                        "; shares ",
                        numNode(ctx, p.evaluation.EoverN[0], shareText, "live-share-0-0"),
                        " (A), ",
                        numNode(ctx, p.evaluation.EoverN[1], shareText, "live-share-0-1"),
                        " (B).",
                      ]),
                ),
              ),
            );
          }

          // 3. Data disclosure: retained best reports + criterion profile table + relation matrix + pair errors
          const packageIndex = sixSitePackageRepresentativeIndex(
            state,
            profiles.map((p) => p.grade),
          );
          const reportNodes = [];
          profiles.forEach((p, i) => {
            const chips = h("div", { class: "tws-chips" });
            drawTwoScoreReport(ctx, chips, p.grade, data.ids);
            reportNodes.push(
              h(
                "div",
                { class: "tws-report" },
                h("p", { class: "tws-facts" }, i ? "Another best report" : "Grade one is highest priority; a shared grade withholds its comparisons."),
                chips,
                h(
                  "p",
                  { class: "tws-facts" },
                  numNode(ctx, p.evaluation.N, formatCount, `N-${i}`),
                  " of ",
                  numNode(ctx, data.M),
                  " pairs stated; risk ",
                  numNode(ctx, p.evaluation.risk, formatRisk, `risk-${i}`),
                ),
                h("p", { class: "tws-facts" }, "Grade vector ", numNode(ctx, p.grade, formatGrades, `grade-${i}`)),
                i === packageIndex
                  ? h(
                      "p",
                      { class: "tws-note", "data-prx-package-representative": "" },
                      "The recorded postrank ",
                      ...SIX_SITE_PACKAGE_VERSION.flatMap((v, j) => [j ? "." : "", numNode(ctx, v)]),
                      " representative at this score-B-only setting is ",
                      numNode(ctx, p.grade, formatGrades, "package-grade"),
                      ". Its live expected wrong share on score A is ",
                      numNode(ctx, p.evaluation.EoverN[0], shareText, "package-share-A"),
                      ". All tied reports remain available.",
                    )
                  : null,
              ),
            );
          });
          const tie = h(
            "p",
            { class: "tws-note", "data-prx-ties": "" },
            result.tieCount > 1
              ? [
                  numNode(ctx, result.tieCount),
                  " reports share the smallest risk, tied with another report; equal-risk tolerance ",
                  numNode(ctx, result.tieTol, formatSci),
                  ". All retained reports appear below.",
                ]
              : ["One report has the smallest risk; equal-risk tolerance ", numNode(ctx, result.tieTol, formatSci), "."],
          );
          if (result.tieCount > profiles.length) {
            tie.append(" Retained ", numNode(ctx, profiles.length), " of ", numNode(ctx, result.tieCount), " reports.");
          }
          reportBody.replaceChildren(h("p", { class: "tws-facts" }, tagNode(ctx, result)), tie, ...reportNodes);

          const profileRows = profiles.flatMap((p, i) =>
            data.criterionLabels.map((criterion, k) => ({ i, grade: p.grade, criterion, k, ...p.evaluation })),
          );
          const profileTable = h(
            "table",
            { class: "tws-table" },
            h("caption", {}, "E = expected wrong directions; N = stated pairs; M = all unordered pairs."),
            h("thead", {}, h("tr", {}, ...["Report", "Criterion", "E", "E/N", "E/M", "Criterion risk", "N", "M"].map((t) => h("th", { scope: "col", text: t })))),
            h(
              "tbody",
              {},
              ...profileRows.map((p) =>
                h(
                  "tr",
                  {},
                  h("td", {}, numNode(ctx, p.grade, formatGrades)),
                  h("th", { scope: "row", text: p.criterion }),
                  h("td", {}, numNode(ctx, p.E[p.k], formatExpectedCount, `E-${p.i}-${p.k}`)),
                  h("td", {}, numNode(ctx, p.EoverN[p.k], shareText, `share-${p.i}-${p.k}`)),
                  h("td", {}, numNode(ctx, p.EoverM[p.k], formatShare, `perpair-${p.i}-${p.k}`)),
                  h("td", {}, numNode(ctx, p.Rk[p.k], formatRisk, `Rk-${p.i}-${p.k}`)),
                  h("td", {}, numNode(ctx, p.N)),
                  h("td", {}, numNode(ctx, p.M)),
                ),
              ),
            ),
          );
          profileBody.replaceChildren(
            h("p", { class: "tws-note tws-muted" }, "Swipe or use the keyboard to scroll the profile table."),
            ctx.scrollRegion(h("div", { class: "tws-scroll" }, profileTable), "Criterion profiles for every retained best report"),
          );

          drawRelations(ctx, relationBody, model);
          drawPairAudit(ctx, pairsBody, model, state);
          const pair = model.pairs.find(p => p.outlined) ?? model.pairs[0];
          const a = data.ids[pair.i], b = data.ids[pair.j];
          witness.replaceChildren("Weighted error: ", a, " above ", b, " ", numNode(ctx, pair.forward, formatProb),
            ", reverse ", numNode(ctx, pair.reverse, formatProb), "; withholding costs ", numNode(ctx, state.tau, formatSetting),
            ". The report ", pair.relation === 0 ? "withholds this pair." : "states " + (pair.relation > 0 ? a + " above " + b : b + " above " + a) + ".");

          // 4. Method disclosure: conditional mean bound & uncapped comparison
          const boundRows = profiles.map((p, i) =>
            h(
              "p",
              { class: "tws-facts" },
              "Report ",
              numNode(ctx, p.grade, formatGrades),
              ": weighted expected wrong count ",
              numNode(ctx, p.evaluation.Ew, formatExpectedCount, `Ew-${i}`),
              model.conditionalBound ? " ≤ τ × N = " : " versus τ × N = ",
              numNode(ctx, state.tau, formatSetting),
              " × ",
              numNode(ctx, p.evaluation.N),
              " = ",
              numNode(ctx, model.bounds[i].budget.qN, formatExpectedCount, `tauN-${i}`),
              "; count slack ",
              numNode(ctx, model.bounds[i].budget.slack, formatExpectedCount, `bound-slack-${i}`),
              "; risk minus τ ",
              numNode(ctx, model.bounds[i].comparison.deltaRisk, formatRisk, `bound-residual-${i}`),
              ".",
            ),
          );
          const same = model.uncapped.grades.some((g) => g.every((v, idx) => v === grade[idx]));
          boundBody.replaceChildren(
            h("p", { class: "tws-note" }, "The weighted expected wrong count is w × E on score A plus the remaining weight × E on score B."),
            ...boundRows,
            h(
              "p",
              { class: "tws-note tws-muted" },
              "This mean bound applies to the exact best report at the displayed τ because its family contains all-withheld. It bounds an expected average over stated pairs, not each pair or the realized share.",
            ),
            h(
              "p",
              { class: "tws-note" },
              same ? "Removing the cap leaves this report among the best reports." : "Removing the cap selects a different report; the cap can matter at this setting.",
            ),
          );
          if (state.w === 0.5 && state.tau === 0.2 && same) {
            boundBody.append(
              h(
                "p",
                { class: "tws-note tws-muted" },
                "A–C and B–C stay in one grade, so transitivity also withholds A–B. A–D is withheld too, although its weighted error is below τ. The uncapped comparison shows that the cap does not explain this equal-weight report.",
              ),
            );
          }

          // 5. Caption (retains visible family size e.g. 4,683 on nocap preset)
          ctx.caption.replaceChildren(
            "Six fictional sites; independent Normal posteriors set by hand for teaching; postrank does not fit them. τ = ",
            numNode(ctx, state.tau, formatSetting),
            "; ",
            tagNode(ctx, result),
            ". Withholding is charged once per pair.",
          );
        },
      };
    },
  });
}
