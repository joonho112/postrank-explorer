// majority-wins (app 1.15): "Majority wins and expected rank". A unit beats another by a majority when stating it above
// the other is less often wrong than the reverse; counting the units each one beats gives an order of its own. The
// app sets that order beside two others from the same posterior, the posterior mean and the expected rank (the
// unit's average position under the posterior, 1 at the top), on three data sets:
//   orders   the postrank theory book's ch. 10 law on orders (A, B, C with probability .51; B, C, A, .48; C, B, A, .01;
//            restated and recomputed by the engine): the two orders part ways, and the law gives orders only, not
//            values, so it has no posterior mean (two columns). This is postrank Explorer v1 L-09's collapsed box on
//            the law on orders, shown at once: its lead sentence, its table of majority wins and expected ranks and
//            its closing sentence
//   league   the simulated league (league30, drawLeague(LEAGUE_SEED), the teaching posterior normalPosterior with prior
//            mean 0 and the prior SD key): independent normal posteriors, so majority wins give the posterior-mean
//            order exactly, at every prior SD; the expected rank parts from both on a few pairs
//   krw      Kline, Rose and Walters' 97 firms (data/released/case-krw.json, race or gender pair probabilities as
//            adapted in postrank 1.1.0): on race the majority relation is a strict order of its own, and KRW's card at
//            λ = 1 (data/released/krw-lambda-grid.json, the grid's λ = 1 row; KRW call these grades Condorcet ranks,
//            section II.F) states no pair against it; on gender the relation has one cycle of three firms, which win
//            as many pairs each, and the λ = 1 card puts two of them in one grade, within KRW's solver tolerances
// Views, all drawn from one state (the chart and the unit come first, the data set's panel under them):
//   orders   a slope chart (app 1.14's drawSlopeChart): one column per order, units from 1st (top) to last, a line per
//            unit, crossings where two orders disagree, dashed boxes around equal values (the gender cycle's three
//            firms share their win count); the majority column is shaded. For KRW's firms KRW's card at λ = 1 is a
//            column of its own beside majority wins, in its grade order (its shared grade on gender a dashed box)
//   panel    the data set: the law on orders (lead, table, closing), the league's posteriors, or KRW's card at λ = 1
//            beside the posterior-mean and expected-rank orders (the pairs each states against the majority, its
//            expected wrong claims and DR), the cycle (engine majorityWins' cycleTriples) and the card's shared grade
//   unit     the selected unit (or the one under the pointer): its wins, expected rank and posterior mean with their
//            places; its pairs as bars (navy: the chance it is above the other unit; grey: the chance the other is
//            above it), surest win first, with a dashed line at one half, so the wins are the navy bars that pass
//            the line and the expected rank is one plus the grey parts; the two formulas worked
// Numbers: majorityWins (wins, cycles, strict order), expectedRank (exact, as postrank_expected_rank) or rankSummaries
// (the law), scoreOrder (orders and equal-value blocks), statedAbove at τ = 1/2 (the stated pairs whose direction is
// more likely wrong than right: against the majority, for these tie-free laws), misorderedPairs (majority wins
// against the posterior means), evaluateReport (E, N, G, E/M of a full ranking or a card), lambdaToTau, pairCount.
// The pair probabilities shown are 1 − e (e: the engine's weak error of stating one unit above the other).
// Selection and hover follow app 1.14 (geometry hit test, attribute toggles; the card follows the unit under the
// pointer); a click on a bar selects that unit, and hovering a bar marks it in the slope chart.
//
// Keys: data ("orders" | "league" | "krw"), criterion ("race" | "gender"; KRW only), priorSd (.02-.60, league only),
// unit ("" = the default unit, or a unit id of the data set; a KRW firm may also be named).
import { appLink, createWidget } from "../shared/base.js";
import { numText, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatExpectedCount, formatFraction, formatProb, formatSetting, formatShare } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import { formulaNums, renderTex } from "../shared/math.js";
import {
  LEAGUE_SEED, drawLeague, errorArray, evaluateReport, expectedRank, finiteLawPairwise, lambdaToTau, majorityWins,
  misorderedPairs, normalPosterior, pairCount, rankSummaries, scoreOrder, statedAbove, strictOrder,
} from "../pr-core.js";
import {
  CONFIG as WR, LEAGUE, captionedTable, cssFor, drawSlopeChart, fill, fillText, markUnits, placeText, rankColumns, slopeUnitAt,
} from "./which-ranking.js";
import KRW from "../../data/released/case-krw.json" with { type: "json" };
import GRID from "../../data/released/krw-lambda-grid.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "majority-wins",
  label: "Majority wins and expected rank: the same units ordered by posterior mean, by the number of pairs each more likely wins and by expected rank",
  className: "prx-mw",
  data: Object.freeze({ values: Object.freeze(["orders", "league", "krw"]), value: "orders" }),
  criterion: Object.freeze({ values: Object.freeze(["race", "gender"]), value: "race" }),
  priorSd: Object.freeze({ min: 0.02, max: 0.6, step: 0.01, value: 0.15 }),
  priorMean: 0,
  // the theory book's ch. 10 law on orders: each state's values encode its order only (A, B, C; B, C, A; C, B, A)
  law: Object.freeze({
    ids: Object.freeze(["A", "B", "C"]),
    states: Object.freeze([Object.freeze([3, 2, 1]), Object.freeze([1, 3, 2]), Object.freeze([1, 2, 3])]),
    probs: Object.freeze([0.51, 0.48, 0.01]),
  }),
  // KRW: the criterion of each gap in case-krw.json, its posterior means, and the λ of the cards (krw-lambda-grid.json)
  krw: Object.freeze({
    criteria: Object.freeze({ race: "race_signed", gender: "gender_signed" }),
    means: Object.freeze({ race: "mean_race", gender: "mean_gender" }),
    cardLambda: 1,
  }),
  // "less likely direction": a stated pair whose chance of being wrong is above one half (statedAbove at τ = 1/2)
  half: 0.5,
  // majorityWins' default tolerance; the app compares two errors of one pair the same way (the cycle's directions)
  tieTol: 1e-12,
  memo: 72,
  digits: Object.freeze({
    orders: Object.freeze({ er: 2, prob: 2 }),
    league: Object.freeze({ mean: 3, sd: 3, se: 2, er: 2, prob: 2 }),
    krw: Object.freeze({ mean: 3, er: 2, prob: 4 }),
  }),
  // slope charts: app 1.14's geometry for three units (two columns here) and for the league; for the 97 firms a denser
  // one without unit labels (the card names the firm under the pointer)
  bump: Object.freeze({
    // two columns: narrower, with room on the left for the band behind the first column
    orders: Object.freeze({ ...WR.bump.puzzle, maxWidth: 300, marginLeft: 40 }),
    league: WR.bump.league,
    // labelGap also sets how wide a box of equal values may be (no unit labels here, so it can be wide)
    krw: Object.freeze({ rowH: 8, marginTop: 50, marginBottom: 8, marginLeft: 14, marginRight: 14, maxWidth: 560, dot: 2.4, font: 9, valueFont: 10, labelGap: 12, tieW: 0.1 }),
  }),
  // the selected unit's pairs: bars on one probability axis
  pairs: Object.freeze({
    orders: Object.freeze({ height: 170, marginTop: 18, marginBottom: 26, marginLeft: 34, marginRight: 12, maxWidth: 300, padding: 0.4, valueFont: 12 }),
    league: Object.freeze({ height: 170, marginTop: 14, marginBottom: 10, marginLeft: 34, marginRight: 12, maxWidth: 520, padding: 0.15, valueFont: 0 }),
    krw: Object.freeze({ height: 170, marginTop: 14, marginBottom: 10, marginLeft: 34, marginRight: 12, maxWidth: 520, padding: 0.1, valueFont: 0 }),
    dash: "4,3", line: 1.25, valueDy: -4,
  }),
  text: Object.freeze({
    // controls
    dataLegend: "Data",
    dataOrders: "Law on orders (theory book, chapter 10)",
    dataLeague: "Simulated league (30 units)",
    dataKrw: "KRW's 97 firms",
    critLegend: "KRW's contact gap",
    critRace: "Race (white over Black names)",
    critGender: "Gender (male over female names)",
    priorLabel: "Prior SD of the league's teaching posterior",
    // {app}: the title of app 1.5, a link once it is built (base.js appLink)
    priorHint: "A smaller prior SD pulls the league's posterior means closer together and narrows each posterior (see {app}).",
    shrinkageApp: "shrinkage",
    howTo: "Hover, focus or tap a dot or a bar to follow one unit; a click, a tap or keyboard focus on a dot selects it, and a click on a bar selects that unit. With the keyboard, Tab to a figure and use the arrow keys.",
    // the law on orders (v1 L-09's box)
    lawHeading: "The law on orders",
    lawLead: "A law on orders only: the true order is A, B, C with probability {pABC}; B, C, A with probability {pBCA}; and C, B, A with probability {pCBA}. A is above B with probability {piAB} and above C with probability {piAC}, so A wins both of its pairs by a majority. B is above C with probability {piBC}.",
    lawTableCaption: "Majority wins and expected ranks under the law on orders",
    lawTable: "Majority wins and expected ranks under the law on orders",
    colUnit: "Unit",
    colWins: "Pairs won with probability above one half",
    colExpected: "Expected rank",
    lawEnd: "A wins the most pairs, but its wins are narrow; B's one win is nearly certain. Expected rank weighs how sure each win is, so it puts B first, while counting majority wins puts A first.",
    lawNoMean: "The law fixes the order of the three units in each state, not their values, so it has no posterior mean: the chart compares two orders.",
    // the league
    leagueHeading: "The simulated league",
    leagueLaw: "Each league unit has an independent normal posterior, the teaching posterior of {app}. For independent normal posteriors, whatever their SDs, the larger posterior mean is always the more likely direction. So a unit beats by a majority exactly the units below it by posterior mean, and majority wins give the posterior-mean order at every prior SD.",
    leagueWidths: " The posteriors differ in width (posterior SD {small} for the small units, {medium} for the medium, {large} for the large). The expected rank weighs how sure each pair is, so it can put a few pairs the other way.",
    // KRW
    krwHeading: "KRW's card at λ = {one}",
    // the card and λ glossed once (λ: KRW's weight on a correct direction against a wrong one)
    krwLead: "KRW's card: the grades KRW's code gives the firms for a weight λ on a correct direction against a wrong one; at λ = {one} the two weigh the same, and KRW call these grades Condorcet ranks (section II.F). Every order here ranks a firm higher for a larger {target} contact advantage, as the posterior judges it.",
    targetWords: Object.freeze({ race: "white-name", gender: "male-name" }),
    gapWords: Object.freeze({ race: "race", gender: "gender" }),
    krwTableCaption: "Three rankings of the firms on the {gap} gaps: the pairs each states and how many go against the majority",
    krwTable: "Three rankings of KRW's firms and the pairs they state against the majority",
    colOrder: "Ranking",
    colStated: "Pairs stated",
    colAgainst: "Against the majority",
    colE: "Expected wrong",
    colDR: "Share of pairs expected wrong (KRW's discordance rate, DR)",
    rowMean: "By posterior mean",
    rowEr: "By expected rank",
    rowCard: "KRW's card at λ = {one}",
    krwRaceSame: "KRW's race card at λ = {one} is also a full ranking, but in a slightly different order, so it expects {E} wrong claims where the posterior-mean order expects {Epm}. It states every pair in its more likely direction: it is the order by majority wins itself.",
    krwCardOther: "KRW's {gap} card at λ = {one} states {N} of the {M} pairs and expects {E} of them wrong.",
    krwCycle: "The majority relation has one cycle: {a} beats {b} with probability {p1}, {b} beats {c} with {p2} and {c} beats {a} with {p3}. Each of the three wins {w} pairs, so they share a dashed box, and no full ranking can state all three pairs in their more likely direction.",
    krwCycles: "The majority relation has {count} cycles of three firms, so no full ranking can state every pair in its more likely direction.",
    // the card's shared grade, in two plain sentences (one paragraph)
    krwTie: "The card at λ = {one} has {G} grades: {x} and {y} share one, and it states {s} above {t} against the majority (wrong with probability {e}).",
    krwTieTol: " At λ = {one} stating {w} above {l} (probability {p}) beats one shared grade unless the pair is an even split (theory book, chapter 16); an exact solution would split this grade, which lies within KRW's solver tolerances.",
    grade1: Object.freeze({
      race: "Grade 1 = stated highest on white-name contact advantage, as the posterior judges it.",
      gender: "Grade 1 = stated highest on male-name contact advantage, as the posterior judges it.",
    }),
    // the different-disclosure caption, glossed
    differentGloss: " (they state different numbers of pairs)",
    firmWord: "firm",
    firmRef: "{name} (KRW firm {id})",
    statusFirm: "{status}: {name}, KRW firm {id}.",
    // slope chart
    bumpHeadingFour: "Four orders of the same units",
    bumpHeadingThree: "Three orders of the same units",
    bumpHeadingTwo: "Two orders of the same units",
    bumpNote: "Each column lists the units from 1st (top) to last. A line joins each unit's places; where two lines cross, two orders put that pair differently. The shaded column counts majority wins: the units each one beats.",
    bumpNoteKrw: " Beside it stands KRW's card at λ = {one}, in its grade order. The {n} rows carry no names: hover, tap or use the arrow keys, and the selected firm's panel names it.",
    tieNote: "Dashed box: units with equal values; the order inside a box means nothing.",
    colMean: "Posterior\nmean",
    colWinsHead: "Majority\nwins",
    colCardHead: "KRW's\ncard",
    colEr: "Expected\nrank",
    byMean: "By posterior mean",
    byWins: "By majority wins",
    byCard: "By KRW's card",
    byEr: "By expected rank",
    columnWords: Object.freeze({ mean: "by posterior mean (larger first)", wins: "by majority wins (more first)", card: "by KRW's card (its top grade first)", er: "by expected rank (smaller first)" }),
    bumpAlt: "Slope chart with columns that list the units from first (top) to last: {list}. A line joins each unit's places; crossing lines show pairs that two orders put differently.",
    bumpKeyboard: "Places in the columns. Left and Right move across the columns, Up and Down one place.",
    bumpTableCaption: "Each unit's place in each order (rows by majority wins)",
    colPlaceMean: "Place by posterior mean",
    colPlaceWins: "Place by majority wins",
    colPlaceCard: "Place by KRW's card",
    colPlaceEr: "Place by expected rank",
    colMeanValue: "Posterior mean",
    colWinsValue: "Majority wins",
    colCardValue: "Grade on KRW's card",
    // the unit card
    cardSelected: "Selected unit",
    cardHovered: "Unit under the pointer",
    cardSelectedFirm: "Selected firm",
    cardHoveredFirm: "Firm under the pointer",
    cardLine: "{id}: wins {w} of its {pairs} pairs by a majority ({pw}); expected rank {er} ({pe}); posterior mean {m} ({pm}).",
    cardLineNoMean: "{id}: wins {w} of its {pairs} pairs by a majority ({pw}); expected rank {er} ({pe}).",
    cardLeague: "{id}, a {group} unit (SE {se}), posterior SD {sd}.",
    cardCycle: "{id} is one of the three firms in the majority cycle.",
    groupWords: Object.freeze({ small: "small", medium: "medium", large: "large" }),
    pairsHeading: "The pairs of {id}, surest win first",
    pairsAlt: "Bar chart of the pairs of {id}: one bar per other unit, sorted from the surest win to the surest loss; navy up to the chance that {id} is above the other unit, grey above it to one; a dashed line at one half.",
    pairsTableCaption: "The pairs of {id}, surest win first",
    colOther: "Other unit",
    colAbove: "Chance {id} is above it",
    colBelow: "Chance it is above {id}",
    pairsKeyboard: "The pairs of {id}, one bar per other unit. Left and Right move one bar.",
    pairTitle: "{id} above {other}: probability {p}; {other} above {id}: {q}.",
    keyAbove: "{id} above the other unit",
    keyBelow: "the other unit above {id}",
    keyHalf: "one half",
    pairsNote: "Majority wins count the navy bars that pass one half; the expected rank is one plus the grey parts, so it also counts how sure each win is.",
    texWorked: "The two counts worked",
    formulaNote: "A unit beats another by a majority when stating it above the other is less often wrong than the reverse: with no equal true values, a probability above one half (theory book, chapter 10). The expected rank is the unit's average position under the posterior, {one} at the top; θ is a true value and Y the data. No two units here can have equal true values; where they can, postrank's expected rank also counts each unit with an equal value as higher.",
    formulaNoteKrw: " In the formulas, u is the firm named above.",
    // read-out
    headOrders: "Law on orders: ",
    headLeague: "Simulated league, prior SD {prior}: ",
    headKrw: "KRW's {n} firms, {gap} gap: ",
    readOrders: "majority wins put {wfirst} first (it wins {wcount} pairs), expected rank puts {efirst} first ({er1}, against {wfirst2}'s {er2}).",
    readOrdersAgainst: " The expected-rank order states {b} of the {M} pairs against the majority.",
    readLeagueSame: "majority wins give the posterior-mean order exactly ({mis} of the {M} pairs differ).",
    readLeagueDiff: "majority wins and the posterior means order {mis} of the {M} pairs differently.",
    readLeagueAgainst: " The expected-rank order states {b} pairs against the majority.",
    readStrict: "the majority relation is a strict order.",
    readCycleOne: "the majority relation has {c} cycle of three firms, so no full ranking follows it.",
    readCycleMany: "the majority relation has {c} cycles of three firms, so no full ranking follows it.",
    readKrwAgainst: " Against the majority, the posterior-mean order states {a} of the {M} pairs and the expected-rank order {b}; KRW's card at λ = {one} states {c}.",
    none: "none",
    // notes and captions
    noteOrders: "Three units and a law on their orders only, after the postrank theory book, chapter 10; there are no values, data or fitted model, so every number here is exact.",
    noteLeague: "Simulated league of {n} units (ten small, ten medium, ten large), one fixed draw of the estimates (seed {seed}); teaching posterior with a normal prior of mean {zero} and SD {prior}. Majority wins and expected ranks are exact.",
    noteKrw: "KRW's firms: the log contact gap of white-named minus Black-named applications (race) or of male-named minus female-named applications (gender), with a smoothed version of KRW's posteriors (continuous cells in place of KRW's posterior grids); the cards come from KRW's code.",
    postLead: "The league's posterior: ",
    // one KRW notice (data_contract.json scope cc-by-nc-krw; CR-054): DOIs, the licence as the deposit states it (no
    // version), noncommercial, a change note, no endorsement, the conduct line
    noticeKrw: "Data: Kline, Rose and Walters (2024), A Discrimination Report Card, American Economic Review, doi:10.1257/aer.20230700; replication deposit doi:10.3886/E198284V1; CC-BY-NC as stated by the deposit (no version), noncommercial use only. The data shown here are provided as is and without warranty. No endorsement by the authors is implied.",
    noticeKrwChanges: "Changes: the pair probabilities as adapted in postrank 1.1.0 (pr_case_krw), a smoothed version of KRW's posteriors. The cards at λ = 1 computed with KRW's code (KRW replication companion) under KRW's archived pair probabilities. Majority wins, expected ranks and the counts computed in this browser.",
    noticeKrwConduct: "The data describe KRW's correspondence experiment, not any firm's current conduct.",
  }),
});

