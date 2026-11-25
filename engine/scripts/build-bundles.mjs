// Builds one classic-script IIFE bundle per app (CP-1.5 per-app mini-catalog):
//   js/apps/<name>.js  ->  js/bundles/<name>.js, which sets window.PRX["<name>"] = { mountWidget }
// esbuild inlines tree-shaken js/pr-core.js, js/shared/, any app data, and a per-app mini-catalog (S2-08) read
// directly from catalog/site.json, catalog/site-copy.json, and catalog/entries/*.json (not generated catalog.json),
// keeping --only <name> isolated from other apps' catalog/entries/*.json edits (note: editing peer titles in
// catalog/site-copy.json updates the shared link map and requires a full node scripts/build.mjs run).
// A bundle works from http:// and file://.
//   node engine/scripts/build-bundles.mjs [--check] [--quiet] [--only <name>]
//   --check  write nothing; exit 1 when a bundle is missing, extra or differs from what the build would write
//   --only   one app's bundle (a builder in a worktree); bundles.json and the other bundles are left as they are
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "../..");
const requireEngine = createRequire(path.join(here, "..", "package.json"));
const { build } = requireEngine("esbuild");

export const KEEP = new Set(["solver.js", "solver-node.mjs", "bundles.json"]);
export const APP_HELPERS = Object.freeze([]);

/** Runtime keys guaranteed on appInfo(targetAppName) inside a bundle (S2-08). */
export const ENTRY_RUNTIME_KEYS = Object.freeze([
  "id",
  "name",
  "part",
  "title",
  "status",
  "caption",
  "presets",
  "presetLabel",
]);

export function pickRuntimeEntry(rawEntry) {
  const out = {};
  if (!rawEntry) return out;
  for (const k of ENTRY_RUNTIME_KEYS) {
    if (rawEntry[k] !== undefined) out[k] = rawEntry[k];
  }
  return out;
}

/** Read catalog/site.json, catalog/site-copy.json, and catalog/entries/*.json directly (S2-08). */
export function loadCatalogSources(rootDir = defaultRoot) {
  const site = JSON.parse(fs.readFileSync(path.join(rootDir, "catalog", "site.json"), "utf8"));
  const siteCopy = JSON.parse(fs.readFileSync(path.join(rootDir, "catalog", "site-copy.json"), "utf8"));
  const entriesDir = path.join(rootDir, "catalog", "entries");
  const partOrder = new Map((site.parts ?? []).map((p, i) => [p.key, i]));
  const rawEntries = fs.existsSync(entriesDir)
    ? fs
        .readdirSync(entriesDir)
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(entriesDir, f), "utf8")))
        .sort((a, b) => {
          const pa = partOrder.get(a.part) ?? 999;
          const pb = partOrder.get(b.part) ?? 999;
          if (pa !== pb) return pa - pb;
          const na = Number(String(a.id ?? "").split(".")[1] ?? 0);
          const nb = Number(String(b.id ?? "").split(".")[1] ?? 0);
          if (na !== nb) return na - nb;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        })
    : [];
  const slimParts = (site.parts ?? []).map(({ key, slug, title }) => ({ key, slug, title }));
  const builtLinksMap = Object.fromEntries(
    rawEntries
      .filter((a) => a.status === "built")
      .map((a) => [
        a.name,
        {
          title: siteCopy.apps?.[a.name]?.title ?? a.title,
          part: a.part,
          status: "built",
        },
      ])
  );
  const byName = new Map(rawEntries.map((a) => [a.name, a]));
  return { slimParts, builtLinksMap, siteCopyApps: siteCopy.apps ?? {}, byName };
}

/**
 * Per-app mini-catalog esbuild plugin (CP-1.5, S2-08).
 * Replaces catalog.json and catalog/site-copy.json imports with:
 *  - target app's 8 runtime keys (id, name, part, title, status, caption, presets, presetLabel) + slim parts
 *  - minimal built-app lookup { [name]: { title, part, status: "built" } } for appInfo/builtPage/displayName/appLink
 */
