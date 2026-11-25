import { createWidget } from '../shared/base.js';
import { gradeColors, palette, placeDirectLabels, plot, svgScene } from '../shared/chart.js';
import {
  formatCount,
  formatDecimal,
  formatDistinguishing,
  formatReadoutRisk,
  formatRisk,
  formatSetting,
  formatShare,
  formatSizes,
} from '../shared/format.js';
import { captionNode } from '../shared/labels.js';
import { readKrwModel, cardAt, gridRows, appendKrwNotice } from '../shared/krw-model.js';
import { disclosure, evaluateReport, reportInformation, tierGrades } from '../pr-core.js';

const CSS = `
.prx-widget.prx-dq[data-prx-frame="v2"] .prx-title {
  margin: 0 0 0.3rem;
}
.prx-widget.prx-dq[data-prx-frame="v2"] .prx-toolbar {
  margin-bottom: 0.35rem;
}
.prx-widget.prx-dq[data-prx-frame="v2"] > .prx-readout {
  margin-bottom: 0.45rem;
}
.prx-widget.prx-dq[data-prx-frame="v2"] > .prx-disclosures {
  margin-top: 0.45rem;
}
.prx-dq .dq-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
  align-items: start;
  min-width: 0;
}
@media (min-width: 52em) {
  .prx-dq .dq-stage-grid {
    grid-template-columns: minmax(0, 1.28fr) minmax(0, 1fr);
    gap: 0.9rem;
  }
}
.prx-dq .dq-panel {
  min-width: 0;
  max-width: 100%;
}
.prx-dq .dq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 0.75rem;
  margin-top: 0.65rem;
  min-width: 0;
}
.prx-dq .dq-box {
  border: 1px solid var(--prx-border);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
  background: var(--prx-bg);
  color: var(--prx-fg);
  min-width: 0;
}
.prx-dq .dq-box h4 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  color: var(--prx-fg-heading);
}
.prx-dq .dq-box p {
  margin: 0.3rem 0;
}
.prx-dq .dq-note {
  font-size: 0.875rem;
  color: var(--prx-fg-muted);
  margin: 0.35rem 0;
}
.prx-dq .dq-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.35rem 0;
}
.prx-dq .dq-pill {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.12rem 0.45rem;
  font-size: 0.84375rem;
  line-height: 1.3;
  background: var(--prx-bg-raised);
  color: var(--prx-fg);
  border: 1px solid var(--prx-border-strong);
  border-left-width: 4px;
  border-radius: 5px;
}
.prx-dq .dq-pill-g {
  font-weight: 700;
}
.prx-dq .dq-size-strip {
  display: flex;
  height: 0.6rem;
  margin: 0.35rem 0;
  gap: 1px;
}
.prx-dq .dq-size-strip span {
  min-width: 1px;
  background: var(--prx-post);
  flex-basis: 0;
}
.prx-dq .dq-size-strip span:nth-child(even) {
  opacity: 0.6;
}
.prx-dq .dq-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.prx-dq .dq-table {
  width: 100%;
  min-width: 24rem;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.prx-dq .dq-table th,
.prx-dq .dq-table td {
  padding: 0.35rem 0.5rem;
  text-align: right;
  border-bottom: 1px solid var(--prx-border);
}
.prx-dq .dq-table th:first-child {
  text-align: left;
}
.prx-dq [data-prx-readout$="-sizes"] {
  white-space: normal;
  overflow-wrap: anywhere;
}
.prx-dq .dq-chosen {
  outline: 2px solid var(--prx-accent);
  outline-offset: -2px;
}
@media (max-width: 40em) {
  .prx-widget.prx-dq[data-prx-frame="v2"] {
    padding: 0.45rem 0.5rem;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.25rem 0.45rem;
    margin-bottom: 0.3rem;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    gap: 0.25rem 0.45rem;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-presets {
    width: 100%;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    font-size: 0.78rem;
    margin-bottom: 0.1rem;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.12rem 0.38rem;
    font-size: 0.76rem;
    line-height: 1.15;
  }
  .prx-widget.prx-dq[data-prx-frame="v2"] > .prx-readout {
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.35rem;
    font-size: 0.875rem;
    line-height: 1.28;
  }
  .prx-dq .prx-stage {
    padding: 0.45rem 0.55rem;
  }
}
`;

