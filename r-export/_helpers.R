# Author: JoonHo Lee (jlee296@ua.edu)
# Writing helpers for golden files and released summaries.
# Golden files: verification/golden/<group>.json, one manifest fragment per file in
# verification/golden/manifest.d/<group>.json. Numbers keep 15 significant digits.

write_json_stable <- function(x, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  txt <- jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA, na = "null", null = "null", pretty = 1)
  writeLines(txt, path, useBytes = TRUE)
  invisible(path)
}

write_csv_stable <- function(df, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  utils::write.csv(df, path, row.names = FALSE, na = "")
  invisible(path)
}

sha256_file <- function(path) digest::digest(file = path, algo = "sha256")

# rows: a named list of cases; each case is list(id = , args = , expect = ) with JSON-ready values.
write_golden <- function(group, rows, generator, uses_postrank) {
  path <- file.path(golden_dir, paste0(group, ".json"))
  body <- list(group = group, generator = generator, uses_postrank = uses_postrank, rows = rows)
  write_json_stable(body, path)
  frag <- list(
    file = file.path("verification", "golden", paste0(group, ".json")),
    sha256 = sha256_file(path),
    rows = length(rows),
    generator = generator,
    uses_postrank = uses_postrank,
    postrank_version = if (uses_postrank) as.character(utils::packageVersion("postrank", lib.loc = postrank_lib)) else NA,
    r_version = paste(R.version$major, R.version$minor, sep = "."),
    created = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  )
  write_json_stable(frag, file.path(manifest_dir, paste0(group, ".json")))
  invisible(path)
}
