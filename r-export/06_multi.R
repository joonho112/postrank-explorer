# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/multi.ts (Step 2.8).
#   oracle-multi    base R only (closed forms, full enumeration of small families, theory-book worked examples);
#                   postrank is not loaded.
#   postrank-multi  postrank 1.1.0: cached tutorial_commonality / tutorial_two (reproduced by enumeration),
#                   commonality_30x3 / commonality_30x3_tau35 (reproduced by the fixed-order DP in expected-rank
#                   orders), the KRW two-criterion array (pr_case_krw$input), postrank_composite().
# Conventions (engine/API.md): grade 1 = highest priority; units 0-based in code; "i above j is stated" when
# g[i] < g[j]; E = { ids, criteria, e } with e[k][i][j] = Pr(theta_ik <= theta_jk), NaN (null) diagonal;
# R_k = (E_k + tau (M - N))/M; weighted risk = sum_k w_k R_k. Optima: every report within 1e-12 of the minimum,
# grade vectors in lexicographic order. Every row names its engine function in args$fn.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

# ---- JSON shaping and checks --------------------------------------------------------------------------------------
vec <- function(x) I(unname(x))
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(a[, , k]))
earr <- function(e, ids, criteria) list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))
grades_json <- function(G) lapply(seq_len(nrow(G)), function(r) vec(G[r, ]))
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

# ---- base-R oracle (theory book ch. 11-13; vignette m2) ----------------------------------------------------------
o_M <- function(n) n * (n - 1) / 2
o_error_array <- function(means, sds) {              # independent normals, larger = higher priority
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
o_finite_law <- function(states, masses) {           # integer masses; weak error e_ij = Pr(theta_i <= theta_j)
  n <- nrow(states[[1]]); K <- ncol(states[[1]]); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- sum(masses[vapply(states, function(s) s[i, k] <= s[j, k], logical(1))]) / sum(masses)
  e
}
o_wsum <- function(e, w) { out <- w[1] * e[, , 1]; if (dim(e)[3] > 1) for (k in 2:dim(e)[3]) out <- out + w[k] * e[, , k]; out }
o_Ek <- function(g, e) { x <- outer(g, g, "<"); vapply(seq_len(dim(e)[3]), function(k) sum(e[, , k][x]), 0) }
o_N <- function(g) sum(outer(g, g, "<"))
o_Rk <- function(g, e, tau) { M <- o_M(length(g)); (o_Ek(g, e) + tau * (M - o_N(g))) / M }
o_risk <- function(g, e, tau, w) { M <- o_M(length(g)); (sum(w * o_Ek(g, e)) + tau * (M - o_N(g))) / M }

# Families by full enumeration (oracle_reports: canonical grade vectors, labels 1..G).
lex_sort <- function(R) R[do.call(order, unname(as.data.frame(R))), , drop = FALSE]
fam_reports <- function(n, family) switch(family$kind,
  all = oracle_reports(n),
  atMost = oracle_reports(n, family$G),
  exactly = { R <- oracle_reports(n, family$G); R[apply(R, 1, max) == family$G, , drop = FALSE] })
fam_stats <- function(n, family, e) {                # E_k and N of every report of the family
  R <- lex_sort(fam_reports(n, family)); K <- dim(e)[3]
  Ek <- matrix(0, nrow(R), K); N <- numeric(nrow(R))
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) {
    x <- R[, i] < R[, j]; N <- N + x
    for (k in seq_len(K)) Ek[, k] <- Ek[, k] + x * e[i, j, k]
  }
  list(R = R, N = N, Ek = Ek, M = o_M(n), size = nrow(R))
}
fam_risk <- function(st, w, tau) (as.vector(st$Ek %*% w) + tau * (st$M - st$N)) / st$M
fam_Rk <- function(st, k, tau) (st$Ek[, k] + tau * (st$M - st$N)) / st$M
# All reports within tol of the minimum (rows already lexicographic). The gap to the next value must exceed 1e-9,
# so that 15-digit inputs and different summation orders cannot change the optimal set.
argmin_set <- function(v, R, tol = 1e-12, label = "") {
  m <- min(v); idx <- which(v <= m + tol)
  rest <- v[-idx]; if (length(rest)) stopifnot(min(rest) - m > 1e-9)
  list(grades = R[idx, , drop = FALSE], value = m, index = idx)
}

