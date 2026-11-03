# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/frontier.ts and tauPath of engine/src/optimize.ts (Step 2.7).
#   oracle-frontier  base R only: the report cloud per disclosure N (count, min and max Ew), the lower convex hull
#                    H(m) of the theory book ch. 16 (matched-disclosure frontier), supporting vertices, matched
#                    disclosure with the mixture psi, the tau path with exact breakpoints, hulls restricted to one
#                    order, and the half-slope eligibility rule. Laws: the six tutorial sites (score A; two scores),
#                    the ch. 16 four-unit two-criterion law and the twelve CDE schools with at most three grades.
#                    postrank is not loaded; package datasets are read with base load() only.
# After the oracle group is written, postrank 1.1.0 is loaded for cross-checks only (no golden group): the CDE
# tertiles (postrank_evaluate), the archived tutorial frontier (cached HiGHS solves) and postrank_cuts on the order
# hulls.
# Conventions (engine/API.md): grade 1 = highest priority; "i above j is stated" when g[i] < g[j]; Ew = sum_k w_k E_k;
# a report's point is (N, Ew); H(m) = min over mixtures psi with mean disclosure m; the optimum at tau minimizes
# Ew - tau N, so it is the hull vertex supported by slope tau. Inputs are written with 15 significant digits and every
# expected value is computed from those rounded inputs.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

# ---- JSON shaping and checks (as r-export/04_optimize.R) ------------------------------------------------------------
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
o_lexsort <- function(G) G[do.call(order, unname(as.data.frame(G))), , drop = FALSE]
rowmax <- function(G) if (ncol(G) == 1) G[, 1] else do.call(pmax, unname(as.data.frame(G)))
fam_all <- function() list(kind = "all")
fam_atmost <- function(G) list(kind = "atMost", G = G)
fam_exactly <- function(G) list(kind = "exactly", G = G)
fam_order <- function(order0, G = NULL) { f <- list(kind = "order", order = vec(order0)); if (!is.null(G)) f$G <- G; f }
fmt_tau <- function(t) sub("^0", "", sprintf("%.4g", t))

# ---- enumeration (the same construction as r-export/04_optimize.R) --------------------------------------------------
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
o_scan <- function(n, gmax, ks, f) {
  r <- o_rgs(n, gmax)
  for (k in ks) {
    R <- r$rgs[r$k == k, , drop = FALSE]; P <- o_perms(k)
    if (nrow(R) >= nrow(P)) for (a in seq_len(nrow(P))) f(matrix(P[a, ][R], nrow(R), n))
    else for (b in seq_len(nrow(R))) f(P[, R[b, ], drop = FALSE])
  }
}
o_all_reports <- function(n) { out <- list(); o_scan(n, n, seq_len(n), function(G) out[[length(out) + 1L]] <<- G); do.call(rbind, out) }
o_eval_chunk <- function(G, e) {
  n <- ncol(G); K <- dim(e)[3]; E <- matrix(0, nrow(G), K); N <- integer(nrow(G))
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    lt <- G[, i] < G[, j]; gt <- G[, i] > G[, j]; N <- N + (lt | gt)
    for (k in seq_len(K)) E[, k] <- E[, k] + e[i, j, k] * lt + e[j, i, k] * gt
  }
  list(E = E, N = N)
}
o_in_family <- function(G, f) {
  k <- rowmax(G)
  switch(f$kind, all = rep(TRUE, nrow(G)), atMost = k <= f$G, exactly = k == f$G, order = {
    ord <- unclass(f$order) + 1L; X <- G[, ord, drop = FALSE]; n <- length(ord)
    d <- X[, -1, drop = FALSE] - X[, -n, drop = FALSE]
    ok <- X[, 1] == 1L & rowSums(d != 0L & d != 1L) == 0
    if (!is.null(f$G)) ok <- ok & k <= f$G
    ok
  })
}
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

