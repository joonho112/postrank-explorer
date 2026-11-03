# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/simulate.ts (Step 2.10).
#   oracle-simulate    base R only: the SR-06 league (engine/API.md "Simulated league specification") and its seeded
#                      draws through the engine's stream (r-export/_rng.R), the teaching normal-normal posterior,
#                      closed-form expected misordered pairs, order statistics of scores, exact rank summaries of
#                      finite laws (theory book ch. 5, 10, 19), KRW Example 1's contradiction band, envelope radii
#                      (package 2M and theory-book 4M forms), Monte Carlo standard errors and the fragility rule.
#   postrank-simulate  postrank 1.1.0: postrank_mc_fragility() (fragile pairs and the MCSE of each traced pair's
#                      weighted indicator trace) on postrank_toy and on seeded six-site draws; postrank_iid_bounds()
#                      raw radius against envelopeRadius().
# Conventions: units 0-based in code; scores larger-first; ranks count from the top (rank 1 = largest value).
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R"); source("r-export/_rng.R")
assert_no_postrank()

vec <- function(x) I(unname(x))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
check_close <- function(a, b, tol, label) {
  a <- as.numeric(unlist(a)); b <- as.numeric(unlist(b))
  if (length(a) != length(b) || any(is.na(a) != is.na(b))) stop("check failed (shape/NA): ", label, call. = FALSE)
  d <- max(c(0, abs(a - b)), na.rm = TRUE)
  if (d > tol) stop(sprintf("check failed: %s (max diff %.3g > %.3g)", label, d, tol), call. = FALSE)
  invisible(d)
}
gap_ok <- function(x, tol = 1e-9) { s <- sort(x); stopifnot(length(s) < 2 || min(diff(s)) > tol); invisible(TRUE) }
json_exact <- function(x) { stopifnot(identical(as.numeric(sprintf("%.15g", x)), as.numeric(x))); x }  # survives 15 digits
dec9 <- function(x) json_exact(as.numeric(sprintf("%.9f", x)))
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# ---- the SR-06 league (no randomness in the truth) -----------------------------------------------------------------
lg_i <- 1:30
lg <- list(ids = sprintf("U%02d", lg_i), size = rep(c(16, 64, 256), 10), group = rep(c("small", "medium", "large"), 10))
lg$se <- 0.8 / sqrt(lg$size)
lg$rank <- (19 * lg_i) %% 31                         # r_i, a permutation of 1..30 (larger r = larger theta)
lg$theta <- 0.15 * qnorm((lg$rank - 0.5) / 30)
stopifnot(identical(sort(lg$rank), as.numeric(1:30)), identical(unique(lg$se), c(0.2, 0.1, 0.05)))
check_close(tapply(lg$rank, lg$group, mean)[c("small", "medium", "large")], c(15.1, 15.5, 15.9), 1e-12, "SR-06 group-mean r 15.1/15.5/15.9")
add(row("league30", "league30", list(), list(ids = vec(lg$ids), size = vec(lg$size), group = vec(lg$group), se = vec(lg$se),
                                           theta = vec(lg$theta), rank = vec(lg$rank))))
seed0 <- 20261030
draw <- function(seed) lg$theta + lg$se * prx_normals(seed, 30)   # z in unit order (API.md)
est <- lapply(0:3, function(r) draw(seed0 + r))
for (r in 0:3) add(row(sprintf("drawLeague-seed%d", seed0 + r), "drawLeague", list(seed = seed0 + r),
                       list(seed = seed0 + r, estimate = vec(est[[r + 1]]))))
# simulateEstimates(truth, se, count, seed): truth + se * normals(seed, count) (the league construction for one unit).
for (cfg in list(c(0.5, 0.2, 20, 1), c(-0.3, 0.05, 7, 20261030))) {
  v <- cfg[1] + cfg[2] * prx_normals(cfg[4], cfg[3])
  add(row(sprintf("simulateEstimates-truth%g-se%g-n%d-seed%d", cfg[1], cfg[2], cfg[3], cfg[4]), "simulateEstimates",
          list(truth = cfg[1], se = cfg[2], count = cfg[3], seed = cfg[4]), list(estimates = vec(v))))
}
# Step 5.14, L-02 (pages/learn/noisy-estimate.qmd; numbers/spec/part1-l02.json): presets se10 and se05 (true value .50,
# 20 draws, seed 1), one more draw (21), the 200-draw case, the clamped case (true value 1, SE .5, 200 draws), and the
# noise alone (true value 0) at SE .20, .10, .05 and at the n7 setting. The record (not compared) holds the count of
# estimates within one SE, |estimate - truth| <= SE (as evidenceFlags with crit 1 leaves them unflagged: |z| > 1 strict),
# the smallest distance of any |z| from 1, and the count expected on average, count (Phi(1) - Phi(-1)).
for (cfg in list(c(0.5, 0.1, 20, 1), c(0.5, 0.05, 20, 1), c(0.5, 0.2, 21, 1), c(0.5, 0.2, 200, 1), c(1, 0.5, 200, 1),
                 c(0, 0.2, 20, 1), c(0, 0.1, 20, 1), c(0, 0.05, 20, 1), c(0, 0.05, 7, 20261030))) {
  zz <- prx_normals(cfg[4], cfg[3]); v <- cfg[1] + cfg[2] * zz
  zs <- (v - cfg[1]) / cfg[2]
  stopifnot(min(abs(abs(zs) - 1)) > 1e-9)                         # no estimate on the one-SE boundary
  r <- row(sprintf("simulateEstimates-truth%g-se%g-n%d-seed%d", cfg[1], cfg[2], cfg[3], cfg[4]), "simulateEstimates",
           list(truth = cfg[1], se = cfg[2], count = cfg[3], seed = cfg[4]), list(estimates = vec(v)))
  r$record <- list(withinOneSE = sum(abs(zs) <= 1), minDistanceFromOneSE = min(abs(abs(zs) - 1)),
                   expectedWithin = cfg[3] * (pnorm(1) - pnorm(-1)))
  add(r)
}

