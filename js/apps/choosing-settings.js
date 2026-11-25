// Settings change the loss or the feasible family. All results use public engine calls or fixed archives.
import { createWidget } from "../shared/base.js";
import { numText, placeDirectLabels, plot } from "../shared/chart.js";
import {
  formatCount,
  formatDecimal,
  formatExpectedCount,
  formatGrades,
  formatReadoutRisk,
  formatRisk,
  formatSci,
  formatSetting,
  formatShare,
  tickLabel,
} from "../shared/format.js";
import { labelNode, tagNode } from "../shared/labels.js";
import { compareReports, evaluateReport, exactOptimum, tauPath } from "../pr-core.js";
import { criteriaData } from "../shared/criteria-data.js";
import { archivedThirtyPath, tutorialSensitivityArchive } from "../shared/criteria-archive.js";
import { twoScoreFamily, TWO_SCORES_CSS } from "../shared/domain/two-scores.js";
import { WEIGHT_PATH_CSS } from "../shared/domain/weight-path.js";
import {
  GUARDED_CRITERION_CSS,
  solveGuardedCriteria,
  createGuardedComparisonSlots,
  createGuardedComparisonView,
} from "../shared/domain/worst-criterion.js";
import {
  CRITERIA_PROFILE_CSS,
  criterionProfileModel,
  createCriterionProfileSlots,
  createCriterionProfileView,
} from "../shared/domain/several-criteria.js";

export const SETTINGS_GRID = Object.freeze({
  taus: [0.2, 0.35],
  caps: [1, 2, 3, 6],
  weights: [
    [0.5, 0.5],
    [0, 1],
    [1, 0],
  ],
  referenceId: "tau1-cap3-w1",
});

const data = criteriaData("six");
const E = data.E;
const pathCache = new Map();
let gridCache = null;

/** Actual Cartesian product, each fixed reference evaluated under that row's own loss. */
export function settingsGridModel() {
  if (gridCache) return gridCache;
  const rows = [];
  SETTINGS_GRID.taus.forEach((tau, ti) =>
    SETTINGS_GRID.caps.forEach((cap, ci) =>
      SETTINGS_GRID.weights.forEach((w, wi) => {
        const result = exactOptimum(E, { tau, w, family: { kind: "atMost", G: cap } });
        rows.push({
          id: `tau${ti + 1}-cap${ci + 1}-w${wi + 1}`,
          tau,
          cap,
          w,
          grade: result.grade,
          grades: result.grades,
          tieCount: result.tieCount,
          evaluation: result.evaluation,
          result,
        });
      }),
    ),
  );
  const r = rows.find((row) => row.id === SETTINGS_GRID.referenceId);
  const reference = { id: r.id, grade: r.grade, tau: r.tau, cap: r.cap, w: r.w };
  gridCache = {
    reference,
    rows: rows.map((row) => ({
      ...row,
      comparison: compareReports(reference.grade, row.grade, E, { tau: row.tau, w: row.w }),
    })),
  };
  return gridCache;
}

export function settingsPathModel(state) {
  const family = twoScoreFamily(state.cap);
  const w = [state.w, 1 - state.w];
  const key = JSON.stringify([family, w]);
  if (!pathCache.has(key)) {
    const path = tauPath(E, { family, w });
    const boundaries = [...new Set(path.intervals.flatMap((iv) => [iv.tauFrom, iv.tauTo]))].filter((t) => t > 0);
    pathCache.set(key, {
      path,
      boundaries: boundaries.map((tau) => ({ tau, result: exactOptimum(E, { family, w, tau }) })),
    });
    if (pathCache.size > 40) pathCache.delete(pathCache.keys().next().value);
  }
  const cached = pathCache.get(key);
  const result = exactOptimum(E, { family, w, tau: state.tau });
  return {
    ...cached,
    data,
    E,
    family,
    w,
    result,
    profiles: result.grades.map((grade) => ({ grade, evaluation: evaluateReport(grade, E, { tau: state.tau, w }) })),
    caps: SETTINGS_GRID.caps.map((cap) => ({
      cap,
      result: exactOptimum(E, { family: { kind: "atMost", G: cap }, w, tau: state.tau }),
    })),
  };
}

const CSS = `
.setg.prx-widget[data-prx-frame="v2"] > .prx-readout { background: var(--prx-bg); color: var(--prx-fg); }
.setg.prx-widget[data-prx-frame="v2"] .prx-toolbar { gap: 0.4rem 0.65rem; margin-bottom: 0.4rem; }
.setg.prx-widget[data-prx-frame="v2"] .prx-controls .prx-slider { flex: 1 1 9.5rem; max-width: 13rem; }
.setg.prx-widget[data-prx-frame="v2"] .prx-stage > div,
.setg.prx-widget[data-prx-frame="v2"] .prx-stage > section { grid-area: auto; margin: 0; min-width: 0; max-width: 100%; }
.setg .setg-controls { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.setg section { min-width: 0; margin: 0.85rem 0; }
.setg .prx-disclosure-body > div > section:first-child,
.setg .prx-disclosure-body > section:first-child { margin-top: 0.15rem; }
.setg .setg-scroll { overflow-x: auto; max-width: 100%; min-width: 0; }
.setg .setg-table { border-collapse: collapse; width: 100%; font-size: 0.84rem; }
.setg .setg-table th, .setg .setg-table td { white-space: nowrap; padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--prx-border); text-align: left; }
.setg .setg-note { font-size: 0.88rem; color: var(--prx-fg-muted); margin: 0.4rem 0; }
.setg .setg-paper { background: var(--prx-plot-bg); color: var(--prx-plot-fg); padding: 0.5rem; border-radius: 4px; }
.setg .setg-paper .setg-note { color: var(--prx-plot-muted); }
.setg .setg-table button { font-size: 0.8rem; }
.setg .setg-table caption { white-space: normal; text-align: left; }
.setg [hidden] { display: none !important; }
.setg .setg-cap-table th, .setg .setg-cap-table td { padding: 0.3rem 0.45rem; white-space: normal; overflow-wrap: normal; }
.setg .setg-cap-table tr[aria-current="true"] > * { background: var(--prx-bg-sunken); font-weight: 700; }
.setg .setg-cap-table tr[aria-current="true"] > th { border-inline-start: 3px solid var(--prx-accent); }
.setg .setg-cap-table td:nth-child(-n+3) { white-space: nowrap; }
`;

