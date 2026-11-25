// Unit tests for Steps 5.6 & 5.7: readout.js, table.js, and cards.js shared components.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createWidget, tabOrder } from "../../js/shared/base.js";
import { createReadoutWriter, plural, ro, tieNode, withheldNodes, withheldPhrase } from "../../js/shared/readout.js";
import { hiddenTable, renderDataTable } from "../../js/shared/table.js";
import {
  gradeLegend,
  pairMatrix,
  presetChips,
  renderGradeBlocks,
  renderGradeLegend,
  renderPairMatrix,
  renderPresetChips,
  renderReportCard,
} from "../../js/shared/cards.js";

const require = createRequire(new URL("../../tools/package.json", import.meta.url));
const { JSDOM } = require("jsdom");

function makeWidgetEnv() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
    url: "https://example.test/",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  const doc = win.document;
  const el = doc.getElementById("app");
  let capturedCtx = null;
  const handle = createWidget(el, {}, {
    name: "components-test",
    frame: "v2",
    bridge: false,
    keys: { k: { type: "integer", min: 0, max: 9, value: 1 } },
    build(ctx) {
      capturedCtx = ctx;
      return { render() {} };
    },
  });
  return {
    win,
    doc,
    el,
    ctx: capturedCtx,
    handle,
    close() {
      handle.destroy();
      win.close();
    },
  };
}

test("readout.js: ro(ctx) formats prob, risk, share, expected, est, count, setting, exact, diff, distinguishing with data-num", () => {
  const env = makeWidgetEnv();
  try {
    assert.equal(ro, createReadoutWriter);
    const r = ro(env.ctx);

    const pZero = r.prob(0);
    assert.equal(pZero.textContent, "0");
    assert.equal(pZero.dataset.num, "0");
    assert.equal(r.prob(1).textContent, "1");
    assert.equal(r.prob(0.0004).textContent, "below .001");
    assert.equal(r.prob(0.9994).textContent, "above .999");
    assert.equal(r.prob(0.23456, { hook: "p-ab" }).textContent, ".235");
    assert.equal(r.prob(0.23456, { hook: "p-ab" }).getAttribute("data-prx-readout"), "p-ab");

    const rk = r.risk(0.0416667);
    assert.equal(rk.classList.contains("prx-num"), true);
    assert.equal(rk.textContent, ".0417");
    assert.equal(rk.dataset.num, "0.0416667");

    const tinyRisk = r.risk(1.2e-5);
    assert.match(tinyRisk.textContent, /1\.20?e−5/);
    assert.ok(tinyRisk.title.includes("10⁻⁵"), "scientific display receives sciGloss tooltip");

    assert.equal(r.share(0.1359).textContent, ".136");
    assert.equal(r.share(null).textContent, "NA: no disclosure");
    assert.equal(r.share(null).dataset.num, "NA");

    assert.equal(r.expected(14.284).textContent, "14.3");
    assert.equal(r.est(-0.08432).textContent, "−.0843");
    assert.equal(r.est(0.125, { signed: true }).textContent, "+.125");
    assert.equal(r.count(4683).textContent, "4,683");
    assert.equal(r.count(4683).dataset.num, "4683");
    assert.equal(r.setting(0.2).dataset.num, "0.2");

    const ex = r.exact("3/20", { style: "percent", digits: 0 });
    assert.equal(ex.textContent, "15%");
    assert.equal(ex.dataset.num, "3/20");

    const d1 = r.diff(0.25, 0.1, { signed: true });
    assert.equal(d1.textContent, "+.150");
    assert.equal(Number(d1.dataset.num), 0.15);

    const dAbs = r.diff(0.1, 0.25, { abs: true });
    assert.equal(dAbs.textContent, ".150");

    // Near-tie distinguishing helper (S2-01: 0.07406 vs 0.07407 both round to .0741 at sig 3, expand to sig 4).
    const nearA = r.distinguishing(0.07406, 0.07407);
    const nearB = r.distinguishing(0.07407, 0.07406);
    assert.notEqual(nearA.textContent, nearB.textContent);

    // Re-exports from labels.js.
    assert.equal(plural(1, "pair"), "pair");
    assert.equal(plural(3, "pair"), "pairs");
    assert.equal(withheldPhrase(0, 15, "pair"), "withholds every pair");
    assert.equal(withheldNodes(env.ctx, 12, 15, "pair").length, 5);
    assert.equal(tieNode(env.ctx, { tieCount: 2 }).getAttribute("data-prx-ties"), "2");
  } finally {
    env.close();
  }
});