# conflictPairs: pairs i < j whose more likely direction differs across criteria. On criterion k, i is more likely above
# j when e_ij,k < e_ji,k (stating i above j errs less often; under latent ties e_ij + e_ji = 1 + Pr(theta_i = theta_j),
# so comparing with 1/2 would be wrong); exactly equal errors favour neither. iAbove / jAbove list the criteria
# (0-based indices) on each side.
o_conflict_full <- function(e) {
  n <- dim(e)[1]; K <- dim(e)[3]; out <- list()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    diff <- e[j, i, ] - e[i, j, ]                                          # > 0: i more likely above j
    stopifnot(all(diff == 0 | abs(diff) > 1e-9))                           # no near-equal criterion
    ia <- which(diff > 0) - 1L; ja <- which(diff < 0) - 1L
    if (length(ia) && length(ja)) out[[length(out) + 1L]] <- list(pair = c(i, j) - 1L, iAbove = ia, jAbove = ja)
  }
  out
}
o_conflict_pairs <- function(e) lapply(o_conflict_full(e), `[[`, "pair")
o_agreement <- function(a, b) {                     # share of pairs i < j with the same relation (sign of g_i - g_j)
  ra <- sign(outer(a, a, "-")); rb <- sign(outer(b, b, "-")); up <- upper.tri(ra); mean(ra[up] == rb[up])
}
o_commonality <- function(e, w, tau, family) {       # vignette m2: Delta_k = R_k(common) - min_F R_k
  st <- fam_stats(dim(e)[1], family, e)
  com <- argmin_set(fam_risk(st, w, tau), st$R)
  stopifnot(length(com$index) == 1L)                 # the common optimum is unique in every row used here
  per <- lapply(seq_len(dim(e)[3]), function(k) {
    rk <- fam_Rk(st, k, tau); own <- argmin_set(rk, st$R)
    og <- own$grades[1, ]                             # the lexicographically first own optimum (ownGrade)
    list(commonRk = rk[com$index], ownGrades = grades_json(own$grades), ownGrade = vec(og), ownRk = own$value,
         delta = rk[com$index] - own$value, relationAgreement = o_agreement(og, com$grades[1, ]))
  })
  list(common = com, perCriterion = per, size = st$size)
}
# Known two-unit state (vignette m2; theory book ch. 12): action costs under the criterion-direction loss
# (sum_k w_k 1{theta_ik <= theta_jk}) and the composite-direction loss (1{c_i <= c_j}), withholding tau.
# multiplier[k] multiplies criterion k's values before the composite c_i = sum_k a_k multiplier_k theta_ik is formed.
o_best <- function(costs) vec(names(costs)[costs <= min(costs) + 1e-12])
o_estimand <- function(state, w, a, tau, scale) {
  comp <- as.vector(state %*% (a * scale))
  out <- list(composite = vec(comp))
  if (nrow(state) == 2) {
    crit <- c(iAboveJ = sum(w * (state[1, ] <= state[2, ])), jAboveI = sum(w * (state[2, ] <= state[1, ])), withhold = tau)
    cc <- c(iAboveJ = as.numeric(comp[1] <= comp[2]), jAboveI = as.numeric(comp[2] <= comp[1]), withhold = tau)
    for (v in list(crit, cc)) { d <- abs(outer(v, v, "-")); stopifnot(all(d == 0 | d > 1e-9)) }   # exact ties only
    out <- c(out, list(criterionCosts = as.list(crit), compositeCosts = as.list(cc),
                       criterionBest = o_best(crit), compositeBest = o_best(cc)))
  }
  out
}
o_budget_family <- function(e, w, tau, family, q) {  # A_q: E_k <= q_k N for every criterion (q_k = 1: no budget)
  st <- fam_stats(dim(e)[1], family, e)
  slack <- outer(st$N, q) - st$Ek                    # q_k N - E_k
  bud <- which(q < 1)
  if (length(bud)) { s <- slack[, bud, drop = FALSE]; stopifnot(all(abs(s[st$N > 0, ]) > 1e-9)) }  # no boundary cases
  ok <- apply(slack >= 0 | st$N == 0, 1, all)
  if (!any(ok)) return(list(size = 0L, empty = TRUE))
  sub <- argmin_set(fam_risk(st, w, tau)[ok], st$R[ok, , drop = FALSE])
  list(size = sum(ok), empty = FALSE, grades = grades_json(sub$grades), risk = sub$value)
}
o_budget_check <- function(g, e, q) {
  Ek <- o_Ek(g, e); N <- o_N(g); meets <- Ek <= q * N
  if (N > 0) stopifnot(all(abs(Ek - q * N)[q < 1] > 1e-9))
  list(E = vec(Ek), N = N, meets = vec(meets), all = all(meets))
}
o_minimax <- function(e, w, tau, family) {           # theory book ch. 13: min_g max_k R_k(g), all criteria included
  st <- fam_stats(dim(e)[1], family, e)
  Rk <- sapply(seq_len(dim(e)[3]), function(k) fam_Rk(st, k, tau))
  if (is.null(dim(Rk))) Rk <- matrix(Rk, nrow = 1)
  wt <- argmin_set(fam_risk(st, w, tau), st$R); mm <- argmin_set(apply(Rk, 1, max), st$R)
  list(weighted = list(grades = grades_json(wt$grades), risk = wt$value),
       minimax = list(grades = grades_json(mm$grades), value = mm$value))
}
o_weight_crossing <- function(g, e, tau) {           # K = 2: omega with omega R_1 + (1 - omega) R_2 = tau, in [0, 1]
  R <- o_Rk(g, e, tau); stopifnot(length(R) == 2, abs(R[1] - R[2]) > 1e-9)
  om <- (tau - R[2]) / (R[1] - R[2])
  stopifnot(abs(om) > 1e-9, abs(om - 1) > 1e-9)
  list(omega = if (om > 0 && om < 1) om else NA_real_, Rk = vec(R))
}

# ---- laws ---------------------------------------------------------------------------------------------------------
st <- function(..., ids, criteria) { m <- cbind(...); dimnames(m) <- list(entity = ids, criterion = criteria); m }
six_ids <- LETTERS[1:6]; sixK <- c("score_A", "score_B")
six_means <- cbind(score_A = c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8), score_B = c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7))
e6 <- o_error_array(six_means, matrix(0.2, 6, 2))   # pr_tutorial law (hardcoded; asserted against the package below)
abcd <- c("A", "B", "C", "D"); two <- c("c1", "c2"); AB <- c("A", "B")
rank_vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], abcd)] <- 4:1; v }
tb14 <- o_finite_law(list(st(rank_vals("ABCD"), rank_vals("ACBD"), ids = abcd, criteria = two),
                          st(rank_vals("BACD"), rank_vals("DCBA"), ids = abcd, criteria = two)), c(3L, 1L))
# ch. 12 cyclic criteria (point mass): A = (3,1,2), B = (2,3,1), C = (1,2,3).
cyc <- o_finite_law(list(st(c(3, 2, 1), c(1, 3, 2), c(2, 1, 3), ids = c("A", "B", "C"), criteria = c("k1", "k2", "k3"))), 1L)
# ch. 13 minimax law: (Theta_A, Theta_B) = ((1,1),(0,0)) or ((1,-1),(0,0)), each 1/2.
tb13 <- o_finite_law(list(st(c(1, 0), c(1, 0), ids = AB, criteria = two), st(c(1, 0), c(-1, 0), ids = AB, criteria = two)), c(1L, 1L))
stopifnot(identical(tb13[1, 2, ], c(0, 0.5)), identical(tb13[2, 1, ], c(1, 0.5)))
# ch. 13 protection example (point mass): A = (1, 0), B = (0, 1).
tb13p <- o_finite_law(list(st(c(1, 0), c(0, 1), ids = AB, criteria = two)), 1L)

