# Author: JoonHo Lee (jlee296@ua.edu).
# The CDE tau path (S-01): the 12-school problem of pr_case_cde solved with postrank 1.1.0 at every tau of a grid and at
# the three named breakpoint values, as one released summary (summary route, CONTRACT 6.1).
#   Rscript r-export/23_cde_taupath.R            (after 21_export_cases.R; run 22_case_registry.R afterwards)
# Each solve mirrors the archived call of case_cde_12: postrank(pr_case_cde$input, weights = c(negative_chronic_absence =
# 1), tau, G_max = 3L, level = 0.9, backend = "highs", control = postrank_control(time_limit = 30, threads = 1L, seed =
# 1304L), fragility = FALSE). n = 12, so every solve is small; the commercial solver is never used.
# Writes data/released/cde-taupath.json, its .js twin and its data contract entry (update_contract() of
# 20_export_teaching.R in library mode, as 21_export_cases.R does); the contract's registry section is kept
# (prx_write_registry_section() of 22_case_registry.R in library mode).
# Checks: the tau = .20 row equals the archived case_cde_12 (3/6/3, N 45 of 66, risk .063774); every row's report and
# risk equal the base-R enumeration of all 523,251 reports with at most 3 grades (verification/golden/oracle-frontier.json
# row tauPath-cde-cap3; oracle-optimize rows exactOptimum-cde-cap3-tau.20 and -tau.45); the crossings of the solved
# reports equal the enumeration breakpoints.
prx_export_lib_only <- TRUE
source("r-export/20_export_teaching.R")
rm(prx_export_lib_only)

cat("23_cde_taupath: data/released/cde-taupath.json\n")
env <- new.env()
utils::data("pr_case_cde", package = "postrank", envir = env)
cde <- env$pr_case_cde; ci <- cde$input; cids <- ci$entity_ids
stopifnot(length(cids) == 12L, identical(ci$criterion_ids, "negative_chronic_absence"), identical(cids, cde$units$entity_id))
clab <- LETTERS[seq_along(cids)]                                   # labels A ... L in package order (as case-cde)
n <- length(cids); M <- choose(n, 2)

# ---- settings ------------------------------------------------------------------------------------------------------
G_MAX <- 3L
WEIGHTS <- setNames(rep(1 / 1, 1), ci$criterion_ids)
CONTROL <- list(time_limit = 30, threads = 1L, seed = 1304L)
ctl <- do.call(postrank_control, CONTROL)
TAU_GRID <- round(seq(0.05, 0.50, by = 0.05), 2)                   # .05, .10, ..., .50
TAU_NAMED <- c(0.00016, 0.00026, 0.446)                            # the breakpoint values the S-01 storyboard names
taus <- c(TAU_NAMED, TAU_GRID); o <- order(taus); taus <- taus[o]
tau_source <- c(rep("named breakpoint value", length(TAU_NAMED)), rep("grid", length(TAU_GRID)))[o]
LABEL <- "optimal within solver tolerances"
backend_version <- as.character(utils::packageVersion("highs"))

