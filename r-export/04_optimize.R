# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for engine/src/optimize.ts (Step 2.6).
#   oracle-optimize    base R only (full enumeration of canonical reports, closed forms, exact rationals, theory-book
#                      examples); postrank is not loaded. Package datasets are read with base load() only.
#   postrank-optimize  postrank_cuts(rule = "optimal") (the package's contiguous-partition DP) on fixed orders,
#                      plus archived package optima (cached analyses) for exactOptimum; base-R cross-checks below.
# Conventions (engine/API.md): grade 1 = highest priority; units 0-based in code; "i above j is stated" when
# g[i] < g[j]; E is an ErrorArray { ids, criteria, e } with e[k][i][j] = Pr(theta_ik <= theta_jk) and a null (NaN)
# diagonal; M = n(n - 1)/2; risk R = (Ew + tau (M - N)) / M. Every row names the engine function in args$fn.
# Inputs are written with 15 significant digits; every expected value below is computed from those rounded inputs
# (r15), so the engine and this oracle see the same numbers. Optima within a family: every report whose risk is
# within 1e-12 of the minimum (the API's tieTol). Each case asserts that no report sits in the ambiguous band
# (1e-13, 1e-10] above the minimum, so the tie set cannot depend on summation order.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

# ---- JSON shaping and checks --------------------------------------------------------------------------------------
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
r15 <- function(x) { y <- x; ok <- !is.na(x); y[ok] <- as.numeric(sprintf("%.15g", x[ok])); y }   # JSON round trip
probe <- c(1/3, pnorm(-3.3), 0.1 + 0.2, 1 - 1e-12, 2/3)
stopifnot(identical(jsonlite::fromJSON(jsonlite::toJSON(probe, digits = NA)), r15(probe)))
grade_list <- function(G) lapply(seq_len(nrow(G)), function(r) vec(G[r, ]))
o_lexsort <- function(G) G[do.call(order, unname(as.data.frame(G))), , drop = FALSE]
rowmax <- function(G) if (ncol(G) == 1) G[, 1] else do.call(pmax, unname(as.data.frame(G)))
fam_all <- function() list(kind = "all")
fam_atmost <- function(G) list(kind = "atMost", G = G)
fam_exactly <- function(G) list(kind = "exactly", G = G)
fam_order <- function(order0, G = NULL, exact = NULL, blocks = NULL) {
  f <- list(kind = "order", order = vec(order0))
  if (!is.null(G)) f$G <- G
  if (!is.null(exact)) f$exact <- exact
  if (!is.null(blocks)) f$blocks <- vec(blocks)
  f
}
fam_label <- function(f) switch(f$kind, all = "all", atMost = paste0("cap", f$G), exactly = paste0("eq", f$G),
  order = paste0("order", paste(f$order, collapse = ""), if (!is.null(f$G)) paste0("-cap", f$G),
                 if (!is.null(f$exact)) paste0("-eq", f$exact), if (!is.null(f$blocks)) paste0("-blocks", paste(f$blocks, collapse = ""))))
fmt_tau <- function(t) sub("^0", "", sprintf("%.2f", t))

# ---- enumeration of canonical reports (theory book ch. 9 and 14) --------------------------------------------------
# A canonical report is an ordered partition: a set partition (restricted growth string, blocks labelled by first
# appearance) together with an ordering of its k blocks. Each pair (RGS, permutation) gives one report, once.
o_rgs <- function(n, gmax) {
  m <- matrix(1L, 1, 1); mx <- 1L
  if (n > 1) for (p in 2:n) {
    lim <- pmin(mx + 1L, gmax); reps <- rep(seq_len(nrow(m)), lim); nxt <- sequence(lim)
    m <- cbind(m[reps, , drop = FALSE], nxt); mx <- pmax(mx[reps], nxt)
  }
  list(rgs = unname(m), k = mx)
}
o_perms <- function(k) {
  p <- matrix(1L, 1, 1)
  if (k > 1) for (m in 2:k) p <- do.call(rbind, lapply(seq_len(m), function(pos) {
    left <- if (pos > 1) p[, seq_len(pos - 1), drop = FALSE] else NULL
    right <- if (pos <= ncol(p)) p[, pos:ncol(p), drop = FALSE] else NULL
    cbind(left, m, right)
  }))
  unname(p)
}
# Calls f(G) on chunks (integer matrices, one report per row) of every canonical report with k grades, k in ks.
o_scan <- function(n, gmax, ks, f) {
  r <- o_rgs(n, gmax)
  for (k in ks) {
    R <- r$rgs[r$k == k, , drop = FALSE]; P <- o_perms(k)
    if (nrow(R) >= nrow(P)) for (a in seq_len(nrow(P))) f(matrix(P[a, ][R], nrow(R), n))
    else for (b in seq_len(nrow(R))) f(P[, R[b, ], drop = FALSE])
  }
}
o_all_reports <- function(n, gmax = n) {
  out <- list(); o_scan(n, gmax, seq_len(min(gmax, n)), function(G) out[[length(out) + 1L]] <<- G)
  do.call(rbind, out)
}
# Per-criterion expected wrong counts E (rows = reports) and disclosure N, summed over pairs i < j.
o_eval_chunk <- function(G, e) {
  n <- ncol(G); K <- dim(e)[3]; E <- matrix(0, nrow(G), K); N <- integer(nrow(G))
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    lt <- G[, i] < G[, j]; gt <- G[, i] > G[, j]; N <- N + (lt | gt)
    for (k in seq_len(K)) E[, k] <- E[, k] + e[i, j, k] * lt + e[j, i, k] * gt
  }
  list(E = E, N = N)
}
# Family membership (the order family: contiguous cuts of a declared order, optionally with indivisible blocks).
o_in_family <- function(G, f) {
  k <- rowmax(G)
  switch(f$kind, all = rep(TRUE, nrow(G)), atMost = k <= f$G, exactly = k == f$G, order = {
    ord <- unclass(f$order) + 1L; X <- G[, ord, drop = FALSE]; n <- length(ord)
    d <- X[, -1, drop = FALSE] - X[, -n, drop = FALSE]
    ok <- X[, 1] == 1L & rowSums(d != 0L & d != 1L) == 0
    if (!is.null(f$blocks)) {
      fixed <- setdiff(seq_len(n - 1), cumsum(unclass(f$blocks)))        # gaps inside a block: no cut
      if (length(fixed)) ok <- ok & rowSums(d[, fixed, drop = FALSE] != 0L) == 0
    }
    if (!is.null(f$G)) ok <- ok & k <= f$G
    if (!is.null(f$exact)) ok <- ok & k == f$exact
    ok
  })
}
# Family sizes (theory book ch. 9): ordered Bell / k! S(n, k) sums, and C(m - 1, h - 1) for an order with m blocks.
o_stirling <- function(n, k) { S <- matrix(0, n + 1, n + 1); S[1, 1] <- 1
  for (a in 1:n) for (b in 1:a) S[a + 1, b + 1] <- b * S[a, b + 1] + S[a, b]; S[n + 1, k + 1] }