# ---- conflictPairs ------------------------------------------------------------------------------------------------
cp <- function(id, e, ids, criteria) {
  full <- o_conflict_full(e); p <- lapply(full, `[[`, "pair")
  add(row(paste0("conflictPairs-", id), "conflictPairs", list(E = earr(e, ids, criteria)),
          list(pairs = lapply(p, vec), count = length(p), iAbove = lapply(full, function(x) vec(x$iAbove)),
               jAbove = lapply(full, function(x) vec(x$jAbove)))))
  invisible(p)
}
p6 <- cp("six-K2", e6, six_ids, sixK)
stopifnot(identical(lapply(p6, function(x) LETTERS[x + 1L]), list(c("A", "C"), c("B", "C"), c("B", "D"))))  # P-01
p14 <- cp("tb14-K2", tb14, abcd, two)
stopifnot(identical(p14, list(c(1L, 2L))))           # only B-C: ABCD/BACD put B above C, ACBD/DCBA put C above B
pc3 <- cp("tb12-cyclic-K3", cyc, c("A", "B", "C"), c("k1", "k2", "k3"))
stopifnot(length(pc3) == 3)                          # every pair is supported by two criteria and opposed by one
cp("six-K1-none", e6[, , 1, drop = FALSE], six_ids, "score_A")
# A tie law (E-10): on k1, A > B with probability 1/4 and A = B otherwise, so e_AB = 3/4 < e_BA = 1 (A more likely
# above, although e_AB > 1/2); on k2, B > A surely. The pair conflicts (iAbove k1, jAbove k2).
tie2 <- o_finite_law(list(st(c(1, 0), c(0, 1), ids = AB, criteria = two), st(c(0, 0), c(0, 1), ids = AB, criteria = two)), c(1L, 3L))
stopifnot(identical(tie2[1, 2, ], c(0.75, 1)), identical(tie2[2, 1, ], c(1, 0)))
pt <- cp("tie-law-K2", tie2, AB, two); stopifnot(identical(pt, list(c(0L, 1L))))
# Exactly equal errors favour neither side: criterion k2 has equal means for A and B (e = 1/2 both ways).
eq3 <- o_error_array(cbind(c(1, 0.6, 0), c(0.5, 0.5, 0.9), c(0, 0.3, 1)), matrix(0.2, 3, 3))
stopifnot(eq3[1, 2, 2] == 0.5, eq3[2, 1, 2] == 0.5)
cp("equal-errors-K3", eq3, c("A", "B", "C"), c("k1", "k2", "k3"))

# ---- weightedError ------------------------------------------------------------------------------------------------
we <- function(id, e, ids, criteria, w) add(row(paste0("weightedError-", id), "weightedError",
  list(E = earr(e, ids, criteria), w = vec(w)), list(ebar = o_wsum(e, w))))
we("six-w.5.5", e6, six_ids, sixK, c(0.5, 0.5))
we("six-w.8.2", e6, six_ids, sixK, c(0.8, 0.2))
we("six-w0.1", e6, six_ids, sixK, c(0, 1))
we("tb14-w.6.4", tb14, abcd, two, c(3/5, 2/5))
we("tb12-cyclic-equal", cyc, c("A", "B", "C"), c("k1", "k2", "k3"), rep(1/3, 3))
eb <- o_wsum(e6, c(0.5, 0.5))
check_close(c(eb[1, 2], eb[1, 4], eb[1, 3], eb[3, 1], eb[2, 3], eb[3, 2]), c(0.166, 0.181, 0.380, 0.620, 0.484, 0.516), 5e-4,
            "P-02 weighted errors A-B .166, A-D .181, A-C .380/.620, B-C .484/.516")

# ---- commonalityCost ----------------------------------------------------------------------------------------------
cc <- function(id, e, ids, criteria, w, tau, family) {
  r <- o_commonality(e, w, tau, family)
  add(row(paste0("commonalityCost-", id), "commonalityCost",
          list(E = earr(e, ids, criteria), w = vec(w), tau = tau, family = family),
          list(common = vec(r$common$grades[1, ]), perCriterion = r$perCriterion)))
  invisible(r)
}
c6 <- cc("six-w.5.5-tau.2-atMost3", e6, six_ids, sixK, c(0.5, 0.5), 0.2, list(kind = "atMost", G = 3))
stopifnot(identical(as.integer(c6$common$grades[1, ]), c(1L, 1L, 1L, 1L, 2L, 3L)))                 # P-02 {A-D}/E/F
check_close(sapply(c6$perCriterion, `[[`, "delta"), c(0.0490, 0.0145), 5e-5, "P-03: Delta_A .0490, Delta_B .0145")
check_close(sapply(c6$perCriterion, `[[`, "commonRk"), c(0.0906, 0.0960), 5e-5, "P-03: common R_k .0906, .0960")
check_close(sapply(c6$perCriterion, `[[`, "ownRk"), c(0.0417, 0.0816), 5e-5, "P-03: own R_k .0417, .0816")
stopifnot(identical(unclass(c6$perCriterion[[1]]$ownGrades[[1]]), c(1L, 1L, 2L, 2L, 3L, 3L)),
          length(c6$perCriterion[[2]]$ownGrades) == 2L,                                               # two tied own reports
          identical(unclass(c6$perCriterion[[2]]$ownGrades[[1]]), c(1L, 2L, 1L, 1L, 3L, 3L)),
          identical(unclass(c6$perCriterion[[2]]$ownGrades[[2]]), c(2L, 2L, 1L, 2L, 3L, 3L)))
