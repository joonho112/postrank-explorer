# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for the Step 7.1 Part 3 helpers (engine/API.md "Step 7.1: Part 3 helpers"; engine/API.md §9):
# statedAgainst, relationChange, cutGrade (report.ts), bestReports (optimize.ts), reportsAtN, ruleGap (frontier.ts).
#   oracle-part3    base R only, written from engine/API.md: double loops over pairs, full enumeration of every family
#                   (canonical grade vectors in lexicographic order), the lower hull of the per-N minima, exact rationals
#                   for the theory book's ch. 19 law; postrank is not loaded. Inputs: the six sites (score A, and A + B),
#                   the frozen 30-unit league (data/precomputed/league-30.json) and its first eight units (R-04), the ch. 19
#                   three-unit law, the twelve CDE schools (data/released/case-cde.json) and the KRW lambda-grid cards.
#   postrank-part3  postrank 1.1.0 as a second source without any solve: postrank_compare(<cached analysis>, <grades>,
#                   baselines = character())$relations (relationChange counts), archived optima of cached analyses
#                   (bestReports with k = 1; reportsAtN at the optimum's N, where the optimum minimizes Ew) and the archived
#                   tutorial frontier (reportsAtN at its N). Base-R cross-checks are asserted.
# Units are 1-based here and 0-based in the rows (args and expected indices). Every row names the engine function in
# args$fn; throw rows name "<fn>Throws". Ties: sorted lists keep enumeration (lexicographic) order for values within
# tieTol (1 + |value|); each case asserts that every gap that decides the listed reports is either below 1e-14 (a tie)
# or above 1e-10, so the result cannot depend on summation order.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
source("r-export/15_part2.R")
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
r15 <- p2$r15
glist <- function(G) lapply(seq_len(nrow(G)), function(r) vec(G[r, ]))
pairlist0 <- function(P) lapply(seq_len(nrow(P)), function(r) vec(P[r, ] - 1L))   # 1-based pair rows -> 0-based [a, b]
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
throws <- function(expr) inherits(tryCatch({ force(expr); NULL }, error = function(e) e), "error")
M_of <- function(n) n * (n - 1) / 2
wsum <- function(e, w) { out <- e[, , 1] * w[1]; if (dim(e)[3] > 1) for (k in 2:dim(e)[3]) out <- out + w[k] * e[, , k]; out }
fmt <- function(x) sub("^0", "", sprintf("%.2f", x))

# ---- inputs ---------------------------------------------------------------------------------------------------------
read_rel <- function(path) jsonlite::fromJSON(path, simplifyVector = FALSE)
num <- function(x) vapply(x, function(v) if (is.null(v)) NA_real_ else as.numeric(v), 0)
mat <- function(rows) r15(t(vapply(rows, num, numeric(length(rows)))))

six_rel <- read_rel(file.path(released_dir, "six-sites.json"))
six_ids <- p2$six$ids
e6A <- p2$six$e                                                                   # 6 x 6 x 1, score A (r15)
e6AB <- array(c(mat(six_rel$arrays$two$e[[1]]), mat(six_rel$arrays$two$e[[2]])), c(6, 6, 2))
stopifnot(identical(unlist(six_rel$arrays$two$criteria), c("score_A", "score_B")), identical(e6AB[, , 1], e6A[, , 1]))
mB <- num(six_rel$tables$units$mean_B); sB <- num(six_rel$tables$units$sd_B)
eB <- outer(1:6, 1:6, function(i, j) pnorm((mB[j] - mB[i]) / sqrt(sB[i]^2 + sB[j]^2))); diag(eB) <- NA
stopifnot(all(sB == 0.2), max(abs(e6AB[, , 2] - eB), na.rm = TRUE) < 1e-15)        # released B array = base-R pnorm array
E6A <- earr(e6A, six_ids, "score_A"); E6AB <- earr(e6AB, six_ids, c("score_A", "score_B"))

tb19 <- p2$tb19; e19 <- tb19$e; E19 <- earr(e19, tb19$ids, "theta")             # e_AB = .7, e_BA = .3, e_AC = .7, e_BC = 0

cde_rel <- read_rel(file.path(released_dir, "case-cde.json"))
cde_ids <- unlist(cde_rel$arrays$error$ids); cde_lab <- unlist(cde_rel$tables$units$label)
e12 <- array(mat(cde_rel$arrays$error$e[[1]]), c(12, 12, 1))
E12 <- earr(e12, cde_ids, unlist(cde_rel$arrays$error$criteria))
cde_env <- new.env(); load(file.path(postrank_src, "data", "pr_case_cde.rda"), envir = cde_env)  # base load(), no package
stopifnot(identical(cde_env$pr_case_cde$input$entity_ids, cde_ids),
          identical(r15(unname(cde_env$pr_case_cde$input$e)), e12))                 # released array = r15(package array)
cde_tert <- as.integer(num(cde_rel$tables$reports$observed_rate_tertiles))
cde_arch <- as.integer(num(cde_rel$analyses$case_cde_12$tables$units$grade))
cde_mean <- num(cde_rel$tables$units$mean)
stopifnot(identical(cde_tert, c(1L, 1L, 1L, 2L, 2L, 1L, 2L, 2L, 3L, 3L, 3L, 3L)),
          identical(cde_arch, c(1L, 1L, 1L, 2L, 2L, 2L, 2L, 2L, 2L, 3L, 3L, 3L)),
          identical(unname(cde_tert), as.integer(num(cde_rel$tables$reports$posterior_mean_tertiles))))
cde_order <- order(-cde_mean)                                                     # posterior-mean order, top first
stopifnot(identical(cde_lab[cde_order], c("A", "C", "B", "F", "E", "D", "H", "G", "I", "K", "L", "J")), min(diff(sort(cde_mean))) > 1e-6)

lg_rel <- read_rel(file.path(prx_root, "data", "precomputed", "league-30.json"))
lg <- list(ids = unlist(lg_rel$tables$units$id), est = r15(num(lg_rel$tables$units$estimate)), se = num(lg_rel$tables$units$se),
           theta = r15(num(lg_rel$tables$units$theta)))
stopifnot(lg_rel$facts$seed == 20261030, length(lg$est) == 30, min(diff(sort(lg$est))) > 1e-9)
o_post <- function(est, se, sd0) { B <- sd0^2 / (sd0^2 + se^2); list(mean = r15(B * est), sd = r15(sqrt(B) * se)) }
o_earray <- function(m, s) { e <- outer(seq_along(m), seq_along(m), function(i, j) pnorm((m[j] - m[i]) / sqrt(s[i]^2 + s[j]^2))); diag(e) <- NA; r15(e) }
lg$post <- o_post(lg$est, lg$se, 0.15); lg$e <- array(o_earray(lg$post$mean, lg$post$sd), c(30, 30, 1))
o_flags <- function(est, se, ref, crit = 1.96) {                                  # R-02: 1 above, 2 not flagged, 3 below
  z <- (est - ref) / se; stopifnot(all(abs(abs(z) - crit) > 1e-9))
  raw <- ifelse(z > crit, 1L, ifelse(z < -crit, 3L, 2L)); match(raw, sort(unique(raw)))
}
o_tiers <- function(s, G) {                                                       # quantile positions, distinct scores
  n <- length(s); stopifnot(min(diff(sort(s))) > 1e-12); p <- rank(-s); as.integer(1 + floor((p - 1) * G / n))
}
lg_ref <- mean(lg$est)
lg$flags <- o_flags(lg$est, lg$se, lg_ref)
o_counts <- function(g, e, w = 1) { x <- outer(g, g, "<"); diag(x) <- FALSE; list(N = sum(x), Ew = sum(wsum(e, w)[x])) }
cf <- o_counts(lg$flags, lg$e)
stopifnot(cf$N == 188); check_close(cf$Ew, 24.371687119516917, 1e-11, "league flags E (registry)")
lg$pmtiers3 <- o_tiers(lg$post$mean, 3); lg$tiers3 <- o_tiers(lg$est, 3)

