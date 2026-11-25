import assert from "node:assert/strict";
import { test } from "node:test";
import { appsFor, launchChrome, startServer } from "../browser.mjs";
import { presetJourney } from "../preset-journeys.mjs";

test("3.2 preset gestures match independently mounted pages, including repeated numeric nodes", async t => {
  const app = appsFor("tier-sizes")[0];
  const server = await startServer();
  t.after(() => server.close());
  const browser = await launchChrome();
  t.after(() => browser.close());
  for (const width of [1280, 375]) {
    const got = await presetJourney(browser, server.origin, app, width);
    assert.equal(got.ok, true, JSON.stringify({
      width, error: got.error, console: got.errors, failed: got.failed, presets: got.presets.filter(p => !p.ok),
    }));
  }
});
