# Author: JoonHo Lee (jlee296@ua.edu)
# The case half of the number registry (CONTRACT 5.1): data/numbers-cases.json, every summary-route key of the
# storyboards' registry tables (engine/API.md D, part3-5.md B), read from the released summaries and the
# cached analyses they carry. Engine (browser-route) keys are computed by scripts/build_numbers.mjs into data/numbers.json.
#   Rscript r-export/22_case_registry.R          (after 20, 21 and 23; rerun after scripts/build_numbers.mjs to refresh the
#                                                 contract's record of data/numbers.json)
# Each entry: { type, value, display, tolerance, settings, source, license_scope, owner } (numbers/schema.json $defs/entry).
#   value      exactly as written to the released file (15 significant digits);
#   display    made by the engine's own formatter (js/pr-core.js through formatWith() of scripts/build_numbers.mjs, run by
#              node on the stored values), so a display here and a display in data/numbers.json follow one rule set; a
#              sample is also re-made in base R (sprintf rounds the binary value with ties to even, as the engine does);
#   tolerance  the gap allowed between the value and an independent recomputation: 0 for counts and grade sizes, 1e-12
#              for a quantity the engine recomputes from the released arrays, 1e-8 for solver outputs (bounds, gaps,
#              optimum-based costs; the package's absolute risk gap), relative 1e-5 for KRW's archive metrics (KRW's
#              archived pair probabilities differ slightly from the released ones);
#   settings   setting name -> settings.* key (numbers/spec/settings.json) or a literal descriptor;
#   source     the released file, the object it came from, the field (dot path), the row, the file's sha256, the
#              display formatter and a note.
# Checks: every documented case number (Step 3.5 list and the storyboards' expected displays); an engine recomputation
# on the released arrays for every key that has one (table printed); keys unique against data/numbers.json; the written
# file passes checkFile() of verification/check_numbers.mjs.
# The data contract (data/released/data_contract.json) lists both registry files in its `registry` section
# (prx_write_registry_section(), also called by 23_cde_taupath.R). update_contract() of 20_export_teaching.R rewrites
# the contract without that section, so rerun this script after 20 or 21.
if (!exists("update_contract", mode = "function")) {
  prx_export_lib_only <- TRUE
  source("r-export/20_export_teaching.R")
  rm(prx_export_lib_only)
}
REGISTRY_FILES <- list(
  `numbers-cases.json` = list(key = "numbers-cases", path = "data/numbers-cases.json", title = "Number registry: case values",
                              writer = "r-export/22_case_registry.R"),
  `numbers.json` = list(key = "numbers", path = "data/numbers.json", title = "Number registry: engine values",
                        writer = "scripts/build_numbers.mjs"))

