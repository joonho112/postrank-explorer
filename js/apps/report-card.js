// Full report-card renderer and linked six-site/thirty-site explorer.
import { createWidget, scrollRegion } from "../shared/base.js";
import { gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatDecimal, formatGrades, formatPercent, formatProb, formatRisk, formatSci, formatSetting, formatShare, formatSizes, formatTuple, numSpan } from "../shared/format.js";
import { captionNode, tagNode } from "../shared/labels.js";
import {
  betweenGradeErrors, disclosure, exactOptimum, expectedRank, fixedOrderDP, normalInterval, pairCount, reportCardRows,
  largestStatedError, summaryStats,
} from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };
import THIRTY from "../../data/released/thirty-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "report-card",
  label: "Reading a report card: posterior means and marginal intervals in grade colors, sorted as the package sorts them, with between-grade expected wrong shares",
  className: "prx-rc",
  level: 0.9,
  tau: Object.freeze({ min: 0.02, max: 0.5, step: 0.01, value: 0.2 }),
  cap: Object.freeze({ min: 2, max: 6, value: 3 }),
  reveal: Object.freeze({ min: 0, max: 6, value: 0 }),
  datasets: Object.freeze(["six", "thirty"]),
  orders: Object.freeze(["grade", "expected_rank", "mean", "label"]),
  defaults: Object.freeze({ data: "six", order: "grade" }),
  // reports this long or shorter are written as a grade vector in the read-out; longer ones by their sizes
  vectorMax: 8,
  digits: Object.freeze({ value: 2, rank: 3, average: 2 }),
  // between-grade cells: seven Purples steps cut at these mean error probabilities
  purpleCuts: Object.freeze([0.001, 0.005, 0.01, 0.05, 0.1, 0.2]),
  chart: Object.freeze({
    // row height by the number of rows: at most fewRows, at most midRows, more
    rowPx: Object.freeze({ six: 30, thirty: 17, other: 16, fewRows: 8, midRows: 40 }),
    marginTop: 8, marginBottom: 40, marginRight: 14,
    // the grade column: a stripe stripePx wide, stripeGap px left of the names; the names end nameGap px left of the
    // plot; a name is about charPx px per character at the base font size
    stripePx: 22, stripeGap: 6, nameGap: 7, charPx: 6.9, minName: 24,
    line: 2.5, dot: 3.6, ticks: 5, narrowTicks: 4, narrowPx: 420, pad: 0.04, bandOpacity: 0.55, half: 0.5, dash: "4,3",
    selected: 7, selectedWidth: 2, defaultWidth: 640,
  }),
  data: Object.freeze({
    six: Object.freeze({
      label: "Six sites, score A",
      array: "one",
      title: "Six sites, score A",
      axis: "Score A, posterior (standardized units)",
      grade1: "Grade 1 = stated highest on score A, as the posterior judges it: the sites visited first. Same grade: not compared.",
      unit: "site", units: "sites",
      readName: "Six sites, score A",
    }),
    thirty: Object.freeze({
      label: "Thirty sites, poverty",
      title: "Thirty sites, poverty criterion",
      axis: "Poverty criterion, posterior (synthetic units)",
      grade1: "Grade 1 = stated highest on synthetic need, as the posterior judges it. Same grade: not compared.",
      unit: "site", units: "sites",
      readName: "Thirty sites, poverty criterion",
      note: "A one-criterion view of the package's thirty-site example, built for this site; the package's own example weighs three criteria.",
    }),
  }),
  text: Object.freeze({
    dataLegend: "Data",
    tauLabel: "Withholding cost τ",
    capLabel: "At most this many grades",
    orderLegend: "Sort within grades",
    orderWords: Object.freeze({
      grade: "grade (the card's stored order)",
      expected_rank: "expected rank",
      mean: "posterior mean",
      label: "label",
    }),
    orderRead: Object.freeze({
      grade: "the card's stored order within grades (expected rank)",
      expected_rank: "expected rank within grades",
      mean: "larger posterior mean first within grades",
      label: "label within grades",
    }),
    revealStart: "Reveal grade by grade",
    revealNext: "Reveal next grade",
    revealAgain: "Start again at grade 1",
    revealAll: "Show all grades",
    cardHeading: "The report card",
    header: "{G} = {Gv} grades · N = {N} of M = {M} pairs stated · s = N/M = {s}",
    headerOne: "{G} = {Gv} grade · N = {N} of M = {M} pairs stated · s = N/M = {s}",
    resultAt: "At τ = {tau} with at most {cap} grades: ",
    reports: "reports",
    riskLine: "Risk {risk}; E/N = {eon}.",
    orderFamily: "the declared order is the expected-rank order",
    caption: "{level} equal-tail posterior intervals; points are means. Same grade means withholding, not equality.",
    captionSupplied: "{level} supplied central intervals; points are means. Same grade means withholding, not equality.",
    marginal: "Each interval is marginal: it describes one unit alone. Intervals do not decide the grades; the grades come from the pair errors, τ and the cap.",
    hiddenGrade: "Grade {g} is not shown yet.",
    legendGrade: "Grade {g}: {n} {units}",
    legendHidden: "Grade {g}: not shown yet",
    betweenHeading: "How reliable are comparisons between grades?",
    betweenCaption: "Each cell below the diagonal is the expected share of wrong stated directions between two grades. It averages, over those pairs (their number is below it), the probability that stating the unit of the column's grade above the unit of the row's grade is wrong. Diagonal: the grade's average posterior mean. Solid outline: adjacent grades; dashed outline: grade averages.",
    betweenShort: "Between-grade expected wrong shares, with grade-average posterior means on the diagonal",
    betweenCorner: "Row grade, column grade",
    gradeHead: "Grade {g}",
    pairsWord: "{n} pairs",
    pairWord: "{n} pair",
    shadeLegend: "Shading: a darker purple is a larger expected wrong share (cuts at {cuts}).",
    summaryAdjacent: "Adjacent grades: {list}. ",
    summaryFar: "Grades two or more apart: {list}. ",
    summaryOne: "With one grade the card states no direction, so there is nothing to compare.",
    summaryFirst: "With one grade shown there is nothing to compare yet.",
    summaryShown: "Only the grades shown so far are compared.",
    pairItem: "{v} (grades {h} and {hp})",
    largest: "The largest single stated error, {v} ({i} above {j}), is between {kind} grades.",
    adjacentWord: "adjacent",
    farWord: "nonadjacent",
    cardAlt: "{title}: one row per {unit} in grade order, grade 1 at the top, each with its posterior mean (a dot) and {level} marginal posterior interval (a line) in its grade's color; a column at the left carries the grade numbers.",
    tableCaption: "{title}, rows in display order.",
    colUnit: "Unit",
    colGrade: "Grade",
    colMean: "Posterior mean",
    colLower: "Interval lower end",
    colUpper: "Interval upper end",
    colRank: "Expected rank",
    keyboardLabel: "Units of the report card",
    tip: "{name}\nGrade {g} of {G}\nPosterior mean {mean}\n{level} interval {lower} to {upper}{rank}",
    tipRank: "\nExpected rank {rank}",
    readout: "{name}, τ = {tau}, at most {cap} grades: the card {card} has risk {risk}. Rows: {orderWords}; grades {first} to {shown} of {G} shown.",
    readoutOne: "{name}, τ = {tau}, at most {cap} grades: the card {card} has risk {risk} and states no direction. Rows: {orderWords}.",
  }),
});