const T = CONFIG.text;
const HALF = CONFIG.half;
const LAW = CONFIG.law;

// ---------------------------------------------------------------------------------------------- data

const LEAGUE_IDS = Object.freeze(Array.from(LEAGUE.ids));
const LEAGUE_SE = Object.freeze(Array.from(LEAGUE.se));
const LEAGUE_EST = Object.freeze(Array.from(drawLeague(LEAGUE_SEED).estimate));
const nanDiagonal = (m) => m.map((row) => row.map((v) => (v === null || v === undefined ? Number.NaN : v)));

/** KRW's released firms and the λ grid's card row, or null when either file lacks what the app reads. */
function readKrw(K = KRW, G = GRID) {
  const u = K?.tables?.units;
  const a = K?.arrays?.error;
  const lambdas = G?.facts?.lambda;
  if (!u || !a || !Array.isArray(a.e) || !Array.isArray(a.criteria) || !Array.isArray(lambdas)) return null;
  const row = lambdas.findIndex((l) => l === CONFIG.krw.cardLambda);
  if (row < 0) return null;
  const ids = u.id.map(String);
  return {
    ids, names: u.firm_name.slice(), units: u, error: a, row, grid: G.arrays,
    nameIndex: new Map(u.firm_name.map((name, i) => [name.toLowerCase(), ids[i]])),
  };
}
const KRW_CASE = readKrw();