# The eight-unit league of R-04: the first eight units, its own posterior (prior SD .15); flags use the 30-unit mean.
l8 <- list(ids = lg$ids[1:8], est = lg$est[1:8], se = lg$se[1:8]); l8$post <- o_post(l8$est, l8$se, 0.15)
l8$e <- array(o_earray(l8$post$mean, l8$post$sd), c(8, 8, 1)); E8 <- earr(l8$e, l8$ids, "theta")

# ---- enumeration of families (canonical grade vectors, lexicographic) ----------------------------------------------
o_lexsort <- function(G) G[do.call(order, unname(as.data.frame(G))), , drop = FALSE]
o_perms <- function(k) {
  if (k == 1) return(matrix(1L, 1, 1))
  p <- o_perms(k - 1); do.call(rbind, lapply(seq_len(k), function(f) cbind(f, matrix(setdiff(seq_len(k), f)[p], nrow(p)))))
}
o_rgs <- function(n) {                                                            # set partitions as restricted growth strings
  m <- matrix(1L, 1, 1); mx <- 1L
  if (n > 1) for (p in 2:n) {
    reps <- rep(seq_len(nrow(m)), mx + 1L); nxt <- sequence(mx + 1L)
    m <- cbind(m[reps, , drop = FALSE], nxt); mx <- pmax(mx[reps], nxt)
  }
  list(m = unname(m), k = mx)
}
o_all <- function(n, gmax = n) {                                                  # ordered partitions with at most gmax grades
  if (n <= 6 || gmax <= 3) {
    G <- as.matrix(expand.grid(rep(list(seq_len(min(n, gmax))), n))); mx <- do.call(pmax, unname(as.data.frame(G)))
    ok <- rep(TRUE, nrow(G)); for (h in seq_len(min(n, gmax))) ok <- ok & (mx < h | rowSums(G == h) > 0)
    return(o_lexsort(unname(G[ok, , drop = FALSE])))
  }
  r <- o_rgs(n); out <- list()
  for (k in seq_len(min(n, gmax))) {
    R <- r$m[r$k == k, , drop = FALSE]; P <- o_perms(k)
    out[[k]] <- if (nrow(R) <= nrow(P)) do.call(rbind, lapply(seq_len(nrow(R)), function(i) P[, R[i, ], drop = FALSE]))
                else do.call(rbind, lapply(seq_len(nrow(P)), function(i) matrix(P[i, R], nrow(R))))
  }
  o_lexsort(unname(do.call(rbind, out)))
}
o_cut_grade <- function(n, cuts, order = NULL, blocks = NULL) {                    # engine/API.md cutGrade, 1-based order
  if (is.null(order)) order <- seq_len(n)
  stopifnot(length(n) == 1, n >= 2, n == round(n))
  if (!identical(sort(as.integer(order)), seq_len(n)) || any(order != round(order))) stop("order is not a permutation")
  if (length(cuts)) {
    if (any(cuts != round(cuts)) || any(cuts < 1) || any(cuts > n - 1)) stop("cut outside 1..n-1")
    if (length(cuts) > 1 && any(diff(cuts) <= 0)) stop("cuts not strictly increasing")
  }
  for (b in blocks) if (length(b) != 2 || b[1] < 1 || b[1] > b[2] || b[2] > n) stop("block outside 1 <= from <= to <= n")
  for (b in blocks) if (any(cuts >= b[1] & cuts < b[2])) stop(sprintf("cut inside block [%d, %d]", b[1], b[2]))
  g <- integer(n); g[order] <- vapply(seq_len(n), function(p) 1L + sum(cuts < p), 0L); g
}
o_order_family <- function(order, G = NULL, exact = NULL, blocks = NULL) {          # contiguous cuts; blocks = run sizes
  n <- length(order); ends <- cumsum(if (is.null(blocks)) rep(1, n) else blocks); stopifnot(tail(ends, 1) == n)
  allowed <- head(ends, -1); out <- list()
  for (h in 0:length(allowed)) {
    cs <- if (h == 0) matrix(integer(0), 1, 0) else t(combn(allowed, h))
    if (length(allowed) == 1 && h == 1) cs <- matrix(allowed, 1, 1)
    for (r in seq_len(nrow(cs))) out[[length(out) + 1L]] <- o_cut_grade(n, cs[r, ], order)
  }
  Gm <- do.call(rbind, out); gc <- apply(Gm, 1, max); keep <- rep(TRUE, nrow(Gm))
  if (!is.null(G)) keep <- keep & gc <= G
  if (!is.null(exact)) keep <- keep & gc == exact
  o_lexsort(Gm[keep, , drop = FALSE])
}
o_scan <- function(G, e, w) {                                                      # N and Ew of every report (rows of G)
  n <- ncol(G); eb <- wsum(e, w); N <- numeric(nrow(G)); Ew <- numeric(nrow(G))
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    lt <- G[, i] < G[, j]; gt <- G[, i] > G[, j]; N <- N + (lt | gt); Ew <- Ew + eb[i, j] * lt + eb[j, i] * gt
  }
  list(N = N, Ew = Ew)
}
fam_all <- function() list(kind = "all"); fam_atmost <- function(G) list(kind = "atMost", G = G)
fam_exactly <- function(G) list(kind = "exactly", G = G)
fam_order <- function(order0, G = NULL, exact = NULL, blocks = NULL) {
  f <- list(kind = "order", order = vec(order0)); if (!is.null(G)) f$G <- G; if (!is.null(exact)) f$exact <- exact
  if (!is.null(blocks)) f$blocks <- vec(blocks); f
}
fam_reports <- function(n, f) switch(f$kind, all = o_all(n), atMost = o_all(n, f$G),
  exactly = { G <- o_all(n, f$G); G[apply(G, 1, max) == f$G, , drop = FALSE] },
  order = o_order_family(as.integer(f$order) + 1L, f$G, f$exact, if (is.null(f$blocks)) NULL else as.integer(f$blocks)))
fam_cache <- new.env()
family_scan <- function(key, e, w, f) {                                            # cached enumeration + scan
  if (!exists(key, envir = fam_cache, inherits = FALSE)) {
    G <- fam_reports(dim(e)[1], f); assign(key, c(list(G = G), o_scan(G, e, w)), envir = fam_cache)
  }
  get(key, envir = fam_cache)
}

# First k positions (in enumeration order) of v sorted ascending, values within a tie kept in enumeration order.
o_topk <- function(v, k, label) {
  L <- length(v); if (L == 0) return(integer())
  o <- order(v, seq_along(v)); sv <- v[o]
  d <- diff(sv); sc <- 1 + abs(sv[-1]); tie <- d <= 1e-14 * sc
  cl <- cumsum(c(TRUE, !tie)); need <- max(which(cl <= cl[min(k, L)]))
  chk <- seq_len(min(need, L - 1))
  if (any(d[chk] > 1e-14 * sc[chk] & d[chk] <= 1e-10 * sc[chk])) stop("ambiguous near-tie: ", label, call. = FALSE)
  for (c0 in unique(cl[seq_len(need)])) stopifnot(diff(range(sv[cl == c0])) <= 1e-13)
  idx <- o[seq_len(need)]; head(idx[order(cl[seq_len(need)], idx)], k)
}