# ---- teaching posterior and intervals ----------------------------------------------------------------------------
o_post <- function(est, se, mu, sigma) { B <- sigma^2 / (sigma^2 + se^2); list(mean = vec(mu + B * (est - mu)), sd = vec(sqrt(B) * se), shrink = vec(B)) }
np <- function(id, est, se, mu, sigma) { r <- o_post(est, se, mu, sigma)
  add(row(paste0("normalPosterior-", id), "normalPosterior", list(est = vec(est), se = vec(se), priorMean = mu, priorSd = sigma), r)); invisible(r) }
p15 <- np("league-seed20261030-prior0-sd.15", est[[1]], lg$se, 0, 0.15)
check_close(unique(round(p15$shrink, 12)), c(0.36, 0.0225 / 0.0325, 0.9), 1e-12, "L-04 shrink .36/.69/.90")
check_close(unique(round(p15$sd, 12)), c(0.12, sqrt(0.0225 / 0.0325) * 0.1, 0.0474341649025257), 1e-12, "posterior SDs .120/.083/.047")
np("league-seed20261030-prior0-sd.05", est[[1]], lg$se, 0, 0.05)
np("league-seed20261031-prior.1-sd.2", est[[2]], lg$se, 0.1, 0.2)
np("league-equal-se", est[[1]], rep(0.1, 30), 0, 0.15)
o_interval <- function(m, s, level) { z <- qnorm((1 + level) / 2); list(lower = m - z * s, upper = m + z * s) }
for (cfg in list(c(0, 1, 0.9), c(0.3, 0.12, 0.9), c(-0.2, 0.05, 0.95), c(1, 2, 0.5), c(0.04, 0.047, 0.8)))
  add(row(sprintf("normalInterval-m%g-sd%g-level%g", cfg[1], cfg[2], cfg[3]), "normalInterval",
          list(mean = cfg[1], sd = cfg[2], level = cfg[3]), o_interval(cfg[1], cfg[2], cfg[3])))
check_close(unlist(o_interval(0, 1, 0.9)), c(-1.64485362695147, 1.64485362695147), 1e-13, "90% interval of N(0, 1)")

# ---- expected misordered pairs (closed form, true values fixed) ------------------------------------------------------
# Estimate order: theta_hat_i = theta_i + SE_i z_i, so a pair is misordered with probability
#   Phi(-|theta_i - theta_j| / sqrt(SE_i^2 + SE_j^2)).
# Posterior-mean order (prior mean 0, prior SD sigma): m_i = B_i theta_hat_i with B_i = sigma^2/(sigma^2 + SE_i^2), so
# m_i - m_j ~ N(B_i theta_i - B_j theta_j, B_i^2 SE_i^2 + B_j^2 SE_j^2) and, for theta_i > theta_j,
#   Pr(m_i <= m_j) = Phi(-(B_i theta_i - B_j theta_j) / sqrt(B_i^2 SE_i^2 + B_j^2 SE_j^2)).
# Unequal shrinkage can reverse the sign of the mean difference, so this term can exceed 1/2; with equal SEs every
# B_i is equal and the posterior-mean value equals the estimate-order value.
o_emp <- function(theta, se, sigma = NULL) {
  B <- if (is.null(sigma)) rep(1, length(theta)) else sigma^2 / (sigma^2 + se^2)
  stopifnot(!anyDuplicated(theta)); s <- 0
  for (i in 1:(length(theta) - 1)) for (j in (i + 1):length(theta)) {
    sg <- sign(theta[i] - theta[j])
    s <- s + pnorm(-sg * (B[i] * theta[i] - B[j] * theta[j]) / sqrt(B[i]^2 * se[i]^2 + B[j]^2 * se[j]^2))
  }
  s
}
emp <- function(id, theta, se, sigma = NULL) { v <- o_emp(theta, se, sigma)
  a <- list(theta = vec(theta), se = vec(se)); if (!is.null(sigma)) a$priorSd <- sigma
  add(row(paste0("expectedMisorderedPairs-", id), "expectedMisorderedPairs", a, list(expected = v))); invisible(v) }
