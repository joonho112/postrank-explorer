# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/report.ts and engine/src/risk.ts (Step 2.5).
#   oracle-report-risk    base R only (exact counts, closed forms, theory-book worked examples); postrank not loaded.
#   postrank-report-risk  postrank_evaluate() on the six tutorial sites (one and two criteria) and the KRW race card,
#                         postrank_tie_evaluate() on finite tie laws; base-R cross-checks asserted below.
# Conventions (engine/API.md): grade 1 = highest priority; units 0-based in code; "i above j is stated" when
# g[i] < g[j]; E is an ErrorArray { ids, criteria, e } with e[k][i][j] = Pr(theta_ik <= theta_jk) and a NaN (null)
# diagonal; M = n(n - 1)/2; risk R = (sum_k w_k E_k + tau (M - N)) / M. Every row names its function in args$fn.
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
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r

# ---- base-R oracle (theory book ch. 9-11, 16; App. B) ---------------------------------------------------------------
o_error_array <- function(means, sds) {              # independent normals, larger = higher priority
  n <- nrow(means); K <- ncol(means); e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j, k] <- pnorm((means[j, k] - means[i, k]) / sqrt(sds[i, k]^2 + sds[j, k]^2))
  e
}
o_finite_law <- function(states, masses) {           # integer masses; each probability one correctly rounded rational
  n <- nrow(states[[1]]); K <- ncol(states[[1]]); den <- sum(masses)
  cnt <- function(rel) {
    a <- array(NA_real_, c(n, n, K))
    for (k in seq_len(K)) for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
      a[i, j, k] <- sum(masses[vapply(states, function(s) rel(s[i, k], s[j, k]), logical(1))])
    a
  }
  eq <- cnt(`==`)
  list(e = cnt(`<=`) / den, b = cnt(`<`) / den, t = eq / den, d = (den - eq) / den)
}
wsum <- function(e, w) { out <- e[, , 1] * w[1]; if (dim(e)[3] > 1) for (k in 2:dim(e)[3]) out <- out + w[k] * e[, , k]; out }
o_M <- function(n) n * (n - 1) / 2
o_canonical <- function(g) match(g, sort(unique(g)))
o_disclosure <- function(g) {
  n <- length(g); G <- max(g); sizes <- tabulate(g, G); M <- o_M(n); N <- sum(outer(g, g, "<"))
  stopifnot(N == (n^2 - sum(sizes^2)) / 2, N == M - sum(choose(sizes, 2)))       # ch. 9 disclosed-pair counts
  list(M = M, N = N, s = N / M, G = G, sizes = vec(sizes))
}
o_relations <- function(g) sign(outer(g, g, function(a, b) b - a))                # +1: row i stated above column j
o_weak <- function(g) {
  n <- length(g); z <- 1 * outer(g, g, "<=")
  complete <- all((z + t(z))[base::row(z) != base::col(z)] >= 1)
  transitive <- TRUE
  for (i in seq_len(n)) for (j in seq_len(n)) for (k in seq_len(n))
    if (length(unique(c(i, j, k))) == 3 && z[i, j] == 1 && z[j, k] == 1 && z[i, k] != 1) transitive <- FALSE
  zz <- z; diag(zz) <- NA                                                       # the API fixes z only for i != j
  list(z = zz, complete = complete, transitive = transitive)
}
o_evaluate <- function(g, e, tau, w) {
  n <- length(g); K <- dim(e)[3]; M <- o_M(n); x <- outer(g, g, "<"); N <- sum(x)
  E <- vapply(seq_len(K), function(k) sum(e[, , k][x]), 0)
  Ew <- sum(w * E); risk <- (Ew + tau * (M - N)) / M
  check_close(risk, tau + sum(wsum(e, w)[x] - tau) / M, 1e-15, "risk = tau + M^-1 sum(ebar - tau)")  # ch. 11 identity
  list(M = M, N = N, s = N / M, G = length(unique(g)), E = vec(E),
       EoverN = vec(if (N == 0) rep(NA_real_, K) else E / N), EoverM = vec(E / M),
       Rk = vec((E + tau * (M - N)) / M), Ew = Ew, risk = risk,
       errorTerm = Ew / M, withholdingTerm = tau * (M - N) / M)
}
o_relaxed <- function(e, tau, w) {
  eb <- wsum(e, w); n <- nrow(eb); s <- 0
  for (i in 1:(n - 1)) for (j in (i + 1):n) s <- s + min(eb[i, j], eb[j, i], tau)
  s / o_M(n)
}
o_between <- function(g, e, w) {
  eb <- wsum(e, w); G <- max(g); out <- list()
  if (G >= 2) for (h in 1:(G - 1)) for (hp in (h + 1):G) {
    v <- eb[which(g == h), which(g == hp)]
    out[[length(out) + 1L]] <- list(h = h, hp = hp, pairs = length(v), meanError = mean(v), maxError = max(v))
  }
  out
}
o_stated_above <- function(g, e, tau, w) {
  eb <- wsum(e, w); x <- outer(g, g, "<")
  if (any(x)) stopifnot(all(abs(eb[x] - tau) > 1e-9))   # no stated pair at tau (the engine's ebar > tau + tieTol)
  idx <- which(x & eb > tau, arr.ind = TRUE); idx <- idx[order(idx[, 1], idx[, 2]), , drop = FALSE]
  list(pairs = lapply(seq_len(nrow(idx)), function(r) vec(unname(idx[r, ]) - 1L)),     # 0-based [i, j]
       errors = vec(eb[idx]), count = nrow(idx), max = if (any(x)) max(eb[x]) else NA_real_)
}
o_realized_wrong <- function(g, theta) {
  x <- outer(g, g, "<")
  vapply(seq_len(ncol(theta)), function(k) sum(x & outer(theta[, k], theta[, k], "<=")), 0)
}
# The full realizedWrong record: N, D_k, D_k/N, A = sum_k w_k D_k (null when K > 1 and no w), A/N (null when N = 0).
o_realized_full <- function(g, theta, w = NULL) {
  D <- o_realized_wrong(g, theta); N <- sum(outer(g, g, "<")); K <- ncol(theta)
  if (is.null(w) && K == 1) w <- 1
  A <- if (is.null(w)) NA_real_ else sum(w * D)
  list(N = N, D = vec(D), DoverN = vec(if (N == 0) rep(NA_real_, K) else D / N), A = A, AoverN = if (N == 0 || is.na(A)) NA_real_ else A / N)
}
o_krw <- function(g, e, lambda) {                    # K = 1: (1 - lambda) DR - lambda taubar
  M <- o_M(length(g)); x <- outer(g, g, "<"); N <- sum(x); E <- sum(e[, , 1][x])
  (1 - lambda) * E / M - lambda * (N - 2 * E) / M
}
o_neutral <- function(g, b, d, tau, w) {             # ch. 11: R_TA = sum_k w_k (E_k + tau H_k)/M, R0 = tau T_w / M
  n <- length(g); M <- o_M(n); K <- dim(b)[3]; x <- outer(g, g, "<"); h <- outer(g, g, "==") & upper.tri(x)
  u <- upper.tri(x)
  Ek <- vapply(seq_len(K), function(k) sum(b[, , k][x]), 0)
  Hk <- vapply(seq_len(K), function(k) sum(d[, , k][h]), 0)
  Tk <- vapply(seq_len(K), function(k) sum(d[, , k][u]), 0)
  risk <- sum(w * (Ek + tau * Hk)) / M; R0 <- tau * sum(w * Tk) / M
  check_close(risk, R0 + sum(wsum(b, w)[x] - tau * wsum(d, w)[x]) / M, 1e-15, "R_TA = R0 + Z_TA / M")
  list(risk = risk, R0 = R0)
}
o_estimands <- function(A, N, M) {                   # equally likely cases (ch. 16)
  pos <- N > 0
  list(ERR = if (mean(N) > 0) mean(A) / mean(N) else NA_real_,
       meanFraction = if (any(pos)) mean(A[pos] / N[pos]) else NA_real_,
       zeroImputed = mean(ifelse(pos, A / pmax(N, 1), 0)),
       positiveFrequency = mean(pos), meanDisclosure = mean(N / M))
}
st <- function(..., ids, criteria) { m <- cbind(...); dimnames(m) <- list(entity = ids, criterion = criteria); m }

# Laws used below.
six_ids <- LETTERS[1:6]; sixK <- c("score_A", "score_B")
six_means <- cbind(score_A = c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8), score_B = c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7))
e6 <- o_error_array(six_means, matrix(0.2, 6, 2))                    # pr_tutorial law, hardcoded (see 02_pairwise.R)
e6a <- e6[, , 1, drop = FALSE]
abcd <- c("A", "B", "C", "D"); two <- c("c1", "c2"); AB <- c("A", "B")
rank_vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], abcd)] <- 4:1; v }
tb14 <- o_finite_law(list(st(rank_vals("ABCD"), rank_vals("ACBD"), ids = abcd, criteria = two),
                          st(rank_vals("BACD"), rank_vals("DCBA"), ids = abcd, criteria = two)), c(3L, 1L))
