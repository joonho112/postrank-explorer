// 3.6 order-misses ("When the order misses the best report") — Frame v2 upgrade.
// Keep ../shared/domain/posterior-tiers.js untouched and preserve named re-exports.
export { tb19Model, compute, createRuleCardRenderer } from "../shared/domain/posterior-tiers.js";

import { createWidget } from "../shared/base.js";
import { numText, palette, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatGrades,
  formatProb,
  formatRational,
  formatReadoutRisk,
  formatRisk,
  formatSetting,
  rationalApprox,
} from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  disclosure,
  enumerateReports,
  evaluateReport,
  lowerHull,
  orderHull,
  rankSummaries,
  reportCloud,
  tauPath,
} from "../pr-core.js";
import {
  CONFIG,
  CSS as DOMAIN_CSS,
  MODELS,
  compute,
  createRuleCardRenderer,
} from "../shared/domain/posterior-tiers.js";

const RULES = Object.freeze(["pm-tiers", "pm-cuts", "er-cuts", "optimum"]);

const TB19 = (() => {
  const m = MODELS.tb19;
  const key = (g) => Array.from(g).join("/");
  const members = (order) => new Set(Array.from(enumerateReports(m.n, { kind: "order", order }), key));
  const cloud = reportCloud(m.E, { family: { kind: "all" } });
  return {
    reports: Array.from(enumerateReports(m.n, { kind: "all" }), (g) => Array.from(g)),
    inPm: members(m.pmOrder),
    inEr: members(m.erOrder),
    points: cloud.points,
    hullAll: lowerHull(cloud),
    hullPm: orderHull(m.E, { order: m.pmOrder }),
    hullEr: orderHull(m.E, { order: m.erOrder }),
    key,
  };
})();

const STAGE_CSS = `
/* PR-01: reset any inherited container/grid placement inside Frame v2 stage */
.prx-pt[data-prx-frame="v2"] .prx-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.35rem;
  padding: 0.5rem 0.65rem 0.55rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  min-width: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-stage > * {
  grid-area: auto;
  min-width: 0;
  margin: 0;
}
.prx-pt[data-prx-frame="v2"] .prx-controls .prx-slider {
  flex: 0 1 11rem;
  max-width: 11.8rem;
}
.prx-pt[data-prx-frame="v2"] .prx-presets .prx-seg {
  padding-inline: 0.5rem;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-path-slot {
  min-width: 0;
  width: 100%;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-path-keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.8rem;
  margin: 0.25rem 0 0;
  padding: 0.32rem 0.1rem 0;
  border-top: 1px solid var(--prx-plot-grid);
  font-size: 0.83rem;
  color: var(--prx-plot-fg);
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-path-keys .prx-key {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
}
.prx-pt[data-prx-frame="v2"] .prx-stage .prx-pt-path-cue {
  color: var(--prx-plot-muted);
}

/* Settings controls (>= 44px touch targets on coarse/mobile) */
.prx-pt[data-prx-frame="v2"] .prx-pt-order-seg {
  flex: 1 1 100%;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-rule,
.prx-pt[data-prx-frame="v2"] .prx-pt-cap,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-rule > legend,
.prx-pt[data-prx-frame="v2"] .prx-pt-cap > legend,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt > legend {
  flex: 1 1 100%;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--prx-fg);
  margin-bottom: 0.12rem;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-rule .prx-radio,
.prx-pt[data-prx-frame="v2"] .prx-pt-cap .prx-radio,
.prx-pt[data-prx-frame="v2"] .prx-pt-opt .prx-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--prx-border-strong);
  border-radius: 5px;
  background: var(--prx-bg);
}
@media (pointer: coarse), (max-width: 48em) {
  .prx-pt[data-prx-frame="v2"] .prx-pt-rule .prx-radio,
  .prx-pt[data-prx-frame="v2"] .prx-pt-cap .prx-radio,
  .prx-pt[data-prx-frame="v2"] .prx-pt-opt .prx-radio {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}

/* Disclosures layout */
.prx-pt[data-prx-frame="v2"] .prx-pt-law .prx-pt-state {
  width: 100%;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-state th[scope="row"],
.prx-pt[data-prx-frame="v2"] .prx-pt-table-law th[scope="row"],
.prx-pt[data-prx-frame="v2"] .prx-pt-table-path th[scope="row"] {
  white-space: normal;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-table-law td:nth-child(2) {
  white-space: nowrap;
}
.prx-pt[data-prx-frame="v2"] .prx-pt-mini {
  min-width: 0;
  max-width: min(100%, 24rem);
  margin: 0.35rem 0 0;
}

@media (max-width: 30em) {
  .prx-pt[data-prx-frame="v2"] .prx-title {
    margin: 0 0 0.2rem;
    font-size: 0.95rem;
    line-height: 1.25;
  }
  .prx-pt[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.3rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-controls .prx-slider {
    flex-basis: 100%;
    max-width: 100%;
  }
  .prx-pt[data-prx-frame="v2"] > .prx-readout {
    margin-bottom: 0.38rem;
    padding: 0.26rem 0.5rem;
    font-size: 0.9rem;
    line-height: 1.38;
  }
  .prx-pt[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.36rem;
    font-size: 0.78rem;
  }
  .prx-pt[data-prx-frame="v2"] .prx-stage {
    padding: 0.32rem 0.38rem 0.4rem;
  }
  .prx-pt[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.38rem;
    gap: 0.28rem;
  }
}
`;

