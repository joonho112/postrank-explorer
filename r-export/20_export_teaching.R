# Author: JoonHo Lee (jlee296@ua.edu)
# Released teaching summaries (data/released/) and the frozen simulated league (data/precomputed/league-30.json).
#   Rscript r-export/20_export_teaching.R
# Sources (read-only): postrank 1.1.0 from the project library: data/ (pr_tutorial, pr_example_gaussian,
# pr_example_draws, postrank_toy), the vignette m4 tie law (rebuilt with the vignette's constructor) and the cached
# analyses (tutorial_*, *_30x3, toy_*) read with load_or_compute() from the package's vignette reader.
# Only the fields the course pages show are written: grades, settings, evaluation (N, E, E/N, risk per criterion),
# status, bound, gap, own-best and cost tables, tau paths. Every file is compact JSON plus a classic-script twin
#   window.PRX_DATA = window.PRX_DATA || {}; window.PRX_DATA["<key>"] = <json>;
# and an entry in data/released/data_contract.json (written by update_contract() below; 21_export_cases.R adds the
# case entries). Numbers carry 15 significant digits; the undefined diagonal of a probability matrix is JSON null.
#
# The first part (down to "library mode") defines the writers and the contract; 21_export_cases.R sources this file
# with prx_export_lib_only <- TRUE to reuse them without rerunning the teaching export.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_rng.R")
load_postrank()
.libPaths(c(postrank_lib, .libPaths()))              # the vignette reader loads postrank through system.file()
`%||%` <- function(x, y) if (is.null(x)) y else x

precomputed_dir <- file.path(prx_root, "data", "precomputed")
PRX_SCHEMA <- "prx-released-1"
RUNTIME_MAX_BYTES <- 400000                          # CONTRACT 8.7: each runtime asset (the .js twin) <= 400 KB
GEOJSON_MAX_BYTES <- 150000                          # S-04: county polygons <= 150 KB
FORBIDDEN_FIELDS <- c("student", "pupil", "respondent", "person", "child")
FORBIDDEN_RIGHTS_KEYS <- c("cleared", "^rights$", "inclusion", "redistribution")
PKG <- "postrank 1.1.0"

# ---- JSON values ---------------------------------------------------------------------------------------------------
col <- function(x) { if (is.factor(x)) x <- as.character(x); I(unname(x)) }   # a column stays an array at length 1
tbl <- function(...) {                                                        # columnar table: list of equal-length columns
  cols <- list(...); n <- unique(lengths(cols))
  if (length(n) != 1L) stop("table columns differ in length: ", paste(names(cols), lengths(cols), collapse = ", "), call. = FALSE)
  lapply(cols, col)
}
df_tbl <- function(df, keep = names(df), drop_all_na = TRUE) {
  keep <- keep[vapply(df[keep], function(c) is.atomic(c) && !(drop_all_na && all(is.na(c))), TRUE)]
  do.call(tbl, lapply(df[keep], function(c) c))
}
# ErrorArray (engine/API.md): { ids, criteria, e: e[k][i][j] }, diagonal null; R arrays are n x n x K.
error_array <- function(e, ids, criteria) {
  stopifnot(length(dim(e)) == 3L, dim(e)[1] == length(ids), dim(e)[2] == length(ids), dim(e)[3] == length(criteria))
  list(ids = col(ids), criteria = col(criteria),
       e = lapply(seq_along(criteria), function(k) { m <- unname(e[, , k]); diag(m) <- NA; m }))
}
named <- function(x) if (is.null(x)) NULL else as.list(x)                      # named vector -> JSON object
json_text <- function(x) as.character(jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA, na = "null", null = "null"))

# Shipped strings: no vocabulary the course reserves for negations (CONTRACT 3.6) and no process ids (CONTRACT 2.6).
assert_clean_text <- function(x, where) {
  strings_of <- function(v) if (is.character(v)) as.character(v) else if (is.list(v)) unlist(lapply(v, strings_of), use.names = FALSE) else character(0)
  s <- strings_of(x)
  bad <- s[grepl("certif|guarant|\\bprov(e|es|ed|en|ing)\\b|no error|\\b(SR|AM|AC|CR|RD|BD)-[0-9]|Step [0-9]+\\.[0-9]|generated[[:space:]]by", s, ignore.case = TRUE)]
  if (length(bad)) stop(where, ": reserved or process wording in a shipped string: ", bad[1], call. = FALSE)
  invisible(TRUE)
}

# ---- the structure of a released file (mirrored by verification/check_data_contract.mjs) ---------------------------
shape_of <- function(x) if (is.list(x) && is.null(names(x))) { if (!length(x)) 0L else c(length(x), shape_of(x[[1]])) } else integer(0)
structure_of <- function(o, prefix = "") {
  out <- list()
  if (!is.null(o$features)) {
    f <- o$features
    out[["features"]] <- list(kind = "features", fields = I(names(f[[1]]$properties)), rows = length(f),
                              geometry = I(unique(vapply(f, function(z) z$geometry$type, ""))))
  }
  if (!is.null(o$facts)) out[[paste0(prefix, "facts")]] <- list(kind = "facts", fields = I(names(o$facts)))
  for (t in names(o$tables)) out[[paste0(prefix, "tables.", t)]] <- list(kind = "table", fields = I(names(o$tables[[t]])),
                                                                          rows = length(o$tables[[t]][[1]]))
  for (a in names(o$arrays)) {
    m <- o$arrays[[a]]; sh <- list()
    for (nm in names(m)) if (is.list(m[[nm]]) && is.null(names(m[[nm]]))) sh[[nm]] <- I(shape_of(m[[nm]]))
    out[[paste0(prefix, "arrays.", a)]] <- list(kind = "array", members = sh)
  }
  for (k in names(o$analyses)) out <- c(out, structure_of(o$analyses[[k]], paste0(prefix, "analyses.", k, ".")))
  out
}
keys_of <- function(x) if (is.list(x)) c(names(x)[nzchar(names(x) %||% character(0))], unlist(lapply(x, keys_of), use.names = FALSE)) else character(0)

