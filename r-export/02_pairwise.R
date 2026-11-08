# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for engine/src/pairwise.ts (Step 2.4).
#   oracle-pairwise    base R only (closed forms, exact integer masses, draw counts); postrank is not loaded.
#   postrank-pairwise  postrank 1.1.0 arrays (pr_tutorial, pr_example_gaussian, postrank_toy, exact finite laws)
#                      against the same engine functions, with base-R cross-checks asserted below.
# Conventions (engine/API.md): units 0-based in code; e[k][i][j] = Pr(theta_ik <= theta_jk); diagonals NaN, written
# as JSON null; arrays are criterion-major (e[k] is an n x n matrix, rows = i). Every row names the engine function
# in args$fn; the parity adapter verification/parity.d/<group>.mjs maps args to the API call.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

# ---- JSON shaping ---------------------------------------------------------------------------------------------
vec <- function(x) I(unname(x))                                   # always a JSON array, even for length 1
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(a[, , k]))   # criterion-major, row-major
states_json <- function(states) lapply(states, function(s) unname(s))                # states[s][i][k]
check_close <- function(a, b, tol, label) {
  a <- as.numeric(a); b <- as.numeric(b)
  if (length(a) != length(b) || any(is.na(a) != is.na(b))) stop("cross-check failed (shape/NA): ", label, call. = FALSE)
  d <- max(c(0, abs(a - b)), na.rm = TRUE)
  if (d > tol) stop(sprintf("cross-check failed: %s (max diff %.3g > %.3g)", label, d, tol), call. = FALSE)
  invisible(d)
}
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)

# ---- base-R oracle (written from the theory book: ch. 9, 11 and App. B) -----------------------------------------
# Pr(theta_A > theta_B) for a bivariate normal; the difference has variance sA^2 + sB^2 - 2 rho sA sB.
o_pair_direction <- function(mA, sA, mB, sB, rho = 0) {
  v <- sA^2 + sB^2 - 2 * rho * sA * sB
  if (!(v > 0)) stop("difference has SD 0")
  pnorm((mA - mB) / sqrt(v))                                     # lower tail directly (no 1 - pnorm)
}
o_direction_matrix <- function(m, s) {
  n <- length(m); p <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) p[i, j] <- o_pair_direction(m[i], s[i], m[j], s[j])
  p
}
# e[i, j, k] = Pr(o_k theta_ik <= o_k theta_jk) for independent normals; o_k = -1 flips the target sign.
o_error_array <- function(means, sds, orient) {
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) {
    m <- orient[k] * means[, k]
    for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
      e[i, j, k] <- pnorm((m[j] - m[i]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  }
  e
}
# Finite law with integer masses over a common denominator: each probability is one correctly rounded rational.
o_finite_law <- function(states, masses) {
  n <- nrow(states[[1]]); K <- ncol(states[[1]]); den <- sum(masses)
  cnt <- function(rel) {
    a <- array(NA_real_, c(n, n, K))
    for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
      a[i, j, k] <- sum(masses[vapply(states, function(s) rel(s[i, k], s[j, k]), logical(1))])
    a
  }
  gt <- cnt(`>`); le <- cnt(`<=`); eq <- cnt(`==`); lt <- cnt(`<`)
  list(pi = gt / den, e = le / den, t = eq / den, b = lt / den, d = (den - eq) / den)
}
o_mixture <- function(comp) sum(vapply(comp, function(c) c$w * o_pair_direction(c$meanA, c$sdA, c$meanB, c$sdB, c$corr), 0))
# Equal-weight draws draws[[s]] (n x K): e = share of draws with theta_i <= theta_j.
o_draw_errors <- function(draws) o_finite_law(draws, rep(1L, length(draws)))$e
st <- function(..., ids, criteria) {          # one state: columns = criteria
  m <- cbind(...); dimnames(m) <- list(entity = ids, criterion = criteria); m
}

# Six fictional sites (pr_tutorial$law: data-raw/pr-tutorial-law.json); SD .2 for every site and criterion.
# Hardcoded here so that the oracle never loads postrank; the postrank part below asserts they equal the dataset.
six_ids <- LETTERS[1:6]
six_means <- cbind(score_A = c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8), score_B = c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7))
six_sds <- matrix(0.2, 6, 2)

rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# pairDirection: corr default, positive/negative correlation, equal means, far tails, unequal SDs.
pd <- list(
  list("eq-means", 0.4, 0.2, 0.4, 0.3, NULL), list("A-above", 1.2, 0.2, 0.95, 0.2, NULL),
  list("A-below", 0.15, 0.2, 0.25, 0.2, NULL), list("corr-.5", 1.2, 0.2, 0.95, 0.2, 0.5),
  list("corr--.5", 1.2, 0.2, 0.95, 0.2, -0.5), list("corr-.9-unequal", 0.3, 0.5, 0.1, 0.2, 0.9),
  list("corr-1-unequal", 0.3, 0.3, 0.1, 0.2, 1), list("corr-0-explicit", -0.5, 0.25, -0.8, 0.15, 0),
  list("far-upper", 2, 0.1, -2, 0.1, NULL), list("far-lower", -2, 0.1, 2, 0.1, NULL),
  list("tail-z--20", 0, 0.1, 2 * sqrt(2), 0.1, NULL), list("negative-means", -1.3, 0.4, -0.2, 0.7, -0.25))
