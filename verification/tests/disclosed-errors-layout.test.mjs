// disclosed-errors-layout.test.mjs (review 044 repair, Phase 4, group G-B): app 2.8's result-first redesign (X-01,
// G2-F4, G2-F6) and its importer 2.9. The controls row holds the Example radio, the Report select and the τ slider; the
// grade selects, the family radio and the seed sit in a closed "Grades, family and seed" box in the controls row,
// which choosing "Your own" opens. The charts are in the phone order (matrix, result column, this draw, bound row);
// the result column holds the tiles, the finite law's coupling slider directly under them, and the Draw buttons
// directly above the histogram; the bound row holds the one-line badge (data-prx-bound on its wrapper, the badge's
// state in data-prx-badge), the diagnostic line and a closed "Why" box. The read-out ends with one of three statements.
// 2.9 keeps the original histogram and running average (the new drawHistogram/drawRunningAverage options are off).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCase, settle } from "../widget_harness.mjs";

const MODULE = "js/apps/disclosed-errors.js";
const partsOf = (root) => [...root.children].map((n) => n.getAttribute("data-prx-part") ?? n.tagName.toLowerCase());

test("2.8: result-first frame; one control row, the settings box before the presets, closed", async () => {
  const m = await mountCase({ module: MODULE, query: "" });
  try {
    const root = m.root;
    assert.equal(root.getAttribute("data-prx-layout"), "result-first");
    assert.deepEqual(partsOf(root).filter((p) => p !== "title"), ["controls", "readout", "chart", "caption"]);
    const controls = root.querySelector('[data-prx-part="controls"]');
    const kids = [...controls.children];
    const at = (pred) => kids.findIndex(pred);
    const law = at((n) => n.classList.contains("prx-de-law"));
    const report = at((n) => n.classList.contains("prx-de-report"));
    const tau = at((n) => n.querySelector?.('input[name="tau"]'));
    const box = at((n) => n.matches?.('details[data-prx-disclosure="settings"]'));
    const presets = at((n) => n.getAttribute("data-prx-part") === "presets");
    assert.deepEqual([law, report, tau, box, presets], [0, 1, 2, 3, 4], "Example, Report, τ, the box, then the preset row");
    const settings = kids[box];
    assert.equal(settings.open, false, "closed by default");
    assert.equal(settings.getAttribute("data-prx-placement"), "controls");
    assert.equal(settings.querySelector("summary").textContent, "Grades, family and seed");
    // the box holds every grade select of both laws, the family radio and the seed field
    assert.equal(settings.querySelectorAll('select[name^="grade-six-"]').length, 6);
    assert.equal(settings.querySelectorAll('select[name^="grade-finite-"]').length, 3);
    assert.ok(settings.querySelector(".prx-de-family"));
    assert.ok(settings.querySelector('input[name="seed"]'));
    // the Report selects are the primary controls; the matrix is the primary graphic
    assert.deepEqual([...root.querySelectorAll("[data-prx-primary-control]")].map((n) => n.name), ["report-six", "report-finite"]);
    const primary = root.querySelectorAll("[data-prx-primary]");
    assert.equal(primary.length, 1);
    assert.ok(primary[0].classList.contains("prx-de-matrix") && primary[0].querySelector("svg"));
  } finally { m.close(); }
});

test("2.8: the charts in the phone order; the Draw buttons directly above the histogram; tiles kept across a draw", async () => {
  const m = await mountCase({ module: MODULE, query: "" });
  try {
    const main = m.root.querySelector(".prx-de-main");
    assert.deepEqual([...main.children].map((n) => [...n.classList].find((c) => c.startsWith("prx-de-area-"))),
      ["prx-de-area-matrix", "prx-de-area-result", "prx-de-area-draw", "prx-de-area-bound"]);
    const draws = m.root.querySelector(".prx-de-draws");
    const order = [...draws.children].map((n) => n.classList.contains("prx-de-draw-row") ? "buttons"
      : n.classList.contains("prx-de-sub") ? (n.querySelector("h4").textContent.startsWith("Draws by") ? "histogram" : "running") : n.className);
    assert.equal(order[0], "buttons");
    assert.ok(order.indexOf("histogram") > 0 && order.indexOf("running") > order.indexOf("histogram"));
    // nothing visible between the buttons and the histogram once there are draws but the cap note (shown only at the cap)
    const tileBefore = m.root.querySelector('.prx-de-tiles > .prx-de-tile:nth-child(4)');
    m.handle.update({ draws: 100 });
    await settle(m.win, m.el);
    const shown = [...draws.children].filter((n) => !n.hidden);
    const iButtons = shown.findIndex((n) => n.classList.contains("prx-de-draw-row"));
    assert.ok(shown[iButtons + 1].classList.contains("prx-de-sub") && shown[iButtons + 1].querySelector("h4").textContent.startsWith("Draws by"),
      "the histogram follows the buttons");
    // the zero bin carries its words on the figure, below its tick (no digits, so no data-num needed)
    assert.match(shown[iButtons + 1].querySelector("svg").textContent.replace(/\s+/g, " "), /every stated ?direction right/);
    // the tiles are kept (rewritten, not replaced), so a first draw does not move what is under them
    assert.equal(m.root.querySelector('.prx-de-tiles > .prx-de-tile:nth-child(4)'), tileBefore);
    assert.equal(tileBefore.querySelector('[data-prx-readout="allRight"]').textContent, ".690");
    // the seed beside the buttons
    assert.equal(m.root.querySelector(".prx-de-seedtag").textContent, "seed 1");
  } finally { m.close(); }
});

