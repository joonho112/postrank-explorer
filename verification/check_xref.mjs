#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Verifies unified app titles across catalog/site-copy, pages, embeds, cards, and navbar,
// and checks that all postrank theory-book citations follow v5 chapter numbering (1..33).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// Apps whose pre-v5 chapter numbers (6, 11, 14..21) were renumbered in v5; forbidden legacy numbers per app:
const FORBIDDEN_OLD_CHAPTERS = Object.freeze({
  "1.5": [20],
  "1.6": [18],
  "1.9": [18],
  "1.14": [19],
  "1.15": [16],
  "1.17": [15],
  "1.18": [15],
  "2.3": [14],
  "2.5": [11, 16],
  "2.8": [6],
  "2.9": [18],
  "2.10": [16],
  "2.11": [16, 19],
  "2.12": [14],
  "2.16": [14],
  "2.17": [16, 18],
  "2.18": [15],
  "2.19": [16],
  "2.20": [17, 21],
  "3.1": [16, 17],
  "3.2": [16, 17],
  "3.3": [17],
  "3.4": [17],
  "3.5": [17],
  "3.6": [19],
  "3.7": [16],
  "3.8": [16, 17],
  "3.11": [16, 18],
  "3.12": [17],
  "3.13": [17, 19, 21],
  "4.2": [19],
  "4.6": [19],
  "4.12": [19, 21],
  "4.13": [19],
  "4.14": [15],
  "5.6": [20],
  "T.2": [21],
});

const TB_RE = /theory book[\s\S]{0,90}?\b(?:ch(?:apter)?s?\.?)\s*((?:\d+(?:\s*(?:,|and|–|-)\s*(?:ch(?:apter)?s?\.?\s*)?)?)+)/gi;
const TB_REV_RE = /\b(?:ch(?:apter)?s?\.?)\s*((?:\d+(?:\s*(?:,|and|–|-)\s*(?:ch(?:apter)?s?\.?\s*)?)?)+)[\s\S]{0,45}?theory book/gi;

const catalog = JSON.parse(read("catalog.json"));
const siteCopy = JSON.parse(read("catalog/site-copy.json")).apps;
const navYml = read("_nav.yml");
const catalogMd = read("_catalog.md");
const partsByKey = new Map(catalog.parts.map((p) => [p.key, p]));

