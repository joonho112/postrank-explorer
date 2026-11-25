// G-09 axes, complete same-family identity and complete tau-grid check (5.2, Frame v2).
import { createWidget } from "../shared/base.js";
import { canvasLayer, numText, placeDirectLabels, plot } from "../shared/chart.js";
import { formatCount, formatGrades, formatSci, formatSetting, formatShare, formatSig } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { appendKrwNotice, cardAt, readKrwModel } from "../shared/krw-model.js";
import { krwRisk, reportCloud, reportInformation } from "../pr-core.js";
import {
  BRIDGE_CSS,
  BRIDGE_TEXT as T,
  E6,
  FAMILY,
  FAMILY_COUNT,
  bridgeKeys,
  createAxisControls,
  createConverterView,
  createEndpointNote,
  createIdentityView,
  gridTaus,
  identityAt,
  makePillRender,
  raceCardReference,
  writeBridgeReadout,
} from "../shared/domain/lambda-tau.js";

const CSS = `${BRIDGE_CSS}
.prx-kbridge .kb-gridtable{max-height:22rem;overflow-y:auto;font-variant-numeric:tabular-nums}
.prx-kbridge .kb-gridtable table{white-space:nowrap;min-width:34rem}
.prx-kbridge .kb-progress{min-height:1.4em;margin:.2rem 0 0;color:var(--prx-fg-muted);font-size:.86em}
.prx-kbridge .prx-stage .kb-progress{color:var(--prx-plot-muted)}
.prx-kbridge .kb-axes{margin:0}
.prx-kbridge .kb-cloud{min-height:290px}
.prx-kbridge .prx-stage .kb-stage-line{margin:.35rem 0 0;font-size:.88rem;line-height:1.35;color:var(--prx-plot-fg)}
.prx-kbridge .kb-grid[hidden]{display:none}
`;

const num = (ctx, raw, display, hook) => {
  const n = ctx.num(raw, display);
  if (hook) n.dataset.prxReadout = hook;
  return n;
};
const setting = (ctx, raw, hook) => num(ctx, raw, formatSetting(raw), hook);
const grade = (ctx, g, hook) => num(ctx, Array.from(g), formatGrades(g), hook);
const fill = (ctx, parts, slots = {}) =>
  parts.flatMap((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    return m
      ? [].concat((slots[m[1]] ?? (() => ctx.num(m[1] === "two" ? 2 : 1, formatCount(m[1] === "two" ? 2 : 1))))())
      : [p];
  });
const key = (g) => Array.from(g).join(",");
let cloudCache = null;

