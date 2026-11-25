// krw-two (5.7): released KRW97 marginal laws and archived reports, evaluated under one current loss in frame v2.
// Live selection is fixedOrderDP in the recomputed weighted expected-rank order; fixed cards retain their source scope.
// Public URL state: w, tau, cap, report, firm and a canonical whole edited grade vector. No joint law is constructed.
import { createWidget } from "../shared/base.js";
import { gradeRamp, numText, palette, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  dataNum,
  formatCount,
  formatDecimal,
  formatDistinguishing,
  formatExpectedCount,
  formatGrades,
  formatProb,
  formatReadoutEst,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  setNum,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  canonicalGrade,
  conflictPairs,
  disclosure,
  evaluateReport,
  expectedRank,
  fixedOrderDP,
  reportCardRows,
  tauToLambda,
  weightCrossing,
} from "../pr-core.js";
import { caseInput } from "../shared/case-inputs.js";
import FOLDED from "../../data/released/krw-absolute-gender.json" with { type: "json" };
import { appendKrwNotice } from "../shared/krw-model.js";

const INPUT = caseInput("krw");
const KRW = INPUT.source;

export const CONFIG = Object.freeze({
  name: "krw-two",
  w: Object.freeze({ type: "number", min: 0, max: 1, step: 0.01, value: 0.5 }),
  gridStep: 0.05,
  scatter: Object.freeze({
    height: 286,
    mobileHeight: 168,
    marginLeft: 46,
    marginRight: 14,
    marginTop: 24,
    marginBottom: 38,
    r: 4.2,
    rTop: 5.6,
  }),
  risks: Object.freeze({
    height: 286,
    mobileHeight: 168,
    marginLeft: 46,
    marginRight: 102,
    marginTop: 18,
    marginBottom: 38,
  }),
  text: Object.freeze({
    w: "Weight on race",
    firmsTitle: "The firms",
    risksTitle: "Risk against race weight",
    axisRace: "Race gap (log, white − Black)",
    axisGender: "Gender gap (log, male − female)",
    axisW: "Error weight on race",
    raceCard: "race card",
    genderCard: "gender card",
    common: "common grade",
    silence: "withhold all",
    grade1: Object.freeze({
      both: "Grade 1 (ringed) = the high-priority end of the common report under the current criterion error weights; these weight wrong directions, not gap magnitudes.",
      race: "Grade 1 (ringed) = stated highest on the race gap, as the posterior judges it; gender carries no weight.",
      gender: "Grade 1 (ringed) = stated highest on the gender gap, as the posterior judges it; race carries no weight.",
    }),
    firmsAlt: "Scatter of the 97 firms: posterior mean of the race contact gap across, of the gender contact gap up, each firm colored by its grade in the selected report.",
    risksAlt: "Risk under the current withholding cost against the error weight on race: KRW's race and gender cards as straight lines, the common grade as dots, and the risk of withholding every pair.",
  }),
});

// --------------------------------------------------------------------------------------------- data

const U = KRW.tables.units;
const N_UNITS = INPUT.n;
const M = INPUT.M;
const E2 = INPUT.E;
const SET = KRW.facts.common_settings;
const TAU = SET.tau;
const GMAX = SET.G_max;
const CARDS = Object.freeze({
  race: KRW.tables.reports.race_card.slice(),
  gender: KRW.tables.reports.gender_card.slice(),
});
const ARCHIVED = KRW.analyses.case_krw_signed97;
const ARCHIVED_GRADE = ARCHIVED.tables.units.grade.slice();
const W_ARCHIVED = SET.weights.race_signed;

/** The common grade at race weight w: the best report within the weighted expected-rank order. */
const memo = new Map();
function commonAt(w, tau = TAU, cap = GMAX) {
  const key = `${w}|${tau}|${cap}`;
  if (memo.has(key)) return memo.get(key);
  const ww = [w, 1 - w];
  const result = fixedOrderDP(E2, { scores: expectedRank(E2, { w: ww }), direction: "ascending", tau, w: ww, G: cap });
  if (memo.size >= 256) memo.delete(memo.keys().next().value);
  memo.set(key, result);
  return result;
}

/** The risk of a fixed report under the loss with race weight w (a straight line in w). */
const riskAt = (g, w, tau = TAU) => evaluateReport(g, E2, { tau, w: [w, 1 - w] }).risk;
/** The race weight at which each card's risk crosses τ (pr-core weightCrossing; null when it never does). */
const cardCrossings = (tau) => ({
  race: weightCrossing(CARDS.race, E2, { tau }),
  gender: weightCrossing(CARDS.gender, E2, { tau }),
});

// the common grade at every grid weight (computed once, at the first render)
const grids = new Map();
function editedGrade(v) {
  if (typeof v !== "string") return undefined;
  const a = v.trim().split(/[\s,;]+/).map(Number);
  if (a.length !== N_UNITS || a.some((x) => !Number.isInteger(x))) return undefined;
  try {
    return Array.from(canonicalGrade(a)).join(",");
  } catch {
    return undefined;
  }
}

const REPORTS = [
  ["common", "Live common grade"],
  ["archive", "Archived common grade"],
  ["race", "KRW race card"],
  ["gender", "KRW gender card"],
  ["withheld", "Withhold every pair"],
  ["edited", "Edited fixed report"],
];

