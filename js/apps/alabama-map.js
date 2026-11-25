// alabama-map (5.12): full released 67-county geometry, supplied marginal intervals and archived reports.
// One public state drives linked selection, exact fixed-report evaluation and live weighted expected-rank DP.
// The archived commonality table retains its original own-best solver bounds; it is not recomputed for a new loss.
import { createWidget } from "../shared/base.js";
import { gradeRamp, numText, palette, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  setNum,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import { ro } from "../shared/readout.js";
import {
  canonicalGrade,
  disclosure,
  evaluateReport,
  expectedRank,
  fixedOrderDP,
  relationChange,
  reportCardRows,
} from "../pr-core.js";
import { caseInput } from "../shared/case-inputs.js";
import GEO from "../../data/released/census-geojson.json" with { type: "json" };

const INPUT = caseInput("alabama");
const AL = INPUT.source;

export const CONFIG = Object.freeze({
  name: "alabama-map",
  w: Object.freeze({ type: "number", min: 0, max: 1, step: 0.01, value: 0.5 }),
  // Transverse Mercator centered on Alabama (standard north-south state projection)
  rotate: Object.freeze([86.7, -32.6]),
  // A grade with at most maxNamed counties is named in the key; grade 1 is outlined (map) and ringed (scatter)
  // when it has at most maxOutlined counties, so a small top grade catches the eye.
  maxNamed: 1,
  maxOutlined: 2,
  map: Object.freeze({
    desktopHeight: 416,
    mobileHeight: 192,
    margin: 4,
    stroke: 0.65,
    outline: 2.0,
    countyBorder: "#9aa6a1",
  }),
  scatter: Object.freeze({
    desktopHeight: 416,
    mobileHeight: 176,
    marginLeft: 50,
    marginRight: 16,
    marginTop: 20,
    marginBottom: 42,
    rDesktop: 4.3,
    rMobile: 3.6,
    inset: 6,
  }),
  bars: Object.freeze({
    desktopHeight: 62,
    mobileHeight: 58,
    marginLeft: 102,
    marginRight: 52,
    marginTop: 4,
    marginBottom: 20,
    top: 0.4,
  }),
  text: Object.freeze({
    w: "Weight on income",
    mapTitle: "The selected report",
    outcomesTitle: "Counties on the two outcomes",
    errorsTitle: "Share of stated directions expected wrong",
    axisIncome: "Income rank (percentile)",
    axisIncarceration: "Incarceration (%), lower is up",
    income: "Income",
    incarceration: "Incarceration",
    keyTitle: "Grade",
    grade1:
      "Grade 1 = stated highest on the weighted outcomes, as the posterior judges it: the most favorable historical outcomes, not need.",
    mapAlt:
      "Map of Alabama's 67 counties, each colored by its grade in the selected report. The selected county has a dashed halo. A small top grade has a solid outline.",
    outcomesAlt:
      "Scatter of the 67 counties: income rank across, incarceration rate down (lower is higher on the chart), each county colored by its grade.",
    barsAlt:
      "Two bars: the share of stated directions expected to be wrong on income and on incarceration.",
  }),
});

// --------------------------------------------------------------------------------------------- data

const U = AL.tables.units;
const N_UNITS = U.fips.length;
const M = INPUT.M;
const E = INPUT.E;
const SET = AL.facts.reference_settings;
const TAU = SET.tau;
const GMAX = SET.G_max;
const FEATURES = U.fips.map((f) => GEO.features.find((x) => x.properties.fips === f));

const memo = new Map();
function commonAt(w, tau = TAU, cap = GMAX) {
  const key = `${w}|${tau}|${cap}`;
  if (memo.has(key)) return memo.get(key);
  const ww = [w, 1 - w];
  const result = fixedOrderDP(E, {
    scores: expectedRank(E, { w: ww }),
    direction: "ascending",
    tau,
    w: ww,
    G: cap,
  });
  if (memo.size >= 128) memo.delete(memo.keys().next().value);
  memo.set(key, result);
  return result;
}

const SOURCE_REPORTS = AL.tables.reports;
const REPORTS = [
  ["common", "Live common grade"],
  ["P", "Archived common P"],
  ["D1", "Archived income D1"],
  ["D2", "Archived incarceration D2"],
  ["B0", "B0: withhold every pair"],
  ["B1", "B1: observed-rank quantile cuts"],
  ["B2", "B2: posterior-mean rank quantile cuts"],
  ["B3", "B3: expected-rank order search"],
  ["withheld", "Withhold every pair"],
  ["edited", "Edited fixed report"],
];

function editedGrade(v) {
  if (typeof v !== "string") return undefined;
  const g = v.trim().split(/[\s,;]+/).map(Number);
  if (g.length !== N_UNITS || g.some((x) => !Number.isInteger(x))) return undefined;
  try {
    return Array.from(canonicalGrade(g)).join(",");
  } catch {
    return undefined;
  }
}

const CSS = `
.al .prx-panel { min-width: 0; max-width: 100%; }
.al .prx-toolbar > .prx-controls { flex: 1 1 100%; margin: 0; }
.al .prx-toolbar > .prx-controls .prx-slider { max-width: 24rem; }
.al .prx-toolbar > .prx-presets { flex: 1 1 auto; }
.al .al-controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem 1rem; width: 100%; }
.al .al-controls > * { min-width: 0; }
.al .al-left { display: grid; gap: 0.55rem; min-width: 0; }
.al .al-primary-stage { display: grid; gap: 0.55rem; min-width: 0; }
.al .al-outcome-bars { display: grid; gap: 0.2rem; min-width: 0; padding-bottom: 0.35rem; border-bottom: 1px solid var(--prx-border); }
.al .al-bars-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.25rem 0.9rem; }
.al .al-bars-head > .prx-panel-title { margin: 0; }
.al .al-key { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.65rem; margin: 0; padding: 0; font-size: 0.8125rem; line-height: 1.3; }
.al .al-key .al-key-title { font-weight: 700; color: var(--prx-fg); }
.al .al-key .prx-key { gap: 0.28rem; white-space: nowrap; }
.al .al-key .prx-swatch { width: 0.92rem; height: 0.92rem; }
.al .al-visual-grid { display: grid; grid-template-columns: minmax(15rem, .9fr) minmax(0, 1.1fr); gap: 0.85rem 1.5rem; align-items: start; min-width: 0; }
.al .al-map-panel, .al .al-scatter-panel { min-width: 0; }
.al .al-map-panel > .prx-panel-title, .al .al-scatter-panel > .prx-panel-title { margin: 0 0 0.2rem; }
.al .al-map path[data-county] { cursor: pointer; }
.al .al-stage-detail { margin: 0; display: grid; gap: 0.45rem; align-content: start; }
.al .al-county-head { margin: 0; font-size: 0.84375rem; line-height: 1.3; }
.al .al-sign-cue { color: var(--prx-fg-muted); font-size: 0.8125rem; }
.al .al-stage-table-wrap { min-width: 0; width: 100%; overflow-x: auto; }
.al .al-stage-detail table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.al .al-stage-detail th, .al .al-stage-detail td { padding: 0.14rem 0.35rem; border-bottom: 1px solid var(--prx-border); text-align: right; white-space: nowrap; }
.al .al-stage-detail th:first-child, .al .al-stage-detail td:first-child { text-align: left; }
.al .al-own-panel { margin-top: 0.65rem; padding-top: 0.55rem; border-top: 1px solid var(--prx-border); display: grid; gap: 0.35rem; max-width: 24rem; }
.al .al-own-note { margin: 0; font-size: 0.8125rem; color: var(--prx-fg-muted); }
.al .prx-disclosures .al-detail + .al-detail { margin-top: 0.85rem; }
.al .al-box { overflow: auto; max-height: 32rem; }
.al .prx-disclosures table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.al .prx-disclosures th, .al .prx-disclosures td { padding: 0.32rem 0.4rem; border-bottom: 1px solid var(--prx-border); text-align: right; white-space: nowrap; }
.al .prx-disclosures th:first-child, .al .prx-disclosures td:first-child { text-align: left; }
.al .al-box button { font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer; text-align: left; padding: 0.1rem 0; }
.al .al-selected { outline: 2px solid var(--prx-fg); outline-offset: -2px; }
.al .al-vector { overflow-wrap: anywhere; font-size: 0.8rem; }
.al .al-vector .prx-num { white-space: normal; overflow-wrap: anywhere; }
.al .al-stack p { margin: 0.35rem 0; }
.al textarea { width: 100%; min-height: 5rem; box-sizing: border-box; font: inherit; padding: 0.35rem 0.5rem; color: var(--prx-fg); background: var(--prx-bg); border: 1px solid var(--prx-border-strong); border-radius: 5px; }
.al .al-error { color: var(--prx-err-text); margin: 0.25rem 0 0; }
.al .al-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.al .al-cardbox { overflow: auto; }
.al .al-cardplot { min-width: 510px; }
@media (max-width: 52em) {
  .al .al-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 44em) {
  .prx-widget.al[data-prx-frame="v2"] { padding: 0.35rem 0.25rem; }
  .prx-widget.al[data-prx-frame="v2"] .prx-toolbar { gap: 0.2rem 0.4rem; margin-bottom: 0.24rem; }
  .prx-widget.al[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider { max-width: none; flex-basis: 100%; }
  .prx-widget.al[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 100%; }
  .prx-widget.al[data-prx-frame="v2"] .prx-presets > .prx-seg-label { font-size: 0.78rem; margin-bottom: 0.06rem; }
  .prx-widget.al[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.16rem 0.24rem; }
  .prx-widget.al[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.08rem 0.24rem; font-size: 0.79rem; line-height: 1.15; justify-content: center; text-align: center; }
  .prx-widget.al[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure { padding: 0 0.5rem; }
  .prx-widget.al[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary { padding: 0.08rem 0; font-size: 0.79rem; }
  .prx-widget.al[data-prx-frame="v2"] > .prx-readout, .prx-widget.al[data-prx-frame="v2"] .prx-readout { padding: 0.2rem 0.42rem; margin-bottom: 0.25rem; font-size: 0.84rem; line-height: 1.25; }
  .al .prx-stage { padding: 0.3rem 0.2rem; }
  .al .al-visual-grid { grid-template-columns: minmax(0, 1fr); gap: 0.35rem; align-items: start; }
  .al .al-map-panel .al-map { max-width: 240px; margin-inline: auto; }
  .al .al-stage-detail, .al .al-cards { grid-template-columns: minmax(0, 1fr); }
  .al .al-stage-detail { gap: 0.12rem; padding-top: 0.2rem; }
  .al .al-primary-stage { gap: 0.2rem; }
  .al .al-outcome-bars { padding-bottom: 0.15rem; gap: 0.1rem; }
  .al .al-bars-head { gap: 0.12rem 0.5rem; }
  .al .al-key { gap: 0.12rem 0.45rem; font-size: 0.76rem; }
  .al .al-map-panel > .prx-panel-title, .al .al-scatter-panel > .prx-panel-title { margin: 0 0 0.08rem; font-size: 0.78rem; line-height: 1.15; }
}
@media (max-width: 34em) {
  .al .al-controls { grid-template-columns: minmax(0, 1fr); }
}
`;

// --------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    className: "al",
    css: CSS,
    frame: "v2",
    keys: {
      w: CONFIG.w,
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: TAU },
      cap: { type: "integer", min: 1, max: 6, value: GMAX },
      report: { type: "choice", values: REPORTS.map((r) => r[0]), value: "common" },
      county: { type: "integer", min: 0, max: N_UNITS - 1, value: SOURCE_REPORTS.P.indexOf(1) },
      overlay: { type: "choice", values: ["none", "income", "incarceration"], value: "none" },
      edited: { type: "custom", parse: editedGrade, value: SOURCE_REPORTS.P.join(",") },
    },
    build(ctx) {
      const { h } = ctx;
      const r = ro(ctx);
      const clearZeroTabIndex = (slot) => {
        for (const b of slot.querySelectorAll('.prx-kbd-point[tabindex="0"]')) {
          b.removeAttribute("tabindex");
        }
      };
      const syncStop = (slot, i) => {
        for (const b of slot.querySelectorAll(".prx-kbd-point")) {
          const key = b.dataset.prxFocusKey ?? "";
          if (key.slice(key.lastIndexOf(":") + 1) === String(i)) b.removeAttribute("tabindex");
          else b.setAttribute("tabindex", "-1");
        }
      };
      const N = (v, fmt = formatCount, key) => {
        const n = ctx.num(v, fmt(v));
        if (key) n.dataset.prxReadout = key;
        return n;
      };
      function table(headers, rowsList) {
        return h(
          "table",
          {},
          h("thead", {}, h("tr", {}, ...headers.map((text) => h("th", { scope: "col", text })))),
          h("tbody", {}, ...rowsList.map((c) => h("tr", {}, ...c.map((v) => h("td", {}, v))))),
        );
      }
      const panel = (title, node) => h("section", { class: "prx-panel al-detail" }, ctx.panelTitle(title), node);
      const T = CONFIG.text;

      // Toolbar: primary weight slider, Presets, and Settings in standard v2 order
      const settingsBox = ctx.settingsBox("Settings");
      const tau = ctx.slider({
        label: "Withholding cost τ (a wrong direction costs one)",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      const cap = ctx.slider({
        label: "Most grades allowed in the live order search",
        ...ctx.key("cap"),
        onInput: (v) => ctx.set({ cap: v }),
      });
      const report = ctx.select({
        label: "Color counties by this report",
        options: REPORTS.map(([value, label]) => ({ value, label })),
        value: ctx.state.report,
        onChange: (v) => ctx.set({ report: v }),
      });
      const county = ctx.select({
        label: "County to read",
        options: U.name.map((label, value) => ({ value, label })),
        value: ctx.state.county,
        onChange: (v) => ctx.set({ county: v }),
      });
      const overlay = ctx.select({
        label: "Show the outcome’s own archived map",
        options: [
          { value: "none", label: "No own-report map" },
          { value: "income", label: "Income: D1" },
          { value: "incarceration", label: "Incarceration: D2" },
        ],
        value: ctx.state.overlay,
        onChange: (v) => ctx.set({ overlay: v }),
      });
      settingsBox.body.append(h("div", { class: "al-controls" }, tau.root, cap.root, report.root, county.root, overlay.root));

      const w = ctx.slider({ label: T.w, ...ctx.key("w"), onInput: (v) => ctx.set({ w: v }) });
      ctx.primaryControl(w.input);
      ctx.controls.append(w.root);

      // Read the outcome bars, locate the selected county and its intervals, then compare all counties.
      ctx.stage.removeAttribute("data-prx-primary");
      const barSlot = h("div", { class: "al-bars" });
      const gradeKey = h("div", { class: "prx-legend prx-light-panel al-key", "data-prx-part": "legend" });
      const mapSlot = h("div", { class: "al-map" });
      const scatterSlot = h("div", { class: "al-scatter" });

      const countyHead = h("p", { class: "al-county-head" });
      const stageTableBox = h("div", { class: "al-stage-table-wrap" });
      const stageDetail = h(
        "section",
        { class: "prx-panel al-detail al-stage-detail" },
        ctx.panelTitle("Selected county"),
        countyHead,
        h("p", { class: "al-own-note", text: "Historical Alabama county outcomes. The source fits income and incarceration separately." }),
        ctx.scrollRegion(stageTableBox, "Selected county marginal intervals"),
      );
      const primaryStage = ctx.primaryGraphic(
        h(
          "div",
          { class: "al-primary-stage", role: "group", "aria-label": `${T.errorsTitle}; ${T.mapTitle}` },
          h(
            "section",
            { class: "prx-panel al-outcome-bars" },
            h("div", { class: "al-bars-head" }, ctx.panelTitle(T.errorsTitle), gradeKey),
            barSlot,
          ),
          h(
            "div",
            { class: "al-visual-grid" },
            h("section", { class: "prx-panel al-map-panel", "aria-label": T.mapTitle }, ctx.panelTitle(T.mapTitle), mapSlot),
            stageDetail,
          ),
        ),
      );

      const scatterPanel = h("section", { class: "prx-panel al-scatter-panel" }, ctx.panelTitle(T.outcomesTitle), scatterSlot);
      const stageLeft = h("div", { class: "al-left" }, primaryStage, scatterPanel);

      const ownSlot = h("div", { class: "al-own-map" });
      const ownKey = h("div", { class: "prx-legend prx-light-panel al-key" });
      const ownNote = h("p", { class: "al-own-note" });
      const ownTitle = ctx.panelTitle("Archived outcome-specific grade");
      const ownPanel = h("section", { class: "prx-panel al-own-panel" }, ownTitle, ownKey, ownSlot, ownNote);
      const ownFold = ctx.disclosure({ name: "same-own-map", title: "Archived own map (same grades)", placement: "none" });
      const ownHolder = h("div", { "data-prx-own-map": "" }, ownPanel, ownFold.root);

      ctx.stage.append(stageLeft, ownHolder);

      // Progressive disclosures: Data ("county-details") and Method ("method")
      const summary = h("div", { class: "al-stack" });
      const settings = h("div", { class: "al-stack" });
      const countyAudit = h("div", { class: "al-stack" });
      const profiles = h("div", { class: "al-box" });
      const archive = h("div", { class: "al-box" });
      const changes = h("div", { class: "al-box" });
      const card = h("div", { class: "al-box" });
      const ties = h("div", { class: "al-stack" });
      const intervalSlots = [h("div", { class: "al-cardplot" }), h("div", { class: "al-cardplot" })];

      const editor = h("textarea", { "aria-label": "Edited county grade vector in original FIPS order" });
      const error = h("p", { class: "al-error", role: "alert" });
      let dirty = false;
      let lastEdited = ctx.state.edited;
      editor.value = lastEdited;
      const applyEdit = () => {
        const value = editedGrade(editor.value);
        if (value === undefined) {
          error.textContent = "Use one integer per county, in original FIPS order.";
          return;
        }
        editor.value = value;
        dirty = false;
        error.textContent = "";
        ctx.set({ edited: value, report: "edited" });
      };
      ctx.listen(editor, "input", () => {
        dirty = true;
      });
      ctx.listen(editor, "keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          applyEdit();
        }
        if (e.key === "Escape") {
          editor.value = ctx.state.edited;
          dirty = false;
          error.textContent = "";
        }
      });
      const editorPanel = panel(
        "Edit a fixed report",
        h(
          "div",
          {},
          h(
            "p",
            {},
            "Enter one integer grade per county in original FIPS order. Smaller numbers indicate higher priority. Apply saves the grades. Escape restores the previous grades.",
          ),
          editor,
          ctx.button({ label: "Apply edited report", onClick: applyEdit }).root,
          error,
        ),
      );

      const dataBox = ctx.dataBox("County grades and intervals", { name: "county-details" });
      dataBox.body.append(
        panel("Selected county: supplied marginal intervals", countyAudit),
        panel("County grades and relation changes from P", changes),
        h(
          "section",
          { class: "prx-panel al-detail" },
          ctx.panelTitle("Complete report card with supplied marginal intervals"),
          h(
            "div",
            { class: "al-cards" },
            ...intervalSlots.map((slot, k) =>
              h("div", { class: "al-cardbox" }, ctx.panelTitle(k === 0 ? "Income rank" : "Incarceration: lower is favorable"), slot),
            ),
          ),
          h(
            "p",
            {},
            "The cards list grade one first, with counties ordered by posterior mean within each grade. Each equal-tail interval describes a single county’s outcome.",
          ),
        ),
        panel("Every county and its marginal intervals", card),
      );

      const sourceFragments = (text) => {
        const out = [];
        let at = 0;
        const s = String(text);
        for (const m of s.matchAll(/\d+(?:\.\d+){2,}|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
          out.push(s.slice(at, m.index));
          if ((m[0].match(/\./g)?.length ?? 0) >= 2) {
            m[0].split(".").forEach((part, j) => {
              if (j) out.push(".");
              out.push(ctx.num(Number(part), part));
            });
          } else {
            out.push(ctx.num(Number(m[0].replaceAll(",", "")), m[0]));
          }
          at = m.index + m[0].length;
        }
        out.push(s.slice(at));
        return out;
      };
      const dataScopePanel = panel(
        "Data and scope",
        h(
          "div",
          { class: "al-stack" },
          h("p", {}, ...sourceFragments(INPUT.notice.attribution)),
          h("p", {}, ...sourceFragments(INPUT.notice.changes)),
          h("p", {}, ...sourceFragments(INPUT.notice.text)),
          h(
            "p",
            {},
            ...sourceFragments(
              "County boundaries: U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20m), via usmapdata 1.1.0; public domain. No endorsement implied.",
            ),
          ),
        ),
      );

      const methodBox = ctx.methodBox("Method and archived reports");
      methodBox.body.append(
        panel("The selected report and county", summary),
        panel("Selection settings and scope", settings),
        panel("All reports under the same current loss", profiles),
        panel("Returned minimizing live reports", ties),
        panel("Archived cost of one common grade", archive),
        editorPanel,
        dataScopePanel,
      );

      [profiles, archive, changes, card, ...intervalSlots.map((n) => n.parentElement)].forEach((n, k) =>
        ctx.scrollRegion(
          n,
          [
            "Every fixed-report evaluation",
            "Complete archived commonality and solver facts",
            "Complete county grade changes",
            "All county marginal intervals",
            "Income interval card",
            "Incarceration interval card",
          ][k],
        ),
      );

      const rows = [];
      const gradeCells = [];
      const ownCells = [];
      const rowBody = h("tbody");
      U.name.forEach((name, i) => {
        const button = h("button", { type: "button", text: name, "data-prx-focus-key": `county-row:${i}` });
        ctx.listen(button, "click", () => ctx.set({ county: i }));
        const g = N(1);
        const o = N(1);
        gradeCells.push(g);
        ownCells.push(o);
        const row = h(
          "tr",
          {},
          h("th", { scope: "row" }, button),
          h("td", {}, h("span", { "data-prx-name": "", text: U.fips[i] })),
          h("td", {}, g),
          h("td", {}, o),
          ...[
            "mean_income",
            "lower_income",
            "upper_income",
            "mean_incarceration",
            "lower_incarceration",
            "upper_incarceration",
          ].map((key) => h("td", {}, N(U[key][i], (v) => formatDecimal(v, { digits: 2 })))),
        );
        ctx.listen(button, "keydown", (e) => {
          const order = Array.from(rowBody.children);
          const at = order.indexOf(row);
          const steps = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: order.length - 1 };
          if (!(e.key in steps)) return;
          e.preventDefault();
          const next = order[Math.max(0, Math.min(order.length - 1, steps[e.key]))];
          const j = rows.indexOf(next);
          ctx.set({ county: j });
          next.querySelector("button").focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
        });
        rows.push(row);
        rowBody.append(row);
      });
      card.append(
        h(
          "table",
          { class: "prx-sticky-first" },
          h(
            "caption",
            {},
            "All counties in selected report order. Incarceration values are negative percentage points: larger is more favorable.",
          ),
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              ...[
                "County",
                "FIPS",
                "Selected grade",
                "Own grade (or P)",
                "Income mean",
                "Income lower",
                "Income upper",
                "Negative incarceration mean",
                "Negative incarceration lower",
                "Negative incarceration upper",
              ].map((text) => h("th", { scope: "col", text })),
            ),
          ),
          rowBody,
        ),
      );

      // Projection cached by container pixel size so SVG viewBox always matches layout width 1:1
      const geoCache = new Map();
      function geometry(W, H) {
        const key = `${W}|${H}`;
        if (geoCache.has(key)) return geoCache.get(key);
        const d3 = ctx.win.d3 ?? globalThis.d3;
        const Mp = CONFIG.map;
        const innerW = Math.max(90, W - 2 * Mp.margin);
        const innerH = Math.max(120, H - 2 * Mp.margin);
        const fc = { type: "FeatureCollection", features: FEATURES };
        const padX = Math.max(8, Math.round(innerW * 0.04));
        const padY = 4;
        const projection = d3
          .geoTransverseMercator()
          .rotate(CONFIG.rotate)
          .fitExtent(
            [
              [padX, padY],
              [innerW - padX, innerH - padY],
            ],
            fc,
          );
        const path = d3.geoPath(projection);
        const item = {
          d: FEATURES.map((f) => path(f)),
          centroid: FEATURES.map((f) => path.centroid(f)),
          inner: [innerW, innerH],
        };
        if (geoCache.size >= 8) geoCache.delete(geoCache.keys().next().value);
        geoCache.set(key, item);
        return item;
      }

      const isCompact = () => {
        const wPx = ctx.width();
        return wPx > 0 && wPx <= 704;
      };

      function currentGrade(state, dp) {
        return Array.from(
          state.report === "common"
            ? dp.grade
            : state.report === "withheld"
              ? Array(N_UNITS).fill(1)
              : state.report === "edited"
                ? state.edited.split(",").map(Number)
                : SOURCE_REPORTS[state.report],
        );
      }

      function drawMap(grade, gc, pal, state, slot = mapSlot, keySlot = gradeKey) {
        const Mp = CONFIG.map;
        const compact = isCompact();
        const rawW = Math.round(slot.getBoundingClientRect?.().width || 0);
        const W = Math.max(96, rawW || (compact ? 116 : 350));
        const H = compact ? Mp.mobileHeight : Mp.desktopHeight;
        const g = geometry(W, H);
        const G = Math.max(...grade);
        const counties = U.name.map((name, i) => ({
          i,
          name,
          grade: grade[i],
          cx: g.centroid[i][0],
          cy: g.centroid[i][1],
        }));
        const ns = "http://www.w3.org/2000/svg";
        const shapes = () => {
          const group = ctx.doc.createElementNS(ns, "g");
          group.setAttribute("transform", `translate(${Mp.margin},${Mp.margin})`);
          const path = (d, fill, stroke, width, kind, dash) => {
            const p = ctx.doc.createElementNS(ns, "path");
            p.setAttribute("d", g.d[d.i]);
            p.setAttribute("fill", fill);
            p.setAttribute("stroke", stroke);
            p.setAttribute("stroke-width", String(width));
            p.setAttribute("stroke-linejoin", "round");
            if (kind) p.dataset.alabamaOutline = kind;
            if (dash) p.setAttribute("stroke-dasharray", dash);
            p.dataset.county = String(d.i);
            p.addEventListener("click", () => ctx.set({ county: d.i }));
            group.append(p);
          };
          counties.forEach((d) => path(d, gc[d.grade - 1], Mp.countyBorder, Mp.stroke));
          const top = counties.filter((d) => d.grade === 1);
          if (G > 1 && top.length <= CONFIG.maxOutlined) {
            top.forEach((d) => path(d, "none", pal.plotFg, Mp.outline, "top-grade"));
          }
          counties
            .filter((d) => d.i === state.county)
            .forEach((d) => {
              path(d, "none", pal.plotBg, 4.4, "selected-underlay");
              path(d, "none", pal.plotFocus, 2.6, "selected", "4 2");
            });
          return group;
        };
        plot(slot, {
          alt: T.mapAlt,
          table: {
            caption: [N(N_UNITS), " counties and their grade in the selected report"],
            columns: [
              { label: "County", value: "name" },
              { label: "FIPS", value: (d) => U.fips[d.i], name: true },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: counties.slice().sort((a, b) => a.grade - b.grade || a.i - b.i),
          },
          width: W,
          height: H,
          marginTop: Mp.margin,
          marginBottom: Mp.margin,
          marginLeft: Mp.margin,
          marginRight: Mp.margin,
          x: { domain: [0, g.inner[0]], axis: null },
          y: { domain: [g.inner[1], 0], axis: null },
          marks: () => [shapes],
          keyboard: {
            data: counties.slice().sort((a, b) => a.cy - b.cy || a.cx - b.cx),
            x: "cx",
            y: "cy",
            sort: false,
            key: (d) => String(d.i),
            label: "The 67 counties, north to south. Use the arrow keys to read each county.",
            onFocus: (d) => {
              if (ctx.state.county !== d.i) ctx.set({ county: d.i });
            },
            title: (d) =>
              `${d.name}: grade ${formatCount(d.grade)} of ${formatCount(G)}; income rank ${formatDecimal(U.mean_income[d.i], { digits: 1 })}, incarceration ${formatDecimal(-U.mean_incarceration[d.i], { digits: 2 })}% (posterior means).`,
          },
        });
        syncStop(slot, state.county);

        const sizes = disclosure(grade).sizes;
        const outlineKey = (text, style) =>
          h(
            "span",
            { class: "prx-key" },
            h("span", { class: "prx-swatch", style: { background: pal.plotBg, border: style }, "aria-hidden": "true" }),
            text,
          );
        keySlot.replaceChildren(
          h("span", { class: "al-key-title" }, T.keyTitle),
          ...sizes.map((n, k) => {
            const names = n <= CONFIG.maxNamed ? U.name.filter((_, i) => grade[i] === k + 1).join(", ") : null;
            return h(
              "span",
              { class: "prx-key" },
              h("span", { class: "prx-swatch", style: { background: gc[k] }, "aria-hidden": "true" }),
              h("span", {}, ctx.num(k + 1, formatCount(k + 1)), ": ", names ?? ctx.num(n, formatCount(n))),
            );
          }),
          outlineKey("Selected", `2px dashed ${pal.plotFocus}`),
          ...(G > 1 && sizes[0] <= CONFIG.maxOutlined ? [outlineKey("Top grade", `2px solid ${pal.plotFg}`)] : []),
        );
      }

      function drawScatter(grade, gc, state) {
        const S = CONFIG.scatter;
        const compact = isCompact();
        const H = compact ? S.mobileHeight : S.desktopHeight;
        const dotR = compact ? S.rMobile : S.rDesktop;
        const G = Math.max(...grade);
        const pts = U.name
          .map((name, i) => ({
            i,
            name,
            grade: grade[i],
            x: U.mean_income[i],
            y: -U.mean_incarceration[i],
            fill: gc[grade[i] - 1],
          }))
          .sort((a, b) => b.grade - a.grade || a.i - b.i);
        const fig = plot(scatterSlot, {
          alt: T.outcomesAlt,
          table: {
            caption: [N(N_UNITS), " counties on the outcomes (posterior means) and their grade"],
            columns: [
              { label: "County", value: "name" },
              { label: "Income rank", value: "x", format: (v) => formatDecimal(v, { digits: 1 }) },
              { label: "Incarceration (%)", value: "y", format: (v) => formatDecimal(v, { digits: 2 }) },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: pts.slice().sort((a, b) => a.grade - b.grade || a.i - b.i),
          },
          height: H,
          marginLeft: compact ? 36 : S.marginLeft,
          marginRight: compact ? 10 : S.marginRight,
          marginTop: compact ? 18 : S.marginTop,
          marginBottom: compact ? 38 : S.marginBottom,
          x: { label: T.axisIncome, labelAnchor: compact ? "center" : "right", nice: true, ticks: compact ? 3 : undefined, inset: S.inset },
          y: { label: T.axisIncarceration, labelAnchor: "top", reverse: true, nice: true, ticks: compact ? 3 : 4, inset: S.inset },
          color: { type: "identity" },
          marks: (c, P) => [
            P.dot(pts, { x: "x", y: "y", r: dotR, fill: "fill", stroke: c.plotMuted, strokeWidth: 0.65, strokeOpacity: 0.75 }),
            P.dot(
              pts.filter((d) => d.i === state.county),
              { x: "x", y: "y", r: 9, stroke: c.plotFg, strokeWidth: 2.5 },
            ),
            P.dot(
              G > 1 && pts.filter((d) => d.grade === 1).length <= CONFIG.maxOutlined ? pts.filter((d) => d.grade === 1) : [],
              { x: "x", y: "y", r: dotR + 2.2, stroke: c.plotFg, strokeWidth: 1.2 },
            ),
          ],
          keyboard: {
            data: pts.slice().sort((a, b) => a.grade - b.grade || b.x - a.x),
            x: "x",
            y: "y",
            sort: false,
            key: (d) => String(d.i),
            onFocus: (d) => {
              if (ctx.state.county !== d.i) ctx.set({ county: d.i });
            },
            title: (d) =>
              `${d.name}: grade ${formatCount(d.grade)} of ${formatCount(G)}; income rank ${formatDecimal(d.x, { digits: 1 })}, incarceration ${formatDecimal(d.y, { digits: 2 })}% (posterior means).`,
          },
        });
        syncStop(scatterSlot, state.county);
        ctx.renderScope.listen(fig.svg, "click", (event) => {
          const rect = fig.svg.getBoundingClientRect();
          const W = Number(fig.svg.getAttribute("width")) || rect.width;
          const svgH = Number(fig.svg.getAttribute("height")) || rect.height;
          const px = ((event.clientX - rect.left) * W) / rect.width;
          const py = ((event.clientY - rect.top) * svgH) / rect.height;
          const sx = fig.scale("x");
          const sy = fig.scale("y");
          const at = (v, scale) =>
            scale.range[0] + ((v - scale.domain[0]) * (scale.range[1] - scale.range[0])) / (scale.domain[1] - scale.domain[0]);
          const close = pts
            .map((d) => ({ i: d.i, dist: (at(d.x, sx) - px) ** 2 + (at(d.y, sy) - py) ** 2 }))
            .sort((a, b) => a.dist - b.dist)[0];
          if (close && close.dist < 400) ctx.set({ county: close.i });
        });
      }

      function drawIntervals(grade, state) {
        const order = reportCardRows(grade, { ids: E.ids, mean: U.mean_income }, "mean");
        ["income", "incarceration"].forEach((target, k) => {
          const data = order.map((i) => ({
            i,
            name: U.name[i],
            grade: grade[i],
            mean: U[`mean_${target}`][i],
            lo: U[`lower_${target}`][i],
            hi: U[`upper_${target}`][i],
          }));
          plot(intervalSlots[k], {
            alt: `Every county's supplied marginal ${target} interval, ordered by grade and income posterior mean.`,
            height: N_UNITS * 15 + 70,
            marginLeft: 142,
            marginRight: 20,
            marginTop: 25,
            marginBottom: 40,
            table: {
              caption: `Complete ${target} marginal interval card`,
              columns: [
                { label: "County", value: "name" },
                { label: "Grade", value: "grade", format: formatCount },
                { label: "Mean", value: "mean", format: (v) => formatDecimal(v, { digits: 2 }) },
                { label: "Lower", value: "lo", format: (v) => formatDecimal(v, { digits: 2 }) },
                { label: "Upper", value: "hi", format: (v) => formatDecimal(v, { digits: 2 }) },
              ],
              rows: data,
            },
            x: {
              label: target === "income" ? "Income rank (percentile)" : "Negative incarceration (percentage points)",
              nice: true,
            },
            y: { domain: data.map((d) => d.name), label: null, tickSize: 0 },
            marks: (c, P) => [
              P.ruleX([0], { stroke: c.plotGrid }),
              P.ruleY(data, { x1: "lo", x2: "hi", y: "name", stroke: c.post, strokeWidth: 1.5 }),
              P.dot(data, { x: "mean", y: "name", fill: c.post, r: 2.5 }),
              P.dot(
                data.filter((d) => d.i === state.county),
                { x: "mean", y: "name", stroke: c.plotFg, r: 6, strokeWidth: 2 },
              ),
            ],
            keyboard: {
              data,
              x: "mean",
              y: "name",
              sort: false,
              key: (d) => String(d.i),
              onFocus: (d) => {
                if (ctx.state.county !== d.i) ctx.set({ county: d.i });
              },
              title: (d) =>
                `${d.name}, grade ${formatCount(d.grade)}: mean ${formatDecimal(d.mean, { digits: 2 })}, marginal interval ${formatDecimal(d.lo, { digits: 2 })} to ${formatDecimal(d.hi, { digits: 2 })}.`,
            },
          });
          syncStop(intervalSlots[k], state.county);
        });
      }

      function drawBars(ev) {
        const B = CONFIG.bars;
        const compact = isCompact();
        const rowLabels = [T.income, T.incarceration];
        const data = rowLabels.map((row, k) => ({ row, v: ev.EoverN[k] })).filter((d) => d.v !== null);
        plot(barSlot, {
          alt: T.barsAlt,
          table: {
            caption: "Share of stated directions expected to be wrong, by outcome",
            columns: [
              { label: "Outcome", value: "row" },
              { label: "Share expected wrong", value: "v", format: (v) => formatShare(v) },
            ],
            rows: rowLabels.map((row, k) => ({ row, v: ev.EoverN[k] })),
          },
          height: compact ? B.mobileHeight : B.desktopHeight,
          marginLeft: B.marginLeft,
          marginRight: B.marginRight,
          marginTop: B.marginTop,
          marginBottom: B.marginBottom,
          x: { domain: [0, Math.max(B.top, ...data.map((d) => d.v))], label: null },
          y: { domain: rowLabels, label: null, tickSize: 0, padding: 0.28 },
          color: { type: "identity" },
          marks: (c, P) => [
            P.barX(data, { x: "v", y: "row", fill: c.err, rx: 2 }),
            P.ruleX([0], { stroke: c.plotAxis }),
            numText(data, {
              x: "v",
              y: "row",
              value: "v",
              format: (v) => formatShare(v),
              dx: 6,
              textAnchor: "start",
              fill: c.plotFg,
              fontWeight: 700,
            }),
          ],
          keyboard: {
            data,
            x: "v",
            y: "row",
            sort: false,
            title: (d) => `${d.row}: ${formatShare(d.v)} of the stated directions are expected to be wrong.`,
          },
        });
        clearZeroTabIndex(barSlot);
      }

      return {
        render(state, meta = {}) {
          if (meta.reason === "disclosure") {
            const pal = palette(ctx.stage);
            const dp = commonAt(state.w, state.tau, state.cap);
            const grade = currentGrade(state, dp);
            if (meta.disclosure === "county-details" && dataBox.open) {
              drawIntervals(grade, state);
            } else if (meta.disclosure === "same-own-map" && ownFold.open && state.overlay !== "none") {
              const own = state.overlay === "income" ? "D1" : "D2";
              const archiveGrade = SOURCE_REPORTS[own];
              drawMap(archiveGrade, gradeRamp(disclosure(archiveGrade).G, pal), pal, state, ownSlot, ownKey);
            }
            return;
          }

          w.set(state.w);
          tau.set(state.tau);
          cap.set(state.cap);
          report.set(state.report);
          county.set(state.county);
          overlay.set(state.overlay);

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
          const grade = currentGrade(state, dp);
          const ev = evaluateReport(grade, E, { tau: state.tau, w: [state.w, 1 - state.w] });
          const gc = gradeRamp(Math.max(...grade), pal);

          drawMap(grade, gc, pal, state);
          drawScatter(grade, gc, state);
          drawBars(ev);
          drawIntervals(grade, state);

          ownHolder.hidden = state.overlay === "none";
          const own = state.overlay === "income" ? "D1" : state.overlay === "incarceration" ? "D2" : "P";
          if (state.overlay !== "none") {
            const archiveGrade = SOURCE_REPORTS[own];
            const same = grade.every((g, j) => g === archiveGrade[j]);
            ownFold.root.hidden = !same;
            const destination = same ? ownFold.body : ownHolder;
            if (ownPanel.parentNode !== destination) {
              if (same) ownFold.open = false;
              ctx.keepFocus(() => destination.prepend(ownPanel));
            }
            ownTitle.textContent = `Archived own report: ${own}`;
            ownNote.textContent =
              state.overlay === "income"
                ? "Grade one = stated highest historical income rank in archived D1, not a measure of need."
                : "Grade one = stated lowest historical incarceration in archived D2, not a measure of need.";
            drawMap(archiveGrade, gradeRamp(disclosure(archiveGrade).G, pal), pal, state, ownSlot, ownKey);
          }

          const weightLabel =
            Math.abs(state.w - SET.weights.income) < 1e-9
              ? ["Equal weights"]
              : state.w >= 1
                ? ["Income only"]
                : state.w <= 0
                  ? ["Incarceration only"]
                  : state.w > SET.weights.income
                    ? ["Income ", r.setting(state.w)]
                    : ["Incarceration ", r.setting(1 - state.w)];
          const weightLower =
            Math.abs(state.w - SET.weights.income) < 1e-9
              ? ["equal weights"]
              : state.w >= 1
                ? ["income only"]
                : state.w <= 0
                  ? ["incarceration only"]
                  : state.w > SET.weights.income
                    ? ["income ", r.setting(state.w)]
                    : ["incarceration ", r.setting(1 - state.w)];
          const label = REPORTS.find((item) => item[0] === state.report)[1];

          if (state.report === "common") {
            r.set([
              ...weightLabel,
              ": ",
              r.count(ev.N),
              " of ",
              r.count(M),
              " pairs stated",
              ...(ev.N === 0
                ? [". Neither outcome has an error share among stated pairs."]
                : ["; share of stated directions expected wrong ", r.share(ev.EoverN[0]), " on income, ", r.share(ev.EoverN[1]), " on incarceration."]),
            ]);
          } else {
            r.set([
              label,
              " (",
              ...weightLower,
              "): ",
              r.count(ev.N),
              " of ",
              r.count(M),
              " pairs stated; weighted risk ",
              r.risk(ev.risk),
              ...(ev.N === 0
                ? [". Neither outcome has an error share among stated pairs."]
                : [", wrong share ", r.share(ev.EoverN[0]), " on income, ", r.share(ev.EoverN[1]), " on incarceration."]),
            ]);
          }

          const i = state.county;
          const makeIntervalTable = () =>
            table(
              ["Outcome", "Mean", "Lower", "Upper"],
              ["income", "incarceration"].map((k) => [
                k,
                ...["mean", "lower", "upper"].map((prefix) => N(U[`${prefix}_${k}`][i], (v) => formatDecimal(v, { digits: 2 }))),
              ]),
            );
          countyHead.replaceChildren(
            h("strong", {}, U.name[i]),
            " · grade ",
            N(grade[i]),
            " (archived P ",
            N(SOURCE_REPORTS.P[i]),
            ", income D1 ",
            N(SOURCE_REPORTS.D1[i]),
            ", incarc. D2 ",
            N(SOURCE_REPORTS.D2[i]),
            ") · ",
            h("span", { class: "al-sign-cue" }, "−% = lower incarceration is higher"),
          );
          stageTableBox.replaceChildren(makeIntervalTable());

          countyAudit.replaceChildren(
            h(
              "p",
              {},
              U.name[i],
              "; selected grade ",
              N(grade[i]),
              ", archived P grade ",
              N(SOURCE_REPORTS.P[i]),
              ", income D1 grade ",
              N(SOURCE_REPORTS.D1[i]),
              ", incarceration D2 grade ",
              N(SOURCE_REPORTS.D2[i]),
              ".",
            ),
            h(
              "p",
              {},
              "Incarceration is expressed in negative percentage points, so larger values correspond to lower incarceration. The income and incarceration models were fit separately and give expected loss for each outcome.",
            ),
          );

          const d = disclosure(grade);
          const change = relationChange(SOURCE_REPORTS.P, grade);
          const gradeMeaning =
            state.report === "common"
              ? T.grade1
              : "Grade one is the high-priority end of this fixed report. A shared grade withholds comparisons. Historical outcomes, not a measure of need.";
          summary.replaceChildren(
            h(
              "p",
              {},
              label,
              ": ",
              N(ev.N, formatCount, "selected-N"),
              " of ",
              N(M),
              " pairs stated (",
              N(d.s, formatShare, "selected-share"),
              "); weighted risk ",
              N(ev.risk, formatRisk, "selected-risk"),
              ".",
            ),
            h("p", {}, gradeMeaning),
            h("p", {}, "Live search reference: ", tagNode(ctx, dp, { key: "order", orderWords: "weighted expected-rank order" }), "."),
            h("p", { class: "al-vector" }, "Selected grade vector ", N(grade, formatGrades, "selected-grade")),
            state.report === "common" ? tagNode(ctx, dp, { orderWords: "weighted expected-rank order" }) : captionNode(ctx, "fixed-report"),
          );

          settings.replaceChildren(
            h(
              "p",
              {},
              "Current live search: τ = ",
              N(state.tau, formatSetting),
              ", at most ",
              N(state.cap),
              " grades; income weight ",
              N(state.w, formatSetting),
              ", incarceration weight ",
              N(1 - state.w, formatSetting),
              ". The weighted expected-rank order is recomputed from posterior average positions. Equal scores stay together.",
            ),
            h(
              "p",
              {},
              "Original archive: τ = ",
              N(TAU, formatSetting),
              ", at most ",
              N(GMAX),
              " grades, equal weights; postrank v0.9.0 with HiGHS v1.12.0.3. Supplied intervals have level ",
              N(AL.facts.interval_level, formatShare),
              " and are equal-tail marginal intervals as stored. Current risks at different weights or costs belong to different losses.",
            ),
            h(
              "p",
              {},
              "Live order family ",
              N(dp.family.size, formatCount, "live-family"),
              "; ",
              N(dp.tieCount, formatCount, "live-ties"),
              dp.tieCount === 1 ? " minimizing report at tolerance " : " minimizing reports at tolerance ",
              N(dp.tieTol, formatSci, "live-tolerance"),
              ".",
            ),
          );

          const list = [
            ["live", dp.grade],
            ...Object.keys(SOURCE_REPORTS)
              .filter((k) => k !== "fips")
              .map((k) => [k, SOURCE_REPORTS[k]]),
            ["withheld", Array(N_UNITS).fill(1)],
          ];
          if (state.report === "edited") list.push(["edited", grade]);
          profiles.replaceChildren(
            table(
              [
                "Report",
                "Outcome",
                "Expected wrong E",
                "E/N",
                "E/M",
                "Criterion risk",
                "Weighted risk",
                "N",
                "Weighted expected errors",
                "Error contribution",
                "Withholding contribution",
              ],
              list.flatMap(([id, g]) => {
                const e = evaluateReport(g, E, { tau: state.tau, w: [state.w, 1 - state.w] });
                return ["Income", "Incarceration"].map((name, k) => [
                  id,
                  name,
                  N(e.E[k], formatExpectedCount, `${id}-E-${k}`),
                  N(e.EoverN[k], formatShare, `${id}-share-${k}`),
                  N(e.EoverM[k], formatShare),
                  N(e.Rk[k], formatRisk, `${id}-Rk-${k}`),
                  N(e.risk, formatRisk, `${id}-risk-${k}`),
                  N(e.N, formatCount, `${id}-N-${k}`),
                  N(e.Ew, formatExpectedCount),
                  N(e.errorTerm, formatRisk),
                  N(e.withholdingTerm, formatRisk),
                ]);
              }),
            ),
            h(
              "p",
              {},
              "Criterion risk adds expected wrong directions and the withholding cost for silent pairs, divided by all pairs. Weighted risk averages those criterion risks using the current weights. All fixed reports are evaluated under the same current loss. With no statements, E/N is NA and E/M is zero. P and B3 happen to have identical vectors in this example.",
            ),
          );

          const cm = AL.tables.commonality;
          const af = AL.analyses.case_alabama67.facts;
          const rm = AL.tables.reference_metrics;
          archive.replaceChildren(
            h(
              "p",
              {},
              "Stored common selection: ",
              tagNode(ctx, af),
              "; status ",
              af.status,
              "; risk ",
              N(af.risk, formatRisk, "archive-risk"),
              "; lower bound ",
              N(af.lower_bound, formatRisk, "archive-bound"),
              "; absolute gap ",
              N(af.gap, formatSci, "archive-gap"),
              "; bound source ",
              af.bound_source,
              ".",
            ),
            h(
              "p",
              {},
              "The interval bounds the extra risk of using the common grades instead of grades chosen for one outcome. It uses the original loss and full set of reports allowed by the grade cap. The bounds come from the best report the original solver found for that outcome and its lower bound.",
            ),
            table(
              [
                "Criterion",
                "Common risk",
                "Own incumbent risk",
                "Own lower bound",
                "Cost lower",
                "Cost upper",
                "Own status",
                "Common status",
                "Common gap",
              ],
              cm.criterion.map((name, k) => [
                name,
                N(cm.common_criterion_risk_A[k], formatRisk, `commonality-common-${k}`),
                N(cm.single_incumbent_risk_A[k], formatRisk, `commonality-own-${k}`),
                N(cm.single_lower_bound_A[k], formatRisk),
                N(cm.cost_lower_A[k], formatRisk, `commonality-lower-${k}`),
                N(cm.cost_upper_A[k], formatRisk, `commonality-upper-${k}`),
                cm.single_solver_status[k],
                cm.common_solver_status[k],
                N(cm.common_solver_gap_A[k], formatSci),
              ]),
            ),
            table(
              ["Own-criterion solve", "Criterion", "Original risk", "Original lower bound", "Original gap", "Original status"],
              AL.tables.single_criterion.method.map((id, k) => [
                id,
                AL.tables.single_criterion.criterion[k],
                N(AL.tables.single_criterion.risk[k], formatRisk),
                N(AL.tables.single_criterion.lower_bound[k], formatRisk),
                N(AL.tables.single_criterion.gap[k], formatSci, `own-archive-gap-${k}`),
                AL.tables.single_criterion.normalized_status[k],
              ]),
            ),
            h("p", {}, AL.facts.archive_note.replace("postrank ", "postrank v").replace("HiGHS ", "HiGHS v")),
          );
          const columns = [
            ["description", "Description", null],
            ["N", "Pairs stated", formatCount],
            ["Goccupied", "Grades occupied", formatCount],
            ["tau", "Original cost τ", formatSetting],
            ["G_max", "Original grade cap", formatCount],
            ["A_E_income", "Income expected wrong", formatExpectedCount],
            ["A_E_incarceration", "Incarceration expected wrong", formatExpectedCount],
            ["A_Ew", "Weighted expected wrong", formatExpectedCount],
            ["A_Ew_over_N", "Weighted wrong / stated", formatShare],
            ["A_Ew_over_M", "Weighted wrong / all pairs", formatShare],
            ["A_Rtau", "Original weighted risk", formatRisk],
            ["A_R_income", "Income risk", formatRisk],
            ["A_R_incarceration", "Incarceration risk", formatRisk],
            ["A_solver_status", "Stored status", null],
            ["A_solver_lower_bound", "Stored lower bound", formatRisk],
            ["A_solver_gap", "Stored gap", formatSci],
          ];
          archive.append(
            table(
              ["Stored report", ...columns.map((c) => c[1])],
              rm.method.map((method, j) => [
                method,
                ...columns.map(([key, , fmt]) => (fmt ? N(rm[key][j], fmt) : String(rm[key][j] ?? "NA"))),
              ]),
            ),
          );

          const agreements = ["P", "D1", "D2"].map((id) => {
            const ae = evaluateReport(SOURCE_REPORTS[id], E, { tau: state.tau, w: [state.w, 1 - state.w] });
            const same = Array.from(dp.grade).every((g, j) => g === SOURCE_REPORTS[id][j]);
            return h(
              "p",
              {},
              id,
              ": complete live grade vector ",
              same ? "agrees" : "differs",
              "; stored report has ",
              N(ae.N),
              " pairs and current risk ",
              N(ae.risk, formatRisk),
              ".",
            );
          });
          changes.replaceChildren(
            ...agreements,
            h(
              "p",
              {},
              "Compared with archived P: ",
              N(change.changed, formatCount, "changed"),
              " pair relations changed; ",
              N(change.nNewDisclosed, formatCount, "newly-stated"),
              " newly stated, ",
              N(change.nNewWithheld, formatCount, "newly-withheld"),
              " newly withheld, ",
              N(change.nReversed, formatCount, "reversed"),
              " reversed.",
            ),
            table(
              ["County", "P grade", "Selected grade", "D1 grade", "D2 grade"],
              U.name.map((name, j) => [
                name,
                N(SOURCE_REPORTS.P[j]),
                N(grade[j]),
                N(SOURCE_REPORTS.D1[j]),
                N(SOURCE_REPORTS.D2[j]),
              ]),
            ),
          );

          ties.replaceChildren(
            h(
              "p",
              {},
              N(dp.grades.length),
              " of ",
              N(dp.tieCount),
              " minimizing reports returned in ",
              dp.gradesOrder,
              " order. The first is used in the linked views.",
            ),
            ...dp.grades.map((g, j) => h("p", { class: "al-vector" }, "Report ", N(j + 1), ": ", N(Array.from(g), formatGrades))),
            h("p", { class: "al-vector" }, "Live grade vector ", N(Array.from(dp.grade), formatGrades, "live-grade")),
          );

          gradeCells.forEach((n, j) => setNum(n, grade[j], formatCount(grade[j])));
          ownCells.forEach((n, j) => setNum(n, SOURCE_REPORTS[own][j], formatCount(SOURCE_REPORTS[own][j])));
          rows.forEach((row, j) => {
            row.classList.toggle("al-selected", j === i);
            row.querySelector("button").tabIndex = j === i ? 0 : -1;
            if (j === i) row.setAttribute("aria-current", "true");
            else row.removeAttribute("aria-current");
          });
          reportCardRows(grade, { ids: E.ids, mean: U.mean_income }, "mean").forEach((j) => rowBody.append(rows[j]));
        },
      };
    },
  });
}