test("2.8: finite law: the coupling slider directly under the tiles; hidden for the six sites", async () => {
  const m = await mountCase({ module: MODULE, query: "?preset=finite-112" });
  try {
    const tiles = m.root.querySelector(".prx-de-tiles");
    const next = tiles.nextElementSibling;
    assert.ok(next.classList.contains("prx-de-coupling") && !next.hidden && next.querySelector('input[name="coupling"]'));
    assert.ok(tiles.querySelector('[data-prx-readout="allRight"]') && tiles.querySelector('[data-prx-readout="unionLower"]'));
    assert.equal(m.root.querySelector('details[data-prx-disclosure="settings"] summary').textContent, "Grades and seed");
    m.handle.update({ law: "six", grades: [1, 2, 3, 3, 4, 5] });
    await settle(m.win, m.el);
    assert.equal(next.hidden, true);
    assert.equal(m.root.querySelector('details[data-prx-disclosure="settings"] summary').textContent, "Grades, family and seed");
  } finally { m.close(); }
});

test("2.8: choosing Your own opens the settings box and keeps the menu on Your own", async () => {
  const m = await mountCase({ module: MODULE, query: "" });
  try {
    const settings = m.root.querySelector('details[data-prx-disclosure="settings"]');
    const select = m.root.querySelector('select[name="report-six"]');
    const own = [...select.options].findIndex((o) => o.textContent.startsWith("Your own"));
    select.value = String(own);
    select.dispatchEvent(new m.win.Event("change", { bubbles: true }));
    await settle(m.win, m.el);
    await new Promise((r) => setTimeout(r, 50));
    await settle(m.win, m.el);
    assert.equal(settings.open, true);
    assert.equal(select.value, String(own));
    assert.deepEqual(m.handle.state.grades, [1, 2, 3, 3, 4, 5], "no state change");
  } finally { m.close(); }
});

test("2.8: three statements in the read-out and the badge (G2-F6); the bound's wording stays in its wrapper", async () => {
  const cases = [
    ["?grades=1,2,3,3,4,5&cap=none", "applies", "applies", "; E ≤ τN guaranteed (exact optimum of a family with all-withheld)."],
    ["?grades=1,2,3,4,5,6", "not-shown", "holds", "; E ≤ τN holds here but is not guaranteed (this report is not the family optimum)."],
    ["?grades=6,5,4,3,2,1", "not-shown", "fails", "; E > τN: worse than withholding every pair."],
    ["?grades=1,2,3,3,4,5&cap=3", "not-shown", "holds", "; E ≤ τN holds here but is not guaranteed (this report is not in the family shown)."],
    ["?grades=1,1,1,1,1,1", "not-shown", "holds", "; E ≤ τN holds here but is not guaranteed (this report is not the family optimum)."],
    ["?law=finite&grades=1,1,1&tau=.05", "applies", "applies", "; E ≤ τN guaranteed (exact optimum of a family with all-withheld)."],
  ];
  const badgeStart = { applies: "E ≤ τN applies:", holds: "E ≤ τN holds here but is not guaranteed:", fails: "E > τN:" };
  for (const [q, bound, badge, clause] of cases) {
    const m = await mountCase({ module: MODULE, query: q });
    try {
      const wrap = m.root.querySelectorAll("[data-prx-bound]");
      assert.equal(wrap.length, 1, q);
      assert.equal(wrap[0].getAttribute("data-prx-bound"), bound, q);
      const line = wrap[0].querySelector("[data-prx-badge]");
      assert.equal(line.getAttribute("data-prx-badge"), badge, q);
      assert.ok(line.textContent.startsWith(badgeStart[badge]), `${q}: ${line.textContent}`);
      const ro = m.root.querySelector(".prx-readout").textContent;
      assert.ok(ro.includes(clause), `${q}: ${ro}`);
      // the Why box is closed and inside the wrapper; a report without the bound keeps "not a bound" there
      const why = wrap[0].querySelector('details[data-prx-disclosure="why"]');
      assert.ok(why && !why.open, q);
      if (bound === "not-shown") assert.ok(why.textContent.includes("not a bound"), q);
      // the one diagnostic line is outside the box
      assert.ok(wrap[0].querySelector(":scope > [data-prx-diagnostic]"), q);
    } finally { m.close(); }
  }
});

test("2.9 (importer): the original histogram and running average, without the zero-bin words", async () => {
  const m = await mountCase({ module: "js/apps/reported-and-realized.js", query: "?preset=same" });
  try {
    const svgs = [...m.root.querySelectorAll("figure svg")];
    const hist = svgs.find((s) => /wrong stated directions in a draw/.test(s.textContent));
    assert.ok(hist);
    assert.equal(Number(hist.getAttribute("height")), 176);
    assert.doesNotMatch(hist.textContent, /every stated/);
    const run = svgs.find((s) => /draws so far/.test(s.textContent));
    assert.equal(Number(run.getAttribute("height")), 196);
    // the report selection strip: prior SD, τ, maximum grades and the replay shown, before the preset row
    const strip = m.root.querySelector('[data-prx-part="controls"] > .prx-rr-strip');
    assert.deepEqual([...strip.querySelectorAll("input")].map((i) => i.name), ["priorSd", "tau", "cap", "replay"]);
    assert.equal(m.root.getAttribute("data-prx-layout"), "result-first");
    assert.ok(m.root.querySelector("[data-prx-primary]")?.querySelector("svg"), "the comparison chart is the primary graphic");
  } finally { m.close(); }
});
