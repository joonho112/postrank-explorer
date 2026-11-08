// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWindow } from "../dom-env.mjs";
import { createWidget } from "../../js/shared/base.js";
import { dataNum, formatExactText as sharedExactText } from "../../js/shared/format.js";
import { formatExactText, exactNum, undefinedRatioNum, isCanonicalExact, gradeTable, profileGrid, profileCells, pairRows, pairTable, candidateTable, candidateIdNode, optimizerSummaryNode, resultScopeNode } from "../../js/shared/mdomain/index.js";
import { widgetFindings } from "../dom_rules.mjs";

function context() {
  const m = makeWindow({ plot: false }); let ctx;
  const handle = createWidget(m.el, {}, { name: "mdomain-ui-test", keys: {}, build(value) { ctx = value; return { render() {} }; } });
  return { ...m, ctx, cleanup() { handle.destroy(); m.restore(); } };
}

const grades = { unitIds: ["S11", "S18", "S20"], domainIds: ["S", "C"], values: [[1, 2], [2, 1], [2, 2]] };

function fit() {
  const vectors = [[1, 1], [1, 2], [2, 1]];
  const risk = ["1/4", "7/40", "23/40", "7/40", "1/10", "1/2", "23/40", "1/2", "9/10"];
  const joint = ["0", "1/10", "9/10", "1/10", "1/5", "9/10", "9/10", "9/10", "1"];
  const rows = vectors.flatMap((a, i) => vectors.map((b, j) => {
    const k = i * 3 + j;
    return { candidateId: `p:${a.join(",")}|${b.join(",")}`, grades: { unitIds: ["A", "B"], domainIds: ["S", "C"], values: a.map((g, u) => [g, b[u]]) }, riskExact: risk[k], jointProbabilityExact: joint[k], feasible: k === 0 || k === 1 || k === 3, optimal: k === 1 || k === 3, selected: k === 1 };
  }));
  return { familyId: "nine-cards", candidateTable: rows, optimizerIds: [rows[1].candidateId, rows[3].candidateId], selectedId: rows[1].candidateId, searchScope: { type: "declared_cartesian_product", candidateCount: 9, examinedActions: 9, fullProductExamined: true, unrestrictedOptimalityClaim: false } };
}

test("canonical exact raw attributes preserve fractions and unsafe-size integers without changing legacy raw numbers", () => {
  assert.equal(dataNum("1/3"), "1/3");
  assert.equal(dataNum("9007199254740993"), "9007199254740993");
  assert.equal(dataNum("1".repeat(400)), "1".repeat(400));
  assert.equal(dataNum(["1/3", "1/2"]), "1/3,1/2");
  assert.equal(dataNum("2/4"), "NA");
  assert.equal(dataNum("12.30"), "12.3");
  assert.equal(dataNum(-0.25), "-0.25");
  assert.equal(dataNum(123n), "123");
  assert.equal(dataNum(null), "NA");
  assert.equal(sharedExactText, formatExactText);
});

test("exact fraction displays reject noncanonical values rather than silently normalizing policies", () => {
  for (const raw of ["2/4", "1/1", "0/2", "01", "1.0", "-1/3", "1/0", " 1/3", 0.1, undefined]) {
    assert.equal(isCanonicalExact(raw), false);
    assert.throws(() => formatExactText(raw), TypeError);
  }
  assert.equal(formatExactText("7/40"), "7/40");
  assert.equal(formatExactText("9007199254740993"), "9007199254740993");
  assert.equal(formatExactText(null), "NA: no disclosure");
});

test("decimal display rounds exact fractions half-even with explicit bounded precision", () => {
  const decimal = (raw, digits) => formatExactText(raw, { style: "decimal", digits });
  assert.equal(decimal("1/8", 2), ".12");
  assert.equal(decimal("3/8", 2), ".38");
  assert.equal(decimal("1/3", 4), ".3333");
  assert.equal(decimal("1/20", 3), ".050");
  assert.equal(decimal("1/2", 0), "0");
  assert.equal(decimal("3/2", 0), "2");
  assert.equal(decimal("5/2", 0), "2");
  assert.equal(decimal("1/20000", 4), ".0000");
  assert.equal(decimal("3/20000", 4), ".0002");
  assert.equal(decimal("0", 4), "0");
  for (const digits of [-1, 21, 0.5, NaN]) assert.throws(() => decimal("1/3", digits), RangeError);
  assert.throws(() => formatExactText("1/3", { style: "unknown" }), TypeError);
});

