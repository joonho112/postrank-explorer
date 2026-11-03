// Real Chrome + local HiGHS regression for A-CLR-002. Build/render computing-grades first.
// node --test verification/browser-tests/computing-grades-focus.test.mjs
// Optional PRX_FOCUS_ARTIFACTS=/absolute/path saves the inspected states (never a timing check).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOCS, launchChrome, openTab, startServer } from "../browser.mjs";

const solve = "[data-prx-solve]";
const status = "[data-prx-solver-status]";
const artifacts = process.env.PRX_FOCUS_ARTIFACTS;

test("joint solve preserves native action focus without reclaiming the reader's later focus", async (t) => {
  const server = await startServer(DOCS), browser = await launchChrome();
  t.after(async () => { await browser.close(); await server.close(); });
  if (artifacts) await mkdir(artifacts, { recursive: true });
  const records = [];
  for (const { width, theme } of [1280, 375].flatMap((width) => ["light", "dark"].map((theme) => ({ width, theme })))) {
    await t.test(`${width}px ${theme}`, async (scenario) => {
      const { page, errors, failed } = await openTab(browser, { origin: server.origin, width, height: 800 });
      scenario.after(() => page.close());
      await page.goto(`${server.origin}/embed/computing-grades.html?view=solver&solverN=3&timeLimit=.1&tau=.25&theme=${theme}`, { waitUntil: "load" });
      await page.waitForSelector(solve);
      assert.equal(await page.evaluate(() => typeof window.PRX_SOLVER), "undefined", "solver remains lazy at mount");
      const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-prx-focus-key"));
      const idle = () => page.waitForFunction(() => document.querySelector(".prx-widget").getAttribute("aria-busy") !== "true");
      const record = async (state) => {
        records.push(await page.evaluate((state) => ({ state, width: innerWidth, theme: document.documentElement.dataset.theme,
          focus: document.activeElement?.getAttribute("data-prx-focus-key"), status: document.querySelector("[data-prx-solver-status]")?.textContent,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          readout: document.querySelector(".prx-readout")?.textContent }), state));
        if (artifacts) {
          await page.$eval(solve, (node) => node.scrollIntoView({ block: "center" }));
          await page.screenshot({ path: join(artifacts, `${width}-${theme}-${state}.png`) });
        }
      };
      const gate = () => page.evaluate(() => {
        const original = window.PRX_SOLVER.mipSolve;
        window.__focusSolveCalls = 0;
        window.__focusSolveCompleted = false;
        window.PRX_SOLVER.mipSolve = (...args) => {
          window.__focusSolveCalls++;
          return new Promise((resolve, reject) => {
            window.__releaseFocusSolve = () => {
              window.PRX_SOLVER.mipSolve = original;
              original(...args).then((result) => { window.__focusSolveCompleted = true; resolve(result); }, reject);
            };
          });
        };
      });
      const started = () => page.waitForFunction(() => typeof window.__releaseFocusSolve === "function");
      const release = () => page.evaluate(() => { const fn = window.__releaseFocusSolve; delete window.__releaseFocusSolve; fn(); });

      // The reported reproduction: Enter loads the real WASM and completes a three-unit solve.
      await page.focus(solve); await page.keyboard.press("Enter");
      await page.waitForSelector(status); await idle();
      assert.equal(await page.$eval(status, (node) => node.textContent), "optimal");
      assert.equal(await focused(), "solver:solve");
      assert.equal(await page.$eval(solve, (node) => node.getAttribute("aria-disabled")), "false");
      for (const field of ["solver-upper", "solver-lower", "solver-gap", "solver-offset", "solver-objective", "solver-bound"]) {
        assert.ok(await page.$(`[data-prx-readout="${field}"]`), `${field} remains visible`);
      }
      await record("enter-result");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement === document.body), false, "Tab continues from the action");
      assert.notEqual(await focused(), "solver:solve");
      await page.focus(solve);

      // Space starts a rerun; a running action stays focusable but cannot start duplicate jobs.
      await gate(); await page.keyboard.press("Space"); await started();
      assert.equal(await focused(), "solver:solve");
      assert.equal(await page.$eval(solve, (node) => node.getAttribute("aria-disabled")), "true");
      await page.keyboard.press("Enter"); await page.keyboard.press("Space");
      assert.equal(await page.evaluate(() => window.__focusSolveCalls), 1);
      await release(); await idle(); assert.equal(await focused(), "solver:solve");
      await record("space-rerun");

      // Returning results must not move focus back after the reader chooses another control.
      await gate(); await page.click(solve); await started();
      await page.focus('input[name="solverN"]'); await release(); await idle();
      assert.equal(await focused(), "slider:solverN"); await record("reader-moved");

      // A view change during work neither cancels the result nor steals focus when it arrives.
      await gate(); await page.click(solve); await started();
      await page.click('[data-value="count"]');
      const viewFocus = await focused(); await release(); await idle();
      assert.equal(await focused(), viewFocus);
      assert.equal(await page.$eval(solve, (node) => !!node.closest("[hidden]")), true);
      await page.click('[data-value="solver"]');
      assert.equal(await focused(), "seg:view:3");
      assert.equal(await page.$eval(status, (node) => node.textContent), "optimal");
      await record("view-return");

      // Exercise the existing failure and retry path, then actually solve the new settings.
      await page.evaluate(() => {
        window.__prxApp.update({ tau: .26 });
        const original = window.PRX_SOLVER.mipSolve;
        window.PRX_SOLVER.mipSolve = (...args) => {
          window.PRX_SOLVER.mipSolve = original;
          return Promise.reject(new Error("deliberate focus regression failure"));
        };
      });
      await page.focus(solve); await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector(".prx-cg-body").textContent.includes("press the button to retry"));
      await idle(); assert.equal(await focused(), "solver:solve"); await record("retry-error");
      await page.keyboard.press("Space"); await page.waitForSelector(status); await idle();
      assert.equal(await focused(), "solver:solve"); await record("retry-result");

      // Pointer activation also retains the same action node through the completed rerun.
      await gate(); await page.click(solve); await started();
      assert.equal(await focused(), "solver:solve"); await release(); await idle();
      assert.equal(await focused(), "solver:solve"); await record("pointer-result");

      // There is no cancel action; destruction during a job must not render or reclaim focus later.
      await gate(); await page.click(solve); await started();
      await page.evaluate(() => {
        const outside = document.createElement("button"); outside.id = "outside"; outside.textContent = "Outside app";
        document.body.append(outside); outside.focus(); window.__prxApp.destroy();
      });
      await release();
      // Wait for the real worker promise rather than sampling a short arbitrary timeout.
      await page.waitForFunction(() => window.__focusSolveCompleted);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "outside");
      assert.equal(await page.$(".prx-widget"), null);
      assert.deepEqual(errors, []); assert.deepEqual(failed, []);
      assert.ok(records.filter((r) => r.width === width).every((r) => !r.overflow));
    });
  }
  if (artifacts) await writeFile(join(artifacts, "states.json"), JSON.stringify(records, null, 2) + "\n");
});