const T = CONFIG.text;
const C = CONFIG.chart;

// ------------------------------------------------------------------------------------------------- helpers

/** Split a template "a {x} b" into strings and the nodes slots[x]() returns. */
export function fill(template, slots = {}) {
  return String(template).split(/(\{\w+\})/).filter((p) => p !== "").map((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (!m) return p;
    const f = slots[m[1]];
    return typeof f === "function" ? f() : f ?? p;
  });
}

const textOfParts = (parts) => parts.map((p) => (typeof p === "string" ? p : p?.textContent ?? "")).join("");

/** The card of a set of independent normal marginals (see the header). */
export function gaussianCard({ ids, names, mean, sd, level = CONFIG.level, expectedRank: er, axis, grade1, unit, units, title, storedOrder, digits } = {}) {
  if (!Array.isArray(ids) || !Array.isArray(mean) || !Array.isArray(sd) || ids.length !== mean.length || ids.length !== sd.length) {
    throw new TypeError("gaussianCard: ids, mean and sd of equal length are required");
  }
  const iv = mean.map((m, i) => normalInterval(m, sd[i], level));
  return {
    ids: [...ids], names: names ? [...names] : [...ids], mean: [...mean], sd: [...sd],
    lower: iv.map((x) => x.lower), upper: iv.map((x) => x.upper), expectedRank: er ? [...er] : null,
    level, intervalSource: "equal-tail posterior", storedOrder: storedOrder ?? "expected_rank",
    axis, grade1, unit: unit ?? "unit", units: units ?? "units", title, digits,
  };
}

const ENGINE_SORT = Object.freeze({ expected_rank: "expected_rank", mean: "mean", label: "label", input: "grade" });

/** Unit indices in display order, by the package rule (see the header). */
export function cardRows(card, grade, order = "grade") {
  const summaries = { ids: card.ids };
  if (card.expectedRank) summaries.expectedRank = card.expectedRank;
  if (card.mean) summaries.mean = card.mean;
  const sort = order === "grade" ? ENGINE_SORT[card.storedOrder ?? "expected_rank"] ?? "expected_rank" : order;
  return reportCardRows(grade, summaries, sort);
}

/** Per grade: { grade, n, mean } of the posterior means (pr-core summaryStats). */
export function gradeAverages(grade, mean) {
  const G = Math.max(...grade);
  return Array.from({ length: G }, (_, k) => {
    const vals = mean.filter((_, i) => grade[i] === k + 1);
    return { grade: k + 1, n: vals.length, mean: vals.length ? summaryStats(vals).mean : null };
  });
}

/** The number of grades shown for a reveal value (0 or at least G: all). */
export const shownGrades = (reveal, G) => (reveal > 0 && reveal < G ? reveal : G);