/** The values the unit key takes: "" (the default unit), a unit id of any data set, or a KRW firm's name. */
const UNIT_IDS = new Set([...LAW.ids, ...LEAGUE_IDS, ...(KRW_CASE?.ids ?? [])]);
function parseUnit(v) {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  if (s === "" || UNIT_IDS.has(s)) return s;
  return KRW_CASE?.nameIndex.get(s.toLowerCase());
}

const memo = new Map();
function remember(key, make) {
  if (memo.has(key)) return memo.get(key);
  const d = make();
  if (memo.size >= CONFIG.memo) memo.delete(memo.keys().next().value);
  memo.set(key, d);
  return d;
}

/** What every data set adds to its ids, names, pair array E, expected ranks and (but the law) posterior means: the
 * majority relation, the orders and their blocks, and the pairs each full ranking states against the majority. */
function finish(d) {
  d.n = d.ids.length;
  d.M = pairCount(d.n);
  d.e = d.E.e[0];
  d.mw = majorityWins(d.E);
  // the units of the majority relation's cyclic triples (engine cycleTriples: [a, x, y], a beats x, x beats y, y beats a)
  d.cycleMembers = new Set(d.mw.cycleTriples.flat());
  d.byWins = scoreOrder(d.mw.wins, { direction: "descending", ids: d.ids });
  d.byEr = scoreOrder(d.er, { direction: "ascending", ids: d.ids });
  d.byMean = d.mean ? scoreOrder(d.mean, { direction: "descending", ids: d.ids }) : null;
  // KRW's card in its grade order (grade 1 first; a shared grade is a block of equal values)
  d.byCard = d.card ? scoreOrder(d.card, { direction: "ascending", ids: d.ids }) : null;
  const against = (g) => statedAbove(g, d.E, { tau: HALF });
  d.erOrder = strictOrder(d.er, { direction: "ascending" });
  d.against = { er: against(d.erOrder).count, mean: null, card: null };
  if (d.mean) {
    d.meanOrder = strictOrder(d.mean);
    d.against.mean = against(d.meanOrder).count;
    // pairs that majority wins and the posterior means order differently (a tie in one only counts)
    d.misMean = misorderedPairs(d.mw.wins, d.mean).count;
  }
  if (d.card) {
    d.cardAgainst = against(d.card);
    d.against.card = d.cardAgainst.count;
    d.cardMis = misorderedPairs(d.mw.wins, d.card.map((g) => -g)).count;
    const ev = (g) => evaluateReport(g, d.E, { tau: lambdaToTau(CONFIG.krw.cardLambda) });
    d.evals = { mean: ev(d.meanOrder), er: ev(d.erOrder), card: ev(d.card) };
  }
  return d;
}

/** The ch. 10 law on orders: exact pair probabilities (finiteLawPairwise) and expected ranks (rankSummaries). */
function lawData() {
  const states = LAW.states.map((s) => s.slice());
  const pair = finiteLawPairwise(states.map((s) => s.map((v) => [v])), LAW.probs.slice(), { ids: LAW.ids.slice() });
  const r = rankSummaries({ states, probs: LAW.probs.slice() });
  return finish({
    key: "orders", geom: "orders", ids: LAW.ids.slice(), names: LAW.ids.slice(), firm: false,
    E: { ids: pair.ids, criteria: pair.criteria, e: pair.e }, pi: pair.pi[0], er: r.expectedRank, mean: null,
  });
}

