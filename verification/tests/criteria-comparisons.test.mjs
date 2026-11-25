import assert from "node:assert/strict";
import { test } from "node:test";
import { mountCase } from "../widget_harness.mjs";

async function inspect(app, query, check) {
  const mounted = await mountCase({ module: `js/apps/${app}.js`, query });
  try {
    const stage = mounted.root.querySelector(".prx-stage");
    assert.ok(stage);
    check(stage, mounted.root);
  } finally {
    mounted.close();
  }
}

test("4.3 relates grade assignments to pair relations and weighted directional errors on the open stage", async () => {
  for (const query of ["", "?w=0&cap=2"]) {
    await inspect("two-scores", query, stage => {
      assert.ok(stage.querySelector(".tws-stage-slope svg"));
      assert.ok(stage.querySelector(".tws-detail-grid section svg"));
      assert.match(stage.querySelector('[aria-label="Weighted errors for a pair"]').textContent, /reverse/);
      assert.ok(stage.querySelector(".tws-stage-bar .tws-chips").textContent.includes("A"));
    });
  }
});

test("4.5 exposes all live own reports and the assignments supplied for the archived example", async () => {
  for (const query of ["?w=0", "?data=thirty35"]) {
    await inspect("common-grade-cost", query, (stage, root) => {
      const reports = stage.querySelector(".cgc-reports");
      assert.ok(stage.querySelector(".cgc-cost svg"));
      if (query.includes("thirty")) {
        assert.equal(reports.querySelectorAll(".cgc-paper").length, 1);
        assert.match(reports.textContent, /own report/);
      } else {
        assert.equal(reports.querySelectorAll(".cgc-common").length, +root.querySelector('[data-prx-readout="common-tieCount"]').dataset.num);
        assert.ok(reports.querySelectorAll(".cgc-paper:not(.cgc-common)").length >= 2);
      }
    });
  }
});

test("4.9 gives both objectives' report vectors and names the largest criterion risk on stage", async () => {
  for (const query of ["", "?data=six&w=1"]) {
    await inspect("worst-criterion", query, stage => {
      const cols = [...stage.querySelectorAll(".wcr-comparison .wcr-rule-col")];
      assert.equal(cols.length, 2);
      for (const col of cols) {
        const card = col.querySelector(".wcr-card");
        assert.ok(card.querySelector(".tws-chips"));
        assert.match(card.textContent, /\(worst\)/);
        const row = [...card.querySelectorAll("p")].find(p => p.textContent.includes("(worst)"));
        const risks = [...row.querySelectorAll("[data-num]")].map(n => ({ risk: +n.dataset.num, worst: n.nextSibling.textContent.startsWith(" (worst)") }));
        assert.equal(risks.length, 2);
        for (const r of risks) assert.equal(r.worst, r.risk === Math.max(...risks.map(x => x.risk)));
      }
    });
  }
});

test("5.9 changes the second view with the selected disclosure, retaining the full tertile reference", async () => {
  for (const N of [48,46,21]) {
    await inspect("cde-one-disclosure", "?n=" + N, (stage, root) => {
      const panel = stage.querySelector(".prx-cd-view-matched > section:nth-child(2)");
      assert.ok(panel);
      assert.equal(+root.querySelector('[data-prx-readout="hist-count"]').dataset.num, 34650);
      if (N === 46) {
        assert.match(panel.textContent, /No single report/);
        assert.deepEqual([...panel.querySelectorAll("p [data-num]")].slice(0,4).map(n => +n.dataset.num), [46,45,47,0.5]);
      } else {
        assert.ok(panel.querySelector("svg"));
        assert.ok(panel.textContent.includes(String(N)));
      }
    });
  }
});
