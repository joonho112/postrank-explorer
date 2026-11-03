#!/usr/bin/env node
// Internal links of the rendered site: every relative href and src in docs/**/*.html (Quarto's site_libs aside) must
// point at a file in docs/, and a #fragment on another page must name an id there. Links that leave the site
// (http, https, mailto) are listed, never fetched.
//   node verification/check_links.mjs [--verbose]
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { docsPages, DOCS } from "./browser.mjs";

const verbose = process.argv.includes("--verbose");
const failures = [];
const external = new Set();
const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) idCache.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idCache.get(file);
};

let links = 0;
for (const page of docsPages()) {
  const file = join(DOCS, page);
  const html = readFileSync(file, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (s) => s.replace(/(?<=<script\b[^>]*>)[\s\S]*(?=<\/script>)/, ""));
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = m[1].replace(/&amp;/g, "&");
    if (raw === "" || raw.startsWith("#") && raw.length === 1) continue;
    if (/^(https?:|mailto:)/i.test(raw)) { external.add(raw); continue; }
    if (/^(data:|javascript:|blob:)/i.test(raw)) continue;
    links += 1;
    const [pathPart, frag] = raw.split("#");
    const path = pathPart.split("?")[0];
    let target = path === "" ? file : path.startsWith("/") ? join(DOCS, path) : resolve(dirname(file), path);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!target.startsWith(DOCS)) { failures.push(`${page}: ${raw} leaves docs/`); continue; }
    if (!existsSync(target)) { failures.push(`${page}: broken link ${raw}`); continue; }
    if (frag && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(frag))) {
      failures.push(`${page}: ${raw} names no id "${frag}" in ${relative(DOCS, target)}`);
    }
  }
}
if (verbose) for (const x of [...external].sort()) console.log(`  external ${x}`);
for (const f of failures) console.log(`FAIL ${f}`);
console.log(`check_links: ${docsPages().length} pages, ${links} internal links, ${external.size} external (not fetched); ${failures.length} broken`);
process.exit(failures.length ? 1 : 0);