/** The simulated league at one prior SD: the teaching posterior, its pair array and exact expected ranks. */
function leagueData(priorSd) {
  const post = normalPosterior(LEAGUE_EST.slice(), LEAGUE_SE.slice(), { priorMean: CONFIG.priorMean, priorSd });
  const mean = Array.from(post.mean);
  const sd = Array.from(post.sd);
  const E = errorArray(mean, sd, { ids: LEAGUE_IDS.slice() });
  return finish({ key: `league:${priorSd}`, geom: "league", priorSd, ids: LEAGUE_IDS.slice(), names: LEAGUE_IDS.slice(), firm: false, E, er: expectedRank(E), mean, sd });
}

/** KRW's firms on one criterion: the released pair array, posterior means, exact expected ranks and the λ = 1 card. */
function krwData(criterion) {
  const K = KRW_CASE;
  const k = K.error.criteria.indexOf(CONFIG.krw.criteria[criterion]);
  const E = { ids: K.ids.slice(), criteria: [K.error.criteria[k]], e: [nanDiagonal(K.error.e[k])] };
  return finish({
    key: `krw:${criterion}`, geom: "krw", criterion, ids: K.ids.slice(), names: K.names.slice(), firm: true,
    E, er: expectedRank(E), mean: K.units[CONFIG.krw.means[criterion]].slice(), card: Array.from(K.grid[criterion].grade[K.row]),
  });
}

/** One data set for a state (memoized). */
export function dataset(state) {
  if (state.data === "krw" && KRW_CASE) return remember(`krw:${state.criterion}`, () => krwData(state.criterion));
  if (state.data === "league") return remember(`league:${state.priorSd}`, () => leagueData(state.priorSd));
  return remember("orders", lawData);
}

/** The columns of the slope chart: posterior mean (when the data set has one), majority wins, KRW's card at λ = 1 (the
 * firms only), expected rank. */
export function columnsOf(d) {
  const specs = [];
  if (d.mean) specs.push({ key: "mean", so: d.byMean, value: d.mean });
  specs.push({ key: "wins", so: d.byWins, value: d.mw.wins });
  if (d.byCard) specs.push({ key: "card", so: d.byCard, value: d.card });
  specs.push({ key: "er", so: d.byEr, value: d.er });
  const cols = rankColumns(d.n, specs);
  const of = (key) => cols.find((c) => c.key === key) ?? null;
  return { cols, wins: of("wins"), mean: of("mean"), card: of("card"), er: of("er") };
}

/** The default unit: the first in a box of equal win counts (a cycle), else the highest by majority wins whose place
 * by posterior mean differs, else whose place by expected rank differs, else the first by majority wins. */
export function defaultUnit(cc) {
  if (cc.wins.blocks.length) return cc.wins.blocks[0].units[0];
  for (const other of [cc.mean, cc.er]) {
    if (!other) continue;
    for (const u of cc.wins.order) if (other.place[u] !== cc.wins.place[u]) return u;
  }
  return cc.wins.order[0];
}

/** i beats j by a majority (majorityWins' rule): stating i above j is less often wrong than the reverse (used for the
 * one pair a card leaves in one grade). */
const beats = (d, i, j) => d.e[i][j] < d.e[j][i] - CONFIG.tieTol;

/** The one cyclic triple of the majority relation (engine cycleTriples), as [a, b, c] with a (its first unit in data
 * order) beating b, b beating c and c beating a, when the relation has exactly one and its three units win as many
 * pairs each (so they share a box of equal win counts); else null. */
function soleCycle(d) {
  if (d.mw.cycleTriples.length !== 1) return null;
  const cyc = d.mw.cycleTriples[0];
  return cyc.every((u) => d.mw.wins[u] === d.mw.wins[cyc[0]]) ? cyc : null;
}

/** Pairs a card leaves in one grade, as [a, b] (a before b in data order). */
function cardTies(card) {
  const byGrade = new Map();
  card.forEach((g, u) => { if (!byGrade.has(g)) byGrade.set(g, []); byGrade.get(g).push(u); });
  const out = [];
  for (const us of byGrade.values()) for (let x = 0; x < us.length; x += 1) for (let y = x + 1; y < us.length; y += 1) out.push([us[x], us[y]]);
  return out;
}

// ---------------------------------------------------------------------------------------------- CSS

const CSS = `${cssFor(CONFIG.className)}
.prx-mw .prx-mw-data, .prx-mw .prx-mw-crit { display: flex; flex-wrap: wrap; column-gap: 1rem; }
.prx-mw .prx-mw-data > legend, .prx-mw .prx-mw-crit > legend { flex: 1 1 100%; }
.prx-mw .prx-mw-data > .prx-radio, .prx-mw .prx-mw-crit > .prx-radio { font-weight: 400; }
.prx-mw .prx-mw-panel { margin: 1.25rem 0 0; min-width: 0; container-type: inline-size; }
@container (max-width: 30rem) {
  .prx-mw .prx-mw-krw-table { font-size: 0.82em; }
  .prx-mw .prx-mw-krw-table th, .prx-mw .prx-mw-krw-table td { padding: 0.15rem 0.3rem; }
}
.prx-mw .prx-mw-panel p { margin: 0.35rem 0 0; }
.prx-mw .prx-mw-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem 1.5rem; align-items: start; min-width: 0; }
@container (min-width: 46rem) {
  .prx-mw .prx-mw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prx-mw .prx-mw-unit { position: sticky; top: var(--prx-mw-top, 0.5rem); }
}
.prx-mw[data-prx-mw-site] { --prx-mw-top: 4.5rem; }
.prx-mw .prx-mw-bump, .prx-mw .prx-mw-unit { min-width: 0; }
.prx-mw .prx-mw-unit.prx-wr-card { margin: 0; }
.prx-mw .prx-mw-pairs-title { margin: 0.6rem 0 0.2rem; font-size: 0.92em; font-weight: 600; color: var(--prx-fg-heading); }
.prx-mw .prx-mw-pairs-chart .prx-chart-area { cursor: pointer; }
.prx-mw .prx-mw-legend { margin: 0.2rem 0 0; padding: 0.15rem 0.5rem 0.25rem; }
.prx-mw .prx-mw-sw-above { background: var(--prx-post); }
.prx-mw .prx-mw-sw-below { background: var(--prx-plot-grid); }
.prx-mw .prx-mw-rule { display: inline-block; flex: none; width: 1.1rem; height: 0; border-top: 1.5px dashed var(--prx-plot-fg); }
.prx-mw .prx-mw-krw-table th:first-child { text-align: left; white-space: normal; }
.prx-mw .prx-wr-table.prx-mw-orders td:last-child:not(:first-child), .prx-mw .prx-wr-table.prx-mw-krw-table td:last-child:not(:first-child) { text-align: right; }
.prx-mw .prx-mw-captions { margin: 0.3rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); }
.prx-mw .prx-mw-grade1 { font-weight: 600; color: var(--prx-fg); }
.prx-mw .prx-mw-notice { margin: 0.5rem 0 0; font-size: 0.85em; color: var(--prx-fg-muted); overflow-wrap: anywhere; }
.prx-mw .prx-mw-notice strong { font-weight: 600; color: var(--prx-fg); }
.prx-mw[data-prx-data="krw"] .prx-mw-bump [data-prx-role="value"]:not([data-prx-on]) { display: none; }
.prx-mw[data-prx-data="krw"] .prx-mw-bump [data-prx-role="value"][data-prx-on] { font-weight: 600; }
`;

