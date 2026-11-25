// Fixed-truth, paired repeated measurements.
// Each observation refits a stipulated posterior on new measurements of the same fixed truth; reports are not posterior draws.
import { mobileControls } from "../shared/mobile-controls.js";
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette as ctxPalette, placeDirectLabels, plot, svgEl } from "../shared/chart.js";
import { formatCount, formatExpectedCount, formatGrades, formatRisk, formatSetting, formatShare } from "../shared/format.js";
import { partBar } from "../shared/partbar.js";
import { captionNode, labelNode, ro as createReadout } from "../shared/readout.js";
import { leagueModel } from "../shared/domain/fixed-tiers.js";
import { CSS as REPORT_CSS, createRuleCardRenderer } from "../shared/domain/posterior-tiers.js";
import {
  LEAGUE_SEED,
  disclosedErrorEstimands,
  evaluateReport,
  fixedOrderDP,
  league30,
  pairCount,
  relationChange,
  relations,
  scoreOrder,
  summaryStats,
  tierGrades,
} from "../pr-core.js";

export const CONFIG = Object.freeze({
  seedMax: 4294967295,
  defaultSeed: LEAGUE_SEED,
  maxReplays: 100,
  rules: ["pm-cuts", "est-tiers", "post-tiers", "withheld"],
  names: {
    "pm-cuts": "Optimal posterior-mean cuts",
    "est-tiers": "Estimate tiers",
    "post-tiers": "Posterior-mean tiers",
    withheld: "Withhold every pair",
  },
});

const LEAGUE = league30();
const IDS = Array.from(LEAGUE.ids);
const M = pairCount(IDS.length);
const LANDMARK_IDS = Object.freeze(["U01", "U10", "U20", "U30"]);
const POOL_STAGE_BATCH = 12;

/** Disjoint paired measurement streams, cycling through the inclusive nonzero uint32 seed domain. */
export function pairedSeeds(seed, pair) {
  const at = (offset) => 1 + ((seed - 1 + offset) % CONFIG.seedMax);
  return [at(2 * (pair - 1)), at(2 * (pair - 1) + 1)];
}

const models = new Map();
const reports = new Map();
const remember = (cache, key, value, max = 220) => {
  if (cache.size >= max) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};

function observation(seed, s) {
  const modelKey = `${seed}/${s.priorSd}`;
  const model = models.get(modelKey) ?? remember(models, modelKey, leagueModel(seed, s.priorSd));
  const key = `${modelKey}/${s.G}/${s.tau}`;
  if (reports.has(key)) return reports.get(key);
  const grades = {
    "est-tiers": tierGrades(model.estimate, s.G, { direction: "descending" }),
    "post-tiers": tierGrades(model.post.mean, s.G, { direction: "descending" }),
    withheld: IDS.map(() => 1),
  };
  const dp = fixedOrderDP(model.E, { scores: model.post.mean, direction: "descending", G: s.G, tau: s.tau });
  grades["pm-cuts"] = dp.grade;
  const byRule = Object.fromEntries(
    CONFIG.rules.map((rule) => [
      rule,
      {
        ...(rule === "pm-cuts" ? dp : {}),
        grade: Array.from(grades[rule]),
        ev: evaluateReport(grades[rule], model.E, { tau: s.tau }),
      },
    ]),
  );
  return remember(reports, key, { model, byRule });
}

/** Public-engine composition, shared by the selected pair and every replay/rule. */
export function measurementPair(s, pair = s.pair) {
  const seeds = pairedSeeds(s.seed, pair);
  const a = observation(seeds[0], s);
  const b = observation(seeds[1], s);
  return {
    pair,
    seeds,
    a,
    b,
    byRule: Object.fromEntries(
      CONFIG.rules.map((rule) => [
        rule,
        {
          a: a.byRule[rule],
          b: b.byRule[rule],
          change: relationChange(a.byRule[rule].grade, b.byRule[rule].grade),
        },
      ]),
    ),
  };
}

function compactPair(p) {
  const byRule = Object.fromEntries(
    CONFIG.rules.map((rule) => {
      const r = p.byRule[rule];
      return [
        rule,
        {
          a: r.a.ev,
          b: r.b.ev,
          pairDisclosure: (r.a.ev.s + r.b.ev.s) / 2,
          change: r.change.changeShare,
          changed: r.change.changed,
          reversed: r.change.nReversed,
          stated: r.change.nNewDisclosed,
          withheld: r.change.nNewWithheld,
        },
      ];
    }),
  );
  return { pair: p.pair, seeds: p.seeds, byRule };
}

const SHORT_RULE = {
  "pm-cuts": "Optimal cuts",
  "est-tiers": "Estimate tiers",
  "post-tiers": "Posterior-mean tiers",
  withheld: "Withhold every pair",
};

const COMPACT_RULE = {
  "pm-cuts": "Opt. cuts",
  "est-tiers": "Est. tiers",
  "post-tiers": "PM tiers",
  withheld: "Withhold all",
};

const MARK = {
  "pm-cuts": { symbol: "circle", glyph: "●", ink: "post", textInk: "postText" },
  "est-tiers": { symbol: "square", glyph: "■", ink: "est", textInk: "estText" },
  "post-tiers": { symbol: "diamond", glyph: "◆", ink: "plotFg", textInk: "plotFg" },
  withheld: { symbol: "triangle", glyph: "▲", ink: "plotMuted", textInk: "plotMuted" },
};