/** A nice x domain over the intervals, padded on both sides. */
function xDomain(card) {
  const lo = Math.min(...card.lower);
  const hi = Math.max(...card.upper);
  const pad = (hi - lo) * C.pad || 1;
  return [lo - pad, hi + pad];
}

const levelText = (level) => formatPercent(level);

/** The grade legend (see the header). */
export function gradeLegend(doc, { grade, colors, unit = "unit", units = "units", grade1, shown } = {}) {
  const d = disclosure(grade);
  const num = (raw, display) => numSpan(raw, display, { document: doc });
  const p = doc.createElement("p");
  p.className = "prx-rc-legend";
  d.sizes.forEach((size, k) => {
    const item = doc.createElement("span");
    item.className = "prx-rc-key";
    const sw = doc.createElement("span");
    sw.className = "prx-rc-swatch";
    sw.setAttribute("aria-hidden", "true");
    sw.style.setProperty("--prx-rc-swatch", colors[k]);
    const words = doc.createElement("span");
    words.append(...fill(Number.isInteger(shown) && k + 1 > shown ? T.legendHidden : T.legendGrade, {
      g: () => num(k + 1, formatCount(k + 1)), n: () => num(size, formatCount(size)), units: size === 1 ? unit : units,
    }));
    item.append(sw, words);
    p.append(item);
  });
  if (grade1) {
    const o = doc.createElement("span");
    o.className = "prx-rc-orient";
    o.textContent = grade1;
    p.append(o);
  }
  return p;
}