# ---- frontier oracle (theory book ch. 16) -----------------------------------------------------------------------
TIE <- 1e-13; AMBIG <- 1e-9
# The cloud per attained N: count, min and max Ew, and the reports attaining the minimum (within 1e-13; nothing may
# sit in (1e-13, 1e-9] above it, or the argmin is flagged ambiguous and no grade is published for it).
o_cloud <- function(G, Ew, N) {
  Ns <- sort(unique(N))
  lapply(Ns, function(v) {
    idx <- which(N == v); x <- Ew[idx]; d <- x - min(x)
    list(N = v, count = length(idx), min = min(x), max = max(x), argmin = o_lexsort(G[idx[d <= TIE], , drop = FALSE]),
         ambiguous = any(d > TIE & d <= AMBIG))
  })
}
o_cloud_acc <- function(acc) {
  Ns <- which(!vapply(acc, is.null, TRUE)) - 1
  lapply(Ns, function(v) {
    a <- acc[[v + 1]]; d <- a$candEw - a$min
    list(N = v, count = a$count, min = a$min, max = a$max, argmin = o_lexsort(a$cand[d <= TIE, , drop = FALSE]),
         ambiguous = any(d > TIE & d <= AMBIG), second = a$low[2])
  })
}
cloud_json <- function(cl) lapply(cl, function(p) list(N = p$N, minEw = p$min, maxEw = p$max, count = p$count))
# Lower convex hull of (N, min Ew), strict vertices only (collinear points dropped); every non-vertex point must lie
# more than 1e-9 above the hull and successive slopes must increase by more than 1e-9 (no near-collinear vertex).
o_hull <- function(cl, label = "") {
  N <- vapply(cl, `[[`, 0, "N"); A <- vapply(cl, `[[`, 0, "min"); h <- integer()
  for (i in seq_along(N)) {
    while (length(h) >= 2) {
      a <- h[length(h) - 1]; b <- h[length(h)]
      if ((N[b] - N[a]) * (A[i] - A[a]) - (A[b] - A[a]) * (N[i] - N[a]) <= 0) h <- h[-length(h)] else break
    }
    h <- c(h, i)
  }
  if (length(h) > 2) { s <- diff(A[h]) / diff(N[h]); if (any(diff(s) <= 1e-9)) stop("near-collinear hull vertex: ", label, call. = FALSE) }
  Hm <- approx(N[h], A[h], xout = N)$y; off <- setdiff(seq_along(N), h)
  if (length(off) && any(A[off] - Hm[off] <= 1e-9)) stop("cloud point within 1e-9 of the hull: ", label, call. = FALSE)
  for (i in h) if (cl[[i]]$ambiguous || nrow(cl[[i]]$argmin) != 1) stop("hull vertex without a unique report: ", label, call. = FALSE)
  lapply(h, function(i) list(N = N[i], Ew = A[i], grade = cl[[i]]$argmin[1, ]))
}
hull_json <- function(H) list(N = vec(sapply(H, `[[`, "N")), Ew = vec(sapply(H, `[[`, "Ew")), grade = lapply(H, function(v) vec(v$grade)))
o_slopes <- function(H) if (length(H) < 2) numeric() else
  vapply(2:length(H), function(i) (H[[i]]$Ew - H[[i - 1]]$Ew) / (H[[i]]$N - H[[i - 1]]$N), 0)
o_support <- function(H, tau, label = "") {
  obj <- vapply(H, function(v) v$Ew - tau * v$N, 0); d <- obj - min(obj)
  if (any(d > 1e-12 & d <= 1e-6)) stop("supporting vertex: tau too close to a breakpoint: ", label, call. = FALSE)
  H[d <= 1e-12]
}
# tau path over (0, 1/2]: vertex i is optimal for tau in (s_i, s_{i+1}), s = edge slopes, s_0 = -Inf, s_{m+1} = +Inf.
o_tau_path <- function(H) {
  s <- c(-Inf, o_slopes(H), Inf); out <- list()
  for (i in seq_along(H)) {
    from <- max(s[i], 0); to <- min(s[i + 1], 0.5)
    if (to > from) out[[length(out) + 1]] <- list(tauFrom = from, tauTo = to, v = H[[i]])
  }
  out
}
taupath_json <- function(P) list(tauFrom = vec(sapply(P, `[[`, "tauFrom")), tauTo = vec(sapply(P, `[[`, "tauTo")),
  N = vec(sapply(P, function(p) p$v$N)), Ew = vec(sapply(P, function(p) p$v$Ew)),
  EoverN = lapply(P, function(p) if (p$v$N == 0) NA_real_ else p$v$Ew / p$v$N), grade = lapply(P, function(p) vec(p$v$grade)))
