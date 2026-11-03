# R reproduction scripts

Author: JoonHo Lee (jlee296@ua.edu).

These scripts reproduce the numerical reference values and released summaries used by postrank Explorer v3.
They use postrank 1.1.0 or independent base-R calculations. Normal parity checks read the included frozen values;
regeneration is a separate operation and may overwrite outputs.

R scripts that write golden values (`verification/golden/<group>.json` + `manifest.d/<group>.json`) and released
summaries (`data/released/`). Run from the repository root with the project library:

    Rscript r-export/00_selftest.R

- `_paths.R`: repository paths; `POSTRANK_LIB` (default `.R-library`, postrank 1.1.0 installed from the public source)
  and `POSTRANK_SRC` (default `../postrank-R-package-public`, read-only). `load_postrank()` refuses any other version.
- `_helpers.R`: stable JSON/CSV writers, SHA-256, `write_golden()` (one manifest fragment per golden file).
- `_oracle.R`: rules and small helpers for base-R oracle code that never loads postrank.
- Re-running a script must give identical files apart from the `created` field of manifest fragments
  (`node verification/compare_rerun.mjs <dirA> <dirB>`).

Install postrank 1.1.0 into the project library (TMPDIR without spaces; the source is copied first):

    rsync -a --exclude .git ../postrank-R-package-public/ /tmp-no-spaces/postrank/
    TMPDIR=/tmp-no-spaces/tmp R CMD INSTALL --no-test-load --library=.R-library /tmp-no-spaces/postrank

## Scripts

| Script | Writes |
|---|---|
| `00_selftest.R` | self-test golden groups |
| `01_special.R` … `14_summaries.R` | golden groups for engine parity (`verification/golden/`) |
| `15_part2.R` | shared base-R inputs for the Part 2 rows (six-site, 30-site, KRW Example 1, theory-book laws); sourced by `02`–`14`, never loads postrank |
| `16_part3.R` | Step 7.1 Part 3 helpers (`statedAgainst`, `relationChange`, `cutGrade`, `bestReports`, `reportsAtN`, `ruleGap`): `oracle-part3` (base R; sources `15_part2.R`) and `postrank-part3` (`postrank_compare()$relations` and archived optima of cached analyses, no solve) |
| `17_v3_helpers.R` | v3 Step 2.3: the v3 helpers of `engine/API.md` (16 functions and case weights in `disclosedErrorEstimands`): `oracle-v3` (base R; sources `15_part2.R`; the seeded functions through `_rng.R`) |
| `18_v3_part1.R` | v3 Step 3.27: the Part 1 supplement of `engine/API.md` (ten functions with throw rows, the extensions `disclosure` withheld, `leastCertainPairs` apart, `intervalOverlapTally` amount/nested, `majorityWins` cycleTriples and `formatProb` open, and the read-out pins of existing functions at the Part 1 apps' settings): `oracle-v3p1` (base R; sources `15_part2.R`; the seeded rows through `_rng.R`) |
| `20_export_teaching.R` | teaching data and package cached analyses (`data/released/`), the frozen league (`data/precomputed/league-30.json`), `data/released/data_contract.json` |
| `21_export_cases.R` | the three cases, the KRW λ grid and the Alabama county boundaries (`data/released/`) |

`18_v3_part1.R`: every row carries `record.kind` (example, case, edge, throw, pin) and `record.needs` ("existing": the
current engine has the function and every compared field; "step-3.27": a new function, option or field); the readings
where the specification leaves a choice are R1–R16 in the script's header. R's own number parser is not correctly
rounded on builds where long double is double (aarch64 macOS): `0.19999999999999998` parses to 0.2, and
`as.numeric(sprintf("%.15g", x))` moves about one value in five below 1e-20 by an ulp (two released six-site errors,
9.25287068693378e-10, among them), so the script reads every released number and every 15-digit rounding through
jsonlite and writes no 16- or 17-digit literal. In a worktree, set `POSTRANK_SRC` to the public postrank source (the
default `../postrank-R-package-public` is resolved from the worktree root); the script itself never loads postrank.

Environment variables for the exports: `KRW_COMPANION_DUMP` (default `../KRW-2024-companion-public/dump`) and
`PRX_REFREEZE_LEAGUE=1` (only to regenerate the frozen league on purpose; otherwise a changed league stops the script).
`20_export_teaching.R` also serves as a library for `21` (`prx_export_lib_only <- TRUE`).

| Script | Writes |
|---|---|
| `22_case_registry.R` | the case registry `data/numbers-cases.json` (summary-route case values) and the `registry` section of the data contract |
| `23_cde_taupath.R` | the CDE τ path solved with postrank's HiGHS (`data/released/cde-taupath.json`), a cross-check of the browser enumeration |
| `24_export_toy_mcmc.R` | `pr_toy_mcmc`'s chain states and vignette m6's `postrank_diagnose()` summary for app 1.18 (`data/released/toy-mcmc.json`; posterior computes R-hat, ESS and the MCMC MCSE) |

Order: run 22 after `scripts/build_numbers.mjs` so that the contract records the sha256 of `data/numbers.json`.