e_raw <- emp("league-raw", lg$theta, lg$se)
e_15 <- emp("league-prior.15", lg$theta, lg$se, 0.15)
check_close(c(e_raw, e_15), c(88.1, 80.7), 0.05, "L-03/L-04: 88.1 (estimate order) and 80.7 (posterior-mean order)")
emp("league-prior.05", lg$theta, lg$se, 0.05)
emp("league-equal-se-prior.15", lg$theta, rep(0.1, 30), 0.15)
check_close(o_emp(lg$theta, rep(0.1, 30), 0.15), o_emp(lg$theta, rep(0.1, 30)), 1e-12, "equal SEs: posterior order = estimate order")
emp("three-unit-reversal-prior.1", c(0.3, 0.2, -0.1), c(0.4, 0.02, 0.1), 0.1)
B3 <- 0.01 / (0.01 + c(0.4, 0.02, 0.1)^2)
stopifnot(B3[1] * 0.3 < B3[2] * 0.2)                 # the shrunken mean difference reverses: that term exceeds 1/2
emp("three-unit-raw", c(0.3, 0.2, -0.1), c(0.4, 0.02, 0.1))

# ---- order statistics of two scores ------------------------------------------------------------------------------
o_misordered <- function(a, b) { gap_ok(a); gap_ok(b); s <- 0
  for (i in 1:(length(a) - 1)) for (j in (i + 1):length(a)) s <- s + ((a[i] - a[j]) * (b[i] - b[j]) < 0); s }
o_topk <- function(a, b, k) { gap_ok(a); gap_ok(b); length(intersect(order(-a)[seq_len(k)], order(-b)[seq_len(k)])) }
o_extreme <- function(score, group, k) { gap_ok(score); grp <- sort(unique(group))
  top <- order(-score)[seq_len(k)]; bot <- order(score)[seq_len(k)]
  cnt <- function(idx) setNames(as.list(vapply(grp, function(g) sum(group[idx] == g), 0)), grp)
  list(top = cnt(top), bottom = cnt(bot)) }
mp <- function(id, a, b) add(row(paste0("misorderedPairs-", id), "misorderedPairs", list(a = vec(a), b = vec(b)), list(count = o_misordered(a, b))))
tk <- function(id, a, b, k) add(row(paste0("topKOverlap-", id), "topKOverlap", list(a = vec(a), b = vec(b), k = k), list(count = o_topk(a, b, k))))
xc <- function(id, s, g, k) { r <- o_extreme(s, g, k)
  add(row(paste0("extremeCounts-", id), "extremeCounts", list(score = vec(s), group = vec(g), k = k), r)); invisible(r) }
tr <- xc("league-truth-k5", lg$theta, lg$group, 5)
stopifnot(identical(unlist(tr$top)[c("small", "medium", "large")], c(small = 1, medium = 2, large = 2)),
          identical(unlist(tr$bottom)[c("small", "medium", "large")], c(small = 2, medium = 2, large = 1)))   # SR-06 design
pm15 <- lapply(est, function(x) o_post(x, lg$se, 0, 0.15)$mean)
for (r in 0:3) {
  s <- seed0 + r; x <- est[[r + 1]]
  mp(sprintf("league-seed%d-estimate-vs-theta", s), x, lg$theta)
  mp(sprintf("league-seed%d-postmean.15-vs-theta", s), unclass(pm15[[r + 1]]), lg$theta)
  mp(sprintf("league-seed%d-estimate-vs-postmean.15", s), x, unclass(pm15[[r + 1]]))
  tk(sprintf("league-seed%d-estimate-vs-theta-k10", s), x, lg$theta, 10)
  xc(sprintf("league-seed%d-estimate-k5", s), x, lg$group, 5)
}
tk("league-seed20261030-estimate-vs-theta-k5", est[[1]], lg$theta, 5)
xc("league-seed20261030-estimate-k3", est[[1]], lg$group, 3)
eq_pm <- o_post(est[[1]], rep(0.1, 30), 0, 0.15)$mean
stopifnot(o_misordered(est[[1]], unclass(eq_pm)) == 0)                       # L-04: equal SEs keep the estimate order
mp("league-seed20261030-estimate-vs-postmean-equal-se", est[[1]], unclass(eq_pm))
mp("small-hand", c(3, 1, 2, 5), c(0.2, 0.4, 0.1, 0.9))
stopifnot(o_misordered(c(3, 1, 2, 5), c(0.2, 0.4, 0.1, 0.9)) == 2)
tk("small-hand-k2", c(3, 1, 2, 5), c(0.2, 0.4, 0.1, 0.9), 2)

