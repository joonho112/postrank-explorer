// App3.1: full R-01 source port. The tier report is fixed by the estimate rule, then judged under the declared posterior.
// Exports preserve the full league/disclosure renderers for dependent apps; no course gate remains.
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatRisk, formatSetting, formatShare, formatSizes, formatProb } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, disclosure, drawLeague, errorArray, evaluateReport, league30, normalPosterior, pairCount, scoreOrder,
  relations, statedAbove, tierGrades,
} from "../pr-core.js";

export const CONFIG = Object.freeze({
  name: "fixed-tiers",
  label: "Fixed tiers: what tiers of fixed size disclose, and their expected wrong directions, on the simulated league",
  className: "prx-ft",
  G: Object.freeze({ min: 1, max: 30, step: 1, value: 3 }),
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  outline: Object.freeze({ value: false }),
  // the course's teaching posterior of the league (normal prior, mean 0, SD .15)
  prior: Object.freeze({ mean: 0, sd: 0.15 }),
  seWidth: 1,
  // league rows: rowPx per unit; light tier bands, their fill opacity alternating between the two tints so that
  // neighboring tiers separate; the estimate tick spans tickHalf of a row on each side
  league: Object.freeze({
    rowPx: 12, marginTop: 6, marginBottom: 38, marginLeft: 26, marginRight: 12, half: 0.5, tickHalf: 0.38,
    domain: Object.freeze([-0.6, 0.4]), ticks: Object.freeze([-0.6, -0.4, -0.2, 0, 0.2, 0.4]),
    tints: Object.freeze([0.26, 0.1]), dash: "3,2", line: 1.25, tick: 2.25, gradeDx: 7, labelPx: 12,
  }),
  // pair map: square cells between minCell and maxCell px; a mark is a dot of dotShare of a cell; tiers of at least
  // minLabelSize units get their withheld count, labelDx px left of the triangle
  matrix: Object.freeze({
    marginTop: 4, marginLeft: 4, marginRight: 4, marginBottom: 4, minCell: 7, maxCell: 14, inset: 0.5, border: 0.5,
    dotShare: 0.22, hatchSpacing: 4, hatchWidth: 1, labelDx: 3, minLabelSize: 3,
  }),
  text: Object.freeze({
    sliderG: "Number of tiers G",
    sliderGHint: "Tiers follow the estimates: the unit in position p of the estimate order goes to tier 1 + ⌊(p − 1)G/n⌋.",
    sliderTau: "Withholding cost τ",
    sliderTauHint: "τ prices each withheld pair. It does not move the tiers or the pairs they state.",
    outline: "Mark the stated pairs whose error exceeds τ",
    leagueHeading: "The league in tiers",
    leagueAlt: "The thirty units in estimate order, largest estimate at the top: each unit's estimate as a tick with a line of one standard error on each side, over shaded bands that mark the tiers.",
    leagueTable: "The thirty units in estimate order: position, unit, estimate, standard error and tier",
    leagueKeys: "Units in estimate order. Use the arrow keys to read each unit.",
    leagueAxis: "estimate (tick) ± one SE (line)",
    leagueNote: Object.freeze(["Tier ", "{one}", " = the largest estimates. Shaded bands: the tiers, each with its number at the left; the tier of a unit is its grade in the report. Ticks: estimates; lines: ± ", "{se}", " SE."]),
    mapHeading: "Which pairs the tiers state",
    mapAlt: "The upper triangle of the pair matrix, units in estimate order: stated pairs filled, withheld pairs (inside one tier) hatched; the withheld pairs form one triangle per tier along the diagonal.",
    mapTable: "Every pair of units, higher estimate first: tiers, what the tier report does with the pair, and the error of the stated direction",
    mapKeys: "Pairs of units in estimate order, row by row. Use the arrow keys to read each pair.",
    mapAxis: "column: the lower unit of the pair",
    mapRowAxis: "row: the higher unit (estimate order, largest at the top)",
    relStated: "stated: the row unit is in a higher tier (a smaller tier number) than the column unit",
    relWithheld: "withheld: both units in one tier (not a claim of equality)",
    outlineLegend: "dot: a stated pair whose error exceeds τ =",
    countLegend: "number beside a triangle: the pairs withheld inside that tier",
    disclosureHeading: "What the tiers disclose",
    sizesWord: "Tier sizes",
    balancedNote: "When estimates have no ties, quantile positions give sizes that differ by at most one. For a given G no report with at most G grades states more pairs (theory book, chapter 16). The sizes, and so N, depend neither on the estimates' values, nor on the posterior, nor on τ.",
    dividesNote: Object.freeze(["When G divides n (here ", "{n}", " = ", "{G}", " × ", "{size}", "), the share also follows from n and G alone:"]),
    errorsHeading: "Wrong directions under the teaching posterior",
    tileE: "Expected wrong directions, E",
    tileEN: "Per stated direction, E/N",
    tileRisk: "Expected loss per pair (risk)",
    tileTau: "Withholding cost τ",
    enAbove: "E/N is above τ, so at this τ the tiers' risk is above the all-withheld report's risk, τ (the risk averages E/N and τ, weighted by the shares stated and withheld).",
    enBelow: "E/N is below τ, so at this τ the tiers' risk is below the all-withheld report's risk, τ (the risk averages E/N and τ, weighted by the shares stated and withheld).",
    enEqual: "E/N equals τ, so at this τ the tiers' risk equals the all-withheld report's risk, τ (the risk averages E/N and τ, weighted by the shares stated and withheld).",
    enNone: "With one tier the report states nothing: E/N is not defined, and the risk is τ.",
    overLine: Object.freeze(["Stated pairs whose error exceeds τ: ", "{over}", " of the ", "{N}", " stated. The largest error of a stated direction is ", "{max}", "."]),
    overNone: "No pair is stated, so no stated direction can be wrong.",
    overOff: "Switch on the marks to count the stated pairs whose error exceeds τ.",
    note: Object.freeze(["Simulated league of ", "{n}", " units, the frozen draw (seed ", "{seed}", "). Tiers: ", "{fixed}", ". Errors: ", "{teaching}", " (normal prior, mean ", "{pm}", ", SD ", "{psd}", "). The loss counts expected errors in the stated directions and charges for withholding the rest."]),
    readout: Object.freeze(["G = ", "{G}", " (sizes ", "{sizes}", "): the tiers state ", "{N}", " of ", "{M}", " pairs (N/M ", "{s}", "). Teaching posterior, τ = ", "{tau}", ": E ", "{E}", ", E/N ", "{EN}", ", risk ", "{risk}", "."]),
  }),
});

