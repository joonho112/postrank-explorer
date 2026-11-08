# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for the v3 helpers (engine/API.md "v3 helpers (Phase 2, Step 2.1)").
#   oracle-v3  base R only; postrank is not loaded. topKOvershoot, leagueOvershoot, expectedSquaredDistance,
#              finiteLawMargins, majorityWins, weightedRadius, regretBound, twoStateChain, chainMeanVariance,
#              wrongCountDistribution, disclosedErrorEstimands (case weights), leagueGradingReplays, largestStatedError,
#              leastCertainPairs, transformedMeans (+ throw rows), selectionOnDraws, pairCertainty.
# Written from that section of engine/API.md alone (with the conventions it restates: units 0-based in the rows,
# e[k][i][j] the weak error of stating i above j with a null diagonal, w summed in criterion order, sums in index
# order, null for undefined fractions), the SR-06 league specification and the stream reimplementation r-export/_rng.R.
# Units are 1-based here and 0-based in the golden rows. Every numeric input is a double that survives the
# 15-significant-digit JSON text (checked before writing), and every expected value is computed from those inputs.
# leagueGradingReplays: the fixed-order dynamic programme is replaced by enumeration of the contiguous cuts of the
# posterior-mean order with at most `cap` grades and the package's choice among equal risks (fewer grades, then the
# earlier cut; equal = within 1e-12 on the risk scale, i.e. savings within 1e-12 M). Every enumerated optimum is
# separated from the next report by more than 1e-10 in risk, so neither the tie rule nor summation order decides it.
# cap = 30 rows: at tau = 1/2 every pair along the order saves (e < 1/2), so the strict order is the unique optimum;
# at tau = .2 enumeration covers at most 7 grades and an exact per-grade-count bound shows no report with more grades
# comes within 1e-10 of the enumerated optimum.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R"); source("r-export/_rng.R")
assert_no_postrank()

# ---- JSON shaping and checks --------------------------------------------------------------------------------------
vec <- function(x) I(unname(x))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
check_close <- function(a, b, tol, label) {
  a <- as.numeric(unlist(a)); b <- as.numeric(unlist(b))
  if (length(a) != length(b) || any(is.na(a) != is.na(b))) stop("check failed (shape/NA): ", label, call. = FALSE)
  d <- max(c(0, abs(a - b)), na.rm = TRUE)
  if (d > tol) stop(sprintf("check failed: %s (max diff %.3g > %.3g)", label, d, tol), call. = FALSE)
  invisible(d)
}
r15 <- function(x) { y <- x; ok <- is.finite(x); y[ok] <- as.numeric(sprintf("%.15g", x[ok])); y }
gap_ok <- function(x, tol = 1e-9) { s <- sort(x); stopifnot(length(s) < 2 || min(diff(s)) > tol); invisible(TRUE) }
lsum <- function(x) { s <- 0; for (v in x) s <- s + v; s }                       # left to right, as the spec orders it
ksum <- function(x) {                                                            # compensated (Neumaier) reference
  s <- 0; c <- 0
  for (v in x) { t <- s + v; c <- c + (if (abs(s) >= abs(v)) (s - t) + v else (v - t) + s); s <- t }
  s + c
}
inf_arg <- function(x) if (is.infinite(x)) list(`$num` = if (x > 0) "Infinity" else "-Infinity") else x   # JSON token
inf_echo <- function(x) if (is.infinite(x)) (if (x > 0) "Infinity" else "-Infinity") else x                # adapter: String()
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(a[, , k]))
earr <- function(e, ids, criteria) list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))
states_json <- function(states) lapply(states, unname)                          # states[s][i][k] (n x K matrices)
wsum <- function(e, w = NULL) {                                                  # ebar = sum_k w_k e_k, criterion order
  K <- dim(e)[3]; if (is.null(w)) { stopifnot(K == 1); w <- 1 }
  out <- e[, , 1] * w[1]; if (K > 1) for (k in 2:K) out <- out + w[k] * e[, , k]; out
}
M_of <- function(n) n * (n - 1) / 2
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# ---- shared inputs --------------------------------------------------------------------------------------------------
source("r-export/15_part2.R")   # p2: six sites (released score-A array, seeded draws), theory-book laws, KRW race array
num <- function(x) vapply(x, function(v) if (is.null(v)) NA_real_ else as.numeric(v), 0)
mat <- function(rows) r15(t(vapply(rows, num, numeric(length(rows)))))
six <- p2$six; e6a <- six$e                                                       # 6 x 6 x 1, score A (released)
six_rel <- jsonlite::fromJSON(file.path(released_dir, "six-sites.json"), simplifyVector = FALSE)
two <- six_rel$arrays$two
stopifnot(identical(unlist(two$criteria), c("score_A", "score_B")), identical(unlist(two$ids), six$ids))
e6ab <- array(c(mat(two$e[[1]]), mat(two$e[[2]])), c(6, 6, 2))
stopifnot(identical(e6ab[, , 1], e6a[, , 1]))
mB <- num(six_rel$tables$units$mean_B); stopifnot(all(num(six_rel$tables$units$sd_B) == 0.2))
eB <- outer(mB, mB, function(a, b) pnorm((b - a) / sqrt(0.2^2 + 0.2^2))); diag(eB) <- NA
check_close(e6ab[, , 2], eB, 1e-15, "released six-site score-B array = base-R pnorm")
ck <- jsonlite::fromJSON(file.path(released_dir, "case-krw.json"), simplifyVector = FALSE)
krw_ids <- unlist(ck$arrays$error$ids)
stopifnot(identical(unlist(ck$arrays$error$criteria), c("race_signed", "gender_signed")), identical(krw_ids, p2$krw$ids),
          identical(unlist(ck$tables$reports$id), krw_ids))
e_race <- array(mat(ck$arrays$error$e[[1]]), c(97, 97, 1)); stopifnot(identical(e_race, p2$krw$e))
e_gender <- array(mat(ck$arrays$error$e[[2]]), c(97, 97, 1))
e_krw2 <- array(c(e_race, e_gender), c(97, 97, 2))
race_card <- p2$krw$card; gender_card <- num(ck$tables$reports$gender_card)
stopifnot(length(gender_card) == 97, identical(tabulate(race_card), c(2L, 81L, 14L)))

# The SR-06 league (engine/API.md "Simulated league specification"); replay r of seed s is drawLeague(s + r).
lg <- list(ids = sprintf("U%02d", 1:30), size = rep(c(16, 64, 256), 10), group = rep(c("small", "medium", "large"), 10))
lg$se <- 0.8 / sqrt(lg$size); lg$rank <- (19 * (1:30)) %% 31; lg$theta <- 0.15 * qnorm((lg$rank - 0.5) / 30)
stopifnot(identical(sort(lg$rank), as.numeric(1:30)), identical(unique(lg$se), c(0.2, 0.1, 0.05)))
seed0 <- 20261030
draw <- function(seed) lg$theta + lg$se * prx_normals(seed, 30)
shrink <- function(sigma) if (is.infinite(sigma)) rep(1, 30) else sigma^2 / (sigma^2 + lg$se^2)   # flat prior: B = 1
post <- function(est, sigma) { B <- shrink(sigma); list(mean = B * est, sd = sqrt(B) * lg$se) }  # prior mean 0
err_normal <- function(m, s) {                     # errorArray of independent normals, one criterion, larger = higher
  n <- length(m); e <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) e[i, j] <- pnorm((m[j] - m[i]) / sqrt(s[i]^2 + s[j]^2))
  e
}
est0 <- r15(draw(seed0)); th15 <- r15(lg$theta); gap_ok(est0)                    # drawLeague(20261030).estimate
p15 <- post(est0, 0.15); pm15 <- r15(p15$mean); pm05 <- r15(post(est0, 0.05)$mean)
e_lg15 <- array(r15(err_normal(p15$mean, p15$sd)), c(30, 30, 1))                 # the frozen draw's posterior E

# ---- topKOvershoot(estimate, truth, { k, side, posterior }) ---------------------------------------------------------
# Order by estimate, largest first, equal estimates in index order; top = the first k, bottom = the last k in that
# order; overshoot = (1/k) sum over the listed units (in listed order) of estimate - truth, posteriorOvershoot the same
# with the posterior, null without one.
o_topk_ov <- function(estimate, truth, k, side = "top", posterior = NULL) {
  n <- length(estimate); stopifnot(k >= 1, k <= n, side %in% c("top", "bottom"))
  ord <- order(-estimate, seq_len(n))
  units <- if (side == "top") ord[seq_len(k)] else ord[(n - k + 1):n]
  ov <- function(v) lsum(v[units] - truth[units]) / k
  list(k = k, side = side, units = vec(units - 1L), overshoot = ov(estimate),
       posteriorOvershoot = if (is.null(posterior)) NA_real_ else ov(posterior))
}
tko <- function(id, estimate, truth, k, side = NULL, posterior = NULL) {
  r <- o_topk_ov(estimate, truth, k, if (is.null(side)) "top" else side, posterior)
  a <- list(estimate = vec(estimate), truth = vec(truth), k = k)
  if (!is.null(side)) a$side <- side
  if (!is.null(posterior)) a$posterior <- vec(posterior)
  add(row(paste0("topKOvershoot-", id), "topKOvershoot", a, r)); invisible(r)
}
x_est <- c(3, 1, 2, 2); x_tru <- c(1, 1, 1, 1); x_post <- c(2, 1, 1.5, 1.5)
s1 <- tko("spec-top-k2", x_est, x_tru, 2, "top")
s2 <- tko("spec-bottom-k2", x_est, x_tru, 2, "bottom")
s3 <- tko("spec-top-k2-posterior", x_est, x_tru, 2, "top", x_post)
s4 <- tko("spec-bottom-k2-posterior", x_est, x_tru, 2, "bottom", x_post)
stopifnot(identical(unclass(s1$units), c(0L, 2L)), s1$overshoot == 1.5, is.na(s1$posteriorOvershoot),
          identical(unclass(s2$units), c(3L, 1L)), s2$overshoot == 0.5, s3$posteriorOvershoot == 0.75,
          identical(unclass(s4$units), c(3L, 1L)), s4$posteriorOvershoot == 0.25)
