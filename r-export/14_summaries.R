# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for the Step 5.14 Part 1 summaries (engine/API.md "Step 5.14: Part 1 summaries").
#   oracle-summaries  base R only; postrank is not loaded. summaryStats, meanSquaredDistance, fartherCount (L-04),
#                     intervalOverlapTally (L-06), rankIntervals (L-09), leagueReplays (L-03), unitRelationCounts (L-01).
# Written from engine/API.md (definitions, tie rules, cut expressions) and the SR-06 league specification; the seeded
# parts use the stream reimplementation r-export/_rng.R. Indices are 1-based here and 0-based in the golden rows.
# Every numeric input is first rounded to the 15-significant-digit text the golden file stores (r15), and every
# expected value is computed from those rounded inputs, so the engine and R see the same doubles.
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
r15 <- function(x) { y <- as.numeric(sprintf("%.15g", x)); stopifnot(identical(as.numeric(sprintf("%.15g", y)), y)); y }
gap_ok <- function(x, tol = 1e-9) { s <- sort(x); stopifnot(length(s) < 2 || min(diff(s)) > tol); invisible(TRUE) }
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# ---- the SR-06 league (engine/API.md "Simulated league specification") --------------------------------------------
lg_i <- 1:30
lg <- list(ids = sprintf("U%02d", lg_i), size = rep(c(16, 64, 256), 10), group = rep(c("small", "medium", "large"), 10))
lg$se <- 0.8 / sqrt(lg$size)
lg$rank <- (19 * lg_i) %% 31
lg$theta <- 0.15 * qnorm((lg$rank - 0.5) / 30)
seed0 <- 20261030
draw <- function(seed) lg$theta + lg$se * prx_normals(seed, 30)
post <- function(est, se, sigma) { B <- sigma^2 / (sigma^2 + se^2); list(mean = B * est, sd = sqrt(B) * se) }

theta <- r15(lg$theta)
est <- r15(draw(seed0))                                   # drawLeague(20261030).estimate
p15 <- post(est, lg$se, 0.15); pm15 <- r15(p15$mean); sd15 <- r15(p15$sd)
p05 <- post(est, lg$se, 0.05); pm05 <- r15(p05$mean); sd05 <- r15(p05$sd)

# ---- summaryStats(values) -> { n, mean, sd } (R mean() and sd(); sd null when n = 1) --------------------------------
o_stats <- function(x) list(n = length(x), mean = mean(x), sd = if (length(x) > 1) sd(x) else NA_real_)
ss <- function(id, x) { r <- o_stats(x); add(row(paste0("summaryStats-", id), "summaryStats", list(values = vec(x)), r)); invisible(r) }
s_est <- ss("league-seed20261030-estimate", est)
s_th <- ss("league-theta", theta)
s_p15 <- ss("league-seed20261030-postmean-prior.15", pm15)
s_p05 <- ss("league-seed20261030-postmean-prior.05", pm05)
check_close(c(s_est$sd, s_th$sd, s_p15$sd, s_p05$sd),
            c(.16206975093452108, .14937466480710787, .09819488199364021, .036601609710443433), 1e-14,
            "API.md L-04 spreads (.162 / .149 / .098 / .037)")
ss("four-integers", c(1, 2, 3, 4))
ss("one-value", 0.25)
ss("decimals-with-negative", c(0.1, -0.35, 0.2, 0.05, 1.7))
ss("constant", c(0.3, 0.3, 0.3))

# ---- meanSquaredDistance(a, b) = mean((a - b)^2) -------------------------------------------------------------------
msd <- function(id, a, b) { v <- mean((a - b)^2)
  add(row(paste0("meanSquaredDistance-", id), "meanSquaredDistance", list(a = vec(a), b = vec(b)), list(value = v))); invisible(v) }
m_est <- msd("league-seed20261030-estimate-vs-theta", est, theta)
m_15 <- msd("league-seed20261030-postmean-prior.15-vs-theta", pm15, theta)
m_05 <- msd("league-seed20261030-postmean-prior.05-vs-theta", pm05, theta)
check_close(c(m_est, m_15, m_05), c(.016346498404655223, .009579415799948237, .014820079478793775), 1e-15,
            "API.md L-04 mean squared distances (.0163 / .0096 / .0148)")