export const CSS = `

.prx-ft .prx-ft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  min-width: 0;
  margin: 0 0 1rem;
}

.prx-ft .prx-ft-box {
  min-width: 0;
}

.prx-ft .prx-ft-league,
.prx-ft .prx-ft-map {
  padding: 0.5rem 0.6rem 0.6rem;
  border-radius: var(--prx-radius, 6px);
}

.prx-ft .prx-ft-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
}

.prx-ft .prx-ft-league-chart,
.prx-ft .prx-ft-map-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-ft .prx-ft-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

.prx-ft .prx-ft-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.35rem 0 0;
  font-size: 0.85em;
}

.prx-ft .prx-ft-legend-title {
  flex: 1 1 100%;
}

.prx-ft .prx-ft-key {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.prx-ft .prx-ft-swatch {
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}

.prx-ft .prx-ft-swatch-stated {
  background: var(--prx-rel-above);
}

.prx-ft .prx-ft-swatch-hatch {
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 4px);
}

.prx-ft .prx-ft-swatch-outline {
  background: radial-gradient(circle, var(--prx-label-light) 0 28%, var(--prx-rel-above) 32%);
}

.prx-ft .prx-ft-legend-note {
  flex: 1 1 100%;
}

.prx-ft .prx-ft-sizes,
.prx-ft .prx-ft-line {
  margin: 0.35rem 0 0;
  font-size: 0.95em;
}

.prx-ft .prx-ft-formula {
  max-width: 100%;
  margin: 0.35rem 0 0;
  overflow-x: auto;
}

.prx-ft .prx-ft-formula math {
  margin: 0.15rem 0;
}

.prx-ft .prx-ft-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.5rem;
  margin: 0.25rem 0 0;
}

.prx-ft .prx-ft-tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}

.prx-ft .prx-ft-tile-name {
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}

.prx-ft .prx-ft-tile-value {
  font-size: 1.15em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.prx-ft .prx-ft-sym { font-style: italic; }
.prx-ft [data-prx-readout="sizes"], .prx-ft [data-prx-readout="readout-sizes"] { white-space: normal; overflow-wrap: anywhere; }
`;

