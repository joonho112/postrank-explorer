export * from "../shared/domain/interval-overlap.js";

// App entry point for interval-overlap (1.11: "Intervals do not decide directions", Frame v2, Grade: Keep).
// Keeps ../shared/domain/interval-overlap.js 100% untouched for downstream app 1.12 (overlap-in-the-league).
import { appLink, createWidget } from "../shared/base.js";
import {
  formatDecimal,
  formatPercent,
  formatProb,
  formatReadoutEst,
  formatSci,
  formatSetting,
} from "../shared/format.js";
import { captionNode, ro } from "../shared/readout.js";
import { renderDataTable } from "../shared/table.js";
import {
  CONFIG,
  cssFor,
  drawDifference,
  drawIntervals,
  fill,
  keyItem,
  keyNode,
  pairCard,
  parseGap,
  textKit,
  touchSetting,
} from "../shared/domain/interval-overlap.js";

const T = CONFIG.text;

const V2_CSS = `
@media (max-width: 30em) {
  .prx-io.prx-widget[data-prx-frame="v2"] { padding: 0.45rem 0.55rem 0.4rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.25rem 0.45rem; margin-bottom: 0.3rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-toolbar > .prx-controls { gap: 0.25rem 0.75rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.25rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.15rem 0.45rem; font-size: 0.8125rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.38rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; line-height: 1.32; }
  .prx-io.prx-widget[data-prx-frame="v2"] > .prx-stage { padding: 0.45rem 0.5rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-io-key { padding: 0.22rem 0.42rem; font-size: 0.8125rem; gap: 0.18rem 0.75rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-stage .prx-io-diff { margin-top: 0.4rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] .prx-stage .prx-io-strip { margin-top: 0.32rem; padding: 0.22rem 0.35rem; font-size: 0.78125rem; gap: 0.15rem 0.5rem; }
  .prx-io.prx-widget[data-prx-frame="v2"] > .prx-disclosures { margin-top: 0.42rem; gap: 0.32rem; }
}
.prx-io .prx-stage {
  container-type: inline-size;
}
.prx-io .prx-stage .prx-io-view,
.prx-io .prx-stage .prx-io-panel,
.prx-io .prx-stage .prx-io-diff {
  grid-area: auto;
}
.prx-io .prx-stage .prx-io-diff {
  margin-top: 0.65rem;
}
.prx-io .prx-stage .prx-io-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin: 0.5rem 0 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.84375rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-top: 1px solid var(--prx-plot-grid);
  font-variant-numeric: tabular-nums;
}
.prx-io .prx-io-settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  width: 100%;
}
.prx-io .prx-io-settings-row > .prx-hint {
  margin: 0;
}
.prx-io .prx-io-disclosure-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}
.prx-io .prx-io-disclosure-stack .prx-io-cell {
  background: transparent;
}
`;

const safeDec = (v, digits = 4) => {
  if (v === 0) return "0";
  const floor = 0.5 * 10 ** -digits;
  return Math.abs(v) < floor ? formatSci(v, { sig: 3 }) : formatDecimal(v, { digits });
};