function localTextCoords(tNode, values, idx, dims) {
  const tr = tNode.getAttribute("transform") || "";
  const m = /translate\(\s*([-\d.eE+]+)(?:[,\s]+([-\d.eE+]+))?\s*\)/.exec(tr);
  const x = m
    ? Number(m[1])
    : tNode.hasAttribute("x")
      ? Number(tNode.getAttribute("x"))
      : values.x
        ? values.x[idx]
        : dims.width / 2;
  const rawY = tNode.getAttribute("y") || "";
  const y = m
    ? Number(m[2] ?? 0)
    : rawY && !rawY.endsWith("em")
      ? Number(rawY)
      : values.y
        ? values.y[idx]
        : dims.marginTop;
  return { x, y };
}

function pillLabelsMark(items, { value, format, c }) {
  if (!items.length) return null;
  return numText(items, {
    x: "xData",
    y: "yData",
    value,
    format,
    textAnchor: "middle",
    fontSize: 13,
    fontWeight: (d) => (d.bold ? 700 : 600),
    fill: c.plotFg,
    render(index, scales, values, dims, context, next) {
      const g = next(index, scales, values, dims, context);
      const doc = context.document;
      const texts = [...(g?.querySelectorAll("text") ?? [])];
      Array.from(index).forEach((idx, j) => {
        const tNode = texts[j];
        const d = items[idx];
        if (!tNode || !d) return;
        const pos = localTextCoords(tNode, values, idx, dims);
        const ph = 18;
        const pw = d.pillW;
        if (Math.hypot(pos.x - d.anchorPx, pos.y - d.rawPy) > 15) {
          const line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(d.anchorPx));
          line.setAttribute("y1", String(d.rawPy));
          line.setAttribute("x2", String(pos.x));
          line.setAttribute("y2", String(pos.y));
          line.setAttribute("stroke", c.plotMuted);
          line.setAttribute("stroke-width", "1");
          line.setAttribute("stroke-dasharray", "2,2");
          g.insertBefore(line, tNode);
        }
        const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(pos.x - pw / 2));
        rect.setAttribute("y", String(pos.y - ph / 2));
        rect.setAttribute("width", String(pw));
        rect.setAttribute("height", String(ph));
        rect.setAttribute("rx", "3");
        rect.setAttribute("fill", c.plotBg);
        rect.setAttribute("stroke", d.active ? c.plotFg : c.cellBorder);
        rect.setAttribute("stroke-width", d.active ? "1.4" : "0.9");
        g.insertBefore(rect, tNode);
      });
      return g;
    },
  });
}

