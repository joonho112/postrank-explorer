// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mountWidget, solveProfileCommon } from "../../js/apps/profile-common-vs-domain.js";
import { parsePresetQuery } from "../../js/shared/base.js";
import { widgetFindings } from "../dom_rules.mjs";

const require = createRequire(new URL("../../tools/package.json", import.meta.url));
const { JSDOM } = require("jsdom");
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const references = read("../golden/postrank-v35-profile-views.json").rows.filter((row) => row.args.kind === "common");
const entry = read("../../catalog/entries/P.1-profile-common-vs-domain.json");
const canonical = { law: "crossed", tauIndex: 2, weightIndex: 0, unit: "A", report: "profile", candidate: "canonical" };

const numericRow = (row) => ({ candidateId: row.candidateId, values: row.grades.values, riskExact: row.riskExact, jointProbabilityExact: row.jointProbabilityExact, meanFeasible: row.meanFeasible, jointFeasible: row.jointFeasible, feasible: row.feasible, disclosedCounts: row.disclosedCounts, gradeCounts: row.gradeCounts, optimal: row.optimal, selected: row.selected });
const domainValues = (evaluation) => evaluation.domains.map(({ domainId: _domainId, ...values }) => values);

assert.equal(references.length, 12);
for (const reference of references) test(`P.1 ${reference.id}: exact common/product sets and every candidate match public R`, () => {
  const state = { ...canonical, ...reference.args };
  const result = solveProfileCommon(state), expected = reference.expect;
  assert.equal(result.common.riskExact, expected.commonRiskExact);
  assert.equal(result.fit.riskExact, expected.profileRiskExact);
  assert.equal(result.gapExact, expected.gapExact);
  assert.deepEqual(result.common.optimizerIds, expected.commonOptimizerIds);
  assert.deepEqual(result.fit.optimizerIds, expected.profileOptimizerIds);
  assert.equal(result.common.selectedId, expected.commonSelectedId);
  assert.equal(result.fit.selectedId, expected.profileSelectedId);
  assert.equal(result.common.optimizerIds.length, expected.commonOptimizerCount);
  assert.equal(result.fit.optimizerIds.length, expected.profileOptimizerCount);
  const fixture = read(`../golden/v35/${reference.id}.json`);
  assert.deepEqual(result.fit.candidateTable.map(numericRow), fixture.expected.fit.candidateTable.map(numericRow));
  assert.deepEqual(result.common, fixture.expected.comparisons[0]);
  for (const fixed of fixture.expected.fixedCards) {
    const actual = result.evaluations.get(fixed.cardId);
    assert.equal(actual.riskExact, fixed.evaluation.riskExact);
    assert.deepEqual(domainValues(actual), domainValues(fixed.evaluation));
    assert.equal(actual.jointStatus, "disabled");
  }
  assert.equal(result.request.decision.q, null); assert.equal(result.request.decision.t, null);
});

function mount(query = "", spec = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "https://example.test/", pretendToBeVisual: true });
  dom.window.__PRX_QUERY = query;
  const root = dom.window.document.getElementById("app");
  const handle = mountWidget(root, spec);
  return { dom, root, handle, close() { handle.destroy(); dom.window.close(); } };
}

test("P.1 all twelve settings expose correct risks, guards and all exact optima without numeric DOM findings", () => {
  const m = mount(); try {
    for (const reference of references) {
      m.handle.update({ ...canonical, ...reference.args });
      const raw = (name) => m.root.querySelector(`[data-prx-readout="${name}"]`).dataset.num;
      assert.equal(raw("common-risk"), reference.expect.commonRiskExact);
      assert.equal(raw("profile-risk"), reference.expect.profileRiskExact);
      assert.equal(raw("risk-gap"), reference.expect.gapExact);
      assert.equal(raw("common-optimizer-count"), String(reference.expect.commonOptimizerCount));
      assert.equal(raw("profile-optimizer-count"), String(reference.expect.profileOptimizerCount));
      for (const id of [...reference.expect.commonOptimizerIds, ...reference.expect.profileOptimizerIds]) assert.ok(m.root.textContent.includes(id));
      assert.match(m.root.textContent, /Expected-error guards and joint protection are disabled/);
      assert.equal(m.root.querySelector('[data-prx-readout="inspected-J"]'), null);
      assert.deepEqual(widgetFindings(m.root), [], reference.id);
    }
  } finally { m.close(); }
});