m4 <- o_finite_law(lapply(c(0, 1, 2), function(a) st(c(a, 1), ids = AB, criteria = "score")), c(1L, 4L, 5L))
tb16 <- o_finite_law(list(st(c(0, 0, 2, 3), c(0, 0, 0, 1), ids = abcd, criteria = two),
                          st(c(0, 0, 2, 1), c(0, 0, 0, 1), ids = abcd, criteria = two)), c(3L, 2L))
guard <- o_finite_law(list(st(c(2, 2, 0), c(0, 1, 2), ids = c("A", "B", "C"), criteria = c("shared", "individual"))), 1L)

# canonicalGrade
for (g in list(c(2, 5, 9, 5), c(3, 3, 3), c(1, 2, 3), c(10, 1, 10, 4), c(7, 7, 2, 2, 5), c(4, 4, 1, 6, 1, 9)))
  add(row(paste0("canonicalGrade-", paste(g, collapse = ".")), "canonicalGrade", list(g = vec(g)),
          list(grade = vec(o_canonical(g)))))
stopifnot(identical(o_canonical(c(2, 5, 9, 5)), c(1L, 2L, 3L, 2L)))      # ch. 9: labels {2,5,9} become {1,2,3}

# pairCount
for (n in c(2, 3, 4, 5, 6, 12, 30, 97, 1000)) add(row(paste0("pairCount-", n), "pairCount", list(n = n), list(M = o_M(n))))

# disclosure
krw_like <- rep(1:3, c(2, 81, 14))
for (g in list(c(1, 2, 2, 2), c(1, 1, 2, 2), c(1, 1, 1, 1), c(1, 2, 3, 4), c(1, 1, 2, 2, 3, 3), c(3, 1, 2, 1, 3, 2),
               c(1, 1, 1, 2, 3, 3, 3, 3), krw_like)) {
  id <- if (length(g) > 12) "krw-sizes-2-81-14" else paste(g, collapse = ".")
  add(row(paste0("disclosure-", id), "disclosure", list(g = vec(g)), o_disclosure(g)))
}
stopifnot(o_disclosure(c(1, 2, 2, 2))$N == 3, o_disclosure(c(1, 1, 2, 2))$N == 4,      # ch. 9: N = 3 and 4, s = 1/2, 2/3
          o_disclosure(c(1, 2, 2, 2))$s == 1/2, abs(o_disclosure(c(1, 1, 2, 2))$s - 2/3) < 1e-16,
          o_disclosure(krw_like)$N == 1324)                                         # KRW race card disclosure

# relations and weakRelation
for (g in list(c(1, 2), c(1, 1, 2, 2, 3, 3), c(2, 1, 3, 1), c(1, 1, 1))) {
  add(row(paste0("relations-", paste(g, collapse = ".")), "relations", list(g = vec(g)), list(rel = o_relations(g))))
  w <- o_weak(g); stopifnot(w$complete, w$transitive)
  add(row(paste0("weakRelation-", paste(g, collapse = ".")), "weakRelation", list(g = vec(g)), w))
}

# familySize: exact integers via gmp, written as decimal strings (28,091,567,595 for all n = 12; BigInt beyond 2^53).
bz <- gmp::as.bigz
fub <- list(bz(1)); for (m in 1:20) { s <- bz(0); for (k in 1:m) s <- s + gmp::chooseZ(m, k) * fub[[m - k + 1]]; fub[[m + 1]] <- s }
stir <- function(n, k) {                             # Stirling numbers of the second kind, exact
  S <- matrix(list(bz(0)), n + 1, n + 1); S[[1, 1]] <- bz(1)
  for (a in 1:n) for (b in 1:a) S[[a + 1, b + 1]] <- b * S[[a, b + 1]] + S[[a, b]]
  S[[n + 1, k + 1]]
}
size_all <- function(n) fub[[n + 1]]
size_exactly <- function(n, G) if (G < 1 || G > n) bz(0) else gmp::factorialZ(G) * stir(n, G)
size_atmost <- function(n, G) { s <- bz(0); for (h in seq_len(min(G, n))) s <- s + size_exactly(n, h); s }
size_order <- function(n, G = NULL, exact = NULL) {
  if (!is.null(exact)) return(gmp::chooseZ(n - 1, exact - 1))
  if (is.null(G)) return(bz(2)^(n - 1))
  s <- bz(0); for (h in seq_len(min(G, n))) s <- s + gmp::chooseZ(n - 1, h - 1); s
}
# Enumeration cross-check (n <= 6) of every closed form, including the contiguous counts of a fixed order.
for (n in 2:6) {
  R <- oracle_reports(n); G <- apply(R, 1, max); ord <- rev(seq_len(n))
  contiguous <- apply(R, 1, function(r) all(diff(r[ord]) >= 0))
  stopifnot(nrow(R) == as.numeric(size_all(n)), as.numeric(size_order(n)) == sum(contiguous))
  for (h in 1:n) stopifnot(sum(G == h) == as.numeric(size_exactly(n, h)), sum(G <= h) == as.numeric(size_atmost(n, h)),
                           sum(contiguous & G == h) == as.numeric(size_order(n, exact = h)),
                           sum(contiguous & G <= h) == as.numeric(size_order(n, G = h)))
}
stopifnot(as.character(size_all(12)) == "28091567595", as.character(size_atmost(12, 3)) == "523251",
          as.character(size_all(8)) == "545835", as.character(size_atmost(8, 3)) == "6051",
          as.character(size_order(8)) == "128", as.character(size_order(8, G = 3)) == "29",
          as.character(size_order(30, G = 3)) == "436", all(sapply(2:6, function(n) as.numeric(size_all(n))) == c(3, 13, 75, 541, 4683)))
fs <- function(n, label, family, size) add(row(sprintf("familySize-n%d-%s", n, label), "familySize", list(n = n, family = family),
                                               list(size = as.character(size))))
for (n in 2:12) {
  fs(n, "all", list(kind = "all"), size_all(n))
  for (G in unique(c(1, 2, 3, n)[c(1, 2, 3, n) <= n])) {   # caps and exact counts within 1..n only
    fs(n, paste0("atMost", G), list(kind = "atMost", G = G), size_atmost(n, G))
    fs(n, paste0("exactly", G), list(kind = "exactly", G = G), size_exactly(n, G))
  }
  ord <- vec(rev(seq_len(n)) - 1L)                    # a declared order (unit indices, top first)
  fs(n, "order", list(kind = "order", order = ord), size_order(n))
  if (n >= 3) fs(n, "order-atMost3", list(kind = "order", order = ord, G = 3), size_order(n, G = 3))
  fs(n, "order-exactly2", list(kind = "order", order = ord, exact = 2), size_order(n, exact = 2))
}
for (n in c(13, 16, 18, 20)) fs(n, "all", list(kind = "all"), size_all(n))   # 18 and 20 exceed 2^53 (BigInt path)
fs(30, "order-atMost3", list(kind = "order", order = vec(0:29), G = 3), size_order(30, G = 3))
fs(30, "order", list(kind = "order", order = vec(0:29)), size_order(30))

# pairDecision: costs e_ij (state i above j), e_ji (state j above i), tau (withhold); best = all within 1e-12 of min.
o_pair_decision <- function(eij, eji, tau) {
  costs <- c(iAboveJ = eij, jAboveI = eji, withhold = tau)
  list(costs = as.list(costs), best = vec(names(costs)[costs <= min(costs) + 1e-12]))
}
for (p in list(c(0.15, 0.85, 0.2), c(0.85, 0.15, 0.2), c(0.3, 0.7, 0.2), c(0.5, 0.5, 0.5), c(0.2, 0.8, 0.2),
               c(0.6, 0.6, 0.5), c(0.5, 0.9, 0.25), c(0, 1, 0.5), c(0.45, 0.55, 0.5), c(1, 0, 0.1)))
  add(row(sprintf("pairDecision-%g-%g-tau%g", p[1], p[2], p[3]), "pairDecision", list(eIJ = p[1], eJI = p[2], tau = p[3]),
          o_pair_decision(p[1], p[2], p[3])))
stopifnot(identical(unclass(o_pair_decision(0.15, 0.85, 0.2)$best), "iAboveJ"),
          length(o_pair_decision(0.5, 0.5, 0.5)$best) == 3)
for (tau in c(0, 0.6, -0.1))
  add(row(sprintf("pairDecision-throws-tau%g", tau), "pairDecisionThrows", list(eIJ = 0.2, eJI = 0.8, tau = tau), list(threw = TRUE)))

