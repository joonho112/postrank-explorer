import { createWidget } from "../shared/base.js";
import {
  gradeColors, hiddenTable, labelOn, palette, placeDirectLabels, plot, svgEl, svgScene,
} from "../shared/chart.js";
import {
  formatCount, formatDecimal, formatGrades, formatProb, formatReadoutEst,
  formatReadoutExpected, formatReadoutRisk, formatRisk, formatSci, formatSetting,
  formatShare, formatSig, formatTuple,
} from "../shared/format.js";
import { captionNode, familyNameNode, familySizeNode, labelNode } from "../shared/labels.js";
import { leagueModel } from "../shared/domain/fixed-tiers.js";
import { createRuleCardRenderer, CSS as CARD_CSS } from "../shared/domain/posterior-tiers.js";
import {
  LEAGUE_SEED, allocationValue, disclosure, evaluateReport, exactOptimum,
  finiteLawPairwise, fixedOrderDP, pairDirection, rankSummaries, rankSummariesMC,
  strictOrder, thresholdClassification,
} from "../pr-core.js";

const CSS = `${CARD_CSS}
.prx-op .prx-stage,
.prx-op .prx-stage > * { grid-area: auto; min-width: 0; max-width: 100%; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-title { margin: 0 0 0.2rem; font-size: 0.98rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar { align-items: flex-end; gap: 0.3rem 0.6rem; margin-bottom: 0.35rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar > .prx-controls { flex: 1 1 100%; align-items: flex-end; gap: 0.35rem 0.7rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider { flex: 1 1 9rem; max-width: 15rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-seg { padding: 0.16rem 0.45rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar > .prx-presets { flex: 1 1 26rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-presets > .prx-seg-label { margin-bottom: 0.12rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-presets .prx-seg-buttons { gap: 0.24rem; }
.prx-widget.prx-op[data-prx-frame="v2"] .prx-presets .prx-seg { padding: 0.2rem 0.48rem; font-size: 0.78rem; line-height: 1.15; }
@media (min-width: 48.01em) and (pointer: fine) {
  .prx-widget.prx-op[data-prx-frame="v2"] .prx-presets .prx-seg,
  .prx-widget.prx-op[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    min-height: 1.85rem;
  }
}
@media (max-width: 48em) {
  .prx-widget.prx-op[data-prx-frame="v2"] .prx-stage { padding: 0.5rem 0.6rem; }
}
.prx-op .prx-stage .op-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 0.9rem;
  align-items: start;
  min-width: 0;
}
@media (max-width: 52em) {
  .prx-op .prx-stage .op-stage-grid { grid-template-columns: 1fr; gap: 0.65rem; }
}
.prx-op .op-stage-units,
.prx-op .op-native-comparison { min-width: 0; max-width: 100%; }
.prx-op .prx-stage .op-stage-key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.9rem;
  margin: 0.35rem 0 0;
  font-size: 0.84375rem;
  color: var(--prx-plot-muted);
  background: var(--prx-plot-bg);
}
.prx-op .op-settings-row {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.55rem 1rem;
  min-width: 0;
}
.prx-op .op-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 0.75rem;
  min-width: 0;
  margin: 0 0 0.75rem;
}
.prx-op .op-box {
  border: 1px solid var(--prx-border);
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  min-width: 0;
}
.prx-op [data-prx-readout="grade"],
.prx-op [data-prx-readout="inclusion"] { white-space: normal; overflow-wrap: anywhere; }
.prx-op .op-note { font-size: 0.875rem; color: var(--prx-fg-muted); margin: 0.35rem 0; }
.prx-op .op-light-note { font-size: 0.875rem; color: var(--prx-plot-muted); background: var(--prx-plot-bg); margin: 0.35rem 0; }
.prx-op .op-box h4 { font-size: 0.95rem; margin: 0.1rem 0 0.45rem; }
.prx-op .op-scroll,
.prx-op .op-native-units .prx-data-table {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
  margin: 0.5rem 0;
}
.prx-op .op-table,
.prx-op .op-native-units table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}
.prx-op .op-table th,
.prx-op .op-table td,
.prx-op .op-native-units th,
.prx-op .op-native-units td {
  text-align: right;
  padding: 0.3rem 0.45rem;
  border-bottom: 1px solid var(--prx-border);
}
.prx-op .op-table th:first-child,
.prx-op .op-native-units th:first-child {
  text-align: left;
  white-space: nowrap;
}
.prx-op .op-table td,
.prx-op .op-native-units td { white-space: nowrap; }
.prx-op .op-sweep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 0.75rem;
  min-width: 0;
  margin: 0.5rem 0;
}
@media (max-width: 48em) {
  .prx-op .prx-seg,
  .prx-op .prx-btn,
  .prx-op select,
  .prx-op input[type="number"] {
    min-height: var(--prx-touch-target, 2.75rem);
  }
}
`;

const LAWS = {
  tb17: { ids: ["A", "B"], states: [[20, 4], [0, 4]], probs: [0.3, 0.7] },
  tb19: { ids: ["A", "B", "C"], states: [[20, 4, 3], [0, 4, 3]], probs: [0.3, 0.7] },
};
const populations = new Map();
const caches = new Map();

function population(s) {
  const key = s.law === "league" ? [s.law, s.priorSd, s.S, s.seed].join(":") : s.law;
  if (populations.has(key)) return populations.get(key);
  let model;
  if (s.law === "league") {
    const league = leagueModel(LEAGUE_SEED, s.priorSd);
    const means = league.post.mean;
    model = {
      ids: league.ids,
      n: league.ids.length,
      means,
      sd: league.post.sd,
      E: league.E,
      raw: league.estimate,
      ranks: rankSummariesMC(means, league.post.sd, s.S, s.seed),
    };
  } else {
    const law = LAWS[s.law];
    const ranks = rankSummaries(law);
    if (!ranks.tieFree) throw new Error("Exact-budget membership requires a declared latent-tie convention");
    model = { ids: law.ids, n: law.ids.length, means: ranks.means, E: finiteLawPairwise(law.states, law.probs, { ids: law.ids }), ranks, law };
  }
  populations.set(key, model);
  if (populations.size > 16) populations.delete(populations.keys().next().value);
  return model;
}

