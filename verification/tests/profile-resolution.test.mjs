// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeWindow } from "../dom-env.mjs";
import { widgetFindings } from "../dom_rules.mjs";
import { exactCompare } from "../../js/shared/mdomain/compare.js";
import { solveProfileResolution, mountWidget } from "../../js/apps/profile-resolution.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const reference = (noiseIndex, budgetIndex) => read(`../golden/v35/resolution-k${noiseIndex}-a${budgetIndex}.json`);
const entry = read("../../catalog/entries/P.4-profile-resolution.json");
const base = { noiseIndex: 1, budgetIndex: 3, candidate: "canonical" };
const evaluationValues = ({ inputId: _input, lawId: _law, decisionId: _decision, ...values }) => values;

for (let k = 0; k <= 2; k += 1) for (let a = 0; a <= 6; a += 1) test(`P.4 noise ${k}, budget ${a}: every card, fixed evaluation and optimizer agrees with public R`, () => {
  const expected = reference(k, a), result = solveProfileResolution({ noiseIndex: k, budgetIndex: a });
  assert.deepEqual(result.fit.candidateTable, expected.expected.fit.candidateTable);
  assert.deepEqual(result.fit.optimizerIds, expected.expected.fit.optimizerIds);
  assert.equal(result.fit.selectedId, expected.expected.fit.selectedId);
  assert.equal(result.fit.riskExact, expected.expected.fit.riskExact);
  assert.equal(result.fit.jointProbabilityExact, expected.expected.fit.jointProbabilityExact);
  for (const card of expected.expected.fixedCards) assert.deepEqual(evaluationValues(result.evaluations.get(card.cardId)), evaluationValues(card.evaluation));
  assert.deepEqual(result.request.decision.weights, ["1/4", "3/4"]);
  assert.deepEqual(result.request.decision.tau, ["1/4", "1/4"]);
  assert.deepEqual(result.request.decision.t, ["0", "0"]);
  assert.equal(result.request.decision.q, null);
});

test("P.4 every seven-budget path changes alpha alone and agrees with all original R summaries", () => {
  for (let k = 0; k <= 2; k += 1) {
    const result = solveProfileResolution({ noiseIndex: k, budgetIndex: 3 });
    assert.equal(result.path.length, 7);
    let previousRisk, previousFeasible = [];
    for (let a = 0; a <= 6; a += 1) {
      const row = result.path[a], fixture = reference(k, a), fit = fixture.expected.fit;
      const selected = fit.candidateTable.find((candidate) => candidate.selected);
      assert.equal(row.budgetIndex, a); assert.equal(row.alphaExact, fixture.decision.alpha);
      assert.equal(row.riskExact, fit.riskExact); assert.equal(row.jointProbabilityExact, fit.jointProbabilityExact);
      assert.deepEqual(row.gradeCounts, selected.gradeCounts); assert.deepEqual(row.disclosedCounts, selected.disclosedCounts);
      assert.deepEqual(row.optimizerIds, fit.optimizerIds); assert.equal(row.selectedId, fit.selectedId);
      const current = solveProfileResolution({ noiseIndex: k, budgetIndex: a });
      assert.deepEqual(current.input, result.input); assert.deepEqual(current.request.family, result.request.family);
      const feasible = current.fit.candidateTable.filter((candidate) => candidate.feasible).map((candidate) => candidate.candidateId);
      assert.ok(previousFeasible.every((id) => feasible.includes(id)));
      if (previousRisk !== undefined) assert.ok(exactCompare(row.riskExact, previousRisk) <= 0);
      previousRisk = row.riskExact; previousFeasible = feasible;
    }
  }
});

test("P.4 baseline budget relaxation can reduce S grade count while lowering risk", () => {
  const lower = solveProfileResolution({ noiseIndex: 1, budgetIndex: 3 });
  const larger = solveProfileResolution({ noiseIndex: 1, budgetIndex: 5 });
  assert.equal(lower.fit.riskExact, "1/5"); assert.deepEqual(lower.summary.gradeCounts, [2, 1]);
  assert.equal(larger.fit.riskExact, "11/80"); assert.deepEqual(larger.summary.gradeCounts, [1, 2]);
  assert.ok(exactCompare(larger.fit.riskExact, lower.fit.riskExact) < 0);
  assert.ok(larger.summary.gradeCounts[0] < lower.summary.gradeCounts[0]);
  const withheld = solveProfileResolution({ noiseIndex: 1, budgetIndex: 0 });
  assert.equal(withheld.fit.riskExact, "1/4"); assert.deepEqual(withheld.summary.gradeCounts, [1, 1]);
  assert.deepEqual(withheld.focus.domains.map((domain) => domain.expectedFalseProportionExact), [null, null]);
  const noReversals = solveProfileResolution({ noiseIndex: 0, budgetIndex: 0 });
  assert.equal(noReversals.fit.riskExact, "0"); assert.deepEqual(noReversals.summary.gradeCounts, [2, 2]);
});