const tiers = new Map();

export function quantileReport(model, G) {
  const key = `${model.criterion}:${G}`;
  if (!tiers.has(key)) {
    const grade = Array.from(tierGrades(model.mean, G));
    const d = disclosure(grade);
    const ev = evaluateReport(grade, model.E, { tau: 0.5 });
    tiers.set(key, {
      G,
      grade,
      d,
      ev,
      DR: ev.EoverM[0],
      information: reportInformation(grade, model.E),
      label: G === 4 ? 'Quartiles' : 'Deciles',
    });
  }
  return tiers.get(key);
}

const betterThan = (r, tier) => r.DR < tier.DR && r.information > tier.information;

function betterRuns(rows, tier) {
  const runs = [];
  let run = [];
  for (const row of rows) {
    if (betterThan(row, tier)) run.push(row);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

function renderGradePills(ctx, grade, pal) {
  const { h } = ctx;
  const G = Math.max(...grade);
  const colors = gradeColors(G, pal);
  const items = [];
  for (let g = 1; g <= G; g += 1) {
    let count = 0;
    for (let i = 0; i < grade.length; i += 1) if (grade[i] === g) count += 1;
    items.push(
      h(
        'span',
        { class: 'dq-pill', style: { 'border-left-color': colors[g - 1] } },
        h('span', { class: 'dq-pill-g' }, 'G', ctx.num(g, formatCount(g))),
        h('span', {}, ctx.num(count, formatCount(count)), count === 1 ? ' firm' : ' firms'),
      ),
    );
  }
  return h('div', { class: 'dq-pills', 'aria-hidden': 'true' }, ...items);
}

function drawFrontierStage(ctx, slot, rows, all, q, card, runs) {
  const data = rows.map(r => ({
    x: r.DR,
    y: r.information,
    label: `KRW grid λ${formatSetting(r.lambda)}`,
    lambda: r.lambda,
  }));
  const tier = all.map(r => ({ x: r.DR, y: r.information, label: r.label, G: r.G }));
  const cur = { x: card.DR, y: card.information };
  const maxX = Math.max(0.25, ...data.map(d => d.x), ...tier.map(d => d.x)) * 1.07;
  const maxY = Math.max(0.5, ...data.map(d => d.y), ...tier.map(d => d.y)) * 1.08;
  const table = [...data, ...tier];
  const title = d => `${d.label}: DR ${formatDecimal(d.x, { digits: 4 })}, I ${formatDecimal(d.y, { digits: 4 })}`;
  const region = { x: q.DR, y: q.information };
  const better = runs.flatMap((run, segment) => run.map(r => ({ x: r.DR, y: r.information, segment })));

  const width = Math.max(240, Math.round(slot.clientWidth || (ctx.width() > 832 ? ctx.width() * 0.54 : ctx.width())));
  const narrow = ctx.width() < 740;
  const height = narrow ? 180 : 375;
  const marginTop = 18;
  const marginBottom = 40;
  const marginLeft = 48;
  const marginRight = 16;

  const fig = plot(slot, {
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    alt:
      'Archived KRW grid reports on two axes: expected wrong directions per pair horizontally and posterior informativeness vertically; fixed posterior-mean tiers are overlaid. The shaded region is strictly better than the selected tier on both axes.',
    table: {
      caption: 'The same released law evaluates every plotted report',
      columns: [
        { label: 'Report', value: 'label' },
        { label: 'DR=E/M', value: 'x', format: v => formatDecimal(v, { digits: 4 }) },
        { label: 'I(g,θ)', value: 'y', format: v => formatDecimal(v, { digits: 4 }) },
      ],
      rows: table,
    },
    x: {
      domain: [0, maxX],
      ticks: narrow ? [0, 0.08, 0.16, 0.24] : [0, 0.05, 0.1, 0.15, 0.2, 0.25],
      label: 'DR = E/M (smaller is better)',
      labelAnchor: 'center',
      labelArrow: 'none',
    },
    y: {
      domain: [Math.min(0, ...data.map(d => d.y)), maxY],
      ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
      label: 'I(g, θ) (larger is better)',
      labelArrow: 'none',
      grid: true,
    },
    keyboard: { data: table, x: 'x', y: 'y', sort: false, pointer: true, label: 'Read KRW grid and fixed-tier points', title },
    marks: (c, P) => [
      P.rect([region], { x1: () => 0, x2: 'x', y1: 'y', y2: () => maxY, fill: c.est, fillOpacity: 0.13 }),
      P.ruleX([region], { x: 'x', y1: 'y', y2: () => maxY, stroke: c.est, strokeDasharray: '4,3' }),
      P.ruleY([region], { y: 'y', x1: () => 0, x2: 'x', stroke: c.est, strokeDasharray: '4,3' }),
      P.ruleY([0], { stroke: c.plotAxis }),
      P.ruleX([0], { stroke: c.plotAxis }),
      P.line(data, { x: 'x', y: 'y', stroke: c.plotFg, strokeWidth: 1.5 }),
      P.dot(data, { x: 'x', y: 'y', r: 1.9, fill: c.plotFg }),
      P.line(better, { x: 'x', y: 'y', z: 'segment', stroke: c.est, strokeWidth: 2.8 }),
      P.dot(better, { x: 'x', y: 'y', r: 2.8, fill: c.est }),
      P.dot(
        tier.filter(d => d.G !== q.G),
        { x: 'x', y: 'y', symbol: 'diamond', r: 5.5, fill: c.plotBg, stroke: c.est, strokeWidth: 2 },
      ),
      P.dot(
        tier.filter(d => d.G === q.G),
        { x: 'x', y: 'y', symbol: 'diamond', r: 7, fill: c.est, stroke: c.plotBg, strokeWidth: 1.5 },
      ),
      P.dot([cur], { x: 'x', y: 'y', r: 8, fill: 'none', stroke: c.plotFg, strokeWidth: 2.2 }),
    ],
  });

  // Collision-free 13px direct labels with plotBg backing rects (WA-02, WB-03)
  const { svg, palette: ink } = fig;
  const sx = fig.scale('x');
  const sy = fig.scale('y');
  const doc = svg.ownerDocument;
  const ns = svg.namespaceURI;
  const q4 = all.find(r => r.G === 4);
  const q10 = all.find(r => r.G === 10);
  const cardDrText = formatReadoutRisk(card.DR);
  const cardIText = formatReadoutRisk(card.information);
  const cardPlain = `DR ${cardDrText} · I ${cardIText}`;

  const rawItems = [
    {
      id: 'quartiles',
      text: 'Quartiles',
      px: sx.apply(q4.DR),
      py: sy.apply(q4.information),
      y: sy.apply(q4.information) + 16,
      stroke: ink.est,
      bold: q.G === 4,
    },
    {
      id: 'deciles',
      text: 'Deciles',
      px: sx.apply(q10.DR),
      py: sy.apply(q10.information),
      y: sy.apply(q10.information) - 18,
      stroke: ink.est,
      bold: q.G === 10,
    },
    {
      id: 'card',
      text: cardPlain,
      isCard: true,
      px: sx.apply(card.DR),
      py: sy.apply(card.information),
      y: sy.apply(card.information) - (card.DR > 0.12 ? 22 : -22),
      stroke: ink.plotAxis,
      bold: true,
    },
  ];

  const placed = placeDirectLabels(rawItems, {
    minGapPx: 22,
    bounds: [marginTop + 12, height - marginBottom - 14],
  });
  const byId = new Map(placed.map(p => [p.id, p]));

  const layer = doc.createElementNS(ns, 'g');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('pointer-events', 'none');

  for (const item of rawItems) {
    const p = byId.get(item.id) ?? item;
    const estW = Math.round(item.text.length * 7.3 + 12);
    const pillH = 18;
    const placeLeft = item.px - 12 - estW >= marginLeft + 6 || item.px > width - marginRight - estW - 10;
    const minLeft = marginLeft + 6;
    const maxRight = width - marginRight - 4;
    let boxLeft = placeLeft ? item.px - 12 - estW : item.px + 12;
    boxLeft = Math.max(minLeft, Math.min(maxRight - estW, boxLeft));
    const boxRight = boxLeft + estW;
    const cy = p.y;

    const nearX = item.px < boxLeft ? boxLeft : item.px > boxRight ? boxRight : item.px;
    const nearY = Math.max(cy - pillH / 2, Math.min(cy + pillH / 2, item.py));
    if (Math.hypot(nearX - item.px, nearY - item.py) > 5) {
      const line = doc.createElementNS(ns, 'line');
      line.setAttribute('x1', String(item.px.toFixed(1)));
      line.setAttribute('y1', String(item.py.toFixed(1)));
      line.setAttribute('x2', String(nearX.toFixed(1)));
      line.setAttribute('y2', String(nearY.toFixed(1)));
      line.setAttribute('stroke', item.stroke);
      line.setAttribute('stroke-width', '1.1');
      line.setAttribute('stroke-opacity', '0.75');
      layer.append(line);
    }

    const rect = doc.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(boxLeft.toFixed(1)));
    rect.setAttribute('y', String((cy - pillH / 2).toFixed(1)));
    rect.setAttribute('width', String(estW));
    rect.setAttribute('height', String(pillH));
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', ink.plotBg);
    rect.setAttribute('stroke', item.stroke);
    rect.setAttribute('stroke-width', item.bold ? '1.3' : '0.9');

    const text = doc.createElementNS(ns, 'text');
    text.setAttribute('x', String((boxLeft + estW / 2).toFixed(1)));
    text.setAttribute('y', String((cy + 4.3).toFixed(1)));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', item.bold ? '700' : '600');
    text.setAttribute('fill', ink.plotFg);

    if (item.isCard) {
      for (const [name, word, value, disp] of [
        ['DR', 'DR', card.DR, cardDrText],
        ['I', 'I', card.information, cardIText],
      ]) {
        const tspan = doc.createElementNS(ns, 'tspan');
        tspan.dataset.prxReadout = `ring-${name}`;
        tspan.dataset.num = String(value);
        tspan.textContent = disp;
        text.append(name === 'DR' ? `${word} ` : ` · ${word} `, tspan);
      }
    } else {
      text.textContent = item.text;
    }
    layer.append(rect, text);
  }
  svg.append(layer);
  return fig;
}

function drawMetricTracks(ctx, slot, all, q, card) {
  const q4 = all.find(r => r.G === 4);
  const q10 = all.find(r => r.G === 10);
  const cardEN = card.ev.EoverN[0];
  const width = Math.max(240, Math.round(slot.clientWidth || (ctx.width() > 832 ? ctx.width() * 0.42 : ctx.width())));
  const narrow = ctx.width() < 740;
  const height = narrow ? 140 : 375;

  const tracks = [
    {
      key: 'DR',
      title: 'DR (← lower)',
      betterDir: -1,
      q4Val: q4.DR,
      q10Val: q10.DR,
      cardVal: card.DR,
      qVal: q.DR,
      fmt: formatReadoutRisk,
    },
    {
      key: 'EN',
      title: 'E/N (← lower)',
      betterDir: -1,
      q4Val: q4.ev.EoverN[0],
      q10Val: q10.ev.EoverN[0],
      cardVal: cardEN,
      qVal: q.ev.EoverN[0],
      fmt: formatShare,
    },
    {
      key: 'I',
      title: 'I(g, θ) (higher →)',
      betterDir: 1,
      q4Val: q4.information,
      q10Val: q10.information,
      cardVal: card.information,
      qVal: q.information,
      fmt: formatReadoutRisk,
    },
  ];

  svgScene(
    slot,
    {
      width,
      height,
      margin: { top: 8, right: 12, bottom: 8, left: 12 },
      alt: 'Zoomed horizontal comparison of DR, stated-pair error share E/N, and information I across Quartiles, Deciles, and the selected archived KRW card.',
    },
    scene => {
      const { el, palette: pal } = scene;
      const padL = 10;
      const padR = width - 10;
      const trackW = Math.max(80, padR - padL);

      // Legend header row
      const legY = 15;
      scene.add(
        el('polygon', { points: `${padL},${legY - 4} ${padL + 5},${legY - 9} ${padL + 10},${legY - 4} ${padL + 5},${legY + 1}`, fill: pal.est }),
        el('text', { x: padL + 14, y: legY, fontSize: 13, fontWeight: 600, fill: pal.plotFg, text: q.label }),
        el('polygon', {
          points: `${padL + 88},${legY - 4} ${padL + 93},${legY - 9} ${padL + 98},${legY - 4} ${padL + 93},${legY + 1}`,
          fill: pal.plotBg,
          stroke: pal.est,
          strokeWidth: 1.8,
        }),
        el('text', { x: padL + 102, y: legY, fontSize: 13, fill: pal.plotMuted, text: q.G === 4 ? 'Deciles' : 'Quartiles' }),
        el('circle', { cx: padL + 178, cy: legY - 4, r: 5.5, fill: 'none', stroke: pal.plotFg, strokeWidth: 2 }),
        el('text', { x: padL + 188, y: legY, fontSize: 13, fontWeight: 700, fill: pal.plotFg }, 'Card λ ', el('tspan', { 'data-num': String(card.lambda), text: formatSetting(card.lambda) })),
      );

      const startY = narrow ? 35 : 64;
      const stepY = narrow ? 39 : 104;

      tracks.forEach((tr, idx) => {
        const headerY = startY + idx * stepY;
        const lineY = headerY + (narrow ? 14 : 30);
        const vals = [tr.q4Val, tr.q10Val, ...(typeof tr.cardVal === 'number' && Number.isFinite(tr.cardVal) ? [tr.cardVal] : [])];
        const rawMin = Math.min(...vals);
        const rawMax = Math.max(...vals);
        const span = Math.max(0.016, rawMax - rawMin);
        const lo = tr.betterDir < 0 ? Math.max(0, rawMin - span * 0.22) : Math.max(0, rawMin - span * 0.18);
        const hi = rawMax + span * 0.22;
        const xOf = v => padL + ((v - lo) / Math.max(1e-6, hi - lo)) * trackW;

        const qX = xOf(tr.qVal);
        const shadeX1 = tr.betterDir < 0 ? padL : qX;
        const shadeX2 = tr.betterDir < 0 ? qX : padR;

        // Track title (left) and exact 3-sig-fig comparison summary (right)
        const rightSummary = el(
          'text',
          { x: padR, y: headerY, textAnchor: 'end', fontSize: 13, fill: pal.plotFg },
          `${q.G === 4 ? 'Q' : 'D'} `,
          el('tspan', { 'data-num': String(tr.qVal), fontWeight: '600', text: tr.fmt(tr.qVal) }),
          ' · Card ',
          typeof tr.cardVal === 'number' && Number.isFinite(tr.cardVal)
            ? el('tspan', { 'data-num': String(tr.cardVal), fontWeight: '700', text: tr.fmt(tr.cardVal) })
            : el('tspan', { 'data-num': 'NA', fontWeight: '600', text: 'NA' }),
        );

        scene.add(
          el('text', { x: padL, y: headerY, fontSize: 13, fontWeight: 700, fill: pal.plotFg, text: tr.title }),
          rightSummary,
          el('rect', {
            x: shadeX1,
            y: lineY - 8,
            width: Math.max(0, shadeX2 - shadeX1),
            height: 16,
            rx: 3,
            fill: pal.est,
            fillOpacity: 0.13,
          }),
          el('line', { x1: padL, y1: lineY, x2: padR, y2: lineY, stroke: pal.plotAxis, strokeWidth: 1.4 }),
          el('line', { x1: qX, y1: lineY - 9, x2: qX, y2: lineY + 9, stroke: pal.est, strokeWidth: 1.5, strokeDasharray: '3,2' }),
        );

        const otherVal = q.G === 4 ? tr.q10Val : tr.q4Val;
        const ox = xOf(otherVal);
        scene.add(
          el('polygon', {
            points: `${ox - 5.5},${lineY} ${ox},${lineY - 5.5} ${ox + 5.5},${lineY} ${ox},${lineY + 5.5}`,
            fill: pal.plotBg,
            stroke: pal.est,
            strokeWidth: 1.8,
          }),
          el('polygon', {
            points: `${qX - 6.5},${lineY} ${qX},${lineY - 6.5} ${qX + 6.5},${lineY} ${qX},${lineY + 6.5}`,
            fill: pal.est,
            stroke: pal.plotBg,
            strokeWidth: 1.4,
          }),
        );

        if (typeof tr.cardVal === 'number' && Number.isFinite(tr.cardVal)) {
          const cx = xOf(tr.cardVal);
          scene.add(
            el('circle', { cx, cy: lineY, r: 7.5, fill: 'none', stroke: pal.plotBg, strokeWidth: 3.4 }),
            el('circle', { cx, cy: lineY, r: 7.5, fill: 'none', stroke: pal.plotFg, strokeWidth: 2.2 }),
          );
        }
      });
    },
  );
}

function drawNear(ctx, slot, rows, tier, selected) {
  const x = [Math.max(0, tier.DR - 0.012), tier.DR + 0.012];
  const y = [tier.information - 0.05, tier.information + 0.05];
  const inside = r => r.DR >= x[0] && r.DR <= x[1] && r.information >= y[0] && r.information <= y[1];
  const nearby = rows.filter(inside);
  const width = Math.max(240, Math.round(slot.clientWidth || ctx.width() - 32));
  plot(slot, {
    width,
    height: 220,
    marginLeft: 54,
    marginRight: 20,
    marginTop: 14,
    marginBottom: 42,
    alt: 'Magnified view of the released reports near the selected quantile tiers. The diamond is the tier report and shading marks lower DR and higher I.',
    x: { domain: x, ticks: 4, label: 'DR = E/M', labelArrow: 'none' },
    y: { domain: y, ticks: 5, label: 'I(g, θ)', labelArrow: 'none', grid: true },
    marks: (c, P) => [
      P.rect([tier], { x1: () => x[0], x2: 'DR', y1: 'information', y2: () => y[1], fill: c.est, fillOpacity: 0.12 }),
      P.ruleX([tier], { x: 'DR', y1: 'information', y2: () => y[1], stroke: c.est, strokeDasharray: '4,3' }),
      P.ruleY([tier], { y: 'information', x1: () => x[0], x2: 'DR', stroke: c.est, strokeDasharray: '4,3' }),
      P.dot(nearby, { x: 'DR', y: 'information', fill: r => (betterThan(r, tier) ? c.est : c.plotFg), r: 3.2 }),
      P.dot([tier], { x: 'DR', y: 'information', symbol: 'diamond', fill: c.est, stroke: c.plotBg, r: 6.5 }),
      P.dot(inside(selected) ? [selected] : [], { x: 'DR', y: 'information', fill: 'none', stroke: c.plotFg, strokeWidth: 2, r: 7.5 }),
    ],
  });
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: 'deciles-quartiles',
    frame: 'v2',
    className: 'prx-dq',
    css: CSS,
    label: 'Deciles and quartiles on KRW’s reporting axes',
    title: 'Fixed quantile tiers beside archived KRW cards',
    keys: {
      criterion: { type: 'choice', values: ['race', 'gender'], value: 'race' },
      G: { type: 'choice', values: [4, 10], value: 4 },
      lambda: { type: 'number', min: 0, max: 1, step: 0.01, value: 0.6 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, value, format = formatDecimal) => {
        const node = ctx.num(value, format(value));
        node.dataset.prxReadout = name;
        return node;
      };

      const target = ctx.segmented({
        label: 'Target',
        name: 'criterion',
        value: ctx.state.criterion,
        options: [
          { value: 'race', label: 'Race', title: 'White-name contact advantage' },
          { value: 'gender', label: 'Gender', title: 'Male-name contact advantage' },
        ],
        onChange: v => ctx.set({ criterion: v }),
      });
      const G = ctx.segmented({
        label: 'Fixed tiers',
        name: 'G',
        value: ctx.state.G,
        options: [
          { value: 4, label: ['Quartiles (', ctx.num(4, formatCount(4)), ')'] },
          { value: 10, label: ['Deciles (', ctx.num(10, formatCount(10)), ')'] },
        ],
        onChange: v => ctx.set({ G: Number(v) }),
      });
      const lambda = ctx.slider({
        label: 'Archived card λ',
        name: 'lambda',
        min: 0,
        max: 1,
        step: 0.01,
        value: ctx.state.lambda,
        onInput: v => ctx.set({ lambda: v }),
      });
      ctx.controls.append(target.root, G.root, ctx.primaryControl(lambda.root));

      const chartSlot = h('div', { class: 'dq-panel' });
      const compSlot = h('div', { class: 'dq-panel' });
      const stageGrid = h('div', { class: 'dq-stage-grid' }, chartSlot, compSlot);
      ctx.stage.append(stageGrid);

      const dataBox = ctx.dataBox('Data, tier breakdown and comparison table');
      const tableWrap = ctx.scrollRegion(
        h('div', { class: 'dq-scroll' }),
        'Compare both quantile rules and the selected archived card',
      );
      const detail = h('div', { class: 'dq-grid' });
      dataBox.body.append(tableWrap, detail);

      const methodBox = ctx.methodBox('Method and definitions');
      const methodProse = h('div');
      const nearPlot = h('div');
      methodBox.body.append(
        methodProse,
        nearPlot,
        h('p', { class: 'dq-note', text: 'Magnified window near the selected tier: dots mark released grid reports and the ring appears when the selected λ falls inside this window.' }),
      );

      appendKrwNotice(ctx);

      function numbers(r, prefix, ev = r.ev) {
        return h(
          'p',
          {},
          'N ',
          ro(`${prefix}-N`, r.d.N, formatCount),
          ' of ',
          ro(`${prefix}-M`, r.d.M, formatCount),
          '; DR ',
          ro(`${prefix}-DR`, r.DR, v => formatDecimal(v, { digits: 4 })),
          '; I ',
          ro(`${prefix}-I`, r.information, v => formatDecimal(v, { digits: 4 })),
          '; E/N ',
          ro(`${prefix}-EoverN`, ev.EoverN[0], formatShare),
          '.',
        );
      }

      let lastNear = null;

      function render(s, info) {
        if (info?.reason === 'disclosure') {
          if (methodBox.open && lastNear) {
            drawNear(ctx, nearPlot, lastNear.rows, lastNear.q, lastNear.card);
          }
          return;
        }

        target.set(s.criterion);
        G.set(s.G);
        lambda.set(s.lambda);

        const model = readKrwModel(s.criterion);
        const rows = gridRows(model);
        const all = [quantileReport(model, 4), quantileReport(model, 10)];
        const q = all.find(r => r.G === s.G) ?? all[0];
        const card = cardAt(model, s.lambda);
        const pal = palette(ctx.root);
        const runs = betterRuns(rows, q);
        lastNear = { rows, q, card };

        drawFrontierStage(ctx, chartSlot, rows, all, q, card, runs);
        drawMetricTracks(ctx, compSlot, all, q, card);
        if (methodBox.open) drawNear(ctx, nearPlot, rows, q, card);

        const qev = evaluateReport(q.grade, model.E, { tau: card.tau === 0 ? 0.5 : card.tau });
        const orientation = `Grade 1 = stated highest on ${s.criterion === 'race' ? 'white-name' : 'male-name'} contact advantage, as the posterior judges it.`;

        const quantileBox = h(
          'section',
          { class: 'dq-box' },
          h('h4', {}, q.label, ' of posterior means'),
          renderGradePills(ctx, q.grade, pal),
          h('p', { class: 'dq-note', text: orientation }),
          h('p', {}, 'Tier ', ro('tier-sizes', q.d.sizes, formatSizes), '.'),
          numbers(q, 'tier'),
          h('p', { class: 'dq-note' }, captionNode(ctx, 'fixed-tiers'), '. Constructed comparison rule; exact score ties stay together.'),
        );

        const pills = renderGradePills(ctx, card.grade, pal);
        const gradeDetail =
          card.d.G > 12
            ? h(
                'div',
                {},
                h(
                  'div',
                  { class: 'dq-size-strip', 'aria-hidden': 'true' },
                  ...card.d.sizes.map(size => h('span', { style: `flex-grow:${size}` })),
                ),
                h('details', { open: detail.querySelector('details')?.open ?? false }, h('summary', {}, 'All grade groups'), pills),
              )
            : pills;

        const cardBox = h(
          'section',
          { class: 'dq-box' },
          h('h4', {}, 'Archived card at λ ', ro('lambda', card.lambda, formatSetting)),
          gradeDetail,
          h('p', { class: 'dq-note', text: orientation }),
          h('p', {}, 'Grade ', ro('card-sizes', card.d.sizes, formatSizes), '.'),
          numbers(card, 'card'),
          h('p', { class: 'dq-note' }, captionNode(ctx, 'krw-card'), '. ', captionNode(ctx, 'fixed-report'), '.'),
        );

        if (card.tau > 0) {
          quantileBox.append(
            h('p', {}, 'Risk at τ ', ro('tau', card.tau, v => formatDecimal(v, { digits: 4 })), ': ', ro('tier-risk', qev.risk, formatRisk), '.'),
          );
          cardBox.append(h('p', {}, 'Risk at the same τ: ', ro('card-risk', card.ev.risk, formatRisk), '.'));
        } else {
          cardBox.append(h('p', { class: 'dq-note' }, 'λ zero is an axes endpoint. postrank risk is undefined at τ zero.'));
        }
        detail.replaceChildren(quantileBox, cardBox);

        const tableRows = [
          ...all.map(r => ({ ...r, name: r.label, selected: r.G === s.G })),
          { ...card, name: 'Selected archived card', selected: false },
        ];
        tableWrap.replaceChildren(
          h(
            'table',
            { class: 'dq-table prx-sticky-first' },
            h(
              'thead',
              {},
              h('tr', {}, ...['Report', 'Stated pairs N', 'DR', 'I(g, θ)', 'E/N'].map(t => h('th', { scope: 'col', text: t }))),
            ),
            h(
              'tbody',
              {},
              ...tableRows.map(r =>
                h(
                  'tr',
                  { class: r.selected ? 'dq-chosen' : null },
                  h('th', { scope: 'row', text: r.name }),
                  ...[
                    [r.d.N, formatCount],
                    [r.DR, v => formatDecimal(v, { digits: 4 })],
                    [r.information, v => formatDecimal(v, { digits: 4 })],
                    [r.ev.EoverN[0], formatShare],
                  ].map(([v, f]) => h('td', {}, ctx.num(v, f(v)))),
                ),
              ),
            ),
          ),
        );

        methodProse.replaceChildren(
          h(
            'p',
            { class: 'dq-note' },
            'Diamonds mark posterior-mean quantile tiers; the ring marks the selected archived card along λ (where τ = λ/(',
            ctx.num(1, formatCount(1)),
            ' + λ)). Smaller discordance DR = E/M and larger posterior informativeness I(g, θ) (written τ̄ by KRW) are preferred; shading marks where both improve on the selected tier. Lines join released grid reports and do not claim a continuous frontier. All reports are evaluated on the same released ',
            s.criterion === 'race' ? 'white-name' : 'male-name',
            ' contact-gap pair probabilities; grid cards were selected under archived probabilities without a new optimality search, and no sign change or absolute-value transformation is applied.',
          ),
        );

        const qDrDisp = formatDistinguishing(q.DR, card.DR, { minSig: 3, maxSig: 6 });
        const cDrDisp = formatDistinguishing(card.DR, q.DR, { minSig: 3, maxSig: 6 });
        const qIDisp = formatDistinguishing(q.information, card.information, { minSig: 3, maxSig: 6 });
        const cIDisp = formatDistinguishing(card.information, q.information, { minSig: 3, maxSig: 6 });
        const gridValue = v => ctx.num(v, formatSetting(v));
        const windowNodes = runs.flatMap((run, i) => [
          ...(i ? [', '] : []),
          gridValue(run[0].lambda),
          ...(run.length > 1 ? ['–', gridValue(run.at(-1).lambda)] : []),
        ]);

        ctx.readout.set([
          q.label,
          ': DR ',
          ctx.num(q.DR, qDrDisp),
          ', I ',
          ctx.num(q.information, qIDisp),
          '. Card λ ',
          gridValue(card.lambda),
          ': DR ',
          ctx.num(card.DR, cDrDisp),
          ', I ',
          ctx.num(card.information, cIDisp),
          betterThan(card, q)
            ? [' (beats both; λ ', ...windowNodes, ' improve both).']
            : runs.length
              ? [' (does not beat both; λ ', ...windowNodes, ' do).']
              : ' (no released λ improves both).',
        ]);
      }

      return { render };
    },
  });
}
