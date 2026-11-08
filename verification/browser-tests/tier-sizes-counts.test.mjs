// Native count editing must preserve the first digit rather than applying a clamped intermediate count.
// Scientific expectations reuse the independent R29 rows; other assertions concern input/state plumbing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOT, launchChrome, openTab, startServer } from "../browser.mjs";

const rows = JSON.parse(readFileSync(new URL("../golden/oracle-v3p3.json", import.meta.url), "utf8")).rows;
const twelve = rows.find((r) => r.id === "disclosure-sizes-4-4-4").expect;
const fifteen = rows.find((r) => r.id === "sizes-n30-G15").expect;
const inspect = (frame) => frame.evaluate(() => {
  const n = document.querySelector('[name="n"]'), G = document.querySelector('[name="G"]');
  const number = (key) => JSON.parse(document.querySelector(`.prx-readout [data-prx-readout="${key}"]`).dataset.num);
  const feedback = document.querySelector('[data-prx-part="count-feedback"]');
  return { state: window.__prxApp.state, n: n.value, G: G.value, maxG: G.max, nInvalid: n.getAttribute("aria-invalid"),
    focus: document.activeElement?.name, appliedN: number("n"), appliedG: number("G"), stated: number("N"), pairs: number("M"),
    feedback: !feedback || feedback.hidden ? "" : feedback.innerText, overflow: document.documentElement.scrollWidth > innerWidth };
});
async function typeDraft(frame, page, name, value) {
  const input = await frame.$(`[name="${name}"]`);
  await input.focus(); await input.evaluate((n) => n.select());
  await page.keyboard.press("Backspace"); await page.keyboard.type(value);
}
const applied = async (frame, n, G) => {
  const s = await inspect(frame);
  assert.equal(s.state.n, n); assert.equal(s.state.G, G);
  assert.equal(s.n, String(n)); assert.equal(s.G, String(G)); assert.equal(s.maxG, String(n));
  assert.equal(s.appliedN, n); assert.equal(s.appliedG, G);
  const sizes = s.state.sizes.split(",").map(Number);
  assert.equal(sizes.length, G); assert.equal(sizes.reduce((a, b) => a + b, 0), n);
  assert.ok(sizes.every((v) => Number.isInteger(v) && v > 0)); assert.equal(s.overflow, false);
  return s;
};

