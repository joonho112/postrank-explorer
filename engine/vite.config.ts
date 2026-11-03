import { defineConfig } from "vite";

// pr-core is a library, not an app: one entry, two formats (CONTRACT.md 7.1).
//   ../js/pr-core.js      ES module (pages, widget modules, node checks)
//   ../js/pr-core.umd.js  UMD, global `prCore` (classic <script>, works from file://)
// emptyOutDir stays false: ../js also holds widgets/, bundles/ and vendor/.
// scripts/clean-outputs.mjs removes only the pr-core files before each build.
export default defineConfig({
  logLevel: "info",
  build: {
    outDir: "../js",
    emptyOutDir: false,
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: true,
    lib: {
      entry: "src/index.ts",
      name: "prCore",
      formats: ["es", "umd"],
      fileName: (format) => (format === "es" ? "pr-core.js" : "pr-core.umd.js"),
    },
  },
});