test("P.1 four profile ties at the withholding boundary remain separately inspectable", () => {
  const m = mount("?law=crossed&tauIndex=1&weightIndex=0&report=profile&candidate=canonical"); try {
    const result = solveProfileCommon(m.handle.state);
    assert.equal(result.fit.optimizerIds.length, 4); assert.equal(result.common.optimizerIds.length, 1);
    assert.equal(m.root.querySelectorAll(".pcd-optima button").length, 4);
    for (const id of result.fit.optimizerIds) {
      const button = [...m.root.querySelectorAll(".pcd-optima button")].find((node) => node.textContent.includes(id));
      button.click(); assert.equal(m.handle.state.candidate, id);
      assert.equal(m.root.querySelector('[data-prx-readout="inspected-risk"]').dataset.num, "1/10");
      assert.match(m.root.querySelector('[data-prx-readout="inspected-status"]').textContent, /exact optimizer/);
    }
  } finally { m.close(); }
});

test("P.1 off-diagonal common-card queries normalize the actual public state", () => {
  const m = mount("?report=common&candidate=p%3A1%2C2%7C2%2C1"); try {
    assert.equal(m.handle.state.report, "common"); assert.equal(m.handle.state.candidate, "canonical");
    assert.equal(solveProfileCommon(m.handle.state).focus.riskExact, "1/4");
    const select = [...m.root.querySelectorAll("label")].find((node) => node.textContent === "Card to inspect").control;
    assert.equal([...select.options].filter((option) => option.disabled).length, 6);
    assert.deepEqual(widgetFindings(m.root), []);
  } finally { m.close(); }
});

test("P.1 policy and report controls reset inspection, while unit selection leaves calculations unchanged", () => {
  const m = mount(); try {
    m.handle.update({ candidate: "p:1,2|2,1", unit: "B" });
    const fit = solveProfileCommon(m.handle.state).fit;
    const select = (label) => [...m.root.querySelectorAll("label")].find((node) => node.textContent === label).control;
    const tau = select("Withholding cost"); tau.value = "1"; tau.dispatchEvent(new m.dom.window.Event("change", { bubbles: true }));
    assert.equal(m.handle.state.tauIndex, 1); assert.equal(m.handle.state.candidate, "canonical");
    m.handle.update({ candidate: "p:1,2|2,1" });
    const report = select("Report space to inspect"); report.value = "0"; report.dispatchEvent(new m.dom.window.Event("change", { bubbles: true }));
    assert.equal(m.handle.state.report, "common"); assert.equal(m.handle.state.candidate, "canonical");
    m.handle.update(canonical);
    const before = solveProfileCommon(m.handle.state);
    m.handle.update({ unit: "B" });
    const after = solveProfileCommon(m.handle.state);
    assert.equal(after.fit, before.fit); assert.equal(after.common, before.common); assert.equal(after.gapExact, before.gapExact);
    assert.equal(after.fit, fit);
  } finally { m.close(); }
});

test("P.1 complete catalog presets replay all six settings and URL states deterministically", () => {
  assert.equal(entry.presets.length, 4);
  const m = mount(); try {
    for (const preset of entry.presets) {
      const values = parsePresetQuery(preset.query);
      assert.deepEqual(Object.keys(values).sort(), Object.keys(canonical).sort());
      m.handle.update({ report: "common", candidate: "p:2,1|2,1", unit: "B" });
      m.handle.applyPreset(preset.id);
      assert.equal(m.handle.state.law, values.law); assert.equal(m.handle.state.tauIndex, Number(values.tauIndex)); assert.equal(m.handle.state.weightIndex, Number(values.weightIndex));
      assert.equal(m.handle.state.candidate, "canonical"); assert.equal(m.handle.state.report, "profile"); assert.equal(m.handle.state.unit, "A");
      const replay = mount(`?${preset.query}`);
      try { assert.deepEqual(replay.handle.state, m.handle.state); assert.equal(solveProfileCommon(replay.handle.state).gapExact, solveProfileCommon(m.handle.state).gapExact); } finally { replay.close(); }
    }
  } finally { m.close(); }
});