# ---- writing one released file -------------------------------------------------------------------------------------
# meta: key, title, level, license_scope, attribution, change_notice, notice, sources (list of {object, path}),
#       upstream (NULL for author scope: {source, terms, fields = structure paths}), primary (structure path),
#       runtime_asset (TRUE for case arrays and geometry).
twin_text <- function(key, txt) sprintf('window.PRX_DATA = window.PRX_DATA || {};\nwindow.PRX_DATA["%s"] = %s;', key, txt)
write_released <- function(body, meta, dir = released_dir, twin = TRUE) {
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  head <- list(key = meta$key, schema = PRX_SCHEMA, title = meta$title, level = meta$level, license_scope = meta$license_scope,
               attribution = meta$attribution, change_notice = meta$change_notice, notice = meta$notice)
  obj <- c(head, body)
  assert_clean_text(obj, meta$key)
  bad <- unique(keys_of(obj)); bad <- bad[grepl(paste(c(FORBIDDEN_FIELDS, FORBIDDEN_RIGHTS_KEYS), collapse = "|"), bad, ignore.case = TRUE)]
  if (length(bad)) stop(meta$key, ": forbidden key ", bad[1], call. = FALSE)
  txt <- json_text(obj)
  path <- file.path(dir, paste0(meta$key, ".json"))
  writeLines(txt, path, useBytes = TRUE)
  back <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  st <- structure_of(back)
  if (is.null(st[[meta$primary]])) stop(meta$key, ": primary ", meta$primary, " not in the file", call. = FALSE)
  for (u in meta$upstream$fields) {
    p <- sub("\\.[^.]+$", "", u); f <- sub("^.*\\.", "", u)
    s <- st[[p]]; ok <- !is.null(s) && (f %in% unlist(s$fields) || f %in% names(s$members) || (p == "features" && f == "geometry"))
    if (!ok) stop(meta$key, ": upstream field ", u, " is not in the file", call. = FALSE)
  }
  entry <- list(key = meta$key, path = file.path("data", basename(dir), basename(path)), title = meta$title, level = meta$level,
                runtime_asset = isTRUE(meta$runtime_asset), license_scope = meta$license_scope,
                attribution = meta$attribution, change_notice = meta$change_notice, notice = meta$notice,
                sources = meta$sources, upstream = meta$upstream,
                primary = meta$primary, fields = st[[meta$primary]]$fields, rows = st[[meta$primary]]$rows,
                structure = st, sha256 = sha256_file(path), bytes = file.size(path))
  if (twin) {
    tpath <- sub("\\.json$", ".js", path)
    writeLines(twin_text(meta$key, txt), tpath, useBytes = TRUE)
    entry$twin <- file.path("data", basename(dir), basename(tpath)); entry$twin_sha256 <- sha256_file(tpath); entry$twin_bytes <- file.size(tpath)
    if (isTRUE(meta$runtime_asset) && entry$twin_bytes > RUNTIME_MAX_BYTES)
      stop(sprintf("%s: runtime asset %d bytes > %d", meta$key, entry$twin_bytes, RUNTIME_MAX_BYTES), call. = FALSE)
  }
  if (is.null(entry$upstream)) entry$upstream <- NULL
  cat(sprintf("  %-22s %8d bytes  %-22s %s %d\n", basename(path), entry$bytes, meta$license_scope, meta$primary, entry$rows))
  invisible(list(entry = entry, path = path, json = back))
}

