// App entry point for two-denominators (2.14, Frame v2); shared model/views remain in ../shared/domain/two-denominators.js.
export * from "../shared/domain/two-denominators.js";

import { createWidget } from "../shared/base.js";
import { svgScene } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  formatSizes,
  setNum,
  tickLabel,
} from "../shared/format.js";
import { captionNode, ro, tagNode, tieNode } from "../shared/readout.js";
import { evaluateReport, exactOptimum, pairCount } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import { CONFIG, parseAxis, readRaceCard, resolve } from "../shared/domain/two-denominators.js";

const T = CONFIG.text;
const E6 = SIX.arrays.one;
const M6 = pairCount(E6.ids.length);

const STAGE_CSS = `
.prx-den-v2[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: flex-end;
}
.prx-den-v2[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider {
  flex: 1 1 13rem;
  min-width: 9.5rem;
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-panel {
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  padding: 0.6rem 0.75rem 0.7rem;
  min-width: 0;
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-chart {
  min-width: 0;
  max-width: 100%;
}
.prx-den-v2[data-prx-frame="v2"] .den-summary {
  display: grid;
  gap: 0.25rem;
  margin: 0 0 0.55rem;
  font-size: 0.88rem;
  line-height: 1.4;
}
.prx-den-v2[data-prx-frame="v2"] .den-row-line,
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-zero {
  margin: 0;
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-zero {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--prx-plot-muted);
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-tie-box {
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--prx-cell-border);
  font-size: 0.86rem;
}
.prx-den-v2[data-prx-frame="v2"] .prx-stage .den-tie-box p {
  margin: 0.2rem 0 0;
}
.prx-den-v2[data-prx-frame="v2"] .den-method p,
.prx-den-v2[data-prx-frame="v2"] .den-data-notes p {
  margin: 0 0 0.45rem;
}
.prx-den-v2[data-prx-frame="v2"] .den-method p:last-child,
.prx-den-v2[data-prx-frame="v2"] .den-data-notes p:last-child {
  margin-bottom: 0;
}
.prx-den-v2[data-prx-frame="v2"] .den-formula {
  font-variant-numeric: tabular-nums;
}
.prx-den-v2[data-prx-frame="v2"] .den-notice {
  font-size: 0.82rem;
  color: var(--prx-fg-muted);
  margin: 0.5rem 0 0;
  overflow-wrap: anywhere;
}
@media (max-width: 30rem) {
  .prx-den-v2[data-prx-frame="v2"] .prx-stage .den-panel {
    padding: 0.45rem 0.55rem 0.6rem;
  }
}
`;

