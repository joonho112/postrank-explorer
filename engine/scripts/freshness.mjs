// Bundle freshness for pr-core (CONTRACT.md 8.7, 14): which files are the sources of the build, which are its
// outputs, and the SHA-256 manifest js/pr-core.hash.json that records both. write-hash.mjs writes the manifest
// after a build; check-fresh.mjs recomputes it and fails when a source changed after the last build or an
// output no longer matches what the build wrote.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Files whose content determines the build output (paths relative to the project root). */
export const SOURCE_FILES = [
  "engine/package.json",
  "engine/package-lock.json",
  "engine/tsconfig.json",
  "engine/tsconfig.build.json",
  "engine/vite.config.ts",
  "engine/scripts/write-dts-entry.mjs",
  "engine/scripts/build-solver.mjs",
];
export const SOURCE_DIRS = [["engine/src", ".ts"]];
export const OUTPUT_FILES = [
  "js/pr-core.js",
  "js/pr-core.umd.js",
  "js/pr-core.d.ts",
  // the solver bundle (engine/src/mip.ts + highs-js 1.15.4, built by scripts/build-solver.mjs)
  "js/bundles/solver.js",
  "js/bundles/solver-node.mjs",
];
export const OUTPUT_DIRS = [["js/types", ".d.ts"]];
export const HASH_FILE = "js/pr-core.hash.json";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** File access on disk under `root`. */
export function diskFiles(root) {
  const abs = (rel) => path.join(root, ...rel.split("/"));
  return {
    exists: (rel) => fs.existsSync(abs(rel)),
    read: (rel) => fs.readFileSync(abs(rel)),
    list(dir, ext) {
      const out = [];
      const walk = (rel) => {
        if (!fs.existsSync(abs(rel))) return;
        for (const ent of fs.readdirSync(abs(rel), { withFileTypes: true })) {
          const child = `${rel}/${ent.name}`;
          if (ent.isDirectory()) walk(child);
          else if (ent.name.endsWith(ext)) out.push(child);
        }
      };
      walk(dir);
      return out.sort();
    },
  };
}

/** The same interface over an in-memory Map(path -> Buffer), for the self-test. */
export function memoryFiles(map) {
  return {
    exists: (rel) => map.has(rel),
    read: (rel) => {
      if (!map.has(rel)) throw new Error(`ENOENT: ${rel}`);
      return map.get(rel);
    },
    list: (dir, ext) => [...map.keys()].filter((p) => p.startsWith(`${dir}/`) && p.endsWith(ext)).sort(),
  };
}

export function sourceList(files) {
  return [...SOURCE_FILES, ...SOURCE_DIRS.flatMap(([d, e]) => files.list(d, e))].sort();
}
export function outputList(files) {
  return [...OUTPUT_FILES, ...OUTPUT_DIRS.flatMap(([d, e]) => files.list(d, e))].sort();
}

/** The manifest for the files as they are now. Throws when a source or an output is missing. */
export function computeManifest(files) {
  const sources = {};
  for (const rel of sourceList(files)) sources[rel] = sha256(files.read(rel));
  const combined = Object.entries(sources).map(([p, h]) => `${p}\0${h}\n`).join("");
  const outputs = {};
  for (const rel of outputList(files)) {
    const buf = files.read(rel);
    outputs[rel] = { sha256: sha256(buf), bytes: buf.length };
  }
  return { algorithm: "sha256", sourceHash: sha256(combined), sources, outputs };
}