for (p in pd) {
  a <- list(meanA = p[[2]], sdA = p[[3]], meanB = p[[4]], sdB = p[[5]])
  if (!is.null(p[[6]])) a$corr <- p[[6]]
  add(row(paste0("pairDirection-", p[[1]]), "pairDirection", a,
          list(pi = o_pair_direction(p[[2]], p[[3]], p[[4]], p[[5]], if (is.null(p[[6]])) 0 else p[[6]]))))
}
# The difference must have positive SD (API: throws).
add(row("pairDirection-throws-sd0", "pairDirectionThrows", list(meanA = 1, sdA = 0, meanB = 0, sdB = 0), list(threw = TRUE)))
add(row("pairDirection-throws-corr1-equal-sd", "pairDirectionThrows",
        list(meanA = 1, sdA = 0.3, meanB = 0, sdB = 0.3, corr = 1), list(threw = TRUE)))

# directionMatrix (Part 1, one criterion, independent normals).
add(row("directionMatrix-six-scoreA", "directionMatrix", list(means = vec(six_means[, 1]), sds = vec(six_sds[, 1])),
        list(pi = o_direction_matrix(six_means[, 1], six_sds[, 1]))))
dm_m <- c(0.3, -0.1, 0.3, 1.4); dm_s <- c(0.1, 0.5, 0.25, 0.05)
add(row("directionMatrix-four-unequal-sd", "directionMatrix", list(means = vec(dm_m), sds = vec(dm_s)),
        list(pi = o_direction_matrix(dm_m, dm_s))))

# errorArray: K = 1 and K = 2, orientation +1 and -1, unequal SDs.
ea <- function(id, means, sds, orient, ids, criteria) {
  e <- o_error_array(means, sds, orient)
  add(row(paste0("errorArray-", id), "errorArray",
          list(means = unname(means), sds = unname(sds), ids = vec(ids), criteria = vec(criteria), orient = vec(orient)),
          list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))))
  invisible(e)
}
e_six_A <- ea("six-K1", six_means[, 1, drop = FALSE], six_sds[, 1, drop = FALSE], 1, six_ids, "score_A")
ea("six-K1-orient-minus", six_means[, 1, drop = FALSE], six_sds[, 1, drop = FALSE], -1, six_ids, "score_A")
e_six_AB <- ea("six-K2", six_means, six_sds, c(1, 1), six_ids, c("score_A", "score_B"))
ea("six-K2-orient-plus-minus", six_means, six_sds, c(1, -1), six_ids, c("score_A", "score_B"))
ea_m <- cbind(c(0.3, -0.1, 0.3, 1.4), c(-2, 0, 1.5, 0.2)); ea_s <- cbind(c(0.1, 0.5, 0.25, 0.05), c(0.3, 0.3, 1, 0.6))
ea("four-K2-orient-minus-plus-unequal-sd", ea_m, ea_s, c(-1, 1), c("u1", "u2", "u3", "u4"), c("need", "cost"))
# Orientation -1 is the same as negating the means.
check_close(o_error_array(six_means, six_sds, c(1, -1))[, , 2], o_error_array(-six_means, six_sds, c(1, 1))[, , 2], 0,
            "orient -1 equals negated means")

# finiteLawPairwise: {pi, e, t}; exact laws from the theory book plus laws with ties (e_ij + e_ji > 1).
fl <- function(id, states, masses, ids, criteria, extra = NULL) {
  L <- o_finite_law(states, masses)
  add(row(paste0("finiteLawPairwise-", id), "finiteLawPairwise",
          list(states = states_json(states), probs = vec(masses / sum(masses)), ids = vec(ids), criteria = vec(criteria)),
          list(pi = cube_json(L$pi), e = cube_json(L$e), t = cube_json(L$t))))
  invisible(L)
}
AB <- c("A", "B"); one <- "score"
# Theory book ch. 9: equal uniform marginals on {0,1,2}, Pr(A > B) = 1/3 under Q1 and 2/3 under Q2.
q1 <- lapply(list(c(0, 1), c(1, 2), c(2, 0)), function(v) st(v, ids = AB, criteria = one))
q2 <- lapply(list(c(0, 2), c(1, 0), c(2, 1)), function(v) st(v, ids = AB, criteria = one))
L1 <- fl("tb09-Q1", q1, c(1L, 1L, 1L), AB, one); L2 <- fl("tb09-Q2", q2, c(1L, 1L, 1L), AB, one)
stopifnot(abs(L1$pi[1, 2, 1] - 1/3) < 1e-16, abs(L2$pi[1, 2, 1] - 2/3) < 1e-16)
# m4 vignette law: B = 1; A = 0, 1, 2 with masses 1, 4, 5 (of 10): ties, e_AB + e_BA = 1.4 > 1.
m4_states <- lapply(c(0, 1, 2), function(a) st(c(a, 1), ids = AB, criteria = one))
L4 <- fl("m4-ties", m4_states, c(1L, 4L, 5L), AB, one)
stopifnot(abs(L4$e[1, 2, 1] - 0.5) < 1e-16, abs(L4$e[2, 1, 1] - 0.9) < 1e-16, abs(L4$t[1, 2, 1] - 0.4) < 1e-16,
          abs(L4$e[1, 2, 1] + L4$e[2, 1, 1] - (1 + L4$t[1, 2, 1])) < 1e-15)   # ch. 11: e_ij + e_ji = 1 + t
