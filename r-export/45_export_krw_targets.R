# Author: JoonHo Lee (jlee296@ua.edu)
# The public absolute-gender target, without a Gaussian approximation or an upstream refit.
# Run from the repository root: Rscript r-export/45_export_krw_targets.R
# In an isolated worktree set POSTRANK_SRC to the absolute public package checkout first.
# Reads only public postrank 1.1.0 pr_case_krw and the existing released signed summaries.
# Adds one contract entry; all previously released payload bytes and metadata stay unchanged.
prx_export_lib_only <- TRUE
source("r-export/20_export_teaching.R")
rm(prx_export_lib_only)

# This is a source-coordinate supplement, not a newly rounded summary export.
json_text <- function(x) as.character(jsonlite::toJSON(x, auto_unbox = TRUE, digits = 17,
                                                     na = "null", null = "null"))
KEY <- "krw-absolute-gender"
FILE <- paste0(KEY, ".json")
contract_path <- file.path(released_dir, "data_contract.json")
contract_twin_path <- file.path(released_dir, "data_contract.js")
read_text <- function(path) readChar(path, file.info(path)$size, useBytes = TRUE)
contract_before <- jsonlite::fromJSON(contract_path, simplifyVector = FALSE)
old_files <- contract_before$files[setdiff(names(contract_before$files), FILE)]
protected_entries <- c(old_files, contract_before$precomputed)
protected_paths <- unlist(lapply(protected_entries, function(x) c(x$path, x$twin)), use.names = FALSE)
protected_hashes <- vapply(file.path(prx_root, protected_paths), sha256_file, "")
for (entry in protected_entries) {
  stopifnot(identical(sha256_file(file.path(prx_root, entry$path)), entry$sha256),
            file.size(file.path(prx_root, entry$path)) == entry$bytes)
  if (!is.null(entry$twin)) stopifnot(identical(sha256_file(file.path(prx_root, entry$twin)), entry$twin_sha256),
                                    file.size(file.path(prx_root, entry$twin)) == entry$twin_bytes)
}

env <- new.env(parent = emptyenv())
utils::data("pr_case_krw", package = "postrank", envir = env)
krw <- env$pr_case_krw
absolute <- krw$alternatives$absolute_gender
if (is.null(absolute)) stop("Public postrank 1.1.0 pr_case_krw$alternatives$absolute_gender is absent; no substitute is permitted.", call. = FALSE)
source_rda <- file.path(postrank_src, "data", "pr_case_krw.rda")
if (!file.exists(source_rda)) stop("Public data/pr_case_krw.rda is absent; no research-input fallback is permitted.", call. = FALSE)
public <- new.env(parent = emptyenv()); load(source_rda, envir = public)
public_absolute <- public$pr_case_krw$alternatives$absolute_gender
stopifnot(!is.null(public_absolute), identical(absolute$entity_ids, public_absolute$entity_ids),
          identical(absolute$criterion_ids, public_absolute$criterion_ids),
          identical(absolute$e, public_absolute$e), identical(absolute$summaries, public_absolute$summaries))

ids <- absolute$entity_ids
k <- match("gender_absolute", absolute$criterion_ids)
stopifnot(length(ids) == 97L, !anyDuplicated(ids), !is.na(k),
          identical(ids, krw$input$entity_ids), identical(ids, krw$units$entity_id),
          identical(dimnames(absolute$e)[[1]], ids), identical(dimnames(absolute$e)[[2]], ids),
          identical(absolute$event, "directional_error"), isTRUE(absolute$zero_ties), absolute$margin == 0,
          identical(absolute$correction$method, "none"), isTRUE(absolute$summaries$same_targets),
          identical(absolute$summaries$level, 0.9),
          identical(colnames(absolute$summaries$means), absolute$criterion_ids),
          identical(rownames(absolute$summaries$means), ids))
folded <- absolute$e[, , k, drop = FALSE]
off <- base::row(folded[, , 1]) != base::col(folded[, , 1])
stopifnot(all(is.na(diag(folded[, , 1]))), all(is.finite(folded[, , 1][off])),
          all(folded[, , 1][off] >= 0 & folded[, , 1][off] <= 1),
          max(abs((folded[, , 1] + t(folded[, , 1]))[off] - 1)) <= 1e-12)
mean <- unname(absolute$summaries$means[, k])
lower <- unname(absolute$summaries$lower[, k])
upper <- unname(absolute$summaries$upper[, k])
stopifnot(all(is.finite(c(mean, lower, upper))), all(lower <= upper))