msd("hand-three", c(1, 2, 3), c(1, 0, 5))
stopifnot(mean((c(1, 2, 3) - c(1, 0, 5))^2) == 8 / 3)
msd("one-pair", 0.75, -0.25)

# ---- fartherCount(estimates, posteriorMeans, truth): |m_i - theta_i| > |y_i - theta_i| (strict) ---------------------
o_farther <- function(y, m, th, margin = 1e-9) {
  d <- abs(m - th) - abs(y - th)
  if (!is.null(margin)) stopifnot(all(abs(d) > margin))      # no unit on the boundary (league rows)
  f <- abs(m - th) > abs(y - th)
  list(count = sum(f), units = vec(which(f) - 1L), flags = vec(f))
}
fc <- function(id, y, m, th, margin = 1e-9) { r <- o_farther(y, m, th, margin)
  add(row(paste0("fartherCount-", id), "fartherCount", list(estimates = vec(y), posteriorMeans = vec(m), truth = vec(th)), r)); invisible(r) }
f15 <- fc("league-seed20261030-prior.15", est, pm15, theta)
f05 <- fc("league-seed20261030-prior.05", est, pm05, theta)
stopifnot(identical(lg$ids[unclass(f15$units) + 1L], c("U01", "U03", "U06", "U08", "U13", "U15", "U16", "U18", "U21", "U23", "U24", "U26", "U27", "U29")),
          identical(lg$ids[unclass(f05$units) + 1L], c("U01", "U02", "U03", "U05", "U06", "U08", "U13", "U15", "U16", "U17", "U18", "U21", "U23", "U24", "U26", "U27", "U29")))
mg15 <- min(abs(abs(pm15 - theta) - abs(est - theta)))
check_close(mg15, 9.1e-4, 5e-5, "API.md: smallest farther margin 9.1e-4 at prior SD .15")
# Equal distances are not farther (exact binary fractions): unit 1 equal, unit 2 equal, unit 3 farther, unit 4 nearer.
fc("hand-equal-distance-not-farther", c(1, 0.25, 0.5, 2), c(0, 0.25, -1, 1.5), c(0.5, 0, 0, 1), margin = NULL)
fc("hand-none-farther", c(1, -1), c(0.5, -0.5), c(0, 0), margin = NULL)