/** Draw the report-card figure; optional domain shares an x range; rankLabel names a caller-supplied rank summary. */
export function drawReportCard(el, card, { grade, order = "grade", reveal = 0, rowPx, title, keyboardLabel, selected, domain, rankLabel } = {}) {
  if (!el || el.nodeType !== 1) throw new TypeError("drawReportCard: el must be an element");
  if (!Array.isArray(grade) || grade.length !== card.ids.length) throw new TypeError("drawReportCard: a grade vector of the card's length is required");
  if (domain !== undefined && (!Array.isArray(domain) || domain.length !== 2 || !domain.every(Number.isFinite) || domain[0] >= domain[1])) throw new RangeError("drawReportCard: domain must contain two finite increasing values");
  if (rankLabel !== undefined && (typeof rankLabel !== "string" || !rankLabel.trim())) throw new TypeError("drawReportCard: rankLabel must be a nonempty string");
  const rankHeading = rankLabel ?? T.colRank;
  const doc = el.ownerDocument;
  const n = card.ids.length;
  const G = Math.max(...grade);
  const shown = shownGrades(reveal, G);
  const rowsOrder = cardRows(card, grade, order);
  const digits = Number.isInteger(card.digits) ? card.digits : CONFIG.digits.value;
  const val = (v) => formatDecimal(v, { digits });
  const root = el.closest?.(".prx-widget");
  const fontScale = Number(root?.getAttribute("data-prx-font-scale")) || 1;
  const rowHeight = (rowPx ?? (n <= C.rowPx.fewRows ? C.rowPx.six : n <= C.rowPx.midRows ? C.rowPx.thirty : C.rowPx.other)) * fontScale;
  // card.fullNames (optional): the names for the keyboard titles when the rows draw short names
  const names = card.names ?? card.ids;
  const all = rowsOrder.map((i, pos) => ({
    i, pos, id: card.ids[i], name: names[i], fullName: (card.fullNames ?? names)[i], grade: grade[i],
    mean: card.mean[i], lower: card.lower[i], upper: card.upper[i], rank: card.expectedRank ? card.expectedRank[i] : null,
  }));
  const rows = all.filter((r) => r.grade <= shown);
  // the grade blocks along the rows
  const bands = [];
  for (const r of all) {
    const b = bands[r.grade - 1] ?? (bands[r.grade - 1] = { grade: r.grade, first: r.pos, last: r.pos, size: 0 });
    b.last = r.pos;
    b.size += 1;
  }
  for (const b of bands) b.mid = (b.first + b.last) / 2;
  const [lo, hi] = domain ?? xDomain(card);
  const nameW = Math.max(C.minName, Math.max(...names.map((s) => String(s).length)) * C.charPx) * fontScale;
  const marginLeft = Math.round(C.stripePx * fontScale + C.stripeGap + nameW + C.nameGap);
  const width = Math.max(1, Math.round(el.clientWidth || el.getBoundingClientRect?.().width || 0)) || undefined;
  const w = width ?? C.defaultWidth;
  const innerW = Math.max(1, w - marginLeft - C.marginRight);
  const perPx = (hi - lo) / innerW;
  // data x of a pixel offset to the left of the plot frame
  const leftOf = (px) => lo - px * perPx;
  const stripeX1 = leftOf(marginLeft - 1);
  const stripeX2 = leftOf(marginLeft - 1 - C.stripePx * fontScale);
  const stripeMid = (stripeX1 + stripeX2) / 2;
  const level = levelText(card.level ?? CONFIG.level);
  const titleText = title ?? card.title ?? "Report card";
  const tipText = (d) => textOfParts(fill(T.tip, {
    name: d.fullName, g: formatCount(d.grade), G: formatCount(G), mean: val(d.mean), level, lower: val(d.lower), upper: val(d.upper),
    rank: d.rank === null ? "" : rankLabel === undefined ? textOfParts(fill(T.tipRank, { rank: formatDecimal(d.rank, { digits: CONFIG.digits.rank }) })) : `\n${rankHeading}: ${formatDecimal(d.rank, { digits: CONFIG.digits.rank })}`,
  }));
  const hiddenBands = bands.filter((b) => b.grade > shown);
  const columns = [
    { label: T.colUnit, value: "name" },
    { label: T.colGrade, value: "grade", format: (x) => formatCount(x) },
    { label: T.colMean, value: "mean", format: (x) => val(x) },
    { label: T.colLower, value: "lower", format: (x) => val(x) },
    { label: T.colUpper, value: "upper", format: (x) => val(x) },
  ];
  if (card.expectedRank) columns.push({ label: rankHeading, value: "rank", format: (x) => formatDecimal(x, { digits: CONFIG.digits.rank }) });
  const narrow = w < C.narrowPx;
  let colors = null;
  const chart = plot(el, {
    alt: textOfParts(fill(T.cardAlt, { title: titleText, unit: card.unit ?? "unit", level })),
    table: { caption: textOfParts(fill(T.tableCaption, { title: titleText })), columns, rows },
    width,
    height: Math.round(C.marginTop + C.marginBottom + n * rowHeight),
    marginTop: C.marginTop, marginBottom: C.marginBottom, marginLeft, marginRight: C.marginRight,
    x: { domain: [lo, hi], ticks: narrow ? C.narrowTicks : C.ticks, label: card.axis ?? "Posterior value", labelAnchor: "center", labelArrow: "none", grid: true },
    y: { domain: [n - C.half, -C.half], axis: null },
    color: { type: "identity" },
    marks: (k, P) => {
      colors = gradeColors(G, k);
      const sel = Number.isInteger(selected) ? rows.filter((r) => r.i === selected) : [];
      return [
        P.rect(bands.filter((b) => b.grade % 2 === 1), { x1: () => lo, x2: () => hi, y1: (b) => b.first - C.half, y2: (b) => b.last + C.half, fill: k.plotGrid, fillOpacity: C.bandOpacity }),
        P.ruleY(bands.slice(1), { y: (b) => b.first - C.half, x1: () => stripeX1, x2: () => hi, stroke: k.plotMuted, strokeDasharray: C.dash }),
        // the grade column: a stripe in the grade's color with its number (every grade mark carries its number)
        P.rect(bands, { x1: () => stripeX1, x2: () => stripeX2, y1: (b) => b.first - C.half, y2: (b) => b.last + C.half, fill: (b) => colors[b.grade - 1], inset: 1 }),
        numText(bands, { x: () => stripeMid, y: "mid", value: "grade", format: (x) => formatCount(x), fill: (b) => labelOn(colors[b.grade - 1], k), fontWeight: "bold", textAnchor: "middle" }),
        P.text(rows, { x: () => lo, y: "pos", text: "name", dx: -C.nameGap, textAnchor: "end", fill: k.plotFg }),
        P.ruleY(rows, { y: "pos", x1: "lower", x2: "upper", stroke: (d) => colors[d.grade - 1], strokeWidth: C.line }),
        P.dot(sel, { x: "mean", y: "pos", r: C.selected, fill: "none", stroke: k.plotFg, strokeWidth: C.selectedWidth }),
        P.dot(rows, { x: "mean", y: "pos", r: C.dot, fill: (d) => colors[d.grade - 1], stroke: k.plotBg }),
        P.text(hiddenBands, { x: () => (lo + hi) / 2, y: "mid", text: (b) => textOfParts(fill(T.hiddenGrade, { g: formatCount(b.grade) })), fill: k.plotMuted }),
        P.tip(rows, P.pointerY({ x: "mean", y: "pos", title: tipText })),
      ];
    },
    keyboard: { data: rows, x: "mean", y: "pos", key: (d) => d.id, sort: false, label: keyboardLabel ?? T.keyboardLabel, title: tipText },
  });
  // the row order as data, for the read-out check (the same array the rows above were drawn from; every row)
  let hook = el.querySelector(':scope > [data-prx-readout="order"]');
  if (!hook) {
    hook = doc.createElement("span");
    hook.hidden = true;
    hook.setAttribute("data-prx-readout", "order");
    el.append(hook);
  }
  hook.setAttribute("data-num", rowsOrder.join(","));
  hook.textContent = formatTuple(rowsOrder, (i) => formatCount(i));
  return { chart, order: rowsOrder, shown, G, colors: colors ?? gradeColors(G, palette(el)) };
}

const purpleStep = (v) => {
  let s = 0;
  while (s < CONFIG.purpleCuts.length && v >= CONFIG.purpleCuts[s]) s += 1;
  return s;
};

