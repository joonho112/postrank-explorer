import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as src from "../src/index.ts";
// @ts-expect-error plain .mjs module without declarations
import { freshnessSelfTest } from "../scripts/freshness.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const js = path.join(root, "js");

test("PR_CORE_VERSION equals the engine package version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
  assert.equal(src.PR_CORE_VERSION, pkg.version);
});

test("the toolchain is pinned to exact versions", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
  assert.deepEqual(pkg.devDependencies, { esbuild: "0.25.12", typescript: "5.9.3", vite: "6.4.5" });
  const lock = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/vite"].version, "6.4.5");
  assert.equal(lock.packages["node_modules/typescript"].version, "5.9.3");
  assert.equal(lock.packages["node_modules/esbuild"].version, "0.25.12");
});

test("built ES module and UMD global prCore expose the same API as src/index.ts", async () => {
  const names = Object.keys(src).sort();
  const es = await import(path.join(js, "pr-core.js"));
  assert.deepEqual(Object.keys(es).sort(), names);
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(js, "pr-core.umd.js"), "utf8"), sandbox);
  const umd = sandbox.prCore as Record<string, unknown>;
  assert.deepEqual(Object.keys(umd).sort(), names);
  // the built code computes what the source computes
  assert.equal((umd.normalSf as (z: number) => number)(30), src.normalSf(30));
  assert.equal((es.formatProb as (x: number) => string)(0.1875), src.formatProb(0.1875));
  assert.deepEqual(Array.from((umd.normals as (s: number, n: number) => Float64Array)(7, 5)), Array.from(src.normals(7, 5)));
  assert.ok(fs.existsSync(path.join(js, "pr-core.d.ts")));
  assert.match(fs.readFileSync(path.join(js, "types", "index.d.ts"), "utf8"), /normalQuantile/);
});

test("freshness check self-test: every injected fault is caught", () => {
  const result = freshnessSelfTest(root);
  assert.ok(result.ok, result.lines.join("\n"));
  assert.equal(result.caught, result.total);
});