# =====================================================================================================================
# statedAgainst(g, scores, { direction }) -> { count, pairs: [{ above, below }], units }
# =====================================================================================================================
o_stated_against <- function(g, s, direction = "descending") {
  if (length(g) != length(s) || length(g) < 2) stop("length")
  if (!direction %in% c("descending", "ascending")) stop("direction")
  better <- if (direction == "descending") function(a, b) a > b else function(a, b) a < b    # a strictly better than b
  n <- length(g); P <- matrix(integer(0), 0, 2)
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    if (g[i] < g[j] && better(s[j], s[i])) P <- rbind(P, c(i, j))
    else if (g[j] < g[i] && better(s[i], s[j])) P <- rbind(P, c(j, i))
  }
  list(count = nrow(P), pairs = pairlist0(P), units = vec(sort(unique(P[, 2])) - 1L))
}
canon <- function(...) for (g in list(...)) stopifnot(identical(as.integer(p2$canonical(g)), as.integer(g)))   # inputs are canonical
sa <- function(id, g, s, direction = NULL) {
  canon(g)
  r <- if (is.null(direction)) o_stated_against(g, s) else o_stated_against(g, s, direction)
  args <- list(g = vec(g), scores = vec(s)); if (!is.null(direction)) args$direction <- direction
  add(row(paste0("statedAgainst-", id), "statedAgainst", args, r)); invisible(r)
}
# R-02 flags (1.96, reference = the mean of the 30 estimates) against the estimates; the same with negated scores
# ascending; posterior-mean tiers against the estimates; estimate tiers against the estimates (none) and the truth.
r_fl <- sa("league-flags196-vs-estimate", lg$flags, lg$est)
r_fl2 <- sa("league-flags196-vs-negestimate-ascending", lg$flags, -lg$est, "ascending")
stopifnot(identical(r_fl, r_fl2), r_fl$count > 0, all(lg$flags[unlist(r_fl$units) + 1L] >= 2))
sa("league-pmtiers3-vs-estimate", lg$pmtiers3, lg$est)
r0 <- sa("league-tiers3-vs-estimate", lg$tiers3, lg$est, "descending"); stopifnot(r0$count == 0)
sa("league-tiers3-vs-theta", lg$tiers3, lg$theta)
sa("league-flags196-vs-theta", lg$flags, lg$theta)
# Small vectors: equal scores are never against; withheld pairs never count; ascending reads smaller as better.
sa("small-ties-desc", c(1, 2, 2, 3), c(1, 1, 3, 3))
sa("small-ties-asc", c(1, 2, 2, 3), c(1, 1, 3, 3), "ascending")
sa("small-reversed", c(3, 2, 1), c(3, 2, 1))
sa("small-allwithheld", c(1, 1, 1, 1), c(4, 1, 3, 2))
sa("small-equalscores", c(1, 2, 3, 1, 2), c(5, 5, 5, 5, 5))
sa("six-sites-cap3opt-vs-meanB", p2$six$opt[["cap3-tau.20"]]$grade, mB)
sat <- function(id, g, s, opts, r_throws = TRUE) {                                 # r_throws: the R oracle also throws
  if (r_throws) stopifnot(throws(o_stated_against(g, s, opts$direction)))
  add(row(paste0("statedAgainst-throws-", id), "statedAgainstThrows", list(g = vec(g), scores = vec(s), opts = opts), list(threw = TRUE)))
}
sat("length-mismatch", c(1, 2, 3), c(1, 2), list(direction = "descending"))
sat("bad-direction", c(1, 2), c(1, 2), list(direction = "up"))
sat("unknown-option", c(1, 2), c(1, 2), list(dir = "descending"), r_throws = FALSE)   # options objects reject unknown keys

# =====================================================================================================================
# relationChange(g0, g1, E, { w }) -> { M, nSame, nNewDisclosed, nNewWithheld, nReversed, agreement, pairs }
# =====================================================================================================================
o_relation_change <- function(g0, g1, e = NULL, w = 1) {
  n <- length(g0); if (length(g1) != n || n < 2) stop("length")
  eb <- if (is.null(e)) NULL else wsum(e, w); nm <- c(`1` = "above", `-1` = "below", `0` = "withheld")
  cnt <- c(same = 0, disc = 0, with = 0, rev = 0); P <- matrix(integer(0), 0, 2); from <- to <- character(); err <- numeric()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    a <- sign(g0[j] - g0[i]); b <- sign(g1[j] - g1[i])
    if (a == b) { cnt["same"] <- cnt["same"] + 1; next }
    if (a == 0) cnt["disc"] <- cnt["disc"] + 1 else if (b == 0) cnt["with"] <- cnt["with"] + 1 else cnt["rev"] <- cnt["rev"] + 1
    P <- rbind(P, c(i, j)); from <- c(from, nm[[as.character(a)]]); to <- c(to, nm[[as.character(b)]])
    err <- c(err, if (is.null(eb) || b == 0) NA_real_ else if (b == 1) eb[i, j] else eb[j, i])
  }
  M <- M_of(n); stopifnot(sum(cnt) == M)
  list(M = M, nSame = cnt[["same"]], nNewDisclosed = cnt[["disc"]], nNewWithheld = cnt[["with"]], nReversed = cnt[["rev"]],
       agreement = cnt[["same"]] / M, pairs = pairlist0(P), from = vec(from), to = vec(to), error = vec(err))
}
rc <- function(id, g0, g1, E = NULL, e = NULL, w = NULL) {
  canon(g0, g1)
  r <- o_relation_change(g0, g1, e, if (is.null(w)) 1 else w)
  args <- list(g0 = vec(g0), g1 = vec(g1), E = if (is.null(E)) NULL else E); if (!is.null(w)) args$w <- vec(w)
  add(row(paste0("relationChange-", id), "relationChange", args, r)); invisible(r)
}
# S-01: from the CDE optimum (3/6/3) to the tertiles: 9 newly stated, 6 newly withheld, none reversed.
r_ct <- rc("cde-archived-to-tertiles", cde_arch, cde_tert, E12, e12)
stopifnot(r_ct$nNewDisclosed == 9, r_ct$nNewWithheld == 6, r_ct$nReversed == 0, r_ct$nSame == 51)
ne <- sort(r_ct$error[r_ct$from == "withheld"], decreasing = TRUE)
check_close(ne[1:4], c(0.4779, 0.4520, 0.4468, 0.4389), 5e-5, "S-01 four near-even errors")
lost <- sum(o_relation_change(cde_tert, cde_arch, e12)$error[r_ct$to == "withheld"])  # archived errors of the 6 newly withheld
check_close(sum(r_ct$error[r_ct$from == "withheld"]) - lost, 1.8197, 5e-5, "S-01 net 1.82")
rc("cde-tertiles-to-archived", cde_tert, cde_arch, E12, e12)
rc("cde-archived-to-tertiles-noE", cde_arch, cde_tert)
rc("cde-archived-to-strict-pm", cde_arch, o_cut_grade(12, 1:11, cde_order), E12, e12)
rc("cde-archived-to-reversed-pm", cde_arch, o_cut_grade(12, 1:11, rev(cde_order)), E12, e12)
rc("cde-archived-to-itself", cde_arch, cde_arch, E12, e12)
# Six sites (score A; A + B with weights): the unrestricted optimum at tau .20 to the at-most-3 optimum, and back.
rc("six-A-all-to-cap3-tau.20", p2$six$opt[["all-tau.20"]]$grade, p2$six$opt[["cap3-tau.20"]]$grade, E6A, e6A)
rc("six-A-cap3-to-all-tau.20", p2$six$opt[["cap3-tau.20"]]$grade, p2$six$opt[["all-tau.20"]]$grade, E6A, e6A)
rc("six-AB-w.5.5-111123-to-112233", c(1, 1, 1, 1, 2, 3), c(1, 1, 2, 2, 3, 3), E6AB, e6AB, c(0.5, 0.5))
rc("six-AB-w.8.2-112233-to-213456", c(1, 1, 2, 2, 3, 3), c(2, 1, 3, 4, 5, 6), E6AB, e6AB, c(0.8, 0.2))
# Ch. 19 law: a reversal of every pair; the 2/1/2 report from all withheld.
rc("tb19-123-to-321", c(1, 2, 3), c(3, 2, 1), E19, e19)
rc("tb19-111-to-212", c(1, 1, 1), c(2, 1, 2), E19, e19)
# KRW race lambda-grid cards (S-02): consecutive cards, without and with the error array.
kg <- lapply(p2$krw$grid, as.integer); ch <- which(vapply(2:101, function(k) !identical(kg[[k]], kg[[k - 1]]), TRUE)) + 1L
stopifnot(length(ch) >= 2)
for (k in head(ch, 3)) rc(sprintf("krw-race-grid-lambda%s-to-%s", fmt(p2$krw$grid_lambda[k - 1]), fmt(p2$krw$grid_lambda[k])), kg[[k - 1]], kg[[k]])
k1 <- ch[1]
rc(sprintf("krw-race-grid-lambda%s-to-%s-withE", fmt(p2$krw$grid_lambda[k1 - 1]), fmt(p2$krw$grid_lambda[k1])), kg[[k1 - 1]], kg[[k1]],
   earr(p2$krw$e, p2$krw$ids, "race_signed"), p2$krw$e)