test("Tier-size count drafts commit whole native values and retain atomic controls", async (t) => {
  const server = await startServer(ROOT, { virtual: { "/__count-frame.html": '<!doctype html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><iframe id="f" title="Tier size test" src="/embed/tier-sizes.html" style="width:100%;height:700px;border:0"></iframe>' } });
  let browser;
  t.after(async () => { await browser?.close(); await server.close(); });
  browser = await launchChrome();
  for (const width of [375, 1280]) for (const theme of ["light", "dark"]) await t.test(`${width}px ${theme}`, async (st) => {
    const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 812 });
    st.after(() => page.close());
    await page.goto(`${server.origin}/embed/tier-sizes.html?theme=${theme}`, { waitUntil: "load" });
    await page.waitForSelector('.prx-readout [data-prx-readout="n"]');
    for (const [value, preset, completion] of [["10", "balanced12", "Tab"], ["12", "balanced30", "Enter"], ["19", "balanced30", "Tab"]]) {
      await page.evaluate((preset) => window.__prxApp.applyPreset(preset), preset);
      const before = await inspect(page);
      await typeDraft(page, page, "n", "1");
      const first = await inspect(page);
      assert.equal(first.n, "1"); assert.deepEqual(first.state, before.state); assert.equal(first.focus, "n");
      await page.evaluate((theme) => window.__prxApp.update({ theme }), theme);
      assert.equal((await inspect(page)).n, "1", "theme redraw preserves the focused first digit");
      if (value === "10") {
        await page.setViewport({ width: width === 375 ? 455 : 900, height: 812 });
        await new Promise((resolve) => setTimeout(resolve, 150));
        const resized = await inspect(page);
        assert.equal(resized.n, "1"); assert.deepEqual(resized.state, before.state); assert.equal(resized.focus, "n");
        await page.setViewport({ width, height: 812 });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      await page.keyboard.type(value.slice(1));
      const draft = await inspect(page);
      assert.equal(draft.n, value); assert.deepEqual(draft.state, before.state); assert.equal(draft.appliedN, before.appliedN);
      await page.keyboard.press(completion);
      const done = await applied(page, Number(value), 3);
      assert.equal(done.feedback, "");
      if (value === "12") { assert.equal(done.stated, twelve.N); assert.equal(done.pairs, twelve.M); assert.equal(done.focus, "n"); }
    }
    // Invalid completion keeps the applied result, explains the draft, and can be canceled.
    await typeDraft(page, page, "n", "1"); await page.keyboard.press("Enter");
    const bad = await inspect(page);
    assert.equal(bad.n, "1"); assert.equal(bad.nInvalid, "true"); assert.equal(bad.state.n, 19); assert.equal(bad.appliedN, 19);
    assert.match(bad.feedback, /No count change was applied/);
    await page.keyboard.press("Escape"); await applied(page, 19, 3);
    // Shrink below the applied grade count only on completion, with the new max set before its value.
    await page.evaluate((sizes) => window.__prxApp.update({ n: 30, G: 15, sizes: sizes.join(",") }), fifteen.balancedSizes);
    await typeDraft(page, page, "n", "10"); assert.equal((await inspect(page)).state.G, 15);
    await page.keyboard.press("Enter"); await applied(page, 10, 10);
    // The grade-count editor also retains a whole draft, and a change event is a completed edit.
    await page.evaluate(() => window.__prxApp.applyPreset("balanced30"));
    await typeDraft(page, page, "G", "12"); assert.equal((await inspect(page)).state.G, 3);
    await page.$eval('[name="G"]', (n) => n.dispatchEvent(new Event("change", { bubbles: true })));
    await applied(page, 30, 12);
    // Atomic API and preset updates supersede an unfinished focused draft.
    await typeDraft(page, page, "n", "1");
    await page.evaluate(() => window.__prxApp.update({ n: 12, G: 3, sizes: "4,4,4" }));
    await applied(page, 12, 3);
    await typeDraft(page, page, "n", "1");
    await page.evaluate(() => window.__prxApp.applyPreset("four")); await applied(page, 30, 4);
    await typeDraft(page, page, "n", "1");
    await page.evaluate(() => window.__prxApp.applyPreset("four")); await applied(page, 30, 4);
    await typeDraft(page, page, "n", "1");
    await page.evaluate(() => window.__prxApp.update({ n: 30 })); await applied(page, 30, 4);
    // The iframe bridge uses the same atomic path, while a theme-only message preserves its draft.
    await page.goto(`${server.origin}/__count-frame.html`, { waitUntil: "load" });
    const frame = await (await page.waitForSelector("#f")).contentFrame();
    await frame.waitForSelector('.prx-readout [data-prx-readout="n"]');
    await typeDraft(frame, page, "n", "1");
    const send = (setting) => page.evaluate((prx) => document.querySelector("#f").contentWindow.postMessage({ prx }, "*"), setting);
    await send({ theme });
    await frame.waitForFunction((theme) => document.documentElement.getAttribute("data-theme") === theme, {}, theme);
    assert.equal((await inspect(frame)).n, "1");
    await send({ n: 12, G: 3, sizes: "4,4,4" });
    await frame.waitForFunction(() => window.__prxApp.state.n === 12); await applied(frame, 12, 3);
    await send({ preset: "four" }); await frame.waitForFunction(() => window.__prxApp.state.G === 4); await applied(frame, 30, 4);
    await typeDraft(frame, page, "n", "1"); await send({ preset: "four" });
    await frame.waitForFunction(() => document.querySelector('[name="n"]').value === "30"); await applied(frame, 30, 4);
    await send({ n: 2, G: 1, sizes: "2" }); await frame.waitForFunction(() => window.__prxApp.state.n === 2); await applied(frame, 2, 1);
    assert.deepEqual(failed, []); assert.deepEqual(errors, []);
  });
});
