#!/usr/bin/env node
// Page policy: legacy79 prose has250–450words; P-only visual pages have<=160visible words, no minimum. Counted on the rendered
// page (docs/pages/<part>/<name>.html): the main content without the title block (title and subtitle), the app, code
// blocks (the In postrank lines), scripts and styles; a word is a run of non-space characters holding a letter or a
// digit. All built applications are checked.
//   node verification/check_pages.mjs [--only <name>] [--verbose]
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {profilePagePolicy} from "./profile_page_policy.mjs";
import { appsFor, DOCS, ROOT } from "./browser.mjs";

const CONFIG = Object.freeze({ min: 250, max: 450 });
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const verbose = args.includes("--verbose");
const failures = [];
const listed = [];

/** The words of a rendered page's prose. */
export function pageWords(html) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html);
  if (!main) return null;
  const prose = main[1]
    .replace(/<header id="title-block-header"[\s\S]*?<\/header>/, "")
    .replace(/<script\b[\s\S]*?<\/script>/g, "")
    .replace(/<style\b[\s\S]*?<\/style>/g, "")
    .replace(/<pre\b[\s\S]*?<\/pre>/g, "")
    .replace(/<div id="app"[^>]*>[\s\S]*?<\/div>/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ");
  return prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
let checked = 0;
for (const a of appsFor(only)) {
  const page = `pages/${a.slug}/${a.name}.html`;
  const file = join(DOCS, page);
  if (!existsSync(file)) { failures.push(`${page}: not rendered`); continue; }
  const html = readFileSync(file, "utf8");
  if (a.part === "P") {
    const r = profilePagePolicy(html,{name:a.name}); checked += 1;
    failures.push(...r.problems.map(p=>`${page}: ${p}`));
    if(verbose) console.log(`  ${a.id} ${a.name}: ${r.visibleWords} visible, ${r.closedWords} closed technical, ${r.hiddenWords} other hidden words; max160, no minimum`);
    continue;
  }
  const n = pageWords(html);
  if (n === null) { failures.push(`${page}: no <main> element`); continue; }
  const inRange = n >= CONFIG.min && n <= CONFIG.max;
  checked += 1;
  if (!inRange) failures.push(`${page}: ${n} words (the page form asks for ${CONFIG.min}–${CONFIG.max})`);
  else if (verbose) console.log(`  ${a.id} ${a.name}: ${n} words`);
}
if (verbose) for (const x of listed) console.log(`  listed ${x}`);
for (const f of failures) console.log(`FAIL ${f}`);
console.log(`check_pages: ${checked} v3 page(s) counted, ${listed.length} listed only; ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
}
