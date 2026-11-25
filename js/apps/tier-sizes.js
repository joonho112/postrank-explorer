// App 3.2: Editable ordered tier sizes & exact composition disclosure distribution.
// All disclosure/count distributions come from the public engine; count-draft contract preserved for tier-sizes-counts.test.mjs.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, placeDirectLabels, plot, svgEl, svgScene } from "../shared/chart.js";
import { dataNum, formatCount, formatShare, formatSizes } from "../shared/format.js";
import { disclosure, pairCount, tierSizeDistribution } from "../pr-core.js";
import { CSS as TIER_CSS, createTierDisclosure, tierModelOfGrade } from "../shared/domain/fixed-tiers.js";

export const CONFIG = Object.freeze({ n: { min: 2, max: 30, value: 30 }, G: { min: 1, max: 30, value: 3 } });
const countTick = (v) => (Number.isInteger(v) ? formatCount(v) : "");

const CSS = `${TIER_CSS}
/* PR-01: reset any legacy container/grid-area assumptions inside frame v2 stage */
.prx-ts[data-prx-frame="v2"] .prx-stage {
  grid-area: unset;
}
.prx-ts[data-prx-frame="v2"] .ts-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.85rem;
  align-items: flex-end;
}
.prx-ts[data-prx-frame="v2"] .ts-controls .prx-number {
  max-width: 9.5rem;
}
.prx-ts[data-prx-frame="v2"] .ts-feedback {
  flex: 1 1 100%;
  margin: 0.25rem 0 0;
  padding: 0.45rem 0.6rem;
  font-size: var(--prx-text-sm, 0.84375rem);
  color: var(--prx-fg);
  background: var(--prx-bg-raised);
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}
.prx-ts[data-prx-frame="v2"] .ts-settings-stack {
  display: grid;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.85rem;
  align-items: flex-end;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-vector {
  flex: 1 1 16rem;
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}
.prx-ts[data-prx-frame="v2"] .ts-vector input {
  width: 100%;
  max-width: 28rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--prx-border-strong);
  color: var(--prx-fg);
  background: var(--prx-bg);
  border-radius: var(--prx-radius, 6px);
  font-variant-numeric: tabular-nums;
}
.prx-ts[data-prx-frame="v2"] .ts-editors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.65rem;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-editors .prx-number {
  max-width: 6.5rem;
}
.prx-ts[data-prx-frame="v2"] .ts-hint {
  color: var(--prx-fg-muted);
  font-size: var(--prx-text-sm, 0.84375rem);
  margin: 0;
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-figures {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem 1.25rem;
  align-items: start;
  min-width: 0;
}
@media (min-width: 52rem) {
  .prx-ts[data-prx-frame="v2"] .prx-stage .ts-figures {
    grid-template-columns: minmax(0, 1.06fr) minmax(0, 1fr);
  }
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-figures section {
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-partition-strip {
  margin: 0.15rem 0 0.35rem;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  font-size: var(--prx-text-sm, 0.84375rem);
  color: var(--prx-plot-fg);
  margin: 0.3rem 0 0;
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-key span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-current,
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-maximum {
  display: inline-block;
  width: 1.1rem;
  border-top: 2.2px solid var(--prx-est);
}
.prx-ts[data-prx-frame="v2"] .prx-stage .ts-maximum {
  border-top-color: var(--prx-post);
  border-top-style: dashed;
}
.prx-ts[data-prx-frame="v2"] .ts-formulas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  gap: 0.85rem 1.25rem;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-formulas section {
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-method-stack {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
.prx-ts[data-prx-frame="v2"] .ts-table-wrap {
  max-height: 24rem;
  overflow: auto;
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}
.prx-ts[data-prx-frame="v2"] .ts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--prx-text-sm, 0.84375rem);
  font-variant-numeric: tabular-nums;
}
.prx-ts[data-prx-frame="v2"] .ts-table caption {
  padding: 0.35rem 0.5rem;
  font-weight: 600;
  text-align: left;
  color: var(--prx-fg);
}
.prx-ts[data-prx-frame="v2"] .ts-table th,
.prx-ts[data-prx-frame="v2"] .ts-table td {
  padding: 0.3rem 0.5rem;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--prx-border);
}
.prx-ts[data-prx-frame="v2"] .ts-table th:first-child {
  text-align: left;
}
.prx-ts[data-prx-frame="v2"] .ts-formulas [data-prx-readout="sizes"],
.prx-ts[data-prx-frame="v2"] [data-prx-readout="balancedSizes"] {
  white-space: normal;
  overflow-wrap: anywhere;
}
`;

