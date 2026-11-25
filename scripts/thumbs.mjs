#!/usr/bin/env node
// Card thumbnails: one 640 x 360 PNG per built app (or --only <name>), media/thumbs/<name>.png,
// cropped around the primary figure stage of embed/<name>.html in forced light mode (0 dark captures).
// Run after building or changing an app, then node scripts/build.mjs && quarto render.
//   node scripts/thumbs.mjs [--only <name>]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appsFor, launchChrome, openTab, pool, ROOT, sleep, startServer, waitForWidgetIdle } from "../verification/browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const server = await startServer(ROOT);
const browser = await launchChrome();
mkdirSync(join(ROOT, "media/thumbs"), { recursive: true });

const targets = appsFor(only);
const darkFailures = [];

await pool(targets, 3, async (a) => {
  const { page, errors } = await openTab(browser, { origin: server.origin, width: 1120, height: 900 });
  try {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.setViewport({ width: 1120, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${server.origin}/embed/${a.name}.html?theme=light&hide=chrome,disclosures`, { waitUntil: "load" });
    await page.waitForSelector(".prx-widget .prx-readout");
    await waitForWidgetIdle(page);
    await sleep(250);

    const clip = await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.style.background = "#fdfbf6";
      const credit = document.querySelector(".prx-embed-credit");
      if (credit) credit.style.display = "none";
      const stage = document.querySelector(".prx-widget .prx-stage, .prx-widget .mdv-stage, .prx-widget [data-prx-primary]")
        ?? document.querySelector(".prx-widget");
      const r = stage.getBoundingClientRect();
      const w = 1120;
      const h = 630; // exact 16:9 aspect ratio
      const y = Math.max(0, Math.round(r.top + window.scrollY - 2));
      return { x: 0, y, width: w, height: h };
    });

    // Render at deviceScaleFactor = 640/1120 so 1120x630 CSS px outputs an exact 640x360 PNG.
    await page.setViewport({ width: 1120, height: Math.max(900, clip.y + clip.height + 20), deviceScaleFactor: 640 / 1120 });
    await sleep(80);
    const out = join(ROOT, "media/thumbs", `${a.name}.png`);
    const b64 = await page.screenshot({ clip, encoding: "base64" });
    writeFileSync(out, Buffer.from(b64, "base64"));
    // Verify light background luminance directly from the captured PNG bytes in-page.
    const meanLuma = await page.evaluate(async (dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 18;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, 32, 18);
      const px = g.getImageData(0, 0, 32, 18).data;
      let s = 0;
      for (let i = 0; i < px.length; i += 4) s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      return s / (32 * 18);
    }, `data:image/png;base64,${b64}`);
    if (meanLuma < 170) darkFailures.push(`${a.name} (meanLuma=${meanLuma.toFixed(1)})`);
    console.log(`thumb media/thumbs/${a.name}.png (luma=${meanLuma.toFixed(0)})${errors.length ? ` (console errors: ${errors.length})` : ""}`);
  } finally {
    await page.close();
  }
});

await browser.close();
await server.close();
if (darkFailures.length) {
  console.error(`FAIL dark thumbnails detected: ${darkFailures.join(", ")}`);
  process.exit(1);
}
console.log(`thumbs: ${targets.length} light-mode 640x360 thumbnails written; 0 dark captures`);