# ---- the data contract ---------------------------------------------------------------------------------------------
LICENSE_SCOPES <- list(
  `author` = list(meaning = "The whole file is the author's own output (synthetic inputs or results computed from them).",
                  licence = "CC BY 4.0 (site data licence, LICENSE-DATA)", required_notice = I(c("CC BY 4.0"))),
  `cde-source-conditions` = list(meaning = "Derived from California Department of Education data; CDE's source conditions apply; not relicensed.",
                  licence = "CDE source conditions (https://www.cde.ca.gov/re/di/cr/index.asp); no Creative Commons or code licence is substituted",
                  required_notice = I(c("California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26",
                                        "https://www.cde.ca.gov/re/di/cr/index.asp", "No CDE endorsement is implied"))),
  `cc-by-nc-krw` = list(meaning = "Derived from the Kline, Rose and Walters (2024) replication deposit; noncommercial.",
                  licence = "CC-BY-NC as stated by the deposit README (no version stated)",
                  required_notice = I(c("Kline, Rose and Walters (2024)", "doi:10.1257/aer.20230700", "doi:10.3886/E198284V1", "CC-BY-NC",
                                        "Noncommercial", "No endorsement"))),
  `cc-by-4.0-atlas` = list(meaning = "Derived from the Opportunity Atlas replication data.",
                  licence = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
                  required_notice = I(c("Chetty, Friedman, Hendren, Jones and Porter (2022)", "doi:10.7910/DVN/NKCQM1", "CC BY 4.0", "No endorsement"))),
  `public-domain-census` = list(meaning = "U.S. Census Bureau geometry, a U.S. federal government work (public domain, 17 U.S.C. 105).",
                  licence = "public domain; source line kept as good practice",
                  required_notice = I(c("U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20m), via usmapdata 1.1.0")))
)
contract_header <- function() list(
  schema = "postrank Explorer data contract v1",
  package = PKG,
  r_version = paste(R.version$major, R.version$minor, sep = "."),
  licence = "Code MIT; text and figures CC BY 4.0; data per file through license_scope (author files CC BY 4.0, other scopes keep their source conditions).",
  precision = "Summaries carry 15 significant digits; toy-joint-draws preserves original source doubles with 17-digit serialization. Undefined probability diagonals are null.",
  file_format = "Compact JSON; tables are columnar (column name -> array); ErrorArray = { ids, criteria, e[k][i][j] } with e = Pr(theta_ik <= theta_jk | Y).",
  twin_format = 'window.PRX_DATA = window.PRX_DATA || {}; window.PRX_DATA["<key>"] = <json>;',
  contract_twin_omits = I("created"),
  runtime_asset_max_bytes = RUNTIME_MAX_BYTES,
  geojson_max_bytes = GEOJSON_MAX_BYTES,
  forbidden_field_patterns = I(FORBIDDEN_FIELDS),
  forbidden_rights_key_patterns = I(FORBIDDEN_RIGHTS_KEYS),
  license_scopes = LICENSE_SCOPES
)
# Entries are merged by file name, so the two export scripts may run in either order; files are sorted (radix).
update_contract <- function(entries = list(), precomputed = list()) {
  path <- file.path(released_dir, "data_contract.json")
  old <- if (file.exists(path)) jsonlite::fromJSON(path, simplifyVector = FALSE) else list()
  merge <- function(a, b) { a <- a %||% list(); for (nm in names(b)) a[[nm]] <- b[[nm]]; a[sort(names(a), method = "radix")] }
  files <- merge(old$files, entries); pre <- merge(old$precomputed, precomputed)
  # drop entries whose file no longer exists
  files <- files[vapply(names(files), function(f) file.exists(file.path(released_dir, f)), TRUE)]
  pre <- pre[vapply(names(pre), function(f) file.exists(file.path(precomputed_dir, f)), TRUE)]
  body <- c(contract_header(), list(files = files, precomputed = pre))
  if (!is.null(old$registry)) body$registry <- old$registry  # written by 22_case_registry.R; carried over
  full <- c(list(created = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")), body)
  writeLines(as.character(jsonlite::toJSON(full, auto_unbox = TRUE, digits = NA, na = "null", null = "null", pretty = TRUE)), path, useBytes = TRUE)
  writeLines(twin_text("data-contract", json_text(body)), sub("\\.json$", ".js", path), useBytes = TRUE)
  invisible(path)
}

# ---- reading back --------------------------------------------------------------------------------------------------
read_released <- function(key, dir = released_dir) jsonlite::fromJSON(file.path(dir, paste0(key, ".json")), simplifyVector = TRUE)
# risk of a grade vector from an exported ErrorArray (e parsed as K x n x n), base R
risk_from <- function(g, ea, w, tau) {
  e <- ea$e; n <- length(g); M <- n * (n - 1) / 2; st <- outer(g, g, "<")
  E <- vapply(seq_len(dim(e)[1]), function(k) sum(e[k, , ][st]), 0)
  list(N = sum(st), E = E, EoverN = if (sum(st)) E / sum(st) else rep(NA, length(E)), risk = (sum(w * E) + tau * (M - sum(st))) / M)
}
expect_equal_num <- function(got, want, tol, label) {
  got <- as.numeric(unlist(got)); want <- as.numeric(unlist(want))
  if (length(got) != length(want) || any(is.na(got) != is.na(want)) || max(c(0, abs(got - want)), na.rm = TRUE) > tol)
    stop(sprintf("check failed: %s (got %s, want %s)", label, paste(signif(got, 10), collapse = "/"), paste(signif(want, 10), collapse = "/")), call. = FALSE)
  cat(sprintf("  ok  %s\n", label)); invisible(TRUE)
}
expect_identical_val <- function(got, want, label) {
  if (!identical(got, want)) stop(sprintf("check failed: %s (got %s, want %s)", label, paste(got, collapse = "/"), paste(want, collapse = "/")), call. = FALSE)
  cat(sprintf("  ok  %s\n", label)); invisible(TRUE)
}
sizes_of <- function(g) as.integer(table(factor(g, levels = seq_len(max(g)))))

# ---- cached analyses ------------------------------------------------------------------------------------------------
source(system.file("scripts", "_vignette-setup.R", package = "postrank", mustWork = TRUE), local = TRUE)
cache_manifest <- jsonlite::read_json(system.file("extdata", "manifests", "cache-manifest.json", package = "postrank", mustWork = TRUE))
cache_source <- function(key) {
  rec <- cache_manifest$assets[[key]]
  list(object = key, path = paste0("inst/", rec$file), reader = sprintf('load_or_compute("%s")', key), call = rec$call,
       backend = rec$backend, backend_version = rec$backend_version %||% NA, rds_sha256 = rec$sha256)
}
settings_facts <- function(s) list(tau = s$tau, G_max = s$G_max, exact_G = s$exact_G, q = named(s$q), objective = s$objective,
                                   weights = named(s$weights))
summ_analysis <- function(a, key) {
  ids <- a$pairwise$entity_ids; g <- get_grades(a); stopifnot(identical(names(g), ids)); g <- unname(g)
  r <- get_risk(a); p <- get_profile(a); ev <- a$evaluation
  stopifnot(identical(as.integer(ev$N), sum(outer(g, g, "<"))), isTRUE(all.equal(r$risk, ev$primary_risk)))
  list(source = cache_source(key),
       facts = c(list(class = "postrank_analysis"), settings_facts(a$settings),
                 list(n = length(ids), M = ev$M, N = ev$N, G = ev$G, sizes = col(sizes_of(g)), disclosure_rate = ev$disclosure_rate,
                      risk = r$risk, lower_bound = r$lower_bound, gap = r$gap, status = r$status,
                      bound_source = a$fit$objective$bound_source %||% NA)),
       tables = list(units = tbl(id = ids, grade = g),
                     profile = tbl(criterion = p$criterion, weight = p$weight, E = p$E, E_over_M = p$E_over_M,
                                   E_over_N = p$E_over_N, risk = p$risk)))
}
summ_frontier <- function(f, key) list(source = cache_source(key),
  facts = list(class = "postrank_frontier", G_max = f$G_max, exact_G = f$exact_G, q = named(f$q), objective = f$objective,
               weights = named(f$weights), backend = f$backend),
  tables = list(path = df_tbl(f$table, setdiff(names(f$table), c("relation_identity", "q_value")))))
summ_commonality <- function(c1, key) list(source = cache_source(key),
  facts = c(list(class = "postrank_commonality_cost"), settings_facts(c1$settings), list(protection = c1$protection)),
  tables = list(costs = df_tbl(c1$table)))
summ_sensitivity <- function(s, key) {
  gr <- s$grades; ids <- rownames(gr)
  list(source = cache_source(key),
       facts = list(class = "postrank_sensitivity", reference_id = s$reference_id),
       tables = list(grid = df_tbl(s$grid, setdiff(names(s$grid), c("settings", "objective", "minimax_refine"))),
                     results = df_tbl(s$table),
                     grades = do.call(tbl, c(list(id = ids), lapply(setNames(colnames(gr), colnames(gr)), function(k) unname(gr[, k])))),
                     changes = df_tbl(s$changes)))
}
summ_comparison <- function(cmp, key) {
  gr <- cmp$grades; ids <- rownames(gr)
  list(source = cache_source(key),
       facts = c(list(class = "postrank_comparison", reference = cmp$reference), settings_facts(cmp$settings)),
       tables = list(methods = df_tbl(cmp$table),
                     relations = df_tbl(cmp$relations),
                     grades = do.call(tbl, c(list(id = ids), lapply(setNames(colnames(gr), colnames(gr)), function(k) unname(gr[, k]))))))
}
summ_crossfit <- function(cf, key) {
  fd <- cf$folds
  list(source = cache_source(key),
       facts = c(list(class = "postrank_crossfit"), settings_facts(cf$settings),
                 list(split = cf$split$method, split_sizes = col(unname(cf$split$sizes)), agreement = as.list(unlist(cf$agreement)),
                      folds_with_incumbent = cf$folds_with_incumbent, mean_optimism = cf$mean_optimism,
                      mean_abs_optimism = cf$mean_abs_optimism)),
       tables = list(folds = tbl(fold = vapply(fd, `[[`, "", "fold"), draws = vapply(fd, `[[`, 0L, "draws"),
                                 status = vapply(fd, `[[`, "", "status"), G = vapply(fd, `[[`, 0L, "G"),
                                 in_fold_risk = vapply(fd, `[[`, 0, "in_fold_risk"), out_of_fold_risk = vapply(fd, `[[`, 0, "out_of_fold_risk"),
                                 optimism = vapply(fd, `[[`, 0, "optimism")),
                     fold_grades = do.call(tbl, c(list(id = names(fd[[1]]$grade)), lapply(fd, function(z) unname(z$grade))))))
}
summ_fit <- function(m, key) {
  g <- get_grades(m); ids <- names(g); g <- unname(g); r <- get_risk(m); p <- get_profile(m); ev <- m$evaluation
  list(source = cache_source(key),
       facts = c(list(class = "postrank_fit"), settings_facts(m$settings),
                 list(minimax_criteria = col(m$settings$minimax_criteria), minimax_refine = m$settings$minimax_refine,
                      n = length(ids), M = ev$M, N = ev$N, G = ev$G, sizes = col(sizes_of(g)), weighted_risk = ev$weighted_risk,
                      minimax_risk = ev$minimax_risk, risk = r$risk, lower_bound = r$lower_bound, gap = r$gap, status = r$status)),
       tables = list(units = tbl(id = ids, grade = g),
                     profile = tbl(criterion = p$criterion, weight = p$weight, E = p$E, E_over_M = p$E_over_M, E_over_N = p$E_over_N,
                                   risk = p$risk, is_minimax_max = p$is_minimax_max)))
}
summarize_cache <- function(key) {
  a <- load_or_compute(key)
  if (inherits(a, "postrank_analysis")) summ_analysis(a, key)
  else if (inherits(a, "postrank_frontier")) summ_frontier(a, key)
  else if (inherits(a, "postrank_commonality_cost")) summ_commonality(a, key)
  else if (inherits(a, "postrank_sensitivity")) summ_sensitivity(a, key)
  else if (inherits(a, "postrank_comparison")) summ_comparison(a, key)
  else if (inherits(a, "postrank_crossfit")) summ_crossfit(a, key)
  else if (inherits(a, "postrank_fit")) summ_fit(a, key)
  else stop("no summarizer for ", key, " (", class(a)[1], ")", call. = FALSE)
}
cache_index <- function(keys, an) tbl(cache_key = keys, class = vapply(an, function(z) z$facts$class, ""),
                                      path = vapply(an, function(z) z$source$path, ""), rds_sha256 = vapply(an, function(z) z$source$rds_sha256, ""))

# ---- notices --------------------------------------------------------------------------------------------------------
AUTHOR_ATTRIBUTION <- "Synthetic teaching data and results from the postrank 1.1.0 R package (JoonHo Lee; package code MIT). Site data licence CC BY 4.0."
AUTHOR_NOTICE <- "Synthetic: no real units, observations or fitted models. Data licence CC BY 4.0."
AUTHOR_CHANGES <- "Extracted from postrank 1.1.0 (data objects and cached analyses read with load_or_compute()); only the fields the course shows; numbers with 15 significant digits."
author_meta <- function(key, title, primary, sources, changes = AUTHOR_CHANGES, attribution = AUTHOR_ATTRIBUTION) list(key = key, title = title, level = "synthetic",
  license_scope = "author", attribution = attribution, change_notice = changes, notice = AUTHOR_NOTICE, sources = sources,
  upstream = NULL, primary = primary, runtime_asset = FALSE)
data_src <- function(obj) list(object = obj, path = sprintf("%s data/%s.rda", PKG, obj))

if (exists("prx_export_lib_only") && isTRUE(prx_export_lib_only)) {
  # library mode (sourced by 21_export_cases.R): definitions only
} else {
# =====================================================================================================================
cat("20_export_teaching: data/released (teaching) and data/precomputed/league-30.json\n")
entries <- list()
keep <- function(w) { entries[[basename(w$path)]] <<- w$entry; invisible(w) }
env <- new.env()
utils::data(list = c("pr_tutorial", "pr_example_gaussian", "pr_example_draws", "postrank_toy"), package = "postrank", envir = env)

# ---- six sites (pr_tutorial) ---------------------------------------------------------------------------------------
tu <- env$pr_tutorial
ids6 <- tu$units$entity_id
stopifnot(identical(ids6, tu$one$entity_ids), identical(ids6, tu$two$entity_ids), identical(tu$two$criterion_ids, c("score_A", "score_B")),
          identical(unname(tu$one$e[, , 1]), unname(tu$two$e[, , 1])), identical(unname(tu$law$means), unname(tu$two$means)))
sd6 <- sqrt(t(apply(tu$law$covariance, 3, diag)))                        # 6 x 2, SD .20 each
keep(write_released(list(
  facts = list(description = tu$law$description, conditioning = tu$law$conditioning, direction = tu$law$direction,
               units = tu$law$units, n = length(ids6), M = choose(length(ids6), 2), criteria = col(tu$two$criterion_ids)),
  tables = list(units = tbl(id = ids6, label = tu$units$label, mean_A = tu$law$means[, 1], sd_A = sd6[, 1],
                            mean_B = tu$law$means[, 2], sd_B = sd6[, 2])),
  arrays = list(one = error_array(tu$one$e, ids6, tu$one$criterion_ids), two = error_array(tu$two$e, ids6, tu$two$criterion_ids))),
  author_meta("six-sites", "Six fictional sites: Gaussian law and error arrays for scores A and B", "tables.units",
              list(c(data_src("pr_tutorial"), fields = "units, law (means, covariance), one$e, two$e")))))

# ---- thirty sites: the known Gaussian law (pr_example_gaussian) -------------------------------------------------------
eg <- env$pr_example_gaussian; ids30 <- eg$entity_ids; k3 <- eg$criterion_ids
stopifnot(identical(k3, c("poverty", "frl", "snap")), identical(dim(eg$e), c(30L, 30L, 3L)))
sd30 <- sqrt(t(apply(eg$source$covariance, 3, diag)))
gcols <- list(id = ids30); for (k in seq_along(k3)) { gcols[[paste0("mean_", k3[k])]] <- eg$means[, k]; gcols[[paste0("sd_", k3[k])]] <- sd30[, k] }
keep(write_released(list(
  facts = list(description = "Known Gaussian posterior for 30 fictional sites and three criteria (larger values have higher priority); sites independent, criteria correlated within a site.",
               n = 30L, M = choose(30, 2), criteria = col(k3)),
  tables = list(units = do.call(tbl, gcols)),
  arrays = list(gaussian = error_array(eg$e, ids30, k3))),
  author_meta("thirty-sites", "Thirty fictional sites: known Gaussian law and its error array", "tables.units",
              list(c(data_src("pr_example_gaussian"), fields = "means, source$covariance (diagonal), e")))))

# ---- thirty sites: summaries of the 4,000 joint draws (pr_example_draws) ---------------------------------------------
ed <- env$pr_example_draws; dv <- ed$joint_draws$tensor$values          # draws x sites x criteria
stopifnot(identical(dim(dv), c(4000L, 30L, 3L)), identical(ed$entity_ids, ids30), identical(ed$criterion_ids, k3))
a30 <- load_or_compute("analysis_30x3")
stopifnot(identical(a30$pairwise$entity_ids, ids30), identical(a30$pairwise$criterion_ids, k3))
dcols <- list(id = ids30)
for (k in seq_along(k3)) {
  x <- dv[, , k]
  dcols[[paste0("mean_", k3[k])]] <- colMeans(x); dcols[[paste0("sd_", k3[k])]] <- apply(x, 2, stats::sd)
  dcols[[paste0("q05_", k3[k])]] <- apply(x, 2, stats::quantile, 0.05, names = FALSE)
  dcols[[paste0("q95_", k3[k])]] <- apply(x, 2, stats::quantile, 0.95, names = FALSE)
}
keep(write_released(list(
  facts = list(description = "Summaries of 4,000 equal-weight joint posterior draws for the thirty fictional sites, drawn from the known Gaussian law; the error array is the share of draws with theta_i <= theta_j.",
               draws = 4000L, n = 30L, M = choose(30, 2), criteria = col(k3), quantiles = "R quantile type 7 at .05 and .95"),
  tables = list(units = do.call(tbl, dcols)),
  arrays = list(draws = error_array(a30$pairwise$e, ids30, k3))),
  author_meta("thirty-draws", "Thirty fictional sites: summaries of 4,000 posterior draws", "tables.units",
              list(c(data_src("pr_example_draws"), fields = "joint_draws$tensor (summaries only)"),
                   list(object = "analysis_30x3", path = "inst/extdata/cached/analysis_30x3.rds", fields = "pairwise$e (draw error array)")))))

# ---- the package toy (postrank_toy) ----------------------------------------------------------------------------------
ty <- env$postrank_toy; tv <- ty$joint_draws$tensor$values; tids <- ty$entity_ids; tks <- ty$criterion_ids
ta <- load_or_compute("toy_analysis"); stopifnot(identical(ta$pairwise$entity_ids, tids), identical(dim(tv), c(32L, 3L, 2L)))
tcols <- list(id = tids)
for (k in seq_along(tks)) { tcols[[paste0("mean_", tks[k])]] <- colMeans(tv[, , k]); tcols[[paste0("sd_", tks[k])]] <- apply(tv[, , k], 2, stats::sd) }
keep(write_released(list(
  facts = list(description = "The package's toy input: a declared Normal target law (SD .6, fixed means) with 32 equal-weight joint draws; software illustration, not empirical evidence.",
               draws = 32L, seed = 20261019L, n = 3L, M = 3L, criteria = col(tks)),
  tables = list(units = do.call(tbl, tcols)),
  arrays = list(draws = error_array(ta$pairwise$e, tids, tks))),
  author_meta("toy", "The package toy: three entities, two criteria, 32 draws", "tables.units",
              list(c(data_src("postrank_toy"), fields = "joint_draws$tensor (summaries only)"),
                   list(object = "toy_analysis", path = "inst/extdata/cached/toy_analysis.rds", fields = "pairwise$e")))))

# ---- the vignette m4 tie law -----------------------------------------------------------------------------------------
m4_finite_input <- function(states, masses, description) {             # vignette m4 constructor, fixed timestamp
  ids <- rownames(states[[1]]); criteria <- colnames(states[[1]])
  as_postrank_tie_draws(list(
    schema_version = "tie-aware-input-0.1", input_kind = "exact_finite_posterior", dependence_mode = "joint_model",
    requested_functional = "expected_rank_loss", entity_ids = ids, criterion_ids = criteria,
    targets = lapply(criteria, function(k) list(criterion_id = k, estimand = paste("Specified", k, "target"),
      entity_population = "Fictional entities in the displayed law", time_reference = "No observation period; mathematical example",
      units = "Illustrative score units", source_transform = "Identity", identification_basis = "Defined by the complete listed states",
      orientation = "higher_priority")),
    context = list(cohort_id = "m4-example", data_version = "1", data_conditioning = "No observations; the listed law is stipulated",
                   model_summary = description),
    identification = list(status = "identified_declared", note = "The mathematical targets are specified, not empirically identified"),
    tie_policy = list(rule = "equality_neutral", declared = TRUE, justification = "Equality in a listed state is genuine target equality",
                      observed_tie_action = "accept_declared_exact_equality"),
    provenance = list(producer = "M4 vignette", artifact_id = "specified-law", artifact_hash = digest::digest(list(states, masses), algo = "sha256"),
                      construction_note = "Complete finite law; no sampling or rounding", created_at = "2026-10-30T00:00:00Z"),
    equality = list(basis = "exact_finite_law", justification = "Check equality over every positive-mass state", criterion_classes = NULL),
    finite_law = list(denominator = sum(masses), value_representation = "safe_integer",
      states = lapply(seq_along(states), function(s) list(state_id = paste0("state-", s), mass_numerator = masses[s], theta = states[[s]])),
      law_definition = description, not_empirical_posterior_relabeling = TRUE)))
}
m4_states <- lapply(c(0, 1, 2), function(a) matrix(c(a, 1), nrow = 2, dimnames = list(entity = c("A", "B"), criterion = "score")))
m4_masses <- c(1L, 4L, 5L); m4_desc <- "B is 1; A is 0, 1, or 2 with masses 1/10, 4/10, 5/10"
m4_pw <- postrank_tie_pairwise(m4_finite_input(m4_states, m4_masses, m4_desc))
m4_tau <- 0.25
m4_actions <- list(`A above B` = c(A = 1L, B = 2L), `B above A` = c(A = 2L, B = 1L), withhold = c(A = 1L, B = 1L))
m4_eval <- lapply(m4_actions, postrank_tie_evaluate, pairwise = m4_pw, weights = c(score = 1), tau = m4_tau)
m4_p <- m4_masses / sum(m4_masses); m4_A <- c(0, 1, 2)
m4_weak <- c(sum(m4_p * (m4_A <= 1)), sum(m4_p * (1 <= m4_A)), m4_tau)          # weak loss: ties count as wrong
tie_cube <- function(x) lapply(seq_len(dim(x)[3]), function(k) { m <- unname(x[, , k]); diag(m) <- NA; m })
keep(write_released(list(
  facts = list(description = paste0(m4_desc, " (a complete finite law, not a sample)."), tau = m4_tau, n = 2L, M = 1L,
               loss = "Weak loss counts an equal pair as wrong; equality-neutral loss counts it as neither (risk = (E_w + tau (T - D)) / M, R0 = tau T / M)."),
  tables = list(states = tbl(state = 1:3, A = m4_A, B = c(1, 1, 1), mass = m4_masses, probability = m4_p),
                actions = tbl(action = names(m4_actions), grade_A = vapply(m4_actions, `[[`, 0L, "A"), grade_B = vapply(m4_actions, `[[`, 0L, "B"),
                              weak_risk = m4_weak, neutral_risk = vapply(m4_eval, `[[`, 0, "primary_risk"),
                              R0 = vapply(m4_eval, `[[`, 0, "R0"), N = vapply(m4_eval, function(v) as.numeric(v$N), 0),
                              D = vapply(m4_eval, function(v) as.numeric(v$D), 0), T = vapply(m4_eval, function(v) as.numeric(v$T), 0),
                              E_over_N = vapply(m4_eval, function(v) unname(v$E_over_N)[1], 0),
                              E_over_D = vapply(m4_eval, function(v) unname(v$E_over_D)[1], 0))),
  arrays = list(tie = list(ids = col(m4_pw$entity_ids), criteria = col(m4_pw$criterion_ids),
                           b = tie_cube(m4_pw$b), t = tie_cube(m4_pw$t), d = tie_cube(m4_pw$d)))),
  author_meta("m4-tie-law", "The vignette m4 tie law: two units with a latent tie", "tables.states",
              list(list(object = "vignette m4 law", path = sprintf("%s vignettes/m4-ties-and-withholding.Rmd (states, masses)", PKG),
                        fields = "postrank_tie_pairwise() b, t, d; postrank_tie_evaluate() at tau = .25")),
              changes = "Rebuilt with the vignette's constructor and evaluated with postrank 1.1.0 (postrank_tie_pairwise, postrank_tie_evaluate); weak-loss risks computed from the listed law; numbers with 15 significant digits.")))

# ---- cached analyses -------------------------------------------------------------------------------------------------
write_cache_group <- function(key, title, keys) {
  an <- setNames(lapply(keys, summarize_cache), keys)
  keep(write_released(list(tables = list(index = cache_index(keys, an)), analyses = an),
                      author_meta(key, title, "tables.index", lapply(keys, function(k) list(object = k, path = cache_source(k)$path, reader = cache_source(k)$reader)))))
}
write_cache_group("cache-tutorial", "Cached analyses for the six sites", c("tutorial_one", "tutorial_two", "tutorial_frontier", "tutorial_commonality", "tutorial_sensitivity"))
write_cache_group("cache-30x3", "Cached analyses for the thirty sites", c("analysis_30x3", "analysis_30x3_tau35", "gaussian_analysis_30x3", "commonality_30x3",
                  "commonality_30x3_tau35", "comparison_30x3", "comparison_30x3_tau35", "frontier_30x3"))
write_cache_group("cache-toy", "Cached analyses for the package toy", c("toy_analysis", "toy_commonality", "toy_crossfit", "toy_frontier", "toy_minimax"))

# ---- the frozen simulated league (engine/API.md "Simulated league specification") --------------------------------------
LEAGUE_SEED <- 20261030
i30 <- 1:30
lg_size <- rep(c(16, 64, 256), 10); lg_group <- rep(c("small", "medium", "large"), 10); lg_se <- 0.8 / sqrt(lg_size)
lg_rank <- (19 * i30) %% 31; lg_theta <- 0.15 * qnorm((lg_rank - 0.5) / 30)
lg_est <- lg_theta + lg_se * prx_normals(LEAGUE_SEED, 30)
stopifnot(identical(sort(lg_rank), as.numeric(1:30)), identical(unique(lg_se), c(0.2, 0.1, 0.05)))
golden_sim <- jsonlite::fromJSON(file.path(golden_dir, "oracle-simulate.json"), simplifyVector = FALSE)$rows
golden_row <- function(id) Filter(function(r) identical(r$id, id), golden_sim)[[1]]$expect
g_theta <- unlist(golden_row("league30")$theta); g_draw <- unlist(golden_row("drawLeague-seed20261030")$estimate)
league_dir <- file.path(precomputed_dir, "_new"); unlink(league_dir, recursive = TRUE)
lw <- write_released(list(
  facts = list(seed = LEAGUE_SEED, n = 30L,
               specification = "Units U01 to U30; size cycles 16, 64, 256 from U01 (groups small, medium, large); SE = 0.8 / sqrt(size); rank r_i = (19 i) mod 31; theta_i = .15 qnorm((r_i - .5) / 30); estimate_i = theta_i + SE_i z_i with z = normals(seed, 30) in unit order.",
               stream = "mulberry32 uniforms (x + 0.5) / 2^32; Box-Muller normals, cos first, sin cached (engine/README.md)",
               teaching_posterior = "normal-normal, prior mean 0, prior SD .15 (default): shrink B_i = .15^2 / (.15^2 + SE_i^2)"),
  tables = list(units = tbl(id = sprintf("U%02d", i30), size = lg_size, group = lg_group, se = lg_se, theta = lg_theta, rank = lg_rank,
                            estimate = lg_est))),
  author_meta("league-30", "The simulated league of 30 units: truth and the frozen estimates for seed 20261030", "tables.units",
              list(list(object = "simulated league", path = "engine/API.md (Simulated league specification); r-export/_rng.R (seeded stream)")),
              changes = "Computed from the course's league specification and seeded stream; frozen once; numbers with 15 significant digits.",
              attribution = "Synthetic league computed for postrank Explorer (JoonHo Lee). Site data licence CC BY 4.0."),
  dir = league_dir, twin = FALSE)
lj <- lw$json$tables$units
expect_equal_num(unlist(lj$theta), g_theta, 1e-15, "league theta = oracle-simulate league30")
expect_equal_num(unlist(lj$estimate), g_draw, 1e-15, "league estimates = oracle-simulate drawLeague-seed20261030")
frozen <- file.path(precomputed_dir, "league-30.json")
if (file.exists(frozen) && !identical(readLines(frozen), readLines(lw$path))) {
  if (!identical(Sys.getenv("PRX_REFREEZE_LEAGUE"), "true")) {
    unlink(league_dir, recursive = TRUE)
    stop("data/precomputed/league-30.json differs from a fresh draw; it is frozen (CONTRACT 7.5). Set PRX_REFREEZE_LEAGUE=true only to refreeze on purpose.", call. = FALSE)
  }
  cat("  league-30.json refrozen (PRX_REFREEZE_LEAGUE=true)\n")
}
if (!file.exists(frozen) || !identical(readLines(frozen), readLines(lw$path))) file.copy(lw$path, frozen, overwrite = TRUE)
unlink(league_dir, recursive = TRUE)
lw$entry$path <- "data/precomputed/league-30.json"; lw$entry$sha256 <- sha256_file(frozen); lw$entry$bytes <- file.size(frozen)

update_contract(entries, list(`league-30.json` = lw$entry))

# ---- package documentation values, read back from the exported files ---------------------------------------------------
cat("checks (read back from data/released):\n")
ct <- read_released("cache-tutorial")$analyses; six <- read_released("six-sites")
t1 <- ct$tutorial_one
expect_identical_val(as.integer(t1$tables$units$grade), c(1L, 1L, 2L, 2L, 3L, 3L), "six sites: tutorial_one grades 1/1/2/2/3/3")
expect_equal_num(round(t1$facts$risk, 4), 0.0417, 0, "six sites: tutorial_one risk .0417 at tau = .20, at most 3 grades")
expect_identical_val(c(t1$facts$tau, t1$facts$G_max, t1$facts$N, t1$facts$M), c(0.2, 3, 12, 15), "six sites: tutorial_one tau .20, cap 3, N 12 of 15")
expect_equal_num(round(t1$tables$profile$E_over_N, 5), 0.00206, 0, "six sites: tutorial_one E/N .00206")
tc <- ct$tutorial_commonality$tables$costs
expect_equal_num(round(tc$cost_lower, 4), c(0.0490, 0.0145), 0, "six sites: common-grade costs .0490 (score A) and .0145 (score B)")
expect_equal_num(round(tc$own_best_risk, 4), c(0.0417, 0.0816), 0, "six sites: own-best risks .0417 and .0816")
t2 <- ct$tutorial_two
expect_identical_val(as.integer(t2$tables$units$grade), c(1L, 1L, 1L, 1L, 2L, 3L), "six sites: tutorial_two grades 1/1/1/1/2/3")
expect_equal_num(round(c(t2$facts$risk, t2$tables$profile$E_over_N), 4), c(0.0933, 0.0177, 0.0267), 0, "six sites: tutorial_two risk .0933, E/N .0177 and .0267")
expect_identical_val(as.integer(ct$tutorial_frontier$tables$path$N), c(8L, 8L, 9L, 11L, 12L), "six sites: tutorial_frontier N 8, 8, 9, 11, 12 at tau .05 ... .40")
r1 <- risk_from(t1$tables$units$grade, six$arrays$one, 1, 0.2)
expect_equal_num(r1$risk, t1$facts$risk, 1e-13, "six sites: risk recomputed from the exported array 'one' equals the cached risk")
r2 <- risk_from(t2$tables$units$grade, six$arrays$two, c(0.5, 0.5), 0.2)
expect_equal_num(r2$risk, t2$facts$risk, 1e-13, "six sites: risk recomputed from the exported array 'two' equals the cached risk")
c30 <- read_released("cache-30x3")$analyses; d30 <- read_released("thirty-draws")
a35 <- c30$analysis_30x3_tau35
expect_equal_num(c(round(a35$facts$risk, 6), a35$facts$N), c(0.322573, 276), 0, "thirty sites: analysis_30x3_tau35 risk .322573, N 276")
expect_equal_num(risk_from(a35$tables$units$grade, d30$arrays$draws, c(0.5, 0.25, 0.25), 0.35)$risk, a35$facts$risk, 1e-13,
                 "thirty sites: tau .35 risk recomputed from the exported draw array")
expect_equal_num(round(c30$commonality_30x3$tables$costs$cost_lower, 4), c(0.0895, 0.0749, 0.1022), 0, "thirty sites: costs .0895, .0749, .1022 at tau .25")
expect_identical_val(as.integer(c30$frontier_30x3$tables$path$N), c(0L, 0L, 0L, 0L, 131L, 276L, 305L, 312L), "thirty sites: frontier N at tau .10 ... .45")
m4 <- read_released("m4-tie-law")$tables$actions
expect_equal_num(c(m4$neutral_risk, m4$weak_risk, m4$R0[3]), c(0.1, 0.5, 0.15, 0.5, 0.9, 0.25, 0.15), 1e-15, "m4: neutral .1/.5/.15, weak .5/.9/.25, R0 .15")
toyc <- read_released("cache-toy")$analyses
expect_identical_val(c(toyc$toy_minimax$facts$status, as.character(toyc$toy_minimax$facts$risk)), c("optimal", "0.25"), "toy: minimax all-withheld, risk .25")
cat("20_export_teaching: done\n")
}
