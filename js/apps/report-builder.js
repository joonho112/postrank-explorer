export * from "../shared/domain/report-builder.js";

// App entry point for report-builder (2.2: "A report is many pair decisions", Frame v2 Targeted).
// Preserves 100% of ../shared/domain/report-builder.js exports untouched (S1-02).
import { mobileControls } from "../shared/mobile-controls.js";
import { createWidget, uid } from "../shared/base.js";
import { formatCount, formatGrades, formatShare, formatSigned, formatSizes } from "../shared/format.js";
import { disclosure, relations } from "../pr-core.js";
import {
  CONFIG,
  REPORT_BUILDER_CSS,
  blocksText,
  drawGradeBoxes,
  drawRelationMatrix,
  moveSite,
  parseGrades,
  parseUnits,
  reportCountRows,
  reportOf,
} from "../shared/domain/report-builder.js";

const T = CONFIG.text;
const REDRAW_ONLY = new Set(["disclosure", "resize", "theme", "motion"]);

const V2_TEXT = Object.freeze({
  cue: "Drag a site, or focus a site and press 1\u20136 / \u2191\u2193",
  legendTitle: "Row vs. column:",
  relAbove: "above (>)",
  relWithheld: "withheld (same grade)",
  relBelow: "below (<)",
  gradeKey: "site grade",
  changedKey: "changed",
  caption: "Six fictional sites from the postrank tutorial (score A: higher = higher priority; no probabilities enter here).",
});

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function blocksOf(g, ids) {
  const G = Math.max(...g);
  const out = [];
  for (let h = 1; h <= G; h += 1) out.push(ids.filter((_, i) => g[i] === h));
  return out;
}

function blocksWords(g, ids) {
  const list = (b) => (b.length < 2 ? b.join("") : `${b.slice(0, -1).join(", ")} and ${b.at(-1)}`);
  return blocksOf(g, ids).map(list).join(", then ");
}

function insideOf(sizes) {
  return sizes.map((k) => (k * (k - 1)) / 2);
}

