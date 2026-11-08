// App3.2: editable ordered tier sizes. All disclosure/count distributions come from the public engine.
// The full source disclosure/MathML panels are imported from3.1; no unit-report enumeration is performed here.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, numText, plot } from "../shared/chart.js";
import { formatCount, formatShare, formatSizes } from "../shared/format.js";
import { disclosure, pairCount, tierSizeDistribution } from "../pr-core.js";
import { CSS as TIER_CSS, createTierDisclosure, tierModelOfGrade } from "./fixed-tiers.js";

export const CONFIG = Object.freeze({ n: { min: 2, max: 30, value: 30 }, G: { min: 1, max: 30, value: 3 } });
const countTick = (v) => Number.isInteger(v) ? formatCount(v) : "";
const CSS = `${TIER_CSS}
.prx-ts .ts-controls { display:flex; flex-wrap:wrap; gap:.5rem 1rem; align-items:flex-end; }
.prx-ts .ts-vector { flex:1 1 20rem; min-width:0; }
.prx-ts .ts-vector input { width:100%; max-width:30rem; padding:.35rem; border:1px solid var(--prx-border-strong); color:var(--prx-fg); background:var(--prx-bg); border-radius:4px; }
.prx-ts .ts-hint { color:var(--prx-fg-muted); font-size:.875rem; margin:.3rem 0; }
.prx-ts .ts-feedback { margin:.4rem 0; padding:.5rem; border:1px solid var(--prx-border-strong); }
.prx-ts .ts-editors { display:flex; flex-wrap:wrap; gap:.4rem .7rem; margin:.5rem 0; }
.prx-ts .ts-editors .prx-number { max-width:7rem; }
.prx-ts .ts-figures, .prx-ts .ts-formulas { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,23rem),1fr)); gap:1rem 1.25rem; }
.prx-ts .ts-figures section, .prx-ts .ts-formulas section { min-width:0; }
.prx-ts .ts-key { display:flex; flex-wrap:wrap; gap:.3rem 1rem; font-size:.85rem; margin:.4rem 0; }
.prx-ts .ts-key span { display:inline-flex; align-items:center; gap:.35rem; }
.prx-ts .ts-current, .prx-ts .ts-maximum { display:inline-block; width:1.2rem; border-top:2px solid var(--prx-plot-fg); }
.prx-ts .ts-maximum { border-top-style:dashed; }
.prx-ts .ts-table-wrap { max-height:25rem; overflow:auto; }
.prx-ts .ts-table { width:100%; font-variant-numeric:tabular-nums; }
.prx-ts .ts-table th, .prx-ts .ts-table td { padding:.3rem .45rem; text-align:right; white-space:nowrap; }
.prx-ts .ts-table th:first-child { text-align:left; }
.prx-ts .ts-formulas { margin-top:1rem; }
.prx-ts .ts-formulas [data-prx-readout="sizes"], .prx-ts [data-prx-readout="balancedSizes"] { white-space:normal; overflow-wrap:anywhere; }
`;

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
    name: "tier-sizes", className: "prx-ts", css: CSS, layout: "result-first",
    keys: {
      n: { type: "integer", ...CONFIG.n }, G: { type: "integer", ...CONFIG.G },
      sizes: { type: "string", value: "10,10,10" },
    },
    build(ctx) {
      ctx.root.classList.add("prx-ft");
      const { h } = ctx;
      const ro = (hook, raw, fmt = formatCount) => { const n = ctx.num(raw, fmt(raw)); n.dataset.prxReadout = hook; return n; };
      const memo = new Map();
      const distribution = (n, G) => { const key = `${n}|${G}`; if (!memo.has(key)) memo.set(key, tierSizeDistribution(n, G)); return memo.get(key); };
      const balanced = (n, G) => ctx.set({ n, G, sizes: distribution(n, G).balancedSizes.join(",") });
      // Count fields hold a native editing draft. Only a completed valid count changes URL state
      // and resets sizes; an intermediate first digit must never be clamped and written back.
      const nInput = ctx.numberInput({ label: "Units n", ...ctx.key("n"), name: "n" });
      const gInput = ctx.numberInput({ label: "Nonempty tiers G", ...ctx.key("G"), name: "G" });
      const countFeedback = h("p", { class: "ts-feedback", role: "status", hidden: true, "data-prx-part": "count-feedback" });
      const countFields = [
        { key: "n", label: "Units n", control: nInput, min: CONFIG.n.min, max: () => CONFIG.n.max, dirty: false, error: false },
        { key: "G", label: "Nonempty tiers G", control: gInput, min: CONFIG.G.min, max: () => ctx.state.n, dirty: false, error: false },
      ];
      function showCountFeedback() {
        const bad = countFields.find((f) => f.error);
        countFeedback.hidden = !bad && !countFields.some((f) => f.dirty);
        countFeedback.replaceChildren(...(bad ? [bad.label, ": enter a whole-number count from ", ctx.num(bad.min, formatCount(bad.min)), " to ", ctx.num(bad.max(), formatCount(bad.max())), ". No count change was applied; figures still use the applied counts."]
          : ["Count draft: press Enter or leave the field to apply it. Figures still use the applied counts."]));
      }
      discardCountDrafts = () => {
        for (const f of countFields) { f.dirty = false; f.error = false; f.control.set(ctx.state[f.key]); }
        showCountFeedback();
      };
      ctx.onCleanup(() => { discardCountDrafts = () => {}; });
      function commitCount(f) {
        const raw = f.control.input.value.trim(), value = Number(raw);
        if (!f.dirty && raw === String(ctx.state[f.key])) return;
        if (raw === "" || !Number.isSafeInteger(value) || value < f.min || value > f.max()) {
          f.dirty = true; f.error = true; f.control.input.setAttribute("aria-invalid", "true"); showCountFeedback(); return;
        }
        f.dirty = false; f.error = false; f.control.set(value);
        if (f.key === "n") balanced(value, Math.min(ctx.state.G, value));
        else balanced(ctx.state.n, value);
        showCountFeedback();
      }
      for (const f of countFields) {
        ctx.listen(f.control.input, "input", () => { f.dirty = true; f.error = false; f.control.input.setAttribute("aria-invalid", "false"); showCountFeedback(); });
        ctx.listen(f.control.input, "change", () => commitCount(f));
        ctx.listen(f.control.input, "blur", () => commitCount(f));
        ctx.listen(f.control.input, "keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); commitCount(f); }
          else if (e.key === "Escape") { e.preventDefault(); f.dirty = false; f.error = false; f.control.set(ctx.state[f.key]); showCountFeedback(); }
        });
      }
      const vectorId = uid("tier-sizes-vector");
      const vectorHintId = uid("tier-sizes-hint");
      const vector = h("input", { id: vectorId, type: "text", name: "sizes", "aria-describedby": vectorHintId, value: ctx.state.sizes });
      ctx.listen(vector, "input", () => ctx.set({ sizes: vector.value }));
      const reset = ctx.button({ label: "Use balanced sizes", onClick: () => balanced(ctx.state.n, Math.min(ctx.state.G, ctx.state.n)) });
      ctx.controls.append(h("div", { class: "ts-controls" }, nInput.root, gInput.root,
        ctx.primaryControl(h("div", { class: "ts-vector" }, h("label", { for: vectorId, text: "Sizes, highest tier first" }), vector)), reset.root),
        h("p", { id: vectorHintId, class: "ts-hint", text: "Press Enter or leave a count field to apply n or G and reset sizes to balanced. Edit the vector or individual sizes; each must be positive and the total must equal n." }), countFeedback);
      const editors = h("div", { class: "ts-editors", "aria-label": "Edit individual tier sizes" });
      const feedback = h("p", { class: "ts-feedback", role: "status", hidden: true, "data-prx-part": "input-feedback" });
      ctx.controls.append(editors, feedback);
      const sizePlot = ctx.primaryGraphic(h("div"));
      const distPlot = h("div");
      const currentN = h("span");
      const maximumN = h("span");
      const currentLabel = h("span", { text: "current sizes" });
      const maximumKey = h("span", {}, h("i", { class: "ts-maximum", "aria-hidden": "true" }), "balanced maximum", maximumN);
      const key = h("p", { class: "ts-key prx-light-panel" },
        h("span", {}, h("i", { class: "ts-current", "aria-hidden": "true" }), currentLabel, currentN), maximumKey);
      const patternNote = h("p", { class: "ts-hint", text: "A size pattern lists the number of units in each tier, from highest to lowest. Each list with no empty tiers gets equal weight, regardless of how many assignments it permits. Reordering the sizes gives a new pattern with the same number of stated pairs." });
      const chosen = createTierDisclosure(ctx, { balancedNote: "This count applies to any supplied positive tier sizes. The separate balanced reference maximizes disclosure at the same number of grades; a chosen unbalanced pattern need not attain that maximum." }); chosen.root.dataset.tierSizePanel = "chosen";
      const reference = createTierDisclosure(ctx); reference.root.dataset.tierSizePanel = "balanced";
      const chosenHeading = ctx.panelTitle("Chosen sizes: count every withheld pair");
      const chosenPanel = h("section", {}, chosenHeading, chosen.root);
      const referencePanel = h("section", {}, ctx.panelTitle("Balanced sizes: maximum at this G"), reference.root);
      const referenceDetails = ctx.disclosure({ name: "balanced-reference", title: "Balanced reference formula", placement: "none" });
      const formulas = h("div", { class: "ts-formulas" }, chosenPanel, referencePanel);
      const table = h("table", { class: "ts-table" });
      const tableWrap = ctx.scrollRegion(h("div", { class: "ts-table-wrap" }, table), "Exact disclosure distribution, scroll to read all rows");
      const details = h("details", {}, h("summary", { text: "Exact distribution table" }), tableWrap);
      const result = h("div", {}, h("div", { class: "ts-figures" },
        h("section", {}, ctx.panelTitle("The chosen tier sizes"), sizePlot),
        h("section", {}, ctx.panelTitle("Disclosure over every size pattern"), distPlot, key)), patternNote,
        formulas, referenceDetails.root, details);
      ctx.charts.append(result);
      const perTier = [];
      function syncEditors(s, parsed) {
        if (perTier.length !== s.G) {
          perTier.length = 0; editors.replaceChildren();
          for (let i = 0; i < s.G; i += 1) {
            const control = ctx.numberInput({ label: h("span", {}, "Tier ", ctx.num(i + 1, formatCount(i + 1))), min: 1, max: s.n, step: 1, value: parsed.sizes?.[i] ?? 1,
              onInput: (v) => { const values = String(ctx.state.sizes).trim().split(/[\s,;/]+/); values[i] = String(v); ctx.set({ sizes: values.join(",") }); } });
            perTier.push(control); editors.append(control.root);
          }
        }
        perTier.forEach((c, i) => {
          c.input.max = String(s.n);
          c.input.disabled = !parsed.sizes || parsed.sizes.length !== s.G;
          if (c.input.disabled) c.input.value = "";
          else if (Number.isFinite(parsed.sizes[i])) c.set(parsed.sizes[i]);
        });
      }
      return { render(s, info = {}) {
        gInput.input.max = String(s.n);
        // Preset/API/scientific-state updates are atomic and replace drafts. Theme/resize redraws
        // leave the unfinished native text and its focus intact.
        const replaceDrafts = info.initial || info.changed?.some((k) => ["n", "G", "sizes"].includes(k));
        for (const f of countFields) if (replaceDrafts || !f.dirty) { f.dirty = false; f.error = false; f.control.set(s[f.key]); }
        showCountFeedback();
        if (vector.value !== s.sizes) vector.value = s.sizes;
        const input = sizeInput(s);
        syncEditors(s, input);
        feedback.hidden = !input.error; feedback.textContent = input.error ?? "";
        vector.setAttribute("aria-invalid", input.error ? "true" : "false");
        result.hidden = Boolean(input.error);
        if (input.error) { ctx.readout.set("Correct the sizes to update disclosure. No result is shown for an invalid size pattern."); return; }
        const model = tierModelOfGrade(input.grade);
        const d = distribution(s.n, s.G);
        currentN.replaceChildren(ro("plot-currentN", input.disc.N));
        maximumN.replaceChildren(ro("plot-maxN", d.maxN));
        const atMaximum = input.disc.N === d.maxN;
        maximumKey.hidden = atMaximum;
        currentLabel.textContent = atMaximum ? "current = balanced maximum" : "current sizes";
        chosenHeading.replaceChildren(...(atMaximum
          ? ["Chosen sizes = balanced maximum at G = ", ctx.num(d.G, formatCount(d.G))]
          : ["Chosen sizes: count every withheld pair"]));
        referenceDetails.root.hidden = !atMaximum;
        if (!atMaximum) referenceDetails.root.open = false;
        const destination = atMaximum ? referenceDetails.body : formulas;
        if (referencePanel.parentElement !== destination) destination.append(referencePanel);
        const balancedGrade = d.balancedSizes.flatMap((size, i) => new Array(size).fill(i + 1));
        chosen.draw(model); reference.draw(tierModelOfGrade(balancedGrade));
        ctx.readout.set([ro("n", d.n), " units in ", ro("G", d.G), d.G === 1 ? " tier: these sizes state " : " tiers: these sizes state ", ro("N", input.disc.N), " of ", ro("M", d.M), " pairs (", ro("share", input.disc.s, formatShare), "). The maximum is ", ro("maxN", d.maxN), " (", ro("maxShare", d.maxShare, formatShare), "), with balanced ", ro("balancedSizes", d.balancedSizes, formatSizes), "; the full distribution counts ", ro("totalPatterns", d.totalPatterns), d.totalPatterns === 1 ? " ordered size pattern." : " ordered size patterns."]);
        const sizeRows = input.sizes.map((size, i) => ({ tier: i + 1, size, withheld: pairCount(size) }));
        plot(sizePlot, {
          alt: "Tier sizes from highest to lowest grade, with the number of units above each bar. Changing sizes changes withheld pairs, without making a claim about errors.",
          table: { caption: "Chosen tier sizes and pairs withheld inside each tier", columns: [{ label: "Tier", value: "tier", format: formatCount }, { label: "Units", value: "size", format: formatCount }, { label: "Pairs withheld", value: "withheld", format: formatCount }], rows: sizeRows },
          height: 225, marginTop: 22, marginLeft: 42, marginBottom: 36,
          x: { label: "Tier, highest first", ticks: sizeRows.filter((r) => s.G <= 12 || r.tier === 1 || r.tier === s.G || r.tier % 5 === 0).map((r) => r.tier), tickFormat: countTick }, y: { label: "Units", labelAnchor: "center", labelArrow: "none", grid: true, ticks: sizeRows.every((r) => r.size === 1) ? [0, 1] : 5, tickFormat: countTick },
          marks: (c, P) => { const colors = gradeColors(s.G, c); return [P.barY(sizeRows, { x: "tier", y: "size", fill: (r) => colors[r.tier - 1] }), numText(sizeRows, { x: "tier", y: "size", value: "size", format: formatCount, dy: -7, fill: c.plotFg }), P.ruleY([0])]; },
          keyboard: { data: sizeRows, x: "tier", y: "size", key: "tier", title: (r) => `Tier ${formatCount(r.tier)}: ${formatCount(r.size)} units, ${formatCount(r.withheld)} withheld pairs.` },
        });
        plot(distPlot, {
          alt: "The number of ordered positive tier-size patterns at every attained disclosure count. " + (atMaximum
            ? "The solid line marks both the chosen pattern's disclosure and the balanced maximum."
            : "The solid line is the chosen pattern's disclosure; the dashed line is the balanced maximum."),
          table: { caption: "Complete distribution of N over ordered positive tier-size patterns", columns: [{ label: "Pairs stated N", value: "N", format: formatCount }, { label: "Patterns", value: "count", format: formatCount }, { label: "Probability", value: "probability", format: formatShare }], rows: d.distribution },
          height: 225, marginTop: 22, marginLeft: 53, marginBottom: 36,
          x: { label: "Pairs stated, N", domain: [-.5, d.M + .5], tickFormat: countTick }, y: { label: "Size patterns", grid: true, ticks: 5, tickFormat: countTick },
          marks: (c, P) => [P.rectY(d.distribution, { x1: (r) => r.N - .45, x2: (r) => r.N + .45, y1: 0, y2: "count", fill: c.plotGrid, stroke: c.plotMuted }), P.ruleX([input.disc.N], { stroke: c.plotFg, strokeWidth: 2 }), P.ruleX(atMaximum ? [] : [d.maxN], { stroke: c.plotFg, strokeWidth: 2, strokeDasharray: "5,3" }), P.ruleY([0])],
          keyboard: { data: d.distribution, x: "N", y: "count", key: "N", title: (r) => `${formatCount(r.N)} stated pairs: ${formatCount(r.count)} patterns, probability ${formatShare(r.probability)}.` },
        });
        table.replaceChildren(h("caption", {}, "All ", ro("table-totalPatterns", d.totalPatterns), " ordered size patterns, grouped by disclosure"),
          h("thead", {}, h("tr", {}, ...["Stated pairs", "Withheld pairs", "Patterns", "Probability"].map((x) => h("th", { scope: "col", text: x })))),
          h("tbody", {}, ...d.distribution.map((r, i) => h("tr", {}, h("th", { scope: "row" }, ro(`dist-N-${i}`, r.N)), h("td", {}, ro(`dist-withheld-${i}`, r.withheld)), h("td", {}, ro(`dist-count-${i}`, r.count)), h("td", {}, ro(`dist-probability-${i}`, r.probability, formatShare))))));
        ctx.caption.replaceChildren("Ordered tier sizes with no empty grades; the identities count pair relations, not wrong directions. Quantile-score ties can merge occupied tiers. A fixed number of tiers determines the feasible disclosure maximum.");
      } };
    },
  });
  // A preset/API/bridge message can reapply the same state, which needs no scientific redraw.
  // It still replaces unfinished input text. Keep theme-only updates as draft-preserving redraws.
  const update = widget.update;
  widget.update = (partial) => {
    if (partial && ["n", "G", "sizes", "preset"].some((key) => Object.prototype.hasOwnProperty.call(partial, key))) discardCountDrafts();
    return update.call(widget, partial);
  };
  return widget;
}
