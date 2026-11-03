// G-05 disclosed-errors: (1) no path shows the share as 0 when nothing is stated (CONTRACT 3.5, 5: "NA: no disclosure";
// the vocabulary rule flags "E/N = 0"), for every all-withheld report, both examples, a range of τ, with and without
// draws, before and after a draw is added through update(); (2) the six-site draws and their wrong counts agree with an
// independent recount from the base-R draws of oracle-stream (gaussianDraws-six-scoreA-sd.2-S5-seed424242), compared
// directly (theta_i <= theta_j for each stated i above j), not through the engine; (3) the three-unit law's draws agree
// with the base-R uniforms of oracle-stream (uniforms-seed1-12) mapped to the four orders by their cumulative
// probabilities; (4) the bound is shown exactly when the report is one of the exact optima of the family shown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOT } from "../dom-env.mjs";

const { mountCase } = await import(`${ROOT}verification/widget_harness.mjs`);
const golden = (g) => JSON.parse(readFileSync(`${ROOT}verification/golden/${g}.json`, "utf8"));
const row = (g, id) => golden(g).rows.find((r) => r.id === id);
const MODULE = "js/apps/disclosed-errors.js";
const ratioPlaces = ['[data-prx-readout="EoverN"]', '[data-prx-readout="boundEN"]', '[data-prx-readout="lastShare"]', '[data-prx-readout="meanShare"]'];

/** Every visible element whose text could be read as the share being zero, and every share read-out. */
function zeroShareFindings(root) {
  const out = [];
  for (const sel of ratioPlaces) {
    for (const n of root.querySelectorAll(sel)) {
      if (n.closest("[hidden]")) continue;
      if (n.textContent !== "NA: no disclosure") out.push(`${sel} reads "${n.textContent}"`);
      if (n.getAttribute("data-num") !== "NA") out.push(`${sel} data-num ${n.getAttribute("data-num")}`);
    }
  }
  const text = root.textContent.replace(/\s+/g, " ");
  if (/E\/N\s*=\s*0(?![.\d])/.test(text)) out.push("text contains E/N = 0");
  if (/share[^.;:]*?\b0(?![.\d/])/.test(text.replace(/N\/M = 0/g, ""))) out.push("text gives a share of 0");
  return out;
}

test("G-05: at N = 0 every share reads NA: no disclosure, never 0", async () => {
  const queries = [];
  for (const tau of [".02", ".05", ".09", ".10", ".20", ".35", ".50"]) {
    for (const draws of [0, 1, 7]) {
      queries.push(`?law=six&grades=1,1,1,1,1,1&cap=none&tau=${tau}&draws=${draws}&seed=3`);
      queries.push(`?law=six&grades=2,2,2,2,2,2&cap=3&tau=${tau}&draws=${draws}&seed=1`);
      queries.push(`?law=finite&grades=1,1,1&tau=${tau}&draws=${draws}&seed=1`);
    }
  }
  let mounted = 0;
  for (const query of queries) {
    const m = await mountCase({ module: MODULE, query });
    try {
      assert.deepEqual(zeroShareFindings(m.root), [], query);
      assert.equal(m.root.querySelector('[data-prx-readout="N"]').textContent, "0", query);
      // a draw added through update() keeps the NA
      m.handle.update({ draws: m.handle.state.draws + 5 });
      assert.deepEqual(zeroShareFindings(m.root), [], `${query} + 5 draws`);
      mounted += 1;
    } finally { m.close(); }
  }
  assert.equal(mounted, queries.length);
});

test("G-05: with a stated pair the shares are numbers (the NA is tied to N = 0)", async () => {
  const m = await mountCase({ module: MODULE, query: "?grades=1,1,1,1,1,2&draws=4&seed=2" });
  try {
    for (const sel of ['[data-prx-readout="EoverN"]', '[data-prx-readout="meanShare"]']) {
      const n = m.root.querySelector(sel);
      assert.notEqual(n.getAttribute("data-num"), "NA", sel);
    }
  } finally { m.close(); }
});

test("G-05: six-site draws and wrong counts agree with a recount from the base-R draws (seed 424242)", async () => {
  const r = row("oracle-stream", "gaussianDraws-six-scoreA-sd.2-S5-seed424242");
  const g = [1, 2, 3, 3, 4, 5];
  const ids = ["A", "B", "C", "D", "E", "F"];
  const recount = r.expect.draws.map((d) => {
    let k = 0;
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) if (g[i] < g[j] && d[i][0] <= d[j][0]) k += 1;
    return k;
  });
  assert.deepEqual(recount, [1, 1, 1, 2, 1]);
  for (let S = 1; S <= 5; S += 1) {
    const m = await mountCase({ module: MODULE, query: `?grades=1,2,3,3,4,5&seed=424242&draws=${S}` });
    try {
      const last = Number(m.root.querySelector('[data-prx-readout="last"]').getAttribute("data-num"));
      const mean = Number(m.root.querySelector('[data-prx-readout="mean"]').getAttribute("data-num"));
      assert.equal(last, recount[S - 1], `draw ${S}`);
      assert.ok(Math.abs(mean - recount.slice(0, S).reduce((a, b) => a + b, 0) / S) < 1e-12, `mean after ${S}`);
      ids.forEach((u, i) => {
        const v = Number(m.root.querySelector(`[data-prx-readout="theta.${u}"]`).getAttribute("data-num"));
        assert.ok(Math.abs(v - r.expect.draws[S - 1][i][0]) < 1e-12, `theta ${u} in draw ${S}`);
      });
      // the crossed cells of the matrix are exactly the wrong stated directions of the last draw
      const d = r.expect.draws[S - 1];
      const want = [];
      for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) if (g[i] < g[j] && d[i][0] <= d[j][0]) want.push(`${ids[i]} above ${ids[j]}`);
      const line = m.root.querySelector(".prx-de-drawline").textContent;
      for (const w of want) assert.ok(line.includes(w), `draw ${S} names ${w}`);
      const rows = [...m.root.querySelectorAll(".prx-de-matrix .prx-data-table tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent));
      const crossed = rows.filter((c) => c[3] === "yes").map((c) => c[0]).sort();
      assert.deepEqual(crossed, want.slice().sort(), `draw ${S} matrix table`);
    } finally { m.close(); }
  }
});