c6all <- cc("six-w.5.5-tau.2-all", e6, six_ids, sixK, c(0.5, 0.5), 0.2, list(kind = "all"))
stopifnot(identical(c6all$common$grades[1, ], c6$common$grades[1, ]))                              # P-02: no cap, same report
cc("six-w.8.2-tau.2-atMost3", e6, six_ids, sixK, c(0.8, 0.2), 0.2, list(kind = "atMost", G = 3))
cc("six-w.5.5-tau.3-exactly3", e6, six_ids, sixK, c(0.5, 0.5), 0.3, list(kind = "exactly", G = 3))
c14 <- cc("tb14-w.6.4-tau.25-all", tb14, abcd, two, c(3/5, 2/5), 1/4, list(kind = "all"))
check_close(c14$common$value, 3/20, 1e-15, "theory book ch. 14: A|BC|D has risk 3/20")
stopifnot(identical(as.integer(c14$common$grades[1, ]), c(1L, 2L, 2L, 3L)))

# ---- estimandCosts ------------------------------------------------------------------------------------------------
ec <- function(id, state, w, a, tau, scale) {
  r <- o_estimand(state, w, a, tau, scale)
  add(row(paste0("estimandCosts-", id), "estimandCosts",
          list(state = unname(state), w = vec(w), a = vec(a), tau = tau, multiplier = vec(scale)), r))
  invisible(r)
}
m2 <- rbind(c(1, -2), c(0, 0))                      # vignette m2: A = (1, -2), B = (0, 0)
r_m2 <- ec("m2-w.75.25-a.5.5-tau.3", m2, c(3/4, 1/4), c(1/2, 1/2), 0.3, c(1, 1))
stopifnot(identical(unlist(r_m2$criterionCosts), c(iAboveJ = 0.25, jAboveI = 0.75, withhold = 0.3)),
          identical(unclass(r_m2$composite), c(-0.5, 0)), identical(unclass(r_m2$criterionBest), "iAboveJ"),
          identical(unclass(r_m2$compositeBest), "jAboveI"))
r_m2s <- ec("m2-w.75.25-a.5.5-tau.3-scale2.25", m2, c(3/4, 1/4), c(1/2, 1/2), 0.3, c(1, 1/4))
stopifnot(identical(unclass(r_m2s$composite), c(0.25, 0)), identical(r_m2s$criterionCosts, r_m2$criterionCosts),
          identical(unclass(r_m2s$compositeBest), "iAboveJ"))                                    # the composite flips
ec("m2-w.75.25-a.75.25-tau.3", m2, c(3/4, 1/4), c(3/4, 1/4), 0.3, c(1, 1))                      # P-04: the two agree here
# Theory book ch. 12 conflict family: A = (u, -v), B = (0, 0), a = (1/2, 1/2), w = (3/4, 1/4).
for (uv in list(c(2, 1), c(1, 2), c(1, 1))) {
  r <- ec(sprintf("tb12-u%g-v%g-tau.25", uv[1], uv[2]), rbind(c(uv[1], -uv[2]), c(0, 0)), c(3/4, 1/4), c(1/2, 1/2), 0.25, c(1, 1))
  stopifnot(identical(unlist(r$criterionCosts)[1:2], c(iAboveJ = 0.25, jAboveI = 0.75)))
  if (uv[1] == uv[2]) stopifnot(identical(unlist(r$compositeCosts)[1:2], c(iAboveJ = 1, jAboveI = 1)),
                                identical(unclass(r$compositeBest), "withhold"))                  # composite tie
}
# ch. 12 three-unit rescaling: A = (-2, 4), B = (1, 0), C = (2, -1), a = (1/2, 1/2): composites (1, 1/2, 1/2);
# dividing criterion 2 by ten gives (-4/5, 1/2, 19/20); compensating with a' = (1/2, 5) restores (1, 1/2, 1/2).
s3 <- rbind(c(-2, 4), c(1, 0), c(2, -1))
r3 <- ec("tb12-three-unit-a.5.5", s3, c(1/2, 1/2), c(1/2, 1/2), 0.25, c(1, 1))
r3s <- ec("tb12-three-unit-a.5.5-scale2.1", s3, c(1/2, 1/2), c(1/2, 1/2), 0.25, c(1, 1/10))
r3c <- ec("tb12-three-unit-nonsimplex-a.5-5-scale2.1", s3, c(1/2, 1/2), c(1/2, 5), 0.25, c(1, 1/10))
check_close(r3$composite, c(1, 1/2, 1/2), 0, "ch. 12 composites (1, 1/2, 1/2)")
check_close(r3s$composite, c(-4/5, 1/2, 19/20), 1e-15, "ch. 12 rescaled composites (-4/5, 1/2, 19/20)")
check_close(r3c$composite, c(1, 1/2, 1/2), 1e-15, "ch. 12 compensated composites")