# Theory book ch. 14: four units, two criteria, states 3/4 (ABCD, ACBD) and 1/4 (BACD, DCBA), values 4,3,2,1.
abcd <- c("A", "B", "C", "D"); two <- c("c1", "c2")
rank_vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], abcd)] <- 4:1; v }
tb14_states <- list(st(rank_vals("ABCD"), rank_vals("ACBD"), ids = abcd, criteria = two),
                    st(rank_vals("BACD"), rank_vals("DCBA"), ids = abcd, criteria = two))
L14 <- fl("tb14-four-unit", tb14_states, c(3L, 1L), abcd, two)
# Table of ch. 14: forward errors A>B 1/4,1/4; A>C 0,1/4; A>D 0,1/4; B>C 0,1; B>D 0,1/4; C>D 0,1/4.
stopifnot(all(abs(L14$e[cbind(c(1, 1, 1, 2, 2, 3), c(2, 3, 4, 3, 4, 4), 1)] - c(1/4, 0, 0, 0, 0, 0)) < 1e-16),
          all(abs(L14$e[cbind(c(1, 1, 1, 2, 2, 3), c(2, 3, 4, 3, 4, 4), 2)] - c(1/4, 1/4, 1/4, 1, 1/4, 1/4)) < 1e-16))
# Theory book ch. 11: B fixed at (0,0); A is (2,2) or (-1,-1) (law 1) or (2,-1) or (-1,2) (law 2); each criterion 1/2.
c11a <- list(st(c(2, 0), c(2, 0), ids = AB, criteria = two), st(c(-1, 0), c(-1, 0), ids = AB, criteria = two))
c11b <- list(st(c(2, 0), c(-1, 0), ids = AB, criteria = two), st(c(-1, 0), c(2, 0), ids = AB, criteria = two))
La <- fl("tb11-law1", c11a, c(1L, 1L), AB, two); Lb <- fl("tb11-law2", c11b, c(1L, 1L), AB, two)
stopifnot(identical(La$e, Lb$e), all(abs(La$e[1, 2, ] - 0.5) < 1e-16))
# Three units, three unequal states, ties on the second criterion.
u3 <- c("u1", "u2", "u3")
tie3 <- list(st(c(1, 2, 3), c(0, 0, 1), ids = u3, criteria = two), st(c(3, 2, 1), c(1, 0, 1), ids = u3, criteria = two),
             st(c(2, 2, 0), c(2, 2, 2), ids = u3, criteria = two))
fl("three-unit-ties", tie3, c(2L, 3L, 5L), u3, two)
# Theory book ch. 16 (equality-neutral frontier): criterion 1 (0,0,2,3) w.p. 3/5 or (0,0,2,1) w.p. 2/5;
# criterion 2 always (0,0,0,1).
tb16_states <- list(st(c(0, 0, 2, 3), c(0, 0, 0, 1), ids = abcd, criteria = two),
                    st(c(0, 0, 2, 1), c(0, 0, 0, 1), ids = abcd, criteria = two))
fl("tb16-tie-law", tb16_states, c(3L, 2L), abcd, two)

# mixturePairDirection: sum_c w_c Pr_c(theta_A > theta_B).
mx <- function(id, comps) add(row(paste0("mixturePairDirection-", id), "mixturePairDirection",
                                  list(components = comps), list(pi = o_mixture(comps))))
