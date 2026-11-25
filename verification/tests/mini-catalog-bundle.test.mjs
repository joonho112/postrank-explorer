import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  ENTRY_RUNTIME_KEYS,
  createMiniCatalogPlugin,
  buildAppBundleCode,
  runBuildBundles,
} from "../../engine/scripts/build-bundles.mjs";
import { makeWindow } from "../dom-env.mjs";
import { loadCatalog, mountCase } from "../widget_harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const requireEngine = createRequire(path.join(ROOT, "engine", "package.json"));
const { build } = requireEngine("esbuild");

async function buildRawBaselineCode(name) {
  const res = await build({
    stdin: {
      contents: `import { mountWidget } from "./${name}.js";\n(globalThis.PRX = globalThis.PRX || {})[${JSON.stringify(name)}] = { mountWidget };\n`,
      resolveDir: path.join(ROOT, "js", "apps"),
      sourcefile: `${name}.entry.js`,
      loader: "js",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    write: false,
    logLevel: "warning",
  });
  return res.outputFiles[0].text;
}

async function buildCatalogProbe(plugins) {
  const contents = `
    import { appInfo, builtPage, appLink, parts, createWidget } from "../shared/base.js";
    globalThis.__prxCatProbe = { appInfo, builtPage, appLink, parts, createWidget };
  `;
  const res = await build({
    stdin: {
      contents,
      resolveDir: path.join(ROOT, "js", "apps"),
      sourcefile: "catalog-probe.entry.js",
      loader: "js",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    write: false,
    logLevel: "warning",
    plugins,
  });
  return res.outputFiles[0].text;
}

test("CP-1.5 mini-catalog cuts noisy-league bundle well below 160 KB raw and strips build-only catalog keys", async () => {
  const mini = await buildAppBundleCode("noisy-league");
  const rawCode = await buildRawBaselineCode("noisy-league");
  const rawBytes = Buffer.byteLength(rawCode);

  assert.ok(
    mini.bytes < 160 * 1024,
    `expected noisy-league mini-catalog bundle < 163840 B, got ${mini.bytes} B`
  );
  assert.ok(
    rawBytes - mini.bytes > 75 * 1024,
    `expected > 75 KB savings over raw catalog bundle (${rawBytes} B -> ${mini.bytes} B)`
  );

  // Other apps' captions and editorial fields must not appear in noisy-league's bundle
  const frontierEntry = JSON.parse(
    fs.readFileSync(path.join(ROOT, "catalog", "entries", "2.10-frontier.json"), "utf8")
  );
  assert.equal(mini.code.includes(frontierEntry.caption), false);
  assert.equal(mini.code.includes(frontierEntry.idea), false);
});

test("S2-08: createMiniCatalogPlugin reads catalog/entries/*.json directly and isolates --only builds", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prx-mini-cat-"));
  try {
    for (const dir of ["js", "engine", "data", "styles"]) {
      fs.symlinkSync(path.join(ROOT, dir), path.join(tmpRoot, dir));
    }
    fs.cpSync(path.join(ROOT, "catalog"), path.join(tmpRoot, "catalog"), { recursive: true });
    // Deliberately write an empty/stale catalog.json to prove build-bundles does NOT read catalog.json
    fs.writeFileSync(path.join(tmpRoot, "catalog.json"), JSON.stringify({ parts: [], apps: [] }));

    const outDir = path.join(tmpRoot, "out-bundles");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "frontier.js"), "/* untouched sibling bundle */");
    fs.writeFileSync(path.join(outDir, "bundles.json"), "[]\n");

    const first = await runBuildBundles({
      rootDir: tmpRoot,
      outDir,
      only: "noisy-league",
      quiet: true,
    });
    assert.equal(first.ok, true);
    assert.equal(first.manifest.length, 1);
    const sha1 = first.manifest[0].sha256;
    // Sibling bundle and bundles.json are untouched under --only
    assert.equal(fs.readFileSync(path.join(outDir, "frontier.js"), "utf8"), "/* untouched sibling bundle */");
    assert.equal(fs.readFileSync(path.join(outDir, "bundles.json"), "utf8"), "[]\n");

    // Edit another app's catalog entry (caption, presets, try, idea) -> noisy-league bundle hash is 100% unchanged!
    const frontierPath = path.join(tmpRoot, "catalog", "entries", "2.10-frontier.json");
    const frontierJson = JSON.parse(fs.readFileSync(frontierPath, "utf8"));
    frontierJson.caption = "Edited frontier caption in parallel worktree.";
    frontierJson.idea = "Edited frontier idea.";
    frontierJson.presets = [{ id: "edited-preset", label: "Edited", query: "tau=.15" }];
    fs.writeFileSync(frontierPath, JSON.stringify(frontierJson, null, 2));

    const second = await runBuildBundles({
      rootDir: tmpRoot,
      outDir,
      only: "noisy-league",
      quiet: true,
    });
    assert.equal(second.ok, true);
    assert.equal(second.manifest[0].sha256, sha1, "editing another app's entry must not change noisy-league.js");

    // Check mode passes on fresh single bundle
    const checkOk = await runBuildBundles({
      rootDir: tmpRoot,
      outDir,
      only: "noisy-league",
      check: true,
      quiet: true,
    });
    assert.equal(checkOk.ok, true);

    // Edit noisy-league's own entry WITHOUT regenerating catalog.json -> picked up immediately!
    const nlPath = path.join(tmpRoot, "catalog", "entries", "1.3-noisy-league.json");
    const nlJson = JSON.parse(fs.readFileSync(nlPath, "utf8"));
    const markerCaption = "Unique S2-08 fresh entry caption marker.";
    nlJson.caption = markerCaption;
    fs.writeFileSync(nlPath, JSON.stringify(nlJson, null, 2));

    const staleCheck = await runBuildBundles({
      rootDir: tmpRoot,
      outDir,
      only: "noisy-league",
      check: true,
      quiet: true,
    });
    assert.equal(staleCheck.ok, false);

    const third = await runBuildBundles({
      rootDir: tmpRoot,
      outDir,
      only: "noisy-league",
      quiet: true,
    });
    assert.equal(third.ok, true);
    assert.notEqual(third.manifest[0].sha256, sha1);
    assert.equal(fs.readFileSync(path.join(outDir, "noisy-league.js"), "utf8").includes(markerCaption), true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("Runtime parity: appInfo, parts, builtPage, appLink, and mounted [data-num] match full catalog 100%", async () => {
  const fullCat = loadCatalog();
  const rawProbeCode = await buildCatalogProbe([]);
  const miniProbeCode = await buildCatalogProbe([createMiniCatalogPlugin(ROOT, "noisy-league")]);

  const evalProbe = (code, embed) => {
    const m = makeWindow({ plot: false });
    try {
      if (embed) m.doc.body.classList.add("prx-embed");
      m.win.eval(code);
      const P = m.win.__prxCatProbe;
      let ctx;
      const h = P.createWidget(m.el, {}, {
        name: "noisy-league",
        keys: {},
        build(c) {
          ctx = c;
          return { render() {} };
        },
      });
      const names = [...fullCat.apps.map((a) => a.name), "nonexistent-app"];
      const out = JSON.parse(
        JSON.stringify({
          parts: P.parts().map(({ key, slug, title }) => ({ key, slug, title })),
          selfInfo: P.appInfo("noisy-league"),
          pages: Object.fromEntries(names.map((n) => [n, P.builtPage(n)])),
          links: Object.fromEntries(names.map((n) => [n, P.appLink(ctx, n).outerHTML])),
        })
      );
      h.destroy();
      return out;
    } finally {
      m.restore();
    }
  };

  for (const embed of [false, true]) {
    const rawRes = evalProbe(rawProbeCode, embed);
    const miniRes = evalProbe(miniProbeCode, embed);
    assert.deepEqual(miniRes.parts, rawRes.parts);
    assert.deepEqual(miniRes.pages, rawRes.pages);
    assert.deepEqual(miniRes.links, rawRes.links);
    for (const k of ENTRY_RUNTIME_KEYS) {
      assert.deepEqual(miniRes.selfInfo[k], rawRes.selfInfo[k], `mismatch on ENTRY_RUNTIME_KEYS.${k}`);
    }
    for (const buildOnlyKey of ["credit", "data", "try", "from", "idea"]) {
      assert.equal(miniRes.selfInfo[buildOnlyKey], undefined);
    }
  }

  // Also mount noisy-league IIFE bundle in jsdom and verify exact readout/caption/[data-num] parity vs source module
  const built = await buildAppBundleCode("noisy-league");
  const direct = await mountCase({ module: "js/apps/noisy-league.js", query: "?preset=close-race" });
  const bundledEnv = makeWindow({ plot: true });
  try {
    bundledEnv.win.__PRX_QUERY = "?preset=close-race";
    bundledEnv.win.eval(built.code);
    const h = bundledEnv.win.PRX["noisy-league"].mountWidget(bundledEnv.el, {});
    const directNums = [...direct.el.querySelectorAll("[data-num]")].map((n) => [
      n.getAttribute("data-num"),
      n.textContent.trim(),
    ]);
    const bundledNums = [...bundledEnv.el.querySelectorAll("[data-num]")].map((n) => [
      n.getAttribute("data-num"),
      n.textContent.trim(),
    ]);
    assert.deepEqual(bundledNums, directNums);
    assert.equal(
      bundledEnv.el.querySelector('[data-prx-part~="caption"]')?.textContent,
      direct.el.querySelector('[data-prx-part~="caption"]')?.textContent
    );
    h.destroy();
  } finally {
    direct.close();
    bundledEnv.restore();
  }
});