/** The lower-triangle between-grade table and its summary line (see the header). */
export function drawBetweenGrades(el, { grade, E, w, mean, shown, names, hookPrefix = "", caption = T.betweenCaption } = {}) {
  const doc = el.ownerDocument;
  const pal = palette(el);
  const G = Math.max(...grade);
  const S = shownGrades(shown ?? 0, G);
  const num = (raw, display, hook) => {
    const s = numSpan(raw, display, { document: doc });
    if (hook) s.setAttribute("data-prx-readout", `${hookPrefix}${hook}`);
    return s;
  };
  const make = (tag, attrs = {}, ...kids) => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, v);
    node.append(...kids.flat());
    return node;
  };
  const between = G > 1 ? betweenGradeErrors(grade, E, w ? { w } : {}) : [];
  const avg = gradeAverages(grade, mean);
  const colors = gradeColors(G, pal);
  const cells = {};
  const table = make("table", { class: "prx-rc-between-table", "aria-label": T.betweenShort });
  const head = make("tr", {}, make("td", { class: "prx-rc-corner", "aria-label": T.betweenCorner }));
  for (let h = 1; h <= S; h += 1) head.append(make("th", { scope: "col" }, ...fill(T.gradeHead, { g: () => num(h, formatCount(h)) })));
  table.append(make("thead", {}, head));
  const body = make("tbody");
  for (let hp = 1; hp <= S; hp += 1) {
    const tr = make("tr", {}, make("th", { scope: "row" }, ...fill(T.gradeHead, { g: () => num(hp, formatCount(hp)) })));
    for (let h = 1; h <= S; h += 1) {
      if (h === hp) {
        const a = avg[h - 1];
        const td = make("td", { class: "prx-rc-diag" },
          make("span", { class: "prx-rc-diag-swatch", "aria-hidden": "true", style: `--prx-rc-swatch: ${colors[h - 1]}` }),
          num(a.mean, formatDecimal(a.mean, { digits: CONFIG.digits.average }), `gmean-${h}`));
        tr.append(td);
      } else if (h < hp) {
        const b = between.find((x) => x.h === h && x.hp === hp);
        const fillColor = pal.purples[purpleStep(b.meanError)];
        const td = make("td", {
          class: `prx-rc-cell${hp === h + 1 ? " prx-rc-adjacent" : ""}`,
          style: `background: ${fillColor}; color: ${labelOn(fillColor, pal)}`,
        },
        make("span", { class: "prx-rc-cell-value" }, num(b.meanError, formatRisk(b.meanError), `between-${h}-${hp}`)),
        make("span", { class: "prx-rc-cell-pairs" }, ...fill(b.pairs === 1 ? T.pairWord : T.pairsWord, { n: () => num(b.pairs, formatCount(b.pairs), `pairs-${h}-${hp}`) })));
        cells[`${h}-${hp}`] = b;
        tr.append(td);
      } else {
        tr.append(make("td", { class: "prx-rc-empty" }));
      }
    }
    body.append(tr);
  }
  table.append(body);
  const wrap = scrollRegion(make("div", { class: "prx-rc-between-scroll" }, table), T.betweenShort);
  const legend = make("p", { class: "prx-rc-shade" },
    make("span", { class: "prx-rc-ramp", "aria-hidden": "true" }, ...pal.purples.map((c) => make("span", { style: `background: ${c}` }))),
    make("span", {}, ...fill(T.shadeLegend, {
      cuts: () => {
        const span = doc.createElement("span");
        CONFIG.purpleCuts.forEach((c, i) => { if (i) span.append(", "); span.append(numSpan(c, formatProb(c), { document: doc })); });
        return span;
      },
    })));
  // summary: adjacent cells, then the farther ones, then the largest single stated error
  const summary = make("p", { class: "prx-rc-summary" });
  if (G === 1) summary.append(T.summaryOne);
  else if (S === 1) summary.append(T.summaryFirst);
  else {
    const item = (b, hook) => fill(T.pairItem, {
      v: () => num(b.meanError, formatRisk(b.meanError), hook), h: () => num(b.h, formatCount(b.h)), hp: () => num(b.hp, formatCount(b.hp)),
    });
    const list = (bs, prefix) => {
      const out = [];
      bs.forEach((b, k) => { if (k) out.push(k === bs.length - 1 ? " and " : ", "); out.push(...item(b, `${prefix}-${b.h}-${b.hp}`)); });
      return out;
    };
    const vis = between.filter((b) => b.hp <= S);
    const adj = vis.filter((b) => b.hp === b.h + 1);
    const far = vis.filter((b) => b.hp > b.h + 1);
    if (adj.length) summary.append(...fill(T.summaryAdjacent, { list: () => make("span", {}, ...list(adj, "sum")) }));
    if (far.length) summary.append(...fill(T.summaryFar, { list: () => make("span", {}, ...list(far, "sum")) }));
    // the largest stated error among the shown grades, and its pair
    const visible = Array.from(grade, (_, i) => i).filter((i) => grade[i] <= S);
    const selected = { ids: visible.map(i => E.ids[i]), criteria: E.criteria,
      e: E.e.map(ek => visible.map(i => visible.map(j => ek[i][j]))) };
    const largest = visible.length > 1 ? largestStatedError(visible.map(i => grade[i]), selected, w ? { w } : {}) : null;
    const best = largest ? { v: largest.e, i: visible[largest.i], j: visible[largest.j] } : null;
    if (best) {
      const nm = names ?? E.ids;
      summary.append(...fill(T.largest, {
        v: () => num(best.v, formatRisk(best.v), "largest"), i: nm[best.i], j: nm[best.j],
        kind: grade[best.j] === grade[best.i] + 1 ? T.adjacentWord : T.farWord,
      }));
    }
    if (S < G) summary.append(" ", T.summaryShown);
  }
  el.replaceChildren(make("p", { class: "prx-rc-between-note" }, caption), wrap, legend, summary);
  return { cells, summary, between, averages: avg };
}