tko("spec-side-default-k2", x_est, x_tru, 2, posterior = x_post)                 # side omitted: "top"
for (sd in c("top", "bottom")) {
  tko(sprintf("spec-%s-k1", sd), x_est, x_tru, 1, sd, x_post)
  r <- tko(sprintf("spec-%s-k4-all-units", sd), x_est, x_tru, 4, sd, x_post)       # k = n: the whole order
  stopifnot(identical(unclass(r$units), c(0L, 2L, 3L, 1L)), r$overshoot == 1)
}
tko("one-unit-bottom-k1", 0.3, 0.1, 1, "bottom", 0.2)
r <- tko("all-estimates-equal-top-k2", rep(0.5, 5), c(0.1, 0.2, 0.3, 0.4, 0.5), 2, "top")
stopifnot(identical(unclass(r$units), c(0L, 1L)))
r <- tko("all-estimates-equal-bottom-k2", rep(0.5, 5), c(0.1, 0.2, 0.3, 0.4, 0.5), 2, "bottom")
stopifnot(identical(unclass(r$units), c(3L, 4L)))
tie_est <- c(1, 2, 2, 2, 0); tie_tru <- c(0, 0.5, 1, 1.5, -1); tie_post <- c(0.8, 1.5, 1.6, 1.4, 0.1)
r <- tko("tied-run-top-k2", tie_est, tie_tru, 2, "top", tie_post); stopifnot(identical(unclass(r$units), c(1L, 2L)))
r <- tko("tied-run-bottom-k3", tie_est, tie_tru, 3, "bottom", tie_post); stopifnot(identical(unclass(r$units), c(3L, 0L, 4L)))
tko("league-seed20261030-top-k3-prior.15", est0, th15, 3, "top", pm15)
tko("league-seed20261030-bottom-k3-prior.15", est0, th15, 3, "bottom", pm15)
tko("league-seed20261030-top-k10-prior.05", est0, th15, 10, "top", pm05)
tko("league-seed20261030-bottom-k30-prior.15", est0, th15, 30, "bottom", pm15)
tko("league-seed20261030-top-k1-no-posterior", est0, th15, 1, "top")

# ---- leagueOvershoot(seed, { replays, k, side, priorSd }) ------------------------------------------------------------
# Replay r = 1..R: estimate = drawLeague(seed + r), posterior mean B_i * estimate (prior mean 0; B = 1 for the flat
# prior), truth = league30().theta (full precision here, as the engine computes it); mean = arithmetic mean over
# replays in replay order (compensated reference sum).
o_league_ov <- function(seed, R, k, side, sigma) {
  d <- lapply(seq_len(R), function(r) {
    s <- seed + r; est <- draw(s); gap_ok(est)                                  # no near-tie can move a unit in or out
    o <- o_topk_ov(est, lg$theta, k, side, post(est, sigma)$mean)
    list(r = r, seed = s, units = o$units, overshoot = o$overshoot, posteriorOvershoot = o$posteriorOvershoot)
  })
  ov <- vapply(d, `[[`, 0, "overshoot"); pv <- vapply(d, `[[`, 0, "posteriorOvershoot")
  list(seed = seed, replays = R, k = k, side = side, priorSd = inf_echo(sigma),
       r = vec(seq_len(R)), seeds = vec(seed + seq_len(R)), units = lapply(d, `[[`, "units"),
       overshoot = vec(ov), posteriorOvershoot = vec(pv),
       mean = list(overshoot = ksum(ov) / R, posteriorOvershoot = ksum(pv) / R))
}
lo <- function(id, seed = NULL, R = NULL, k = NULL, side = NULL, sigma = NULL, fields = NULL) {
  r <- o_league_ov(if (is.null(seed)) seed0 else seed, if (is.null(R)) 20 else R, if (is.null(k)) 3 else k,
                   if (is.null(side)) "top" else side, if (is.null(sigma)) 0.15 else sigma)
  a <- list()
  if (!is.null(seed)) a$seed <- seed
  if (!is.null(R)) a$replays <- R
  if (!is.null(k)) a$k <- k
  if (!is.null(side)) a$side <- side
  if (!is.null(sigma)) a$priorSd <- inf_arg(sigma)
  add(row(paste0("leagueOvershoot-", id), "leagueOvershoot", a, if (is.null(fields)) r else r[fields])); invisible(r)
}
L0 <- lo("defaults")                                                               # seed 20261030, 20 replays, k 3, top, .15
L1 <- lo("seed20261030-R20-k3-top-prior.15-explicit", seed0, 20, 3, "top", 0.15)
stopifnot(identical(L0, L1))
lo("seed20261030-R10-k5-bottom-prior.15", seed0, 10, 5, "bottom", 0.15)
lo("seed20261030-R20-k1-top-prior.05", seed0, 20, 1, "top", 0.05)
Lf <- lo("seed20261030-R5-k3-top-flat-prior", seed0, 5, 3, "top", Inf)
stopifnot(identical(unclass(Lf$overshoot), unclass(Lf$posteriorOvershoot)))      # flat prior: posterior mean = estimate
lo("seed7-R3-k30-top-prior.2", 7, 3, 30, "top", 0.2)
lo("seed7-R3-k30-bottom-prior.2", 7, 3, 30, "bottom", 0.2)                        # k = n: the same units, same order
lo("seed20261030-R1-k3-bottom-prior.1", seed0, 1, 3, "bottom", 0.1)
# The API example: 2,000 draws with seeds 20261030 + 0 ... 1999 are the replays of seed 20261029 (only the means).
LL <- lo("spec-2000-draws-seeds20261030-to-20263029", 20261029, 2000, 3, "top", 0.15,
         fields = c("seed", "replays", "k", "side", "priorSd", "mean"))
check_close(c(LL$mean$overshoot, LL$mean$posteriorOvershoot), c(0.160, -0.007), 5e-4, "API.md: about .160 and -.007 over 2,000 draws")

# ---- expectedSquaredDistance(theta, se, { priorSd, priorMean }) ------------------------------------------------------
o_esd <- function(theta, se, sigma = 0.15, mu = 0) {
  n <- length(theta); B <- if (is.infinite(sigma)) rep(1, n) else sigma^2 / (sigma^2 + se^2)
  per <- ((1 - B) * (mu - theta))^2 + B^2 * se^2
  list(perUnit = vec(per), mean = ksum(per) / n, rawMean = ksum(se^2) / n)
}
esd <- function(id, theta, se, sigma = NULL, mu = NULL) {
  r <- o_esd(theta, se, if (is.null(sigma)) 0.15 else sigma, if (is.null(mu)) 0 else mu)
  a <- list(theta = vec(theta), se = vec(se))
  if (!is.null(sigma)) a$priorSd <- inf_arg(sigma)
  if (!is.null(mu)) a$priorMean <- mu
  add(row(paste0("expectedSquaredDistance-", id), "expectedSquaredDistance", a, r)); invisible(r)
}
esd_lg <- vapply(c(0.02, 0.10, 0.15, 0.20), function(s) esd(sprintf("league-prior%s", sub("^0", "", sprintf("%.2f", s))), th15, lg$se, s)$mean, 0)
check_close(esd_lg, c(.019149, .008460, .007536, .008193), 5e-7, "API.md: league .019149 / .008460 / .007536 / .008193")
ef <- esd("league-flat-prior", th15, lg$se, Inf)
stopifnot(ef$mean == ef$rawMean); check_close(ef$rawMean, 0.0175, 1e-16, "API.md: rawMean .0175")
d0 <- esd("league-defaults", th15, lg$se); stopifnot(identical(d0$mean, esd_lg[3]))
esd("league-prior.10-mean.05", th15, lg$se, 0.1, 0.05)
h <- esd("hand-dyadic", c(0.5, -0.25), c(0.5, 0), 0.5, 0)
stopifnot(identical(unclass(h$perUnit), c(0.125, 0)), h$mean == 0.0625, h$rawMean == 0.125)
esd("one-unit", 0.3, 0.1, 0.2, -0.1)
z <- esd("zero-se", c(0.2, -0.1, 0.4), c(0, 0, 0), 0.15, 0); stopifnot(all(unclass(z$perUnit) == 0), z$mean == 0)

# ---- finiteLawMargins(states, probs) ---------------------------------------------------------------------------------
# margins[i][k] = { values (distinct, ascending, exact equality), probs (state probabilities summed in state order) };
# compared as values[i][k] and probs[i][k].
o_margins <- function(states, probs) {
  n <- nrow(states[[1]]); K <- ncol(states[[1]])
  cell <- function(i, k) {
    v <- vapply(states, function(m) m[i, k], 0); u <- sort(unique(v))
    list(values = vec(u), probs = vec(vapply(u, function(x) lsum(probs[v == x]), 0)))
  }
  cells <- lapply(seq_len(n), function(i) lapply(seq_len(K), function(k) cell(i, k)))
  list(values = lapply(cells, function(ci) lapply(ci, `[[`, "values")), probs = lapply(cells, function(ci) lapply(ci, `[[`, "probs")))
}
flm <- function(id, states, probs, states_arg = NULL) {
  r <- o_margins(states, probs)
  add(row(paste0("finiteLawMargins-", id), "finiteLawMargins",
          list(states = if (is.null(states_arg)) states_json(states) else states_arg, probs = vec(probs)), r)); invisible(r)
}
st1 <- function(...) lapply(list(...), function(v) cbind(v))                   # one-criterion states from unit vectors
third <- rep(r15(1/3), 3)
m1 <- flm("tb09-Q1", st1(c(0, 1), c(1, 2), c(2, 0)), third)
m2 <- flm("tb09-Q2", st1(c(0, 2), c(1, 0), c(2, 1)), third)
for (m in list(m1, m2)) for (i in 1:2)
  stopifnot(identical(unclass(m$values[[i]][[1]]), c(0, 1, 2)), all(unclass(m$probs[[i]][[1]]) == r15(1/3)))
flm("tb09-independent-nine-cells", do.call(st1, lapply(0:8, function(t) c(t %/% 3, t %% 3))), rep(r15(1/9), 9))
m19 <- flm("tb19-law3", lapply(p2$tb19$states, cbind), c(0.3, 0.7))
stopifnot(identical(unclass(m19$values[[1]][[1]]), c(0, 20)), identical(unclass(m19$probs[[1]][[1]]), c(0.7, 0.3)),
          identical(unclass(m19$probs[[2]][[1]]), 1))