o_matched <- function(cl, H, m, label = "") {
  HN <- sapply(H, `[[`, "N"); HA <- sapply(H, `[[`, "Ew")
  stopifnot(m >= min(HN), m <= max(HN))
  p <- Filter(function(q) q$N == m, cl)
  best <- if (length(p)) {
    q <- p[[1]]; b <- list(Ew = q$min)
    if (!q$ambiguous && nrow(q$argmin) == 1) b$grade <- vec(q$argmin[1, ]) else message("matchedDisclosure: best report at N = ", m, " is not unique (", label, ")")
    b
  } else NULL
  if (m %in% HN) {
    v <- which(HN == m)
    return(list(vertex = TRUE, H = HA[v], best = best))
  }
  lo <- max(which(HN < m)); hi <- min(which(HN > m)); psi <- (m - HN[lo]) / (HN[hi] - HN[lo])
  list(vertex = FALSE, H = (1 - psi) * HA[lo] + psi * HA[hi], best = best, psi = psi,
       lowerN = HN[lo], lowerEw = HA[lo], upperN = HN[hi], upperEw = HA[hi])
}

rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
wrap <- function(a, exp, pkg) if (pkg) list(a = c(a, list(arraySource = "package")), exp = list(pkg = exp)) else list(a = a, exp = exp)

# ---- laws -----------------------------------------------------------------------------------------------------------
tut_env <- new.env(); load(file.path(postrank_src, "data", "pr_tutorial.rda"), envir = tut_env)
law <- tut_env$pr_tutorial$law
stopifnot(identical(unname(law$means[, "score_A"]), c(1.20, 0.95, 0.25, 0.15, -0.50, -0.80)))
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
o_two_state <- function() {
  ids <- c("A", "B", "C", "D"); vals <- function(s) { v <- numeric(4); v[match(strsplit(s, "")[[1]], ids)] <- 4:1; v }
  st <- list(list(c("ABCD", "ACBD"), 3), list(c("BACD", "DCBA"), 1)); e <- array(0, c(4, 4, 2))
  for (s in st) for (k in 1:2) { v <- vals(s[[1]][k]); e[, , k] <- e[, , k] + s[[2]] * outer(v, v, "<=") }
  e <- e / 4; for (k in 1:2) diag(e[, , k]) <- NA; e
}
e4 <- o_two_state(); w4 <- c(3/5, 2/5); E4 <- earr(e4, c("A", "B", "C", "D"), c("c1", "c2"))
cde_env <- new.env(); load(file.path(postrank_src, "data", "pr_case_cde.rda"), envir = cde_env)
cde_in <- cde_env$pr_case_cde$input
e12 <- r15(unname(cde_in$e)); cde_ids <- cde_in$entity_ids; E12 <- earr(e12, cde_ids, cde_in$criterion_ids)
assert_no_postrank()

# Clouds (each: law, weights, family; small families from the full list of canonical reports).
R6 <- o_all_reports(6); ev6 <- o_eval_chunk(R6, e6); R4 <- o_all_reports(4); ev4 <- o_eval_chunk(R4, e4)
small <- function(G, ev, w, f) { k <- o_in_family(G, f); o_cloud(G[k, , drop = FALSE], drop(ev$E[k, , drop = FALSE] %*% w), ev$N[k]) }
t0 <- proc.time()[["elapsed"]]
acc12 <- o_cloud_scan(12, 3, 1:3, e12, 1)
t_cde <- proc.time()[["elapsed"]] - t0
cases <- list(
  `six-A-all` = list(E = E6A, w = 1, f = fam_all(), cl = small(R6, list(E = ev6$E[, 1, drop = FALSE], N = ev6$N), 1, fam_all())),
  `six-A-cap3` = list(E = E6A, w = 1, f = fam_atmost(3), cl = small(R6, list(E = ev6$E[, 1, drop = FALSE], N = ev6$N), 1, fam_atmost(3))),
  `six-A-eq3` = list(E = E6A, w = 1, f = fam_exactly(3), cl = small(R6, list(E = ev6$E[, 1, drop = FALSE], N = ev6$N), 1, fam_exactly(3))),
  `six-A-orderABCDEF` = list(E = E6A, w = 1, f = fam_order(0:5), cl = small(R6, list(E = ev6$E[, 1, drop = FALSE], N = ev6$N), 1, fam_order(0:5))),
  `six-AB-w.5.5-cap3` = list(E = E6, w = c(0.5, 0.5), f = fam_atmost(3), cl = small(R6, ev6, c(0.5, 0.5), fam_atmost(3))),
  `six-AB-w.5.5-all` = list(E = E6, w = c(0.5, 0.5), f = fam_all(), cl = small(R6, ev6, c(0.5, 0.5), fam_all())),
  `tb16-all` = list(E = E4, w = w4, f = fam_all(), cl = small(R4, ev4, w4, fam_all())),
  `tb16-orderDCBA` = list(E = E4, w = w4, f = fam_order(3:0), cl = small(R4, ev4, w4, fam_order(3:0))),
  `cde-cap3` = list(E = E12, w = 1, f = fam_atmost(3), cl = o_cloud_acc(acc12), pkg = TRUE))
