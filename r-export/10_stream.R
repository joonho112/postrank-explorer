# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/random.ts and the seeded parts of engine/src/simulate.ts (Step 2.12).
#   oracle-stream  base R only: the pr-core seeded stream reimplemented from engine/README.md "Random stream"
#                  (r-export/_rng.R): mulberry32 integers, open uniforms (x + 0.5)/2^32, Box-Muller normals (cos first,
#                  sin cached); gaussianDraws (engine/API.md "Step 2.8-2.10 conventions": z = normals(seed, S n K)
#                  consumed draw-major, then unit, then criterion); rankSummariesMC (rank summaries of those draws,
#                  K = 1: the empirical shares the stream implies). postrank is not loaded.
# JSON keeps 15 significant digits, so a uniform (2x + 1)/2^33 is written as its odd numerator 2x + 1 (field
# `u33`, an exact integer below 2^33); the adapter multiplies the engine's uniforms by 2^33, which is exact.
# Integers and uniforms are compared exactly; normals and draws with relative tolerance 1e-14 (different libm for
# log, cos and sin, plus the 15-digit rounding of the golden value).
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R"); source("r-export/_rng.R")
assert_no_postrank()

vec <- function(x) I(unname(x))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
TWO33 <- 2^33
u33 <- function(u) { v <- u * TWO33; stopifnot(all(v == round(v)), all(v %% 2 == 1), all(v < TWO33)); v }

# ---- integers and uniforms ------------------------------------------------------------------------------------------
# README worked value: seed 0 starts 1144304738, 1416247, 958946056.
stopifnot(identical(prx_uint32(0, 3), c(1144304738, 1416247, 958946056)))
# Seeds: 0; small; 2^31; 2^32 - 1; negative seeds wrap (-1 -> 2^32 - 1, -2^31 -> 2^31); 2^32 wraps to 0; the course
# league seed and its replays.
seeds <- c(0, 1, 42, 7, 123456789, 2147483648, 4294967295, -1, -2147483648, 4294967296, 20261030, 20261031)
stopifnot(identical(prx_uint32(-1, 5), prx_uint32(4294967295, 5)), identical(prx_uint32(4294967296, 5), prx_uint32(0, 5)),
          identical(prx_uint32(-2147483648, 5), prx_uint32(2147483648, 5)))
for (s in seeds) {
  x <- prx_uint32(s, 12)
  stopifnot(all(x >= 0), all(x < 2^32), all(x == round(x)))
  add(row(sprintf("rngUint32-seed%.0f-12", s), "rngUint32", list(seed = s, count = 12), list(ints = vec(x))))
  u <- prx_uniforms(s, 12)
  stopifnot(all(u > 0), all(u < 1), identical(u, (x + 0.5) / 2^32))
  add(row(sprintf("rng-seed%.0f-12", s), "rng", list(seed = s, count = 12), list(u33 = vec(u33(u)))))
  add(row(sprintf("uniforms-seed%.0f-12", s), "uniforms", list(seed = s, count = 12), list(u33 = vec(u33(u)))))
}
# A long run (1,000 values) for two seeds.
for (s in c(20261030, 4294967295)) {
  add(row(sprintf("rngUint32-seed%.0f-1000", s), "rngUint32", list(seed = s, count = 1000), list(ints = vec(prx_uint32(s, 1000)))))
  add(row(sprintf("uniforms-seed%.0f-1000", s), "uniforms", list(seed = s, count = 1000), list(u33 = vec(u33(prx_uniforms(s, 1000))))))
}
# Edge: count 0 gives an empty vector; a non-integer seed throws (README: RangeError).
add(row("uniforms-seed1-0", "uniforms", list(seed = 1, count = 0), list(u33 = I(numeric()))))
add(row("rng-seed1.5-throws", "rngThrows", list(seed = 1.5), list(threw = TRUE)))