m10 <- flm("tb10-law3-orders", unname(lapply(p2$tb10$states, cbind)), p2$tb10$masses / 20)   # unnamed: states are an array
check_close(m10$probs[[1]][[1]], c(0.1, 0.15, 0.75), 1e-15, "ch. 10 law: A is 1, 2, 3 with .1, .15, .75")
tb14 <- list(rbind(c(4, 4), c(3, 2), c(2, 3), c(1, 1)), rbind(c(3, 1), c(4, 2), c(2, 3), c(1, 4)))
flm("tb14-four-unit-two-criteria", tb14, c(0.75, 0.25))
ties3 <- list(rbind(c(1, 0), c(2, 0), c(3, 1)), rbind(c(3, 1), c(2, 0), c(1, 1)), rbind(c(2, 2), c(2, 2), c(0, 2)))
flm("three-unit-ties-two-criteria", ties3, c(0.2, 0.3, 0.5))
flm("one-state", list(rbind(c(1.5, -2), c(0, 0))), 1)
flm("decimals-repeats-in-nonadjacent-states", st1(c(-0.5, 0.1), c(1.25, 0.1), c(-0.5, 0.1), c(2, 0.1), c(1.25, 0.1)),
    c(0.1, 0.2, 0.3, 0.15, 0.25))
# Equality is exact: 0.1 + 0.2 (the token {"$sum": [0.1, 0.2]}, 0.30000000000000004) is a value distinct from 0.3.
sum_states <- list(cbind(c(0.3, 1)), cbind(c(0.1 + 0.2, 1)), cbind(c(0.3, 2)))
sum_arg <- list(list(list(0.3), list(1)), list(list(list(`$sum` = vec(c(0.1, 0.2)))), list(1)), list(list(0.3), list(2)))
ms <- flm("exact-equality-0.1+0.2-is-not-0.3", sum_states, c(0.25, 0.5, 0.25), sum_arg)
stopifnot(length(ms$values[[1]][[1]]) == 2, identical(unclass(ms$probs[[1]][[1]]), c(0.5, 0.5)))

# ---- majorityWins(E, { w, tieTol }) ----------------------------------------------------------------------------------
# i beats j when ebar_ij < ebar_ji - tieTol; a majority tie when |ebar_ij - ebar_ji| <= tieTol (evaluated literally).
# Guard for every row: each pair falls in exactly one class, and no |ebar_ij - ebar_ji| lies within 1e-14 of tieTol
# unless it is exactly 0 (designed ties), so no last-bit difference can move a pair between classes.
o_majority <- function(e, w = NULL, tieTol = 1e-12) {
  eb <- wsum(e, w); n <- nrow(eb)
  beats <- matrix(FALSE, n, n); tie <- matrix(FALSE, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) {
    beats[i, j] <- eb[i, j] < eb[j, i] - tieTol
    tie[i, j] <- abs(eb[i, j] - eb[j, i]) <= tieTol
  }
  off <- base::row(beats) != base::col(beats)
  stopifnot(all((beats + t(beats) + tie)[off] == 1))
  d <- abs(eb - t(eb))[off]; stopifnot(all(d == 0 | abs(d - tieTol) > 1e-14))
  wins <- rowSums(beats); ties <- rowSums(tie); cycles <- 0L
  if (n >= 3) {
    cm <- combn(n, 3); a <- cm[1, ]; b <- cm[2, ]; c <- cm[3, ]; B <- function(x, y) beats[cbind(x, y)]
    cycles <- sum((B(a, b) & B(b, c) & B(c, a)) | (B(b, a) & B(c, b) & B(a, c)))
  }
  strict <- !any(tie[off]) && cycles == 0
  if (strict) stopifnot(identical(sort(as.numeric(wins), decreasing = TRUE), as.numeric((n - 1):0)))
  list(wins = vec(as.integer(wins)), ties = vec(as.integer(ties)), order = vec(order(-wins, seq_len(n)) - 1L),
       cycles = as.integer(cycles), strictOrder = strict)
}
mw <- function(id, e, ids, criteria, w = NULL, tieTol = NULL) {
  r <- o_majority(e, w, if (is.null(tieTol)) 1e-12 else tieTol)
  a <- list(E = earr(e, ids, criteria))
  if (!is.null(w)) a$w <- vec(w)
  if (!is.null(tieTol)) a$tieTol <- tieTol
  add(row(paste0("majorityWins-", id), "majorityWins", a, r)); invisible(r)
}
w6 <- mw("six-scoreA", e6a, six$ids, "score_A")
stopifnot(identical(unclass(w6$wins), 5:0), all(unclass(w6$ties) == 0), w6$cycles == 0, w6$strictOrder)
mw("six-scoreA-tieTol0", e6a, six$ids, "score_A", tieTol = 0)
w6t <- mw("six-scoreA-tieTol.3", e6a, six$ids, "score_A", tieTol = 0.3)           # C and D tie: |e_CD - e_DC| = .276
stopifnot(identical(unclass(w6t$ties), c(0L, 0L, 1L, 1L, 0L, 0L)), !w6t$strictOrder, identical(unclass(w6t$order), 0:5))
fw <- function(x) if (x %in% c(0, 1)) format(x) else sub("^0", "", format(x))      # weight label in row ids
for (w in list(c(0.5, 0.5), c(0.2, 0.8), c(1, 0), c(0, 1)))
  mw(sprintf("six-AB-w%s-%s", fw(w[1]), fw(w[2])), e6ab, six$ids, c("score_A", "score_B"), w)
wr <- mw("krw-race", e_race, krw_ids, "race_signed"); stopifnot(wr$strictOrder, wr$cycles == 0)
wg <- mw("krw-gender", e_gender, krw_ids, "gender_signed"); stopifnot(wg$cycles == 1, !wg$strictOrder, all(unclass(wg$ties) == 0))
wb <- mw("krw-race-gender-w.5-.5", e_krw2, krw_ids, c("race_signed", "gender_signed"), c(0.5, 0.5))
law_e <- function(states, masses) array(r15(p2$law_counts(states, masses, `<=`) / sum(masses)), c(length(states[[1]]), length(states[[1]]), 1))
condorcet <- law_e(list(c(3, 2, 1), c(1, 3, 2), c(2, 1, 3)), c(1, 1, 1))         # orders ABC, BCA, CAB, each 1/3
wc <- mw("condorcet-3-cycle", condorcet, c("A", "B", "C"), "score")
stopifnot(identical(unclass(wc$wins), c(1L, 1L, 1L)), wc$cycles == 1, !wc$strictOrder)
hand2 <- function(eAB, eBA) array(c(NA, eBA, eAB, NA), c(2, 2, 1))
wt <- mw("two-units-exact-tie", hand2(0.5, 0.5), c("A", "B"), "score")
stopifnot(identical(unclass(wt$ties), c(1L, 1L)), identical(unclass(wt$order), 0:1), !wt$strictOrder)
wn <- mw("two-units-within-tolerance", hand2(0.5, 0.5000000000004), c("A", "B"), "score")       # |difference| 4e-13
stopifnot(identical(unclass(wn$ties), c(1L, 1L)))
wn0 <- mw("two-units-within-tolerance-tieTol0", hand2(0.5, 0.5000000000004), c("A", "B"), "score", tieTol = 0)
stopifnot(identical(unclass(wn0$wins), c(1L, 0L)), wn0$strictOrder)
mw("two-units-within-tolerance-tieTol1e-13", hand2(0.5, 0.5000000000004), c("A", "B"), "score", tieTol = 1e-13)
hand_e <- function(n, pairs) {                                                    # pairs: list(c(i, j, e_ij, e_ji))
  e <- matrix(NA_real_, n, n); for (p in pairs) { e[p[1], p[2]] <- p[3]; e[p[2], p[1]] <- p[4] }
  stopifnot(sum(is.na(e)) == n); array(e, c(n, n, 1))
}
# A 3-cycle among A, B, C, D below all, E above all: wins tie among A, B, C (index order in `order`).
e5 <- hand_e(5, list(c(1, 2, 0.3, 0.7), c(2, 3, 0.3, 0.7), c(3, 1, 0.3, 0.7), c(1, 4, 0.2, 0.8), c(2, 4, 0.2, 0.8),
                     c(3, 4, 0.2, 0.8), c(5, 1, 0.1, 0.9), c(5, 2, 0.1, 0.9), c(5, 3, 0.1, 0.9), c(5, 4, 0.1, 0.9)))
w5 <- mw("cycle-plus-top-and-bottom", e5, LETTERS[1:5], "score")
stopifnot(identical(unclass(w5$wins), c(2L, 2L, 2L, 0L, 4L)), identical(unclass(w5$order), c(4L, 0L, 1L, 2L, 3L)), w5$cycles == 1)
# A beats B, B beats C, and C-A is within the tolerance: not a cycle (a cycle needs three strict pairs) ...
e3t <- hand_e(3, list(c(1, 2, 0.3, 0.7), c(2, 3, 0.3, 0.7), c(3, 1, 0.5, 0.5000000000005)))
w3t <- mw("tie-breaks-cycle", e3t, c("A", "B", "C"), "score")
stopifnot(w3t$cycles == 0, identical(unclass(w3t$ties), c(1L, 0L, 1L)), !w3t$strictOrder)
# ... and with tieTol 0 the same pair is strict (C beats A) and closes the cycle.
w3s <- mw("tie-breaks-cycle-tieTol0", e3t, c("A", "B", "C"), "score", tieTol = 0); stopifnot(w3s$cycles == 1)

# ---- weightedRadius(eps, w) and regretBound({ N, Nstar, M, deltaW, eta }) --------------------------------------------
wrad <- function(id, eps, w = NULL) {
  v <- if (is.null(w)) eps[1] * 1 else lsum(w * eps)                              # criterion order; K = 1 may omit w
  a <- list(eps = vec(eps)); if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("weightedRadius-", id), "weightedRadius", a, list(value = v))); invisible(v)
}
wrad("K1-no-w", 0.05)
wrad("K1-w1", 0.05, 1)
check_close(wrad("K2", c(0.03, 0.07), c(0.25, 0.75)), 0.06, 1e-16, "weightedRadius .25 * .03 + .75 * .07")
wrad("K3-zero-weight", c(0.1, 0.2, 0.3), c(0.5, 0, 0.5))
wrad("K2-zero-eps", c(0, 0), c(0.4, 0.6))
wrad("K3-thirds", c(0.03, 0.06, 0.09), rep(r15(1/3), 3))                           # weights sum to 1 within 1e-12
o_regret <- function(N, Nstar, M, deltaW, eta = 0)
  list(evaluation = N * deltaW / M, regret = (N + Nstar) * deltaW / M + eta, uniform = 2 * deltaW + eta)