# evaluateReport
ev <- function(id, g, e, ids, criteria, tau, w, pass_w = TRUE) {
  a <- list(g = vec(g), E = earr(e, ids, criteria), tau = tau); if (pass_w) a$w <- vec(w)
  r <- o_evaluate(g, e, tau, w)
  add(row(paste0("evaluateReport-", id), "evaluateReport", a, r)); invisible(r)
}
six_reports <- list(all_withheld = rep(1, 6), strict = 1:6, reversed = 6:1, `112233` = c(1, 1, 2, 2, 3, 3),
                    `122222` = c(1, 2, 2, 2, 2, 2), `111222` = c(1, 1, 1, 2, 2, 2), `213344` = c(2, 1, 3, 3, 4, 4),
                    `312132` = c(3, 1, 2, 1, 3, 2))
for (nm in names(six_reports)) ev(paste0("six-K1-tau.2-", nm), six_reports[[nm]], e6a, six_ids, "score_A", 0.2, 1)
r112233 <- o_evaluate(c(1, 1, 2, 2, 3, 3), e6a, 0.2, 1)
check_close(c(r112233$N, r112233$E, r112233$risk), c(12, 0.0247745991823067, 0.0416516399454871), 1e-15,
            "six-site 1/1/2/2/3/3 matches postrank-selftest")
stopifnot(is.na(o_evaluate(rep(1, 6), e6a, 0.2, 1)$EoverN), o_evaluate(rep(1, 6), e6a, 0.2, 1)$risk == 0.2)
ev("six-K1-default-w-112233", c(1, 1, 2, 2, 3, 3), e6a, six_ids, "score_A", 0.2, 1, pass_w = FALSE)
for (nm in c("all_withheld", "strict", "112233", "312132"))
  ev(paste0("six-K2-w.5.5-tau.25-", nm), six_reports[[nm]], e6, six_ids, sixK, 0.25, c(0.5, 0.5))
ev("six-K2-w.8.2-tau.5-strict", 1:6, e6, six_ids, sixK, 0.5, c(0.8, 0.2))
ev("six-K2-w0.1-tau.1-112233", c(1, 1, 2, 2, 3, 3), e6, six_ids, sixK, 0.1, c(0, 1))
# Theory book ch. 14 four-unit law: the eight contiguous reports of ABCD at tau = 1/4, weights (3/5, 2/5).
tb14_w <- c(3/5, 2/5)
tb14_table <- list(ABCD = list(c(1, 1, 1, 1), 0, 0, 1/4), `ABC|D` = list(c(1, 1, 1, 2), 3, 3/10, 7/40),
  `AB|CD` = list(c(1, 1, 2, 2), 4, 7/10, 1/5), `A|BCD` = list(c(1, 2, 2, 2), 3, 9/20, 1/5),
  `AB|C|D` = list(c(1, 1, 2, 3), 5, 4/5, 7/40), `A|BC|D` = list(c(1, 2, 2, 3), 5, 13/20, 3/20),
  `A|B|CD` = list(c(1, 2, 3, 3), 5, 19/20, 1/5), `A|B|C|D` = list(c(1, 2, 3, 4), 6, 21/20, 7/40))
for (nm in names(tb14_table)) {
  t <- tb14_table[[nm]]
  r <- ev(paste0("tb14-tau.25-", gsub("|", "-", nm, fixed = TRUE)), t[[1]], tb14$e, abcd, two, 1/4, tb14_w)
  check_close(c(r$N, r$Ew, r$risk), c(t[[2]], t[[3]], t[[4]]), 1e-15, paste("theory book ch. 14 table", nm))
}
r_a <- ev("tb16-1112-tau.25", c(1, 1, 1, 2), tb14$e, abcd, two, 1/4, tb14_w)        # ch. 16: (N, A) = (3, 3/10)
r_b <- ev("tb16-1223-tau.25", c(1, 2, 2, 3), tb14$e, abcd, two, 1/4, tb14_w)        # ch. 16: (N, A) = (5, 13/20)
check_close(c(r_a$N, r_a$Ew, r_b$N, r_b$Ew), c(3, 3/10, 5, 13/20), 1e-15, "theory book ch. 16 frontier vertices")
# A law with latent ties (m4): weak errors, e_AB + e_BA = 1.4.
for (g in list(c(1, 2), c(2, 1), c(1, 1))) ev(paste0("m4-weak-tau.25-", paste(g, collapse = "")), g, m4$e, AB, "score", 0.25, 1)
check_close(sapply(list(c(1, 2), c(2, 1), c(1, 1)), function(g) o_evaluate(g, m4$e, 0.25, 1)$risk), c(0.5, 0.9, 0.25), 1e-16,
            "m4 vignette weak-loss column")
for (tau in c(0, 0.6))
  add(row(sprintf("evaluateReport-throws-tau%g", tau), "evaluateReportThrows",
          list(g = vec(c(1, 1, 2, 2, 3, 3)), E = earr(e6a, six_ids, "score_A"), tau = tau, w = vec(1)), list(threw = TRUE)))

# relaxedPairRisk (independent pair choices; not a report)
rp <- function(id, e, ids, criteria, tau, w) add(row(paste0("relaxedPairRisk-", id), "relaxedPairRisk",
  list(E = earr(e, ids, criteria), tau = tau, w = vec(w)), list(risk = o_relaxed(e, tau, w))))
rp("six-K1-tau.2", e6a, six_ids, "score_A", 0.2, 1)
rp("six-K2-w.5.5-tau.25", e6, six_ids, sixK, 0.25, c(0.5, 0.5))
rp("tb14-tau.25", tb14$e, abcd, two, 1/4, tb14_w)
rp("m4-weak-tau.25", m4$e, AB, "score", 0.25, 1)
stopifnot(o_relaxed(tb14$e, 1/4, tb14_w) <= 3/20 + 1e-15)       # never above the best coherent report (A|BC|D, 3/20)

# betweenGradeErrors
bg <- function(id, g, e, ids, criteria, w) add(row(paste0("betweenGradeErrors-", id), "betweenGradeErrors",
  list(g = vec(g), E = earr(e, ids, criteria), w = vec(w)), list(rows = o_between(g, e, w))))
bg("six-K1-112233", c(1, 1, 2, 2, 3, 3), e6a, six_ids, "score_A", 1)
bg("six-K2-w.8.2-312132", c(3, 1, 2, 1, 3, 2), e6, six_ids, sixK, c(0.8, 0.2))
bg("tb14-1223", c(1, 2, 2, 3), tb14$e, abcd, two, tb14_w)
bg("tb14-strict", 1:4, tb14$e, abcd, two, tb14_w)
bg("six-K1-all-withheld", rep(1, 6), e6a, six_ids, "score_A", 1)

# statedAbove: stated pairs with weighted error above tau (0-based [i, j], i stated above j) and the largest stated error.
sa <- function(id, g, e, ids, criteria, tau, w) add(row(paste0("statedAbove-", id), "statedAbove",
  list(g = vec(g), E = earr(e, ids, criteria), tau = tau, w = vec(w)), o_stated_above(g, e, tau, w)))
sa("six-K1-strict-tau.2", 1:6, e6a, six_ids, "score_A", 0.2, 1)
sa("six-K1-112233-tau.2", c(1, 1, 2, 2, 3, 3), e6a, six_ids, "score_A", 0.2, 1)
sa("six-K1-reversed-tau.2", 6:1, e6a, six_ids, "score_A", 0.2, 1)
sa("tb14-strict-tau.2", 1:4, tb14$e, abcd, two, 0.2, tb14_w)
sa("six-K2-w.5.5-strict-tau.25", 1:6, e6, six_ids, sixK, 0.25, c(0.5, 0.5))

# realizedWrong: wrong stated directions in one state (weak convention: equality counts as wrong).
rw <- function(id, g, theta, w = NULL) {
  a <- list(g = vec(g), theta = unname(theta)); if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("realizedWrong-", id), "realizedWrong", a, o_realized_full(g, theta, w)))
}
rw("tb16-case1", c(1, 2, 2), cbind(c(0, 2, 1))); rw("tb16-case2", c(1, 2, 3), cbind(c(3, 2, 1)))
rw("tb16-case3", c(1, 1, 1), cbind(c(3, 2, 1)))
rw("K2-with-ties", c(1, 2, 2, 3), cbind(c(1, 1, 3, 0), c(2, 3, 3, 3)))
rw("K2-with-ties-w.6.4", c(1, 2, 2, 3), cbind(c(1, 1, 3, 0), c(2, 3, 3, 3)), c(0.6, 0.4))
rw("K2-all-withheld-w.5.5", c(1, 1, 1, 1), cbind(c(1, 1, 3, 0), c(2, 3, 3, 3)), c(0.5, 0.5))
stopifnot(identical(o_realized_full(c(1, 2, 2), cbind(c(0, 2, 1)))[c("N", "A")], list(N = 2L, A = 2)),
          abs(o_realized_full(c(1, 2, 2, 3), cbind(c(1, 1, 3, 0), c(2, 3, 3, 3)), c(0.6, 0.4))$A - (0.6 * 2 + 0.4 * 5)) < 1e-15)