for (nm in names(cases)) cases[[nm]]$H <- o_hull(cases[[nm]]$cl, nm)
hv <- function(nm) cbind(N = sapply(cases[[nm]]$H, `[[`, "N"), Ew = sapply(cases[[nm]]$H, `[[`, "Ew"))

# Published values: six sites score A, ch. 16 four-unit example, CDE (storyboard S-01).
check_close(hv("six-A-all"), cbind(c(0, 8, 12, 13, 14, 15), c(0, 0.0095, 0.0248, 0.1692, 0.3576, 0.7194)), 5e-5, "six-site score-A hull")
check_close(o_slopes(cases[["six-A-all"]]$H), c(0.0012, 0.0038, 0.1444, 0.1884, 0.3618), 5e-5, "six-site score-A slopes")
check_close(hv("tb16-all"), cbind(c(0, 3, 5, 6), c(0, 3/10, 13/20, 21/20)), 1e-15, "theory book ch. 16 frontier vertices")
check_close(o_slopes(cases[["tb16-all"]]$H), c(1/10, 7/40, 2/5), 1e-15, "theory book ch. 16 slopes")
check_close(hv("tb16-orderDCBA"), cbind(c(0, 5, 6), c(0, 81/20, 99/20)), 1e-15, "ch. 16: imposed DCBA frontier")
stopifnot(identical(cases[["tb16-all"]]$H[[2]]$grade, c(1L, 1L, 1L, 2L)), identical(cases[["tb16-all"]]$H[[3]]$grade, c(1L, 2L, 2L, 3L)))
p4 <- Filter(function(q) q$N == 4, cases[["tb16-all"]]$cl)[[1]]
check_close(p4$min, 7/10, 1e-15, "ch. 16: best deterministic report with four disclosures, 7/10")
check_close(hv("cde-cap3"), cbind(c(0, 27, 45, 47, 48), c(0, 0.0044, 0.0091, 0.9010, 1.8288)), 5e-5, "CDE at-most-3 hull")
cde_s <- o_slopes(cases[["cde-cap3"]]$H)
check_close(cde_s[1:2], c(0.00016, 0.00026), 5e-6, "CDE breakpoints"); check_close(cde_s[3], 0.446, 5e-4, "CDE breakpoint .446")
stopifnot(o_slopes(cases[["cde-cap3"]]$H)[4] > 0.5)                                   # .928: no tau in (0, 1/2] selects N = 48
p48 <- Filter(function(q) q$N == 48, cases[["cde-cap3"]]$cl)[[1]]
stopifnot(p48$count == 34650, nrow(p48$argmin) == 1, abs(p48$second - 1.9088) < 5e-5, !p48$ambiguous)
cde_tertiles <- unname(cde_env$pr_case_cde$reference$actions$observed_rate_tertiles[cde_ids])
stopifnot(identical(p48$argmin[1, ], cde_tertiles))                                     # the tertiles are best at N = 48
# Half-slope endpoint (ch. 16): the full family under a tie-free law has every slope in [0, 1/2] and a strict optimum
# at tau = 1/2; the capped and fixed families need not.
for (nm in c("six-A-all", "six-AB-w.5.5-all", "tb16-all")) {
  s <- o_slopes(cases[[nm]]$H); stopifnot(all(s >= 0), all(s <= 0.5), tail(cases[[nm]]$H, 1)[[1]]$N == length(cases[[nm]]$H[[1]]$grade) * (length(cases[[nm]]$H[[1]]$grade) - 1) / 2)
}
stopifnot(any(o_slopes(cases[["tb16-orderDCBA"]]$H) > 0.5), any(o_slopes(cases[["six-A-eq3"]]$H) < 0) || cases[["six-A-eq3"]]$H[[1]]$N > 0)