# ---- the contract's registry section --------------------------------------------------------------------------------
prx_registry_entries <- function() {
  out <- list()
  for (nm in sort(names(REGISTRY_FILES), method = "radix")) {
    f <- REGISTRY_FILES[[nm]]; p <- file.path(prx_root, f$path); present <- file.exists(p)
    e <- list(key = f$key, path = f$path, title = f$title, writer = f$writer, schema = "numbers/schema.json#/$defs/numbersFile",
              license_scope = "mixed",
              scope_note = "Each entry carries its own license_scope (one of the five scopes above); mixed is not a licence.",
              present = present, keys = NA, scopes = NA, sha256 = NA, bytes = NA,
              check = paste0("sha256, bytes and keys describe the file when this entry was written; they are compared only when ",
                             "the file is present. ", if (identical(nm, "numbers.json")) "The file is written by scripts/build_numbers.mjs; rerun r-export/22_case_registry.R after rebuilding it."
                             else "Rewritten by every run of r-export/22_case_registry.R."))
    if (present) {
      j <- jsonlite::fromJSON(p, simplifyVector = FALSE)
      e$keys <- length(j)
      if (length(j)) {
        sc <- vapply(j, function(x) x$license_scope %||% "missing", "")
        tab <- table(sc); nm_sc <- sort(names(tab), method = "radix")
        e$scopes <- as.list(setNames(as.integer(tab[nm_sc]), nm_sc))
      }
      e$sha256 <- sha256_file(p); e$bytes <- file.size(p)
    }
    out[[nm]] <- e
  }
  out
}
# Rewrites data_contract.json (+ twin) with the registry section; everything else is kept as written by update_contract().
prx_write_registry_section <- function() {
  path <- file.path(released_dir, "data_contract.json")
  body <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  body$created <- NULL
  body$registry <- prx_registry_entries()
  full <- c(list(created = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")), body)
  writeLines(as.character(jsonlite::toJSON(full, auto_unbox = TRUE, digits = NA, na = "null", null = "null", pretty = TRUE)), path, useBytes = TRUE)
  writeLines(twin_text("data-contract", json_text(body)), sub("\\.json$", ".js", path), useBytes = TRUE)
  r <- body$registry
  cat(sprintf("  contract registry section: %s\n", paste(vapply(names(r), function(nm) sprintf("%s (%s)", nm,
      if (isTRUE(r[[nm]]$present)) sprintf("%d keys", r[[nm]]$keys) else "not present"), ""), collapse = ", ")))
  invisible(path)
}

# The engine's formatters and evaluateReport, run by node on the stored values (one call).
NODE_SCRIPT <- '
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [root, inPath, outPath] = process.argv.slice(2);
const pc = await import(pathToFileURL(join(root, "js/pr-core.js")).href);
const { formatWith } = await import(pathToFileURL(join(root, "scripts/build_numbers.mjs")).href);
const job = JSON.parse(readFileSync(inPath, "utf8"));
const out = { display: {}, evaluate: {}, sizes: {}, problems: [] };
if (job.mode === "prepare") {
  for (const d of job.displays) out.display[d.key] = d.type === "text" ? d.value : formatWith(pc, d.format, d.value);
  const files = new Map();
  const at = (file, path) => {
    if (!files.has(file)) files.set(file, JSON.parse(readFileSync(join(root, file), "utf8")));
    return path.split(".").reduce((o, k) => o[k], files.get(file));
  };
  for (const t of job.evaluate) {
    let E = at(t.file, t.path);
    if (t.criteria) E = { ids: E.ids, criteria: t.criteria.map((k) => E.criteria[k]), e: t.criteria.map((k) => E.e[k]) };
    const r = pc.evaluateReport(t.grade, E, { tau: t.tau, w: t.w });
    out.evaluate[t.id] = { N: r.N, s: r.s, G: r.G, E: r.E, EoverN: r.EoverN, EoverM: r.EoverM, Rk: r.Rk, risk: r.risk };
  }
  for (const t of job.disclosure) out.sizes[t.id] = Array.from(pc.disclosure(t.grade).sizes);
} else {
  const { checkFile } = await import(pathToFileURL(join(root, "verification/check_numbers.mjs")).href);
  const { createRegistry } = await import(pathToFileURL(join(root, "scripts/registry.mjs")).href);
  const cases = JSON.parse(readFileSync(join(root, "data/numbers-cases.json"), "utf8"));
  out.problems.push(...checkFile(cases, "data/numbers-cases.json"));
  const np = join(root, "data/numbers.json");
  const numbers = existsSync(np) ? JSON.parse(readFileSync(np, "utf8")) : {};
  try { createRegistry(numbers, cases); } catch (e) { out.problems.push(e.message); }
  out.size = Object.keys(cases).length;
}
writeFileSync(outPath, JSON.stringify(out));
'
run_node <- function(job) {
  dir <- tempfile("prx-registry-"); dir.create(dir); on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  script <- file.path(dir, "job.mjs"); inp <- file.path(dir, "in.json"); outp <- file.path(dir, "out.json")
  writeLines(NODE_SCRIPT, script)
  writeLines(json_text(job), inp, useBytes = TRUE)
  status <- system2("node", shQuote(c(script, prx_root, inp, outp)), stdout = "", stderr = "")
  if (!identical(status, 0L) || !file.exists(outp)) stop("node (js/pr-core.js) failed with status ", status, call. = FALSE)
  jsonlite::fromJSON(outp, simplifyVector = FALSE)
}

if (exists("prx_case_registry_lib_only") && isTRUE(prx_case_registry_lib_only)) {
  # library mode (sourced by 23_cde_taupath.R): definitions only
} else {
# =====================================================================================================================
cat("22_case_registry: data/numbers-cases.json\n")
OWNER <- "data/numbers-cases.json"
KEY_RE <- "^[a-z0-9][A-Za-z0-9_.]*$"
CDE <- "cde-source-conditions"; KRW <- "cc-by-nc-krw"; ATLAS <- "cc-by-4.0-atlas"; AUTHOR <- "author"
TOL_EXACT <- 0; TOL_ENGINE <- 1e-12; TOL_SOLVER <- 1e-8; TOL_KRW_ARCHIVE <- list(rel = 1e-5)

# released files and their hashes
rel_path <- function(k) sprintf("data/released/%s.json", k)
SHA <- list()
rd <- function(k) { SHA[[k]] <<- sha256_file(file.path(released_dir, paste0(k, ".json"))); read_released(k) }
cd <- rd("case-cde"); kd <- rd("case-krw"); gd <- rd("krw-lambda-grid"); ad <- rd("case-alabama"); c30 <- rd("cache-30x3")

# formatters (engine names and options; CONTRACT 5.1: displays come from the engine's format functions)
F_COUNT <- list(fn = "formatCount"); F_SIZES <- list(fn = "formatSizes"); F_SETTING <- list(fn = "formatSetting")
F_RISK <- function(d) list(fn = "formatRisk", options = list(digits = as.integer(d)))
F_PROB <- function(d) list(fn = "formatProb", options = list(digits = as.integer(d)))
F_EON <- function(d) list(fn = "formatEoverN", options = list(digits = as.integer(d)))
F_EON_SIG <- function(s) list(fn = "formatEoverN", options = list(sig = as.integer(s)))
F_SIG <- function(s) list(fn = "formatSig", options = list(sig = as.integer(s)))
F_SCI <- function(s) list(fn = "formatSci", options = list(sig = as.integer(s)))
F_DEC <- function(d) list(fn = "formatDecimal", options = list(digits = as.integer(d)))
F_TUPLE <- function(item) list(fn = "formatTuple", item = item)

# settings: setting name -> settings.* key or a literal descriptor; names in code-point order
sets <- function(...) { s <- list(...); if (!length(s)) return(setNames(list(), character(0))); s[sort(names(s), method = "radix")] }
S_NONE <- sets()
S_CDE <- sets(cap = "settings.cap3", family = "at most 3 grades", tau = "settings.tau20")
S_CDE_FIXED <- function(report) sets(report = report, tau = "settings.tau20")
KRW_CARD_FAMILY <- "KRW card computed by KRW's code under KRW's archived pair probabilities (KRW's solver tolerances)"
S_KRW_CARD <- function(crit) sets(criterion = crit, family = KRW_CARD_FAMILY, lambda = "settings.lambda25", tau = "settings.tau20")
S_KRW_GRID <- function(lam) sets(criterion = "race_signed", family = "KRW grid card computed by KRW's code under KRW's archived pair probabilities (KRW's solver tolerances)", lambda = lam)
S_KRW_COMMON <- sets(cap = "settings.cap4", family = "at most 4 grades", tau = "settings.tau25", w = "settings.w.equal2")
S_AL <- sets(cap = "settings.cap5", family = "at most 5 grades", tau = "settings.tau20", w = "settings.w.equal2")
S_AL_D <- function(report) sets(report = report, tau = "settings.tau20", w = "settings.w.equal2")
S_30 <- function(tau) sets(cap = "settings.cap4", family = "at most 4 grades", tau = tau, w = "settings.w.pov50")

entries <- list(); xc <- list()
add <- function(key, type, value, fmt, tol, settings, file, object, field, scope, row = NULL, note = NULL) {
  if (!grepl(KEY_RE, key) || any(strsplit(key, ".", fixed = TRUE)[[1]] == "") || grepl("\\.$", key)) stop("bad registry key ", key, call. = FALSE)
  if (!is.null(entries[[key]])) stop("registry key defined twice: ", key, call. = FALSE)
  if (type %in% c("scalar", "vector", "fraction", "set") && is.null(tol)) stop(key, ": tolerance missing", call. = FALSE)
  if (type == "vector") value <- I(unname(value)) else value <- unname(value)
  src <- list(file = rel_path(file), object = object, field = field)
  if (!is.null(row)) src$row <- row
  src$sha256 <- SHA[[file]]
  if (!is.null(fmt)) src$display_format <- fmt
  if (!is.null(note)) src$note <- note
  entries[[key]] <<- list(type = type, value = value, fmt = fmt, tolerance = tol, settings = settings, source = src, license_scope = scope)
  invisible(key)
}
# engine cross-checks: key -> (task, field, index) or a function of the task results
evals <- list(); discl <- list()
ev_task <- function(id, file, grade, tau, w, criteria = NULL, path = "arrays.error")
  evals[[id]] <<- list(id = id, file = rel_path(file), path = path, criteria = if (is.null(criteria)) NULL else I(as.integer(criteria)),
                       grade = I(as.integer(grade)), tau = tau, w = I(w))
check <- function(key, f) xc[[key]] <<- f

# ---- California chronic absence (case-cde) ------------------------------------------------------------------------------
c12 <- cd$analyses$case_cde_12; c12f <- c12$facts; c12p <- c12$tables$profile
add("cde.frame.n", "scalar", cd$facts$n, F_COUNT, TOL_EXACT, S_NONE, "case-cde", "pr_case_cde", "facts.n", CDE)
add("cde.frame.M", "scalar", cd$facts$M, F_COUNT, TOL_EXACT, S_NONE, "case-cde", "pr_case_cde", "facts.M", CDE)
add("cde.statewide.n", "scalar", cd$facts$statewide_schools, F_COUNT, TOL_EXACT, S_NONE, "case-cde", "pr_case_cde", "facts.statewide_schools", CDE,
    note = "pr_case_cde$reference$statewide$schools: the 5,834 eligible schools of the frozen source frame")
add("cde.statewide.M", "scalar", cd$facts$statewide_M, F_COUNT, TOL_EXACT, S_NONE, "case-cde", "pr_case_cde", "facts.statewide_M", CDE,
    note = "choose(statewide schools, 2)")
A12 <- "analyses.case_cde_12"
add("cde.cap3.tau20.sizes", "vector", as.integer(c12f$sizes), F_SIZES, TOL_EXACT, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.sizes"), CDE)
add("cde.cap3.tau20.N", "scalar", c12f$N, F_COUNT, TOL_EXACT, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.N"), CDE)
add("cde.cap3.tau20.E", "scalar", c12p$E[1], F_SIG(3), TOL_ENGINE, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".tables.profile.E"), CDE,
    row = list(criterion = "negative_chronic_absence"))
add("cde.cap3.tau20.EoverN", "scalar", c12p$E_over_N[1], F_EON_SIG(3), TOL_ENGINE, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".tables.profile.E_over_N"), CDE,
    row = list(criterion = "negative_chronic_absence"))
add("cde.cap3.tau20.risk", "scalar", c12f$risk, F_RISK(6), TOL_ENGINE, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.risk"), CDE)
add("cde.cap3.tau20.bound", "scalar", c12f$lower_bound, F_RISK(6), TOL_SOLVER, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.lower_bound"), CDE,
    note = "solver bound of the archived HiGHS solve (bound_source backend_reported_dual_bound)")
add("cde.cap3.tau20.gap", "scalar", c12f$gap, F_SCI(3), TOL_SOLVER, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.gap"), CDE,
    note = "risk minus bound of the archived HiGHS solve")
add("cde.cap3.tau20.status", "text", c12f$status, NULL, NULL, S_CDE, "case-cde", "case_cde_12", paste0(A12, ".facts.status"), CDE,
    note = "solver status of the archived solve; the result label is \"optimal within solver tolerances\"")
ev_task("cde12", "case-cde", c12$tables$units$grade, 0.2, 1)
discl[["cde12"]] <- list(id = "cde12", grade = I(as.integer(c12$tables$units$grade)))
check("cde.cap3.tau20.sizes", function(r) r$sizes$cde12); check("cde.cap3.tau20.N", function(r) r$evaluate$cde12$N)
check("cde.cap3.tau20.E", function(r) r$evaluate$cde12$E[[1]]); check("cde.cap3.tau20.EoverN", function(r) r$evaluate$cde12$EoverN[[1]])
check("cde.cap3.tau20.risk", function(r) r$evaluate$cde12$risk)

rm_cde <- cd$tables$report_metrics; it <- which(rm_cde$method == "observed_rate_tertiles"); iw <- which(rm_cde$method == "all_withheld")
stopifnot(identical(cd$tables$reports$observed_rate_tertiles, cd$tables$reports$posterior_mean_tertiles))
TERT_NOTE <- "pr_case_cde$reference$metrics; the posterior-mean tertile report in the same table is the same report"
S_TERT <- S_CDE_FIXED("observed-rate tertiles (a fixed report, not optimized)")
add("cde.tertiles.tau20.N", "scalar", rm_cde$N[it], F_COUNT, TOL_EXACT, S_TERT, "case-cde", "pr_case_cde", "tables.report_metrics.N", CDE,
    row = list(method = "observed_rate_tertiles"), note = TERT_NOTE)
add("cde.tertiles.tau20.E", "scalar", rm_cde$E[it], F_SIG(4), TOL_ENGINE, S_TERT, "case-cde", "pr_case_cde", "tables.report_metrics.E", CDE,
    row = list(method = "observed_rate_tertiles"), note = TERT_NOTE)
add("cde.tertiles.tau20.EoverN", "scalar", rm_cde$E[it] / rm_cde$N[it], F_EON(4), TOL_ENGINE, S_TERT, "case-cde", "pr_case_cde",
    "tables.report_metrics.E / tables.report_metrics.N", CDE, row = list(method = "observed_rate_tertiles"), note = TERT_NOTE)
add("cde.tertiles.tau20.risk", "scalar", rm_cde$risk[it], F_RISK(6), TOL_ENGINE, S_TERT, "case-cde", "pr_case_cde", "tables.report_metrics.risk", CDE,
    row = list(method = "observed_rate_tertiles"), note = TERT_NOTE)
add("cde.allwithheld.tau20.risk", "scalar", rm_cde$risk[iw], F_RISK(2), TOL_ENGINE, S_CDE_FIXED("all withheld"), "case-cde", "pr_case_cde",
    "tables.report_metrics.risk", CDE, row = list(method = "all_withheld"), note = "pr_case_cde$reference$metrics")
ev_task("cdeTert", "case-cde", cd$tables$reports$observed_rate_tertiles, 0.2, 1)
ev_task("cdeAllw", "case-cde", cd$tables$reports$all_withheld, 0.2, 1)
check("cde.tertiles.tau20.N", function(r) r$evaluate$cdeTert$N); check("cde.tertiles.tau20.E", function(r) r$evaluate$cdeTert$E[[1]])
check("cde.tertiles.tau20.EoverN", function(r) r$evaluate$cdeTert$EoverN[[1]]); check("cde.tertiles.tau20.risk", function(r) r$evaluate$cdeTert$risk)
check("cde.allwithheld.tau20.risk", function(r) r$evaluate$cdeAllw$risk)

iF <- which(cd$tables$units$label == "F"); iI <- which(cd$tables$units$label == "I")
add("cde.pair.FI.pi", "scalar", 1 - cd$arrays$error$e[1, iF, iI], F_PROB(4), TOL_ENGINE, S_NONE, "case-cde", "pr_case_cde",
    sprintf("arrays.error.e.0.%d.%d", iF - 1L, iI - 1L), CDE,
    note = "Pr(theta_F > theta_I) = 1 - e_FI (no latent ties: pr_case_cde$input$zero_ties); F and I are the course labels of tables.units")

# ---- KRW firms (case-krw, krw-lambda-grid) --------------------------------------------------------------------------------
add("krw.frame.n", "scalar", kd$facts$n, F_COUNT, TOL_EXACT, S_NONE, "case-krw", "pr_case_krw", "facts.n", KRW)
add("krw.frame.M", "scalar", kd$facts$M, F_COUNT, TOL_EXACT, S_NONE, "case-krw", "pr_case_krw", "facts.M", KRW)
add("krw.card.lambda", "scalar", kd$facts$card_lambda, F_SETTING, TOL_EXACT, sets(lambda = "settings.lambda25"), "case-krw", "pr_case_krw",
    "facts.card_lambda", KRW, note = "pr_case_krw$reference$single_criterion$lambda: the lambda at which KRW chose the published cards")
add("krw.card.tau", "scalar", kd$facts$card_tau, F_SETTING, TOL_EXACT, sets(lambda = "settings.lambda25", tau = "settings.tau20"), "case-krw",
    "pr_case_krw", "facts.card_tau", KRW, note = "pr_case_krw$reference$single_criterion$tau = lambda / (1 + lambda)")
cm <- kd$tables$card_metrics; ce <- kd$tables$card_evaluation
krw_card <- function(crit, crit_id, keys) {
  i <- which(cm$criterion == crit); j <- which(ce$criterion == crit); S <- S_KRW_CARD(crit_id); row <- list(criterion = crit)
  sz <- as.integer(strsplit(cm$grade_sizes[i], "/", fixed = TRUE)[[1]])
  stopifnot(identical(sz, sizes_of(kd$tables$reports[[paste0(crit, "_card")]])))
  A <- "tables.card_metrics."; AN <- "pr_case_krw$reference$single_criterion$archive_metrics (KRW's archive)"
  ARCH <- paste0(AN, ", under KRW's archived pair probabilities; the engine on the released array (postrank's midpoint-cell probabilities) agrees within the relative tolerance")
  if ("sizes" %in% keys) add(sprintf("krw.%s.card.sizes", crit), "vector", sz, F_SIZES, TOL_EXACT, S, "case-krw", "pr_case_krw", paste0(A, "grade_sizes"), KRW, row = row,
                             note = paste0(AN, "; equal to the sizes of tables.reports.", crit, "_card"))
  if ("G" %in% keys) add(sprintf("krw.%s.card.G", crit), "scalar", cm$G[i], F_COUNT, TOL_EXACT, S, "case-krw", "pr_case_krw", paste0(A, "G"), KRW, row = row, note = AN)
  if ("N" %in% keys) add(sprintf("krw.%s.card.N", crit), "scalar", cm$N[i], F_COUNT, TOL_EXACT, S, "case-krw", "pr_case_krw", paste0(A, "N"), KRW, row = row, note = AN)
  if ("s" %in% keys) add(sprintf("krw.%s.card.s", crit), "scalar", cm$s[i], F_PROB(3), TOL_ENGINE, S, "case-krw", "pr_case_krw", paste0(A, "s"), KRW, row = row,
                         note = paste0(AN, "; s = N / M"))
  if ("E" %in% keys) add(sprintf("krw.%s.card.E", crit), "scalar", cm$E[i], F_DEC(1), TOL_KRW_ARCHIVE, S, "case-krw", "pr_case_krw", paste0(A, "E"), KRW, row = row, note = ARCH)
  if ("DR" %in% keys) add(sprintf("krw.%s.card.DR", crit), "scalar", cm$DR[i], F_PROB(4), TOL_KRW_ARCHIVE, S, "case-krw", "pr_case_krw", paste0(A, "DR"), KRW, row = row,
                          note = paste0(ARCH, "; DR = E / M"))
  if ("EoverN" %in% keys) add(sprintf("krw.%s.card.EoverN", crit), "scalar", cm$conditional_DR[i], F_EON_SIG(3), TOL_KRW_ARCHIVE, S, "case-krw", "pr_case_krw",
                              paste0(A, "conditional_DR"), KRW, row = row, note = paste0(ARCH, "; conditional_DR = E / N"))
  if ("taubar" %in% keys) add(sprintf("krw.%s.card.taubar", crit), "scalar", cm$tau_bar[i], F_DEC(4), TOL_KRW_ARCHIVE, S, "case-krw", "pr_case_krw",
                              paste0(A, "tau_bar"), KRW, row = row, note = paste0(ARCH, "; Kendall's tau-bar (KRW) = (N - 2E) / M"))
  if ("risk" %in% keys) add(sprintf("krw.%s.card.tau20.risk", crit), "scalar", ce$risk[j], F_RISK(4), TOL_ENGINE, S, "case-krw", "pr_case_krw",
                            "tables.card_evaluation.risk", KRW, row = row,
                            note = paste0("pr_case_krw$reference$single_criterion$cell_metrics: postrank's evaluation of the fixed card at tau = .20 on the released ",
                                          "array (evaluation of a fixed report); KRW's archive_risk ", sprintf("%.7f", cm$archive_risk[i]), " agrees to 1e-6"))
  k <- which(kk == crit_id) - 1L
  ev_task(paste0("card_", crit), "case-krw", kd$tables$reports[[paste0(crit, "_card")]], 0.2, 1, criteria = k)
  discl[[paste0("card_", crit)]] <<- list(id = paste0("card_", crit), grade = I(as.integer(kd$tables$reports[[paste0(crit, "_card")]])))
}
kk <- kd$facts$criteria
krw_card("race", "race_signed", c("sizes", "G", "N", "s", "E", "DR", "EoverN", "taubar", "risk"))
krw_card("gender", "gender_signed", c("sizes", "N", "s"))
check("krw.race.card.sizes", function(r) r$sizes$card_race); check("krw.race.card.G", function(r) r$evaluate$card_race$G)
check("krw.race.card.N", function(r) r$evaluate$card_race$N); check("krw.race.card.s", function(r) r$evaluate$card_race$s)
check("krw.race.card.E", function(r) r$evaluate$card_race$E[[1]]); check("krw.race.card.DR", function(r) r$evaluate$card_race$EoverM[[1]])
check("krw.race.card.EoverN", function(r) r$evaluate$card_race$EoverN[[1]])
check("krw.race.card.taubar", function(r) with(r$evaluate$card_race, (N - 2 * E[[1]]) / kd$facts$M))
check("krw.race.card.tau20.risk", function(r) r$evaluate$card_race$risk)
check("krw.gender.card.sizes", function(r) r$sizes$card_gender); check("krw.gender.card.N", function(r) r$evaluate$card_gender$N)
check("krw.gender.card.s", function(r) r$evaluate$card_gender$s)

lam <- gd$facts$lambda; G_race <- gd$arrays$race$grade
stopifnot(length(lam) == 101L, identical(dim(G_race), c(101L, 97L)), isTRUE(all.equal(lam, seq(0, 1, by = 0.01))))
lam_seg <- function(l) if (abs(l - 1) < 1e-12) "lambda1" else sprintf("lambda%02d", as.integer(round(100 * l)))
multi <- which(apply(G_race, 1, function(g) length(unique(g)) > 1))[1]
GRID_NOTE <- "krw-lambda-grid: grades of KRW's code in the KRW companion, joined to the firms by row position (estimate and SE identical)"
add("krw.grid.race.count", "scalar", gd$facts$count, F_COUNT, TOL_EXACT, S_KRW_GRID("KRW grid .00 to 1 by .01"), "krw-lambda-grid", "KRW lambda grid",
    "facts.count", KRW, note = GRID_NOTE)
add("krw.grid.race.firstmulti.lambda", "scalar", lam[multi], F_SETTING, TOL_EXACT, S_KRW_GRID("KRW grid .00 to 1 by .01"), "krw-lambda-grid",
    "KRW lambda grid", "facts.lambda", KRW, row = list(position = multi - 1L),
    note = paste0(GRID_NOTE, "; the first grid value whose race card has more than one grade"))
for (i in seq_along(lam)) {
  key <- sprintf("krw.grid.race.%s.sizes", lam_seg(lam[i])); id <- sprintf("grid_%03d", i - 1L)
  add(key, "vector", sizes_of(G_race[i, ]), F_SIZES, TOL_EXACT, S_KRW_GRID(paste("KRW grid lambda =", sub("^0\\.", ".", sprintf("%.2f", lam[i])))), "krw-lambda-grid", "KRW lambda grid",
      "arrays.race.grade", KRW, row = list(position = i - 1L, lambda = lam[i]), note = paste0(GRID_NOTE, "; sizes of the grade vector, grade 1 first"))
  discl[[id]] <- list(id = id, grade = I(as.integer(G_race[i, ])))
  local({ id2 <- id; check(key, function(r) r$sizes[[id2]]) })
}

kc <- kd$analyses$case_krw_signed97; kcf <- kc$facts; kcp <- kc$tables$profile; AK <- "analyses.case_krw_signed97"
stopifnot(identical(kcp$criterion, kk))
add("krw.rg.w50.cap4.tau25.sizes", "vector", as.integer(kcf$sizes), F_SIZES, TOL_EXACT, S_KRW_COMMON, "case-krw", "case_krw_signed97", paste0(AK, ".facts.sizes"), KRW)
add("krw.rg.w50.cap4.tau25.N", "scalar", kcf$N, F_COUNT, TOL_EXACT, S_KRW_COMMON, "case-krw", "case_krw_signed97", paste0(AK, ".facts.N"), KRW)
add("krw.rg.w50.cap4.tau25.risk", "scalar", kcf$risk, F_RISK(7), TOL_ENGINE, S_KRW_COMMON, "case-krw", "case_krw_signed97", paste0(AK, ".facts.risk"), KRW)
add("krw.rg.w50.cap4.tau25.EoverN", "vector", kcp$E_over_N, F_TUPLE(F_EON(4)), TOL_ENGINE, S_KRW_COMMON, "case-krw", "case_krw_signed97",
    paste0(AK, ".tables.profile.E_over_N"), KRW, note = "criteria race_signed, gender_signed")
add("krw.rg.w50.cap4.tau25.Rk", "vector", kcp$risk, F_TUPLE(F_RISK(4)), TOL_ENGINE, S_KRW_COMMON, "case-krw", "case_krw_signed97",
    paste0(AK, ".tables.profile.risk"), KRW, note = "criterion risks R_k, criteria race_signed, gender_signed")
add("krw.rg.w50.cap4.tau25.status", "text", kcf$status, NULL, NULL, S_KRW_COMMON, "case-krw", "case_krw_signed97", paste0(AK, ".facts.status"), KRW,
    note = "solver status of the archived solve; the result label is \"optimal within solver tolerances\"")
add("krw.rg.w50.cap4.tau25.gap", "scalar", kcf$gap, F_SCI(3), TOL_SOLVER, S_KRW_COMMON, "case-krw", "case_krw_signed97", paste0(AK, ".facts.gap"), KRW,
    note = "risk minus bound of the archived HiGHS solve (bound_source engine_lp_relaxation_bound_clamped)")
ev_task("krwCommon", "case-krw", kc$tables$units$grade, 0.25, c(0.5, 0.5))
discl[["krwCommon"]] <- list(id = "krwCommon", grade = I(as.integer(kc$tables$units$grade)))
check("krw.rg.w50.cap4.tau25.sizes", function(r) r$sizes$krwCommon); check("krw.rg.w50.cap4.tau25.N", function(r) r$evaluate$krwCommon$N)
check("krw.rg.w50.cap4.tau25.risk", function(r) r$evaluate$krwCommon$risk)
check("krw.rg.w50.cap4.tau25.EoverN", function(r) unlist(r$evaluate$krwCommon$EoverN)); check("krw.rg.w50.cap4.tau25.Rk", function(r) unlist(r$evaluate$krwCommon$Rk))
# the two cards under the common loss (browser keys krw.*.card.rgw50.tau25.risk, golden postrank_compare): checked here only
ev_task("raceCommonLoss", "case-krw", kd$tables$reports$race_card, 0.25, c(0.5, 0.5))
ev_task("genderCommonLoss", "case-krw", kd$tables$reports$gender_card, 0.25, c(0.5, 0.5))

# ---- Alabama counties (case-alabama) ------------------------------------------------------------------------------------
a67 <- ad$analyses$case_alabama67; af <- a67$facts; ap <- a67$tables$profile; AA <- "analyses.case_alabama67"; ak <- ad$facts$criteria
stopifnot(identical(ap$criterion, ak), identical(ak, c("income", "incarceration")))
add("alabama.frame.n", "scalar", ad$facts$n, F_COUNT, TOL_EXACT, S_NONE, "case-alabama", "pr_case_alabama", "facts.n", ATLAS)
add("alabama.frame.M", "scalar", ad$facts$M, F_COUNT, TOL_EXACT, S_NONE, "case-alabama", "pr_case_alabama", "facts.M", ATLAS)
add("alabama.level", "scalar", ad$facts$interval_level, F_SETTING, TOL_EXACT, S_NONE, "case-alabama", "pr_case_alabama", "facts.interval_level", ATLAS,
    note = "pr_case_alabama$input$summaries$level: the stored marginal interval level")
add("alabama.ic.w50.cap5.tau20.sizes", "vector", as.integer(af$sizes), F_SIZES, TOL_EXACT, S_AL, "case-alabama", "case_alabama67", paste0(AA, ".facts.sizes"), ATLAS)
add("alabama.ic.w50.cap5.tau20.N", "scalar", af$N, F_COUNT, TOL_EXACT, S_AL, "case-alabama", "case_alabama67", paste0(AA, ".facts.N"), ATLAS)
add("alabama.ic.w50.cap5.tau20.risk", "scalar", af$risk, F_RISK(6), TOL_ENGINE, S_AL, "case-alabama", "case_alabama67", paste0(AA, ".facts.risk"), ATLAS)
add("alabama.ic.w50.cap5.tau20.EoverN", "vector", ap$E_over_N, F_TUPLE(F_EON(3)), TOL_ENGINE, S_AL, "case-alabama", "case_alabama67",
    paste0(AA, ".tables.profile.E_over_N"), ATLAS, note = "criteria income, incarceration")
add("alabama.ic.w50.cap5.tau20.status", "text", af$status, NULL, NULL, S_AL, "case-alabama", "case_alabama67", paste0(AA, ".facts.status"), ATLAS,
    note = "solver status of the archived solve; the result label is \"optimal within solver tolerances\"")
add("alabama.ic.w50.cap5.tau20.gap", "scalar", af$gap, F_SCI(2), TOL_SOLVER, S_AL, "case-alabama", "case_alabama67", paste0(AA, ".facts.gap"), ATLAS,
    note = "risk minus bound of the HiGHS solve stored in postrank 1.1.0 (the archived reference metrics of postrank 0.9.0 record 1.39e-16)")
cmA <- ad$tables$commonality; ic <- match(ak, cmA$criterion)
add("alabama.ic.w50.cap5.tau20.cost", "vector", cmA$cost_lower_A[ic], F_TUPLE(F_RISK(4)), TOL_SOLVER, S_AL, "case-alabama", "pr_case_alabama",
    "tables.commonality.cost_lower_A", ATLAS, row = list(criterion = I(ak)),
    note = "pr_case_alabama$reference$commonality: cost of the common grade per criterion, common criterion risk minus the criterion's own lower bound (archived, HiGHS)")
ev_task("alCommon", "case-alabama", a67$tables$units$grade, 0.2, c(0.5, 0.5))
discl[["alCommon"]] <- list(id = "alCommon", grade = I(as.integer(a67$tables$units$grade)))
check("alabama.ic.w50.cap5.tau20.sizes", function(r) r$sizes$alCommon); check("alabama.ic.w50.cap5.tau20.N", function(r) r$evaluate$alCommon$N)
check("alabama.ic.w50.cap5.tau20.risk", function(r) r$evaluate$alCommon$risk)
check("alabama.ic.w50.cap5.tau20.EoverN", function(r) unlist(r$evaluate$alCommon$EoverN))
check("alabama.ic.w50.cap5.tau20.cost", function(r) unlist(r$evaluate$alCommon$Rk) - c(r$evaluate$alD1own$risk, r$evaluate$alD2own$risk))

rmA <- ad$tables$reference_metrics; iD1 <- which(rmA$method == "D1"); iD2 <- which(rmA$method == "D2")
D_NOTE <- "pr_case_alabama$reference$metrics (archived reference reports, postrank 0.9.0 with HiGHS); the report is evaluated under the common loss"
add("alabama.D1.w50.tau20.risk", "scalar", rmA$A_Rtau[iD1], F_RISK(4), TOL_ENGINE, S_AL_D("D1: income's own optimum with at most 5 grades"), "case-alabama",
    "pr_case_alabama", "tables.reference_metrics.A_Rtau", ATLAS, row = list(method = "D1"), note = D_NOTE)
add("alabama.D1.w50.tau20.N", "scalar", rmA$N[iD1], F_COUNT, TOL_EXACT, S_AL_D("D1: income's own optimum with at most 5 grades"), "case-alabama",
    "pr_case_alabama", "tables.reference_metrics.N", ATLAS, row = list(method = "D1"), note = D_NOTE)
add("alabama.D1.w50.tau20.EoverN", "vector", c(rmA$A_E_income[iD1], rmA$A_E_incarceration[iD1]) / rmA$N[iD1], F_TUPLE(F_EON(3)), TOL_ENGINE,
    S_AL_D("D1: income's own optimum with at most 5 grades"), "case-alabama", "pr_case_alabama",
    "tables.reference_metrics.A_E_income / N, tables.reference_metrics.A_E_incarceration / N", ATLAS, row = list(method = "D1"),
    note = paste0(D_NOTE, "; criteria income, incarceration"))
add("alabama.D2.w50.tau20.risk", "scalar", rmA$A_Rtau[iD2], F_RISK(4), TOL_ENGINE, S_AL_D("D2: incarceration's own optimum with at most 5 grades"), "case-alabama",
    "pr_case_alabama", "tables.reference_metrics.A_Rtau", ATLAS, row = list(method = "D2"), note = D_NOTE)
scA <- ad$tables$single_criterion; is <- match(ak, scA$criterion)
stopifnot(identical(scA$method[is], c("D1", "D2")))
add("alabama.single.risk", "vector", scA$risk[is], F_TUPLE(F_RISK(4)), TOL_ENGINE,
    sets(cap = "settings.cap5", family = "at most 5 grades", report = "each criterion's own optimum (D1 income, D2 incarceration) on its own criterion", tau = "settings.tau20"),
    "case-alabama", "pr_case_alabama", "tables.single_criterion.risk", ATLAS, row = list(criterion = I(ak)),
    note = "pr_case_alabama$reference$single_criterion (archived, HiGHS, gap 0); criteria income, incarceration")
ev_task("alD1", "case-alabama", ad$tables$reports$D1, 0.2, c(0.5, 0.5)); ev_task("alD2", "case-alabama", ad$tables$reports$D2, 0.2, c(0.5, 0.5))
ev_task("alD1own", "case-alabama", ad$tables$reports$D1, 0.2, 1, criteria = 0L); ev_task("alD2own", "case-alabama", ad$tables$reports$D2, 0.2, 1, criteria = 1L)
check("alabama.D1.w50.tau20.risk", function(r) r$evaluate$alD1$risk); check("alabama.D1.w50.tau20.N", function(r) r$evaluate$alD1$N)
check("alabama.D1.w50.tau20.EoverN", function(r) unlist(r$evaluate$alD1$EoverN)); check("alabama.D2.w50.tau20.risk", function(r) r$evaluate$alD2$risk)
check("alabama.single.risk", function(r) c(r$evaluate$alD1own$risk, r$evaluate$alD2own$risk))

# ---- thirty sites, three criteria (cache-30x3; author data) -------------------------------------------------------------
an <- c30$analyses; k3 <- c("poverty", "frl", "snap")
cc25 <- an$commonality_30x3$tables$costs; cc35 <- an$commonality_30x3_tau35$tables$costs; a35 <- an$analysis_30x3_tau35; fr <- an$frontier_30x3$tables$path
stopifnot(identical(cc25$criterion_id, k3), identical(cc35$criterion_id, k3), identical(a35$tables$profile$criterion, k3),
          identical(an$commonality_30x3$facts$G_max, 4L), identical(a35$facts$G_max, 4L), identical(an$frontier_30x3$facts$G_max, 4L),
          isTRUE(all.equal(unlist(a35$facts$weights), c(poverty = 0.5, frl = 0.25, snap = 0.25))),
          isTRUE(all.equal(cc35$common_grade_risk, a35$tables$profile$risk, tolerance = 1e-14)))
P30 <- "criteria poverty, frl, snap"
add("thirty.pfs.wpov50.cap4.tau25.cost", "vector", cc25$cost_lower, F_TUPLE(F_RISK(4)), TOL_SOLVER, S_30("settings.tau25"), "cache-30x3", "commonality_30x3",
    "analyses.commonality_30x3.tables.costs.cost_lower", AUTHOR, note = paste0("common criterion risk minus each criterion's own lower bound; ", P30))
add("thirty.pfs.wpov50.cap4.tau25.ownrisk", "vector", cc25$own_best_risk, F_TUPLE(F_RISK(3)), TOL_SOLVER, S_30("settings.tau25"), "cache-30x3", "commonality_30x3",
    "analyses.commonality_30x3.tables.costs.own_best_risk", AUTHOR, note = paste0("each criterion's own optimum (archived HiGHS solves); ", P30))
add("thirty.pfs.wpov50.cap4.tau35.cost", "vector", cc35$cost_lower, F_TUPLE(F_RISK(4)), TOL_SOLVER, S_30("settings.tau35"), "cache-30x3", "commonality_30x3_tau35",
    "analyses.commonality_30x3_tau35.tables.costs.cost_lower", AUTHOR, note = paste0("common criterion risk minus each criterion's own lower bound; ", P30))
add("thirty.pfs.wpov50.cap4.tau35.commonrisk", "vector", cc35$common_grade_risk, F_TUPLE(F_RISK(4)), TOL_ENGINE, S_30("settings.tau35"), "cache-30x3",
    "commonality_30x3_tau35", "analyses.commonality_30x3_tau35.tables.costs.common_grade_risk", AUTHOR,
    note = paste0("criterion risks of the common grade analysis_30x3_tau35; ", P30))
add("thirty.pfs.wpov50.cap4.tau35.ownrisk", "vector", cc35$own_best_risk, F_TUPLE(F_RISK(4)), TOL_SOLVER, S_30("settings.tau35"), "cache-30x3",
    "commonality_30x3_tau35", "analyses.commonality_30x3_tau35.tables.costs.own_best_risk", AUTHOR,
    note = paste0("each criterion's own optimum (archived HiGHS solves); ", P30))
add("thirty.pfs.wpov50.cap4.tau35.EoverN", "vector", a35$tables$profile$E_over_N, F_TUPLE(F_EON(3)), TOL_ENGINE, S_30("settings.tau35"), "cache-30x3",
    "analysis_30x3_tau35", "analyses.analysis_30x3_tau35.tables.profile.E_over_N", AUTHOR, note = P30)
add("thirty.pfs.wpov50.cap4.tau35.risk", "scalar", a35$facts$risk, F_RISK(6), TOL_ENGINE, S_30("settings.tau35"), "cache-30x3", "analysis_30x3_tau35",
    "analyses.analysis_30x3_tau35.facts.risk", AUTHOR)
add("thirty.pfs.wpov50.cap4.tau35.N", "scalar", a35$facts$N, F_COUNT, TOL_EXACT, S_30("settings.tau35"), "cache-30x3", "analysis_30x3_tau35",
    "analyses.analysis_30x3_tau35.facts.N", AUTHOR)
stopifnot(isTRUE(all.equal(fr$tau, seq(0.10, 0.45, by = 0.05))), all(fr$status == "optimal"))
add("thirty.pfs.wpov50.cap4.taupath.N", "vector", as.integer(fr$N), F_TUPLE(F_COUNT), TOL_EXACT, S_30("grid .10 to .45 by .05"), "cache-30x3", "frontier_30x3",
    "analyses.frontier_30x3.tables.path.N", AUTHOR, note = "postrank_frontier() of analysis_30x3 at tau .10, .15, ..., .45 (archived HiGHS solves, all optimal)")
ev_task("thirty35", "cache-30x3", a35$tables$units$grade, 0.35, c(0.5, 0.25, 0.25), path = "arrays.draws")
evals$thirty35$file <- rel_path("thirty-draws")
check("thirty.pfs.wpov50.cap4.tau35.risk", function(r) r$evaluate$thirty35$risk); check("thirty.pfs.wpov50.cap4.tau35.N", function(r) r$evaluate$thirty35$N)
check("thirty.pfs.wpov50.cap4.tau35.EoverN", function(r) unlist(r$evaluate$thirty35$EoverN))
check("thirty.pfs.wpov50.cap4.tau35.commonrisk", function(r) unlist(r$evaluate$thirty35$Rk))

# ---- displays and engine recomputation (node, js/pr-core.js) ---------------------------------------------------------------
keys <- sort(names(entries), method = "radix")
val_json <- function(e) jsonlite::fromJSON(json_text(list(v = e$value)), simplifyVector = FALSE)$v   # the value as stored
job <- list(mode = "prepare",
            displays = lapply(keys, function(k) { e <- entries[[k]]; c(list(key = k, type = e$type, value = e$value), if (!is.null(e$fmt)) list(format = e$fmt)) }),
            evaluate = unname(evals), disclosure = unname(discl))
res <- run_node(job)
disp <- res$display
missing_disp <- setdiff(keys, names(disp)); if (length(missing_disp)) stop("no display for ", missing_disp[1], call. = FALSE)

cat("checks:\n")
# (a) documented values (Step 3.5) and the storyboards' expected displays
V <- function(k) as.numeric(unlist(entries[[k]]$value))
expect_identical_val(as.integer(V("cde.cap3.tau20.sizes")), c(3L, 6L, 3L), "CDE: case_cde_12 sizes 3/6/3 (tau .20, at most 3 grades)")
expect_equal_num(c(V("cde.cap3.tau20.N"), V("cde.frame.M"), round(V("cde.cap3.tau20.risk"), 6)), c(45, 66, 0.063774), 0, "CDE: N 45 of 66, risk .063774")
expect_equal_num(c(V("cde.tertiles.tau20.N"), round(V("cde.tertiles.tau20.risk"), 6)), c(48, 0.082255), 0, "CDE: tertiles N 48, risk .082255")
expect_equal_num(c(round(V("krw.race.card.DR"), 3), round(V("krw.race.card.DR"), 4), round(V("krw.race.card.EoverN"), 3), round(V("krw.race.card.s"), 3),
                   V("krw.race.card.N")), c(0.039, 0.0387, 0.136, 0.284, 1324), 0, "KRW: race card DR .039 (.0387), E/N .136, s .284, N 1,324")
expect_identical_val(as.integer(V("krw.rg.w50.cap4.tau25.sizes")), c(6L, 90L, 1L), "KRW: common grade 6/90/1 (tau .25, at most 4 grades, w = (1/2, 1/2))")
expect_equal_num(c(V("krw.rg.w50.cap4.tau25.N"), round(V("krw.rg.w50.cap4.tau25.risk"), 7)), c(636, 0.2454704), 0, "KRW: common N 636, risk .2454704")
expect_equal_num(round(c(res$evaluate$raceCommonLoss$risk, res$evaluate$genderCommonLoss$risk), 6), c(0.269304, 0.265418), 0,
                 "KRW: the two cards under the common loss .269304 and .265418 (engine; browser keys, not written here)")
expect_identical_val(as.integer(V("alabama.ic.w50.cap5.tau20.sizes")), c(1L, 31L, 32L, 1L, 2L), "Alabama: common grade 1/31/32/1/2 (tau .20, at most 5 grades, w = (1/2, 1/2))")
expect_equal_num(c(round(V("alabama.ic.w50.cap5.tau20.risk"), 6), round(V("alabama.ic.w50.cap5.tau20.cost"), 6)), c(0.150394, 0.054824, 0.064528), 0,
                 "Alabama: risk .150394, costs .054824 (income) and .064528 (incarceration)")
want_display <- c(
  krw.frame.n = "97", krw.frame.M = "4,656", krw.card.lambda = ".25", krw.card.tau = ".20",
  krw.race.card.sizes = "sizes 2, 81, 14", krw.race.card.G = "3", krw.race.card.N = "1,324", krw.race.card.s = ".284", krw.race.card.E = "180.1",
  krw.race.card.DR = ".0387", krw.race.card.EoverN = ".136", krw.race.card.taubar = ".2070", krw.race.card.tau20.risk = ".1818",
  krw.gender.card.sizes = "sizes 1, 3, 89, 4", krw.gender.card.N = "731", krw.gender.card.s = ".157",
  krw.grid.race.count = "101", krw.grid.race.firstmulti.lambda = ".08", krw.grid.race.lambda08.sizes = "sizes 1, 96",
  cde.statewide.n = "5,834", cde.statewide.M = "17,014,861", cde.frame.n = "12", cde.frame.M = "66",
  cde.cap3.tau20.sizes = "sizes 3, 6, 3", cde.cap3.tau20.N = "45", cde.cap3.tau20.E = ".00911", cde.cap3.tau20.EoverN = ".000203",
  cde.cap3.tau20.risk = ".063774", cde.cap3.tau20.bound = ".063774", cde.cap3.tau20.gap = "1.39e−17", cde.cap3.tau20.status = "optimal",
  cde.tertiles.tau20.N = "48", cde.tertiles.tau20.E = "1.829", cde.tertiles.tau20.EoverN = ".0381", cde.tertiles.tau20.risk = ".082255",
  cde.allwithheld.tau20.risk = ".20", cde.pair.FI.pi = ".9999",
  thirty.pfs.wpov50.cap4.tau25.cost = "(.0895, .0749, .1022)", thirty.pfs.wpov50.cap4.tau25.ownrisk = "(.160, .175, .148)",
  thirty.pfs.wpov50.cap4.tau35.cost = "(.0239, .0330, .4455)", thirty.pfs.wpov50.cap4.tau35.commonrisk = "(.2142, .2368, .6251)",
  thirty.pfs.wpov50.cap4.tau35.ownrisk = "(.1903, .2038, .1795)", thirty.pfs.wpov50.cap4.tau35.EoverN = "(.136, .172, .784)",
  thirty.pfs.wpov50.cap4.tau35.risk = ".322573", thirty.pfs.wpov50.cap4.tau35.N = "276",
  thirty.pfs.wpov50.cap4.taupath.N = "(0, 0, 0, 0, 131, 276, 305, 312)",
  krw.rg.w50.cap4.tau25.sizes = "sizes 6, 90, 1", krw.rg.w50.cap4.tau25.N = "636", krw.rg.w50.cap4.tau25.risk = ".2454704",
  krw.rg.w50.cap4.tau25.EoverN = "(.1963, .2374)", krw.rg.w50.cap4.tau25.Rk = "(.2427, .2483)", krw.rg.w50.cap4.tau25.status = "optimal",
  krw.rg.w50.cap4.tau25.gap = "0",
  alabama.frame.n = "67", alabama.frame.M = "2,211", alabama.level = ".95",
  alabama.ic.w50.cap5.tau20.sizes = "sizes 1, 31, 32, 1, 2", alabama.ic.w50.cap5.tau20.N = "1,249", alabama.ic.w50.cap5.tau20.risk = ".150394",
  alabama.ic.w50.cap5.tau20.EoverN = "(.052, .172)", alabama.ic.w50.cap5.tau20.status = "optimal", alabama.ic.w50.cap5.tau20.gap = "1.1e−16",
  alabama.ic.w50.cap5.tau20.cost = "(.0548, .0645)",
  alabama.D1.w50.tau20.risk = ".1906", alabama.D1.w50.tau20.N = "1,769", alabama.D1.w50.tau20.EoverN = "(.027, .349)",
  alabama.D2.w50.tau20.risk = ".1998", alabama.single.risk = "(.0616, .1199)")
stopifnot(all(names(want_display) %in% keys))
bad <- names(want_display)[vapply(names(want_display), function(k) !identical(enc2utf8(disp[[k]]), enc2utf8(want_display[[k]])), TRUE)]
if (length(bad)) stop(sprintf("display differs from the storyboard: %s is \"%s\", expected \"%s\"", bad[1], disp[[bad[1]]], want_display[[bad[1]]]), call. = FALSE)
cat(sprintf("  ok  %d displays equal the storyboards' expected values (engine formatters)\n", length(want_display)))

# (b) a base-R remake of the fixed-decimal and count displays (sprintf: binary value, ties to even, as the engine)
minus <- function(s) sub("^-", "−", s)
r_fixed <- function(x, d) { s <- sprintf("%.*f", d, x); if (abs(as.numeric(s)) < 1) s <- sub("^(-?)0\\.", "\\1.", s); minus(s) }
r_one <- function(x, fn, dd) {
  if (fn == "formatCount") return(formatC(x, format = "d", big.mark = ","))
  if (!fn %in% c("formatRisk", "formatProb", "formatEoverN", "formatDecimal") || is.null(dd) || x == 0) return(NULL)
  # outside the remake: the bounds wording ("below .001", "above .999") and comma grouping
  if (abs(x) < 10^-dd || (fn %in% c("formatProb", "formatEoverN") && x > 1 - 10^-dd) || abs(x) >= 1000) return(NULL)
  r_fixed(x, dd)
}
r_display <- function(e) {
  f <- e$fmt; if (is.null(f) || e$type == "text") return(NULL)
  v <- as.numeric(unlist(e$value))
  if (f$fn == "formatSizes") return(paste("sizes", paste(v, collapse = ", ")))
  if (f$fn == "formatTuple") {
    p <- lapply(v, r_one, f$item$fn, f$item$options$digits)
    if (any(vapply(p, is.null, TRUE))) return(NULL)
    return(sprintf("(%s)", paste(unlist(p), collapse = ", ")))
  }
  if (length(v) != 1L) return(NULL)
  r_one(v, f$fn, f$options$digits)
}
remade <- 0L
for (k in keys) {
  r <- r_display(entries[[k]]); if (is.null(r)) next
  if (!identical(enc2utf8(r), enc2utf8(disp[[k]]))) stop(sprintf("base-R display of %s is \"%s\", engine \"%s\"", k, r, disp[[k]]), call. = FALSE)
  remade <- remade + 1L
}
cat(sprintf("  ok  %d of %d displays remade in base R (sprintf, leading zero dropped, U+2212 minus, comma grouping) agree with the engine\n", remade, length(keys)))

# (c) engine recomputation on the released arrays
within_tol <- function(a, b, t) { ab <- if (is.list(t)) t$abs %||% 0 else t; rl <- if (is.list(t)) t$rel %||% 0 else 0; all(abs(a - b) <= ab + rl * abs(b)) }
tol_text <- function(t) if (is.list(t)) sprintf("rel %g", t$rel) else format(t)
cat("  engine recomputation (js/pr-core.js on the released arrays):\n")
cat(sprintf("    %-42s %-26s %-26s %-9s %s\n", "key", "registry", "engine", "max diff", "tolerance"))
nx <- 0L
for (k in sort(names(xc), method = "radix")) {
  e <- entries[[k]]; got <- as.numeric(unlist(xc[[k]](res))); want <- as.numeric(unlist(e$value))
  if (length(got) != length(want) || !within_tol(want, got, e$tolerance))
    stop(sprintf("engine recomputation of %s: registry %s, engine %s (tolerance %s)", k, paste(signif(want, 10), collapse = "/"),
                 paste(signif(got, 10), collapse = "/"), tol_text(e$tolerance)), call. = FALSE)
  nx <- nx + 1L
  if (!grepl("^krw\\.grid\\.race\\.lambda", k))
    cat(sprintf("    %-42s %-26s %-26s %-9.2g %s\n", k, paste(signif(want, 7), collapse = "/"), paste(signif(got, 7), collapse = "/"), max(abs(want - got)), tol_text(e$tolerance)))
}
cat(sprintf("  ok  %d keys recomputed by the engine within tolerance (%d grid sizes not listed); %d keys without an engine recomputation (solver outputs, frame facts, settings)\n",
            nx, sum(grepl("^krw\\.grid\\.race\\.lambda", names(xc))), length(keys) - nx))

# ---- write data/numbers-cases.json (code-point key order, one entry per line, as scripts/build_numbers.mjs) ----------------
out_path <- file.path(prx_root, "data", "numbers-cases.json")
np <- file.path(prx_root, "data", "numbers.json")
if (file.exists(np)) {
  dup <- intersect(keys, names(jsonlite::fromJSON(np, simplifyVector = FALSE)))
  if (length(dup)) stop("keys defined in both data/numbers.json and data/numbers-cases.json: ", paste(head(dup, 5), collapse = ", "), call. = FALSE)
}
entry_json <- vapply(keys, function(k) {
  e <- entries[[k]]
  x <- list(type = e$type, value = e$value, display = disp[[k]])
  if (!is.null(e$tolerance)) x$tolerance <- e$tolerance
  x <- c(x, list(settings = e$settings, source = e$source, license_scope = e$license_scope, owner = OWNER))
  json_text(x)
}, "")
assert_clean_text(lapply(entries, function(e) list(e$settings, e$source$note, e$source$object, disp)), "numbers-cases")
assert_clean_text(prx_registry_entries(), "data contract registry section")
writeLines(paste0("{\n", paste0("  ", vapply(keys, function(k) json_text(k), ""), ": ", entry_json, collapse = ",\n"), "\n}"), out_path, useBytes = TRUE)
back <- jsonlite::fromJSON(out_path, simplifyVector = FALSE)
stopifnot(identical(names(back), keys))
for (k in keys) if (!identical(val_json(entries[[k]]), back[[k]]$value)) stop("value of ", k, " changed when written", call. = FALSE)
v <- run_node(list(mode = "validate"))
if (length(v$problems)) stop("data/numbers-cases.json: ", paste(unlist(v$problems), collapse = "; "), call. = FALSE)
cat(sprintf("  ok  data/numbers-cases.json: %d keys, schema and types valid (checkFile of verification/check_numbers.mjs), unique against data/numbers.json%s\n",
            v$size, if (file.exists(np)) "" else " (absent)"))

# settings keys referenced (to be defined in numbers/spec/settings.json by the engine half of the registry)
ref <- sort(unique(unlist(lapply(entries, function(e) unlist(e$settings)))), method = "radix"); ref <- ref[startsWith(ref, "settings.")]
spec_files <- list.files(file.path(prx_root, "numbers", "spec"), pattern = "^[^_].*\\.json$", full.names = TRUE)
defined <- unlist(lapply(spec_files, function(f) names(jsonlite::fromJSON(f, simplifyVector = FALSE)$keys)))
miss <- setdiff(ref, defined)
cat(sprintf("  settings keys referenced: %s\n", paste(ref, collapse = ", ")))
if (length(miss)) cat(sprintf("  note: not (yet) defined in numbers/spec/*.json: %s\n", paste(miss, collapse = ", ")))

prx_write_registry_section()
sc <- table(vapply(entries, `[[`, "", "license_scope"))
cat(sprintf("22_case_registry: %d keys (%s)\n", length(keys), paste(sprintf("%s %d", names(sc), as.integer(sc)), collapse = ", ")))
}
