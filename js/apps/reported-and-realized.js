// Conditional-law sensitivity and repeated observations at a fixed league truth are separate experiments.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatProb,
  formatReadoutProb,
  formatSci,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  LEAGUE_SEED,
  drawLeague,
  errorArray,
  evaluateReport,
  fixedOrderDP,
  gaussianDraws,
  league30,
  leagueGradingReplays,
  maxCoefficientError,
  normalPosterior,
  realizedWrong,
  runningMean,
  weightedRadius,
} from "../pr-core.js";
import { CONFIG as SHRINKAGE_CONFIG } from "../shared/domain/shrinkage.js";
import {
  CONFIG as DRAW_CONFIG,
  createDrawControls,
  drawHistogram,
  drawRunningAverage,
} from "../shared/domain/disclosed-errors.js";

export const CONFIG = Object.freeze({
  name: "reported-and-realized",
  className: "prx-rr",
  priorSd: SHRINKAGE_CONFIG.priorSd,
  referenceSd: 0.15,
  replays: { min: 3, max: 100, step: 1, value: 20 },
  replay: { min: 1, max: 100, step: 1, value: 1 },
  tau: { min: 0.01, max: 0.5, step: 0.01, value: 0.2 },
  cap: { min: 1, max: 5, step: 1, value: 3 },
  draws: { min: 0, max: 2000, step: 1, value: 100 },
  seed: { min: 0, max: 999999, step: 1, value: 1 },
});

const L = league30();
const cache = new Map();
const drawCache = new Map();
const share = (v) => formatShare(v);
const prob4 = (v) => formatProb(v, { digits: 4 });
const tableDec3 = (v) => (v !== 0 && Math.abs(v) < 5e-4 ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits: 3 }));

/** The report is selected anew per observation replay, then held fixed when the law changes. */
export function replayComparison({ priorSd = 0.15, tau = 0.2, cap = 3, replays = 20 } = {}) {
  const key = JSON.stringify([priorSd, tau, cap, replays]);
  if (cache.has(key)) return cache.get(key);
  const simulation = leagueGradingReplays(LEAGUE_SEED, { priorSd, tau, cap, replays });
  const rows = simulation.draws.map((d) => {
    const estimate = drawLeague(d.seed).estimate;
    const assumed = normalPosterior(estimate, L.se, { priorSd });
    const reference = normalPosterior(estimate, L.se, { priorSd: CONFIG.referenceSd });
    const claimedErrors = errorArray(assumed.mean, assumed.sd, { ids: L.ids, criteria: ["league value"] });
    const referenceErrors = errorArray(reference.mean, reference.sd, { ids: L.ids, criteria: ["league value"] });
    const evaluation = evaluateReport(d.grade, referenceErrors, { tau });
    const coefficient = maxCoefficientError(claimedErrors, referenceErrors);
    const delta = weightedRadius(coefficient.epsilon, [1]);
    return {
      ...d,
      estimate,
      assumed,
      reference,
      claimedErrors,
      referenceErrors,
      evaluation,
      coefficient,
      delta,
      referenceShare: evaluation.EoverN[0],
      shareGap: d.N ? Math.abs(d.EoverN - evaluation.EoverN[0]) : null,
    };
  });
  const out = { simulation, rows };
  cache.set(key, out);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return out;
}

/** Posterior draws change latent values; unlike the observation replays they do not hold theta fixed. */
export function conditionalDraws(row, { drawLaw = "reference", seed = 1, draws = 100 } = {}) {
  const key = JSON.stringify([row.seed, row.assumed.mean, Array.from(row.grade), drawLaw, seed, draws]);
  if (drawCache.has(key)) return drawCache.get(key);
  const law = drawLaw === "reference" ? row.reference : row.assumed;
  const counts = draws ? gaussianDraws(law.mean, law.sd, draws, seed).map((theta) => realizedWrong(row.grade, theta).D[0]) : [];
  const out = { counts, mean: draws ? runningMean(counts).at(-1) : null, E: drawLaw === "reference" ? row.evaluation.E[0] : row.E };
  drawCache.set(key, out);
  if (drawCache.size > 12) drawCache.delete(drawCache.keys().next().value);
  return out;
}