cmp <- function(w, mA, sA, mB, sB, corr) list(w = w, meanA = mA, sdA = sA, meanB = mB, sdB = sB, corr = corr)
mx("single-equals-pairDirection", list(cmp(1, 1.2, 0.2, 0.95, 0.2, 0)))
stopifnot(o_mixture(list(cmp(1, 1.2, 0.2, 0.95, 0.2, 0))) == o_pair_direction(1.2, 0.2, 0.95, 0.2))
mx("two-equal-weights", list(cmp(0.5, 1, 0.3, 0, 0.3, 0), cmp(0.5, -1, 0.3, 0, 0.3, 0)))
mx("two-unequal-corr", list(cmp(0.3, 0.8, 0.4, 0.2, 0.3, 0.5), cmp(0.7, -0.1, 0.2, 0.3, 0.25, -0.3)))
mx("three-components", list(cmp(0.2, 2, 0.5, 0, 0.5, 0), cmp(0.5, 0, 0.1, 0.1, 0.1, 0.9), cmp(0.3, -1, 1, 0.5, 0.2, 0)))

# drawErrors: equal-weight draws draws[s][i][k] with ties (equal values count as errors in both directions).
de <- function(id, draws, ids, criteria) {
  e <- o_draw_errors(draws)
  add(row(paste0("drawErrors-", id), "drawErrors", list(draws = states_json(draws), ids = vec(ids), criteria = vec(criteria)),
          list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))))
  invisible(e)
}
d1 <- lapply(list(c(1, 2, 2), c(3, 1, 2), c(2, 2, 0), c(0.5, 0.5, 0.5)), function(v) st(v, ids = u3, criteria = one))
E1 <- de("S4-n3-K1-ties", d1, u3, one)
stopifnot(abs(E1[1, 2, 1] + E1[2, 1, 1] - 1.5) < 1e-16)            # two of four draws tie A and B
d2 <- lapply(list(c(1, 2, 3, 1, 1, 0), c(2, 2, 1, 0, 0, 0), c(-1, 0.25, 0.25, 2, 1, 2), c(4, 3, 2, 1, 2, 3),
                  c(0, 0, 0, 0.5, 0.5, 0.5)), function(v) st(v[1:3], v[4:6], ids = u3, criteria = two))
de("S5-n3-K2-ties", d2, u3, two)
de("S1-one-draw", list(st(c(0.2, -0.4, 0.2, 1.1), ids = abcd, criteria = one)), abcd, one)
de("S3-all-equal", lapply(1:3, function(s) st(c(s, s), ids = AB, criteria = one)), AB, one)

# tieLawPairwise: {b, t, d} with b = Pr(theta_i < theta_j), t = Pr(theta_i = theta_j), d = 1 - t.
tl <- function(id, states, masses, ids, criteria) {
  L <- o_finite_law(states, masses)
  stopifnot(all(abs(L$b + aperm(L$b, c(2, 1, 3)) - L$d) < 1e-15, na.rm = TRUE))   # b_ij + b_ji = d_ij (ch. 11)
  add(row(paste0("tieLawPairwise-", id), "tieLawPairwise",
          list(states = states_json(states), probs = vec(masses / sum(masses)), ids = vec(ids), criteria = vec(criteria)),
          list(b = cube_json(L$b), t = cube_json(L$t), d = cube_json(L$d))))
  invisible(L)
}
T4 <- tl("m4-law", m4_states, c(1L, 4L, 5L), AB, one)
stopifnot(abs(T4$b[1, 2, 1] - 0.1) < 1e-16, abs(T4$b[2, 1, 1] - 0.5) < 1e-16, abs(T4$d[1, 2, 1] - 0.6) < 1e-16)
guard_state <- list(st(c(2, 2, 0), c(0, 1, 2), ids = c("A", "B", "C"), criteria = c("shared", "individual")))
tl("m4-guard-profile", guard_state, 1L, c("A", "B", "C"), c("shared", "individual"))
T16 <- tl("tb16-tie-law", tb16_states, c(3L, 2L), abcd, two)
w16 <- c(1/4, 3/4)
stopifnot(abs(sum(sapply(1:2, function(k) w16[k] * sum(T16$d[, , k][upper.tri(T16$d[, , k])]))) - 7/2) < 1e-15)  # T = 7/2
tl("tb09-Q1-tie-free", q1, c(1L, 1L, 1L), AB, one)
tl("three-unit-ties", tie3, c(2L, 3L, 5L), u3, two)