export function createKrwAxesView(ctx, slot, { pointer = false, notesSlot = null } = {}) {
  const h = ctx.h;
  const chart = h("div", { class: "kb-cloud" });
  const sentence = h("p", { class: "kb-stage-line" });
  const gradeStrip = h("p", { class: "kb-stage-line", "data-prx-readout": "axes-grade-strip" });
  const flatNote = h("p", { class: "kb-note", hidden: true });
  const axisKey = h(
    "p",
    { class: "kb-note" },
    "Grade vector order: ",
    h("span", { "data-prx-name": "", text: E6.ids.join(" / ") }),
    ". A shared grade leaves a comparison unstated. DR divides expected errors by all pairs. The uppermost equal-risk line touches the best report.",
  );
  const note = h("p", { class: "kb-note" }, T.axesNote, " See ", h("a", { href: "../../pages/grades/frontier.html", text: "The frontier" }), ".");
  const root = h(
    "section",
    { class: "kb-axes", "aria-label": T.axesHead },
    ...(notesSlot ? [] : [ctx.panelTitle(T.axesHead)]),
    h("div", { class: "kb-figure" }, chart),
    sentence, gradeStrip,
    ...(notesSlot ? [] : [flatNote, axisKey, note]),
  );
  slot.append(root);
  if (notesSlot) notesSlot.append(flatNote, axisKey, note);

  let layer = null;
  let paint = [];
  return {
    root,
    render(model, cloud) {
      const r = model.parameters;
      const best = model.postrank.grades.map((g) => cloud.byGrade.get(key(g)));
      const b = best[0];
      const line = [
        { x: 0, y: b.y - r.slope * b.x },
        { x: 1, y: b.y + r.slope * (1 - b.x) },
      ];
      const right = r.slope === 0 ? 1 : Math.min(1, Math.max(0, (1 - line[0].y) / r.slope));
      const lineYAtRight = line[0].y + r.slope * right;
      const steepLeft = right <= 0.55;
      const lineCalloutX = steepLeft ? Math.min(1, Math.max(0, b.x)) : Math.min(0.96, right);
      const lineCalloutY = steepLeft ? Math.max(-0.85, b.y - 0.16) : line[0].y + r.slope * lineCalloutX;

      const stageW = root.clientWidth || ctx.width() || 640;
      const plotH = stageW < 520 ? 304 : 348;

      const withheldItem = {
        id: "withheld",
        x: 0,
        y: 0,
        text: T.allWithheld,
        anchor: "start",
        dx: 10,
        dy: 15,
      };
      const bestText = formatGrades(b.grade);
      const bestItem = {
        ...b,
        id: "best",
        text: bestText,
        anchor: "start",
        dx: 12,
        dy: -14,
        active: true,
      };
      const lineItem = {
        id: "line",
        x: lineCalloutX,
        y: lineCalloutY,
        text: T.lineLabel,
        anchor: steepLeft ? "start" : "end",
        dx: steepLeft ? 12 : -6,
        dy: steepLeft ? 16 : -14,
      };
      const allCallouts = [withheldItem, bestItem, lineItem];

      paint = cloud.points;
      const fig = plot(chart, {
        alt: T.axesAlt.replace("4,683", formatCount(FAMILY_COUNT)),
        height: plotH,
        marginTop: 28,
        marginRight: 18,
        marginBottom: 44,
        marginLeft: 52,
        table: {
          caption: T.axesTable,
          columns: [
            { label: T.colN, value: "N", format: formatCount, header: true },
            { label: T.colReports, value: "count", format: formatCount },
            { label: T.colMinDR, value: "dr", format: formatShare },
            { label: T.colTopI, value: "inf", format: (v) => formatSig(v, { sig: 3 }) },
          ],
          rows: cloud.rows,
        },
        x: { domain: [0, 1], inset: 10, ticks: 5, label: T.axesX, labelAnchor: "center", labelArrow: "none" },
        y: { domain: [-1, 1], inset: 10, ticks: 5, label: T.axesY, labelAnchor: "center", labelArrow: "none" },
        keyboard: {
          data: cloud.points,
          x: "x",
          y: "y",
          sort: false,
          virtual: true,
          pointer,
          label: "Read every six-site report on KRW’s axes",
          title: (d) =>
            `Report ${formatGrades(d.grade)}: ${formatCount(d.N)} stated pairs; DR ${formatShare(d.x)}; correct minus wrong per pair ${formatSig(d.y, { sig: 3 })}.`,
        },
        marks: (c, P) => {
          let placedById = null;
          const getPlaced = (scales, dims) => {
            if (!placedById) {
              placedById = new Map(
                placeDirectLabels(
                  allCallouts.map((it) => ({ id: it.id, y: scales.y(it.y) + (it.dy ?? 0), height: 18 })),
                  { minGap: 22, minY: dims.marginTop + 12, maxY: dims.height - dims.marginBottom - 12 },
                ).map((p) => [p.id, p.y]),
              );
            }
            return placedById;
          };
          const whMarkItem = { ...withheldItem, pillStroke: c.wh };
          const bestMarkItem = { ...bestItem, pillStroke: c.err };
          const lineMarkItem = { ...lineItem, pillStroke: c.plotFg };
          return [
            P.ruleY([0], { stroke: c.plotAxis }),
            P.ruleX([0], { stroke: c.plotAxis }),
            P.line(line, { x: "x", y: "y", stroke: c.plotFg, strokeWidth: 1.75, clip: true }),
            P.dot([{ x: 0, y: 0 }], { x: "x", y: "y", r: 4.5, fill: c.wh, stroke: c.plotBg }),
            P.text([whMarkItem], {
              x: "x",
              y: "y",
              text: () => T.allWithheld,
              fill: c.plotFg,
              fontWeight: "600",
              fontSize: 13,
              render: makePillRender([whMarkItem], getPlaced, c),
            }),
            P.dot(best, { x: "x", y: "y", r: 7.5, fill: "none", stroke: c.plotFg, strokeWidth: 2 }),
            P.dot(best, { x: "x", y: "y", r: 4.5, fill: c.err, stroke: c.plotBg }),
            numText([bestMarkItem], {
              x: "x",
              y: "y",
              value: "grade",
              format: formatGrades,
              fill: c.plotFg,
              fontWeight: "700",
              fontSize: 13,
              render: makePillRender([bestMarkItem], getPlaced, c),
            }),
            P.text([lineMarkItem], {
              x: "x",
              y: "y",
              text: () => T.lineLabel,
              fill: c.plotFg,
              fontWeight: "600",
              fontSize: 13,
              render: makePillRender([lineMarkItem], getPlaced, c),
            }),
          ];
        },
      });
      if (!layer || !chart.contains(layer.canvas)) {
        layer = canvasLayer(fig, (g, { x, y, palette }) => {
          g.save();
          g.globalAlpha = 0.45;
          g.fillStyle = palette.neutral[4];
          for (const p of paint) {
            g.beginPath();
            g.arc(x(p.x), y(p.y), 1.6, 0, 2 * Math.PI);
            g.fill();
          }
          g.restore();
        });
      }
      void lineYAtRight;
      sentence.replaceChildren(
        "Best at λ = ",
        setting(ctx, r.lambda, "axes-lambda"),
        ": ",
        grade(ctx, b.grade, "axes-grades"),
        " (DR = ",
        num(ctx, b.x, formatShare(b.x), "axes-dr"),
        ", I = ",
        num(ctx, b.y, formatSig(b.y, { sig: 3 }), "axes-inf"),
        ", equal-risk slope ",
        setting(ctx, r.slope, "axes-slope"),
        ").",
      );
      gradeStrip.replaceChildren(...Array.from(b.grade).map((g, i) => h("span", {},
        i ? " · " : "", E6.ids[i], " ", num(ctx, g, formatCount(g)))) ,
        ". At τ = ", setting(ctx, r.tau, "axes-tau"), ", postrank risk = τ + (", num(ctx, 1, formatCount(1)),
        " − τ) × KRW risk = ", num(ctx, model.postrank.risk, formatSig(model.postrank.risk, { sig: 3 }), "axes-risk"), ".");
      if (r.lambda === 1) {
        flatNote.hidden = false;
        flatNote.replaceChildren(...fill(ctx, T.axesFlat));
      } else {
        flatNote.hidden = true;
        flatNote.replaceChildren();
      }
      chart.dataset.prxReports = String(cloud.points.length);
      chart.querySelectorAll('[data-prx-part="table"] tbody tr').forEach((row, i) => {
        [...row.cells].forEach((cell, j) => cell.setAttribute("data-prx-readout", `cloud-${i}-${["N", "count", "dr", "inf"][j]}`));
      });
    },
  };
}