export function nativeModel(s) {
  const key = [s.law, s.budget, s.threshold, s.tau, s.priorSd, s.S, s.seed].join(":");
  if (caches.has(key)) return caches.get(key);
  const p = population(s);
  const { ids, n, means, E } = p;
  const pTop = s.budget === 0 ? means.map(() => 0) : s.budget === n ? means.map(() => 1) : p.ranks.pTop[s.budget - 1];
  const pAbove = s.law === "league"
    ? means.map((mu, i) => pairDirection(mu, p.sd[i], s.threshold, 0))
    : (() => {
      const t = finiteLawPairwise(p.law.states.map((state) => [...state, s.threshold]), p.law.probs);
      return means.map((_, i) => t.pi[0][i][n]);
    })();
  const opt = s.law === "league"
    ? fixedOrderDP(E, { scores: means, direction: "descending", G: 3, tau: s.tau })
    : exactOptimum(E, { tau: s.tau, family: { kind: "all" } });
  const grades = {
    mean: Array.from(strictOrder(means)),
    top: Array.from(strictOrder(pTop)),
    optimal: Array.from(opt.grade),
    withheld: ids.map(() => 1),
  };
  if (p.raw) grades.raw = Array.from(strictOrder(p.raw));
  const reports = Object.fromEntries(
    Object.entries(grades).map(([k, grade]) => [
      k,
      {
        key: k,
        grade,
        ev: evaluateReport(grade, E, { tau: s.tau }),
        d: disclosure(grade),
        allocation: allocationValue(grade, { values: means, pTop, budget: s.budget }),
      },
    ]),
  );
  const tied = (opt.grades ?? [opt.grade]).map((grade) => ({
    grade: Array.from(grade),
    ev: evaluateReport(grade, E, { tau: s.tau }),
    allocation: allocationValue(grade, { values: means, pTop, budget: s.budget }),
  }));
  const result = { ids, n, means, pTop, pAbove, E, opt, reports, tied };
  caches.set(key, result);
  if (caches.size > 64) caches.delete(caches.keys().next().value);
  return result;
}

const names = {
  mean: "Posterior-mean order",
  top: "Top-set probability order",
  optimal: "Reporting objective",
  withheld: "Withhold every pair",
  raw: "Raw-estimate order",
};

const SINGLE_TAG = {
  mean: "Mean order",
  top: "Top-set",
  optimal: "Best report",
  withheld: "Withheld",
  raw: "Raw order",
  bayes: "Bayes rule",
};

const PAIR_TAG = {
  mean: "Mean",
  top: "Top",
  optimal: "Best",
  withheld: "Silent",
  raw: "Raw",
  bayes: "Bayes",
};

function pillPartsForKeys(keys) {
  if (keys.length === 1) return [SINGLE_TAG[keys[0]] ?? keys[0]];
  if (keys.length === 2) return [`${PAIR_TAG[keys[0]] ?? keys[0]} = ${PAIR_TAG[keys[1]] ?? keys[1]}`];
  return ["All ", { raw: keys.length, text: formatCount(keys.length) }, " rules"];
}

function appendDirectCandidateLabels(chart, rows, xOf, yOf, { marginTop, marginBottom, marginRight, chosenKey, dataNumFn }) {
  const { svg, palette: pal } = chart;
  const doc = svg.ownerDocument;
  const w = Number(svg.getAttribute("width")) || 320;
  const h = Number(svg.getAttribute("height")) || 260;
  const sx = chart.scale("x");
  const sy = chart.scale("y");
  const plotRight = w - marginRight;
  const railX = plotRight + (w < 460 ? 7 : 10);
  const maxWidth = marginRight - (w < 460 ? 9 : 14);

  const groups = new Map();
  for (const row of rows) {
    const xv = xOf(row);
    const yv = yOf(row);
    const gKey = `${xv.toFixed(9)}|${yv.toFixed(9)}`;
    if (!groups.has(gKey)) {
      groups.set(gKey, {
        id: gKey,
        px: sx.apply(xv),
        py: sy.apply(yv),
        keys: [],
      });
    }
    groups.get(gKey).keys.push(row.key);
  }

  const items = [...groups.values()]
    .sort((a, b) => a.py - b.py || a.px - b.px)
    .map((g) => ({
      ...g,
      y: g.py,
      height: 20,
      parts: pillPartsForKeys(g.keys),
      bold: g.keys.includes(chosenKey) || g.keys.includes("bayes"),
    }));

  const placed = placeDirectLabels(items, {
    minGapPx: 23,
    minY: marginTop + 12,
    maxY: h - marginBottom - 12,
  });
  const byId = new Map(placed.map((p) => [p.id, p]));
  const layer = svgEl(doc, "g", { "aria-hidden": "true", "pointer-events": "none" });

  for (const item of items) {
    const pl = byId.get(item.id);
    if (!pl) continue;
    const startX = Math.min(plotRight, item.px + 7);
    layer.append(
      svgEl(doc, "path", {
        d: `M${startX},${item.py}L${railX - 5},${pl.y}`,
        stroke: pal.plotMuted,
        strokeWidth: 0.9,
        opacity: 0.75,
        fill: "none",
      }),
    );
    const fullText = item.parts.map((p) => (typeof p === "string" ? p : p.text)).join("");
    const estWidth = Math.min(maxWidth, Math.ceil(fullText.length * 7.1 + 10));
    layer.append(
      svgEl(doc, "rect", {
        x: railX - 4,
        y: pl.y - 10,
        width: estWidth,
        height: 20,
        rx: 3,
        fill: pal.plotBg,
        fillOpacity: 0.94,
        stroke: pal.plotGrid,
        strokeWidth: 0.75,
      }),
    );
    const textNode = svgEl(doc, "text", {
      x: railX + 1,
      y: pl.y,
      textAnchor: "start",
      dominantBaseline: "central",
      fontSize: 13,
      fontWeight: item.bold ? 600 : 500,
      fill: pal.plotFg,
    });
    for (const p of item.parts) {
      if (typeof p === "string") textNode.append(doc.createTextNode(p));
      else textNode.append(svgEl(doc, "tspan", { "data-num": dataNumFn(p.raw), text: p.text }));
    }
    layer.append(textNode);
  }
  svg.append(layer);
}

function selectStageUnits(unitRows, s, bayes, maxCount = 5) {
  if (unitRows.length <= maxCount) return unitRows;
  const byMean = [...unitRows].sort((a, b) => b.mean - a.mean || a.index - b.index);
  const picked = new Set();
  if (s.mode === "places") {
    const b = Math.max(1, Math.min(byMean.length - 1, s.budget));
    if (b <= maxCount - 2) {
      for (let i = 0; i < Math.min(maxCount, byMean.length); i += 1) picked.add(byMean[i].index);
    } else {
      picked.add(byMean[0].index);
      for (let k = Math.max(0, b - 2); k <= Math.min(byMean.length - 1, b + 1) && picked.size < maxCount; k += 1) {
        picked.add(byMean[k].index);
      }
      for (let i = 0; i < byMean.length && picked.size < maxCount; i += 1) picked.add(byMean[i].index);
    }
  } else {
    const cut = bayes?.cutoff ?? 0.5;
    const byDist = [...byMean].sort((a, b) => Math.abs(a.pAbove - cut) - Math.abs(b.pAbove - cut));
    picked.add(byMean[0].index);
    for (const r of byDist) {
      if (picked.size >= maxCount - 1) break;
      picked.add(r.index);
    }
    picked.add(byMean[byMean.length - 1].index);
  }
  return byMean.filter((r) => picked.has(r.index)).slice(0, maxCount);
}

