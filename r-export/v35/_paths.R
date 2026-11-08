# Explorer v3.5 public R-oracle environment.
# Author: JoonHo Lee <jlee296@ua.edu>
# Source in a fresh R process launched from the Explorer repository root.
# POSTRANK_LIB selects a library containing postrank 1.2.0; the default is
# .R-library-v35. POSTRANK_SRC selects the read-only source reference checkout.

v35_root <- normalizePath(getwd(), mustWork=TRUE)
if (!file.exists(file.path(v35_root, "catalog.json")))
  stop("Run v3.5 exporters from the Explorer repository root.", call.=FALSE)
v35_library <- normalizePath(Sys.getenv("POSTRANK_LIB", file.path(v35_root, ".R-library-v35")), mustWork=TRUE)
v35_source <- normalizePath(Sys.getenv("POSTRANK_SRC", file.path(v35_root, "..", "postrank-R-package-public")), mustWork=TRUE)
v35_golden_dir <- file.path(v35_root, "verification", "golden", "v35")

v35_load_postrank <- function() {
  version <- as.character(utils::packageVersion("postrank", lib.loc=v35_library))
  if (!identical(version, "1.2.0"))
    stop("postrank 1.2.0 required in POSTRANK_LIB; found ", version, call.=FALSE)
  expected <- normalizePath(file.path(v35_library, "postrank"), mustWork=TRUE)
  if ("postrank" %in% loadedNamespaces()) {
    actual <- normalizePath(getNamespaceInfo(asNamespace("postrank"), "path"), mustWork=TRUE)
    if (!identical(actual, expected))
      stop("A different postrank namespace is loaded; start a fresh R process.", call.=FALSE)
  }
  .libPaths(unique(c(v35_library, .libPaths())))
  suppressPackageStartupMessages(library("postrank", lib.loc=v35_library, character.only=TRUE))
  for (name in c("gmp", "jsonlite"))
    if (!requireNamespace(name, quietly=TRUE)) stop("Required package unavailable: ", name, call.=FALSE)
  description <- read.dcf(file.path(v35_source, "DESCRIPTION"))
  if (!identical(unname(description[1L, "Version"]), "1.2.0"))
    stop("POSTRANK_SRC must identify the postrank 1.2.0 source reference.", call.=FALSE)
  commit <- trimws(system2("git", c("-C", shQuote(v35_source), "rev-parse", "HEAD"), stdout=TRUE))
  if (length(commit)!=1L || !grepl("^[0-9a-f]{40}$", commit))
    stop("Cannot identify the reference source commit.", call.=FALSE)
  dirty <- system2("git", c("-C", shQuote(v35_source), "status", "--porcelain=v1", "--untracked-files=no"), stdout=TRUE)
  if (length(dirty)) stop("The reference source checkout has tracked modifications.", call.=FALSE)
  invisible(list(packageVersion=version, sourceCommit=commit,
    library=v35_library, installedPath=expected, source=v35_source))
}