stopifnot(throws(o_relation_change(c(1, 2, 3), c(1, 2))))
add(row("relationChange-throws-length-mismatch", "relationChangeThrows", list(g0 = vec(c(1, 2, 3)), g1 = vec(c(1, 2))), list(threw = TRUE)))
add(row("relationChange-throws-w-without-E", "relationChangeThrows", list(g0 = vec(c(1, 2, 3)), g1 = vec(c(1, 1, 2)), w = vec(1)), list(threw = TRUE)))
add(row("relationChange-throws-E-size", "relationChangeThrows", list(g0 = vec(c(1, 2, 3)), g1 = vec(c(1, 1, 2)), E = E6A), list(threw = TRUE)))

# =====================================================================================================================
# cutGrade(n, cuts, { order, blocks }) -> grade vector
# =====================================================================================================================
cg <- function(id, n, cuts, order1 = NULL, blocks = NULL, expect = NULL) {
  g <- o_cut_grade(n, cuts, order1, blocks); if (!is.null(expect)) stopifnot(identical(as.integer(g), as.integer(expect)))
  args <- list(n = n, cuts = vec(cuts)); if (!is.null(order1)) args$order <- vec(order1 - 1L)
  if (!is.null(blocks)) args$blocks <- lapply(blocks, vec)
  add(row(paste0("cutGrade-", id), "cutGrade", args, list(grade = vec(g)))); invisible(g)
}
cg("n12-4.8", 12, c(4, 8), expect = rep(1:3, each = 4))
cg("n12-3.9", 12, c(3, 9), expect = rep(1:3, c(3, 6, 3)))
cg("cde-pmorder-4.8", 12, c(4, 8), cde_order, expect = cde_tert)                   # S-01 "4 | 8" = the tertiles
cg("cde-pmorder-3.9", 12, c(3, 9), cde_order, expect = cde_arch)                   # S-01 "3 | 9" = the archived 3/6/3
cg("cde-pmorder-3.6.9", 12, c(3, 6, 9), cde_order)
cg("n6-none", 6, integer(0), expect = rep(1L, 6))
cg("n6-all", 6, 1:5, expect = 1:6)
cg("n2-1", 2, 1, expect = 1:2)
cg("n6-order-BACDEF-1.3", 6, c(1, 3), c(2, 1, 3, 4, 5, 6), expect = c(2, 1, 2, 3, 3, 3))
cg("n6-blocks-2.3-cut1.3", 6, c(1, 3), c(2, 1, 3, 4, 5, 6), list(c(2, 3)))          # c = to is not inside [from, to]
cg("n6-blocks-1.2-5.6-cut2.4", 6, c(2, 4), NULL, list(c(1, 2), c(5, 6)), expect = c(1, 1, 2, 2, 3, 3))
cgt <- function(id, n, cuts, order1 = NULL, blocks = NULL, range_error = FALSE) {
  stopifnot(throws(o_cut_grade(n, cuts, order1, blocks)))
  args <- list(n = n, cuts = vec(cuts)); if (!is.null(order1)) args$order <- vec(order1 - 1L)
  if (!is.null(blocks)) args$blocks <- lapply(blocks, vec)
  add(row(paste0("cutGrade-throws-", id), "cutGradeThrows", args, if (range_error) list(threw = TRUE, rangeError = TRUE) else list(threw = TRUE)))
}
cgt("decreasing", 12, c(8, 4)); cgt("repeated", 12, c(4, 4)); cgt("zero", 12, c(0, 4)); cgt("n", 12, c(4, 12))
cgt("fraction", 12, c(4.5)); cgt("order-not-permutation", 4, 2, c(1, 1, 2, 3))
cgt("inside-block", 6, c(1, 4), NULL, list(c(3, 5)), range_error = TRUE)
cgt("inside-block-from", 6, 3, c(2, 1, 3, 4, 5, 6), list(c(3, 5)), range_error = TRUE)
cgt("block-from-above-to", 6, 1, NULL, list(c(4, 3))); cgt("block-past-n", 6, 1, NULL, list(c(5, 7))); cgt("n1", 1, integer(0))
cg("n6-block-singleton", 6, c(2, 3), NULL, list(c(3, 3)), expect = c(1, 1, 2, 3, 3, 3))