# ---- budgetFamily and budgetCheck ---------------------------------------------------------------------------------
bf <- function(id, e, ids, criteria, w, tau, family, q) {
  r <- o_budget_family(e, w, tau, family, q)
  add(row(paste0("budgetFamily-", id), "budgetFamily",
          list(E = earr(e, ids, criteria), w = vec(w), tau = tau, family = family, q = vec(q)), r))
  invisible(r)
}
cap3 <- list(kind = "atMost", G = 3); ex3 <- list(kind = "exactly", G = 3)
b03 <- bf("six-w.5.5-tau.2-atMost3-qB.03", e6, six_ids, sixK, c(0.5, 0.5), 0.2, cap3, c(1, 0.03))
b02 <- bf("six-w.5.5-tau.2-atMost3-qB.02", e6, six_ids, sixK, c(0.5, 0.5), 0.2, cap3, c(1, 0.02))
b025 <- bf("six-w.5.5-tau.2-atMost3-qB.025", e6, six_ids, sixK, c(0.5, 0.5), 0.2, cap3, c(1, 0.025))
bnone <- bf("six-w.5.5-tau.2-atMost3-q1.1", e6, six_ids, sixK, c(0.5, 0.5), 0.2, cap3, c(1, 1))
bex02 <- bf("six-w.5.5-tau.2-exactly3-qB.02", e6, six_ids, sixK, c(0.5, 0.5), 0.2, ex3, c(1, 0.02))
bex0265 <- bf("six-w.5.5-tau.2-exactly3-qB.0265", e6, six_ids, sixK, c(0.5, 0.5), 0.2, ex3, c(1, 0.0265))
bex03 <- bf("six-w.5.5-tau.2-exactly3-qB.03", e6, six_ids, sixK, c(0.5, 0.5), 0.2, ex3, c(1, 0.03))
bA <- bf("six-w1.0-tau.2-atMost3-qB.10", e6, six_ids, sixK, c(1, 0), 0.2, cap3, c(1, 0.10))
stopifnot(b03$size == 3L, identical(unclass(b03$grades[[1]]), c(1L, 1L, 1L, 1L, 2L, 3L)),            # P-05
          b02$size == 2L, identical(unclass(b02$grades[[1]]), c(1L, 1L, 1L, 1L, 2L, 2L)),
          bnone$size == 603L, identical(unclass(bnone$grades[[1]]), c(1L, 1L, 1L, 1L, 2L, 3L)),
          isTRUE(bex02$empty), isTRUE(bex0265$empty),                                                   # empty up to .0267
          identical(unclass(bA$grades[[1]]), c(1L, 1L, 1L, 1L, 2L, 3L)))
check_close(c(b02$risk, b03$risk), c(0.0939, 0.0933), 5e-5, "P-05 risks .0939 and .0933")
check_close(o_Ek(c(1, 1, 1, 1, 2, 2), e6)[2] / 8, 0.0001, 5e-5, "P-05: E_B/N .0001 for {A,B,C,D}/{E,F}")
check_close(bA$risk, 0.0906, 5e-5, "P-05: budget-meeting report has risk .0906 on score A")
# Theory book ch. 13 protection example: both criteria q = 1/2, w = (1, 0); all-withheld is the only protected action.
bp <- bf("tb13-protect-w1.0-tau.25-all-q.5.5", tb13p, AB, two, c(1, 0), 0.25, list(kind = "all"), c(0.5, 0.5))
stopifnot(bp$size == 1L, identical(unclass(bp$grades[[1]]), c(1L, 1L)), bp$risk == 0.25)
bpe <- bf("tb13-protect-w1.0-tau.25-exactly2-q.5.5", tb13p, AB, two, c(1, 0), 0.25, list(kind = "exactly", G = 2), c(0.5, 0.5))
stopifnot(isTRUE(bpe$empty))

bc <- function(id, g, e, ids, criteria, q) add(row(paste0("budgetCheck-", id), "budgetCheck",
  list(g = vec(g), E = earr(e, ids, criteria), q = vec(q)), o_budget_check(g, e, q)))
bc("six-112233-qB.10", c(1, 1, 2, 2, 3, 3), e6, six_ids, sixK, c(1, 0.10))
check_close(o_Ek(c(1, 1, 2, 2, 3, 3), e6)[2] / 12, 0.237, 5e-4, "P-05: score A's own best has E_B/N .237")
stopifnot(!o_budget_check(c(1, 1, 2, 2, 3, 3), e6, c(1, 0.10))$all)
bc("six-111123-qB.02", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(1, 0.02))
bc("six-111123-qB.03", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(1, 0.03))
bc("six-111123-qA.01-qB.03", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(0.01, 0.03))
bc("six-all-withheld-q0.0", rep(1, 6), e6, six_ids, sixK, c(0, 0))                       # N = 0 passes (0 <= 0)
bc("tb13-protect-AaboveB-q.5.5", c(1, 2), tb13p, AB, two, c(0.5, 0.5))
bc("tb13-protect-BaboveA-q.5.5", c(2, 1), tb13p, AB, two, c(0.5, 0.5))
stopifnot(o_budget_check(rep(1, 6), e6, c(0, 0))$all, !o_budget_check(c(1, 2), tb13p, c(0.5, 0.5))$all)

# ---- criterionMixtureRisk -----------------------------------------------------------------------------------------
cm <- function(id, g, e, ids, criteria, w, tau) {
  r <- sum(w * o_Rk(g, e, tau))                       # sum_k w_k R_k (theory book ch. 11, prp-criterion-mixture)
  check_close(r, o_risk(g, e, tau, w), 1e-15, paste("mixture = weighted risk", id))
  add(row(paste0("criterionMixtureRisk-", id), "criterionMixtureRisk",
          list(g = vec(g), E = earr(e, ids, criteria), w = vec(w), tau = tau), list(risk = r)))
  invisible(r)
}
r_mix <- cm("six-111123-w.5.5-tau.2", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(0.5, 0.5), 0.2)
check_close(r_mix, 0.0933, 5e-5, "P-06: both views .0933")
cm("six-111123-w1.0-tau.2", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(1, 0), 0.2)
cm("six-111123-w0.1-tau.2", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, c(0, 1), 0.2)
cm("six-strict-w.8.2-tau.4", 1:6, e6, six_ids, sixK, c(0.8, 0.2), 0.4)
cm("six-121233-w.5.5-tau.4", c(1, 2, 1, 2, 3, 3), e6, six_ids, sixK, c(0.5, 0.5), 0.4)   # P-06 coherence view report
cm("six-all-withheld-w.5.5-tau.3", rep(1, 6), e6, six_ids, sixK, c(0.5, 0.5), 0.3)
cm("tb14-1223-w.6.4-tau.25", c(1, 2, 2, 3), tb14, abcd, two, c(3/5, 2/5), 1/4)
cm("tb12-cyclic-123-equal-tau.45", c(1, 2, 3), cyc, c("A", "B", "C"), c("k1", "k2", "k3"), rep(1/3, 3), 9/20)
check_close(o_risk(c(1, 2, 3), cyc, 9/20, rep(1/3, 3)), 4/9, 1e-15, "ch. 12 cyclic: strict order risk 4/9")
check_close(o_risk(c(1, 2, 2, 3), tb14, 1/4, c(3/5, 2/5)), 3/20, 1e-15, "ch. 14: A|BC|D risk 3/20")

