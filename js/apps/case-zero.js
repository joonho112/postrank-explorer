// case-zero (app 1.1): "A league table and a report card" (Frame v2).
// Kline, Rose and Walters' 97 firms (data/released/case-krw.json, license cc-by-nc-krw) shown two ways:
//   toolbar   primary Target switch (Race / Gender), wrapping preset chips, and Settings (table order, firm picker, search)
//   readout   concise 3-sig-fig comparison of all 4,656 firm pairs in a strict league table vs. KRW's posterior report card
//   stage     pairwise claim breakdown bar chart (league table vs. report card) paired with a row-spaced 97-firm report-card
//             grade-band figure (17px rounded grade badge pills) and 1-line selected-firm inspection strip
//   data      exact pair counts, selected-firm pair breakdown, and complete 97-firm league & report-card comparison table
//   method    grade-1 definition, interval/prior notes, KRW card source caption, band swatches, and scale notes
//
// Preserved exports: CONFIG, readCase, niceAxis, cardView, bandRows, mountWidget.

import { mobileControls } from "../shared/mobile-controls.js";
import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, placeDirectLabels, plot } from "../shared/chart.js";
import { partBar } from "../shared/partbar.js";
import {
  formatCount,
  formatDecimal,
  formatPercent,
  formatReadoutEst,
  formatShare,
  formatSizes,
  setNum,
  tickLabel,
} from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  canonicalGrade,
  disclosure,
  evaluateReport,
  normalCdf,
  pairCount,
  reportCardRows,
  statedAbove,
  statedAgainst,
  strictOrder,
  unitRelationCounts,
} from "../pr-core.js";
import KRW from "../../data/released/case-krw.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "case-zero",
  label: "KRW's firms in a league table beside a report card KRW published",
  className: "prx-cz",
  firstFirm: "first",
  defaults: Object.freeze({ card: "race", sort: "estimate", firm: "first", rows: "ends" }),
  cards: Object.freeze({
    race: Object.freeze({
      label: "Race card", shortLabel: "Race", title: "KRW's race card", table: "Race league table", grade: "race_card",
      estimate: "race_estimate", se: "race_se", mean: "mean_race", lower: "lower_race", upper: "upper_race",
      grade1: "Grade 1 = stated highest on white-name contact advantage, as the posterior judges it.",
      axis: "Log contact gap, white-named minus Black-named",
      short: "Log contact gap",
      scale: "Both panels show the log contact gap: the log of the contact rate of white-named applications minus that of Black-named ones. Above zero, white-named applications were contacted more often.",
      prior: "KRW's race prior puts all its weight on positive gaps, so every race posterior lies above zero, even for a firm with a negative estimate.",
      figure: "KRW's Figure 7 caption says ",
      figureName: "Figure 7",
      star: "Grade 1 is KRW's ★ (one star), which KRW call the worst grade.",
    }),
    gender: Object.freeze({
      label: "Gender card", shortLabel: "Gender", title: "KRW's gender card", table: "Gender league table", grade: "gender_card",
      estimate: "gender_estimate", se: "gender_se", mean: "mean_gender", lower: "lower_gender", upper: "upper_gender",
      grade1: "Grade 1 = stated highest on male-name contact advantage, as the posterior judges it.",
      axis: "Log contact gap, male-named minus female-named",
      short: "Log contact gap",
      scale: "Both panels show the log contact gap: the log of the contact rate of male-named applications minus that of female-named ones. Above zero, male-named applications were contacted more often; below zero, female-named ones.",
      figure: "KRW's Figure 14 caption says ",
      figureName: "Figure 14",
    }),
  }),
  cardOrder: Object.freeze(["race", "gender"]),
  sorts: Object.freeze([
    Object.freeze({ value: "estimate", label: "Estimate" }),
    Object.freeze({ value: "mean", label: "Posterior mean" }),
  ]),
  rowModes: Object.freeze(["ends", "all"]),
  seWidth: 1,
  krwLevel: 0.95,
  cardTau: 0.2,
  doubtfulTau: 0.5,
  digits: Object.freeze({ value: 3 }),
  nice: Object.freeze({ ticks: 4, mantissas: Object.freeze([1, 2, 2.5, 5, 10]), decimals: 12 }),
  percent: 100,
  pageRows: 10,
  showRows: 10,
  pairParts: Object.freeze(["agree", "against", "silent"]),
  revNames: 3,
  chart: Object.freeze({
    rowPx: 12, narrowRowPx: 14, marginTop: 48, marginBottom: 38, marginLeft: 36, marginRight: 14,
    stripePx: 24, line: 1.5, dot: 2.3, tints: Object.freeze([0.22, 0.08]), dash: "4,3", half: 0.5, labelPx: 12,
  }),
  text: Object.freeze({
    missing: "The KRW data did not load, so this app cannot show the firms.",
    targetLabel: "Target",
    cardLegend: "Card",
    sortLegend: "Order the league table by",
    firmSelectLabel: "Selected firm",
    findLabel: "Find a firm",
    findHint: "Type part of a name; press Enter for the next match.",
    tableHeading: "League table",
    dataTitle: "Data and 97-firm comparison",
    methodTitle: "Method and details",
    scrollHint: "The table scrolls sideways: more columns sit to the right of the firm names.",
    barNote: Object.freeze(["Bars: estimate ± ", "{se}", " SE (such a bar covers the true value in about ", "{within}", " of repeated estimates)."]),
    orderNote: Object.freeze({ estimate: "Ordered by estimate, largest first.", mean: "Ordered by posterior mean, largest first." }),
    caption: Object.freeze(["{table}", " of the ", "{n}", " firms. Each row gives the rank in this order, the firm, its grade on the card, its estimate and SE (the bar repeats them), its posterior mean, its rank in the other order and its industry code. ↕ after a grade marks a firm whose pair with the selected firm the card states the other way."]),
    colRank: "Rank",
    colRankBy: Object.freeze({ estimate: "by estimate", mean: "by posterior mean" }),
    colOther: Object.freeze({ estimate: "Rank by posterior mean", mean: "Rank by estimate" }),
    colFirm: "Firm",
    colEstimate: Object.freeze(["Estimate ± ", "{se}", " SE"]),
    colMean: "Posterior mean",
    colGrade: "Card grade",
    colIndustry: "Industry code",
    krwGloss: "KRW published these baseline grades. Their code and posterior probabilities determine the grades shown here.",
    showAll: "Show all firms",
    showEnds: "Show the top ten and the bottom ten only",
    gap: Object.freeze(["{count}", " firms in the middle are not shown."]),
    revHidden: Object.freeze([" (", "{count}", " in the rows not shown)"]),
    cardNote: Object.freeze(["Dots: posterior means. Lines: ", "{level}", " posterior intervals (KRW's ", "{figure}", " shows ", "{krwLevel}", " intervals); within a grade, firms by posterior mean."]),
    bandsNote: "Shaded bands: the grades, grade 1 at the top.",
    pairsTitle: Object.freeze(["All ", "{total}", " pairs of firms · ", "{card}"]),
    pairWords: Object.freeze({ agree: " stated as the table does", against: " stated the other way", silent: " silent (same grade)" }),
    revPairsLead: ": the card puts ",
    revPairAbove: " above ",
    revPairSep: "; ",
    firmPairsTitle: Object.freeze(["Its ", "{total}", " pairs"]),
    firmWords: Object.freeze({ agree: " as the table does", against: " the other way", silent: " silent" }),
    revNamed: ": ",
    revMarked: ", marked ↕",
    revMany: ", marked ↕ in the table",
    revMark: "↕",
    revMarkSr: "the card states its pair with the selected firm the other way",
    gradesWord: " grades, ",
    firm: " firm",
    firms: " firms",
    cardKeys: "Firms on the card, in grade order. Use the arrow keys to read each firm.",
    cardTable: "Grade, posterior mean and posterior interval of each firm, in the card's order",
    colLower: "Interval, lower end",
    colUpper: "Interval, upper end",
    intervalNote: Object.freeze(["Posterior means and central ", "{level}", " intervals come from a smoothed version of KRW's posteriors (continuous cells with central intervals in place of KRW's posterior grids; the pr_case_krw data); ", "{figure}", "{krwLevel}", "."]),
    scaleNote: "The two panels use different horizontal scales. Industry codes are the two-digit industry codes in KRW's data.",
    detailsHeading: "Selected firm",
    industry: "industry code ",
    rank: Object.freeze(["{table}", ": rank ", "{rankEst}", " of ", "{n}", " by estimate (", "{est}", " ± ", "{se}", "); rank ", "{rankMean}", " by posterior mean (", "{mean}", ")."]),
    gradeOf: Object.freeze([": grade ", "{grade}", " of ", "{G}", ", ", "{others}", "; ", "{level}", " posterior interval ", "{lower}", " to ", "{upper}", "."]),
    alone: "alone in its grade",
    withOne: " other firm in that grade",
    withMany: " other firms in that grade",
    pairsA: "The league table states a direction between this firm and each of the other ",
    pairsB: " firms. ",
    pairsC: " states a direction for ",
    pairsD: " of these pairs",
    pairsSilent: ", and is silent on the ",
    pairsSilentOne: " firm that shares its grade.",
    pairsSilentMany: " firms that share its grade.",
    pairsNone: ", and is silent on none of them.",
    agreeA: " as the table does and ",
    againstA: " the other way",
    allAgree: "all as the table does",
    allAgainst: "all the other way",
    noMatch: "No firm name contains this text.",
    match: Object.freeze(["{count}", " firms match; showing match ", "{k}", ". Press Enter for the next."]),
    insideLead: "Withheld within-grade pairs: ",
    readInside: " inside grade ",
    readAnd: " and ",
    readEnd: ".",
    readOrderA: " Of the ",
    readOrderB: " directions the card states, ",
    readOrderC: " run as the table does and ",
    readOrderD: " the other way.",
    readOrderAll: Object.freeze([" All ", " directions the card states run as the table does."]),
    readOrderNone: Object.freeze([" All ", " directions the card states run the other way."]),
    notice: "Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700, and deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; as adapted in postrank 1.1.0 (pr_case_krw), changes noted; no endorsement by the authors is implied.",
    noticeConduct: "The data describe KRW's correspondence experiment, not any firm's current conduct.",
    noticeChanges: "Changes: a smoothed version of KRW's posteriors (continuous cells with central intervals in place of KRW's posterior grids), from postrank 1.1.0 (pr_case_krw); KRW's published cards as released.",
    noticeAsIs: "Provided as is, without warranty.",
  }),
});

