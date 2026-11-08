# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for engine/src/special.ts (base R; no postrank).
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

z <- sort(unique(c(seq(-37, 37, by = 0.5), -8.3, -5.1, -1.96, -1.645, -0.674, 0.674, 1.645, 1.96, 5.1, 8.3, 1e-8, -1e-8)))
rows <- lapply(z, function(v) list(
  id = sprintf("z=%.10g", v), args = list(z = v),
  expect = list(cdf = pnorm(v), sf = pnorm(v, lower.tail = FALSE), pdf = dnorm(v))))

p <- sort(unique(c(1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5,
                   0.7, 0.8, 0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-10)))
rows <- c(rows, lapply(p, function(v) list(id = sprintf("p=%.10g", v), args = list(p = v), expect = list(quantile = qnorm(v)))))
# Upper-tail quantiles: normalQuantile(p, { lowerTail: false }) = qnorm(p, lower.tail = FALSE), so tiny upper tails keep
# full precision (1 - p would round them away).
pu <- sort(unique(c(1e-300, 1e-100, 1e-20, 1e-17, 1e-10, 1e-5, 0.001, 0.025, 0.05, 0.2, 0.5, 0.8, 0.975, 0.999, 1 - 1e-10)))
rows <- c(rows, lapply(pu, function(v) list(id = sprintf("upper-p=%.10g", v), args = list(p = v, lowerTail = FALSE),
                                            expect = list(quantile = qnorm(v, lower.tail = FALSE)))))
write_golden("oracle-special", rows, generator = "r-export/01_special.R", uses_postrank = FALSE)
cat(length(rows), "rows\n")