# ---- normals (Box-Muller: pairs (u1, u2); R = sqrt(-2 log u1), theta = (2 pi) u2; cos first, then sin) --------------
for (s in seeds) {
  z <- prx_normals(s, 11)                                # odd count: ends on a cos variate
  add(row(sprintf("normals-seed%.0f-11", s), "normals", list(seed = s, count = 11), list(values = vec(z))))
  add(row(sprintf("normalStream-seed%.0f-12", s), "normalStream", list(seed = s, count = 12), list(values = vec(prx_normals(s, 12)))))
}
# The stream's first values for the league seed, and a long run.
z1000 <- prx_normals(20261030, 1000)
add(row("normals-seed20261030-1000", "normals", list(seed = 20261030, count = 1000), list(values = vec(z1000))))
add(row("normalStream-seed20261030-1000", "normalStream", list(seed = 20261030, count = 1000), list(values = vec(z1000))))
# Prefix property: normals(seed, n) is the first n values of normals(seed, n + 1) (the cos/sin pairs do not move).
stopifnot(identical(prx_normals(7, 5), prx_normals(7, 6)[1:5]))
# Hand check of one pair from the integers (seed 0): u1, u2 from x1, x2.
x0 <- prx_uint32(0, 2); uu <- (x0 + 0.5) / 2^32
stopifnot(identical(prx_normals(0, 2), c(sqrt(-2 * log(uu[1])) * cos((2 * pi) * uu[2]), sqrt(-2 * log(uu[1])) * sin((2 * pi) * uu[2]))))

# ---- gaussianDraws(means, sds, S, seed): theta[s][i][k] = means[i][k] + sds[i][k] z[(s n + i) K + k] -----------------
o_draws <- function(means, sds, S, seed) {
  means <- as.matrix(means); sds <- as.matrix(sds); n <- nrow(means); K <- ncol(means)
  z <- prx_normals(seed, S * n * K); a <- array(NA_real_, c(S, n, K))
  for (s in seq_len(S)) for (i in seq_len(n)) for (k in seq_len(K)) a[s, i, k] <- means[i, k] + sds[i, k] * z[((s - 1) * n + (i - 1)) * K + k]
  a
}
draws_json <- function(a) lapply(seq_len(dim(a)[1]), function(s) unname(matrix(a[s, , ], dim(a)[2], dim(a)[3])))
gd <- function(id, means, sds, S, seed, vector_input = FALSE) {
  a <- o_draws(means, sds, S, seed)
  m_arg <- if (vector_input) vec(means) else unname(as.matrix(means))
  s_arg <- if (vector_input) vec(sds) else unname(as.matrix(sds))
  add(row(paste0("gaussianDraws-", id), "gaussianDraws", list(means = m_arg, sds = s_arg, S = S, seed = seed),
          list(draws = draws_json(a))))
  invisible(a)
}
six_m <- c(1.2, 0.95, 0.25, 0.15, -0.5, -0.8); six_mB <- c(0.7, 0.4, 0.9, 0.6, -0.5, -0.7)
gd("six-scoreA-sd.2-S5-seed424242", cbind(six_m), matrix(0.2, 6, 1), 5, 424242)
gd("six-K2-sd.2-S3-seed20261031", cbind(six_m, six_mB), matrix(0.2, 6, 2), 3, 20261031)
gd("three-K2-unequal-sd-S4-seed11", rbind(c(0, 1), c(0.5, -1), c(2, 0)), rbind(c(1, 0.5), c(0.25, 2), c(0.1, 1)), 4, 11)
gd("two-K1-vectors-S6-seed7", c(0, 1), c(1, 1), 6, 7, vector_input = TRUE)
gd("one-unit-K3-S2-seed0", rbind(c(0.1, 0.2, 0.3)), rbind(c(1, 2, 3)), 2, 0)
# The draws of 08_simulate.R's seeded_six (same convention, before its 9-decimal rounding).
a_chk <- o_draws(cbind(six_m), matrix(0.2, 6, 1), 3, 424242)
z_chk <- prx_normals(424242, 18); stopifnot(identical(a_chk[2, 4, 1], six_m[4] + 0.2 * z_chk[(1 * 6 + 3) * 1 + 1]))

