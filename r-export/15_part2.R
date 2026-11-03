# Author: JoonHo Lee (jlee296@ua.edu)
# Step 6.14: shared base-R inputs for the Part 2 golden rows (engine/API.md).
# Not a golden writer: 02_pairwise.R, 03_report_risk.R, 04_optimize.R, 05_frontier.R, 06_multi.R, 08_simulate.R,
# 10_stream.R, 12_report_card.R and 14_summaries.R source this file and add their "Step 6.14" rows from `p2`.
# Rules of _oracle.R: base R only (closed forms, exact rationals, full enumeration, the seeded stream of _rng.R); postrank
# is never loaded here. Inputs are the released course files (data/released/*.json) re-read from their 15-digit text
# (r15), the theory book's finite laws (ch. 10 three-unit order law, ch. 19 three-unit law) and KRW's Example 1
# (independent normal posteriors N(omega_i, 1), omega = (2, omega_2, 0)). Units are 1-based here (0-based in the rows).
if (!exists("released_dir")) source("r-export/_paths.R")
if (!exists("oracle_reports")) source("r-export/_oracle.R")
if (!exists("prx_normals")) source("r-export/_rng.R")

p2 <- local({
  r15 <- function(x) { y <- x; ok <- !is.na(x); y[ok] <- as.numeric(sprintf("%.15g", x[ok])); y }
  read <- function(key) jsonlite::fromJSON(file.path(released_dir, paste0(key, ".json")), simplifyVector = FALSE)
  num <- function(x) vapply(x, function(v) if (is.null(v)) NA_real_ else as.numeric(v), 0)
  mat <- function(rows) r15(t(vapply(rows, num, numeric(length(rows)))))      # row i = unit i
  canonical <- function(g) match(g, sort(unique(g)))
  M <- function(n) n * (n - 1) / 2
  risk_of <- function(G, e, tau) {                                           # risk of every report (rows of G), K = 1
    n <- ncol(G); N <- numeric(nrow(G)); E <- numeric(nrow(G))
    for (i in 1:(n - 1)) for (j in (i + 1):n) {
      lt <- G[, i] < G[, j]; gt <- G[, i] > G[, j]; N <- N + (lt | gt); E <- E + e[i, j] * lt + e[j, i] * gt
    }
    list(N = N, E = E, risk = (E + tau * (M(n) - N)) / M(n))
  }
  lexsort <- function(G) G[do.call(order, unname(as.data.frame(G))), , drop = FALSE]
  # First optimum (lexicographic) of the reports in G within 1e-13 of the smallest risk; nothing may sit in
  # (1e-13, 1e-10] above it (the tie set then cannot depend on summation order).
  optimum <- function(G, e, tau, label) {
    r <- risk_of(G, e, tau); d <- r$risk - min(r$risk)
    if (any(d > 1e-13 & d <= 1e-10)) stop("ambiguous near-tie: ", label, call. = FALSE)
    S <- lexsort(G[d <= 1e-13, , drop = FALSE])
    list(grade = S[1, ], grades = S, ties = nrow(S))
  }

  # ---- six sites, score A (data/released/six-sites.json) -------------------------------------------------------
  six_rel <- read("six-sites")
  units <- six_rel$tables$units
  six <- list(ids = unlist(units$id), mean = num(units$mean_A), sd = num(units$sd_A))
  stopifnot(identical(six$ids, LETTERS[1:6]), identical(six$mean, c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8)), all(six$sd == 0.2),
            identical(unlist(six_rel$arrays$one$criteria), "score_A"))
  six$e <- array(mat(six_rel$arrays$one$e[[1]]), c(6, 6, 1))
  e_pn <- outer(six$mean, six$mean, function(a, b) pnorm((b - a) / sqrt(0.2^2 + 0.2^2))); diag(e_pn) <- NA
  stopifnot(max(abs(six$e[, , 1] - e_pn), na.rm = TRUE) < 1e-15)               # released array = base-R pnorm array
  R6 <- oracle_reports(6); G6 <- apply(R6, 1, max)
  stopifnot(nrow(R6) == 4683, sum(G6 <= 3) == 603)
  six$opt <- list()                                                          # exact optima on the released array
  for (tau in (1:50) / 100) for (fam in c("all", "cap3")) {
    keep <- if (fam == "all") rep(TRUE, nrow(R6)) else G6 <= 3
    six$opt[[sprintf("%s-tau%s", fam, sub("^0", "", sprintf("%.2f", tau)))]] <-
      optimum(R6[keep, , drop = FALSE], six$e[, , 1], tau, paste("six", fam, tau))
  }
  stopifnot(identical(six$opt[["all-tau.20"]]$grade, c(1L, 2L, 3L, 3L, 4L, 5L)),
            identical(six$opt[["cap3-tau.20"]]$grade, c(1L, 1L, 2L, 2L, 3L, 3L)),
            identical(six$opt[["all-tau.40"]]$grade, 1:6))

  # Draws from the six sites' normal law through the course stream (engine/API.md gaussianDraws, K = 1):
  # theta[s][i] = mean_i + sd_i z[(s n + i)], z = normals(seed, S n); written with 15 digits, so the draws are r15.
  draws <- function(S, seed) {
    z <- prx_normals(seed, S * 6)
    lapply(seq_len(S), function(s) r15(six$mean + six$sd * z[(s - 1) * 6 + 1:6]))
  }
  draw_errors <- function(d) {                                               # share of draws with theta_i <= theta_j
    cnt <- matrix(0, 6, 6); for (x in d) cnt <- cnt + outer(x, x, "<=")
    e <- cnt / length(d); diag(e) <- NA; array(e, c(6, 6, 1))
  }
  six$draws1 <- draws(100, 1); six$drawE1 <- draw_errors(six$draws1)
  six$draws4 <- draws(5, 424242); six$drawE4 <- draw_errors(six$draws4)
  for (d in c(six$draws1, six$draws4)) stopifnot(min(diff(sort(d))) > 1e-9)  # no near-ties inside a draw

  # ---- KRW Example 1: omega = (2, omega_2, 0), unit posterior SDs; e_ij = Phi((omega_j - omega_i) / sqrt 2) ------
  krw1 <- function(omega2) {
    m <- c(2, omega2, 0); e <- r15(outer(m, m, function(a, b) pnorm((b - a) / sqrt(2)))); diag(e) <- NA
    array(e, c(3, 3, 1))
  }
  krw1_omegas <- c(`1` = 1, `.80` = 0.80, `.81` = 0.81, `.50` = 0.50)

  # ---- theory book ch. 10 three-unit law: orders ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10 (masses over 20) ------------
  # The values 3, 2, 1 along each order (the course's states); every probability is one correctly rounded rational.
  order_states <- list(ABC = c(3, 2, 1), ACB = c(3, 1, 2), BAC = c(2, 3, 1), CBA = c(1, 2, 3))
  law_counts <- function(states, masses, rel) {
    n <- length(states[[1]]); a <- matrix(0, n, n)
    for (s in seq_along(states)) a <- a + masses[s] * outer(states[[s]], states[[s]], rel)
    diag(a) <- NA; a
  }
  tb10 <- list(ids = c("A", "B", "C"), states = order_states, masses = c(12, 3, 3, 2))
  tb10$e <- array(law_counts(tb10$states, tb10$masses, `<=`) / 20, c(3, 3, 1))
  stopifnot(all.equal(tb10$e[, , 1][cbind(c(1, 2, 1), c(2, 3, 3))], c(1/4, 1/4, 1/10)))
  R3 <- oracle_reports(3); stopifnot(nrow(R3) == 13)
  reports3 <- lexsort(R3)

  # ---- theory book ch. 19 three-unit law: (20, 4, 3) w.p. 3/10, (0, 4, 3) w.p. 7/10 ---------------------------------
  tb19 <- list(ids = c("A", "B", "C"), states = list(c(20, 4, 3), c(0, 4, 3)), masses = c(3, 7))
  tb19$e <- array(law_counts(tb19$states, tb19$masses, `<=`) / 10, c(3, 3, 1))
  stopifnot(identical(tb19$e[, , 1][cbind(c(1, 2, 1, 2), c(2, 1, 3, 3))], c(0.7, 0.3, 0.7, 0)))

  # ---- thirty sites, poverty (data/released/thirty-sites.json) ------------------------------------------------------
  th_rel <- read("thirty-sites")
  th <- list(ids = unlist(th_rel$arrays$gaussian$ids), mean = num(th_rel$tables$units$mean_poverty),
             sd = num(th_rel$tables$units$sd_poverty))
  stopifnot(identical(unlist(th_rel$tables$units$id), th$ids), identical(unlist(th_rel$arrays$gaussian$criteria)[1], "poverty"))
  th$e <- array(mat(th_rel$arrays$gaussian$e[[1]]), c(30, 30, 1))
  th$er <- 1 + rowSums(th$e[, , 1], na.rm = TRUE)                             # expected rank (engine expectedRank, K = 1)
  stopifnot(min(diff(sort(th$er))) > 1e-9)                                   # no tied scores: no indivisible blocks
  # The card of the page: contiguous cuts of the ascending expected-rank order, at most 4 grades, tau = .25. Every cut
  # set (1 + 29 + 406 + 3,654 of them) is evaluated; the best must be unique by a margin (no tie rule decides it).
  ord <- order(th$er)
  eta <- th$e[, , 1][ord, ord] - 0.25; eta[lower.tri(eta, diag = TRUE)] <- 0   # saving of stating s above t
  P <- rbind(0, cbind(0, t(apply(apply(eta, 2, cumsum), 1, cumsum))))
  W <- function(a, b) P[cbind(b + 1, b + 1)] - P[cbind(a + 1, b + 1)]
  best <- NULL; vals <- numeric()
  for (h in 1:4) {
    cs <- if (h == 1) matrix(0L, 1, 0) else t(combn(29, h - 1))
    bd <- cbind(0L, cs, 30L); sav <- rowSums(matrix(W(as.vector(bd[, -ncol(bd)]), as.vector(bd[, -1])), nrow(bd)))
    vals <- c(vals, sav); i <- which.max(sav)
    if (is.null(best) || sav[i] > best$sav) best <- list(sav = sav[i], cuts = cs[i, ])
  }
  stopifnot(length(vals) == 4090)
  srt <- sort(vals, decreasing = TRUE); stopifnot((srt[1] - srt[2]) / M(30) > 1e-10)
  th$card <- integer(30); th$card[ord] <- 1L + findInterval(0:29, best$cuts)
  th$card_tau <- 0.25

  # ---- KRW race card and lambda grid (data/released/case-krw.json, krw-lambda-grid.json) ----------------------------
  ck <- read("case-krw")
  krw <- list(ids = unlist(ck$arrays$error$ids), card = num(ck$tables$reports$race_card))
  stopifnot(identical(unlist(ck$arrays$error$criteria)[1], "race_signed"), identical(unlist(ck$tables$reports$id), krw$ids))
  krw$e <- array(mat(ck$arrays$error$e[[1]]), c(97, 97, 1))
  gr <- read("krw-lambda-grid")
  stopifnot(identical(unlist(gr$tables$firms$id), krw$ids))
  krw$grid_lambda <- num(gr$facts$lambda); krw$grid_tau <- num(gr$facts$tau)
  krw$grid <- lapply(gr$arrays$race$grade, num)
  stopifnot(length(krw$grid) == 101, all(abs(krw$grid_lambda - (0:100) / 100) < 1e-15))

  list(r15 = r15, canonical = canonical, M = M, risk_of = risk_of, optimum = optimum, lexsort = lexsort,
       six = six, krw1 = krw1, krw1_omegas = krw1_omegas, tb10 = tb10, tb19 = tb19, reports3 = reports3,
       th = th, krw = krw, law_counts = law_counts)
})