# =====================================================================================================================
# bestReports(E, { tau, w, family, k, stating, tieTol }) -> { family: { name, size }, matched, reports }
# =====================================================================================================================
o_best <- function(sc, n, tau, k, stating, label) {
  M <- M_of(n); keep <- rep(TRUE, nrow(sc$G))
  for (p in stating) keep <- keep & sc$G[, p[1]] < sc$G[, p[2]]
  idx <- which(keep); risk <- (sc$Ew[idx] + tau * (M - sc$N[idx])) / M
  sel <- idx[o_topk(risk, k, label)]
  list(size = nrow(sc$G), matched = length(idx), grade = glist(sc$G[sel, , drop = FALSE]),
       risk = vec((sc$Ew[sel] + tau * (M - sc$N[sel])) / M), N = vec(sc$N[sel]), Ew = vec(sc$Ew[sel]))
}
br <- function(id, key, E, e, w, tau, f, k, stating = list(), pass_w = TRUE, pass_k = TRUE) {
  sc <- family_scan(key, e, w, f); r <- o_best(sc, dim(e)[1], tau, k, lapply(stating, function(p) p + 1L), id)
  args <- list(E = E, tau = tau, family = f); if (pass_w) args$w <- vec(w); if (pass_k) args$k <- k
  if (length(stating)) args$stating <- lapply(stating, vec)
  add(row(paste0("bestReports-", id), "bestReports", args, r)); invisible(r)
}
# CDE, at most 3 grades, tau .20 (523,251 reports): .063774 (3/6/3, N 45), .064087, .064092, then N 47.
t0 <- proc.time()[["elapsed"]]
r_c <- br("cde-cap3-tau.20-k5", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 5)
t_cde <- proc.time()[["elapsed"]] - t0
stopifnot(r_c$size == 523251, identical(as.integer(r_c$grade[[1]]), cde_arch),
          identical(as.integer(r_c$grade[[2]]), c(1L, 1L, 1L, 1L, 1L, 1L, 2L, 2L, 2L, 3L, 3L, 3L)),
          identical(as.integer(r_c$grade[[3]]), c(1L, 1L, 1L, 2L, 2L, 2L, 3L, 3L, 3L, 3L, 3L, 3L)), r_c$N[1] == 45, r_c$N[4] == 47)
check_close(r_c$risk[1:3], c(0.0637744657711756, 0.06408688855303726, 0.06409207170264147), 1e-13, "CDE best three (archived, registry)")
check_close(r_c$risk[4], 0.07123, 5e-6, "CDE rank 4 .07123")
br("cde-cap3-tau.20-k3", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 3)
br("cde-cap3-tau.20-default-k", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 1, pass_w = FALSE, pass_k = FALSE)
r_fi <- br("cde-cap3-tau.20-stating-F-above-I-k2", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 2, list(c(5L, 8L)))
stopifnot(identical(r_fi$grade[[1]], r_c$grade[[2]]))                                   # best stating F > I = rank 2
br("cde-cap3-tau.20-stating-F-above-I-and-C-above-B-k2", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 2, list(c(5L, 8L), c(2L, 1L)))
r_imp <- br("cde-cap3-tau.20-stating-impossible", "cde-cap3", E12, e12, 1, 0.20, fam_atmost(3), 2, list(c(0L, 1L), c(1L, 0L)))
stopifnot(r_imp$matched == 0)
br("cde-cap3-tau.45-k3", "cde-cap3", E12, e12, 1, 0.45, fam_atmost(3), 3)
br("cde-cap3-tau.50-k2", "cde-cap3", E12, e12, 1, 0.50, fam_atmost(3), 2)
r_pm4 <- br("cde-pmorder-cap4-tau.20-k3", "cde-pmorder-cap4", E12, e12, 1, 0.20, fam_order(cde_order - 1L, G = 4), 3)
stopifnot(identical(as.integer(r_pm4$grade[[1]]), o_cut_grade(12, c(3, 6, 9), cde_order)), r_pm4$size == 232)
check_close(r_pm4$risk[1], 0.0368858, 5e-7, "CDE pm-order cap-4 3/3/3/3 .0368858")
# Six sites (G-02 .. G-08 inputs).
r6 <- br("six-A-all-tau.20-k5", "six-A-all", E6A, e6A, 1, 0.20, fam_all(), 5)
stopifnot(identical(as.integer(r6$grade[[1]]), as.integer(p2$six$opt[["all-tau.20"]]$grade)), r6$size == 4683)
br("six-A-cap3-tau.20-k5", "six-A-cap3", E6A, e6A, 1, 0.20, fam_atmost(3), 5)
br("six-A-eq3-tau.20-k3", "six-A-eq3", E6A, e6A, 1, 0.20, fam_exactly(3), 3)
br("six-A-all-tau.40-k3", "six-A-all", E6A, e6A, 1, 0.40, fam_all(), 3)
br("six-A-all-tau.05-k4", "six-A-all", E6A, e6A, 1, 0.05, fam_all(), 4)
br("six-A-all-tau.20-stating-C-above-B-k3", "six-A-all", E6A, e6A, 1, 0.20, fam_all(), 3, list(c(2L, 1L)))
br("six-A-cap3-tau.20-stating-B-above-C-D-above-E-k2", "six-A-cap3", E6A, e6A, 1, 0.20, fam_atmost(3), 2, list(c(1L, 2L), c(3L, 4L)))
br("six-A-order-ABCDEF-cap3-tau.20-k4", "six-A-orderABCDEF-cap3", E6A, e6A, 1, 0.20, fam_order(0:5, G = 3), 4)
br("six-A-order-ABCDEF-blocks2112-tau.20-k3", "six-A-orderABCDEF-b2112", E6A, e6A, 1, 0.20, fam_order(0:5, blocks = c(2, 1, 1, 2)), 3)
br("six-A-order-ABCDEF-eq2-tau.30-k6", "six-A-orderABCDEF-eq2", E6A, e6A, 1, 0.30, fam_order(0:5, exact = 2), 6)
br("six-AB-w.5.5-cap3-tau.20-k3", "six-AB-w.5.5-cap3", E6AB, e6AB, c(0.5, 0.5), 0.20, fam_atmost(3), 3)
br("six-AB-w.8.2-all-tau.35-k3", "six-AB-w.8.2-all", E6AB, e6AB, c(0.8, 0.2), 0.35, fam_all(), 3)
# Ch. 19 law, every report (13), tau 1/4 and 1/2: exact rational ties keep lexicographic order.
r19 <- br("tb19-all-tau.25-k13", "tb19-all", E19, e19, 1, 0.25, fam_all(), 13)
stopifnot(length(r19$grade) == 13)
r19t <- br("tb19-all-tau.30-k13", "tb19-all", E19, e19, 1, 0.30, fam_all(), 13)        # e_BA = tau: tied risks
stopifnot(any(abs(diff(r19t$risk)) < 1e-15))
br("tb19-all-tau.50-k13", "tb19-all", E19, e19, 1, 0.50, fam_all(), 13)
r_emp <- br("tb19-eq4-empty", "tb19-eq4", E19, e19, 1, 0.25, fam_exactly(4), 2)          # empty family: matched 0
stopifnot(r_emp$size == 0, r_emp$matched == 0)
br("tb19-all-tau.25-k20", "tb19-all", E19, e19, 1, 0.25, fam_all(), 20)                # k above the family size
br("tb19-all-tau.25-stating-A-above-B-k3", "tb19-all", E19, e19, 1, 0.25, fam_all(), 3, list(c(0L, 1L)))
# The eight-unit league (R-04), unrestricted (545,835 reports) and at most 3 grades (6,051).
r8 <- br("league8-all-tau.20-k3", "league8-all", E8, l8$e, 1, 0.20, fam_all(), 3)
stopifnot(r8$size == 545835, r8$N[1] == 17)
br("league8-cap3-tau.20-k3", "league8-cap3", E8, l8$e, 1, 0.20, fam_atmost(3), 3)
stopifnot(nrow(family_scan("league8-cap3", l8$e, 1, fam_atmost(3))$G) == 6051)
brt <- function(id, E, opts) add(row(paste0("bestReports-throws-", id), "bestReportsThrows", list(E = E, opts = opts), list(threw = TRUE)))
brt("k0", E6A, list(tau = 0.2, family = fam_all(), k = 0))
brt("k-fraction", E6A, list(tau = 0.2, family = fam_all(), k = 1.5))
brt("tau0", E6A, list(tau = 0, family = fam_all(), k = 1))
brt("unknown-option", E6A, list(tau = 0.2, family = fam_all(), top = 2))
brt("over-budget-n12-all", E12, list(tau = 0.2, family = fam_all(), k = 1))           # 28,091,567,595 reports

