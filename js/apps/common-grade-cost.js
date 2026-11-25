// Commonality costs: live six-site exact comparisons and two fixed draw-based archives.
// Scientific values come from commonalityCost/evaluateReport or the declared released archive.
import { createWidget } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  formatTuple,
} from "../shared/format.js";
import { captionNode, familySizeNode, labelNode, ro, tagNode } from "../shared/readout.js";
import { commonalityCost, evaluateReport } from "../pr-core.js";
import { commonalityArchive } from "../shared/criteria-archive.js";
import { SIX_SITE_PACKAGE_VERSION, sixSitePackageRepresentativeIndex } from "../shared/criteria-provenance.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "common-grade-cost",
  w: Object.freeze({ type: "number", min: 0, max: 1, step: 0.01, value: 0.5 }),
  tau: 0.2,
  family: Object.freeze({ kind: "atMost", G: 3 }),
  cost: Object.freeze({
    height: 256,
    archiveHeight: 286,
    marginTop: 32,
    marginBottom: 40,
    marginLeft: 74,
    marginRight: 24,
    insetLeft: 42,
    insetRight: 46,
    r: 8.5,
    xDomain: Object.freeze([0, 0.25]),
    xTicks: Object.freeze([0, 0.05, 0.1, 0.15, 0.2, 0.25]),
    dash: "5 3",
    tiedOpacity: 0.45,
  }),
  text: Object.freeze({
    w: "Weight w on score A",
    costTitle: "Each score's risk: own best report → common report",
    archiveTitle: "Three criteria in the recorded draw-based analysis",
    reportsTitle: "The reports",
    common: "Common report",
    own: (k) => `Score ${k}'s own best`,
    tied: "tied with another report",
    scores: Object.freeze(["score A", "score B"]),
    allWithheld: (tau) => `all withheld (τ = ${formatSetting(tau)})`,
    xLabel: "risk on that score →",
    keyOwn: "its own best report",
    keyCommon: "the common report",
    keyDelta: "Δ: excess risk under common grade",
    costAlt: "Dumbbell chart: for score A and score B, the risk under that score's own best report (open dot) and under the common report (filled dot); the gap is the cost of the common grade.",
    archiveAlt: "Archived three-criterion dumbbell chart. Open dots show each criterion's own solved risk; filled dots show its risk under the fixed common report. The dashed line is all-withheld risk. Optimization bounds are recorded in the table.",
  }),
});

// --------------------------------------------------------------------------------------------- data

const A2 = SIX.arrays.two;
const ERRORS = {
  ids: A2.ids.slice(),
  criteria: A2.criteria.slice(),
  e: A2.e.map((m) => m.map((r) => r.map((v) => (v === null ? Number.NaN : v)))),
};
const IDS = ERRORS.ids;
const LETTERS = ["A", "B"];
const SVG_NS = "http://www.w3.org/2000/svg";

const blocksOf = (grade, ids = IDS) =>
  Array.from({ length: Math.max(...grade) }, (_, h) => ids.filter((_, i) => grade[i] === h + 1));
const blocksText = (grade, ids = IDS) =>
  blocksOf(grade, ids).map((b) => `{${b.join(", ")}}`).join(" > ");
const sameGrade = (g, h) => g.length === h.length && g.every((v, i) => v === h[i]);

function tiedCommons(cc) {
  return cc.commonReports;
}