rb <- function(id, N, Nstar, M, deltaW, eta = NULL) {
  r <- o_regret(N, Nstar, M, deltaW, if (is.null(eta)) 0 else eta)
  a <- list(N = N, Nstar = Nstar, M = M, deltaW = deltaW); if (!is.null(eta)) a$eta <- eta
  add(row(paste0("regretBound-", id), "regretBound", a, r)); invisible(r)
}
rs <- rb("spec-N12-Nstar9-M15", 12, 9, 15, 0.05)
check_close(unlist(rs), c(0.04, 0.07, 0.1), 1e-16, "API.md: evaluation .04, regret .07, uniform .1")
rb("spec-eta0-explicit", 12, 9, 15, 0.05, 0)
rb("eta.01", 12, 9, 15, 0.05, 0.01)
rb("N0-Nstar0", 0, 0, 15, 0.05, 0.02)
rb("N-equals-M", 15, 15, 15, 0.05, 0.01)
rb("deltaW0", 7, 3, 15, 0, 0.003)
rb("two-units", 1, 0, 1, 0.15)
rb("league-M435", 120, 150, 435, 0.0123, 0.004)

# ---- twoStateChain({ p01, p10, S, chains, seed }) --------------------------------------------------------------------
# u = uniforms(seed, chains * S); chain c uses u[c S + 1 .. c S + S] (1-based here): X_1 = 1 when u < pi1, then from
# 0 to 1 when u < p01 and from 1 to 0 when u < p10 (strict). Uniforms match the engine bit for bit, so states are exact.
o_chain <- function(p01, p10, S, chains, seed) {
  pi1 <- p01 / (p01 + p10); u <- prx_uniforms(seed, chains * S)
  out <- lapply(seq_len(chains) - 1L, function(c) {
    uu <- u[c * S + seq_len(S)]; x <- integer(S); x[1] <- as.integer(uu[1] < pi1)
    if (S >= 2) for (b in 2:S) x[b] <- if (x[b - 1] == 0L) as.integer(uu[b] < p01) else as.integer(!(uu[b] < p10))
    vec(x)
  })
  list(p01 = p01, p10 = p10, S = S, seed = seed, pi1 = pi1, chains = out)
}
tsc <- function(id, p01, p10, S, chains, seed) {
  r <- o_chain(p01, p10, S, if (is.null(chains)) 1 else chains, seed)
  a <- list(p01 = p01, p10 = p10, S = S, seed = seed); if (!is.null(chains)) a$chains <- chains
  add(row(paste0("twoStateChain-", id), "twoStateChain", a, r)); invisible(r)
}
c1 <- tsc("book-p01.01-p10.01-S100-seed1", 0.01, 0.01, 100, NULL, 1)               # chains omitted: one chain
stopifnot(length(c1$chains) == 1, length(c1$chains[[1]]) == 100)
tsc("p01.01-p10.01-S100-chains3-seed20261030", 0.01, 0.01, 100, 3, 20261030)
tsc("p01.3-p10.05-S40-chains4-seed7", 0.3, 0.05, 40, 4, 7)
ca <- tsc("alternating-p01-1-p10-1-S10-chains2-seed3", 1, 1, 10, 2, 3)
for (x in ca$chains) stopifnot(all(diff(unclass(x)) != 0))                         # u < 1 always: the chain alternates
tsc("S1-chains5-seed11", 0.2, 0.6, 1, 5, 11)
tsc("long-p01.02-p10.08-S1000-chains2-seed42", 0.02, 0.08, 1000, 2, 42)
sh <- vapply(1:50, function(s) mean(unclass(o_chain(0.02, 0.08, 1000, 1, s)$chains[[1]])), 0)
stopifnot(abs(mean(sh) - 0.2) < 0.03)               # sanity of the transition rule: the share of 1s averages pi1 = .2

# ---- chainMeanVariance({ p01, p10, S }) ------------------------------------------------------------------------------
# variance = pi1 (1 - pi1) / S^2 * (S + 2 sum_{h=1}^{S-1} (S - h) rho^h), summed for h = 1, 2, ... (compensated
# reference sum, rho^h by pow); checked against the closed form of the sum and against powers by repeated
# multiplication with a plain sum (the spread of methods must stay below 1e-14 relative: the adapter allows 1e-13).
o_cmv <- function(p01, p10, S) {
  pi1 <- p01 / (p01 + p10); rho <- 1 - p01 - p10; q <- pi1 * (1 - pi1)
  h <- seq_len(S - 1); terms <- (S - h) * rho^as.numeric(h)
  sm <- ksum(terms)
  pw <- 1; s2 <- 0; for (hh in h) { pw <- pw * rho; s2 <- s2 + (S - hh) * pw }   # iterative powers, plain sum
  closed <- if (S >= 2) rho * (S * (1 - rho) - (1 - rho^S)) / (1 - rho)^2 else 0
  br <- S + 2 * sm
  stopifnot(abs((S + 2 * s2) - br) <= 1e-14 * br, abs((S + 2 * closed) - br) <= 1e-12 * br)
  variance <- q / S^2 * br
  list(pi1 = pi1, rho = rho, variance = variance, iidVariance = q / S, equivalentDraws = q / variance,
       asymptoticEquivalent = if (rho == -1) NA_real_ else S * (1 - rho) / (1 + rho),
       noSwitch = (1 - pi1) * (1 - p01)^(S - 1) + pi1 * (1 - p10)^(S - 1))
}
chain_brute <- function(p01, p10, S) {               # exact law of the S states: every path of the stationary chain
  pi1 <- p01 / (p01 + p10); P <- rbind(c(1 - p01, p01), c(p10, 1 - p10))
  paths <- as.matrix(expand.grid(rep(list(0:1), S))); pr <- ifelse(paths[, 1] == 1, pi1, 1 - pi1)
  if (S >= 2) for (b in 2:S) pr <- pr * P[cbind(paths[, b - 1] + 1, paths[, b] + 1)]
  m <- rowMeans(paths); mu <- sum(pr * m)
  list(variance = sum(pr * (m - mu)^2), noSwitch = sum(pr[rowSums(paths) %in% c(0, S)]))
}
cmv <- function(id, p01, p10, S) {
  r <- o_cmv(p01, p10, S)
  if (S <= 12) { b <- chain_brute(p01, p10, S)                                    # the formula against all 2^S paths
    check_close(c(r$variance, r$noSwitch), c(b$variance, b$noSwitch), 1e-14, paste("chain: all paths,", id)) }
  add(row(paste0("chainMeanVariance-", id), "chainMeanVariance", list(p01 = p01, p10 = p10, S = S), r)); invisible(r)
}
cb <- cmv("book-p01.01-p10.01-S100", 0.01, 0.01, 100)
book <- list(variance = c(.1412459, 5e-8), iidVariance = c(.0025, 1e-18), equivalentDraws = c(1.76996, 5e-6),
             asymptoticEquivalent = c(1.010101, 5e-7), noSwitch = c(.3697296, 5e-8))        # half a unit of the printed digit
for (f in names(book)) check_close(cb[[f]], book[[f]][1], book[[f]][2], paste("API.md book example (chain):", f))
cmv("p01.3-p10.05-S40", 0.3, 0.05, 40)
c0 <- cmv("rho0-p01.25-p10.75-S50", 0.25, 0.75, 50); stopifnot(c0$rho == 0); check_close(c0$equivalentDraws, 50, 1e-12, "rho 0: iid")
c1s <- cmv("S1", 0.2, 0.4, 1); stopifnot(c1s$variance == c1s$iidVariance); check_close(c1s$noSwitch, 1, 2e-16, "S = 1: one state")
cmv("S2", 0.1, 0.3, 2)
cm1 <- cmv("rho-minus1-p01-1-p10-1-S7", 1, 1, 7)
stopifnot(cm1$rho == -1, is.na(cm1$asymptoticEquivalent), cm1$noSwitch == 0); check_close(cm1$equivalentDraws, 49, 1e-12, "rho -1, S 7")
cmv("rho-negative-p01.6-p10.5-S30", 0.6, 0.5, 30)
cmv("slow-p01.001-p10.002-S200", 0.001, 0.002, 200)

# ---- wrongCountDistribution(g, states, probs, { w }) -----------------------------------------------------------------
# Per state: D_k = stated directions (g_i < g_j) with states[s][i][k] <= states[s][j][k]; A = sum_k w_k D_k (criterion
# order); values = distinct A (exact equality, ascending) with probs summed in state order; unionBound = max(0, 1 -
# sum over stated (i, j), then k, of Pr(states[i][k] <= states[j][k])). N = 0: values [0], probs [1], all ones.
o_wcd <- function(g, states, probs, w = NULL) {
  n <- length(g); K <- ncol(states[[1]]); if (is.null(w)) { stopifnot(K == 1); w <- 1 }
  pairs <- list(); for (i in seq_len(n)) for (j in seq_len(n)) if (g[i] < g[j]) pairs[[length(pairs) + 1L]] <- c(i, j)
  N <- length(pairs)
  if (N == 0) return(list(N = 0L, values = vec(0), probs = vec(1), expected = 0, pNone = 1, pAllCriteriaRight = 1, unionBound = 1))
  A <- numeric(length(states)); right <- logical(length(states))
  for (s in seq_along(states)) {
    D <- integer(K)
    for (p in pairs) for (k in seq_len(K)) if (states[[s]][p[1], k] <= states[[s]][p[2], k]) D[k] <- D[k] + 1L
    a <- 0; for (k in seq_len(K)) a <- a + w[k] * D[k]
    A[s] <- a; right[s] <- all(D == 0L)
  }
  Tw <- 0
  for (p in pairs) for (k in seq_len(K)) Tw <- Tw + lsum(probs[vapply(states, function(m) m[p[1], k] <= m[p[2], k], TRUE)])
  u <- sort(unique(A))
  list(N = N, values = vec(u), probs = vec(vapply(u, function(x) lsum(probs[A == x]), 0)), expected = lsum(probs * A),
       pNone = lsum(probs[A == 0]), pAllCriteriaRight = lsum(probs[right]), unionBound = max(0, 1 - Tw))
}
wcd <- function(id, g, states, probs, w = NULL) {
  r <- o_wcd(g, states, probs, w)
  a <- list(g = vec(g), states = states_json(states), probs = vec(probs)); if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("wrongCountDistribution-", id), "wrongCountDistribution", a, r)); invisible(r)
}
s19 <- lapply(p2$tb19$states, cbind)
x1 <- wcd("spec-tb19-report212", c(2, 1, 2), s19, c(0.3, 0.7))
stopifnot(x1$N == 2, identical(unclass(x1$values), c(0, 1)), identical(unclass(x1$probs), c(0.7, 0.3)), x1$expected == 0.3,
          x1$pNone == 0.7, x1$pAllCriteriaRight == 0.7, x1$unionBound == 0.7)
