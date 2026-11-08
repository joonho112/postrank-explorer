// tsc -p tsconfig.build.json writes one .d.ts per source file into ../js/types/.
// This writes the single entry ../js/pr-core.d.ts that re-exports them, so editors resolve
// `import ... from "../pr-core.js"` to typed declarations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../js/pr-core.d.ts");
fs.writeFileSync(out, '// pr-core type declarations (written by engine/scripts/write-dts-entry.mjs; do not edit)\nexport * from "./types/index.js";\n');
console.log("wrote js/pr-core.d.ts");