export function mountWidget(el, spec = {}) {
  const T = CONFIG.text;
  const tb = MODELS.tb19;
  const law = CONFIG.tb19;

  return createWidget(el, spec, {
    name: "order-misses",
    frame: "v2",
    css: DOMAIN_CSS + STAGE_CSS,
    label: CONFIG.label,
    title: "When do cuts of the chosen order miss the best report?",
    className: "prx-pt",
    keys: {
      data: { type: "choice", values: ["tb19"], value: "tb19" },
      order: { type: "choice", values: ["mean", "rank"], value: "mean" },
      rule: { type: "choice", values: Array.from(RULES), value: CONFIG.rule },
      cap: { type: "integer", min: CONFIG.cap.min, max: CONFIG.cap.max, value: CONFIG.defaults.tb19.cap },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.defaults.tb19.tau },
      opt: { type: "choice", values: ["cap", "all"], value: CONFIG.opt },
    },
    build(ctx) {
      const { h } = ctx;

      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const fill = (template, slots) => {
        const out = [];
        let at = 0;
        for (const m of template.matchAll(/⟨([^⟩]+)⟩/g)) {
          if (m.index > at) out.push(template.slice(at, m.index));
          out.push(...[].concat(slots[m[1]]));
          at = m.index + m[0].length;
        }
        if (at < template.length) out.push(template.slice(at));
        return out;
      };
      const count = (x) => ctx.num(x, formatCount(x));
      const risk3 = (x) => ctx.num(x, formatReadoutRisk(x));
      const setting = (x) => ctx.num(x, formatSetting(x));
      const fracOK = (xs) => xs.every((x) => rationalApprox(x, { maxDenominator: CONFIG.maxDenominator }));
      const fmtE = (mdl, x) => (mdl.fraction ? formatRational(x) : formatRisk(x));
      const blocksText = (grade, ids) => {
        const G = Math.max(...grade);
        const out = [];
        for (let g = 1; g <= G; g += 1) out.push(`{${ids.filter((_, i) => grade[i] === g).join(", ")}}`);
        return out.join(T.blockThen);
      };

      const ruleNames = {
        "pm-tiers": T.rulePmTiers,
        "pm-cuts": T.rulePmCuts,
        "er-cuts": T.ruleErCuts,
        optimum: T.ruleOptimum,
      };
      const ruleName = (r) => ruleNames[r];

      // --- Primary control in ctx.controls: Withholding cost τ slider
      const tau = ctx.slider({
        label: T.slider,
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.primaryControl(tau.root);
      ctx.controls.append(tau.root);

      // --- Secondary controls in Settings disclosure
      const orderControl = ctx.segmented({
        label: "Order by",
        name: "order",
        className: "prx-pt-order-seg",
        value: ctx.state.order,
        options: [
          { value: "mean", label: "Posterior mean" },
          { value: "rank", label: "Expected rank" },
        ],
        onChange: (v) => ctx.set({ order: v, rule: v === "rank" ? "er-cuts" : "pm-cuts" }),
      });
      const ruleRadio = ctx.radioGroup({
        legend: "Rule for the detailed report",
        name: "rule",
        className: "prx-pt-rule",
        options: RULES.map((value) => ({ value, label: ruleName(value) })),
        value: ctx.state.rule,
        onChange: (v) =>
          ctx.set({
            rule: v,
            ...(["pm-cuts", "er-cuts"].includes(v) ? { order: v === "er-cuts" ? "rank" : "mean" } : {}),
          }),
      });
      const capValues = [];
      for (let g = CONFIG.cap.min; g <= CONFIG.cap.max; g += 1) capValues.push(g);
      const capRadio = ctx.radioGroup({
        legend: T.capLegend,
        name: "cap",
        className: "prx-pt-cap",
        options: capValues.map((g) => ({ value: g, label: count(g) })),
        value: ctx.state.cap,
        onChange: (v) => ctx.set({ cap: v }),
      });
      const optRadio = ctx.radioGroup({
        legend: T.optLegend,
        name: "opt",
        className: "prx-pt-opt",
        options: [
          { value: "cap", label: T.optCap },
          { value: "all", label: T.optAll },
        ],
        value: ctx.state.opt,
        onChange: (v) => ctx.set({ opt: v }),
      });
      const settings = ctx.settingsBox("Settings");
      settings.body.append(orderControl.root, ruleRadio.root, capRadio.root, optRadio.root);

      // --- Stage: 13px collision-free exact cost-path chart + compact legend
      const pathSlot = h("div", { class: "prx-pt-path-slot" });
      const pathLegend = h("div", { class: "prx-legend prx-pt-path-keys", "data-prx-part": "legend" });
      ctx.stage.append(pathSlot, pathLegend);

      // --- Consolidated disclosures (2 bottom boxes instead of 5):
      //     1. all-reports ("Data: all 13 reports and rule cards") — keeps exact 13 tbody tr rows for order-misses-path.test.mjs:36!
      //     2. method      ("Method: three-unit law, frontier and intervals")
      const tableSlot = h("div", { class: "prx-pt-table-scroll" });
      const hero = h("section", { class: "prx-pt-hero prx-light-panel", "aria-label": "Inspected order cuts and joint benchmark" });
      const selectedReadout = h("p", { class: "prx-pt-note", "data-prx-selected-report": "" });
      const labelLine = h("p", { class: "prx-pt-label", "data-prx-result-scope": "" });
      const lawRows = h("ol", { class: "prx-pt-rows" });

      const allReportsBox = ctx.disclosure({
        name: "all-reports",
        title: "Data: all thirteen reports and rule cards",
      });
      ctx.stage.append(hero);
      allReportsBox.body.append(
        ctx.scrollRegion(tableSlot, T.tableHeading),
        selectedReadout,
        labelLine,
        ctx.panelTitle(T.compareHeading, { className: "prx-pt-heading" }),
        lawRows,
      );

      const lawExtras = h("div", { class: "prx-pt-law-extras" });
      const lawText = h("div", { class: "prx-pt-law-text" });
      const lawNotes = h("div", { class: "prx-pt-notes" });
      const miniSlot = h("div", { class: "prx-pt-mini" });
      const miniNote = h("p", { class: "prx-pt-note" });
      const matchedNote = h("p", { class: "prx-pt-note" });
      const pathTableSlot = h("div", { class: "prx-pt-table-scroll" });
      const pathScope = h("p", { class: "prx-pt-note" });

      const methodBox = ctx.methodBox("Method: three-unit law, frontier and intervals");
      methodBox.body.append(
        ctx.panelTitle(T.lawHeading, { className: "prx-pt-heading" }),
        lawExtras,
        lawText,
        lawNotes,
        ctx.panelTitle(T.miniHeading, { className: "prx-pt-heading" }),
        miniSlot,
        miniNote,
        matchedNote,
        ctx.panelTitle("Exact risk-curve intervals", { className: "prx-pt-heading" }),
        ctx.scrollRegion(pathTableSlot, "Complete exact risk-curve intervals"),
        pathScope,
        h("p", { class: "prx-pt-note" }, "A wrong stated direction costs ", count(1), "; staying silent on one pair costs τ."),
      );

      const { scopeParts, drawRow, chips } = createRuleCardRenderer(ctx);
      const lawNum = (x) => ctx.num(x, formatProb(x, { digits: 1 }));
      const stateNum = (values) => ctx.num(Array.from(values), `(${values.map(formatCount).join(", ")})`);

      function findMissBands(mean, best) {
        const endpoints = [...new Set([...mean, ...best].flatMap((s) => [s.tauFrom, s.tauTo]))].sort((a, b) => a - b);
        const pairs = (tb.n * (tb.n - 1)) / 2;
        const riskAt = (intervals, tauVal) => {
          const interval = intervals.find((s) => s.tauFrom <= tauVal && s.tauTo >= tauVal);
          return (interval.Ew + tauVal * (pairs - interval.N)) / pairs;
        };
        const bands = [];
        for (let i = 1; i < endpoints.length; i += 1) {
          const from = endpoints[i - 1];
          const to = endpoints[i];
          const mid = (from + to) / 2;
          if (riskAt(mean, mid) <= riskAt(best, mid) + CONFIG.tieTol) continue;
          const prev = bands.at(-1);
          if (prev && prev.to === from) prev.to = to;
          else bands.push({ from, to });
        }
        return bands;
      }

      const fullLawPath = {
        mean: tauPath(tb.E, { family: { kind: "order", order: tb.pmOrder, G: tb.n } }).intervals,
        best: tauPath(tb.E, { family: { kind: "all" } }).intervals,
      };
      const fullMissStart = findMissBands(fullLawPath.mean, fullLawPath.best)[0]?.from ?? 0.15;

      const tagMark = (name, value = "") => (index, scales, values, dimensions, context, next) => {
        const group = next(index, scales, values, dimensions, context);
        group.setAttribute(name, String(value));
        return group;
      };

      function drawDataSelectedReadout(state, rule, res, G, opt, fracMode) {
        const ev = res.ev;
        const capWords = G < tb.n ? [`, ${T.atMost} `, count(G), ` ${G === 1 ? T.gradeWord : T.gradesWord}`] : [];
        const head =
          rule === "optimum"
            ? [", ", tagNode(ctx, res, { key: "readout-optimum" })]
            : rule === "pm-tiers"
              ? [", ", count(G), ` ${T.rulePmTiers.toLowerCase()}`]
              : [...capWords, `, ${ruleName(rule).charAt(0).toLowerCase()}${ruleName(rule).slice(1)}`];
        const gap =
          opt && rule !== "optimum"
            ? (() => {
                const same = Array.from(res.grade ?? res).every((g, i) => g === opt.grade[i]);
                if (same) return [` It is ${T.sameReport}`];
                const d = ev.risk - opt.risk;
                if (Math.abs(d) <= opt.tieTol) return [` It has ${T.sameRisk}`];
                return [` The exact optimum has risk `, ro("opt.risk", opt.risk, fracMode ? formatRational(opt.risk) : formatRisk(opt.risk)), "."];
              })()
            : [];
        selectedReadout.replaceChildren(
          "τ = ",
          setting(state.tau),
          ...head,
          ": ",
          ro("N", ev.N, formatCount(ev.N)),
          ` ${T.of} `,
          count(ev.M),
          ` ${T.stated}, ${T.eWords} `,
          ro("E", ev.Ew, fmtE(tb, ev.Ew)),
          `, ${T.riskWords} `,
          ro("risk", ev.risk, fracMode ? formatRational(ev.risk) : formatRisk(ev.risk)),
          ".",
          ...gap,
        );
        labelLine.replaceChildren(...scopeParts(tb, rule, res, G, "chosen"));
      }

      function drawLawTables(state, results, fracMode) {
        lawText.replaceChildren(
          h("p", {}, ...fill(T.lawStates, { p1: lawNum(law.probs[0]), s1: stateNum(law.values[0]), p2: lawNum(law.probs[1]), s2: stateNum(law.values[1]) })),
          h(
            "p",
            {},
            ...fill(T.lawSummaries, {
              m: ctx.num(Array.from(tb.means), `(${tb.means.map((x) => formatDecimal(x, { digits: 0 })).join(", ")})`),
              r: ctx.num(Array.from(tb.er), `(${tb.er.map((x) => formatDecimal(x, { digits: 1 })).join(", ")})`),
            }),
            " ",
            ...fill(T.erDefinition, { one: count(1) }),
          ),
        );
        lawNotes.replaceChildren(
          h("p", { class: "prx-pt-note", text: T.compareNote }),
          h("p", { class: "prx-pt-note", text: T.gapNote }),
          h("p", { class: "prx-pt-note", text: "Grade one is highest priority: the largest true value as the posterior judges it." }),
        );
        matchedNote.replaceChildren(...fill(T.lawLink, { n: count(CONFIG.comparisonN) }));

        const evs = TB19.reports.map((g) => ({ g, ev: evaluateReport(g, tb.E, { tau: state.tau }) }));
        const best = (r) => new Set(results[r] ? (results[r].grades ?? [results[r].grade]).map((g) => TB19.key(g)) : []);
        const bestOf = { pm: best("pm-cuts"), er: best("er-cuts"), all: best("optimum") };
        evs.sort((a, b) => a.ev.N - b.ev.N || a.ev.Ew - b.ev.Ew);
        const body = evs.map(({ g, ev }) => {
          const k = TB19.key(g);
          const tags = [bestOf.pm.has(k) ? T.bestPm : null, bestOf.er.has(k) ? T.bestEr : null, bestOf.all.has(k) ? T.bestAll : null].filter(Boolean);
          return h(
            "tr",
            { "data-prx-report": k },
            h("th", { scope: "row" }, ctx.num(g, formatGrades(g)), h("span", { class: "prx-pt-blocks-text", text: ` ${blocksText(g, tb.ids)}` })),
            h("td", { "data-prx-law-value": "risk" }, ctx.num(ev.risk, fracMode ? formatRational(ev.risk) : formatRisk(ev.risk))),
            h("td", { "data-prx-law-value": "N" }, ctx.num(ev.N, formatCount(ev.N))),
            h("td", { "data-prx-law-value": "Ew" }, ctx.num(ev.Ew, formatRational(ev.Ew))),
            h("td", {
              text:
                TB19.inPm.has(k) && TB19.inEr.has(k)
                  ? T.both
                  : TB19.inPm.has(k)
                    ? tb.pmOrder.map((i) => tb.ids[i]).join(", ")
                    : TB19.inEr.has(k)
                      ? tb.erOrder.map((i) => tb.ids[i]).join(", ")
                      : "",
            }),
            h("td", { text: tags.join(T.andWord) }),
          );
        });
        tableSlot.replaceChildren(
          h(
            "table",
            { class: "prx-pt-table prx-pt-table-law prx-sticky-first" },
            h("caption", { text: T.tableCaption }),
            h("thead", {}, h("tr", {}, ...[T.colReport, T.colRisk, T.colN, T.colE, T.colOrder, T.colBest].map((t) => h("th", { scope: "col", text: t })))),
            h("tbody", {}, ...body),
          ),
        );

        const summary = rankSummaries({ states: law.values.map((s) => Array.from(s)), probs: Array.from(law.probs) });
        const chosenOrder = state.order === "rank" ? tb.erOrder : tb.pmOrder;
        const selectedCut = results[state.order === "rank" ? "er-cuts" : "pm-cuts"];
        const pal = palette(ctx.root);
        const stateTable = h(
          "table",
          { class: "prx-pt-table prx-pt-state" },
          h("caption", {}, "Two possible states of the true values"),
          h("thead", {}, h("tr", {}, h("th", {}, "State or summary"), ...tb.ids.map((id) => h("th", { scope: "col" }, id)), h("th", {}, "Chance"))),
          h(
            "tbody",
            {},
            ...law.values.map((values, k) =>
              h(
                "tr",
                {},
                h("th", { scope: "row" }, "State ", count(k + 1)),
                ...values.map((v) => h("td", {}, v === Math.max(...values) ? h("span", { class: "top" }, count(v)) : count(v))),
                h("td", {}, ctx.num(law.probs[k], formatRational(law.probs[k]))),
              ),
            ),
            h(
              "tr",
              { "data-on": state.order === "mean" ? "" : null },
              h("th", { scope: "row" }, "Posterior mean"),
              ...tb.means.map((v, i) => h("td", {}, ro(`state-mean-${tb.ids[i]}`, v, formatDecimal(v, { digits: 0 })))),
              h("td"),
            ),
            h(
              "tr",
              { "data-on": state.order === "rank" ? "" : null },
              h("th", { scope: "row" }, "Expected rank (", count(1), " = top)"),
              ...tb.er.map((v, i) => h("td", {}, ro(`state-rank-${tb.ids[i]}`, v, formatDecimal(v, { digits: 1 })))),
              h("td"),
            ),
            h(
              "tr",
              {},
              h("th", { scope: "row" }, "Chance of truly being highest"),
              ...summary.pTop[0].map((v, i) => h("td", {}, ro(`state-top-${tb.ids[i]}`, v, formatRational(v)))),
              h("td"),
            ),
          ),
        );
        const strip = (name, result, key) =>
          h(
            "div",
            { class: "prx-pt-strip" },
            h("strong", {}, name),
            chips(tb, Array.from(result.grade), pal),
            h(
              "p",
              {},
              "Risk ",
              ro(`${key}.risk`, result.ev.risk, formatRisk(result.ev.risk)),
              "; N = ",
              count(result.ev.N),
              ". ",
              tagNode(ctx, result, { key: `strip-${key}`, orderWords: state.order === "rank" ? "expected-rank order" : "posterior-mean order" }),
            ),
          );
        const pTop = summary.pTop[0][chosenOrder[0]];
        const ratio = formatRational(pTop).split("/").map(Number);
        const chance = ratio.length === 2 ? [count(ratio[0]), " times in ", count(ratio[1])] : [ctx.num(pTop, formatProb(pTop))];
        lawExtras.replaceChildren(
          ctx.scrollRegion(h("div", { class: "prx-pt-table-scroll" }, stateTable), "States and posterior summaries"),
          h(
            "p",
            { class: "prx-pt-note" },
            "The top true value is boxed in each state; the highlighted summary chooses the inspected order. Sorting by ",
            state.order === "rank" ? "expected rank" : "posterior mean",
            " puts ",
            tb.ids[chosenOrder[0]],
            " first; that unit is truly on top ",
            ...chance,
            ". The best report puts ",
            tb.ids.filter((_, i) => results.optimum.grade[i] === 1).join(" and "),
            " in the highest grade (risk ",
            ctx.num(results.optimum.ev.risk, formatRisk(results.optimum.ev.risk)),
            " against ",
            ctx.num(selectedCut.ev.risk, formatRisk(selectedCut.ev.risk)),
            " for the inspected order).",
          ),
        );
        hero.replaceChildren(
          h(
            "div",
            { class: "prx-pt-strips" },
            strip(`Cuts of ${chosenOrder.map((i) => tb.ids[i]).join(", ")}`, selectedCut, "cut"),
            strip("Any report in the declared family", results.optimum, "any"),
          ),
        );
        if (selectedCut.ev.N !== results.optimum.ev.N) {
          hero.append(h("p", { class: "prx-pt-note" }, captionNode(ctx, "different-disclosure")));
        }
      }

      function drawMini(chosenGrade, tieTol) {
        const Mi = CONFIG.mini;
        const measured = Math.round(miniSlot.clientWidth || miniSlot.getBoundingClientRect?.().width || 0);
        const width = Math.min(Mi.width, measured > 0 ? Math.max(240, measured) : 320);
        const { hullAll, hullPm, hullEr, points } = TB19;
        const M = disclosure([1, 2, 3]).M;
        const yTop = Math.max(...points.map((p) => p.Ew)) * Mi.yHead;
        const chosen = points.filter((p) => TB19.key(p.grade) === TB19.key(chosenGrade));
        const midPm = hullPm[1];
        const midAll = hullAll[1];
        plot(miniSlot, {
          alt: `${T.miniAlt} The expected-rank boundary is dotted and recovers the solid frontier.`,
          keyboard: {
            data: points,
            x: "N",
            y: "Ew",
            title: (p) => `${formatGrades(Array.from(p.grade))}: N ${formatCount(p.N)}, E ${formatRational(p.Ew)}.`,
          },
          table: {
            caption: T.miniTable,
            columns: [
              { label: "Boundary", value: "b" },
              { label: "Pairs stated, N", value: "N", format: (v) => formatCount(v), header: true },
              { label: "Expected wrong directions, E", value: "Ew", format: (v) => formatRational(v) },
              { label: "Report", value: (d) => Array.from(d.grade), format: (v) => formatGrades(v) },
            ],
            rows: [...hullPm.map((v) => ({ ...v, b: T.boundaryPm })), ...hullAll.map((v) => ({ ...v, b: T.boundaryAll }))],
          },
          width,
          height: Mi.height,
          aspect: false,
          marginTop: Mi.marginTop,
          marginRight: Mi.marginRight,
          marginBottom: Mi.marginBottom,
          marginLeft: Mi.marginLeft,
          x: {
            domain: [-Mi.pad, M + Mi.pad],
            ticks: Array.from({ length: M + 1 }, (_, i) => i),
            tickFormat: (d) => formatCount(d),
            label: T.xLabel,
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { domain: [0, yTop], label: T.yLabel, labelArrow: "none", grid: true },
          color: { type: "identity" },
          marks: (c, P) => [
            P.dot(points, { x: "N", y: "Ew", r: Mi.dot, stroke: c.plotMuted, fill: c.plotBg }),
            P.line(hullPm, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2, strokeDasharray: Mi.dash }),
            P.line(hullAll, { x: "N", y: "Ew", stroke: c.plotFg, strokeWidth: 2 }),
            P.line(hullEr, { x: "N", y: "Ew", stroke: c.plotBg, strokeWidth: 2.6, strokeDasharray: "2 3" }),
            P.line(hullEr, { x: "N", y: "Ew", stroke: c.plotMuted, strokeWidth: 2.2, strokeDasharray: "2 3" }),
            P.dot([...hullPm, ...hullAll], { x: "N", y: "Ew", r: Mi.vertex, fill: c.plotFg, stroke: c.plotBg }),
            P.dot(chosen, { x: "N", y: "Ew", r: Mi.ring, stroke: c.plotFg, strokeWidth: 2, fill: "none" }),
            numText([midPm], { x: "N", y: "Ew", value: "Ew", format: (v) => formatRational(v), dx: Mi.labelDx, dy: -Mi.labelDy, textAnchor: "end", fill: c.plotFg }),
            numText([midAll], { x: "N", y: "Ew", value: "Ew", format: (v) => formatRational(v), dx: Mi.labelDx, dy: Mi.labelDyBelow, textAnchor: "end", fill: c.plotFg }),
          ],
        });
        const erSame =
          hullEr.length === hullAll.length &&
          hullEr.every((v, i) => v.N === hullAll[i].N && Math.abs(v.Ew - hullAll[i].Ew) <= tieTol);
        miniNote.replaceChildren(`${T.miniNote} Dotted: the expected-rank order B, C, A. ${erSame ? T.miniErSame : T.miniErDiffers}`);
      }

      function drawTauComparison(state, G, results) {
        const family = state.opt === "all" || G === tb.n ? { kind: "all" } : { kind: "atMost", G };
        const defs = [
          { name: "Posterior-mean cuts", key: "mean", dash: "7 4", family: { kind: "order", order: tb.pmOrder, G } },
          { name: "Expected-rank cuts", key: "rank", dash: "2 3", family: { kind: "order", order: tb.erOrder, G } },
          { name: "Best of the declared family", key: "best", dash: null, family },
        ];
        const segments = defs.flatMap((d) =>
          tauPath(tb.E, { family: d.family }).intervals.map((segment, k) => ({
            ...segment,
            name: d.name,
            key: d.key,
            index: k,
            segment: `${d.name}-${k}`,
          })),
        );
        pathTableSlot.replaceChildren(
          h(
            "table",
            { class: "prx-pt-table prx-pt-table-path prx-sticky-first" },
            h("caption", {}, "Every exact interval, including zero-length endpoint intervals"),
            h("thead", {}, h("tr", {}, ...["Family", "Risk from", "Risk to", "From τ", "To τ", "Report", "N", "E"].map((x) => h("th", { scope: "col" }, x)))),
            h(
              "tbody",
              {},
              ...segments.map((s) =>
                h(
                  "tr",
                  { "data-prx-path": s.key, "data-prx-interval": s.index },
                  h("th", { scope: "row" }, s.name),
                  ...[
                    ["riskFrom", s.riskFrom, formatRisk],
                    ["riskTo", s.riskTo, formatRisk],
                    ["from", s.tauFrom, formatSetting],
                    ["to", s.tauTo, formatSetting],
                    ["grades", Array.from(s.grade), formatGrades],
                    ["N", s.N, formatCount],
                    ["E", s.Ew, formatRational],
                  ].map(([key, v, f]) => h("td", {}, ro(`path-${key}`, v, f(v)))),
                ),
              ),
            ),
          ),
        );

        const points = segments.flatMap((s) =>
          [s.tauFrom, s.tauTo].map((tauVal) => ({
            ...s,
            tau: tauVal,
            risk: tauVal === s.tauFrom ? s.riskFrom : s.riskTo,
          })),
        );
        const [mean, rank, best] = defs.map((d) => segments.filter((s) => s.key === d.key));
        const bands = findMissBands(mean, best);
        const tiePrices = [...new Set([...mean, ...rank, ...best].map((s) => s.tauTo).filter((t) => t > 0 && t < 0.5))].sort((a, b) => a - b);
        const currentCut = results[state.order === "rank" ? "er-cuts" : "pm-cuts"].ev.risk;
        const currentBest = results.optimum.ev.risk;
        const different = Math.abs(currentCut - currentBest) > CONFIG.tieTol;
        const current = [
          { id: "best", tau: state.tau, risk: currentBest },
          ...(different ? [{ id: "cut", tau: state.tau, risk: currentCut }] : []),
        ];
        const yTop = Math.max(...points.map((p) => p.risk));

        const measured = Math.round(pathSlot.clientWidth || pathSlot.getBoundingClientRect?.().width || 0);
        const width = measured > 0 ? Math.max(240, measured) : 640;
        const narrow = width < 440;
        const height = narrow ? 232 : 280;
        const marginTop = 32;
        const marginRight = narrow ? 18 : 26;
        const marginBottom = 42;
        const marginLeft = narrow ? 46 : 56;

        plot(pathSlot, {
          width,
          height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
          x: {
            domain: [0, 0.5],
            ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
            label: "Withholding cost τ",
          },
          y: {
            domain: [0, yTop],
            ticks: narrow ? 4 : 5,
            label: "Best risk at this τ",
            grid: true,
          },
          color: {
            domain: defs.map((d) => d.name),
            range: ["var(--prx-plot-fg)", "var(--prx-plot-muted)", "var(--prx-plot-fg)"],
            legend: false,
          },
          marks: (c, P) => [
            P.rect(bands, {
              x1: "from",
              x2: "to",
              y1: 0,
              y2: yTop,
              fill: c.est,
              fillOpacity: 0.12,
              render: tagMark("data-prx-miss-band"),
            }),
            P.ruleX(tiePrices, { stroke: c.plotMuted, strokeOpacity: 0.65, strokeDasharray: "1 4" }),
            ...[defs[2], defs[0], defs[1]].flatMap((d) => {
              const pts = points.filter((p) => p.key === d.key);
              return d.key === "rank"
                ? [
                    P.line(pts, { x: "tau", y: "risk", z: "segment", stroke: c.plotBg, strokeDasharray: d.dash, strokeWidth: 2.6 }),
                    P.line(pts, { x: "tau", y: "risk", z: "segment", stroke: "name", strokeDasharray: d.dash, strokeWidth: 2.2 }),
                  ]
                : [P.line(pts, { x: "tau", y: "risk", z: "segment", stroke: "name", strokeDasharray: d.dash, strokeWidth: 2 })];
            }),
            P.ruleX([state.tau], {
              stroke: c.est,
              strokeWidth: 1.75,
              render: tagMark("data-prx-current-tau", state.tau),
            }),
            P.dot(current, { x: "tau", y: "risk", r: 3.5, fill: c.est, stroke: c.plotBg, strokeWidth: 1.2 }),
            // 13px tie-price ticks placed cleanly in the top header band above yTop, nudging .30/.35 apart on narrow phones
            numText(tiePrices, {
              x: (t) => t,
              y: () => yTop,
              dy: -11,
              value: (t) => t,
              format: formatSetting,
              fill: c.plotMuted,
              fontSize: 13,
              render(index, scales, values, dims, context, next) {
                const g = next(index, scales, values, dims, context);
                g.setAttribute("data-prx-tie-prices", "");
                const nodes = [...g.querySelectorAll("text")];
                const xs = Array.from(index, (idx) => scales.x(tiePrices[idx]));
                const shifts = xs.map(() => 0);
                for (let i = 0; i < xs.length - 1; i += 1) {
                  const gap = xs[i + 1] - xs[i];
                  if (gap < 34) {
                    const push = (34 - gap) / 2;
                    shifts[i] -= push;
                    shifts[i + 1] += push;
                  }
                }
                nodes.forEach((node, j) => {
                  if (!shifts[j]) return;
                  const base = node.getAttribute("transform") || "";
                  node.setAttribute("transform", `${base} translate(${shifts[j].toFixed(1)},0)`.trim());
                });
                return g;
              },
            }),
            // 13px current-τ risk callouts placed via placeDirectLabels (WA-02 item.id) with plotBg backing pills (WB-03)
            numText(current, {
              x: "tau",
              y: "risk",
              value: "risk",
              format: formatReadoutRisk,
              fill: c.plotFg,
              fontSize: 13,
              fontWeight: "bold",
              render(index, scales, values, dims, context, next) {
                const g = next(index, scales, values, dims, context);
                const nodes = [...g.querySelectorAll("text")];
                const rawItems = Array.from(index, (idx) => ({
                  id: current[idx].id,
                  y: scales.y(current[idx].risk),
                  height: 18,
                }));
                const placed = placeDirectLabels(rawItems, {
                  minGapPx: 20,
                  minY: dims.marginTop + 11,
                  maxY: dims.height - dims.marginBottom - 11,
                });
                const byId = new Map(placed.map((p) => [p.id, p]));
                const onLeft = state.tau > 0.34;
                const tx = scales.x(state.tau);

                Array.from(index).forEach((idx, j) => {
                  const node = nodes[j];
                  if (!node) return;
                  const item = current[idx];
                  const py = byId.get(item.id)?.y ?? scales.y(item.risk);
                  const txt = formatReadoutRisk(item.risk);
                  const pillW = Math.max(34, txt.length * 7.8 + 8);
                  const pillH = 17;
                  const lx = onLeft ? tx - 8 : tx + 8;
                  const rxRect = onLeft ? lx - pillW + 3 : lx - 3;

                  node.removeAttribute("transform");
                  node.removeAttribute("dx");
                  node.removeAttribute("dy");
                  node.setAttribute("x", lx.toFixed(1));
                  node.setAttribute("y", (py + 4.5).toFixed(1));
                  node.setAttribute("text-anchor", onLeft ? "end" : "start");

                  const bgRect = svgEl(ctx.doc, "rect", {
                    x: rxRect.toFixed(1),
                    y: (py - pillH / 2).toFixed(1),
                    width: pillW.toFixed(1),
                    height: pillH,
                    rx: 3,
                    fill: c.plotBg,
                    stroke: c.cellBorder,
                    strokeOpacity: 0.35,
                    strokeWidth: 0.75,
                  });
                  g.insertBefore(bgRect, node);
                });
                return g;
              },
            }),
          ],
          alt: "The best risk along each declared order and over the declared family at the same withholding price. Exact segment endpoints come from the engine cost paths.",
          keyboard: {
            data: points,
            x: "tau",
            y: "risk",
            title: (p) => `${p.name}, tau ${formatSetting(p.tau)}, risk ${formatRisk(p.risk)}, report ${formatGrades(Array.from(p.grade))}.`,
          },
          table: {
            caption: "Exact risk-curve endpoints",
            columns: [
              { label: "Family", value: "name" },
              { label: "τ", value: "tau", format: (v) => formatSetting(v) },
              { label: "Risk", value: "risk", format: (v) => formatRisk(v) },
            ],
            rows: points,
          },
        });

        pathLegend.replaceChildren();
        for (const d of defs) {
          const svg = svgEl(
            ctx.doc,
            "svg",
            { viewBox: "0 0 32 10", width: 32, height: 10, "aria-hidden": "true" },
            svgEl(ctx.doc, "line", {
              x1: 0,
              y1: 5,
              x2: 32,
              y2: 5,
              stroke: d.key === "rank" ? "var(--prx-plot-muted)" : "var(--prx-plot-fg)",
              strokeWidth: 2,
              ...(d.dash ? { strokeDasharray: d.dash } : {}),
            }),
          );
          pathLegend.append(h("span", { class: "prx-key" }, svg, d.name));
        }
        pathLegend.append(
          h(
            "span",
            { class: "prx-pt-path-cue" },
            bands.length ? "Shaded: mean order misses · Dotted: tie prices" : "Dotted: tie prices",
          ),
        );

        pathScope.replaceChildren(
          "Each curve gives the best risk at its own price, not a comparison of risks across prices. In the default unrestricted example, the posterior-mean order misses above ",
          setting(fullMissStart),
          "; the expected-rank cuts recover the best report here. One law, not a general failing of posterior-mean orders.",
        );
        return bands;
      }

      function drawLawReadout(state, results, bands) {
        const { optimum } = results;
        const order = state.order === "rank" ? tb.erOrder : tb.pmOrder;
        const cut = results[state.order === "rank" ? "er-cuts" : "pm-cuts"];
        const names = order.map((i) => tb.ids[i]).join(", ");
        const action = (res) => {
          if (!res.ev.N) return "withholds all";
          const grades = Array.from(res.grade);
          return `puts ${Array.from({ length: Math.max(...grades) }, (_, g) => tb.ids.filter((_, i) => grades[i] === g + 1).join(" and ")).join(" above ")}`;
        };

        const ties = optimum.grades ?? [optimum.grade];
        const tieText =
          ties.length > 1
            ? [
                " Tied at ",
                risk3(optimum.risk),
                ": ",
                ...ties.flatMap((grade, i) => [
                  i ? "; " : "",
                  ctx.num(Array.from(grade), formatGrades(Array.from(grade))),
                  " (N ",
                  count(disclosure(Array.from(grade)).N),
                  ")",
                ]),
                ".",
              ]
            : [];
        const cap = results.G < tb.n ? [" (at most ", count(results.G), results.G === 1 ? " grade)" : " grades)"] : [];
        const missText =
          results.G === tb.n && bands.length === 1 && bands[0].to === CONFIG.tau.max
            ? [" Mean order misses above ", setting(bands[0].from), "."]
            : [];

        const sameReport = TB19.key(cut.grade) === TB19.key(optimum.grade);
        if (sameReport) {
          ctx.readout.set([
            "At τ = ",
            setting(state.tau),
            ...cap,
            ", best ",
            names,
            " cut matches the best report (",
            action(optimum),
            ", risk ",
            risk3(optimum.ev.risk),
            ").",
            ...tieText,
            ...missText,
          ]);
        } else {
          ctx.readout.set([
            "At τ = ",
            setting(state.tau),
            ...cap,
            ", best ",
            names,
            " cut ",
            action(cut),
            " (",
            risk3(cut.ev.risk),
            "); best report ",
            ...(cap.length && state.opt === "all" ? ["of any grade count "] : []),
            action(optimum),
            " (",
            risk3(optimum.ev.risk),
            ").",
            ...tieText,
            ...missText,
          ]);
        }
      }

      return {
        render(state, info = {}) {
          // PR-06 / PR-09: toggling <details> never re-renders ctx.stage or re-fires ctx.readout;
          // opening method re-renders miniSlot at its real open mobile/desktop width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "method" && methodBox.open) {
              const results = compute(tb, state);
              drawMini(Array.from(results[state.rule].grade), CONFIG.tieTol);
            }
            return;
          }

          ctx.root.setAttribute("aria-busy", "true");
          try {
            if (["pm-cuts", "er-cuts"].includes(state.rule)) {
              const ruleChanged = info.changed?.includes("rule") && !info.changed?.includes("order");
              const wantedOrder = ruleChanged ? (state.rule === "er-cuts" ? "rank" : "mean") : state.order;
              const wantedRule = wantedOrder === "rank" ? "er-cuts" : "pm-cuts";
              if (state.order !== wantedOrder || state.rule !== wantedRule) {
                ctx.set({ order: wantedOrder, rule: wantedRule });
                return;
              }
            }

            orderControl.set(state.order);
            const rule = state.rule;
            const results = compute(tb, state);
            const G = results.G;

            ruleRadio.set(rule);
            capRadio.set(G);
            capRadio.inputs.forEach((input, k) => {
              input.disabled = capValues[k] > tb.n;
            });
            optRadio.set(state.opt);
            optRadio.setDisabled(G >= tb.n);
            tau.set(state.tau);

            const fracMode =
              tb.fraction &&
              fracOK([
                ...RULES.map((r) => results[r].ev.risk),
                ...TB19.reports.map((g) => evaluateReport(g, tb.E, { tau: state.tau }).risk),
              ]);
            const pal = palette(ctx.root);
            const opt = results.optimum;

            const bands = drawTauComparison(state, G, results);
            drawLawReadout(state, results, bands);

            const rows = RULES.map((r) => drawRow(tb, r, results[r], opt, G, r === rule, pal, fracMode));
            lawRows.replaceChildren(...rows);
            drawLawTables(state, results, fracMode);
            drawDataSelectedReadout(state, rule, results[rule], G, opt, fracMode);
            drawMini(Array.from(results[rule].grade), CONFIG.tieTol);
            ctx.caption.replaceChildren(T.noteTb19);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