function drawStageUnits(slot, { shownUnits, totalUnits, G, s, bayes, dataNumFn }) {
  const w = Math.max(250, Math.round(slot.clientWidth || 320));
  const narrow = w < 420;
  const marginLeft = narrow ? 82 : 90;
  const marginRight = s.mode === "places" ? 56 : 68;
  const marginTop = 26;
  const marginBottom = 38;
  const rowH = narrow ? 29 : 34;
  const minH = narrow ? 148 : (shownUnits.length <= 4 ? 200 : 280);
  const height = Math.max(minH, marginTop + marginBottom + shownUnits.length * rowH);

  svgScene(
    slot,
    {
      width: w,
      height,
      margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
      alt: s.mode === "places"
        ? "Each shown unit's grade pill in the inspected report, its allocation inclusion bar, and its true top-set membership probability."
        : "Each shown unit's grade pill in the inspected report, its posterior probability above threshold against the Bayes cutoff, and whether Bayes or grade cutoff declares it positive.",
    },
    (scene) => {
      const { h: el, palette: pal, innerWidth } = scene;
      const fills = gradeColors(G, pal);
      const xAt = (v) => marginLeft + Math.max(0, Math.min(1, v)) * innerWidth;
      const plotBottom = marginTop + shownUnits.length * rowH;

      // Column headers
      scene.add(
        el("text", {
          x: 4,
          y: 14,
          fontSize: 13,
          fontWeight: 600,
          fill: pal.plotMuted,
          text: totalUnits > shownUnits.length ? "Focus units · Grade" : "Unit · Grade",
        }),
        el("text", {
          x: w - 4,
          y: 14,
          textAnchor: "end",
          fontSize: 13,
          fontWeight: 600,
          fill: pal.plotMuted,
          text: s.mode === "places" ? "Mean" : "Action",
        }),
      );

      // Grid lines & ticks on [0, 1]
      for (const tv of [0, 0.5, 1]) {
        const tx = xAt(tv);
        scene.add(
          el("line", {
            x1: tx,
            y1: marginTop - 2,
            x2: tx,
            y2: plotBottom,
            stroke: tv === 0 ? pal.plotAxis : pal.plotGrid,
            strokeWidth: 1,
          }),
          el("text", {
            x: tx,
            y: plotBottom + 16,
            textAnchor: tv === 0 ? "start" : tv === 1 ? "end" : "middle",
            fontSize: 13,
            fill: pal.plotAxis,
            num: tv,
            text: tv === 0 ? "0" : tv === 1 ? "1" : ".5",
          }),
        );
      }

      if (s.mode === "threshold" && bayes && Number.isFinite(bayes.cutoff) && bayes.cutoff >= 0 && bayes.cutoff <= 1) {
        const cx = xAt(bayes.cutoff);
        scene.add(
          el("line", {
            x1: cx,
            y1: marginTop - 4,
            x2: cx,
            y2: plotBottom,
            stroke: pal.est,
            strokeWidth: 1.6,
            strokeDasharray: "4,3",
          }),
        );
      }

      shownUnits.forEach((u, idx) => {
        const cy = marginTop + idx * rowH + rowH / 2;
        const gFill = fills[Math.min(fills.length - 1, Math.max(0, u.grade - 1))];
        const gInk = labelOn(gFill, pal);
        const pillX = narrow ? 36 : 42;
        const pillW = 36;

        // Subtle row separator
        if (idx > 0) {
          scene.add(
            el("line", {
              x1: 4,
              y1: marginTop + idx * rowH,
              x2: w - 4,
              y2: marginTop + idx * rowH,
              stroke: pal.plotGrid,
              strokeWidth: 0.6,
            }),
          );
        }

        // Unit ID + PR-03 18px rounded grade badge pill
        scene.add(
          el("text", {
            x: 4,
            y: cy,
            dominantBaseline: "central",
            fontSize: 13,
            fontWeight: 600,
            fill: pal.plotFg,
            "data-prx-name": "",
            text: u.id,
          }),
          el("rect", {
            x: pillX,
            y: cy - 9,
            width: pillW,
            height: 18,
            rx: 3,
            fill: gFill,
            stroke: pal.plotBg,
            strokeWidth: 1,
          }),
        );
        const badgeText = el("text", {
          x: pillX + pillW / 2,
          y: cy,
          textAnchor: "middle",
          dominantBaseline: "central",
          fontSize: 13,
          fontWeight: 700,
          fill: gInk,
        });
        badgeText.append(scene.doc.createTextNode("G"), el("tspan", { "data-num": dataNumFn(u.grade), text: formatCount(u.grade) }));
        scene.add(badgeText);

        if (s.mode === "places") {
          const barW = Math.max(0, xAt(u.inclusion) - marginLeft);
          if (barW > 0.5) {
            scene.add(
              el("rect", {
                x: marginLeft,
                y: cy - 6,
                width: barW,
                height: 12,
                rx: 2,
                fill: pal.post,
                fillOpacity: 0.82,
              }),
            );
          }
          scene.add(
            el("circle", {
              cx: xAt(u.pTop),
              cy,
              r: 5.2,
              fill: pal.est,
              stroke: pal.plotBg,
              strokeWidth: 1.5,
            }),
            el("text", {
              x: w - 4,
              y: cy,
              textAnchor: "end",
              dominantBaseline: "central",
              fontSize: 13,
              fill: pal.plotFg,
              num: u.mean,
              text: formatReadoutEst(u.mean),
            }),
          );
        } else {
          const barW = Math.max(0, xAt(u.pAbove) - marginLeft);
          if (barW > 0.5) {
            scene.add(
              el("rect", {
                x: marginLeft,
                y: cy - 6,
                width: barW,
                height: 12,
                rx: 2,
                fill: u.bayes ? pal.est : pal.neutral[4],
                fillOpacity: 0.82,
              }),
            );
          }
          scene.add(
            el("circle", {
              cx: xAt(u.pAbove),
              cy,
              r: 4.5,
              fill: u.bayes ? pal.est : pal.plotBg,
              stroke: u.bayes ? pal.plotBg : pal.plotAxis,
              strokeWidth: 1.4,
            }),
          );
          const actionTag = u.bayes && u.gradePositive
            ? "Both +"
            : u.bayes
              ? "Bayes +"
              : u.gradePositive
                ? "Grade +"
                : "Neither";
          scene.add(
            el("text", {
              x: w - 4,
              y: cy,
              textAnchor: "end",
              dominantBaseline: "central",
              fontSize: 13,
              fontWeight: u.bayes !== u.gradePositive ? 600 : 400,
              fill: u.bayes !== u.gradePositive ? pal.estText : pal.plotMuted,
              text: actionTag,
            }),
          );
        }
      });

      // Axis caption
      const axisCaption = el("text", {
        x: marginLeft + innerWidth / 2,
        y: height - 6,
        textAnchor: "middle",
        fontSize: 13,
        fill: pal.plotAxis,
      });
      if (s.mode === "places") {
        axisCaption.append(
          scene.doc.createTextNode(narrow ? "Bar: allocated · " : "Bar: grade allocation · "),
          el("tspan", { fill: pal.est, text: "●" }),
          scene.doc.createTextNode(narrow ? " top-set Pr" : " true top-set Pr"),
        );
      } else {
        axisCaption.textContent = narrow ? "Pr(above) · dashed: cutoff" : "Pr(above threshold) · dashed: Bayes cutoff";
      }
      scene.add(axisCaption);
    },
  );
  return height;
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "one-place",
    className: "prx-op prx-pt",
    css: CSS,
    frame: "v2",
    title: "Which objective chooses the action?",
    label: "A grade report compared with native allocation and threshold decisions",
    keys: {
      law: { type: "choice", values: ["tb19", "tb17", "league"], value: "tb19" },
      mode: { type: "choice", values: ["places", "threshold"], value: "places" },
      tau: { type: "number", min: 0.02, max: 0.5, step: 0.01, value: 0.25 },
      budget: { type: "integer", min: 0, max: 30, value: 1 },
      report: { type: "choice", values: ["optimal", "mean", "top", "withheld", "raw"], value: "optimal" },
      threshold: { type: "number", min: -0.5, max: 20, step: 0.01, value: 3.5 },
      falsePositiveCost: { type: "number", min: 0, max: 5, step: 0.25, value: 1 },
      falseNegativeCost: { type: "number", min: 0, max: 5, step: 0.25, value: 1 },
      positiveGrade: { type: "integer", min: 0, max: 30, value: 1 },
      priorSd: { type: "number", min: 0.05, max: 0.5, step: 0.01, value: 0.15 },
      S: { type: "integer", min: 100, max: 4000, step: 100, value: 2000 },
      seed: { type: "integer", min: 1, max: 4294967295, value: 1 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, v, f = formatDecimal) => {
        const node = ctx.num(v, f(v));
        node.dataset.prxReadout = name;
        return node;
      };

      // Primary controls (strictly 2 handles in clean row-by-row DOM order -> 0 upward Tab jumps)
      const tau = ctx.slider({
        label: "Withholding cost τ",
        name: "tau",
        min: 0.02,
        max: 0.5,
        step: 0.01,
        value: ctx.state.tau,
        onInput: (v) => ctx.set({ tau: v }),
      });
      const mode = ctx.segmented({
        label: "Decision task",
        name: "mode",
        options: [
          { value: "places", label: "Places" },
          { value: "threshold", label: "Threshold" },
        ],
        value: ctx.state.mode,
        onChange: (v) => ctx.set({ mode: v }),
      });
      ctx.controls.append(ctx.primaryControl(tau.root), mode.root);

      // Secondary parameters in Settings disclosure (>= 44px touch targets, 0 bare radio dots)
      const law = ctx.select({
        label: "Supplied conditional law",
        name: "law",
        options: [
          { value: "tb19", label: "Three-unit two-state law" },
          { value: "tb17", label: "Two-unit two-state law" },
          { value: "league", label: "Simulated league: normal posterior" },
        ],
        value: ctx.state.law,
        onChange: (v) => ctx.set({ law: v }),
      });
      const reportKeys = Object.keys(names);
      const report = ctx.select({
        label: "Report to inspect",
        name: "report",
        options: Object.entries(names).map(([value, label]) => ({ value, label })),
        value: ctx.state.report,
        onChange: (v) => ctx.set({ report: v }),
      });
      const budget = ctx.slider({
        label: "Top-set budget b",
        name: "budget",
        min: 0,
        max: 30,
        step: 1,
        value: ctx.state.budget,
        format: formatCount,
        onInput: (v) => ctx.set({ budget: v }),
      });
      const threshold = ctx.slider({
        label: "Substantive target threshold",
        name: "threshold",
        min: -0.5,
        max: 20,
        step: 0.01,
        value: ctx.state.threshold,
        onInput: (v) => ctx.set({ threshold: v }),
      });
      const fp = ctx.slider({
        label: "False-positive cost",
        name: "falsePositiveCost",
        min: 0,
        max: 5,
        step: 0.25,
        value: ctx.state.falsePositiveCost,
        onInput: (v) => ctx.set({ falsePositiveCost: v }),
      });
      const fn = ctx.slider({
        label: "False-negative cost",
        name: "falseNegativeCost",
        min: 0,
        max: 5,
        step: 0.25,
        value: ctx.state.falseNegativeCost,
        onInput: (v) => ctx.set({ falseNegativeCost: v }),
      });
      const positiveGrade = ctx.slider({
        label: "Positive through grade h",
        name: "positiveGrade",
        min: 0,
        max: 30,
        step: 1,
        value: ctx.state.positiveGrade,
        format: formatCount,
        onInput: (v) => ctx.set({ positiveGrade: v }),
      });
      const prior = ctx.slider({
        label: "Stipulated normal prior SD",
        name: "priorSd",
        min: 0.05,
        max: 0.5,
        step: 0.01,
        value: ctx.state.priorSd,
        onInput: (v) => ctx.set({ priorSd: v }),
      });
      const S = ctx.slider({
        label: "Posterior draws S",
        name: "S",
        min: 100,
        max: 4000,
        step: 100,
        value: ctx.state.S,
        format: formatCount,
        onInput: (v) => ctx.set({ S: v }),
      });
      const seed = ctx.numberInput({
        label: "Posterior integration seed",
        name: "seed",
        min: 1,
        max: 4294967295,
        step: 1,
        value: ctx.state.seed,
        onInput: (v) => ctx.set({ seed: v }),
      });

      const baseControls = h("div", { class: "op-settings-row" }, law.root, report.root, budget.root);
      const nativeControls = h("div", { class: "op-settings-row" }, threshold.root, fp.root, fn.root, positiveGrade.root);
      const normalControls = h("div", { class: "op-settings-row" }, prior.root, S.root, seed.root);
      const settings = ctx.settingsBox("Settings");
      settings.body.append(baseControls, nativeControls, normalControls);

      // Unified stage: unit grade-vs-action graphic + candidate objective trade-off plot
      const stageUnits = h("div", { class: "op-stage-units" });
      const nativePlot = h("div", { class: "op-native-comparison" });
      const stageGrid = h("div", { class: "op-stage-grid" }, stageUnits, nativePlot);
      const stageKey = h("p", { class: "op-stage-key", "data-prx-part": "legend" });
      ctx.stage.append(stageGrid, stageKey);

      // Data disclosure: rule & native cards, equal-risk ties, candidate summary table, full unit table
      const dataBox = ctx.dataBox("Data, unit table and task sweep");
      const cards = h("div", { class: "op-grid" });
      const ties = ctx.scrollRegion(h("div", { class: "op-scroll" }), "Equal-risk reporting alternatives under the same added action rule");
      const summary = ctx.scrollRegion(h("div", { class: "op-scroll" }), "Compare every reporting rule on its reporting and native objectives");
      const unitsTableWrap = h("div", { class: "op-native-units" });
      dataBox.body.append(cards, ties, summary, unitsTableWrap);

      // Method disclosure: law parameters, objective-vs-risk sweep plots, and methodological conventions
      const methodBox = ctx.methodBox("Method: grade reports vs. allocations and thresholds");
      const statement = h("p", { class: "op-note" });
      const valuePlot = h("div");
      const overlapPlot = h("div");
      const classPlot = h("div");
      const sweepGrid = h("div", { class: "op-sweep-grid" }, valuePlot, overlapPlot, classPlot);
      const methodNotes = h("div");
      methodBox.body.append(statement, sweepGrid, methodNotes);

      const renderer = createRuleCardRenderer(ctx);
      let drawOpenSweeps = null;

      function render(s, info = {}) {
        if (info?.reason === "disclosure") {
          if (info.disclosure === "method" && methodBox.open && drawOpenSweeps) drawOpenSweeps();
          return;
        }

        const n = s.law === "tb17" ? 2 : s.law === "tb19" ? 3 : 30;
        budget.input.max = String(n);
        positiveGrade.input.max = String(n);
        if (s.budget > n || s.positiveGrade > n) {
          ctx.set({ budget: Math.min(s.budget, n), positiveGrade: Math.min(s.positiveGrade, n) });
          return;
        }
        if (s.law !== "league" && s.report === "raw") {
          ctx.set({ report: "optimal" });
          return;
        }

        law.set(s.law);
        mode.set(s.mode);
        tau.set(s.tau);
        budget.set(s.budget);
        report.set(s.report);
        threshold.set(s.threshold);
        fp.set(s.falsePositiveCost);
        fn.set(s.falseNegativeCost);
        positiveGrade.set(s.positiveGrade);
        prior.set(s.priorSd);
        S.set(s.S);
        seed.set(s.seed);

        nativeControls.hidden = s.mode !== "threshold";
        normalControls.hidden = s.law !== "league";
        const rawOpt = report.input.options[reportKeys.indexOf("raw")];
        if (rawOpt) rawOpt.disabled = s.law !== "league";

        if (s.mode === "threshold" && s.falsePositiveCost + s.falseNegativeCost === 0) {
          statement.textContent = "At least one classification cost must be positive.";
          cards.replaceChildren();
          drawOpenSweeps = null;
          for (const slot of [stageUnits, nativePlot, stageKey, valuePlot, overlapPlot, classPlot, ties, unitsTableWrap, summary, methodNotes]) {
            slot.replaceChildren();
          }
          ctx.readout.set("Both classification costs are zero; choose a positive cost before evaluating.");
          return;
        }

        const m = nativeModel(s);
        const selected = m.reports[s.report];
        const classificationOptions = { falsePositiveCost: s.falsePositiveCost, falseNegativeCost: s.falseNegativeCost, values: m.means };
        const bayes = s.falsePositiveCost + s.falseNegativeCost > 0 ? thresholdClassification(m.pAbove, classificationOptions) : null;
        const rows = Object.values(m.reports).map((r) => ({
          ...r,
          name: names[r.key],
          classification: bayes ? thresholdClassification(m.pAbove, { ...classificationOptions, positive: r.grade.map((g) => g <= s.positiveGrade) }) : null,
        }));
        const chosen = rows.find((r) => r.key === s.report);
        const pal = palette(ctx.root);
        const dec = (v) => formatDecimal(v, { digits: 3 });

        statement.replaceChildren(
          ...(s.law === "league"
            ? [
              "Frozen league measurement seed ", ctx.num(LEAGUE_SEED, formatCount(LEAGUE_SEED)),
              ". Independent normal posteriors with a stipulated prior; top-set probabilities use ",
              ctx.num(s.S, formatCount(s.S)), " draws and integration seed ", ctx.num(s.seed, formatCount(s.seed)), ".",
            ]
            : [
              "State A high: ", ctx.num(0.3, formatProb(0.3)), " at A = ", ctx.num(20, formatCount(20)),
              "; state A low: ", ctx.num(0.7, formatProb(0.7)), " at A = ", ctx.num(0, formatCount(0)),
              ". B stays at ", ctx.num(4, formatCount(4)),
              ...(s.law === "tb19" ? [" and C at ", ctx.num(3, formatCount(3))] : []),
              ". Larger target values have higher priority.",
            ]),
        );

        // Data disclosure cards (preserving 100% of [data-prx-readout] hooks)
        const reportCard = h(
          "section",
          { class: "op-box prx-light-panel" },
          h("h4", {}, names[s.report]),
          renderer.chips(m, selected.grade, pal),
          h("p", { class: "op-light-note", text: "Grade 1 = stated highest on the target, as the posterior judges it." }),
          h(
            "p",
            {},
            "Report ", ro("grade", selected.grade, formatGrades),
            ". N ", ro("N", selected.ev.N, formatCount),
            " of ", ro("M", selected.ev.M, formatCount),
            "; E/N ", ro("EoverN", selected.ev.EoverN[0], formatShare),
            "; risk ", ro("risk", selected.ev.risk, formatRisk), ".",
          ),
          h(
            "p",
            { class: "op-light-note" },
            ...(s.report === "optimal"
              ? [
                labelNode(ctx, m.opt),
                ...(m.opt.label === "optimal-within-order" ? [" in ", familyNameNode(ctx, m.opt)] : []),
                " (", familySizeNode(ctx, m.opt), " reports/cuts).",
              ]
              : [captionNode(ctx, "fixed-report"), "."]),
          ),
        );
        if (s.report === "optimal") {
          reportCard.append(
            h(
              "p",
              { class: "op-light-note" },
              s.law === "league"
                ? "Followed representative: fewer grades first, then earlier cuts in posterior-mean order. Exact score ties stay in the same block. "
                : "Followed representative: lexicographically first grade vector in unit order. ",
              ro("tieCount", m.opt.tieCount ?? 1, formatCount),
              (m.opt.tieCount ?? 1) === 1 ? " best report within tolerance " : " equal-risk reports within tolerance ",
              ro("tieTol", m.opt.tieTol ?? 1e-12, formatSci), ".",
            ),
          );
        }

        const nativeCard = h("section", { class: "op-box" });
        if (s.mode === "places") {
          nativeCard.append(
            h("h4", { text: "Allocation added to this report" }),
            h(
              "p",
              {},
              "Fill exactly ", ro("budget", s.budget, formatCount),
              s.budget === 1 ? " place. Expected selected value " : " places. Expected selected value ",
              ro("value", selected.allocation.expectedValue, dec),
              "; expected top-set overlap ", ro("overlap", selected.allocation.expectedOverlap, dec),
              "; overlap share ", ro("overlapShare", selected.allocation.overlapShare, (v) => formatSig(v, { sig: 3 })),
              ...(s.budget === 0 ? [" (no places allocated)"] : []),
              ".",
            ),
            h(
              "p",
              { class: "op-note" },
              "Include higher grades first. If the boundary grade does not fit, choose a uniform subset of exactly the remaining size, independently of the true state. Expected inclusion is ",
              ro("inclusion", selected.allocation.inclusion, (v) => formatTuple(v, dec)), ".",
            ),
          );
        } else {
          nativeCard.append(
            h("h4", { text: "Binary classification is an added action" }),
            h(
              "p",
              {},
              "Native Bayes classifier: ", ro("bayes-positive", bayes.positiveCount, formatCount),
              " positive; total cost ", ro("bayes-cost", bayes.totalCost, dec),
              "; value of positives ", ro("bayes-value", bayes.selectedValue, dec),
              ". Positive when posterior Pr(target > threshold) ≥ ", ro("cutoff", bayes.cutoff, formatProb),
              "; choose positive at equality.",
            ),
            h(
              "p",
              {},
              "Grades through h = ", ro("h", s.positiveGrade, formatCount),
              " declare ", ro("grade-positive", chosen.classification.positiveCount, formatCount),
              " positive; total cost ", ro("grade-cost", chosen.classification.totalCost, dec),
              "; value of positives ", ro("grade-value", chosen.classification.selectedValue, dec), ".",
            ),
            h(
              "p",
              { class: "op-note" },
              "The target event is strictly above its substantive threshold; the probability cutoff comes from the two error costs, not from the place budget or τ.",
            ),
          );
        }
        cards.replaceChildren(reportCard, nativeCard);

        // Equal-risk ties table in Data
        const tiedList = (m.opt.tieCount ?? 1) > 1
          ? m.tied.map((r) => ({
            ...r,
            classification: bayes ? thresholdClassification(m.pAbove, { ...classificationOptions, positive: r.grade.map((g) => g <= s.positiveGrade) }) : null,
          }))
          : [];
        ties.hidden = tiedList.length <= 1;
        const nativeFirst = (cells) => {
          const i = s.mode === "places" ? 2 : cells.length - 1;
          return [cells[i], ...cells.filter((_, k) => k !== i)];
        };
        if (!ties.hidden) {
          ties.replaceChildren(
            h(
              "p",
              { class: "op-note" },
              "Equal reporting risk can hide different disclosures and added actions. Listed ",
              ro("ties-listed", tiedList.length, formatCount),
              " of ", ro("ties-total", Number(m.opt.tieCount), formatCount),
              " equal-risk reports; ",
              tiedList.length < Number(m.opt.tieCount) ? "the list is truncated. " : "the list is complete. ",
              "The table applies the same lottery and grade-to-class rule to each alternative.",
            ),
            h(
              "table",
              { class: "op-table prx-sticky-first" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  h("th", { scope: "col", text: "Report" }),
                  ...nativeFirst([
                    "Stated pairs N", "Risk", "Budget selected value", "Top overlap",
                    ...(s.mode === "threshold" ? ["Positive declarations", "Positive value", "Classification cost"] : []),
                  ]).map((text) => h("th", { scope: "col", text })),
                ),
              ),
              h(
                "tbody",
                {},
                ...tiedList.map((r, i) => h(
                  "tr",
                  {},
                  h("th", { scope: "row" }, ro(`tie-${i}-grade`, r.grade, formatGrades)),
                  ...nativeFirst([
                    ["N", r.ev.N, formatCount],
                    ["risk", r.ev.risk, formatRisk],
                    ["value", r.allocation.expectedValue, dec],
                    ["overlap", r.allocation.expectedOverlap, dec],
                    ...(s.mode === "threshold"
                      ? [
                        ["positive", r.classification.positiveCount, formatCount],
                        ["positiveValue", r.classification.selectedValue, dec],
                        ["cost", r.classification.totalCost, dec],
                      ]
                      : []),
                  ]).map(([k, v, f]) => h("td", {}, ro(`tie-${i}-${k}`, v, f))),
                )),
              ),
            ),
          );
        } else {
          ties.replaceChildren();
        }

        // Stage Panel A: Unit grade-vs-action comparison SVG
        const unitRows = m.ids.map((id, i) => ({
          index: i,
          id,
          grade: selected.grade[i],
          mean: m.means[i],
          pTop: m.pTop[i],
          pAbove: m.pAbove[i],
          inclusion: selected.allocation.inclusion[i],
          bayes: bayes?.positive[i] ?? null,
          gradePositive: chosen.classification?.positive[i] ?? null,
        }));
        const plotWidth = (slot) => Math.max(250, Math.round(slot.clientWidth || ctx.width()));
        const nw = plotWidth(nativePlot);
        const narrowPlot = nw < 460;
        const shownUnits = selectStageUnits(unitRows, s, bayes, narrowPlot ? 4 : 6);
        const unitsHeight = drawStageUnits(stageUnits, {
          shownUnits,
          totalUnits: unitRows.length,
          G: Math.max(...selected.grade),
          s,
          bayes,
          dataNumFn: ctx.dataNum,
        });

        // Stage Panel B: Candidate rules on native objectives (with collision-free placeDirectLabels + plotBg pills)
        const marginRight = narrowPlot ? 98 : 138;
        const marginTop = 20;
        const marginBottom = 42;
        const nativeHeight = narrowPlot ? 210 : Math.max(245, unitsHeight);
        const nativeRows = s.mode === "places"
          ? rows
          : [...rows, { key: "bayes", name: "Native Bayes classifier (binary action)", classification: bayes, ev: { risk: null } }];
        const nativeX = s.mode === "places" ? (r) => r.allocation.expectedValue : (r) => r.classification.selectedValue;
        const nativeXLabel = s.mode === "places" ? "Expected selected value" : "Expected value of positives";
        const nativeY = s.mode === "places" ? (r) => r.allocation.expectedOverlap : (r) => r.classification.totalCost;
        const nativeLabel = s.mode === "places" ? "Expected top-set overlap" : "Expected classification cost";

        const nativeChart = plot(nativePlot, {
          width: nw,
          height: nativeHeight,
          marginLeft: 58,
          marginRight,
          marginTop,
          marginBottom,
          x: { label: nativeXLabel, ticks: narrowPlot ? 2 : 5, labelAnchor: "center", labelArrow: "none", insetLeft: 16, insetRight: 12 },
          y: { label: nativeLabel, ticks: narrowPlot ? 4 : 5, labelAnchor: "center", labelArrow: "none", grid: true, insetTop: 14, insetBottom: 14 },
          alt: "Candidate rules compared on native objectives. Reporting risk is separately listed for every rule.",
          table: {
            caption: "Native objectives and the separate reporting risk",
            columns: [
              { label: "Report", value: "name" },
              { label: nativeXLabel, value: nativeX, format: dec },
              { label: nativeLabel, value: nativeY, format: dec },
              { label: "Reporting risk", value: (r) => (r.key === "bayes" ? "NA: binary action" : r.ev.risk), format: (v) => (typeof v === "number" ? formatRisk(v) : v) },
            ],
            rows: nativeRows,
          },
          keyboard: {
            data: nativeRows,
            x: nativeX,
            y: nativeY,
            sort: false,
            pointer: true,
            onSelect: (r) => { if (r.key !== "bayes") ctx.set({ report: r.key }); },
            label: "Compare native objectives with reporting risk separately named",
            title: (r) => `${r.name}: selected value ${dec(nativeX(r))}, ${nativeLabel} ${dec(nativeY(r))}; separate reporting risk ${r.key === "bayes" ? "not defined for this binary action" : formatRisk(r.ev.risk)}`,
          },
          marks: (c, P) => [
            ...(s.mode === "places" ? [P.ruleX([m.reports.mean.allocation.expectedValue], { stroke: c.plotMuted, strokeDasharray: "4,3" })] : []),
            P.ruleY([s.mode === "places" ? m.reports.top.allocation.expectedOverlap : bayes.totalCost], { stroke: c.plotMuted, strokeDasharray: "4,3" }),
            P.dot(rows, { x: nativeX, y: nativeY, symbol: (r) => (r.key === "optimal" ? "diamond" : "circle"), r: 6.5, fill: c.post, stroke: c.plotBg, strokeWidth: 1.2 }),
            P.dot([chosen], { x: nativeX, y: nativeY, r: 10.5, fill: "none", stroke: c.plotFg, strokeWidth: 2.2 }),
            ...(s.mode === "threshold" ? [P.dot([{ value: bayes.selectedValue, cost: bayes.totalCost }], { x: "value", y: "cost", symbol: "star", r: 8, fill: c.est, stroke: c.plotBg, strokeWidth: 1.2 })] : []),
          ],
        });
        appendDirectCandidateLabels(nativeChart, nativeRows, nativeX, nativeY, {
          marginTop,
          marginBottom,
          marginRight,
          chosenKey: s.report,
          dataNumFn: ctx.dataNum,
        });

        stageKey.replaceChildren(
          h("span", { text: "◆ reporting objective" }),
          h("span", { text: `○ inspected: ${names[s.report]}` }),
          ...(s.mode === "threshold" ? [h("span", { text: "★ native Bayes classifier" })] : []),
        );

        // Method disclosure sweep plots (table always preserved eagerly; full SVG drawn at real width when Method is open)
        valuePlot.hidden = s.mode !== "places";
        overlapPlot.hidden = s.mode !== "places";
        classPlot.hidden = s.mode !== "threshold";

        const sweepSpec = (yFn, axis) => ({
          caption: axis,
          columns: [
            { label: "Report", value: "name" },
            { label: "Reporting risk", value: (r) => r.ev.risk, format: (v) => formatRisk(v) },
            { label: axis, value: yFn, format: dec },
          ],
          rows,
        });

        drawOpenSweeps = () => {
          const drawOne = (slot, yFn, axis, baseline) => {
            const sw = plotWidth(slot);
            const smRight = sw < 420 ? 114 : 132;
            const chart = plot(slot, {
              width: sw,
              height: 235,
              marginLeft: 58,
              marginRight: smRight,
              marginTop: 20,
              marginBottom: 42,
              x: {
                label: "Reporting risk (smaller is better)",
                ticks: sw < 420 ? 3 : 5,
                labelAnchor: "center",
                labelArrow: "none",
                domain: [0, Math.max(0.3, ...rows.map((r) => r.ev.risk)) * 1.1],
                insetLeft: 12,
                insetRight: 10,
              },
              y: { label: axis, ticks: 4, labelAnchor: "center", labelArrow: "none", grid: true, insetTop: 12, insetBottom: 12 },
              alt: `${axis} for the same candidate reports, plotted against their reporting risk. Native objective is a separate decision.`,
              table: sweepSpec(yFn, axis),
              marks: (c, P) => [
                P.ruleY([baseline], { stroke: c.plotMuted, strokeDasharray: "4,3" }),
                P.dot(rows, { x: (r) => r.ev.risk, y: yFn, symbol: (r) => (r.key === "optimal" ? "diamond" : "circle"), r: 5.5, fill: c.post, stroke: c.plotBg }),
                P.dot([chosen], { x: (r) => r.ev.risk, y: yFn, r: 9.5, fill: "none", stroke: c.plotFg, strokeWidth: 2 }),
              ],
            });
            appendDirectCandidateLabels(chart, rows, (r) => r.ev.risk, yFn, {
              marginTop: 20,
              marginBottom: 42,
              marginRight: smRight,
              chosenKey: s.report,
              dataNumFn: ctx.dataNum,
            });
          };
          if (s.mode === "places") {
            classPlot.replaceChildren();
            drawOne(valuePlot, (r) => r.allocation.expectedValue, "Expected selected value", m.reports.mean.allocation.expectedValue);
            drawOne(overlapPlot, (r) => r.allocation.expectedOverlap, "Expected top-set overlap", m.reports.top.allocation.expectedOverlap);
          } else {
            valuePlot.replaceChildren();
            overlapPlot.replaceChildren();
            drawOne(classPlot, (r) => r.classification.totalCost, "Expected classification cost", bayes.totalCost);
          }
        };

        if (methodBox.open) {
          drawOpenSweeps();
        } else if (s.mode === "places") {
          classPlot.replaceChildren();
          valuePlot.replaceChildren(hiddenTable(ctx.doc, sweepSpec((r) => r.allocation.expectedValue, "Expected selected value")));
          overlapPlot.replaceChildren(hiddenTable(ctx.doc, sweepSpec((r) => r.allocation.expectedOverlap, "Expected top-set overlap")));
        } else {
          valuePlot.replaceChildren();
          overlapPlot.replaceChildren();
          classPlot.replaceChildren(hiddenTable(ctx.doc, sweepSpec((r) => r.classification.totalCost, "Expected classification cost")));
        }

        // Complete unit table (.op-native-units) and candidate summary table in Data
        const unitTableNode = hiddenTable(ctx.doc, {
          visible: true,
          caption: "Unit-level native decision inputs and actions",
          columns: [
            { label: "Unit", value: "id" },
            { label: "Posterior mean", value: "mean", format: dec },
            { label: "Pr(top budget)", value: "pTop", format: (v) => formatProb(v) },
            { label: "Pr(above threshold)", value: "pAbove", format: (v) => formatProb(v) },
            { label: "Budget inclusion probability", value: "inclusion", format: dec },
            { label: "Native classifier positive", value: (r) => (r.bayes === null ? "NA: costs zero" : r.bayes ? "yes" : "no") },
            { label: "Grade-derived positive", value: (r) => (r.gradePositive === null ? "NA: costs zero" : r.gradePositive ? "yes" : "no") },
          ],
          rows: unitRows,
        });
        unitTableNode.querySelector("table")?.classList.add("prx-sticky-first");
        unitsTableWrap.replaceChildren(unitTableNode);

        const objectiveFirst = (cells) => (s.mode === "places" ? [cells[1], cells[0], ...cells.slice(2)] : [cells.at(-1), ...cells.slice(0, -1)]);
        summary.replaceChildren(
          h(
            "table",
            { class: "op-table prx-sticky-first" },
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", { scope: "col", text: "Candidate report" }),
                ...objectiveFirst([
                  "Risk", "Budget selected value", "Top overlap",
                  ...(s.mode === "threshold" ? ["Positive declarations", "Positive value", "Classification cost"] : []),
                ]).map((text) => h("th", { scope: "col", text })),
              ),
            ),
            h(
              "tbody",
              {},
              ...rows.map((r) => h(
                "tr",
                {},
                h("th", { scope: "row", text: r.name }),
                ...objectiveFirst([
                  [r.ev.risk, formatRisk],
                  [r.allocation.expectedValue, dec],
                  [r.allocation.expectedOverlap, dec],
                  ...(s.mode === "threshold"
                    ? [
                      [r.classification.positiveCount, formatCount],
                      [r.classification.selectedValue, dec],
                      [r.classification.totalCost, dec],
                    ]
                    : []),
                ]).map(([v, f]) => h("td", {}, ctx.num(v, f(v)))),
              )),
            ),
          ),
        );

        // Concise 3-sig-fig primary readout (18–35 words across all 10 presets)
        if (s.mode === "places") {
          ctx.readout.set(
            s.report === "mean"
              ? [
                "At τ = ", ctx.num(s.tau, formatSetting(s.tau)), ", ", names[s.report],
                " (risk ", ctx.num(selected.ev.risk, formatReadoutRisk(selected.ev.risk)),
                ") fills ", ctx.num(s.budget, formatCount(s.budget)), s.budget === 1 ? " place" : " places",
                " with expected value ", ctx.num(selected.allocation.expectedValue, formatReadoutEst(selected.allocation.expectedValue)),
                " and overlap ", ctx.num(selected.allocation.expectedOverlap, formatReadoutExpected(selected.allocation.expectedOverlap)),
                " (top-set order reaches ", ctx.num(m.reports.top.allocation.expectedOverlap, formatReadoutExpected(m.reports.top.allocation.expectedOverlap)), ").",
              ]
              : [
                "At τ = ", ctx.num(s.tau, formatSetting(s.tau)), ", ", names[s.report],
                " (risk ", ctx.num(selected.ev.risk, formatReadoutRisk(selected.ev.risk)),
                ") fills ", ctx.num(s.budget, formatCount(s.budget)), s.budget === 1 ? " place" : " places",
                " with expected value ", ctx.num(selected.allocation.expectedValue, formatReadoutEst(selected.allocation.expectedValue)),
                " and overlap ", ctx.num(selected.allocation.expectedOverlap, formatReadoutExpected(selected.allocation.expectedOverlap)),
                "; mean order gives ", ctx.num(m.reports.mean.allocation.expectedValue, formatReadoutEst(m.reports.mean.allocation.expectedValue)),
                " and ", ctx.num(m.reports.mean.allocation.expectedOverlap, formatReadoutExpected(m.reports.mean.allocation.expectedOverlap)), ".",
              ],
          );
        } else if (s.report === "optimal" && tiedList.length >= 2) {
          ctx.readout.set([
            "Native Bayes declares ", ctx.num(bayes.positiveCount, formatCount(bayes.positiveCount)),
            " positive at cost ", ctx.num(bayes.totalCost, formatReadoutRisk(bayes.totalCost)),
            ". Two equal-risk (", ctx.num(selected.ev.risk, formatReadoutRisk(selected.ev.risk)),
            ") reports declare ", ctx.num(tiedList[0].classification.positiveCount, formatCount(tiedList[0].classification.positiveCount)),
            " vs. ", ctx.num(tiedList[1].classification.positiveCount, formatCount(tiedList[1].classification.positiveCount)),
            " positive (grades ≤ ", ctx.num(s.positiveGrade, formatCount(s.positiveGrade)),
            ") at costs ", ctx.num(tiedList[0].classification.totalCost, formatReadoutRisk(tiedList[0].classification.totalCost)),
            " vs. ", ctx.num(tiedList[1].classification.totalCost, formatReadoutRisk(tiedList[1].classification.totalCost)), ".",
          ]);
        } else {
          ctx.readout.set([
            "Native Bayes classifier declares ", ctx.num(bayes.positiveCount, formatCount(bayes.positiveCount)),
            " positive at cost ", ctx.num(bayes.totalCost, formatReadoutRisk(bayes.totalCost)),
            ". Grades ≤ ", ctx.num(s.positiveGrade, formatCount(s.positiveGrade)),
            " in ", names[s.report],
            " (risk ", ctx.num(selected.ev.risk, formatReadoutRisk(selected.ev.risk)),
            ") declare ", ctx.num(chosen.classification.positiveCount, formatCount(chosen.classification.positiveCount)),
            " positive at cost ", ctx.num(chosen.classification.totalCost, formatReadoutRisk(chosen.classification.totalCost)), ".",
          ]);
        }

        methodNotes.replaceChildren(
          h(
            "p",
            { class: "op-note" },
            s.law === "league"
              ? "League top-set membership and overlap are Monte Carlo estimates on the same draws used to order top-set probabilities; no exact overlap-optimality guarantee is claimed. Posterior means and threshold probabilities are analytic. The reporting optimum searches contiguous cuts of the posterior-mean order with at most three grades; strict comparison orders lie outside that family. "
              : "Finite-law membership and utility quantities are exact. ",
            "Score ties in strict orders follow unit index, whereas an oversized boundary grade uses a uniform subset lottery. Value denotes selected target value, not an intervention effect.",
          ),
        );

        ctx.caption.replaceChildren(
          s.mode === "places"
            ? "Dashed benchmarks mark maximum expected value (mean order) and maximum top-set overlap (top-set order). Posterior: "
            : "Dashed line marks native Bayes threshold cost; grade classification applies the added grade cutoff. Posterior: ",
          captionNode(ctx, "teaching-posterior"),
          ".",
        );
      }

      return { render };
    },
  });
}