# Two-unit comparison widget: Pr(theta_A > theta_B) for independent normals at three settings (meanA, sdA, meanB, sdB),
# forward and reverse (reverse = Pr(theta_B > theta_A), the arguments swapped). The id names the forward setting.
# expect holds pi only (pairDirection returns a number; the adapter compares nothing else). The row's `record`
# (recorded, not compared, as in postrank-mip) holds gap = meanA - meanB of the row's own arguments,
# sdDiff = sqrt(sdA^2 + sdB^2) and z = gap / sdDiff, with pi = pnorm(z) asserted.
fmt2 <- function(x) sub("^(-?)0\\.", "\\1.", sprintf("%.2f", x))
for (p in list(c(0.30, 0.20, 0.10, 0.20), c(0.30, 0.20, 0.10, 0.60), c(0.20, 0.20, 0.20, 0.40))) {
  base_id <- sprintf("pairDirection-mA%s-sA%s-mB%s-sB%s", fmt2(p[1]), fmt2(p[2]), fmt2(p[3]), fmt2(p[4]))
  sd_diff <- sqrt(p[2]^2 + p[4]^2)
  pis <- c()
  for (dir in c("forward", "reverse")) {
    q <- if (dir == "forward") p else p[c(3, 4, 1, 2)]
    gap <- q[1] - q[3]; z <- gap / sd_diff
    pi_q <- o_pair_direction(q[1], q[2], q[3], q[4])
    stopifnot(identical(pi_q, pnorm(z)))                           # pi = Phi(z) for independent normals
    pis[dir] <- pi_q
    r <- row(paste0(base_id, "-", dir), "pairDirection", list(meanA = q[1], sdA = q[2], meanB = q[3], sdB = q[4]), list(pi = pi_q))
    r$record <- list(gap = gap, sdDiff = sd_diff, z = z)
    add(r)
  }
  stopifnot(abs(sum(pis) - 1) < 1e-15)                             # forward + reverse = 1 (no ties under a normal law)
}

# ---- Step 5.14 Part 1 rows ---------------------------------------------------------
# L-07 correlation box at the prediction's setting (means .30/.10, SDs .20/.20): corr .50, .95 and -.95. The record
# (not compared) holds the SD of the difference sqrt(sA^2 + sB^2 - 2 rho sA sB) and z = gap / SD; pi = Phi(z).
for (rho in c(0.50, 0.95, -0.95)) {
  q <- c(0.30, 0.20, 0.10, 0.20)
  sd_diff <- sqrt(q[2]^2 + q[4]^2 - 2 * rho * q[2] * q[4]); z <- (q[1] - q[3]) / sd_diff
  pi_q <- o_pair_direction(q[1], q[2], q[3], q[4], rho)
  stopifnot(identical(pi_q, pnorm(z)), pi_q > 0.5)                 # correlation never moves pi across one half
  r <- row(sprintf("pairDirection-mA.30-sA.20-mB.10-sB.20-corr%s", sub("0\\.", ".", sprintf("%.2f", rho))), "pairDirection",
           list(meanA = q[1], sdA = q[2], meanB = q[3], sdB = q[4], corr = rho), list(pi = pi_q))
  r$record <- list(gap = q[1] - q[3], sdDiff = sd_diff, z = z)
  add(r)
}
check_close(c(sqrt(0.2^2 + 0.2^2 - 2 * 0.5 * 0.2 * 0.2), o_pair_direction(0.3, 0.2, 0.1, 0.2, 0.5)), c(0.2, pnorm(1)), 1e-15,
            "L-07: corr .50 gives SD .200 and z = 1")
# The registry input cf.pair.p1corr50.diffsd.pi: pairDirection(.04, .2, 0, .2, corr .5) = Phi(.04 / SD), SD = .2.
add(row("pairDirection-mA.04-sA.20-mB0-sB.20-corr.50", "pairDirection", list(meanA = 0.04, sdA = 0.2, meanB = 0, sdB = 0.2, corr = 0.5),
        list(pi = o_pair_direction(0.04, 0.2, 0, 0.2, 0.5))))
# L-07 mixture box: unit A is a two-bump mixture (lower bump centre -.10, upper 1.00, each SD .10), unit B normal
# (mean 0, SD .10), independent within each bump. Upper-bump weight .20 (default) and .50; per-bump pairDirection.
# The record holds A's mean sum_c w_c meanA_c.
mix_l07 <- function(w_hi) list(cmp(1 - w_hi, -0.1, 0.1, 0, 0.1, 0), cmp(w_hi, 1, 0.1, 0, 0.1, 0))
add(row("pairDirection-L07-mixture-lower-bump", "pairDirection", list(meanA = -0.1, sdA = 0.1, meanB = 0, sdB = 0.1),
        list(pi = o_pair_direction(-0.1, 0.1, 0, 0.1))))
add(row("pairDirection-L07-mixture-upper-bump", "pairDirection", list(meanA = 1, sdA = 0.1, meanB = 0, sdB = 0.1),
        list(pi = o_pair_direction(1, 0.1, 0, 0.1))))