# ---- rows -------------------------------------------------------------------------------------------------------
base_args <- function(cs) list(E = cs$E, w = vec(cs$w), family = cs$f)
emit <- function(id, fn, a, exp, pkg) { x <- wrap(a, exp, isTRUE(pkg)); add(row(id, fn, x$a, x$exp)) }
for (nm in names(cases)) {
  cs <- cases[[nm]]
  emit(paste0("reportCloud-", nm), "reportCloud", base_args(cs), list(cloud = cloud_json(cs$cl)), cs$pkg)
  emit(paste0("lowerHull-", nm), "lowerHull", base_args(cs), hull_json(cs$H), cs$pkg)
}
for (nm in c("six-A-all", "six-A-cap3", "six-A-eq3", "six-A-orderABCDEF", "six-AB-w.5.5-cap3", "six-AB-w.5.5-all", "tb16-all", "cde-cap3")) {
  cs <- cases[[nm]]; P <- o_tau_path(cs$H)
  emit(paste0("tauPath-", nm), "tauPath", base_args(cs), taupath_json(P), cs$pkg)
}
check_close(o_tau_path(cases[["six-A-all"]]$H) |> sapply(function(p) p$tauTo) |> head(5), c(0.0012, 0.0038, 0.1444, 0.1884, 0.3618), 5e-5,
            "six-site tau-path breakpoints")
stopifnot(identical(sapply(o_tau_path(cases[["cde-cap3"]]$H), function(p) p$v$N), c(0, 27, 45, 47)))
sv <- function(nm, taus) {
  cs <- cases[[nm]]; s <- o_slopes(cs$H)
  for (t in taus) {
    lab <- if (is.character(t)) t else fmt_tau(t)
    tau <- if (is.character(t)) s[as.integer(sub("slope", "", t))] else t
    V <- o_support(cs$H, tau, paste(nm, lab))
    emit(sprintf("supportingVertex-%s-tau%s", nm, lab), "supportingVertex", c(base_args(cs), list(tau = tau)),
         list(N = vec(sapply(V, `[[`, "N")), Ew = vec(sapply(V, `[[`, "Ew"))), cs$pkg)
  }
}
sv("six-A-all", list(0.001, 0.002, 0.05, 0.15, 0.20, 0.40, 0.50, "slope3"))     # slope3: tied vertices N = 12 and 13
sv("tb16-all", list(1/10, 0.15, 0.25, 2/5, 0.5))                                 # 1/10 and 2/5 are exact breakpoints
sv("cde-cap3", list(0.0001, 0.0002, 0.20, 0.45, 0.50))
sv("six-AB-w.5.5-cap3", list(0.05, 0.10, 0.20, 0.30, 0.40))                      # the archived tutorial frontier grid
md <- function(nm, ms) {
  cs <- cases[[nm]]
  for (m in ms) {
    r <- o_matched(cs$cl, cs$H, m, nm)
    exp <- list(H = r$H, best = r$best)
    if (r$vertex) exp <- c(exp, list(mixN = m, mixEw = r$H)) else
      exp <- c(exp, r[c("psi", "lowerN", "lowerEw", "upperN", "upperEw")], list(mixN = m, mixEw = r$H))
    emit(sprintf("matchedDisclosure-%s-N%d", nm, m), "matchedDisclosure", c(base_args(cs), list(N = m)), exp, cs$pkg)
  }
}
md("six-A-all", c(0, 9, 10, 12, 14, 15)); md("tb16-all", c(3, 4, 5)); md("cde-cap3", c(0, 5, 30, 46, 48)); md("six-AB-w.5.5-cap3", c(10, 11))
r4 <- o_matched(cases[["tb16-all"]]$cl, cases[["tb16-all"]]$H, 4)
check_close(c(r4$H, r4$psi, r4$best$Ew), c(19/40, 1/2, 7/10), 1e-15, "ch. 16: H(4) = 19/40 by an equal mixture; deterministic 7/10")
r48 <- o_matched(cases[["cde-cap3"]]$cl, cases[["cde-cap3"]]$H, 48)
stopifnot(identical(unclass(r48$best$grade), cde_tertiles), abs(r48$H - 1.8288) < 5e-5)
stopifnot(is.null(o_matched(cases[["six-A-all"]]$cl, cases[["six-A-all"]]$H, 10)$best))   # no report discloses 10 of 15

