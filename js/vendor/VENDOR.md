# Vendored libraries

Loaded as classic `<script>` files so every page works from `file://` with no network (CONTRACT 2.4, 8.7).
Load order: `d3.min.js`, then `plot.min.js` (Plot's UMD build reads the global `d3`), then `temml/temml.min.js`.
Copied from the pinned npm packages in `tools/package.json` by `node tools/vendor.mjs`; never fetched from a CDN.

| File | Package | Version | Source | sha256 | Licence |
|---|---|---|---|---|---|
| `d3.min.js` | `d3` | 7.9.0 | `d3/dist/d3.min.js` | `f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539` | ISC |
| `plot.min.js` | `@observablehq/plot` | 0.6.17 | `@observablehq/plot/dist/plot.umd.min.js` | `4358086467740777dd788d6b27a95cebdbaefdd50c730a3060117073bd7134cb` | ISC |
| `temml/temml.min.js` | `temml` | 0.14.0 | `temml/dist/temml.min.js` | `56b4338176d39170692503b8b7ec630d3edf8e10861895658deb74aefb66af9d` | MIT |
| `temml/temml.cjs` | `temml` | 0.14.0 | `temml/dist/temml.cjs` | `e251fc7715b05c8b9c71f97834d4cae08e172c8734f3504f6ca1139cc59ff15e` | MIT |
| `temml/Temml-Local.css` | `temml` | 0.14.0 | `temml/dist/Temml-Local.css` | `544f4e3fee4c36f4568e4f145fa626dc9573c5f4c96c523aadcc433c3989a239` | MIT |
| `temml/Temml.woff2` | `temml` | 0.14.0 | `temml/dist/Temml.woff2` | `fc70501355ae6d38ff0b80f825af153557d5f2f474198d6b9b7dd2d3a291a0cc` | MIT (distributed in the temml package; the package states no separate font licence) |