// ---------------------------------------------------------------------------------------------- the app

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: CSS,
    keys: {
      data: { type: "choice", values: CONFIG.data.values.slice(), value: CONFIG.data.value },
      criterion: { type: "choice", values: CONFIG.criterion.values.slice(), value: CONFIG.criterion.value },
      priorSd: { type: "number", min: CONFIG.priorSd.min, max: CONFIG.priorSd.max, step: CONFIG.priorSd.step, value: CONFIG.priorSd.value },
      unit: { type: "custom", value: "", parse: (v) => parseUnit(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, raw, display) => { const node = ctx.num(raw, display); if (name) node.setAttribute("data-prx-readout", name); return node; };
      const nameNode = (text) => h("span", { "data-prx-name": text, text });
      const one = () => ctx.num(CONFIG.krw.cardLambda, formatCount(CONFIG.krw.cardLambda));
      const digitsOf = (d) => CONFIG.digits[d.geom];
      const fmtEr = (d, v) => formatDecimal(v, { digits: digitsOf(d).er });
      const fmtMean = (d, v) => formatDecimal(v, { digits: digitsOf(d).mean });
      const fmtProb = (d, v) => formatProb(v, { digits: digitsOf(d).prob });
      const fmtSd = (v) => formatDecimal(v, { digits: CONFIG.digits.league.sd });
      // a unit as text (its id, or a firm's name) and as a node; a firm's KRW id is a name, so its digits are not a number
      const unitText = (d, u) => d.names[u];
      const unitNode = (d, u) => nameNode(d.names[u]);
      const firmRef = (d, u) => fill(T.firmRef, { name: () => nameNode(d.names[u]), id: () => nameNode(d.ids[u]) });
      // a slot that names a firm with its KRW id the first time it is filled and by its name after that
      const firstRef = (d, u) => {
        let used = false;
        return () => { const out = used ? unitNode(d, u) : firmRef(d, u); used = true; return out; };
      };
      const tid = (id) => (id.length > 1 ? id.replace(/^([A-Za-z]+)(\d+)$/, "\\mathrm{$1}$2") : id);
      // a column's value as text (a card's grade is a count), its header and its words in titles
      const valueText = (d, key, v) => (key === "mean" ? fmtMean(d, v) : key === "wins" || key === "card" ? formatCount(v) : fmtEr(d, v));
      const header = (key) => ({ mean: T.colMean, wins: T.colWinsHead, card: T.colCardHead })[key] ?? T.colEr;
      const byWords = (key) => ({ mean: T.byMean, wins: T.byWins, card: T.byCard })[key] ?? T.byEr;

      // --- controls: data set, KRW's criterion, the league's prior SD
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-mw-data",
        options: [{ value: "orders", label: T.dataOrders }, { value: "league", label: T.dataLeague }, { value: "krw", label: T.dataKrw }],
        value: ctx.state.data,
        // a new data set starts from its default unit
        onChange: (v) => ctx.set({ data: v, unit: "" }),
      });
      const critRadio = ctx.radioGroup({
        legend: T.critLegend, name: "criterion", className: "prx-mw-crit",
        options: [{ value: "race", label: T.critRace }, { value: "gender", label: T.critGender }],
        value: ctx.state.criterion, onChange: (v) => ctx.set({ criterion: v, unit: "" }),
      });
      const prior = ctx.slider({
        label: T.priorLabel, ...ctx.key("priorSd"), hint: fill(T.priorHint, { app: () => appLink(ctx, T.shrinkageApp) }),
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      // the controls of one data set only are in the page; each comes back at its own anchor, so the controls that
      // stay are never moved and keep keyboard focus
      const anchor = (name) => ctx.doc.createComment(name);
      const slots = [{ node: critRadio.root, at: anchor("criterion") }, { node: prior.root, at: anchor("prior-sd") }];
      ctx.controls.append(dataRadio.root, ...slots.map((s) => s.at));
      const showControls = (shown) => slots.forEach((s, i) => {
        if (shown[i] && !s.node.isConnected) s.at.before(s.node);
        else if (!shown[i] && s.node.isConnected) s.node.remove();
      });
      ctx.controls.after(ctx.readout.node);

      // --- the data set's panel (law on orders, league, KRW's card), under the chart and the unit
      const panel = h("section", { class: "prx-mw-panel", "data-prx-part": "notes" });

      // --- slope chart (under its heading; the note and the how-to hint follow the chart)
      const bumpHeading = h("h4", { class: "prx-wr-heading" });
      const bumpNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes" });
      const howTo = h("p", { class: "prx-hint prx-wr-howto", "data-prx-part": "notes", text: T.howTo });
      const bumpSlot = h("div", { class: "prx-wr-bump-chart" });
      const tieNote = h("p", { class: "prx-wr-note", "data-prx-part": "notes", text: T.tieNote, hidden: true });
      const bumpBox = h("section", { class: "prx-mw-bump" }, bumpHeading, bumpSlot, tieNote, bumpNote, howTo);

      // --- the unit card: numbers, its pairs as bars, the two formulas
      const cardStatus = h("p", { class: "prx-wr-card-status" });
      const cardLine = h("p", { class: "prx-wr-card-line" });
      const cardExtra = h("p", { class: "prx-wr-card-extra" });
      const pairsTitle = h("p", { class: "prx-mw-pairs-title", role: "heading", "aria-level": "4" });
      const pairsSlot = h("div", { class: "prx-mw-pairs-chart" });
      const keyAbove = h("span", {});
      const keyBelow = h("span", {});
      const swatch = (cls) => h("span", { class: `prx-swatch ${cls}`, "aria-hidden": "true" });
      const legend = h("div", { class: "prx-legend prx-light-panel prx-mw-legend", "data-prx-part": "legend" },
        h("span", { class: "prx-key" }, swatch("prx-mw-sw-above"), keyAbove),
        h("span", { class: "prx-key" }, swatch("prx-mw-sw-below"), keyBelow),
        h("span", { class: "prx-key" }, h("span", { class: "prx-mw-rule", "aria-hidden": "true" }), T.keyHalf));
      const pairsNote = h("p", { class: "prx-wr-note", text: T.pairsNote });
      const texBox = ctx.scrollRegion(h("div", { class: "prx-wr-tex", "data-prx-tex": "majority-wins" }), T.texWorked);
      const formulaNote = h("p", { class: "prx-wr-note" });
      const card = h("section", { class: "prx-wr-card prx-mw-unit", "data-prx-part": "readout", "aria-label": T.cardSelected },
        cardStatus, cardLine, cardExtra, pairsTitle, pairsSlot, legend, pairsNote, texBox, formulaNote);
      ctx.charts.classList.add("prx-wr-charts");
      ctx.charts.append(h("div", { class: "prx-mw-grid" }, bumpBox, card), panel);

      // --- the source note after the caption; on a standalone page also KRW's notice (licence, changes, conduct line;
      // its citation carries DOIs and a year, so it sits outside the parts whose numbers the checks read)
      const sourceNote = ctx.part("notes", h("p", { class: "prx-wr-note prx-wr-source" }));
      ctx.caption.after(sourceNote);
      const authoredCaption = ctx.info?.caption ?? "";
      const site = Boolean(ctx.doc.querySelector?.('meta[name="quarto:offset"]'));
      if (site) ctx.root.setAttribute("data-prx-mw-site", "");
      const krwNotice = !site && KRW_CASE
        ? h("p", { class: "prx-mw-notice", hidden: true }, `${T.noticeKrw} ${T.noticeKrwChanges} `, h("strong", { text: T.noticeKrwConduct }))
        : null;
      if (krwNotice) ctx.root.append(krwNotice);

      let current = null;     // { state, d, cc }
      let bumpGeom = null;
      let pairsGeom = null;
      let selected = null;
      let hovered = null;     // the unit under the pointer in the slope chart (the card follows it)
      let peer = null;        // the unit of the bar under the pointer (marked in the slope chart only)
      let rendering = false;

      // ------------------------------------------------------------------------------------------- the panel

      function drawOrdersPanel(d) {
        const dg = CONFIG.digits.orders;
        const p = (name, v) => () => ro(`orders-${name}`, v, formatProb(v, { digits: dg.prob }));
        const lead = h("p", { class: "prx-wr-note" }, ...fill(T.lawLead, {
          pABC: p("p-abc", LAW.probs[0]), pBCA: p("p-bca", LAW.probs[1]), pCBA: p("p-cba", LAW.probs[2]),
          piAB: p("pi-ab", d.pi[0][1]), piAC: p("pi-ac", d.pi[0][2]), piBC: p("pi-bc", d.pi[1][2]),
        }));
        const table = h("table", { class: "prx-wr-table prx-mw-orders" },
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.colUnit }), h("th", { scope: "col", text: T.colWins }), h("th", { scope: "col", text: T.colExpected }))),
          h("tbody", {}, ...d.ids.map((id, i) => h("tr", {},
            h("th", { scope: "row", text: id }),
            h("td", {}, ro(`orders-wins-${id.toLowerCase()}`, d.mw.wins[i], formatCount(d.mw.wins[i]))),
            h("td", {}, ro(`orders-er-${id.toLowerCase()}`, d.er[i], fmtEr(d, d.er[i])))))));
        panel.replaceChildren(h("h4", { class: "prx-wr-heading", text: T.lawHeading }), lead,
          ...captionedTable(ctx, table, T.lawTableCaption, T.lawTable),
          h("p", { class: "prx-wr-note", text: T.lawEnd }), h("p", { class: "prx-wr-note", text: T.lawNoMean }));
      }

      function drawLeaguePanel(d) {
        const groupSd = (g) => () => {
          const i = LEAGUE.group.indexOf(g);
          return ro(`law-sd-${g}`, d.sd[i], fmtSd(d.sd[i]));
        };
        panel.replaceChildren(h("h4", { class: "prx-wr-heading", text: T.leagueHeading }),
          h("p", { class: "prx-wr-note" }, ...fill(T.leagueLaw, { app: () => appLink(ctx, T.shrinkageApp) }),
            ...fill(T.leagueWidths, { small: groupSd("small"), medium: groupSd("medium"), large: groupSd("large") })));
      }

      function drawKrwPanel(d) {
        const crit = d.criterion;
        const ev = d.evals;
        const fmtE = (v) => formatExpectedCount(v);
        const row = (key, label, evx, againstCount) => h("tr", {},
          h("th", { scope: "row" }, ...label),
          h("td", {}, ro(`krw-n-${key}`, evx.N, formatCount(evx.N))),
          h("td", {}, ro(`krw-against-${key}`, againstCount, formatCount(againstCount))),
          h("td", {}, ro(`krw-e-${key}`, evx.E[0], fmtE(evx.E[0]))),
          h("td", {}, ro(`krw-dr-${key}`, evx.EoverM[0], formatShare(evx.EoverM[0]))));
        const table = h("table", { class: "prx-wr-table prx-mw-krw-table" },
          h("thead", {}, h("tr", {}, ...[T.colOrder, T.colStated, T.colAgainst, T.colE, T.colDR].map((t) => h("th", { scope: "col", text: t })))),
          h("tbody", {},
            row("mean", [T.rowMean], ev.mean, d.against.mean),
            row("er", [T.rowEr], ev.er, d.against.er),
            row("card", fill(T.rowCard, { one }), ev.card, d.against.card)));
        const parts = [
          h("h4", { class: "prx-wr-heading" }, ...fill(T.krwHeading, { one })),
          h("p", { class: "prx-wr-note" }, ...fill(T.krwLead, { one, target: T.targetWords[crit] })),
          ...captionedTable(ctx, table, fill(T.krwTableCaption, { one, gap: T.gapWords[crit] }), T.krwTable),
        ];
        const cardStrict = d.mw.strictOrder && d.against.card === 0 && d.cardMis === 0 && ev.card.N === d.M;
        if (cardStrict && crit === "race") {
          parts.push(h("p", { class: "prx-wr-note" }, ...fill(T.krwRaceSame, {
            one, E: () => ro("krw-card-e", ev.card.E[0], fmtE(ev.card.E[0])), Epm: () => ro("krw-mean-e", ev.mean.E[0], fmtE(ev.mean.E[0])),
          })));
        } else {
          parts.push(h("p", { class: "prx-wr-note" }, ...fill(T.krwCardOther, {
            gap: T.gapWords[crit], one, N: () => ro("krw-card-n", ev.card.N, formatCount(ev.card.N)), M: () => ro("krw-pairs", d.M, formatCount(d.M)),
            E: () => ro("krw-card-e", ev.card.E[0], fmtE(ev.card.E[0])),
          })));
        }
        // the cycles of the majority relation (engine cycleTriples), the one cycle named when its three units share a box
        // of equal win counts
        if (d.mw.cycles > 0) {
          const cyc = soleCycle(d);
          if (cyc) {
            // the engine writes the cycle from its first unit in data order: a beats b, b beats c, c beats a
            const [a, b, c] = cyc;
            const pi = (i, j) => 1 - d.e[i][j];
            parts.push(h("p", { class: "prx-wr-note" }, ...fill(T.krwCycle, {
              a: firstRef(d, a), b: firstRef(d, b), c: firstRef(d, c),
              p1: () => ro("cycle-p1", pi(a, b), fmtProb(d, pi(a, b))), p2: () => ro("cycle-p2", pi(b, c), fmtProb(d, pi(b, c))),
              p3: () => ro("cycle-p3", pi(c, a), fmtProb(d, pi(c, a))), w: () => ro("cycle-wins", d.mw.wins[a], formatCount(d.mw.wins[a])),
            })));
          } else {
            parts.push(h("p", { class: "prx-wr-note" }, ...fill(T.krwCycles, { count: () => ro("cycles", d.mw.cycles, formatCount(d.mw.cycles)) })));
          }
        }
        // the pair the card leaves in one grade, what it states against the majority, and why that shared grade is
        // not part of an exact optimum when the pair is not an even split
        // (two plain sentences in one paragraph)
        const ties = cardTies(d.card);
        if (ties.length === 1) {
          const [x, y] = ties[0];
          const st = d.cardAgainst.pairs[0];
          const tie = [];
          if (st) {
            tie.push(...fill(T.krwTie, {
              one, G: () => ro("tie-g", ev.card.G, formatCount(ev.card.G)), x: () => unitNode(d, x), y: () => unitNode(d, y),
              s: () => unitNode(d, st.i), t: () => unitNode(d, st.j), e: () => ro("tie-against-e", st.error, fmtProb(d, st.error)),
            }));
          }
          const w = beats(d, x, y) ? x : beats(d, y, x) ? y : null;
          if (w !== null) {
            const l = w === x ? y : x;
            const p = 1 - d.e[w][l];
            tie.push(...fill(T.krwTieTol, {
              one, w: () => unitNode(d, w), l: () => unitNode(d, l), p: () => ro("tie-pi", p, fmtProb(d, p)),
            }));
          }
          if (tie.length) parts.push(h("p", { class: "prx-wr-note prx-mw-tie" }, ...tie));
        }
        parts.push(h("p", { class: "prx-wr-note prx-mw-grade1", text: T.grade1[crit] }));
        // the three rankings are evaluated as given; when they state different numbers of pairs, the table says so
        const differ = new Set([ev.mean.N, ev.er.N, ev.card.N]).size > 1;
        parts.push(h("p", { class: "prx-mw-captions" }, captionNode(ctx, "krw-card"), "; ", captionNode(ctx, "fixed-report"),
          ...(differ ? ["; ", captionNode(ctx, "different-disclosure"), T.differentGloss] : []), "."));
        panel.replaceChildren(...parts);
      }

      function drawPanel(d) {
        if (d.geom === "orders") drawOrdersPanel(d);
        else if (d.geom === "league") drawLeaguePanel(d);
        else drawKrwPanel(d);
      }

      // ------------------------------------------------------------------------------------------- the slope chart

      // a figure narrower than its slot keeps its drawn width (the svg would otherwise stretch to the slot's width and
      // enlarge its text); the slot itself stays as wide as its column, so the next draw still measures the column
      function capWidth(slot, width) {
        const chart = slot.querySelector(".prx-chart");
        if (chart) chart.style.maxWidth = `${width}px`;
      }

      function drawBump(d, cc) {
        const cols = cc.cols;
        const chosen = cols.indexOf(cc.wins);
        bumpHeading.textContent = cols.length === 4 ? T.bumpHeadingFour : cols.length === 3 ? T.bumpHeadingThree : T.bumpHeadingTwo;
        bumpNote.replaceChildren(T.bumpNote, ...(d.geom === "krw" ? fill(T.bumpNoteKrw, { one, n: () => ctx.num(d.n, formatCount(d.n)) }) : []));
        const word = { mean: "mean", wins: "wins", card: "card", er: "er" };
        const placeCol = { mean: T.colPlaceMean, wins: T.colPlaceWins, card: T.colPlaceCard, er: T.colPlaceEr };
        const valueCol = { mean: T.colMeanValue, wins: T.colWinsValue, card: T.colCardValue, er: T.colExpected };
        const table = {
          caption: T.bumpTableCaption,
          columns: [
            { label: T.colUnit, value: "name" },
            ...cols.flatMap((col) => [
              { label: valueCol[col.key], value: (r) => col.value[r.u], format: (v) => valueText(d, col.key, v) },
              { label: placeCol[col.key], value: (r) => placeText(col, r.u) },
            ]),
          ],
          rows: cc.wins.order.map((u) => ({ name: unitText(d, u), u })),
        };
        const G = CONFIG.bump[d.geom];
        bumpGeom = drawSlopeChart(ctx, bumpSlot, {
          ids: d.geom === "krw" ? d.ids.map(() => "") : d.names, cols, chosen, geometry: G,
          labels: d.geom === "orders" ? "all" : "ends",
          headers: cols.map((col) => header(col.key)),
          valueText: (c, v) => valueText(d, cols[c].key, v),
          alt: fillText(T.bumpAlt, { list: cols.map((col) => T.columnWords[word[col.key]]).join(", ") }),
          table, keyboardLabel: T.bumpKeyboard,
          title: (x) => `${byWords(cols[x.c].key)}, ${placeText(cols[x.c], x.u)}: ${unitText(d, x.u)} (${valueText(d, cols[x.c].key, x.value)})`,
          onFocus: (u) => select(u),
          width: bumpSlot.clientWidth || bumpBox.clientWidth,
        });
        capWidth(bumpSlot, bumpGeom.width);
        tieNote.hidden = !bumpGeom.blocks;
      }

      // ------------------------------------------------------------------------------------------- the unit card

      let pairsDrawn = null;
      function drawPairs(d, u) {
        const P = CONFIG.pairs;
        const G = P[d.geom];
        const avail = Math.max(1, Math.round(pairsSlot.clientWidth || card.clientWidth || ctx.width()));
        const width = Math.min(avail, G.maxWidth);
        // the same unit at the same width is not drawn again, so its bars keep their keyboard stop and focus
        const stamp = `${d.key}|${u}|${width}`;
        if (stamp === pairsDrawn) return;
        pairsDrawn = stamp;
        const others = [];
        for (let j = 0; j < d.n; j += 1) if (j !== u) others.push(j);
        // surest win first: the smallest chance that stating u above j is wrong; equal chances in data order
        others.sort((a, b) => d.e[u][a] - d.e[u][b] || a - b);
        const rows = others.map((j, r) => ({ j, key: String(r), p: 1 - d.e[u][j], q: d.e[u][j], name: unitText(d, j) }));
        const me = unitText(d, u);
        const pText = (v) => fmtProb(d, v);
        const handle = plot(pairsSlot, {
          alt: fillText(T.pairsAlt, { id: me }),
          table: {
            caption: fillText(T.pairsTableCaption, { id: me }),
            columns: [
              { label: T.colOther, value: "name" },
              { label: fillText(T.colAbove, { id: me }), value: "p", format: pText },
              { label: fillText(T.colBelow, { id: me }), value: "q", format: pText },
            ],
            rows,
          },
          width, height: G.height, marginTop: G.marginTop, marginBottom: G.marginBottom, marginLeft: G.marginLeft, marginRight: G.marginRight,
          x: { domain: rows.map((r) => r.key), padding: G.padding, axis: d.geom === "orders" ? "bottom" : null, tickFormat: (k) => rows[Number(k)]?.name ?? "", tickSize: 0, label: null },
          y: { domain: [0, 1], ticks: [0, HALF, 1], label: null },
          marks: (c, Pl) => [
            Pl.barY(rows, { x: "key", y1: 0, y2: "p", fill: c.post }),
            Pl.barY(rows, { x: "key", y1: "p", y2: 1, fill: c.plotGrid }),
            Pl.ruleY([0], { stroke: c.plotAxis }),
            Pl.ruleY([HALF], { stroke: c.plotFg, strokeWidth: P.line, strokeDasharray: P.dash }),
            G.valueFont ? numText(rows, {
              x: "key", y: "p", value: "p", format: pText, dy: P.valueDy, lineAnchor: "bottom", fill: c.plotFg, fontSize: G.valueFont,
            }) : null,
          ],
          keyboard: {
            data: rows, x: "key", y: "p", key: (r) => r.key, sort: false,
            label: fillText(T.pairsKeyboard, { id: me }),
            title: (r) => fillText(T.pairTitle, { id: me, other: r.name, p: pText(r.p), q: pText(r.q) }),
            onFocus: (r) => setPeer(r.j),
          },
        });
        capWidth(pairsSlot, width);
        pairsGeom = { svg: handle.svg, width, height: G.height, ml: G.marginLeft, mr: G.marginRight, rows };
      }

      // the two counts worked; in an app narrower than WR.narrowPx each result gets a line of its own (CR-065), with the
      // numbers in the same order
      function drawFormula(d, u) {
        const f = formulaNums();
        const half = () => f.num(HALF, formatFraction(1, 2));
        const w = d.mw.wins[u];
        const eq = ctx.width() < WR.narrowPx ? " \\\\ &= \\;" : " = \\;";
        if (d.geom === "orders") {
          const me = d.ids[u];
          const others = d.ids.map((_, j) => j).filter((j) => j !== u);
          const wins = `H_{${me}} &= \\#\\{\\, j : \\Pr(\\theta_{${me}} > \\theta_j \\mid Y) > ${half()} \\,\\}${eq}${f.num(w, formatCount(w), "prx-post")}`;
          // one probability per line, so that the formula fits a 375 px screen
          const pis = others.map((j) => `\\Pr(\\theta_{${d.ids[j]}} > \\theta_{${me}} \\mid Y)`).join(" \\\\ &\\quad + ");
          const oneA = f.num(1, formatCount(1));
          const lineA = `\\prerank{${me}} &= ${oneA} + ${pis}`;
          const oneB = f.num(1, formatCount(1));
          const vals = others.map((j) => f.num(d.e[u][j], fmtProb(d, d.e[u][j]))).join(" + ");
          const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
          const tex = `\\begin{aligned}${wins} \\\\ ${lineA} \\\\ &= ${oneB} + ${vals} = \\;${result}\\end{aligned}`;
          renderTex(texBox, tex, { display: true, nums: f.raws });
          return;
        }
        const me = d.firm ? "u" : tid(d.ids[u]);
        const wins = `H_{${me}} &= \\#\\{\\, j : \\Pr(\\theta_{${me}} > \\theta_j \\mid Y) > ${half()} \\,\\}${eq}${f.num(w, formatCount(w), "prx-post")}`;
        const oneA = f.num(1, formatCount(1));
        const result = f.num(d.er[u], fmtEr(d, d.er[u]), "prx-post");
        const er = `\\prerank{${me}} &= ${oneA} + \\sum_{j \\neq ${me}} \\Pr(\\theta_j > \\theta_{${me}} \\mid Y)${eq}${result}`;
        renderTex(texBox, `\\begin{aligned}${wins} \\\\ ${er}\\end{aligned}`, { display: true, nums: f.raws });
      }

      function drawCard() {
        if (!current) return;
        const { d, cc } = current;
        const u = hovered ?? selected;
        if (u === null || u === undefined || u >= d.n) return;
        const status = d.firm ? (hovered !== null ? T.cardHoveredFirm : T.cardSelectedFirm) : (hovered !== null ? T.cardHovered : T.cardSelected);
        cardStatus.replaceChildren(...(d.firm
          ? fill(T.statusFirm, { status, name: () => nameNode(d.names[u]), id: () => nameNode(d.ids[u]) })
          : [`${status}: `, unitNode(d, u), "."]));
        const slotsLine = {
          id: () => unitNode(d, u),
          w: () => ro("card-wins", d.mw.wins[u], formatCount(d.mw.wins[u])), pairs: () => ro("card-pairs", d.n - 1, formatCount(d.n - 1)),
          pw: placeText(cc.wins, u),
          er: () => ro("card-er", d.er[u], fmtEr(d, d.er[u])), pe: placeText(cc.er, u),
        };
        if (d.mean) Object.assign(slotsLine, { m: () => ro("card-mean", d.mean[u], fmtMean(d, d.mean[u])), pm: placeText(cc.mean, u) });
        cardLine.replaceChildren(...fill(d.mean ? T.cardLine : T.cardLineNoMean, slotsLine));
        const extra = [];
        if (d.geom === "league") {
          extra.push(...fill(T.cardLeague, {
            id: () => unitNode(d, u), group: T.groupWords[LEAGUE.group[u]],
            se: () => ctx.num(LEAGUE.se[u], formatDecimal(LEAGUE.se[u], { digits: CONFIG.digits.league.se })),
            sd: () => ro("card-sd", d.sd[u], fmtSd(d.sd[u])),
          }));
        }
        if (d.firm && soleCycle(d) && d.cycleMembers.has(u)) {
          extra.push(...fill(T.cardCycle, { id: () => unitNode(d, u) }));
        }
        cardExtra.hidden = !extra.length;
        cardExtra.replaceChildren(...extra);
        card.setAttribute("aria-label", status);
        pairsTitle.replaceChildren(...fill(T.pairsHeading, { id: () => unitNode(d, u) }));
        keyAbove.replaceChildren(...fill(T.keyAbove, { id: () => unitNode(d, u) }));
        keyBelow.replaceChildren(...fill(T.keyBelow, { id: () => unitNode(d, u) }));
        drawPairs(d, u);
        drawFormula(d, u);
        formulaNote.replaceChildren(...fill(T.formulaNote, { one: () => ctx.num(1, formatCount(1)) }), d.firm ? T.formulaNoteKrw : "");
      }

      function highlight() {
        markUnits([bumpGeom?.svg], selected, hovered ?? peer);
        drawCard();
      }

      // ------------------------------------------------------------------------------------------- read-out, notes

      function drawReadout(d) {
        const M = () => ro("pairs", d.M, formatCount(d.M));
        if (d.geom === "orders") {
          const wFirst = d.byWins.order[0];
          const eFirst = d.byEr.order[0];
          ctx.readout.set([T.headOrders, ...fill(T.readOrders, {
            wfirst: () => unitNode(d, wFirst), wcount: () => ro("first-wins", d.mw.wins[wFirst], formatCount(d.mw.wins[wFirst])),
            efirst: () => unitNode(d, eFirst), er1: () => ro("first-er", d.er[eFirst], fmtEr(d, d.er[eFirst])),
            wfirst2: () => unitNode(d, wFirst), er2: () => ro("wins-first-er", d.er[wFirst], fmtEr(d, d.er[wFirst])),
          }), ...fill(T.readOrdersAgainst, { b: () => ro("against-er", d.against.er, formatCount(d.against.er)), M })]);
          return;
        }
        if (d.geom === "league") {
          ctx.readout.set([...fill(T.headLeague, { prior: () => ro("prior-sd", d.priorSd, formatSetting(d.priorSd)) }),
            ...fill(d.misMean === 0 ? T.readLeagueSame : T.readLeagueDiff, { mis: () => ro("mis-mean", d.misMean, formatCount(d.misMean)), M }),
            ...fill(T.readLeagueAgainst, { b: () => ro("against-er", d.against.er, formatCount(d.against.er)) })]);
          return;
        }
        const relation = d.mw.strictOrder ? [T.readStrict]
          : fill(d.mw.cycles === 1 ? T.readCycleOne : T.readCycleMany, { c: () => ro("cycles", d.mw.cycles, formatCount(d.mw.cycles)) });
        const c = d.against.card === 0 ? T.none : () => ro("against-card", d.against.card, formatCount(d.against.card));
        ctx.readout.set([...fill(T.headKrw, { n: () => ro("units", d.n, formatCount(d.n)), gap: T.gapWords[d.criterion] }), ...relation,
          ...fill(T.readKrwAgainst, {
            a: () => ro("against-mean", d.against.mean, formatCount(d.against.mean)), M, b: () => ro("against-er", d.against.er, formatCount(d.against.er)), one, c,
          })]);
      }

      function drawNotes(d) {
        if (d.geom === "orders") {
          sourceNote.replaceChildren(T.noteOrders);
          ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption] : []));
        } else if (d.geom === "league") {
          sourceNote.replaceChildren(...fill(T.noteLeague, {
            n: () => ctx.num(d.n, formatCount(d.n)), seed: () => ctx.num(LEAGUE_SEED, formatSetting(LEAGUE_SEED)),
            zero: () => ctx.num(CONFIG.priorMean, formatDecimal(CONFIG.priorMean, { digits: 0 })), prior: () => ctx.num(d.priorSd, formatSetting(d.priorSd)),
          }));
          ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption, " "] : []), T.postLead, captionNode(ctx, "teaching-posterior"), ".");
        } else {
          sourceNote.replaceChildren(T.noteKrw);
          ctx.caption.replaceChildren(...(authoredCaption ? [authoredCaption] : []));
        }
        if (krwNotice) krwNotice.hidden = d.geom !== "krw";
      }

      // ------------------------------------------------------------------------------------------- selection, pointer

      function select(u) {
        if (!current || u === null || u === undefined || u >= current.d.n) return;
        if (rendering) {
          ctx.timeout(() => select(u), 0);
          return;
        }
        const id = current.d.ids[u];
        const had = hovered;
        hovered = null;
        if (current.state.unit === id) {
          if (had !== null) highlight();
          return;
        }
        ctx.set({ unit: id });
      }
      function setHover(u) {
        const next = u ?? null;
        if (next === hovered) return;
        hovered = next;
        highlight();
      }
      function setPeer(u) {
        const next = u ?? null;
        if (next === peer) return;
        peer = next;
        markUnits([bumpGeom?.svg], selected, hovered ?? peer);
      }
      // the bar under a pointer event in the pairs chart (by geometry: one band per bar across the plot), or null
      function barAt(ev) {
        const g = pairsGeom;
        if (!g?.svg?.getBoundingClientRect) return null;
        const r = g.svg.getBoundingClientRect();
        if (!(r.width > 0)) return null;
        const x = (ev.clientX - r.left) * (g.width / r.width);
        const span = g.width - g.ml - g.mr;
        const i = Math.floor(((x - g.ml) / Math.max(1, span)) * g.rows.length);
        return i >= 0 && i < g.rows.length ? g.rows[i].j : null;
      }
      ctx.listen(bumpSlot, "pointermove", (ev) => { if (ev.pointerType !== "touch") setHover(slopeUnitAt(bumpGeom, ev)); });
      ctx.listen(bumpSlot, "pointerleave", () => setHover(null));
      ctx.listen(bumpSlot, "click", (ev) => { const u = slopeUnitAt(bumpGeom, ev); if (u !== null && u !== undefined) select(u); });
      ctx.listen(pairsSlot, "pointermove", (ev) => { if (ev.pointerType !== "touch") setPeer(barAt(ev)); });
      ctx.listen(pairsSlot, "pointerleave", () => setPeer(null));
      ctx.listen(pairsSlot, "click", (ev) => { const j = barAt(ev); if (j !== null) { peer = null; select(j); } });
      ctx.listen(pairsSlot, "focusout", () => setPeer(null));

      return {
        render(state, info) {
          rendering = true;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const changed = info?.changed ?? [];
            // a new selection toggles attributes and redraws the card only
            const unitOnly = Boolean(current) && !info?.initial && info?.reason === "update"
              && changed.length === 1 && changed[0] === "unit" && current.state.data === state.data;
            const krw = state.data === "krw" && Boolean(KRW_CASE);
            dataRadio.set(state.data);
            critRadio.set(state.criterion);
            prior.set(state.priorSd);
            showControls([krw, state.data === "league"]);
            const d = dataset(state);
            ctx.root.setAttribute("data-prx-data", d.geom);
            const cc = current && unitOnly ? current.cc : columnsOf(d);
            if (changed.includes("data") || changed.includes("criterion")) { hovered = null; peer = null; }
            if (hovered !== null && hovered >= d.n) hovered = null;
            if (peer !== null && peer >= d.n) peer = null;
            const ui = d.ids.indexOf(state.unit);
            selected = ui >= 0 ? ui : defaultUnit(cc);
            current = { state, d, cc };
            if (!unitOnly) {
              pairsDrawn = null;
              drawPanel(d);
              drawBump(d, cc);
              drawReadout(d);
              drawNotes(d);
            }
            highlight();
            // a unit of another data set names nothing here: the key goes back to the default unit
            if (state.unit !== "" && ui < 0) ctx.set({ unit: "" });
          } finally {
            ctx.root.removeAttribute("aria-busy");
            rendering = false;
          }
        },
      };
    },
  });
}
