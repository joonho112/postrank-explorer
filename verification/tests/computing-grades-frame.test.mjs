// 2.16 computing-grades in the result-first frame (review 044 repair, builder G-D): the four views keep the preset row
// in place (the view chips before it, each view's own controls after it), every view has its method-scope line right
// under the read-out, the thirteen patterns are chips that set the pattern (G4-F3), the dynamic program's read-out is the
// review's replacement copy with its label from labels.js, the counts written beside the family-size points equal the
// read-out and never overlap, and the solver's status chip says what has run. Expected values come from an independent
// enumeration in this file or from the app's own read-out (the read-out cases pin those against golden rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "../dom-env.mjs";

const { mountCase } = await import(`${ROOT}verification/widget_harness.mjs`);
const MODULE = "js/apps/computing-grades.js";
const app = await import(`${ROOT}${MODULE}`);

const VIEWS = { count: ["n", "cap"], encoding: ["pattern", "invalid"], dp: ["cap", "tau"], solver: ["solverN", "tau", "timeLimit"] };
const ALL_CONTROLS = ["n", "cap", "solverN", "tau", "timeLimit", "pattern", "invalid"];

/** The canonical grade vectors on three units in lexicographic order, counted here (not by the engine). */
function patternsOnThree() {
  const out = [];
  for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) {
    const g = [a, b, c], used = [...new Set(g)].sort();
    if (used.every((v, i) => v === i + 1)) out.push(g);
  }
  return out;
}

test("2.16: the preset row stays between the view chips and each view's own controls; every view has its scope line", async () => {
  for (const [view, own] of Object.entries(VIEWS)) {
    const m = await mountCase({ module: MODULE, query: `?view=${view}` });
    try {
      const { root } = m;
      assert.equal(root.getAttribute("data-prx-layout"), "result-first");
      const controls = root.querySelector(".prx-controls");
      const kids = [...controls.children];
      const chips = kids.findIndex((n) => n.querySelector?.('[data-value="count"]'));
      const presets = kids.findIndex((n) => n.matches('[data-prx-part~="presets"]'));
      const rowOf = kids.findIndex((n) => n.classList.contains("prx-cg-controls"));
      assert.ok(chips >= 0 && chips < presets && presets < rowOf, `${view}: chips, presets, then the view's controls`);
      // the read-out follows the controls, the scope line opens the charts
      assert.equal(controls.nextElementSibling, root.querySelector(".prx-readout"), view);
      const scope = root.querySelector(".prx-charts > [data-prx-scope]");
      assert.ok(scope && scope.textContent.trim().length > 20, `${view}: scope line`);
      assert.equal(root.querySelector(".prx-charts").firstElementChild, scope, `${view}: scope line first`);
      for (const name of ALL_CONTROLS) {
        const input = root.querySelector(`input[name="${name}"]`);
        assert.ok(input, `${name} kept in the DOM`);
        assert.equal(Boolean(input.closest("[hidden]")), !own.includes(name), `${view}: ${name} shown only in its views`);
      }
      assert.equal(Boolean(root.querySelector("[data-prx-solve]").closest("[hidden]")), view !== "solver", `${view}: the solve button`);
      for (const [k, node] of [...root.querySelectorAll("[data-prx-view]")].map((n) => [n.getAttribute("data-prx-view"), n])) assert.equal(node.hidden, k !== view, `${view}: section ${k}`);
    } finally { m.close(); }
  }
});

test("2.16: the thirteen patterns are chips; a chip sets the pattern, the broken chip shows the violation (G4-F3)", async () => {
  const want = patternsOnThree();
  assert.equal(want.length, 13);
  const m = await mountCase({ module: MODULE, query: "?view=encoding&pattern=0" });
  try {
    const chips = () => [...m.root.querySelectorAll(".prx-cg-patterns button")];
    assert.equal(chips().length, 14, "13 patterns and the broken pattern");
    chips().slice(0, 13).forEach((b, i) => assert.ok(b.closest("li").textContent.startsWith(`${i}: ${want[i].join("/")}`), `chip ${i}`));
    chips()[5].click();
    assert.equal(m.handle.state.pattern, 5);
    assert.equal(m.handle.state.invalid, false);
    assert.equal(m.root.querySelector('[data-prx-readout="binary-grade"]').textContent, want[5].join("/"));
    assert.equal(chips()[5].getAttribute("aria-pressed"), "true");
    chips()[13].click();
    assert.equal(m.handle.state.invalid, true);
    assert.equal(m.root.querySelector('[data-prx-readout="violation"]').getAttribute("data-num"), "2");
    assert.equal(chips()[13].getAttribute("aria-pressed"), "true");
    assert.ok(chips().slice(0, 13).every((b) => b.getAttribute("aria-pressed") === "false"));
  } finally { m.close(); }
});