for (w_hi in c(0.20, 0.50)) {
  comps <- mix_l07(w_hi); p <- o_mixture(comps)
  r <- row(sprintf("mixturePairDirection-L07-upper-weight%s", sub("0\\.", ".", sprintf("%.2f", w_hi))), "mixturePairDirection",
           list(components = comps), list(pi = p))
  r$record <- list(meanA = sum(vapply(comps, function(c) c$w * c$meanA, 0)), meanB = 0,
                   bumpPi = vec(vapply(comps, function(c) o_pair_direction(c$meanA, c$sdA, c$meanB, c$sdB), 0)))
  add(r)
}
stopifnot(o_mixture(mix_l07(0.2)) < 0.5, 0.8 * -0.1 + 0.2 * 1 > 0, o_mixture(mix_l07(0.5)) > 0.5)   # mean above, pi below 1/2
# L-08 league pi matrix: posterior of the frozen draw (seed 20261030) at prior SD .15 (SR-06 teaching posterior,
# engine/API.md), inputs rounded to the 15-digit text the golden file stores.
source("r-export/_rng.R")
r15 <- function(x) { y <- as.numeric(sprintf("%.15g", x)); stopifnot(identical(as.numeric(sprintf("%.15g", y)), y)); y }
lg_se <- 0.8 / sqrt(rep(c(16, 64, 256), 10)); lg_theta <- 0.15 * qnorm((((19 * (1:30)) %% 31) - 0.5) / 30)
lg_est <- r15(lg_theta + lg_se * prx_normals(20261030, 30)); lg_B <- 0.15^2 / (0.15^2 + lg_se^2)
lg_m <- r15(lg_B * lg_est); lg_s <- r15(sqrt(lg_B) * lg_se)
lg_pi <- o_direction_matrix(lg_m, lg_s)
stopifnot(all(abs(lg_pi + t(lg_pi) - 1) < 1e-15, na.rm = TRUE))
add(row("directionMatrix-league-seed20261030-prior.15", "directionMatrix", list(means = vec(lg_m), sds = vec(lg_s)), list(pi = lg_pi)))

# ---- Step 6.14 Part 2 rows (shared inputs in r-export/15_part2.R) --------------------
source("r-export/15_part2.R")
# G-04 KRW Example 1 (omega = (2, omega_2, 0), unit SDs): pi_12 = pairDirection(2, 1, omega_2, 1),
# pi_23 = pairDirection(omega_2, 1, 0, 1), pi_13 = pairDirection(2, 1, 0, 1), at omega_2 = 1, .80, .81, .50.
for (lab in names(p2$krw1_omegas)) {
  w2 <- p2$krw1_omegas[[lab]]
  for (pr in list(list("pi12", 2, w2), list("pi23", w2, 0))) {
    pi_q <- o_pair_direction(pr[[2]], 1, pr[[3]], 1)
    stopifnot(identical(pi_q, pnorm((pr[[2]] - pr[[3]]) / sqrt(2))))
    add(row(sprintf("pairDirection-krwex1-omega%s-%s", lab, pr[[1]]), "pairDirection",
            list(meanA = pr[[2]], sdA = 1, meanB = pr[[3]], sdB = 1), list(pi = pi_q)))
  }
  e_k <- ea(paste0("krwex1-omega", lab), cbind(c(2, w2, 0)), matrix(1, 3, 1), 1, c("A", "B", "C"), "score")
  check_close(e_k, p2$krw1(w2), 1e-15, paste("KRW Example 1 errorArray vs the shared input", lab))
}
add(row("pairDirection-krwex1-pi13", "pairDirection", list(meanA = 2, sdA = 1, meanB = 0, sdB = 1), list(pi = o_pair_direction(2, 1, 0, 1))))
stopifnot(abs(o_pair_direction(2, 1, 0.8, 1) - 0.8019) < 5e-5, o_pair_direction(2, 1, 0.81, 1) < 0.8,      # .80 just above
          o_pair_direction(2, 1, 0.8, 1) > 0.8)                                                            # 1 - tau, .81 below
# G-04 / G-05 theory book ch. 10 three-unit order law and G-06 ch. 19 three-unit law (exact masses).
o_vstate <- function(v) st(v, ids = c("A", "B", "C"), criteria = "score")
L10 <- fl("tb10-law3", unname(lapply(p2$tb10$states, o_vstate)), p2$tb10$masses, c("A", "B", "C"), "score")   # a JSON array of states
stopifnot(identical(L10$e, p2$tb10$e), all(abs(L10$pi[cbind(c(1, 2, 1), c(2, 3, 3), 1)] - c(3/4, 3/4, 9/10)) < 1e-16))
L19 <- fl("tb19-law3", lapply(p2$tb19$states, o_vstate), p2$tb19$masses, c("A", "B", "C"), "score")
stopifnot(identical(L19$e, p2$tb19$e), L19$e[1, 2, 1] == 0.7)                    # ch. 19: last order-boundary slope 7/10
# G-05 drawErrors of the six sites' seeded draws (score A): seed 1 with 100 draws (the deck preset) and seed 424242
# with 5 draws (the read-out case). The draws are the 15-digit values the gaussianDraws rows of oracle-stream hold.
for (spec in list(list("S100-seed1", p2$six$draws1, p2$six$drawE1), list("S5-seed424242", p2$six$draws4, p2$six$drawE4))) {
  E_d <- de(paste0("six-scoreA-", spec[[1]]), lapply(spec[[2]], function(x) st(x, ids = six_ids, criteria = "score_A")), six_ids, "score_A")
  stopifnot(identical(E_d, spec[[3]]))
}