const SVGNS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------------------------- the league

const LEAGUE = league30();
const DRAW = drawLeague(LEAGUE_SEED);
const IDS = Array.from(LEAGUE.ids);
const N_UNITS = IDS.length;
const M = pairCount(N_UNITS);
const EST = Array.from(DRAW.estimate);
const SE = Array.from(LEAGUE.se);
const POST = normalPosterior(EST, SE, { priorMean: CONFIG.prior.mean, priorSd: CONFIG.prior.sd });
const ERRORS = errorArray(Array.from(POST.mean), Array.from(POST.sd), { ids: IDS, criteria: ["theta"] });
const E0 = ERRORS.e[0];
// the estimate order, largest first (engine scoreOrder): ORDER[p] is the unit in position p (0-based)
const ORDER = Array.from(scoreOrder(EST, { direction: "descending" }).order);
const ALL_WITHHELD = Object.freeze(IDS.map(() => 1));

export const LEAGUE_MODEL = Object.freeze({ ids: IDS, estimate: EST, se: SE, post: POST, E: ERRORS, order: ORDER, seed: LEAGUE_SEED });

/** Same fixed-truth league/producer as the source; another seed is a new measurement, not a posterior state. */
export function leagueModel(seed = LEAGUE_SEED, priorSd = CONFIG.prior.sd) {
  const L = league30();
  const estimate = drawLeague(seed).estimate;
  const post = normalPosterior(estimate, L.se, { priorMean: CONFIG.prior.mean, priorSd });
  const E = errorArray(post.mean, post.sd, { ids: L.ids, criteria: ["theta"] });
  return { ids: L.ids, estimate, se: L.se, post, E, order: scoreOrder(estimate, { direction: "descending" }).order, seed };
}

/** Fill the "{slot}" parts of a text template with nodes (or strings) from `slots`. */
const fill = (parts, slots) => parts.map((p) => {
  const m = /^\{(\w+)\}$/.exec(p);
  if (!m) return p;
  const v = slots[m[1]];
  return typeof v === "function" ? v() : v;
});

/** The tier report of G tiers, its disclosure and the run of sizes as (size, count) groups in tier order. */
export function tiersOf(G, model = LEAGUE_MODEL) {
  return tierModelOfGrade(tierGrades(model.estimate, G, { direction: "descending" }), G);
}

/** Group grade sizes only for formula layout; disclosure supplies every scientific count. */
export function tierModelOfGrade(inputGrade, requestedG = null) {
  const grade = Array.from(inputGrade);
  const G = requestedG ?? disclosure(grade).G;
  const disc = disclosure(grade);
  const groups = [];
  for (const size of disc.sizes) {
    const last = groups.at(-1);
    if (last && last.size === size) last.count += 1;
    else groups.push({ size, count: 1 });
  }
  // the same groups merged by size (for the formula: c · C(size, 2) once per distinct size, larger size first)
  const bySize = new Map();
  for (const size of disc.sizes) bySize.set(size, (bySize.get(size) ?? 0) + 1);
  const terms = [...bySize.entries()].sort((a, b) => b[0] - a[0]).map(([size, count]) => ({ size, count }));
  return { G, grade, disc, groups, terms };
}


