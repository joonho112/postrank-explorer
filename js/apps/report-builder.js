// A report decides all pairs through ordered grades. Counts and relations come from the engine.
import { createWidget, uid } from "../shared/base.js";
import { canvasLayer, gradeColors, labelOn, numText, palette, plot } from "../shared/chart.js";
import { formatCount, formatGrades, formatShare, formatSigned, formatSizes, blocksText } from "../shared/format.js";
import { canonicalGrade, disclosure, familySize, pairCount, relations } from "../pr-core.js";
import SIX from "../../data/released/six-sites.json" with { type: "json" };

export const CONFIG = Object.freeze({
  name: "report-builder",
  label: "A report is many pair decisions: place the sites into grades and read which directions the report states",
  title: "Six sites: put them into grades",
  className: "prx-rb",
  units: Object.freeze({ values: Object.freeze([4, 6]), value: 6, split: 5 }),
  grades: Object.freeze({ maxLabel: 99, value: Object.freeze([1, 2, 2, 2, 2, 3]) }),
  // the report a switch of the number of sites starts from
  starts: Object.freeze({ 4: Object.freeze([1, 2, 2, 2]), 6: Object.freeze([1, 2, 2, 2, 2, 3]) }),
  // the side fact: possible reports of 2 … 6 sites
  sizes: Object.freeze({ from: 2, to: 6 }),
  // a mouse or pen press becomes a drag after `threshold` px. A touch press (review 044 repair, G1-F3) becomes a drag
  // only after it is held for holdMs ms without moving more than touchSlop px, or when it first moves mostly sideways
  // (at least touchSlop px across, and more than `sideways` times as far across as up or down): the chips allow
  // vertical panning, so a vertical swipe that starts on a site scrolls the page and leaves the report as it was
  drag: Object.freeze({ threshold: 5, holdMs: 350, touchSlop: 8, sideways: 1.5 }),
  matrix: Object.freeze({
    marginTop: 22, marginLeft: 22, marginRight: 4, marginBottom: 4,
    minCell: 30, maxCell: 52, inset: 0.5, dotShare: 0.3, hatchSpacing: 6, hatchWidth: 1.2,
    changedWidth: 3, changedInset: 3, labelShare: 0.4, labelWeight: 700,
  }),
  keys: Object.freeze({ top: "0" }),
  text: Object.freeze({
    unitsLegend: "Sites in the report",
    unitsFour: "Four sites, A to D",
    unitsSix: "Six sites, A to F",
    unitsHint: "Switching starts from that size's first report.",
    builderHeading: "The report",
    builderHint: "Drag a site onto another grade, or tap it and then tap a grade. With the keyboard, focus a site and press the number of a grade; zero makes a new grade at the top, and the number after the last grade a new one at the bottom. Or press Enter to pick the site up, Up and Down to choose a grade, and Enter to drop it (Escape puts it back).",
    // review 044 repair (G1-F2 in X-16, X-14): one visible line; the full text above moves into a closed box and stays
    // the list's description (aria-describedby); the touch line says how a drag starts on a touch screen (G1-F3)
    builderHintShort: "Drag or tap a site, then a grade.",
    keysTitle: "Keyboard and touch",
    touchHint: "On a touch screen, a swipe that starts on a site scrolls the page. To drag a site, hold it for a moment or move it sideways first; a tap on the site and then a tap on a grade also moves it.",
    countsTitle: "Counts in detail",
    // the one-line result under the boxes (review 044 repair, G1-F2 in X-16): the tiles' numbers in words
    resultOf: "of",
    resultPairsStated: "pairs stated",
    resultWithheld: "withheld",
    resultShare: "share",
    resultGrade: "grade",
    resultGrades: "grades",
    // the short description every site button carries; the long hint above describes the list once
    chipHint: "Press a grade number to move the site, or Enter to pick it up.",
    orientation: "Grade 1 = highest priority, the sites visited first; a larger grade number is a lower priority.",
    gradeWord: "Grade",
    first: "visited first",
    last: "visited last",
    site: "site",
    sites: "sites",
    newTop: "New grade above grade 1",
    newBottom: "New grade below grade",
    dropHere: "drop a site here",
    siteWord: "Site",
    inGrade: "in grade",
    of: "of",
    readHeading: "What the report states",
    matrixAlt: "Relation matrix of the report: each cell says whether the report states the row site above the column site, withholds the pair, or states the row site below.",
    matrixTable: "The pairs of sites and what the report does with each",
    relationTitle: "Row site relative to column site in this report",
    relAbove: "row site stated above (>)",
    relWithheld: "withheld: same grade (not a claim of equality)",
    relBelow: "row site stated below (<)",
    gradeKey: "circle: the site's grade",
    changedKey: "outline: changed by the last move",
    twice: "Each stated pair appears twice in the matrix (once in each triangle): its two cells mirror each other across the diagonal, one showing > and the other <. A withheld pair is gray in both of its cells.",
    tileM: "Pairs, M",
    tileN: "Pairs stated, N",
    tileShare: "Share stated, N/M",
    tileG: "Number of grades",
    ruleLead: "N = M minus the pairs inside each grade:",
    insideCaption: "Pairs inside each grade (all withheld)",
    colGrade: "Grade",
    colSites: "Sites",
    colInside: "Pairs inside",
    allGrades: "All grades",
    vectorLead: "Grade vector",
    vectorOrder: "in site order",
    blocksLead: "blocks",
    tidied: Object.freeze(["Labels tidied: the labels ", "{raw}", " give the report ", "{tidied}", " (grades are numbered ", "{one}", ", ", "{two}", ", and so on in order, grade ", "{one}", " for the smallest label)."]),
    sideLead: "Side fact, the number of possible reports:",
    sideFor: "for",
    sideTail: "No two of them make the same pair decisions.",
    sideOfWords: Object.freeze({ 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" }),
    note: "The six fictional sites come from the postrank tutorial. A higher score A gives a site higher priority. The matrix counts the directions implied by the grade assignments.",
    states: "states",
    pairsOf: "of the",
    pairsWord: "pairs and withholds",
    statesEnd: ".",
    moved: "moved to grade",
    movedTop: "(a new grade at the top)",
    movedBottom: "(a new grade at the bottom)",
    renumbered: "Grades renumbered:",
    nowIn: "now in grade",
    stays: "stays in grade",
    staysEnd: "; the report does not change.",
    deltaMore: "The report now states",
    deltaMoreEnd: "more",
    deltaFewer: "fewer",
    onePair: " pair",
    pairsWordShort: " pairs",
    deltaSame: "The report states as many pairs as before.",
    pickedUp: "picked up from grade",
    pickHelp: "Tap a grade, or use Up and Down to choose one and Enter to drop it there; Escape puts it back.",
    pickTarget: "Drop",
    pickInto: "into grade",
    pickIntoTop: "into a new grade at the top",
    pickIntoBottom: "into a new grade at the bottom",
    pickEnter: "? Press Enter.",
    putBack: "put back in grade",
    outside: "was dropped outside the boxes; nothing changed.",
    noGrade: "There is no grade",
    noGradeMid: "; press a number from",
    noGradeTo: "to",
  }),
});

const T = CONFIG.text;
const MX = CONFIG.matrix;
/** Render reasons that change no setting (base.js): the read-out is kept as it is on these. */
const REDRAW_ONLY = new Set(["disclosure", "resize", "theme", "motion"]);
const SVGNS = "http://www.w3.org/2000/svg";
const IDS = Object.freeze(SIX.tables.units.id.slice());

// ---------------------------------------------------------------------------------------------- keys and helpers

/** units: 4 or 6 (a number goes to the nearer of the two). */
export function parseUnits(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return n < CONFIG.units.split ? CONFIG.units.values[0] : CONFIG.units.values[1];
}

/** grades: an array or "1,2,2" / "1/2/2"; each label rounded and clamped to 1 … maxLabel; at most six entries. */
export function parseGrades(v) {
  const list = Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v)
    : typeof v === "string" ? v.split(/[\s,/]+/).filter((s) => s !== "").map(Number) : null;
  if (!list || list.length < 1) return undefined;
  const out = [];
  for (const x of list) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return undefined;
    out.push(Math.min(CONFIG.grades.maxLabel, Math.max(1, Math.round(n))));
  }
  return out.slice(0, IDS.length);
}