# =====================================================================================================================
# reportsAtN(E, { w, family, N, k, tieTol }) -> { family, N, count, reports: [{ grade, Ew }] }
# =====================================================================================================================
o_at_n <- function(sc, N, k, label) {
  idx <- which(sc$N == N); sel <- idx[o_topk(sc$Ew[idx], k, label)]
  list(size = nrow(sc$G), N = N, count = length(idx), grade = glist(sc$G[sel, , drop = FALSE]), Ew = vec(sc$Ew[sel]))
}
an <- function(id, key, E, e, w, f, N, k, pass_w = TRUE, pass_k = TRUE) {
  sc <- family_scan(key, e, w, f); r <- o_at_n(sc, N, k, id)
  args <- list(E = E, family = f, N = N); if (pass_w) args$w <- vec(w); if (pass_k) args$k <- k
  add(row(paste0("reportsAtN-", id), "reportsAtN", args, r)); invisible(r)
}
r48 <- an("cde-cap3-N48-k3", "cde-cap3", E12, e12, 1, fam_atmost(3), 48, 3)
stopifnot(r48$count == 34650, identical(as.integer(r48$grade[[1]]), cde_tert))
check_close(r48$Ew[1], 1.8288378703574169, 1e-13, "CDE N 48 smallest E (registry)"); check_close(r48$Ew[2], 1.90884, 5e-6, "CDE N 48 next E 1.9088")
an("cde-cap3-N48-default-k", "cde-cap3", E12, e12, 1, fam_atmost(3), 48, 1, pass_w = FALSE, pass_k = FALSE)
r45 <- an("cde-cap3-N45-k2", "cde-cap3", E12, e12, 1, fam_atmost(3), 45, 2); stopifnot(identical(as.integer(r45$grade[[1]]), cde_arch))
an("cde-cap3-N47-k2", "cde-cap3", E12, e12, 1, fam_atmost(3), 47, 2)
an("cde-cap3-N27-k3", "cde-cap3", E12, e12, 1, fam_atmost(3), 27, 3)
an("cde-cap3-N0", "cde-cap3", E12, e12, 1, fam_atmost(3), 0, 2)
r66 <- an("cde-cap3-N66-none", "cde-cap3", E12, e12, 1, fam_atmost(3), 66, 2); stopifnot(r66$count == 0)
an("cde-cap3-N1-none", "cde-cap3", E12, e12, 1, fam_atmost(3), 1, 1)
an("six-A-all-N9-k3", "six-A-all", E6A, e6A, 1, fam_all(), 9, 3)
an("six-A-all-N15-k2", "six-A-all", E6A, e6A, 1, fam_all(), 15, 2)
an("six-A-cap3-N12-k4", "six-A-cap3", E6A, e6A, 1, fam_atmost(3), 12, 4)
an("six-AB-w.5.5-cap3-N9-k2", "six-AB-w.5.5-cap3", E6AB, e6AB, c(0.5, 0.5), fam_atmost(3), 9, 2)
an("six-A-order-ABCDEF-cap3-N11-k2", "six-A-orderABCDEF-cap3", E6A, e6A, 1, fam_order(0:5, G = 3), 11, 2)
r19n <- an("tb19-all-N2-k6", "tb19-all", E19, e19, 1, fam_all(), 2, 6); stopifnot(r19n$count == 6)
an("tb19-all-N3-k6", "tb19-all", E19, e19, 1, fam_all(), 3, 6)
an("tb19-all-N1-none", "tb19-all", E19, e19, 1, fam_all(), 1, 1)
an("league8-all-N19-k3", "league8-all", E8, l8$e, 1, fam_all(), 19, 3)
an("cde-cap3-N70-above-M", "cde-cap3", E12, e12, 1, fam_atmost(3), 70, 1)                 # N > M: count 0
an("tb19-eq4-empty-N2", "tb19-eq4", E19, e19, 1, fam_exactly(4), 2, 1)
ant <- function(id, E, opts) add(row(paste0("reportsAtN-throws-", id), "reportsAtNThrows", list(E = E, opts = opts), list(threw = TRUE)))
ant("N-fraction", E6A, list(family = fam_all(), N = 1.5))
ant("N-negative", E6A, list(family = fam_all(), N = -1))
ant("over-budget-n12-all", E12, list(family = fam_all(), N = 48))

