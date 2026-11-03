// Writes js/pr-core.hash.json: SHA-256 of every build source and of every output, after a build.
// Deterministic (no time stamp), so an unchanged build rewrites the same bytes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HASH_FILE, computeManifest, diskFiles } from "./freshness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "engine", "package.json"), "utf8"));
const manifest = computeManifest(diskFiles(root));
const doc = { generator: "engine/scripts/write-hash.mjs", check: "engine/scripts/check-fresh.mjs", version: pkg.version, ...manifest };
fs.writeFileSync(path.join(root, HASH_FILE), JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${HASH_FILE}: ${Object.keys(manifest.sources).length} sources, ${Object.keys(manifest.outputs).length} outputs, source hash ${manifest.sourceHash.slice(0, 12)}`);
