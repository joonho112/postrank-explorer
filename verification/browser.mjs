// Shared pieces of the browser checks: a static server for docs/ on a free port (never 8765), the system Chrome
// through puppeteer-core with every non-local request refused, and one page visit that records failed requests and
// console errors. Importing this module runs nothing.
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const DOCS = join(ROOT, "docs");
export const CHROME = process.env.PRX_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RESERVED_PORTS = [8765];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain",
};
const CHROME_ARGS = [
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update",
  "--disable-sync", "--disable-default-apps", "--no-pings", "--metrics-recording-only",
  "--disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication",
  // no host name resolves: a request that slipped past interception fails instead of reaching the network
  "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
];

export const posix = (p) => p.split(sep).join("/");
export const catalog = () => JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
export const builtApps = () => {
  const cat = catalog();
  return cat.apps.filter((a) => a.status === "built").map((a) => ({ ...a, slug: cat.parts.find((s) => s.key === a.part).slug }));
};
/** The apps a check covers: every built app, or with --only <name> that one app, also while it is building. */
export const appsFor = (only) => {
  if (!only) return builtApps();
  const cat = catalog();
  const a = cat.apps.find((x) => x.name === only && x.status !== "planned");
  if (!a) throw new Error(`--only ${only}: no building or built catalog entry with that name (run node scripts/build.mjs --only ${only})`);
  return [{ ...a, slug: cat.parts.find((s) => s.key === a.part).slug }];
};

/** Every .html under docs/ (relative, posix), Quarto's library folders (site_libs, <page>_files) aside. */
export function docsPages() {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { if (name !== "site_libs" && !name.endsWith("_files")) walk(p); }
      else if (name.endsWith(".html")) out.push(posix(relative(DOCS, p)));
    }
  };
  walk(DOCS);
  return out;
}

/** Serve `root` on 127.0.0.1 at a free port. `virtual`: { "/path": html } pages made in memory. */
export async function startServer(root = DOCS, { virtual = {} } = {}) {
  root = resolve(root);
  const handler = (req, res) => {
    let path;
    try { path = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname); } catch { res.writeHead(400); res.end(); return; }
    const head = { "cache-control": "no-store" };
    if (Object.hasOwn(virtual, path)) { res.writeHead(200, { ...head, "content-type": TYPES[".html"] }); res.end(virtual[path]); return; }
    let file = resolve(root, path.replace(/^\/+/, ""));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!(file === root || file.startsWith(root + sep)) || !existsSync(file)) { res.writeHead(404, head); res.end(); return; }
    res.writeHead(200, { ...head, "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  };
  for (;;) {
    const server = createServer(handler);
    await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
    const { port } = server.address();
    if (RESERVED_PORTS.includes(port)) { await new Promise((ok) => server.close(ok)); continue; }
    return { origin: `http://127.0.0.1:${port}`, port, virtual, close: () => new Promise((ok) => server.close(ok)) };
  }
}

/** The system Chrome, headless, fresh profile, no background traffic. */
export async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`system Chrome not found at ${CHROME} (set PRX_CHROME)`);
  const puppeteer = createRequire(join(ROOT, "tools/package.json"))("puppeteer-core");
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
}

/**
 * Open a new tab that refuses every request outside `origin` (and file:// outside docs/), records failed requests
 * and console errors, and has the given viewport. Returns { page, errors, failed }.
 */
export async function openTab(browser, { origin, width = 1280, height = 800, scheme } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (scheme) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  const errors = [];
  const failed = [];
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const local = url.startsWith("data:") || url.startsWith("blob:") || (origin && url.startsWith(`${origin}/`))
      || (url.startsWith("file://") && fileURLToPath(url.split(/[?#]/)[0]).startsWith(ROOT));
    if (local) req.continue();
    else { failed.push(`refused ${url}`); req.abort("blockedbyclient"); }
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!failed.some((f) => f.endsWith(url))) failed.push(`failed ${url} (${req.failure()?.errorText ?? "?"})`);
  });
  page.on("response", (res) => { if (res.status() >= 400 && !res.url().endsWith("/favicon.ico")) failed.push(`HTTP ${res.status()} ${res.url()}`); });
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
  return { page, errors, failed };
}

/** Wait for the widget's DOM state, including in background tabs whose animation frames are suspended. */
export async function waitForWidgetIdle(page, { timeout = 30000 } = {}) {
  await page.waitForFunction(() => {
    const root = document.querySelector(".prx-widget");
    return root !== null && root.getAttribute("aria-busy") !== "true";
  }, { polling: "mutation", timeout });
}

/** Run work(item) over items with at most `jobs` at a time; results keep the input order. */
export async function pool(items, jobs, work) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => { while (next < items.length) { const i = next++; out[i] = await work(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, lane));
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