# orderHull: the hull of the contiguous cuts of one order (with an optional cap).
oh <- function(id, E, e, w, order0, G = NULL, expect_same_as = NULL) {
  f <- fam_order(order0, G); R <- o_all_reports(dim(e)[1]); ev <- o_eval_chunk(R, e); k <- o_in_family(R, f)
  H <- o_hull(o_cloud(R[k, , drop = FALSE], drop(ev$E[k, , drop = FALSE] %*% w), ev$N[k]), id)
  if (!is.null(expect_same_as)) stopifnot(identical(hull_json(H), hull_json(cases[[expect_same_as]]$H)))
  a <- list(E = E, order = vec(order0), w = vec(w)); if (!is.null(G)) a$G <- G
  add(row(paste0("orderHull-", id), "orderHull", a, hull_json(H)))
  invisible(H)
}
oh_abcdef <- oh("six-A-ABCDEF", E6A, e6a, 1, 0:5, expect_same_as = "six-A-orderABCDEF")
oh_abcdef3 <- oh("six-A-ABCDEF-cap3", E6A, e6a, 1, 0:5, G = 3)
oh("six-A-BACDEF", E6A, e6a, 1, c(1, 0, 2, 3, 4, 5))
oh_ab3 <- oh("six-AB-w.5.5-ABCDEF-cap3", E6, e6, c(0.5, 0.5), 0:5, G = 3)
oh("tb16-ABCD", E4, e4, w4, 0:3, expect_same_as = "tb16-all")          # ch. 16: the eight ABCD partitions give the frontier
oh("tb16-DCBA", E4, e4, w4, 3:0, expect_same_as = "tb16-orderDCBA")

# halfSlopeEligible: true only for the full family with no latent ties on positive-weight criteria.
hs <- function(id, f, tieFree, positiveWeights, value)
  add(row(paste0("halfSlopeEligible-", id), "halfSlopeEligible", list(input = list(family = f, tieFree = tieFree, positiveWeights = positiveWeights)),
          list(eligible = value)))
hs("all-tiefree", fam_all(), TRUE, TRUE, TRUE)
hs("all-ties", fam_all(), FALSE, TRUE, FALSE)
hs("cap3-tiefree", fam_atmost(3), TRUE, TRUE, FALSE)
hs("eq6-tiefree", fam_exactly(6), TRUE, TRUE, FALSE)
hs("order-tiefree", fam_order(0:5), TRUE, TRUE, FALSE)
hs("order-cap3-ties", fam_order(0:5, 3), FALSE, TRUE, FALSE)

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
source("r-export/15_part2.R")
# G-06 H(m) at every integer m without a row (six sites score A: 0, ..., 15; four-unit law: 0, ..., 6). A disclosure
# that no report attains (six sites: 1-4, 6, 7, 10; four units: 1, 2) has best = null.
md("six-A-all", c(1:8, 11, 13)); md("tb16-all", c(0, 1, 2, 6))
check_close(o_matched(cases[["six-A-all"]]$cl, cases[["six-A-all"]]$H, 9)$best$Ew - o_matched(cases[["six-A-all"]]$cl, cases[["six-A-all"]]$H, 9)$H,
            0.1464, 5e-5, "G-06: the best report with N = 9 lies .1464 above H(9)")
