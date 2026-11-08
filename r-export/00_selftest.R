# Author: JoonHo Lee (jlee296@ua.edu).
# Self-test of the r-export base: writes one oracle golden group and one postrank group with manifest fragments.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")

z <- c(-37, -10, -1, 0, 1, 10, 37)
rows <- lapply(z, function(v) list(id = sprintf("pnorm-%g", v), args = list(z = v), expect = list(cdf = pnorm(v), sf = pnorm(v, lower.tail = FALSE))))
assert_no_postrank()
write_golden("oracle-selftest", rows, generator = "r-export/00_selftest.R", uses_postrank = FALSE)

load_postrank()
e <- pr_tutorial$one$e[, , "score_A"]
g <- c(A = 1L, B = 1L, C = 2L, D = 2L, E = 3L, F = 3L)
ev <- postrank_evaluate(g, pr_tutorial$one, weights = c(score_A = 1), tau = 0.2)
rows2 <- list(list(id = "six-112233-tau20", args = list(grade = unname(g), tau = 0.2),
                   expect = list(N = ev$N, E = unname(ev$E), risk = ev$primary_risk,
                                 oracle_risk = oracle_risk(unname(g), unname(e), 0.2))))
write_golden("postrank-selftest", rows2, generator = "r-export/00_selftest.R", uses_postrank = TRUE)
cat("selftest golden groups written\n")
