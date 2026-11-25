import { createWidget } from '../shared/base.js';
import { plot, svgScene } from '../shared/chart.js';
import {
  formatCount,
  formatDecimal,
  formatProb,
  formatReadoutProb,
  formatReadoutRisk,
  formatSetting,
} from '../shared/format.js';
import { captionNode, plural } from '../shared/labels.js';
import {
  readKrwModel,
  cardAt,
  blockOrder,
  keyOrder,
  drawKrwHeat,
  heatCounts,
  thresholdAt,
  appendKrwNotice,
} from '../shared/krw-model.js';

const CSS = `
.prx-widget.prx-nt[data-prx-frame="v2"] .prx-title {
  margin: 0 0 0.25rem;
}
.prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar {
  margin-bottom: 0.35rem;
}
.prx-widget.prx-nt[data-prx-frame="v2"] > .prx-readout {
  margin-bottom: 0.4rem;
}
.prx-widget.prx-nt[data-prx-frame="v2"] > .prx-disclosures {
  margin-top: 0.4rem;
}
.prx-nt .nt-stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.35rem;
  align-items: start;
  min-width: 0;
}
@media (min-width: 52em) {
  .prx-widget.prx-nt[data-prx-frame="v2"] {
    padding: 0.5rem 0.65rem 0.45rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.25rem 0.55rem;
    margin-bottom: 0.25rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.25rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.14rem 0.44rem;
    font-size: 0.8125rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] > .prx-readout {
    padding: 0.28rem 0.6rem;
    margin-bottom: 0.3rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.3rem;
    gap: 0.35rem;
  }
  .prx-nt .prx-stage {
    padding: 0.4rem 0.5rem;
  }
  .prx-nt .nt-stage-grid {
    grid-template-columns: minmax(0, 465px) minmax(0, 1fr);
    gap: 0.55rem;
  }
}
.prx-nt .nt-map-col,
.prx-nt .nt-side-col {
  min-width: 0;
  max-width: 100%;
}
.prx-nt .nt-map {
  width: 100%;
  max-width: 465px;
  margin: 0 auto;
}
.prx-nt .nt-triple-fig {
  min-width: 0;
  max-width: 100%;
}
.prx-nt .prx-stage .nt-callout {
  margin: 0.3rem 0 0;
  font-size: 0.84375rem;
  line-height: 1.35;
  color: var(--prx-plot-fg);
}
.prx-nt .prx-stage .nt-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.18rem 0.4rem;
  font-size: 0.8125rem;
  line-height: 1.25;
  padding: 0.25rem 0.1rem 0;
  color: var(--prx-plot-fg);
}
.prx-nt .prx-stage .nt-legend > span:first-child {
  flex-basis: 100%;
  font-weight: 600;
}
.prx-nt .krw-map-key {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
}
.prx-nt .krw-map-swatch {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border: 1px solid var(--prx-cell-border);
  border-radius: 2px;
}
.prx-nt .nt-note {
  font-size: 0.875rem;
  color: var(--prx-fg-muted);
  margin: 0.35rem 0;
}
.prx-nt .nt-heading {
  margin: 0.55rem 0 0.3rem;
  font-size: 0.95rem;
}
.prx-nt .nt-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.9rem;
  margin: 0.25rem 0 0.55rem;
  font-size: 0.875rem;
}
.prx-nt .nt-proof {
  border-left: 3px solid var(--prx-accent);
  padding: 0.3rem 0.6rem;
  margin: 0.45rem 0;
}
.prx-nt .nt-proof p {
  margin: 0.25rem 0;
}
.prx-nt .nt-pair-scroll {
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
}
.prx-nt .nt-table {
  width: 100%;
  min-width: 27rem;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.prx-nt .nt-table th,
.prx-nt .nt-table td {
  min-width: 5.5rem;
  padding: 0.38rem 0.45rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--prx-border);
  overflow-wrap: anywhere;
}
.prx-nt .nt-table th[scope="row"] {
  width: 7.5rem;
  max-width: 8.5rem;
}
@media (max-width: 40em) {
  .prx-widget.prx-nt[data-prx-frame="v2"] {
    padding: 0.38rem 0.45rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-title {
    margin: 0 0 0.15rem;
    font-size: 0.95rem;
    line-height: 1.22;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar {
    gap: 0.2rem 0.42rem;
    margin-bottom: 0.22rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar > .prx-controls {
    flex-wrap: nowrap;
    gap: 0.45rem;
    width: 100%;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-seg {
    padding: 0.15rem 0.45rem;
    font-size: 0.8125rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar > .prx-controls .prx-slider {
    flex: 1 1 8.5rem;
    min-width: 7.5rem;
    max-width: none;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-presets > .prx-seg-label {
    font-size: 0.76rem;
    margin-bottom: 0.08rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-presets .prx-seg-buttons {
    gap: 0.16rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-presets .prx-seg {
    padding: 0.08rem 0.28rem;
    font-size: 0.76rem;
    line-height: 1.12;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-toolbar > .prx-disclosure > summary {
    padding: 0.06rem 0;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] > .prx-readout {
    padding: 0.2rem 0.42rem;
    margin-bottom: 0.22rem;
    font-size: 0.85rem;
    line-height: 1.24;
  }
  .prx-nt .prx-stage {
    padding: 0.28rem 0.38rem;
  }
  .prx-nt .nt-stage-grid {
    gap: 0.22rem;
  }
  .prx-nt .nt-map {
    max-width: 176px;
  }
  .prx-nt .prx-stage .nt-legend {
    font-size: 0.75rem;
    gap: 0.1rem 0.28rem;
    padding-top: 0.15rem;
  }
  .prx-nt .krw-map-key {
    font-size: 0.75rem;
  }
  .prx-nt .prx-stage .nt-callout {
    margin-top: 0.14rem;
    font-size: 0.8rem;
    line-height: 1.24;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] > .prx-disclosures {
    margin-top: 0.24rem;
    gap: 0.22rem;
  }
  .prx-widget.prx-nt[data-prx-frame="v2"] .prx-caption {
    margin-top: 0.24rem;
    line-height: 1.26;
  }
}
`;