const CSS = `${REPORT_CSS}
/* PR-01: reset any legacy container/grid-area assumptions inside frame v2 stage */
.prx-st[data-prx-frame="v2"] .prx-stage {
  grid-area: unset;
}
.prx-st[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  align-items: flex-end;
  min-width: 0;
}
.prx-st[data-prx-frame="v2"] .st-rule {
  flex: 0 1 auto;
}
.prx-st[data-prx-frame="v2"] .prx-controls > .prx-slider {
  flex: 1 1 13rem;
  max-width: 18rem;
}
@media (max-width: 44rem) {
  .prx-st[data-prx-frame="v2"] .st-rule {
    flex: 1 1 100%;
  }
  .prx-st[data-prx-frame="v2"] .st-rule .prx-seg-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
  }
  .prx-st[data-prx-frame="v2"] .st-rule .prx-seg {
    white-space: normal;
    text-align: center;
  }
  .prx-st[data-prx-frame="v2"] .prx-controls > .prx-slider {
    flex: 1 1 100%;
    max-width: none;
  }
}
@media (max-width: 36em) {
  .prx-st[data-prx-frame="v2"] > [data-prx-part="toolbar"] .prx-controls > .prx-slider {
    flex: 1 1 8rem;
    min-width: 0;
  }
}
@media (max-width: 34rem) {
  .prx-st[data-prx-frame="v2"] .st-rule .prx-seg {
    padding-inline: 0.35rem;
    font-size: 0.8125rem;
  }
  .prx-st[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding-inline: 0.42rem;
    font-size: 0.8125rem;
  }
  .prx-st[data-prx-frame="v2"] .prx-stage {
    padding: 0.5rem 0.55rem;
  }
}
.prx-st .st-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14.5rem), 1fr));
  gap: 0.65rem 1.1rem;
  width: 100%;
  align-items: end;
}
.prx-st .st-pair-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.4rem;
  align-items: center;
}
.prx-st .st-pair-row .prx-btn {
  min-width: 2.75rem;
  padding: 0.2rem 0.45rem;
}
.prx-st .st-pair-row .prx-btn[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
}
.prx-st .st-pair-row output {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 0.875em;
  color: var(--prx-fg-muted);
}
.prx-st .prx-stage .st-stage-stack {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}
.prx-st .prx-stage .st-stage-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.25rem 1rem;
}
.prx-st .prx-stage .st-stage-title {
  margin: 0;
  color: var(--prx-plot-fg);
}
.prx-st .prx-stage .st-stage-legend {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--prx-plot-muted);
}
.prx-st .prx-stage .prx-partbar {
  border: 1px solid var(--prx-plot-grid);
}
.prx-st .st-data-stack,
.prx-st .st-method-stack {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}
.prx-st .st-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  gap: 1rem;
  align-items: start;
}
.prx-st .st-pair-figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  gap: 1rem;
}
.prx-st .st-card {
  min-width: 0;
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
}
.prx-st .st-card header h4 {
  margin: 0.05rem 0 0.25rem;
  font-size: 0.95rem;
}
.prx-st .st-card header .prx-pt-blocks {
  margin: 0.2rem 0;
}
.prx-st .st-card header .st-note {
  margin: 0.25rem 0;
}
.prx-st .st-note {
  font-size: 0.875rem;
  color: var(--prx-fg-muted);
  margin: 0.3rem 0;
}
.prx-st .st-progress {
  min-height: 1.35em;
  font-size: 0.85rem;
  color: var(--prx-fg-muted);
  margin: 0;
}
.prx-st .st-scatter-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.25rem 0 0;
}
.prx-st .st-scatter-keys .prx-btn {
  font-size: 0.85em;
  text-align: left;
}
.prx-st .st-scatter-keys .prx-btn .st-glyph {
  display: inline-block;
  font-weight: 700;
  margin-right: 0.3rem;
  padding: 0 0.18rem;
  background: var(--prx-plot-bg);
  border-radius: 0.15rem;
}
.prx-st .st-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.prx-st .st-changed-scroll {
  max-height: 20rem;
  overflow-y: auto;
}
.prx-st .st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  margin: 0.35rem 0;
}
.prx-st .st-table th,
.prx-st .st-table td {
  padding: 0.38rem 0.5rem;
  text-align: right;
  border-bottom: 1px solid var(--prx-border);
  white-space: nowrap;
}
.prx-st .st-table th:first-child {
  text-align: left;
}
.prx-st .st-table caption {
  text-align: left;
  font-weight: 600;
}
.prx-st .st-table .st-selected {
  font-weight: 700;
  background: var(--prx-bg-raised);
}
.prx-st .st-summary-table th:first-child {
  min-width: 7.5rem;
  max-width: 9.5rem;
  white-space: normal;
  overflow-wrap: normal;
}
.prx-st .st-reversed-mean {
  display: block;
  font-size: 0.86em;
  color: var(--prx-fg-muted);
}
.prx-st .st-changed-table th,
.prx-st .st-changed-table td {
  white-space: nowrap;
  text-align: left;
  padding: 0.35rem 0.45rem;
}
.prx-st .st-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  font-size: 0.84rem;
  padding: 0.25rem 0.45rem;
  border-radius: 4px;
}
.prx-st .st-reference-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
}
.prx-st .st-matrix {
  max-width: 30rem;
}
.prx-st .prx-number input {
  max-width: 13rem;
}
`;

function estimateTextPx(str, bold = false) {
  let w = 0;
  for (const ch of String(str)) {
    if ("iljI1.,:;!|·() ".includes(ch)) w += 3.8;
    else if ("mwMW".includes(ch)) w += 9.6;
    else if (ch >= "A" && ch <= "Z") w += 7.7;
    else if (ch >= "0" && ch <= "9") w += 7.2;
    else w += 6.5;
  }
  return Math.ceil(w * (bold ? 1.05 : 1));
}

