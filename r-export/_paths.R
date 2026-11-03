# Author: JoonHo Lee (jlee296@ua.edu)
# Paths shared by every r-export script. Run scripts from the repository root:
#   Rscript r-export/NN_name.R
# Environment variables override the defaults:
#   POSTRANK_LIB  project R library holding postrank 1.1.0 (default .R-library)
#   POSTRANK_SRC  public postrank source, read-only (default ../postrank-R-package-public)

prx_root <- normalizePath(getwd(), mustWork = TRUE)
if (!file.exists(file.path(prx_root, "catalog.json"))) {
  stop("Run r-export scripts from the postrank-explorer repository root.", call. = FALSE)
}
postrank_lib <- normalizePath(Sys.getenv("POSTRANK_LIB", file.path(prx_root, ".R-library")), mustWork = TRUE)
postrank_src <- normalizePath(Sys.getenv("POSTRANK_SRC", file.path(prx_root, "..", "postrank-R-package-public")), mustWork = TRUE)
golden_dir <- file.path(prx_root, "verification", "golden")
manifest_dir <- file.path(golden_dir, "manifest.d")
released_dir <- file.path(prx_root, "data", "released")

load_postrank <- function() {
  suppressPackageStartupMessages(library(postrank, lib.loc = postrank_lib))
  v <- as.character(utils::packageVersion("postrank", lib.loc = postrank_lib))
  if (v != "1.1.0") stop("postrank 1.1.0 expected in ", postrank_lib, ", found ", v, call. = FALSE)
  invisible(v)
}