export function createKrwGridView(ctx, slot) {
  const root = ctx.h("section", { class: "kb-box kb-grid", hidden: true });
  slot.append(root);
  let shown = false;
  return {
    root,
    render(rows, on) {
      root.hidden = !on;
      if (!on) {
        root.removeAttribute("aria-busy");
        return null;
      }
      if (rows.length !== gridTaus().length) {
        shown = false;
        root.setAttribute("aria-busy", "true");
        root.replaceChildren(ctx.panelTitle(T.gridHead), ctx.h("p", { class: "kb-note", text: T.gridBusy }));
        return null;
      }
      root.removeAttribute("aria-busy");
      const summary = {
        same: rows.filter((r) => r.sameFullSet).length,
        count: rows.length,
        diff: Math.max(...rows.map((r) => r.maxAffineResidual ?? 0)),
      };
      if (shown) return summary;
      shown = true;
      const table = ctx.h(
        "table",
        {},
        ctx.h("caption", { text: T.gridCaption }),
        ctx.h("thead", {}, ctx.h("tr", {}, ...[T.colTau, T.colLambda, T.colPr, T.colKrw, T.colSameSet].map((text) => ctx.h("th", { scope: "col", text })))),
        ctx.h(
          "tbody",
          {},
          ...rows.map((m, i) => {
            const id = `grid-${String(i + 2).padStart(2, "0")}`;
            const list = (gs, name) => gs.flatMap((g, k) => [k ? ", " : "", grade(ctx, g, `${id}-${name}-${k}`)]);
            return ctx.h(
              "tr",
              {},
              ctx.h("th", { scope: "row" }, setting(ctx, m.parameters.tau, `${id}-tau`)),
              ctx.h("td", {}, num(ctx, m.parameters.lambda, formatSig(m.parameters.lambda, { sig: 3 }), `${id}-lambda`)),
              ctx.h("td", {}, ...list(m.postrank.grades, "pr")),
              ctx.h("td", {}, ...list(m.krw.grades, "krw")),
              ctx.h("td", { text: m.sameFullSet ? T.yes : T.no }),
            );
          }),
        ),
      );
      root.replaceChildren(
        ctx.panelTitle(T.gridHead),
        ctx.h("p", { class: "kb-line" }, ...fill(ctx, T.gridSummary, {
          same: () => num(ctx, summary.same, formatCount(summary.same), "grid-same"),
          count: () => num(ctx, summary.count, formatCount(summary.count), "grid-count"),
          diff: () => num(ctx, summary.diff, summary.diff === 0 ? formatCount(0) : formatSci(summary.diff, { sig: 2 }), "grid-diff"),
        })),
        ctx.scrollRegion(ctx.h("div", { class: "kb-table kb-gridtable", "data-prx-part": "table" }, table), T.gridCaption),
      );
      return summary;
    },
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "krw-axes",
    frame: "v2",
    className: "prx-kbridge",
    css: CSS,
    keys: { ...bridgeKeys(1), grid: { type: "boolean", value: false } },
    build(ctx) {
      const h = ctx.h;
      const controls = createAxisControls(ctx, { concise: true });
      ctx.primaryControl(controls.lambda.input);

      const taus = gridTaus();
      const settings = ctx.settingsBox("Settings");
      const toggle = ctx.toggle({
        label: [
          "Check every τ on a τ grid from ",
          ctx.num(taus[0], formatSetting(taus[0])),
          " to ",
          ctx.num(taus.at(-1), formatSetting(taus.at(-1))),
          " (not KRW’s λ grid)",
        ],
        name: "grid",
        onChange: (grid) => ctx.set({ grid }),
      });
      toggle.root
        .querySelector("label")
        .replaceChildren("Check every τ on a τ grid from ", ctx.num(taus[0], formatSetting(taus[0])), " to ", ctx.num(taus.at(-1), formatSetting(taus.at(-1))), " (not KRW's λ grid)");
      settings.body.append(toggle.root);

      const progress = h("p", { class: "kb-progress", hidden: true });
      const axesSlot = h("div");
      ctx.stage.append(axesSlot, progress);

      const dataBox = ctx.dataBox(["Data, grid check and ", ctx.num(97, formatCount(97)), "-firm card"]);
      const methodBox = ctx.methodBox("Method and affine identity");

      const identitySlot = h("div");
      const gridSlot = h("div");
      dataBox.body.append(identitySlot, gridSlot);

      const converterSlot = h("div");
      const notesSlot = h("div");
      methodBox.body.append(converterSlot, notesSlot, createEndpointNote(ctx));

      const axes = createKrwAxesView(ctx, axesSlot, { pointer: true, notesSlot });
      const identity = createIdentityView(ctx, identitySlot, { detailed: true });
      const grid = createKrwGridView(ctx, gridSlot);
      const converter = createConverterView(ctx, converterSlot);

      const published = raceCardReference();
      const race = readKrwModel("race");
      const one = cardAt(race, 1);
      const context = { n: published.card.length, G: one.d.G, DR: one.DR };

      ctx.caption.replaceChildren("Six fictional sites: ", captionNode(ctx, "teaching-posterior"), ".");
      appendKrwNotice(ctx);

      let closed = false;
      let pendingCloud = false;
      let cloud = cloudCache;
      const points = [];
      let rawCloud = null;
      const gridRows = [];
      let cancelGrid = null;
      let epoch = 0;

      const busy = () => {
        const active = !cloud || Boolean(ctx.state.grid && gridRows.length < taus.length);
        progress.hidden = !active && !ctx.state.grid;
        progress.textContent = active ? "Updating reports…" : "";
        if (active) ctx.root.setAttribute("aria-busy", "true");
        else ctx.root.removeAttribute("aria-busy");
      };

      const draw = () => {
        if (closed) return;
        const model = identityAt(ctx.state);
        controls.render(model);
        toggle.set(ctx.state.grid);
        if (cloud) axes.render(model, cloud);
        converter.render(model);
        identity.render(model, context);
        const summary = grid.render(gridRows, ctx.state.grid);
        writeBridgeReadout(ctx, model, {
          grid: ctx.state.grid ? summary : null,
          running: Boolean(ctx.state.grid && !summary),
          residual: true,
        });
        busy();
      };

      const runGrid = () => {
        if (!cloud || !ctx.state.grid || gridRows.length === taus.length || cancelGrid) return;
        const ticket = ++epoch;
        const step = () => {
          cancelGrid = null;
          if (closed || ticket !== epoch || !ctx.state.grid) return;
          const start = ctx.win.performance.now();
          let n = 0;
          do {
            gridRows.push(identityAt({ lambda: null, tau: taus[gridRows.length] }));
            n++;
          } while (n < 3 && gridRows.length < taus.length && ctx.win.performance.now() - start < 20);
          if (gridRows.length < taus.length) cancelGrid = ctx.timeout(step, 0);
          else ctx.keepFocus(draw);
        };
        cancelGrid = ctx.timeout(step, 0);
      };

      const prepareCloud = () => {
        if (cloud || pendingCloud) return;
        pendingCloud = true;
        const step = () => {
          if (closed) return;
          rawCloud ??= reportCloud(E6, { family: FAMILY });
          const start = ctx.win.performance.now();
          let count = 0;
          do {
            const p = rawCloud.points[points.length];
            points.push({ grade: p.grade, N: p.N, x: krwRisk(p.grade, E6, { lambda: 0 }), y: reportInformation(p.grade, E6) });
            count++;
          } while (points.length < rawCloud.points.length && count < 256 && ctx.win.performance.now() - start < 20);
          if (points.length < rawCloud.points.length) {
            ctx.timeout(step, 0);
            return;
          }
          const byGrade = new Map(points.map((p) => [key(p.grade), p]));
          cloud = cloudCache = {
            points,
            byGrade,
            rows: rawCloud.byN.map((row) => {
              const p = byGrade.get(key(row.minGrade));
              return { N: row.N, count: row.count, dr: p.x, inf: p.y };
            }),
          };
          pendingCloud = false;
          ctx.keepFocus(draw);
          runGrid();
        };
        ctx.timeout(step, 0);
      };

      ctx.onCleanup(() => {
        closed = true;
        epoch++;
        cancelGrid?.();
      });

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          if (!state.grid && cancelGrid) {
            epoch++;
            cancelGrid();
            cancelGrid = null;
          }
          draw();
          prepareCloud();
          runGrid();
        },
      };
    },
  });
}