/** The complete source disclosure/MathML panel, shared by the editable-size app. */
export function createTierDisclosure(ctx, { balancedNote = CONFIG.text.balancedNote } = {}) {
  const { h } = ctx;
  const T = CONFIG.text;
  const ro = (name, raw, display) => { const n = ctx.num(raw, display); n.setAttribute("data-prx-readout", name); return n; };
  const count = (v) => ctx.num(v, formatCount(v));
  const sizesLine = h("p", { class: "prx-ft-sizes", "data-prx-part": "readout" });
  const formulaBox = h("div", { class: "prx-ft-formula", "data-prx-part": "readout", "data-prx-tex": "share" });
  const dividesLine = h("p", { class: "prx-ft-note", "data-prx-part": "notes" });
  const dividesBox = h("div", { class: "prx-ft-formula", "data-prx-part": "readout", "data-prx-tex": "divides" });
  const balancedLine = h("p", { class: "prx-ft-note", "data-prx-part": "notes", text: balancedNote });
  const disclosureBox = h("section", { class: "prx-ft-box prx-ft-disclosure", "aria-label": T.disclosureHeading },
    ctx.panelTitle(T.disclosureHeading, { className: "prx-ft-heading" }), sizesLine, formulaBox, dividesLine, dividesBox, balancedLine);

  function draw(t) {
    const N_UNITS = t.grade.length;
    const d = t.disc;
    const W = d.withheld;
    sizesLine.replaceChildren(`${T.sizesWord} `, h("span", { class: "prx-ft-sym" }, "n", h("sub", {}, "h")), ": ",
      ro("sizes", d.sizes, formatSizes(d.sizes, { label: false })), ". Pairs stated: N = ", ro("N", d.N, formatCount(d.N)),
      " of M = ", ro("M", d.M, formatCount(d.M)), "; withheld inside a tier: ", ro("W", W, formatCount(W)), ".");
    // N/M = 1 − Σ_h C(n_h, 2)/C(n, 2) = 1 − (c · C(size, 2) + …)/C(n, 2) = 1 − W/M = s; every digit is a number node
    const f = formulaNums();
    const one = () => f.num(1, "1");
    const two = () => f.num(2, "2");
    const binom = (top) => `\\binom{${top}}{${two()}}`;
    // (built in formula order: formulaNums tags the numbers in the order they are made)
    const line1 = `\\frac{N}{M} &= ${one()} - \\frac{\\sum_h ${binom("n_h")}}{${binom("n")}}`;
    const lead = one();
    const terms = t.terms.map((x) => `${x.count > 1 ? `${f.num(x.count, formatCount(x.count))}\\,` : ""}${binom(f.num(x.size, formatCount(x.size)))}`).join(" + ");
    const line2 = `&= ${lead} - \\frac{${terms}}{${binom(f.num(N_UNITS, formatCount(N_UNITS)))}} = ${one()} - \\frac{${f.num(W, formatCount(W))}}{${f.num(d.M, formatCount(d.M))}} = ${f.num(d.s, formatShare(d.s))}`;
    renderTex(formulaBox, `\\begin{aligned}${line1} \\\\ ${line2}\\end{aligned}`, { display: true, nums: f.raws });
    const divides = N_UNITS % t.G === 0 && t.disc.sizes.every((n) => n === t.disc.sizes[0]);
    dividesLine.hidden = !divides;
    dividesBox.hidden = !divides;
    if (divides) {
      const size = N_UNITS / t.G;
      dividesLine.replaceChildren(...fill(T.dividesNote, { n: () => count(N_UNITS), G: () => count(t.G), size: () => count(size) }));
      const g = formulaNums();
      const nn = () => g.num(N_UNITS, formatCount(N_UNITS));
      const g1 = () => g.num(1, "1");
      const symbolic = `\\frac{n\\,(${g1()} - ${g1()}/G)}{n - ${g1()}}`;
      const tex = `${symbolic} = \\frac{${nn()}\\,(${g1()} - ${g1()}/${g.num(t.G, formatCount(t.G))})}{${g.num(N_UNITS - 1, formatCount(N_UNITS - 1))}} = ${g.num(d.s, formatShare(d.s))}`;
      renderTex(dividesBox, tex, { display: true, nums: g.raws });
    }
  }

  return { root: disclosureBox, draw };
}

