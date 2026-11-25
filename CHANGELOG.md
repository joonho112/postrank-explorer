# Changelog

All notable changes to **postrank Explorer** are documented in this file.

## 3.6.0 — 2026-11-24

### Visual Frame and Application Architecture
- Upgraded all 79 common-grade, reporting-rule, multi-criteria, case, and tool applications (`1.1–1.18`, `2.1–2.20`, `3.1–3.13`, `4.1–4.14`, `5.1–5.12`, `T.1–T.2`) to **Frame v2** (`frame: "v2"` in `js/shared/base.js`), placing primary controls, a concise 1–2 sentence headline readout, and the primary changing graphic on the first screen across desktop (`1280 × 800`) and mobile (`375 × 812`) viewports.
- Refined the shared multidomain profile shell (`P.1–P.5`, `js/shared/mdomain/visual.js`) with a compact header and responsive 2-row preset wrap on narrow screens (`controlToReadoutPx <= 60 px`).
- Introduced structured progressive disclosures (`Settings`, `Data`, `Method`) so exhaustive candidate tables, diagnostics, and secondary parameters stay one click away (`?open=settings,data,method`) without crowding the primary view.
- Extracted 29 shared modules containing domain routines and, in many cases, rendering code under `js/shared/domain/` and shared UI primitives (`js/shared/readout.js`, `js/shared/table.js`, `js/shared/cards.js`), eliminating all 65 application-to-application module imports (`0` `app -> app` imports).

### Typography, Direct Labeling, and Number Formatting
- Standardized continuous headline and graphic numbers to 3 significant digits (`js/shared/format.js`) with automatic distinguishing-digit expansion (`formatDistinguishing`) whenever two compared values collide at 3 significant figures, while retaining full exact precision in `Data` disclosures and `[data-num]` attributes.
- Standardized chart labels to `13 px` (`14 px` in `P.1–P.5`) with an enforced `12 px` minimum rendered SVG floor, collision-free direct mark labels (`placeDirectLabels` and `svgScene` in `js/shared/chart.js`), WCAG AA contrast across light and dark themes, and zero upward keyboard Tab jumps.

### Site Shell, Cross-References, Embeds, and Performance
- Redesigned the home page (`index.qmd`), seven collection overview pages (`pages/*/index.qmd`), full-width filterable catalog (`catalog.qmd`), and sticky symbol-indexed terminology reference (`pages/words.qmd`), preserving the six fixed content categories (`Uncertainty`, `Grade reports`, `Reporting rules`, `Multiple criteria`, `Cases`, `Tools`) and all 84 application IDs and routes.
- Updated 37 applications and 161 cross-references across `catalog/entries/*.json` and `pages/*/*.qmd` to match the public **postrank Theory Book (`v5`)** chapter numbers and section titles.
- Added standalone slide-embedding controls (`?hide=chrome` or `?hide=title,caption,presets,disclosures` while always keeping required data credit notices visible; `notes/embed-guide.md`), descriptive card links (`Open standalone`, `Open full page`), forced-light `640 × 360` primary-stage thumbnails (`scripts/thumbs.mjs`), and Open Graph metadata (`scripts/site-assets.mjs`).
- Added a per-application mini-catalog esbuild plugin (`engine/scripts/build-bundles.mjs`), cutting total bundle weight across the 84 applications from `30.25 MB` to `20.36 MB` (`−32.7%`; gzip `10.33 MB` to `7.89 MB`) while preserving `file://` standalone execution and on-demand HiGHS solver loading.

### Verification
- Added `verification/run_gate.sh` (`fast`, `standard`, `full`), `verification/check_code_policy.mjs` (plus `tsconfig.shared.json` `checkJs`), `verification/check_displayed_numbers.mjs`, `verification/check_visual_contract.mjs`, and `verification/check_xref.mjs` alongside the existing 24,659 R parity checks and `postrank 1.2.0` release gate.

## 3.5.0

- Bound runtime verification and downloadable R recipes to **postrank 1.2.0** while preserving historical `postrank 1.1.0` and base-R reference provenance.
- Added five exact-rational multidomain profile applications (`P.1–P.5`: `profile-common-vs-domain`, `profile-separability`, `profile-dependence`, `profile-resolution`, and `fictional-site-profiles`) under **Multiple criteria** (`pages/profiles/`).
- Restored the six content-category navigation dropdowns (`Uncertainty`, `Grade reports`, `Reporting rules`, `Multiple criteria`, `Cases`, `Tools`) with `Common grades` and `Domain profiles` sub-sections under `Multiple criteria`.