# ---- rank summaries of a finite law (ch. 5: rank R_i = 1 + #{j: theta_j > theta_i}; tie-free states) ----------------
o_rank_summaries <- function(states, masses) {
  V <- do.call(rbind, states); p <- masses / sum(masses); n <- ncol(V)
  R <- t(apply(V, 1, function(v) { stopifnot(!anyDuplicated(v)); vapply(v, function(u) 1 + sum(v > u), 0) }))
  pTop <- t(sapply(seq_len(n), function(k) colSums(p * (R <= k))))           # pTop[k, i] = Pr(R_i <= k)
  list(mean = vec(colSums(p * V)), expectedRank = vec(colSums(p * R)), pFirst = vec(pTop[1, ]), pTop = unname(pTop))
}
rs <- function(id, states, masses) { r <- o_rank_summaries(states, masses)
  add(row(paste0("rankSummaries-", id), "rankSummaries", list(law = list(states = lapply(states, vec), probs = vec(masses / sum(masses)))), r))
  invisible(r) }
r19 <- rs("tb19-law3", list(c(20, 4, 3), c(0, 4, 3)), c(3L, 7L))
check_close(c(r19$mean, r19$expectedRank, r19$pFirst), c(6, 4, 3, 2.4, 1.3, 2.3, 0.3, 0.7, 0), 1e-15, "L-09 / ch. 19 law")
r10 <- rs("tb10-law051", list(c(3, 2, 1), c(1, 3, 2), c(1, 2, 3)), c(51L, 48L, 1L))
check_close(r10$expectedRank, c(1.98, 1.52, 2.50), 1e-15, "ch. 10: expected ranks 1.98, 1.52, 2.50")
rs("four-unit-three-states", list(c(0.4, 1.1, -0.2, 0.9), c(2, 0.5, 0.1, 0.3), c(-1, 0.2, 0.6, 0.25)), c(2L, 5L, 3L))
rs("one-state", list(c(1.5, -0.5, 0.25)), 1L)

# ---- KRW Example 1 (three firms, independent N(omega_i, 1), omega = (2, omega_2, 0)) ---------------------------------
# Isolated pair decisions state i above j when pi_ij > 1 - tau. With z = qnorm(1 - tau): pi_13 = Phi(sqrt 2) states 1 above
# 3 when sqrt(2) > z; pi_12 = Phi((2 - omega_2)/sqrt 2) and pi_23 = Phi(omega_2/sqrt 2) are both withheld exactly when
# 2 - sqrt(2) z <= omega_2 <= sqrt(2) z. The pairwise choices are then incoherent (1 ~ 2, 2 ~ 3, 1 > 3), so the
# contradiction band is the open interval (2 - sqrt(2) z, sqrt(2) z) when 1/sqrt(2) < z < sqrt(2), and empty otherwise.
o_band <- function(tau) { z <- qnorm(1 - tau)
  if (z > 1 / sqrt(2) && z < sqrt(2)) list(empty = FALSE, lower = 2 - sqrt(2) * z, upper = sqrt(2) * z) else list(empty = TRUE) }
for (tau in c(0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5)) add(row(sprintf("krwExample1Band-tau%g", tau), "krwExample1Band", list(tau = tau), o_band(tau)))
b20 <- o_band(0.2); check_close(c(b20$lower, b20$upper), c(0.810, 1.190), 5e-4, "G-04: band (.810, 1.190) at tau .20")
stopifnot(isTRUE(o_band(0.25)$empty), isTRUE(o_band(0.05)$empty))
check_close(c(pnorm(1 / sqrt(2)), pnorm(sqrt(2))), c(0.760, 0.921), 5e-4, "G-04: pi_12 = pi_23 = .760, pi_13 = .921 at omega_2 = 1")
for (w2 in c(b20$lower + 1e-6, 1, b20$upper - 1e-6)) {   # inside the band every isolated choice is as described
  stopifnot(pnorm((2 - w2) / sqrt(2)) < 0.8, pnorm(w2 / sqrt(2)) < 0.8, pnorm(sqrt(2)) > 0.8)
}

# ---- envelope radii ----------------------------------------------------------------------------------------------------
# Theory book ch. 15 (prp-iid-coefficient-envelope): with K criteria and M pairs, all 2MK ordered pair-criterion
# coordinates lie within sqrt(log(4MK/alpha)/(2S)) of their exact values with probability at least 1 - alpha (Hoeffding
# plus a union bound); with a per-criterion allocation alpha_k the radius is sqrt(log(4M/alpha_k)/(2S)) (K = 1 below).
# The package's postrank_iid_bounds() uses sqrt(log(2M/alpha_k)/(2S)) (form "package"). Neither is capped at 1.
o_radius_book <- function(M, S, alpha, K = 1) sqrt(log(4 * M * K / alpha) / (2 * S))
o_radius <- function(M, S, alpha, form) if (form == "package") sqrt(log(2 * M / alpha) / (2 * S)) else o_radius_book(M, S, alpha)
for (cfg in list(c(15, 1000, 0.05), c(15, 100, 0.05), c(3, 32, 0.025), c(435, 4000, 0.05), c(4656, 131072, 0.05), c(1, 100, 0.05), c(15, 1, 0.05)))
  for (form in c("package", "book")) add(row(sprintf("envelopeRadius-M%g-S%g-alpha%g-%s", cfg[1], cfg[2], cfg[3], form), "envelopeRadius",
    list(M = cfg[1], S = cfg[2], alpha = cfg[3], form = form), list(radius = o_radius(cfg[1], cfg[2], cfg[3], form))))