stopifnot(identical(o_realized_wrong(c(1, 2, 2), cbind(c(0, 2, 1))), 2), identical(o_realized_wrong(c(1, 2, 2, 3), cbind(c(1, 1, 3, 0), c(2, 3, 3, 3))), c(2, 5)))

# lambdaToTau / tauToLambda (ch. 10: tau = lambda/(1 + lambda), lambda = tau/(1 - tau))
for (l in c(0.25, 1, 0.5, 0.1, 1e-6)) add(row(sprintf("lambdaToTau-%g", l), "lambdaToTau", list(lambda = l), list(tau = l / (1 + l))))
for (t in c(0.2, 0.5, 1/3, 0.1, 0.25)) add(row(sprintf("tauToLambda-%.6g", t), "tauToLambda", list(tau = t), list(lambda = t / (1 - t))))
stopifnot(0.25 / 1.25 == 0.2, 0.2 / 0.8 == 0.25)

# krwRisk (K = 1): (1 - lambda) DR - lambda taubar, DR = E/M, taubar = (N - 2E)/M.
for (nm in names(six_reports)) for (l in c(0.25, 1, 0.1)) {
  g <- six_reports[[nm]]
  add(row(sprintf("krwRisk-six-%s-lambda%g", nm, l), "krwRisk", list(g = vec(g), E = earr(e6a, six_ids, "score_A"), lambda = l),
          list(risk = o_krw(g, e6a, l))))
  tau <- l / (1 + l)                                  # ch. 10 affine identity (tie-free law): R_tau = tau + (1 - tau) R_K
  check_close(o_evaluate(g, e6a, tau, 1)$risk, tau + (1 - tau) * o_krw(g, e6a, l), 1e-15, paste("KRW affine identity", nm))
}

# equalityNeutralRisk: tie = { b, d } (criterion-major, like E$e); ch. 11 risk and its all-withhold baseline R0.
en <- function(id, g, L, ids, criteria, tau, w) {
  r <- o_neutral(g, L$b, L$d, tau, w)
  add(row(paste0("equalityNeutralRisk-", id), "equalityNeutralRisk",
          list(g = vec(g), tie = list(ids = vec(ids), criteria = vec(criteria), b = cube_json(L$b), d = cube_json(L$d)),
               tau = tau, w = vec(w)), r))
  invisible(r)
}
# Theory book ch. 16 table (guarded at-most-two-grade family), weights (1/4, 3/4); M R as printed in the book.
tb16_table <- list(`CD>AB` = list(c(2, 2, 1, 1), function(t) t), `D>ABC` = list(c(2, 2, 2, 1), function(t) 1/10 + t/2),
  `C>ABD` = list(c(2, 2, 1, 2), function(t) 9/10 + 2 * t), `ABD>C` = list(c(1, 1, 2, 1), function(t) 3/5 + 2 * t),
  `AB>CD` = list(c(1, 1, 2, 2), function(t) 5/2 + t), `ABC>D` = list(c(1, 1, 1, 2), function(t) 29/10 + t/2),
  `all-withhold` = list(c(1, 1, 1, 1), function(t) 7 * t / 2))
for (tau in c(1/10, 3/10, 1/5)) for (nm in names(tb16_table)) {
  r <- en(sprintf("tb16-%s-tau%g", nm, tau), tb16_table[[nm]][[1]], tb16, abcd, two, tau, c(1/4, 3/4))
  check_close(r$risk, tb16_table[[nm]][[2]](tau) / 6, 1e-15, paste("theory book ch. 16 equality-neutral table", nm, tau))
  check_close(r$R0, 7 * tau / 12, 1e-15, "R0 = tau T / M with T = 7/2")
}
check_close(o_neutral(c(2, 2, 1, 1), tb16$b, tb16$d, 1/10, c(1/4, 3/4))$risk, 1/60, 1e-16, "ch. 16: risk 1/60 at tau = 1/10")
check_close(o_neutral(c(2, 2, 2, 1), tb16$b, tb16$d, 3/10, c(1/4, 3/4))$risk, 1/24, 1e-16, "ch. 16: risk 1/24 at tau = 3/10")
for (g in list(c(1, 2), c(2, 1), c(1, 1))) en(paste0("m4-tau.25-", paste(g, collapse = "")), g, m4, AB, "score", 0.25, 1)
check_close(sapply(list(c(1, 2), c(2, 1), c(1, 1)), function(g) o_neutral(g, m4$b, m4$d, 0.25, 1)$risk), c(0.1, 0.5, 0.15), 1e-16,
            "m4 vignette neutral-loss column")
en("guard-split-w1.0", c(1, 2, 3), guard, c("A", "B", "C"), c("shared", "individual"), 0.25, c(1, 0))
en("guard-split-w.5.5", c(1, 2, 3), guard, c("A", "B", "C"), c("shared", "individual"), 0.25, c(0.5, 0.5))

# disclosedErrorEstimands(cases, { M }): equally likely cases [{ A, N }]; M (pairs per case) gives E[N/M], and
# meanDisclosure is null without M.
de <- function(id, A, N, M = NULL) {
  r <- o_estimands(A, N, if (is.null(M)) NA_real_ else M)
  a <- list(cases = lapply(seq_along(A), function(i) list(A = A[i], N = N[i]))); if (!is.null(M)) a$M <- M
  add(row(paste0("disclosedErrorEstimands-", id), "disclosedErrorEstimands", a, r))
  invisible(r)
}
r3 <- de("tb16-three-case", c(2, 0, 0), c(2, 3, 0), 3)
check_close(unlist(r3), c(2/5, 1/2, 1/3, 2/3, 5/9), 1e-16, "theory book ch. 16 three-case example")
r3n <- de("tb16-three-case-no-M", c(2, 0, 0), c(2, 3, 0))
stopifnot(is.na(r3n$meanDisclosure))
rmix <- de("tb16-randomized-3-5", c(3/10, 13/20), c(3, 5), 6)
check_close(c(rmix$ERR, rmix$meanFraction), c(19/160, 23/200), 1e-16, "theory book ch. 16 randomization example")
de("all-silent", c(0, 0), c(0, 0), 6)
de("one-case", 0.0247745991823067, 12, 15)

# Risk-terms widget: the all-withheld report on score A at five more tau values (tau .20 is
# evaluateReport-six-K1-tau.2-all_withheld above). Input: data/released/six-sites.json arrays.one.e verbatim (what the
# page reads), checked against the base-R pnorm array. N = 0 and E = 0, so the error term E/M is 0 and the risk equals
# the withholding term tau (M - N)/M = tau, exactly in double arithmetic at these tau values.
six_rel <- jsonlite::fromJSON(file.path(released_dir, "six-sites.json"), simplifyVector = FALSE)$arrays$one
stopifnot(identical(unlist(six_rel$ids), six_ids), identical(unlist(six_rel$criteria), "score_A"))
e_rel <- array(t(vapply(six_rel$e[[1]], function(r) vapply(r, function(x) if (is.null(x)) NA_real_ else x, 0), numeric(6))),
               c(6, 6, 1))
e_rel[!is.na(e_rel)] <- as.numeric(sprintf("%.15g", e_rel[!is.na(e_rel)]))      # re-read from the 15-digit text (jsonlite can be 1 ulp off)
check_close(e_rel, e6a, 1e-15, "released six-site score A array vs base-R pnorm")
for (tau in c(0.05, 0.15, 0.25, 0.40, 0.50)) {
  r <- ev(sprintf("six-K1-tau%s-all_withheld", sub("^0", "", sprintf("%g", tau))), rep(1, 6), e_rel, six_ids, "score_A", tau, 1)
  stopifnot(r$M == 15, r$N == 0, r$E == 0, r$errorTerm == 0, identical(r$withholdingTerm, tau), identical(r$risk, tau))
}
# Step 5.14 (engine/API.md): the all-withheld report at the remaining tau values the Part 1 pages show
# (same input). Here tau (M - N)/M = 15 tau / 15 need not return tau bit for bit, so only near-equality is asserted.
for (tau in c(0.02, 0.14, 0.18, 0.19, 0.36, 0.37)) {
  r <- ev(sprintf("six-K1-tau%s-all_withheld", sub("^0", "", sprintf("%g", tau))), rep(1, 6), e_rel, six_ids, "score_A", tau, 1)
  stopifnot(r$M == 15, r$N == 0, r$E == 0, r$errorTerm == 0, abs(r$risk - tau) <= 2e-16 * tau * 4)
}
# G-03 price of silence: the learner report 1/2/3/3/3/3 on score A at tau .20 (registry six.A.r123333.tau20.risk, .0932).
r123333 <- ev("six-K1-tau.2-123333", c(1, 2, 3, 3, 3, 3), e6a, six_ids, "score_A", 0.2, 1)
check_close(r123333$risk, o_evaluate(c(1, 2, 3, 3, 3, 3), e_rel, 0.2, 1)$risk, 1e-15, "1/2/3/3/3/3 on the released array")
stopifnot(r123333$N == 9, abs(r123333$risk - 0.0932) < 5e-5)