# This association uses exactly the immutable released signed columns, not abs(signed means),
# posterior draws, a within-firm covariance, or newly reconstructed higher-precision signed inputs.
signed_path <- file.path(released_dir, "case-krw.json")
signed_hash <- sha256_file(signed_path)
signed <- read_released("case-krw")
signed_rows <- match(ids, signed$tables$units$id)
stopifnot(length(signed_rows) == 97L, !anyNA(signed_rows), !anyDuplicated(signed_rows),
          identical(signed$tables$units$id[signed_rows], ids))
signed_race <- unname(signed$tables$units$mean_race[signed_rows])
signed_gender <- unname(signed$tables$units$mean_gender[signed_rows])
stopifnot(all(is.finite(c(signed_race, signed_gender))))
signed_correlation <- unname(stats::cor(signed_race, signed_gender, use = "everything", method = "pearson"))
stopifnot(is.finite(signed_correlation))

precision_note <- paste0("Folded coefficients and supplied summaries preserve the public source doubles with 17-digit serialization. ",
  "The signed-mean association uses the exact parsed columns of the unchanged case-krw.json release, whose original summaries carry 15 significant digits; its correlation is not rounded.")
changes <- paste0("Changes: extracted only the gender_absolute criterion from public postrank 1.1.0 pr_case_krw$alternatives$absolute_gender, ",
  "with the same 97 IDs, exact folded-cell pair probabilities and matching supplied central 90% marginal summaries. No Gaussian approximation, ",
  "complement correction or refit. Copied the existing released signed posterior-mean columns solely to document their across-firm Pearson association. ",
  "Scientific doubles use 17-digit serialization; existing released case and grid assets are unchanged. Full posterior grids and research files are not included.")
body <- list(
  facts = list(n = length(ids), M = choose(length(ids), 2), criterion = "gender_absolute",
    target = unname(absolute$targets["gender_absolute"]),
    orientation = unname(krw$provenance$orientation["gender_absolute"]),
    interval_level = absolute$summaries$level, intervals = absolute$summaries$description,
    posterior_law = krw$provenance$posterior_law, conditioning = absolute$source$conditioning,
    selection_rule = krw$provenance$selection_rule, source_version = krw$provenance$source_version,
    source_object = "pr_case_krw$alternatives$absolute_gender", source_criterion = "gender_absolute",
    source_input_criteria = col(absolute$criterion_ids), source_input_identity = absolute$input_identity,
    source_data_sha256 = sha256_file(source_rda),
    probability_event = absolute$event, zero_ties = absolute$zero_ties, margin = absolute$margin,
    probability_correction = absolute$correction$method, source = absolute$source, precision = precision_note,
    signed_mean_correlation = list(method = "Pearson product-moment correlation, base R stats::cor",
      n = length(ids), matched_ids = col(ids), value = signed_correlation,
      source_asset = "case-krw.json", source_sha256 = signed_hash,
      source_columns = col(c("tables.units.mean_race", "tables.units.mean_gender")),
      copied_columns = col(c("tables.signed_means.mean_race", "tables.signed_means.mean_gender")),
      scope = "Across-firm association of released SIGNED posterior means, not a joint posterior or within-firm race/gender dependence.")),
  tables = list(
    units = tbl(id = ids, firm_id = krw$units$firm_id, firm_name = krw$units$firm_name,
                industry = krw$units$industry, mean = mean, lower = lower, upper = upper),
    signed_means = tbl(id = ids, mean_race = signed_race, mean_gender = signed_gender)),
  arrays = list(error = error_array(folded, ids, "gender_absolute")))
meta <- list(key = KEY, title = "KRW's absolute gender contact gap: supplied folded-cell target", level = "firm",
  license_scope = "cc-by-nc-krw", attribution = signed$attribution, change_notice = changes, notice = signed$notice,
  sources = list(
    list(object = "pr_case_krw$alternatives$absolute_gender", path = "postrank 1.1.0 data/pr_case_krw.rda",
      sha256 = sha256_file(source_rda), fields = "e[,,gender_absolute], entity_ids, targets, summaries and declared source; matched units/provenance from pr_case_krw"),
    list(object = "released case-krw signed posterior means", path = "data/released/case-krw.json",
      sha256 = signed_hash, fields = "tables.units.id, tables.units.mean_race, tables.units.mean_gender")),
  upstream = list(source = "Kline, Rose and Walters (2024), AEA/ICPSR E198284V1, doi:10.3886/E198284V1; public postrank 1.1.0 adaptation",
    terms = "CC-BY-NC as stated by the deposit (no version stated); noncommercial use only; see notes/data-rights.md and postrank 1.1.0 DATA-NOTICE.md",
    fields = col(c("tables.units.id", "tables.units.firm_name", "tables.units.mean", "tables.units.lower", "tables.units.upper", "arrays.error.e",
                   "tables.signed_means.mean_race", "tables.signed_means.mean_gender"))),
  primary = "tables.units", runtime_asset = TRUE)