x2 <- wcd("tb19-report123", c(1, 2, 3), s19, c(0.3, 0.7))
stopifnot(identical(unclass(x2$values), c(0, 2)), x2$unionBound == 0)               # the Bonferroni bound is clipped at 0
x3 <- wcd("tb19-all-withheld", c(1, 1, 1), s19, c(0.3, 0.7)); stopifnot(x3$N == 0)
wcd("tb19-labels-525", c(5, 2, 5), s19, c(0.3, 0.7))                               # labels need not be 1..G
s10 <- unname(lapply(p2$tb10$states, cbind)); p10 <- p2$tb10$masses / 20
x4 <- wcd("tb10-report123", c(1, 2, 3), s10, p10); stopifnot(identical(unclass(x4$values), c(0, 1, 3)))
check_close(x4$probs, c(0.6, 0.3, 0.1), 1e-15, "ch. 10 law, report 1/2/3: D = 0, 1, 3 w.p. .6, .3, .1")
check_close(x4$unionBound, 0.4, 1e-15, "ch. 10 law: 1 - (1/4 + 1/10 + 1/4)")
wcd("tb10-report112", c(1, 1, 2), s10, p10)
wcd("tb14-report1234-w.6-.4", c(1, 2, 3, 4), tb14, c(0.75, 0.25), c(0.6, 0.4))
x5 <- wcd("tb14-report1122-w1-0", c(1, 1, 2, 2), tb14, c(0.75, 0.25), c(1, 0))
stopifnot(x5$pNone > x5$pAllCriteriaRight)                                         # a zero weight: A = 0 with D_2 > 0
wcd("three-unit-ties-report123-w.5-.5", c(1, 2, 3), ties3, c(0.2, 0.3, 0.5), c(0.5, 0.5))   # latent ties count as wrong
wcd("three-unit-ties-all-withheld-K2", c(2, 2, 2), ties3, c(0.2, 0.3, 0.5), c(0.5, 0.5))
# Exact equality of values: .6 * 2 + .4 * 0 = 1.2 and .6 * 0 + .4 * 3 = 1.2000000000000002 are two values.
sx <- list(rbind(c(1, 3), c(3, 2), c(2, 1)), rbind(c(3, 1), c(2, 2), c(1, 3)))
x6 <- wcd("exact-equality-1.2-vs-0.4x3", c(1, 2, 3), sx, c(0.4, 0.6), c(0.6, 0.4))
stopifnot(length(x6$values) == 2, x6$values[1] == 1.2, x6$values[2] == 0.4 * 3, x6$pNone == 0)

# ---- disclosedErrorEstimands(cases, { M, weights }) ------------------------------------------------------------------
# With weights p (case order): ERR = sum p A / sum p N (null when 0), meanFraction = sum_{N>0} p A/N / sum_{N>0} p (null
# when no case discloses), zeroImputed = sum_{N>0} p A/N, positiveFrequency = sum_{N>0} p, meanDisclosure = sum p N/M.
o_dee_w <- function(A, N, p, M = NULL) {
  sPA <- 0; sPN <- 0; sF <- 0; sP <- 0; sND <- 0
  for (c in seq_along(A)) {
    sPA <- sPA + p[c] * A[c]; sPN <- sPN + p[c] * N[c]
    if (N[c] > 0) { sF <- sF + p[c] * A[c] / N[c]; sP <- sP + p[c] }
    if (!is.null(M)) sND <- sND + p[c] * N[c] / M
  }
  list(ERR = if (sPN == 0) NA_real_ else sPA / sPN, meanFraction = if (!any(N > 0)) NA_real_ else sF / sP,
       zeroImputed = sF, positiveFrequency = sP, meanDisclosure = if (is.null(M)) NA_real_ else sND)
}
o_dee_eq <- function(A, N, M = NULL) {                                             # equally likely cases (unchanged)
  R <- length(A); pos <- N > 0
  list(ERR = if (sum(N) > 0) sum(A) / sum(N) else NA_real_, meanFraction = if (any(pos)) ksum(A[pos] / N[pos]) / sum(pos) else NA_real_,
       zeroImputed = ksum(ifelse(pos, A / pmax(N, 1), 0)) / R, positiveFrequency = sum(pos) / R,
       meanDisclosure = if (is.null(M)) NA_real_ else ksum(N / M) / R)
}
dee <- function(id, A, N, weights = NULL, M = NULL) {
  r <- if (is.null(weights)) o_dee_eq(A, N, M) else o_dee_w(A, N, weights, M)
  a <- list(cases = lapply(seq_along(A), function(i) list(A = A[i], N = N[i])))
  if (!is.null(M)) a$M <- M
  if (!is.null(weights)) a$weights <- vec(weights)
  add(row(paste0("disclosedErrorEstimands-", id), "disclosedErrorEstimands", a, r)); invisible(r)
}
de1 <- dee("spec-weights-.5-.25-.25-M3", c(2, 0, 0), c(2, 3, 0), c(0.5, 0.25, 0.25), 3)
check_close(unlist(de1), c(4/7, 2/3, 1/2, 3/4, 7/12), 3e-16, "API.md: 4/7, 2/3, 1/2, 3/4, 7/12 (to the last bit)")
de2 <- dee("spec-weights-no-M", c(2, 0, 0), c(2, 3, 0), c(0.5, 0.25, 0.25)); stopifnot(is.na(de2$meanDisclosure))
de3 <- dee("tb16-three-case-equal-weights-explicit", c(2, 0, 0), c(2, 3, 0), rep(r15(1/3), 3), 3)
check_close(unlist(de3), c(2/5, 1/2, 1/3, 2/3, 5/9), 1e-14, "explicit equal weights = the unweighted estimands")
dee("tb16-three-case-no-weights", c(2, 0, 0), c(2, 3, 0), M = 3)
dee("randomized-kernel-.25-.75", c(0.3, 0.65), c(3, 5), c(0.25, 0.75), 6)
dee("zero-weight-on-one-disclosing-case", c(1, 2, 0, 3), c(4, 5, 0, 3), c(0.4, 0, 0.1, 0.5), 10)
ds <- dee("all-silent-weighted", c(0, 0), c(0, 0), c(0.3, 0.7), 6)
stopifnot(is.na(ds$ERR), is.na(ds$meanFraction), ds$zeroImputed == 0, ds$positiveFrequency == 0, ds$meanDisclosure == 0)
dee("degenerate-weight-1-0-0", c(0.5, 2, 0), c(4, 2, 0), c(1, 0, 0), 6)                 # a silent case must have A = 0, whatever its weight
dee("expected-counts-weighted", c(0.0247745991823067, 0.4, 1.25), c(12, 9, 14), c(0.2, 0.3, 0.5), 15)

