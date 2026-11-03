// Copies the pinned browser libraries from tools/node_modules into js/vendor/ and writes js/vendor/VENDOR.md with
// their SHA-256 (CONTRACT 8.7: D3, Plot and Temml are vendored classic globals loaded once; no CDN).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = join(here, "..", "js", "vendor");
mkdirSync(join(out, "temml"), { recursive: true });
const files = [
  ["d3", "7.9.0", "d3/dist/d3.min.js", "d3.min.js", "d3/LICENSE", "d3.LICENSE", "ISC"],
  ["@observablehq/plot", "0.6.17", "@observablehq/plot/dist/plot.umd.min.js", "plot.min.js", "@observablehq/plot/LICENSE", "plot.LICENSE", "ISC"],
  ["temml", "0.14.0", "temml/dist/temml.min.js", "temml/temml.min.js", "temml/LICENSE", "temml/LICENSE", "MIT"],
  ["temml", "0.14.0", "temml/dist/temml.cjs", "temml/temml.cjs", null, null, "MIT"],
  ["temml", "0.14.0", "temml/dist/Temml-Local.css", "temml/Temml-Local.css", null, null, "MIT"],
  ["temml", "0.14.0", "temml/dist/Temml.woff2", "temml/Temml.woff2", null, null, "MIT (distributed in the temml package; the package states no separate font licence — author check)"],
];
const rows = [];
for (const [pkg, ver, src, dst, lic, licDst, licence] of files) {
  copyFileSync(join(here, "node_modules", src), join(out, dst));
  if (lic) copyFileSync(join(here, "node_modules", lic), join(out, licDst));
  const sha = createHash("sha256").update(readFileSync(join(out, dst))).digest("hex");
  rows.push(`| \`${dst}\` | \`${pkg}\` | ${ver} | \`${src}\` | \`${sha}\` | ${licence} |`);
}
writeFileSync(join(out, "VENDOR.md"), `# Vendored libraries

Loaded as classic \`<script>\` files so every page works from \`file://\` with no network (CONTRACT 2.4, 8.7).
Load order: \`d3.min.js\`, then \`plot.min.js\` (Plot's UMD build reads the global \`d3\`), then \`temml/temml.min.js\`.
Copied from the pinned npm packages in \`tools/package.json\` by \`node tools/vendor.mjs\`; never fetched from a CDN.

| File | Package | Version | Source | sha256 | Licence |
|---|---|---|---|---|---|
${rows.join("\n")}
`);
console.log(`vendored ${files.length} files into js/vendor`);
