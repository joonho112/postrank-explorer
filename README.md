# postrank Explorer v3.6

**Author:** JoonHo Lee ([jlee296@ua.edu](mailto:jlee296@ua.edu)), The University of Alabama.

postrank Explorer uses interactive examples to show how uncertainty affects rankings and grade reports.
Version 3.6.0 uses **postrank 1.2.0** as its R reference, upgrades all 84 applications to a unified visual-first frame, aligns cross-references to the public **postrank Theory Book (v5)**, and includes five exact-rational applications on multidomain profiles.
The site has 84 applications, 94 pages, and a standalone version of every application.

| Collection | Applications |
|---|---:|
| Ranking under uncertainty | 18 |
| From ranks to grades | 20 |
| Common rules | 13 |
| Several criteria | 14 |
| Multidomain profiles | 5 |
| Cases | 12 |
| Tools | 2 |

## Common grades and multidomain profiles

A **common-grade report** (P1) assigns one grade per unit and evaluates that same column across one or several
criteria. A **multidomain profile** (P2) retains a separate grade column for each domain. Grade 1 denotes higher
reported priority within its own domain. Equal grades withhold a direction; they do not assert equal latent
targets. Profiles such as `(1,2)` and `(2,1)` convey crossed priorities without defining an overall ranking.

The six main sections are Uncertainty, Grade reports, Reporting rules, Multiple criteria, Cases, and Tools.
[Multiple criteria](pages/criteria/index.qmd) links to common-grade and domain-profile reports. The
[Domain profiles collection](pages/profiles/index.qmd) contains five visual applications, each with one main
control, a graphic, and a short result. Settings and Data open separately.

- [P.1 — Common or profile?](pages/profiles/profile-common-vs-domain.qmd) compares shared and separate grades
  under the same posterior, loss, and error limit.
- [P.2 — Separate or joint?](pages/profiles/profile-separability.qmd) shows when choosing each domain separately
  minimizes loss and when a joint limit changes the best combination.
- [P.3 — Error overlap](pages/profiles/profile-dependence.qmd) holds the domain posteriors fixed and changes how
  often their errors occur together.
- [P.4 — Budget and grades](pages/profiles/profile-resolution.qmd) shows how a higher error limit can shift detail
  between domains even as minimum risk falls.
- [P.5 — Site profiles](pages/profiles/fictional-site-profiles.qmd) uses saved results for forty fictional sites.
  Each point represents a site in the cell given by its two grades.

When expected loss is additive and the feasible family contains every combination of its eligible domain columns,
choosing a minimum-loss column in each domain gives a minimum-loss profile. This result also holds for dependent
domains. A limit on the probability of exceeding an error threshold in any domain can rule out combinations and
change the choice. The examples identify the candidates searched and show every tied report.

## Open the website