test("table.js: renderDataTable and hiddenTable format values with setNum, sticky classes, scrollRegion, and never collapse tiny values", () => {
  const env = makeWidgetEnv();
  try {
    const tbl = renderDataTable(env.ctx, {
      caption: "Unit posterior summary",
      sticky: 1,
      columns: [
        { key: "unit", label: "Unit", rowHeader: true, name: true },
        { key: "prob", label: "Top chance", kind: "prob", hook: (row) => `prob-${row.unit}` },
        { key: "tiny", label: "Tiny tail", kind: "decimal", digits: 4 },
        { key: "n", label: "Trials", kind: "count" },
      ],
      rows: [
        { unit: "Site 1", prob: 0.8421, tiny: 1.5e-7, n: 1200 },
        { unit: "Site 2", prob: 0.0002, tiny: 0, n: 85 },
      ],
    });

    assert.equal(tbl.classList.contains("prx-data-table"), true);
    assert.equal(tbl.classList.contains("prx-scroll-region"), true);
    const tableEl = tbl.querySelector("table");
    assert.equal(tableEl.classList.contains("prx-sticky-first"), true);
    assert.equal(tableEl.querySelector("caption").textContent, "Unit posterior summary");

    const firstRow = tableEl.tBodies[0].rows[0];
    assert.equal(firstRow.cells[0].tagName.toLowerCase(), "th");
    assert.equal(firstRow.cells[0].getAttribute("scope"), "row");
    assert.equal(firstRow.cells[0].hasAttribute("data-prx-name"), true);

    assert.equal(firstRow.cells[1].dataset.num, "0.8421");
    assert.equal(firstRow.cells[1].getAttribute("data-prx-readout"), "prob-Site 1");

    // Tiny positive number must NOT collapse to ".0000" or "0"!
    const tinyCell = firstRow.cells[2];
    assert.equal(tinyCell.dataset.num, "1.5e-7");
    assert.notEqual(tinyCell.textContent, "0");
    assert.notEqual(tinyCell.textContent, ".0000");
    assert.match(tinyCell.textContent, /1\.50?e−7/);

    // Exact zero still renders as "0".
    assert.equal(tableEl.tBodies[0].rows[1].cells[2].textContent, "0");
    assert.equal(firstRow.cells[3].textContent, "1,200");

    // Empty table state & sticky = 2 & maxRows truncation.
    const empty = renderDataTable(env.ctx, {
      columns: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
      rows: [],
      sticky: 2,
      emptyText: "Nothing to report.",
    });
    assert.equal(empty.querySelector("table").classList.contains("prx-sticky-two"), true);
    assert.equal(empty.querySelector(".prx-table-empty").textContent, "Nothing to report.");

    const capped = renderDataTable(env.ctx, {
      columns: [{ key: "x", label: "x" }],
      rows: [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }],
      maxRows: 2,
    });
    assert.equal(capped.querySelector("tbody").rows.length, 2);
    assert.equal(capped.querySelectorAll("tfoot [data-num]").length, 2);

    const sr = hiddenTable(env.ctx, {
      caption: "Screen reader data",
      columns: [{ key: "v", label: "v", kind: "sig" }],
      rows: [{ v: 2.5e-6 }],
    });
    assert.equal(sr.classList.contains("prx-sr-only"), true);
    assert.equal(sr.querySelector("tbody td").dataset.num, "0.0000025");
  } finally {
    env.close();
  }
});

test("cards.js: renderGradeBlocks and renderGradeLegend emit accessible blocks, non-color patterns, and data-num spans", () => {
  const env = makeWidgetEnv();
  try {
    assert.equal(renderReportCard, renderGradeBlocks);
    assert.equal(gradeLegend, renderGradeLegend);

    const selected = [];
    const blocks = renderGradeBlocks(env.ctx, {
      grades: [1, 1, 2, 3],
      ids: ["A", "B", "C", "D"],
      counts: true,
      selectedUnit: "B",
      onSelectUnit: (id, idx) => selected.push([id, idx]),
    });

    const gradeBoxes = [...blocks.querySelectorAll(".prx-grade-block")];
    assert.equal(gradeBoxes.length, 3);
    assert.deepEqual(gradeBoxes.map((b) => b.dataset.pattern), ["solid", "dashed", "double"]);
    assert.equal(blocks.querySelectorAll(".prx-grade-sep").length, 2);

    const bBtn = blocks.querySelector('button[data-unit="B"]');
    assert.equal(bBtn.getAttribute("aria-pressed"), "true");
    bBtn.click();
    assert.deepEqual(selected, [["B", 1]]);

    const legend = renderGradeLegend(env.ctx, 3);
    const items = [...legend.querySelectorAll(".prx-grade-legend-item")];
    assert.equal(items.length, 3);
    assert.match(items[0].textContent, /Grade 1 \(top\)/);
    assert.match(items[2].textContent, /Grade 3 \(bottom\)/);
    assert.equal(legend.querySelectorAll("[data-num]").length, 3);
  } finally {
    env.close();
  }
});