function pickForestGradeRuns(grade, yOf) {
  const runs = [];
  for (let i = 0; i < grade.length; ) {
    const g = grade[i];
    let j = i;
    while (j + 1 < grade.length && grade[j + 1] === g) j += 1;
    const midY = (yOf(i) + yOf(j)) / 2;
    runs.push({ id: `grade-${g}-at-${i}`, grade: g, start: i, end: j, len: j - i + 1, midY });
    i = j + 1;
  }
  // Pick one clear representative run (widest contiguous block) per distinct grade 1..G.
  const byGrade = new Map();
  for (const r of runs) {
    const prev = byGrade.get(r.grade);
    if (!prev || r.len > prev.len) byGrade.set(r.grade, r);
  }
  return [...byGrade.values()].sort((a, b) => a.midY - b.midY);
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "stability",
    className: "prx-st prx-pt",
    css: CSS,
    title: "Same truth, two measurements, new reports",
    frame: "v2",
    keys: {
      rule: { type: "choice", values: CONFIG.rules, value: "pm-cuts" },
      G: { type: "integer", min: 1, max: 10, step: 1, value: 3 },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.2 },
      priorSd: { type: "number", min: 0.02, max: 0.4, step: 0.01, value: 0.15 },
      replays: { type: "integer", min: 1, max: CONFIG.maxReplays, step: 1, value: 20 },
      pair: { type: "integer", min: 1, max: CONFIG.maxReplays, step: 1, value: 1 },
      seed: { type: "integer", min: 1, max: CONFIG.seedMax, step: 1, value: CONFIG.defaultSeed },
    },
    build(ctx) {
      const { h } = ctx;
      const w = createReadout(ctx);
      const num = (v, f = formatCount) => ctx.num(v, f(v));
      const ro = (key, v, f = formatCount) => {
        const n = num(v, f);
        n.setAttribute("data-prx-readout", key);
        return n;
      };
      const note = (...parts) => h("p", { class: "st-note" }, ...parts);
      const scroll = (node, label, extraClass = "") =>
        ctx.scrollRegion(h("div", { class: `st-scroll${extraClass ? ` ${extraClass}` : ""}` }, node), label);
      const cards = createRuleCardRenderer(ctx);
      const selectRule = (rule) => ctx.set({ rule });

      // --- Primary controls (only 2 in ctx.controls: Rule + Withholding cost τ)
      const rule = ctx.segmented({
        label: "Report rule",
        name: "rule",
        className: "st-rule",
        options: CONFIG.rules.map((value) => ({ value, label: SHORT_RULE[value], title: CONFIG.names[value] })),
        value: ctx.state.rule,
        onChange: selectRule,
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        onInput: (v) => ctx.set({ tau: v }),
      });
      ctx.controls.append(rule.root, ctx.primaryControl(tau.root));

      // --- Secondary controls inside Settings disclosure
      const G = ctx.slider({
        label: "Tier count / cut grade cap",
        ...ctx.key("G"),
        format: formatCount,
        onInput: (v) => ctx.set({ G: v }),
      });
      const prior = ctx.slider({
        label: "Assumed prior SD",
        ...ctx.key("priorSd"),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      const replays = ctx.slider({
        label: "Paired remeasurements",
        ...ctx.key("replays"),
        format: formatCount,
        onInput: (v) => ctx.set({ replays: v }),
      });
      const seed = ctx.numberInput({
        label: "First measurement seed",
        ...ctx.key("seed"),
        onInput: (v) => ctx.set({ seed: v }),
      });

      // Native range semantics read the CURRENT max, including keyboard End. Set max before value on every render.
      const pairId = uid("st-pair");
      const pairInput = h("input", {
        id: pairId,
        type: "range",
        name: "pair",
        min: 1,
        max: ctx.state.replays,
        step: 1,
        "data-prx-focus-key": "slider:pair",
      });
      const pairOutput = h("output", { for: pairId, "aria-hidden": "true" });
      ctx.listen(pairInput, "input", () => ctx.set({ pair: Number(pairInput.value) }));

      let current = ctx.state;
      let selectedKey = null;
      let selectedPairObj = null;
      let selectedResult = null;
      let activePoolKey = null;
      let currentPool = null;
      let currentRows = null;
      const pools = new Map();

      const pairButton = (label, glyph, delta) => {
        const button = ctx.button({
          label: glyph,
          key: `st:pair:${delta}`,
          onClick: () => {
            const next = current.pair + delta;
            if (next >= 1 && next <= current.replays) ctx.set({ pair: next });
          },
        }).root;
        button.setAttribute("aria-label", label);
        return button;
      };
      const previous = pairButton("Previous measurement pair", "◀", -1);
      const next = pairButton("Next measurement pair", "▶", 1);
      const pairControl = h(
        "div",
        { class: "prx-control st-pair-control" },
        h("label", { for: pairId }, "Inspect measurement pair"),
        h("div", { class: "st-pair-row" }, previous, pairInput, next, pairOutput),
      );
      const redraw = ctx.button({
        label: "New measurement pairs",
        primary: true,
        key: "st:new-pairs",
        onClick: () => ctx.set({ seed: pairedSeeds(current.seed, current.replays + 1)[0], pair: 1 }),
      });

      const settingsBox = ctx.settingsBox("Settings");
      settingsBox.body.append(
        h("div", { class: "st-settings-grid" }, G.root, prior.root, replays.root, pairControl, seed.root, redraw.root),
      );

      // --- Primary Stage: Stability-vs-disclosure centerpiece chart + compact pair-change partBar
      const stageLegend = h("p", { class: "st-stage-legend", "data-prx-part": "legend" });
      const stageHead = h(
        "div",
        { class: "st-stage-head" },
        ctx.panelTitle("Stability vs. disclosure across rules", { className: "st-stage-title" }),
        stageLegend,
      );
      const scatter = h("div", { class: "st-scatter" });
      ctx.listen(scatter, "click", (e) => {
        if (e.detail !== 0) return;
        const key = e.target.closest(".prx-kbd-point")?.dataset.prxFocusKey;
        const picked = key?.split(":").at(-1);
        if (CONFIG.rules.includes(picked)) selectRule(picked);
      });

      const pairBar = partBar(ctx, {
        hook: "pair-changes",
        compact: true,
        parts: [
          { key: "same", role: "neutral" },
          { key: "withheld", role: "silent" },
          { key: "stated", role: "agree" },
          { key: "reversed", role: "error" },
        ],
      });

      const exampleRelation = h("p", { class: "st-note", "data-prx-repeat-pair": "" });
      ctx.stage.append(h("div", { class: "st-stage-stack" }, stageHead, scatter, pairBar.root, exampleRelation));

      // --- Data Disclosure: rule comparison table, paired observations, change matrix, repeat histogram, changed pairs
      const dataBox = ctx.dataBox("Data, paired measurements and repeat distribution");
      const progress = h("p", { class: "st-progress", "data-prx-progress": "" });
      const scatterButtons = CONFIG.rules.map((rKey) =>
        ctx.button({ label: SHORT_RULE[rKey], key: `st:scatter:${rKey}`, onClick: () => selectRule(rKey) }).root,
      );
      const scatterKeys = h(
        "div",
        { class: "st-scatter-keys", role: "group", "aria-label": "Inspect a rule and its pooled claimed E/N" },
        ...scatterButtons,
      );
      const summary = h("div");

      const plotSlots = [h("div"), h("div")];
      const reportNotes = [h("div"), h("div")];
      const headers = [h("header"), h("header")];
      const cardDetails = [h("div"), h("div")];
      const observations = h(
        "div",
        { class: "st-pair-figures" },
        ...headers.map((header, i) => h("section", { class: "st-card" }, header, plotSlots[i], reportNotes[i])),
      );

      const changeTitle = h("div");
      const changeSlot = h("div", { class: "st-matrix prx-light-panel" });
      const changeLegend = h(
        "div",
        { class: "st-legend prx-light-panel", "data-prx-part": "legend" },
        ...["□ Unchanged", "● Newly stated", "○ Newly withheld", "× Reversed"].map((x) => h("span", {}, x)),
      );
      const histogram = h("div");
      const histogramKey = h("p", { class: "st-note st-reference-key", "data-prx-histogram-key": "" });
      const changeTable = h("div", { role: "group", "aria-label": "Changed pairs: from the first report to the second" });

      dataBox.body.append(
        h(
          "div",
          { class: "st-data-stack" },
          h("section", {}, ctx.panelTitle("Rule comparison and pooled error claims"), scatterKeys, progress, summary),
          observations,
          h(
            "div",
            { class: "st-grid" },
            h("section", {}, ctx.panelTitle("Which pair relations changed?"), changeLegend, changeSlot),
            h("section", {}, ctx.panelTitle("Repeat the two-measurement experiment"), histogram, histogramKey),
          ),
          h("section", {}, ctx.panelTitle("Inspect the changed pairs"), changeTable),
        ),
      );

      // --- Method Disclosure: fixed-truth design, prior assumption, relation definitions, Monte Carlo sampling, rule scopes
      const methodBox = ctx.methodBox("Method and fixed-truth design");
      const experiment = note(
        "Fixed truth: the same ",
        num(IDS.length),
        " units and their SEs. Two independent normal measurement errors per pair; a new stipulated normal posterior is computed for each observation. The same pairs are used for every rule.",
      );
      const priorMethodNote = note(
        "Fixed prior mean zero; each measurement gets its own posterior. No prior hyperparameter is fitted.",
      );
      const summaryNote = h("div");
      const sampling = h("div");
      methodBox.body.append(
        h(
          "div",
          { class: "st-method-stack" },
          experiment,
          priorMethodNote,
          changeTitle,
          summaryNote,
          sampling,
          ...["A", "B"].map((name, i) =>
            h("section", {}, ctx.panelTitle(`Observation ${name}: the same units`), cardDetails[i]),
          ),
        ),
      );

      function currentPalette() {
        return ctxPalette(ctx.root);
      }

      const ownClaim = (r, key) =>
        note(
          "Pairs stated ",
          ro(`${key}-N`, r.ev.N),
          " of ",
          num(M),
          " (N/M ",
          ro(`${key}-s`, r.ev.s, formatShare),
          "). Claimed E/N ",
          ro(`${key}-EN`, r.ev.EoverN[0], formatShare),
          "; expected wrong count E ",
          ro(`${key}-E`, r.ev.Ew, formatExpectedCount),
          "; risk ",
          ro(`${key}-risk`, r.ev.risk, formatRisk),
          " under this observation’s supplied posterior.",
        );

      function drawReadout(s, r, rows) {
        const change = r.change;
        const head = [
          "Remeasurement ",
          w.count(s.pair),
          " (",
          SHORT_RULE[s.rule],
          ", τ = ",
          w.setting(s.tau),
          "): ",
          w.count(r.a.ev.N),
          " → ",
          w.count(r.b.ev.N),
          " of ",
          w.count(change.M),
          " pairs stated; ",
          w.count(change.changed),
          " relations change",
          ...(s.rule === "withheld"
            ? ["."]
            : [" (", w.share(change.changeShare), "; ", w.count(change.nReversed), " reversed)."]),
        ];
        if (rows) {
          const selected = rows.find((row) => row.rule === s.rule);
          const err = selected.estimands.ERR;
          head.push(
            " Across ",
            w.count(s.replays),
            s.replays === 1 ? " remeasurement: " : " remeasurements: ",
            w.share(selected.mean),
            " change at N/M ",
            w.share(selected.estimands.meanDisclosure),
            ...(err === null ? [" (pooled E/N: ", w.share(null), ")."] : [", pooled E/N ", w.share(err), "."]),
          );
        }
        w.set(head);
      }

      function drawRows(slot, m, grade, domain) {
        const points = IDS.map((id, i) => ({
          id,
          i,
          estimate: m.estimate[i],
          se: m.se[i],
          lo: m.estimate[i] - m.se[i],
          hi: m.estimate[i] + m.se[i],
          mean: m.post.mean[i],
          truth: LEAGUE.theta[i],
          grade: grade[i],
        }));
        const title = (d) =>
          `${d.id}: estimate ${formatSetting(d.estimate)}, SE ${formatSetting(d.se)}, posterior mean ${formatSetting(d.mean)}, fixed truth ${formatSetting(d.truth)}, grade ${formatCount(d.grade)}.`;

        const fallbackW = Math.min(460, Math.max(256, Math.round((ctx.width() - 56) / (ctx.width() >= 760 ? 2 : 1))));
        const width = Math.max(250, Math.round(slot.clientWidth || fallbackW));
        const rowPx = width < 380 ? 11.5 : 12.5;
        const marginTop = 10;
        const marginBottom = 38;
        const marginLeft = 40;
        const marginRight = 34;
        const height = Math.round(marginTop + marginBottom + IDS.length * rowPx);

        const fig = plot(slot, {
          width,
          height,
          marginLeft,
          marginRight,
          marginTop,
          marginBottom,
          x: {
            domain,
            ticks: 5,
            label: "Value on the same scale",
            labelAnchor: "center",
            labelArrow: "none",
            grid: true,
          },
          y: {
            domain: IDS,
            ticks: Array.from(LANDMARK_IDS),
            label: null,
          },
          marks: (c, P) => [
            P.ruleX([0], { stroke: c.plotGrid }),
            P.ruleY(points, { y: "id", x1: "lo", x2: "hi", stroke: c.plotMuted }),
            P.tickX(points, { x: "estimate", y: "id", stroke: c.est, strokeWidth: 2.5 }),
            P.dot(points, { x: "mean", y: "id", fill: c.post, r: 3 }),
            P.dot(points, { x: "truth", y: "id", fill: c.plotBg, stroke: c.plotFg, r: 3 }),
            P.tip(points, P.pointerY({ x: "estimate", y: "id", title })),
          ],
          alt: "The same thirty units in fixed ID order: each measurement's estimate, one-SE line, posterior mean, fixed truth and report grade. Neither observation reuses the other's posterior.",
          keyboard: { data: points, x: "estimate", y: "id", key: "id", sort: false, title },
          table: {
            caption: "Every unit's measurement and report",
            columns: [
              { label: "Unit", value: "id" },
              { label: "Estimate", value: "estimate", format: (v) => formatSetting(v) },
              { label: "SE", value: "se", format: (v) => formatSetting(v) },
              { label: "Posterior mean", value: "mean", format: (v) => formatSetting(v) },
              { label: "Fixed truth", value: "truth", format: (v) => formatSetting(v) },
              { label: "Grade", value: "grade", format: (v) => formatCount(v) },
            ],
            rows: points,
          },
        });

        // PR-03 & WA-02: right-margin grade strip + 17px rounded grade badge pills placed via placeDirectLabels (item.id Map)
        const doc = fig.svg.ownerDocument;
        const sy = fig.scale("y");
        const pal = fig.palette;
        const maxG = Math.max(...grade);
        const fills = gradeColors(maxG, pal);
        const bw = sy.bandwidth ? sy.bandwidth : (height - marginTop - marginBottom) / IDS.length;
        const yCenter = (idx) => sy.apply(IDS[idx]) + (sy.bandwidth ? sy.bandwidth / 2 : 0);
        const stripeX = width - marginRight + 6;
        const stripeW = 22;
        const stripeMid = stripeX + stripeW / 2;
        const layer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-grade-strip": "" });

        for (let i = 0; i < IDS.length; i += 1) {
          const cy = yCenter(i);
          layer.append(
            svgEl(doc, "rect", {
              x: stripeX,
              y: cy - bw / 2 + 0.4,
              width: stripeW,
              height: Math.max(2, bw - 0.8),
              rx: 1.5,
              fill: fills[grade[i] - 1],
            }),
          );
        }

        const selectedRuns = pickForestGradeRuns(grade, yCenter);
        const placed = placeDirectLabels(
          selectedRuns.map((b) => ({ id: b.id, y: b.midY, height: 17 })),
          { minGapPx: 20, minY: marginTop + 9, maxY: height - marginBottom - 9 },
        );
        const byId = new Map(placed.map((p) => [p.id, p]));

        for (const b of selectedRuns) {
          const py = byId.get(b.id)?.y ?? b.midY;
          const fill = fills[b.grade - 1];
          layer.append(
            svgEl(doc, "rect", {
              x: stripeX,
              y: py - 8.5,
              width: stripeW,
              height: 17,
              rx: 3,
              fill,
              stroke: pal.plotBg,
              strokeWidth: 1,
            }),
            svgEl(doc, "text", {
              x: stripeMid,
              y: py,
              dominantBaseline: "central",
              textAnchor: "middle",
              fontSize: 13,
              fontWeight: 700,
              fill: labelOn(fill, pal),
              num: b.grade,
              text: formatCount(b.grade),
            }),
          );
        }
        fig.svg.append(layer);
      }

      function drawChanges(r) {
        const changes = new Map(r.change.pairs.map((p) => [`${p.i}/${p.j}`, p]));
        const before = relations(r.a.grade);
        const after = relations(r.b.grade);
        const words = { 1: "above", 0: "withheld", "-1": "below" };
        const cells = [];
        for (let i = 0; i < IDS.length; i += 1) {
          for (let j = i + 1; j < IDS.length; j += 1) {
            const p = changes.get(`${i}/${j}`);
            const kind = !p
              ? "Unchanged"
              : p.from === "withheld"
                ? "Newly stated"
                : p.to === "withheld"
                  ? "Newly withheld"
                  : "Reversed";
            cells.push({ i, j, row: IDS[i], col: IDS[j], from: words[before[i][j]], to: words[after[i][j]], kind });
          }
        }

        const fallbackW = Math.min(420, Math.max(256, Math.round(ctx.width() - 56)));
        const width = Math.max(250, Math.min(460, Math.round(changeSlot.clientWidth || fallbackW)));
        const marginTop = 26;
        const marginLeft = 40;
        const marginRight = 10;
        const marginBottom = 10;
        const height = width - marginLeft - marginRight + marginTop + marginBottom;

        plot(changeSlot, {
          width,
          height,
          marginTop,
          marginLeft,
          marginRight,
          marginBottom,
          x: { domain: IDS, ticks: Array.from(LANDMARK_IDS), label: null, axis: "top", tickSize: 0 },
          y: { domain: IDS, ticks: Array.from(LANDMARK_IDS), label: null, axis: "left", tickSize: 0 },
          marks: (c, P) => [
            P.cell(cells, { x: "col", y: "row", fill: c.plotBg, stroke: c.plotGrid, strokeWidth: 0.7, inset: 0.4 }),
            P.dot(
              cells.filter((d) => d.kind === "Newly stated"),
              { x: "col", y: "row", fill: c.plotFg, r: 2.5 },
            ),
            P.dot(
              cells.filter((d) => d.kind === "Newly withheld"),
              { x: "col", y: "row", fill: c.plotBg, stroke: c.plotFg, strokeWidth: 1.2, r: 2.5 },
            ),
            P.dot(
              cells.filter((d) => d.kind === "Reversed"),
              { x: "col", y: "row", symbol: "times", stroke: c.plotFg, strokeWidth: 1.2, r: 3 },
            ),
          ],
          alt: "One outlined cell for every unordered pair, in unit ID order. Empty cells are unchanged, filled circles newly stated, open circles newly withheld, crosses reversed from observation A to B. Use arrow keys for the unit names and relations.",
          keyboard: {
            data: cells,
            x: "col",
            y: "row",
            key: (d) => `${d.i}/${d.j}`,
            sort: false,
            title: (d) => `${d.row} relative to ${d.col}: ${d.from} then ${d.to}; ${d.kind}.`,
          },
          table: {
            caption: "All pair relations before and after remeasurement",
            columns: [
              { label: "Row unit", value: "row" },
              { label: "Column unit", value: "col" },
              { label: "Before", value: "from" },
              { label: "After", value: "to" },
              { label: "Change", value: "kind" },
            ],
            rows: cells,
          },
        });

        const changed = cells.filter((c) => c.kind !== "Unchanged");
        const changedRows = changed.map((c) =>
          h(
            "tr",
            {},
            ...["row", "col", "from", "to", "kind"].map((k) =>
              h("td", {}, h("span", { "data-prx-name": k === "row" || k === "col" ? "" : null }, c[k])),
            ),
          ),
        );
        const table = h(
          "table",
          { class: "st-table st-changed-table prx-sticky-first" },
          h("caption", {}, "Changed relations in the selected pair"),
          h("thead", {}, h("tr", {}, ...["Row unit", "Column unit", "Before", "After", "Change"].map((x) => h("th", { scope: "col" }, x)))),
          h("tbody", {}, ...changedRows),
        );
        changeTable.replaceChildren(scroll(table, "Changed relations in the selected pair", "st-changed-scroll"));
      }

      function drawSelectedDataPlots(p, s) {
        const r = p.byRule[s.rule];
        const modelsAB = [p.a.model, p.b.model];
        const bounds = modelsAB.flatMap((m) =>
          m.estimate.flatMap((v, i) => [v - m.se[i], v + m.se[i], m.post.mean[i], LEAGUE.theta[i]]),
        );
        const lo = Math.min(...bounds);
        const hi = Math.max(...bounds);
        const domain = [lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.06];
        modelsAB.forEach((m, i) => drawRows(plotSlots[i], m, (i ? r.b : r.a).grade, domain));
        drawChanges(r);
      }

      function drawSelected(s, p) {
        const r = p.byRule[s.rule];
        const change = r.change.pairs[0];
        if (change) {
          const first = IDS[change.i], second = IDS[change.j];
          const label = v => v === "withheld" ? "withheld" : v === "above" ? first + " above " + second : second + " above " + first;
          exampleRelation.replaceChildren(h("strong", {}, first + "–" + second), " in the selected repeat: ",
            label(change.from), " → ", label(change.to), ". Changed pairs: ",
            ctx.num(r.change.pairs.length, formatCount(r.change.pairs.length)), " of ", ctx.num(r.change.M, formatCount(r.change.M)), ".");
        } else {
          exampleRelation.textContent = "Every pair has the same reported relation in both measurements.";
        }
        [r.a, r.b].forEach((value, i) => {
          const model = i ? p.b.model : p.a.model;
          const head = h("h4", {}, `Observation ${i ? "B" : "A"}: `, CONFIG.names[s.rule]);
          let card;
          if (s.rule === "pm-cuts" || s.rule === "post-tiers") {
            const row = cards.drawRow(
              {
                ids: IDS,
                n: IDS.length,
                fraction: false,
                pmOrder: scoreOrder(model.post.mean, { direction: "descending" }).order,
              },
              s.rule === "pm-cuts" ? "pm-cuts" : "pm-tiers",
              value,
              null,
              s.G,
              false,
              currentPalette(),
              false,
            );
            if (s.rule === "pm-cuts") {
              row
                .querySelector("[data-prx-label]")
                ?.replaceWith(labelNode(ctx, value, { key: i ? "measurement-b" : "measurement-a" }));
            }
            card = h("ol", { class: "prx-pt-rows" }, row);
          } else {
            card = h(
              "div",
              { class: "prx-pt-row prx-light-panel" },
              cards.chips({ ids: IDS, n: IDS.length }, value.grade, currentPalette()),
              h("p", {}, s.rule === "withheld" ? captionNode(ctx, "fixed-report") : captionNode(ctx, "fixed-tiers")),
            );
          }
          const compactChips = cards.chips({ ids: IDS, n: IDS.length }, value.grade, currentPalette());
          headers[i].replaceChildren(
            head,
            compactChips,
            ownClaim(value, i ? "b" : "a"),
            ...(s.rule === "pm-cuts" ? [note("Cuts of the posterior-mean order.")] : []),
            note("Measurement seed ", ro(i ? "seedB" : "seedA", p.seeds[i]), "."),
            h("p", { class: "prx-sr-only" }, "Grade vector in unit ID order: ", ro(i ? "b-grades" : "a-grades", value.grade, formatGrades)),
          );
          cardDetails[i].replaceChildren(card);
        });

        reportNotes.forEach((slot) =>
          slot.replaceChildren(
            note(
              "Line: estimate ± one SE; vermillion tick: estimate; navy dot: posterior mean; open circle: the SAME fixed truth; numbered chip: report grade.",
            ),
          ),
        );
        changeTitle.replaceChildren(
          note(
            "Pair ",
            ro("pair", s.pair),
            ": ",
            ro("changed", r.change.changed),
            " of ",
            ro("M", r.change.M),
            " relations changed (",
            ro("changeShare", r.change.changeShare, formatShare),
            "). Newly stated ",
            ro("newStated", r.change.nNewDisclosed),
            "; newly withheld ",
            ro("newWithheld", r.change.nNewWithheld),
            "; reversed ",
            ro("reversed", r.change.nReversed),
            "; unchanged ",
            ro("same", r.change.nSame),
            ".",
          ),
          note(
            "A relation is above, below or withheld. This denominator includes ALL unordered pairs, including moves to or from withholding. A shared grade makes no equality claim.",
          ),
        );
        pairBar.set({
          title: (total) => ["Remeasurement ", num(s.pair), " (", total(), " pairs):"],
          total: r.change.M,
          counts: {
            same: r.change.nSame,
            withheld: r.change.nNewWithheld,
            stated: r.change.nNewDisclosed,
            reversed: r.change.nReversed,
          },
          words: { same: " unchanged", withheld: " newly withheld", stated: " newly stated", reversed: " reversed" },
        });
        return r;
      }

      function drawScatter(s, rows, pool) {
        const x = (row) => row.estimands.meanDisclosure;
        const pooled = (row) => row.estimands.ERR;
        const selected = rows.find((row) => row.rule === s.rule);
        const ticks = [0, 0.25, 0.5, 0.75, 1];
        const reading = (row) =>
          `${row.name}: mean N/M ${formatShare(x(row))}, mean changed/M ${formatShare(row.mean)}, pooled claimed E/N ${formatShare(pooled(row))}.` +
          (row.rule === "withheld" ? " Stable because silent." : "");

        const width = Math.max(250, Math.round(scatter.clientWidth || Math.max(260, ctx.width() - 28)));
        const compact = width < 420;
        const height = width < 480 ? 246 : 308;
        const marginTop = 28;
        const marginBottom = 38;
        const marginLeft = 46;
        const marginRight = compact ? 26 : 16;

        const replayCloud = pool.map((p) => ({
          pair: p.pair,
          x: p.byRule[s.rule].pairDisclosure,
          y: p.byRule[s.rule].change,
        }));
        const inspectedPt = replayCloud[s.pair - 1] ?? null;

        stageLegend.replaceChildren(
          "Faded dots: ",
          num(pool.length),
          pool.length === 1 ? " remeasurement" : " remeasurements",
          " of ",
          SHORT_RULE[s.rule],
          " (orange ring = #",
          num(s.pair),
          ")",
        );

        const fig = plot(scatter, {
          width,
          height,
          marginLeft,
          marginRight,
          marginTop,
          marginBottom,
          x: {
            domain: [-0.04, 1.04],
            ticks,
            label: width < 400 ? "Mean disclosure (N/M)" : "Mean share of pairs stated (N/M)",
            labelAnchor: "center",
            labelArrow: "none",
            grid: true,
          },
          y: {
            domain: [-0.055, 1.04],
            ticks,
            label: "Mean share changed",
            grid: true,
          },
          marks: (c, P) => [
            P.dot(replayCloud, {
              x: "x",
              y: "y",
              r: 3.3,
              fill: c[MARK[s.rule].ink],
              fillOpacity: 0.2,
              stroke: c[MARK[s.rule].ink],
              strokeOpacity: 0.36,
              strokeWidth: 0.8,
            }),
            ...(inspectedPt
              ? [
                  P.link(
                    [{ x1: x(selected), y1: selected.mean, x2: inspectedPt.x, y2: inspectedPt.y }],
                    {
                      x1: "x1",
                      y1: "y1",
                      x2: "x2",
                      y2: "y2",
                      stroke: c[MARK[s.rule].ink],
                      strokeDasharray: "3 3",
                      strokeOpacity: 0.55,
                      strokeWidth: 1.2,
                    },
                  ),
                  P.dot([inspectedPt], {
                    x: "x",
                    y: "y",
                    r: 5,
                    fill: c.plotBg,
                    stroke: c.est,
                    strokeWidth: 1.8,
                  }),
                ]
              : []),
            P.dot(rows, {
              x,
              y: "mean",
              symbol: (row) => MARK[row.rule].symbol,
              fill: (row) => c[MARK[row.rule].ink],
              stroke: c.plotBg,
              strokeWidth: 1.2,
              r: 5.5,
            }),
            P.dot([selected], {
              x,
              y: "mean",
              symbol: (row) => MARK[row.rule].symbol,
              fill: "none",
              stroke: c.plotBg,
              strokeWidth: 3.4,
              r: 9,
            }),
            P.dot([selected], {
              x,
              y: "mean",
              symbol: (row) => MARK[row.rule].symbol,
              fill: "none",
              stroke: c.plotFg,
              strokeWidth: 1.8,
              r: 9,
            }),
          ],
          alt: "Four reporting rules compared on the same paired measurements. Horizontal position is mean disclosure. Vertical position is the mean share of relations changed. Select a point to inspect that rule.",
          keyboard: {
            data: rows,
            x,
            y: "mean",
            key: (row) => row.rule,
            sort: false,
            title: reading,
            pointer: true,
            onSelect: (row) => selectRule(row.rule),
          },
          table: {
            caption: "Stability and disclosure over the same paired measurements",
            columns: [
              { label: "Rule", value: "name" },
              { label: "Mean N/M", value: x, format: formatShare },
              { label: "Mean changed/M", value: "mean", format: formatShare },
              { label: "Pooled claimed E/N", value: pooled, format: formatShare },
            ],
            rows,
          },
        });

        // Direct labels placed via 1D relaxation pass (WA-02 item.id Map, WB-03 rx: 3 plotBg backing rect, WA-13 bounds, WC-05 ring obstacle)
        const doc = fig.svg.ownerDocument;
        const sx = fig.scale("x");
        const sy = fig.scale("y");
        const pal = fig.palette;
        const roomy = width >= 520;
        const safeLeft = marginLeft + 4;
        const safeRight = compact ? width - 5 : width - marginRight - 4;
        const safeTop = marginTop + 12;
        const safeBottom = height - marginBottom - 12;
        const padX = compact ? 11 : 13;

        const leaderLayer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-label-leaders": "" });
        const labelLayer = svgEl(doc, "g", { "aria-hidden": "true", "data-prx-direct-labels": "" });
        fig.svg.append(leaderLayer, labelLayer);

        const labelForRule = (rKey) => (compact ? COMPACT_RULE[rKey] : SHORT_RULE[rKey]);
        const ringPx = inspectedPt ? sx.apply(inspectedPt.x) : null;
        const ringPy = inspectedPt ? sy.apply(inspectedPt.y) : null;

        const rawItems = rows.map((row) => {
          const px = sx.apply(x(row));
          const py = sy.apply(row.mean);
          const isSel = row.rule === s.rule;
          const errVal = pooled(row);
          const baseName = labelForRule(row.rule);
          let prefix;
          let numPart = null;
          let suffix = "";
          if (row.rule === "withheld") {
            prefix = roomy ? "Withhold every pair · silent" : baseName;
          } else if (isSel && errVal !== null) {
            prefix = roomy ? `${SHORT_RULE[row.rule]} · E/N ` : `${baseName} (`;
            numPart = { raw: errVal, text: formatShare(errVal) };
            suffix = roomy ? "" : ")";
          } else {
            prefix = baseName;
          }
          const plain = `${prefix}${numPart ? numPart.text : ""}${suffix}`;
          const estW = Math.min(safeRight - safeLeft - 4, estimateTextPx(plain, isSel) + 12);
          const textNode = svgEl(
            doc,
            "text",
            {
              x: px,
              y: py,
              dominantBaseline: "central",
              fontSize: 13,
              fontWeight: isSel ? 700 : 500,
              fill: pal[MARK[row.rule].textInk],
            },
            prefix,
            numPart ? svgEl(doc, "tspan", { num: numPart.raw, text: numPart.text }) : null,
            suffix,
          );
          labelLayer.append(textNode);
          const measuredW =
            typeof textNode.getComputedTextLength === "function" ? textNode.getComputedTextLength() : 0;
          const pillW = Math.min(
            safeRight - safeLeft - 4,
            measuredW > 0 ? Math.ceil(measuredW + 12) : estW,
          );

          let rectX;
          let anchor;
          let textX;
          if (px + padX + pillW <= safeRight) {
            rectX = px + padX;
            anchor = "start";
            textX = rectX + 6;
          } else if (px - padX - pillW >= safeLeft) {
            rectX = px - padX - pillW;
            anchor = "end";
            textX = rectX + pillW - 6;
          } else {
            rectX = Math.max(safeLeft, Math.min(safeRight - pillW, px - pillW / 2));
            anchor = "start";
            textX = rectX + 6;
          }

          const overlapsRing =
            inspectedPt !== null && rectX <= ringPx + 10 && rectX + pillW >= ringPx - 10;
          let targetY = row.rule === "withheld" ? py - 8 : py;
          if (overlapsRing && Math.abs(targetY - ringPy) < 19) {
            const preferUp = targetY <= ringPy && ringPy - 19 >= safeTop;
            targetY = preferUp || ringPy + 19 > safeBottom ? ringPy - 19 : ringPy + 19;
          }
          return {
            id: row.rule,
            row,
            px,
            py,
            y: targetY,
            height: 19,
            isSel,
            textNode,
            pillW,
            rectX,
            anchor,
            textX,
            overlapsRing,
          };
        });

        const anyOverlapsRing = rawItems.some((it) => it.overlapsRing);
        const solverInput = anyOverlapsRing
          ? [...rawItems, { id: "__ring__", y: ringPy, height: 22 }]
          : rawItems;
        let placed = placeDirectLabels(solverInput, { minGapPx: 21, bounds: [safeTop, safeBottom] });
        let byId = new Map(placed.map((p) => [p.id, p]));

        if (
          anyOverlapsRing &&
          rawItems.some((it) => it.overlapsRing && Math.abs((byId.get(it.id)?.y ?? it.py) - ringPy) < 16.5)
        ) {
          const above = [];
          const below = [];
          for (const it of rawItems) {
            const curY = byId.get(it.id)?.y ?? it.y;
            const putAbove =
              curY < ringPy
                ? ringPy - 17 >= safeTop
                : ringPy + 17 > safeBottom;
            (putAbove ? above : below).push(it);
          }
          const placedAbove = above.length
            ? placeDirectLabels(above, { minGapPx: 20, bounds: [safeTop, Math.max(safeTop, ringPy - 17)] })
            : [];
          const placedBelow = below.length
            ? placeDirectLabels(below, { minGapPx: 20, bounds: [Math.min(safeBottom, ringPy + 17), safeBottom] })
            : [];
          byId = new Map([...placedAbove, ...placedBelow].map((p) => [p.id, p]));
        }

        for (const item of rawItems) {
          const ly = byId.get(item.id)?.y ?? item.py;
          const { px, py, pillW, rectX, anchor, textX, isSel, textNode } = item;
          textNode.setAttribute("x", String(textX));
          textNode.setAttribute("y", String(ly));
          textNode.setAttribute("text-anchor", anchor);

          const edgeX = Math.abs(px - rectX) < Math.abs(px - (rectX + pillW)) ? rectX : rectX + pillW;
          if (Math.hypot(edgeX - px, ly - py) > 12) {
            leaderLayer.append(
              svgEl(doc, "line", {
                x1: px,
                y1: py,
                x2: edgeX,
                y2: ly,
                stroke: isSel ? pal.plotFg : pal.plotMuted,
                strokeWidth: 1,
                strokeOpacity: 0.7,
              }),
            );
          }
          labelLayer.insertBefore(
            svgEl(doc, "rect", {
              x: rectX,
              y: ly - 9,
              width: pillW,
              height: 18,
              rx: 3,
              fill: pal.plotBg,
              fillOpacity: 0.94,
              stroke: isSel ? pal.plotFg : pal.plotGrid,
              strokeWidth: isSel ? 1.25 : 0.85,
            }),
            textNode,
          );
        }

        const palette = currentPalette();
        rows.forEach((row, i) => {
          const button = scatterButtons[i];
          const mark = MARK[row.rule];
          button.replaceChildren(
            h("span", { class: "st-glyph", "aria-hidden": "true", style: { color: palette[mark.ink] } }, mark.glyph),
            SHORT_RULE[row.rule],
            " · ",
            ro(`scatter-claim-${row.rule}`, pooled(row), formatShare),
          );
          button.setAttribute("aria-label", reading(row));
          button.setAttribute("aria-pressed", String(row.rule === s.rule));
        });
      }

      function drawHistogram(s, rows, pool) {
        const row = rows.find((r) => r.rule === s.rule);
        const points = pool.map((p) => {
          const { change: share, reversed, stated, withheld } = p.byRule[s.rule];
          return { pair: p.pair, share, reversed, stated, withheld };
        });
        const kinds = ["stated", "withheld", "reversed", "unchanged"];
        const bins = Array.from({ length: 20 }, (_, i) => ({
          from: i / 20,
          to: (i + 1) / 20,
          count: 0,
          stated: 0,
          withheld: 0,
          reversed: 0,
          unchanged: 0,
        }));
        for (const point of points) {
          const bin = bins[Math.min(19, Math.floor(point.share * 20))];
          bin.count += 1;
          const changed = point.stated + point.withheld + point.reversed;
          if (!changed) bin.unchanged += 1;
          else for (const kind of kinds.slice(0, 3)) bin[kind] += point[kind] / changed;
        }
        const layers = bins.flatMap((bin) => {
          let y = 0;
          return kinds.map((kind) => {
            const y1 = y;
            y += bin[kind];
            return { ...bin, kind, y1, y2: y };
          });
        });
        const layerColors = (c) => ({
          stated: c.post,
          withheld: c.purples[4],
          reversed: c.est,
          unchanged: c.plotMuted,
        });
        const inspected = points[s.pair - 1].share;
        const high = Math.max(...bins.map((bin) => bin.count));
        const marker = [{ share: inspected, y: high }];
        const fallbackW = Math.min(460, Math.max(256, Math.round(ctx.width() - 56)));
        const width = Math.max(250, Math.round(histogram.clientWidth || fallbackW));

        plot(histogram, {
          width,
          height: 248,
          marginLeft: 48,
          marginRight: 16,
          marginTop: 28,
          marginBottom: 40,
          x: {
            domain: [0, 1],
            ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
            label: "Share of all pair relations changed",
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { label: "Measurement pairs", grid: true },
          marks: (c, P) => [
            P.rect(layers, {
              x1: "from",
              x2: "to",
              y1: "y1",
              y2: "y2",
              fill: (d) => layerColors(c)[d.kind],
              insetLeft: 1,
              insetRight: 1,
            }),
            P.ruleX([row.mean], { stroke: c.plotBg, strokeWidth: 4 }),
            P.ruleX([row.mean], { stroke: c.plotFg, strokeDasharray: "4 3", strokeWidth: 1.6 }),
            P.ruleX([inspected], { stroke: c.plotBg, strokeWidth: 4 }),
            P.ruleX([inspected], { stroke: c.est, strokeWidth: 2 }),
            P.dot(marker, { x: "share", y: "y", symbol: "triangle", rotate: 180, dy: -11, r: 6, fill: c.est, stroke: c.plotFg }),
            numText(marker, {
              x: "share",
              y: "y",
              value: "share",
              format: formatShare,
              dx: inspected > 0.7 ? -10 : 10,
              dy: -11,
              textAnchor: inspected > 0.7 ? "end" : "start",
              fill: c.plotFg,
              stroke: c.plotBg,
              strokeWidth: 3.5,
              paintOrder: "stroke",
            }),
          ],
          alt: "Histogram of relation-change shares over disjoint measurement pairs for the selected rule. Each pair counts once. Segments split that count by its change types. Dashed line is the replay mean; solid line marks the inspected pair.",
          keyboard: {
            data: bins,
            x: (d) => (d.from + d.to) / 2,
            y: "count",
            key: (d) => d.from,
            title: (d) => `Changed share ${formatShare(d.from)} to ${formatShare(d.to)}: ${formatCount(d.count)} measurement pairs.`,
          },
          table: {
            caption: "Each paired measurement's changed share",
            columns: [
              { label: "Pair", value: "pair", format: formatCount },
              { label: "Changed share", value: "share", format: formatShare },
            ],
            rows: points,
          },
        });

        const colors = layerColors(currentPalette());
        histogramKey.replaceChildren(
          h("span", {}, "Dashed line: mean across measurement pairs ", num(row.mean, formatShare), "."),
          h("span", {}, "Solid line: inspected pair ", num(s.pair), ", changed share ", num(points[s.pair - 1].share, formatShare), "."),
          h("span", {}, "Each remeasurement counts once. Its bar share is split among its change types."),
          ...kinds.map((kind) =>
            h(
              "span",
              {},
              h("i", {
                "aria-hidden": "true",
                style: `display:inline-block;width:.75em;height:.75em;margin-right:.3em;background:${colors[kind]}`,
              }),
              ({ stated: "Newly stated", withheld: "Newly withheld", reversed: "Reversed", unchanged: "No changes" })[kind],
            ),
          ),
        );
      }

      function computePoolRows(pool) {
        return CONFIG.rules.map((rKey) => {
          const trace = pool.map((p) => p.byRule[rKey]);
          const claims = trace.flatMap((t) => [
            { A: t.a.Ew, N: t.a.N },
            { A: t.b.Ew, N: t.b.N },
          ]);
          return {
            rule: rKey,
            name: CONFIG.names[rKey],
            mean: summaryStats(trace.map((t) => t.change)).mean,
            meanReversed: summaryStats(trace.map((t) => t.reversed / M)).mean,
            meanStated: summaryStats(trace.map((t) => t.stated / M)).mean,
            meanWithheld: summaryStats(trace.map((t) => t.withheld / M)).mean,
            estimands: disclosedErrorEstimands(claims, { M }),
          };
        });
      }

      function renderPoolData(s, pool, rows) {
        drawHistogram(s, rows, pool);

        const tableRows = rows.map((r) =>
          h(
            "tr",
            { class: r.rule === s.rule ? "st-selected" : null, "data-prx-summary": r.rule },
            h("th", { scope: "row" }, r.name),
            h(
              "td",
              {},
              ro(`mean-change-${r.rule}`, r.mean, formatShare),
              h("span", { class: "st-reversed-mean" }, "Reversed/M ", ro(`mean-reversed-${r.rule}`, r.meanReversed, formatShare)),
              h("span", { class: "st-reversed-mean" }, "Newly stated/M ", ro(`mean-stated-${r.rule}`, r.meanStated, formatShare)),
              h("span", { class: "st-reversed-mean" }, "Newly withheld/M ", ro(`mean-withheld-${r.rule}`, r.meanWithheld, formatShare)),
            ),
            h("td", {}, ro(`mean-disclosure-${r.rule}`, r.estimands.meanDisclosure, formatShare)),
            h("td", {}, ro(`pooled-claim-${r.rule}`, r.estimands.ERR, formatShare)),
            h("td", {}, ctx.button({ label: "View", key: `view:${r.rule}`, onClick: () => selectRule(r.rule) }).root),
          ),
        );
        const table = h(
          "table",
          { class: "st-table st-summary-table prx-sticky-first" },
          h("caption", {}, "Same paired measurements for every rule"),
          h(
            "thead",
            {},
            h("tr", {}, ...["Rule", "Mean changed / M", "Mean N / M", "Pooled claimed E / N", "Inspect"].map((x) => h("th", { scope: "col" }, x))),
          ),
          h("tbody", {}, ...tableRows),
        );
        summary.replaceChildren(scroll(table, "Stability, disclosure and claimed errors for all rules"));
        summaryNote.replaceChildren(
          note(
            "Mean changed/M averages the paired relation-change shares. Mean N/M averages disclosure across BOTH observations. Pooled claimed E/N is the sum of their posterior expected wrong counts divided by the sum of stated pairs; it is not the mean of the individual fractions. NA means there was no disclosure.",
          ),
        );
        sampling.replaceChildren(
          note(
            "Monte Carlo: ",
            ro("replays", s.replays),
            " paired remeasurements, ",
            num(2 * s.replays),
            " distinct measurement seeds, first seed ",
            num(s.seed),
            ". Consecutive pairs use consecutive nonoverlapping seed pairs; seeds cycle through ",
            num(1),
            " to ",
            num(CONFIG.seedMax),
            ". Every rule uses the SAME pairs. No auxiliary lottery is used.",
          ),
          note(
            "The true values are fixed, and each new measurement produces its own posterior under the chosen prior. The error figures are expectations under those posteriors. A rule that withholds every pair is perfectly stable because it never states a direction. A lower-risk report can still change more often when the measurements change.",
          ),
        );
        progress.replaceChildren("Complete: ", num(pool.length), " paired remeasurements.");
      }

      function runStagedPool(s, key, needSelectedData) {
        activePoolKey = key;
        const jobRows = [];
        const total = s.replays;
        const stageCount = Math.max(1, Math.ceil(total / POOL_STAGE_BATCH));
        let finalRows = null;
        const computeStages = Array.from({ length: stageCount }, (_, idx) => () => {
          const stop = Math.min((idx + 1) * POOL_STAGE_BATCH, total);
          while (jobRows.length < stop) {
            jobRows.push(compactPair(measurementPair(s, jobRows.length + 1)));
          }
          if (jobRows.length < total) {
            progress.replaceChildren("Computing paired remeasurements: ", num(jobRows.length), " of ", num(total), ".");
          } else {
            remember(pools, key, jobRows, 6);
            activePoolKey = null;
            finalRows = computePoolRows(jobRows);
            currentPool = jobRows;
            currentRows = finalRows;
            drawScatter(current, finalRows, jobRows);
            drawReadout(current, selectedResult, finalRows);
          }
        });
        const tailStages = [
          ...(needSelectedData ? [() => { if (selectedPairObj) drawSelectedDataPlots(selectedPairObj, current); }] : []),
          () => { if (finalRows) renderPoolData(current, jobRows, finalRows); },
        ];
        ctx.scheduleStages([...computeStages, ...tailStages], { yieldMs: 0 });
      }

      mobileControls(ctx, { primary: [tau.root], before: [[stageLegend, pairBar.root]] });
      return {
        render(s, info = {}) {
          // PR-06 / PR-09: opening a disclosure never re-renders ctx.stage or re-fires ctx.readout;
          // opening Data redraws its width-dependent SVGs at the real open width.
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data" && dataBox.open) {
              if (selectedPairObj) drawSelectedDataPlots(selectedPairObj, current);
              if (currentPool && currentRows) drawHistogram(current, currentRows, currentPool);
            }
            return;
          }

          if (s.pair > s.replays) {
            ctx.set({ pair: s.replays });
            return;
          }
          current = s;
          rule.set(s.rule);
          G.set(s.G);
          tau.set(s.tau);
          prior.set(s.priorSd);
          replays.set(s.replays);
          seed.set(s.seed);
          pairInput.max = String(s.replays);
          pairInput.value = String(s.pair);
          pairInput.setAttribute("aria-valuetext", `Pair ${formatCount(s.pair)} of ${formatCount(s.replays)}`);
          pairOutput.replaceChildren(num(s.pair), " of ", num(s.replays));
          previous.setAttribute("aria-disabled", String(s.pair === 1));
          next.setAttribute("aria-disabled", String(s.pair === s.replays));

          const key = `${s.seed}/${s.priorSd}/${s.G}/${s.tau}/${s.replays}`;
          const viewKey = `${s.seed}/${s.priorSd}/${s.G}/${s.tau}/${s.pair}/${s.rule}/${ctx.width()}/${ctx.doc.documentElement.dataset.theme}`;
          const needSelectedData = selectedKey !== viewKey;
          if (needSelectedData) {
            selectedPairObj = measurementPair(s);
            selectedResult = drawSelected(s, selectedPairObj);
            selectedKey = viewKey;
          }

          const pool = pools.get(key);
          if (pool) {
            activePoolKey = null;
            const rows = computePoolRows(pool);
            currentPool = pool;
            currentRows = rows;
            drawScatter(s, rows, pool);
            drawReadout(s, selectedResult, rows);
            ctx.scheduleStages(
              [
                ...(needSelectedData ? [() => { if (selectedPairObj) drawSelectedDataPlots(selectedPairObj, current); }] : []),
                () => renderPoolData(current, pool, rows),
              ],
              { yieldMs: 0 },
            );
          } else {
            drawReadout(s, selectedResult, null);
            if (activePoolKey !== key) runStagedPool(s, key, needSelectedData);
          }

          ctx.caption.replaceChildren(
            "Same fixed league truth and known SEs; independent normal measurement errors; prior mean ",
            num(0),
            ", assumed prior SD ",
            num(s.priorSd, formatSetting),
            "; ",
            captionNode(ctx, "teaching-posterior"),
            ". The estimates change; the truth does not.",
          );
        },
      };
    },
  });
}