# Optimum read-outs for the tau-grid widget. The exactOptimum rows (oracle-optimize exactOptimum-six-A-<family>-tau.XX)
# compare grade, grades, risk, familySize, containsAllWithheld and label only, so each optimum's N, E, E/N, E/M and
# tau (M - N)/M are evaluateReport rows of the optimal report, found here by a second, independent full enumeration
# (_oracle.R): tau = .02, .03, ..., .50; families all (4,683 reports) and at most 3 grades (603); same input array.
# Reports within 1e-12 of the smallest risk tie (none sits in (1e-13, 1e-10]); the row evaluates the lexicographically
# first optimum (exactOptimum's grade). Id: evaluateReport-six-K1-optimum-<all|cap3>-tau.XX (tau with two decimals).
R6o <- oracle_reports(6)
R6o <- R6o[do.call(order, unname(as.data.frame(R6o))), , drop = FALSE]                  # lexicographic order
G6o <- apply(R6o, 1, max)
stopifnot(nrow(R6o) == 4683, sum(G6o <= 3) == 603)
cnt6 <- t(apply(R6o, 1, function(g) unlist(oracle_report_counts(g, e_rel[, , 1]))))       # columns N, E
grid_opt <- list()
for (fam in c("all", "cap3")) for (tau in (2:50) / 100) {
  keep <- if (fam == "all") rep(TRUE, nrow(R6o)) else G6o <= 3
  risk <- (cnt6[keep, "E"] + tau * (15 - cnt6[keep, "N"])) / 15
  d <- risk - min(risk)
  if (any(d > 1e-13 & d <= 1e-10)) stop("ambiguous near-tie: ", fam, " tau ", tau, call. = FALSE)
  opt <- which(d <= 1e-13); g <- R6o[keep, , drop = FALSE][opt[1], ]
  id <- sprintf("six-K1-optimum-%s-tau%s", fam, sub("^0", "", sprintf("%.2f", tau)))
  r <- ev(id, g, e_rel, six_ids, "score_A", tau, 1)
  check_close(rep(r$risk, 2), c(oracle_risk(g, e_rel[, , 1], tau), min(risk)), 1e-15, paste("optimum risk", id))
  grid_opt[[id]] <- list(grade = paste(g, collapse = ""), ties = length(opt), N = r$N, E = r$E, risk = r$risk)
}
Ns <- function(fam) vapply(grid_opt[startsWith(names(grid_opt), paste0("six-K1-optimum-", fam, "-"))], `[[`, 0, "N")
stopifnot(!is.unsorted(Ns("all")), !is.unsorted(Ns("cap3")))      # disclosure of the optimum never falls as tau rises

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
source("r-export/15_part2.R")
stopifnot(identical(p2$six$e, e_rel))                                    # the same released score-A array
ftau <- function(tau) sub("^0", "", sprintf("%g", tau))
gtxt <- function(g) paste(g, collapse = "")
abc <- c("A", "B", "C")
# G-02 report builder: 1/2/2/2/2/3 ({A} > {B, C, D, E} > {F}): N = 9 of 15, s = .6.
d122223 <- o_disclosure(c(1, 2, 2, 2, 2, 3)); stopifnot(d122223$N == 9, d122223$s == 0.6)
add(row("disclosure-1.2.2.2.2.3", "disclosure", list(g = vec(c(1, 2, 2, 2, 2, 3))), d122223))
# G-01 one pair: pi = .90 at tau = .10 (case clamped-pi0): e_AB = .10 = tau, so stating A above B and withholding tie.
pd10 <- o_pair_decision(0.1, 0.9, 0.1); stopifnot(identical(unclass(pd10$best), c("iAboveJ", "withhold")))
add(row("pairDecision-0.1-0.9-tau0.1", "pairDecision", list(eIJ = 0.1, eJI = 0.9, tau = 0.1), pd10))
# G-03 price of silence: stated pairs above tau of the exact optima (no cap at .20; at most 3 grades at .10 and .40).
for (k in c("all-tau.20", "cap3-tau.10", "cap3-tau.40")) {
  tau <- as.numeric(sub(".*tau", "0", k)); g <- p2$six$opt[[k]]$grade
  sa(sprintf("six-K1-%s-tau%s", gtxt(g), ftau(tau)), g, e_rel, six_ids, "score_A", tau, 1)
}
# G-04 KRW Example 1 at omega_2 = 1, .80, .81, .50 and tau = .20, .25: all 13 reports of three firms (evaluateReport),
# the independent pair choices (relaxedPairRisk) and the stated pairs above tau of every report that states a pair.
krw1_rel <- c()
for (lab in names(p2$krw1_omegas)) for (tau in c(0.20, 0.25)) {
  e_k <- p2$krw1(p2$krw1_omegas[[lab]]); id0 <- sprintf("krwex1-omega%s-tau%s", lab, ftau(tau))
  for (r in seq_len(nrow(p2$reports3))) {
    g <- p2$reports3[r, ]
    ev(sprintf("%s-r%s", id0, gtxt(g)), g, e_k, abc, "score", tau, 1)
    if (max(g) > 1) sa(sprintf("%s-r%s", id0, gtxt(g)), g, e_k, abc, "score", tau, 1)
  }
  rp(id0, e_k, abc, "score", tau, 1); krw1_rel[id0] <- o_relaxed(e_k, tau, 1)
}
check_close(krw1_rel[c("krwex1-omega1-tau.2", "krwex1-omega.80-tau.2", "krwex1-omega.50-tau.2")], c(0.1595, 0.1589, 0.1410), 5e-5,
            "G-04 pairwise costs at tau .20: .1595 (omega_2 = 1), .1589 (.80), .1410 (.50)")
check_close(min(sapply(seq_len(nrow(p2$reports3)), function(r) o_evaluate(p2$reports3[r, ], p2$krw1(1), 0.2, 1)$risk)), 0.1728, 5e-5,
            "G-04 coherent optimum at omega_2 = 1: .1728")
check_close(o_evaluate(1:3, p2$krw1(1), 0.2, 1)$risk, 0.1860, 5e-5, "G-04 full order at omega_2 = 1: .1860")
# G-04 / G-05 theory book ch. 10 law at tau = .20: the 13 reports, the pair choices (1/6) and the stated pairs above tau.
law_risk <- c()
for (r in seq_len(nrow(p2$reports3))) {
  g <- p2$reports3[r, ]
  law_risk[gtxt(g)] <- ev(sprintf("tb10-law3-tau.2-r%s", gtxt(g)), g, p2$tb10$e, abc, "score", 0.2, 1)$risk
  if (max(g) > 1) sa(sprintf("tb10-law3-tau.2-r%s", gtxt(g)), g, p2$tb10$e, abc, "score", 0.2, 1)
}
check_close(law_risk[c("112", "122", "111", "123")], c(11/60, 11/60, 1/5, 1/5), 1e-15, "theory book ch. 10: 11/60, 11/60, 1/5, 1/5")
stopifnot(min(law_risk[!names(law_risk) %in% c("112", "122", "111", "123")]) >= 11/30 - 1e-15)   # ch. 10: others >= 11/30
rp("tb10-law3-tau.2", p2$tb10$e, abc, "score", 0.2, 1)
check_close(o_relaxed(p2$tb10$e, 0.2, 1), 1/6, 1e-15, "theory book ch. 10: pairwise cost 1/6")
# G-06 / G-08 four-unit two-criterion law (ch. 14/16), weights (3/5, 2/5): the exact optimum among all 75 reports at
# tau = .01, ..., .50 (first optimum in lexicographic order; evaluateReport gives its N, E, E/N), and the best strict
# order at tau = .25 (exactly 4 grades, 7/40).
R4o <- oracle_reports(4); eb4 <- wsum(tb14$e, tb14_w)
for (tau in (1:50) / 100) {
  o <- p2$optimum(R4o, eb4, tau, paste("tb14", tau))
  ev(sprintf("tb14-optimum-all-tau%s", sub("^0", "", sprintf("%.2f", tau))), o$grade, tb14$e, abcd, two, tau, tb14_w)
}
check_close(o_evaluate(p2$optimum(R4o, eb4, 0.2, "tb14 .2")$grade, tb14$e, 0.2, tb14_w)$risk, 17/120, 1e-15, "G-06: 17/120 at tau .20")
o_eq4 <- p2$optimum(R4o[apply(R4o, 1, max) == 4, ], eb4, 0.25, "tb14 eq4")
check_close(ev("tb14-optimum-eq4-tau.25", o_eq4$grade, tb14$e, abcd, two, 0.25, tb14_w)$risk, 7/40, 1e-15, "G-08: best strict order 7/40")
# G-05 disclosed errors: reports under the draws' empirical law (drawErrors of seed 1 with 100 draws and of seed 424242
# with 5 draws), the wrong stated directions in every draw (realizedWrong) and in each order of the ch. 10 law.
for (g in list(c(1, 2, 3, 3, 4, 5), c(1, 1, 2, 2, 3, 3), 1:6, rep(1, 6)))
  ev(sprintf("six-draws-S100-seed1-tau.2-r%s", gtxt(g)), g, p2$six$drawE1, six_ids, "score_A", 0.2, 1)