function readoutTauDisplay(tau, from) {
  const s = formatSetting(tau);
  if (from === "tau" || /^[+−-]?\d+\/\d+$/u.test(s)) return s;
  const m = /^[+−-]?(?:(\d+)\.(\d+)|\.(\d+))$/u.exec(s);
  if (!m) return s;
  const digits = ((m[1] ?? "") + (m[2] ?? m[3] ?? "")).replace(/^0+/, "");
  return digits.length <= 3 ? s : formatReadoutRisk(tau);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    frame: "v2",
    className: "prx-den prx-den-v2",
    css: STAGE_CSS,
    title: "Wrong among stated, wrong among all",
    keys: {
      lambda: { type: "custom", value: null, parse: parseAxis(0.01, 1) },
      tau: { type: "custom", value: 0.25, parse: parseAxis(0.01, 0.5) },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const num = (raw, display, name) => {
        const node = ctx.num(raw, display);
        if (name) node.setAttribute("data-prx-readout", name);
        return node;
      };
      const set = (raw, name) => num(raw, formatSetting(raw), name);
      const grades = (g, name) => num(Array.from(g), formatGrades(Array.from(g)), name);
      const base = {
        one: () => ctx.num(1, formatCount(1)),
        two: () => ctx.num(2, formatCount(2)),
      };
      const fill = (parts, slots = {}) => parts.flatMap((p) => {
        const m = /^\{(\w+)\}$/.exec(p);
        return m ? [].concat((slots[m[1]] ?? base[m[1]])()) : [p];
      });

      // Both linked sliders directly in ctx.controls (browser test contract: grade-report-details.test.mjs:60-72)
      const lambdaSlider = ctx.slider({
        label: "KRW's reward λ",
        ...CONFIG.lambda,
        value: resolve(ctx.state).lambda,
        name: "lambda",
        onInput: (v) => ctx.set({ lambda: v, tau: null }),
      });
      const tauSlider = ctx.slider({
        label: "Withholding cost τ",
        ...CONFIG.tau,
        value: resolve(ctx.state).tau,
        name: "tau",
        onInput: (v) => ctx.set({ tau: v, lambda: null }),
      });
      ctx.controls.append(lambdaSlider.root, ctx.primaryControl(tauSlider.root));

      // Stage: true 13px two-denominator SVG graphic + concise summary + visible N = 0 contract line
      const chartHost = ctx.primaryGraphic(h("div", { class: "den-chart" }));
      const summaryBox = h("div", { class: "den-summary" });
      const tieSlot = h("section", { class: "den-tie-box", "aria-label": "Equal-risk six-site reports", hidden: true });
      const zeroScope = h(
        "p",
        { class: "den-zero" },
        "At N = ",
        ctx.num(0, formatCount(0)),
        ", DR is ",
        ctx.num(0, formatCount(0)),
        " while E/N has no defined value (",
        ctx.num(null, formatShare(null)),
        ").",
      );
      const currentIdentity = h("div", { "data-prx-denominator-identity": "" });
      const panel = h(
        "section",
        { class: "den-panel prx-light-panel", "aria-label": T.denHead },
        chartHost,
        tieSlot,
        currentIdentity,
        zeroScope,
      );
      ctx.stage.append(panel);

      // Disclosures: summary + Data table + provenance in Data; identity lines + KRW risk conversion in Method
      const dataBox = ctx.dataBox("Data and exact values");
      const methodBox = ctx.methodBox("Method and identity");
      const denTableWrap = ctx.scrollRegion(h("div", { class: "den-table-wrap" }), T.denHead);
      const dataNotes = h("div", { class: "den-data-notes" });
      dataBox.body.append(summaryBox, denTableWrap, dataNotes);

      const methodBody = h("div", { class: "den-method" });
      methodBox.body.append(methodBody);

      const krw = readRaceCard();
      if (!ctx.doc.querySelector('meta[name="quarto:offset"]')) {
        ctx.root.append(
          h("p", {
            class: "den-notice",
            text: "Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700; replication deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; as adapted in postrank 1.1.0 (pr_case_krw), changes noted. Risks recomputed on released pair probabilities; archived card statistics retained. No endorsement is implied. Provided as is, without warranty. The data describe KRW's correspondence experiment, not any firm's current conduct.",
          }),
        );
      }
      ctx.caption.replaceChildren("Six fictional sites: ", captionNode(ctx, "teaching-posterior"), ".");

      function drawGraphic(r, opt) {
        const ev = opt.evaluation;
        const sixDR = ev.EoverM[0];
        const sixEN = ev.EoverN[0];
        const maxX = CONFIG.bars.max;
        const ticks = [0, 0.05, 0.1, 0.15];

        const srRows = [
          {
            report: "Six-site best report (moves)",
            N: ev.N,
            M: M6,
            s: ev.s,
            dr: sixDR,
            en: sixEN,
          },
          ...(krw
            ? [{
                report: "KRW race card (fixed)",
                N: krw.N,
                M: krw.M,
                s: krw.s,
                dr: krw.DR,
                en: krw.EoverN,
              }]
            : []),
        ];

        svgScene(
          chartHost,
          {
            height: 262,
            minWidth: 256,
            alt: T.denCaption,
            table: {
              caption: "Expected wrong directions under the two denominators",
              columns: [
                { label: T.colReport, value: "report" },
                { label: "Stated pairs N", value: "N", format: (v) => formatCount(v) },
                { label: "All pairs M", value: "M", format: (v) => formatCount(v) },
                { label: T.colS, value: "s", format: (v) => formatShare(v) },
                { label: T.colDR, value: "dr", format: (v) => formatShare(v) },
                { label: T.colEN, value: "en", format: (v) => formatShare(v) },
              ],
              rows: srRows,
            },
          },
          (scene) => {
            const { width, palette: pal } = scene;
            const narrow = width < 520;
            const left = narrow ? 96 : 136;
            const right = 54;
            const innerW = Math.max(80, width - left - right);
            const xPx = (v) => left + (Math.min(maxX, Math.max(0, v)) / maxX) * innerW;

            const sixLabel = narrow ? "Six sites" : "Six sites (moves)";
            const krwLabel = narrow ? "KRW card" : "KRW card (fixed)";
            const hatchFill = scene.hatchDef("den-krw-hatch");

            // Grid lines and bottom axis
            for (const tv of ticks) {
              const x = xPx(tv);
              scene.add(
                scene.el("line", { x1: x, y1: 34, x2: x, y2: 206, stroke: pal.plotGrid, strokeWidth: 1 }),
                scene.el("line", { x1: x, y1: 206, x2: x, y2: 211, stroke: pal.plotAxis, strokeWidth: 1 }),
                scene.numText(
                  { x, y: 226, textAnchor: "middle", fill: pal.plotAxis },
                  tv,
                  tickLabel(tv, ticks.indexOf(tv), ticks),
                ),
              );
            }
            scene.add(
              scene.el("line", { x1: left, y1: 206, x2: left + innerW, y2: 206, stroke: pal.plotAxis, strokeWidth: 1 }),
              scene.el("text", {
                x: left + innerW / 2,
                y: 250,
                textAnchor: "middle",
                fill: pal.plotFg,
                text: "Expected wrong directions per pair",
              }),
            );

            // Background connector tapers showing multiplication by s = N/M (drawn behind Band 2 title & bars)
            const connectorBg = scene.el("g", { "aria-hidden": "true" });
            if (sixEN !== null && sixEN !== undefined) {
              connectorBg.append(
                scene.el("line", {
                  x1: xPx(sixEN),
                  y1: 57,
                  x2: xPx(sixDR),
                  y2: 151,
                  stroke: pal.err,
                  strokeWidth: 1.5,
                  strokeOpacity: 0.72,
                }),
              );
            }
            if (krw) {
              connectorBg.append(
                scene.el("line", {
                  x1: xPx(krw.EoverN),
                  y1: 85,
                  x2: xPx(krw.DR),
                  y2: 179,
                  stroke: pal.plotAxis,
                  strokeWidth: 1.4,
                  strokeDasharray: "4,3",
                  strokeOpacity: 0.7,
                }),
              );
            }
            scene.add(connectorBg);

            // Band 1: Wrong among stated (E/N)
            scene.add(
              scene.el("text", {
                x: 4,
                y: 20,
                textAnchor: "start",
                fontWeight: "600",
                fill: pal.plotFg,
                text: narrow ? "Wrong among stated (E/N)" : "Wrong among stated: E/N (over N stated pairs)",
              }),
              scene.el("text", {
                x: left - 8,
                y: 48,
                dy: "0.35em",
                textAnchor: "end",
                fill: pal.plotFg,
                text: sixLabel,
              }),
              scene.el("rect", {
                x: left,
                y: 39,
                width: innerW,
                height: 18,
                rx: 2,
                fill: pal.plotGrid,
                fillOpacity: 0.65,
              }),
            );

            if (sixEN === null || sixEN === undefined) {
              scene.add(
                scene.numText(
                  { x: left + 6, y: 48, dy: "0.35em", textAnchor: "start", fill: pal.plotMuted, fontStyle: "italic" },
                  null,
                  formatShare(null),
                ),
              );
            } else {
              const barW = Math.max(2, xPx(sixEN) - left);
              scene.add(
                scene.el("rect", {
                  x: left,
                  y: 39,
                  width: barW,
                  height: 18,
                  rx: 2,
                  fill: pal.err,
                  fillOpacity: 0.28,
                  stroke: pal.err,
                  strokeWidth: 1.6,
                }),
                scene.numText(
                  { x: left + barW + 6, y: 48, dy: "0.35em", textAnchor: "start", fill: pal.plotFg, fontWeight: "600" },
                  sixEN,
                  formatShare(sixEN),
                ),
              );
            }

            if (krw) {
              const krwEnW = Math.max(2, xPx(krw.EoverN) - left);
              scene.add(
                scene.el("text", {
                  x: left - 8,
                  y: 76,
                  dy: "0.35em",
                  textAnchor: "end",
                  fill: pal.plotMuted,
                  text: krwLabel,
                }),
                scene.el("rect", {
                  x: left,
                  y: 67,
                  width: innerW,
                  height: 18,
                  rx: 2,
                  fill: pal.plotGrid,
                  fillOpacity: 0.65,
                }),
                scene.el("rect", {
                  x: left,
                  y: 67,
                  width: krwEnW,
                  height: 18,
                  rx: 2,
                  fill: hatchFill,
                  stroke: pal.plotAxis,
                  strokeWidth: 1.4,
                  strokeDasharray: "4,2",
                }),
                scene.numText(
                  { x: left + krwEnW + 6, y: 76, dy: "0.35em", textAnchor: "start", fill: pal.plotMuted, fontWeight: "600" },
                  krw.EoverN,
                  formatShare(krw.EoverN),
                ),
              );
            }

            // Band 2: Wrong among all (DR = E/M = s * E/N)
            const sixDrW = sixDR > 0 ? Math.max(2, xPx(sixDR) - left) : 0;
            const band2Title = narrow
              ? "Wrong among all (DR = E/M)"
              : "Wrong among all: DR = E/M = (N/M) × E/N (over all M pairs)";
            const band2BgW = Math.min(width - 6, Math.ceil(band2Title.length * 7.1) + 8);
            scene.add(
              scene.el("rect", {
                x: 2,
                y: 118,
                width: band2BgW,
                height: 19,
                rx: 3,
                fill: pal.plotBg,
              }),
              scene.el("text", {
                x: 4,
                y: 132,
                textAnchor: "start",
                fontWeight: "600",
                fill: pal.plotFg,
                stroke: pal.plotBg,
                strokeWidth: 4,
                strokeLinejoin: "round",
                paintOrder: "stroke",
                text: band2Title,
              }),
              scene.el("text", {
                x: left - 8,
                y: 160,
                dy: "0.35em",
                textAnchor: "end",
                fill: pal.plotFg,
                text: sixLabel,
              }),
              scene.el("rect", {
                x: left,
                y: 151,
                width: innerW,
                height: 18,
                rx: 2,
                fill: pal.plotGrid,
                fillOpacity: 0.65,
              }),
              sixDrW > 0
                ? scene.el("rect", {
                    x: left,
                    y: 151,
                    width: sixDrW,
                    height: 18,
                    rx: 2,
                    fill: pal.err,
                  })
                : null,
              scene.numText(
                { x: left + sixDrW + 6, y: 160, dy: "0.35em", textAnchor: "start", fill: pal.plotFg, fontWeight: "600" },
                sixDR,
                formatShare(sixDR),
              ),
            );

            if (krw) {
              const krwDrW = Math.max(2, xPx(krw.DR) - left);
              scene.add(
                scene.el("text", {
                  x: left - 8,
                  y: 188,
                  dy: "0.35em",
                  textAnchor: "end",
                  fill: pal.plotMuted,
                  text: krwLabel,
                }),
                scene.el("rect", {
                  x: left,
                  y: 179,
                  width: innerW,
                  height: 18,
                  rx: 2,
                  fill: pal.plotGrid,
                  fillOpacity: 0.65,
                }),
                scene.el("rect", {
                  x: left,
                  y: 179,
                  width: krwDrW,
                  height: 18,
                  rx: 2,
                  fill: pal.neutral[4],
                  stroke: pal.plotAxis,
                  strokeWidth: 1.2,
                }),
                scene.numText(
                  { x: left + krwDrW + 6, y: 188, dy: "0.35em", textAnchor: "start", fill: pal.plotMuted, fontWeight: "600" },
                  krw.DR,
                  formatShare(krw.DR),
                ),
              );
            }
          },
        );
      }

      function drawStageSummaryAndDisclosures(r, opt) {
        const ev = opt.evaluation;
        const sixDR = ev.EoverM[0];
        const sixEN = ev.EoverN[0];
        const sixE = ev.E[0];

        // Concise stage summary lines keeping primary comparison & benchmark hooks visible
        const sixLine = h(
          "p",
          { class: "den-row-line" },
          "Six sites (τ = ",
          set(r.tau, "den-tau"),
          ", report ",
          grades(opt.grade, "den-grades"),
          "): ",
          num(ev.N, formatCount(ev.N), "den-six-N"),
          " of ",
          num(M6, formatCount(M6), "den-six-M"),
          " pairs stated (s = ",
          num(ev.s, formatShare(ev.s), "den-six-s"),
          "), DR ",
          num(sixDR, formatShare(sixDR), "den-six-dr"),
          ", E/N ",
          num(sixEN, formatShare(sixEN), "den-six-en"),
          ".",
        );

        const summaryRows = [sixLine];
        if (krw) {
          summaryRows.push(
            h(
              "p",
              { class: "den-row-line" },
              "KRW race card (",
              num(krw.sizes, formatSizes(krw.sizes), "den-card-sizes"),
              ", λ = ",
              set(krw.lambda, "den-card-lambda"),
              ", τ = ",
              set(krw.tau, "den-card-tau"),
              "): ",
              num(krw.N, formatCount(krw.N), "den-card-N"),
              " of ",
              num(krw.M, formatCount(krw.M), "den-card-M"),
              " stated (s = ",
              num(krw.s, formatShare(krw.s), "den-card-s"),
              "), DR ",
              num(krw.DR, formatShare(krw.DR), "den-card-dr"),
              ", E/N ",
              num(krw.EoverN, formatShare(krw.EoverN), "den-card-en"),
              " (KRW risk ",
              num(krw.krw, formatRisk(krw.krw), "card-krwrisk"),
              ", postrank risk ",
              num(krw.risk, formatRisk(krw.risk), "card-risk"),
              ").",
            ),
          );
        }
        summaryBox.replaceChildren(...summaryRows);

        // Equal-risk boundary ties (visible only at tie boundaries)
        tieSlot.hidden = opt.tieCount <= 1;
        tieSlot.replaceChildren();
        if (opt.tieCount > 1) {
          const tied = opt.grades.map((g) => ({ grade: Array.from(g), ev: evaluateReport(g, E6, { tau: r.tau }) }));
          tieSlot.append(
            h(
              "p",
              {},
              num(opt.tieCount, formatCount(opt.tieCount), "den-tie-count"),
              " reports share the minimum risk within equal-risk tolerance ",
              num(opt.tieTol, formatSci(opt.tieTol), "den-tie-tolerance"),
              ". The six-site bars show the first; every tied report is listed below.",
            ),
            ...tied.map((t, i) => h(
              "p",
              {},
              grades(t.grade, `den-tie-${i}-grades`),
              " · N = ",
              num(t.ev.N, formatCount(t.ev.N), `den-tie-${i}-N`),
              " · DR = ",
              num(t.ev.EoverM[0], formatShare(t.ev.EoverM[0]), `den-tie-${i}-dr`),
              " · E/N = ",
              num(t.ev.EoverN[0], formatShare(t.ev.EoverN[0]), `den-tie-${i}-en`),
            )),
          );
          if (new Set(tied.map((t) => t.ev.N)).size > 1) {
            tieSlot.append(captionNode(ctx, "different-disclosure"));
          }
        }

        // Data disclosure: exact comparison table + provenance tags
        const krwE = krw ? krw.DR * krw.M : null;
        const thead = h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { scope: "col", text: T.colReport }),
            h("th", { scope: "col", text: "Stated N" }),
            h("th", { scope: "col", text: "All M" }),
            h("th", { scope: "col", text: T.colS }),
            h("th", { scope: "col", text: "Expected wrong E" }),
            h("th", { scope: "col", text: T.colDR }),
            h("th", { scope: "col", text: T.colEN }),
          ),
        );
        const tbody = h(
          "tbody",
          {},
          h(
            "tr",
            {},
            h("th", { scope: "row", text: "Six-site best report (moves)" }),
            h("td", {}, ctx.num(ev.N, formatCount(ev.N))),
            h("td", {}, ctx.num(M6, formatCount(M6))),
            h("td", {}, ctx.num(ev.s, formatShare(ev.s))),
            h("td", {}, ctx.num(sixE, formatExpectedCount(sixE))),
            h("td", {}, ctx.num(sixDR, formatShare(sixDR))),
            h("td", {}, ctx.num(sixEN, formatShare(sixEN))),
          ),
          krw
            ? h(
                "tr",
                {},
                h("th", { scope: "row", text: "KRW race card (fixed)" }),
                h("td", {}, ctx.num(krw.N, formatCount(krw.N))),
                h("td", {}, ctx.num(krw.M, formatCount(krw.M))),
                h("td", {}, ctx.num(krw.s, formatShare(krw.s))),
                h("td", {}, ctx.num(krwE, formatExpectedCount(krwE))),
                h("td", {}, ctx.num(krw.DR, formatShare(krw.DR))),
                h("td", {}, ctx.num(krw.EoverN, formatShare(krw.EoverN))),
              )
            : null,
        );
        denTableWrap.replaceChildren(
          h(
            "table",
            { class: "prx-table prx-sticky-first" },
            h("caption", { text: "Exact counts and error rates for both reports" }),
            thead,
            tbody,
          ),
        );
        dataNotes.replaceChildren(
          h("p", {}, "Six-site report: ", tagNode(ctx, opt), "."),
          krw ? h("p", {}, "KRW benchmark: ", captionNode(ctx, "krw-card"), ".") : null,
        );

        // Method disclosure: algebraic identity lines + KRW risk conversion + archived belief note
        const identityLine = (label, sVal, drVal, enVal, prefix) => {
          if (enVal === null || enVal === undefined) {
            return h("p", { class: "den-formula" }, label, ": E/N = ", num(enVal, formatShare(enVal), `${prefix}-bar-en`), ".");
          }
          const same = formatShare(Number(formatShare(sVal)) * Number(formatShare(enVal))) === formatShare(drVal);
          return h(
            "p",
            { class: "den-formula" },
            label,
            ": DR = (N/M) × E/N = ",
            num(sVal, formatShare(sVal), `${prefix}-bar-s`),
            " × ",
            num(enVal, formatShare(enVal), `${prefix}-bar-en`),
            same ? " = " : " ≈ ",
            num(drVal, formatShare(drVal), `${prefix}-bar-dr`),
            ".",
          );
        };

        currentIdentity.replaceChildren(identityLine("Six-site report", ev.s, sixDR, sixEN, "den-six"));
        const methodItems = [];
        if (krw) {
          methodItems.push(
            identityLine("KRW race card", krw.s, krw.DR, krw.EoverN, "den-card"),
            h(
              "p",
              {},
              ...fill(T.cardRisks, {
                lambda: () => set(krw.lambda, "card-lambda"),
                krw: () => ctx.num(krw.krw, formatRisk(krw.krw)),
                tau: () => set(krw.tau, "card-tau"),
                risk: () => ctx.num(krw.risk, formatRisk(krw.risk)),
                tau2: () => ctx.num(krw.tau, formatSetting(krw.tau)),
                tau3: () => ctx.num(krw.tau, formatSetting(krw.tau)),
                krw2: () => ctx.num(krw.krw, formatRisk(krw.krw)),
                taubar: () => num(krw.taubar, formatDecimal(krw.taubar, { digits: 4 }), "card-taubar"),
              }),
              " (",
              captionNode(ctx, "fixed-report"),
              ")",
            ),
            h("p", { text: T.cardBelief }),
          );
        } else {
          methodItems.push(h("p", { text: T.noKrw }));
        }
        methodItems.push(
          h(
            "p",
            {},
            "λ = ",
            ctx.num(0, formatCount(0)),
            " is an endpoint outside postrank, which needs τ above ",
            ctx.num(0, formatCount(0)),
            "; τ = λ/(",
            ctx.num(1, formatCount(1)),
            " + λ), and bar tracks run from ",
            ctx.num(0, formatCount(0)),
            " to ",
            ctx.num(CONFIG.bars.max, formatSetting(CONFIG.bars.max)),
            ".",
          ),
        );
        methodBody.replaceChildren(...methodItems);
      }

      return {
        render(state, info = {}) {
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const r = resolve(state);
            lambdaSlider.set(r.lambda);
            tauSlider.set(r.tau);
            if (r.tau < CONFIG.tau.min) {
              setNum(tauSlider.output, r.tau, formatSetting(r.tau));
              tauSlider.input.setAttribute("aria-valuetext", formatSetting(r.tau));
            }
            const opt = exactOptimum(E6, { tau: r.tau, family: { kind: "all" } });
            drawGraphic(r, opt);
            drawStageSummaryAndDisclosures(r, opt);

            const ev = opt.evaluation;
            const dr = ev.EoverM[0];
            const en = ev.EoverN[0];
            const tauText = readoutTauDisplay(r.tau, r.from);
            const at = r.from === "lambda"
              ? [
                  "At λ = ",
                  w.setting(r.lambda, { hook: "den-ro-lambda" }),
                  " (τ = ",
                  w.num(r.tau, tauText, { hook: "den-ro-tau" }),
                  "),",
                ]
              : [
                  "At τ = ",
                  w.num(r.tau, tauText, { hook: "den-ro-tau" }),
                  ",",
                ];

            const sixPart = [
              ...at,
              " six-site best report",
              tieNode(ctx, opt) ?? "",
              " states ",
              w.count(ev.N, { hook: "den-ro-N" }),
              " of ",
              w.count(M6),
              " pairs (s = ",
              w.share(ev.s, { hook: "den-ro-s" }),
              "): ",
              ...(en === null || en === undefined
                ? ["DR ", w.count(0), ", E/N ", w.share(null), "."]
                : ["DR ", w.share(dr, { hook: "den-ro-dr" }), ", E/N ", w.share(en, { hook: "den-ro-en" }), "."]),
            ];

            if (!krw) {
              w.set([...sixPart, " ", T.noKrw]);
              return;
            }
            w.set([
              ...sixPart,
              " Fixed KRW card: s = ",
              w.share(krw.s, { hook: "den-ro-card-s" }),
              ", DR ",
              w.share(krw.DR, { hook: "den-ro-card-dr" }),
              ", E/N ",
              w.share(krw.EoverN, { hook: "den-ro-card-en" }),
              ".",
            ]);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
