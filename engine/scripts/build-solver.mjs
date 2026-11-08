// Builds the solver bundle (CONTRACT.md 6.3, 6.6, 8.7): engine/src/mip.ts with highs-js 1.15.4, the
// WebAssembly bytes inlined as base64 and passed through the instantiateWasm(imports, done) hook (this highs
// build ignores Module.wasmBinary).
//   js/bundles/solver.js        classic IIFE for browsers: window.PRX_SOLVER = { mipSolve, ready }; the solve
//                               runs in a blob-URL Worker (script-URL workers are blocked on file://)
//   js/bundles/solver-node.mjs  ES module for Node (verification/run_parity.mjs): exports mipSolve, ready,
//                               HIGHS_VERSION; highs runs in-process
// The main engine bundle js/pr-core.js does not contain the solver (mip.ts is not exported from index.ts).
//   node scripts/build-solver.mjs
import { build, transform } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIGHS_VERSION = "1.15.4";

const here = path.dirname(fileURLToPath(import.meta.url));
const engine = path.resolve(here, "..");
const root = path.resolve(engine, "..");
const out = path.join(root, "js", "bundles");
const src = path.join(engine, "src");
const highsDir = path.join(engine, "node_modules", "highs");

const highsPkg = JSON.parse(fs.readFileSync(path.join(highsDir, "package.json"), "utf8"));
if (highsPkg.version !== HIGHS_VERSION) {
  throw new Error(`highs ${highsPkg.version} is installed; the solver bundle needs highs ${HIGHS_VERSION} (npm ci in engine/)`);
}
const wasmB64 = fs.readFileSync(path.join(highsDir, "build", "highs.wasm")).toString("base64");
const highsClassic = fs.readFileSync(path.join(highsDir, "build", "highs.js"), "utf8");
const license = fs.readFileSync(path.join(highsDir, "LICENSE"), "utf8").trim();
const notice = (what) =>
  `/* postrank Explorer solver bundle (${what}): engine/src/mip.ts with highs-js ${HIGHS_VERSION} ` +
  `(HiGHS compiled to WebAssembly; the wasm bytes are inlined as base64). Built by engine/scripts/build-solver.mjs; do not edit.\n\n` +
  `highs-js license:\n${license.replace(/\*\//g, "* /")}\n*/\n`;

/** Replace a quoted placeholder in built code by a JSON string literal (no `$` patterns involved). */
function inject(code, placeholder, value) {
  const quoted = JSON.stringify(placeholder);
  const parts = code.split(quoted);
  if (parts.length !== 2) throw new Error(`placeholder ${placeholder} found ${parts.length - 1} times in the built code`);
  return parts[0] + JSON.stringify(value) + parts[1];
}

const common = { bundle: true, minify: true, legalComments: "none", write: false, logLevel: "warning" };

// ---------------------------------------------------------------------------------------------------------
// Worker: highs.js (classic script, defines the global loader Module) followed by the message handler.

const WORKER_ENTRY = `
import { createMipSolver } from "./mip.ts";
let solver = null;
function decode(b64) {
  if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(b64);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function load(bytes) {
  return new Promise((resolve, reject) => {
    Module({
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(bytes, imports).then((r) => done(r.instance), reject);
        return {};
      },
    }).then(resolve, reject);
  });
}
self.onmessage = async (ev) => {
  const { id, type } = ev.data;
  try {
    if (type === "init") {
      const t0 = performance.now();
      const highs = await load(decode(ev.data.wasm));
      solver = createMipSolver(highs);
      self.postMessage({ id, result: { highs: ${JSON.stringify(HIGHS_VERSION)}, initSeconds: (performance.now() - t0) / 1000 } });
    } else if (type === "solve") {
      if (solver === null) throw new Error("the solver is not initialized");
      self.postMessage({ id, result: solver.solve(ev.data.E, ev.data.options) });
    } else {
      throw new Error("unknown solver request " + String(type));
    }
  } catch (err) {
    self.postMessage({ id, error: { name: err && err.name, message: String(err && err.message || err) } });
  }
};
`;

const workerGlue = (
  await build({
    ...common,
    stdin: { contents: WORKER_ENTRY, resolveDir: src, sourcefile: "solver-worker.entry.js", loader: "js" },
    format: "iife",
    target: "es2020",
  })
).outputFiles[0].text;
const workerSrc = `${highsClassic.trim()}\n${workerGlue}`;