test("2.16: the dynamic program's read-out is the review copy, its label from labels.js, both risks kept", async () => {
  for (const [query, cap] of [["", 3], ["?cap=2", 2], ["?cap=6&tau=.40", 6], ["?cap=1", 1]]) {
    const m = await mountCase({ module: MODULE, query });
    try {
      const ro = m.root.querySelector(".prx-readout");
      const text = ro.textContent.replace(/\s+/g, " ");
      assert.match(text, /^Fixed-order DP: optimal within this order \(/, query);
      assert.equal(ro.querySelector("[data-prx-label]").getAttribute("data-prx-label"), "optimal-within-order");
      const dpRisk = ro.querySelector('[data-prx-readout="dp-readout-risk"]').getAttribute("data-num");
      const exRisk = ro.querySelector('[data-prx-readout="dp-readout-capped-risk"]').getAttribute("data-num");
      // the same numbers as the scope line and the recursion box
      assert.equal(dpRisk, m.root.querySelector('[data-prx-readout="dp-risk"]').getAttribute("data-num"), query);
      assert.equal(exRisk, m.root.querySelector('[data-prx-readout="exact-risk"]').getAttribute("data-num"), query);
      const same = m.root.querySelector('[data-prx-readout="dp-grades"]').getAttribute("data-num") === m.root.querySelector('[data-prx-readout="exact-grades"]').getAttribute("data-num");
      assert.equal(text.includes("finds the same report"), same, query);
      assert.ok(cap === 1 ? text.includes("report with at most 1 grade") : text.includes(`grades finds`), query);
      assert.doesNotMatch(text, /\b1 (reports|grades)\b/, query);
    } finally { m.close(); }
  }
});

test("2.16: the counts beside the family-size points equal the read-out, sit beside the rule and never overlap", async () => {
  const rows = (cap) => Array.from({ length: 11 }, (_, i) => {
    const n = i + 2;
    // Fubini numbers a(n), and the capped and ordered counts by direct sums (independent of the engine)
    const S = (n, k) => { let s = 0n; for (let j = 0; j <= k; j++) { let c = 1n; for (let t = 0; t < j; t++) c = c * BigInt(k - t) / BigInt(t + 1); s += (j % 2 ? -1n : 1n) * c * BigInt(k - j) ** BigInt(n); } let f = 1n; for (let t = 2; t <= k; t++) f *= BigInt(t); return s / f; };
    const fact = (k) => { let f = 1n; for (let t = 2; t <= k; t++) f *= BigInt(t); return f; };
    const surj = (k) => fact(k) * S(n, k);
    const binom = (a, b) => { let c = 1n; for (let t = 0; t < b; t++) c = c * BigInt(a - t) / BigInt(t + 1); return c; };
    let all = 0n, capped = 0n, ordered = 0n;
    for (let k = 1; k <= n; k++) all += surj(k);
    for (let k = 1; k <= Math.min(cap, n); k++) { capped += surj(k); ordered += binom(n - 1, k - 1); }
    return { n, all: Number(all), capped: Number(capped), ordered: Number(ordered) };
  });
  for (const width of [311, 640, 958, 1124]) {
    for (let cap = 1; cap <= 6; cap++) {
      const table = rows(cap);
      for (let n = 2; n <= 12; n++) {
        const sel = table[n - 2];
        const labels = app.placeCountLabels(width, table, sel, n);
        const values = new Set([sel.all, sel.capped, sel.ordered]);
        assert.equal(labels.length, values.size, `equal counts share a label (n ${n}, cap ${cap})`);
        for (const l of labels) assert.ok(values.has(Number(l.v)));
      }
    }
  }
  const m = await mountCase({ module: MODULE, query: "?view=count&n=12&cap=3" });
  try {
    for (const key of ["all", "capped", "order"]) {
      const label = m.root.querySelector(`[data-prx-readout="count-label-${key}"]`);
      assert.ok(label, key);
      assert.equal(label.getAttribute("data-num"), m.root.querySelector(`.prx-readout [data-prx-readout="count-${key}"]`).getAttribute("data-num"), key);
    }
  } finally { m.close(); }
});

test("2.16: the status chip says what has run; the result table keeps the solver status hook", async () => {
  const m = await mountCase({ module: MODULE, query: "?view=solver&solverN=6&tau=.25" });
  try {
    const chip = m.root.querySelector("[data-prx-solver-chip]");
    assert.equal(chip.textContent, "Not run at these settings");
    assert.equal(chip.getAttribute("data-state"), "idle");
    assert.equal(chip.hasAttribute("data-prx-solver-status"), false, "the chip is not the result table's status");
    assert.equal(m.root.querySelector("[data-prx-solver-status]"), null, "no result before a solve");
    assert.match(m.root.querySelector("[data-prx-scope]").textContent, /not an exact arithmetic certificate/);
    assert.equal(m.win.PRX_SOLVER, undefined, "the solver is not loaded at mount");
  } finally { m.close(); }
});