const references = JSON.parse(read("catalog/theory-references.json"));
const bookSource = process.env.POSTRANK_THEORY_SOURCE || resolve(ROOT, "../postrank-theory-book-public");
const bookHtml = process.env.POSTRANK_THEORY_HTML;
const checkGeneratedTheoryLinks = !process.argv.includes("--source-only");
const failures = [];
const sourceAvailable = existsSync(join(bookSource, "chapters"));
if (process.env.POSTRANK_THEORY_SOURCE && !sourceAvailable) failures.push("POSTRANK_THEORY_SOURCE must contain the book chapters");
let verifiedLinks = 0;
const theoryUrl = (id) => new URL(references.sections[id].file + "#" + id, references.book).href;
for (const [id, section] of Object.entries(references.sections)) {
  const prefix = String(section.chapter).padStart(2, "0");
  if (!section.title || !/^[a-z0-9-]+$/.test(id) || !section.file.startsWith("chapters/" + prefix + "-") ||
      !/^chapters\/[0-9]{2}-[a-z0-9-]+\.html$/.test(section.file)) {
    failures.push(`Invalid published theory destination ${id}`);
    continue;
  }
  if (sourceAvailable) {
    const path = join(bookSource, section.file.replace(/\.html$/, ".qmd"));
    const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
    const found = lines.some((line, i) => {
      if (!/^#+\s/.test(line)) return false;
      const title = line.replace(/^#+\s+/, "").replace(/\s*\{[^{}]*\}\s*$/, "").trim();
      const anchor = /\{#([^\s}]+)/.exec(line) ?? /^(?::::+\s*)\{#([^\s}]+)/.exec(lines[i - 1] ?? "");
      return title === section.title && anchor?.[1] === id;
    });
    if (!found) failures.push(`Source heading, label, or anchor mismatch at ${section.file}#${id}`);
  }
  if (bookHtml) {
    const path = join(bookHtml, section.file);
    if (!existsSync(path) || !readFileSync(path, "utf8").includes(`id="${id}"`)) {
      failures.push(`Rendered book does not contain ${section.file}#${id}`);
    }
  }
}
for (const id of Object.keys(references.apps)) {
  if (!catalog.apps.some(a => a.id === id)) failures.push(`Theory cross-reference for unknown app ${id}`);
}

let citedCount = 0;

for (const app of catalog.apps.filter((a) => a.status === "built")) {
  const copy = siteCopy[app.name];
  if (!copy) {
    failures.push(`${app.id} ${app.name}: missing in catalog/site-copy.json`);
    continue;
  }
  const slug = partsByKey.get(app.part)?.slug;
  const pageFile = `pages/${slug}/${app.name}.qmd`;
  const pageTxt = read(pageFile);
  const fmTitle = /^title:\s*"((?:[^"\\]|\\.)*)"/m.exec(pageTxt)?.[1];
  if (fmTitle !== copy.title) failures.push(`${app.id}: ${pageFile} title "${fmTitle}" !== "${copy.title}"`);
  if (!navYml.includes(`${app.id} · ${copy.title}`)) failures.push(`${app.id}: _nav.yml missing "${app.id} · ${copy.title}"`);
  const embedTxt = read(`embed/${app.name}.html`);
  const h1 = /<h1 class="prx-embed-title">([\s\S]*?)<\/h1>/.exec(embedTxt)?.[1]
    ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  if (h1 !== copy.title) failures.push(`${app.id}: embed/${app.name}.html h1 "${h1}" !== "${copy.title}"`);
  if (!catalogMd.includes(`>${copy.title.replace(/&/g, "&amp;")}</a></h3>`)) {
    failures.push(`${app.id}: _catalog.md missing canonical card heading "${copy.title}"`);
  }
  if (app.id === "5.8" && /tiers/i.test(app.title)) {
    failures.push(`5.8: catalog entry title still uses "tiers" instead of "tertiles": "${app.title}"`);
  }

  const entry = JSON.parse(read(`catalog/entries/${app.id}-${app.name}.json`));
  const forbidden = new Set(FORBIDDEN_OLD_CHAPTERS[app.id] ?? []);
  const sources = [
    ["credit", entry.credit ?? ""],
    ["caption", entry.caption ?? ""],
    ["from", entry.from ?? ""],
    ["page", pageTxt],
  ];
  const targets = references.apps[app.id] ?? [];
  if (new Set(targets).size !== targets.length) failures.push(`${app.id}: duplicate theory destination`);
  const expectedLinks = new Set();
  for (const id of targets) {
    if (!references.sections[id]) {
      failures.push(`${app.id}: unknown theory section ${id}`);
      continue;
    }
    const href = theoryUrl(id);
    const link = `[${references.sections[id].title}](${href})`;
    if (!pageTxt.includes(link)) failures.push(`${app.id}: missing visible section link ${link}`);
    if (checkGeneratedTheoryLinks && !embedTxt.includes(`href="${href}"`)) {
      failures.push(`${app.id}: standalone is missing published theory destination ${id}`);
    }
    expectedLinks.add(href);
    verifiedLinks++;
  }
  const namedCreditSections = /\bch(?:apter)?\.?\s+(\d+)\s*[,()]?\s*\(?[“"]([^”"]+)[”"]/gi;
  for (const match of (entry.credit ?? "").matchAll(namedCreditSections)) {
    const linked = targets.some(id => references.sections[id]?.chapter === Number(match[1]) &&
      references.sections[id]?.title === match[2]);
    if (!linked) failures.push(`${app.id}: printed chapter ${match[1]} section “${match[2]}” has no matching destination`);
  }
  const actualLinks = [...pageTxt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]);
  for (const href of actualLinks.filter(u => u.startsWith(references.book + "chapters/"))) {
    if (!expectedLinks.has(href)) failures.push(`${app.id}: unregistered theory-book link ${href}`);
  }
  for (const [field, text] of sources) {
    for (const re of [TB_RE, TB_REV_RE]) {
      for (const m of text.matchAll(re)) {
        const nums = [...m[1].matchAll(/\d+/g)].map((x) => Number(x[0]));
        for (const n of nums) {
          citedCount += 1;
          if (!targets.some(id => references.sections[id]?.chapter === n)) {
            failures.push(`${app.id} [${field}]: chapter ${n} has no linked section`);
          }
          if (n < 1 || n > 33) failures.push(`${app.id} [${field}]: chapter ${n} outside v5 range 1..33`);
          if (forbidden.has(n)) failures.push(`${app.id} [${field}]: stale pre-v5 chapter ${n} in "${m[0].replace(/\s+/g, " ")}"`);
        }
      }
    }
  }
}

// Verify home-page tile alt titles match site-copy.json
const indexQmd = read("index.qmd");
for (const m of indexQmd.matchAll(/alt="([0-9PT]+\.\d+)\s+([^"]+?)\s+chart preview"/g)) {
  const [, id, altTitle] = m;
  const app = catalog.apps.find((a) => a.id === id);
  const expected = app ? siteCopy[app.name]?.title : null;
  if (expected && altTitle !== expected) {
    failures.push(`index.qmd tile alt for ${id}: "${altTitle}" !== "${expected}"`);
  }
}

for (const f of failures) console.error(`FAIL ${f}`);
console.log(`check_xref: ${catalog.apps.length} apps title-checked, ${citedCount} chapter mentions, ${verifiedLinks} linked theory sections verified; ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