/** The report shown for a state: the raw labels cut or filled to `units`, and their canonical grade vector. */
export function reportOf(state) {
  const n = state.units;
  let raw = Array.from(state.grades ?? []).slice(0, n);
  if (raw.length === 0) raw = Array.from(CONFIG.starts[n]);
  while (raw.length < n) raw.push(Math.max(...raw));
  return { n, ids: IDS.slice(0, n), raw, g: canonicalGrade(raw) };
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The sites of each grade, grade 1 first. */
function blocksOf(g, ids) {
  const G = Math.max(...g);
  const out = [];
  for (let h = 1; h <= G; h += 1) out.push(ids.filter((_, i) => g[i] === h));
  return out;
}

/** "{A, B} > {C, D} > {E, F}" */
export { blocksText };

/** "A and B, then C and D, then E and F" (the words form for screen readers). */
function blocksWords(g, ids) {
  const list = (b) => (b.length < 2 ? b.join("") : `${b.slice(0, -1).join(", ")} and ${b.at(-1)}`);
  return blocksOf(g, ids).map(list).join(", then ");
}

/** Pairs inside each grade: pairCount of each grade's size (the withheld pairs). */
function insideOf(sizes) {
  return sizes.map((k) => pairCount(k));
}

/**
 * Move site i of the canonical vector g to a target: a grade number, "top" (a new grade above grade 1) or "bottom" (a
 * new grade below the last). The new labels go through canonicalGrade, so an emptied grade disappears. Returns
 * { next, moved, renumbered: [{ k, grade }] } (the other sites whose grade number changed).
 */
export function moveSite(g, i, target) {
  const G = Math.max(...g);
  let raw;
  if (target === "top") raw = g.map((x, k) => (k === i ? 1 : x + 1));
  else if (target === "bottom") raw = g.map((x, k) => (k === i ? G + 1 : x));
  else raw = g.map((x, k) => (k === i ? target : x));
  const next = canonicalGrade(raw);
  const renumbered = [];
  for (let k = 0; k < g.length; k += 1) if (k !== i && next[k] !== g[k]) renumbered.push({ k, grade: next[k] });
  return { next, moved: !same(next, g), renumbered };
}

/** Draw the ordered grade boxes. The host owns interactions and supplies a chip factory and box handler.
 * Defaults make a read-only preview. Use REPORT_BUILDER_CSS inside a .prx-rb host. */
export function drawGradeBoxes(ctx, boxes, rep, { chipOf = (i) => ctx.h("span", { class: "prx-rb-site" }, rep.ids[i]), onBoxClick = () => {} } = {}) {
  const { h } = ctx;
  const count = (v) => ctx.num(v, formatCount(v));
  const g = Array.from(rep.g);
  const G = Math.max(...g);
  const pal = palette(ctx.root);
  const colors = gradeColors(G, pal);
  function boxOf(t, members, G, pal, colors) {
    const isNew = t === "top" || t === "bottom";
    const attrs = { class: `prx-rb-box${isNew ? " prx-rb-new" : ""}`, "data-prx-box": String(t) };
    let head;
    if (isNew) {
      head = h("div", { class: "prx-rb-box-head" },
        h("span", { class: "prx-rb-new-mark", "aria-hidden": "true", text: "+" }),
        t === "top" ? h("span", { text: T.newTop }) : h("span", {}, `${T.newBottom} `, count(G)),
        h("span", { class: "prx-rb-drop", text: ` · ${T.dropHere}` }));
    } else {
      const fillColor = colors[t - 1];
      const tag = t === 1 ? T.first : t === G && G > 1 ? T.last : null;
      head = h("div", { class: "prx-rb-box-head" },
        h("span", { class: "prx-rb-swatch", style: { background: fillColor, color: labelOn(fillColor, pal) } }, count(t)),
        h("span", { class: "prx-rb-box-name" }, `${T.gradeWord} `, count(t)),
        tag ? h("span", { class: "prx-rb-tag", text: ` · ${tag}` }) : null,
        h("span", { class: "prx-rb-size" }, " · ", count(members.length), ` ${members.length === 1 ? T.site : T.sites}`));
    }
    const chips = h("div", { class: "prx-rb-chips" }, ...members.map((i) => chipOf(i)));
    const box = h("li", attrs, head, isNew ? null : chips);
    box.addEventListener("click", (e) => onBoxClick(e, t));
    return box;
  }


  const targets = ["top", ...Array.from({ length: G }, (_, i) => i + 1), "bottom"];
  boxes.replaceChildren(...targets.map((t) => boxOf(t, t === "top" || t === "bottom" ? [] : g.map((v, i) => v === t ? i : -1).filter((i) => i >= 0), G, pal, colors)));
  return boxes;
}

/** Family-size rows used in the report count side fact and its companion app. */
export function reportCountRows(from = CONFIG.sizes.from, to = CONFIG.sizes.to) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => ({ n: from + i, count: familySize(from + i, { kind: "all" }) }));
}

