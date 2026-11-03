#!/usr/bin/env node
// Card thumbnails: one 640 x 360 PNG per built app (or the one app named by --only, also while it is building), media/thumbs/<name>.png, taken from the top of its standalone page
// (embed/<name>.html) at 1280 x 720, light theme, default setting. Run after building or changing an app, then
// node scripts/build.mjs so the section cards pick the picture up.
//   node scripts/thumbs.mjs [--only <name>]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { appsFor, launchChrome, openTab, ROOT, sleep, startServer } from "../verification/browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const server = await startServer(ROOT);
const browser = await launchChrome();
mkdirSync(join(ROOT, "media/thumbs"), { recursive: true });
for (const a of appsFor(only)) { // every built app, or with --only one app, also while it is building
  const { page, errors } = await openTab(browser, { origin: server.origin, width: 1280, height: 720 });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 0.5 });
  await page.goto(`${server.origin}/embed/${a.name}.html?theme=light`, { waitUntil: "load" });
  await page.waitForSelector(".prx-widget .prx-readout");
  await sleep(400);
  const out = join(ROOT, "media/thumbs", `${a.name}.png`);
  await page.screenshot({ path: out });
  console.log(`thumb media/thumbs/${a.name}.png${errors.length ? ` (console errors: ${errors.length})` : ""}`);
  await page.close();
}
await browser.close();
await server.close();