check_close(r4$best$Ew - r4$H, 9/40, 1e-15, "G-06: the best report with N = 4 lies 9/40 above H(4)")
# G-06 the vertex a line of slope tau touches at the other tau the page shows (.01 and the four-unit law's grid).
sv("six-A-all", list(0.01, 0.10, 0.25, 0.30)); sv("six-A-cap3", list(0.01, 0.10, 0.20, 0.40, 0.50))
sv("tb16-all", list(0.01, 0.05, 0.20, 0.30, 0.35, 0.45))
# G-06 theory book ch. 19 three-unit law under its posterior-mean order A, B, C: the order boundary (0, 0), (2, 7/10),
# (3, 7/5), last slope 7/10; a line of slope 1/2 touches (2, 7/10), the report 1/1/2, not the full order.
e19 <- p2$tb19$e; E19 <- earr(e19, p2$tb19$ids, "score")
H19 <- oh("tb19-ABC", E19, e19, 1, 0:2)
check_close(cbind(sapply(H19, `[[`, "N"), sapply(H19, `[[`, "Ew")), cbind(c(0, 2, 3), c(0, 7/10, 7/5)), 1e-15, "ch. 19 H_mean")
stopifnot(identical(H19[[2]]$grade, c(1L, 1L, 2L)), abs(diff(sapply(H19, `[[`, "Ew"))[2] - 7/10) < 1e-15)
R3f <- o_all_reports(3); ev3f <- o_eval_chunk(R3f, e19)
cases[["tb19-orderABC"]] <- list(E = E19, w = 1, f = fam_order(0:2), cl = small(R3f, ev3f, 1, fam_order(0:2)))
cases[["tb19-orderABC"]]$H <- o_hull(cases[["tb19-orderABC"]]$cl, "tb19-orderABC")
stopifnot(identical(hull_json(cases[["tb19-orderABC"]]$H), hull_json(H19)))
emit("reportCloud-tb19-orderABC", "reportCloud", base_args(cases[["tb19-orderABC"]]), list(cloud = cloud_json(cases[["tb19-orderABC"]]$cl)), FALSE)
emit("lowerHull-tb19-orderABC", "lowerHull", base_args(cases[["tb19-orderABC"]]), hull_json(cases[["tb19-orderABC"]]$H), FALSE)
sv("tb19-orderABC", list(0.20, 0.50))
stopifnot(identical(o_support(cases[["tb19-orderABC"]]$H, 0.5)[[1]]$N, 2))

assert_no_postrank()
write_golden("oracle-frontier", rows, generator = "r-export/05_frontier.R", uses_postrank = FALSE)
cat("oracle-frontier:", length(rows), "rows\n")
cat(sprintf("timings (s): CDE n = 12 at most 3 cloud scan %.2f\n", t_cde))

# ---- postrank 1.1.0 cross-checks (no golden group) ----------------------------------------------------------------
load_postrank()
check_close(pr_tutorial$two$e, o_normal_e(six_means, six_sds), 1e-15, "base-R six-site errors vs pr_tutorial$two$e")
# CDE tertiles: postrank_evaluate gives N = 48 and E = 1.8288, the best N = 48 report of the base-R cloud.
tv <- postrank_evaluate(pr_case_cde$reference$actions$observed_rate_tertiles, pr_case_cde$input,
                        weights = c(negative_chronic_absence = 1), tau = 0.2)
stopifnot(tv$N == 48)
check_close(unname(tv$E), p48$min, 1e-12, "CDE tertiles: postrank_evaluate E vs base-R min at N = 48")
check_close(tv$primary_risk, 0.082255, 5e-7, "CDE tertiles risk .082255")
# Archived tutorial frontier (HiGHS, two scores, w = (1/2, 1/2), at most 3): N at each tau = the supported vertex.
tf <- readRDS(system.file("extdata", "cached", "tutorial_frontier.rds", package = "postrank"))$value$table
for (r in seq_len(nrow(tf))) {
  V <- o_support(cases[["six-AB-w.5.5-cap3"]]$H, tf$tau[r]); stopifnot(length(V) == 1, V[[1]]$N == tf$N[r])
  check_close((V[[1]]$Ew + tf$tau[r] * (15 - V[[1]]$N)) / 15, tf$primary_risk[r], 1e-12, paste("archived frontier tau", tf$tau[r]))
}
# Order hulls against the package DP: at the midpoint of each tau-path segment, postrank_cuts(rule = "optimal")
# returns that segment's vertex.
dp_check <- function(H, pw, scores, w, G_max, direction = "descending") {
  for (p in o_tau_path(H)) {
    tau <- (p$tauFrom + p$tauTo) / 2
    s <- postrank_settings(setNames(w, pw$criterion_ids), tau = tau, G_max = as.integer(G_max))
    res <- postrank_cuts(scores, pw, s, direction = direction, rule = "optimal")
    stopifnot(identical(unname(res$grade[pw$entity_ids]), p$v$grade))
  }
}
pm <- setNames(pr_tutorial$one$means[, 1], pr_tutorial$one$entity_ids)
dp_check(oh_abcdef, pr_tutorial$one, pm, 1, 6)
dp_check(oh_abcdef3, pr_tutorial$one, pm, 1, 3)
dp_check(oh_ab3, pr_tutorial$two, postrank_composite(pr_tutorial$two$means, c(score_A = 0.5, score_B = 0.5)), c(0.5, 0.5), 3)
cat("postrank cross-checks passed (CDE tertiles, archived tutorial frontier, order hulls vs postrank_cuts)\n")