/** Full relation matrix with hatching, both triangles, grade dots, change outlines and keyboard reading. */
const relationLayers = new WeakMap();
/** Paint every off-diagonal source relation; all numerical grade marks remain SVG data-num labels. */
// Generic IDs can be wider than the original single-letter sites. Measure the actual plot font;
// the deterministic fallback is only for non-browser DOM fixtures without Canvas.measureText.
function relationIdWidth(ctx, ids) {
    const fontSize = 12 * (Number(ctx.root.getAttribute('data-prx-font-scale')) || 1);
    const probe = ctx.doc.createElement('canvas').getContext?.('2d');
    if (probe) probe.font = `${fontSize}px ${ctx.win.getComputedStyle(ctx.root).fontFamily || 'system-ui'}`;
    const widthOf = id => probe?.measureText ? probe.measureText(String(id)).width
        : Array.from(String(id)).reduce((width, ch) => width + (ch.codePointAt(0) > 0x2e80 ? fontSize : fontSize * 2 / 3), 0);
    return { fontSize, width: Math.max(0, ...ids.map(widthOf)) };
}
function paintRelationCells(g, { x, y, palette: c }, p) {
    const inset = MX.inset, size = p.cell - 2 * inset;
    g.lineWidth = 1;
    g.strokeStyle = c.cellBorder;
    g.beginPath();
    for (const d of p.cells) {
        const left = x(d.col) - p.cell / 2 + inset, top = y(d.row) - p.cell / 2 + inset;
        g.fillStyle = d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld;
        g.fillRect(left, top, size, size);
        g.rect(left, top, size, size);
    }
    g.stroke();
    for (const d of p.diag) {
        g.fillStyle = c.plotGrid;
        g.fillRect(x(d.col) - p.cell / 2 + inset, y(d.row) - p.cell / 2 + inset, size, size);
    }
    // Batch the original diagonal hatch lines into one path, avoiding a clip/save for every withheld cell.
    g.strokeStyle = c.hatch;
    g.lineWidth = MX.hatchWidth;
    g.beginPath();
    for (const d of p.cells) {
        if (d.rel !== 0)
            continue;
        const left = x(d.col) - p.cell / 2 + inset, top = y(d.row) - p.cell / 2 + inset;
        for (let offset = -size; offset <= size; offset += MX.hatchSpacing * Math.SQRT2) {
            const startX = Math.max(0, offset), startY = Math.max(0, -offset), endX = Math.min(size, offset + size), endY = endX - offset;
            g.moveTo(left + startX, top + startY);
            g.lineTo(left + endX, top + endY);
        }
    }
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `${MX.labelWeight} ${Math.round(p.cell * MX.labelShare)}px sans-serif`;
    for (const d of p.cells) {
        if (d.rel === 0)
            continue;
        g.fillStyle = labelOn(d.rel === 1 ? c.relAbove : c.relBelow, c);
        g.fillText?.(d.rel === 1 ? ">" : "<", x(d.col), y(d.row));
    }
}
function installRelationPointer(ctx, figure, layer) {
    const tip = layer.tip ?? ctx.h("div", { class: "prx-rb-pointer-tip", "aria-hidden": "true", hidden: true, style: { position: "fixed", "z-index": "20", "max-width": "min(22rem, calc(100vw - 1rem))", background: "var(--prx-plot-bg)", color: "var(--prx-plot-fg)", border: "1px solid var(--prx-plot-muted)", padding: ".35rem .5rem", "pointer-events": "none", "font-size": ".85rem", "white-space": "normal", "overflow-wrap": "anywhere", width: "max-content" } });
    if (!layer.tip) {
        layer.tip = tip;
        ctx.root.append(tip);
        ctx.onCleanup(() => { tip.remove(); layer.tip = null; });
    }
    tip.hidden = true;
    if (layer.pointerArea === figure.area) return;
    layer.pointerArea = figure.area;
    const locate = event => { const p = layer.paint, r = figure.area.getBoundingClientRect(), xx = (event.clientX - r.left) * p.width / (r.width || p.width), yy = (event.clientY - r.top) * p.height / (r.height || p.height), i = Math.floor((yy - p.marginTop) / p.cell), j = Math.floor((xx - p.marginLeft) / p.cell); return i >= 0 && j >= 0 && i < p.n && j < p.n ? p.every[i * p.n + j] : null; };
    figure.area.addEventListener("pointermove", event => { const d = locate(event), p = layer.paint; if (!d) {
        tip.hidden = true;
        if (layer.hovered !== null) {
            layer.hovered = null;
            p.onHover?.(null);
        }
        return;
    } if (layer.hovered !== `${d.i}:${d.j}`) {
        layer.hovered = `${d.i}:${d.j}`;
        p.onHover?.(d);
    } tip.textContent = d.diagonal ? `${p.names[d.i]}: grade ${p.g[d.i]}` : `${p.names[d.i]} / ${p.names[d.j]}: ${d.rel === 0 ? "withheld (same grade)" : d.rel === 1 ? "row stated above column" : "row stated below column"}`; tip.hidden = false; const r = tip.getBoundingClientRect(); tip.style.left = `${Math.max(8, Math.min(ctx.win.innerWidth - r.width - 8, event.clientX + 12))}px`; tip.style.top = `${Math.max(8, Math.min(ctx.win.innerHeight - r.height - 8, event.clientY + 12))}px`; });
    figure.area.addEventListener("pointerleave", () => { tip.hidden = true; layer.hovered = null; layer.paint.onHover?.(null); });
    figure.area.addEventListener("click", event => { const d = locate(event); if (d)
        layer.paint.onPick?.(d); });
    figure.area.addEventListener("keydown", event => { if (!event.target.closest?.(".prx-kbd-point") || event.key !== "Enter" && event.key !== " ")
        return; event.preventDefault(); const state = figure.el.__prxChart, index = state.points.findIndex(p => p.key === state.activeKey); if (index >= 0)
        layer.paint.onPick?.(state.points[index].d); });
}
/** Actual relation grid. large retains all cells via canvas and one virtual keyboard target.
 * Optional rep.names/unit/units name generic inputs; selected/onFocus/onPick use zero-based i,j.
 * The caller places the large slot in a labeled two-axis scroll region. Default SVG behavior is unchanged. */
