# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R oracle for the restored 97-row threshold summary in app 3.10.
# Contract: engine/API.md thresholdViolations; new aboveCounts[i] counts j != i
# with the supplied directional error e[i,j] strictly below tau. No tolerance.
# Sources: released case-krw.json directional coefficients; krw-lambda-grid.json
# only checks the stable firm join. No package, JS, engine or app calls are used.
# Run from repository root: Rscript r-export/32_v3_threshold_unit_counts.R
source('r-export/_paths.R')
source('r-export/_helpers.R')
stopifnot(!('postrank' %in% loadedNamespaces()))

rows <- list()
vector_json <- function(x) I(unname(x))
add <- function(id, args, expect) {
  rows[[length(rows) + 1L]] <<- list(id = id,
    args = c(list(fn = 'thresholdUnitCounts'), args), expect = expect)
}

# Direct indicator sums for unit rows. The total is checked independently by
# inspecting each unordered pair once, rather than inferred from the row sums.
unit_counts <- function(e, tau) {
  stopifnot(is.matrix(e), nrow(e) == ncol(e), nrow(e) >= 2L,
    is.numeric(tau), length(tau) == 1L, is.finite(tau), tau >= 0, tau <= .5)
  n <- nrow(e)
  stopifnot(all(is.finite(e[row(e) != col(e)])),
    all(e[row(e) != col(e)] >= 0 & e[row(e) != col(e)] <= 1))
  indicator <- e < tau
  diag(indicator) <- FALSE
  above <- as.integer(rowSums(indicator))
  stated <- 0L
  for (i in seq_len(n - 1L)) for (j in seq.int(i + 1L, n)) {
    forward <- e[i, j] < tau
    reverse <- e[j, i] < tau
    stopifnot(!(forward && reverse))
    stated <- stated + as.integer(forward || reverse)
  }
  stopifnot(length(above) == n, all(above >= 0L & above < n),
    sum(above) == stated, stated <= choose(n, 2))
  list(aboveCounts = vector_json(above), statedCount = stated)
}

krw <- jsonlite::fromJSON(file.path(released_dir, 'case-krw.json'), simplifyVector = FALSE)
grid <- jsonlite::fromJSON(file.path(released_dir, 'krw-lambda-grid.json'), simplifyVector = FALSE)
ids <- unlist(krw$arrays$error$ids, use.names = FALSE)
unit_ids <- unlist(krw$tables$units$id, use.names = FALSE)
grid_ids <- unlist(grid$tables$firms$id, use.names = FALSE)
stopifnot(length(ids) == 97L, !anyDuplicated(ids),
  identical(ids, unit_ids), identical(ids, grid_ids))
for (field in c('race_estimate', 'race_se', 'gender_estimate', 'gender_se')) {
  stopifnot(identical(unlist(krw$tables$units[[field]], use.names = FALSE),
    unlist(grid$tables$firms[[field]], use.names = FALSE)))
}

criteria <- unlist(krw$arrays$error$criteria, use.names = FALSE)
for (criterion in c('race', 'gender')) {
  k <- match(paste0(criterion, '_signed'), criteria)
  stopifnot(!is.na(k))
  e <- do.call(rbind, lapply(krw$arrays$error$e[[k]], function(row)
    vapply(row, function(value) if (is.null(value)) NA_real_ else value, 0)))
  stopifnot(identical(dim(e), c(97L, 97L)), all(is.na(diag(e))))
  for (lambda in c(0, .1, .25, .5, .75, 1)) {
    tau <- lambda / (1 + lambda)
    answer <- unit_counts(e, tau)
    if (lambda == 0) stopifnot(all(answer$aboveCounts == 0L), answer$statedCount == 0L)
    add(sprintf('threshold-units-krw-%s-lambda%03d', criterion, round(100 * lambda)),
      list(criterion = criterion, lambda = lambda), answer)
  }
}

# All 27 ternary patterns [r_ij, r_jk, r_ik]. Direction +1 receives forward
# error .1; -1 receives .9; withholding 0 receives .5 in both directions.
# Compare the matrix indicator sums with a separate closed-form pattern count.
patterns <- as.matrix(expand.grid(rep(list(-1:1), 3L)))
for (h in seq_len(nrow(patterns))) {
  p <- as.integer(patterns[h, ])
  e <- matrix(.5, 3L, 3L)
  diag(e) <- NA_real_
  pairs <- list(c(1L, 2L), c(2L, 3L), c(1L, 3L))
  for (q in seq_len(3L)) {
    ij <- pairs[[q]]
    forward <- if (p[q] == 1L) .1 else if (p[q] == -1L) .9 else .5
    e[ij[1L], ij[2L]] <- forward
    e[ij[2L], ij[1L]] <- 1 - forward
  }
  answer <- unit_counts(e, .2)
  pattern_counts <- c(sum(p[c(1L, 3L)] == 1L),
    as.integer(p[1L] == -1L) + as.integer(p[2L] == 1L),
    sum(p[c(2L, 3L)] == -1L))
  stopifnot(identical(as.integer(answer$aboveCounts), as.integer(pattern_counts)),
    answer$statedCount == sum(p != 0L))
  add(sprintf('threshold-units-pattern-%02d', h),
    list(pattern = vector_json(p), tau = .2), answer)
}

stopifnot(length(rows) == 39L, !anyDuplicated(vapply(rows, `[[`, '', 'id')),
  !('postrank' %in% loadedNamespaces()))
write_golden('oracle-v3-threshold-units', rows,
  'r-export/32_v3_threshold_unit_counts.R', uses_postrank = FALSE)
cat('oracle-v3-threshold-units:', length(rows),
  'rows (12 released KRW settings, 27 ternary patterns); base R only.\n')
