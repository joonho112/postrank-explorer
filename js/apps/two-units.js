export * from "../shared/domain/two-units.js";

// App entry point for two-units (1.8: "Two units, one probability", Frame v2 Polish).
// Preserves 100% of ../shared/domain/two-units.js untouched for sibling app 1.9 correlated-units.
import { createWidget } from "../shared/base.js";
import { formatCount, formatProb, formatSetting } from "../shared/format.js";
import { renderTex } from "../shared/math.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  CONFIG,
  CSS,
  compute,
  drawDiff,
  drawTop,
  piName,
  probText,
  reverseTex,
  sharedDomain,
  sharedYMax,
  symName,
  unitControls,
  unitKeys,
  workedTex,
} from "../shared/domain/two-units.js";

const T = CONFIG.text;

const V2_CSS = `
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
  gap: 0.45rem 0.75rem;
  flex: 1 1 100%;
  width: 100%;
}
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-two-units-unit {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.65rem;
  padding: 0.2rem 0.65rem 0.45rem;
  margin: 0;
  min-width: 0;
}
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-two-units-unit > .prx-slider + .prx-slider {
  margin-top: 0;
}
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-stage {
  container-type: inline-size;
}
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-stage .prx-two-units-panels,
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-stage .prx-two-units-panel {
  grid-area: auto;
  min-width: 0;
}
.prx-two-units.prx-widget[data-prx-frame="v2"] .prx-disclosure-body .prx-two-units-formula {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
@media (max-width: 30em) {
  .prx-two-units.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.3rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-two-units-unit { padding: 0.15rem 0.5rem 0.35rem; gap: 0.25rem 0.5rem; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.18rem 0.48rem; font-size: 0.8125rem; line-height: 1.25; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.4rem; padding: 0.25rem 0.45rem; font-size: 0.875rem; line-height: 1.35; }
  .prx-two-units.prx-widget[data-prx-frame="v2"] .prx-stage { padding: 0.45rem 0.5rem; }
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: `${CSS}${V2_CSS}`,
    frame: "v2",
    keys: unitKeys(),
    build(ctx) {
      const { h } = ctx;
      const writer = ro(ctx);

      // --- controls: compact Unit A & Unit B fieldsets in toolbar
      const units = unitControls(ctx);
      ctx.controls.append(...units.roots);

      // --- primary stage: linked posteriors of A & B + difference A − B on shared scales
      ctx.stage.classList.add("prx-two-units-charts");
      const topSlot = h("div", { class: "prx-two-units-panel" });
      const diffSlot = h("div", { class: "prx-two-units-panel" });
      const differenceSD = h("p", { "data-prx-evidence": "difference-sd" });
      ctx.stage.append(h("div", { class: "prx-two-units-panels prx-two-units-stacked" }, topSlot, diffSlot), differenceSD);

      // --- disclosures: exact 4-decimal summary table in Data; general & live formulas in Method
      const dataBox = ctx.dataBox("Data and exact values");
      const dataTableHost = h("div", { class: "prx-two-units-exact-table" });
      dataBox.body.append(dataTableHost);

      const methodBox = ctx.methodBox("Method and formula");
      const tex = (name, label) => ctx.scrollRegion(h("div", { class: "prx-two-units-tex", "data-prx-tex": name }), label);
      const general = tex("general", T.regionGeneral);
      const worked = tex("worked", T.regionWorked);
      const reverse = tex("reverse", T.regionReverse);
      const gloss = h(
        "p",
        { class: "prx-two-units-note" },
        piName(h, "AB"),
        T.glossA,
        symName(h, "θ", "A"),
        T.glossB,
        symName(h, "θ", "B"),
        T.glossC,
        h("i", { text: "Y" }),
        T.glossD,
        "Φ(",
        h("i", { text: "z" }),
        T.glossPhiA,
        ctx.num(0, formatSetting(0)),
        T.glossPhiB,
        ctx.num(1, formatSetting(1)),
        T.glossPhiC,
        h("i", { text: "z" }),
        "."
      );
      const head = (text) => ctx.panelTitle(text, { className: "prx-two-units-head" });
      const formula = ctx.part(
        "formula",
        h(
          "div",
          { class: "prx-two-units-formula" },
          h(
            "div",
            { class: "prx-two-units-formula-grid" },
            h("div", { class: "prx-two-units-step" }, head(T.general), general, gloss),
            h("div", { class: "prx-two-units-step" }, head(T.worked), worked),
            h("div", { class: "prx-two-units-step" }, reverse, h("p", { class: "prx-two-units-note", text: T.reverseNote }))
          )
        )
      );
      methodBox.body.append(formula);
      renderTex(general, CONFIG.tex.general, { display: true });
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));

      function probPhrase(raw, pair, hook, first) {
        const s = probText(raw);
        const prefix = first ? "A exceeds B with probability " : " (reverse ";
        const suffix = first ? "" : ")";
        return CONFIG.boundWords.test(s)
          ? [prefix, piName(h, pair), " ", writer.num(raw, s, { hook }), suffix]
          : [prefix, piName(h, pair), " = ", writer.num(raw, s, { hook }), suffix];
      }

      function renderExactTable(r) {
        renderDataTable(dataTableHost, {
          ctx,
          caption: "Exact posterior summaries and direction probabilities",
          regionLabel: "Exact posterior summaries and direction probabilities",
          stickyFirst: true,
          columns: [
            { label: "Quantity", key: "label", rowHeader: true },
            { label: "Posterior mean", key: "mean", kind: "decimal", digits: 4 },
            { label: "Posterior SD", key: "sd", kind: "decimal", digits: 4 },
            {
              label: "Gap in SDs (z)",
              key: "z",
              align: "right",
              render: (v) => (v === null ? "—" : ctx.num(v, v === 0 ? "0" : writer.est(v).textContent)),
            },
            {
              label: "Direction probability",
              key: "prob",
              align: "right",
              render: (v, row) =>
                row.exactOne
                  ? ctx.num(1, formatCount(1))
                  : ctx.num(v, formatProb(v, { digits: 4, open: true })),
            },
          ],
          rows: [
            { label: "Unit A", mean: r.muA, sd: r.sdA, z: null, prob: r.pi },
            { label: "Unit B", mean: r.muB, sd: r.sdB, z: null, prob: r.piReverse },
            { label: "Difference (A minus B)", mean: r.gap, sd: r.sdDiff, z: r.z, prob: 1, exactOne: true },
          ],
        });
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          units.set(state);
          const r = compute(state);
          const x = sharedDomain(r);
          const ymax = sharedYMax(r);
          drawTop(topSlot, r, x, ymax);
          drawDiff(diffSlot, r, x, ymax, { values: true });
          differenceSD.replaceChildren("Independent A and B: SD(A − B) = √(",
            writer.setting(r.sdA), "² + ", writer.setting(r.sdB), "²) = ", writer.est(r.sdDiff), ".");
          renderExactTable(r);
          const w = workedTex(r);
          renderTex(worked, w.tex, { display: true, nums: w.raws });
          const v = reverseTex(r);
          renderTex(reverse, v.tex, { display: true, nums: v.raws });

          const size = Math.abs(r.z);
          const zSpan = writer.est(size, { hook: "z" });
          writer.set([
            ...probPhrase(r.pi, "AB", "pi", true),
            ...probPhrase(r.piReverse, "BA", "pi-reverse", false),
            ". Difference A − B has mean ",
            writer.est(r.gap, { hook: "diff-mean" }),
            " and SD ",
            writer.est(r.sdDiff, { hook: "diff-sd" }),
            ...(r.z === 0
              ? [": the means are ", zSpan, " SDs apart."]
              : [": A's mean is ", zSpan, r.z > 0 ? " SDs above B's." : " SDs below B's."]),
          ]);
        },
      };
    },
  });
}
