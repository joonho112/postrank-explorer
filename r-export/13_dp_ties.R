# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for the tie rules of the fixed-order DP and the order family (Step 2.12; review findings E-1, E-3,
# E-6, E-8, E-11, E-12, E-15, E-22).
#   oracle-ties       base R only: the fixedOrderDP trace (W, V, riskByG) of the theory book ch. 14 four-unit example
#                     from the book's recursion; every tied optimum of an order family (contiguous cut sets, exact
#                     arithmetic: dyadic or rational inputs, ties within 1e-12 and nothing in (1e-13, 1e-10]); the
#                     package tie rule (fewer grades, then the earlier cut) written from the theory book ch. 14 and
#                     engine/API.md; orderHull with exact counts, blocks and scores; weightBreakpoints (K = 2) as the
#                     lower envelope of the lines w R_1 + (1 - w) R_2, checked on a grid of 10,001 weights; the
#                     maxTies cap; empty families; family.size as a number or a decimal string. postrank not loaded.
#   postrank-dp-ties  postrank 1.1.0: .pr_cuts_core (the package's contiguous-partition DP, R/baselines.R) on exact
#                     ties (the ch. 10 law along A, B, C at tau = 1/5; a fewer-grades tie; the all-withheld tie) and on
#                     the one-ulp case of E-11 (fixedOrderDP with tieTol = 0); its order and exact-score blocks
#                     against scoreOrder; postrank_cuts against fixedOrderDP given scores.
# Conventions (engine/API.md): grade 1 = highest priority; units 0-based in code; E = { ids, criteria, e } with
# e[k][i][j] = Pr(theta_ik <= theta_jk) and a null (NaN) diagonal. JSON keeps 15 significant digits, so an input one
# ulp off a decimal is written {"$sum": [a, b]} (a + b in double precision, decoded by the adapter).
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
r15 <- function(x) { y <- x; ok <- !is.na(x); y[ok] <- as.numeric(sprintf("%.15g", x[ok])); y }
grade_list <- function(G) lapply(seq_len(nrow(G)), function(r) vec(G[r, ]))
lexsort <- function(G) G[do.call(order, unname(as.data.frame(G))), , drop = FALSE]
fam_order <- function(order0, G = NULL, exact = NULL, blocks = NULL) {
  f <- list(kind = "order", order = vec(order0))
  if (!is.null(G)) f$G <- G; if (!is.null(exact)) f$exact <- exact; if (!is.null(blocks)) f$blocks <- vec(blocks)
  f
}
TIE <- 1e-12; AMBIG <- 1e-10