// ------------------------------------------------------------------------------------------------- data

function sixData() {
  const u = SIX.tables.units;
  const E = SIX.arrays[CONFIG.data.six.array];
  const D = CONFIG.data.six;
  const card = gaussianCard({
    ids: u.id, names: u.label, mean: u.mean_A, sd: u.sd_A, level: CONFIG.level, expectedRank: expectedRank(E, {}),
    axis: D.axis, grade1: D.grade1, unit: D.unit, units: D.units, title: D.title,
  });
  return { key: "six", E, card, D };
}

function thirtyData() {
  const u = THIRTY.tables.units;
  const g = THIRTY.arrays.gaussian;
  const E = { ids: g.ids, criteria: [g.criteria[0]], e: [g.e[0]] };
  const D = CONFIG.data.thirty;
  const card = gaussianCard({
    ids: u.id, names: u.id, mean: u.mean_poverty, sd: u.sd_poverty, level: CONFIG.level, expectedRank: expectedRank(E, {}),
    axis: D.axis, grade1: D.grade1, unit: D.unit, units: D.units, title: D.title,
  });
  return { key: "thirty", E, card, D };
}

let cachedData = null;
/** The two data sets (built once). */
export function datasets() {
  if (!cachedData) cachedData = { six: sixData(), thirty: thirtyData() };
  return cachedData;
}

const solved = new Map();
/** The card's grades at a setting: the engine result, its grade vector and counts (cached). */
export function solve({ data, tau, cap }) {
  const key = `${data}|${tau}|${cap}`;
  if (solved.has(key)) return solved.get(key);
  const set = datasets()[data];
  let result;
  if (data === "six") result = exactOptimum(set.E, { tau, family: { kind: "atMost", G: cap } });
  else result = fixedOrderDP(set.E, { scores: set.card.expectedRank, direction: "ascending", G: cap, tau });
  const grade = Array.from(result.grade);
  const d = disclosure(grade);
  const out = {
    data, tau, cap, result, grade, G: d.G, sizes: d.sizes, N: d.N, M: pairCount(grade.length), s: d.s,
    risk: result.risk, EoverN: Array.isArray(result.EoverN) ? result.EoverN[0] : null,
  };
  if (solved.size >= 256) solved.delete(solved.keys().next().value);
  solved.set(key, out);
  return out;
}

