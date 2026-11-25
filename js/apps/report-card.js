// App entry point for report-card (2.13, Frame v2); shared model/views remain in ../shared/domain/report-card.js.
export * from "../shared/domain/report-card.js";

import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatGrades,
  formatPercent,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  formatSizes,
  formatTuple,
} from "../shared/format.js";
import { captionNode, ro, tagNode } from "../shared/readout.js";
import {
  CONFIG,
  REPORT_CARD_CSS,
  cardRows,
  datasets,
  drawBetweenGrades,
  fill,
  gradeLegend,
  shownGrades,
  solve,
} from "../shared/domain/report-card.js";

const T = CONFIG.text;
const C = CONFIG.chart;

const STAGE_CSS = `
.prx-rc-app[data-prx-frame="v2"] .prx-stage {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
.prx-rc-app[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
}
.prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-card,
.prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between {
  margin: 0;
  padding: 0.55rem 0.75rem 0.7rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  min-width: 0;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-order select {
  max-width: 100%;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-reveal {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-reveal > .prx-btn {
  background: var(--prx-bg-raised);
  border: 1px solid var(--prx-border-strong);
  font-weight: 500;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-reveal > .prx-btn:first-child {
  min-width: 12.5em;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-reveal > .prx-btn:disabled {
  background: var(--prx-bg-sunken);
  color: var(--prx-fg-muted);
  border: 1px dashed var(--prx-border-strong);
  opacity: 0.75;
  cursor: not-allowed;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-data-header p,
.prx-rc-app[data-prx-frame="v2"] .prx-rc-method p {
  margin: 0 0 0.45rem;
}
.prx-rc-app[data-prx-frame="v2"] .prx-rc-data-header p:last-child,
.prx-rc-app[data-prx-frame="v2"] .prx-rc-method p:last-child {
  margin-bottom: 0;
}
@media (max-width: 32rem) {
  .prx-rc-app[data-prx-frame="v2"] {
    padding: 0.45rem 0.5rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.35rem 0.5rem;
    margin-bottom: 0.35rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.48rem;
    font-size: 0.8125rem;
  }
  .prx-rc-app[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.45rem;
    padding: 0.32rem 0.55rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage {
    gap: 0.45rem;
    padding: 0.4rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-card,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between {
    padding: 0.38rem 0.4rem 0.45rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-legend,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-note,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-means,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-shade {
    font-size: 0.8125rem;
    line-height: 1.3;
  }
  .prx-rc-app[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.45rem;
    gap: 0.35rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table {
    border-spacing: 2px;
    font-size: 0.8125rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table th,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table td {
    min-width: 2.95rem;
    padding: 0.22rem 0.24rem;
    font-size: 0.8125rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table td {
    max-width: 3.9rem;
  }
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table th:first-child,
  .prx-rc-app[data-prx-frame="v2"] .prx-stage .prx-rc-between-table td.prx-rc-corner {
    min-width: 0;
    padding-inline: 0.14rem 0.2rem;
  }
}
`;

const SHORT_BETWEEN_CAPTION = "Expected wrong share when column grade is stated above row grade (pair count below):";

const textOfParts = (parts) => parts.map((p) => (typeof p === "string" ? p : p?.textContent ?? "")).join("");

function xDomain(card) {
  const lo = Math.min(...card.lower);
  const hi = Math.max(...card.upper);
  const pad = (hi - lo) * C.pad || 1;
  return [lo - pad, hi + pad];
}