function mount(query = "") {
  const m = makeWindow({ query, plot: true });
  const handle = mountWidget(m.el);
  return { ...m, handle, close() { handle.destroy(); m.restore(); } };
}

test("P.4 all 21 settings expose the complete exact path without generic DOM findings", () => {
  const m = mount(); try {
    const raw = (name) => m.el.querySelector(`[data-prx-readout="${name}"]`).dataset.num;
    for (let k = 0; k <= 2; k += 1) for (let a = 0; a <= 6; a += 1) {
      m.handle.update({ noiseIndex: k, budgetIndex: a, candidate: "canonical" });
      const result = solveProfileResolution(m.handle.state);
      assert.equal(raw("minimum-risk"), result.fit.riskExact); assert.equal(raw("minimum-J"), result.fit.jointProbabilityExact);
      assert.equal(raw("alpha"), result.request.decision.alpha);
      for (const row of result.path) {
        assert.equal(raw(`path-${row.budgetIndex}-risk`), row.riskExact);
        assert.equal(raw(`path-${row.budgetIndex}-J`), row.jointProbabilityExact);
        for (let d = 0; d < 2; d += 1) {
          assert.equal(raw(`path-${row.budgetIndex}-K-${d}`), String(row.gradeCounts[d]));
          assert.equal(raw(`path-${row.budgetIndex}-N-${d}`), String(row.disclosedCounts[d]));
        }
      }
      assert.equal(m.el.querySelectorAll(".prr-budget").length, 7);
      assert.equal(m.el.querySelectorAll('.prr-budget[aria-pressed="true"]').length, 1);
      assert.equal(m.el.querySelector(".prr-current").dataset.pathIndex, String(a));
      assert.deepEqual(widgetFindings(m.el), [], `noise ${k}, budget ${a}`);
    }
  } finally { m.close(); }
});

test("P.4 budget arrow navigation changes the public exact-grid index and retains focus", () => {
  const m = mount(); try {
    const button = m.el.querySelector('[data-budget-index="3"]'); button.focus();
    button.dispatchEvent(new m.win.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    assert.equal(m.handle.state.budgetIndex, 4); assert.equal(m.handle.state.candidate, "canonical");
    assert.equal(m.doc.activeElement.dataset.budgetIndex, "4");
    assert.equal(m.el.querySelector('[data-prx-readout="grade-count-0"]').dataset.num, "1");
    assert.equal(m.el.querySelector('[data-prx-readout="grade-count-1"]').dataset.num, "2");
    m.doc.activeElement.dispatchEvent(new m.win.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    assert.equal(m.handle.state.budgetIndex, 0); assert.equal(m.doc.activeElement.dataset.budgetIndex, "0");
    assert.equal(m.el.querySelector('[data-prx-readout="focused-ratio-0"]').dataset.num, "NA");
    assert.equal(m.el.querySelector('[data-prx-readout="focused-ratio-1"]').dataset.num, "NA");
  } finally { m.close(); }
});

test("P.4 fixed candidate inspection does not change the canonical frontier or optimizer set", () => {
  const m = mount(); try {
    const before = solveProfileResolution(m.handle.state);
    for (const row of before.fit.candidateTable) {
      m.handle.update({ candidate: row.candidateId });
      const result = solveProfileResolution(m.handle.state);
      assert.equal(result.fit, before.fit); assert.equal(result.path, before.path);
      assert.equal(result.focus.riskExact, row.riskExact);
      assert.equal(m.el.querySelector('[data-prx-readout="focused-status"]').textContent, row.feasible ? "Feasible" : "Infeasible");
      assert.equal(m.el.querySelector('[data-prx-readout="minimum-risk"]').dataset.num, before.fit.riskExact);
    }
  } finally { m.close(); }
});

test("P.4 every catalog preset resets all three public keys and replays by URL", () => {
  assert.equal(entry.presets.length, 4);
  const m = mount(); try {
    for (const preset of entry.presets) {
      const query = new URLSearchParams(preset.query);
      assert.deepEqual([...query.keys()].sort(), Object.keys(base).sort());
      m.handle.update({ noiseIndex: 0, budgetIndex: 0, candidate: "p:2,1|2,1" });
      m.handle.applyPreset(preset.id);
      assert.equal(m.handle.state.noiseIndex, Number(query.get("noiseIndex")));
      assert.equal(m.handle.state.budgetIndex, Number(query.get("budgetIndex")));
      assert.equal(m.handle.state.candidate, "canonical");
      const replay = mount(`?${preset.query}`);
      try { assert.deepEqual(replay.handle.state, m.handle.state); } finally { replay.close(); }
    }
  } finally { m.close(); }
});