# =====================================================================================================================
# ruleGap(g, E, { w, hull, tieTol }) -> { N, Ew, H, gap, psi, lower, upper, onFrontier }
# =====================================================================================================================
o_hull <- function(sc, label) {                                                     # lower hull of the per-N minima
  Ns <- sort(unique(sc$N)); pts <- lapply(Ns, function(N) { i <- which(sc$N == N); m <- min(sc$Ew[i])
    j <- i[abs(sc$Ew[i] - m) <= 1e-13]; list(N = N, Ew = m, arg = j) })
  H <- list()
  for (p in pts) {
    while (length(H) >= 2) {
      a <- H[[length(H) - 1]]; b <- H[[length(H)]]
      cross <- (b$N - a$N) * (p$Ew - a$Ew) - (b$Ew - a$Ew) * (p$N - a$N)        # <= 0: b is not strictly below a-p
      if (cross <= 1e-12) H[[length(H)]] <- NULL else break
    }
    H[[length(H) + 1]] <- p
  }
  for (v in H) if (length(v$arg) != 1) stop("hull vertex with tied reports: ", label)
  list(N = vapply(H, `[[`, 0, "N"), Ew = vapply(H, `[[`, 0, "Ew"), grade = lapply(H, function(v) vec(sc$G[v$arg, ])))
}
hull_json <- function(h) lapply(seq_along(h$N), function(i) list(N = h$N[i], Ew = h$Ew[i], grade = h$grade[[i]]))
o_rule_gap <- function(g, e, w, h, tieTol = 1e-12) {
  n <- length(g); M <- M_of(n); cnt <- o_counts(g, e, w); N <- cnt$N; Ew <- cnt$Ew
  if (N < min(h$N) || N > max(h$N)) stop("N outside the hull")
  v <- match(N, h$N)
  if (!is.na(v)) { H <- h$Ew[v]; psi <- NA_real_; lo <- up <- v } else {
    lo <- max(which(h$N < N)); up <- min(which(h$N > N)); psi <- (h$N[up] - N) / (h$N[up] - h$N[lo])
    H <- psi * h$Ew[lo] + (1 - psi) * h$Ew[up]
  }
  gap <- Ew - H
  if (abs(gap) > 1e-14 * M && abs(gap) <= 1e-10 * M && tieTol == 1e-12) stop("gap in the ambiguous band")
  if (abs(gap) <= tieTol * M) gap <- 0
  list(N = N, Ew = Ew, H = H, gap = gap, psi = psi, lowerN = h$N[lo], lowerEw = h$Ew[lo], upperN = h$N[up], upperEw = h$Ew[up],
       onFrontier = gap == 0)
}
rg <- function(id, g, E, e, w, h, tieTol = NULL, pass_w = TRUE) {
  canon(g)
  r <- if (is.null(tieTol)) o_rule_gap(g, e, w, h) else o_rule_gap(g, e, w, h, tieTol)
  args <- list(g = vec(g), E = E, hull = hull_json(h)); if (pass_w) args$w <- vec(w); if (!is.null(tieTol)) args$tieTol <- tieTol
  add(row(paste0("ruleGap-", id), "ruleGap", args, r)); invisible(r)
}
h12 <- o_hull(family_scan("cde-cap3", e12, 1, fam_atmost(3)), "cde")
stopifnot(identical(h12$N, c(0, 27, 45, 47, 48)))
check_close(h12$Ew, c(0, 0.0044, 0.0091, 0.9010, 1.8288), 5e-5, "CDE hull")
r_t <- rg("cde-cap3-tertiles", cde_tert, E12, e12, 1, h12); stopifnot(r_t$gap == 0, r_t$onFrontier, is.na(r_t$psi))
r_a <- rg("cde-cap3-archived", cde_arch, E12, e12, 1, h12); stopifnot(r_a$gap == 0)
r_2 <- rg("cde-cap3-rank2", as.integer(r_c$grade[[2]]), E12, e12, 1, h12, pass_w = FALSE); stopifnot(r_2$gap > 0, is.na(r_2$psi))         # N 45, at a vertex
rg("cde-cap3-rank3", as.integer(r_c$grade[[3]]), E12, e12, 1, h12)
rg("cde-cap3-allwithheld", rep(1L, 12), E12, e12, 1, h12)
r_b1 <- rg("cde-cap3-pmorder-1.2", o_cut_grade(12, c(1, 2), cde_order), E12, e12, 1, h12)          # N 21, between 0 and 27
r_b2 <- rg("cde-cap3-pmorder-2.6", o_cut_grade(12, c(2, 6), cde_order), E12, e12, 1, h12)          # N 44, between 27 and 45
stopifnot(r_b1$N == 21, !is.na(r_b1$psi), r_b2$N == 44, !is.na(r_b2$psi), r_b2$gap > 0)
h6 <- o_hull(family_scan("six-A-all", e6A, 1, fam_all()), "six all")
rg("six-A-all-cap3opt", p2$six$opt[["cap3-tau.20"]]$grade, E6A, e6A, 1, h6)
rg("six-A-all-allopt-tau.20", p2$six$opt[["all-tau.20"]]$grade, E6A, e6A, 1, h6)
r_bac <- rg("six-A-all-BACDEF", c(2, 1, 3, 4, 5, 6), E6A, e6A, 1, h6); stopifnot(r_bac$gap > 0.1)
rg("six-A-all-BACDEF-tieTol.1", c(2, 1, 3, 4, 5, 6), E6A, e6A, 1, h6, tieTol = 0.1)   # |gap| <= .1 M: on the frontier
r_b2 <- rg("six-A-all-112334", c(1, 1, 2, 3, 3, 4), E6A, e6A, 1, h6)
h6c <- o_hull(family_scan("six-A-cap3", e6A, 1, fam_atmost(3)), "six cap3")
rg("six-A-cap3-112233", c(1, 1, 2, 2, 3, 3), E6A, e6A, 1, h6c)
rg("six-A-cap3-122233", c(1, 2, 2, 2, 3, 3), E6A, e6A, 1, h6c)
# A hull of a poor family (contiguous cuts of the reversed order F..A): a report outside it, below H, keeps a negative gap.
h6r <- o_hull(family_scan("six-A-orderFEDCBA", e6A, 1, fam_order(5:0)), "six reversed order")
r_neg <- rg("six-A-reversed-order-hull-112233-below", c(1, 1, 2, 2, 3, 3), E6A, e6A, 1, h6r); stopifnot(r_neg$gap < -1, !r_neg$onFrontier)
rg("six-A-reversed-order-hull-112334-below", c(1, 1, 2, 3, 3, 4), E6A, e6A, 1, h6r)
h6ab <- o_hull(family_scan("six-AB-w.5.5-cap3", e6AB, c(0.5, 0.5), fam_atmost(3)), "six AB cap3")
rg("six-AB-w.5.5-cap3-111123", c(1, 1, 1, 1, 2, 3), E6AB, e6AB, c(0.5, 0.5), h6ab)
rg("six-AB-w.5.5-cap3-112233", c(1, 1, 2, 2, 3, 3), E6AB, e6AB, c(0.5, 0.5), h6ab)
h19 <- o_hull(family_scan("tb19-all", e19, 1, fam_all()), "tb19")
for (r in seq_len(nrow(p2$reports3))) rg(paste0("tb19-all-", paste(p2$reports3[r, ], collapse = "")), p2$reports3[r, ], E19, e19, 1, h19)
# R-04: the eight-unit league's rules against H over A_8 and over A_<=3.
h8 <- o_hull(family_scan("league8-all", l8$e, 1, fam_all()), "league8 all")
stopifnot(identical(h8$N, c(0, 7, 13, 17, 19, 22, 23, 25, 26, 27, 28)))
o_pm_cuts <- function(e, order1, G, tau) {                                          # best contiguous cuts by brute force
  n <- length(order1); best <- NULL
  for (h in 0:(G - 1)) { cs <- if (h == 0) matrix(integer(0), 1, 0) else t(combn(n - 1, h))
    for (r in seq_len(nrow(cs))) { g <- o_cut_grade(n, cs[r, ], order1); c0 <- o_counts(g, e)
      risk <- (c0$Ew + tau * (M_of(n) - c0$N)) / M_of(n); if (is.null(best) || risk < best$risk - 1e-10) best <- list(g = g, risk = risk) } }
  best$g
}
l8$rules <- list(tiers3 = o_tiers(l8$est, 3), flags196 = o_flags(l8$est, l8$se, lg_ref), pmtiers3 = o_tiers(l8$post$mean, 3),
                 strict = o_cut_grade(8, 1:7, order(-l8$est)), pmcuts3 = o_pm_cuts(l8$e, order(-l8$post$mean), 3, 0.20),
                 opt = as.integer(r8$grade[[1]]))
stopifnot(o_counts(l8$rules$pmcuts3, l8$e)$N == 17, o_counts(l8$rules$flags196, l8$e)$N == 19, o_counts(l8$rules$tiers3, l8$e)$N == 21)
for (nm in names(l8$rules)) rg(paste0("league8-all-", nm), l8$rules[[nm]], E8, l8$e, 1, h8)
check_close(o_rule_gap(l8$rules$tiers3, l8$e, 1, h8)$gap, 0.6429160167257906, 1e-12, "R-04 tiers3 gap (registry)")
stopifnot(o_rule_gap(l8$rules$pmcuts3, l8$e, 1, h8)$gap == 0, o_rule_gap(l8$rules$flags196, l8$e, 1, h8)$gap == 0)
h8c <- o_hull(family_scan("league8-cap3", l8$e, 1, fam_atmost(3)), "league8 cap3")
for (nm in c("tiers3", "flags196", "pmtiers3", "pmcuts3")) rg(paste0("league8-cap3-", nm), l8$rules[[nm]], E8, l8$e, 1, h8c)
# Throws: N above the hull's range (strict order against the cap-3 hull, N 66 > 48) and below it (a hull from N 27).
rgt <- function(id, g, E, e, h) { stopifnot(throws(o_rule_gap(g, e, 1, h)))
  add(row(paste0("ruleGap-throws-", id), "ruleGapThrows", list(g = vec(g), E = E, w = vec(1), hull = hull_json(h)), list(threw = TRUE, rangeError = TRUE))) }
rgt("cde-N66-above-cap3-hull", o_cut_grade(12, 1:11, cde_order), E12, e12, h12)
h12t <- lapply(h12, function(x) x[-1]); rgt("cde-N0-below-truncated-hull", rep(1L, 12), E12, e12, h12t)