o_size <- function(n, f) switch(f$kind,
  all = sum(sapply(1:n, function(k) factorial(k) * o_stirling(n, k))),
  atMost = sum(sapply(seq_len(min(f$G, n)), function(k) factorial(k) * o_stirling(n, k))),
  exactly = if (f$G < 1 || f$G > n) 0 else factorial(f$G) * o_stirling(n, f$G),
  order = { m <- if (is.null(f$blocks)) n else length(f$blocks)
    hs <- if (!is.null(f$exact)) f$exact else seq_len(min(if (is.null(f$G)) m else f$G, m))
    sum(choose(m - 1, hs - 1)) })
o_has_withheld <- function(f) switch(f$kind, all = TRUE, atMost = f$G >= 1, exactly = f$G == 1,
  order = if (!is.null(f$exact)) f$exact == 1 else TRUE)

# Exact optimum within a family from full arrays (small n). q: budgets E_k <= q_k N (N = 0 passes).
TIE <- 1e-13; AMBIG <- 1e-10
o_optimum <- function(G, E, N, w, tau, f, q = NULL, label = "", tieTol = NULL) {
  n <- ncol(G); M <- n * (n - 1) / 2
  keep <- o_in_family(G, f)
  stopifnot(sum(keep) == o_size(n, f))
  if (!is.null(q)) {
    budgeted <- which(q < 1)
    for (k in budgeted) {                                     # no report sits within 1e-9 of a budget boundary
      slack <- E[keep & N > 0, k] - q[k] * N[keep & N > 0]
      if (length(slack) && min(abs(slack)) < 1e-9) stop("budget boundary too close: ", label, call. = FALSE)
    }
    for (k in seq_along(q)) keep <- keep & E[, k] <= q[k] * N
  }
  if (!any(keep)) return(list(empty = TRUE, size = 0))
  Ew <- drop(E[keep, , drop = FALSE] %*% w); Nk <- N[keep]; Gk <- G[keep, , drop = FALSE]
  risk <- (Ew + tau * (M - Nk)) / M; d <- risk - min(risk)
  if (any(d > TIE & d <= AMBIG)) stop("ambiguous near-tie: ", label, call. = FALSE)
  tol <- TIE
  if (!is.null(tieTol)) { if (any(abs(d - tieTol) <= 1e-9)) stop("a report sits at the tieTol boundary: ", label, call. = FALSE); tol <- tieTol }
  opt <- which(d <= tol); S <- o_lexsort(Gk[opt, , drop = FALSE])
  first <- opt[do.call(order, unname(as.data.frame(Gk[opt, , drop = FALSE])))[1]]
  list(empty = FALSE, size = sum(keep), grades = S, grade = S[1, ], risk = risk[first],
       N = Nk[first], Ew = Ew[first], E = E[keep, , drop = FALSE][first, ], runner_gap = min(c(Inf, d[d > TIE])))
}
o_report_eval <- function(g, e, w, tau) {
  ev <- o_eval_chunk(matrix(as.integer(g), 1), e); n <- length(g); M <- n * (n - 1) / 2
  Ew <- sum(w * ev$E[1, ]); list(N = ev$N, E = ev$E[1, ], Ew = Ew, risk = (Ew + tau * (M - ev$N)) / M)
}

# Chunked scan for large families: per disclosure N, the count, min and max Ew and every report within `band` of
# the minimum (enough to recover all optima and their ambiguity band for any tau: a report within delta of the
# optimum objective Ew - tau N lies within delta of the smallest Ew at its own N).
o_cloud_scan <- function(n, gmax, ks, e, w, band = 1e-7) {
  M <- n * (n - 1) / 2; acc <- vector("list", M + 1)
  o_scan(n, gmax, ks, function(G) {
    ev <- o_eval_chunk(G, e); Ew <- drop(ev$E %*% w); N <- ev$N
    for (v in unique(N)) {
      idx <- which(N == v); x <- Ew[idx]; a <- acc[[v + 1]]
      if (is.null(a)) a <- list(count = 0, min = Inf, max = -Inf, cand = NULL, candEw = numeric(), low = numeric())
      newmin <- min(a$min, x); keep <- idx[x <= newmin + band]
      cand <- rbind(a$cand, G[keep, , drop = FALSE]); candEw <- c(a$candEw, Ew[keep]); ok <- candEw <= newmin + band
      acc[[v + 1]] <<- list(count = a$count + length(idx), min = newmin, max = max(a$max, x),
                            cand = cand[ok, , drop = FALSE], candEw = candEw[ok], low = head(sort(c(a$low, head(sort(x), 3))), 3))
    }
  })
  acc
}
o_cloud_optimum <- function(acc, n, tau, label = "") {
  M <- n * (n - 1) / 2
  C <- do.call(rbind, lapply(acc, function(a) if (!is.null(a)) a$cand))
  Ew <- unlist(lapply(acc, function(a) if (!is.null(a)) a$candEw))
  N <- unlist(lapply(seq_along(acc), function(v) if (!is.null(acc[[v]])) rep(v - 1, length(acc[[v]]$candEw))))
  risk <- (Ew + tau * (M - N)) / M; d <- risk - min(risk)
  if (any(d > TIE & d <= AMBIG)) stop("ambiguous near-tie: ", label, call. = FALSE)
  opt <- which(d <= TIE); ordr <- do.call(order, unname(as.data.frame(C[opt, , drop = FALSE])))
  S <- C[opt[ordr], , drop = FALSE]
  list(grades = S, grade = S[1, ], risk = risk[opt[ordr[1]]], N = N[opt[ordr[1]]], Ew = Ew[opt[ordr[1]]],
       size = sum(sapply(acc, function(a) if (is.null(a)) 0 else a$count)))
}

# Fixed order: brute force over every contiguous cut set (block boundaries only), with interval savings
# W(a, b) = sum_{a < s < t <= b} (ebar_{rho_s rho_t} - tau) from 2-D prefix sums (theory book ch. 14). Used to
# confirm the DP optimum and that it is unique by a margin, so no tie rule decides it.
o_contiguous_best <- function(e, w, tau, order1, blocks = NULL, G = NULL, exact = NULL, label = "") {
  n <- length(order1); M <- n * (n - 1) / 2
  eb <- e[, , 1] * w[1]; if (dim(e)[3] > 1) for (k in 2:dim(e)[3]) eb <- eb + w[k] * e[, , k]
  eta <- eb[order1, order1] - tau; eta[lower.tri(eta, diag = TRUE)] <- 0
  P <- rbind(0, cbind(0, apply(apply(eta, 2, cumsum), 1, cumsum) |> t()))   # P[a + 1, b + 1] = sum_{s <= a, t <= b}
  Wab <- function(a, b) { a <- as.vector(a); b <- as.vector(b); P[cbind(b + 1, b + 1)] - P[cbind(a + 1, b + 1)] }
  if (is.null(blocks)) blocks <- rep(1L, n)
  B <- length(blocks); inner <- cumsum(blocks)[-B]
  hs <- if (!is.null(exact)) exact else seq_len(min(if (is.null(G)) B else G, B))
  best <- NULL; vals <- numeric()
  for (h in hs) {
    cs <- if (h == 1) matrix(0L, 1, 0) else { ix <- combn(length(inner), h - 1); matrix(inner[ix], ncol = h - 1, byrow = TRUE) }
    bd <- cbind(0L, cs, n); sav <- rowSums(matrix(Wab(bd[, -ncol(bd)], bd[, -1]), nrow(bd)))
    vals <- c(vals, sav); i <- which.max(sav)
    if (is.null(best) || sav[i] > best$sav) best <- list(sav = sav[i], cuts = cs[i, ], h = h)
  }
  srt <- sort(vals, decreasing = TRUE)
  gap <- if (length(srt) > 1) (srt[1] - srt[2]) / M else Inf
  if (gap <= AMBIG) stop("fixed-order optimum not unique by a margin: ", label, call. = FALSE)
  pos_grade <- 1L + findInterval(seq_len(n) - 1L, best$cuts)
  g <- integer(n); g[order1] <- pos_grade
  list(grade = g, gap = gap, configs = length(vals))
}

rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
timings <- list()

# ---- laws -----------------------------------------------------------------------------------------------------------
# Six fictional sites (pr_tutorial law). Score A is written out (the API's worked example); score B and the SDs are
# read from the package's pr_tutorial.rda with base load(), which does not attach or load postrank.
tut_env <- new.env(); load(file.path(postrank_src, "data", "pr_tutorial.rda"), envir = tut_env)
law <- tut_env$pr_tutorial$law
scoreA <- c(1.20, 0.95, 0.25, 0.15, -0.50, -0.80)
stopifnot(identical(unname(law$means[, "score_A"]), scoreA))
six_means <- unname(law$means); six_sds <- sqrt(t(apply(law$covariance, 3, diag)))
stopifnot(all(abs(six_sds - 0.2) < 1e-15))
o_normal_e <- function(means, sds) {
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
six_ids <- LETTERS[1:6]
e6 <- r15(o_normal_e(six_means, six_sds)); e6a <- e6[, , 1, drop = FALSE]; e6b <- e6[, , 2, drop = FALSE]
E6A <- earr(e6a, six_ids, "score_A"); E6 <- earr(e6, six_ids, c("score_A", "score_B"))
stopifnot(abs(e6a[1, 2, 1] - 0.188) < 5e-4)                                    # e_AB = .188 (API worked example)

# Theory book ch. 10: three units, orders ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10 (masses over 20), no ties.
o_order_law <- function(orders, masses, ids) {
  n <- length(ids); den <- sum(masses); cnt <- matrix(0, n, n)
  for (s in seq_along(orders)) {
    v <- numeric(n); v[match(strsplit(orders[s], "")[[1]], ids)] <- n:1
    cnt <- cnt + masses[s] * outer(v, v, "<=")
  }
  e <- cnt / den; diag(e) <- NA; array(e, c(n, n, 1))
}
e3 <- o_order_law(c("ABC", "ACB", "BAC", "CBA"), c(12, 3, 3, 2), c("A", "B", "C"))
stopifnot(all.equal(e3[, , 1][cbind(c(1, 2, 1), c(2, 3, 3))], c(1/4, 1/4, 1/10)))   # forward errors 1/4, 1/4, 1/10

# Theory book ch. 14/16: four units, two criteria, states (ABCD, ACBD) w.p. 3/4 and (BACD, DCBA) w.p. 1/4.
o_two_state <- function() {
  ids <- c("A", "B", "C", "D"); vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], ids)] <- 4:1; v }
  st <- list(list(c("ABCD", "ACBD"), 3), list(c("BACD", "DCBA"), 1)); e <- array(0, c(4, 4, 2))
  for (s in st) for (k in 1:2) { v <- vals(s[[1]][k]); e[, , k] <- e[, , k] + s[[2]] * outer(v, v, "<=") }
  e <- e / 4; for (k in 1:2) diag(e[, , k]) <- NA; e
}
e4 <- o_two_state(); w4 <- c(3/5, 2/5); abcd <- c("A", "B", "C", "D")
E4 <- earr(e4, abcd, c("c1", "c2"))

# Eight fictional sites, two criteria, independent normals with unequal SDs (n = 8: the unrestricted budget).
m8 <- cbind(c(1.20, 0.95, 0.25, 0.15, -0.50, -0.80, 0.60, -0.10), c(0.70, 0.40, 0.90, 0.60, -0.50, -0.70, 0.20, 0.10))
s8 <- matrix(c(0.20, 0.25, 0.30, 0.20, 0.25, 0.30, 0.20, 0.25), 8, 2)
e8 <- r15(o_normal_e(m8, s8)); E8 <- earr(e8, LETTERS[1:8], c("k1", "k2"))

# Twelve California schools (pr_case_cde$input$e: precomputed chronic-absence probabilities), read with base load().
cde_env <- new.env(); load(file.path(postrank_src, "data", "pr_case_cde.rda"), envir = cde_env)
cde_in <- cde_env$pr_case_cde$input
e12 <- r15(unname(cde_in$e)); cde_ids <- cde_in$entity_ids
stopifnot(identical(dim(e12), c(12L, 12L, 1L)), max(abs(e12 - unname(cde_in$e)), na.rm = TRUE) < 1e-15)
E12 <- earr(e12, cde_ids, cde_in$criterion_ids)
assert_no_postrank()

# ---- exactOptimum ----------------------------------------------------------------------------------------------------
ex_row <- function(id, Earg, w, tau, f, opt, q = NULL, pkg = FALSE, tieTol = NULL) {
  a <- list(E = Earg, tau = tau, w = vec(w), family = f); if (!is.null(q)) a$q <- vec(q); if (!is.null(tieTol)) a$tieTol <- tieTol
  if (isTRUE(opt$empty)) {
    exp <- list(empty = TRUE, familySize = 0)
  } else {
    exp <- list(grade = vec(opt$grade), grades = grade_list(opt$grades), risk = opt$risk, familySize = opt$size,
                containsAllWithheld = o_has_withheld(f), label = "exact-within-family")
  }
  if (pkg) { a$arraySource <- "package"; exp <- list(pkg = exp) }
  add(row(paste0("exactOptimum-", id), "exactOptimum", a, exp))
}
R6 <- o_all_reports(6); ev6 <- o_eval_chunk(R6, e6)
stopifnot(nrow(R6) == 4683)
fams6 <- c(list(fam_all()), lapply(2:4, fam_atmost), lapply(2:6, fam_exactly))
taus <- c(0.05, 0.15, 0.20, 0.25, 0.40, 0.50)
optA <- list()
for (f in fams6) for (tau in taus) {
  id <- sprintf("six-A-%s-tau%s", fam_label(f), fmt_tau(tau))
  o <- o_optimum(R6, ev6$E[, 1, drop = FALSE], ev6$N, 1, tau, f, label = id); optA[[id]] <- o
  ex_row(id, E6A, 1, tau, f, o)
}
# Theory book ch. 16: with the full family and no latent ties, a strict report is optimal at tau = 1/2.
stopifnot(optA[["six-A-all-tau.50"]]$N == 15)
stopifnot(identical(optA[["six-A-cap3-tau.20"]]$grade, c(1L, 1L, 2L, 2L, 3L, 3L)))   # 1/1/2/2/3/3 at tau .20, cap 3
check_close(optA[["six-A-cap3-tau.20"]]$risk, 0.0416516399454871, 1e-15, "six-site 1/1/2/2/3/3 risk (postrank-selftest)")

