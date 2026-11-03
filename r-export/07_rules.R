# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/rules.ts (Step 2.9).
#   oracle-rules    base R only: strict orders, quantile tiers with exact-score merging, evidence flags (theory book
#                   ch. 2), expected ranks (ch. 5, 10, 19 laws); postrank is not loaded.
#   postrank-rules  postrank 1.1.0: postrank_cuts(rule = "quantile") (tiers, including tied scores, and the strict
#                   order as G_b = n), postrank_expected_rank() with weights (six sites, 30 sites, KRW, toy).
# Conventions (engine/API.md): scores are larger-first; grades canonical 1..G, grade 1 highest; units 0-based in code.
#   strictOrder(scores)          grade 1..n by descending score, ties broken by index
#   tierGrades(scores, G)        raw tier 1 + floor((p - 1) G / n) at descending position p (G capped at n); every
#                                raw tier an exact-score run straddles is merged into one grade (transitively), then
#                                labels are canonicalized: the postrank_cuts(rule = "quantile") rule
#   evidenceFlags(est, se, {ref, crit})  z = (est - ref)/se; flagged above (z > crit) = 1, not flagged = 2, flagged
#                                below (z < -crit) = 3, canonicalized (the adapter canonicalizes the engine's labels)
#   expectedRank(E, {w})         sum_k w_k {1 + sum_{j != i} e[k][i][j]} (weak errors, as postrank_expected_rank())
# The theory book (ch. 17, "A fixed-tier comparator") gives tied scores their minimum position p_i = 1 + #{j: u_j > u_i}
# and does not merge neighbouring tiers; that differs from the package rule for ties that straddle a tier boundary
# (rows marked "book-differs" record both, and only the package value is compared).
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

vec <- function(x) I(unname(x))
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(a[, , k]))
earr <- function(e, ids, criteria) list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
check_close <- function(a, b, tol, label) {
  a <- as.numeric(unlist(a)); b <- as.numeric(unlist(b))
  if (length(a) != length(b) || any(is.na(a) != is.na(b))) stop("check failed (shape/NA): ", label, call. = FALSE)
  d <- max(c(0, abs(a - b)), na.rm = TRUE)
  if (d > tol) stop(sprintf("check failed: %s (max diff %.3g > %.3g)", label, d, tol), call. = FALSE)
  invisible(d)
}
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# ---- base-R oracle -------------------------------------------------------------------------------------------------
o_canonical <- function(g) match(g, sort(unique(g)))
o_strict <- function(s) { n <- length(s); g <- integer(n); g[order(-s, seq_len(n))] <- seq_len(n); g }
o_tiers <- function(s, G) {                          # package rule (API.md): positional tiers, straddled tiers merged
  n <- length(s); G <- min(G, n); ord <- order(-s, seq_len(n)); v <- s[ord]
  lab <- 1 + floor((seq_len(n) - 1) * G / n)
  repeat {
    changed <- FALSE
    for (u in unique(v)) { gs <- unique(lab[v == u]); if (length(gs) > 1) { lab[lab %in% gs] <- min(gs); changed <- TRUE } }
    if (!changed) break
  }
  g <- integer(n); g[ord] <- o_canonical(lab); g
}
o_tiers_book <- function(s, G) {                     # theory book ch. 17: minimum position for tied scores, no merging
  n <- length(s); p <- vapply(s, function(u) 1 + sum(s > u), 0)
  o_canonical(1 + floor((p - 1) * G / n))
}
o_N <- function(g) sum(outer(g, g, "<"))
o_flags <- function(est, se, ref, crit) {
  z <- (est - ref) / se
  stopifnot(all(abs(abs(z) - crit) > 1e-9))           # no unit on a cutoff (the boundary convention is not fixed)
  raw <- ifelse(z > crit, 1L, ifelse(z < -crit, 3L, 2L))
  list(grade = vec(o_canonical(raw)), z = vec(z))
}
o_finite_law <- function(states, masses) {
  n <- nrow(states[[1]]); K <- ncol(states[[1]]); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- sum(masses[vapply(states, function(s) s[i, k] <= s[j, k], logical(1))]) / sum(masses)
  e
}
o_error_array <- function(means, sds) {
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
o_expected_rank <- function(e, w) {
  n <- dim(e)[1]
  as.vector(sapply(seq_len(dim(e)[3]), function(k) { m <- e[, , k]; diag(m) <- 0; 1 + rowSums(m) }) %*% w)
}
st <- function(..., ids, criteria) { m <- cbind(...); dimnames(m) <- list(entity = ids, criterion = criteria); m }

six_ids <- LETTERS[1:6]; sixK <- c("score_A", "score_B")
six_means <- cbind(score_A = c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8), score_B = c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7))
e6 <- o_error_array(six_means, matrix(0.2, 6, 2))
league_theta <- 0.15 * qnorm((((19 * (1:30)) %% 31) - 0.5) / 30)   # SR-06 true values (see 08_simulate.R)