# ---- leagueGradingReplays(seed, { replays, priorSd, tau, cap }) ------------------------------------------------------
ENUM_MAX_GRADES <- 7
dp_by_h <- function(P, n) {                     # exact best within-block saving with exactly h blocks (h = 1..n)
  V <- matrix(-Inf, n + 1, n + 1); V[1, 1] <- 0
  for (h in seq_len(n)) for (c in h:n) { b <- (h - 1):(c - 1); V[h + 1, c + 1] <- max(V[h, b + 1] + P[c + 1, c + 1] - P[b + 1, c + 1]) }
  V[-1, n + 1]
}
# Contiguous cuts of `ord` with at most `cap` grades: the largest within-block saving sum_{s<t in a block}(e - tau)
# (= the smallest risk); equal risks (within 1e-12) -> fewer grades, then the lexicographically earlier cut vector.
order_choice <- function(e, ord, tau, cap) {
  n <- length(ord); M <- M_of(n)
  eta <- e[ord, ord] - tau; eta[lower.tri(eta, diag = TRUE)] <- 0
  P <- rbind(0, cbind(0, t(apply(apply(eta, 2, cumsum), 1, cumsum))))
  W <- function(a, b) P[cbind(b + 1, b + 1)] - P[cbind(a + 1, b + 1)]
  if (cap >= n && all(eta[upper.tri(eta)] < 0)) {                                  # every pair along the order saves
    adj <- -eta[cbind(1:(n - 1), 2:n)]; stopifnot(min(adj) / M > 1e-10)            # merging any two loses > 1e-10
    vh <- dp_by_h(P, n); stopifnot(which.max(vh) == n, max(vh[-n]) < vh[n] - 1e-10 * M)
    return(list(cuts = 1:(n - 1), G = n, gap = min(adj) / M, route = "strict order (all pairs save)"))
  }
  H <- min(cap, n, ENUM_MAX_GRADES)
  cand <- lapply(seq_len(H), function(h) {
    cs <- if (h == 1) matrix(integer(0), 0, 1) else combn(n - 1, h - 1)
    bd <- rbind(0L, cs, n)
    sav <- colSums(matrix(W(as.vector(bd[-nrow(bd), , drop = FALSE]), as.vector(bd[-1, , drop = FALSE])), nrow = h))
    list(cs = cs, sav = sav)
  })
  smax <- max(vapply(cand, function(x) max(x$sav), 0))
  d <- unlist(lapply(cand, function(x) (smax - x$sav) / M))
  if (any(d > 1e-13 & d <= 1e-10)) stop("near tie in the order family", call. = FALSE)
  route <- "enumeration"
  vh <- dp_by_h(P, n)                                     # an exact DP over block boundaries agrees with the enumeration
  stopifnot(abs(max(vh[1:H]) - smax) <= 1e-12 * M)
  if (min(cap, n) > H) {                                                           # more grades allowed than enumerated
    stopifnot(max(vh[(H + 1):min(cap, n)]) < smax - 1e-10 * M)
    route <- sprintf("enumeration of at most %d grades + exact bound for more", H)
  }
  for (h in seq_len(H)) {
    k <- which((smax - cand[[h]]$sav) / M <= 1e-12)
    if (length(k)) return(list(cuts = cand[[h]]$cs[, k[1]], G = h, gap = min(d[d > 1e-12], Inf), ties = sum(d <= 1e-12), route = route))
  }
}
o_eval1 <- function(g, e, tau) {                     # evaluateReport, one criterion: E over stated pairs in index order
  n <- length(g); v <- c(); for (i in seq_len(n)) for (j in seq_len(n)) if (g[i] < g[j]) v <- c(v, e[i, j])
  N <- length(v); E <- ksum(v)
  list(N = N, E = E, EoverN = if (N == 0) NA_real_ else E / N, risk = (E + tau * (M_of(n) - N)) / M_of(n))
}
o_lgr <- function(seed, R, sigma, tau, cap) {
  d <- lapply(seq_len(R), function(r) {
    s <- seed + r; est <- draw(s); po <- post(est, sigma); gap_ok(po$mean)
    e <- err_normal(po$mean, po$sd)
    ord <- order(-po$mean, seq_len(30))                                            # posterior-mean order, ties by index
    ch <- order_choice(e, ord, tau, cap)
    g <- integer(30); g[ord] <- 1L + findInterval(0:29, ch$cuts)
    ev <- o_eval1(g, e, tau)
    D <- sum(outer(g, g, "<") & outer(lg$theta, lg$theta, "<="))                  # realized weak wrong count vs theta
    list(r = r, seed = s, grade = vec(g), N = ev$N, E = ev$E, EoverN = ev$EoverN, D = D,
         DoverN = if (ev$N == 0) NA_real_ else D / ev$N, risk = ev$risk, G = ch$G, gap = ch$gap, route = ch$route)
  })
  pull <- function(f) vapply(d, function(x) as.numeric(x[[f]]), 0)
  list(expect = list(seed = seed, replays = R, priorSd = inf_echo(sigma), tau = tau, cap = cap,
                     r = vec(seq_len(R)), seeds = vec(seed + seq_len(R)), grade = lapply(d, `[[`, "grade"),
                     N = vec(as.integer(pull("N"))), E = vec(pull("E")), EoverN = vec(pull("EoverN")), D = vec(as.integer(pull("D"))),
                     DoverN = vec(pull("DoverN")), risk = vec(pull("risk")),
                     estimands = o_dee_eq(pull("D"), pull("N"), 435)),
       record = list(grades = vec(as.integer(pull("G"))), minRiskGap = min(pull("gap")), route = unique(vapply(d, `[[`, "", "route"))))
}
lgr <- function(id, seed = NULL, R = NULL, sigma = NULL, tau = NULL, cap = NULL) {
  r <- o_lgr(if (is.null(seed)) seed0 else seed, if (is.null(R)) 20 else R, if (is.null(sigma)) 0.15 else sigma,
             if (is.null(tau)) 0.2 else tau, if (is.null(cap)) 3 else cap)
  a <- list()
  if (!is.null(seed)) a$seed <- seed
  if (!is.null(R)) a$replays <- R
  if (!is.null(sigma)) a$priorSd <- inf_arg(sigma)
  if (!is.null(tau)) a$tau <- tau
  if (!is.null(cap)) a$cap <- cap
  rw <- row(paste0("leagueGradingReplays-", id), "leagueGradingReplays", a, r$expect); rw$record <- r$record
  add(rw); invisible(r)
}
G0 <- lgr("defaults")                                                              # seed 20261030, 20, .15, tau .2, cap 3
G1 <- lgr("seed20261030-R20-prior.15-tau.2-cap3-explicit", seed0, 20, 0.15, 0.2, 3)
stopifnot(identical(G0$expect, G1$expect), all(unclass(G0$record$grades) <= 3))
Gc1 <- lgr("seed20261030-R3-cap1-nothing-stated", seed0, 3, 0.15, 0.2, 1)
stopifnot(all(unclass(Gc1$expect$N) == 0), all(is.na(unclass(Gc1$expect$EoverN))), is.na(Gc1$expect$estimands$ERR),
          is.na(Gc1$expect$estimands$meanFraction), Gc1$expect$estimands$positiveFrequency == 0)
lgr("seed20261030-R5-prior.15-tau.1-cap2", seed0, 5, 0.15, 0.1, 2)
lgr("seed20261030-R5-prior.05-tau.3-cap5", seed0, 5, 0.05, 0.3, 5)
lgr("seed20261030-R3-flat-prior-tau.2-cap3", seed0, 3, Inf, 0.2, 3)
lgr("seed99-R1-prior.2-tau.25-cap4", 99, 1, 0.2, 0.25, 4)
Gs <- lgr("seed20261030-R3-prior.15-tau.5-cap30-strict-order", seed0, 3, 0.15, 0.5, 30)
stopifnot(all(unclass(Gs$expect$N) == 435))
Gu <- lgr("seed20261030-R3-prior.15-tau.2-cap30", seed0, 3, 0.15, 0.2, 30)
stopifnot(any(unclass(Gu$record$grades) > 3))                                      # the cap binds at 3 but not at 30

# ---- largestStatedError(g, E, { w }) ---------------------------------------------------------------------------------
# The stated (g_i < g_j) direction with the largest ebar_ij; equal errors: the first in (i, j) index order; null at N = 0.
o_lse <- function(g, e, w = NULL) {
  eb <- wsum(e, w); n <- length(g); best <- NULL; vals <- c()
  for (i in seq_len(n)) for (j in seq_len(n)) if (g[i] < g[j]) {
    vals <- c(vals, eb[i, j]); if (is.null(best) || eb[i, j] > best$e) best <- list(e = eb[i, j], i = i - 1L, j = j - 1L)
  }
  if (is.null(best)) return(list(isNull = TRUE, e = NA_real_, i = NA_integer_, j = NA_integer_))
  others <- vals[vals != best$e]; stopifnot(!length(others) || best$e - max(others) > 1e-14)   # no near-tie for the max
  c(list(isNull = FALSE), best)
}
lse <- function(id, g, e, ids, criteria, w = NULL) {
  r <- o_lse(g, e, w); a <- list(g = vec(g), E = earr(e, ids, criteria)); if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("largestStatedError-", id), "largestStatedError", a, r)); invisible(r)
}
l1 <- lse("spec-six-scoreA-112233", c(1, 1, 2, 2, 3, 3), e6a, six$ids, "score_A")
stopifnot(!l1$isNull, l1$i == 3, l1$j == 4); check_close(l1$e, .0107781, 5e-8, "API.md: e .0107781 (D above E)")
lse("six-scoreA-123345", c(1, 2, 3, 3, 4, 5), e6a, six$ids, "score_A")
lse("six-scoreA-strict", 1:6, e6a, six$ids, "score_A")
l0 <- lse("six-scoreA-all-withheld", rep(1, 6), e6a, six$ids, "score_A"); stopifnot(l0$isNull)
lse("six-AB-w.5-.5-112233", c(1, 1, 2, 2, 3, 3), e6ab, six$ids, c("score_A", "score_B"), c(0.5, 0.5))
lse("six-AB-w.3-.7-reversed-card", c(3, 3, 2, 2, 1, 1), e6ab, six$ids, c("score_A", "score_B"), c(0.3, 0.7))
lse("krw-race-card", race_card, e_race, krw_ids, "race_signed")
lse("krw-gender-card", gender_card, e_gender, krw_ids, "gender_signed")
# Equal errors: stated (B, A), (B, D), (C, A), (C, D) with ebar .2, .45, .45, .1: the first in (i, j) order is (B, D).
e4 <- hand_e(4, list(c(2, 1, 0.2, 0.8), c(2, 4, 0.45, 0.55), c(3, 1, 0.45, 0.55), c(3, 4, 0.1, 0.9), c(1, 4, 0.5, 0.5), c(2, 3, 0.3, 0.7)))
lt <- lse("equal-errors-first-in-index-order", c(2, 1, 1, 2), e4, LETTERS[1:4], "score")
stopifnot(lt$i == 1, lt$j == 3, lt$e == 0.45)
lse("equal-errors-labels-5295", c(5, 2, 9, 5), e4, LETTERS[1:4], "score")         # stated (B,A) (B,C) (B,D) (A,C) (D,C)

# ---- leastCertainPairs(E, { k, w }) ----------------------------------------------------------------------------------
# Pairs i < j by min(ebar_ij, ebar_ji) descending, equal values in (i, j) order; above = i when ebar_ij <= ebar_ji, else
# j; k clamped to M. Guards: no near-tie at the k-th place or inside the list unless exactly equal; no near-tie in
# the above decision unless exactly equal.
o_lcp <- function(e, w = NULL, k = 10) {
  eb <- wsum(e, w); n <- nrow(eb); I <- integer(); J <- integer(); v <- numeric(); ab <- integer(); dd <- numeric()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    I <- c(I, i); J <- c(J, j); v <- c(v, min(eb[i, j], eb[j, i])); ab <- c(ab, if (eb[i, j] <= eb[j, i]) i else j)
    dd <- c(dd, abs(eb[i, j] - eb[j, i]))
  }
  o <- order(-v, seq_along(v)); kk <- min(k, length(v))
  if (dim(e)[3] > 1) {                       # K = 1: ebar is the input double itself, so both sides compare the same values
    sv <- v[o][seq_len(min(kk + 1, length(v)))]; gaps <- -diff(sv)
    stopifnot(all(dd == 0 | dd > 1e-14), all(gaps == 0 | gaps > 1e-14))           # weighted sums: no last-bit decisions
  }
  o <- o[seq_len(kk)]
  list(count = kk, pairs = lapply(o, function(t) vec(c(I[t], J[t]) - 1L)), e = vec(v[o]), above = vec(ab[o] - 1L))
}
lcp <- function(id, e, ids, criteria, k = NULL, w = NULL) {
  r <- o_lcp(e, w, if (is.null(k)) 10 else k)
  a <- list(E = earr(e, ids, criteria)); if (!is.null(k)) a$k <- k; if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("leastCertainPairs-", id), "leastCertainPairs", a, r)); invisible(r)
}
c3 <- lcp("spec-six-scoreA-k3", e6a, six$ids, "score_A", 3)
stopifnot(identical(lapply(c3$pairs, unclass), list(c(2L, 3L), c(0L, 1L), c(4L, 5L))), identical(unclass(c3$above), c(2L, 0L, 4L)))
check_close(c3$e, c(.3618, .1884, .1444), 5e-5, "API.md: .3618, .1884, .1444")
lcp("six-scoreA-default-k", e6a, six$ids, "score_A")
lcp("six-scoreA-k1", e6a, six$ids, "score_A", 1)
lcp("six-scoreA-k15-all", e6a, six$ids, "score_A", 15)
ck100 <- lcp("six-scoreA-k100-clamped", e6a, six$ids, "score_A", 100); stopifnot(ck100$count == 15)
lcp("six-AB-w.5-.5-k5", e6ab, six$ids, c("score_A", "score_B"), 5, c(0.5, 0.5))
eq4 <- array(err_normal(c(0.3, 0.3, 0.3, 0.3), rep(0.2, 4)), c(4, 4, 1))           # every e = .5 exactly
q4 <- lcp("equal-means-all-pairs-tie", eq4, LETTERS[1:4], "score", 6)
stopifnot(all(unclass(q4$e) == 0.5), identical(unclass(q4$above), c(0L, 0L, 0L, 1L, 1L, 2L)))
pt4 <- array(r15(err_normal(c(1, 1, 0, 0), rep(0.2, 4))), c(4, 4, 1))
q5 <- lcp("two-tied-pairs-first", pt4, LETTERS[1:4], "score", 3)
stopifnot(identical(lapply(q5$pairs, unclass)[1:2], list(c(0L, 1L), c(2L, 3L))))
lcp("krw-race-k10", e_race, krw_ids, "race_signed", 10)
lcp("krw-gender-k10", e_gender, krw_ids, "gender_signed", 10)
lcp("league-seed20261030-posterior.15-k10", e_lg15, lg$ids, "theta", 10)
lcp("two-units-default-k", hand2(0.3, 0.7), c("A", "B"), "score")

