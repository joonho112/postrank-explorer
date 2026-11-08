# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for the browser MIP adapter mipSolve (engine/API.md "mip.ts", Step 2.11; solver bundle only).
#   postrank-mip  postrank 1.1.0 from the project library, backend "highs" chosen explicitly, unrestricted family
#                 (G_max = n), staged strategy, postrank_control(time_limit = 60, threads = 1L,
#                 absolute_risk_gap = 1e-10), report_card = FALSE, fragility = FALSE (as spikes/solver/compare.R, with
#                 the package's stopping gap tightened from its default 1e-8 to 1e-10 so that every golden optimum is
#                 within 1e-10 of the best bound, below the 1e-9 parity tolerance). Gurobi is never used.
# Every input array is rounded to 15 significant digits (r15, the JSON round trip) before the package sees it and is
# passed through postrank_probabilities(), so the package and the engine solve the same numbers.
# Problems (K = 1 and K = 2; tau in {.15, .25, .40} unless stated):
#   seeded      n = 10, 20. Means m[i, k] = z[(k - 1) n + i] with z = prx_normals(seed, n K) and SDs
#               s[i, k] = .15 + .45 u[(k - 1) n + i] with u = prx_uniforms(seed + 1, n K) (r-export/_rng.R);
#               e[i, j, k] = pnorm((m[j, k] - m[i, k]) / sqrt(s[i, k]^2 + s[j, k]^2)). Seeds (normals, SDs):
#               n10 K1 (21101, 21102), n10 K2 (21103, 21104), n20 K1 (21105, 21106), n20 K2 (21107, 21108).
#               K = 2 uses w = (.6, .4).
#   branch      the same construction, n = 12, K = 2, seeds (21203, 21204), w = (.5, .5): at tau .40 the LP
#               relaxation is fractional (found by a seed scan), so a solver must branch; the package's staged LP
#               bound does not certify it and its MIP stage does.
#   gauss30     n = 15, 25: pr_example_gaussian$e restricted to its first n sites; K = 1 poverty, K = 2 poverty and
#               frl with w = (.5, .5).
#   six         the six tutorial sites: pr_tutorial$one$e (score A) and pr_tutorial$two$e (w = (.5, .5)).
#   neartie     n = 7, K = 1, units A-G. A and B sit far above the rest (means 4 and 4 - d, SD .3); the five others
#               have means prx_normals(21109, 5) and SD .2. Whether A is stated above B changes only the pair (A, B),
#               so the two best reports differ in risk by |e_AB - tau| / M exactly (M = 21).
#               split (tau .25): e_AB = .25 - 1e-6, the split wins by 4.76e-8 (unique beyond the 1e-9 tolerance).
#               sub   (tau .40): e_AB = .40 + 1e-12, the merge wins by 4.8e-14 (below the tolerance: two reports
#                     tie within it); units D and E also have nearly equal laws (means 1e-9 apart).
# Base-R checks for every problem: oracle_risk() (r-export/_oracle.R) of the package's grade equals the package
# risk (1e-12); for n <= 7 the full canonical family is enumerated with oracle_reports(): the package risk equals
# the minimum (1e-12) and the optimum is unique when no other report is within 1e-9 of it (unique_known = true; the
# package grade must then be the minimizer). The grade is compared only for unique_known rows; larger problems are
# not enumerated and are marked unique_known = false. Timings are printed, never written to the golden file.
# Diagnostic (recorded, not compared): the LP relaxation of the spike's formulation (spikes/solver/mip-core.js:
# z_ab = 1{g_a <= g_b}, z_ab + z_ba >= 1, z_ab + z_bc - z_ac <= 1, minimize sum z_ab (tau - ebar_ba), risk =
# 1 - tau + obj/M) solved with the highs R package (threads 1), not postrank: lpBound (risk units, <= the package
# risk) and lpFractional (largest min(z, 1 - z)). Rows with lpFractional > 0 need branch-and-bound.
# Conventions (engine/API.md): grade 1 = highest priority, canonical labels 1..G; "i above j is stated" when
# g[i] < g[j]; E = { ids, criteria, e } with e[k][i][j] = Pr(theta_ik <= theta_jk) and a null (NaN) diagonal;
# risk R = tau + M^-1 sum_{g_i < g_j} (ebar_ij - tau), ebar = sum_k w_k e_k. Every row names args$fn = "mipSolve".
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R"); source("r-export/_rng.R")
load_postrank()

