# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for reportCardRows (engine/src/report.ts) (Step 2.12).
#   postrank-report-card  postrank 1.1.0: the row order of postrank_report_card() (order = "expected_rank", "mean" with
#                         each criterion, "label") on the package's cached analyses (read with load_or_compute() from
#                         the vignette setup script), and the package's ordering rule (R/report-card.R:
#                         order(grade, key, entity-id rank, method = "radix")) applied to supplied summaries with ties
#                         and mixed-case, digit and non-ASCII ids. sort = "grade" (keep the input order within a grade,
#                         engine/README.md) is the base-R order(grade, index).
# Engine call: reportCardRows(g, { ids, expectedRank, mean }, sort) -> unit indices (0-based) in display order, where
# expectedRank is the weighted expected rank sum_k w_k (1 + sum_{j != i} e_ij,k) (the card's key) and mean the
# ordering criterion's posterior mean (larger first). Keys are written with 15 significant digits; each case checks
# that the rounded keys give the package's order.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
load_postrank()
.libPaths(c(postrank_lib, .libPaths()))              # the vignette reader loads postrank through system.file()
source(system.file("scripts", "_vignette-setup.R", package = "postrank"), local = TRUE)

vec <- function(x) I(unname(x))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
r15 <- function(x) as.numeric(sprintf("%.15g", x))
pkg_order <- function(g, key, ids) order(g, key, match(ids, sort(ids, method = "radix")), method = "radix")   # R/report-card.R

rc_rows <- function(key, level = 0.90) {
  a <- load_or_compute(key); fit <- a$fit; pw <- fit$problem$pairwise; ids <- pw$entity_ids; ks <- pw$criterion_ids
  g <- unname(fit$grade[ids]); w <- fit$problem$settings$weights[ks]
  card0 <- postrank_report_card(a, level = level)
  d0 <- card0$data[match(ids, card0$data$entity_id), ]
  er <- as.numeric(as.matrix(d0[paste0("expected_rank_", ks)]) %*% w)
  means <- sapply(ks, function(k) d0[[paste0("mean_", k)]]); if (is.null(dim(means))) means <- matrix(means, nrow = 1)
  emit <- function(sort, card, summaries, label) {
    idx <- match(card$data$entity_id, ids) - 1L
    stopifnot(!anyNA(idx), length(unique(idx)) == length(ids))
    add(row(sprintf("reportCardRows-%s-%s", key, label), "reportCardRows",
            list(g = vec(g), summaries = summaries, sort = sort), list(rows = vec(idx))))
  }
  # expected_rank (the card's default): key = weighted expected rank.
  ser <- r15(er); stopifnot(identical(pkg_order(g, ser, ids), match(card0$data$entity_id, ids)))
  emit("expected_rank", card0, list(ids = vec(ids), expectedRank = vec(ser)), "expected_rank")
  # mean, one criterion at a time (larger first).
  for (k in ks) {
    card <- postrank_report_card(a, level = level, order = "mean", order_by = k)
    m <- r15(unname(d0[[paste0("mean_", k)]])); stopifnot(identical(pkg_order(g, -m, ids), match(card$data$entity_id, ids)))
    emit("mean", card, list(ids = vec(ids), mean = vec(m)), paste0("mean-", k))
  }
  # label: entity id in code-point order (R radix sort).
  card <- postrank_report_card(a, level = level, order = "label")
  stopifnot(identical(pkg_order(g, rep(0, length(ids)), ids), match(card$data$entity_id, ids)))
  emit("label", card, list(ids = vec(ids)), "label")
  # grade: keep the input (index) order within each grade.
  add(row(sprintf("reportCardRows-%s-grade", key), "reportCardRows", list(g = vec(g), summaries = list(ids = vec(ids)), sort = "grade"),
          list(rows = vec(order(g, seq_along(g)) - 1L))))
  invisible(list(ids = ids, g = g))
}
rc_rows("tutorial_one"); rc_rows("tutorial_two"); rc_rows("toy_analysis"); rc_rows("case_cde_12")
rc_rows("analysis_30x3_tau35"); rc_rows("case_krw_signed97"); rc_rows("case_alabama67", level = 0.95)