const T = CONFIG.text;
const cssString = (s) => `"${String(s).replace(/["\\]/g, "\\$&")}"`;
const roundNice = (x) => Number(x.toFixed(CONFIG.nice.decimals));
const pct = (v, total) => `${(v / total) * CONFIG.percent}%`;

// ---------------------------------------------------------------------------------------------- data

/** The released KRW case (data/released/case-krw.json), or null when its tables are missing. */
export function readCase(d = KRW) {
  const u = d?.tables?.units;
  if (!u || !Array.isArray(u.id) || !d.tables.reports) return null;
  const ids = u.id.map((x) => String(x));
  return {
    n: u.id.length,
    ids,
    idIndex: new Map(ids.map((id, i) => [id, i])),
    names: u.firm_name.slice(),
    industry: u.industry.slice(),
    units: u,
    reports: d.tables.reports,
    error: d.arrays?.error ?? null,
    level: d.facts?.interval_level,
  };
}

const DATA = readCase(KRW);

/** The firm key: "first", a firm id of the data, or a firm name (any case); anything else is not a firm. */
function parseFirm(v) {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  if (s === CONFIG.firstFirm) return s;
  if (!DATA) return undefined;
  if (DATA.idIndex.has(s)) return s;
  const low = s.toLowerCase();
  const i = DATA.names.findIndex((name) => name.toLowerCase() === low);
  return i >= 0 ? DATA.ids[i] : undefined;
}

/** A "nice" axis over [lo, hi] that also holds 0: { lo, hi, ticks }. */
export function niceAxis(lo, hi) {
  const a = Math.min(lo, 0);
  const b = Math.max(hi, 0);
  const span = b - a > 0 ? b - a : 1;
  const raw = span / CONFIG.nice.ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = (CONFIG.nice.mantissas.find((m) => m * p >= raw) ?? CONFIG.nice.mantissas.at(-1)) * p;
  const start = roundNice(Math.floor(a / step) * step);
  const end = roundNice(Math.ceil(b / step) * step);
  const ticks = [];
  for (let k = 0; roundNice(start + k * step) <= end; k += 1) ticks.push(roundNice(start + k * step));
  return { lo: start, hi: end, ticks };
}

/** Everything one card needs: values, ranks, card order, counts, and posterior pair-error summaries. */
export function cardView(D, key) {
  const c = CONFIG.cards[key];
  const u = D.units;
  const est = u[c.estimate].slice();
  const se = u[c.se].slice();
  const mean = u[c.mean].slice();
  const lower = u[c.lower].slice();
  const upper = u[c.upper].slice();
  const grade = canonicalGrade(D.reports[c.grade]);
  const disc = disclosure(grade);
  const rankEst = strictOrder(est);
  const rankMean = strictOrder(mean);
  const byRank = (r) => Array.from(r, (_, i) => i).sort((a, b) => r[a] - r[b]);
  const order = Array.from(reportCardRows(grade, { ids: D.ids, mean }, "mean"));
  const pos = new Array(D.n);
  order.forEach((i, k) => { pos[i] = k; });
  const rel = unitRelationCounts(grade);
  const againstOrder = (rank) => {
    const r = statedAgainst(grade, Array.from(rank), { direction: "ascending" });
    const per = new Array(D.n).fill(0);
    const firms = Array.from({ length: D.n }, () => []);
    for (const p of r.pairs) {
      per[p.above] += 1; per[p.below] += 1;
      firms[p.above].push(p.below); firms[p.below].push(p.above);
    }
    return { count: r.count, pairs: r.pairs, per, firms };
  };
  const target = `${key}_signed`;
  const errIdx = D.error?.criteria?.indexOf?.(target) ?? -1;
  const errArr = errIdx >= 0 ? { ids: D.error.ids, criteria: [target], e: [D.error.e[errIdx]] } : null;
  const evalOf = (rep) => {
    if (!errArr) return null;
    const ev = evaluateReport(rep, errArr, { tau: CONFIG.cardTau });
    const doubtful = statedAbove(rep, errArr, { tau: CONFIG.doubtfulTau });
    return { E: ev.E[0], EoverN: ev.EoverN[0], doubtful: doubtful.count };
  };
  const w = CONFIG.seWidth;
  return {
    key, card: c, est, se, mean, lower, upper, grade, disc, rankEst, rankMean, order, pos,
    stated: rel.stated, withheld: rel.withheld, partners: rel.partners,
    against: { estimate: againstOrder(rankEst), mean: againstOrder(rankMean) },
    inside: Array.from(disc.sizes, (s) => pairCount(s)),
    rows: { estimate: byRank(rankEst), mean: byRank(rankMean) },
    estAxis: niceAxis(Math.min(...est.map((x, i) => x - w * se[i])), Math.max(...est.map((x, i) => x + w * se[i]))),
    cardAxis: niceAxis(Math.min(...lower), Math.max(...upper)),
    cardEval: evalOf(grade),
    tableEval: { estimate: evalOf(Array.from(rankEst)), mean: evalOf(Array.from(rankMean)) },
  };
}

/** The grade bands of a card in row positions: { grade, first, last, mid, at }. */
export function bandRows(sizes, gap) {
  let first = 0;
  const out = Array.from(sizes, (size, k) => {
    const b = { grade: k + 1, first, last: first + size - 1, mid: first + (size - 1) / 2 };
    first += size;
    return b;
  });
  out.forEach((b, k) => { b.at = k ? Math.max(b.mid, out[k - 1].at + gap) : b.mid; });
  return out;
}

