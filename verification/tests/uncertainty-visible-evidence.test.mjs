import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";
import { dataset as ranks } from "../../js/shared/domain/which-ranking.js";

function evidence(root, key) {
  const node = root.querySelector(`.prx-stage [data-prx-evidence="${key}"]`);
  assert.ok(node && !node.closest("details"), key + " must be in the default stage");
  return node;
}

async function update(m, patch) {
  m.handle.update(patch);
  await settle(m.win, m.el);
}

test("1.4 compares the selected estimates, truth and posterior means for the same replay", async () => {
  const m = await mountCase({ module: "js/apps/winners-curse.js", query: "?replays=20" });
  try {
    const table = evidence(m.root, "selected-replay");
    const records = () => [...table.querySelectorAll("tbody tr")].map(tr => ({
      id: tr.dataset.unit, values: [...tr.querySelectorAll("td [data-num]")].map(x => Number(x.dataset.num)),
    }));
    const top = records();
    assert.equal(top.length, 3);
    for (const { values: [estimate, truth, posterior, delta] } of top) {
      assert.equal(estimate - truth, delta);
      assert.ok(Math.abs(posterior) < Math.abs(estimate));
    }
    await update(m, { side: "bottom" });
    assert.ok(records().every(row => !top.some(t => t.id === row.id)));
    await update(m, { k: 1, draw: 9 });
    assert.equal(records().length, 1);
    assert.match(table.querySelector("caption").textContent, /replay 9/);
  } finally { m.close(); }
});

test("1.14 displays the selected unit's finite rank distribution and its simulated league distribution", async () => {
  const m = await mountCase({ module: "js/apps/which-ranking.js", query: "?data=puzzle&unit=A" });
  try {
    const strip = evidence(m.root, "unit-rank-distribution");
    for (const unit of ["A", "B"]) {
      await update(m, { unit });
      const law = ranks("puzzle");
      assert.match(strip.firstChild.textContent, new RegExp("of " + unit + " \\(exact\\)"));
      const rows = [...strip.querySelectorAll("tbody tr")];
      assert.deepEqual(rows.map(row => Number(row.lastElementChild.querySelector("[data-num]")?.dataset.num ?? row.lastElementChild.dataset.num)),
        law.rankProbs.map(row => row[law.ids.indexOf(unit)]));
    }
    await update(m, { data: "league", unit: "" });
    assert.equal(strip.querySelectorAll("tbody tr").length, 30);
    assert.match(strip.firstChild.textContent, /4,000 posterior draws/);
  } finally { m.close(); }
});

test("1.17 updates the convergence graphic for the inspected pair and draw count", async () => {
  const m = await mountCase({ module: "js/apps/mc-error.js", query: "?preset=s100" });
  try {
    const panel = evidence(m.root, "pair-convergence");
    const title = () => panel.querySelector("[role=heading]").textContent;
    assert.match(title(), /A.*B/);
    assert.ok(panel.querySelector("svg"));
    await update(m, { S: 400, pair: "C,D", tau: .35 });
    assert.match(title(), /C.*D/);
    assert.ok(panel.querySelector('[data-num="400"]'));
    assert.ok(panel.querySelector('[data-num="0.35"]'));
  } finally { m.close(); }
});

test("1.18 restores equality at independence and keeps separate model SEs for persistent draws", async () => {
  const m = await mountCase({ module: "js/apps/chain-draws.js", query: "?preset=independent" });
  try {
    const panel = evidence(m.root, "chain-standard-errors");
    const raw = key => Number(panel.querySelector(`[data-prx-readout="stage-se-${key}"]`).dataset.num);
    assert.equal(raw("iid"), .05);
    assert.equal(raw("chain"), raw("iid"));
    await update(m, { stay: .99, mode: "chain" });
    assert.equal(raw("iid"), .05);
    assert.ok(raw("chain") > .3);
    assert.match(panel.textContent, /Trace band uses the chain model/);
  } finally { m.close(); }
});

test("1.3 names the same unit across replays and discloses its true rank only when revealed", async () => {
  const m = await mountCase({ module: "js/apps/noisy-league.js" });
  try {
    const panel = evidence(m.root, "observed-and-true-rank");
    assert.equal(panel.querySelector("[data-prx-readout='inspected-true-rank']"), null);
    const select = m.root.querySelector("select[name='unit']") ?? [...m.root.querySelectorAll("select")].find(x => x.options[0]?.text === "Highest observed estimate");
    const id = select.options[2].textContent;
    await update(m, { unit: id, reveal: true, replays: 20, draw: 2 });
    const rank = () => panel.querySelector("[data-prx-readout='inspected-true-rank']").dataset.num;
    const first = rank();
    assert.equal(panel.querySelector("strong").textContent, id);
    await update(m, { draw: 4 });
    assert.equal(panel.querySelector("strong").textContent, id);
    assert.equal(rank(), first);
    await update(m, { reveal: false });
    assert.equal(panel.querySelector("[data-prx-readout='inspected-true-rank']"), null);
  } finally { m.close(); }
});

test("1.9 shows the signed covariance contribution for positive, independent, and negative correlations", async () => {
  const m = await mountCase({ module: "js/apps/correlated-units.js", query: "?muA=.3&muB=.1&sdA=.2&sdB=.2&corr=.5" });
  try {
    const panel = evidence(m.root, "covariance-term");
    for (const corr of [.5, 0, -.5]) {
      await update(m, { corr });
      const observed = Number(panel.querySelector("[data-prx-readout='stage-covariance-term']").dataset.num);
      assert.ok(Math.abs(observed + 2 * corr * .2 * .2) < 1e-14);
    }
  } finally { m.close(); }
});

test("1.10 keeps the two finite laws' equal marginal means and opposite directions on the stage", async () => {
  const m = await mountCase({ module: "js/apps/beyond-normal.js", query: "?cells=010001100" });
  try {
    const panel = evidence(m.root, "joint-law-margins");
    const initial = panel.textContent;
    const mean = panel.querySelector("[data-prx-readout='joint-mean']").dataset.num;
    await update(m, { cells: "001100010" });
    assert.equal(panel.querySelector("[data-prx-readout='joint-mean']").dataset.num, mean);
    assert.notEqual(panel.textContent, initial);
  } finally { m.close(); }
});

test("1.12 exposes the selected intervals' direction and 1.13 selects the named least-certain pair", async () => {
  const intervals = await mountCase({ module: "js/apps/overlap-in-the-league.js", query: "?pair=U06-U20" });
  try {
    const panel = evidence(intervals.root, "intervals-and-direction");
    assert.match(panel.textContent, /U06.*U20/);
    assert.equal(panel.querySelector("[data-prx-readout='stage-pair-direction']").dataset.num,
      intervals.root.querySelector("[data-prx-readout='card-pi']").dataset.num);
  } finally { intervals.close(); }
  const m = await mountCase({ module: "js/apps/pairwise-matrix.js", query: "?data=six&cell=A,B" });
  try {
    const button = evidence(m.root, "inspect-least-certain");
    const ids = [...button.querySelectorAll("[data-prx-name]")].map(x => x.textContent);
    assert.equal(ids.length, 2);
    button.click();
    await settle(m.win, m.el);
    assert.equal(m.handle.state.cell, ids.join(","));
  } finally { m.close(); }
});
