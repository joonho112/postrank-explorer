// App entry point for 2.19 averaging-errors ("Three ways to average a wrong share") — Frame v2 upgrade.
// Preserves 100% of exports (averagingResult, mountWidget), URL keys, presets, and readout hooks, while resolving
// the x-axis title vs. end-tick collision, removing redundant unlabeled ticks, giving the 3-row outcome editor
// >= 44px mobile touch targets without overflow, eliminating the duplicate bar-value prose block, and moving
// secondary derivations and running traces into Data and Method disclosures.
import { createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import {
  blocksText,
  formatCount,
  formatEoverN,
  formatRational,
  formatSetting,
  formatShare,
} from "../shared/format.js";
import { disclosedErrorEstimands, evaluateReport, leagueGradingReplays, pairCount, familySize } from "../pr-core.js";
import { modelOf } from "../shared/domain/frontier.js";

const NAMES = ["Pooled pairs", "Disclosing outcomes", "Zero-imputed mean"];
const finiteShare = (v) => {
  if (v === null) return formatEoverN(null);
  try {
    return formatRational(v, { maxDenominator: 10000 });
  } catch {
    return formatShare(v);
  }
};
const FIELDS = ["ERR", "meanFraction", "zeroImputed"];

const CSS = `
.avgerr[data-prx-frame="v2"] .prx-slider { max-width: 18rem; }

.avgerr[data-prx-frame="v2"] .prx-stage {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.avgerr[data-prx-frame="v2"] .prx-stage > * {
  min-width: 0;
  max-width: 100%;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-figure {
  min-width: 0;
}

/* Compact 3-row outcome editor on plot paper with >= 44px touch targets on mobile */
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-cards {
  min-width: 0;
  margin: 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--prx-plot-grid);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-fg);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor th,
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor td {
  padding: 0.22rem 0.45rem 0.22rem 0;
  text-align: left;
  vertical-align: middle;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor th:last-child,
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor td:last-child {
  padding-right: 0;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor thead th {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--prx-plot-muted);
  border-bottom: 1px solid var(--prx-cell-border);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor tbody th {
  font-weight: 600;
  white-space: nowrap;
  color: var(--prx-plot-fg);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor .avgerr-input-row > * {
  padding-top: 0.35rem;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor .avgerr-note-row > td {
  padding-top: 0;
  border-bottom: 1px solid var(--prx-plot-grid);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor .avgerr-note {
  margin: 0 0 0.28rem;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor .prx-control {
  margin: 0;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor input[type="number"] {
  width: 4.4rem;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor select {
  min-width: 5.2rem;
}
.avgerr[data-prx-frame="v2"] .prx-stage .avgerr-stage-note {
  margin: 0;
  padding-top: 0.3rem;
  border-top: 1px solid var(--prx-plot-grid);
  font-size: 0.84375rem;
  color: var(--prx-plot-muted);
}

/* Mode-specific toolbar controls */
.avgerr[data-prx-frame="v2"] .avgerr-mode-bar {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: flex-end;
  min-width: 0;
}
.avgerr[data-prx-frame="v2"] .avgerr-mode-bar[hidden] {
  display: none;
}

/* Disclosures */
.avgerr[data-prx-frame="v2"] .avgerr-note {
  font-size: 0.9rem;
  color: var(--prx-fg-muted);
  margin: 0.4rem 0 0;
}
.avgerr[data-prx-frame="v2"] .avgerr-note:first-child {
  margin-top: 0;
}
.avgerr[data-prx-frame="v2"] .avgerr-table {
  width: 100%;
  min-width: 26rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.avgerr[data-prx-frame="v2"] .avgerr-table th { white-space: nowrap; }
.avgerr[data-prx-frame="v2"] .avgerr-table th,
.avgerr[data-prx-frame="v2"] .avgerr-table td {
  padding: 0.3rem 0.45rem;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}
.avgerr[data-prx-frame="v2"] .avgerr-scroll {
  max-height: 22rem;
  overflow: auto;
}
.avgerr[data-prx-frame="v2"] .avgerr-running-wrap {
  margin-top: 0.5rem;
}

@media (pointer: coarse), (max-width: 48em) {
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor input[type="number"],
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor select {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
@media (max-width: 34em) {
  .avgerr[data-prx-frame="v2"] .prx-presets .prx-seg,
  .avgerr[data-prx-frame="v2"] .prx-controls .prx-seg {
    padding-inline: 0.48rem;
    font-size: 0.8125rem;
  }
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor th,
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor td {
    padding-inline: 0.22rem;
    font-size: 0.8125rem;
  }
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor th:first-child,
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor td:first-child {
    padding-left: 0;
  }
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor th:last-child,
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor td:last-child {
    padding-right: 0;
  }
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor input[type="number"] {
    width: 3.15rem;
    max-width: 100%;
    box-sizing: border-box;
    padding-inline: 0.25rem;
  }
  .avgerr[data-prx-frame="v2"] .prx-stage .avgerr-editor select {
    min-width: 3.95rem;
    max-width: 4.5rem;
    box-sizing: border-box;
    padding-inline: 0.2rem;
  }
}
`;

const replayCache = new Map();
let mixtureModel;
function mixedReports() {
  if (!mixtureModel) {
    const m = modelOf("tb16", "all");
    mixtureModel = { m, vertices: [m.hull.find((v) => v.N === 3), m.hull.find((v) => v.N === 5)] };
  }
  return mixtureModel;
}

export function averagingResult(s) {
  if (s.mode === "mixture") {
    const { m, vertices } = mixedReports();
    const weights = [s.psi, 1 - s.psi];
    const counts = vertices.map((v) => evaluateReport(v.grade, m.E, { tau: 0.25, w: m.opts.w }));
    const cases = counts.map((v, i) => ({ A: v.Ew, N: v.N, probability: weights[i], share: v.EwOverN, grade: vertices[i].grade }));
    for (const d of cases) d.share = disclosedErrorEstimands([{ A: d.A, N: d.N }], { M: m.M }).ERR;
    return { cases, M: m.M, ids: m.E.ids, result: disclosedErrorEstimands(cases.map(({ A, N }) => ({ A, N })), { M: m.M, weights }) };
  }
  if (s.mode === "replays") {
    const key = [s.seed, s.replays, s.priorSd, s.tau, s.cap].join("|");
    if (!replayCache.has(key)) {
      if (replayCache.size >= 32) replayCache.delete(replayCache.keys().next().value);
      replayCache.set(key, leagueGradingReplays(s.seed, { replays: s.replays, priorSd: s.priorSd, tau: s.tau, cap: s.cap }));
    }
    const r = replayCache.get(key);
    return { cases: r.draws.map((d) => ({ A: d.D, N: d.N, probability: 1 / r.replays, share: d.DoverN })), M: pairCount(30), result: r.estimands };
  }
  const raw = [s.w1, s.w2, s.w3];
  const total = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map((w) => w / total);
  const cases = [1, 2, 3].map((i, k) => ({ A: Math.min(s[`a${i}`], s[`n${i}`]), N: s[`n${i}`], probability: weights[k] }));
  for (const d of cases) d.share = disclosedErrorEstimands([{ A: d.A, N: d.N }], { M: pairCount(3) }).ERR;
  return { cases, M: pairCount(3), result: disclosedErrorEstimands(cases.map(({ A, N }) => ({ A, N })), { M: pairCount(3), weights }) };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "averaging-errors",
    title: "Three ways to average an error share",
    className: "avgerr",
    css: CSS,
    frame: "v2",
    keys: {
      mode: { type: "choice", values: ["kernel", "mixture", "replays"], value: "kernel" },
      ...Object.fromEntries(
        [1, 2, 3].flatMap((i, k) => [
          [`a${i}`, { type: "integer", min: 0, max: 3, value: [2, 0, 0][k] }],
          [`n${i}`, { type: "choice", values: [0, 2, 3], value: [2, 3, 0][k] }],
          [`w${i}`, { type: "number", min: 0, max: 10, step: 0.25, value: 1 }],
        ]),
      ),
      psi: { type: "number", min: 0, max: 1, step: 0.05, value: 0.25 },
      seed: { type: "integer", min: 0, max: 99999999, value: 20261030 },
      replays: { type: "choice", values: [3, 5, 20, 100], value: 20 },
      priorSd: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.15 },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      cap: { type: "integer", min: 1, max: 5, value: 3 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, value, fmt = formatShare) => {
        const n = ctx.num(value, fmt(value));
        n.dataset.prxReadout = name;
        return n;
      };

      // --- Primary control in ctx.controls: Average over mode
      const mode = ctx.segmented({
        label: "Average over",
        options: [
          { value: "kernel", label: "Three outcomes" },
          { value: "mixture", label: "Randomized reports" },
          { value: "replays", label: "Replicated datasets" },
        ],
        value: ctx.state.mode,
        onChange: (v) => ctx.set({ mode: v }),
      });
      ctx.primaryControl(mode.root);
      ctx.controls.append(mode.root);

      // --- Mode-specific controls after presets + secondary simulation parameters in Settings
      const mixture = h("section", { "aria-label": "A lottery over two complete four-unit reports", class: "avgerr-mode-bar" });
      const psi = ctx.slider({
        label: "Chance of the first complete report",
        ...ctx.key("psi"),
        format: finiteShare,
        onInput: (v) => ctx.set({ psi: v }),
      });
      mixture.append(psi.root);

      const replaysCtl = ctx.select({
        label: "Datasets",
        options: [3, 5, 20, 100].map((v) => ({ value: v, label: String(v) })),
        value: ctx.state.replays,
        onChange: (v) => ctx.set({ replays: Number(v) }),
      });
      const tauCtl = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      const replayPrimary = h("div", { class: "avgerr-mode-bar" }, replaysCtl.root, tauCtl.root);

      const seedCtl = ctx.numberInput({ label: "Seed", ...ctx.key("seed"), onInput: (v) => ctx.set({ seed: v }) });
      const priorSdCtl = ctx.slider({ label: "Assumed prior SD", ...ctx.key("priorSd"), onInput: (v) => ctx.set({ priorSd: v }) });
      const capCtl = ctx.slider({ label: "Maximum grades in each ordered cut", ...ctx.key("cap"), onInput: (v) => ctx.set({ cap: v }) });
      const controlSpecs = [
        ["seed", seedCtl],
        ["replays", replaysCtl],
        ["priorSd", priorSdCtl],
        ["tau", tauCtl],
        ["cap", capCtl],
      ];

      ctx.afterPresets(mixture, replayPrimary);
      const settings = ctx.settingsBox("Settings");
      settings.body.append(seedCtl.root, priorSdCtl.root, capCtl.root);

      // --- Stage: 3-bar primary chart + compact touch-friendly 3-row outcome editor (or 1-line mixture note)
      const fig = ctx.primaryGraphic(h("div", { class: "avgerr-figure" }));
      const inputFeedback = h("p", { class: "avgerr-stage-note", role: "status", "data-prx-part": "input-feedback" });

      const editorBody = h("tbody", {});
      const manual = h(
        "section",
        { "aria-label": "Three possible outcomes", class: "avgerr-cards" },
        h(
          "table",
          { class: "avgerr-editor" },
          h("thead", {}, h("tr", {}, ...["Outcome", "Wrong", "Stated pairs", "Weight"].map((t) => h("th", { scope: "col" }, t)))),
          editorBody,
        ),
      );
      const editors = [1, 2, 3].map((i) => {
        const a = ctx.numberInput({
          label: "Wrong stated directions",
          ...ctx.key(`a${i}`),
          onInput: (v) => ctx.set({ [`a${i}`]: Math.min(v, ctx.state[`n${i}`]) }),
        });
        const n = ctx.select({
          label: "Stated pairs",
          options: [
            { value: 0, label: "None" },
            { value: 2, label: "Two" },
            { value: 3, label: "Three" },
          ],
          value: ctx.state[`n${i}`],
          onChange: (v) => ctx.set({ [`n${i}`]: Number(v), [`a${i}`]: Math.min(ctx.state[`a${i}`], Number(v)) }),
        });
        const w = ctx.numberInput({
          label: "Relative probability weight",
          ...ctx.key(`w${i}`),
          onInput: (v) => ctx.set({ [`w${i}`]: v }),
        });
        for (const c of [a, n, w]) c.root.querySelector("label")?.classList.add("prx-sr-only");
        const note = h("p", { class: "avgerr-note" });
        editorBody.append(
          h("tr", { class: "avgerr-input-row" }, h("th", { scope: "row" }, "Outcome ", ctx.num(i, formatCount(i))), h("td", {}, a.root), h("td", {}, n.root), h("td", {}, w.root)),
          h("tr", { class: "avgerr-note-row" }, h("td", { colspan: "4" }, note)),
        );
        return { a, n, w, note };
      });

      const mixtureText = h("p", { class: "avgerr-stage-note" });
      ctx.stage.append(fig, inputFeedback, manual, mixtureText);

      // --- Disclosures: Data (exact outcome/dataset table) & Method (definitions, ratio-bias note & running trace)
      const table = h("table", { class: "avgerr-table" });
      const scroll = ctx.part("table", h("div", { class: "avgerr-scroll" }, table));
      ctx.scrollRegion(scroll, "Outcomes and their probabilities");
      const dataBox = ctx.dataBox("Data and exact values");
      dataBox.body.append(scroll);

      const explanation = h("p", { class: "avgerr-note" });
      const smallR = h("p", { class: "avgerr-note" });
      const constraintNote = h("p", {
        class: "avgerr-note",
        text: "In Three outcomes mode, wrong stated directions cannot exceed stated pairs.",
      });
      const running = h("div", { class: "avgerr-figure" });
      const runningKey = h("p", { class: "avgerr-note" }, "Solid: Pooled pairs; dashed: Disclosing outcomes; dotted: Zero-imputed mean.");
      const runningWrap = h("div", { class: "avgerr-running-wrap" }, running, runningKey);
      const methodBox = ctx.methodBox("Method and details");
      methodBox.body.append(explanation, smallR, constraintNote, runningWrap);

      function drawRunningChart(s, model, share) {
        const measured = Math.round(running.clientWidth || 0);
        const fallback = Math.max(240, Math.round(ctx.width()) - 56);
        const width = measured > 0 ? Math.max(240, measured) : Math.min(560, fallback);
        const history = model.cases
          .flatMap((_, i) => {
            const a = disclosedErrorEstimands(model.cases.slice(0, i + 1).map(({ A, N }) => ({ A, N })), { M: model.M });
            return FIELDS.map((f, k) => ({ dataset: i + 1, value: a[f], label: NAMES[k], k }));
          })
          .filter((d) => d.value !== null);

        plot(running, {
          alt: "Running values of the three averaging conventions as simulated datasets accumulate.",
          width,
          height: 210,
          marginTop: 22,
          marginRight: 24,
          marginBottom: 42,
          marginLeft: 52,
          x: {
            label: "Datasets",
            labelAnchor: "center",
            labelArrow: "none",
            domain: [1, Math.max(2, s.replays)],
            ticks: Math.min(5, s.replays),
          },
          y: {
            label: "Estimated error share",
            labelArrow: "none",
            domain: [0, Math.min(1, Math.max(0.1, ...history.map((d) => d.value)) * 1.1)],
            grid: true,
          },
          color: { type: "identity" },
          marks: (c, P) =>
            NAMES.map((name, k) =>
              P.line(history.filter((d) => d.k === k), {
                x: "dataset",
                y: "value",
                stroke: [c.post, c.err, c.wh][k],
                strokeWidth: 2,
                strokeDasharray: [null, "6 3", "2 3"][k],
              }),
            ),
          keyboard: {
            data: history,
            x: "dataset",
            y: "value",
            sort: false,
            label: "Running averages by dataset",
            title: (d) => `${d.label}, dataset ${formatCount(d.dataset)}: ${share(d.value)}`,
          },
          table: {
            caption: "Running averages",
            columns: [
              { label: "Datasets", value: "dataset", format: (v) => formatCount(v) },
              { label: "Average", value: "label" },
              { label: "Share", value: "value", format: (v) => share(v) },
            ],
            rows: history,
          },
        });
      }

      return {
        render(s, info = {}) {
          if (info?.reason === "disclosure") {
            if ((info.disclosure === "method" || methodBox.open) && s.mode === "replays") {
              const model = averagingResult(s);
              drawRunningChart(s, model, formatShare);
            }
            return;
          }

          const fix = {};
          for (const i of [1, 2, 3]) {
            if (s[`a${i}`] > s[`n${i}`]) fix[`a${i}`] = s[`n${i}`];
          }
          if (Object.keys(fix).length) ctx.set(fix);

          inputFeedback.hidden = true;
          mode.set(s.mode);
          manual.hidden = s.mode !== "kernel";
          mixture.hidden = s.mode !== "mixture";
          mixtureText.hidden = s.mode !== "mixture";
          replayPrimary.hidden = s.mode !== "replays";
          settings.root.hidden = s.mode !== "replays";
          runningWrap.hidden = s.mode !== "replays";
          psi.set(s.psi);
          for (const [key, c] of controlSpecs) c.set(s[key]);

          if (s.mode === "kernel" && s.w1 + s.w2 + s.w3 === 0) {
            editors.forEach((c, k) => {
              const i = k + 1;
              c.a.set(Math.min(s[`a${i}`], s[`n${i}`]));
              c.n.set(s[`n${i}`]);
              c.w.set(s[`w${i}`]);
              c.note.textContent = "Probability is undefined until at least one outcome has positive weight.";
            });
            inputFeedback.hidden = false;
            inputFeedback.textContent = "The total probability weight must be positive. Increase any outcome's weight above zero to compute the averages; your inputs are preserved.";
            ctx.readout.set("A probability distribution needs positive total weight. No averages are computed for these inputs.");
            fig.replaceChildren();
            running.replaceChildren();
            table.replaceChildren();
            smallR.textContent = "";
            explanation.textContent = "";
            ctx.caption.textContent = "Three illustrative outcomes. Relative probability weights must have a positive total before normalization.";
            return;
          }

          const model = averagingResult(s);
          const r = model.result;
          const share = s.mode === "replays" ? formatShare : finiteShare;

          if (s.mode === "mixture") {
            mixtureText.replaceChildren(
              "The lottery selects a complete report. For each report, we average the weighted wrong count under the theory book’s four-unit, two-criterion law. ",
              ...model.cases.flatMap((d, i) => [
                i ? "; " : "",
                blocksText(d.grade, model.ids),
                ", probability ",
                ctx.num(d.probability, share(d.probability)),
                ", expected weighted wrong ",
                ctx.num(d.A, share(d.A)),
                ", stated pairs ",
                ctx.num(d.N, formatCount(d.N)),
              ]),
              ". Evaluation of fixed reports; the lottery is not a single printable report.",
            );
          }

          editors.forEach((c, k) => {
            const i = k + 1;
            c.a.set(Math.min(s[`a${i}`], s[`n${i}`]));
            c.n.set(s[`n${i}`]);
            c.w.set(s[`w${i}`]);
            const d = model.cases[k];
            if (s.mode === "kernel") {
              c.note.replaceChildren(
                "Probability ",
                ctx.num(d.probability, share(d.probability)),
                "; this outcome's error share ",
                ctx.num(d.share, share(d.share)),
                ".",
              );
            }
          });

          const rows = FIELDS.map((field, i) => ({ label: NAMES[i], value: r[field], index: i }));
          plot(fig, {
            alt: "Three averages of the same error counts; pooling pairs, conditioning on positive disclosure, and imputing zero give different answers.",
            height: 192,
            marginTop: 14,
            marginBottom: 42,
            marginLeft: 148,
            marginRight: 52,
            x: {
              domain: [0, 1],
              label: "Error share",
              labelAnchor: "center",
              labelArrow: "none",
              ticks: [0, 0.5, 1],
              grid: false,
            },
            y: {
              domain: NAMES,
              label: null,
              tickSize: 0,
            },
            table: {
              caption: "Three averaging conventions",
              columns: [
                { label: "Average", value: "label" },
                { label: "Share", value: "value", format: (v) => share(v) },
              ],
              rows,
            },
            marks: (c, P) => [
              P.ruleX([0], { stroke: c.plotAxis }),
              P.barX(rows.filter((d) => d.value !== null), {
                x: "value",
                y: "label",
                fill: (d) => [c.post, c.err, c.wh][d.index],
                insetY: 5,
              }),
              numText(rows.filter((d) => d.value !== null), {
                x: "value",
                y: "label",
                value: "value",
                format: (v) => share(v),
                dx: 6,
                textAnchor: "start",
                fill: c.plotFg,
                fontWeight: 600,
              }),
              P.text(rows.filter((d) => d.value === null), {
                x: () => 0,
                y: "label",
                text: () => formatEoverN(null),
                dx: 6,
                textAnchor: "start",
                fill: c.plotMuted,
                fontStyle: "italic",
              }),
            ],
            keyboard: {
              data: rows.filter((d) => d.value !== null),
              x: "value",
              y: "label",
              sort: false,
              label: "Compare the three averages",
              title: (d) => `${d.label}: ${share(d.value)}`,
              pointer: true,
            },
          });

          if (s.mode !== "replays" && r.positiveFrequency === 0) {
            smallR.textContent = "No outcome discloses, so neither the pooled ratio nor the conditional mean is defined. The zero-imputed mean remains a reporting convention.";
          } else if (s.mode !== "replays") {
            smallR.replaceChildren(
              "With one observed outcome, the expected observed fraction conditional on disclosure is ",
              ctx.num(r.meanFraction, share(r.meanFraction)),
              ", while the ratio of expected counts is ",
              ctx.num(r.ERR, share(r.ERR)),
              ". They need not agree: a ratio estimated from very few outcomes can be biased for the pooled-pair target.",
            );
          } else {
            smallR.textContent = "A small set of datasets gives a random ratio estimate. This running curve shows its variability; one run cannot measure its repeated-sample bias. The Three outcomes mode supplies an exact one-outcome counterexample.";
            drawRunningChart(s, model, share);
          }

          explanation.textContent = "Pooled pairs divide total weighted errors by total weighted stated pairs. Disclosing outcomes average each error share only where disclosure is positive. Zero-imputation assigns zero to silent outcomes. Undefined ratios remain NA: no disclosure; a zero-imputed mean is a different estimand.";

          table.replaceChildren(
            h("caption", {}, s.mode !== "replays" ? "The distribution over complete report outcomes" : "Replicated datasets: realized counts against the league's fixed true values"),
            h("thead", {}, h("tr", {}, ...["Outcome", "Probability", "Wrong", "Stated", "Error share"].map((t) => h("th", { scope: "col" }, t)))),
            h(
              "tbody",
              {},
              ...model.cases.map((d, i) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row" }, ctx.num(i + 1, formatCount(i + 1))),
                  h("td", {}, ctx.num(d.probability, share(d.probability))),
                  h("td", {}, ctx.num(d.A, s.mode === "mixture" ? share(d.A) : formatCount(d.A))),
                  h("td", {}, ctx.num(d.N, formatCount(d.N))),
                  h("td", {}, ctx.num(d.share, share(d.share))),
                ),
              ),
            ),
          );

          // Concise <= 25-word readout holding all 6 hooks without repeating the bar list underneath
          ctx.readout.set([
            "Pooled pairs ", ro("ERR", r.ERR, share),
            ", disclosing outcomes ", ro("meanFraction", r.meanFraction, share),
            ", zero-imputed ", ro("zeroImputed", r.zeroImputed, share),
            " (disclosure chance ", ro("positiveFrequency", r.positiveFrequency, share),
            ", mean pairs stated ", ro("meanDisclosure", r.meanDisclosure, share),
            " of M = ", ro("M", model.M, formatCount), ").",
          ]);

          ctx.caption.replaceChildren(
            ...(s.mode === "kernel"
              ? ["A hand-set distribution over report outcomes on three units; relative weights are normalized to probabilities. These are illustrative counts."]
              : s.mode === "mixture"
                ? ["A lottery over two complete fixed reports under the theory book’s four-unit law. Expected weighted wrong counts are posterior expectations; reporting randomness chooses a whole report."]
                : [
                    "Monte Carlo, ",
                    ctx.num(s.replays, formatCount(s.replays)),
                    " datasets, seed ",
                    ctx.num(s.seed, formatSetting(s.seed)),
                    ". Reports are optimal cuts of each posterior-mean order with at most ",
                    ctx.num(s.cap, formatCount(s.cap)),
                    s.cap === 1 ? " grade (" : " grades (",
                    ctx.num(
                      familySize(30, { kind: "order", order: Array.from({ length: 30 }, (_, i) => i), G: s.cap }),
                      formatCount(familySize(30, { kind: "order", order: Array.from({ length: 30 }, (_, i) => i), G: s.cap })),
                    ),
                    s.cap === 1
                      ? " cut report per dataset). True values stay fixed across datasets; assumed prior SD "
                      : " cut reports per dataset). True values stay fixed across datasets; assumed prior SD ",
                    ctx.num(s.priorSd, formatSetting(s.priorSd)),
                    ", τ ",
                    ctx.num(s.tau, formatSetting(s.tau)),
                    ".",
                  ]),
          );
        },
      };
    },
  });
}