test("exact numeric nodes retain raw fractions, display metadata, named hooks and null disclosure", () => {
  const m = context(); try {
    let observed;
    const node = exactNum(m.ctx, "7/40", { style: "decimal", digits: 4, part: "risk", field: "fit.riskExact", onReadout(value) { observed = value; } });
    m.el.append(node);
    assert.equal(node.dataset.num, "7/40"); assert.equal(node.textContent, ".1750");
    assert.equal(node.dataset.prxFormat, "mdomain-exact"); assert.equal(node.dataset.prxExactStyle, "decimal"); assert.equal(node.dataset.prxExactDigits, "4");
    assert.equal(node.dataset.prxPart, "risk"); assert.equal(node.dataset.prxMdomainField, "fit.riskExact");
    assert.equal(observed.raw, "7/40"); assert.equal(observed.node, node);
    const missing = undefinedRatioNum(m.ctx, null);
    assert.equal(missing.dataset.num, "NA"); assert.equal(missing.textContent, "NA: no disclosure");
    assert.equal(missing.dataset.prxFormat, "mdomain-exact"); assert.equal(missing.dataset.prxExactStyle, "fraction"); assert.equal(missing.dataset.prxExactDigits, "4");
  } finally { m.cleanup(); }
});

test("grade tables preserve original order, wrap numeric grades and mark numeric-looking IDs as names", () => {
  const m = context(); try {
    let selected;
    const node = gradeTable(m.ctx, grades, { selectedUnit: "S11", onSelectUnit(id) { selected = id; } }); m.el.append(node);
    assert.equal(node.getAttribute("role"), "region"); assert.equal(node.getAttribute("tabindex"), "0");
    assert.equal(node.querySelectorAll("tbody tr").length, 3);
    assert.deepEqual([...node.querySelectorAll("tbody th [data-prx-name]")].map((n) => n.textContent), ["S11", "S18", "S20"]);
    assert.deepEqual([...node.querySelectorAll("tbody td [data-num]")].map((n) => n.dataset.num), ["1", "2", "2", "1", "2", "2"]);
    node.querySelectorAll("button")[1].click(); assert.equal(selected, "S18");
  } finally { m.cleanup(); }
});

test("profile grids include empty cells, preserve row/column meanings and select through native controls", () => {
  const before = structuredClone(grades);
  assert.deepEqual(profileCells(grades), [
    { rowGrade: 1, columnGrade: 1, count: 0, members: [] },
    { rowGrade: 1, columnGrade: 2, count: 1, members: ["S18"] },
    { rowGrade: 2, columnGrade: 1, count: 1, members: ["S11"] },
    { rowGrade: 2, columnGrade: 2, count: 1, members: ["S20"] },
  ]);
  const m = context(); try {
    let selected;
    const node = profileGrid(m.ctx, grades, { onSelectCell(cell) { selected = cell; } }); m.el.append(node);
    assert.equal(node.querySelectorAll("tbody td").length, 4);
    assert.match(node.querySelector("tbody th").textContent, /^C grade 1$/);
    assert.match(node.querySelector("thead th:nth-child(2)").textContent, /^S grade 1$/);
    node.querySelector("button").click(); assert.equal(selected.count, 0); assert.deepEqual(selected.members, []);
    assert.deepEqual(grades, before);
  } finally { m.cleanup(); }
});

test("pair classifications distinguish neither, one domain, same and crossed directions without tuple ranking", () => {
  const matrix = { unitIds: ["A", "B", "C", "D", "E"], domainIds: ["S", "C"], values: [[1, 2], [2, 1], [1, 1], [2, 2], [1, 2]] };
  const rows = pairRows(matrix);
  assert.equal(rows.length, 10);
  const find = (a, b) => rows.find((row) => row.unitA === a && row.unitB === b);
  assert.equal(find("A", "B").classification, "crossed");
  assert.equal(find("A", "C").classification, "second_only");
  assert.equal(find("A", "D").classification, "first_only");
  assert.equal(find("C", "D").classification, "same_direction");
  assert.equal(find("A", "E").classification, "neither");
  assert.deepEqual(find("A", "B").directions, [1, -1]);
  assert.ok(rows.every((row) => !("overallRank" in row)));
});