test("G-05: three-unit-law draws agree with the base-R uniforms (seed 1)", async () => {
  const u = row("oracle-stream", "uniforms-seed1-12").expect.u33.map((x) => x / 2 ** 33);
  const cum = [0.6, 0.75, 0.9, 1];
  const orders = ["A > B > C", "A > C > B", "B > A > C", "C > B > A"];
  // report 1/1/2 states A above C and B above C: wrong counts per order ABC, ACB, BAC, CBA
  const wrong = [0, 1, 0, 2];
  const picked = u.map((x) => cum.findIndex((c) => x < c));
  for (let S = 1; S <= u.length; S += 1) {
    const m = await mountCase({ module: MODULE, query: `?law=finite&grades=1,1,2&seed=1&draws=${S}` });
    try {
      const line = m.root.querySelector(".prx-de-drawline").textContent;
      assert.ok(line.includes(`the order ${orders[picked[S - 1]]}`), `draw ${S}: ${line}`);
      const mean = Number(m.root.querySelector('[data-prx-readout="mean"]').getAttribute("data-num"));
      const want = picked.slice(0, S).reduce((a, k) => a + wrong[k], 0) / S;
      assert.ok(Math.abs(mean - want) < 1e-12, `mean after ${S}`);
    } finally { m.close(); }
  }
});

test("G-05: the bound is shown exactly for an exact optimum of the family shown", async () => {
  const opt = golden("oracle-optimize").rows;
  const cases = [
    ["?grades=1,2,3,3,4,5&cap=none&tau=.20", "applies"],
    ["?grades=1,1,2,2,3,3&cap=3&tau=.20", "applies"],
    ["?grades=1,1,2,2,3,3&cap=none&tau=.20", "not-shown"],
    ["?grades=1,2,3,3,4,5&cap=3&tau=.20", "not-shown"],
    ["?grades=1,2,3,4,5,6&cap=none&tau=.20", "not-shown"],
    ["?grades=1,1,1,1,1,1&cap=none&tau=.50", "not-shown"],
    ["?law=finite&grades=1,2,2&tau=.20", "applies"],
    ["?law=finite&grades=1,2,3&tau=.20", "not-shown"],
  ];
  for (const tau of ["05", "15", "20", "25", "40", "50"]) {
    const best = opt.find((r) => r.id === `exactOptimum-six-A-all-tau.${tau}`).expect.grades;
    for (const g of best) cases.push([`?grades=${g.join(",")}&cap=none&tau=.${tau}`, "applies"]);
  }
  for (const [q, want] of cases) {
    const m = await mountCase({ module: MODULE, query: `?${q.slice(1)}` });
    try {
      assert.equal(m.root.querySelector("[data-prx-bound]").getAttribute("data-prx-bound"), want, q);
      if (want === "not-shown") assert.ok(m.root.querySelector("[data-prx-bound]").textContent.includes("not a bound"), q);
    } finally { m.close(); }
  }
});

test("G-05: for a report without the bound, the widget says E <= tau N holds exactly when its risk is at most tau", async () => {
  // E and N recounted from the released error array of score A, not through the engine
  const six = JSON.parse(readFileSync(`${ROOT}data/released/six-sites.json`, "utf8")).arrays.one.e[0];
  const recount = (g) => {
    let E = 0;
    let N = 0;
    for (let i = 0; i < g.length; i += 1) for (let j = 0; j < g.length; j += 1) if (g[i] < g[j]) { E += six[i][j]; N += 1; }
    return { E, N };
  };
  const reports = [[1, 2, 3, 4, 5, 6], [2, 2, 1, 2, 2, 2], [1, 1, 2, 2, 3, 3], [2, 1, 3, 3, 4, 5], [1, 2, 2, 2, 2, 2], [6, 5, 4, 3, 2, 1], [1, 1, 1, 2, 2, 2]];
  for (const tau of [0.05, 0.2, 0.35]) {
    for (const g of reports) {
      const q = `?law=six&cap=none&tau=${tau}&grades=${g.join(",")}`;
      const m = await mountCase({ module: MODULE, query: q });
      try {
        const bound = m.root.querySelector("[data-prx-bound]").getAttribute("data-prx-bound");
        const own = m.root.querySelector("[data-prx-own]");
        if (bound === "applies") { assert.equal(own, null, `${q}: no own-report line beside the bound`); continue; }
        const { E, N } = recount(g);
        assert.ok(own, `${q}: an own-report line`);
        assert.equal(own.getAttribute("data-prx-own"), E <= tau * N + 1e-12 ? "holds" : "fails", q);
        assert.ok(!/\bbound\b/.test(own.textContent), `${q}: the own-report line does not call E <= tau N a bound`);
      } finally { m.close(); }
    }
  }
});