export function drawTierLeague(ctx, { slot: leagueSlot, note: leagueNote }, t, model = LEAGUE_MODEL) {
  const { ids: IDS, estimate: EST, se: SE, order: ORDER } = model;
  const N_UNITS = IDS.length;
  const T = CONFIG.text;
  const count = (v) => ctx.num(v, formatCount(v));
  const setting = (v) => ctx.num(v, formatSetting(v));
  const C = CONFIG.league;
  const rows = ORDER.map((i, p) => ({ i, id: IDS[i], pos: p, est: EST[i], se: SE[i], tier: t.grade[i], lo: EST[i] - CONFIG.seWidth * SE[i], hi: EST[i] + CONFIG.seWidth * SE[i] }));
  let first = 0;
  const bands = t.disc.sizes.map((size, k) => {
    const b = { tier: k + 1, size, first, last: first + size - 1, mid: first + (size - 1) / 2 };
    first += size;
    return b;
  });
  // tier numbers sit at their band's middle, pushed down when a thin band above leaves less than one line
  const gap = (C.labelPx * (Number(ctx.root.getAttribute("data-prx-font-scale")) || 1)) / C.rowPx;
  bands.forEach((b, k) => { b.at = k ? Math.max(b.mid, bands[k - 1].at + gap) : b.mid; });
  const [lo, hi] = C.domain;
  const tint = (tier) => C.tints[(tier - 1) % C.tints.length];
  const tipText = (d) => `${d.id}: position ${formatCount(d.pos + 1)} of ${formatCount(N_UNITS)} by estimate, tier ${formatCount(d.tier)} of ${formatCount(t.G)}; estimate ${formatDecimal(d.est, { digits: 3 })}, SE ${formatSetting(d.se)}`;
  plot(leagueSlot, {
    alt: T.leagueAlt,
    table: {
      caption: T.leagueTable,
      columns: [
        { label: "Position", value: (d) => d.pos + 1, format: (v) => formatCount(v), header: false },
        { label: "Unit", value: "id" },
        { label: "Estimate", value: "est", format: (v) => formatDecimal(v, { digits: 3 }) },
        { label: "SE", value: "se", format: (v) => formatSetting(v) },
        { label: "Tier", value: "tier", format: (v) => formatCount(v) },
      ],
      rows,
    },
    height: C.marginTop + C.marginBottom + N_UNITS * C.rowPx,
    marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft: C.marginLeft, marginRight: C.marginRight,
    x: { domain: [lo, hi], ticks: Array.from(C.ticks), label: T.leagueAxis, labelAnchor: "center", labelArrow: "none" },
    y: { domain: [N_UNITS - C.half, -C.half], axis: null },
    color: { type: "identity" },
    marks: (c, P) => {
      const fills = gradeColors(t.G, c);
      return [
        P.rect(bands, { x1: () => lo, x2: () => hi, y1: (d) => d.first - C.half, y2: (d) => d.last + C.half, fill: (d) => fills[d.tier - 1], fillOpacity: (d) => tint(d.tier) }),
        P.ruleY(bands.slice(1), { y: (d) => d.first - C.half, stroke: c.plotAxis, strokeDasharray: C.dash }),
        P.ruleX([0], { stroke: c.plotGrid }),
        P.ruleY(rows, { y: "pos", x1: "lo", x2: "hi", stroke: c.plotMuted, strokeWidth: C.line }),
        P.ruleX(rows, { x: "est", y1: (d) => d.pos - C.tickHalf, y2: (d) => d.pos + C.tickHalf, stroke: c.est, strokeWidth: C.tick }),
        numText(bands, { x: () => lo, y: "at", value: "tier", format: (v) => formatCount(v), dx: -C.gradeDx, textAnchor: "end", fill: c.plotFg, fontWeight: "bold" }),
        P.tip(rows, P.pointerY({ x: "est", y: "pos", title: (d) => tipText(d) })),
      ];
    },
    keyboard: { data: rows, x: "est", y: "pos", key: (d) => d.id, sort: false, label: T.leagueKeys, title: (d) => tipText(d) },
  });
  leagueNote.replaceChildren(...fill(T.leagueNote, { one: () => count(1), se: () => setting(CONFIG.seWidth) }));
}


// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    layout: "result-first",
    keys: {
      G: { type: "integer", min: CONFIG.G.min, max: CONFIG.G.max, step: CONFIG.G.step, value: CONFIG.G.value },
      tau: { type: "number", min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: CONFIG.tau.value },
      outline: { type: "boolean", value: CONFIG.outline.value },
    },
    build(ctx) {
      const { h } = ctx;
      const T = CONFIG.text;
      const hatchId = uid("prx-ft-hatch");
      const cache = new Map();
      const tiers = (G) => {
        if (!cache.has(G)) cache.set(G, tiersOf(G));
        return cache.get(G);
      };

      // helpers: a read-out number with its hook; counts and settings as data-num nodes
      const ro = (name, raw, display) => {
        const n = ctx.num(raw, display);
        n.setAttribute("data-prx-readout", name);
        return n;
      };
      const count = (v) => ctx.num(v, formatCount(v));
      const setting = (v) => ctx.num(v, formatSetting(v));

      // --- controls
      const gHint = T.sliderGHint.split(/\b(1)\b/).map((part) => part === "1" ? count(1) : part);
      const sliderG = ctx.slider({
        label: T.sliderG, min: CONFIG.G.min, max: CONFIG.G.max, step: CONFIG.G.step, value: ctx.state.G,
        name: "G", hint: gHint, format: (v) => formatCount(v), onInput: (v) => ctx.set({ G: v }),
      });
      const sliderTau = ctx.slider({
        label: T.sliderTau, min: CONFIG.tau.min, max: CONFIG.tau.max, step: CONFIG.tau.step, value: ctx.state.tau,
        name: "tau", hint: T.sliderTauHint, onInput: (v) => ctx.set({ tau: v }),
      });
      const outline = ctx.toggle({ label: T.outline, checked: ctx.state.outline, name: "outline", onChange: (b) => ctx.set({ outline: b }) });
      ctx.controls.append(ctx.primaryControl(sliderG.root), sliderTau.root, outline.root);

      // --- panels
      const leagueSlot = ctx.primaryGraphic(h("div", { class: "prx-ft-league-chart" }));
      const leagueNote = h("p", { class: "prx-ft-note", "data-prx-part": "notes" });
      const leagueBox = h("section", { class: "prx-ft-box prx-light-panel prx-ft-league", "aria-label": T.leagueHeading },
        ctx.panelTitle(T.leagueHeading, { className: "prx-ft-heading" }), leagueSlot, leagueNote, sliderG.root.querySelector(".prx-hint"));
      const mapSlot = h("div", { class: "prx-ft-map-chart" });
      const mapLegend = h("div", { class: "prx-ft-legend", "data-prx-part": "legend" });
      const mapBox = h("section", { class: "prx-ft-box prx-light-panel prx-ft-map", "aria-label": T.mapHeading },
        ctx.panelTitle(T.mapHeading, { className: "prx-ft-heading" }), mapSlot, mapLegend);

      const disclosureView = createTierDisclosure(ctx);
      const disclosureBox = disclosureView.root;
      const drawDisclosure = disclosureView.draw;

      const tiles = h("div", { class: "prx-ft-tiles", "data-prx-part": "readout" });
      const enLine = h("p", { class: "prx-ft-line", "data-prx-part": "readout" });
      const overLine = h("p", { class: "prx-ft-line", "data-prx-part": "readout" });
      const captionLine = h("p", { class: "prx-ft-note", "data-prx-part": "caption" });
      const errorsBox = h("section", { class: "prx-ft-box prx-ft-errors", "aria-label": T.errorsHeading },
        ctx.panelTitle(T.errorsHeading, { className: "prx-ft-heading" }), tiles, enLine, overLine, captionLine, sliderTau.root.querySelector(".prx-hint"));

      // The frame places the live readout above the linked league and pair map.
      ctx.charts.append(
        h("div", { class: "prx-ft-grid" }, leagueBox, mapBox),
        h("div", { class: "prx-ft-grid" }, disclosureBox, errorsBox),
      );
      ctx.caption.replaceChildren(...fill(T.note, {
        n: () => count(N_UNITS),
        seed: () => ctx.num(LEAGUE_SEED, String(LEAGUE_SEED)),
        fixed: () => captionNode(ctx, "fixed-tiers"),
        teaching: () => captionNode(ctx, "teaching-posterior"),
        pm: () => setting(CONFIG.prior.mean),
        psd: () => setting(CONFIG.prior.sd),
      }));

      // --------------------------------------------------------------------------------------- drawing

      const drawLeague = (t) => drawTierLeague(ctx, { slot: leagueSlot, note: leagueNote }, t);

      function drawMap(state, t, over, counts) {
        const relation = relations(t.grade);
        const Mx = CONFIG.matrix;
        const cols = N_UNITS - 1;
        const avail = mapSlot.clientWidth || Math.min(ctx.width(), Mx.maxCell * cols + Mx.marginLeft + Mx.marginRight);
        const cell = Math.max(Mx.minCell, Math.min(Mx.maxCell, Math.floor((avail - Mx.marginLeft - Mx.marginRight) / cols)));
        const width = Mx.marginLeft + Mx.marginRight + cols * cell;
        const height = Mx.marginTop + Mx.marginBottom + cols * cell;
        mapSlot.style.maxWidth = `${width}px`;
        const cells = [];
        for (let p = 0; p < N_UNITS; p += 1) {
          for (let r = p + 1; r < N_UNITS; r += 1) {
            const i = ORDER[p];
            const j = ORDER[r];
            const stated = relation[i][j] !== 0;
            // the row unit has the larger estimate, so a stated pair puts it above the column unit
            cells.push({
              row: p, col: r, i, j, a: IDS[i], b: IDS[j], ta: t.grade[i], tb: t.grade[j], stated,
              error: stated ? E0[i][j] : null, over: state.outline && stated && over.has(`${i},${j}`),
            });
          }
        }
        const statement = (d) => (d.stated
          ? `${d.a} (tier ${formatCount(d.ta)}) stated above ${d.b} (tier ${formatCount(d.tb)}); the stated direction is wrong with probability ${formatProb(d.error)}${d.over ? ", above τ" : ""}`
          : `${d.a} and ${d.b} share tier ${formatCount(d.ta)}: the pair is withheld`);
        plot(mapSlot, {
          alt: T.mapAlt,
          table: {
            caption: T.mapTable,
            columns: [
              { label: "Higher unit", value: "a" },
              { label: "Its tier", value: "ta", format: (v) => formatCount(v) },
              { label: "Lower unit", value: "b" },
              { label: "Its tier", value: "tb", format: (v) => formatCount(v) },
              { label: "Tier report", value: (d) => (d.stated ? "stated" : "withheld") },
              { label: "Error of the stated direction", value: (d) => (d.stated ? d.error : null), format: (v) => (v === null ? "none (withheld)" : formatProb(v)) },
            ],
            rows: cells,
          },
          width, height,
          marginTop: Mx.marginTop, marginLeft: Mx.marginLeft, marginRight: Mx.marginRight, marginBottom: Mx.marginBottom,
          x: { domain: Array.from({ length: cols }, (_, k) => k + 1), padding: 0, axis: null },
          y: { domain: Array.from({ length: cols }, (_, k) => k), padding: 0, axis: null },
          color: { type: "identity" },
          marks: (c, P) => {
            const hatch = () => {
              const defs = ctx.doc.createElementNS(SVGNS, "defs");
              const pat = ctx.doc.createElementNS(SVGNS, "pattern");
              for (const [k, v] of Object.entries({ id: hatchId, patternUnits: "userSpaceOnUse", width: Mx.hatchSpacing, height: Mx.hatchSpacing, patternTransform: "rotate(45)" })) pat.setAttribute(k, String(v));
              const line = ctx.doc.createElementNS(SVGNS, "line");
              for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: Mx.hatchSpacing, stroke: c.hatch, "stroke-width": Mx.hatchWidth })) line.setAttribute(k, String(v));
              pat.append(line);
              defs.append(pat);
              return defs;
            };
            const withheld = cells.filter((d) => !d.stated);
            let first = 0;
            const tri = [];
            for (const size of t.disc.sizes) {
              if (size >= Mx.minLabelSize) tri.push({ col: first + 1, row: first + size - 2, pairs: pairCount(size) });
              first += size;
            }
            return [
              P.cell(cells, { x: "col", y: "row", fill: (d) => (d.stated ? c.relAbove : c.relWithheld), inset: Mx.inset }),
              hatch,
              P.cell(withheld, { x: "col", y: "row", fill: `url(#${hatchId})`, stroke: c.cellBorder, strokeWidth: Mx.border, inset: Mx.inset }),
              P.dot(cells.filter((d) => d.over), { x: "col", y: "row", r: Math.max(1, cell * Mx.dotShare), fill: labelOn(c.relAbove, c) }),
              // the withheld count of each tier beside its triangle, in the blank half below the diagonal (after the
              // prediction: the counts add up to the answer)
              counts ? numText(tri, { x: "col", y: "row", value: "pairs", format: (v) => formatCount(v), dx: -Mx.labelDx, textAnchor: "end", fill: c.plotFg }) : null,
              P.tip(cells, P.pointer({ x: "col", y: "row", title: (d) => statement(d) })),
            ];
          },
          keyboard: { data: cells, x: "col", y: "row", key: (d) => `${d.a}-${d.b}`, sort: false, label: T.mapKeys, title: (d) => `Row ${d.a}, column ${d.b}: ${statement(d)}.` },
        });
        const key = (swatch, content) => h("span", { class: "prx-ft-key" }, h("span", { class: `prx-ft-swatch ${swatch}` }), h("span", {}, ...[].concat(content)));
        const items = [
          h("span", { class: "prx-ft-legend-title", text: `${T.mapRowAxis}; ${T.mapAxis}.` }),
          key("prx-ft-swatch-stated", T.relStated),
          key("prx-ft-swatch-hatch", T.relWithheld),
        ];
        if (state.outline) items.push(key("prx-ft-swatch-outline", [`${T.outlineLegend} `, setting(state.tau)]));
        if (counts && t.disc.sizes.some((n) => n >= Mx.minLabelSize)) items.push(h("span", { class: "prx-ft-legend-note", text: T.countLegend }));
        mapLegend.replaceChildren(...items);
      }


      function tile(name, value) {
        return h("div", { class: "prx-ft-tile" }, h("span", { class: "prx-ft-tile-name", text: name }), h("span", { class: "prx-ft-tile-value" }, ...value));
      }

      function drawErrors(state, t, ev, sa) {
        const en = ev.EoverN[0];
        tiles.replaceChildren(
          tile(T.tileE, [ro("E", ev.Ew, formatExpectedCount(ev.Ew))]),
          tile(T.tileEN, [ro("EoverN", en, formatShare(en))]),
          tile(T.tileTau, [ro("tau", state.tau, formatSetting(state.tau))]),
          tile(T.tileRisk, [ro("risk", ev.risk, formatRisk(ev.risk))]),
        );
        const allW = evaluateReport(ALL_WITHHELD, ERRORS, { tau: state.tau });
        const ref = [" The all-withheld report has risk ", ro("allWithheld", allW.risk, formatRisk(allW.risk)), "."];
        if (en === null) enLine.replaceChildren(T.enNone, ...ref);
        else {
          // CR-026: compare on the risk scale at the shared equal-risk tolerance.
          const diff = (ev.Ew - state.tau * ev.N) / ev.M;
          enLine.replaceChildren(diff > 1e-12 ? T.enAbove : diff < -1e-12 ? T.enBelow : T.enEqual, ...ref);
        }
        if (!state.outline) overLine.replaceChildren(T.overOff);
        else if (ev.N === 0) overLine.replaceChildren(T.overNone);
        else {
          overLine.replaceChildren(...fill(T.overLine, {
            over: () => ro("over", sa.count, formatCount(sa.count)), N: () => count(ev.N),
            max: () => ro("maxStated", sa.max, formatProb(sa.max)),
          }));
        }
        captionLine.replaceChildren("Tier report: ", captionNode(ctx, "fixed-tiers"), "; risks are compared with the all-withheld report at this τ only.");
      }

      function drawReadout(state, t, ev, sa) {
        const d = t.disc;
        const en = ev.EoverN[0];
        const parts = fill(T.readout, {
          G: () => count(t.G), sizes: () => ro("readout-sizes", d.sizes, formatSizes(d.sizes, { label: false })),
          N: () => count(d.N), M: () => count(d.M), s: () => ctx.num(d.s, formatShare(d.s)), tau: () => setting(state.tau),
          E: () => ctx.num(ev.Ew, formatExpectedCount(ev.Ew)), EN: () => ctx.num(en, formatShare(en)), risk: () => ctx.num(ev.risk, formatRisk(ev.risk)),
        });
        if (state.outline && ev.N > 0) {
          parts.push(" ", ro("readout-over", sa.count, formatCount(sa.count)),
            " stated pairs have error above τ. The largest stated error is ", ro("readout-maxStated", sa.max, formatProb(sa.max)), ".");
        }
        ctx.readout.set(parts);
      }

      return {
        render(state, info = {}) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            sliderG.set(state.G);
            sliderTau.set(state.tau);
            outline.set(state.outline);
            const t = tiers(state.G);
            const ev = evaluateReport(t.grade, ERRORS, { tau: state.tau });
            const sa = statedAbove(t.grade, ERRORS, { tau: state.tau });
            const over = new Set(sa.pairs.map((p) => `${p.i},${p.j}`));
            drawReadout(state, t, ev, sa);
            // the league and the disclosure depend on G only: a τ or mark update leaves them as they are
            const gOnly = info.reason === "update" && !(info.changed ?? []).includes("G");
            if (!gOnly) {
              drawLeague(t);
              drawDisclosure(t);
            }
            drawMap(state, t, over, true);
            drawErrors(state, t, ev, sa);
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