# ---- intervalOverlapTally(lower, upper, pi, { threshold }) -----------------------------------------------------------
o_dm <- function(m, s) {                                     # directionMatrix: pi[i, j] = Pr(theta_i > theta_j), independent normals
  n <- length(m); p <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) p[i, j] <- pnorm((m[i] - m[j]) / sqrt(s[i]^2 + s[j]^2))
  p
}
o_tally <- function(lower, upper, pi, threshold = 0.9, margins = FALSE) {
  n <- length(lower); cls <- character(); firsts <- integer(); bp <- NULL; best <- NULL
  ov_m <- c(); p_m <- c(); dir_m <- c()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {                # row-major upper triangle
    a <- max(lower[i], lower[j]); b <- min(upper[i], upper[j]); ov <- a < b
    if (pi[i, j] >= pi[j, i]) { f <- i; s <- j; p <- pi[i, j] } else { f <- j; s <- i; p <- pi[j, i] }
    cl <- if (!ov) "apart" else if (p > threshold) "high" else "low"
    cls <- c(cls, cl); firsts <- c(firsts, f - 1L)
    ov_m <- c(ov_m, abs(b - a)); dir_m <- c(dir_m, abs(pi[i, j] - pi[j, i])); if (ov) p_m <- c(p_m, abs(p - threshold))
    if (ov && (is.null(bp) || p > bp)) { bp <- p; best <- list(first = f - 1L, second = s - 1L, pi = p) }
  }
  if (margins) {                                             # the league rows: no decision within 1e-9 of its boundary
    stopifnot(min(ov_m) > 1e-9, min(p_m) > 1e-9, min(dir_m) > 1e-9)
  }
  list(apart = sum(cls == "apart"), overlapping = sum(cls != "apart"), high = sum(cls == "high"), low = sum(cls == "low"),
       best = best, classes = vec(cls), firsts = vec(firsts), ovMargin = min(ov_m), pMargin = if (length(p_m)) min(p_m) else NA)
}
tally_rows <- list()
for (cfg in list(list(".15", pm15, sd15), list(".05", pm05, sd05))) for (level in c(0.90, 0.95)) {
  m <- cfg[[2]]; s <- cfg[[3]]; z <- qnorm((1 + level) / 2)
  lo <- r15(m - z * s); up <- r15(m + z * s)                 # normalInterval(mean, sd, level)
  pim <- o_dm(m, s)
  r <- o_tally(lo, up, pim, 0.9, margins = TRUE)
  # The best pick is not a near tie (runner-up among overlapping pairs more than 1e-12 below).
  ovp <- c(); for (i in 1:29) for (j in (i + 1):30) if (max(lo[i], lo[j]) < min(up[i], up[j])) ovp <- c(ovp, max(pim[i, j], pim[j, i]))
  stopifnot(sort(ovp, decreasing = TRUE)[1] - sort(ovp, decreasing = TRUE)[2] > 1e-12)
  id <- sprintf("intervalOverlapTally-league-seed20261030-prior%s-level%s-threshold.9", cfg[[1]], sub("^0", "", sprintf("%.2f", level)))
  tally_rows[[id]] <- r
  add(row(id, "intervalOverlapTally", list(lower = vec(lo), upper = vec(up), means = vec(m), sds = vec(s), threshold = 0.9),
          r[c("apart", "overlapping", "high", "low", "best", "classes", "firsts")]))
}
chk_t <- function(id, cnt, f, s, p) { r <- tally_rows[[id]]
  stopifnot(identical(c(r$apart, r$overlapping, r$high, r$low), as.integer(cnt)), r$best$first == f, r$best$second == s)
  check_close(r$best$pi, p, 1e-14, paste("API.md L-06 best pi", id)) }
chk_t("intervalOverlapTally-league-seed20261030-prior.15-level.90-threshold.9", c(36, 399, 88, 311), 12, 4, .98781943458425)
chk_t("intervalOverlapTally-league-seed20261030-prior.15-level.95-threshold.9", c(22, 413, 102, 311), 2, 14, .9969515549415986)
chk_t("intervalOverlapTally-league-seed20261030-prior.05-level.90-threshold.9", c(8, 427, 58, 369), 29, 17, .9895841657726948)
chk_t("intervalOverlapTally-league-seed20261030-prior.05-level.95-threshold.9", c(2, 433, 64, 369), 5, 17, .9963746342103851)
check_close(c(tally_rows[[1]]$ovMargin, tally_rows[[1]]$pMargin), c(8.9e-5, 4.1e-4), 5e-6, "API.md: smallest margins at prior SD .15, level .90")
# Hand cases with an explicit pi (diagonal null, not read): touching intervals do not overlap; p equal to the
# threshold is "low" (strict); an equal pair (pi_ij = pi_ji) is oriented i first; equal best p keeps the earliest pair.
pm3 <- function(p01, p02, p12) { p <- matrix(NA_real_, 3, 3); p[1, 2] <- p01; p[2, 1] <- 1 - p01; p[1, 3] <- p02; p[3, 1] <- 1 - p02
  p[2, 3] <- p12; p[3, 2] <- 1 - p12; p }
hand <- function(id, lo, up, pi, threshold = NULL) {
  r <- o_tally(lo, up, pi, if (is.null(threshold)) 0.9 else threshold)
  a <- list(lower = vec(lo), upper = vec(up), pi = pi); if (!is.null(threshold)) a$threshold <- threshold
  add(row(paste0("intervalOverlapTally-", id), "intervalOverlapTally", a, r[c("apart", "overlapping", "high", "low", "best", "classes", "firsts")]))
  invisible(r)
}
lo3 <- c(0, 1, 0.5); up3 <- c(1, 2, 1.5)                     # (0,1) touch at 1: apart; (0,2) and (1,2) overlap
h1 <- hand("hand-touch-threshold-equal-default", lo3, up3, pm3(0.75, 0.9, 0.5))
stopifnot(identical(unclass(h1$classes), c("apart", "low", "low")), h1$best$first == 0, h1$best$second == 2, h1$best$pi == 0.9,
          identical(unclass(h1$firsts), c(0L, 0L, 1L)))