# ---- strictOrder ---------------------------------------------------------------------------------------------------
so <- function(id, s) add(row(paste0("strictOrder-", id), "strictOrder", list(scores = vec(s)), list(grade = vec(o_strict(s)))))
so("six-scoreA", six_means[, 1])
so("four-tie-by-index", c(0.3, -0.1, 0.3, 1.4))
stopifnot(identical(o_strict(c(0.3, -0.1, 0.3, 1.4)), c(2L, 4L, 3L, 1L)))
so("all-equal", c(5, 5, 5))
so("league-theta", league_theta)
stopifnot(identical(o_strict(league_theta), as.integer(31 - (19 * (1:30)) %% 31)))
so("unsorted-negative", c(-2, 7, 0, -2, 3.5, 7, -0.25))

# ---- tierGrades ----------------------------------------------------------------------------------------------------
tg <- function(id, s, G) {
  g <- o_tiers(s, G); b <- o_tiers_book(s, G)
  if (!identical(g, b)) id <- paste0(id, "-book-differs")
  add(row(paste0("tierGrades-", id), "tierGrades", list(scores = vec(s), G = G), list(grade = vec(g))))
  invisible(list(grade = g, book = b))
}
tg("six-G3", six_means[, 1], 3)
stopifnot(identical(o_tiers(six_means[, 1], 3), c(1L, 1L, 2L, 2L, 3L, 3L)))
shares <- c()
for (G in c(2, 3, 4, 5, 10)) { r <- tg(sprintf("league-theta-G%d", G), league_theta, G); shares <- c(shares, o_N(r$grade) / 435) }
check_close(shares, c(0.517, 0.690, 0.775, 0.828, 0.931), 5e-4, "cf.tiers.n30 shares .517 .690 .775 .828 .931")
stopifnot(o_N(o_tiers(league_theta, 4)) == 337)
r12 <- tg("twelve-G3", seq(12, 1), 3); stopifnot(o_N(r12$grade) == 48)          # cf.tiers.n12.G3.N = 48
t1 <- tg("tie-straddles-boundary-G3", c(6, 5, 5, 3, 2, 1), 3)
stopifnot(identical(t1$grade, c(1L, 1L, 1L, 1L, 2L, 2L)), identical(t1$book, c(1L, 1L, 1L, 2L, 3L, 3L)))
t2 <- tg("ties-within-tiers-G3", c(6, 6, 4, 3, 2, 2), 3)
stopifnot(identical(t2$grade, c(1L, 1L, 2L, 2L, 3L, 3L)), identical(t2$grade, t2$book))
t3 <- tg("two-ties-merge-all-G3", c(5, 4, 4, 3, 3, 1), 3)
stopifnot(identical(t3$grade, rep(1L, 6)), identical(t3$book, c(1L, 1L, 1L, 2L, 2L, 3L)))   # transitive merge
tg("run-of-three-G6", c(3, 2, 2, 2, 1, 0), 6)
tg("run-of-three-G3", c(3, 2, 2, 2, 1, 0), 3)
tg("all-equal-G3", c(2, 2, 2, 2), 3)
tg("G1", six_means[, 1], 1)
tg("G-equals-n-ties", c(1, 3, 3, 2, 0), 5)
tg("G-above-n-capped", six_means[, 1], 8)
stopifnot(identical(o_tiers(six_means[, 1], 8), 1:6))
tg("unsorted-ties-G3", c(2, 9, 2, 7, 9, 1, 5), 3)
tg("unsorted-ties-G4", c(0.5, 0.25, 0.5, 0.75, 0.25, 1, 0, 0.75), 4)

# ---- evidenceFlags (theory book ch. 2 #sec-educational-performance) --------------------------------------------------
ef <- function(id, est, se, ref, crit) { r <- o_flags(est, se, ref, crit)
  add(row(paste0("evidenceFlags-", id), "evidenceFlags", list(est = vec(est), se = vec(se), ref = ref, crit = crit), r)); invisible(r) }