assert_no_postrank()
write_golden("oracle-pairwise", rows, generator = "r-export/02_pairwise.R", uses_postrank = FALSE)
cat("oracle-pairwise:", length(rows), "rows\n")

# ---- postrank 1.1.0 ---------------------------------------------------------------------------------------------
load_postrank()
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
law <- pr_tutorial$law
check_close(law$means, six_means, 0, "hardcoded six-site means equal pr_tutorial$law$means")
stopifnot(identical(dimnames(law$means)$entity, six_ids))
sd_of <- function(cov) t(vapply(seq_len(dim(cov)[3]), function(i) sqrt(diag(as.matrix(cov[, , i]))), numeric(dim(cov)[1])))

# errorArray on the law means and SDs against the package's Gaussian coefficients (closed-form pnorm).
pea <- function(id, means, sds, orient, ids, criteria, e_pkg) {
  padd(row(paste0("errorArray-", id), "errorArray",
           list(means = unname(means), sds = unname(sds), ids = vec(ids), criteria = vec(criteria), orient = vec(orient)),
           list(ids = vec(ids), criteria = vec(criteria), e = cube_json(unname(e_pkg)))))
  check_close(o_error_array(means, sds, orient), e_pkg, 1e-15, paste("base-R errorArray vs postrank", id))
}
sds_two <- matrix(sd_of(law$covariance), 6, 2)
check_close(sds_two, rep(0.2, 12), 1e-16, "tutorial SDs are .2")
pea("pr_tutorial-one", law$means[, "score_A", drop = FALSE], sds_two[, 1, drop = FALSE], 1, six_ids, "score_A",
    pr_tutorial$one$e)
pea("pr_tutorial-two", law$means, sds_two, c(1, 1), six_ids, c("score_A", "score_B"), pr_tutorial$two$e)
stopifnot(identical(pr_tutorial$one$e[, , "score_A"], pr_tutorial$two$e[, , "score_A"]))
# Orientation -1 on score_B equals the package law with score_B negated.
neg_means <- law$means; neg_means[, "score_B"] <- -neg_means[, "score_B"]
neg <- postrank_gaussian_coefficients(neg_means, law$covariance, "entities_given_shared_h", pr_tutorial$two$provenance)
pea("pr_tutorial-two-orient-plus-minus", law$means, sds_two, c(1, -1), six_ids, c("score_A", "score_B"), neg$e)
# 30 sites, 3 criteria, within-site correlated criteria (marginal SDs from the covariance diagonal).
g30 <- pr_example_gaussian
stopifnot(identical(g30$means, g30$source$means))
pea("pr_example_gaussian-30x3", g30$means, sd_of(g30$source$covariance), rep(1, 3), g30$entity_ids, g30$criterion_ids, g30$e)

# drawErrors on the bundled joint draws (32 draws, 3 entities, 2 criteria) against postrank_pairwise().
toy <- postrank_toy$joint_draws$tensor
vals <- toy$values                                   # [draw, entity, criterion]
draws_toy <- lapply(seq_len(dim(vals)[1]), function(s) matrix(vals[s, , ], dim(vals)[2], dim(vals)[3]))
pw_toy <- postrank_pairwise(postrank_toy)
# The golden file stores 15 significant digits; ties and orders must survive the round trip.
rt <- jsonlite::fromJSON(jsonlite::toJSON(states_json(draws_toy), digits = NA), simplifyVector = FALSE)
draws_rt <- lapply(rt, function(s) matrix(unlist(s), nrow = length(s), byrow = TRUE))
check_close(o_draw_errors(draws_rt), pw_toy$e, 0, "base-R drawErrors on round-tripped draws vs postrank_pairwise")
check_close(o_draw_errors(draws_toy), pw_toy$e, 0, "base-R drawErrors vs postrank_pairwise")
padd(row("drawErrors-postrank_toy", "drawErrors",
         list(draws = states_json(draws_toy), ids = vec(postrank_toy$entity_ids), criteria = vec(postrank_toy$criterion_ids)),
         list(ids = vec(postrank_toy$entity_ids), criteria = vec(postrank_toy$criterion_ids), e = cube_json(unname(pw_toy$e)))))

# Exact finite laws through the package (gmp rational coefficients, double projection).
decl <- function(ids, criteria, description) list(
  input_kind = "exact_finite_posterior", dependence_mode = "joint_model", requested_functional = "expected_rank_loss",
  entity_ids = ids, criterion_ids = criteria,
  targets = lapply(criteria, function(k) list(criterion_id = k, estimand = paste("Specified", k, "target"),
    entity_population = "Fictional units in the displayed law", time_reference = "No observation period; mathematical example",
    units = "Illustrative score units", source_transform = "Identity",
    identification_basis = "Defined by the complete listed states", orientation = "higher_priority")),
  context = list(cohort_id = "postrank-explorer-golden", data_version = "1",
    data_conditioning = "No observations; the listed law is stipulated", model_summary = description),
  identification = list(status = "identified_declared", note = "The mathematical targets are specified, not empirically identified"),
  provenance = list(producer = "postrank-explorer r-export/02_pairwise.R", artifact_id = "specified-law",
    artifact_hash = digest::digest(description, algo = "sha256"),
    construction_note = "Complete finite law; no sampling or rounding", created_at = "2026-10-31T00:00:00Z"))