for (cfg in list(c(15, 1000, 0.05, 2), c(15, 100, 0.05, 2), c(435, 4000, 0.05, 3), c(4656, 131072, 0.05, 2), c(15, 1000, 0.05, 1)))
  add(row(sprintf("envelopeRadius-M%g-S%g-alpha%g-book-K%g", cfg[1], cfg[2], cfg[3], cfg[4]), "envelopeRadius",
          list(M = cfg[1], S = cfg[2], alpha = cfg[3], form = "book", K = cfg[4]), list(radius = o_radius_book(cfg[1], cfg[2], cfg[3], cfg[4]))))
check_close(c(o_radius(15, 1000, 0.05, "package"), o_radius(15, 1000, 0.05, "book"), o_radius(15, 100, 0.05, "package"),
              o_radius(15, 100, 0.05, "book")), c(0.0566, 0.0595, 0.1788, 0.1883), 5e-5, "P-09 radii .0566 .0595 .1788 .1883")
check_close(o_radius_book(15, 1000, 0.05, 2), 0.0624, 5e-5, "theory book ch. 15: M = 15, S = 1,000, alpha = .05, K = 2 gives .0624")
stopifnot(o_radius(15, 1, 0.05, "package") > 1)       # the formula, unclipped (the package's epsilon caps it at 1)

# ---- Monte Carlo standard error and the fragility rule (package rule, API.md) ----------------------------------------
o_mcse <- function(x) if (length(x) > 1) sd(x) / sqrt(length(x)) else NA_real_   # sample SD (divisor S - 1) / sqrt(S)
ms <- function(id, x) add(row(paste0("mcse-", id), "mcse", list(trace = vec(x)), list(mcse = o_mcse(x))))
bern <- as.numeric(prx_uniforms(7, 1000) < 0.188)
ms("bernoulli-S1000", bern)
check_close(o_mcse(bern), sqrt(mean(bern) * (1 - mean(bern)) / 999), 1e-15, "Bernoulli trace: sqrt(p(1 - p)/(S - 1))")
check_close(sqrt(0.188 * 0.812 / 1000), 0.0124, 5e-5, "P-09: MCSE about .0124 at e = .188, S = 1,000")
ms("weighted-.6.4-S40", 0.6 * (prx_uniforms(11, 40) < 0.3) + 0.4 * (prx_uniforms(12, 40) < 0.7))
ms("constant-S25", rep(0.4, 25))
ms("two-values", c(0, 1))
ms("S1-undefined", 1)
ms("continuous-S9", c(0.12, -0.5, 0.33, 0.9, 0.05, -0.27, 0.6, 0.41, -0.08))

