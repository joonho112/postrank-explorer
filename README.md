# postrank Explorer v3

**Author:** JoonHo Lee ([jlee296@ua.edu](mailto:jlee296@ua.edu)), The University of Alabama.

postrank Explorer contains 79 applications on posterior ranking and ordered grade reporting. The collection
examines posterior uncertainty, pairwise directional decisions, reporting risk, common reporting rules and
multiple criteria. It includes empirical illustrations and two browser tools. Version `3.0.0-rc1` contains
88 explanatory pages and 79 standalone applications.

| Collection | Applications |
|---|---:|
| Ranking under uncertainty | 18 |
| From ranks to grades | 20 |
| Common rules | 13 |
| Several criteria | 14 |
| Cases | 12 |
| Tools | 2 |

## Open the website

The repository includes the built website in `docs/`. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open [the website](http://127.0.0.1:8000/), [the catalogue](http://127.0.0.1:8000/catalog.html),
[terminology and notation](http://127.0.0.1:8000/pages/words.html), or
[the tools](http://127.0.0.1:8000/pages/tools/index.html).

The Quarto website uses HTTP. Individual `embed/<name>.html` files and their copies in `docs/embed/` also
operate directly from a downloaded folder. Standalone applications accept settings such as `?tau=.4&cap=3`,
a `preset=<id>`, and `theme=light|dark`. The hosting folder for GitHub Pages is `/docs` on the `main` branch.
The included `.nojekyll` file preserves the static assets. Publishing is a separate repository setting.

## Build

The build uses Node 25.8.1 or later, npm and Quarto. Dependencies are pinned in the two package lockfiles.

```sh
npm ci --prefix engine
npm ci --prefix tools
npm run build --prefix engine
node scripts/build.mjs
quarto render
```

The engine is written in TypeScript. The site generator builds application bundles, the runtime catalogue,
standalone HTML, cards and navigation. Quarto renders the website into `docs/`; its post-render steps typeset
mathematics and retain only the icon definitions referenced by the site. Browser libraries and the optional
solver are served locally. They require no external content service during normal use.

Website titles and descriptions are in `catalog/site-copy.json`. Runtime metadata and presets are in
`catalog/entries/`. Explanatory text is maintained in the corresponding `pages/` QMD files. The
[numerical engine API](engine/API.md) and [engine documentation](engine/README.md) describe the calculations.

## Verification and reproduction

The full suite also executes exported R scripts. It requires R, postrank 1.1.0 and jsonlite in a declared R library.
After dependency installation:

```sh
POSTRANK_LIB=/path/to/R/library bash verification/run_all.sh
```

Without the R replay dependencies, the numerical JavaScript checks can be run separately:

```sh
npm test --prefix engine
node verification/run_parity.mjs
node verification/check_data_contract.mjs
node verification/check_links.mjs
node verification/check_pages.mjs
node verification/check_try.mjs
```

The checks cover numerical parity against the included frozen reference values, unit tests, data contracts,
visible numerical results, page lengths, links, browser interactions and the optional solver. Browser checks
use system Chrome; set `PRX_CHROME` to its executable path where necessary. Canonical test fixtures are included;
local execution reports, screenshots, development notes and working histories are excluded.

The frozen numerical reference values were calculated using postrank 1.1.0 and independent base-R code.
Numerical parity reads these values without requiring an installed R package; the separate R replay tests use
the declared package installation. Checksum manifests are included. The source data arrays and reference values retain the values used in the working version.

The [R reproduction scripts](r-export/) document how the reference values and released summaries are calculated.
Re-running these scripts is optional and requires R, postrank 1.1.0 and the documented R dependencies.
`POSTRANK_LIB` specifies the R library; `POSTRANK_SRC` specifies a checkout of the public package source.
The scripts write their documented outputs, so reproduction should use a separate checkout.
See [the reproduction guide](r-export/README.md).

## Inputs and interpretation

The local-input tool retains pasted records in component memory. Records are excluded from URLs, browser storage,
network uploads and the iframe interface. Local downloads retain the applied input and analysis settings.
A local-input URL therefore requires the records again after reload.

Every result is conditional on its stated posterior, target orientation, loss and report family. Marginal
intervals do not determine joint correctness. A shared grade withholds a comparison and does not establish
equality. Historical case outcomes do not describe current conditions or identify causal effects.

## Repository contents

| Path | Contents |
|---|---|
| `catalog/`, `js/apps/`, `pages/` | Application metadata, modules and explanatory pages |
| `js/shared/`, `styles/` | Interface components, formatting and visual styles |
| `engine/`, `js/pr-core.*` | Numerical engine source, declarations and builds |
| `data/released/`, `data/precomputed/` | Publicly scoped empirical and synthetic inputs |
| `embed/`, `js/bundles/`, `docs/` | Standalone applications and the built website |
| `verification/`, `r-export/` | Tests, canonical reference values and reproduction code |
| `notes/data-rights.md` | Source-specific data conditions and attribution |

## Citation and rights

The sole project author is **JoonHo Lee ([jlee296@ua.edu](mailto:jlee296@ua.edu))**.
Citation metadata are supplied in [CITATION.cff](CITATION.cff).
Original project code is licensed under [MIT](LICENSE). Original text and figures are licensed under
[CC BY 4.0](LICENSE-DATA), subject to source-specific exceptions. The data contract records each asset's
`license_scope`; public availability does not replace those conditions. Third-party software and source data
retain their original authorship and notices. See [data rights](notes/data-rights.md),
[the vendor record](js/vendor/VENDOR.md) and adjacent library licences.

## Acknowledgements

The research underlying this website was supported primarily by the National Academy of Education and the Spencer Foundation through the 2025 National Academy of Education/Spencer Postdoctoral Fellowship awarded to JoonHo Lee. Additional support was provided by the Institute of Education Sciences, U.S. Department of Education, through Grant R305D240078 to The University of Alabama.