solve_at <- function(t) {
  a <- postrank(ci, weights = WEIGHTS, tau = t, G_max = G_MAX, level = 0.9, backend = "highs", control = ctl, fragility = FALSE)
  if (!identical(a$backend$name, "highs")) stop("tau ", t, ": backend ", a$backend$name, ", expected highs", call. = FALSE)
  g <- get_grades(a); stopifnot(identical(names(g), cids)); g <- unname(as.integer(g))
  r <- get_risk(a); p <- get_profile(a); ev <- a$evaluation
  if (!identical(r$status, "optimal")) stop(sprintf("tau %s: status %s (expected optimal)", t, r$status), call. = FALSE)
  # The one accepted warning: a reported bound above the action risk by at most the objective tolerance, clamped to the
  # risk (bound_source ends in "_clamped", as in the archived case_krw_signed97). Any other warning stops the export.
  wn <- unlist(a$warnings)
  other <- wn[!grepl("^Reported lower bound exceeded the validated action risk by at most the objective tolerance; it was clamped", wn)]
  if (length(other)) stop(sprintf("tau %s: postrank warnings: %s", t, paste(other, collapse = "; ")), call. = FALSE)
  if (length(wn) && !grepl("_clamped$", a$fit$objective$bound_source %||% "")) stop(sprintf("tau %s: clamping warning without a clamped bound source", t), call. = FALSE)
  N <- as.integer(ev$N)
  stopifnot(identical(N, sum(outer(g, g, "<"))), isTRUE(all.equal(r$risk, ev$primary_risk, tolerance = 1e-14)))
  list(tau = t, grade = g, G = as.integer(max(g)), sizes = sizes_of(g), N = N, E = p$E[1], E_over_N = if (N > 0) p$E_over_N[1] else NA_real_,
       risk = r$risk, lower_bound = r$lower_bound, gap = r$gap, status = r$status,
       bound_source = a$fit$objective$bound_source %||% NA_character_)
}
rows <- lapply(taus, solve_at)
col_of <- function(f, type) vapply(rows, `[[`, type, f)

# ---- checks against the archived analysis and the base-R enumeration (before anything is written) -----------------------
cat("checks:\n")
a12 <- load_or_compute("case_cde_12")
r20 <- rows[[which(abs(taus - 0.2) < 1e-12)]]
expect_identical_val(r20$grade, unname(as.integer(get_grades(a12)[cids])), "tau .20 row: grades = archived case_cde_12")
expect_identical_val(c(r20$sizes, r20$N, as.integer(M)), c(3L, 6L, 3L, 45L, 66L), "tau .20 row: sizes 3/6/3, N 45 of 66")
expect_equal_num(round(r20$risk, 6), 0.063774, 0, "tau .20 row: risk .063774")
expect_equal_num(r20$risk, get_risk(a12)$risk, 1e-12, "tau .20 row: risk = archived case_cde_12 risk")