r2 <- ef("tb02-two-unit-ref0-crit1.96", c(0.2, 0.3), c(0.05, 0.2), 0, 1.96)
check_close(r2$z, c(4.0, 1.5), 1e-15, "ch. 2: indices 4.0 and 1.5")
stopifnot(identical(unclass(r2$grade), c(1L, 2L)))   # R-02: A flagged above, B not flagged
ef("three-groups", c(0.5, 0.1, -0.4, 0, -0.05), c(0.1, 0.1, 0.1, 0.2, 0.01), 0, 1.96)
ef("none-above-canonical", c(0, -0.5, 0.05), c(0.1, 0.1, 0.1), 0, 1.96)
ef("none-flagged", c(0.1, -0.1, 0.05), c(0.1, 0.2, 0.3), 0, 1.645)
ef("ref-nonzero-crit2.576", c(1.3, 0.9, 1.0, 0.2, 1.05), c(0.1, 0.05, 0.2, 0.25, 0.01), 1, 2.576)

# ---- expectedRank -------------------------------------------------------------------------------------------------
er <- function(id, e, ids, criteria, w) { r <- o_expected_rank(e, w)
  add(row(paste0("expectedRank-", id), "expectedRank", list(E = earr(e, ids, criteria), w = vec(w)), list(rank = vec(r)))); invisible(r) }
r6 <- er("six-K1", e6[, , 1, drop = FALSE], six_ids, "score_A", 1)
check_close(r6, c(1.19, 1.82, 3.36, 3.65, 5.13, 5.86), 5e-3, "L-09: A 1.19, B 1.82, C 3.36, D 3.65, E 5.13, F 5.86")
er("six-K2-w.5.5", e6, six_ids, sixK, c(0.5, 0.5))
er("six-K2-w.8.2", e6, six_ids, sixK, c(0.8, 0.2))
er("six-K2-w0.1", e6, six_ids, sixK, c(0, 1))
abc <- c("A", "B", "C")
law19 <- o_finite_law(list(st(c(20, 4, 3), ids = abc, criteria = "c"), st(c(0, 4, 3), ids = abc, criteria = "c")), c(3L, 7L))
check_close(er("tb19-law3", law19, abc, "c", 1), c(2.4, 1.3, 2.3), 1e-15, "ch. 19 expected ranks 2.4, 1.3, 2.3")
law10 <- o_finite_law(list(st(c(3, 2, 1), ids = abc, criteria = "c"), st(c(1, 3, 2), ids = abc, criteria = "c"),
                           st(c(1, 2, 3), ids = abc, criteria = "c")), c(51L, 48L, 1L))
check_close(er("tb10-law051", law10, abc, "c", 1), c(1.98, 1.52, 2.50), 1e-15, "ch. 10 expected ranks 1.98, 1.52, 2.50")
abcd <- c("A", "B", "C", "D"); rank_vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], abcd)] <- 4:1; v }
tb14 <- o_finite_law(list(st(rank_vals("ABCD"), rank_vals("ACBD"), ids = abcd, criteria = c("c1", "c2")),
                          st(rank_vals("BACD"), rank_vals("DCBA"), ids = abcd, criteria = c("c1", "c2"))), c(3L, 1L))
er("tb14-w.6.4", tb14, abcd, c("c1", "c2"), c(3/5, 2/5))
m4 <- o_finite_law(lapply(c(0, 1, 2), function(a) st(c(a, 1), ids = c("A", "B"), criteria = "score")), c(1L, 4L, 5L))
check_close(er("m4-ties-weak", m4, c("A", "B"), "score", 1), c(1.5, 1.9), 1e-15, "m4 law: weak expected ranks 1.5, 1.9")

assert_no_postrank()
write_golden("oracle-rules", rows, generator = "r-export/07_rules.R", uses_postrank = FALSE)
cat("oracle-rules:", length(rows), "rows\n")

# ---- postrank 1.1.0 ---------------------------------------------------------------------------------------------
load_postrank()
.libPaths(c(postrank_lib, .libPaths()))
source(system.file("scripts", "_vignette-setup.R", package = "postrank"), local = TRUE)
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
check_close(pr_tutorial$one$e, e6[, , 1, drop = FALSE], 1e-15, "base-R six-site errors vs pr_tutorial$one$e")

