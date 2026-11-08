// case-zero (app 1.1): "A league table and a report card". Kline, Rose and Walters' 97 firms (the released case
// data/released/case-krw.json, license cc-by-nc-krw) shown two ways. The app uses the shared result-first frame
// (base.js layout "result-first"; review 044: U1-F1, X-01, X-09, U1-F4), top to bottom:
//   controls       the card, the order of the league table and a find box, then the preset row (its own line)
//   read-out       directly under the controls (the frame puts it there): v1's three sentences on the card's pairs,
//                  then how many of its directions run as the table does and how many the other way
//   pair bar       the mark the card and the order change (ctx.primaryGraphic), drawn by the shared partBar: all M
//                  pairs of firms in three parts, the card's directions that run as the table does (N − against), those
//                  that run the other way (against, each pair named when there are at most three) and the pairs it is
//                  silent on (M − N), each count written under the track; the title names the card
//   selected firm  a strip: the firm, the same three parts of its n − 1 pairs (a compact partBar; the firms on the other
//                  side of its reversed pairs are named when there are few), the pairs line, then its rank and grade
//                  lines; in the table the firms of its reversed pairs carry ↕ after their grade. On phones (<= 600 px)
//                  the find box moves from the controls row into the strip's head, next to the firm it finds
//   the card and the league table, side by side when the charts are wide (the card first, so it also comes first
//                  when they stack):
//     the card     one of the two cards KRW published (key card: race, sizes 2/81/14, or gender, sizes 1/3/89/4),
//                  drawn after KRW's slides 61-63: each firm's posterior mean and central 90% posterior interval (navy)
//                  over light grade bands that carry their grade numbers (tokens.css: posterior navy and the grade
//                  ramp are separated by mark type); a hidden table and arrow-key reading through chart.js. One note
//                  above the figure (grades and sizes, what grade 1 means, the marks, KRW's 95% and the order within a
//                  grade); under the figure the race card's prior note (why its intervals lie right of zero) and a
//                  closed "Card source" box (ctx.disclosure) with KRW's caption, the plain gloss and the band legend
//     league table a real table in its own scroll box: rank, firm, the firm's grade on the chosen card (right after
//                  the firm, so the grade compared stays in view: X-09), the estimate with a bar of ± 1 SE, the
//                  posterior mean, the rank under the other order and the industry code; it first shows the top and
//                  the bottom CONFIG.showRows rows (a gap row counts the rest, and the reversed partners among them)
//                  and a Show all button brings back every row (selecting a hidden firm shows them all too); the
//                  criterion follows the card (race estimates with the race card, gender estimates with the gender
//                  card) and the heading names it; ordered by estimate or by posterior mean (key sort); the header row
//                  stays in view, the rank and firm columns stay in view when the table scrolls sideways (the shared
//                  prx-sticky-two class), and a hint says so while the box scrolls
//   scale note, caption, and on a standalone page the data notice
// One firm is selected at a time (key firm: the first row of the table's order unless a firm is named; then a click,
// the arrow keys in either view, or the find box): its row is marked in the table (aria-current, and its firm cell is
// described by the strip's rank and grade lines) and its interval in the card (whose keyboard reading starts at it).
// Ranks, card order, grade sizes and pair counts come from the engine (strictOrder, reportCardRows, disclosure,
// unitRelationCounts, statedAgainst, pairCount); every value shown is a released value, formatted with format.js.
// The KRW caption is the labels.js string, followed by a plain gloss; a standalone embed (a page without Quarto's
// quarto:offset meta element) keeps the data notice (the page's string), the change note and the site's disclaimer,
// and a site page carries one callout and one credit of its own.
// Performance: the card view is computed once per card, the resolved palette is cached until the theme changes, a
// change of order only (sort) does not redraw the card, and a change of the selected firm only moves the marks.
//
// Keys: card ("race" | "gender"), sort ("estimate" | "mean"), firm (a firm id of the data, or "first": the first row
// of the current order; a firm name is read too), rows ("ends": the top and bottom rows | "all"). Choosing the card or
// the order keeps the selected firm (the app names it in the firm key); a preset or a link is a whole setting.
//
// Exported for the later KRW card apps: CONFIG, readCase, niceAxis, cardView, bandRows.