write_golden("oracle-part3", rows, generator = "r-export/16_part3.R", uses_postrank = FALSE)
cat("oracle-part3:", length(rows), "rows\n")
cat(sprintf("timings (s): CDE n = 12 at most 3 enumeration and scan %.2f\n", t_cde))
oracle_cache <- fam_cache

# =====================================================================================================================
# postrank 1.1.0: postrank_compare()$relations (no solve) and archived optima of cached analyses
# =====================================================================================================================
load_postrank()
prow <- list()
padd <- function(r) prow[[length(prow) + 1L]] <<- r
cached <- function(key) readRDS(system.file("extdata", "cached", paste0(key, ".rds"), package = "postrank"))$value
check_close(pr_case_cde$input$e, cde_env$pr_case_cde$input$e, 0, "base load() CDE array equals the package dataset")

# relationChange counts: postrank_compare(<fit>, <named grades>, baselines = character())$relations from the archived
# reference grade g0 to each supplied grade g1 (evaluated only; nothing is solved).
pc_rel <- function(id, fit, g1s) {
  ids <- fit$pairwise$entity_ids; g0 <- unname(get_grades(fit)[ids])
  cmp <- do.call(postrank_compare, c(list(fit), lapply(g1s, function(g) setNames(g, ids)), list(baselines = character())))
  stopifnot(identical(cmp$relations$method, names(g1s)))
  for (m in names(g1s)) {
    rr <- cmp$relations[cmp$relations$method == m, ]
    o <- o_relation_change(g0, g1s[[m]])
    stopifnot(o$nSame == rr$n_same, o$nNewDisclosed == rr$n_new_disclosed, o$nNewWithheld == rr$n_new_withheld,
              o$nReversed == rr$n_reversed, abs(o$agreement - rr$agreement) < 1e-15)
    padd(row(sprintf("relationChange-%s-to-%s", id, m), "relationChange", list(g0 = vec(g0), g1 = vec(unname(g1s[[m]])), E = NULL),
             list(M = choose(length(ids), 2), nSame = rr$n_same, nNewDisclosed = rr$n_new_disclosed, nNewWithheld = rr$n_new_withheld,
                  nReversed = rr$n_reversed, agreement = rr$agreement)))
  }
}
cde_fit <- cached("case_cde_12"); stopifnot(identical(unname(get_grades(cde_fit)[cde_ids]), cde_arch))
ref <- pr_case_cde$reference$actions
pc_rel("case_cde_12", cde_fit, list(observed_rate_tertiles = unname(ref$observed_rate_tertiles[cde_ids]),
                                    posterior_mean_tertiles = unname(ref$posterior_mean_tertiles[cde_ids]),
                                    all_withheld = rep(1L, 12), strict_pm_order = o_cut_grade(12, 1:11, cde_order)))
stopifnot(prow[[1]]$expect$nNewDisclosed == 9, prow[[1]]$expect$nNewWithheld == 6)
t1 <- cached("tutorial_one"); t2 <- cached("tutorial_two")
pc_rel("tutorial_one", t1, list(all_tau20 = as.integer(p2$six$opt[["all-tau.20"]]$grade), strict = 1:6, BACDEF = c(2L, 1L, 3L, 4L, 5L, 6L),
                                reversed = 6:1))
pc_rel("tutorial_two", t2, list(cap3_A = c(1L, 1L, 2L, 2L, 3L, 3L), strict = 1:6))
kfit <- cached("case_krw_signed97"); stopifnot(identical(kfit$pairwise$entity_ids, p2$krw$ids))
pc_rel("case_krw_signed97", kfit, list(grid_lambda1 = kg[[101]], grid_lambda.08 = kg[[9]], race_card = as.integer(p2$krw$card)))

# bestReports k = 1 and reportsAtN at the optimum's N: the archived optimum of a cached analysis (HiGHS, status optimal)
# is the best report of its family, and at its own N it has the smallest Ew (risk = (Ew + tau (M - N)) / M).
arch <- function(id, fit, e_pkg, ids, crit, w, key, e_or) {
  s <- fit$settings; g <- unname(get_grades(fit)[ids]); ev <- fit$evaluation; n <- length(ids); M <- M_of(n)
  stopifnot(fit$fit$status$normalized == "optimal", is.null(s$exact_G), is.null(s$q))
  f <- fam_atmost(as.integer(s$G_max)); Ew <- sum(w * unname(ev$E))
  # the base-R oracle agrees (same family, cached enumeration on the r15 array), and the optimum is unique by a margin
  sc <- get(key, envir = oracle_cache); ob <- o_best(sc, n, s$tau, 2, list(), id)
  stopifnot(identical(as.integer(ob$grade[[1]]), as.integer(g)), ob$risk[2] - ob$risk[1] > 1e-10)
  check_close(ob$risk[1], ev$primary_risk, 1e-12, paste(id, "risk vs base R"))
  E <- earr(unname(e_pkg), ids, crit)
  padd(row(paste0("bestReports-", id, "-archived"), "bestReports", list(E = E, tau = s$tau, w = vec(w), family = f, k = 1, arraySource = "package"),
           list(pkg = list(grade = list(vec(g)), risk = vec(ev$primary_risk), N = vec(ev$N), Ew = vec(Ew)))))
  padd(row(sprintf("reportsAtN-%s-archived-N%d", id, ev$N), "reportsAtN", list(E = E, w = vec(w), family = f, N = ev$N, k = 1, arraySource = "package"),
           list(pkg = list(grade = list(vec(g)), Ew = vec(Ew)))))
}
arch("case_cde_12", cde_fit, pr_case_cde$input$e, cde_ids, pr_case_cde$input$criterion_ids, 1, "cde-cap3")
arch("tutorial_one", t1, pr_tutorial$one$e, pr_tutorial$one$entity_ids, pr_tutorial$one$criterion_ids, 1, "six-A-cap3")
stopifnot(identical(pr_tutorial$two$entity_ids, six_ids))
arch("tutorial_two", t2, pr_tutorial$two$e, pr_tutorial$two$entity_ids, pr_tutorial$two$criterion_ids, c(0.5, 0.5), "six-AB-w.5.5-cap3")
# The archived tutorial frontier (K = 2, weights .5/.5, at most 3 grades): at each tau its optimum has N and
# Ew = risk M - tau (M - N); reportsAtN at that N must report the same smallest Ew.
tf <- cached("tutorial_frontier")$table; sc6 <- get("six-AB-w.5.5-cap3", envir = oracle_cache)
for (N in unique(tf$N)) {
  r <- tf[tf$N == N, ][1, ]; Ew <- r$primary_risk * 15 - r$tau * (15 - N)
  check_close(Ew, o_at_n(sc6, N, 1, "tf")$Ew, 1e-12, paste("tutorial_frontier N", N))
  padd(row(sprintf("reportsAtN-tutorial_frontier-tau%s-N%d", fmt(r$tau), N), "reportsAtN",
           list(E = earr(unname(pr_tutorial$two$e), six_ids, pr_tutorial$two$criterion_ids), w = vec(c(0.5, 0.5)), family = fam_atmost(3), N = N,
                k = 1, arraySource = "package"),
           list(pkg = list(Ew = vec(Ew)))))
}
write_golden("postrank-part3", prow, generator = "r-export/16_part3.R", uses_postrank = TRUE)
cat("postrank-part3:", length(prow), "rows\n")