# ---- transformedMeans(law, { transform, k, criterion }) --------------------------------------------------------------
# Finite law: means[i] = sum_s probs[s] f(states[s][i][criterion]) in state order; normal posteriors: identity (the
# means) or exp (lognormal mean exp(k m + k^2 s^2 / 2)); order by mean descending, equal means in index order.
o_tm_law <- function(states, probs, transform = "identity", k = 1, criterion = 1) {
  f <- switch(transform, identity = function(x) x, sqrt = sqrt, log = log, exp = function(x) exp(k * x))
  n <- nrow(states[[1]])
  means <- vapply(seq_len(n), function(i) lsum(probs * vapply(states, function(m) f(m[i, criterion]), 0)), 0)
  o_tm_out(means)
}
o_tm_normal <- function(m, s, transform = "identity", k = 1) o_tm_out(if (transform == "identity") m else exp(k * m + k^2 * s^2 / 2))
o_tm_out <- function(means) {
  sm <- sort(means); g <- diff(sm); stopifnot(all(g == 0 | g > 1e-12 * pmax(1, abs(sm[-1]))))    # ties are exact
  list(means = vec(means), order = vec(order(-means, seq_along(means)) - 1L))
}
tm <- function(id, law, r, transform = NULL, k = NULL, criterion = NULL) {
  a <- list(law = law); if (!is.null(transform)) a$transform <- transform; if (!is.null(k)) a$k <- k
  if (!is.null(criterion)) a$criterion <- criterion
  add(row(paste0("transformedMeans-", id), "transformedMeans", a, r)); invisible(r)
}
law19 <- list(states = states_json(s19), probs = vec(c(0.3, 0.7)))
t1 <- tm("spec-tb19-identity", law19, o_tm_law(s19, c(0.3, 0.7), "identity"), "identity")
check_close(t1$means, c(6, 4, 3), 1e-15, "API.md: identity means 6, 4, 3"); stopifnot(identical(unclass(t1$order), 0:2))
t2 <- tm("spec-tb19-sqrt", law19, o_tm_law(s19, c(0.3, 0.7), "sqrt"), "sqrt")
check_close(t2$means, c(1.341641, 2, 1.732051), 5e-7, "API.md: sqrt means"); stopifnot(identical(unclass(t2$order), c(1L, 2L, 0L)))
tm("tb19-default-transform", law19, o_tm_law(s19, c(0.3, 0.7)))
tm("tb19-exp-k.1", law19, o_tm_law(s19, c(0.3, 0.7), "exp", 0.1), "exp", 0.1)
t3 <- tm("tb19-exp-k-1-decreasing", law19, o_tm_law(s19, c(0.3, 0.7), "exp", -1), "exp", -1)
stopifnot(identical(unclass(t3$order), c(0L, 2L, 1L)))
law10 <- list(states = states_json(s10), probs = vec(p10))
tm("tb10-log", law10, o_tm_law(s10, p10, "log"), "log")
tm("tb10-sqrt", law10, o_tm_law(s10, p10, "sqrt"), "sqrt")
law14 <- list(states = states_json(tb14), probs = vec(c(0.75, 0.25)))
tm("tb14-criterion1-sqrt", law14, o_tm_law(tb14, c(0.75, 0.25), "sqrt", criterion = 2), "sqrt", criterion = 1)
tm("tb14-criterion0-identity", law14, o_tm_law(tb14, c(0.75, 0.25), "identity", criterion = 1), "identity", criterion = 0)
tn <- tm("spec-normal-m0-s1-exp-k1", list(means = vec(0), sds = vec(1)), o_tm_normal(0, 1, "exp", 1), "exp", 1)
check_close(tn$means, 1.648721, 5e-7, "API.md: exp(1/2) = 1.648721")
tm("normal-two-units-exp-k1-reorders", list(means = vec(c(0, 0.1)), sds = vec(c(1, 0.1))), o_tm_normal(c(0, 0.1), c(1, 0.1), "exp", 1), "exp", 1)
tm("normal-two-units-identity", list(means = vec(c(0, 0.1)), sds = vec(c(1, 0.1))), o_tm_normal(c(0, 0.1), c(1, 0.1)), "identity")
lw6 <- list(means = vec(six$mean), sds = vec(six$sd))
tm("six-normal-exp-k1", lw6, o_tm_normal(six$mean, six$sd, "exp", 1), "exp", 1)
t6 <- tm("six-normal-exp-k-2-reverses", lw6, o_tm_normal(six$mean, six$sd, "exp", -2), "exp", -2)
stopifnot(identical(unclass(t6$order), 5:0))
tm("six-normal-default-identity", lw6, o_tm_normal(six$mean, six$sd))
tt <- tm("normal-equal-units-exp-k.5", list(means = vec(c(0.1, 0.3, 0.1)), sds = vec(c(0.2, 0.2, 0.2))),
         o_tm_normal(c(0.1, 0.3, 0.1), c(0.2, 0.2, 0.2), "exp", 0.5), "exp", 0.5)
stopifnot(identical(unclass(tt$order), c(1L, 0L, 2L)))
# Throw rows (adapter fn transformedMeansThrows): values outside the support are a RangeError (API.md); the other
# checks only need to throw.
tmt <- function(id, law, transform = NULL, k = NULL, criterion = NULL, range_error = FALSE) {
  a <- list(law = law); if (!is.null(transform)) a$transform <- transform; if (!is.null(k)) a$k <- k
  if (!is.null(criterion)) a$criterion <- criterion
  add(row(paste0("transformedMeans-throws-", id), "transformedMeansThrows", a, if (range_error) list(threw = TRUE, rangeError = TRUE) else list(threw = TRUE)))
}
tmt("tb19-log-of-zero", law19, "log", range_error = TRUE)
tmt("negative-sqrt", list(states = states_json(st1(c(1, -0.5), c(2, 0.5))), probs = vec(c(0.5, 0.5))), "sqrt", range_error = TRUE)
tmt("normal-sqrt-not-allowed", lw6, "sqrt")
tmt("exp-k0", law19, "exp", 0)
tmt("criterion-out-of-range", law19, "identity", criterion = 1)

# ---- selectionOnDraws(draws, E, { tau, w, family }) ------------------------------------------------------------------
# ehat = draw shares (theta_i <= theta_j); ghat = exactOptimum(ehat).grade (non-order families: the lexicographically
# first optimum within 1e-12; order families: fewer grades, then the earlier cut); g* the same under E. Guards: no risk
# within (1e-13, 1e-10] of either minimum, so the tie sets do not depend on summation order.
fam_reports <- function(n, family) {
  if (family$kind == "order") {
    ord <- family$order + 1L; Gmax <- if (is.null(family$G)) n else family$G
    cuts <- unlist(lapply(seq_len(min(Gmax, n)) - 1L, function(c) if (c == 0) list(integer(0)) else lapply(seq_len(choose(n - 1, c)), function(t) combn(n - 1, c)[, t])), recursive = FALSE)
    G <- t(vapply(cuts, function(cs) { g <- integer(n); g[ord] <- 1L + findInterval(0:(n - 1), cs); g }, integer(n)))
    return(list(G = G, cuts = cuts))
  }
  R <- oracle_reports(n); R <- R[do.call(order, unname(as.data.frame(R))), , drop = FALSE]; mx <- apply(R, 1, max)
  keep <- switch(family$kind, all = rep(TRUE, nrow(R)), atMost = mx <= family$G, exactly = mx == family$G)
  list(G = R[keep, , drop = FALSE], cuts = NULL)
}
choose_report <- function(fr, risk, label) {
  d <- risk - min(risk); if (any(d > 1e-13 & d <= 1e-10)) stop("ambiguous near-tie: ", label, call. = FALSE)
  tied <- which(d <= 1e-12)
  if (!is.null(fr$cuts)) { h <- lengths(fr$cuts)[tied]; tied <- tied[h == min(h)] }   # generation order: lexicographic per h
  list(grade = fr$G[tied[1], ], ties = length(which(d <= 1e-12)))
}
o_evalw <- function(g, e, tau, w) {                    # evaluateReport: E_k over stated pairs (index order), Ew = sum w_k E_k
  n <- length(g); K <- dim(e)[3]; x <- which(t(outer(g, g, "<")))                  # row-major (i, then j)
  E <- vapply(seq_len(K), function(k) ksum(t(e[, , k])[x]), 0); N <- length(x)
  list(N = N, risk = (lsum(w * E) + tau * (M_of(n) - N)) / M_of(n))
}
o_sel <- function(draws, e, tau, w, family) {
  n <- dim(e)[1]; K <- dim(e)[3]; S <- length(draws); if (is.null(w)) w <- rep(1, K)
  eh <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) eh[i, j, k] <- sum(vapply(draws, function(dr) dr[i, k] <= dr[j, k], TRUE)) / S
  fr <- fam_reports(n, family)
  rh <- p2$risk_of(fr$G, wsum(eh, w), tau)$risk; re <- p2$risk_of(fr$G, wsum(e, w), tau)$risk
  gh <- choose_report(fr, rh, "ehat"); gs <- choose_report(fr, re, "E")
  vh_in <- o_evalw(gh$grade, eh, tau, w); vh_ex <- o_evalw(gh$grade, e, tau, w); vs <- o_evalw(gs$grade, e, tau, w)
  eps <- vapply(seq_len(K), function(k) max(abs(eh[, , k] - e[, , k]), na.rm = TRUE), 0)
  dW <- lsum(w * eps); M <- M_of(n)
  stopifnot(abs(vh_in$risk - vh_ex$risk) <= vh_in$N * dW / M + 1e-15, vh_ex$risk - vs$risk >= -1e-15)   # |gap| <= bound; regret >= 0
  list(expect = list(grade = vec(gh$grade), N = vh_in$N, inSample = vh_in$risk, exact = vh_ex$risk, gap = vh_in$risk - vh_ex$risk,
                     epsilon = vec(eps), deltaW = dW, bound = vh_in$N * dW / M, best = vs$risk, regret = vh_ex$risk - vs$risk,
                     regretBound = (vh_in$N + vs$N) * dW / M),
       record = list(tiesInSample = gh$ties, tiesExact = gs$ties, chosenEqualsBest = identical(gh$grade, gs$grade)))
}
sod <- function(id, draws, e, ids, criteria, tau, w = NULL, family = NULL) {
  r <- o_sel(draws, e, tau, w, if (is.null(family)) list(kind = "all") else family)
  a <- list(draws = states_json(draws), E = earr(e, ids, criteria), tau = tau)
  if (!is.null(w)) a$w <- vec(w)
  if (!is.null(family)) a$family <- family
  rw <- row(paste0("selectionOnDraws-", id), "selectionOnDraws", a, r$expect); rw$record <- r$record
  add(rw); invisible(r)
}
d2 <- lapply(list(c(1, 0), c(1, 0), c(0, 1), c(1, 0)), cbind); e2 <- hand2(0.4, 0.6)
sp <- sod("spec-two-units-tau.45", d2, e2, c("A", "B"), "score", 0.45)$expect
stopifnot(identical(unclass(sp$grade), c(1L, 2L)), sp$N == 1, sp$inSample == 0.25, sp$exact == 0.4, sp$regret == 0)
check_close(unlist(sp[c("gap", "epsilon", "deltaW", "bound", "best", "regretBound")]), c(-0.15, 0.15, 0.15, 0.15, 0.4, 0.3), 1e-15,
            "API.md: gap -.15, epsilon .15, bound .15, best .4, regret 0, regretBound .3")