# Supplied summaries: the package's ordering line on keys with ties, so that the entity-id tie-break decides. Ids mix
# upper and lower case, digits and a non-ASCII letter; code-point order is "10" < "9" < "B" < "C" < "a" < "a2" < "b" <
# "z" < "Ä".
ids <- c("b", "a", "C", "B", "a2", "10", "9", "z", "Ä")
stopifnot(identical(sort(ids, method = "radix"), c("10", "9", "B", "C", "a", "a2", "b", "z", "Ä")))
g <- c(2, 1, 1, 2, 1, 3, 3, 2, 1)
er <- c(4, 2, 2, 4, 1.5, 7, 7, 5, 2)
mn <- c(0.1, 0.4, 0.4, 0.1, 0.9, -0.3, -0.3, 0.1, 0.4)
sup <- function(label, sort, key, summaries) {
  o <- pkg_order(g, key, ids)
  add(row(paste0("reportCardRows-supplied-", label), "reportCardRows", list(g = vec(g), summaries = summaries, sort = sort),
          list(rows = vec(o - 1L))))
}
sup("expected_rank-ties", "expected_rank", er, list(ids = vec(ids), expectedRank = vec(er), mean = vec(mn)))
sup("mean-ties", "mean", -mn, list(ids = vec(ids), expectedRank = vec(er), mean = vec(mn)))
sup("label", "label", rep(0, length(ids)), list(ids = vec(ids)))
add(row("reportCardRows-supplied-grade", "reportCardRows", list(g = vec(g), summaries = list(ids = vec(ids)), sort = "grade"),
        list(rows = vec(order(g, seq_along(g)) - 1L))))
# Default sort (expected_rank) when sort is omitted.
add(row("reportCardRows-supplied-default-sort", "reportCardRows", list(g = vec(g), summaries = list(ids = vec(ids), expectedRank = vec(er))),
        list(rows = vec(pkg_order(g, er, ids) - 1L))))
# One grade (all withheld): the whole card is the secondary order.
g1 <- rep(1, 9)
add(row("reportCardRows-supplied-one-grade-label", "reportCardRows", list(g = vec(g1), summaries = list(ids = vec(ids)), sort = "label"),
        list(rows = vec(pkg_order(g1, rep(0, 9), ids) - 1L))))

# ---- Step 6.14 (G-07): the 30-site poverty card at tau = .25, at most 4 grades ------
# The page's card: postrank_cuts(rule = "optimal") on pr_example_gaussian in ascending expected-rank order with weights
# (poverty 1, frl 0, snap 0). No cached analysis holds this card (analysis_30x3 weights the three criteria), so the row
# orders come from the package's own card builder (R/report-card.R .pr_report_card_build) applied to that grade and
# the package's analytic posterior summaries, and each is checked against the ordering line on the 15-digit keys the
# rows carry. The grade and keys are also checked against the released course files (r-export/15_part2.R).
source("r-export/15_part2.R")
gs <- pr_example_gaussian; wp <- c(poverty = 1, frl = 0, snap = 0)
erp <- postrank_expected_rank(gs, wp)
st30 <- postrank_settings(wp, tau = 0.25, G_max = 4L)
cut30 <- postrank_cuts(erp, gs, st30, direction = "ascending", rule = "optimal")
ids30 <- gs$entity_ids; g30 <- unname(cut30$grade[ids30])
stopifnot(identical(ids30, p2$th$ids), identical(as.integer(g30), p2$th$card))
summ30 <- postrank:::.pr_posterior_summaries(gs, 0.90)
fit30 <- list(problem = list(pairwise = gs, settings = st30), grade = cut30$grade,
              solution_identity = list(relation_identity = "step-6.14"), input_identity = "step-6.14")
er30 <- r15(unname(erp[ids30])); m30 <- r15(unname(summ30$means[ids30, "poverty"]))
stopifnot(max(abs(er30 - p2$th$er)) < 1e-12, identical(m30, p2$th$mean))
sum30 <- list(ids = vec(ids30), expectedRank = vec(er30), mean = vec(m30))
for (spec in list(list("expected_rank", NULL, er30), list("mean", "poverty", -m30), list("label", NULL, rep(0, 30)))) {
  card <- postrank:::.pr_report_card_build(fit30, summ30, spec[[1]], spec[[2]])
  o <- match(card$data$entity_id, ids30)
  stopifnot(!anyNA(o), identical(o, pkg_order(g30, spec[[3]], ids30)))
  add(row(sprintf("reportCardRows-thirty-poverty-card-cap4-tau.25-%s", spec[[1]]), "reportCardRows",
          list(g = vec(g30), summaries = sum30, sort = spec[[1]]), list(rows = vec(o - 1L))))
}
add(row("reportCardRows-thirty-poverty-card-cap4-tau.25-grade", "reportCardRows", list(g = vec(g30), summaries = sum30, sort = "grade"),
        list(rows = vec(order(g30, seq_along(g30)) - 1L))))

write_golden("postrank-report-card", rows, generator = "r-export/12_report_card.R", uses_postrank = TRUE)
cat("postrank-report-card:", length(rows), "rows\n")