# ---- minimaxChoice ------------------------------------------------------------------------------------------------
mc <- function(id, e, ids, criteria, w, tau, family) {
  r <- o_minimax(e, w, tau, family)
  add(row(paste0("minimaxChoice-", id), "minimaxChoice",
          list(E = earr(e, ids, criteria), w = vec(w), tau = tau, family = family), r))
  invisible(r)
}
for (om in c(0, 0.3, 0.5, 0.7, 0.9, 1)) {
  r <- mc(sprintf("tb13-omega%g-tau.25-all", om), tb13, AB, two, c(om, 1 - om), 1/4, list(kind = "all"))
  stopifnot(identical(lapply(r$minimax$grades, unclass), list(c(1L, 1L))), r$minimax$value == 1/4)   # always withholds
  wg <- lapply(r$weighted$grades, unclass)
  if (om < 0.5) stopifnot(identical(wg, list(c(1L, 1L))))
  if (om == 0.5) stopifnot(identical(wg, list(c(1L, 1L), c(1L, 2L))))           # tie at omega = 1/2
  if (om > 0.5) stopifnot(identical(wg, list(c(1L, 2L))), abs(r$weighted$risk - (1 - om) / 2) < 1e-16)
}
r_ex2 <- mc("tb13-omega.3-tau.25-exactly2", tb13, AB, two, c(0.3, 0.7), 1/4, list(kind = "exactly", G = 2))
stopifnot(identical(lapply(r_ex2$minimax$grades, unclass), list(c(1L, 2L))), r_ex2$minimax$value == 1/2)
mc("six-w.5.5-tau.2-atMost3", e6, six_ids, sixK, c(0.5, 0.5), 0.2, cap3)
mc("tb14-w.6.4-tau.25-all", tb14, abcd, two, c(3/5, 2/5), 1/4, list(kind = "all"))

# ---- weightCrossing -----------------------------------------------------------------------------------------------
wc <- function(id, g, e, ids, criteria, tau) {
  r <- o_weight_crossing(g, e, tau)
  add(row(paste0("weightCrossing-", id), "weightCrossing", list(g = vec(g), E = earr(e, ids, criteria), tau = tau),
          list(omega = r$omega)))
  invisible(r)
}
w1 <- wc("tb13-AaboveB-tau.25", c(1, 2), tb13, AB, two, 1/4)
stopifnot(w1$omega == 1/2)                           # ch. 13: weighted switch at omega = 1/2
w2 <- wc("tb13-BaboveA-tau.25-none", c(2, 1), tb13, AB, two, 1/4)
stopifnot(is.na(w2$omega))                           # (1 + omega)/2 never reaches 1/4
wc("six-112233-tau.2", c(1, 1, 2, 2, 3, 3), e6, six_ids, sixK, 0.2)
wc("six-221233-tau.2", c(2, 2, 1, 2, 3, 3), e6, six_ids, sixK, 0.2)
wc("six-strict-tau.2", 1:6, e6, six_ids, sixK, 0.2)
wc("six-111123-tau.2-none", c(1, 1, 1, 1, 2, 3), e6, six_ids, sixK, 0.2)

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
# G-05 the bound E <= tau N (budgetCheck with q = tau, one criterion): the six sites' reports on the released score-A
# array and the ch. 10 law's report 1/1/2 (E = 7/20 <= 2/5), tau = .20.
source("r-export/15_part2.R")
for (g in list(c(1, 2, 3, 3, 4, 5), c(1, 1, 2, 2, 3, 3), 1:6))
  bc(sprintf("six-released-%s-q.20", paste(g, collapse = "")), g, p2$six$e, six_ids, "score_A", 0.20)
bc("tb10-law3-112-q.20", c(1, 1, 2), p2$tb10$e, c("A", "B", "C"), "score", 0.20)
check_close(o_budget_check(c(1, 1, 2), p2$tb10$e, 0.2)$E, 7/20, 1e-15, "ch. 10: E of 1/1/2 is 7/20")

assert_no_postrank()
write_golden("oracle-multi", rows, generator = "r-export/06_multi.R", uses_postrank = FALSE)
cat("oracle-multi:", length(rows), "rows\n")

# ---- postrank 1.1.0 ---------------------------------------------------------------------------------------------
load_postrank()
.libPaths(c(postrank_lib, .libPaths()))              # the vignette reader loads postrank through system.file()
source(system.file("scripts", "_vignette-setup.R", package = "postrank"), local = TRUE)
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
check_close(pr_tutorial$law$means, six_means, 0, "hardcoded six-site means equal pr_tutorial$law$means")
check_close(pr_tutorial$two$e, e6, 1e-15, "base-R six-site errors vs pr_tutorial$two$e")
e6p <- unname(pr_tutorial$two$e)

# tutorial_commonality (two solves, status optimal): reproduced by enumeration of A_<=3 (603 reports).
tc <- load_or_compute("tutorial_commonality"); tt <- load_or_compute("tutorial_two")
stopifnot(identical(tc$settings$G_max, 3L), tc$settings$tau == 0.2, identical(unname(tc$settings$weights), c(0.5, 0.5)),
          all(tc$table$own_status == "optimal"), identical(tc$table$criterion_id, sixK))
