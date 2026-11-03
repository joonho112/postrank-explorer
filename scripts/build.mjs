#!/usr/bin/env node
// The generator: everything that follows from the catalog. One command before every render (and in run_all.sh).
//
//   node scripts/build.mjs                write the files below (only those that changed), then build the bundles
//   node scripts/build.mjs --check        write nothing; exit 1 when the catalog is invalid or a generated file or
//                                         bundle is missing, extra or stale (edited by hand, or the catalog changed)
//   node scripts/build.mjs --only <name>  one app (a builder in a worktree): check only its entry and write only
//                                         catalog.json, its bundle and its embed; with --check, check only those
//   node scripts/build.mjs --pre-render   Quarto's pre-render: the whole build for a render of the whole site; for a
//                                         render of some pages, --only for each app page among them and nothing for
//                                         other pages, so the shared files (cards, navbar, catalog tables) stay put
//
// The catalog is catalog/site.json (the parts) and one file per app, catalog/entries/<id>-<name>.json. From it (and
// data/released/data_contract.json for the licence notices):
//   catalog.json               the merged catalog (read by the apps through base.js, the checks and r-export/)
//   js/bundles/<name>.js       one classic-script bundle per js/apps/<name>.js (engine/scripts/build-bundles.mjs)
//   embed/<name>.html          standalone page of every built app: works from file://, URL parameters, theme=dark
//   pages/<slug>/_apps.md      the cards of a part's index (included by pages/<slug>/index.qmd)
//   _catalog.md                the catalog tables (included by catalog.qmd)
//   _nav.yml                   the navbar: one entry per part (a menu once it has built apps), Catalog
// Catalog rules checked here: an entry's file is named <id>-<name>.json; ids are <part>.<n> with the part's key;
// app numbers 1 to n within each part with no gap; unique ids and names, a known part, status planned | building | built (building: a builder is at work; the app
// is not on the site yet and its files may be incomplete), a one-line idea, data and credit; a built app has
// js/apps/<name>.js, pages/<slug>/<name>.qmd whose subtitle starts with "<id> · ", a caption and at least one preset;
// preset ids are unique and every key of a preset query is a plain word; every "try" entry names a preset of the app
// or a query; every js/apps/<name>.js has a building or built entry.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = process.argv.slice(2);
const CHECK = ARGS.includes("--check");
const ONLY = ARGS.includes("--only") ? ARGS[ARGS.indexOf("--only") + 1] : null;
const PRE_RENDER = ARGS.includes("--pre-render");
export const STATUSES = ["planned", "building", "built"];
const SITE = "postrank Explorer";
// Explicit non-app modules; arbitrary files still require a catalog entry.
export const APP_HELPERS = Object.freeze(["krw-common.js", "cde-common.js"]);

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = (s) => String(s).replace(/\|/g, "\\|");
const yq = (s) => JSON.stringify(String(s));

/** Order of ids within a part: 1.2 before 1.10. */
const idOrder = (id) => Number(String(id).split(".")[1]);

/** The catalog from its sources: { about, parts, apps } with the apps in part order, then by number. */
export function loadCatalog() {
  const site = JSON.parse(read("catalog/site.json"));
  const websiteCopy = JSON.parse(read("catalog/site-copy.json"));
  const dir = join(ROOT, "catalog/entries");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const apps = files.map((f) => ({ ...JSON.parse(read(`catalog/entries/${f}`)), [FILE]: f }));
  const rank = new Map((site.parts ?? []).map((p, i) => [p.key, i]));
  apps.sort((a, b) => (rank.get(a.part) ?? 99) - (rank.get(b.part) ?? 99) || idOrder(a.id) - idOrder(b.id));
  return { about: site.about, parts: site.parts ?? [], apps, discovery: JSON.parse(read("catalog/discovery.json")), siteCopy: websiteCopy.apps, siteNavigation: websiteCopy.navigation };
}

/** The entry file an app came from (not part of the merged catalog.json). */
const FILE = Symbol("file");