function drawStageCard(el, card, { grade, order = "grade", reveal = 0 } = {}) {
  const doc = el.ownerDocument;
  const n = card.ids.length;
  const G = Math.max(...grade);
  const shown = shownGrades(reveal, G);
  const rowsOrder = cardRows(card, grade, order);
  const digits = Number.isInteger(card.digits) ? card.digits : CONFIG.digits.value;
  const val = (v) => formatDecimal(v, { digits });
  const root = el.closest?.(".prx-widget");
  const fontScale = Number(root?.getAttribute("data-prx-font-scale")) || 1;
  const width = Math.max(1, Math.round(el.clientWidth || el.getBoundingClientRect?.().width || 0)) || undefined;
  const w = width ?? C.defaultWidth;
  const baseRowPx = n <= C.rowPx.fewRows ? (w < 380 ? 25 : 30) : n <= C.rowPx.midRows ? 18 : 16;
  const rowHeight = baseRowPx * fontScale;
  const names = card.names ?? card.ids;

  const all = rowsOrder.map((i, pos) => ({
    i,
    pos,
    id: card.ids[i],
    name: names[i],
    fullName: (card.fullNames ?? names)[i],
    grade: grade[i],
    mean: card.mean[i],
    lower: card.lower[i],
    upper: card.upper[i],
    rank: card.expectedRank ? card.expectedRank[i] : null,
  }));
  const rows = all.filter((r) => r.grade <= shown);

  const bands = [];
  for (const r of all) {
    const b = bands[r.grade - 1] ?? (bands[r.grade - 1] = { grade: r.grade, first: r.pos, last: r.pos, size: 0 });
    b.last = r.pos;
    b.size += 1;
  }
  for (const b of bands) b.mid = (b.first + b.last) / 2;

  const [lo, hi] = xDomain(card);
  const stripePx = Math.round(24 * fontScale);
  const stripeGap = 8;
  const nameGap = 8;
  const charPx = 7.8;
  const minName = 32;
  const nameW = Math.max(minName, Math.max(...names.map((s) => String(s).length)) * charPx) * fontScale;
  const marginLeft = Math.round(stripePx + stripeGap + nameW + nameGap);
  const marginRight = 16;
  const marginTop = 10;
  const marginBottom = w < 380 ? 36 : 40;
  const height = Math.round(marginTop + marginBottom + n * rowHeight);
  const innerH = Math.max(1, height - marginTop - marginBottom);

  const innerW = Math.max(1, w - marginLeft - marginRight);
  const perPx = (hi - lo) / innerW;
  const leftOf = (px) => lo - px * perPx;
  const stripeX1 = leftOf(marginLeft - 2);
  const stripeX2 = leftOf(marginLeft - 2 - stripePx);
  const stripeMid = (stripeX1 + stripeX2) / 2;

  const yPxOf = (pos) => marginTop + ((pos + 0.5) / n) * innerH;
  const posOf = (yPx) => ((yPx - marginTop) / innerH) * n - 0.5;
  const halfPillUnits = (8.5 / innerH) * n;

  // PR-03 & WA-02: 17px rounded grade-band badge pills placed with minGapPx 18 and mapped strictly by item.id
  const placed = placeDirectLabels(
    bands.map((b) => ({ id: String(b.grade), y: yPxOf(b.mid), height: 17 })),
    { minGapPx: 18, minY: marginTop + 9, maxY: height - marginBottom - 9 },
  );
  const placedById = new Map(placed.map((p) => [p.id, p]));
  const labeledBands = bands.map((b) => ({
    ...b,
    labelPos: posOf(placedById.get(String(b.grade))?.y ?? yPxOf(b.mid)),
  }));
  const hiddenBands = labeledBands.filter((b) => b.grade > shown);

  const level = formatPercent(card.level ?? CONFIG.level);
  const titleText = card.title ?? "Report card";
  const tipText = (d) => textOfParts(fill(T.tip, {
    name: d.fullName,
    g: formatCount(d.grade),
    G: formatCount(G),
    mean: val(d.mean),
    level,
    lower: val(d.lower),
    upper: val(d.upper),
    rank: d.rank === null ? "" : textOfParts(fill(T.tipRank, { rank: formatDecimal(d.rank, { digits: CONFIG.digits.rank }) })),
  }));

  const columns = [
    { label: T.colUnit, value: "name" },
    { label: T.colGrade, value: "grade", format: (x) => formatCount(x) },
    { label: T.colMean, value: "mean", format: (x) => val(x) },
    { label: T.colLower, value: "lower", format: (x) => val(x) },
    { label: T.colUpper, value: "upper", format: (x) => val(x) },
  ];
  if (card.expectedRank) {
    columns.push({ label: T.colRank, value: "rank", format: (x) => formatDecimal(x, { digits: CONFIG.digits.rank }) });
  }

  const narrow = w < C.narrowPx;
  let colors = null;
  const chart = plot(el, {
    alt: textOfParts(fill(T.cardAlt, { title: titleText, unit: card.unit ?? "unit", level })),
    table: { caption: textOfParts(fill(T.tableCaption, { title: titleText })), columns, rows },
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    x: {
      domain: [lo, hi],
      ticks: narrow ? C.narrowTicks : C.ticks,
      label: card.axis ?? "Posterior value",
      labelAnchor: narrow ? "right" : "center",
      labelArrow: "none",
      grid: true,
    },
    y: { domain: [n - C.half, -C.half], axis: null },
    color: { type: "identity" },
    marks: (k, P) => {
      colors = gradeColors(G, k);
      return [
        P.rect(bands.filter((b) => b.grade % 2 === 1), {
          x1: () => lo,
          x2: () => hi,
          y1: (b) => b.first - C.half,
          y2: (b) => b.last + C.half,
          fill: k.plotGrid,
          fillOpacity: C.bandOpacity,
        }),
        P.ruleY(bands.slice(1), {
          y: (b) => b.first - C.half,
          x1: () => stripeX1,
          x2: () => hi,
          stroke: k.plotMuted,
          strokeDasharray: C.dash,
        }),
        P.rect(bands, {
          x1: () => stripeX1,
          x2: () => stripeX2,
          y1: (b) => b.first - C.half,
          y2: (b) => b.last + C.half,
          fill: (b) => colors[b.grade - 1],
          inset: 0.5,
        }),
        P.rect(labeledBands, {
          x1: () => stripeX1,
          x2: () => stripeX2,
          y1: (b) => b.labelPos - halfPillUnits,
          y2: (b) => b.labelPos + halfPillUnits,
          fill: (b) => colors[b.grade - 1],
          stroke: k.plotBg,
          strokeWidth: 1,
          rx: 3,
        }),
        numText(labeledBands, {
          x: () => stripeMid,
          y: "labelPos",
          value: "grade",
          format: (x) => formatCount(x),
          fill: (b) => labelOn(colors[b.grade - 1], k),
          fontWeight: "bold",
          textAnchor: "middle",
        }),
        P.text(rows, {
          x: () => lo,
          y: "pos",
          text: "name",
          dx: -nameGap,
          textAnchor: "end",
          fill: k.plotFg,
        }),
        P.ruleY(rows, {
          y: "pos",
          x1: "lower",
          x2: "upper",
          stroke: (d) => colors[d.grade - 1],
          strokeWidth: C.line,
        }),
        P.dot(rows, {
          x: "mean",
          y: "pos",
          r: C.dot,
          fill: (d) => colors[d.grade - 1],
          stroke: k.plotBg,
        }),
        P.text(hiddenBands, {
          x: () => (lo + hi) / 2,
          y: "labelPos",
          text: (b) => textOfParts(fill(T.hiddenGrade, { g: formatCount(b.grade) })),
          fill: k.plotMuted,
        }),
        P.tip(rows, P.pointerY({ x: "mean", y: "pos", title: tipText })),
      ];
    },
    keyboard: {
      data: rows,
      x: "mean",
      y: "pos",
      key: (d) => d.id,
      sort: false,
      label: T.keyboardLabel,
      title: tipText,
    },
  });

  let hook = el.querySelector(':scope > [data-prx-readout="order"]');
  if (!hook) {
    hook = doc.createElement("span");
    hook.hidden = true;
    hook.setAttribute("data-prx-readout", "order");
    el.append(hook);
  }
  hook.setAttribute("data-num", rowsOrder.join(","));
  hook.textContent = formatTuple(rowsOrder, (i) => formatCount(i));
  return { chart, order: rowsOrder, shown, G, colors: colors ?? gradeColors(G, palette(el)) };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    frame: "v2",
    label: CONFIG.label,
    className: `${CONFIG.className} prx-rc-app`,
    css: REPORT_CARD_CSS + STAGE_CSS,
    keys: {
      data: { type: "choice", values: [...CONFIG.datasets], value: CONFIG.defaults.data },
      tau: { type: "number", ...CONFIG.tau, snap: true },
      cap: { type: "integer", ...CONFIG.cap },
      order: { type: "choice", values: [...CONFIG.orders], value: CONFIG.defaults.order },
      reveal: { type: "integer", ...CONFIG.reveal },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const hooked = (node, name) => {
        if (name) node.setAttribute("data-prx-readout", name);
        return node;
      };
      const num = (raw, display, name) => hooked(ctx.num(raw, display), name);
      const count = (raw, name) => num(raw, formatCount(raw), name);
      const setting = (raw, name) => num(raw, formatSetting(raw), name);
      const sym = (base, arg) => h("span", { class: "prx-rc-sym" }, h("i", {}, base), arg ? ["(", h("i", {}, arg), ")"] : []);

      // Primary controls in ctx.controls
      const dataSeg = ctx.segmented({
        label: T.dataLegend,
        name: "data",
        className: "prx-rc-data",
        options: CONFIG.datasets.map((v) => ({ value: v, label: CONFIG.data[v].label })),
        value: ctx.state.data,
        onChange: (v) => ctx.set({ data: v }),
      });
      const tauSlider = ctx.slider({
        label: T.tauLabel,
        ...CONFIG.tau,
        value: ctx.state.tau,
        name: "tau",
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.controls.append(dataSeg.root, ctx.primaryControl(tauSlider.root));

      // Secondary controls in ctx.settingsBox("Settings")
      const settings = ctx.settingsBox("Settings");
      const capOptions = [];
      for (let g = CONFIG.cap.min; g <= CONFIG.cap.max; g += 1) {
        capOptions.push({ value: g, label: formatCount(g) });
      }
      const capSelect = ctx.select({
        label: T.capLabel,
        options: capOptions,
        value: ctx.state.cap,
        name: "cap",
        onChange: (v) => ctx.set({ cap: v }),
      });
      const orderSelect = ctx.select({
        label: T.orderLegend,
        name: "order",
        options: CONFIG.orders.map((v) => ({ value: v, label: T.orderWords[v] })),
        value: ctx.state.order,
        onChange: (v) => ctx.set({ order: v }),
      });
      orderSelect.root.classList.add("prx-rc-order");
      let lastG = 1;
      const revealBtn = ctx.button({
        label: T.revealStart,
        key: "reveal-next",
        onClick: () => {
          const r = ctx.state.reveal;
          if (r === 0 || r >= lastG) ctx.set({ reveal: 1 });
          else ctx.set({ reveal: r + 1 });
        },
      });
      const allBtn = ctx.button({
        label: T.revealAll,
        key: "reveal-all",
        onClick: () => ctx.set({ reveal: 0 }),
      });
      const revealBox = h("div", { class: "prx-control prx-rc-reveal" }, revealBtn.root, allBtn.root);
      settings.body.append(capSelect.root, orderSelect.root, revealBox);

      // Stage: full-width report card + visible between-grade scroll region and grade means
      const chartSlot = ctx.primaryGraphic(h("div", { class: "prx-rc-chart" }));
      const legendSlot = ctx.part("legend", h("div", { class: "prx-rc-legend-slot" }));
      const cardBox = h(
        "section",
        { class: "prx-rc-card", "aria-label": T.cardHeading },
        ctx.panelTitle(T.cardHeading, { className: "prx-rc-heading" }),
        chartSlot,
        legendSlot,
      );

      const betweenSlot = h("div", { class: "prx-rc-between-body" });
      const betweenBox = ctx.part(
        "table",
        h(
          "section",
          { class: "prx-rc-between prx-light-panel", "aria-label": T.betweenHeading },
          ctx.panelTitle(T.betweenHeading, { className: "prx-rc-heading" }),
          betweenSlot,
        ),
      );
      ctx.stage.append(cardBox, betweenBox);
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));

      // Disclosures: complete audit counts/tables in Data, interval/matrix details in Method
      const dataBox = ctx.dataBox("Data and exact values");
      const methodBox = ctx.methodBox("Method and details");
      const dataHeader = h("div", { class: "prx-rc-data-header" });
      const unitTableWrap = ctx.scrollRegion(h("div", { class: "prx-rc-unit-scroll" }), "Unit summaries in display order");
      dataBox.body.append(dataHeader, unitTableWrap);

      const cardCaption = h("p", {});
      const matrixGuide = h("p", { text: T.separateMeansCaption });
      const betweenSummarySlot = h("div", { class: "prx-rc-between-summary-slot" });
      const dataNote = h("p", { hidden: true });
      betweenBox.append(betweenSummarySlot);
      methodBox.body.append(h("div", { class: "prx-rc-method" }, cardCaption, matrixGuide, dataNote));

      function drawDataDisclosure(r, set, state, rowsOrder) {
        const one = r.G === 1;
        const line1 = h(
          "p",
          { class: "prx-rc-counts" },
          ...fill(one ? T.headerOne : T.header, {
            G: () => sym("G", "g"),
            Gv: () => count(r.G, "G"),
            N: () => count(r.N, "N"),
            M: () => count(r.M, "M"),
            s: () => num(r.s, formatShare(r.s), "s"),
          }),
        );
        const label = [tagNode(ctx, r.result, { orderWords: "the expected-rank order" })];
        if (set.key === "thirty") label.push("; ", T.orderFamily);
        if (r.result.tieCount > 1) {
          label.push(
            "; ",
            count(r.result.tieCount),
            " reports share the smallest risk; this card shows the first (equal-risk tolerance ",
            num(r.result.tieTol, formatSci(r.result.tieTol)),
            ")",
          );
        }
        const line2 = h(
          "p",
          { class: "prx-rc-result" },
          ...fill(T.resultAt, { tau: () => setting(r.tau, "tau"), cap: () => count(r.cap, "cap") }),
          ...label,
          ". ",
          ...fill(T.riskLine, {
            risk: () => num(r.risk, formatRisk(r.risk), "risk"),
            eon: () => num(r.EoverN, formatShare(r.EoverN), "EoverN"),
          }),
        );
        const line3 = h("p", { class: "prx-rc-result" }, "Rows: ", T.orderRead[state.order], ".");
        dataHeader.replaceChildren(line1, line2, line3);

        const card = set.card;
        const digits = Number.isInteger(card.digits) ? card.digits : CONFIG.digits.value;
        const val = (v) => formatDecimal(v, { digits });
        const names = card.names ?? card.ids;
        const thead = h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { scope: "col", text: T.colUnit }),
            h("th", { scope: "col", text: T.colGrade }),
            h("th", { scope: "col", text: T.colMean }),
            h("th", { scope: "col", text: T.colLower }),
            h("th", { scope: "col", text: T.colUpper }),
            card.expectedRank ? h("th", { scope: "col", text: T.colRank }) : null,
          ),
        );
        const tbody = h(
          "tbody",
          {},
          ...rowsOrder.map((i) => h(
            "tr",
            {},
            h("th", { scope: "row", text: names[i] }),
            h("td", {}, ctx.num(r.grade[i], formatCount(r.grade[i]))),
            h("td", {}, ctx.num(card.mean[i], val(card.mean[i]))),
            h("td", {}, ctx.num(card.lower[i], val(card.lower[i]))),
            h("td", {}, ctx.num(card.upper[i], val(card.upper[i]))),
            card.expectedRank
              ? h("td", {}, ctx.num(card.expectedRank[i], formatDecimal(card.expectedRank[i], { digits: CONFIG.digits.rank })))
              : null,
          )),
        );
        unitTableWrap.replaceChildren(
          h(
            "table",
            { class: "prx-table prx-sticky-first" },
            h(
              "caption",
              {},
              `${card.title ?? set.D.title}: all `,
              ctx.num(card.ids.length, formatCount(card.ids.length)),
              " units in display order",
            ),
            thead,
            tbody,
          ),
        );
      }

      function drawMethodDisclosure(set) {
        const lvl = num(set.card.level, formatPercent(set.card.level), "level");
        cardCaption.replaceChildren(
          ...fill(set.card.intervalSource === "supplied central" ? T.captionSupplied : T.caption, { level: () => lvl }),
          " ",
          T.marginal,
        );
        dataNote.hidden = !set.D.note;
        dataNote.textContent = set.D.note ?? "";
      }

      function drawReveal(state, G) {
        const r = state.reveal;
        const shown = shownGrades(r, G);
        revealBtn.setLabel(r === 0 ? T.revealStart : shown < G ? T.revealNext : T.revealAgain);
        revealBtn.setDisabled(G === 1);
        allBtn.setDisabled(r === 0 || G === 1);
      }

      function drawReadout(r, shown, between) {
        const vectorForm = r.grade.length <= CONFIG.vectorMax;
        const cardNode = vectorForm
          ? w.num(r.grade, formatGrades(r.grade), { hook: "ro-card" })
          : w.num(r.sizes, formatSizes(r.sizes), { hook: "ro-sizes" });

        if (r.G === 1) {
          w.set([
            "At τ = ",
            w.setting(r.tau, { hook: "ro-tau" }),
            " (cap ",
            w.count(r.cap, { hook: "ro-cap" }),
            "), card ",
            cardNode,
            " states ",
            w.count(0),
            " of ",
            w.count(r.M),
            " pairs (risk ",
            w.risk(r.risk, { hook: "ro-risk" }),
            ", no directions stated).",
          ]);
          return;
        }

        const vis = between.filter((b) => b.hp <= shown);
        const adj = vis.filter((b) => b.hp === b.h + 1);
        const adjClause = adj.length
          ? [
              "adjacent errors ",
              ...adj.flatMap((b, k) => [k ? ", " : "", w.risk(b.meanError, { hook: `ro-adj-${b.h}-${b.hp}` })]),
              " (",
              w.count(shown, { hook: "ro-shown" }),
              " of ",
              w.count(r.G, { hook: "ro-G" }),
              " grades shown).",
            ]
          : [
              w.count(shown, { hook: "ro-shown" }),
              " of ",
              w.count(r.G, { hook: "ro-G" }),
              " grades shown.",
            ];

        w.set([
          "At τ = ",
          w.setting(r.tau, { hook: "ro-tau" }),
          " (cap ",
          w.count(r.cap, { hook: "ro-cap" }),
          "), card ",
          cardNode,
          " states ",
          w.count(r.N, { hook: "ro-N" }),
          " of ",
          w.count(r.M, { hook: "ro-M" }),
          " pairs (s = ",
          w.share(r.s, { hook: "ro-s" }),
          ", E/N = ",
          w.share(r.EoverN),
          ", risk ",
          w.risk(r.risk, { hook: "ro-risk" }),
          "); ",
          ...adjClause,
        ]);
      }

      return {
        render(state, info = {}) {
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            dataSeg.set(state.data);
            tauSlider.set(state.tau);
            capSelect.set(state.cap);
            orderSelect.set(state.order);
            const set = datasets()[state.data];
            const r = solve(state);
            lastG = r.G;
            const out = drawStageCard(chartSlot, set.card, {
              grade: r.grade,
              order: state.order,
              reveal: state.reveal,
            });
            legendSlot.replaceChildren(
              gradeLegend(ctx.doc, {
                grade: r.grade,
                colors: out.colors,
                unit: set.card.unit,
                units: set.card.units,
                grade1: set.D.grade1,
                shown: out.shown,
              }),
            );
            drawReveal(state, r.G);
            const table = drawBetweenGrades(betweenSlot, {
              grade: r.grade,
              E: set.E,
              mean: set.card.mean,
              shown: state.reveal,
              names: set.card.names,
              meansInLegend: true,
              caption: SHORT_BETWEEN_CAPTION,
            });
            betweenSummarySlot.replaceChildren(...(table.summary ? [table.summary] : []));
            drawDataDisclosure(r, set, state, out.order);
            drawMethodDisclosure(set);
            drawReadout(r, out.shown, table.between);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