# Six sites, two scores.
optAB <- list()
for (w in list(c(0.5, 0.5), c(0.8, 0.2))) for (f in list(fam_all(), fam_atmost(2), fam_atmost(3), fam_exactly(3)))
  for (tau in c(0.05, 0.20, 0.35, 0.40)) {
    id <- sprintf("six-AB-w%s-%s-tau%s", paste(sub("^0", "", w), collapse = ""), fam_label(f), fmt_tau(tau))
    o <- o_optimum(R6, ev6$E, ev6$N, w, tau, f, label = id); optAB[[id]] <- o
    ex_row(id, E6, w, tau, f, o)
  }
# Storyboard P-06: tau = .35, no cap: 1/2/2/3/4/5; it states A above C and B above D with weighted errors .380, .381.
o35 <- optAB[["six-AB-w.5.5-all-tau.35"]]
eb6 <- (e6[, , 1] + e6[, , 2]) / 2
stopifnot(identical(o35$grade, c(1L, 2L, 2L, 3L, 4L, 5L)), nrow(o35$grades) == 1,
          abs(eb6[1, 3] - 0.380) < 5e-4, abs(eb6[2, 4] - 0.381) < 5e-4)
stopifnot(identical(optAB[["six-AB-w.5.5-cap3-tau.40"]]$grade, c(1L, 2L, 1L, 2L, 3L, 3L)))   # P-06: cap 3, tau .40
stopifnot(identical(optAB[["six-AB-w.5.5-cap3-tau.20"]]$grade, c(1L, 1L, 1L, 1L, 2L, 3L)))   # {A-D}/E/F
check_close(optAB[["six-AB-w.5.5-cap3-tau.20"]]$risk, 0.0933, 5e-5, "P-05/P-06: {A-D}/E/F risk .0933")
# Score B alone (weights (0, 1)), cap 3, tau .20: two exact optima 2/2/1/2/3/3 and 1/2/1/1/3/3 at .081571 (P-03).
id <- "six-AB-w0.1-cap3-tau.20"
oB <- o_optimum(R6, ev6$E, ev6$N, c(0, 1), 0.20, fam_atmost(3), label = id); optAB[[id]] <- oB
stopifnot(nrow(oB$grades) == 2, identical(oB$grades[1, ], c(1L, 2L, 1L, 1L, 3L, 3L)), identical(oB$grades[2, ], c(2L, 2L, 1L, 2L, 3L, 3L)),
          abs(oB$risk - 0.081571) < 5e-7)
ex_row(id, E6, c(0, 1), 0.20, fam_atmost(3), oB)
# The order family through exactOptimum (same answer as the fixed-order DP): order A..F and B, A, C, D, E, F.
for (spec in list(list(0:5, 3, NULL, NULL), list(c(1, 0, 2, 3, 4, 5), 3, NULL, NULL), list(0:5, NULL, 3, NULL),
                  list(0:5, 4, NULL, c(2, 1, 1, 2)))) {
  f <- fam_order(spec[[1]], G = spec[[2]], exact = spec[[3]], blocks = spec[[4]])
  id <- sprintf("six-A-%s-tau.20", fam_label(f))
  o <- o_optimum(R6, ev6$E[, 1, drop = FALSE], ev6$N, 1, 0.20, f, label = id)
  cb <- o_contiguous_best(e6a, 1, 0.20, spec[[1]] + 1, blocks = spec[[4]], G = spec[[2]], exact = spec[[3]], label = id)
  stopifnot(nrow(o$grades) == 1, identical(cb$grade, o$grade))
  ex_row(id, E6A, 1, 0.20, f, o)
}

# Theory book ch. 10: tau = 1/5, two optima (1,1,2) and (1,2,2) at 11/60 among the 13 reports.
R3 <- o_all_reports(3); ev3 <- o_eval_chunk(R3, e3)
o3 <- o_optimum(R3, ev3$E, ev3$N, 1, 1/5, fam_all(), label = "tb10")
stopifnot(nrow(R3) == 13, nrow(o3$grades) == 2, identical(o3$grades[1, ], c(1L, 1L, 2L)), identical(o3$grades[2, ], c(1L, 2L, 2L)))
check_close(o3$risk, 11/60, 1e-15, "theory book ch. 10: coherent optimum 11/60")
E3 <- earr(e3, c("A", "B", "C"), "score")
ex_row("tb10-all-tau1/5", E3, 1, 1/5, fam_all(), o3)
o3s <- o_optimum(R3, ev3$E, ev3$N, 1, 1/5, fam_exactly(3), label = "tb10-eq3")
ex_row("tb10-eq3-tau1/5", E3, 1, 1/5, fam_exactly(3), o3s)
ex_row("tb10-cap2-tau1/5", E3, 1, 1/5, fam_atmost(2), o_optimum(R3, ev3$E, ev3$N, 1, 1/5, fam_atmost(2), label = "tb10-cap2"))

# Theory book ch. 14/16 four-unit law (75 reports): tau = 1/4 (A|BC|D, 3/20), tau = 1/10 (a tie of the all-withheld
# report and ABC|D at the first frontier slope), tau = 2/5 (tie at the last slope) and tau = 1/2.
R4 <- o_all_reports(4); ev4 <- o_eval_chunk(R4, e4)
tb14_taus <- list(`1/4` = 1/4, `1/10` = 1/10, `3/20` = 3/20, `2/5` = 2/5, `1/2` = 1/2)
for (lab in names(tb14_taus)) {
  tau <- tb14_taus[[lab]]; id <- paste0("tb14-all-tau", lab)
  o <- o_optimum(R4, ev4$E, ev4$N, w4, tau, fam_all(), label = id)
  if (tau == 1/4) { stopifnot(identical(o$grade, c(1L, 2L, 2L, 3L)), nrow(o$grades) == 1); check_close(o$risk, 3/20, 1e-15, "tb14 3/20") }
  if (tau == 1/10) stopifnot(nrow(o$grades) == 2, identical(o$grades[1, ], c(1L, 1L, 1L, 1L)), identical(o$grades[2, ], c(1L, 1L, 1L, 2L)))
  ex_row(id, E4, w4, tau, fam_all(), o)
}
# An explicit tieTol: every report within .03 of the minimum 3/20 (the ch. 14 table: A|BC|D and the 7/40 reports).
oT <- o_optimum(R4, ev4$E, ev4$N, w4, 1/4, fam_all(), label = "tb14-tieTol", tieTol = 0.03)
stopifnot(nrow(oT$grades) > 1, any(apply(oT$grades, 1, function(g) identical(g, c(1L, 1L, 1L, 2L)))))
ex_row("tb14-all-tau1/4-tieTol.03", E4, w4, 1/4, fam_all(), oT, tieTol = 0.03)
for (G in 1:4) ex_row(sprintf("tb14-cap%d-tau1/4", G), E4, w4, 1/4, fam_atmost(G),
                      o_optimum(R4, ev4$E, ev4$N, w4, 1/4, fam_atmost(G), label = "tb14-cap"))