h2 <- hand("hand-reversed-high-threshold.8", lo3, up3, pm3(0.75, 0.125, 0.875), threshold = 0.8)
stopifnot(identical(unclass(h2$classes), c("apart", "high", "high")), identical(unclass(h2$firsts), c(0L, 2L, 1L)),
          h2$best$first == 2, h2$best$second == 0, h2$best$pi == 0.875)          # equal p .875: the earlier pair (0,2) wins
h3 <- hand("hand-no-overlap-best-null", c(0, 2), c(1, 3), matrix(c(NA, 0.3, 0.7, NA), 2, 2, byrow = TRUE))
stopifnot(is.null(h3$best), h3$apart == 1, h3$firsts == 1)

# ---- rankIntervals(pTop, { level }) -------------------------------------------------------------------------------
# tail = (1 - level)/2; loCut = tail - tieTol; hiCut = (1 - tail) - tieTol (1 - tail first); tieTol = 1e-12.
# lower[i] = smallest r with pTop[r, i] >= loCut, upper[i] = smallest r with pTop[r, i] >= hiCut; NA (null) if none.
o_rank_int <- function(pTop, level, tieTol = 1e-12) {
  tail <- (1 - level) / 2; lo_cut <- tail - tieTol; hi_cut <- (1 - tail) - tieTol
  first <- function(col, cut) { r <- which(col >= cut); if (length(r)) r[1] else NA_integer_ }
  list(lower = vec(apply(pTop, 2, first, cut = lo_cut)), upper = vec(apply(pTop, 2, first, cut = hi_cut)))
}
ri <- function(id, pTop, level) { r <- o_rank_int(pTop, level)
  add(row(paste0("rankIntervals-", id), "rankIntervals", list(pTop = unname(pTop), level = level), r)); invisible(r) }
# Exact rank law (theory book ch. 19, as rankSummaries): pTop[k, i] = Pr(R_i <= k), R_i = 1 + #{j: theta_j > theta_i}.
o_ptop_law <- function(states, masses) {
  V <- do.call(rbind, states); p <- masses / sum(masses); n <- ncol(V)
  R <- t(apply(V, 1, function(v) { stopifnot(!anyDuplicated(v)); vapply(v, function(u) 1 + sum(v > u), 0) }))
  t(sapply(seq_len(n), function(k) colSums(p * (R <= k))))
}
pt19 <- o_ptop_law(list(c(20, 4, 3), c(0, 4, 3)), c(3L, 7L))
r19 <- ri("tb19-law3-level.9", pt19, 0.9)
stopifnot(identical(unclass(r19$lower), c(1L, 1L, 2L)), identical(unclass(r19$upper), c(3L, 2L, 3L)))
r19t <- ri("tb19-law3-top2-rows-level.9", pt19[1:2, , drop = FALSE], 0.9)   # R = 2 rows: some upper ends are null
stopifnot(identical(unclass(r19t$upper), c(NA, 2L, NA)))
ri("tb19-law3-level.5", pt19, 0.5)
# Exact hits: shares 1/20 = .05 and 19/20 = .95 lie on the cuts and count (rows sum to r, a valid rank law).
pt_hit <- rbind(c(1, 0, 19), c(19, 1, 20), c(20, 20, 20)) / 20
rh <- ri("exact-hits-S20-level.9", pt_hit, 0.9)
stopifnot(identical(unclass(rh$lower), c(1L, 2L, 1L)), identical(unclass(rh$upper), c(2L, 3L, 1L)))
ri("exact-hits-S20-level.95", pt_hit, 0.95)
# League posterior at prior SD .15, Monte Carlo (rankSummariesMC(mean, sd, 4000, 1)): theta[s, i] = m_i + s_i z[(s - 1) n + i],
# z = normals(1, 4000 n); pTop[k, i] = #{s: R_si <= k} / S, an exact share.
o_ptop_mc <- function(m, s, S, seed) {
  n <- length(m); z <- prx_normals(seed, S * n)
  a <- matrix(m, S, n, byrow = TRUE) + matrix(s, S, n, byrow = TRUE) * matrix(z, S, n, byrow = TRUE)
  R <- t(apply(a, 1, function(v) {
    d <- abs(outer(v, v, "-")); diag(d) <- Inf
    stopifnot(all(d > 1e-9 * max(1, max(abs(v)))))          # tie-free with a margin: ulp-level normals cannot move a rank
    vapply(v, function(u) 1 + sum(v > u), 0)
  }))
  t(sapply(seq_len(n), function(k) colSums(R <= k) / S))
}
pt_lg <- o_ptop_mc(pm15, sd15, 4000, 1)
stopifnot(all(abs(rowSums(pt_lg) - seq_len(30)) < 1e-9))
rl <- ri("league-seed20261030-prior.15-mc4000-seed1-level.9", pt_lg, 0.9)
stopifnot(identical(unclass(rl$lower), as.integer(c(2, 12, 3, 2, 23, 3, 4, 1, 9, 1, 10, 14, 1, 7, 16, 1, 5, 22, 5, 16, 1, 4, 7, 4, 4, 1, 6, 9, 1, 5))),
          identical(unclass(rl$upper), as.integer(c(27, 29, 15, 28, 30, 16, 29, 16, 22, 24, 29, 26, 24, 27, 27, 27, 26, 30, 29, 30, 10, 29, 27, 17, 29, 11, 20, 30, 18, 19))))
