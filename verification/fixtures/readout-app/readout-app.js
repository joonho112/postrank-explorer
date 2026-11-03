// Fixture app of the read-out check's self-test (node verification/check_readouts.mjs --self-test), from postrank
// Explorer v1's test widget (verification/fixtures/test-widget/) without its prediction gate. It computes nothing from
// the engine: one of each control, a main action, a read-out, a caption, and one figure with a pointer tip, a keyboard
// layer, a hidden table, numeric labels and a formula label. It is not in the catalog. Its case file,
// readout-app.json, sits next to it (not in verification/readouts/, so a plain run of the check does not count it).
// mountWidget(el, spec, { presets, name }) takes two test-only options: presets for base.js (def.presets), as a
// catalog entry would give them, and another createWidget name (to plant an app that is not its catalog name).
import { createWidget } from "../../../js/shared/base.js";
import { numText, plot } from "../../../js/shared/chart.js";
import { formatCount, formatProb, formatSetting } from "../../../js/shared/format.js";

export const CONFIG = Object.freeze({
  name: "readout-app",
  label: "Read-out fixture",
  title: "Read-out fixture",
  tau: Object.freeze({ min: 0.05, max: 0.5, step: 0.01, value: 0.2 }),
  n: Object.freeze({ min: 2, max: 12, step: 1, value: 4 }),
  families: Object.freeze(["unrestricted", "capped"]),
  points: Object.freeze([
    Object.freeze({ id: "A", x: 0.12, p: 0.81 }),
    Object.freeze({ id: "B", x: 0.35, p: 0.42 }),
    Object.freeze({ id: "C", x: 0.58, p: 0.67 }),
    Object.freeze({ id: "D", x: 0.83, p: 0.19 }),
  ]),
  caption: "Test data; nothing here is computed by the engine.",
  alt: "Four test points A to D with their probabilities",
  tableCaption: "Test points",
  formula: "\\tau",
  formulaAt: Object.freeze({ y: 0.95 }),
  height: 240,
});

const choiceOptions = CONFIG.families.map((f) => ({ value: f, label: f }));

export function mountWidget(el, spec = {}, { presets, name = CONFIG.name } = {}) {
  return createWidget(el, spec, {
    name,
    ...(presets ? { presets } : {}),
    label: CONFIG.label,
    title: CONFIG.title,
    keys: {
      tau: { type: "number", ...CONFIG.tau },
      n: { type: "integer", ...CONFIG.n },
      family: { type: "choice", values: CONFIG.families, value: CONFIG.families[0] },
      show: { type: "boolean", value: true },
    },
    build(ctx) {
      let runs = 0;
      const tau = ctx.slider({ label: "τ (the withholding price)", ...ctx.key("tau"), name: "tau", onInput: (v) => ctx.set({ tau: v }) });
      const family = ctx.select({ label: "Family", options: choiceOptions, value: ctx.state.family, name: "family", onChange: (v) => ctx.set({ family: v }) });
      const n = ctx.radioGroup({ legend: "Units", name: "n", options: [CONFIG.n.min, CONFIG.n.value].map((v) => ({ value: v, label: formatCount(v) })), value: ctx.state.n, onChange: (v) => ctx.set({ n: v }) });
      const show = ctx.toggle({ label: "Show labels", checked: ctx.state.show, name: "show", onChange: (v) => ctx.set({ show: v }) });
      const compute = () => {
        runs += 1;
        ctx.requestRender("compute");
      };
      const run = ctx.button({ label: "Compute", primary: true, key: "compute", onClick: compute });
      ctx.onPrimary(compute);
      ctx.controls.append(tau.root, family.root, n.root, show.root, run.root);
      const chartSlot = ctx.h("div", { class: "prx-fixture-chart" });
      ctx.charts.append(chartSlot);
      ctx.caption.textContent = CONFIG.caption;
      return {
        get runs() { return runs; },
        render(state) {
          tau.set(state.tau);
          family.set(state.family);
          n.set(state.n);
          show.set(state.show);
          ctx.readout.set([
            "τ = ", ctx.num(state.tau, formatSetting(state.tau)),
            "; family ", state.family,
            "; units ", ctx.num(state.n, formatCount(state.n)),
            "; runs ", ctx.num(runs, formatCount(runs)), ".",
          ]);
          const rows = CONFIG.points.map((d) => ({ ...d }));
          plot(chartSlot, {
            alt: CONFIG.alt,
            table: {
              caption: CONFIG.tableCaption,
              columns: [{ label: "Point", value: "id" }, { label: "Position", value: "x", format: (v) => formatProb(v) }, { label: "Probability", value: "p", format: (v) => formatProb(v) }],
              rows,
            },
            height: CONFIG.height,
            x: { domain: [0, 1], label: "Position" },
            y: { domain: [0, 1], label: "Probability" },
            marks: (c, P) => [
              P.ruleX([state.tau], { stroke: c.wh }),
              P.dot(rows, { x: "x", y: "p", fill: c.post, r: 5, tip: true, title: (d) => `${d.id}: ${formatProb(d.p)}` }),
              state.show ? numText(rows, { x: "x", y: "p", dy: -10, value: "p", format: (v) => formatProb(v), fill: c.plotFg }) : null,
            ],
            formulas: [{ tex: CONFIG.formula, x: state.tau, y: CONFIG.formulaAt.y, anchor: "start", dx: 4, key: "tau" }],
            keyboard: { data: rows, x: "x", y: "p", key: "id", title: (d) => `Point ${d.id}: probability ${formatProb(d.p)}` },
          });
        },
      };
    },
  });
}