test("cards.js: renderPairMatrix supports roving tabindex, diagonal-skipping arrow keys, and non-color hatch/border supplements", () => {
  const env = makeWidgetEnv();
  try {
    assert.equal(pairMatrix, renderPairMatrix);
    const picked = [];
    const matrix = renderPairMatrix(env.ctx, {
      n: 3,
      ids: ["A", "B", "C"],
      caption: "Pairwise relations",
      selectedPair: [0, 1],
      cells: (i, j) => {
        if (i === 0 && j === 1) return { state: "ordered", value: 0.912 };
        if (i === 1 && j === 2) return { state: "withheld" };
        return { state: "against", value: 0.14 };
      },
      onSelectPair: (detail, pair) => picked.push({ pair, rowId: detail.rowId, colId: detail.colId }),
    });
    env.ctx.stage.replaceChildren(matrix);

    // Check non-color pattern & border supplements across states.
    const btn01 = matrix.querySelector('button[data-row="0"][data-col="1"]');
    const btn12 = matrix.querySelector('button[data-row="1"][data-col="2"]');
    const btn20 = matrix.querySelector('button[data-row="2"][data-col="0"]');
    assert.equal(btn01.dataset.pattern, "solid");
    assert.equal(btn01.querySelector("[data-num]").dataset.num, "0.912");
    assert.equal(btn12.dataset.pattern, "hatch");
    assert.equal(btn12.dataset.borderStyle, "dashed");
    assert.equal(btn20.dataset.pattern, "crosshatch");
    assert.equal(btn20.dataset.borderStyle, "double");

    // Roving tabindex: only 1 cell button has tabindex="0" at a time.
    const zeroStops = [...matrix.querySelectorAll('button.prx-pair-cell-btn[tabindex="0"]')];
    assert.equal(zeroStops.length, 1);
    assert.equal(zeroStops[0], btn01);

    // ArrowDown from (0, 1) must skip diagonal (1, 1) and focus (2, 1)!
    btn01.focus();
    btn01.dispatchEvent(new env.win.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    const btn21 = matrix.querySelector('button[data-row="2"][data-col="1"]');
    assert.equal(env.doc.activeElement, btn21);
    assert.equal(btn21.getAttribute("tabindex"), "0");
    assert.equal(btn01.getAttribute("tabindex"), "-1");

    // Clicking a cell updates aria-pressed and invokes onSelectPair.
    btn12.click();
    assert.deepEqual(picked, [{ pair: [1, 2], rowId: "B", colId: "C" }]);
    assert.equal(btn12.getAttribute("aria-pressed"), "true");
    assert.equal(btn01.getAttribute("aria-pressed"), "false");

    // Verify matrix buttons inside stage produce 1 roving stop in tabOrder (plus scrollRegion if overflowing).
    const buttonStops = tabOrder(matrix).filter((n) => n.tagName.toLowerCase() === "button");
    assert.equal(buttonStops.length, 1);
  } finally {
    env.close();
  }
});

test("cards.js: renderPresetChips builds wrapping chips, honors firstPreset, and syncs aria-pressed", () => {
  const env = makeWidgetEnv();
  try {
    assert.equal(presetChips, renderPresetChips);
    const chosen = [];
    const chips = renderPresetChips(env.ctx, {
      presets: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
      ],
      firstPreset: "c",
      value: "b",
      onSelect: (id) => chosen.push(id),
    });

    assert.equal(chips.root.getAttribute("data-prx-part"), "presets");
    assert.deepEqual(chips.buttons.map((b) => b.dataset.value), ["c", "a", "b"]);
    assert.equal(chips.buttons[2].getAttribute("aria-pressed"), "true");
    assert.equal(chips.root.querySelector(".prx-seg-buttons").style.flexWrap, "wrap");

    chips.buttons[0].click();
    assert.deepEqual(chosen, ["c"]);
    assert.equal(chips.get(), "c");
    assert.equal(chips.buttons[0].getAttribute("aria-pressed"), "true");
    assert.equal(chips.buttons[2].getAttribute("aria-pressed"), "false");

    chips.setDisabled(true);
    assert.equal(chips.buttons.every((b) => b.disabled), true);
  } finally {
    env.close();
  }
});