# ---- JSON shaping and checks --------------------------------------------------------------------------------------
vec <- function(x) I(unname(x))
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(a[, , k]))
earr <- function(e, ids, criteria) list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))
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
fmt_tau <- function(t) sub("^0", "", sprintf("%.2f", t))
fmt_w <- function(w) paste0("w", paste(sub("^0", "", sprintf("%g", w)), collapse = ""))
TAUS <- c(0.15, 0.25, 0.40)
UNIQUE_TOL <- 1e-9          # parity tolerance on risk; an optimum is unique when the runner-up is farther than this
PKG_GAP <- 1e-10            # package stopping gap (risk units)

normal_e <- function(means, sds) {
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
weighted_e <- function(e, w) { eb <- 0 * e[, , 1]; for (k in seq_along(w)) eb <- eb + w[k] * e[, , k]; eb }
is_canonical <- function(g) { u <- sort(unique(g)); length(u) >= 1 && all(u == seq_along(u)) }
disclosed <- function(g) { s <- outer(g, g, "!="); sum(s[upper.tri(s)]) }

# Risks of every canonical report (rows of G) under ebar, as oracle_risk() but vectorized over reports.
enum_risks <- function(G, ebar, tau) {
  n <- ncol(G); M <- n * (n - 1) / 2; E <- numeric(nrow(G)); N <- numeric(nrow(G))
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    lt <- G[, i] < G[, j]; gt <- G[, i] > G[, j]
    E <- E + ebar[i, j] * lt + ebar[j, i] * gt; N <- N + (lt | gt)
  }
  (E + tau * (M - N)) / M
}
# LP relaxation of the z formulation (diagnostic only).
z_lp <- function(ebar, tau) {
  n <- nrow(ebar); M <- n * (n - 1) / 2
  idx <- matrix(0L, n, n); idx[row(idx) != col(idx)] <- seq_len(n * (n - 1))
  ab <- which(row(idx) != col(idx), arr.ind = TRUE)                    # column (a, b) of variable idx[a, b]
  cost <- tau - ebar[cbind(ab[, 2], ab[, 1])]
  pr <- which(upper.tri(idx), arr.ind = TRUE); np <- nrow(pr)
  tri <- as.matrix(expand.grid(a = 1:n, b = 1:n, c = 1:n))
  tri <- tri[tri[, 1] != tri[, 2] & tri[, 2] != tri[, 3] & tri[, 1] != tri[, 3], , drop = FALSE]; nt <- nrow(tri)
  rr <- np + seq_len(nt)
  A <- Matrix::sparseMatrix(i = c(seq_len(np), seq_len(np), rr, rr, rr),
                            j = c(idx[pr], idx[pr[, 2:1]], idx[tri[, 1:2]], idx[tri[, 2:3]], idx[tri[, c(1, 3)]]),
                            x = c(rep(1, 2 * np), rep(1, 2 * nt), rep(-1, nt)), dims = c(np + nt, n * (n - 1)))
  s <- highs::highs_solve(L = cost, lower = rep(0, n * (n - 1)), upper = rep(1, n * (n - 1)), A = A,
                          lhs = c(rep(1, np), rep(-Inf, nt)), rhs = c(rep(Inf, np), rep(1, nt)),
                          types = rep("C", n * (n - 1)),
                          control = highs::highs_control(threads = 1L, log_to_console = FALSE))
  stopifnot(identical(s$status_message, "Optimal"))
  z <- s$primal_solution
  list(bound = 1 - tau + s$objective_value / M, frac = max(pmin(z, 1 - z)))
}
families <- list()
family_of <- function(n) {
  key <- as.character(n)
  if (is.null(families[[key]])) families[[key]] <<- oracle_reports(n)
  families[[key]]
}

# ---- problems -------------------------------------------------------------------------------------------------------
problems <- list()
add_problem <- function(key, ids, criteria, e, w, taus, description) {
  stopifnot(identical(dim(e), c(length(ids), length(ids), length(criteria))), length(w) == length(criteria),
            all(w >= 0), sum(w) == 1, all(is.na(e[cbind(rep(seq_along(ids), length(criteria)), rep(seq_along(ids),
            length(criteria)), rep(seq_along(criteria), each = length(ids)))])))
  e <- r15(e)
  for (k in seq_along(criteria)) {                                     # reverse complements within 1e-12 (package)
    m <- e[, , k]; check_close(m[upper.tri(m)] + t(m)[upper.tri(m)], rep(1, sum(upper.tri(m))), 1e-14,
                               paste("reverse complements", key, criteria[k]))
  }
  problems[[length(problems) + 1L]] <<- list(key = key, ids = ids, criteria = criteria, e = e, w = w, taus = taus,
                                             description = description)
}