export function drawRelationMatrix(ctx, matrixSlot, matrixLegend, rep, { rel = relations(rep.g), changed = null, hatchId = uid("prx-rb-hatch"), large = false, selected = null, onFocus, onPick, onHover } = {}) {
    const { h } = ctx;
    const { n, ids, g } = rep;
    const names = rep.names ?? ids, unit = rep.unit ?? "unit", units = rep.units ?? "units";
    const generic=large||rep.names!==undefined||rep.unit!==undefined||rep.units!==undefined;
    if (names.length !== n)
        throw new RangeError("Relation matrix names must match its units");
    const wording = text => generic ? text.replace(/\bsites\b/g, units).replace(/\bsite\b/g, unit) : text;
    // Review 044 repair, G1-F4: the size is recomputed from the room the slot has now. The previous drawing's
    // max-width (and, in large mode, width) is cleared before measuring, so a smaller report (four sites) does not cap
    // the next one (338 -> 234 -> 230 px), and a wider window grows the matrix again.
    matrixSlot.style.maxWidth = "";
    matrixSlot.style.width = "";
    // Row labels get the room they need (review 044 repair, X-09: 2.20's league ids "U04" lost their first glyph in
    // the fixed 22 px margin). Single-letter sites measure below that margin, so their matrices are unchanged.
    const idMeasure=relationIdWidth(ctx,ids);
    const marginLeft=Math.max(MX.marginLeft,Math.ceil(idMeasure.width)+11);
    const avail = matrixSlot.clientWidth || Math.min(ctx.width(), MX.maxCell * n + marginLeft + MX.marginRight);
    const cell = Math.max(MX.minCell, Math.min(MX.maxCell, Math.floor((avail - marginLeft - MX.marginRight) / n)));
    const tickRotate=generic&&idMeasure.width>cell-3?-60:0;
    const marginTop=tickRotate?Math.max(MX.marginTop,Math.ceil(idMeasure.width*Math.sqrt(3)/2+idMeasure.fontSize+10)):MX.marginTop;
    const marginRight=tickRotate?Math.max(MX.marginRight,Math.ceil(idMeasure.fontSize+4)):MX.marginRight;
    const width = marginLeft + marginRight + n * cell;
    const height = marginTop + MX.marginBottom + n * cell;
    matrixSlot.style.maxWidth = `${width}px`;
    const moved = changed && same(changed.after, g) ? changed.cells : null;
    const cells = [];
    const diag = [];
    const every = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const d = { i, j, row: ids[i], col: ids[j] };
            if (i === j) {
                Object.assign(d, { diagonal: true, grade: g[i] });
                diag.push(d);
            }
            else {
                Object.assign(d, { rel: rel[i][j], moved: Boolean(moved?.has(`${i},${j}`)) });
                cells.push(d);
            }
            every.push(d);
        }
    }
    const pairs = [];
    for (let i = 0; i < n; i += 1)
        for (let j = i + 1; j < n; j += 1)
            pairs.push({ i, j, rel: rel[i][j] });
    const G = Math.max(...g);
    const relWords = (d) => (d.rel === 1 ? `the report states ${d.row} above ${d.col}`
        : d.rel === -1 ? `the report states ${d.col} above ${d.row}`
            : `the report withholds this pair (${d.row} and ${d.col} are both in grade ${g[d.i]})`);
    let layer = relationLayers.get(matrixSlot);
    if ((large || onPick || onHover) && !layer) {
        layer = { canvas: null, paint: null };
        relationLayers.set(matrixSlot, layer);
    }
    if (!large && layer?.canvasEntry) { layer.canvasEntry.remove(); layer.canvasEntry = null; layer.canvas = null; }
    if (large || onPick || onHover)
        layer.paint = { cells, diag, every, n, ids, names, g, cell, width, height, marginLeft, marginTop, selected, onFocus, onPick, onHover, relWords };
    const figure = plot(matrixSlot, {
        alt: wording(T.matrixAlt),
        table: {
            caption: wording(T.matrixTable),
            columns: [
                { label: "Pair", name: generic, value: (r) => `${ids[r.i]} and ${ids[r.j]}` },
                { label: "The report", name: generic, value: (r) => (r.rel === 1 ? `states ${ids[r.i]} above ${ids[r.j]}` : r.rel === -1 ? `states ${ids[r.j]} above ${ids[r.i]}` : `withholds the pair (both in grade ${g[r.i]})`), num: false },
            ],
            rows: pairs,
        },
        width, height,
        marginTop, marginLeft, marginRight, marginBottom: MX.marginBottom,
        x: { domain: ids, padding: 0, axis: "top", label: null, tickSize: 0, ...(large ? { ticks: ids } : {}), ...(generic?{tickRotate}: {}) },
        y: { domain: ids, padding: 0, label: null, tickSize: 0, ...(large ? { ticks: ids } : {}) },
        color: { type: "identity" },
        marks: (c, P) => {
            const fillOf = (d) => (d.rel === 1 ? c.relAbove : d.rel === -1 ? c.relBelow : c.relWithheld);
            const filled = cells.map((d) => ({ ...d, fill: fillOf(d), ink: labelOn(fillOf(d), c) }));
            const stated = filled.filter((d) => d.rel !== 0);
            const withheld = filled.filter((d) => d.rel === 0);
            const colors = gradeColors(G, c);
            const dots = diag.map((d) => ({ ...d, fill: colors[d.grade - 1], ink: labelOn(colors[d.grade - 1], c) }));
            const hatch = () => {
                const defs = ctx.doc.createElementNS(SVGNS, "defs");
                const pat = ctx.doc.createElementNS(SVGNS, "pattern");
                for (const [k, v] of Object.entries({ id: hatchId, patternUnits: "userSpaceOnUse", width: MX.hatchSpacing, height: MX.hatchSpacing, patternTransform: "rotate(45)" }))
                    pat.setAttribute(k, String(v));
                const line = ctx.doc.createElementNS(SVGNS, "line");
                for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: MX.hatchSpacing, stroke: c.hatch, "stroke-width": MX.hatchWidth }))
                    line.setAttribute(k, String(v));
                pat.append(line);
                defs.append(pat);
                return defs;
            };
            return [
                P.cell(diag, { x: "col", y: "row", fill: c.plotGrid, inset: MX.inset }),
                ...(!large ? [P.cell(filled, { x: "col", y: "row", fill: "fill", stroke: c.cellBorder, strokeWidth: 1, inset: MX.inset }),
                    hatch,
                    P.cell(withheld, { x: "col", y: "row", fill: `url(#${hatchId})`, inset: MX.inset }),
                    P.text(stated, { x: "col", y: "row", text: (d) => (d.rel === 1 ? ">" : "<"), fill: "ink", fontWeight: MX.labelWeight, fontSize: Math.round(cell * MX.labelShare) })] : []),
                selected ? P.cell(every.filter(d => (d.i === selected.i && d.j === selected.j) || (d.i === selected.j && d.j === selected.i)), { x: "col", y: "row", fill: "none", stroke: c.plotFocus, strokeWidth: MX.changedWidth, inset: MX.changedInset }) : null,
                moved && moved.size ? P.cell(filled.filter((d) => d.moved), { x: "col", y: "row", fill: "none", stroke: c.plotFg, strokeWidth: MX.changedWidth, inset: MX.changedInset }) : null,
                P.dot(dots, { x: "col", y: "row", r: cell * MX.dotShare, fill: "fill", stroke: c.plotBg }),
                numText(dots, { x: "col", y: "row", value: "grade", format: (v) => formatCount(v), fill: "ink" }),
            ];
        },
        keyboard: {
            data: every, x: "col", y: "row", key: (d) => large ? `${d.i}:${d.j}` : `${d.row}${d.col}`, sort: false, columns: n,
            label: wording(T.matrixAlt),
            virtual: large,
            ...((onFocus || large) ? { onFocus: d => { onFocus?.(d); if (large) {
                    matrixSlot.querySelector(".prx-kbd-point")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
                    const region = matrixSlot.closest(".prx-scroll-region");
                    if (region) {
                        if (d.i === 0)
                            region.scrollTop = 0;
                        if (d.j === 0)
                            region.scrollLeft = 0;
                    }
                } } } : {}),
            title: (d) => (d.diagonal
                ? `Row ${generic ? names[d.i] : d.row}, column ${generic ? names[d.j] : d.col}: the same ${generic ? unit : "site"}, in grade ${d.grade}.`
                : `Row ${generic ? names[d.i] : d.row}, column ${generic ? names[d.j] : d.col}: ${relWords(d)}.${d.moved ? " The last move changed this cell." : ""}`),
        },
    });
    if(generic)figure.figure.querySelectorAll('g[aria-label$="tick label"] text').forEach(node=>node.setAttribute('data-prx-name',''));
    // the matrix's geometry, for a host that pins a copy of the row labels while its box scrolls (2.20; review 044, X-09)
    figure.relationGeometry = { n, cell, width, height, marginLeft, marginTop, marginRight };
    if (large) {
        matrixSlot.style.width = `${width}px`;
        figure.figure.style.width = `${width}px`;
        figure.figure.style.maxWidth = "none";
        figure.area.style.maxWidth = "none";
        if (!layer.canvas || !matrixSlot.contains(layer.canvas)) {
            layer.canvasEntry = canvasLayer(figure, (g, geometry) => paintRelationCells(g, geometry, layer.paint));
            layer.canvas = layer.canvasEntry.canvas;
        }
        installRelationPointer(ctx, figure, layer);
        matrixSlot.dataset.prxMatrixCells = String(every.length);
        matrixLegend.classList.add("prx-rb-legend");
    } else if (onPick || onHover) {
        installRelationPointer(ctx, figure, layer);
    }
    const keys = [
        h("span", { class: "prx-rb-legend-title", text: wording(T.relationTitle) }),
        h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key", style: { background: "var(--prx-rel-above)" } }), wording(T.relAbove)),
        h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-hatch" }), wording(T.relWithheld)),
        h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key", style: { background: "var(--prx-rel-below)" } }), wording(T.relBelow)),
        h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-dot" }), wording(T.gradeKey)),
    ];
    if (moved && moved.size)
        keys.push(h("span", { class: "prx-rb-key" }, h("span", { class: "prx-rb-swatch-key prx-rb-swatch-outline" }), T.changedKey));
    matrixLegend.replaceChildren(...keys);
    return figure;
}
// ---------------------------------------------------------------------------------------------- widget

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: CONFIG.name,
    label: CONFIG.label,
    title: CONFIG.title,
    className: CONFIG.className,
    css: REPORT_BUILDER_CSS + REPORT_BUILDER_APP_CSS,
    // the shared result-first frame (review 044, X-01): the units radio and the preset row, the read-out (the move
    // narration and the summary, the one live region), then the builder beside the matrix; base.js only moves nodes
    layout: "result-first",
    keys: {
      units: { type: "custom", value: CONFIG.units.value, parse: (v) => parseUnits(v) },
      grades: { type: "custom", value: Array.from(CONFIG.grades.value), parse: (v) => parseGrades(v) },
    },
    build(ctx) {
      const { h } = ctx;
      const num = (raw, display) => ctx.num(raw, display);
      const count = (x) => num(x, formatCount(x));
      const ro = (name, raw, display) => { const s = ctx.num(raw, display); s.setAttribute("data-prx-readout", name); return s; };
      const hatchId = uid("prx-rb-hatch");
      const hintId = uid("prx-rb-hint");
      const chipHintId = uid("prx-rb-chip-hint");
      const blocksNodes = (g, ids) => [
        h("span", { "aria-hidden": "true", text: blocksText(g, ids) }),
        h("span", { class: "prx-sr-only", text: blocksWords(g, ids) }),
      ];
      /** "{slot}" templates (arrays of strings) filled with nodes */
      const fill = (parts, slots) => parts.map((p) => {
        const m = /^\{(\w+)\}$/.exec(p);
        return m && m[1] in slots ? slots[m[1]]() : p;
      });

      // --- controls: the number of sites
      const unitsRadio = ctx.radioGroup({
        legend: T.unitsLegend, name: "units", className: "prx-rb-units",
        options: [{ value: CONFIG.units.values[0], label: T.unitsFour }, { value: CONFIG.units.values[1], label: T.unitsSix }],
        value: ctx.state.units,
        onChange: (v) => { cancelPick(); note = null; ctx.set({ units: v, grades: Array.from(CONFIG.starts[v]) }); },
      });
      const unitsHint = h("p", { class: "prx-hint prx-rb-units-hint", text: T.unitsHint });
      ctx.controls.append(unitsRadio.root, unitsHint);

      // --- the builder (controls part: the boxes are the widget's main control). Review 044 repair (G1-F2 in X-16,
      // X-14): the orientation line is plain text (no longer painted as a legend panel); one short visible hint, with
      // the full keyboard text (still the list's aria-describedby) and the touch line in a closed "Keyboard and
      // touch" box beside it; the one-line result directly under the boxes
      const orientation = h("p", { class: "prx-rb-orientation", "data-prx-part": "notes", text: T.orientation });
      const hintShort = h("p", { class: "prx-hint prx-rb-hint-short", text: T.builderHintShort });
      const hintRow = h("div", { class: "prx-rb-hint-row" }, hintShort);
      const keysBox = ctx.disclosure({ name: "keyboard", title: T.keysTitle, placement: { after: hintShort }, className: "prx-rb-keys" });
      const hint = h("p", { id: hintId, class: "prx-hint prx-rb-hint", text: T.builderHint });
      const touchHint = h("p", { class: "prx-hint prx-rb-touch-hint", text: T.touchHint });
      keysBox.body.append(hint, touchHint);
      const chipHint = h("p", { id: chipHintId, class: "prx-sr-only", text: T.chipHint });
      const boxes = h("ol", { class: "prx-rb-boxes", "aria-label": T.builderHeading, "aria-describedby": hintId });
      // the control a reader changes first (base.js primaryControl): the boxes; the read-out sits above them, the
      // one-line result directly under them
      ctx.primaryControl(boxes);
      const result = h("p", { class: "prx-rb-result", "data-prx-part": "readout" });
      const builder = h("section", { class: "prx-rb-builder", "data-prx-part": "controls", "aria-label": T.builderHeading },
        h("h4", { class: "prx-rb-heading", text: T.builderHeading }), orientation, hintRow, chipHint, boxes, result);

      // --- the matrix (the graphic a move changes: base.js primaryGraphic) and counts
      const matrixSlot = h("div", { class: "prx-rb-matrix-chart" });
      ctx.primaryGraphic(matrixSlot);
      const matrixLegend = h("div", { class: "prx-rb-legend", "data-prx-part": "legend" });
      const twice = h("p", { class: "prx-rb-note", "data-prx-part": "notes", text: T.twice });
      const matrixBox = h("section", { class: "prx-rb-matrix", "aria-label": T.readHeading },
        h("h4", { class: "prx-rb-heading", text: T.readHeading }), matrixSlot, matrixLegend, twice);
      const tiles = h("div", { class: "prx-rb-tiles", "data-prx-part": "readout" });
      const rule = h("p", { class: "prx-rb-rule", "data-prx-part": "readout" });
      const insideSlot = ctx.scrollRegion(h("div", { class: "prx-rb-inside", "data-prx-part": "table" }), T.insideCaption);
      const vectorLine = h("p", { class: "prx-rb-vector", "data-prx-part": "readout" });
      const tidyLine = h("p", { class: "prx-rb-tidy", "data-prx-part": "notes", hidden: true });
      const countsBox = h("section", { class: "prx-rb-counts", "aria-label": T.tileN }, tiles, rule, insideSlot, vectorLine, tidyLine);
      const sideLine = h("p", { class: "prx-rb-side", "data-prx-part": "notes" });

      const grid = h("div", { class: "prx-rb-grid" }, builder, matrixBox);
      ctx.charts.append(grid);
      // review 044 repair (X-14, G1-F12): the tiles, the rule line, the inside-grade table, the grade vector, the
      // tidy line and the side fact, complete, in a closed box under the matrix; the result line keeps N, M, the
      // share and the number of grades visible
      ctx.disclosure({ name: "counts", title: T.countsTitle }).body.append(countsBox, sideLine);
      ctx.caption.textContent = T.note;

      // --- interaction state
      let note = null;        // one-shot: what the last move did (read-out lead)
      let changed = null;     // { after, cells: Set("i,j") } of the last move
      let picked = null;      // keyboard / click pick-up: { i, target } (target: an index into targetsOf(g))
      let drag = null;        // pointer drag in progress
      let suppressClick = false;
      let current = reportOf(ctx.state);

      const targetsOf = (g) => ["top", ...Array.from({ length: Math.max(...g) }, (_, k) => k + 1), "bottom"];
      const targetIndex = (g, t) => targetsOf(g).findIndex((x) => x === t);

      // read-out pieces
      function summary(rep, d) {
        return [...blocksNodes(rep.g, rep.ids), ": the report ", T.states, " ", ro("readout-N", d.N, formatCount(d.N)), " ",
          T.pairsOf, " ", ro("readout-M", d.M, formatCount(d.M)), " ", T.pairsWord, " ",
          ro("readout-withheld", d.M - d.N, formatCount(d.M - d.N)), T.statesEnd];
      }
      const siteName = (i) => `${T.siteWord} ${current.ids[i]}`;
      function say(parts) { ctx.readout.set(parts); }
      function targetWords(t, g) {
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
        say([`${siteName(i)} ${T.pickedUp} `, count(current.g[i]), `. ${T.pickHelp}`]);
      }

      function aimAt(index) {
        const list = targetsOf(current.g);
        picked.target = Math.max(0, Math.min(list.length - 1, index));
        syncBuilder();
        say([`${T.pickTarget} ${current.ids[picked.i]} `, ...targetWords(list[picked.target], current.g), T.pickEnter]);
      }

      /** The one path every input takes: drag, number key, pick-up and drop, click on a box. */
      function place(i, target) {
        picked = null;
        const g = current.g;
        const before = disclosure(g);
        const res = moveSite(g, i, target);
        if (!res.moved) {
          note = [`${siteName(i)} ${T.stays} `, count(g[i]), T.staysEnd];
          changed = null;
          ctx.requestRender("move");
          return;
        }
        const after = disclosure(res.next);
        const r0 = relations(g);
        const r1 = relations(res.next);
        const cells = new Set();
        for (let a = 0; a < g.length; a += 1) for (let b = 0; b < g.length; b += 1) if (a !== b && r0[a][b] !== r1[a][b]) cells.add(`${a},${b}`);
        // dN: the change in the stated pairs, shown in the result line while the outlines show this move
        changed = { after: res.next.slice(), cells, dN: after.N - before.N };
        const lead = [`${siteName(i)} ${T.moved} `, count(res.next[i])];
        if (target === "top") lead.push(` ${T.movedTop}`);
        else if (target === "bottom") lead.push(` ${T.movedBottom}`);
        lead.push(".");
        if (res.renumbered.length) {
          // the other sites whose grade number changed, grouped by their new grade
          const groups = new Map();
          for (const r of res.renumbered) groups.set(r.grade, [...(groups.get(r.grade) ?? []), current.ids[r.k]]);
          lead.push(` ${T.renumbered} `);
          [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([grade, list], idx) => {
            const who = list.length < 2 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
            lead.push(idx ? "; " : "", h("span", { "data-prx-name": "", text: who }), ` ${T.nowIn} `, count(grade));
          });
          lead.push(".");
        }
        const dN = after.N - before.N;
        const delta = dN === 0 ? [` ${T.deltaSame}`]
          : [` ${T.deltaMore} `, count(Math.abs(dN)), ` ${dN > 0 ? T.deltaMoreEnd : T.deltaFewer}${Math.abs(dN) === 1 ? T.onePair : T.pairsWordShort}.`];
        note = [...lead, ...delta];
        ctx.set({ grades: res.next });
      }

      // ------------------------------------------------------------------------------------------- builder

      function chipOf(i) {
        const id = current.ids[i];
        const chip = h("button", {
          type: "button", class: "prx-rb-site", "data-prx-site": id, "data-prx-focus-key": `site:${id}`,
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

      // --- keyboard and click
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
          case "ArrowUp": e.preventDefault(); aimAt(picked.target - 1); break;
          case "ArrowDown": e.preventDefault(); aimAt(picked.target + 1); break;
          case "Home": e.preventDefault(); aimAt(0); break;
          case "End": e.preventDefault(); aimAt(list.length - 1); break;
          case "Escape": e.preventDefault(); cancelPick(true); break;
          default: break;
        }
      }

      // --- pointer drag (mouse, pen, touch): the chip follows the pointer; the box under it is the target. A mouse or
      // pen drag starts after CONFIG.drag.threshold px. A touch drag (review 044 repair, G1-F3) starts only after a
      // press-and-hold (holdMs) or a first move that is mostly sideways: the chips allow vertical panning (CSS
      // touch-action: pan-y), so a vertical swipe that starts on a site scrolls the page (the browser takes it and
      // cancels the pointer) and the report stays as it was; tap, then tap a grade, is unchanged
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
        if (drag) endDrag(); // a second finger (or a lost pointerup) ends the earlier press
        const touch = e.pointerType === "touch";
        const d = { i, chip, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, touch, held: false, cancelHold: null };
        drag = d;
        if (touch) {
          // held still for holdMs: the press is a drag in any direction from now on (the chip shows it); endDrag (also
          // run by destroy) clears the timer
          const timer = ctx.win.setTimeout(() => {
            d.cancelHold = null;
            if (drag !== d || d.active) return;
            d.held = true;
            chip.classList.add("prx-rb-held");
          }, CONFIG.drag.holdMs);
          d.cancelHold = () => ctx.win.clearTimeout(timer);
        }
      }
      /** Whether a press that has moved (dx, dy) px becomes a drag now. */
      function startsDrag(d, dx, dy) {
        const dist = Math.hypot(dx, dy);
        if (!d.touch) return dist >= CONFIG.drag.threshold;
        if (d.held) return dist >= CONFIG.drag.threshold;
        const across = Math.abs(dx);
        if (across >= CONFIG.drag.touchSlop && across > CONFIG.drag.sideways * Math.abs(dy)) return true;
        // moved before the hold time and not sideways: a scroll (the browser takes it) or a tap's wobble
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
      // a touch drag (held, or started sideways) owns the finger: the page must not scroll under it. Touch events are
      // the only way to stop the browser's own panning, and only from a listener that is not passive
      ctx.listen(boxes, "touchmove", (e) => {
        if (drag?.touch && (drag.active || drag.held) && e.cancelable) e.preventDefault();
      }, { passive: false });
      // no context menu or callout on a site that is being held to drag
      ctx.listen(boxes, "contextmenu", (e) => { if (drag?.touch && e.target?.closest?.(".prx-rb-site")) e.preventDefault(); });
      ctx.listen(ctx.win, "pointerup", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        const box = d.active ? boxAt(e.clientX, e.clientY) : null;
        endDrag();
        if (!d.active) return; // a press without movement is a click (pick-up)
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
      // a pick-up ends when the reader goes elsewhere: a press outside the boxes, focus on another site or out of the
      // boxes, or Escape anywhere in the widget
      ctx.listen(ctx.doc, "pointerdown", (e) => { if (picked && !boxes.contains(e.target)) cancelPick(true); });
      ctx.listen(boxes, "focusin", (e) => {
        const id = e.target?.getAttribute?.("data-prx-site");
        if (picked && id && current.ids.indexOf(id) !== picked.i) cancelPick(true);
      });
      ctx.listen(boxes, "focusout", (e) => { if (picked && e.relatedTarget && !boxes.contains(e.relatedTarget)) cancelPick(true); });
      ctx.listen(ctx.root, "keydown", (e) => { if (picked && e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); cancelPick(true); } });

      // ------------------------------------------------------------------------------------------- matrix

      function drawMatrix(rep, rel) {
        drawRelationMatrix(ctx, matrixSlot, matrixLegend, rep, { rel, changed, hatchId });
      }

      // ------------------------------------------------------------------------------------------- counts

      function tile(name, value) {
        return h("div", { class: "prx-rb-tile" }, h("span", { class: "prx-rb-tile-name", text: name }), h("span", { class: "prx-rb-tile-value" }, ...value));
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
        rule.replaceChildren(`${T.ruleLead} `, h("span", { class: "prx-rb-eq" }, ro("rule-M", d.M, formatCount(d.M)), " − ",
          ro("rule-inside", withheld, formatCount(withheld)), " = ", ro("rule-N", d.N, formatCount(d.N)), "."));
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
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: T.colGrade }), h("th", { scope: "col", text: T.colSites }), h("th", { scope: "col", text: T.colInside }))),
          h("tbody", {}, ...rows)));
        vectorLine.replaceChildren(`${T.vectorLead} `, ro("grades", rep.g.slice(), formatGrades(rep.g)), ` ${T.vectorOrder} (`,
          h("span", { "data-prx-name": "", text: `${rep.ids[0]} to ${rep.ids.at(-1)}` }), "); ",
          ro("sizes", d.sizes.slice(), formatSizes(d.sizes)), `; ${T.blocksLead} `, ...blocksNodes(rep.g, rep.ids), ".");
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

      /** The one-line result under the boxes (review 044 repair, G1-F2 in X-16): N of M pairs stated (with the change
       *  the last move made, while its outlines show), the withheld pairs, the share stated and the number of grades,
       *  the tiles' numbers in words, each with data-num and its own hook. */
      function drawResult(rep, d) {
        const dN = changed && same(changed.after, rep.g) ? changed.dN : 0;
        const part = (...nodes) => h("span", { class: "prx-rb-result-part" }, ...nodes);
        // "9 of 15 pairs stated (+2), share .600; 6 withheld; 3 grades." (the share follows the stated pairs it is of)
        result.replaceChildren(
          part(ro("result-N", d.N, formatCount(d.N)), ` ${T.resultOf} `, ro("result-M", d.M, formatCount(d.M)), ` ${T.resultPairsStated}`,
            ...(dN ? [" (", ro("result-change", dN, formatSigned(dN, { digits: 0 })), ")"] : []), ","), " ",
          part(`${T.resultShare} `, ro("result-share", d.s, formatShare(d.s)), ";"), " ",
          part(ro("result-withheld", d.M - d.N, formatCount(d.M - d.N)), ` ${T.resultWithheld};`), " ",
          part(ro("result-G", d.G, formatCount(d.G)), ` ${d.G === 1 ? T.resultGrade : T.resultGrades}.`));
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

      return {
        render(state, info = {}) {
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
            // a redraw that changes no setting (a box opened, a resize, a theme or motion change) keeps the read-out
            // as it is, so the narration of the last move stays and nothing is announced again
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

export const REPORT_BUILDER_CSS = `
.prx-rb .prx-rb-heading {
  margin: 0 0 0.35rem;
  font-size: 0.95em;
  font-weight: 600;
  color: var(--prx-fg-heading);
}

.prx-rb .prx-rb-units {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
  margin: 0;
}

.prx-rb .prx-rb-units > legend {
  flex: 1 1 100%;
}

.prx-rb .prx-rb-units-hint {
  flex: 1 1 100%;
  margin: 0.15rem 0 0.5rem;
  text-align: left;
}

.prx-rb .prx-readout {
  margin: 0.5rem 0 0.75rem;
}

/* --- builder and matrix side by side --- */
.prx-rb .prx-rb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  min-width: 0;
}

.prx-rb .prx-rb-builder,
.prx-rb .prx-rb-matrix,
.prx-rb .prx-rb-counts {
  min-width: 0;
}

.prx-rb .prx-rb-orientation {
  margin: 0 0 0.35rem;
  font-size: 0.9em;
  font-weight: 600;
}

.prx-rb .prx-rb-hint,
.prx-rb .prx-rb-lock {
  margin: 0 0 0.5rem;
}

.prx-rb .prx-rb-boxes {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prx-rb .prx-rb-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.35rem 0.5rem;
  background: var(--prx-bg-raised);
  border: 1px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
}

.prx-rb .prx-rb-box.prx-rb-new {
  min-height: 2.2rem;
  background: transparent;
  border-style: dashed;
  color: var(--prx-fg-muted);
  font-size: 0.9em;
}

.prx-rb .prx-rb-box-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.35rem;
  min-width: 0;
  flex: 1 1 9rem;
}

.prx-rb .prx-rb-swatch {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  font-size: 0.85em;
  font-weight: 700;
  border: 1px solid var(--prx-plot-bg);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--prx-border-strong);
}

.prx-rb .prx-rb-box-name {
  font-weight: 600;
}

.prx-rb .prx-rb-tag,
.prx-rb .prx-rb-size,
.prx-rb .prx-rb-drop {
  color: var(--prx-fg-muted);
  font-size: 0.9em;
}

.prx-rb .prx-rb-new-mark {
  font-weight: 700;
}

.prx-rb .prx-rb-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

.prx-rb .prx-rb-site {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 0.6rem;
  font: inherit;
  font-weight: 700;
  color: var(--prx-fg);
  background: var(--prx-bg);
  border: 2px solid var(--prx-border-strong);
  border-radius: var(--prx-radius, 6px);
  cursor: grab;
  /* review 044 repair, G1-F3: a vertical swipe that starts on a site scrolls the page; a touch drag starts after a
     press-and-hold or a sideways move (report-builder's pointer code), so a scroll never edits the report */
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* a site held long enough to drag on a touch screen */
.prx-rb .prx-rb-site.prx-rb-held {
  outline: 2px dashed var(--prx-accent);
  outline-offset: 2px;
}

.prx-rb .prx-rb-site:hover {
  border-color: var(--prx-accent);
}

.prx-rb .prx-rb-site:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.prx-rb .prx-rb-site.prx-rb-picked {
  color: var(--prx-on-accent);
  background: var(--prx-accent);
  border-color: var(--prx-accent);
}

.prx-rb .prx-rb-site.prx-rb-dragging {
  position: relative;
  z-index: 2;
  cursor: grabbing;
  pointer-events: none;
  outline: 2px solid var(--prx-accent);
  outline-offset: 2px;
}

/* a picked site (or a drag) shows where it can go; the chosen box is outlined */
.prx-rb .prx-rb-armed,
.prx-rb .prx-rb-dragging-on .prx-rb-box {
  cursor: pointer;
}

.prx-rb .prx-rb-box.prx-rb-target,
.prx-rb .prx-rb-box.prx-rb-over {
  border: 2px solid var(--prx-accent);
  background: var(--prx-bg-sunken);
}

.prx-rb .prx-rb-box.prx-rb-new.prx-rb-target,
.prx-rb .prx-rb-box.prx-rb-new.prx-rb-over {
  border-style: solid;
  color: var(--prx-fg);
}

/* --- matrix and legend (on the plot panel) --- */
.prx-rb .prx-rb-matrix-chart {
  min-width: 0;
  max-width: 100%;
}

.prx-rb .prx-rb-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.35rem 0 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.85em;
  color: var(--prx-plot-fg);
  background: var(--prx-plot-bg);
  border-radius: var(--prx-radius, 6px);
}

.prx-rb .prx-rb-legend-title {
  flex: 1 1 100%;
  font-weight: 600;
}

.prx-rb .prx-rb-key {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.prx-rb .prx-rb-swatch-key {
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 1px solid var(--prx-cell-border);
}

.prx-rb .prx-rb-swatch-hatch {
  background: repeating-linear-gradient(45deg, var(--prx-hatch) 0 1px, var(--prx-rel-withheld) 1px 5px);
}

.prx-rb .prx-rb-swatch-dot {
  background: var(--prx-grade-1);
  border-radius: 50%;
}

.prx-rb .prx-rb-swatch-outline {
  background: var(--prx-plot-bg);
  border: 3px solid var(--prx-plot-fg);
}

.prx-rb .prx-rb-note {
  margin: 0.35rem 0 0;
  font-size: 0.9em;
  color: var(--prx-fg-muted);
}

/* --- counts --- */
.prx-rb .prx-rb-counts {
  margin: 1rem 0 0;
}

.prx-rb .prx-rb-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.5rem;
}

.prx-rb .prx-rb-tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  background: var(--prx-bg);
  border: 1px solid var(--prx-border);
  border-radius: var(--prx-radius, 6px);
}

.prx-rb .prx-rb-tile-name {
  font-size: 0.85em;
  color: var(--prx-fg-muted);
}

.prx-rb .prx-rb-tile-value {
  font-size: 1.15em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.prx-rb .prx-rb-rule,
.prx-rb .prx-rb-vector,
.prx-rb .prx-rb-tidy,
.prx-rb .prx-rb-side {
  margin: 0.6rem 0 0;
  font-size: 0.95em;
  overflow-wrap: anywhere;
}

.prx-rb .prx-rb-rule {
  font-weight: 600;
}

.prx-rb .prx-rb-eq {
  white-space: nowrap;
}

.prx-rb .prx-rb-inside {
  max-width: 100%;
  overflow-x: auto;
}

.prx-rb .prx-rb-table {
  margin: 0.5rem 0 0;
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}

.prx-rb .prx-rb-table caption {
  caption-side: top;
  padding: 0 0 0.25rem;
  text-align: left;
  white-space: nowrap;
  color: var(--prx-fg-muted);
}

.prx-rb .prx-rb-table th,
.prx-rb .prx-rb-table td {
  padding: 0.15rem 0.75rem 0.15rem 0;
  text-align: left;
  border-bottom: 1px solid var(--prx-border);
}

.prx-rb .prx-rb-table td {
  text-align: right;
}

.prx-rb .prx-rb-total th,
.prx-rb .prx-rb-total td {
  font-weight: 600;
  border-bottom: 0;
}

.prx-rb .prx-rb-side {
  color: var(--prx-fg-muted);
}

.prx-rb .prx-rb-side-now {
  font-weight: 700;
  color: var(--prx-fg);
}

@media (prefers-reduced-motion: no-preference) {
  .prx-rb[data-motion="full"] .prx-rb-box { transition: border-color 0.12s, background-color 0.12s; }
}
`;

// This app's own rules for its review 044 repair (G1-F2 in X-16, X-14): the short hint beside the closed "Keyboard and
// touch" box, and the one-line result under the boxes. Kept out of REPORT_BUILDER_CSS, which 2.3, 2.20, T.1 and T.2
// share, so their pages are unchanged.
const REPORT_BUILDER_APP_CSS = `
.prx-rb .prx-rb-hint-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin: 0 0 0.5rem;
}

.prx-rb .prx-rb-hint-row > .prx-rb-hint-short {
  margin: 0;
}

.prx-rb .prx-rb-hint-row > .prx-rb-keys {
  flex: 0 1 auto;
  padding: 0 0.6rem;
}

.prx-rb .prx-rb-hint-row > .prx-rb-keys > summary {
  padding: 0.3rem 0;
  font-size: 0.9em;
}

.prx-rb .prx-rb-hint-row > .prx-rb-keys[open] {
  flex-basis: 100%;
}

.prx-rb .prx-rb-keys .prx-rb-hint,
.prx-rb .prx-rb-keys .prx-rb-touch-hint {
  margin: 0 0 0.4rem;
}

.prx-rb .prx-rb-result {
  margin: 0.5rem 0 0;
  padding: 0.35rem 0.6rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--prx-bg);
  border-left: 3px solid var(--prx-accent);
  border-radius: 4px;
}

.prx-rb .prx-rb-result-part {
  white-space: nowrap;
}
`;