const CSS = `
.cgc.prx-widget[data-prx-frame="v2"] .prx-stage.cgc-stage-paper {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: 0.45rem;
  padding: 0.65rem 0.85rem 0.6rem;
}
.cgc .prx-stage.cgc-stage-paper .prx-panel-title {
  margin: 0 0 0.25rem;
  color: var(--prx-plot-fg);
}
.cgc .prx-stage.cgc-stage-paper .prx-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 1rem;
  margin: 0.3rem 0 0;
  padding: 0.2rem 0 0;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  font-size: 0.84375rem;
}
.cgc .cgc-sw-own {
  background: transparent;
  border: 2.5px solid var(--prx-plot-muted);
  border-radius: 50%;
}
.cgc .cgc-sw-common {
  background: var(--prx-plot-muted);
  border-radius: 50%;
}
.cgc .cgc-linked { display: grid; gap: .8rem; align-items: start; grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr)); }
.cgc .cgc-linked > *, .cgc .cgc-cost { min-width: 0; }
.cgc .cgc-paper {
  margin: 0 0 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--prx-border);
  border-radius: 0.35rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
}
.cgc .cgc-paper .cgc-name {
  margin: 0 0 0.2rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--prx-plot-muted);
}
.cgc .cgc-paper .cgc-name .cgc-note-inline {
  font-weight: 400;
  color: var(--prx-plot-muted);
}
.cgc .cgc-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.cgc .cgc-chip {
  display: inline-block;
  min-width: 1.9rem;
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  padding: 0.12rem 0.5rem;
  border-radius: 5px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-align: center;
}
.cgc .cgc-common .cgc-chip { font-size: 1.02rem; padding: 0.15rem 0.55rem; }
.cgc .cgc-paper .cgc-gt { font-weight: 700; color: var(--prx-plot-muted); }
.cgc .cgc-section { margin: 0.65rem 0; min-width: 0; }
.cgc .cgc-section:first-child { margin-top: 0; }
.cgc .cgc-tag { margin: 0.35rem 0; font-size: 0.875rem; color: var(--prx-fg-muted); }
.cgc .cgc-tag .prx-result-tag { font-size: inherit; }
.cgc .cgc-note { margin: 0.35rem 0; font-size: 0.86rem; line-height: 1.45; color: var(--prx-fg-muted); }
.cgc .cgc-nowrap { white-space: nowrap; }
.cgc .cgc-scroll { max-width: 100%; min-width: 0; overflow-x: auto; }
.cgc .cgc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.cgc .cgc-table th, .cgc .cgc-table td {
  padding: 0.38rem 0.55rem;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
  white-space: nowrap;
}
.cgc .cgc-table caption { text-align: left; font-weight: 600; margin: 0.35rem 0; color: var(--prx-fg); }
.cgc .cgc-source { overflow-wrap: anywhere; }
.cgc [data-prx-readout="archive-grade"] { white-space: normal; overflow-wrap: anywhere; }
@media (min-width: 48.01em) {
  .cgc.prx-widget[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.65rem;
    margin-bottom: 0.35rem;
  }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex: 0 1 18rem;
  }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    display: none;
  }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.28rem;
  }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    min-height: 1.95rem;
    padding: 0.16rem 0.52rem;
    font-size: 0.8125rem;
  }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.95rem;
    padding: 0.16rem 0;
  }
}
@media (max-width: 48em) {
  .cgc.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem; }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.4rem; margin-bottom: 0.3rem; }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets > .prx-seg-label { display: none; }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.22rem; }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.16rem 0.45rem; font-size: 0.8125rem; }
  .cgc.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.35rem; font-size: 0.9rem; line-height: 1.35; }
  .cgc.prx-widget[data-prx-frame="v2"] .prx-stage.cgc-stage-paper { padding: 0.5rem 0.55rem 0.45rem; }
}
`;

/** Build a single tau-callout mark with a plotBg backing pill (WB-03) and clean <tspan data-num> child. */
function tauHeaderMark(P, c, tauVal) {
  const tauStr = formatSetting(tauVal);
  const fullLabel = `all withheld (τ = ${tauStr})`;
  return P.text([tauVal], {
    x: (d) => d,
    frameAnchor: "top",
    text: () => fullLabel,
    dy: -16,
    fontSize: 13,
    fill: c.plotMuted,
    render(index, scales, values, dims, context, next) {
      const group = next(index, scales, values, dims, context);
      const mark = group.querySelector("text");
      if (!mark) return group;
      const doc = mark.ownerDocument;
      const rawX = scales.x(tauVal);
      const y = Math.max(15, dims.marginTop - 11);
      const estW = Math.round(fullLabel.length * 6.9 + 12);
      const halfW = estW / 2;
      const minX = 6 + halfW;
      const maxX = Math.max(minX, dims.width - 6 - halfW);
      const cx = Math.max(minX, Math.min(maxX, rawX));
      mark.setAttribute("x", String(cx));
      mark.setAttribute("y", String(y));
      mark.setAttribute("text-anchor", "middle");
      mark.removeAttribute("dx");
      mark.removeAttribute("dy");
      mark.removeAttribute("transform");

      const pill = doc.createElementNS(SVG_NS, "rect");
      pill.setAttribute("x", String(Math.round(cx - halfW)));
      pill.setAttribute("y", String(Math.round(y - 12.5)));
      pill.setAttribute("width", String(estW));
      pill.setAttribute("height", "17");
      pill.setAttribute("rx", "3");
      pill.setAttribute("fill", c.plotBg);
      group.insertBefore(pill, mark);

      const p1 = doc.createElementNS(SVG_NS, "tspan");
      const val = doc.createElementNS(SVG_NS, "tspan");
      const p2 = doc.createElementNS(SVG_NS, "tspan");
      p1.textContent = "all withheld (τ = ";
      val.textContent = tauStr;
      val.setAttribute("data-num", dataNum(tauVal));
      p2.textContent = ")";
      mark.replaceChildren(p1, val, p2);
      return group;
    },
  });
}

/**
 * Build collision-free Δ callout pills above each criterion connector:
 * - Relaxes vertical label centers via placeDirectLabels mapped strictly by item.id (WA-02)
 * - Clamps horizontal pill bounds inside [6, width - 6] (WA-13)
 * - Renders rx: 3, fill: plotBg backing rects so vertical rules never pierce text (WB-03)
 * - Uses --prx-crit-ink-1..3 (>= 4.5:1 contrast on white plot paper)
 */