# fragilePairs(draws, { tau, w, z }): for each i < j, ebar from draw shares; d = min(ebar_ij, ebar_ji) (i taken as
# ahead when equal); the trace is the weighted indicator sum_k w_k 1{theta_ak <= theta_bk} for the better direction a
# above b; fragile when |d - tau| < z MCSE(trace).
o_fragile <- function(draws, tau, w, z) {
  n <- dim(draws)[2]; K <- dim(draws)[3]; out <- list()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    fw <- rowSums(sapply(seq_len(K), function(k) w[k] * (draws[, i, k] <= draws[, j, k])))
    bw <- rowSums(sapply(seq_len(K), function(k) w[k] * (draws[, j, k] <= draws[, i, k])))
    tr <- if (mean(fw) <= mean(bw)) fw else bw; d <- mean(tr); m <- o_mcse(tr)
    if (!is.na(m)) stopifnot(abs(abs(d - tau) - z * m) > 1e-9)                 # no pair on the flag boundary
    if (!is.na(m) && abs(d - tau) < z * m) out[[length(out) + 1L]] <- c(i, j) - 1L
  }
  out
}
# The traced record (API.md; postrank_mc_fragility(), IID regime): pairs in the package's order (upper triangle,
# column-major: (0, 1), (0, 2), (1, 2), (0, 3), ...); screen z 0.5/sqrt(max(1, S - 1)) (a weighted 0/1 trace has sample
# SD at most 0.5 sqrt(S/(S - 1)), so no pair at or beyond it can be flagged); a pair is traced when its margin
# |d - tau| is below the screen, and then carries its better direction, weighted error d, margin, MCSE and flag.
o_fragile_record <- function(draws, tau, w, z) {
  S <- dim(draws)[1]; n <- dim(draws)[2]; K <- dim(draws)[3]; screen <- z * 0.5 / sqrt(max(1, S - 1))
  rec <- list()
  for (j in 2:n) for (i in 1:(j - 1)) {
    fw <- rowSums(sapply(seq_len(K), function(k) w[k] * (draws[, i, k] <= draws[, j, k])))
    bw <- rowSums(sapply(seq_len(K), function(k) w[k] * (draws[, j, k] <= draws[, i, k])))
    ahead <- mean(fw) <= mean(bw); tr <- if (ahead) fw else bw; d <- mean(tr); margin <- abs(d - tau)
    stopifnot(abs(margin - screen) > 1e-9)
    if (margin < screen) { m <- o_mcse(tr)
      rec[[length(rec) + 1L]] <- list(pair = c(i, j) - 1L, better = if (ahead) "i_ahead" else "j_ahead", d = d, margin = margin,
                                      mcse = m, fragile = if (is.na(m)) NA else margin < z * m) }
  }
  fr <- vapply(rec, function(r) isTRUE(r$fragile), TRUE)
  list(screenMargin = screen, traced = lapply(rec, function(r) vec(r$pair)), betterDirection = vec(vapply(rec, `[[`, "", "better")),
       weightedError = vec(vapply(rec, `[[`, 0, "d")), margin = vec(vapply(rec, `[[`, 0, "margin")),
       mcseTraced = vec(vapply(rec, `[[`, 0, "mcse")), flags = vec(vapply(rec, function(r) r$fragile, NA)),
       summary = list(pairs = n * (n - 1) / 2, traced = length(rec), fragile = sum(fr), fragileShare = sum(fr) / (n * (n - 1) / 2),
                      mcseUnavailable = sum(vapply(rec, function(r) is.na(r$mcse), TRUE))))
}
draws_json <- function(a) lapply(seq_len(dim(a)[1]), function(s) unname(matrix(a[s, , ], dim(a)[2], dim(a)[3])))
fp <- function(id, draws, tau, w, z = 2) { p <- o_fragile(draws, tau, w, z); rec <- o_fragile_record(draws, tau, w, z)
  stopifnot(rec$summary$fragile == length(p))
  add(row(paste0("fragilePairs-", id), "fragilePairs", list(draws = draws_json(draws), tau = tau, w = vec(w), z = z),
          c(list(pairs = lapply(p, vec), count = length(p)), rec))); invisible(p) }
hand <- array(c(0.1, 0.5, 0.2, 0.9, 0.3, 0.6, 0.8, 0.4,       # unit 1
                0.2, 0.4, 0.1, 0.7, 0.5, 0.3, 0.9, 0.6,       # unit 2
                -0.3, 0.2, 0.0, 0.1, -0.1, 0.25, 0.05, -0.2), c(8, 3, 1))
fp("hand-S8-n3-K1-tau.25", hand, 0.25, 1)
fp("hand-S8-n3-K1-tau.4-z1", hand, 0.4, 1, z = 1)
six_m <- c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8); six_mB <- c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7)
seeded_six <- function(seed, S, means) {             # S x 6 x K, theta = mean + .2 z, z = normals(seed, S*6*K) draw-major
  K <- ncol(means); z <- prx_normals(seed, S * 6 * K)
  a <- array(NA_real_, c(S, 6, K))
  for (s in seq_len(S)) for (i in 1:6) for (k in seq_len(K)) a[s, i, k] <- means[i, k] + 0.2 * z[((s - 1) * 6 + (i - 1)) * K + k]
  array(dec9(a), dim(a))
}
d200 <- seeded_six(424242, 200, cbind(six_m))
fp("six-scoreA-S200-seed424242-tau.2", d200, 0.2, 1)

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
# G-03 price of silence: misorderedPairs(no-cap optimum, capped optimum) at tau = .10, .20, .40 on the released score-A
# array. The two grade vectors have ties, so the count is the documented definition (engine/README.md): pairs with
# sign(a_i - a_j) != sign(b_i - b_j), a pair stated by one report and withheld by the other included.
source("r-export/15_part2.R")
o_sign_diff <- function(a, b) { s <- 0
  for (i in 1:(length(a) - 1)) for (j in (i + 1):length(a)) s <- s + (sign(a[i] - a[j]) != sign(b[i] - b[j])); s }