export function createMiniCatalogPlugin(rootDir, targetAppName, catalogCache = null) {
  const { slimParts, builtLinksMap, siteCopyApps, byName } = catalogCache ?? loadCatalogSources(rootDir);
  const rawEntry = byName.get(targetAppName) ?? null;
  const entry = pickRuntimeEntry(rawEntry);
  const copyExtra =
    targetAppName && !Object.hasOwn(builtLinksMap, targetAppName) && siteCopyApps[targetAppName]?.title
      ? { [targetAppName]: { title: siteCopyApps[targetAppName].title } }
      : null;
  return {
    name: "prx-mini-catalog",
    setup(b) {
      b.onResolve({ filter: /^prx-mini-catalog$/ }, () => ({
        path: "prx-mini-catalog",
        namespace: "prx-mini",
      }));
      b.onLoad({ filter: /.*/, namespace: "prx-mini" }, () => ({
        contents:
          `export const parts = ${JSON.stringify(slimParts)};\n` +
          `export const entry = ${JSON.stringify(entry)};\n` +
          `export const links = ${JSON.stringify(builtLinksMap)};\n`,
        loader: "js",
      }));
      b.onResolve({ filter: /(?:^|[\\/])catalog\.json$/ }, () => ({
        path: "catalog.json",
        namespace: "prx-cat",
      }));
      b.onLoad({ filter: /.*/, namespace: "prx-cat" }, () => ({
        contents:
          `import { parts, entry, links } from "prx-mini-catalog";\n` +
          `const others = Object.entries(links).filter(([k]) => k !== entry.name).map(([name, v]) => ({ name, ...v }));\n` +
          `export default { parts, apps: entry.name ? [entry, ...others] : others };\n`,
        loader: "js",
      }));
      b.onResolve({ filter: /(?:^|[\\/])catalog[\\/]site-copy\.json$/ }, () => ({
        path: "site-copy.json",
        namespace: "prx-copy",
      }));
      b.onLoad({ filter: /.*/, namespace: "prx-copy" }, () => ({
        contents: copyExtra
          ? `import { links } from "prx-mini-catalog";\nexport default { apps: { ...links, ...${JSON.stringify(copyExtra)} } };\n`
          : `import { links } from "prx-mini-catalog";\nexport default { apps: links };\n`,
        loader: "js",
      }));
    },
  };
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/** Build one app's IIFE bundle in memory without writing to disk. */
export async function buildAppBundleCode(name, { rootDir = defaultRoot, catalogCache = null } = {}) {
  const appsDir = path.join(rootDir, "js", "apps");
  const result = await build({
    stdin: {
      contents: `import { mountWidget } from "./${name}.js";\n(globalThis.PRX = globalThis.PRX || {})[${JSON.stringify(name)}] = { mountWidget };\n`,
      resolveDir: appsDir,
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
    plugins: [createMiniCatalogPlugin(rootDir, name, catalogCache)],
  });
  const code = result.outputFiles[0].text;
  return { name, code, bytes: Buffer.byteLength(code), sha256: sha(code) };
}

export async function runBuildBundles({
  rootDir = defaultRoot,
  outDir = path.join(rootDir, "js", "bundles"),
  check = false,
  quiet = false,
  only = null,
} = {}) {
  const appsDir = path.join(rootDir, "js", "apps");
  const all = fs.existsSync(appsDir)
    ? fs
        .readdirSync(appsDir)
        .filter((f) => f.endsWith(".js") && !APP_HELPERS.includes(f))
        .map((f) => f.slice(0, -3))
        .sort()
    : [];
  const names = only ? all.filter((n) => n === only) : all;
  if (only && !names.length) {
    console.error(`bundles --only: js/apps/${only}.js does not exist`);
    return { ok: false, code: 1, problems: [`js/apps/${only}.js does not exist`], manifest: [] };
  }
  const catalogCache = loadCatalogSources(rootDir);
  const problems = [];
  const manifest = [];
  for (const name of names) {
    const built = await buildAppBundleCode(name, { rootDir, catalogCache });
    const file = path.join(outDir, `${name}.js`);
    if (check) {
      if (!fs.existsSync(file)) problems.push(`missing js/bundles/${name}.js`);
      else if (fs.readFileSync(file, "utf8") !== built.code) problems.push(`stale js/bundles/${name}.js`);
    } else {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(file, built.code);
    }
    manifest.push({ name: built.name, bytes: built.bytes, sha256: built.sha256 });
  }
  const extra =
    !only && fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter((f) => !KEEP.has(f) && !names.includes(f.replace(/\.js$/, "")))
      : [];
  if (check) {
    for (const f of extra) problems.push(`extra js/bundles/${f} (no js/apps source)`);
    if (problems.length) {
      console.error(`bundles: ${problems.length} problem(s); run node engine/scripts/build-bundles.mjs\n  ${problems.join("\n  ")}`);
      return { ok: false, code: 1, problems, manifest };
    }
    console.log(`bundles: ${names.length} fresh`);
    return { ok: true, code: 0, problems: [], manifest };
  }
  for (const f of extra) fs.rmSync(path.join(outDir, f));
  if (!only) fs.writeFileSync(path.join(outDir, "bundles.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (!quiet) for (const m of manifest) console.log(`bundle ${m.name.padEnd(24)} ${String(m.bytes).padStart(8)} bytes`);
  return { ok: true, code: 0, problems: [], manifest };
}

const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1] ?? "") === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const quiet = argv.includes("--quiet");
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
  const rootArg = argv.includes("--root") ? path.resolve(argv[argv.indexOf("--root") + 1]) : defaultRoot;
  const res = await runBuildBundles({ rootDir: rootArg, check, quiet, only });
  if (!res.ok) process.exit(res.code);
}