The project website is available on [GitHub Pages](https://joonho112.github.io/postrank-explorer/).

The repository includes the built website in `docs/`. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open [the website](http://127.0.0.1:8000/), [the catalog](http://127.0.0.1:8000/catalog.html),
[terminology and notation](http://127.0.0.1:8000/pages/words.html), or
[Multidomain profiles](http://127.0.0.1:8000/pages/profiles/index.html).

The Quarto website uses HTTP. Individual `embed/<name>.html` files and their copies in `docs/embed/` also
operate directly from a downloaded folder. Standalone applications accept `preset=<id>`, declared settings,
`theme=light|dark|system`, `open=settings,data,method`, and `hide=chrome` (or a comma-separated subset of
`title,caption,presets,disclosures`; data credit and license notices remain visible). See the
[embed guide](notes/embed-guide.md) for slide and handout usage. Profile controls use integer indices mapped to
exact rational policies. The GitHub Pages hosting folder is `/docs` on `main`; `.nojekyll` preserves its static assets.

## Build

The build uses Node 25.8.1 or later, npm and Quarto. Dependencies are pinned in the two package lockfiles.

```sh
npm ci --prefix engine
npm ci --prefix tools
npm run build --prefix engine
node scripts/build.mjs
node scripts/thumbs.mjs
quarto render
```

The TypeScript engine is bundled for browser use; it does not invoke an R session in the browser. The generator
writes per-app bundles (slicing `catalog.json` to each application's own entry), catalog data, standalone HTML,
cards and navigation. `scripts/thumbs.mjs` renders forced-light `640 × 360` primary-stage thumbnails into
`media/thumbs/`. Quarto renders the site into `docs/`; post-render steps typeset mathematics, inject canonical
and Open Graph metadata (`scripts/site-assets.mjs`), and retain the referenced icon definitions. Browser libraries,
fonts and the optional solver are served locally, with no external content service required during normal use.

Website titles and descriptions are in `catalog/site-copy.json`; runtime metadata and complete presets are in
`catalog/entries/`. Explanatory text is in the corresponding `pages/` QMD files. See the
[numerical engine API](engine/API.md), [multidomain contract](engine/MDOMAIN-API.md),
[engine documentation](engine/README.md), [embed guide](notes/embed-guide.md),
and [changelog](CHANGELOG.md).

## Verification and reproduction

The three-tier verification runner (`fast`, `standard`, `full`) wraps the release gate and visual/numerical contracts.
With `postrank` **1.2.0**, `gmp` and `jsonlite` in a declared R library, run:

```sh
POSTRANK_LIB=/path/to/R/library bash verification/run_gate.sh full
```

`POSTRANK_LIB=/path/to/R/library bash verification/run_v35.sh` runs the 18-stage release gate directly, and
`verification/run_all.sh` remains available for the underlying collection checks. Browser tests
use system Chrome; set `PRX_CHROME` to its executable path where necessary. Individual checks can also
run separately after building:

```sh
npm test --prefix engine
node verification/check_code_policy.mjs
node verification/run_parity.mjs
node verification/check_displayed_numbers.mjs
node verification/check_visual_contract.mjs
node verification/check_xref.mjs
node verification/check_data_contract.mjs
node verification/check_links.mjs
node verification/check_pages.mjs
node verification/check_try.mjs
```

The checks compare numerical results, candidate tables, and tied reports with saved references. They also verify
data licenses, displayed values, links, browser interactions, and the optional solver. The reference files record
the software and inputs used to produce their values.

Historical common-grade golden values retain their **postrank 1.1.0** or independent base-R origin and unchanged
checksums. The new multidomain finite-law references use public **postrank 1.2.0** APIs. Numerical parity reads the
frozen values without loading R; current compatibility and recipe replays use a declared installed version.
Updating the current reference package does not relabel the historical calculations as 1.2.0 outputs.

[R reproduction scripts](r-export/) identify what each exporter writes. The historical exporters retain their
1.1.0 requirement; regenerating their records needs the matching archived package and a separate R process.
The [v3.5 exporters](r-export/v35/README.md) and downloadable profile recipes require 1.2.0 in a fresh process.
`POSTRANK_LIB` selects the library and `POSTRANK_SRC` the matching read-only source checkout where required.
Regeneration writes documented outputs and should use a separate checkout; it is not an ordinary website build.

## Inputs and interpretation

The local-input tool retains pasted records in component memory. Records are excluded from URLs, browser storage,
network uploads and the iframe interface. Local downloads retain the input and settings. A local-input URL
therefore requires those records again after reload.

The live P2 teaching engine accepts complete finite laws with 2–4 units, 1–2 domains, 1–8 states, at most 256 raw
columns per domain and at most 256 canonical product cards. The live profile applications use two domains;
one-domain cases verify reduction. Oversized requests are rejected before enumeration. These bounds describe
the browser subset, not the R package. All scientific policy comparisons and ties use exact rational arithmetic;
rounded decimals and plotting coordinates are presentation values.

The forty-site application counts sites by profile and compares pairs using saved grades. It shows separate
summaries for the draws used to choose grades and the draws used to check them afterward. Repeating the search
under a different policy would require the original joint draws. The saved fractions describe the draws used.
The two sets of draws came from the same chain, so the check does not provide independent validation.

Every result is conditional on its stated law, target orientation, loss, constraints and report family. Historical
case outcomes do not describe current conditions or identify causal effects. The R package supplies additional
input and assessment routes beyond this bounded browser teaching implementation.

## Repository contents

| Path | Contents |
|---|---|
| `catalog/`, `js/apps/`, `pages/` | Application metadata, modules and explanatory pages |
| `js/shared/`, `js/shared/domain/`, `styles/` | Frame v2 components, shared calculations and application renderers, exact display support and visual styles |
| `engine/`, `js/pr-core.*` | Numerical source, contracts, declarations and builds |
| `data/released/`, `data/precomputed/` | Scoped empirical and synthetic inputs; frozen fictional profile displays |
| `embed/`, `js/bundles/`, `media/thumbs/`, `docs/` | Standalone applications, bundles, light-mode thumbnails and the built website |
| `verification/`, `r-export/` | Three-tier gate, visual/number contracts, canonical references and reproduction code |
| `notes/data-rights.md`, `notes/embed-guide.md`, `CHANGELOG.md` | Data conditions, standalone/slide embedding guide and release history |

## Citation and rights

The sole project author is **JoonHo Lee ([jlee296@ua.edu](mailto:jlee296@ua.edu))**.
Citation metadata are supplied in [CITATION.cff](CITATION.cff).
Original project code is licensed under [MIT](LICENSE). Original text and figures are licensed under
[CC BY 4.0](LICENSE-DATA), subject to source-specific exceptions. The data contract records each asset's
`license_scope`; public availability does not replace those conditions. Third-party software and source data
retain their original authorship and notices. See [data rights](notes/data-rights.md),
[the vendor record](js/vendor/VENDOR.md) and adjacent library licenses.

## Acknowledgments

The research underlying this website was supported primarily by the National Academy of Education and the Spencer Foundation through the 2025 National Academy of Education/Spencer Postdoctoral Fellowship awarded to JoonHo Lee. Additional support was provided by the Institute of Education Sciences, U.S. Department of Education, through Grant R305D240078 to The University of Alabama.