# Quantile tiers: postrank_cuts(scores, pairwise, settings, direction = "descending", rule = "quantile", G_b = G).
# The loss settings do not affect quantile grades; G_max = n admits every realized grade count.
pq <- function(id, s, pw, G, fn = "tierGrades") {
  ids <- pw$entity_ids; n <- length(ids); K <- length(pw$criterion_ids)
  sett <- postrank_settings(setNames(rep(1 / K, K), pw$criterion_ids), tau = 0.2, G_max = as.integer(n))
  b <- postrank_cuts(setNames(s, ids), pw, sett, direction = "descending", rule = "quantile", G_b = G)
  g <- unname(b$grade[ids])
  if (fn == "tierGrades") {
    stopifnot(identical(as.integer(g), o_tiers(s, G)))                  # base-R rule = package rule
    padd(row(paste0("tierGrades-", id), "tierGrades", list(scores = vec(s), G = G), list(grade = vec(as.integer(g)))))
  } else {
    stopifnot(!anyDuplicated(s), identical(as.integer(g), o_strict(s)))  # G_b = n on tie-free scores: the strict order
    padd(row(paste0("strictOrder-", id), "strictOrder", list(scores = vec(s)), list(grade = vec(as.integer(g)))))
  }
  invisible(g)
}
one <- pr_tutorial$one
pq("pr_tutorial-means-G3", six_means[, 1], one, 3)
pq("pr_tutorial-tie-straddles-boundary-G3", c(6, 5, 5, 3, 2, 1), one, 3)
pq("pr_tutorial-ties-within-tiers-G3", c(6, 6, 4, 3, 2, 2), one, 3)
g_all <- pq("pr_tutorial-two-ties-merge-all-G3", c(5, 4, 4, 3, 3, 1), one, 3)
stopifnot(all(g_all == 1L))                          # the package merges straddled tiers transitively
pq("pr_tutorial-run-of-three-G3", c(3, 2, 2, 2, 1, 0), one, 3)
pq("pr_tutorial-run-of-three-G6", c(3, 2, 2, 2, 1, 0), one, 6)
pq("pr_tutorial-unsorted-ties-G4", c(2, 9, 2, 7, 9, 1), one, 4)
pq("pr_tutorial-G-above-n-capped", six_means[, 1], one, 8)
pq("pr_tutorial-all-equal-G3", rep(0.5, 6), one, 3)
pq("pr_tutorial-means-Gn", six_means[, 1], one, 6, fn = "strictOrder")
gs <- pr_example_gaussian; m30 <- unname(gs$means[, "poverty"])
for (G in c(2, 3, 4, 5, 10)) pq(sprintf("pr_example_gaussian-poverty-means-G%d", G), m30, gs, G)
m30r <- round(m30, 1); stopifnot(anyDuplicated(m30r) > 0)
for (G in c(3, 4, 7)) pq(sprintf("pr_example_gaussian-poverty-means-rounded.1-G%d", G), m30r, gs, G)
pq("pr_example_gaussian-poverty-means-Gn", m30, gs, 30, fn = "strictOrder")

# Expected ranks: postrank_expected_rank(pairwise, weights).
pe <- function(id, pw, w, tol = 1e-12) {
  r <- unname(postrank_expected_rank(pw, if (is.null(w)) NULL else setNames(w, pw$criterion_ids)))
  K <- length(pw$criterion_ids); wv <- if (is.null(w)) rep(1 / K, K) else w
  check_close(r, o_expected_rank(unname(pw$e), wv), tol, paste("postrank_expected_rank vs base R", id))
  padd(row(paste0("expectedRank-", id), "expectedRank", list(E = earr(unname(pw$e), pw$entity_ids, pw$criterion_ids), w = vec(wv)),
           list(rank = vec(r))))
  invisible(r)
}
pe("pr_tutorial-one", one, 1)
pe("pr_tutorial-two-w.5.5", pr_tutorial$two, c(0.5, 0.5))
pe("pr_tutorial-two-w.8.2", pr_tutorial$two, c(0.8, 0.2))
pe("pr_tutorial-two-equal-default", pr_tutorial$two, NULL)
pe("pr_example_gaussian-w.5.25.25", gs, c(0.5, 0.25, 0.25))
pe("pr_example_gaussian-equal-default", gs, NULL)
a25 <- load_or_compute("analysis_30x3")              # the pr_example_draws array behind the commonality_30x3 orders
for (w in list(c(0.5, 0.25, 0.25), c(1, 0, 0), c(0, 1, 0), c(0, 0, 1)))
  pe(paste0("analysis_30x3-w", paste(w, collapse = ".")), a25$pairwise, w)
pe("postrank_toy-w.6.4", postrank_pairwise(postrank_toy), c(0.6, 0.4))
rk <- pe("pr_case_krw-input-w.5.5", pr_case_krw$input, c(0.5, 0.5))    # S-03 weighted expected-rank order
stopifnot(!anyDuplicated(rk), min(diff(sort(rk))) > 1e-6)

write_golden("postrank-rules", prow, generator = "r-export/07_rules.R", uses_postrank = TRUE)
cat("postrank-rules:", length(prow), "rows\n")