function archiveHiddenTable(rows) {
  const keys = Object.keys(rows[0] ?? {});
  return {
    caption: "Complete figure data",
    rows,
    columns: keys.map((key) => {
      const numeric = rows.every((r) => r[key] === null || typeof r[key] === "number");
      return {
        label: key,
        value: key,
        num: numeric,
        name: !numeric,
        format: numeric
          ? (v) => {
              if (v === null || v === undefined || !Number.isFinite(v)) return "NA";
              if (v === 0) return "0";
              if (key === "risk_absolute_gap" && Math.abs(v) < 1e-4) return formatSci(v, { sig: 3 });
              const t = tickLabel(v);
              return /^[−-]?(?:0+(?:\.0+)?|\.0+)$/.test(t) ? formatSci(v, { sig: 3 }) : t;
            }
          : undefined,
      };
    }),
  };
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "choosing-settings",
    className: "setg sev tws wcr wpath",
    css: CSS + TWO_SCORES_CSS + WEIGHT_PATH_CSS + GUARDED_CRITERION_CSS + CRITERIA_PROFILE_CSS,
    frame: "v2",
    keys: {
      source: { type: "choice", values: ["live", "archive30", "tutorial"], value: "live" },
      tau: { type: "number", min: 0.000001, max: 0.5, step: 0.001, value: 0.2 },
      w: { type: "number", min: 0, max: 1, step: 0.01, value: 0.5 },
      cap: { type: "choice", values: ["1", "2", "3", "all"], value: "3" },
      pair: {
        type: "choice",
        values: data.ids.flatMap((a) => data.ids.filter((b) => b !== a).map((b) => `${a},${b}`)),
        value: "B,C",
      },
      unit: { type: "choice", values: data.ids, value: "B" },
    },
    build(ctx) {
      const h = ctx.h;
      const n = (key, value, fn = formatCount) => {
        const node = ctx.num(value, fn(value));
        node.dataset.prxReadout = key;
        return node;
      };
      const source = ctx.select({
        label: "Analysis route",
        options: [
          { value: "live", label: "Six sites: live settings and full grid" },
          { value: "archive30", label: "Thirty sites: sparse archived path" },
          { value: "tutorial", label: "Tutorial: archived one-at-a-time settings" },
        ],
        value: "live",
        onChange: (v) => ctx.set({ source: v }),
      });
      const tau = ctx.slider({
        label: "Withholding cost τ",
        ...ctx.key("tau"),
        stepOrigin: 0,
        name: "tau",
        onInput: (v) => ctx.set({ tau: v }),
      });
      const w = ctx.slider({
        label: "Weight w on score A",
        ...ctx.key("w"),
        name: "w",
        onInput: (v) => ctx.set({ w: v }),
      });
      const cap = ctx.segmented({
        label: "Maximum grades",
        name: "cap",
        options: [
          ...["One", "Two", "Three"].map((title, i) => ({
            value: String(i + 1),
            title,
            label: ctx.num(i + 1, formatCount(i + 1)),
          })),
          { value: "all", label: "No cap" },
        ],
        value: "3",
        onChange: (v) => ctx.set({ cap: v }),
      });
      const pair = ctx.select({
        label: "Pair in the linked profiles",
        options: data.ids.flatMap((a) =>
          data.ids.filter((b) => b !== a).map((b) => ({ value: `${a},${b}`, label: `${a} above ${b}` })),
        ),
        value: "B,C",
        onChange: (v) => ctx.set({ pair: v }),
      });
      const unit = ctx.select({
        label: "Follow a unit",
        options: data.ids.map((value) => ({ value, label: value })),
        value: "B",
        onChange: (v) => ctx.set({ unit: v }),
      });
      tau.input.step = "any";
      w.input.step = "any";

      ctx.controls.append(tau.root, w.root);
      ctx.primaryControl(tau.root);

      const settings = ctx.settingsBox("Settings");
      settings.body.append(source.root, cap.root, pair.root, unit.root);

      // Primary stage: live τ disclosure step chart or archived route comparison graphic
      const counts = h("div", { tabindex: "-1", "aria-label": "Exact best-report disclosure along τ" });
      const liveStage = h("section", {}, ctx.panelTitle("Exact best-report disclosure along τ"), counts);
      const archiveStage = h("div");
      ctx.stage.append(liveStage, archiveStage);

      // Data & Method disclosures (3 standard v2 disclosures total: settings, data, method)
      const dataBox = ctx.dataBox("Data, cap table and settings grid");
      const methodBox = ctx.methodBox("Method and scope");

      const panel = (parent, title) => {
        const slot = h("div");
        parent.append(h("section", {}, ctx.panelTitle(title), slot));
        return slot;
      };

      const liveData = h("div");
      const activeSettingNote = h("p", { class: "setg-note" });
      liveStage.append(activeSettingNote);
      const capTable = panel(liveData, "Changing only the cap");
      const shares = h("div");
      liveData.append(h("section", {}, ctx.panelTitle("Each criterion’s wrong share along the same path"), shares));
      const tieNote = h("p", { class: "setg-note" });
      const pathSection = h("section", {}, ctx.panelTitle("Reports on every exact interval and boundary"), tieNote);
      const pathTable = h("div");
      pathSection.append(pathTable);
      liveData.append(pathSection);
      const grid = panel(liveData, "Every combination of the declared settings");
      const guardedHost = h("div");
      liveData.append(guardedHost);
      const guardedSlots = createGuardedComparisonSlots(ctx, guardedHost);
      const guardedView = createGuardedComparisonView(ctx, guardedSlots, { resultFirst: true });
      const profiles = panel(liveData, "The same supplied criterion profiles");
      profiles.append(
        h(
          "p",
          { class: "setg-note" },
          "These controls follow units and proposed directions in the supplied profiles; they keep the reporting loss and chosen reports fixed.",
        ),
      );
      const profileSlots = createCriterionProfileSlots(ctx, profiles);
      const profileView = createCriterionProfileView(ctx, profileSlots, { crossingHeadroom: true });

      const archiveData = h("div");
      dataBox.body.append(liveData, archiveData);

      const liveMethod = h("div");
      const settingsNote = panel(liveMethod, "Explaining the settings");
      const archiveMethod = h("div");
      methodBox.body.append(liveMethod, archiveMethod);

      let focusPathAfterApply = false;
      let profileKey = "";

      const hint = () =>
        h("p", { class: "setg-note", text: "Swipe wide tables horizontally, or Tab into their region and use the arrow keys." });
      const table = (title, headers, rows, { sticky = false, selected = -1, className = "" } = {}) =>
        ctx.scrollRegion(
          h(
            "div",
            { class: "setg-scroll" },
            h(
              "table",
              { class: `setg-table ${sticky ? "prx-sticky-first" : ""} ${className}` },
              h("caption", { text: title }),
              h("thead", {}, h("tr", {}, ...headers.map((text) => h("th", { scope: "col", text })))),
              h(
                "tbody",
                {},
                ...rows.map((row, j) =>
                  h(
                    "tr",
                    { "aria-current": j === selected ? "true" : null },
                    ...row.map((v, i) => h(i === 0 ? "th" : "td", i === 0 ? { scope: "row" } : {}, v)),
                  ),
                ),
              ),
            ),
          ),
          title,
        );
      const name = (text) => h("span", { "data-prx-name": "", text });

      function drawPathStage(s, m) {
        const rows = m.path.intervals.map((iv, i) => ({ ...iv, i, from: iv.tauFrom, to: iv.tauTo }));
        const points = rows.flatMap((r) => [
          { ...r, tau: r.from },
          { ...r, tau: r.to },
        ]);
        const currentCounts = [...new Set(m.profiles.map((r) => r.evaluation.N))];

        const measured = Math.round(counts.clientWidth || ctx.stage.clientWidth || 0);
        const width = Math.max(260, measured > 0 ? measured : ctx.width() - 28);
        const height = width < 480 ? 296 : 332;
        const marginLeft = 44;
        const marginRight = 20;
        const marginTop = 22;
        const marginBottom = 42;
        const x0 = marginLeft;
        const x1 = width - marginRight;
        const yTop = marginTop;
        const yBot = height - marginBottom;
        const xPx = (t) => x0 + (t / 0.5) * (x1 - x0);
        const yPx = (N) => yBot - (N / data.M) * (yBot - yTop);
        const fromPx = (px) => ((px - x0) / (x1 - x0)) * 0.5;
        const fromPy = (py) => ((yBot - py) / (yBot - yTop)) * data.M;

        const rawItems = [
          ...rows.map((r) => {
            const labelStr = formatGrades(r.grade);
            const pillW = Math.ceil(labelStr.length * 7.2 + 12);
            const midT = r.from === 0 && r.to < 0.03 ? 0 : (r.from + r.to) / 2;
            const anchorPx = xPx(midT) - (width < 420 && r.from > 0 && r.to < 0.22 ? 8 : 0);
            const minLeft = (width < 420 ? Math.max(8, x0 - 6) : x0 + 3) + pillW / 2;
            const centerPx = Math.min(x1 - pillW / 2 - 3, Math.max(minLeft, anchorPx));
            const rawPy = yPx(r.N);
            const active =
              s.tau >= r.from - m.path.tieTol &&
              s.tau <= r.to + m.path.tieTol &&
              m.profiles.some((p) => p.grade.every((v, k) => v === r.grade[k]));
            return {
              id: `iv-${r.i}`,
              kind: "grade",
              rawValue: r.grade,
              pillW,
              anchorPx,
              centerPx,
              rawPy,
              y: rawPy - 14,
              active,
              bold: active,
            };
          }),
          ...currentCounts.map((v) => {
            const labelStr = formatCount(v);
            const pillW = Math.ceil(labelStr.length * 8 + 12);
            const anchorPx = xPx(s.tau);
            const rawPy = yPx(v);
            const shift = s.tau > 0.34 ? -(pillW / 2 + 8) : pillW / 2 + 8;
            const centerPx = Math.min(x1 - pillW / 2 - 3, Math.max(x0 + pillW / 2 + 3, anchorPx + shift));
            return {
              id: `cur-${v}`,
              kind: "count",
              rawValue: v,
              pillW,
              anchorPx,
              centerPx,
              rawPy,
              y: v === 0 ? rawPy - 34 : rawPy + 16,
              active: true,
              bold: true,
            };
          }),
        ];

        const placed = placeDirectLabels(rawItems, {
          minGapPx: 21,
          minY: yTop + 11,
          maxY: yBot - 11,
        });
        const placedById = new Map(placed.map((p) => [p.id, p]));
        const resolved = rawItems.map((it) => {
          const p = placedById.get(it.id) ?? it;
          return {
            ...it,
            xData: fromPx(it.centerPx),
            yData: fromPy(p.y),
          };
        });
        const gradePills = resolved.filter((d) => d.kind === "grade");
        const countPills = resolved.filter((d) => d.kind === "count");

        plot(counts, {
          width,
          height,
          marginLeft,
          marginRight,
          marginBottom,
          marginTop,
          x: { domain: [0, 0.5], ticks: width < 520 ? [0, 0.1, 0.2, 0.3, 0.4, 0.5] : undefined, label: "Withholding cost τ", grid: true },
          y: { domain: [0, data.M], label: "Stated pairs N", grid: true },
          alt: "Exact best-report disclosure for fixed law, weights and family. Horizontal segments retain every returned interval, including zero-length endpoint reports. Grade vectors label the segments; full boundary alternatives follow in the table.",
          table: rows,
          keyboard: {
            data: rows,
            x: (r) => (r.from + r.to) / 2,
            y: "N",
            title: (r) =>
              `${formatGrades(r.grade)}: ${formatCount(r.N)} stated pairs for τ ${formatDecimal(r.from, { digits: 8 })} to ${formatDecimal(r.to, { digits: 8 })}.`,
          },
          marks: (c, P) =>
            [
              P.line(points, { x: "tau", y: "N", stroke: c.plotFg, strokeWidth: 2.2 }),
              P.ruleX([s.tau], { stroke: c.plotMuted, strokeDasharray: "5 3" }),
              P.dot(m.profiles, { x: () => s.tau, y: (r) => r.evaluation.N, fill: c.plotFg, stroke: c.plotBg, strokeWidth: 1.5, r: 4.5 }),
              pillLabelsMark(gradePills, { value: "rawValue", format: (v) => formatGrades(v), c }),
              pillLabelsMark(countPills, { value: "rawValue", format: formatCount, c }),
            ].filter(Boolean),
        });
      }

      function drawShares(s, m) {
        const rows = m.path.intervals.map((iv, i) => ({ ...iv, i, from: iv.tauFrom, to: iv.tauTo }));
        const per = rows.flatMap((r) => [0, 1].map((k) => ({ ...r, k, share: r.EoverN[k] }))).filter((r) => r.share !== null);
        const measured = Math.round(shares.clientWidth || 0);
        const width = measured > 0 ? Math.max(240, measured) : undefined;
        plot(shares, {
          ...(width ? { width } : {}),
          height: 308,
          marginLeft: 48,
          marginRight: 20,
          marginBottom: 42,
          marginTop: 32,
          x: { domain: [0, 0.5], ticks: width && width < 520 ? [0, 0.1, 0.2, 0.3, 0.4, 0.5] : undefined, label: "Withholding cost τ", grid: true },
          y: { domain: [0, 1], label: "Expected wrong share Eₖ/N", grid: true },
          alt: "Criterion-specific expected wrong shares on each exact best-report interval. Solid lines are score A, dashed score B. Missing shares at all-withheld reports have no denominator. Shares need not increase with the price.",
          table: per,
          keyboard: {
            data: per,
            x: (r) => (r.from + r.to) / 2,
            y: "share",
            title: (r) =>
              `${r.k === 0 ? "Score A" : "Score B"}, report ${formatGrades(r.grade)}, τ ${formatDecimal(r.from, { digits: 8 })} to ${formatDecimal(r.to, { digits: 8 })}: wrong share ${formatShare(r.share)}.`,
          },
          marks: (c, P) => [
            ...per.map((r) =>
              P.link([r], {
                x1: "from",
                x2: "to",
                y1: "share",
                y2: "share",
                stroke: c.crit[r.k],
                strokeWidth: 3,
                strokeDasharray: r.k ? "6 3" : undefined,
              }),
            ),
            P.ruleX([s.tau], { stroke: c.plotMuted, strokeDasharray: "5 3" }),
          ],
        });
        if (!shares.nextElementSibling?.classList.contains("setg-legend")) {
          shares.after(
            h(
              "p",
              { class: "setg-note setg-paper setg-legend" },
              "Solid: score A. Dashed: score B. E counts expected wrong stated directions; N counts stated pairs; M counts all pairs. Eₖ/N has no denominator at N = ",
              ctx.num(0, "0"),
              ".",
            ),
          );
        }
      }

      function drawLiveTables(s, m) {
        const rows = m.path.intervals.map((iv, i) => ({ ...iv, i, from: iv.tauFrom, to: iv.tauTo }));
        activeSettingNote.replaceChildren(
          "Active settings: τ = ",
          n("active-tau", s.tau, formatSetting),
          ", weights ",
          ctx.num(m.w[0], formatSetting(m.w[0])),
          "/",
          ctx.num(m.w[1], formatSetting(m.w[1])),
          ...(s.cap === "all"
            ? [", no grade cap."]
            : [", at most ", ctx.num(Number(s.cap), formatCount(Number(s.cap))), " grades."]),
        );
        const capIndex = m.caps.findIndex(row => row.cap === (s.cap === "all" ? data.ids.length : Number(s.cap)));
        const neighbor = m.caps[capIndex + 1] ?? m.caps[capIndex - 1];
        if (neighbor) activeSettingNote.append(" With the neighboring cap of ", ctx.num(neighbor.cap, formatCount(neighbor.cap)),
          " grades, the first optimum is ", ctx.num(neighbor.result.grade, formatGrades(neighbor.result.grade)),
          " with risk ", ctx.num(neighbor.result.risk, formatRisk(neighbor.result.risk)), ".");
        tieNote.replaceChildren(
          n("current-ties", m.result.tieCount),
          m.result.tieCount === 1
            ? " report reaches the smallest risk within tolerance "
            : " reports share the smallest risk within tolerance ",
          n("current-tol", m.result.tieTol, formatSci),
          "; all retained alternatives appear below.",
        );
        pathTable.replaceChildren(
          h(
            "p",
            { class: "setg-note" },
            tagNode(ctx, m.path),
            ". The law, weights and family stay fixed along this path. N cannot fall as τ rises; a criterion’s wrong share can fall. Risks at different τ measure different losses.",
          ),
          hint(),
          table(
            "Every exact τ interval",
            ["From τ", "To τ", "Grade vector", "N", "Weighted E", "Weighted E/N", "Score A E/N", "Score B E/N"],
            rows.map((r) => [
              n(`path-${r.i}-from`, r.from, (v) => formatDecimal(v, { digits: 8 })),
              n(`path-${r.i}-to`, r.to, (v) => formatDecimal(v, { digits: 8 })),
              n(`path-${r.i}-grade`, r.grade, formatGrades),
              n(`path-${r.i}-N`, r.N),
              n(`path-${r.i}-Ew`, r.Ew, formatExpectedCount),
              n(`path-${r.i}-weightedShare`, r.EwOverN, formatShare),
              ...r.EoverN.map((v, k) => n(`path-${r.i}-share-${k}`, v, formatShare)),
            ]),
          ),
          table(
            "At every boundary, solve for all returned equal-risk reports",
            ["τ", "Report", "N", "Risk", "Score A E/N", "Score B E/N", "Tie count", "Tolerance"],
            m.boundaries.flatMap((b, i) =>
              b.result.grades.map((g, j) => {
                const ev = evaluateReport(g, E, { tau: b.tau, w: m.w });
                return [
                  n(`boundary-${i}-${j}-tau`, b.tau, (v) => formatDecimal(v, { digits: 8 })),
                  n(`boundary-${i}-${j}-grade`, g, formatGrades),
                  n(`boundary-${i}-${j}-N`, ev.N),
                  n(`boundary-${i}-${j}-risk`, ev.risk, formatRisk),
                  ...ev.EoverN.map((v, k) => n(`boundary-${i}-${j}-share-${k}`, v, formatShare)),
                  n(`boundary-${i}-${j}-ties`, b.result.tieCount),
                  n(`boundary-${i}-${j}-tol`, b.result.tieTol, formatSci),
                ];
              }),
            ),
          ),
        );

        capTable.replaceChildren(
          table(
            "Only the cap changes",
            ["Cap", "Risk at current loss", "N", "First report", "Family size", "Tied best reports"],
            m.caps.map((r, i) => [
              r.cap === data.ids.length ? "No cap" : n(`cap-${i}`, r.cap),
              n(`cap-${i}-risk`, r.result.risk, formatRisk),
              n(`cap-${i}-N`, r.result.N),
              n(`cap-${i}-grade`, r.result.grade, formatGrades),
              n(`cap-${i}-size`, r.result.family.size),
              n(`cap-${i}-ties`, r.result.tieCount),
            ]),
            {
              sticky: true,
              selected: m.caps.findIndex((r) => r.cap === (s.cap === "all" ? data.ids.length : Number(s.cap))),
              className: "setg-cap-table",
            },
          ),
          h(
            "p",
            { class: "setg-note" },
            "Here the law, τ and weights stay fixed. Expanding these nested families cannot raise the smallest full reporting risk. It need not increase disclosure.",
          ),
          hint(),
        );

        if (!grid.childNodes.length) {
          const model = settingsGridModel();
          const ref = model.reference;
          grid.replaceChildren(
            h(
              "p",
              {},
              "Full Cartesian product: ",
              ctx.num(SETTINGS_GRID.taus.length, formatCount(SETTINGS_GRID.taus.length)),
              " prices × ",
              ctx.num(SETTINGS_GRID.caps.length, formatCount(SETTINGS_GRID.caps.length)),
              " caps × ",
              ctx.num(SETTINGS_GRID.weights.length, formatCount(SETTINGS_GRID.weights.length)),
              " weights. Fixed reference ",
              name(ref.id),
              ": ",
              n("grid-reference", ref.grade, formatGrades),
              ".",
            ),
            h(
              "p",
              { class: "setg-note" },
              "Each change compares two fixed grade vectors under that row’s law, price and weights. The reference may be outside that row’s capped family. Risk differences across rows do not select a best price or weight. Select a row to apply its settings.",
            ),
            hint(),
            table(
              "Every declared setting and its relation changes against the named reference",
              [
                "Setting",
                "Apply",
                "τ",
                "Cap",
                "Weight A",
                "Best report",
                "Tie count",
                "Risk",
                "N",
                "New stated",
                "New withheld",
                "Reversed",
                "Risk change from fixed reference",
              ],
              model.rows.map((r, i) => {
                const btn = h("button", { type: "button", class: "prx-btn", text: "Use settings" });
                ctx.listen(btn, "click", () => {
                  const next = {
                    source: "live",
                    tau: r.tau,
                    cap: r.cap === data.ids.length ? "all" : String(r.cap),
                    w: r.w[0],
                  };
                  if (Object.entries(next).every(([key, value]) => ctx.state[key] === value)) {
                    counts.focus();
                    return;
                  }
                  focusPathAfterApply = true;
                  ctx.set(next);
                });
                return [
                  name(r.id),
                  btn,
                  n(`grid-${i}-tau`, r.tau, formatSetting),
                  r.cap === 6 ? "No cap" : n(`grid-${i}-cap`, r.cap),
                  n(`grid-${i}-weight`, r.w[0], formatSetting),
                  n(`grid-${i}-grade`, r.grade, formatGrades),
                  n(`grid-${i}-ties`, r.tieCount),
                  n(`grid-${i}-risk`, r.evaluation.risk, formatRisk),
                  n(`grid-${i}-N`, r.evaluation.N),
                  n(`grid-${i}-new`, r.comparison.change.nNewDisclosed),
                  n(`grid-${i}-withheld`, r.comparison.change.nNewWithheld),
                  n(`grid-${i}-reversed`, r.comparison.change.nReversed),
                  n(`grid-${i}-delta`, r.comparison.deltaRisk, formatRisk),
                ];
              }),
              { sticky: true },
            ),
            table(
              "All retained tied grid optima, with each report’s own denominator",
              ["Setting", "Report", "N", "Risk", "Score A E/N", "Score B E/N"],
              model.rows.flatMap((r, i) =>
                r.grades.map((g, j) => {
                  const ev = evaluateReport(g, E, { tau: r.tau, w: r.w });
                  return [
                    name(r.id),
                    n(`grid-tie-${i}-${j}-grade`, g, formatGrades),
                    n(`grid-tie-${i}-${j}-N`, ev.N),
                    n(`grid-tie-${i}-${j}-risk`, ev.risk, formatRisk),
                    ...ev.EoverN.map((v, k) => n(`grid-tie-${i}-${j}-share-${k}`, v, formatShare)),
                  ];
                }),
              ),
            ),
          );
        }

        settingsNote.replaceChildren(
          h(
            "p",
            {},
            "Withholding costs ",
            n("settings-tau", s.tau, formatSetting),
            " of a wrong direction per pair. The cap permits ",
            s.cap === "all" ? "all grade counts" : ["at most ", ctx.num(Number(s.cap), formatCount(Number(s.cap))), " grades"],
            ". Error weights are ",
            ctx.num(m.w, formatSetting(m.w)),
            ". These are explicit reporting choices for the intended audience, not confidence levels estimated from the data.",
          ),
          h(
            "p",
            { class: "setg-note" },
            "Choose the substantive target, the relative cost of silence, the acceptable grade complexity and the relative importance of criterion errors before interpreting the selected report. The isolated-pair probability rule does not independently decide a coherent full report.",
          ),
        );
      }

      function setLiveReadoutAndCaption(s, m) {
        const p = m.profiles[0];
        const uncapped = m.caps.at(-1).result;
        const alsoUncapped = uncapped.grades.some((g) => g.every((v, i) => v === p.grade[i]));
        (ctx.toolbar ?? ctx.controls).after(ctx.readout.node);
        ctx.readout.set([
          m.result.tieCount > 1 ? "One best report " : "Best report ",
          n("active-grade", p.grade, formatGrades),
          " states ",
          n("current-N", p.evaluation.N),
          " of ",
          n("current-M", p.evaluation.M),
          " pairs (risk ",
          n("active-risk", p.evaluation.risk, formatReadoutRisk),
          "; wrong shares ",
          n("current-share-0", p.evaluation.EoverN[0], formatShare),
          " on A, ",
          n("current-share-1", p.evaluation.EoverN[1], formatShare),
          " on B).",
          ...(s.cap === "all"
            ? []
            : alsoUncapped
              ? [" Uncapped optimum matches."]
              : [" Uncapped minimum risk: ", n("uncapped-risk", uncapped.risk, formatReadoutRisk), "."]),
        ]);
        ctx.caption.replaceChildren(
          "Six fictional sites; independent Normal posteriors supplied by the tutorial; ",
          tagNode(ctx, m.result),
          ". Changing the cap changes the family; changing τ or error weights changes the loss.",
        );
      }

      function drawArchive(s) {
        archiveStage.replaceChildren();
        archiveData.replaceChildren();
        archiveMethod.replaceChildren();

        if (s.source === "archive30") {
          const m = archivedThirtyPath();
          const fig = h("div");
          archiveStage.append(ctx.panelTitle("Recorded prices, not exact breakpoints"), fig);
          const measured = Math.round(fig.clientWidth || archiveStage.clientWidth || 0);
          const width = Math.max(260, measured > 0 ? measured : ctx.width() - 28);
          plot(fig, {
            width,
            height: width < 480 ? 286 : 320,
            marginLeft: 52,
            marginRight: 20,
            marginTop: 18,
            marginBottom: 42,
            x: { label: "Recorded withholding cost τ", grid: true, inset: 10 },
            y: { label: "Stated pairs N", grid: true, inset: 10 },
            alt: "Eight recorded draw-based thirty-site analyses. Dots show disclosure at those prices only, not an exact step path.",
            table: archiveHiddenTable(m.rows),
            keyboard: {
              data: m.rows,
              x: "tau",
              y: "N",
              title: (r) =>
                `τ ${formatSetting(r.tau)}: ${formatCount(r.N)} pairs, status ${r.status}, absolute gap ${formatSci(r.risk_absolute_gap)}.`,
            },
            marks: (c, P) => [P.dot(m.rows, { x: "tau", y: "N", fill: c.plotFg, r: 5 })],
          });
          fig
            .querySelector(".prx-data-table table")
            ?.setAttribute(
              "aria-label",
              "Eight recorded draw-based thirty-site analyses. Dots show disclosure at those prices only, not an exact step path.",
            );
          archiveData.append(
            hint(),
            table(
              "Every recorded thirty-site solve",
              ["τ", "Status", "Grades", "N", "Weighted risk", "Absolute gap", "Poverty E/N", "FRL E/N", "SNAP E/N"],
              m.rows.map((r, i) => [
                n(`archive-${i}-tau`, r.tau, formatSetting),
                h("span", {}, labelNode(ctx, { status: r.status }, { key: `path-${i}` }), "; ", r.status),
                n(`archive-${i}-G`, r.G),
                n(`archive-${i}-N`, r.N),
                n(`archive-${i}-risk`, r.weighted_risk, formatRisk),
                n(`archive-${i}-gap`, r.risk_absolute_gap, formatSci),
                ...["poverty", "frl", "snap"].map((k) => n(`archive-${i}-share-${k}`, r["E_over_N_" + k], formatShare)),
              ]),
            ),
          );
          archiveMethod.append(
            h(
              "p",
              { class: "setg-note" },
              "Sparse archived pr_example_draws analyses, with fixed weights and cap. Dots are recorded solves; there is no interpolation or claim about transition locations. Risks at different prices measure different losses.",
            ),
            h(
              "p",
              { class: "setg-note" },
              "Fixed cap ",
              n("archive-cap", m.facts.G_max),
              "; weights ",
              ...Object.entries(m.facts.weights).flatMap(([k, v], i) => [i ? ", " : "", k, " ", ctx.num(v, formatSetting(v))]),
              ". Source ",
              name(m.source.object),
              ". These draw-based archives differ from the Gaussian marginal profile release. No unavailable lower bound or own report is reconstructed. A zero gap is not a numerical certificate.",
            ),
          );
          (ctx.toolbar ?? ctx.controls).after(ctx.readout.node);
          ctx.readout.set([
            "Recorded disclosures: ",
            ...m.rows.flatMap((r, i) => [i ? ", " : "", ctx.num(r.N, formatCount(r.N))]),
            ". Each dot is one archived price, not a transition estimate.",
          ]);
        } else {
          const m = tutorialSensitivityArchive().source;
          const t = m.tables;
          const ids = t.grid.setting_id;
          const tutRows = ids.map((id, i) => ({
            id,
            label: t.grid.label[i],
            tau: t.grid.tau[i],
            cap: t.grid.G_max[i],
            wA: t.grid.w_score_A[i],
            N: t.results.N[i],
            risk: t.results.risk[i],
            isRef: id === m.facts.reference_id,
          }));
          const refRow = tutRows.find((r) => r.isRef) ?? tutRows[0];
          const fig = h("div");
          archiveStage.append(ctx.panelTitle("Seven archived one-at-a-time settings"), fig);
          const measured = Math.round(fig.clientWidth || archiveStage.clientWidth || 0);
          const width = Math.max(260, measured > 0 ? measured : ctx.width() - 28);
          plot(fig, {
            width,
            height: width < 480 ? 286 : 312,
            marginLeft: 48,
            marginRight: 28,
            marginTop: 18,
            marginBottom: 42,
            x: { domain: [0, data.M], label: "Stated pairs N", grid: true },
            y: { domain: ids, label: null },
            alt: "Stated pairs N across the seven archived one-at-a-time tutorial settings, compared against reference setting S01.",
            table: {
              caption: "Tutorial archived disclosure counts",
              rows: tutRows,
              columns: [
                { label: "Setting", value: "id" },
                { label: "τ", value: "tau", format: formatSetting },
                { label: "Cap", value: "cap", format: formatCount },
                { label: "Weight A", value: "wA", format: formatSetting },
                { label: "Stated pairs N", value: "N", format: formatCount },
              ],
            },
            keyboard: {
              data: tutRows,
              x: "N",
              y: "id",
              title: (r) =>
                `${r.id} (${r.label}): ${formatCount(r.N)} of ${formatCount(data.M)} pairs stated, τ ${formatSetting(r.tau)}, cap ${formatCount(r.cap)}, weight A ${formatSetting(r.wA)}.`,
            },
            marks: (c, P) => [
              P.ruleX([refRow.N], { stroke: c.plotMuted, strokeDasharray: "5 3" }),
              P.ruleY(tutRows, { y: "id", x1: 0, x2: "N", stroke: (r) => (r.isRef ? c.accent : c.plotMuted), strokeWidth: 2.5 }),
              P.dot(tutRows, { x: "N", y: "id", fill: (r) => (r.isRef ? c.accent : c.plotFg), r: 5.5 }),
              numText(tutRows, {
                x: "N",
                y: "id",
                value: "N",
                format: formatCount,
                dx: 10,
                textAnchor: "start",
                fontSize: 13,
                fontWeight: (r) => (r.isRef ? 700 : 600),
                fill: c.plotFg,
              }),
            ],
          });
          archiveData.append(
            hint(),
            table(
              "Archived tutorial sensitivity with recorded bounds and statuses",
              [
                "Setting",
                "Label",
                "τ",
                "Cap",
                "Weight A",
                "Grade vector",
                "N",
                "Risk",
                "Status",
                "Lower bound",
                "Upper bound",
                "Absolute gap",
                "New stated",
                "New withheld",
                "Reversed",
              ],
              ids.map((id, i) => [
                name(id),
                h(
                  "span",
                  {},
                  ...t.grid.label[i]
                    .split(/(\d+(?:\.\d+)?)/)
                    .filter(Boolean)
                    .map((tok) => (/^\d/.test(tok) ? ctx.num(Number(tok), tok) : tok)),
                ),
                n(`tutorial-${i}-tau`, t.grid.tau[i], formatSetting),
                n(`tutorial-${i}-cap`, t.grid.G_max[i]),
                n(`tutorial-${i}-weight`, t.grid.w_score_A[i], formatSetting),
                n(`tutorial-${i}-grade`, t.grades[id], formatGrades),
                n(`tutorial-${i}-N`, t.results.N[i]),
                n(`tutorial-${i}-risk`, t.results.risk[i], formatRisk),
                t.results.status[i],
                n(`tutorial-${i}-lower`, t.results.risk_lower_bound[i], formatRisk),
                n(`tutorial-${i}-upper`, t.results.risk_upper_bound[i], formatRisk),
                n(`tutorial-${i}-gap`, t.results.risk_absolute_gap[i], formatSci),
                n(`tutorial-${i}-new`, t.changes.n_new_disclosed[i]),
                n(`tutorial-${i}-withheld`, t.changes.n_new_withheld[i]),
                n(`tutorial-${i}-reversed`, t.changes.n_reversed[i]),
              ]),
            ),
          );
          archiveMethod.append(
            h(
              "p",
              { class: "setg-note" },
              "The package’s prepared tutorial changes one setting at a time against its reference. It is a different grid from the full Cartesian product in the live view.",
            ),
            h(
              "p",
              { class: "setg-note" },
              "The archived reference is ",
              name(m.facts.reference_id),
              ". All reported numbers, grades, statuses and bounds are fixed archive fields. Risk values at changed weights or prices measure different losses. A zero gap is not a numerical certificate.",
            ),
          );
          const minN = Math.min(...t.results.N);
          const maxN = Math.max(...t.results.N);
          (ctx.toolbar ?? ctx.controls).after(ctx.readout.node);
          ctx.readout.set([
            "Archived one-at-a-time analysis: ",
            ctx.num(ids.length, formatCount(ids.length)),
            " recorded settings against reference ",
            name(m.facts.reference_id),
            ", with disclosure ranging from ",
            ctx.num(minN, formatCount(minN)),
            " to ",
            ctx.num(maxN, formatCount(maxN)),
            " stated pairs.",
          ]);
        }
        ctx.caption.replaceChildren(
          "Synthetic public postrank tutorial/archive inputs. Fixed recorded settings; no new archive solve.",
        );
      }

      return {
        render(s, info = {}) {
          // PR-06 / PR-09: opening a disclosure never re-renders ctx.stage or ctx.readout,
          // and re-renders width-dependent SVGs inside dataBox at their real open width.
          if (info?.reason === "disclosure") {
            if (s.source === "live" && info.disclosure === "data") {
              const m = settingsPathModel(s);
              drawShares(s, m);
              profileView.render(
                criterionProfileModel({ data: "six", level: 90, order: "criterion", orientB: "higher", pair: s.pair, unit: s.unit }),
              );
              profileKey = JSON.stringify([s.pair, s.unit, Math.floor(shares.clientWidth || ctx.width())]);
            }
            return;
          }

          const sourceHadFocus = Boolean(ctx.doc.activeElement && source.root.contains(ctx.doc.activeElement));
          source.set(s.source);
          tau.set(s.tau);
          w.set(s.w);
          cap.set(s.cap);
          pair.set(s.pair);
          unit.set(s.unit);

          if (s.source === "live") {
            tau.root.hidden = false;
            w.root.hidden = false;
            cap.root.hidden = false;
            pair.root.hidden = false;
            unit.root.hidden = false;
            settings.root.hidden = false;
            if (sourceHadFocus && info.changed?.includes("source")) settings.open = true;
            if (source.root.parentNode !== settings.body) settings.body.prepend(source.root);
            source.root.removeAttribute("data-prx-primary-control");
            ctx.primaryControl(tau.root);
          } else {
            tau.root.hidden = true;
            w.root.hidden = true;
            cap.root.hidden = true;
            pair.root.hidden = true;
            unit.root.hidden = true;
            settings.root.hidden = true;
            if (source.root.parentNode !== ctx.controls) ctx.controls.prepend(source.root);
            tau.root.removeAttribute("data-prx-primary-control");
            ctx.primaryControl(source.root);
          }

          liveStage.hidden = s.source !== "live";
          liveData.hidden = s.source !== "live";
          liveMethod.hidden = s.source !== "live";
          archiveStage.hidden = s.source === "live";
          archiveData.hidden = s.source === "live";
          archiveMethod.hidden = s.source === "live";

          if (s.source !== "live") {
            ctx.scheduleStages([() => drawArchive(s)], { yieldMs: 0 });
            return;
          }

          let m = null;
          ctx.scheduleStages(
            [
              () => {
                m = settingsPathModel(s);
                drawPathStage(s, m);
                setLiveReadoutAndCaption(s, m);
              },
              () => {
                if (!m) m = settingsPathModel(s);
                drawShares(s, m);
                drawLiveTables(s, m);
                guardedView.render(solveGuardedCriteria({ data: "six", tau: s.tau, w: s.w, cap: s.cap, objective: "weighted" }));
                const pk = JSON.stringify([s.pair, s.unit, Math.floor(shares.clientWidth || ctx.width())]);
                if (pk !== profileKey) {
                  profileView.render(
                    criterionProfileModel({ data: "six", level: 90, order: "criterion", orientB: "higher", pair: s.pair, unit: s.unit }),
                  );
                  profileKey = pk;
                }
                // Restore our primary live readout & caption after guardedView.render
                setLiveReadoutAndCaption(s, m);
                if (focusPathAfterApply) {
                  focusPathAfterApply = false;
                  counts.focus();
                }
              },
            ],
            { yieldMs: 0 },
          );
        },
      };
    },
  });
}