/** Shared card styles: importing apps include this CSS and add prx-rc to their root class. */
export const REPORT_CARD_CSS = `.prx-rc .prx-rc-result .prx-result-tag { color: var(--prx-plot-fg); }
.prx-rc .prx-radio-group legend{
  font-size: 1em;
  line-height: inherit;
}
.prx-rc .prx-controls{
  align-items: flex-start;
}
.prx-rc .prx-rc-data .prx-radio, .prx-rc .prx-rc-order .prx-radio{
  display: inline-flex;
  margin-right: 1rem;
  font-weight: 400;
}
.prx-rc .prx-rc-reveal{
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}
.prx-rc .prx-rc-sym i{
  font-family: var(--prx-font-math, "STIX Two Math", "Cambria Math", serif);
}
.prx-rc .prx-rc-heading{
  margin: 0 0 0.25rem;
  font-size: 1em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}
.prx-rc .prx-rc-card, .prx-rc .prx-rc-between{
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem 0.75rem;
  background: var(--prx-plot-bg);
  color: var(--prx-plot-fg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
  min-width: 0;
}
.prx-rc .prx-rc-card .prx-rc-heading, .prx-rc .prx-rc-between .prx-rc-heading{
  color: var(--prx-plot-fg);
}
.prx-rc .prx-rc-header p{
  margin: 0 0 0.25rem;
}
.prx-rc .prx-rc-counts{
  font-weight: 600;
}
.prx-rc .prx-rc-result{
  font-size: 0.95em;
}
.prx-rc .prx-rc-chart{
  min-width: 0;
  max-width: 100%;
}
.prx-rc .prx-rc-legend{
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0.25rem 0 0;
  font-size: 0.9em;
}
.prx-rc .prx-rc-key{
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.prx-rc .prx-rc-swatch, .prx-rc .prx-rc-diag-swatch{
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 2px;
  background: var(--prx-rc-swatch);
  flex: 0 0 auto;
}
.prx-rc .prx-rc-orient{
  flex: 1 1 100%;
}
.prx-rc .prx-rc-card-caption, .prx-rc .prx-rc-note{
  margin: 0.4rem 0 0;
  font-size: 0.88em;
  font-style: italic;
  color: var(--prx-plot-muted);
}
.prx-rc .prx-rc-wait{
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  text-align: center;
  color: var(--prx-fg-muted);
  border: 1px dashed var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}
.prx-rc .prx-rc-between-scroll{
  max-width: 100%;
  overflow-x: auto;
}
.prx-rc .prx-rc-between-table{
  border-collapse: separate;
  border-spacing: 3px;
  font-size: 0.92em;
}
.prx-rc .prx-rc-between-note{
  max-width: 44rem;
  margin: 0 0 0.4rem;
  font-size: 0.9em;
  color: var(--prx-plot-muted);
}
.prx-rc .prx-rc-between-table th{
  padding: 0.2rem 0.4rem;
  font-weight: 600;
  white-space: nowrap;
  text-align: center;
}
.prx-rc .prx-rc-between-table td{
  min-width: 3.9rem;
  padding: 0.3rem 0.4rem;
  text-align: center;
  vertical-align: middle;
  border-radius: 3px;
}
.prx-rc .prx-rc-cell{
  border: 1px solid var(--prx-cell-border);
}
.prx-rc .prx-rc-cell.prx-rc-adjacent{
  outline: 2.5px solid var(--prx-plot-fg);
  outline-offset: -1px;
}
.prx-rc .prx-rc-cell-value{
  display: block;
  font-weight: 600;
}
.prx-rc .prx-rc-cell-pairs{
  display: block;
  font-size: 0.82em;
}
.prx-rc .prx-rc-diag{
  font-style: italic;
  white-space: nowrap;
  border: 1px dashed var(--prx-cell-border);
}
.prx-rc .prx-rc-diag-swatch{
  margin-right: 0.3rem;
  vertical-align: -0.1rem;
}
.prx-rc .prx-rc-shade{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
  margin: 0.4rem 0 0;
  font-size: 0.85em;
  color: var(--prx-plot-muted);
}
.prx-rc .prx-rc-ramp{
  display: inline-flex;
  border: 1px solid var(--prx-cell-border);
}
.prx-rc .prx-rc-ramp span{
  display: inline-block;
  width: 0.9rem;
  height: 0.8rem;
}
.prx-rc .prx-rc-summary{
  margin: 0.5rem 0 0;
}
@media (max-width: 30rem){
.prx-rc .prx-rc-between-table{
    border-spacing: 2px;
    font-size: 0.82em;
  }
.prx-rc .prx-rc-between-table th, .prx-rc .prx-rc-between-table td{
    min-width: 0;
    padding: 0.25rem 0.2rem;
  }
}
`;