golden <- function(group) jsonlite::fromJSON(file.path(golden_dir, paste0(group, ".json")), simplifyVector = FALSE)$rows
grow <- function(rows, id) { hit <- Filter(function(r) identical(r$id, id), rows); if (length(hit) != 1L) stop("golden row ", id, " not found", call. = FALSE); hit[[1]]$expect$pkg }
gp <- grow(golden("oracle-frontier"), "tauPath-cde-cap3")
g_from <- unlist(gp$tauFrom); g_to <- unlist(gp$tauTo); g_N <- unlist(gp$N); g_E <- unlist(gp$Ew)
g_grade <- lapply(gp$grade, function(z) as.integer(unlist(z)))
for (i in seq_along(rows)) {
  t <- taus[i]; k <- which(g_from < t & (t < g_to | (t == 0.5 & g_to == 0.5)))     # the last interval ends at tau = 1/2
  if (length(k) != 1L) stop("tau ", t, " is not inside exactly one interval of the enumerated tau path", call. = FALSE)
  if (!identical(rows[[i]]$grade, g_grade[[k]])) stop("tau ", t, ": HiGHS report differs from the enumerated optimum", call. = FALSE)
  enum_risk <- (g_E[k] + t * (M - g_N[k])) / M
  if (abs(rows[[i]]$risk - enum_risk) > 1e-12) stop(sprintf("tau %s: risk %.15g differs from the enumeration %.15g", t, rows[[i]]$risk, enum_risk), call. = FALSE)
  if (rows[[i]]$lower_bound > rows[[i]]$risk + 1e-12 || rows[[i]]$risk - rows[[i]]$lower_bound > 1e-8)
    stop(sprintf("tau %s: bound %.15g and risk %.15g are not within the solver tolerance", t, rows[[i]]$lower_bound, rows[[i]]$risk), call. = FALSE)
}
cat(sprintf("  ok  %d solves: each report and risk (to 1e-12) equal the enumerated optimum of all 523,251 reports with at most 3 grades\n", length(rows)))
go <- golden("oracle-optimize")
for (t in c(0.2, 0.45)) {
  ex <- grow(go, sprintf("exactOptimum-cde-cap3-tau.%s", sub("^0\\.", "", format(t, nsmall = 2))))
  r <- rows[[which(abs(taus - t) < 1e-12)]]
  expect_equal_num(r$risk, ex$risk, 1e-12, sprintf("tau %.2f row: risk = enumeration exactOptimum %.6f", t, ex$risk))
  expect_identical_val(r$grade, as.integer(unlist(ex$grade)), sprintf("tau %.2f row: grades = enumeration exactOptimum", t))
}
# Breakpoints: where the risk lines of consecutive distinct reports cross, tau* = (E_b - E_a) / (N_b - N_a).
key_of <- vapply(rows, function(r) paste(r$grade, collapse = ""), "")
first <- !duplicated(key_of); dist <- rows[first]
expect_identical_val(vapply(dist, `[[`, 0L, "N"), as.integer(g_N), "distinct reports on the path: N 0, 27, 45, 47 (the enumerated path, in order)")
bp <- vapply(seq_len(length(dist) - 1L), function(i) (dist[[i + 1]]$E - dist[[i]]$E) / (dist[[i + 1]]$N - dist[[i]]$N), 0)
expect_equal_num(bp, g_from[-1], 1e-12, "crossings of the solved reports = enumeration breakpoints .000162, .000263, .446")
expect_identical_val(vapply(dist, function(r) paste(r$sizes, collapse = "/"), ""), c("12", "9/3", "3/6/3", "4/5/3"), "reports along tau: all withheld, 9/3, 3/6/3, then 4/5/3")
for (i in seq_along(TAU_NAMED)) {
  side <- if (TAU_NAMED[i] < g_from[i + 1]) "below" else "above"
  cat(sprintf("  ok  named value %s lies %s the breakpoint %.15g\n", format(TAU_NAMED[i]), side, g_from[i + 1]))
}

# ---- the released file ---------------------------------------------------------------------------------------------
contract <- jsonlite::fromJSON(file.path(released_dir, "data_contract.json"), simplifyVector = FALSE)
cde_entry <- contract$files[["case-cde.json"]]
if (is.null(cde_entry)) stop("case-cde.json is not in the data contract; run r-export/21_export_cases.R first", call. = FALSE)
call_text <- paste0('postrank(pr_case_cde$input, weights = c(negative_chronic_absence = 1), tau = <tau>, G_max = 3L, level = 0.9, ',
                    'backend = "highs", control = postrank_control(time_limit = 30, threads = 1L, seed = 1304L), fragility = FALSE)')
CHANGES <- paste0("Changes: the 12-school teaching problem of postrank 1.1.0 (pr_case_cde$input, comparison probabilities from the case ",
                  "study's empirical-Bayes model) solved again with postrank 1.1.0 and the HiGHS backend (threads 1) at ", length(rows),
                  " values of tau with at most 3 grades; grade sizes, disclosures, expected wrong directions, risk, solver status, bound ",
                  "and gap per tau; numbers with 15 significant digits. No new model, data or statewide solve.")