function sparsePairTicks(maxM, narrow = false) {
  const M = Math.max(1, Math.round(maxM));
  if (M <= 4) return Array.from({ length: M + 1 }, (_, k) => k);
  const target = narrow ? 4 : 5;
  const rawStep = M / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = Math.max(1, Math.round(mult * mag));
  const ticks = [];
  for (let v = 0; v <= M; v += step) ticks.push(v);
  if (M - ticks[ticks.length - 1] >= step * 0.45) ticks.push(M);
  return ticks;
}

/** Input parsing/validation only; the engine evaluates the expanded input report. */
export function sizeInput(state) {
  const tokens = String(state.sizes).trim().split(/[\s,;/]+/).filter(Boolean);
  if (!tokens.length || tokens.some((x) => !/^\d+$/.test(x))) return { error: "Enter positive whole-number sizes separated by commas." };
  const sizes = tokens.map(Number);
  if (sizes.some((x) => !Number.isSafeInteger(x) || x < 1 || x > CONFIG.n.max)) return { sizes, error: "Every tier needs between one and thirty units; zero and negative sizes are invalid." };
  if (state.G > state.n) return { sizes, error: "There cannot be more nonempty tiers than units." };
  if (sizes.length !== state.G) return { sizes, error: "The vector must contain one size for each declared tier." };
  const grade = sizes.flatMap((size, h) => new Array(size).fill(h + 1));
  if (grade.length !== state.n) return { sizes, error: "The tier sizes must add up to the declared unit count. Adjust the sizes or change the unit count." };
  return { sizes, grade, disc: disclosure(grade) };
}