// ------------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    className: CONFIG.className,
    css: REPORT_CARD_CSS,
    keys: {
      data: { type: "choice", values: [...CONFIG.datasets], value: CONFIG.defaults.data },
      tau: { type: "number", ...CONFIG.tau, snap: true },
      cap: { type: "integer", ...CONFIG.cap },
      order: { type: "choice", values: [...CONFIG.orders], value: CONFIG.defaults.order },
      reveal: { type: "integer", ...CONFIG.reveal },
    },
    build(ctx) {
      const { h } = ctx;
      const hooked = (node, name) => { if (name) node.setAttribute("data-prx-readout", name); return node; };
      const num = (raw, display, name) => hooked(ctx.num(raw, display), name);
      const count = (raw, name) => num(raw, formatCount(raw), name);
      const setting = (raw, name) => num(raw, formatSetting(raw), name);
      const sym = (base, arg) => h("span", { class: "prx-rc-sym" }, h("i", {}, base), arg ? ["(", h("i", {}, arg), ")"] : []);

      // --- controls
      const dataRadio = ctx.radioGroup({
        legend: T.dataLegend, name: "data", className: "prx-rc-data",
        options: CONFIG.datasets.map((v) => ({ value: v, label: CONFIG.data[v].label })),
        value: ctx.state.data, onChange: (v) => ctx.set({ data: v }),
      });
      const tauSlider = ctx.slider({ label: T.tauLabel, ...CONFIG.tau, value: ctx.state.tau, name: "tau", onInput: (v) => ctx.set({ tau: v }) });
      const capOptions = [];
      for (let g = CONFIG.cap.min; g <= CONFIG.cap.max; g += 1) capOptions.push({ value: g, label: formatCount(g) });
      const capSelect = ctx.select({ label: T.capLabel, options: capOptions, value: ctx.state.cap, name: "cap", onChange: (v) => ctx.set({ cap: v }) });
      const orderRadio = ctx.radioGroup({
        legend: T.orderLegend, name: "order", className: "prx-rc-order",
        options: CONFIG.orders.map((v) => ({ value: v, label: T.orderWords[v] })),
        value: ctx.state.order, onChange: (v) => ctx.set({ order: v }),
      });
      let lastG = 1;
      const revealBtn = ctx.button({
        label: T.revealStart, key: "reveal-next",
        onClick: () => {
          const r = ctx.state.reveal;
          if (r === 0 || r >= lastG) ctx.set({ reveal: 1 });
          else ctx.set({ reveal: r + 1 });
        },
      });
      const allBtn = ctx.button({ label: T.revealAll, key: "reveal-all", onClick: () => ctx.set({ reveal: 0 }) });
      const revealBox = h("div", { class: "prx-control prx-rc-reveal" }, revealBtn.root, allBtn.root);
      ctx.controls.append(dataRadio.root, tauSlider.root, capSelect.root, orderRadio.root, revealBox);

      // --- header, card, legend, caption
      const header = h("div", { class: "prx-rc-header" });
      const chartSlot = h("div", { class: "prx-rc-chart" });
      const legendSlot = ctx.part("legend", h("div", { class: "prx-rc-legend-slot" }));
      const cardCaption = h("p", { class: "prx-rc-card-caption" });
      const dataNote = h("p", { class: "prx-rc-note", hidden: true });
      const cardBox = h("section", { class: "prx-rc-card", "aria-label": T.cardHeading },
        ctx.panelTitle(T.cardHeading, { className: "prx-rc-heading" }), header, chartSlot, legendSlot, cardCaption, dataNote);

      // --- between-grade panel
      const betweenSlot = h("div", { class: "prx-rc-between-body" });
      const betweenBox = ctx.part("table", h("section", { class: "prx-rc-between prx-light-panel", "aria-label": T.betweenHeading },
        ctx.panelTitle(T.betweenHeading, { className: "prx-rc-heading" }), betweenSlot));
      ctx.charts.append(cardBox, betweenBox);
      ctx.caption.replaceChildren(captionNode(ctx, "teaching-posterior"));

      // --- drawing
      function drawHeader(r, set) {
        const one = r.G === 1;
        const line1 = h("p", { class: "prx-rc-counts" }, ...fill(one ? T.headerOne : T.header, {
          G: () => sym("G", "g"), Gv: () => count(r.G, "G"), N: () => count(r.N, "N"), M: () => count(r.M, "M"),
          s: () => num(r.s, formatShare(r.s), "s"),
        }));
        const label = [tagNode(ctx, r.result, { orderWords: "the expected-rank order" })];
        if (set.key === "thirty") label.push("; ", T.orderFamily);
        if (r.result.tieCount > 1) label.push("; ", count(r.result.tieCount), " reports share the smallest risk; this card shows the first (equal-risk tolerance ", num(r.result.tieTol, formatSci(r.result.tieTol)), ")");
        const line2 = h("p", { class: "prx-rc-result" },
          ...fill(T.resultAt, { tau: () => setting(r.tau, "tau"), cap: () => count(r.cap, "cap") }), ...label, ". ",
          ...fill(T.riskLine, {
            risk: () => num(r.risk, formatRisk(r.risk), "risk"),
            eon: () => num(r.EoverN, formatShare(r.EoverN), "EoverN"),
          }));
        header.replaceChildren(line1, line2);
      }

      function drawCard(r, set, state) {
        const out = drawReportCard(chartSlot, set.card, { grade: r.grade, order: state.order, reveal: state.reveal });
        legendSlot.replaceChildren(gradeLegend(ctx.doc, { grade: r.grade, colors: out.colors, unit: set.card.unit, units: set.card.units, grade1: set.D.grade1, shown: out.shown }));
        const lvl = num(set.card.level, levelText(set.card.level), "level");
        cardCaption.replaceChildren(...fill(set.card.intervalSource === "supplied central" ? T.captionSupplied : T.caption, { level: () => lvl }), " ", T.marginal);
        dataNote.hidden = !set.D.note;
        dataNote.textContent = set.D.note ?? "";
        return out;
      }

      function drawReveal(state, G) {
        const r = state.reveal;
        const shown = shownGrades(r, G);
        revealBtn.setLabel(r === 0 ? T.revealStart : shown < G ? T.revealNext : T.revealAgain);
        revealBtn.setDisabled(G === 1);
        allBtn.setDisabled(r === 0 || G === 1);
      }

      function drawReadout(r, set, state, shown) {
        const vectorForm = r.grade.length <= CONFIG.vectorMax;
        const card = vectorForm ? num(r.grade, formatGrades(r.grade), "ro-card") : h("span", {}, "with ", num(r.sizes, formatSizes(r.sizes), "ro-sizes"));
        ctx.readout.set(fill(r.G === 1 ? T.readoutOne : T.readout, {
          name: set.D.readName, tau: () => setting(r.tau, "ro-tau"), cap: () => count(r.cap, "ro-cap"), card: () => card,
          risk: () => num(r.risk, formatRisk(r.risk), "ro-risk"), orderWords: T.orderRead[state.order],
          first: () => count(1), shown: () => count(shown, "ro-shown"), G: () => count(r.G, "ro-G"),
        }));
      }

      return {
        render(state) {
          ctx.root.setAttribute("aria-busy", "true");
          try {
            dataRadio.set(state.data);
            tauSlider.set(state.tau);
            capSelect.set(state.cap);
            orderRadio.set(state.order);
            const set = datasets()[state.data];
            const r = solve(state);
            lastG = r.G;
            drawHeader(r, set);
            const out = drawCard(r, set, state);
            drawReveal(state, r.G);
            drawReadout(r, set, state, out.shown);
            drawBetweenGrades(betweenSlot, { grade: r.grade, E: set.E, mean: set.card.mean, shown: state.reveal, names: set.card.names });
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