ev("six-draws-S5-seed424242-tau.2-r123345", c(1, 2, 3, 3, 4, 5), p2$six$drawE4, six_ids, "score_A", 0.2, 1)
for (spec in list(list("S100-seed1", p2$six$draws1, p2$six$drawE1), list("S5-seed424242", p2$six$draws4, p2$six$drawE4))) {
  g <- c(1, 2, 3, 3, 4, 5); D <- c()
  for (s in seq_along(spec[[2]])) {
    th <- cbind(spec[[2]][[s]])
    rw(sprintf("six-%s-draw%03d-r123345", spec[[1]], s), g, th); D[s] <- o_realized_wrong(g, th)
  }
  check_close(mean(D), o_evaluate(g, spec[[3]], 0.2, 1)$E, 1e-13, paste("mean wrong count = E under the draws' law", spec[[1]]))
}
for (g in list(c(1, 1, 2), c(1, 2, 2), 1:3, c(1, 1, 1))) for (o in names(p2$tb10$states))
  rw(sprintf("tb10-law3-%s-r%s", o, gtxt(g)), g, cbind(p2$tb10$states[[o]]))
stopifnot(o_realized_wrong(c(1, 1, 2), cbind(p2$tb10$states$CBA)) == 2, o_realized_wrong(c(1, 1, 2), cbind(p2$tb10$states$ACB)) == 1)
# G-09 / S-02 lambda <-> tau at the lambda values the pages show, and back along the six-site tau grid.
for (l in c(1/3, 2/3, 0.01, 0.05, 0.08, 0.75))
  add(row(sprintf("lambdaToTau-%g", l), "lambdaToTau", list(lambda = l), list(tau = l / (1 + l))))
stopifnot(abs(1/3 / (1 + 1/3) - 1/4) < 1e-16, abs(2/3 / (1 + 2/3) - 2/5) < 1e-16)
for (t in (2:50) / 100) if (!any(abs(t - c(0.1, 0.2, 0.25, 0.5)) < 1e-12))
  add(row(sprintf("tauToLambda-%.6g", t), "tauToLambda", list(tau = t), list(lambda = t / (1 - t))))
# G-09 KRW risk of the exact optimum (no cap) at every tau of the six-site grid, lambda = tau / (1 - tau).
for (tau in (2:50) / 100) {
  lab <- sub("^0", "", sprintf("%.2f", tau)); g <- p2$six$opt[[paste0("all-tau", lab)]]$grade; l <- tau / (1 - tau)
  kr <- o_krw(g, e_rel, l)
  check_close(o_evaluate(g, e_rel, tau, 1)$risk, tau + (1 - tau) * kr, 1e-15, paste("KRW affine identity on the grid", lab))
  add(row(sprintf("krwRisk-six-optimum-all-tau%s", lab), "krwRisk", list(g = vec(g), E = earr(e_rel, six_ids, "score_A"), lambda = l),
          list(risk = kr)))
}
# G-09 / S-02 disclosure of every KRW race grid card (lambda = 0, .01, ..., 1; the grid starts at lambda = 0).
for (i in seq_along(p2$krw$grid))
  add(row(sprintf("disclosure-krw-grid-race-lambda%.2f", p2$krw$grid_lambda[i]), "disclosure", list(g = vec(p2$krw$grid[[i]])),
          o_disclosure(p2$krw$grid[[i]])))
stopifnot(o_disclosure(p2$krw$grid[[101]])$G == 97, o_disclosure(p2$krw$grid[[9]])$G == 2, o_disclosure(p2$krw$grid[[8]])$G == 1)
# S-02 the published race card on the released race array at tau = .20: evaluation, between-grade errors, stated pairs
# above tau.
ev("krw-race-card-released-tau.2", p2$krw$card, p2$krw$e, p2$krw$ids, "race_signed", 0.2, 1)
bg("krw-race-card-released", p2$krw$card, p2$krw$e, p2$krw$ids, "race_signed", 1)
sa("krw-race-card-released-tau.2", p2$krw$card, p2$krw$e, p2$krw$ids, "race_signed", 0.2, 1)
# G-07 the 30-site card (poverty, ascending expected-rank order, at most 4 grades, tau = .25; contiguous cuts searched in
# r-export/15_part2.R): disclosure, evaluation, between-grade errors and stated pairs above tau.
th_id <- "thirty-poverty-card-cap4-tau.25"
add(row(paste0("disclosure-", th_id), "disclosure", list(g = vec(p2$th$card)), o_disclosure(p2$th$card)))
ev(th_id, p2$th$card, p2$th$e, p2$th$ids, "poverty", 0.25, 1)
bg(th_id, p2$th$card, p2$th$e, p2$th$ids, "poverty", 1)
sa(th_id, p2$th$card, p2$th$e, p2$th$ids, "poverty", 0.25, 1)
check_close(o_stated_above(p2$th$card, p2$th$e, 0.25, 1)$max, 0.4464, 5e-5, "G-07 largest stated error .4464")
# G-08 family sizes with the pages' declared orders (A to F and A to D, top first).
fs(6, "order012345", list(kind = "order", order = vec(0:5)), size_order(6))
fs(4, "order0123", list(kind = "order", order = vec(0:3)), size_order(4))
stopifnot(as.character(size_order(6)) == "32", as.character(size_exactly(4, 4)) == "24", as.character(size_order(4)) == "8")

# ---- Step 6.14 confidentPairs(g, E, { tau, w }) (engine/API.md "Step 6.14: Part 2 helpers") ----------------------------
# ebar = sum_k w_k e_k; pair i < j is confident when min(ebar_ij, ebar_ji) < tau (strict). count, withheld (confident
# pairs with g_i = g_j), stated = count - withheld, pairs [i, j] (0-based, row-major upper triangle) with each pair's
# withheld flag in `pairWithheld`. Guard: each pair minimum is either exactly tau (K = 1, where ebar = e is the input
# value itself) or more than 1e-9 away, so summation order cannot move a pair across tau; rows built to probe the strict
# comparison skip the guard (strict_probe = TRUE).
o_confident <- function(g, e, tau, w, strict_probe = FALSE) {
  eb <- wsum(e, w); n <- length(g); pairs <- list(); wh <- logical()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    m <- min(eb[i, j], eb[j, i])
    if (!strict_probe) stopifnot((length(w) == 1 && m == tau) || abs(m - tau) > 1e-9)
    if (m < tau) { pairs[[length(pairs) + 1L]] <- vec(c(i, j) - 1L); wh <- c(wh, g[i] == g[j]) }
  }
  list(count = length(pairs), withheld = sum(wh), stated = length(pairs) - sum(wh), pairs = pairs, pairWithheld = I(wh))
}
cp <- function(id, g, e, ids, criteria, tau, w, pass_w = TRUE, strict_probe = FALSE) {
  r <- o_confident(g, e, tau, w, strict_probe)
  args <- list(g = vec(g), E = earr(e, ids, criteria), tau = tau)
  if (pass_w) args$w <- vec(w)
  add(row(paste0("confidentPairs-", id), "confidentPairs", args, r))
  invisible(r)
}
# Six sites, score A (released array) with three reports at tau = .10, .20, .40 (K = 1; w passed and omitted).
for (g in list(c(1, 2, 3, 3, 4, 5), c(1, 1, 2, 2, 3, 3), rep(1, 6))) for (tau in c(0.1, 0.2, 0.4))
  cp(sprintf("six-K1-%s-tau%s", gtxt(g), ftau(tau)), g, e_rel, six_ids, "score_A", tau, 1, pass_w = tau != 0.2)