fin_law <- function(states, masses, description) list(denominator = sum(masses), value_representation = "safe_integer",
  states = lapply(seq_along(states), function(s) list(state_id = paste0("state-", s), mass_numerator = masses[s], theta = states[[s]])),
  law_definition = description, not_empirical_posterior_relabeling = TRUE)
exact_input <- function(states, masses, description) {        # ordinary (tie-free) route
  ids <- rownames(states[[1]]); criteria <- colnames(states[[1]])
  as_postrank_draws(c(list(schema_version = "applied-0.1"), decl(ids, criteria, description),
    list(tie_policy = list(rule = "pairwise_tie_free", declared = TRUE,
      justification = "Every listed state is tie-free within each criterion", observed_tie_action = "reject_and_review"),
      finite_law = fin_law(states, masses, description))))
}
tie_input <- function(states, masses, description) {          # equality-neutral route (m4 vignette constructor)
  ids <- rownames(states[[1]]); criteria <- colnames(states[[1]])
  as_postrank_tie_draws(c(list(schema_version = "tie-aware-input-0.1"), decl(ids, criteria, description),
    list(tie_policy = list(rule = "equality_neutral", declared = TRUE,
      justification = "Equality in a listed state is genuine target equality", observed_tie_action = "accept_declared_exact_equality"),
      equality = list(basis = "exact_finite_law", justification = "Check equality over every positive-mass state", criterion_classes = NULL),
      finite_law = fin_law(states, masses, description))))
}
pfl <- function(id, states, masses, description) {
  pw <- postrank_pairwise(exact_input(states, masses, description))
  check_close(o_finite_law(states, masses)$e, pw$e, 2.3e-16, paste("base-R finite-law e vs postrank exact", id))
  padd(row(paste0("finiteLawPairwise-", id), "finiteLawPairwise",
           list(states = states_json(states), probs = vec(masses / sum(masses)),
                ids = vec(rownames(states[[1]])), criteria = vec(colnames(states[[1]]))),
           list(e = cube_json(unname(pw$e)))))
}
pfl("tb14-four-unit", tb14_states, c(3L, 1L), "Theory book ch. 14 two-state four-unit law")
pfl("tb09-Q1", q1, c(1L, 1L, 1L), "Theory book ch. 9 law Q1")
pfl("tb09-Q2", q2, c(1L, 1L, 1L), "Theory book ch. 9 law Q2")

ptl <- function(id, states, masses, description, input = tie_input(states, masses, description)) {
  pw <- postrank_tie_pairwise(input)
  L <- o_finite_law(states, masses)
  # gmp's bigq -> double projection truncates (mpq_get_d) while count/den rounds to nearest: at most 1 ulp apart.
  for (z in c("b", "t", "d")) check_close(L[[z]], pw[[z]], 2.3e-16, paste("base-R tie law", z, "vs postrank", id))
  padd(row(paste0("tieLawPairwise-", id), "tieLawPairwise",
           list(states = states_json(states), probs = vec(masses / sum(masses)),
                ids = vec(rownames(states[[1]])), criteria = vec(colnames(states[[1]]))),
           list(b = cube_json(unname(pw$b)), t = cube_json(unname(pw$t)), d = cube_json(unname(pw$d)))))
}
ptl("m4-law", m4_states, c(1L, 4L, 5L), "B is 1; A is 0, 1, or 2 with masses 1/10, 4/10, 5/10")
ptl("m4-guard-profile", guard_state, 1L, "One certain state with shared and individual attributes")
ptl("tb16-tie-law", tb16_states, c(3L, 2L), "Theory book ch. 16 equality-neutral frontier law")
# The package's bundled two-state teaching law (inst/examples/synthetic-tie-aware.json).
syn <- read_postrank_tie_draws(system.file("examples", "synthetic-tie-aware.json", package = "postrank"))
syn_states <- lapply(syn$finite_law$states, function(z) z$theta)
syn_masses <- vapply(syn$finite_law$states, function(z) as.integer(z$mass_numerator), 1L)
stopifnot(sum(syn_masses) == syn$finite_law$denominator)
ptl("synthetic-tie-aware-json", syn_states, syn_masses, "postrank synthetic-tie-aware.json", input = syn)

write_golden("postrank-pairwise", prow, generator = "r-export/02_pairwise.R", uses_postrank = TRUE)
cat("postrank-pairwise:", length(prow), "rows\n")