const CSS = `
.prx-rr .prx-stage > * { grid-area: auto; min-width: 0; }
.prx-widget.prx-rr[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.85rem;
  flex: 1 1 20rem;
}
.prx-widget.prx-rr[data-prx-frame="v2"] .prx-controls > .prx-slider { max-width: none; min-width: 0; }
@media (min-width: 56rem) {
  .prx-rr .prx-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 0.9rem 1.25rem;
    align-items: start;
  }
  .prx-rr .prx-stage > .prx-rr-section {
    margin-top: 0;
    padding-top: 0;
    padding-left: 1.1rem;
    border-top: 0;
    border-left: 1px solid var(--prx-plot-grid);
  }
}
@media (max-width: 48em) {
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-toolbar { gap: 0.3rem 0.5rem; margin-bottom: 0.3rem; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-toolbar > .prx-controls { gap: 0.25rem 0.55rem; width: 100%; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-controls .prx-slider-head { font-size: 0.78125rem; white-space: nowrap; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-presets { width: 100%; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-presets .prx-seg-label { display: none; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.15rem 0.35rem;
    font-size: 0.76rem;
    line-height: 1.15;
  }
}
@media (max-width: 560px) {
  .prx-widget.prx-rr[data-prx-frame="v2"] { padding: 0.4rem; }
  .prx-widget.prx-rr[data-prx-frame="v2"] .prx-stage { padding: 0.35rem 0.45rem; }
  .prx-widget.prx-rr[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.3rem; padding: 0.35rem 0.5rem; font-size: 0.875rem; line-height: 1.3; }
}
.prx-rr .prx-stage .prx-rr-left { min-width: 0; }
.prx-rr .prx-stage .prx-rr-boundline {
  margin: 0.15rem 0 0;
  padding: 0.2rem 0.45rem;
  font-size: 0.8125rem;
  line-height: 1.25;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-left: 3px solid var(--prx-plot-axis);
}
.prx-rr .prx-stage .prx-rr-section {
  margin-top: 0.35rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.prx-rr .prx-rr-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.6rem;
  padding: 0.15rem 0.25rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  font-size: 0.8125rem;
}
.prx-rr .prx-rr-legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.prx-rr .prx-rr-legend strong { font-variant-numeric: tabular-nums; }
.prx-rr .prx-rr-solid { width: 1.15rem; border-top: 2px solid var(--prx-plot-fg); }
.prx-rr .prx-rr-dash { width: 1.15rem; border-top: 2px dashed var(--prx-plot-muted); }
.prx-rr .prx-rr-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  border: 2px solid var(--prx-plot-fg);
  background: var(--prx-plot-bg);
}
.prx-rr .prx-stage .prx-rr-replay-details {
  margin: 0.35rem 0 0;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-cell-border);
}
.prx-rr .prx-stage .prx-rr-replay-details > summary {
  padding: 0.4rem 0;
  font-size: 0.84375rem;
}
.prx-rr .prx-rr-note { font-size: 0.89em; color: var(--prx-fg-muted); margin: 0.4rem 0; }
.prx-rr .prx-rr-draws-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--prx-border);
}
.prx-rr .prx-de-draw-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.6rem 1rem;
  margin: 0.5rem 0;
}
.prx-rr .prx-de-draw-buttons { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.prx-rr .prx-rr-grade {
  margin: 0.35rem 0;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--prx-border);
  border-radius: 4px;
  overflow-wrap: anywhere;
}
.prx-rr .prx-rr-scroll { max-width: 100%; overflow-x: auto; margin: 0.5rem 0; }
.prx-rr table {
  width: 100%;
  min-width: 35rem;
  border-collapse: collapse;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.prx-rr th, .prx-rr td { padding: 0.35rem 0.5rem; text-align: left; border-bottom: 1px solid var(--prx-border); }
.prx-rr caption { text-align: left; padding: 0.35rem 0; color: var(--prx-fg-muted); }
.prx-rr tr[aria-current="true"] { background: var(--prx-bg-sunken); font-weight: 600; }
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: CONFIG.className,
    frame: "v2",
    label: "Reported and realized error: a report under two declared conditional laws, observation replays at fixed truth, and separate posterior draws.",
    css: CSS,
    keys: {
      priorSd: { type: "number", ...CONFIG.priorSd },
      tau: { type: "number", ...CONFIG.tau },
      cap: { type: "integer", ...CONFIG.cap },
      replays: { type: "integer", ...CONFIG.replays },
      replay: { type: "integer", ...CONFIG.replay },
      drawLaw: { type: "choice", values: ["reference", "assumed"], value: "reference" },
      draws: { type: "integer", ...CONFIG.draws },
      seed: { type: "integer", ...CONFIG.seed },
    },
    build(ctx) {
      const { h } = ctx;
      const hookNum = (name, v, f = formatCount) => {
        const n = ctx.num(v, f(v));
        n.dataset.prxReadout = name;
        return n;
      };

      // Primary controls: Assumed prior SD + Inspect replay
      const prior = ctx.slider({
        label: "Assumed prior SD",
        ...ctx.key("priorSd"),
        format: formatSetting,
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      prior.root.classList.add("prx-rr-prior");
      ctx.primaryControl(prior.input);
      const selected = ctx.slider({
        label: "Inspect replay",
        ...ctx.key("replay"),
        onInput: (v) => ctx.set({ replay: v }),
      });
      ctx.controls.append(prior.root, selected.root);

      // Settings disclosure: secondary parameters (tau, cap, total replays)
      const tau = ctx.slider({ label: "Withholding cost τ", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      const cap = ctx.slider({ label: "Maximum grades", ...ctx.key("cap"), onInput: (v) => ctx.set({ cap: v }) });
      const total = ctx.numberInput({
        label: "Observation replays",
        ...ctx.key("replays"),
        onInput: (v) => {
          if (Number.isFinite(v)) ctx.set({ replays: Math.round(v) });
        },
      });
      ctx.settingsBox("Settings").body.append(tau.root, cap.root, total.root);

      // Primary stage: (1) Claim vs Reference vs Fixed-truth bar/dot comparison + 1-line bound strip,
      // (2) linked 20-replay strip (.prx-rr-section) + collapsible 20-row replay table
      const comparison = h("div");
      const boundLine = h("p", { class: "prx-rr-boundline" });

      const replayValues = { claim: h("strong"), reference: h("strong"), realized: h("strong") };
      const replayLegend = h(
        "div",
        { class: "prx-rr-legend", "data-prx-part": "legend", "aria-label": "Wrong shares for the selected replay" },
        h("span", {}, h("i", { class: "prx-rr-solid" }), "Claim ", replayValues.claim),
        h("span", {}, h("i", { class: "prx-rr-dash" }), "Ref. ", replayValues.reference),
        h("span", {}, h("i", { class: "prx-rr-dot" }), "Truth ", replayValues.realized)
      );
      const replayPlot = h("div");
      let focusedReplay = null;
      ctx.listen(replayPlot, "click", (event) => {
        // The chart routes pointer clicks itself. A native keyboard activation has detail 0.
        if (event.detail === 0 && event.target.matches(".prx-kbd-point") && focusedReplay !== null) {
          ctx.set({ replay: focusedReplay });
        }
      });

      const replayDetails = h(
        "details",
        { class: "prx-disclosure prx-rr-replay-details" },
        h("summary", { class: "prx-disclosure-summary" }, "Read every replay’s numbers")
      );
      const replayTable = ctx.scrollRegion(h("div", { class: "prx-rr-scroll" }), "Error shares of the observation replays");
      replayDetails.append(h("div", { class: "prx-disclosure-body" }, replayTable));

      const leftCol = h("div", { class: "prx-rr-left" }, comparison, boundLine);
      const replaySection = h("section", { class: "prx-rr-section" }, replayLegend, replayPlot, replayDetails);
      ctx.stage.append(leftCol, replaySection);

      // Data disclosure: selected report grades + 30-unit table + posterior-draw experiment (histogram & running average)
      const dataBox = ctx.dataBox("Data and posterior draw checks");
      const reportTag = h("p", { class: "prx-rr-note" });
      const report = h("div");
      const unitTable = ctx.scrollRegion(
        h("div", { class: "prx-rr-scroll" }),
        "Selected report, fixed truth, estimates and both conditional laws"
      );

      const drawLaw = ctx.segmented({
        label: "Law supplying posterior draws",
        options: [
          { value: "reference", label: "Reference law" },
          { value: "assumed", label: "Assumed law" },
        ],
        value: ctx.state.drawLaw,
        onChange: (v) => ctx.set({ drawLaw: v }),
      });
      const drawControls = createDrawControls(ctx);
      const drawSettings = h("div", { "data-prx-part": "controls" }, drawLaw.root, drawControls.row);
      const drawSummary = h("p");
      const drawCaption = h("p", { class: "prx-rr-note" });
      const hist = h("div");
      const run = h("div");
      const histRegion = ctx.scrollRegion(
        h("div", { class: "prx-rr-scroll" }, hist),
        "Posterior-draw histogram, scroll horizontally to inspect every wrong count"
      );
      const drawsSection = h(
        "section",
        { class: "prx-rr-draws-section" },
        ctx.panelTitle("A different experiment: draw true values from a declared law"),
        h(
          "p",
          { class: "prx-rr-note" },
          "Freeze the selected replay’s report and observations. Here the true values vary under the selected conditional law. The running average targets that law’s expected wrong count; it does not validate the law against the fixed league truth."
        ),
        drawSettings,
        drawSummary,
        histRegion,
        run,
        drawCaption
      );
      dataBox.body.append(
        ctx.panelTitle("Selected report and conditional laws"),
        reportTag,
        report,
        unitTable,
        drawsSection
      );

          // Method disclosure: reference-law scope, pair-error bound derivation, and Monte Carlo replay provenance
      const methodBox = ctx.methodBox("Method and details");
      const scope = h(
        "p",
        { class: "prx-rr-note" },
        "The reference is a declared normal law using the same observations and a prior SD of ",
        ctx.num(CONFIG.referenceSd, formatSetting(CONFIG.referenceSd)),
        ". It is a comparison model, not an established true conditional law."
      );
      const boundNotes = h(
        "div",
        {},
        ctx.panelTitle("How the pair-error bound works"),
        h(
          "p",
          { class: "prx-rr-note" },
          "δ is the largest absolute difference between the two laws’ wrong-direction probabilities over all ordered pairs, including directions this report withholds. It compares probabilities, not wrong-direction counts."
        ),
        h(
          "p",
          { class: "prx-rr-note" },
          "For a report with N > ",
          ctx.num(0, "0"),
          ", averaging its stated-pair error probabilities gives |claimed E/N − reference E/N| ≤ δ. It does not establish calibration."
        ),
        h("p", { class: "prx-rr-note" }, "This bound compares expectations. A single realized wrong share can lie outside it.")
      );
      const replayCaption = h("p", { class: "prx-rr-note" });
      methodBox.body.append(
        scope,
        boundNotes,
        ctx.panelTitle("Observation replays vs. posterior draws"),
        h(
          "p",
          { class: "prx-rr-note" },
          "Each observation replay generates new noisy estimates of the same fixed true values, then chooses a new report. Select a point in the replay chart or move Inspect replay to compare that replay’s report."
        ),
        replayCaption
      );

      const makeTable = (headers, rows, caption) =>
        h(
          "table",
          { class: "prx-sticky-first" },
          h("caption", {}, caption),
          h("thead", {}, h("tr", {}, ...headers.map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", {}, ...rows)
        );

      const renderPosteriorDrawCharts = (state, r) => {
        const N = r.N;
        const draws = conditionalDraws(r, state);
        const top = N < DRAW_CONFIG.hist.minBins ? N : Math.max(DRAW_CONFIG.hist.minBins - 1, Math.min(N, Math.max(0, ...draws.counts)));
        const availWidth = histRegion.clientWidth || ctx.width();
        hist.style.minWidth = `${Math.max(availWidth, (top + 1) * 18 + DRAW_CONFIG.hist.marginLeft + DRAW_CONFIG.hist.marginRight)}px`;
        drawHistogram(ctx, hist, draws.counts, N);
        run.hidden = state.draws === 0;
        if (state.draws > 0) drawRunningAverage(ctx, run, draws.counts, draws.E);
      };

      return {
        render(state, info) {
          if (state.replay > state.replays) {
            ctx.set({ replay: state.replays });
            return;
          }
          const c = replayComparison(state);
          const r = c.rows[state.replay - 1];

          // PR-06 / PR-09 disclosure guard: only redraw width-dependent Data charts when Data opens
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data") renderPosteriorDrawCharts(state, r);
            return;
          }

          prior.set(state.priorSd);
          total.set(state.replays);
          tau.set(state.tau);
          cap.set(state.cap);
          selected.input.max = String(state.replays);
          selected.set(state.replay);
          drawLaw.set(state.drawLaw);
          drawControls.seed.set(state.seed);
          drawControls.one.setDisabled(state.draws >= CONFIG.draws.max);
          drawControls.many.setDisabled(state.draws + 100 > CONFIG.draws.max);
          drawControls.clear.setDisabled(state.draws === 0);

          const N = r.N;
          if (N === 0) {
            ctx.readout.set([
              "Replay ",
              hookNum("selected-replay", r.r),
              ": ",
              hookNum("stated-count", N),
              " stated (",
              hookNum("realized-count", r.D),
              " wrong); claimed ",
              hookNum("claimed-share", r.EoverN, share),
              ", reference ",
              hookNum("reference-share", r.referenceShare, share),
              ", realized ",
              hookNum("realized-share", r.DoverN, share),
              ".",
            ]);
          } else if (state.priorSd === CONFIG.referenceSd) {
            ctx.readout.set([
              "Replay ",
              hookNum("selected-replay", r.r),
              ": claimed ",
              hookNum("claimed-share", r.EoverN, share),
              " equals reference ",
              hookNum("reference-share", r.referenceShare, share),
              " (same prior); fixed truth has ",
              hookNum("realized-count", r.D),
              " of ",
              hookNum("stated-count", N),
              " wrong (",
              hookNum("realized-share", r.DoverN, share),
              ").",
            ]);
          } else {
            ctx.readout.set([
              "Replay ",
              hookNum("selected-replay", r.r),
              ": claimed ",
              hookNum("claimed-share", r.EoverN, share),
              " vs. reference ",
              hookNum("reference-share", r.referenceShare, share),
              "; fixed truth has ",
              hookNum("realized-count", r.D),
              " of ",
              hookNum("stated-count", N),
              " wrong (",
              hookNum("realized-share", r.DoverN, share),
              ").",
            ]);
          }

          const shares = [
            { label: "Claim E/N", value: r.EoverN, kind: "claim" },
            { label: "Reference E/N", value: r.referenceShare, kind: "reference" },
            { label: "Fixed-truth D/N", value: r.DoverN, kind: "realized" },
          ];
          for (const d of shares) replayValues[d.kind].replaceChildren(ctx.num(d.value, share(d.value)));

          const compWidth = Math.max(240, Math.round(comparison.clientWidth || ctx.width()));
          const xMax = Math.max(0.2, ...shares.map((d) => d.value ?? 0)) * 1.18;
          plot(comparison, {
            width: compWidth,
            height: compWidth < 420 ? 116 : 158,
            marginLeft: 120,
            marginRight: compWidth < 420 ? 54 : 66,
            marginTop: 6,
            marginBottom: 40,
            x: {
              domain: [0, xMax],
              label: "Wrong share (stated pairs)",
              labelOffset: 36,
              ticks: compWidth < 420 ? [0, Number((xMax / 2).toPrecision(1)), Number((xMax * 0.85).toPrecision(1))] : 4,
              labelAnchor: "center",
              labelArrow: "none",
            },
            y: { domain: shares.map((d) => d.label), label: null, tickSize: 0 },
            alt: N
              ? "The same selected report’s expected wrong share under the assumed and reference conditional laws, beside its realized wrong share at the fixed true league values. The realized share is not another conditional expectation."
              : "This report states no pair directions, so all three shares read NA: no disclosure.",
            table: {
              caption: "One fixed report, two conditional-law expectations and a fixed-truth realization",
              columns: [
                { label: "Quantity", value: "label", num: false },
                { label: "Wrong share", value: "value", format: (v) => share(v) },
              ],
              rows: shares,
            },
            marks: (p, P) => [
              P.ruleX([0], { stroke: p.plotAxis }),
              P.barX(
                shares.filter((d) => d.kind === "claim" && d.value !== null),
                { y: "label", x: "value", fill: p.plotFg, insetTop: 6, insetBottom: 6 }
              ),
              P.barX(
                shares.filter((d) => d.kind === "reference" && d.value !== null),
                { y: "label", x: "value", fill: p.plotGrid, stroke: p.plotMuted, insetTop: 6, insetBottom: 6 }
              ),
              P.dot(
                shares.filter((d) => d.kind === "realized" && d.value !== null),
                { y: "label", x: "value", fill: p.plotBg, stroke: p.plotFg, r: 5, strokeWidth: 2 }
              ),
              numText(
                shares.filter((d) => d.value !== null && d.kind !== "realized"),
                { x: "value", y: "label", value: "value", format: (v) => share(v), dx: 7, textAnchor: "start", fill: p.plotFg }
              ),
              numText(
                shares.filter((d) => d.value !== null && d.kind === "realized"),
                { x: "value", y: "label", value: "value", format: (v) => share(v), dx: 12, textAnchor: "start", fill: p.plotFg }
              ),
              ...(N === 0
                ? [
                    P.text([{ x: 0, y: "Reference E/N" }], {
                      x: "x",
                      y: "y",
                      dx: 8,
                      textAnchor: "start",
                      text: () => "NA: no disclosure",
                      fill: p.plotMuted,
                    }),
                  ]
                : []),
            ],
            keyboard: {
              data: shares.filter((d) => d.value !== null),
              x: "value",
              y: "label",
              sort: false,
              title: (d) => `${d.label}: ${share(d.value)} wrong share for this fixed report.`,
            },
          });

          boundLine.replaceChildren(
            ...(N
              ? [
                  "Expectation gap ",
                  hookNum("share-gap", r.shareGap, formatReadoutProb),
                  " ≤ pair-error bound δ = ",
                  hookNum("delta", r.delta, formatReadoutProb),
                  ".",
                ]
              : [
                  "No share gap when nothing is stated; δ = ",
                  hookNum("delta", r.delta, formatReadoutProb),
                  ".",
                ])
          );

          const points = c.rows
            .flatMap((d) => [
              { r: d.r, value: d.EoverN, kind: "claim" },
              { r: d.r, value: d.referenceShare, kind: "reference" },
              { r: d.r, value: d.DoverN, kind: "realized" },
            ])
            .filter((d) => d.value !== null);

          const replayWidth = Math.max(240, Math.round(replayPlot.clientWidth || ctx.width()));
          plot(replayPlot, {
            width: replayWidth,
            height: replayWidth < 420 ? 136 : 194,
            marginLeft: 48,
            marginRight: 18,
            marginTop: 20,
            marginBottom: 40,
            x: {
              domain: [1, state.replays],
              label: "Observation replay (new report each time)",
              labelOffset: 36,
              ticks: Math.min(6, state.replays),
              labelAnchor: "center",
              labelArrow: "none",
            },
            y: {
              domain: [0, Math.max(0.2, ...points.map((d) => d.value)) * 1.12],
              label: "Wrong share",
              ticks: 4,
              grid: true,
            },
            alt: "Observation replays hold the true league values fixed. Each replay reselects a report; its claimed and reference-law expected wrong shares are lines, and its realized wrong share is an open circle. The highlighted vertical rule is the selected replay.",
            table: {
              caption: "Wrong shares by observation replay, with new estimates and a new report each time",
              columns: [
                { label: "Replay", value: "r", format: (v) => formatCount(v) },
                { label: "Quantity", value: "kind", num: false },
                { label: "Wrong share", value: "value", format: (v) => share(v) },
              ],
              rows: points,
            },
            marks: (p, P) => [
              P.ruleX([state.replay], { stroke: p.plotGrid, strokeWidth: 5 }),
              P.line(
                points.filter((d) => d.kind === "claim"),
                { x: "r", y: "value", stroke: p.plotFg, strokeWidth: 2 }
              ),
              P.line(
                points.filter((d) => d.kind === "reference"),
                { x: "r", y: "value", stroke: p.plotMuted, strokeDasharray: "5,3", strokeWidth: 2 }
              ),
              P.dot(
                points.filter((d) => d.kind === "realized"),
                { x: "r", y: "value", fill: p.plotBg, stroke: p.plotFg, r: 4.5, strokeWidth: 1.6 }
              ),
            ],
            keyboard: {
              data: points,
              x: "r",
              y: "value",
              sort: false,
              key: (d) => `${d.r}-${d.kind}`,
              title: (d) => `Observation replay ${formatCount(d.r)}, ${d.kind}: wrong share ${share(d.value)}.`,
              pointer: true,
              onFocus: (d) => {
                focusedReplay = d.r;
              },
              onSelect: (d) => ctx.set({ replay: d.r }),
            },
          });

          replayTable.replaceChildren(
            makeTable(
              ["Replay", "Stated N", "Claim E/N", "Reference E/N", "Realized D/N", "Pair-gap δ"],
              c.rows.map((d) =>
                h(
                  "tr",
                  { "aria-current": d.r === state.replay ? "true" : null },
                  h("th", { scope: "row" }, ctx.num(d.r, formatCount(d.r))),
                  h("td", {}, ctx.num(d.N, formatCount(d.N))),
                  ...[d.EoverN, d.referenceShare, d.DoverN].map((v) => h("td", {}, ctx.num(v, share(v)))),
                  h("td", {}, ctx.num(d.delta, prob4(d.delta)))
                )
              ),
              "Each row uses its own selected report; expectations hold that row’s report fixed"
            )
          );

          // Data disclosure: selected report grades + 30-unit table + posterior-draw checks
          const opt = fixedOrderDP(r.claimedErrors, { scores: r.assumed.mean, direction: "descending", tau: state.tau, G: state.cap });
          reportTag.replaceChildren(
            tagNode(ctx, opt),
            " in descending assumed-posterior-mean order, with at most ",
            ctx.num(state.cap, formatCount(state.cap)),
            state.cap === 1 ? " grade. " : " grades. ",
            "This is an ",
            captionNode(ctx, "fixed-report"),
            ". The selection law is a normal–normal update of the chosen prior using the simulated estimates."
          );
          if (opt.tieCount > 1) {
            reportTag.append(
              " ",
              ctx.num(opt.tieCount, formatCount(opt.tieCount)),
              " reports share the smallest risk; the readouts show the package choice. Equal-risk tolerance ",
              ctx.num(opt.tieTol, formatSci(opt.tieTol)),
              "."
            );
          }

          report.replaceChildren(
            h(
              "p",
              { class: "prx-rr-note" },
              "Grade ",
              ctx.num(1, "1"),
              " = stated highest on the league value, as the assumed posterior judges it. A shared grade means not compared."
            )
          );
          for (let g = 1; g <= Math.max(...r.grade); g++) {
            report.append(
              h(
                "div",
                { class: "prx-rr-grade" },
                "Grade ",
                ctx.num(g, formatCount(g)),
                ": ",
                h("span", { "data-prx-name": "" }, L.ids.filter((id, i) => r.grade[i] === g).join(", "))
              )
            );
          }

          unitTable.replaceChildren(
            makeTable(
              ["Unit", "Grade", "Fixed truth", "Estimate", "Assumed mean (SD)", "Reference mean (SD)"],
              L.ids.map((id, i) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row", "data-prx-name": "" }, id),
                  h("td", {}, ctx.num(r.grade[i], formatCount(r.grade[i]))),
                  ...[L.theta[i], r.estimate[i]].map((v) => h("td", {}, ctx.num(v, tableDec3(v)))),
                  ...[r.assumed, r.reference].map((law) =>
                    h(
                      "td",
                      {},
                      ctx.num(law.mean[i], tableDec3(law.mean[i])),
                      " (",
                      ctx.num(law.sd[i], tableDec3(law.sd[i])),
                      ")"
                    )
                  )
                )
              ),
              "Selected observation replay: report and normal conditional laws"
            )
          );

          const draws = conditionalDraws(r, state);
          const expectedShare = state.drawLaw === "reference" ? r.referenceShare : r.EoverN;
          drawSummary.replaceChildren(
            "Fixed report, ",
            hookNum("posterior-draws", state.draws),
            state.draws === 1 ? " posterior draw under the " : " posterior draws under the ",
            state.drawLaw === "reference" ? "reference" : "assumed",
            " law. Expected wrong count ",
            hookNum("draw-expected", draws.E, formatExpectedCount),
            " out of ",
            hookNum("draw-stated-count", N),
            N === 1 ? " stated pair (share " : " stated pairs (share ",
            hookNum("draw-expected-share", expectedShare, share),
            "). Simulated average wrong count ",
            hookNum("draw-average", draws.mean, formatExpectedCount),
            "."
          );
          renderPosteriorDrawCharts(state, r);
          drawCaption.replaceChildren(
            captionNode(ctx, "monte-carlo", { S: state.draws, seed: state.seed }),
            ". These are draws of latent values with the selected observations and report fixed. The dashed line is this draw law’s expectation, not the replay experiment’s average."
          );

          // Method disclosure: Monte Carlo replay provenance
          replayCaption.replaceChildren(
            "Monte Carlo, ",
            hookNum("replay-count", state.replays),
            " observation replays, base seed ",
            ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
            ". Replay r uses seed base + r; selected seed ",
            hookNum("observation-seed", r.seed, formatSetting),
            ". The ",
            ctx.num(L.ids.length, formatCount(L.ids.length)),
            " true values are a deterministic construction; their design scale ",
            ctx.num(0.15, formatSetting(0.15)),
            " does not establish either conditional law as correct."
          );
          if (state.priorSd === CONFIG.referenceSd) {
            replayCaption.append(" The claim and reference lines coincide because their conditional laws are identical.");
          }
        },
      };
    },
  });
}