# ---- rankSummariesMC(means, sds, S, seed): rank summaries of gaussianDraws with K = 1 ---------------------------------
# Rank R_i = 1 + #{j : theta_j > theta_i} in each draw (theory book ch. 5); every share is an exact count over S.
# rankProbs[r][i] = Pr(R_i = r + 1), pTop[k][i] = Pr(R_i <= k + 1) (r- and k-major), expectedRank = mean R_i,
# means = the draw mean of each unit. Each draw is checked to be tie-free with every gap above 1e-9 relative, so a
# last-place difference in a normal cannot change a rank.
o_rank_mc <- function(means, sds, S, seed) {
  a <- o_draws(cbind(means), cbind(sds), S, seed)[, , 1, drop = TRUE]
  if (S == 1) a <- matrix(a, 1)
  n <- length(means)
  R <- t(apply(a, 1, function(v) {
    d <- abs(outer(v, v, "-")); diag(d) <- Inf
    stopifnot(all(d > 1e-9 * max(1, max(abs(v)))))
    vapply(v, function(u) 1 + sum(v > u), 0)
  }))
  if (n == 1) R <- matrix(R, ncol = 1)
  rankProbs <- t(sapply(seq_len(n), function(r) colSums(R == r) / S))
  pTop <- t(sapply(seq_len(n), function(k) colSums(R <= k) / S))
  if (n == 1) { rankProbs <- matrix(rankProbs, 1); pTop <- matrix(pTop, 1) }
  list(n = n, means = vec(colMeans(a)), expectedRank = vec(colSums(R) / S), rankProbs = unname(rankProbs),
       pTop = unname(pTop), tieFree = TRUE, S = S, seed = seed, label = "monte-carlo")
}
rmc <- function(id, means, sds, S, seed) {
  r <- o_rank_mc(means, sds, S, seed)
  add(row(paste0("rankSummariesMC-", id), "rankSummariesMC", list(means = vec(means), sds = vec(sds), S = S, seed = seed), r))
  invisible(r)
}
r6 <- rmc("six-scoreA-sd.2-S1000-seed20261030", six_m, rep(0.2, 6), 1000, 20261030)
stopifnot(abs(sum(r6$expectedRank) - 21) < 1e-12, all(abs(colSums(r6$rankProbs) - 1) < 1e-12))
rmc("six-scoreA-sd.2-S200-seed1", six_m, rep(0.2, 6), 200, 1)
rmc("three-unequal-sd-S50-seed7", c(0, 0.5, 1), c(1, 0.3, 2), 50, 7)
rmc("league-like-five-S400-seed20261031", c(0.2, -0.1, 0.05, 0.3, -0.25), c(0.2, 0.1, 0.05, 0.2, 0.1), 400, 20261031)
rmc("two-S1-seed3", c(0, 0.1), c(1, 1), 1, 3)

# ---- Step 5.14: the L-02 noise draws (engine/API.md) ------------------------------------------------
# normals(1, 20) and normals(1, 21) (the prediction's 20 draws and one more; registry l02.n20.z, l02.n21.z) and
# normals(20261030, 7) (l02.n7.z). The 21st value is a cos variate; the prefix property links the two seed-1 rows.
for (cfg in list(c(1, 20), c(1, 21), c(20261030, 7)))
  add(row(sprintf("normals-seed%.0f-%d", cfg[1], cfg[2]), "normals", list(seed = cfg[1], count = cfg[2]),
          list(values = vec(prx_normals(cfg[1], cfg[2])))))
stopifnot(identical(prx_normals(1, 21)[1:20], prx_normals(1, 20)), identical(prx_normals(20261030, 7), z1000[1:7]))

# ---- Step 6.14 Part 2 rows (engine/API.md; shared inputs in r-export/15_part2.R) --------------------
# G-05 deck preset: 100 draws of the six sites (score A, SD .20, data/released/six-sites.json units) with seed 1, and
# uniforms(1, 100) (the stream the law view of the three-unit law reads; how a uniform picks an order is widget code).
source("r-export/15_part2.R")
a100 <- gd("six-scoreA-sd.2-S100-seed1", cbind(p2$six$mean), cbind(p2$six$sd), 100, 1)
stopifnot(identical(p2$r15(as.vector(t(a100[, , 1]))), unlist(p2$six$draws1)))
add(row("uniforms-seed1-100", "uniforms", list(seed = 1, count = 100), list(u33 = vec(u33(prx_uniforms(1, 100))))))
stopifnot(identical(prx_uniforms(1, 100)[1:12], prx_uniforms(1, 12)))