import { createWidget, uid } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { partBar } from "../shared/partbar.js";
import { formatCount, formatDecimal, formatPercent, formatProb, formatSizes, setNum, tickLabel } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  canonicalGrade, disclosure, normalCdf, pairCount, reportCardRows, statedAgainst, strictOrder, unitRelationCounts,
} from "../pr-core.js";
import KRW from "../../data/released/case-krw.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "case-zero",
  label: "KRW's firms in a league table beside a report card KRW published",
  className: "prx-cz",
  // the firm key's value for "the first row of the current order"
  firstFirm: "first",
  defaults: Object.freeze({ card: "race", sort: "estimate", firm: "first", rows: "ends" }),
  cards: Object.freeze({
    race: Object.freeze({
      label: "Race card", title: "KRW's race card", table: "Race league table", grade: "race_card",
      estimate: "race_estimate", se: "race_se", mean: "mean_race", lower: "lower_race", upper: "upper_race",
      grade1: "Grade 1 = stated highest on white-name contact advantage, as the posterior judges it.",
      axis: "Log contact gap, white-named minus Black-named",
      scale: "Both panels show the log contact gap: the log of the contact rate of white-named applications minus that of Black-named ones. Above zero, white-named applications were contacted more often.",
      // why every race interval lies right of zero beside negative estimates (KRW §III and §V.B; register CR-102)
      prior: "KRW's race prior puts all its weight on positive gaps, so every race posterior lies above zero, even for a firm with a negative estimate.",
      // the KRW figure of this card, whose caption gives the interval level KRW drew (KRW §VI, Figure 7)
      figure: "KRW's Figure 7 caption says ",
      figureName: "Figure 7",
      // how KRW's figure marks grade 1 (the page's source callout; review 044, U1-F4)
      star: "Grade 1 is KRW's ★ (one star), which KRW call the worst grade.",
    }),
    gender: Object.freeze({
      label: "Gender card", title: "KRW's gender card", table: "Gender league table", grade: "gender_card",
      estimate: "gender_estimate", se: "gender_se", mean: "mean_gender", lower: "lower_gender", upper: "upper_gender",
      grade1: "Grade 1 = stated highest on male-name contact advantage, as the posterior judges it.",
      axis: "Log contact gap, male-named minus female-named",
      scale: "Both panels show the log contact gap: the log of the contact rate of male-named applications minus that of female-named ones. Above zero, male-named applications were contacted more often; below zero, female-named ones.",
      // KRW §VIII, Figure 14
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
  // the bars span the estimate ± seWidth SE (SR-08)
  seWidth: 1,
  // KRW's Figure 7 and Figure 14 captions: "95 percent credible intervals" (a cited source fact; the released data
  // file does not carry it)
  krwLevel: 0.95,
  digits: Object.freeze({ value: 3 }),
  // axis domains: ends on multiples of 1, 2, 2.5 or 5 × 10^k, about `ticks` steps, 0 always inside
  nice: Object.freeze({ ticks: 4, mantissas: Object.freeze([1, 2, 2.5, 5, 10]), decimals: 12 }),
  percent: 100,
  pageRows: 10,
  // rows shown at each end of the league table until Show all
  showRows: 10,
  // the three parts of a set of pairs in the pair bars, in bar order: the card's directions that run as the table
  // does, those that run the other way, and the pairs it is silent on
  pairParts: Object.freeze(["agree", "against", "silent"]),
  // reversed pairs are named, in the card's bar and in the selected firm's strip, when there are at most this many
  revNames: 3,
  // phones: at or below this width "Find a firm" moves into the selected firm's strip (the frame's 600 px breakpoint)
  narrowQuery: "(max-width: 37.5em)",
  // the card: rowPx per firm; light grade bands, their fill opacity alternating between the two tints so that
  // neighboring grades separate (the legend swatches mix the same shares); labelGap px between an interval and the
  // selected firm's name; grade numbers at least labelPx px apart
  chart: Object.freeze({
    rowPx: 5, marginTop: 8, marginBottom: 38, marginLeft: 24, marginRight: 14,
    line: 1.25, dot: 1.8, tints: Object.freeze([0.26, 0.1]), dash: "3,2", gradeDx: 7, half: 0.5, labelGap: 6, labelPx: 12,
  }),
  text: Object.freeze({
    missing: "The KRW data did not load, so this app cannot show the firms.",
    cardLegend: "Card",
    sortLegend: "Order the league table by",
    findLabel: "Find a firm",
    findHint: "Type part of a name; press Enter for the next match.",
    tableHeading: "League table",
    scrollHint: "The table scrolls sideways: more columns sit to the right of the firm names.",
    barNote: Object.freeze(["Bars: estimate ± ", "{se}", " SE (such a bar covers the true value in about ", "{within}", " of repeated estimates)."]),
    orderNote: Object.freeze({ estimate: "Ordered by estimate, largest first.", mean: "Ordered by posterior mean, largest first." }),
    // the columns in their order (review 044, X-09: the card grade right after the firm)
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
    // after "marked ↕" in the strip when some of the marked firms are among the rows the short table does not show
    revHidden: Object.freeze([" (", "{count}", " in the rows not shown)"]),
    // the note above the card (review 044, U1-F4): the marks, the level KRW's figure shows and the order within a grade;
    // the sentence on the shaded bands moves with the band legend into the "Card source" box
    cardNote: Object.freeze(["Dots: posterior means. Lines: ", "{level}", " posterior intervals (KRW's ", "{figure}", " shows ", "{krwLevel}", " intervals); within a grade, firms by posterior mean."]),
    bandsNote: "Shaded bands: the grades, grade 1 at the top.",
    cardSource: "Card source",
    // the pair bars: the title of the card's bar (it names the card), the words after each count, and the strip's bar
    // for one firm
    pairsTitle: Object.freeze(["All ", "{total}", " pairs of firms · ", "{card}"]),
    pairWords: Object.freeze({ agree: " stated as the table does", against: " stated the other way", silent: " silent (same grade)" }),
    // after "stated the other way" when the card states at most CONFIG.revNames such pairs: each pair as the card
    // states it ("the card puts State Farm above VFC (North Face / Vans)")
    revPairsLead: ": the card puts ",
    revPairAbove: " above ",
    revPairSep: "; ",
    firmPairsTitle: Object.freeze(["Its ", "{total}", " pairs"]),
    firmWords: Object.freeze({ agree: " as the table does", against: " the other way", silent: " silent" }),
    // the firms on the other side of the selected firm's reversed pairs: named after the count when few, marked in the
    // table in any case (the mark's alternative text for screen readers is revMarkSr)
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
    // how the directions a card states run against the table's order (shown order: the strictOrder ranks): the parts
    // of "{agree} as the table does and {against} the other way", or one of the two "all" forms
    agreeA: " as the table does and ",
    againstA: " the other way",
    allAgree: "all as the table does",
    allAgainst: "all the other way",
    noMatch: "No firm name contains this text.",
    match: Object.freeze(["{count}", " firms match; showing match ", "{k}", ". Press Enter for the next."]),
    // the read-out: v1's three sentences verbatim, then one sentence on how the directions the card states run against
    // the table's order as shown
    readA: "The league table states a direction for every one of the ",
    readB: " pairs of firms. ",
    readC: " states ",
    readD: " of them, a share of ",
    readE: ": the pairs whose two firms are in different grades. It is silent on the ",
    readF: " pairs that share a grade (",
    readInside: " inside grade ",
    readAnd: " and ",
    readEnd: ").",
    readOrderA: " Of the ",
    readOrderB: " directions the card states, ",
    readOrderC: " run as the table does and ",
    readOrderD: " the other way.",
    readOrderAll: Object.freeze([" All ", " directions the card states run as the table does."]),
    readOrderNone: Object.freeze([" All ", " directions the card states run the other way."]),
    // the KRW data notice (register CR-054), one string on the page and in the standalone embed: its last sentence is
    // the conduct line; the embed adds the change note and the site's own disclaimer after it
    notice: "Data: Kline, Rose and Walters (2024), doi:10.1257/aer.20230700, and deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only; as adapted in postrank 1.1.0 (pr_case_krw), changes noted; no endorsement by the authors is implied.",
    noticeConduct: "The data describe KRW's correspondence experiment, not any firm's current conduct.",
    noticeChanges: "Changes: a smoothed version of KRW's posteriors (continuous cells with central intervals in place of KRW's posterior grids), from postrank 1.1.0 (pr_case_krw); KRW's published cards as released.",
    noticeAsIs: "Provided as is, without warranty.",
  }),
});

const T = CONFIG.text;
/** A text as a CSS string (for generated content). */
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

/** Everything one card needs: values, ranks, card order, counts. Ranks and counts come from the engine. */
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
  // per firm: the directions the card states about it and the firms that share its grade (engine unitRelationCounts,
  // the row counts of the relation matrix)
  const rel = unitRelationCounts(grade);
  // the directions the card states against the table's shown order (engine statedAgainst on the strictOrder ranks, 1 at
  // the top, so "ascending"): the card's count and its pairs ({ above, below } as the card states them), per firm the
  // number of pairs of that list it belongs to (per), and per firm the firms on the other side of those pairs (firms;
  // marked ↕ in the table while the firm is selected). The ranks are strict, so every other stated pair runs as the
  // table does: agree = stated − against.
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
  const w = CONFIG.seWidth;
  return {
    key, card: c, est, se, mean, lower, upper, grade, disc, rankEst, rankMean, order, pos, stated: rel.stated, withheld: rel.withheld,
    partners: rel.partners,
    against: { estimate: againstOrder(rankEst), mean: againstOrder(rankMean) },
    inside: Array.from(disc.sizes, (s) => pairCount(s)),
    rows: { estimate: byRank(rankEst), mean: byRank(rankMean) },
    estAxis: niceAxis(Math.min(...est.map((x, i) => x - w * se[i])), Math.max(...est.map((x, i) => x + w * se[i]))),
    cardAxis: niceAxis(Math.min(...lower), Math.max(...upper)),
  };
}

/** The grade bands of a card in row positions: { grade, first, last, mid, at } with `at` the grade number's row,
 * pushed down to stay `gap` rows below the number above it (thin bands, such as the gender card's grades 1 and 2). */
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

/** The fill opacity of a grade band: the two tints alternate from grade 1. */
const tintOf = (g) => CONFIG.chart.tints[(g - 1) % CONFIG.chart.tints.length];

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `
.prx-cz .prx-cz-find { flex: 1 1 14rem; }
.prx-cz .prx-cz-find input { width: 100%; }

.prx-cz .prx-cz-heading { margin: 0 0 0.25rem; font-size: 1em; font-weight: 600; line-height: 1.3; color: var(--prx-fg-heading); }
.prx-cz .prx-cz-note { margin: 0 0 0.35rem; font-size: 0.9em; color: var(--prx-fg-muted); }
.prx-cz .prx-cz-scroll-hint { margin: 0 0 0.35rem; }
.prx-cz .prx-cz-grade1 { font-weight: 600; color: var(--prx-fg); }
.prx-cz .prx-cz-notice { margin: 0.5rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); overflow-wrap: anywhere; }
.prx-cz .prx-cz-notice strong { font-weight: 600; color: var(--prx-fg); }
.prx-cz .prx-cz-missing { margin: 0; padding: 0.75rem; border: 1px dashed var(--prx-border-strong); border-radius: var(--prx-radius, 6px); }

/* the two part bars (js/shared/partbar.js and styles/app.css .prx-partbar*, lifted from this app's pair bar): only
   where they sit is the app's own */
.prx-cz .prx-cz-charts > .prx-partbar { margin: 0 0 0.6rem; }
.prx-cz .prx-cz-details .prx-partbar { margin: 0.3rem 0 0.15rem; }

/* the selected firm: a strip under the pair bar; the heading and the firm's name on one line (on phones "Find a firm"
   joins them, on a line of its own), then its own part bar and the details lines */
.prx-cz .prx-cz-details {
  margin: 0 0 0.75rem; padding: 0.45rem 0.75rem 0.5rem; background: var(--prx-bg); border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px); font-variant-numeric: tabular-nums;
}
.prx-cz .prx-cz-details-head { display: flex; flex-wrap: wrap; gap: 0.1rem 0.6rem; align-items: baseline; }
.prx-cz .prx-cz-details-head .prx-cz-heading { margin: 0; }
.prx-cz .prx-cz-details-head > .prx-cz-find { flex: 1 1 100%; margin: 0.35rem 0 0.1rem; }
.prx-cz .prx-cz-details-name, .prx-cz .prx-cz-details-line, .prx-cz .prx-cz-find-status { margin: 0.15rem 0 0; }
.prx-cz .prx-cz-details-head .prx-cz-details-name { margin: 0; }

/* the two panels: side by side in a wide container, stacked below 54rem (the site page's column at 1280 px gives the
   charts about 957 px at a 17 px root font, 56.3rem; the 16 px standalone page about 1,125 px). The card comes first,
   in the DOM and on screen, so it also comes first when the panels stack. Side by side, the table's box keeps its
   natural height up to 46rem: the short table (the top ten, the gap row and the bottom ten: 40.5rem to 45.2rem tall at
   the widths where the panels sit side by side) shows whole beside the card, whose column is shorter now that its
   source notes sit in a closed box, and all 97 rows scroll inside the box. The container is named: the league panel is
   a container of its own, and the table box inside it must still answer to the charts' width. */
.prx-cz .prx-cz-charts { container: prx-cz-charts / inline-size; }
.prx-cz .prx-cz-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.prx-cz .prx-cz-panel { min-width: 0; }
@container prx-cz-charts (min-width: 54rem) {
  .prx-cz .prx-cz-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr); }
  .prx-cz .prx-cz-league .prx-cz-table-box { max-height: 46rem; }
}
.prx-cz .prx-cz-league-head { display: flex; flex-wrap: wrap; gap: 0.2rem 0.75rem; align-items: baseline; margin: 0 0 0.3rem; }
.prx-cz .prx-cz-league-head > * { margin: 0; }
.prx-cz .prx-cz-scale { margin: 0.75rem 0 0; }
.prx-cz .prx-cz-prior { margin: 0.35rem 0 0; }
/* the note above the card: v1's grade legend and, joined to it as one box on plot paper (both are legends), the
   marks, KRW's 95% and the order within a grade; the closed "Card source" box sits under the figure */
.prx-cz .prx-cz-card .prx-cz-grade1 { margin: 0; padding: 0.2rem 0.45rem 0.05rem; border-radius: 4px 4px 0 0; }
.prx-cz .prx-cz-card-note { padding: 0.05rem 0.45rem 0.2rem; border-radius: 0 0 4px 4px; }
.prx-cz .prx-cz-card .prx-disclosure { margin: 0.5rem 0 0; }
.prx-cz .prx-cz-card .prx-disclosure-body > :last-child { margin-bottom: 0; }

/* the league table in its own scroll box */
.prx-cz .prx-cz-table-box {
  position: relative; max-width: 100%; max-height: 26rem; overflow: auto; background: var(--prx-bg);
  border: 1px solid var(--prx-border-strong); border-radius: var(--prx-radius, 6px);
}
.prx-cz .prx-cz-table {
  width: 100%; min-width: 38rem; max-width: none; margin: 0; border-collapse: separate; border-spacing: 0;
  font-size: 0.875em; font-variant-numeric: tabular-nums; overflow-wrap: normal;
}
.prx-cz .prx-cz-table th, .prx-cz .prx-cz-table td {
  padding: 0.2rem 0.45rem; text-align: left; vertical-align: middle; white-space: nowrap; background: var(--prx-bg);
  border-bottom: 1px solid var(--prx-border);
}
.prx-cz .prx-cz-table thead th {
  position: sticky; top: 0; z-index: 2; vertical-align: bottom; white-space: normal; font-weight: 600;
  color: var(--prx-fg-heading); background: var(--prx-bg-raised); border-bottom: 1px solid var(--prx-border-strong);
}
/* rank and firm stay in view when the table scrolls sideways: the shared prx-sticky-two class (styles/app.css, a
   cascade layer that acts only while the box overflows) keeps the first two columns, the firm column at the rank
   column's width (--prx-sticky-first-width) and casting a shadow once the box is scrolled; the cells keep the table's
   own surface (the app's rules win over the layer), so the selection and hover tints reach them. The header's two
   corner cells stay above the header cells that scroll under them (the app's header cells are z-index 2). */
.prx-cz .prx-cz-table { --prx-sticky-first-width: 3.75rem; }
.prx-cz .prx-cz-table .prx-cz-col-rank { width: 3.75rem; min-width: 3.75rem; max-width: 3.75rem; white-space: normal; }
.prx-cz .prx-cz-table .prx-cz-col-firm { min-width: 8.5rem; max-width: 11rem; white-space: normal; border-right: 1px solid var(--prx-border); }
.prx-cz .prx-cz-table thead .prx-cz-col-rank, .prx-cz .prx-cz-table thead .prx-cz-col-firm { z-index: 3; }
.prx-cz .prx-cz-table tbody th { font-weight: 400; color: var(--prx-fg); cursor: pointer; }
.prx-cz .prx-cz-table tbody tr { cursor: pointer; }
.prx-cz .prx-cz-col-sub { display: block; font-size: 0.85em; font-weight: 400; color: var(--prx-fg-muted); }
.prx-cz .prx-cz-table tbody tr:hover > * { background: var(--prx-bg-raised); }
.prx-cz .prx-cz-table tbody tr.prx-cz-selected > * { background: var(--prx-bg-sunken); font-weight: 600; }
.prx-cz .prx-cz-table tbody tr.prx-cz-selected > .prx-cz-col-rank { box-shadow: inset 4px 0 0 var(--prx-accent); }
/* the firms of the selected firm's reversed pairs: a bar on the rank cell in the color of "the other way" in the pair
   bars, and ↕ after the grade badge. The mark is generated content, so each cell's text stays what it states (its grade);
   its alternative text names the mark for screen readers (the plain form first, for browsers without the "/" syntax) */
.prx-cz .prx-cz-table tbody tr.prx-cz-rev > .prx-cz-col-rank { box-shadow: inset 4px 0 0 var(--prx-rel-below); }
.prx-cz .prx-cz-table tbody tr.prx-cz-rev > .prx-cz-col-grade::after {
  content: ${cssString(T.revMark)}; content: ${cssString(T.revMark)} / ${cssString(T.revMarkSr)};
  margin-left: 0.35rem; font-weight: 700; color: var(--prx-fg);
}
.prx-cz .prx-cz-table tbody th:focus-visible { outline: var(--prx-focus-width, 2px) solid var(--prx-focus); outline-offset: calc(-1 * var(--prx-focus-width, 2px)); }
.prx-cz .prx-cz-table .prx-cz-col-other, .prx-cz .prx-cz-table .prx-cz-col-industry { color: var(--prx-fg-muted); }
/* the gap row stands for the hidden middle rows until Show all; its text stays in view when the table scrolls */
.prx-cz .prx-cz-table tbody tr.prx-cz-gap { cursor: default; }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap > td { padding: 0.35rem 0.45rem; font-style: italic; color: var(--prx-fg-muted); background: var(--prx-bg-sunken); }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap > td > span { position: sticky; left: 0.45rem; }
.prx-cz .prx-cz-table tbody tr.prx-cz-gap:hover > * { background: var(--prx-bg-sunken); }
.prx-cz .prx-cz-table td.prx-cz-col-mean { color: var(--prx-post-text); }
/* estimate ± 1 SE: a bar on the plot panel color, then the numbers in the estimate's text color */
.prx-cz .prx-cz-table .prx-cz-col-est { min-width: 13rem; }
.prx-cz .prx-cz-table thead .prx-cz-col-other { min-width: 6.5rem; }
/* a roomy table keeps each firm's name on one line */
.prx-cz .prx-cz-league { container-type: inline-size; }
@container (min-width: 40rem) {
  .prx-cz .prx-cz-table .prx-cz-col-firm { min-width: 11.5rem; max-width: none; white-space: nowrap; }
}
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

/* the card: its band legend sits on the plot paper in every theme, like the bands it explains */
.prx-cz .prx-cz-bands {
  display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; align-items: center; margin: 0 0 0.35rem; padding: 0.2rem 0.45rem;
  font-size: 0.9em; border-radius: 4px;
}
.prx-cz .prx-cz-band { display: inline-flex; gap: 0.3rem; align-items: center; }
/* a grade band's tint: its grade color at the band's fill opacity (set by the app as --prx-cz-mix) on the plot
   panel color */
.prx-cz .prx-cz-swatch {
  display: inline-block; flex: none; width: 0.95rem; height: 0.95rem;
  background: color-mix(in srgb, var(--prx-cz-swatch, #153653) var(--prx-cz-mix, 20%), var(--prx-plot-bg));
  border: 1px solid var(--prx-cell-border);
}
.prx-cz .prx-cz-card-chart { max-width: 100%; }
.prx-cz .prx-cz-sel { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; pointer-events: none; }
.prx-cz .prx-cz-sel-box { position: absolute; border: 1.5px solid var(--prx-plot-focus); border-radius: 2px; }
.prx-cz .prx-cz-sel-bar { position: absolute; height: 3px; margin-top: -1.5px; background: var(--prx-post); }
.prx-cz .prx-cz-sel-dot {
  position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; background: var(--prx-post); border-radius: 50%;
  box-shadow: 0 0 0 2px var(--prx-plot-bg);
}
.prx-cz .prx-cz-sel-label {
  position: absolute; max-width: 60%; padding: 0 0.3rem; overflow: hidden; font-size: 0.8em; font-weight: 600; line-height: 1.4;
  color: var(--prx-plot-fg); text-overflow: ellipsis; white-space: nowrap; background: var(--prx-plot-bg);
  border: 1px solid var(--prx-plot-axis); border-radius: 3px; transform: translate(0.4rem, -50%);
}
.prx-cz .prx-cz-sel-label.prx-cz-sel-left { transform: translate(calc(-100% - 0.4rem), -50%); }
.prx-cz .prx-cz-sel-label.prx-cz-sel-inside { transform: translate(calc(-100% - 2px), -50%); }

/* narrow screens: the controls stack, choices keep one row each; narrower sticky columns leave room for the
   estimate when the table scrolls sideways */
@media (max-width: 30em) {
  .prx-cz .prx-cz-cards, .prx-cz .prx-cz-sorts, .prx-cz .prx-cz-find { flex: 0 0 auto; }
  .prx-cz .prx-cz-find { width: 100%; }
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
    // the shared result-first frame (review 044, X-01): title, controls and preset row, the read-out, the charts (the
    // pair bar first), then the caption; base.js only moves nodes, so keys, presets, hooks and the live region are kept
    layout: "result-first",
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
        ctx.charts.append(h("p", { class: "prx-cz-missing", text: T.missing }));
        return { render() {} };
      }
      const views = {};
      const view = (key) => (views[key] ??= cardView(D, key));
      const within = normalCdf(CONFIG.seWidth) - normalCdf(-CONFIG.seWidth);
      const level = D.level;

      // number helpers: a data-num span, one with a read-out hook, a firm name (a name, not a number)
      const num = (raw, display) => ctx.num(raw, display);
      const ro = (name, raw, display) => { const s = ctx.num(raw, display); s.setAttribute("data-prx-readout", name); return s; };
      const val = (x) => formatDecimal(x, { digits: CONFIG.digits.value });
      const count = (x) => num(x, formatCount(x));
      const nameNode = (i, tag = "span") => h(tag, { "data-prx-name": "", text: D.names[i] });
      const fill = (parts, slots) => parts.map((p) => { const m = /^\{(\w+)\}$/.exec(p); return m ? slots[m[1]]() : p; });

      // the firm shown as selected (an index), the card and order last drawn, the theme last drawn with
      let selected = null;
      let lastCard = null;
      let lastSort = null;
      let lastTheme = null;
      // the league table shows only its two ends until Show all (key rows; selecting a hidden firm sets it to all)
      let expanded = false;
      // the resolved palette, kept until the theme changes (reading the tokens is the costly part of a redraw)
      let palCache = null;
      const pal = () => (palCache ??= palette(ctx.root));
      // how the next render shows the selection (scroll its row into view, focus its cell, keep the find line):
      // set by the reader's action just before it changes the state, used once
      let pending = null;
      // true while a render runs: a redraw of the card gives focus back to its keyboard point, and that focus is not
      // the reader choosing a firm
      let rendering = false;
      let matches = [];
      let matchAt = 0;

      const themeKey = () => [ctx.root.getAttribute("data-theme"), ctx.doc.documentElement.getAttribute("data-theme"),
        ctx.win.matchMedia?.("(prefers-color-scheme: dark)")?.matches].join("|");
      /** The firm a state selects: the named firm, or the first row of the state's order. */
      const firmOf = (state) => (state.firm === CONFIG.firstFirm || !D.idIndex.has(state.firm)
        ? view(state.card).rows[state.sort][0] : D.idIndex.get(state.firm));
      /** The firm key of firm i in a state: "first" when it heads the state's order, else its id (so a setting has
       * one key, and the preset row finds it). */
      const firmKey = (i, state) => (i === view(state.card).rows[state.sort][0] ? CONFIG.firstFirm : D.ids[i]);
      /** A new card or order that keeps the firm on screen selected. */
      const keepFirm = (patch) => {
        const next = { ...ctx.state, ...patch };
        return selected === null ? patch : { ...patch, firm: firmKey(selected, next) };
      };

      // --- controls: the card and the order of the league table (two radio groups, one Tab stop each, arrow keys
      // between the options), a find box
      const cardSeg = ctx.radioGroup({
        legend: T.cardLegend, name: "card", className: "prx-cz-cards",
        options: CONFIG.cardOrder.map((k) => ({ value: k, label: CONFIG.cards[k].label })),
        value: ctx.state.card,
        onChange: (v) => { if (v !== ctx.state.card) ctx.set(keepFirm({ card: v })); },
      });
      const sortSeg = ctx.radioGroup({
        legend: T.sortLegend, name: "sort", className: "prx-cz-sorts",
        options: CONFIG.sorts.map((s) => ({ value: s.value, label: s.label })),
        value: ctx.state.sort,
        onChange: (v) => { if (v !== ctx.state.sort) ctx.set(keepFirm({ sort: v })); },
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
      ctx.listen(find.input, "keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        if (matches.length) {
          matchAt = (matchAt + 1) % matches.length;
          choose(matches[matchAt], { scroll: true, found: true });
          drawFindStatus();
        }
      });
      ctx.controls.append(cardSeg.root, sortSeg.root, find.root);

      // --- the pair bar of the card (the shared partBar, review 044 U1-F1): all pairs of firms in three parts, each
      // count written under the track; the first panel under the read-out, and the graphic the card and the order change
      const PARTS = CONFIG.pairParts.map((key) => ({ key, role: key }));
      const pairs = partBar(ctx, { hook: "pairs", parts: PARTS });
      ctx.primaryGraphic(pairs.root);

      // --- selected firm: a strip under the pair bar, with its own (compact) part bar; then v1's details lines, the
      // pairs line first (it says in words what the small bar shows), then the rank and grade lines
      const detailsName = h("p", { class: "prx-cz-details-name" });
      const firmPairs = partBar(ctx, { hook: "firm-bar", parts: PARTS, compact: true });
      const detailsRank = h("p", { class: "prx-cz-details-line" });
      const detailsGrade = h("p", { class: "prx-cz-details-line" });
      const pairsLine = h("p", { class: "prx-cz-details-line prx-cz-pairs" });
      const findStatus = h("p", { class: "prx-hint prx-cz-find-status", hidden: true });
      detailsRank.id = uid("prx-cz-rank");
      detailsGrade.id = uid("prx-cz-grade");
      const detailsHead = h("div", { class: "prx-cz-details-head" }, ctx.panelTitle(T.detailsHeading, { className: "prx-cz-heading" }), detailsName);
      const details = h("section", { class: "prx-cz-details", "aria-label": T.detailsHeading, "data-prx-part": "readout" },
        detailsHead, findStatus, firmPairs.root, pairsLine, detailsRank, detailsGrade);

      // phones (<= 600 px): "Find a firm" drives only the selected firm, so it moves into the strip's head, next to the
      // firm it finds (CONVENTIONS, result-first frame); wider screens keep it in the controls row. The node itself
      // moves, so the typed text, the match line, the datalist and the firm key are unchanged, and Tab order follows the
      // layout (controls, presets, then the strip's find box on phones).
      const narrow = ctx.win.matchMedia?.(CONFIG.narrowQuery) ?? null;
      function placeFind() {
        const inStrip = Boolean(narrow?.matches);
        if (inStrip === (find.root.parentNode === detailsHead)) return;
        const focused = ctx.doc.activeElement === find.input;
        if (inStrip) detailsHead.append(find.root); else sortSeg.root.after(find.root);
        if (focused) find.input.focus({ preventScroll: true });
      }
      if (narrow) ctx.listen(narrow, "change", placeFind);
      placeFind();

      // --- league table: the card grade right after the firm, so the grade compared stays in view while the box
      // scrolls sideways (review 044, X-09); rank and firm stick through the shared prx-sticky-two rule
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
      const table = h("table", { class: "prx-cz-table prx-sticky-two", id: tableId }, caption,
        h("thead", {}, h("tr", {}, head.rank, head.firm, head.grade, head.est, head.mean, head.other, head.industry)), tbody);
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
        const tr = h("tr", { "data-prx-row": D.ids[i] },
          cells.rank, cells.firm, cells.grade,
          h("td", { class: "prx-cz-col-est" }, strip, h("span", { class: "prx-cz-est-text" }, cells.est, " ± ", cells.se)),
          cells.mean, cells.other,
          h("td", { class: "prx-cz-col-industry", "data-prx-name": "", text: String(D.industry[i]) }));
        tbody.append(tr);
        return { tr, cells, zero, bar, dot };
      });
      // the gap row stands for the hidden middle rows while the table shows only its two ends
      const gapCount = h("span", {});
      const gapRow = h("tr", { class: "prx-cz-gap" }, h("td", { colspan: "7" }, gapCount));
      const showBtn = ctx.button({
        label: T.showAll, key: "show-all",
        onClick: () => { pending = { scroll: true }; ctx.set({ rows: expanded ? "ends" : "all" }); },
      });
      showBtn.root.classList.add("prx-cz-show");
      showBtn.root.setAttribute("aria-controls", tableId);
      const barNote = h("p", { class: "prx-cz-note prx-cz-bar-note", "data-prx-part": "legend" });
      const orderNote = h("p", { class: "prx-cz-note" });
      const tableHeading = ctx.panelTitle(T.tableHeading, { className: "prx-cz-heading prx-cz-table-heading" });
      const scrollHint = h("p", { class: "prx-hint prx-cz-scroll-hint", text: T.scrollHint, hidden: true });
      // the heading, the order note and the Show all button share one row where there is room (the review's sketch:
      // "Race league table [Show all]"); then the bar note, the scroll hint and the box
      const tablePanel = h("section", { class: "prx-cz-panel prx-cz-league", "aria-label": T.tableHeading },
        h("div", { class: "prx-cz-league-head" }, tableHeading, orderNote, showBtn.root), barNote, scrollHint, tableBox);

      // --- the card: its heading, one note above the figure (v1's grade legend, joined in one box with how KRW's figure
      // marks grade 1 where the source says so, the marks, KRW's 95% and the order within a grade), the figure, the race
      // card's prior note (why its intervals lie right of zero beside negative estimates), then a closed "Card source"
      // box with v1's KRW caption, the plain gloss and the band legend (review 044, U1-F4: moved, not removed)
      const cardHeading = ctx.panelTitle("", { className: "prx-cz-heading" });
      const gradeLegend = h("p", { class: "prx-cz-note prx-cz-grade1", "data-prx-part": "legend" });
      const starNote = h("span", { class: "prx-cz-star" });
      const marksNote = h("span", { class: "prx-cz-marks" });
      const cardNote = h("p", { class: "prx-cz-note prx-cz-card-note", "data-prx-part": "legend" }, starNote, marksNote);
      const cardSlot = h("div", { class: "prx-cz-card-chart" });
      const priorNote = h("p", { class: "prx-cz-note prx-cz-prior", "data-prx-part": "notes", hidden: true });
      const cardPanel = h("section", { class: "prx-cz-panel prx-cz-card", "aria-label": T.cardLegend },
        cardHeading, gradeLegend, cardNote, cardSlot, priorNote);
      const source = ctx.disclosure({ name: "card-source", title: T.cardSource, placement: { after: priorNote } });
      const cardCaption = h("p", { class: "prx-cz-note prx-cz-krw", "data-prx-part": "caption" }, captionNode(ctx, "krw-card"));
      const krwGloss = h("p", { class: "prx-cz-note prx-cz-gloss", "data-prx-part": "caption", text: T.krwGloss });
      const bands = h("p", { class: "prx-cz-bands prx-light-panel", "data-prx-part": "legend" });
      source.body.append(cardCaption, krwGloss, h("p", { class: "prx-cz-note", "data-prx-part": "legend", text: T.bandsNote }), bands);

      const scaleNote = h("p", { class: "prx-cz-note prx-cz-scale", "data-prx-part": "notes" });
      ctx.charts.classList.add("prx-cz-charts");
      // the result-first order: the pair bar (what the card and the order change), the selected firm's strip, then the
      // card and the league table (the card first), then the scale note
      ctx.charts.append(pairs.root, details, h("div", { class: "prx-cz-grid" }, cardPanel, tablePanel), scaleNote);

      // --- the notice: a standalone embed keeps the data notice (the same string as the page's), the change note and
      // the site's disclaimer; a site page has its own callout and credit (one of each per page)
      if (!ctx.doc.querySelector?.('meta[name="quarto:offset"]')) {
        const notice = h("p", { class: "prx-cz-notice" }, `${T.notice} `, h("strong", { text: T.noticeConduct }),
          ` ${T.noticeChanges} ${T.noticeAsIs}`);
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
        // the narrow bar column labels only its two ends and zero
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
        // the gap row sits after the top rows
        rowEls[v.rows[sort][CONFIG.showRows]].tr.before(gapRow);
        orderNote.textContent = T.orderNote[sort];
        caption.replaceChildren(...fill(T.caption, { table: () => v.card.table, n: () => count(D.n) }), ` ${T.orderNote[sort]}`);
      }

      /** The rows a short table hides: the middle of the order (the selected firm's row is never hidden). */
      const middle = (order, k) => k >= CONFIG.showRows && k < order.length - CONFIG.showRows;

      /** Hide the middle rows of the league table unless it is expanded (the selected firm's row stays); the gap row
       * counts the hidden rows (v1's words), and hiddenMarked keeps how many of them carry ↕ (the strip says so). */
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

      /** Mark the firms on the other side of the selected firm's reversed pairs (a class: ↕ after the grade and a bar on
       * the rank cell, both drawn by CSS) and unmark the rest; `firms` comes from the card view's statedAgainst list for
       * the order shown. */
      let marked = new Set();
      function markReversed(firms) {
        const next = new Set(firms);
        for (const j of marked) if (!next.has(j)) rowEls[j].tr.classList.remove("prx-cz-rev");
        for (const j of next) rowEls[j].tr.classList.add("prx-cz-rev");
        marked = next;
      }

      /** Keep a row in view inside the table box, below the sticky header (the page itself does not scroll). */
      function scrollRow(i) {
        const tr = rowEls[i].tr;
        const box = tableBox.getBoundingClientRect();
        const r = tr.getBoundingClientRect();
        const headH = table.tHead?.getBoundingClientRect().height ?? 0;
        if (!(box.height > 0)) return;
        if (r.top < box.top + headH) tableBox.scrollTop -= box.top + headH - r.top;
        else if (r.bottom > box.bottom) tableBox.scrollTop += r.bottom - box.bottom;
      }

      // one Tab stop in the table body (the selected firm); arrows, Page keys, Home and End move the selection
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

      // ------------------------------------------------------------------------------------- the card

      let chart = null;
      const sel = {
        box: h("span", { class: "prx-cz-sel-box" }),
        bar: h("span", { class: "prx-cz-sel-bar" }),
        dot: h("span", { class: "prx-cz-sel-dot" }),
        label: h("span", { class: "prx-cz-sel-label", "data-prx-name": "" }),
      };
      const selLayer = h("div", { class: "prx-cz-sel", "aria-hidden": "true" }, sel.box, sel.bar, sel.dot, sel.label);

      function drawLegend(v) {
        const c = v.card;
        cardHeading.textContent = c.title;
        cardPanel.setAttribute("aria-label", c.title);
        // the note above the figure: v1's grade legend (its words and hooks), then how KRW's figure marks grade 1 (only
        // where the source says so), the marks, the level KRW's figure shows (a number, not the caption's krw-level
        // hook) and the order within a grade
        gradeLegend.replaceChildren(ro("G", v.disc.G, formatCount(v.disc.G)), T.gradesWord,
          ro("sizes", v.disc.sizes, formatSizes(v.disc.sizes)), ". ", h("span", { class: "prx-cz-grade1-text", text: c.grade1 }));
        starNote.textContent = c.star ? `${c.star} ` : "";
        marksNote.replaceChildren(...fill(T.cardNote, {
          level: () => ro("level", level, formatPercent(level)),
          figure: () => c.figureName,
          krwLevel: () => num(CONFIG.krwLevel, formatPercent(CONFIG.krwLevel)),
        }));
        const colors = gradeColors(v.disc.G, pal());
        // in the "Card source" box, under the sentence on the shaded bands: a swatch and the size of each grade
        bands.replaceChildren(
          ...Array.from(v.disc.sizes, (size, k) => h("span", { class: "prx-cz-band" },
            h("span", { class: "prx-cz-swatch", style: { "--prx-cz-swatch": colors[k], "--prx-cz-mix": `${tintOf(k + 1) * CONFIG.percent}%` } }),
            h("span", {}, "Grade ", count(k + 1), ": ", count(size), size === 1 ? T.firm : T.firms))));
        priorNote.hidden = !c.prior;
        priorNote.textContent = c.prior ?? "";
        scaleNote.replaceChildren(`${c.scale} ${T.scaleNote}`);
      }

      /** The caption: where the posterior means and intervals come from, and the level KRW's figure of this card
       * draws. */
      function drawCaption(v) {
        ctx.caption.replaceChildren(...fill(T.intervalNote, {
          level: () => num(level, formatPercent(level)),
          figure: () => v.card.figure,
          krwLevel: () => ro("krw-level", CONFIG.krwLevel, formatPercent(CONFIG.krwLevel)),
        }));
      }

      const tipText = (v, d) => `${D.names[d.i]}\nGrade ${formatCount(d.grade)} of ${formatCount(v.disc.G)}\nPosterior mean ${val(d.mean)}\n${formatPercent(level)} posterior interval ${val(d.lower)} to ${val(d.upper)}`;

      function drawCard(v) {
        const Cc = CONFIG.chart;
        const n = D.n;
        const rows = v.order.map((i, k) => ({ i, id: D.ids[i], pos: k, grade: v.grade[i], mean: v.mean[i], lower: v.lower[i], upper: v.upper[i] }));
        // grade numbers sit at their band's middle, pushed down when a thin band above leaves less than one line
        const bandList = bandRows(v.disc.sizes, Cc.labelPx / Cc.rowPx);
        const { lo, hi, ticks } = v.cardAxis;
        chart = plot(cardSlot, {
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
          height: Cc.marginTop + Cc.marginBottom + n * Cc.rowPx,
          marginTop: Cc.marginTop, marginBottom: Cc.marginBottom, marginLeft: Cc.marginLeft, marginRight: Cc.marginRight,
          x: { domain: [lo, hi], ticks, label: v.card.axis, labelAnchor: "center", labelArrow: "none" },
          y: { domain: [n - Cc.half, -Cc.half], axis: null },
          color: { type: "identity" },
          marks: (c, P) => {
            const colors = gradeColors(v.disc.G, c);
            return [
              P.rect(bandList, { x1: () => lo, x2: () => hi, y1: (d) => d.first - Cc.half, y2: (d) => d.last + Cc.half, fill: (d) => colors[d.grade - 1], fillOpacity: (d) => tintOf(d.grade) }),
              P.ruleY(bandList.slice(1), { y: (d) => d.first - Cc.half, stroke: c.plotAxis, strokeDasharray: Cc.dash }),
              P.ruleX([0], { stroke: c.plotAxis }),
              P.ruleY(rows, { y: "pos", x1: "lower", x2: "upper", stroke: c.post, strokeWidth: Cc.line }),
              P.dot(rows, { x: "mean", y: "pos", r: Cc.dot, fill: c.post }),
              numText(bandList, { x: () => lo, y: "at", value: "grade", format: (x) => formatCount(x), dx: -Cc.gradeDx, textAnchor: "end", fill: c.plotFg, fontWeight: "bold" }),
              P.tip(rows, P.pointerY({ x: "mean", y: "pos", title: (d) => tipText(v, d) })),
            ];
          },
          keyboard: {
            data: rows, x: "mean", y: "pos", key: (d) => d.id, sort: false, label: T.cardKeys,
            title: (d) => tipText(v, d),
          },
        });
        chart.area.append(selLayer);
        chart.svg.addEventListener("click", (e) => {
          const k = rowAt(e);
          if (k !== null) choose(view(ctx.state.card).order[k], { scroll: true });
        });
      }

      /** The card row under a pointer event, or null (the y scale is linear in row position). */
      function rowAt(e) {
        if (!chart) return null;
        const sy = chart.scale("y");
        const rect = chart.svg.getBoundingClientRect();
        const H = Number(chart.svg.getAttribute("height")) || rect.height;
        if (!(rect.height > 0) || !sy?.domain || !sy?.range) return null;
        const yv = ((e.clientY - rect.top) * H) / rect.height;
        const [d0, d1] = sy.domain;
        const [r0, r1] = sy.range;
        const k = Math.round(d0 + ((yv - r0) * (d1 - d0)) / (r1 - r0));
        return k >= 0 && k < D.n ? k : null;
      }

      /** The card's keyboard reading starts at the selected firm: its point is the one Tab stop of the card (chart.js
       * moves the stop with the arrow keys from there), so tabbing into the card keeps the firm and the preset. */
      function syncCardStop() {
        if (selected === null) return;
        const id = D.ids[selected];
        for (const b of cardSlot.querySelectorAll(".prx-kbd-point")) {
          const key = b.getAttribute("data-prx-focus-key") ?? "";
          b.tabIndex = key.slice(key.lastIndexOf(":") + 1) === id ? 0 : -1;
        }
      }

      function placeSelection() {
        syncCardStop();
        if (!chart || selected === null) { selLayer.hidden = true; return; }
        const v = view(ctx.state.card);
        const sx = chart.scale("x");
        const sy = chart.scale("y");
        const W = Number(chart.svg.getAttribute("width")) || 1;
        const H = Number(chart.svg.getAttribute("height")) || 1;
        const y = sy.apply(v.pos[selected]);
        const [x0, x1] = sx.range;
        const a = sx.apply(v.lower[selected]);
        const b = sx.apply(v.upper[selected]);
        const m = sx.apply(v.mean[selected]);
        const half = CONFIG.chart.rowPx;
        Object.assign(sel.box.style, { left: pct(x0, W), width: pct(x1 - x0, W), top: pct(y - half, H), height: pct(2 * half, H) });
        Object.assign(sel.bar.style, { left: pct(a, W), width: pct(b - a, W), top: pct(y, H) });
        Object.assign(sel.dot.style, { left: pct(m, W), top: pct(y, H) });
        sel.label.textContent = D.names[selected];
        selLayer.hidden = false;
        // the name goes right of the interval when it fits there, else left of it, else inside the plot at its right
        // edge (on top of the lines, on its own background); widths are measured in screen pixels
        const px = (chart.svg.getBoundingClientRect().width || W) / W;
        const need = sel.label.offsetWidth + CONFIG.chart.labelGap;
        const side = (W - b) * px >= need ? "right" : (a - x0) * px >= need ? "left" : "inside";
        sel.label.classList.toggle("prx-cz-sel-left", side !== "right");
        sel.label.classList.toggle("prx-cz-sel-inside", side === "inside");
        Object.assign(sel.label.style, { left: pct(side === "right" ? b : side === "left" ? a : x1, W), top: pct(y, H) });
      }

      // keyboard reading of the card selects the firm read (focus stays on the card)
      ctx.listen(cardSlot, "focusin", (e) => {
        const key = e.target?.getAttribute?.("data-prx-focus-key") ?? "";
        const id = key.startsWith("kbd:") ? key.slice(key.lastIndexOf(":") + 1) : null;
        if (id !== null && D.idIndex.has(id)) choose(D.idIndex.get(id), { scroll: true });
      });

      // ------------------------------------------------------------------------------------- selection

      function drawDetails() {
        if (selected === null) return;
        const v = view(ctx.state.card);
        const i = selected;
        const others = v.withheld[i];
        detailsName.replaceChildren(h("strong", {}, nameNode(i)), ` · ${T.industry}`, h("span", { "data-prx-name": "", text: String(D.industry[i]) }));
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
        // the card's directions about this firm against the table's order as shown (by estimate or posterior mean)
        const sort = ctx.state.sort;
        const against = v.against[sort].per[i];
        const agree = v.stated[i] - against;
        const split = v.stated[i] === 0 ? [] : [", ", ...(against === 0 ? [T.allAgree] : agree === 0 ? [T.allAgainst]
          : [ro("firm-agree", agree, formatCount(agree)), T.agreeA, ro("firm-against", against, formatCount(against)), T.againstA])];
        pairsLine.replaceChildren(T.pairsA, ro("firm-pairs", v.partners, formatCount(v.partners)), T.pairsB, v.card.title, T.pairsC,
          ro("firm-stated", v.stated[i], formatCount(v.stated[i])), T.pairsD, ...split,
          ...(silent === 0 ? [T.pairsNone] : [T.pairsSilent, ro("firm-silent", silent, formatCount(silent)), silent === 1 ? T.pairsSilentOne : T.pairsSilentMany]));
        // the strip's bar: the same three parts of the firm's pairs; after "the other way", the firms on the other side
        // of those pairs in the table's order when there are few (else where to find them), and how many of them the
        // short table does not show (showRows ran just before)
        const rank = sort === "mean" ? v.rankMean : v.rankEst;
        const reversed = v.against[sort].firms[i].slice().sort((a, b) => rank[a] - rank[b]);
        const named = [...(reversed.length <= CONFIG.revNames
          ? [T.revNamed, ...reversed.flatMap((j, k) => (k ? [", ", nameNode(j)] : [nameNode(j)])), T.revMarked] : [T.revMany]),
        ...(hiddenMarked ? fill(T.revHidden, { count: () => count(hiddenMarked) }) : [])];
        firmPairs.set({
          title: (total) => fill(T.firmPairsTitle, { total }), total: v.partners, counts: { agree, against, silent },
          words: T.firmWords, after: (p) => (p === "against" && reversed.length ? named : []),
        });
      }

      /** Show firm i as selected in both views and the details panel; intent: scroll its row into view, focus its
       * cell, and found (the find box chose it, so its match line stays). */
      function select(i, { scroll = false, focus = false, found = false } = {}) {
        if (i === undefined || i === null || !rowEls[i]) return;
        // a firm chosen another way retires the find box's match line
        if (!found && i !== selected) findStatus.hidden = true;
        if (selected !== null) {
          rowEls[selected].tr.classList.remove("prx-cz-selected");
          rowEls[selected].tr.removeAttribute("aria-current");
          rowEls[selected].cells.firm.removeAttribute("aria-describedby");
          rowEls[selected].cells.firm.tabIndex = -1;
        }
        selected = i;
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
        placeSelection();
      }

      /** The reader picks firm i: name it in the firm key (and show every row when its row is hidden in the middle of
       * a short table), then let the render show it as the intent says. Picking the firm already shown changes no
       * setting. */
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
        // a name typed in full (or picked from the list) goes to that firm first
        const exact = matches.findIndex((i) => D.names[i].toLowerCase() === s);
        matchAt = exact >= 0 ? exact : 0;
        if (matches.length) choose(matches[matchAt], { scroll: true, found: true });
        drawFindStatus();
      }
      ctx.listen(find.input, "input", () => { if (!find.input.value.trim()) { matches = []; drawFindStatus(); } });

      // ------------------------------------------------------------------------------------- read-out and pair bar

      /** The card's pair bar: of all M pairs, the directions it states that run as the table's order shown does
       * (N − against), those that run the other way (against) and the pairs it is silent on (M − N); the same engine
       * counts as the read-out's. */
      function drawPairs(v, sort) {
        const d = v.disc;
        const { count: against, pairs: reversed } = v.against[sort];
        // at most CONFIG.revNames reversed pairs: each named after its count, as the card states it
        const named = against > 0 && against <= CONFIG.revNames
          ? [T.revPairsLead, ...reversed.flatMap((p, k) => [k ? T.revPairSep : null, nameNode(p.above), T.revPairAbove, nameNode(p.below)].filter(Boolean))]
          : [];
        pairs.set({
          title: (total) => fill(T.pairsTitle, { total, card: () => v.card.title }), total: d.M,
          counts: { agree: d.N - against, against, silent: d.M - d.N }, words: T.pairWords,
          after: (p) => (p === "against" ? named : []),
        });
      }

      /** v1's three sentences (all pairs; the pairs the card states and their share; the pairs it is silent on, grade
       * by grade), then how many of the card's directions run as the table's order as shown and how many the other
       * way. */
      function drawReadout(v, sort) {
        const d = v.disc;
        const list = [];
        v.inside.forEach((pairs, k) => {
          if (k > 0) list.push(k === v.inside.length - 1 ? T.readAnd : ", ");
          list.push(ro(`inside-${k + 1}`, pairs, formatCount(pairs)), T.readInside, count(k + 1));
        });
        const against = v.against[sort].count;
        const agree = d.N - against;
        const stated = () => ro("stated-directions", d.N, formatCount(d.N));
        const order = d.N === 0 ? []
          : against === 0 ? [T.readOrderAll[0], stated(), T.readOrderAll[1]]
            : agree === 0 ? [T.readOrderNone[0], stated(), T.readOrderNone[1]]
              : [T.readOrderA, stated(), T.readOrderB, ro("agree", agree, formatCount(agree)), T.readOrderC,
                ro("against", against, formatCount(against)), T.readOrderD];
        ctx.readout.set([
          T.readA, ro("M", d.M, formatCount(d.M)), T.readB, v.card.title, T.readC, ro("N", d.N, formatCount(d.N)),
          T.readD, ro("s", d.s, formatProb(d.s)), T.readE, ro("withheld", d.M - d.N, formatCount(d.M - d.N)), T.readF,
          ...list, T.readEnd, ...order,
        ]);
      }

      return {
        render(state, info) {
          ctx.root.setAttribute("aria-busy", "true");
          rendering = true;
          try {
            // a new theme (the OS setting, or the theme key) clears the palette cache and redraws the colors
            const theme = themeKey();
            const themed = theme !== lastTheme;
            if (themed) { palCache = null; lastTheme = theme; }
            cardSeg.set(state.card);
            sortSeg.set(state.sort);
            const v = view(state.card);
            const cardChanged = state.card !== lastCard;
            const moved = cardChanged || state.sort !== lastSort;
            // a new order or card keeps the selected firm and brings its row into view
            const intent = pending ?? { scroll: moved };
            pending = null;
            expanded = state.rows === "all";
            if (cardChanged || themed) { fillTable(v); drawLegend(v); }
            if (cardChanged) drawCaption(v);
            if (moved) orderRows(v, state.sort);
            // the card does not depend on the order, the firm or the rows shown, and opening the "Card source" box
            // (reason "disclosure") changes nothing in it: such a render keeps it
            const redraw = !chart || cardChanged || themed || !["update", "disclosure"].includes(info?.reason);
            lastCard = state.card;
            lastSort = state.sort;
            if (redraw) drawCard(v);
            drawReadout(v, state.sort);
            drawPairs(v, state.sort);
            select(firmOf(state), intent);
            // a phone hides the sideways scrollbar: say that the box scrolls when its columns do not fit
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