# Budgets (storyboard P-05; theory book ch. 13): two scores, tau .20.
budget <- function(id, w, f, q, check = NULL) {
  o <- o_optimum(R6, ev6$E, ev6$N, w, 0.20, f, q = q, label = id)
  if (!is.null(check)) check(o)
  ex_row(id, E6, w, 0.20, f, o, q = q)
  invisible(o)
}
budget("six-AB-w.5.5-cap3-tau.20-q1.03", c(0.5, 0.5), fam_atmost(3), c(1, 0.03), function(o)
  stopifnot(o$size == 3, identical(o$grade, c(1L, 1L, 1L, 1L, 2L, 3L)), o$N == 9))
budget("six-AB-w.5.5-cap3-tau.20-q1.02", c(0.5, 0.5), fam_atmost(3), c(1, 0.02), function(o)
  stopifnot(o$size == 2, identical(o$grade, c(1L, 1L, 1L, 1L, 2L, 2L)), o$N == 8, abs(o$risk - 0.0939) < 5e-5, o$E[2] / o$N < 0.00015))
budget("six-AB-w.5.5-eq3-tau.20-q1.02", c(0.5, 0.5), fam_exactly(3), c(1, 0.02), function(o) stopifnot(isTRUE(o$empty)))
budget("six-AB-w.5.5-eq3-tau.20-q1.0267", c(0.5, 0.5), fam_exactly(3), c(1, 0.0267), function(o) stopifnot(isTRUE(o$empty)))
budget("six-AB-w.5.5-eq3-tau.20-q1.03", c(0.5, 0.5), fam_exactly(3), c(1, 0.03), function(o) stopifnot(identical(o$grade, c(1L, 1L, 1L, 1L, 2L, 3L))))
budget("six-AB-w1.0-cap3-tau.20-q1.10", c(1, 0), fam_atmost(3), c(1, 0.10), function(o)
  stopifnot(identical(o$grade, c(1L, 1L, 1L, 1L, 2L, 3L)), abs(o$risk - 0.0906) < 5e-5))
budget("six-AB-w.5.5-cap3-tau.20-q1.1", c(0.5, 0.5), fam_atmost(3), c(1, 1), function(o) stopifnot(o$size == 603))
budget("six-AB-w.5.5-all-tau.20-q.05.05", c(0.5, 0.5), fam_all(), c(0.05, 0.05))
oA_own <- optAB[["six-AB-w1.0-cap3-tau.20"]] %||% o_optimum(R6, ev6$E, ev6$N, c(1, 0), 0.20, fam_atmost(3))
stopifnot(identical(oA_own$grade, c(1L, 1L, 2L, 2L, 3L, 3L)), abs(oA_own$E[2] / oA_own$N - 0.237) < 5e-4)   # fails q_B = .10
stopifnot(abs(e6b[5, 6, 1] - 0.240) < 5e-4, abs(optAB[["six-AB-w.5.5-cap3-tau.20"]]$E[2] / 9 - 0.0267) < 5e-5)

# Eight sites, unrestricted (545,835 reports), tau .20 and .35.
t0 <- proc.time()[["elapsed"]]
acc8 <- o_cloud_scan(8, 8, 1:8, e8, c(0.5, 0.5))
timings$n8_all <- proc.time()[["elapsed"]] - t0
stopifnot(sum(sapply(acc8, function(a) if (is.null(a)) 0 else a$count)) == 545835)
for (tau in c(0.20, 0.35)) {
  o <- o_cloud_optimum(acc8, 8, tau, label = paste("n8", tau))
  ev <- o_report_eval(o$grade, e8, c(0.5, 0.5), tau); check_close(ev$risk, o$risk, 1e-15, "n8 re-evaluation")
  ex_row(sprintf("eight-K2-w.5.5-all-tau%s", fmt_tau(tau)), E8, c(0.5, 0.5), tau, fam_all(), o)
}

# Twelve CDE schools, at most three grades (523,251 reports): tau .20 gives sizes 3/6/3, risk .063774.
t0 <- proc.time()[["elapsed"]]
acc12 <- o_cloud_scan(12, 3, 1:3, e12, 1)
timings$cde_cap3 <- proc.time()[["elapsed"]] - t0
cde_opt <- list()
for (tau in c(0.20, 0.45)) {
  o <- o_cloud_optimum(acc12, 12, tau, label = paste("cde", tau)); cde_opt[[fmt_tau(tau)]] <- o
  stopifnot(o$size == 523251)
  ex_row(sprintf("cde-cap3-tau%s", fmt_tau(tau)), E12, 1, tau, fam_atmost(3), o, pkg = TRUE)
}
o <- cde_opt[[".20"]]
stopifnot(nrow(o$grades) == 1, identical(as.integer(tabulate(o$grade, 3)), c(3L, 6L, 3L)), o$N == 45, abs(o$risk - 0.063774) < 5e-7)
stopifnot(identical(as.integer(tabulate(cde_opt[[".45"]]$grade, 3)), c(4L, 5L, 3L)))   # storyboard: 3/6/3, then 4/5/3
stopifnot(acc12[[49]]$count == 34650, abs(acc12[[49]]$min - 1.8288) < 5e-5, abs(acc12[[49]]$low[2] - 1.9088) < 5e-5)

# ---- weightPath (K = 2): the optimum at each first-criterion weight w1 of a grid, w = (w1, 1 - w1) ----------------
wp_row <- function(id, tau, f, grid) {
  os <- lapply(grid, function(w1) o_optimum(R6, ev6$E, ev6$N, c(w1, 1 - w1), tau, f, label = paste(id, w1)))
  stopifnot(all(sapply(os, function(o) nrow(o$grades) == 1)))         # one optimum per grid weight (no set to compare)
  add(row(paste0("weightPath-", id), "weightPath", list(E = E6, tau = tau, family = f, grid = vec(grid)),
          list(grade = lapply(os, function(o) vec(o$grade)), risk = vec(sapply(os, `[[`, "risk")))))
}
wp_row("six-AB-cap3-tau.20", 0.20, fam_atmost(3), c(0.1, 0.25, 0.5, 0.75, 0.9, 1))
wp_row("six-AB-all-tau.35", 0.35, fam_all(), c(0, 0.2, 0.5, 0.8, 1))