const curves = new Map();
const kindName = {
  twoWithheld: 'Two withheld pairs, one stated',
  statedChain: 'A stated chain with its closing pair withheld',
  directedCycle: 'A directed three-cycle',
};
const kindShort = {
  twoWithheld: 'Two withheld, one stated',
  statedChain: 'Stated chain, closing withheld',
  directedCycle: 'Directed three-cycle',
};

function shortFirm(name, maxLen) {
  const s = String(name ?? '');
  return s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}…` : s;
}

function enhanceHeatSvg(fig, model, card, s, units) {
  const { svg, palette: ink } = fig;
  if (!svg) return;
  const doc = svg.ownerDocument;
  const ns = svg.namespaceURI;
  // Prune any tight two-digit grade headers when blocks overlay has many grades
  if (s.blocks && card.d.G > 4) {
    const texts = [...svg.querySelectorAll('g[aria-label="text"] text')];
    let lastX = -Infinity;
    for (const node of texts) {
      const tr = node.getAttribute('transform') ?? '';
      const m = /translate\(\s*([-\d.]+)/.exec(tr);
      const x = m ? Number(m[1]) : Number(node.getAttribute('x') ?? NaN);
      if (Number.isFinite(x)) {
        if (x - lastX < 20) node.remove();
        else lastX = x;
      }
    }
  } else if (!s.blocks) {
    // 13px header inside the 20px top margin when grade block labels are off
    const w = Number(svg.getAttribute('width')) || 300;
    const hdr = doc.createElementNS(ns, 'g');
    hdr.setAttribute('aria-hidden', 'true');
    hdr.setAttribute('pointer-events', 'none');
    const txt = doc.createElementNS(ns, 'text');
    txt.setAttribute('x', String((w / 2).toFixed(1)));
    txt.setAttribute('y', '14');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '13');
    txt.setAttribute('font-weight', '600');
    txt.setAttribute('fill', ink.plotFg);
    const n1 = doc.createElementNS(ns, 'tspan');
    n1.dataset.num = String(model.n);
    n1.textContent = formatCount(model.n);
    const n2 = doc.createElementNS(ns, 'tspan');
    n2.dataset.num = String(model.n);
    n2.textContent = formatCount(model.n);
    txt.append(n1, ' × ', n2, ' firm pairs');
    hdr.append(txt);
    svg.append(hdr);
  }
  // Add crisp haloed rings around the 3 highlighted pair cells so they stand out in the 97x97 matrix
  if (units.length === 3) {
    const order = s.blocks ? blockOrder(model, card.grade, s.sort) : keyOrder(model, s.sort);
    const pos = new Map(order.map((u, idx) => [u, idx + 0.5]));
    const sx = fig.scale('x');
    const sy = fig.scale('y');
    const g = doc.createElementNS(ns, 'g');
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('pointer-events', 'none');
    const pairs = [
      [units[0], units[1]],
      [units[0], units[2]],
      [units[1], units[2]],
    ];
    for (const [a, b] of pairs) {
      const winFirst = 1 - model.e[a][b] >= 0.5;
      const rowU = winFirst ? a : b;
      const colU = winFirst ? b : a;
      const cx = sx.apply(pos.get(colU));
      const cy = sy.apply(pos.get(rowU));
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      for (const [stroke, sw] of [
        [ink.plotBg, '3.2'],
        [ink.err, '2'],
      ]) {
        const ring = doc.createElementNS(ns, 'circle');
        ring.setAttribute('cx', String(cx.toFixed(1)));
        ring.setAttribute('cy', String(cy.toFixed(1)));
        ring.setAttribute('r', '5.5');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', stroke);
        ring.setAttribute('stroke-width', sw);
        g.append(ring);
      }
    }
    svg.append(g);
  }
}

function drawTripleScene(ctx, slot, model, d, t) {
  const measured = Math.round(slot.clientWidth || 0);
  const width = Math.max(240, measured || (ctx.width() > 832 ? ctx.width() - 490 : ctx.width()));
  const narrow = width < 360 || ctx.width() < 740;
  const height = narrow ? 108 : 390;

  svgScene(
    slot,
    {
      width,
      height,
      margin: { top: 4, right: 6, bottom: 4, left: 6 },
      alt: t
        ? `Inspected unprintable triple (${kindName[t.kind]}): ${model.names[t.i]}, ${model.names[t.j]}, and ${model.names[t.k]}.`
        : 'All firm triples are printable at this threshold.',
    },
    scene => {
      const { el, palette: pal } = scene;
      if (!t) {
        scene.add(
          el('rect', {
            x: 8,
            y: Math.round(height / 2 - 20),
            width: width - 16,
            height: 40,
            rx: 6,
            fill: pal.plotBg,
            stroke: pal.plotGrid,
          }),
          el(
            'text',
            { x: width / 2, y: Math.round(height / 2 + 5), textAnchor: 'middle', fontSize: 13, fontWeight: 600, fill: pal.plotFg },
            'All ',
            el('tspan', { 'data-num': String(d.triples), text: formatCount(d.triples) }),
            ' triples are printable here',
          ),
        );
        return;
      }

      const defs = el(
        'defs',
        {},
        el(
          'marker',
          { id: 'prx-nt-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto' },
          el('path', { d: 'M 0 1.5 L 9 5 L 0 8.5 z', fill: pal.relAbove }),
        ),
      );
      scene.add(defs);

      const maxBottomW = Math.floor((width - 26) / 2);
      const maxChars = narrow ? 18 : 20;
      const estBoxW = (lbl, isTop) => {
        const cap = narrow ? (isTop ? Math.min(188, width - 12) : maxBottomW) : 168;
        return Math.min(cap, Math.round(lbl.length * 6.8 + 14));
      };
      const lbl0 = shortFirm(model.names[t.i], maxChars);
      const lbl1 = shortFirm(model.names[t.j], maxChars);
      const lbl2 = shortFirm(model.names[t.k], maxChars);
      const nw0 = estBoxW(lbl0, true);
      const nw1 = estBoxW(lbl1, false);
      const nw2 = estBoxW(lbl2, false);

      const nodes = [
        { u: t.i, label: lbl0, nw: nw0, x: width / 2, y: narrow ? 33 : 86 },
        {
          u: t.j,
          label: lbl1,
          nw: nw1,
          x: narrow ? Math.max(4 + nw1 / 2, Math.min(4 + maxBottomW - nw1 / 2, Math.round(width * 0.22))) : Math.round(width * 0.23),
          y: narrow ? 75 : 326,
        },
        {
          u: t.k,
          label: lbl2,
          nw: nw2,
          x: narrow ? Math.min(width - 4 - nw2 / 2, Math.max(width - 4 - maxBottomW + nw2 / 2, Math.round(width * 0.78))) : Math.round(width * 0.77),
          y: narrow ? 75 : 326,
        },
      ];

      // Title banner at top
      scene.add(
        el('text', {
          x: width / 2,
          y: narrow ? 14 : 15,
          textAnchor: 'middle',
          fontSize: 13,
          fontWeight: 700,
          fill: pal.plotFg,
          text: kindShort[t.kind] ?? kindName[t.kind],
        }),
      );

      // Edges between (0,1), (1,2), (0,2)
      const edges = [
        [0, 1, -18],
        [1, 2, 22],
        [0, 2, -18],
      ];
      for (const [aIdx, bIdx, labelDy] of edges) {
        const A = nodes[aIdx];
        const B = nodes[bIdx];
        const rel = d.relation[A.u][B.u];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy) || 1;
        const from = rel >= 0 ? A : B;
        const to = rel >= 0 ? B : A;
        const ux = (to.x - from.x) / dist;
        const uy = (to.y - from.y) / dist;
        const padFrom = narrow ? (aIdx === 1 && bIdx === 2 ? from.nw / 2 + 4 : 14) : 42;
        const padTo = narrow ? (aIdx === 1 && bIdx === 2 ? to.nw / 2 + 5 : 15) : 42;
        const x1 = from.x + ux * Math.min(padFrom, dist * 0.42);
        const y1 = from.y + uy * Math.min(padFrom, dist * 0.42);
        const x2 = to.x - ux * Math.min(padTo, dist * 0.42);
        const y2 = to.y - uy * Math.min(padTo, dist * 0.42);

        if (rel === 0) {
          scene.add(
            el('line', {
              x1: x1.toFixed(1),
              y1: y1.toFixed(1),
              x2: x2.toFixed(1),
              y2: y2.toFixed(1),
              stroke: pal.wh,
              strokeWidth: 2,
              strokeDasharray: '5,3',
            }),
          );
        } else {
          scene.add(
            el('line', {
              x1: x1.toFixed(1),
              y1: y1.toFixed(1),
              x2: x2.toFixed(1),
              y2: y2.toFixed(1),
              stroke: pal.relAbove,
              strokeWidth: 2.4,
              'marker-end': 'url(#prx-nt-arrow)',
            }),
          );
        }

        const hiU = 1 - model.e[A.u][B.u] >= 0.5 ? A.u : B.u;
        const loU = hiU === A.u ? B.u : A.u;
        const pi = 1 - model.e[hiU][loU];
        const piStr = formatReadoutProb(pi);

        if (narrow) {
          const bw = Math.max(36, Math.round(piStr.length * 7.2 + 8));
          const mx =
            aIdx === 1 && bIdx === 2
              ? width / 2
              : aIdx === 0 && bIdx === 1
                ? Math.max(4 + bw / 2, Math.round((A.x + B.x) / 2 - 18))
                : Math.min(width - 4 - bw / 2, Math.round((A.x + B.x) / 2 + 18));
          const my = aIdx === 1 && bIdx === 2 ? 97 : 54;
          if (aIdx === 1 && bIdx === 2) {
            scene.add(
              el('line', {
                x1: mx.toFixed(1),
                y1: '75',
                x2: mx.toFixed(1),
                y2: '88.5',
                stroke: rel === 0 ? pal.plotGrid : pal.relAbove,
                strokeWidth: 1,
              }),
            );
          }
          scene.add(
            el('rect', {
              x: (mx - bw / 2).toFixed(1),
              y: (my - 8.5).toFixed(1),
              width: bw,
              height: 17,
              rx: 3,
              fill: pal.plotBg,
              stroke: rel === 0 ? pal.plotGrid : pal.relAbove,
              strokeWidth: 1,
            }),
            el(
              'text',
              {
                x: mx.toFixed(1),
                y: (my + 4.3).toFixed(1),
                textAnchor: 'middle',
                fontSize: 13,
                fontWeight: rel === 0 ? '500' : '600',
                fill: pal.plotFg,
              },
              el('tspan', { 'data-num': String(pi), text: piStr }),
            ),
          );
        } else {
          const tagStr = rel === 0 ? `withhold (${piStr})` : `state (${piStr})`;
          const mx = (A.x + B.x) / 2 + (aIdx === 0 && bIdx === 1 ? -26 : aIdx === 0 && bIdx === 2 ? 26 : 0);
          const my = (A.y + B.y) / 2 + (aIdx === 1 && bIdx === 2 ? labelDy : 0);
          const bw = Math.round(tagStr.length * 6.9 + 10);
          scene.add(
            el('rect', {
              x: (mx - bw / 2).toFixed(1),
              y: (my - 9).toFixed(1),
              width: bw,
              height: 18,
              rx: 3,
              fill: pal.plotBg,
              stroke: rel === 0 ? pal.plotGrid : pal.relAbove,
              strokeWidth: 1,
            }),
            el(
              'text',
              {
                x: mx.toFixed(1),
                y: (my + 4.3).toFixed(1),
                textAnchor: 'middle',
                fontSize: 13,
                fill: pal.plotFg,
              },
              rel === 0 ? 'withhold (' : 'state (',
              el('tspan', { 'data-num': String(pi), fontWeight: '600', text: piStr }),
              ')',
            ),
          );
        }
      }

      // Draw the 3 firm nodes on top (measuring exact text length in browser so no label protrudes)
      for (let idx = 0; idx < nodes.length; idx += 1) {
        const nd = nodes[idx];
        const nh = narrow ? 20 : 24;
        const rectNode = el('rect', {
          x: '0',
          y: (nd.y - nh / 2).toFixed(1),
          width: nd.nw,
          height: nh,
          rx: 5,
          fill: pal.plotBg,
          stroke: pal.plotAxis,
          strokeWidth: 1.4,
        });
        const textNode = el('text', {
          x: '0',
          y: (nd.y + 4.3).toFixed(1),
          textAnchor: 'middle',
          fontSize: 13,
          fontWeight: 600,
          fill: pal.plotFg,
          'data-prx-name': '',
          text: nd.label,
        });
        scene.add(rectNode, textNode);
        const cap = narrow ? (idx === 0 ? Math.min(188, width - 12) : maxBottomW) : 168;
        const measuredTextW = typeof textNode.getComputedTextLength === 'function' ? textNode.getComputedTextLength() : 0;
        const finalW = measuredTextW > 0 ? Math.min(cap, Math.ceil(measuredTextW + 12)) : nd.nw;
        const bx = Math.max(4, Math.min(width - finalW - 4, nd.x - finalW / 2));
        rectNode.setAttribute('x', bx.toFixed(1));
        rectNode.setAttribute('width', String(finalW));
        textNode.setAttribute('x', (bx + finalW / 2).toFixed(1));
      }
    },
  );
}

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: 'naive-thresholding',
    frame: 'v2',
    className: 'prx-nt',
    css: CSS,
    label: 'Inspect unprintable triples under naive pair thresholds',
    title: 'Pair choices that no grade report can print',
    keys: {
      criterion: { type: 'choice', values: ['race', 'gender'], value: 'race' },
      lambda: { type: 'number', min: 0.01, max: 1, step: 0.01, value: 0.25 },
      sort: { type: 'choice', values: ['mean', 'estimate', 'krw'], value: 'mean' },
      blocks: { type: 'boolean', value: false },
      triple: { type: 'integer', min: 0, max: 147439, value: 0 },
    },
    build(ctx) {
      const { h } = ctx;
      const ro = (name, v, f = formatCount) => {
        const n = ctx.num(v, f(v));
        n.dataset.prxReadout = name;
        return n;
      };

      const criterion = ctx.segmented({
        label: 'Target',
        name: 'criterion',
        value: ctx.state.criterion,
        options: [
          { value: 'race', label: 'Race', title: 'White-name contact advantage' },
          { value: 'gender', label: 'Gender', title: 'Male-name contact advantage' },
        ],
        onChange: v => ctx.set({ criterion: v }),
      });
      const lambda = ctx.slider({
        label: 'Pair threshold λ',
        name: 'lambda',
        min: 0.01,
        max: 1,
        step: 0.01,
        value: ctx.state.lambda,
        onInput: v => ctx.set({ lambda: v }),
      });
      ctx.controls.append(criterion.root, ctx.primaryControl(lambda.root));

      const settings = ctx.settingsBox('Settings');
      const sort = ctx.segmented({
        label: 'Order within map',
        name: 'sort',
        value: ctx.state.sort,
        options: [
          { value: 'mean', label: 'Posterior mean' },
          { value: 'estimate', label: 'Estimate' },
          { value: 'krw', label: 'KRW grid order' },
        ],
        onChange: v => ctx.set({ sort: v }),
      });
      const blocks = ctx.toggle({
        label: 'Overlay card’s grade blocks',
        name: 'blocks',
        checked: ctx.state.blocks,
        onChange: v => ctx.set({ blocks: v }),
      });
      settings.body.append(sort.root, blocks.root);

      const map = h('div', { class: 'nt-map' });
      const legend = h('div', { class: 'nt-legend prx-light-panel', 'data-prx-part': 'legend' });
      const tripleFig = h('div', { class: 'nt-triple-fig' });
      const callout = h('p', { class: 'nt-callout' });
      ctx.stage.append(
        h(
          'div',
          { class: 'nt-stage-grid' },
          h('div', { class: 'nt-map-col' }, map),
          h('div', { class: 'nt-side-col' }, tripleFig, callout, legend),
        ),
      );

      const dataBox = ctx.dataBox('Data, intransitive triples and failure curve');
      const counts = h('div', { class: 'nt-counts' });
      const chooser = ctx.slider({
        label: 'Inspect an unprintable triple (index starts at zero)',
        name: 'triple',
        min: 0,
        max: 147439,
        step: 1,
        value: ctx.state.triple,
        format: formatCount,
        onInput: v => ctx.set({ triple: v }),
      });
      const proof = h('div', { class: 'nt-proof' });
      const pairTable = ctx.scrollRegion(h('div', { class: 'nt-pair-scroll' }), 'The three pair choices and the selected card’s directions');
      const status = h('p', { class: 'nt-note' });
      const path = h('div');
      const pathLegend = h('p', {
        class: 'nt-note',
        text: 'Solid vermillion: two withheld pairs. Dashed navy: a stated chain. Dotted gray: a directed cycle.',
      });
      dataBox.body.append(
        counts,
        chooser.root,
        proof,
        pairTable,
        ctx.panelTitle('Failures along the released λ grid', { className: 'nt-heading' }),
        status,
        path,
        pathLegend,
      );

      const methodBox = ctx.methodBox('Method and transitivity');
      const cutoffInfo = h('p', { class: 'nt-note' });
      const methodProse = h('p', { class: 'nt-note' });
      methodBox.body.append(cutoffInfo, methodProse);

      appendKrwNotice(ctx);

      let curveKey = null;
      let lastCurve = null;

      function renderFailurePlot(rows, cardLambda, countKeys) {
        status.replaceChildren(
          'All ',
          ro('grid-count', rows.length),
          ' positive released grid settings are counted exactly; neither triples nor firms are sampled.',
        );
        const lines = rows.flatMap(r => countKeys.map(kind => ({ lambda: r.lambda, count: r[kind], kind })));
        const tip = r =>
          `λ ${formatSetting(r.lambda)}: ${formatCount(r.twoWithheld)} two-withheld, ${formatCount(r.statedChain)} chains, ${formatCount(r.directedCycle)} cycles.`;
        const width = Math.max(240, Math.round(path.clientWidth || ctx.width() - 32));
        plot(path, {
          width,
          height: 235,
          marginLeft: 58,
          marginRight: 18,
          marginTop: 18,
          marginBottom: 40,
          x: { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: 'λ', labelArrow: 'none' },
          y: {
            domain: [0, Math.max(1, ...rows.map(r => r.invalid))],
            ticks: 5,
            label: 'Invalid triples',
            grid: true,
            labelArrow: 'none',
          },
          alt: 'Exact counts of three kinds of unprintable triples at every positive released lambda setting.',
          table: {
            caption: 'Invalid triple counts along the released grid',
            columns: [
              { label: 'λ', value: 'lambda', format: v => formatSetting(v) },
              ...countKeys.map(kind => ({ label: kindName[kind], value: kind, format: v => formatCount(v) })),
            ],
            rows,
          },
          keyboard: { data: rows, x: 'lambda', y: 'invalid', sort: false, pointer: true, label: 'Read exact failure counts along lambda', title: tip },
          marks: (c, P) => [
            P.ruleX([cardLambda], { stroke: c.plotAxis, strokeDasharray: '4,3' }),
            ...countKeys.map((kind, k) =>
              P.line(
                lines.filter(r => r.kind === kind),
                { x: 'lambda', y: 'count', stroke: [c.est, c.post, c.wh][k], strokeDasharray: [null, '5,3', '2,3'][k], strokeWidth: 2 },
              ),
            ),
          ],
        });
      }

      function ensureCurve(model, cardLambda, countKeys) {
        if (curves.has(model.criterion)) {
          curveKey = null;
          return curves.get(model.criterion);
        }
        if (curveKey === model.criterion) return null;
        curveKey = model.criterion;
        status.textContent = 'Counting every triple across the released grid…';
        path.replaceChildren();
        const total = model.grid.count;
        const workRows = [];
        const chunkSize = 25;
        const stages = [];
        for (let start = 1; start < total; start += chunkSize) {
          const from = start;
          const to = Math.min(total, start + chunkSize);
          stages.push(() => {
            for (let idx = from; idx < to; idx += 1) {
              const l = model.grid.lambda[idx];
              const r = thresholdAt(model, l);
              workRows.push({ lambda: l, ...r.counts, invalid: r.invalidCount });
            }
          });
        }
        stages.push(() => {
          curves.set(model.criterion, workRows);
          curveKey = null;
          const activeCard = cardAt(readKrwModel(ctx.state.criterion), ctx.state.lambda);
          if (ctx.state.criterion === model.criterion) {
            lastCurve = { rows: workRows, cardLambda: activeCard.lambda, countKeys };
            renderFailurePlot(workRows, activeCard.lambda, countKeys);
          }
        });
        ctx.scheduleStages(stages, { yieldMs: 0 });
        return null;
      }

      function render(s, info) {
        if (info?.reason === 'disclosure') {
          if (dataBox.open && lastCurve) {
            renderFailurePlot(lastCurve.rows, lastCurve.cardLambda, lastCurve.countKeys);
          }
          return;
        }

        criterion.set(s.criterion);
        lambda.set(s.lambda);
        sort.set(s.sort);
        blocks.set(s.blocks);

        const model = readKrwModel(s.criterion);
        const card = cardAt(model, s.lambda);
        const d = thresholdAt(model, s.lambda, { details: true });
        const overlap = heatCounts(model, card.grade, card.tau);
        const countKeys = Object.keys(d.counts);

        const max = Math.max(0, d.invalidCount - 1);
        chooser.input.max = String(max);
        chooser.setDisabled(d.invalidCount === 0);
        if (s.triple > max) {
          ctx.set({ triple: max });
          return;
        }
        chooser.set(s.triple);

        const t = d.violations[s.triple] ?? null;
        const units = t ? [t.i, t.j, t.k] : [];

        const fig = drawKrwHeat(ctx, map, legend, model, {
          grade: card.grade,
          tau: card.tau,
          sort: s.sort,
          stage: s.blocks ? 3 : 2,
          highlight: units,
          pointer: true,
        });
        for (const numEl of legend.querySelectorAll('.krw-map-key [data-num]')) {
          const v = Number(numEl.getAttribute('data-num'));
          if (Number.isFinite(v) && v > 0 && v < 1) {
            numEl.textContent = formatDecimal(v, { digits: 3 });
          }
        }
        enhanceHeatSvg(fig, model, card, s, units);
        drawTripleScene(ctx, tripleFig, model, d, t);

        callout.replaceChildren(
          'Cutoff > ',
          ro('cutoff', 1 - card.tau, v => formatDecimal(v, { digits: 3 })),
          '. Card withholds ',
          ro('card-withheld', overlap.W),
          ' of ',
          ro('card-confident', overlap.P),
          ' confident pairs, states ',
          ro('card-doubtful', overlap.S),
          ' above τ.',
        );

        counts.replaceChildren(
          h('span', {}, 'Naive stated pairs ', ro('naive-N', d.statedCount)),
          h('span', {}, 'Unprintable triples ', ro('invalid', d.invalidCount), ' of ', ro('triples', d.triples)),
          ...countKeys.map(kind => h('span', {}, kindName[kind], ': ', ro(kind, d.counts[kind]))),
        );

        if (!t) {
          proof.textContent = 'Every triple is printable at this setting; no failing triple can be inspected.';
          pairTable.replaceChildren();
        } else {
          proof.replaceChildren(
            h('strong', { text: kindName[t.kind] }),
            h('p', {}, ...units.flatMap((i, k) => [k ? ' · ' : '', h('span', { 'data-prx-name': '', text: model.names[i] })])),
            h(
              'p',
              {},
              t.kind === 'twoWithheld'
                ? 'Sharing a grade is transitive. The two withheld pairs would force all three units into one grade, contradicting the stated pair.'
                : t.kind === 'statedChain'
                  ? 'The two stated directions form a chain; a printable report must state its closing direction too.'
                  : 'Strict grade order cannot run around a directed cycle.',
            ),
          );
          const pairProb = v =>
            [card.tau, 1 - card.tau].some(c => Number(formatDecimal(c, { digits: 4 })) === Number(formatProb(v)))
              ? formatDecimal(v, { digits: 5 })
              : formatProb(v);
          const pairs = [
            [t.i, t.j],
            [t.i, t.k],
            [t.j, t.k],
          ];
          const direction = (i, j, r) => (r === 0 ? 'withhold' : `${model.names[r > 0 ? i : j]} above ${model.names[r > 0 ? j : i]}`);
          pairTable.replaceChildren(
            h(
              'table',
              { class: 'nt-table prx-sticky-first' },
              h(
                'thead',
                {},
                h('tr', {}, ...['Pair', 'Naive choice', 'Current card', 'Pr(first truly higher)'].map(text => h('th', { scope: 'col', text }))),
              ),
              h(
                'tbody',
                {},
                ...pairs.map(([i, j], k) =>
                  h(
                    'tr',
                    {},
                    h('th', { scope: 'row' }, model.names[i], ' / ', model.names[j]),
                    h('td', { 'data-prx-choice': String(k), text: direction(i, j, d.relation[i][j]) }),
                    h('td', { text: direction(i, j, Math.sign(card.grade[j] - card.grade[i])) }),
                    h('td', {}, ro(`pair-${k}-pi`, 1 - model.e[i][j], pairProb)),
                  ),
                ),
              ),
            ),
          );
        }

        const rows = ensureCurve(model, card.lambda, countKeys);
        if (rows) {
          lastCurve = { rows, cardLambda: card.lambda, countKeys };
          renderFailurePlot(rows, card.lambda, countKeys);
        }

        cutoffInfo.replaceChildren(
          'At λ = ',
          ctx.num(card.lambda, formatSetting(card.lambda)),
          ', τ = λ/(',
          ctx.num(1, formatCount(1)),
          ' + λ) = ',
          ro('control-tau', card.tau, v => formatDecimal(v, { digits: 4 })),
          ': state a direction strictly when its error is below τ, equivalently Pr(truly higher) > ',
          ro('control-prob-cutoff', 1 - card.tau, formatProb),
          '.',
        );
        methodProse.replaceChildren(
          'In a grade report, two pairs sharing a unit and a grade also put the third pair in that grade, so conflicting directions occur even without a directed cycle. Grade 1 = stated highest on ',
          s.criterion === 'race' ? 'white-name' : 'male-name',
          ' contact advantage, as the posterior judges it. ',
          s.blocks ? 'Map rows follow the card’s grades, then the chosen order. ' : 'Map rows follow the chosen order. ',
          'KRW’s card has no cap on the number of grades, so its withheld confident pairs and stated pairs above τ come from coherence, not from a cap. ',
          captionNode(ctx, 'krw-card'),
          '. ',
          captionNode(ctx, 'fixed-report'),
          '.',
        );

        const tauNode = ctx.num(card.tau, formatReadoutRisk(card.tau));
        if (d.invalidCount === 0) {
          ctx.readout.set([
            'At λ ',
            ctx.num(card.lambda, formatSetting(card.lambda)),
            ' (τ ',
            tauNode,
            '), naive thresholding states ',
            ctx.num(d.statedCount, formatCount(d.statedCount)),
            ' ',
            plural(d.statedCount, 'pair'),
            '; all ',
            ctx.num(d.triples, formatCount(d.triples)),
            ' triples print coherently.',
          ]);
        } else {
          ctx.readout.set([
            'At λ ',
            ctx.num(card.lambda, formatSetting(card.lambda)),
            ' (τ ',
            tauNode,
            '), naive thresholding states ',
            ctx.num(d.statedCount, formatCount(d.statedCount)),
            ' ',
            plural(d.statedCount, 'pair'),
            ', leaving ',
            ctx.num(d.invalidCount, formatCount(d.invalidCount)),
            ' of ',
            ctx.num(d.triples, formatCount(d.triples)),
            ' triples unprintable (',
            ctx.num(d.counts.twoWithheld, formatCount(d.counts.twoWithheld)),
            ' two-withheld, ',
            ctx.num(d.counts.directedCycle, formatCount(d.counts.directedCycle)),
            ' ',
            plural(d.counts.directedCycle, 'cycle'),
            ').',
          ]);
        }
      }

      return { render };
    },
  });
}