/** Compare the recorded manifest with the files. Returns the list of problems (empty when fresh). */
export function checkFreshness(files) {
  if (!files.exists(HASH_FILE)) return [`${HASH_FILE} is missing: run npm run build in engine/`];
  let recorded;
  try {
    recorded = JSON.parse(files.read(HASH_FILE).toString("utf8"));
  } catch (err) {
    return [`${HASH_FILE} is not valid JSON (${err.message})`];
  }
  if (!recorded || typeof recorded.sources !== "object" || typeof recorded.outputs !== "object") {
    return [`${HASH_FILE} has no sources/outputs maps`];
  }
  const problems = [];
  const nowSources = sourceList(files);
  for (const rel of nowSources) {
    if (!files.exists(rel)) problems.push(`source missing: ${rel}`);
    else if (!(rel in recorded.sources)) problems.push(`source added since the last build: ${rel}`);
    else if (sha256(files.read(rel)) !== recorded.sources[rel]) problems.push(`source changed since the last build: ${rel}`);
  }
  for (const rel of Object.keys(recorded.sources)) {
    if (!nowSources.includes(rel)) problems.push(`source removed since the last build: ${rel}`);
  }
  const nowOutputs = outputList(files);
  for (const rel of nowOutputs) {
    if (!files.exists(rel)) problems.push(`output missing: ${rel}`);
    else if (!(rel in recorded.outputs)) problems.push(`output not written by the last build: ${rel}`);
    else if (sha256(files.read(rel)) !== recorded.outputs[rel].sha256) problems.push(`output differs from the last build: ${rel}`);
  }
  for (const rel of Object.keys(recorded.outputs)) {
    if (!nowOutputs.includes(rel)) problems.push(`output removed since the last build: ${rel}`);
  }
  return problems;
}

/**
 * Fault-injection self-test (CONTRACT.md 14): copies the current sources and outputs into memory, writes a
 * matching manifest there, checks that this copy is fresh, then injects one fault at a time; every fault must be
 * reported. Nothing is written to disk, and the result does not depend on whether the project is fresh now.
 */
export function freshnessSelfTest(root) {
  const disk = diskFiles(root);
  const base = new Map();
  for (const rel of [...sourceList(disk), ...outputList(disk)]) base.set(rel, disk.read(rel));
  base.set(HASH_FILE, Buffer.from(JSON.stringify(computeManifest(memoryFiles(base)))));
  const lines = [];
  const clean = checkFreshness(memoryFiles(base));
  if (clean.length) return { ok: false, caught: 0, total: 0, lines: [`the unmodified copy is not fresh: ${clean.join("; ")}`] };
  const append = (rel, text) => (m) => m.set(rel, Buffer.concat([m.get(rel), Buffer.from(text)]));
  const faults = [
    ["edit a source file", append("engine/src/special.ts", "\n// edit\n")],
    ["edit a build config", append("engine/vite.config.ts", "\n// edit\n")],
    ["edit the lock file", append("engine/package-lock.json", " ")],
    ["add a source file", (m) => m.set("engine/src/extra.ts", Buffer.from("export const x = 1;\n"))],
    ["remove a source file", (m) => m.delete("engine/src/format.ts")],
    ["edit the ES output", append("js/pr-core.js", "\n")],
    ["edit the UMD output", append("js/pr-core.umd.js", "\n")],
    ["delete the UMD output", (m) => m.delete("js/pr-core.umd.js")],
    ["edit a declaration file", append("js/types/index.d.ts", "\n")],
    ["add a declaration file", (m) => m.set("js/types/extra.d.ts", Buffer.from("export {};\n"))],
    ["corrupt the hash file", (m) => m.set(HASH_FILE, Buffer.from("{ not json"))],
    ["delete the hash file", (m) => m.delete(HASH_FILE)],
    ["edit the solver build script", append("engine/scripts/build-solver.mjs", "\n// edit\n")],
    ["edit the browser solver bundle", append("js/bundles/solver.js", "\n")],
    ["delete the Node solver bundle", (m) => m.delete("js/bundles/solver-node.mjs")],
  ];
  let caught = 0;
  for (const [name, inject] of faults) {
    const copy = new Map(base);
    inject(copy);
    const problems = checkFreshness(memoryFiles(copy));
    if (problems.length) caught += 1;
    lines.push(`${problems.length ? "caught" : "MISSED"}  ${name}${problems.length ? `: ${problems[0]}` : ""}`);
  }
  return { ok: caught === faults.length, caught, total: faults.length, lines };
}