oc <- o_commonality(e6p, c(0.5, 0.5), 0.2, cap3)
check_close(sapply(oc$perCriterion, `[[`, "commonRk"), tc$table$common_grade_risk, 1e-12, "tutorial_commonality common R_k")
check_close(sapply(oc$perCriterion, `[[`, "ownRk"), tc$table$own_best_risk, 1e-12, "tutorial_commonality own best (enumeration)")
check_close(sapply(oc$perCriterion, `[[`, "delta"), tc$table$cost_lower, 1e-12, "tutorial_commonality cost")
check_close(tc$table$cost_upper, tc$table$cost_lower, 0, "tutorial_commonality: zero-width cost interval")
stopifnot(identical(vapply(oc$perCriterion, function(p) o_N(as.integer(p$ownGrades[[1]])), 0), as.numeric(tc$table$own_disclosures)))
# The common grade is tutorial_two's (the same weighted problem); the package's relation agreement of each own grade
# with it equals base R's for every tied own optimum (score B's two tied reports both give 11/15).
g_com <- unname(tt$fit$grade[six_ids]); stopifnot(identical(as.integer(g_com), as.integer(oc$common$grades[1, ])))
check_close(tc$table$relation_agreement, sapply(oc$perCriterion, `[[`, "relationAgreement"), 1e-15, "tutorial_commonality relation agreement")
check_close(o_agreement(c(2, 2, 1, 2, 3, 3), g_com), tc$table$relation_agreement[2], 1e-15, "score B: both tied own reports agree 11/15")
padd(row("commonalityCost-tutorial_commonality", "commonalityCost",
         list(E = earr(e6p, six_ids, sixK), w = vec(c(0.5, 0.5)), tau = 0.2, family = cap3),
         list(common = vec(as.integer(g_com)), perCriterion = lapply(seq_along(sixK), function(k) list(commonRk = tc$table$common_grade_risk[k],
              ownRk = tc$table$own_best_risk[k], delta = tc$table$cost_lower[k], relationAgreement = tc$table$relation_agreement[k])))))

# tutorial_two (one solve, status optimal, gap 0): the exact optimum of A_<=3 is the cached grade; budgets of one
# leave the family unchanged (603 reports).
g_two <- unname(tt$fit$grade[six_ids]); ev_two <- tt$evaluation
stopifnot(tt$fit$status$normalized == "optimal", tt$fit$objective$risk_absolute_gap == 0,
          identical(as.integer(g_two), c(1L, 1L, 1L, 1L, 2L, 3L)))
bt <- o_budget_family(e6p, c(0.5, 0.5), 0.2, cap3, c(1, 1))
stopifnot(bt$size == 603L, identical(unclass(bt$grades[[1]]), as.integer(g_two)), length(bt$grades) == 1L)
check_close(bt$risk, ev_two$primary_risk, 1e-12, "tutorial_two risk vs enumeration")
padd(row("budgetFamily-tutorial_two-q1.1", "budgetFamily",
         list(E = earr(e6p, six_ids, sixK), w = vec(c(0.5, 0.5)), tau = 0.2, family = cap3, q = vec(c(1, 1))),
         list(size = 603L, empty = FALSE, grades = list(vec(as.integer(g_two))), risk = ev_two$primary_risk)))
for (k in 0:2) {                                    # weighted risk, then each criterion's risk (unit weights)
  w <- if (k == 0) c(0.5, 0.5) else as.numeric(seq_along(sixK) == k)
  r <- if (k == 0) ev_two$weighted_risk else unname(ev_two$criterion_risk[sixK[k]])
  check_close(r, sum(w * o_Rk(g_two, e6p, 0.2)), 1e-15, "tutorial_two criterion risks vs base R")
  padd(row(sprintf("criterionMixtureRisk-tutorial_two-w%s", paste(w, collapse = ".")), "criterionMixtureRisk",
           list(g = vec(g_two), E = earr(e6p, six_ids, sixK), w = vec(w), tau = 0.2), list(risk = r)))
}

# commonality_30x3 (tau .25) and commonality_30x3_tau35 (three solves each, status optimal) on the pr_example_draws
# array (S = 4,000 draws, so every e is an exact multiple of 1/4,000). The browser cannot enumerate 30 units with at
# most 4 grades, but the fixed-order DP reproduces every cached value: the common optimum is the DP in the weighted
# expected-rank order, and each criterion's own best is the DP in that criterion's own expected-rank order
# (postrank_cuts(rule = "optimal") agrees with the solver to 1e-12; no expected-rank ties, smallest gap .013).
a25 <- load_or_compute("analysis_30x3"); a35 <- load_or_compute("analysis_30x3_tau35")
c25 <- load_or_compute("commonality_30x3"); c35 <- load_or_compute("commonality_30x3_tau35")
pw30 <- a25$pairwise; ids30 <- pw30$entity_ids; k30 <- pw30$criterion_ids
stopifnot(identical(pw30$e, a35$pairwise$e), all(abs(pw30$e * 4000 - round(pw30$e * 4000)) < 1e-9, na.rm = TRUE))
w30 <- c(poverty = 0.5, frl = 0.25, snap = 0.25)
dp_order <- function(w, tau) {
  s <- postrank_settings(w, tau = tau, G_max = 4L); er <- postrank_expected_rank(pw30, w)
  stopifnot(!anyDuplicated(er))
  b <- postrank_cuts(er, pw30, s, direction = "ascending", rule = "optimal")
  list(order = match(b$order, ids30) - 1L, grade = unname(b$grade[ids30]), risk = b$risk)
}
for (cfg in list(list(tau = 0.25, an = a25, cc = c25, key = "commonality_30x3"), list(tau = 0.35, an = a35, cc = c35, key = "commonality_30x3_tau35"))) {
  tab <- cfg$cc$table; stopifnot(identical(tab$criterion_id, k30), all(tab$own_status == "optimal"))
  com <- dp_order(w30, cfg$tau); g_com <- unname(cfg$an$fit$grade[ids30])
  stopifnot(identical(as.integer(com$grade), as.integer(g_com)), cfg$an$fit$status$normalized == "optimal")
  check_close(com$risk, cfg$an$evaluation$primary_risk, 1e-12, paste(cfg$key, "common DP risk vs cached analysis"))
  Rk_com <- o_Rk(g_com, unname(pw30$e), cfg$tau)
  check_close(Rk_com, tab$common_grade_risk, 1e-12, paste(cfg$key, "common R_k"))
  own <- lapply(k30, function(k) dp_order(setNames(as.numeric(k30 == k), k30), cfg$tau))
  check_close(sapply(own, `[[`, "risk"), tab$own_best_risk, 1e-12, paste(cfg$key, "own best: DP in own expected-rank order = solver"))
  check_close(Rk_com - sapply(own, `[[`, "risk"), tab$cost_lower, 1e-12, paste(cfg$key, "cost"))
  stopifnot(identical(vapply(own, function(o) o_N(o$grade), 0), as.numeric(tab$own_disclosures)))
  padd(row(paste0("commonalityByOrderDP-", cfg$key), "commonalityByOrderDP",
           list(E = earr(unname(pw30$e), ids30, k30), w = vec(unname(w30)), tau = cfg$tau, G = 4L,
                commonOrder = vec(com$order), ownOrders = lapply(own, function(o) vec(o$order))),
           list(commonGrade = vec(as.integer(g_com)), commonRisk = cfg$an$evaluation$primary_risk,
                perCriterion = lapply(seq_along(k30), function(k) list(commonRk = tab$common_grade_risk[k],
                  ownRk = tab$own_best_risk[k], delta = tab$cost_lower[k])))))
}
stopifnot(all(o_Rk(rep(1L, 30), unname(pw30$e), 0.25) == 0.25))                                  # tau .25: all-withheld