/** The subtitle in a page's front matter, or null. */
function pageSubtitle(file) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf8"));
  const m = fm && /^subtitle:\s*"(.*)"\s*$/m.exec(fm[1]);
  return m ? m[1] : null;
}

/** Catalog problems (strings); empty when the catalog is valid. */
export function validate(cat, { appFiles } = {}) {
  const errs = [];
  // Website copy is separate from the metadata embedded in application bundles.
  for (const a of cat.apps ?? []) {
    const copy = cat.siteCopy?.[a.name];
    if (!copy?.title || !copy?.description) errs.push(`website copy missing for ${a.name}`);
  }
  for (const name of Object.keys(cat.siteCopy ?? {})) {
    if (!cat.apps.some(a => a.name === name)) errs.push(`website copy has unknown app ${name}`);
  }
  const parts = new Map((cat.parts ?? []).map((s) => [s.key, s]));
  const ids = new Set();
  const names = new Set();
  for (const s of cat.parts ?? []) for (const f of ["key", "slug", "title", "lead"]) if (!s[f]) errs.push(`part ${s.key ?? "?"}: missing ${f}`);
  for (const a of cat.apps ?? []) {
    const where = `app ${a.id ?? "?"} (${a.name ?? "?"})`;
    for (const f of ["id", "name", "part", "title", "idea", "status", "from", "credit"]) if (!a[f]) errs.push(`${where}: missing ${f}`);
    if (!new RegExp(`^${a.part}\\.[1-9][0-9]*$`).test(a.id ?? "")) errs.push(`${where}: id must be <part>.<n> with part ${a.part}`);
    if (a[FILE] && a[FILE] !== `${a.id}-${a.name}.json`) errs.push(`${where}: entry file ${a[FILE]} must be named ${a.id}-${a.name}.json`);
    if (!Array.isArray(a.data) || !a.data.length) errs.push(`${where}: data must list the files used (or "engine")`);
    for (const d of a.data ?? []) if (d !== "engine" && !existsSync(join(ROOT, d))) errs.push(`${where}: data file ${d} does not exist`);
    if (ids.has(a.id)) errs.push(`${where}: duplicate id`);
    if (names.has(a.name)) errs.push(`${where}: duplicate name`);
    ids.add(a.id);
    names.add(a.name);
    if (!/^[a-z][a-z0-9-]*$/.test(a.name ?? "")) errs.push(`${where}: name must be lower-case words joined by hyphens`);
    if (!parts.has(a.part)) errs.push(`${where}: unknown part ${a.part}`);
    if (!STATUSES.includes(a.status)) errs.push(`${where}: status must be ${STATUSES.join(", ")}`);
    if (/\n/.test(a.idea ?? "")) errs.push(`${where}: the idea is one line`);
    const presets = a.presets ?? [];
    const pids = new Set();
    for (const p of presets) {
      if (!p.id || !p.label || typeof p.query !== "string") errs.push(`${where}: a preset needs id, label and query`);
      if (pids.has(p.id)) errs.push(`${where}: duplicate preset ${p.id}`);
      pids.add(p.id);
      for (const k of new URLSearchParams(String(p.query ?? "").replace(/^\?/, "")).keys()) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(k) || k === "preset" || k === "theme") errs.push(`${where}: preset ${p.id} has a bad key ${k}`);
      }
    }
    for (const t of a.try ?? []) {
      if (t.preset && !pids.has(t.preset)) errs.push(`${where}: try names an unknown preset ${t.preset}`);
      if (!t.preset && typeof t.query !== "string") errs.push(`${where}: a try entry needs a preset or a query`);
      if (!Array.isArray(t.shows) || !t.shows.length) errs.push(`${where}: a try entry needs shows: [...]`);
    }
    const slug = parts.get(a.part)?.slug;
    const appFile = `js/apps/${a.name}.js`;
    const pageFile = `pages/${slug}/${a.name}.qmd`;
    if (a.status === "built") {
      if (!existsSync(join(ROOT, appFile))) errs.push(`${where}: built but ${appFile} is missing`);
      if (!existsSync(join(ROOT, pageFile))) errs.push(`${where}: built but ${pageFile} is missing`);
      else if (!String(pageSubtitle(join(ROOT, pageFile)) ?? "").startsWith(`${a.id} · `)) errs.push(`${where}: the subtitle of ${pageFile} must start with "${a.id} · "`);
      if (!a.caption) errs.push(`${where}: built apps need a caption (one line: source, scope)`);
      if (!presets.length) errs.push(`${where}: built apps need presets`);
    }
  }
  // app numbers within a part run 1, 2, 3, … with no gap (a planned app keeps its place in the order)
  for (const s of cat.parts ?? []) {
    const nums = (cat.apps ?? []).filter((a) => a.part === s.key).map((a) => idOrder(a.id)).sort((x, y) => x - y);
    nums.forEach((k, i) => { if (k !== i + 1) errs.push(`part ${s.key}: app numbers must run 1 to ${nums.length} without gaps (found ${s.key}.${k} at place ${i + 1})`); });
  }
  const appDir = join(ROOT, "js/apps");
  if (appFiles || existsSync(appDir)) {
    for (const f of (appFiles ?? readdirSync(appDir)).filter((x) => x.endsWith(".js"))) {
      if (APP_HELPERS.includes(f)) continue;
      const a = (cat.apps ?? []).find((x) => x.name === f.slice(0, -3));
      if (!a) errs.push(`js/apps/${f} has no catalog entry`);
      else if (a.status === "planned") errs.push(`js/apps/${f} exists but its entry is planned (set status "building" while you work on it)`);
    }
  }
  if (cat.discovery) {
    const topics = new Set(cat.discovery.topics.map(t => t.key));
    for (const a of cat.apps) {
      const tags = cat.discovery.appTopics[a.name];
      if (!Array.isArray(tags) || !tags.length || new Set(tags).size !== tags.length || tags.some(t => !topics.has(t))) errs.push(`app ${a.id}: missing or invalid discovery topics`);
      for (const file of a.data ?? []) if (!cat.discovery.dataGroups.some(g => g.files?.includes(file.split("/").pop()))) errs.push(`app ${a.id}: no discovery data family for ${file}`);
    }
    for (const name of Object.keys(cat.discovery.appTopics)) if (!names.has(name)) errs.push(`discovery topics refer to unknown app ${name}`);
  }
  return errs;
}