out <- write_released(body, meta)
out$entry$precision <- precision_note
stopifnot(out$entry$bytes <= RUNTIME_MAX_BYTES, out$entry$twin_bytes <= RUNTIME_MAX_BYTES)

# Exact binary-double round trips, including every off-diagonal probability and all supplied summaries.
back <- out$json
back_folded <- matrix(NA_real_, length(ids), length(ids))
for (i in seq_along(ids)) for (j in seq_along(ids)) {
  value <- back$arrays$error$e[[1]][[i]][[j]]
  back_folded[i, j] <- if (is.null(value)) NA_real_ else value
}
expect_identical_val(unname(unlist(back$arrays$error$ids)), ids, "exported probability IDs retain source order")
expect_identical_val(unname(unlist(back$tables$units$id)), ids, "exported summaries retain the same source IDs")
expect_equal_num(back_folded, folded[, , 1], 0, "all 9312 off-diagonal folded probabilities round-trip exactly")
for (field in c("mean", "lower", "upper"))
  expect_equal_num(back$tables$units[[field]], body$tables$units[[field]], 0, paste("all source", field, "summaries round-trip exactly"))
for (field in c("mean_race", "mean_gender"))
  expect_equal_num(back$tables$signed_means[[field]], body$tables$signed_means[[field]], 0, paste("released signed", field, "input round-trips exactly"))
expect_equal_num(back$facts$signed_mean_correlation$value, signed_correlation, 0, "unrounded base-R Pearson correlation round-trips exactly")
expect_equal_num(stats::cor(unlist(back$tables$signed_means$mean_race), unlist(back$tables$signed_means$mean_gender)),
                 signed_correlation, 0, "copied signed columns reproduce the identical correlation")

# Insert only the new file entry. Do not rerun update_contract(), which rebuilds old headers/entries.
insert_once <- function(text, needle, addition) {
  pos <- gregexpr(needle, text, fixed = TRUE)[[1]]
  if (length(pos) != 1L || pos[1] < 1L) stop("Expected exactly one data-contract insertion anchor", call. = FALSE)
  paste0(substr(text, 1L, pos[1] + nchar(needle) - 1L), addition,
         substr(text, pos[1] + nchar(needle), nchar(text)))
}
index_text <- read_text(contract_path)
if (is.null(contract_before$files[[FILE]])) {
  lines <- strsplit(as.character(jsonlite::toJSON(out$entry, auto_unbox = TRUE, digits = 17,
                     na = "null", null = "null", pretty = TRUE)), "\n", fixed = TRUE)[[1]]
  addition <- paste0("    ", json_text(FILE), ": ", lines[1], "\n", paste0("    ", lines[-1], collapse = "\n"), ",\n")
  writeChar(insert_once(index_text, "  \"files\": {\n", addition), contract_path, eos = NULL, useBytes = TRUE)
} else stopifnot(identical(json_text(contract_before$files[[FILE]]), json_text(out$entry)))

# The classic-script index twin is derived, but keeps all old text and entries untouched as well.
index_twin <- read_text(contract_twin_path)
twin_prefix <- 'window.PRX_DATA = window.PRX_DATA || {};\nwindow.PRX_DATA["data-contract"] = '
stopifnot(startsWith(index_twin, twin_prefix))
twin_body <- jsonlite::fromJSON(sub(";[[:space:]]*$", "", substring(index_twin, nchar(twin_prefix) + 1L)), simplifyVector = FALSE)
if (is.null(twin_body$files[[FILE]])) {
  addition <- paste0(json_text(FILE), ":", json_text(out$entry), ",")
  writeChar(insert_once(index_twin, '\"files\":{', addition), contract_twin_path, eos = NULL, useBytes = TRUE)
} else stopifnot(identical(json_text(twin_body$files[[FILE]]), json_text(out$entry)))

contract_after <- jsonlite::fromJSON(contract_path, simplifyVector = FALSE)
for (name in names(contract_before$files)) stopifnot(identical(contract_before$files[[name]], contract_after$files[[name]]))
before_header <- contract_before; after_header <- contract_after
before_header$files <- NULL; after_header$files <- NULL
stopifnot(identical(before_header, after_header),
          identical(protected_hashes, vapply(file.path(prx_root, protected_paths), sha256_file, "")))
cat(sprintf("45 KRW target export: %d old payload contracts and their bytes preserved; JSON %d bytes; JS %d bytes\n",
            length(protected_entries), out$entry$bytes, out$entry$twin_bytes))
cat(sprintf("Signed across-firm Pearson correlation (%d matched firms): %.17g\n", length(ids), signed_correlation))