# Seeded normal laws.
seeded <- list(list(n = 10, K = 1, seed = 21101, w = 1), list(n = 10, K = 2, seed = 21103, w = c(0.6, 0.4)),
               list(n = 20, K = 1, seed = 21105, w = 1), list(n = 20, K = 2, seed = 21107, w = c(0.6, 0.4)),
               list(n = 12, K = 2, seed = 21203, w = c(0.5, 0.5), branch = TRUE))
for (s in seeded) {
  z <- prx_normals(s$seed, s$n * s$K); u <- prx_uniforms(s$seed + 1, s$n * s$K)
  means <- matrix(z, s$n, s$K); sds <- matrix(0.15 + 0.45 * u, s$n, s$K)
  criteria <- if (s$K == 1) "score" else c("k1", "k2")
  w <- s$w
  add_problem(sprintf("%s%d-n%d-K%d%s", if (isTRUE(s$branch)) "branch" else "seeded", s$seed, s$n, s$K,
                      if (s$K == 2) paste0("-", fmt_w(w)) else ""),
              sprintf("U%02d", seq_len(s$n)), criteria, normal_e(means, sds), w, TAUS,
              sprintf("independent normals: means prx_normals(%d, %d), SDs .15 + .45 prx_uniforms(%d, %d)",
                      s$seed, s$n * s$K, s$seed + 1, s$n * s$K))
}

# pr_example_gaussian, first n sites.
g30 <- pr_example_gaussian
stopifnot(identical(g30$criterion_ids, c("poverty", "frl", "snap")), dim(g30$e)[1] == 30)
for (n in c(15, 25)) for (K in 1:2) {
  ks <- seq_len(K); w <- if (K == 1) 1 else c(0.5, 0.5)
  add_problem(sprintf("gauss30first%d-n%d-K%d%s", n, n, K, if (K == 2) paste0("-", fmt_w(w)) else ""),
              g30$entity_ids[seq_len(n)], g30$criterion_ids[ks],
              unname(g30$e[seq_len(n), seq_len(n), ks, drop = FALSE]), w, TAUS,
              sprintf("pr_example_gaussian$e, first %d sites, criteria %s", n,
                      paste(g30$criterion_ids[ks], collapse = ", ")))
}

# Six tutorial sites.
six_ids <- pr_tutorial$one$entity_ids
stopifnot(identical(six_ids, LETTERS[1:6]), identical(pr_tutorial$two$criterion_ids, c("score_A", "score_B")))
add_problem("six-A-n6-K1", six_ids, "score_A", unname(pr_tutorial$one$e), 1, TAUS, "pr_tutorial$one$e (score A)")
add_problem("six-AB-n6-K2-w.5.5", six_ids, c("score_A", "score_B"), unname(pr_tutorial$two$e), c(0.5, 0.5), TAUS,
            "pr_tutorial$two$e (scores A and B)")

# Near ties (n = 7, K = 1).
nt_rest <- prx_normals(21109, 5)
neartie <- function(eAB, de_gap) {
  d <- -sqrt(0.3^2 + 0.3^2) * qnorm(eAB)                               # e_AB = pnorm(-d / sqrt(.18))
  means <- c(4, 4 - d, nt_rest); if (!is.null(de_gap)) means[5] <- means[4] - de_gap
  e <- normal_e(cbind(means), cbind(c(0.3, 0.3, rep(0.2, 5))))
  stopifnot(abs(e[1, 2, 1] - eAB) < 1e-14)
  e
}
add_problem("neartie-split-n7-K1", LETTERS[1:7], "score", neartie(0.25 - 1e-6, NULL), 1, 0.25,
            "near tie in risk: e_AB = .25 - 1e-6 at tau .25 (A, B far above the rest; others prx_normals(21109, 5))")
add_problem("neartie-sub-n7-K1", LETTERS[1:7], "score", neartie(0.40 + 1e-12, 1e-9), 1, 0.40,
            "near tie below the tolerance: e_AB = .40 + 1e-12 at tau .40; means of D and E 1e-9 apart")