d6 <- lapply(six$draws1, cbind); d6s <- lapply(six$draws4, cbind)
sod("six-scoreA-S100-seed1-tau.2-all", d6, e6a, six$ids, "score_A", 0.2)
sod("six-scoreA-S100-seed1-tau.2-atMost3", d6, e6a, six$ids, "score_A", 0.2, family = list(kind = "atMost", G = 3))
sod("six-scoreA-S5-seed424242-tau.2-all-tied-shares", d6s, e6a, six$ids, "score_A", 0.2)
sod("six-scoreA-S5-seed424242-tau.3-order-cap3", d6s, e6a, six$ids, "score_A", 0.3, family = list(kind = "order", order = vec(0:5), G = 3))
# Order families, tied under ehat: the package rule, not the lexicographically first grade vector. Cuts (2, 4) and (3, 4)
# tie: the earlier cut gives 1/1/2/2/3/3 (the lexicographically first vector would be 1/1/1/2/3/3) ...
so1 <- sod("six-scoreA-S5-seed424242-tau.2-order-cap3-earlier-cut", d6s, e6a, six$ids, "score_A", 0.2,
           family = list(kind = "order", order = vec(0:5), G = 3))
stopifnot(identical(unclass(so1$expect$grade), c(1L, 1L, 2L, 2L, 3L, 3L)), so1$record$tiesInSample == 2)
# ... and along the order B, A, C, E, D, F the 2-grade cut (3) ties the 3-grade cuts (2, 3) and (3, 5): fewer grades win.
so2 <- sod("six-scoreA-S5-seed424242-tau.1-order-BACEDF-cap3-fewer-grades", d6s, e6a, six$ids, "score_A", 0.1,
           family = list(kind = "order", order = vec(c(1L, 0L, 2L, 4L, 3L, 5L)), G = 3))
stopifnot(identical(unclass(so2$expect$grade), c(1L, 1L, 1L, 2L, 2L, 2L)), so2$record$tiesInSample == 3)
sod("six-scoreA-S1-tau.2-all", d6[1], e6a, six$ids, "score_A", 0.2)
sod("six-scoreA-S100-tau.5-exactly2", d6, e6a, six$ids, "score_A", 0.5, family = list(kind = "exactly", G = 2))
# Two criteria: draws as engine gaussianDraws(means, sds, 40, 11) (z consumed draw, unit, criterion), written with 15 digits.
mAB <- cbind(six$mean, mB); zz <- prx_normals(11, 40 * 6 * 2)
dAB <- lapply(0:39, function(s) r15(matrix(mAB + 0.2 * zz[(s * 6 + rep(0:5, 2)) * 2 + rep(1:2, each = 6)], 6, 2)))
for (dr in dAB) { stopifnot(min(diff(sort(dr[, 1]))) > 1e-9, min(diff(sort(dr[, 2]))) > 1e-9) }
sod("six-AB-S40-seed11-w.5-.5-tau.25-atMost3", dAB, e6ab, six$ids, c("score_A", "score_B"), 0.25, c(0.5, 0.5), list(kind = "atMost", G = 3))

# ---- pairCertainty(E, { w, thresholds }) -----------------------------------------------------------------------------
# counts[t] = pairs i < j with min(ebar_ij, ebar_ji) < 1 - thresholds[t] (strict; 1 - t evaluated in double).
o_pc <- function(e, w = NULL, thresholds = c(0.9, 0.99), guard = TRUE) {
  eb <- wsum(e, w); n <- nrow(eb); v <- c()
  for (i in 1:(n - 1)) for (j in (i + 1):n) v <- c(v, min(eb[i, j], eb[j, i]))
  if (guard) for (t in thresholds) stopifnot(all(abs(v - (1 - t)) > 1e-14))
  list(M = M_of(n), thresholds = vec(thresholds), counts = vec(vapply(thresholds, function(t) sum(v < 1 - t), 0L)))
}
pcr <- function(id, e, ids, criteria, thresholds = NULL, w = NULL, guard = TRUE) {
  r <- o_pc(e, w, if (is.null(thresholds)) c(0.9, 0.99) else thresholds, guard)
  a <- list(E = earr(e, ids, criteria)); if (!is.null(w)) a$w <- vec(w); if (!is.null(thresholds)) a$thresholds <- vec(thresholds)
  add(row(paste0("pairCertainty-", id), "pairCertainty", a, r)); invisible(r)
}
pc1 <- pcr("spec-six-scoreA-.9-.99", e6a, six$ids, "score_A", c(0.9, 0.99))
stopifnot(pc1$M == 15, identical(unclass(pc1$counts), c(12L, 11L)))
pcr("six-scoreA-default-thresholds", e6a, six$ids, "score_A")
pcr("six-scoreA-six-thresholds", e6a, six$ids, "score_A", c(0.6, 0.75, 0.9, 0.95, 0.99, 0.999))
pcr("six-AB-w.5-.5", e6ab, six$ids, c("score_A", "score_B"), c(0.9, 0.99), c(0.5, 0.5))
pcr("krw-race", e_race, krw_ids, "race_signed", c(0.75, 0.9, 0.95, 0.99, 0.999))
pcr("krw-gender", e_gender, krw_ids, "gender_signed", c(0.75, 0.9, 0.95, 0.99, 0.999))
pcr("league-seed20261030-posterior.15", e_lg15, lg$ids, "theta", c(0.9, 0.99))
# Strictness at an exact boundary: min ebar = .25 and threshold .75 (1 - .75 = .25 exactly) is not counted.
pb <- pcr("boundary-.25-strict", hand2(0.25, 0.75), c("A", "B"), "score", c(0.7, 0.75, 0.8), guard = FALSE)
stopifnot(identical(unclass(pb$counts), c(1L, 0L, 0L)))
# The literal expression: 1 - .99 is 0.010000000000000009 in double, so min ebar = .01 counts at threshold .99.
pf <- pcr("float-boundary-.01-at-.99", hand2(0.01, 0.99), c("A", "B"), "score", c(0.99), guard = FALSE)
stopifnot(identical(unclass(pf$counts), 1L), 0.01 < 1 - 0.99, !(1 - 0.01 > 0.99))

# ---- write ----------------------------------------------------------------------------------------------------------
json_safe <- function(x, where) {                    # every numeric input survives the 15-digit JSON text
  if (is.list(x)) { if (!is.null(x[["$sum"]]) || !is.null(x[["$num"]])) return(invisible(TRUE)); for (y in x) json_safe(y, where); return(invisible(TRUE)) }
  if (is.numeric(x)) {
    v <- as.numeric(x); if (any(is.infinite(v))) stop("infinite input (use a token): ", where, call. = FALSE)
    v <- v[!is.na(v)]; if (!identical(as.numeric(sprintf("%.15g", v)), v)) stop("input not 15-digit safe: ", where, call. = FALSE)
  }
  invisible(TRUE)
}
no_inf <- function(x, where) {
  if (is.list(x)) { for (y in x) no_inf(y, where); return(invisible(TRUE)) }
  if (is.numeric(x) && any(is.infinite(x))) stop("infinite expected value: ", where, call. = FALSE)
  invisible(TRUE)
}
for (r in rows) { json_safe(r$args, r$id); no_inf(r$expect, r$id) }
ids <- vapply(rows, `[[`, "", "id"); stopifnot(!anyDuplicated(ids))
fns <- c("topKOvershoot", "leagueOvershoot", "expectedSquaredDistance", "finiteLawMargins", "majorityWins", "weightedRadius",
         "regretBound", "twoStateChain", "chainMeanVariance", "wrongCountDistribution", "disclosedErrorEstimands",
         "leagueGradingReplays", "largestStatedError", "leastCertainPairs", "transformedMeans", "selectionOnDraws", "pairCertainty")
used <- vapply(rows, function(r) r$args$fn, ""); stopifnot(all(fns %in% used), all(used %in% c(fns, "transformedMeansThrows")))
assert_no_postrank()
write_golden("oracle-v3", rows, generator = "r-export/17_v3_helpers.R", uses_postrank = FALSE)
cat("oracle-v3:", length(rows), "rows\n"); print(table(factor(used, levels = c(fns, "transformedMeansThrows"))))