for (lab in c(".10", ".20", ".40")) {
  ga <- p2$six$opt[[paste0("all-tau", lab)]]$grade; gb <- p2$six$opt[[paste0("cap3-tau", lab)]]$grade
  add(row(sprintf("misorderedPairs-six-A-optimum-all-vs-cap3-tau%s", lab), "misorderedPairs", list(a = vec(ga), b = vec(gb)),
          list(count = o_sign_diff(ga, gb))))
}
stopifnot(o_sign_diff(c(1, 2, 3, 3, 4, 5), c(1, 1, 2, 2, 3, 3)) == 2)      # tau .20: A above B and E above F are withheld
# S-02 relation changes between neighbouring KRW race grid cards (lambda = .00 -> .01, ..., .99 -> 1): the same count of
# pairs whose stated relation (above, below or withheld) differs.
for (i in 1:100) {
  ga <- p2$krw$grid[[i]]; gb <- p2$krw$grid[[i + 1]]
  add(row(sprintf("misorderedPairs-krw-grid-race-lambda%.2f-vs-%.2f", p2$krw$grid_lambda[i], p2$krw$grid_lambda[i + 1]), "misorderedPairs",
          list(a = vec(ga), b = vec(gb)), list(count = o_sign_diff(ga, gb))))
}
# G-07 site029's 90% posterior interval (poverty; data/released/thirty-sites.json units).
add(row("normalInterval-thirty-site029-poverty-level0.9", "normalInterval",
        list(mean = p2$th$mean[29], sd = p2$th$sd[29], level = 0.9), o_interval(p2$th$mean[29], p2$th$sd[29], 0.9)))
stopifnot(identical(p2$th$ids[29], "site029"))

assert_no_postrank()
write_golden("oracle-simulate", rows, generator = "r-export/08_simulate.R", uses_postrank = FALSE)
cat("oracle-simulate:", length(rows), "rows\n")

# ---- postrank 1.1.0 ---------------------------------------------------------------------------------------------
load_postrank()
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r

decl_six <- function(K, S, seed) {
  crit <- c("score_A", "score_B")[seq_len(K)]
  postrank_declarations(
    targets = data.frame(criterion_id = crit, estimand = paste("Latent", crit, "of the postrank tutorial law"),
      entity_population = "Six fictional sites A to F", time_reference = "Static illustration; no observation period",
      units = "Illustrative standardized units"),
    context = list(cohort_id = "postrank-explorer-six-sites", data_version = "1",
      data_conditioning = "No observations; the target law is pr_tutorial$law (independent normals, SD .2)",
      model_summary = "Independent normal coordinates around the tutorial means"),
    provenance = list(producer = "postrank-explorer r-export/08_simulate.R", artifact_id = sprintf("six-sites-S%d-seed%d", S, seed),
      construction_note = "IID states from the pr-core seeded stream (mulberry32 + Box-Muller), rounded to 9 decimals"),
    origin = list(source_id = "pr-tutorial-law", fit_id = "no-model-fit", model_id = "independent-normal",
      source_format = "R array", source_artifact = "seeded_six() in r-export/08_simulate.R"),
    identification_note = "The specified law directly defines every labeled site target.",
    tie_justification = "Independent continuous normal coordinates rounded to 9 decimals; the script checks that no draw ties.",
    joint_generation = "Every row is one state of all sites and included criteria; all coordinates are independent.",
    sampling_provenance = sprintf("pr-core stream seed %d; IID states, no warmup or thinning.", seed))
}
as_draws <- function(a, ids, crit, seed) {
  dimnames(a) <- list(NULL, ids, crit)
  for (k in seq_along(crit)) for (s in seq_len(dim(a)[1])) stopifnot(!anyDuplicated(a[s, , k]))
  postrank_draws(a, regime = "iid", declarations = decl_six(length(crit), dim(a)[1], seed))
}
pf <- function(id, draws_obj, w, tau, z = 2) {
  values <- draws_obj$joint_draws$tensor$values                      # [draw, entity, criterion]
  ids <- draws_obj$entity_ids; crit <- draws_obj$criterion_ids
  f <- postrank_mc_fragility(draws_obj, settings = list(weights = setNames(w, crit), tau = tau), z = z)
  stopifnot(f$regime == "iid", f$mcse_method == "iid_sample_sd_over_sqrt_S", f$summary$mcse_unavailable == 0)
  tab <- f$pairs; tab$i <- match(tab$entity_i, ids) - 1L; tab$j <- match(tab$entity_j, ids) - 1L
  fr <- tab[tab$fragile, ]; fr <- fr[order(fr$i, fr$j), ]
  o <- o_fragile(values, tau, w, z)
  stopifnot(identical(lapply(o, as.integer), lapply(seq_len(nrow(fr)), function(r) as.integer(c(fr$i[r], fr$j[r])))),
            f$summary$fragile == nrow(fr))
  rt <- array(as.numeric(sprintf("%.15g", values)), dim(values))       # the 15-digit JSON draws give the same flags
  stopifnot(identical(o_fragile(rt, tau, w, z), o))
  rec <- o_fragile_record(values, tau, w, z)
  stopifnot(identical(lapply(rec$traced, unclass), lapply(seq_len(nrow(tab)), function(r) as.integer(c(tab$i[r], tab$j[r])))),
            identical(unclass(rec$flags), tab$fragile), identical(unclass(rec$betterDirection), tab$better_direction))
  check_close(rec$screenMargin, f$screen_margin, 0, "screen margin z/(2 sqrt(S - 1))")
  padd(row(paste0("fragilePairs-", id), "fragilePairs", list(draws = draws_json(values), tau = tau, w = vec(w), z = z),
           list(pairs = lapply(seq_len(nrow(fr)), function(r) vec(c(fr$i[r], fr$j[r]))), count = nrow(fr),
                screenMargin = f$screen_margin, traced = lapply(seq_len(nrow(tab)), function(r) vec(c(tab$i[r], tab$j[r]))),
                betterDirection = vec(tab$better_direction), weightedError = vec(tab$weighted_error), margin = vec(tab$margin),
                mcseTraced = vec(tab$mcse), flags = vec(tab$fragile),
                summary = list(pairs = f$summary$pairs, traced = f$summary$traced, fragile = f$summary$fragile,
                               fragileShare = f$summary$fragile_share, mcseUnavailable = f$summary$mcse_unavailable))))
  for (r in seq_len(nrow(tab))) {                                     # MCSE of every traced pair's weighted trace
    a <- if (tab$better_direction[r] == "i_ahead") tab$i[r] + 1L else tab$j[r] + 1L
    b <- if (tab$better_direction[r] == "i_ahead") tab$j[r] + 1L else tab$i[r] + 1L
    trace <- rowSums(sapply(seq_along(crit), function(k) w[k] * (values[, a, k] <= values[, b, k])))
    check_close(mean(trace), tab$weighted_error[r], 1e-15, "trace mean = weighted error")
    check_close(o_mcse(trace), tab$mcse[r], 1e-15, "base-R MCSE vs postrank_mc_fragility")
    padd(row(sprintf("mcse-%s-pair-%s-%s", id, tab$entity_i[r], tab$entity_j[r]), "mcse", list(trace = vec(trace)),
             list(mcse = tab$mcse[r])))
  }
  invisible(f)
}
toy <- postrank_toy
stopifnot(toy$joint_draws$sampling$regime == "iid")
ftoy <- pf("postrank_toy-w.6.4-tau.25", toy, c(0.6, 0.4), 0.25)
pf("postrank_toy-w.6.4-tau.25-z1", toy, c(0.6, 0.4), 0.25, z = 1)
ft3 <- pf("postrank_toy-w.6.4-tau.3", toy, c(0.6, 0.4), 0.3)          # 001 vs site C (d = .3125) is fragile
ft1 <- pf("postrank_toy-w.6.4-tau.1", toy, c(0.6, 0.4), 0.1)          # site-B vs site C (d = .075) is fragile
stopifnot(ft3$summary$fragile == 1L, ft1$summary$fragile == 1L)
d1000 <- seeded_six(20261030, 1000, cbind(six_m))
dr1 <- as_draws(d1000, LETTERS[1:6], "score_A", 20261030)
f1 <- pf("six-scoreA-S1000-seed20261030-tau.2", dr1, 1, 0.2)
stopifnot(any(f1$pairs$entity_i == "A" & f1$pairs$entity_j == "B" & f1$pairs$fragile))   # P-09: A-B on score A is fragile
d2 <- seeded_six(20261031, 500, cbind(six_m, six_mB))
dr2 <- as_draws(d2, LETTERS[1:6], c("score_A", "score_B"), 20261031)
pf("six-K2-S500-seed20261031-w.5.5-tau.2", dr2, c(0.5, 0.5), 0.2)