const tintOf = (g) => CONFIG.chart.tints[(g - 1) % CONFIG.chart.tints.length];

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `
.prx-cz .prx-cz-settings { display: flex; flex-wrap: wrap; gap: 0.65rem 1.25rem; align-items: flex-start; width: 100%; }
.prx-cz .prx-cz-firm-pick { flex: 1 1 13rem; max-width: 20rem; }
.prx-cz .prx-cz-firm-pick select { width: 100%; }
.prx-cz .prx-cz-find { flex: 1 1 13rem; max-width: 20rem; }
.prx-cz .prx-cz-find input { width: 100%; }
.prx-cz .prx-cz-find-status { flex: 1 1 100%; margin: 0; }

.prx-cz .prx-cz-heading { margin: 0; font-size: 0.95em; font-weight: 600; line-height: 1.3; color: var(--prx-fg-heading); }
.prx-cz .prx-cz-note { margin: 0 0 0.35rem; font-size: 0.9em; color: var(--prx-fg-muted); }
.prx-cz .prx-cz-scroll-hint { margin: 0 0 0.35rem; }
.prx-cz .prx-cz-grade1 { font-weight: 600; color: var(--prx-fg); }
.prx-cz .prx-cz-notice { margin: 0.5rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); overflow-wrap: anywhere; }
.prx-cz .prx-cz-notice strong { font-weight: 600; color: var(--prx-fg); }
.prx-cz .prx-cz-missing { margin: 0; padding: 0.75rem; border: 1px dashed var(--prx-border-strong); border-radius: var(--prx-radius, 6px); }

/* Stage: pairwise comparison chart + compact key + 97-firm report card + 1-line selected-firm strip */
.prx-cz .prx-stage .prx-cz-pair-chart,
.prx-cz .prx-stage .prx-cz-card-chart { min-width: 0; max-width: 100%; }
.prx-cz .prx-stage .prx-cz-pair-key {
  display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; align-items: center;
  margin: 0.15rem 0 0.55rem; padding: 0 0 0.45rem; list-style: none;
  font-size: 0.84rem; line-height: 1.35; color: var(--prx-plot-fg);
  background: transparent; border: 0; border-bottom: 1px solid var(--prx-border); border-radius: 0;
}
.prx-cz .prx-stage .prx-cz-pair-key > li { display: inline-flex; gap: 0.35rem; align-items: center; margin: 0; }
.prx-cz .prx-stage .prx-cz-pair-key .prx-partbar-sw { flex: none; margin-right: 0; }
.prx-cz .prx-stage .prx-cz-pair-key > li.prx-cz-pair-doubtful { display: inline; overflow-wrap: break-word; color: var(--prx-plot-muted); }
.prx-cz .prx-stage .prx-cz-card-head {
  display: flex; flex-wrap: wrap; gap: 0.2rem 0.65rem; align-items: baseline; justify-content: space-between;
  margin: 0 0 0.2rem; color: var(--prx-plot-fg);
}
.prx-cz .prx-stage .prx-cz-card-guide { margin: 0 0 0.3rem; color: var(--prx-plot-muted); font-size: 0.85rem; }
.prx-cz .prx-cz-card-chart .prx-kbd-point { scroll-margin-block: 6rem 2rem; }
.prx-cz .prx-stage .prx-cz-card-head .prx-cz-heading { color: var(--prx-plot-fg); }
.prx-cz .prx-stage .prx-cz-card-sizes { margin: 0; font-size: 0.85rem; color: var(--prx-plot-muted); }
.prx-cz .prx-stage .prx-cz-inspect {
  margin: 0.4rem 0 0; padding: 0.35rem 0 0; border-top: 1px solid var(--prx-border);
  font-size: 0.86rem; line-height: 1.4; font-variant-numeric: tabular-nums;
  color: var(--prx-plot-muted); overflow-wrap: break-word;
}
.prx-cz .prx-stage .prx-cz-inspect strong { color: var(--prx-plot-fg); font-weight: 600; }

/* Disclosures: Data & Method */
.prx-cz .prx-cz-data-stack,
.prx-cz .prx-cz-method-stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.65rem; }
.prx-cz .prx-cz-data-stack > *,
.prx-cz .prx-cz-method-stack > * { min-width: 0; margin: 0; }
.prx-cz .prx-cz-details {
  padding: 0.45rem 0.75rem 0.5rem; background: var(--prx-bg); border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px); font-variant-numeric: tabular-nums;
}
.prx-cz .prx-cz-details-head { display: flex; flex-wrap: wrap; gap: 0.1rem 0.6rem; align-items: baseline; }
.prx-cz .prx-cz-details-name, .prx-cz .prx-cz-details-line { margin: 0.2rem 0 0; }
.prx-cz .prx-cz-details-head .prx-cz-details-name { margin: 0; }
.prx-cz .prx-cz-details .prx-partbar { margin: 0.3rem 0 0.15rem; }
.prx-cz .prx-cz-league-head { display: flex; flex-wrap: wrap; gap: 0.2rem 0.75rem; align-items: baseline; margin: 0 0 0.3rem; }
.prx-cz .prx-cz-league-head > * { margin: 0; }

/* 97-firm comparison table inside Data disclosure */
.prx-cz .prx-cz-table-box {
  position: relative; max-width: 100%; max-height: 28rem; overflow: auto; background: var(--prx-bg);
  border: 1px solid var(--prx-border-strong); border-radius: var(--prx-radius, 6px);
}
.prx-cz .prx-cz-table {
  width: 100%; min-width: 38rem; max-width: none; margin: 0; border-collapse: separate; border-spacing: 0;
  font-size: 0.875em; font-variant-numeric: tabular-nums; overflow-wrap: normal;
  --prx-sticky-first-width: 3.75rem;
}
.prx-cz .prx-cz-table th, .prx-cz .prx-cz-table td {
  padding: 0.2rem 0.45rem; text-align: left; vertical-align: middle; white-space: nowrap; background: var(--prx-bg);
  border-bottom: 1px solid var(--prx-border);
}
.prx-cz .prx-cz-table thead th {
  position: sticky; top: 0; z-index: 2; vertical-align: bottom; white-space: normal; font-weight: 600;
  color: var(--prx-fg-heading); background: var(--prx-bg-raised); border-bottom: 1px solid var(--prx-border-strong);
}
.prx-cz .prx-cz-table .prx-cz-col-rank { width: 3.75rem; min-width: 3.75rem; max-width: 3.75rem; white-space: normal; }
.prx-cz .prx-cz-table .prx-cz-col-firm { min-width: 8.5rem; max-width: 12rem; white-space: normal; border-right: 1px solid var(--prx-border); }
.prx-cz .prx-cz-table thead .prx-cz-col-rank, .prx-cz .prx-cz-table thead .prx-cz-col-firm { z-index: 3; }
.prx-cz .prx-cz-table tbody th { font-weight: 400; color: var(--prx-fg); cursor: pointer; }
.prx-cz .prx-cz-table tbody tr { cursor: pointer; }
.prx-cz .prx-cz-col-sub { display: block; font-size: 0.85em; font-weight: 400; color: var(--prx-fg-muted); }
.prx-cz .prx-cz-table tbody tr:hover > * { background: var(--prx-bg-raised); }
.prx-cz .prx-cz-table tbody tr.prx-cz-selected > * { background: var(--prx-bg-sunken); font-weight: 600; }
.prx-cz .prx-cz-table tbody tr.prx-cz-selected > .prx-cz-col-rank { box-shadow: inset 4px 0 0 var(--prx-accent); }
.prx-cz .prx-cz-table tbody tr.prx-cz-rev > .prx-cz-col-rank { box-shadow: inset 4px 0 0 var(--prx-rel-below); }
.prx-cz .prx-cz-table tbody tr.prx-cz-rev > .prx-cz-col-grade::after {
  content: ${cssString(T.revMark)}; content: ${cssString(T.revMark)} / ${cssString(T.revMarkSr)};
  margin-left: 0.35rem; font-weight: 700; color: var(--prx-fg);
}
.prx-cz .prx-cz-table tbody th:focus-visible { outline: var(--prx-focus-width, 2px) solid var(--prx-focus); outline-offset: calc(-1 * var(--prx-focus-width, 2px)); }
.prx-cz .prx-cz-table .prx-cz-col-other, .prx-cz .prx-cz-table .prx-cz-col-industry { color: var(--prx-fg-muted); }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap { cursor: default; }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap > td { padding: 0.35rem 0.45rem; font-style: italic; color: var(--prx-fg-muted); background: var(--prx-bg-sunken); }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap > td > span { position: sticky; left: 0.45rem; }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap:hover > * { background: var(--prx-bg-sunken); }
.prx-cz .prx-cz-table td.prx-cz-col-mean { color: var(--prx-post-text); }
.prx-cz .prx-cz-table .prx-cz-col-est { min-width: 13rem; }
.prx-cz .prx-cz-table thead .prx-cz-col-other { min-width: 6.5rem; }
.prx-cz .prx-cz-strip, .prx-cz .prx-cz-axis { position: relative; display: inline-block; width: 6.5rem; vertical-align: middle; }
.prx-cz .prx-cz-strip { height: 0.95rem; background: var(--prx-plot-bg); border: 1px solid var(--prx-plot-grid); border-radius: 2px; }
.prx-cz .prx-cz-axis { display: block; height: 1.1rem; margin-top: 0.1rem; }
.prx-cz .prx-cz-col-label { display: block; }
.prx-cz .prx-cz-tick { position: absolute; top: 0; font-size: 0.85em; font-weight: 400; color: var(--prx-fg-muted); transform: translateX(-50%); }
.prx-cz .prx-cz-zero { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--prx-plot-axis); opacity: 0.45; }
.prx-cz .prx-cz-bar { position: absolute; top: 50%; height: 2px; margin-top: -1px; background: var(--prx-est); }
.prx-cz .prx-cz-dot { position: absolute; top: 50%; width: 0.5rem; height: 0.5rem; margin: -0.25rem 0 0 -0.25rem; background: var(--prx-est); border-radius: 50%; }
.prx-cz .prx-cz-est-text { margin-left: 0.45rem; color: var(--prx-est-text); }
.prx-cz .prx-cz-badge {
  display: inline-block; min-width: 1.7em; padding: 0 0.3em; font-weight: 600; text-align: center;
  border: 1px solid var(--prx-border-strong); border-radius: 3px;
}

.prx-cz .prx-cz-bands {
  display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; align-items: center; padding: 0.25rem 0.5rem;
  font-size: 0.9em; border-radius: 4px;
}
.prx-cz .prx-cz-band { display: inline-flex; gap: 0.3rem; align-items: center; }
.prx-cz .prx-cz-swatch {
  display: inline-block; flex: none; width: 0.95rem; height: 0.95rem;
  background: color-mix(in srgb, var(--prx-cz-swatch, #153653) var(--prx-cz-mix, 20%), var(--prx-plot-bg));
  border: 1px solid var(--prx-cell-border);
}

.prx-cz .prx-cz-pair-jump { display: none; }
@media (max-width: 36em) {
  .prx-cz .prx-cz-pair-jump { display: inline-block; min-height: 44px; padding: 0; color: inherit;
    border: 0; background: transparent; font: inherit; font-size: .84rem; text-decoration: underline; cursor: pointer; }
  .prx-cz .prx-stage .prx-cz-pair-chart { scroll-margin-block-start: 5rem; }
}
@media (max-width: 30em) {
  .prx-cz.prx-widget[data-prx-frame="v2"] { padding: 0.5rem 0.6rem; }
  .prx-cz.prx-widget[data-prx-frame="v2"] > .prx-title { margin-bottom: 0.2rem; }
  .prx-cz.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.3rem 0.5rem; margin-bottom: 0.35rem; }
  .prx-cz.prx-widget[data-prx-frame="v2"] > .prx-readout { margin-bottom: 0.45rem; padding: 0.35rem 0.55rem; font-size: .9375rem; line-height: 1.35; }
  .prx-cz .prx-stage { padding: 0.5rem 0.55rem; }
  .prx-cz .prx-cz-table-box { max-height: 22rem; }
  .prx-cz .prx-cz-table { --prx-sticky-first-width: 3.5rem; }
  .prx-cz .prx-cz-table .prx-cz-col-rank { width: 3.5rem; min-width: 3.5rem; max-width: 3.5rem; padding-right: 0.3rem; padding-left: 0.3rem; }
  .prx-cz .prx-cz-table .prx-cz-col-firm { min-width: 7rem; }
}
`;