n_hits <- sum(pt_lg == 0.05 | pt_lg == 0.95)                 # shares exactly on a cut (recorded below)
rows[[length(rows)]]$record <- list(exactCutHits = n_hits)

# ---- leagueReplays(seed, { replays, k, topK }) --------------------------------------------------------------------
o_extreme <- function(score, group, k) { gap_ok(score); grp <- c("small", "medium", "large")
  top <- order(-score)[seq_len(k)]; bot <- order(score)[seq_len(k)]
  cnt <- function(idx) setNames(as.list(vapply(grp, function(g) sum(group[idx] == g), 0)), grp)
  t <- cnt(top); b <- cnt(bot); list(top = t, bottom = b, total = setNames(as.list(unlist(t) + unlist(b)), grp)) }
o_topk <- function(a, b, k) { gap_ok(a); gap_ok(b); length(intersect(order(-a)[seq_len(k)], order(-b)[seq_len(k)])) }
o_misordered <- function(a, b) { gap_ok(a); gap_ok(b); s <- 0
  for (i in 1:(length(a) - 1)) for (j in (i + 1):length(a)) s <- s + ((a[i] - a[j]) * (b[i] - b[j]) < 0); s }
o_replays <- function(seed, R, k, topK) {
  seeds <- seed + seq_len(R); ex <- list(); to <- numeric(R); mo <- numeric(R)
  for (r in seq_len(R)) { e <- draw(seeds[r]); ex[[r]] <- o_extreme(e, lg$group, k)
    to[r] <- o_topk(e, lg$theta, topK); mo[r] <- o_misordered(e, lg$theta) }
  side <- function(nm) lapply(ex, `[[`, nm)
  tot <- sapply(c("small", "medium", "large"), function(g) sum(vapply(ex, function(x) x$total[[g]], 0)))
  list(seeds = vec(seeds), extremeTotal = side("total"), extremeTop = side("top"), extremeBottom = side("bottom"),
       topOverlap = vec(to), misordered = vec(mo),
       mean = list(extreme = as.list(tot / R), topOverlap = sum(to) / R, misordered = sum(mo) / R))
}
lr <- function(id, seed, R, k, topK) { r <- o_replays(seed, R, k, topK)
  add(row(paste0("leagueReplays-", id), "leagueReplays", list(seed = seed, replays = R, k = k, topK = topK), r)); invisible(r) }