function deltaPillMark(P, c, rows, { rawValuesOf, displayOf }) {
  return P.text(rows, {
    x: (d) => d.midX,
    y: "score",
    text: (d) => `Δ ${displayOf(d)}`,
    fontSize: 13,
    fontWeight: 700,
    fill: (d) => d.ink,
    render(index, scales, values, dims, context, next) {
      const group = next(index, scales, values, dims, context);
      group.removeAttribute("transform");
      const marks = [...group.querySelectorAll("text")];
      const bw = typeof scales.y?.bandwidth === "function" ? scales.y.bandwidth() / 2 : (scales.y?.bandwidth ?? 0) / 2;
      const items = Array.from(index, (i) => {
        const baseY = (values.y?.[i] ?? 0) + bw;
        return { id: String(rows[i].id), y: baseY - 18, height: 18 };
      });
      const placed = placeDirectLabels(items, {
        minGapPx: 20,
        bounds: [Math.max(24, dims.marginTop + 2), Math.max(40, dims.height - dims.marginBottom - 10)],
      });
      const byId = new Map(placed.map((p) => [p.id, p]));

      Array.from(index).forEach((i, j) => {
        const mark = marks[j];
        if (!mark) return;
        const d = rows[i];
        const doc = mark.ownerDocument;
        const disp = displayOf(d);
        const fullText = `Δ ${disp}`;
        const estW = Math.round(fullText.length * 7.5 + 12);
        const halfW = estW / 2;
        const rawX = values.x?.[i] ?? scales.x(d.midX);
        const baseY = (values.y?.[i] ?? 0) + bw;
        const minX = Math.max(6, dims.marginLeft) + halfW;
        const maxX = Math.max(minX, dims.width - Math.max(6, dims.marginRight) - halfW);
        const cx = Math.max(minX, Math.min(maxX, rawX));
        const target = byId.get(String(d.id));
        const cy = target ? target.y : baseY - 18;

        mark.setAttribute("x", String(cx));
        mark.setAttribute("y", String(cy));
        mark.setAttribute("text-anchor", "middle");
        mark.setAttribute("dominant-baseline", "central");
        mark.removeAttribute("dx");
        mark.removeAttribute("dy");
        mark.removeAttribute("transform");

        const pill = doc.createElementNS(SVG_NS, "rect");
        pill.setAttribute("x", String(Math.round(cx - halfW)));
        pill.setAttribute("y", String(cy - 8.75));
        pill.setAttribute("width", String(estW));
        pill.setAttribute("height", "17.5");
        pill.setAttribute("rx", "3");
        pill.setAttribute("fill", c.plotBg);
        pill.setAttribute("stroke", d.color);
        pill.setAttribute("stroke-opacity", "0.38");
        pill.setAttribute("stroke-width", "1");
        group.insertBefore(pill, mark);

        const prefix = doc.createElementNS(SVG_NS, "tspan");
        const value = doc.createElementNS(SVG_NS, "tspan");
        prefix.textContent = "Δ ";
        value.textContent = disp;
        value.setAttribute("data-num", dataNum(rawValuesOf(d)));
        mark.replaceChildren(prefix, value);
      });
      return group;
    },
  });
}

function styleCriterionAxisTicks(fig, domain, inks) {
  const map = new Map(domain.map((label, k) => [label, inks[k]]));
  for (const t of fig.svg.querySelectorAll('g[aria-label="y-axis tick label"] text')) {
    const ink = map.get((t.textContent ?? "").trim());
    if (ink) {
      t.setAttribute("fill", ink);
      t.setAttribute("font-weight", "600");
    }
  }
}