w <- write_released(list(
  facts = list(n = n, M = M, criterion = ci$criterion_ids, weights = named(WEIGHTS), G_max = G_MAX, family = "at most 3 grades",
               objective = "weighted", interval_level = 0.9, backend = "highs", backend_version = backend_version,
               strategy = "staged", control = c(CONTROL, list(absolute_risk_gap = ctl$absolute_risk_gap, relative_gap = ctl$relative_gap)),
               call = call_text, tau_grid = col(TAU_GRID), tau_named = col(TAU_NAMED),
               tau_named_note = paste0("The three named values sit next to the breakpoints of the tau path (.00016 below .000162, .00026 below ",
                                       ".000263, .446 above .44596), so each shows the report on one side."),
               label = LABEL, breakpoints = col(bp),
               breakpoint_note = paste0("Crossings of the risk lines of consecutive distinct reports on the path, tau = (E_b - E_a) / (N_b - N_a). ",
                                        "They equal the breakpoints of the enumerated tau path over all 523,251 reports with at most 3 grades, ",
                                        "and every row's report equals the enumerated optimum."),
               ids = "arrays.grades.ids are the course labels A to L of case-cde tables.units (package order)."),
  tables = list(path = tbl(tau = taus, tau_source = tau_source, G = col_of("G", 0L), sizes = vapply(rows, function(r) paste(r$sizes, collapse = "/"), ""),
                           N = col_of("N", 0L), E = col_of("E", 0), E_over_N = col_of("E_over_N", 0), risk = col_of("risk", 0),
                           lower_bound = col_of("lower_bound", 0), gap = col_of("gap", 0), status = col_of("status", ""),
                           bound_source = col_of("bound_source", ""), result_label = rep(LABEL, length(rows)))),
  arrays = list(grades = list(ids = col(clab), grade = lapply(rows, function(r) col(r$grade))))),
  list(key = "cde-taupath", title = "California chronic absence: the tau path of the 12-school problem", level = "school",
       license_scope = "cde-source-conditions", attribution = cde_entry$attribution, change_notice = CHANGES, notice = cde_entry$notice,
       sources = list(list(object = "pr_case_cde", path = sprintf("%s data/pr_case_cde.rda", PKG), fields = "input (e, entity_ids, criterion_ids)"),
                      list(object = "postrank()", path = sprintf("%s postrank() with backend highs %s", PKG, backend_version), fields = "grades, risk, lower bound, gap, status")),
       upstream = list(source = cde_entry$upstream$source, terms = cde_entry$upstream$terms,
                       fields = I(c("tables.path.N", "tables.path.E", "tables.path.risk", "arrays.grades.grade"))),
       primary = "tables.path", runtime_asset = TRUE))
update_contract(list(`cde-taupath.json` = w$entry))

# keep the contract's registry section (update_contract() writes only the header, files and precomputed)
prx_case_registry_lib_only <- TRUE
source("r-export/22_case_registry.R")
rm(prx_case_registry_lib_only)
prx_write_registry_section()

# ---- read back ------------------------------------------------------------------------------------------------------
cat("read back:\n")
tp <- read_released("cde-taupath")
expect_identical_val(as.integer(tp$tables$path$N), vapply(rows, `[[`, 0L, "N"), "cde-taupath: N per tau")
expect_equal_num(tp$tables$path$risk, vapply(rows, `[[`, 0, "risk"), 1e-15, "cde-taupath: risk per tau")
expect_identical_val(unname(tp$arrays$grades$grade[which(abs(tp$tables$path$tau - 0.2) < 1e-12), ]), c(1L, 1L, 1L, 2L, 2L, 2L, 2L, 2L, 2L, 3L, 3L, 3L),
                     "cde-taupath: tau .20 grades 1/1/1/2/2/2/2/2/2/3/3/3")
expect_equal_num(risk_from(tp$arrays$grades$grade[which(abs(tp$tables$path$tau - 0.45) < 1e-12), ], read_released("case-cde")$arrays$error, 1, 0.45)$risk,
                 tp$tables$path$risk[abs(tp$tables$path$tau - 0.45) < 1e-12], 1e-13, "cde-taupath: tau .45 risk recomputed from the case-cde array")
cat("  tau        sizes   N        E          risk       bound      gap        status\n")
for (r in rows) cat(sprintf("  %-9s  %-6s  %2d  %.6g  %.6f  %.6f  %.3g  %s\n", format(r$tau), paste(r$sizes, collapse = "/"), r$N, r$E, r$risk, r$lower_bound, r$gap, r$status))
cat("23_cde_taupath: done\n")