const V2_APP_CSS = `
/* PR-01: ensure no legacy grid-area rules interfere inside Frame v2 stage */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-rb-builder,
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-rb-matrix,
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-rb-counts {
  grid-area: auto;
  min-width: 0;
}

/* Toolbar: compact segmented site-count switch (>= 44px mobile touch targets) */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-rb-units {
  margin: 0;
}

/* Stage layout: ordered grade strip above pair relation matrix (strictly top-to-bottom Tab order at all widths) */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
}

/* Builder header + 1-line keyboard/drag cue */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-builder-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.1rem 0.6rem;
  margin: 0 0 0.35rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-heading {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--prx-plot-fg);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix > .prx-rb-heading {
  margin: 0 0 0.3rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-cue {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--prx-plot-muted);
}

/* Compact grade boxes and drop zones on plot-paper stage */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-boxes {
  gap: 0.3rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box {
  gap: 0.25rem 0.5rem;
  min-height: 2.75rem;
  padding: 0.22rem 0.45rem;
  background: color-mix(in srgb, var(--prx-plot-grid) 38%, var(--prx-plot-bg));
  border: 1px solid var(--prx-cell-border);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new {
  min-height: 1.85rem;
  padding: 0.15rem 0.45rem;
  background: transparent;
  border-style: dashed;
  color: var(--prx-plot-muted);
  font-size: 0.8125rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box-head {
  flex: 0 1 auto;
  margin-right: auto;
  gap: 0.12rem 0.3rem;
  font-size: 0.875rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new .prx-rb-box-head {
  font-size: 0.8125rem;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-chips {
  gap: 0.3rem;
}

/* Desktop >= 48em: horizontal ordered grade cards across the top, matrix + legend paired cleanly below */
@media (min-width: 48em) {
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-boxes {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.4rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box {
    flex: 1 1 8.5rem;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.3rem;
    padding: 0.35rem 0.5rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new {
    flex: 0 1 8.25rem;
    justify-content: center;
    padding: 0.3rem 0.45rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box-head {
    margin-right: 0;
    font-size: 0.8125rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new .prx-rb-box-head {
    display: inline;
    line-height: 1.3;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new .prx-rb-new-mark {
    margin-right: 0.25rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    gap: 0.25rem 1.25rem;
    align-items: start;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix > .prx-rb-heading {
    grid-column: 1 / -1;
    margin: 0;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix > .prx-rb-legend {
    flex-direction: column;
    align-items: flex-start;
    width: max-content;
    max-width: 100%;
    gap: 0.35rem;
    margin: 1.35rem 0 0;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--prx-plot-grid);
  }
}

/* Generous tactile site chips: >= 40px desktop, >= 44px coarse/mobile */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-site {
  min-width: max(2.5rem, 40px);
  min-height: max(2.5rem, 40px);
  padding: 0 0.55rem;
  font-size: 0.9375rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border: 2px solid var(--prx-cell-border);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-site:hover {
  border-color: var(--prx-plot-focus);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-site.prx-rb-picked {
  color: var(--prx-plot-bg);
  background: var(--prx-plot-fg);
  border-color: var(--prx-plot-fg);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-target,
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-over {
  border: 2px solid var(--prx-plot-focus);
  background: var(--prx-plot-grid);
}
@media (pointer: coarse), (max-width: 48em) {
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-site {
    min-width: max(2.75rem, 44px);
    min-height: max(2.75rem, 44px);
    padding: 0 0.5rem;
  }
}
@media (max-width: 30em) {
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.45rem;
    font-size: 0.8125rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage {
    padding: 0.45rem 0.5rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-builder-head {
    margin: 0 0 0.25rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-cue {
    font-size: 0.78rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-boxes {
    gap: 0.22rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box {
    padding: 0.14rem 0.35rem;
    gap: 0.16rem 0.35rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new {
    min-height: 1.45rem;
    padding: 0.08rem 0.35rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box-head {
    font-size: 0.8125rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-box.prx-rb-new .prx-rb-box-head {
    font-size: 0.78rem;
  }
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-chips {
    gap: 0.22rem;
  }
}

/* One-line result strip immediately below .prx-rb-boxes */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-result {
  margin: 0.35rem 0 0;
  padding: 0.28rem 0.55rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  color: var(--prx-plot-fg);
  background: color-mix(in srgb, var(--prx-plot-grid) 28%, var(--prx-plot-bg));
  border-left: 3px solid var(--prx-plot-fg);
  border-radius: 4px;
}
.prx-rb .prx-rb-result-part {
  white-space: nowrap;
}

/* Matrix container & compact horizontal legend on plot-paper stage */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix-wrap {
  min-width: 0;
  max-width: 100%;
}
@media (max-width: 36em) {
  .prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-matrix-wrap {
    max-width: 17.75rem;
  }
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-legend {
  gap: 0.2rem 0.65rem;
  margin: 0.3rem 0 0;
  padding: 0.2rem 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-stage .prx-rb-legend-title {
  flex: 0 0 auto;
  font-weight: 600;
}

/* Counts & keyboard disclosures */
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-disclosures .prx-rb-counts {
  margin: 0.4rem 0 0;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-disclosures .prx-rb-orientation {
  margin: 0;
}
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-disclosures .prx-rb-hint,
.prx-rb.prx-widget[data-prx-frame="v2"] .prx-disclosures .prx-rb-touch-hint {
  margin: 0 0 0.4rem;
  font-size: 0.875rem;
}
`;

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    frame: "v2",
    css: REPORT_BUILDER_CSS + V2_APP_CSS,
    keys: {
      units: { type: "custom", value: CONFIG.units.value, parse: (v) => parseUnits(v) },
      grades: { type: "custom", value: Array.from(CONFIG.grades.value), parse: (v) => parseGrades(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const num = (raw, display) => ctx.num(raw, display);
      const count = (x) => num(x, formatCount(x));
      const ro = (name, raw, display) => {
        const s = ctx.num(raw, display);
        s.setAttribute("data-prx-readout", name);
        return s;
      };
      const hatchId = uid("prx-rb-hatch");
      const hintId = uid("prx-rb-hint");
      const chipHintId = uid("prx-rb-chip-hint");
      const blocksNodes = (g, ids) => [
        h("span", { "aria-hidden": "true", text: blocksText(g, ids) }),
        h("span", { class: "prx-sr-only", text: blocksWords(g, ids) }),
      ];
      const fill = (parts, slots) => parts.map((p) => {
        const m = /^\{(\w+)\}$/.exec(p);
        return m && m[1] in slots ? slots[m[1]]() : p;
      });

      // --- primary control: number of sites (4 or 6)
      const unitsRadio = ctx.segmented({
        label: T.unitsLegend,
        name: "units",
        className: "prx-rb-units",
        options: [
          { value: CONFIG.units.values[0], label: T.unitsFour },
          { value: CONFIG.units.values[1], label: T.unitsSix },
        ],
        value: ctx.state.units,
        onChange: (v) => {
          cancelPick();
          note = null;
          ctx.set({ units: v, grades: Array.from(CONFIG.starts[v]) });
        },
      });
      ctx.controls.append(unitsRadio.root);

      // --- primary stage: interactive grade builder + pair relation matrix
      const builderHead = h("div", { class: "prx-rb-builder-head" },
        h("h4", { class: "prx-rb-heading", text: T.builderHeading }),
        h("p", { class: "prx-rb-cue" }, "Drag a site, or focus a site and press ", count(1), "\u2013", count(6), " / \u2191\u2193"),
      );
      const chipHint = h("p", { id: chipHintId, class: "prx-sr-only", text: T.chipHint });
      const boxes = h("ol", { class: "prx-rb-boxes", "aria-label": T.builderHeading, "aria-describedby": hintId });
      const result = h("p", { class: "prx-rb-result", "data-prx-part": "readout" });
      const builder = h("section", { class: "prx-rb-builder", tabindex: "-1", "data-prx-part": "controls", "aria-label": T.builderHeading },
        builderHead, chipHint, boxes);

      const matrixSlot = h("div", { class: "prx-rb-matrix-chart" });
      const matrixWrap = h("div", { class: "prx-rb-matrix-wrap" }, matrixSlot);
      const matrixLegend = h("div", { class: "prx-rb-legend", "data-prx-part": "legend" });
      const matrixBox = h("section", { class: "prx-rb-matrix", "aria-label": T.readHeading },
        h("h4", { class: "prx-rb-heading", text: T.readHeading }), matrixWrap, matrixLegend);

      const grid = h("div", { class: "prx-rb-grid" }, builder, matrixBox);
      ctx.stage.append(grid);

      // --- disclosures: counts in detail + keyboard and touch (both folded in ctx.disclosures)
      const orientation = h("p", { class: "prx-rb-orientation", "data-prx-part": "notes", text: T.orientation });
      const tiles = h("div", { class: "prx-rb-tiles", "data-prx-part": "readout" });
      const rule = h("p", { class: "prx-rb-rule", "data-prx-part": "readout" });
      const insideSlot = ctx.scrollRegion(h("div", { class: "prx-rb-inside", "data-prx-part": "table" }), T.insideCaption);
      const vectorLine = h("p", { class: "prx-rb-vector", "data-prx-part": "readout" });
      const tidyLine = h("p", { class: "prx-rb-tidy", "data-prx-part": "notes", hidden: true });
      const countsSection = h("section", { class: "prx-rb-counts", "aria-label": T.tileN },
        tiles, rule, insideSlot, vectorLine, tidyLine);
      const twice = h("p", { class: "prx-rb-note", "data-prx-part": "notes", text: T.twice });
      const sideLine = h("p", { class: "prx-rb-side", "data-prx-part": "notes" });
      ctx.disclosure({ name: "counts", title: T.countsTitle }).body.append(result, orientation, countsSection, twice, sideLine);

      const keysBox = ctx.disclosure({ name: "keyboard", title: T.keysTitle, className: "prx-rb-keys" });
      const hint = h("p", { id: hintId, class: "prx-hint prx-rb-hint", text: T.builderHint });
      const touchHint = h("p", { class: "prx-hint prx-rb-touch-hint", text: T.touchHint });
      keysBox.body.append(hint, touchHint);

      ctx.caption.textContent = V2_TEXT.caption;

      // --- interaction state
      let note = null;
      let changed = null;
      let picked = null;
      let drag = null;
      let suppressClick = false;
      let current = reportOf(ctx.state);

      const targetsOf = (g) => ["top", ...Array.from({ length: Math.max(...g) }, (_, k) => k + 1), "bottom"];
      const targetIndex = (g, t) => targetsOf(g).findIndex((x) => x === t);

      function summary(rep, d) {
        return [
          ...blocksNodes(rep.g, rep.ids), ": the report ", T.states, " ",
          ro("readout-N", d.N, formatCount(d.N)), " ", T.pairsOf, " ",
          ro("readout-M", d.M, formatCount(d.M)), " ", T.pairsWord, " ",
          ro("readout-withheld", d.M - d.N, formatCount(d.M - d.N)), T.statesEnd,
        ];
      }
      const siteName = (i) => `${T.siteWord} ${current.ids[i]}`;
      function say(parts) { ctx.readout.set(parts); }
      function targetWords(t) {
        if (t === "top") return [T.pickIntoTop];
        if (t === "bottom") return [T.pickIntoBottom];
        return [`${T.pickInto} `, count(t)];
      }

      function cancelPick(announce = false) {
        if (!picked) return;
        const i = picked.i;
        picked = null;
        syncBuilder();
        if (announce) say([`${siteName(i)} ${T.putBack} `, count(current.g[i]), "."]);
      }

      function pickUp(i) {
        picked = { i, target: targetIndex(current.g, current.g[i]) };
        syncBuilder();
        say([`${siteName(i)} ${T.pickedUp} `, count(current.g[i]), ". Tap a grade, or use \u2191\u2193 and Enter (Esc puts it back)."]);
      }

      function aimAt(index) {
        const list = targetsOf(current.g);
        picked.target = Math.max(0, Math.min(list.length - 1, index));
        syncBuilder();
        say([`${T.pickTarget} ${current.ids[picked.i]} `, ...targetWords(list[picked.target]), T.pickEnter]);
      }

      function place(i, target) {
        picked = null;
        const g = current.g;
        const before = disclosure(g);
        const res = moveSite(g, i, target);
        if (!res.moved) {
          note = [`${siteName(i)} ${T.stays} `, count(g[i]), "."];
          changed = null;
          ctx.requestRender("move");
          return;
        }
        const after = disclosure(res.next);
        const r0 = relations(g);
        const r1 = relations(res.next);
        const cells = new Set();
        for (let a = 0; a < g.length; a += 1) {
          for (let b = 0; b < g.length; b += 1) {
            if (a !== b && r0[a][b] !== r1[a][b]) cells.add(`${a},${b}`);
          }
        }
        const dN = after.N - before.N;
        changed = { after: res.next.slice(), cells, dN };
        const lead = [`${siteName(i)} ${T.moved} `, count(res.next[i])];
        if (target === "top") lead.push(" (new top grade)");
        else if (target === "bottom") lead.push(" (new bottom grade)");
        if (dN !== 0) {
          lead.push(" (", num(dN, formatSigned(dN, { digits: 0 })), ` stated${Math.abs(dN) === 1 ? T.onePair : T.pairsWordShort})`);
        }
        lead.push(".");
        if (res.renumbered.length) {
          const groups = new Map();
          for (const r of res.renumbered) groups.set(r.grade, [...(groups.get(r.grade) ?? []), current.ids[r.k]]);
          lead.push(` ${T.renumbered} `);
          [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([grade, list], idx) => {
            const who = list.length < 2 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
            lead.push(idx ? "; " : "", h("span", { "data-prx-name": "", text: who }), " \u2192 ", count(grade));
          });
          lead.push(".");
        }
        note = lead;
        ctx.set({ grades: res.next });
      }

      // --- builder rendering & keyboard/pointer controls
      function chipOf(i) {
        const id = current.ids[i];
        const chip = h("button", {
          type: "button",
          class: "prx-rb-site",
          "data-prx-site": id,
          "data-prx-focus-key": `site:${id}`,
          "aria-describedby": chipHintId,
          "aria-label": `${T.siteWord} ${id}, ${T.inGrade} ${current.g[i]} ${T.of} ${Math.max(...current.g)}`,
          "aria-pressed": "false",
        }, id);
        chip.addEventListener("click", (e) => onChipClick(e, i));
        chip.addEventListener("keydown", (e) => onChipKey(e, i));
        chip.addEventListener("pointerdown", (e) => onPointerDown(e, i, chip));
        return chip;
      }

      function drawBuilder() {
        drawGradeBoxes(ctx, boxes, current, { chipOf, onBoxClick });
        syncBuilder();
      }

      function syncBuilder() {
        const list = targetsOf(current.g);
        for (const chip of boxes.querySelectorAll(".prx-rb-site")) {
          const i = current.ids.indexOf(chip.getAttribute("data-prx-site"));
          const on = picked?.i === i;
          chip.setAttribute("aria-pressed", on ? "true" : "false");
          chip.classList.toggle("prx-rb-picked", on);
        }
        for (const box of boxes.querySelectorAll(".prx-rb-box")) {
          const t = box.getAttribute("data-prx-box");
          const target = picked ? String(list[picked.target]) : null;
          box.classList.toggle("prx-rb-target", target !== null && t === target);
          box.classList.toggle("prx-rb-armed", Boolean(picked));
        }
      }

      function onChipClick(e, i) {
        if (suppressClick) { suppressClick = false; return; }
        e.stopPropagation();
        if (picked && picked.i === i) {
          const t = targetsOf(current.g)[picked.target];
          if (t === current.g[i]) cancelPick(true);
          else place(i, t);
        } else pickUp(i);
      }

      function onBoxClick(e, t) {
        if (!picked) return;
        if (suppressClick) { suppressClick = false; return; }
        const i = picked.i;
        if (t === "top" || t === "bottom") place(i, t);
        else if (Number(t) === current.g[i]) cancelPick(true);
        else place(i, Number(t));
        boxes.querySelector(`[data-prx-site="${current.ids[i]}"]`)?.focus({ preventScroll: true });
      }

      function onChipKey(e, i) {
        const G = Math.max(...current.g);
        if (/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          const k = Number(e.key);
          if (e.key === CONFIG.keys.top) place(i, "top");
          else if (k <= G) place(i, k);
          else if (k === G + 1) place(i, "bottom");
          else say([`${T.noGrade} `, count(k), `${T.noGradeMid} `, count(0), ` ${T.noGradeTo} `, count(G + 1), "."]);
          return;
        }
        if (!picked || picked.i !== i) return;
        const list = targetsOf(current.g);
        switch (e.key) {
          case "ArrowUp":
          case "ArrowLeft": e.preventDefault(); aimAt(picked.target - 1); break;
          case "ArrowDown":
          case "ArrowRight": e.preventDefault(); aimAt(picked.target + 1); break;
          case "Home": e.preventDefault(); aimAt(0); break;
          case "End": e.preventDefault(); aimAt(list.length - 1); break;
          case "Escape": e.preventDefault(); cancelPick(true); break;
          default: break;
        }
      }

      // --- pointer drag (G1-F3 preserved identically)
      function boxAt(x, y) {
        const hit = typeof ctx.doc.elementFromPoint === "function" ? ctx.doc.elementFromPoint(x, y) : null;
        const box = hit?.closest?.(".prx-rb-box");
        return box && boxes.contains(box) ? box : null;
      }
      function markOver(box) {
        for (const b of boxes.querySelectorAll(".prx-rb-box")) b.classList.toggle("prx-rb-over", b === box);
      }
      function endDrag() {
        if (!drag) return;
        drag.cancelHold?.();
        drag.chip.classList.remove("prx-rb-dragging", "prx-rb-held");
        drag.chip.style.removeProperty("transform");
        markOver(null);
        builder.classList.remove("prx-rb-dragging-on");
        drag = null;
      }
      function onPointerDown(e, i, chip) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (drag) endDrag();
        const touch = e.pointerType === "touch";
        const d = { i, chip, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, touch, held: false, cancelHold: null };
        drag = d;
        if (touch) {
          const timer = ctx.win.setTimeout(() => {
            d.cancelHold = null;
            if (drag !== d || d.active) return;
            d.held = true;
            chip.classList.add("prx-rb-held");
          }, CONFIG.drag.holdMs);
          d.cancelHold = () => ctx.win.clearTimeout(timer);
        }
      }
      function startsDrag(d, dx, dy) {
        const dist = Math.hypot(dx, dy);
        if (!d.touch) return dist >= CONFIG.drag.threshold;
        if (d.held) return dist >= CONFIG.drag.threshold;
        const across = Math.abs(dx);
        if (across >= CONFIG.drag.touchSlop && across > CONFIG.drag.sideways * Math.abs(dy)) return true;
        if (dist > CONFIG.drag.touchSlop) { d.cancelHold?.(); d.cancelHold = null; }
        return false;
      }
      ctx.listen(ctx.win, "pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.active) {
          if (!startsDrag(drag, dx, dy)) return;
          drag.active = true;
          drag.cancelHold?.();
          drag.cancelHold = null;
          if (picked) { picked = null; syncBuilder(); }
          drag.chip.classList.remove("prx-rb-held");
          drag.chip.classList.add("prx-rb-dragging");
          builder.classList.add("prx-rb-dragging-on");
        }
        e.preventDefault();
        drag.chip.style.transform = `translate(${dx}px, ${dy}px)`;
        markOver(boxAt(e.clientX, e.clientY));
      });
      ctx.listen(boxes, "touchmove", (e) => {
        if (drag?.touch && (drag.active || drag.held) && e.cancelable) e.preventDefault();
      }, { passive: false });
      ctx.listen(boxes, "contextmenu", (e) => {
        if (drag?.touch && e.target?.closest?.(".prx-rb-site")) e.preventDefault();
      });
      ctx.listen(ctx.win, "pointerup", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        const box = d.active ? boxAt(e.clientX, e.clientY) : null;
        endDrag();
        if (!d.active) return;
        suppressClick = true;
        ctx.timeout(() => { suppressClick = false; }, 0);
        if (!box) {
          note = [`${siteName(d.i)} ${T.outside}`];
          changed = null;
          ctx.requestRender("move");
          return;
        }
        const t = box.getAttribute("data-prx-box");
        place(d.i, t === "top" || t === "bottom" ? t : Number(t));
      });
      ctx.listen(ctx.win, "pointercancel", (e) => { if (drag && e.pointerId === drag.id) endDrag(); });
      ctx.listen(ctx.doc, "pointerdown", (e) => { if (picked && !boxes.contains(e.target)) cancelPick(true); });
      ctx.listen(boxes, "focusin", (e) => {
        const id = e.target?.getAttribute?.("data-prx-site");
        if (picked && id && current.ids.indexOf(id) !== picked.i) cancelPick(true);
      });
      ctx.listen(boxes, "focusout", (e) => {
        if (picked && e.relatedTarget && !boxes.contains(e.relatedTarget)) cancelPick(true);
      });
      ctx.listen(ctx.root, "keydown", (e) => {
        if (picked && e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          cancelPick(true);
        }
      });

      // --- matrix + deduplicated compact horizontal legend
      function drawMatrix(rep, rel) {
        drawRelationMatrix(ctx, matrixSlot, matrixLegend, rep, { rel, changed, hatchId });
        const moved = changed && same(changed.after, rep.g) ? changed.cells : null;
        const keys = [
          h("span", { class: "prx-rb-legend-title", text: V2_TEXT.legendTitle }),
          h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key", style: { background: "var(--prx-rel-above)" } }), V2_TEXT.relAbove),
          h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-hatch" }), V2_TEXT.relWithheld),
          h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key", style: { background: "var(--prx-rel-below)" } }), V2_TEXT.relBelow),
          h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-dot" }), V2_TEXT.gradeKey),
        ];
        if (moved && moved.size) {
          keys.push(h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-outline" }), V2_TEXT.changedKey));
        }
        matrixLegend.replaceChildren(...keys);
      }

      // --- counts in detail
      function tile(name, value) {
        return h("div", { class: "prx-rb-tile" },
          h("span", { class: "prx-rb-tile-name", text: name }),
          h("span", { class: "prx-rb-tile-value" }, ...value));
      }

      function drawCounts(rep, d) {
        const inside = insideOf(d.sizes);
        const withheld = inside.reduce((a, b) => a + b, 0);
        tiles.replaceChildren(
          tile(T.tileM, [ro("M", d.M, formatCount(d.M))]),
          tile(T.tileN, [ro("N", d.N, formatCount(d.N))]),
          tile(T.tileShare, [ro("s", d.s, formatShare(d.s))]),
          tile(T.tileG, [ro("G", d.G, formatCount(d.G))]),
        );
        rule.replaceChildren(
          `${T.ruleLead} `,
          h("span", { class: "prx-rb-eq" },
            ro("rule-M", d.M, formatCount(d.M)), " \u2212 ",
            ro("rule-inside", withheld, formatCount(withheld)), " = ",
            ro("rule-N", d.N, formatCount(d.N)), "."),
        );
        const rows = d.sizes.map((k, idx) => h("tr", {},
          h("th", { scope: "row" }, `${T.colGrade} `, count(idx + 1)),
          h("td", {}, ro(`size-${idx + 1}`, k, formatCount(k))),
          h("td", {}, ro(`inside-${idx + 1}`, inside[idx], formatCount(inside[idx])))));
        rows.push(h("tr", { class: "prx-rb-total" },
          h("th", { scope: "row", text: T.allGrades }),
          h("td", {}, ro("size-all", rep.n, formatCount(rep.n))),
          h("td", {}, ro("inside-all", withheld, formatCount(withheld)))));
        insideSlot.replaceChildren(h("table", { class: "prx-rb-table" },
          h("caption", { text: T.insideCaption }),
          h("thead", {}, h("tr", {},
            h("th", { scope: "col", text: T.colGrade }),
            h("th", { scope: "col", text: T.colSites }),
            h("th", { scope: "col", text: T.colInside }))),
          h("tbody", {}, ...rows)));
        vectorLine.replaceChildren(
          `${T.vectorLead} `, ro("grades", rep.g.slice(), formatGrades(rep.g)), ` ${T.vectorOrder} (`,
          h("span", { "data-prx-name": "", text: `${rep.ids[0]} to ${rep.ids.at(-1)}` }), "); ",
          ro("sizes", d.sizes.slice(), formatSizes(d.sizes)), `; ${T.blocksLead} `, ...blocksNodes(rep.g, rep.ids), ".",
        );
        const tidied = !same(rep.raw, rep.g);
        tidyLine.hidden = !tidied;
        if (tidied) {
          tidyLine.replaceChildren(...fill(T.tidied, {
            raw: () => ro("raw", rep.raw.slice(), formatGrades(rep.raw)),
            tidied: () => ro("tidied", rep.g.slice(), formatGrades(rep.g)),
            one: () => count(1),
            two: () => count(2),
          }));
        }
      }

      function drawResult(rep, d) {
        const dN = changed && same(changed.after, rep.g) ? changed.dN : 0;
        const part = (...nodes) => h("span", { class: "prx-rb-result-part" }, ...nodes);
        result.replaceChildren(
          part(
            ro("result-N", d.N, formatCount(d.N)), ` ${T.resultOf} `,
            ro("result-M", d.M, formatCount(d.M)), ` ${T.resultPairsStated}`,
            ...(dN ? [" (", ro("result-change", dN, formatSigned(dN, { digits: 0 })), ")"] : []), ",",
          ), " ",
          part(`${T.resultShare} `, ro("result-share", d.s, formatShare(d.s)), ";"), " ",
          part(ro("result-withheld", d.M - d.N, formatCount(d.M - d.N)), ` ${T.resultWithheld};`), " ",
          part(ro("result-G", d.G, formatCount(d.G)), ` ${d.G === 1 ? T.resultGrade : T.resultGrades}.`),
        );
      }

      function drawSide(n) {
        const parts = [`${T.sideLead} `];
        for (const { n: k, count: size } of reportCountRows()) {
          const node = ro(`reports-${k}`, size, formatCount(size));
          const item = h("span", { class: k === n ? "prx-rb-side-now" : null }, node, ` ${T.sideFor} ${T.sideOfWords[k]} sites`);
          parts.push(item, k < CONFIG.sizes.to ? ", " : ". ");
        }
        parts.push(T.sideTail);
        sideLine.replaceChildren(...parts);
      }

      mobileControls(ctx, { primary: [unitsRadio.root], before: [[matrixBox, builder]], shortcut: { label: "Edit grades", target: builder } });
      return {
        render(state, info = {}) {
          // PR-06 / PR-09: toggling closed disclosures never re-renders stage or re-fires live readout
          if (info?.reason === "disclosure") return;
          if (info.reason === "update" && !note) { changed = null; picked = null; endDrag(); }
          ctx.root.setAttribute("aria-busy", "true");
          try {
            unitsRadio.set(state.units);
            current = reportOf(state);
            if (picked && picked.i >= current.n) picked = null;
            const d = disclosure(current.g);
            const rel = relations(current.g);
            drawBuilder();
            drawMatrix(current, rel);
            drawCounts(current, d);
            drawResult(current, d);
            drawSide(current.n);
            if (REDRAW_ONLY.has(info.reason) && !note) return;
            const lead = note ? [...note, " "] : [];
            note = null;
            say([...lead, ...summary(current, d)]);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
        destroy() { endDrag(); },
      };
    },
  });
}