# postrank_iid_bounds(): raw_radius = sqrt((log 2 + log M - log alpha_k)/(2 S_k)) against envelopeRadius(form = "package").
pb <- function(id, draws_obj, alloc) {
  crit <- draws_obj$criterion_ids; S <- draws_obj$joint_draws$tensor$shape$S
  b <- postrank_iid_bounds(draws_obj, alpha = sum(alloc), alpha_by_criterion = setNames(alloc, crit),
    design = list(sample_sizes_fixed_before_sampling = TRUE, alpha_fixed_before_sampling = TRUE, adaptive_stopping = FALSE,
      planned_sample_sizes = setNames(rep(as.integer(S), length(crit)), crit),
      declaration_note = "Fixed before generation in r-export/08_simulate.R (the toy's are fixed by its producer)"))
  for (k in seq_along(crit)) {
    check_close(b$raw_radius[[k]], o_radius(b$M, S, alloc[k], "package"), 1e-15, paste("postrank_iid_bounds vs base R", id))
    padd(row(sprintf("envelopeRadius-postrank_iid_bounds-%s-%s", id, crit[k]), "envelopeRadius",
             list(M = b$M, S = S, alpha = alloc[k], form = "package"), list(radius = unname(b$raw_radius[[k]]))))
  }
  invisible(b)
}
pb("postrank_toy", toy, c(0.025, 0.025))
b1 <- pb("six-scoreA-S1000", dr1, 0.05)
check_close(b1$raw_radius, 0.0566, 5e-5, "P-09: package radius .0566 at M = 15, S = 1,000")
pb("six-K2-S500", dr2, c(0.02, 0.03))

write_golden("postrank-simulate", prow, generator = "r-export/08_simulate.R", uses_postrank = TRUE)
cat("postrank-simulate:", length(prow), "rows\n")
