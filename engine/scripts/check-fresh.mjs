// Fails (exit 1) when the pr-core outputs are stale: a build source changed, was added or removed after the
// last build, or an output was edited, added or deleted. Fix: npm run build in engine/.
//   node scripts/check-fresh.mjs              check the project
//   node scripts/check-fresh.mjs --self-test  inject faults into an in-memory copy; every fault must be caught
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HASH_FILE, checkFreshness, diskFiles, freshnessSelfTest } from "./freshness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

if (process.argv.includes("--self-test")) {
  const result = freshnessSelfTest(root);
  for (const line of result.lines) console.log(line);
  console.log(`self-test: ${result.caught}/${result.total} faults caught`);
  process.exit(result.ok ? 0 : 1);
} else {
  const problems = checkFreshness(diskFiles(root));
  if (problems.length) {
    console.error(`pr-core outputs are stale (run npm run build in engine/):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`pr-core outputs are fresh (${HASH_FILE})`);
}