# ---- laws -----------------------------------------------------------------------------------------------------------
o_order_law <- function(orders, masses, ids) {      # theory book ch. 10: a law over strict orders (top first)
  n <- length(ids); den <- sum(masses); cnt <- matrix(0, n, n)
  for (s in seq_along(orders)) { v <- numeric(n); v[match(strsplit(orders[s], "")[[1]], ids)] <- n:1; cnt <- cnt + masses[s] * outer(v, v, "<=") }
  e <- cnt / den; diag(e) <- NA; array(e, c(n, n, 1))
}
e3 <- o_order_law(c("ABC", "ACB", "BAC", "CBA"), c(12, 3, 3, 2), c("A", "B", "C"))   # forward errors 1/4, 1/4, 1/10
stopifnot(identical(e3[1, 2, 1], e3[2, 3, 1]), all.equal(e3[1, 3, 1], 1/10))
E3 <- earr(e3, c("A", "B", "C"), "score")
o_two_state <- function() {                          # theory book ch. 14/16 four-unit law, two criteria
  ids <- c("A", "B", "C", "D"); vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], ids)] <- 4:1; v }
  st <- list(list(c("ABCD", "ACBD"), 3), list(c("BACD", "DCBA"), 1)); e <- array(0, c(4, 4, 2))
  for (s in st) for (k in 1:2) { v <- vals(s[[1]][k]); e[, , k] <- e[, , k] + s[[2]] * outer(v, v, "<=") }
  e <- e / 4; for (k in 1:2) diag(e[, , k]) <- NA; e
}
e4 <- o_two_state(); w4 <- c(3/5, 2/5); E4 <- earr(e4, c("A", "B", "C", "D"), c("c1", "c2"))
tie_free <- function(fwd, n) {                       # e from forward errors e_ij (i < j, index order); e_ji = 1 - e_ij
  e <- matrix(NA_real_, n, n); k <- 0
  for (i in 1:(n - 1)) for (j in (i + 1):n) { k <- k + 1; e[i, j] <- fwd[k]; e[j, i] <- 1 - fwd[k] }
  array(e, c(n, n, 1))
}
# Fewer-grades tie (dyadic, so every sum is exact): order A, B, C, D, tau 1/4, A's pairs 1/8, the others 1/4. Separating
# A saves 3 x 1/8; any further cut among B, C, D costs exactly 0, so 1/2/2/2, 1/2/2/3, 1/2/3/3 and 1/2/3/4 tie.
efg <- tie_free(c(0.125, 0.125, 0.125, 0.25, 0.25, 0.25), 4); Efg <- earr(efg, c("A", "B", "C", "D"), "score")
# All-withheld tie: tau 1/4, e_AB = e_AC = 1/4, e_BC = 1/2: 1/1/1 and 1/2/2 both have risk 1/4.
eaw <- tie_free(c(0.25, 0.25, 0.5), 3); Eaw <- earr(eaw, c("A", "B", "C"), "score")
# Six fictional sites (pr_tutorial law, read with base load()).
tut_env <- new.env(); load(file.path(postrank_src, "data", "pr_tutorial.rda"), envir = tut_env)
law <- tut_env$pr_tutorial$law
six_means <- unname(law$means); six_sds <- sqrt(t(apply(law$covariance, 3, diag)))
o_normal_e <- function(means, sds) {
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
six_ids <- LETTERS[1:6]
e6 <- r15(o_normal_e(six_means, six_sds)); e6a <- e6[, , 1, drop = FALSE]
E6A <- earr(e6a, six_ids, "score_A"); E6 <- earr(e6, six_ids, c("score_A", "score_B"))
assert_no_postrank()

# ---- base-R oracle --------------------------------------------------------------------------------------------------
wsum <- function(e, w) { out <- w[1] * e[, , 1]; if (dim(e)[3] > 1) for (k in 2:dim(e)[3]) out <- out + w[k] * e[, , k]; out }
o_eval <- function(g, e, w, tau) { n <- length(g); M <- n * (n - 1) / 2; x <- outer(g, g, "<"); eb <- wsum(e, w)
  N <- sum(x); Ew <- sum(eb[x]); list(N = N, Ew = Ew, risk = (Ew + tau * (M - N)) / M) }
# Every contiguous cut set of an order (cuts only between blocks), with its grade vector, number of grades and risk.
o_order_family <- function(e, w, tau, order1, blocks = NULL, G = NULL, exact = NULL) {
  n <- length(order1); if (is.null(blocks)) blocks <- rep(1L, n)
  B <- length(blocks); inner <- cumsum(blocks)[-B]
  hs <- if (!is.null(exact)) exact else seq_len(min(if (is.null(G)) B else G, B))
  hs <- hs[hs >= 1 & hs <= B]
  out <- list()
  for (h in hs) {
    cs <- if (h == 1) list(integer()) else { ix <- combn(B - 1, h - 1, simplify = FALSE); lapply(ix, function(z) z) }
    for (bc in cs) {                                  # bc: block positions of the cuts (the package's `cuts`)
      unit_cuts <- if (length(bc)) inner[bc] else integer()
      g <- integer(n); g[order1] <- 1L + findInterval(seq_len(n) - 1L, unit_cuts)
      ev <- o_eval(g, e, w, tau)
      out[[length(out) + 1L]] <- list(grade = g, G = h, blockCuts = as.integer(bc), cuts = as.integer(unit_cuts), risk = ev$risk, N = ev$N, Ew = ev$Ew)
    }
  }
  out
}
# Tied optima (within 1e-12, nothing in the ambiguous band) and the package rule: fewer grades, then the
# lexicographically earlier vector of cut positions.
o_order_optimum <- function(fam, label = "", tie = TIE) {
  r <- vapply(fam, `[[`, 0, "risk"); d <- r - min(r)
  if (any(d > 1e-13 & d <= AMBIG & d > tie)) stop("ambiguous near-tie: ", label, call. = FALSE)
  opt <- fam[d <= tie]
  Gs <- vapply(opt, `[[`, 0, "G"); best <- opt[Gs == min(Gs)]
  if (length(best) > 1) {
    cm <- do.call(rbind, lapply(best, `[[`, "blockCuts")); best <- best[do.call(order, unname(as.data.frame(cm)))[1]]
  }
  grades <- lexsort(do.call(rbind, lapply(opt, `[[`, "grade")))
  list(chosen = best[[1]], grades = grades, tieCount = length(opt), risk = min(r))
}

rows <- list(); add <- function(r) rows[[length(rows) + 1L]] <<- r
dp_expect <- function(o) list(grade = vec(o$chosen$grade), risk = o$chosen$risk, grades = grade_list(o$grades), gradesOrder = "lexicographic",
                              tieCount = o$tieCount, label = "optimal-within-order")

# ---- fixedOrderDP: tied optima and the package rule ------------------------------------------------------------------
# Theory book ch. 10 law along A, B, C at tau = 1/5: 1/1/2 and 1/2/2 both have risk 11/60 (cross sums
# (1/4 - 1/5) + (1/10 - 1/5) and (1/10 - 1/5) + (1/4 - 1/5)); the earlier cut gives 1/2/2.
f10 <- o_order_family(e3, 1, 1/5, 1:3, G = 3); o10 <- o_order_optimum(f10, "tb10")
stopifnot(identical(o10$chosen$grade, c(1L, 2L, 2L)), o10$tieCount == 2L); check_close(o10$risk, 11/60, 1e-15, "ch. 10: 11/60")
add(row("fixedOrderDP-tb10-ABC-cap3-tau1/5", "fixedOrderDP", list(E = E3, order = vec(0:2), tau = 1/5, w = vec(1), G = 3L), dp_expect(o10)))
add(row("fixedOrderDP-tb10-ABC-family-cap3-tau1/5", "fixedOrderDP", list(E = E3, tau = 1/5, w = vec(1), family = fam_order(0:2, G = 3L)), dp_expect(o10)))
add(row("fixedOrderDP-tb10-ABC-uncapped-tau1/5", "fixedOrderDP", list(E = E3, order = vec(0:2), tau = 1/5, w = vec(1)), dp_expect(o10)))
add(row("fixedOrderDP-tb10-ABC-tieTol0-tau1/5", "fixedOrderDP", list(E = E3, order = vec(0:2), tau = 1/5, w = vec(1), tieTol = 0), dp_expect(o10)))
# The same order through exactOptimum's order family: grade by the package rule, grades lexicographic.
add(row("exactOptimum-tb10-orderABC-tau1/5", "exactOptimum", list(E = E3, tau = 1/5, w = vec(1), family = fam_order(0:2)),
        list(grade = vec(o10$chosen$grade), grades = grade_list(o10$grades), tieCount = o10$tieCount, risk = o10$risk, label = "exact-within-family")))
# Fewer grades on a tie: 1/2/2/2 (two grades) over 1/2/2/3, 1/2/3/3 (three) and 1/2/3/4 (four).
ffg <- o_order_family(efg, 1, 1/4, 1:4, G = 4); ofg <- o_order_optimum(ffg, "fewer-grades")
stopifnot(identical(ofg$chosen$grade, c(1L, 2L, 2L, 2L)), ofg$tieCount == 4L, ofg$risk == (0.25 * 3 + 0.125 * 3) / 6)
add(row("fixedOrderDP-fewer-grades-ABCD-cap4-tau1/4", "fixedOrderDP", list(E = Efg, order = vec(0:3), tau = 0.25, w = vec(1), G = 4L), dp_expect(ofg)))
add(row("exactOptimum-fewer-grades-orderABCD-tau1/4", "exactOptimum", list(E = Efg, tau = 0.25, w = vec(1), family = fam_order(0:3)),
        list(grade = vec(ofg$chosen$grade), grades = grade_list(ofg$grades), tieCount = ofg$tieCount, risk = ofg$risk, label = "exact-within-family")))
# Exactly three grades: 1/2/3/3 (cuts 1, 2) before 1/2/2/3 (cuts 1, 3).
ffg3 <- o_order_family(efg, 1, 1/4, 1:4, exact = 3); ofg3 <- o_order_optimum(ffg3, "fewer-grades-eq3")
stopifnot(identical(ofg3$chosen$grade, c(1L, 2L, 3L, 3L)), ofg3$tieCount == 2L)
add(row("fixedOrderDP-fewer-grades-ABCD-eq3-tau1/4", "fixedOrderDP", list(E = Efg, order = vec(0:3), tau = 0.25, w = vec(1), exact = 3L), dp_expect(ofg3)))
# Reversed order D, C, B, A: the tie set is the mirror; the earlier cut now separates D, C, B from A last.
ffgr <- o_order_family(efg, 1, 1/4, 4:1, G = 4); ofgr <- o_order_optimum(ffgr, "fewer-grades-DCBA")
add(row("fixedOrderDP-fewer-grades-DCBA-cap4-tau1/4", "fixedOrderDP", list(E = Efg, order = vec(3:0), tau = 0.25, w = vec(1), G = 4L), dp_expect(ofgr)))
# All-withheld on a tie: 1/1/1 (one grade) over 1/2/2.
faw <- o_order_family(eaw, 1, 1/4, 1:3, G = 3); oaw <- o_order_optimum(faw, "all-withheld")
stopifnot(identical(oaw$chosen$grade, c(1L, 1L, 1L)), oaw$tieCount == 2L)
add(row("fixedOrderDP-all-withheld-tie-ABC-cap3-tau1/4", "fixedOrderDP", list(E = Eaw, order = vec(0:2), tau = 0.25, w = vec(1), G = 3L), dp_expect(oaw)))
# E-11, default tieTol (1e-12): e_AB = 0.1 + 0.2 and e_BC = 0.3 differ by one ulp, a tie in exact arithmetic, so the
# earlier cut 1/2/2 is chosen and both reports are listed (the package, comparing floats exactly, gives 1/1/2; that
# row is in postrank-dp-ties with tieTol = 0).
e_ulp <- function(eAB, eBC) tie_free(c(eAB, 0.05, eBC), 3)
SUM <- function(a, b) list(`$sum` = vec(c(a, b)))
ulp_E <- function(ab_sum) {                          # e as nested lists, e_AB or e_BC written as 0.1 + 0.2 (1 - (0.1 + 0.2) is the double 0.7)
  m <- list(list(NA, NA, 0.05), list(NA, NA, NA), list(0.95, NA, NA))
  if (ab_sum) { m[[1]][[2]] <- SUM(0.1, 0.2); m[[2]][[1]] <- 0.7; m[[2]][[3]] <- 0.3; m[[3]][[2]] <- 0.7 }
  else { m[[1]][[2]] <- 0.3; m[[2]][[1]] <- 0.7; m[[2]][[3]] <- SUM(0.1, 0.2); m[[3]][[2]] <- 0.7 }
  list(ids = vec(c("A", "B", "C")), criteria = vec("score"), e = list(m))
}
fu <- o_order_family(e_ulp(0.1 + 0.2, 0.3), 1, 0.25, 1:3, G = 3); ou <- o_order_optimum(fu, "ulp")
stopifnot(identical(ou$chosen$grade, c(1L, 2L, 2L)), ou$tieCount == 2L)
add(row("fixedOrderDP-ulp-eAB.1+.2-default-tieTol", "fixedOrderDP", list(E = ulp_E(TRUE), order = vec(0:2), tau = 0.25, w = vec(1), G = 3L),
        list(grade = vec(ou$chosen$grade), grades = grade_list(ou$grades), tieCount = ou$tieCount, label = "optimal-within-order")))

# ---- fixedOrderDP trace: theory book ch. 14 four-unit example (order ABCD, w = (3/5, 2/5), tau = 1/4) ------------------
# eta_st = ebar(rho_s, rho_t) - tau; W(a, b) = sum_{a < s < t <= b} eta_st for boundaries 0 <= a < b <= m;
# V_0(0) = 0, V_h(c) = max_{h - 1 <= b < c} V_{h-1}(b) + W(b, c) (-Inf when c < h); T = W(0, m);
# riskByG[h] = tau + (T - V_h(m))/M, the best report with exactly h grades.
o_trace <- function(e, w, tau, order1, H) {
  n <- length(order1); M <- n * (n - 1) / 2; eta <- wsum(e, w)[order1, order1] - tau
  W <- matrix(NA_real_, n + 1, n + 1)
  for (a in 0:(n - 1)) for (b in (a + 1):n) { s <- 0; if (b - a >= 2) for (p in (a + 1):(b - 1)) for (q in (p + 1):b) s <- s + eta[p, q]; W[a + 1, b + 1] <- s }
  V <- matrix(-Inf, H + 1, n + 1); V[1, 1] <- 0
  for (h in 1:H) for (c in h:n) V[h + 1, c + 1] <- max(vapply((h - 1):(c - 1), function(b) V[h, b + 1] + W[b + 1, c + 1], 0))
  T <- W[1, n + 1]
  list(M = M, T = T, W = W, V = V, riskByG = vapply(1:H, function(h) tau + (T - V[h + 1, n + 1]) / M, 0))
}
tr <- o_trace(e4, w4, 1/4, 1:4, 4)
check_close(tr$riskByG, c(1/4, 7/40, 3/20, 7/40), 1e-15, "theory book ch. 14 table: best risk with exactly G grades")
Wup <- unlist(lapply(0:3, function(a) vapply((a + 1):4, function(b) tr$W[a + 1, b + 1], 0)))   # W(a, b), a < b, row-major
Vj <- lapply(seq_len(nrow(tr$V)), function(h) vec(ifelse(is.finite(tr$V[h, ]), tr$V[h, ], NA)))
add(row("fixedOrderDPTrace-tb14-ABCD-cap4-tau1/4", "fixedOrderDPTrace", list(E = E4, order = vec(0:3), tau = 1/4, w = vec(w4), G = 4L),
        list(M = tr$M, T = tr$T, Wupper = vec(Wup), V = Vj, riskByG = vec(tr$riskByG), chosenG = 3L, grade = vec(c(1, 2, 2, 3)), risk = 3/20)))
tr2 <- o_trace(e4, w4, 1/4, 1:4, 2)
add(row("fixedOrderDPTrace-tb14-ABCD-cap2-tau1/4", "fixedOrderDPTrace", list(E = E4, order = vec(0:3), tau = 1/4, w = vec(w4), G = 2L),
        list(M = tr2$M, T = tr2$T, Wupper = vec(Wup), V = lapply(seq_len(nrow(tr2$V)), function(h) vec(ifelse(is.finite(tr2$V[h, ]), tr2$V[h, ], NA))),
             riskByG = vec(tr2$riskByG), chosenG = 2L, grade = vec(c(1, 1, 1, 2)), risk = 7/40)))
tr3 <- o_trace(e3, 1, 1/5, 1:3, 3)
add(row("fixedOrderDPTrace-tb10-ABC-cap3-tau1/5", "fixedOrderDPTrace", list(E = E3, order = vec(0:2), tau = 1/5, w = vec(1), G = 3L),
        list(M = tr3$M, T = tr3$T, Wupper = vec(unlist(lapply(0:2, function(a) vapply((a + 1):3, function(b) tr3$W[a + 1, b + 1], 0)))),
             V = lapply(seq_len(nrow(tr3$V)), function(h) vec(ifelse(is.finite(tr3$V[h, ]), tr3$V[h, ], NA))),
             riskByG = vec(tr3$riskByG), chosenG = 2L, grade = vec(c(1, 2, 2)), risk = 11/60)))

# ---- orderHull with exact counts, blocks and scores -----------------------------------------------------------------
o_hull_pts <- function(fam, label) {                 # lower hull of (N, min Ew) over the family; unique report per vertex
  N <- vapply(fam, `[[`, 0, "N"); A <- vapply(fam, `[[`, 0, "Ew"); Ns <- sort(unique(N))
  pts <- lapply(Ns, function(v) { idx <- which(N == v); x <- A[idx]; d <- x - min(x)
    list(N = v, Ew = min(x), arg = idx[d <= 1e-13], amb = any(d > 1e-13 & d <= 1e-9)) })
  PN <- vapply(pts, `[[`, 0, "N"); PA <- vapply(pts, `[[`, 0, "Ew"); h <- integer()
  for (i in seq_along(PN)) {
    while (length(h) >= 2) { a <- h[length(h) - 1]; b <- h[length(h)]
      if ((PN[b] - PN[a]) * (PA[i] - PA[a]) - (PA[b] - PA[a]) * (PN[i] - PN[a]) <= 0) h <- h[-length(h)] else break }
    h <- c(h, i)
  }
  if (length(h) > 2) { s <- diff(PA[h]) / diff(PN[h]); if (any(diff(s) <= 1e-9)) stop("near-collinear hull vertex: ", label, call. = FALSE) }
  if (length(PN) > length(h)) { Hm <- approx(PN[h], PA[h], xout = PN)$y; off <- setdiff(seq_along(PN), h)
    if (any(PA[off] - Hm[off] <= 1e-9)) stop("cloud point within 1e-9 of the hull: ", label, call. = FALSE) }
  for (i in h) if (pts[[i]]$amb || length(pts[[i]]$arg) != 1) stop("hull vertex without a unique report: ", label, call. = FALSE)
  list(N = vec(PN[h]), Ew = vec(PA[h]), grade = lapply(h, function(i) vec(fam[[pts[[i]]$arg]]$grade)))
}
oh <- function(id, Earg, e, w, order0, blocks = NULL, G = NULL, exact = NULL, form = "top", scores = NULL, direction = NULL) {
  fam <- o_order_family(e, w, 0.25, order0 + 1L, blocks = blocks, G = G, exact = exact)
  a <- list(E = Earg, w = vec(w))
  if (form == "top") { a$order <- vec(order0); if (!is.null(G)) a$G <- G; if (!is.null(exact)) a$exact <- exact; if (!is.null(blocks)) a$blocks <- vec(blocks) }
  if (form == "family") a$family <- fam_order(order0, G = G, exact = exact, blocks = blocks)
  if (form == "scores") { a$scores <- vec(scores); a$direction <- direction; a$ids <- Earg$ids; if (!is.null(G)) a$G <- G; if (!is.null(exact)) a$exact <- exact }
  add(row(paste0("orderHull-", id), "orderHull", a, o_hull_pts(fam, id)))
}
oh("six-A-ABCDEF-eq3", E6A, e6a, 1, 0:5, exact = 3L)
oh("six-A-ABCDEF-blocks2112", E6A, e6a, 1, 0:5, blocks = c(2, 1, 1, 2))
oh("six-A-ABCDEF-blocks2112-cap3", E6A, e6a, 1, 0:5, blocks = c(2, 1, 1, 2), G = 3L)
oh("six-A-ABCDEF-blocks2112-eq3", E6A, e6a, 1, 0:5, blocks = c(2, 1, 1, 2), exact = 3L)
oh("six-AB-w.5.5-BACDEF-eq4", E6, e6, c(0.5, 0.5), c(1, 0, 2, 3, 4, 5), exact = 4L)
oh("tb16-DCBA-eq2", E4, e4, w4, 3:0, exact = 2L)
oh("six-A-ABCDEF-blocks2112-family", E6A, e6a, 1, 0:5, blocks = c(2, 1, 1, 2), form = "family")
oh("six-A-ABCDEF-eq3-family", E6A, e6a, 1, 0:5, exact = 3L, form = "family")
# scores (descending, ties by id): 5, 5, 3, 2, 2, 1 -> order A..F with blocks 2, 1, 2, 1.
oh("six-A-scores553221-desc", E6A, e6a, 1, 0:5, blocks = c(2, 1, 2, 1), form = "scores", scores = c(5, 5, 3, 2, 2, 1), direction = "descending")
oh("six-A-scores553221-desc-cap3", E6A, e6a, 1, 0:5, blocks = c(2, 1, 2, 1), G = 3L, form = "scores", scores = c(5, 5, 3, 2, 2, 1), direction = "descending")

# ---- fixedOrderDP given scores and the family form (unique optima, package rule irrelevant) ---------------------------
dps <- function(id, Earg, e, w, tau, order0, blocks, scores, direction, G = NULL, exact = NULL) {
  o <- o_order_optimum(o_order_family(e, w, tau, order0 + 1L, blocks = blocks, G = G, exact = exact), id)
  a <- list(E = Earg, tau = tau, w = vec(w), scores = vec(scores), direction = direction, ids = Earg$ids)
  if (!is.null(G)) a$G <- G; if (!is.null(exact)) a$exact <- exact
  add(row(paste0("fixedOrderDP-scores-", id), "fixedOrderDP", a, dp_expect(o)))
  f <- fam_order(order0, G = G, exact = exact, blocks = blocks)
  add(row(paste0("fixedOrderDP-family-", id), "fixedOrderDP", list(E = Earg, tau = tau, w = vec(w), family = f), dp_expect(o)))
}
dps("six-A-553221-desc-cap3-tau.20", E6A, e6a, 1, 0.20, 0:5, c(2, 1, 2, 1), c(5, 5, 3, 2, 2, 1), "descending", G = 3L)
dps("six-A-553221-desc-tau.40", E6A, e6a, 1, 0.40, 0:5, c(2, 1, 2, 1), c(5, 5, 3, 2, 2, 1), "descending")
dps("six-A-112234-asc-eq3-tau.20", E6A, e6a, 1, 0.20, 0:5, c(2, 2, 1, 1), c(1, 1, 2, 2, 3, 4), "ascending", exact = 3L)
# atMost family with a top-level order (decision E-2).
o_am <- o_order_optimum(o_order_family(e6a, 1, 0.20, 1:6, G = 2), "atMost-with-order")
add(row("fixedOrderDP-atMost2-with-order-six-A-tau.20", "fixedOrderDP", list(E = E6A, order = vec(0:5), tau = 0.20, w = vec(1), family = list(kind = "atMost", G = 2L)),
        dp_expect(o_am)))
stopifnot(max(o_am$chosen$grade) <= 2)

# ---- exactOptimum maxTies and tieCount ---------------------------------------------------------------------------------
# Every e = 1/2 and tau = 1/2: each stated pair costs exactly tau, so all 541 reports of A_5 tie; grades holds the first
# maxTies (default 100) in lexicographic order and tieCount the full number.
half <- function(n, K = 1) { e <- array(0.5, c(n, n, K)); for (k in seq_len(K)) diag(e[, , k]) <- NA; e }
R5 <- lexsort(oracle_reports(5)); stopifnot(nrow(R5) == 541)
Eh5 <- earr(half(5), LETTERS[1:5], "score")
add(row("exactOptimum-half-n5-all-tau.5-maxTies-default", "exactOptimum", list(E = Eh5, tau = 0.5, w = vec(1), family = list(kind = "all")),
        list(grade = vec(R5[1, ]), grades = grade_list(R5[1:100, ]), tieCount = 541L, risk = 0.5)))
add(row("exactOptimum-half-n5-all-tau.5-maxTies3", "exactOptimum", list(E = Eh5, tau = 0.5, w = vec(1), family = list(kind = "all"), maxTies = 3L),
        list(grade = vec(R5[1, ]), grades = grade_list(R5[1:3, ]), tieCount = 541L, risk = 0.5)))
add(row("exactOptimum-half-n5-all-tau.3-unique", "exactOptimum", list(E = Eh5, tau = 0.3, w = vec(1), family = list(kind = "all")),
        list(grade = vec(rep(1, 5)), grades = list(vec(rep(1, 5))), tieCount = 1L, risk = 0.3)))
R4 <- lexsort(oracle_reports(4)); stopifnot(nrow(R4) == 75)
Eh4 <- earr(half(4, 2), LETTERS[1:4], c("k1", "k2"))
add(row("minimaxChoice-half-n4-K2-all-tau.5", "minimaxChoice", list(E = Eh4, tau = 0.5, w = vec(c(0.5, 0.5)), family = list(kind = "all")),
        list(weightedGrades = grade_list(R4), weightedTieCount = 75L, minimaxGrades = grade_list(R4), minimaxTieCount = 75L)))
add(row("minimaxChoice-half-n4-K2-all-tau.5-maxTies10", "minimaxChoice", list(E = Eh4, tau = 0.5, w = vec(c(0.5, 0.5)), family = list(kind = "all"), maxTies = 10L),
        list(weightedGrades = grade_list(R4[1:10, ]), weightedTieCount = 75L, minimaxGrades = grade_list(R4[1:10, ]), minimaxTieCount = 75L)))

# ---- tauPath: an optimum that appears exactly at tau = 1/2 (decision E-17) ----------------------------------------------
# Every e = 1/2 on four units: each report has Ew = N/2, so the all-withheld report is optimal on (0, 1/2] and at
# tau = 1/2 every one of the 75 reports ties. The hull is (0, 0), (6, 3), slope exactly 1/2: the strict report
# (lexicographically first with N = 6: 1/2/3/4) keeps the zero-length interval [1/2, 1/2].
stopifnot(all(vapply(seq_len(nrow(R4)), function(r) { g <- R4[r, ]; o_eval(g, half(4), 1, 0.5)$risk == 0.5 }, TRUE)))
add(row("tauPath-half-n4-all-endpoint", "tauPath", list(E = earr(half(4), LETTERS[1:4], "score"), w = vec(1), family = list(kind = "all")),
        list(tauFrom = vec(c(0, 0.5)), tauTo = vec(c(0.5, 0.5)), N = vec(c(0, 6)), grade = list(vec(rep(1, 4)), vec(1:4)),
             endpointOptima = grade_list(R4), endpointTieCount = 75L)))
add(row("tauPath-half-n4-all-endpoint-maxTies5", "tauPath", list(E = earr(half(4), LETTERS[1:4], "score"), w = vec(1), family = list(kind = "all"), maxTies = 5L),
        list(endpointOptima = grade_list(R4[1:5, ]), endpointTieCount = 75L)))
# Six sites (score A, all reports): the last hull slope is .3618 < 1/2, so only the strict report is optimal at 1/2.
R6all <- lexsort(oracle_reports(6)); r6 <- apply(R6all, 1, function(g) o_eval(g, e6a, 1, 0.5)$risk); d6 <- r6 - min(r6)
stopifnot(sum(d6 <= 1e-12) == 1L, min(d6[d6 > 1e-12]) > 1e-9)
add(row("tauPath-six-A-all-endpoint", "tauPath", list(E = E6A, w = vec(1), family = list(kind = "all")),
        list(endpointOptima = grade_list(R6all[d6 <= 1e-12, , drop = FALSE]), endpointTieCount = 1L)))

# ---- empty families: { empty: true, family } everywhere (decision E-15) ------------------------------------------------
emp <- function(fn, a) add(row(sprintf("%s-empty-%s", fn, a$label), fn, a[setdiff(names(a), "label")], list(empty = TRUE)))
emp("exactOptimum", list(label = "six-eq7", E = E6A, tau = 0.2, w = vec(1), family = list(kind = "exactly", G = 7L)))
emp("fixedOrderDP", list(label = "six-blocks2112-eq5", E = E6A, order = vec(0:5), blocks = vec(c(2, 1, 1, 2)), exact = 5L, tau = 0.2, w = vec(1)))
emp("orderHull", list(label = "six-eq7", E = E6A, order = vec(0:5), exact = 7L, w = vec(1)))
emp("tauPath", list(label = "six-eq7", E = E6A, w = vec(1), family = list(kind = "exactly", G = 7L)))
emp("reportCloud", list(label = "six-eq7", E = E6A, w = vec(1), family = list(kind = "exactly", G = 7L)))
emp("minimaxChoice", list(label = "tb13-eq3", E = earr(half(2, 2), c("A", "B"), c("k1", "k2")), tau = 0.25, w = vec(c(0.5, 0.5)), family = list(kind = "exactly", G = 3L)))
emp("commonalityCost", list(label = "six-eq7", E = E6, tau = 0.2, w = vec(c(0.5, 0.5)), family = list(kind = "exactly", G = 7L)))
emp("budgetFamily", list(label = "six-eq7", E = E6, tau = 0.2, w = vec(c(0.5, 0.5)), family = list(kind = "exactly", G = 7L), q = vec(c(1, 1))))

# ---- family.size: a number up to 2^53, a decimal string above (decision E-12) ------------------------------------------
m60 <- cbind(seq(1.5, -1.5, length.out = 60)); e60 <- r15(o_normal_e(m60, matrix(0.3, 60, 1)))
add(row("fixedOrderDP-n60-uncapped-familySize", "fixedOrderDP", list(E = earr(e60, sprintf("U%02d", 1:60), "score"), order = vec(0:59), tau = 0.2, w = vec(1)),
        list(familySize = "576460752303423488", familySizeExact = "576460752303423488", label = "optimal-within-order")))
stopifnot(identical(format(2^59, scientific = FALSE), "576460752303423488"))
add(row("fixedOrderDP-n60-cap3-familySize", "fixedOrderDP", list(E = earr(e60, sprintf("U%02d", 1:60), "score"), order = vec(0:59), tau = 0.2, w = vec(1), G = 3L),
        list(familySize = choose(59, 0) + choose(59, 1) + choose(59, 2), familySizeExact = "1771", label = "optimal-within-order")))
add(row("exactOptimum-six-all-familySize", "exactOptimum", list(E = E6A, tau = 0.2, w = vec(1), family = list(kind = "all")),
        list(familySize = 4683, familySizeExact = "4683")))

# ---- weightBreakpoints (K = 2): the optimum as the first weight w moves over [0, 1] -----------------------------------
# Each report's risk is the line R(w) = w R_1 + (1 - w) R_2 at fixed tau; the optimum follows the lower envelope.
# Intervals are closed and share endpoints; each carries the envelope line's report (unique in every case here).
o_envelope <- function(R, e, tau, label) {
  n <- ncol(R); M <- n * (n - 1) / 2
  Rk <- t(apply(R, 1, function(g) { x <- outer(g, g, "<"); N <- sum(x); c(sum(e[, , 1][x]), sum(e[, , 2][x]), N) }))
  R1 <- (Rk[, 1] + tau * (M - Rk[, 3])) / M; R2 <- (Rk[, 2] + tau * (M - Rk[, 3])) / M
  b <- R2; a <- R1 - R2
  pick <- function(cands) {                          # smallest slope, then lexicographically first report
    cands <- cands[a[cands] <= min(a[cands]) + 1e-15]
    same <- cands[abs(b[cands] - b[cands[1]]) <= 1e-13]
    if (length(same) > 1) stop("two reports on one envelope line: ", label, call. = FALSE)
    cands[1]
  }
  # Both ends are closed: when two reports tie at w = 0, the one with the larger slope is optimal only there and gets
  # the zero-length interval [0, 0] before the main sequence (a third tied report would lie inside that hull edge
  # and is not allowed here); the same holds at w = 1 with the smaller slope, after it.
  at0 <- which(b <= min(b) + 1e-12)
  if (length(at0) > 2) stop("more than two reports tie at w = 0: ", label, call. = FALSE)
  segs <- list()
  if (length(at0) == 2 && abs(a[at0[1]] - a[at0[2]]) > 1e-9) {
    hi <- at0[which.max(a[at0])]; segs[[1]] <- list(from = 0, to = 0, r = hi)
  }
  cur <- pick(at0); w0 <- 0
  repeat {
    cand <- which(a < a[cur] - 1e-15)
    ws <- if (length(cand)) (b[cand] - b[cur]) / (a[cur] - a[cand]) else numeric()
    if (length(ws)) stopifnot(all(ws > w0 + 1e-9 | ws < w0 - 1e-9 | abs(ws - w0) <= 1e-12))
    ok <- ws > w0 + 1e-12
    if (!any(ok) || min(ws[ok]) >= 1 - 1e-12) {
      segs[[length(segs) + 1L]] <- list(from = w0, to = 1, r = cur)
      at1 <- if (any(ok)) cand[ok][abs(ws[ok] - 1) <= 1e-12] else integer()
      if (length(at1) > 1) stop("more than two reports tie at w = 1: ", label, call. = FALSE)
      if (length(at1) == 1) segs[[length(segs) + 1L]] <- list(from = 1, to = 1, r = at1)
      break
    }
    nxt <- min(ws[ok]); segs[[length(segs) + 1L]] <- list(from = w0, to = nxt, r = cur)
    cur <- pick(cand[ok][abs(ws[ok] - nxt) <= 1e-12]); w0 <- nxt
  }
  grid <- seq(0, 1, length.out = 10001)              # fine-grid check of every interval's report
  for (wg in grid) {
    risk <- wg * R1 + (1 - wg) * R2; d <- risk - min(risk)
    sg <- Filter(function(s) wg >= s$from - 1e-12 && wg <= s$to + 1e-12, segs)
    near <- any(vapply(segs, function(s) min(abs(wg - s$from), abs(wg - s$to)), 0) < 1e-6 & !(wg %in% c(0, 1)))
    if (wg %in% c(0, 1)) stopifnot(all(vapply(Filter(function(s) s$from == wg || s$to == wg, segs), function(s) d[s$r] <= 1e-12, TRUE)))
    else if (!near) stopifnot(length(sg) == 1L, d[sg[[1]]$r] <= 1e-12, sum(d <= 1e-10) == 1L)
  }
  lapply(segs, function(s) list(wFrom = s$from, wTo = s$to, grade = vec(R[s$r, ]), N = Rk[s$r, 3],
                                riskFrom = s$from * R1[s$r] + (1 - s$from) * R2[s$r], riskTo = s$to * R1[s$r] + (1 - s$to) * R2[s$r]))
}
wb <- function(id, R, e, Earg, tau, family) {
  segs <- o_envelope(R, e, tau, id)
  add(row(paste0("weightBreakpoints-", id), "weightBreakpoints", list(E = Earg, tau = tau, family = family),
          list(wFrom = vec(sapply(segs, `[[`, "wFrom")), wTo = vec(sapply(segs, `[[`, "wTo")), grade = lapply(segs, `[[`, "grade"),
               N = vec(sapply(segs, `[[`, "N")), riskFrom = vec(sapply(segs, `[[`, "riskFrom")), riskTo = vec(sapply(segs, `[[`, "riskTo")))))
  invisible(segs)
}
R6 <- lexsort(oracle_reports(6)); R6c3 <- R6[apply(R6, 1, max) <= 3, , drop = FALSE]; stopifnot(nrow(R6) == 4683, nrow(R6c3) == 603)
s6 <- wb("six-AB-cap3-tau.20", R6c3, e6, E6, 0.20, list(kind = "atMost", G = 3L))
# At w = 0 (score B alone) the two exact optima of P-03 tie: 2/2/1/2/3/3 holds only there, 1/2/1/1/3/3 then follows.
stopifnot(length(s6) == 7L, s6[[1]]$wTo == 0, identical(unclass(s6[[1]]$grade), c(2L, 2L, 1L, 2L, 3L, 3L)),
          identical(unclass(s6[[2]]$grade), c(1L, 2L, 1L, 1L, 3L, 3L)))
# The weight-path grid of 04_optimize.R (cap 3, tau .20) agrees with these intervals at its grid weights.
for (w1 in c(0.1, 0.25, 0.5, 0.75, 0.9, 1)) { s <- Filter(function(x) w1 >= x$wFrom && w1 <= x$wTo, s6); stopifnot(length(s) >= 1) }
wb("six-AB-all-tau.35", R6, e6, E6, 0.35, list(kind = "all"))
wb("six-AB-eq3-tau.20", R6[apply(R6, 1, max) == 3, , drop = FALSE], e6, E6, 0.20, list(kind = "exactly", G = 3L))
# Theory book ch. 13 two-unit law at tau = 1/4: withholding (risk 1/4) up to w = 1/2, then A above B ((1 - w)/2).
o_finite_law2 <- function(states, masses) { n <- nrow(states[[1]]); K <- ncol(states[[1]]); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- sum(masses[vapply(states, function(s) s[i, k] <= s[j, k], logical(1))]) / sum(masses); e }
tb13 <- o_finite_law2(list(cbind(c(1, 0), c(1, 0)), cbind(c(1, 0), c(-1, 0))), c(1, 1))
s13 <- wb("tb13-all-tau.25", lexsort(oracle_reports(2)), tb13, earr(tb13, c("A", "B"), c("c1", "c2")), 0.25, list(kind = "all"))
stopifnot(length(s13) == 2L, s13[[1]]$wTo == 0.5, identical(unclass(s13[[2]]$grade), c(1L, 2L)))

assert_no_postrank()
write_golden("oracle-ties", rows, generator = "r-export/13_dp_ties.R", uses_postrank = FALSE)
cat("oracle-ties:", length(rows), "rows\n")

# ---- postrank 1.1.0: .pr_cuts_core on exact ties, the one-ulp case, order and blocks -----------------------------------
load_postrank()
prow <- list(); padd <- function(r) prow[[length(prow) + 1L]] <<- r
core <- function(e, ids, scores, w, tau, G_max, exact_G = NULL, direction = "descending") {
  dimnames(e) <- list(ids, ids, paste0("k", seq_len(dim(e)[3])))
  postrank:::.pr_cuts_core(e, setNames(scores, ids), w, tau, as.integer(G_max), if (is.null(exact_G)) NULL else as.integer(exact_G), direction, "optimal")
}
pk_row <- function(id, Earg, e, ids, scores, w, tau, G_max, exact_G = NULL, direction = "descending", extra = list(), check = NULL) {
  r <- core(e, ids, scores, w, tau, G_max, exact_G, direction)
  g <- unname(r$grades[ids]); if (!is.null(check)) stopifnot(identical(g, as.integer(check)))
  ord <- match(r$order, ids) - 1L; blocks <- lengths(r$score_blocks)
  a <- c(list(E = Earg, order = vec(ord), tau = tau, w = vec(w)), extra)
  if (exact_G %||% 0 > 0) a$exact <- as.integer(exact_G) else a$G <- as.integer(G_max)
  if (any(blocks > 1)) a$blocks <- vec(blocks)
  padd(row(paste0("fixedOrderDP-", id), "fixedOrderDP", a, list(grade = vec(g), risk = r$risk, label = "optimal-within-order")))
  invisible(r)
}
# ch. 10 law along A, B, C at tau = 1/5 (package: 1/2/2, both with a cap of 2 and of 3), also with tieTol = 0.
pk_row("pkg-tb10-ABC-cap3-tau1/5", E3, e3, c("A", "B", "C"), c(3, 2, 1), 1, 1/5, 3, check = c(1, 2, 2))
pk_row("pkg-tb10-ABC-cap2-tau1/5", E3, e3, c("A", "B", "C"), c(3, 2, 1), 1, 1/5, 2, check = c(1, 2, 2))
pk_row("pkg-tb10-ABC-cap3-tau1/5-tieTol0", E3, e3, c("A", "B", "C"), c(3, 2, 1), 1, 1/5, 3, extra = list(tieTol = 0), check = c(1, 2, 2))
# Fewer grades on a tie, exact counts and the reversed order.
pk_row("pkg-fewer-grades-ABCD-cap4-tau1/4", Efg, efg, c("A", "B", "C", "D"), c(4, 3, 2, 1), 1, 0.25, 4, check = c(1, 2, 2, 2))
pk_row("pkg-fewer-grades-ABCD-cap4-tau1/4-tieTol0", Efg, efg, c("A", "B", "C", "D"), c(4, 3, 2, 1), 1, 0.25, 4, extra = list(tieTol = 0), check = c(1, 2, 2, 2))
pk_row("pkg-fewer-grades-ABCD-eq3-tau1/4", Efg, efg, c("A", "B", "C", "D"), c(4, 3, 2, 1), 1, 0.25, 3, exact_G = 3, check = c(1, 2, 3, 3))
pk_row("pkg-fewer-grades-ABCD-eq4-tau1/4", Efg, efg, c("A", "B", "C", "D"), c(4, 3, 2, 1), 1, 0.25, 4, exact_G = 4, check = c(1, 2, 3, 4))
pk_row("pkg-fewer-grades-DCBA-cap4-tau1/4", Efg, efg, c("A", "B", "C", "D"), c(1, 2, 3, 4), 1, 0.25, 4)
pk_row("pkg-all-withheld-tie-ABC-cap3-tau1/4", Eaw, eaw, c("A", "B", "C"), c(3, 2, 1), 1, 0.25, 3, check = c(1, 1, 1))
stopifnot(identical(unname(core(efg, c("A", "B", "C", "D"), c(1, 2, 3, 4), 1, 0.25, 4L)$grades), ofgr$chosen$grade))   # base R = package
# E-11: one ulp apart; the package compares floats exactly (tieTol = 0 in the engine).
for (ab in c(TRUE, FALSE)) {
  e <- if (ab) e_ulp(0.1 + 0.2, 0.3) else e_ulp(0.3, 0.1 + 0.2)
  r <- pk_row(sprintf("pkg-ulp-%s-tieTol0", if (ab) "eAB.1+.2" else "eBC.1+.2"), ulp_E(ab), e, c("A", "B", "C"), c(3, 2, 1), 1, 0.25, 3,
              extra = list(tieTol = 0), check = if (ab) c(1, 1, 2) else c(1, 2, 2))
}
# exactOptimum on the order family follows the same rule (decision E-1).
r10 <- core(e3, c("A", "B", "C"), c(3, 2, 1), 1, 1/5, 3L)
padd(row("exactOptimum-pkg-tb10-orderABC-tau1/5", "exactOptimum", list(E = E3, tau = 1/5, w = vec(1), family = fam_order(0:2)),
         list(grade = vec(unname(r10$grades)), risk = r10$risk)))
rfg <- core(efg, c("A", "B", "C", "D"), c(4, 3, 2, 1), 1, 0.25, 4L)
padd(row("exactOptimum-pkg-fewer-grades-orderABCD-tau1/4", "exactOptimum", list(E = Efg, tau = 0.25, w = vec(1), family = fam_order(0:3)),
         list(grade = vec(unname(rfg$grades)), risk = rfg$risk)))

# scoreOrder(scores, { direction, ids }) -> { order, blocks }: the package's order(direction score, entity id, radix)
# and its exact-equality score blocks.
so <- function(id, scores, ids, direction, json_scores = NULL) {
  n <- length(ids); r <- core(array(0.5, c(n, n, 1)), ids, scores, 1, 0.25, 1L, NULL, direction)
  padd(row(paste0("scoreOrder-", id), "scoreOrder", list(scores = if (is.null(json_scores)) vec(scores) else json_scores, direction = direction, ids = vec(ids)),
           list(order = vec(match(r$order, ids) - 1L), blocks = vec(lengths(r$score_blocks)))))
  invisible(r)
}
mix_ids <- c("b", "a", "C", "B", "10", "9")
so("mixed-ids-desc", c(1, 2, 2, 1, 3, 2), mix_ids, "descending")
so("mixed-ids-asc", c(1, 2, 2, 1, 3, 2), mix_ids, "ascending")
so("six-tied112234-asc", c(1, 1, 2, 2, 3, 4), six_ids, "ascending")
so("six-tied533311-desc", c(5, 3, 3, 3, 1, 1), six_ids, "descending")
so("all-equal", c(2, 2, 2, 2), c("d", "c", "b", "a"), "descending")
so("strict-desc", c(0.3, -1.2, 2.5, 0.31), c("u1", "u2", "u3", "u4"), "descending")
so("float-near-tie-desc", c(0.3, 0.1 + 0.2, 0.3), c("x", "y", "w"), "descending", json_scores = list(0.3, SUM(0.1, 0.2), 0.3))
so("float-near-tie-asc", c(0.3, 0.1 + 0.2, 0.3), c("x", "y", "w"), "ascending", json_scores = list(0.3, SUM(0.1, 0.2), 0.3))
so("non-ascii-ids", c(1, 1, 1), c("Ä", "z", "Z"), "descending")
er2 <- postrank_expected_rank(pr_tutorial$two, c(score_A = 0.5, score_B = 0.5))
so("tutorial-two-exprank-asc", r15(unname(er2[six_ids])), six_ids, "ascending")

# fixedOrderDP given scores = postrank_cuts(rule = "optimal") on the same scores (tied scores are never split).
cs <- function(id, scores, pw, w, tau, G_max = NULL, exact_G = NULL, direction) {
  s <- postrank_settings(setNames(w, pw$criterion_ids), tau = tau, G_max = as.integer(if (is.null(G_max)) exact_G else G_max),
                         exact_G = if (is.null(exact_G)) NULL else as.integer(exact_G))
  res <- postrank_cuts(scores, pw, s, direction = direction, rule = "optimal"); ids <- pw$entity_ids
  a <- list(E = earr(unname(pw$e), ids, pw$criterion_ids), tau = tau, w = vec(w), scores = vec(unname(scores[ids])), direction = direction, ids = vec(ids))
  if (!is.null(G_max)) a$G <- as.integer(G_max); if (!is.null(exact_G)) a$exact <- as.integer(exact_G)
  padd(row(paste0("fixedOrderDP-scores-", id), "fixedOrderDP", a, list(grade = vec(unname(res$grade[ids])), risk = res$risk, label = "optimal-within-order")))
}
cs("six-A-tied112234-asc-cap3-tau.20", c(A = 1, B = 1, C = 2, D = 2, E = 3, F = 4), pr_tutorial$one, 1, 0.20, G_max = 3, direction = "ascending")
cs("six-AB-tied533311-desc-cap3-tau.40", c(A = 5, B = 3, C = 3, D = 3, E = 1, F = 1), pr_tutorial$two, c(0.5, 0.5), 0.40, G_max = 3, direction = "descending")
cs("six-A-tied112234-asc-eq3-tau.20", c(A = 1, B = 1, C = 2, D = 2, E = 3, F = 4), pr_tutorial$one, 1, 0.20, exact_G = 3, direction = "ascending")

write_golden("postrank-dp-ties", prow, generator = "r-export/13_dp_ties.R", uses_postrank = TRUE)
cat("postrank-dp-ties:", length(prow), "rows\n")