// ---------------------------------------------------------------------------------------------------------
// Browser bundle: main-thread controller; starts the Worker on first use of ready or mipSolve.

const BROWSER_ENTRY = `
(function () {
  if (window.PRX_SOLVER) return; // loaded twice: keep the first controller and its Worker
  var WORKER_SRC = "@@WORKER_SRC@@";
  var WASM_B64 = "@@WASM_B64@@";
  var worker = null;
  var url = null;
  var started = null;
  var nextId = 1;
  var pending = new Map();
  function toError(e) {
    var C = e && e.name === "RangeError" ? RangeError : e && e.name === "TypeError" ? TypeError : Error;
    return new C(e && e.message ? e.message : "solver error");
  }
  function failAll(err) {
    pending.forEach(function (p) { p.reject(err); });
    pending.clear();
  }
  function request(message) {
    return new Promise(function (resolve, reject) {
      if (!worker) {
        reject(new Error("the solver worker is not running"));
        return;
      }
      var id = nextId++;
      pending.set(id, { resolve: resolve, reject: reject });
      message.id = id;
      worker.postMessage(message);
    });
  }
  function start() {
    if (started) return started;
    try {
      url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
      worker = new Worker(url);
    } catch (err) {
      started = Promise.reject(err);
      return started;
    }
    worker.onmessage = function (ev) {
      var m = ev.data;
      var p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.reject(toError(m.error));
      else p.resolve(m.result);
    };
    worker.onerror = function (ev) {
      // an uncaught Worker error: reject everything pending; the next ready or mipSolve starts a new Worker
      if (ev && ev.preventDefault) ev.preventDefault();
      var dead = worker;
      worker = null;
      started = null;
      if (dead && dead.terminate) dead.terminate();
      failAll(new Error("solver worker failed: " + ((ev && ev.message) || "unknown error")));
    };
    var blobUrl = url;
    started = request({ type: "init", wasm: WASM_B64 }).then(function (info) {
      URL.revokeObjectURL(blobUrl);
      return info;
    });
    return started;
  }
  function mipSolve(E, options) {
    return start().then(function () {
      return request({ type: "solve", E: E, options: options });
    });
  }
  var api = { mipSolve: mipSolve };
  Object.defineProperty(api, "ready", { enumerable: true, get: start });
  window.PRX_SOLVER = api;
})();
`;

let browser = (await transform(BROWSER_ENTRY, { loader: "js", minify: true, target: "es2020", legalComments: "none" })).code;
browser = inject(browser, "@@WORKER_SRC@@", workerSrc);
browser = inject(browser, "@@WASM_B64@@", wasmB64);
browser = notice("browser, blob-URL Worker") + browser;

// ---------------------------------------------------------------------------------------------------------
// Node bundle: ES module, highs in-process (top-level await), synchronous mipSolve after import.

const NODE_ENTRY = `
import loadHighs from "highs";
import { createMipSolver } from "./mip.ts";
export const HIGHS_VERSION = ${JSON.stringify(HIGHS_VERSION)};
const WASM_B64 = "@@WASM_B64@@";
const bytes = Uint8Array.from(Buffer.from(WASM_B64, "base64"));
const highs = await new Promise((resolve, reject) => {
  loadHighs({
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(bytes, imports).then((r) => done(r.instance), reject);
      return {};
    },
  }).then(resolve, reject);
});
const solver = createMipSolver(highs);
/** Optimal report over the unrestricted family; returns the result directly (await also works). */
export function mipSolve(E, options) {
  return solver.solve(E, options);
}
/** Resolves once highs is loaded (it already is when the import has finished). */
export const ready = Promise.resolve({ highs: HIGHS_VERSION });
`;

let node = (
  await build({
    ...common,
    stdin: { contents: NODE_ENTRY, resolveDir: src, sourcefile: "solver-node.entry.js", loader: "js" },
    format: "esm",
    platform: "node",
    target: "node20",
  })
).outputFiles[0].text;
node = inject(node, "@@WASM_B64@@", wasmB64);
node = notice("Node, in-process") + node;

fs.mkdirSync(out, { recursive: true });
for (const [name, code] of [
  ["solver.js", browser],
  ["solver-node.mjs", node],
]) {
  fs.writeFileSync(path.join(out, name), code);
  console.log(`solver ${name.padEnd(26)} ${String(Buffer.byteLength(code)).padStart(9)} bytes`);
}