# ---- enumerateReports (canonical, lexicographic) --------------------------------------------------------------------
en_row <- function(id, n, f) {
  R <- o_lexsort(o_all_reports(n)); R <- R[o_in_family(R, f), , drop = FALSE]
  stopifnot(nrow(R) == o_size(n, f))
  add(row(paste0("enumerateReports-", id), "enumerateReports", list(n = n, family = f),
          list(count = nrow(R), reports = grade_list(R))))
}
en_row("n3-all", 3, fam_all()); en_row("n4-all", 4, fam_all()); en_row("n5-eq3", 5, fam_exactly(3))
en_row("n6-cap2", 6, fam_atmost(2)); en_row("n1-all", 1, fam_all())
en_row("n6-order102345-cap3", 6, fam_order(c(1, 0, 2, 3, 4, 5), G = 3))
en_row("n6-order543210", 6, fam_order(5:0))
en_row("n6-order012345-blocks213", 6, fam_order(0:5, blocks = c(2, 1, 3)))
en_row("n5-order40312-eq2", 5, fam_order(c(4, 0, 3, 1, 2), exact = 2))
stopifnot(identical(o_lexsort(o_all_reports(3))[1:3, ], rbind(c(1L, 1L, 1L), c(1L, 1L, 2L), c(1L, 2L, 1L))))

# ---- fixedOrderDP (theory book ch. 14 table: order ABCD, tau 1/4, weights (3/5, 2/5)) -------------------------------
dp_row <- function(id, Earg, e, w, tau, order0, G = NULL, exact = NULL, blocks = NULL, expect_grade = NULL, pkg = FALSE) {
  cb <- o_contiguous_best(e, w, tau, order0 + 1, blocks = blocks, G = G, exact = exact, label = id)
  if (!is.null(expect_grade)) stopifnot(identical(cb$grade, as.integer(expect_grade)))
  ev <- o_report_eval(cb$grade, e, w, tau)
  a <- list(E = Earg, order = vec(order0), tau = tau, w = vec(w))
  if (!is.null(G)) a$G <- G; if (!is.null(exact)) a$exact <- exact; if (!is.null(blocks)) a$blocks <- vec(blocks)
  exp <- list(grade = vec(cb$grade), risk = ev$risk, label = "optimal-within-order")
  if (pkg) { a$arraySource <- "package"; exp <- list(pkg = exp) }
  add(row(paste0("fixedOrderDP-", id), "fixedOrderDP", a, exp))
  invisible(ev)
}
book_exact <- list(c(1, 1, 1, 1), c(1, 1, 1, 2), c(1, 2, 2, 3), c(1, 2, 3, 4))
book_exact_risk <- c(1/4, 7/40, 3/20, 7/40)
book_cap <- list(c(1, 1, 1, 1), c(1, 1, 1, 2), c(1, 2, 2, 3), c(1, 2, 2, 3))
book_cap_risk <- c(1/4, 7/40, 3/20, 3/20)
for (G in 1:4) {
  r1 <- dp_row(sprintf("tb14-ABCD-eq%d-tau1/4", G), E4, e4, w4, 1/4, 0:3, exact = G, expect_grade = book_exact[[G]])
  r2 <- dp_row(sprintf("tb14-ABCD-cap%d-tau1/4", G), E4, e4, w4, 1/4, 0:3, G = G, expect_grade = book_cap[[G]])
  check_close(c(r1$risk, r2$risk), c(book_exact_risk[G], book_cap_risk[G]), 1e-15, paste("theory book ch. 14 table, G =", G))
}
dp_row("tb14-DCBA-cap4-tau1/2", E4, e4, w4, 1/2, 3:0, G = 4, expect_grade = c(1, 1, 1, 1))   # ch. 16: withholds all
dp_row("tb14-DCBA-cap4-tau1/10", E4, e4, w4, 1/10, 3:0, G = 4)
dp_row("six-A-ABCDEF-cap3-tau.20", E6A, e6a, 1, 0.20, 0:5, G = 3, expect_grade = c(1, 1, 2, 2, 3, 3))
dp_row("six-A-ABCDEF-tau.20", E6A, e6a, 1, 0.20, 0:5)
dp_row("six-AB-w.5.5-ABCDEF-cap3-tau.20", E6, e6, c(0.5, 0.5), 0.20, 0:5, G = 3, expect_grade = c(1, 1, 1, 1, 2, 3))
dp_row("six-A-ABCDEF-blocks2112-cap4-tau.20", E6A, e6a, 1, 0.20, 0:5, G = 4, blocks = c(2, 1, 1, 2))
cde_units <- cde_env$pr_case_cde$units; stopifnot(identical(cde_units$entity_id, cde_ids))
dp_row("cde-observed-rate-order-cap3-tau.20", E12, e12, 1, 0.20, order(cde_units$observed_rate, cde_ids, method = "radix") - 1,
       G = 3, pkg = TRUE)

# ---- tau-grid widget: exactOptimum on score A at tau = .02, .03, ..., .50 -------------------------------------------
# Families: no cap (all 4,683 reports of six units) and at most 3 grades (603). Input: data/released/six-sites.json
# arrays.one.e verbatim (what the page reads; within 1e-15 of the base-R array e6a above). The tau values that already
# have six-A rows above (.05, .15, .20, .25, .40, .50) are skipped. Same fields as the rows above (the tie count is the
# length of `grades`); the optimum's N and E are evaluateReport-six-K1-optimum-<family>-tau.XX in oracle-report-risk.
six_rel <- jsonlite::fromJSON(file.path(released_dir, "six-sites.json"), simplifyVector = FALSE)$arrays$one
stopifnot(identical(unlist(six_rel$ids), six_ids), identical(unlist(six_rel$criteria), "score_A"))
# jsonlite's number parser can be 1 ulp off; r15 re-reads each value from its 15-digit text (as JSON.parse does).
e_rel <- r15(array(t(vapply(six_rel$e[[1]], function(r) vapply(r, function(x) if (is.null(x)) NA_real_ else x, 0), numeric(6))),
                   c(6, 6, 1)))
check_close(e_rel, o_normal_e(six_means[, 1, drop = FALSE], six_sds[, 1, drop = FALSE]), 1e-15, "released score A array vs base-R pnorm")
check_close(e_rel, e6a, 1e-15, "released score A array vs the rounded array of the six-A rows")
E6Arel <- earr(e_rel, six_ids, "score_A"); ev_rel <- o_eval_chunk(R6, e_rel)
grid_taus <- (2:50) / 100
new_taus <- grid_taus[!vapply(grid_taus, function(t) any(abs(t - taus) < 1e-12), TRUE)]
stopifnot(length(new_taus) == 43)
for (f in list(fam_all(), fam_atmost(3))) {
  Ns <- c()
  for (tau in new_taus) {
    id <- sprintf("six-A-%s-tau%s", fam_label(f), fmt_tau(tau))
    stopifnot(!(id %in% names(optA)))
    o <- o_optimum(R6, ev_rel$E, ev_rel$N, 1, tau, f, label = id)
    ev <- o_report_eval(o$grade, e_rel, 1, tau); check_close(ev$risk, o$risk, 1e-15, paste("re-evaluation", id))
    Ns <- c(Ns, o$N)
    ex_row(id, E6Arel, 1, tau, f, o)
  }
  stopifnot(!is.unsorted(Ns))                    # disclosure of the optimum never falls as tau rises (exchange argument)
}