// ---------------------------------------------------------------------------------------------- app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    frame: "v2",
    keys: {
      card: { type: "choice", values: [...CONFIG.cardOrder], value: CONFIG.defaults.card },
      sort: { type: "choice", values: CONFIG.sorts.map((s) => s.value), value: CONFIG.defaults.sort },
      firm: { type: "custom", value: CONFIG.defaults.firm, parse: (v) => parseFirm(v) },
      rows: { type: "choice", values: [...CONFIG.rowModes], value: CONFIG.defaults.rows },
    },
    build(ctx) {
      const { h } = ctx;
      const D = DATA;
      if (!D) {
        ctx.stage.append(h("p", { class: "prx-cz-missing", text: T.missing }));
        return { render() {} };
      }
      const views = {};
      const view = (key) => (views[key] ??= cardView(D, key));
      const within = normalCdf(CONFIG.seWidth) - normalCdf(-CONFIG.seWidth);
      const level = D.level;

      const num = (raw, display) => ctx.num(raw, display);
      const ro = (name, raw, display) => {
        const s = ctx.num(raw, display);
        if (name) s.setAttribute("data-prx-readout", name);
        return s;
      };
      const val = (x) => formatDecimal(x, { digits: CONFIG.digits.value });
      const count = (x) => num(x, formatCount(x));
      const nameNode = (i, tag = "span") => h(tag, { "data-prx-name": "", text: D.names[i] });
      const fill = (parts, slots) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slots[m[1]]() : p; });

      let selected = null;
      let lastCard = null;
      let lastSort = null;
      let lastTheme = null;
      let expanded = false;
      let palCache = null;
      const pal = () => (palCache ??= palette(ctx.root));
      let pending = null;
      let rendering = false;
      let matches = [];
      let matchAt = 0;

      const themeKey = () => [
        ctx.root.getAttribute("data-theme"),
        ctx.doc.documentElement.getAttribute("data-theme"),
        ctx.win.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      ].join("|");
      const firmOf = (state) => (state.firm === CONFIG.firstFirm || !D.idIndex.has(state.firm)
        ? view(state.card).rows[state.sort][0] : D.idIndex.get(state.firm));
      const firmKey = (i, state) => (i === view(state.card).rows[state.sort][0] ? CONFIG.firstFirm : D.ids[i]);
      const keepFirm = (patch) => {
        const next = { ...ctx.state, ...patch };
        return selected === null ? patch : { ...patch, firm: firmKey(selected, next) };
      };

      // --- Primary control in toolbar: Target (Race / Gender)
      const cardSeg = ctx.segmented({
        label: T.targetLabel,
        name: "card",
        className: "prx-cz-cards",
        options: CONFIG.cardOrder.map((k) => ({
          value: k,
          label: CONFIG.cards[k].shortLabel,
          title: CONFIG.cards[k].label,
        })),
        value: ctx.state.card,
        onChange: (v) => { if (v !== ctx.state.card) ctx.set(keepFirm({ card: v })); },
      });
      ctx.controls.append(ctx.primaryControl(cardSeg.root));

      // --- Secondary controls in Settings: league ordering, firm dropdown picker, and firm search
      const settings = ctx.settingsBox();
      const sortSeg = ctx.radioGroup({
        legend: T.sortLegend,
        name: "sort",
        className: "prx-cz-sorts",
        options: CONFIG.sorts.map((s) => ({ value: s.value, label: s.label })),
        value: ctx.state.sort,
        onChange: (v) => { if (v !== ctx.state.sort) ctx.set(keepFirm({ sort: v })); },
      });
      const firmPick = ctx.select({
        label: T.firmSelectLabel,
        name: "firm-pick",
        className: "prx-cz-firm-pick",
        options: D.ids.map((id, i) => ({ value: id, label: D.names[i] })),
        value: D.ids[firmOf(ctx.state)],
        onChange: (id) => {
          if (D.idIndex.has(id)) choose(D.idIndex.get(id), { scroll: true });
        },
      });
      const listId = uid("prx-cz-firms");
      const hintId = uid("prx-cz-find-hint");
      const find = ctx.numberInput({ label: T.findLabel, type: "text", name: "find", onInput: (q) => findFirm(q) });
      find.input.setAttribute("list", listId);
      find.input.setAttribute("autocomplete", "off");
      find.input.setAttribute("aria-describedby", hintId);
      find.root.classList.add("prx-cz-find");
      find.root.append(
        h("datalist", { id: listId }, ...D.names.map((name) => h("option", { value: name }))),
        h("p", { id: hintId, class: "prx-hint", text: T.findHint }),
      );
      const findStatus = h("p", { class: "prx-hint prx-cz-find-status", hidden: true });
      ctx.listen(find.input, "keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        if (matches.length) {
          matchAt = (matchAt + 1) % matches.length;
          choose(matches[matchAt], { scroll: true, found: true });
          drawFindStatus();
        }
      });
      settings.body.append(h("div", { class: "prx-cz-settings" }, sortSeg.root, firmPick.root, find.root, findStatus));

      // --- Primary Stage: pairwise claim comparison + row-spaced report card + 1-line selected-firm strip
      const pairChartSlot = h("div", { class: "prx-cz-pair-chart", tabindex: "-1", role: "group", "aria-label": "Pairwise claims" });
      const pairJump = h("button", { type: "button", class: "prx-cz-pair-jump", text: "Compare pair totals" });
      ctx.listen(pairJump, "click", () => pairChartSlot.focus());
      const pairKeyList = h("ul", { class: "prx-cz-pair-key prx-partbar", "data-prx-part": "legend" });
      const cardHeading = ctx.panelTitle("", { className: "prx-cz-heading" });
      const cardSizesLine = h("p", { class: "prx-cz-card-sizes" });
      const cardSlot = h("div", { class: "prx-cz-card-chart" });
      const cardPanel = h(
        "section",
        { class: "prx-cz-panel prx-cz-card", "aria-label": T.cardLegend },
        h("div", { class: "prx-cz-card-head" }, cardHeading, cardSizesLine, pairJump),
        h("p", { class: "prx-cz-card-guide", text: "Each row shows one firm’s posterior mean (dot) and interval (line). Tap a row or use the arrow keys to inspect a firm." }),
        cardSlot,
      );
      const stageInspect = h("p", { class: "prx-cz-inspect" });
      stageInspect.setAttribute("data-prx-evidence", "firm-rank-and-grade");
      ctx.stage.append(stageInspect, pairChartSlot, pairKeyList, cardPanel);
      mobileControls(ctx, { primary: [cardSeg.root], before: [[cardPanel, stageInspect]] });

      // --- Data Disclosure: exact pair breakdown, selected-firm details, and complete 97-firm league table
      const dataBox = ctx.dataBox(["Data and ", count(D.n), "-firm comparison"]);
      const PARTS = CONFIG.pairParts.map((key) => ({ key, role: key }));
      const pairs = partBar(ctx, { hook: "pairs", parts: PARTS });
      const pairBreakdownLine = h("p", { class: "prx-cz-note" });

      const detailsName = h("p", { class: "prx-cz-details-name" });
      const firmPairs = partBar(ctx, { hook: "firm-bar", parts: PARTS, compact: true });
      const detailsRank = h("p", { class: "prx-cz-details-line" });
      const detailsGrade = h("p", { class: "prx-cz-details-line" });
      const pairsLine = h("p", { class: "prx-cz-details-line prx-cz-pairs" });
      detailsRank.id = uid("prx-cz-rank");
      detailsGrade.id = uid("prx-cz-grade");
      const detailsHead = h("div", { class: "prx-cz-details-head" }, ctx.panelTitle(T.detailsHeading, { className: "prx-cz-heading" }), detailsName);
      const details = h(
        "section",
        { class: "prx-cz-details", "aria-label": T.detailsHeading },
        detailsHead, firmPairs.root, pairsLine, detailsRank, detailsGrade,
      );

      const tableBox = ctx.scrollRegion(h("div", { class: "prx-cz-table-box" }), T.tableHeading);
      const caption = h("caption", { class: "prx-sr-only" });
      const head = {
        rank: h("th", { scope: "col", class: "prx-cz-col-rank" }),
        firm: h("th", { scope: "col", class: "prx-cz-col-firm", text: T.colFirm }),
        grade: h("th", { scope: "col", class: "prx-cz-col-grade", text: T.colGrade }),
        est: h("th", { scope: "col", class: "prx-cz-col-est" }),
        mean: h("th", { scope: "col", class: "prx-cz-col-mean", text: T.colMean }),
        other: h("th", { scope: "col", class: "prx-cz-col-other" }),
        industry: h("th", { scope: "col", class: "prx-cz-col-industry", text: T.colIndustry }),
      };
      const axisRow = h("div", { class: "prx-cz-axis", "aria-hidden": "true" });
      const estLabel = h("span", { class: "prx-cz-col-label" });
      head.est.append(estLabel, axisRow);
      const tbody = h("tbody", {});
      const tableId = uid("prx-cz-table");
      const table = h(
        "table",
        { class: "prx-cz-table prx-sticky-two", id: tableId },
        caption,
        h("thead", {}, h("tr", {}, head.rank, head.firm, head.grade, head.est, head.mean, head.other, head.industry)),
        tbody,
      );
      tableBox.append(table);
      const rowEls = D.names.map((_, i) => {
        const zero = h("span", { class: "prx-cz-zero" });
        const bar = h("span", { class: "prx-cz-bar" });
        const dot = h("span", { class: "prx-cz-dot" });
        const cells = {
          rank: h("td", { class: "prx-cz-col-rank" }),
          firm: h("th", { scope: "row", class: "prx-cz-col-firm", tabindex: "-1", "data-prx-name": "", "data-prx-firm": D.ids[i], text: D.names[i] }),
          est: h("span", { class: "prx-cz-est-num" }),
          se: h("span", { class: "prx-cz-est-num" }),
          mean: h("td", { class: "prx-cz-col-mean" }),
          badge: h("span", { class: "prx-cz-badge" }),
          grade: h("td", { class: "prx-cz-col-grade" }),
          other: h("td", { class: "prx-cz-col-other" }),
        };
        cells.grade.append(cells.badge);
        const strip = h("span", { class: "prx-cz-strip", "aria-hidden": "true" }, zero, bar, dot);
        const tr = h(
          "tr",
          { "data-prx-row": D.ids[i] },
          cells.rank,
          cells.firm,
          cells.grade,
          h("td", { class: "prx-cz-col-est" }, strip, h("span", { class: "prx-cz-est-text" }, cells.est, " ± ", cells.se)),
          cells.mean,
          cells.other,
          h("td", { class: "prx-cz-col-industry", "data-prx-name": "", text: String(D.industry[i]) }),
        );
        tbody.append(tr);
        return { tr, cells, zero, bar, dot };
      });
      const gapCount = h("span", {});
      const gapRow = h("tr", { class: "prx-cz-gap" }, h("td", { colspan: "7" }, gapCount));
      const showBtn = ctx.button({
        label: T.showAll,
        key: "show-all",
        onClick: () => { pending = { scroll: true }; ctx.set({ rows: expanded ? "ends" : "all" }); },
      });
      showBtn.root.classList.add("prx-cz-show");
      showBtn.root.setAttribute("aria-controls", tableId);
      const barNote = h("p", { class: "prx-cz-note prx-cz-bar-note", "data-prx-part": "legend" });
      const orderNote = h("p", { class: "prx-cz-note" });
      const tableHeading = ctx.panelTitle(T.tableHeading, { className: "prx-cz-heading prx-cz-table-heading" });
      const scrollHint = h("p", { class: "prx-hint prx-cz-scroll-hint", text: T.scrollHint, hidden: true });
      const tablePanel = h(
        "section",
        { class: "prx-cz-panel prx-cz-league", "aria-label": T.tableHeading },
        h("div", { class: "prx-cz-league-head" }, tableHeading, orderNote, showBtn.root),
        barNote,
        scrollHint,
        tableBox,
      );
      dataBox.body.append(h("div", { class: "prx-cz-data-stack" }, pairs.root, pairBreakdownLine, details, tablePanel));

      // --- Method Disclosure: grade-1 definition, interval & prior notes, KRW card caption, band swatches, scale note
      const methodBox = ctx.methodBox(T.methodTitle);
      const gradeLegend = h("p", { class: "prx-cz-note prx-cz-grade1", "data-prx-part": "legend" });
      const starNote = h("span", { class: "prx-cz-star" });
      const marksNote = h("span", { class: "prx-cz-marks" });
      const cardNote = h("p", { class: "prx-cz-note prx-cz-card-note", "data-prx-part": "legend" }, starNote, marksNote);
      const priorNote = h("p", { class: "prx-cz-note prx-cz-prior", "data-prx-part": "notes", hidden: true });
      const cardCaption = h("p", { class: "prx-cz-note prx-cz-krw", "data-prx-part": "caption" }, captionNode(ctx, "krw-card"));
      const krwGloss = h("p", { class: "prx-cz-note prx-cz-gloss", "data-prx-part": "caption", text: T.krwGloss });
      const bands = h("p", { class: "prx-cz-bands prx-light-panel", "data-prx-part": "legend" });
      const scaleNote = h("p", { class: "prx-cz-note prx-cz-scale", "data-prx-part": "notes" });
      methodBox.body.append(
        h(
          "div",
          { class: "prx-cz-method-stack" },
          gradeLegend,
          cardNote,
          priorNote,
          cardCaption,
          krwGloss,
          h("p", { class: "prx-cz-note", "data-prx-part": "legend", text: T.bandsNote }),
          bands,
          scaleNote,
        ),
      );

      // --- Standalone embed license notice (site pages carry their own callout-note)
      if (!ctx.doc.querySelector?.('meta[name="quarto:offset"]')) {
        const notice = h(
          "p",
          { class: "prx-cz-notice" },
          `${T.notice} `,
          h("strong", { text: T.noticeConduct }),
          ` ${T.noticeChanges} ${T.noticeAsIs}`,
        );
        ctx.root.append(notice);
      }

      // ------------------------------------------------------------------------------------- table

      function fillTable(v) {
        const colors = gradeColors(v.disc.G, pal());
        const { lo, hi, ticks } = v.estAxis;
        const at = (x) => pct(x - lo, hi - lo);
        tableHeading.textContent = v.card.table;
        tablePanel.setAttribute("aria-label", v.card.table);
        tableBox.setAttribute("aria-label", v.card.table);
        estLabel.replaceChildren(...fill(T.colEstimate, { se: () => count(CONFIG.seWidth) }));
        const ends = ticks.filter((t, k) => t === 0 || k === 0 || k === ticks.length - 1);
        axisRow.replaceChildren(...ends.map((t, k) => {
          const s = h("span", { class: "prx-cz-tick" });
          setNum(s, t, tickLabel(t, k, ends));
          s.style.left = at(t);
          return s;
        }));
        rowEls.forEach((r, i) => {
          const w = CONFIG.seWidth * v.se[i];
          setNum(r.cells.est, v.est[i], val(v.est[i]));
          setNum(r.cells.se, v.se[i], val(v.se[i]));
          setNum(r.cells.mean, v.mean[i], val(v.mean[i]));
          const g = v.grade[i];
          setNum(r.cells.badge, g, formatCount(g));
          r.cells.badge.style.background = colors[g - 1];
          r.cells.badge.style.color = labelOn(colors[g - 1], pal());
          r.zero.style.left = at(0);
          r.bar.style.left = at(v.est[i] - w);
          r.bar.style.width = pct(2 * w, hi - lo);
          r.dot.style.left = at(v.est[i]);
        });
        barNote.replaceChildren(...fill(T.barNote, {
          se: () => count(CONFIG.seWidth),
          within: () => ro("within", within, formatPercent(within)),
        }));
      }

      function orderRows(v, sort) {
        const rank = sort === "mean" ? v.rankMean : v.rankEst;
        const otherRank = sort === "mean" ? v.rankEst : v.rankMean;
        head.rank.replaceChildren(T.colRank, h("span", { class: "prx-cz-col-sub", text: T.colRankBy[sort] }));
        head.rank.setAttribute("aria-sort", "ascending");
        head.other.textContent = T.colOther[sort];
        tbody.append(...v.rows[sort].map((i) => {
          setNum(rowEls[i].cells.rank, rank[i], formatCount(rank[i]));
          setNum(rowEls[i].cells.other, otherRank[i], formatCount(otherRank[i]));
          return rowEls[i].tr;
        }));
        rowEls[v.rows[sort][CONFIG.showRows]].tr.before(gapRow);
        orderNote.textContent = T.orderNote[sort];
        caption.replaceChildren(...fill(T.caption, { table: () => v.card.table, n: () => count(D.n) }), ` ${T.orderNote[sort]}`);
      }

      const middle = (order, k) => k >= CONFIG.showRows && k < order.length - CONFIG.showRows;

      let hiddenMarked = 0;
      function showRows(order) {
        let hidden = 0;
        hiddenMarked = 0;
        order.forEach((i, k) => {
          const hide = !expanded && middle(order, k) && i !== selected;
          rowEls[i].tr.hidden = hide;
          if (hide) { hidden += 1; if (marked.has(i)) hiddenMarked += 1; }
        });
        gapRow.hidden = hidden === 0;
        gapCount.replaceChildren(...fill(T.gap, { count: () => count(hidden) }));
        showBtn.setLabel(expanded ? T.showEnds : T.showAll);
        showBtn.root.setAttribute("aria-expanded", String(expanded));
      }

      let marked = new Set();
      function markReversed(firms) {
        const next = new Set(firms);
        for (const j of marked) if (!next.has(j)) rowEls[j].tr.classList.remove("prx-cz-rev");
        for (const j of next) rowEls[j].tr.classList.add("prx-cz-rev");
        marked = next;
      }

      function scrollRow(i) {
        const tr = rowEls[i].tr;
        const box = tableBox.getBoundingClientRect();
        const r = tr.getBoundingClientRect();
        const headH = table.tHead?.getBoundingClientRect().height ?? 0;
        if (!(box.height > 0)) return;
        if (r.top < box.top + headH) tableBox.scrollTop -= box.top + headH - r.top;
        else if (r.bottom > box.bottom) tableBox.scrollTop += r.bottom - box.bottom;
      }

      ctx.listen(tbody, "keydown", (e) => {
        const cell = e.target.closest?.("th[data-prx-firm]");
        if (!cell) return;
        const order = view(ctx.state.card).rows[ctx.state.sort];
        const at = order.indexOf(D.idIndex.get(cell.getAttribute("data-prx-firm")));
        const steps = { ArrowDown: at + 1, ArrowUp: at - 1, PageDown: at + CONFIG.pageRows, PageUp: at - CONFIG.pageRows, Home: 0, End: order.length - 1 };
        if (!(e.key in steps)) return;
        e.preventDefault();
        const next = order[Math.max(0, Math.min(order.length - 1, steps[e.key]))];
        choose(next, { scroll: true, focus: true });
      });
      ctx.listen(tbody, "click", (e) => {
        const tr = e.target.closest?.("tr[data-prx-row]");
        if (tr) choose(D.idIndex.get(tr.getAttribute("data-prx-row")), { scroll: false, focus: true });
      });

      // ------------------------------------------------------------------------------------- stage charts

      let cardChart = null;

      function drawMethodAndHeader(v) {
        const c = v.card;
        cardHeading.textContent = c.title;
        cardPanel.setAttribute("aria-label", c.title);
        cardSizesLine.replaceChildren(
          ro("G", v.disc.G, formatCount(v.disc.G)),
          T.gradesWord,
          ro("sizes", v.disc.sizes, formatSizes(v.disc.sizes)),
        );
        gradeLegend.replaceChildren(h("span", { class: "prx-cz-grade1-text", text: c.grade1 }));
        starNote.textContent = c.star ? `${c.star} ` : "";
        marksNote.replaceChildren(...fill(T.cardNote, {
          level: () => ro("level", level, formatPercent(level)),
          figure: () => c.figureName,
          krwLevel: () => num(CONFIG.krwLevel, formatPercent(CONFIG.krwLevel)),
        }));
        const colors = gradeColors(v.disc.G, pal());
        bands.replaceChildren(
          ...Array.from(v.disc.sizes, (size, k) => h(
            "span",
            { class: "prx-cz-band" },
            h("span", { class: "prx-cz-swatch", style: { "--prx-cz-swatch": colors[k], "--prx-cz-mix": `${tintOf(k + 1) * CONFIG.percent}%` } }),
            h("span", {}, "Grade ", count(k + 1), ": ", count(size), size === 1 ? T.firm : T.firms),
          )),
        );
        priorNote.hidden = !c.prior;
        priorNote.textContent = c.prior ?? "";
        scaleNote.replaceChildren(`${c.scale} ${T.scaleNote}`);
      }

      function drawCaption(v) {
        ctx.caption.replaceChildren(...fill(T.intervalNote, {
          level: () => num(level, formatPercent(level)),
          figure: () => v.card.figure,
          krwLevel: () => ro("krw-level", CONFIG.krwLevel, formatPercent(CONFIG.krwLevel)),
        }));
      }

      function drawPairChart(v, sort) {
        const d = v.disc;
        const against = v.against[sort].count;
        const agree = d.N - against;
        const withheld = d.M - d.N;
        const width = Math.max(240, Math.round(pairChartSlot.clientWidth || ctx.width() || 640));
        const narrow = width < 500;
        const height = narrow ? 136 : 146;
        const marginTop = 10;
        const marginBottom = 34;
        const marginLeft = 10;
        const marginRight = 14;
        const innerW = Math.max(1, width - marginLeft - marginRight);
        const minAgainstUnits = against > 0 ? Math.max(against, (4 * d.M) / innerW) : 0;
        const xAgree = Math.max(0, Math.min(d.N, d.N - minAgainstUnits));
        const xStated = d.N;

        const hatchLines = [];
        const step = Math.max(90, Math.round(d.M / Math.max(12, Math.round(innerW / 12))));
        for (let x0 = xStated; x0 < d.M; x0 += step) {
          const x1 = Math.min(d.M, x0 + step * 0.85);
          hatchLines.push({ x1: x0, y1: 1.76, x2: x1, y2: 1.32 });
        }

        const tableTitle = sort === "mean" ? "League table (by posterior mean)" : "League table (by estimate)";
        const pillHalfW = (24 / innerW) * d.M;
        const withheldMid = (xStated + d.M) / 2;

        plot(pairChartSlot, {
          width,
          height,
          aspect: false,
          marginTop,
          marginBottom,
          marginLeft,
          marginRight,
          alt: `Pairwise claims across ${formatCount(d.M)} firm pairs: the league table states all ${formatCount(d.M)} pairs, whereas ${v.card.title} states ${formatCount(d.N)} pairs (${formatCount(agree)} agree, ${formatCount(against)} reverse) and withholds ${formatCount(withheld)}.`,
          x: {
            domain: [0, d.M],
            ticks: narrow ? [0, 1500, 3000, d.M] : [0, 1000, 2000, 3000, d.M],
            label: "Pairs of firms",
            labelAnchor: "center",
            labelArrow: "none",
          },
          y: { domain: [2.2, -0.4], axis: null },
          marks: (c, P) => [
            P.text([{ x: 0, y: -0.15, label: tableTitle }], {
              x: "x", y: "y", text: "label", textAnchor: "start", fontWeight: "bold", fill: c.plotFg,
            }),
            P.rect([{ x1: 0, x2: d.M, y1: 0.12, y2: 0.56 }], {
              x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.relAbove, stroke: c.cellBorder, strokeWidth: 1,
            }),
            numText([{ x: d.M / 2, y: 0.34, val: d.M }], {
              x: "x", y: "y", value: "val", format: (x) => formatCount(x),
              fill: labelOn(c.relAbove, c), fontWeight: "bold", textAnchor: "middle",
            }),
            P.text([{ x: 0, y: 1.05, label: v.card.title }], {
              x: "x", y: "y", text: "label", textAnchor: "start", fontWeight: "bold", fill: c.plotFg,
            }),
            ...(xAgree > 0 ? [P.rect([{ x1: 0, x2: xAgree, y1: 1.32, y2: 1.76 }], {
              x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.relAbove, stroke: c.cellBorder, strokeWidth: 1,
            })] : []),
            ...(against > 0 ? [P.rect([{ x1: xAgree, x2: xStated, y1: 1.32, y2: 1.76 }], {
              x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.relBelow, stroke: c.cellBorder, strokeWidth: 1,
            })] : []),
            ...(withheld > 0 ? [
              P.rect([{ x1: xStated, x2: d.M, y1: 1.32, y2: 1.76 }], {
                x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.relWithheld, stroke: c.cellBorder, strokeWidth: 1,
              }),
              P.link(hatchLines, {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: c.hatch, strokeWidth: 1,
              }),
            ] : []),
            ...(agree / d.M >= 0.12 ? [numText([{ x: xAgree / 2, y: 1.54, val: agree }], {
              x: "x", y: "y", value: "val", format: (x) => formatCount(x),
              fill: labelOn(c.relAbove, c), fontWeight: "bold", textAnchor: "middle",
            })] : []),
            ...(withheld / d.M >= 0.25 ? [
              P.rect([{
                x1: Math.max(xStated, withheldMid - pillHalfW),
                x2: Math.min(d.M, withheldMid + pillHalfW),
                y1: 1.35,
                y2: 1.73,
              }], {
                x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: c.plotBg, fillOpacity: 0.9, rx: 2,
              }),
              numText([{ x: withheldMid, y: 1.54, val: withheld }], {
                x: "x", y: "y", value: "val", format: (x) => formatCount(x),
                fill: c.plotFg, fontWeight: "bold", textAnchor: "middle",
              }),
            ] : []),
          ],
        });

        const tblDoubt = v.tableEval?.[sort]?.doubtful ?? null;
        const cardDoubt = v.cardEval?.doubtful ?? null;
        pairKeyList.replaceChildren(
          h("li", {}, h("span", { class: "prx-partbar-sw", "data-role": "agree", "aria-hidden": "true" }), count(agree), " agree"),
          h("li", {}, h("span", { class: "prx-partbar-sw", "data-role": "against", "aria-hidden": "true" }), count(against), " reverse"),
          h("li", {}, h("span", { class: "prx-partbar-sw", "data-role": "silent", "aria-hidden": "true" }), count(withheld), " withheld"),
          ...(tblDoubt !== null && cardDoubt !== null ? [
            h(
              "li",
              { class: "prx-cz-pair-doubtful" },
              "Doubtful (>",
              num(CONFIG.doubtfulTau, formatPercent(CONFIG.doubtfulTau)),
              " wrong): ",
              count(tblDoubt),
              " table vs ",
              count(cardDoubt),
              " card",
            ),
          ] : []),
        );
      }

      const tipText = (v, d) => `${D.names[d.i]}\nGrade ${formatCount(d.grade)} of ${formatCount(v.disc.G)}\nPosterior mean ${val(d.mean)}\n${formatPercent(level)} posterior interval ${val(d.lower)} to ${val(d.upper)}`;

      function drawCard(v, selIdx) {
        const Cc = CONFIG.chart;
        const n = D.n;
        const rows = v.order.map((i, k) => ({
          i, id: D.ids[i], pos: k, grade: v.grade[i], mean: v.mean[i], lower: v.lower[i], upper: v.upper[i],
        }));
        const bandsData = bandRows(v.disc.sizes, 0);
        const { lo, hi, ticks } = v.cardAxis;
        const width = Math.max(240, Math.round(cardSlot.clientWidth || ctx.width() || 640));
        const narrow = width < 500;
        // A firm is an inspectable row. Keep the intervals distinct as the roster grows.
        const height = Cc.marginTop + n * (narrow ? Cc.narrowRowPx : Cc.rowPx) + Cc.marginBottom;
        const innerW = Math.max(1, width - Cc.marginLeft - Cc.marginRight);
        const innerH = Math.max(1, height - Cc.marginTop - Cc.marginBottom);
        const perPx = (hi - lo) / innerW;
        const leftOf = (px) => lo - px * perPx;
        const stripeX1 = leftOf(Cc.marginLeft - 1);
        const stripeX2 = leftOf(Cc.marginLeft - 1 - Cc.stripePx);
        const stripeMid = (stripeX1 + stripeX2) / 2;
        const yPxOf = (pos) => Cc.marginTop + ((pos + Cc.half) / n) * innerH;
        const posOf = (yPx) => ((yPx - Cc.marginTop) / innerH) * n - Cc.half;
        const halfPillUnits = (8.5 / innerH) * n;
        const placedBadges = placeDirectLabels(
          bandsData.map((b) => ({ id: String(b.grade), y: yPxOf(b.mid), band: b })),
          { minGapPx: 18, bounds: [Cc.marginTop + 9, height - Cc.marginBottom - 9] },
        );
        const labeledBands = placedBadges.map((p) => ({ ...p.band, labelPos: posOf(p.y) }));
        const selRows = selIdx !== null ? rows.filter((r) => r.i === selIdx) : [];

        cardChart = plot(cardSlot, {
          width,
          height,
          aspect: false,
          alt: `${v.card.title}: the firms in grade order, grade 1 at the top, each with its posterior mean (a dot) and ${formatPercent(level)} posterior interval (a line); shaded bands mark the grades.`,
          table: {
            caption: `${v.card.title}. ${T.cardTable}`,
            columns: [
              { label: "Grade", value: "grade", format: (x) => formatCount(x), header: false },
              { label: T.colFirm, value: (d) => D.names[d.i] },
              { label: T.colMean, value: "mean", format: (x) => val(x) },
              { label: T.colLower, value: "lower", format: (x) => val(x) },
              { label: T.colUpper, value: "upper", format: (x) => val(x) },
            ],
            rows,
          },
          marginTop: Cc.marginTop,
          marginBottom: Cc.marginBottom,
          marginLeft: Cc.marginLeft,
          marginRight: Cc.marginRight,
          x: { domain: [lo, hi], axis: "bottom", ticks, label: width < 380 ? (v.card.short ?? "Log contact gap") : v.card.axis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [n - Cc.half, -Cc.half], axis: null },
          color: { type: "identity" },
          marks: (c, P) => {
            const colors = gradeColors(v.disc.G, c);
            return [
              P.axisX(ticks, { anchor: "top", tickFormat: tickLabel, label: narrow ? v.card.short : v.card.axis,
                labelAnchor: "center", labelArrow: "none", labelOffset: 35 }),
              P.rect(bandsData, {
                x1: () => lo,
                x2: () => hi,
                y1: (d) => d.first - Cc.half,
                y2: (d) => d.last + Cc.half,
                fill: (d) => colors[d.grade - 1],
                fillOpacity: (d) => tintOf(d.grade),
              }),
              P.ruleY(bandsData.slice(1), {
                y: (d) => d.first - Cc.half,
                x1: () => stripeX1,
                x2: () => hi,
                stroke: c.plotAxis,
                strokeDasharray: Cc.dash,
              }),
              P.ruleX([0], { stroke: c.plotAxis }),
              P.rect(bandsData, {
                x1: () => stripeX1,
                x2: () => stripeX2,
                y1: (d) => d.first - Cc.half,
                y2: (d) => d.last + Cc.half,
                fill: (d) => colors[d.grade - 1],
                inset: 0.5,
              }),
              P.rect(labeledBands, {
                x1: () => stripeX1,
                x2: () => stripeX2,
                y1: (d) => d.labelPos - halfPillUnits,
                y2: (d) => d.labelPos + halfPillUnits,
                fill: (d) => colors[d.grade - 1],
                stroke: c.plotBg,
                strokeWidth: 1,
                rx: 3,
              }),
              numText(labeledBands, {
                x: () => stripeMid,
                y: "labelPos",
                value: "grade",
                format: (x) => formatCount(x),
                fill: (d) => labelOn(colors[d.grade - 1], c),
                fontWeight: "bold",
                textAnchor: "middle",
              }),
              P.ruleY(rows, { y: "pos", x1: "lower", x2: "upper", stroke: c.post, strokeWidth: Cc.line }),
              P.dot(rows, { x: "mean", y: "pos", r: Cc.dot, fill: c.post }),
              P.ruleY(selRows, { y: "pos", x1: "lower", x2: "upper", stroke: c.plotFg, strokeWidth: 2.6 }),
              P.dot(selRows, { x: "mean", y: "pos", r: 5.2, fill: c.post, stroke: c.plotBg, strokeWidth: 1.6 }),
              P.dot(selRows, { x: "mean", y: "pos", r: 6.4, fill: "none", stroke: c.plotFg, strokeWidth: 1.8 }),
              P.tip(rows, P.pointerY({ x: "mean", y: "pos", title: (d) => tipText(v, d) })),
            ];
          },
          keyboard: {
            data: rows,
            x: "mean",
            y: "pos",
            key: (d) => d.id,
            sort: false,
            label: T.cardKeys,
            title: (d) => tipText(v, d),
          },
        });
        cardChart.svg.addEventListener("click", (e) => {
          const k = rowAt(e);
          if (k !== null) choose(view(ctx.state.card).order[k], { scroll: true });
        });
        syncCardStop();
      }

      function rowAt(e) {
        if (!cardChart) return null;
        const sy = cardChart.scale("y");
        const rect = cardChart.svg.getBoundingClientRect();
        const H = Number(cardChart.svg.getAttribute("height")) || rect.height;
        if (!(rect.height > 0) || !sy?.domain || !sy?.range) return null;
        const yv = ((e.clientY - rect.top) * H) / rect.height;
        const [d0, d1] = sy.domain;
        const [r0, r1] = sy.range;
        const k = Math.round(d0 + ((yv - r0) * (d1 - d0)) / (r1 - r0));
        return k >= 0 && k < D.n ? k : null;
      }

      function syncCardStop() {
        if (selected === null) return;
        const id = D.ids[selected];
        for (const b of cardSlot.querySelectorAll(".prx-kbd-point")) {
          const key = b.getAttribute("data-prx-focus-key") ?? "";
          b.tabIndex = key.slice(key.lastIndexOf(":") + 1) === id ? 0 : -1;
        }
      }

      ctx.listen(cardSlot, "focusin", (e) => {
        const key = e.target?.getAttribute?.("data-prx-focus-key") ?? "";
        const id = key.startsWith("kbd:") ? key.slice(key.lastIndexOf(":") + 1) : null;
        if (id !== null && D.idIndex.has(id)) {
          // The complete card can be taller than the viewport when moving with Home, End or arrows.
          e.target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
          choose(D.idIndex.get(id), { scroll: true });
        }
      });

      // ------------------------------------------------------------------------------------- selection

      function drawStageInspect(v, sort, i) {
        const others = v.withheld[i];
        const against = v.against[sort].per[i];
        const agree = v.stated[i] - against;
        const othersClause = others === 0
          ? ["alone"]
          : [count(others), others === 1 ? " other firm" : " other firms"];
        stageInspect.replaceChildren(
          "Selected: ",
          nameNode(i, "strong"),
          " — rank ",
          count(v.rankEst[i]),
          " by estimate (",
          num(v.est[i], formatReadoutEst(v.est[i])),
          " ± ",
          num(v.se[i], formatReadoutEst(v.se[i])),
          "), rank ",
          count(v.rankMean[i]),
          " by posterior mean (",
          num(v.mean[i], formatReadoutEst(v.mean[i])),
          "); grade ",
          count(v.grade[i]),
          " (",
          ...othersClause,
          "): ",
          count(v.stated[i]),
          " of ",
          count(v.partners),
          " pairs stated (",
          count(agree),
          " agree, ",
          count(against),
          " reverse)",
          ...(others > 0 ? [", ", count(others), " withheld."] : ["."]),
        );
      }

      function drawDetails() {
        if (selected === null) return;
        const v = view(ctx.state.card);
        const i = selected;
        const others = v.withheld[i];
        detailsName.replaceChildren(
          h("strong", {}, nameNode(i)),
          ` · ${T.industry}`,
          h("span", { "data-prx-name": "", text: String(D.industry[i]) }),
        );
        detailsRank.replaceChildren(...fill(T.rank, {
          table: () => v.card.table,
          rankEst: () => ro("firm-rank-estimate", v.rankEst[i], formatCount(v.rankEst[i])),
          n: () => ro("firm-n", D.n, formatCount(D.n)),
          est: () => ro("firm-estimate", v.est[i], val(v.est[i])),
          se: () => ro("firm-se", v.se[i], val(v.se[i])),
          rankMean: () => ro("firm-rank-mean", v.rankMean[i], formatCount(v.rankMean[i])),
          mean: () => ro("firm-mean", v.mean[i], val(v.mean[i])),
        }));
        detailsGrade.replaceChildren(v.card.title, ...fill(T.gradeOf, {
          grade: () => ro("firm-grade", v.grade[i], formatCount(v.grade[i])),
          G: () => count(v.disc.G),
          others: () => (others === 0 ? T.alone : ["with ", ro("firm-others", others, formatCount(others)), others === 1 ? T.withOne : T.withMany]),
          level: () => num(level, formatPercent(level)),
          lower: () => ro("firm-lower", v.lower[i], val(v.lower[i])),
          upper: () => ro("firm-upper", v.upper[i], val(v.upper[i])),
        }).flat());
        const silent = v.withheld[i];
        const sort = ctx.state.sort;
        const against = v.against[sort].per[i];
        const agree = v.stated[i] - against;
        const split = v.stated[i] === 0 ? [] : [", ", ...(against === 0 ? [T.allAgree] : agree === 0 ? [T.allAgainst]
          : [ro("firm-agree", agree, formatCount(agree)), T.agreeA, ro("firm-against", against, formatCount(against)), T.againstA])];
        pairsLine.replaceChildren(
          T.pairsA,
          ro("firm-pairs", v.partners, formatCount(v.partners)),
          T.pairsB,
          v.card.title,
          T.pairsC,
          ro("firm-stated", v.stated[i], formatCount(v.stated[i])),
          T.pairsD,
          ...split,
          ...(silent === 0 ? [T.pairsNone] : [T.pairsSilent, ro("firm-silent", silent, formatCount(silent)), silent === 1 ? T.pairsSilentOne : T.pairsSilentMany]),
        );
        const rank = sort === "mean" ? v.rankMean : v.rankEst;
        const reversed = v.against[sort].firms[i].slice().sort((a, b) => rank[a] - rank[b]);
        const named = [
          ...(reversed.length <= CONFIG.revNames
            ? [T.revNamed, ...reversed.flatMap((j, k) => (k ? [", ", nameNode(j)] : [nameNode(j)])), T.revMarked]
            : [T.revMany]),
          ...(hiddenMarked ? fill(T.revHidden, { count: () => count(hiddenMarked) }) : []),
        ];
        firmPairs.set({
          title: (total) => fill(T.firmPairsTitle, { total }),
          total: v.partners,
          counts: { agree, against, silent },
          words: T.firmWords,
          after: (p) => (p === "against" && reversed.length ? named : []),
        });
      }

      function select(i, { scroll = false, focus = false, found = false } = {}) {
        if (i === undefined || i === null || !rowEls[i]) return;
        if (!found && i !== selected) findStatus.hidden = true;
        if (selected !== null) {
          rowEls[selected].tr.classList.remove("prx-cz-selected");
          rowEls[selected].tr.removeAttribute("aria-current");
          rowEls[selected].cells.firm.removeAttribute("aria-describedby");
          rowEls[selected].cells.firm.tabIndex = -1;
        }
        selected = i;
        firmPick.set(D.ids[i]);
        const r = rowEls[i];
        const v = view(ctx.state.card);
        markReversed(v.against[ctx.state.sort].firms[i]);
        showRows(v.rows[ctx.state.sort]);
        r.tr.classList.add("prx-cz-selected");
        r.tr.setAttribute("aria-current", "true");
        r.cells.firm.setAttribute("aria-describedby", `${detailsRank.id} ${detailsGrade.id}`);
        r.cells.firm.tabIndex = 0;
        if (focus) r.cells.firm.focus({ preventScroll: true });
        if (scroll) scrollRow(i);
        drawDetails();
        drawStageInspect(v, ctx.state.sort, i);
        drawCard(v, i);
      }

      function choose(i, intent = {}) {
        if (rendering || i === undefined || i === null || !rowEls[i]) return;
        if (i === selected) {
          if (intent.focus) rowEls[i].cells.firm.focus({ preventScroll: true });
          if (intent.scroll) scrollRow(i);
          return;
        }
        const s = ctx.state;
        const order = view(s.card).rows[s.sort];
        const patch = { firm: firmKey(i, s) };
        if (s.rows !== "all" && middle(order, order.indexOf(i))) patch.rows = "all";
        pending = intent;
        ctx.set(patch);
        pending = null;
      }

      function drawFindStatus() {
        const q = find.input.value.trim();
        if (!q) { findStatus.hidden = true; return; }
        findStatus.hidden = false;
        if (!matches.length) findStatus.replaceChildren(T.noMatch);
        else if (matches.length > 1) findStatus.replaceChildren(...fill(T.match, { count: () => count(matches.length), k: () => count(matchAt + 1) }));
        else findStatus.hidden = true;
      }

      function findFirm(q) {
        const s = String(q ?? "").trim().toLowerCase();
        const order = view(ctx.state.card).rows[ctx.state.sort];
        matches = s ? order.filter((i) => D.names[i].toLowerCase().includes(s)) : [];
        const exact = matches.findIndex((i) => D.names[i].toLowerCase() === s);
        matchAt = exact >= 0 ? exact : 0;
        if (matches.length) choose(matches[matchAt], { scroll: true, found: true });
        drawFindStatus();
      }
      ctx.listen(find.input, "input", () => { if (!find.input.value.trim()) { matches = []; drawFindStatus(); } });

      // ------------------------------------------------------------------------------------- read-out & data pair bar

      function drawPairs(v, sort) {
        const d = v.disc;
        const { count: against, pairs: reversed } = v.against[sort];
        const agree = d.N - against;
        const named = against > 0 && against <= CONFIG.revNames
          ? [T.revPairsLead, ...reversed.flatMap((p, k) => [k ? T.revPairSep : null, nameNode(p.above), T.revPairAbove, nameNode(p.below)].filter(Boolean))]
          : [];
        pairs.set({
          title: (total) => fill(T.pairsTitle, { total, card: () => v.card.title }),
          total: d.M,
          counts: { agree, against, silent: d.M - d.N },
          words: T.pairWords,
          after: (p) => (p === "against" ? named : []),
        });

        const insideParts = [];
        v.inside.forEach((pCount, k) => {
          if (k > 0) insideParts.push(k === v.inside.length - 1 ? T.readAnd : ", ");
          insideParts.push(ro(`inside-${k + 1}`, pCount, formatCount(pCount)), T.readInside, count(k + 1));
        });
        const statedHook = () => ro("stated-directions", d.N, formatCount(d.N));
        const orderParts = d.N === 0 ? []
          : against === 0 ? [T.readOrderAll[0], statedHook(), T.readOrderAll[1]]
            : agree === 0 ? [T.readOrderNone[0], statedHook(), T.readOrderNone[1]]
              : [T.readOrderA, statedHook(), T.readOrderB, ro("agree", agree, formatCount(agree)), T.readOrderC,
                count(against), T.readOrderD];
        pairBreakdownLine.replaceChildren(T.insideLead, ...insideParts, T.readEnd, ...orderParts);
      }

      function drawReadout(v, sort) {
        const d = v.disc;
        const against = v.against[sort].count;
        const orderWord = sort === "mean" ? "posterior mean" : "estimate";
        const tblErr = v.tableEval?.[sort]?.EoverN ?? null;
        const cardErr = v.cardEval?.EoverN ?? null;
        const revClause = against === 0
          ? ["; all agree with the table"]
          : ["; ", ro("against", against, formatCount(against)), against === 1 ? " reverses the table" : " reverse the table"];
        ctx.readout.set([
          `Ranking by ${orderWord} asserts all `,
          ro("M", d.M, formatCount(d.M)),
          " pairs",
          ...(tblErr !== null ? [" (wrong share ", num(tblErr, formatShare(tblErr)), ")"] : []),
          `. ${v.card.title} states `,
          ro("N", d.N, formatCount(d.N)),
          " pairs (",
          ro("s", d.s, formatShare(d.s)),
          ...(cardErr !== null ? [", wrong share ", num(cardErr, formatShare(cardErr))] : []),
          ...revClause,
          ") and withholds ",
          ro("withheld", d.M - d.N, formatCount(d.M - d.N)),
          ".",
        ]);
      }

      return {
        render(state, info) {
          if (info?.reason === "disclosure") {
            if (info.disclosure === "data") {
              scrollHint.hidden = !(tableBox.scrollWidth > tableBox.clientWidth + 1);
            }
            return;
          }
          ctx.root.setAttribute("aria-busy", "true");
          rendering = true;
          try {
            const theme = themeKey();
            const themed = theme !== lastTheme;
            if (themed) { palCache = null; lastTheme = theme; }
            cardSeg.set(state.card);
            sortSeg.set(state.sort);
            const v = view(state.card);
            const cardChanged = state.card !== lastCard;
            const moved = cardChanged || state.sort !== lastSort;
            const intent = pending ?? { scroll: moved };
            pending = null;
            expanded = state.rows === "all";
            if (cardChanged || themed) { fillTable(v); drawMethodAndHeader(v); }
            if (cardChanged) drawCaption(v);
            if (moved) orderRows(v, state.sort);
            lastCard = state.card;
            lastSort = state.sort;
            drawReadout(v, state.sort);
            drawPairs(v, state.sort);
            drawPairChart(v, state.sort);
            select(firmOf(state), intent);
            scrollHint.hidden = !(tableBox.scrollWidth > tableBox.clientWidth + 1);
          } finally {
            rendering = false;
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