const CSS = `
.k2 .prx-panel{min-width:0;max-width:100%}
.k2 .k2-vector .prx-num{white-space:normal;overflow-wrap:anywhere}
.k2 .k2-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:.45rem 1.2rem;align-items:start}
.k2 .k2-note{margin:.3rem 0 0;font-size:.8125rem;color:var(--prx-fg-muted)}
.k2 .prx-stage .k2-picked{margin:.24rem 0 0;font-size:.8rem;line-height:1.3;color:var(--prx-plot-fg)}
.k2 .k2-key{margin:.2rem 0 0;padding:.1rem .2rem;gap:.15rem .7rem}
.k2 .k2-tag{margin:.25rem 0 0;font-size:.8125rem;color:var(--prx-fg-muted)}
.k2 .k2-status:empty{display:none}
.k2 .k2-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem 1rem;width:100%}
.k2 .k2-controls>*{min-width:0}
.k2 .k2-detail{margin-top:.75rem}
.k2 .k2-detail:first-child{margin-top:0}
.k2 .k2-tablebox{overflow:auto;max-height:30rem}
.k2 table{border-collapse:collapse;width:100%;font-size:.82rem}
.k2 th,.k2 td{padding:.35rem .45rem;border-bottom:1px solid var(--prx-border);text-align:right;white-space:nowrap}
.k2 th:first-child,.k2 td:first-child{text-align:left}
.k2 .k2-selected{outline:2px solid var(--prx-fg);outline-offset:-2px}
.k2 .k2-tablebox button{font:inherit;color:inherit;background:transparent;border:0;text-align:left;cursor:pointer}
.k2 .k2-tablebox button:focus-visible{outline:2px solid var(--prx-fg)}
.k2 .k2-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}
.k2 .k2-status{min-height:1.2em;margin:.15rem 0;font-size:.78rem;color:var(--prx-fg-muted)}
.k2 textarea{width:100%;box-sizing:border-box;min-height:5rem}
.k2 .k2-error{color:var(--prx-err-text)}
.k2 .k2-vector{overflow-wrap:anywhere;font-size:.8rem}
.k2 .k2-stack p{margin:.35rem 0}
@media(max-width:52em){.k2 .k2-grid{grid-template-columns:minmax(0,1fr);gap:.35rem}}
@media(max-width:48em){
.prx-widget.k2[data-prx-frame="v2"]{padding:.4rem .45rem}
.prx-widget.k2[data-prx-frame="v2"] .prx-toolbar{gap:.2rem .3rem;margin-bottom:.28rem;align-items:flex-end}
.prx-widget.k2[data-prx-frame="v2"] .prx-toolbar>.prx-controls{flex:1 1 100%}
.prx-widget.k2[data-prx-frame="v2"] .prx-toolbar>.prx-presets{flex:0 1 auto}
.prx-widget.k2[data-prx-frame="v2"] .prx-presets>.prx-seg-label{margin:0 0 .08rem;font-size:.76rem;line-height:1.1}
.prx-widget.k2[data-prx-frame="v2"] .prx-presets .prx-seg-buttons{gap:.18rem;flex-wrap:wrap}
.prx-widget.k2[data-prx-frame="v2"] .prx-presets .prx-seg{padding:.18rem .34rem;font-size:.8125rem}
.prx-widget.k2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure{padding:0 .38rem}
.prx-widget.k2[data-prx-frame="v2"] .prx-toolbar>.prx-disclosure>summary{font-size:.78rem}
.prx-widget.k2[data-prx-frame="v2"]>.prx-readout{margin-bottom:.3rem;padding:.22rem .48rem;font-size:.86rem;line-height:1.28}
.prx-widget.k2[data-prx-frame="v2"] .prx-stage{padding:.35rem .45rem}
.k2 .prx-panel-title{margin-bottom:.08rem;font-size:.81rem}
.k2 .k2-key{margin:.1rem 0 0;padding:.04rem .12rem;font-size:.75rem}
.k2 .prx-stage .k2-picked{margin:.14rem 0 0;font-size:.75rem;line-height:1.25}
.k2 .k2-controls,.k2 .k2-settings{grid-template-columns:minmax(0,1fr)}
}
`;