# ---- Step 6.14 Part 2 rows (shared inputs in r-export/15_part2.R) --------------------
source("r-export/15_part2.R")
stopifnot(identical(p2$six$e, e_rel))
# G-04 KRW Example 1 (omega_2 = 1, .80, .81, .50; tau = .20, .25): the exact optimum among all 13 reports.
R3k <- o_all_reports(3)
krw_opt <- list()
for (lab in names(p2$krw1_omegas)) for (tau in c(0.20, 0.25)) {
  e_k <- p2$krw1(p2$krw1_omegas[[lab]]); ev_k <- o_eval_chunk(R3k, e_k)
  id <- sprintf("krwex1-omega%s-all-tau%s", lab, fmt_tau(tau))
  o <- o_optimum(R3k, ev_k$E, ev_k$N, 1, tau, fam_all(), label = id); krw_opt[[id]] <- o
  ex_row(id, earr(e_k, c("A", "B", "C"), "score"), 1, tau, fam_all(), o)
}
stopifnot(nrow(krw_opt[["krwex1-omega1-all-tau.20"]]$grades) == 2,                          # G-04: two optima at omega_2 = 1
          identical(krw_opt[["krwex1-omega1-all-tau.20"]]$grades[1, ], c(1L, 1L, 2L)),
          identical(krw_opt[["krwex1-omega1-all-tau.20"]]$grades[2, ], c(1L, 2L, 2L)),
          nrow(krw_opt[["krwex1-omega.80-all-tau.20"]]$grades) == 1)
# G-08 four-unit law (ch. 14), weights (3/5, 2/5): exactly 4 grades among all reports (the 24 strict orders) at tau = 1/4.
o_eq4 <- o_optimum(R4, ev4$E, ev4$N, w4, 1/4, fam_exactly(4), label = "tb14-eq4")
stopifnot(o_eq4$size == 24); check_close(o_eq4$risk, 7/40, 1e-15, "G-08: best strict order 7/40")
ex_row("tb14-eq4-tau1/4", E4, w4, 1/4, fam_exactly(4), o_eq4)
# G-06 the same law over the tau the frontier page can show: tau = .01, ..., .50 (the values with rows above, 1/10,
# 3/20, 1/4, 2/5, 1/2, are skipped).
for (tau in (1:50) / 100) {
  if (any(abs(tau - c(1/10, 3/20, 1/4, 2/5, 1/2)) < 1e-12)) next
  id <- sprintf("tb14-all-tau%s", fmt_tau(tau))
  ex_row(id, E4, w4, tau, fam_all(), o_optimum(R4, ev4$E, ev4$N, w4, tau, fam_all(), label = id))
}
check_close(o_optimum(R4, ev4$E, ev4$N, w4, 0.20, fam_all())$risk, 17/120, 1e-15, "G-06: 17/120 at tau .20")
# G-08 contiguous cuts of B, A, C, D, E, F (no cap) on the released score-A array: 1/1/2/2/3/4, risk .0379.
r_bac <- dp_row("six-A-BACDEF-tau.20", E6Arel, e_rel, 1, 0.20, c(1, 0, 2, 3, 4, 5), expect_grade = c(1, 1, 2, 2, 3, 4))
check_close(r_bac$risk, 0.0379, 5e-5, "G-08: B, A, C, D, E, F cuts .0379")

assert_no_postrank()
write_golden("oracle-optimize", rows, generator = "r-export/04_optimize.R", uses_postrank = FALSE)
cat("oracle-optimize:", length(rows), "rows\n")
cat(sprintf("timings (s): n = 8 unrestricted scan %.2f; CDE n = 12 at most 3 scan %.2f\n", timings$n8_all, timings$cde_cap3))

# ---- postrank 1.1.0 ----------------------------------------------------------------------------------------------
load_postrank()
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
check_close(pr_tutorial$two$e, o_normal_e(six_means, six_sds), 1e-15, "base-R six-site errors vs pr_tutorial$two$e")
check_close(pr_case_cde$input$e, cde_in$e, 0, "base load() CDE array equals the package dataset")

# Archived package optima (cached analyses, HiGHS) against the base-R enumeration.
cached <- function(key) readRDS(system.file("extdata", "cached", paste0(key, ".rds"), package = "postrank"))$value
cde_fit <- cached("case_cde_12")
stopifnot(identical(unname(get_grades(cde_fit)), cde_opt[[".20"]]$grade), cde_fit$settings$G_max == 3, cde_fit$settings$tau == 0.2)
check_close(cde_fit$evaluation$primary_risk, cde_opt[[".20"]]$risk, 1e-12, "CDE: archived optimum risk vs base-R enumeration")
tf <- cached("tutorial_frontier")$table
for (r in seq_len(nrow(tf))) {
  o <- o_optimum(R6, ev6$E, ev6$N, c(0.5, 0.5), tf$tau[r], fam_atmost(3), label = "tutorial_frontier")
  stopifnot(o$N == tf$N[r], max(o$grade) == tf$G[r])
  check_close(o$risk, tf$primary_risk[r], 1e-12, paste("tutorial_frontier tau", tf$tau[r]))
  padd(row(sprintf("exactOptimumArchived-tutorial_frontier-tau%s", fmt_tau(tf$tau[r])), "exactOptimumArchived",
           list(E = earr(unname(pr_tutorial$two$e), six_ids, pr_tutorial$two$criterion_ids), tau = tf$tau[r], w = vec(c(0.5, 0.5)),
                family = fam_atmost(3)),
           list(risk = tf$primary_risk[r], N = tf$N[r], G = tf$G[r])))
}
padd(row("exactOptimumArchived-case_cde_12-tau.20", "exactOptimumArchived",
         list(E = earr(unname(pr_case_cde$input$e), cde_ids, pr_case_cde$input$criterion_ids), tau = 0.2, w = vec(1),
              family = fam_atmost(3), arraySource = "package"),
         list(pkg = list(grade = vec(unname(get_grades(cde_fit))), risk = cde_fit$evaluation$primary_risk,
                         N = cde_fit$evaluation$N, G = 3L))))