export function mountWidget(el, spec = {}) {
  let discardCountDrafts = () => {};
  const widget = createWidget(el, spec, {
    name: "tier-sizes",
    className: "prx-ts",
    css: CSS,
    frame: "v2",
    keys: {
      n: { type: "integer", ...CONFIG.n },
      G: { type: "integer", ...CONFIG.G },
      sizes: { type: "string", value: "10,10,10" },
    },
    build(ctx) {
      ctx.root.classList.add("prx-ft");
      const { h } = ctx;
      const ro = (hook, raw, fmt = formatCount) => {
        const n = ctx.num(raw, fmt(raw));
        n.dataset.prxReadout = hook;
        return n;
      };
      const memo = new Map();
      const distribution = (n, G) => {
        const key = `${n}|${G}`;
        if (!memo.has(key)) memo.set(key, tierSizeDistribution(n, G));
        return memo.get(key);
      };
      const balanced = (n, G) => ctx.set({ n, G, sizes: distribution(n, G).balancedSizes.join(",") });

      // --- Primary count controls in ctx.controls (contract for tier-sizes-counts.test.mjs)
      // Count fields hold a native editing draft. Only a completed valid count changes URL state
      // and resets sizes; an intermediate first digit must never be clamped and written back.
      const nInput = ctx.numberInput({ label: "Units n", ...ctx.key("n"), name: "n" });
      const gInput = ctx.numberInput({ label: "Nonempty tiers G", ...ctx.key("G"), name: "G" });
      const countFeedback = h("p", { class: "ts-feedback", role: "status", hidden: true, "data-prx-part": "count-feedback" });
      const feedback = h("p", { class: "ts-feedback", role: "status", hidden: true, "data-prx-part": "input-feedback" });

      const countFields = [
        { key: "n", label: "Units n", control: nInput, min: CONFIG.n.min, max: () => CONFIG.n.max, dirty: false, error: false },
        { key: "G", label: "Nonempty tiers G", control: gInput, min: CONFIG.G.min, max: () => ctx.state.n, dirty: false, error: false },
      ];

      function showCountFeedback() {
        const bad = countFields.find((f) => f.error);
        countFeedback.hidden = !bad && !countFields.some((f) => f.dirty);
        countFeedback.replaceChildren(
          ...(bad
            ? [
                bad.label,
                ": enter a whole-number count from ",
                ctx.num(bad.min, formatCount(bad.min)),
                " to ",
                ctx.num(bad.max(), formatCount(bad.max())),
                ". No count change was applied; figures still use the applied counts.",
              ]
            : ["Count draft: press Enter or leave the field to apply it. Figures still use the applied counts."]),
        );
      }

      discardCountDrafts = () => {
        gInput.input.max = String(ctx.state.n);
        for (const f of countFields) {
          f.dirty = false;
          f.error = false;
          f.control.set(ctx.state[f.key]);
        }
        showCountFeedback();
      };
      ctx.onCleanup(() => {
        discardCountDrafts = () => {};
      });

      function commitCount(f) {
        const raw = f.control.input.value.trim();
        const value = Number(raw);
        if (!f.dirty && raw === String(ctx.state[f.key])) return;
        if (raw === "" || !Number.isSafeInteger(value) || value < f.min || value > f.max()) {
          f.dirty = true;
          f.error = true;
          f.control.input.setAttribute("aria-invalid", "true");
          showCountFeedback();
          return;
        }
        f.dirty = false;
        f.error = false;
        f.control.set(value);
        if (f.key === "n") balanced(value, Math.min(ctx.state.G, value));
        else balanced(ctx.state.n, value);
        showCountFeedback();
      }

      for (const f of countFields) {
        ctx.listen(f.control.input, "input", () => {
          f.dirty = true;
          f.error = false;
          f.control.input.setAttribute("aria-invalid", "false");
          showCountFeedback();
        });
        ctx.listen(f.control.input, "change", () => commitCount(f));
        ctx.listen(f.control.input, "blur", () => commitCount(f));
        ctx.listen(f.control.input, "keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitCount(f);
          } else if (e.key === "Escape") {
            e.preventDefault();
            f.dirty = false;
            f.error = false;
            f.control.set(ctx.state[f.key]);
            showCountFeedback();
          }
        });
      }

      ctx.controls.append(
        h("div", { class: "ts-controls" }, ctx.primaryControl(nInput.root), gInput.root),
        countFeedback,
        feedback,
      );

      // --- Secondary custom vector & per-tier editors inside Settings disclosure
      const settingsBox = ctx.settingsBox("Settings");
      const vectorId = uid("tier-sizes-vector");
      const vectorHintId = uid("tier-sizes-hint");
      const vector = h("input", { id: vectorId, type: "text", name: "sizes", "aria-describedby": vectorHintId, value: ctx.state.sizes });
      ctx.listen(vector, "input", () => ctx.set({ sizes: vector.value }));
      const reset = ctx.button({
        label: "Use balanced sizes",
        onClick: () => balanced(ctx.state.n, Math.min(ctx.state.G, ctx.state.n)),
      });
      const editors = h("div", { class: "ts-editors", "aria-label": "Edit individual tier sizes" });
      const vectorHint = h("p", {
        id: vectorHintId,
        class: "ts-hint",
        text: "Press Enter or leave a count field to apply n or G and reset sizes to balanced. Edit the vector or individual sizes; each must be positive and the total must equal n.",
      });
      const vectorRow = h("div", { class: "ts-settings-row" },
        h("div", { class: "ts-vector" }, h("label", { for: vectorId, text: "Sizes, highest tier first" }), vector),
        reset.root);
      settingsBox.body.append(h("div", { class: "ts-settings-stack" }, editors, vectorHint));

      // --- Primary stage: proportional tier/pair partition + chosen tier-size bars + clean composition distribution
      const partitionSlot = h("div", { class: "ts-partition-strip" });
      const sizePlot = h("div");
      const sizeSection = h("section", {}, ctx.panelTitle("The chosen tier sizes"), sizePlot);

      const distPlot = h("div");
      const currentN = h("span");
      const maximumN = h("span");
      const currentLabel = h("span", { text: "current sizes" });
      const maximumKey = h("span", {}, h("i", { class: "ts-maximum", "aria-hidden": "true" }), "balanced maximum", maximumN);
      const key = h(
        "p",
        { class: "ts-key prx-light-panel" },
        h("span", {}, h("i", { class: "ts-current", "aria-hidden": "true" }), currentLabel, currentN),
        maximumKey,
      );
      const distSection = h("section", {}, ctx.panelTitle("Disclosure over every size pattern"), distPlot, key);
      const stageGrid = ctx.primaryGraphic(
        h("div", { class: "ts-stage-wrap" }, partitionSlot, h("div", { class: "ts-figures" }, sizeSection, distSection)),
      );
      ctx.stage.append(stageGrid, vectorRow);

      // --- Disclosures: Data (exact distribution table) & Method (grouped MathML formulas + pattern notes)
      const dataBox = ctx.dataBox("Data and tier-size distribution");
      const table = h("table", { class: "ts-table" });
      const tableWrap = ctx.scrollRegion(h("div", { class: "ts-table-wrap" }, table), "Exact disclosure distribution, scroll to read all rows");
      dataBox.body.append(tableWrap);

      const methodBox = ctx.methodBox("Method and formulas");
      const chosen = createTierDisclosure(ctx, {
        balancedNote:
          "This count applies to any supplied positive tier sizes. The separate balanced reference maximizes disclosure at the same number of grades; a chosen unbalanced pattern need not attain that maximum.",
      });
      chosen.root.dataset.tierSizePanel = "chosen";
      const reference = createTierDisclosure(ctx);
      reference.root.dataset.tierSizePanel = "balanced";
      const chosenHeading = ctx.panelTitle("Chosen sizes: count every withheld pair");
      const chosenPanel = h("section", {}, chosenHeading, chosen.root);
      const referencePanel = h("section", {}, ctx.panelTitle("Balanced sizes: maximum at this G"), reference.root);
      const formulas = h("div", { class: "ts-formulas" }, chosenPanel, referencePanel);
      const patternNote = h("p", {
        class: "ts-hint",
        text: "A size pattern lists the number of units in each tier, from highest to lowest. Each list with no empty tiers gets equal weight, regardless of how many assignments it permits. Reordering the sizes gives a new pattern with the same number of stated pairs.",
      });
      methodBox.body.append(h("div", { class: "ts-method-stack" }, formulas, patternNote));

      ctx.caption.replaceChildren(
        "Ordered positive tier sizes; identities count pair relations, not wrong directions, and quantile-score ties can merge tiers.",
      );

      const perTier = [];
      function syncEditors(s, parsed) {
        if (perTier.length !== s.G) {
          perTier.length = 0;
          editors.replaceChildren();
          for (let i = 0; i < s.G; i += 1) {
            const control = ctx.numberInput({
              label: h("span", {}, "Tier ", ctx.num(i + 1, formatCount(i + 1))),
              min: 1,
              max: s.n,
              step: 1,
              value: parsed.sizes?.[i] ?? 1,
              onInput: (v) => {
                const values = String(ctx.state.sizes).trim().split(/[\s,;/]+/);
                values[i] = String(v);
                ctx.set({ sizes: values.join(",") });
              },
            });
            perTier.push(control);
            editors.append(control.root);
          }
        }
        perTier.forEach((c, i) => {
          c.input.max = String(s.n);
          c.input.disabled = !parsed.sizes || parsed.sizes.length !== s.G;
          if (c.input.disabled) c.input.value = "";
          else if (Number.isFinite(parsed.sizes[i])) c.set(parsed.sizes[i]);
        });
      }

      function drawPartitionStrip(s, input, d) {
        svgScene(
          partitionSlot,
          {
            height: 60,
            margin: { top: 4, right: 8, bottom: 4, left: 54 },
            alt: "Proportional partition of units into ordered tiers and all pairs into stated versus within-tier withheld pairs.",
          },
          (scene) => {
            const { palette: pal, width, margin } = scene;
            const barX0 = margin.left;
            const barW = Math.max(40, width - margin.left - margin.right);
            const colors = gradeColors(s.G, pal);
            const hatchFill = scene.hatchDef(uid("ts-hatch"));

            // Row 1: proportional unit blocks by tier
            const unitY = 6;
            const barH = 20;
            scene.add(
              scene.el("text", {
                x: 2,
                y: unitY + barH / 2,
                dominantBaseline: "central",
                fill: pal.plotMuted,
                fontWeight: 600,
                text: "Units",
              }),
            );
            let accUnits = 0;
            input.sizes.forEach((sz, idx) => {
              const x0 = barX0 + (accUnits / s.n) * barW;
              const x1 = barX0 + ((accUnits + sz) / s.n) * barW;
              const segW = Math.max(0.5, x1 - x0);
              const fill = colors[idx];
              scene.add(
                scene.el("rect", {
                  x: x0,
                  y: unitY,
                  width: segW,
                  height: barH,
                  fill,
                  stroke: pal.plotBg,
                  strokeWidth: s.G > 1 ? 1 : 0,
                  rx: s.G === 1 ? 3 : 0,
                }),
              );
              if (segW >= 26) {
                scene.add(
                  scene.numText(
                    {
                      x: x0 + segW / 2,
                      y: unitY + barH / 2,
                      textAnchor: "middle",
                      dominantBaseline: "central",
                      fill: labelOn(fill, pal),
                      fontWeight: 700,
                    },
                    idx + 1,
                    formatCount(idx + 1),
                  ),
                );
              }
              accUnits += sz;
            });

            // Row 2: proportional pair partition (Stated N vs Withheld W)
            const pairY = 34;
            const statedW = d.M > 0 ? (input.disc.N / d.M) * barW : 0;
            const withheldW = Math.max(0, barW - statedW);
            scene.add(
              scene.el("text", {
                x: 2,
                y: pairY + barH / 2,
                dominantBaseline: "central",
                fill: pal.plotMuted,
                fontWeight: 600,
                text: "Pairs",
              }),
            );
            if (statedW > 0.5) {
              scene.add(
                scene.el("rect", {
                  x: barX0,
                  y: pairY,
                  width: statedW,
                  height: barH,
                  fill: pal.relAbove,
                  rx: withheldW < 0.5 ? 3 : 0,
                }),
              );
            }
            if (withheldW > 0.5) {
              scene.add(
                scene.el("rect", {
                  x: barX0 + statedW,
                  y: pairY,
                  width: withheldW,
                  height: barH,
                  fill: hatchFill,
                  stroke: pal.cellBorder,
                  strokeWidth: 0.75,
                  rx: statedW < 0.5 ? 3 : 0,
                }),
              );
            }
            if (statedW >= 104) {
              scene.add(
                scene.el(
                  "text",
                  {
                    x: barX0 + statedW / 2,
                    y: pairY + barH / 2,
                    textAnchor: "middle",
                    dominantBaseline: "central",
                    fill: labelOn(pal.relAbove, pal),
                    fontWeight: 600,
                  },
                  scene.el("tspan", { "data-num": dataNum(input.disc.N) }, formatCount(input.disc.N)),
                  scene.el("tspan", {}, " stated"),
                ),
              );
            } else if (withheldW >= 116) {
              const pillW = Math.min(withheldW - 8, Math.ceil((formatCount(input.disc.withheld).length + 9) * 7.4 + 10));
              const cx = barX0 + statedW + withheldW / 2;
              scene.add(
                scene.el("rect", {
                  x: cx - pillW / 2,
                  y: pairY + 2,
                  width: pillW,
                  height: barH - 4,
                  rx: 3,
                  fill: pal.plotBg,
                  stroke: pal.cellBorder,
                  strokeWidth: 0.75,
                }),
                scene.el(
                  "text",
                  {
                    x: cx,
                    y: pairY + barH / 2,
                    textAnchor: "middle",
                    dominantBaseline: "central",
                    fill: pal.plotFg,
                    fontWeight: 600,
                  },
                  scene.el("tspan", { "data-num": dataNum(input.disc.withheld) }, formatCount(input.disc.withheld)),
                  scene.el("tspan", {}, " withheld"),
                ),
              );
            }
          },
        );
      }

      return {
        render(s, info = {}) {
          // PR-06 / PR-09: disclosures hold eager HTML tables/MathML only; never disturb stage or drafts on toggle.
          if (info?.reason === "disclosure") return;
          gInput.input.max = String(s.n);
          // Preset/API/scientific-state updates are atomic and replace drafts. Theme/resize redraws
          // leave the unfinished native text and its focus intact.
          const replaceDrafts = info.initial || info.changed?.some((k) => ["n", "G", "sizes"].includes(k));
          for (const f of countFields) {
            if (replaceDrafts || !f.dirty) {
              f.dirty = false;
              f.error = false;
              f.control.set(s[f.key]);
            }
          }
          showCountFeedback();
          if (vector.value !== s.sizes) vector.value = s.sizes;

          const input = sizeInput(s);
          syncEditors(s, input);
          feedback.hidden = !input.error;
          feedback.textContent = input.error ?? "";
          vector.setAttribute("aria-invalid", input.error ? "true" : "false");
          ctx.stage.hidden = Boolean(input.error);
          if (input.error) {
            settingsBox.open = true;
            ctx.readout.set("Correct the sizes to update disclosure. No result is shown for an invalid size pattern.");
            return;
          }

          const model = tierModelOfGrade(input.grade);
          const d = distribution(s.n, s.G);
          currentN.replaceChildren(ro("plot-currentN", input.disc.N));
          maximumN.replaceChildren(ro("plot-maxN", d.maxN));
          const atMaximum = input.disc.N === d.maxN;
          maximumKey.hidden = atMaximum;
          currentLabel.textContent = atMaximum ? "current = balanced maximum" : "current sizes";
          chosenHeading.replaceChildren(
            ...(atMaximum
              ? ["Chosen sizes = balanced maximum at G = ", ctx.num(d.G, formatCount(d.G))]
              : ["Chosen sizes: count every withheld pair"]),
          );

          const balancedGrade = d.balancedSizes.flatMap((size, i) => new Array(size).fill(i + 1));
          chosen.draw(model);
          reference.draw(tierModelOfGrade(balancedGrade));

          ctx.readout.set([
            ro("n", d.n),
            " units in ",
            ro("G", d.G),
            d.G === 1 ? " tier state " : " tiers state ",
            ro("N", input.disc.N),
            " of ",
            ro("M", d.M),
            " pairs (",
            ro("share", input.disc.s, formatShare),
            "); max ",
            ro("maxN", d.maxN),
            " (",
            ro("maxShare", d.maxShare, formatShare),
            ", balanced ",
            ro("balancedSizes", d.balancedSizes, formatSizes),
            ") across ",
            ro("totalPatterns", d.totalPatterns),
            d.totalPatterns === 1 ? " size pattern." : " size patterns.",
          ]);

          drawPartitionStrip(s, input, d);

          const sizeW = Math.max(240, Math.round(sizePlot.clientWidth || ctx.width() || 460));
          const narrowSize = sizeW < 420;
          const sizeRows = input.sizes.map((size, i) => ({ tier: i + 1, size, withheld: pairCount(size) }));
          const showBarCounts = s.G <= (narrowSize ? 10 : 16);
          plot(sizePlot, {
            alt: "Tier sizes from highest to lowest grade, with the number of units above each bar. Changing sizes changes withheld pairs, without making a claim about errors.",
            table: {
              caption: "Chosen tier sizes and pairs withheld inside each tier",
              columns: [
                { label: "Tier", value: "tier", format: formatCount },
                { label: "Units", value: "size", format: formatCount },
                { label: "Pairs withheld", value: "withheld", format: formatCount },
              ],
              rows: sizeRows,
            },
            width: sizeW,
            height: narrowSize ? 195 : 265,
            marginTop: 24,
            marginLeft: 42,
            marginRight: 12,
            marginBottom: 38,
            x: {
              label: "Tier, highest first",
              ticks: sizeRows
                .filter((r) => s.G <= 10 || r.tier === 1 || r.tier === s.G || r.tier % 5 === 0)
                .map((r) => r.tier),
              tickFormat: countTick,
            },
            y: {
              label: "Units",
              labelAnchor: "center",
              labelArrow: "none",
              grid: true,
              ticks: sizeRows.every((r) => r.size === 1) ? [0, 1] : 4,
              tickFormat: countTick,
            },
            marks: (c, P) => {
              const colors = gradeColors(s.G, c);
              return [
                P.barY(sizeRows, { x: "tier", y: "size", fill: (r) => colors[r.tier - 1] }),
                showBarCounts
                  ? numText(sizeRows, { x: "tier", y: "size", value: "size", format: formatCount, dy: -7, fill: c.plotFg })
                  : null,
                P.ruleY([0]),
              ];
            },
            keyboard: {
              data: sizeRows,
              x: "tier",
              y: "size",
              key: "tier",
              title: (r) => `Tier ${formatCount(r.tier)}: ${formatCount(r.size)} units, ${formatCount(r.withheld)} withheld pairs.`,
            },
          });

          const distW = Math.max(240, Math.round(distPlot.clientWidth || ctx.width() || 460));
          const narrowDist = distW < 420;
          const maxCount = Math.max(1, ...d.distribution.map((r) => r.count));
          const distMarginLeft = Math.max(46, formatCount(maxCount).length * 8 + 16);
          const distMarginRight = 14;
          const distMarginTop = atMaximum ? 30 : 48;
          const distHeight = narrowDist ? 205 : 265;
          const xMax = Math.max(1, d.M);

          const distFig = plot(distPlot, {
            alt:
              "The number of ordered positive tier-size patterns at every attained disclosure count. " +
              (atMaximum
                ? "The solid line marks both the chosen pattern's disclosure and the balanced maximum."
                : "The solid line is the chosen pattern's disclosure; the dashed line is the balanced maximum."),
            table: {
              caption: "Complete distribution of N over ordered positive tier-size patterns",
              columns: [
                { label: "Pairs stated N", value: "N", format: formatCount },
                { label: "Patterns", value: "count", format: formatCount },
                { label: "Probability", value: "probability", format: formatShare },
              ],
              rows: d.distribution,
            },
            width: distW,
            height: distHeight,
            marginTop: distMarginTop,
            marginLeft: distMarginLeft,
            marginRight: distMarginRight,
            marginBottom: 38,
            x: {
              label: "Pairs stated, N",
              domain: [-0.5, xMax + 0.5],
              ticks: sparsePairTicks(xMax, narrowDist),
              tickFormat: countTick,
            },
            y: {
              label: "Size patterns",
              labelAnchor: "center",
              labelArrow: "none",
              domain: [0, maxCount === 1 ? 1 : maxCount * 1.08],
              grid: true,
              ticks: maxCount === 1 ? [0, 1] : 4,
              tickFormat: countTick,
            },
            marks: (c, P) => [
              P.ruleX(d.distribution, {
                x: "N",
                y1: 0,
                y2: "count",
                stroke: c.blues[5],
                strokeWidth: narrowDist ? 2 : 2.5,
              }),
              d.distribution.length <= 24
                ? P.dot(d.distribution, { x: "N", y: "count", r: 2.8, fill: c.blues[6] })
                : null,
              P.ruleX([input.disc.N], { stroke: c.est, strokeWidth: 2.2 }),
              P.ruleX(atMaximum ? [] : [d.maxN], { stroke: c.post, strokeWidth: 2, strokeDasharray: "5,3" }),
              P.ruleY([0], { stroke: c.plotAxis }),
            ],
            keyboard: {
              data: d.distribution,
              x: "N",
              y: "count",
              key: "N",
              title: (r) => `${formatCount(r.N)} stated pairs: ${formatCount(r.count)} patterns, probability ${formatShare(r.probability)}.`,
            },
          });

          // Direct current-pattern (and balanced-max) pill callouts with rx: 3, fill: plotBg backing rects
          const doc = distFig.svg.ownerDocument;
          const sx = distFig.scale("x");
          const pal = distFig.palette;
          const layer = svgEl(doc, "g", { "aria-hidden": "true" });
          const pillH = 18;
          const clampCenter = (rawX, pillW) =>
            Math.min(distW - distMarginRight - pillW / 2 - 2, Math.max(distMarginLeft + pillW / 2 + 2, rawX));

          const curNumStr = formatCount(input.disc.N);
          const curPrefix = atMaximum ? "current = max: " : "current ";
          const curW = Math.ceil((curPrefix.length + curNumStr.length) * 7.4 + 12);
          const curCx = clampCenter(sx.apply(input.disc.N), curW);

          if (atMaximum) {
            const cy = 14;
            layer.append(
              svgEl(doc, "rect", {
                x: curCx - curW / 2,
                y: cy - pillH / 2,
                width: curW,
                height: pillH,
                rx: 3,
                fill: pal.plotBg,
                stroke: pal.est,
                strokeWidth: 1,
              }),
              svgEl(
                doc,
                "text",
                {
                  x: curCx,
                  y: cy,
                  textAnchor: "middle",
                  dominantBaseline: "central",
                  fill: pal.estText,
                  fontWeight: 600,
                },
                svgEl(doc, "tspan", {}, curPrefix),
                svgEl(doc, "tspan", { "data-num": dataNum(input.disc.N) }, curNumStr),
              ),
            );
          } else {
            const maxNumStr = formatCount(d.maxN);
            const maxPrefix = "max ";
            const maxW = Math.ceil((maxPrefix.length + maxNumStr.length) * 7.4 + 12);
            const maxCx = clampCenter(sx.apply(d.maxN), maxW);
            const horizOverlap = Math.abs(curCx - maxCx) < (curW + maxW) / 2 + 8;

            let curCy = 16;
            let maxCy = 16;
            if (horizOverlap) {
              // WA-02: map placeDirectLabels strictly by item.id
              const placed = placeDirectLabels(
                [
                  { id: "cur", y: 12, height: pillH },
                  { id: "max", y: 33, height: pillH },
                ],
                { minGapPx: 20, minY: 11, maxY: 37 },
              );
              const byId = new Map(placed.map((p) => [p.id, p]));
              curCy = byId.get("cur")?.y ?? 12;
              maxCy = byId.get("max")?.y ?? 33;
            }

            layer.append(
              svgEl(doc, "rect", {
                x: maxCx - maxW / 2,
                y: maxCy - pillH / 2,
                width: maxW,
                height: pillH,
                rx: 3,
                fill: pal.plotBg,
                stroke: pal.post,
                strokeWidth: 1,
              }),
              svgEl(
                doc,
                "text",
                {
                  x: maxCx,
                  y: maxCy,
                  textAnchor: "middle",
                  dominantBaseline: "central",
                  fill: pal.postText,
                  fontWeight: 600,
                },
                svgEl(doc, "tspan", {}, maxPrefix),
                svgEl(doc, "tspan", { "data-num": dataNum(d.maxN) }, maxNumStr),
              ),
              svgEl(doc, "rect", {
                x: curCx - curW / 2,
                y: curCy - pillH / 2,
                width: curW,
                height: pillH,
                rx: 3,
                fill: pal.plotBg,
                stroke: pal.est,
                strokeWidth: 1,
              }),
              svgEl(
                doc,
                "text",
                {
                  x: curCx,
                  y: curCy,
                  textAnchor: "middle",
                  dominantBaseline: "central",
                  fill: pal.estText,
                  fontWeight: 600,
                },
                svgEl(doc, "tspan", {}, curPrefix),
                svgEl(doc, "tspan", { "data-num": dataNum(input.disc.N) }, curNumStr),
              ),
            );
          }
          distFig.svg.append(layer);

          table.replaceChildren(
            h("caption", {}, "All ", ro("table-totalPatterns", d.totalPatterns), " ordered size patterns, grouped by disclosure"),
            h("thead", {}, h("tr", {}, ...["Stated pairs", "Withheld pairs", "Patterns", "Probability"].map((x) => h("th", { scope: "col", text: x })))),
            h(
              "tbody",
              {},
              ...d.distribution.map((r, i) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row" }, ro(`dist-N-${i}`, r.N)),
                  h("td", {}, ro(`dist-withheld-${i}`, r.withheld)),
                  h("td", {}, ro(`dist-count-${i}`, r.count)),
                  h("td", {}, ro(`dist-probability-${i}`, r.probability, formatShare)),
                ),
              ),
            ),
          );
        },
      };
    },
  });

  // A preset/API/bridge message can reapply the same state, which needs no scientific redraw.
  // It still replaces unfinished input text. Keep theme-only updates as draft-preserving redraws.
  const update = widget.update;
  widget.update = (partial) => {
    if (partial && ["n", "G", "sizes", "preset"].some((key) => Object.prototype.hasOwnProperty.call(partial, key))) {
      discardCountDrafts();
    }
    return update.call(widget, partial);
  };
  return widget;
}
