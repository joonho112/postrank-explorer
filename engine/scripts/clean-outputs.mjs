// Removes the pr-core build outputs (and only those) before a build, so a deleted source cannot leave a
// stale declaration file behind: js/pr-core.js, js/pr-core.umd.js, js/pr-core.d.ts, js/types/, the solver bundle
// (js/bundles/solver.js, js/bundles/solver-node.mjs) and js/pr-core.hash.json. Widget bundles are not touched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HASH_FILE, OUTPUT_DIRS, OUTPUT_FILES } from "./freshness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const rel of [...OUTPUT_FILES, HASH_FILE]) fs.rmSync(path.join(root, rel), { force: true });
for (const [dir] of OUTPUT_DIRS) fs.rmSync(path.join(root, dir), { recursive: true, force: true });