# ---- Step 6.14 finiteLawDraws(probs, S, seed) (engine/API.md "Step 6.14: Part 2 helpers") ----------------------------
# u = uniforms(seed, S); cumulative sums c_k = c_{k-1} + p_k left to right in double arithmetic (an explicit loop: R's
# cumsum accumulates in long double); draw s = the smallest k with u_s < c_k (strict), else the last index K - 1.
# Draws are 0-based. Rows with `probs33` carry the probabilities as exact numerators over 2^33 (the adapter divides),
# so that a cumulative sum can sit exactly on a uniform (15-digit JSON cannot hold a 33-bit dyadic fraction).
o_finite_law_draws <- function(probs, S, seed) {
  K <- length(probs); cs <- numeric(K); cs[1] <- probs[1]
  if (K > 1) for (k in 2:K) cs[k] <- cs[k - 1] + probs[k]
  u <- prx_uniforms(seed, S)
  vapply(u, function(x) { k <- which(x < cs); if (length(k)) k[1] - 1 else K - 1 }, 0)
}
fld <- function(id, probs, S, seed, probs33 = NULL) {
  d <- o_finite_law_draws(if (is.null(probs33)) probs else probs33 / TWO33, S, seed)
  stopifnot(all(d == round(d)), all(d >= 0), all(d < max(length(probs), length(probs33))))
  args <- if (is.null(probs33)) list(probs = vec(probs), S = S, seed = seed) else list(probs33 = vec(probs33), S = S, seed = seed)
  add(row(paste0("finiteLawDraws-", id), "finiteLawDraws", args, list(draws = I(as.integer(d)))))
  invisible(d)
}
# The theory book's ch. 10 three-unit law (orders ABC, ACB, BAC, CBA with probabilities 3/5, 3/20, 3/20, 1/10).
tb10_p <- p2$r15(p2$tb10$masses / 20)
stopifnot(identical(tb10_p, c(0.6, 0.15, 0.15, 0.1)))
d10 <- fld("tb10-law3-S100-seed1", tb10_p, 100, 1)
cat("finiteLawDraws ch. 10 law, seed 1: first five", d10[1:5], "; shares over 100:", tabulate(d10 + 1, 4) / 100, "\n")
d10b <- fld("tb10-law3-S5-seed424242", tb10_p, 5, 424242)
fld("tb10-law3-S0-seed1", tb10_p, 0, 1)
# Seeds reduce mod 2^32: -1 draws as 4294967295.
stopifnot(identical(o_finite_law_draws(tb10_p, 12, -1), o_finite_law_draws(tb10_p, 12, 4294967295)))
fld("tb10-law3-S12-seed-1", tb10_p, 12, -1)
# Probabilities summing short of 1 (.75): uniforms at or above .75 fall back to the last index.
p_short <- c(0.3, 0.25, 0.2); u_short <- prx_uniforms(1, 20)
stopifnot(sum(u_short >= 0.75) == 4)
d_short <- fld("short.75-S20-seed1", p_short, 20, 1)
stopifnot(all(d_short[u_short >= 0.75] == 2), any(d_short[u_short < 0.75] == 2))   # the last index is also an ordinary state
# Zero-probability states are never drawn by the strict rule (c_k = c_{k-1}); an all-zero law always gives the last index.
d_zero <- fld("zeros-0.5.0.5-S20-seed7", c(0, 0.5, 0, 0.5), 20, 7)
stopifnot(!any(d_zero %in% c(0, 2)))
fld("all-zero-S6-seed3", c(0, 0), 6, 3)
fld("point-mass-S5-seed42", 1, 5, 42)
# Strict comparison: cumulative sums placed exactly on uniforms 1 and 3 of seed 1 (u_3 > u_1 after sorting).
n8 <- prx_uniforms(1, 8) * TWO33; lo <- min(n8[c(1, 3)]); hi <- max(n8[c(1, 3)])
p33 <- c(lo, hi - lo, TWO33 - hi)
d_b <- fld("boundary-on-u1-u3-S8-seed1", NULL, 8, 1, probs33 = p33)
cs_b <- cumsum(p33) / TWO33; stopifnot(cs_b[1] == lo / TWO33, cs_b[2] == hi / TWO33)
stopifnot(d_b[which(n8 == lo)] == 1, d_b[which(n8 == hi)] == 2)           # u_s = c_k moves the draw past k
# Invalid inputs throw (engine/API.md: probs nonempty, finite, in [0, 1]; S an integer >= 0; seed an integer).
for (bad in list(list("empty", list(probs = I(numeric()), S = 3, seed = 1)), list("p1.5", list(probs = vec(c(0.5, 1.5)), S = 3, seed = 1)),
                 list("pneg", list(probs = vec(c(-0.1, 1)), S = 3, seed = 1)), list("S-1", list(probs = vec(c(0.5, 0.5)), S = -1, seed = 1)),
                 list("S2.5", list(probs = vec(c(0.5, 0.5)), S = 2.5, seed = 1)), list("seed1.5", list(probs = vec(c(0.5, 0.5)), S = 3, seed = 1.5))))
  add(row(paste0("finiteLawDraws-throws-", bad[[1]]), "finiteLawDrawsThrows", bad[[2]], list(threw = TRUE)))

assert_no_postrank()
write_golden("oracle-stream", rows, generator = "r-export/10_stream.R", uses_postrank = FALSE)
cat("oracle-stream:", length(rows), "rows\n")