test("pair and candidate tables provide complete text alternatives with exact source values", () => {
  const m = context(); try {
    const pairs = pairTable(m.ctx, grades, { units: ["S11", "S18"] }); m.el.append(pairs);
    assert.equal(pairs.querySelectorAll("tbody tr").length, 1); assert.match(pairs.textContent, /Opposite reported directions/);
    const result = fit(); const candidates = candidateTable(m.ctx, result); m.el.append(candidates);
    assert.equal(candidates.querySelectorAll("tbody tr").length, 9);
    assert.equal(candidates.querySelectorAll("[data-prx-format=mdomain-exact]").length, 18);
    assert.equal(candidates.querySelectorAll("tbody th [data-prx-mdomain-candidate-id]").length, 9);
    assert.equal(candidates.querySelectorAll("tbody tr")[1].querySelector("[data-prx-format]").dataset.num, "7/40");
    const withoutJoint = candidateTable(m.ctx, result, { jointEnabled: false });
    assert.equal(withoutJoint.querySelectorAll("[data-prx-format=mdomain-exact]").length, 9);
  } finally { m.cleanup(); }
});

test("scope and optimizer labels derive counts and retain every exact tied optimum", () => {
  const m = context(); try {
    const result = fit(); const scope = resultScopeNode(m.ctx, result); const optimizers = optimizerSummaryNode(m.ctx, result);
    m.el.append(scope, optimizers);
    assert.equal(scope.querySelector("[data-num]").dataset.num, "9"); assert.match(scope.textContent, /profile cards, covering every combination of the domain columns/);
    assert.equal(optimizers.querySelector("[data-num]").dataset.num, "2"); assert.equal(optimizers.querySelectorAll("li").length, 2);
    assert.equal(optimizers.querySelectorAll("li [data-prx-mdomain-candidate-id]").length, 2); assert.match(optimizers.textContent, /displayed by default/);
    assert.match(resultScopeNode(m.ctx, null, { kind: "fixed" }).textContent, /Evaluation of the grades shown here/);
    assert.match(resultScopeNode(m.ctx, null, { kind: "stored" }).textContent, /displays a saved profile report/);
    const invalid = fit(); invalid.searchScope.fullProductExamined = false;
    assert.throws(() => resultScopeNode(m.ctx, invalid), TypeError);
  } finally { m.cleanup(); }
});

test("candidate keys wrap every embedded grade and all shared views pass generic numeric coverage", () => {
  const m = context(); try {
    const id = candidateIdNode(m.ctx, "p:1,1|1,2");
    assert.equal(id.textContent, "p:1,1|1,2");
    assert.deepEqual([...id.querySelectorAll("[data-num]")].map((node) => node.dataset.num), ["1", "1", "1", "2"]);
    for (const invalid of ["p:01,1|1,2", "p:1,3|1,2", "p:1,1|1", "action-1"]) assert.throws(() => candidateIdNode(m.ctx, invalid), TypeError);
    const all = m.ctx.h("section", { "data-prx-part": "chart" }, id, exactNum(m.ctx, null), gradeTable(m.ctx, grades), profileGrid(m.ctx, grades), pairTable(m.ctx, grades), candidateTable(m.ctx, fit()), optimizerSummaryNode(m.ctx, fit()), resultScopeNode(m.ctx, fit()));
    m.el.append(all);
    assert.deepEqual(widgetFindings(m.el), []);
  } finally { m.cleanup(); }
});

test("shared tables keep readable cells inside their horizontal scroll wrapper", () => {
  const m = context(); try {
    for (const node of [gradeTable(m.ctx, grades), profileGrid(m.ctx, grades), pairTable(m.ctx, grades), candidateTable(m.ctx, fit())]) {
      m.el.append(node);
      const table = node.querySelector("table");
      assert.equal(node.tagName, "DIV");
      assert.equal(node.getAttribute("role"), "region");
      assert.equal(node.getAttribute("tabindex"), "0");
      assert.equal(node.style.overflowX, "auto");
      assert.equal(node.style.maxWidth, "100%");
      assert.equal(node.style.minWidth, "0");
      assert.equal(table.style.width, "max-content");
      assert.equal(table.style.minWidth, "100%");
      assert.equal(table.style.maxWidth, "none");
      assert.ok(table.querySelectorAll("th,td").length > 0);
      assert.ok([...table.querySelectorAll("th,td")].every((cell) => cell.style.whiteSpace === "nowrap"));
    }
  } finally { m.cleanup(); }
});
