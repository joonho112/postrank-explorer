#!/usr/bin/env node
// Page policy:
// - P-only visual pages (part === "P"): <= 160 visible words, no minimum (profilePagePolicy).
// - Migrated frame-v2 pages (js/apps/<name>.js sets frame: "v2" or layout: "v2"): <= 250 visible words, no minimum (v2PagePolicy).
// - Unmigrated legacy pages: 250–450 words (pageWords).
//   node verification/check_pages.mjs [--only <name>] [--verbose]
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { profilePagePolicy } from "./profile_page_policy.mjs";
import { appsFor, DOCS, ROOT } from "./browser.mjs";

const { JSDOM } = createRequire(new URL("../tools/package.json", import.meta.url))("jsdom");
const CONFIG = Object.freeze({ min: 250, max: 450, v2MaxVisible: 250 });
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const verbose = args.includes("--verbose");
const failures = [];
const listed = [];

const countWords = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** The words of a rendered legacy page's prose. */
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
  return countWords(prose);
}

/** Disclosure-aware visible prose check for migrated frame: "v2" pages (no artificial 250-word floor). */
export function v2PagePolicy(html, { name, maxVisible = CONFIG.v2MaxVisible } = {}) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const main = doc.querySelector("main");
  const problems = [];
  if (!main) {
    dom.window.close();
    return { visibleWords: 0, closedWords: 0, problems: ["Missing main element"] };
  }
  if (!main.querySelector("#app")) problems.push("Missing app mount");
  const links = [...main.querySelectorAll("a[href]")].map((n) => n.getAttribute("href") ?? "");
  if (name && !links.some((h) => h.includes(`embed/${name}.html`))) problems.push("Missing standalone link");
  main.querySelectorAll("header#title-block-header, #app, nav.prx-app-sequence, script, style, noscript, pre").forEach((n) => n.remove());
  const groups = { visible: [], closed: [] };
  const walk = doc.createTreeWalker(main, dom.window.NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    let closed = false;
    let hidden = false;
    for (let p = node.parentElement; p && p !== main.parentElement; p = p.parentElement) {
      if (p.hidden || p.getAttribute("aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(p.getAttribute("style") ?? "")) {
        hidden = true;
        break;
      }
      if (p.tagName === "DETAILS" && !p.open) {
        const summary = [...p.children].find((c) => c.tagName === "SUMMARY");
        if (!summary?.contains(node)) closed = true;
      }
    }
    if (!hidden) groups[closed ? "closed" : "visible"].push(node.textContent ?? "");
  }
  const visibleWords = countWords(groups.visible.join(" "));
  const closedWords = countWords(groups.closed.join(" "));
  if (visibleWords > maxVisible) problems.push(`Visible prose ${visibleWords} exceeds ${maxVisible}`);
  dom.window.close();
  return { visibleWords, closedWords, maxVisibleWords: maxVisible, problems };
}

function isFrameV2App(appName) {
  const appFile = join(ROOT, "js", "apps", `${appName}.js`);
  if (!existsSync(appFile)) return false;
  const src = readFileSync(appFile, "utf8");
  return /\b(?:frame|layout)\s*:\s*["']v2["']/.test(src);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let checked = 0;
  const names = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : [null];
  const targets = names[0] === null ? appsFor(null) : names.flatMap((n) => appsFor(n));
  for (const a of targets) {
    const page = `pages/${a.slug}/${a.name}.html`;
    const file = join(DOCS, page);
    if (!existsSync(file)) { failures.push(`${page}: not rendered`); continue; }
    const html = readFileSync(file, "utf8");
    if (a.part === "P") {
      const r = profilePagePolicy(html, { name: a.name });
      checked += 1;
      failures.push(...r.problems.map((p) => `${page}: ${p}`));
      if (verbose) console.log(`  ${a.id} ${a.name}: ${r.visibleWords} visible, ${r.closedWords} closed; P max 160`);
      continue;
    }
    if (isFrameV2App(a.name)) {
      const r = v2PagePolicy(html, { name: a.name });
      checked += 1;
      failures.push(...r.problems.map((p) => `${page}: ${p}`));
      if (verbose) console.log(`  ${a.id} ${a.name}: ${r.visibleWords} visible, ${r.closedWords} closed; v2 max ${CONFIG.v2MaxVisible}`);
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