# KRW two-criterion array (pr_case_krw$input: race_signed, gender_signed; 97 firms) at tau = .25: KRW's race and
# gender cards and the archived common grade evaluated as fixed reports (S-03). weightCrossing gives the race weight
# at which each card's risk equals tau; conflictPairs counts pairs whose more likely direction differs.
krw <- pr_case_krw; ek <- unname(krw$input$e); idk <- krw$input$entity_ids; kk <- krw$input$criterion_ids
cards <- list(race = unname(krw$reference$single_criterion$grade$race), gender = unname(krw$reference$single_criterion$grade$gender),
              common = unname(krw$reference$signed_core$grade))
stopifnot(identical(names(krw$reference$signed_core$grade), idk), identical(names(krw$reference$single_criterion$grade$race), idk),
          identical(kk, c("race_signed", "gender_signed")), identical(as.integer(table(cards$common)), c(6L, 90L, 1L)))
wck <- lapply(cards, function(g) o_weight_crossing(g, ek, 0.25))
check_close(wck$race$Rk, c(0.2176, 0.3210), 5e-5, "S-03: race card criterion risks .2176, .3210")
check_close(c(wck$race$omega, wck$gender$omega), c(0.687, 0.290), 5e-4, "S-03: crossings .687 (race card), .290 (gender card)")
check_close(wck$common$Rk, c(0.2427, 0.2483), 5e-5, "S-03: common grade criterion risks .2427, .2483")
stopifnot(is.na(wck$common$omega))                   # the common grade stays below .25 at every weight
for (nm in names(cards)) {                           # postrank_evaluate on the same array agrees with base R
  v <- postrank_evaluate(setNames(as.integer(cards[[nm]]), idk), krw$input, weights = c(race_signed = 0.5, gender_signed = 0.5), tau = 0.25)
  check_close(unname(v$criterion_risk), wck[[nm]]$Rk, 1e-12, paste("KRW", nm, "card: criterion risks vs postrank_evaluate"))
}
check_close(postrank_evaluate(setNames(as.integer(cards$common), idk), krw$input, weights = c(race_signed = 0.5, gender_signed = 0.5),
                              tau = 0.25)$primary_risk, 0.2455, 5e-5, "S-03: common grade risk .2455")
pk <- o_conflict_pairs(ek)
padd(row("krwTwoCriterion-cards-tau.25", "krwTwoCriterion",
         list(E = earr(ek, idk, kk), tau = 0.25, grades = lapply(cards, vec)),
         list(crossing = lapply(wck, `[[`, "omega"), Rk = lapply(wck, `[[`, "Rk"), conflictCount = length(pk))))

# postrank_composite() (coefficients a on the simplex; scales divide, centers 0) against the composite target of
# estimandCosts on the six posterior means taken as a known state; engine multiplier = 1 / package scale.
for (cfg in list(list(a = c(0.5, 0.5), sc = c(1, 1)), list(a = c(0.8, 0.2), sc = c(1, 1)), list(a = c(1, 0), sc = c(1, 1)),
                 list(a = c(0.5, 0.5), sc = c(1, 4)), list(a = c(0.25, 0.75), sc = c(2, 0.5)))) {
  pc <- postrank_composite(pr_tutorial$law$means, weights = setNames(cfg$a, sixK), scales = setNames(cfg$sc, sixK))
  check_close(pc, o_estimand(six_means, c(0.5, 0.5), cfg$a, 0.2, 1 / cfg$sc)$composite, 1e-15, "postrank_composite vs base R")
  padd(row(sprintf("estimandCosts-postrank_composite-a%s-scales%s", paste(cfg$a, collapse = "."), paste(cfg$sc, collapse = ".")),
           "estimandCosts", list(state = unname(six_means), w = vec(c(0.5, 0.5)), a = vec(cfg$a), tau = 0.2, multiplier = vec(1 / cfg$sc)),
           list(composite = vec(unname(pc)))))
}
check_close(postrank_composite(pr_tutorial$law$means, c(score_A = 0.5, score_B = 0.5)), c(0.95, 0.675, 0.575, 0.375, -0.5, -0.75),
            1e-15, "P-04 composite scores .950, .675, .575, .375, -.500, -.750")

write_golden("postrank-multi", prow, generator = "r-export/06_multi.R", uses_postrank = TRUE)
cat("postrank-multi:", length(prow), "rows\n")