cp("six-K1-123456-tau.5", 1:6, e_rel, six_ids, "score_A", 0.5, 1)
# The confident set does not depend on the report; only the withheld/stated split does.
stopifnot(identical(o_confident(1:6, e_rel, 0.2, 1)$pairs, o_confident(rep(1, 6), e_rel, 0.2, 1)$pairs),
          o_confident(rep(1, 6), e_rel, 0.2, 1)$stated == 0, o_confident(1:6, e_rel, 0.2, 1)$withheld == 0)
# The six sites' empirical law of 100 draws (seed 1): errors are multiples of 1/100; A-B is exactly .20
# (not confident).
cp("six-draws-S100-seed1-r123345-tau.2", c(1, 2, 3, 3, 4, 5), p2$six$drawE1, six_ids, "score_A", 0.2, 1)
# K = 2 weighted: the six sites' two scores at w = (.5, .5) and (.7, .3), and the ch. 14 four-unit law at (3/5, 2/5).
cp("six-K2-w.5.5-r123345-tau.2", c(1, 2, 3, 3, 4, 5), e6, six_ids, sixK, 0.2, c(0.5, 0.5))
cp("six-K2-w.7.3-r112233-tau.25", c(1, 1, 2, 2, 3, 3), e6, six_ids, sixK, 0.25, c(0.7, 0.3))
cp("tb14-w.6.4-r1223-tau.2", c(1, 2, 2, 3), tb14$e, abcd, two, 0.2, tb14_w)
# Two units (the m4 tie law).
cp("m4-r11-tau.25", c(1, 1), m4$e, AB, "score", 0.25, 1)
# S-02: KRW's published race card on the released race array at tau = .20 (count 1,575, withheld 575).
krw_cp <- cp("krw-race-card-released-tau.2", p2$krw$card, p2$krw$e, p2$krw$ids, "race_signed", 0.2, 1, pass_w = FALSE)
stopifnot(krw_cp$count == 1575, krw_cp$withheld == 575, krw_cp$stated == 1000)
# Errors exactly equal to tau (theory book ch. 10 law: e_AB = e_BC = 1/4, e_AC = 1/10, all exact in the JSON text):
# at tau = .25 only A-C is confident; at tau = .10 no pair is.
stopifnot(p2$tb10$e[1, 2, 1] == 0.25, p2$tb10$e[2, 3, 1] == 0.25, p2$tb10$e[1, 3, 1] == 0.1)
r_eq25 <- cp("tb10-law3-r111-tau.25", c(1, 1, 1), p2$tb10$e, abc, "score", 0.25, 1)
cp("tb10-law3-r112-tau.25", c(1, 1, 2), p2$tb10$e, abc, "score", 0.25, 1)
r_eq10 <- cp("tb10-law3-r123-tau.1", 1:3, p2$tb10$e, abc, "score", 0.1, 1)
stopifnot(r_eq25$count == 1, identical(unclass(r_eq25$pairs[[1]]), c(0L, 2L)), r_eq10$count == 0)
# Strict comparison at 1e-14: errors .19999999999999 (A-B), .2 (A-C), .20000000000001 (B-C) at tau = .20: only A-B.
e_near <- array(c(NA, 0.80000000000001, 0.8, 0.19999999999999, NA, 0.79999999999999, 0.2, 0.20000000000001, NA), c(3, 3, 1))
stopifnot(e_near[1, 2, 1] < 0.2, e_near[1, 3, 1] == 0.2, e_near[2, 3, 1] > 0.2, identical(p2$r15(e_near), e_near))
r_near <- cp("near-tau-r112-tau.2", c(1, 1, 2), e_near, abc, "score", 0.2, 1, strict_probe = TRUE)
stopifnot(r_near$count == 1, r_near$withheld == 1)
# Invalid inputs throw: tau outside (0, 1/2], an unknown option key (CONTRACT 7.4), a grade vector of the wrong length.
cpt <- function(id, g, opts) add(row(paste0("confidentPairs-throws-", id), "confidentPairsThrows",
  list(g = vec(g), E = earr(e_rel, six_ids, "score_A"), opts = opts), list(threw = TRUE)))
cpt("tau0", 1:6, list(tau = 0)); cpt("tau.55", 1:6, list(tau = 0.55)); cpt("unknown-key", 1:6, list(tau = 0.2, alpha = 1))
cpt("g-length5", 1:5, list(tau = 0.2))

assert_no_postrank()
write_golden("oracle-report-risk", rows, generator = "r-export/03_report_risk.R", uses_postrank = FALSE)
cat("oracle-report-risk:", length(rows), "rows\n")

# ---- postrank 1.1.0 ---------------------------------------------------------------------------------------------
load_postrank()
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
check_close(pr_tutorial$law$means, six_means, 0, "hardcoded six-site means equal pr_tutorial$law$means")
check_close(pr_tutorial$two$e, e6, 1e-15, "base-R six-site errors vs pr_tutorial$two$e")

pev <- function(id, g, pw, tau, w) {
  ids <- pw$entity_ids; criteria <- pw$criterion_ids
  v <- postrank_evaluate(setNames(as.integer(g), ids), pw, weights = setNames(w, criteria), tau = tau)
  E <- unname(v$E)
  expect <- list(M = v$M, N = v$N, s = v$disclosure_rate, G = v$G, E = vec(E), EoverN = vec(unname(v$E_over_N)),
                 EoverM = vec(unname(v$E_over_M)), Rk = vec(unname(v$criterion_risk)), Ew = sum(w * E), risk = v$primary_risk)
  o <- o_evaluate(g, pw$e, tau, w)                    # base R on the package's own array
  for (f in names(expect)) check_close(expect[[f]], o[[f]], 1e-15, paste("postrank_evaluate vs base R", id, f))
  padd(row(paste0("evaluateReport-", id), "evaluateReport",
           list(g = vec(g), E = earr(unname(pw$e), ids, criteria), tau = tau, w = vec(w)), expect))
  invisible(v)
}
six_more <- c(six_reports, list(`112345` = c(1, 1, 2, 3, 4, 5), `123344` = c(1, 2, 3, 3, 4, 4), `112223` = c(1, 1, 2, 2, 2, 3),
                                `121212` = c(1, 2, 1, 2, 1, 2)))
for (nm in names(six_more)) pev(paste0("pr_tutorial-one-tau.2-", nm), six_more[[nm]], pr_tutorial$one, 0.2, 1)
held <- postrank_evaluate(setNames(rep(1L, 6), six_ids), pr_tutorial$one, weights = c(score_A = 1), tau = 0.2)
stopifnot(held$N == 0, is.na(held$E_over_N), held$primary_risk == 0.2)
pev("pr_tutorial-one-tau.5-strict", 1:6, pr_tutorial$one, 0.5, 1)
pev("pr_tutorial-one-tau.1-213344", c(2, 1, 3, 3, 4, 4), pr_tutorial$one, 0.1, 1)
for (nm in c("all_withheld", "strict", "reversed", "112233", "111222", "312132", "123344"))
  pev(paste0("pr_tutorial-two-w.5.5-tau.25-", nm), six_more[[nm]], pr_tutorial$two, 0.25, c(0.5, 0.5))
pev("pr_tutorial-two-w.8.2-tau.2-112233", c(1, 1, 2, 2, 3, 3), pr_tutorial$two, 0.2, c(0.8, 0.2))
pev("pr_tutorial-two-w.25.75-tau.2-strict", 1:6, pr_tutorial$two, 0.2, c(0.25, 0.75))
pev("pr_tutorial-two-w1.0-tau.2-112233", c(1, 1, 2, 2, 3, 3), pr_tutorial$two, 0.2, c(1, 0))

# KRW race card (pr_case_krw): archived signed race grades at lambda = .25, i.e. tau = .2, on the race cell law.
krw <- pr_case_krw; ref <- krw$reference$single_criterion
pw_race <- krw$alternatives$race
g_race <- unname(ref$grade$race)
stopifnot(identical(names(ref$grade$race), pw_race$entity_ids), ref$tau == 0.2, ref$lambda == 0.25)
v <- postrank_evaluate(setNames(g_race, pw_race$entity_ids), pw_race, weights = c(race_signed = 1), tau = 0.2)
e_race <- unname(pw_race$e)
krw_k <- o_krw(g_race, e_race, 0.25)
card <- list(M = v$M, N = v$N, s = v$disclosure_rate, G = v$G, E = vec(unname(v$E)), EoverN = vec(unname(v$E_over_N)),
             risk = v$primary_risk, krwRisk = krw_k)
stopifnot(v$N == 1324, v$M == 4656, v$G == 3, abs(unname(v$E_over_N) - 0.136) < 5e-4, abs(v$primary_risk - 0.1818) < 5e-5)
check_close(v$primary_risk, ref$cell_metrics$race$risk, 1e-13, "KRW race card risk equals the released cell metric (summation order)")
check_close(v$primary_risk, ref$archive_metrics$archive_risk[ref$archive_metrics$criterion == "race"], 1e-6,
            "KRW race card risk near the archive risk (.1818027; the archive used the raw Pi law)")
