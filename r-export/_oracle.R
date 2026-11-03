# Author: JoonHo Lee (jlee296@ua.edu)
# Rules for base-R oracle code (golden values that do not call postrank).
# 1. An oracle script never loads postrank; call assert_no_postrank() after its setup.
# 2. It uses closed forms (pnorm, choose, exact rationals) or full enumeration of small families.
# 3. It is written from the theory book and CONTRACT.md only, never from the TypeScript engine.
# 4. Its golden group name starts with "oracle-" and is written with write_golden(uses_postrank = FALSE).

assert_no_postrank <- function() {
  if ("postrank" %in% loadedNamespaces()) stop("oracle code must not load postrank", call. = FALSE)
  invisible(TRUE)
}

# Canonical grade vectors (grade 1 = highest priority, labels 1..G consecutive) of n units with at most g_max grades.
oracle_reports <- function(n, g_max = n) {
  g <- as.matrix(expand.grid(rep(list(seq_len(g_max)), n)))
  ok <- apply(g, 1, function(r) { u <- sort(unique(r)); all(u == seq_along(u)) })
  unname(g[ok, , drop = FALSE])
}

# Expected wrong stated directions E and disclosure N of report g under the n x n error matrix e
# (e[i, j] = Pr(theta_i <= theta_j | Y), diagonal ignored). Row i above column j is stated when g[i] < g[j].
oracle_report_counts <- function(g, e) {
  stated <- outer(g, g, "<")
  diag(stated) <- FALSE
  list(N = sum(stated), E = sum(e[stated]))
}

oracle_risk <- function(g, e, tau) {
  n <- length(g); M <- n * (n - 1) / 2
  cnt <- oracle_report_counts(g, e)
  (cnt$E + tau * (M - cnt$N)) / M
}