# ---- package solves -------------------------------------------------------------------------------------------------
as_probs <- function(p) {
  e <- p$e; dimnames(e) <- list(p$ids, p$ids, p$criteria)
  postrank_probabilities(e, event = "directional_error", zero_ties = TRUE, margin = 0,
    source = list(kind = "analytic_reference", description = p$description,
                  conditioning = "fixed independent-site normal law per criterion; rounded to 15 significant digits"),
    targets = setNames(paste(p$criteria, "in illustrative units; larger means higher priority"), p$criteria))
}
ctrl <- postrank_control(time_limit = 60, threads = 1L, absolute_risk_gap = PKG_GAP)
pkg_solve <- function(x, w, tau, n) {
  t0 <- proc.time()[["elapsed"]]
  fit <- postrank(x, weights = setNames(w, x$criterion_ids), tau = tau, G_max = as.integer(n), backend = "highs",
                  control = ctrl, report_card = FALSE, fragility = FALSE)
  secs <- proc.time()[["elapsed"]] - t0
  rk <- get_risk(fit)
  g <- get_grades(fit)
  g <- if (is.data.frame(g)) setNames(g$grade, g$entity_id) else g
  g <- as.integer(unname(g[x$entity_ids]))
  stopifnot(identical(fit$fit$backend$name, "highs"), fit$settings$G_max == n, is_canonical(g),
            identical(fit$fit$engine$strategy, "staged"))
  list(fit = fit, grade = g, risk = rk$risk, lower = rk$lower_bound, gap = rk$gap, status = rk$status,
       termination = fit$fit$status$termination_reason, raw_code = fit$fit$status$raw_code,
       bound_source = fit$fit$objective$bound_source, wrapper_version = fit$backend$wrapper_version, seconds = secs)
}

rows <- list()
timing <- data.frame(id = character(), n = integer(), K = integer(), tau = numeric(), status = character(),
                     seconds = numeric(), stringsAsFactors = FALSE)
nonopt <- character()
max_oracle_diff <- 0
for (p in problems) {
  n <- length(p$ids); K <- length(p$criteria); x <- as_probs(p)
  stopifnot(max(abs(unname(x$e) - p$e), na.rm = TRUE) == 0)          # the package keeps the rounded array
  ebar <- weighted_e(p$e, p$w)
  for (tau in p$taus) {
    id <- sprintf("mipSolve-%s-tau%s", p$key, fmt_tau(tau))
    sol <- pkg_solve(x, p$w, tau, n)
    timing[nrow(timing) + 1L, ] <- list(id, n, K, tau, sol$status, sol$seconds)
    if (!identical(sol$status, "optimal")) nonopt <- c(nonopt, sprintf("%s: %s", id, sol$status))
    if (!identical(sol$status, "optimal") || !is.finite(sol$gap) || sol$gap > PKG_GAP)
      stop(sprintf("%s: package status %s, gap %s (need optimal, gap <= %g)", id, sol$status, format(sol$gap), PKG_GAP),
           call. = FALSE)
    stopifnot(is.finite(sol$lower), sol$lower <= sol$risk + 1e-12)
    # Base-R risk of the package's grade.
    orisk <- oracle_risk(sol$grade, ebar, tau)
    max_oracle_diff <- max(max_oracle_diff,
                           check_close(orisk, sol$risk, 1e-12, paste("oracle_risk vs package risk", id)))
    check_close(sol$fit$evaluation$primary_risk, sol$risk, 0, paste("evaluation vs get_risk", id))
    # LP relaxation of the z formulation (diagnostic): a valid lower bound.
    lp <- z_lp(ebar, tau)
    stopifnot(lp$bound <= sol$risk + 1e-9)
    # Enumeration (n <= 7): optimum value and uniqueness.
    enumerated <- n <= 7
    unique_known <- FALSE; runner_up <- NA_real_; n_reports <- NA_integer_; n_within <- NA_integer_
    if (enumerated) {
      G <- family_of(n); r <- enum_risks(G, ebar, tau); o <- order(r, method = "radix")
      n_reports <- nrow(G); runner_up <- r[o[2]] - r[o[1]]; n_within <- sum(r <= r[o[1]] + UNIQUE_TOL)
      check_close(r[o[1]], oracle_risk(G[o[1], ], ebar, tau), 1e-15, paste("enumeration vs oracle_risk", id))
      check_close(sol$risk, r[o[1]], 1e-12, paste("package risk vs enumerated minimum", id))
      unique_known <- runner_up > UNIQUE_TOL
      if (unique_known && !identical(sol$grade, as.integer(G[o[1], ])))
        stop("package grade is not the unique enumerated optimum: ", id, call. = FALSE)
    }
    expect <- list(risk = sol$risk, gradeRisk = sol$risk, upperIsGradeRisk = TRUE, lowerLeUpper = TRUE, gap = 0,
                   status = "optimal", label = "optimal-within-solver-tolerances", canonical = TRUE)
    if (unique_known) expect$grade <- vec(sol$grade)
    rows[[length(rows) + 1L]] <- list(
      id = id,
      args = list(fn = "mipSolve", E = earr(p$e, p$ids, p$criteria), tau = tau, w = vec(p$w), timeLimit = 60,
                  n = n, K = K, unique_known = unique_known, source = p$description),
      expect = expect,
      record = list(package = list(grade = vec(sol$grade), risk = sol$risk, lowerBound = sol$lower, gap = sol$gap,
                                   status = sol$status, termination = sol$termination, rawCode = sol$raw_code,
                                   boundSource = sol$bound_source, G = max(sol$grade), N = disclosed(sol$grade),
                                   backend = "highs", highsWrapperVersion = sol$wrapper_version, strategy = "staged",
                                   absoluteRiskGap = PKG_GAP, timeLimit = 60, threads = 1L),
                    oracleRisk = orisk, enumerated = enumerated, reports = n_reports,
                    reportsWithinTolerance = n_within, runnerUpGap = runner_up, uniqueTol = UNIQUE_TOL,
                    lpBound = signif(lp$bound, 12), lpFractional = round(lp$frac, 6)))
  }
}