// --------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "cgc",
    css: CSS,
    frame: "v2",
    keys: {
      w: CONFIG.w,
      data: { type: "choice", values: ["six", "thirty25", "thirty35"], value: "six" },
    },
    build(ctx) {
      const { h } = ctx;
      const R = ro(ctx);
      const T = CONFIG.text;

      const w = ctx.slider({ label: T.w, ...ctx.key("w"), onInput: (v) => ctx.set({ w: v }) });
      ctx.controls.append(w.root);
      ctx.primaryControl(w.root);

      const source = ctx.select({
        label: "Example",
        options: [
          { value: "six", label: "Six fictional sites — live weights" },
          { value: "thirty25", label: "Thirty sites — archived lower price" },
          { value: "thirty35", label: "Thirty sites — archived higher price" },
        ],
        value: "six",
        onChange: (data) => ctx.set({ data }),
      });
      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(source.root);

      ctx.stage.classList.add("cgc-stage-paper");
      const stageHeading = ctx.panelTitle(T.costTitle);
      const costSlot = h("div", { class: "cgc-cost" });
      const key = (cls, text) =>
        h("span", { class: "prx-key" }, h("span", { class: `prx-swatch ${cls}`, "aria-hidden": "true" }), text);
      const legend = h(
        "div",
        { class: "prx-legend", "data-prx-part": "legend" },
        key("cgc-sw-own", T.keyOwn),
        key("cgc-sw-common", T.keyCommon),
        h("span", {}, T.keyDelta),
      );
      const reports = h("section", { class: "cgc-reports", "aria-label": T.reportsTitle });
      ctx.stage.append(h("div", { class: "cgc-linked" },
        h("section", {}, stageHeading, costSlot, legend), reports));

      const dataBox = ctx.dataBox("Data, report cards and criterion profile");
      const methodBox = ctx.methodBox("Method and commonality cost");

      const hookNum = (hook, value, fn = formatRisk) => {
        const node = ctx.num(value, fn(value));
        node.setAttribute("data-prx-readout", hook);
        return node;
      };
      const table = (caption, heads, body) =>
        ctx.scrollRegion(
          h(
            "div",
            { class: "cgc-scroll" },
            h(
              "table",
              { class: "cgc-table prx-sticky-first" },
              h("caption", { text: caption }),
              h("thead", {}, h("tr", {}, ...heads.map((text) => h("th", { scope: "col", text })))),
              h(
                "tbody",
                {},
                ...body.map((row) =>
                  h("tr", {}, ...row.map((cell, i) => h(i === 0 ? "th" : "td", i === 0 ? { scope: "row" } : {}, cell))),
                ),
              ),
            ),
          ),
          caption,
        );
      const scrollHint = () =>
        h("p", { class: "cgc-note", text: "Swipe wide tables horizontally; Tab into a table region and use the arrow keys to scroll." });
      const fullLabel = (result, k) =>
        h("p", { class: "cgc-tag" }, labelNode(ctx, result, { key: k }), " (", familySizeNode(ctx, result), " reports)");

      function chipRow(name, grade, pal, { cls = "", note = null, color = null, ids = IDS, markNames = false } = {}) {
        const gc = gradeColors(Math.max(...grade), pal);
        const parts = [];
        blocksOf(grade, ids).forEach((b, k) => {
          if (k) parts.push(h("span", { class: "cgc-gt", "aria-hidden": "true", text: ">" }));
          const chip = h("span", { class: "cgc-chip", style: { background: gc[k], color: labelOn(gc[k], pal) } }, b.join(" "));
          if (markNames) chip.setAttribute("data-prx-name", "");
          parts.push(chip);
        });
        return h(
          "div",
          { class: `cgc-paper ${cls}`.trim() },
          h("p", { class: "cgc-name", style: color ? { color } : undefined }, name, note ? h("span", { class: "cgc-note-inline" }, " (", note, ")") : null),
          h(
            "div",
            {
              class: "cgc-chips",
              role: "img",
              "aria-label": `${[name].flat().map((n) => (typeof n === "string" ? n : n.textContent)).join("")}: ${blocksText(grade, ids)}`,
            },
            ...parts,
          ),
        );
      }

      function drawLiveCost(cc, ties, pal) {
        const C = CONFIG.cost;
        const slotW = Math.round(costSlot.clientWidth || costSlot.getBoundingClientRect?.().width || 0) || 640;
        const narrow = slotW < 460;
        stageHeading.textContent = T.costTitle;
        const data = cc.criteria.map((r) => {
          const first = ties[0];
          const alts = ties.slice(1).filter((t) => formatRisk(t.delta[r.k]) !== formatRisk(first.delta[r.k]));
          const farVal = Math.max(first.Rk[r.k], ...alts.map((a) => a.Rk[r.k]));
          return {
            id: `live-${r.k}`,
            k: r.k,
            score: T.scores[r.k],
            own: r.ownRk,
            common: first.Rk[r.k],
            delta: first.delta[r.k],
            far: farVal,
            midX: (r.ownRk + farVal) / 2,
            color: pal.crit[r.k],
            ink: pal.critInk[r.k],
            alts: alts.map((t) => ({ common: t.Rk[r.k], delta: t.delta[r.k] })),
          };
        });
        const altDots = data.flatMap((d) => d.alts.map((a) => ({ ...d, common: a.common })));
        const deltaValues = (d) => [d.delta, ...d.alts.map((a) => a.delta)];
        const deltaKbdText = (d, sep = " or ") => deltaValues(d).map((v) => formatRisk(v)).join(sep);
        const deltaStageText = (d) => deltaValues(d).map((v) => formatReadoutRisk(v)).join(", ");

        const fig = plot(costSlot, {
          alt: T.costAlt,
          table: {
            caption: "Risk of each score under its own best report and under the common report",
            columns: [
              { label: "Score", value: "score" },
              { label: "Own best report", value: "own", format: (v) => formatRisk(v) },
              { label: "Common report", value: (d) => [d.common, ...d.alts.map((a) => a.common)], format: (v) => formatTuple(v, (x) => formatRisk(x)) },
              { label: "Cost Δ", value: (d) => [d.delta, ...d.alts.map((a) => a.delta)], format: (v) => formatTuple(v, (x) => formatRisk(x)) },
            ],
            rows: data,
          },
          height: C.height,
          marginTop: C.marginTop,
          marginBottom: C.marginBottom,
          marginLeft: narrow ? 62 : C.marginLeft,
          marginRight: narrow ? 12 : C.marginRight,
          x: {
            domain: C.xDomain,
            ticks: narrow ? [0, 0.1, 0.2] : C.xTicks,
            insetLeft: narrow ? 32 : C.insetLeft,
            insetRight: narrow ? 34 : C.insetRight,
            label: T.xLabel,
            labelAnchor: "right",
            labelOffset: 34,
            grid: true,
          },
          y: { domain: T.scores, label: null, padding: 0.45, tickSize: 0 },
          marks: (c, P) => [
            P.ruleX([CONFIG.tau], { stroke: c.plotMuted, strokeDasharray: C.dash }),
            tauHeaderMark(P, c, CONFIG.tau),
            P.link(data, { x1: "own", x2: "far", y1: "score", y2: "score", stroke: "color", strokeWidth: 4 }),
            P.dot(data, { x: "own", y: "score", r: C.r, fill: c.plotBg, stroke: "color", strokeWidth: 2.75 }),
            P.dot(altDots, { x: "common", y: "score", r: C.r, fill: "color", fillOpacity: C.tiedOpacity, stroke: "color", strokeWidth: 1.5 }),
            P.dot(data, { x: "common", y: "score", r: C.r, fill: "color", stroke: c.plotBg, strokeWidth: 1.25 }),
            deltaPillMark(P, c, data, { rawValuesOf: deltaValues, displayOf: deltaStageText }),
            numText(data, {
              x: "own",
              y: "score",
              value: "own",
              format: (v) => formatReadoutRisk(v),
              dx: -13,
              textAnchor: "end",
              fontSize: 13,
              fill: c.plotMuted,
            }),
            numText(
              data.filter((d) => d.delta > 0 && !d.alts.length),
              {
                x: "common",
                y: "score",
                value: "common",
                format: (v) => formatReadoutRisk(v),
                dx: 13,
                textAnchor: "start",
                fontSize: 13,
                fill: c.plotMuted,
              },
            ),
          ],
          keyboard: {
            data,
            x: "common",
            y: "score",
            label: T.costAlt,
            title: (d) =>
              `Score ${LETTERS[d.k]}: risk ${formatRisk(d.own)} under its own best report and ${[d.common, ...d.alts.map((a) => a.common)].map((v) => formatRisk(v)).join(" or ")} under the common report; cost of the common grade ${deltaKbdText(d)}.`,
          },
        });
        styleCriterionAxisTicks(fig, T.scores, [pal.critInk[0], pal.critInk[1]]);
        return data;
      }

      function populateLiveDisclosures(state, cc, ties, pal) {
        const common = ties[0].grade;
        const provenance = ties.map((_, i) => fullLabel(cc, `common-${i}`));
        const details = [];
        const reportItems = ties.map((t, i) =>
          chipRow(
            [T.common, " ", ctx.num(i + 1, formatCount(i + 1)), " (w = ", ctx.num(state.w, formatSetting(state.w)), ")"],
            t.grade,
            pal,
            { cls: "cgc-common", note: ties.length > 1 ? T.tied : null },
          ),
        );
        const packageIndex = sixSitePackageRepresentativeIndex(
          { w: state.w, tau: CONFIG.tau, cap: CONFIG.family.G },
          ties.map((t) => t.grade),
        );
        if (packageIndex >= 0) {
          const chosen = ties[packageIndex];
          const ev = evaluateReport(chosen.grade, ERRORS, { tau: CONFIG.tau, w: cc.w });
          details.push(
            h(
              "p",
              { class: "cgc-note", "data-prx-part": "package-representative" },
              "For this fixed score-B-only setting, the recorded postrank ",
              ...SIX_SITE_PACKAGE_VERSION.flatMap((v, i) => [i ? "." : "", ctx.num(v, formatCount(v))]),
              " run returns common report ",
              ctx.num(packageIndex + 1, formatCount(packageIndex + 1)),
              ": ",
              hookNum("package-grade", chosen.grade, formatGrades),
              "; score-A wrong share ",
              hookNum("package-share-A", ev.EoverN[0], formatShare),
              " and score-A cost ",
              hookNum("package-cost-A", chosen.delta[0]),
              ". Both reports share the smallest risk and remain shown.",
            ),
          );
        }
        for (const r of cc.criteria) {
          const same = r.ownGrades.some((g) => sameGrade(Array.from(g), common));
          const own = same ? [common, ...r.ownGrades.filter((g) => !sameGrade(g, common))] : r.ownGrades;
          for (const [i, g] of own.entries()) {
            reportItems.push(
              chipRow([T.own(LETTERS[r.k]), " ", ctx.num(i + 1, formatCount(i + 1))], g, pal, {
                color: pal.critInk[r.k],
                note: r.ownTieCount === 2 ? "one of two optima" : null,
              }),
            );
            details.push(
              h(
                "p",
                { class: "cgc-note" },
                "Grade vector ",
                hookNum(`own-${r.k}-${i}-grade`, g, formatGrades),
                "; criterion risk ",
                hookNum(`own-${r.k}-${i}-risk`, r.ownRk),
                "; stated pairs ",
                hookNum(`own-${r.k}-${i}-N`, evaluateReport(g, ERRORS, { tau: CONFIG.tau, w: cc.w }).N, formatCount),
                ".",
              ),
            );
          }
          provenance.push(
            fullLabel(cc, `own-${r.k}`),
            h(
              "p",
              { class: "cgc-note" },
              hookNum(`own-${r.k}-tieCount`, r.ownTieCount, formatCount),
              r.ownTieCount === 1 ? " report reaches" : " reports share",
              " this criterion's minimum within equal-risk tolerance ",
              hookNum(`own-${r.k}-tieTol`, cc.common.tieTol, formatSci),
              ".",
            ),
          );
        }

        const profileRows = ties.flatMap((t, i) => {
          const ev = evaluateReport(t.grade, ERRORS, { tau: CONFIG.tau, w: cc.w });
          return cc.criteria.map((r) => [
            hookNum(`common-${i}-grade-${r.k}`, t.grade, formatGrades),
            T.scores[r.k],
            hookNum(`common-${i}-N-${r.k}`, ev.N, formatCount),
            hookNum(`common-${i}-E-${r.k}`, ev.E[r.k], formatExpectedCount),
            hookNum(`common-${i}-share-${r.k}`, ev.EoverN[r.k], formatShare),
            hookNum(`common-${i}-EoverM-${r.k}`, ev.EoverM[r.k], formatShare),
            hookNum(`common-${i}-Rk-${r.k}`, t.Rk[r.k]),
            hookNum(`common-${i}-delta-${r.k}`, t.delta[r.k]),
          ]);
        });

        reports.replaceChildren(ctx.panelTitle(T.reportsTitle), ...reportItems);
        dataBox.body.replaceChildren(
          ...details,
          scrollHint(),
          table("Every tied common report's criterion profile", ["Grade vector", "Criterion", "N", "Eₖ", "Eₖ/N", "Eₖ/M", "Rₖ", "Cost Δₖ"], profileRows),
        );

        const tagLine = h(
          "p",
          { class: "cgc-tag" },
          tagNode(ctx, cc),
          ", each for its own weights. ",
          hookNum("common-tieCount", cc.common.tieCount, formatCount),
          cc.common.tieCount === 1 ? " common report reaches" : " common reports share",
          " the smallest risk within equal-risk tolerance ",
          hookNum("common-tieTol", cc.common.tieTol, formatSci),
          ".",
        );
        if (cc.common.tieCount > ties.length) {
          tagLine.append(" Showing the first ", ctx.num(ties.length, formatCount(ties.length)), " common reports.");
        }

        methodBox.body.replaceChildren(
          tagLine,
          ...provenance,
          h(
            "p",
            { class: "cgc-note" },
            "Grade ",
            ctx.num(1, formatCount(1)),
            " is highest on the declared targets. A shared grade withholds a direction; it does not assert equal underlying scores. E is the expected number of wrong stated directions, N counts stated pairs, and M counts all pairs. Criterion risk Rₖ = (Eₖ + τ(M − N)) / M.",
          ),
          h(
            "p",
            { class: "cgc-note" },
            captionNode(ctx, "package-quantity"),
            ": Δₖ is the extra criterion risk relative to its own minimum in this same family at this same price. It carries no welfare meaning, and a large cost does not by itself say that a weight is wrong.",
          ),
        );
      }

      function drawArchive(state, pal) {
        const C = CONFIG.cost;
        const slotW = Math.round(costSlot.clientWidth || costSlot.getBoundingClientRect?.().width || 0) || 640;
        const narrow = slotW < 460;
        const m = commonalityArchive(state.data === "thirty35" ? 0.35 : 0.25);
        const { facts } = m;
        stageHeading.textContent = T.archiveTitle;

        const data = m.costRows.map((r, k) => ({
          ...r,
          id: `arch-${k}`,
          k,
          score: r.criterion_id,
          own: r.own_best_risk,
          common: r.common_grade_risk,
          midX: (r.own_best_risk + r.common_grade_risk) / 2,
          color: pal.crit[k],
          ink: pal.critInk[k],
        }));

        const fig = plot(costSlot, {
          alt: T.archiveAlt,
          height: C.archiveHeight,
          marginTop: C.marginTop,
          marginBottom: C.marginBottom,
          marginLeft: narrow ? 62 : C.marginLeft,
          marginRight: narrow ? 12 : C.marginRight,
          x: {
            domain: [0, 0.75],
            ticks: narrow ? [0, 0.25, 0.5, 0.75] : [0, 0.15, 0.3, 0.45, 0.6, 0.75],
            insetLeft: narrow ? 32 : C.insetLeft,
            insetRight: narrow ? 34 : C.insetRight,
            label: "risk on that criterion →",
            labelAnchor: "right",
            labelOffset: 34,
            grid: true,
          },
          y: { domain: data.map((r) => r.score), label: null, padding: 0.45, tickSize: 0 },
          table: {
            caption: "Archived common and own criterion risks and optimization cost bounds",
            columns: [
              { label: "Criterion", value: "score" },
              { label: "Own risk", value: "own", format: (v) => formatRisk(v) },
              { label: "Common risk", value: "common", format: (v) => formatRisk(v) },
              { label: "Cost lower", value: "cost_lower", format: (v) => formatRisk(v, { digits: 17 }) },
              { label: "Cost upper", value: "cost_upper", format: (v) => formatRisk(v, { digits: 17 }) },
            ],
            rows: data,
          },
          marks: (c, P) => [
            P.ruleX([m.tau], { stroke: c.plotMuted, strokeDasharray: C.dash }),
            tauHeaderMark(P, c, m.tau),
            P.link(data, { x1: "own", x2: "common", y1: "score", y2: "score", stroke: "color", strokeWidth: 4 }),
            P.dot(data, { x: "own", y: "score", r: C.r, fill: c.plotBg, stroke: "color", strokeWidth: 2.75 }),
            P.dot(data, { x: "common", y: "score", r: C.r, fill: "color", stroke: c.plotBg, strokeWidth: 1.25 }),
            deltaPillMark(P, c, data, {
              rawValuesOf: (d) => d.cost_lower,
              displayOf: (d) => formatReadoutRisk(d.cost_lower),
            }),
            numText(data, {
              x: "own",
              y: "score",
              value: "own",
              format: (v) => formatReadoutRisk(v),
              dx: -13,
              textAnchor: "end",
              fontSize: 13,
              fill: c.plotMuted,
            }),
            numText(data, {
              x: "common",
              y: "score",
              value: "common",
              format: (v) => formatReadoutRisk(v),
              dx: 13,
              textAnchor: "start",
              fontSize: 13,
              fill: c.plotMuted,
            }),
          ],
          keyboard: {
            data,
            x: "common",
            y: "score",
            title: (r) =>
              `${r.score}: own risk ${formatRisk(r.own)}, common risk ${formatRisk(r.common)}, cost interval from optimization bounds ${formatRisk(r.cost_lower, { digits: 17 })} to ${formatRisk(r.cost_upper, { digits: 17 })}; own status ${r.own_status}.`,
          },
        });
        styleCriterionAxisTicks(fig, data.map((r) => r.score), data.map((r) => r.ink));

        const archivedResult = { ...facts, empty: false };
        const status = h(
          "p",
          { class: "cgc-note" },
          labelNode(ctx, archivedResult, { key: "archived-common" }),
          "; status ",
          facts.status,
          "; lower bound ",
          hookNum("archive-lower", facts.lower_bound),
          "; absolute risk gap ",
          hookNum("archive-gap", facts.gap, formatSci),
          "; bound source ",
          h("span", { "data-prx-name": "", text: facts.bound_source }),
          ".",
        );

        reports.replaceChildren(ctx.panelTitle(T.reportsTitle),
          chipRow("The archived common report", m.grade, pal, { ids: m.ids, markNames: true }),
          ...data.map(r => h("p", { class: "cgc-note" }, r.score, " own report: ",
            ctx.num(r.own_G, formatCount(r.own_G)), " grades, ",
            ctx.num(r.own_disclosures, formatCount(r.own_disclosures)), " stated pairs.")),
          h("p", { class: "cgc-note" }, "The archive records the separate reports’ counts and risks. Individual site assignments are available for the common report."));
        dataBox.body.replaceChildren(
          h(
            "p",
            { class: "cgc-note" },
            "Common report: ",
            hookNum("archive-grade", m.grade, formatGrades),
            "; ",
            hookNum("archive-N", facts.N, formatCount),
            " of ",
            hookNum("archive-M", facts.M, formatCount),
            " pairs stated; weighted risk ",
            hookNum("archive-risk", facts.risk),
            ".",
          ),
          scrollHint(),
          table(
            "Archived common criterion profiles",
            ["Criterion", "Weight", "Eₖ", "Eₖ/N", "Eₖ/M", "Rₖ"],
            m.profileRows.map((r, k) => [
              r.criterion,
              hookNum(`archive-${k}-weight`, r.weight, formatSetting),
              hookNum(`archive-${k}-E`, r.E, formatExpectedCount),
              hookNum(`archive-${k}-share`, r.E_over_N, formatShare),
              hookNum(`archive-${k}-EoverM`, r.E_over_M, formatShare),
              hookNum(`archive-${k}-common`, r.risk),
            ]),
          ),
          table(
            "Criterion-specific costs: interval endpoints from optimization bounds",
            ["Criterion", "Own risk", "Own lower bound", "Δ lower", "Δ upper", "Own status", "Own grades", "Own N", "Relation agreement"],
            data.map((r, k) => [
              r.score,
              hookNum(`archive-${k}-own`, r.own),
              hookNum(`archive-${k}-ownLower`, r.own_lower_bound, (v) => formatRisk(v, { digits: 17 })),
              hookNum(`archive-${k}-lower`, r.cost_lower),
              hookNum(`archive-${k}-upper`, r.cost_upper),
              h("span", {}, labelNode(ctx, { status: r.own_status }, { key: `archive-own-${k}` }), "; ", r.own_status),
              hookNum(`archive-${k}-G`, r.own_G, formatCount),
              hookNum(`archive-${k}-N`, r.own_disclosures, formatCount),
              hookNum(`archive-${k}-agreement`, r.relation_agreement, formatShare),
            ]),
          ),
          table(
            "Raw cost interval endpoints (rounding can hide the bound width)",
            ["Criterion", "Lower endpoint", "Upper endpoint"],
            data.map((r, k) => [
              r.score,
              hookNum(`archive-${k}-rawLower`, r.cost_lower, (v) => formatRisk(v, { digits: 17 })),
              hookNum(`archive-${k}-rawUpper`, r.cost_upper, (v) => formatRisk(v, { digits: 17 })),
            ]),
          ),
        );

        methodBox.body.replaceChildren(
          status,
          h(
            "p",
            { class: "cgc-note" },
            "Fixed settings: τ = ",
            hookNum("archive-tau", m.tau, formatSetting),
            "; at most ",
            hookNum("archive-cap", m.cap, formatCount),
            " grades; weights ",
            ...Object.entries(m.weights).flatMap(([name, value], i) => [i ? ", " : "", name, " ", ctx.num(value, formatSetting(value))]),
            ". The saved pr_example_draws analysis uses whole-state draws. The separate thirty-site Gaussian marginal example has different inputs. Live six-site weights do not change this archive.",
          ),
          h(
            "p",
            { class: "cgc-note", text: "The archive gives each criterion’s risk, bounds, solver status and counts. It omits the separate grade vectors, the full sets of ties, and the absolute gaps for the separate solves. Rounded endpoints can coincide even if the bounds differ. A reported gap of zero describes what the solver returned. The intervals bound the optimization result." },
          ),
          h(
            "p",
            { class: "cgc-note" },
            "M counts all pairs; N counts stated pairs; Eₖ counts expected wrong stated directions. Eₖ/N has no denominator for an all-withheld report. Grade ",
            ctx.num(1, formatCount(1)),
            " is the highest target; a shared grade withholds a direction.",
          ),
          h("p", { class: "cgc-note" }, captionNode(ctx, "package-quantity"), ". Measures the increase in reporting risk under the common grades."),
        );

        const costList = data.flatMap((r, k) => [
          k === 0 ? "" : k === data.length - 1 ? ", and " : ", ",
          r.score,
          " ",
          R.risk(r.cost_lower),
        ]);
        if (facts.N > 0) {
          const snapShare = m.profileRows[2]?.E_over_N;
          R.set([
            "Archived common report states ",
            R.count(facts.N),
            " of ",
            R.count(facts.M),
            " pairs; excess risks are ",
            ...costList,
            ...(snapShare !== null && snapShare !== undefined ? [" (snap wrong share ", R.share(snapShare), ")"] : []),
            ".",
          ]);
        } else {
          R.set([
            "Archived common report withholds all ",
            R.count(facts.M),
            " pairs; excess risks are ",
            ...costList,
            ".",
          ]);
        }

        ctx.caption.replaceChildren(
          "Archived pr_example_draws common and own solves (",
          h("span", { class: "cgc-source", "data-prx-name": "", text: m.analysis.source.object }),
          "; ",
          h("span", { class: "cgc-source", "data-prx-name": "", text: m.commonality.source.object }),
          "). ",
          h("span", {}, ...m.notice.split(/(\d+(?:\.\d+)?)/).filter(Boolean).map((t) => (/^\d/.test(t) ? ctx.num(Number(t), t) : t))),
        );
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          source.set(state.data);
          w.set(state.w);
          w.setDisabled(state.data !== "six");
          w.root.style.opacity = state.data === "six" ? "" : "0.55";
          const pal = palette(ctx.root);
          if (state.data !== "six") {
            drawArchive(state, pal);
            return;
          }

          ctx.caption.replaceChildren(
            "Six fictional sites, independent Normal posteriors on scores A and B (τ = ",
            ctx.num(CONFIG.tau, formatSetting(CONFIG.tau)),
            ", at most ",
            ctx.num(CONFIG.family.G, formatCount(CONFIG.family.G)),
            " grades). Synthetic data: CC BY ",
            ctx.num(4, formatDecimal(4, { digits: 1 })),
            ".",
          );
          w.set(state.w);
          const cc = commonalityCost(ERRORS, { tau: CONFIG.tau, w: [state.w, 1 - state.w], family: CONFIG.family });
          const ties = tiedCommons(cc);
          const data = drawLiveCost(cc, ties, pal);
          const tieMatters = data.some((d) => d.alts.length > 0);
          populateLiveDisclosures(state, cc, ties, pal);

          const costRo = (v) => (v > 0 ? R.risk(v) : "nothing");
          if (!tieMatters) {
            const [ra, rb] = cc.criteria;
            R.set([
              "One common report costs score A ",
              costRo(ra.delta),
              " and score B ",
              costRo(rb.delta),
              " more risk than each would pick alone.",
            ]);
            return;
          }

          const n = ties.length;
          const parts = [n === 2 ? "Two" : R.count(n), " common reports tie: "];
          data.forEach((d, i) => {
            if (i) parts.push("; ");
            parts.push(`${d.score} pays `);
            if (!d.alts.length) {
              parts.push(costRo(d.delta), n === 2 ? "" : " under each");
              return;
            }
            if (n === 2) {
              parts.push(R.risk(ties[0].delta[d.k]), " under one and ", R.risk(ties[1].delta[d.k]), " under the other");
              return;
            }
            ties.forEach((t, j) => {
              if (j) parts.push(j === n - 1 ? " and " : ", ");
              parts.push(R.risk(t.delta[d.k]), " under ", h("span", { class: "cgc-nowrap" }, blocksText(t.grade)));
            });
          });
          parts.push(".");
          R.set(parts);
        },
      };
    },
  });
}