// --------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    frame: "v2",
    className: "k2",
    css: CSS,
    keys: {
      w: CONFIG.w,
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: TAU },
      cap: { type: "integer", min: 1, max: 6, value: GMAX },
      report: { type: "choice", values: REPORTS.map((r) => r[0]), value: "common" },
      firm: { type: "integer", min: 0, max: N_UNITS - 1, value: ARCHIVED_GRADE.indexOf(1) },
      edited: { type: "custom", value: ARCHIVED_GRADE.join(","), parse: editedGrade },
    },
    build(ctx) {
      const { h } = ctx;
      const panel = (title, node) => h("section", { class: "prx-panel k2-detail" }, ctx.panelTitle(title), node);
      const T = CONFIG.text;

      const w = ctx.slider({ label: T.w, ...ctx.key("w"), onInput: (v) => ctx.set({ w: v }) });
      ctx.primaryControl(w.input);
      ctx.controls.append(w.root);

      const tau = ctx.slider({ label: "Withholding cost τ (a wrong direction costs one)", ...ctx.key("tau"), onInput: (v) => ctx.set({ tau: v }) });
      const cap = ctx.slider({ label: "Most grades allowed in the live order search", ...ctx.key("cap"), onInput: (v) => ctx.set({ cap: v }) });
      const report = ctx.select({
        label: "Color firms by this report",
        options: REPORTS.map(([value, labelText]) => ({ value, label: labelText })),
        value: ctx.state.report,
        onChange: (v) => ctx.set({ report: v }),
      });
      const firm = ctx.select({
        label: "Firm to read",
        options: U.firm_name.map((labelText, value) => ({ value, label: labelText })),
        value: ctx.state.firm,
        onChange: (v) => ctx.set({ firm: v }),
      });
      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(h("div", { class: "k2-controls" }, tau.root, cap.root, report.root, firm.root));

      const firmsSlot = h("div", { class: "k2-firms" });
      const risksSlot = h("div", { class: "k2-risks" });
      const gradeKey = h("div", { class: "prx-legend prx-light-panel k2-key", "data-prx-part": "legend" });
      const pickedLine = h("p", { class: "k2-note k2-picked" });
      const srDetail = h("div", { class: "k2-detail prx-sr-only" });
      const status = h("p", { class: "k2-status", "aria-live": "off", "aria-hidden": "true" });

      const scatter = h(
        "section",
        { class: "prx-panel k2-left", "aria-label": "The firms (posterior means, fitted separately)" },
        ctx.panelTitle(T.firmsTitle),
        firmsSlot,
        gradeKey,
        pickedLine,
        srDetail,
      );
      const crossingCue = h("p", { class: "k2-note", "data-prx-readout": "risk-crossings" });
      const riskPanel = h(
        "section",
        { class: "prx-panel k2-right", "aria-label": "Risk at τ = .25 against the race weight" },
        ctx.panelTitle(T.risksTitle),
        risksSlot, crossingCue,
        status,
      );
      // The weight controls the risk paths; the adjacent scatter supplies the firm marginals.
      ctx.stage.removeAttribute("data-prx-primary");
      ctx.primaryGraphic(riskPanel);
      ctx.stage.append(h("div", { class: "k2-grid" }, riskPanel, scatter));

      const label = h("p", { class: "k2-tag" });
      const g1 = h("p", { class: "k2-note" });
      const topFirms = h("div", { class: "k2-tablebox" });
      const ranks = h("div", { class: "k2-tablebox" });
      const ties = h("div", { class: "k2-stack" });
      const selectedSummary = h("div", { class: "k2-stack" });
      const settings = h("div", { class: "k2-settings" });
      const profiles = h("div", { class: "k2-tablebox" });
      const archive = h("div", { class: "k2-stack k2-tablebox" });
      const details = h("div", { class: "k2-tablebox" });
      const card = h("div", { class: "k2-tablebox" });
      const editor = h("textarea", { "aria-label": "Edited grade vector, one integer per firm in original input order" });
      const error = h("p", { class: "k2-error", role: "alert" });

      const syncStop = (slot, i) => {
        for (const b of slot.querySelectorAll(".prx-kbd-point")) {
          const key = b.dataset.prxFocusKey ?? "";
          b.tabIndex = key.slice(key.lastIndexOf(":") + 1) === String(i) ? 0 : -1;
        }
      };
      const N = (v, fmt = formatCount, key) => {
        const node = ctx.num(v, fmt(v));
        if (key) node.dataset.prxReadout = key;
        return node;
      };
      function table(headers, rows, cls = "") {
        return h(
          "table",
          cls ? { class: cls } : {},
          h("thead", {}, h("tr", {}, ...headers.map((text) => h("th", { scope: "col", text })))),
          h("tbody", {}, ...rows.map((cells) => h("tr", {}, ...cells.map((cell) => h("td", {}, cell))))),
        );
      }

      let dirty = false;
      let lastEdited = ctx.state.edited;
      editor.value = lastEdited;
      ctx.listen(editor, "input", () => { dirty = true; });
      ctx.listen(editor, "keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applyEdit(); }
        if (e.key === "Escape") { editor.value = ctx.state.edited; dirty = false; error.textContent = ""; }
      });
      function applyEdit() {
        const value = editedGrade(editor.value);
        if (value === undefined) {
          error.textContent = "Use one integer for each of the firms in the original input order.";
          return;
        }
        dirty = false;
        editor.value = value;
        error.textContent = "";
        ctx.set({ edited: value, report: "edited" });
      }

      const editorPanel = h(
        "section",
        { class: "prx-panel k2-detail" },
        ctx.panelTitle("Edit a fixed report"),
        h("p", {}, "Enter one integer grade per firm in original input order. Smaller numbers indicate higher priority. Apply saves the grades. Escape restores the previous grades."),
        editor,
        ctx.button({ label: "Apply edited report", onClick: applyEdit }).root,
        error,
      );

      const dataBox = ctx.dataBox("Data, crossings and firm cards");
      dataBox.body.append(
        panel("Report ranking under the current loss", ranks),
        panel("Selected firm and marginal intervals", details),
        panel("Every report under the same current loss", profiles),
        panel("Grade one: every firm and marginal interval", topFirms),
        panel("All firms and their marginal intervals, grade one first", card),
        editorPanel,
      );

      const methodBox = ctx.methodBox("Method and posteriors");
      methodBox.body.append(
        g1,
        label,
        panel("The report being colored", selectedSummary),
        panel("Returned minimizing reports in the live order", ties),
        panel("Selection settings and current evaluation", settings),
        panel("The archived common analysis", archive),
      );

      appendKrwNotice(ctx);
      ctx.scrollRegion(card, "All firms, grades and marginal intervals");
      ctx.scrollRegion(profiles, "Full report risk profiles");
      ctx.scrollRegion(details, "Selected firm marginal intervals");
      ctx.scrollRegion(topFirms, "All grade-one firms and marginal intervals");
      ctx.scrollRegion(ranks, "Complete fixed report risk ranking");
      ctx.scrollRegion(archive, "Full archived selection and criterion profile");

      const conflicts = conflictPairs(E2);
      const gradeCells = [];
      const firmRows = [];
      const body = h("tbody");
      U.firm_name.forEach((name, i) => {
        const cell = N(1);
        gradeCells.push(cell);
        const button = h("button", { type: "button", text: name, "data-prx-focus-key": `firm-row:${i}` });
        ctx.listen(button, "click", () => ctx.set({ firm: i }));
        const tr = h(
          "tr",
          {},
          h("th", { scope: "row" }, button),
          h("td", {}, cell),
          ...["mean_race", "lower_race", "upper_race", "mean_gender", "lower_gender", "upper_gender"].map((key) =>
            h("td", {}, N(U[key][i], (v) => formatDecimal(v, { digits: 3 }))),
          ),
        );
        ctx.listen(button, "keydown", (e) => {
          const order = Array.from(body.children);
          const at = order.indexOf(tr);
          const steps = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: order.length - 1 };
          if (!(e.key in steps)) return;
          e.preventDefault();
          const next = order[Math.max(0, Math.min(order.length - 1, steps[e.key]))];
          const j = firmRows.indexOf(next);
          ctx.set({ firm: j });
          next.querySelector("button").focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
        });
        firmRows.push(tr);
        body.append(tr);
      });
      card.append(
        h(
          "table",
          { class: "prx-sticky-first" },
          h("caption", {}, "All firms. Central equal-tail marginal intervals were fitted separately; these are not simultaneous or joint intervals."),
          h("thead", {}, h("tr", {}, ...["Firm", "Grade", "Race mean", "Race lower", "Race upper", "Gender mean", "Gender lower", "Gender upper"].map((text) => h("th", { scope: "col", text })))),
          body,
        ),
      );

      let job = null;
      const cancel = () => {
        if (job) {
          job.cancel?.();
          job = null;
        }
        ctx.root.removeAttribute("aria-busy");
        status.textContent = "";
      };
      ctx.onCleanup(cancel);

      function gridFor(state) {
        const key = `${state.tau}|${state.cap}`;
        if (grids.has(key)) {
          if (job) cancel();
          return grids.get(key);
        }
        if (job?.key === key) return [];
        cancel();
        const current = { key, rows: [], at: 0, cancel: null, tau: state.tau, cap: state.cap };
        job = current;
        ctx.root.setAttribute("aria-busy", "true");
        status.textContent = "Computing the complete weight grid…";
        const step = () => {
          if (job !== current) return;
          const start = ctx.win.performance.now();
          do {
            const x = current.at / 20;
            const d = commonAt(x, current.tau, current.cap);
            current.rows.push({ w: x, risk: d.risk, N: d.N, G: d.G });
            current.at += 1;
          } while (current.at <= 20 && ctx.win.performance.now() - start < 20);
          if (current.at <= 20) {
            current.cancel = ctx.timeout(step, 0);
            return;
          }
          if (grids.size >= 3) grids.delete(grids.keys().next().value);
          grids.set(key, current.rows);
          job = null;
          ctx.root.removeAttribute("aria-busy");
          status.textContent = "";
          ctx.requestRender("weight-grid");
        };
        current.cancel = ctx.timeout(step, 0);
        return [];
      }

      function drawFirms(grade, pal, state) {
        const S = CONFIG.scatter;
        const slotW = Math.round(firmsSlot.clientWidth || ctx.width() || 360);
        const narrow = slotW < 420;
        const height = narrow ? S.mobileHeight : S.height;
        const G = Math.max(...grade);
        const gc = gradeRamp(G, pal);
        const firms = U.firm_name
          .map((name, i) => ({
            i,
            name,
            grade: grade[i],
            x: U.mean_race[i],
            y: U.mean_gender[i],
            fill: gc[grade[i] - 1],
          }))
          .sort((a, b) => b.grade - a.grade || a.i - b.i);
        const top = firms.filter((d) => d.grade === 1);
        const fig = plot(firmsSlot, {
          alt: T.firmsAlt,
          table: {
            caption: [N(N_UNITS), " firms: posterior means of the contact gaps and the selected grade"],
            columns: [
              { label: "Firm", value: "name" },
              { label: "Race gap, posterior mean", value: "x", format: (v) => formatDecimal(v, { digits: 3 }) },
              { label: "Gender gap, posterior mean", value: "y", format: (v) => formatDecimal(v, { digits: 3 }) },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: firms.slice().sort((a, b) => a.grade - b.grade || a.i - b.i),
          },
          height,
          marginLeft: S.marginLeft,
          marginRight: S.marginRight,
          marginTop: S.marginTop,
          marginBottom: S.marginBottom,
          x: {
            label: T.axisRace,
            labelAnchor: "center",
            labelArrow: "none",
            nice: true,
            inset: 10,
            ticks: narrow ? 4 : 5,
          },
          y: {
            label: T.axisGender,
            labelAnchor: "top",
            labelArrow: "none",
            nice: true,
            inset: 10,
            ticks: narrow ? 4 : 5,
          },
          color: { type: "identity" },
          marks: (c, P) => [
            P.ruleY([0], { stroke: c.plotGrid, strokeWidth: 1.2 }),
            P.dot(firms, {
              x: "x",
              y: "y",
              r: (d) => (d.grade === 1 ? S.rTop : S.r),
              fill: "fill",
              stroke: c.plotFg,
              strokeWidth: 0.65,
              strokeOpacity: 0.55,
            }),
            P.dot(top, { x: "x", y: "y", r: S.rTop + 2.5, stroke: c.plotFg, strokeWidth: 1.3 }),
            P.dot(
              firms.filter((d) => d.i === state.firm),
              { x: "x", y: "y", r: 9.5, stroke: c.plotBg, strokeWidth: 4.4 },
            ),
            P.dot(
              firms.filter((d) => d.i === state.firm),
              { x: "x", y: "y", r: 9.5, stroke: c.plotFg, strokeWidth: 2.3 },
            ),
          ],
          keyboard: {
            data: firms.slice().sort((a, b) => a.grade - b.grade || b.x - a.x),
            x: "x",
            y: "y",
            sort: false,
            key: (d) => String(d.i),
            title: (d) =>
              `${d.name}: grade ${formatCount(d.grade)} of ${formatCount(G)}; race gap ${formatDecimal(d.x, { digits: 3 })}, gender gap ${formatDecimal(d.y, { digits: 3 })} (posterior means).`,
            onFocus: (d) => {
              if (ctx.state.firm !== d.i) ctx.set({ firm: d.i });
            },
          },
        });
        syncStop(firmsSlot, state.firm);
        fig.svg.addEventListener("click", (event) => {
          const rect = fig.svg.getBoundingClientRect();
          const W = Number(fig.svg.getAttribute("width")) || rect.width;
          const H = Number(fig.svg.getAttribute("height")) || rect.height;
          const px = ((event.clientX - rect.left) * W) / rect.width;
          const py = ((event.clientY - rect.top) * H) / rect.height;
          const sx = fig.scale("x");
          const sy = fig.scale("y");
          const X = (x) => sx.range[0] + ((x - sx.domain[0]) * (sx.range[1] - sx.range[0])) / (sx.domain[1] - sx.domain[0]);
          const Y = (y) => sy.range[0] + ((y - sy.domain[0]) * (sy.range[1] - sy.range[0])) / (sy.domain[1] - sy.domain[0]);
          const close = firms
            .map((d) => ({ i: d.i, distance: (X(d.x) - px) ** 2 + (Y(d.y) - py) ** 2 }))
            .sort((a, b) => a.distance - b.distance)[0];
          if (close && close.distance < 400) ctx.set({ firm: close.i });
        });
        const sizes = disclosure(grade).sizes;
        gradeKey.replaceChildren(
          h("span", { class: "prx-key" }, "Grades"),
          ...sizes.map((n, k) =>
            h(
              "span",
              { class: "prx-key" },
              h("span", { class: "prx-swatch", style: { background: gc[k], borderRadius: "50%" }, "aria-hidden": "true" }),
              h("span", {}, ctx.num(k + 1, formatCount(k + 1)), ": ", ctx.num(n, formatCount(n)), k === 0 ? " (ringed)" : ""),
            ),
          ),
        );
      }

      function drawRisks(state, dp, pal) {
        const R = CONFIG.risks;
        const slotW = Math.round(risksSlot.clientWidth || ctx.width() || 360);
        const narrow = slotW < 420;
        const height = narrow ? R.mobileHeight : R.height;
        const g = gridFor(state);
        const CROSS = cardCrossings(state.tau);
        const line = (k) => [0, 1].map((x) => ({ w: x, risk: riskAt(CARDS[k], x, state.tau) }));
        const lines = [
          { id: "race", name: T.raceCard, pts: line("race"), stroke: pal.crit[0], ink: pal.critInk[0] },
          { id: "gender", name: T.genderCard, pts: line("gender"), stroke: pal.crit[1], ink: pal.critInk[1] },
        ];
        const at = (k) => riskAt(CARDS[k], state.w, state.tau);
        const crossings = [
          { id: "cross-race", name: T.raceCard, w: CROSS.race, fill: pal.crit[0], ink: pal.critInk[0] },
          { id: "cross-gender", name: T.genderCard, w: CROSS.gender, fill: pal.crit[1], ink: pal.critInk[1] },
        ].filter((d) => d.w !== null);
        const now = [
          { name: T.raceCard, risk: at("race"), fill: pal.crit[0] },
          { name: T.genderCard, risk: at("gender"), fill: pal.crit[1] },
          { name: T.common, risk: dp.risk, fill: pal.post },
        ];
        const pathRows = [
          ...lines.flatMap((l) => l.pts.map((d) => ({ ...d, name: l.name }))),
          ...g.map((d) => ({ ...d, name: T.common })),
          ...now.map((d) => ({ ...d, w: state.w })),
          { name: T.silence, w: 0, risk: state.tau },
          { name: T.silence, w: 1, risk: state.tau },
          ...crossings.map((d) => ({ ...d, risk: state.tau })),
        ];
        const ends = [
          ...lines.map((l) => ({ id: l.id, name: l.name, risk: l.pts[1].risk, ink: l.ink })),
          { id: "common", name: T.common, risk: g.at(-1)?.risk ?? dp.risk, ink: pal.postText },
          { id: "silence", name: T.silence, risk: state.tau, ink: pal.plotFg },
        ];

        plot(risksSlot, {
          alt: T.risksAlt,
          table: {
            caption: ["Risk under cost τ = ", N(state.tau, formatSetting), ", at race weight ", N(state.w, formatSetting)],
            columns: [
              { label: "Report", value: "name" },
              { label: "Race weight", value: "w", format: formatSetting },
              { label: "Risk", value: "risk", format: (v) => formatRisk(v) },
            ],
            rows: pathRows,
          },
          height,
          marginLeft: R.marginLeft,
          marginRight: narrow ? 96 : R.marginRight,
          marginTop: R.marginTop,
          marginBottom: R.marginBottom,
          x: {
            domain: [0, 1],
            inset: 7,
            ticks: [0, 0.25, 0.5, 0.75, 1],
            label: T.axisW,
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: {
            label: null,
            grid: true,
            nice: true,
            insetTop: 18,
            insetBottom: 18,
            ticks: narrow ? 3 : 5,
          },
          color: { type: "identity" },
          marks: (c, P) => [
            P.ruleY([state.tau], { stroke: c.plotFg, strokeWidth: 1.5, strokeDasharray: "5 3" }),
            P.dot(crossings, { x: "w", y: () => state.tau, r: 3.6, fill: c.plotBg, stroke: "fill", strokeWidth: 2 }),
            P.ruleX([state.w], { stroke: c.plotMuted, strokeWidth: 1 }),
            ...lines.map((l) => P.line(l.pts, { x: "w", y: "risk", stroke: l.stroke, strokeWidth: 2.5 })),
            P.dot(g, { x: "w", y: "risk", r: 2.6, fill: c.post }),
            P.dot(now, { x: () => state.w, y: "risk", r: 5, fill: "fill", stroke: c.plotBg, strokeWidth: 1.2 }),
            P.text(crossings, {
              x: "w",
              y: () => state.tau,
              text: (d) => formatProb(d.w, { digits: 2 }),
              render(index, scales, values) {
                const grp = svgEl(ctx.doc, "g", { "aria-label": "text" });
                const sorted = Array.from(index).sort((a, b) => values.x[a] - values.x[b]);
                let prevRight = -Infinity;
                for (const i of sorted) {
                  const d = crossings[i];
                  const txt = formatProb(d.w, { digits: 2 });
                  const pillW = Math.ceil(txt.length * 7.8 + 8);
                  let px = values.x[i];
                  if (px - pillW / 2 < prevRight + 4) px = prevRight + 4 + pillW / 2;
                  prevRight = px + pillW / 2;
                  const py = Math.max(11, values.y[i] - 13);
                  grp.append(
                    svgEl(ctx.doc, "rect", {
                      x: px - pillW / 2,
                      y: py - 8.5,
                      width: pillW,
                      height: 17,
                      rx: 3,
                      fill: c.plotBg,
                      fillOpacity: 0.92,
                    }),
                    svgEl(ctx.doc, "text", {
                      x: px,
                      y: py,
                      fill: d.ink,
                      fontWeight: 700,
                      fontSize: 13,
                      dominantBaseline: "central",
                      textAnchor: "middle",
                      style: { textAnchor: "middle" },
                      "data-num": dataNum(d.w),
                      text: txt,
                    }),
                  );
                }
                return grp;
              },
            }),
            P.text([now[2]], {
              x: () => state.w,
              y: "risk",
              text: (d) => formatReadoutRisk(d.risk),
              render(index, scales, values, dims) {
                const grp = svgEl(ctx.doc, "g", { "aria-label": "text" });
                for (const i of index) {
                  const d = now[2];
                  const txt = formatReadoutRisk(d.risk);
                  const pillW = Math.ceil(txt.length * 7.8 + 8);
                  const anchor = state.w > 0.72 ? "end" : "start";
                  const px = values.x[i] + (anchor === "end" ? -8 : 8);
                  const py = Math.min(dims.height - dims.marginBottom - 9, values.y[i] + 15);
                  const rx0 = anchor === "end" ? px - pillW + 3 : px - 3;
                  grp.append(
                    svgEl(ctx.doc, "rect", {
                      x: rx0,
                      y: py - 8.5,
                      width: pillW,
                      height: 17,
                      rx: 3,
                      fill: c.plotBg,
                      fillOpacity: 0.92,
                    }),
                    svgEl(ctx.doc, "text", {
                      x: px,
                      y: py,
                      fill: c.plotFg,
                      fontWeight: 700,
                      fontSize: 13,
                      dominantBaseline: "central",
                      textAnchor: anchor,
                      style: { textAnchor: anchor },
                      "data-num": dataNum(d.risk),
                      "data-prx-readout": "common-risk-mark",
                      text: txt,
                    }),
                  );
                }
                return grp;
              },
            }),
            P.text(ends, {
              x: 1,
              y: "risk",
              text: "name",
              render(index, scales, values, dims) {
                const items = Array.from(index, (i) => ({ id: ends[i].id, y: values.y[i], height: 17 }));
                const placed = placeDirectLabels(items, {
                  minGapPx: 17,
                  bounds: [dims.marginTop + 9, dims.height - dims.marginBottom - 9],
                });
                const byId = new Map(placed.map((p) => [p.id, p]));
                const grp = svgEl(ctx.doc, "g", { "aria-label": "text" });
                for (const i of index) {
                  const d = ends[i];
                  const px = values.x[i] + 7;
                  const py = byId.get(d.id)?.y ?? values.y[i];
                  const pillW = Math.ceil(d.name.length * 7.2 + 7);
                  grp.append(
                    svgEl(ctx.doc, "rect", {
                      x: px - 3,
                      y: py - 8.5,
                      width: pillW,
                      height: 17,
                      rx: 3,
                      fill: c.plotBg,
                      fillOpacity: 0.92,
                    }),
                    svgEl(ctx.doc, "text", {
                      x: px,
                      y: py,
                      fill: d.ink,
                      fontWeight: 700,
                      fontSize: 13,
                      dominantBaseline: "central",
                      textAnchor: "start",
                      style: { textAnchor: "start" },
                      text: d.name,
                    }),
                  );
                }
                return grp;
              },
            }),
          ],
          keyboard: {
            data: pathRows,
            x: "w",
            y: "risk",
            sort: false,
            title: (d) =>
              `${d.name} at race weight ${formatSetting(d.w)}: risk ${formatRisk(d.risk)}${Math.abs(d.risk - state.tau) <= 1e-12 ? ", equal to" : d.risk < state.tau ? ", below" : ", above"} the ${formatSetting(state.tau)} of withholding every pair.`,
          },
        });
      }

      /** Whether the common grade and each KRW card beat withholding every pair at w. */
      function writeReadout(state, dp) {
        const set = (v) => ctx.num(v, formatSetting(v));
        const rStr = dp.N > 0 && dp.risk !== state.tau
          ? formatDistinguishing(dp.risk, state.tau, { minSig: 3 })
          : formatReadoutRisk(dp.risk);
        const name = Math.abs(state.w - W_ARCHIVED) < 1e-9
          ? ["Equal weights"]
          : state.w >= 1
            ? ["Race only"]
            : state.w <= 0
              ? ["Gender only"]
              : state.w > W_ARCHIVED
                ? ["Race weight ", set(state.w)]
                : ["Gender weight ", set(1 - state.w)];
        const beats = dp.risk < state.tau;
        const race = riskAt(CARDS.race, state.w, state.tau) < state.tau;
        const gender = riskAt(CARDS.gender, state.w, state.tau) < state.tau;
        if (dp.N === 0) {
          const cards = race && gender
            ? "Both KRW cards beat that risk."
            : race || gender
              ? `The fixed ${race ? "race" : "gender"} card beats that risk.`
              : "Neither KRW card beats that risk.";
          ctx.readout.set([
            ...name, ": the live common grade states no pairs. Its risk ", ctx.num(dp.risk, rStr),
            " equals the withholding cost ", set(state.tau), ". ", cards,
          ]);
          return;
        }
        let cards;
        if (race && gender) cards = beats ? "so do both KRW cards" : "both KRW cards do";
        else if (race || gender) {
          const [k, other] = race ? ["race", "gender"] : ["gender", "race"];
          cards = beats ? `so does KRW's ${k} card, not its ${other} card` : `KRW's ${k} card does`;
        } else cards = beats ? "neither KRW card does" : "nor does either KRW card";
        ctx.readout.set([
          ...name, ": the common grade ", beats ? "beats" : "does not beat", " withholding every pair (",
          ctx.num(dp.risk, rStr), " against ", set(state.tau), "); ", cards, ".",
        ]);
      }

      return {
        render(state, meta = {}) {
          if (meta.reason === "disclosure") return;
          riskPanel.setAttribute("aria-label", `Risk at τ = ${formatSetting(state.tau)} against the race weight`);
          w.set(state.w);
          tau.set(state.tau);
          cap.set(state.cap);
          report.set(state.report);
          firm.set(state.firm);
          if (state.edited !== lastEdited || meta.changed?.includes("report")) {
            editor.value = state.edited;
            lastEdited = state.edited;
            dirty = false;
          } else if (!dirty) {
            editor.value = state.edited;
          }
          editorPanel.hidden = state.report !== "edited";

          const pal = palette(ctx.stage);
          const dp = commonAt(state.w, state.tau, state.cap);
          const grade = Array.from(
            state.report === "common"
              ? dp.grade
              : state.report === "archive"
                ? ARCHIVED_GRADE
                : state.report === "race"
                  ? CARDS.race
                  : state.report === "gender"
                    ? CARDS.gender
                    : state.report === "withheld"
                      ? Array(N_UNITS).fill(1)
                      : state.edited.split(",").map(Number),
          );
          const ev = evaluateReport(grade, E2, { tau: state.tau, w: [state.w, 1 - state.w] });
          drawFirms(grade, pal, state);
          drawRisks(state, dp, pal);

          const isArchived =
            state.tau === TAU &&
            state.cap === GMAX &&
            Math.abs(state.w - W_ARCHIVED) < 1e-12 &&
            Array.from(dp.grade).every((v, idx) => v === ARCHIVED_GRADE[idx]);

          g1.textContent = state.report === "common"
            ? (state.w >= 1 ? T.grade1.race : state.w <= 0 ? T.grade1.gender : T.grade1.both)
            : state.report === "race"
              ? "Grade one (ringed) = stated highest white-name over Black-name contact advantage in the fixed race card."
              : state.report === "gender"
                ? "Grade one (ringed) = stated highest male-name over female-name contact advantage in the fixed gender card."
                : state.report === "archive"
                  ? T.grade1.both
                  : state.report === "withheld"
                    ? "Every firm shares grade one: this report states no pairwise directions."
                    : "Grade one is the high-priority end of your edited report; a shared grade withholds comparisons.";

          label.replaceChildren(
            "Live common grade: ",
            tagNode(ctx, dp, { key: "order", orderWords: "weighted expected-rank order" }),
            ...(isArchived
              ? ["; also ", tagNode(ctx, ARCHIVED.facts, { key: "archived" }), " over all reports with at most ", ctx.num(GMAX, formatSetting(GMAX)), " grades"]
              : []),
            ".",
          );

          writeReadout(state, dp);

          selectedSummary.replaceChildren(
            h("p", {}, REPORTS.find((r) => r[0] === state.report)[1], ": ", N(ev.N, formatCount, "selected-N"), " of ", N(ev.M), " pairs stated; risk ", N(ev.risk, formatRisk, "selected-risk"), "."),
            h("p", { class: "k2-vector" }, "Grade vector ", N(grade, formatGrades, "selected-grade")),
            state.report === "common" ? tagNode(ctx, dp, { orderWords: "weighted expected-rank order" }) : captionNode(ctx, "fixed-report"),
          );

          const current = [
            ["live", dp.grade],
            ["archive", ARCHIVED_GRADE],
            ["race", CARDS.race],
            ["gender", CARDS.gender],
            ["withheld", Array(N_UNITS).fill(1)],
          ];
          if (state.report === "edited") current.push(["edited", grade]);

          profiles.replaceChildren(
            table(
              ["Report", "Outcome", "Expected wrong E", "Wrong per stated pair E/N", "Wrong per pair E/M", "Criterion risk", "Weighted risk", "N", "Weighted expected errors", "Error contribution", "Withholding contribution"],
              current.flatMap(([id, g]) => {
                const e = evaluateReport(g, E2, { tau: state.tau, w: [state.w, 1 - state.w] });
                return ["Race", "Gender"].map((name, k) => [
                  id === "live" ? "Live common grade" : REPORTS.find((r) => r[0] === id)?.[1] ?? id,
                  name,
                  N(e.E[k], formatExpectedCount, `${id}-E-${k}`),
                  N(e.EoverN[k], formatShare, `${id}-share-${k}`),
                  N(e.EoverM[k], formatShare, `${id}-perpair-${k}`),
                  N(e.Rk[k], formatRisk, `${id}-Rk-${k}`),
                  N(e.risk, formatRisk, `${id}-risk-${k}`),
                  N(e.N, formatCount, `${id}-N-${k}`),
                  N(e.Ew, formatExpectedCount),
                  N(e.errorTerm, formatRisk),
                  N(e.withholdingTerm, formatRisk),
                ]);
              }),
              "prx-sticky-first",
            ),
          );

          const cross = cardCrossings(state.tau);
          crossingCue.replaceChildren("Selected: ", REPORTS.find(r => r[0] === state.report)[1],
            ". At the withholding line, race-card crossing w = ", N(cross.race, formatProb),
            ", gender-card crossing w = ", N(cross.gender, formatProb), ".");
          const af = ARCHIVED.facts;
          settings.replaceChildren(
            h(
              "div",
              {},
              h("p", {}, "Current live order search: withholding cost ", N(state.tau, formatSetting), " (λ = ", N(tauToLambda(state.tau), formatSetting), "), at most ", N(state.cap), " grades; race weight ", N(state.w, formatSetting), ", gender weight ", N(1 - state.w, formatSetting), "."),
              h("p", {}, "The browser orders firms by their weighted average posterior ranks. A rank of one is highest priority. Changing the weights can change the order. Firms with equal scores stay in one grade."),
            ),
            h(
              "div",
              {},
              h("p", {}, "Archived common selection: τ = ", N(TAU, formatSetting), " (λ = ", N(tauToLambda(TAU), formatSetting), "), at most ", N(GMAX), " grades; equal weights."),
              h("p", {}, "KRW card selection: λ = ", N(KRW.facts.card_lambda, formatSetting), ", that is τ = ", N(KRW.facts.card_tau, formatSetting), "; one criterion each. Here both cards are fixed reports under the current common loss. Equal numbers for λ and τ are different costs."),
            ),
          );

          archive.replaceChildren(
            h("p", {}, "Recorded selection: ", tagNode(ctx, af, { key: "archive-record" }), "; status ", af.status, "; stored risk ", N(af.risk, formatRisk, "archive-stored-risk"), "; lower bound ", N(af.lower_bound, formatRisk, "archive-bound"), "; absolute gap ", N(af.gap, formatSci, "archive-gap"), ". Bound source: ", af.bound_source, "."),
            h("p", {}, "These stored solve fields apply to the archived cost, weights and cap above. A zero gap is not a numerical certificate."),
            h("p", {}, isArchived ? "At these settings the live order search reproduces the complete archived grade vector, stated count and risk." : "The live search is scoped to its current weighted expected-rank order; the archived report remains a fixed comparison."),
            h("p", { class: "k2-vector" }, "Archived grade vector ", N(ARCHIVED_GRADE, formatGrades, "archive-grade")),
            h("p", {}, "Race-weight crossings of withholding: race card ", N(cross.race, (v) => formatProb(v, { digits: 2 }), "cross-race"), "; gender card ", N(cross.gender, (v) => formatProb(v, { digits: 2 }), "cross-gender"), ". NA means no interior crossing."),
            h("p", {}, "Across the supplied firms, the signed posterior means have correlation ", N(FOLDED.facts.signed_mean_correlation.value, (v) => formatDecimal(v, { digits: 3 }), "mean-correlation"), ". This is across-firm association, not a joint posterior. Opposite more-likely criterion directions occur for ", N(conflicts.count, formatCount, "conflict-count"), " of ", N(M), " pairs."),
          );

          selectedSummary.append(
            h("p", {}, "Live order family: ", N(dp.family.size, formatCount, "live-family"), dp.family.sizeExact === 1n ? " report; " : " reports; ", N(dp.tieCount, formatCount, "live-ties"), " minimizing report", dp.tieCount === 1 ? "" : "s", " at equal-risk tolerance ", N(dp.tieTol, formatSci, "live-tolerance"), "."),
            h("p", { class: "k2-vector" }, "Live grade vector ", N(Array.from(dp.grade), formatGrades, "live-grade")),
            h("p", {}, "A shared grade leaves a direction unstated. Reports can state different numbers of pairs under the same loss. Changing the weights or withholding cost changes that loss."),
          );

          const original = evaluateReport(ARCHIVED_GRADE, E2, { tau: TAU, w: [W_ARCHIVED, 1 - W_ARCHIVED] });
          archive.append(
            h("p", {}, "Archived joint profile at its original settings (criterion risks, not probabilities of a joint event):"),
            table(
              ["Criterion", "Expected wrong E", "E/N", "E/M", "Criterion risk"],
              ["Race", "Gender"].map((name, k) => [
                name,
                N(original.E[k], formatExpectedCount, `archive-original-E-${k}`),
                N(original.EoverN[k], formatShare, `archive-original-share-${k}`),
                N(original.EoverM[k], formatShare),
                N(original.Rk[k], formatRisk, `archive-original-Rk-${k}`),
              ]),
            ),
          );

          const ranked = current
            .map(([id, g]) => ({ id, e: evaluateReport(g, E2, { tau: state.tau, w: [state.w, 1 - state.w] }) }))
            .sort((a, b) => a.e.risk - b.e.risk);
          ranks.replaceChildren(
            table(
              ["Report", "Weighted risk", "Pairs stated", "Share stated"],
              ranked.map(({ id, e }) => [
                id === "live" ? "Live common grade" : REPORTS.find((r) => r[0] === id)?.[1] ?? id,
                N(e.risk, formatRisk),
                N(e.N),
                N(e.s, formatShare),
              ]),
            ),
            h("p", {}, "Criterion risk adds expected wrong directions and the withholding cost for silent pairs, divided by all pairs. Weighted risk averages the criterion risks using the current weights. Ranks compare the same current loss. With no statements, E/N is NA; E/M is zero. ", captionNode(ctx, "krw-card")),
          );

          ties.replaceChildren(
            h("p", {}, N(dp.grades.length), " of ", N(dp.tieCount), " minimizing reports returned, in ", dp.gradesOrder, " order, at tolerance ", N(dp.tieTol, formatSci), ". The first is used throughout the linked views."),
            ...dp.grades.map((g, j) => h("p", { class: "k2-vector" }, "Report ", N(j + 1), ": ", N(Array.from(g), formatGrades))),
          );

          const g1rows = reportCardRows(grade, { ids: E2.ids, mean: U.mean_race }, "mean").filter((j) => grade[j] === 1);
          topFirms.replaceChildren(
            table(
              ["Firm", "Race mean", "Race lower", "Race upper", "Gender mean", "Gender lower", "Gender upper"],
              g1rows.map((j) => [
                U.firm_name[j],
                ...["mean_race", "lower_race", "upper_race", "mean_gender", "lower_gender", "upper_gender"].map((key) =>
                  N(U[key][j], (v) => formatDecimal(v, { digits: 3 })),
                ),
              ]),
              "prx-sticky-first",
            ),
            h("p", {}, "These are marginal intervals at level ", N(KRW.facts.interval_level, formatShare), ". Grade one means stated highest in this report, and a shared grade withholds comparisons."),
          );

          const i = state.firm;
          const fmtEst = (v) => (Math.abs(v) > 0 && Math.abs(v) < 0.0005 ? formatReadoutEst(v) : formatDecimal(v, { digits: 3 }));
          pickedLine.replaceChildren(
            "Selected: ",
            h("strong", { "data-prx-name": "", text: U.firm_name[i] }),
            " (grade ",
            N(grade[i]),
            ") · race ",
            N(U.mean_race[i], fmtEst),
            " [",
            N(U.lower_race[i], fmtEst),
            ", ",
            N(U.upper_race[i], fmtEst),
            "] · gender ",
            N(U.mean_gender[i], fmtEst),
            " [",
            N(U.lower_gender[i], fmtEst),
            ", ",
            N(U.upper_gender[i], fmtEst),
            "]",
          );
          details.replaceChildren(
            h("p", {}, U.firm_name[i], "; grade ", N(grade[i]), "."),
            table(
              ["Target", "Posterior mean", "Lower", "Upper"],
              ["race", "gender"].map((key) => [
                key,
                N(U[`mean_${key}`][i], (v) => formatDecimal(v, { digits: 3 })),
                N(U[`lower_${key}`][i], (v) => formatDecimal(v, { digits: 3 })),
                N(U[`upper_${key}`][i], (v) => formatDecimal(v, { digits: 3 })),
              ]),
            ),
            h("p", {}, "Marginal interval level ", N(KRW.facts.interval_level, formatShare), "; fitted separately, with no within-firm joint law."),
          );
          srDetail.replaceChildren(
            h("p", {}, U.firm_name[i], "; grade ", N(grade[i]), "."),
            h(
              "table",
              {},
              h("caption", {}, "Selected firm marginal intervals"),
              h("thead", {}, h("tr", {}, ...["Target", "Posterior mean", "Lower", "Upper"].map((text) => h("th", { scope: "col", text })))),
              h(
                "tbody",
                {},
                ...["race", "gender"].map((key) =>
                  h(
                    "tr",
                    {},
                    h("td", {}, key),
                    h("td", {}, N(U[`mean_${key}`][i], (v) => formatDecimal(v, { digits: 3 }))),
                    h("td", {}, N(U[`lower_${key}`][i], (v) => formatDecimal(v, { digits: 3 }))),
                    h("td", {}, N(U[`upper_${key}`][i], (v) => formatDecimal(v, { digits: 3 }))),
                  ),
                ),
              ),
            ),
          );

          gradeCells.forEach((node, j) => setNum(node, grade[j], formatCount(grade[j])));
          firmRows.forEach((row, j) => {
            row.classList.toggle("k2-selected", j === i);
            row.querySelector("button").tabIndex = j === i ? 0 : -1;
            if (j === i) row.setAttribute("aria-current", "true");
            else row.removeAttribute("aria-current");
          });
          reportCardRows(grade, { ids: E2.ids, mean: U.mean_race }, "mean").forEach((j) => body.append(firmRows[j]));
        },
      };
    },
  });
}