# The six sites solved from the package's own coefficient objects give the same grade and risk.
for (cc in list(list(x = pr_tutorial$one, w = c(score_A = 1), key = "six-A-n6-K1"),
                list(x = pr_tutorial$two, w = c(score_A = 0.5, score_B = 0.5), key = "six-AB-n6-K2-w.5.5"))) {
  for (tau in TAUS) {
    fit <- postrank(cc$x, weights = cc$w, tau = tau, G_max = 6L, backend = "highs", control = ctrl,
                    report_card = FALSE, fragility = FALSE)
    rw <- rows[[match(sprintf("mipSolve-%s-tau%s", cc$key, fmt_tau(tau)), vapply(rows, `[[`, "", "id"))]]
    check_close(get_risk(fit)$risk, rw$expect$risk, 1e-12, paste("coefficient object vs rounded array", cc$key, tau))
    if (isTRUE(rw$args$unique_known))
      stopifnot(identical(as.integer(unname(get_grades(fit)[six_ids])), as.integer(unclass(rw$expect$grade))))
  }
}

# Near-tie construction: the runner-up gaps are the designed margins.
gap_of <- function(key) rows[[match(key, vapply(rows, `[[`, "", "id"))]]$record$runnerUpGap
check_close(gap_of("mipSolve-neartie-split-n7-K1-tau.25"), 1e-6 / 21, 1e-12, "neartie split margin")
stopifnot(gap_of("mipSolve-neartie-sub-n7-K1-tau.40") < 1e-12)
# The branching problem: fractional LP relaxation at tau .40, certified by the package's MIP stage.
br <- rows[[match("mipSolve-branch21203-n12-K2-w.5.5-tau.40", vapply(rows, `[[`, "", "id"))]]$record
stopifnot(br$lpFractional > 1e-6, br$lpBound < br$package$risk - 1e-6,
          identical(br$package$termination, "engine_mip_certified"))

write_golden("postrank-mip", rows, generator = "r-export/09_mip.R", uses_postrank = TRUE)
cat("postrank-mip:", length(rows), "rows;", sum(vapply(rows, function(r) isTRUE(r$args$unique_known), TRUE)),
    "with the grade compared (unique_known); max |oracle_risk - package risk| =", format(max_oracle_diff, digits = 3),
    "\n")
frac <- vapply(rows, function(r) r$record$lpFractional > 0, TRUE)
cat("rows with a fractional LP relaxation (branching needed):", if (any(frac)) paste(vapply(rows[frac], `[[`, "", "id"),
    collapse = ", ") else "none", "\n")
cat("non-optimal package statuses:", if (length(nonopt)) paste(nonopt, collapse = "; ") else "none", "\n")
cat(sprintf("package solve time (s): total %.2f, max %.2f (%s)\n", sum(timing$seconds), max(timing$seconds),
            timing$id[which.max(timing$seconds)]))
print(timing, row.names = FALSE)