check_close(c(v$N, v$E, v$primary_risk), unlist(o_evaluate(g_race, e_race, 0.2, 1)[c("N", "E", "risk")]), 1e-12,
            "KRW race card: base R vs postrank_evaluate")
check_close(v$primary_risk, 0.2 + 0.8 * krw_k, 1e-13, "KRW race card: R_tau = tau + (1 - tau) R_K (archived law is tie-free)")
# The golden array keeps 15 significant digits; the round trip moves the card by far less than the adapter tolerance.
rt <- jsonlite::fromJSON(jsonlite::toJSON(cube_json(e_race), digits = NA, na = "null"), simplifyVector = FALSE)[[1]]
e_rt <- array(vapply(rt, function(r) vapply(r, function(x) if (is.null(x)) NA_real_ else x, 0), numeric(97)), c(97, 97, 1))
e_rt <- aperm(e_rt, c(2, 1, 3))
rt_card <- o_evaluate(g_race, e_rt, 0.2, 1)
check_close(c(rt_card$E, rt_card$risk, o_krw(g_race, e_rt, 0.25)), c(v$E, v$primary_risk, krw_k), 1e-11,
            "KRW race card after the 15-digit JSON round trip")
padd(row("krwCard-race-lambda.25-tau.2", "krwCard",
         list(g = vec(g_race), E = earr(e_race, pw_race$entity_ids, pw_race$criterion_ids), tau = 0.2, lambda = 0.25),
         list(krwCard = card)))

# Step 6.14 (S-02): postrank_evaluate() of KRW's race grid cards at lambda = .08, .50 and 1, each at its own
# tau = lambda / (1 + lambda) (grid facts), on the released race array (data/released/case-krw.json: the package's
# array with 15 significant digits). The lambda = .25 grid card is the published card (krwCard row above).
stopifnot(identical(p2$krw$ids, pw_race$entity_ids), max(abs(p2$krw$e - p2$r15(e_race)), na.rm = TRUE) == 0,
          identical(p2$krw$grid[[26]], as.numeric(g_race)))
for (i in c(9, 51, 101)) {
  g <- p2$krw$grid[[i]]; tau <- p2$krw$grid_tau[i]
  check_close(tau, p2$krw$grid_lambda[i] / (1 + p2$krw$grid_lambda[i]), 1e-15, "grid tau = lambda / (1 + lambda)")
  vg <- postrank_evaluate(setNames(as.integer(g), pw_race$entity_ids), pw_race, weights = c(race_signed = 1), tau = tau)
  # E itself is not compared: it reaches 1,248 at lambda = 1, where 15 significant digits resolve only 1e-11, coarser
  # than the adapter's absolute tolerance; E/M (KRW's DR) and E/N carry it.
  expect <- list(M = vg$M, N = vg$N, s = vg$disclosure_rate, G = vg$G, EoverN = vec(unname(vg$E_over_N)),
                 EoverM = vec(unname(vg$E_over_M)), Rk = vec(unname(vg$criterion_risk)), risk = vg$primary_risk)
  o <- o_evaluate(g, p2$krw$e, tau, 1)
  for (f in names(expect)) check_close(expect[[f]], o[[f]], 1e-12, paste("postrank_evaluate vs base R on the released array, grid", i, f))
  check_close(unname(vg$E), o$E, 1e-10, paste("postrank_evaluate E vs base R on the released array, grid", i))
  padd(row(sprintf("evaluateReport-krw-grid-race-lambda%.2f-released", p2$krw$grid_lambda[i]), "evaluateReport",
           list(g = vec(g), E = earr(p2$krw$e, p2$krw$ids, "race_signed"), tau = tau, w = vec(1)), expect))
}

# postrank_tie_evaluate() -> equalityNeutralRisk on exact finite tie laws (gmp rationals).
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
  provenance = list(producer = "postrank-explorer r-export/03_report_risk.R", artifact_id = "specified-law",
    artifact_hash = digest::digest(description, algo = "sha256"),
    construction_note = "Complete finite law; no sampling or rounding", created_at = "2026-10-31T00:00:00Z"))
tie_input <- function(states, masses, description) {   # the m4 vignette constructor
  ids <- rownames(states[[1]]); criteria <- colnames(states[[1]])
  as_postrank_tie_draws(c(list(schema_version = "tie-aware-input-0.1"), decl(ids, criteria, description),
    list(tie_policy = list(rule = "equality_neutral", declared = TRUE,
      justification = "Equality in a listed state is genuine target equality", observed_tie_action = "accept_declared_exact_equality"),
      equality = list(basis = "exact_finite_law", justification = "Check equality over every positive-mass state", criterion_classes = NULL),
      finite_law = list(denominator = sum(masses), value_representation = "safe_integer",
        states = lapply(seq_along(states), function(s) list(state_id = paste0("state-", s), mass_numerator = masses[s], theta = states[[s]])),
        law_definition = description, not_empirical_posterior_relabeling = TRUE))))
}
pen <- function(id, g, pw, tau, w) {
  ids <- pw$entity_ids; criteria <- pw$criterion_ids
  v <- postrank_tie_evaluate(setNames(as.integer(g), ids), pw, setNames(w, criteria), tau)
  o <- o_neutral(g, unname(pw$b), unname(pw$d), tau, w)
  check_close(c(v$primary_risk, v$R0), c(o$risk, o$R0), 1e-15, paste("postrank_tie_evaluate vs base R", id))
  padd(row(paste0("equalityNeutralRisk-", id), "equalityNeutralRisk",
           list(g = vec(g), tie = list(ids = vec(ids), criteria = vec(criteria), b = cube_json(unname(pw$b)), d = cube_json(unname(pw$d))),
                tau = tau, w = vec(w)),
           list(risk = v$primary_risk, R0 = v$R0)))
  invisible(v)
}
m4_pw <- postrank_tie_pairwise(tie_input(lapply(c(0, 1, 2), function(a) st(c(a, 1), ids = AB, criteria = "score")), c(1L, 4L, 5L),
                                         "B is 1; A is 0, 1, or 2 with masses 1/10, 4/10, 5/10"))
for (g in list(c(1, 2), c(2, 1), c(1, 1))) pen(paste0("m4-vignette-tau.25-", paste(g, collapse = "")), g, m4_pw, 0.25, 1)
v_fwd <- postrank_tie_evaluate(c(A = 1L, B = 2L), m4_pw, c(score = 1), 0.25)
check_close(c(v_fwd$primary_risk, v_fwd$R0), c(0.1, 0.15), 1e-16, "m4 vignette: A above B .1, all-withhold .25 x .6")
tb16_pw <- postrank_tie_pairwise(tie_input(list(st(c(0, 0, 2, 3), c(0, 0, 0, 1), ids = abcd, criteria = two),
                                                st(c(0, 0, 2, 1), c(0, 0, 0, 1), ids = abcd, criteria = two)), c(3L, 2L),
                                           "Theory book ch. 16 equality-neutral frontier law"))
for (tau in c(1/10, 3/10)) for (nm in names(tb16_table))
  pen(sprintf("tb16-%s-tau%g", nm, tau), tb16_table[[nm]][[1]], tb16_pw, tau, c(1/4, 3/4))
guard_pw <- postrank_tie_pairwise(tie_input(list(st(c(2, 2, 0), c(0, 1, 2), ids = c("A", "B", "C"), criteria = c("shared", "individual"))),
                                            1L, "One certain state with shared and individual attributes"))
pen("m4-guard-split-w1.0", c(1, 2, 3), guard_pw, 0.25, c(1, 0))
pen("m4-guard-split-w.5.5", c(1, 2, 3), guard_pw, 0.25, c(0.5, 0.5))
syn_pw <- postrank_tie_pairwise(read_postrank_tie_draws(system.file("examples", "synthetic-tie-aware.json", package = "postrank")))
stopifnot(identical(syn_pw$entity_ids, abcd))
w_syn <- unname(c(S = 0.6, C = 0.4)[syn_pw$criterion_ids])   # the package example's weights S = .6, C = .4
pen("synthetic-tie-aware-3321-wS.6-C.4-tau.25", c(3, 3, 2, 1), syn_pw, 0.25, w_syn)
pen("synthetic-tie-aware-all-withheld-wS.6-C.4-tau.25", c(1, 1, 1, 1), syn_pw, 0.25, w_syn)

write_golden("postrank-report-risk", prow, generator = "r-export/03_report_risk.R", uses_postrank = TRUE)
cat("postrank-report-risk:", length(prow), "rows\n")