# postrank_cuts(rule = "optimal") on fixed orders -> fixedOrderDP. The order is the package's
# order(scores, entity id); exactly equal scores form indivisible blocks (passed as `blocks`).
cuts_row <- function(id, scores, pw, w, tau, G_max = NULL, exact_G = NULL, direction, pkg = FALSE, slice = NULL, check = NULL) {
  s <- postrank_settings(setNames(w, pw$criterion_ids), tau = tau, G_max = as.integer(if (is.null(G_max)) exact_G else G_max),
                         exact_G = if (is.null(exact_G)) NULL else as.integer(exact_G))
  res <- postrank_cuts(scores, pw, s, direction = direction, rule = "optimal")
  ids <- pw$entity_ids; sc <- unname(scores[ids])
  ord1 <- order(if (direction == "descending") -sc else sc, ids, method = "radix")
  stopifnot(identical(res$order, ids[ord1]))
  blocks <- rle(sc[ord1])$lengths
  g <- unname(res$grade[ids])
  # Engine input: the criteria used (slice drops zero-weight criteria; their terms are exact zeros in the package).
  ks <- if (is.null(slice)) seq_along(pw$criterion_ids) else slice
  e <- unname(pw$e)[, , ks, drop = FALSE]; wk <- w[ks]
  er <- r15(e)
  cb <- o_contiguous_best(er, wk, tau, ord1, blocks = if (any(blocks > 1)) blocks else NULL, G = G_max, exact = exact_G, label = id)
  stopifnot(identical(cb$grade, g))
  ev <- o_report_eval(g, er, wk, tau)
  check_close(res$risk, ev$risk, 1e-12, paste("postrank_cuts risk vs base R", id))
  check_close(res$risk, res$evaluation$weighted_risk, 1e-13, paste("postrank_cuts risk vs its evaluation", id))
  if (!is.null(check)) check(res, g)
  a <- list(E = earr(e, ids, pw$criterion_ids[ks]), order = vec(ord1 - 1L), tau = tau, w = vec(wk))
  if (!is.null(G_max)) a$G <- G_max; if (!is.null(exact_G)) a$exact <- exact_G
  if (any(blocks > 1)) a$blocks <- vec(blocks)
  exp <- list(grade = vec(g), risk = res$risk, label = "optimal-within-order")
  if (pkg) { a$arraySource <- "package"; exp <- list(pkg = exp) }
  padd(row(paste0("fixedOrderDP-", id), "fixedOrderDP", a, exp))
  invisible(list(res = res, gap = cb$gap, configs = cb$configs))
}
one <- pr_tutorial$one; two <- pr_tutorial$two
pm <- setNames(one$means[, 1], one$entity_ids)
for (tau in c(0.05, 0.20, 0.40)) for (G in c(2, 3, 6))
  cuts_row(sprintf("six-A-pmorder-cap%d-tau%s", G, fmt_tau(tau)), pm, one, 1, tau, G_max = G, direction = "descending")
cuts_row("six-A-pmorder-eq3-tau.20", pm, one, 1, 0.20, exact_G = 3L, direction = "descending")
cuts_row("six-A-pmorder-eq5-tau.40", pm, one, 1, 0.40, exact_G = 5L, direction = "descending")
bacdef <- c(A = 2, B = 1, C = 3, D = 4, E = 5, F = 6)
for (tau in c(0.20, 0.40)) cuts_row(sprintf("six-A-BACDEF-cap3-tau%s", fmt_tau(tau)), bacdef, one, 1, tau, G_max = 3, direction = "ascending")
cuts_row("six-A-BACDEF-cap6-tau.20", bacdef, one, 1, 0.20, G_max = 6, direction = "ascending")
comp <- postrank_composite(two$means, weights = c(score_A = 0.5, score_B = 0.5))
stopifnot(all(abs(unname(comp) - c(0.95, 0.675, 0.575, 0.375, -0.5, -0.75)) < 1e-12))
cuts_row("six-AB-w.5.5-composite-cap3-tau.20", comp, two, c(0.5, 0.5), 0.20, G_max = 3, direction = "descending",
         check = function(res, g) stopifnot(identical(g, c(1L, 1L, 1L, 1L, 2L, 3L))))
cuts_row("six-AB-w.8.2-BACDEF-cap4-tau.35", bacdef, two, c(0.8, 0.2), 0.35, G_max = 4, direction = "ascending")
er2 <- postrank_expected_rank(two, c(score_A = 0.5, score_B = 0.5))
cuts_row("six-AB-w.5.5-exprank-eq3-tau.25", er2, two, c(0.5, 0.5), 0.25, exact_G = 3L, direction = "ascending")
# Tied scores: exactly equal scores are never split (blocks).
tied <- c(A = 1, B = 1, C = 2, D = 2, E = 3, F = 4)
cuts_row("six-A-tied112234-cap3-tau.20", tied, one, 1, 0.20, G_max = 3, direction = "ascending",
         check = function(res, g) stopifnot(length(res$score_blocks) == 4, g[1] == g[2], g[3] == g[4]))
cuts_row("six-A-tied112234-eq3-tau.20", tied, one, 1, 0.20, exact_G = 3L, direction = "ascending")
tied2 <- c(A = 5, B = 3, C = 3, D = 3, E = 1, F = 1)
cuts_row("six-AB-w.5.5-tied533311-desc-cap3-tau.40", tied2, two, c(0.5, 0.5), 0.40, G_max = 3, direction = "descending")
# 30 Gaussian sites, poverty criterion (weights 1, 0, 0), expected-rank order, at most 4 grades, tau .25.
gs <- pr_example_gaussian
wp <- c(poverty = 1, frl = 0, snap = 0)
erp <- postrank_expected_rank(gs, wp)
t0 <- proc.time()[["elapsed"]]
g30 <- cuts_row("gauss30-poverty-exprank-cap4-tau.25", erp, gs, unname(wp), 0.25, G_max = 4, direction = "ascending", slice = 1)
cuts_row("gauss30-poverty-exprank-eq2-tau.25", erp, gs, unname(wp), 0.25, exact_G = 2L, direction = "ascending", slice = 1)
cuts_row("gauss30-poverty-exprank-cap6-tau.10", erp, gs, unname(wp), 0.10, G_max = 6, direction = "ascending", slice = 1)
timings$gauss30 <- proc.time()[["elapsed"]] - t0
# Alabama (67 counties, two criteria): weighted expected-rank order, w = (1/2, 1/2), tau .20, at most 5 grades.
al <- pr_case_alabama
wa <- c(income = 0.5, incarceration = 0.5)
era <- postrank_expected_rank(al$input, wa)
t0 <- proc.time()[["elapsed"]]
ala <- cuts_row("alabama-exprank-cap5-tau.20", era, al$input, unname(wa), 0.20, G_max = 5, direction = "ascending", pkg = TRUE,
                check = function(res, g) stopifnot(identical(g, unname(al$reference$actions$B3[al$input$entity_ids])), res$evaluation$N == 1249))
timings$alabama <- proc.time()[["elapsed"]] - t0
check_close(ala$res$risk, al$reference$metrics$A_Rtau[al$reference$metrics$method == "B3"], 1e-12,
            "Alabama: postrank_cuts risk vs archived B3 metric")

write_golden("postrank-optimize", prow, generator = "r-export/04_optimize.R", uses_postrank = TRUE)
cat("postrank-optimize:", length(prow), "rows\n")
cat(sprintf("brute-force contiguous checks: 30 sites %d cut sets, Alabama %d cut sets (%.2f s); min runner-up gaps %.2g, %.2g\n",
            g30$configs, ala$configs, timings$alabama, g30$gap, ala$gap))