// --------------------------------------------------------------------------------------------- helpers

const partOf = (cat, a) => cat.parts.find((s) => s.key === a.part);
const pagePath = (cat, a) => `pages/${partOf(cat, a).slug}/${a.name}`;
/** "1 · Ranking under uncertainty"; the Tools part has no number. */
const partLabel = (s) => (/^[0-9]+$/.test(s.key) ? `${s.key} · ${s.title}` : s.title);
const built = (cat) => cat.apps.filter((a) => a.status === "built");

/** Required notices for the non-author data an app uses (from the data contract). */
function notices(a) {
  const contract = JSON.parse(read("data/released/data_contract.json"));
  const out = [];
  for (const d of a.data ?? []) {
    const file = d.split("/").pop();
    const entry = contract.files?.[file] ?? contract.precomputed?.[file];
    if (!entry || entry.license_scope === "author") continue;
    const scope = contract.license_scopes?.[entry.license_scope];
    for (const n of [...(scope?.required_notice ?? []), ...(EXTRA_NOTICES[entry.license_scope] ?? [])]) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Notices the data-rights note asks for beyond the contract's required ones (notes/data-rights.md). */
const EXTRA_NOTICES = {
  "cc-by-nc-krw": ["Changes: continuous midpoint-cell comparison probabilities and matching central 90% marginal intervals replace KRW’s posterior grids (postrank adaptation)."],
  "cde-source-conditions": ["changes noted"],
  "cc-by-4.0-atlas": ["Opportunity Insights and U.S. Census Bureau", "changes noted"],
};

function scripts(a, prefix) {
  const s = [`${prefix}js/vendor/d3.min.js`, `${prefix}js/vendor/plot.min.js`];
  if (a.math) s.push(`${prefix}js/vendor/temml/temml.min.js`);
  s.push(`${prefix}js/bundles/${a.name}.js`);
  return s.map((src) => `<script src="${src}"></script>`).join("\n");
}

const THEME_SCRIPT = `<script>
  // ?theme=light|dark wins over the viewer's prefers-color-scheme
  (function () {
    var t = new URLSearchParams(location.search).get("theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  })();
</script>`;

function embedHtml(cat, a) {
  const credit = [`${SITE} · ${a.id}`, esc(a.credit), ...notices(a).map(esc),
    `<a href="../${pagePath(cat, a)}.html">page</a>`].join(" · ");
  const styles = ["../styles/tokens.css", "../styles/app.css", ...(a.math ? ["../styles/temml.css"] : [])];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<!-- ${a.id} ${a.name}. Build inputs: catalog.json; do not edit. -->
<title>${esc(a.title)} · ${SITE}</title>
${THEME_SCRIPT}
${styles.map((h) => `<link rel="stylesheet" href="${h}">`).join("\n")}
</head>
<body class="prx-embed">
<main>
<h1 class="prx-embed-title">${esc(a.title)}</h1>
<div id="app"><p>This app needs JavaScript.</p></div>
<p class="prx-embed-credit">${credit}</p>
</main>
<!-- classic scripts only, so this page works from file:// -->
${scripts(a, "../")}
<script>window.__prxApp = PRX[${JSON.stringify(a.name)}].mountWidget(document.getElementById("app"), {});</script>
</body>
</html>
`;
}

function card(cat, a, prefix) {
  const copy = cat.siteCopy[a.name];
  const page = `${prefix}${pagePath(cat, a)}.html`;
  const thumb = `media/thumbs/${a.name}.png`;
  const isBuilt = a.status === "built";
  const img = isBuilt && existsSync(join(ROOT, thumb))
    ? `<a class="prx-card-thumb" href="${page}" tabindex="-1" aria-hidden="true"><img src="${prefix}${thumb}" alt="" loading="lazy"></a>\n`
    : "";
  const title = isBuilt ? `<a href="${page}">${esc(copy.title)}</a>` : esc(copy.title);
  const links = isBuilt
    ? `\n<p class="prx-card-links"><a href="${prefix}embed/${a.name}.html">standalone</a></p>`
    : "";
  return `<article class="prx-card prx-card-${a.status}">
${img}<div class="prx-card-body">
<p class="prx-card-id">${esc(a.id)}${isBuilt ? "" : ` · <span class="prx-status">${a.status}</span>`}</p>
<h3>${title}</h3>
<p>${esc(copy.description)}</p>${cardCredit(a)}${links}
</div>
</article>`;
}

/** A short data credit on the card of an app that shows non-author data (its thumbnail shows that data too). */
function cardCredit(a) {
  const n = notices(a).filter((x) => !/^(doi:|https?:)/.test(x) && x !== "changes noted" && !x.startsWith("Changes:") && x !== "No endorsement" && x !== "Noncommercial");
  return n.length ? `\n<p class="prx-card-credit">Data: ${n.map(esc).join(" · ")}</p>` : "";
}

function partCards(cat, s) {
  const apps = cat.apps.filter((a) => a.part === s.key);
  return `<!-- Build inputs: the catalog; do not edit. -->
\`\`\`{=html}
<div class="prx-cards">
${apps.map((a) => card(cat, a, "../../")).join("\n")}
</div>
\`\`\`
`;
}

function catalogTables(cat) {
  const d = cat.discovery, topicByKey = new Map(d.topics.map(t => [t.key, t.label]));
  const options = (items) => items.map(i => `<option value="${esc(i.key)}">${esc(i.label ?? partLabel(i))}</option>`).join("");
  const cards = built(cat).map(a => {
    const topics = d.appTopics[a.name], groups = d.dataGroups.filter(g => g.files?.some(f => a.data.some(p => p.split("/").pop() === f)) || g.apps?.includes(a.name));
    const copy = cat.siteCopy[a.name];
    const content = [a.id, copy.title, copy.description, a.title, a.idea, ...topics.map(t => topicByKey.get(t)), ...groups.map(g => g.label), ...(a.presets ?? []).map(p => p.label)].join(" ");
    const tags = `<p class="prx-catalog-topics">${topics.map(t => `<span>${esc(topicByKey.get(t))}</span>`).join(" ")}</p><p class="prx-catalog-data">${groups.map(g => esc(g.label)).join(" · ")}</p>`;
    return card(cat, a, "").replace('<article ', `<article data-part="${esc(a.part)}" data-topics="${topics.join(" ")}" data-data="${groups.map(g=>g.key).join(" ")}" data-search="${esc(content)}" `).replace('<p class="prx-card-id">', tags+'<p class="prx-card-id">');
  });
  return `<!-- Build inputs: the catalog and discovery metadata; do not edit. -->
\`\`\`{=html}
<section class="prx-catalog" data-catalog>
<form class="prx-catalog-filters" hidden aria-label="Application catalogue">
<label>Search<input type="search" name="query" placeholder="τ, intervals, posterior" autocomplete="off"></label>
<label>Part<select name="part"><option value="">All parts</option>${options(cat.parts)}</select></label>
<label>Concept<select name="topic"><option value="">All concepts</option>${options(d.topics)}</select></label>
<label>Data<select name="data"><option value="">All data</option>${options(d.dataGroups)}</select></label>
<button type="reset">Clear filters</button>
</form>
<p class="prx-catalog-count" role="status" aria-live="polite" aria-atomic="true">${cards.length} apps</p>
<p class="prx-catalog-empty" hidden>No applications match the selected filters.</p>
<div class="prx-cards">${cards.join("\n")}</div>
</section>
<script src="js/site/catalog.js" defer></script>
\`\`\`
`;
}

function navYml(cat) {
  // no "Home" entry: the site title links home, and the six parts need the room
  const out = ["# Build inputs: the catalog; do not edit.", "website:", "  navbar:", "    left:"];
  for (const s of cat.parts) {
    const apps = built(cat).filter((a) => a.part === s.key);
    const text = yq(cat.siteNavigation?.[s.key] ?? partLabel(s));
    if (!apps.length) {
      out.push(`      - text: ${text}`, `        href: pages/${s.slug}/index.qmd`);
      continue;
    }
    out.push(`      - text: ${text}`, "        menu:", "          - text: Overview", `            href: pages/${s.slug}/index.qmd`);
    for (const a of apps) out.push(`          - text: ${yq(cat.siteCopy[a.name].title)}`, `            href: ${pagePath(cat, a)}.qmd`);
  }
  out.push("    right:", "      - text: Catalogue", "        href: catalog.qmd", "      - text: Terminology", "        href: pages/words.qmd");
  return out.join("\n") + "\n";
}

/** The merged catalog.json (no comments in JSON, so its "about" says it is generated). */
function catalogJson(cat) {
  const about = "Build inputs: catalog/site.json and catalog/entries/; do not edit. Edit those files instead.";
  return JSON.stringify({ about, parts: cat.parts, apps: cat.apps }, null, 2) + "\n";
}

/** Every generated file: path -> content. */
export function generate(cat) {
  const files = new Map();
  files.set("catalog.json", catalogJson(cat));
  for (const a of built(cat)) files.set(`embed/${a.name}.html`, embedHtml(cat, a));
  for (const s of cat.parts) files.set(`pages/${s.slug}/_apps.md`, partCards(cat, s));
  files.set("_catalog.md", catalogTables(cat));
  files.set("_nav.yml", navYml(cat));
  return files;
}

/** Generated files on disk that no catalog entry asks for (embeds of apps that are no longer built). */
function strays(files) {
  if (!existsSync(join(ROOT, "embed"))) return [];
  return readdirSync(join(ROOT, "embed")).filter((f) => f.endsWith(".html") && !files.has(`embed/${f}`)).map((f) => `embed/${f}`);
}

/** The files of one app (a builder's --only build): catalog.json, so its bundle sees its entry, and its embed. */
export function generateOnly(cat, a) {
  const files = new Map([["catalog.json", catalogJson(cat)]]);
  if (existsSync(join(ROOT, `js/apps/${a.name}.js`))) files.set(`embed/${a.name}.html`, embedHtml(cat, a));
  return files;
}

/** Problems that concern one app: its own entry and its own files. */
const concerns = (a) => (e) => e.startsWith(`app ${a.id} (${a.name})`) || e.startsWith(`js/apps/${a.name}.js `);

/** The app names of the pages in a partial render (QUARTO_PROJECT_INPUT_FILES), for --pre-render. */
function renderedApps(cat) {
  const inputs = (process.env.QUARTO_PROJECT_INPUT_FILES ?? "").split("\n").map((f) => f.trim()).filter(Boolean);
  const out = [];
  for (const f of inputs) {
    const m = /(?:^|\/)pages\/([a-z]+)\/([a-z0-9-]+)\.qmd$/.exec(f.replace(/\\/g, "/"));
    const a = m && cat.apps.find((x) => x.name === m[2] && partOf(cat, x)?.slug === m[1]);
    if (a && a.status !== "planned") out.push(a.name);
  }
  return out;
}

function main() {
  if (PRE_RENDER && process.env.QUARTO_PROJECT_RENDER_ALL !== "1") {
    const names = renderedApps(loadCatalog());
    for (const name of names) {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--only", name], { stdio: "inherit" });
      if (r.status !== 0) process.exit(1);
    }
    if (!names.length) console.log("build --pre-render: a partial render with no app page; generated files left as they are");
    return;
  }
  const cat = loadCatalog();
  const target = ONLY ? cat.apps.find((a) => a.name === ONLY) : null;
  if (ONLY && !target) {
    console.error(`build --only: no catalog entry is named ${ONLY}`);
    process.exit(1);
  }
  const errs = target ? validate(cat).filter(concerns(target)) : validate(cat);
  if (errs.length) {
    console.error(`build: the catalog has ${errs.length} problem(s):\n  ${errs.join("\n  ")}`);
    process.exit(1);
  }
  const files = target ? generateOnly(cat, target) : generate(cat);
  const problems = [];
  let written = 0;
  for (const [rel, text] of files) {
    const abs = join(ROOT, rel);
    const old = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (old === text) continue;
    if (CHECK) { problems.push(`${old === null ? "missing" : "stale"} ${rel}`); continue; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    written += 1;
  }
  for (const rel of target ? [] : strays(files)) {
    if (CHECK) problems.push(`extra ${rel} (no built catalog entry)`);
    else { rmSync(join(ROOT, rel)); written += 1; }
  }
  // the bundles inline catalog.json (through base.js), so they are built after it is written
  const bundleArgs = [...(CHECK ? ["--check"] : ["--quiet"]), ...(target ? ["--only", target.name] : [])];
  if (!target || existsSync(join(ROOT, `js/apps/${target.name}.js`))) {
    const bundles = spawnSync(process.execPath, [join(ROOT, "engine/scripts/build-bundles.mjs"), ...bundleArgs], { stdio: "inherit" });
    if (bundles.status !== 0) process.exit(1);
  }
  if (CHECK) {
    if (problems.length) {
      console.error(`build --check: ${problems.length} generated file(s) out of date; run node scripts/build.mjs\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log(target
      ? `build --check --only ${target.name}: its entry is valid (${target.status}); ${files.size} generated files fresh`
      : `build --check: catalog valid (${cat.apps.length} apps, ${built(cat).length} built); ${files.size} generated files fresh`);
    return;
  }
  console.log(target
    ? `build --only ${target.name}: ${files.size} generated files, ${written} written`
    : `build: ${cat.apps.length} apps (${built(cat).length} built); ${files.size} generated files, ${written} written`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