export function mountWidget(el, spec = {}) {
  const D = CONFIG.defaults;
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    frame: "v2",
    css: cssFor(CONFIG.className) + V2_CSS,
    keys: {
      level: { type: "choice", values: CONFIG.levels, value: D.level },
      gap: { type: "custom", value: D.gap, parse: (v) => parseGap(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const w = ro(ctx);
      const k = textKit(ctx);

      // --- Primary controls (ctx.controls): Interval level + Distance between posterior means
      const levelGroup = ctx.radioGroup({
        legend: T.levelLegend,
        name: "level",
        value: ctx.state.level,
        className: "prx-io-level",
        options: CONFIG.levels.map((l) => ({ value: l, label: formatPercent(l / CONFIG.percent) })),
        onChange: (v) => ctx.set({ level: v }),
      });
      const gapSlider = ctx.slider({
        label: T.gapLabel,
        ...CONFIG.gap,
        name: "gap",
        value: touchSetting(ctx.state.level, ctx.state.gap).gap,
        format: (v) => formatReadoutEst(v),
        onInput: (v) => ctx.set({ gap: v }),
      });
      ctx.primaryControl(gapSlider.input);
      ctx.controls.append(levelGroup.root, gapSlider.root);

      // --- Secondary action & setup note (Settings disclosure)
      const touchBtn = ctx.button({
        label: T.touchButton,
        key: "touch",
        onClick: () => ctx.set({ gap: CONFIG.touch.word }),
      });
      const gapHintNode = h("p", { class: "prx-hint" }, ...fill(T.gapHint, { sd: () => k.setting(CONFIG.touch.sd) }));
      ctx.settingsBox("Settings").body.append(
        h("div", { class: "prx-io-settings-row" }, touchBtn.root, gapHintNode),
      );

      // --- Primary stage (ctx.stage): keep 1.11's strong two-panel graphic + crisp 1-line summary strip
      const topSlot = h("div", { class: "prx-io-panel" });
      const topKey = keyNode(ctx);
      const diffSlot = h("div", { class: "prx-io-panel" });
      const diffKey = keyNode(ctx);
      const stageStrip = h("p", { class: "prx-io-strip", "data-prx-evidence": "coverage-and-endpoints" });
      const diffView = h(
        "div",
        { class: "prx-io-diff" },
        ctx.panelTitle(T.diffHead, { className: "prx-io-heading" }),
        diffSlot,
        diffKey,
      );
      ctx.stage.append(
        h(
          "section",
          { class: "prx-io-view prx-io-touch", "aria-label": T.topHead },
          ctx.panelTitle(T.topHead, { className: "prx-io-heading" }),
          topSlot,
          topKey,
          diffView,
          stageStrip,
        ),
      );

      // --- Disclosures: exact interval values in Data; difference SD formula & link in Method
      const card = pairCard(ctx);
      card.root.removeAttribute("data-prx-part");
      const exactTableSlot = h("div", { class: "prx-io-exact-table" });
      ctx.dataBox("Data and exact values").body.append(
        h("div", { class: "prx-io-disclosure-stack" }, card.intervals, exactTableSlot),
      );
      ctx.methodBox("Method and formula").body.append(
        h("div", { class: "prx-io-disclosure-stack" }, card.direction),
      );

      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"), ". ", T.captionScope);

      const cardAmountNode = (t, name) => k.dec(Math.abs(t.amount), CONFIG.digits.amount, name);
      const endSlots = (t, prefix) => ({
        aLower: () => k.dec(t.A.lower, CONFIG.digits.end, `${prefix}a-lower`),
        aUpper: () => k.dec(t.A.upper, CONFIG.digits.end, `${prefix}a-upper`),
        bLower: () => k.dec(t.B.lower, CONFIG.digits.end, `${prefix}b-lower`),
        bUpper: () => k.dec(t.B.upper, CONFIG.digits.end, `${prefix}b-upper`),
      });

      function writeKeys(t) {
        const items = [keyItem(ctx, "line", fill(T.keyInterval, { level: () => k.pct(t.levelPct) }))];
        if (t.status === "overlap") items.push(keyItem(ctx, "band-outline", T.keyOverlap));
        if (t.status === "touch") items.push(keyItem(ctx, "dash", T.keyTouch));
        topKey.replaceChildren(...items);
        diffKey.replaceChildren(keyItem(ctx, "shade", fill(T.keyShade, { pi: () => w.prob(t.pi, { hook: "diff-pi" }) })));
      }

      function writeStrip(t) {
        const stretch = t.status === "touch"
          ? ["Touch point ", w.est(t.B.upper)]
          : t.status === "overlap"
            ? ["Shared [", w.est(t.A.lower), ", ", w.est(t.B.upper), "]"]
            : ["Gap [", w.est(t.B.upper), ", ", w.est(t.A.lower), "]"];
        stageStrip.replaceChildren(
          h("span", {}, w.num(t.level, formatPercent(t.level)), " intervals: A lower ", w.est(t.A.lower),
            ", B upper ", w.est(t.B.upper), ". ", ...stretch, ". Probability A exceeds B ", w.prob(t.pi), "."),
          h("span", { "aria-hidden": "true" }, "·"),
          h("span", {}, "A − B SD √", w.setting(t.varDiff), " = ", w.est(t.sdDiff)),
          h("span", { "aria-hidden": "true" }, "·"),
          h("span", {}, "Gap = ", w.est(t.z), " difference SDs"),
        );
      }

      function writeDisclosures(t) {
        const status = t.status === "touch"
          ? T.statusTouch
          : fill(t.status === "overlap" ? T.statusOverlap : T.statusApart, {
            amount: () => cardAmountNode(t, "card-amount"),
          });
        card.set({
          intervals: [
            { status: t.status, content: status },
            fill(T.touchEnds, endSlots(t, "card-")),
          ],
          direction: [
            { pi: true, content: fill(T.cardPi, { a: T.unitWord.A, b: T.unitWord.B, pi: () => k.prob(t.pi, "card-pi") }) },
            fill(T.cardSd, {
              var: () => k.setting(t.varDiff, "diff-var"),
              sd: () => k.dec(t.sdDiff, CONFIG.digits.sd, "diff-sd"),
              sum: () => k.setting(t.sdSum, "sd-sum"),
              z: () => k.dec(t.z, CONFIG.digits.z, "diff-z"),
            }),
            {
              hint: true,
              content: fill(T.cardNext, {
                app: () => appLink(ctx, T.twoUnits.app, { title: T.twoUnits.title, className: CONFIG.linkClass }),
              }),
            },
          ],
        });

        const diffInterval = {
          lower: t.meanDiff + t.B.lower * t.sdDiff,
          upper: t.meanDiff + t.B.upper * t.sdDiff,
        };
        const rows = [
          { item: "Unit A", mean: t.gap, sd: t.sd, lower: t.A.lower, upper: t.A.upper, pi: null },
          { item: "Unit B", mean: t.meanB, sd: t.sd, lower: t.B.lower, upper: t.B.upper, pi: null },
          { item: "Difference (A − B)", mean: t.meanDiff, sd: t.sdDiff, lower: diffInterval.lower, upper: diffInterval.upper, pi: t.pi },
        ];
        exactTableSlot.replaceChildren(
          renderDataTable(ctx, {
            caption: ["Exact posterior moments and ", w.num(t.level, formatPercent(t.level)), " interval bounds"],
            label: "Exact posterior moments and interval bounds",
            sticky: 1,
            columns: [
              { key: "item", label: T.colQuantity, rowHeader: true },
              { key: "mean", label: T.colMean, format: (v) => safeDec(v, 4) },
              { key: "sd", label: T.colSd, format: (v) => (Number.isInteger(v) ? formatSetting(v) : safeDec(v, 4)) },
              { key: "lower", label: T.colLower, format: (v) => safeDec(v, 4) },
              { key: "upper", label: T.colUpper, format: (v) => safeDec(v, 4) },
              {
                key: "pi",
                label: T.colAbove,
                render: (v) => (v === null ? "—" : ctx.num(v, formatProb(v, { digits: 4, open: true }))),
              },
            ],
            rows,
          }),
        );
      }

      function writeReadout(t) {
        w.set([
          ...fill(T.readTouch[t.status], {
            level: () => w.num(t.level, formatPercent(t.level), { hook: "level" }),
            gap: () => w.est(t.gap, { hook: "gap" }),
            amount: () => w.est(Math.abs(t.amount), { hook: "amount" }),
          }),
          ...fill(T.readPi, {
            a: T.unitWord.A,
            b: T.unitWord.B,
            pi: () => w.prob(t.pi, { hook: "pi" }),
          }),
        ]);
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          levelGroup.set(state.level);
          const t = touchSetting(state.level, state.gap);
          gapSlider.set(t.gap);
          drawIntervals(topSlot, t);
          drawDifference(diffSlot, t);
          writeKeys(t);
          writeStrip(t);
          writeDisclosures(t);
          writeReadout(t);
        },
      };
    },
  });
}
