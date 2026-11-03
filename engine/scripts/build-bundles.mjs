// Builds one classic-script IIFE bundle per app:
//   js/apps/<name>.js  ->  js/bundles/<name>.js, which sets window.PRX["<name>"] = { mountWidget }
// esbuild inlines the engine (js/pr-core.js), the shared modules (js/shared/), catalog.json and any data the app
// imports. D3, Plot and Temml are vendored classic globals, not bundled. A bundle works from file://.
//   node engine/scripts/build-bundles.mjs [--check] [--quiet] [--only <name>]
//   --check  write nothing; exit 1 when a bundle is missing, extra or differs from what the build would write
//   --only   one app's bundle (a builder in a worktree); bundles.json and the other bundles are left as they are
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const apps = path.join(root, "js", "apps");
const out = path.join(root, "js", "bundles");
const KEEP = new Set(["solver.js", "solver-node.mjs", "bundles.json"]);
const check = process.argv.includes("--check");
const quiet = process.argv.includes("--quiet");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const APP_HELPERS = Object.freeze(["krw-common.js", "cde-common.js"]);
const all = fs.existsSync(apps) ? fs.readdirSync(apps).filter((f) => f.endsWith(".js") && !APP_HELPERS.includes(f)).map((f) => f.slice(0, -3)).sort() : [];
const names = only ? all.filter((n) => n === only) : all;
if (only && !names.length) {
  console.error(`bundles --only: js/apps/${only}.js does not exist`);
  process.exit(1);
}
const sha = (s) => createHash("sha256").update(s).digest("hex");
const problems = [];
const manifest = [];
for (const name of names) {
  const result = await build({
    stdin: {
      contents: `import { mountWidget } from "./${name}.js";\n(globalThis.PRX = globalThis.PRX || {})[${JSON.stringify(name)}] = { mountWidget };\n`,
      resolveDir: apps,
      sourcefile: `${name}.entry.js`,
      loader: "js",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    banner: { js: `/* postrank Explorer app bundle: ${name} (built from js/apps/${name}.js; do not edit) */` },
    write: false,
    logLevel: "warning",
  });
  const code = result.outputFiles[0].text;
  const file = path.join(out, `${name}.js`);
  if (check) {
    if (!fs.existsSync(file)) problems.push(`missing js/bundles/${name}.js`);
    else if (fs.readFileSync(file, "utf8") !== code) problems.push(`stale js/bundles/${name}.js`);
  } else {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(file, code);
  }
  manifest.push({ name, bytes: Buffer.byteLength(code), sha256: sha(code) });
}
const extra = !only && fs.existsSync(out) ? fs.readdirSync(out).filter((f) => !KEEP.has(f) && !names.includes(f.replace(/\.js$/, ""))) : [];
if (check) {
  for (const f of extra) problems.push(`extra js/bundles/${f} (no js/apps source)`);
  if (problems.length) {
    console.error(`bundles: ${problems.length} problem(s); run node engine/scripts/build-bundles.mjs\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`bundles: ${names.length} fresh`);
} else {
  for (const f of extra) fs.rmSync(path.join(out, f));
  if (!only) fs.writeFileSync(path.join(out, "bundles.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (!quiet) for (const m of manifest) console.log(`bundle ${m.name.padEnd(24)} ${String(m.bytes).padStart(8)} bytes`);
}