L3 <- lr("seed20261030-R20-k5-top10", seed0, 20, 5, 10)
api_l03 <- matrix(c(6,2,2,6,116, 4,5,1,8,90, 4,4,2,7,80, 5,2,3,8,76, 4,3,3,7,98, 6,3,1,6,82, 3,4,3,8,87, 3,4,3,8,65,
                    5,3,2,8,73, 6,3,1,8,94, 2,5,3,9,62, 5,4,1,9,73, 5,3,2,6,97, 6,3,1,7,86, 3,5,2,7,105, 4,4,2,8,79,
                    4,4,2,6,97, 3,5,2,8,70, 5,3,2,7,77, 4,4,2,8,71), ncol = 5, byrow = TRUE)
mine <- cbind(t(sapply(L3$extremeTotal, unlist)), unclass(L3$topOverlap), unclass(L3$misordered))
stopifnot(identical(unname(mine), api_l03))
check_close(c(unlist(L3$mean$extreme), L3$mean$topOverlap, L3$mean$misordered), c(4.35, 3.65, 2, 7.45, 83.9), 0, "API.md L-03 means")
lr("seed7-R3-k3-top5", 7, 3, 3, 5)
lr("seed20261030-R1-k1-top1", seed0, 1, 1, 1)

# ---- unitRelationCounts(g) ----------------------------------------------------------------------------------------
o_urc <- function(g) {
  n <- length(g)
  above <- vapply(seq_len(n), function(i) sum(g[i] < g[-i]), 0L)
  below <- vapply(seq_len(n), function(i) sum(g[i] > g[-i]), 0L)
  withheld <- vapply(seq_len(n), function(i) sum(g[-i] == g[i]), 0L)
  stopifnot(all(above + below + withheld == n - 1))
  list(partners = n - 1L, above = vec(above), below = vec(below), stated = vec(above + below), withheld = vec(withheld))
}
urc <- function(id, g) { r <- o_urc(g); add(row(paste0("unitRelationCounts-", id), "unitRelationCounts", list(g = vec(g)), r)); invisible(r) }
u5 <- urc("example-21231", c(2, 1, 2, 3, 1))
stopifnot(identical(unclass(u5$above), c(1L, 3L, 1L, 0L, 3L)), identical(unclass(u5$below), c(2L, 0L, 2L, 4L, 0L)),
          identical(unclass(u5$withheld), c(1L, 1L, 1L, 0L, 1L)))
urc("nonconsecutive-labels", c(10, -3, 10, 7, 42, 7))
urc("all-one-grade", c(5, 5, 5, 5))
urc("strict-reversed", c(4, 3, 2, 1))
urc("single-unit", 9)
krw <- jsonlite::fromJSON(file.path(released_dir, "case-krw.json"), simplifyVector = TRUE)$tables$reports
stopifnot(length(krw$id) == 97, length(krw$race_card) == 97, length(krw$gender_card) == 97)
ur <- urc("krw-race-card", as.integer(krw$race_card))
ug <- urc("krw-gender-card", as.integer(krw$gender_card))
stopifnot(ur$partners == 96, ug$partners == 96, ur$stated[15] == 95, ur$withheld[15] == 1, ur$stated[62] == 95, ur$withheld[62] == 1,
          ug$stated[95] == 96, ug$withheld[95] == 0, identical(tabulate(krw$race_card), c(2L, 81L, 14L)))

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
# G-07 grade averages of the posterior means: the six sites' card 1/1/2/2/3/3 (score A) and the 30-site poverty card
# (at most 4 grades, tau = .25), grade by grade, units in site order.
source("r-export/15_part2.R")
for (h in 1:3) ss(sprintf("six-scoreA-card112233-grade%d", h), p2$six$mean[c(1, 1, 2, 2, 3, 3) == h])
for (h in 1:4) ss(sprintf("thirty-poverty-card-cap4-tau.25-grade%d", h), p2$th$mean[p2$th$card == h])

assert_no_postrank()
write_golden("oracle-summaries", rows, generator = "r-export/14_summaries.R", uses_postrank = FALSE)
cat("oracle-summaries:", length(rows), "rows\n")
